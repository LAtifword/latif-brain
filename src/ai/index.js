/**
 * LATIF ai Module
 * Main entry point for ai functionality
 */

// Export AI Core
export { initializeAICore, getAICore } from './ai-core.js';
export { default as aiCore } from './ai-core.js';

// Export RAG subsystem
export * from './rag/index.js';

// Export Knowledge subsystem
export * from './knowledge/index.js';

// Export Vision subsystem
export * from './vision/index.js';

// Export Agent subsystem
export * from './agents/index.js';

// Export Workflow subsystem
export * from './workflows/index.js';

export default {
  modules: {
    aiCore: 'AI Core LLM interface',
    rag: 'Retrieval-Augmented Generation',
    knowledge: 'Knowledge Graph and Semantic Reasoning',
    vision: 'Vision AI and Image Understanding',
    agents: 'Multi-Agent Orchestration',
    workflows: 'Workflow Automation and Scheduling'
  }
};
