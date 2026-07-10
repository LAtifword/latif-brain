/**
 * Workflow Scheduler - Schedule and execute workflows with cron expressions
 * Phase 6: Automated scheduling and background task management
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Scheduled Workflow - Workflow with schedule configuration
 */
export class ScheduledWorkflow {
  constructor(workflowId, workflow, schedule = null) {
    this.id = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.workflowId = workflowId;
    this.workflow = workflow;
    this.schedule = schedule; // Cron expression or interval config
    this.enabled = true;
    this.lastRun = null;
    this.nextRun = null;
    this.executionCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Check if scheduled workflow should run at given time
   */
  shouldRun(now = new Date()) {
    if (!this.enabled) return false;
    if (!this.schedule) return false;

    // Simple cron parsing: support basic patterns like "0 9 * * *" (daily at 9am)
    if (typeof this.schedule === 'string') {
      return this.evaluateCron(this.schedule, now);
    }

    // Support interval-based scheduling: { type: 'interval', value: 3600000 }
    if (this.schedule.type === 'interval') {
      if (!this.lastRun) return true;
      return now - this.lastRun >= this.schedule.value;
    }

    // Support one-time scheduling: { type: 'once', runAt: timestamp }
    if (this.schedule.type === 'once') {
      if (this.lastRun) return false; // Already ran
      return now >= new Date(this.schedule.runAt);
    }

    return false;
  }

  /**
   * Evaluate cron expression (simplified: supports minute hour day month weekday)
   */
  evaluateCron(expr, now = new Date()) {
    const parts = expr.split(' ');
    if (parts.length !== 5) return false;

    const [minute, hour, day, month, weekday] = parts;
    const n = now;

    const checks = [
      this.matchesCronPart(minute, n.getMinutes(), 0, 59),
      this.matchesCronPart(hour, n.getHours(), 0, 23),
      this.matchesCronPart(day, n.getDate(), 1, 31),
      this.matchesCronPart(month, n.getMonth() + 1, 1, 12),
      this.matchesCronPart(weekday, n.getDay(), 0, 6)
    ];

    return checks.every(c => c);
  }

  /**
   * Match cron field part (* or number or range)
   */
  matchesCronPart(part, value, _min, _max) {
    if (part === '*') return true;
    if (!isNaN(part)) return parseInt(part, 10) === value;
    if (part.includes('-')) {
      const [rangeMin, rangeMax] = part.split('-').map(p => parseInt(p, 10));
      return value >= rangeMin && value <= rangeMax;
    }
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      const stepVal = parseInt(step, 10);
      if (range === '*') return value % stepVal === 0;
      const [rangeMin, rangeMax] = range.split('-').map(p => parseInt(p, 10));
      return value >= rangeMin && value <= rangeMax && (value - rangeMin) % stepVal === 0;
    }
    return false;
  }

