/* ════════════════════════════════════════════════════════════════
   LATIF AI — Agent Framework (Multi-Agent Orchestration)
   ════════════════════════════════════════════════════════════════
   Base framework for autonomous agents that can collaborate,
   reason, use tools, and persist memories.

   LATIF v5.2.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class Agent {
  constructor(config = {}) {
    // Agent identity
    this.id = config.id || "agent_" + Math.random().toString(36).substring(7);
    this.name = config.name || "Agent";
    this.role = config.role || "assistant"; // assistant, planner, researcher, executor, critic
    this.description = config.description || "";

    // Agent state
    this.state = {
      status: "idle", // idle, thinking, acting, waiting
      contextWindow: [],
      memory: [],
      taskQueue: [],
      executedActions: [],
    };

    // Agent capabilities
    this.tools = config.tools || [];
    this.maxIterations = config.maxIterations || 10;
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 0.7;
    this.systemPrompt = config.systemPrompt || `You are ${this.name}, an AI agent. Your role is: ${this.description}`;

    // Message routing
    this.messageHandlers = new Map();
    this.broadcastListeners = [];
  }

  /**
   * Initialize agent (load memory, setup hooks).
   * @returns {Promise<void>}
   */
  async init() {
    try {
      if (typeof GlobalDataLayer !== "undefined") {
        const memories = await GlobalDataLayer.getAllMemories();
        this.state.memory = memories.filter((m) => m.agentId === this.id) || [];
      }
    } catch (err) {
      GlobalErrorLogger.warn(`Agent[${this.name}].init`, `Failed to load memories: ${err.message}`);
    }
  }

  /**
   * Process a message/task.
   * @param {Object} message - {task, context, priority}
   * @returns {Promise<Object>} Response object
   */
  async processMessage(message) {
    try {
      this.state.status = "thinking";

      // Add to context window
      this.state.contextWindow.push(message);
      if (this.state.contextWindow.length > 20) {
        this.state.contextWindow.shift(); // Keep last 20 messages
      }

      // Generate response/action
      const result = await this.reason(message);

      // Record action
      this.state.executedActions.push({
        timestamp: Date.now(),
        message,
        result,
      });

      this.state.status = "idle";
      return result;
    } catch (err) {
      GlobalErrorLogger.error(`Agent[${this.name}].processMessage`, err);
      this.state.status = "idle";
      return { error: err.message };
    }
  }

  /**
   * Agent reasoning loop (can be overridden by subclasses).
   * @protected
   */
  async reason(message) {
    // Build context prompt
    const contextPrompt = this.buildContextPrompt(message);

    // Call AI model
    const response = await this.callModel(contextPrompt);

    // Parse action from response
    const action = this.parseAction(response);

    // Execute action if needed
    if (action && action.type === "tool_call") {
      const toolResult = await this.executeTool(action.tool, action.params);
      return {
        type: "response",
        content: response,
        action: action,
        toolResult: toolResult,
      };
    }

    return {
      type: "response",
      content: response,
    };
  }

  /**
   * Build context prompt for reasoning.
   * @protected
   */
  buildContextPrompt(message) {
    let prompt = this.systemPrompt + "\n\n";

    // Add recent context
    prompt += "Recent context:\n";
    for (const msg of this.state.contextWindow.slice(-5)) {
      prompt += `- ${msg.task || msg.content}\n`;
    }

    // Add memories
    if (this.state.memory.length > 0) {
      prompt += "\nRelevant memories:\n";
      for (const mem of this.state.memory.slice(-3)) {
        prompt += `- ${mem.text}\n`;
      }
    }

    // Add current task
    prompt += `\nCurrent task: ${message.task || message.content || ""}\n`;
    prompt += "What should you do?";

    return prompt;
  }

  /**
   * Call AI model for reasoning.
   * @protected
   */
  async callModel(prompt) {
    try {
      if (typeof fetch === "undefined") {
        return "Model call failed: fetch not available";
      }

      const response = await fetch(`${this.getBaseUrl()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: State.model || "qwen2.5:1.5b",
          messages: [{ role: "user", content: prompt }],
          stream: false,
          temperature: this.temperature,
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.message?.content || "";
    } catch (err) {
      GlobalErrorLogger.warn(`Agent[${this.name}].callModel`, err.message);
      return ""; // Return empty on error
    }
  }

  /**
   * Parse action from model response.
   * @protected
   */
  parseAction(response) {
    // Look for tool_call markers in response
    const toolMatch = response.match(/\[TOOL_CALL: (\w+)\s*\((.*?)\)\]/);
    if (toolMatch) {
      return {
        type: "tool_call",
        tool: toolMatch[1],
        params: this.parseParams(toolMatch[2]),
      };
    }

    return null;
  }

  /**
   * Parse parameter string from action.
   * @private
   */
  parseParams(paramStr) {
    const params = {};
    const pairs = paramStr.split(",");
    for (const pair of pairs) {
      const [key, value] = pair.split("=").map((s) => s.trim());
      if (key && value) {
        params[key] = value.replace(/^["']|["']$/g, "");
      }
    }
    return params;
  }

  /**
   * Execute a tool (can call external functions, APIs, etc).
   * @protected
   */
  async executeTool(toolName, params) {
    try {
      const tool = this.tools.find((t) => t.name === toolName);
      if (!tool) {
        return { error: `Tool ${toolName} not found` };
      }

      const result = await tool.execute(params);
      return result;
    } catch (err) {
      GlobalErrorLogger.warn(`Agent[${this.name}].executeTool[${toolName}]`, err.message);
      return { error: err.message };
    }
  }

  /**
   * Save a memory/fact.
   */
  async saveMemory(text) {
    try {
      if (typeof GlobalDataLayer !== "undefined") {
        const memId = await GlobalDataLayer.saveMemory(text);
        this.state.memory.push({
          id: memId,
          agentId: this.id,
          text,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      GlobalErrorLogger.warn(`Agent[${this.name}].saveMemory`, err.message);
    }
  }

  /**
   * Register handler for specific message types.
   */
  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
  }

  /**
   * Broadcast message to other agents.
   */
  broadcast(message) {
    for (const listener of this.broadcastListeners) {
      listener(message, this);
    }
  }

  /**
   * Get base URL for API calls.
   * @protected
   */
  getBaseUrl() {
    if (typeof State === "undefined") return "http://127.0.0.1:11434";
    return `http://${State.host || "127.0.0.1"}:${State.port || "11434"}`;
  }

  /**
   * Get agent state snapshot.
   */
  getState() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      status: this.state.status,
      contextSize: this.state.contextWindow.length,
      memorySize: this.state.memory.length,
      actionsExecuted: this.state.executedActions.length,
    };
  }

  /**
   * Reset agent state.
   */
  reset() {
    this.state.contextWindow = [];
    this.state.taskQueue = [];
    this.state.executedActions = [];
    this.state.status = "idle";
  }
}

