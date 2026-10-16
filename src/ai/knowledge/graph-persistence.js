/**
 * Knowledge Graph Persistence Layer
 * Handles saving and loading knowledge graph nodes and edges
 */

import { v4 as uuid } from 'uuid';
import { getDatabase } from '../../core/data-layer.js';
import { getLogger } from '../../core/logger.js';

const logger = getLogger();

export class GraphPersistence {
  /**
   * Add node to knowledge graph
   */
  async addNode(nodeData) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    const id = nodeData.id || uuid.v4();
    const now = new Date().toISOString();

    try {
      await db.run(
        `INSERT OR REPLACE INTO kg_nodes
         (id, type, name, aliases, attributes, confidence, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          nodeData.type,
          nodeData.name,
          JSON.stringify(nodeData.aliases || []),
          JSON.stringify(nodeData.attributes || {}),
          nodeData.confidence || 1.0,
          nodeData.source,
          now,
          now
        ]
      );

      logger.debug('Knowledge graph node added', { id, type: nodeData.type, name: nodeData.name });
      return id;
    } catch (error) {
      logger.error('Failed to add node', { error: error.message });
      throw error;
    }
  }

  /**
   * Get node from knowledge graph
   */
  async getNode(nodeId) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const node = await db.get(
        `SELECT id, type, name, aliases, attributes, confidence, source, occurrences, created_at, updated_at
         FROM kg_nodes WHERE id = ?`,
        [nodeId]
      );

      if (node) {
        node.aliases = JSON.parse(node.aliases);
        node.attributes = JSON.parse(node.attributes);
      }

      return node;
    } catch (error) {
      logger.error('Failed to get node', { error: error.message });
      throw error;
    }
  }

  /**
   * Find nodes by type
   */
  async findNodesByType(type, limit = 100) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const nodes = await db.all(
        `SELECT id, type, name, confidence, occurrences FROM kg_nodes
         WHERE type = ? ORDER BY occurrences DESC, confidence DESC LIMIT ?`,
        [type, limit]
      );

      return nodes || [];
    } catch (error) {
      logger.error('Failed to find nodes by type', { error: error.message });
      throw error;
    }
  }

  /**
   * Search nodes by name
   */
  async searchNodes(query, limit = 20) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const nodes = await db.all(
        `SELECT id, type, name, confidence, occurrences FROM kg_nodes
         WHERE name LIKE ? OR aliases LIKE ?
         ORDER BY occurrences DESC, confidence DESC LIMIT ?`,
        [`%${query}%`, `%"${query}"%`, limit]
      );

      return nodes || [];
    } catch (error) {
      logger.error('Failed to search nodes', { error: error.message });
      throw error;
    }
  }

  /**
   * Remove node from knowledge graph
   */
  async removeNode(nodeId) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      // Delete node and associated edges (cascading)
      await db.run(`DELETE FROM kg_nodes WHERE id = ?`, [nodeId]);

      logger.debug('Knowledge graph node removed', { id: nodeId });
      return true;
    } catch (error) {
      logger.error('Failed to remove node', { error: error.message });
      throw error;
    }
  }

  /**
   * Add edge (relationship) to knowledge graph
   */
  async addEdge(sourceId, targetId, relationType, weight = 1.0, evidence = []) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    const id = uuid.v4();
    const now = new Date().toISOString();

    try {
      await db.run(
        `INSERT OR REPLACE INTO kg_edges
         (id, source_id, target_id, relation_type, weight, evidence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sourceId,
          targetId,
          relationType,
          weight,
          JSON.stringify(evidence),
          now,
          now
        ]
      );

      logger.debug('Knowledge graph edge added', { sourceId, targetId, relationType });
      return id;
    } catch (error) {
      logger.error('Failed to add edge', { error: error.message });
      throw error;
    }
  }

  /**
   * Get edge (relationship)
   */
  async getEdge(edgeId) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const edge = await db.get(
        `SELECT id, source_id, target_id, relation_type, weight, evidence, created_at
         FROM kg_edges WHERE id = ?`,
        [edgeId]
      );

      if (edge) {
        edge.evidence = JSON.parse(edge.evidence);
      }

      return edge;
    } catch (error) {
      logger.error('Failed to get edge', { error: error.message });
      throw error;
    }
  }

  /**
   * Update edge weight
   */
  async updateEdge(edgeId, weight, evidence = []) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      await db.run(
        `UPDATE kg_edges SET weight = ?, evidence = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [weight, JSON.stringify(evidence), edgeId]
      );

      logger.debug('Knowledge graph edge updated', { id: edgeId });
      return true;
    } catch (error) {
      logger.error('Failed to update edge', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all edges for a node
   */
  async getNodeConnections(nodeId) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const edges = await db.all(
        `SELECT e.id, e.source_id, e.target_id, e.relation_type, e.weight,
                n1.name as source_name, n2.name as target_name
         FROM kg_edges e
         LEFT JOIN kg_nodes n1 ON e.source_id = n1.id
         LEFT JOIN kg_nodes n2 ON e.target_id = n2.id
         WHERE e.source_id = ? OR e.target_id = ?
         ORDER BY e.weight DESC`,
        [nodeId, nodeId]
      );

      return edges || [];
    } catch (error) {
      logger.error('Failed to get node connections', { error: error.message });
      throw error;
    }
  }

  /**
   * Query knowledge graph with pattern
   */
  async queryGraph(pattern) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      // Simple pattern matching for now
      // Format: "type:name -> relation -> type:name"
      const parts = pattern.split('->').map(p => p.trim());

      if (parts.length < 1) {
        return [];
      }

      // Find starting node
      const [nodeType, nodeName] = parts[0].split(':').map(p => p.trim());
      const startNode = await db.get(
        `SELECT id FROM kg_nodes WHERE type = ? AND name = ? LIMIT 1`,
        [nodeType, nodeName]
      );

      if (!startNode) {
        return [];
      }

      // For now, just return connections
      const connections = await this.getNodeConnections(startNode.id);
      return connections;
    } catch (error) {
      logger.error('Failed to query graph', { error: error.message });
      throw error;
    }
  }

  /**
   * Get graph statistics
   */
  async getGraphStats() {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const nodeCount = await db.get(`SELECT COUNT(*) as count FROM kg_nodes`);
      const edgeCount = await db.get(`SELECT COUNT(*) as count FROM kg_edges`);
      const typeDistribution = await db.all(
        `SELECT type, COUNT(*) as count FROM kg_nodes GROUP BY type`
      );
      const relationshipDistribution = await db.all(
        `SELECT relation_type, COUNT(*) as count FROM kg_edges GROUP BY relation_type`
      );

      return {
        totalNodes: nodeCount?.count || 0,
        totalEdges: edgeCount?.count || 0,
        typeDistribution,
        relationshipDistribution
      };
    } catch (error) {
      logger.error('Failed to get graph stats', { error: error.message });
      throw error;
    }
  }

  /**
   * Export graph data
   */
  async exportGraph() {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      const nodes = await db.all(`SELECT * FROM kg_nodes`);
      const edges = await db.all(`SELECT * FROM kg_edges`);

      // Parse JSON fields
      const processedNodes = nodes.map(n => ({
        ...n,
        aliases: JSON.parse(n.aliases),
        attributes: JSON.parse(n.attributes)
      }));

      const processedEdges = edges.map(e => ({
        ...e,
        evidence: JSON.parse(e.evidence)
      }));

      return {
        nodes: processedNodes,
        edges: processedEdges,
        exportedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to export graph', { error: error.message });
      throw error;
    }
  }

  /**
   * Import graph data
   */
  async importGraph(data) {
    const db = getDatabase();
    if (!db) throw new Error('Database not initialized');

    try {
      for (const node of data.nodes || []) {
        await this.addNode(node);
      }

      for (const edge of data.edges || []) {
        await this.addEdge(
          edge.source_id,
          edge.target_id,
          edge.relation_type,
          edge.weight,
          edge.evidence
        );
      }

      logger.info('Graph imported', { nodes: data.nodes?.length || 0, edges: data.edges?.length || 0 });
      return true;
    } catch (error) {
      logger.error('Failed to import graph', { error: error.message });
      throw error;
    }
  }
}

export const graphPersistence = new GraphPersistence();
export default GraphPersistence;
