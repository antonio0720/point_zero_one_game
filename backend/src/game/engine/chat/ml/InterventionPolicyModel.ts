/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT INTERVENTION POLICY MODEL
 * FILE: backend/src/game/engine/chat/ml/InterventionPolicyModel.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Final advisory coordination layer for authoritative backend chat ML.
 *
 * This model exists to answer the backend-authority question that none of the
 * sibling models can answer alone:
 *
 *   “Given accepted feature truth plus the current engagement, hater posture,
 *    helper timing, channel fit, toxicity risk, and churn risk, what should the
 *    backend recommend doing next?”
 *
 * This file is intentionally deeper than a simple weighted average. The Point
 * Zero One chat system is not a notification engine and not a generic social
 * chatroom. It is an emotional operating system that sits next to battle,
 * pressure, shield, sovereignty, zero, and run-state authority. That means the
 * intervention layer has to do more than say ‘helper good’ or ‘moderation bad’.
 * It has to reconcile conflicting pressures while staying subordinate to final
 * policy and orchestration.
 *
 * Doctrine
 * --------
 * - This file does not mutate transcript truth.
 * - This file does not bypass ChatModerationPolicy.
 * - This file does not directly emit socket messages.
 * - This file does not replace HaterResponseOrchestrator.
 * - This file does not replace HelperResponseOrchestrator.
 * - This file does not replace ChatChannelPolicy.
 * - This file does turn model outputs into one explainable recommendation
 *   surface that orchestrators and policies may accept, soften, or reject.
 *
 * Why this file is necessary
 * --------------------------
 * The sibling models are intentionally specialized:
 *
 * - EngagementModel describes vitality, continuity, fragility, and response
 *   likelihood.
 * - HaterTargetingModel describes attack opportunity, shadow priming, public
 *   leak potential, and suppression tension.
 * - HelperTimingModel describes whether a helper should speak now, how loudly,
 *   and in which posture.
 * - ChannelAffinityModel describes whether the current channel is correct,
 *   whether migration pressure is rising, and whether privacy/crowd/recovery
 *   needs are misaligned.
 * - ToxicityRiskModel describes conversational harm, escalation, blast radius,
 *   moderation sensitivity, and shadow-route value.
 * - ChurnRiskModel describes disengagement, withdrawal, rage quit, rescue need,
 *   and when dramatic silence is better than intervention.
 *
 * None of those files should decide the final intervention alone because each
 * sees one slice of reality. The intervention policy model is the place where
 * those slices are reconciled into one backend-advisory decision.
 *
 * What “intervention” means here
 * ------------------------------
 * Intervention is broader than helper insertion. It includes:
 *
 * - doing nothing on purpose,
 * - allowing cinematic silence,
 * - routing a helper privately,
 * - routing a helper publicly,
 * - shadow-priming a hater,
 * - allowing a hater public strike,
 * - redirecting the active channel,
 * - requesting moderation review,
 * - quarantining a scene,
 * - hard blocking and switching to recovery posture,
 * - selecting negotiation-specific counterplay,
 * - choosing a post-run debrief rather than live intervention,
 * - choosing a teaching window when the player is receptive.
 *
 * The model therefore produces:
 * - a recommendation,
 * - urgency and severity bands,
 * - lane-wise scores,
 * - gating booleans for helper/hater/moderation/channel,
 * - explanation factors for proof, telemetry, and replay,
 * - and a bounded prior state for live continuity.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
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
import {
  type ChurnRiskPriorState,
  type ChurnRiskScore,
} from './ChurnRiskModel';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_INTERVENTION_POLICY_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_INTERVENTION_POLICY_MODEL' as const;

export const CHAT_INTERVENTION_POLICY_MODEL_VERSION =
  '2026.03.14-intervention-policy-model.v1' as const;

export const CHAT_INTERVENTION_POLICY_MODEL_RUNTIME_LAWS = Object.freeze([
  'The intervention layer is advisory and explainable, never sovereign over policy.',
  'High toxicity or high churn can override theatrical opportunity.',
  'Cinematic silence is an intervention choice, not an absence of intelligence.',
  'Helper and hater lanes may not both dominate the same scene without explicit justification.',
  'Channel misfit is actionable because room context shapes meaning and safety.',
  'Rescue posture can coexist with moderation posture, but hard block outranks spectacle.',
  'Shadow routing is valid only when it reduces harm or increases signal quality without confusing transcript truth.',
  'Every recommendation must remain attributable to accepted backend feature truth and sibling model outputs.',
] as const);

export const CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS = Object.freeze({
  baselineBlend01: 0.10,
  confidenceFloor01: 0.18,
  // v2 additions — prior state blending and trend detection
  priorStateMaxAgeMs: 180_000,
  priorBlendIntervention01: 0.14,
  priorBlendModeration01: 0.12,
  priorBlendRescue01: 0.16,
  // v2 additions — intervention ratchet (prevents premature de-escalation)
  interventionRatchetThreshold01: 0.72,
  interventionRatchetBonus01: 0.08,
  // v2 additions — liveops amplifiers
  liveopsInvasionInterventionBonus01: 0.10,
  liveopsHaterRaidInterventionBonus01: 0.12,
  liveopsWorldEventInterventionBonus01: 0.06,
  // v2 additions — sibling conflict resolution
  siblingConflictModerationFloor01: 0.55,
  siblingConflictRescueFloor01: 0.50,
  // v2 additions — observability
  auditTrailEnabled: false,
  batchScoreEmitStats: true,
  lowEvidenceFallback01: 0.28,
  hardBlockThreshold01: 0.90,
  quarantineThreshold01: 0.78,
  moderationReviewThreshold01: 0.58,
  rescueHighThreshold01: 0.74,
  rescueMediumThreshold01: 0.52,
  helperAssistThreshold01: 0.46,
  helperPublicThreshold01: 0.58,
  helperPrivateThreshold01: 0.42,
  haterPublicThreshold01: 0.66,
  haterShadowThreshold01: 0.44,
  redirectThreshold01: 0.55,
  teachingThreshold01: 0.54,
  holdSilenceThreshold01: 0.62,
  negotiationRedirectThreshold01: 0.56,
  postRunThreshold01: 0.58,
  publicRecoveryThreshold01: 0.62,
  shadowStabilizeThreshold01: 0.40,
  toxicityOverrideWeight01: 0.26,
  churnOverrideWeight01: 0.24,
  helperWeight01: 0.17,
  haterWeight01: 0.14,
  channelWeight01: 0.11,
  engagementWeight01: 0.08,
  moderationWeight01: 0.18,
  narrativeWeight01: 0.10,
  maxExplanationFactors: 16,
  staleWindowMs: 120_000,
  freshnessFloorMs: 7_500,
  highPressureHelperDiscount01: 0.08,
  highPressureHaterAmplifier01: 0.08,
  toxicitySuppressHaterThreshold01: 0.70,
  toxicityForceReviewThreshold01: 0.62,
  churnForceRescueThreshold01: 0.70,
  churnForceWitnessThreshold01: 0.58,
  helperSuppressionPenalty01: 0.10,
  channelMisfitAmplifier01: 0.12,
  negotiationPredationAmplifier01: 0.08,
  rageQuitEmergencyAmplifier01: 0.18,
  shadowStabilizeBias01: 0.08,
  lowEvidenceRowCount: 2,
  highUrgencyThreshold01: 0.75,
  mediumUrgencyThreshold01: 0.50,
  criticalSeverityThreshold01: 0.84,
  highSeverityThreshold01: 0.66,
  lowSeverityThreshold01: 0.33,
  hardBlockRecoveryBias01: 0.15,
  postRunNarrativeBonus01: 0.10,
  silenceWhenSafeBonus01: 0.10,
  helperTeachingDiscountFromToxicity01: 0.08,
} as const);

// ============================================================================
// MARK: Ports and options
// ============================================================================

export interface InterventionPolicyModelLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface InterventionPolicyModelClockPort {
  now(): UnixMs;
}

export interface InterventionPolicyModelOptions {
  readonly logger?: InterventionPolicyModelLoggerPort;
  readonly clock?: InterventionPolicyModelClockPort;
  readonly defaults?: Partial<typeof CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS>;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
}

export interface InterventionPolicyModelContext {
  readonly logger: InterventionPolicyModelLoggerPort;
  readonly clock: InterventionPolicyModelClockPort;
  readonly defaults: typeof CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS;
  readonly runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
}

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type InterventionRecommendation =
  | 'HOLD_SILENCE'
  | 'SHADOW_STABILIZE'
  | 'SOFT_HELPER_PRIVATE'
  | 'HELPER_PRIVATE_RECOVERY'
  | 'HELPER_PUBLIC_RECOVERY'
  | 'PUBLIC_WITNESS_RECOVERY'
  | 'TEACHING_WINDOW'
  | 'CHANNEL_REDIRECT'
  | 'NEGOTIATION_COUNTERPLAY'
  | 'HATER_SHADOW_PRIME'
  | 'HATER_PUBLIC_STRIKE'
  | 'MODERATION_REVIEW'
  | 'MODERATION_QUARANTINE'
  | 'HARD_BLOCK_AND_RESCUE'
  | 'POST_RUN_DEBRIEF'
  | 'SUPPRESS_ALL_NPC';

export type InterventionUrgencyBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type InterventionSeverityBand = 'LIGHT' | 'MODERATE' | 'HEAVY' | 'MAX';

export interface InterventionExplanationFactor {
  readonly key: string;
  readonly signedDelta01: number;
  readonly reason: string;
}

export interface InterventionLaneDecision {
  readonly lane:
    | 'HELPER'
    | 'HATER'
    | 'MODERATION'
    | 'CHANNEL'
    | 'RECOVERY'
    | 'SILENCE'
    | 'NARRATIVE';
  readonly score01: Score01;
  readonly active: boolean;
  readonly note: string;
}

export interface InterventionPolicyPriorState {
  readonly generatedAt: UnixMs;
  readonly interventionPressure01: Score01;
  readonly moderationPressure01: Score01;
  readonly rescuePressure01: Score01;
  readonly narrativePressure01: Score01;
  readonly recommendation: InterventionRecommendation;
}

