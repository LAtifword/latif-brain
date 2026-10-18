/**
 * Graph Reasoning Engine - Performs semantic reasoning and inference
 * Phase 4: Deductive reasoning, rule application, and knowledge inference
 */

import { getLogger } from '../../core/logger.js';

const logger = getLogger();

/**
 * Reasoning Rule
 */
export class ReasoningRule {
  constructor(name, premises, conclusion) {
    this.name = name;
    this.premises = premises; // Array of required relationships
    this.conclusion = conclusion; // Inferred relationship
    this.confidence = 1.0;
  }

  /**
   * Check if rule applies to given pattern
   */
  appliesTo(pattern) {
    return this.premises.every(premise =>
      pattern.relationshipTypes?.includes(premise)
    );
  }
}

/**
 * Graph Reasoning Engine
 */
export class GraphReasoningEngine {
  constructor(graph) {
    this.graph = graph;
    this.rules = [];
    this.inferences = new Map();
    this.maxInferenceDepth = 3;
    this.initializeDefaultRules();
  }

  /**
   * Initialize default reasoning rules
   */
  initializeDefaultRules() {
    // Transitivity: if A knows B and B knows C, then A likely knows C
    this.addRule(new ReasoningRule(
      'transitivity-knows',
      ['knows'],
      { type: 'knows', confidence: 0.7 }
    ));

    // Hierarchy: if A works-for B and B works-for C, then A indirectly works for C
    this.addRule(new ReasoningRule(
      'transitivity-works-for',
      ['works-for'],
      { type: 'works-for', confidence: 0.6 }
    ));

    // Location inference: if A located-in B and B located-in C, then A located-in C
    this.addRule(new ReasoningRule(
      'transitivity-location',
      ['located-in'],
      { type: 'located-in', confidence: 0.8 }
    ));

    // Entity type inference: if A is-a B and B is-a C, then A is-a C
    this.addRule(new ReasoningRule(
      'transitivity-isa',
      ['is-a'],
      { type: 'is-a', confidence: 0.9 }
    ));
  }

  /**
   * Add custom reasoning rule
   */
  addRule(rule) {
    this.rules.push(rule);
  }

  /**
   * Apply reasoning rules to graph
   */
  applyReasoning(maxRules = 100) {
    let appliedCount = 0;

    // For each edge in graph
    this.graph.edges.forEach((edge) => {
      if (appliedCount >= maxRules) return;

      // Try to apply each rule
      this.rules.forEach(rule => {
        if (edge.relationshipType === rule.premises[0]) {
          const inferredEdges = this.inferFromRule(edge, rule);
          inferredEdges.forEach(inferredEdge => {
            // Add inferred edge if doesn't exist
            const existingEdges = this.graph.findEdges(
              inferredEdge.sourceId,
              inferredEdge.targetId,
              inferredEdge.type
            );

            if (existingEdges.length === 0) {
              this.graph.createEdge(
                inferredEdge.sourceId,
                inferredEdge.targetId,
                inferredEdge.type,
                {
                  inferred: true,
                  rule: rule.name,
                  confidence: inferredEdge.confidence,
                  source: 'reasoning'
                }
              );
              appliedCount++;
            }
          });
        }
      });
    });

    logger.info('Reasoning complete', { edgesInferred: appliedCount });
    return appliedCount;
  }

  /**
   * Infer new edges from rule
   */
  inferFromRule(edge, rule) {
    const inferred = [];

    // Get transitive closure
    const paths = this.findPathsWithType(
      edge.sourceId,
      rule.premises[0],
      this.maxInferenceDepth
    );

    paths.forEach(path => {
      if (path.length >= 2) {
        const targetId = path[path.length - 1];
        if (targetId !== edge.sourceId) {
          inferred.push({
            sourceId: edge.sourceId,
            targetId: targetId,
            type: rule.conclusion.type,
            confidence: rule.conclusion.confidence
          });
        }
      }
    });

    return inferred;
  }

