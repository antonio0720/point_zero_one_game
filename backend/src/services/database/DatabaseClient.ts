/**
 * DatabaseClient — Singleton PostgreSQL wrapper.
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/services/database/DatabaseClient.ts
 *
 * Provides the exact surface the telemetry service calls:
 *   - query<T>(sql, params)
 *   - insertTelemetry(metric)
 *   - beginTransaction() / commitTransaction() / rollbackTransaction()
 */

import { Pool, PoolClient } from 'pg';
import { Metric } from '../telemetry/index';

// ── Connection pool ────────────────────────────────────────────────────────────

const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME     ?? 'point_zero_one',
  user:     process.env.DB_USER     ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  max:      parseInt(process.env.DB_POOL_MAX ?? '20', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// ── Active transaction client (per async context) ─────────────────────────────
// NOTE: For production multi-request concurrency, replace with AsyncLocalStorage.
// This singleton works correctly when transactions are serialised (e.g. queued jobs,
// or when Nest's request-scoped providers ensure one active tx per request).
let txClient: PoolClient | null = null;

// ── Public API ─────────────────────────────────────────────────────────────────

export const DatabaseClient = {
  /**
   * Execute a parameterized SQL query.
   * Uses the active transaction client when inside beginTransaction(),
   * otherwise acquires a connection from the pool.
   */
  async query<T = Record<string, unknown>>(
    sql:    string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const client = txClient ?? pool;
    const result = await client.query<T>(sql, params);
    return result.rows;
  },

  /**
   * Inserts a single telemetry metric into the `telemetry` table.
   */
  async insertTelemetry(metric: Metric): Promise<void> {
    await DatabaseClient.query(
      `INSERT INTO telemetry (game_id, player_id, event_type, event_data, timestamp)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT DO NOTHING`,
      [
        metric.gameId,
        metric.playerId,
        metric.eventType,
        JSON.stringify(metric.eventData),
        metric.timestamp,
      ],
    );
  },

  /** Opens a transaction. Must be paired with commit or rollback. */
  async beginTransaction(): Promise<void> {
    if (txClient) throw new Error('DatabaseClient: transaction already active');
    txClient = await pool.connect();
    await txClient.query('BEGIN');
  },

  async commitTransaction(): Promise<void> {
    if (!txClient) throw new Error('DatabaseClient: no active transaction to commit');
    await txClient.query('COMMIT');
    txClient.release();
    txClient = null;
  },

  async rollbackTransaction(): Promise<void> {
    if (!txClient) return; // nothing to roll back
    try {
      await txClient.query('ROLLBACK');
    } finally {
      txClient.release();
      txClient = null;
    }
  },

  /** Gracefully drain the pool (call on process shutdown). */
  async end(): Promise<void> {
    await pool.end();
  },
};