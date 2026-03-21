/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT HELPER TIMING MODEL
 * FILE: backend/src/game/engine/chat/ml/HelperTimingModel.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative online-ML timing model for helper intervention inside the
 * backend chat authority lane.
 *
 * This file is intentionally backend-shaped:
 * - it consumes accepted feature rows or online aggregates,
 * - it respects the backend runtime lane,
 * - it reads engagement and hater posture as advisory inputs,
 * - it scores helper timing without becoming transcript authority,
 * - it stays explainable so replay / telemetry / proof surfaces can reason
 *   about why the helper did or did not enter a scene.
 *
 * The central question is:
 *
 *   "Should helper support enter this chat moment right now, later, softly,
 *    publicly, privately, or not at all?"
 *
 * The answer cannot be a single threshold because Point Zero One chat is not a
 * normal utility chat box. The same silence can mean:
 * - tactical focus,
 * - embarrassment,
 * - negotiation restraint,
 * - rage-quit drift,
 * - fear under swarm pressure,
 * - or helper-overload fatigue.
 *
 * So this model scores multiple sub-surfaces and then composes them:
 * - rescue pressure,
 * - teaching opportunity,
 * - public witness need,
 * - privacy need,
 * - hold advantage,
 * - helper fatigue,
 * - suppression,
 * - softness / firmness posture,
 * - timing confidence,
 * - and resulting intervention recommendation.
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

// ============================================================================
// MARK: Constants
// ============================================================================

export const CHAT_HELPER_TIMING_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_HELPER_TIMING_MODEL' as const;

export const CHAT_HELPER_TIMING_MODEL_VERSION =
  '2026.03.14-helper-timing-model.v2' as const;

export const CHAT_HELPER_TIMING_MODEL_RUNTIME_LAWS = Object.freeze([
  'Helper timing is advisory for orchestration and never transcript truth.',
  'High urgency does not always imply public intervention.',
  'Deal-room scenes privilege private precision over theatrical rescue.',
  'Global scenes may require witness value before helper silence becomes harmful.',
  'Helper fatigue is real and must throttle repeated support bursts.',
  'Hold advantage preserves drama when help would arrive too early.',
  'Suppression accounts for blackout, overhelp, and privacy-sensitive contexts.',
  'The model must stay explainable enough for replay, telemetry, and policy audit.',
] as const);

export const CHAT_HELPER_TIMING_MODEL_DEFAULTS = Object.freeze({
  lowEvidenceFallback01: 0.36,
  lowEvidenceRows: 2,
  baselineBlend01: 0.16,
  urgencyBlend01: 0.18,
  suppressionBlend01: 0.14,
  timingSpeakThreshold01: 0.48,
  timingEmergencyThreshold01: 0.84,
  timingTeachThreshold01: 0.62,
  timingHoldThreshold01: 0.54,
  publicWitnessThreshold01: 0.66,
  privateRescueThreshold01: 0.56,
  helperFatigueBase01: 0.14,
  helperFatigueDensityWeight01: 0.18,
  helperFatigueIgnoreWeight01: 0.12,
  helperFatigueBlackoutWeight01: 0.34,
  privacyBiasSyndicate01: 0.10,
  privacyBiasDealRoom01: 0.16,
  witnessBiasGlobal01: 0.10,
  teachingBiasLobby01: 0.12,
  cooldownBaseMs: 8_500,
  cooldownMinMs: 2_000,
  cooldownMaxMs: 30_000,
  delayBaseMs: 2_800,
  delayMinMs: 0,
  delayMaxMs: 15_000,
  explanationFactorLimit: 12,
} as const);

// ============================================================================
// MARK: Ports and options
// ============================================================================

export interface HelperTimingModelLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface HelperTimingModelClockPort {
  now(): UnixMs;
}

export interface HelperTimingModelOptions {
  readonly logger?: HelperTimingModelLoggerPort;
  readonly clock?: HelperTimingModelClockPort;
  readonly defaults?: Partial<typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS>;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
}

export interface HelperTimingModelContext {
  readonly logger: HelperTimingModelLoggerPort;
  readonly clock: HelperTimingModelClockPort;
  readonly defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS;
  readonly runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
}

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type HelperInterventionRecommendation =
  | 'SUPPRESS'
  | 'HOLD'
  | 'SOFT_PRIVATE_GUIDE'
  | 'FIRM_PRIVATE_GUIDE'
  | 'SOFT_PUBLIC_WITNESS'
  | 'PUBLIC_RECOVERY'
  | 'EMERGENCY_INTERCEPT'
  | 'TEACHING_WINDOW'
  | 'NEGOTIATION_REDIRECT'
  | 'POST_HATER_STABILIZE';

export type HelperInterventionStyle =
  | 'CALM'
  | 'BLUNT'
  | 'STRATEGIC'
  | 'WITNESS'
  | 'MENTOR'
  | 'NEGOTIATOR'
  | 'RECOVERY';

export interface HelperPersonaAffinity {
  readonly helperId: string;
  readonly style: HelperInterventionStyle;
  readonly affinity01: Score01;
  readonly reason: string;
}

