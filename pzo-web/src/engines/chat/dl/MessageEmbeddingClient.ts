
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/dl/MessageEmbeddingClient.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT DL MESSAGE EMBEDDING CLIENT
 * FILE: pzo-web/src/engines/chat/intelligence/dl/MessageEmbeddingClient.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * This module is the frontend message-embedding lane for the unified chat
 * intelligence system.
 *
 * It is intentionally not a generic "AI SDK wrapper."
 *
 * It preserves the repo doctrine already established across:
 * - /pzo-web/src/engines/chat
 * - /pzo-web/src/components/chat
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 * - /shared/contracts/chat/learning
 *
 * The client exists so the frontend can:
 * - prepare fast local embeddings for immediate personalization,
 * - batch inference requests without blocking the dock,
 * - preserve transport-safe queue semantics,
 * - enrich response ranking and intent encoding lanes,
 * - remain useful offline,
 * - keep backend truth authoritative.
 *
 * It does NOT:
 * - become transcript truth,
 * - become moderation truth,
 * - persist authoritative model state,
 * - outrank backend memory retrieval,
 * - invent server-only embeddings.
 *
 * Instead it provides:
 * - deterministic local fallback embeddings,
 * - optional remote transport integration,
 * - queue-first batching,
 * - cache and TTL controls,
 * - compile-safe telemetry hooks,
 * - structured embedding metadata for later backend handoff.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatLearningBridgePublicSnapshot,
} from '../ChatLearningBridge';

import type {
  ChatFeatureSnapshot,
  ChatLearningProfile,
  ChatMessage,
  ChatVisibleChannel,
  JsonObject,
  JsonValue,
  Nullable,
  Score01,
  UnixMs,
} from '../../types';

/* ========================================================================== */
/* MARK: Module constants                                                     */
/* ========================================================================== */

export const CHAT_MESSAGE_EMBEDDING_CLIENT_MODULE_NAME =
  'PZO_CHAT_MESSAGE_EMBEDDING_CLIENT' as const;

export const CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION =
  '2026.03.13-message-embedding-client.v1' as const;

export const CHAT_MESSAGE_EMBEDDING_CLIENT_RUNTIME_LAWS = Object.freeze([
  'Frontend embeddings are advisory and latency-first.',
  'Queue-before-transport is mandatory for burst resilience.',
  'Local deterministic embeddings must remain available during transport loss.',
  'Embedding output must be normalized and bounded.',
  'Cache hits should preserve semantic equivalence for identical requests.',
  'Model transport is optional; runtime usefulness is not.',
  'The embedding lane may enrich ranking and intent, but cannot invent server truth.',
  'Metadata must remain rich enough for backend reconciliation later.',
] as const);

