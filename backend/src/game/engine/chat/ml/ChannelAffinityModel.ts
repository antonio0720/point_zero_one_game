/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CHANNEL AFFINITY MODEL
 * FILE: backend/src/game/engine/chat/ml/ChannelAffinityModel.ts
 * VERSION: 2026.03.22
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative online-ML channel-fit model for backend chat orchestration.
 *
 * This file answers a bounded but critical question:
 *
 *   "Which visible chat channel best fits the current player / room / social /
 *    pressure / negotiation / helper / hater posture, and should the backend
 *    advise movement away from the current active channel?"
 *
 * Doctrine
 * --------
 * - advisory for orchestration, never direct channel truth;
 * - reads accepted authoritative aggregates only;
 * - respects switching stress and continuity cost;
 * - combines learning-profile affinity with live scene posture;
 * - treats GLOBAL, SYNDICATE, DEAL_ROOM, and LOBBY as meaningfully different;
 * - remains explainable enough for replay, telemetry, and policy audit;
 * - supports multi-tick trend analysis and scenario simulation for decision
 *   confidence and policy-level review.
 *
 * Why this file is deep
 * ---------------------
 * Channel choice in Point Zero One is not cosmetic:
 * - GLOBAL is a stage — public theater, witness value, crowd amplification;
 * - SYNDICATE is private tactical space — trust, confidentiality, strategy;
 * - DEAL_ROOM is predatory negotiation space — leverage, bluff containment;
 * - LOBBY is recovery / pre-run social space — comfort, onboarding, warmth.
 *
 * So channel fit must weigh:
 * - public witness value,
 * - privacy need,
 * - negotiation pressure,
 * - recovery need,
 * - helper rescue posture,
 * - hater public leak posture,
 * - channel-switch stress and continuity,
 * - durable learning affinity for each lane,
 * - multi-tick trend (is pressure increasing or stabilizing?),
 * - and room-kind-specific biases that make GLOBAL GLOBAL and DEAL_ROOM DEAL_ROOM.
 *
 * Audit / Replay / Telemetry
 * --------------------------
 * Every scored output is paired with explanation factors sorted by absolute
 * magnitude. Batch results include cross-entity comparison surfaces. The model
 * exposes `buildAuditReport`, `simulateChannelShift`, and
 * `buildTrendSummary` for backend observability and offline review.
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
  type ChatSignalEnvelope,
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

// ============================================================================
// MARK: Constants
// ============================================================================

export const CHAT_CHANNEL_AFFINITY_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_CHANNEL_AFFINITY_MODEL' as const;

export const CHAT_CHANNEL_AFFINITY_MODEL_VERSION =
  '2026.03.22-channel-affinity-model.v3' as const;

export const CHAT_CHANNEL_AFFINITY_MODEL_RUNTIME_LAWS = Object.freeze([
  'Channel affinity is advisory for orchestration, not direct room truth.',
  'Another channel must beat switching stress before migration is recommended.',
  'GLOBAL rewards witness, crowd heat, and ceremonial visibility.',
  'SYNDICATE rewards trust, privacy, and tactical continuity.',
  'DEAL_ROOM rewards negotiation pressure, bluff containment, and precise privacy.',
  'LOBBY rewards recovery, onboarding, and low-threat continuity.',
  'Helper timing and hater targeting materially alter channel fit.',
  'The active channel gets continuity credit before a shift is proposed.',
  'Trend analysis uses multi-tick prior state to distinguish momentum from noise.',
  'Scenario simulation is advisory and must not alter live transcript authority.',
] as const);

export const CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS = Object.freeze({
  lowEvidenceFallback01: 0.40,
  lowEvidenceRows: 2,
  baselineBlend01: 0.16,
  migrationBlend01: 0.20,
  privacyBlend01: 0.18,
  activeChannelHoldBonus01: 0.10,
  migrationThreshold01: 0.18,
  hardMigrationThreshold01: 0.32,
  switchStressThreshold01: 0.48,
  cooldownBaseMs: 12_000,
  cooldownMinMs: 4_000,
  cooldownMaxMs: 45_000,
  explanationFactorLimit: 12,
  trendWindowTicks: 4,
  trendMomentumWeight01: 0.22,
  scenarioContrastThreshold01: 0.12,
  roomKindGlobalBias01: 0.05,
  roomKindSyndicateBias01: 0.06,
  roomKindDealRoomBias01: 0.04,
  roomKindLobbyBias01: 0.07,
  pressureGlobalPenalty01: 0.06,
  pressureSyndicateBonus01: 0.04,
  pressureDealRoomBonus01: 0.08,
  congestThreshold01: 0.78,
  congestLobbyBonus01: 0.06,
  affinityDecayHalfLifeTicks: 8,
  affinityDecayMinimum01: 0.10,
  batchSoftCapEntities: 64,
} as const);

// ============================================================================
// MARK: Channel profile constants
// ============================================================================

export const CHANNEL_STAGE_PROFILES = Object.freeze({
  GLOBAL: Object.freeze({
    witnessWeight: 0.28,
    crowdWeight: 0.26,
    privacyPenaltyWeight: 0.22,
    negotiationPenaltyWeight: 0.10,
    haterLeakBonus: 0.14,
    helperWitnessBonus: 0.12,
    visibilityWeight: 0.12,
    label: 'Public Stage',
    docString: 'Rewards theatrical presence, crowd heat, and witness moments.',
  }),
  SYNDICATE: Object.freeze({
    trustWeight: 0.18,
    privacyWeight: 0.20,
    recoveryWeight: 0.16,
    cadenceWeight: 0.08,
    crowdPenaltyWeight: 0.06,
    affinityWeight: 0.28,
    label: 'Tactical Private',
    docString: 'Rewards trust, confidentiality, and strategic continuity.',
  }),
  DEAL_ROOM: Object.freeze({
    negotiationWeight: 0.30,
    privacyWeight: 0.18,
    bluffWeight: 0.12,
    recoveryPenaltyWeight: 0.10,
    crowdPenaltyWeight: 0.04,
    affinityWeight: 0.26,
    label: 'Predatory Negotiation',
    docString: 'Rewards leverage, bluff containment, and pressure management.',
  }),
  LOBBY: Object.freeze({
    recoveryWeight: 0.22,
    teachingWeight: 0.16,
    lowThreatWeight: 0.12,
    publicPenaltyWeight: 0.06,
    negotiationPenaltyWeight: 0.08,
    affinityWeight: 0.28,
    label: 'Recovery / Social',
    docString: 'Rewards recovery, onboarding warmth, and low-threat continuity.',
  }),
} as const);

// ============================================================================
// MARK: Ports and options
// ============================================================================

export interface ChannelAffinityModelLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChannelAffinityModelClockPort {
  now(): UnixMs;
}

export interface ChannelAffinityModelOptions {
  readonly logger?: ChannelAffinityModelLoggerPort;
  readonly clock?: ChannelAffinityModelClockPort;
  readonly defaults?: Partial<typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS>;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
}

export interface ChannelAffinityModelContext {
  readonly logger: ChannelAffinityModelLoggerPort;
  readonly clock: ChannelAffinityModelClockPort;
  readonly defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS;
  readonly runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
}

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type ChannelAffinityRecommendation =
  | 'HOLD_CURRENT'
  | 'SHIFT_TO_GLOBAL'
  | 'SHIFT_TO_SYNDICATE'
  | 'SHIFT_TO_DEAL_ROOM'
  | 'SHIFT_TO_LOBBY'
  | 'SPLIT_CURRENT_AND_PRIVATE'
  | 'SPLIT_CURRENT_AND_GLOBAL'
  | 'NO_CHANGE';

export type ChannelAffinityTrendDirection =
  | 'STABILIZING'
  | 'DRIFTING_PRIVATE'
  | 'DRIFTING_PUBLIC'
  | 'DRIFTING_NEGOTIATION'
  | 'DRIFTING_RECOVERY'
  | 'VOLATILE'
  | 'FLAT';

export type ChannelCongestLevel = 'CLEAR' | 'MODERATE' | 'CONGESTED';

export type ChannelAffinityConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface ChannelScoreMap {
  readonly GLOBAL: Score01;
  readonly SYNDICATE: Score01;
  readonly DEAL_ROOM: Score01;
  readonly LOBBY: Score01;
}

export interface ChannelAffinityExplanationFactor {
  readonly key: string;
  readonly signedDelta01: number;
  readonly magnitude: 'MINOR' | 'MODERATE' | 'MAJOR' | 'DECISIVE';
  readonly reason: string;
}

export interface ChannelAffinityPriorState {
  readonly activeChannelFitness01: Score01;
  readonly migrationPressure01: Score01;
  readonly privacyNeed01: Score01;
  readonly recommendedPrimaryChannel: ChatVisibleChannel;
  readonly generatedAt: UnixMs;
}

export interface ChannelAffinityTrendSummary {
  readonly direction: ChannelAffinityTrendDirection;
  readonly momentum01: Score01;
  readonly stability01: Score01;
  readonly ticksObserved: number;
  readonly dominantChannel: ChatVisibleChannel;
  readonly isConverging: boolean;
  readonly priorSnapshots: readonly ChannelAffinityPriorSnapshot[];
}

