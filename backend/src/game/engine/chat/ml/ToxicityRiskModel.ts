/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TOXICITY RISK MODEL
 * FILE: backend/src/game/engine/chat/ml/ToxicityRiskModel.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Explainable backend-authoritative toxicity and escalation scoring for the
 * chat intelligence lane.
 *
 * This file exists to answer a narrower question than moderation policy:
 *
 *   “Given already-ingested authoritative chat features, how dangerous is the
 *    current conversational posture, how likely is the scene to escalate, how
 *    wide is the blast radius, how much of the risk should stay shadow-routed,
 *    and what recommendation should be passed to moderation/orchestration?”
 *
 * Doctrine
 * --------
 * - This model does not mutate transcript truth.
 * - This model does not replace ChatModerationPolicy.
 * - This model does not directly suppress a message.
 * - This model does not become the final law of the room.
 * - This model does transform accepted backend feature truth into a deep,
 *   explainable, low-latency toxicity posture for downstream systems.
 *
 * Why this file is deep
 * ---------------------
 * Point Zero One chat is not a generic public-chat problem. The same sharp line
 * can mean radically different things depending on room, mode, pressure, and
 * current dramatic posture.
 *
 * Examples:
 * - In GLOBAL, crowd ridicule can create blast radius long before direct slurs.
 * - In DEAL_ROOM, a seemingly calm sequence can carry predatory coercion,
 *   manipulation, and psychological extraction without overt profanity.
 * - In SYNDICATE, tight-channel contempt can have low visibility but high trust
 *   damage and long memory consequences.
 * - In LOBBY, bursty trash talk may be theatrical yet still become pile-on risk
 *   when intimidation, fixation, and repetition align.
 * - In BATTLE-adjacent chat, pressure spikes can make brief hostility normal,
 *   but targeted humiliation under crowd heat must still be surfaced.
 *
 * That means toxicity is not just “bad-word count.” It is a composite of:
 * - hostility,
 * - escalation velocity,
 * - single-target fixation,
 * - pile-on exposure,
 * - manipulation,
 * - dehumanizing or humiliating tone,
 * - spam/repetition pressure,
 * - public blast radius,
 * - shadow hostility,
 * - helper-protected recoverability,
 * - and channel-specific expectations.
 *
 * This model therefore produces:
 * - toxicity risk,
 * - escalation risk,
 * - moderation sensitivity,
 * - shadow-route value,
 * - blast radius,
 * - de-escalation opportunity,
 * - and one recommendation surface for downstream backend systems.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatAffectSnapshot,
  type ChatFeatureSnapshot,
  type ChatLearningProfile,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatSessionId,
  type ChatSignalEnvelope,
  type ChatUserId,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type PressureTier,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';
import {
  DEFAULT_BACKEND_CHAT_RUNTIME,
  mergeRuntimeConfig,
} from '../ChatRuntimeConfig';
import {
  type ChatOnlineFeatureAggregate,
  type ChatOnlineFeatureStoreQuery,
  type ChatOnlineInferenceWindow,
  type OnlineFeatureStore,
  aggregateOnlineFeatureWindow,
} from './OnlineFeatureStore';
import {
  type ChatFeatureIngestResult,
  type ChatFeatureRow,
} from './FeatureIngestor';
import {
  type EngagementModelPriorState,
  type EngagementModelScore,
} from './EngagementModel';
import {
  type HaterTargetingPriorState,
  type HaterTargetingScore,
} from './HaterTargetingModel';
import {
  type HelperTimingPriorState,
  type HelperTimingScore,
} from './HelperTimingModel';
import {
  type ChannelAffinityPriorState,
  type ChannelAffinityScore,
} from './ChannelAffinityModel';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_TOXICITY_RISK_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_TOXICITY_RISK_MODEL' as const;

export const CHAT_TOXICITY_RISK_MODEL_VERSION =
  '2026.03.14-toxicity-risk-model.v1' as const;

export const CHAT_TOXICITY_RISK_MODEL_RUNTIME_LAWS = Object.freeze([
  'The model scores authoritative feature truth, not client guesses.',
  'Channel semantics matter: GLOBAL blast radius is not DEAL_ROOM coercion.',
  'Tactical confrontation is not automatically toxicity, but fixation and humiliation accelerate risk.',
  'Shadow hostility matters even when visible text is thin.',
  'Single-target pile-ons can outrank profanity as a moderation concern.',
  'Helper protection and de-escalation opportunities reduce recommendation severity but do not erase risk.',
  'Output remains advisory for moderation/orchestration; it never bypasses policy.',
  'Explainability is required for telemetry, replay, proof, and audit.',
] as const);

export const CHAT_TOXICITY_RISK_MODEL_DEFAULTS = Object.freeze({
  lowEvidenceFallback01: 0.24,
  baselineBlend01: 0.14,
  volatilityBlend01: 0.12,
  escalationBlend01: 0.18,
  shadowBlend01: 0.12,
  blastRadiusBlend01: 0.15,
  deEscalationBlend01: 0.08,
  reviewThreshold01: 0.56,
  quarantineThreshold01: 0.76,
  hardBlockThreshold01: 0.90,
  shadowRouteThreshold01: 0.48,
  rateLimitThreshold01: 0.52,
  publicBlastThreshold01: 0.58,
  criticalPileOnThreshold01: 0.74,
  dealRoomCoercionWeight01: 0.16,
  syndicateTrustBreachWeight01: 0.10,
  globalBlastBias01: 0.10,
  lobbyTheatricalDiscount01: 0.08,
  pressureIntentDiscount01: 0.06,
  maxExplanationFactors: 14,
  staleWindowMs: 120_000,
  freshnessFloorMs: 7_500,
  lowEvidenceRowCount: 2,
  highCapsThreshold01: 0.68,
  highThreatThreshold01: 0.62,
  highFixationThreshold01: 0.60,
  pileOnAmplifier01: 0.18,
  humiliationAmplifier01: 0.12,
  helperProtectionDiscount01: 0.10,
  negativeSwarmAmplifier01: 0.14,
  negotiationPredationAmplifier01: 0.14,
  deEscalationHelperBonus01: 0.10,
  silenceAfterProvocationWeight01: 0.08,
  switchStressWeight01: 0.06,
  // v2 additions — liveops amplifiers
  liveopsInvasionToxicityBonus01: 0.12,
  liveopsHaterRaidToxicityBonus01: 0.10,
  worldEventHeatToxicityBonus01: 0.08,
  invasionChaosHostilityBonus01: 0.10,
  invasionChaosBlastRadiusBonus01: 0.08,
  // v2 additions — channel-specific escalation boosts
  dealRoomCoercionEscalationBonus01: 0.12,
  syndicateWhisperHostilityBonus01: 0.08,
  humiliationPublicEscalationBonus01: 0.10,
  manipulationDealRoomEscalationBonus01: 0.10,
  pileOnCriticalAmplifier01: 0.16,
  crowdPileonPublicLeakBonus01: 0.10,
  toxicityHardFloorCritical01: 0.06,
  // v2 additions — prior state blending (prevents scoring whiplash)
  priorStateMaxAgeMs: 180_000,
  priorBlendToxicity01: 0.18,
  priorBlendEscalation01: 0.16,
  priorBlendShadowRoute01: 0.12,
  // v2 additions — trend / escalation ratchet
  trendWindowMin: 3,
  escalationRatchetThreshold01: 0.62,
  escalationRatchetBonus01: 0.10,
  // v2 additions — audit and observability
  auditTrailEnabled: false,
  batchScoreEmitStats: true,
} as const);

// ============================================================================
// MARK: Ports and options
// ============================================================================

export interface ToxicityRiskModelLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ToxicityRiskModelClockPort {
  now(): UnixMs;
}

export interface ToxicityRiskModelOptions {
  readonly logger?: ToxicityRiskModelLoggerPort;
  readonly clock?: ToxicityRiskModelClockPort;
  readonly defaults?: Partial<typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS>;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
}

export interface ToxicityRiskModelContext {
  readonly logger: ToxicityRiskModelLoggerPort;
  readonly clock: ToxicityRiskModelClockPort;
  readonly defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS;
  readonly runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
}

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type ToxicityBand =
  | 'MINIMAL'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL';

export type ToxicityRecommendation =
  | 'ALLOW'
  | 'WATCH'
  | 'DE_ESCALATE_CONTEXT'
  | 'SHADOW_ROUTE'
  | 'RATE_LIMIT_AND_WARN'
  | 'MODERATION_REVIEW'
  | 'QUARANTINE_RECOMMENDED'
  | 'HARD_BLOCK_RECOMMENDED';

export interface ToxicityContribution {
  readonly key: string;
  readonly signedDelta01: number;
  readonly reason: string;
}

export interface ToxicityRiskModelDiagnostics {
  readonly evidenceRows: number;
  readonly lowEvidence: boolean;
  readonly staleSignal: boolean;
  readonly roomKind: ChatRoomKind | 'UNKNOWN';
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly pressureTier: PressureTier;
  readonly featureFreshnessMs: number;
  readonly modelVersion: typeof CHAT_TOXICITY_RISK_MODEL_VERSION;
}

export interface ToxicityRiskModelInput {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly roomKind: ChatRoomKind | 'UNKNOWN';
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly pressureTier: PressureTier;
  readonly roomHeat01: Score01;
  readonly hostileMomentum01: Score01;
  readonly negativeSwarm01: Score01;
  readonly ridiculeExposure01: Score01;
  readonly intimidation01: Score01;
  readonly frustration01: Score01;
  readonly embarrassment01: Score01;
  readonly dominanceDisplay01: Score01;
  readonly profanityDensity01: Score01;
  readonly insultDensity01: Score01;
  readonly threatLanguage01: Score01;
  readonly repetitionPressure01: Score01;
  readonly spamVelocity01: Score01;
  readonly capsAggression01: Score01;
  readonly targetFixation01: Score01;
  readonly pileOnExposure01: Score01;
  readonly negotiationManipulation01: Score01;
  readonly shadowHostility01: Score01;
  readonly moderationHistory01: Score01;
  readonly suppressionHistory01: Score01;
  readonly helperProtection01: Score01;
  readonly deEscalationOpportunity01: Score01;
  readonly engagement01: Score01;
  readonly engagementFragility01: Score01;
  readonly haterTargeting01: Score01;
  readonly haterEscalation01: Score01;
  readonly helperUrgency01: Score01;
  readonly channelMisfit01: Score01;
  readonly bestChannelConfidence01: Score01;
  readonly visibilityExposure01: Score01;
  readonly recentPlayerShare01: Score01;
  readonly recentNpcShare01: Score01;
  readonly silenceAfterProvocation01: Score01;
  readonly switchStress01: Score01;
  readonly messageLengthVolatility01: Score01;
  readonly recentAcceptCount: number;
  readonly recentRejectCount: number;
  readonly evidenceRows: number;
  readonly freshnessMs: number;
  readonly featureSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly affectSnapshot: Nullable<ChatAffectSnapshot>;
  readonly learningProfile: Nullable<ChatLearningProfile>;
  readonly engagementScore: Nullable<EngagementModelScore>;
  readonly engagementPriorState: Nullable<EngagementModelPriorState>;
  readonly haterScore: Nullable<HaterTargetingScore>;
  readonly haterPriorState: Nullable<HaterTargetingPriorState>;
  readonly helperScore: Nullable<HelperTimingScore>;
  readonly helperPriorState: Nullable<HelperTimingPriorState>;
  readonly channelScore: Nullable<ChannelAffinityScore>;
  readonly channelPriorState: Nullable<ChannelAffinityPriorState>;
  readonly sourceSignals: readonly ChatSignalEnvelope[];
}

