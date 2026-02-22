import { describe, it, expect } from 'vitest';
import { TaskbookRunnerPreflight } from '../taskbook_runner_preflight';

describe('Taskbook Runner Preflight', () => {
  it('invoked preflight should fail if taskbook is not initialized', async () => {
    const runner = new TaskbookRunnerPreflight();
    await expect(runner.preflight()).rejects.toThrowError(
      'Taskbook is not initialized'
    );
  });

  it('failures block apply should work as expected', async () => {
    const runner = new TaskbookRunnerPreflight();
    await runner.init();

    const taskbook = runner.taskbook;
    taskbook.addBlock({
      id: 'block1',
      type: 'task',
      title: 'Task 1',
      description: '',
      status: 'pending',
    });

    const result = await runner.preflight();
    expect(result).toEqual({
      blocks: [
        {
          id: 'block1',
          type: 'task',
          title: 'Task 1',
          description: '',
          status: 'failed',
        },
      ],
    });
  });

  it('resume should work as expected', async () => {
    const runner = new TaskbookRunnerPreflight();
    await runner.init();

    const taskbook = runner.taskbook;
    taskbook.addBlock({
      id: 'block1',
      type: 'task',
      title: 'Task 1',
      description: '',
      status: 'pending',
    });

    const result = await runner.preflight();
    expect(result).toEqual({
      blocks: [
        {
          id: 'block1',
          type: 'task',
          title: 'Task 1',
          description: '',
          status: 'failed',
        },
      ],
    });

    taskbook.resumeBlock('block1');
    const result2 = await runner.preflight();
    expect(result2).toEqual({
      blocks: [
        {
          id: 'block1',
          type: 'task',
          title: 'Task 1',
          description: '',
          status: 'pending',
        },
      ],
    });
  });

  it('reports written deterministically', async () => {
    const runner = new TaskbookRunnerPreflight();
    await runner.init();

    const taskbook = runner.taskbook;
    taskbook.addBlock({
      id: 'block1',
      type: 'task',
      title: 'Task 1',
      description: '',
      status: 'pending',
    });

    const result = await runner.preflight();
    expect(result).toEqual({
      blocks: [
        {
          id: 'block1',
          type: 'task',
          title: 'Task 1',
          description: '',
          status: 'failed',
        },
      ],
    });
  });
});
