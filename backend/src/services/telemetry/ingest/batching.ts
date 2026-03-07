/**
 * Point Zero One — Telemetry Ingest Batching
 * Path: backend/src/services/telemetry/ingest/batching.ts
 *
 * Clean-room rebuild for quarantined module.
 *
 * Goals:
 * - deterministic, memory-safe telemetry batching
 * - idempotency window support
 * - byte and item thresholds
 * - flush-by-age orchestration
 * - no external dependencies
 */

export type TelemetryEnvelopeVersion = 'v2' | 'v3';
export type FlushReason = 'capacity' | 'bytes' | 'age' | 'manual' | 'partition-change' | 'shutdown';

export interface TelemetryEnvelope {
  version: TelemetryEnvelopeVersion;
  tenantId: string;
  stream: string;
  eventName: string;
  occurredAt: string;
  sessionId?: string | null;
  actorId?: string | null;
  deviceId?: string | null;
  sequence?: number | null;
  idempotencyKey?: string | null;
  payload: Record<string, unknown>;
  tags?: string[];
}

export interface TelemetryBatchingOptions {
  maxItems: number;
  maxBytes: number;
  maxAgeMs: number;
  dedupeWindowMs: number;
}

export interface TelemetryBatchStats {
  itemCount: number;
  byteCount: number;
  duplicateDrops: number;
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
}

export interface TelemetryBatch {
  id: string;
  partitionKey: string;
  openedAt: string;
  closedAt: string;
  flushReason: FlushReason;
  envelopes: TelemetryEnvelope[];
  stats: TelemetryBatchStats;
  integrityHash: string;
}

export interface BatchAppendResult {
  accepted: boolean;
  duplicate: boolean;
  flushedBatch: TelemetryBatch | null;
  activeBatchId: string;
  activePartitionKey: string;
  activeItemCount: number;
  activeByteCount: number;
}

export interface TelemetryBatcherSnapshot {
  activeBatchId: string;
  partitionKey: string;
  itemCount: number;
  byteCount: number;
  openedAt: string;
  duplicateWindowSize: number;
}

const DEFAULT_OPTIONS: TelemetryBatchingOptions = {
  maxItems: 250,
  maxBytes: 512 * 1024,
  maxAgeMs: 5_000,
  dedupeWindowMs: 60_000,
};

interface MutableTelemetryBatch {
  id: string;
  partitionKey: string;
  openedAt: string;
  envelopes: TelemetryEnvelope[];
  stats: TelemetryBatchStats;
}

export class TelemetryBatcher {
  private readonly options: TelemetryBatchingOptions;
  private readonly now: () => Date;
  private readonly idPrefix: string;
  private active: MutableTelemetryBatch;
  private readonly dedupeExpirations = new Map<string, number>();

  constructor(options: Partial<TelemetryBatchingOptions> = {}, now?: () => Date, idPrefix = 'pzo') {
    this.options = { ...DEFAULT_OPTIONS, ...sanitizeOptions(options) };
    this.now = now ?? (() => new Date());
    this.idPrefix = idPrefix;
    this.active = this.createEmptyBatch('unassigned');
  }

  append(envelope: TelemetryEnvelope): BatchAppendResult {
    const normalized = normalizeEnvelope(envelope);
    this.sweepExpiredDedupeEntries();

    const partitionKey = buildPartitionKey(normalized);
    if (this.active.envelopes.length > 0 && partitionKey !== this.active.partitionKey) {
      const flushedBatch = this.flush('partition-change');
      this.active = this.createEmptyBatch(partitionKey);
      return this.acceptIntoActive(normalized, flushedBatch);
    }

    if (this.active.partitionKey === 'unassigned') {
      this.active = this.createEmptyBatch(partitionKey);
    }

    if (this.isDuplicate(normalized)) {
      this.active.stats.duplicateDrops += 1;
      return {
        accepted: false,
        duplicate: true,
        flushedBatch: null,
        activeBatchId: this.active.id,
        activePartitionKey: this.active.partitionKey,
        activeItemCount: this.active.stats.itemCount,
        activeByteCount: this.active.stats.byteCount,
      };
    }

    const projectedItemCount = this.active.stats.itemCount + 1;
    const projectedByteCount = this.active.stats.byteCount + estimateEnvelopeBytes(normalized);

    if (projectedItemCount > this.options.maxItems || projectedByteCount > this.options.maxBytes) {
      const flushedBatch = this.flush(projectedItemCount > this.options.maxItems ? 'capacity' : 'bytes');
      this.active = this.createEmptyBatch(partitionKey);
      return this.acceptIntoActive(normalized, flushedBatch);
    }

    return this.acceptIntoActive(normalized, null);
  }

