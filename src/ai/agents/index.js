/**
 * agents Module - Complete index and exports
 * Phase 3: Multi-agent framework with orchestration and memory
 */

export { Agent, AgentManager, agentManager } from './base-agent.js';
export {
  PlannerAgent,
  ResearcherAgent,
  ExecutorAgent,
  CriticAgent,
  MemoryAgent,
  PlannerAgentInstance,
  ResearcherAgentInstance,
  ExecutorAgentInstance,
  CriticAgentInstance,
  MemoryAgentInstance
} from './builtin-agents.js';
export { AgentOrchestrator, agentOrchestrator } from './agent-orchestrator.js';
export {
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  AgentMemory
} from './agent-memory.js';

export default {
  name: 'agents',
  version: '5.0.0',
  phase: 'Phase 3: Multi-Agent Framework'
};
