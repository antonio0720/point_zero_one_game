// backend/src/analytics/core/analytics_types.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS CORE / SHARED TYPES
 * backend/src/analytics.ts
 *
 * Shared contracts for analytics emission, persistence, batching, and transport.
 *
 * Intent:
 * - keep domain event factories decoupled from delivery mechanics
 * - support in-memory, console, outbox, queue, and batch emitters
 * - remain compatible with Express + pg Pool + workers
 * - preserve idempotency and replay safety
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type {
  AnalyticsEnvelope,
  AnalyticsPayload,
} from './analytics_envelope';
import type { AnalyticsEventName } from './analytics_names';

export type Awaitable<T> = T | Promise<T>;

export type AnalyticsEnvelopeAny = AnalyticsEnvelope<
  AnalyticsEventName,
  AnalyticsPayload
>;

export type AnalyticsTransportKind =
  | 'inline'
  | 'memory'
  | 'console'
  | 'outbox'
  | 'queue'
  | 'batch'
  | 'noop';

export type AnalyticsDeliveryStatus =
  | 'PENDING'
  | 'ENQUEUED'
  | 'DELIVERED'
  | 'SKIPPED'
  | 'FAILED';

export interface AnalyticsLoggerLike {
  info?(message?: unknown, ...optionalParams: unknown[]): void;
  warn?(message?: unknown, ...optionalParams: unknown[]): void;
  error?(message?: unknown, ...optionalParams: unknown[]): void;
}

export interface AnalyticsEmitContext {
  /**
   * Cross-request traceability from HTTP middleware / workers.
   */
  correlationId?: string;

  /**
   * Internal origin for observability.
   */
  origin?:
    | 'http'
    | 'worker'
    | 'cron'
    | 'replay'
    | 'migration'
    | 'seed'
    | 'test'
    | 'unknown';

  /**
   * Optional transport hint. Emitters may ignore this.
   */
  preferredTransport?: AnalyticsTransportKind;

  /**
   * When true, emitter should behave idempotently where possible.
   */
  dedupe?: boolean;

  /**
   * Freeform scalar-safe tags for observability / routing.
   */
  tags?: Readonly<Record<string, string | number | boolean>>;
}

export interface AnalyticsEmitReceipt {
  eventId: string;
  eventName: string;
  transport: AnalyticsTransportKind;
  status: AnalyticsDeliveryStatus;
  emittedAt: number;
  persistedAt?: number;
  deduped?: boolean;
  errorMessage?: string;
}

export interface AnalyticsBatchEmitReceipt {
  total: number;
  successCount: number;
  failureCount: number;
  receipts: AnalyticsEmitReceipt[];
}

export interface AnalyticsEmitter {
  emit(
    envelope: AnalyticsEnvelopeAny,
    context?: AnalyticsEmitContext,
  ): Promise<AnalyticsEmitReceipt>;

  emitBatch?(
    envelopes: readonly AnalyticsEnvelopeAny[],
    context?: AnalyticsEmitContext,
  ): Promise<AnalyticsBatchEmitReceipt>;
}

export interface AnalyticsEventSerializer {
  serialize(envelope: AnalyticsEnvelopeAny): Record<string, unknown>;
}

export interface AnalyticsSqlQueryResult<
  TRow extends Record<string, unknown> = Record<string, unknown>,
> {
  rows: TRow[];
  rowCount?: number | null;
}

export interface AnalyticsSqlRunner {
  query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<AnalyticsSqlQueryResult<TRow>>;
}

export interface AnalyticsOutboxInsertOptions {
  /**
   * SQL target table. Must be schema-qualified when not in public schema.
   */
  tableName?: string;

  /**
   * If true, duplicate event IDs should be ignored rather than fail.
   */
  onConflictDoNothing?: boolean;

  /**
   * Override the status written at insert time.
   */
  initialDeliveryStatus?: AnalyticsDeliveryStatus;

  /**
   * Milliseconds since epoch. If omitted, defaults to emittedAt.
   */
  availableAt?: number;
}

export interface AnalyticsOutboxInsertResult {
  attempted: number;
  inserted: number;
  deduped: number;
  tableName: string;
  receipts: AnalyticsEmitReceipt[];
}

export interface AnalyticsOutboxWriter {
  insert(
    envelope: AnalyticsEnvelopeAny,
    options?: AnalyticsOutboxInsertOptions,
  ): Promise<AnalyticsOutboxInsertResult>;

  insertBatch(
    envelopes: readonly AnalyticsEnvelopeAny[],
    options?: AnalyticsOutboxInsertOptions,
  ): Promise<AnalyticsOutboxInsertResult>;
}

export interface AnalyticsEmitterHealth {
  name: string;
  healthy: boolean;
  transport: AnalyticsTransportKind;
  detail?: string;
}

export interface AnalyticsFlushable {
  flush(): Promise<void>;
}

export interface AnalyticsMemoryReadable {
  snapshot(): ReadonlyArray<AnalyticsEnvelopeAny>;
  clear(): void;
}

export interface AnalyticsCompositeOptions {
  /**
   * If true, emitters run sequentially in declared order.
   * If false, they run concurrently.
   */
  sequential?: boolean;

  /**
   * If true, throw when any child emitter fails.
   * If false, capture failure inside the receipt summary.
   */
  failFast?: boolean;
}

export interface AnalyticsEventFactory<
  TEnvelope extends AnalyticsEnvelopeAny = AnalyticsEnvelopeAny,
> {
  (): TEnvelope;
}

export interface AnalyticsEnvelopePredicate {
  (envelope: AnalyticsEnvelopeAny): boolean;
}