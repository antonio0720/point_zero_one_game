/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ML ONLINE FEATURE STORE
 * FILE: backend/src/game/engine/chat/ml/OnlineFeatureStore.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical bounded online-feature store for authoritative backend chat.
 *
 * This file holds recent model-ready feature rows emitted by the backend chat
 * feature ingestor and makes them queryable for live scoring without confusing
 * the store with transcript truth. The doctrine is strict:
 *
 * - transcript truth remains in ChatState;
 * - feature rows remain derivative, replayable, and bounded;
 * - online models read from here because they need fast windows and recency;
 * - offline training still consumes authoritative artifacts, not store-only
 *   summaries;
 * - no model gets to mutate this store arbitrarily.
 *
 * The store therefore owns:
 * - recent feature-row retention,
 * - multi-index lookup by room / session / user / family / entity key,
 * - recency-weighted aggregation,
 * - bounded hydration / serialization,
 * - pruning and cardinality enforcement,
 * - fast latest-row and merged-window reads for live model decisions.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  type ChatFeatureSnapshot,
  type ChatRoomId,
  type ChatSessionId,
  type ChatUserId,
  type JsonValue,
  type Nullable,
  type PressureTier,
  type Score01,
  type UnixMs,
} from '../types';
import {
  CHAT_FEATURE_INGESTOR_DEFAULTS,
  CHAT_MODEL_FAMILIES,
  type ChatFeatureIngestResult,
  type ChatFeatureRow,
  type ChatFeatureScalarMap,
  type ChatModelFamily,
} from './FeatureIngestor';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_ONLINE_FEATURE_STORE_MODULE_NAME =
  'PZO_BACKEND_CHAT_ONLINE_FEATURE_STORE' as const;

export const CHAT_ONLINE_FEATURE_STORE_VERSION =
  '2026.03.14-online-feature-store.v1' as const;

export const CHAT_ONLINE_FEATURE_STORE_RUNTIME_LAWS = Object.freeze([
  'The store keeps derived rows, never canonical transcript truth.',
  'Every retained row must remain attributable by entity key and event anchor.',
  'Pruning is allowed; mutation of historical facts is not.',
  'Latest-row reads must be O(1)-ish by index and bounded by configured caps.',
  'Aggregates must be recency aware and family aware.',
  'Hydration may restore bounded live state, not become archival persistence.',
  'Rows for different model families may coexist under one entity without contaminating filters.',
  'Canonical feature snapshots may be reconstructed from bounded rows, but only as advisory windows.',
] as const);

export const CHAT_ONLINE_FEATURE_STORE_DEFAULTS = Object.freeze({
  maxRows: 40_000,
  maxRowsPerEntity: 512,
  maxRowsPerFamilyPerEntity: 128,
  maxEntities: 10_000,
  ttlMs: 8 * 60 * 60_000,
  staleMs: 20 * 60_000,
  aggregateDefaultLimit: 32,
  aggregateHardLimit: 128,
  pruneEveryWrites: 128,
  hydrationHardLimit: 20_000,
  serializationLimit: 5_000,
  recencyHalfLifeMs: 6 * 60_000,
  entityIntersectionGuard: 2_500,
} as const);

// ============================================================================
// MARK: Ports and public contracts
// ============================================================================

export interface ChatOnlineFeatureStoreLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatOnlineFeatureStoreClockPort {
  now(): UnixMs;
}

export interface ChatOnlineFeatureStoreOptions {
  readonly logger?: ChatOnlineFeatureStoreLoggerPort;
  readonly clock?: ChatOnlineFeatureStoreClockPort;
  readonly defaults?: Partial<typeof CHAT_ONLINE_FEATURE_STORE_DEFAULTS>;
}

export interface ChatOnlineFeatureStoreQuery {
  readonly entityKey?: string;
  readonly family?: ChatModelFamily;
  readonly roomId?: Nullable<ChatRoomId>;
  readonly sessionId?: Nullable<ChatSessionId>;
  readonly userId?: Nullable<ChatUserId>;
  readonly sinceMs?: UnixMs;
  readonly limit?: number;
}

