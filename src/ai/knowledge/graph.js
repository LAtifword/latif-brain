/**
 * Knowledge Graph Implementation (Phase 4)
 * Stores entities, relationships, and enables semantic reasoning
 */

import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Knowledge Graph Node
 */
export class GraphNode {
  constructor(id, label, type, properties = {}) {
    this.id = id || uuidv4();
    this.label = label;
    this.type = type; // entity, concept, event, etc.
    this.properties = properties;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.metadata = {
      confidence: 1.0,
      source: 'unknown',
      mentions: 0
    };
  }

  static fromEntity(entity) {
    return new GraphNode(
      uuidv4(),
      entity.name,
      entity.type || 'entity',
      entity
    );
  }
}

/**
 * Knowledge Graph Edge (Relationship)
 */
export class GraphEdge {
  constructor(sourceId, targetId, relationshipType, properties = {}) {
    this.id = uuidv4();
    this.sourceId = sourceId;
    this.targetId = targetId;
    this.relationshipType = relationshipType; // knows, works-for, located-in, etc.
    this.properties = properties;
    this.createdAt = new Date().toISOString();
    this.weight = properties.weight || 1.0; // Relationship strength
    this.confidence = properties.confidence || 1.0;
  }
}

/**
 * Knowledge Graph - Triple store implementation
 */
