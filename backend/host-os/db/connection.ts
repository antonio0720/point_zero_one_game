// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/db/connection.ts

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function createPool(): Pool {
  const connectionString =
    process.env.HOST_OS_DATABASE_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'Missing HOST_OS_DATABASE_URL or DATABASE_URL for Host OS service.',
    );
  }

  return new Pool({
    connectionString,
    max: Number(process.env.HOST_OS_DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.HOST_OS_DB_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(
      process.env.HOST_OS_DB_CONNECT_TIMEOUT_MS || 10_000,
    ),
    ssl: isTruthy(process.env.HOST_OS_DB_SSL)
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

export function getDb(): Pool {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  return await getDb().query<T>(text, values);
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDb().connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function pingDb(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    console.error('[host-os] db ping failed', error);
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}