export const CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS = Object.freeze({
  model: 'pzo-chat-embedder-frontline-v1',
  vectorDimensions: 192,
  localFallbackDimensions: 192,
  maxBatchSize: 16,
  maxQueueDepth: 256,
  maxTextChars: 4_000,
  maxContextChars: 6_000,
  cacheTtlMs: 10 * 60 * 1_000,
  requestTimeoutMs: 5_000,
  retryCount: 1,
  microBatchDelayMs: 12,
  dedupeWindowMs: 250,
  includeChannelBias: true,
  includeFeatureSummary: true,
  includeProfileSummary: true,
  enableLocalFallback: true,
  enableRequestCoalescing: true,
  normalizeVectors: true,
  maxTokenApprox: 512,
  minTextWeight: 0.65,
  metadataWeight: 0.35,
  topTokenLimit: 64,
  topNgramLimit: 96,
  debugEchoTextPreviewChars: 180,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatEmbeddingPurpose =
  | 'MESSAGE'
  | 'INTENT'
  | 'STATE'
  | 'MEMORY_ANCHOR'
  | 'RESPONSE_RANKING'
  | 'HELPER_MATCH'
  | 'HATER_MATCH'
  | 'CHANNEL_AFFINITY'
  | 'OTHER';

export type ChatEmbeddingSource =
  | 'LOCAL_DETERMINISTIC'
  | 'REMOTE_MODEL'
  | 'CACHE_HIT'
  | 'COALESCED_REQUEST';

export interface ChatEmbeddingTelemetryPort {
  captureInferenceRequested?(
    model: string,
    requestKind:
      | 'RESPONSE_RANKING'
      | 'INTENT_ENCODING'
      | 'STATE_ENCODING'
      | 'EMBEDDING'
      | 'MEMORY_RETRIEVAL'
      | 'OTHER',
    inputSummary?: string,
  ): unknown;
  captureInferenceCompleted?(
    model: string,
    requestKind:
      | 'RESPONSE_RANKING'
      | 'INTENT_ENCODING'
      | 'STATE_ENCODING'
      | 'EMBEDDING'
      | 'MEMORY_RETRIEVAL'
      | 'OTHER',
    durationMs?: number,
    resultSummary?: string,
  ): unknown;
  captureInferenceFailed?(
    model: string,
    requestKind:
      | 'RESPONSE_RANKING'
      | 'INTENT_ENCODING'
      | 'STATE_ENCODING'
      | 'EMBEDDING'
      | 'MEMORY_RETRIEVAL'
      | 'OTHER',
    failureCode?: string,
    durationMs?: number,
  ): unknown;
}

export interface ChatEmbeddingClockPort {
  now(): number;
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(token: unknown): void;
}

export interface ChatEmbeddingTransportRequest {
  readonly model: string;
  readonly inputs: readonly ChatEmbeddingTransportInput[];
  readonly timeoutMs: number;
  readonly requestId: string;
}

export interface ChatEmbeddingTransportInput {
  readonly cacheKey: string;
  readonly purpose: ChatEmbeddingPurpose;
  readonly text: string;
  readonly contextSummary: string;
  readonly metadata: JsonObject;
}

export interface ChatEmbeddingTransportResultItem {
  readonly cacheKey: string;
  readonly vector: readonly number[];
  readonly dimensions?: number;
  readonly model?: string;
  readonly durationMs?: number;
  readonly diagnostics?: JsonObject;
}

export interface ChatEmbeddingTransportResult {
  readonly requestId: string;
  readonly items: readonly ChatEmbeddingTransportResultItem[];
  readonly durationMs?: number;
  readonly model?: string;
}

export interface ChatEmbeddingTransportPort {
  embed(
    request: ChatEmbeddingTransportRequest,
  ): Promise<ChatEmbeddingTransportResult>;
}

export interface ChatEmbeddingCacheEntry {
  readonly cacheKey: string;
  readonly createdAtMs: UnixMs;
  readonly expiresAtMs: UnixMs;
  readonly vector: readonly number[];
  readonly source: ChatEmbeddingSource;
  readonly purpose: ChatEmbeddingPurpose;
  readonly model: string;
  readonly dimensions: number;
  readonly diagnostics?: JsonObject;
}

export interface ChatEmbeddingCachePort {
  get(cacheKey: string): ChatEmbeddingCacheEntry | null | undefined;
  set(entry: ChatEmbeddingCacheEntry): void;
  delete?(cacheKey: string): void;
  clear?(): void;
}

export interface ChatEmbeddingInput {
  readonly purpose: ChatEmbeddingPurpose;
  readonly text?: string | null;
  readonly message?: Partial<ChatMessage> | null;
  readonly recentMessages?: readonly Partial<ChatMessage>[];
  readonly featureSnapshot?: Nullable<ChatFeatureSnapshot>;
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly bridgeSnapshot?: Nullable<ChatLearningBridgePublicSnapshot>;
  readonly activeChannel?: Nullable<ChatVisibleChannel>;
  readonly eventName?: string | null;
  readonly roomId?: string | null;
  readonly modeId?: string | null;
  readonly mountTarget?: string | null;
  readonly requestId?: string | null;
  readonly userId?: string | null;
  readonly metadata?: JsonObject;
}

export interface ChatEmbeddingPreparedInput {
  readonly cacheKey: string;
  readonly purpose: ChatEmbeddingPurpose;
  readonly canonicalText: string;
  readonly previewText: string;
  readonly contextSummary: string;
  readonly metadata: JsonObject;
  readonly dimensions: number;
}

export interface ChatEmbeddingVectorRecord {
  readonly requestId: string;
  readonly cacheKey: string;
  readonly source: ChatEmbeddingSource;
  readonly model: string;
  readonly purpose: ChatEmbeddingPurpose;
  readonly dimensions: number;
  readonly vector: readonly number[];
  readonly magnitude: number;
  readonly normalized: boolean;
  readonly createdAtMs: UnixMs;
  readonly durationMs: number;
  readonly previewText: string;
  readonly contextSummary: string;
  readonly diagnostics: JsonObject;
}

export interface ChatEmbeddingBatchResult {
  readonly requestId: string;
  readonly model: string;
  readonly source: ChatEmbeddingSource;
  readonly vectors: readonly ChatEmbeddingVectorRecord[];
  readonly durationMs: number;
  readonly usedFallback: boolean;
}

export interface ChatEmbeddingClientOptions {
  readonly clock?: Partial<ChatEmbeddingClockPort>;
  readonly transport?: Nullable<ChatEmbeddingTransportPort>;
  readonly telemetry?: Nullable<ChatEmbeddingTelemetryPort>;
  readonly cache?: Nullable<ChatEmbeddingCachePort>;
  readonly defaults?: Partial<typeof CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS>;
  readonly model?: string;
  readonly vectorDimensions?: number;
  readonly requestPrefix?: string;
}

export interface ChatEmbeddingClientPublicSnapshot {
  readonly moduleName: typeof CHAT_MESSAGE_EMBEDDING_CLIENT_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION;
  readonly model: string;
  readonly queueDepth: number;
  readonly cacheSize: number;
  readonly coalescedInflightCount: number;
  readonly totals: Readonly<{
    requests: number;
    batches: number;
    cacheHits: number;
    remoteCalls: number;
    remoteFailures: number;
    fallbackCalls: number;
  }>;
}

export interface ChatEmbeddingSimilarityResult {
  readonly similarity01: Score01;
  readonly dot: number;
  readonly lhsMagnitude: number;
  readonly rhsMagnitude: number;
}

export interface ChatEmbeddingClientPort {
  embed(input: ChatEmbeddingInput): Promise<ChatEmbeddingVectorRecord>;
  embedBatch(inputs: readonly ChatEmbeddingInput[]): Promise<ChatEmbeddingBatchResult>;
  similarity(
    lhs: readonly number[],
    rhs: readonly number[],
  ): ChatEmbeddingSimilarityResult;
  getPublicSnapshot(): ChatEmbeddingClientPublicSnapshot;
}

/* ========================================================================== */
/* MARK: Internal utility types                                               */
/* ========================================================================== */

interface MutableCacheEntry extends ChatEmbeddingCacheEntry {}
interface DeferredBatchToken {
  token: unknown | null;
}

type QueueJobResolver = {
  resolve: (value: ChatEmbeddingVectorRecord) => void;
  reject: (reason?: unknown) => void;
};

interface ChatEmbeddingQueueJob {
  readonly requestId: string;
  readonly prepared: ChatEmbeddingPreparedInput;
  readonly enqueuedAtMs: UnixMs;
  readonly resolver: QueueJobResolver;
}

interface StableEmbeddingFeatureSummary {
  readonly affect: string;
  readonly dropRisk: number;
  readonly helperNeed: number;
  readonly haterTolerance: number;
  readonly rescueNeed: number;
  readonly activeChannel: string;
  readonly preferredChannel: string;
  readonly pressureTag: string;
  readonly audienceHeat: number;
}

interface StableLearningProfileSummary {
  readonly playerId: string;
  readonly topHelperPersonaId: string;
  readonly topHaterPersonaId: string;
  readonly strongestEmotion: string;
  readonly channelBias: string;
  readonly coldStartBias: string;
}

/* ========================================================================== */
/* MARK: Runtime defaults and ports                                           */
/* ========================================================================== */

const DEFAULT_CLOCK: ChatEmbeddingClockPort = Object.freeze({
  now: () => Date.now(),
  setTimeout: (handler: () => void, ms: number): unknown => setTimeout(handler, ms),
  clearTimeout: (token: unknown): void => clearTimeout(token as ReturnType<typeof setTimeout>),
});

class InMemoryChatEmbeddingCache implements ChatEmbeddingCachePort {
  private readonly map = new Map<string, ChatEmbeddingCacheEntry>();

  public get(cacheKey: string): ChatEmbeddingCacheEntry | null {
    return this.map.get(cacheKey) ?? null;
  }

  public set(entry: ChatEmbeddingCacheEntry): void {
    this.map.set(entry.cacheKey, entry);
  }

  public delete(cacheKey: string): void {
    this.map.delete(cacheKey);
  }

  public clear(): void {
    this.map.clear();
  }

  public size(): number {
    return this.map.size;
  }

  public sweep(now: number): void {
    for (const [key, entry] of this.map) {
      if (entry.expiresAtMs <= now) {
        this.map.delete(key);
      }
    }
  }
}

const NOOP_TELEMETRY: ChatEmbeddingTelemetryPort = Object.freeze({});

/* ========================================================================== */
/* MARK: Scalar helpers                                                       */
/* ========================================================================== */

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function asScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function asUnixMs(value: number): UnixMs {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0)) as UnixMs;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function coerceVisibleChannel(
  value: unknown,
  fallback: ChatVisibleChannel = 'GLOBAL',
): ChatVisibleChannel {
  if (
    value === 'GLOBAL' ||
    value === 'SYNDICATE' ||
    value === 'DEAL_ROOM' ||
    value === 'LOBBY'
  ) {
    return value;
  }

  return fallback;
}

function stableRound(value: number, places = 4): number {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function boundedText(
  text: string,
  maxChars: number,
): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars);
}

