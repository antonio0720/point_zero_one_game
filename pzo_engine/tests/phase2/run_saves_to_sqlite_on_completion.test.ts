import { describe, it, expect } from 'vitest';
import { runSavesToSqliteOnCompletionTest } from '../../../src/phase2/run_saves_to_sqlite_on_completion';

describe('Run saves to SQLite on completion', () => {
  it('should store seed, actions, score and hash in the database when a POST /runs request is made', async () => {
    const { db, runId } = await runSavesToSqliteOnCompletionTest();
    expect(db).not.toBeNull();
    expect(runId).not.toBeNull();

    const storedRun = await db.get('SELECT * FROM runs WHERE id = ?', [runId]);
    expect(storedRun.seed).toBe(12345);
    expect(storedRun.actions).toEqual(['action1', 'action2']);
    expect(storedRun.score).toBe(1000);
    expect(storedRun.hash).toBe('hash123');
  });
});
