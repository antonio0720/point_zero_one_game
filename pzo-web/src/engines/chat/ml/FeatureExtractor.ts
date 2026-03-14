
// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/ml/FeatureExtractor.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ML FEATURE EXTRACTOR
 * FILE: pzo-web/src/engines/chat/intelligence/ml/FeatureExtractor.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Production-grade feature extraction surface for the unified chat intelligence
 * lane.
 *
 * This module replaces the bridge fallback snapshot with a deeper, explicit,
 * bounded, mode-aware extraction pipeline that preserves the repo doctrine:
 *
 * - frontend extracts immediately,
 * - backend remains transcript / moderation / durable learning authority,
 * - features are rich enough for ML now and DL later,
 * - no generic "chat app" assumptions flatten PZO pressure / tick / rescue /
 *   crowd / hater / helper semantics,
 * - extraction is deterministic, replay-friendly, and safe during partial
 *   migration.
 *
 * This file intentionally does more than map fields.
 * It:
 * - normalizes event-local and rolling session signals,
 * - derives affect, pressure, and drop-off surfaces,
 * - preserves visible-channel behavior,
 * - computes bounded secondary features for helper / hater / negotiation /
 *   crowd lanes,
 * - attaches engine-aware hints for future backend learning,
 * - stays compile-safe against evolving contract files by writing defensively.
 *
 * Permanent doctrine
 * ------------------
 * - Feature extraction must not require final transcript truth.
 * - Frontend extraction may be rich, but it is always advisory.
 * - Every feature should either help immediate UI timing or future learning.
 * - No single noisy event should dominate a snapshot.
 * - Silence, hesitation, rescue pressure, and social exposure are first-class.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type {
  ChatLearningBridgeFeatureExtractionInput,
  ChatLearningBridgeFeatureExtractorPort,
  ChatLearningBridgeHeuristicSignals,
} from '../ChatLearningBridge';

import {
  CHAT_LEARNING_BRIDGE_CHANNEL_KEYS,
  CHAT_LEARNING_BRIDGE_DEFAULTS,
} from '../ChatLearningBridge';

import {
  computeChatColdStartHeuristics,
  createChatColdStartProfile,
  createChatColdStartRecommendation,
} from '../ChatColdStartProfile';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatFeatureSnapshot,
  ChatVisibleChannel,
  JsonObject,
  JsonValue,
  Score01,
  UnixMs,
} from '../types';

/* ========================================================================== */
/* MARK: Public module constants                                              */
/* ========================================================================== */

export const CHAT_FEATURE_EXTRACTOR_MODULE_NAME =
  'PZO_CHAT_FEATURE_EXTRACTOR' as const;

export const CHAT_FEATURE_EXTRACTOR_VERSION =
  '2026.03.13-feature-extractor.v1' as const;

export const CHAT_FEATURE_EXTRACTOR_RUNTIME_LAWS = Object.freeze([
  'Extraction is deterministic for identical input.',
  'Feature richness may increase, but core scalar semantics must remain stable.',
  'Silence, hesitation, recovery pressure, and crowd exposure are first-class.',
  'Visible-channel affinity must remain explicit in the snapshot.',
  'Cold-start priors may inform the snapshot, but they do not override live behavior.',
  'No extraction path may require transcript text to be present.',
  'All arrays and histories remain bounded at the bridge before extraction.',
  'The output must be safe to embed in telemetry, queueing, replay, and future training.',
] as const);

