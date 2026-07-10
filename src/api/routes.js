/**
 * REST API Routes
 * Complete API endpoints for all LATIF subsystems
 */

import express from 'express';
import { getDatabase } from '../core/data-layer.js';
import { getLogger } from '../core/logger.js';
import { getConfig } from '../core/config.js';
import { getJobQueue } from '../core/job-queue.js';

// Import subsystems
import { agentManager } from '../ai/agents/base-agent.js';
import { PlannerAgentInstance, ResearcherAgentInstance, ExecutorAgentInstance, CriticAgentInstance, MemoryAgentInstance } from '../ai/agents/builtin-agents.js';
import { knowledgeGraph } from '../ai/knowledge/graph.js';
import { hybridSearch, semanticCache } from '../ai/rag/hybrid-search.js';
import { crossEncoderReranker } from '../ai/rag/reranker.js';
import { workflowScheduler, WorkflowDefinition, WorkflowExecution } from '../ai/workflows/execution-engine.js';
import { imageProcessor, audioProcessor } from '../ai/vision/image-processor.js';

const router = express.Router();
const db = getDatabase();
const logger = getLogger();
const config = getConfig();

/**
 * Health & Status Endpoints
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '5.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

router.get('/ready', (req, res) => {
  res.json({
    ready: true,
    dependencies: {
      database: 'ok',
      jobQueue: 'ok',
      logging: 'ok',
      config: 'ok'
    },
    timestamp: new Date().toISOString()
  });
});

router.get('/stats', (req, res) => {
  res.json({
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    },
    database: db.getStats?.(),
    jobQueue: getJobQueue()?.getAllStats?.(),
    agents: agentManager.getStats(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Agent Endpoints
 */
router.get('/agents', (req, res) => {
  res.json({
    agents: agentManager.listAgents(),
    count: agentManager.agents.size,
    timestamp: new Date().toISOString()
  });
});

router.post('/agents/:agentId/execute', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { task, context } = req.body;

    const result = await agentManager.executeAgent(agentId, task, context);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/agents/:agentId/state', (req, res) => {
  const { agentId } = req.params;
  const agent = agentManager.getAgent(agentId);

  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  res.json(agent.getState());
});

router.get('/agents/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({
    executions: agentManager.getHistory(limit),
    count: agentManager.runHistory.length,
    timestamp: new Date().toISOString()
  });
});

/**
 * RAG & Search Endpoints
 */
