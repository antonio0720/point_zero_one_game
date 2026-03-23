/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CHURN RISK MODEL
 * FILE: backend/src/game/engine/chat/ml/ChurnRiskModel.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Explainable backend-authoritative disengagement / churn scoring for the live
 * chat intelligence lane.
 *
 * This file answers a distinct question from engagement:
 *
 *   “How close is this player or room-side conversation posture to withdrawal,
 *    soft drop-off, rage-quit, or emotional disengagement, and what rescue or
 *    dramatic hold recommendation should backend chat pass downstream?”
 *
 * Doctrine
 * --------
 * - This model does not mutate transcript truth.
 * - This model does not force helper speech.
 * - This model does not replace helper timing or moderation policy.
 * - This model does not interpret every silence as danger.
 * - This model does translate authoritative recent features into a durable,
 *   explainable estimate of withdrawal, rage, rescue urgency, and recovery.
 *
 * Why this file is deep
 * ---------------------
 * In Point Zero One, quiet does not always mean drift.
 *
 * A player can go quiet because:
 * - they are locked in and strategically cold,
 * - they are watching a hater telegraph,
 * - they are privately negotiating,
 * - they are humiliated and withdrawing,
 * - they are overloaded by swarm pressure,
 * - they are ignoring helpers on purpose,
 * - they are one interaction away from rage-quitting,
 * - or they are holding composure before a comeback.
 *
 * Therefore churn scoring cannot be “low messages = churn.”
 * It has to model:
 * - withdrawal risk,
 * - rage-quit risk,
 * - rescue urgency,
 * - recovery potential,
 * - helper fatigue and rescue history,
 * - public embarrassment,
 * - hater pressure,
 * - channel fit / mode fit,
 * - and the difference between dramatic hold value versus actual user loss.
 *
 * This model therefore produces:
 * - churn risk,
 * - withdrawal risk,
 * - rage-quit risk,
 * - rescue urgency,
 * - recovery potential,
 * - confidence,
 * - one recommendation surface for helper/orchestration systems,
 * - and a proof-friendly explanation surface.
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
import {
  type ToxicityRiskPriorState,
  type ToxicityRiskScore,
} from './ToxicityRiskModel';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_CHURN_RISK_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_CHURN_RISK_MODEL' as const;

export const CHAT_CHURN_RISK_MODEL_VERSION =
  '2026.03.14-churn-risk-model.v1' as const;

export const CHAT_CHURN_RISK_MODEL_RUNTIME_LAWS = Object.freeze([
  'Silence is interpreted through room, pressure, and channel posture before it becomes churn.',
  'High engagement fragility and humiliation elevate churn faster than low message count alone.',
  'Helper rescue value may reduce recommendation severity but never erase risk.',
  'Deal-room restraint is discounted differently from GLOBAL public collapse.',
  'Rage-quit and quiet withdrawal are modeled separately and then composed.',
  'Recovery potential is scored alongside risk so the backend can choose rescue versus hold.',
  'The model remains advisory; helper timing and orchestration still own final action.',
  'Explainability is mandatory for replay, drift checks, and intervention audit.',
] as const);

export const CHAT_CHURN_RISK_MODEL_DEFAULTS = Object.freeze({
  lowEvidenceFallback01: 0.30,
  baselineBlend01: 0.16,
  withdrawalBlend01: 0.18,
  rageBlend01: 0.16,
  urgencyBlend01: 0.18,
  recoveryBlend01: 0.12,
  lowEvidenceRowCount: 2,
  staleWindowMs: 140_000,
  freshnessFloorMs: 8_000,
  softNudgeThreshold01: 0.36,
  privateRecoveryThreshold01: 0.52,
  publicWitnessThreshold01: 0.60,
  emergencyThreshold01: 0.78,
  holdDramaThreshold01: 0.44,
  rescueHistoryPenalty01: 0.14,
  helperFatiguePenalty01: 0.12,
  comebackPotentialBonus01: 0.08,
  sovereigntyComposureDiscount01: 0.10,
  dealRoomSilenceDiscount01: 0.14,
  syndicateSilenceDiscount01: 0.08,
  globalHumiliationAmplifier01: 0.12,
  maxExplanationFactors: 14,
  // v2 additions — liveops amplifiers
  liveopsInvasionChurnBonus01: 0.10,
  liveopsHaterRaidChurnBonus01: 0.12,
  liveopsWorldEventChurnBonus01: 0.06,
  invasionChaosRageBonus01: 0.08,
  // v2 additions — channel-specific
  syndicateAbandonmentSilenceBonus01: 0.08,
  dealRoomSilentChurnBonus01: 0.10,
  globalHumiliationRageBonus01: 0.10,
  lobbyPublicWithdrawalBonus01: 0.06,
  // v2 additions — bankruptcy / extreme-pressure escalation
  bankruptcySilenceAmplifier01: 0.12,
  bankruptcyRageAmplifier01: 0.14,
  bankruptcyChurnThreshold01: 0.70,
  // v2 additions — prior state blending (prevents scoring whiplash)
  priorStateMaxAgeMs: 180_000,
  priorBlendChurn01: 0.18,
  priorBlendWithdrawal01: 0.16,
  priorBlendRage01: 0.14,
  // v2 additions — trend / rage ratchet
  trendWindowMin: 3,
  rageRatchetThreshold01: 0.58,
  rageRatchetBonus01: 0.10,
  // v2 additions — recovery bonuses
  highComebackBonus01: 0.10,
  helperSuccessRecoveryBonus01: 0.08,
  // v2 additions — audit and observability
  auditTrailEnabled: false,
  batchScoreEmitStats: true,
} as const);

// ============================================================================
// MARK: Ports and options
// ============================================================================

export interface ChurnRiskModelLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChurnRiskModelClockPort {
  now(): UnixMs;
}

export interface ChurnRiskModelOptions {
  readonly logger?: ChurnRiskModelLoggerPort;
  readonly clock?: ChurnRiskModelClockPort;
  readonly defaults?: Partial<typeof CHAT_CHURN_RISK_MODEL_DEFAULTS>;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
}

export interface ChurnRiskModelContext {
  readonly logger: ChurnRiskModelLoggerPort;
  readonly clock: ChurnRiskModelClockPort;
  readonly defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS;
  readonly runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
}

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type ChurnTrendDirection =
  | 'ACCELERATING'
  | 'WORSENING'
  | 'STABLE'
  | 'RECOVERING'
  | 'RESOLVED';

export interface ChurnTrendSignal {
  readonly direction: ChurnTrendDirection;
  readonly deltaPerWindow: number;
  readonly priorChurnRisk01: Score01;
  readonly currentChurnRisk01: Score01;
}

export interface ChurnBatchStats {
  readonly count: number;
  readonly criticalCount: number;
  readonly emergencyCount: number;
  readonly rescueCount: number;
  readonly publicWitnessCount: number;
  readonly holdDramaCount: number;
  readonly meanChurnRisk01: number;
  readonly maxChurnRisk01: number;
  readonly meanWithdrawalRisk01: number;
  readonly meanRageQuitRisk01: number;
  readonly meanRecoveryPotential01: number;
}

export interface ChurnAuditEntry {
  readonly timestamp: UnixMs;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly roomId: Nullable<ChatRoomId>;
  readonly band: ChurnBand;
  readonly recommendation: ChurnRecommendation;
  readonly churnRisk01: Score01;
  readonly withdrawalRisk01: Score01;
  readonly rageQuitRisk01: Score01;
  readonly rescueUrgency01: Score01;
  readonly trendDirection: ChurnTrendDirection;
  readonly topFactor: string;
  readonly channel: ChatVisibleChannel;
}

export interface ChurnHealthReport {
  readonly totalScoredLifetime: number;
  readonly totalCriticalCount: number;
  readonly totalEmergencyCount: number;
  readonly totalRescueCount: number;
  readonly auditLogSize: number;
  readonly meanChurnRisk01: number;
  readonly maxChurnRisk01Lifetime: number;
  readonly meanRageQuitRisk01: number;
}

export type ChurnBand =
  | 'STABLE'
  | 'WATCH'
  | 'ELEVATED'
  | 'HIGH'
  | 'CRITICAL';

export type ChurnRecommendation =
  | 'STABLE_OBSERVE'
  | 'HOLD_DRAMA'
  | 'SOFT_NUDGE'
  | 'PRIVATE_RECOVERY'
  | 'PUBLIC_WITNESS_RESCUE'
  | 'EMERGENCY_SAVE'
  | 'POST_COLLAPSE_DEBRIEF';

export interface ChurnContribution {
  readonly key: string;
  readonly signedDelta01: number;
  readonly reason: string;
}

