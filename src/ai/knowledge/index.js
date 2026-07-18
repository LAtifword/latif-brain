/**
 * Knowledge Graph Module - Phase 4
 * Entity linking, semantic reasoning, and knowledge consolidation
 */

export { GraphNode, GraphEdge, KnowledgeGraph, knowledgeGraph } from './graph.js';
export { EntityLinker, entityLinker } from './entity-linker.js';
export { ReasoningRule, GraphReasoningEngine, graphReasoningEngine } from './graph-reasoning.js';
export { KnowledgeConsolidator, knowledgeConsolidator } from './knowledge-consolidator.js';
export { KnowledgeOrchestrator, knowledgeOrchestrator } from './knowledge-orchestrator.js';

export default {
  name: 'knowledge',
  version: '5.0.0',
  phase: 'Phase 4: Knowledge Graphs with Entity Linking and Semantic Reasoning'
};