  /**
   * Record execution
   */
  recordExecution(success = true) {
    this.lastRun = new Date().toISOString();
    this.executionCount++;
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Calculate next run time
   */
  calculateNextRun() {
    if (!this.enabled || !this.schedule) return null;

    if (this.schedule.type === 'once') {
      if (this.lastRun) return null; // Already ran
      return new Date(this.schedule.runAt);
    }

    if (this.schedule.type === 'interval') {
      if (!this.lastRun) return new Date(); // Run immediately
      return new Date(new Date(this.lastRun).getTime() + this.schedule.value);
    }

    // For cron: approximate next run (simplified)
    if (typeof this.schedule === 'string') {
      const now = new Date();
      let checkTime = new Date(now.getTime() + 60000); // Check next minute

      for (let i = 0; i < 1440; i++) { // Check up to 24 hours
        if (this.evaluateCron(this.schedule, checkTime)) {
          return checkTime;
        }
        checkTime = new Date(checkTime.getTime() + 60000);
      }
    }

    return null;
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      id: this.id,
      workflowId: this.workflowId,
      enabled: this.enabled,
      lastRun: this.lastRun,
      nextRun: this.nextRun,
      executionCount: this.executionCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate: this.executionCount > 0
        ? ((this.successCount / this.executionCount) * 100).toFixed(1) + '%'
        : 'N/A',
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Workflow Scheduler - Manage scheduled workflow execution
 */
export class WorkflowScheduler {
  constructor(workflowEngine) {
    this.workflowEngine = workflowEngine;
    this.scheduledWorkflows = new Map(); // id -> ScheduledWorkflow
    this.runningSchedules = new Map(); // id -> interval ID
    this.history = [];
    this.checkInterval = 60000; // Check every minute
  }

  /**
   * Schedule a workflow
   */
  scheduleWorkflow(workflow, schedule) {
    if (!workflow || !workflow.id) {
      throw new Error('Workflow is required and must have an id');
    }

    const scheduled = new ScheduledWorkflow(workflow.id, workflow, schedule);
    this.scheduledWorkflows.set(scheduled.id, scheduled);

    logger.info('Workflow scheduled', {
      scheduleId: scheduled.id,
      workflowId: workflow.id,
      schedule: schedule
    });

    return scheduled;
  }

  /**
   * Start background scheduling
   */
  start() {
    logger.info('Workflow scheduler started', { checkInterval: this.checkInterval });

    // Check for workflows to run every minute
    const intervalId = setInterval(() => {
      this.checkAndExecute();
    }, this.checkInterval);

    this.runningSchedules.set('main', intervalId);
  }

  /**
   * Stop background scheduling
   */
  stop() {
    this.runningSchedules.forEach((intervalId, _key) => {
      clearInterval(intervalId);
    });
    this.runningSchedules.clear();
    logger.info('Workflow scheduler stopped');
  }

  /**
   * Check and execute scheduled workflows
   */
  async checkAndExecute() {
    const now = new Date();
    const scheduled = Array.from(this.scheduledWorkflows.values());

    for (const sched of scheduled) {
      if (!sched.shouldRun(now)) continue;

      logger.info('Executing scheduled workflow', {
        scheduleId: sched.id,
        workflowId: sched.workflowId
      });

      try {
        const result = await this.workflowEngine.executeWorkflow(sched.workflow);
        sched.recordExecution(result.status === 'completed');
        sched.nextRun = sched.calculateNextRun();

        this.history.push({
          scheduleId: sched.id,
          workflowId: sched.workflowId,
          executionTime: now.toISOString(),
          success: result.status === 'completed',
          result: result
        });
      } catch (err) {
        logger.error('Scheduled workflow execution failed', {
          scheduleId: sched.id,
          workflowId: sched.workflowId,
          error: err.message
        });
        sched.recordExecution(false);
      }
    }
  }

  /**
   * Unschedule a workflow
   */
  unschedule(scheduleId) {
    const sched = this.scheduledWorkflows.get(scheduleId);
    if (sched) {
      this.scheduledWorkflows.delete(scheduleId);
      logger.info('Workflow unscheduled', { scheduleId });
      return true;
    }
    return false;
  }

  /**
   * Enable/disable a scheduled workflow
   */
  setEnabled(scheduleId, enabled) {
    const sched = this.scheduledWorkflows.get(scheduleId);
    if (sched) {
      sched.enabled = enabled;
      sched.nextRun = enabled ? sched.calculateNextRun() : null;
      return true;
    }
    return false;
  }

  /**
   * Get scheduled workflow
   */
  getScheduled(scheduleId) {
    return this.scheduledWorkflows.get(scheduleId);
  }

  /**
   * List all scheduled workflows
   */
  listScheduled() {
    return Array.from(this.scheduledWorkflows.values()).map(s => s.getStats());
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      totalScheduled: this.scheduledWorkflows.size,
      enabledCount: Array.from(this.scheduledWorkflows.values()).filter(s => s.enabled).length,
      historySize: this.history.length,
      checkInterval: this.checkInterval
    };
  }

  /**
   * Get execution history
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
  }
}

// Export singleton
export const workflowScheduler = new WorkflowScheduler(null); // Injected at runtime
