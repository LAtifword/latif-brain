/**
 * LATIF API Server
 * Express-based REST API server with health checks, middleware, and routing
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuid } from 'uuid';
import { logger, initializeLogger } from '../core/logger.js';
import { initializeConfig, getConfig } from '../core/config.js';
import { initializeDataLayer, getDatabase } from '../core/data-layer.js';
import { initializeJobQueue, getJobQueue } from '../core/job-queue.js';

class APIServer {
  constructor() {
    this.app = null;
    this.config = null;
    this.server = null;
    this.db = null;
    this.jobQueue = null;
  }

  async initialize() {
    try {
      // Initialize core systems
      await initializeLogger();
      this.config = await initializeConfig();
      this.db = await initializeDataLayer(this.config.get('database.path'));
      this.jobQueue = await initializeJobQueue(
        {
          queues: this.config.get('jobs.queues'),
          concurrency: this.config.get('jobs.concurrency'),
          retryAttempts: this.config.get('jobs.retryAttempts'),
          retryDelay: this.config.get('jobs.retryDelay')
        },
        this.db
      );

      // Initialize Express app
      this.app = express();
      this.setupMiddleware();
      this.setupRoutes();
      this.setupErrorHandling();

      logger.info('API server initialized', {
        port: this.config.get('app.port'),
        debug: this.config.get('app.debug')
      });
    } catch (error) {
      logger.error('API server initialization failed', { error: error.message });
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());

    // CORS middleware
    if (this.config.get('api.cors.enabled')) {
      const corsOptions = {
        origin: this.config.get('api.cors.origins'),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      };
      this.app.use(cors(corsOptions));
    }

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.id = req.get('X-Request-ID') || uuid();
      res.setHeader('X-Request-ID', req.id);
      next();
    });

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
          request_id: req.id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration_ms: duration
        });
      });

      next();
    });

    // Request validation middleware (optional auth)
    if (this.config.get('api.auth.enabled')) {
      this.app.use(this.validateAuth.bind(this));
    }
  }

  validateAuth(req, res, next) {
    const token = req.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Implement proper JWT validation
    next();
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: this.config.get('app.version')
      });
    });

    // Readiness check
    this.app.get('/ready', async (req, res) => {
      try {
        const dbStats = await this.db.getStats();
        const queueStats = await this.jobQueue.getAllStats();

        res.json({
          status: 'ready',
          database: dbStats ? 'connected' : 'disconnected',
          job_queue: Object.keys(queueStats).length > 0 ? 'running' : 'not_running'
        });
      } catch (error) {
        res.status(503).json({
          status: 'not_ready',
          error: error.message
        });
      }
    });

    // Configuration endpoint (metadata only, no secrets)
    this.app.get('/api/config', (req, res) => {
      const config = this.config.getAll();
      // Remove sensitive data
      delete config.api?.auth?.jwtSecret;
      delete config.secrets;

      res.json(config);
    });

    // System stats
    this.app.get('/api/stats', async (req, res) => {
      try {
        const dbStats = await this.db.getStats();
        const queueStats = await this.jobQueue.getAllStats();
        const logStats = await logger.getLogStats();

        res.json({
          database: dbStats,
          job_queue: queueStats,
          logs: logStats,
          memory: process.memoryUsage(),
          uptime: process.uptime()
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Recent logs
    this.app.get('/api/logs', async (req, res) => {
      try {
        const lines = parseInt(req.query.lines) || 100;
        const logs = await logger.getRecentLogs(lines);
        res.json(logs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Jobs endpoints
    this.app.post('/api/jobs', async (req, res) => {
      try {
        const { job_type, payload, ...options } = req.body;

        if (!job_type) {
          return res.status(400).json({ error: 'job_type is required' });
        }

        const jobId = await this.jobQueue.enqueue(job_type, payload, {
          ...options,
          metadata: { created_by: req.id }
        });

        res.status(201).json({ job_id: jobId });
      } catch (error) {
        logger.error('Failed to enqueue job', { error: error.message, request_id: req.id });
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/jobs/queues', async (req, res) => {
      try {
        const stats = await this.jobQueue.getAllStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/jobs/queues/:queue', async (req, res) => {
      try {
        const stats = await this.jobQueue.getQueueStats(req.params.queue);
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/jobs/dead-letter', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const jobs = await this.jobQueue.getDeadLetterQueue(limit, offset);
        res.json(jobs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/jobs/:jobId/retry', async (req, res) => {
      try {
        await this.jobQueue.retry(req.params.jobId);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/jobs/:jobId/resolve', async (req, res) => {
      try {
        const { notes } = req.body;
        await this.jobQueue.resolveDeadLetterJob(req.params.jobId, notes);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Database vacuum
    this.app.post('/api/admin/vacuum', async (req, res) => {
      try {
        await this.db.vacuum();
        res.json({ success: true, message: 'Database vacuumed' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // API documentation
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'LATIF API',
        version: this.config.get('app.version'),
        endpoints: {
          health: 'GET /health',
          ready: 'GET /ready',
          config: 'GET /api/config',
          stats: 'GET /api/stats',
          logs: 'GET /api/logs',
          enqueue_job: 'POST /api/jobs',
          queue_stats: 'GET /api/jobs/queues/:queue',
          dead_letter: 'GET /api/jobs/dead-letter',
          retry_job: 'POST /api/jobs/:jobId/retry',
          resolve_job: 'POST /api/jobs/:jobId/resolve'
        }
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        method: req.method
      });
    });
  }

  setupErrorHandling() {
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        request_id: req.id,
        path: req.path
      });

      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        request_id: req.id
      });
    });
  }

  async start() {
    try {
      const port = this.config.get('app.port');
      const host = this.config.get('app.host');

      // Start job queue
      await this.jobQueue.start();

      // Start server
      this.server = this.app.listen(port, host, () => {
        logger.info('API server started', {
          host,
          port,
          url: `http://${host}:${port}`
        });
      });
    } catch (error) {
      logger.error('Failed to start API server', { error: error.message });
      throw error;
    }
  }

  async stop() {
    try {
      await this.jobQueue.stop();

      if (this.server) {
        this.server.close(() => {
          logger.info('API server stopped');
        });
      }

      if (this.db) {
        await this.db.close();
      }
    } catch (error) {
      logger.error('Error during server shutdown', { error: error.message });
      throw error;
    }
  }

  getApp() {
    return this.app;
  }

  getDatabase() {
    return this.db;
  }

  getJobQueue() {
    return this.jobQueue;
  }
}

// Singleton instance
let apiServer = null;

export async function initializeAPIServer() {
  if (apiServer) return apiServer;

  apiServer = new APIServer();
  await apiServer.initialize();

  return apiServer;
}

export function getAPIServer() {
  if (!apiServer) {
    throw new Error('API server not initialized. Call initializeAPIServer() first.');
  }
  return apiServer;
}

export { APIServer };

export default {
  initializeAPIServer,
  getAPIServer,
  APIServer
};
