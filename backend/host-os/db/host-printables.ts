//backend/host-os/db/host-printables.ts

import type { QueryResultRow } from 'pg';
import { query } from './connection';

export interface HostPrintable {
  id: number;
  type: string;
  title: string;
  description: string | null;
  assetUrl: string;
  enabled: boolean;
  cacheTtlSeconds: number;
  createdAt: string;
  updatedAt: string;
}

interface HostPrintableRow extends QueryResultRow {
  id: number;
  type: string;
  title: string;
  description: string | null;
  asset_url: string;
  enabled: boolean;
  cache_ttl_seconds: number;
  created_at: string;
  updated_at: string;
}

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS host_printables (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  asset_url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_host_printables_type_nonempty CHECK (btrim(type) <> ''),
  CONSTRAINT chk_host_printables_title_nonempty CHECK (btrim(title) <> ''),
  CONSTRAINT chk_host_printables_asset_url_nonempty CHECK (btrim(asset_url) <> ''),
  CONSTRAINT chk_host_printables_cache_ttl_positive CHECK (cache_ttl_seconds > 0)
);
`;

const CREATE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_host_printables_enabled_type
ON host_printables (enabled, type);
`;

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
    WHERE tgname = 'trg_host_printables_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_host_printables_touch_updated_at
    BEFORE UPDATE ON host_printables
    FOR EACH ROW
    EXECUTE FUNCTION host_os_touch_updated_at();
  END IF;
END
$$;
`;

export async function ensureHostPrintableSchema(): Promise<void> {
  await query(CREATE_TABLE_SQL);
  await query(CREATE_UPDATED_AT_FN_SQL);
  await query(CREATE_INDEX_SQL);
  await query(CREATE_TRIGGER_SQL);
}

export async function getHostPrintableByType(
  type: string,
): Promise<HostPrintable | null> {
  const normalizedType = normalizePrintableType(type);

  const result = await query<HostPrintableRow>(
    `
      SELECT
        id,
        type,
        title,
        description,
        asset_url,
        enabled,
        cache_ttl_seconds,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      FROM host_printables
      WHERE type = $1
      LIMIT 1
    `,
    [normalizedType],
  );

  return result.rows[0] ? mapHostPrintable(result.rows[0]) : null;
}

export function normalizePrintableType(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!/^[a-z0-9_-]{1,64}$/.test(normalized)) {
    throw new Error('Invalid printable type.');
  }

  return normalized;
}

function mapHostPrintable(row: HostPrintableRow): HostPrintable {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    assetUrl: row.asset_url,
    enabled: row.enabled,
    cacheTtlSeconds: row.cache_ttl_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}