export interface InterventionPolicyInput {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly roomKind: ChatRoomKind;
  readonly pressureTier: PressureTier;
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly rowCount: number;
  readonly freshnessMs: number;
  readonly evidenceRowIds: readonly string[];
  readonly tags: readonly string[];
  readonly learningProfile: Nullable<ChatLearningProfile>;
  readonly sourceSignals: readonly ChatSignalEnvelope[];
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
  readonly churnScore: Nullable<ChurnRiskScore>;
  readonly churnPriorState: Nullable<ChurnRiskPriorState>;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface InterventionPolicyScore {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly roomKind: ChatRoomKind;
  readonly recommendation: InterventionRecommendation;
  readonly urgencyBand: InterventionUrgencyBand;
  readonly severityBand: InterventionSeverityBand;
  readonly interventionPressure01: Score01;
  readonly interventionPressure100: Score100;
  readonly moderationPressure01: Score01;
  readonly moderationPressure100: Score100;
  readonly rescuePressure01: Score01;
  readonly rescuePressure100: Score100;
  readonly haterOpportunity01: Score01;
  readonly haterOpportunity100: Score100;
  readonly helperOpportunity01: Score01;
  readonly helperOpportunity100: Score100;
  readonly redirectPressure01: Score01;
  readonly redirectPressure100: Score100;
  readonly narrativePressure01: Score01;
  readonly narrativePressure100: Score100;
  readonly silenceValue01: Score01;
  readonly silenceValue100: Score100;
  readonly teachingValue01: Score01;
  readonly teachingValue100: Score100;
  readonly negotiationValue01: Score01;
  readonly negotiationValue100: Score100;
  readonly shadowStabilize01: Score01;
  readonly shadowStabilize100: Score100;
  readonly confidence01: Score01;
  readonly confidence100: Score100;
  readonly shouldAllowHelper: boolean;
  readonly shouldAllowHelperPublic: boolean;
  readonly shouldAllowHater: boolean;
  readonly shouldShadowPrimeHater: boolean;
  readonly shouldRedirectChannel: boolean;
  readonly shouldRequestModerationReview: boolean;
  readonly shouldQuarantine: boolean;
  readonly shouldHardBlock: boolean;
  readonly shouldForceRecovery: boolean;
  readonly shouldHoldSilence: boolean;
  readonly shouldSuppressAllNpc: boolean;
  readonly shouldUseTeachingTone: boolean;
  readonly shouldUseNegotiationCounterplay: boolean;
  readonly shouldUsePostRunDebrief: boolean;
  // v2 additions
  readonly liveopsBoost01: Score01;
  readonly trendDirection: InterventionTrendDirection;
  readonly hasSiblingConflict: boolean;
  readonly recommendedChannel: Nullable<ChatVisibleChannel>;
  readonly preferredHelperId: Nullable<string>;
  readonly preferredHaterBotId: Nullable<string>;
  readonly evidenceRowIds: readonly string[];
  readonly laneDecisions: readonly InterventionLaneDecision[];
  readonly explanationFactors: readonly InterventionExplanationFactor[];
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly modelVersion: typeof CHAT_INTERVENTION_POLICY_MODEL_VERSION;
  readonly diagnostics: Readonly<{
    rowCount: number;
    freshnessMs: number;
    lowEvidence: boolean;
    highPressure: boolean;
    toxicityOverride01: Score01;
    churnOverride01: Score01;
    channelMisfit01: Score01;
  }>;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface InterventionPolicyBatchResult {
  readonly input: InterventionPolicyInput;
  readonly score: InterventionPolicyScore;
  readonly stats?: InterventionBatchStats;
}

export type InterventionTrendDirection =
  | 'ESCALATING'
  | 'WORSENING'
  | 'STABLE'
  | 'DE_ESCALATING'
  | 'RESOLVED';

export interface InterventionTrendSignal {
  readonly direction: InterventionTrendDirection;
  readonly deltaPerWindow: number;
  readonly priorPressure01: Score01;
  readonly currentPressure01: Score01;
}

export interface InterventionBatchStats {
  readonly count: number;
  readonly hardBlockCount: number;
  readonly quarantineCount: number;
  readonly moderationReviewCount: number;
  readonly rescueCount: number;
  readonly teachingCount: number;
  readonly silenceCount: number;
  readonly meanInterventionPressure01: number;
  readonly maxInterventionPressure01: number;
  readonly meanModerationPressure01: number;
  readonly meanRescuePressure01: number;
}

export interface InterventionAuditEntry {
  readonly timestamp: UnixMs;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
  readonly roomId: Nullable<ChatRoomId>;
  readonly recommendation: InterventionRecommendation;
  readonly urgencyBand: InterventionUrgencyBand;
  readonly severityBand: InterventionSeverityBand;
  readonly interventionPressure01: Score01;
  readonly moderationPressure01: Score01;
  readonly rescuePressure01: Score01;
  readonly trendDirection: InterventionTrendDirection;
  readonly hasSiblingConflict: boolean;
  readonly topFactor: string;
  readonly channel: ChatVisibleChannel;
}

export interface InterventionHealthReport {
  readonly totalScoredLifetime: number;
  readonly totalHardBlockCount: number;
  readonly totalQuarantineCount: number;
  readonly totalModerationReviewCount: number;
  readonly totalRescueCount: number;
  readonly auditLogSize: number;
  readonly meanInterventionPressure01: number;
  readonly maxInterventionPressure01Lifetime: number;
}

// ============================================================================
// MARK: Defaults and internal utility
// ============================================================================

const DEFAULT_LOGGER: InterventionPolicyModelLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLOCK: InterventionPolicyModelClockPort = {
  now: () => asUnixMs(Date.now()),
};

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}


function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function safeArray<T>(value: unknown): readonly T[] {
  return Array.isArray(value) ? (value as readonly T[]) : Object.freeze([]);
}

function asScore(value: number): Score01 {
  return clamp01(value);
}

function asPercent(value: number): Score100 {
  return clamp100(value * 100);
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Object.freeze(Array.from(new Set(values)));
}

function hasTag(tags: readonly string[], candidate: string): boolean {
  return tags.includes(candidate);
}

function categoryString(snapshot: Nullable<ChatFeatureSnapshot>, key: string, fallback: string): string {
  if (!snapshot) return fallback;
  const value = snapshot[key];
  return typeof value === 'string' && value ? value : fallback;
}

function scoreFromSnapshot(snapshot: Nullable<ChatFeatureSnapshot>, key: string, fallback = 0): Score01 {
  if (!snapshot) return asScore(fallback);
  return asScore(safeNumber(snapshot[key], fallback));
}

function signalRecord(signal: ChatSignalEnvelope): Record<string, unknown> {
  return signal as unknown as Record<string, unknown>;
}

function signalString(signal: ChatSignalEnvelope, key: string, fallback = ''): string {
  const value = signalRecord(signal)?.[key];
  return typeof value === 'string' ? value : fallback;
}

function signalNumber(signal: ChatSignalEnvelope, key: string, fallback = 0): number {
  return safeNumber(signalRecord(signal)?.[key], fallback);
}

function signalBoolean(signal: ChatSignalEnvelope, key: string, fallback = false): boolean {
  return safeBoolean(signalRecord(signal)?.[key], fallback);
}

function signalNested(signal: ChatSignalEnvelope, ...keys: string[]): unknown {
  let node: unknown = signalRecord(signal);
  for (const key of keys) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

function boolToScore(value: boolean, whenTrue = 1, whenFalse = 0): Score01 {
  return asScore(value ? whenTrue : whenFalse);
}

function average(values: readonly number[], fallback = 0): number {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function max(values: readonly number[], fallback = 0): number {
  if (!values.length) return fallback;
  return values.reduce((best, value) => (value > best ? value : best), values[0] ?? fallback);
}

function weightedBlend(pairs: readonly Readonly<{ value: number; weight: number }>[], fallback = 0): number {
  const active = pairs.filter((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.weight) && entry.weight > 0);
  if (!active.length) return fallback;
  const totalWeight = active.reduce((sum, entry) => sum + entry.weight, 0);
  if (!totalWeight) return fallback;
  return active.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight;
}

function tierEquals(value: PressureTier, candidates: readonly string[]): boolean {
  return candidates.includes(value);
}

function inferRoomKindFromChannel(channel: ChatVisibleChannel): ChatRoomKind {
  switch (channel) {
    case 'GLOBAL':
      return 'GLOBAL';
    case 'SYNDICATE':
      return 'SYNDICATE';
    case 'DEAL_ROOM':
      return 'DEAL_ROOM';
    case 'LOBBY':
      return 'LOBBY';
    default:
      return channel as ChatRoomKind;
  }
}

function pickActiveChannel(
  aggregate: Nullable<ChatOnlineFeatureAggregate>,
  window: Nullable<ChatOnlineInferenceWindow>,
  snapshot: Nullable<ChatFeatureSnapshot>,
): ChatVisibleChannel {
  const fromAggregate = aggregate?.dominantChannel;
  if (typeof fromAggregate === 'string' && fromAggregate) return fromAggregate as ChatVisibleChannel;
  const fromWindow = window?.categoricalFeatures?.activeVisibleChannel;
  if (typeof fromWindow === 'string' && fromWindow) return fromWindow as ChatVisibleChannel;
  const fromSnapshot = categoryString(snapshot, 'activeVisibleChannel', 'GLOBAL');
  return fromSnapshot as ChatVisibleChannel;
}

function inferPressureTier(snapshot: Nullable<ChatFeatureSnapshot>, signals: readonly ChatSignalEnvelope[]): PressureTier {
  const fromSnapshot = categoryString(snapshot, 'pressureTier', '');
  if (fromSnapshot) return fromSnapshot as PressureTier;
  const signalTier = signals.map((signal) => signalString(signal, 'pressureTier')).find(Boolean);
  return (signalTier || 'BUILDING') as PressureTier;
}

function deriveTags(
  aggregate: Nullable<ChatOnlineFeatureAggregate>,
  inputRows: readonly ChatFeatureRow[],
  snapshot: Nullable<ChatFeatureSnapshot>,
): readonly string[] {
  const base = [
    ...(aggregate?.tags ?? []),
    ...inputRows.flatMap((row) => row.tags ?? []),
  ].filter((entry): entry is string => typeof entry === 'string' && !!entry);

  const inferred: string[] = [];
  if (scoreFromSnapshot(snapshot, 'bankruptcyRisk01') > 0.6) inferred.push('BANKRUPTCY_RISK');
  if (scoreFromSnapshot(snapshot, 'rescueWindow01') > 0.55) inferred.push('RECOVERY_WINDOW');
  if (scoreFromSnapshot(snapshot, 'negotiationNeed01') > 0.55) inferred.push('NEGOTIATION_WINDOW');
  if (scoreFromSnapshot(snapshot, 'publicExposure01') > 0.6) inferred.push('PUBLIC_EXPOSURE');
  return unique([...base, ...inferred]);
}

function deriveFreshnessMs(
  generatedAt: UnixMs,
  aggregate: Nullable<ChatOnlineFeatureAggregate>,
  rows: readonly ChatFeatureRow[],
): number {
  if (aggregate && Number.isFinite(aggregate.freshnessMs)) {
    return Math.max(0, aggregate.freshnessMs);
  }
  const latestGeneratedAt = max(
    rows.map((row) => safeNumber(row.generatedAt, generatedAt)),
    generatedAt,
  );
  return Math.max(0, generatedAt - latestGeneratedAt);
}

function buildInputFromAggregate(params: {
  aggregate: ChatOnlineFeatureAggregate;
  learningProfile?: Nullable<ChatLearningProfile>;
  sourceSignals?: readonly ChatSignalEnvelope[];
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
  churnScore?: Nullable<ChurnRiskScore>;
  churnPriorState?: Nullable<ChurnRiskPriorState>;
}): InterventionPolicyInput {
  const generatedAt = params.aggregate.generatedAt;
  const snapshot = params.aggregate.canonicalSnapshot ?? null;
  const activeVisibleChannel = pickActiveChannel(params.aggregate, null, snapshot);
  const signals = params.sourceSignals ?? Object.freeze([]);

  return Object.freeze({
    generatedAt,
    roomId: params.aggregate.roomId ?? null,
    sessionId: params.aggregate.sessionId ?? null,
    userId: params.aggregate.userId ?? null,
    activeVisibleChannel,
    roomKind: inferRoomKindFromChannel(activeVisibleChannel),
    pressureTier: inferPressureTier(snapshot, signals),
    canonicalSnapshot: snapshot,
    rowCount: params.aggregate.rows.length,
    freshnessMs: Math.max(0, params.aggregate.freshnessMs),
    evidenceRowIds: Object.freeze(params.aggregate.rows.map((row) => row.rowId)),
    tags: deriveTags(params.aggregate, params.aggregate.rows, snapshot),
    learningProfile: params.learningProfile ?? null,
    sourceSignals: Object.freeze([...signals]),
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
    churnScore: params.churnScore ?? null,
    churnPriorState: params.churnPriorState ?? null,
    metadata: Object.freeze({
      aggregateFamily: params.aggregate.family,
      dominantChannel: params.aggregate.dominantChannel,
      entityKeys: params.aggregate.entityKeys,
    }),
  });
}

function buildInputFromRows(params: {
  rows: readonly ChatFeatureRow[];
  generatedAt?: UnixMs;
  learningProfile?: Nullable<ChatLearningProfile>;
  sourceSignals?: readonly ChatSignalEnvelope[];
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
  churnScore?: Nullable<ChurnRiskScore>;
  churnPriorState?: Nullable<ChurnRiskPriorState>;
}): InterventionPolicyInput {
  const rows = params.rows;
  const latest = rows.length ? rows[rows.length - 1] : null;
  const generatedAt = params.generatedAt ?? asUnixMs(Date.now());
  const snapshot = latest?.canonicalSnapshot ?? null;
  const signals = params.sourceSignals ?? Object.freeze([]);
  const activeVisibleChannel = latest?.channelId ?? pickActiveChannel(null, null, snapshot);
  return Object.freeze({
    generatedAt,
    roomId: latest?.roomId ?? null,
    sessionId: latest?.sessionId ?? null,
    userId: latest?.userId ?? null,
    activeVisibleChannel,
    roomKind: inferRoomKindFromChannel(activeVisibleChannel),
    pressureTier: inferPressureTier(snapshot, signals),
    canonicalSnapshot: snapshot,
    rowCount: rows.length,
    freshnessMs: deriveFreshnessMs(generatedAt, null, rows),
    evidenceRowIds: Object.freeze(rows.map((row) => row.rowId)),
    tags: deriveTags(null, rows, snapshot),
    learningProfile: params.learningProfile ?? null,
    sourceSignals: Object.freeze([...signals]),
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
    churnScore: params.churnScore ?? null,
    churnPriorState: params.churnPriorState ?? null,
    metadata: Object.freeze({
      latestFamily: latest?.family ?? null,
      latestEntityKey: latest?.entityKey ?? null,
    }),
  });
}

function buildInputFromInferenceWindow(params: {
  window: ChatOnlineInferenceWindow;
  roomId?: Nullable<ChatRoomId>;
  sessionId?: Nullable<ChatSessionId>;
  userId?: Nullable<ChatUserId>;
  learningProfile?: Nullable<ChatLearningProfile>;
  sourceSignals?: readonly ChatSignalEnvelope[];
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
  churnScore?: Nullable<ChurnRiskScore>;
  churnPriorState?: Nullable<ChurnRiskPriorState>;
}): InterventionPolicyInput {
  const snapshot = params.window.canonicalSnapshot ?? null;
  const signals = params.sourceSignals ?? Object.freeze([]);
  const activeVisibleChannel = pickActiveChannel(null, params.window, snapshot);
  return Object.freeze({
    generatedAt: params.window.generatedAt,
    roomId: params.roomId ?? null,
    sessionId: params.sessionId ?? null,
    userId: params.userId ?? null,
    activeVisibleChannel,
    roomKind: inferRoomKindFromChannel(activeVisibleChannel),
    pressureTier: inferPressureTier(snapshot, signals),
    canonicalSnapshot: snapshot,
    rowCount: params.window.evidenceRowIds.length,
    freshnessMs: 0,
    evidenceRowIds: Object.freeze([...params.window.evidenceRowIds]),
    tags: unique([]),
    learningProfile: params.learningProfile ?? null,
    sourceSignals: Object.freeze([...signals]),
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
    churnScore: params.churnScore ?? null,
    churnPriorState: params.churnPriorState ?? null,
    metadata: Object.freeze({ inferenceFamily: params.window.family }),
  });
}

function detectPostRunIntent(signals: readonly ChatSignalEnvelope[], tags: readonly string[], snapshot: Nullable<ChatFeatureSnapshot>): boolean {
  if (hasTag(tags, 'POST_RUN') || hasTag(tags, 'RUN_END') || hasTag(tags, 'DEBRIEF')) return true;
  if (categoryString(snapshot, 'runStage', '') === 'POST_RUN') return true;
  return signals.some((signal) => {
    const kind = signalString(signal, 'kind').toUpperCase();
    return kind.includes('RUN_END') || kind.includes('POST_RUN') || kind.includes('DEBRIEF');
  });
}

function detectNegotiationIntent(signals: readonly ChatSignalEnvelope[], roomKind: ChatRoomKind, tags: readonly string[], snapshot: Nullable<ChatFeatureSnapshot>): boolean {
  if (roomKind === 'DEAL_ROOM') return true;
  if (hasTag(tags, 'NEGOTIATION_WINDOW') || hasTag(tags, 'DEAL_ROOM')) return true;
  if (scoreFromSnapshot(snapshot, 'negotiationNeed01') > 0.4) return true;
  return signals.some((signal) => {
    const kind = signalString(signal, 'kind').toUpperCase();
    return kind.includes('OFFER') || kind.includes('DEAL') || kind.includes('NEGOTIATION');
  });
}

function detectHighPressure(pressureTier: PressureTier): boolean {
  return tierEquals(pressureTier, ['HIGH', 'CRITICAL']);
}

function computeModerationPressure(
  input: InterventionPolicyInput,
  context: InterventionPolicyModelContext,
): Score01 {
  const toxicity = input.toxicityScore;
  const churn = input.churnScore;
  const hater = input.haterScore;
  const channel = input.channelScore;
  const snapshot = input.canonicalSnapshot;
  const review = toxicity?.shouldReview ? 0.14 : 0;
  const quarantine = toxicity?.shouldQuarantine ? 0.18 : 0;
  const hardBlock = toxicity?.shouldHardBlock ? 0.28 : 0;
  const rage = churn?.isEmergency ? 0.14 : 0;
  const publicLeak = hater ? safeNumber(hater.publicLeak01) * 0.10 : 0;
  const misfit = channel ? safeNumber(channel.migrationPressure01) * context.defaults.channelMisfitAmplifier01 : 0;
  const blast = toxicity ? safeNumber(toxicity.blastRadius01) * 0.18 : 0;
  const shadow = toxicity ? safeNumber(toxicity.shadowRoute01) * 0.05 : 0;
  const predation = detectNegotiationIntent(input.sourceSignals, input.roomKind, input.tags, snapshot)
    ? scoreFromSnapshot(snapshot, 'manipulationRisk01') * context.defaults.negotiationPredationAmplifier01
    : 0;

  return asScore(
    weightedBlend(
      [
        { value: safeNumber(toxicity?.moderationSensitivity01), weight: context.defaults.moderationWeight01 },
        { value: safeNumber(toxicity?.toxicity01), weight: context.defaults.toxicityOverrideWeight01 },
        { value: safeNumber(churn?.rageQuitRisk01), weight: 0.10 },
      ],
      context.defaults.lowEvidenceFallback01,
    ) + review + quarantine + hardBlock + rage + publicLeak + misfit + blast + shadow + predation,
  );
}

function computeRescuePressure(
  input: InterventionPolicyInput,
  context: InterventionPolicyModelContext,
): Score01 {
  const helper = input.helperScore;
  const churn = input.churnScore;
  const engagement = input.engagementScore;
  const toxicity = input.toxicityScore;
  const highPressure = detectHighPressure(input.pressureTier);
  const rescueBase = weightedBlend(
    [
      { value: safeNumber(churn?.churnRisk01), weight: context.defaults.churnOverrideWeight01 },
      { value: safeNumber(churn?.withdrawalRisk01), weight: 0.12 },
      { value: safeNumber(churn?.rageQuitRisk01), weight: 0.18 },
      { value: safeNumber(helper?.rescueWindow01), weight: context.defaults.helperWeight01 },
      { value: safeNumber(engagement?.fragility01), weight: 0.14 },
      { value: safeNumber(engagement?.softDropoffRisk01), weight: 0.12 },
    ],
    context.defaults.lowEvidenceFallback01,
  );

  const helperNow = helper?.shouldInterveneNow ? 0.08 : 0;
  const publicWitness = churn?.shouldPublicWitness ? 0.08 : 0;
  const emergency = churn?.isEmergency ? context.defaults.rageQuitEmergencyAmplifier01 : 0;
  const toxicityPenalty = safeNumber(toxicity?.toxicity01) * 0.05;
  const pressureDiscount = highPressure ? context.defaults.highPressureHelperDiscount01 : 0;
  return asScore(rescueBase + helperNow + publicWitness + emergency + toxicityPenalty - pressureDiscount);
}

function computeHelperOpportunity(
  input: InterventionPolicyInput,
  context: InterventionPolicyModelContext,
): Score01 {
  const helper = input.helperScore;
  const toxicity = input.toxicityScore;
  const churn = input.churnScore;
  const engagement = input.engagementScore;
  const suppressionPenalty = helper?.suppression01 ? safeNumber(helper.suppression01) * context.defaults.helperSuppressionPenalty01 : 0;
  const toxicityDiscount = safeNumber(toxicity?.toxicity01) * context.defaults.helperTeachingDiscountFromToxicity01;
  return asScore(
    weightedBlend(
      [
        { value: safeNumber(helper?.timing01), weight: 0.24 },
        { value: safeNumber(helper?.urgency01), weight: 0.22 },
        { value: safeNumber(helper?.rescueWindow01), weight: 0.18 },
        { value: safeNumber(churn?.churnRisk01), weight: 0.14 },
        { value: safeNumber(engagement?.fragility01), weight: 0.10 },
        { value: safeNumber(engagement?.continuity01), weight: 0.08 },
      ],
      context.defaults.lowEvidenceFallback01,
    ) - suppressionPenalty - toxicityDiscount,
  );
}

function computeHaterOpportunity(
  input: InterventionPolicyInput,
  context: InterventionPolicyModelContext,
): Score01 {
  const hater = input.haterScore;
  const toxicity = input.toxicityScore;
  const highPressure = detectHighPressure(input.pressureTier);
  const toxicityGate = safeNumber(toxicity?.toxicity01);
  const suppressForToxicity = toxicityGate >= context.defaults.toxicitySuppressHaterThreshold01 ? 0.22 : 0;
  const pressureBoost = highPressure ? context.defaults.highPressureHaterAmplifier01 : 0;
  return asScore(
    weightedBlend(
      [
        { value: safeNumber(hater?.targeting01), weight: 0.26 },
        { value: safeNumber(hater?.publicLeak01), weight: 0.22 },
        { value: safeNumber(hater?.shadowPriming01), weight: 0.16 },
        { value: safeNumber(hater?.suppression01), weight: 0.08 },
      ],
      context.defaults.lowEvidenceFallback01,
    ) + pressureBoost - suppressForToxicity,
  );
}

function computeRedirectPressure(
  input: InterventionPolicyInput,
  context: InterventionPolicyModelContext,
): Score01 {
  const channel = input.channelScore;
  const toxicity = input.toxicityScore;
  const helper = input.helperScore;
  const negotiationIntent = detectNegotiationIntent(input.sourceSignals, input.roomKind, input.tags, input.canonicalSnapshot);
  const negotiationBonus = negotiationIntent ? context.defaults.negotiationPredationAmplifier01 : 0;
  const publicRisk = safeNumber(toxicity?.blastRadius01) * 0.08;
  const helperPublic = helper?.shouldIntervenePublicly ? 0.04 : 0;
  return asScore(
    weightedBlend(
      [
        { value: safeNumber(channel?.migrationPressure01), weight: 0.26 },
        { value: safeNumber(channel?.privacyNeed01), weight: 0.16 },
        { value: safeNumber(channel?.recoveryNeed01), weight: 0.18 },
        { value: safeNumber(channel?.negotiationNeed01), weight: 0.18 },
        { value: safeNumber(channel?.crowdNeed01), weight: 0.10 },
      ],
      context.defaults.lowEvidenceFallback01,
    ) + negotiationBonus + publicRisk + helperPublic,
  );
}

function computeNarrativePressure(
  input: InterventionPolicyInput,
  context: InterventionPolicyModelContext,
): Score01 {
  const engagement = input.engagementScore;
  const helper = input.helperScore;
  const churn = input.churnScore;
  const postRunIntent = detectPostRunIntent(input.sourceSignals, input.tags, input.canonicalSnapshot);
  const postRunBonus = postRunIntent ? context.defaults.postRunNarrativeBonus01 : 0;
  return asScore(
    weightedBlend(
      [
        { value: safeNumber(engagement?.crowdReadiness01), weight: 0.18 },
        { value: safeNumber(engagement?.quality01), weight: 0.18 },
        { value: safeNumber(helper?.teachingWindow01), weight: 0.14 },
        { value: boolToScore(churn?.shouldPublicWitness ?? false), weight: 0.14 },
        { value: boolToScore(postRunIntent), weight: 0.18 },
      ],
      context.defaults.lowEvidenceFallback01,
    ) + postRunBonus,
  );
}

function computeSilenceValue(
  input: InterventionPolicyInput,
  context: InterventionPolicyModelContext,
): Score01 {
  const engagement = input.engagementScore;
  const helper = input.helperScore;
  const toxicity = input.toxicityScore;
  const churn = input.churnScore;
  const safeToHold = !toxicity?.shouldHardBlock && !(safeNumber(churn?.rageQuitRisk01) >= context.defaults.churnForceRescueThreshold01) && !toxicity?.shouldQuarantine;
  const safeBonus = safeToHold ? context.defaults.silenceWhenSafeBonus01 : 0;
  return asScore(
    weightedBlend(
      [
        { value: boolToScore(engagement?.shouldHoldCinematicSilence ?? false), weight: 0.28 },
        { value: safeNumber(helper?.holdAdvantage01), weight: 0.22 },
        { value: boolToScore(churn?.shouldHoldDrama ?? false), weight: 0.20 },
        { value: safeNumber(engagement?.continuity01), weight: 0.12 },
        { value: 1 - safeNumber(input.toxicityScore?.toxicity01), weight: 0.08 },
      ],
      context.defaults.lowEvidenceFallback01,
    ) + safeBonus,
  );
}

function computeTeachingValue(input: InterventionPolicyInput): Score01 {
  const helper = input.helperScore;
  const engagement = input.engagementScore;
  const toxicity = input.toxicityScore;
  return asScore(
    weightedBlend(
      [
        { value: safeNumber(helper?.teachingWindow01), weight: 0.34 },
        { value: safeNumber(engagement?.quality01), weight: 0.24 },
        { value: safeNumber(engagement?.engagement01), weight: 0.16 },
        { value: 1 - safeNumber(toxicity?.toxicity01), weight: 0.14 },
      ],
      0.24,
    ),
  );
}

function computeNegotiationValue(input: InterventionPolicyInput): Score01 {
  const channel = input.channelScore;
  const negotiationIntent = detectNegotiationIntent(input.sourceSignals, input.roomKind, input.tags, input.canonicalSnapshot);
  const manipulation = scoreFromSnapshot(input.canonicalSnapshot, 'manipulationRisk01');
  return asScore(
    weightedBlend(
      [
        { value: safeNumber(channel?.negotiationNeed01), weight: 0.38 },
        { value: manipulation, weight: 0.20 },
        { value: boolToScore(negotiationIntent), weight: 0.22 },
        { value: safeNumber(input.toxicityScore?.moderationSensitivity01), weight: 0.10 },
      ],
      0.18,
    ),
  );
}

function computeShadowStabilize(
  input: InterventionPolicyInput,
  context: InterventionPolicyModelContext,
): Score01 {
  const toxicity = input.toxicityScore;
  const hater = input.haterScore;
  const helper = input.helperScore;
  const churn = input.churnScore;
  return asScore(
    weightedBlend(
      [
        { value: safeNumber(toxicity?.shadowRoute01), weight: 0.32 },
        { value: safeNumber(hater?.shadowPriming01), weight: 0.18 },
        { value: safeNumber(helper?.suppression01), weight: 0.12 },
        { value: safeNumber(churn?.withdrawalRisk01), weight: 0.10 },
      ],
      0.20,
    ) + context.defaults.shadowStabilizeBias01,
  );
}

function computeConfidence(input: InterventionPolicyInput, context: InterventionPolicyModelContext): Score01 {
  const freshnessQuality = 1 - Math.min(1, input.freshnessMs / Math.max(context.defaults.freshnessFloorMs, context.defaults.staleWindowMs));
  const rowEvidence = input.rowCount <= 0
    ? 0
    : input.rowCount >= 8
      ? 1
      : input.rowCount / 8;
  const siblingCoverage = average([
    boolToScore(!!input.engagementScore),
    boolToScore(!!input.haterScore),
    boolToScore(!!input.helperScore),
    boolToScore(!!input.channelScore),
    boolToScore(!!input.toxicityScore),
    boolToScore(!!input.churnScore),
  ], 0);
  return asScore(
    Math.max(
      context.defaults.confidenceFloor01,
      weightedBlend(
        [
          { value: freshnessQuality, weight: 0.34 },
          { value: rowEvidence, weight: 0.32 },
          { value: siblingCoverage, weight: 0.24 },
        ],
        context.defaults.confidenceFloor01,
      ),
    ),
  );
}

function buildLaneDecisions(params: {
  moderationPressure01: Score01;
  rescuePressure01: Score01;
  haterOpportunity01: Score01;
  helperOpportunity01: Score01;
  redirectPressure01: Score01;
  silenceValue01: Score01;
  narrativePressure01: Score01;
  recommendation: InterventionRecommendation;
}): readonly InterventionLaneDecision[] {
  return Object.freeze([
    {
      lane: 'MODERATION',
      score01: params.moderationPressure01,
      active: ['MODERATION_REVIEW', 'MODERATION_QUARANTINE', 'HARD_BLOCK_AND_RESCUE'].includes(params.recommendation),
      note: 'Moderation pressure derived from toxicity, escalation, blast radius, and rage posture.',
    },
    {
      lane: 'RECOVERY',
      score01: params.rescuePressure01,
      active: ['HELPER_PRIVATE_RECOVERY', 'HELPER_PUBLIC_RECOVERY', 'PUBLIC_WITNESS_RECOVERY', 'HARD_BLOCK_AND_RESCUE'].includes(params.recommendation),
      note: 'Recovery pressure derived from churn, helper timing, fragility, and collapse risk.',
    },
    {
      lane: 'HATER',
      score01: params.haterOpportunity01,
      active: ['HATER_SHADOW_PRIME', 'HATER_PUBLIC_STRIKE'].includes(params.recommendation),
      note: 'Hater opportunity remains subordinate to moderation and harm controls.',
    },
    {
      lane: 'HELPER',
      score01: params.helperOpportunity01,
      active: ['SOFT_HELPER_PRIVATE', 'HELPER_PRIVATE_RECOVERY', 'HELPER_PUBLIC_RECOVERY', 'PUBLIC_WITNESS_RECOVERY', 'TEACHING_WINDOW'].includes(params.recommendation),
      note: 'Helper lane balances urgency, publicness, teaching value, and recovery posture.',
    },
    {
      lane: 'CHANNEL',
      score01: params.redirectPressure01,
      active: ['CHANNEL_REDIRECT', 'NEGOTIATION_COUNTERPLAY'].includes(params.recommendation),
      note: 'Channel lane activates when privacy, recovery, or negotiation fit is wrong.',
    },
    {
      lane: 'SILENCE',
      score01: params.silenceValue01,
      active: params.recommendation === 'HOLD_SILENCE',
      note: 'Silence is chosen when it increases coherence without increasing harm.',
    },
    {
      lane: 'NARRATIVE',
      score01: params.narrativePressure01,
      active: params.recommendation === 'POST_RUN_DEBRIEF',
      note: 'Narrative lane activates for post-run witnessing and authored debrief.',
    },
  ]);
}

function urgencyBand(pressure01: Score01, defaults: typeof CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS): InterventionUrgencyBand {
  if (pressure01 >= defaults.highUrgencyThreshold01) return 'CRITICAL';
  if (pressure01 >= defaults.mediumUrgencyThreshold01) return 'HIGH';
  if (pressure01 >= 0.30) return 'MEDIUM';
  return 'LOW';
}

function severityBand(pressure01: Score01, defaults: typeof CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS): InterventionSeverityBand {
  if (pressure01 >= defaults.criticalSeverityThreshold01) return 'MAX';
  if (pressure01 >= defaults.highSeverityThreshold01) return 'HEAVY';
  if (pressure01 >= defaults.lowSeverityThreshold01) return 'MODERATE';
  return 'LIGHT';
}

function chooseRecommendation(params: {
  input: InterventionPolicyInput;
  moderationPressure01: Score01;
  rescuePressure01: Score01;
  haterOpportunity01: Score01;
  helperOpportunity01: Score01;
  redirectPressure01: Score01;
  narrativePressure01: Score01;
  silenceValue01: Score01;
  teachingValue01: Score01;
  negotiationValue01: Score01;
  shadowStabilize01: Score01;
  defaults: typeof CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS;
}): InterventionRecommendation {
  const toxicity = params.input.toxicityScore;
  const churn = params.input.churnScore;
  const helper = params.input.helperScore;
  const hater = params.input.haterScore;
  const channel = params.input.channelScore;
  const postRun = detectPostRunIntent(params.input.sourceSignals, params.input.tags, params.input.canonicalSnapshot);

  if (toxicity?.shouldHardBlock || params.moderationPressure01 >= params.defaults.hardBlockThreshold01) {
    return 'HARD_BLOCK_AND_RESCUE';
  }

  if (toxicity?.shouldQuarantine || params.moderationPressure01 >= params.defaults.quarantineThreshold01) {
    return 'MODERATION_QUARANTINE';
  }

  if (toxicity?.shouldReview || params.moderationPressure01 >= params.defaults.moderationReviewThreshold01) {
    if (params.rescuePressure01 >= params.defaults.churnForceRescueThreshold01) {
      return 'HARD_BLOCK_AND_RESCUE';
    }
    return 'MODERATION_REVIEW';
  }

  if (postRun && params.narrativePressure01 >= params.defaults.postRunThreshold01) {
    return 'POST_RUN_DEBRIEF';
  }

  if (safeNumber(churn?.rageQuitRisk01) >= params.defaults.churnForceRescueThreshold01 || params.rescuePressure01 >= params.defaults.rescueHighThreshold01) {
    if (helper?.shouldIntervenePublicly || churn?.shouldPublicWitness) {
      return 'PUBLIC_WITNESS_RECOVERY';
    }
    if (helper?.shouldQueuePrivatePrompt || !helper?.shouldIntervenePublicly) {
      return 'HELPER_PRIVATE_RECOVERY';
    }
    return 'HELPER_PUBLIC_RECOVERY';
  }

  if (params.redirectPressure01 >= params.defaults.redirectThreshold01) {
    if (params.negotiationValue01 >= params.defaults.negotiationRedirectThreshold01) {
      return 'NEGOTIATION_COUNTERPLAY';
    }
    return 'CHANNEL_REDIRECT';
  }

  if (params.teachingValue01 >= params.defaults.teachingThreshold01 && params.helperOpportunity01 >= params.defaults.helperAssistThreshold01) {
    return 'TEACHING_WINDOW';
  }

  if (params.rescuePressure01 >= params.defaults.rescueMediumThreshold01 && params.helperOpportunity01 >= params.defaults.helperPrivateThreshold01) {
    if (helper?.shouldIntervenePublicly || params.helperOpportunity01 >= params.defaults.publicRecoveryThreshold01) {
      return 'HELPER_PUBLIC_RECOVERY';
    }
    return 'SOFT_HELPER_PRIVATE';
  }

  if (params.haterOpportunity01 >= params.defaults.haterPublicThreshold01 && !toxicity?.shouldShadowRoute) {
    if (hater?.shouldEscalate || hater?.shouldLeakToGlobal) {
      return 'HATER_PUBLIC_STRIKE';
    }
  }

  if (params.haterOpportunity01 >= params.defaults.haterShadowThreshold01 || hater?.shouldShadowPrime) {
    return 'HATER_SHADOW_PRIME';
  }

  if (params.silenceValue01 >= params.defaults.holdSilenceThreshold01) {
    return 'HOLD_SILENCE';
  }

  if (params.shadowStabilize01 >= params.defaults.shadowStabilizeThreshold01 || toxicity?.shouldShadowRoute) {
    return 'SHADOW_STABILIZE';
  }

  if (params.helperOpportunity01 >= params.defaults.helperPrivateThreshold01) {
    return 'SOFT_HELPER_PRIVATE';
  }

  if (channel?.shouldMigrate) {
    return 'CHANNEL_REDIRECT';
  }

  return 'SUPPRESS_ALL_NPC';
}

function buildExplanationFactors(params: {
  input: InterventionPolicyInput;
  moderationPressure01: Score01;
  rescuePressure01: Score01;
  haterOpportunity01: Score01;
  helperOpportunity01: Score01;
  redirectPressure01: Score01;
  narrativePressure01: Score01;
  silenceValue01: Score01;
  teachingValue01: Score01;
  negotiationValue01: Score01;
  shadowStabilize01: Score01;
  defaults: typeof CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS;
}): readonly InterventionExplanationFactor[] {
  const factors: InterventionExplanationFactor[] = [];
  const push = (key: string, signedDelta01: number, reason: string): void => {
    factors.push({ key, signedDelta01, reason });
  };

  push('moderation_pressure', params.moderationPressure01, 'Moderation pressure rises from toxicity, blast radius, escalation, and rage posture.');
  push('rescue_pressure', params.rescuePressure01, 'Rescue pressure rises from churn, helper urgency, fragility, and collapse risk.');
  push('hater_opportunity', params.haterOpportunity01, 'Hater opportunity reflects targeting, public leak potential, and shadow priming under guardrails.');
  push('helper_opportunity', params.helperOpportunity01, 'Helper opportunity reflects timing, urgency, rescue window, and receptivity.');
  push('redirect_pressure', params.redirectPressure01, 'Redirect pressure reflects channel misfit across privacy, recovery, and negotiation needs.');
  push('narrative_pressure', params.narrativePressure01, 'Narrative pressure reflects authored witnessing value, especially at post-run moments.');
  push('silence_value', params.silenceValue01, 'Silence can be the correct move when it preserves coherence without increasing harm.');
  push('teaching_value', params.teachingValue01, 'Teaching value rises when the player is engaged enough to absorb instruction.');
  push('negotiation_value', params.negotiationValue01, 'Negotiation counterplay activates when deal-room logic or manipulation risk is present.');
  push('shadow_stabilize', params.shadowStabilize01, 'Shadow stabilization rises when visible escalation should be avoided but active steering is still needed.');

  if (params.input.toxicityScore?.shouldHardBlock) {
    push('toxicity_hard_block', 0.24, 'Sibling toxicity model requested hard block, which outranks spectacle.');
  }
  if (safeNumber(params.input.churnScore?.rageQuitRisk01) >= params.defaults.churnForceRescueThreshold01) {
    push('churn_emergency', 0.22, 'Sibling churn model detected emergency recovery posture via rage-quit risk.');
  }
  if (params.input.helperScore?.shouldInterveneNow) {
    push('helper_now', 0.12, 'Helper timing says intervention can happen now.');
  }
  if (params.input.channelScore?.shouldMigrate) {
    push('channel_migrate', 0.10, 'Channel affinity says the active channel is no longer optimal.');
  }
  if (detectPostRunIntent(params.input.sourceSignals, params.input.tags, params.input.canonicalSnapshot)) {
    push('post_run', 0.12, 'Signals indicate a post-run or debrief posture.');
  }

  return Object.freeze(factors
    .sort((left, right) => Math.abs(right.signedDelta01) - Math.abs(left.signedDelta01))
    .slice(0, params.defaults.maxExplanationFactors));
}

function deriveRecommendedChannel(input: InterventionPolicyInput, recommendation: InterventionRecommendation): Nullable<ChatVisibleChannel> {
  const channel = input.channelScore;
  if (recommendation === 'CHANNEL_REDIRECT' || recommendation === 'NEGOTIATION_COUNTERPLAY') {
    return channel?.recommendedPrimaryChannel ?? null;
  }
  if (recommendation === 'HELPER_PRIVATE_RECOVERY' || recommendation === 'SOFT_HELPER_PRIVATE') {
    return 'SYNDICATE';
  }
  return null;
}

function interventionMetadata(input: InterventionPolicyInput, recommendation: InterventionRecommendation): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    sourceSignalKinds: input.sourceSignals.map((signal) => signalString(signal, 'kind', 'UNKNOWN')),
    rowCount: input.rowCount,
    freshnessMs: input.freshnessMs,
    recommendation,
    postRunIntent: detectPostRunIntent(input.sourceSignals, input.tags, input.canonicalSnapshot),
    negotiationIntent: detectNegotiationIntent(input.sourceSignals, input.roomKind, input.tags, input.canonicalSnapshot),
  });
}