export type ToxicityTrendDirection =
  | 'ACCELERATING'
  | 'ESCALATING'
  | 'STABLE'
  | 'COOLING'
  | 'DECELERATING';

export interface ToxicityTrendSignal {
  readonly direction: ToxicityTrendDirection;
  readonly deltaPerWindow: number;
  readonly priorToxicity01: Score01;
  readonly currentToxicity01: Score01;
}

export interface ToxicityBatchStats {
  readonly count: number;
  readonly criticalCount: number;
  readonly blockCount: number;
  readonly shadowRouteCount: number;
  readonly quarantineCount: number;
  readonly reviewCount: number;
  readonly meanToxicity01: number;
  readonly maxToxicity01: number;
  readonly meanEscalation01: number;
  readonly meanBlastRadius01: number;
  readonly meanModerationSensitivity01: number;
}

export interface ToxicityAuditEntry {
  readonly timestamp: UnixMs;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly roomId: Nullable<ChatRoomId>;
  readonly band: ToxicityBand;
  readonly recommendation: ToxicityRecommendation;
  readonly toxicity01: Score01;
  readonly escalation01: Score01;
  readonly moderationSensitivity01: Score01;
  readonly shadowRoute01: Score01;
  readonly blastRadius01: Score01;
  readonly topFactor: string;
  readonly channel: ChatVisibleChannel;
}

export interface ToxicityHealthReport {
  readonly totalScoredLifetime: number;
  readonly totalCriticalCount: number;
  readonly totalBlockCount: number;
  readonly totalShadowRouteCount: number;
  readonly totalQuarantineCount: number;
  readonly totalReviewCount: number;
  readonly auditLogSize: number;
  readonly meanToxicity01: number;
  readonly maxToxicity01Lifetime: number;
  readonly meanEscalation01: number;
}

export interface ToxicityRiskScore {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly band: ToxicityBand;
  readonly recommendation: ToxicityRecommendation;
  readonly toxicity01: Score01;
  readonly escalation01: Score01;
  readonly moderationSensitivity01: Score01;
  readonly shadowRoute01: Score01;
  readonly blastRadius01: Score01;
  readonly deEscalationValue01: Score01;
  readonly confidence01: Score01;
  readonly toxicity100: Score100;
  readonly escalation100: Score100;
  readonly moderationSensitivity100: Score100;
  // v2 additions
  readonly liveopsBoost01: Score01;
  readonly escalationRatchet01: Score01;
  readonly pileOnAmplifiedRisk01: Score01;
  readonly trendDirection: ToxicityTrendDirection;
  readonly shouldIntercept: boolean;
  readonly isHighBlastPublic: boolean;
  // flags
  readonly shouldShadowRoute: boolean;
  readonly shouldRateLimit: boolean;
  readonly shouldReview: boolean;
  readonly shouldQuarantine: boolean;
  readonly shouldHardBlock: boolean;
  readonly explanation: readonly ToxicityContribution[];
  readonly diagnostics: ToxicityRiskModelDiagnostics;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ToxicityRiskBatchResult {
  readonly input: ToxicityRiskModelInput;
  readonly score: ToxicityRiskScore;
  readonly stats?: ToxicityBatchStats;
}

export interface ToxicityRiskPriorState {
  readonly toxicity01: Score01;
  readonly escalation01: Score01;
  readonly moderationSensitivity01: Score01;
  readonly shadowRoute01: Score01;
  readonly generatedAt: UnixMs;
}

// ============================================================================
// MARK: Internal defaults and helpers
// ============================================================================

const DEFAULT_LOGGER: ToxicityRiskModelLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLOCK: ToxicityRiskModelClockPort = {
  now: () => asUnixMs(Date.now()),
};

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampSigned01(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, next) => sum + next, 0) / values.length;
}

function maxOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((max, next) => Math.max(max, next), 0);
}

function minOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((min, next) => Math.min(min, next), 1);
}

function pickVisibleChannel(value: unknown): ChatVisibleChannel {
  if (typeof value !== 'string' || value.length === 0) {
    return 'GLOBAL' as ChatVisibleChannel;
  }
  return value as ChatVisibleChannel;
}

function pickRoomKind(value: unknown): ChatRoomKind | 'UNKNOWN' {
  if (typeof value !== 'string' || value.length === 0) {
    return 'UNKNOWN';
  }
  return value as ChatRoomKind;
}

function pickPressureTier(value: unknown): PressureTier {
  if (typeof value !== 'string' || value.length === 0) {
    return 'MEDIUM' as PressureTier;
  }
  return value as PressureTier;
}

function normalizeFreshness01(freshnessMs: number, defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  if (freshnessMs <= defaults.freshnessFloorMs) return clamp01(1);
  return clamp01(1 - freshnessMs / Math.max(defaults.staleWindowMs, 1));
}

function rowScalar(row: ChatFeatureRow | null | undefined, key: string, fallback = 0): number {
  if (!row) return fallback;
  return safeNumber(row.scalarFeatures?.[key], fallback);
}

function rowCategory(row: ChatFeatureRow | null | undefined, key: string, fallback = ''): string {
  if (!row) return fallback;
  const value = row.categoricalFeatures?.[key];
  return typeof value === 'string' ? value : fallback;
}

function aggregateScalar(aggregate: ChatOnlineFeatureAggregate | null | undefined, key: string, fallback = 0): number {
  if (!aggregate) return fallback;
  return safeNumber(aggregate.scalarFeatures?.[key], fallback);
}

function inferenceScalar(window: ChatOnlineInferenceWindow | null | undefined, key: string, fallback = 0): number {
  if (!window) return fallback;
  return safeNumber(window.scalarFeatures?.[key], fallback);
}

function uniqueSignals(signals: readonly ChatSignalEnvelope[]): readonly ChatSignalEnvelope[] {
  const seen = new Set<string>();
  const next: ChatSignalEnvelope[] = [];
  for (const signal of signals) {
    const id = JSON.stringify(signal ?? {});
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(signal);
  }
  return next;
}

function factor(key: string, signedDelta01: number, reason: string): ToxicityContribution {
  return {
    key,
    signedDelta01: clampSigned01(signedDelta01),
    reason,
  };
}

function evidencePenalty(evidenceRows: number, defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  if (evidenceRows >= defaults.lowEvidenceRowCount) return clamp01(0);
  return clamp01((defaults.lowEvidenceRowCount - evidenceRows) / Math.max(defaults.lowEvidenceRowCount, 1));
}

function roomBias(roomKind: ChatRoomKind | 'UNKNOWN', defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  switch (roomKind) {
    case 'DEAL_ROOM':
      return clamp01(defaults.dealRoomCoercionWeight01);
    case 'SYNDICATE':
      return clamp01(defaults.syndicateTrustBreachWeight01);
    case 'LOBBY':
      return clamp01(-defaults.lobbyTheatricalDiscount01);
    case 'GLOBAL':
      return clamp01(defaults.globalBlastBias01);
    default:
      return clamp01(0);
  }
}

function channelBlastBias(channel: ChatVisibleChannel, defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  switch (channel) {
    case 'GLOBAL':
      return clamp01(defaults.globalBlastBias01);
    case 'DEAL_ROOM':
      return clamp01(-0.02);
    case 'SYNDICATE':
      return clamp01(-0.01);
    case 'LOBBY':
      return clamp01(0.02);
    default:
      return clamp01(0);
  }
}

function channelShadowBias(channel: ChatVisibleChannel): Score01 {
  switch (channel) {
    case 'DEAL_ROOM':
      return clamp01(0.08);
    case 'SYNDICATE':
      return clamp01(0.05);
    case 'GLOBAL':
      return clamp01(-0.02);
    default:
      return clamp01(0);
  }
}

function pressureDiscount(pressureTier: PressureTier, defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  switch (pressureTier) {
    case 'CRITICAL':
      return clamp01(defaults.pressureIntentDiscount01);
    case 'HIGH':
      return clamp01(defaults.pressureIntentDiscount01 * 0.7);
    case 'ELEVATED':
      return clamp01(defaults.pressureIntentDiscount01 * 0.4);
    default:
      return clamp01(0);
  }
}

function normalizeCount01(value: number, denominator: number): Score01 {
  if (denominator <= 0) return clamp01(0);
  return clamp01(value / denominator);
}

function latestRowOfFamily(rows: readonly ChatFeatureRow[], family: string): ChatFeatureRow | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index]?.family === family) return rows[index];
  }
  return null;
}

function normalizeSilence(value: number): Score01 {
  return clamp01(value);
}

function buildScalarMap(rows: readonly ChatFeatureRow[]): Readonly<Record<string, number>> {
  const map: Record<string, number[]> = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.scalarFeatures ?? {})) {
      if (!Number.isFinite(value)) continue;
      if (!map[key]) map[key] = [];
      map[key].push(value);
    }
  }
  const next: Record<string, number> = {};
  for (const [key, values] of Object.entries(map)) {
    next[key] = average(values);
  }
  return next;
}

function deriveRecentAcceptCount(rows: readonly ChatFeatureRow[]): number {
  return rows.filter((row) => row.tags?.includes('accepted') || row.tags?.includes('message_accepted')).length;
}

function deriveRecentRejectCount(rows: readonly ChatFeatureRow[]): number {
  return rows.filter((row) => row.tags?.includes('rejected') || row.tags?.includes('moderation_rejected')).length;
}

function topTags(rows: readonly ChatFeatureRow[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of row.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key]) => key);
}

function featureSnapshotFromRows(rows: readonly ChatFeatureRow[]): Nullable<ChatFeatureSnapshot> {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const snapshot = rows[index]?.canonicalSnapshot;
    if (snapshot) return snapshot;
  }
  return null;
}

function channelBestScore(channelScore: Nullable<ChannelAffinityScore>): Score01 {
  if (!channelScore) return clamp01(0.5);
  const key = channelScore.recommendedPrimaryChannel;
  const fromRank = safeNumber(channelScore.scores?.[key], NaN);
  if (Number.isFinite(fromRank)) return clamp01(fromRank);
  return clamp01(channelScore.activeChannelFitness01);
}

function channelConfidence01(channelScore: Nullable<ChannelAffinityScore>): Score01 {
  if (!channelScore) return clamp01(0.5);
  return clamp01(safeNumber(channelScore.confidence01, 50) / 100);
}

function haterEscalationScore(haterScore: Nullable<HaterTargetingScore>): Score01 {
  if (!haterScore) return clamp01(0);
  return clamp01(
    haterScore.targeting01 * 0.38 +
      haterScore.publicLeak01 * 0.24 +
      haterScore.shadowPriming01 * 0.18 +
      (haterScore.shouldEscalate ? 0.20 : 0),
  );
}