export interface ChurnRiskModelDiagnostics {
  readonly evidenceRows: number;
  readonly lowEvidence: boolean;
  readonly staleSignal: boolean;
  readonly roomKind: ChatRoomKind | 'UNKNOWN';
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly pressureTier: PressureTier;
  readonly featureFreshnessMs: number;
  readonly modelVersion: typeof CHAT_CHURN_RISK_MODEL_VERSION;
}

export interface ChurnRiskModelInput {
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
  readonly embarrassment01: Score01;
  readonly frustration01: Score01;
  readonly curiosity01: Score01;
  readonly attachment01: Score01;
  readonly confidence01: Score01;
  readonly engagement01: Score01;
  readonly engagementFragility01: Score01;
  readonly responseLikelihood01: Score01;
  readonly helperUrgency01: Score01;
  readonly helperSuppression01: Score01;
  readonly helperDeEscalationValue01: Score01;
  readonly haterPressure01: Score01;
  readonly haterEscalation01: Score01;
  readonly bestChannelScore01: Score01;
  readonly channelMisfit01: Score01;
  readonly toxicity01: Score01;
  readonly toxicityEscalation01: Score01;
  readonly moderationSensitivity01: Score01;
  readonly visibilityExposure01: Score01;
  readonly switchStress01: Score01;
  readonly silence01: Score01;
  readonly ignoredHelper01: Score01;
  readonly rescueHistory01: Score01;
  readonly comebackPotential01: Score01;
  readonly sovereigntyComposure01: Score01;
  readonly negotiationStrain01: Score01;
  readonly messageLengthVolatility01: Score01;
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
  readonly toxicityScore: Nullable<ToxicityRiskScore>;
  readonly toxicityPriorState: Nullable<ToxicityRiskPriorState>;
  readonly sourceSignals: readonly ChatSignalEnvelope[];
}

export interface ChurnRiskScore {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly band: ChurnBand;
  readonly recommendation: ChurnRecommendation;
  readonly churnRisk01: Score01;
  readonly withdrawalRisk01: Score01;
  readonly rageQuitRisk01: Score01;
  readonly rescueUrgency01: Score01;
  readonly recoveryPotential01: Score01;
  readonly confidence01: Score01;
  readonly churnRisk100: Score100;
  readonly withdrawalRisk100: Score100;
  readonly rageQuitRisk100: Score100;
  // v2 additions
  readonly liveopsBoost01: Score01;
  readonly rageRatchet01: Score01;
  readonly trendDirection: ChurnTrendDirection;
  readonly isEmergency: boolean;
  readonly isBankruptcyRage: boolean;
  // flags
  readonly shouldRescue: boolean;
  readonly shouldPublicWitness: boolean;
  readonly shouldHoldDrama: boolean;
  readonly explanation: readonly ChurnContribution[];
  readonly diagnostics: ChurnRiskModelDiagnostics;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ChurnRiskBatchResult {
  readonly input: ChurnRiskModelInput;
  readonly score: ChurnRiskScore;
  readonly stats?: ChurnBatchStats;
}

export interface ChurnRiskPriorState {
  readonly churnRisk01: Score01;
  readonly withdrawalRisk01: Score01;
  readonly rageQuitRisk01: Score01;
  readonly rescueUrgency01: Score01;
  readonly generatedAt: UnixMs;
}

// ============================================================================
// MARK: Defaults and helpers
// ============================================================================

const DEFAULT_LOGGER: ChurnRiskModelLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLOCK: ChurnRiskModelClockPort = {
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
    return 'BUILDING' as PressureTier;
  }
  return value as PressureTier;
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

function normalizeFreshness01(freshnessMs: number, defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS): Score01 {
  if (freshnessMs <= defaults.freshnessFloorMs) return clamp01(1);
  return clamp01(1 - freshnessMs / Math.max(defaults.staleWindowMs, 1));
}

function evidencePenalty(evidenceRows: number, defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS): Score01 {
  if (evidenceRows >= defaults.lowEvidenceRowCount) return clamp01(0);
  return clamp01((defaults.lowEvidenceRowCount - evidenceRows) / Math.max(defaults.lowEvidenceRowCount, 1));
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

function factor(key: string, signedDelta01: number, reason: string): ChurnContribution {
  return {
    key,
    signedDelta01: clampSigned01(signedDelta01),
    reason,
  };
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

function latestRowOfFamily(rows: readonly ChatFeatureRow[], family: string): ChatFeatureRow | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index]?.family === family) return rows[index];
  }
  return null;
}

function featureSnapshotFromRows(rows: readonly ChatFeatureRow[]): Nullable<ChatFeatureSnapshot> {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const snapshot = rows[index]?.canonicalSnapshot;
    if (snapshot) return snapshot;
  }
  return null;
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