// ============================================================================
// MARK: v2 scoring helpers — liveops, prior state, trend, conflict detection
// ============================================================================

/**
 * Detects liveops-driven amplifiers from source signals.
 * Uses the nested liveops property on signal envelopes.
 */
function computeLiveopsInterventionBoost01(
  input: InterventionPolicyInput,
  defaults: typeof CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS,
): Score01 {
  let bonus = clamp01(0);
  for (const signal of input.sourceSignals) {
    const invasion = safeBoolean(signalNested(signal, 'liveops', 'invasionActive'));
    const raid = safeBoolean(signalNested(signal, 'liveops', 'haterRaidActive'));
    const worldEvent = safeBoolean(signalNested(signal, 'liveops', 'worldEventActive'));
    if (invasion) {
      bonus = clamp01(
        bonus +
          safeNumber(input.toxicityScore?.toxicity01) * defaults.liveopsInvasionInterventionBonus01 * 0.7 +
          safeNumber(input.churnScore?.rageQuitRisk01) * defaults.liveopsInvasionInterventionBonus01 * 0.5,
      );
    }
    if (raid) {
      bonus = clamp01(
        bonus +
          safeNumber(input.haterScore?.targeting01) * defaults.liveopsHaterRaidInterventionBonus01 * 0.9 +
          safeNumber(input.toxicityScore?.blastRadius01) * defaults.liveopsHaterRaidInterventionBonus01 * 0.4,
      );
    }
    if (worldEvent) {
      bonus = clamp01(bonus + safeNumber(input.engagementScore?.engagement01) * defaults.liveopsWorldEventInterventionBonus01 * 0.3);
    }
  }
  return bonus;
}

