/**
 * Workflows Module - Workflow automation and orchestration
 * Phase 6: DSL, execution engine, scheduling, and templates
 */

// DSL Classes
export {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowBuilder
} from './workflow-dsl.js';

// Execution Classes
export {
  WorkflowEngine,
  ExecutionState,
  ExecutionContext
} from './workflow-engine.js';

// Scheduling Classes
export {
  ScheduledWorkflow,
  WorkflowScheduler
} from './workflow-scheduler.js';

// Templates
export {
  createDailyResearchWorkflow,
  createDocumentProcessingWorkflow,
  createBackupSyncWorkflow,
  createContentGenerationWorkflow,
  createNotificationWorkflow,
  createMaintenanceWorkflow,
  getWorkflowTemplate,
  listAvailableTemplates
} from './workflow-templates.js';

// Singletons
export { workflowEngine } from './workflow-engine.js';
export { workflowScheduler } from './workflow-scheduler.js';