function truncatePreview(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

function uniqStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  let sum = 0;
  for (const value of values) sum += safeNumber(value, 0);
  return sum / values.length;
}

function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += safeNumber(value, 0);
  return total;
}

function magnitude(vector: readonly number[]): number {
  let total = 0;
  for (const value of vector) total += value * value;
  return Math.sqrt(total);
}

function normalizeVector(
  vector: readonly number[],
): readonly number[] {
  const mag = magnitude(vector);
  if (mag <= 0.0000001) {
    return vector.map(() => 0);
  }

  return vector.map((value) => value / mag);
}

function cosineSimilarity(
  lhs: readonly number[],
  rhs: readonly number[],
): ChatEmbeddingSimilarityResult {
  const size = Math.min(lhs.length, rhs.length);
  let dot = 0;

  for (let index = 0; index < size; index += 1) {
    dot += (lhs[index] ?? 0) * (rhs[index] ?? 0);
  }

  const lhsMagnitude = magnitude(lhs);
  const rhsMagnitude = magnitude(rhs);
  const denom = lhsMagnitude * rhsMagnitude;
  const raw = denom <= 0.0000001 ? 0 : dot / denom;
  const normalized = clamp01((raw + 1) / 2);

  return Object.freeze({
    similarity01: asScore01(normalized),
    dot: stableRound(dot, 6),
    lhsMagnitude: stableRound(lhsMagnitude, 6),
    rhsMagnitude: stableRound(rhsMagnitude, 6),
  });
}

function stableHash32(text: string): number {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function hashToUnitFloat(text: string): number {
  return stableHash32(text) / 0xffffffff;
}

function extractWordTokens(text: string): readonly string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_:#@\-\s]/g, ' ')
    .split(/\s+/g)
    .filter(Boolean);
}

function extractCharNgrams(
  text: string,
  size = 3,
  limit = 128,
): readonly string[] {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const grams: string[] = [];

  for (let index = 0; index <= normalized.length - size; index += 1) {
    grams.push(normalized.slice(index, index + size));
    if (grams.length >= limit) break;
  }

  return grams;
}

function frequencySortTokens(
  tokens: readonly string[],
  limit: number,
): readonly string[] {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([token]) => token);
}

/* ========================================================================== */
/* MARK: Context summarization                                                */
/* ========================================================================== */

function summarizeFeatureSnapshot(
  featureSnapshot: Nullable<ChatFeatureSnapshot>,
): StableEmbeddingFeatureSummary {
  const snapshot = (featureSnapshot ?? {}) as Record<string, unknown>;
  const affect = isRecord(snapshot.affect) ? snapshot.affect : null;
  const affectVector = affect && isRecord(affect.vector) ? affect.vector : null;

  const dropOffSignals = isRecord(snapshot.dropOffSignals)
    ? snapshot.dropOffSignals
    : null;

  const scalar = isRecord(snapshot.scalar)
    ? snapshot.scalar
    : null;

  const social = isRecord(snapshot.social)
    ? snapshot.social
    : null;

  const channel = isRecord(snapshot.channel)
    ? snapshot.channel
    : null;

  const diagnostics = isRecord(snapshot.diagnostics)
    ? snapshot.diagnostics
    : null;

  const strongestAffect = (() => {
    if (!affectVector) return 'unknown';

    const entries = Object.entries(affectVector)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      .sort((a, b) => Number(b[1]) - Number(a[1]));

    return entries[0]?.[0] ?? 'unknown';
  })();

  return Object.freeze({
    affect: strongestAffect,
    dropRisk: stableRound(
      safeNumber(dropOffSignals?.churnPressure01) ||
        safeNumber(scalar?.dropOffRisk01),
      4,
    ),
    helperNeed: stableRound(safeNumber(scalar?.helperNeed01), 4),
    haterTolerance: stableRound(safeNumber(scalar?.haterTolerance01), 4),
    rescueNeed: stableRound(safeNumber(scalar?.rescueNeed01), 4),
    activeChannel: safeString(channel?.activeChannel, 'GLOBAL'),
    preferredChannel: safeString(channel?.preferredChannel, 'GLOBAL'),
    pressureTag: safeString(diagnostics?.pressureTier, 'UNKNOWN'),
    audienceHeat: stableRound(
      safeNumber(social?.audienceHeat01) ||
        safeNumber((snapshot as Record<string, unknown>).audienceHeat),
      4,
    ),
  });
}

