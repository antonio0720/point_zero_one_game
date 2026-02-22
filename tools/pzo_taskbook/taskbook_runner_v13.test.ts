import { describe, it, expect } from 'vitest';
import { TaskbookRunnerV13 } from '../taskbook_runner_v13';

describe('Taskbook Runner V1.3', () => {
  let runner: TaskbookRunnerV13;

  beforeEach(() => {
    runner = new TaskbookRunnerV13();
  });

  it('should initialize state correctly', async () => {
    const result = await runner.initState();
    expect(result).toEqual({
      tasks: [],
      completedTasks: [],
      skippedTasks: [],
      failedTasks: [],
      crashedTasks: [],
      phase: 'init',
    });
  });

  it('should skip completed task', async () => {
    const task = { id: 'task1', status: 'completed' };
    const result = await runner.skipCompletedTask(task);
    expect(result).toEqual({ id: 'task1', status: 'skipped' });
  });

  it('should trigger crash loop at 5 iterations', async () => {
    const task = { id: 'task1', status: 'failed' };
    for (let i = 0; i < 5; i++) {
      await runner.crashLoop(task);
    }
    expect(runner.state.failedTasks.length).toBe(5);
  });

  it('should filter tasks by phase', async () => {
    const task1 = { id: 'task1', status: 'pending', phase: 'init' };
    const task2 = { id: 'task2', status: 'running', phase: 'run' };
    runner.state.tasks.push(task1);
    runner.state.tasks.push(task2);
    const result = await runner.filterTasksByPhase('init');
    expect(result).toEqual([task1]);
  });

  it('should start from gate correctly', async () => {
    const task1 = { id: 'task1', status: 'pending' };
    const task2 = { id: 'task2', status: 'running' };
    runner.state.tasks.push(task1);
    runner.state.tasks.push(task2);
    await runner.startFromGate('task1');
    expect(runner.state.tasks[0].status).toBe('skipped');
  });

  it('should produce no files in dry-run mode', async () => {
    const result = await runner.dryRun();
    expect(result.files.length).toBe(0);
  });
});
