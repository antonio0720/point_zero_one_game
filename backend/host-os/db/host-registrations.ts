// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/db/host-registrations.ts

import type { PoolClient } from 'pg';
import { query, withTransaction } from './connection';

export const HOST_KIT_VERSION = 'v1';

export interface HostRegistration {
  id: number;
  email: string;
  name: string;
  last_ip: string | null;
  kit_version: string;
  ghl_synced: boolean;
  download_count: number;
  first_downloaded_at: string;
  last_downloaded_at: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertHostRegistrationInput {
  email: string;
  name: string;
  ipAddress: string | null;
  kitVersion: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }

  const left = normalizeEmail(email).split('@')[0] || 'Host';
  return left
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export async function ensureHostRegistrationSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS host_registrations (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(320) NOT NULL UNIQUE,
      name TEXT NOT NULL,
      last_ip TEXT,
      kit_version VARCHAR(32) NOT NULL DEFAULT 'v1',
      ghl_synced BOOLEAN NOT NULL DEFAULT FALSE,
      download_count INTEGER NOT NULL DEFAULT 0,
      first_downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      unsubscribed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_host_registrations_last_downloaded_at
      ON host_registrations (last_downloaded_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_host_registrations_unsubscribed_at
      ON host_registrations (unsubscribed_at);
  `);
}

export async function upsertHostRegistration(
  input: UpsertHostRegistrationInput,
): Promise<HostRegistration> {
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name, email);

  const result = await query<HostRegistration>(
    `
      INSERT INTO host_registrations (
        email,
        name,
        last_ip,
        kit_version,
        ghl_synced,
        download_count,
        first_downloaded_at,
        last_downloaded_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, FALSE, 1, NOW(), NOW(), NOW())
      ON CONFLICT (email)
      DO UPDATE
      SET
        name = EXCLUDED.name,
        last_ip = EXCLUDED.last_ip,
        kit_version = EXCLUDED.kit_version,
        download_count = host_registrations.download_count + 1,
        last_downloaded_at = NOW(),
        updated_at = NOW()
      RETURNING *;
    `,
    [email, name, input.ipAddress, input.kitVersion],
  );

  return result.rows[0];
}

export async function getHostRegistrationById(
  registrationId: number,
): Promise<HostRegistration | null> {
  const result = await query<HostRegistration>(
    `SELECT * FROM host_registrations WHERE id = $1 LIMIT 1`,
    [registrationId],
  );

  return result.rows[0] ?? null;
}

export async function getHostRegistrationByEmail(
  email: string,
): Promise<HostRegistration | null> {
  const result = await query<HostRegistration>(
    `SELECT * FROM host_registrations WHERE email = $1 LIMIT 1`,
    [normalizeEmail(email)],
  );

  return result.rows[0] ?? null;
}

export async function setHostRegistrationWebhookSync(
  registrationId: number,
  synced: boolean,
  client?: PoolClient,
): Promise<void> {
  const runner = client ?? null;

  if (runner) {
    await runner.query(
      `
        UPDATE host_registrations
        SET ghl_synced = $2, updated_at = NOW()
        WHERE id = $1
      `,
      [registrationId, synced],
    );
    return;
  }

  await query(
    `
      UPDATE host_registrations
      SET ghl_synced = $2, updated_at = NOW()
      WHERE id = $1
    `,
    [registrationId, synced],
  );
}

export async function markHostRegistrationUnsubscribed(
  registrationId: number,
): Promise<void> {
  await query(
    `
      UPDATE host_registrations
      SET unsubscribed_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `,
    [registrationId],
  );
}

export async function clearHostRegistrationUnsubscribe(
  registrationId: number,
): Promise<void> {
  await query(
    `
      UPDATE host_registrations
      SET unsubscribed_at = NULL, updated_at = NOW()
      WHERE id = $1
    `,
    [registrationId],
  );
}

export async function upsertHostRegistrationAndSetWebhookSync(
  input: UpsertHostRegistrationInput,
  synced: boolean,
): Promise<HostRegistration> {
  return await withTransaction(async (client) => {
    const email = normalizeEmail(input.email);
    const name = normalizeName(input.name, email);

    const result = await client.query<HostRegistration>(
      `
        INSERT INTO host_registrations (
          email,
          name,
          last_ip,
          kit_version,
          ghl_synced,
          download_count,
          first_downloaded_at,
          last_downloaded_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW(), NOW())
        ON CONFLICT (email)
        DO UPDATE
        SET
          name = EXCLUDED.name,
          last_ip = EXCLUDED.last_ip,
          kit_version = EXCLUDED.kit_version,
          ghl_synced = $5,
          download_count = host_registrations.download_count + 1,
          last_downloaded_at = NOW(),
          updated_at = NOW()
        RETURNING *;
      `,
      [email, name, input.ipAddress, input.kitVersion, synced],
    );

    return result.rows[0];
  });
}