  flushIfExpired(): TelemetryBatch | null {
    if (this.active.envelopes.length === 0) {
      return null;
    }

    const ageMs = this.now().getTime() - Date.parse(this.active.openedAt);
    if (ageMs >= this.options.maxAgeMs) {
      return this.flush('age');
    }

    return null;
  }

  flush(reason: FlushReason = 'manual'): TelemetryBatch | null {
    if (this.active.envelopes.length === 0) {
      return null;
    }

    const batch: TelemetryBatch = {
      id: this.active.id,
      partitionKey: this.active.partitionKey,
      openedAt: this.active.openedAt,
      closedAt: this.now().toISOString(),
      flushReason: reason,
      envelopes: deepClone(this.active.envelopes),
      stats: deepClone(this.active.stats),
      integrityHash: createIntegrityHash({
        id: this.active.id,
        partitionKey: this.active.partitionKey,
        openedAt: this.active.openedAt,
        reason,
        count: this.active.stats.itemCount,
        bytes: this.active.stats.byteCount,
        envelopeHashes: this.active.envelopes.map((entry) => createDedupeKey(entry)),
      }),
    };

    this.active = this.createEmptyBatch(this.active.partitionKey);
    return batch;
  }

  snapshot(): TelemetryBatcherSnapshot {
    this.sweepExpiredDedupeEntries();
    return {
      activeBatchId: this.active.id,
      partitionKey: this.active.partitionKey,
      itemCount: this.active.stats.itemCount,
      byteCount: this.active.stats.byteCount,
      openedAt: this.active.openedAt,
      duplicateWindowSize: this.dedupeExpirations.size,
    };
  }

  static mergeBatches(batches: TelemetryBatch[]): TelemetryBatch[] {
    return [...batches].sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  }

  private acceptIntoActive(
    envelope: TelemetryEnvelope,
    flushedBatch: TelemetryBatch | null,
  ): BatchAppendResult {
    const bytes = estimateEnvelopeBytes(envelope);
    this.active.envelopes.push(envelope);
    this.active.stats.itemCount += 1;
    this.active.stats.byteCount += bytes;
    this.active.stats.firstOccurredAt = this.active.stats.firstOccurredAt ?? envelope.occurredAt;
    this.active.stats.lastOccurredAt = envelope.occurredAt;
    this.noteDedupeKey(envelope);

    return {
      accepted: true,
      duplicate: false,
      flushedBatch,
      activeBatchId: this.active.id,
      activePartitionKey: this.active.partitionKey,
      activeItemCount: this.active.stats.itemCount,
      activeByteCount: this.active.stats.byteCount,
    };
  }

  private createEmptyBatch(partitionKey: string): MutableTelemetryBatch {
    const openedAt = this.now().toISOString();
    return {
      id: `${this.idPrefix}_${createIntegrityHash(`${partitionKey}:${openedAt}`).slice(0, 18)}`,
      partitionKey,
      openedAt,
      envelopes: [],
      stats: {
        itemCount: 0,
        byteCount: 0,
        duplicateDrops: 0,
        firstOccurredAt: null,
        lastOccurredAt: null,
      },
    };
  }

  private isDuplicate(envelope: TelemetryEnvelope): boolean {
    const key = createDedupeKey(envelope);
    const expiry = this.dedupeExpirations.get(key);
    return typeof expiry === 'number' && expiry > this.now().getTime();
  }

