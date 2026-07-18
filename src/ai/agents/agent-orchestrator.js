/**
 * Agent Orchestrator - Manages multi-agent collaboration
 * Phase 3: Coordinates agents, manages workflow, handles inter-agent communication
 */

import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Agent Orchestrator - Orchestrates multi-agent teams and workflows
 */
export class AgentOrchestrator {
  constructor() {
    this.agents = new Map();
    this.workflows = new Map();
    this.messageQueue = [];
    this.executionHistory = [];
    this.collaborationMetrics = new Map();
    this.maxConcurrentAgents = 3;
    this.globalTimeout = 120000; // 2 minutes
  }

  /**
   * Register an agent in the orchestrator
   */
  registerAgent(agent) {
    this.agents.set(agent.id, agent);
    this.collaborationMetrics.set(agent.id, {
      tasksCompleted: 0,
      tasksSuccessful: 0,
      totalDuration: 0,
      averageDuration: 0,
      lastExecuted: null,
      errorCount: 0
    });

    logger.info('Agent registered', {
      agentId: agent.id,
      agentName: agent.name,
      capabilities: agent.capabilities
    });

    return agent.id;
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId) {
    this.agents.delete(agentId);
    this.collaborationMetrics.delete(agentId);
    logger.info('Agent unregistered', { agentId });
  }

  /**
   * Get agent by ID or name
   */
  getAgent(idOrName) {
    if (this.agents.has(idOrName)) {
      return this.agents.get(idOrName);
    }

    for (const agent of this.agents.values()) {
      if (agent.name === idOrName) return agent;
    }

    return null;
  }

