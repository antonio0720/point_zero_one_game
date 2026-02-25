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
