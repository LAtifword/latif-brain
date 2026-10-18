/**
 * Workflow DSL - Define workflows as DAGs with nodes, edges, and conditions
 * Phase 6: Workflow definition, validation, and serialization
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Workflow Node - Represents a single task in a workflow
 */
export class WorkflowNode {
  constructor(id, type, config = {}) {
    this.id = id;
    this.type = type; // 'task' | 'condition' | 'parallel' | 'loop' | 'webhook'
    this.config = config; // Tool/agent to execute
    this.inputs = config.inputs || {}; // Input parameter mappings
    this.outputs = config.outputs || {}; // Output parameter mappings
    this.retryPolicy = config.retryPolicy || { maxRetries: 0, backoffMs: 1000 };
    this.timeout = config.timeout || 30000; // 30 seconds default
    this.description = config.description || '';
  }

  /**
   * Validate node configuration
   */
  validate() {
    if (!this.id || typeof this.id !== 'string') {
      throw new Error('Node must have a valid id');
    }
    if (!this.type) {
      throw new Error(`Node ${this.id}: type is required`);
    }
    return true;
  }

  /**
   * Get node as plain object
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      config: this.config,
      inputs: this.inputs,
      outputs: this.outputs,
      retryPolicy: this.retryPolicy,
      timeout: this.timeout,
      description: this.description
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data) {
    const node = new WorkflowNode(data.id, data.type, data.config);
    node.inputs = data.inputs || {};
    node.outputs = data.outputs || {};
    node.retryPolicy = data.retryPolicy || { maxRetries: 0, backoffMs: 1000 };
    node.timeout = data.timeout || 30000;
    node.description = data.description || '';
    return node;
  }
}

/**
 * Workflow Edge - Connection between nodes with optional conditions
 */
export class WorkflowEdge {
  constructor(source, target, condition = null) {
    this.source = source; // Source node id
    this.target = target; // Target node id
    this.condition = condition; // Optional: JS expression or function
    this.label = condition ? `[${condition}]` : '';
  }

  /**
   * Evaluate edge condition given context
   */
  evaluate(context = {}) {
    if (!this.condition) return true; // No condition = always true

    // Evaluate as JS expression
    if (typeof this.condition === 'string') {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('ctx', `return ${this.condition}`);
        return fn(context);
      } catch (err) {
        logger.warn('Edge condition evaluation failed', {
          source: this.source,
          target: this.target,
          condition: this.condition,
          error: err.message
        });
        return false;
      }
    }

    // Evaluate as function
    if (typeof this.condition === 'function') {
      return this.condition(context);
    }

    return true;
  }

  /**
   * Get edge as plain object
   */
  toJSON() {
    return {
      source: this.source,
      target: this.target,
      condition: typeof this.condition === 'function' ? null : this.condition,
      label: this.label
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data) {
    return new WorkflowEdge(data.source, data.target, data.condition);
  }
}

/**
 * Workflow - DAG-based workflow definition
 */
export class Workflow {
  constructor(id, name, description = '') {
    this.id = id;
    this.name = name;
    this.description = description;
    this.nodes = new Map(); // id -> WorkflowNode
    this.edges = []; // [WorkflowEdge, ...]
    this.startNodeId = null; // Entry point
    this.endNodeId = null; // Exit point
    this.version = '1.0.0';
    this.tags = [];
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.variables = {}; // Global workflow variables
  }

