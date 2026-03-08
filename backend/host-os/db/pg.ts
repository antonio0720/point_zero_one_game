/**
 * POINT ZERO ONE — HOST OS — POSTGRESQL RUNTIME
 * backend/host-os/db/pg.ts
 *
 * Production posture:
 * - Application connects to the app-facing writable endpoint (typically PgBouncer
 *   on the primary node).
 * - Standby routing, WAL shipping, backup/restore, and object storage remain
 *   infrastructure concerns outside of application DAO modules.
 *
 * Design goals:
 * - strict types
 * - no `any`
 * - singleton pool
 * - parameterized queries only
 * - explicit writable-primary validation for write-heavy Host OS flows
 * - low-friction compatibility with existing Host OS imports and call sites
 *
 * Density6 LLC · Point Zero One · Host OS · Confidential
 */

import { URL } from 'node:url';
import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

export type IsolationLevel =
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

export interface HostOsPgConfig {
  connectionString: string;
  applicationName: string;
  poolMax: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  queryTimeoutMs: number;
  statementTimeoutMs: number;
  maxUses: number;
  keepAlive: boolean;
  requireWritablePrimary: boolean;
  ssl: PoolConfig['ssl'] | undefined;
}

export interface DbTopology {
  databaseName: string;
  currentUser: string;
  applicationName: string | null;
  transactionReadOnly: boolean;
  inRecovery: boolean;
  serverAddress: string | null;
  serverPort: number | null;
  observedAtUtc: string;
}

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
  deferrable?: boolean;
}

interface TopologyRow extends QueryResultRow {
  database_name: string;
  current_user_name: string;
  application_name: string | null;
  transaction_read_only: 'on' | 'off';
  in_recovery: boolean;
  server_address: string | null;
  server_port: number | null;
  observed_at_utc: string;
}

const DEFAULT_APPLICATION_NAME = 'pzo-host-os';
const DEFAULT_POOL_MAX = 20;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_QUERY_TIMEOUT_MS = 15_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_USES = 10_000;

let configCache: HostOsPgConfig | null = null;
let pool: Pool | null = null;
let startupGate: Promise<void> | null = null;

/**
 * Returns the resolved DB config used by Host OS.
 */
export function getDbConfig(): HostOsPgConfig {
  if (configCache) {
    return configCache;
  }

  const connectionString =
    process.env.HOST_OS_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.PG_URL?.trim();

  if (!connectionString) {
    throw new Error(
      'Missing HOST_OS_DATABASE_URL, DATABASE_URL, POSTGRES_URL, or PG_URL for Host OS.',
    );
  }

  configCache = {
    connectionString,
    applicationName: normalizeNonEmptyString(
      process.env.HOST_OS_DB_APPLICATION_NAME,
      DEFAULT_APPLICATION_NAME,
    ),
    poolMax: normalizeIntegerEnv(
      process.env.HOST_OS_DB_POOL_MAX,
      DEFAULT_POOL_MAX,
      'HOST_OS_DB_POOL_MAX',
      { min: 1, max: 500 },
    ),
    idleTimeoutMs: normalizeIntegerEnv(
      process.env.HOST_OS_DB_IDLE_TIMEOUT_MS,
      DEFAULT_IDLE_TIMEOUT_MS,
      'HOST_OS_DB_IDLE_TIMEOUT_MS',
      { min: 1_000, max: 3_600_000 },
    ),
    connectionTimeoutMs: normalizeIntegerEnv(
      process.env.HOST_OS_DB_CONNECT_TIMEOUT_MS,
      DEFAULT_CONNECTION_TIMEOUT_MS,
      'HOST_OS_DB_CONNECT_TIMEOUT_MS',
      { min: 250, max: 300_000 },
    ),
    queryTimeoutMs: normalizeIntegerEnv(
      process.env.HOST_OS_DB_QUERY_TIMEOUT_MS,
      DEFAULT_QUERY_TIMEOUT_MS,
      'HOST_OS_DB_QUERY_TIMEOUT_MS',
      { min: 250, max: 3_600_000 },
    ),
    statementTimeoutMs: normalizeIntegerEnv(
      process.env.HOST_OS_DB_STATEMENT_TIMEOUT_MS,
      DEFAULT_STATEMENT_TIMEOUT_MS,
      'HOST_OS_DB_STATEMENT_TIMEOUT_MS',
      { min: 250, max: 3_600_000 },
    ),
    maxUses: normalizeIntegerEnv(
      process.env.HOST_OS_DB_MAX_USES,
      DEFAULT_MAX_USES,
      'HOST_OS_DB_MAX_USES',
      { min: 1, max: 10_000_000 },
    ),
    keepAlive: normalizeBooleanEnv(process.env.HOST_OS_DB_KEEPALIVE, true),
    requireWritablePrimary: normalizeBooleanEnv(
      process.env.HOST_OS_DB_REQUIRE_WRITABLE,
      true,
    ),
    ssl: resolveSslConfig(connectionString),
  };

  return configCache;
}

