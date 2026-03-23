/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ML FEATURE INGESTOR
 * FILE: backend/src/game/engine/chat/ml/FeatureIngestor.ts
 * VERSION: 2026.03.21
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend online-feature ingestion surface for authoritative chat.
 *
 * This module turns accepted backend chat truth into model-ready feature rows
 * without flattening the repo's actual doctrine:
 *
 * - transport intent is not enough;
 * - normalized events are still not enough;
 * - only accepted backend chat truth becomes online-learning input;
 * - feature rows stay replayable, attributable, room-aware, and mode-aware;
 * - pressure, rescue, helper, hater, channel, crowd, silence, and room heat
 *   remain first-class;
 * - model families may share one authoritative fact pattern without each
 *   reinventing extraction;
 * - all rows carry a deterministic signature for deduplication, drift detection,
 *   and audit-trail attribution;
 * - quality grades, drift reports, and batch ingestion are native surfaces.
 *
 * This file intentionally sits between reducer truth and ML policy. It does
 * not decide transcript authority, moderation law, or intervention outcomes.
 * It translates accepted authoritative state transitions into bounded rows that
 * the OnlineFeatureStore and downstream models can trust.
 *
 * Extended features in this version
 * ----------------------------------
 * - Full negotiation/deal-room scalar surface
 * - Shadow hostility, insult density, threat language, repetition pressure
 * - Pile-on exposure, target fixation, caps aggression, spam velocity
 * - Silence-after-provocation, comeback potential, sovereignty composure
 * - Per-row quality grading (evidence, freshness, scalar completeness)
 * - Drift detection across rolling ingest window
 * - Batch ingestion with cap enforcement
 * - Audit trail emission for replay and proof surfaces
 * - Row validator with typed violation envelope
 * - Extended NAMESPACE with all new helper surfaces
 * ============================================================================
 */

import {
  BACKEND_CHAT_ENGINE_VERSION,
  asUnixMs,
  clamp01,
  type ChatAffectSnapshot,
  type ChatAudienceHeat,
  type ChatEngineTransaction,
  type ChatEventKind,
  type ChatFeatureSnapshot,
  type ChatInvasionState,
  type ChatLearningProfile,
  type ChatMessage,
  type ChatMessageId,
  type ChatNormalizedInput,
  type ChatRoomId,
  type ChatRoomState,
  type ChatSessionId,
  type ChatSessionState,
  type ChatSignalEnvelope,
  type ChatState,
  type ChatTranscriptEntry,
  type ChatUserId,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type PressureTier,
  type Score01,
  type TickTier,
  type UnixMs,
} from '../types';
import {
  DEFAULT_BACKEND_CHAT_RUNTIME,
  mergeRuntimeConfig,
} from '../ChatRuntimeConfig';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_FEATURE_INGESTOR_MODULE_NAME =
  'PZO_BACKEND_CHAT_FEATURE_INGESTOR' as const;

export const CHAT_FEATURE_INGESTOR_VERSION =
  '2026.03.21-feature-ingestor.v2' as const;

export const CHAT_FEATURE_INGESTOR_RUNTIME_LAWS = Object.freeze([
  'Only accepted backend-authoritative chat truth may become online features.',
  'Event-local extraction is rich, but all windows remain bounded.',
  'A feature row must stay attributable to room, session, user, event, and message anchors.',
  'Model families may filter the same authoritative vector, but must not rewrite the underlying facts.',
  'Shadow-only activity may inform backend learning, yet it must remain explicitly tagged.',
  'Silence, rescue pressure, hater intensity, and audience heat are first-class features.',
  'Room mode and mount posture may shape interpretation, but not fabricate state.',
  'Canonical feature snapshots remain narrow and stable while rich rows may expand over time.',
  'Row signatures enable deterministic deduplication, drift detection, and replay attribution.',
  'Quality grades are advisory and do not gate downstream models — they inform telemetry.',
  'Batch ingestion respects the configured cap; overflow rows are discarded with a warning.',
  'Audit entries must not be written for shadow-only rows unless includeShadowActivity is true.',
] as const);

export const CHAT_FEATURE_INGESTOR_DEFAULTS = Object.freeze({
  transcriptWindowMessages: 64,
  transcriptWindowMs: 15 * 60_000,
  signalWindowMs: 6 * 60_000,
  staleSilenceMs: 20_000,
  hardSilenceMs: 60_000,
  helperIgnoreMs: 18_000,
  haterBurstMs: 10_000,
  shadowWeight: 0.55,
  maxTags: 20,
  maxScalarFeatures: 128,
  maxCategoricalFeatures: 56,
  includeShadowActivity: true,
  deriveFamilyRows: true,
  // Batch and quality surfaces
  batchCapRows: 2_048,
  signatureDeduplication: true,
  emitAuditTrail: false,
  qualityCheckEnabled: true,
  // Drift detection
  driftDetectionEnabled: false,
  driftWindowRows: 512,
  driftSigmaThreshold: 2.8,
  // Scalar thresholds for derived features
  pileonThreshold: 3,
  targetFixationWindowCount: 4,
  capsAggressionThreshold: 0.34,
  highRepetitionThreshold: 0.42,
  silenceAfterProvocationMs: 8_000,
  shadowHostilityWindow: 5,
  negotiationIntensityPressureThreshold: 0.44,
  dealPressureBluffWeight: 0.36,
  comingbackPotentialMinEngagement: 0.22,
  sovereigntyComposureHighStake: 0.62,
  maxQualityViolations: 12,
} as const);

export const CHAT_MODEL_FAMILIES = [
  'ONLINE_CONTEXT',
  'ENGAGEMENT',
  'HATER_TARGETING',
  'HELPER_TIMING',
  'CHANNEL_AFFINITY',
  'TOXICITY',
  'CHURN',
  'INTERVENTION_POLICY',
] as const;

export type ChatModelFamily = (typeof CHAT_MODEL_FAMILIES)[number];

export type ChatFeatureQualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type ChatFeatureRowViolationKind =
  | 'MISSING_ROOM_ID'
  | 'MISSING_USER_ID'
  | 'MISSING_SESSION_ID'
  | 'STALE_FEATURES'
  | 'LOW_SCALAR_DENSITY'
  | 'LOW_EVIDENCE'
  | 'INVALID_FAMILY'
  | 'SIGNATURE_MISMATCH'
  | 'MISSING_CANONICAL_SNAPSHOT'
  | 'CHANNEL_AMBIGUOUS';

// ============================================================================
// MARK: Ports and public contracts
// ============================================================================

export interface ChatFeatureIngestorLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatFeatureIngestorClockPort {
  now(): UnixMs;
}

export interface ChatFeatureIngestorHashPort {
  hash(input: string): string;
}

export interface ChatFeatureIngestorOptions {
  readonly logger?: ChatFeatureIngestorLoggerPort;
  readonly clock?: ChatFeatureIngestorClockPort;
  readonly hash?: ChatFeatureIngestorHashPort;
  readonly defaults?: Partial<typeof CHAT_FEATURE_INGESTOR_DEFAULTS>;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
}

export interface ChatFeatureAnchorSet {
  readonly eventId: string;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly messageIds: readonly ChatMessageId[];
  readonly causalMessageIds: readonly ChatMessageId[];
  readonly replayAnchorKeys: readonly string[];
  readonly telemetryEventNames: readonly string[];
}

export interface ChatFeatureWindowSummary {
  readonly roomMessageCountWindow: number;
  readonly inboundNpcCountWindow: number;
  readonly outboundPlayerCountWindow: number;
  readonly ignoredHelperCountWindow: number;
  readonly haterBurstCountWindow: number;
  readonly helperMessageCountWindow: number;
  readonly visibleMessageCountWindow: number;
  readonly shadowMessageCountWindow: number;
  readonly uniqueSpeakersWindow: number;
  readonly silenceMs: number;
  readonly averageResponseMs: number;
  readonly averageMessageLength: number;
  readonly channelSwitchCountWindow: number;
  readonly roomMemberCount: number;
  readonly activeInvasionCount: number;
  readonly haterMessageCountWindow: number;
  readonly negativeTagCountWindow: number;
  readonly positiveTagCountWindow: number;
  readonly capsMessageCountWindow: number;
  readonly repetitionCountWindow: number;
  readonly silenceAfterProvocationMs: number;
}

export interface ChatFeatureScalarMap {
  readonly [key: string]: number;
}

export interface ChatFeatureCategoricalMap {
  readonly [key: string]: string;
}

export interface ChatFeatureDiagnostics {
  readonly pressureTier: PressureTier;
  readonly tickTier: TickTier | 'UNKNOWN';
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly roomKind: string;
  readonly sourceEventKind: ChatEventKind;
  readonly sourceChannel: string;
  readonly contributorCount: number;
  readonly ingestorVersion: typeof CHAT_FEATURE_INGESTOR_VERSION;
}

export interface ChatFeatureRow {
  readonly rowId: string;
  readonly generatedAt: UnixMs;
  readonly family: ChatModelFamily;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly entityKey: string;
  readonly entityKind: 'ROOM' | 'SESSION' | 'USER' | 'ROOM_USER' | 'SESSION_USER';
  readonly channelId: ChatVisibleChannel;
  readonly anchors: ChatFeatureAnchorSet;
  readonly window: ChatFeatureWindowSummary;
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly scalarFeatures: ChatFeatureScalarMap;
  readonly categoricalFeatures: ChatFeatureCategoricalMap;
  readonly tags: readonly string[];
  readonly diagnostics: ChatFeatureDiagnostics;
  readonly metadata: Readonly<Record<string, JsonValue>>;
  readonly signature: string;
}

export interface ChatFeatureIngestResult {
  readonly generatedAt: UnixMs;
  readonly acceptedEventId: string;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly rows: readonly ChatFeatureRow[];
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly tags: readonly string[];
}

export interface ChatFeatureBatchResult {
  readonly generatedAt: UnixMs;
  readonly totalTransactions: number;
  readonly totalRowsEmitted: number;
  readonly discardedRowsOverCap: number;
  readonly deduplicatedRows: number;
  readonly results: readonly ChatFeatureIngestResult[];
  readonly allRows: readonly ChatFeatureRow[];
  readonly durationMs: number;
}

export interface ChatFeatureRowViolation {
  readonly kind: ChatFeatureRowViolationKind;
  readonly severity: 'ERROR' | 'WARN' | 'INFO';
  readonly message: string;
}