/**
 * Detects when moderation and rescue lanes are simultaneously elevated,
 * creating a conflict that the orchestration layer must resolve.
 */
function detectSiblingConflict(
  moderationPressure01: Score01,
  rescuePressure01: Score01,
  defaults: typeof CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS,
): boolean {
  return (
    moderationPressure01 >= defaults.siblingConflictModerationFloor01 &&
    rescuePressure01 >= defaults.siblingConflictRescueFloor01
  );
}

/**
 * Intervention ratchet: when prior intervention pressure was already above threshold,
 * prevent premature score recovery unless concrete positive evidence exists.
 */
function computeInterventionRatchet01(
  current: Score01,
  prior: Nullable<InterventionPolicyPriorState>,
  defaults: typeof CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS,
): Score01 {
  if (!prior) return clamp01(0);
  if (prior.interventionPressure01 < defaults.interventionRatchetThreshold01) return clamp01(0);
  const delta = prior.interventionPressure01 - current;
  return clamp01(Math.max(0, delta) * defaults.interventionRatchetBonus01);
}

/**
 * Blends current intervention pressure with prior state to prevent oscillation.
 */
function blendInterventionWithPrior(
  current: Score01,
  priorValue: Score01,
  blendWeight: number,
  priorAgeMs: number,
  maxAgeMs: number,
): Score01 {
  if (priorAgeMs > maxAgeMs) return current;
  const decay = Math.max(0, 1 - priorAgeMs / maxAgeMs);
  return clamp01(current * (1 - blendWeight * decay) + priorValue * blendWeight * decay);
}