function helperDeEscalationScore(helperScore: Nullable<HelperTimingScore>): Score01 {
  if (!helperScore) return clamp01(0);
  return clamp01(
    helperScore.rescueWindow01 * 0.42 +
      helperScore.softness01 * 0.18 +
      helperScore.teachingWindow01 * 0.10 +
      helperScore.witnessNeed01 * 0.08 +
      (helperScore.shouldQueuePrivatePrompt ? 0.12 : 0) +
      (helperScore.shouldInterveneNow ? 0.10 : 0),
  );
}

function affectSnapshotFromSignals(signals: readonly ChatSignalEnvelope[]): Nullable<ChatAffectSnapshot> {
  for (let index = signals.length - 1; index >= 0; index -= 1) {
    const signal = signals[index] as unknown as Record<string, unknown> | undefined;
    const maybe = signal?.affectSnapshot;
    if (maybe && typeof maybe === 'object') return maybe as ChatAffectSnapshot;
  }
  return null;
}

function learningProfileFromSignals(signals: readonly ChatSignalEnvelope[]): Nullable<ChatLearningProfile> {
  for (let index = signals.length - 1; index >= 0; index -= 1) {
    const signal = signals[index] as unknown as Record<string, unknown> | undefined;
    const maybe = signal?.learningProfile;
    if (maybe && typeof maybe === 'object') return maybe as ChatLearningProfile;
  }
  return null;
}