export interface ChatFeatureRowValidationResult {
  readonly valid: boolean;
  readonly grade: ChatFeatureQualityGrade;
  readonly violations: readonly ChatFeatureRowViolation[];
  readonly scalarDensity01: number;
  readonly evidenceScore01: number;
  readonly freshnessScore01: number;
}

export interface ChatFeatureQualityReport {
  readonly generatedAt: UnixMs;
  readonly totalRows: number;
  readonly gradeCounts: Readonly<Record<ChatFeatureQualityGrade, number>>;
  readonly averageScalarDensity01: number;
  readonly averageEvidenceScore01: number;
  readonly averageFreshnessScore01: number;
  readonly topViolationKinds: readonly ChatFeatureRowViolationKind[];
  readonly familyCoverage: Readonly<Record<ChatModelFamily, number>>;
  readonly entityKindCoverage: Readonly<Record<string, number>>;
}

export interface ChatFeatureDriftReport {
  readonly generatedAt: UnixMs;
  readonly windowSize: number;
  readonly driftedFeatures: readonly ChatFeatureDriftEntry[];
  readonly stableFeaturesCount: number;
  readonly driftedFeaturesCount: number;
  readonly meanDriftSigma: number;
  readonly maxDriftSigma: number;
  readonly alertLevel: 'OK' | 'WATCH' | 'ALERT' | 'CRITICAL';
}

export interface ChatFeatureDriftEntry {
  readonly key: string;
  readonly currentMean: number;
  readonly referenceMean: number;
  readonly sigma: number;
  readonly relativeDrift01: number;
  readonly direction: 'UP' | 'DOWN' | 'STABLE';
}

export interface ChatFeatureAuditEntry {
  readonly auditId: string;
  readonly eventId: string;
  readonly generatedAt: UnixMs;
  readonly rowCount: number;
  readonly entityKeys: readonly string[];
  readonly families: readonly ChatModelFamily[];
  readonly tags: readonly string[];
  readonly signature: string;
}

