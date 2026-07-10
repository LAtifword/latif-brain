/**
 * LATIF Job Queue
 * Background task execution with worker pools, retries, and persistence
 */

import { v4 as uuid } from 'uuid';
import { logger } from './logger.js';
import { getDatabase, JobQueueRepository } from './data-layer.js';

class Worker {
  constructor(id, queue, maxConcurrency = 1) {
    this.id = id;
    this.queue = queue;
    this.maxConcurrency = maxConcurrency;
    this.currentLoad = 0;
    this.totalProcessed = 0;
    this.totalErrors = 0;
    this.status = 'idle';
    this.processingJobs = new Map();
    this.lastHeartbeat = Date.now();
  }

  canAccept() {
    return this.currentLoad < this.maxConcurrency;
  }

  async process(job, handler) {
    if (!this.canAccept()) {
      return null;
    }

    this.currentLoad++;
    this.status = 'processing';
    this.lastHeartbeat = Date.now();

    const executionId = uuid();
    const startTime = Date.now();

    try {
      logger.info('Worker processing job', {
        worker_id: this.id,
        job_id: job.id,
        execution_id: executionId
      });

      const timeout = job.timeout_ms || 300000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Job timeout')), timeout)
      );

      const result = await Promise.race([
        handler(job),
        timeoutPromise
      ]);

      this.totalProcessed++;
      this.currentLoad--;

      logger.info('Job completed', {
        worker_id: this.id,
        job_id: job.id,
        execution_id: executionId,
        duration_ms: Date.now() - startTime
      });

      return {
        execution_id: executionId,
        status: 'completed',
        result,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      this.totalErrors++;
      this.currentLoad--;

      logger.error('Job processing failed', {
        worker_id: this.id,
        job_id: job.id,
        execution_id: executionId,
        error: error.message,
        duration_ms: Date.now() - startTime
      });

      return {
        execution_id: executionId,
        status: 'failed',
        error: error.message,
        duration_ms: Date.now() - startTime
      };
    }
  }

  updateHeartbeat() {
    this.lastHeartbeat = Date.now();
    this.status = this.currentLoad > 0 ? 'processing' : 'idle';
  }

  isStale(timeout = 60000) {
    return Date.now() - this.lastHeartbeat > timeout;
  }
}

export class JobQueue {
  constructor(config = {}) {
    this.queues = config.queues || ['default', 'background', 'priority'];
    this.concurrency = config.concurrency || 4;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 5000;
    this.maxTimeout = config.maxTimeout || 300000;

    this.workers = new Map();
    this.handlers = new Map();
    this.isRunning = false;
    this.db = null;
    this.repo = null;
    this.pollInterval = null;
  }

  async initialize(database) {
    try {
      this.db = database || getDatabase();
      this.repo = new JobQueueRepository(this.db);

      // Initialize workers for each queue
      for (const queue of this.queues) {
        const queueWorkers = [];
        for (let i = 0; i < this.concurrency; i++) {
          const worker = new Worker(`${queue}-worker-${i}`, queue, 1);
          queueWorkers.push(worker);
        }
        this.workers.set(queue, queueWorkers);
      }

      logger.info('Job queue initialized', {
        queues: this.queues.length,
        workers_per_queue: this.concurrency
      });
    } catch (error) {
      logger.error('Job queue initialization failed', { error: error.message });
      throw error;
    }
  }

  registerHandler(jobType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    this.handlers.set(jobType, handler);
    logger.info('Job handler registered', { job_type: jobType });
  }

  async enqueue(jobType, payload, options = {}) {
    const job = {
      id: uuid(),
      queue: options.queue || 'default',
      status: 'pending',
      priority: options.priority || 0,
      payload: JSON.stringify(payload),
      attempts: 0,
      max_attempts: options.maxAttempts || this.retryAttempts,
      retry_delay_ms: options.retryDelay || this.retryDelay,
      timeout_ms: options.timeout || this.maxTimeout,
      metadata: JSON.stringify({
        job_type: jobType,
        ...options.metadata
      })
    };

    try {
      await this.repo.enqueue(job);
      logger.info('Job enqueued', {
        job_id: job.id,
        job_type: jobType,
        queue: job.queue,
        priority: job.priority
      });
      return job.id;
    } catch (error) {
      logger.error('Failed to enqueue job', {
        job_type: jobType,
        error: error.message
      });
      throw error;
    }
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Job queue started');

    // Start processing jobs
    for (const queue of this.queues) {
      this.startQueueProcessor(queue);
    }

    // Start heartbeat monitor
    this.startHeartbeatMonitor();
  }

  async stop() {
    this.isRunning = false;
    if (this.pollInterval) clearInterval(this.pollInterval);
    logger.info('Job queue stopped');
  }

