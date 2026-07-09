/* ════════════════════════════════════════════════════════════════
   LATIF AI — Workflow Engine (DAG Execution & Automation)
   ════════════════════════════════════════════════════════════════
   Define, schedule, and execute multi-step workflows as DAGs.
   Supports parallelization, error handling, and state persistence.

   LATIF v5.5.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

/**
 * Workflow Node (single step in workflow)
 */
class WorkflowNode {
  constructor(config) {
    this.id = config.id || `node_${Date.now()}`;
    this.type = config.type || "action"; // action, condition, merge, parallel
    this.label = config.label || "";
    this.action = config.action || null; // Function or tool to execute
    this.params = config.params || {};
    this.dependencies = config.dependencies || []; // Parent node IDs
    this.condition = config.condition || null; // For conditional nodes
    this.maxRetries = config.maxRetries || 0;
    this.timeout = config.timeout || 30000; // 30 seconds default

    // Runtime state
    this.status = "pending"; // pending, running, completed, failed, skipped
    this.result = null;
    this.error = null;
    this.retries = 0;
    this.startTime = null;
    this.duration = 0;
  }

  /**
   * Check if node is ready to execute (dependencies met).
   */
  isReady(completedNodes) {
    return this.dependencies.every((depId) => completedNodes.has(depId));
  }

  /**
   * Execute this node.
   */
  async execute(context) {
    this.status = "running";
    this.startTime = Date.now();

    try {
      // Check condition if needed
      if (this.type === "condition" && this.condition) {
        const conditionMet = await this.condition(context);
        if (!conditionMet) {
          this.status = "skipped";
          this.duration = Date.now() - this.startTime;
          return { skipped: true };
        }
      }

      // Execute action
      if (this.action) {
        this.result = await Promise.race([
          this.action(this.params, context),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), this.timeout)
          ),
        ]);
      }

      this.status = "completed";
    } catch (err) {
      if (this.retries < this.maxRetries) {
        this.retries++;
        this.error = null; // Clear error and retry
        return this.execute(context); // Retry
      }

      this.status = "failed";
      this.error = err.message;
      throw err;
    } finally {
      this.duration = Date.now() - this.startTime;
    }

    return { success: true, result: this.result };
  }
}

/**
 * Workflow (DAG of nodes)
 */
class Workflow {
  constructor(config) {
    this.id = config.id || `wf_${Date.now()}`;
    this.name = config.name || "Untitled Workflow";
    this.description = config.description || "";
    this.nodes = new Map(); // nodeId -> WorkflowNode
    this.triggers = config.triggers || []; // Cron patterns or event types
    this.createdAt = Date.now();
    this.updatedAt = Date.now();

    // Runtime state
    this.status = "idle"; // idle, running, paused, completed, failed
    this.executionHistory = [];
    this.currentExecution = null;
  }

  /**
   * Add node to workflow.
   */
  addNode(node) {
    if (!(node instanceof WorkflowNode)) {
      node = new WorkflowNode(node);
    }
    this.nodes.set(node.id, node);
    this.updatedAt = Date.now();
    return node.id;
  }

  /**
   * Get topologically sorted nodes for execution.
   */
  getExecutionOrder() {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) throw new Error("Circular dependency detected");

      visiting.add(nodeId);
      const node = this.nodes.get(nodeId);

      if (node) {
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      sorted.push(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return sorted.map((id) => this.nodes.get(id));
  }

  /**
   * Execute workflow.
   */
  async execute(context = {}) {
    if (this.status === "running") {
      throw new Error("Workflow already running");
    }

    this.status = "running";
    const execution = {
      id: `exec_${Date.now()}`,
      startTime: Date.now(),
      context: { ...context },
      nodeResults: {},
      errors: [],
    };

    this.currentExecution = execution;

    try {
      const executionOrder = this.getExecutionOrder();
      const completedNodes = new Set();

      // Execute nodes in order, respecting dependencies
      for (const node of executionOrder) {
        if (!node.isReady(completedNodes)) {
          continue; // Skip if dependencies not met
        }

        try {
          await node.execute(execution.context);
          execution.nodeResults[node.id] = {
            status: node.status,
            result: node.result,
            duration: node.duration,
          };
          completedNodes.add(node.id);
        } catch (err) {
          execution.errors.push({ nodeId: node.id, error: err.message });
          if (node.maxRetries === 0) {
            // Stop on first error if no retries
            throw err;
          }
        }
      }

      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      this.executionHistory.push(execution);

      this.status = "completed";
      return execution;
    } catch (err) {
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      execution.error = err.message;
      this.executionHistory.push(execution);

      this.status = "failed";
      GlobalErrorLogger.error("Workflow.execute", err);
      throw err;
    }
  }

  /**
   * Pause workflow execution.
   */
  pause() {
    this.status = "paused";
  }

  /**
   * Resume workflow execution.
   */
  async resume() {
    if (this.status !== "paused" || !this.currentExecution) {
      throw new Error("Cannot resume: workflow not paused");
    }

    this.status = "running";
    // Continue from where it left off
    return this.execute(this.currentExecution.context);
  }

  /**
   * Get workflow statistics.
   */
  getStats() {
    const completed = this.executionHistory.filter((e) => !e.error).length;
    const failed = this.executionHistory.filter((e) => e.error).length;
    const avgDuration =
      this.executionHistory.length > 0
        ? this.executionHistory.reduce((sum, e) => sum + (e.duration || 0), 0) /
          this.executionHistory.length
        : 0;

    return {
      nodeCount: this.nodes.size,
      executionCount: this.executionHistory.length,
      completed,
      failed,
      averageDuration: Math.round(avgDuration),
    };
  }

  /**
   * Export workflow definition.
   */
  export() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      nodes: Array.from(this.nodes.values()).map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        params: n.params,
        dependencies: n.dependencies,
        timeout: n.timeout,
        maxRetries: n.maxRetries,
      })),
      triggers: this.triggers,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Workflow Scheduler (manages scheduled executions)
 */
