/**
 * Workflow Execution Engine - Execute workflows with state persistence and error handling
 * Phase 6: Runtime execution, scheduling, state management
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Workflow Execution State
 */
export class ExecutionState {
  constructor(workflowId, executionId) {
    this.workflowId = workflowId;
    this.executionId = executionId;
    this.status = 'pending'; // pending | running | paused | completed | failed | cancelled
    this.currentNodeId = null;
    this.nodeStates = new Map(); // nodeId -> { status, startTime, endTime, result, error }
    this.variables = {}; // Execution-scoped variables
    this.startTime = new Date().toISOString();
    this.endTime = null;
    this.completedAt = null;
    this.duration = 0;
  }

  /**
   * Update node execution state
   */
  updateNodeState(nodeId, status, result = null, error = null) {
    const now = new Date();
    if (!this.nodeStates.has(nodeId)) {
      this.nodeStates.set(nodeId, {
        status: status,
        startTime: now.toISOString(),
        endTime: null,
        result: result,
        error: error
      });
    } else {
      const state = this.nodeStates.get(nodeId);
      state.status = status;
      state.result = result;
      state.error = error;
      if (status === 'completed' || status === 'failed') {
        state.endTime = now.toISOString();
      }
    }
  }

  /**
   * Get execution summary
   */
  getSummary() {
    const nodeStates = Array.from(this.nodeStates.entries());
    const completed = nodeStates.filter(([, s]) => s.status === 'completed').length;
    const failed = nodeStates.filter(([, s]) => s.status === 'failed').length;

    return {
      executionId: this.executionId,
      workflowId: this.workflowId,
      status: this.status,
      progress: `${completed}/${nodeStates.length}`,
      failed: failed,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      variables: this.variables
    };
  }

  /**
   * Export state as JSON
   */
  toJSON() {
    return {
      workflowId: this.workflowId,
      executionId: this.executionId,
      status: this.status,
      currentNodeId: this.currentNodeId,
      nodeStates: Object.fromEntries(this.nodeStates),
      variables: this.variables,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration
    };
  }

  /**
   * Restore state from JSON
   */
  static fromJSON(data) {
    const state = new ExecutionState(data.workflowId, data.executionId);
    state.status = data.status;
    state.currentNodeId = data.currentNodeId;
    state.variables = data.variables || {};
    state.startTime = data.startTime;
    state.endTime = data.endTime;
    state.duration = data.duration;

    if (data.nodeStates) {
      Object.entries(data.nodeStates).forEach(([nodeId, nodeState]) => {
        state.nodeStates.set(nodeId, nodeState);
      });
    }

    return state;
  }
}

/**
 * Workflow Execution Context
 */
export class ExecutionContext {
  constructor(workflow, executionState, toolRegistry = null) {
    this.workflow = workflow;
    this.state = executionState;
    this.toolRegistry = toolRegistry; // Map of tool implementations
    this.outputs = new Map(); // nodeId -> output
  }

  /**
   * Get variable value with fallback
   */
  getVariable(name, defaultValue = null) {
    return this.state.variables[name] ?? defaultValue;
  }

  /**
   * Set variable value
   */
  setVariable(name, value) {
    this.state.variables[name] = value;
  }

  /**
   * Get previous node output
   */
  getNodeOutput(nodeId) {
    return this.outputs.get(nodeId);
  }

  /**
   * Set node output
   */
  setNodeOutput(nodeId, output) {
    this.outputs.set(nodeId, output);
  }

  /**
   * Resolve input parameters by substituting variables
   */
  resolveInputs(inputs) {
    const resolved = {};
    Object.entries(inputs).forEach(([key, value]) => {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        // Variable reference: ${varName}
        const varName = value.slice(2, -1);
        resolved[key] = this.getVariable(varName);
      } else if (typeof value === 'string' && value.startsWith('$.') && value.includes('.')) {
        // Node output reference: $.nodeId.field
        const parts = value.slice(2).split('.');
        const nodeId = parts[0];
        const field = parts.slice(1).join('.');
        const nodeOutput = this.getNodeOutput(nodeId);
        resolved[key] = field ? nodeOutput?.[field] : nodeOutput;
      } else {
        resolved[key] = value;
      }
    });
    return resolved;
  }
}

/**
 * Workflow Engine - Execute workflows
 */
export class WorkflowEngine {
  constructor(toolRegistry = null) {
    this.toolRegistry = toolRegistry; // Map of available tools
    this.executions = new Map(); // executionId -> ExecutionState
    this.executionHistory = [];
    this.maxConcurrentExecutions = 5;
    this.activeExecutions = new Set();
    this.timeout = 300000; // 5 minutes default
  }

  /**
   * Execute workflow
   */
  async executeWorkflow(workflow, variables = {}, options = {}) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const executionState = new ExecutionState(workflow.id, executionId);
    executionState.variables = { ...workflow.variables, ...variables };

    // Validate workflow
    try {
      workflow.validate();
    } catch (err) {
      logger.error('Workflow validation failed', { workflowId: workflow.id, error: err.message });
      return { success: false, error: err.message };
    }