  /**
   * Find all paths of specific relationship type
   */
  findPathsWithType(startId, relationshipType, maxDepth) {
    const paths = [];
    const visited = new Set();

    const dfs = (currentId, path, depth) => {
      if (depth > maxDepth || visited.has(currentId)) return;
      visited.add(currentId);

      // Find outgoing edges of given type
      this.graph.edges.forEach(edge => {
        if (edge.sourceId === currentId && edge.relationshipType === relationshipType) {
          const newPath = [...path, edge.targetId];
          paths.push(newPath);

          dfs(edge.targetId, newPath, depth + 1);
        }
      });

      visited.delete(currentId);
    };

    dfs(startId, [startId], 0);
    return paths;
  }

  /**
   * Query with reasoning - returns both explicit and inferred results
   */
  queryWithReasoning(sourceId, relationshipType, depth = 1) {
    const explicit = [];
    const inferred = [];

    // Get explicit relationships
    this.graph.edges.forEach(edge => {
      if (edge.sourceId === sourceId && edge.relationshipType === relationshipType) {
        explicit.push({
          targetId: edge.targetId,
          target: this.graph.nodes.get(edge.targetId),
          explicit: true,
          confidence: 1.0
        });
      }
    });

    // Get inferred relationships
    if (depth > 1) {
      const paths = this.findPathsWithType(sourceId, relationshipType, depth);
      paths.forEach(path => {
        if (path.length > 1) {
          const targetId = path[path.length - 1];
          const pathLength = path.length - 1;
          const confidence = Math.pow(0.9, pathLength - 1); // Decay confidence with path length

          if (!explicit.find(e => e.targetId === targetId)) {
            inferred.push({
              targetId: targetId,
              target: this.graph.nodes.get(targetId),
              inferred: true,
              pathLength: pathLength,
              confidence: confidence
            });
          }
        }
      });
    }

    return {
      explicit,
      inferred,
      total: explicit.length + inferred.length
    };
  }

  /**
   * Find best path between entities
   */
  findBestPath(sourceId, targetId) {
    const visited = new Set();
    const paths = [];

    const dfs = (currentId, path) => {
      if (path.length > 10) return; // Limit search depth
      if (visited.has(currentId)) return;
      visited.add(currentId);

      if (currentId === targetId) {
        paths.push(path);
        visited.delete(currentId);
        return;
      }

      // Explore neighbors
      this.graph.edges.forEach(edge => {
        if (edge.sourceId === currentId) {
          dfs(edge.targetId, [
            ...path,
            {
              nodeId: edge.targetId,
              relationshipType: edge.relationshipType
            }
          ]);
        }
      });

      visited.delete(currentId);
    };

    dfs(sourceId, [
      {
        nodeId: sourceId,
        relationshipType: null
      }
    ]);

    // Return shortest path
    return paths.sort((a, b) => a.length - b.length)[0] || null;
  }

  /**
   * Explain inference - why is A related to B?
   */
  explainInference(sourceId, targetId, _relationshipType) {
    const path = this.findBestPath(sourceId, targetId);

    if (!path) {
      return {
        explained: false,
        reason: 'No path found'
      };
    }

    // Trace the path
    const explanation = [];
    const sourceNode = this.graph.nodes.get(sourceId);
    let currentNode = sourceNode;

    for (let i = 1; i < path.length; i++) {
      const nextNodeId = path[i].nodeId;
      const relType = path[i].relationshipType;
      const nextNode = this.graph.nodes.get(nextNodeId);

      explanation.push({
        from: currentNode.label,
        relationship: relType,
        to: nextNode.label
      });

      currentNode = nextNode;
    }

    return {
      explained: true,
      path: explanation,
      confidence: Math.pow(0.9, explanation.length - 1)
    };
  }

  /**
   * Get reasoning statistics
   */
  getStats() {
    const explicitEdges = Array.from(this.graph.edges.values())
      .filter(e => !e.properties?.inferred).length;
    const inferredEdges = this.graph.edges.size - explicitEdges;

    return {
      totalRules: this.rules.length,
      explicitEdges: explicitEdges,
      inferredEdges: inferredEdges,
      inferenceRatio: this.graph.edges.size > 0
        ? (inferredEdges / this.graph.edges.size * 100).toFixed(1) + '%'
        : '0%',
      maxInferenceDepth: this.maxInferenceDepth
    };
  }
}

// Export singleton
export const graphReasoningEngine = new GraphReasoningEngine(null); // Injected at runtime