/**
 * Derives a trend direction by comparing current intervention pressure to prior state.
 */
function computeInterventionTrend(
  currentPressure01: Score01,
  prior: Nullable<InterventionPolicyPriorState>,
  nowMs: UnixMs,
  defaults: typeof CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS,
): InterventionTrendDirection {
  if (!prior) return 'STABLE';
  const ageMs = Math.max(0, (nowMs as number) - (prior.generatedAt as number));
  if (ageMs > defaults.priorStateMaxAgeMs) return 'STABLE';
  const delta = currentPressure01 - prior.interventionPressure01;
  if (delta >= 0.16) return 'ESCALATING';
  if (delta >= 0.08) return 'WORSENING';
  if (delta <= -0.16) return 'RESOLVED';
  if (delta <= -0.08) return 'DE_ESCALATING';
  return 'STABLE';
}

// ============================================================================
// MARK: Core class
// ============================================================================

export class InterventionPolicyModel {
  private readonly context: InterventionPolicyModelContext;

  // Health counters — lifetime totals for observability dashboards
  private totalScoredLifetime = 0;
  private totalInterventionPressureSum = 0;
  private maxInterventionPressureLifetime = 0;
  private totalHardBlockCount = 0;
  private totalQuarantineCount = 0;
  private totalModerationReviewCount = 0;
  private totalRescueCount = 0;
  private readonly auditLog: InterventionAuditEntry[] = [];

  public constructor(options: InterventionPolicyModelOptions = {}) {
    this.context = Object.freeze({
      logger: options.logger ?? DEFAULT_LOGGER,
      clock: options.clock ?? DEFAULT_CLOCK,
      defaults: Object.freeze({
        ...CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS,
        ...(options.defaults ?? {}),
      }),
      runtime: mergeRuntimeConfig(options.runtimeOverride),
    });
  }

