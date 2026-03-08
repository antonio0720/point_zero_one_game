//backend/host-os/db/host-invites.ts

import type { QueryResultRow } from 'pg';
import { query } from './connection';

export interface HostInvite {
  id: number;
  token: string;
  sessionId: string | null;
  hostEmail: string;
  hostName: string | null;
  sessionAt: string | null;
  sessionFormat: string | null;
  openedAt: string | null;
  rsvpAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

interface HostInviteRow extends QueryResultRow {
  id: number;
  token: string;
  session_id: string | null;
  host_email: string;
  host_name: string | null;
  session_at: string | null;
  session_format: string | null;
  opened_at: string | null;
  rsvp_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS host_invites (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token VARCHAR(128) NOT NULL UNIQUE,
  session_id VARCHAR(128) NULL,
  host_email VARCHAR(320) NOT NULL,
  host_name VARCHAR(160) NULL,
  session_at TIMESTAMPTZ NULL,
  session_format VARCHAR(64) NULL,
  opened_at TIMESTAMPTZ NULL,
  rsvp_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_host_invites_token_nonempty CHECK (btrim(token) <> ''),
  CONSTRAINT chk_host_invites_email_nonempty CHECK (btrim(host_email) <> '')
);
`;

const CREATE_INDEXES_SQL = [
  `
  CREATE INDEX IF NOT EXISTS idx_host_invites_host_email_created_at
  ON host_invites (host_email, created_at DESC, id DESC);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_host_invites_expires_at
  ON host_invites (expires_at ASC, id ASC);
  `,
] as const;

const CREATE_UPDATED_AT_FN_SQL = `
CREATE OR REPLACE FUNCTION host_os_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
`;

const CREATE_TRIGGER_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_host_invites_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_host_invites_touch_updated_at
    BEFORE UPDATE ON host_invites
    FOR EACH ROW
    EXECUTE FUNCTION host_os_touch_updated_at();
  END IF;
END
$$;
`;

export async function ensureHostInviteSchema(): Promise<void> {
  await query(CREATE_TABLE_SQL);
  await query(CREATE_UPDATED_AT_FN_SQL);

  for (const statement of CREATE_INDEXES_SQL) {
    await query(statement);
  }

  await query(CREATE_TRIGGER_SQL);
}

export async function getHostInviteByToken(
  token: string,
): Promise<HostInvite | null> {
  const normalizedToken = normalizeToken(token);

  const result = await query<HostInviteRow>(
    `
      SELECT
        id,
        token,
        session_id,
        host_email,
        host_name,
        session_at::text AS session_at,
        session_format,
        opened_at::text AS opened_at,
        rsvp_at::text AS rsvp_at,
        expires_at::text AS expires_at,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      FROM host_invites
      WHERE token = $1
      LIMIT 1
    `,
    [normalizedToken],
  );

  return result.rows[0] ? mapHostInvite(result.rows[0]) : null;
}

export async function markHostInviteOpened(
  token: string,
): Promise<HostInvite | null> {
  const normalizedToken = normalizeToken(token);

  const result = await query<HostInviteRow>(
    `
      UPDATE host_invites
      SET opened_at = COALESCE(opened_at, NOW())
      WHERE token = $1
      RETURNING
        id,
        token,
        session_id,
        host_email,
        host_name,
        session_at::text AS session_at,
        session_format,
        opened_at::text AS opened_at,
        rsvp_at::text AS rsvp_at,
        expires_at::text AS expires_at,
        created_at::text AS created_at,
        updated_at::text AS updated_at
    `,
    [normalizedToken],
  );

  return result.rows[0] ? mapHostInvite(result.rows[0]) : null;
}

export async function markHostInviteRsvp(
  token: string,
): Promise<HostInvite | null> {
  const normalizedToken = normalizeToken(token);

  const result = await query<HostInviteRow>(
    `
      UPDATE host_invites
      SET
        opened_at = COALESCE(opened_at, NOW()),
        rsvp_at = COALESCE(rsvp_at, NOW())
      WHERE token = $1
      RETURNING
        id,
        token,
        session_id,
        host_email,
        host_name,
        session_at::text AS session_at,
        session_format,
        opened_at::text AS opened_at,
        rsvp_at::text AS rsvp_at,
        expires_at::text AS expires_at,
        created_at::text AS created_at,
        updated_at::text AS updated_at
    `,
    [normalizedToken],
  );

  return result.rows[0] ? mapHostInvite(result.rows[0]) : null;
}

export function isHostInviteExpired(invite: HostInvite): boolean {
  const expiresAtMs = Date.parse(invite.expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= Date.now();
}

function normalizeToken(value: string): string {
  const normalized = value.trim();

  if (!/^[A-Za-z0-9_-]{16,128}$/.test(normalized)) {
    throw new Error('Invalid invite token.');
  }

  return normalized;
}

function mapHostInvite(row: HostInviteRow): HostInvite {
  return {
    id: row.id,
    token: row.token,
    sessionId: row.session_id,
    hostEmail: row.host_email,
    hostName: row.host_name,
    sessionAt: row.session_at,
    sessionFormat: row.session_format,
    openedAt: row.opened_at,
    rsvpAt: row.rsvp_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}