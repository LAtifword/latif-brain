import { jest } from '@jest/globals';
import {
  WorkflowDefinition, WorkflowExecution, WorkflowNode, WorkflowScheduler
} from '../../src/ai/workflows/execution-engine.js';

describe('Workflow execution safety', () => {
  afterEach(() => jest.restoreAllMocks());

  test('rejects cycles before invoking any task', async () => {
    const workflow = new WorkflowDefinition('Cyclic');
    const first = workflow.addNode('First', 'task');
    const second = workflow.addNode('Second', 'task');
    workflow.addEdge(first.id, second.id);
    workflow.addEdge(second.id, first.id);
    const execution = new WorkflowExecution(workflow);
    const task = jest.spyOn(execution, 'executeTask');
    const result = await execution.execute();
    expect(result.status).toBe('failed');
    expect(result.successCount).toBe(0);
    expect(task).not.toHaveBeenCalled();
    expect(result.logs.some(log => log.message.includes('Workflow contains cycle'))).toBe(true);
  });

  test('rejects disconnected tasks before invoking any task', async () => {
    const workflow = new WorkflowDefinition('Disconnected');
    workflow.addNode('First', 'task');
    workflow.addNode('Second', 'task');
    const execution = new WorkflowExecution(workflow);
    const task = jest.spyOn(execution, 'executeTask');
    expect((await execution.execute()).status).toBe('failed');
    expect(task).not.toHaveBeenCalled();
  });

  test('runs dependencies in order and preserves their results', async () => {
    const workflow = new WorkflowDefinition('Ordered');
    const first = workflow.addNode('First', 'task');
    const second = workflow.addNode('Second', 'task');
    workflow.addEdge(first.id, second.id);
    workflow.variables.set('project', 'LATIF');
    const execution = new WorkflowExecution(workflow);
    const calls = [];
    jest.spyOn(execution, 'executeTask').mockImplementation(async node => {
      calls.push(node.id);
      return { id: node.id };
    });
    const result = await execution.execute();
    expect(calls).toEqual([first.id, second.id]);
    expect(result.status).toBe('completed');
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.variables).toEqual({ project: 'LATIF' });
    expect(result.nodeExecutions.map(node => node.result)).toEqual([{ id: first.id }, { id: second.id }]);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('retries a transient task failure', async () => {
    const workflow = new WorkflowDefinition('Retry');
    const node = workflow.addNode('Task', 'task', { maxRetries: 2 });
    const execution = new WorkflowExecution(workflow);
    const task = jest.spyOn(execution, 'executeTask')
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({ value: 'recovered' });
    const result = await execution.execute();
    expect(task).toHaveBeenCalledTimes(2);
    expect(node.retryCount).toBe(1);
    expect(result.status).toBe('completed');
    expect(result.successCount).toBe(1);
  });

  test('stops dependent tasks after retry exhaustion', async () => {
    const workflow = new WorkflowDefinition('Failure');
    const first = workflow.addNode('First', 'task', { maxRetries: 2 });
    workflow.addNode('Second', 'task');
    workflow.addEdge(first.id, [...workflow.nodes.keys()][1]);
    const execution = new WorkflowExecution(workflow);
    const task = jest.spyOn(execution, 'executeTask').mockRejectedValue(new Error('Unavailable'));
    const result = await execution.execute();
    expect(task).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('failed');
    expect(result.failureCount).toBe(1);
    expect(result.successCount).toBe(0);
    expect(first.error).toBe('Unavailable');
  });

  test('evaluates conditions with workflow variables and fails closed on invalid expressions', async () => {
    const execution = new WorkflowExecution(new WorkflowDefinition('Condition'));
    execution.variables.set('count', 3);
    const node = new WorkflowNode('condition', 'Check', 'condition', { condition: 'count > 2' });
    expect(await execution.executeCondition(node)).toEqual({ condition: 'count > 2', result: true, branches: 'true' });
    expect(execution.evaluateCondition('count < 2')).toBe(false);
    expect(execution.evaluateCondition('not valid javascript !!!')).toBe(false);
  });

  test('loop bookkeeping preserves iteration order, including empty loops', async () => {
    const execution = new WorkflowExecution(new WorkflowDefinition('Loop'));
    const node = new WorkflowNode('loop', 'Loop', 'loop', { items: ['a', 'b'] });
    const result = await execution.executeLoop(node);
    expect(result.results.map(item => [item.index, item.item])).toEqual([[0, 'a'], [1, 'b']]);
    expect(result.loops).toBe(2);
    expect(execution.variables.get('_item')).toBe('b');
    expect(await execution.executeLoop(new WorkflowNode('empty', 'Empty', 'loop'))).toEqual({ loops: 0, results: [] });
  });

  test('parallel dispatch preserves result order', async () => {
    const execution = new WorkflowExecution(new WorkflowDefinition('Parallel'));
    const task = jest.spyOn(execution, 'executeTask').mockImplementation(async node => node.name);
    const result = await execution.executeParallel(new WorkflowNode('parallel', 'Parallel', 'parallel', { tasks: ['a', 'b'] }));
    expect(task).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ parallelTasks: 2, results: ['a', 'b'] });
  });

  test('node duration uses end time when completed', () => {
    const node = new WorkflowNode(null, 'Timed', 'task');
    expect(node.id).toBeTruthy();
    expect(node.getDuration()).toBeNull();
    node.startTime = 100;
    node.endTime = 125;
    expect(node.getDuration()).toBe(25);
    node.endTime = null;
    jest.spyOn(Date, 'now').mockReturnValue(150);
    expect(node.getDuration()).toBe(50);
  });
});

describe('Workflow scheduling bookkeeping', () => {
  afterEach(() => jest.restoreAllMocks());

  test.each([
    ['hourly', 3600000], ['DAILY', 86400000], ['weekly', 604800000],
    ['monthly', 2592000000], ['unknown', 3600000]
  ])('calculates the documented %s interval', (expression, interval) => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    expect(new WorkflowScheduler().calculateNextRun(expression)).toBe(1000 + interval);
  });

  test('runs only enabled due workflows and updates statistics', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const scheduler = new WorkflowScheduler();
    const workflow = new WorkflowDefinition('Scheduled');
    workflow.addNode('Task', 'task');
    const due = scheduler.schedule(workflow, 'daily');
    const future = scheduler.schedule(workflow, 'daily');
    const disabled = scheduler.schedule(workflow, 'daily');
    scheduler.schedules.get(due).nextRun = 1000;
    scheduler.schedules.get(disabled).nextRun = 0;
    scheduler.schedules.get(disabled).enabled = false;
    const execute = jest.spyOn(WorkflowExecution.prototype, 'execute').mockResolvedValue({ status: 'completed' });
    await scheduler.tick();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(scheduler.schedules.get(due).lastRun).toBe(1000);
    expect(scheduler.schedules.get(due).nextRun).toBe(86401000);
    expect(scheduler.schedules.get(future).runs).toBe(0);
    expect(scheduler.getStats()).toEqual({ totalSchedules: 3, enabledSchedules: 2, totalRuns: 1 });
  });
});