  public score(input: InterventionPolicyInput, prior: Nullable<InterventionPolicyPriorState> = null): InterventionPolicyScore {
    const context = this.context;
    const nowMs = context.clock.now();
    const defaults = context.defaults;

    const moderationPressure01Raw = computeModerationPressure(input, context);
    const rescuePressure01Raw = computeRescuePressure(input, context);
    const haterOpportunity01 = computeHaterOpportunity(input, context);
    const helperOpportunity01 = computeHelperOpportunity(input, context);
    const redirectPressure01 = computeRedirectPressure(input, context);
    const narrativePressure01 = computeNarrativePressure(input, context);
    const silenceValue01 = computeSilenceValue(input, context);
    const teachingValue01 = computeTeachingValue(input);
    const negotiationValue01 = computeNegotiationValue(input);
    const shadowStabilize01 = computeShadowStabilize(input, context);
    const confidence01 = computeConfidence(input, context);

    // v2: liveops amplification
    const liveopsBoost01 = computeLiveopsInterventionBoost01(input, defaults);

    // v2: sibling conflict detection
    const hasSiblingConflict = detectSiblingConflict(moderationPressure01Raw, rescuePressure01Raw, defaults);

    // v2: prior-state blending prevents score oscillation
    const priorAgeMs = prior ? Math.max(0, (nowMs as number) - (prior.generatedAt as number)) : Infinity;
    const moderationPressure01 = prior
      ? blendInterventionWithPrior(moderationPressure01Raw, prior.moderationPressure01, defaults.priorBlendModeration01, priorAgeMs, defaults.priorStateMaxAgeMs)
      : moderationPressure01Raw;
    const rescuePressure01 = prior
      ? blendInterventionWithPrior(rescuePressure01Raw, prior.rescuePressure01, defaults.priorBlendRescue01, priorAgeMs, defaults.priorStateMaxAgeMs)
      : rescuePressure01Raw;

    const interventionPressure01Raw = asScore(
      weightedBlend(
        [
          { value: moderationPressure01, weight: defaults.moderationWeight01 },
          { value: rescuePressure01, weight: defaults.churnOverrideWeight01 },
          { value: helperOpportunity01, weight: defaults.helperWeight01 },
          { value: haterOpportunity01, weight: defaults.haterWeight01 },
          { value: redirectPressure01, weight: defaults.channelWeight01 },
          { value: narrativePressure01, weight: defaults.narrativeWeight01 },
          { value: shadowStabilize01, weight: 0.08 },
          { value: prior?.interventionPressure01 ?? defaults.lowEvidenceFallback01, weight: defaults.baselineBlend01 },
        ],
        defaults.lowEvidenceFallback01,
      ),
    );

    // v2: ratchet + liveops applied to final pressure
    const ratchet01 = computeInterventionRatchet01(interventionPressure01Raw, prior, defaults);
    const interventionPressure01 = prior
      ? blendInterventionWithPrior(
          clamp01(interventionPressure01Raw + liveopsBoost01 * 0.6 + ratchet01),
          prior.interventionPressure01,
          defaults.priorBlendIntervention01,
          priorAgeMs,
          defaults.priorStateMaxAgeMs,
        )
      : clamp01(interventionPressure01Raw + liveopsBoost01 * 0.6);

    const recommendation = chooseRecommendation({
      input,
      moderationPressure01,
      rescuePressure01,
      haterOpportunity01,
      helperOpportunity01,
      redirectPressure01,
      narrativePressure01,
      silenceValue01,
      teachingValue01,
      negotiationValue01,
      shadowStabilize01,
      defaults: context.defaults,
    });

    const laneDecisions = buildLaneDecisions({
      moderationPressure01,
      rescuePressure01,
      haterOpportunity01,
      helperOpportunity01,
      redirectPressure01,
      silenceValue01,
      narrativePressure01,
      recommendation,
    });

    const explanationFactors = buildExplanationFactors({
      input,
      moderationPressure01,
      rescuePressure01,
      haterOpportunity01,
      helperOpportunity01,
      redirectPressure01,
      narrativePressure01,
      silenceValue01,
      teachingValue01,
      negotiationValue01,
      shadowStabilize01,
      defaults: context.defaults,
    });

    // v2: trend direction and final semantic flags
    const trendDirection = computeInterventionTrend(interventionPressure01, prior, nowMs, defaults);

    const urgency = urgencyBand(interventionPressure01, defaults);
    const severity = severityBand(asScore(Math.max(interventionPressure01, moderationPressure01, rescuePressure01)), defaults);
    const recommendedChannel = deriveRecommendedChannel(input, recommendation);
    const shouldHardBlock = recommendation === 'HARD_BLOCK_AND_RESCUE';
    const shouldQuarantine = recommendation === 'MODERATION_QUARANTINE';
    const shouldRequestModerationReview = recommendation === 'MODERATION_REVIEW' || shouldQuarantine || shouldHardBlock;
    const shouldForceRecovery = [
      'HELPER_PRIVATE_RECOVERY',
      'HELPER_PUBLIC_RECOVERY',
      'PUBLIC_WITNESS_RECOVERY',
      'HARD_BLOCK_AND_RESCUE',
    ].includes(recommendation);
    const shouldAllowHelper = [
      'SOFT_HELPER_PRIVATE',
      'HELPER_PRIVATE_RECOVERY',
      'HELPER_PUBLIC_RECOVERY',
      'PUBLIC_WITNESS_RECOVERY',
      'TEACHING_WINDOW',
    ].includes(recommendation);
    const shouldAllowHelperPublic = [
      'HELPER_PUBLIC_RECOVERY',
      'PUBLIC_WITNESS_RECOVERY',
    ].includes(recommendation);
    const shouldAllowHater = ['HATER_SHADOW_PRIME', 'HATER_PUBLIC_STRIKE'].includes(recommendation);
    const shouldShadowPrimeHater = recommendation === 'HATER_SHADOW_PRIME';
    const shouldRedirectChannel = ['CHANNEL_REDIRECT', 'NEGOTIATION_COUNTERPLAY'].includes(recommendation);
    const shouldHoldSilence = recommendation === 'HOLD_SILENCE';
    const shouldSuppressAllNpc = recommendation === 'SUPPRESS_ALL_NPC' || shouldHardBlock || shouldQuarantine;
    const shouldUseTeachingTone = recommendation === 'TEACHING_WINDOW';
    const shouldUseNegotiationCounterplay = recommendation === 'NEGOTIATION_COUNTERPLAY';
    const shouldUsePostRunDebrief = recommendation === 'POST_RUN_DEBRIEF';

    const score = Object.freeze({
      generatedAt: input.generatedAt,
      roomId: input.roomId,
      sessionId: input.sessionId,
      userId: input.userId,
      activeVisibleChannel: input.activeVisibleChannel,
      roomKind: input.roomKind,
      recommendation,
      urgencyBand: urgency,
      severityBand: severity,
      interventionPressure01,
      interventionPressure100: asPercent(interventionPressure01),
      moderationPressure01,
      moderationPressure100: asPercent(moderationPressure01),
      rescuePressure01,
      rescuePressure100: asPercent(rescuePressure01),
      haterOpportunity01,
      haterOpportunity100: asPercent(haterOpportunity01),
      helperOpportunity01,
      helperOpportunity100: asPercent(helperOpportunity01),
      redirectPressure01,
      redirectPressure100: asPercent(redirectPressure01),
      narrativePressure01,
      narrativePressure100: asPercent(narrativePressure01),
      silenceValue01,
      silenceValue100: asPercent(silenceValue01),
      teachingValue01,
      teachingValue100: asPercent(teachingValue01),
      negotiationValue01,
      negotiationValue100: asPercent(negotiationValue01),
      shadowStabilize01,
      shadowStabilize100: asPercent(shadowStabilize01),
      confidence01,
      confidence100: asPercent(confidence01),
      shouldAllowHelper,
      shouldAllowHelperPublic,
      shouldAllowHater,
      shouldShadowPrimeHater,
      shouldRedirectChannel,
      shouldRequestModerationReview,
      shouldQuarantine,
      shouldHardBlock,
      shouldForceRecovery,
      shouldHoldSilence,
      shouldSuppressAllNpc,
      shouldUseTeachingTone,
      shouldUseNegotiationCounterplay,
      shouldUsePostRunDebrief,
      liveopsBoost01,
      trendDirection,
      hasSiblingConflict,
      recommendedChannel,
      preferredHelperId: input.helperScore?.preferredHelperId ?? null,
      preferredHaterBotId: input.haterScore?.personaAffinities?.[0]?.botId ?? null,
      evidenceRowIds: input.evidenceRowIds,
      laneDecisions,
      explanationFactors,
      canonicalSnapshot: input.canonicalSnapshot,
      modelVersion: CHAT_INTERVENTION_POLICY_MODEL_VERSION,
      diagnostics: Object.freeze({
        rowCount: input.rowCount,
        freshnessMs: input.freshnessMs,
        lowEvidence: input.rowCount <= defaults.lowEvidenceRowCount,
        highPressure: detectHighPressure(input.pressureTier),
        toxicityOverride01: asScore(safeNumber(input.toxicityScore?.toxicity01)),
        churnOverride01: asScore(safeNumber(input.churnScore?.churnRisk01)),
        channelMisfit01: asScore(safeNumber(input.channelScore?.migrationPressure01)),
      }),
      metadata: interventionMetadata(input, recommendation),
    }) satisfies InterventionPolicyScore;

    // Update health counters
    this.totalScoredLifetime += 1;
    this.totalInterventionPressureSum += interventionPressure01;
    if (interventionPressure01 > this.maxInterventionPressureLifetime) {
      this.maxInterventionPressureLifetime = interventionPressure01;
    }
    if (shouldHardBlock) this.totalHardBlockCount += 1;
    if (shouldQuarantine) this.totalQuarantineCount += 1;
    if (shouldRequestModerationReview) this.totalModerationReviewCount += 1;
    if (shouldForceRecovery || shouldAllowHelper) this.totalRescueCount += 1;

    // Audit trail
    if (defaults.auditTrailEnabled) {
      this.auditLog.push({
        timestamp: nowMs,
        sessionId: input.sessionId,
        userId: input.userId,
        roomId: input.roomId,
        recommendation,
        urgencyBand: urgency,
        severityBand: severity,
        interventionPressure01,
        moderationPressure01,
        rescuePressure01,
        trendDirection,
        hasSiblingConflict,
        topFactor: explanationFactors[0]?.key ?? 'none',
        channel: input.activeVisibleChannel,
      });
    }

    context.logger.debug('intervention_policy_model_scored', {
      roomId: score.roomId,
      userId: score.userId,
      recommendation: score.recommendation,
      interventionPressure01: score.interventionPressure01,
      moderationPressure01: score.moderationPressure01,
      rescuePressure01: score.rescuePressure01,
      haterOpportunity01: score.haterOpportunity01,
      helperOpportunity01: score.helperOpportunity01,
      redirectPressure01: score.redirectPressure01,
      trendDirection: score.trendDirection,
      hasSiblingConflict: score.hasSiblingConflict,
    });

    return score;
  }

  public scoreRows(params: {
    rows: readonly ChatFeatureRow[];
    generatedAt?: UnixMs;
    learningProfile?: Nullable<ChatLearningProfile>;
    sourceSignals?: readonly ChatSignalEnvelope[];
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
    churnScore?: Nullable<ChurnRiskScore>;
    churnPriorState?: Nullable<ChurnRiskPriorState>;
    prior?: Nullable<InterventionPolicyPriorState>;
  }): InterventionPolicyBatchResult {
    const input = buildInputFromRows(params);
    return { input, score: this.score(input, params.prior ?? null) };
  }

