/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CHANNEL AFFINITY MODEL
 * FILE: backend/src/game/engine/chat/ml/ChannelAffinityModel.ts
 * VERSION: 2026.03.14
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
 * - remains explainable enough for replay, telemetry, and policy audit.
 *
 * Why this file is deep
 * ---------------------
 * Channel choice in Point Zero One is not cosmetic:
 * - GLOBAL is a stage,
 * - SYNDICATE is private tactical space,
 * - DEAL_ROOM is predatory negotiation space,
 * - LOBBY is recovery / pre-run social space.
 *
 * So channel fit must weigh:
 * - public witness value,
 * - privacy need,
 * - negotiation pressure,
 * - recovery need,
 * - helper rescue posture,
 * - hater public leak posture,
 * - channel-switch stress,
 * - and durable learning affinity for each lane.
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
  '2026.03.14-channel-affinity-model.v2' as const;

export const CHAT_CHANNEL_AFFINITY_MODEL_RUNTIME_LAWS = Object.freeze([
  'Channel affinity is advisory for orchestration, not direct room truth.',
  'Another channel must beat switching stress before migration is recommended.',
  'GLOBAL rewards witness, crowd heat, and ceremonial visibility.',
  'SYNDICATE rewards trust, privacy, and tactical continuity.',
  'DEAL_ROOM rewards negotiation pressure, bluff containment, and precise privacy.',
  'LOBBY rewards recovery, onboarding, and low-threat continuity.',
  'Helper timing and hater targeting materially alter channel fit.',
  'The active channel gets continuity credit before a shift is proposed.',
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

export interface ChannelScoreMap {
  readonly GLOBAL: Score01;
  readonly SYNDICATE: Score01;
  readonly DEAL_ROOM: Score01;
  readonly LOBBY: Score01;
}

export interface ChannelAffinityExplanationFactor {
  readonly key: string;
  readonly signedDelta01: number;
  readonly reason: string;
}

export interface ChannelAffinityPriorState {
  readonly activeChannelFitness01: Score01;
  readonly migrationPressure01: Score01;
  readonly privacyNeed01: Score01;
  readonly generatedAt: UnixMs;
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
  readonly recommendation: ChannelAffinityRecommendation;
  readonly shouldMigrate: boolean;
  readonly shouldOpenSecondaryChannel: boolean;
  readonly cooldownMs: number;
  readonly evidenceRowIds: readonly string[];
  readonly explanationFactors: readonly ChannelAffinityExplanationFactor[];
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly confidence01: Score100;
  readonly modelVersion: typeof CHAT_CHANNEL_AFFINITY_MODEL_VERSION;
}

export interface ChannelAffinityBatchResult {
  readonly generatedAt: UnixMs;
  readonly scores: readonly ChannelAffinityScore[];
  readonly strongestMigration: Nullable<ChannelAffinityScore>;
  readonly strongestHold: Nullable<ChannelAffinityScore>;
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


// ============================================================================
// MARK: Component scorers
// ============================================================================

function computeVolatility01(rows: readonly ChatFeatureRow[]): Score01 {
  if (rows.length < 3) return asScore(0.16);
  const heat = rows.map((row) => safeNumber(row.scalarFeatures.roomHeat01, 0));
  const switches = rows.map((row) => safeNumber(row.scalarFeatures.channelSwitchVelocity01, 0));
  const negotiation = rows.map((row) => safeNumber(row.scalarFeatures.negotiationIntensity01, 0));
  const visibility = rows.map((row) => safeNumber(row.scalarFeatures.visibilityExposure01, 0));
  const series = [heat, switches, negotiation, visibility];
  const deviations = series.map((values) => { const avg = mean(values); return mean(values.map((value) => Math.abs(value - avg))); });
  return asScore(mean(deviations) * 1.22);
}

function computePrivacyNeed01(input: ChannelAffinityModelInput): Score01 {
  const embarrassment = (input.embarrassment01 as number) * 0.22;
  const intimidation = (input.intimidation01 as number) * 0.18;
  const negotiation = (input.negotiationIntensity01 as number) * 0.14;
  const desperation = (input.desperation01 as number) * 0.08;
  const helperRescue = input.helper ? (input.helper.rescueWindow01 as number) * 0.10 : 0;
  return asScore(embarrassment + intimidation + negotiation + desperation + helperRescue);
}

function computeCrowdNeed01(input: ChannelAffinityModelInput): Score01 {
  const visibility = (input.visibilityExposure01 as number) * 0.18;
  const positiveSwarm = (input.positiveSwarm01 as number) * 0.16;
  const witness = input.helper ? (input.helper.witnessNeed01 as number) * 0.16 : 0;
  const haterLeak = input.hater ? (input.hater.publicLeak01 as number) * 0.12 : 0;
  const sovereignty = (input.nearSovereignty01 as number) * 0.10;
  return asScore(visibility + positiveSwarm + witness + haterLeak + sovereignty);
}

function computeNegotiationNeed01(input: ChannelAffinityModelInput): Score01 {
  const negotiation = (input.negotiationIntensity01 as number) * 0.34;
  const dealPressure = (input.dealPressure01 as number) * 0.24;
  const bluff = (input.bluffExposure01 as number) * 0.18;
  const bankruptcy = (input.bankruptcyRisk01 as number) * 0.10;
  return asScore(negotiation + dealPressure + bluff + bankruptcy);
}

function computeRecoveryNeed01(input: ChannelAffinityModelInput): Score01 {
  const rescue = input.helper ? (input.helper.rescueWindow01 as number) * 0.22 : 0.10;
  const churn = (input.churnRisk01 as number) * 0.16;
  const frustration = (input.frustration01 as number) * 0.14;
  const embarrassment = (input.embarrassment01 as number) * 0.10;
  const lowRelief = Math.max(0, 0.46 - (input.relief01 as number)) * 0.08;
  return asScore(rescue + churn + frustration + embarrassment + lowRelief);
}

function scoreGlobalChannel(input: ChannelAffinityModelInput, crowdNeed01: Score01, privacyNeed01: Score01): Score01 {
  const affinity = (input.affinityGlobal01 as number) * 0.30;
  const crowd = (crowdNeed01 as number) * 0.28;
  const haterPublic = input.hater ? (input.hater.publicLeak01 as number) * 0.14 : 0;
  const witness = input.helper ? (input.helper.witnessNeed01 as number) * 0.12 : 0;
  const visibility = (input.visibilityExposure01 as number) * 0.12;
  const privacyPenalty = (privacyNeed01 as number) * 0.22;
  const negotiationPenalty = (input.negotiationIntensity01 as number) * 0.10;
  return asScore(affinity + crowd + haterPublic + witness + visibility - privacyPenalty - negotiationPenalty);
}

function scoreSyndicateChannel(input: ChannelAffinityModelInput, privacyNeed01: Score01, recoveryNeed01: Score01): Score01 {
  const affinity = (input.affinitySyndicate01 as number) * 0.28;
  const trust = (input.trust01 as number) * 0.18;
  const privacy = (privacyNeed01 as number) * 0.20;
  const recovery = (recoveryNeed01 as number) * 0.16;
  const cadence = (input.responseCadence01 as number) * 0.08;
  const crowdPenalty = (input.positiveSwarm01 as number) * 0.06;
  return asScore(affinity + trust + privacy + recovery + cadence - crowdPenalty);
}

function scoreDealRoomChannel(input: ChannelAffinityModelInput, privacyNeed01: Score01, negotiationNeed01: Score01, recoveryNeed01: Score01): Score01 {
  const affinity = (input.affinityDealRoom01 as number) * 0.26;
  const negotiation = (negotiationNeed01 as number) * 0.30;
  const privacy = (privacyNeed01 as number) * 0.18;
  const bluff = (input.bluffExposure01 as number) * 0.12;
  const recoveryPenalty = (recoveryNeed01 as number) * 0.10;
  const crowdPenalty = (input.positiveSwarm01 as number) * 0.04;
  return asScore(affinity + negotiation + privacy + bluff - recoveryPenalty - crowdPenalty);
}

function scoreLobbyChannel(input: ChannelAffinityModelInput, recoveryNeed01: Score01): Score01 {
  const affinity = (input.affinityLobby01 as number) * 0.28;
  const recovery = (recoveryNeed01 as number) * 0.22;
  const teaching = input.helper ? (input.helper.teachingWindow01 as number) * 0.16 : 0.08;
  const lowThreat = Math.max(0, 0.58 - (input.hostileMomentum01 as number)) * 0.12;
  const publicPenalty = (input.visibilityExposure01 as number) * 0.06;
  const negotiationPenalty = (input.negotiationIntensity01 as number) * 0.08;
  return asScore(affinity + recovery + teaching + lowThreat - publicPenalty - negotiationPenalty);
}

function computeActiveChannelFitness01(input: ChannelAffinityModelInput, defaults: typeof CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS, scores: ChannelScoreMap): Score01 {
  const current = scores[input.activeVisibleChannel] ?? asScore(defaults.lowEvidenceFallback01);
  const continuity = (activeAffinity01(input) as number) * defaults.activeChannelHoldBonus01;
  const cadence = (input.responseCadence01 as number) * 0.08;
  const overloadPenalty = (input.switchStress01 as number) * 0.10;
  return asScore((current as number) + continuity + cadence - overloadPenalty);
}

function computeMigrationPressure01(input: ChannelAffinityModelInput, scores: ChannelScoreMap, activeChannelFitness01: Score01, volatility01: Score01): Score01 {
  const ordered = channelOrder(scores);
  const topChannel = ordered[0];
  const topScore = scores[topChannel];
  const delta = Math.max(0, (topScore as number) - (activeChannelFitness01 as number));
  const switchStressPenalty = (input.switchStress01 as number) * 0.18;
  const volatilityPenalty = (volatility01 as number) * 0.10;
  const helperSignal = input.helper && !input.helper.shouldIntervenePublicly && topChannel !== input.activeVisibleChannel ? (input.helper.rescueWindow01 as number) * 0.06 : 0;
  return asScore(delta + helperSignal - switchStressPenalty - volatilityPenalty);
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

  if (migrationPressure01 < defaults.migrationThreshold01) {
    return 'HOLD_CURRENT';
  }

  if (migrationPressure01 >= defaults.hardMigrationThreshold01 && primary !== input.activeVisibleChannel) {
    if (primary === 'GLOBAL') return 'SHIFT_TO_GLOBAL';
    if (primary === 'SYNDICATE') return 'SHIFT_TO_SYNDICATE';
    if (primary === 'DEAL_ROOM') return 'SHIFT_TO_DEAL_ROOM';
    return 'SHIFT_TO_LOBBY';
  }

  if (privacyNeed01 >= 0.60 && crowdNeed01 >= 0.52 && secondary === 'SYNDICATE') {
    return 'SPLIT_CURRENT_AND_PRIVATE';
  }

  if (crowdNeed01 >= 0.68 && primary === 'GLOBAL' && input.activeVisibleChannel !== 'GLOBAL') {
    return 'SPLIT_CURRENT_AND_GLOBAL';
  }

  if (negotiationNeed01 >= 0.60 && primary === 'DEAL_ROOM') {
    return 'SHIFT_TO_DEAL_ROOM';
  }

  if (recoveryNeed01 >= 0.58 && primary === 'LOBBY') {
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
    Object.freeze({
      key: 'active_channel_fitness',
      signedDelta01: (score.activeChannelFitness01 as number) * 0.20,
      reason: 'Current channel fitness captures continuity, affinity, and present-scene coherence.',
    }),
    Object.freeze({
      key: 'migration_pressure',
      signedDelta01: (score.migrationPressure01 as number) * 0.24,
      reason: 'Migration pressure measures how much another lane materially outperforms the active one.',
    }),
    Object.freeze({
      key: 'privacy_need',
      signedDelta01: (score.privacyNeed01 as number) * 0.18,
      reason: 'Privacy need favors tactical and low-exposure channels.',
    }),
    Object.freeze({
      key: 'crowd_need',
      signedDelta01: (score.crowdNeed01 as number) * 0.16,
      reason: 'Crowd need favors theatrical channels when witness and stage value matter.',
    }),
    Object.freeze({
      key: 'negotiation_need',
      signedDelta01: (score.negotiationNeed01 as number) * 0.14,
      reason: 'Negotiation need favors channels that protect bluffing and offer leverage.',
    }),
    Object.freeze({
      key: 'recovery_need',
      signedDelta01: (score.recoveryNeed01 as number) * 0.12,
      reason: 'Recovery need favors channels that reduce social bleed and rebuild continuity.',
    }),
    Object.freeze({
      key: 'global_score',
      signedDelta01: (score.scores.GLOBAL as number) * 0.08,
      reason: 'Global score measures public-stage fit.',
    }),
    Object.freeze({
      key: 'syndicate_score',
      signedDelta01: (score.scores.SYNDICATE as number) * 0.08,
      reason: 'Syndicate score measures private tactical fit.',
    }),
    Object.freeze({
      key: 'deal_room_score',
      signedDelta01: (score.scores.DEAL_ROOM as number) * 0.08,
      reason: 'Deal-room score measures negotiation-specific fit.',
    }),
    Object.freeze({
      key: 'lobby_score',
      signedDelta01: (score.scores.LOBBY as number) * 0.08,
      reason: 'Lobby score measures recovery and low-threat fit.',
    }),
  ];

  if (input.helper) {
    factors.push(Object.freeze({
      key: 'helper_posture',
      signedDelta01: input.helper.shouldIntervenePublicly ? 0.10 : -0.04,
      reason: 'Helper posture changes whether witness value or private stabilization dominates.',
    }));
  }

  if (input.hater) {
    factors.push(Object.freeze({
      key: 'hater_posture',
      signedDelta01: input.hater.shouldLeakToGlobal ? 0.10 : (input.hater.shadowPriming01 as number) * -0.04,
      reason: 'Hater posture changes whether the scene wants public theater or shadow containment.',
    }));
  }

  return Object.freeze(
    factors
      .sort((left, right) => Math.abs(right.signedDelta01) - Math.abs(left.signedDelta01))
      .slice(0, defaults.explanationFactorLimit),
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
    liveopsHaterRaid01: pickScalar(aggregate, 'liveopsHaterRaid01', options.sourceSignal?.liveops?.haterRaid ? 1 : 0),
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
    liveopsHaterRaid01: pickScalar(window, 'liveopsHaterRaid01', options.sourceSignal?.liveops?.haterRaid ? 1 : 0),
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

    const scores = aggregates.map((aggregate) => {
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

    return Object.freeze({
      generatedAt,
      scores: Object.freeze(scores),
      strongestMigration,
      strongestHold,
    });
  }

  public toPriorState(score: ChannelAffinityScore): ChannelAffinityPriorState {
    return Object.freeze({
      activeChannelFitness01: score.activeChannelFitness01,
      migrationPressure01: score.migrationPressure01,
      privacyNeed01: score.privacyNeed01,
      generatedAt: score.generatedAt,
    });
  }

  public scoreInput(
    input: ChannelAffinityModelInput,
    prior: Nullable<ChannelAffinityPriorState> = null,
  ): ChannelAffinityScore {
    const { defaults, logger } = this.context;

    const volatility01 = computeVolatility01(input.evidenceRows);
    const privacyNeed01Raw = computePrivacyNeed01(input);
    const crowdNeed01 = computeCrowdNeed01(input);
    const negotiationNeed01 = computeNegotiationNeed01(input);
    const recoveryNeed01 = computeRecoveryNeed01(input);

    const scores: ChannelScoreMap = Object.freeze({
      GLOBAL: scoreGlobalChannel(input, crowdNeed01, privacyNeed01Raw),
      SYNDICATE: scoreSyndicateChannel(input, privacyNeed01Raw, recoveryNeed01),
      DEAL_ROOM: scoreDealRoomChannel(input, privacyNeed01Raw, negotiationNeed01, recoveryNeed01),
      LOBBY: scoreLobbyChannel(input, recoveryNeed01),
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
      input,
      defaults,
      scores,
      activeChannelFitness01,
      migrationPressure01,
      privacyNeed01,
      crowdNeed01,
      negotiationNeed01,
      recoveryNeed01,
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

    const explanationFactors = explanationFactorsForAffinity(
      input,
      defaults,
      {
        activeChannelFitness01,
        migrationPressure01,
        privacyNeed01,
        crowdNeed01,
        negotiationNeed01,
        recoveryNeed01,
        scores,
      },
    );

    const confidence01 = asScore100(
      (
        (activeChannelFitness01 as number) * 0.26 +
        (migrationPressure01 as number) * 0.30 +
        (1 - (input.switchStress01 as number)) * 0.16 +
        (1 - (volatility01 as number)) * 0.16 +
        (activeAffinity01(input) as number) * 0.12
      ) * 100,
    );

    const score: ChannelAffinityScore = Object.freeze({
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
      recommendation,
      shouldMigrate,
      shouldOpenSecondaryChannel,
      cooldownMs,
      evidenceRowIds: Object.freeze(unique(input.evidenceRows.map((row) => row.rowId))),
      explanationFactors,
      canonicalSnapshot: input.canonicalSnapshot,
      confidence01,
      modelVersion: CHAT_CHANNEL_AFFINITY_MODEL_VERSION,
    });

    logger.debug('channel_affinity_model_scored', {
      roomId: input.roomId,
      userId: input.userId,
      activeVisibleChannel: input.activeVisibleChannel,
      recommendedPrimaryChannel: score.recommendedPrimaryChannel,
      migrationPressure01: score.migrationPressure01,
      recommendation: score.recommendation,
      confidence01: score.confidence01,
    });

    return score;
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
  ].join(' | ');
}

export function channelAffinityShouldMove(score: ChannelAffinityScore): boolean {
  return score.shouldMigrate;
}

export function channelAffinityPrimaryScore(score: ChannelAffinityScore): Score01 {
  return score.scores[score.recommendedPrimaryChannel];
}