export interface HelperTimingExplanationFactor {
  readonly key: string;
  readonly signedDelta01: number;
  readonly reason: string;
}

export interface HelperTimingPriorState {
  readonly timing01: Score01;
  readonly urgency01: Score01;
  readonly rescueWindow01: Score01;
  readonly suppression01: Score01;
  readonly generatedAt: UnixMs;
}

export interface HelperTimingModelInput {
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
  readonly learningProfile: Nullable<ChatLearningProfile>;
  readonly sourceSignal: Nullable<ChatSignalEnvelope>;
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly evidenceRows: readonly ChatFeatureRow[];
}

export interface HelperTimingScore {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<string>;
  readonly userId: Nullable<string>;
  readonly roomKind: ChatRoomKind | 'UNKNOWN';
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly timing01: Score01;
  readonly urgency01: Score01;
  readonly rescueWindow01: Score01;
  readonly teachingWindow01: Score01;
  readonly witnessNeed01: Score01;
  readonly privacyNeed01: Score01;
  readonly softness01: Score01;
  readonly firmness01: Score01;
  readonly publicness01: Score01;
  readonly holdAdvantage01: Score01;
  readonly fatigue01: Score01;
  readonly suppression01: Score01;
  readonly recommendation: HelperInterventionRecommendation;
  readonly preferredChannel: ChatVisibleChannel;
  readonly preferredStyle: HelperInterventionStyle;
  readonly preferredHelperId: string;
  readonly personaAffinities: readonly HelperPersonaAffinity[];
  readonly shouldInterveneNow: boolean;
  readonly shouldIntervenePublicly: boolean;
  readonly shouldQueuePrivatePrompt: boolean;
  readonly cooldownMs: number;
  readonly delayMs: number;
  readonly evidenceRowIds: readonly string[];
  readonly explanationFactors: readonly HelperTimingExplanationFactor[];
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly confidence01: Score100;
  readonly modelVersion: typeof CHAT_HELPER_TIMING_MODEL_VERSION;
}

export interface HelperTimingBatchResult {
  readonly generatedAt: UnixMs;
  readonly scores: readonly HelperTimingScore[];
  readonly hottest: Nullable<HelperTimingScore>;
  readonly coldest: Nullable<HelperTimingScore>;
}

// ============================================================================
// MARK: Defaults and low-level utilities
// ============================================================================