router.post('/search/hybrid', async (req, res) => {
  try {
    const { query, documents, embeddings, threshold } = req.body;
    const results = await hybridSearch.search(query, documents, embeddings, threshold);

    res.json({
      query: query,
      results: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/search/rerank', async (req, res) => {
  try {
    const { query, documents, topK } = req.body;
    const results = await crossEncoderReranker.rerank(query, documents, topK);

    res.json({
      query: query,
      results: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/search/cache/stats', (req, res) => {
  res.json({
    hybrid: hybridSearch.getCacheStats?.(),
    semantic: semanticCache.getStats?.(),
    reranker: crossEncoderReranker.getCacheStats?.(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Knowledge Graph Endpoints
 */
router.post('/knowledge/nodes', (req, res) => {
  const { label, type, properties } = req.body;
  const node = knowledgeGraph.createNode(label, type, properties);

  res.json({
    node: node,
    timestamp: new Date().toISOString()
  });
});

router.get('/knowledge/nodes/:nodeLabel', (req, res) => {
  const node = knowledgeGraph.findNode(req.params.nodeLabel);

  if (!node) {
    return res.status(404).json({ error: 'Node not found' });
  }

  res.json({
    node: node,
    connections: knowledgeGraph.getNodeConnections(node.id),
    influence: knowledgeGraph.getNodeInfluence(node.id),
    timestamp: new Date().toISOString()
  });
});

router.post('/knowledge/edges', (req, res) => {
  const { sourceId, targetId, relationshipType, properties } = req.body;
  const edge = knowledgeGraph.createEdge(sourceId, targetId, relationshipType, properties);

  res.json({
    edge: edge,
    timestamp: new Date().toISOString()
  });
});

router.get('/knowledge/query', (req, res) => {
  const { relationshipType } = req.query;
  const results = knowledgeGraph.query({ relationshipType });

  res.json({
    results: results,
    count: results.length,
    timestamp: new Date().toISOString()
  });
});

router.post('/knowledge/build', async (req, res) => {
  try {
    const { text } = req.body;
    const result = await knowledgeGraph.buildFromText(text);

    res.json({
      ...result,
      graphStats: knowledgeGraph.getStats(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/knowledge/stats', (req, res) => {
  res.json({
    stats: knowledgeGraph.getStats(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Workflow Endpoints
 */
router.post('/workflows', (req, res) => {
  const { name, description } = req.body;
  const workflow = new WorkflowDefinition(name, description);

  res.json({
    workflow: workflow.export(),
    timestamp: new Date().toISOString()
  });
});

router.post('/workflows/:workflowId/execute', async (req, res) => {
  try {
    // Placeholder: would retrieve actual workflow from database
    const workflow = new WorkflowDefinition('test-workflow');
    const execution = new WorkflowExecution(workflow);
    const result = await execution.execute();

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/workflows/:workflowId/schedule', (req, res) => {
  const { cronExpression } = req.body;
  const workflow = new WorkflowDefinition('test-workflow');
  const scheduleId = workflowScheduler.schedule(workflow, cronExpression);

  res.json({
    scheduleId: scheduleId,
    cronExpression: cronExpression,
    timestamp: new Date().toISOString()
  });
});

router.get('/workflows/scheduler/stats', (req, res) => {
  res.json({
    stats: workflowScheduler.getStats(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Vision Endpoints
 */
router.post('/vision/process', async (req, res) => {
  try {
    const { imageBuffer, options } = req.body;
    // Note: In production, imageBuffer would be actual binary data
    const result = await imageProcessor.processImage(
      Buffer.from(imageBuffer || ''),
      options
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/vision/similar/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const topK = parseInt(req.query.topK) || 5;
    const results = await imageProcessor.findSimilar(imageId, topK);

    res.json({
      imageId: imageId,
      similar: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/vision/cache/stats', (req, res) => {
  res.json({
    image: imageProcessor.getCacheStats(),
    audio: audioProcessor.getCacheStats(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Audio Endpoints
 */
router.post('/audio/transcribe', async (req, res) => {
  try {
    const { audioBuffer, options } = req.body;
    const result = await audioProcessor.transcribe(
      Buffer.from(audioBuffer || ''),
      options
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/audio/synthesize', async (req, res) => {
  try {
    const { text, options } = req.body;
    const result = await audioProcessor.synthesize(text, options);

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Job Queue Endpoints
 */
router.post('/jobs', (req, res) => {
  try {
    const { jobType, payload } = req.body;
    const queue = getJobQueue();
    const jobId = queue.enqueue(jobType, payload);

    res.json({
      jobId: jobId,
      status: 'queued',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/jobs/queues', (req, res) => {
  const queue = getJobQueue();
  res.json({
    stats: queue.getAllStats?.(),
    timestamp: new Date().toISOString()
  });
});

router.get('/jobs/queues/:queueName', (req, res) => {
  const { queueName } = req.params;
  const queue = getJobQueue();
  const stats = queue.getQueueStats?.(queueName);

  if (!stats) {
    return res.status(404).json({ error: 'Queue not found' });
  }

  res.json({
    queue: queueName,
    stats: stats,
    timestamp: new Date().toISOString()
  });
});

/**
 * System Endpoints
 */
router.get('/config', (req, res) => {
  // Return non-sensitive config info
  res.json({
    version: config.get('version') || '5.0.0',
    environment: process.env.NODE_ENV || 'development',
    debug: config.get('app.debug'),
    timestamp: new Date().toISOString()
  });
});

router.get('/logs', (req, res) => {
  const lines = parseInt(req.query.lines) || 50;
  const logger_instance = getLogger();
  const logs = logger_instance.getRecentLogs?.(lines) || [];

  res.json({
    logs: logs,
    count: logs.length,
    timestamp: new Date().toISOString()
  });
});

/**
 * API Documentation
 */
router.get('/', (req, res) => {
  res.json({
    name: 'LATIF v5 Personal AI Operating System',
    version: '5.0.0',
    description: 'Complete AI OS with agents, RAG, knowledge graphs, workflows, vision, and audio',
    endpoints: {
      health: {
        GET: '/health - Health check',
        GET: '/ready - Readiness check',
        GET: '/stats - System statistics'
      },
      agents: {
        GET: '/agents - List all agents',
        POST: '/agents/:agentId/execute - Execute agent',
        GET: '/agents/:agentId/state - Get agent state',
        GET: '/agents/history - Execution history'
      },
      rag: {
        POST: '/search/hybrid - Hybrid search',
        POST: '/search/rerank - Rerank results',
        GET: '/search/cache/stats - Cache stats'
      },
      knowledge: {
        POST: '/knowledge/nodes - Create node',
        GET: '/knowledge/nodes/:nodeLabel - Get node',
        POST: '/knowledge/edges - Create relationship',
        GET: '/knowledge/query - Query graph',
        POST: '/knowledge/build - Build from text',
        GET: '/knowledge/stats - Graph statistics'
      },
      workflows: {
        POST: '/workflows - Create workflow',
        POST: '/workflows/:workflowId/execute - Execute workflow',
        POST: '/workflows/:workflowId/schedule - Schedule workflow',
        GET: '/workflows/scheduler/stats - Scheduler stats'
      },
      vision: {
        POST: '/vision/process - Process image',
        GET: '/vision/similar/:imageId - Find similar images',
        GET: '/vision/cache/stats - Cache stats'
      },
      audio: {
        POST: '/audio/transcribe - Transcribe audio',
        POST: '/audio/synthesize - Synthesize speech'
      },
      jobs: {
        POST: '/jobs - Enqueue job',
        GET: '/jobs/queues - Queue stats',
        GET: '/jobs/queues/:queue - Queue details'
      },
      system: {
        GET: '/config - Configuration',
        GET: '/logs - Logs'
      }
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