  public scoreAggregate(params: {
    aggregate: ChatOnlineFeatureAggregate;
    learningProfile?: Nullable<ChatLearningProfile>;
    sourceSignals?: readonly ChatSignalEnvelope[];
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
    churnScore?: Nullable<ChurnRiskScore>;
    churnPriorState?: Nullable<ChurnRiskPriorState>;
    prior?: Nullable<InterventionPolicyPriorState>;
  }): InterventionPolicyBatchResult {
    const input = buildInputFromAggregate(params);
    return { input, score: this.score(input, params.prior ?? null) };
  }

  public scoreInferenceWindow(params: {
    window: ChatOnlineInferenceWindow;
    roomId?: Nullable<ChatRoomId>;
    sessionId?: Nullable<ChatSessionId>;
    userId?: Nullable<ChatUserId>;
    learningProfile?: Nullable<ChatLearningProfile>;
    sourceSignals?: readonly ChatSignalEnvelope[];
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
    churnScore?: Nullable<ChurnRiskScore>;
    churnPriorState?: Nullable<ChurnRiskPriorState>;
    prior?: Nullable<InterventionPolicyPriorState>;
  }): InterventionPolicyBatchResult {
    const input = buildInputFromInferenceWindow(params);
    return { input, score: this.score(input, params.prior ?? null) };
  }

  public scoreStore(params: {
    store: OnlineFeatureStore;
    query: ChatOnlineFeatureStoreQuery;
    learningProfile?: Nullable<ChatLearningProfile>;
    sourceSignals?: readonly ChatSignalEnvelope[];
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
    churnScore?: Nullable<ChurnRiskScore>;
    churnPriorState?: Nullable<ChurnRiskPriorState>;
    prior?: Nullable<InterventionPolicyPriorState>;
  }): InterventionPolicyBatchResult {
    const aggregate = params.store.aggregate(params.query);
    return this.scoreAggregate({
      aggregate,
      learningProfile: params.learningProfile,
      sourceSignals: params.sourceSignals,
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
      churnScore: params.churnScore,
      churnPriorState: params.churnPriorState,
      prior: params.prior,
    });
  }

  public scoreIngestResult(params: {
    ingestResult: ChatFeatureIngestResult;
    learningProfile?: Nullable<ChatLearningProfile>;
    sourceSignals?: readonly ChatSignalEnvelope[];
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
    churnScore?: Nullable<ChurnRiskScore>;
    churnPriorState?: Nullable<ChurnRiskPriorState>;
    prior?: Nullable<InterventionPolicyPriorState>;
  }): InterventionPolicyBatchResult {
    return this.scoreRows({
      rows: params.ingestResult.rows,
      generatedAt: params.ingestResult.generatedAt,
      learningProfile: params.learningProfile,
      sourceSignals: params.sourceSignals,
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
      churnScore: params.churnScore,
      churnPriorState: params.churnPriorState,
      prior: params.prior,
    });
  }

  public toPriorState(score: InterventionPolicyScore): InterventionPolicyPriorState {
    return Object.freeze({
      generatedAt: score.generatedAt,
      interventionPressure01: score.interventionPressure01,
      moderationPressure01: score.moderationPressure01,
      rescuePressure01: score.rescuePressure01,
      narrativePressure01: score.narrativePressure01,
      recommendation: score.recommendation,
    });
  }

  /**
   * Scores a batch of inputs with optional prior state maps keyed by sessionId.
   * Emits aggregate batch statistics when `batchScoreEmitStats` is enabled.
   */
  public scoreBatch(
    inputs: readonly InterventionPolicyInput[],
    priorMap?: ReadonlyMap<string, InterventionPolicyPriorState>,
  ): InterventionPolicyBatchResult[] {
    const defaults = this.context.defaults;
    const results: InterventionPolicyBatchResult[] = [];
    const statsEnabled = defaults.batchScoreEmitStats && inputs.length > 0;

    let hardBlockCount = 0;
    let quarantineCount = 0;
    let moderationReviewCount = 0;
    let rescueCount = 0;
    let teachingCount = 0;
    let silenceCount = 0;
    let pressureSum = 0;
    let maxPressure = 0;
    let moderationSum = 0;
    let rescueSum = 0;

    for (const input of inputs) {
      const priorKey = input.sessionId ?? input.userId ?? null;
      const prior = priorKey ? (priorMap?.get(priorKey) ?? null) : null;
      const score = this.score(input, prior);
      results.push({ input, score });

      if (!statsEnabled) continue;
      if (score.shouldHardBlock) hardBlockCount += 1;
      if (score.shouldQuarantine) quarantineCount += 1;
      if (score.shouldRequestModerationReview) moderationReviewCount += 1;
      if (score.shouldForceRecovery || score.shouldAllowHelper) rescueCount += 1;
      if (score.shouldUseTeachingTone) teachingCount += 1;
      if (score.shouldHoldSilence) silenceCount += 1;
      pressureSum += score.interventionPressure01;
      if (score.interventionPressure01 > maxPressure) maxPressure = score.interventionPressure01;
      moderationSum += score.moderationPressure01;
      rescueSum += score.rescuePressure01;
    }

    if (statsEnabled && results.length > 0) {
      const n = results.length;
      const stats: InterventionBatchStats = {
        count: n,
        hardBlockCount,
        quarantineCount,
        moderationReviewCount,
        rescueCount,
        teachingCount,
        silenceCount,
        meanInterventionPressure01: pressureSum / n,
        maxInterventionPressure01: maxPressure,
        meanModerationPressure01: moderationSum / n,
        meanRescuePressure01: rescueSum / n,
      };
      results[results.length - 1] = { ...results[results.length - 1], stats };
    }

    return results;
  }

  /**
   * Returns the intervention trend signal comparing current pressure to a prior state.
   */
  public interventionTrendFor(
    currentPressure01: Score01,
    prior: Nullable<InterventionPolicyPriorState>,
  ): InterventionTrendSignal {
    const nowMs = this.context.clock.now();
    const defaults = this.context.defaults;
    const direction = computeInterventionTrend(currentPressure01, prior, nowMs, defaults);
    const priorValue = prior?.interventionPressure01 ?? clamp01(0);
    return {
      direction,
      deltaPerWindow: currentPressure01 - priorValue,
      priorPressure01: priorValue,
      currentPressure01,
    };
  }

  /** Returns a lifetime health snapshot for dashboard observability. */
  public getHealthReport(): InterventionHealthReport {
    const n = this.totalScoredLifetime;
    return {
      totalScoredLifetime: n,
      totalHardBlockCount: this.totalHardBlockCount,
      totalQuarantineCount: this.totalQuarantineCount,
      totalModerationReviewCount: this.totalModerationReviewCount,
      totalRescueCount: this.totalRescueCount,
      auditLogSize: this.auditLog.length,
      meanInterventionPressure01: n > 0 ? this.totalInterventionPressureSum / n : 0,
      maxInterventionPressure01Lifetime: this.maxInterventionPressureLifetime,
    };
  }

  /** Returns a copy of the internal audit log. Requires `auditTrailEnabled: true`. */
  public getAuditLog(): readonly InterventionAuditEntry[] {
    return [...this.auditLog];
  }

  /** Clears the internal audit log, reclaiming memory. */
  public clearAuditLog(): void {
    this.auditLog.length = 0;
  }
}

// ============================================================================
// MARK: Factories and helpers
// ============================================================================

export function createInterventionPolicyModel(
  options: InterventionPolicyModelOptions = {},
): InterventionPolicyModel {
  return new InterventionPolicyModel(options);
}

export function scoreInterventionPolicyRows(params: Parameters<InterventionPolicyModel['scoreRows']>[0]): InterventionPolicyBatchResult {
  return new InterventionPolicyModel().scoreRows(params);
}

export function scoreInterventionPolicyAggregate(params: Parameters<InterventionPolicyModel['scoreAggregate']>[0]): InterventionPolicyBatchResult {
  return new InterventionPolicyModel().scoreAggregate(params);
}

export function scoreInterventionPolicyInferenceWindow(params: Parameters<InterventionPolicyModel['scoreInferenceWindow']>[0]): InterventionPolicyBatchResult {
  return new InterventionPolicyModel().scoreInferenceWindow(params);
}

export function scoreInterventionPolicyStore(params: Parameters<InterventionPolicyModel['scoreStore']>[0]): InterventionPolicyBatchResult {
  return new InterventionPolicyModel().scoreStore(params);
}

export function scoreInterventionPolicyIngestResult(params: Parameters<InterventionPolicyModel['scoreIngestResult']>[0]): InterventionPolicyBatchResult {
  return new InterventionPolicyModel().scoreIngestResult(params);
}

export function serializeInterventionPolicyScore(score: InterventionPolicyScore): Record<string, JsonValue> {
  return Object.freeze({
    generatedAt: score.generatedAt,
    roomId: score.roomId,
    sessionId: score.sessionId,
    userId: score.userId,
    activeVisibleChannel: score.activeVisibleChannel,
    roomKind: score.roomKind,
    recommendation: score.recommendation,
    urgencyBand: score.urgencyBand,
    severityBand: score.severityBand,
    interventionPressure01: score.interventionPressure01,
    moderationPressure01: score.moderationPressure01,
    rescuePressure01: score.rescuePressure01,
    narrativePressure01: score.narrativePressure01,
    confidence01: score.confidence01,
    recommendedChannel: score.recommendedChannel,
    preferredHelperId: score.preferredHelperId,
    preferredHaterBotId: score.preferredHaterBotId,
    shouldAllowHelper: score.shouldAllowHelper,
    shouldAllowHelperPublic: score.shouldAllowHelperPublic,
    shouldAllowHater: score.shouldAllowHater,
    shouldShadowPrimeHater: score.shouldShadowPrimeHater,
    shouldRedirectChannel: score.shouldRedirectChannel,
    shouldRequestModerationReview: score.shouldRequestModerationReview,
    shouldQuarantine: score.shouldQuarantine,
    shouldHardBlock: score.shouldHardBlock,
    shouldForceRecovery: score.shouldForceRecovery,
    shouldHoldSilence: score.shouldHoldSilence,
    shouldSuppressAllNpc: score.shouldSuppressAllNpc,
    shouldUseTeachingTone: score.shouldUseTeachingTone,
    shouldUseNegotiationCounterplay: score.shouldUseNegotiationCounterplay,
    shouldUsePostRunDebrief: score.shouldUsePostRunDebrief,
    evidenceRowIds: [...score.evidenceRowIds],
    liveopsBoost01: score.liveopsBoost01,
    trendDirection: score.trendDirection,
    hasSiblingConflict: score.hasSiblingConflict,
    laneDecisions: score.laneDecisions.map((entry) => ({
      lane: entry.lane,
      score01: entry.score01,
      active: entry.active,
      note: entry.note,
    })),
    explanationFactors: score.explanationFactors.map((entry) => ({
      key: entry.key,
      signedDelta01: entry.signedDelta01,
      reason: entry.reason,
    })),
    diagnosticsRowCount: score.diagnostics.rowCount,
    diagnosticsFreshnessMs: score.diagnostics.freshnessMs,
    diagnosticsLowEvidence: score.diagnostics.lowEvidence,
    diagnosticsHighPressure: score.diagnostics.highPressure,
    diagnosticsToxicityOverride01: score.diagnostics.toxicityOverride01,
    diagnosticsChurnOverride01: score.diagnostics.churnOverride01,
    diagnosticsChannelMisfit01: score.diagnostics.channelMisfit01,
    metadata: score.metadata,
  });
}