export interface ChatOnlineFeatureStoreRecord {
  readonly row: ChatFeatureRow;
  readonly storedAt: UnixMs;
  readonly expiresAt: UnixMs;
  readonly lastReadAt: Nullable<UnixMs>;
  readonly readCount: number;
}

export interface ChatOnlineFeatureStoreStats {
  readonly rowCount: number;
  readonly entityCount: number;
  readonly familyCount: Readonly<Record<ChatModelFamily, number>>;
  readonly oldestStoredAt: Nullable<UnixMs>;
  readonly newestStoredAt: Nullable<UnixMs>;
}

export interface ChatOnlineFeatureAggregate {
  readonly family: Nullable<ChatModelFamily>;
  readonly entityKeys: readonly string[];
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly generatedAt: UnixMs;
  readonly freshnessMs: number;
  readonly dominantChannel: string;
  readonly tags: readonly string[];
  readonly rows: readonly ChatFeatureRow[];
  readonly latestRow: Nullable<ChatFeatureRow>;
  readonly scalarFeatures: ChatFeatureScalarMap;
  readonly categoricalFeatures: Readonly<Record<string, string>>;
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
}

export interface ChatOnlineInferenceWindow {
  readonly family: ChatModelFamily;
  readonly generatedAt: UnixMs;
  readonly scalarFeatures: ChatFeatureScalarMap;
  readonly categoricalFeatures: Readonly<Record<string, string>>;
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly latestRow: Nullable<ChatFeatureRow>;
  readonly evidenceRowIds: readonly string[];
}

export interface ChatOnlineFeatureStoreHydrationSnapshot {
  readonly moduleName: typeof CHAT_ONLINE_FEATURE_STORE_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_ONLINE_FEATURE_STORE_VERSION;
  readonly generatedAt: UnixMs;
  readonly rows: readonly ChatFeatureRow[];
}

// ============================================================================
// MARK: Internal helpers and defaults
// ============================================================================

const DEFAULT_LOGGER: ChatOnlineFeatureStoreLoggerPort = {
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLOCK: ChatOnlineFeatureStoreClockPort = {
  now: () => asUnixMs(Date.now()),
};

interface MutableChatOnlineFeatureStoreRecord {
  row: ChatFeatureRow;
  storedAt: UnixMs;
  expiresAt: UnixMs;
  lastReadAt: Nullable<UnixMs>;
  readCount: number;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampLimit(value: number | undefined, defaults: typeof CHAT_ONLINE_FEATURE_STORE_DEFAULTS): number {
  if (!Number.isFinite(value)) return defaults.aggregateDefaultLimit;
  return Math.max(1, Math.min(defaults.aggregateHardLimit, Math.floor(value!)));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Array.from(new Set(values));
}

function pushIndex(map: Map<string, string[]>, key: string, rowId: string): void {
  const next = map.get(key);
  if (next) {
    next.push(rowId);
  } else {
    map.set(key, [rowId]);
  }
}

function removeIndex(map: Map<string, string[]>, key: string, rowId: string): void {
  const current = map.get(key);
  if (!current) return;
  const next = current.filter((candidate) => candidate !== rowId);
  if (next.length) {
    map.set(key, next);
  } else {
    map.delete(key);
  }
}

function recordSortDescending(left: ChatOnlineFeatureStoreRecord, right: ChatOnlineFeatureStoreRecord): number {
  return (right.row.generatedAt as number) - (left.row.generatedAt as number);
}

function computeRecencyWeight(
  now: UnixMs,
  generatedAt: UnixMs,
  defaults: typeof CHAT_ONLINE_FEATURE_STORE_DEFAULTS,
): number {
  const age = Math.max(0, (now as number) - (generatedAt as number));
  const halfLife = Math.max(defaults.recencyHalfLifeMs, 1);
  const exponent = age / halfLife;
  return Math.pow(0.5, exponent);
}

function normalizePressureTier(value: unknown): PressureTier {
  if (
    value === 'NONE' ||
    value === 'BUILDING' ||
    value === 'ELEVATED' ||
    value === 'HIGH' ||
    value === 'CRITICAL'
  ) {
    return value;
  }
  return 'BUILDING';
}

function asScore(value: number): Score01 {
  return clamp01(value) as Score01;
}

function mergeScalarFeatures(
  rows: readonly ChatFeatureRow[],
  now: UnixMs,
  defaults: typeof CHAT_ONLINE_FEATURE_STORE_DEFAULTS,
): ChatFeatureScalarMap {
  if (!rows.length) return Object.freeze({});

  const accumulators = new Map<string, { weighted: number; weight: number }>();

  for (const row of rows) {
    const weight = computeRecencyWeight(now, row.generatedAt, defaults);
    for (const [key, value] of Object.entries(row.scalarFeatures)) {
      const current = accumulators.get(key) ?? { weighted: 0, weight: 0 };
      current.weighted += safeNumber(value) * weight;
      current.weight += weight;
      accumulators.set(key, current);
    }
  }

  const result: Record<string, number> = {};
  for (const [key, value] of accumulators.entries()) {
    result[key] = value.weight > 0 ? value.weighted / value.weight : 0;
  }

  return Object.freeze(
    Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right))),
  );
}

