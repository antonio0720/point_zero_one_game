import { describe, it, expect } from 'vitest';
import { taskbookDiff } from '../taskbook_diff';

describe('diff correctness', () => {
  it('detects add/remove/change', () => {
    const a = [
      { id: '1', title: 'Task 1' },
      { id: '2', title: 'Task 2' },
    ];

    const b = [
      { id: '1', title: 'Task 1 modified' },
      { id: '3', title: 'Task 3 added' },
    ];

    const diff = taskbookDiff(a, b);
    expect(diff).toEqual([
      {
        type: 'remove',
        item: a[1],
      },
      {
        type: 'add',
        item: b[1],
      },
      {
        type: 'change',
        oldItem: a[0],
        newItem: b[0],
      },
    ]);
  });

  it('preserves stable ordering', () => {
    const a = [
      { id: '1', title: 'Task 1' },
      { id: '2', title: 'Task 2' },
    ];

    const b = [
      { id: '2', title: 'Task 2 modified' },
      { id: '3', title: 'Task 3 added' },
    ];

    const diff = taskbookDiff(a, b);
    expect(diff).toEqual([
      {
        type: 'change',
        oldItem: a[0],
        newItem: b[0],
      },
      {
        type: 'add',
        item: b[1],
      },
    ]);
  });

  it('does not produce false positives', () => {
    const a = [
      { id: '1', title: 'Task 1' },
      { id: '2', title: 'Task 2' },
    ];

    const b = [
      { id: '1', title: 'Task 1 modified' },
      { id: '3', title: 'Task 3 added' },
    ];

    const diff = taskbookDiff(a, b);
    expect(diff).not.toEqual([
      {
        type: 'change',
        oldItem: a[0],
        newItem: b[0],
      },
      {
        type: 'add',
        item: b[1],
      },
      {
        type: 'remove',
        item: a[1],
      },
    ]);
  });
});