export interface ChannelAffinityPriorSnapshot {
  readonly generatedAt: UnixMs;
  readonly activeChannelFitness01: Score01;
  readonly migrationPressure01: Score01;
  readonly recommendedPrimaryChannel: ChatVisibleChannel;
}

export interface ChannelAffinityScenario {
  readonly targetChannel: ChatVisibleChannel;
  readonly projectedFitness01: Score01;
  readonly migrationCostEstimate01: Score01;
  readonly netGain01: Score01;
  readonly worthMigrating: boolean;
  readonly projectedCooldownMs: number;
  readonly rationale: string;
}

export interface ChannelAffinityAuditReport {
  readonly reportId: string;
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly userId: Nullable<string>;
  readonly modelVersion: typeof CHAT_CHANNEL_AFFINITY_MODEL_VERSION;
  readonly activeChannel: ChatVisibleChannel;
  readonly recommendation: ChannelAffinityRecommendation;
  readonly scores: ChannelScoreMap;
  readonly rankedChannels: readonly ChatVisibleChannel[];
  readonly activeChannelFitness01: Score01;
  readonly migrationPressure01: Score01;
  readonly privacyNeed01: Score01;
  readonly crowdNeed01: Score01;
  readonly negotiationNeed01: Score01;
  readonly recoveryNeed01: Score01;
  readonly volatility01: Score01;
  readonly confidence01: Score100;
  readonly confidenceLevel: ChannelAffinityConfidenceLevel;
  readonly congestLevel: ChannelCongestLevel;
  readonly trendSummary: Nullable<ChannelAffinityTrendSummary>;
  readonly scenarios: readonly ChannelAffinityScenario[];
  readonly explanationFactors: readonly ChannelAffinityExplanationFactor[];
  readonly runtimeLaws: readonly string[];
  readonly evidenceRowCount: number;
  readonly freshnessMs: number;
}

export interface ChannelAffinityModelInput {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<string>;
  readonly userId: Nullable<string>;
  readonly roomKind: ChatRoomKind | 'UNKNOWN';
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly pressureTier: PressureTier;
  readonly roomHeat01: Score01;
  readonly hostileMomentum01: Score01;
  readonly churnRisk01: Score01;
  readonly responseCadence01: Score01;
  readonly recentPlayerShare01: Score01;
  readonly recentNpcShare01: Score01;
  readonly helperReceptivity01: Score01;
  readonly helperIgnore01: Score01;
  readonly helperDensity01: Score01;
  readonly rescueOpportunity01: Score01;
  readonly visibilityExposure01: Score01;
  readonly switchStress01: Score01;
  readonly averageMessageLength01: Score01;
  readonly confidence01: Score01;
  readonly intimidation01: Score01;
  readonly frustration01: Score01;
  readonly embarrassment01: Score01;
  readonly curiosity01: Score01;
  readonly attachment01: Score01;
  readonly trust01: Score01;
  readonly dominance01: Score01;
  readonly desperation01: Score01;
  readonly relief01: Score01;
  readonly toxicityRisk01: Score01;
  readonly negativeSwarm01: Score01;
  readonly positiveSwarm01: Score01;
  readonly nearSovereignty01: Score01;
  readonly bluffExposure01: Score01;
  readonly bankruptcyRisk01: Score01;
  readonly negotiationIntensity01: Score01;
  readonly dealPressure01: Score01;
  readonly channelSwitchVelocity01: Score01;
  readonly affinityGlobal01: Score01;
  readonly affinitySyndicate01: Score01;
  readonly affinityDealRoom01: Score01;
  readonly affinityLobby01: Score01;
  readonly liveopsHelperBlackout01: Score01;
  readonly liveopsHaterRaid01: Score01;
  readonly engagement: Nullable<EngagementModelScore>;
  readonly engagementPrior: Nullable<EngagementModelPriorState>;
  readonly hater: Nullable<HaterTargetingScore>;
  readonly haterPrior: Nullable<HaterTargetingPriorState>;
  readonly helper: Nullable<HelperTimingScore>;
  readonly helperPrior: Nullable<HelperTimingPriorState>;
  readonly learningProfile: Nullable<ChatLearningProfile>;
  readonly sourceSignal: Nullable<ChatSignalEnvelope>;
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly evidenceRows: readonly ChatFeatureRow[];
}

export interface ChannelAffinityScore {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<string>;
  readonly userId: Nullable<string>;
  readonly roomKind: ChatRoomKind | 'UNKNOWN';
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly scores: ChannelScoreMap;
  readonly rankedChannels: readonly ChatVisibleChannel[];
  readonly recommendedPrimaryChannel: ChatVisibleChannel;
  readonly recommendedSecondaryChannel: Nullable<ChatVisibleChannel>;
  readonly activeChannelFitness01: Score01;
  readonly migrationPressure01: Score01;
  readonly privacyNeed01: Score01;
  readonly crowdNeed01: Score01;
  readonly negotiationNeed01: Score01;
  readonly recoveryNeed01: Score01;
  readonly volatility01: Score01;
  readonly congestLevel: ChannelCongestLevel;
  readonly recommendation: ChannelAffinityRecommendation;
  readonly shouldMigrate: boolean;
  readonly shouldOpenSecondaryChannel: boolean;
  readonly cooldownMs: number;
  readonly evidenceRowIds: readonly string[];
  readonly explanationFactors: readonly ChannelAffinityExplanationFactor[];
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly confidence01: Score100;
  readonly confidenceLevel: ChannelAffinityConfidenceLevel;
  readonly modelVersion: typeof CHAT_CHANNEL_AFFINITY_MODEL_VERSION;
}

export interface ChannelAffinityBatchResult {
  readonly generatedAt: UnixMs;
  readonly scores: readonly ChannelAffinityScore[];
  readonly strongestMigration: Nullable<ChannelAffinityScore>;
  readonly strongestHold: Nullable<ChannelAffinityScore>;
  readonly channelDistribution: Readonly<Record<ChatVisibleChannel, number>>;
  readonly averageMigrationPressure01: Score01;
  readonly averageActiveChannelFitness01: Score01;
  readonly entityCount: number;
}

// ============================================================================
// MARK: Defaults and low-level utilities
// ============================================================================

const DEFAULT_LOGGER: ChannelAffinityModelLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLOCK: ChannelAffinityModelClockPort = {
  now: () => asUnixMs(Date.now()),
};

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asScore(value: number): Score01 {
  return clamp01(value) as Score01;
}

function asScore100(value: number): Score100 {
  return clamp100(value) as Score100;
}

function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((v) => Math.pow(v - avg, 2))));
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Array.from(new Set(values));
}

function pickScalar(
  aggregate: Pick<ChatOnlineFeatureAggregate, 'scalarFeatures'> | Pick<ChatOnlineInferenceWindow, 'scalarFeatures'>,
  key: string,
  fallback = 0,
): Score01 {
  return asScore(safeNumber(aggregate.scalarFeatures[key], fallback));
}

function pickCategorical(
  aggregate: Pick<ChatOnlineFeatureAggregate, 'categoricalFeatures'> | Pick<ChatOnlineInferenceWindow, 'categoricalFeatures'>,
  key: string,
  fallback: string,
): string {
  const value = aggregate.categoricalFeatures[key];
  return typeof value === 'string' && value.length ? value : fallback;
}

function normalizeRoomKind(value: unknown): ChatRoomKind | 'UNKNOWN' {
  return typeof value === 'string' && value.length ? (value as ChatRoomKind) : 'UNKNOWN';
}

function normalizeChannel(value: unknown, fallback: ChatVisibleChannel): ChatVisibleChannel {
  if (value === 'GLOBAL' || value === 'SYNDICATE' || value === 'DEAL_ROOM' || value === 'LOBBY') {
    return value;
  }
  return fallback;
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
  return 'NONE';
}

function lowEvidence(input: ChannelAffinityModelInput, defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS): boolean {
  return input.evidenceRows.length <= defaults.lowEvidenceRows;
}

function activeAffinity01(input: ChannelAffinityModelInput): Score01 {
  switch (input.activeVisibleChannel) {
    case 'GLOBAL': return input.affinityGlobal01;
    case 'SYNDICATE': return input.affinitySyndicate01;
    case 'DEAL_ROOM': return input.affinityDealRoom01;
    case 'LOBBY': return input.affinityLobby01;
    default: return asScore(0.25);
  }
}

function pressureWeight01(tier: PressureTier): number {
  switch (tier) {
    case 'NONE': return 0;
    case 'BUILDING': return 0.22;
    case 'ELEVATED': return 0.46;
    case 'HIGH': return 0.72;
    case 'CRITICAL': return 1;
    default: return 0.30;
  }
}

