// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/db/host-email-events.ts

import { randomUUID } from 'node:crypto';
import { query } from './connection';

export type HostEmailSendStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'skipped';

export type HostEmailEventType =
  | 'open'
  | 'click';

export interface HostEmailMessage {
  id: string;
  registration_id: number;
  dedupe_key: string | null;
  message_key: string;
  template_name: string;
  subject: string;
  to_email: string;
  send_status: HostEmailSendStatus;
  scheduled_for: string;
  sent_at: string | null;
  opened_at: string | null;
  open_count: number;
  click_count: number;
  last_clicked_at: string | null;
  provider_name: string | null;
  provider_message_id: string | null;
  context_json: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHostEmailMessageInput {
  registrationId: number;
  dedupeKey?: string | null;
  messageKey: string;
  templateName: string;
  subject: string;
  toEmail: string;
  scheduledFor: Date;
  contextJson: Record<string, unknown>;
}

export interface RecordHostEmailEventInput {
  messageId: string;
  registrationId: number;
  eventType: HostEmailEventType;
  linkKey?: string | null;
  targetUrl?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  referer?: string | null;
}

export async function ensureHostEmailSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS host_email_messages (
      id UUID PRIMARY KEY,
      registration_id BIGINT NOT NULL REFERENCES host_registrations(id) ON DELETE CASCADE,
      dedupe_key VARCHAR(255) NULL,
      message_key VARCHAR(128) NOT NULL,
      template_name VARCHAR(128) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      to_email VARCHAR(320) NOT NULL,
      send_status VARCHAR(32) NOT NULL DEFAULT 'queued',
      scheduled_for TIMESTAMPTZ NOT NULL,
      sent_at TIMESTAMPTZ NULL,
      opened_at TIMESTAMPTZ NULL,
      open_count INTEGER NOT NULL DEFAULT 0,
      click_count INTEGER NOT NULL DEFAULT 0,
      last_clicked_at TIMESTAMPTZ NULL,
      provider_name VARCHAR(64) NULL,
      provider_message_id VARCHAR(255) NULL,
      context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      error_message TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_host_email_messages_dedupe_key
      ON host_email_messages (dedupe_key)
      WHERE dedupe_key IS NOT NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_host_email_messages_due_queue
      ON host_email_messages (send_status, scheduled_for ASC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_host_email_messages_registration_id
      ON host_email_messages (registration_id, created_at DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS host_email_events (
      id BIGSERIAL PRIMARY KEY,
      message_id UUID NOT NULL REFERENCES host_email_messages(id) ON DELETE CASCADE,
      registration_id BIGINT NOT NULL REFERENCES host_registrations(id) ON DELETE CASCADE,
      event_type VARCHAR(32) NOT NULL,
      link_key VARCHAR(128) NULL,
      target_url TEXT NULL,
      ip_address TEXT NULL,
      user_agent TEXT NULL,
      referer TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_host_email_events_message_id
      ON host_email_events (message_id, created_at DESC);
  `);
}

export async function createHostEmailMessage(
  input: CreateHostEmailMessageInput,
): Promise<HostEmailMessage> {
  const id = randomUUID();

  if (input.dedupeKey) {
    const existing = await getHostEmailMessageByDedupeKey(input.dedupeKey);
    if (existing) {
      return existing;
    }
  }

  const result = await query<HostEmailMessage>(
    `
      INSERT INTO host_email_messages (
        id,
        registration_id,
        dedupe_key,
        message_key,
        template_name,
        subject,
        to_email,
        send_status,
        scheduled_for,
        context_json,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'queued', $8, $9::jsonb, NOW(), NOW()
      )
      RETURNING *;
    `,
    [
      id,
      input.registrationId,
      input.dedupeKey ?? null,
      input.messageKey,
      input.templateName,
      input.subject,
      input.toEmail,
      input.scheduledFor.toISOString(),
      JSON.stringify(input.contextJson),
    ],
  );

  return result.rows[0];
}

export async function getHostEmailMessageById(
  messageId: string,
): Promise<HostEmailMessage | null> {
  const result = await query<HostEmailMessage>(
    `SELECT * FROM host_email_messages WHERE id = $1 LIMIT 1`,
    [messageId],
  );

  return result.rows[0] ?? null;
}

export async function getHostEmailMessageByDedupeKey(
  dedupeKey: string,
): Promise<HostEmailMessage | null> {
  const result = await query<HostEmailMessage>(
    `SELECT * FROM host_email_messages WHERE dedupe_key = $1 LIMIT 1`,
    [dedupeKey],
  );

  return result.rows[0] ?? null;
}

export async function listDueHostEmailMessages(
  limit = 50,
): Promise<HostEmailMessage[]> {
  const result = await query<HostEmailMessage>(
    `
      SELECT *
      FROM host_email_messages
      WHERE send_status = 'queued'
        AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC, created_at ASC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

export async function markHostEmailSending(
  messageId: string,
): Promise<boolean> {
  const result = await query(
    `
      UPDATE host_email_messages
      SET send_status = 'sending', updated_at = NOW()
      WHERE id = $1
        AND send_status = 'queued'
    `,
    [messageId],
  );

  return result.rowCount > 0;
}

export async function markHostEmailSent(
  messageId: string,
  providerName: string,
  providerMessageId: string | null,
): Promise<void> {
  await query(
    `
      UPDATE host_email_messages
      SET
        send_status = 'sent',
        provider_name = $2,
        provider_message_id = $3,
        sent_at = NOW(),
        updated_at = NOW(),
        error_message = NULL
      WHERE id = $1
    `,
    [messageId, providerName, providerMessageId],
  );
}

export async function markHostEmailFailed(
  messageId: string,
  errorMessage: string,
): Promise<void> {
  await query(
    `
      UPDATE host_email_messages
      SET
        send_status = 'failed',
        error_message = $2,
        updated_at = NOW()
      WHERE id = $1
    `,
    [messageId, errorMessage.slice(0, 2_000)],
  );
}

export async function markHostEmailSkipped(
  messageId: string,
  reason: string,
): Promise<void> {
  await query(
    `
      UPDATE host_email_messages
      SET
        send_status = 'skipped',
        error_message = $2,
        updated_at = NOW()
      WHERE id = $1
    `,
    [messageId, reason.slice(0, 2_000)],
  );
}

export async function recordHostEmailEvent(
  input: RecordHostEmailEventInput,
): Promise<void> {
  await query(
    `
      INSERT INTO host_email_events (
        message_id,
        registration_id,
        event_type,
        link_key,
        target_url,
        ip_address,
        user_agent,
        referer
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      input.messageId,
      input.registrationId,
      input.eventType,
      input.linkKey ?? null,
      input.targetUrl ?? null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      input.referer ?? null,
    ],
  );

  if (input.eventType === 'open') {
    await query(
      `
        UPDATE host_email_messages
        SET
          open_count = open_count + 1,
          opened_at = COALESCE(opened_at, NOW()),
          updated_at = NOW()
        WHERE id = $1
      `,
      [input.messageId],
    );
    return;
  }

  await query(
    `
      UPDATE host_email_messages
      SET
        click_count = click_count + 1,
        last_clicked_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `,
    [input.messageId],
  );
}