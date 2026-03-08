/**
 * Point Zero One — Host OS Database Connection Spine
 * File: backend/host-os/db/connection.ts
 *
 * Purpose:
 * - Centralized PostgreSQL pool creation and lifecycle management
 * - Typed query helpers
 * - Writable-primary enforcement for write-capable Host OS flows
 * - Transaction wrapper with strict transaction option validation
 * - Topology inspection for health and operational diagnostics
 *
 * Notes:
 * - Keeps the public API already used by Host OS sibling modules
 * - Adds safer connection-string validation and SSL inference
 * - Remains dependency-neutral: no new packages required
 */

import { URL } from 'node:url';
import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type IsolationLevel =
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

export interface HostOsDbConfig {
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

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const CONNECTION_STRING_ENV_ORDER = [
  'HOST_OS_DATABASE_URL',
  'DATABASE_URL',
  'POSTGRES_URL',
  'PG_URL',
] as const;

const DEFAULT_APPLICATION_NAME = 'pzo-host-os';
const DEFAULT_POOL_MAX = 20;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_QUERY_TIMEOUT_MS = 15_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_USES = 10_000;

const READINESS_PROBE_SQL = 'SELECT 1';
const PING_SQL = 'SELECT 1 AS ok';

const TOPOLOGY_SQL = `
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
`;

let configCache: HostOsDbConfig | null = null;
let pool: Pool | null = null;
let startupGate: Promise<void> | null = null;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function getDbConfig(): HostOsDbConfig {
  if (configCache) {
    return configCache;
  }

  const connectionString = resolveConnectionString();

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

export async function query<
  TRow extends QueryResultRow = QueryResultRow,
>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<TRow>> {
  await ensureDbReady();
  return await getDb().query<TRow>(text, [...values]);
}

export async function queryOneOrNull<
  TRow extends QueryResultRow = QueryResultRow,
>(
  text: string,
  values: readonly unknown[] = [],
): Promise<TRow | null> {
  const result = await query<TRow>(text, values);
  return result.rows[0] ?? null;
}

export async function queryOneOrThrow<
  TRow extends QueryResultRow = QueryResultRow,
>(
  text: string,
  values: readonly unknown[] = [],
  errorMessage = 'Expected at least one row but query returned none.',
): Promise<TRow> {
  const row = await queryOneOrNull<TRow>(text, values);

  if (!row) {
    throw new Error(errorMessage);
  }

  return row;
}

export async function execute(
  text: string,
  values: readonly unknown[] = [],
): Promise<number> {
  const result = await query(text, values);
  return result.rowCount ?? 0;
}

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

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  validateTransactionOptions(options);

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

export async function pingDb(): Promise<boolean> {
  try {
    await ensureDbReady();
    const result = await getDb().query<{ ok: number }>(PING_SQL);
    return result.rows[0]?.ok === 1;
  } catch (error) {
    console.error('[host-os][db] ping failed', error);
    return false;
  }
}

export async function getDbTopology(): Promise<DbTopology> {
  return await withClient(async (client) => {
    return await fetchTopology(client);
  });
}

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

export async function closeDb(): Promise<void> {
  const activePool = pool;

  startupGate = null;
  pool = null;

  if (!activePool) {
    return;
  }

  await activePool.end();
}

export async function resetDbForTests(): Promise<void> {
  await closeDb();
  configCache = null;
}

// -----------------------------------------------------------------------------
// Readiness + Topology
// -----------------------------------------------------------------------------

async function ensureDbReady(): Promise<void> {
  if (startupGate) {
    return await startupGate;
  }

  startupGate = (async () => {
    const client = await getDb().connect();

    try {
      await client.query(READINESS_PROBE_SQL);

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
  const result = await client.query<TopologyRow>(TOPOLOGY_SQL);
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

// -----------------------------------------------------------------------------
// Pool / Transaction Builders
// -----------------------------------------------------------------------------

function buildPoolConfig(config: HostOsDbConfig): PoolConfig {
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

function validateTransactionOptions(options: TransactionOptions): void {
  if (options.deferrable === undefined) {
    return;
  }

  if (options.readOnly !== true || options.isolationLevel !== 'SERIALIZABLE') {
    throw new Error(
      'Transaction option "deferrable" requires readOnly=true and isolationLevel="SERIALIZABLE".',
    );
  }
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

// -----------------------------------------------------------------------------
// Error Builders
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Connection String + SSL Resolution
// -----------------------------------------------------------------------------

function resolveConnectionString(): string {
  for (const envName of CONNECTION_STRING_ENV_ORDER) {
    const value = normalizeOptionalString(process.env[envName]);

    if (!value) {
      continue;
    }

    assertValidPostgresConnectionString(value, envName);
    return value;
  }

  throw new Error(
    `Missing ${CONNECTION_STRING_ENV_ORDER.join(', ')} for Host OS service.`,
  );
}

function assertValidPostgresConnectionString(
  connectionString: string,
  fieldName: string,
): void {
  try {
    const parsed = new URL(connectionString);

    if (
      parsed.protocol !== 'postgres:' &&
      parsed.protocol !== 'postgresql:'
    ) {
      throw new Error(
        `${fieldName} must use postgres:// or postgresql:// protocol.`,
      );
    }

    if (!parsed.hostname) {
      throw new Error(`${fieldName} must include a hostname.`);
    }

    if (!parsed.pathname || parsed.pathname === '/') {
      throw new Error(`${fieldName} must include a database name.`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error(`${fieldName} must be a valid postgres connection string.`);
  }
}

function resolveSslConfig(
  connectionString: string,
): PoolConfig['ssl'] | undefined {
  const explicitSsl = normalizeOptionalString(process.env.HOST_OS_DB_SSL);
  const sslMode = resolveSslMode(connectionString);

  const enabled =
    explicitSsl !== null
      ? normalizeBooleanEnv(explicitSsl, false)
      : inferSslEnabledFromMode(sslMode);

  if (!enabled) {
    return undefined;
  }

  const defaultRejectUnauthorized =
    sslMode === 'verify-ca' || sslMode === 'verify-full';

  const rejectUnauthorized = normalizeBooleanEnv(
    process.env.HOST_OS_DB_SSL_REJECT_UNAUTHORIZED,
    defaultRejectUnauthorized,
  );

  return { rejectUnauthorized };
}

function resolveSslMode(connectionString: string): string | null {
  try {
    const url = new URL(connectionString);
    return url.searchParams.get('sslmode')?.trim().toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function inferSslEnabledFromMode(sslMode: string | null): boolean {
  if (!sslMode) {
    return false;
  }

  return (
    sslMode === 'allow' ||
    sslMode === 'prefer' ||
    sslMode === 'require' ||
    sslMode === 'verify-ca' ||
    sslMode === 'verify-full'
  );
}

// -----------------------------------------------------------------------------
// Normalizers
// -----------------------------------------------------------------------------

function normalizeOptionalString(rawValue: string | undefined): string | null {
  const value = rawValue?.trim() ?? '';
  return value.length > 0 ? value : null;
}

function normalizeBooleanEnv(
  rawValue: string | undefined,
  defaultValue: boolean,
): boolean {
  if (rawValue === undefined || rawValue.trim().length === 0) {
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