function mergeCategoricalFeatures(rows: readonly ChatFeatureRow[]): Readonly<Record<string, string>> {
  if (!rows.length) return Object.freeze({});

  const counts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.categoricalFeatures)) {
      const current = counts.get(key) ?? new Map<string, number>();
      current.set(value, (current.get(value) ?? 0) + 1);
      counts.set(key, current);
    }
  }

  const result: Record<string, string> = {};
  for (const [key, values] of counts.entries()) {
    const sorted = [...values.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    result[key] = sorted[0]?.[0] ?? 'UNKNOWN';
  }

  return Object.freeze(
    Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right))),
  );
}

function mergeTags(rows: readonly ChatFeatureRow[]): readonly string[] {
  return Object.freeze([...unique(rows.flatMap((row) => row.tags))].sort());
}

function chooseDominantChannel(rows: readonly ChatFeatureRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.channelId, (counts.get(row.channelId) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'GLOBAL';
}

function mergeCanonicalSnapshot(
  rows: readonly ChatFeatureRow[],
  scalars: ChatFeatureScalarMap,
  generatedAt: UnixMs,
): Nullable<ChatFeatureSnapshot> {
  const latest = rows.find((row) => row.canonicalSnapshot)?.canonicalSnapshot;
  if (!latest) return null;

  return Object.freeze({
    generatedAt,
    userId: latest.userId,
    roomId: latest.roomId,
    messageCountWindow: Math.round(safeNumber(scalars.recentPlayerShare01, 0) * Math.max(latest.messageCountWindow, 1) + latest.messageCountWindow * 0.5),
    inboundNpcCountWindow: Math.round(safeNumber(scalars.recentNpcShare01, 0) * Math.max(latest.messageCountWindow, 1) + latest.inboundNpcCountWindow * 0.5),
    outboundPlayerCountWindow: Math.round(safeNumber(scalars.recentPlayerShare01, 0) * Math.max(latest.messageCountWindow, 1) + latest.outboundPlayerCountWindow * 0.5),
    ignoredHelperCountWindow: Math.round(safeNumber(scalars.helperIgnore01, 0) * 3 + latest.ignoredHelperCountWindow * 0.5),
    pressureTier: normalizePressureTier(mergeCategoricalFeatures(rows).pressureTier),
    hostileMomentum01: asScore(safeNumber(scalars.hostileMomentum01, latest.hostileMomentum01)),
    roomHeat01: asScore(safeNumber(scalars.roomHeat01, latest.roomHeat01)),
    affect: Object.freeze({
      confidence01: asScore(safeNumber(scalars.confidence01, latest.affect.confidence01)),
      frustration01: asScore(safeNumber(scalars.frustration01, latest.affect.frustration01)),
      intimidation01: asScore(safeNumber(scalars.intimidation01, latest.affect.intimidation01)),
      attachment01: asScore(safeNumber(scalars.attachment01, latest.affect.attachment01)),
      curiosity01: asScore(safeNumber(scalars.curiosity01, latest.affect.curiosity01)),
      embarrassment01: asScore(safeNumber(scalars.embarrassment01, latest.affect.embarrassment01)),
      relief01: asScore(safeNumber(scalars.relief01, latest.affect.relief01)),
    }),
    churnRisk01: asScore(safeNumber(scalars.churnRisk01, latest.churnRisk01)),
  });
}


function isIngestResult(value: readonly ChatFeatureRow[] | ChatFeatureIngestResult): value is ChatFeatureIngestResult {
  return !Array.isArray(value);
}

function familyCounts(records: Iterable<MutableChatOnlineFeatureStoreRecord>): Readonly<Record<ChatModelFamily, number>> {
  const counts: Record<ChatModelFamily, number> = {
    ONLINE_CONTEXT: 0,
    ENGAGEMENT: 0,
    HATER_TARGETING: 0,
    HELPER_TIMING: 0,
    CHANNEL_AFFINITY: 0,
    TOXICITY: 0,
    CHURN: 0,
    INTERVENTION_POLICY: 0,
  };

  for (const record of records) {
    counts[record.row.family] += 1;
  }

  return Object.freeze(counts);
}

// ============================================================================
// MARK: Online feature store
// ============================================================================

export class OnlineFeatureStore {
  private readonly logger: ChatOnlineFeatureStoreLoggerPort;
  private readonly clock: ChatOnlineFeatureStoreClockPort;
  private readonly defaults: typeof CHAT_ONLINE_FEATURE_STORE_DEFAULTS;

  private readonly byRowId = new Map<string, MutableChatOnlineFeatureStoreRecord>();
  private readonly byEntityKey = new Map<string, string[]>();
  private readonly byRoomId = new Map<string, string[]>();
  private readonly bySessionId = new Map<string, string[]>();
  private readonly byUserId = new Map<string, string[]>();
  private readonly byFamily = new Map<ChatModelFamily, string[]>();

  private writeCount = 0;

  public constructor(options: ChatOnlineFeatureStoreOptions = {}) {
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.defaults = Object.freeze({
      ...CHAT_ONLINE_FEATURE_STORE_DEFAULTS,
      ...(options.defaults ?? {}),
    });
  }

  public upsert(rowsOrBatch: readonly ChatFeatureRow[] | ChatFeatureIngestResult): number {
    const rows = isIngestResult(rowsOrBatch) ? rowsOrBatch.rows : rowsOrBatch;
    let writes = 0;

    for (const row of rows) {
      writes += this.insertRow(row);
    }

    this.writeCount += writes;

    if (this.writeCount >= this.defaults.pruneEveryWrites) {
      this.prune();
      this.writeCount = 0;
    }

    return writes;
  }

  public latest(query: ChatOnlineFeatureStoreQuery): Nullable<ChatFeatureRow> {
    return this.readRecords(query, 1)[0]?.row ?? null;
  }

  public list(query: ChatOnlineFeatureStoreQuery = {}): readonly ChatFeatureRow[] {
    return Object.freeze(this.readRecords(query).map((record) => record.row));
  }

  public aggregate(query: ChatOnlineFeatureStoreQuery = {}): ChatOnlineFeatureAggregate {
    const now = this.clock.now();
    const records = this.readRecords(query);
    const rows = Object.freeze(records.map((record) => record.row));
    const latestRow = rows[0] ?? null;
    const scalars = mergeScalarFeatures(rows, now, this.defaults);
    const categoricals = mergeCategoricalFeatures(rows);
    const generatedAt = latestRow?.generatedAt ?? now;
    const freshnessMs = latestRow ? Math.max(0, (now as number) - (latestRow.generatedAt as number)) : this.defaults.staleMs;

    return Object.freeze({
      family: query.family ?? null,
      entityKeys: unique(rows.map((row) => row.entityKey)),
      roomId: latestRow?.roomId ?? query.roomId ?? null,
      sessionId: latestRow?.sessionId ?? query.sessionId ?? null,
      userId: latestRow?.userId ?? query.userId ?? null,
      generatedAt,
      freshnessMs,
      dominantChannel: chooseDominantChannel(rows),
      tags: mergeTags(rows),
      rows,
      latestRow,
      scalarFeatures: scalars,
      categoricalFeatures: categoricals,
      canonicalSnapshot: mergeCanonicalSnapshot(rows, scalars, generatedAt),
    });
  }

  public inferenceWindow(
    family: ChatModelFamily,
    query: Omit<ChatOnlineFeatureStoreQuery, 'family'> = {},
  ): ChatOnlineInferenceWindow {
    const aggregate = this.aggregate({ ...query, family });
    return Object.freeze({
      family,
      generatedAt: aggregate.generatedAt,
      scalarFeatures: aggregate.scalarFeatures,
      categoricalFeatures: aggregate.categoricalFeatures,
      canonicalSnapshot: aggregate.canonicalSnapshot,
      latestRow: aggregate.latestRow,
      evidenceRowIds: aggregate.rows.map((row) => row.rowId),
    });
  }

  public hasEvidence(query: ChatOnlineFeatureStoreQuery): boolean {
    return this.readRecords(query, 1).length > 0;
  }

  public deleteRow(rowId: string): boolean {
    const record = this.byRowId.get(rowId);
    if (!record) return false;

    this.byRowId.delete(rowId);
    removeIndex(this.byEntityKey, record.row.entityKey, rowId);
    removeIndex(this.byFamily, record.row.family, rowId);
    if (record.row.roomId) removeIndex(this.byRoomId, record.row.roomId, rowId);
    if (record.row.sessionId) removeIndex(this.bySessionId, record.row.sessionId, rowId);
    if (record.row.userId) removeIndex(this.byUserId, record.row.userId, rowId);
    return true;
  }

  public prune(now = this.clock.now()): number {
    let removed = 0;

    for (const [rowId, record] of this.byRowId.entries()) {
      const expired = (record.expiresAt as number) <= (now as number);
      const stale = (now as number) - (record.row.generatedAt as number) > this.defaults.ttlMs;
      if (expired || stale) {
        if (this.deleteRow(rowId)) removed += 1;
      }
    }

    if (this.byRowId.size > this.defaults.maxRows) {
      const overflow = this.byRowId.size - this.defaults.maxRows;
      const oldest = [...this.byRowId.values()]
        .sort((left, right) => (left.row.generatedAt as number) - (right.row.generatedAt as number))
        .slice(0, overflow);
      for (const record of oldest) {
        if (this.deleteRow(record.row.rowId)) removed += 1;
      }
    }

    this.enforcePerEntityCaps();
    return removed;
  }

  public serialize(limit = this.defaults.serializationLimit): ChatOnlineFeatureStoreHydrationSnapshot {
    const rows = [...this.byRowId.values()]
      .sort((left, right) => (right.row.generatedAt as number) - (left.row.generatedAt as number))
      .slice(0, Math.max(1, limit))
      .map((record) => record.row);

    return Object.freeze({
      moduleName: CHAT_ONLINE_FEATURE_STORE_MODULE_NAME,
      moduleVersion: CHAT_ONLINE_FEATURE_STORE_VERSION,
      generatedAt: this.clock.now(),
      rows: Object.freeze(rows),
    });
  }

  public hydrate(snapshot: ChatOnlineFeatureStoreHydrationSnapshot): number {
    const rows = snapshot.rows.slice(0, this.defaults.hydrationHardLimit);
    return this.upsert(rows);
  }

  public stats(): ChatOnlineFeatureStoreStats {
    const records = [...this.byRowId.values()];
    const storedAts = records.map((record) => record.storedAt as number);
    return Object.freeze({
      rowCount: records.length,
      entityCount: this.byEntityKey.size,
      familyCount: familyCounts(records),
      oldestStoredAt: storedAts.length ? asUnixMs(Math.min(...storedAts)) : null,
      newestStoredAt: storedAts.length ? asUnixMs(Math.max(...storedAts)) : null,
    });
  }

  private insertRow(row: ChatFeatureRow): number {
    const now = this.clock.now();
    const existing = this.byRowId.get(row.rowId);

    if (existing) {
      existing.row = row;
      existing.storedAt = now;
      existing.expiresAt = asUnixMs((now as number) + this.defaults.ttlMs);
      return 1;
    }

    const record: MutableChatOnlineFeatureStoreRecord = {
      row,
      storedAt: now,
      expiresAt: asUnixMs((now as number) + this.defaults.ttlMs),
      lastReadAt: null,
      readCount: 0,
    };

    this.byRowId.set(row.rowId, record);
    pushIndex(this.byEntityKey, row.entityKey, row.rowId);
    pushIndex(this.byFamily, row.family, row.rowId);
    if (row.roomId) pushIndex(this.byRoomId, row.roomId, row.rowId);
    if (row.sessionId) pushIndex(this.bySessionId, row.sessionId, row.rowId);
    if (row.userId) pushIndex(this.byUserId, row.userId, row.rowId);

    return 1;
  }

  private readRecords(
    query: ChatOnlineFeatureStoreQuery,
    overrideLimit?: number,
  ): readonly ChatOnlineFeatureStoreRecord[] {
    const limit = overrideLimit ?? clampLimit(query.limit, this.defaults);
    const candidateIds = this.resolveCandidateIds(query);
    const sinceMs = query.sinceMs ? (query.sinceMs as number) : Number.NEGATIVE_INFINITY;
    const now = this.clock.now();

    const records = candidateIds
      .map((rowId) => this.byRowId.get(rowId))
      .filter((record): record is MutableChatOnlineFeatureStoreRecord => Boolean(record))
      .filter((record) => (record.row.generatedAt as number) >= sinceMs)
      .sort((left, right) => (right.row.generatedAt as number) - (left.row.generatedAt as number))
      .slice(0, limit);

    for (const record of records) {
      record.lastReadAt = now;
      record.readCount += 1;
    }

    return Object.freeze(records.map((record) => Object.freeze({ ...record })));
  }

  private resolveCandidateIds(query: ChatOnlineFeatureStoreQuery): readonly string[] {
    if (query.entityKey) {
      return Object.freeze([...(this.byEntityKey.get(query.entityKey) ?? [])]);
    }

    const sets: string[][] = [];
    if (query.family) sets.push([...(this.byFamily.get(query.family) ?? [])]);
    if (query.roomId) sets.push([...(this.byRoomId.get(query.roomId) ?? [])]);
    if (query.sessionId) sets.push([...(this.bySessionId.get(query.sessionId) ?? [])]);
    if (query.userId) sets.push([...(this.byUserId.get(query.userId) ?? [])]);

    if (!sets.length) {
      return Object.freeze([...this.byRowId.keys()]);
    }

    sets.sort((left, right) => left.length - right.length);
    const [seed, ...rest] = sets;
    let intersection = new Set(seed.slice(0, this.defaults.entityIntersectionGuard));

    for (const group of rest) {
      const next = new Set(group.slice(0, this.defaults.entityIntersectionGuard));
      intersection = new Set([...intersection].filter((rowId) => next.has(rowId)));
      if (!intersection.size) break;
    }

    return Object.freeze([...intersection]);
  }

  private enforcePerEntityCaps(): void {
    if (this.byEntityKey.size > this.defaults.maxEntities) {
      const overflow = this.byEntityKey.size - this.defaults.maxEntities;
      const victims = [...this.byEntityKey.entries()]
        .sort((left, right) => (left[1].length - right[1].length) || left[0].localeCompare(right[0]))
        .slice(0, overflow);
      for (const [, rowIds] of victims) {
        for (const rowId of rowIds) this.deleteRow(rowId);
      }
    }

    for (const [entityKey, rowIds] of this.byEntityKey.entries()) {
      const records = rowIds
        .map((rowId) => this.byRowId.get(rowId))
        .filter((record): record is MutableChatOnlineFeatureStoreRecord => Boolean(record))
        .sort((left, right) => (right.row.generatedAt as number) - (left.row.generatedAt as number));

      if (records.length > this.defaults.maxRowsPerEntity) {
        for (const record of records.slice(this.defaults.maxRowsPerEntity)) {
          this.deleteRow(record.row.rowId);
        }
      }

      const byFamily = new Map<ChatModelFamily, MutableChatOnlineFeatureStoreRecord[]>();
      for (const record of records) {
        const bucket = byFamily.get(record.row.family) ?? [];
        bucket.push(record);
        byFamily.set(record.row.family, bucket);
      }

      for (const family of CHAT_MODEL_FAMILIES) {
        const bucket = byFamily.get(family) ?? [];
        if (bucket.length > this.defaults.maxRowsPerFamilyPerEntity) {
          for (const record of bucket.slice(this.defaults.maxRowsPerFamilyPerEntity)) {
            this.deleteRow(record.row.rowId);
          }
        }
      }

      if (!this.byEntityKey.has(entityKey)) {
        this.logger.debug('Entity evicted during cap enforcement.', { entityKey });
      }
    }
  }
}

// ============================================================================
// MARK: Public helpers
// ============================================================================

export function createOnlineFeatureStore(
  options: ChatOnlineFeatureStoreOptions = {},
): OnlineFeatureStore {
  return new OnlineFeatureStore(options);
}

export function hydrateOnlineFeatureStore(
  snapshot: ChatOnlineFeatureStoreHydrationSnapshot,
  options: ChatOnlineFeatureStoreOptions = {},
): OnlineFeatureStore {
  const store = new OnlineFeatureStore(options);
  store.hydrate(snapshot);
  return store;
}

export function aggregateOnlineFeatureWindow(
  rowsOrBatch: readonly ChatFeatureRow[] | ChatFeatureIngestResult,
  family: Nullable<ChatModelFamily> = null,
): ChatOnlineFeatureAggregate {
  const store = new OnlineFeatureStore({
    defaults: {
      maxRows: Math.max(CHAT_FEATURE_INGESTOR_DEFAULTS.transcriptWindowMessages * 16, 1_024),
      serializationLimit: 1_024,
    } as unknown as Partial<typeof CHAT_ONLINE_FEATURE_STORE_DEFAULTS>,
  });
  store.upsert(isIngestResult(rowsOrBatch) ? rowsOrBatch.rows : rowsOrBatch);
  return store.aggregate({ family: family ?? undefined });
}

export const CHAT_ONLINE_FEATURE_STORE_NAMESPACE = Object.freeze({
  moduleName: CHAT_ONLINE_FEATURE_STORE_MODULE_NAME,
  version: CHAT_ONLINE_FEATURE_STORE_VERSION,
  runtimeLaws: CHAT_ONLINE_FEATURE_STORE_RUNTIME_LAWS,
  defaults: CHAT_ONLINE_FEATURE_STORE_DEFAULTS,
  create: createOnlineFeatureStore,
  hydrate: hydrateOnlineFeatureStore,
  aggregateWindow: aggregateOnlineFeatureWindow,
} as const);

export default OnlineFeatureStore;
