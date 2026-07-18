/* ════════════════════════════════════════════════════════════════
   LATIF AI — Knowledge Graph (Entity & Relationship Extraction)
   ════════════════════════════════════════════════════════════════
   Builds and maintains semantic knowledge graphs from conversations.
   Extracts entities, relationships, and enables graph queries.

   LATIF v5.3.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

class KnowledgeGraph {
  constructor() {
    // Graph storage
    this.nodes = new Map(); // entityId -> {type, name, properties, confidence, sources}
    this.edges = new Map(); // relationId -> {source, target, type, properties, confidence, sources}
    this.nodesByType = new Map(); // type -> Set<nodeId>
    this.nodeIndex = new Map(); // name -> nodeId (for fast lookup)

    // Extraction patterns
    this.entityPatterns = [
      { regex: /(?:person|people|user|who):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi, type: "person" },
      {
        regex: /(?:place|location|city|country):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        type: "location",
      },
      { regex: /(?:company|org|organization):\s*([A-Z][a-zA-Z\s&]+)/gi, type: "organization" },
      { regex: /(?:concept|idea|topic):\s*([a-z_]+(?:\s+[a-z_]+)*)/gi, type: "concept" },
    ];

    this.relationshipPatterns = [
      { regex: /([A-Z]\w+)\s+(?:knows|knows\s+of|met)\s+([A-Z]\w+)/gi, type: "knows" },
      { regex: /([A-Z]\w+)\s+(?:works\s+at|works\s+for|employed\s+at)\s+([A-Z]\w+)/gi, type: "works_at" },
      { regex: /([A-Z]\w+)\s+(?:located\s+in|from|lives\s+in)\s+([A-Z]\w+)/gi, type: "located_in" },
      { regex: /([A-Z]\w+)\s+(?:is\s+the|is\s+the\s+head|leads)\s+([A-Z]\w+)/gi, type: "leads" },
      { regex: /([a-z_]+)\s+(?:related\s+to|similar\s+to|associated\s+with)\s+([a-z_]+)/gi, type: "related_to" },
    ];

    // Deduplication thresholds
    this.mergeSimilarityThreshold = 0.8;
    this.mergeConfidenceThreshold = 0.7;
  }

  /**
   * Extract entities from text.
   * @param {string} text - Text to analyze
   * @returns {Array} [{name, type, confidence}]
   */
  extractEntities(text) {
    const entities = [];
    const seen = new Set();

    for (const pattern of this.entityPatterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const name = match[1].trim();
        if (!seen.has(name) && name.length > 1) {
          entities.push({
            name,
            type: pattern.type,
            confidence: 0.8,
            raw: match[0],
          });
          seen.add(name);
        }
      }
    }

    return entities;
  }

  /**
   * Extract relationships from text.
   * @param {string} text - Text to analyze
   * @returns {Array} [{source, target, type, confidence}]
   */
  extractRelationships(text) {
    const relationships = [];
    const seen = new Set();

    for (const pattern of this.relationshipPatterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const source = match[1].trim();
        const target = match[2].trim();
        const key = `${source}--${pattern.type}--${target}`;

        if (!seen.has(key) && source.length > 0 && target.length > 0) {
          relationships.push({
            source,
            target,
            type: pattern.type,
            confidence: 0.7,
            raw: match[0],
          });
          seen.add(key);
        }
      }
    }

    return relationships;
  }

  /**
   * Add entity to graph.
   * @param {string} name - Entity name
   * @param {string} type - Entity type (person, location, etc)
   * @param {Object} properties - Additional properties
   */
  addEntity(name, type, properties = {}) {
    // Check if entity already exists (by name similarity)
    let nodeId = this.nodeIndex.get(name.toLowerCase());

    if (!nodeId) {
      // New entity
      nodeId = `node_${this.nodes.size}`;
      const node = {
        id: nodeId,
        name,
        type,
        properties: { ...properties },
        confidence: 0.8,
        sources: [{ timestamp: Date.now() }],
      };

      this.nodes.set(nodeId, node);
      this.nodeIndex.set(name.toLowerCase(), nodeId);

      // Add to type index
      if (!this.nodesByType.has(type)) {
        this.nodesByType.set(type, new Set());
      }
      this.nodesByType.get(type).add(nodeId);
    }

    return nodeId;
  }

  /**
   * Add relationship to graph.
   * @param {string} sourceName - Source entity name
   * @param {string} targetName - Target entity name
   * @param {string} type - Relationship type
   */
  addRelationship(sourceName, targetName, type) {
    // Get or create nodes
    const sourceId = this.addEntity(sourceName, "unknown");
    const targetId = this.addEntity(targetName, "unknown");

    // Create or update edge
    const edgeKey = `${sourceId}--${type}--${targetId}`;
    const existingEdge = Array.from(this.edges.values()).find(
      (e) => e.source === sourceId && e.target === targetId && e.type === type
    );

    if (existingEdge) {
      // Increase confidence and add source
      existingEdge.confidence = Math.min(1, existingEdge.confidence + 0.1);
      existingEdge.sources.push({ timestamp: Date.now() });
    } else {
      // New relationship
      const edge = {
        id: `edge_${this.edges.size}`,
        source: sourceId,
        target: targetId,
        type,
        properties: {},
        confidence: 0.7,
        sources: [{ timestamp: Date.now() }],
      };

      this.edges.set(edge.id, edge);
    }
  }

  /**
   * Extract and integrate knowledge from text.
   * @param {string} text - Text to process
   */
  integrateText(text) {
    // Extract entities
    const entities = this.extractEntities(text);
    for (const entity of entities) {
      this.addEntity(entity.name, entity.type);
    }

    // Extract relationships
    const relationships = this.extractRelationships(text);
    for (const rel of relationships) {
      this.addRelationship(rel.source, rel.target, rel.type);
    }
  }

  /**
   * Find entities by type.
   * @param {string} type - Entity type to find
   * @returns {Array} Matching entities
   */
  findEntitiesByType(type) {
    const nodeIds = this.nodesByType.get(type) || new Set();
    return Array.from(nodeIds).map((id) => this.nodes.get(id));
  }

  /**
   * Find relationships between two entities.
   * @param {string} entity1Name - First entity name
   * @param {string} entity2Name - Second entity name
   * @returns {Array} Relationships between entities
   */
  findRelationships(entity1Name, entity2Name) {
    const id1 = this.nodeIndex.get(entity1Name.toLowerCase());
    const id2 = this.nodeIndex.get(entity2Name.toLowerCase());

    if (!id1 || !id2) return [];

    return Array.from(this.edges.values()).filter(
      (e) => (e.source === id1 && e.target === id2) || (e.source === id2 && e.target === id1)
    );
  }

  /**
   * Find shortest path between two entities (BFS).
   * @param {string} entity1Name - Start entity
   * @param {string} entity2Name - End entity
   * @returns {Array} Path of entity IDs, or [] if no path
   */
  findPath(entity1Name, entity2Name) {
    const startId = this.nodeIndex.get(entity1Name.toLowerCase());
    const endId = this.nodeIndex.get(entity2Name.toLowerCase());

    if (!startId || !endId) return [];

    const queue = [[startId]];
    const visited = new Set([startId]);

    while (queue.length > 0) {
      const path = queue.shift();
      const currentId = path[path.length - 1];

      if (currentId === endId) {
        return path;
      }

      // Find connected nodes
      for (const edge of this.edges.values()) {
        let nextId = null;
        if (edge.source === currentId) nextId = edge.target;
        if (edge.target === currentId) nextId = edge.source;

        if (nextId && !visited.has(nextId)) {
          visited.add(nextId);
          queue.push([...path, nextId]);
        }
      }
    }

    return [];
  }

  /**
   * Calculate influence score for an entity (number of connections).
   * @param {string} entityName - Entity to score
   * @returns {number} Influence score
   */
  getInfluenceScore(entityName) {
    const nodeId = this.nodeIndex.get(entityName.toLowerCase());
    if (!nodeId) return 0;

    let connections = 0;
    for (const edge of this.edges.values()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        connections += edge.confidence;
      }
    }

    return connections;
  }

  /**
   * Get all entities sorted by influence.
   * @returns {Array} Entities sorted by influence (descending)
   */
  getInfluentialEntities(topK = 10) {
    const scores = new Map();

    for (const [name, nodeId] of this.nodeIndex) {
      scores.set(nodeId, this.getInfluenceScore(name));
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([nodeId]) => this.nodes.get(nodeId));
  }

  /**
   * Get graph statistics.
   */
  getStats() {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      types: Array.from(this.nodesByType.keys()),
      typeCounts: Object.fromEntries(
        Array.from(this.nodesByType.entries()).map(([type, set]) => [type, set.size])
      ),
    };
  }

  /**
   * Export graph as JSON (for backup/visualization).
   */
  export() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      stats: this.getStats(),
      exportedAt: Date.now(),
    };
  }

  /**
   * Clear all graph data.
   */
  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.nodesByType.clear();
    this.nodeIndex.clear();
  }
}

const GlobalKnowledgeGraph = new KnowledgeGraph();

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = { KnowledgeGraph, GlobalKnowledgeGraph };
}
