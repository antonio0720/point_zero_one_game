// backend/src/analytics/core/analytics_outbox_emitter.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS CORE / POSTGRES OUTBOX EMITTER
 * backend/src/analytics/core/analytics_outbox_emitter.ts
 *
 * Postgres-backed outbox writer and emitter for replay-safe analytics delivery.
 *
 * Why this exists:
 * - writes authoritative analytics events to your own Postgres first
 * - supports idempotent inserts by event_id
 * - cleanly separates domain event creation from transport fan-out
 * - preserves sovereign control: DB is source of truth, providers are edges
 *
 * Assumed table shape (recommended migration target):
 *   analytics.event_outbox (
 *     event_id           uuid primary key,
 *     event_name         text not null,
 *     schema_version     integer not null,
 *     occurred_at        timestamptz not null,
 *     emitted_at         timestamptz not null,
 *     source             text not null,
 *     correlation_id     uuid null,
 *     causation_id       uuid null,
 *     player_id          text null,
 *     game_instance_id   text null,
 *     run_id             text null,
 *     session_id         text null,
 *     season_id          text null,
 *     mode               text null,
 *     run_phase          text null,
 *     run_outcome        text null,
 *     cord               double precision null,
 *     grade              text null,
 *     integrity_status   text null,
 *     proof_hash         text null,
 *     ruleset_version    text null,
 *     content_version    text null,
 *     visibility_scope   text null,
 *     metadata           jsonb null,
 *     payload            jsonb not null,
 *     delivery_status    text not null default 'PENDING',
 *     retry_count        integer not null default 0,
 *     available_at       timestamptz not null default now(),
 *     last_error         text null,
 *     created_at         timestamptz not null default now()
 *   )
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  serializeAnalyticsEnvelope,
  type AnalyticsEnvelopeAny,
} from './analytics_envelope';

import type {
  AnalyticsBatchEmitReceipt,
  AnalyticsDeliveryStatus,
  AnalyticsEmitContext,
  AnalyticsEmitReceipt,
  AnalyticsEmitter,
  AnalyticsOutboxInsertOptions,
  AnalyticsOutboxInsertResult,
  AnalyticsOutboxWriter,
  AnalyticsSqlRunner,
} from './analytics_types';

const DEFAULT_OUTBOX_TABLE = 'analytics.event_outbox';
const SAFE_TABLE_NAME_REGEX = /^(?:[A-Za-z_][A-Za-z0-9_]*\.)?[A-Za-z_][A-Za-z0-9_]*$/;

interface InsertedRow {
  event_id: string;
}

function assertSafeTableName(tableName: string): string {
  const normalized = tableName.trim();
  if (!SAFE_TABLE_NAME_REGEX.test(normalized)) {
    throw new Error(
      `Unsafe outbox table name "${tableName}". Expected schema.table or table.`,
    );
  }

  return normalized;
}

function toTimestampExpressionPlaceholder(index: number): string {
  return `to_timestamp($${index}::double precision / 1000.0)`;
}

function buildPendingStatus(
  value?: AnalyticsDeliveryStatus,
): AnalyticsDeliveryStatus {
  return value ?? 'PENDING';
}

function buildReceipt(
  envelope: AnalyticsEnvelopeAny,
  status: AnalyticsEmitReceipt['status'],
  transport: AnalyticsEmitReceipt['transport'],
  persistedAt?: number,
  deduped?: boolean,
  errorMessage?: string,
): AnalyticsEmitReceipt {
  return {
    eventId: envelope.eventId,
    eventName: envelope.eventName,
    status,
    transport,
    emittedAt: Date.now(),
    persistedAt,
    deduped,
    errorMessage,
  };
}

function envelopeIdsAsStrings(envelope: AnalyticsEnvelopeAny): {
  playerId?: string;
  gameInstanceId?: string;
  runId?: string;
} {
  return {
    playerId:
      envelope.playerId !== undefined ? String(envelope.playerId) : undefined,
    gameInstanceId:
      envelope.gameInstanceId !== undefined
        ? String(envelope.gameInstanceId)
        : undefined,
    runId: envelope.runId !== undefined ? String(envelope.runId) : undefined,
  };
}

export class PgAnalyticsOutboxWriter implements AnalyticsOutboxWriter {
  constructor(
    private readonly runner: AnalyticsSqlRunner,
    private readonly defaultTableName: string = DEFAULT_OUTBOX_TABLE,
  ) {}

  async insert(
    envelope: AnalyticsEnvelopeAny,
    options: AnalyticsOutboxInsertOptions = {},
  ): Promise<AnalyticsOutboxInsertResult> {
    return this.insertBatch([envelope], options);
  }