// Agent Registry for managing multiple agents
class AgentRegistry {
  constructor() {
    this.agents = new Map(); // id -> Agent
    this.messageRouter = new Map(); // pattern -> [agentId]
  }

  /**
   * Register an agent.
   */
  register(agent) {
    this.agents.set(agent.id, agent);
    console.log(`✓ Registered agent: ${agent.name} (${agent.role})`);
  }

  /**
   * Get agent by ID or name.
   */
  getAgent(idOrName) {
    if (this.agents.has(idOrName)) {
      return this.agents.get(idOrName);
    }
    for (const agent of this.agents.values()) {
      if (agent.name === idOrName) {
        return agent;
      }
    }
    return null;
  }

  /**
   * List all agents.
   */
  listAgents() {
    return Array.from(this.agents.values()).map((a) => a.getState());
  }

  /**
   * Route message to appropriate agent(s).
   */
  async routeMessage(message) {
    // Simple routing: send to all agents, let them decide if relevant
    const responses = [];
    for (const agent of this.agents.values()) {
      const response = await agent.processMessage(message);
      responses.push({ agentId: agent.id, agentName: agent.name, response });
    }
    return responses;
  }

  /**
   * Clear all agents.
   */
  clear() {
    this.agents.clear();
  }

  /**
   * Get registry stats.
   */
  getStats() {
    return {
      agentCount: this.agents.size,
      agents: this.listAgents(),
    };
  }
}

const GlobalAgentRegistry = new AgentRegistry();

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { Agent, AgentRegistry, GlobalAgentRegistry };
}