/**
 * Returns the singleton pg Pool.
 */
export function getDb(): Pool {
  if (pool) {
    return pool;
  }

  const config = getDbConfig();

  pool = new Pool(buildPoolConfig(config));
  pool.on('error', (error: Error) => {
    console.error('[host-os][db] unexpected pool error', error);
  });

  return pool;
}

/**
 * Executes a parameterized query after one-time startup validation.
 */
export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  await ensureDbReady();
  return await getDb().query<Row>(text, [...values]);
}

/**
 * Executes a parameterized query and returns the first row or null.
 */
export async function queryOneOrNull<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<Row | null> {
  const result = await query<Row>(text, values);
  return result.rows[0] ?? null;
}

/**
 * Executes a parameterized query and returns the first row or throws.
 */
export async function queryOneOrThrow<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
  errorMessage = 'Expected at least one row but query returned none.',
): Promise<Row> {
  const row = await queryOneOrNull<Row>(text, values);
  if (!row) {
    throw new Error(errorMessage);
  }

  return row;
}

/**
 * Executes a statement and returns the affected row count.
 */
export async function execute(
  text: string,
  values: readonly unknown[] = [],
): Promise<number> {
  const result = await query(text, values);
  return result.rowCount ?? 0;
}

/**
 * Runs work using a checked-out client.
 */
export async function withClient<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  await ensureDbReady();

  const client = await getDb().connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
}

/**
 * Runs work inside a database transaction.
 */
export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  return await withClient(async (client) => {
    const beginSql = buildBeginSql(options);

    try {
      await client.query(beginSql);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[host-os][db] rollback failed', rollbackError);
      }
      throw error;
    }
  });
}

/**
 * Returns true when the DB is reachable and satisfies writable-primary policy.
 */
export async function pingDb(): Promise<boolean> {
  try {
    await ensureDbReady();
    const result = await getDb().query<{ ok: number }>('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  } catch (error) {
    console.error('[host-os][db] ping failed', error);
    return false;
  }
}

/**
 * Returns observed server topology information.
 */
export async function getDbTopology(): Promise<DbTopology> {
  return await withClient(async (client) => {
    return await fetchTopology(client);
  });
}

/**
 * Ensures the connected endpoint is writable and not in recovery.
 *
 * Useful for boot-time safety in a topology where the app must never bind to a
 * standby or read-only endpoint.
 */
export async function assertWritablePrimary(
  client?: PoolClient,
): Promise<DbTopology> {
  if (client) {
    return await assertWritablePrimaryWithClient(client);
  }

  return await withClient(async (ownedClient) => {
    return await assertWritablePrimaryWithClient(ownedClient);
  });
}

/**
 * Closes the singleton pool cleanly.
 */
export async function closeDb(): Promise<void> {
  const activePool = pool;

  startupGate = null;
  pool = null;

  if (!activePool) {
    return;
  }

  await activePool.end();
}

/**
 * Test-only helper to fully reset singleton state.
 */
export async function resetDbForTests(): Promise<void> {
  await closeDb();
  configCache = null;
}

/**
 * One-time readiness gate.
 *
 * First-use validation is cached on success. Failures clear the cache so callers
 * can retry after infra or secret fixes.
 */
async function ensureDbReady(): Promise<void> {
  if (startupGate) {
    return await startupGate;
  }

  startupGate = (async () => {
    const client = await getDb().connect();

    try {
      await client.query('SELECT 1');

      if (getDbConfig().requireWritablePrimary) {
        await assertWritablePrimaryWithClient(client);
      }
    } finally {
      client.release();
    }
  })().catch((error: unknown) => {
    startupGate = null;
    throw error;
  });

  return await startupGate;
}

async function assertWritablePrimaryWithClient(
  client: PoolClient,
): Promise<DbTopology> {
  const topology = await fetchTopology(client);

  if (topology.inRecovery) {
    throw new Error(
      buildWritablePrimaryError(
        'Connected endpoint reports pg_is_in_recovery() = true.',
        topology,
      ),
    );
  }

  if (topology.transactionReadOnly) {
    throw new Error(
      buildWritablePrimaryError(
        "Connected endpoint reports transaction_read_only = 'on'.",
        topology,
      ),
    );
  }

  return topology;
}

async function fetchTopology(client: PoolClient): Promise<DbTopology> {
  const result = await client.query<TopologyRow>(`
    SELECT
      current_database() AS database_name,
      current_user AS current_user_name,
      current_setting('application_name', true) AS application_name,
      current_setting('transaction_read_only') AS transaction_read_only,
      pg_is_in_recovery() AS in_recovery,
      inet_server_addr()::text AS server_address,
      inet_server_port() AS server_port,
      to_char(
        NOW() AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ) AS observed_at_utc
  `);

  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to read database topology.');
  }

  return {
    databaseName: row.database_name,
    currentUser: row.current_user_name,
    applicationName: row.application_name,
    transactionReadOnly: row.transaction_read_only === 'on',
    inRecovery: row.in_recovery,
    serverAddress: row.server_address,
    serverPort: row.server_port,
    observedAtUtc: row.observed_at_utc,
  };
}

