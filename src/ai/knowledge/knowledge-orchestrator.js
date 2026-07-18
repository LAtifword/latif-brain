/**
 * Knowledge Graph Orchestrator - Unified interface for all knowledge operations
 * Phase 4: Coordinates entity linking, reasoning, and consolidation
 */

import { KnowledgeGraph } from './graph.js';
import { EntityLinker } from './entity-linker.js';
import { GraphReasoningEngine } from './graph-reasoning.js';
import { KnowledgeConsolidator } from './knowledge-consolidator.js';
import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Knowledge Graph Orchestrator
 */
export class KnowledgeOrchestrator {
  constructor() {
    this.graph = new KnowledgeGraph();
    this.entityLinker = new EntityLinker(this.graph);
    this.reasoningEngine = new GraphReasoningEngine(this.graph);
    this.consolidator = new KnowledgeConsolidator(
      this.graph,
      null, // agentMemory - injected later
      this.entityLinker,
      this.reasoningEngine
    );
    this.queryHistory = [];
    this.operationStats = {
      queriesExecuted: 0,
      factsAdded: 0,
      entitiesMerged: 0,
      inferencesGenerated: 0
    };
  }

  /**
   * Add fact to knowledge base
   */
  addFact(subject, predicate, object, metadata = {}) {
    // Create or link entities
    const subjectNode = this.graph.createNode(subject, 'entity', metadata);
    const objectNode = this.graph.createNode(object, 'entity', metadata);

    // Create relationship
    const edge = this.graph.createEdge(subjectNode.id, objectNode.id, predicate, {
      confidence: metadata.confidence || 1.0,
      source: metadata.source || 'manual',
      timestamp: new Date().toISOString()
    });

    // Register aliases
    if (metadata.aliases) {
      metadata.aliases.forEach(alias => {
        this.entityLinker.registerAlias(subjectNode.id, alias);
      });
    }

    this.operationStats.factsAdded++;

    logger.info('Fact added to knowledge base', {
      subject,
      predicate,
      object,
      confidence: metadata.confidence
    });

    return edge;
  }

  /**
   * Query knowledge base
   */
  query(subject, predicate = null) {
    const subjectId = this.entityLinker.resolveMention(subject);

    if (!subjectId) {
      return {
        found: false,
        query: subject,
        results: []
      };
    }

    // Get results with reasoning
    const results = this.reasoningEngine.queryWithReasoning(subjectId, predicate, 2);

    this.queryHistory.push({
      query: subject,
      predicate: predicate,
      timestamp: new Date().toISOString(),
      resultsFound: results.total
    });

    this.operationStats.queriesExecuted++;

    return {
      found: true,
      query: subject,
      explicit: results.explicit,
      inferred: results.inferred,
      total: results.total
    };
  }

  /**
   * Find relationship between two entities
   */
  findRelationship(entityA, entityB) {
    const idA = this.entityLinker.resolveMention(entityA);
    const idB = this.entityLinker.resolveMention(entityB);

    if (!idA || !idB) {
      return {
        found: false,
        entityA,
        entityB,
        path: null
      };
    }

    // Find direct edges
    const directEdges = this.graph.findEdges(idA, idB);
    if (directEdges.length > 0) {
      return {
        found: true,
        entityA,
        entityB,
        direct: true,
        relationships: directEdges.map(e => ({
          type: e.relationshipType,
          confidence: e.confidence
        }))
      };
    }

    // Find reasoning path
    const path = this.reasoningEngine.findBestPath(idA, idB);

    return {
      found: path !== null,
      entityA,
      entityB,
      direct: false,
      path: path,
      explanation: path ? this.reasoningEngine.explainInference(idA, idB) : null
    };
  }

  /**
   * Get entity context
   */
  getEntityContext(entity) {
    return this.consolidator.getEntityContext(entity, 2);
  }

  /**
   * Consolidate agent learning
   */
  async consolidateAgentLearning(agents) {
    // Inject agent memory into consolidator
    if (agents.length > 0 && agents[0].memory) {
      this.consolidator.agentMemory = agents[0].memory;
    }

    const result = await this.consolidator.performFullConsolidation(agents);

    // Update stats
    this.operationStats.inferencesGenerated += result.newEdges;
    this.operationStats.entitiesMerged += result.newNodes;

    return result;
  }

  /**
   * Perform reasoning on graph
   */
  performReasoning() {
    const before = this.graph.edges.size;
    const inferred = this.reasoningEngine.applyReasoning();
    const after = this.graph.edges.size;

    this.operationStats.inferencesGenerated += (after - before);

    return {
      edgesInferred: inferred,
      totalEdges: after,
      reasoningRules: this.reasoningEngine.rules.length
    };
  }

  /**
   * Deduplicate entities in graph
   */
  deduplicateEntities() {
    const before = this.graph.nodes.size;
    const merged = this.entityLinker.deduplicateGraph();
    const after = this.graph.nodes.size;

    this.operationStats.entitiesMerged += (before - after);

    return {
      entitiesMerged: merged,
      nodesBefore: before,
      nodesAfter: after
    };
  }

  /**
   * Export knowledge base to JSON
   */
  export() {
    return {
      graph: this.graph.export(),
      entityAliases: Object.fromEntries(this.entityLinker.entityAliases),
      reasoningRules: this.reasoningEngine.rules.map(r => ({
        name: r.name,
        premises: r.premises,
        conclusion: r.conclusion
      })),
      statistics: this.getStats(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import knowledge base from JSON
   */
  import(data) {
    if (!data.graph) return false;

    // Clear current data
    this.graph.nodes.clear();
    this.graph.edges.clear();
    this.graph.nodeIndex.clear();
    this.graph.relationshipIndex.clear();

    // Import nodes
    data.graph.nodes.forEach(node => {
      this.graph.nodes.set(node.id, node);
      this.graph.nodeIndex.set(node.label.toLowerCase(), node.id);
    });

    // Import edges
    data.graph.edges.forEach(edge => {
      this.graph.edges.set(edge.id, edge);
      if (!this.graph.relationshipIndex.has(edge.relationshipType)) {
        this.graph.relationshipIndex.set(edge.relationshipType, []);
      }
      this.graph.relationshipIndex.get(edge.relationshipType).push(edge);
    });

    logger.info('Knowledge base imported', {
      nodes: this.graph.nodes.size,
      edges: this.graph.edges.size
    });

    return true;
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      graph: this.graph.getStats(),
      entityLinker: this.entityLinker.getStats(),
      reasoning: this.reasoningEngine.getStats(),
      consolidation: this.consolidator.getStats(),
      operations: this.operationStats,
      queryHistory: {
        total: this.queryHistory.length,
        recentQueries: this.queryHistory.slice(-10)
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      components: {
        graph: 'operational',
        entityLinker: 'operational',
        reasoningEngine: 'operational',
        consolidator: 'operational'
      },
      stats: this.getStats()
    };
  }
}

// Export singleton
export const knowledgeOrchestrator = new KnowledgeOrchestrator();
