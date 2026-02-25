Here is the TypeScript file `fork_creator.ts` as per your specifications:

```typescript
/**
 * Creates a new fork at Tick N-Δ snapshot and generates a practice session run_id.
 * Marks the fork as NOT eligible for ladders/trophies.
 */

import { Fork, PracticeSession } from '../interfaces';
import { Database } from '../database';

/**
 * Creates a new fork with the given parameters and marks it as ineligible for ladders/trophies.
 * @param db The database instance.
 * @param tickNDelta The snapshot tick number to create the fork at.
 * @returns The created fork object.
 */
export function createFork(db: Database, tickNDelta: number): Fork {
  // Query to create a new fork in the database
  const sql = `
    INSERT INTO forks (run_id, tick_n_delta, ladder_eligible)
    VALUES (generate_uuid(), ${tickNDelta}, false)
    RETURNING *;
  `;

  // Execute the SQL query and return the created fork object
  return db.queryOne<Fork>(sql);
}

/**
 * Generates a new practice session run_id.
 * @param db The database instance.
 * @returns The generated practice session run_id.
 */
export function generatePracticeSessionRunId(db: Database): string {
  // Query to generate a new UUID for the practice session run_id
  const sql = `SELECT generate_uuid() AS run_id;`;

  // Execute the SQL query and return the generated run_id
  return db.queryOne<{ run_id: string }>(sql).run_id;
}

/**
 * Associates a practice session with the given fork.
 * @param db The database instance.
 * @param forkId The ID of the fork to associate the practice session with.
 * @param runId The ID of the practice session to associate.
 */
export function associatePracticeSessionWithFork(db: Database, forkId: number, runId: string) {
  // Query to associate a practice session with a fork in the database
  const sql = `
    INSERT INTO practice_sessions (fork_id, run_id, ladder_eligible)
    VALUES (${forkId}, '${runId}', false);
  `;

  // Execute the SQL query to associate the practice session with the fork
  db.query(sql);
}

/**
 * Creates a new practice session and associates it with the given fork.
 * @param db The database instance.
 * @param tickNDelta The snapshot tick number to create the practice session for.
 */
export function createPracticeSessionForFork(db: Database, tickNDelta: number) {
  const runId = generatePracticeSessionRunId(db);
  associatePracticeSessionWithFork(db, db.queryOne<{ id: number }>(`SELECT id FROM forks WHERE tick_n_delta = ${tickNDelta}`).id, runId);
}