  /**
   * Add a node to workflow
   */
  addNode(node) {
    if (!(node instanceof WorkflowNode)) {
      throw new Error('Must add WorkflowNode instance');
    }
    node.validate();
    this.nodes.set(node.id, node);
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Add an edge between nodes
   */
  addEdge(source, target, condition = null) {
    // Validate nodes exist
    if (!this.nodes.has(source)) {
      throw new Error(`Source node ${source} not found`);
    }
    if (!this.nodes.has(target)) {
      throw new Error(`Target node ${target} not found`);
    }

    // Check for duplicate edges
    const duplicate = this.edges.find(e => e.source === source && e.target === target);
    if (duplicate) {
      throw new Error(`Edge ${source} -> ${target} already exists`);
    }

    this.edges.push(new WorkflowEdge(source, target, condition));
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Set workflow start node
   */
  setStartNode(nodeId) {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Start node ${nodeId} not found`);
    }
    this.startNodeId = nodeId;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Set workflow end node
   */
  setEndNode(nodeId) {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`End node ${nodeId} not found`);
    }
    this.endNodeId = nodeId;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Validate workflow structure
   */
  validate() {
    if (!this.startNodeId) {
      throw new Error('Workflow must have a start node');
    }
    if (!this.endNodeId) {
      throw new Error('Workflow must have an end node');
    }
    if (!this.nodes.has(this.startNodeId)) {
      throw new Error(`Start node ${this.startNodeId} not found`);
    }
    if (!this.nodes.has(this.endNodeId)) {
      throw new Error(`End node ${this.endNodeId} not found`);
    }

    // Validate no orphaned nodes
    const connected = new Set();
    connected.add(this.startNodeId);
    const visited = new Set();
    const queue = [this.startNodeId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);

      // Find outgoing edges
      this.edges
        .filter(e => e.source === current)
        .forEach(e => {
          connected.add(e.target);
          if (!visited.has(e.target)) {
            queue.push(e.target);
          }
        });
    }

    // Check all nodes are reachable
    for (const nodeId of this.nodes.keys()) {
      if (!connected.has(nodeId)) {
        logger.warn('Unreachable node in workflow', { workflowId: this.id, nodeId });
      }
    }

    logger.info('Workflow validation complete', {
      workflowId: this.id,
      nodes: this.nodes.size,
      edges: this.edges.length,
      connected: connected.size
    });

    return true;
  }

  /**
   * Get next nodes from a given node
   */
  getNextNodes(nodeId, context = {}) {
    const outgoing = this.edges.filter(e => e.source === nodeId);
    const nextNodes = [];

    outgoing.forEach(edge => {
      if (edge.evaluate(context)) {
        nextNodes.push({
          nodeId: edge.target,
          node: this.nodes.get(edge.target),
          condition: edge.condition
        });
      }
    });

    return nextNodes;
  }

  /**
   * Get previous nodes (predecessors)
   */
  getPreviousNodes(nodeId) {
    const incoming = this.edges.filter(e => e.target === nodeId);
    return incoming.map(edge => ({
      nodeId: edge.source,
      node: this.nodes.get(edge.source)
    }));
  }

  /**
   * Export workflow as JSON
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version: this.version,
      tags: this.tags,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      variables: this.variables,
      startNodeId: this.startNodeId,
      endNodeId: this.endNodeId,
      nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
      edges: this.edges.map(e => e.toJSON())
    };
  }

  /**
   * Import workflow from JSON
   */
  static fromJSON(data) {
    const workflow = new Workflow(data.id, data.name, data.description);
    workflow.version = data.version || '1.0.0';
    workflow.tags = data.tags || [];
    workflow.createdAt = data.createdAt || new Date().toISOString();
    workflow.updatedAt = data.updatedAt || new Date().toISOString();
    workflow.variables = data.variables || {};
    workflow.startNodeId = data.startNodeId;
    workflow.endNodeId = data.endNodeId;

    // Restore nodes
    if (data.nodes && Array.isArray(data.nodes)) {
      data.nodes.forEach(nodeData => {
        workflow.nodes.set(nodeData.id, WorkflowNode.fromJSON(nodeData));
      });
    }

    // Restore edges
    if (data.edges && Array.isArray(data.edges)) {
      workflow.edges = data.edges.map(edgeData => WorkflowEdge.fromJSON(edgeData));
    }

    return workflow;
  }

  /**
   * Clone workflow
   */
  clone() {
    return Workflow.fromJSON(this.toJSON());
  }

  /**
   * Get workflow statistics
   */
  getStats() {
    const nodeTypes = {};
    this.nodes.forEach(node => {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    });

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      nodeTypes: nodeTypes,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Workflow Builder - Fluent API for creating workflows
 */
export class WorkflowBuilder {
  constructor(id, name) {
    this.workflow = new Workflow(id, name);
  }

  /**
   * Add task node
   */
  addTask(id, tool, inputs = {}, config = {}) {
    const node = new WorkflowNode(id, 'task', {
      tool: tool,
      inputs: inputs,
      ...config
    });
    this.workflow.addNode(node);
    return this;
  }

  /**
   * Add condition node
   */
  addCondition(id, expression, config = {}) {
    const node = new WorkflowNode(id, 'condition', {
      expression: expression,
      ...config
    });
    this.workflow.addNode(node);
    return this;
  }

  /**
   * Add parallel execution node
   */
  addParallel(id, nodeIds, config = {}) {
    const node = new WorkflowNode(id, 'parallel', {
      nodeIds: nodeIds,
      ...config
    });
    this.workflow.addNode(node);
    return this;
  }

  /**
   * Connect nodes
   */
  connect(source, target, condition = null) {
    this.workflow.addEdge(source, target, condition);
    return this;
  }

  /**
   * Set start node
   */
  start(nodeId) {
    this.workflow.setStartNode(nodeId);
    return this;
  }

  /**
   * Set end node
   */
  end(nodeId) {
    this.workflow.setEndNode(nodeId);
    return this;
  }

  /**
   * Add tags
   */
  tags(...tags) {
    this.workflow.tags = tags;
    return this;
  }

  /**
   * Add description
   */
  description(desc) {
    this.workflow.description = desc;
    return this;
  }

  /**
   * Build workflow
   */
  build() {
    this.workflow.validate();
    return this.workflow;
  }
}