    // Check concurrent execution limit
    if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
      return { success: false, error: 'Max concurrent executions exceeded' };
    }

    this.executions.set(executionId, executionState);
    this.activeExecutions.add(executionId);
    executionState.status = 'running';

    try {
      const context = new ExecutionContext(workflow, executionState, this.toolRegistry);
      await this.executeNode(workflow, workflow.startNodeId, context, options);

      executionState.status = 'completed';
    } catch (err) {
      logger.error('Workflow execution failed', {
        executionId: executionId,
        workflowId: workflow.id,
        error: err.message
      });
      executionState.status = 'failed';
    } finally {
      executionState.endTime = new Date().toISOString();
      executionState.duration = Math.round(
        (new Date(executionState.endTime) - new Date(executionState.startTime)) / 1000
      );
      this.activeExecutions.delete(executionId);
      this.executionHistory.push(executionState.getSummary());
    }

    return executionState.getSummary();
  }

  /**
   * Execute single node
   */
  async executeNode(workflow, nodeId, context, options = {}) {
    if (!nodeId) return;

    const node = workflow.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    context.state.currentNodeId = nodeId;
    context.state.updateNodeState(nodeId, 'running');

    try {
      let result;

      if (node.type === 'task') {
        result = await this.executeTask(node, context, options);
      } else if (node.type === 'condition') {
        result = await this.evaluateCondition(node, context);
      } else if (node.type === 'parallel') {
        result = await this.executeParallel(node, workflow, context, options);
      } else {
        throw new Error(`Unknown node type: ${node.type}`);
      }

      context.state.updateNodeState(nodeId, 'completed', result);
      context.setNodeOutput(nodeId, result);

      // Execute next nodes
      const nextNodes = workflow.getNextNodes(nodeId, context.state.variables);
      for (const next of nextNodes) {
        await this.executeNode(workflow, next.nodeId, context, options);
      }
    } catch (err) {
      logger.error('Node execution failed', { nodeId: nodeId, error: err.message });
      context.state.updateNodeState(nodeId, 'failed', null, err.message);
      throw err;
    }
  }

  /**
   * Execute task node
   */
  async executeTask(node, context, _options = {}) {
    const tool = node.config.tool;
    const inputs = context.resolveInputs(node.inputs);

    if (!this.toolRegistry || !this.toolRegistry.has(tool)) {
      throw new Error(`Tool ${tool} not found in registry`);
    }

    const toolFn = this.toolRegistry.get(tool);
    const startTime = Date.now();

    try {
      // Execute with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task timeout')), node.timeout)
      );

      const result = await Promise.race([toolFn(inputs, context), timeoutPromise]);

      logger.info('Task executed', {
        tool: tool,
        duration: Date.now() - startTime
      });

      return result;
    } catch (err) {
      // Handle retries
      if (node.retryPolicy && node.retryPolicy.maxRetries > 0) {
        logger.warn('Task failed, retrying', {
          tool: tool,
          error: err.message,
          retries: node.retryPolicy.maxRetries
        });

        for (let i = 0; i < node.retryPolicy.maxRetries; i++) {
          await new Promise(r => setTimeout(r, node.retryPolicy.backoffMs * Math.pow(2, i)));
          try {
            return await toolFn(inputs, context);
          } catch (retryErr) {
            if (i === node.retryPolicy.maxRetries - 1) throw retryErr;
          }
        }
      }
      throw err;
    }
  }

  /**
   * Evaluate condition
   */
  async evaluateCondition(node, context) {
    const expression = node.config.expression;
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('ctx', `return ${expression}`);
      return fn(context.state.variables);
    } catch (err) {
      logger.error('Condition evaluation failed', {
        expression: expression,
        error: err.message
      });
      return false;
    }
  }

  /**
   * Execute parallel nodes
   */
  async executeParallel(node, workflow, context, options = {}) {
    const nodeIds = node.config.nodeIds || [];
    const promises = nodeIds.map(id => this.executeNode(workflow, id, context, options));

    const results = await Promise.allSettled(promises);
    return {
      completed: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      results: results.map(r => (r.status === 'fulfilled' ? r.value : r.reason?.message))
    };
  }

  /**
   * Get execution state
   */
  getExecution(executionId) {
    return this.executions.get(executionId);
  }

  /**
   * Get execution history
   */
  getHistory(limit = 50) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Cancel execution
   */
  cancelExecution(executionId) {
    const state = this.executions.get(executionId);
    if (state) {
      state.status = 'cancelled';
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * Pause execution
   */
  pauseExecution(executionId) {
    const state = this.executions.get(executionId);
    if (state && state.status === 'running') {
      state.status = 'paused';
      return true;
    }
    return false;
  }

  /**
   * Resume execution
   */
  async resumeExecution(executionId) {
    const state = this.executions.get(executionId);
    if (state && state.status === 'paused') {
      state.status = 'running';
      // In production: restore and continue from saved state
      return true;
    }
    return false;
  }

  /**
   * Get engine statistics
   */
  getStats() {
    return {
      totalExecutions: this.executions.size,
      activeExecutions: this.activeExecutions.size,
      historySize: this.executionHistory.length,
      maxConcurrent: this.maxConcurrentExecutions
    };
  }
}

// Export singleton
export const workflowEngine = new WorkflowEngine();