function roomKindChannelBias(
  roomKind: ChatRoomKind | 'UNKNOWN',
  channel: ChatVisibleChannel,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
): number {
  switch (channel) {
    case 'GLOBAL':
      return roomKind === 'GLOBAL' ? defaults.roomKindGlobalBias01 : roomKind === 'DEAL_ROOM' ? -0.04 : 0;
    case 'SYNDICATE':
      return roomKind === 'SYNDICATE' ? defaults.roomKindSyndicateBias01 : 0;
    case 'DEAL_ROOM':
      return roomKind === 'DEAL_ROOM' ? defaults.roomKindDealRoomBias01 : 0;
    case 'LOBBY':
      return roomKind === 'LOBBY' ? defaults.roomKindLobbyBias01 : 0;
    default:
      return 0;
  }
}

function confidenceLevelFor(confidence100: Score100): ChannelAffinityConfidenceLevel {
  const v = confidence100 as number;
  if (v >= 78) return 'VERY_HIGH';
  if (v >= 56) return 'HIGH';
  if (v >= 34) return 'MEDIUM';
  return 'LOW';
}

function explanationMagnitude(abs: number): ChannelAffinityExplanationFactor['magnitude'] {
  if (abs >= 0.18) return 'DECISIVE';
  if (abs >= 0.10) return 'MAJOR';
  if (abs >= 0.05) return 'MODERATE';
  return 'MINOR';
}

function computeCongestLevel(
  input: ChannelAffinityModelInput,
  scores: ChannelScoreMap,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
): ChannelCongestLevel {
  const maxScore = Math.max(...Object.values(scores).map((s) => s as number));
  const spread = maxScore - Math.min(...Object.values(scores).map((s) => s as number));
  if (spread < 0.08 && input.channelSwitchVelocity01 >= defaults.congestThreshold01) return 'CONGESTED';
  if (spread < 0.14) return 'MODERATE';
  return 'CLEAR';
}

// ============================================================================
// MARK: Component scorers
// ============================================================================

function computeVolatility01(rows: readonly ChatFeatureRow[]): Score01 {
  if (rows.length < 3) return asScore(0.16);
  const heat = rows.map((row) => safeNumber(row.scalarFeatures.roomHeat01, 0));
  const switches = rows.map((row) => safeNumber(row.scalarFeatures.channelSwitchVelocity01, 0));
  const negotiation = rows.map((row) => safeNumber(row.scalarFeatures.negotiationIntensity01, 0));
  const visibility = rows.map((row) => safeNumber(row.scalarFeatures.visibilityExposure01, 0));
  const confidence = rows.map((row) => safeNumber(row.scalarFeatures.confidence01, 0));
  const series = [heat, switches, negotiation, visibility, confidence];
  const deviations = series.map((values) => {
    const avg = mean(values);
    return mean(values.map((value) => Math.abs(value - avg)));
  });
  return asScore(mean(deviations) * 1.22);
}

function computePrivacyNeed01(input: ChannelAffinityModelInput): Score01 {
  const embarrassment = (input.embarrassment01 as number) * 0.22;
  const intimidation = (input.intimidation01 as number) * 0.18;
  const negotiation = (input.negotiationIntensity01 as number) * 0.14;
  const desperation = (input.desperation01 as number) * 0.08;
  const helperRescue = input.helper ? (input.helper.rescueWindow01 as number) * 0.10 : 0;
  const bluffExposure = (input.bluffExposure01 as number) * 0.08;
  const frustration = (input.frustration01 as number) * 0.06;
  const trustBonus = Math.max(0, 0.56 - (input.trust01 as number)) * 0.06;
  return asScore(embarrassment + intimidation + negotiation + desperation + helperRescue + bluffExposure + frustration + trustBonus);
}

function computeCrowdNeed01(input: ChannelAffinityModelInput): Score01 {
  const visibility = (input.visibilityExposure01 as number) * 0.18;
  const positiveSwarm = (input.positiveSwarm01 as number) * 0.16;
  const witness = input.helper ? (input.helper.witnessNeed01 as number) * 0.16 : 0;
  const haterLeak = input.hater ? (input.hater.publicLeak01 as number) * 0.12 : 0;
  const sovereignty = (input.nearSovereignty01 as number) * 0.10;
  const dominance = (input.dominance01 as number) * 0.08;
  const relief = Math.max(0, (input.relief01 as number) - 0.30) * 0.06;
  return asScore(visibility + positiveSwarm + witness + haterLeak + sovereignty + dominance + relief);
}

function computeNegotiationNeed01(input: ChannelAffinityModelInput): Score01 {
  const negotiation = (input.negotiationIntensity01 as number) * 0.34;
  const dealPressure = (input.dealPressure01 as number) * 0.24;
  const bluff = (input.bluffExposure01 as number) * 0.18;
  const bankruptcy = (input.bankruptcyRisk01 as number) * 0.10;
  const dominance = (input.dominance01 as number) * 0.08;
  const signalNegotiation = input.sourceSignal?.economy?.activeDealCount
    ? Math.min(input.sourceSignal.economy.activeDealCount * 0.06, 0.18)
    : 0;
  return asScore(negotiation + dealPressure + bluff + bankruptcy + dominance + signalNegotiation);
}

function computeRecoveryNeed01(input: ChannelAffinityModelInput): Score01 {
  const rescue = input.helper ? (input.helper.rescueWindow01 as number) * 0.22 : 0.10;
  const churn = (input.churnRisk01 as number) * 0.16;
  const frustration = (input.frustration01 as number) * 0.14;
  const embarrassment = (input.embarrassment01 as number) * 0.10;
  const lowRelief = Math.max(0, 0.46 - (input.relief01 as number)) * 0.08;
  const helperIgnore = (input.helperIgnore01 as number) * 0.06;
  const desperationBonus = (input.desperation01 as number) * 0.08;
  return asScore(rescue + churn + frustration + embarrassment + lowRelief + helperIgnore + desperationBonus);
}

function scoreGlobalChannel(
  input: ChannelAffinityModelInput,
  crowdNeed01: Score01,
  privacyNeed01: Score01,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
): Score01 {
  const affinity = (input.affinityGlobal01 as number) * 0.30;
  const crowd = (crowdNeed01 as number) * 0.28;
  const haterPublic = input.hater ? (input.hater.publicLeak01 as number) * 0.14 : 0;
  const witness = input.helper ? (input.helper.witnessNeed01 as number) * 0.12 : 0;
  const visibility = (input.visibilityExposure01 as number) * 0.12;
  const privacyPenalty = (privacyNeed01 as number) * 0.22;
  const negotiationPenalty = (input.negotiationIntensity01 as number) * 0.10;
  const pressurePenalty = pressureWeight01(input.pressureTier) * defaults.pressureGlobalPenalty01;
  const roomBias = roomKindChannelBias(input.roomKind, 'GLOBAL', defaults);
  const sovereigntyBonus = (input.nearSovereignty01 as number) * 0.08;
  return asScore(affinity + crowd + haterPublic + witness + visibility + sovereigntyBonus + roomBias - privacyPenalty - negotiationPenalty - pressurePenalty);
}

function scoreSyndicateChannel(
  input: ChannelAffinityModelInput,
  privacyNeed01: Score01,
  recoveryNeed01: Score01,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
): Score01 {
  const affinity = (input.affinitySyndicate01 as number) * 0.28;
  const trust = (input.trust01 as number) * 0.18;
  const privacy = (privacyNeed01 as number) * 0.20;
  const recovery = (recoveryNeed01 as number) * 0.16;
  const cadence = (input.responseCadence01 as number) * 0.08;
  const crowdPenalty = (input.positiveSwarm01 as number) * 0.06;
  const pressureBonus = pressureWeight01(input.pressureTier) * defaults.pressureSyndicateBonus01;
  const roomBias = roomKindChannelBias(input.roomKind, 'SYNDICATE', defaults);
  return asScore(affinity + trust + privacy + recovery + cadence + pressureBonus + roomBias - crowdPenalty);
}

function scoreDealRoomChannel(
  input: ChannelAffinityModelInput,
  privacyNeed01: Score01,
  negotiationNeed01: Score01,
  recoveryNeed01: Score01,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
): Score01 {
  const affinity = (input.affinityDealRoom01 as number) * 0.26;
  const negotiation = (negotiationNeed01 as number) * 0.30;
  const privacy = (privacyNeed01 as number) * 0.18;
  const bluff = (input.bluffExposure01 as number) * 0.12;
  const recoveryPenalty = (recoveryNeed01 as number) * 0.10;
  const crowdPenalty = (input.positiveSwarm01 as number) * 0.04;
  const pressureBonus = pressureWeight01(input.pressureTier) * defaults.pressureDealRoomBonus01;
  const roomBias = roomKindChannelBias(input.roomKind, 'DEAL_ROOM', defaults);
  return asScore(affinity + negotiation + privacy + bluff + pressureBonus + roomBias - recoveryPenalty - crowdPenalty);
}

function scoreLobbyChannel(
  input: ChannelAffinityModelInput,
  recoveryNeed01: Score01,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
): Score01 {
  const affinity = (input.affinityLobby01 as number) * 0.28;
  const recovery = (recoveryNeed01 as number) * 0.22;
  const teaching = input.helper ? (input.helper.teachingWindow01 as number) * 0.16 : 0.08;
  const lowThreat = Math.max(0, 0.58 - (input.hostileMomentum01 as number)) * 0.12;
  const publicPenalty = (input.visibilityExposure01 as number) * 0.06;
  const negotiationPenalty = (input.negotiationIntensity01 as number) * 0.08;
  const roomBias = roomKindChannelBias(input.roomKind, 'LOBBY', defaults);
  const congestBonus = (input.channelSwitchVelocity01 as number) >= defaults.congestThreshold01 ? defaults.congestLobbyBonus01 : 0;
  return asScore(affinity + recovery + teaching + lowThreat + congestBonus + roomBias - publicPenalty - negotiationPenalty);
}

