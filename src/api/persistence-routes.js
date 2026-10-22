/**
 * Persistence API Routes
 * Agent memory, knowledge graph, and workflow persistence
 */

import express from 'express';
import { agentPersistence } from '../ai/agents/agent-persistence.js';
import { graphPersistence } from '../ai/knowledge/graph-persistence.js';
import { getLogger } from '../core/logger.js';

const router = express.Router();
const logger = getLogger();

// ============================================================================
// Agent Memory Endpoints
// ============================================================================

/**
 * Save agent memory
 * POST /api/agents/:agentId/memory
 */
router.post('/agents/:agentId/memory', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { sessionId, memoryType, key, value, ttl } = req.body;

    if (!sessionId || !memoryType || !key) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, memoryType, key'
      });
    }

    const id = await agentPersistence.saveMemory(
      agentId,
      sessionId,
      memoryType,
      key,
      value,
      ttl
    );

    res.json({
      id,
      status: 'saved',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to save agent memory', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get agent memory
 * GET /api/agents/:agentId/memory
 */
router.get('/agents/:agentId/memory', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { sessionId, memoryType } = req.query;

    if (!sessionId || !memoryType) {
      return res.status(400).json({
        error: 'Missing required query params: sessionId, memoryType'
      });
    }

    const memory = await agentPersistence.getMemory(agentId, sessionId, memoryType);

    res.json({
      agentId,
      sessionId,
      memoryType,
      memory,
      count: Object.keys(memory).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get agent memory', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get agent memory statistics
 * GET /api/agents/:agentId/memory/stats
 */
router.get('/agents/:agentId/memory/stats', async (req, res) => {
  try {
    const { agentId } = req.params;
    const stats = await agentPersistence.getMemoryStats(agentId);

    res.json({
      agentId,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get memory stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get agent execution history
 * GET /api/agents/:agentId/executions
 */
router.get('/agents/:agentId/executions', async (req, res) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const executions = await agentPersistence.getExecutionHistory(agentId, limit);

    res.json({
      agentId,
      executions,
      count: executions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get execution history', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Knowledge Graph Endpoints
// ============================================================================

/**
 * Add knowledge graph node
 * POST /api/knowledge/nodes
 */
router.post('/knowledge/nodes', async (req, res) => {
  try {
    const nodeData = req.body;

    if (!nodeData.type || !nodeData.name) {
      return res.status(400).json({
        error: 'Missing required fields: type, name'
      });
    }

    const nodeId = await graphPersistence.addNode(nodeData);

    res.status(201).json({
      id: nodeId,
      status: 'created',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to add node', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get knowledge graph node
 * GET /api/knowledge/nodes/:nodeId
 */
router.get('/knowledge/nodes/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const node = await graphPersistence.getNode(nodeId);

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const connections = await graphPersistence.getNodeConnections(nodeId);

    res.json({
      node,
      connections,
      connectionCount: connections.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get node', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search knowledge graph nodes
 * GET /api/knowledge/nodes/search/:query
 */
router.get('/knowledge/nodes/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const results = await graphPersistence.searchNodes(query, limit);

    res.json({
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to search nodes', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete knowledge graph node
 * DELETE /api/knowledge/nodes/:nodeId
 */
router.delete('/knowledge/nodes/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    await graphPersistence.removeNode(nodeId);

    res.json({
      nodeId,
      status: 'deleted',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to delete node', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add knowledge graph edge (relationship)
 * POST /api/knowledge/edges
 */
router.post('/knowledge/edges', async (req, res) => {
  try {
    const { sourceId, targetId, relationType, weight, evidence } = req.body;

    if (!sourceId || !targetId || !relationType) {
      return res.status(400).json({
        error: 'Missing required fields: sourceId, targetId, relationType'
      });
    }

    const edgeId = await graphPersistence.addEdge(
      sourceId,
      targetId,
      relationType,
      weight || 1.0,
      evidence || []
    );

    res.status(201).json({
      id: edgeId,
      status: 'created',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to add edge', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update knowledge graph edge
 * PUT /api/knowledge/edges/:edgeId
 */
router.put('/knowledge/edges/:edgeId', async (req, res) => {
  try {
    const { edgeId } = req.params;
    const { weight, evidence } = req.body;

    await graphPersistence.updateEdge(edgeId, weight, evidence);

    res.json({
      edgeId,
      status: 'updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update edge', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Query knowledge graph
 * POST /api/knowledge/query
 */
router.post('/knowledge/query', async (req, res) => {
  try {
    const { pattern } = req.body;

    if (!pattern) {
      return res.status(400).json({ error: 'Missing required field: pattern' });
    }

    const results = await graphPersistence.queryGraph(pattern);

    res.json({
      pattern,
      results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to query graph', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get knowledge graph statistics
 * GET /api/knowledge/stats
 */
router.get('/knowledge/stats', async (req, res) => {
  try {
    const stats = await graphPersistence.getGraphStats();

    res.json({
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get graph stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export knowledge graph
 * GET /api/knowledge/export
 */
router.get('/knowledge/export', async (req, res) => {
  try {
    const data = await graphPersistence.exportGraph();

    res.json(data);
  } catch (error) {
    logger.error('Failed to export graph', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Import knowledge graph
 * POST /api/knowledge/import
 */
router.post('/knowledge/import', async (req, res) => {
  try {
    const data = req.body;

    if (!data.nodes || !data.edges) {
      return res.status(400).json({
        error: 'Missing required fields: nodes, edges'
      });
    }

    await graphPersistence.importGraph(data);

    res.json({
      status: 'imported',
      nodesCount: data.nodes.length,
      edgesCount: data.edges.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to import graph', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
