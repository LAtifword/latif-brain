/**
 * Knowledge Consolidator - Integrates agent learning into knowledge graph
 * Phase 4: Converts agent experiences and memories into structured knowledge
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Knowledge Consolidator
 */
export class KnowledgeConsolidator {
  constructor(graph, agentMemory, entityLinker, reasoningEngine) {
    this.graph = graph;
    this.agentMemory = agentMemory;
    this.entityLinker = entityLinker;
    this.reasoningEngine = reasoningEngine;
    this.consolidationHistory = [];
    this.confidenceBoost = 0.15; // Boost confidence when verified multiple times
  }

  /**
   * Consolidate agent episodic memory into semantic knowledge
   */
  async consolidateFromEpisodic(agent) {
    if (!this.agentMemory || !agent) return { consolidated: 0 };

    const episodicMemory = agent.memory || [];
    let consolidatedCount = 0;

    // Process high-importance episodes
    episodicMemory.forEach(episode => {
      if (episode.importance > 0.7) {
        const extracted = this.extractKnowledgeFromEpisode(episode);
        extracted.forEach(fact => {
          this.addFactToGraph(fact, 'episodic-consolidation');
          consolidatedCount++;
        });
      }
    });

    logger.info('Consolidated episodic memory', {
      agentId: agent.id,
      factsExtracted: consolidatedCount
    });

    return { consolidated: consolidatedCount };
  }

  /**
   * Extract structured knowledge from episodic memory
   */
  extractKnowledgeFromEpisode(episode) {
    const facts = [];
    const content = episode.content || '';

    // Extract relationships
    const relationships = this.graph.extractRelationships(content);

    // Convert to facts
    relationships.forEach(rel => {
      facts.push({
        subject: rel.source,
        predicate: rel.type,
        object: rel.target,
        confidence: episode.importance,
        source: 'episodic-consolidation',
        timestamp: episode.timestamp || new Date().toISOString()
      });
    });

    return facts;
  }

  /**
   * Add fact to graph
   */
  addFactToGraph(fact, source) {
    // Resolve entities through entity linker
    const subjectId = this.entityLinker?.resolveMention(fact.subject);
    const objectId = this.entityLinker?.resolveMention(fact.object);

    if (!subjectId || !objectId) {
      // Create new entities if not found
      const subject = this.graph.createNode(fact.subject, 'entity', { source: source });
      const object = this.graph.createNode(fact.object, 'entity', { source: source });

      this.graph.createEdge(subject.id, object.id, fact.predicate, {
        confidence: fact.confidence,
        source: source,
        timestamp: fact.timestamp
      });
    } else {
      // Link existing entities
      const existingEdges = this.graph.findEdges(subjectId, objectId, fact.predicate);

      if (existingEdges.length > 0) {
        // Update confidence
        const edge = existingEdges[0];
        edge.confidence = Math.min(1, edge.confidence + this.confidenceBoost);
      } else {
        // Create new edge
        this.graph.createEdge(subjectId, objectId, fact.predicate, {
          confidence: fact.confidence,
          source: source,
          timestamp: fact.timestamp
        });
      }
    }
  }

  /**
   * Consolidate agent learnings periodically
   */
  async performFullConsolidation(agents) {
    const results = {
      totalAgents: agents.length,
      totalConsolidated: 0,
      newNodes: 0,
      newEdges: 0,
      startTime: new Date().toISOString()
    };

    const initialNodeCount = this.graph.nodes.size;
    const initialEdgeCount = this.graph.edges.size;

    // Consolidate from all agents
    for (const agent of agents) {
      const consolidated = await this.consolidateFromEpisodic(agent);
      results.totalConsolidated += consolidated.consolidated;
    }

    // Deduplicate entities
    if (this.entityLinker) {
      const mergedCount = this.entityLinker.deduplicateGraph();
      logger.info('Deduplication during consolidation', { merged: mergedCount });
    }

    // Apply reasoning to infer new relationships
    if (this.reasoningEngine) {
      const inferredCount = this.reasoningEngine.applyReasoning();
      logger.info('Reasoning during consolidation', { inferred: inferredCount });
    }

    results.newNodes = this.graph.nodes.size - initialNodeCount;
    results.newEdges = this.graph.edges.size - initialEdgeCount;
    results.endTime = new Date().toISOString();

    this.consolidationHistory.push(results);

    logger.info('Full consolidation complete', results);
    return results;
  }

  /**
   * Extract semantic facts from conversation/interaction
   */
  extractFromInteraction(interaction) {
    const facts = [];

    // Parse interaction content
    const relationships = this.graph.extractRelationships(interaction.content || '');

    // Convert to graph facts
    relationships.forEach(rel => {
      facts.push({
        subject: rel.source,
        predicate: rel.type,
        object: rel.target,
        confidence: interaction.confidence || 0.8,
        source: interaction.source || 'interaction',
        timestamp: interaction.timestamp || new Date().toISOString()
      });
    });

    return facts;
  }

  /**
   * Get entity context from graph
   */
  getEntityContext(entityMention, contextDepth = 2) {
    const entityId = this.entityLinker?.resolveMention(entityMention);
    if (!entityId) return null;

    const entity = this.graph.nodes.get(entityId);
    if (!entity) return null;

    // Get related entities
    const connections = this.graph.getNodeConnections(entityId);
    const related = this.graph.findRelated(entityId, contextDepth);

    // Get reasoning paths
    const reasoning = this.reasoningEngine?.queryWithReasoning(entityId, null, contextDepth) || {};

    return {
      entity: {
        id: entityId,
        label: entity.label,
        type: entity.type,
        properties: entity.properties,
        metadata: entity.metadata
      },
      connections: {
        incoming: connections.incoming.length,
        outgoing: connections.outgoing.length
      },
      related: related.slice(0, 5),
      reasoning: reasoning,
      score: entity.metadata?.confidence || 0.5
    };
  }

  /**
   * Verify fact with existing knowledge
   */
  verifyFact(fact) {
    const subjectId = this.entityLinker?.resolveMention(fact.subject);
    const objectId = this.entityLinker?.resolveMention(fact.object);

    if (!subjectId || !objectId) {
      return {
        verified: false,
        reason: 'Entities not found in graph'
      };
    }

    const existingEdges = this.graph.findEdges(subjectId, objectId, fact.predicate);

    return {
      verified: existingEdges.length > 0,
      edges: existingEdges,
      existingConfidence: existingEdges.length > 0
        ? existingEdges[0].confidence
        : null
    };
  }

  /**
   * Get consolidation statistics
   */
  getStats() {
    return {
      totalConsolidations: this.consolidationHistory.length,
      lastConsolidation: this.consolidationHistory.length > 0
        ? this.consolidationHistory[this.consolidationHistory.length - 1].endTime
        : null,
      graphStats: this.graph?.getStats?.(),
      entityLinkerStats: this.entityLinker?.getStats?.(),
      reasoningStats: this.reasoningEngine?.getStats?.()
    };
  }
}

// Export singleton
export const knowledgeConsolidator = new KnowledgeConsolidator(null, null, null, null); // Injected at runtime