  /**
   * Execute a single agent task
   */
  async executeAgent(agentId, task, context = {}) {
    const agent = this.getAgent(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    const executionId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('Agent execution started', {
        executionId,
        agentId: agent.id,
        agentName: agent.name,
        task: task.substring(0, 100)
      });

      // Set timeout for agent execution
      const result = await Promise.race([
        agent.execute(task, context),
        this.createTimeoutPromise(this.globalTimeout)
      ]);

      const duration = Date.now() - startTime;

      // Update metrics
      this.updateAgentMetrics(agent.id, result.success, duration);

      // Record execution
      this.executionHistory.push({
        executionId,
        agentId: agent.id,
        agentName: agent.name,
        task: task.substring(0, 200),
        result: result.success ? 'success' : 'failed',
        duration,
        timestamp: new Date().toISOString()
      });

      logger.info('Agent execution completed', {
        executionId,
        agentName: agent.name,
        success: result.success,
        duration
      });

      return {
        executionId,
        ...result
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateAgentMetrics(agent.id, false, duration);

      logger.error('Agent execution failed', {
        executionId,
        agentId: agent.id,
        error: error.message,
        duration
      });

      throw error;
    }
  }

  /**
   * Execute multiple agents in sequence (workflow)
   */
  async executeSequence(agentIds, task, context = {}) {
    const results = [];
    let workflowContext = { ...context };

    for (const agentId of agentIds) {
      try {
        const result = await this.executeAgent(agentId, task, workflowContext);
        results.push(result);

        // Pass result as context to next agent
        workflowContext.previousResult = result;
      } catch (error) {
        logger.error(`Sequential execution failed at agent ${agentId}:`, error.message);
        results.push({ error: error.message, agentId });
        break; // Stop on failure
      }
    }

    return {
      workflowType: 'sequential',
      results,
      agentsExecuted: results.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute multiple agents in parallel
   */
  async executeParallel(agentIds, task, context = {}) {
    // Limit concurrent agents
    const batches = [];
    for (let i = 0; i < agentIds.length; i += this.maxConcurrentAgents) {
      batches.push(agentIds.slice(i, i + this.maxConcurrentAgents));
    }

    const allResults = [];

    for (const batch of batches) {
      try {
        const batchResults = await Promise.all(
          batch.map(agentId => this.executeAgent(agentId, task, context))
        );
        allResults.push(...batchResults);
      } catch (error) {
        logger.error('Parallel execution batch failed:', error.message);
        allResults.push({ error: error.message });
      }
    }

    return {
      workflowType: 'parallel',
      results: allResults,
      agentsExecuted: allResults.length,
      batchSize: this.maxConcurrentAgents,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Collaborative execution: agents share context and results
   */
  async executeCollaborative(agentIds, initialTask, context = {}) {
    const collaborationId = uuidv4();
    let sharedContext = {
      ...context,
      collaborationId,
      sharedKnowledge: new Map(),
      agentOutputs: {}
    };

    const results = [];

    for (let iteration = 0; iteration < 3; iteration++) {
      const iterationResults = [];

      for (const agentId of agentIds) {
        try {
          // Each agent sees shared context from previous iteration
          const taskWithContext = `${initialTask}\n\nShared knowledge: ${JSON.stringify(
            Array.from(sharedContext.sharedKnowledge.entries())
          )}`;

          const result = await this.executeAgent(agentId, taskWithContext, sharedContext);
          iterationResults.push(result);

          // Share findings with other agents
          if (result.success && result.results) {
            sharedContext.agentOutputs[agentId] = result.results;
            this.extractAndShareKnowledge(sharedContext, agentId, result.results);
          }
        } catch (error) {
          logger.warn(`Agent ${agentId} failed in collaboration:`, error.message);
        }
      }

      results.push({
        iteration: iteration + 1,
        agentResults: iterationResults,
        sharedKnowledgeSize: sharedContext.sharedKnowledge.size
      });
    }

    return {
      workflowType: 'collaborative',
      collaborationId,
      results,
      totalIterations: 3,
      finalKnowledge: Object.fromEntries(sharedContext.sharedKnowledge),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract and share knowledge from agent results
   */
  extractAndShareKnowledge(sharedContext, agentId, results) {
    if (Array.isArray(results)) {
      results.forEach((result, idx) => {
        const key = `${agentId}-finding-${idx}`;
        sharedContext.sharedKnowledge.set(key, result);
      });
    } else if (typeof results === 'object') {
      Object.entries(results).forEach(([key, value]) => {
        sharedContext.sharedKnowledge.set(`${agentId}-${key}`, value);
      });
    }
  }

  /**
   * Create timeout promise
   */
  createTimeoutPromise(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Agent execution timeout after ${ms}ms`)), ms)
    );
  }

  /**
   * Update agent metrics
   */
  updateAgentMetrics(agentId, success, duration) {
    const metrics = this.collaborationMetrics.get(agentId);
    if (!metrics) return;

    metrics.tasksCompleted++;
    if (success) metrics.tasksSuccessful++;
    else metrics.errorCount++;

    metrics.totalDuration += duration;
    metrics.averageDuration = metrics.totalDuration / metrics.tasksCompleted;
    metrics.lastExecuted = new Date().toISOString();
  }

  /**
   * List all registered agents
   */
  listAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      status: agent.status,
      metrics: this.collaborationMetrics.get(agent.id)
    }));
  }

  /**
   * Get execution history
   */
  getHistory(limit = 50) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get orchestrator statistics
   */
  getStats() {
    const totalExecutions = this.executionHistory.length;
    const successful = this.executionHistory.filter(e => e.result === 'success').length;
    const avgDuration =
      totalExecutions > 0
        ? this.executionHistory.reduce((sum, e) => sum + e.duration, 0) / totalExecutions
        : 0;

    return {
      totalAgents: this.agents.size,
      totalExecutions,
      successfulExecutions: successful,
      failedExecutions: totalExecutions - successful,
      successRate:
        totalExecutions > 0 ? ((successful / totalExecutions) * 100).toFixed(1) + '%' : '0%',
      averageDurationMs: avgDuration.toFixed(0),
      agentMetrics: Object.fromEntries(
        Array.from(this.collaborationMetrics.entries()).map(([id, metrics]) => [
          this.agents.get(id)?.name || id,
          metrics
        ])
      )
    };
  }
}

// Export singleton orchestrator
export const agentOrchestrator = new AgentOrchestrator();
