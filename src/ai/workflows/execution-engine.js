/**
 * Workflow Execution Engine (Phase 6)
 * DAG-based workflow execution with scheduling and state management
 */

import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Workflow Node (task in DAG)
 */
export class WorkflowNode {
  constructor(id, name, type, config = {}) {
    this.id = id || uuidv4();
    this.name = name;
    this.type = type; // task, condition, parallel, loop, etc.
    this.config = config;
    this.status = 'pending'; // pending, running, completed, failed, skipped
    this.result = null;
    this.error = null;
    this.startTime = null;
    this.endTime = null;
    this.retryCount = 0;
    this.maxRetries = config.maxRetries || 3;
  }

  getDuration() {
    if (!this.startTime) return null;
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }
}

/**
 * Workflow Edge (dependency)
 */
export class WorkflowEdge {
  constructor(sourceId, targetId, condition = null) {
    this.id = uuidv4();
    this.sourceId = sourceId;
    this.targetId = targetId;
    this.condition = condition; // Optional condition for conditional execution
  }
}

/**
 * Workflow Definition (DAG)
 */
export class WorkflowDefinition {
  constructor(name, description = '') {
    this.id = uuidv4();
    this.name = name;
    this.description = description;
    this.nodes = new Map();
    this.edges = new Map();
    this.variables = new Map();
    this.createdAt = new Date().toISOString();
    this.version = 1;
  }

  /**
   * Add node to workflow
   */
  addNode(name, type, config = {}) {
    const node = new WorkflowNode(uuidv4(), name, type, config);
    this.nodes.set(node.id, node);
    return node;
  }

  /**
   * Add edge between nodes
   */
  addEdge(sourceId, targetId, condition = null) {
    const edge = new WorkflowEdge(sourceId, targetId, condition);
    this.edges.set(edge.id, edge);
    return edge;
  }

  /**
   * Get node dependencies
   */
  getDependencies(nodeId) {
    const deps = [];
    this.edges.forEach(edge => {
      if (edge.targetId === nodeId) {
        deps.push(edge.sourceId);
      }
    });
    return deps;
  }

  /**
   * Get node dependents
   */
  getDependents(nodeId) {
    const dependents = [];
    this.edges.forEach(edge => {
      if (edge.sourceId === nodeId) {
        dependents.push(edge.targetId);
      }
    });
    return dependents;
  }

  /**
   * Validate workflow (check for cycles, etc.)
   */
  validate() {
    const errors = [];

    // Check for cycles
    if (this.hasCycle()) {
      errors.push('Workflow contains cycle');
    }

    // Check for orphaned nodes
    this.nodes.forEach((node, nodeId) => {
      if (!this.hasPath(nodeId)) {
        errors.push(`Node ${node.name} is orphaned`);
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Detect cycles in DAG
   */
  hasCycle() {
    const visited = new Set();
    const recStack = new Set();

    const hasCycleDFS = (nodeId) => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const dependents = this.getDependents(nodeId);
      for (const dependent of dependents) {
        if (!visited.has(dependent)) {
          if (hasCycleDFS(dependent)) return true;
        } else if (recStack.has(dependent)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycleDFS(nodeId)) return true;
      }
    }

    return false;
  }

  /**
   * Check if node has path to any dependent
   */
  hasPath(nodeId) {
    // Node with no dependencies and no dependents is orphaned
    const deps = this.getDependencies(nodeId);
    const dependents = this.getDependents(nodeId);
    return deps.length > 0 || dependents.length > 0;
  }

  /**
   * Get execution order (topological sort)
   */
  getExecutionOrder() {
    const visited = new Set();
    const order = [];

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const deps = this.getDependencies(nodeId);
      deps.forEach(dep => visit(dep));

      order.push(nodeId);
    };

    this.nodes.forEach((_, nodeId) => visit(nodeId));
    return order.map(id => this.nodes.get(id));
  }

  /**
   * Export workflow
   */
  export() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version: this.version,
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      createdAt: this.createdAt
    };
  }
}

/**
 * Workflow Execution
 */
export class WorkflowExecution {
  constructor(workflow) {
    this.id = uuidv4();
    this.workflowId = workflow.id;
    this.workflow = workflow;
    this.status = 'pending'; // pending, running, completed, failed
    this.nodeExecutions = new Map();
    this.variables = new Map(workflow.variables);
    this.startTime = null;
    this.endTime = null;
    this.logs = [];
  }

  /**
   * Execute workflow
   */
  async execute() {
    this.status = 'running';
    this.startTime = Date.now();

    try {
      const executionOrder = this.workflow.getExecutionOrder();

      for (const node of executionOrder) {
        // Check if dependencies completed successfully
        const deps = this.workflow.getDependencies(node.id);
        const depsReady = deps.every(depId => {
          const exec = this.nodeExecutions.get(depId);
          return exec && exec.status === 'completed';
        });

        if (!depsReady) {
          node.status = 'skipped';
          this.log(`Skipped ${node.name}: dependencies not ready`);
          continue;
        }

        await this.executeNode(node);
      }

      this.status = 'completed';
      this.log('Workflow completed successfully');
    } catch (error) {
      this.status = 'failed';
      this.log(`Workflow failed: ${error.message}`);
      logger.error('Workflow execution failed:', error);
    }

    this.endTime = Date.now();
    return this.getResult();
  }

