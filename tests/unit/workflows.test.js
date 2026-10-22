import { WorkflowDefinition } from '../../src/ai/workflows/execution-engine.js';

describe('WorkflowDefinition validation', () => {
  test('accepts a single task without edges', () => {
    const workflow = new WorkflowDefinition('One task');
    const task = workflow.addNode('Read document', 'task');
    expect(workflow.validate()).toEqual({ valid: true, errors: [] });
    expect(workflow.getExecutionOrder()).toEqual([task]);
  });

  test('accepts a connected multi-task DAG', () => {
    const workflow = new WorkflowDefinition('Connected tasks');
    const first = workflow.addNode('Read', 'task');
    const second = workflow.addNode('Summarize', 'task');
    workflow.addEdge(first.id, second.id);
    expect(workflow.validate().valid).toBe(true);
    expect(workflow.getExecutionOrder()).toEqual([first, second]);
  });

  test('still rejects an isolated node alongside connected tasks', () => {
    const workflow = new WorkflowDefinition('Orphan task');
    const first = workflow.addNode('Read', 'task');
    const second = workflow.addNode('Summarize', 'task');
    workflow.addEdge(first.id, second.id);
    workflow.addNode('Unconnected', 'task');
    expect(workflow.validate()).toEqual({
      valid: false, errors: ['Node Unconnected is orphaned']
    });
  });

  test('still rejects a cycle and a self-loop', () => {
    const workflow = new WorkflowDefinition('Cycle');
    const first = workflow.addNode('First', 'task');
    const second = workflow.addNode('Second', 'task');
    workflow.addEdge(first.id, second.id);
    workflow.addEdge(second.id, first.id);
    expect(workflow.validate().errors).toContain('Workflow contains cycle');
    const single = new WorkflowDefinition('Self loop');
    const task = single.addNode('Task', 'task');
    single.addEdge(task.id, task.id);
    expect(single.validate().errors).toContain('Workflow contains cycle');
  });
});
