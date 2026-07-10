/**
 * Base Agent Class - Foundation for all agents
 * Implements core agent loop: perception -> reasoning -> action -> reflection
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../core/data-layer.js';
import { getLogger } from '../../core/logger.js';

const logger = getLogger();
const db = getDatabase();

/**
 * Base Agent - Abstract class for all agents
 */
export class Agent {
  constructor(name, description, capabilities = []) {
    this.id = uuidv4();
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
    this.memory = [];
    this.tools = new Map();
    this.maxIterations = 10;
    this.tokenLimit = 8000;
    this.currentTokens = 0;
    this.status = 'idle'; // idle, thinking, executing, done, error
    this.lastError = null;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Execute an agent task
   */
  async execute(task, context = {}) {
    this.startTime = Date.now();
    this.status = 'thinking';

    try {
      // Step 1: Understand task
      const perception = await this.perceive(task, context);

      // Step 2: Generate reasoning
      const reasoning = await this.reason(perception);

      // Step 3: Plan actions
      const plan = await this.plan(reasoning);

      // Step 4: Execute actions
      const results = await this.act(plan);

      // Step 5: Reflect and learn
      await this.reflect(task, results);

      this.status = 'done';
      this.endTime = Date.now();

      return {
        success: true,
        agentId: this.id,
        agentName: this.name,
        results: results,
        duration: this.endTime - this.startTime,
        tokensUsed: this.currentTokens
      };
    } catch (error) {
      this.status = 'error';
      this.lastError = error.message;
      this.endTime = Date.now();

      logger.error(`Agent ${this.name} failed:`, error.message);

      return {
        success: false,
        agentId: this.id,
        agentName: this.name,
        error: error.message,
        duration: this.endTime - this.startTime
      };
    }
  }

  /**
   * Perceive and understand the task
   */
  async perceive(task, context) {
    return {
      task: task,
      context: context,
      timestamp: new Date().toISOString(),
      agentCapabilities: this.capabilities,
      memorySnapshot: this.memory.slice(-10) // Last 10 memories
    };
  }

  /**
   * Reasoning: analyze the situation
   */
  async reason(perception) {
    const reasoning = {
      taskAnalysis: this.analyzeTask(perception.task),
      relevantCapabilities: this.selectCapabilities(perception.task),
      availableTools: Array.from(this.tools.keys()),
      requiredSteps: this.identifySteps(perception.task),
      estimatedTokens: 0
    };

    // Estimate tokens needed
    reasoning.estimatedTokens = this.estimateTokens(reasoning);

    return reasoning;
  }

  /**
   * Plan: decide on actions
   */
  async plan(reasoning) {
    const plan = {
      actionSequence: [],
      priority: [],
      contingencies: [],
      estimatedTime: 0
    };

    // Convert reasoning into executable steps
    reasoning.requiredSteps.forEach((step, idx) => {
      plan.actionSequence.push({
        step: idx + 1,
        action: step,
        tool: this.selectTool(step),
        dependencies: idx > 0 ? [idx - 1] : [],
        status: 'pending'
      });
    });

    return plan;
  }

  /**
   * Act: execute the plan
   */
  async act(plan) {
    const results = [];
    let iteration = 0;

    for (const actionStep of plan.actionSequence) {
      if (iteration++ > this.maxIterations) {
        throw new Error('Max iterations exceeded');
      }

      if (this.currentTokens > this.tokenLimit * 0.9) {
        throw new Error('Token limit approaching');
      }

      try {
        actionStep.status = 'executing';

        // Execute tool if available
        let result;
        if (actionStep.tool && this.tools.has(actionStep.tool)) {
          result = await this.executeTool(actionStep.tool, actionStep.action);
        } else {
          result = await this.executeAction(actionStep.action);
        }

        actionStep.status = 'completed';
        actionStep.result = result;
        results.push(result);

        this.currentTokens += this.estimateActionTokens(actionStep);

      } catch (error) {
        actionStep.status = 'failed';
        actionStep.error = error.message;
        logger.warn(`Action ${actionStep.step} failed: ${error.message}`);

        // Try contingency if available
        if (actionStep.contingencies?.length > 0) {
          results.push(await this.executeContingency(actionStep.contingencies[0]));
        }
      }
    }

    return results;
  }

  /**
   * Reflect: learn from outcomes
   */
  async reflect(task, results) {
    const reflection = {
      taskId: uuidv4(),
      task: task,
      resultsSummary: this.summarizeResults(results),
      lessons: this.extractLessons(results),
      successMetrics: this.computeSuccessMetrics(results),
      timestamp: new Date().toISOString()
    };

    // Store in memory
    this.memory.push(reflection);

    // Save to database
    try {
      await db.run(
        `INSERT INTO agent_memory (agent_id, memory_type, content, timestamp)
         VALUES (?, ?, ?, ?)`,
        [this.id, 'reflection', JSON.stringify(reflection), new Date().toISOString()]
      );
    } catch (error) {
      logger.warn('Failed to persist reflection:', error.message);
    }

    return reflection;
  }

  /**
   * Register a tool this agent can use
   */
  registerTool(toolName, toolFunction) {
    this.tools.set(toolName, toolFunction);
    return this;
  }

  /**
   * Execute a registered tool
   */
  async executeTool(toolName, params) {
    if (!this.tools.has(toolName)) {
      throw new Error(`Tool ${toolName} not registered`);
    }

    const tool = this.tools.get(toolName);
    return await tool(params);
  }

  /**
   * Execute a generic action
   */
  async executeAction(action) {
    // Override in subclasses
    return { action, status: 'executed' };
  }

  /**
   * Execute contingency plan
   */
  async executeContingency(contingency) {
    logger.info(`Executing contingency: ${contingency}`);
    return { contingency, status: 'executed' };
  }

  /**
   * Helper: Analyze task
   */
  analyzeTask(task) {
    return {
      description: task,
      complexity: task.length > 100 ? 'high' : 'medium',
      keywords: this.extractKeywords(task)
    };
  }

  /**
   * Helper: Select capabilities
   */
  selectCapabilities(task) {
    return this.capabilities.filter(cap =>
      task.toLowerCase().includes(cap.toLowerCase())
    );
  }

  /**
   * Helper: Select tool for action
   */
  selectTool(action) {
    // Match action to tool
    for (const [toolName] of this.tools) {
      if (action.toLowerCase().includes(toolName.toLowerCase())) {
        return toolName;
      }
    }
    return null;
  }

  /**
   * Helper: Identify required steps
   */
  identifySteps(task) {
    // Break task into steps
    if (task.includes('and')) {
      return task.split('and').map(s => s.trim());
    }
    return [task];
  }

  /**
   * Helper: Extract keywords
   */
  extractKeywords(text) {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 10);
  }