function channelBestScore(channelScore: Nullable<ChannelAffinityScore>): Score01 {
  if (!channelScore) return clamp01(0.5);
  const key = channelScore.recommendedPrimaryChannel;
  const fromRank = safeNumber(channelScore.scores?.[key], NaN);
  if (Number.isFinite(fromRank)) return clamp01(fromRank);
  return clamp01(channelScore.activeChannelFitness01);
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

function engagementConfidenceScore(engagementScore: Nullable<EngagementModelScore>): Score01 {
  if (!engagementScore) return clamp01(0.5);
  return clamp01(
    engagementScore.continuity01 * 0.34 +
      engagementScore.quality01 * 0.34 +
      engagementScore.responseLikelihood01 * 0.20 +
      (1 - engagementScore.fragility01) * 0.12,
  );
}

function roomSilenceDiscount(input: {
  roomKind: ChatRoomKind | 'UNKNOWN';
  activeVisibleChannel: ChatVisibleChannel;
}, defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS): number {
  if (input.activeVisibleChannel === ('DEAL_ROOM' as ChatVisibleChannel) || input.roomKind === 'DEAL_ROOM') {
    return defaults.dealRoomSilenceDiscount01;
  }
  if (input.activeVisibleChannel === ('SYNDICATE' as ChatVisibleChannel) || input.roomKind === 'SYNDICATE') {
    return defaults.syndicateSilenceDiscount01;
  }
  return 0;
}

function deriveChurnInputFromRows(params: {
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
  toxicityScore?: Nullable<ToxicityRiskScore>;
  toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ChurnRiskModelInput {
  const rows = params.rows ?? [];
  const latest = rows.at(-1) ?? null;
  const online = latestRowOfFamily(rows, 'ONLINE_CONTEXT');
  const engagement = latestRowOfFamily(rows, 'ENGAGEMENT');
  const hater = latestRowOfFamily(rows, 'HATER_TARGETING');
  const helper = latestRowOfFamily(rows, 'HELPER_TIMING');
  const channel = latestRowOfFamily(rows, 'CHANNEL_AFFINITY');
  const churn = latestRowOfFamily(rows, 'CHURN');
  const toxicity = latestRowOfFamily(rows, 'TOXICITY');
  const scalars = buildScalarMap(rows);
  const signals = uniqueSignals(params.signals ?? []);
  const featureSnapshot = featureSnapshotFromRows(rows);

  const roomId = latest?.roomId ?? null;
  const sessionId = latest?.sessionId ?? null;
  const userId = latest?.userId ?? null;
  const roomKind = pickRoomKind(rowCategory(online, 'roomKind', 'UNKNOWN'));
  const activeVisibleChannel = pickVisibleChannel(rowCategory(online, 'activeVisibleChannel', latest?.channelId ?? 'GLOBAL'));
  const pressureTier = pickPressureTier(rowCategory(online, 'pressureTier', 'BUILDING'));
  const freshnessMs = Math.max(0, safeNumber(params.generatedAt) - safeNumber(latest?.generatedAt, params.generatedAt));

  return {
    generatedAt: params.generatedAt,
    roomId,
    sessionId,
    userId,
    roomKind,
    activeVisibleChannel,
    pressureTier,
    roomHeat01: clamp01(scalars.roomHeat01 ?? rowScalar(online, 'roomHeat01')),
    hostileMomentum01: clamp01(scalars.hostileMomentum01 ?? rowScalar(hater, 'hostileMomentum01')),
    negativeSwarm01: clamp01(scalars.negativeSwarm01 ?? rowScalar(hater, 'negativeSwarm01')),
    ridiculeExposure01: clamp01(scalars.ridiculeExposure01 ?? rowScalar(online, 'ridiculeExposure01')),
    intimidation01: clamp01(scalars.intimidation01 ?? rowScalar(engagement, 'intimidation01')),
    embarrassment01: clamp01(scalars.embarrassment01 ?? rowScalar(engagement, 'embarrassment01')),
    frustration01: clamp01(scalars.frustration01 ?? rowScalar(engagement, 'frustration01')),
    curiosity01: clamp01(scalars.curiosity01 ?? rowScalar(engagement, 'curiosity01')),
    attachment01: clamp01(scalars.attachment01 ?? rowScalar(engagement, 'attachment01')),
    confidence01: clamp01(engagementConfidenceScore(params.engagementScore) ?? rowScalar(engagement, 'confidence01', 0.5)),
    engagement01: clamp01(params.engagementScore?.engagement01 ?? rowScalar(engagement, 'engagement01')),
    engagementFragility01: clamp01(params.engagementScore?.fragility01 ?? rowScalar(engagement, 'fragility01')),
    responseLikelihood01: clamp01(params.engagementScore?.responseLikelihood01 ?? rowScalar(engagement, 'responseLikelihood01')),
    helperUrgency01: clamp01(params.helperScore?.urgency01 ?? rowScalar(helper, 'urgency01')),
    helperSuppression01: clamp01(params.helperScore?.suppression01 ?? rowScalar(helper, 'suppression01')),
    helperDeEscalationValue01: clamp01(helperDeEscalationScore(params.helperScore) ?? rowScalar(helper, 'deEscalationValue01')),
    haterPressure01: clamp01(params.haterScore?.targeting01 ?? rowScalar(hater, 'targeting01')),
    haterEscalation01: clamp01(haterEscalationScore(params.haterScore) ?? rowScalar(hater, 'escalation01')),
    bestChannelScore01: clamp01(channelBestScore(params.channelScore)),
    channelMisfit01: clamp01(1 - (channelBestScore(params.channelScore))),
    toxicity01: clamp01(params.toxicityScore?.toxicity01 ?? rowScalar(toxicity, 'toxicity01')),
    toxicityEscalation01: clamp01(params.toxicityScore?.escalation01 ?? rowScalar(toxicity, 'escalation01')),
    moderationSensitivity01: clamp01(params.toxicityScore?.moderationSensitivity01 ?? rowScalar(toxicity, 'moderationSensitivity01')),
    visibilityExposure01: clamp01(scalars.visibilityExposure01 ?? rowScalar(channel, 'visibilityExposure01')),
    switchStress01: clamp01(scalars.switchStress01 ?? rowScalar(channel, 'switchStress01')),
    silence01: clamp01(scalars.silence01 ?? rowScalar(online, 'silence01')),
    ignoredHelper01: clamp01(scalars.ignoredHelper01 ?? rowScalar(helper, 'ignoredHelper01')),
    rescueHistory01: clamp01(scalars.rescueHistory01 ?? rowScalar(churn, 'rescueHistory01')),
    comebackPotential01: clamp01(scalars.comebackPotential01 ?? rowScalar(engagement, 'comebackPotential01')),
    sovereigntyComposure01: clamp01(scalars.sovereigntyComposure01 ?? rowScalar(engagement, 'sovereigntyComposure01')),
    negotiationStrain01: clamp01(scalars.negotiationStrain01 ?? rowScalar(channel, 'negotiationStrain01')),
    messageLengthVolatility01: clamp01(scalars.messageLengthVolatility01 ?? rowScalar(online, 'messageLengthVolatility01')),
    evidenceRows: rows.length,
    freshnessMs,
    featureSnapshot,
    affectSnapshot: affectSnapshotFromSignals(signals),
    learningProfile: learningProfileFromSignals(signals),
    engagementScore: params.engagementScore ?? null,
    engagementPriorState: params.engagementPriorState ?? null,
    haterScore: params.haterScore ?? null,
    haterPriorState: params.haterPriorState ?? null,
    helperScore: params.helperScore ?? null,
    helperPriorState: params.helperPriorState ?? null,
    channelScore: params.channelScore ?? null,
    channelPriorState: params.channelPriorState ?? null,
    toxicityScore: params.toxicityScore ?? null,
    toxicityPriorState: params.toxicityPriorState ?? null,
    sourceSignals: signals,
  };
}

function deriveChurnInputFromAggregate(params: {
  aggregate: ChatOnlineFeatureAggregate;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  toxicityScore?: Nullable<ToxicityRiskScore>;
  toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ChurnRiskModelInput {
  return deriveChurnInputFromRows({
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
    toxicityScore: params.toxicityScore,
    toxicityPriorState: params.toxicityPriorState,
    signals: params.signals,
  });
}

function deriveChurnInputFromInferenceWindow(params: {
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
  toxicityScore?: Nullable<ToxicityRiskScore>;
  toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ChurnRiskModelInput {
  const synthetic = params.window.latestRow ? [params.window.latestRow] : [];
  return deriveChurnInputFromRows({
    rows: params.rows?.length ? params.rows : synthetic,
    generatedAt: params.window.generatedAt,
    engagementScore: params.engagementScore,
    engagementPriorState: params.engagementPriorState,
    haterScore: params.haterScore,
    haterPriorState: params.haterPriorState,
    helperScore: params.helperScore,
    helperPriorState: params.helperPriorState,
    channelScore: params.channelScore,
    channelPriorState: params.channelPriorState,
    toxicityScore: params.toxicityScore,
    toxicityPriorState: params.toxicityPriorState,
    signals: params.signals,
  });
}

// ============================================================================
// MARK: Scoring helpers
// ============================================================================

function scoreWithdrawalRisk(input: ChurnRiskModelInput, defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS): Score01 {
  const silenceDiscount = roomSilenceDiscount(input, defaults);
  return clamp01(
    input.silence01 * 0.22 +
      input.engagementFragility01 * 0.16 +
      input.embarrassment01 * 0.14 +
      input.intimidation01 * 0.10 +
      input.frustration01 * 0.10 +
      input.channelMisfit01 * 0.08 +
      input.ignoredHelper01 * 0.10 +
      input.visibilityExposure01 * 0.06 +
      input.negotiationStrain01 * 0.04 -
      silenceDiscount -
      input.curiosity01 * 0.06 -
      input.attachment01 * 0.04,
  );
}

function scoreRageQuitRisk(input: ChurnRiskModelInput): Score01 {
  return clamp01(
    input.frustration01 * 0.22 +
      input.haterEscalation01 * 0.18 +
      input.negativeSwarm01 * 0.14 +
      input.toxicityEscalation01 * 0.14 +
      input.moderationSensitivity01 * 0.08 +
      input.switchStress01 * 0.08 +
      input.ridiculeExposure01 * 0.10 +
      input.visibilityExposure01 * 0.06,
  );
}

function scoreRescueUrgency(
  withdrawalRisk01: Score01,
  rageQuitRisk01: Score01,
  input: ChurnRiskModelInput,
  defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS,
): Score01 {
  return clamp01(
    withdrawalRisk01 * 0.28 +
      rageQuitRisk01 * 0.24 +
      input.helperUrgency01 * 0.10 +
      input.toxicity01 * 0.08 +
      input.haterPressure01 * 0.10 +
      input.ignoredHelper01 * 0.10 +
      input.engagementFragility01 * 0.10 -
      input.helperSuppression01 * 0.06 -
      input.comebackPotential01 * defaults.comebackPotentialBonus01,
  );
}

function scoreRecoveryPotential(input: ChurnRiskModelInput): Score01 {
  return clamp01(
    input.helperDeEscalationValue01 * 0.26 +
      input.curiosity01 * 0.14 +
      input.attachment01 * 0.14 +
      input.confidence01 * 0.10 +
      input.comebackPotential01 * 0.14 +
      input.bestChannelScore01 * 0.08 +
      (1 - input.haterEscalation01) * 0.06 +
      (1 - input.toxicityEscalation01) * 0.08,
  );
}

function scoreChurnCore(
  withdrawalRisk01: Score01,
  rageQuitRisk01: Score01,
  rescueUrgency01: Score01,
  recoveryPotential01: Score01,
  input: ChurnRiskModelInput,
  defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS,
): Score01 {
  const roomDiscount = roomSilenceDiscount(input, defaults);
  const sovereigntyDiscount = input.sovereigntyComposure01 * defaults.sovereigntyComposureDiscount01;
  const globalHumiliationAmplifier =
    input.activeVisibleChannel === ('GLOBAL' as ChatVisibleChannel)
      ? maxOf([input.embarrassment01, input.ridiculeExposure01]) * defaults.globalHumiliationAmplifier01
      : 0;
  const rescuePenalty = input.rescueHistory01 * defaults.rescueHistoryPenalty01;
  const helperFatiguePenalty = input.helperSuppression01 * defaults.helperFatiguePenalty01;
  return clamp01(
    withdrawalRisk01 * 0.32 +
      rageQuitRisk01 * 0.24 +
      rescueUrgency01 * defaults.urgencyBlend01 +
      input.channelMisfit01 * 0.06 +
      input.toxicity01 * 0.06 +
      input.visibilityExposure01 * 0.04 -
      recoveryPotential01 * defaults.recoveryBlend01 -
      roomDiscount -
      sovereigntyDiscount +
      globalHumiliationAmplifier +
      rescuePenalty +
      helperFatiguePenalty,
  );
}

function computeConfidence01(input: ChurnRiskModelInput, defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS): Score01 {
  const freshness01 = normalizeFreshness01(input.freshnessMs, defaults);
  const evidence01 = 1 - evidencePenalty(input.evidenceRows, defaults);
  const coherence01 = average([
    input.bestChannelScore01,
    clamp01(1 - input.channelMisfit01),
    clamp01(1 - input.switchStress01),
    input.confidence01,
  ]);
  return clamp01(freshness01 * 0.42 + evidence01 * 0.34 + coherence01 * 0.24);
}

function pickBand(value01: Score01): ChurnBand {
  if (value01 >= 0.86) return 'CRITICAL';
  if (value01 >= 0.68) return 'HIGH';
  if (value01 >= 0.48) return 'ELEVATED';
  if (value01 >= 0.26) return 'WATCH';
  return 'STABLE';
}

function pickRecommendation(params: {
  churnRisk01: Score01;
  rescueUrgency01: Score01;
  recoveryPotential01: Score01;
  withdrawalRisk01: Score01;
  rageQuitRisk01: Score01;
  input: ChurnRiskModelInput;
  defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS;
}): ChurnRecommendation {
  const {
    churnRisk01,
    rescueUrgency01,
    recoveryPotential01,
    withdrawalRisk01,
    rageQuitRisk01,
    input,
    defaults,
  } = params;

  if (rescueUrgency01 >= defaults.emergencyThreshold01 || rageQuitRisk01 >= defaults.emergencyThreshold01) {
    return 'EMERGENCY_SAVE';
  }
  if (
    rescueUrgency01 >= defaults.publicWitnessThreshold01 &&
    input.activeVisibleChannel === ('GLOBAL' as ChatVisibleChannel) &&
    input.visibilityExposure01 >= 0.52
  ) {
    return 'PUBLIC_WITNESS_RESCUE';
  }
  if (churnRisk01 >= defaults.privateRecoveryThreshold01) {
    return 'PRIVATE_RECOVERY';
  }
  if (churnRisk01 >= defaults.holdDramaThreshold01 && recoveryPotential01 >= 0.54 && input.helperSuppression01 >= 0.36) {
    return 'HOLD_DRAMA';
  }
  if (withdrawalRisk01 >= defaults.softNudgeThreshold01 || rageQuitRisk01 >= defaults.softNudgeThreshold01) {
    return 'SOFT_NUDGE';
  }
  if (churnRisk01 >= 0.22 && recoveryPotential01 >= 0.48) {
    return 'POST_COLLAPSE_DEBRIEF';
  }
  return 'STABLE_OBSERVE';
}

function buildExplanation(
  input: ChurnRiskModelInput,
  score: {
    churnRisk01: Score01;
    withdrawalRisk01: Score01;
    rageQuitRisk01: Score01;
    rescueUrgency01: Score01;
    recoveryPotential01: Score01;
  },
  defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS,
): readonly ChurnContribution[] {
  const factors: ChurnContribution[] = [
    factor('silence', input.silence01 * 0.20, 'Sustained silence raises withdrawal concern after normalization by room/channel.'),
    factor('engagement_fragility', input.engagementFragility01 * 0.22, 'Brittle engagement is a strong precursor to disengagement.'),
    factor('frustration', input.frustration01 * 0.18, 'Frustration raises both rage and silent exit risk.'),
    factor('embarrassment', input.embarrassment01 * 0.18, 'Public embarrassment accelerates withdrawal, especially under witness exposure.'),
    factor('negative_swarm', input.negativeSwarm01 * 0.16, 'Swarm hostility compounds social overwhelm.'),
    factor('hater_escalation', input.haterEscalation01 * 0.18, 'Escalating hater pressure increases rage-quit risk.'),
    factor('helper_ignore', input.ignoredHelper01 * 0.14, 'Repeated ignored rescue attempts imply intervention fatigue or active retreat.'),
    factor('channel_misfit', input.channelMisfit01 * 0.10, 'Poor channel fit makes players feel out of place or exposed.'),
    factor('toxicity', input.toxicity01 * 0.12, 'Toxic posture reduces player willingness to remain present.'),
    factor('recovery_potential', -score.recoveryPotential01 * 0.16, 'Recovery signals reduce net churn severity.'),
    factor('comeback_potential', -input.comebackPotential01 * defaults.comebackPotentialBonus01, 'Comeback potential offsets immediate loss if the player can still recover.'),
    factor('sovereignty_composure', -input.sovereigntyComposure01 * defaults.sovereigntyComposureDiscount01, 'Cold composure near high-stakes play is not automatically churn.'),
    factor('helper_de_escalation', -input.helperDeEscalationValue01 * 0.10, 'Helper recovery value lowers downstream intervention severity.'),
    factor('visibility_exposure', input.visibilityExposure01 * 0.08, 'Highly visible failure states are harder for players to absorb quietly.'),
  ];

  return factors
    .sort((a, b) => Math.abs(b.signedDelta01) - Math.abs(a.signedDelta01))
    .slice(0, defaults.maxExplanationFactors);
}

// ============================================================================
// MARK: v2 scoring helpers — liveops, bankruptcy, channel, ratchet, trend
// ============================================================================

/**
 * Computes a liveops-driven churn amplification bonus.
 * Invasion creates cover for mass-abandonment; hater raids create pile-on rage-quit spikes.
 */
function computeLiveopsChurnBoost01(
  input: ChurnRiskModelInput,
  defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS,
): Score01 {
  const hasInvasion = input.sourceSignals.some(
    (s) => (s as unknown as Record<string, unknown>)?.liveops &&
      ((s as unknown as Record<string, unknown>).liveops as Record<string, unknown>)?.invasionActive,
  );
  const hasRaid = input.sourceSignals.some(
    (s) => (s as unknown as Record<string, unknown>)?.liveops &&
      ((s as unknown as Record<string, unknown>).liveops as Record<string, unknown>)?.haterRaidActive,
  );
  const hasWorldEvent = input.sourceSignals.some(
    (s) => (s as unknown as Record<string, unknown>)?.liveops &&
      ((s as unknown as Record<string, unknown>).liveops as Record<string, unknown>)?.worldEventActive,
  );
  let bonus = clamp01(0);
  if (hasInvasion) {
    bonus = clamp01(
      bonus +
        input.hostileMomentum01 * defaults.liveopsInvasionChurnBonus01 * 0.6 +
        input.frustration01 * defaults.invasionChaosRageBonus01 * 0.5,
    );
  }
  if (hasRaid) {
    bonus = clamp01(
      bonus +
        input.haterPressure01 * defaults.liveopsHaterRaidChurnBonus01 * 0.8 +
        input.negativeSwarm01 * defaults.liveopsHaterRaidChurnBonus01 * 0.5,
    );
  }
  if (hasWorldEvent) {
    bonus = clamp01(bonus + input.roomHeat01 * defaults.liveopsWorldEventChurnBonus01 * 0.4);
  }
  return bonus;
}

/**
 * Computes channel-specific churn amplifiers. DEAL_ROOM silent churn is different
 * from GLOBAL public humiliation. Syndicate abandonment is quiet but has high
 * trust-damage multipliers.
 */
function computeChannelChurnAmplifier01(
  input: ChurnRiskModelInput,
  defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS,
): Score01 {
  switch (input.activeVisibleChannel as string) {
    case 'DEAL_ROOM':
      return clamp01(
        input.silence01 * defaults.dealRoomSilentChurnBonus01 +
          input.negotiationStrain01 * 0.08,
      );
    case 'SYNDICATE':
      return clamp01(
        input.silence01 * defaults.syndicateAbandonmentSilenceBonus01 +
          input.ignoredHelper01 * 0.06,
      );
    case 'GLOBAL':
      return clamp01(
        maxOf([input.embarrassment01, input.ridiculeExposure01]) * defaults.globalHumiliationRageBonus01,
      );
    case 'LOBBY':
      return clamp01(input.negativeSwarm01 * defaults.lobbyPublicWithdrawalBonus01);
    default:
      return clamp01(0);
  }
}

/**
 * Bankruptcy amplifier: when the player is in a bankruptcy economic state,
 * both silence (withdrawal) and frustration (rage) are amplified because the
 * stakes are highest and cognitive load prevents re-engagement.
 */
function computeBankruptcyChurnAmplifier01(
  input: ChurnRiskModelInput,
  defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS,
): Score01 {
  const hasBankruptcy = input.sourceSignals.some(
    (s) => {
      const economy = ((s as unknown as Record<string, unknown>).economy) as Record<string, unknown> | undefined;
      return economy?.bankruptcyRisk !== undefined && (economy.bankruptcyRisk as number) >= 0.7;
    },
  );
  if (!hasBankruptcy) return clamp01(0);
  return clamp01(
    input.silence01 * defaults.bankruptcySilenceAmplifier01 +
      input.frustration01 * defaults.bankruptcyRageAmplifier01,
  );
}

/**
 * Rage ratchet: if the prior state was already above the rage threshold,
 * a self-reinforcing ratchet prevents premature score recovery unless
 * there is genuine positive evidence.
 */
function computeRageRatchet01(
  rageQuitRisk01: Score01,
  prior: Nullable<ChurnRiskPriorState>,
  defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS,
): Score01 {
  if (!prior) return clamp01(0);
  const priorRage = prior.rageQuitRisk01;
  if (priorRage < defaults.rageRatchetThreshold01) return clamp01(0);
  const ratchet = (priorRage - rageQuitRisk01) * defaults.rageRatchetBonus01;
  return clamp01(Math.max(0, ratchet));
}

/**
 * Prior state blending: mixes current churn risk with prior to prevent
 * whiplash. Stale priors (older than priorStateMaxAgeMs) are ignored.
 */
function blendWithPriorChurn(
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
 * Derives a trend direction from current churn risk vs prior state.
 */
function computeChurnTrend(
  currentChurnRisk01: Score01,
  prior: Nullable<ChurnRiskPriorState>,
  nowMs: UnixMs,
  defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS,
): ChurnTrendDirection {
  if (!prior) return 'STABLE';
  const ageMs = Math.max(0, nowMs - prior.generatedAt);
  if (ageMs > defaults.priorStateMaxAgeMs) return 'STABLE';
  const delta = currentChurnRisk01 - prior.churnRisk01;
  if (delta >= 0.14) return 'ACCELERATING';
  if (delta >= 0.07) return 'WORSENING';
  if (delta <= -0.14) return 'RESOLVED';
  if (delta <= -0.07) return 'RECOVERING';
  return 'STABLE';
}

/**
 * High-comeback recovery bonus: if comeback potential is high and helper
 * de-escalation value is strong, the recovery score receives a meaningful
 * additive boost — this is what separates "dramatic hold" from pure churn.
 */
function computeHighComebackBonus01(
  input: ChurnRiskModelInput,
  defaults: typeof CHAT_CHURN_RISK_MODEL_DEFAULTS,
): Score01 {
  if (input.comebackPotential01 < 0.6 || input.helperDeEscalationValue01 < 0.4) return clamp01(0);
  return clamp01(
    input.comebackPotential01 * defaults.highComebackBonus01 +
      input.helperDeEscalationValue01 * defaults.helperSuccessRecoveryBonus01,
  );
}

/**
 * Uses `aggregateOnlineFeatureWindow` to build an aggregate from a raw inference
 * window slice, enabling the model to accept window data directly in batch paths.
 */
function churnInputFromWindow(
  inferenceWindow: ChatOnlineInferenceWindow,
  params: Omit<Parameters<typeof deriveChurnInputFromRows>[0], 'rows' | 'generatedAt'>,
): ChurnRiskModelInput {
  const synthetic = inferenceWindow.latestRow ? [inferenceWindow.latestRow] : [];
  const aggregate = aggregateOnlineFeatureWindow(synthetic);
  return deriveChurnInputFromAggregate({ aggregate, ...params });
}

// ============================================================================
// MARK: Model implementation
// ============================================================================

export class ChurnRiskModel {
  private readonly context: ChurnRiskModelContext;

  // Health counters — lifetime totals for observability dashboards
  private totalScoredLifetime = 0;
  private totalChurnRisk01Sum = 0;
  private maxChurnRisk01Lifetime = 0;
  private totalRageQuitRisk01Sum = 0;
  private totalCriticalCount = 0;
  private totalEmergencyCount = 0;
  private totalRescueCount = 0;
  private readonly auditLog: ChurnAuditEntry[] = [];

  public constructor(options: ChurnRiskModelOptions = {}) {
    this.context = {
      logger: options.logger ?? DEFAULT_LOGGER,
      clock: options.clock ?? DEFAULT_CLOCK,
      defaults: Object.freeze({
        ...CHAT_CHURN_RISK_MODEL_DEFAULTS,
        ...(options.defaults ?? {}),
      }),
      runtime: mergeRuntimeConfig(options.runtimeOverride),
    };
  }

  public getContext(): ChurnRiskModelContext {
    return this.context;
  }

  public score(input: ChurnRiskModelInput, prior?: Nullable<ChurnRiskPriorState>): ChurnRiskScore {
    const defaults = this.context.defaults;
    const nowMs = this.context.clock.now();
    const lowEvidence01 = evidencePenalty(input.evidenceRows, defaults);
    const freshness01 = normalizeFreshness01(input.freshnessMs, defaults);

    const withdrawalRisk01Raw = scoreWithdrawalRisk(input, defaults);
    const rageQuitRisk01Raw = scoreRageQuitRisk(input);
    const rescueUrgency01Raw = scoreRescueUrgency(withdrawalRisk01Raw, rageQuitRisk01Raw, input, defaults);
    const recoveryPotential01Raw = scoreRecoveryPotential(input);

    // v2: liveops, channel, bankruptcy amplifiers
    const liveopsBoost01 = computeLiveopsChurnBoost01(input, defaults);
    const channelAmplifier01 = computeChannelChurnAmplifier01(input, defaults);
    const bankruptcyAmplifier01 = computeBankruptcyChurnAmplifier01(input, defaults);
    const comebackBonus01 = computeHighComebackBonus01(input, defaults);

    const rawChurnRisk01 = scoreChurnCore(
      withdrawalRisk01Raw,
      rageQuitRisk01Raw,
      rescueUrgency01Raw,
      recoveryPotential01Raw,
      input,
      defaults,
    );

    // Apply all amplifiers and freshness
    const amplifiedChurnRisk01 = clamp01(
      rawChurnRisk01 * freshness01 +
        defaults.lowEvidenceFallback01 * lowEvidence01 * 0.28 +
        liveopsBoost01 * 0.7 +
        channelAmplifier01 * 0.8 +
        bankruptcyAmplifier01 * 0.6,
    );

    // v2: prior-state blending prevents scoring whiplash
    const priorAgeMs = prior ? Math.max(0, nowMs - prior.generatedAt) : Infinity;
    const churnRisk01 = prior
      ? blendWithPriorChurn(amplifiedChurnRisk01, prior.churnRisk01, defaults.priorBlendChurn01, priorAgeMs, defaults.priorStateMaxAgeMs)
      : amplifiedChurnRisk01;
    const withdrawalRisk01 = prior
      ? blendWithPriorChurn(withdrawalRisk01Raw, prior.withdrawalRisk01, defaults.priorBlendWithdrawal01, priorAgeMs, defaults.priorStateMaxAgeMs)
      : withdrawalRisk01Raw;
    const rageQuitRisk01 = prior
      ? blendWithPriorChurn(rageQuitRisk01Raw, prior.rageQuitRisk01, defaults.priorBlendRage01, priorAgeMs, defaults.priorStateMaxAgeMs)
      : rageQuitRisk01Raw;

    // v2: rage ratchet prevents premature rage recovery
    const rageRatchet01 = computeRageRatchet01(rageQuitRisk01, prior ?? null, defaults);
    const rageQuitRisk01Final = clamp01(rageQuitRisk01 + rageRatchet01);

    // v2: recovery adjusted by comeback bonus
    const recoveryPotential01 = clamp01(recoveryPotential01Raw + comebackBonus01);
    const rescueUrgency01 = clamp01(rescueUrgency01Raw + rageRatchet01 * 0.4);

    const confidence01 = computeConfidence01(input, defaults);

    // v2: trend direction from prior state
    const trendDirection = computeChurnTrend(churnRisk01, prior ?? null, nowMs, defaults);

    // v2: semantic flags
    const isEmergency = rescueUrgency01 >= defaults.emergencyThreshold01 || rageQuitRisk01Final >= defaults.emergencyThreshold01;
    const isBankruptcyRage = bankruptcyAmplifier01 > 0 && rageQuitRisk01Final >= defaults.rageRatchetThreshold01;

    const recommendation = pickRecommendation({
      churnRisk01,
      rescueUrgency01,
      recoveryPotential01,
      withdrawalRisk01,
      rageQuitRisk01: rageQuitRisk01Final,
      input,
      defaults,
    });
    const band = pickBand(churnRisk01);
    const explanation = buildExplanation(
      input,
      {
        churnRisk01,
        withdrawalRisk01,
        rageQuitRisk01: rageQuitRisk01Final,
        rescueUrgency01,
        recoveryPotential01,
      },
      defaults,
    );

    const diagnostics: ChurnRiskModelDiagnostics = {
      evidenceRows: input.evidenceRows,
      lowEvidence: input.evidenceRows < defaults.lowEvidenceRowCount,
      staleSignal: input.freshnessMs > defaults.staleWindowMs,
      roomKind: input.roomKind,
      activeVisibleChannel: input.activeVisibleChannel,
      pressureTier: input.pressureTier,
      featureFreshnessMs: input.freshnessMs,
      modelVersion: CHAT_CHURN_RISK_MODEL_VERSION,
    };

    const shouldRescue = recommendation !== 'STABLE_OBSERVE' && recommendation !== 'HOLD_DRAMA';
    const shouldPublicWitness = recommendation === 'PUBLIC_WITNESS_RESCUE';
    const shouldHoldDrama = recommendation === 'HOLD_DRAMA';

    const score: ChurnRiskScore = {
      generatedAt: input.generatedAt,
      roomId: input.roomId,
      sessionId: input.sessionId,
      userId: input.userId,
      band,
      recommendation,
      churnRisk01,
      withdrawalRisk01,
      rageQuitRisk01: rageQuitRisk01Final,
      rescueUrgency01,
      recoveryPotential01,
      confidence01,
      churnRisk100: clamp100(churnRisk01 * 100),
      withdrawalRisk100: clamp100(withdrawalRisk01 * 100),
      rageQuitRisk100: clamp100(rageQuitRisk01Final * 100),
      liveopsBoost01,
      rageRatchet01,
      trendDirection,
      isEmergency,
      isBankruptcyRage,
      shouldRescue,
      shouldPublicWitness,
      shouldHoldDrama,
      explanation,
      diagnostics,
      metadata: Object.freeze({
        moduleName: CHAT_CHURN_RISK_MODEL_MODULE_NAME,
        moduleVersion: CHAT_CHURN_RISK_MODEL_VERSION,
        engagement01: input.engagement01,
        engagementFragility01: input.engagementFragility01,
        helperDeEscalationValue01: input.helperDeEscalationValue01,
        haterPressure01: input.haterPressure01,
        toxicity01: input.toxicity01,
        bestChannelScore01: input.bestChannelScore01,
      }),
    };

    // Update health counters
    this.totalScoredLifetime += 1;
    this.totalChurnRisk01Sum += churnRisk01;
    if (churnRisk01 > this.maxChurnRisk01Lifetime) this.maxChurnRisk01Lifetime = churnRisk01;
    this.totalRageQuitRisk01Sum += rageQuitRisk01Final;
    if (band === 'CRITICAL') this.totalCriticalCount += 1;
    if (isEmergency) this.totalEmergencyCount += 1;
    if (shouldRescue) this.totalRescueCount += 1;

    // Audit trail
    if (defaults.auditTrailEnabled) {
      this.auditLog.push({
        timestamp: nowMs,
        sessionId: input.sessionId,
        userId: input.userId,
        roomId: input.roomId,
        band,
        recommendation,
        churnRisk01,
        withdrawalRisk01,
        rageQuitRisk01: rageQuitRisk01Final,
        rescueUrgency01,
        trendDirection,
        topFactor: explanation[0]?.key ?? 'none',
        channel: input.activeVisibleChannel,
      });
    }

    return score;
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
    toxicityScore?: Nullable<ToxicityRiskScore>;
    toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
    signals?: readonly ChatSignalEnvelope[];
  }): ChurnRiskBatchResult {
    const generatedAt = params.generatedAt ?? this.context.clock.now();
    const input = deriveChurnInputFromRows({
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
      toxicityScore: params.toxicityScore,
      toxicityPriorState: params.toxicityPriorState,
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
    toxicityScore?: Nullable<ToxicityRiskScore>;
    toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
    signals?: readonly ChatSignalEnvelope[];
  }): ChurnRiskBatchResult {
    const input = deriveChurnInputFromAggregate({
      aggregate: params.aggregate,
      engagementScore: params.engagementScore,
      engagementPriorState: params.engagementPriorState,
      haterScore: params.haterScore,
      haterPriorState: params.haterPriorState,
      helperScore: params.helperScore,
      helperPriorState: params.helperPriorState,
      channelScore: params.channelScore,
      channelPriorState: params.channelPriorState,
      toxicityScore: params.toxicityScore,
      toxicityPriorState: params.toxicityPriorState,
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
    toxicityScore?: Nullable<ToxicityRiskScore>;
    toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
    signals?: readonly ChatSignalEnvelope[];
  }): ChurnRiskBatchResult {
    // When no explicit rows slice is provided, use the window-based aggregate path
    // so that `aggregateOnlineFeatureWindow` participates in the inference pipeline.
    const input = params.rows?.length
      ? deriveChurnInputFromInferenceWindow({
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
          toxicityScore: params.toxicityScore,
          toxicityPriorState: params.toxicityPriorState,
          signals: params.signals,
        })
      : churnInputFromWindow(params.window, {
          engagementScore: params.engagementScore,
          engagementPriorState: params.engagementPriorState,
          haterScore: params.haterScore,
          haterPriorState: params.haterPriorState,
          helperScore: params.helperScore,
          helperPriorState: params.helperPriorState,
          channelScore: params.channelScore,
          channelPriorState: params.channelPriorState,
          toxicityScore: params.toxicityScore,
          toxicityPriorState: params.toxicityPriorState,
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
    engagementScore?: Nullable<EngagementModelScore>;
    engagementPriorState?: Nullable<EngagementModelPriorState>;
    haterScore?: Nullable<HaterTargetingScore>;
    haterPriorState?: Nullable<HaterTargetingPriorState>;
    helperScore?: Nullable<HelperTimingScore>;
    helperPriorState?: Nullable<HelperTimingPriorState>;
    channelScore?: Nullable<ChannelAffinityScore>;
    channelPriorState?: Nullable<ChannelAffinityPriorState>;
    toxicityScore?: Nullable<ToxicityRiskScore>;
    toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
    signals?: readonly ChatSignalEnvelope[];
  }): ChurnRiskBatchResult {
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
      toxicityScore: params.toxicityScore,
      toxicityPriorState: params.toxicityPriorState,
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
    toxicityScore?: Nullable<ToxicityRiskScore>;
    toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
    signals?: readonly ChatSignalEnvelope[];
  }): ChurnRiskBatchResult {
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
      toxicityScore: params.toxicityScore,
      toxicityPriorState: params.toxicityPriorState,
      signals: params.signals,
    });
  }

  /**
   * Derives a serializable prior state from the most recent score.
   * Callers persist this between inference cycles to enable prior-state blending.
   */
  public toPriorState(score: ChurnRiskScore): ChurnRiskPriorState {
    return {
      generatedAt: score.generatedAt,
      churnRisk01: score.churnRisk01,
      withdrawalRisk01: score.withdrawalRisk01,
      rageQuitRisk01: score.rageQuitRisk01,
      rescueUrgency01: score.rescueUrgency01,
    };
  }

  /**
   * Scores a batch of inputs; optionally emits aggregate statistics when
   * `batchScoreEmitStats` is enabled in defaults.
   */
  public scoreBatch(
    inputs: readonly ChurnRiskModelInput[],
    priorMap?: ReadonlyMap<string, ChurnRiskPriorState>,
  ): ChurnRiskBatchResult[] {
    const defaults = this.context.defaults;
    const results: ChurnRiskBatchResult[] = [];
    const statsEnabled = defaults.batchScoreEmitStats && inputs.length > 0;

    let criticalCount = 0;
    let emergencyCount = 0;
    let rescueCount = 0;
    let publicWitnessCount = 0;
    let holdDramaCount = 0;
    let churnSum = 0;
    let maxChurn = 0;
    let withdrawalSum = 0;
    let rageSum = 0;
    let recoverySum = 0;

    for (const input of inputs) {
      const priorKey = input.sessionId ?? input.userId ?? null;
      const prior = priorKey ? (priorMap?.get(priorKey) ?? null) : null;
      const score = this.score(input, prior);
      const result: ChurnRiskBatchResult = { input, score };
      results.push(result);

      if (!statsEnabled) continue;
      if (score.band === 'CRITICAL') criticalCount += 1;
      if (score.isEmergency) emergencyCount += 1;
      if (score.shouldRescue) rescueCount += 1;
      if (score.shouldPublicWitness) publicWitnessCount += 1;
      if (score.shouldHoldDrama) holdDramaCount += 1;
      churnSum += score.churnRisk01;
      if (score.churnRisk01 > maxChurn) maxChurn = score.churnRisk01;
      withdrawalSum += score.withdrawalRisk01;
      rageSum += score.rageQuitRisk01;
      recoverySum += score.recoveryPotential01;
    }

    if (statsEnabled && results.length > 0) {
      const n = results.length;
      const stats: ChurnBatchStats = {
        count: n,
        criticalCount,
        emergencyCount,
        rescueCount,
        publicWitnessCount,
        holdDramaCount,
        meanChurnRisk01: churnSum / n,
        maxChurnRisk01: maxChurn,
        meanWithdrawalRisk01: withdrawalSum / n,
        meanRageQuitRisk01: rageSum / n,
        meanRecoveryPotential01: recoverySum / n,
      };
      // Attach stats to last result for downstream aggregation
      results[results.length - 1] = { ...results[results.length - 1], stats };
    }

    return results;
  }

  /**
   * Returns the trend signal comparing currentChurnRisk01 against a prior state.
   * Useful for building trend sparklines at the orchestration layer.
   */
  public churnTrendFor(
    currentChurnRisk01: Score01,
    prior: Nullable<ChurnRiskPriorState>,
  ): ChurnTrendSignal {
    const nowMs = this.context.clock.now();
    const defaults = this.context.defaults;
    const direction = computeChurnTrend(currentChurnRisk01, prior, nowMs, defaults);
    const priorRisk = prior?.churnRisk01 ?? clamp01(0);
    const delta = currentChurnRisk01 - priorRisk;
    return {
      direction,
      deltaPerWindow: delta,
      priorChurnRisk01: priorRisk,
      currentChurnRisk01,
    };
  }

  /**
   * Returns a snapshot of the model's lifetime health counters.
   * Wire this into your metrics/dashboard pipeline.
   */
  public getHealthReport(): ChurnHealthReport {
    const n = this.totalScoredLifetime;
    return {
      totalScoredLifetime: n,
      totalCriticalCount: this.totalCriticalCount,
      totalEmergencyCount: this.totalEmergencyCount,
      totalRescueCount: this.totalRescueCount,
      auditLogSize: this.auditLog.length,
      meanChurnRisk01: n > 0 ? this.totalChurnRisk01Sum / n : 0,
      maxChurnRisk01Lifetime: this.maxChurnRisk01Lifetime,
      meanRageQuitRisk01: n > 0 ? this.totalRageQuitRisk01Sum / n : 0,
    };
  }

  /** Returns a copy of the internal audit log. Requires `auditTrailEnabled: true`. */
  public getAuditLog(): readonly ChurnAuditEntry[] {
    return [...this.auditLog];
  }

  /** Clears the internal audit log, reclaiming memory. */
  public clearAuditLog(): void {
    this.auditLog.length = 0;
  }
}

// ============================================================================
// MARK: Public helpers
// ============================================================================

export function createChurnRiskModel(options: ChurnRiskModelOptions = {}): ChurnRiskModel {
  return new ChurnRiskModel(options);
}

export function scoreChurnRiskAggregate(params: {
  aggregate: ChatOnlineFeatureAggregate;
  options?: ChurnRiskModelOptions;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  toxicityScore?: Nullable<ToxicityRiskScore>;
  toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ChurnRiskScore {
  return createChurnRiskModel(params.options).scoreAggregate(params).score;
}

export function scoreChurnRiskStore(params: {
  store: OnlineFeatureStore;
  query: ChatOnlineFeatureStoreQuery;
  options?: ChurnRiskModelOptions;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  toxicityScore?: Nullable<ToxicityRiskScore>;
  toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ChurnRiskScore {
  return createChurnRiskModel(params.options).scoreStore(params).score;
}

export function scoreChurnRiskRows(params: {
  rows: readonly ChatFeatureRow[];
  generatedAt?: UnixMs;
  options?: ChurnRiskModelOptions;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  toxicityScore?: Nullable<ToxicityRiskScore>;
  toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ChurnRiskScore {
  return createChurnRiskModel(params.options).scoreRows(params).score;
}

export function scoreChurnRiskInferenceWindow(params: {
  window: ChatOnlineInferenceWindow;
  rows?: readonly ChatFeatureRow[];
  options?: ChurnRiskModelOptions;
  engagementScore?: Nullable<EngagementModelScore>;
  engagementPriorState?: Nullable<EngagementModelPriorState>;
  haterScore?: Nullable<HaterTargetingScore>;
  haterPriorState?: Nullable<HaterTargetingPriorState>;
  helperScore?: Nullable<HelperTimingScore>;
  helperPriorState?: Nullable<HelperTimingPriorState>;
  channelScore?: Nullable<ChannelAffinityScore>;
  channelPriorState?: Nullable<ChannelAffinityPriorState>;
  toxicityScore?: Nullable<ToxicityRiskScore>;
  toxicityPriorState?: Nullable<ToxicityRiskPriorState>;
  signals?: readonly ChatSignalEnvelope[];
}): ChurnRiskScore {
  return createChurnRiskModel(params.options).scoreInferenceWindow(params).score;
}

export function serializeChurnRiskScore(score: ChurnRiskScore): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    generatedAt: score.generatedAt,
    roomId: score.roomId,
    sessionId: score.sessionId,
    userId: score.userId,
    band: score.band,
    recommendation: score.recommendation,
    churnRisk01: score.churnRisk01,
    withdrawalRisk01: score.withdrawalRisk01,
    rageQuitRisk01: score.rageQuitRisk01,
    rescueUrgency01: score.rescueUrgency01,
    recoveryPotential01: score.recoveryPotential01,
    confidence01: score.confidence01,
    shouldRescue: score.shouldRescue,
    shouldPublicWitness: score.shouldPublicWitness,
    shouldHoldDrama: score.shouldHoldDrama,
    liveopsBoost01: score.liveopsBoost01,
    rageRatchet01: score.rageRatchet01,
    trendDirection: score.trendDirection,
    isEmergency: score.isEmergency,
    isBankruptcyRage: score.isBankruptcyRage,
    explanation: score.explanation.map((entry) => ({
      key: entry.key,
      signedDelta01: entry.signedDelta01,
      reason: entry.reason,
    })),
    diagnosticsEvidenceRows: score.diagnostics.evidenceRows,
    diagnosticsLowEvidence: score.diagnostics.lowEvidence,
    diagnosticsStaleSignal: score.diagnostics.staleSignal,
    diagnosticsRoomKind: score.diagnostics.roomKind,
    diagnosticsActiveVisibleChannel: score.diagnostics.activeVisibleChannel,
    diagnosticsPressureTier: score.diagnostics.pressureTier,
    diagnosticsFeatureFreshnessMs: score.diagnostics.featureFreshnessMs,
    diagnosticsModelVersion: score.diagnostics.modelVersion,
    metadata: score.metadata,
  });
}

export function hydratePriorChurnRiskState(
  payload: Nullable<Readonly<Record<string, JsonValue>>>,
): Nullable<ChurnRiskPriorState> {
  if (!payload) return null;
  return {
    generatedAt: asUnixMs(safeNumber(payload.generatedAt, Date.now())),
    churnRisk01: clamp01(safeNumber(payload.churnRisk01)),
    withdrawalRisk01: clamp01(safeNumber(payload.withdrawalRisk01)),
    rageQuitRisk01: clamp01(safeNumber(payload.rageQuitRisk01)),
    rescueUrgency01: clamp01(safeNumber(payload.rescueUrgency01)),
  };
}

export function churnRiskSummary(score: ChurnRiskScore): string {
  return [
    `band=${score.band}`,
    `recommendation=${score.recommendation}`,
    `churn=${score.churnRisk100}`,
    `withdrawal=${score.withdrawalRisk100}`,
    `rage=${score.rageQuitRisk100}`,
  ].join(' | ');
}

export function churnRiskNeedsRescue(score: ChurnRiskScore): boolean {
  return score.shouldRescue;
}

export function churnRiskNeedsPublicWitness(score: ChurnRiskScore): boolean {
  return score.shouldPublicWitness;
}

export function churnRiskShouldHold(score: ChurnRiskScore): boolean {
  return score.shouldHoldDrama;
}

// ============================================================================
// MARK: Extended public helpers — predicates, labels, sorting, telemetry
// ============================================================================

/** True when the score is in the CRITICAL band. */
export function churnIsCritical(score: ChurnRiskScore): boolean {
  return score.band === 'CRITICAL';
}

/** True when the model recommends an emergency save. */
export function churnIsEmergency(score: ChurnRiskScore): boolean {
  return score.isEmergency;
}

/** True when the player's silence is in a deal-room context and the churn risk is elevated. */
export function churnIsDealRoomSilent(score: ChurnRiskScore): boolean {
  return (
    score.diagnostics.activeVisibleChannel === ('DEAL_ROOM' as typeof score.diagnostics.activeVisibleChannel) &&
    score.withdrawalRisk01 >= 0.44
  );
}

/** True when the churn is being driven primarily by hater-side rage escalation. */
export function churnIsRageDriven(score: ChurnRiskScore): boolean {
  return score.rageQuitRisk01 >= 0.60 && score.rageQuitRisk01 > score.withdrawalRisk01;
}

/** True when the churn is primarily a quiet withdrawal, not an acute rage event. */
export function churnIsQuietWithdrawal(score: ChurnRiskScore): boolean {
  return score.withdrawalRisk01 >= 0.52 && score.withdrawalRisk01 > score.rageQuitRisk01;
}

/** True when liveops is actively amplifying the churn risk. */
export function churnIsLiveopsAmplified(score: ChurnRiskScore): boolean {
  return score.liveopsBoost01 >= 0.05;
}

/** True when the score trend is getting worse this window. */
export function churnIsWorsening(score: ChurnRiskScore): boolean {
  return score.trendDirection === 'WORSENING' || score.trendDirection === 'ACCELERATING';
}

/** True when the score trend is recovering or fully resolved. */
export function churnIsRecovering(score: ChurnRiskScore): boolean {
  return score.trendDirection === 'RECOVERING' || score.trendDirection === 'RESOLVED';
}

/** True when the player is in a bankruptcy-related rage state. */
export function churnIsBankruptcyRage(score: ChurnRiskScore): boolean {
  return score.isBankruptcyRage;
}

/** True when recovery potential is high enough to justify a dramatic hold instead of immediate rescue. */
export function churnHasHighRecovery(score: ChurnRiskScore): boolean {
  return score.recoveryPotential01 >= 0.54;
}

/** Returns a human-readable band label. */
export function churnBandLabel(score: ChurnRiskScore): string {
  switch (score.band) {
    case 'CRITICAL': return 'Critical Churn Risk';
    case 'HIGH': return 'High Churn Risk';
    case 'ELEVATED': return 'Elevated Churn Risk';
    case 'WATCH': return 'Watching for Churn';
    case 'STABLE': return 'Stable';
  }
}

/** Returns a human-readable recommendation label. */
export function churnRecommendationLabel(score: ChurnRiskScore): string {
  switch (score.recommendation) {
    case 'EMERGENCY_SAVE': return 'Emergency Save Required';
    case 'PUBLIC_WITNESS_RESCUE': return 'Public Witness Rescue';
    case 'PRIVATE_RECOVERY': return 'Private Recovery Needed';
    case 'HOLD_DRAMA': return 'Hold — Dramatic Tension';
    case 'SOFT_NUDGE': return 'Soft Nudge';
    case 'POST_COLLAPSE_DEBRIEF': return 'Post-Collapse Debrief';
    case 'STABLE_OBSERVE': return 'Stable — Observe';
  }
}

/** Returns a human-readable trend label. */
export function churnTrendLabel(direction: ChurnTrendDirection): string {
  switch (direction) {
    case 'ACCELERATING': return 'Accelerating (severe)';
    case 'WORSENING': return 'Worsening';
    case 'STABLE': return 'Stable';
    case 'RECOVERING': return 'Recovering';
    case 'RESOLVED': return 'Resolved';
  }
}

/** Returns a brief natural-language summary of the most important churn factors. */
export function churnExplanationSummary(score: ChurnRiskScore): string {
  const top3 = score.explanation.slice(0, 3);
  if (!top3.length) return 'No significant churn signals.';
  const factors = top3
    .map((f) => `${f.key}(${f.signedDelta01 >= 0 ? '+' : ''}${f.signedDelta01.toFixed(2)})`)
    .join(', ');
  return `${churnBandLabel(score)} — top factors: ${factors}`;
}

/** Returns a machine-readable telemetry payload for event pipelines. */
export function churnScoreToTelemetry(score: ChurnRiskScore): Readonly<Record<string, string | number | boolean>> {
  return Object.freeze({
    band: score.band,
    recommendation: score.recommendation,
    churnRisk01: score.churnRisk01,
    withdrawalRisk01: score.withdrawalRisk01,
    rageQuitRisk01: score.rageQuitRisk01,
    rescueUrgency01: score.rescueUrgency01,
    recoveryPotential01: score.recoveryPotential01,
    liveopsBoost01: score.liveopsBoost01,
    rageRatchet01: score.rageRatchet01,
    trendDirection: score.trendDirection,
    isEmergency: score.isEmergency,
    isBankruptcyRage: score.isBankruptcyRage,
    shouldRescue: score.shouldRescue,
    shouldHoldDrama: score.shouldHoldDrama,
    confidence01: score.confidence01,
    channel: score.diagnostics.activeVisibleChannel,
    pressureTier: score.diagnostics.pressureTier,
    modelVersion: score.diagnostics.modelVersion,
  });
}

/** Comparator for sorting scores descending by churnRisk01. */
export function churnScoreCompare(a: ChurnRiskScore, b: ChurnRiskScore): number {
  return b.churnRisk01 - a.churnRisk01;
}

/** Sorts an array of scores descending by churn risk. Non-mutating. */
export function sortChurnScoresDescending(scores: readonly ChurnRiskScore[]): ChurnRiskScore[] {
  return [...scores].sort(churnScoreCompare);
}

/** Filters to scores that need any active intervention (non-stable, non-hold). */
export function churnScoresNeedingAction(scores: readonly ChurnRiskScore[]): ChurnRiskScore[] {
  return scores.filter((s) => s.shouldRescue);
}

/** Filters to CRITICAL band scores only. */
export function churnScoresCritical(scores: readonly ChurnRiskScore[]): ChurnRiskScore[] {
  return scores.filter(churnIsCritical);
}

/** Filters to emergency scores only. */
export function churnScoresEmergency(scores: readonly ChurnRiskScore[]): ChurnRiskScore[] {
  return scores.filter(churnIsEmergency);
}

/** Returns churnRisk mapped to a 0–100 integer for display. */
export function churnConfidence100(score: ChurnRiskScore): number {
  return Math.round(score.confidence01 * 100);
}

/**
 * Derives a prior state from a serialized score payload.
 * Safe for use with Nullable hydration results from persistence layers.
 */
export function derivePriorStateChurn(
  payload: Nullable<Readonly<Record<string, JsonValue>>>,
): Nullable<ChurnRiskPriorState> {
  return hydratePriorChurnRiskState(payload);
}

/**
 * Batch-scores a window slice with a single ephemeral model instance.
 * Suitable for offline replay paths and audit pipelines.
 */
export function scoreWindowBatch(
  windows: readonly ChatOnlineInferenceWindow[],
  options: ChurnRiskModelOptions = {},
): ChurnRiskBatchResult[] {
  const model = createChurnRiskModel(options);
  return windows.map((w) => {
    const input = deriveChurnInputFromInferenceWindow({ window: w });
    return { input, score: model.score(input) };
  });
}

export const CHAT_CHURN_RISK_MODEL_NAMESPACE = Object.freeze({
  moduleName: CHAT_CHURN_RISK_MODEL_MODULE_NAME,
  moduleVersion: CHAT_CHURN_RISK_MODEL_VERSION,
  runtimeLaws: CHAT_CHURN_RISK_MODEL_RUNTIME_LAWS,
  defaults: CHAT_CHURN_RISK_MODEL_DEFAULTS,
  createChurnRiskModel,
  scoreChurnRiskAggregate,
  scoreChurnRiskStore,
  scoreChurnRiskRows,
  scoreChurnRiskInferenceWindow,
  serializeChurnRiskScore,
  hydratePriorChurnRiskState,
  churnRiskSummary,
  churnRiskNeedsRescue,
  churnRiskNeedsPublicWitness,
  churnRiskShouldHold,
  churnIsCritical,
  churnIsEmergency,
  churnIsDealRoomSilent,
  churnIsRageDriven,
  churnIsQuietWithdrawal,
  churnIsLiveopsAmplified,
  churnIsWorsening,
  churnIsRecovering,
  churnIsBankruptcyRage,
  churnHasHighRecovery,
  churnBandLabel,
  churnRecommendationLabel,
  churnTrendLabel,
  churnExplanationSummary,
  churnScoreToTelemetry,
  churnScoreCompare,
  sortChurnScoresDescending,
  churnScoresNeedingAction,
  churnScoresCritical,
  churnScoresEmergency,
  churnConfidence100,
  derivePriorStateChurn,
  scoreWindowBatch,
});

export default CHAT_CHURN_RISK_MODEL_NAMESPACE;