export const CHAT_FEATURE_EXTRACTOR_DEFAULTS = Object.freeze({
  responseFastMs: 1_800,
  responseSlowMs: 12_000,
  typingCommittedMs: 3_000,
  draftCommittedChars: 160,
  draftLongChars: 220,
  silenceConcernMs: 12_000,
  silenceCriticalMs: 30_000,
  dwellMeaningfulMs: 18_000,
  rescueFailureThreshold: 0.66,
  helperEscalationThreshold: 0.58,
  haterEscalationThreshold: 0.61,
  maxPayloadScalarKeys: 24,
  maxPayloadCategoricalKeys: 24,
  maxTags: 48,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatPressureTier =
  | 'CALM'
  | 'BUILDING'
  | 'ELEVATED'
  | 'HIGH'
  | 'CRITICAL';

export type ChatTickTier =
  | 'SOVEREIGN'
  | 'STABLE'
  | 'COMPRESSED'
  | 'CRISIS'
  | 'COLLAPSE_IMMINENT';

export interface ChatFeatureExtractorOptions {
  readonly now?: () => number;
  readonly defaults?: Partial<typeof CHAT_FEATURE_EXTRACTOR_DEFAULTS>;
  readonly includePayloadEcho?: boolean;
  readonly includeColdStartHints?: boolean;
  readonly includeDerivedTags?: boolean;
  readonly mountTargetHints?: Readonly<Record<string, Partial<ChatMountTargetHint>>>;
}

export interface ChatMountTargetHint {
  readonly channelBias?: ChatVisibleChannel;
  readonly pressureBias?: number;
  readonly crowdBias?: number;
  readonly lowerPressureBias?: boolean;
}

export interface ChatScalarFeatureSet {
  readonly messageVelocity01: Score01;
  readonly engagement01: Score01;
  readonly dropOffRisk01: Score01;
  readonly helperNeed01: Score01;
  readonly haterTolerance01: Score01;
  readonly shameSensitivity01: Score01;
  readonly confidence01: Score01;
  readonly rescueNeed01: Score01;

  readonly quietness01: Score01;
  readonly responseUrgency01: Score01;
  readonly composerCommitment01: Score01;
  readonly switchIntensity01: Score01;
  readonly socialExposure01: Score01;
  readonly helperPresence01: Score01;
  readonly haterPresence01: Score01;
  readonly negotiationGuard01: Score01;
  readonly recoveryPressure01: Score01;
  readonly legendMomentum01: Score01;
  readonly replayInterest01: Score01;
  readonly queuePressure01: Score01;
  readonly failurePressure01: Score01;
  readonly mountPressure01: Score01;
}

export interface ChatChannelFeatureSet {
  readonly activeChannel: ChatVisibleChannel;
  readonly preferredChannel: ChatVisibleChannel;
  readonly channelViewShare01: Readonly<Record<ChatVisibleChannel, Score01>>;
  readonly channelOutboundShare01: Readonly<Record<ChatVisibleChannel, Score01>>;
  readonly channelInboundShare01: Readonly<Record<ChatVisibleChannel, Score01>>;
  readonly channelDwellShare01: Readonly<Record<ChatVisibleChannel, Score01>>;
  readonly channelSwitchShare01: Readonly<Record<ChatVisibleChannel, Score01>>;
}

export interface ChatSocialFeatureSet {
  readonly audienceHeat01: Score01;
  readonly crowdStress01: Score01;
  readonly embarrassmentRisk01: Score01;
  readonly publicStagePressure01: Score01;
  readonly intimacy01: Score01;
  readonly negotiationExposure01: Score01;
  readonly socialRecoveryNeed01: Score01;
}

export interface ChatMessageFeatureSet {
  readonly avgTypingDurationMs: number;
  readonly avgResponseDelayMs: number;
  readonly avgDraftLength: number;
  readonly estimatedDraftCommitment01: Score01;
  readonly estimatedResponsePace01: Score01;
  readonly estimatedOutboundIntent01: Score01;
  readonly estimatedInboundPressure01: Score01;
}

export interface ChatDropOffFeatureSet {
  readonly silenceAfterCollapseMs: number;
  readonly repeatedComposerDeletes: number;
  readonly panelCollapseCount: number;
  readonly channelHopCount: number;
  readonly failedInputCount: number;
  readonly negativeEmotionScore: number;
  readonly quietness01: Score01;
  readonly churnPressure01: Score01;
}

export interface ChatDerivedFeatureDiagnostics {
  readonly moduleName: typeof CHAT_FEATURE_EXTRACTOR_MODULE_NAME;
  readonly moduleVersion: typeof CHAT_FEATURE_EXTRACTOR_VERSION;
  readonly eventFamily: string;
  readonly pressureTier: ChatPressureTier;
  readonly tickTier: ChatTickTier;
  readonly payloadScalarKeys: readonly string[];
  readonly payloadCategoricalKeys: readonly string[];
  readonly derivedTags: readonly string[];
  readonly coldStartExplanation?: string;
  readonly recommendationExplanation?: string;
}

/* ========================================================================== */
/* MARK: Utility helpers                                                      */
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
  if (!Number.isFinite(value)) {
    return Date.now() as UnixMs;
  }

  return Math.max(0, Math.floor(value)) as UnixMs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function average(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0);
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function safeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function lerp01(current: number, next: number, alpha: number): number {
  return clamp01(current + (next - current) * clamp01(alpha));
}

function max0(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function ratio(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return clamp01(part / whole);
}

function normalizeVisibleChannel(
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

function createChannelNumberMap(seed = 0): Record<ChatVisibleChannel, number> {
  return CHAT_LEARNING_BRIDGE_CHANNEL_KEYS.reduce((acc, channelId) => {
    acc[channelId] = seed;
    return acc;
  }, {} as Record<ChatVisibleChannel, number>);
}

function createChannelScoreMap(
  seed = 0,
): Record<ChatVisibleChannel, Score01> {
  return CHAT_LEARNING_BRIDGE_CHANNEL_KEYS.reduce((acc, channelId) => {
    acc[channelId] = asScore01(seed);
    return acc;
  }, {} as Record<ChatVisibleChannel, Score01>);
}

function normalizeCountMap(
  value: unknown,
): Record<ChatVisibleChannel, number> {
  const record = isRecord(value) ? value : {};
  const next = createChannelNumberMap(0);

  for (const channelId of CHAT_LEARNING_BRIDGE_CHANNEL_KEYS) {
    next[channelId] = max0(safeNumber(record[channelId], 0));
  }

  return next;
}

function normalizeShareMap(
  counts: Record<ChatVisibleChannel, number>,
): Record<ChatVisibleChannel, Score01> {
  const total = sum(Object.values(counts));
  const shares = createChannelScoreMap(0);

  for (const channelId of CHAT_LEARNING_BRIDGE_CHANNEL_KEYS) {
    shares[channelId] = asScore01(ratio(counts[channelId], total));
  }

  return shares;
}

function pickStringArray(input: readonly string[], limit: number): readonly string[] {
  if (input.length <= limit) return Object.freeze([...input]);
  return Object.freeze([...input.slice(0, limit)]);
}

function eventFamilyOf(eventName: string): string {
  if (eventName.includes('message')) return 'MESSAGE';
  if (eventName.includes('typing')) return 'COMPOSER';
  if (eventName.includes('channel')) return 'CHANNEL';
  if (eventName.includes('replay')) return 'REPLAY';
  if (eventName.includes('legend')) return 'LEGEND';
  if (eventName.includes('rescue')) return 'RECOVERY';
  if (eventName.includes('affect')) return 'AFFECT';
  if (eventName.includes('heat')) return 'AUDIENCE';
  if (eventName.includes('npc')) return 'NPC';
  if (eventName.includes('open') || eventName.includes('close')) return 'SESSION';
  return 'GENERAL';
}

function derivePressureTierFromSignals(
  input: ChatLearningBridgeFeatureExtractionInput,
  heuristics: ChatLearningBridgeHeuristicSignals,
  crowdStress01: number,
  payload: JsonObject,
): ChatPressureTier {
  const explicit =
    safeString((payload as Record<string, unknown>).pressureTier).toUpperCase();

  switch (explicit) {
    case 'CALM':
    case 'BUILDING':
    case 'ELEVATED':
    case 'HIGH':
    case 'CRITICAL':
      return explicit as ChatPressureTier;
    default:
      break;
  }

  const score = clamp01(
    heuristics.dropOffRisk01 * 0.22 +
      heuristics.helperNeed01 * 0.14 +
      crowdStress01 * 0.18 +
      scoreFromFailures(input) * 0.18 +
      scoreFromHaters(input) * 0.14 +
      scoreFromQuietness(input) * 0.14,
  );

  if (score >= 0.84) return 'CRITICAL';
  if (score >= 0.64) return 'HIGH';
  if (score >= 0.44) return 'ELEVATED';
  if (score >= 0.22) return 'BUILDING';
  return 'CALM';
}

function deriveTickTierFromSignals(
  input: ChatLearningBridgeFeatureExtractionInput,
  heuristics: ChatLearningBridgeHeuristicSignals,
  payload: JsonObject,
): ChatTickTier {
  const explicit = safeString((payload as Record<string, unknown>).tickTier).toUpperCase();

  switch (explicit) {
    case 'SOVEREIGN':
    case 'STABLE':
    case 'COMPRESSED':
    case 'CRISIS':
    case 'COLLAPSE_IMMINENT':
      return explicit as ChatTickTier;
    default:
      break;
  }

  const score = clamp01(
    heuristics.confidence01 * -0.20 +
      heuristics.dropOffRisk01 * 0.28 +
      heuristics.rescueNeed01 * 0.18 +
      scoreFromFailures(input) * 0.16 +
      scoreFromQueue(input) * 0.10 +
      scoreFromQuietness(input) * 0.10 +
      scoreFromLegend(input) * -0.12,
  );

  if (score >= 0.82) return 'COLLAPSE_IMMINENT';
  if (score >= 0.62) return 'CRISIS';
  if (score >= 0.38) return 'COMPRESSED';
  if (score >= 0.18) return 'STABLE';
  return 'SOVEREIGN';
}

function scoreFromQuietness(input: ChatLearningBridgeFeatureExtractionInput): number {
  const session = input.session as unknown as Record<string, unknown>;
  const now = safeNumber(input.occurredAtMs, Date.now());
  const anchor =
    safeNumber(session.lastInboundAtMs, 0) ||
    safeNumber(session.lastOutboundAtMs, 0) ||
    safeNumber(session.openedAtMs, 0) ||
    now;

  const elapsed = Math.max(0, now - anchor);
  return clamp01(elapsed / CHAT_LEARNING_BRIDGE_DEFAULTS.disengagementWindowMs);
}

function scoreFromFailures(input: ChatLearningBridgeFeatureExtractionInput): number {
  const session = input.session as unknown as Record<string, unknown>;
  return clamp01(safeNumber(session.failureCount, 0) / 6);
}

function scoreFromHaters(input: ChatLearningBridgeFeatureExtractionInput): number {
  const session = input.session as unknown as Record<string, unknown>;
  return clamp01(safeNumber(session.haterCount, 0) / 10);
}

function scoreFromHelpers(input: ChatLearningBridgeFeatureExtractionInput): number {
  const session = input.session as unknown as Record<string, unknown>;
  return clamp01(safeNumber(session.helperCount, 0) / 10);
}

function scoreFromLegend(input: ChatLearningBridgeFeatureExtractionInput): number {
  const session = input.session as unknown as Record<string, unknown>;
  return clamp01(safeNumber(session.legendCount, 0) / 4);
}

function scoreFromReplay(input: ChatLearningBridgeFeatureExtractionInput): number {
  const session = input.session as unknown as Record<string, unknown>;
  return clamp01(safeNumber(session.replayOpenCount, 0) / 6);
}

function scoreFromQueue(input: ChatLearningBridgeFeatureExtractionInput): number {
  const session = input.session as unknown as Record<string, unknown>;
  const queue = Array.isArray(session.queue) ? session.queue.length : 0;
  return clamp01(queue / 16);
}

function extractMountTarget(input: ChatLearningBridgeFeatureExtractionInput): string {
  const session = input.session as unknown as Record<string, unknown>;
  return safeString(session.mountTarget, '');
}

function extractRollingArray(
  sessionValue: unknown,
): number[] {
  if (!Array.isArray(sessionValue)) return [];
  return sessionValue
    .map((item) => safeNumber(item, 0))
    .filter((item) => Number.isFinite(item) && item >= 0);
}

function derivePayloadScalarKeys(
  payload: JsonObject,
  limit: number,
): readonly string[] {
  const keys = Object.keys(payload).filter((key) => {
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === 'number' || typeof value === 'boolean';
  });

  return pickStringArray(keys.sort(), limit);
}

function derivePayloadCategoricalKeys(
  payload: JsonObject,
  limit: number,
): readonly string[] {
  const keys = Object.keys(payload).filter((key) => {
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === 'string';
  });

  return pickStringArray(keys.sort(), limit);
}

function deriveDerivedTags(
  eventName: string,
  activeChannel: ChatVisibleChannel,
  pressureTier: ChatPressureTier,
  tickTier: ChatTickTier,
  heuristics: ChatLearningBridgeHeuristicSignals,
): readonly string[] {
  const tags = new Set<string>();

  tags.add(`event:${eventName}`);
  tags.add(`family:${eventFamilyOf(eventName).toLowerCase()}`);
  tags.add(`channel:${activeChannel.toLowerCase()}`);
  tags.add(`pressure:${pressureTier.toLowerCase()}`);
  tags.add(`tick:${tickTier.toLowerCase()}`);

  if (heuristics.dropOffRisk01 >= 0.66) tags.add('risk:dropoff-high');
  else if (heuristics.dropOffRisk01 >= 0.42) tags.add('risk:dropoff-rising');

  if (heuristics.helperNeed01 >= 0.60) tags.add('helper:urgent');
  else if (heuristics.helperNeed01 >= 0.40) tags.add('helper:watch');

  if (heuristics.haterTolerance01 >= 0.60) tags.add('hater:tolerant');
  if (heuristics.shameSensitivity01 >= 0.60) tags.add('crowd:shame-sensitive');
  if (heuristics.confidence01 >= 0.66) tags.add('confidence:strong');
  if (heuristics.rescueNeed01 >= 0.66) tags.add('recovery:needed');

  return pickStringArray([...tags], CHAT_FEATURE_EXTRACTOR_DEFAULTS.maxTags);
}

function buildAffectVector(
  heuristics: ChatLearningBridgeHeuristicSignals,
  helperPresence01: number,
  haterPresence01: number,
  crowdStress01: number,
  quietness01: number,
): Record<string, number> {
  const intimidation = clamp01(
    heuristics.dropOffRisk01 * 0.30 +
      heuristics.shameSensitivity01 * 0.22 +
      haterPresence01 * 0.20 +
      crowdStress01 * 0.18 +
      quietness01 * 0.10,
  );

  const confidence = clamp01(
    heuristics.confidence01 * 0.48 +
      heuristics.engagement01 * 0.18 +
      helperPresence01 * 0.10 +
      clamp01(1 - heuristics.dropOffRisk01) * 0.24,
  );

  const frustration = clamp01(
    heuristics.dropOffRisk01 * 0.28 +
      crowdStress01 * 0.14 +
      quietness01 * 0.16 +
      clamp01(1 - confidence) * 0.10 +
      haterPresence01 * 0.18 +
      scoreDelta(helperPresence01, haterPresence01) * 0.14,
  );

  const curiosity = clamp01(
    heuristics.engagement01 * 0.28 +
      heuristics.typingCommitment01 * 0.18 +
      clamp01(1 - quietness01) * 0.16 +
      clamp01(1 - heuristics.dropOffRisk01) * 0.22 +
      helperPresence01 * 0.16,
  );

  const attachment = clamp01(
    helperPresence01 * 0.34 +
      heuristics.helperNeed01 * 0.16 +
      heuristics.engagement01 * 0.22 +
      clamp01(1 - heuristics.dropOffRisk01) * 0.12 +
      clamp01(1 - haterPresence01) * 0.16,
  );

  const embarrassment = clamp01(
    heuristics.shameSensitivity01 * 0.42 +
      crowdStress01 * 0.24 +
      haterPresence01 * 0.16 +
      clamp01(1 - confidence) * 0.18,
  );

  const relief = clamp01(
    helperPresence01 * 0.32 +
      clamp01(1 - heuristics.dropOffRisk01) * 0.28 +
      confidence * 0.14 +
      clamp01(1 - crowdStress01) * 0.12 +
      clamp01(1 - haterPresence01) * 0.14,
  );

  const dominance = clamp01(
    heuristics.haterTolerance01 * 0.24 +
      confidence * 0.30 +
      clamp01(1 - heuristics.shameSensitivity01) * 0.18 +
      heuristics.engagement01 * 0.14 +
      scoreDelta(haterPresence01, helperPresence01) * 0.14,
  );

  const desperation = clamp01(
    heuristics.rescueNeed01 * 0.28 +
      heuristics.dropOffRisk01 * 0.20 +
      quietness01 * 0.14 +
      crowdStress01 * 0.14 +
      clamp01(1 - confidence) * 0.24,
  );

  const trust = clamp01(
    helperPresence01 * 0.28 +
      clamp01(1 - crowdStress01) * 0.12 +
      confidence * 0.14 +
      clamp01(1 - heuristics.dropOffRisk01) * 0.16 +
      attachment * 0.30,
  );

  return {
    intimidation: Math.round(intimidation * 100),
    confidence: Math.round(confidence * 100),
    frustration: Math.round(frustration * 100),
    curiosity: Math.round(curiosity * 100),
    attachment: Math.round(attachment * 100),
    embarrassment: Math.round(embarrassment * 100),
    relief: Math.round(relief * 100),
    dominance: Math.round(dominance * 100),
    desperation: Math.round(desperation * 100),
    trust: Math.round(trust * 100),
  };
}

function scoreDelta(primary: number, secondary: number): number {
  return clamp01(Math.max(0, primary - secondary));
}

function buildAffectSnapshot(
  heuristics: ChatLearningBridgeHeuristicSignals,
  helperPresence01: number,
  haterPresence01: number,
  crowdStress01: number,
  quietness01: number,
): ChatAffectSnapshot {
  const vector = buildAffectVector(
    heuristics,
    helperPresence01,
    haterPresence01,
    crowdStress01,
    quietness01,
  );

  const intensity01 = asScore01(
    clamp01(
      vector.intimidation / 100 * 0.18 +
        vector.frustration / 100 * 0.18 +
        vector.embarrassment / 100 * 0.10 +
        vector.desperation / 100 * 0.16 +
        vector.confidence / 100 * 0.08 +
        vector.curiosity / 100 * 0.08 +
        vector.attachment / 100 * 0.06 +
        vector.relief / 100 * 0.04 +
        vector.dominance / 100 * 0.06 +
        vector.trust / 100 * 0.06,
    ),
  );

  return Object.freeze({
    vector,
    intensity01,
  } as unknown as ChatAffectSnapshot);
}

function buildAudienceHeat(
  activeChannel: ChatVisibleChannel,
  socialExposure01: number,
  crowdStress01: number,
  embarrassmentRisk01: number,
  publicStagePressure01: number,
): ChatAudienceHeat {
  const heat01 = asScore01(
    clamp01(
      socialExposure01 * 0.28 +
        crowdStress01 * 0.28 +
        embarrassmentRisk01 * 0.22 +
        publicStagePressure01 * 0.22,
    ),
  );

  return Object.freeze({
    channelId: activeChannel,
    heat01,
    intensity01: heat01,
    score01: heat01,
    publicStagePressure01,
    crowdStress01,
  } as unknown as ChatAudienceHeat);
}

function normalizeDropOffSignals(
  raw: Record<string, unknown>,
): ChatDropOffFeatureSet {
  const silenceAfterCollapseMs = max0(
    safeNumber(
      raw.silenceAfterCollapseMs,
      safeNumber(raw.silenceWindowMs, 0),
    ),
  );

  const repeatedComposerDeletes = Math.max(
    0,
    Math.floor(safeNumber(raw.repeatedComposerDeletes, 0)),
  );

  const panelCollapseCount = Math.max(
    0,
    Math.floor(safeNumber(raw.panelCollapseCount, 0)),
  );

  const channelHopCount = Math.max(
    0,
    Math.floor(safeNumber(raw.channelHopCount, 0)),
  );

  const failedInputCount = Math.max(
    0,
    Math.floor(safeNumber(raw.failedInputCount, 0)),
  );

  const negativeEmotionScore = Math.max(
    0,
    Math.min(100, safeNumber(raw.negativeEmotionScore, 0)),
  );

  const quietness01 = asScore01(
    clamp01(silenceAfterCollapseMs / CHAT_FEATURE_EXTRACTOR_DEFAULTS.silenceCriticalMs),
  );

  const churnPressure01 = asScore01(
    clamp01(
      quietness01 * 0.24 +
        clamp01(repeatedComposerDeletes / 8) * 0.18 +
        clamp01(panelCollapseCount / 6) * 0.16 +
        clamp01(channelHopCount / 10) * 0.14 +
        clamp01(failedInputCount / 5) * 0.18 +
        clamp01(negativeEmotionScore / 100) * 0.10,
    ),
  );

  return Object.freeze({
    silenceAfterCollapseMs,
    repeatedComposerDeletes,
    panelCollapseCount,
    channelHopCount,
    failedInputCount,
    negativeEmotionScore,
    quietness01,
    churnPressure01,
  });
}

function deriveMountTargetPressure(
  mountTarget: string,
  activeChannel: ChatVisibleChannel,
  hints?: Readonly<Record<string, Partial<ChatMountTargetHint>>>,
): number {
  const normalized = mountTarget.trim().toUpperCase();
  const hinted = normalized && hints?.[normalized] ? hints[normalized] : null;

  if (hinted && typeof hinted.pressureBias === 'number') {
    return clamp01(hinted.pressureBias);
  }

  if (normalized.includes('BATTLE')) return 0.88;
  if (normalized.includes('PREDATOR')) return 0.84;
  if (normalized.includes('PHANTOM')) return 0.80;
  if (normalized.includes('EMPIRE')) return 0.72;
  if (normalized.includes('SYNDICATE')) return 0.68;
  if (normalized.includes('LEAGUE')) return 0.54;
  if (normalized.includes('CLUB')) return 0.42;
  if (normalized.includes('BOARD')) return 0.38;
  if (normalized.includes('LOBBY')) return activeChannel === 'LOBBY' ? 0.16 : 0.22;
  return activeChannel === 'DEAL_ROOM' ? 0.44 : 0.32;
}

function derivePublicStagePressure(
  activeChannel: ChatVisibleChannel,
  mountPressure01: number,
  crowdStress01: number,
): number {
  switch (activeChannel) {
    case 'GLOBAL':
      return clamp01(0.50 + mountPressure01 * 0.20 + crowdStress01 * 0.30);
    case 'SYNDICATE':
      return clamp01(0.34 + mountPressure01 * 0.20 + crowdStress01 * 0.18);
    case 'DEAL_ROOM':
      return clamp01(0.28 + mountPressure01 * 0.24 + crowdStress01 * 0.12);
    case 'LOBBY':
      return clamp01(0.18 + mountPressure01 * 0.12 + crowdStress01 * 0.10);
    default:
      return clamp01(0.24 + mountPressure01 * 0.14 + crowdStress01 * 0.14);
  }
}

function deriveIntimacy01(activeChannel: ChatVisibleChannel): number {
  switch (activeChannel) {
    case 'SYNDICATE':
      return 0.72;
    case 'DEAL_ROOM':
      return 0.66;
    case 'LOBBY':
      return 0.58;
    case 'GLOBAL':
    default:
      return 0.24;
  }
}

function deriveNegotiationExposure(activeChannel: ChatVisibleChannel): number {
  switch (activeChannel) {
    case 'DEAL_ROOM':
      return 0.88;
    case 'SYNDICATE':
      return 0.34;
    case 'GLOBAL':
      return 0.18;
    case 'LOBBY':
    default:
      return 0.08;
  }
}

function patchPayloadEcho(
  payload: JsonObject,
  includePayloadEcho: boolean,
): JsonObject | undefined {
  if (!includePayloadEcho) return undefined;
  return Object.freeze({ ...(payload as Record<string, JsonValue>) }) as JsonObject;
}

function buildColdStartContext(
  input: ChatLearningBridgeFeatureExtractionInput,
  affect: ChatAffectSnapshot,
  dropOffSignals: ChatDropOffFeatureSet,
  pressureTier: ChatPressureTier,
  tickTier: ChatTickTier,
): {
  coldStartExplanation?: string;
  recommendationExplanation?: string;
  recommendationChannel?: ChatVisibleChannel;
} {
  const featureSnapshot = Object.freeze({
    activeChannel: input.activeChannel,
    eventName: input.eventName,
    affect,
    dropOffSignals: {
      silenceAfterCollapseMs: dropOffSignals.silenceAfterCollapseMs,
      repeatedComposerDeletes: dropOffSignals.repeatedComposerDeletes,
      panelCollapseCount: dropOffSignals.panelCollapseCount,
      channelHopCount: dropOffSignals.channelHopCount,
      failedInputCount: dropOffSignals.failedInputCount,
      negativeEmotionScore: dropOffSignals.negativeEmotionScore,
    },
    pressureTier,
    tickTier,
    haterHeat: Math.round(input.heuristicSignals.crowdStress01 * 100),
  } as unknown as ChatFeatureSnapshot);

  const coldStart = createChatColdStartProfile({
    now: input.occurredAtMs,
    playerId: safeString((input.profile as unknown as Record<string, unknown>).userId),
    activeChannel: input.activeChannel,
    featureSnapshot,
  });

  const recommendation = createChatColdStartRecommendation(coldStart, {
    now: input.occurredAtMs,
    activeChannel: input.activeChannel,
    featureSnapshot,
    affectSnapshot: affect,
    dropOffSignals: featureSnapshot.dropOffSignals,
  });

  const coldHeuristics = computeChatColdStartHeuristics({
    now: input.occurredAtMs,
    activeChannel: input.activeChannel,
    featureSnapshot,
    affectSnapshot: affect,
    dropOffSignals: featureSnapshot.dropOffSignals,
  });

  return {
    coldStartExplanation: [
      `helper:${coldStart.helperFrequencyBias.toFixed(2)}`,
      `hater:${coldStart.haterAggressionBias.toFixed(2)}`,
      `guard:${coldStart.negotiationRiskBias.toFixed(2)}`,
      `crowd:${coldStart.crowdHeatTolerance.toFixed(2)}`,
      `quiet:${coldHeuristics.quietRisk01.toFixed(2)}`,
      `friction:${coldHeuristics.frustrationPressure01.toFixed(2)}`,
      coldStart.prefersLowerPressureOpenings ? 'opening:low-pressure' : 'opening:adaptive',
    ].join(' | '),
    recommendationExplanation: recommendation.explanation,
    recommendationChannel: recommendation.openingChannel,
  };
}

/* ========================================================================== */
/* MARK: Feature extractor implementation                                     */
/* ========================================================================== */

export class ChatFeatureExtractor
  implements ChatLearningBridgeFeatureExtractorPort
{
  private readonly now: () => number;
  private readonly options: Required<
    Pick<
      ChatFeatureExtractorOptions,
      'includePayloadEcho' | 'includeColdStartHints' | 'includeDerivedTags'
    >
  > &
    Omit<
      ChatFeatureExtractorOptions,
      'includePayloadEcho' | 'includeColdStartHints' | 'includeDerivedTags'
    >;
  private readonly defaults: typeof CHAT_FEATURE_EXTRACTOR_DEFAULTS;

  constructor(options: ChatFeatureExtractorOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.defaults = {
      ...CHAT_FEATURE_EXTRACTOR_DEFAULTS,
      ...(options.defaults ?? {}),
    };

    this.options = {
      ...options,
      includePayloadEcho: options.includePayloadEcho ?? true,
      includeColdStartHints: options.includeColdStartHints ?? true,
      includeDerivedTags: options.includeDerivedTags ?? true,
    };
  }

  public extract(
    input: ChatLearningBridgeFeatureExtractionInput,
  ): ChatFeatureSnapshot {
    const occurredAtMs = asUnixMs(input.occurredAtMs);
    const payload = isRecord(input.payload)
      ? (input.payload as JsonObject)
      : ({} as JsonObject);

    const session = input.session as unknown as Record<string, unknown>;
    const profile = input.profile as unknown as Record<string, unknown>;
    const activeChannel = normalizeVisibleChannel(
      input.activeChannel,
      normalizeVisibleChannel(profile.preferredChannel, 'GLOBAL'),
    );

    const channelViews = normalizeCountMap(session.channelViews);
    const outboundByChannel = normalizeCountMap(session.outboundByChannel);
    const inboundByChannel = normalizeCountMap(session.inboundByChannel);
    const channelDwellsMs = normalizeCountMap(session.channelDwellsMs);
    const channelSwitches = normalizeCountMap(session.channelSwitches);

    const avgTypingDurationMs = average(
      extractRollingArray(session.rollingTypingDurationsMs),
    );
    const avgResponseDelayMs = average(
      extractRollingArray(session.rollingResponseDelaysMs),
    );
    const avgDraftLength = average(extractRollingArray(session.rollingDraftLengths));
    const avgAffect = average(extractRollingArray(session.rollingAffectIntensity));
    const avgHeat = average(extractRollingArray(session.rollingAudienceHeat));

    const quietness01 = asScore01(scoreFromQuietness(input));
    const helperPresence01 = asScore01(
      clamp01(
        scoreFromHelpers(input) * 0.56 +
          ratio(
            safeNumber(session.helperContactsByChannel?.[activeChannel], 0),
            Math.max(1, safeNumber(session.inboundByChannel?.[activeChannel], 0)),
          ) *
            0.24 +
          input.heuristicSignals.helperNeed01 * 0.20,
      ),
    );

    const haterPresence01 = asScore01(
      clamp01(
        scoreFromHaters(input) * 0.56 +
          ratio(
            safeNumber(session.haterContactsByChannel?.[activeChannel], 0),
            Math.max(1, safeNumber(session.inboundByChannel?.[activeChannel], 0)),
          ) *
            0.26 +
          input.heuristicSignals.shameSensitivity01 * 0.18,
      ),
    );

    const mountTarget = extractMountTarget(input);
    const mountPressure01 = asScore01(
      deriveMountTargetPressure(
        mountTarget,
        activeChannel,
        this.options.mountTargetHints,
      ),
    );

    const socialExposure01 = asScore01(
      clamp01(
        normalizeShareMap(channelViews)[activeChannel] * 0.26 +
          normalizeShareMap(outboundByChannel)[activeChannel] * 0.14 +
          normalizeShareMap(inboundByChannel)[activeChannel] * 0.14 +
          mountPressure01 * 0.16 +
          input.heuristicSignals.shameSensitivity01 * 0.14 +
          avgHeat * 0.16,
      ),
    );

    const negotiationExposure01 = asScore01(
      clamp01(
        deriveNegotiationExposure(activeChannel) * 0.54 +
          input.heuristicSignals.dealRoomAffinity01 * 0.20 +
          normalizeShareMap(outboundByChannel).DEAL_ROOM * 0.12 +
          normalizeShareMap(inboundByChannel).DEAL_ROOM * 0.14,
      ),
    );

    const responseUrgency01 = asScore01(
      clamp01(
        input.heuristicSignals.dropOffRisk01 * 0.28 +
          quietness01 * 0.18 +
          haterPresence01 * 0.16 +
          helperPresence01 * -0.10 +
          clamp01(avgResponseDelayMs / this.defaults.responseSlowMs) * 0.24 +
          mountPressure01 * 0.12 +
          Math.max(0, negotiationExposure01 - 0.3) * 0.12,
      ),
    );

    const composerCommitment01 = asScore01(
      clamp01(
        input.heuristicSignals.typingCommitment01 * 0.42 +
          clamp01(avgTypingDurationMs / this.defaults.typingCommittedMs) * 0.20 +
          clamp01(avgDraftLength / this.defaults.draftCommittedChars) * 0.24 +
          clamp01(1 - quietness01) * 0.14,
      ),
    );

    const switchIntensity01 = asScore01(
      clamp01(
        normalizeShareMap(channelSwitches)[activeChannel] * 0.50 +
          normalizeShareMap(channelViews)[activeChannel] * 0.22 +
          clamp01(sum(Object.values(channelSwitches)) / 10) * 0.28,
      ),
    );

    const queuePressure01 = asScore01(scoreFromQueue(input));
    const failurePressure01 = asScore01(scoreFromFailures(input));
    const replayInterest01 = asScore01(scoreFromReplay(input));
    const legendMomentum01 = asScore01(
      clamp01(
        scoreFromLegend(input) * 0.50 +
          input.heuristicSignals.confidence01 * 0.18 +
          input.heuristicSignals.engagement01 * 0.18 +
          clamp01(1 - input.heuristicSignals.dropOffRisk01) * 0.14,
      ),
    );

    const crowdStress01 = asScore01(
      clamp01(
        input.heuristicSignals.crowdStress01 * 0.54 +
          avgHeat * 0.18 +
          haterPresence01 * 0.14 +
          normalizeShareMap(inboundByChannel).GLOBAL * 0.14,
      ),
    );

    const publicStagePressure01 = asScore01(
      derivePublicStagePressure(activeChannel, mountPressure01, crowdStress01),
    );

    const embarrassmentRisk01 = asScore01(
      clamp01(
        input.heuristicSignals.shameSensitivity01 * 0.44 +
          crowdStress01 * 0.18 +
          haterPresence01 * 0.18 +
          publicStagePressure01 * 0.12 +
          clamp01(1 - input.heuristicSignals.confidence01) * 0.08,
      ),
    );

    const socialRecoveryNeed01 = asScore01(
      clamp01(
        input.heuristicSignals.rescueNeed01 * 0.34 +
          embarrassmentRisk01 * 0.20 +
          input.heuristicSignals.dropOffRisk01 * 0.20 +
          helperPresence01 * -0.08 +
          quietness01 * 0.14 +
          negotiationExposure01 * 0.20,
      ),
    );

    const pressureTier = derivePressureTierFromSignals(
      input,
      input.heuristicSignals,
      crowdStress01,
      payload,
    );

    const tickTier = deriveTickTierFromSignals(
      input,
      input.heuristicSignals,
      payload,
    );

    const dropOffSignals = normalizeDropOffSignals({
      silenceAfterCollapseMs:
        Math.max(0, safeNumber(payload.silenceAfterCollapseMs, 0)) ||
        Math.round(
          quietness01 *
            (pressureTier === 'CRITICAL'
              ? this.defaults.silenceCriticalMs
              : this.defaults.silenceConcernMs),
        ),
      repeatedComposerDeletes: safeNumber(
        payload.repeatedComposerDeletes,
        0,
      ),
      panelCollapseCount: safeNumber(
        payload.panelCollapseCount,
        input.eventName === 'chat_closed' ? 1 : 0,
      ),
      channelHopCount: safeNumber(
        payload.channelHopCount,
        Math.round(sum(Object.values(channelSwitches))),
      ),
      failedInputCount: safeNumber(
        payload.failedInputCount,
        safeNumber(session.failureCount, 0),
      ),
      negativeEmotionScore: Math.round(
        clamp01(
          input.heuristicSignals.dropOffRisk01 * 0.34 +
            input.heuristicSignals.shameSensitivity01 * 0.22 +
            crowdStress01 * 0.18 +
            avgAffect * 0.26,
        ) * 100,
      ),
      silenceWindowMs: Math.round(quietness01 * this.defaults.silenceCriticalMs),
    });

    const affect = buildAffectSnapshot(
      input.heuristicSignals,
      helperPresence01,
      haterPresence01,
      crowdStress01,
      quietness01,
    );

    const audienceHeat = buildAudienceHeat(
      activeChannel,
      socialExposure01,
      crowdStress01,
      embarrassmentRisk01,
      publicStagePressure01,
    );

    const coldStartHints = this.options.includeColdStartHints
      ? buildColdStartContext(input, affect, dropOffSignals, pressureTier, tickTier)
      : null;

    const scalarFeatures: ChatScalarFeatureSet = Object.freeze({
      messageVelocity01: asScore01(
        clamp01(
          ratio(
            safeNumber(session.inboundCount, 0) + safeNumber(session.outboundCount, 0),
            24,
          ),
        ),
      ),
      engagement01: asScore01(input.heuristicSignals.engagement01),
      dropOffRisk01: asScore01(input.heuristicSignals.dropOffRisk01),
      helperNeed01: asScore01(input.heuristicSignals.helperNeed01),
      haterTolerance01: asScore01(input.heuristicSignals.haterTolerance01),
      shameSensitivity01: asScore01(input.heuristicSignals.shameSensitivity01),
      confidence01: asScore01(input.heuristicSignals.confidence01),
      rescueNeed01: asScore01(input.heuristicSignals.rescueNeed01),
      quietness01,
      responseUrgency01,
      composerCommitment01,
      switchIntensity01,
      socialExposure01,
      helperPresence01,
      haterPresence01,
      negotiationGuard01: asScore01(
        clamp01(
          negotiationExposure01 * 0.32 +
            input.heuristicSignals.dropOffRisk01 * 0.22 +
            input.heuristicSignals.rescueNeed01 * 0.12 +
            crowdStress01 * 0.10 +
            quietness01 * 0.12 +
            failurePressure01 * 0.12,
        ),
      ),
      recoveryPressure01: asScore01(
        clamp01(
          socialRecoveryNeed01 * 0.44 +
            dropOffSignals.churnPressure01 * 0.26 +
            input.heuristicSignals.rescueNeed01 * 0.18 +
            quietness01 * 0.12,
        ),
      ),
      legendMomentum01,
      replayInterest01,
      queuePressure01,
      failurePressure01,
      mountPressure01,
    });

    const channelFeatures: ChatChannelFeatureSet = Object.freeze({
      activeChannel,
      preferredChannel: normalizeVisibleChannel(profile.preferredChannel, activeChannel),
      channelViewShare01: normalizeShareMap(channelViews),
      channelOutboundShare01: normalizeShareMap(outboundByChannel),
      channelInboundShare01: normalizeShareMap(inboundByChannel),
      channelDwellShare01: normalizeShareMap(channelDwellsMs),
      channelSwitchShare01: normalizeShareMap(channelSwitches),
    });

    const socialFeatures: ChatSocialFeatureSet = Object.freeze({
      audienceHeat01: audienceHeat.heat01 as Score01,
      crowdStress01,
      embarrassmentRisk01,
      publicStagePressure01,
      intimacy01: asScore01(deriveIntimacy01(activeChannel)),
      negotiationExposure01,
      socialRecoveryNeed01,
    });

    const messageFeatures: ChatMessageFeatureSet = Object.freeze({
      avgTypingDurationMs: Math.round(avgTypingDurationMs),
      avgResponseDelayMs: Math.round(avgResponseDelayMs),
      avgDraftLength: Math.round(avgDraftLength),
      estimatedDraftCommitment01: asScore01(
        clamp01(avgDraftLength / this.defaults.draftLongChars),
      ),
      estimatedResponsePace01: asScore01(
        clamp01(1 - clamp01(avgResponseDelayMs / this.defaults.responseSlowMs)),
      ),
      estimatedOutboundIntent01: asScore01(
        clamp01(
          composerCommitment01 * 0.52 +
            scalarFeatures.engagement01 * 0.20 +
            clamp01(channelFeatures.channelOutboundShare01[activeChannel]) * 0.14 +
            clamp01(1 - quietness01) * 0.14,
        ),
      ),
      estimatedInboundPressure01: asScore01(
        clamp01(
          haterPresence01 * 0.30 +
            socialFeatures.audienceHeat01 * 0.20 +
            scalarFeatures.responseUrgency01 * 0.18 +
            normalizeShareMap(inboundByChannel)[activeChannel] * 0.18 +
            failurePressure01 * 0.14,
        ),
      ),
    });

    const diagnostics: ChatDerivedFeatureDiagnostics = Object.freeze({
      moduleName: CHAT_FEATURE_EXTRACTOR_MODULE_NAME,
      moduleVersion: CHAT_FEATURE_EXTRACTOR_VERSION,
      eventFamily: eventFamilyOf(input.eventName),
      pressureTier,
      tickTier,
      payloadScalarKeys: derivePayloadScalarKeys(
        payload,
        this.defaults.maxPayloadScalarKeys,
      ),
      payloadCategoricalKeys: derivePayloadCategoricalKeys(
        payload,
        this.defaults.maxPayloadCategoricalKeys,
      ),
      derivedTags: this.options.includeDerivedTags
        ? deriveDerivedTags(
            input.eventName,
            activeChannel,
            pressureTier,
            tickTier,
            input.heuristicSignals,
          )
        : Object.freeze([]),
      coldStartExplanation: coldStartHints?.coldStartExplanation,
      recommendationExplanation: coldStartHints?.recommendationExplanation,
    });

    const featureSnapshot = Object.freeze({
      snapshotId: createFeatureId(
        input.eventName,
        activeChannel,
        occurredAtMs,
        this.now(),
      ),
      occurredAtMs,
      eventName: input.eventName,
      activeChannel,

      messageVelocity01: scalarFeatures.messageVelocity01,
      engagement01: scalarFeatures.engagement01,
      dropOffRisk01: scalarFeatures.dropOffRisk01,
      helperNeed01: scalarFeatures.helperNeed01,
      haterTolerance01: scalarFeatures.haterTolerance01,
      shameSensitivity01: scalarFeatures.shameSensitivity01,
      confidence01: scalarFeatures.confidence01,
      rescueNeed01: scalarFeatures.rescueNeed01,

      channelViews,
      outboundByChannel,
      inboundByChannel,

      avgTypingDurationMs: messageFeatures.avgTypingDurationMs,
      avgResponseDelayMs: messageFeatures.avgResponseDelayMs,
      avgDraftLength: messageFeatures.avgDraftLength,

      affectIntensity01: affect.intensity01,
      audienceHeat01: audienceHeat.heat01,

      panelOpen: safeBoolean(session.isOpen, false),
      composerLength: Math.round(messageFeatures.avgDraftLength),
      silenceWindowMs: Math.round(
        dropOffSignals.silenceAfterCollapseMs ||
          quietness01 * this.defaults.silenceCriticalMs,
      ),
      helperHeat: Math.round(helperPresence01 * 100),
      haterHeat: Math.round(haterPresence01 * 100),
      pressureTier,
      tickTier,

      affect,
      audienceHeat,
      dropOffSignals: {
        silenceAfterCollapseMs: dropOffSignals.silenceAfterCollapseMs,
        repeatedComposerDeletes: dropOffSignals.repeatedComposerDeletes,
        panelCollapseCount: dropOffSignals.panelCollapseCount,
        channelHopCount: dropOffSignals.channelHopCount,
        failedInputCount: dropOffSignals.failedInputCount,
        negativeEmotionScore: dropOffSignals.negativeEmotionScore,
      },

      scalarFeatures,
      channelFeatures,
      socialFeatures,
      messageFeatures,
      diagnostics,

      mountTarget: mountTarget || null,
      queueDepth: Array.isArray(session.queue) ? session.queue.length : 0,
      recommendationChannel: coldStartHints?.recommendationChannel ?? activeChannel,

      payload: patchPayloadEcho(payload, this.options.includePayloadEcho),
    } as unknown as ChatFeatureSnapshot);

    return featureSnapshot;
  }
}

/* ========================================================================== */
/* MARK: Public helpers                                                       */
/* ========================================================================== */

function createFeatureId(
  eventName: string,
  activeChannel: ChatVisibleChannel,
  occurredAtMs: UnixMs,
  now: number,
): string {
  return [
    'feature',
    eventName,
    activeChannel,
    Math.floor(occurredAtMs).toString(36),
    Math.floor(now).toString(36),
    Math.random().toString(36).slice(2, 8),
  ].join('_');
}

export function createChatFeatureExtractor(
  options: ChatFeatureExtractorOptions = {},
): ChatFeatureExtractor {
  return new ChatFeatureExtractor(options);
}

export function extractChatFeatureSnapshot(
  input: ChatLearningBridgeFeatureExtractionInput,
  options: ChatFeatureExtractorOptions = {},
): ChatFeatureSnapshot {
  return createChatFeatureExtractor(options).extract(input);
}

export function deriveChatFeaturePressureTier(
  input: ChatLearningBridgeFeatureExtractionInput,
): ChatPressureTier {
  return derivePressureTierFromSignals(
    input,
    input.heuristicSignals,
    input.heuristicSignals.crowdStress01,
    isRecord(input.payload) ? (input.payload as JsonObject) : ({} as JsonObject),
  );
}

export function deriveChatFeatureTickTier(
  input: ChatLearningBridgeFeatureExtractionInput,
): ChatTickTier {
  return deriveTickTierFromSignals(
    input,
    input.heuristicSignals,
    isRecord(input.payload) ? (input.payload as JsonObject) : ({} as JsonObject),
  );
}

export function summarizeChatFeatureSnapshot(
  snapshot: ChatFeatureSnapshot,
): string {
  const raw = snapshot as unknown as Record<string, unknown>;
  const diagnostics = isRecord(raw.diagnostics) ? raw.diagnostics : {};
  const pressureTier = safeString(diagnostics.pressureTier, 'UNKNOWN');
  const tickTier = safeString(diagnostics.tickTier, 'UNKNOWN');
  const activeChannel = normalizeVisibleChannel(raw.activeChannel, 'GLOBAL');
  const engagement01 = clamp01(safeNumber(raw.engagement01, 0));
  const dropOffRisk01 = clamp01(safeNumber(raw.dropOffRisk01, 0));
  const helperNeed01 = clamp01(safeNumber(raw.helperNeed01, 0));
  const haterTolerance01 = clamp01(safeNumber(raw.haterTolerance01, 0));

  return [
    `channel:${activeChannel}`,
    `pressure:${pressureTier}`,
    `tick:${tickTier}`,
    `engagement:${engagement01.toFixed(2)}`,
    `drop:${dropOffRisk01.toFixed(2)}`,
    `helper:${helperNeed01.toFixed(2)}`,
    `hater:${haterTolerance01.toFixed(2)}`,
  ].join(' | ');
}

export const CHAT_FEATURE_EXTRACTOR_NAMESPACE = Object.freeze({
  moduleName: CHAT_FEATURE_EXTRACTOR_MODULE_NAME,
  version: CHAT_FEATURE_EXTRACTOR_VERSION,
  runtimeLaws: CHAT_FEATURE_EXTRACTOR_RUNTIME_LAWS,
  defaults: CHAT_FEATURE_EXTRACTOR_DEFAULTS,
  create: createChatFeatureExtractor,
  extract: extractChatFeatureSnapshot,
  summarize: summarizeChatFeatureSnapshot,
  derivePressureTier: deriveChatFeaturePressureTier,
  deriveTickTier: deriveChatFeatureTickTier,
} as const);

export default ChatFeatureExtractor;