export class KnowledgeGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.nodeIndex = new Map(); // Label -> NodeId for fast lookup
    this.relationshipIndex = new Map(); // Type -> [edges]
  }

  /**
   * Create or get node
   */
  createNode(label, type = 'entity', properties = {}) {
    // Check if node already exists
    if (this.nodeIndex.has(label.toLowerCase())) {
      return this.nodes.get(this.nodeIndex.get(label.toLowerCase()));
    }

    // Create new node
    const node = new GraphNode(uuidv4(), label, type, properties);
    this.nodes.set(node.id, node);
    this.nodeIndex.set(label.toLowerCase(), node.id);

    return node;
  }

  /**
   * Create relationship
   */
  createEdge(sourceNodeOrId, targetNodeOrId, relationshipType, properties = {}) {
    const sourceId = typeof sourceNodeOrId === 'string'
      ? sourceNodeOrId
      : sourceNodeOrId.id;

    const targetId = typeof targetNodeOrId === 'string'
      ? targetNodeOrId
      : targetNodeOrId.id;

    const edge = new GraphEdge(sourceId, targetId, relationshipType, properties);
    this.edges.set(edge.id, edge);

    // Update relationship index
    if (!this.relationshipIndex.has(relationshipType)) {
      this.relationshipIndex.set(relationshipType, []);
    }
    this.relationshipIndex.get(relationshipType).push(edge);

    return edge;
  }

  /**
   * Find node by label
   */
  findNode(label) {
    const nodeId = this.nodeIndex.get(label.toLowerCase());
    return nodeId ? this.nodes.get(nodeId) : null;
  }

  /**
   * Find edges between nodes
   */
  findEdges(sourceId, targetId, relationshipType = null) {
    const results = [];
    this.edges.forEach(edge => {
      if (edge.sourceId === sourceId && edge.targetId === targetId) {
        if (!relationshipType || edge.relationshipType === relationshipType) {
          results.push(edge);
        }
      }
    });
    return results;
  }

  /**
   * Get all connections to a node
   */
  getNodeConnections(nodeId) {
    const incoming = [];
    const outgoing = [];

    this.edges.forEach(edge => {
      if (edge.sourceId === nodeId) {
        outgoing.push({
          edge: edge,
          target: this.nodes.get(edge.targetId)
        });
      }
      if (edge.targetId === nodeId) {
        incoming.push({
          edge: edge,
          source: this.nodes.get(edge.sourceId)
        });
      }
    });

    return { incoming, outgoing, total: incoming.length + outgoing.length };
  }

  /**
   * Find shortest path between two nodes
   */
  findPath(sourceId, targetId, maxDepth = 5) {
    const visited = new Set();
    const path = [];

    const dfs = (nodeId, depth) => {
      if (depth > maxDepth || visited.has(nodeId)) return false;
      visited.add(nodeId);
      path.push(nodeId);

      if (nodeId === targetId) return true;

      // Follow outgoing edges
      for (const [, edge] of this.edges) {
        if (edge.sourceId === nodeId && !visited.has(edge.targetId)) {
          if (dfs(edge.targetId, depth + 1)) return true;
        }
      }

      path.pop();
      return false;
    };

    if (dfs(sourceId, 0)) {
      return path.map(nodeId => ({
        node: this.nodes.get(nodeId),
        id: nodeId
      }));
    }

    return null;
  }

  /**
   * Extract entities from text
   */
  extractEntities(text) {
    // Simple extraction: look for capitalized words
    const entities = [];
    const words = text.split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[.,!?;:]/g, '');

      if (word[0] === word[0].toUpperCase() && word.length > 2) {
        // Check for multi-word entities
        const nextWord = i + 1 < words.length ? words[i + 1] : '';
        if (nextWord && nextWord[0] === nextWord[0].toUpperCase()) {
          entities.push(`${word} ${nextWord}`.toLowerCase());
          i++; // Skip next word
        } else {
          entities.push(word.toLowerCase());
        }
      }
    }

    return [...new Set(entities)]; // Deduplicate
  }

  /**
   * Extract relationships from text
   */
  extractRelationships(text) {
    // Simple pattern matching
    const relationships = [];
    const patterns = [
      { pattern: /(\w+)\s+knows\s+(\w+)/gi, type: 'knows' },
      { pattern: /(\w+)\s+works\s+(?:for|at)\s+(\w+)/gi, type: 'works-for' },
      { pattern: /(\w+)\s+located\s+(?:in|at)\s+(\w+)/gi, type: 'located-in' },
      { pattern: /(\w+)\s+is\s+(?:a|an)\s+(\w+)/gi, type: 'is-a' },
      { pattern: /(\w+)\s+has\s+(\w+)/gi, type: 'has' }
    ];

    patterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        relationships.push({
          source: match[1].toLowerCase(),
          target: match[2].toLowerCase(),
          type: type
        });
      }
    });

    return relationships;
  }

  /**
   * Build graph from text
   */
  async buildFromText(text) {
    const entities = this.extractEntities(text);
    const relationships = this.extractRelationships(text);

    // Create nodes for entities
    const nodeMap = new Map();
    entities.forEach(entity => {
      const node = this.createNode(entity);
      nodeMap.set(entity, node.id);
    });

    // Create edges for relationships
    relationships.forEach(rel => {
      const sourceId = nodeMap.get(rel.source);
      const targetId = nodeMap.get(rel.target);

      if (sourceId && targetId) {
        this.createEdge(sourceId, targetId, rel.type, { source: 'text-extraction' });
      }
    });

    return {
      nodesCreated: entities.length,
      edgesCreated: relationships.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get node influence score (how important is this node)
   */
  getNodeInfluence(nodeId) {
    let score = 0;
    let incomingCount = 0;
    let outgoingCount = 0;

    this.edges.forEach(edge => {
      if (edge.sourceId === nodeId) {
        outgoingCount++;
        score += edge.weight;
      }
      if (edge.targetId === nodeId) {
        incomingCount++;
        score += edge.weight;
      }
    });

    // PageRank-like scoring
    return {
      score: score,
      inDegree: incomingCount,
      outDegree: outgoingCount,
      pageRank: (incomingCount + outgoingCount) * score / Math.max(this.nodes.size, 1)
    };
  }

  /**
   * Find related nodes
   */
  findRelated(nodeId, depth = 2) {
    const related = new Set();
    const visited = new Set();

    const traverse = (currentId, currentDepth) => {
      if (currentDepth > depth || visited.has(currentId)) return;
      visited.add(currentId);

      this.edges.forEach(edge => {
        if (edge.sourceId === currentId && !visited.has(edge.targetId)) {
          related.add(edge.targetId);
          traverse(edge.targetId, currentDepth + 1);
        }
        if (edge.targetId === currentId && !visited.has(edge.sourceId)) {
          related.add(edge.sourceId);
          traverse(edge.sourceId, currentDepth + 1);
        }
      });
    };

    traverse(nodeId, 0);
    related.delete(nodeId); // Don't include self

    return Array.from(related).map(id => ({
      node: this.nodes.get(id),
      influence: this.getNodeInfluence(id)
    }));
  }

  /**
   * Query graph using simple pattern
   */
  query(queryPattern) {
    // Simple pattern: "MATCH (a) --[type]--> (b)"
    const results = [];

    this.edges.forEach(edge => {
      if (!queryPattern.relationshipType || edge.relationshipType === queryPattern.relationshipType) {
        results.push({
          source: this.nodes.get(edge.sourceId),
          relationship: edge.relationshipType,
          target: this.nodes.get(edge.targetId)
        });
      }
    });

    return results;
  }

  /**
   * Merge duplicate nodes
   */
  mergeNodes(nodeId1, nodeId2) {
    const node1 = this.nodes.get(nodeId1);
    const node2 = this.nodes.get(nodeId2);

    if (!node1 || !node2) return false;

    // Redirect all edges from node2 to node1
    this.edges.forEach((edge, _edgeId) => {
      if (edge.sourceId === nodeId2) edge.sourceId = nodeId1;
      if (edge.targetId === nodeId2) edge.targetId = nodeId1;
    });

    // Remove node2
    this.nodes.delete(nodeId2);
    this.nodeIndex.delete(node2.label.toLowerCase());

    logger.info(`Merged nodes ${node2.label} into ${node1.label}`);
    return true;
  }

  /**
   * Remove node and its edges
   */
  deleteNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Remove all edges connected to this node
    const edgesToRemove = [];
    this.edges.forEach((edge, edgeId) => {
      if (edge.sourceId === nodeId || edge.targetId === nodeId) {
        edgesToRemove.push(edgeId);
      }
    });

    edgesToRemove.forEach(edgeId => this.edges.delete(edgeId));

    // Remove node
    this.nodes.delete(nodeId);
    this.nodeIndex.delete(node.label.toLowerCase());

    return true;
  }

  /**
   * Get graph statistics
   */
  getStats() {
    const relationshipTypeCounts = new Map();
    this.edges.forEach(edge => {
      const count = relationshipTypeCounts.get(edge.relationshipType) || 0;
      relationshipTypeCounts.set(edge.relationshipType, count + 1);
    });

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      relationshipTypes: Object.fromEntries(relationshipTypeCounts),
      avgDegree: this.edges.size > 0 ? (this.edges.size * 2) / this.nodes.size : 0,
      density: this.nodes.size > 1
        ? (this.edges.size * 2) / (this.nodes.size * (this.nodes.size - 1))
        : 0
    };
  }

  /**
   * Export graph
   */
  export() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      stats: this.getStats(),
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton
export const knowledgeGraph = new KnowledgeGraph();