function strongestEmotionFromProfile(
  learningProfile: Nullable<ChatLearningProfile>,
): string {
  const profile = learningProfile as Record<string, unknown> | null;
  if (!profile || !isRecord(profile.emotionBaseline)) {
    return 'unknown';
  }

  const baseline = profile.emotionBaseline as Record<string, unknown>;
  const entries = Object.entries(baseline)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  return entries[0]?.[0] ?? 'unknown';
}

function summarizeLearningProfile(
  learningProfile: Nullable<ChatLearningProfile>,
): StableLearningProfileSummary {
  const profile = learningProfile as Record<string, unknown> | null;
  const channelAffinity = profile && isRecord(profile.channelAffinity)
    ? profile.channelAffinity as Record<string, unknown>
    : {};

  const helperTrust = profile && isRecord(profile.helperTrustByPersona)
    ? profile.helperTrustByPersona as Record<string, unknown>
    : {};

  const haterTarget = profile && isRecord(profile.haterTargetingByPersona)
    ? profile.haterTargetingByPersona as Record<string, unknown>
    : {};

  const topPair = (record: Record<string, unknown>): string => {
    const entries = Object.entries(record)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    return entries[0]?.[0] ?? 'none';
  };

  const topChannel = Object.entries(channelAffinity)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] ?? 'GLOBAL';

  const coldStart = profile && isRecord(profile.coldStart)
    ? profile.coldStart as Record<string, unknown>
    : null;

  const coldStartBias = coldStart
    ? [
        `helper:${stableRound(safeNumber(coldStart.helperFrequencyBias), 3)}`,
        `hater:${stableRound(safeNumber(coldStart.haterAggressionBias), 3)}`,
        `negotiation:${stableRound(safeNumber(coldStart.negotiationRiskBias), 3)}`,
        `heat:${stableRound(safeNumber(coldStart.crowdHeatTolerance), 3)}`,
        `soft:${Boolean(coldStart.prefersLowerPressureOpenings) ? 'yes' : 'no'}`,
      ].join('|')
    : 'none';

  return Object.freeze({
    playerId: safeString(profile?.playerId, ''),
    topHelperPersonaId: topPair(helperTrust),
    topHaterPersonaId: topPair(haterTarget),
    strongestEmotion: strongestEmotionFromProfile(learningProfile),
    channelBias: topChannel,
    coldStartBias,
  });
}

function summarizeRecentMessages(
  recentMessages: readonly Partial<ChatMessage>[] | undefined,
  limit = 4,
): string {
  if (!recentMessages?.length) return '';

  return recentMessages
    .slice(-limit)
    .map((message) => {
      const senderId = safeString((message as Record<string, unknown>).senderId, '');
      const senderRole = safeString((message as Record<string, unknown>).senderRole, '');
      const channel = safeString((message as Record<string, unknown>).channel, '');
      const text = boundedText(
        safeString((message as Record<string, unknown>).body, '') ||
          safeString((message as Record<string, unknown>).text, ''),
        160,
      );

      return [senderRole || senderId || 'unknown', channel || 'na', text]
        .filter(Boolean)
        .join(':');
    })
    .filter(Boolean)
    .join(' || ');
}

function normalizePrimaryText(
  input: ChatEmbeddingInput,
  maxChars: number,
): string {
  const messageRecord = input.message as Record<string, unknown> | null;
  const candidate =
    safeString(input.text, '') ||
    safeString(messageRecord?.body, '') ||
    safeString(messageRecord?.text, '') ||
    safeString(messageRecord?.content, '');

  return boundedText(candidate, maxChars);
}

function createFeatureContextSummary(
  input: ChatEmbeddingInput,
  defaults = CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS,
): string {
  const feature = summarizeFeatureSnapshot(input.featureSnapshot ?? null);
  const profile = summarizeLearningProfile(input.learningProfile ?? null);
  const activeChannel = coerceVisibleChannel(
    input.activeChannel ??
      feature.activeChannel ??
      input.bridgeSnapshot?.session?.activeChannel,
    'GLOBAL',
  );

  const lines = [
    `purpose=${input.purpose}`,
    input.eventName ? `event=${input.eventName}` : '',
    activeChannel ? `channel=${activeChannel}` : '',
    input.roomId ? `room=${input.roomId}` : '',
    input.modeId ? `mode=${input.modeId}` : '',
    input.mountTarget ? `mount=${input.mountTarget}` : '',
    defaults.includeFeatureSummary
      ? `feature=affect:${feature.affect}|drop:${feature.dropRisk}|helper:${feature.helperNeed}|hater:${feature.haterTolerance}|rescue:${feature.rescueNeed}|pressure:${feature.pressureTag}|heat:${feature.audienceHeat}`
      : '',
    defaults.includeProfileSummary
      ? `profile=channel:${profile.channelBias}|helper:${profile.topHelperPersonaId}|hater:${profile.topHaterPersonaId}|emotion:${profile.strongestEmotion}|cold:${profile.coldStartBias}`
      : '',
    input.recentMessages?.length
      ? `recent=${summarizeRecentMessages(input.recentMessages, 4)}`
      : '',
  ].filter(Boolean);

  return boundedText(lines.join(' ; '), defaults.maxContextChars);
}

