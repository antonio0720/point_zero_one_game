import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Validator Tests', () => {
  let validator;

  beforeEach(() => {
    validator = new TaskbookValidator();
  });

  afterEach(() => {
    // Reset any state that needs to be reset for each test
  });

  it('should not allow duplicate task IDs', () => {
    const tasks = [
      { id: '1', phase: 'development', type: 'feature', title: 'Task 1' },
      { id: '1', phase: 'testing', type: 'bugfix', title: 'Task 2' },
    ];

    expect(validator.validateTasks(tasks)).toEqual([
      { id: '1', message: 'Duplicate task ID found.' },
    ]);
  });

  it('should not allow unknown phases', () => {
    const tasks = [
      { id: '1', phase: 'unknown_phase', type: 'feature', title: 'Task' },
    ];

    expect(validator.validateTasks(tasks)).toEqual([
      { phase: 'unknown_phase', message: 'Unknown phase found.' },
    ]);
  });

  it('should not allow unknown types', () => {
    const tasks = [
      { id: '1', phase: 'development', type: 'unknown_type', title: 'Task' },
    ];

    expect(validator.validateTasks(tasks)).toEqual([
      { type: 'unknown_type', message: 'Unknown task type found.' },
    ]);
  });

  it('should not allow empty inputs', () => {
    const tasks = [
      { id: '', phase: 'development', type: 'feature', title: '' },
    ];

    expect(validator.validateTasks(tasks)).toEqual([
      { id: '', message: 'Empty task ID found.' },
      { phase: '', message: 'Empty task phase found.' },
      { type: '', message: 'Empty task type found.' },
      { title: '', message: 'Empty task title found.' },
    ]);
  });

  it('should not allow non-deterministic ordering', () => {
    const tasks = [
      { id: '1', phase: 'development', type: 'feature', title: 'Task A' },
      { id: '2', phase: 'testing', type: 'bugfix', title: 'Task B' },
      { id: '3', phase: 'development', type: 'feature', title: 'Task C' },
    ];

    const shuffledTasks = [...tasks].sort(() => Math.random() - 0.5);

    expect(validator.validateTasks(shuffledTasks)).toEqual([]);
  });
});