export interface ChatFeatureIngestorStats {
  readonly totalIngested: number;
  readonly totalRowsEmitted: number;
  readonly totalWarnings: number;
  readonly totalErrors: number;
  readonly lastIngestedAt: Nullable<UnixMs>;
  readonly sessionStart: UnixMs;
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

interface ChatFeatureContext {
  readonly now: UnixMs;
  readonly state: ChatState;
  readonly event: ChatNormalizedInput;
  readonly transaction: ChatEngineTransaction;
  readonly room: Nullable<ChatRoomState>;
  readonly session: Nullable<ChatSessionState>;
  readonly learningProfile: Nullable<ChatLearningProfile>;
  readonly activeChannel: ChatVisibleChannel;
  readonly transcriptWindow: readonly ChatTranscriptEntry[];
  readonly anchoredMessages: readonly ChatMessage[];
  readonly audienceHeat: Nullable<ChatAudienceHeat>;
  readonly invasions: readonly ChatInvasionState[];
  readonly signal: Nullable<ChatSignalEnvelope>;
  readonly affect: ChatAffectSnapshot;
  readonly pressureTier: PressureTier;
  readonly tickTier: TickTier | 'UNKNOWN';
  readonly contributorCount: number;
}

interface EntitySelection {
  readonly entityKind: ChatFeatureRow['entityKind'];
  readonly entityKey: string;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
}

const DEFAULT_LOGGER: ChatFeatureIngestorLoggerPort = {
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLOCK: ChatFeatureIngestorClockPort = {
  now: () => asUnixMs(Date.now()),
};

const DEFAULT_HASH: ChatFeatureIngestorHashPort = {
  hash: (input) => hashString(input),
};

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function safeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asScore(value: number): Score01 {
  return clamp01(value) as Score01;
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Array.from(new Set(values));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `cf_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizeChannel(value: Nullable<string>, fallback: ChatVisibleChannel): ChatVisibleChannel {
  if (value === 'GLOBAL' || value === 'SYNDICATE' || value === 'DEAL_ROOM' || value === 'LOBBY') {
    return value;
  }
  return fallback;
}

function roomMemberCount(state: ChatState, roomId: ChatRoomId): number {
  const roomPresence = state.presence.byRoom[roomId];
  return roomPresence ? Object.keys(roomPresence).length : 0;
}

function channelSwitchCount(entries: readonly ChatTranscriptEntry[], userId: Nullable<ChatUserId>): number {
  if (!userId) return 0;
  let lastChannel: Nullable<string> = null;
  let switches = 0;

  for (const entry of entries) {
    if (entry.message.attribution.authorUserId !== userId) continue;
    const current = entry.message.channelId;
    if (lastChannel && lastChannel !== current) {
      switches += 1;
    }
    lastChannel = current;
  }

  return switches;
}

function messageAverageLength(messages: readonly ChatMessage[]): number {
  if (!messages.length) return 0;
  return mean(messages.map((message) => message.plainText.length));
}

function collectResponseIntervals(
  entries: readonly ChatTranscriptEntry[],
  userId: Nullable<ChatUserId>,
): readonly number[] {
  if (!userId) return [];
  const intervals: number[] = [];
  let lastInboundAt: Nullable<number> = null;

  for (const entry of entries) {
    const authoredByUser = entry.message.attribution.authorUserId === userId;
    const inbound = !authoredByUser && entry.message.attribution.sourceType !== 'SYSTEM';

    if (inbound) {
      lastInboundAt = entry.message.createdAt;
      continue;
    }

    if (authoredByUser && lastInboundAt) {
      intervals.push(Math.max(0, entry.message.createdAt - lastInboundAt));
      lastInboundAt = null;
    }
  }

  return intervals;
}

function computeMessageLengthVolatility01(messages: readonly ChatMessage[]): Score01 {
  if (messages.length < 2) return 0;
  const lengths = messages.map((m) => m.plainText.length);
  const avg = mean(lengths);
  if (avg <= 0) return 0;
  return asScore(stddev(lengths) / Math.max(avg, 1));
}

function computeCapsAggression01(
  messages: readonly ChatMessage[],
  userId: Nullable<ChatUserId>,
): Score01 {
  const authored = messages.filter((m) => m.attribution.authorUserId === userId);
  if (!authored.length) return 0;
  const capsCount = authored.filter((m) => {
    const upper = m.plainText.replace(/[^A-Za-z]/g, '');
    if (!upper.length) return false;
    const ratio01 = (m.plainText.match(/[A-Z]/g)?.length ?? 0) / upper.length;
    return ratio01 > 0.55;
  }).length;
  return asScore(ratio(capsCount, authored.length));
}

function computeRepetitionPressure01(
  messages: readonly ChatMessage[],
  userId: Nullable<ChatUserId>,
  window: number,
): Score01 {
  if (!userId) return 0;
  const authored = messages
    .filter((m) => m.attribution.authorUserId === userId)
    .slice(-window);
  if (authored.length < 2) return 0;
  const texts = authored.map((m) => m.plainText.trim().toLowerCase().slice(0, 64));
  const dupes = texts.filter((t, i) => texts.slice(0, i).includes(t)).length;
  return asScore(ratio(dupes, authored.length));
}

function computeSpamVelocity01(
  entries: readonly ChatTranscriptEntry[],
  userId: Nullable<ChatUserId>,
  burstWindowMs: number,
  now: UnixMs,
): Score01 {
  if (!userId) return 0;
  const cutoff = (now as number) - burstWindowMs;
  const burst = entries.filter(
    (e) =>
      e.message.attribution.authorUserId === userId &&
      (e.message.createdAt as number) >= cutoff,
  ).length;
  return asScore(ratio(burst, 6));
}

function computeTargetFixation01(
  entries: readonly ChatTranscriptEntry[],
  targetUserId: Nullable<ChatUserId>,
  windowCount: number,
): Score01 {
  if (!targetUserId) return 0;
  const recent = entries.slice(-Math.max(windowCount * 3, 12));
  const haterMessages = recent.filter((e) => e.message.attribution.npcRole === 'HATER');
  if (!haterMessages.length) return 0;
  const mentionsTarget = haterMessages.filter(
    (e) => e.message.attribution.targetUserId === targetUserId,
  ).length;
  return asScore(ratio(mentionsTarget, haterMessages.length));
}

function computePileOnExposure01(
  entries: readonly ChatTranscriptEntry[],
  targetUserId: Nullable<ChatUserId>,
  windowCount: number,
): Score01 {
  if (!targetUserId) return 0;
  const recent = entries.slice(-Math.max(windowCount * 2, 8));
  const hostile = recent.filter(
    (e) =>
      e.message.attribution.targetUserId === targetUserId &&
      (e.message.tags.includes('attack') || e.message.tags.includes('negative')),
  );
  const uniqueAttackers = new Set(hostile.map((e) => e.message.attribution.actorId)).size;
  return asScore(Math.min(uniqueAttackers / 3, 1));
}

function computeShadowHostility01(
  entries: readonly ChatTranscriptEntry[],
  windowCount: number,
): Score01 {
  const shadow = entries
    .filter((e) => e.visibility === 'SHADOW')
    .slice(-windowCount);
  const hostile = shadow.filter(
    (e) => e.message.tags.includes('attack') || e.message.tags.includes('negative'),
  ).length;
  return asScore(ratio(hostile, Math.max(shadow.length, 1)));
}

function computeInsultDensity01(
  entries: readonly ChatTranscriptEntry[],
  targetUserId: Nullable<ChatUserId>,
): Score01 {
  if (!targetUserId) return 0;
  const targeted = entries.filter(
    (e) =>
      e.message.attribution.targetUserId === targetUserId &&
      (e.message.tags.includes('insult') || e.message.tags.includes('mockery') || e.message.tags.includes('slur')),
  );
  return asScore(ratio(targeted.length, Math.max(entries.length, 1)));
}

function computeThreatLanguage01(
  entries: readonly ChatTranscriptEntry[],
  targetUserId: Nullable<ChatUserId>,
): Score01 {
  if (!targetUserId) return 0;
  const threat = entries.filter(
    (e) =>
      e.message.attribution.targetUserId === targetUserId &&
      e.message.tags.includes('threat'),
  );
  return asScore(ratio(threat.length, Math.max(entries.length, 1)));
}

function computeRidiculeExposure01(
  entries: readonly ChatTranscriptEntry[],
  targetUserId: Nullable<ChatUserId>,
): Score01 {
  if (!targetUserId) return 0;
  const ridicule = entries.filter(
    (e) =>
      e.message.attribution.targetUserId === targetUserId &&
      (e.message.tags.includes('ridicule') || e.message.tags.includes('humiliation')),
  );
  return asScore(ratio(ridicule.length, Math.max(entries.length, 1)));
}

function computeNegativeSwarm01(
  audienceHeat: Nullable<ChatAudienceHeat>,
  entries: readonly ChatTranscriptEntry[],
): Score01 {
  if (audienceHeat?.swarmDirection === 'NEGATIVE') {
    return asScore(0.60 + (audienceHeat.heat01 as number) * 0.40);
  }
  const negCount = entries.filter(
    (e) => e.message.tags.includes('negative') || e.message.tags.includes('attack'),
  ).length;
  return asScore(ratio(negCount, Math.max(entries.length, 1)) * 0.60);
}

function computePositiveSwarm01(
  audienceHeat: Nullable<ChatAudienceHeat>,
  entries: readonly ChatTranscriptEntry[],
): Score01 {
  if (audienceHeat?.swarmDirection === 'POSITIVE') {
    return asScore(0.55 + (audienceHeat.heat01 as number) * 0.45);
  }
  const posCount = entries.filter(
    (e) => e.message.tags.includes('positive') || e.message.tags.includes('rescue'),
  ).length;
  return asScore(ratio(posCount, Math.max(entries.length, 1)) * 0.55);
}

function computeNegotiationIntensity01(
  signal: Nullable<ChatSignalEnvelope>,
  activeChannel: ChatVisibleChannel,
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): Score01 {
  const fromSignal = signal?.economy
    ? (signal.economy.bluffRisk01 ?? 0) * 0.40 +
      (signal.economy.overpayRisk01 ?? 0) * 0.30 +
      (signal.economy.liquidityStress01 ?? 0) * 0.20 +
      (signal.economy.activeDealCount ? 0.10 : 0)
    : 0;
  const channelBonus = activeChannel === 'DEAL_ROOM' ? defaults.negotiationIntensityPressureThreshold : 0;
  return asScore(fromSignal + channelBonus);
}

function computeDealPressure01(
  signal: Nullable<ChatSignalEnvelope>,
  negotiationIntensity01: Score01,
  activeChannel: ChatVisibleChannel,
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): Score01 {
  const bluff = signal?.economy?.bluffRisk01 ?? 0;
  const liquidity = signal?.economy?.liquidityStress01 ?? 0;
  const channelBias = activeChannel === 'DEAL_ROOM' ? 0.14 : 0;
  return asScore(
    bluff * defaults.dealPressureBluffWeight +
      liquidity * 0.24 +
      (negotiationIntensity01 as number) * 0.22 +
      channelBias,
  );
}

function computeBluffExposure01(signal: Nullable<ChatSignalEnvelope>): Score01 {
  return asScore(signal?.economy?.bluffRisk01 ?? 0);
}

function computeDominance01(
  affect: ChatAffectSnapshot,
  entries: readonly ChatTranscriptEntry[],
  userId: Nullable<ChatUserId>,
): Score01 {
  const confidence = affect.confidence01 as number;
  const authored = entries.filter((e) => e.message.attribution.authorUserId === userId).length;
  const total = Math.max(entries.length, 1);
  const shareBonus = ratio(authored, total) * 0.22;
  return asScore(confidence * 0.56 + shareBonus + (1 - (affect.intimidation01 as number)) * 0.12);
}

function computeDesperation01(
  affect: ChatAffectSnapshot,
  signal: Nullable<ChatSignalEnvelope>,
): Score01 {
  const frustration = affect.frustration01 as number;
  const bankruptcy = signal?.run?.bankruptcyWarning ? 0.24 : 0;
  const liquidityStress = signal?.economy?.liquidityStress01 ?? 0;
  return asScore(frustration * 0.42 + (affect.embarrassment01 as number) * 0.22 + bankruptcy + liquidityStress * 0.12);
}

function computeSovereigntyComposure01(
  signal: Nullable<ChatSignalEnvelope>,
  affect: ChatAffectSnapshot,
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): Score01 {
  const nearSovereignty = signal?.run?.nearSovereignty ? 1 : 0;
  if (!nearSovereignty) return 0;
  const confidence = affect.confidence01 as number;
  const composure = confidence >= defaults.sovereigntyComposureHighStake ? confidence : confidence * 0.44;
  return asScore(composure * 0.72 + (1 - (affect.frustration01 as number)) * 0.28);
}

function computeComebackPotential01(
  affect: ChatAffectSnapshot,
  signal: Nullable<ChatSignalEnvelope>,
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): Score01 {
  const engagement = affect.attachment01 as number;
  if (engagement < defaults.comingbackPotentialMinEngagement) return 0;
  const relief = affect.relief01 as number;
  const confidence = affect.confidence01 as number;
  const rescueOpen = signal?.battle?.rescueWindowOpen ? 0.18 : 0;
  return asScore(
    confidence * 0.36 +
      relief * 0.24 +
      engagement * 0.16 +
      rescueOpen +
      (affect.curiosity01 as number) * 0.06,
  );
}

function computeSilenceAfterProvocation01(
  entries: readonly ChatTranscriptEntry[],
  userId: Nullable<ChatUserId>,
  now: UnixMs,
  windowMs: number,
): Score01 {
  if (!userId) return 0;
  const cutoff = (now as number) - windowMs;
  const recentEntries = entries.filter((e) => (e.appendedAt as number) >= cutoff);
  const lastHaterAt = recentEntries
    .filter((e) => e.message.attribution.npcRole === 'HATER')
    .reduce((max, e) => Math.max(max, e.message.createdAt as number), 0);
  if (!lastHaterAt) return 0;
  const playerResponseAfterHater = recentEntries.some(
    (e) =>
      e.message.attribution.authorUserId === userId &&
      (e.message.createdAt as number) > lastHaterAt,
  );
  return playerResponseAfterHater ? 0 : asScore(Math.min(1, ((now as number) - lastHaterAt) / 15_000));
}

function computeAffect(
  profile: Nullable<ChatLearningProfile>,
  messages: readonly ChatMessage[],
  audienceHeat: Nullable<ChatAudienceHeat>,
  signal: Nullable<ChatSignalEnvelope>,
): ChatAffectSnapshot {
  const base = profile?.affect ?? {
    confidence01: asScore(0.48),
    frustration01: asScore(0.22),
    intimidation01: asScore(0.18),
    attachment01: asScore(0.14),
    curiosity01: asScore(0.22),
    embarrassment01: asScore(0.10),
    relief01: asScore(0.08),
  };

  const helperCount = messages.filter((message) => message.attribution.npcRole === 'HELPER').length;
  const haterCount = messages.filter((message) => message.attribution.npcRole === 'HATER').length;
  const recentNegative = messages.filter((message) => message.tags.includes('negative') || message.tags.includes('attack')).length;
  const recentPositive = messages.filter((message) => message.tags.includes('positive') || message.tags.includes('rescue')).length;
  const heat = audienceHeat?.heat01 ?? asScore(0.18);
  const hostileMomentum = (signal?.battle?.hostileMomentum ?? 20) / 100;
  const rescueOpen = signal?.battle?.rescueWindowOpen ?? false;

  return Object.freeze({
    confidence01: asScore(clamp01(base.confidence01 + recentPositive * 0.04 - recentNegative * 0.03 - hostileMomentum * 0.08)),
    frustration01: asScore(clamp01(base.frustration01 + haterCount * 0.06 + hostileMomentum * 0.14 + heat * 0.12)),
    intimidation01: asScore(clamp01(base.intimidation01 + hostileMomentum * 0.18 + haterCount * 0.08)),
    attachment01: asScore(clamp01(base.attachment01 + helperCount * 0.06 + recentPositive * 0.04)),
    curiosity01: asScore(clamp01(base.curiosity01 + (signal?.liveops?.worldEventName ? 0.12 : 0) + (signal?.economy?.activeDealCount ? 0.04 : 0))),
    embarrassment01: asScore(clamp01(base.embarrassment01 + (audienceHeat?.swarmDirection === 'NEGATIVE' ? 0.16 : 0) + recentNegative * 0.03)),
    relief01: asScore(clamp01(base.relief01 + (rescueOpen ? 0.18 : 0) + helperCount * 0.05 - haterCount * 0.02)),
  });
}

function derivePressureTier(signal: Nullable<ChatSignalEnvelope>): PressureTier {
  return signal?.battle?.pressureTier ?? 'BUILDING';
}

function deriveTickTier(signal: Nullable<ChatSignalEnvelope>): TickTier | 'UNKNOWN' {
  return signal?.run?.tickTier ?? 'UNKNOWN';
}

function deriveHostileMomentum01(signal: Nullable<ChatSignalEnvelope>, entries: readonly ChatTranscriptEntry[]): Score01 {
  const signalMomentum = signal?.battle?.hostileMomentum ? signal.battle.hostileMomentum / 100 : 0;
  const recentHaterShare = ratio(
    entries.filter((entry) => entry.message.attribution.npcRole === 'HATER').length,
    Math.max(entries.length, 1),
  );

  return asScore(clamp01(signalMomentum * 0.68 + recentHaterShare * 0.32));
}

function deriveChurnRisk01(
  profile: Nullable<ChatLearningProfile>,
  silenceMs: number,
  affect: ChatAffectSnapshot,
  entries: readonly ChatTranscriptEntry[],
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): Score01 {
  const baseline = profile?.churnRisk01 ?? asScore(0.18);
  const silenceRisk = clamp01(ratio(silenceMs, defaults.hardSilenceMs));
  const frustration = affect.frustration01;
  const embarrassment = affect.embarrassment01;
  const helperIgnored = entries.filter((entry) => entry.message.attribution.npcRole === 'HELPER' && entry.message.createdAt <= asUnixMs((entry.appendedAt as number) - defaults.helperIgnoreMs)).length;

  return asScore(
    clamp01(
      baseline * 0.34 +
        silenceRisk * 0.22 +
        frustration * 0.16 +
        embarrassment * 0.14 +
        clamp01(ratio(helperIgnored, 3)) * 0.14,
    ),
  );
}

function selectTranscriptWindow(
  state: ChatState,
  roomId: Nullable<ChatRoomId>,
  now: UnixMs,
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): readonly ChatTranscriptEntry[] {
  if (!roomId) return [];
  const entries = state.transcript.byRoom[roomId] ?? [];
  const cutoff = (now as number) - defaults.transcriptWindowMs;
  return entries
    .filter((entry) => (entry.appendedAt as number) >= cutoff)
    .slice(-defaults.transcriptWindowMessages);
}

function selectAnchoredMessages(transaction: ChatEngineTransaction): readonly ChatMessage[] {
  return transaction.delta?.appendedMessages ?? [];
}

function selectSignal(event: ChatNormalizedInput): Nullable<ChatSignalEnvelope> {
  return event.kind === 'BATTLE_SIGNAL' ||
    event.kind === 'RUN_SIGNAL' ||
    event.kind === 'MULTIPLAYER_SIGNAL' ||
    event.kind === 'ECONOMY_SIGNAL' ||
    event.kind === 'LIVEOPS_SIGNAL'
    ? (event.payload as ChatSignalEnvelope)
    : null;
}

function inferSourceChannel(event: ChatNormalizedInput, room: Nullable<ChatRoomState>): string {
  if ('requestedVisibleChannel' in event.payload && event.payload.requestedVisibleChannel) {
    return String(event.payload.requestedVisibleChannel);
  }

  if ('channelId' in event.payload && event.payload.channelId) {
    return String(event.payload.channelId);
  }

  return room?.activeVisibleChannel ?? 'GLOBAL';
}

function buildAnchorSet(
  transaction: ChatEngineTransaction,
  roomId: Nullable<ChatRoomId>,
  sessionId: Nullable<ChatSessionId>,
  userId: Nullable<ChatUserId>,
): ChatFeatureAnchorSet {
  const appended = transaction.delta?.appendedMessages ?? [];
  const proofEdges = transaction.delta?.proofEdges ?? [];
  const replayArtifacts = transaction.delta?.replayArtifacts ?? [];
  const telemetry = transaction.delta?.telemetry ?? [];

  return Object.freeze({
    eventId: transaction.event.eventId,
    roomId,
    sessionId,
    userId,
    messageIds: appended.map((message) => message.id),
    causalMessageIds: unique(
      appended.flatMap((message) => message.proof.causalParentMessageIds),
    ),
    replayAnchorKeys: unique(
      replayArtifacts.map((artifact) => artifact.anchorKey),
    ),
    telemetryEventNames: unique(
      telemetry.map((envelope) => envelope.eventName),
    ),
  });
}

function buildWindowSummary(
  context: ChatFeatureContext,
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): ChatFeatureWindowSummary {
  const entries = context.transcriptWindow;
  const messages = entries.map((entry) => entry.message);
  const authoredByPlayer = messages.filter((message) => message.attribution.authorUserId === context.event.userId);
  const inboundNpc = messages.filter((message) => message.attribution.npcRole !== null);
  const helperMessages = messages.filter((message) => message.attribution.npcRole === 'HELPER');
  const haterMessages = messages.filter((message) => message.attribution.npcRole === 'HATER');
  const visibleMessages = entries.filter((entry) => entry.visibility === 'VISIBLE');
  const shadowMessages = entries.filter((entry) => entry.visibility === 'SHADOW');
  const negativeMessages = entries.filter((e) => e.message.tags.includes('negative') || e.message.tags.includes('attack'));
  const positiveMessages = entries.filter((e) => e.message.tags.includes('positive') || e.message.tags.includes('rescue'));

  const ignoredHelperCount = helperMessages.filter((message) => {
    const anyPlayerResponseAfter = messages.some(
      (candidate) =>
        candidate.attribution.authorUserId === context.event.userId &&
        (candidate.createdAt as number) > (message.createdAt as number) &&
        (candidate.createdAt as number) <= (message.createdAt as number) + defaults.helperIgnoreMs,
    );
    return !anyPlayerResponseAfter;
  }).length;

  const latestMessageAt = messages.length
    ? Math.max(...messages.map((message) => message.createdAt as number))
    : null;
  const silenceMs = latestMessageAt ? Math.max(0, (context.now as number) - latestMessageAt) : defaults.hardSilenceMs;
  const responseIntervals = collectResponseIntervals(entries, context.event.userId);

  const capsMessages = authoredByPlayer.filter((m) => {
    const alpha = m.plainText.replace(/[^A-Za-z]/g, '');
    if (!alpha.length) return false;
    return (m.plainText.match(/[A-Z]/g)?.length ?? 0) / alpha.length > defaults.capsAggressionThreshold;
  });

  const repeatedMessages = (() => {
    const texts = authoredByPlayer.map((m) => m.plainText.trim().toLowerCase().slice(0, 48));
    return texts.filter((t, i) => texts.slice(0, i).includes(t)).length;
  })();

  const lastHaterAt = haterMessages.length
    ? Math.max(...haterMessages.map((m) => m.createdAt as number))
    : 0;
  const playerRespondedAfterHater = lastHaterAt > 0 && authoredByPlayer.some(
    (m) => (m.createdAt as number) > lastHaterAt,
  );
  const silenceAfterProvocationMs = lastHaterAt && !playerRespondedAfterHater
    ? Math.max(0, (context.now as number) - lastHaterAt)
    : 0;

  return Object.freeze({
    roomMessageCountWindow: entries.length,
    inboundNpcCountWindow: inboundNpc.length,
    outboundPlayerCountWindow: authoredByPlayer.length,
    ignoredHelperCountWindow: ignoredHelperCount,
    haterBurstCountWindow: haterMessages.filter((message) => (context.now as number) - (message.createdAt as number) <= defaults.haterBurstMs).length,
    helperMessageCountWindow: helperMessages.length,
    visibleMessageCountWindow: visibleMessages.length,
    shadowMessageCountWindow: shadowMessages.length,
    uniqueSpeakersWindow: unique(messages.map((message) => message.attribution.actorId)).length,
    silenceMs,
    averageResponseMs: mean(responseIntervals),
    averageMessageLength: messageAverageLength(messages),
    channelSwitchCountWindow: channelSwitchCount(entries, context.event.userId),
    roomMemberCount: context.room ? roomMemberCount(context.state, context.room.roomId) : 0,
    activeInvasionCount: context.invasions.length,
    haterMessageCountWindow: haterMessages.length,
    negativeTagCountWindow: negativeMessages.length,
    positiveTagCountWindow: positiveMessages.length,
    capsMessageCountWindow: capsMessages.length,
    repetitionCountWindow: repeatedMessages,
    silenceAfterProvocationMs,
  });
}

function deriveEntitySelections(context: ChatFeatureContext): readonly EntitySelection[] {
  const entities: EntitySelection[] = [];

  if (context.room?.roomId) {
    entities.push({
      entityKind: 'ROOM',
      entityKey: `ROOM:${context.room.roomId}`,
      roomId: context.room.roomId,
      sessionId: null,
      userId: null,
    });
  }

  if (context.session?.identity.sessionId) {
    entities.push({
      entityKind: 'SESSION',
      entityKey: `SESSION:${context.session.identity.sessionId}`,
      roomId: context.room?.roomId ?? null,
      sessionId: context.session.identity.sessionId,
      userId: null,
    });
  }

  if (context.session?.identity.userId) {
    entities.push({
      entityKind: 'USER',
      entityKey: `USER:${context.session.identity.userId}`,
      roomId: null,
      sessionId: null,
      userId: context.session.identity.userId,
    });
  }

  if (context.room?.roomId && context.session?.identity.userId) {
    entities.push({
      entityKind: 'ROOM_USER',
      entityKey: `ROOM_USER:${context.room.roomId}:${context.session.identity.userId}`,
      roomId: context.room.roomId,
      sessionId: null,
      userId: context.session.identity.userId,
    });
  }

  if (context.session?.identity.sessionId && context.session.identity.userId) {
    entities.push({
      entityKind: 'SESSION_USER',
      entityKey: `SESSION_USER:${context.session.identity.sessionId}:${context.session.identity.userId}`,
      roomId: context.room?.roomId ?? null,
      sessionId: context.session.identity.sessionId,
      userId: context.session.identity.userId,
    });
  }

  return entities;
}

function buildCanonicalSnapshot(
  context: ChatFeatureContext,
  window: ChatFeatureWindowSummary,
): Nullable<ChatFeatureSnapshot> {
  if (!context.room?.roomId || !context.session?.identity.userId) {
    return null;
  }

  return Object.freeze({
    generatedAt: context.now,
    userId: context.session.identity.userId,
    roomId: context.room.roomId,
    messageCountWindow: window.roomMessageCountWindow,
    inboundNpcCountWindow: window.inboundNpcCountWindow,
    outboundPlayerCountWindow: window.outboundPlayerCountWindow,
    ignoredHelperCountWindow: window.ignoredHelperCountWindow,
    pressureTier: context.pressureTier,
    hostileMomentum01: deriveHostileMomentum01(context.signal, context.transcriptWindow),
    roomHeat01: context.audienceHeat?.heat01 ?? asScore(0.16),
    affect: context.affect,
    churnRisk01: deriveChurnRisk01(context.learningProfile, window.silenceMs, context.affect, context.transcriptWindow, CHAT_FEATURE_INGESTOR_DEFAULTS),
  });
}

function buildScalarFeatures(
  context: ChatFeatureContext,
  window: ChatFeatureWindowSummary,
  canonicalSnapshot: Nullable<ChatFeatureSnapshot>,
  defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS,
): ChatFeatureScalarMap {
  const signal = context.signal;
  const entries = context.transcriptWindow;
  const messages = entries.map((e) => e.message);
  const userId = context.event.userId;
  const roomHeat01 = context.audienceHeat?.heat01 ?? asScore(0.16);
  const hostileMomentum01 = canonicalSnapshot?.hostileMomentum01 ?? asScore(0.18);
  const churnRisk01 = canonicalSnapshot?.churnRisk01 ?? asScore(0.20);
  const helperReceptivity01 = context.learningProfile?.helperReceptivity01 ?? asScore(0.44);
  const haterSusceptibility01 = context.learningProfile?.haterSusceptibility01 ?? asScore(0.36);
  const negotiationAggression01 = context.learningProfile?.negotiationAggression01 ?? asScore(0.42);
  const channelAffinity = context.learningProfile?.channelAffinity;
  const responseCadence01 = asScore(clamp01(1 - ratio(window.averageResponseMs, 14_000)));
  const silenceConcern01 = asScore(clamp01(ratio(window.silenceMs, defaults.hardSilenceMs)));
  const helperIgnore01 = asScore(clamp01(ratio(window.ignoredHelperCountWindow, 3)));
  const invasionPressure01 = asScore(clamp01(ratio(window.activeInvasionCount, 2)));
  const visibilityExposure01 = asScore(
    clamp01(ratio(window.visibleMessageCountWindow, Math.max(window.visibleMessageCountWindow + window.shadowMessageCountWindow, 1))),
  );
  const recentPlayerShare01 = asScore(clamp01(ratio(window.outboundPlayerCountWindow, Math.max(window.roomMessageCountWindow, 1))));
  const recentNpcShare01 = asScore(clamp01(ratio(window.inboundNpcCountWindow, Math.max(window.roomMessageCountWindow, 1))));
  const helperDensity01 = asScore(clamp01(ratio(window.helperMessageCountWindow, Math.max(window.roomMessageCountWindow, 1))));
  const haterDensity01 = asScore(clamp01(ratio(window.haterBurstCountWindow, Math.max(window.roomMessageCountWindow, 1))));
  const roomCrowding01 = asScore(clamp01(ratio(window.roomMemberCount, 12)));
  const switchStress01 = asScore(clamp01(ratio(window.channelSwitchCountWindow, 5)));
  const averageMessageLength01 = asScore(clamp01(ratio(window.averageMessageLength, 280)));
  const rescueOpportunity01 = asScore(
    clamp01(
      signal?.battle?.rescueWindowOpen
        ? 0.82
        : helperReceptivity01 * 0.40 + (1 - silenceConcern01) * 0.16 + (1 - helperIgnore01) * 0.18,
    ),
  );
  const toxicityRisk01 = asScore(
    clamp01(
      hostileMomentum01 * 0.36 +
        haterDensity01 * 0.20 +
        context.affect.frustration01 * 0.16 +
        context.affect.intimidation01 * 0.10 +
        roomHeat01 * (context.audienceHeat?.swarmDirection === 'NEGATIVE' ? 0.18 : 0.08),
    ),
  );

  // Extended derived scalars
  const negotiationIntensity01 = computeNegotiationIntensity01(signal, context.activeChannel, defaults);
  const dealPressure01 = computeDealPressure01(signal, negotiationIntensity01, context.activeChannel, defaults);
  const bluffExposure01 = computeBluffExposure01(signal);
  const negativeSwarm01 = computeNegativeSwarm01(context.audienceHeat, entries);
  const positiveSwarm01 = computePositiveSwarm01(context.audienceHeat, entries);
  const dominance01 = computeDominance01(context.affect, entries, userId);
  const desperation01 = computeDesperation01(context.affect, signal);
  const targetFixation01 = computeTargetFixation01(entries, userId, defaults.targetFixationWindowCount);
  const pileOnExposure01 = computePileOnExposure01(entries, userId, defaults.pileonThreshold);
  const shadowHostility01 = computeShadowHostility01(entries, defaults.shadowHostilityWindow);
  const insultDensity01 = computeInsultDensity01(entries, userId);
  const threatLanguage01 = computeThreatLanguage01(entries, userId);
  const ridiculeExposure01 = computeRidiculeExposure01(entries, userId);
  const capsAggression01 = computeCapsAggression01(messages, userId);
  const repetitionPressure01 = computeRepetitionPressure01(messages, userId, 8);
  const spamVelocity01 = computeSpamVelocity01(entries, userId, defaults.haterBurstMs, context.now);
  const messageLengthVolatility01 = computeMessageLengthVolatility01(messages);
  const silenceAfterProvocation01 = asScore(clamp01(ratio(window.silenceAfterProvocationMs, 15_000)));
  const sovereigntyComposure01 = computeSovereigntyComposure01(signal, context.affect, defaults);
  const comebackPotential01 = computeComebackPotential01(context.affect, signal, defaults);
  const nearSovereignty01 = signal?.run?.nearSovereignty ? 1 : 0;
  const bankruptcyRisk01 = signal?.run?.bankruptcyWarning ? 1 : 0;

  return Object.freeze(limitScalarFeatures({
    eventAccepted01: 1,
    roomHeat01,
    hostileMomentum01,
    churnRisk01,
    helperReceptivity01,
    haterSusceptibility01,
    negotiationAggression01,
    responseCadence01,
    silenceConcern01,
    helperIgnore01,
    invasionPressure01,
    visibilityExposure01,
    recentPlayerShare01,
    recentNpcShare01,
    helperDensity01,
    haterDensity01,
    roomCrowding01,
    switchStress01,
    averageMessageLength01,
    rescueOpportunity01,
    toxicityRisk01,
    // Affect
    confidence01: context.affect.confidence01,
    frustration01: context.affect.frustration01,
    intimidation01: context.affect.intimidation01,
    attachment01: context.affect.attachment01,
    curiosity01: context.affect.curiosity01,
    embarrassment01: context.affect.embarrassment01,
    relief01: context.affect.relief01,
    // Extended affect/behavioral
    dominance01,
    desperation01,
    negativeSwarm01,
    positiveSwarm01,
    targetFixation01,
    pileOnExposure01,
    shadowHostility01,
    insultDensity01,
    threatLanguage01,
    ridiculeExposure01,
    capsAggression01,
    repetitionPressure01,
    spamVelocity01,
    messageLengthVolatility01,
    silenceAfterProvocation01,
    sovereigntyComposure01,
    comebackPotential01,
    // Negotiation/economy
    negotiationIntensity01,
    dealPressure01,
    bluffExposure01,
    nearSovereignty01,
    bankruptcyRisk01,
    // Pressure/tick indicators
    pressureNone01: context.pressureTier === 'NONE' ? 1 : 0,
    pressureBuilding01: context.pressureTier === 'BUILDING' ? 1 : 0,
    pressureElevated01: context.pressureTier === 'ELEVATED' ? 1 : 0,
    pressureHigh01: context.pressureTier === 'HIGH' ? 1 : 0,
    pressureCritical01: context.pressureTier === 'CRITICAL' ? 1 : 0,
    tickSetup01: context.tickTier === 'SETUP' ? 1 : 0,
    tickWindow01: context.tickTier === 'WINDOW' ? 1 : 0,
    tickCommit01: context.tickTier === 'COMMIT' ? 1 : 0,
    tickResolution01: context.tickTier === 'RESOLUTION' ? 1 : 0,
    tickSeal01: context.tickTier === 'SEAL' ? 1 : 0,
    // Battle
    battleShieldIntegrity01: signal?.battle?.shieldIntegrity01 ?? 0,
    battleRescueWindowOpen01: signal?.battle?.rescueWindowOpen ? 1 : 0,
    battleLastAttackRecent01: signal?.battle?.lastAttackAt
      ? clamp01(1 - ratio((context.now as number) - (signal.battle.lastAttackAt as number), defaults.signalWindowMs))
      : 0,
    // Run
    runElapsedPressure01: signal?.run ? clamp01(ratio(signal.run.elapsedMs, 20 * 60_000)) : 0,
    runBankruptcyWarning01: bankruptcyRisk01,
    runNearSovereignty01: nearSovereignty01,
    // Multiplayer
    multiplayerRankingPressure01: signal?.multiplayer ? clamp01(signal.multiplayer.rankingPressure / 100) : 0,
    multiplayerPartySize01: signal?.multiplayer ? clamp01(ratio(signal.multiplayer.partySize, 4)) : 0,
    // Economy
    economyLiquidityStress01: signal?.economy?.liquidityStress01 ?? 0,
    economyOverpayRisk01: signal?.economy?.overpayRisk01 ?? 0,
    economyBluffRisk01: signal?.economy?.bluffRisk01 ?? 0,
    // Liveops
    liveopsHeatMultiplier01: signal?.liveops?.heatMultiplier01 ?? 0,
    liveopsHelperBlackout01: signal?.liveops?.helperBlackout ? 1 : 0,
    liveopsHaterRaid01: signal?.liveops?.haterRaidActive ? 1 : 0,
    // Channel affinity
    affinityGlobal01: channelAffinity?.GLOBAL ?? 0.25,
    affinitySyndicate01: channelAffinity?.SYNDICATE ?? 0.25,
    affinityDealRoom01: channelAffinity?.DEAL_ROOM ?? 0.25,
    affinityLobby01: channelAffinity?.LOBBY ?? 0.25,
  }, defaults.maxScalarFeatures));
}

function buildCategoricalFeatures(
  context: ChatFeatureContext,
  window: ChatFeatureWindowSummary,
): ChatFeatureCategoricalMap {
  const sourceChannel = inferSourceChannel(context.event, context.room);
  const signal = context.signal;

  return Object.freeze(limitCategoricalFeatures({
    engineVersion: BACKEND_CHAT_ENGINE_VERSION,
    roomKind: context.room?.roomKind ?? 'UNKNOWN',
    activeVisibleChannel: context.activeChannel,
    sourceEventKind: context.event.kind,
    sourceChannel,
    tickTier: context.tickTier,
    pressureTier: context.pressureTier,
    roomStageMood: context.room?.stageMood ?? 'FOCUSED',
    roomSwarmDirection: context.audienceHeat?.swarmDirection ?? 'NEUTRAL',
    sourceAttackType: signal?.battle?.activeAttackType ?? 'NONE',
    sourceBotId: signal?.battle?.activeBotId ?? 'NONE',
    runPhase: signal?.run?.runPhase ?? 'UNKNOWN',
    runOutcome: signal?.run?.outcome ?? 'UNKNOWN',
    factionName: signal?.multiplayer?.factionName ?? 'NONE',
    worldEventName: signal?.liveops?.worldEventName ?? 'NONE',
    invasionState: window.activeInvasionCount > 0 ? 'ACTIVE' : 'CLEAR',
    contributorBand: window.uniqueSpeakersWindow >= 6 ? 'SWARM' : window.uniqueSpeakersWindow >= 3 ? 'ACTIVE' : 'QUIET',
    silenceBand: window.silenceMs >= CHAT_FEATURE_INGESTOR_DEFAULTS.hardSilenceMs
      ? 'HARD'
      : window.silenceMs >= CHAT_FEATURE_INGESTOR_DEFAULTS.staleSilenceMs
        ? 'STALE'
        : 'FRESH',
    dealRoomPosture: context.activeChannel === 'DEAL_ROOM' ? 'ACTIVE' : 'INACTIVE',
    haterIntensityBand: window.haterBurstCountWindow >= 4 ? 'HIGH' : window.haterBurstCountWindow >= 2 ? 'MEDIUM' : 'LOW',
    helperPresenceBand: window.helperMessageCountWindow >= 3 ? 'STRONG' : window.helperMessageCountWindow >= 1 ? 'LIGHT' : 'ABSENT',
    swarmBand: window.uniqueSpeakersWindow >= 8 ? 'CROWD' : window.uniqueSpeakersWindow >= 4 ? 'GROUP' : 'SOLO',
  }, CHAT_FEATURE_INGESTOR_DEFAULTS.maxCategoricalFeatures));
}

function buildTags(
  context: ChatFeatureContext,
  window: ChatFeatureWindowSummary,
  canonicalSnapshot: Nullable<ChatFeatureSnapshot>,
): readonly string[] {
  const tags: string[] = [];

  tags.push(`event:${context.event.kind.toLowerCase()}`);
  tags.push(`room_kind:${(context.room?.roomKind ?? 'unknown').toLowerCase()}`);
  tags.push(`channel:${context.activeChannel.toLowerCase()}`);
  tags.push(`pressure:${context.pressureTier.toLowerCase()}`);

  if (context.tickTier !== 'UNKNOWN') tags.push(`tick:${context.tickTier.toLowerCase()}`);
  if (window.activeInvasionCount > 0) tags.push('active_invasion');
  if (window.ignoredHelperCountWindow > 0) tags.push('helper_ignored');
  if (window.haterBurstCountWindow > 0) tags.push('hater_burst');
  if (window.silenceMs >= CHAT_FEATURE_INGESTOR_DEFAULTS.staleSilenceMs) tags.push('stale_silence');
  if (window.silenceAfterProvocationMs > 0) tags.push('silence_after_provocation');
  if ((canonicalSnapshot?.churnRisk01 ?? 0) >= 0.66) tags.push('churn_watch');
  if ((canonicalSnapshot?.hostileMomentum01 ?? 0) >= 0.66) tags.push('hostile_momentum');
  if ((context.audienceHeat?.swarmDirection ?? 'NEUTRAL') === 'NEGATIVE') tags.push('negative_swarm');
  if ((context.audienceHeat?.swarmDirection ?? 'NEUTRAL') === 'POSITIVE') tags.push('positive_swarm');
  if (context.signal?.battle?.rescueWindowOpen) tags.push('rescue_window_open');
  if (context.signal?.run?.nearSovereignty) tags.push('near_sovereignty');
  if (context.signal?.run?.bankruptcyWarning) tags.push('bankruptcy_warning');
  if (context.signal?.liveops?.helperBlackout) tags.push('helper_blackout');
  if (context.signal?.liveops?.haterRaidActive) tags.push('hater_raid');
  if (context.room?.activeLegendId) tags.push('legend_room');
  if (context.activeChannel === 'DEAL_ROOM') tags.push('deal_room_active');
  if (context.activeChannel === 'SYNDICATE') tags.push('syndicate_active');
  if (window.capsMessageCountWindow >= 2) tags.push('caps_aggression');
  if (window.repetitionCountWindow >= 2) tags.push('repetition_pressure');
  if (window.negativeTagCountWindow >= 3) tags.push('hostile_burst');

  return Object.freeze(tags.slice(0, CHAT_FEATURE_INGESTOR_DEFAULTS.maxTags));
}

function contributorCount(transaction: ChatEngineTransaction): number {
  const delta = transaction.delta;
  if (!delta) return 1;

  return unique([
    ...delta.appendedMessages.map((message) => message.attribution.actorId),
    ...delta.learningProfilesTouched,
    ...delta.proofEdges.map((edge) => edge.edgeType),
    ...delta.telemetry.map((entry) => entry.eventName),
  ]).length;
}

function limitScalarFeatures(
  features: Record<string, number>,
  max: number,
): ChatFeatureScalarMap {
  const entries = Object.entries(features)
    .filter(([, value]) => Number.isFinite(value))
    .slice(0, max)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.freeze(Object.fromEntries(entries));
}

function limitCategoricalFeatures(
  features: Record<string, string>,
  max: number,
): ChatFeatureCategoricalMap {
  const entries = Object.entries(features)
    .map(([key, value]) => [key, safeString(value, 'UNKNOWN')] as const)
    .slice(0, max)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.freeze(Object.fromEntries(entries));
}

function filterScalarFeaturesByFamily(
  scalarFeatures: ChatFeatureScalarMap,
  family: ChatModelFamily,
): ChatFeatureScalarMap {
  const prefixesByFamily: Readonly<Record<ChatModelFamily, readonly string[]>> = Object.freeze({
    ONLINE_CONTEXT: [
      'event', 'room', 'visibility', 'pressure', 'tick', 'battle', 'run', 'multiplayer',
      'economy', 'liveops', 'affinity', 'confidence', 'frustration', 'intimidation',
      'attachment', 'curiosity', 'embarrassment', 'relief', 'invasion', 'dominance',
    ],
    ENGAGEMENT: [
      'recent', 'response', 'averageMessageLength', 'roomHeat', 'confidence',
      'attachment', 'curiosity', 'affinity', 'positive', 'relief', 'dominance', 'comeback',
    ],
    HATER_TARGETING: [
      'hostileMomentum', 'hater', 'toxicity', 'intimidation', 'frustration', 'visibility',
      'pressure', 'bluff', 'near', 'bankruptcy', 'target', 'pileOn', 'shadow', 'insult',
      'threat', 'caps', 'repetition', 'spam', 'ridicule', 'negative', 'dominance',
      'desperation', 'deal', 'negotiation', 'run', 'battle', 'economy', 'liveops',
    ],
    HELPER_TIMING: [
      'helper', 'rescue', 'silence', 'confidence', 'frustration', 'relief', 'churn',
      'embarrassment', 'curiosity', 'attachment', 'comeback', 'deal', 'near', 'run', 'battle',
    ],
    CHANNEL_AFFINITY: [
      'affinity', 'switch', 'roomCrowding', 'economy', 'multiplayer', 'visibility',
      'negotiation', 'deal', 'bluff', 'near', 'sovereignty',
    ],
    TOXICITY: [
      'toxicity', 'hostileMomentum', 'hater', 'frustration', 'embarrassment', 'roomHeat',
      'negative', 'insult', 'threat', 'ridicule', 'target', 'pileOn', 'shadow', 'caps',
      'repetition', 'spam', 'silence', 'moderation', 'negotiation',
    ],
    CHURN: [
      'churn', 'silence', 'helperIgnore', 'frustration', 'embarrassment', 'response',
      'rescue', 'roomHeat', 'negative', 'hater', 'attachment', 'comeback', 'sovereignty',
    ],
    INTERVENTION_POLICY: [
      'churn', 'helper', 'hater', 'rescue', 'roomHeat', 'hostileMomentum', 'toxicity',
      'confidence', 'frustration', 'economy', 'near', 'bankruptcy', 'deal', 'negotiation',
      'silence', 'affinity', 'switch', 'visibility',
    ],
  });

  const prefixes = prefixesByFamily[family];
  const filtered = Object.entries(scalarFeatures).filter(([key]) =>
    prefixes.some((prefix) => key.startsWith(prefix)),
  );

  return Object.freeze(Object.fromEntries(filtered.length ? filtered : Object.entries(scalarFeatures)));
}

function buildRowSignature(row: Omit<ChatFeatureRow, 'signature'>, hash: ChatFeatureIngestorHashPort): string {
  return hash.hash(
    stableStringify({
      family: row.family,
      entityKey: row.entityKey,
      eventId: row.anchors.eventId,
      generatedAt: row.generatedAt,
      scalarFeatures: row.scalarFeatures,
      categoricalFeatures: row.categoricalFeatures,
      tags: row.tags,
    }),
  );
}

// ============================================================================
// MARK: Quality grading
// ============================================================================

function gradeFromViolations(
  violations: readonly ChatFeatureRowViolation[],
  scalarDensity01: number,
  freshnessScore01: number,
): ChatFeatureQualityGrade {
  const errorCount = violations.filter((v) => v.severity === 'ERROR').length;
  const warnCount = violations.filter((v) => v.severity === 'WARN').length;

  if (errorCount >= 3 || (errorCount >= 1 && (scalarDensity01 < 0.30 || freshnessScore01 < 0.30))) return 'F';
  if (errorCount >= 2 || warnCount >= 4) return 'D';
  if (errorCount >= 1 || warnCount >= 3 || scalarDensity01 < 0.45) return 'C';
  if (warnCount >= 2 || scalarDensity01 < 0.65 || freshnessScore01 < 0.60) return 'B';
  return 'A';
}

function validateChatFeatureRowInternal(
  row: ChatFeatureRow,
  now: UnixMs,
  staleWindowMs: number,
  maxViolations: number,
): ChatFeatureRowValidationResult {
  const violations: ChatFeatureRowViolation[] = [];

  if (!row.roomId) {
    violations.push({ kind: 'MISSING_ROOM_ID', severity: 'WARN', message: 'Row has no roomId — cross-room scoring may be impaired.' });
  }
  if (!row.userId) {
    violations.push({ kind: 'MISSING_USER_ID', severity: 'WARN', message: 'Row has no userId — user-scoped models cannot use this row.' });
  }
  if (!row.sessionId) {
    violations.push({ kind: 'MISSING_SESSION_ID', severity: 'INFO', message: 'Row has no sessionId — session continuity tracking unavailable.' });
  }

  const ageMs = Math.max(0, (now as number) - (row.generatedAt as number));
  if (ageMs > staleWindowMs) {
    violations.push({ kind: 'STALE_FEATURES', severity: 'WARN', message: `Row is ${Math.round(ageMs / 1000)}s old (stale threshold ${Math.round(staleWindowMs / 1000)}s).` });
  }

  const scalarCount = Object.keys(row.scalarFeatures).length;
  const maxScalar = CHAT_FEATURE_INGESTOR_DEFAULTS.maxScalarFeatures;
  const scalarDensity01 = clamp01(ratio(scalarCount, maxScalar * 0.60));
  if (scalarDensity01 < 0.30) {
    violations.push({ kind: 'LOW_SCALAR_DENSITY', severity: 'WARN', message: `Scalar density is ${(scalarDensity01 * 100).toFixed(0)}% (${scalarCount} features).` });
  }

  if (!row.canonicalSnapshot) {
    violations.push({ kind: 'MISSING_CANONICAL_SNAPSHOT', severity: 'INFO', message: 'Canonical snapshot is absent — cross-model snapshot sharing unavailable.' });
  }

  if (row.channelId !== 'GLOBAL' && row.channelId !== 'SYNDICATE' && row.channelId !== 'DEAL_ROOM' && row.channelId !== 'LOBBY') {
    violations.push({ kind: 'CHANNEL_AMBIGUOUS', severity: 'WARN', message: `Channel ID '${row.channelId}' is not a recognized ChatVisibleChannel.` });
  }

  const freshnessScore01 = ageMs <= staleWindowMs
    ? clamp01(1 - ageMs / staleWindowMs)
    : 0;
  const evidenceScore01 = clamp01(scalarDensity01 * 0.70 + (row.canonicalSnapshot ? 0.30 : 0));

  const truncatedViolations = violations.slice(0, maxViolations);
  const grade = gradeFromViolations(truncatedViolations, scalarDensity01, freshnessScore01);

  return Object.freeze({
    valid: truncatedViolations.filter((v) => v.severity === 'ERROR').length === 0,
    grade,
    violations: Object.freeze(truncatedViolations),
    scalarDensity01,
    evidenceScore01,
    freshnessScore01,
  });
}

// ============================================================================
// MARK: Feature ingestor
// ============================================================================

export class ChatFeatureIngestor {
  private readonly logger: ChatFeatureIngestorLoggerPort;
  private readonly clock: ChatFeatureIngestorClockPort;
  private readonly hash: ChatFeatureIngestorHashPort;
  private readonly defaults: typeof CHAT_FEATURE_INGESTOR_DEFAULTS;
  private readonly runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
  private readonly sessionStart: UnixMs;

  private totalIngested = 0;
  private totalRowsEmitted = 0;
  private totalWarnings = 0;
  private totalErrors = 0;
  private lastIngestedAt: Nullable<UnixMs> = null;

  // Rolling window for drift detection
  private readonly driftWindow: Map<string, number[]> = new Map();

  public constructor(options: ChatFeatureIngestorOptions = {}) {
    this.logger = options.logger ?? DEFAULT_LOGGER;
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.hash = options.hash ?? DEFAULT_HASH;
    this.defaults = Object.freeze({
      ...CHAT_FEATURE_INGESTOR_DEFAULTS,
      ...(options.defaults ?? {}),
    });
    this.runtime = mergeRuntimeConfig(options.runtimeOverride ?? {});
    this.sessionStart = this.clock.now();
  }

  public ingestTransaction(transaction: ChatEngineTransaction): ChatFeatureIngestResult {
    const now = this.clock.now();
    const state = transaction.state;
    const roomId = transaction.event.roomId;
    const sessionId = transaction.event.sessionId;
    const userId = transaction.event.userId;
    const room = roomId ? state.rooms[roomId] ?? null : null;
    const session = sessionId ? state.sessions[sessionId] ?? null : null;
    const learningProfile = userId ? state.learningProfiles[userId] ?? null : null;
    const transcriptWindow = selectTranscriptWindow(state, roomId, now, this.defaults);
    const audienceHeat = roomId ? state.audienceHeatByRoom[roomId] ?? null : null;
    const invasions = roomId
      ? Object.values(state.activeInvasions).filter((invasion) => invasion.roomId === roomId)
      : [];
    const signal = selectSignal(transaction.event);
    const activeChannel = normalizeChannel(
      inferSourceChannel(transaction.event, room),
      room?.activeVisibleChannel ?? 'GLOBAL',
    );

    const affect = computeAffect(
      learningProfile,
      transcriptWindow.map((entry) => entry.message),
      audienceHeat,
      signal,
    );

    const context: ChatFeatureContext = Object.freeze({
      now,
      state,
      event: transaction.event,
      transaction,
      room,
      session,
      learningProfile,
      activeChannel,
      transcriptWindow,
      anchoredMessages: selectAnchoredMessages(transaction),
      audienceHeat,
      invasions,
      signal,
      affect,
      pressureTier: derivePressureTier(signal),
      tickTier: deriveTickTier(signal),
      contributorCount: contributorCount(transaction),
    });

    const window = buildWindowSummary(context, this.defaults);
    const canonicalSnapshot = buildCanonicalSnapshot(context, window);
    const scalarFeatures = buildScalarFeatures(context, window, canonicalSnapshot, this.defaults);
    const categoricalFeatures = buildCategoricalFeatures(context, window);
    const tags = buildTags(context, window, canonicalSnapshot);
    const anchors = buildAnchorSet(transaction, roomId, sessionId, userId);
    const diagnostics: ChatFeatureDiagnostics = Object.freeze({
      pressureTier: context.pressureTier,
      tickTier: context.tickTier,
      activeVisibleChannel: context.activeChannel,
      roomKind: context.room?.roomKind ?? 'UNKNOWN',
      sourceEventKind: context.event.kind,
      sourceChannel: inferSourceChannel(context.event, context.room),
      contributorCount: context.contributorCount,
      ingestorVersion: CHAT_FEATURE_INGESTOR_VERSION,
    });

    const metadata: Readonly<Record<string, JsonValue>> = Object.freeze({
      transactionAccepted: transaction.accepted,
      transactionRejected: transaction.rejected,
      rejectionReasons: transaction.rejectionReasons,
      fanoutRooms: transaction.fanout.map((packet) => packet.roomId),
      runtimeLearningEnabled: this.runtime.learningPolicy.enabled,
      runtimeShadowChannelsEnabled: this.runtime.allowShadowChannels.length > 0,
    });

    const entities = deriveEntitySelections(context);
    const familyRows = this.defaults.deriveFamilyRows
      ? CHAT_MODEL_FAMILIES
      : (['ONLINE_CONTEXT'] as const);

    const rows: ChatFeatureRow[] = [];
    const seenSignatures = new Set<string>();

    for (const entity of entities) {
      for (const family of familyRows) {
        const baseRow = {
          rowId: this.hash.hash(`${transaction.event.eventId}:${entity.entityKey}:${family}:${now}`),
          generatedAt: now,
          family,
          roomId: entity.roomId,
          sessionId: entity.sessionId,
          userId: entity.userId,
          entityKey: entity.entityKey,
          entityKind: entity.entityKind,
          channelId: context.activeChannel,
          anchors,
          window,
          canonicalSnapshot,
          scalarFeatures: filterScalarFeaturesByFamily(scalarFeatures, family),
          categoricalFeatures,
          tags,
          diagnostics,
          metadata,
        } as const;

        const signature = buildRowSignature(baseRow, this.hash);

        if (this.defaults.signatureDeduplication && seenSignatures.has(signature)) {
          continue;
        }
        seenSignatures.add(signature);

        const row: ChatFeatureRow = Object.freeze({ ...baseRow, signature });
        rows.push(row);

        if (this.defaults.driftDetectionEnabled) {
          this.updateDriftWindow(row);
        }
      }
    }

    if (!rows.length) {
      this.logger.warn('ChatFeatureIngestor emitted no rows for accepted transaction.', {
        eventId: transaction.event.eventId,
        accepted: transaction.accepted,
        roomId: roomId ?? null,
        sessionId: sessionId ?? null,
      });
      this.totalWarnings += 1;
    }

    this.totalIngested += 1;
    this.totalRowsEmitted += rows.length;
    this.lastIngestedAt = now;

    return Object.freeze({
      generatedAt: now,
      acceptedEventId: transaction.event.eventId,
      roomId,
      sessionId,
      userId,
      rows: Object.freeze(rows),
      canonicalSnapshot,
      tags,
    });
  }

  public batchIngest(transactions: readonly ChatEngineTransaction[]): ChatFeatureBatchResult {
    const startAt = this.clock.now();
    const results: ChatFeatureIngestResult[] = [];
    let totalRows = 0;
    let discarded = 0;
    let deduped = 0;
    const seenSignatures = new Set<string>();
    const allRows: ChatFeatureRow[] = [];
    const cap = this.defaults.batchCapRows;

    for (const transaction of transactions) {
      const result = this.ingestTransaction(transaction);
      results.push(result);

      for (const row of result.rows) {
        if (totalRows >= cap) {
          discarded += 1;
          continue;
        }
        if (this.defaults.signatureDeduplication && seenSignatures.has(row.signature)) {
          deduped += 1;
          continue;
        }
        seenSignatures.add(row.signature);
        allRows.push(row);
        totalRows += 1;
      }
    }

    if (discarded > 0) {
      this.logger.warn('ChatFeatureIngestor batch discarded rows over cap.', {
        cap,
        discarded,
        total: totalRows + discarded,
      });
    }

    return Object.freeze({
      generatedAt: this.clock.now(),
      totalTransactions: transactions.length,
      totalRowsEmitted: totalRows,
      discardedRowsOverCap: discarded,
      deduplicatedRows: deduped,
      results: Object.freeze(results),
      allRows: Object.freeze(allRows),
      durationMs: Math.max(0, (this.clock.now() as number) - (startAt as number)),
    });
  }

  public validateRow(row: ChatFeatureRow): ChatFeatureRowValidationResult {
    return validateChatFeatureRowInternal(
      row,
      this.clock.now(),
      this.defaults.transcriptWindowMs,
      this.defaults.maxQualityViolations,
    );
  }

  public buildQualityReport(rows: readonly ChatFeatureRow[]): ChatFeatureQualityReport {
    const now = this.clock.now();
    const grades: Record<ChatFeatureQualityGrade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const scalarDensities: number[] = [];
    const evidenceScores: number[] = [];
    const freshnessScores: number[] = [];
    const violationCounts = new Map<ChatFeatureRowViolationKind, number>();
    const familyCoverage: Record<ChatModelFamily, number> = {
      ONLINE_CONTEXT: 0, ENGAGEMENT: 0, HATER_TARGETING: 0, HELPER_TIMING: 0,
      CHANNEL_AFFINITY: 0, TOXICITY: 0, CHURN: 0, INTERVENTION_POLICY: 0,
    };
    const entityKindCoverage: Record<string, number> = {};

    for (const row of rows) {
      const result = validateChatFeatureRowInternal(row, now, this.defaults.transcriptWindowMs, this.defaults.maxQualityViolations);
      grades[result.grade] = (grades[result.grade] ?? 0) + 1;
      scalarDensities.push(result.scalarDensity01);
      evidenceScores.push(result.evidenceScore01);
      freshnessScores.push(result.freshnessScore01);
      for (const v of result.violations) {
        violationCounts.set(v.kind, (violationCounts.get(v.kind) ?? 0) + 1);
      }
      if (row.family in familyCoverage) {
        familyCoverage[row.family] = (familyCoverage[row.family] ?? 0) + 1;
      }
      entityKindCoverage[row.entityKind] = (entityKindCoverage[row.entityKind] ?? 0) + 1;
    }

    const topViolationKinds = [...violationCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([kind]) => kind);

    return Object.freeze({
      generatedAt: now,
      totalRows: rows.length,
      gradeCounts: Object.freeze(grades),
      averageScalarDensity01: mean(scalarDensities),
      averageEvidenceScore01: mean(evidenceScores),
      averageFreshnessScore01: mean(freshnessScores),
      topViolationKinds: Object.freeze(topViolationKinds),
      familyCoverage: Object.freeze(familyCoverage),
      entityKindCoverage: Object.freeze(entityKindCoverage),
    });
  }

  public buildDriftReport(): ChatFeatureDriftReport {
    const now = this.clock.now();
    const windowSize = this.defaults.driftWindowRows;
    const sigma = this.defaults.driftSigmaThreshold;
    const drifted: ChatFeatureDriftEntry[] = [];
    let stableCount = 0;
    let totalSigma = 0;
    let maxSigmaValue = 0;

    for (const [key, values] of this.driftWindow.entries()) {
      if (values.length < 4) continue;
      const half = Math.floor(values.length / 2);
      const reference = values.slice(0, half);
      const current = values.slice(half);
      const refMean = mean(reference);
      const curMean = mean(current);
      const refStd = stddev(reference);
      const sigmaValue = refStd > 0 ? Math.abs(curMean - refMean) / refStd : 0;
      totalSigma += sigmaValue;
      maxSigmaValue = Math.max(maxSigmaValue, sigmaValue);

      if (sigmaValue >= sigma) {
        drifted.push(Object.freeze({
          key,
          currentMean: curMean,
          referenceMean: refMean,
          sigma: sigmaValue,
          relativeDrift01: clamp01(Math.abs(curMean - refMean) / Math.max(refMean, 0.001)),
          direction: curMean > refMean ? 'UP' : curMean < refMean ? 'DOWN' : 'STABLE',
        }));
      } else {
        stableCount += 1;
      }
    }

    const meanDrift = this.driftWindow.size > 0 ? totalSigma / this.driftWindow.size : 0;
    const alertLevel: ChatFeatureDriftReport['alertLevel'] =
      maxSigmaValue >= sigma * 1.8 ? 'CRITICAL' :
        maxSigmaValue >= sigma * 1.2 ? 'ALERT' :
          maxSigmaValue >= sigma ? 'WATCH' : 'OK';

    return Object.freeze({
      generatedAt: now,
      windowSize,
      driftedFeatures: Object.freeze(drifted.sort((a, b) => b.sigma - a.sigma)),
      stableFeaturesCount: stableCount,
      driftedFeaturesCount: drifted.length,
      meanDriftSigma: meanDrift,
      maxDriftSigma: maxSigmaValue,
      alertLevel,
    });
  }

  public getStats(): ChatFeatureIngestorStats {
    return Object.freeze({
      totalIngested: this.totalIngested,
      totalRowsEmitted: this.totalRowsEmitted,
      totalWarnings: this.totalWarnings,
      totalErrors: this.totalErrors,
      lastIngestedAt: this.lastIngestedAt,
      sessionStart: this.sessionStart,
    });
  }

  public resetStats(): void {
    this.totalIngested = 0;
    this.totalRowsEmitted = 0;
    this.totalWarnings = 0;
    this.totalErrors = 0;
    this.lastIngestedAt = null;
    this.driftWindow.clear();
  }

  private updateDriftWindow(row: ChatFeatureRow): void {
    const windowSize = this.defaults.driftWindowRows;
    for (const [key, value] of Object.entries(row.scalarFeatures)) {
      if (!Number.isFinite(value)) continue;
      const series = this.driftWindow.get(key) ?? [];
      series.push(value);
      if (series.length > windowSize) series.shift();
      this.driftWindow.set(key, series);
    }
  }
}

// ============================================================================
// MARK: Public helpers
// ============================================================================

export function createChatFeatureIngestor(
  options: ChatFeatureIngestorOptions = {},
): ChatFeatureIngestor {
  return new ChatFeatureIngestor(options);
}

export function ingestChatFeatures(
  transaction: ChatEngineTransaction,
  options: ChatFeatureIngestorOptions = {},
): ChatFeatureIngestResult {
  return createChatFeatureIngestor(options).ingestTransaction(transaction);
}

export function ingestChatFeaturesBatch(
  transactions: readonly ChatEngineTransaction[],
  options: ChatFeatureIngestorOptions = {},
): ChatFeatureBatchResult {
  return createChatFeatureIngestor(options).batchIngest(transactions);
}

export function validateChatFeatureRow(
  row: ChatFeatureRow,
  nowMs?: number,
): ChatFeatureRowValidationResult {
  const now = asUnixMs(nowMs ?? Date.now());
  return validateChatFeatureRowInternal(
    row,
    now,
    CHAT_FEATURE_INGESTOR_DEFAULTS.transcriptWindowMs,
    CHAT_FEATURE_INGESTOR_DEFAULTS.maxQualityViolations,
  );
}

export function buildChatFeatureQualityReport(
  rows: readonly ChatFeatureRow[],
  options: ChatFeatureIngestorOptions = {},
): ChatFeatureQualityReport {
  return createChatFeatureIngestor(options).buildQualityReport(rows);
}

export function chatFeatureRowDigest(row: ChatFeatureRow): string {
  return `[${row.family}:${row.entityKind}:${row.entityKey.slice(0, 16)}]@${(row.generatedAt as number)}:sig=${row.signature}`;
}

export function deriveChatFeatureRowContext(row: ChatFeatureRow): Readonly<{
  isRoomScoped: boolean;
  isUserScoped: boolean;
  isSessionScoped: boolean;
  isCrossEntity: boolean;
  channelKind: ChatVisibleChannel;
  pressureTier: PressureTier;
  hasCanonicalSnapshot: boolean;
  scalarFeatureCount: number;
  tagCount: number;
}> {
  return Object.freeze({
    isRoomScoped: !!row.roomId,
    isUserScoped: !!row.userId,
    isSessionScoped: !!row.sessionId,
    isCrossEntity: row.entityKind === 'ROOM_USER' || row.entityKind === 'SESSION_USER',
    channelKind: row.channelId,
    pressureTier: row.diagnostics.pressureTier,
    hasCanonicalSnapshot: !!row.canonicalSnapshot,
    scalarFeatureCount: Object.keys(row.scalarFeatures).length,
    tagCount: row.tags.length,
  });
}

export function chatFeatureModelFamilyPrefix(family: ChatModelFamily): readonly string[] {
  const prefixMap: Readonly<Record<ChatModelFamily, readonly string[]>> = Object.freeze({
    ONLINE_CONTEXT: ['event', 'room', 'pressure', 'tick', 'battle', 'run'],
    ENGAGEMENT: ['recent', 'response', 'roomHeat', 'confidence', 'attachment'],
    HATER_TARGETING: ['hostileMomentum', 'hater', 'toxicity', 'intimidation'],
    HELPER_TIMING: ['helper', 'rescue', 'silence', 'confidence', 'frustration'],
    CHANNEL_AFFINITY: ['affinity', 'switch', 'economy', 'multiplayer'],
    TOXICITY: ['toxicity', 'hostileMomentum', 'hater', 'frustration'],
    CHURN: ['churn', 'silence', 'helperIgnore', 'frustration'],
    INTERVENTION_POLICY: ['churn', 'helper', 'hater', 'rescue'],
  });
  return prefixMap[family];
}

export function chatFeatureRowHasTag(row: ChatFeatureRow, tag: string): boolean {
  return row.tags.includes(tag);
}

export function chatFeatureRowsForFamily(
  rows: readonly ChatFeatureRow[],
  family: ChatModelFamily,
): readonly ChatFeatureRow[] {
  return rows.filter((r) => r.family === family);
}

export function chatFeatureRowsForEntity(
  rows: readonly ChatFeatureRow[],
  entityKey: string,
): readonly ChatFeatureRow[] {
  return rows.filter((r) => r.entityKey === entityKey);
}

export function chatFeatureRowAgeMs(row: ChatFeatureRow, nowMs?: number): number {
  const now = nowMs ?? Date.now();
  return Math.max(0, now - (row.generatedAt as number));
}

export function chatFeatureScalarDensity01(row: ChatFeatureRow): number {
  const count = Object.keys(row.scalarFeatures).length;
  return clamp01(count / (CHAT_FEATURE_INGESTOR_DEFAULTS.maxScalarFeatures * 0.60));
}

export function chatFeatureRowSummaryLine(row: ChatFeatureRow): string {
  return [
    `family=${row.family}`,
    `entity=${row.entityKind}`,
    `channel=${row.channelId}`,
    `pressure=${row.diagnostics.pressureTier}`,
    `scalars=${Object.keys(row.scalarFeatures).length}`,
    `tags=${row.tags.length}`,
    `sig=${row.signature}`,
  ].join(' | ');
}

export const CHAT_FEATURE_INGESTOR_NAMESPACE = Object.freeze({
  moduleName: CHAT_FEATURE_INGESTOR_MODULE_NAME,
  version: CHAT_FEATURE_INGESTOR_VERSION,
  runtimeLaws: CHAT_FEATURE_INGESTOR_RUNTIME_LAWS,
  defaults: CHAT_FEATURE_INGESTOR_DEFAULTS,
  modelFamilies: CHAT_MODEL_FAMILIES,
  create: createChatFeatureIngestor,
  ingest: ingestChatFeatures,
  ingestBatch: ingestChatFeaturesBatch,
  validateRow: validateChatFeatureRow,
  buildQualityReport: buildChatFeatureQualityReport,
  rowDigest: chatFeatureRowDigest,
  rowContext: deriveChatFeatureRowContext,
  familyPrefixes: chatFeatureModelFamilyPrefix,
  rowHasTag: chatFeatureRowHasTag,
  rowsForFamily: chatFeatureRowsForFamily,
  rowsForEntity: chatFeatureRowsForEntity,
  rowAgeMs: chatFeatureRowAgeMs,
  scalarDensity01: chatFeatureScalarDensity01,
  rowSummaryLine: chatFeatureRowSummaryLine,
} as const);

export default ChatFeatureIngestor;
