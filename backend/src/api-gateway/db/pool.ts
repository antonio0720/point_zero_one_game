// backend/src/api-gateway/db/pool.ts

import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.PG_URL;

if (!connectionString) {
  throw new Error(
    'Database connection string is missing. Set DATABASE_URL, POSTGRES_URL, or PG_URL.',
  );
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5_000),
  allowExitOnIdle: false,
  ssl:
    process.env.PG_SSL === 'true'
      ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : undefined,
});

pool.on('error', (error: Error) => {
  console.error('[api-gateway/db/pool] unexpected pool error', error);
});

export default pool;