function computeActiveChannelFitness01(
  input: ChannelAffinityModelInput,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
  scores: ChannelScoreMap,
): Score01 {
  const current = scores[input.activeVisibleChannel] ?? asScore(defaults.lowEvidenceFallback01);
  const continuity = (activeAffinity01(input) as number) * defaults.activeChannelHoldBonus01;
  const cadence = (input.responseCadence01 as number) * 0.08;
  const overloadPenalty = (input.switchStress01 as number) * 0.10;
  const helperRescueBonus = input.helper?.shouldIntervenePublicly ? 0.04 : 0;
  return asScore((current as number) + continuity + cadence + helperRescueBonus - overloadPenalty);
}

function computeMigrationPressure01(
  input: ChannelAffinityModelInput,
  scores: ChannelScoreMap,
  activeChannelFitness01: Score01,
  volatility01: Score01,
): Score01 {
  const ordered = channelOrder(scores);
  const topChannel = ordered[0];
  const topScore = scores[topChannel];
  const delta = Math.max(0, (topScore as number) - (activeChannelFitness01 as number));
  const switchStressPenalty = (input.switchStress01 as number) * 0.18;
  const volatilityPenalty = (volatility01 as number) * 0.10;
  const helperSignal = input.helper && !input.helper.shouldIntervenePublicly && topChannel !== input.activeVisibleChannel
    ? (input.helper.rescueWindow01 as number) * 0.06
    : 0;
  const haterSignal = input.hater?.shouldLeakToGlobal && topChannel === 'GLOBAL' ? 0.04 : 0;
  return asScore(delta + helperSignal + haterSignal - switchStressPenalty - volatilityPenalty);
}

