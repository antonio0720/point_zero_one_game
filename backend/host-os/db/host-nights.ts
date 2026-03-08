/**
 * POINT ZERO ONE — HOST OS — HOST NIGHTS DATA ACCESS
 * backend/host-os/db/host-nights.ts
 *
 * PostgreSQL-backed persistence module for host gameplay nights.
 *
 * Why this replaces the current file:
 * - The current repo file is corrupted prose/markdown, not executable TypeScript.
 * - Host OS depends on `pg`, not SQLite or Sequelize.
 * - This module is strict-mode safe, has no `any`, exports public symbols,
 *   and is production-ready for direct use from routes/services.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import type { QueryResult, QueryResultRow } from 'pg';

/**
 * Minimal query executor contract compatible with `pg.Pool` and `pg.PoolClient`.
 */
export interface SqlExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

/**
 * Public domain model for a host night record.
 */
export interface HostNight {
  id: number;
  hostEmail: string;
  date: Date;
  format: string;
  momentsCaptured: number;
  clipsPosted: number;
  nextDateBooked: Date | null;
  playerCount: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input required to create a host night.
 */
export interface CreateHostNightInput {
  hostEmail: string;
  date?: Date | string;
  format: string;
  momentsCaptured: number;
  clipsPosted: number;
  nextDateBooked?: Date | string | null;
  playerCount: number;
  notes?: string | null;
}

/**
 * Partial update payload for an existing host night.
 */
export interface UpdateHostNightInput {
  date?: Date | string;
  format?: string;
  momentsCaptured?: number;
  clipsPosted?: number;
  nextDateBooked?: Date | string | null;
  playerCount?: number;
  notes?: string | null;
}

/**
 * Query options for listing host nights.
 */
export interface ListHostNightsOptions {
  limit?: number;
  offset?: number;
}

/**
 * Raw database row shape.
 */
interface HostNightRow extends QueryResultRow {
  id: number;
  host_email: string;
  night_at: Date | string;
  format: string;
  moments_captured: number;
  clips_posted: number;
  next_date_booked: Date | string | null;
  player_count: number;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Table DDL for host nights.
 *
 * Notes:
 * - Uses PostgreSQL identity PK, not SQLite AUTOINCREMENT.
 * - `host_email` is indexed, not unique: one host can have many nights.
 * - `night_at` is timestamptz to preserve precise event time.
 * - Timestamps are managed in SQL for consistency.
 */
export const CREATE_HOST_NIGHTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS host_nights (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  host_email TEXT NOT NULL,
  night_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  format TEXT NOT NULL,
  moments_captured INTEGER NOT NULL DEFAULT 0 CHECK (moments_captured >= 0),
  clips_posted INTEGER NOT NULL DEFAULT 0 CHECK (clips_posted >= 0),
  next_date_booked TIMESTAMPTZ NULL,
  player_count INTEGER NOT NULL CHECK (player_count >= 0),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Supporting indexes for read-heavy operations.
 */
export const CREATE_HOST_NIGHTS_INDEXES_SQL: readonly string[] = [
  `
  CREATE INDEX IF NOT EXISTS idx_host_nights_host_email
  ON host_nights (host_email);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_host_nights_night_at_desc
  ON host_nights (night_at DESC);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_host_nights_next_date_booked
  ON host_nights (next_date_booked)
  WHERE next_date_booked IS NOT NULL;
  `,
] as const;

/**
 * Base projection used across all reads.
 */
const HOST_NIGHTS_SELECT = `
SELECT
  id,
  host_email,
  night_at,
  format,
  moments_captured,
  clips_posted,
  next_date_booked,
  player_count,
  notes,
  created_at,
  updated_at
FROM host_nights
`;

/**
 * Ensures the host_nights table and its indexes exist.
 *
 * Call this once during Host OS startup or migrations bootstrap.
 */
export async function ensureHostNightsTable(db: SqlExecutor): Promise<void> {
  await db.query(CREATE_HOST_NIGHTS_TABLE_SQL);

  for (const statement of CREATE_HOST_NIGHTS_INDEXES_SQL) {
    await db.query(statement);
  }
}

/**
 * Inserts a new host night row and returns the created record.
 */
export async function insertHostNight(
  db: SqlExecutor,
  input: CreateHostNightInput,
): Promise<HostNight> {
  const normalized = normalizeCreateInput(input);

  const result = await db.query<HostNightRow>(
    `
    INSERT INTO host_nights (
      host_email,
      night_at,
      format,
      moments_captured,
      clips_posted,
      next_date_booked,
      player_count,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id,
      host_email,
      night_at,
      format,
      moments_captured,
      clips_posted,
      next_date_booked,
      player_count,
      notes,
      created_at,
      updated_at
    `,
    [
      normalized.hostEmail,
      normalized.date,
      normalized.format,
      normalized.momentsCaptured,
      normalized.clipsPosted,
      normalized.nextDateBooked,
      normalized.playerCount,
      normalized.notes,
    ],
  );

  return mapHostNightRow(result.rows[0]);
}

/**
 * Fetches a host night by primary key.
 */
export async function getHostNightById(
  db: SqlExecutor,
  id: number,
): Promise<HostNight | null> {
  assertPositiveInteger('id', id);

  const result = await db.query<HostNightRow>(
    `
    ${HOST_NIGHTS_SELECT}
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapHostNightRow(result.rows[0]);
}

/**
 * Lists host nights for a single host email, newest first.
 */
export async function listHostNightsByHost(
  db: SqlExecutor,
  hostEmail: string,
  options: ListHostNightsOptions = {},
): Promise<readonly HostNight[]> {
  const normalizedHostEmail = normalizeEmail(hostEmail);
  const limit = normalizeLimit(options.limit);
  const offset = normalizeOffset(options.offset);

  const result = await db.query<HostNightRow>(
    `
    ${HOST_NIGHTS_SELECT}
    WHERE host_email = $1
    ORDER BY night_at DESC, id DESC
    LIMIT $2
    OFFSET $3
    `,
    [normalizedHostEmail, limit, offset],
  );

  return result.rows.map(mapHostNightRow);
}

/**
 * Lists upcoming booked-next-date rows for outreach / scheduling workflows.
 */
export async function listUpcomingHostNights(
  db: SqlExecutor,
  options: ListHostNightsOptions = {},
): Promise<readonly HostNight[]> {
  const limit = normalizeLimit(options.limit);
  const offset = normalizeOffset(options.offset);

  const result = await db.query<HostNightRow>(
    `
    ${HOST_NIGHTS_SELECT}
    WHERE next_date_booked IS NOT NULL
    ORDER BY next_date_booked ASC, id ASC
    LIMIT $1
    OFFSET $2
    `,
    [limit, offset],
  );

  return result.rows.map(mapHostNightRow);
}

/**
 * Updates a host night and returns the updated row.
 *
 * Returns `null` when the record does not exist.
 */
export async function updateHostNight(
  db: SqlExecutor,
  id: number,
  patch: UpdateHostNightInput,
): Promise<HostNight | null> {
  assertPositiveInteger('id', id);

  const assignments: string[] = [];
  const values: unknown[] = [];
  let parameterIndex = 1;

  if (patch.date !== undefined) {
    assignments.push(`night_at = $${parameterIndex}`);
    values.push(parseDateInput('date', patch.date));
    parameterIndex += 1;
  }

  if (patch.format !== undefined) {
    assignments.push(`format = $${parameterIndex}`);
    values.push(normalizeNonEmptyString('format', patch.format));
    parameterIndex += 1;
  }

  if (patch.momentsCaptured !== undefined) {
    assignments.push(`moments_captured = $${parameterIndex}`);
    values.push(assertNonNegativeInteger('momentsCaptured', patch.momentsCaptured));
    parameterIndex += 1;
  }

  if (patch.clipsPosted !== undefined) {
    assignments.push(`clips_posted = $${parameterIndex}`);
    values.push(assertNonNegativeInteger('clipsPosted', patch.clipsPosted));
    parameterIndex += 1;
  }

  if (patch.nextDateBooked !== undefined) {
    assignments.push(`next_date_booked = $${parameterIndex}`);
    values.push(parseNullableDateInput('nextDateBooked', patch.nextDateBooked));
    parameterIndex += 1;
  }

  if (patch.playerCount !== undefined) {
    assignments.push(`player_count = $${parameterIndex}`);
    values.push(assertNonNegativeInteger('playerCount', patch.playerCount));
    parameterIndex += 1;
  }

  if (patch.notes !== undefined) {
    assignments.push(`notes = $${parameterIndex}`);
    values.push(normalizeNullableText(patch.notes));
    parameterIndex += 1;
  }

  if (assignments.length === 0) {
    return getHostNightById(db, id);
  }

  assignments.push(`updated_at = NOW()`);
  values.push(id);

  const result = await db.query<HostNightRow>(
    `
    UPDATE host_nights
    SET ${assignments.join(', ')}
    WHERE id = $${parameterIndex}
    RETURNING
      id,
      host_email,
      night_at,
      format,
      moments_captured,
      clips_posted,
      next_date_booked,
      player_count,
      notes,
      created_at,
      updated_at
    `,
    values,
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapHostNightRow(result.rows[0]);
}

/**
 * Deletes a host night by id.
 *
 * Returns true when a row was deleted, false otherwise.
 */
export async function deleteHostNight(
  db: SqlExecutor,
  id: number,
): Promise<boolean> {
  assertPositiveInteger('id', id);

  const result = await db.query(
    `
    DELETE FROM host_nights
    WHERE id = $1
    `,
    [id],
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Counts all host night rows for a host.
 */
export async function countHostNightsByHost(
  db: SqlExecutor,
  hostEmail: string,
): Promise<number> {
  const normalizedHostEmail = normalizeEmail(hostEmail);

  const result = await db.query<{ total: string }>(
    `
    SELECT COUNT(*)::text AS total
    FROM host_nights
    WHERE host_email = $1
    `,
    [normalizedHostEmail],
  );

  return Number.parseInt(result.rows[0]?.total ?? '0', 10);
}

/**
 * Maps a raw SQL row to the public HostNight model.
 */
export function mapHostNightRow(row: HostNightRow): HostNight {
  return {
    id: row.id,
    hostEmail: row.host_email,
    date: coerceDate('night_at', row.night_at),
    format: row.format,
    momentsCaptured: row.moments_captured,
    clipsPosted: row.clips_posted,
    nextDateBooked: coerceNullableDate(row.next_date_booked),
    playerCount: row.player_count,
    notes: row.notes,
    createdAt: coerceDate('created_at', row.created_at),
    updatedAt: coerceDate('updated_at', row.updated_at),
  };
}

/**
 * Validates and normalizes create input.
 */
function normalizeCreateInput(input: CreateHostNightInput): {
  hostEmail: string;
  date: Date;
  format: string;
  momentsCaptured: number;
  clipsPosted: number;
  nextDateBooked: Date | null;
  playerCount: number;
  notes: string | null;
} {
  return {
    hostEmail: normalizeEmail(input.hostEmail),
    date: input.date === undefined ? new Date() : parseDateInput('date', input.date),
    format: normalizeNonEmptyString('format', input.format),
    momentsCaptured: assertNonNegativeInteger('momentsCaptured', input.momentsCaptured),
    clipsPosted: assertNonNegativeInteger('clipsPosted', input.clipsPosted),
    nextDateBooked: parseNullableDateInput('nextDateBooked', input.nextDateBooked),
    playerCount: assertNonNegativeInteger('playerCount', input.playerCount),
    notes: normalizeNullableText(input.notes),
  };
}

/**
 * Normalizes an email address.
 */
function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    throw new Error('hostEmail must not be empty');
  }

  if (!normalized.includes('@')) {
    throw new Error('hostEmail must be a valid email-like value');
  }

  return normalized;
}

/**
 * Validates a required non-empty string.
 */
function normalizeNonEmptyString(fieldName: string, value: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }

  return normalized;
}

/**
 * Normalizes nullable freeform text.
 */
function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Parses a required date input.
 */
function parseDateInput(fieldName: string, value: Date | string): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return parsed;
}

/**
 * Parses a nullable date input.
 */
function parseNullableDateInput(
  fieldName: string,
  value: Date | string | null | undefined,
): Date | null {
  if (value === undefined || value === null) {
    return null;
  }

  return parseDateInput(fieldName, value);
}

/**
 * Coerces a database value into a Date.
 */
function coerceDate(fieldName: string, value: Date | string): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Database returned invalid ${fieldName} value`);
  }

  return parsed;
}

/**
 * Coerces a nullable database date.
 */
function coerceNullableDate(value: Date | string | null): Date | null {
  if (value === null) {
    return null;
  }

  return coerceDate('nullable_date', value);
}

/**
 * Ensures an integer is non-negative.
 */
function assertNonNegativeInteger(fieldName: string, value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  return value;
}

/**
 * Ensures an integer is positive.
 */
function assertPositiveInteger(fieldName: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return value;
}

/**
 * Normalizes a LIMIT value.
 */
function normalizeLimit(value: number | undefined): number {
  if (value === undefined) {
    return 50;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('limit must be a positive integer');
  }

  return Math.min(value, 500);
}

/**
 * Normalizes an OFFSET value.
 */
function normalizeOffset(value: number | undefined): number {
  if (value === undefined) {
    return 0;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error('offset must be a non-negative integer');
  }

  return value;
}