  startQueueProcessor(queue) {
    const queueWorkers = this.workers.get(queue);
    setInterval(async () => {
      if (!this.isRunning) return;

      const availableWorker = queueWorkers.find(w => w.canAccept());
      if (!availableWorker) return;

      try {
        const jobs = await this.repo.dequeue(queue, 1);
        if (jobs.length === 0) return;

        const job = jobs[0];
        const metadata = JSON.parse(job.metadata || '{}');
        const handler = this.handlers.get(metadata.job_type);

        if (!handler) {
          logger.warn('No handler for job type', {
            job_id: job.id,
            job_type: metadata.job_type
          });
          await this.repo.markFailed(job.id, new Error('No handler registered'));
          return;
        }

        const execution = await availableWorker.process(job, handler);

        if (execution.status === 'completed') {
          await this.repo.markComplete(job.id, execution.result);
        } else {
          const error = new Error(execution.error);
          await this.repo.markFailed(job.id, error);

          // Check if we should retry
          if (job.attempts < job.max_attempts) {
            await this.scheduleRetry(job);
          } else {
            await this.moveToDeadLetterQueue(job, error);
          }
        }
      } catch (error) {
        logger.error('Queue processor error', { queue, error: error.message });
      }
    }, 1000);
  }

  async scheduleRetry(job) {
    const delay = job.retry_delay_ms * Math.pow(2, job.attempts);
    setTimeout(async () => {
      try {
        await this.db.update('jobs', job.id, {
          status: 'pending',
          attempts: job.attempts + 1
        });
        logger.info('Job retry scheduled', {
          job_id: job.id,
          attempt: job.attempts + 1,
          delay_ms: delay
        });
      } catch (error) {
        logger.error('Failed to schedule job retry', {
          job_id: job.id,
          error: error.message
        });
      }
    }, delay);
  }

  async moveToDeadLetterQueue(job, error) {
    try {
      await this.db.insert('dead_letter_queue', {
        id: uuid(),
        job_id: job.id,
        queue: job.queue,
        error: error.message,
        payload: job.payload
      });

      logger.error('Job moved to dead letter queue', {
        job_id: job.id,
        queue: job.queue,
        error: error.message
      });
    } catch (dbError) {
      logger.error('Failed to move job to dead letter queue', {
        job_id: job.id,
        error: dbError.message
      });
    }
  }

  startHeartbeatMonitor() {
    this.pollInterval = setInterval(async () => {
      try {
        for (const [queue, queueWorkers] of this.workers.entries()) {
          for (const worker of queueWorkers) {
            worker.updateHeartbeat();

            // Check for stale workers
            if (worker.isStale()) {
              logger.warn('Stale worker detected', {
                worker_id: worker.id,
                queue,
                last_heartbeat_age_ms: Date.now() - worker.lastHeartbeat
              });
            }
          }
        }
      } catch (error) {
        logger.error('Heartbeat monitor error', { error: error.message });
      }
    }, 30000);
  }

  async getQueueStats(queue) {
    try {
      const stats = await this.repo.getQueueStats(queue);
      const workers = this.workers.get(queue) || [];

      return {
        queue,
        ...stats,
        workers: workers.map(w => ({
          id: w.id,
          status: w.status,
          current_load: w.currentLoad,
          total_processed: w.totalProcessed,
          total_errors: w.totalErrors
        }))
      };
    } catch (error) {
      logger.error('Failed to get queue stats', { queue, error: error.message });
      return null;
    }
  }

  async getAllStats() {
    const stats = {};
    for (const queue of this.queues) {
      stats[queue] = await this.getQueueStats(queue);
    }
    return stats;
  }

  async getDeadLetterQueue(limit = 50, offset = 0) {
    try {
      return await this.db.all(
        'SELECT * FROM dead_letter_queue WHERE resolved = 0 LIMIT ? OFFSET ?',
        [limit, offset]
      );
    } catch (error) {
      logger.error('Failed to get dead letter queue', { error: error.message });
      return [];
    }
  }

  async resolveDeadLetterJob(jobId, notes = '') {
    try {
      await this.db.update('dead_letter_queue', jobId, {
        resolved: 1,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes
      });
      logger.info('Dead letter job resolved', { job_id: jobId });
    } catch (error) {
      logger.error('Failed to resolve dead letter job', {
        job_id: jobId,
        error: error.message
      });
      throw error;
    }
  }

  async retry(jobId) {
    try {
      const job = await this.db.findById('jobs', jobId);
      if (!job) throw new Error('Job not found');

      await this.db.update('jobs', jobId, {
        status: 'pending',
        attempts: 0,
        error: null
      });

      logger.info('Job retry initiated', { job_id: jobId });
    } catch (error) {
      logger.error('Failed to retry job', {
        job_id: jobId,
        error: error.message
      });
      throw error;
    }
  }
}

// Singleton instance
let jobQueue = null;

export async function initializeJobQueue(config = {}, database = null) {
  if (jobQueue) return jobQueue;

  jobQueue = new JobQueue(config);
  await jobQueue.initialize(database);

  return jobQueue;
}

export function getJobQueue() {
  if (!jobQueue) {
    throw new Error('Job queue not initialized. Call initializeJobQueue() first.');
  }
  return jobQueue;
}

export { Worker };

export default {
  initializeJobQueue,
  getJobQueue,
  JobQueue,
  Worker
};