function channelOrder(scores: ChannelScoreMap): readonly ChatVisibleChannel[] {
  return Object.freeze(
    (['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as const)
      .slice()
      .sort((left, right) => (scores[right] as number) - (scores[left] as number)),
  );
}

function recommendationForAffinity(
  input: ChannelAffinityModelInput,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
  scores: ChannelScoreMap,
  activeChannelFitness01: Score01,
  migrationPressure01: Score01,
  privacyNeed01: Score01,
  crowdNeed01: Score01,
  negotiationNeed01: Score01,
  recoveryNeed01: Score01,
): ChannelAffinityRecommendation {
  const ordered = channelOrder(scores);
  const primary = ordered[0];
  const secondary = ordered[1];

  if ((migrationPressure01 as number) < defaults.migrationThreshold01) {
    return 'HOLD_CURRENT';
  }

  if ((migrationPressure01 as number) >= defaults.hardMigrationThreshold01 && primary !== input.activeVisibleChannel) {
    if (primary === 'GLOBAL') return 'SHIFT_TO_GLOBAL';
    if (primary === 'SYNDICATE') return 'SHIFT_TO_SYNDICATE';
    if (primary === 'DEAL_ROOM') return 'SHIFT_TO_DEAL_ROOM';
    return 'SHIFT_TO_LOBBY';
  }

  if ((privacyNeed01 as number) >= 0.60 && (crowdNeed01 as number) >= 0.52 && secondary === 'SYNDICATE') {
    return 'SPLIT_CURRENT_AND_PRIVATE';
  }

  if ((crowdNeed01 as number) >= 0.68 && primary === 'GLOBAL' && input.activeVisibleChannel !== 'GLOBAL') {
    return 'SPLIT_CURRENT_AND_GLOBAL';
  }

  if ((negotiationNeed01 as number) >= 0.60 && primary === 'DEAL_ROOM') {
    return 'SHIFT_TO_DEAL_ROOM';
  }

  if ((recoveryNeed01 as number) >= 0.58 && primary === 'LOBBY') {
    return 'SHIFT_TO_LOBBY';
  }

  return primary === input.activeVisibleChannel ? 'NO_CHANGE' : 'HOLD_CURRENT';
}

function computeCooldownMs(
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
  migrationPressure01: Score01,
  switchStress01: Score01,
): number {
  const raw =
    defaults.cooldownBaseMs -
    (migrationPressure01 as number) * 5_000 +
    (switchStress01 as number) * 8_000;
  return Math.max(defaults.cooldownMinMs, Math.min(defaults.cooldownMaxMs, Math.round(raw)));
}

function explanationFactorsForAffinity(
  input: ChannelAffinityModelInput,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
  score: {
    readonly activeChannelFitness01: Score01;
    readonly migrationPressure01: Score01;
    readonly privacyNeed01: Score01;
    readonly crowdNeed01: Score01;
    readonly negotiationNeed01: Score01;
    readonly recoveryNeed01: Score01;
    readonly scores: ChannelScoreMap;
  },
): readonly ChannelAffinityExplanationFactor[] {
  const factors: ChannelAffinityExplanationFactor[] = [
    {
      key: 'active_channel_fitness',
      signedDelta01: (score.activeChannelFitness01 as number) * 0.20,
      magnitude: 'MAJOR',
      reason: 'Current channel fitness captures continuity, affinity, and present-scene coherence.',
    },
    {
      key: 'migration_pressure',
      signedDelta01: (score.migrationPressure01 as number) * 0.24,
      magnitude: 'MAJOR',
      reason: 'Migration pressure measures how much another lane materially outperforms the active one.',
    },
    {
      key: 'privacy_need',
      signedDelta01: (score.privacyNeed01 as number) * 0.18,
      magnitude: explanationMagnitude((score.privacyNeed01 as number) * 0.18),
      reason: 'Privacy need favors tactical and low-exposure channels.',
    },
    {
      key: 'crowd_need',
      signedDelta01: (score.crowdNeed01 as number) * 0.16,
      magnitude: explanationMagnitude((score.crowdNeed01 as number) * 0.16),
      reason: 'Crowd need favors theatrical channels when witness and stage value matter.',
    },
    {
      key: 'negotiation_need',
      signedDelta01: (score.negotiationNeed01 as number) * 0.14,
      magnitude: explanationMagnitude((score.negotiationNeed01 as number) * 0.14),
      reason: 'Negotiation need favors channels that protect bluffing and offer leverage.',
    },
    {
      key: 'recovery_need',
      signedDelta01: (score.recoveryNeed01 as number) * 0.12,
      magnitude: explanationMagnitude((score.recoveryNeed01 as number) * 0.12),
      reason: 'Recovery need favors channels that reduce social bleed and rebuild continuity.',
    },
    {
      key: 'global_score',
      signedDelta01: (score.scores.GLOBAL as number) * 0.08,
      magnitude: explanationMagnitude((score.scores.GLOBAL as number) * 0.08),
      reason: 'Global score measures public-stage fit.',
    },
    {
      key: 'syndicate_score',
      signedDelta01: (score.scores.SYNDICATE as number) * 0.08,
      magnitude: explanationMagnitude((score.scores.SYNDICATE as number) * 0.08),
      reason: 'Syndicate score measures private tactical fit.',
    },
    {
      key: 'deal_room_score',
      signedDelta01: (score.scores.DEAL_ROOM as number) * 0.08,
      magnitude: explanationMagnitude((score.scores.DEAL_ROOM as number) * 0.08),
      reason: 'Deal-room score measures negotiation-specific fit.',
    },
    {
      key: 'lobby_score',
      signedDelta01: (score.scores.LOBBY as number) * 0.08,
      magnitude: explanationMagnitude((score.scores.LOBBY as number) * 0.08),
      reason: 'Lobby score measures recovery and low-threat fit.',
    },
  ];

  if (input.helper) {
    const delta = input.helper.shouldIntervenePublicly ? 0.10 : -0.04;
    factors.push({
      key: 'helper_posture',
      signedDelta01: delta,
      magnitude: explanationMagnitude(Math.abs(delta)),
      reason: 'Helper posture changes whether witness value or private stabilization dominates.',
    });
  }

  if (input.hater) {
    const delta = input.hater.shouldLeakToGlobal ? 0.10 : (input.hater.shadowPriming01 as number) * -0.04;
    factors.push({
      key: 'hater_posture',
      signedDelta01: delta,
      magnitude: explanationMagnitude(Math.abs(delta)),
      reason: 'Hater posture changes whether the scene wants public theater or shadow containment.',
    });
  }

  if ((input.toxicityRisk01 as number) >= 0.52) {
    const delta = -(input.toxicityRisk01 as number) * 0.06;
    factors.push({
      key: 'toxicity_risk',
      signedDelta01: delta,
      magnitude: explanationMagnitude(Math.abs(delta)),
      reason: 'Elevated toxicity risk penalizes public-stage fit and favors private channels.',
    });
  }

  if ((input.nearSovereignty01 as number) >= 0.48) {
    const delta = (input.nearSovereignty01 as number) * 0.08;
    factors.push({
      key: 'near_sovereignty',
      signedDelta01: delta,
      magnitude: explanationMagnitude(Math.abs(delta)),
      reason: 'Sovereignty proximity amplifies public-stage pressure and witness value.',
    });
  }

  return Object.freeze(
    factors
      .map((f) => Object.freeze(f))
      .sort((left, right) => Math.abs(right.signedDelta01) - Math.abs(left.signedDelta01))
      .slice(0, defaults.explanationFactorLimit),
  );
}

// ============================================================================
// MARK: Trend analysis
// ============================================================================

function buildTrendSummary(
  priors: readonly ChannelAffinityPriorState[],
  currentScore: ChannelAffinityScore,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
): ChannelAffinityTrendSummary {
  const snapshots: ChannelAffinityPriorSnapshot[] = priors.map((p) => ({
    generatedAt: p.generatedAt,
    activeChannelFitness01: p.activeChannelFitness01,
    migrationPressure01: p.migrationPressure01,
    recommendedPrimaryChannel: p.recommendedPrimaryChannel,
  }));

  const recentSnapshots = snapshots.slice(0, defaults.trendWindowTicks);

  if (!recentSnapshots.length) {
    return Object.freeze({
      direction: 'FLAT',
      momentum01: asScore(0),
      stability01: asScore(0.5),
      ticksObserved: 0,
      dominantChannel: currentScore.recommendedPrimaryChannel,
      isConverging: false,
      priorSnapshots: Object.freeze([]),
    });
  }

  const pressureSeries = recentSnapshots.map((s) => s.migrationPressure01 as number);
  const fitnessSeries = recentSnapshots.map((s) => s.activeChannelFitness01 as number);
  const pressureMean = mean(pressureSeries);
  const pressureStddev = stddev(pressureSeries);
  const fitnessStddev = stddev(fitnessSeries);
  const totalStddev = (pressureStddev + fitnessStddev) / 2;

  const channelVotes = recentSnapshots.map((s) => s.recommendedPrimaryChannel);
  const channelCounts = new Map<ChatVisibleChannel, number>();
  for (const ch of channelVotes) channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
  const dominantChannel = [...channelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? currentScore.recommendedPrimaryChannel;

  const isConverging = dominantChannel === currentScore.recommendedPrimaryChannel &&
    channelCounts.get(dominantChannel)! >= Math.ceil(recentSnapshots.length * 0.6);

  let direction: ChannelAffinityTrendDirection = 'FLAT';
  if (totalStddev >= 0.14) {
    direction = 'VOLATILE';
  } else if (pressureMean >= 0.36) {
    switch (dominantChannel) {
      case 'GLOBAL': direction = 'DRIFTING_PUBLIC'; break;
      case 'SYNDICATE': direction = 'DRIFTING_PRIVATE'; break;
      case 'DEAL_ROOM': direction = 'DRIFTING_NEGOTIATION'; break;
      case 'LOBBY': direction = 'DRIFTING_RECOVERY'; break;
      default: direction = 'FLAT';
    }
  } else if (pressureMean < 0.16 && totalStddev < 0.06) {
    direction = 'STABILIZING';
  }

  const momentum01 = asScore(pressureMean * defaults.trendMomentumWeight01 * (isConverging ? 1.2 : 0.8));
  const stability01 = asScore(Math.max(0, 1 - totalStddev * 2.5));

  return Object.freeze({
    direction,
    momentum01,
    stability01,
    ticksObserved: recentSnapshots.length,
    dominantChannel,
    isConverging,
    priorSnapshots: Object.freeze(recentSnapshots.map((s) => Object.freeze(s))),
  });
}

// ============================================================================
// MARK: Scenario simulation
// ============================================================================

function simulateChannelShift(
  input: ChannelAffinityModelInput,
  scores: ChannelScoreMap,
  activeChannelFitness01: Score01,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
): readonly ChannelAffinityScenario[] {
  const allChannels: readonly ChatVisibleChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];

  return Object.freeze(
    allChannels.map((channel): ChannelAffinityScenario => {
      const targetScore = scores[channel] as number;
      const currentFitness = activeChannelFitness01 as number;
      const migrationCost = (input.switchStress01 as number) * 0.40 + 0.06;
      const netGain = Math.max(-1, targetScore - currentFitness - migrationCost);
      const worthMigrating = netGain >= defaults.scenarioContrastThreshold01 && channel !== input.activeVisibleChannel;
      const projectedCooldown = computeCooldownMs(defaults, asScore(Math.abs(netGain)), input.switchStress01);

      let rationale: string;
      if (channel === input.activeVisibleChannel) {
        rationale = `Holding ${channel} preserves continuity with fitness=${currentFitness.toFixed(3)}.`;
      } else if (worthMigrating) {
        rationale = `${channel} outperforms active channel by net ${netGain.toFixed(3)} after migration cost.`;
      } else {
        rationale = `${channel} does not justify migration (net=${netGain.toFixed(3)}, threshold=${defaults.scenarioContrastThreshold01}).`;
      }

      return Object.freeze({
        targetChannel: channel,
        projectedFitness01: asScore(targetScore),
        migrationCostEstimate01: asScore(migrationCost),
        netGain01: asScore(Math.max(0, netGain)),
        worthMigrating,
        projectedCooldownMs: projectedCooldown,
        rationale,
      });
    }),
  );
}

// ============================================================================
// MARK: Input normalization
// ============================================================================

function normalizeAggregateInput(
  aggregate: ChatOnlineFeatureAggregate,
  options: {
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly engagement?: Nullable<EngagementModelScore>;
    readonly engagementPrior?: Nullable<EngagementModelPriorState>;
    readonly hater?: Nullable<HaterTargetingScore>;
    readonly haterPrior?: Nullable<HaterTargetingPriorState>;
    readonly helper?: Nullable<HelperTimingScore>;
    readonly helperPrior?: Nullable<HelperTimingPriorState>;
  },
): ChannelAffinityModelInput {
  return Object.freeze({
    generatedAt: aggregate.generatedAt,
    roomId: aggregate.roomId ?? null,
    sessionId: aggregate.sessionId ?? null,
    userId: aggregate.userId ?? null,
    roomKind: normalizeRoomKind(pickCategorical(aggregate, 'roomKind', 'UNKNOWN')),
    activeVisibleChannel: normalizeChannel(aggregate.dominantChannel, 'GLOBAL'),
    pressureTier: normalizePressureTier(pickCategorical(aggregate, 'pressureTier', 'NONE')),
    roomHeat01: pickScalar(aggregate, 'roomHeat01', 0.42),
    hostileMomentum01: pickScalar(aggregate, 'hostileMomentum01', 0.22),
    churnRisk01: pickScalar(aggregate, 'churnRisk01', 0.18),
    responseCadence01: pickScalar(aggregate, 'responseCadence01', 0.42),
    recentPlayerShare01: pickScalar(aggregate, 'recentPlayerShare01', 0.32),
    recentNpcShare01: pickScalar(aggregate, 'recentNpcShare01', 0.44),
    helperReceptivity01: pickScalar(aggregate, 'helperReceptivity01', options.learningProfile?.helperReceptivity01 ?? 0.44),
    helperIgnore01: pickScalar(aggregate, 'helperIgnore01', 0),
    helperDensity01: pickScalar(aggregate, 'helperDensity01', 0.12),
    rescueOpportunity01: pickScalar(aggregate, 'rescueOpportunity01', 0.18),
    visibilityExposure01: pickScalar(aggregate, 'visibilityExposure01', 0.32),
    switchStress01: pickScalar(aggregate, 'switchStress01', 0.14),
    averageMessageLength01: pickScalar(aggregate, 'averageMessageLength01', 0.32),
    confidence01: pickScalar(aggregate, 'confidence01', 0.46),
    intimidation01: pickScalar(aggregate, 'intimidation01', 0.22),
    frustration01: pickScalar(aggregate, 'frustration01', 0.20),
    embarrassment01: pickScalar(aggregate, 'embarrassment01', 0.18),
    curiosity01: pickScalar(aggregate, 'curiosity01', 0.32),
    attachment01: pickScalar(aggregate, 'attachment01', 0.22),
    trust01: pickScalar(aggregate, 'trust01', 0.28),
    dominance01: pickScalar(aggregate, 'dominance01', 0.24),
    desperation01: pickScalar(aggregate, 'desperation01', 0.18),
    relief01: pickScalar(aggregate, 'relief01', 0.16),
    toxicityRisk01: pickScalar(aggregate, 'toxicityRisk01', 0.16),
    negativeSwarm01: pickScalar(aggregate, 'negativeSwarm01', 0.22),
    positiveSwarm01: pickScalar(aggregate, 'positiveSwarm01', 0.20),
    nearSovereignty01: pickScalar(aggregate, 'nearSovereignty01', 0),
    bluffExposure01: pickScalar(aggregate, 'bluffExposure01', 0.08),
    bankruptcyRisk01: pickScalar(aggregate, 'bankruptcyRisk01', 0.10),
    negotiationIntensity01: pickScalar(aggregate, 'negotiationIntensity01', 0.10),
    dealPressure01: pickScalar(aggregate, 'dealPressure01', 0.08),
    channelSwitchVelocity01: pickScalar(aggregate, 'channelSwitchVelocity01', 0.10),
    affinityGlobal01: pickScalar(aggregate, 'affinityGlobal01', options.learningProfile?.channelAffinity.GLOBAL ?? 0.25),
    affinitySyndicate01: pickScalar(aggregate, 'affinitySyndicate01', options.learningProfile?.channelAffinity.SYNDICATE ?? 0.25),
    affinityDealRoom01: pickScalar(aggregate, 'affinityDealRoom01', options.learningProfile?.channelAffinity.DEAL_ROOM ?? 0.25),
    affinityLobby01: pickScalar(aggregate, 'affinityLobby01', options.learningProfile?.channelAffinity.LOBBY ?? 0.25),
    liveopsHelperBlackout01: pickScalar(aggregate, 'liveopsHelperBlackout01', options.sourceSignal?.liveops?.helperBlackout ? 1 : 0),
    liveopsHaterRaid01: pickScalar(aggregate, 'liveopsHaterRaid01', (options.sourceSignal?.liveops as any)?.haterRaid ? 1 : 0),
    engagement: options.engagement ?? null,
    engagementPrior: options.engagementPrior ?? null,
    hater: options.hater ?? null,
    haterPrior: options.haterPrior ?? null,
    helper: options.helper ?? null,
    helperPrior: options.helperPrior ?? null,
    learningProfile: options.learningProfile ?? null,
    sourceSignal: options.sourceSignal ?? null,
    canonicalSnapshot: aggregate.canonicalSnapshot ?? null,
    evidenceRows: aggregate.rows,
  });
}

function normalizeWindowInput(
  window: ChatOnlineInferenceWindow,
  options: {
    readonly roomId?: Nullable<ChatRoomId>;
    readonly sessionId?: Nullable<string>;
    readonly userId?: Nullable<string>;
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly engagement?: Nullable<EngagementModelScore>;
    readonly engagementPrior?: Nullable<EngagementModelPriorState>;
    readonly hater?: Nullable<HaterTargetingScore>;
    readonly haterPrior?: Nullable<HaterTargetingPriorState>;
    readonly helper?: Nullable<HelperTimingScore>;
    readonly helperPrior?: Nullable<HelperTimingPriorState>;
  },
): ChannelAffinityModelInput {
  return Object.freeze({
    generatedAt: window.generatedAt,
    roomId: options.roomId ?? null,
    sessionId: options.sessionId ?? null,
    userId: options.userId ?? null,
    roomKind: normalizeRoomKind(pickCategorical(window, 'roomKind', 'UNKNOWN')),
    activeVisibleChannel: normalizeChannel(pickCategorical(window, 'dominantChannel', 'GLOBAL'), 'GLOBAL'),
    pressureTier: normalizePressureTier(pickCategorical(window, 'pressureTier', 'NONE')),
    roomHeat01: pickScalar(window, 'roomHeat01', 0.42),
    hostileMomentum01: pickScalar(window, 'hostileMomentum01', 0.22),
    churnRisk01: pickScalar(window, 'churnRisk01', 0.18),
    responseCadence01: pickScalar(window, 'responseCadence01', 0.42),
    recentPlayerShare01: pickScalar(window, 'recentPlayerShare01', 0.32),
    recentNpcShare01: pickScalar(window, 'recentNpcShare01', 0.44),
    helperReceptivity01: pickScalar(window, 'helperReceptivity01', options.learningProfile?.helperReceptivity01 ?? 0.44),
    helperIgnore01: pickScalar(window, 'helperIgnore01', 0),
    helperDensity01: pickScalar(window, 'helperDensity01', 0.12),
    rescueOpportunity01: pickScalar(window, 'rescueOpportunity01', 0.18),
    visibilityExposure01: pickScalar(window, 'visibilityExposure01', 0.32),
    switchStress01: pickScalar(window, 'switchStress01', 0.14),
    averageMessageLength01: pickScalar(window, 'averageMessageLength01', 0.32),
    confidence01: pickScalar(window, 'confidence01', 0.46),
    intimidation01: pickScalar(window, 'intimidation01', 0.22),
    frustration01: pickScalar(window, 'frustration01', 0.20),
    embarrassment01: pickScalar(window, 'embarrassment01', 0.18),
    curiosity01: pickScalar(window, 'curiosity01', 0.32),
    attachment01: pickScalar(window, 'attachment01', 0.22),
    trust01: pickScalar(window, 'trust01', 0.28),
    dominance01: pickScalar(window, 'dominance01', 0.24),
    desperation01: pickScalar(window, 'desperation01', 0.18),
    relief01: pickScalar(window, 'relief01', 0.16),
    toxicityRisk01: pickScalar(window, 'toxicityRisk01', 0.16),
    negativeSwarm01: pickScalar(window, 'negativeSwarm01', 0.22),
    positiveSwarm01: pickScalar(window, 'positiveSwarm01', 0.20),
    nearSovereignty01: pickScalar(window, 'nearSovereignty01', 0),
    bluffExposure01: pickScalar(window, 'bluffExposure01', 0.08),
    bankruptcyRisk01: pickScalar(window, 'bankruptcyRisk01', 0.10),
    negotiationIntensity01: pickScalar(window, 'negotiationIntensity01', 0.10),
    dealPressure01: pickScalar(window, 'dealPressure01', 0.08),
    channelSwitchVelocity01: pickScalar(window, 'channelSwitchVelocity01', 0.10),
    affinityGlobal01: pickScalar(window, 'affinityGlobal01', options.learningProfile?.channelAffinity.GLOBAL ?? 0.25),
    affinitySyndicate01: pickScalar(window, 'affinitySyndicate01', options.learningProfile?.channelAffinity.SYNDICATE ?? 0.25),
    affinityDealRoom01: pickScalar(window, 'affinityDealRoom01', options.learningProfile?.channelAffinity.DEAL_ROOM ?? 0.25),
    affinityLobby01: pickScalar(window, 'affinityLobby01', options.learningProfile?.channelAffinity.LOBBY ?? 0.25),
    liveopsHelperBlackout01: pickScalar(window, 'liveopsHelperBlackout01', options.sourceSignal?.liveops?.helperBlackout ? 1 : 0),
    liveopsHaterRaid01: pickScalar(window, 'liveopsHaterRaid01', (options.sourceSignal?.liveops as any)?.haterRaid ? 1 : 0),
    engagement: options.engagement ?? null,
    engagementPrior: options.engagementPrior ?? null,
    hater: options.hater ?? null,
    haterPrior: options.haterPrior ?? null,
    helper: options.helper ?? null,
    helperPrior: options.helperPrior ?? null,
    learningProfile: options.learningProfile ?? null,
    sourceSignal: options.sourceSignal ?? null,
    canonicalSnapshot: window.canonicalSnapshot ?? null,
    evidenceRows: [],
  });
}

// ============================================================================
// MARK: Core scoring engine
// ============================================================================

function scoreInputCore(
  input: ChannelAffinityModelInput,
  prior: Nullable<ChannelAffinityPriorState>,
  defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
): ChannelAffinityScore {
  const volatility01 = computeVolatility01(input.evidenceRows);
  const privacyNeed01Raw = computePrivacyNeed01(input);
  const crowdNeed01 = computeCrowdNeed01(input);
  const negotiationNeed01 = computeNegotiationNeed01(input);
  const recoveryNeed01 = computeRecoveryNeed01(input);

  const scores: ChannelScoreMap = Object.freeze({
    GLOBAL: scoreGlobalChannel(input, crowdNeed01, privacyNeed01Raw, defaults),
    SYNDICATE: scoreSyndicateChannel(input, privacyNeed01Raw, recoveryNeed01, defaults),
    DEAL_ROOM: scoreDealRoomChannel(input, privacyNeed01Raw, negotiationNeed01, recoveryNeed01, defaults),
    LOBBY: scoreLobbyChannel(input, recoveryNeed01, defaults),
  });

  const activeChannelFitness01Raw = computeActiveChannelFitness01(input, defaults, scores);
  const migrationPressure01Raw = computeMigrationPressure01(input, scores, activeChannelFitness01Raw, volatility01);

  const privacyNeed01 = prior
    ? asScore((privacyNeed01Raw as number) * (1 - defaults.privacyBlend01) + (prior.privacyNeed01 as number) * defaults.privacyBlend01)
    : privacyNeed01Raw;

  const activeChannelFitness01 = prior
    ? asScore((activeChannelFitness01Raw as number) * (1 - defaults.baselineBlend01) + (prior.activeChannelFitness01 as number) * defaults.baselineBlend01)
    : activeChannelFitness01Raw;

  const migrationPressure01 = prior
    ? asScore((migrationPressure01Raw as number) * (1 - defaults.migrationBlend01) + (prior.migrationPressure01 as number) * defaults.migrationBlend01)
    : migrationPressure01Raw;

  const rankedChannels = channelOrder(scores);
  const recommendedPrimaryChannel = rankedChannels[0];
  const recommendedSecondaryChannel = rankedChannels[1] ?? null;

  const recommendation = recommendationForAffinity(
    input, defaults, scores, activeChannelFitness01, migrationPressure01,
    privacyNeed01, crowdNeed01, negotiationNeed01, recoveryNeed01,
  );

  const shouldMigrate =
    recommendation === 'SHIFT_TO_GLOBAL' ||
    recommendation === 'SHIFT_TO_SYNDICATE' ||
    recommendation === 'SHIFT_TO_DEAL_ROOM' ||
    recommendation === 'SHIFT_TO_LOBBY';

  const shouldOpenSecondaryChannel =
    recommendation === 'SPLIT_CURRENT_AND_PRIVATE' ||
    recommendation === 'SPLIT_CURRENT_AND_GLOBAL';

  const cooldownMs = computeCooldownMs(defaults, migrationPressure01, input.switchStress01);
  const congestLevel = computeCongestLevel(input, scores, defaults);

  const explanationFactors = explanationFactorsForAffinity(
    input, defaults,
    { activeChannelFitness01, migrationPressure01, privacyNeed01, crowdNeed01, negotiationNeed01, recoveryNeed01, scores },
  );

  const rawConfidence =
    (activeChannelFitness01 as number) * 0.26 +
    (migrationPressure01 as number) * 0.30 +
    (1 - (input.switchStress01 as number)) * 0.16 +
    (1 - (volatility01 as number)) * 0.16 +
    (activeAffinity01(input) as number) * 0.12;

  const confidence01 = asScore100(rawConfidence * 100);
  const confidenceLevel = confidenceLevelFor(confidence01);

  return Object.freeze({
    generatedAt: input.generatedAt,
    roomId: input.roomId,
    sessionId: input.sessionId,
    userId: input.userId,
    roomKind: input.roomKind,
    activeVisibleChannel: input.activeVisibleChannel,
    scores,
    rankedChannels,
    recommendedPrimaryChannel,
    recommendedSecondaryChannel,
    activeChannelFitness01,
    migrationPressure01,
    privacyNeed01,
    crowdNeed01,
    negotiationNeed01,
    recoveryNeed01,
    volatility01,
    congestLevel,
    recommendation,
    shouldMigrate,
    shouldOpenSecondaryChannel,
    cooldownMs,
    evidenceRowIds: Object.freeze(unique(input.evidenceRows.map((row) => row.rowId))),
    explanationFactors,
    canonicalSnapshot: input.canonicalSnapshot,
    confidence01,
    confidenceLevel,
    modelVersion: CHAT_CHANNEL_AFFINITY_MODEL_VERSION,
  });
}

// ============================================================================
// MARK: Model implementation
// ============================================================================

export class ChannelAffinityModel {
  private readonly context: ChannelAffinityModelContext;

  public constructor(options: ChannelAffinityModelOptions = {}) {
    this.context = Object.freeze({
      logger: options.logger ?? DEFAULT_LOGGER,
      clock: options.clock ?? DEFAULT_CLOCK,
      defaults: Object.freeze({
        ...CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
        ...(options.defaults ?? {}),
      }),
      runtime: mergeRuntimeConfig(options.runtimeOverride ?? {}),
    });
  }

  public scoreAggregate(
    aggregate: ChatOnlineFeatureAggregate,
    options: {
      readonly learningProfile?: Nullable<ChatLearningProfile>;
      readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
      readonly engagement?: Nullable<EngagementModelScore>;
      readonly engagementPrior?: Nullable<EngagementModelPriorState>;
      readonly hater?: Nullable<HaterTargetingScore>;
      readonly haterPrior?: Nullable<HaterTargetingPriorState>;
      readonly helper?: Nullable<HelperTimingScore>;
      readonly helperPrior?: Nullable<HelperTimingPriorState>;
      readonly prior?: Nullable<ChannelAffinityPriorState>;
    } = {},
  ): ChannelAffinityScore {
    const input = normalizeAggregateInput(aggregate, options);
    return this.scoreInput(input, options.prior ?? null);
  }

  public scoreInferenceWindow(
    window: ChatOnlineInferenceWindow,
    options: {
      readonly roomId?: Nullable<ChatRoomId>;
      readonly sessionId?: Nullable<string>;
      readonly userId?: Nullable<string>;
      readonly learningProfile?: Nullable<ChatLearningProfile>;
      readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
      readonly engagement?: Nullable<EngagementModelScore>;
      readonly engagementPrior?: Nullable<EngagementModelPriorState>;
      readonly hater?: Nullable<HaterTargetingScore>;
      readonly haterPrior?: Nullable<HaterTargetingPriorState>;
      readonly helper?: Nullable<HelperTimingScore>;
      readonly helperPrior?: Nullable<HelperTimingPriorState>;
      readonly prior?: Nullable<ChannelAffinityPriorState>;
    } = {},
  ): ChannelAffinityScore {
    const input = normalizeWindowInput(window, options);
    return this.scoreInput(input, options.prior ?? null);
  }

  public scoreRows(
    rowsOrBatch: readonly ChatFeatureRow[] | ChatFeatureIngestResult,
    options: {
      readonly learningProfile?: Nullable<ChatLearningProfile>;
      readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
      readonly engagement?: Nullable<EngagementModelScore>;
      readonly engagementPrior?: Nullable<EngagementModelPriorState>;
      readonly hater?: Nullable<HaterTargetingScore>;
      readonly haterPrior?: Nullable<HaterTargetingPriorState>;
      readonly helper?: Nullable<HelperTimingScore>;
      readonly helperPrior?: Nullable<HelperTimingPriorState>;
      readonly prior?: Nullable<ChannelAffinityPriorState>;
    } = {},
  ): ChannelAffinityScore {
    const aggregate = aggregateOnlineFeatureWindow(rowsOrBatch, 'CHANNEL_AFFINITY');
    return this.scoreAggregate(aggregate, options);
  }

  public scoreStore(
    store: OnlineFeatureStore,
    query: ChatOnlineFeatureStoreQuery,
    options: {
      readonly learningProfile?: Nullable<ChatLearningProfile>;
      readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
      readonly engagement?: Nullable<EngagementModelScore>;
      readonly engagementPrior?: Nullable<EngagementModelPriorState>;
      readonly hater?: Nullable<HaterTargetingScore>;
      readonly haterPrior?: Nullable<HaterTargetingPriorState>;
      readonly helper?: Nullable<HelperTimingScore>;
      readonly helperPrior?: Nullable<HelperTimingPriorState>;
      readonly prior?: Nullable<ChannelAffinityPriorState>;
    } = {},
  ): ChannelAffinityScore {
    const aggregate = store.aggregate({ ...query, family: 'CHANNEL_AFFINITY' });
    return this.scoreAggregate(aggregate, options);
  }

  public scoreBatch(
    aggregates: readonly ChatOnlineFeatureAggregate[],
    options: {
      readonly learningProfilesByUserId?: Readonly<Record<string, ChatLearningProfile>>;
      readonly signalsByRoomId?: Readonly<Record<string, ChatSignalEnvelope>>;
      readonly engagementsByUserId?: Readonly<Record<string, EngagementModelScore>>;
      readonly engagementPriorsByUserId?: Readonly<Record<string, EngagementModelPriorState>>;
      readonly hatersByUserId?: Readonly<Record<string, HaterTargetingScore>>;
      readonly haterPriorsByUserId?: Readonly<Record<string, HaterTargetingPriorState>>;
      readonly helpersByUserId?: Readonly<Record<string, HelperTimingScore>>;
      readonly helperPriorsByUserId?: Readonly<Record<string, HelperTimingPriorState>>;
      readonly priorsByUserId?: Readonly<Record<string, ChannelAffinityPriorState>>;
    } = {},
  ): ChannelAffinityBatchResult {
    const generatedAt = this.context.clock.now();
    const capped = aggregates.slice(0, this.context.defaults.batchSoftCapEntities);

    const scores = capped.map((aggregate) => {
      const userId = aggregate.userId ?? undefined;
      const roomId = aggregate.roomId ?? undefined;
      return this.scoreAggregate(aggregate, {
        learningProfile: userId ? options.learningProfilesByUserId?.[userId] ?? null : null,
        sourceSignal: roomId ? options.signalsByRoomId?.[roomId] ?? null : null,
        engagement: userId ? options.engagementsByUserId?.[userId] ?? null : null,
        engagementPrior: userId ? options.engagementPriorsByUserId?.[userId] ?? null : null,
        hater: userId ? options.hatersByUserId?.[userId] ?? null : null,
        haterPrior: userId ? options.haterPriorsByUserId?.[userId] ?? null : null,
        helper: userId ? options.helpersByUserId?.[userId] ?? null : null,
        helperPrior: userId ? options.helperPriorsByUserId?.[userId] ?? null : null,
        prior: userId ? options.priorsByUserId?.[userId] ?? null : null,
      });
    });

    const strongestMigration = scores.length
      ? scores.reduce((best, current) => (current.migrationPressure01 > best.migrationPressure01 ? current : best))
      : null;

    const strongestHold = scores.length
      ? scores.reduce((best, current) => (current.activeChannelFitness01 > best.activeChannelFitness01 ? current : best))
      : null;

    const channelDistribution: Record<ChatVisibleChannel, number> = { GLOBAL: 0, SYNDICATE: 0, DEAL_ROOM: 0, LOBBY: 0 };
    for (const s of scores) channelDistribution[s.recommendedPrimaryChannel] += 1;

    const avgMigration = scores.length ? mean(scores.map((s) => s.migrationPressure01 as number)) : 0;
    const avgFitness = scores.length ? mean(scores.map((s) => s.activeChannelFitness01 as number)) : 0;

    return Object.freeze({
      generatedAt,
      scores: Object.freeze(scores),
      strongestMigration,
      strongestHold,
      channelDistribution: Object.freeze(channelDistribution),
      averageMigrationPressure01: asScore(avgMigration),
      averageActiveChannelFitness01: asScore(avgFitness),
      entityCount: scores.length,
    });
  }

  public toPriorState(score: ChannelAffinityScore): ChannelAffinityPriorState {
    return Object.freeze({
      activeChannelFitness01: score.activeChannelFitness01,
      migrationPressure01: score.migrationPressure01,
      privacyNeed01: score.privacyNeed01,
      recommendedPrimaryChannel: score.recommendedPrimaryChannel,
      generatedAt: score.generatedAt,
    });
  }

  public scoreInput(
    input: ChannelAffinityModelInput,
    prior: Nullable<ChannelAffinityPriorState> = null,
  ): ChannelAffinityScore {
    const { defaults, logger } = this.context;
    const score = scoreInputCore(input, prior, defaults);

    logger.debug('channel_affinity_model_scored', {
      roomId: input.roomId,
      userId: input.userId,
      activeVisibleChannel: input.activeVisibleChannel,
      recommendedPrimaryChannel: score.recommendedPrimaryChannel,
      migrationPressure01: score.migrationPressure01,
      recommendation: score.recommendation,
      confidence01: score.confidence01,
      confidenceLevel: score.confidenceLevel,
    });

    return score;
  }

  public buildAuditReport(
    input: ChannelAffinityModelInput,
    score: ChannelAffinityScore,
    priors: readonly ChannelAffinityPriorState[] = [],
  ): ChannelAffinityAuditReport {
    const { defaults } = this.context;
    const now = this.context.clock.now();
    const freshnessMs = Math.max(0, (now as number) - (input.generatedAt as number));

    const trendSummary = priors.length
      ? buildTrendSummary(priors, score, defaults)
      : null;

    const scenarios = simulateChannelShift(input, score.scores, score.activeChannelFitness01, defaults);

    const reportId = `cam_audit:${input.userId ?? input.roomId ?? 'anon'}:${now}`;

    return Object.freeze({
      reportId,
      generatedAt: now,
      roomId: input.roomId,
      userId: input.userId,
      modelVersion: CHAT_CHANNEL_AFFINITY_MODEL_VERSION,
      activeChannel: input.activeVisibleChannel,
      recommendation: score.recommendation,
      scores: score.scores,
      rankedChannels: score.rankedChannels,
      activeChannelFitness01: score.activeChannelFitness01,
      migrationPressure01: score.migrationPressure01,
      privacyNeed01: score.privacyNeed01,
      crowdNeed01: score.crowdNeed01,
      negotiationNeed01: score.negotiationNeed01,
      recoveryNeed01: score.recoveryNeed01,
      volatility01: score.volatility01,
      confidence01: score.confidence01,
      confidenceLevel: score.confidenceLevel,
      congestLevel: score.congestLevel,
      trendSummary,
      scenarios,
      explanationFactors: score.explanationFactors,
      runtimeLaws: CHAT_CHANNEL_AFFINITY_MODEL_RUNTIME_LAWS,
      evidenceRowCount: input.evidenceRows.length,
      freshnessMs,
    });
  }

  public scoreAndAudit(
    aggregate: ChatOnlineFeatureAggregate,
    options: {
      readonly learningProfile?: Nullable<ChatLearningProfile>;
      readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
      readonly engagement?: Nullable<EngagementModelScore>;
      readonly engagementPrior?: Nullable<EngagementModelPriorState>;
      readonly hater?: Nullable<HaterTargetingScore>;
      readonly haterPrior?: Nullable<HaterTargetingPriorState>;
      readonly helper?: Nullable<HelperTimingScore>;
      readonly helperPrior?: Nullable<HelperTimingPriorState>;
      readonly prior?: Nullable<ChannelAffinityPriorState>;
      readonly priorHistory?: readonly ChannelAffinityPriorState[];
    } = {},
  ): { readonly score: ChannelAffinityScore; readonly audit: ChannelAffinityAuditReport } {
    const input = normalizeAggregateInput(aggregate, options);
    const score = this.scoreInput(input, options.prior ?? null);
    const audit = this.buildAuditReport(input, score, options.priorHistory ?? []);
    return Object.freeze({ score, audit });
  }
}

// ============================================================================
// MARK: Public helpers
// ============================================================================

export function channelAffinitySummary(score: ChannelAffinityScore): string {
  return [
    `active=${score.activeVisibleChannel}`,
    `primary=${score.recommendedPrimaryChannel}`,
    `secondary=${score.recommendedSecondaryChannel ?? 'none'}`,
    `rec=${score.recommendation}`,
    `fit=${(score.activeChannelFitness01 as number).toFixed(3)}`,
    `move=${(score.migrationPressure01 as number).toFixed(3)}`,
    `privacy=${(score.privacyNeed01 as number).toFixed(3)}`,
    `crowd=${(score.crowdNeed01 as number).toFixed(3)}`,
    `negotiation=${(score.negotiationNeed01 as number).toFixed(3)}`,
    `recovery=${(score.recoveryNeed01 as number).toFixed(3)}`,
    `conf=${score.confidenceLevel}`,
    `congest=${score.congestLevel}`,
  ].join(' | ');
}

export function channelAffinityShouldMove(score: ChannelAffinityScore): boolean {
  return score.shouldMigrate;
}

export function channelAffinityPrimaryScore(score: ChannelAffinityScore): Score01 {
  return score.scores[score.recommendedPrimaryChannel];
}

export function channelAffinityScoreDelta(score: ChannelAffinityScore): number {
  const primary = score.scores[score.recommendedPrimaryChannel] as number;
  const active = score.scores[score.activeVisibleChannel] as number;
  return primary - active;
}

export function channelAffinityIsStable(score: ChannelAffinityScore): boolean {
  return !score.shouldMigrate && score.congestLevel !== 'CONGESTED';
}

export function channelAffinityTopReasons(score: ChannelAffinityScore, limit = 3): readonly string[] {
  return Object.freeze(
    score.explanationFactors
      .filter((f) => f.magnitude === 'DECISIVE' || f.magnitude === 'MAJOR')
      .slice(0, limit)
      .map((f) => f.reason),
  );
}

export function channelAffinityDiagnosticLines(score: ChannelAffinityScore): readonly string[] {
  const lines: string[] = [
    `channel_affinity_diagnostic|active=${score.activeVisibleChannel}|rec=${score.recommendation}`,
    `scores|GLOBAL=${(score.scores.GLOBAL as number).toFixed(3)}|SYNDICATE=${(score.scores.SYNDICATE as number).toFixed(3)}|DEAL_ROOM=${(score.scores.DEAL_ROOM as number).toFixed(3)}|LOBBY=${(score.scores.LOBBY as number).toFixed(3)}`,
    `fitness=${(score.activeChannelFitness01 as number).toFixed(3)}|pressure=${(score.migrationPressure01 as number).toFixed(3)}|conf=${score.confidenceLevel}|congest=${score.congestLevel}`,
    `volatility=${(score.volatility01 as number).toFixed(3)}|cooldownMs=${score.cooldownMs}|migrate=${score.shouldMigrate}|secondary=${score.shouldOpenSecondaryChannel}`,
  ];
  for (const f of score.explanationFactors.slice(0, 4)) {
    lines.push(`  factor|${f.key}|${f.signedDelta01 >= 0 ? '+' : ''}${f.signedDelta01.toFixed(3)}|${f.magnitude}`);
  }
  return Object.freeze(lines);
}

export function createChannelAffinityModel(options: ChannelAffinityModelOptions = {}): ChannelAffinityModel {
  return new ChannelAffinityModel(options);
}

export const CHAT_CHANNEL_AFFINITY_MODEL_NAMESPACE = Object.freeze({
  moduleName: CHAT_CHANNEL_AFFINITY_MODEL_MODULE_NAME,
  version: CHAT_CHANNEL_AFFINITY_MODEL_VERSION,
  runtimeLaws: CHAT_CHANNEL_AFFINITY_MODEL_RUNTIME_LAWS,
  defaults: CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
  channelProfiles: CHANNEL_STAGE_PROFILES,
  create: createChannelAffinityModel,
  summary: channelAffinitySummary,
  shouldMove: channelAffinityShouldMove,
  primaryScore: channelAffinityPrimaryScore,
  scoreDelta: channelAffinityScoreDelta,
  isStable: channelAffinityIsStable,
  topReasons: channelAffinityTopReasons,
  diagnosticLines: channelAffinityDiagnosticLines,
} as const);
