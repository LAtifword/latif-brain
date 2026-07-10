/**
 * Entity Linking - Disambiguates and links entities across the knowledge graph
 * Phase 4: Deduplication, entity resolution, and knowledge base integration
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Entity Linker - Disambiguates and merges duplicate entities
 */
export class EntityLinker {
  constructor(graph) {
    this.graph = graph;
    this.entityAliases = new Map(); // canonical_id -> [aliases]
    this.mentionCache = new Map(); // mention -> entity_id
    this.confidenceThreshold = 0.7;
  }

  /**
   * Register entity alias
   */
  registerAlias(entityId, alias) {
    if (!this.entityAliases.has(entityId)) {
      this.entityAliases.set(entityId, []);
    }
    this.entityAliases.get(entityId).push(alias.toLowerCase());
    this.mentionCache.set(alias.toLowerCase(), entityId);
  }

  /**
   * Resolve entity mention to canonical entity
   */
  resolveMention(mention) {
    const normalized = mention.toLowerCase();

    // Direct cache hit
    if (this.mentionCache.has(normalized)) {
      return this.mentionCache.get(normalized);
    }

    // Look for similar entities in graph
    const candidates = this.findSimilarEntities(mention);
    if (candidates.length > 0) {
      const best = candidates[0];
      this.mentionCache.set(normalized, best.id);
      this.registerAlias(best.id, mention);
      return best.id;
    }

    return null;
  }

  /**
   * Find similar entities using string similarity
   */
  findSimilarEntities(mention, maxResults = 5) {
    const normalized = mention.toLowerCase();
    const candidates = [];

    this.graph.nodes.forEach((node, nodeId) => {
      const similarity = this.stringSimilarity(normalized, node.label.toLowerCase());
      if (similarity >= this.confidenceThreshold) {
        candidates.push({
          id: nodeId,
          label: node.label,
          similarity: similarity
        });
      }
    });

    return candidates.sort((a, b) => b.similarity - a.similarity).slice(0, maxResults);
  }

  /**
   * String similarity using Levenshtein distance
   */
  stringSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;
    if (shorter.includes(longer)) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  levenshteinDistance(s1, s2) {
    const costs = [];

    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length];
  }

  /**
   * Merge duplicate entities
   */
  mergeEntities(sourceId, targetId, confidence = 1.0) {
    const sourceNode = this.graph.nodes.get(sourceId);
    const targetNode = this.graph.nodes.get(targetId);

    if (!sourceNode || !targetNode) return false;

    // Merge aliases
    if (this.entityAliases.has(sourceId)) {
      const sourceAliases = this.entityAliases.get(sourceId);
      if (!this.entityAliases.has(targetId)) {
        this.entityAliases.set(targetId, []);
      }
      this.entityAliases.get(targetId).push(...sourceAliases);
    }

    // Update mention cache
    this.mentionCache.forEach((entityId, mention) => {
      if (entityId === sourceId) {
        this.mentionCache.set(mention, targetId);
      }
    });

    // Merge edges
    this.graph.edges.forEach((edge, _edgeId) => {
      if (edge.sourceId === sourceId) edge.sourceId = targetId;
      if (edge.targetId === sourceId) edge.targetId = targetId;
    });

    // Update metadata
    targetNode.metadata.mentions = (targetNode.metadata.mentions || 0) + (sourceNode.metadata.mentions || 0);
    targetNode.metadata.confidence = Math.min(1, (targetNode.metadata.confidence + confidence) / 2);

    // Remove source node
    this.graph.nodes.delete(sourceId);
    this.graph.nodeIndex.delete(sourceNode.label.toLowerCase());

    logger.info(`Merged entities: ${sourceNode.label} -> ${targetNode.label}`, {
      sourceId,
      targetId,
      confidence
    });

    return true;
  }

  /**
   * Deduplicate entities in graph
   */
  deduplicateGraph() {
    const merged = new Set();
    let mergeCount = 0;

    const nodeArray = Array.from(this.graph.nodes.entries());

    for (let i = 0; i < nodeArray.length; i++) {
      const [id1, node1] = nodeArray[i];
      if (merged.has(id1)) continue;

      for (let j = i + 1; j < nodeArray.length; j++) {
        const [id2, node2] = nodeArray[j];
        if (merged.has(id2)) continue;

        const similarity = this.stringSimilarity(
          node1.label.toLowerCase(),
          node2.label.toLowerCase()
        );

        // If similar and same type, merge
        if (similarity >= 0.85 && node1.type === node2.type) {
          this.mergeEntities(id2, id1, similarity);
          merged.add(id2);
          mergeCount++;
        }
      }
    }

    logger.info('Deduplication complete', { entitiesMerged: mergeCount });
    return mergeCount;
  }

  /**
   * Get entity statistics
   */
  getStats() {
    return {
      totalEntities: this.graph.nodes.size,
      totalAliases: Array.from(this.entityAliases.values()).reduce((sum, aliases) => sum + aliases.length, 0),
      cacheEntries: this.mentionCache.size,
      confidenceThreshold: this.confidenceThreshold
    };
  }
}

// Export singleton
export const entityLinker = new EntityLinker(null); // Injected at runtime