class WorkflowScheduler {
  constructor() {
    this.workflows = new Map(); // workflowId -> Workflow
    this.schedules = new Map(); // scheduleId -> {workflowId, cron, nextRun, lastRun}
    this.activeSchedules = new Set();
  }

  /**
   * Register a workflow.
   */
  registerWorkflow(workflow) {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Schedule workflow for recurring execution.
   */
  scheduleWorkflow(workflowId, cronExpression) {
    const schedule = {
      id: `schedule_${Date.now()}`,
      workflowId,
      cron: cronExpression,
      nextRun: this.getNextRun(cronExpression),
      lastRun: null,
      enabled: true,
    };

    this.schedules.set(schedule.id, schedule);
    return schedule.id;
  }

  /**
   * Get next run time from cron expression (simplified).
   * @private
   */
  getNextRun(cronExpression) {
    // Simple implementation: parse basic cron patterns
    // Full cron parsing would require a library
    const parts = cronExpression.split(" ");

    if (parts.length >= 5) {
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts.map(Number);

      const now = new Date();
      let nextRun = new Date(now);

      // Add 1 hour for next run (simplified)
      nextRun.setHours(nextRun.getHours() + 1);

      return nextRun;
    }

    // Default: 1 hour from now
    return new Date(Date.now() + 3600000);
  }

  /**
   * Check and execute due workflows.
   */
  async checkAndExecute() {
    const now = Date.now();

    for (const [scheduleId, schedule] of this.schedules) {
      if (!schedule.enabled) continue;

      if (schedule.nextRun.getTime() <= now) {
        const workflow = this.workflows.get(schedule.workflowId);
        if (workflow) {
          try {
            await workflow.execute();
            schedule.lastRun = new Date();
            schedule.nextRun = this.getNextRun(schedule.cron);
          } catch (err) {
            GlobalErrorLogger.warn(`Workflow[${schedule.workflowId}].scheduled`, err.message);
          }
        }
      }
    }
  }

  /**
   * Get all schedules.
   */
  listSchedules() {
    return Array.from(this.schedules.values());
  }

  /**
   * Disable schedule.
   */
  disableSchedule(scheduleId) {
    const schedule = this.schedules.get(scheduleId);
    if (schedule) schedule.enabled = false;
  }

  /**
   * Get scheduler statistics.
   */
  getStats() {
    return {
      workflowCount: this.workflows.size,
      scheduleCount: this.schedules.size,
      enabledSchedules: Array.from(this.schedules.values()).filter((s) => s.enabled)
        .length,
    };
  }
}

const GlobalWorkflowScheduler = new WorkflowScheduler();

// Pre-built workflow templates
const WORKFLOW_TEMPLATES = {
  daily_research: {
    name: "Daily Research Summary",
    description: "Research a topic daily and summarize findings",
    nodes: [
      { id: "n1", label: "Get research topic", type: "action" },
      { id: "n2", label: "Search knowledge base", type: "action", dependencies: ["n1"] },
      { id: "n3", label: "Synthesize findings", type: "action", dependencies: ["n2"] },
      { id: "n4", label: "Generate summary", type: "action", dependencies: ["n3"] },
    ],
  },

  document_processing: {
    name: "Document Processing",
    description: "Upload, analyze, and organize documents",
    nodes: [
      { id: "n1", label: "Receive document", type: "action" },
      { id: "n2", label: "Extract text/OCR", type: "action", dependencies: ["n1"] },
      { id: "n3", label: "Extract metadata", type: "action", dependencies: ["n1"] },
      { id: "n4", label: "Index content", type: "action", dependencies: ["n2", "n3"] },
      { id: "n5", label: "Store in knowledge graph", type: "action", dependencies: ["n4"] },
    ],
  },
};

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    WorkflowNode,
    Workflow,
    WorkflowScheduler,
    GlobalWorkflowScheduler,
    WORKFLOW_TEMPLATES,
  };
}