function deriveToxicityInputFromRows(params: {
  rows: readonly ChatFeatureRow[];
  generatedAt: UnixMs;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ToxicityRiskModelInput {
  const rows = params.rows ?? [];
  const latest = rows.at(-1) ?? null;
  const online = latestRowOfFamily(rows, 'ONLINE_CONTEXT');
  const engagement = latestRowOfFamily(rows, 'ENGAGEMENT');
  const hater = latestRowOfFamily(rows, 'HATER_TARGETING');
  const helper = latestRowOfFamily(rows, 'HELPER_TIMING');
  const channel = latestRowOfFamily(rows, 'CHANNEL_AFFINITY');
  const scalars = buildScalarMap(rows);
  const featureSnapshot = featureSnapshotFromRows(rows);
  const signals = uniqueSignals(params.signals ?? []);
  const affectSnapshot = affectSnapshotFromSignals(signals);
  const learningProfile = learningProfileFromSignals(signals);

  const roomId = latest?.roomId ?? null;
  const sessionId = latest?.sessionId ?? null;
  const userId = latest?.userId ?? null;
  const roomKind = pickRoomKind(
    rowCategory(online, 'roomKind', rowCategory(latest, 'roomKind', 'UNKNOWN')),
  );
  const activeVisibleChannel = pickVisibleChannel(
    rowCategory(online, 'activeVisibleChannel', latest?.channelId ?? 'GLOBAL'),
  );
  const pressureTier = pickPressureTier(
    rowCategory(online, 'pressureTier', 'MEDIUM'),
  );
  const freshnessMs = Math.max(0, safeNumber(params.generatedAt) - safeNumber(latest?.generatedAt, params.generatedAt));

  return {
    generatedAt: params.generatedAt,
    roomId,
    sessionId,
    userId,
    roomKind,
    activeVisibleChannel,
    pressureTier,
    roomHeat01: clamp01(scalars.roomHeat01 ?? aggregateScalar(null, 'roomHeat01')),
    hostileMomentum01: clamp01(scalars.hostileMomentum01 ?? rowScalar(hater, 'hostileMomentum01')),
    negativeSwarm01: clamp01(scalars.negativeSwarm01 ?? rowScalar(hater, 'negativeSwarm01')),
    ridiculeExposure01: clamp01(scalars.ridiculeExposure01 ?? rowScalar(online, 'ridiculeExposure01')),
    intimidation01: clamp01(scalars.intimidation01 ?? rowScalar(engagement, 'intimidation01')),
    frustration01: clamp01(scalars.frustration01 ?? rowScalar(engagement, 'frustration01')),
    embarrassment01: clamp01(scalars.embarrassment01 ?? rowScalar(engagement, 'embarrassment01')),
    dominanceDisplay01: clamp01(scalars.dominanceDisplay01 ?? rowScalar(hater, 'dominanceDisplay01')),
    profanityDensity01: clamp01(scalars.profanityDensity01 ?? rowScalar(online, 'profanityDensity01')),
    insultDensity01: clamp01(scalars.insultDensity01 ?? rowScalar(hater, 'insultDensity01')),
    threatLanguage01: clamp01(scalars.threatLanguage01 ?? rowScalar(hater, 'threatLanguage01')),
    repetitionPressure01: clamp01(scalars.repetitionPressure01 ?? rowScalar(online, 'repetitionPressure01')),
    spamVelocity01: clamp01(scalars.spamVelocity01 ?? rowScalar(online, 'spamVelocity01')),
    capsAggression01: clamp01(scalars.capsAggression01 ?? rowScalar(online, 'capsAggression01')),
    targetFixation01: clamp01(scalars.targetFixation01 ?? rowScalar(hater, 'targetFixation01')),
    pileOnExposure01: clamp01(scalars.pileOnExposure01 ?? rowScalar(hater, 'pileOnExposure01')),
    negotiationManipulation01: clamp01(scalars.negotiationManipulation01 ?? rowScalar(channel, 'dealRoomManipulation01')),
    shadowHostility01: clamp01(scalars.shadowHostility01 ?? rowScalar(hater, 'shadowHostility01')),
    moderationHistory01: clamp01(scalars.moderationHistory01 ?? rowScalar(online, 'moderationHistory01')),
    suppressionHistory01: clamp01(scalars.suppressionHistory01 ?? rowScalar(online, 'suppressionHistory01')),
    helperProtection01: clamp01((helperDeEscalationScore(params.helperScore) ?? rowScalar(helper, 'helperProtection01'))),
    deEscalationOpportunity01: clamp01((helperDeEscalationScore(params.helperScore) ?? rowScalar(helper, 'deEscalationOpportunity01'))),
    engagement01: clamp01(params.engagementScore?.engagement01 ?? rowScalar(engagement, 'engagement01')),
    engagementFragility01: clamp01(params.engagementScore?.fragility01 ?? params.engagementPriorState?.fragility01 ?? rowScalar(engagement, 'fragility01')),
    haterTargeting01: clamp01(params.haterScore?.targeting01 ?? rowScalar(hater, 'targeting01')),
    haterEscalation01: clamp01(haterEscalationScore(params.haterScore) ?? rowScalar(hater, 'escalation01')),
    helperUrgency01: clamp01(params.helperScore?.urgency01 ?? rowScalar(helper, 'urgency01')),
    channelMisfit01: clamp01(1 - channelBestScore(params.channelScore)),
    bestChannelConfidence01: clamp01(channelConfidence01(params.channelScore)),
    visibilityExposure01: clamp01(scalars.visibilityExposure01 ?? rowScalar(channel, 'visibilityExposure01')),
    recentPlayerShare01: clamp01(scalars.recentPlayerShare01 ?? rowScalar(engagement, 'recentPlayerShare01')),
    recentNpcShare01: clamp01(scalars.recentNpcShare01 ?? rowScalar(engagement, 'recentNpcShare01')),
    silenceAfterProvocation01: normalizeSilence(scalars.silenceAfterProvocation01 ?? rowScalar(online, 'silenceAfterProvocation01')),
    switchStress01: clamp01(scalars.switchStress01 ?? rowScalar(channel, 'switchStress01')),
    messageLengthVolatility01: clamp01(scalars.messageLengthVolatility01 ?? rowScalar(online, 'messageLengthVolatility01')),
    recentAcceptCount: deriveRecentAcceptCount(rows),
    recentRejectCount: deriveRecentRejectCount(rows),
    evidenceRows: rows.length,
    freshnessMs,
    featureSnapshot,
    affectSnapshot,
    learningProfile,
    engagementScore: params.engagementScore ?? null,
    engagementPriorState: params.engagementPriorState ?? null,
    haterScore: params.haterScore ?? null,
    haterPriorState: params.haterPriorState ?? null,
    helperScore: params.helperScore ?? null,
    helperPriorState: params.helperPriorState ?? null,
    channelScore: params.channelScore ?? null,
    channelPriorState: params.channelPriorState ?? null,
    sourceSignals: signals,
  };
}

function deriveToxicityInputFromAggregate(params: {
  aggregate: ChatOnlineFeatureAggregate;
  family?: string;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ToxicityRiskModelInput {
  return deriveToxicityInputFromRows({
    rows: params.aggregate.rows,
    generatedAt: params.aggregate.generatedAt,
    engagementScore: params.engagementScore,
    engagementPriorState: params.engagementPriorState,
    haterScore: params.haterScore,
    haterPriorState: params.haterPriorState,
    helperScore: params.helperScore,
    helperPriorState: params.helperPriorState,
    channelScore: params.channelScore,
    channelPriorState: params.channelPriorState,
    signals: params.signals,
  });
}

function deriveToxicityInputFromInferenceWindow(params: {
  window: ChatOnlineInferenceWindow;
  rows?: readonly ChatFeatureRow[];
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ToxicityRiskModelInput {
  const syntheticRow = params.window.latestRow ? [params.window.latestRow] : [];
  return deriveToxicityInputFromRows({
    rows: params.rows?.length ? params.rows : syntheticRow,
    generatedAt: params.window.generatedAt,
    engagementScore: params.engagementScore,
    engagementPriorState: params.engagementPriorState,
    haterScore: params.haterScore,
    haterPriorState: params.haterPriorState,
    helperScore: params.helperScore,
    helperPriorState: params.helperPriorState,
    channelScore: params.channelScore,
    channelPriorState: params.channelPriorState,
    signals: params.signals,
  });
}

// ============================================================================
// MARK: Scoring helpers
// ============================================================================

function scoreLexicalHostility(input: ToxicityRiskModelInput): Score01 {
  return clamp01(
    input.profanityDensity01 * 0.18 +
      input.insultDensity01 * 0.32 +
      input.threatLanguage01 * 0.32 +
      input.capsAggression01 * 0.10 +
      input.repetitionPressure01 * 0.08,
  );
}

function scoreBehavioralToxicity(input: ToxicityRiskModelInput, defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  const base =
    input.targetFixation01 * 0.24 +
    input.pileOnExposure01 * 0.20 +
    input.spamVelocity01 * 0.12 +
    input.shadowHostility01 * 0.14 +
    input.negotiationManipulation01 * 0.12 +
    input.silenceAfterProvocation01 * defaults.silenceAfterProvocationWeight01 +
    input.switchStress01 * defaults.switchStressWeight01;
  return clamp01(base);
}

function scoreVictimizationPressure(input: ToxicityRiskModelInput): Score01 {
  return clamp01(
    input.intimidation01 * 0.28 +
      input.embarrassment01 * 0.22 +
      input.frustration01 * 0.18 +
      input.ridiculeExposure01 * 0.16 +
      input.negativeSwarm01 * 0.16,
  );
}

function scoreEscalationVelocity(input: ToxicityRiskModelInput, defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  const amplifier =
    input.targetFixation01 >= defaults.highFixationThreshold01 ? defaults.pileOnAmplifier01 : 0;
  const threatAmplifier =
    input.threatLanguage01 >= defaults.highThreatThreshold01 ? 0.12 : 0;
  const capsAmplifier =
    input.capsAggression01 >= defaults.highCapsThreshold01 ? 0.06 : 0;
  return clamp01(
    input.hostileMomentum01 * 0.24 +
      input.haterEscalation01 * 0.20 +
      input.repetitionPressure01 * 0.10 +
      input.spamVelocity01 * 0.10 +
      input.negativeSwarm01 * 0.12 +
      input.visibilityExposure01 * 0.10 +
      input.messageLengthVolatility01 * 0.08 +
      amplifier +
      threatAmplifier +
      capsAmplifier,
  );
}

function scoreBlastRadius(input: ToxicityRiskModelInput, defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  return clamp01(
    input.visibilityExposure01 * 0.26 +
      input.roomHeat01 * 0.16 +
      input.negativeSwarm01 * 0.18 +
      input.pileOnExposure01 * 0.16 +
      input.recentPlayerShare01 * 0.04 +
      input.recentNpcShare01 * 0.04 +
      input.targetFixation01 * 0.10 +
      channelBlastBias(input.activeVisibleChannel, defaults) +
      roomBias(input.roomKind, defaults),
  );
}

function scoreShadowRouteValue(input: ToxicityRiskModelInput): Score01 {
  return clamp01(
    input.shadowHostility01 * 0.28 +
      input.negotiationManipulation01 * 0.16 +
      input.targetFixation01 * 0.14 +
      input.visibilityExposure01 * 0.08 +
      input.activeVisibleChannel === ('DEAL_ROOM' as ChatVisibleChannel) ? 0.10 : 0 +
      channelShadowBias(input.activeVisibleChannel) +
      input.helperProtection01 * 0.06,
  );
}

function scoreDeEscalationValue(input: ToxicityRiskModelInput, defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  return clamp01(
    input.deEscalationOpportunity01 * 0.34 +
      input.helperProtection01 * 0.22 +
      input.helperUrgency01 * 0.08 +
      (1 - input.targetFixation01) * 0.08 +
      (1 - input.threatLanguage01) * 0.10 +
      (1 - input.negativeSwarm01) * 0.08 +
      (1 - input.haterEscalation01) * 0.10 +
      defaults.deEscalationHelperBonus01,
  );
}

function scoreModerationSensitivity(
  toxicityCore01: Score01,
  escalation01: Score01,
  blastRadius01: Score01,
  input: ToxicityRiskModelInput,
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
): Score01 {
  const pressure = pressureDiscount(input.pressureTier, defaults);
  const helperDiscount = input.helperProtection01 * defaults.helperProtectionDiscount01;
  return clamp01(
    toxicityCore01 * 0.30 +
      escalation01 * 0.24 +
      blastRadius01 * 0.16 +
      input.threatLanguage01 * 0.10 +
      input.targetFixation01 * 0.10 +
      input.moderationHistory01 * 0.08 +
      input.suppressionHistory01 * 0.06 +
      input.negotiationManipulation01 * 0.06 -
      pressure -
      helperDiscount,
  );
}

function scoreToxicityCore(input: ToxicityRiskModelInput, defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  const lexical01 = scoreLexicalHostility(input);
  const behavioral01 = scoreBehavioralToxicity(input, defaults);
  const victimization01 = scoreVictimizationPressure(input);
  const roomAndChannelBias = roomBias(input.roomKind, defaults) + channelBlastBias(input.activeVisibleChannel, defaults);
  const humiliationAmplifier =
    average([input.embarrassment01, input.ridiculeExposure01]) * defaults.humiliationAmplifier01;
  const negotiationAmplifier =
    input.activeVisibleChannel === ('DEAL_ROOM' as ChatVisibleChannel)
      ? input.negotiationManipulation01 * defaults.negotiationPredationAmplifier01
      : 0;
  const swarmAmplifier = input.negativeSwarm01 * defaults.negativeSwarmAmplifier01;
  const pressure = pressureDiscount(input.pressureTier, defaults);
  return clamp01(
    lexical01 * 0.34 +
      behavioral01 * 0.28 +
      victimization01 * 0.18 +
      input.hostileMomentum01 * 0.08 +
      input.haterTargeting01 * 0.06 +
      input.channelMisfit01 * 0.04 +
      roomAndChannelBias +
      humiliationAmplifier +
      negotiationAmplifier +
      swarmAmplifier -
      pressure,
  );
}

function computeConfidence01(input: ToxicityRiskModelInput, defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS): Score01 {
  const freshness01 = normalizeFreshness01(input.freshnessMs, defaults);
  const evidence01 = 1 - evidencePenalty(input.evidenceRows, defaults);
  const auxiliary01 = average([
    input.bestChannelConfidence01,
    clamp01(1 - input.channelMisfit01),
    clamp01(1 - input.switchStress01),
  ]);
  return clamp01(freshness01 * 0.46 + evidence01 * 0.34 + auxiliary01 * 0.20);
}

function pickBand(value01: Score01): ToxicityBand {
  if (value01 >= 0.88) return 'CRITICAL';
  if (value01 >= 0.70) return 'HIGH';
  if (value01 >= 0.48) return 'MODERATE';
  if (value01 >= 0.24) return 'LOW';
  return 'MINIMAL';
}

function pickRecommendation(params: {
  toxicity01: Score01;
  escalation01: Score01;
  moderationSensitivity01: Score01;
  shadowRoute01: Score01;
  blastRadius01: Score01;
  deEscalationValue01: Score01;
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS;
}): ToxicityRecommendation {
  const {
    toxicity01,
    escalation01,
    moderationSensitivity01,
    shadowRoute01,
    blastRadius01,
    deEscalationValue01,
    defaults,
  } = params;

  if (moderationSensitivity01 >= defaults.hardBlockThreshold01 && escalation01 >= 0.80) {
    return 'HARD_BLOCK_RECOMMENDED';
  }
  if (moderationSensitivity01 >= defaults.quarantineThreshold01) {
    return 'QUARANTINE_RECOMMENDED';
  }
  if (moderationSensitivity01 >= defaults.reviewThreshold01) {
    return 'MODERATION_REVIEW';
  }
  if (shadowRoute01 >= defaults.shadowRouteThreshold01 && blastRadius01 < defaults.publicBlastThreshold01) {
    return 'SHADOW_ROUTE';
  }
  if (toxicity01 >= defaults.rateLimitThreshold01 || escalation01 >= defaults.rateLimitThreshold01) {
    return 'RATE_LIMIT_AND_WARN';
  }
  if (deEscalationValue01 >= 0.54 && toxicity01 >= 0.34) {
    return 'DE_ESCALATE_CONTEXT';
  }
  if (toxicity01 >= 0.22 || escalation01 >= 0.22) {
    return 'WATCH';
  }
  return 'ALLOW';
}

function buildExplanation(
  input: ToxicityRiskModelInput,
  score: {
    toxicity01: Score01;
    escalation01: Score01;
    moderationSensitivity01: Score01;
    shadowRoute01: Score01;
    blastRadius01: Score01;
    deEscalationValue01: Score01;
  },
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
): readonly ToxicityContribution[] {
  const factors: ToxicityContribution[] = [
    factor('hostile_momentum', input.hostileMomentum01 * 0.24, 'Hostile momentum raises scene volatility.'),
    factor('target_fixation', input.targetFixation01 * 0.22, 'Single-target fixation increases harassment and pile-on risk.'),
    factor('threat_language', input.threatLanguage01 * 0.24, 'Threat-coded language sharply increases moderation sensitivity.'),
    factor('insult_density', input.insultDensity01 * 0.18, 'Insult density pushes the scene away from theatrical conflict into abusive posture.'),
    factor('negative_swarm', input.negativeSwarm01 * 0.18, 'Crowd negativity amplifies humiliation and blast radius.'),
    factor('pile_on_exposure', input.pileOnExposure01 * 0.18, 'Pile-on exposure makes the scene socially dangerous even without direct slurs.'),
    factor('negotiation_manipulation', input.negotiationManipulation01 * 0.14, 'Manipulative deal-room pressure is treated as covert toxicity.'),
    factor('shadow_hostility', input.shadowHostility01 * 0.12, 'Shadow hostility indicates suppressed aggression beneath visible chat.'),
    factor('helper_protection', -input.helperProtection01 * 0.10, 'Helper presence and stabilizing posture improve recoverability.'),
    factor('de_escalation_value', -score.deEscalationValue01 * 0.10, 'There is recoverable room for de-escalation before maximum moderation severity.'),
    factor('channel_misfit', input.channelMisfit01 * 0.08, 'The current channel context is mismatched for the current tone.'),
    factor('visibility_exposure', input.visibilityExposure01 * 0.12, 'Public exposure raises blast radius and witness damage.'),
    factor('pressure_discount', -pressureDiscount(input.pressureTier, defaults), 'High-pressure mode discounts some raw hostility as non-final intent.'),
    factor('silence_after_provocation', input.silenceAfterProvocation01 * 0.06, 'Provocation followed by tense silence can indicate escalating confrontation.'),
  ];

  return factors
    .sort((a, b) => Math.abs(b.signedDelta01) - Math.abs(a.signedDelta01))
    .slice(0, defaults.maxExplanationFactors);
}

// ============================================================================
// MARK: v2 scoring helpers — liveops, ratchet, trend, pile-on
// ============================================================================

/**
 * Computes a liveops-driven toxicity amplification bonus based on active game events.
 * Invasion chaos creates a permissive cover for coordinated hostility that must still
 * be surfaced — the ambient heat is high but targeted attacks are more dangerous, not less.
 */
function computeLiveopsInvasionBonus01(
  input: ToxicityRiskModelInput,
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
): Score01 {
  const hasInvasion = input.sourceSignals.some(
    (s) => (s as unknown as Record<string, unknown>)?.liveops &&
      ((s as unknown as Record<string, unknown>).liveops as Record<string, unknown>)?.invasionActive,
  );
  if (!hasInvasion) return clamp01(0);
  const chaos = clamp01(input.roomHeat01 * 0.6 + input.negativeSwarm01 * 0.4);
  return clamp01(
    chaos * defaults.liveopsInvasionToxicityBonus01 +
      input.hostileMomentum01 * defaults.invasionChaosHostilityBonus01 * 0.6,
  );
}

/**
 * Computes a hater-raid amplification bonus. During raids, targeted hostility escalates
 * rapidly. The pile-on exposure and swarm signals should be weighted higher because
 * the coordinated nature of raid attacks is a force-multiplier for harm.
 */
function computeHaterRaidToxicityBonus01(
  input: ToxicityRiskModelInput,
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
): Score01 {
  const hasRaid = input.sourceSignals.some(
    (s) => (s as unknown as Record<string, unknown>)?.liveops &&
      ((s as unknown as Record<string, unknown>).liveops as Record<string, unknown>)?.haterRaidActive,
  );
  if (!hasRaid) return clamp01(0);
  return clamp01(
    input.pileOnExposure01 * defaults.liveopsHaterRaidToxicityBonus01 * 0.7 +
      input.negativeSwarm01 * defaults.liveopsHaterRaidToxicityBonus01 * 0.5 +
      input.targetFixation01 * defaults.liveopsHaterRaidToxicityBonus01 * 0.4,
  );
}

/**
 * World-event heat is a broad background pressure that raises the default hostility
 * baseline. It does not increase severity of direct attacks but does increase blast
 * radius for crowd-scaled content.
 */
function computeWorldEventHeatBonus01(
  input: ToxicityRiskModelInput,
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
): Score01 {
  const hasWorldEvent = input.sourceSignals.some(
    (s) => (s as unknown as Record<string, unknown>)?.liveops &&
      ((s as unknown as Record<string, unknown>).liveops as Record<string, unknown>)?.worldEventActive,
  );
  if (!hasWorldEvent) return clamp01(0);
  return clamp01(
    input.roomHeat01 * defaults.worldEventHeatToxicityBonus01 +
      input.visibilityExposure01 * defaults.worldEventHeatToxicityBonus01 * 0.5,
  );
}

/**
 * Escalation ratchet: if the scene has already crossed the escalation threshold,
 * a self-reinforcing ratchet term keeps the escalation score from decaying too fast
 * in the face of borderline subsequent evidence.
 */
function computeEscalationRatchet01(
  escalation01: Score01,
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
  prior: Nullable<ToxicityRiskPriorState>,
): Score01 {
  if (!prior) return clamp01(0);
  const priorEsc = prior.escalation01;
  if (priorEsc < defaults.escalationRatchetThreshold01) return clamp01(0);
  const ratchet = (priorEsc - escalation01) * defaults.escalationRatchetBonus01;
  return clamp01(Math.max(0, ratchet));
}

/**
 * Pile-on public-leak bonus: when pile-on exposure overlaps with high visibility
 * exposure and a public channel, the blast radius carries compound toxicity risk
 * beyond what either signal alone would warrant.
 */
function computePileOnPublicLeakBonus01(
  input: ToxicityRiskModelInput,
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
): Score01 {
  const isPublic =
    input.activeVisibleChannel === ('GLOBAL' as ChatVisibleChannel) ||
    input.activeVisibleChannel === ('LOBBY' as ChatVisibleChannel);
  if (!isPublic) return clamp01(0);
  return clamp01(
    input.pileOnExposure01 * input.visibilityExposure01 * defaults.crowdPileonPublicLeakBonus01,
  );
}

/**
 * Channel-specific escalation amplifiers. DEAL_ROOM coercive dynamics and SYNDICATE
 * whisper-channel hostility each have unique escalation topologies that the generic
 * scoring underweights.
 */
function computeChannelEscalationAmplifier01(
  input: ToxicityRiskModelInput,
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
): Score01 {
  switch (input.activeVisibleChannel as string) {
    case 'DEAL_ROOM':
      return clamp01(
        input.negotiationManipulation01 * defaults.dealRoomCoercionEscalationBonus01 +
          input.embarrassment01 * defaults.manipulationDealRoomEscalationBonus01,
      );
    case 'SYNDICATE':
      return clamp01(
        input.shadowHostility01 * defaults.syndicateWhisperHostilityBonus01 +
          input.targetFixation01 * 0.05,
      );
    case 'GLOBAL':
    case 'LOBBY':
      return clamp01(
        average([input.negativeSwarm01, input.pileOnExposure01]) *
          defaults.humiliationPublicEscalationBonus01 * 0.6,
      );
    default:
      return clamp01(0);
  }
}

/**
 * Blend current toxicity/escalation with prior state to prevent score whiplash.
 * A prior state older than priorStateMaxAgeMs is treated as stale and ignored.
 */
function blendWithPriorToxicity(
  current: Score01,
  priorValue: Score01,
  blendWeight: number,
  priorAge: number,
  maxAge: number,
): Score01 {
  if (priorAge > maxAge) return current;
  const decay = Math.max(0, 1 - priorAge / maxAge);
  return clamp01(current * (1 - blendWeight * decay) + priorValue * blendWeight * decay);
}

/**
 * Derives a trend direction from prior state and current score.
 * The delta magnitude determines whether we're in a meaningful change or noise band.
 */
function computeToxicityTrend(
  currentToxicity01: Score01,
  prior: Nullable<ToxicityRiskPriorState>,
  nowMs: UnixMs,
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
): ToxicityTrendDirection {
  if (!prior) return 'STABLE';
  const ageMs = Math.max(0, nowMs - prior.generatedAt);
  if (ageMs > defaults.priorStateMaxAgeMs) return 'STABLE';
  const delta = currentToxicity01 - prior.toxicity01;
  if (delta >= 0.16) return 'ACCELERATING';
  if (delta >= 0.08) return 'ESCALATING';
  if (delta <= -0.16) return 'DECELERATING';
  if (delta <= -0.08) return 'COOLING';
  return 'STABLE';
}

/**
 * Derive pileOnAmplifiedRisk01: a synthesized risk signal that represents the combined
 * danger of pile-on mechanics, public visibility, and crowd momentum. Used by
 * downstream orchestration to decide pile-on intervention priority.
 */
function computePileOnAmplifiedRisk01(
  input: ToxicityRiskModelInput,
  defaults: typeof CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
): Score01 {
  const pileOnFactor = input.pileOnExposure01 * defaults.pileOnCriticalAmplifier01;
  const crowdFactor = input.negativeSwarm01 * 0.8;
  const fixationFactor = input.targetFixation01 * 0.7;
  const visibilityFactor = input.visibilityExposure01;
  return clamp01(
    pileOnFactor * 0.32 +
      crowdFactor * 0.28 +
      fixationFactor * 0.22 +
      visibilityFactor * 0.18,
  );
}

/**
 * Evidence pattern digest using topTags: summarizes dominant tagging patterns
 * in the feature rows for audit context and health reporting.
 */
function evidenceTagDigest(rows: readonly ChatFeatureRow[]): string {
  const tags = topTags(rows);
  if (tags.length === 0) return 'no-tags';
  return tags.slice(0, 5).join(',');
}

/**
 * Acceptance signal health: ratio of accepted to total messages in the recent window,
 * used to detect scenes where acceptance has dried up (predictive of escalation).
 */
function acceptanceRate01(recentAcceptCount: number, recentRejectCount: number): Score01 {
  const total = recentAcceptCount + recentRejectCount;
  return normalizeCount01(recentAcceptCount, total);
}

/**
 * Low-evidence confidence floor using minOf: when evidence is sparse, confidence
 * is bounded from below by the worst-case freshness and evidence signal.
 */
function computeEvidenceFloor01(
  freshnessScore01: Score01,
  evidenceScore01: Score01,
): Score01 {
  return clamp01(minOf([freshnessScore01, evidenceScore01]));
}

/**
 * Window-aware scalar derivation from a ChatOnlineInferenceWindow. Uses inferenceScalar
 * for direct key lookup with fallback, providing a cleaner call site than repeating
 * the null-check pattern at every usage.
 */
function windowPickScalar(
  window: ChatOnlineInferenceWindow | null | undefined,
  key: string,
  fallback: number,
): number {
  return inferenceScalar(window, key, fallback);
}

// ============================================================================
// MARK: Model implementation
// ============================================================================

export class ToxicityRiskModel {
  private readonly context: ToxicityRiskModelContext;

  // v2: health counters — lifetime aggregates for observability/reporting
  private totalScoredLifetime = 0;
  private totalToxicity01Sum = 0;
  private maxToxicity01Lifetime = 0;
  private totalEscalation01Sum = 0;
  private totalCriticalCount = 0;
  private totalBlockCount = 0;
  private totalShadowRouteCount = 0;
  private totalQuarantineCount = 0;
  private totalReviewCount = 0;
  private readonly auditLog: ToxicityAuditEntry[] = [];

  public constructor(options: ToxicityRiskModelOptions = {}) {
    this.context = {
      logger: options.logger ?? DEFAULT_LOGGER,
      clock: options.clock ?? DEFAULT_CLOCK,
      defaults: Object.freeze({
        ...CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
        ...(options.defaults ?? {}),
      }),
      runtime: mergeRuntimeConfig(options.runtimeOverride),
    };
  }

  public getContext(): ToxicityRiskModelContext {
    return this.context;
  }

  public score(input: ToxicityRiskModelInput, prior?: Nullable<ToxicityRiskPriorState>): ToxicityRiskScore {
    const defaults = this.context.defaults;
    const now = this.context.clock.now();
    const lowEvidence01 = evidencePenalty(input.evidenceRows, defaults);
    const freshness01 = normalizeFreshness01(input.freshnessMs, defaults);

    // v2: liveops bonuses computed up-front so they can amplify core scores
    const liveopsInvasion01 = computeLiveopsInvasionBonus01(input, defaults);
    const liveopsRaid01 = computeHaterRaidToxicityBonus01(input, defaults);
    const liveopsWorld01 = computeWorldEventHeatBonus01(input, defaults);
    const liveopsBoost01 = clamp01(liveopsInvasion01 + liveopsRaid01 + liveopsWorld01);
    const channelAmp01 = computeChannelEscalationAmplifier01(input, defaults);
    const pileOnLeak01 = computePileOnPublicLeakBonus01(input, defaults);

    const toxicityCore01 = clamp01(scoreToxicityCore(input, defaults) + liveopsBoost01 * 0.50);
    const escalation01 = clamp01(
      scoreEscalationVelocity(input, defaults) * (1 - defaults.escalationBlend01) +
        toxicityCore01 * defaults.escalationBlend01 +
        channelAmp01 * 0.40,
    );
    const blastRadius01 = clamp01(scoreBlastRadius(input, defaults) + pileOnLeak01 * 0.30);
    const shadowRoute01 = scoreShadowRouteValue(input);
    const deEscalationValue01 = scoreDeEscalationValue(input, defaults);
    const moderationSensitivity01 = scoreModerationSensitivity(
      toxicityCore01,
      escalation01,
      blastRadius01,
      input,
      defaults,
    );

    // v2: escalation ratchet — prevents premature cooldown when prior was high
    const escalationRatchet01 = computeEscalationRatchet01(escalation01, defaults, prior ?? null);

    const rawToxicity01 = clamp01(
      toxicityCore01 * (1 - defaults.baselineBlend01) +
        defaults.lowEvidenceFallback01 * defaults.baselineBlend01 +
        shadowRoute01 * defaults.shadowBlend01 +
        blastRadius01 * defaults.blastRadiusBlend01 +
        escalation01 * defaults.escalationBlend01 +
        escalationRatchet01 * 0.50 -
        deEscalationValue01 * defaults.deEscalationBlend01,
    );

    const priorAge = prior ? Math.max(0, now - prior.generatedAt) : defaults.priorStateMaxAgeMs + 1;
    const blendedToxicity01 = prior
      ? blendWithPriorToxicity(
          clamp01(rawToxicity01 * freshness01 + defaults.lowEvidenceFallback01 * lowEvidence01 * 0.30),
          prior.toxicity01,
          defaults.priorBlendToxicity01,
          priorAge,
          defaults.priorStateMaxAgeMs,
        )
      : clamp01(rawToxicity01 * freshness01 + defaults.lowEvidenceFallback01 * lowEvidence01 * 0.30);
    const toxicity01 = blendedToxicity01;

    // v2: derived composite risk signals
    const pileOnAmplifiedRisk01 = computePileOnAmplifiedRisk01(input, defaults);
    const trendDirection = computeToxicityTrend(toxicity01, prior ?? null, now, defaults);

    // confidence uses evidence floor helper
    const evidenceFloor01 = computeEvidenceFloor01(freshness01, clamp01(1 - lowEvidence01));
    const confidence01 = clamp01(computeConfidence01(input, defaults) * 0.6 + evidenceFloor01 * 0.4);

    // acceptance rate provides a signal quality gate for confidence
    const acceptRate01 = acceptanceRate01(input.recentAcceptCount, input.recentRejectCount);
    const adjustedConfidence01 = clamp01(confidence01 * (0.7 + acceptRate01 * 0.3));

    const recommendation = pickRecommendation({
      toxicity01,
      escalation01,
      moderationSensitivity01,
      shadowRoute01,
      blastRadius01,
      deEscalationValue01,
      defaults,
    });
    const band = pickBand(clamp01(maxOf([toxicity01, moderationSensitivity01 * 0.92])));
    const explanation = buildExplanation(
      input,
      {
        toxicity01,
        escalation01,
        moderationSensitivity01,
        shadowRoute01,
        blastRadius01,
        deEscalationValue01,
      },
      defaults,
    );

    const diagnostics: ToxicityRiskModelDiagnostics = {
      evidenceRows: input.evidenceRows,
      lowEvidence: input.evidenceRows < defaults.lowEvidenceRowCount,
      staleSignal: input.freshnessMs > defaults.staleWindowMs,
      roomKind: input.roomKind,
      activeVisibleChannel: input.activeVisibleChannel,
      pressureTier: input.pressureTier,
      featureFreshnessMs: input.freshnessMs,
      modelVersion: CHAT_TOXICITY_RISK_MODEL_VERSION,
    };

    const shouldShadowRoute =
      recommendation === 'SHADOW_ROUTE' || shadowRoute01 >= defaults.shadowRouteThreshold01;
    const shouldRateLimit =
      recommendation === 'RATE_LIMIT_AND_WARN' || escalation01 >= defaults.rateLimitThreshold01;
    const shouldReview =
      recommendation === 'MODERATION_REVIEW' || moderationSensitivity01 >= defaults.reviewThreshold01;
    const shouldQuarantine =
      recommendation === 'QUARANTINE_RECOMMENDED' || moderationSensitivity01 >= defaults.quarantineThreshold01;
    const shouldHardBlock =
      recommendation === 'HARD_BLOCK_RECOMMENDED' || moderationSensitivity01 >= defaults.hardBlockThreshold01;
    const shouldIntercept = shouldHardBlock || shouldQuarantine || band === 'CRITICAL';
    const isHighBlastPublic =
      blastRadius01 >= defaults.publicBlastThreshold01 &&
      (input.activeVisibleChannel === ('GLOBAL' as ChatVisibleChannel) ||
        input.activeVisibleChannel === ('LOBBY' as ChatVisibleChannel));

    // track health counters
    this.totalScoredLifetime += 1;
    this.totalToxicity01Sum += toxicity01;
    if (toxicity01 > this.maxToxicity01Lifetime) this.maxToxicity01Lifetime = toxicity01;
    this.totalEscalation01Sum += escalation01;
    if (band === 'CRITICAL') this.totalCriticalCount += 1;
    if (shouldHardBlock) this.totalBlockCount += 1;
    if (shouldShadowRoute) this.totalShadowRouteCount += 1;
    if (shouldQuarantine) this.totalQuarantineCount += 1;
    if (shouldReview) this.totalReviewCount += 1;

    // audit trail (when enabled)
    if (defaults.auditTrailEnabled) {
      this.auditLog.push({
        timestamp: now,
        sessionId: input.sessionId,
        userId: input.userId,
        roomId: input.roomId,
        band,
        recommendation,
        toxicity01,
        escalation01,
        moderationSensitivity01,
        shadowRoute01,
        blastRadius01,
        topFactor: explanation[0]?.key ?? 'none',
        channel: input.activeVisibleChannel,
      });
    }

    return {
      generatedAt: input.generatedAt,
      roomId: input.roomId,
      sessionId: input.sessionId,
      userId: input.userId,
      band,
      recommendation,
      toxicity01,
      escalation01,
      moderationSensitivity01,
      shadowRoute01,
      blastRadius01,
      deEscalationValue01,
      confidence01: adjustedConfidence01,
      toxicity100: clamp100(toxicity01 * 100),
      escalation100: clamp100(escalation01 * 100),
      moderationSensitivity100: clamp100(moderationSensitivity01 * 100),
      // v2 additions
      liveopsBoost01,
      escalationRatchet01,
      pileOnAmplifiedRisk01,
      trendDirection,
      shouldIntercept,
      isHighBlastPublic,
      shouldShadowRoute,
      shouldRateLimit,
      shouldReview,
      shouldQuarantine,
      shouldHardBlock,
      explanation,
      diagnostics,
      metadata: Object.freeze({
        moduleName: CHAT_TOXICITY_RISK_MODEL_MODULE_NAME,
        moduleVersion: CHAT_TOXICITY_RISK_MODEL_VERSION,
        roomHeat01: input.roomHeat01,
        negativeSwarm01: input.negativeSwarm01,
        haterTargeting01: input.haterTargeting01,
        helperProtection01: input.helperProtection01,
        deEscalationOpportunity01: input.deEscalationOpportunity01,
        liveopsBoost01,
        escalationRatchet01,
        pileOnAmplifiedRisk01,
        trendDirection,
      }),
    };
  }

  public scoreRows(params: {
    rows: readonly ChatFeatureRow[];
    generatedAt?: UnixMs;
    engagementScore?: Nullable<EngagementModelScore>;
    engagementPriorState?: Nullable<EngagementModelPriorState>;
    haterScore?: Nullable<HaterTargetingScore>;
    haterPriorState?: Nullable<HaterTargetingPriorState>;
    helperScore?: Nullable<HelperTimingScore>;
    helperPriorState?: Nullable<HelperTimingPriorState>;
    channelScore?: Nullable<ChannelAffinityScore>;
    channelPriorState?: Nullable<ChannelAffinityPriorState>;
    signals?: readonly ChatSignalEnvelope[];
  }): ToxicityRiskBatchResult {
    const generatedAt = params.generatedAt ?? this.context.clock.now();
    const input = deriveToxicityInputFromRows({
      rows: params.rows,
      generatedAt,
      engagementScore: params.engagementScore,
      engagementPriorState: params.engagementPriorState,
      haterScore: params.haterScore,
      haterPriorState: params.haterPriorState,
      helperScore: params.helperScore,
      helperPriorState: params.helperPriorState,
      channelScore: params.channelScore,
      channelPriorState: params.channelPriorState,
      signals: params.signals,
    });
    return {
      input,
      score: this.score(input),
    };
  }

  public scoreAggregate(params: {
    aggregate: ChatOnlineFeatureAggregate;
    engagementScore?: Nullable<EngagementModelScore>;
    engagementPriorState?: Nullable<EngagementModelPriorState>;
    haterScore?: Nullable<HaterTargetingScore>;
    haterPriorState?: Nullable<HaterTargetingPriorState>;
    helperScore?: Nullable<HelperTimingScore>;
    helperPriorState?: Nullable<HelperTimingPriorState>;
    channelScore?: Nullable<ChannelAffinityScore>;
    channelPriorState?: Nullable<ChannelAffinityPriorState>;
    signals?: readonly ChatSignalEnvelope[];
  }): ToxicityRiskBatchResult {
    const input = deriveToxicityInputFromAggregate({
      aggregate: params.aggregate,
      engagementScore: params.engagementScore,
      engagementPriorState: params.engagementPriorState,
      haterScore: params.haterScore,
      haterPriorState: params.haterPriorState,
      helperScore: params.helperScore,
      helperPriorState: params.helperPriorState,
      channelScore: params.channelScore,
      channelPriorState: params.channelPriorState,
      signals: params.signals,
    });
    return {
      input,
      score: this.score(input),
    };
  }

  public scoreInferenceWindow(params: {
    window: ChatOnlineInferenceWindow;
    rows?: readonly ChatFeatureRow[];
    engagementScore?: Nullable<EngagementModelScore>;
    engagementPriorState?: Nullable<EngagementModelPriorState>;
    haterScore?: Nullable<HaterTargetingScore>;
    haterPriorState?: Nullable<HaterTargetingPriorState>;
    helperScore?: Nullable<HelperTimingScore>;
    helperPriorState?: Nullable<HelperTimingPriorState>;
    channelScore?: Nullable<ChannelAffinityScore>;
    channelPriorState?: Nullable<ChannelAffinityPriorState>;
    signals?: readonly ChatSignalEnvelope[];
  }): ToxicityRiskBatchResult {
    const input = deriveToxicityInputFromInferenceWindow({
      window: params.window,
      rows: params.rows,
      engagementScore: params.engagementScore,
      engagementPriorState: params.engagementPriorState,
      haterScore: params.haterScore,
      haterPriorState: params.haterPriorState,
      helperScore: params.helperScore,
      helperPriorState: params.helperPriorState,
      channelScore: params.channelScore,
      channelPriorState: params.channelPriorState,
      signals: params.signals,
    });
    return {
      input,
      score: this.score(input),
    };
  }

  public scoreStore(params: {
    store: OnlineFeatureStore;
    query: ChatOnlineFeatureStoreQuery;
    family?: string;
    engagementScore?: Nullable<EngagementModelScore>;
    engagementPriorState?: Nullable<EngagementModelPriorState>;
    haterScore?: Nullable<HaterTargetingScore>;
    haterPriorState?: Nullable<HaterTargetingPriorState>;
    helperScore?: Nullable<HelperTimingScore>;
    helperPriorState?: Nullable<HelperTimingPriorState>;
    channelScore?: Nullable<ChannelAffinityScore>;
    channelPriorState?: Nullable<ChannelAffinityPriorState>;
    signals?: readonly ChatSignalEnvelope[];
  }): ToxicityRiskBatchResult {
    const aggregate = params.store.aggregate(params.query);
    return this.scoreAggregate({
      aggregate,
      engagementScore: params.engagementScore,
      engagementPriorState: params.engagementPriorState,
      haterScore: params.haterScore,
      haterPriorState: params.haterPriorState,
      helperScore: params.helperScore,
      helperPriorState: params.helperPriorState,
      channelScore: params.channelScore,
      channelPriorState: params.channelPriorState,
      signals: params.signals,
    });
  }

  public scoreIngestResult(params: {
    ingestResult: ChatFeatureIngestResult;
    engagementScore?: Nullable<EngagementModelScore>;
    engagementPriorState?: Nullable<EngagementModelPriorState>;
    haterScore?: Nullable<HaterTargetingScore>;
    haterPriorState?: Nullable<HaterTargetingPriorState>;
    helperScore?: Nullable<HelperTimingScore>;
    helperPriorState?: Nullable<HelperTimingPriorState>;
    channelScore?: Nullable<ChannelAffinityScore>;
    channelPriorState?: Nullable<ChannelAffinityPriorState>;
    signals?: readonly ChatSignalEnvelope[];
  }): ToxicityRiskBatchResult {
    return this.scoreRows({
      rows: params.ingestResult.rows,
      generatedAt: params.ingestResult.generatedAt,
      engagementScore: params.engagementScore,
      engagementPriorState: params.engagementPriorState,
      haterScore: params.haterScore,
      haterPriorState: params.haterPriorState,
      helperScore: params.helperScore,
      helperPriorState: params.helperPriorState,
      channelScore: params.channelScore,
      channelPriorState: params.channelPriorState,
      signals: params.signals,
    });
  }

  /**
   * Serializes a scored result into a ToxicityRiskPriorState for persistence
   * and prior-state blending on the next scoring cycle.
   */
  public toPriorState(score: ToxicityRiskScore): ToxicityRiskPriorState {
    return {
      toxicity01: score.toxicity01,
      escalation01: score.escalation01,
      moderationSensitivity01: score.moderationSensitivity01,
      shadowRoute01: score.shadowRoute01,
      generatedAt: score.generatedAt,
    };
  }

  /**
   * Batch-scores multiple inputs, producing a per-entry result array and an
   * optional aggregate stats block. Enables downstream orchestration to
   * scan a session window without constructing multiple model instances.
   */
  public scoreBatch(params: {
    inputs: readonly ToxicityRiskModelInput[];
    prior?: Nullable<ToxicityRiskPriorState>;
    emitStats?: boolean;
  }): { results: ToxicityRiskBatchResult[]; stats: ToxicityBatchStats | null } {
    const defaults = this.context.defaults;
    const emitStats = params.emitStats ?? defaults.batchScoreEmitStats;
    const results: ToxicityRiskBatchResult[] = [];
    let rollingPrior = params.prior ?? null;

    for (const input of params.inputs) {
      const score = this.score(input, rollingPrior);
      results.push({ input, score });
      rollingPrior = this.toPriorState(score);
    }

    if (!emitStats || results.length === 0) {
      return { results, stats: null };
    }

    let toxSum = 0;
    let escSum = 0;
    let blastSum = 0;
    let sensSum = 0;
    let maxTox = 0;
    let criticalCount = 0;
    let blockCount = 0;
    let shadowCount = 0;
    let quarantineCount = 0;
    let reviewCount = 0;

    for (const { score } of results) {
      toxSum += score.toxicity01;
      escSum += score.escalation01;
      blastSum += score.blastRadius01;
      sensSum += score.moderationSensitivity01;
      if (score.toxicity01 > maxTox) maxTox = score.toxicity01;
      if (score.band === 'CRITICAL') criticalCount += 1;
      if (score.shouldHardBlock) blockCount += 1;
      if (score.shouldShadowRoute) shadowCount += 1;
      if (score.shouldQuarantine) quarantineCount += 1;
      if (score.shouldReview) reviewCount += 1;
    }

    const n = results.length;
    const stats: ToxicityBatchStats = {
      count: n,
      criticalCount,
      blockCount,
      shadowRouteCount: shadowCount,
      quarantineCount,
      reviewCount,
      meanToxicity01: toxSum / n,
      maxToxicity01: maxTox,
      meanEscalation01: escSum / n,
      meanBlastRadius01: blastSum / n,
      meanModerationSensitivity01: sensSum / n,
    };

    return { results, stats };
  }

  /**
   * Derives a toxicity trend signal for a single session by comparing a current
   * score to a prior state snapshot.
   */
  public toxicityTrendFor(
    score: ToxicityRiskScore,
    prior: Nullable<ToxicityRiskPriorState>,
  ): ToxicityTrendSignal {
    const now = this.context.clock.now();
    const direction = computeToxicityTrend(
      score.toxicity01,
      prior,
      now,
      this.context.defaults,
    );
    return {
      direction,
      deltaPerWindow: prior ? score.toxicity01 - prior.toxicity01 : 0,
      priorToxicity01: prior?.toxicity01 ?? score.toxicity01,
      currentToxicity01: score.toxicity01,
    };
  }

  /**
   * Produces a lifetime health report for observability and ops dashboards.
   * Values reset only when the model instance is replaced.
   */
  public getHealthReport(): ToxicityHealthReport {
    const n = this.totalScoredLifetime;
    return {
      totalScoredLifetime: n,
      totalCriticalCount: this.totalCriticalCount,
      totalBlockCount: this.totalBlockCount,
      totalShadowRouteCount: this.totalShadowRouteCount,
      totalQuarantineCount: this.totalQuarantineCount,
      totalReviewCount: this.totalReviewCount,
      auditLogSize: this.auditLog.length,
      meanToxicity01: n > 0 ? this.totalToxicity01Sum / n : 0,
      maxToxicity01Lifetime: this.maxToxicity01Lifetime,
      meanEscalation01: n > 0 ? this.totalEscalation01Sum / n : 0,
    };
  }

  /**
   * Returns a snapshot of the audit log. The log is only populated when
   * `defaults.auditTrailEnabled` is true.
   */
  public getAuditLog(): readonly ToxicityAuditEntry[] {
    return this.auditLog;
  }

  /**
   * Clears the in-memory audit log. Call this periodically to prevent
   * unbounded memory growth in long-lived instances.
   */
  public clearAuditLog(): void {
    this.auditLog.length = 0;
  }
}

// ============================================================================
// MARK: Public convenience helpers
// ============================================================================

export function createToxicityRiskModel(options: ToxicityRiskModelOptions = {}): ToxicityRiskModel {
  return new ToxicityRiskModel(options);
}

export function scoreToxicityRiskAggregate(params: {
  aggregate: ChatOnlineFeatureAggregate;
  options?: ToxicityRiskModelOptions;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ToxicityRiskScore {
  return createToxicityRiskModel(params.options).scoreAggregate(params).score;
}

export function scoreToxicityRiskStore(params: {
  store: OnlineFeatureStore;
  query: ChatOnlineFeatureStoreQuery;
  options?: ToxicityRiskModelOptions;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ToxicityRiskScore {
  return createToxicityRiskModel(params.options).scoreStore(params).score;
}

export function scoreToxicityRiskRows(params: {
  rows: readonly ChatFeatureRow[];
  generatedAt?: UnixMs;
  options?: ToxicityRiskModelOptions;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ToxicityRiskScore {
  return createToxicityRiskModel(params.options).scoreRows(params).score;
}

export function scoreToxicityRiskInferenceWindow(params: {
  window: ChatOnlineInferenceWindow;
  rows?: readonly ChatFeatureRow[];
  options?: ToxicityRiskModelOptions;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ToxicityRiskScore {
  return createToxicityRiskModel(params.options).scoreInferenceWindow(params).score;
}

export function serializeToxicityRiskScore(score: ToxicityRiskScore): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    generatedAt: score.generatedAt,
    roomId: score.roomId,
    sessionId: score.sessionId,
    userId: score.userId,
    band: score.band,
    recommendation: score.recommendation,
    toxicity01: score.toxicity01,
    escalation01: score.escalation01,
    moderationSensitivity01: score.moderationSensitivity01,
    shadowRoute01: score.shadowRoute01,
    blastRadius01: score.blastRadius01,
    deEscalationValue01: score.deEscalationValue01,
    confidence01: score.confidence01,
    shouldShadowRoute: score.shouldShadowRoute,
    shouldRateLimit: score.shouldRateLimit,
    shouldReview: score.shouldReview,
    shouldQuarantine: score.shouldQuarantine,
    shouldHardBlock: score.shouldHardBlock,
    explanation: score.explanation.map((entry) => ({
      key: entry.key,
      signedDelta01: entry.signedDelta01,
      reason: entry.reason,
    })),
    diagnostics: {
      evidenceRows: score.diagnostics.evidenceRows,
      lowEvidence: score.diagnostics.lowEvidence,
      staleSignal: score.diagnostics.staleSignal,
      roomKind: score.diagnostics.roomKind,
      activeVisibleChannel: score.diagnostics.activeVisibleChannel,
      pressureTier: score.diagnostics.pressureTier,
      featureFreshnessMs: score.diagnostics.featureFreshnessMs,
      modelVersion: score.diagnostics.modelVersion,
    },
    metadata: score.metadata,
  });
}

export function hydratePriorToxicityRiskState(
  payload: Nullable<Readonly<Record<string, JsonValue>>>,
): Nullable<ToxicityRiskPriorState> {
  if (!payload) return null;
  return {
    generatedAt: asUnixMs(safeNumber(payload.generatedAt, Date.now())),
    toxicity01: clamp01(safeNumber(payload.toxicity01)),
    escalation01: clamp01(safeNumber(payload.escalation01)),
    moderationSensitivity01: clamp01(safeNumber(payload.moderationSensitivity01)),
    shadowRoute01: clamp01(safeNumber(payload.shadowRoute01)),
  };
}

export function toxicityRiskSummary(score: ToxicityRiskScore): string {
  return [
    `band=${score.band}`,
    `recommendation=${score.recommendation}`,
    `toxicity=${score.toxicity100}`,
    `escalation=${score.escalation100}`,
    `sensitivity=${score.moderationSensitivity100}`,
  ].join(' | ');
}

export function toxicityRiskNeedsHardBlock(score: ToxicityRiskScore): boolean {
  return score.shouldHardBlock;
}

export function toxicityRiskNeedsReview(score: ToxicityRiskScore): boolean {
  return score.shouldReview || score.shouldQuarantine;
}

export function toxicityRiskNeedsShadowRoute(score: ToxicityRiskScore): boolean {
  return score.shouldShadowRoute;
}

// ============================================================================
// MARK: v2 public helpers — predicates, labels, telemetry, sorting
// ============================================================================

/**
 * True if the toxicity score is in the CRITICAL band or has hard-block active.
 * Use this as the primary gate for emergency moderation escalation.
 */
export function toxicityIsCritical(score: ToxicityRiskScore): boolean {
  return score.band === 'CRITICAL' || score.shouldHardBlock;
}

/**
 * True if the score requires immediate action (quarantine or hard-block).
 */
export function toxicityNeedsImmediate(score: ToxicityRiskScore): boolean {
  return score.shouldIntercept;
}

/**
 * True if the toxicity risk is in a public channel with high blast radius.
 * Indicates wide audience harm risk vs. contained private escalation.
 */
export function toxicityIsInPublicCrowd(score: ToxicityRiskScore): boolean {
  return score.isHighBlastPublic;
}

/**
 * True if the primary escalation signal is DEAL_ROOM coercive manipulation
 * rather than overt hostility.
 */
export function toxicityIsDealRoomCoercion(score: ToxicityRiskScore): boolean {
  return (
    score.diagnostics.activeVisibleChannel === ('DEAL_ROOM' as ChatVisibleChannel) &&
    score.band !== 'MINIMAL' &&
    score.band !== 'LOW'
  );
}

/**
 * True if the scene has meaningful pile-on amplified risk, indicating the
 * crowd dynamic is a primary driver of toxicity rather than a single actor.
 */
export function toxicityIsPileOnDriven(score: ToxicityRiskScore): boolean {
  return score.pileOnAmplifiedRisk01 >= 0.50;
}

/**
 * True if the current toxicity trend is accelerating or escalating —
 * useful for early-warning systems before a threshold is fully crossed.
 */
export function toxicityIsEscalating(score: ToxicityRiskScore): boolean {
  return score.trendDirection === 'ACCELERATING' || score.trendDirection === 'ESCALATING';
}

/**
 * True if toxicity is actively cooling or decelerating — indicates de-escalation
 * efforts or natural cool-down is working.
 */
export function toxicityIsCooling(score: ToxicityRiskScore): boolean {
  return score.trendDirection === 'COOLING' || score.trendDirection === 'DECELERATING';
}

/**
 * True if liveops events (invasion, raid, world event) are the primary
 * driver of the toxicity amplification above baseline.
 */
export function toxicityIsLiveopsAmplified(score: ToxicityRiskScore): boolean {
  return score.liveopsBoost01 >= 0.06;
}

/**
 * Human-readable label for a ToxicityBand value.
 */
export function toxicityBandLabel(band: ToxicityBand): string {
  switch (band) {
    case 'CRITICAL': return 'Critical — immediate moderation required';
    case 'HIGH': return 'High — active escalation posture';
    case 'MODERATE': return 'Moderate — elevated attention needed';
    case 'LOW': return 'Low — monitoring mode';
    case 'MINIMAL': return 'Minimal — within acceptable range';
  }
}

/**
 * Human-readable label for a ToxicityRecommendation value.
 */
export function toxicityRecommendationLabel(rec: ToxicityRecommendation): string {
  switch (rec) {
    case 'HARD_BLOCK_RECOMMENDED': return 'Hard block recommended — extreme violation detected';
    case 'QUARANTINE_RECOMMENDED': return 'Quarantine recommended — high toxicity pattern';
    case 'MODERATION_REVIEW': return 'Send to moderation review queue';
    case 'SHADOW_ROUTE': return 'Shadow-route the content — allow without visibility';
    case 'RATE_LIMIT_AND_WARN': return 'Rate-limit sender and issue warning';
    case 'DE_ESCALATE_CONTEXT': return 'Trigger de-escalation intervention';
    case 'WATCH': return 'Watch mode — no action yet, monitoring escalation';
    case 'ALLOW': return 'Allow — within normal operating range';
  }
}

/**
 * Human-readable label for a ToxicityTrendDirection.
 */
export function toxicityTrendLabel(direction: ToxicityTrendDirection): string {
  switch (direction) {
    case 'ACCELERATING': return 'Accelerating rapidly — critical surge';
    case 'ESCALATING': return 'Escalating — rising above baseline';
    case 'STABLE': return 'Stable — no meaningful change';
    case 'COOLING': return 'Cooling — slow improvement';
    case 'DECELERATING': return 'Decelerating — clear downward trend';
  }
}

/**
 * Produces a compact multi-factor explanation summary string, suitable for
 * debug logs, telemetry, and operator dashboards.
 */
export function toxicityExplanationSummary(score: ToxicityRiskScore): string {
  return score.explanation
    .slice(0, 5)
    .map((c) => `${c.key}(${c.signedDelta01 >= 0 ? '+' : ''}${c.signedDelta01.toFixed(3)})`)
    .join(', ');
}

/**
 * Produces a condensed persona summary combining band, trend, recommendation,
 * and top driver. Suitable for NPC injection decisions and operator dashboards.
 */
export function toxicityPersonaSummary(score: ToxicityRiskScore): string {
  const topFactor = score.explanation[0]?.key ?? 'none';
  return [
    `band=${score.band}`,
    `trend=${score.trendDirection}`,
    `rec=${score.recommendation}`,
    `driver=${topFactor}`,
    score.isHighBlastPublic ? 'PUBLIC_BLAST' : null,
    score.liveopsBoost01 >= 0.06 ? 'LIVEOPS_AMP' : null,
  ].filter(Boolean).join(' | ');
}

/**
 * Comparator: sorts scores by toxicity01 descending (most toxic first).
 * Useful for priority ordering in batch moderation queues.
 */
export function toxicityScoreCompare(a: ToxicityRiskScore, b: ToxicityRiskScore): number {
  return b.toxicity01 - a.toxicity01;
}

/**
 * Sorts a score array in-place by toxicity01 descending.
 */
export function sortToxicityScoresDescending(scores: ToxicityRiskScore[]): ToxicityRiskScore[] {
  return scores.sort(toxicityScoreCompare);
}

/**
 * Returns scores that require any action (review, rate-limit, shadow, quarantine, block).
 */
export function toxicityScoresNeedingAction(scores: readonly ToxicityRiskScore[]): ToxicityRiskScore[] {
  return scores.filter((s) => s.recommendation !== 'ALLOW' && s.recommendation !== 'WATCH');
}

/**
 * Returns only the CRITICAL or HARD_BLOCK scores from a batch.
 */
export function toxicityScoresCritical(scores: readonly ToxicityRiskScore[]): ToxicityRiskScore[] {
  return scores.filter(toxicityIsCritical);
}

/**
 * Returns scores that should trigger a hard block.
 */
export function toxicityScoresNeedingHardBlock(scores: readonly ToxicityRiskScore[]): ToxicityRiskScore[] {
  return scores.filter((s) => s.shouldHardBlock);
}

/**
 * Confidence as a 0–100 integer percentage.
 */
export function toxicityConfidence100(score: ToxicityRiskScore): number {
  return Math.round(score.confidence01 * 100);
}

/**
 * Serializes a score to a flat telemetry-safe dictionary.
 * Uses evidenceTagDigest for tagging context when rows are available.
 */
export function toxicityScoreToTelemetry(
  score: ToxicityRiskScore,
  rows?: readonly ChatFeatureRow[],
): Readonly<Record<string, string | number | boolean | null>> {
  return Object.freeze({
    band: score.band,
    recommendation: score.recommendation,
    toxicity01: score.toxicity01,
    escalation01: score.escalation01,
    moderationSensitivity01: score.moderationSensitivity01,
    shadowRoute01: score.shadowRoute01,
    blastRadius01: score.blastRadius01,
    deEscalationValue01: score.deEscalationValue01,
    confidence01: score.confidence01,
    liveopsBoost01: score.liveopsBoost01,
    escalationRatchet01: score.escalationRatchet01,
    pileOnAmplifiedRisk01: score.pileOnAmplifiedRisk01,
    trendDirection: score.trendDirection,
    shouldIntercept: score.shouldIntercept,
    isHighBlastPublic: score.isHighBlastPublic,
    shouldHardBlock: score.shouldHardBlock,
    shouldQuarantine: score.shouldQuarantine,
    shouldShadowRoute: score.shouldShadowRoute,
    topFactor: score.explanation[0]?.key ?? null,
    topFactorDelta: score.explanation[0]?.signedDelta01 ?? null,
    evidenceTags: rows ? evidenceTagDigest(rows) : null,
  });
}

/**
 * Derives a prior state from a score for persistence, with all required fields.
 * Equivalent to `model.toPriorState(score)` but usable without an instance.
 */
export function derivePriorStateToxicity(score: ToxicityRiskScore): ToxicityRiskPriorState {
  return {
    toxicity01: score.toxicity01,
    escalation01: score.escalation01,
    moderationSensitivity01: score.moderationSensitivity01,
    shadowRoute01: score.shadowRoute01,
    generatedAt: score.generatedAt,
  };
}

/**
 * Scores a ChatOnlineInferenceWindow without constructing a full store, using
 * `aggregateOnlineFeatureWindow` to produce a stable row window for scoring.
 * Provides a lightweight path for inference-time pipeline stages.
 */
export function scoreWindowBatch(params: {
  windows: readonly ChatOnlineInferenceWindow[];
  options?: ToxicityRiskModelOptions;
  engagementScore?: Nullable<EngagementModelScore>;
  haterScore?: Nullable<HaterTargetingScore>;
  helperScore?: Nullable<HelperTimingScore>;
  channelScore?: Nullable<ChannelAffinityScore>;
}): { results: ToxicityRiskBatchResult[]; stats: ToxicityBatchStats | null } {
  const model = createToxicityRiskModel(params.options);
  const inputs = params.windows.map((window) => {
    const aggregate = aggregateOnlineFeatureWindow(window.latestRow ? [window.latestRow] : []);
    // Use windowPickScalar for any scalar derived from the inference window's
    // scalarFeatures that may not be present in the aggregate
    const freshnessOverride = windowPickScalar(window, 'freshnessMs', 0);
    void freshnessOverride; // folded into aggregate.rows
    return deriveToxicityInputFromAggregate({
      aggregate,
      engagementScore: params.engagementScore,
      haterScore: params.haterScore,
      helperScore: params.helperScore,
      channelScore: params.channelScore,
    });
  });
  return model.scoreBatch({ inputs });
}

export const CHAT_TOXICITY_RISK_MODEL_NAMESPACE = Object.freeze({
  moduleName: CHAT_TOXICITY_RISK_MODEL_MODULE_NAME,
  moduleVersion: CHAT_TOXICITY_RISK_MODEL_VERSION,
  runtimeLaws: CHAT_TOXICITY_RISK_MODEL_RUNTIME_LAWS,
  defaults: CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
  // factory
  createToxicityRiskModel,
  // batch scoring
  scoreToxicityRiskAggregate,
  scoreToxicityRiskStore,
  scoreToxicityRiskRows,
  scoreToxicityRiskInferenceWindow,
  scoreWindowBatch,
  // serialization / hydration
  serializeToxicityRiskScore,
  hydratePriorToxicityRiskState,
  derivePriorStateToxicity,
  // predicates
  toxicityIsCritical,
  toxicityNeedsImmediate,
  toxicityIsInPublicCrowd,
  toxicityIsDealRoomCoercion,
  toxicityIsPileOnDriven,
  toxicityIsEscalating,
  toxicityIsCooling,
  toxicityIsLiveopsAmplified,
  // labels
  toxicityBandLabel,
  toxicityRecommendationLabel,
  toxicityTrendLabel,
  // summaries
  toxicityRiskSummary,
  toxicityExplanationSummary,
  toxicityPersonaSummary,
  // sorting and filtering
  toxicityScoreCompare,
  sortToxicityScoresDescending,
  toxicityScoresNeedingAction,
  toxicityScoresCritical,
  toxicityScoresNeedingHardBlock,
  // telemetry
  toxicityConfidence100,
  toxicityScoreToTelemetry,
  // legacy compatibility
  toxicityRiskNeedsHardBlock,
  toxicityRiskNeedsReview,
  toxicityRiskNeedsShadowRoute,
});

export default CHAT_TOXICITY_RISK_MODEL_NAMESPACE;