const DEFAULT_LOGGER: HelperTimingModelLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLOCK: HelperTimingModelClockPort = {
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

function isGlobal(input: HelperTimingModelInput): boolean {
  return input.activeVisibleChannel === 'GLOBAL';
}

function isSyndicate(input: HelperTimingModelInput): boolean {
  return input.activeVisibleChannel === 'SYNDICATE';
}

function isDealRoom(input: HelperTimingModelInput): boolean {
  return input.activeVisibleChannel === 'DEAL_ROOM';
}

function isLobby(input: HelperTimingModelInput): boolean {
  return input.activeVisibleChannel === 'LOBBY';
}

function activeAffinity01(input: HelperTimingModelInput): Score01 {
  switch (input.activeVisibleChannel) {
    case 'GLOBAL':
      return input.affinityGlobal01;
    case 'SYNDICATE':
      return input.affinitySyndicate01;
    case 'DEAL_ROOM':
      return input.affinityDealRoom01;
    case 'LOBBY':
      return input.affinityLobby01;
    default:
      return asScore(0.25);
  }
}

function lowEvidence(input: HelperTimingModelInput, defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS): boolean {
  return input.evidenceRows.length <= defaults.lowEvidenceRows;
}


// ============================================================================
// MARK: Component scorers
// ============================================================================

function computeVolatility01(rows: readonly ChatFeatureRow[]): Score01 {
  if (rows.length < 3) return asScore(0.16);
  const switches = rows.map((row) => safeNumber(row.scalarFeatures.channelSwitchVelocity01, 0));
  const rescue = rows.map((row) => safeNumber(row.scalarFeatures.rescueOpportunity01, 0));
  const cadence = rows.map((row) => safeNumber(row.scalarFeatures.responseCadence01, 0));
  const heat = rows.map((row) => safeNumber(row.scalarFeatures.roomHeat01, 0));
  const deviations = [switches, rescue, cadence, heat].map((series) => { const avg = mean(series); return mean(series.map((value) => Math.abs(value - avg))); });
  return asScore(mean(deviations) * 1.24);
}

function computePrivacyNeed01(input: HelperTimingModelInput, defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS): Score01 {
  const embarrassment = (input.embarrassment01 as number) * 0.22;
  const intimidation = (input.intimidation01 as number) * 0.18;
  const negotiation = (input.negotiationIntensity01 as number) * 0.14;
  const dealBias = isDealRoom(input) ? defaults.privacyBiasDealRoom01 : isSyndicate(input) ? defaults.privacyBiasSyndicate01 : 0;
  const desperation = (input.desperation01 as number) * 0.08;
  return asScore(embarrassment + intimidation + negotiation + dealBias + desperation);
}

function computeWitnessNeed01(input: HelperTimingModelInput, defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS): Score01 {
  const crowd = (input.positiveSwarm01 as number) * 0.08 + (input.negativeSwarm01 as number) * 0.12;
  const visibility = (input.visibilityExposure01 as number) * 0.18;
  const haterPublic = input.hater ? (input.hater.publicLeak01 as number) * 0.14 : 0;
  const globalBias = isGlobal(input) ? defaults.witnessBiasGlobal01 : 0;
  const sovereignty = (input.nearSovereignty01 as number) * 0.10;
  const privatePenalty = isDealRoom(input) ? 0.14 : 0;
  return asScore(crowd + visibility + haterPublic + globalBias + sovereignty - privatePenalty);
}

function computeRescueWindow01(input: HelperTimingModelInput): Score01 {
  const desperation = (input.desperation01 as number) * 0.18;
  const frustration = (input.frustration01 as number) * 0.16;
  const embarrassment = (input.embarrassment01 as number) * 0.12;
  const intimidation = (input.intimidation01 as number) * 0.12;
  const churn = (input.churnRisk01 as number) * 0.14;
  const rescue = (input.rescueOpportunity01 as number) * 0.18;
  const hostile = (input.hostileMomentum01 as number) * 0.10;
  const pressure = input.pressureTier === 'CRITICAL' ? 0.14 : input.pressureTier === 'HIGH' ? 0.08 : input.pressureTier === 'ELEVATED' ? 0.04 : 0;
  return asScore(desperation + frustration + embarrassment + intimidation + churn + rescue + hostile + pressure);
}

function computeTeachingWindow01(input: HelperTimingModelInput, defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS): Score01 {
  const curiosity = (input.curiosity01 as number) * 0.18;
  const attachment = (input.attachment01 as number) * 0.16;
  const trust = (input.trust01 as number) * 0.14;
  const cadence = (input.responseCadence01 as number) * 0.10;
  const receptivity = (input.helperReceptivity01 as number) * 0.18;
  const lobbyBias = isLobby(input) ? defaults.teachingBiasLobby01 : 0;
  const embarrassmentPenalty = (input.embarrassment01 as number) * 0.08;
  return asScore(curiosity + attachment + trust + cadence + receptivity + lobbyBias - embarrassmentPenalty);
}

function computeHoldAdvantage01(input: HelperTimingModelInput, teachingWindow01: Score01): Score01 {
  const confidence = (input.confidence01 as number) * 0.12;
  const dominance = (input.dominance01 as number) * 0.08;
  const tacticalDeal = isDealRoom(input) ? (input.negotiationIntensity01 as number) * 0.18 + (input.bluffExposure01 as number) * 0.08 : 0;
  const sovereignty = (input.nearSovereignty01 as number) * 0.12;
  const stableEngagement = input.engagement ? (input.engagement.engagement01 as number) * 0.12 + (1 - (input.engagement.fragility01 as number)) * 0.10 : 0.10;
  const softTeaching = (teachingWindow01 as number) * 0.06;
  const rescuePenalty = (input.rescueOpportunity01 as number) * 0.12;
  return asScore(confidence + dominance + tacticalDeal + sovereignty + stableEngagement + softTeaching - rescuePenalty);
}

function computeFatigue01(input: HelperTimingModelInput, defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS, volatility01: Score01): Score01 {
  const base = defaults.helperFatigueBase01;
  const density = (input.helperDensity01 as number) * defaults.helperFatigueDensityWeight01;
  const ignore = (input.helperIgnore01 as number) * defaults.helperFatigueIgnoreWeight01;
  const blackout = (input.liveopsHelperBlackout01 as number) * defaults.helperFatigueBlackoutWeight01;
  const volatility = (volatility01 as number) * 0.08;
  return asScore(base + density + ignore + blackout + volatility);
}

function computeSuppression01(input: HelperTimingModelInput, fatigue01: Score01, privacyNeed01: Score01): Score01 {
  const blackout = (input.liveopsHelperBlackout01 as number) * 0.34;
  const overhelp = (input.helperDensity01 as number) * 0.14;
  const privacy = (privacyNeed01 as number) * 0.16;
  const lowReceptivity = Math.max(0, 0.42 - (input.helperReceptivity01 as number)) * 0.32;
  const fatigue = (fatigue01 as number) * 0.20;
  return asScore(blackout + overhelp + privacy + lowReceptivity + fatigue);
}

function computeSoftness01(input: HelperTimingModelInput, rescueWindow01: Score01, teachingWindow01: Score01): Score01 {
  const intimidation = (input.intimidation01 as number) * 0.18;
  const embarrassment = (input.embarrassment01 as number) * 0.20;
  const trust = (input.trust01 as number) * 0.12;
  const attachment = (input.attachment01 as number) * 0.10;
  const teaching = (teachingWindow01 as number) * 0.06;
  const emergencyFirmnessPenalty = Math.max(0, (rescueWindow01 as number) - 0.80) * 0.20;
  const confidenceFirmnessPenalty = (input.confidence01 as number) * 0.10;
  return asScore(intimidation + embarrassment + trust + attachment + teaching - emergencyFirmnessPenalty - confidenceFirmnessPenalty);
}

function computeFirmness01(input: HelperTimingModelInput, softness01: Score01): Score01 {
  const confidence = (input.confidence01 as number) * 0.18;
  const dominance = (input.dominance01 as number) * 0.14;
  const frustration = (input.frustration01 as number) * 0.08;
  return asScore(confidence + dominance + frustration + (1 - (softness01 as number)) * 0.26);
}

function computePublicness01(input: HelperTimingModelInput, witnessNeed01: Score01, privacyNeed01: Score01, softness01: Score01): Score01 {
  const witness = (witnessNeed01 as number) * 0.24;
  const visibility = (input.visibilityExposure01 as number) * 0.12;
  const globalBias = isGlobal(input) ? 0.08 : 0;
  const publicHater = input.hater?.shouldLeakToGlobal ? 0.10 : 0;
  const privacyPenalty = (privacyNeed01 as number) * 0.22;
  const softnessPenalty = (softness01 as number) * 0.10;
  return asScore(witness + visibility + globalBias + publicHater - privacyPenalty - softnessPenalty);
}

function computeUrgency01(input: HelperTimingModelInput, rescueWindow01: Score01, suppression01: Score01): Score01 {
  const rescue = (rescueWindow01 as number) * 0.36;
  const engagementFragility = input.engagement ? (input.engagement.fragility01 as number) * 0.12 + (input.engagement.softDropoffRisk01 as number) * 0.10 : 0.10;
  const hater = input.hater ? (input.hater.targeting01 as number) * 0.10 + (input.hater.publicLeak01 as number) * 0.06 : 0.06;
  const switchStress = (input.switchStress01 as number) * 0.08;
  const cadenceBreak = Math.max(0, 0.52 - (input.responseCadence01 as number)) * 0.10;
  return asScore(rescue + engagementFragility + hater + switchStress + cadenceBreak - (suppression01 as number) * 0.18);
}

function computeTiming01(input: HelperTimingModelInput, defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS, urgency01: Score01, teachingWindow01: Score01, publicness01: Score01, holdAdvantage01: Score01, suppression01: Score01): Score01 {
  const base = lowEvidence(input, defaults) ? defaults.lowEvidenceFallback01 : 0.42 + (activeAffinity01(input) as number) * 0.10;
  const receptivity = (input.helperReceptivity01 as number) * 0.16;
  const antiIgnore = (1 - (input.helperIgnore01 as number)) * 0.08;
  const urgency = (urgency01 as number) * 0.26;
  const teaching = (teachingWindow01 as number) * 0.12;
  const publicness = (publicness01 as number) * 0.06;
  const holdPenalty = (holdAdvantage01 as number) * 0.22;
  const suppressionPenalty = (suppression01 as number) * 0.24;
  return asScore(base + receptivity + antiIgnore + urgency + teaching + publicness - holdPenalty - suppressionPenalty);
}


// ============================================================================
// MARK: Recommendation and persona routing
// ============================================================================

function recommendationForTiming(
  input: HelperTimingModelInput,
  defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS,
  timing01: Score01,
  urgency01: Score01,
  rescueWindow01: Score01,
  teachingWindow01: Score01,
  witnessNeed01: Score01,
  privacyNeed01: Score01,
  publicness01: Score01,
  holdAdvantage01: Score01,
  suppression01: Score01,
): HelperInterventionRecommendation {
  if (suppression01 >= 0.82 || input.liveopsHelperBlackout01 >= 0.86) {
    return 'SUPPRESS';
  }

  if (timing01 >= defaults.timingEmergencyThreshold01 && rescueWindow01 >= 0.74) {
    return publicness01 >= defaults.publicWitnessThreshold01
      ? 'EMERGENCY_INTERCEPT'
      : 'FIRM_PRIVATE_GUIDE';
  }

  if (input.hater && input.hater.targeting01 >= 0.72 && rescueWindow01 >= 0.54) {
    return publicness01 >= 0.60
      ? 'PUBLIC_RECOVERY'
      : 'POST_HATER_STABILIZE';
  }

  if (isDealRoom(input) && input.negotiationIntensity01 >= 0.58 && privacyNeed01 >= 0.46) {
    return 'NEGOTIATION_REDIRECT';
  }

  if (holdAdvantage01 >= defaults.timingHoldThreshold01 && urgency01 < 0.62) {
    return 'HOLD';
  }

  if (teachingWindow01 >= defaults.timingTeachThreshold01 && rescueWindow01 < 0.58) {
    return 'TEACHING_WINDOW';
  }

  if (publicness01 >= defaults.publicWitnessThreshold01 && witnessNeed01 >= 0.58) {
    return input.embarrassment01 >= 0.70 ? 'PUBLIC_RECOVERY' : 'SOFT_PUBLIC_WITNESS';
  }

  if (rescueWindow01 >= defaults.privateRescueThreshold01) {
    return input.embarrassment01 >= 0.58 || input.intimidation01 >= 0.52
      ? 'SOFT_PRIVATE_GUIDE'
      : 'FIRM_PRIVATE_GUIDE';
  }

  if (timing01 >= defaults.timingSpeakThreshold01) {
    return privacyNeed01 >= 0.52 ? 'SOFT_PRIVATE_GUIDE' : 'SOFT_PUBLIC_WITNESS';
  }

  return 'HOLD';
}

function preferredChannelForTiming(
  input: HelperTimingModelInput,
  recommendation: HelperInterventionRecommendation,
): ChatVisibleChannel {
  if (
    recommendation === 'EMERGENCY_INTERCEPT' ||
    recommendation === 'SOFT_PUBLIC_WITNESS' ||
    recommendation === 'PUBLIC_RECOVERY'
  ) {
    return isGlobal(input) ? 'GLOBAL' : input.visibilityExposure01 >= 0.56 ? 'GLOBAL' : 'SYNDICATE';
  }

  if (recommendation === 'NEGOTIATION_REDIRECT') {
    return 'DEAL_ROOM';
  }

  if (recommendation === 'TEACHING_WINDOW') {
    return isLobby(input) ? 'LOBBY' : 'SYNDICATE';
  }

  if (isDealRoom(input)) return 'DEAL_ROOM';
  if (isSyndicate(input)) return 'SYNDICATE';
  if (isLobby(input)) return 'LOBBY';
  return 'SYNDICATE';
}

function preferredStyleForTiming(
  recommendation: HelperInterventionRecommendation,
  softness01: Score01,
  firmness01: Score01,
): HelperInterventionStyle {
  if (recommendation === 'EMERGENCY_INTERCEPT') return firmness01 >= 0.58 ? 'BLUNT' : 'RECOVERY';
  if (recommendation === 'PUBLIC_RECOVERY') return 'WITNESS';
  if (recommendation === 'SOFT_PUBLIC_WITNESS') return 'WITNESS';
  if (recommendation === 'NEGOTIATION_REDIRECT') return 'NEGOTIATOR';
  if (recommendation === 'TEACHING_WINDOW') return softness01 >= 0.56 ? 'MENTOR' : 'STRATEGIC';
  if (recommendation === 'POST_HATER_STABILIZE') return 'RECOVERY';
  return softness01 >= 0.54 ? 'CALM' : 'BLUNT';
}

function helperAffinitiesForInput(
  input: HelperTimingModelInput,
  preferredStyle: HelperInterventionStyle,
): readonly HelperPersonaAffinity[] {
  const candidates: HelperPersonaAffinity[] = [];

  candidates.push(Object.freeze({
    helperId: 'HELPER_CALM_01',
    style: 'CALM' as const,
    affinity01: asScore((input.trust01 as number) * 0.24 + (input.embarrassment01 as number) * 0.18 + (input.intimidation01 as number) * 0.14 + (input.attachment01 as number) * 0.10),
    reason: 'Best when the player needs de-escalation without humiliation.',
  }));

  candidates.push(Object.freeze({
    helperId: 'HELPER_BLUNT_01',
    style: 'BLUNT' as const,
    affinity01: asScore((input.confidence01 as number) * 0.18 + (input.dominance01 as number) * 0.16 + (input.frustration01 as number) * 0.10 + Math.max(0, 0.60 - (input.embarrassment01 as number)) * 0.08),
    reason: 'Best when the player can absorb hard guidance and needs a fast redirect.',
  }));

  candidates.push(Object.freeze({
    helperId: 'HELPER_STRATEGIC_01',
    style: 'STRATEGIC' as const,
    affinity01: asScore((input.curiosity01 as number) * 0.18 + (input.responseCadence01 as number) * 0.12 + (input.negotiationIntensity01 as number) * 0.10 + (input.trust01 as number) * 0.10),
    reason: 'Best when the moment is still cognitively recoverable.',
  }));

  candidates.push(Object.freeze({
    helperId: 'HELPER_WITNESS_01',
    style: 'WITNESS' as const,
    affinity01: asScore((input.visibilityExposure01 as number) * 0.18 + (input.negativeSwarm01 as number) * 0.14 + (input.embarrassment01 as number) * 0.12 + (input.positiveSwarm01 as number) * 0.06),
    reason: 'Best when the room must see the helper anchor the scene.',
  }));

  candidates.push(Object.freeze({
    helperId: 'HELPER_MENTOR_01',
    style: 'MENTOR' as const,
    affinity01: asScore((input.curiosity01 as number) * 0.22 + (input.attachment01 as number) * 0.18 + (input.helperReceptivity01 as number) * 0.18 + (input.trust01 as number) * 0.12),
    reason: 'Best when the system is coaching, not rescuing.',
  }));

  candidates.push(Object.freeze({
    helperId: 'HELPER_NEGOTIATOR_01',
    style: 'NEGOTIATOR' as const,
    affinity01: asScore((input.negotiationIntensity01 as number) * 0.26 + (input.dealPressure01 as number) * 0.18 + (input.bluffExposure01 as number) * 0.14 + (isDealRoom(input) ? 0.12 : 0)),
    reason: 'Best when the active damage surface is negotiation psychology.',
  }));

  candidates.push(Object.freeze({
    helperId: 'HELPER_RECOVERY_01',
    style: 'RECOVERY' as const,
    affinity01: asScore((input.rescueOpportunity01 as number) * 0.24 + (input.churnRisk01 as number) * 0.18 + (input.frustration01 as number) * 0.14 + (input.desperation01 as number) * 0.14),
    reason: 'Best when the player is close to hard drop and needs stabilization first.',
  }));

  const boosted = candidates.map((candidate) => candidate.style === preferredStyle
    ? Object.freeze({ ...candidate, affinity01: asScore((candidate.affinity01 as number) + 0.04) })
    : candidate);

  return Object.freeze(
    boosted.sort((left, right) => (right.affinity01 as number) - (left.affinity01 as number)),
  );
}

function computeCooldownMs(
  defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS,
  timing01: Score01,
  suppression01: Score01,
  fatigue01: Score01,
): number {
  const raw =
    defaults.cooldownBaseMs -
    (timing01 as number) * 4_500 +
    (suppression01 as number) * 8_000 +
    (fatigue01 as number) * 5_000;

  return Math.max(defaults.cooldownMinMs, Math.min(defaults.cooldownMaxMs, Math.round(raw)));
}

function computeDelayMs(
  defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS,
  recommendation: HelperInterventionRecommendation,
  urgency01: Score01,
  holdAdvantage01: Score01,
): number {
  if (recommendation === 'EMERGENCY_INTERCEPT' || recommendation === 'PUBLIC_RECOVERY') return 0;

  let raw =
    defaults.delayBaseMs -
    (urgency01 as number) * 2_400 +
    (holdAdvantage01 as number) * 3_800;

  if (recommendation === 'HOLD') raw += 2_500;
  if (recommendation === 'TEACHING_WINDOW') raw += 1_000;
  if (recommendation === 'NEGOTIATION_REDIRECT') raw += 500;

  return Math.max(defaults.delayMinMs, Math.min(defaults.delayMaxMs, Math.round(raw)));
}

function explanationFactorsForTiming(
  input: HelperTimingModelInput,
  defaults: typeof CHAT_HELPER_TIMING_MODEL_DEFAULTS,
  score: {
    readonly timing01: Score01;
    readonly urgency01: Score01;
    readonly rescueWindow01: Score01;
    readonly teachingWindow01: Score01;
    readonly witnessNeed01: Score01;
    readonly privacyNeed01: Score01;
    readonly softness01: Score01;
    readonly firmness01: Score01;
    readonly publicness01: Score01;
    readonly holdAdvantage01: Score01;
    readonly fatigue01: Score01;
    readonly suppression01: Score01;
  },
): readonly HelperTimingExplanationFactor[] {
  const factors: HelperTimingExplanationFactor[] = [
    Object.freeze({
      key: 'timing',
      signedDelta01: (score.timing01 as number) * 0.20,
      reason: 'Composite timing score captures overall helper entry fitness.',
    }),
    Object.freeze({
      key: 'urgency',
      signedDelta01: (score.urgency01 as number) * 0.18,
      reason: 'Urgency rises when rescue, fragility, pressure, and hostile posture converge.',
    }),
    Object.freeze({
      key: 'rescue_window',
      signedDelta01: (score.rescueWindow01 as number) * 0.18,
      reason: 'Rescue window measures how costly continued silence would be.',
    }),
    Object.freeze({
      key: 'teaching_window',
      signedDelta01: (score.teachingWindow01 as number) * 0.12,
      reason: 'Teaching window measures whether guidance can still improve play rather than merely soothe.',
    }),
    Object.freeze({
      key: 'witness_need',
      signedDelta01: (score.witnessNeed01 as number) * 0.10,
      reason: 'Witness need captures whether the room must see stabilization happen.',
    }),
    Object.freeze({
      key: 'privacy_need',
      signedDelta01: -((score.privacyNeed01 as number) * 0.12),
      reason: 'Privacy need discounts public helper action when exposure is dangerous.',
    }),
    Object.freeze({
      key: 'softness',
      signedDelta01: (score.softness01 as number) * 0.06,
      reason: 'Softness steers delivery toward calm rescue or gentle teaching.',
    }),
    Object.freeze({
      key: 'firmness',
      signedDelta01: (score.firmness01 as number) * 0.06,
      reason: 'Firmness steers delivery toward direct corrective support.',
    }),
    Object.freeze({
      key: 'publicness',
      signedDelta01: (score.publicness01 as number) * 0.08,
      reason: 'Publicness measures how suitable on-stage intervention would be.',
    }),
    Object.freeze({
      key: 'hold_advantage',
      signedDelta01: -((score.holdAdvantage01 as number) * 0.16),
      reason: 'Hold advantage preserves drama and respects tactical quiet when early help would flatten the beat.',
    }),
    Object.freeze({
      key: 'fatigue',
      signedDelta01: -((score.fatigue01 as number) * 0.12),
      reason: 'Fatigue prevents repeated helper pings from degrading into noise.',
    }),
    Object.freeze({
      key: 'suppression',
      signedDelta01: -((score.suppression01 as number) * 0.18),
      reason: 'Suppression captures blackout, overhelp, privacy, and low-receptivity conditions.',
    }),
  ];

  if (input.hater) {
    factors.push(Object.freeze({
      key: 'hater_targeting',
      signedDelta01: (input.hater.targeting01 as number) * 0.08,
      reason: 'Hater posture can materially raise the value of helper intervention.',
    }));
  }

  if (isDealRoom(input)) {
    factors.push(Object.freeze({
      key: 'deal_room_private_bias',
      signedDelta01: -0.06,
      reason: 'Deal-room scenes discount theatrical help and favor precision guidance.',
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
  },
): HelperTimingModelInput {
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
  },
): HelperTimingModelInput {
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
    learningProfile: options.learningProfile ?? null,
    sourceSignal: options.sourceSignal ?? null,
    canonicalSnapshot: window.canonicalSnapshot ?? null,
    evidenceRows: [],
  });
}


// ============================================================================
// MARK: Model implementation
// ============================================================================

export class HelperTimingModel {
  private readonly context: HelperTimingModelContext;

  public constructor(options: HelperTimingModelOptions = {}) {
    this.context = Object.freeze({
      logger: options.logger ?? DEFAULT_LOGGER,
      clock: options.clock ?? DEFAULT_CLOCK,
      defaults: Object.freeze({
        ...CHAT_HELPER_TIMING_MODEL_DEFAULTS,
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
      readonly prior?: Nullable<HelperTimingPriorState>;
    } = {},
  ): HelperTimingScore {
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
      readonly prior?: Nullable<HelperTimingPriorState>;
    } = {},
  ): HelperTimingScore {
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
      readonly prior?: Nullable<HelperTimingPriorState>;
    } = {},
  ): HelperTimingScore {
    const aggregate = aggregateOnlineFeatureWindow(rowsOrBatch, 'HELPER_TIMING');
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
      readonly prior?: Nullable<HelperTimingPriorState>;
    } = {},
  ): HelperTimingScore {
    const aggregate = store.aggregate({ ...query, family: 'HELPER_TIMING' });
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
      readonly priorsByUserId?: Readonly<Record<string, HelperTimingPriorState>>;
    } = {},
  ): HelperTimingBatchResult {
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
        prior: userId ? options.priorsByUserId?.[userId] ?? null : null,
      });
    });

    const hottest = scores.length
      ? scores.reduce((best, current) => (current.timing01 > best.timing01 ? current : best))
      : null;

    const coldest = scores.length
      ? scores.reduce((worst, current) => (current.timing01 < worst.timing01 ? current : worst))
      : null;

    return Object.freeze({
      generatedAt,
      scores: Object.freeze(scores),
      hottest,
      coldest,
    });
  }

  public toPriorState(score: HelperTimingScore): HelperTimingPriorState {
    return Object.freeze({
      timing01: score.timing01,
      urgency01: score.urgency01,
      rescueWindow01: score.rescueWindow01,
      suppression01: score.suppression01,
      generatedAt: score.generatedAt,
    });
  }

  public scoreInput(
    input: HelperTimingModelInput,
    prior: Nullable<HelperTimingPriorState> = null,
  ): HelperTimingScore {
    const { defaults, logger } = this.context;

    const volatility01 = computeVolatility01(input.evidenceRows);
    const privacyNeed01 = computePrivacyNeed01(input, defaults);
    const witnessNeed01 = computeWitnessNeed01(input, defaults);
    const rescueWindow01 = computeRescueWindow01(input);
    const teachingWindow01 = computeTeachingWindow01(input, defaults);
    const holdAdvantage01 = computeHoldAdvantage01(input, teachingWindow01);
    const fatigue01 = computeFatigue01(input, defaults, volatility01);
    const suppression01Raw = computeSuppression01(input, fatigue01, privacyNeed01);
    const softness01 = computeSoftness01(input, rescueWindow01, teachingWindow01);
    const firmness01 = computeFirmness01(input, softness01);
    const publicness01 = computePublicness01(input, witnessNeed01, privacyNeed01, softness01);
    const urgency01Raw = computeUrgency01(input, rescueWindow01, suppression01Raw);
    const timing01Raw = computeTiming01(
      input,
      defaults,
      urgency01Raw,
      teachingWindow01,
      publicness01,
      holdAdvantage01,
      suppression01Raw,
    );

    const urgency01 = prior
      ? asScore((urgency01Raw as number) * (1 - defaults.urgencyBlend01) + (prior.urgency01 as number) * defaults.urgencyBlend01)
      : urgency01Raw;

    const suppression01 = prior
      ? asScore((suppression01Raw as number) * (1 - defaults.suppressionBlend01) + (prior.suppression01 as number) * defaults.suppressionBlend01)
      : suppression01Raw;

    const timing01 = prior
      ? asScore((timing01Raw as number) * (1 - defaults.baselineBlend01) + (prior.timing01 as number) * defaults.baselineBlend01)
      : timing01Raw;

    const recommendation = recommendationForTiming(
      input,
      defaults,
      timing01,
      urgency01,
      rescueWindow01,
      teachingWindow01,
      witnessNeed01,
      privacyNeed01,
      publicness01,
      holdAdvantage01,
      suppression01,
    );

    const preferredChannel = preferredChannelForTiming(input, recommendation);
    const preferredStyle = preferredStyleForTiming(recommendation, softness01, firmness01);
    const personaAffinities = helperAffinitiesForInput(input, preferredStyle);
    const preferredHelperId = personaAffinities[0]?.helperId ?? 'HELPER_CALM_01';

    const shouldInterveneNow =
      recommendation !== 'SUPPRESS' &&
      recommendation !== 'HOLD' &&
      timing01 >= defaults.timingSpeakThreshold01;

    const shouldIntervenePublicly =
      recommendation === 'EMERGENCY_INTERCEPT' ||
      recommendation === 'SOFT_PUBLIC_WITNESS' ||
      recommendation === 'PUBLIC_RECOVERY';

    const shouldQueuePrivatePrompt =
      !shouldIntervenePublicly &&
      recommendation !== 'SUPPRESS' &&
      recommendation !== 'HOLD';

    const cooldownMs = computeCooldownMs(defaults, timing01, suppression01, fatigue01);
    const delayMs = computeDelayMs(defaults, recommendation, urgency01, holdAdvantage01);

    const explanationFactors = explanationFactorsForTiming(
      input,
      defaults,
      {
        timing01,
        urgency01,
        rescueWindow01,
        teachingWindow01,
        witnessNeed01,
        privacyNeed01,
        softness01,
        firmness01,
        publicness01,
        holdAdvantage01,
        fatigue01,
        suppression01,
      },
    );

    const confidence01 = asScore100(
      (
        (timing01 as number) * 0.38 +
        (1 - (suppression01 as number)) * 0.22 +
        (1 - (fatigue01 as number)) * 0.18 +
        (input.helperReceptivity01 as number) * 0.12 +
        (1 - (input.helperIgnore01 as number)) * 0.10
      ) * 100,
    );

    const score: HelperTimingScore = Object.freeze({
      generatedAt: input.generatedAt,
      roomId: input.roomId,
      sessionId: input.sessionId,
      userId: input.userId,
      roomKind: input.roomKind,
      activeVisibleChannel: input.activeVisibleChannel,
      timing01,
      urgency01,
      rescueWindow01,
      teachingWindow01,
      witnessNeed01,
      privacyNeed01,
      softness01,
      firmness01,
      publicness01,
      holdAdvantage01,
      fatigue01,
      suppression01,
      recommendation,
      preferredChannel,
      preferredStyle,
      preferredHelperId,
      personaAffinities,
      shouldInterveneNow,
      shouldIntervenePublicly,
      shouldQueuePrivatePrompt,
      cooldownMs,
      delayMs,
      evidenceRowIds: Object.freeze(unique(input.evidenceRows.map((row) => row.rowId))),
      explanationFactors,
      canonicalSnapshot: input.canonicalSnapshot,
      confidence01,
      modelVersion: CHAT_HELPER_TIMING_MODEL_VERSION,
    });

    logger.debug('helper_timing_model_scored', {
      roomId: input.roomId,
      userId: input.userId,
      recommendation: score.recommendation,
      timing01: score.timing01,
      urgency01: score.urgency01,
      publicness01: score.publicness01,
      preferredChannel: score.preferredChannel,
      preferredHelperId: score.preferredHelperId,
    });

    return score;
  }
}