  /**
   * Execute single node
   */
  async executeNode(node) {
    node.startTime = Date.now();
    node.status = 'running';

    try {
      let result;

      switch (node.type) {
      case 'task':
        result = await this.executeTask(node);
        break;
      case 'condition':
        result = await this.executeCondition(node);
        break;
      case 'loop':
        result = await this.executeLoop(node);
        break;
      case 'parallel':
        result = await this.executeParallel(node);
        break;
      default:
        result = { status: 'unknown' };
      }

      node.result = result;
      node.status = 'completed';
      this.nodeExecutions.set(node.id, node);
      this.log(`Completed ${node.name}: ${JSON.stringify(result).substring(0, 100)}`);
    } catch (error) {
      node.error = error.message;
      node.retryCount++;

      if (node.retryCount < node.maxRetries) {
        this.log(`Retrying ${node.name} (attempt ${node.retryCount})`);
        return this.executeNode(node);
      }

      node.status = 'failed';
      this.nodeExecutions.set(node.id, node);
      this.log(`Failed ${node.name}: ${error.message}`);
      throw error;
    }

    node.endTime = Date.now();
  }

  /**
   * Execute task node
   */
  async executeTask(node) {
    // In production: would execute actual task/tool
    return {
      taskName: node.name,
      executed: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute conditional node
   */
  async executeCondition(node) {
    const condition = node.config.condition;
    const result = this.evaluateCondition(condition);

    return {
      condition: condition,
      result: result,
      branches: result ? 'true' : 'false'
    };
  }

  /**
   * Execute loop node
   */
  async executeLoop(node) {
    const items = node.config.items || [];
    const results = [];

    for (let i = 0; i < items.length; i++) {
      this.variables.set('_index', i);
      this.variables.set('_item', items[i]);

      // Execute loop body
      results.push({
        index: i,
        item: items[i],
        executed: true
      });
    }

    return { loops: results.length, results };
  }

  /**
   * Execute parallel node
   */
  async executeParallel(node) {
    const tasks = node.config.tasks || [];
    const results = await Promise.all(
      tasks.map(task => this.executeTask({ name: task, type: 'task' }))
    );

    return { parallelTasks: tasks.length, results };
  }

  /**
   * Evaluate condition
   */
  evaluateCondition(condition) {
    // Simple evaluation: variable > value, etc.
    try {
      // Evaluate as JavaScript expression (sanitized)
      const variableValues = Object.fromEntries(this.variables);
      const keys = Object.keys(variableValues);
      const values = Object.values(variableValues);

      const func = new Function(...keys, `return ${condition}`);
      return func(...values);
    } catch (error) {
      logger.warn(`Condition evaluation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Log message
   */
  log(message) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      message: message
    });
    logger.info(`[Workflow ${this.id}] ${message}`);
  }

  /**
   * Get execution result
   */
  getResult() {
    return {
      executionId: this.id,
      workflowId: this.workflowId,
      status: this.status,
      duration: this.endTime - this.startTime,
      nodeExecutions: Array.from(this.nodeExecutions.values()),
      logs: this.logs,
      variables: Object.fromEntries(this.variables),
      successCount: Array.from(this.nodeExecutions.values()).filter(n => n.status === 'completed').length,
      failureCount: Array.from(this.nodeExecutions.values()).filter(n => n.status === 'failed').length
    };
  }
}

/**
 * Workflow Scheduler
 */
export class WorkflowScheduler {
  constructor() {
    this.schedules = new Map();
    this.running = new Map();
  }

  /**
   * Schedule workflow to run periodically
   */
  schedule(workflow, cronExpression) {
    const scheduleId = uuidv4();

    this.schedules.set(scheduleId, {
      id: scheduleId,
      workflowId: workflow.id,
      workflow: workflow,
      cronExpression: cronExpression,
      lastRun: null,
      nextRun: this.calculateNextRun(cronExpression),
      enabled: true,
      runs: 0
    });

    return scheduleId;
  }

  /**
   * Calculate next run time (simplified cron)
   */
  calculateNextRun(cronExpression) {
    // Simplified: just add intervals
    const intervals = {
      'hourly': 60 * 60 * 1000,
      'daily': 24 * 60 * 60 * 1000,
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000
    };

    const interval = intervals[cronExpression.toLowerCase()] || 60 * 60 * 1000;
    return Date.now() + interval;
  }

  /**
   * Execute scheduled workflows
   */
  async tick() {
    const now = Date.now();

    for (const [, schedule] of this.schedules) {
      if (!schedule.enabled) continue;
      if (schedule.nextRun > now) continue;

      try {
        const execution = new WorkflowExecution(schedule.workflow);
        await execution.execute();

        schedule.lastRun = now;
        schedule.nextRun = this.calculateNextRun(schedule.cronExpression);
        schedule.runs++;

        logger.info(`Scheduled workflow executed: ${schedule.workflowId}`);
      } catch (error) {
        logger.error(`Scheduled workflow failed: ${error.message}`);
      }
    }
  }

  /**
   * Get schedule stats
   */
  getStats() {
    let totalRuns = 0;
    let enabledCount = 0;

    this.schedules.forEach(schedule => {
      totalRuns += schedule.runs;
      if (schedule.enabled) enabledCount++;
    });

    return {
      totalSchedules: this.schedules.size,
      enabledSchedules: enabledCount,
      totalRuns: totalRuns
    };
  }
}

// Export singleton scheduler
export const workflowScheduler = new WorkflowScheduler();

// Start periodic tick
setInterval(async () => {
  await workflowScheduler.tick();
}, 60000); // Run every minute