function buildPoolConfig(config: HostOsPgConfig): PoolConfig {
  return {
    connectionString: config.connectionString,
    application_name: config.applicationName,
    max: config.poolMax,
    idleTimeoutMillis: config.idleTimeoutMs,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    query_timeout: config.queryTimeoutMs,
    statement_timeout: config.statementTimeoutMs,
    keepAlive: config.keepAlive,
    maxUses: config.maxUses,
    ssl: config.ssl,
  };
}

function buildBeginSql(options: TransactionOptions): string {
  const parts: string[] = [];

  if (options.isolationLevel) {
    parts.push(`ISOLATION LEVEL ${options.isolationLevel}`);
  }

  parts.push(options.readOnly ? 'READ ONLY' : 'READ WRITE');

  if (options.deferrable === true) {
    parts.push('DEFERRABLE');
  } else if (options.deferrable === false) {
    parts.push('NOT DEFERRABLE');
  }

  return parts.length > 0 ? `BEGIN ${parts.join(' ')}` : 'BEGIN';
}

function buildWritablePrimaryError(
  reason: string,
  topology: DbTopology,
): string {
  const endpoint =
    topology.serverAddress && topology.serverPort
      ? `${topology.serverAddress}:${topology.serverPort}`
      : 'unknown-endpoint';

  return [
    '[host-os][db] Refusing to operate against a non-writable database endpoint.',
    reason,
    `Observed endpoint=${endpoint}`,
    `database=${topology.databaseName}`,
    `user=${topology.currentUser}`,
    `application=${topology.applicationName ?? 'unknown'}`,
    `inRecovery=${String(topology.inRecovery)}`,
    `transactionReadOnly=${String(topology.transactionReadOnly)}`,
    'Point Host OS at the writable primary/PgBouncer endpoint and retry.',
  ].join(' ');
}

function resolveSslConfig(
  connectionString: string,
): PoolConfig['ssl'] | undefined {
  const explicitSsl = process.env.HOST_OS_DB_SSL;
  const rejectUnauthorized = normalizeBooleanEnv(
    process.env.HOST_OS_DB_SSL_REJECT_UNAUTHORIZED,
    false,
  );

  const enabled = explicitSsl !== undefined
    ? normalizeBooleanEnv(explicitSsl, false)
    : inferSslFromConnectionString(connectionString);

  if (!enabled) {
    return undefined;
  }

  return { rejectUnauthorized };
}

function inferSslFromConnectionString(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get('sslmode')?.toLowerCase() ?? null;

    if (!sslmode) {
      return false;
    }

    return (
      sslmode === 'require' ||
      sslmode === 'prefer' ||
      sslmode === 'verify-ca' ||
      sslmode === 'verify-full'
    );
  } catch {
    return false;
  }
}

function normalizeBooleanEnv(
  rawValue: string | undefined,
  defaultValue: boolean,
): boolean {
  if (rawValue === undefined) {
    return defaultValue;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  ) {
    return true;
  }

  if (
    normalized === '0' ||
    normalized === 'false' ||
    normalized === 'no' ||
    normalized === 'off'
  ) {
    return false;
  }

  throw new Error(`Invalid boolean environment value: "${rawValue}"`);
}

function normalizeIntegerEnv(
  rawValue: string | undefined,
  defaultValue: number,
  fieldName: string,
  bounds: { min: number; max: number },
): number {
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  if (parsed < bounds.min || parsed > bounds.max) {
    throw new Error(
      `${fieldName} must be between ${bounds.min} and ${bounds.max}.`,
    );
  }

  return parsed;
}

function normalizeNonEmptyString(
  rawValue: string | undefined,
  defaultValue: string,
): string {
  const value = rawValue?.trim() || defaultValue;
  if (value.length === 0) {
    throw new Error('Database application name must not be empty.');
  }

  return value;
}