function buildPreparedMetadata(
  input: ChatEmbeddingInput,
  canonicalText: string,
  contextSummary: string,
  dimensions: number,
): JsonObject {
  const feature = summarizeFeatureSnapshot(input.featureSnapshot ?? null);
  const profile = summarizeLearningProfile(input.learningProfile ?? null);
  const message = (input.message ?? {}) as Record<string, unknown>;
  const metadata: JsonObject = Object.freeze({
    purpose: input.purpose,
    requestId: input.requestId ?? '',
    eventName: input.eventName ?? '',
    roomId: input.roomId ?? '',
    modeId: input.modeId ?? '',
    mountTarget: input.mountTarget ?? '',
    activeChannel: coerceVisibleChannel(
      input.activeChannel ??
        feature.activeChannel ??
        input.bridgeSnapshot?.session?.activeChannel,
      'GLOBAL',
    ),
    playerId: profile.playerId,
    senderId: safeString(message.senderId, ''),
    senderRole: safeString(message.senderRole, ''),
    messageId: safeString(message.id, ''),
    featureAffect: feature.affect,
    featurePressureTag: feature.pressureTag,
    featureDropRisk: feature.dropRisk,
    featureHelperNeed: feature.helperNeed,
    featureHaterTolerance: feature.haterTolerance,
    featureRescueNeed: feature.rescueNeed,
    featureAudienceHeat: feature.audienceHeat,
    profileStrongestEmotion: profile.strongestEmotion,
    profileChannelBias: profile.channelBias,
    profileTopHelperPersona: profile.topHelperPersonaId,
    profileTopHaterPersona: profile.topHaterPersonaId,
    coldStartBias: profile.coldStartBias,
    canonicalLength: canonicalText.length,
    contextLength: contextSummary.length,
    dimensions,
    ...(input.metadata ?? {}),
  });

  return metadata;
}

function createPreparedInput(
  input: ChatEmbeddingInput,
  defaults = CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS,
): ChatEmbeddingPreparedInput {
  const canonicalText = normalizePrimaryText(input, defaults.maxTextChars);
  const contextSummary = createFeatureContextSummary(input, defaults);
  const metadata = buildPreparedMetadata(
    input,
    canonicalText,
    contextSummary,
    defaults.vectorDimensions,
  );

  const keyBase = JSON.stringify([
    input.purpose,
    canonicalText,
    contextSummary,
    metadata.activeChannel,
    metadata.eventName,
    metadata.featurePressureTag,
    metadata.profileStrongestEmotion,
    metadata.profileChannelBias,
    metadata.profileTopHelperPersona,
    metadata.profileTopHaterPersona,
  ]);

  return Object.freeze({
    cacheKey: `embed:${stableHash32(keyBase).toString(16)}`,
    purpose: input.purpose,
    canonicalText,
    previewText: truncatePreview(canonicalText, defaults.debugEchoTextPreviewChars),
    contextSummary,
    metadata,
    dimensions: defaults.vectorDimensions,
  });
}

/* ========================================================================== */
/* MARK: Deterministic local embedder                                          */
/* ========================================================================== */

function allocateVector(dimensions: number): number[] {
  return Array.from({ length: dimensions }, () => 0);
}

function injectHashedSignal(
  vector: number[],
  seed: string,
  weight: number,
): void {
  const dimensions = vector.length;
  if (dimensions <= 0 || !seed) return;

  const baseHash = stableHash32(seed);
  const indexA = baseHash % dimensions;
  const indexB = ((baseHash >>> 8) + 17) % dimensions;
  const indexC = ((baseHash >>> 16) + 37) % dimensions;
  const signA = (baseHash & 1) === 0 ? 1 : -1;
  const signB = ((baseHash >>> 1) & 1) === 0 ? 1 : -1;
  const signC = ((baseHash >>> 2) & 1) === 0 ? 1 : -1;

  vector[indexA] += weight * signA;
  vector[indexB] += weight * 0.7 * signB;
  vector[indexC] += weight * 0.4 * signC;
}

function injectNumericSignal(
  vector: number[],
  label: string,
  value: number,
  weight: number,
): void {
  if (!Number.isFinite(value) || value === 0) return;
  injectHashedSignal(vector, `${label}:bucket:${Math.round(value * 100)}`, weight * value);
  injectHashedSignal(vector, `${label}:quant:${Math.round(value * 10)}`, weight * 0.6);
}