export function hydratePriorInterventionPolicyState(
  payload: Nullable<Readonly<Record<string, JsonValue>>>,
): Nullable<InterventionPolicyPriorState> {
  if (!payload) return null;
  return {
    generatedAt: asUnixMs(safeNumber(payload.generatedAt, Date.now())),
    interventionPressure01: clamp01(safeNumber(payload.interventionPressure01)),
    moderationPressure01: clamp01(safeNumber(payload.moderationPressure01)),
    rescuePressure01: clamp01(safeNumber(payload.rescuePressure01)),
    narrativePressure01: clamp01(safeNumber(payload.narrativePressure01)),
    recommendation: safeString(payload.recommendation, 'SHADOW_STABILIZE') as InterventionRecommendation,
  };
}

export function interventionPolicySummary(score: InterventionPolicyScore): string {
  return [
    `recommendation=${score.recommendation}`,
    `urgency=${score.urgencyBand}`,
    `severity=${score.severityBand}`,
    `intervention=${score.interventionPressure100}`,
    `moderation=${score.moderationPressure100}`,
    `rescue=${score.rescuePressure100}`,
    `helper=${score.helperOpportunity100}`,
    `hater=${score.haterOpportunity100}`,
    `redirect=${score.redirectPressure100}`,
  ].join(' | ');
}

export function interventionPolicyNeedsModeration(score: InterventionPolicyScore): boolean {
  return score.shouldRequestModerationReview || score.shouldQuarantine || score.shouldHardBlock;
}

export function interventionPolicyNeedsRecovery(score: InterventionPolicyScore): boolean {
  return score.shouldForceRecovery || score.shouldAllowHelper;
}

export function interventionPolicyNeedsRedirect(score: InterventionPolicyScore): boolean {
  return score.shouldRedirectChannel && !!score.recommendedChannel;
}

export function interventionPolicyAllowsHater(score: InterventionPolicyScore): boolean {
  return score.shouldAllowHater && !score.shouldHardBlock && !score.shouldQuarantine;
}

// ============================================================================
// MARK: Extended public helpers — predicates, labels, sorting, telemetry
// ============================================================================

/** True when the score is HARD_BLOCK_AND_RESCUE. */
export function interventionIsHardBlock(score: InterventionPolicyScore): boolean {
  return score.shouldHardBlock;
}

/** True when the score calls for any quarantine action. */
export function interventionIsQuarantine(score: InterventionPolicyScore): boolean {
  return score.shouldQuarantine;
}

/** True when moderation and rescue lanes are simultaneously elevated. */
export function interventionHasSiblingConflict(score: InterventionPolicyScore): boolean {
  return score.hasSiblingConflict;
}

/** True when liveops is amplifying the intervention pressure. */
export function interventionIsLiveopsAmplified(score: InterventionPolicyScore): boolean {
  return score.liveopsBoost01 >= 0.05;
}

/** True when the trend is escalating or worsening. */
export function interventionIsEscalating(score: InterventionPolicyScore): boolean {
  return score.trendDirection === 'ESCALATING' || score.trendDirection === 'WORSENING';
}

/** True when the trend is de-escalating or resolved. */
export function interventionIsDeescalating(score: InterventionPolicyScore): boolean {
  return score.trendDirection === 'DE_ESCALATING' || score.trendDirection === 'RESOLVED';
}

/** True when the recommendation should open any helper lane (public or private). */
export function interventionNeedsHelper(score: InterventionPolicyScore): boolean {
  return score.shouldAllowHelper;
}

/** True when the recommendation requires public visibility recovery. */
export function interventionNeedsPublicWitness(score: InterventionPolicyScore): boolean {
  return score.recommendation === 'PUBLIC_WITNESS_RECOVERY';
}

/** True when the recommendation is to hold silence without NPC interference. */
export function interventionIsHoldSilence(score: InterventionPolicyScore): boolean {
  return score.shouldHoldSilence;
}

/** True when the recommendation involves teaching the player. */
export function interventionIsTeaching(score: InterventionPolicyScore): boolean {
  return score.shouldUseTeachingTone;
}

/** True when negotiation counterplay is recommended. */
export function interventionIsNegotiation(score: InterventionPolicyScore): boolean {
  return score.shouldUseNegotiationCounterplay;
}

/** True when the recommendation routes a hater via shadow (non-public) action. */
export function interventionIsShadowHater(score: InterventionPolicyScore): boolean {
  return score.shouldShadowPrimeHater;
}

/** Returns a human-readable recommendation label. */
export function interventionRecommendationLabel(score: InterventionPolicyScore): string {
  switch (score.recommendation) {
    case 'HARD_BLOCK_AND_RESCUE': return 'Hard Block + Rescue';
    case 'MODERATION_QUARANTINE': return 'Moderation Quarantine';
    case 'MODERATION_REVIEW': return 'Moderation Review';
    case 'PUBLIC_WITNESS_RECOVERY': return 'Public Witness Recovery';
    case 'HELPER_PUBLIC_RECOVERY': return 'Helper Public Recovery';
    case 'HELPER_PRIVATE_RECOVERY': return 'Helper Private Recovery';
    case 'SOFT_HELPER_PRIVATE': return 'Soft Helper (Private)';
    case 'TEACHING_WINDOW': return 'Teaching Window';
    case 'CHANNEL_REDIRECT': return 'Channel Redirect';
    case 'NEGOTIATION_COUNTERPLAY': return 'Negotiation Counterplay';
    case 'HATER_PUBLIC_STRIKE': return 'Hater Public Strike';
    case 'HATER_SHADOW_PRIME': return 'Hater Shadow Prime';
    case 'HOLD_SILENCE': return 'Hold Silence';
    case 'SHADOW_STABILIZE': return 'Shadow Stabilize';
    case 'POST_RUN_DEBRIEF': return 'Post-Run Debrief';
    case 'SUPPRESS_ALL_NPC': return 'Suppress All NPC';
  }
}

/** Returns a human-readable urgency band label. */
export function interventionUrgencyLabel(score: InterventionPolicyScore): string {
  switch (score.urgencyBand) {
    case 'CRITICAL': return 'Critical';
    case 'HIGH': return 'High';
    case 'MEDIUM': return 'Medium';
    case 'LOW': return 'Low';
  }
}

/** Returns a human-readable trend label. */
export function interventionTrendLabel(direction: InterventionTrendDirection): string {
  switch (direction) {
    case 'ESCALATING': return 'Escalating (severe)';
    case 'WORSENING': return 'Worsening';
    case 'STABLE': return 'Stable';
    case 'DE_ESCALATING': return 'De-escalating';
    case 'RESOLVED': return 'Resolved';
  }
}

/** Returns a brief natural-language summary of the top explanation factors. */
export function interventionExplanationSummary(score: InterventionPolicyScore): string {
  const top3 = score.explanationFactors.slice(0, 3);
  if (!top3.length) return 'No significant intervention signals.';
  const factors = top3
    .map((f) => `${f.key}(${f.signedDelta01 >= 0 ? '+' : ''}${f.signedDelta01.toFixed(2)})`)
    .join(', ');
  return `${interventionRecommendationLabel(score)} — top factors: ${factors}`;
}

/** Returns a machine-readable telemetry payload for event pipelines. */
export function interventionScoreToTelemetry(
  score: InterventionPolicyScore,
): Readonly<Record<string, string | number | boolean>> {
  return Object.freeze({
    recommendation: score.recommendation,
    urgencyBand: score.urgencyBand,
    severityBand: score.severityBand,
    interventionPressure01: score.interventionPressure01,
    moderationPressure01: score.moderationPressure01,
    rescuePressure01: score.rescuePressure01,
    liveopsBoost01: score.liveopsBoost01,
    trendDirection: score.trendDirection,
    hasSiblingConflict: score.hasSiblingConflict,
    shouldHardBlock: score.shouldHardBlock,
    shouldQuarantine: score.shouldQuarantine,
    shouldAllowHelper: score.shouldAllowHelper,
    shouldHoldSilence: score.shouldHoldSilence,
    confidence01: score.confidence01,
    channel: score.activeVisibleChannel,
    modelVersion: score.modelVersion,
  });
}

/** Comparator for sorting scores descending by interventionPressure01. */
export function interventionScoreCompare(a: InterventionPolicyScore, b: InterventionPolicyScore): number {
  return b.interventionPressure01 - a.interventionPressure01;
}

/** Sorts an array of scores descending by intervention pressure. Non-mutating. */
export function sortInterventionScoresDescending(scores: readonly InterventionPolicyScore[]): InterventionPolicyScore[] {
  return [...scores].sort(interventionScoreCompare);
}

/** Filters to scores that need any active intervention (not silence or suppress). */
export function interventionScoresNeedingAction(scores: readonly InterventionPolicyScore[]): InterventionPolicyScore[] {
  return scores.filter((s) =>
    s.recommendation !== 'SUPPRESS_ALL_NPC' &&
    s.recommendation !== 'HOLD_SILENCE' &&
    s.recommendation !== 'SHADOW_STABILIZE',
  );
}

/** Filters to hard-block scores only. */
export function interventionScoresHardBlock(scores: readonly InterventionPolicyScore[]): InterventionPolicyScore[] {
  return scores.filter(interventionIsHardBlock);
}

/** Filters to escalating-trend scores only. */
export function interventionScoresEscalating(scores: readonly InterventionPolicyScore[]): InterventionPolicyScore[] {
  return scores.filter(interventionIsEscalating);
}

/** Returns confidence as a 0–100 integer for display. */
export function interventionConfidence100(score: InterventionPolicyScore): number {
  return Math.round(score.confidence01 * 100);
}

export const CHAT_INTERVENTION_POLICY_MODEL_NAMESPACE = Object.freeze({
  moduleName: CHAT_INTERVENTION_POLICY_MODEL_MODULE_NAME,
  moduleVersion: CHAT_INTERVENTION_POLICY_MODEL_VERSION,
  runtimeLaws: CHAT_INTERVENTION_POLICY_MODEL_RUNTIME_LAWS,
  defaults: CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS,
  createInterventionPolicyModel,
  scoreInterventionPolicyRows,
  scoreInterventionPolicyAggregate,
  scoreInterventionPolicyInferenceWindow,
  scoreInterventionPolicyStore,
  scoreInterventionPolicyIngestResult,
  serializeInterventionPolicyScore,
  hydratePriorInterventionPolicyState,
  interventionPolicySummary,
  interventionPolicyNeedsModeration,
  interventionPolicyNeedsRecovery,
  interventionPolicyNeedsRedirect,
  interventionPolicyAllowsHater,
  interventionIsHardBlock,
  interventionIsQuarantine,
  interventionHasSiblingConflict,
  interventionIsLiveopsAmplified,
  interventionIsEscalating,
  interventionIsDeescalating,
  interventionNeedsHelper,
  interventionNeedsPublicWitness,
  interventionIsHoldSilence,
  interventionIsTeaching,
  interventionIsNegotiation,
  interventionIsShadowHater,
  interventionRecommendationLabel,
  interventionUrgencyLabel,
  interventionTrendLabel,
  interventionExplanationSummary,
  interventionScoreToTelemetry,
  interventionScoreCompare,
  sortInterventionScoresDescending,
  interventionScoresNeedingAction,
  interventionScoresHardBlock,
  interventionScoresEscalating,
  interventionConfidence100,
});

export default CHAT_INTERVENTION_POLICY_MODEL_NAMESPACE;