  async insertBatch(
    envelopes: readonly AnalyticsEnvelopeAny[],
    options: AnalyticsOutboxInsertOptions = {},
  ): Promise<AnalyticsOutboxInsertResult> {
    if (envelopes.length === 0) {
      return {
        attempted: 0,
        inserted: 0,
        deduped: 0,
        tableName: assertSafeTableName(
          options.tableName ?? this.defaultTableName,
        ),
        receipts: [],
      };
    }

    const tableName = assertSafeTableName(
      options.tableName ?? this.defaultTableName,
    );

    const onConflictDoNothing = options.onConflictDoNothing ?? true;
    const initialDeliveryStatus = buildPendingStatus(
      options.initialDeliveryStatus,
    );

    const values: unknown[] = [];
    const rowSql: string[] = [];

    for (const envelope of envelopes) {
      const ids = envelopeIdsAsStrings(envelope);
      const metadata = envelope.metadata ?? null;
      const payload = envelope.payload ?? {};
      const serialized = serializeAnalyticsEnvelope(envelope);
      const availableAt = options.availableAt ?? envelope.emittedAt;

      const offset = values.length;

      values.push(
        envelope.eventId, // 1
        envelope.eventName, // 2
        envelope.schemaVersion, // 3
        envelope.occurredAt, // 4
        envelope.emittedAt, // 5
        envelope.source, // 6
        envelope.correlationId ?? null, // 7
        envelope.causationId ?? null, // 8
        ids.playerId ?? null, // 9
        ids.gameInstanceId ?? null, // 10
        ids.runId ?? null, // 11
        envelope.sessionId ?? null, // 12
        envelope.seasonId ?? null, // 13
        envelope.mode ?? null, // 14
        envelope.runPhase ?? null, // 15
        envelope.runOutcome ?? null, // 16
        envelope.cord ?? null, // 17
        envelope.grade ?? null, // 18
        envelope.integrityStatus ?? null, // 19
        envelope.proofHash ?? null, // 20
        envelope.rulesetVersion ?? null, // 21
        envelope.contentVersion ?? null, // 22
        envelope.visibilityScope ?? null, // 23
        JSON.stringify(metadata), // 24
        JSON.stringify(payload), // 25
        initialDeliveryStatus, // 26
        0, // 27 retry_count
        availableAt, // 28
        null, // 29 last_error
        JSON.stringify(serialized), // 30 raw envelope snapshot
      );

      rowSql.push(
        `(
          $${offset + 1},
          $${offset + 2},
          $${offset + 3},
          ${toTimestampExpressionPlaceholder(offset + 4)},
          ${toTimestampExpressionPlaceholder(offset + 5)},
          $${offset + 6},
          $${offset + 7},
          $${offset + 8},
          $${offset + 9},
          $${offset + 10},
          $${offset + 11},
          $${offset + 12},
          $${offset + 13},
          $${offset + 14},
          $${offset + 15},
          $${offset + 16},
          $${offset + 17},
          $${offset + 18},
          $${offset + 19},
          $${offset + 20},
          $${offset + 21},
          $${offset + 22},
          $${offset + 23},
          $${offset + 24}::jsonb,
          $${offset + 25}::jsonb,
          $${offset + 26},
          $${offset + 27},
          ${toTimestampExpressionPlaceholder(offset + 28)},
          $${offset + 29},
          $${offset + 30}::jsonb
        )`,
      );
    }

    const sql = `
      INSERT INTO ${tableName} (
        event_id,
        event_name,
        schema_version,
        occurred_at,
        emitted_at,
        source,
        correlation_id,
        causation_id,
        player_id,
        game_instance_id,
        run_id,
        session_id,
        season_id,
        mode,
        run_phase,
        run_outcome,
        cord,
        grade,
        integrity_status,
        proof_hash,
        ruleset_version,
        content_version,
        visibility_scope,
        metadata,
        payload,
        delivery_status,
        retry_count,
        available_at,
        last_error,
        envelope
      )
      VALUES
      ${rowSql.join(',\n')}
      ${
        onConflictDoNothing
          ? 'ON CONFLICT (event_id) DO NOTHING'
          : ''
      }
      RETURNING event_id
    `;

    const result = await this.runner.query<InsertedRow>(sql, values);
    const insertedIds = new Set((result.rows ?? []).map((row) => row.event_id));
    const inserted = insertedIds.size;
    const attempted = envelopes.length;
    const deduped = Math.max(0, attempted - inserted);
    const persistedAt = Date.now();

    const receipts = envelopes.map((envelope) =>
      insertedIds.has(envelope.eventId)
        ? buildReceipt(
            envelope,
            'ENQUEUED',
            'outbox',
            persistedAt,
            false,
          )
        : buildReceipt(
            envelope,
            onConflictDoNothing ? 'SKIPPED' : 'FAILED',
            'outbox',
            persistedAt,
            onConflictDoNothing,
            onConflictDoNothing
              ? undefined
              : 'Outbox insert failed due to duplicate or conflict.',
          ),
    );

    return {
      attempted,
      inserted,
      deduped,
      tableName,
      receipts,
    };
  }
}

export interface AnalyticsOutboxEmitterOptions {
  tableName?: string;
  onConflictDoNothing?: boolean;
  initialDeliveryStatus?: AnalyticsDeliveryStatus;
}

export class AnalyticsOutboxEmitter implements AnalyticsEmitter {
  constructor(
    private readonly writer: AnalyticsOutboxWriter,
    private readonly options: AnalyticsOutboxEmitterOptions = {},
  ) {}

  async emit(
    envelope: AnalyticsEnvelopeAny,
    _context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsEmitReceipt> {
    const result = await this.writer.insert(envelope, this.options);
    return (
      result.receipts[0] ??
      buildReceipt(
        envelope,
        'FAILED',
        'outbox',
        Date.now(),
        false,
        'Outbox writer returned no receipt.',
      )
    );
  }

  async emitBatch(
    envelopes: readonly AnalyticsEnvelopeAny[],
    _context: AnalyticsEmitContext = {},
  ): Promise<AnalyticsBatchEmitReceipt> {
    const result = await this.writer.insertBatch(envelopes, this.options);

    let successCount = 0;
    let failureCount = 0;

    for (const receipt of result.receipts) {
      if (receipt.status === 'FAILED') {
        failureCount += 1;
      } else {
        successCount += 1;
      }
    }

    return {
      total: result.receipts.length,
      successCount,
      failureCount,
      receipts: result.receipts,
    };
  }
}

export function createPgAnalyticsOutboxWriter(
  runner: AnalyticsSqlRunner,
  defaultTableName: string = DEFAULT_OUTBOX_TABLE,
): PgAnalyticsOutboxWriter {
  return new PgAnalyticsOutboxWriter(runner, defaultTableName);
}