function buildDeterministicEmbedding(
  prepared: ChatEmbeddingPreparedInput,
  dimensions: number,
  defaults = CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS,
): readonly number[] {
  const vector = allocateVector(dimensions);
  const textTokens = extractWordTokens(prepared.canonicalText);
  const ngrams = extractCharNgrams(prepared.canonicalText, 3, defaults.topNgramLimit);
  const rankedTokens = frequencySortTokens(textTokens, defaults.topTokenLimit);
  const metadata = prepared.metadata;

  const textWeight = defaults.minTextWeight;
  const metaWeight = defaults.metadataWeight;

  injectHashedSignal(vector, `purpose:${prepared.purpose}`, 0.75);
  injectHashedSignal(vector, `context:${prepared.contextSummary}`, 0.22);

  rankedTokens.forEach((token, index) => {
    const weight = textWeight * (1 - Math.min(index / (rankedTokens.length || 1), 0.88));
    injectHashedSignal(vector, `token:${token}`, weight);
  });

  ngrams.forEach((gram, index) => {
    const weight = 0.12 * (1 - Math.min(index / (ngrams.length || 1), 0.92));
    injectHashedSignal(vector, `gram:${gram}`, weight);
  });

  const lexicalFlags = [
    ['contains_question', prepared.canonicalText.includes('?')],
    ['contains_exclaim', prepared.canonicalText.includes('!')],
    ['contains_cash', /\$|\d/.test(prepared.canonicalText)],
    ['contains_caps', /[A-Z]{3,}/.test(prepared.canonicalText)],
    ['contains_at', /@/.test(prepared.canonicalText)],
    ['contains_hash', /#/.test(prepared.canonicalText)],
    ['contains_rescue', /\bhelp|save|stuck|rescue\b/i.test(prepared.canonicalText)],
    ['contains_taunt', /\byou\b|\btrash\b|\bweak\b|\bcooked\b/i.test(prepared.canonicalText)],
    ['contains_negotiation', /\bdeal\b|\boffer\b|\bprice\b|\btrade\b/i.test(prepared.canonicalText)],
    ['contains_confession', /\bsorry\b|\bmy bad\b|\bapolog/i.test(prepared.canonicalText)],
  ] as const;

  for (const [flag, enabled] of lexicalFlags) {
    if (enabled) {
      injectHashedSignal(vector, `flag:${flag}`, 0.18);
    }
  }

  const numericFields: Array<[string, number]> = [
    ['featureDropRisk', safeNumber(metadata.featureDropRisk)],
    ['featureHelperNeed', safeNumber(metadata.featureHelperNeed)],
    ['featureHaterTolerance', safeNumber(metadata.featureHaterTolerance)],
    ['featureRescueNeed', safeNumber(metadata.featureRescueNeed)],
    ['featureAudienceHeat', safeNumber(metadata.featureAudienceHeat)],
    ['canonicalLength', safeNumber(metadata.canonicalLength) / 280],
    ['contextLength', safeNumber(metadata.contextLength) / 1200],
  ];

  for (const [label, value] of numericFields) {
    injectNumericSignal(vector, label, clamp01(value), metaWeight);
  }

  const categoricalFields = [
    `activeChannel:${safeString(metadata.activeChannel, '')}`,
    `eventName:${safeString(metadata.eventName, '')}`,
    `featureAffect:${safeString(metadata.featureAffect, '')}`,
    `featurePressureTag:${safeString(metadata.featurePressureTag, '')}`,
    `profileStrongestEmotion:${safeString(metadata.profileStrongestEmotion, '')}`,
    `profileChannelBias:${safeString(metadata.profileChannelBias, '')}`,
    `profileTopHelperPersona:${safeString(metadata.profileTopHelperPersona, '')}`,
    `profileTopHaterPersona:${safeString(metadata.profileTopHaterPersona, '')}`,
    `coldStartBias:${safeString(metadata.coldStartBias, '')}`,
  ];

  for (const categorical of categoricalFields) {
    injectHashedSignal(vector, categorical, 0.14);
  }

  const normalized = defaults.normalizeVectors
    ? normalizeVector(vector)
    : vector;

  return normalized;
}

/* ========================================================================== */
/* MARK: Client implementation                                                */
/* ========================================================================== */

export class MessageEmbeddingClient implements ChatEmbeddingClientPort {
  private readonly clock: ChatEmbeddingClockPort;
  private readonly transport: Nullable<ChatEmbeddingTransportPort>;
  private readonly telemetry: ChatEmbeddingTelemetryPort;
  private readonly cache: InMemoryChatEmbeddingCache | ChatEmbeddingCachePort;
  private readonly defaults: typeof CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS;
  private readonly model: string;
  private readonly requestPrefix: string;

  private readonly inflight = new Map<string, Promise<ChatEmbeddingVectorRecord>>();
  private readonly queue: ChatEmbeddingQueueJob[] = [];
  private readonly flushToken: DeferredBatchToken = { token: null };

  private requestCounter = 0;
  private totals = {
    requests: 0,
    batches: 0,
    cacheHits: 0,
    remoteCalls: 0,
    remoteFailures: 0,
    fallbackCalls: 0,
  };

  constructor(options: ChatEmbeddingClientOptions = {}) {
    this.clock = {
      ...DEFAULT_CLOCK,
      ...(options.clock ?? {}),
    };

    this.transport = options.transport ?? null;
    this.telemetry = options.telemetry ?? NOOP_TELEMETRY;
    this.cache = options.cache ?? new InMemoryChatEmbeddingCache();

    this.defaults = Object.freeze({
      ...CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS,
      ...(options.defaults ?? {}),
      model: options.model ?? options.defaults?.model ?? CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS.model,
      vectorDimensions:
        options.vectorDimensions ??
        options.defaults?.vectorDimensions ??
        CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS.vectorDimensions,
      localFallbackDimensions:
        options.vectorDimensions ??
        options.defaults?.localFallbackDimensions ??
        CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS.localFallbackDimensions,
    });

    this.model = options.model ?? this.defaults.model;
    this.requestPrefix = options.requestPrefix ?? 'pzo-chat-embed';
  }

  public getPublicSnapshot(): ChatEmbeddingClientPublicSnapshot {
    if (this.cache instanceof InMemoryChatEmbeddingCache) {
      this.cache.sweep(this.clock.now());
    }

    return Object.freeze({
      moduleName: CHAT_MESSAGE_EMBEDDING_CLIENT_MODULE_NAME,
      moduleVersion: CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
      model: this.model,
      queueDepth: this.queue.length,
      cacheSize: this.cache instanceof InMemoryChatEmbeddingCache ? this.cache.size() : -1,
      coalescedInflightCount: this.inflight.size,
      totals: Object.freeze({ ...this.totals }),
    });
  }

  public similarity(
    lhs: readonly number[],
    rhs: readonly number[],
  ): ChatEmbeddingSimilarityResult {
    return cosineSimilarity(lhs, rhs);
  }

  public async embed(input: ChatEmbeddingInput): Promise<ChatEmbeddingVectorRecord> {
    const batch = await this.embedBatch([input]);
    return batch.vectors[0]!;
  }

  public async embedBatch(
    inputs: readonly ChatEmbeddingInput[],
  ): Promise<ChatEmbeddingBatchResult> {
    const startedAt = this.clock.now();
    this.totals.requests += inputs.length;

    const promises = inputs.map((input) => this.enqueueOrResolve(input));
    const vectors = await Promise.all(promises);

    const source = vectors.every((vector) => vector.source === 'CACHE_HIT')
      ? 'CACHE_HIT'
      : vectors.some((vector) => vector.source === 'REMOTE_MODEL')
      ? 'REMOTE_MODEL'
      : vectors.some((vector) => vector.source === 'COALESCED_REQUEST')
      ? 'COALESCED_REQUEST'
      : 'LOCAL_DETERMINISTIC';

    return Object.freeze({
      requestId: this.nextRequestId('batch'),
      model: this.model,
      source,
      vectors,
      durationMs: Math.max(0, this.clock.now() - startedAt),
      usedFallback: vectors.some((vector) => vector.source === 'LOCAL_DETERMINISTIC'),
    });
  }

  private nextRequestId(kind: string): string {
    this.requestCounter += 1;
    return `${this.requestPrefix}:${kind}:${this.requestCounter}`;
  }

  private async enqueueOrResolve(
    input: ChatEmbeddingInput,
  ): Promise<ChatEmbeddingVectorRecord> {
    const prepared = createPreparedInput(input, this.defaults);
    const now = asUnixMs(this.clock.now());

    const cached = this.cache.get(prepared.cacheKey);
    if (cached && cached.expiresAtMs > now) {
      this.totals.cacheHits += 1;

      return Object.freeze({
        requestId: input.requestId ?? this.nextRequestId('cache'),
        cacheKey: cached.cacheKey,
        source: 'CACHE_HIT',
        model: cached.model,
        purpose: cached.purpose,
        dimensions: cached.dimensions,
        vector: cached.vector,
        magnitude: stableRound(magnitude(cached.vector), 6),
        normalized: true,
        createdAtMs: cached.createdAtMs,
        durationMs: 0,
        previewText: prepared.previewText,
        contextSummary: prepared.contextSummary,
        diagnostics: Object.freeze({
          cacheKey: cached.cacheKey,
          cachedAtMs: cached.createdAtMs,
          expiresAtMs: cached.expiresAtMs,
          ...(cached.diagnostics ?? {}),
        }),
      });
    }

    if (
      this.defaults.enableRequestCoalescing &&
      this.inflight.has(prepared.cacheKey)
    ) {
      const existing = this.inflight.get(prepared.cacheKey)!;
      const record = await existing;

      return Object.freeze({
        ...record,
        source: record.source === 'REMOTE_MODEL' ? 'COALESCED_REQUEST' : record.source,
      });
    }

    const promise = new Promise<ChatEmbeddingVectorRecord>((resolve, reject) => {
      if (this.queue.length >= this.defaults.maxQueueDepth) {
        const overflowRecord = this.createLocalRecord(
          prepared,
          input.requestId ?? this.nextRequestId('overflow'),
          'QUEUE_OVERFLOW_FALLBACK',
          now,
        );
        resolve(overflowRecord);
        return;
      }

      const job: ChatEmbeddingQueueJob = Object.freeze({
        requestId: input.requestId ?? this.nextRequestId('single'),
        prepared,
        enqueuedAtMs: now,
        resolver: { resolve, reject },
      });

      this.queue.push(job);
      this.scheduleFlush();
    });

    this.inflight.set(prepared.cacheKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.inflight.delete(prepared.cacheKey);
    }
  }

  private scheduleFlush(): void {
    if (this.flushToken.token != null) return;

    this.flushToken.token = this.clock.setTimeout(() => {
      this.flushToken.token = null;
      void this.flushQueue();
    }, this.defaults.microBatchDelayMs);
  }

  private async flushQueue(): Promise<void> {
    if (!this.queue.length) return;

    const batchJobs = this.queue.splice(0, this.defaults.maxBatchSize);
    this.totals.batches += 1;

    const startedAt = this.clock.now();
    const requestId = this.nextRequestId('transport-batch');

    const transportInputs: ChatEmbeddingTransportInput[] = batchJobs.map((job) => ({
      cacheKey: job.prepared.cacheKey,
      purpose: job.prepared.purpose,
      text: job.prepared.canonicalText,
      contextSummary: job.prepared.contextSummary,
      metadata: job.prepared.metadata,
    }));

    this.telemetry.captureInferenceRequested?.(
      this.model,
      'EMBEDDING',
      `batch:${batchJobs.length}|keys:${batchJobs.map((job) => job.prepared.cacheKey).join(',')}`,
    );

    if (this.transport) {
      try {
        this.totals.remoteCalls += 1;

        const result = await this.transport.embed({
          model: this.model,
          inputs: transportInputs,
          timeoutMs: this.defaults.requestTimeoutMs,
          requestId,
        });

        const byKey = new Map<string, ChatEmbeddingTransportResultItem>();
        for (const item of result.items) {
          byKey.set(item.cacheKey, item);
        }

        const resolvedRecords = batchJobs.map((job) => {
          const remote = byKey.get(job.prepared.cacheKey);
          if (!remote || !remote.vector?.length) {
            return this.createLocalRecord(
              job.prepared,
              job.requestId,
              'REMOTE_MISSING_ITEM_FALLBACK',
              asUnixMs(startedAt),
            );
          }

          const vector = this.defaults.normalizeVectors
            ? normalizeVector(remote.vector)
            : remote.vector;

          const createdAtMs = asUnixMs(this.clock.now());
          const record: ChatEmbeddingVectorRecord = Object.freeze({
            requestId: job.requestId,
            cacheKey: job.prepared.cacheKey,
            source: 'REMOTE_MODEL',
            model: remote.model ?? result.model ?? this.model,
            purpose: job.prepared.purpose,
            dimensions: remote.dimensions ?? vector.length,
            vector,
            magnitude: stableRound(magnitude(vector), 6),
            normalized: true,
            createdAtMs,
            durationMs: Math.max(
              0,
              safeNumber(remote.durationMs, this.clock.now() - startedAt),
            ),
            previewText: job.prepared.previewText,
            contextSummary: job.prepared.contextSummary,
            diagnostics: Object.freeze({
              requestId: result.requestId,
              transportDurationMs: safeNumber(result.durationMs, this.clock.now() - startedAt),
              remoteDimensions: remote.dimensions ?? vector.length,
              ...(remote.diagnostics ?? {}),
            }),
          });

          this.writeCache(record, createdAtMs);
          return record;
        });

        resolvedRecords.forEach((record, index) => {
          batchJobs[index]!.resolver.resolve(record);
        });

        this.telemetry.captureInferenceCompleted?.(
          this.model,
          'EMBEDDING',
          Math.max(0, this.clock.now() - startedAt),
          `remote:${resolvedRecords.length}`,
        );

        return;
      } catch (error) {
        this.totals.remoteFailures += 1;
        this.telemetry.captureInferenceFailed?.(
          this.model,
          'EMBEDDING',
          error instanceof Error ? error.name : 'EMBEDDING_FAILURE',
          Math.max(0, this.clock.now() - startedAt),
        );
      }
    }

    const fallbackRecords = batchJobs.map((job) =>
      this.createLocalRecord(
        job.prepared,
        job.requestId,
        this.transport ? 'REMOTE_FAILURE_FALLBACK' : 'NO_TRANSPORT_FALLBACK',
        asUnixMs(startedAt),
      ),
    );

    fallbackRecords.forEach((record, index) => {
      batchJobs[index]!.resolver.resolve(record);
    });

    this.telemetry.captureInferenceCompleted?.(
      this.model,
      'EMBEDDING',
      Math.max(0, this.clock.now() - startedAt),
      `local:${fallbackRecords.length}`,
    );
  }

  private writeCache(
    record: ChatEmbeddingVectorRecord,
    createdAtMs: UnixMs,
  ): void {
    const entry: ChatEmbeddingCacheEntry = Object.freeze({
      cacheKey: record.cacheKey,
      createdAtMs,
      expiresAtMs: asUnixMs(createdAtMs + this.defaults.cacheTtlMs),
      vector: record.vector,
      source: record.source,
      purpose: record.purpose,
      model: record.model,
      dimensions: record.dimensions,
      diagnostics: record.diagnostics,
    });

    this.cache.set(entry);
  }

  private createLocalRecord(
    prepared: ChatEmbeddingPreparedInput,
    requestId: string,
    fallbackReason: string,
    startedAt: UnixMs,
  ): ChatEmbeddingVectorRecord {
    this.totals.fallbackCalls += 1;

    const vector = buildDeterministicEmbedding(
      prepared,
      this.defaults.localFallbackDimensions,
      this.defaults,
    );

    const createdAtMs = asUnixMs(this.clock.now());
    const record: ChatEmbeddingVectorRecord = Object.freeze({
      requestId,
      cacheKey: prepared.cacheKey,
      source: 'LOCAL_DETERMINISTIC',
      model: `${this.model}:local`,
      purpose: prepared.purpose,
      dimensions: vector.length,
      vector,
      magnitude: stableRound(magnitude(vector), 6),
      normalized: true,
      createdAtMs,
      durationMs: Math.max(0, this.clock.now() - startedAt),
      previewText: prepared.previewText,
      contextSummary: prepared.contextSummary,
      diagnostics: Object.freeze({
        fallbackReason,
        metadata: prepared.metadata,
      }),
    });

    this.writeCache(record, createdAtMs);
    return record;
  }
}

/* ========================================================================== */
/* MARK: Free helpers                                                         */
/* ========================================================================== */

export function createMessageEmbeddingClient(
  options: ChatEmbeddingClientOptions = {},
): MessageEmbeddingClient {
  return new MessageEmbeddingClient(options);
}

export function createMessageEmbeddingInput(
  input: ChatEmbeddingInput,
): ChatEmbeddingInput {
  return Object.freeze({ ...input });
}

export function summarizeEmbeddingInput(
  input: ChatEmbeddingInput,
): string {
  const prepared = createPreparedInput(input, CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS);
  return [
    `purpose:${prepared.purpose}`,
    `key:${prepared.cacheKey}`,
    `preview:${prepared.previewText}`,
    `ctx:${truncatePreview(prepared.contextSummary, 220)}`,
  ].join(' | ');
}

export function compareEmbeddingVectors(
  lhs: readonly number[],
  rhs: readonly number[],
): ChatEmbeddingSimilarityResult {
  return cosineSimilarity(lhs, rhs);
}

export function buildDeterministicMessageEmbedding(
  input: ChatEmbeddingInput,
  dimensions = CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS.localFallbackDimensions,
): readonly number[] {
  const prepared = createPreparedInput(input, CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS);
  return buildDeterministicEmbedding(
    prepared,
    dimensions,
    CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS,
  );
}

export function createPrototypeEmbeddingBank(
  prototypes: Readonly<Record<string, ChatEmbeddingInput>>,
  dimensions = CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS.localFallbackDimensions,
): Readonly<Record<string, readonly number[]>> {
  const entries = Object.entries(prototypes).map(([key, input]) => {
    const vector = buildDeterministicMessageEmbedding(input, dimensions);
    return [key, vector] as const;
  });

  return Object.freeze(Object.fromEntries(entries));
}

export function topEmbeddingMatches(
  vector: readonly number[],
  bank: Readonly<Record<string, readonly number[]>>,
  limit = 5,
): readonly Readonly<{
  key: string;
  similarity01: Score01;
}>[] {
  const matches = Object.entries(bank)
    .map(([key, candidate]) => ({
      key,
      similarity01: compareEmbeddingVectors(vector, candidate).similarity01,
    }))
    .sort((a, b) => Number(b.similarity01) - Number(a.similarity01))
    .slice(0, limit);

  return Object.freeze(matches.map((match) => Object.freeze(match)));
}

/* ========================================================================== */
/* MARK: Manifest                                                             */
/* ========================================================================== */

export const CHAT_MESSAGE_EMBEDDING_CLIENT_MANIFEST = Object.freeze({
  moduleName: CHAT_MESSAGE_EMBEDDING_CLIENT_MODULE_NAME,
  version: CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
  runtimeLaws: CHAT_MESSAGE_EMBEDDING_CLIENT_RUNTIME_LAWS,
  defaults: CHAT_MESSAGE_EMBEDDING_CLIENT_DEFAULTS,
  capabilities: Object.freeze({
    queueBatching: true,
    localDeterministicFallback: true,
    remoteTransportOptional: true,
    cacheAware: true,
    similarityScoring: true,
    bridgeContextAware: true,
    profileAware: true,
    channelAware: true,
  }),
} as const);

export const ChatEmbedding = Object.freeze({
  MessageEmbeddingClient,
  createMessageEmbeddingClient,
  createMessageEmbeddingInput,
  summarizeEmbeddingInput,
  compareEmbeddingVectors,
  buildDeterministicMessageEmbedding,
  createPrototypeEmbeddingBank,
  topEmbeddingMatches,
  manifest: CHAT_MESSAGE_EMBEDDING_CLIENT_MANIFEST,
} as const);

export type ChatEmbeddingManifest = typeof CHAT_MESSAGE_EMBEDDING_CLIENT_MANIFEST;
