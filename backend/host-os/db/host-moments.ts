//backend/host-os/db/host-moments.ts

import type { QueryResultRow } from 'pg';
import { query } from './connection';

export interface HostMoment {
  id: number;
  sessionId: string;
  hostEmail: string;
  momentCode: string;
  gameSeed: string;
  tick: number;
  metadataJson: Record<string, unknown>;
  createdAt: string;
}

export interface CreateHostMomentInput {
  sessionId: string;
  hostEmail: string;
  momentCode: string;
  gameSeed: string;
  tick: number;
  metadataJson?: Record<string, unknown>;
}

interface HostMomentRow extends QueryResultRow {
  id: number;
  session_id: string;
  host_email: string;
  moment_code: string;
  game_seed: string;
  tick: number;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS host_moments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id VARCHAR(128) NOT NULL,
  host_email VARCHAR(320) NOT NULL,
  moment_code VARCHAR(128) NOT NULL,
  game_seed VARCHAR(128) NOT NULL,
  tick INTEGER NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_host_moments_identity
    UNIQUE (session_id, host_email, moment_code, game_seed, tick),
  CONSTRAINT chk_host_moments_tick_nonnegative
    CHECK (tick >= 0)
);
`;

const CREATE_INDEXES_SQL = [
  `
  CREATE INDEX IF NOT EXISTS idx_host_moments_session_created_at
  ON host_moments (session_id, created_at DESC, id DESC);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_host_moments_host_email_created_at
  ON host_moments (host_email, created_at DESC, id DESC);
  `,
] as const;

export async function ensureHostMomentSchema(): Promise<void> {
  await query(CREATE_TABLE_SQL);

  for (const statement of CREATE_INDEXES_SQL) {
    await query(statement);
  }
}

export async function createHostMoment(
  input: CreateHostMomentInput,
): Promise<HostMoment> {
  const normalized = normalizeCreateInput(input);

  const result = await query<HostMomentRow>(
    `
      INSERT INTO host_moments (
        session_id,
        host_email,
        moment_code,
        game_seed,
        tick,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (session_id, host_email, moment_code, game_seed, tick)
      DO UPDATE SET metadata_json = EXCLUDED.metadata_json
      RETURNING
        id,
        session_id,
        host_email,
        moment_code,
        game_seed,
        tick,
        metadata_json,
        created_at::text AS created_at
    `,
    [
      normalized.sessionId,
      normalized.hostEmail,
      normalized.momentCode,
      normalized.gameSeed,
      normalized.tick,
      JSON.stringify(normalized.metadataJson),
    ],
  );

  return mapHostMoment(result.rows[0]);
}

export async function listHostMomentsBySessionId(
  sessionId: string,
  limit = 250,
): Promise<readonly HostMoment[]> {
  const normalizedSessionId = normalizeRequiredString('sessionId', sessionId, 128);
  const normalizedLimit = normalizeLimit(limit);

  const result = await query<HostMomentRow>(
    `
      SELECT
        id,
        session_id,
        host_email,
        moment_code,
        game_seed,
        tick,
        metadata_json,
        created_at::text AS created_at
      FROM host_moments
      WHERE session_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [normalizedSessionId, normalizedLimit],
  );

  return result.rows.map(mapHostMoment);
}

function normalizeCreateInput(input: CreateHostMomentInput): CreateHostMomentInput {
  return {
    sessionId: normalizeRequiredString('sessionId', input.sessionId, 128),
    hostEmail: normalizeEmail(input.hostEmail),
    momentCode: normalizeRequiredString('momentCode', input.momentCode, 128),
    gameSeed: normalizeRequiredString('gameSeed', input.gameSeed, 128),
    tick: normalizeTick(input.tick),
    metadataJson: input.metadataJson ?? {},
  };
}

function normalizeRequiredString(
  fieldName: string,
  value: string,
  maxLength: number,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }

  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} exceeds max length ${maxLength}`);
  }

  return normalized;
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0 || !normalized.includes('@')) {
    throw new Error('hostEmail must be a valid email-like value');
  }

  return normalized;
}

function normalizeTick(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('tick must be a non-negative integer');
  }

  return value;
}

function normalizeLimit(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    return 250;
  }

  return Math.min(value, 1_000);
}

function mapHostMoment(row: HostMomentRow): HostMoment {
  return {
    id: row.id,
    sessionId: row.session_id,
    hostEmail: row.host_email,
    momentCode: row.moment_code,
    gameSeed: row.game_seed,
    tick: row.tick,
    metadataJson: row.metadata_json ?? {},
    createdAt: row.created_at,
  };
}