  private noteDedupeKey(envelope: TelemetryEnvelope): void {
    const key = createDedupeKey(envelope);
    this.dedupeExpirations.set(key, this.now().getTime() + this.options.dedupeWindowMs);
  }

  private sweepExpiredDedupeEntries(): void {
    const nowMs = this.now().getTime();
    for (const [key, expiry] of this.dedupeExpirations.entries()) {
      if (expiry <= nowMs) {
        this.dedupeExpirations.delete(key);
      }
    }
  }
}

export function buildPartitionKey(envelope: TelemetryEnvelope): string {
  return [
    envelope.version,
    envelope.tenantId,
    envelope.stream,
    envelope.sessionId ?? 'session:none',
  ].join('|');
}

export function createDedupeKey(envelope: TelemetryEnvelope): string {
  return createIntegrityHash({
    version: envelope.version,
    tenantId: envelope.tenantId,
    stream: envelope.stream,
    eventName: envelope.eventName,
    occurredAt: envelope.occurredAt,
    actorId: envelope.actorId ?? null,
    sessionId: envelope.sessionId ?? null,
    deviceId: envelope.deviceId ?? null,
    sequence: envelope.sequence ?? null,
    idempotencyKey: envelope.idempotencyKey ?? null,
    payload: canonicalize(envelope.payload),
  });
}

export function estimateEnvelopeBytes(envelope: TelemetryEnvelope): number {
  return new TextEncoder().encode(JSON.stringify(envelope)).length;
}

export function normalizeEnvelope(envelope: TelemetryEnvelope): TelemetryEnvelope {
  if (!envelope || typeof envelope !== 'object') {
    throw new Error('Telemetry envelope is required.');
  }

  const occurredAt = new Date(envelope.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error('Telemetry envelope occurredAt must be a valid ISO timestamp.');
  }

  const version = envelope.version === 'v3' ? 'v3' : 'v2';
  const tenantId = String(envelope.tenantId ?? '').trim();
  const stream = String(envelope.stream ?? '').trim();
  const eventName = String(envelope.eventName ?? '').trim();

  if (!tenantId || !stream || !eventName) {
    throw new Error('Telemetry envelope tenantId, stream, and eventName are required.');
  }

  return {
    version,
    tenantId,
    stream,
    eventName,
    occurredAt: occurredAt.toISOString(),
    sessionId: normalizeNullableString(envelope.sessionId),
    actorId: normalizeNullableString(envelope.actorId),
    deviceId: normalizeNullableString(envelope.deviceId),
    sequence: envelope.sequence == null ? null : clampInteger(envelope.sequence, 0, Number.MAX_SAFE_INTEGER),
    idempotencyKey: normalizeNullableString(envelope.idempotencyKey),
    payload: canonicalize(envelope.payload ?? {}),
    tags: uniqueStrings(envelope.tags ?? []),
  };
}

function sanitizeOptions(options: Partial<TelemetryBatchingOptions>): Partial<TelemetryBatchingOptions> {
  const next: Partial<TelemetryBatchingOptions> = {};
  if (options.maxItems !== undefined) {
    next.maxItems = clampInteger(options.maxItems, 1, 1_000_000);
  }
  if (options.maxBytes !== undefined) {
    next.maxBytes = clampInteger(options.maxBytes, 128, 1024 * 1024 * 1024);
  }
  if (options.maxAgeMs !== undefined) {
    next.maxAgeMs = clampInteger(options.maxAgeMs, 1, 24 * 60 * 60 * 1000);
  }
  if (options.dedupeWindowMs !== undefined) {
    next.dedupeWindowMs = clampInteger(options.dedupeWindowMs, 0, 24 * 60 * 60 * 1000);
  }
  return next;
}

function normalizeNullableString(value: unknown): string | null {
  const next = String(value ?? '').trim();
  return next ? next : null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function clampInteger(value: number, min: number, max: number): number {
  const safe = Math.trunc(Number(value));
  if (!Number.isFinite(safe)) {
    return min;
  }
  return Math.max(min, Math.min(max, safe));
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value: unknown): any {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      next[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return next;
  }
  return value;
}

function createIntegrityHash(payload: unknown): string {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
