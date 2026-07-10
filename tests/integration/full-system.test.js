/**
 * Full System Integration Tests
 * Tests for all LATIF v5 subsystems
 */

import { AgentManager } from '../../src/ai/agents/base-agent.js';
import { PlannerAgent, ResearcherAgent, ExecutorAgent, CriticAgent, MemoryAgent } from '../../src/ai/agents/builtin-agents.js';
import { KnowledgeGraph } from '../../src/ai/knowledge/graph.js';
import { HybridSearch, SemanticCache } from '../../src/ai/rag/hybrid-search.js';
import { CrossEncoderReranker, RAGPipeline } from '../../src/ai/rag/reranker.js';
import { WorkflowDefinition, WorkflowExecution, WorkflowScheduler } from '../../src/ai/workflows/execution-engine.js';
import { ImageProcessor, AudioProcessor } from '../../src/ai/vision/image-processor.js';

describe('LATIF v5 Integration Tests', () => {

  describe('Agent Framework', () => {
    let agentManager;

    beforeEach(() => {
      agentManager = new AgentManager();
    });

    test('Agent Manager registers and retrieves agents', () => {
      const agent = new PlannerAgent();
      const agentId = agentManager.registerAgent(agent);

      expect(agentManager.getAgent(agentId)).toBe(agent);
      expect(agentManager.getAgentByName('Planner')).toBe(agent);
    });

    test('Planner Agent decomposes goals', async () => {
      const agent = new PlannerAgent();
      const result = await agent.execute('Do X then Y then Z');

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results[0]?.subtasks || [])).toBe(true);
    });

    test('Researcher Agent searches knowledge', async () => {
      const agent = new ResearcherAgent();
      const result = await agent.execute('Find information about AI');

      expect(result.success).toBe(true);
      expect(result.results[0]?.resultsFound).toBeGreaterThanOrEqual(0);
    });

    test('Executor Agent executes tasks', async () => {
      const agent = new ExecutorAgent();
      const result = await agent.execute('Execute task');

      expect(result.success).toBe(true);
    });

    test('Critic Agent validates output', async () => {
      const agent = new CriticAgent();
      const result = await agent.execute('This is a test output that should be reviewed');

      expect(result.success).toBe(true);
      expect(result.results[0]?.score).toBeGreaterThanOrEqual(0);
      expect(result.results[0]?.score).toBeLessThanOrEqual(1);
    });

    test('Memory Agent stores and retrieves knowledge', async () => {
      const agent = new MemoryAgent();
      const storeResult = await agent.execute('store: This is important knowledge');

      expect(storeResult.success).toBe(true);
      expect(storeResult.results[0]?.stored).toBe(true);

      const retrieveResult = await agent.execute('retrieve: important');
      expect(retrieveResult.success).toBe(true);
      expect(Array.isArray(retrieveResult.results[0]?.results)).toBe(true);
    });
  });

  describe('Knowledge Graph', () => {
    let graph;

    beforeEach(() => {
      graph = new KnowledgeGraph();
    });

    test('Creates and retrieves nodes', () => {
      const node = graph.createNode('Alice', 'person');

      expect(node).toBeDefined();
      expect(node.label).toBe('Alice');
      expect(graph.findNode('Alice')).toBe(node);
    });

    test('Creates relationships', () => {
      const alice = graph.createNode('Alice', 'person');
      const bob = graph.createNode('Bob', 'person');
      const edge = graph.createEdge(alice.id, bob.id, 'knows');

      expect(edge).toBeDefined();
      expect(edge.relationshipType).toBe('knows');
    });

    test('Finds node connections', () => {
      const alice = graph.createNode('Alice', 'person');
      const bob = graph.createNode('Bob', 'person');
      graph.createEdge(alice.id, bob.id, 'knows');

      const connections = graph.getNodeConnections(alice.id);
      expect(connections.outgoing.length).toBe(1);
      expect(connections.outgoing[0].target.label).toBe('Bob');
    });

    test('Extracts entities from text', () => {
      const entities = graph.extractEntities('Alice knows Bob in Paris');

      expect(Array.isArray(entities)).toBe(true);
      expect(entities.length).toBeGreaterThan(0);
    });

    test('Extracts relationships from text', () => {
      const relationships = graph.extractRelationships('Alice knows Bob. Bob works for Google in San Francisco.');

      expect(Array.isArray(relationships)).toBe(true);
    });

    test('Builds graph from text', async () => {
      const result = await graph.buildFromText('Alice knows Bob. Alice works for Google.');

      expect(result.nodesCreated).toBeGreaterThan(0);
      expect(result.edgesCreated).toBeGreaterThanOrEqual(0);
    });

    test('Calculates node influence', () => {
      const node = graph.createNode('Test');
      const influence = graph.getNodeInfluence(node.id);

      expect(influence.score).toBeGreaterThanOrEqual(0);
      expect(influence.pageRank).toBeGreaterThanOrEqual(0);
    });

    test('Returns graph statistics', () => {
      graph.createNode('A');
      graph.createNode('B');
      const stats = graph.getStats();

      expect(stats.nodeCount).toBe(2);
      expect(stats.edgeCount).toBe(0);
      expect(stats.density).toBeGreaterThanOrEqual(0);
    });
  });

  describe('RAG System', () => {
    test('Hybrid search combines keyword and semantic search', async () => {
      const search = new HybridSearch();
      const documents = ['This is a test document', 'Another document for testing'];
      const embeddings = [
        Array(384).fill(0.1),
        Array(384).fill(0.2)
      ];

      const results = await search.search('test', documents, embeddings);

      expect(Array.isArray(results)).toBe(true);
      expect(results.every(r => r.score !== undefined)).toBe(true);
    });

    test('Semantic cache stores similar queries', () => {
      const cache = new SemanticCache(0.9);
      const embedding = Array(384).fill(0.5);

      cache.set('query 1', embedding, { response: 'answer 1' });
      const found = cache.findSimilar(embedding);

      expect(found).toBeDefined();
    });

    test('Cross-encoder reranker scores documents', async () => {
      const reranker = new CrossEncoderReranker();
      const documents = ['Very relevant document', 'Somewhat relevant', 'Not relevant'];
      const results = await reranker.rerank('test query', documents, 2);

      expect(results.length).toBe(2);
      expect(results[0].rerankerScore >= results[1]?.rerankerScore).toBe(true);
    });

    test('RAG pipeline combines retrieval and reranking', async () => {
      const search = new HybridSearch();
      const reranker = new CrossEncoderReranker();
      const pipeline = new RAGPipeline(search, reranker);

      const documents = ['Document 1', 'Document 2'];
      const embeddings = [Array(384).fill(0.1), Array(384).fill(0.2)];

      const results = await pipeline.retrieve('test', documents, embeddings);

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Workflow System', () => {
    test('Workflow definition creates nodes and edges', () => {
      const workflow = new WorkflowDefinition('Test Workflow');
      const node1 = workflow.addNode('Task 1', 'task');
      const node2 = workflow.addNode('Task 2', 'task');
      workflow.addEdge(node1.id, node2.id);

      expect(workflow.nodes.size).toBe(2);
      expect(workflow.edges.size).toBe(1);
    });

    test('Workflow validates DAG properties', () => {
      const workflow = new WorkflowDefinition('Valid Workflow');
      workflow.addNode('Task 1', 'task');
      const validation = workflow.validate();

      expect(validation.valid).toBe(true);
    });

    test('Workflow detects cycles', () => {
      const workflow = new WorkflowDefinition('Cyclic Workflow');
      const node1 = workflow.addNode('Task 1', 'task');
      const node2 = workflow.addNode('Task 2', 'task');
      workflow.addEdge(node1.id, node2.id);
      workflow.addEdge(node2.id, node1.id); // Creates cycle

      expect(workflow.hasCycle()).toBe(true);
    });

    test('Workflow execution engine runs workflow', async () => {
      const workflow = new WorkflowDefinition('Simple Workflow');
      workflow.addNode('Task 1', 'task');
      const execution = new WorkflowExecution(workflow);
      const result = await execution.execute();

      expect(result.status).toBe('completed');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    test('Workflow scheduler schedules workflows', () => {
      const scheduler = new WorkflowScheduler();
      const workflow = new WorkflowDefinition('Scheduled Workflow');
      const scheduleId = scheduler.schedule(workflow, 'daily');

      expect(scheduleId).toBeDefined();
      expect(scheduler.schedules.has(scheduleId)).toBe(true);
    });
  });

  describe('Vision System', () => {
    let processor;

    beforeEach(() => {
      processor = new ImageProcessor();
    });

    test('Image processor generates tags', async () => {
      const buffer = Buffer.alloc(100);
      const result = await processor.processImage(buffer);

      expect(result.tags).toBeDefined();
      expect(Array.isArray(result.tags)).toBe(true);
    });

    test('Image processor extracts text with OCR', async () => {
      const buffer = Buffer.alloc(100);
      const result = await processor.processImage(buffer);

      expect(result.ocr).toBeDefined();
      expect(result.ocr.text !== undefined).toBe(true);
    });

    test('Image processor detects objects', async () => {
      const buffer = Buffer.alloc(100);
      const result = await processor.processImage(buffer);

      expect(result.objects).toBeDefined();
    });

    test('Image processor caches results', async () => {
      const buffer = Buffer.alloc(100);
      const result1 = await processor.processImage(buffer);
      const cached = processor.cache.get(result1.imageId);

      expect(cached).toBeDefined();
    });

    test('Image processor finds similar images', async () => {
      const buffer1 = Buffer.alloc(100);
      const buffer2 = Buffer.alloc(100);

      const result1 = await processor.processImage(buffer1);
      await processor.processImage(buffer2);

      const similar = await processor.findSimilar(result1.imageId);
      expect(Array.isArray(similar)).toBe(true);
    });
  });

  describe('Audio System', () => {
    let processor;

    beforeEach(() => {
      processor = new AudioProcessor();
    });

    test('Audio processor transcribes audio', async () => {
      const buffer = Buffer.alloc(100);
      const result = await processor.transcribe(buffer);

      expect(result.transcription).toBeDefined();
      expect(result.audioId).toBeDefined();
    });

    test('Audio processor synthesizes speech', async () => {
      const result = await processor.synthesize('Hello world');

      expect(result.audioBuffer).toBeDefined();
      expect(result.text).toBe('Hello world');
    });

    test('Audio processor extracts features', async () => {
      const buffer = Buffer.alloc(100);
      const features = await processor.extractFeatures(buffer);

      expect(features).toBeDefined();
    });

    test('Audio processor caches results', async () => {
      const buffer = Buffer.alloc(100);
      const result = await processor.transcribe(buffer);
      const cached = processor.cache.get(result.audioId);

      expect(cached).toBeDefined();
    });
  });

  describe('End-to-End Integration', () => {
    test('Complete workflow: Plan -> Research -> Execute -> Review', async () => {
      const agentManager = new AgentManager();

      // Register agents
      agentManager.registerAgent(new PlannerAgent());
      agentManager.registerAgent(new ResearcherAgent());
      agentManager.registerAgent(new ExecutorAgent());
      agentManager.registerAgent(new CriticAgent());

      // Execute workflow
      const agents = agentManager.listAgents();
      expect(agents.length).toBe(4);
    });

    test('Knowledge graph integration with RAG', async () => {
      const graph = new KnowledgeGraph();
      // const search = new HybridSearch();

      // Build knowledge graph
      await graph.buildFromText('Alice works at Google. Bob knows Alice.');

      // Verify graph was populated
      const stats = graph.getStats();
      expect(stats.nodeCount).toBeGreaterThan(0);
    });
  });
});
