/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ML ONLINE FEATURE STORE
 * FILE: backend/src/game/engine/chat/ml/OnlineFeatureStore.ts
 * VERSION: 2026.03.22
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
 * - recent feature-row retention with multi-index lookup,
 * - recency-weighted scalar aggregation with exponential decay,
 * - bounded hydration, serialization, and delta diffing,
 * - pruning and per-entity cardinality enforcement with priority eviction,
 * - entity profiles with completeness and freshness telemetry,
 * - reactive watch surface for downstream consumers,
 * - window comparisons for prior-vs-current drift analysis,
 * - cross-entity aggregate views (by room, by user, by family),
 * - fast scalar and categorical access paths for hot-path models,
 * - query explainability for debugging model windows,
 * - replay frames for audit, tooling, and liveops inspection,
 * - index-health telemetry and bounded backpressure visibility,
 * - top-entity / tag / channel / family boards for fast orchestration reads.
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
  '2026.03.22-online-feature-store.v3' as const;

export const CHAT_ONLINE_FEATURE_STORE_RUNTIME_LAWS = Object.freeze([
  'The store keeps derived rows, never canonical transcript truth.',
  'Every retained row must remain attributable by entity key and event anchor.',
  'Pruning is allowed; mutation of historical facts is not.',
  'Latest-row reads must be O(1)-ish by index and bounded by configured caps.',
  'Aggregates must be recency aware and family aware.',
  'Hydration may restore bounded live state, not become archival persistence.',
  'Rows for different model families may coexist under one entity without contaminating filters.',
  'Canonical feature snapshots may be reconstructed from bounded rows, but only as advisory windows.',
  'Entity profiles are advisory telemetry — they do not gate model scoring.',
  'Watch subscriptions must be non-blocking and bounded by configured watch cap.',
  'Delta serialization tracks only rows added or removed since a reference timestamp.',
  'Explain surfaces must not mutate store state except bounded read telemetry.',
  'Priority eviction is allowed when hard caps are exceeded.',
  'Tombstones are bounded and advisory; they do not become source-of-truth history.',
  'Replay frames are tooling surfaces, not transcript authority.',
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
  watchCapEntries: 256,
  deltaSerializationLimit: 2_000,
  entityProfileMinRows: 2,
  entityProfileStaleAgeMs: 10 * 60_000,
  topEntitiesLimit: 50,
  multiAggregateMaxFamilies: 8,
  scalarAccessFallback: 0,
  windowComparisonMinRows: 2,
  categoryAccessFallback: 'UNKNOWN',
  tombstoneLimit: 4_000,
  mutationLedgerLimit: 4_000,
  replayFrameLimit: 256,
  trendFrameLimit: 128,
  explainCandidateCap: 1_024,
  topTagLimit: 64,
  topChannelLimit: 32,
  topRoomLimit: 32,
  topUserLimit: 64,
  topSessionLimit: 64,
  indexSkewWarnThreshold: 0.55,
  indexSparseWarnThreshold: 0.85,
  highPressureScalarThreshold: 0.78,
  lowPressureScalarThreshold: 0.22,
  freshnessCriticalAgeMs: 2 * 60_000,
  driftThresholdDefault: 0.04,
  profileCoverageFamilyFloor: 3,
  watchTriggerHistoryLimit: 2_048,
  snapshotSummaryLimit: 128,
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
  readonly untilMs?: UnixMs;
  readonly limit?: number;
  readonly tags?: readonly string[];
  readonly entityKind?: ChatFeatureRow['entityKind'];
  readonly minFreshnessPct?: number;
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
  readonly totalUpserts: number;
  readonly totalPrunes: number;
  readonly totalEvictions: number;
  readonly uniqueRoomIds: number;
  readonly uniqueUserIds: number;
  readonly uniqueSessionIds: number;
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

export interface ChatOnlineFeatureStoreDeltaSnapshot {
  readonly generatedAt: UnixMs;
  readonly sinceMs: UnixMs;
  readonly addedRows: readonly ChatFeatureRow[];
  readonly removedRowIds: readonly string[];
  readonly rowCount: number;
}

export interface ChatOnlineFeatureEntityProfile {
  readonly entityKey: string;
  readonly entityKind: ChatFeatureRow['entityKind'];
  readonly roomId: Nullable<ChatRoomId>;
  readonly userId: Nullable<ChatUserId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly rowCount: number;
  readonly familyCoverage: Readonly<Record<ChatModelFamily, number>>;
  readonly oldestRowAt: Nullable<UnixMs>;
  readonly newestRowAt: Nullable<UnixMs>;
  readonly freshnessPct: number;
  readonly dominantChannel: string;
  readonly stale: boolean;
  readonly completenessPct: number;
}

export interface ChatOnlineFeatureWindowComparison {
  readonly entityKey: string;
  readonly family: Nullable<ChatModelFamily>;
  readonly generatedAt: UnixMs;
  readonly currentScalars: ChatFeatureScalarMap;
  readonly priorScalars: ChatFeatureScalarMap;
  readonly deltaScalars: Readonly<Record<string, number>>;
  readonly driftedKeys: readonly string[];
  readonly maxAbsDelta: number;
  readonly meanAbsDelta: number;
}

export interface ChatOnlineFeatureStoreWatchEntry {
  readonly id: string;
  readonly query: ChatOnlineFeatureStoreQuery;
  readonly addedAt: UnixMs;
  readonly lastTriggeredAt: Nullable<UnixMs>;
  readonly triggerCount: number;
}

export interface ChatOnlineFeatureMultiAggregate {
  readonly generatedAt: UnixMs;
  readonly aggregates: Readonly<Partial<Record<ChatModelFamily, ChatOnlineFeatureAggregate>>>;
  readonly families: readonly ChatModelFamily[];
  readonly entityKeys: readonly string[];
  readonly freshnessMs: number;
}

// ============================================================================
// MARK: Extended runtime contracts
// ============================================================================

export interface ChatOnlineFeatureStoreMutationReceipt {
  readonly mutationId: string;
  readonly kind: 'UPSERT' | 'DELETE' | 'PRUNE' | 'HYDRATE' | 'APPLY_DELTA';
  readonly generatedAt: UnixMs;
  readonly affectedRowIds: readonly string[];
  readonly affectedEntityKeys: readonly string[];
  readonly affectedFamilies: readonly ChatModelFamily[];
  readonly rowCountBefore: number;
  readonly rowCountAfter: number;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChatOnlineFeatureStoreTombstone {
  readonly rowId: string;
  readonly entityKey: string;
  readonly family: ChatModelFamily;
  readonly deletedAt: UnixMs;
  readonly reason: string;
}

export interface ChatOnlineFeatureStoreReadReceipt {
  readonly query: ChatOnlineFeatureStoreQuery;
  readonly generatedAt: UnixMs;
  readonly resolvedCandidateCount: number;
  readonly returnedCount: number;
  readonly rowIds: readonly string[];
  readonly entityKeys: readonly string[];
}

export interface ChatOnlineFeatureStoreQueryExplain {
  readonly query: ChatOnlineFeatureStoreQuery;
  readonly generatedAt: UnixMs;
  readonly candidateIds: readonly string[];
  readonly matchedIds: readonly string[];
  readonly rejectedByTime: readonly string[];
  readonly rejectedByTags: readonly string[];
  readonly rejectedByEntityKind: readonly string[];
  readonly rejectedByFreshness: readonly string[];
  readonly finalLimit: number;
  readonly summary: string;
}

export interface ChatOnlineFeatureStoreReplayFrame {
  readonly frameId: string;
  readonly generatedAt: UnixMs;
  readonly entityKey: string;
  readonly family: ChatModelFamily;
  readonly rowId: string;
  readonly scalarFeatures: ChatFeatureScalarMap;
  readonly categoricalFeatures: Readonly<Record<string, string>>;
  readonly tags: readonly string[];
  readonly channelId: string;
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
}

export interface ChatOnlineFeatureStoreTimelinePoint {
  readonly frameAt: UnixMs;
  readonly rowId: string;
  readonly family: ChatModelFamily;
  readonly entityKey: string;
  readonly scalarValue: number;
  readonly dominantChannel: string;
  readonly tags: readonly string[];
}

export interface ChatOnlineFeatureStoreTimeline {
  readonly key: string;
  readonly generatedAt: UnixMs;
  readonly points: readonly ChatOnlineFeatureStoreTimelinePoint[];
  readonly minValue: number;
  readonly maxValue: number;
  readonly avgValue: number;
  readonly slope: number;
}

export interface ChatOnlineFeatureStoreIndexHealth {
  readonly generatedAt: UnixMs;
  readonly rowCount: number;
  readonly entityIndexCardinality: number;
  readonly familyIndexCardinality: number;
  readonly roomIndexCardinality: number;
  readonly userIndexCardinality: number;
  readonly sessionIndexCardinality: number;
  readonly densestEntityKey: Nullable<string>;
  readonly densestEntityRows: number;
  readonly sparsityPct: number;
  readonly skewPct: number;
  readonly warnings: readonly string[];
}

export interface ChatOnlineFeatureStoreBackpressureStatus {
  readonly generatedAt: UnixMs;
  readonly rowUsagePct: number;
  readonly entityUsagePct: number;
  readonly watchUsagePct: number;
  readonly mutationLedgerUsagePct: number;
  readonly tombstoneUsagePct: number;
  readonly risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly notes: readonly string[];
}

export interface ChatOnlineFeatureStoreConsistencyReport {
  readonly generatedAt: UnixMs;
  readonly orphanedRowIds: readonly string[];
  readonly missingFamilyIndexRowIds: readonly string[];
  readonly missingEntityIndexRowIds: readonly string[];
  readonly missingRoomIndexRowIds: readonly string[];
  readonly missingUserIndexRowIds: readonly string[];
  readonly missingSessionIndexRowIds: readonly string[];
  readonly duplicateIndexReferences: readonly string[];
  readonly ok: boolean;
}

export interface ChatOnlineFeatureStoreEntityBoard {
  readonly generatedAt: UnixMs;
  readonly entities: readonly ChatOnlineFeatureEntityProfile[];
  readonly totalRows: number;
  readonly avgFreshnessPct: number;
  readonly avgCompletenessPct: number;
}

export interface ChatOnlineFeatureStoreFamilyBoardEntry {
  readonly family: ChatModelFamily;
  readonly rowCount: number;
  readonly entityCount: number;
  readonly avgFreshnessMs: number;
  readonly dominantChannel: string;
  readonly hottestScalarKeys: readonly string[];
}

export interface ChatOnlineFeatureStoreFamilyBoard {
  readonly generatedAt: UnixMs;
  readonly entries: readonly ChatOnlineFeatureStoreFamilyBoardEntry[];
}

export interface ChatOnlineFeatureStoreTagBoardEntry {
  readonly tag: string;
  readonly count: number;
  readonly families: readonly ChatModelFamily[];
  readonly entityKeys: readonly string[];
}

export interface ChatOnlineFeatureStoreTagBoard {
  readonly generatedAt: UnixMs;
  readonly entries: readonly ChatOnlineFeatureStoreTagBoardEntry[];
}

export interface ChatOnlineFeatureStoreChannelBoardEntry {
  readonly channelId: string;
  readonly count: number;
  readonly dominantFamilies: readonly ChatModelFamily[];
  readonly entityKeys: readonly string[];
}

export interface ChatOnlineFeatureStoreChannelBoard {
  readonly generatedAt: UnixMs;
  readonly entries: readonly ChatOnlineFeatureStoreChannelBoardEntry[];
}

export interface ChatOnlineFeatureStoreRoomBoardEntry {
  readonly roomId: ChatRoomId;
  readonly rowCount: number;
  readonly entityCount: number;
  readonly hottestFamily: Nullable<ChatModelFamily>;
  readonly pressureTier: PressureTier;
  readonly roomHeat01: Score01;
}

export interface ChatOnlineFeatureStoreRoomBoard {
  readonly generatedAt: UnixMs;
  readonly entries: readonly ChatOnlineFeatureStoreRoomBoardEntry[];
}

export interface ChatOnlineFeatureStoreUserBoardEntry {
  readonly userId: ChatUserId;
  readonly rowCount: number;
  readonly sessionCount: number;
  readonly freshestAt: Nullable<UnixMs>;
  readonly hottestFamily: Nullable<ChatModelFamily>;
}

export interface ChatOnlineFeatureStoreUserBoard {
  readonly generatedAt: UnixMs;
  readonly entries: readonly ChatOnlineFeatureStoreUserBoardEntry[];
}

export interface ChatOnlineFeatureStoreSessionBoardEntry {
  readonly sessionId: ChatSessionId;
  readonly rowCount: number;
  readonly userCount: number;
  readonly familyCount: number;
  readonly freshnessMs: number;
}

export interface ChatOnlineFeatureStoreSessionBoard {
  readonly generatedAt: UnixMs;
  readonly entries: readonly ChatOnlineFeatureStoreSessionBoardEntry[];
}

export interface ChatOnlineFeatureStoreSnapshotSummary {
  readonly generatedAt: UnixMs;
  readonly rowCount: number;
  readonly entityCount: number;
  readonly families: readonly ChatModelFamily[];
  readonly rooms: readonly ChatRoomId[];
  readonly users: readonly ChatUserId[];
  readonly sessions: readonly ChatSessionId[];
  readonly tags: readonly string[];
}

export interface ChatOnlineFeatureStoreWatchTrigger {
  readonly watchId: string;
  readonly generatedAt: UnixMs;
  readonly rowIds: readonly string[];
  readonly entityKeys: readonly string[];
  readonly families: readonly ChatModelFamily[];
  readonly summary: string;
}

export interface ChatOnlineFeatureStorePruneReceipt {
  readonly generatedAt: UnixMs;
  readonly removed: number;
  readonly expired: number;
  readonly stale: number;
  readonly overflow: number;
  readonly capEvictions: number;
  readonly rowCountAfter: number;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Internal helpers
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

interface MutableWatchState {
  query: ChatOnlineFeatureStoreQuery;
  addedAt: UnixMs;
  lastTriggeredAt: Nullable<UnixMs>;
  triggerCount: number;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampLimit(value: number | undefined, defaults: typeof CHAT_ONLINE_FEATURE_STORE_DEFAULTS): number {
  if (!Number.isFinite(value)) return defaults.aggregateDefaultLimit;
  return Math.max(1, Math.min(defaults.aggregateHardLimit, Math.floor(value!)));
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Array.from(new Set(values));
}

function uniqueDefined<T>(values: readonly (T | null | undefined)[]): readonly T[] {
  return values.filter((v): v is T => v != null).filter((v, i, a) => a.indexOf(v) === i);
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

function recordFamilySet(rows: readonly ChatFeatureRow[]): readonly ChatModelFamily[] {
  return Object.freeze([...unique(rows.map((row) => row.family))].sort());
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

function scoreToPct(value: number): number {
  return Math.round(clamp01(value) * 100);
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function slope(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  return (last - first) / Math.max(1, values.length - 1);
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
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? 'GLOBAL';
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

function computeEntityFamilyCoverage(
  records: readonly MutableChatOnlineFeatureStoreRecord[],
): Readonly<Record<ChatModelFamily, number>> {
  const coverage: Record<ChatModelFamily, number> = {
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
    coverage[record.row.family] = (coverage[record.row.family] ?? 0) + 1;
  }
  return Object.freeze(coverage);
}

function computeCompletenessPct(coverage: Readonly<Record<ChatModelFamily, number>>): number {
  const covered = CHAT_MODEL_FAMILIES.filter((f) => (coverage[f] ?? 0) > 0).length;
  return Math.round((covered / CHAT_MODEL_FAMILIES.length) * 100);
}

function computeScalarDelta(
  current: ChatFeatureScalarMap,
  prior: ChatFeatureScalarMap,
  driftThreshold = 0.04,
): { delta: Readonly<Record<string, number>>; drifted: string[]; maxAbs: number; meanAbs: number } {
  const delta: Record<string, number> = {};
  const drifted: string[] = [];
  const allKeys = unique([...Object.keys(current), ...Object.keys(prior)]);
  let maxAbs = 0;
  let sumAbs = 0;

  for (const key of allKeys) {
    const c = safeNumber(current[key], 0);
    const p = safeNumber(prior[key], 0);
    const diff = c - p;
    delta[key] = diff;
    const abs = Math.abs(diff);
    if (abs > maxAbs) maxAbs = abs;
    sumAbs += abs;
    if (abs >= driftThreshold) drifted.push(key);
  }

  return {
    delta: Object.freeze(delta),
    drifted,
    maxAbs,
    meanAbs: allKeys.length > 0 ? sumAbs / allKeys.length : 0,
  };
}

function hottestScalarKeys(scalars: ChatFeatureScalarMap, limit = 3): readonly string[] {
  return Object.freeze(
    Object.entries(scalars)
      .sort((a, b) => Math.abs(safeNumber(b[1])) - Math.abs(safeNumber(a[1])) || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([key]) => key),
  );
}

function makeMutationId(prefix: string, now: UnixMs, seed: number): string {
  return `${prefix}:${now}:${seed}`;
}

function summarizeQuery(query: ChatOnlineFeatureStoreQuery): string {
  return [
    query.entityKey ? `entity=${query.entityKey}` : 'entity=*',
    query.family ? `family=${query.family}` : 'family=*',
    query.roomId ? `room=${query.roomId}` : 'room=*',
    query.sessionId ? `session=${query.sessionId}` : 'session=*',
    query.userId ? `user=${query.userId}` : 'user=*',
    query.entityKind ? `kind=${query.entityKind}` : 'kind=*',
    query.tags?.length ? `tags=${query.tags.join(',')}` : 'tags=*',
    query.limit ? `limit=${query.limit}` : 'limit=default',
  ].join(' | ');
}

function snapshotSummaryFromRows(rows: readonly ChatFeatureRow[], now: UnixMs): ChatOnlineFeatureStoreSnapshotSummary {
  return Object.freeze({
    generatedAt: now,
    rowCount: rows.length,
    entityCount: unique(rows.map((row) => row.entityKey)).length,
    families: recordFamilySet(rows),
    rooms: Object.freeze([...uniqueDefined(rows.map((row) => row.roomId as Nullable<ChatRoomId>))].sort()),
    users: Object.freeze([...uniqueDefined(rows.map((row) => row.userId as Nullable<ChatUserId>))].sort()),
    sessions: Object.freeze([...uniqueDefined(rows.map((row) => row.sessionId as Nullable<ChatSessionId>))].sort()),
    tags: mergeTags(rows),
  });
}

function toReplayFrame(row: ChatFeatureRow): ChatOnlineFeatureStoreReplayFrame {
  return Object.freeze({
    frameId: `${row.rowId}:${row.generatedAt}`,
    generatedAt: row.generatedAt,
    entityKey: row.entityKey,
    family: row.family,
    rowId: row.rowId,
    scalarFeatures: row.scalarFeatures,
    categoricalFeatures: row.categoricalFeatures,
    tags: Object.freeze([...row.tags]),
    channelId: row.channelId,
    canonicalSnapshot: row.canonicalSnapshot ?? null,
  });
}

function pressureTierFromRows(rows: readonly ChatFeatureRow[]): PressureTier {
  return normalizePressureTier(mergeCategoricalFeatures(rows).pressureTier);
}

function roomHeatFromRows(rows: readonly ChatFeatureRow[], now: UnixMs, defaults: typeof CHAT_ONLINE_FEATURE_STORE_DEFAULTS): Score01 {
  const scalars = mergeScalarFeatures(rows, now, defaults);
  return asScore(safeNumber(scalars.roomHeat01, 0));
}

function buildWatchTriggerSummary(
  watchId: string,
  rows: readonly ChatFeatureRow[],
): ChatOnlineFeatureStoreWatchTrigger {
  const now = rows[0]?.generatedAt ?? asUnixMs(Date.now());
  return Object.freeze({
    watchId,
    generatedAt: now,
    rowIds: Object.freeze(rows.map((row) => row.rowId)),
    entityKeys: Object.freeze(unique(rows.map((row) => row.entityKey))),
    families: Object.freeze([...unique(rows.map((row) => row.family))].sort()),
    summary: `watch=${watchId} rows=${rows.length} entities=${unique(rows.map((row) => row.entityKey)).length}`,
  });
}

function makeJsonValue(value: unknown): JsonValue {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value as JsonValue;
  }
  if (Array.isArray(value)) {
    return value.map((item) => makeJsonValue(item)) as JsonValue;
  }
  if (typeof value === 'object') {
    const out: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = makeJsonValue(child);
    }
    return out as JsonValue;
  }
  return String(value) as JsonValue;
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

  private readonly tombstones: ChatOnlineFeatureStoreTombstone[] = [];
  private readonly mutationLedger: ChatOnlineFeatureStoreMutationReceipt[] = [];
  private readonly readLedger: ChatOnlineFeatureStoreReadReceipt[] = [];
  private readonly watchTriggerLedger: ChatOnlineFeatureStoreWatchTrigger[] = [];

  private writeCount = 0;
  private totalUpserts = 0;
  private totalPrunes = 0;
  private totalEvictions = 0;
  private mutationSeed = 0;

  private readonly watches = new Map<string, MutableWatchState>();

  public constructor(options: ChatOnlineFeatureStoreOptions = {}) {
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.defaults = Object.freeze({
      ...CHAT_ONLINE_FEATURE_STORE_DEFAULTS,
      ...(options.defaults ?? {}),
    });
  }

  // ==========================================================================
  // MARK: Mutation surface
  // ==========================================================================

  public upsert(rowsOrBatch: readonly ChatFeatureRow[] | ChatFeatureIngestResult): number {
    const rows = isIngestResult(rowsOrBatch) ? rowsOrBatch.rows : rowsOrBatch;
    const rowCountBefore = this.byRowId.size;
    let writes = 0;
    const affectedRowIds: string[] = [];
    const affectedEntityKeys: string[] = [];
    const affectedFamilies: ChatModelFamily[] = [];

    for (const row of rows) {
      writes += this.insertRow(row);
      affectedRowIds.push(row.rowId);
      affectedEntityKeys.push(row.entityKey);
      affectedFamilies.push(row.family);
    }

    this.writeCount += writes;
    this.totalUpserts += writes;

    if (this.writeCount >= this.defaults.pruneEveryWrites) {
      this.prune();
      this.writeCount = 0;
    }

    this.notifyWatches(rows);
    this.pushMutationReceipt({
      kind: 'UPSERT',
      affectedRowIds,
      affectedEntityKeys,
      affectedFamilies,
      rowCountBefore,
      rowCountAfter: this.byRowId.size,
      metadata: {
        writes,
        rows: rows.length,
      },
    });

    return writes;
  }

  public hydrate(snapshot: ChatOnlineFeatureStoreHydrationSnapshot): number {
    const rows = snapshot.rows.slice(0, this.defaults.hydrationHardLimit);
    const rowCountBefore = this.byRowId.size;
    const result = this.upsert(rows);
    this.pushMutationReceipt({
      kind: 'HYDRATE',
      affectedRowIds: rows.map((row) => row.rowId),
      affectedEntityKeys: rows.map((row) => row.entityKey),
      affectedFamilies: rows.map((row) => row.family),
      rowCountBefore,
      rowCountAfter: this.byRowId.size,
      metadata: {
        snapshotGeneratedAt: snapshot.generatedAt,
        moduleVersion: snapshot.moduleVersion,
      },
    });
    return result;
  }

  public applyDelta(delta: ChatOnlineFeatureStoreDeltaSnapshot): number {
    const rowCountBefore = this.byRowId.size;
    let applied = 0;
    const deleted: string[] = [];
    for (const rowId of delta.removedRowIds) {
      if (this.deleteRow(rowId, 'apply_delta')) {
        applied += 1;
        deleted.push(rowId);
      }
    }
    applied += this.upsert(delta.addedRows);
    this.pushMutationReceipt({
      kind: 'APPLY_DELTA',
      affectedRowIds: Object.freeze([...deleted, ...delta.addedRows.map((row) => row.rowId)]),
      affectedEntityKeys: delta.addedRows.map((row) => row.entityKey),
      affectedFamilies: delta.addedRows.map((row) => row.family),
      rowCountBefore,
      rowCountAfter: this.byRowId.size,
      metadata: {
        sinceMs: delta.sinceMs,
        addedRows: delta.addedRows.length,
        removedRows: delta.removedRowIds.length,
      },
    });
    return applied;
  }

  public deleteRow(rowId: string, reason = 'manual_delete'): boolean {
    const record = this.byRowId.get(rowId);
    if (!record) return false;

    this.byRowId.delete(rowId);
    removeIndex(this.byEntityKey, record.row.entityKey, rowId);
    removeIndex(this.byFamily, record.row.family, rowId);
    if (record.row.roomId) removeIndex(this.byRoomId, record.row.roomId, rowId);
    if (record.row.sessionId) removeIndex(this.bySessionId, record.row.sessionId, rowId);
    if (record.row.userId) removeIndex(this.byUserId, record.row.userId, rowId);

    this.pushTombstone(record.row, reason);
    this.pushMutationReceipt({
      kind: 'DELETE',
      affectedRowIds: [rowId],
      affectedEntityKeys: [record.row.entityKey],
      affectedFamilies: [record.row.family],
      rowCountBefore: this.byRowId.size + 1,
      rowCountAfter: this.byRowId.size,
      metadata: { reason },
    });

    return true;
  }

  public prune(now = this.clock.now()): number {
    const receipt = this.pruneDetailed(now);
    return receipt.removed;
  }

  public pruneDetailed(now = this.clock.now()): ChatOnlineFeatureStorePruneReceipt {
    let removed = 0;
    let expired = 0;
    let stale = 0;
    let overflow = 0;
    const rowCountBefore = this.byRowId.size;

    for (const [rowId, record] of this.byRowId.entries()) {
      const isExpired = (record.expiresAt as number) <= (now as number);
      const isStale = (now as number) - (record.row.generatedAt as number) > this.defaults.ttlMs;
      if (isExpired || isStale) {
        if (this.deleteRow(rowId, isExpired ? 'expired' : 'stale')) {
          removed += 1;
          if (isExpired) expired += 1;
          if (isStale) stale += 1;
        }
      }
    }

    if (this.byRowId.size > this.defaults.maxRows) {
      const rowOverflow = this.byRowId.size - this.defaults.maxRows;
      const oldest = [...this.byRowId.values()]
        .sort((left, right) => (left.row.generatedAt as number) - (right.row.generatedAt as number))
        .slice(0, rowOverflow);
      for (const record of oldest) {
        if (this.deleteRow(record.row.rowId, 'row_overflow')) {
          removed += 1;
          overflow += 1;
        }
      }
    }

    const capEvictions = this.enforcePerEntityCaps();
    removed += capEvictions;

    this.totalPrunes += 1;
    this.totalEvictions += removed;

    const receipt = Object.freeze({
      generatedAt: now,
      removed,
      expired,
      stale,
      overflow,
      capEvictions,
      rowCountAfter: this.byRowId.size,
      metadata: Object.freeze({
        rowCountBefore,
        rowCountAfter: this.byRowId.size,
      }),
    });

    this.pushMutationReceipt({
      kind: 'PRUNE',
      affectedRowIds: [],
      affectedEntityKeys: [],
      affectedFamilies: [],
      rowCountBefore,
      rowCountAfter: this.byRowId.size,
      metadata: {
        removed,
        expired,
        stale,
        overflow,
        capEvictions,
      },
    });

    return receipt;
  }

  // ==========================================================================
  // MARK: Read surface
  // ==========================================================================

  public latest(query: ChatOnlineFeatureStoreQuery): Nullable<ChatFeatureRow> {
    return this.readRecords(query, 1)[0]?.row ?? null;
  }

  public latestMany(
    queries: readonly ChatOnlineFeatureStoreQuery[],
  ): readonly Nullable<ChatFeatureRow>[] {
    return Object.freeze(queries.map((query) => this.latest(query)));
  }

  public list(query: ChatOnlineFeatureStoreQuery = {}): readonly ChatFeatureRow[] {
    return Object.freeze(this.readRecords(query).map((record) => record.row));
  }

  public listRowsByIds(rowIds: readonly string[]): readonly ChatFeatureRow[] {
    return Object.freeze(
      rowIds
        .map((rowId) => this.byRowId.get(rowId)?.row ?? null)
        .filter((row): row is ChatFeatureRow => Boolean(row)),
    );
  }

  public hasEvidence(query: ChatOnlineFeatureStoreQuery): boolean {
    return this.readRecords(query, 1).length > 0;
  }

  public count(query: ChatOnlineFeatureStoreQuery = {}): number {
    return this.resolveCandidateIds(query).length;
  }

  public countDistinctEntities(query: ChatOnlineFeatureStoreQuery = {}): number {
    return unique(this.list(query).map((row) => row.entityKey)).length;
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

  public aggregateByEntity(entityKey: string): ChatOnlineFeatureAggregate {
    return this.aggregate({ entityKey });
  }

  public aggregateByRoom(roomId: ChatRoomId): ChatOnlineFeatureAggregate {
    return this.aggregate({ roomId });
  }

  public aggregateByUser(userId: ChatUserId): ChatOnlineFeatureAggregate {
    return this.aggregate({ userId });
  }

  public aggregateBySession(sessionId: ChatSessionId): ChatOnlineFeatureAggregate {
    return this.aggregate({ sessionId });
  }

  public multiAggregate(
    families: readonly ChatModelFamily[],
    query: Omit<ChatOnlineFeatureStoreQuery, 'family'> = {},
  ): ChatOnlineFeatureMultiAggregate {
    const now = this.clock.now();
    const sliced = families.slice(0, this.defaults.multiAggregateMaxFamilies);
    const aggregates: Partial<Record<ChatModelFamily, ChatOnlineFeatureAggregate>> = {};
    const allEntityKeys: string[] = [];
    let minFreshnessMs = Number.MAX_SAFE_INTEGER;

    for (const family of sliced) {
      const agg = this.aggregate({ ...query, family });
      aggregates[family] = agg;
      allEntityKeys.push(...agg.entityKeys);
      if (agg.freshnessMs < minFreshnessMs) minFreshnessMs = agg.freshnessMs;
    }

    return Object.freeze({
      generatedAt: now,
      aggregates: Object.freeze(aggregates),
      families: Object.freeze(sliced),
      entityKeys: unique(allEntityKeys),
      freshnessMs: minFreshnessMs === Number.MAX_SAFE_INTEGER ? this.defaults.staleMs : minFreshnessMs,
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

  public explainQuery(query: ChatOnlineFeatureStoreQuery = {}): ChatOnlineFeatureStoreQueryExplain {
    const limit = clampLimit(query.limit, this.defaults);
    const candidateIds = [...this.resolveCandidateIds(query)].slice(0, this.defaults.explainCandidateCap);
    const records = candidateIds
      .map((rowId) => this.byRowId.get(rowId))
      .filter((record): record is MutableChatOnlineFeatureStoreRecord => Boolean(record));

    const sinceMs = query.sinceMs ? (query.sinceMs as number) : Number.NEGATIVE_INFINITY;
    const untilMs = query.untilMs ? (query.untilMs as number) : Number.POSITIVE_INFINITY;
    const now = this.clock.now();

    const rejectedByTime: string[] = [];
    const rejectedByTags: string[] = [];
    const rejectedByEntityKind: string[] = [];
    const rejectedByFreshness: string[] = [];
    const matched: string[] = [];

    for (const record of records) {
      const freshnessPct = scoreToPct(1 - (((now as number) - (record.row.generatedAt as number)) / this.defaults.entityProfileStaleAgeMs));
      if ((record.row.generatedAt as number) < sinceMs || (record.row.generatedAt as number) > untilMs) {
        rejectedByTime.push(record.row.rowId);
        continue;
      }
      if (query.tags?.length && !query.tags.some((tag) => record.row.tags.includes(tag))) {
        rejectedByTags.push(record.row.rowId);
        continue;
      }
      if (query.entityKind && record.row.entityKind !== query.entityKind) {
        rejectedByEntityKind.push(record.row.rowId);
        continue;
      }
      if (query.minFreshnessPct != null && freshnessPct < query.minFreshnessPct) {
        rejectedByFreshness.push(record.row.rowId);
        continue;
      }
      matched.push(record.row.rowId);
    }

    return Object.freeze({
      query,
      generatedAt: now,
      candidateIds: Object.freeze(candidateIds),
      matchedIds: Object.freeze(matched.slice(0, limit)),
      rejectedByTime: Object.freeze(rejectedByTime),
      rejectedByTags: Object.freeze(rejectedByTags),
      rejectedByEntityKind: Object.freeze(rejectedByEntityKind),
      rejectedByFreshness: Object.freeze(rejectedByFreshness),
      finalLimit: limit,
      summary: `candidates=${candidateIds.length} matched=${matched.length} query=[${summarizeQuery(query)}]`,
    });
  }

  public timeline(
    query: ChatOnlineFeatureStoreQuery,
    scalarKey: string,
    limit = this.defaults.trendFrameLimit,
  ): ChatOnlineFeatureStoreTimeline {
    const rows = this.list({ ...query, limit });
    const points = rows
      .slice()
      .reverse()
      .map((row) =>
        Object.freeze({
          frameAt: row.generatedAt,
          rowId: row.rowId,
          family: row.family,
          entityKey: row.entityKey,
          scalarValue: safeNumber(row.scalarFeatures[scalarKey], 0),
          dominantChannel: row.channelId,
          tags: Object.freeze([...row.tags]),
        } satisfies ChatOnlineFeatureStoreTimelinePoint),
      );

    const values = points.map((point) => point.scalarValue);

    return Object.freeze({
      key: scalarKey,
      generatedAt: this.clock.now(),
      points: Object.freeze(points),
      minValue: values.length ? Math.min(...values) : 0,
      maxValue: values.length ? Math.max(...values) : 0,
      avgValue: mean(values),
      slope: slope(values),
    });
  }

  public replayFrames(
    query: ChatOnlineFeatureStoreQuery = {},
    limit = this.defaults.replayFrameLimit,
  ): readonly ChatOnlineFeatureStoreReplayFrame[] {
    return Object.freeze(this.list({ ...query, limit }).map((row) => toReplayFrame(row)));
  }

  public compareWindows(
    entityKey: string,
    family: Nullable<ChatModelFamily>,
    splitMs: UnixMs,
  ): Nullable<ChatOnlineFeatureWindowComparison> {
    const now = this.clock.now();
    const rows = this.list({ entityKey, family: family ?? undefined });

    if (rows.length < this.defaults.windowComparisonMinRows * 2) return null;

    const current = rows.filter((r) => (r.generatedAt as number) >= (splitMs as number));
    const prior = rows.filter((r) => (r.generatedAt as number) < (splitMs as number));

    if (!current.length || !prior.length) return null;

    const currentScalars = mergeScalarFeatures(current, now, this.defaults);
    const priorScalars = mergeScalarFeatures(prior, now, this.defaults);
    const { delta, drifted, maxAbs, meanAbs } = computeScalarDelta(
      currentScalars,
      priorScalars,
      this.defaults.driftThresholdDefault,
    );

    return Object.freeze({
      entityKey,
      family,
      generatedAt: now,
      currentScalars,
      priorScalars,
      deltaScalars: delta,
      driftedKeys: Object.freeze(drifted),
      maxAbsDelta: maxAbs,
      meanAbsDelta: meanAbs,
    });
  }

  public compareQueries(
    currentQuery: ChatOnlineFeatureStoreQuery,
    priorQuery: ChatOnlineFeatureStoreQuery,
    driftThreshold = this.defaults.driftThresholdDefault,
  ): ChatOnlineFeatureWindowComparison {
    const now = this.clock.now();
    const currentRows = this.list(currentQuery);
    const priorRows = this.list(priorQuery);
    const currentScalars = mergeScalarFeatures(currentRows, now, this.defaults);
    const priorScalars = mergeScalarFeatures(priorRows, now, this.defaults);
    const { delta, drifted, maxAbs, meanAbs } = computeScalarDelta(currentScalars, priorScalars, driftThreshold);

    return Object.freeze({
      entityKey: currentQuery.entityKey ?? priorQuery.entityKey ?? '*',
      family: currentQuery.family ?? priorQuery.family ?? null,
      generatedAt: now,
      currentScalars,
      priorScalars,
      deltaScalars: delta,
      driftedKeys: Object.freeze(drifted),
      maxAbsDelta: maxAbs,
      meanAbsDelta: meanAbs,
    });
  }

  public scalarFor(
    query: ChatOnlineFeatureStoreQuery,
    key: string,
    fallback?: number,
  ): number {
    const agg = this.aggregate(query);
    return safeNumber(agg.scalarFeatures[key], fallback ?? this.defaults.scalarAccessFallback);
  }

  public categoryFor(
    query: ChatOnlineFeatureStoreQuery,
    key: string,
    fallback?: string,
  ): string {
    const agg = this.aggregate(query);
    const value = agg.categoricalFeatures[key];
    return typeof value === 'string' && value ? value : (fallback ?? this.defaults.categoryAccessFallback);
  }

  public scalarCompare(
    queryA: ChatOnlineFeatureStoreQuery,
    queryB: ChatOnlineFeatureStoreQuery,
    key: string,
  ): { a: number; b: number; delta: number; direction: 'A_HIGHER' | 'B_HIGHER' | 'EQUAL' } {
    const a = this.scalarFor(queryA, key);
    const b = this.scalarFor(queryB, key);
    const delta = a - b;
    return {
      a,
      b,
      delta,
      direction: Math.abs(delta) < 0.001 ? 'EQUAL' : delta > 0 ? 'A_HIGHER' : 'B_HIGHER',
    };
  }

  // ==========================================================================
  // MARK: Boards and diagnostics
  // ==========================================================================

  public stats(): ChatOnlineFeatureStoreStats {
    const records = [...this.byRowId.values()];
    const storedAts = records.map((record) => record.storedAt as number);
    return Object.freeze({
      rowCount: records.length,
      entityCount: this.byEntityKey.size,
      familyCount: familyCounts(records),
      oldestStoredAt: storedAts.length ? asUnixMs(Math.min(...storedAts)) : null,
      newestStoredAt: storedAts.length ? asUnixMs(Math.max(...storedAts)) : null,
      totalUpserts: this.totalUpserts,
      totalPrunes: this.totalPrunes,
      totalEvictions: this.totalEvictions,
      uniqueRoomIds: this.byRoomId.size,
      uniqueUserIds: this.byUserId.size,
      uniqueSessionIds: this.bySessionId.size,
    });
  }

  public snapshotSummary(limit = this.defaults.snapshotSummaryLimit): ChatOnlineFeatureStoreSnapshotSummary {
    const rows = [...this.byRowId.values()]
      .sort((left, right) => (right.row.generatedAt as number) - (left.row.generatedAt as number))
      .slice(0, limit)
      .map((record) => record.row);
    return snapshotSummaryFromRows(rows, this.clock.now());
  }

  public entityProfile(entityKey: string): Nullable<ChatOnlineFeatureEntityProfile> {
    const rowIds = this.byEntityKey.get(entityKey);
    if (!rowIds?.length) return null;

    const records = rowIds
      .map((id) => this.byRowId.get(id))
      .filter((r): r is MutableChatOnlineFeatureStoreRecord => Boolean(r))
      .sort((a, b) => (b.row.generatedAt as number) - (a.row.generatedAt as number));

    if (records.length < this.defaults.entityProfileMinRows) return null;

    const now = this.clock.now();
    const generatedAts = records.map((r) => r.row.generatedAt as number);
    const newestAt = Math.max(...generatedAts);
    const oldestAt = Math.min(...generatedAts);
    const freshnessPct = Math.round(
      clamp01(1 - (((now as number) - newestAt) / this.defaults.entityProfileStaleAgeMs)) * 100,
    );
    const coverage = computeEntityFamilyCoverage(records);
    const completenessPct = computeCompletenessPct(coverage);
    const latest = records[0]?.row;

    return Object.freeze({
      entityKey,
      entityKind: latest?.entityKind ?? 'USER',
      roomId: latest?.roomId ?? null,
      userId: latest?.userId ?? null,
      sessionId: latest?.sessionId ?? null,
      rowCount: records.length,
      familyCoverage: coverage,
      oldestRowAt: asUnixMs(oldestAt),
      newestRowAt: asUnixMs(newestAt),
      freshnessPct,
      dominantChannel: chooseDominantChannel(records.map((r) => r.row)),
      stale: (now as number) - newestAt > this.defaults.entityProfileStaleAgeMs,
      completenessPct,
    });
  }

  public entityProfiles(limit: number = Number(this.defaults.topEntitiesLimit)): readonly ChatOnlineFeatureEntityProfile[] {
    const profiles: ChatOnlineFeatureEntityProfile[] = [];
    for (const entityKey of this.byEntityKey.keys()) {
      const profile = this.entityProfile(entityKey);
      if (profile) profiles.push(profile);
    }
    return Object.freeze(
      profiles
        .sort((a, b) => b.rowCount - a.rowCount || b.freshnessPct - a.freshnessPct)
        .slice(0, limit),
    );
  }

  public entityBoard(limit = this.defaults.topEntitiesLimit): ChatOnlineFeatureStoreEntityBoard {
    const entities = this.entityProfiles(limit);
    return Object.freeze({
      generatedAt: this.clock.now(),
      entities,
      totalRows: entities.reduce((sum, entry) => sum + entry.rowCount, 0),
      avgFreshnessPct: mean(entities.map((entry) => entry.freshnessPct)),
      avgCompletenessPct: mean(entities.map((entry) => entry.completenessPct)),
    });
  }

  public topEntities(
    by: 'rowCount' | 'freshness' | 'completeness' = 'rowCount',
    limit = this.defaults.topEntitiesLimit,
  ): readonly ChatOnlineFeatureEntityProfile[] {
    const profiles = this.entityProfiles(limit * 2);
    const sorted = [...profiles].sort((a, b) => {
      if (by === 'freshness') return b.freshnessPct - a.freshnessPct;
      if (by === 'completeness') return b.completenessPct - a.completenessPct;
      return b.rowCount - a.rowCount;
    });
    return Object.freeze(sorted.slice(0, limit));
  }

  public familyBoard(): ChatOnlineFeatureStoreFamilyBoard {
    const now = this.clock.now();
    const entries = CHAT_MODEL_FAMILIES.map((family) => {
      const rows = this.list({ family, limit: this.defaults.maxRowsPerFamilyPerEntity * 8 });
      const freshnessValues = rows.map((row) => Math.max(0, (now as number) - (row.generatedAt as number)));
      return Object.freeze({
        family,
        rowCount: rows.length,
        entityCount: unique(rows.map((row) => row.entityKey)).length,
        avgFreshnessMs: mean(freshnessValues),
        dominantChannel: chooseDominantChannel(rows),
        hottestScalarKeys: hottestScalarKeys(mergeScalarFeatures(rows, now, this.defaults)),
      } satisfies ChatOnlineFeatureStoreFamilyBoardEntry);
    });

    return Object.freeze({
      generatedAt: now,
      entries: Object.freeze(entries),
    });
  }

  public tagBoard(limit = this.defaults.topTagLimit): ChatOnlineFeatureStoreTagBoard {
    const counts = new Map<string, { count: number; families: Set<ChatModelFamily>; entities: Set<string> }>();
    for (const record of this.byRowId.values()) {
      for (const tag of record.row.tags) {
        const current = counts.get(tag) ?? { count: 0, families: new Set<ChatModelFamily>(), entities: new Set<string>() };
        current.count += 1;
        current.families.add(record.row.family);
        current.entities.add(record.row.entityKey);
        counts.set(tag, current);
      }
    }

    const entries = [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([tag, state]) =>
        Object.freeze({
          tag,
          count: state.count,
          families: Object.freeze([...state.families].sort()),
          entityKeys: Object.freeze([...state.entities].sort()),
        } satisfies ChatOnlineFeatureStoreTagBoardEntry),
      );

    return Object.freeze({
      generatedAt: this.clock.now(),
      entries: Object.freeze(entries),
    });
  }

  public channelBoard(limit = this.defaults.topChannelLimit): ChatOnlineFeatureStoreChannelBoard {
    const counts = new Map<string, { count: number; families: Map<ChatModelFamily, number>; entities: Set<string> }>();
    for (const record of this.byRowId.values()) {
      const current = counts.get(record.row.channelId) ?? {
        count: 0,
        families: new Map<ChatModelFamily, number>(),
        entities: new Set<string>(),
      };
      current.count += 1;
      current.families.set(record.row.family, (current.families.get(record.row.family) ?? 0) + 1);
      current.entities.add(record.row.entityKey);
      counts.set(record.row.channelId, current);
    }

    const entries = [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([channelId, state]) =>
        Object.freeze({
          channelId,
          count: state.count,
          dominantFamilies: Object.freeze(
            [...state.families.entries()]
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
              .slice(0, 3)
              .map(([family]) => family),
          ),
          entityKeys: Object.freeze([...state.entities].sort()),
        } satisfies ChatOnlineFeatureStoreChannelBoardEntry),
      );

    return Object.freeze({
      generatedAt: this.clock.now(),
      entries: Object.freeze(entries),
    });
  }

  public roomBoard(limit = this.defaults.topRoomLimit): ChatOnlineFeatureStoreRoomBoard {
    const now = this.clock.now();
    const entries = [...this.byRoomId.entries()]
      .map(([roomId, rowIds]) => {
        const rows = rowIds
          .map((id) => this.byRowId.get(id)?.row ?? null)
          .filter((row): row is ChatFeatureRow => Boolean(row));
        const familyCounter = new Map<ChatModelFamily, number>();
        for (const row of rows) {
          familyCounter.set(row.family, (familyCounter.get(row.family) ?? 0) + 1);
        }
        const hottestFamily = [...familyCounter.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        return Object.freeze({
          roomId: roomId as ChatRoomId,
          rowCount: rows.length,
          entityCount: unique(rows.map((row) => row.entityKey)).length,
          hottestFamily,
          pressureTier: pressureTierFromRows(rows),
          roomHeat01: roomHeatFromRows(rows, now, this.defaults),
        } satisfies ChatOnlineFeatureStoreRoomBoardEntry);
      })
      .sort((a, b) => b.rowCount - a.rowCount || a.roomId.localeCompare(b.roomId))
      .slice(0, limit);

    return Object.freeze({
      generatedAt: now,
      entries: Object.freeze(entries),
    });
  }

  public userBoard(limit = this.defaults.topUserLimit): ChatOnlineFeatureStoreUserBoard {
    const entries = [...this.byUserId.entries()]
      .map(([userId, rowIds]) => {
        const rows = rowIds
          .map((id) => this.byRowId.get(id)?.row ?? null)
          .filter((row): row is ChatFeatureRow => Boolean(row));
        const families = new Map<ChatModelFamily, number>();
        for (const row of rows) {
          families.set(row.family, (families.get(row.family) ?? 0) + 1);
        }
        const hottestFamily = [...families.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        const freshestAt = rows.length ? asUnixMs(Math.max(...rows.map((row) => row.generatedAt as number))) : null;
        return Object.freeze({
          userId: userId as ChatUserId,
          rowCount: rows.length,
          sessionCount: uniqueDefined(rows.map((row) => row.sessionId as Nullable<ChatSessionId>)).length,
          freshestAt,
          hottestFamily,
        } satisfies ChatOnlineFeatureStoreUserBoardEntry);
      })
      .sort((a, b) => b.rowCount - a.rowCount || a.userId.localeCompare(b.userId))
      .slice(0, limit);

    return Object.freeze({
      generatedAt: this.clock.now(),
      entries: Object.freeze(entries),
    });
  }

  public sessionBoard(limit = this.defaults.topSessionLimit): ChatOnlineFeatureStoreSessionBoard {
    const now = this.clock.now();
    const entries = [...this.bySessionId.entries()]
      .map(([sessionId, rowIds]) => {
        const rows = rowIds
          .map((id) => this.byRowId.get(id)?.row ?? null)
          .filter((row): row is ChatFeatureRow => Boolean(row));
        const freshest = rows.length ? Math.max(...rows.map((row) => row.generatedAt as number)) : 0;
        return Object.freeze({
          sessionId: sessionId as ChatSessionId,
          rowCount: rows.length,
          userCount: uniqueDefined(rows.map((row) => row.userId as Nullable<ChatUserId>)).length,
          familyCount: unique(rows.map((row) => row.family)).length,
          freshnessMs: freshest ? Math.max(0, (now as number) - freshest) : this.defaults.staleMs,
        } satisfies ChatOnlineFeatureStoreSessionBoardEntry);
      })
      .sort((a, b) => b.rowCount - a.rowCount || a.sessionId.localeCompare(b.sessionId))
      .slice(0, limit);

    return Object.freeze({
      generatedAt: now,
      entries: Object.freeze(entries),
    });
  }

  public indexHealth(): ChatOnlineFeatureStoreIndexHealth {
    const rowCount = this.byRowId.size;
    const densest = [...this.byEntityKey.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? null;
    const densestEntityRows = densest?.[1].length ?? 0;
    const skewPct = rowCount > 0 ? densestEntityRows / rowCount : 0;
    const indexEntries = [
      this.byEntityKey.size,
      this.byFamily.size,
      this.byRoomId.size,
      this.byUserId.size,
      this.bySessionId.size,
    ];
    const nonEmptyIndexes = indexEntries.filter((count) => count > 0).length;
    const sparsityPct = indexEntries.length > 0 ? 1 - (nonEmptyIndexes / indexEntries.length) : 0;
    const warnings: string[] = [];

    if (skewPct >= this.defaults.indexSkewWarnThreshold) {
      warnings.push('Entity index skew is high.');
    }
    if (sparsityPct >= this.defaults.indexSparseWarnThreshold) {
      warnings.push('Index coverage is too sparse for balanced reads.');
    }
    if (this.byRowId.size === 0) {
      warnings.push('Store is empty.');
    }

    return Object.freeze({
      generatedAt: this.clock.now(),
      rowCount,
      entityIndexCardinality: this.byEntityKey.size,
      familyIndexCardinality: this.byFamily.size,
      roomIndexCardinality: this.byRoomId.size,
      userIndexCardinality: this.byUserId.size,
      sessionIndexCardinality: this.bySessionId.size,
      densestEntityKey: densest?.[0] ?? null,
      densestEntityRows,
      sparsityPct: Number(sparsityPct.toFixed(4)),
      skewPct: Number(skewPct.toFixed(4)),
      warnings: Object.freeze(warnings),
    });
  }

  public backpressureStatus(): ChatOnlineFeatureStoreBackpressureStatus {
    const rowUsagePct = this.byRowId.size / this.defaults.maxRows;
    const entityUsagePct = this.byEntityKey.size / this.defaults.maxEntities;
    const watchUsagePct = this.watches.size / this.defaults.watchCapEntries;
    const mutationLedgerUsagePct = this.mutationLedger.length / this.defaults.mutationLedgerLimit;
    const tombstoneUsagePct = this.tombstones.length / this.defaults.tombstoneLimit;

    const maxUsage = Math.max(rowUsagePct, entityUsagePct, watchUsagePct, mutationLedgerUsagePct, tombstoneUsagePct);
    const notes: string[] = [];
    if (rowUsagePct > 0.8) notes.push('Row capacity is nearing the configured ceiling.');
    if (entityUsagePct > 0.8) notes.push('Entity capacity is nearing the configured ceiling.');
    if (watchUsagePct > 0.8) notes.push('Watch capacity is nearing the configured ceiling.');
    if (mutationLedgerUsagePct > 0.8) notes.push('Mutation ledger capacity is nearing the configured ceiling.');
    if (tombstoneUsagePct > 0.8) notes.push('Tombstone capacity is nearing the configured ceiling.');

    let risk: ChatOnlineFeatureStoreBackpressureStatus['risk'] = 'LOW';
    if (maxUsage >= 0.95) risk = 'CRITICAL';
    else if (maxUsage >= 0.85) risk = 'HIGH';
    else if (maxUsage >= 0.7) risk = 'MEDIUM';

    return Object.freeze({
      generatedAt: this.clock.now(),
      rowUsagePct: Number(rowUsagePct.toFixed(4)),
      entityUsagePct: Number(entityUsagePct.toFixed(4)),
      watchUsagePct: Number(watchUsagePct.toFixed(4)),
      mutationLedgerUsagePct: Number(mutationLedgerUsagePct.toFixed(4)),
      tombstoneUsagePct: Number(tombstoneUsagePct.toFixed(4)),
      risk,
      notes: Object.freeze(notes),
    });
  }

  public consistencyReport(): ChatOnlineFeatureStoreConsistencyReport {
    const orphanedRowIds: string[] = [];
    const missingFamilyIndexRowIds: string[] = [];
    const missingEntityIndexRowIds: string[] = [];
    const missingRoomIndexRowIds: string[] = [];
    const missingUserIndexRowIds: string[] = [];
    const missingSessionIndexRowIds: string[] = [];
    const duplicateIndexReferences: string[] = [];

    const seenEntityRefs = new Set<string>();
    const seenFamilyRefs = new Set<string>();
    const seenRoomRefs = new Set<string>();
    const seenUserRefs = new Set<string>();
    const seenSessionRefs = new Set<string>();

    for (const [rowId, record] of this.byRowId.entries()) {
      const entityBucket = this.byEntityKey.get(record.row.entityKey) ?? [];
      const familyBucket = this.byFamily.get(record.row.family) ?? [];
      const roomBucket = record.row.roomId ? (this.byRoomId.get(record.row.roomId) ?? []) : [];
      const userBucket = record.row.userId ? (this.byUserId.get(record.row.userId) ?? []) : [];
      const sessionBucket = record.row.sessionId ? (this.bySessionId.get(record.row.sessionId) ?? []) : [];

      if (!entityBucket.includes(rowId)) missingEntityIndexRowIds.push(rowId);
      if (!familyBucket.includes(rowId)) missingFamilyIndexRowIds.push(rowId);
      if (record.row.roomId && !roomBucket.includes(rowId)) missingRoomIndexRowIds.push(rowId);
      if (record.row.userId && !userBucket.includes(rowId)) missingUserIndexRowIds.push(rowId);
      if (record.row.sessionId && !sessionBucket.includes(rowId)) missingSessionIndexRowIds.push(rowId);
    }

    for (const [entityKey, ids] of this.byEntityKey.entries()) {
      for (const id of ids) {
        const refKey = `entity:${entityKey}:${id}`;
        if (seenEntityRefs.has(refKey)) duplicateIndexReferences.push(refKey);
        seenEntityRefs.add(refKey);
        if (!this.byRowId.has(id)) orphanedRowIds.push(id);
      }
    }

    for (const [family, ids] of this.byFamily.entries()) {
      for (const id of ids) {
        const refKey = `family:${family}:${id}`;
        if (seenFamilyRefs.has(refKey)) duplicateIndexReferences.push(refKey);
        seenFamilyRefs.add(refKey);
        if (!this.byRowId.has(id)) orphanedRowIds.push(id);
      }
    }

    for (const [roomId, ids] of this.byRoomId.entries()) {
      for (const id of ids) {
        const refKey = `room:${roomId}:${id}`;
        if (seenRoomRefs.has(refKey)) duplicateIndexReferences.push(refKey);
        seenRoomRefs.add(refKey);
        if (!this.byRowId.has(id)) orphanedRowIds.push(id);
      }
    }

    for (const [userId, ids] of this.byUserId.entries()) {
      for (const id of ids) {
        const refKey = `user:${userId}:${id}`;
        if (seenUserRefs.has(refKey)) duplicateIndexReferences.push(refKey);
        seenUserRefs.add(refKey);
        if (!this.byRowId.has(id)) orphanedRowIds.push(id);
      }
    }

    for (const [sessionId, ids] of this.bySessionId.entries()) {
      for (const id of ids) {
        const refKey = `session:${sessionId}:${id}`;
        if (seenSessionRefs.has(refKey)) duplicateIndexReferences.push(refKey);
        seenSessionRefs.add(refKey);
        if (!this.byRowId.has(id)) orphanedRowIds.push(id);
      }
    }

    const ok =
      orphanedRowIds.length === 0 &&
      missingFamilyIndexRowIds.length === 0 &&
      missingEntityIndexRowIds.length === 0 &&
      missingRoomIndexRowIds.length === 0 &&
      missingUserIndexRowIds.length === 0 &&
      missingSessionIndexRowIds.length === 0 &&
      duplicateIndexReferences.length === 0;

    return Object.freeze({
      generatedAt: this.clock.now(),
      orphanedRowIds: Object.freeze([...unique(orphanedRowIds)].sort()),
      missingFamilyIndexRowIds: Object.freeze([...unique(missingFamilyIndexRowIds)].sort()),
      missingEntityIndexRowIds: Object.freeze([...unique(missingEntityIndexRowIds)].sort()),
      missingRoomIndexRowIds: Object.freeze([...unique(missingRoomIndexRowIds)].sort()),
      missingUserIndexRowIds: Object.freeze([...unique(missingUserIndexRowIds)].sort()),
      missingSessionIndexRowIds: Object.freeze([...unique(missingSessionIndexRowIds)].sort()),
      duplicateIndexReferences: Object.freeze([...unique(duplicateIndexReferences)].sort()),
      ok,
    });
  }

  public mutationLedgerEntries(limit = this.defaults.mutationLedgerLimit): readonly ChatOnlineFeatureStoreMutationReceipt[] {
    return Object.freeze(this.mutationLedger.slice(-limit));
  }

  public tombstoneLedgerEntries(limit = this.defaults.tombstoneLimit): readonly ChatOnlineFeatureStoreTombstone[] {
    return Object.freeze(this.tombstones.slice(-limit));
  }

  public readLedgerEntries(limit = this.defaults.snapshotSummaryLimit): readonly ChatOnlineFeatureStoreReadReceipt[] {
    return Object.freeze(this.readLedger.slice(-limit));
  }

  public watchTriggerEntries(limit = this.defaults.watchTriggerHistoryLimit): readonly ChatOnlineFeatureStoreWatchTrigger[] {
    return Object.freeze(this.watchTriggerLedger.slice(-limit));
  }

  // ==========================================================================
  // MARK: Serialization and snapshots
  // ==========================================================================

  public serialize(limit: number = this.defaults.serializationLimit): ChatOnlineFeatureStoreHydrationSnapshot {
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

  public serializeDelta(sinceMs: UnixMs): ChatOnlineFeatureStoreDeltaSnapshot {
    const now = this.clock.now();
    const added: ChatFeatureRow[] = [];

    for (const record of this.byRowId.values()) {
      if ((record.storedAt as number) >= (sinceMs as number)) {
        added.push(record.row);
      }
    }

    added.sort((left, right) => (right.generatedAt as number) - (left.generatedAt as number));
    const sliced = added.slice(0, this.defaults.deltaSerializationLimit);

    return Object.freeze({
      generatedAt: now,
      sinceMs,
      addedRows: Object.freeze(sliced),
      removedRowIds: Object.freeze([]),
      rowCount: this.byRowId.size,
    });
  }

  public copyState(): ChatOnlineFeatureStoreHydrationSnapshot {
    return this.serialize(this.byRowId.size);
  }

  public summarizeHydrationSnapshot(snapshot: ChatOnlineFeatureStoreHydrationSnapshot): ChatOnlineFeatureStoreSnapshotSummary {
    return snapshotSummaryFromRows(snapshot.rows, snapshot.generatedAt);
  }

  public summarizeDeltaSnapshot(delta: ChatOnlineFeatureStoreDeltaSnapshot): Readonly<Record<string, JsonValue>> {
    return Object.freeze({
      generatedAt: delta.generatedAt,
      sinceMs: delta.sinceMs,
      addedRows: delta.addedRows.length,
      removedRows: delta.removedRowIds.length,
      rowCount: delta.rowCount,
    });
  }

  // ==========================================================================
  // MARK: Watches
  // ==========================================================================

  public addWatch(id: string, query: ChatOnlineFeatureStoreQuery): void {
    if (this.watches.size >= this.defaults.watchCapEntries) {
      this.logger.warn('OnlineFeatureStore watch cap reached; ignoring new watch.', { id });
      return;
    }
    this.watches.set(id, {
      query,
      addedAt: this.clock.now(),
      lastTriggeredAt: null,
      triggerCount: 0,
    });
  }

  public removeWatch(id: string): boolean {
    return this.watches.delete(id);
  }

  public listWatches(): readonly ChatOnlineFeatureStoreWatchEntry[] {
    return Object.freeze(
      [...this.watches.entries()].map(([id, w]) =>
        Object.freeze({
          id,
          query: w.query,
          addedAt: w.addedAt,
          lastTriggeredAt: w.lastTriggeredAt,
          triggerCount: w.triggerCount,
        }),
      ),
    );
  }

  public clearWatches(): number {
    const count = this.watches.size;
    this.watches.clear();
    return count;
  }

  // ==========================================================================
  // MARK: Private implementation
  // ==========================================================================

  private notifyWatches(newRows: readonly ChatFeatureRow[]): void {
    const now = this.clock.now();
    for (const [watchId, watchState] of this.watches.entries()) {
      const query = watchState.query;
      const matches = newRows.filter((row) => {
        if (query.family && row.family !== query.family) return false;
        if (query.roomId && row.roomId !== query.roomId) return false;
        if (query.userId && row.userId !== query.userId) return false;
        if (query.sessionId && row.sessionId !== query.sessionId) return false;
        if (query.entityKey && row.entityKey !== query.entityKey) return false;
        if (query.entityKind && row.entityKind !== query.entityKind) return false;
        if (query.tags?.length && !query.tags.some((t) => row.tags.includes(t))) return false;
        return true;
      });
      if (matches.length > 0) {
        watchState.lastTriggeredAt = now;
        watchState.triggerCount += 1;
        const trigger = buildWatchTriggerSummary(watchId, matches);
        this.watchTriggerLedger.push(trigger);
        while (this.watchTriggerLedger.length > this.defaults.watchTriggerHistoryLimit) {
          this.watchTriggerLedger.shift();
        }
      }
    }
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
    const untilMs = query.untilMs ? (query.untilMs as number) : Number.POSITIVE_INFINITY;
    const now = this.clock.now();

    const records = candidateIds
      .map((rowId) => this.byRowId.get(rowId))
      .filter((record): record is MutableChatOnlineFeatureStoreRecord => Boolean(record))
      .filter((record) => (record.row.generatedAt as number) >= sinceMs)
      .filter((record) => (record.row.generatedAt as number) <= untilMs)
      .filter((record) => {
        if (!query.tags?.length) return true;
        return query.tags.some((t) => record.row.tags.includes(t));
      })
      .filter((record) => {
        if (!query.entityKind) return true;
        return record.row.entityKind === query.entityKind;
      })
      .filter((record) => {
        if (query.minFreshnessPct == null) return true;
        const freshnessPct = scoreToPct(
          1 - (((now as number) - (record.row.generatedAt as number)) / this.defaults.entityProfileStaleAgeMs),
        );
        return freshnessPct >= query.minFreshnessPct;
      })
      .sort((left, right) => (right.row.generatedAt as number) - (left.row.generatedAt as number))
      .slice(0, limit);

    for (const record of records) {
      record.lastReadAt = now;
      record.readCount += 1;
    }

    const receipt = Object.freeze({
      query,
      generatedAt: now,
      resolvedCandidateCount: candidateIds.length,
      returnedCount: records.length,
      rowIds: Object.freeze(records.map((record) => record.row.rowId)),
      entityKeys: Object.freeze(unique(records.map((record) => record.row.entityKey))),
    } satisfies ChatOnlineFeatureStoreReadReceipt);
    this.readLedger.push(receipt);
    while (this.readLedger.length > this.defaults.snapshotSummaryLimit) {
      this.readLedger.shift();
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

  private enforcePerEntityCaps(): number {
    let removed = 0;
    if (this.byEntityKey.size > this.defaults.maxEntities) {
      const overflow = this.byEntityKey.size - this.defaults.maxEntities;
      const victims = [...this.byEntityKey.entries()]
        .sort((left, right) => (left[1].length - right[1].length) || left[0].localeCompare(right[0]))
        .slice(0, overflow);
      for (const [, rowIds] of victims) {
        for (const rowId of rowIds) {
          if (this.deleteRow(rowId, 'entity_overflow')) {
            removed += 1;
          }
        }
      }
    }

    for (const [entityKey, rowIds] of this.byEntityKey.entries()) {
      const records = rowIds
        .map((rowId) => this.byRowId.get(rowId))
        .filter((record): record is MutableChatOnlineFeatureStoreRecord => Boolean(record))
        .sort((left, right) => (right.row.generatedAt as number) - (left.row.generatedAt as number));

      if (records.length > this.defaults.maxRowsPerEntity) {
        for (const record of records.slice(this.defaults.maxRowsPerEntity)) {
          if (this.deleteRow(record.row.rowId, 'entity_row_cap')) {
            removed += 1;
          }
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
            if (this.deleteRow(record.row.rowId, 'family_row_cap')) {
              removed += 1;
            }
          }
        }
      }

      if (!this.byEntityKey.has(entityKey)) {
        this.logger.debug('Entity evicted during cap enforcement.', { entityKey });
      }
    }

    return removed;
  }

  private pushMutationReceipt(input: {
    kind: ChatOnlineFeatureStoreMutationReceipt['kind'];
    affectedRowIds: readonly string[];
    affectedEntityKeys: readonly string[];
    affectedFamilies: readonly ChatModelFamily[];
    rowCountBefore: number;
    rowCountAfter: number;
    metadata: Readonly<Record<string, JsonValue>>;
  }): void {
    const now = this.clock.now();
    this.mutationSeed += 1;
    const receipt: ChatOnlineFeatureStoreMutationReceipt = Object.freeze({
      mutationId: makeMutationId(input.kind, now, this.mutationSeed),
      kind: input.kind,
      generatedAt: now,
      affectedRowIds: Object.freeze(unique(input.affectedRowIds)),
      affectedEntityKeys: Object.freeze(unique(input.affectedEntityKeys)),
      affectedFamilies: Object.freeze([...unique(input.affectedFamilies)].sort()),
      rowCountBefore: input.rowCountBefore,
      rowCountAfter: input.rowCountAfter,
      metadata: Object.freeze({ ...input.metadata }),
    });
    this.mutationLedger.push(receipt);
    while (this.mutationLedger.length > this.defaults.mutationLedgerLimit) {
      this.mutationLedger.shift();
    }
  }

  private pushTombstone(row: ChatFeatureRow, reason: string): void {
    this.tombstones.push(
      Object.freeze({
        rowId: row.rowId,
        entityKey: row.entityKey,
        family: row.family,
        deletedAt: this.clock.now(),
        reason,
      }),
    );
    while (this.tombstones.length > this.defaults.tombstoneLimit) {
      this.tombstones.shift();
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

export function multiAggregateOnlineFeatureWindow(
  rowsOrBatch: readonly ChatFeatureRow[] | ChatFeatureIngestResult,
  families: readonly ChatModelFamily[],
): ChatOnlineFeatureMultiAggregate {
  const store = new OnlineFeatureStore({
    defaults: {
      maxRows: Math.max(CHAT_FEATURE_INGESTOR_DEFAULTS.transcriptWindowMessages * 16, 1_024),
      serializationLimit: 1_024,
    } as unknown as Partial<typeof CHAT_ONLINE_FEATURE_STORE_DEFAULTS>,
  });
  store.upsert(isIngestResult(rowsOrBatch) ? rowsOrBatch.rows : rowsOrBatch);
  return store.multiAggregate(families);
}

export function scalarFromAggregate(
  aggregate: ChatOnlineFeatureAggregate,
  key: string,
  fallback = 0,
): number {
  const value = aggregate.scalarFeatures[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function categoryFromAggregate(
  aggregate: ChatOnlineFeatureAggregate,
  key: string,
  fallback = 'UNKNOWN',
): string {
  const value = aggregate.categoricalFeatures[key];
  return typeof value === 'string' && value ? value : fallback;
}

export function inferenceWindowFreshnessMs(
  window: ChatOnlineInferenceWindow,
  nowMs?: number,
): number {
  const now = nowMs ?? Date.now();
  return Math.max(0, now - (window.generatedAt as number));
}

export function inferenceWindowIsStale(
  window: ChatOnlineInferenceWindow,
  staleThresholdMs: number,
  nowMs?: number,
): boolean {
  return inferenceWindowFreshnessMs(window, nowMs) > staleThresholdMs;
}

export function aggregateSummaryLine(agg: ChatOnlineFeatureAggregate): string {
  return [
    `family=${agg.family ?? 'ALL'}`,
    `rows=${agg.rows.length}`,
    `channel=${agg.dominantChannel}`,
    `freshness=${Math.round(agg.freshnessMs / 1000)}s`,
    `entities=${agg.entityKeys.length}`,
    `tags=${agg.tags.length}`,
  ].join(' | ');
}

export function summarizeEntityProfile(profile: ChatOnlineFeatureEntityProfile): string {
  return [
    `entity=${profile.entityKey}`,
    `rows=${profile.rowCount}`,
    `freshness=${profile.freshnessPct}%`,
    `completeness=${profile.completenessPct}%`,
    `channel=${profile.dominantChannel}`,
  ].join(' | ');
}

export function summarizeWindowComparison(comparison: ChatOnlineFeatureWindowComparison): string {
  return [
    `entity=${comparison.entityKey}`,
    `family=${comparison.family ?? 'ALL'}`,
    `drifted=${comparison.driftedKeys.length}`,
    `maxAbsDelta=${comparison.maxAbsDelta.toFixed(4)}`,
    `meanAbsDelta=${comparison.meanAbsDelta.toFixed(4)}`,
  ].join(' | ');
}

export function summarizeBackpressure(status: ChatOnlineFeatureStoreBackpressureStatus): string {
  return [
    `risk=${status.risk}`,
    `rows=${Math.round(status.rowUsagePct * 100)}%`,
    `entities=${Math.round(status.entityUsagePct * 100)}%`,
    `watches=${Math.round(status.watchUsagePct * 100)}%`,
    `ledger=${Math.round(status.mutationLedgerUsagePct * 100)}%`,
    `tombstones=${Math.round(status.tombstoneUsagePct * 100)}%`,
  ].join(' | ');
}

export function summarizeIndexHealth(health: ChatOnlineFeatureStoreIndexHealth): string {
  return [
    `rows=${health.rowCount}`,
    `entities=${health.entityIndexCardinality}`,
    `families=${health.familyIndexCardinality}`,
    `skew=${Math.round(health.skewPct * 100)}%`,
    `sparsity=${Math.round(health.sparsityPct * 100)}%`,
    `warnings=${health.warnings.length}`,
  ].join(' | ');
}

export function summarizeQueryExplain(explain: ChatOnlineFeatureStoreQueryExplain): string {
  return [
    explain.summary,
    `rejectedByTime=${explain.rejectedByTime.length}`,
    `rejectedByTags=${explain.rejectedByTags.length}`,
    `rejectedByEntityKind=${explain.rejectedByEntityKind.length}`,
    `rejectedByFreshness=${explain.rejectedByFreshness.length}`,
  ].join(' | ');
}

export function summarizeReadReceipt(receipt: ChatOnlineFeatureStoreReadReceipt): string {
  return [
    `returned=${receipt.returnedCount}`,
    `candidates=${receipt.resolvedCandidateCount}`,
    `entities=${receipt.entityKeys.length}`,
    `query=${summarizeQuery(receipt.query)}`,
  ].join(' | ');
}

export function summarizeMutationReceipt(receipt: ChatOnlineFeatureStoreMutationReceipt): string {
  return [
    `kind=${receipt.kind}`,
    `rows=${receipt.affectedRowIds.length}`,
    `entities=${receipt.affectedEntityKeys.length}`,
    `families=${receipt.affectedFamilies.length}`,
    `before=${receipt.rowCountBefore}`,
    `after=${receipt.rowCountAfter}`,
  ].join(' | ');
}

export function summarizePruneReceipt(receipt: ChatOnlineFeatureStorePruneReceipt): string {
  return [
    `removed=${receipt.removed}`,
    `expired=${receipt.expired}`,
    `stale=${receipt.stale}`,
    `overflow=${receipt.overflow}`,
    `capEvictions=${receipt.capEvictions}`,
    `after=${receipt.rowCountAfter}`,
  ].join(' | ');
}

export function summarizeReplayFrame(frame: ChatOnlineFeatureStoreReplayFrame): string {
  return [
    `frame=${frame.frameId}`,
    `entity=${frame.entityKey}`,
    `family=${frame.family}`,
    `channel=${frame.channelId}`,
    `tags=${frame.tags.length}`,
  ].join(' | ');
}

export function summarizeTimeline(timeline: ChatOnlineFeatureStoreTimeline): string {
  return [
    `key=${timeline.key}`,
    `points=${timeline.points.length}`,
    `min=${timeline.minValue.toFixed(4)}`,
    `max=${timeline.maxValue.toFixed(4)}`,
    `avg=${timeline.avgValue.toFixed(4)}`,
    `slope=${timeline.slope.toFixed(4)}`,
  ].join(' | ');
}

export function summarizeSnapshotSummary(summary: ChatOnlineFeatureStoreSnapshotSummary): string {
  return [
    `rows=${summary.rowCount}`,
    `entities=${summary.entityCount}`,
    `families=${summary.families.length}`,
    `rooms=${summary.rooms.length}`,
    `users=${summary.users.length}`,
    `sessions=${summary.sessions.length}`,
    `tags=${summary.tags.length}`,
  ].join(' | ');
}

export function summarizeConsistency(report: ChatOnlineFeatureStoreConsistencyReport): string {
  return [
    `ok=${report.ok}`,
    `orphans=${report.orphanedRowIds.length}`,
    `missingEntityIndex=${report.missingEntityIndexRowIds.length}`,
    `missingFamilyIndex=${report.missingFamilyIndexRowIds.length}`,
    `duplicates=${report.duplicateIndexReferences.length}`,
  ].join(' | ');
}

// ============================================================================
// MARK: Rich namespace
// ============================================================================

export const CHAT_ONLINE_FEATURE_STORE_NAMESPACE = Object.freeze({
  moduleName: CHAT_ONLINE_FEATURE_STORE_MODULE_NAME,
  version: CHAT_ONLINE_FEATURE_STORE_VERSION,
  runtimeLaws: CHAT_ONLINE_FEATURE_STORE_RUNTIME_LAWS,
  defaults: CHAT_ONLINE_FEATURE_STORE_DEFAULTS,

  create: createOnlineFeatureStore,
  hydrate: hydrateOnlineFeatureStore,

  aggregateWindow: aggregateOnlineFeatureWindow,
  multiAggregateWindow: multiAggregateOnlineFeatureWindow,
  scalarFromAggregate,
  categoryFromAggregate,
  inferenceWindowFreshnessMs,
  inferenceWindowIsStale,

  aggregateSummaryLine,
  summarizeEntityProfile,
  summarizeWindowComparison,
  summarizeBackpressure,
  summarizeIndexHealth,
  summarizeQueryExplain,
  summarizeReadReceipt,
  summarizeMutationReceipt,
  summarizePruneReceipt,
  summarizeReplayFrame,
  summarizeTimeline,
  summarizeSnapshotSummary,
  summarizeConsistency,
} as const);

export default OnlineFeatureStore;

// ============================================================================
// MARK: Extended helper deck
// ============================================================================


export function isOnlineContextFamily(value: ChatModelFamily): boolean {
  return value === 'ONLINE_CONTEXT';
}

export function summarizeOnlineContextAggregate(
  aggregate: ChatOnlineFeatureAggregate,
): string {
  return [
    'expected=ONLINE_CONTEXT',
    `actual=${aggregate.family ?? 'ALL'}`,
    `rows=${aggregate.rows.length}`,
    `entities=${aggregate.entityKeys.length}`,
    `channel=${aggregate.dominantChannel}`,
  ].join(' | ');
}


export function isEngagementFamily(value: ChatModelFamily): boolean {
  return value === 'ENGAGEMENT';
}

export function summarizeEngagementAggregate(
  aggregate: ChatOnlineFeatureAggregate,
): string {
  return [
    'expected=ENGAGEMENT',
    `actual=${aggregate.family ?? 'ALL'}`,
    `rows=${aggregate.rows.length}`,
    `entities=${aggregate.entityKeys.length}`,
    `channel=${aggregate.dominantChannel}`,
  ].join(' | ');
}


export function isHaterTargetingFamily(value: ChatModelFamily): boolean {
  return value === 'HATER_TARGETING';
}

export function summarizeHaterTargetingAggregate(
  aggregate: ChatOnlineFeatureAggregate,
): string {
  return [
    'expected=HATER_TARGETING',
    `actual=${aggregate.family ?? 'ALL'}`,
    `rows=${aggregate.rows.length}`,
    `entities=${aggregate.entityKeys.length}`,
    `channel=${aggregate.dominantChannel}`,
  ].join(' | ');
}


export function isHelperTimingFamily(value: ChatModelFamily): boolean {
  return value === 'HELPER_TIMING';
}

export function summarizeHelperTimingAggregate(
  aggregate: ChatOnlineFeatureAggregate,
): string {
  return [
    'expected=HELPER_TIMING',
    `actual=${aggregate.family ?? 'ALL'}`,
    `rows=${aggregate.rows.length}`,
    `entities=${aggregate.entityKeys.length}`,
    `channel=${aggregate.dominantChannel}`,
  ].join(' | ');
}


export function isChannelAffinityFamily(value: ChatModelFamily): boolean {
  return value === 'CHANNEL_AFFINITY';
}

export function summarizeChannelAffinityAggregate(
  aggregate: ChatOnlineFeatureAggregate,
): string {
  return [
    'expected=CHANNEL_AFFINITY',
    `actual=${aggregate.family ?? 'ALL'}`,
    `rows=${aggregate.rows.length}`,
    `entities=${aggregate.entityKeys.length}`,
    `channel=${aggregate.dominantChannel}`,
  ].join(' | ');
}


export function isToxicityFamily(value: ChatModelFamily): boolean {
  return value === 'TOXICITY';
}

export function summarizeToxicityAggregate(
  aggregate: ChatOnlineFeatureAggregate,
): string {
  return [
    'expected=TOXICITY',
    `actual=${aggregate.family ?? 'ALL'}`,
    `rows=${aggregate.rows.length}`,
    `entities=${aggregate.entityKeys.length}`,
    `channel=${aggregate.dominantChannel}`,
  ].join(' | ');
}


export function isChurnFamily(value: ChatModelFamily): boolean {
  return value === 'CHURN';
}

export function summarizeChurnAggregate(
  aggregate: ChatOnlineFeatureAggregate,
): string {
  return [
    'expected=CHURN',
    `actual=${aggregate.family ?? 'ALL'}`,
    `rows=${aggregate.rows.length}`,
    `entities=${aggregate.entityKeys.length}`,
    `channel=${aggregate.dominantChannel}`,
  ].join(' | ');
}


export function isInterventionPolicyFamily(value: ChatModelFamily): boolean {
  return value === 'INTERVENTION_POLICY';
}

export function summarizeInterventionPolicyAggregate(
  aggregate: ChatOnlineFeatureAggregate,
): string {
  return [
    'expected=INTERVENTION_POLICY',
    `actual=${aggregate.family ?? 'ALL'}`,
    `rows=${aggregate.rows.length}`,
    `entities=${aggregate.entityKeys.length}`,
    `channel=${aggregate.dominantChannel}`,
  ].join(' | ');
}


export function buildOnlineFeatureStoreInspectorNote1(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_1',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote2(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_2',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote3(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_3',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote4(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_4',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote5(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_5',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote6(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_6',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote7(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_7',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote8(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_8',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote9(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_9',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote10(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_10',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote11(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_11',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote12(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_12',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote13(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_13',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote14(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_14',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote15(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_15',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote16(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_16',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote17(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_17',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote18(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_18',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote19(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_19',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote20(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_20',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote21(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_21',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote22(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_22',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote23(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_23',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote24(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_24',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote25(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_25',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote26(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_26',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote27(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_27',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote28(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_28',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote29(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_29',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote30(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_30',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote31(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_31',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote32(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_32',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote33(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_33',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote34(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_34',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote35(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_35',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote36(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_36',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote37(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_37',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote38(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_38',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote39(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_39',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote40(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_40',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote41(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_41',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote42(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_42',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote43(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_43',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote44(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_44',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote45(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_45',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote46(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_46',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote47(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_47',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote48(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_48',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote49(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_49',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote50(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_50',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote51(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_51',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote52(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_52',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote53(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_53',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote54(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_54',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote55(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_55',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote56(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_56',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote57(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_57',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote58(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_58',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote59(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_59',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote60(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_60',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote61(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_61',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote62(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_62',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote63(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_63',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote64(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_64',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote65(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_65',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote66(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_66',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote67(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_67',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote68(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_68',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote69(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_69',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote70(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_70',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote71(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_71',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote72(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_72',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote73(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_73',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote74(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_74',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote75(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_75',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote76(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_76',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote77(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_77',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote78(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_78',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote79(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_79',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}


export function buildOnlineFeatureStoreInspectorNote80(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery = {},
): Readonly<Record<string, JsonValue>> {
  const aggregate = store.aggregate(query);
  const summary = aggregateSummaryLine(aggregate);
  return Object.freeze({
    inspectorId: 'INSPECTOR_80',
    summary,
    rows: aggregate.rows.length,
    entities: aggregate.entityKeys.length,
    dominantChannel: aggregate.dominantChannel,
    freshnessMs: aggregate.freshnessMs,
    family: aggregate.family ?? 'ALL',
    tags: aggregate.tags.slice(0, 8),
  });
}