  /**
   * Helper: Estimate tokens for action
   */
  estimateActionTokens(action) {
    // Rough estimate: 1 token per 4 characters
    const content = JSON.stringify(action);
    return Math.ceil(content.length / 4);
  }

  /**
   * Helper: Estimate total tokens
   */
  estimateTokens(reasoning) {
    return reasoning.requiredSteps.length * 100 + reasoning.availableTools.length * 50;
  }

  /**
   * Helper: Summarize results
   */
  summarizeResults(results) {
    return {
      totalActions: results.length,
      successCount: results.filter(r => r.status === 'completed').length,
      failureCount: results.filter(r => r.status === 'failed').length,
      summary: results.map(r => r.status || 'unknown').join(', ')
    };
  }

  /**
   * Helper: Extract lessons
   */
  extractLessons(results) {
    const lessons = [];
    results.forEach((result, idx) => {
      if (result.status === 'failed') {
        lessons.push(`Step ${idx + 1} failed: ${result.error}`);
      }
    });
    return lessons;
  }

  /**
   * Helper: Compute success metrics
   */
  computeSuccessMetrics(results) {
    const completed = results.filter(r => r.status === 'completed').length;
    const total = results.length;
    return {
      completionRate: total > 0 ? (completed / total * 100).toFixed(1) + '%' : '0%',
      successCount: completed,
      totalCount: total
    };
  }

  /**
   * Get agent state
   */
  getState() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      memorySize: this.memory.length,
      registeredTools: Array.from(this.tools.keys()),
      capabilities: this.capabilities,
      lastError: this.lastError,
      uptime: this.startTime ? Date.now() - this.startTime : 0
    };
  }
}

/**
 * Agent Manager - Manages multiple agents
 */
export class AgentManager {
  constructor() {
    this.agents = new Map();
    this.runHistory = [];
  }

  /**
   * Register an agent
   */
  registerAgent(agent) {
    this.agents.set(agent.id, agent);
    logger.info(`Agent registered: ${agent.name} (${agent.id})`);
    return agent.id;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get agent by name
   */
  getAgentByName(name) {
    for (const agent of this.agents.values()) {
      if (agent.name === name) return agent;
    }
    return null;
  }

  /**
   * Execute agent task
   */
  async executeAgent(agentId, task, context = {}) {
    const agent = this.getAgent(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    const result = await agent.execute(task, context);
    this.runHistory.push(result);

    return result;
  }

  /**
   * List all agents
   */
  listAgents() {
    return Array.from(this.agents.values()).map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      status: agent.status
    }));
  }

  /**
   * Get execution history
   */
  getHistory(limit = 50) {
    return this.runHistory.slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.runHistory = [];
  }

  /**
   * Get statistics
   */
  getStats() {
    const successful = this.runHistory.filter(r => r.success).length;
    const failed = this.runHistory.filter(r => !r.success).length;
    const avgDuration = this.runHistory.length > 0
      ? this.runHistory.reduce((sum, r) => sum + (r.duration || 0), 0) / this.runHistory.length
      : 0;

    return {
      totalAgents: this.agents.size,
      totalExecutions: this.runHistory.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      successRate: this.runHistory.length > 0
        ? (successful / this.runHistory.length * 100).toFixed(1) + '%'
        : '0%',
      averageDuration: avgDuration.toFixed(0) + 'ms'
    };
  }
}

// Export singleton manager
export const agentManager = new AgentManager();