// ============================================================================
// MARK: Public helpers
// ============================================================================

export function helperTimingSummary(score: HelperTimingScore): string {
  return [
    `helper=${score.preferredHelperId}`,
    `rec=${score.recommendation}`,
    `channel=${score.preferredChannel}`,
    `timing=${(score.timing01 as number).toFixed(3)}`,
    `urgency=${(score.urgency01 as number).toFixed(3)}`,
    `public=${(score.publicness01 as number).toFixed(3)}`,
    `rescue=${(score.rescueWindow01 as number).toFixed(3)}`,
    `teach=${(score.teachingWindow01 as number).toFixed(3)}`,
    `hold=${(score.holdAdvantage01 as number).toFixed(3)}`,
    `suppress=${(score.suppression01 as number).toFixed(3)}`,
  ].join(' | ');
}

export function helperTimingShouldSpeak(score: HelperTimingScore): boolean {
  return score.shouldInterveneNow && score.recommendation !== 'SUPPRESS' && score.recommendation !== 'HOLD';
}

export function helperTimingIsEmergency(score: HelperTimingScore): boolean {
  return score.recommendation === 'EMERGENCY_INTERCEPT';
}

export function helperTimingPrefersPrivate(score: HelperTimingScore): boolean {
  return !score.shouldIntervenePublicly && score.shouldQueuePrivatePrompt;
}

export function helperTimingConfidence100(score: HelperTimingScore): Score100 {
  return score.confidence01;
}
