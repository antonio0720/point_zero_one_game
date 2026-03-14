/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ENGAGEMENT MODEL
 * FILE: backend/src/game/engine/chat/ml/EngagementModel.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend owner for live engagement scoring inside the authoritative
 * chat intelligence lane.
 *
 * Backend-truth question
 * ----------------------
 *
 *   "Given accepted backend feature rows, room context, affect posture,
 *    pressure state, channel posture, rescue history, and current social heat,
 *    how engaged is this player right now, how fragile is that engagement,
 *    how likely are they to answer, and what should the rest of backend chat
 *    authority do with that knowledge?"
 *
 * Doctrine
 * --------
 * - This model does not mutate transcript truth.
 * - This model does not decide moderation law.
 * - This model does not own helper or hater orchestration.
 * - This model does not replace room/channel policy.
 * - This model does translate accepted authoritative features into one coherent,
 *   explainable engagement judgment that the rest of backend chat can use.
 *
 * Why this file is deep
 * ---------------------
 * Point Zero One is not a normal social layer. A player can be quiet because:
 * - they are locked in,
 * - they are intimidated,
 * - they are bluffing in a deal room,
 * - they are near sovereignty and playing cold,
 * - they are spiraling toward churn,
 * - they are reading helper advice,
 * - they are watching a hater window,
 * - or because the room itself is suppressing expression.
 *
 * So engagement cannot be a shallow “message count” score. It has to evaluate:
 *
 * 1. active expressive participation,
 * 2. room/channel-specific silence interpretation,
 * 3. pressure-adjusted composure,
 * 4. confidence versus embarrassment drift,
 * 5. helper receptivity without conflating it with weakness,
 * 6. crowd heat without treating theatrical rooms as inherently healthier,
 * 7. negotiation quiet versus disengagement quiet,
 * 8. trend and fragility rather than just present-state activation.
 *
 * This model therefore produces:
 * - an engagement score,
 * - continuity and response-likelihood scores,
 * - fragility and soft-dropoff risk,
 * - channel-fit and crowd-readiness posture,
 * - actionable recommendations for downstream orchestration,
 * - and a load-bearing explanation surface for proof / telemetry / replay.
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
  CHAT_ONLINE_FEATURE_STORE_DEFAULTS,
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

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_ENGAGEMENT_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_ENGAGEMENT_MODEL' as const;

export const CHAT_ENGAGEMENT_MODEL_VERSION =
  '2026.03.14-engagement-model.v1' as const;

export const CHAT_ENGAGEMENT_MODEL_RUNTIME_LAWS = Object.freeze([
  'The model scores accepted authoritative features, not client intent.',
  'Deal-room silence may be tactical; silence is never classified blindly.',
  'High pressure is not disengagement when confidence and activity remain coherent.',
  'Helper receptivity raises recovery potential but does not automatically reduce engagement.',
  'Negative swarm conditions increase fragility faster than raw activity can offset.',
  'Global theatrics, syndicate intimacy, lobby looseness, and deal-room predation are interpreted differently.',
  'Trend matters: stable engagement is scored differently from brittle spikes.',
  'This model recommends posture; it does not create transcript truth.',
] as const);

export const CHAT_ENGAGEMENT_MODEL_DEFAULTS = Object.freeze({
  lowEvidenceFallback01: 0.44,
  baselineBlend01: 0.18,
  trendBlend01: 0.26,
  theatricalHeatSweetSpot01: 0.62,
  crowdOverheatThreshold01: 0.84,
  staleSilencePenalty01: 0.16,
  hardSilencePenalty01: 0.28,
  negativeSwarmPenalty01: 0.14,
  dealRoomSilenceDiscount01: 0.72,
  syndicateSilenceDiscount01: 0.84,
  sovereigntyColdPlayBonus01: 0.10,
  rescueWindowResponsivenessBonus01: 0.08,
  helperIgnoreFragilityPenalty01: 0.16,
  embarrassmentFragilityWeight01: 0.22,
  intimidationFragilityWeight01: 0.16,
  frustrationFragilityWeight01: 0.18,
  attachmentContinuityWeight01: 0.10,
  curiosityContinuityWeight01: 0.14,
  confidenceEngagementWeight01: 0.16,
  responseCadenceWeight01: 0.18,
  playerShareWeight01: 0.14,
  affinityWeight01: 0.12,
  maxExplanationFactors: 12,
  lowEvidenceRowCount: 2,
  staleWindowMs: 90_000,
  freshnessFloorMs: 6_000,
  volatilityLookbackRows: 6,
  channelBiasGlobal01: 0.05,
  channelBiasSyndicate01: 0.06,
  channelBiasDealRoom01: -0.03,
  channelBiasLobby01: 0.08,
  roomBiasBattle01: 0.02,
  roomBiasSyndicate01: 0.05,
  roomBiasDealRoom01: -0.04,
  roomBiasLobby01: 0.09,
  roomBiasGlobalStage01: 0.04,
  lowEngagementThreshold01: 0.35,
  softDropoffThreshold01: 0.58,
  hardHelperThreshold01: 0.74,
  crowdAmplifyThreshold01: 0.72,
  cinematicHoldThreshold01: 0.62,
} as const);

// ============================================================================
// MARK: Ports and options
// ============================================================================

export interface EngagementModelLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface EngagementModelClockPort {
  now(): UnixMs;
}

export interface EngagementModelOptions {
  readonly logger?: EngagementModelLoggerPort;
  readonly clock?: EngagementModelClockPort;
  readonly defaults?: Partial<typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS>;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
}

export interface EngagementModelContext {
  readonly logger: EngagementModelLoggerPort;
  readonly clock: EngagementModelClockPort;
  readonly defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS;
  readonly runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
}

// ============================================================================
// MARK: Input normalization contracts
// ============================================================================

export interface EngagementModelInput {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly sessionId: Nullable<ChatSessionId>;
  readonly userId: Nullable<ChatUserId>;
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
  readonly rescueOpportunity01: Score01;
  readonly visibilityExposure01: Score01;
  readonly switchStress01: Score01;
  readonly averageMessageLength01: Score01;
  readonly helperDensity01: Score01;
  readonly haterDensity01: Score01;
  readonly roomCrowding01: Score01;
  readonly confidence01: Score01;
  readonly frustration01: Score01;
  readonly intimidation01: Score01;
  readonly attachment01: Score01;
  readonly curiosity01: Score01;
  readonly embarrassment01: Score01;
  readonly relief01: Score01;
  readonly affinityGlobal01: Score01;
  readonly affinitySyndicate01: Score01;
  readonly affinityDealRoom01: Score01;
  readonly affinityLobby01: Score01;
  readonly battleRescueWindowOpen01: Score01;
  readonly battleShieldIntegrity01: Score01;
  readonly runNearSovereignty01: Score01;
  readonly runBankruptcyWarning01: Score01;
  readonly multiplayerRankingPressure01: Score01;
  readonly economyLiquidityStress01: Score01;
  readonly economyOverpayRisk01: Score01;
  readonly economyBluffRisk01: Score01;
  readonly liveopsHeatMultiplier01: Score01;
  readonly liveopsHelperBlackout01: Score01;
  readonly liveopsHaterRaid01: Score01;
  readonly silenceBand: 'FRESH' | 'STALE' | 'HARD' | 'UNKNOWN';
  readonly roomSwarmDirection: 'NEGATIVE' | 'POSITIVE' | 'NEUTRAL' | 'UNKNOWN';
  readonly sourceEventKind: string;
  readonly sourceChannel: string;
  readonly contributorBand: 'QUIET' | 'ACTIVE' | 'SWARM' | 'UNKNOWN';
  readonly freshnessMs: number;
  readonly evidenceRowIds: readonly string[];
  readonly evidenceRows: readonly ChatFeatureRow[];
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
}

export interface EngagementModelPriorState {
  readonly engagement01: Score01;
  readonly continuity01: Score01;
  readonly responseLikelihood01: Score01;
  readonly fragility01: Score01;
  readonly softDropoffRisk01: Score01;
  readonly generatedAt: UnixMs;
}

// ============================================================================
// MARK: Result contracts
// ============================================================================

export type EngagementBand =
  | 'FROZEN'
  | 'LOW'
  | 'CAUTIOUS'
  | 'ACTIVE'
  | 'LOCKED_IN'
  | 'ELECTRIC';

export type EngagementRecommendation =
  | 'NONE'
  | 'KEEP_AMBIENT'
  | 'AMPLIFY_ROOM'
  | 'DEFER_TO_CINEMATIC_SILENCE'
  | 'LIGHT_HELPER'
  | 'HARD_HELPER'
  | 'REDUCE_HATER'
  | 'HOLD_DEALROOM_PRESSURE';

export interface EngagementScoreContribution {
  readonly key: string;
  readonly signedDelta01: number;
  readonly reason: string;
}

export interface EngagementModelDiagnostics {
  readonly rowCount: number;
  readonly freshnessMs: number;
  readonly lowEvidence: boolean;
  readonly activeAffinity01: Score01;
  readonly pressureComposure01: Score01;
  readonly silenceInterpretationPenalty01: Score01;
  readonly theatricalReadiness01: Score01;
  readonly negotiationQuiet01: Score01;
  readonly volatility01: Score01;
  readonly explanationFactors: readonly EngagementScoreContribution[];
}

export interface EngagementModelScore {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly userId: Nullable<ChatUserId>;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly band: EngagementBand;
  readonly engagement01: Score01;
  readonly engagement100: Score100;
  readonly continuity01: Score01;
  readonly responseLikelihood01: Score01;
  readonly fragility01: Score01;
  readonly softDropoffRisk01: Score01;
  readonly crowdReadiness01: Score01;
  readonly quality01: Score01;
  readonly recommendation: EngagementRecommendation;
  readonly shouldHoldCinematicSilence: boolean;
  readonly shouldInviteAmbientWitnesses: boolean;
  readonly shouldSoftHelper: boolean;
  readonly shouldHardHelper: boolean;
  readonly diagnostics: EngagementModelDiagnostics;
}

export interface EngagementScoreBatchResult {
  readonly generatedAt: UnixMs;
  readonly scores: readonly EngagementModelScore[];
  readonly strongest: Nullable<EngagementModelScore>;
  readonly weakest: Nullable<EngagementModelScore>;
}

// ============================================================================
// MARK: Internal defaults and helpers
// ============================================================================

const DEFAULT_LOGGER: EngagementModelLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLOCK: EngagementModelClockPort = {
  now: () => asUnixMs(Date.now()),
};

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function ratio(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return fallback;
  }
  return numerator / denominator;
}

function asScore(value: number): Score01 {
  return clamp01(value);
}

function asScore100(value: number): Score100 {
  return clamp100(value);
}

function pickScalar(aggregate: ChatOnlineFeatureAggregate | ChatOnlineInferenceWindow, key: string, fallback = 0): Score01 {
  return asScore(safeNumber(aggregate.scalarFeatures[key], fallback));
}

function pickCategory(
  aggregate: ChatOnlineFeatureAggregate | ChatOnlineInferenceWindow,
  key: string,
  fallback: string,
): string {
  const value = aggregate.categoricalFeatures[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Array.from(new Set(values));
}

function signedContribution(key: string, signedDelta01: number, reason: string): EngagementScoreContribution {
  return Object.freeze({
    key,
    signedDelta01,
    reason,
  });
}

function activeAffinity01(input: EngagementModelInput): Score01 {
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

function channelBias01(
  channel: ChatVisibleChannel,
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
): number {
  switch (channel) {
    case 'GLOBAL':
      return defaults.channelBiasGlobal01;
    case 'SYNDICATE':
      return defaults.channelBiasSyndicate01;
    case 'DEAL_ROOM':
      return defaults.channelBiasDealRoom01;
    case 'LOBBY':
      return defaults.channelBiasLobby01;
    default:
      return 0;
  }
}

function roomBias01(roomKind: ChatRoomKind | 'UNKNOWN', defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS): number {
  switch (roomKind) {
    case 'SYNDICATE':
      return defaults.roomBiasSyndicate01;
    case 'DEAL_ROOM':
      return defaults.roomBiasDealRoom01;
    case 'LOBBY':
      return defaults.roomBiasLobby01;
    case 'GLOBAL':
      return defaults.roomBiasGlobalStage01;
    default:
      return 0;
  }
}

function isNegativeSwarm(input: EngagementModelInput): boolean {
  return input.roomSwarmDirection === 'NEGATIVE';
}

function isPositiveSwarm(input: EngagementModelInput): boolean {
  return input.roomSwarmDirection === 'POSITIVE';
}

function isDealRoom(input: EngagementModelInput): boolean {
  return input.activeVisibleChannel === 'DEAL_ROOM' || input.roomKind === 'DEAL_ROOM';
}

function isSyndicate(input: EngagementModelInput): boolean {
  return input.activeVisibleChannel === 'SYNDICATE' || input.roomKind === 'SYNDICATE';
}

function isLobby(input: EngagementModelInput): boolean {
  return input.activeVisibleChannel === 'LOBBY' || input.roomKind === 'LOBBY';
}

function isGlobal(input: EngagementModelInput): boolean {
  return input.activeVisibleChannel === 'GLOBAL' || input.roomKind === 'GLOBAL';
}

function pressureIntensity01(pressureTier: PressureTier): Score01 {
  switch (pressureTier) {
    case 'NONE':
      return asScore(0);
    case 'BUILDING':
      return asScore(0.25);
    case 'ELEVATED':
      return asScore(0.50);
    case 'HIGH':
      return asScore(0.75);
    case 'CRITICAL':
      return asScore(1);
    default:
      return asScore(0.5);
  }
}

function silencePenalty01(
  input: EngagementModelInput,
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
): Score01 {
  const base =
    input.silenceBand === 'HARD'
      ? defaults.hardSilencePenalty01
      : input.silenceBand === 'STALE'
        ? defaults.staleSilencePenalty01
        : 0;

  if (!base) return asScore(0);

  if (isDealRoom(input)) {
    return asScore(base * defaults.dealRoomSilenceDiscount01);
  }

  if (isSyndicate(input)) {
    return asScore(base * defaults.syndicateSilenceDiscount01);
  }

  if (input.runNearSovereignty01 >= 0.66 && input.confidence01 >= 0.56) {
    return asScore(Math.max(0, base - defaults.sovereigntyColdPlayBonus01));
  }

  return asScore(base);
}

function theatricalHeatReadiness01(
  input: EngagementModelInput,
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
): Score01 {
  if (!isGlobal(input) && !isLobby(input)) {
    return asScore(0.30 + input.roomHeat01 * 0.20);
  }

  const sweetSpot = defaults.theatricalHeatSweetSpot01;
  const distance = Math.abs((input.roomHeat01 as number) - sweetSpot);
  const centered = clamp01(1 - ratio(distance, sweetSpot || 1, 1));
  const positiveSwarmBoost = isPositiveSwarm(input) ? 0.10 : 0;
  const overheatPenalty = input.roomHeat01 >= defaults.crowdOverheatThreshold01 ? 0.12 : 0;
  return asScore(centered + positiveSwarmBoost - overheatPenalty);
}

function negotiationQuiet01(input: EngagementModelInput): Score01 {
  if (!isDealRoom(input)) return asScore(0);

  return asScore(
    input.economyBluffRisk01 * 0.34 +
      input.economyOverpayRisk01 * 0.24 +
      (1 - input.recentPlayerShare01) * 0.18 +
      input.responseCadence01 * 0.10 +
      input.confidence01 * 0.08 +
      input.visibilityExposure01 * 0.06,
  );
}

function contributorBandDensity01(band: EngagementModelInput['contributorBand']): Score01 {
  switch (band) {
    case 'QUIET':
      return asScore(0.24);
    case 'ACTIVE':
      return asScore(0.58);
    case 'SWARM':
      return asScore(0.88);
    default:
      return asScore(0.40);
  }
}

function lowEvidence(input: EngagementModelInput, defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS): boolean {
  return input.evidenceRows.length < defaults.lowEvidenceRowCount;
}

function freshnessStrength01(input: EngagementModelInput, defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS): Score01 {
  const freshnessWindow = Math.max(defaults.staleWindowMs, defaults.freshnessFloorMs);
  return asScore(1 - ratio(input.freshnessMs, freshnessWindow, 1));
}

function computeVolatility01(
  rows: readonly ChatFeatureRow[],
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
): Score01 {
  const slice = rows.slice(0, defaults.volatilityLookbackRows);
  if (slice.length < 2) return asScore(0.08);

  let delta = 0;
  for (let index = 1; index < slice.length; index += 1) {
    const current = safeNumber(slice[index - 1].scalarFeatures.responseCadence01, 0);
    const previous = safeNumber(slice[index].scalarFeatures.responseCadence01, 0);
    delta += Math.abs(current - previous);

    const currentConfidence = safeNumber(slice[index - 1].scalarFeatures.confidence01, 0);
    const previousConfidence = safeNumber(slice[index].scalarFeatures.confidence01, 0);
    delta += Math.abs(currentConfidence - previousConfidence) * 0.75;

    const currentFrustration = safeNumber(slice[index - 1].scalarFeatures.frustration01, 0);
    const previousFrustration = safeNumber(slice[index].scalarFeatures.frustration01, 0);
    delta += Math.abs(currentFrustration - previousFrustration) * 0.85;
  }

  return asScore(clamp01(delta / Math.max((slice.length - 1) * 2.6, 1)));
}

function bandForEngagement(engagement01: Score01): EngagementBand {
  if (engagement01 < 0.18) return 'FROZEN';
  if (engagement01 < 0.35) return 'LOW';
  if (engagement01 < 0.52) return 'CAUTIOUS';
  if (engagement01 < 0.72) return 'ACTIVE';
  if (engagement01 < 0.87) return 'LOCKED_IN';
  return 'ELECTRIC';
}

function normalizeAggregateInput(
  aggregate: ChatOnlineFeatureAggregate,
  learningProfile?: Nullable<ChatLearningProfile>,
  sourceSignal?: Nullable<ChatSignalEnvelope>,
): EngagementModelInput {
  const canonical = aggregate.canonicalSnapshot;
  const generatedAt = aggregate.generatedAt;
  const latestRow = aggregate.latestRow;
  const roomKind = pickCategory(aggregate, 'roomKind', 'UNKNOWN') as ChatRoomKind | 'UNKNOWN';
  const activeVisibleChannel = pickCategory(aggregate, 'activeVisibleChannel', 'GLOBAL') as ChatVisibleChannel;
  const pressureTier = pickCategory(aggregate, 'pressureTier', canonical?.pressureTier ?? 'BUILDING') as PressureTier;

  return Object.freeze({
    generatedAt,
    roomId: aggregate.roomId,
    sessionId: aggregate.sessionId,
    userId: aggregate.userId,
    roomKind,
    activeVisibleChannel,
    pressureTier,
    roomHeat01: canonical?.roomHeat01 ?? pickScalar(aggregate, 'roomHeat01', 0.16),
    hostileMomentum01: canonical?.hostileMomentum01 ?? pickScalar(aggregate, 'hostileMomentum01', 0.18),
    churnRisk01: canonical?.churnRisk01 ?? pickScalar(aggregate, 'churnRisk01', 0.22),
    responseCadence01: pickScalar(aggregate, 'responseCadence01', 0.42),
    recentPlayerShare01: pickScalar(aggregate, 'recentPlayerShare01', 0.32),
    recentNpcShare01: pickScalar(aggregate, 'recentNpcShare01', 0.46),
    helperReceptivity01: pickScalar(aggregate, 'helperReceptivity01', learningProfile?.helperReceptivity01 ?? 0.44),
    helperIgnore01: pickScalar(aggregate, 'helperIgnore01', 0),
    rescueOpportunity01: pickScalar(aggregate, 'rescueOpportunity01', 0.34),
    visibilityExposure01: pickScalar(aggregate, 'visibilityExposure01', 0.62),
    switchStress01: pickScalar(aggregate, 'switchStress01', 0),
    averageMessageLength01: pickScalar(aggregate, 'averageMessageLength01', 0.28),
    helperDensity01: pickScalar(aggregate, 'helperDensity01', 0.12),
    haterDensity01: pickScalar(aggregate, 'haterDensity01', 0.16),
    roomCrowding01: pickScalar(aggregate, 'roomCrowding01', 0.34),
    confidence01: pickScalar(aggregate, 'confidence01', canonical?.affect.confidence01 ?? learningProfile?.affect.confidence01 ?? 0.40),
    frustration01: pickScalar(aggregate, 'frustration01', canonical?.affect.frustration01 ?? learningProfile?.affect.frustration01 ?? 0.24),
    intimidation01: pickScalar(aggregate, 'intimidation01', canonical?.affect.intimidation01 ?? learningProfile?.affect.intimidation01 ?? 0.18),
    attachment01: pickScalar(aggregate, 'attachment01', canonical?.affect.attachment01 ?? learningProfile?.affect.attachment01 ?? 0.22),
    curiosity01: pickScalar(aggregate, 'curiosity01', canonical?.affect.curiosity01 ?? learningProfile?.affect.curiosity01 ?? 0.28),
    embarrassment01: pickScalar(aggregate, 'embarrassment01', canonical?.affect.embarrassment01 ?? learningProfile?.affect.embarrassment01 ?? 0.14),
    relief01: pickScalar(aggregate, 'relief01', canonical?.affect.relief01 ?? learningProfile?.affect.relief01 ?? 0.12),
    affinityGlobal01: pickScalar(aggregate, 'affinityGlobal01', learningProfile?.channelAffinity.GLOBAL ?? 0.25),
    affinitySyndicate01: pickScalar(aggregate, 'affinitySyndicate01', learningProfile?.channelAffinity.SYNDICATE ?? 0.25),
    affinityDealRoom01: pickScalar(aggregate, 'affinityDealRoom01', learningProfile?.channelAffinity.DEAL_ROOM ?? 0.25),
    affinityLobby01: pickScalar(aggregate, 'affinityLobby01', learningProfile?.channelAffinity.LOBBY ?? 0.25),
    battleRescueWindowOpen01: pickScalar(aggregate, 'battleRescueWindowOpen01', sourceSignal?.battle?.rescueWindowOpen ? 1 : 0),
    battleShieldIntegrity01: pickScalar(aggregate, 'battleShieldIntegrity01', sourceSignal?.battle?.shieldIntegrity01 ?? 0),
    runNearSovereignty01: pickScalar(aggregate, 'runNearSovereignty01', sourceSignal?.run?.nearSovereignty ? 1 : 0),
    runBankruptcyWarning01: pickScalar(aggregate, 'runBankruptcyWarning01', sourceSignal?.run?.bankruptcyWarning ? 1 : 0),
    multiplayerRankingPressure01: pickScalar(aggregate, 'multiplayerRankingPressure01', sourceSignal?.multiplayer?.rankingPressure ?? 0),
    economyLiquidityStress01: pickScalar(aggregate, 'economyLiquidityStress01', sourceSignal?.economy?.liquidityStress01 ?? 0),
    economyOverpayRisk01: pickScalar(aggregate, 'economyOverpayRisk01', sourceSignal?.economy?.overpayRisk01 ?? 0),
    economyBluffRisk01: pickScalar(aggregate, 'economyBluffRisk01', sourceSignal?.economy?.bluffRisk01 ?? 0),
    liveopsHeatMultiplier01: pickScalar(aggregate, 'liveopsHeatMultiplier01', sourceSignal?.liveops?.heatMultiplier01 ?? 0),
    liveopsHelperBlackout01: pickScalar(aggregate, 'liveopsHelperBlackout01', sourceSignal?.liveops?.helperBlackout ? 1 : 0),
    liveopsHaterRaid01: pickScalar(aggregate, 'liveopsHaterRaid01', sourceSignal?.liveops?.haterRaidActive ? 1 : 0),
    silenceBand: pickCategory(aggregate, 'silenceBand', 'UNKNOWN') as EngagementModelInput['silenceBand'],
    roomSwarmDirection: pickCategory(aggregate, 'roomSwarmDirection', 'UNKNOWN') as EngagementModelInput['roomSwarmDirection'],
    sourceEventKind: pickCategory(aggregate, 'sourceEventKind', latestRow?.diagnostics.sourceEventKind ?? 'UNKNOWN'),
    sourceChannel: pickCategory(aggregate, 'sourceChannel', latestRow?.diagnostics.sourceChannel ?? 'UNKNOWN'),
    contributorBand: pickCategory(aggregate, 'contributorBand', 'UNKNOWN') as EngagementModelInput['contributorBand'],
    freshnessMs: aggregate.freshnessMs,
    evidenceRowIds: latestRow ? aggregate.rows.map((row) => row.rowId) : [],
    evidenceRows: aggregate.rows,
    canonicalSnapshot: canonical,
    learningProfile,
    sourceSignal,
  });
}

function normalizeWindowInput(
  window: ChatOnlineInferenceWindow,
  query: Partial<Pick<ChatOnlineFeatureAggregate, 'roomId' | 'sessionId' | 'userId'>> = {},
  learningProfile?: Nullable<ChatLearningProfile>,
  sourceSignal?: Nullable<ChatSignalEnvelope>,
): EngagementModelInput {
  const roomKind = pickCategory(window, 'roomKind', 'UNKNOWN') as ChatRoomKind | 'UNKNOWN';
  const activeVisibleChannel = pickCategory(window, 'activeVisibleChannel', 'GLOBAL') as ChatVisibleChannel;
  const pressureTier = pickCategory(window, 'pressureTier', window.canonicalSnapshot?.pressureTier ?? 'BUILDING') as PressureTier;

  return Object.freeze({
    generatedAt: window.generatedAt,
    roomId: query.roomId ?? null,
    sessionId: query.sessionId ?? null,
    userId: query.userId ?? null,
    roomKind,
    activeVisibleChannel,
    pressureTier,
    roomHeat01: window.canonicalSnapshot?.roomHeat01 ?? pickScalar(window, 'roomHeat01', 0.16),
    hostileMomentum01: window.canonicalSnapshot?.hostileMomentum01 ?? pickScalar(window, 'hostileMomentum01', 0.18),
    churnRisk01: window.canonicalSnapshot?.churnRisk01 ?? pickScalar(window, 'churnRisk01', 0.22),
    responseCadence01: pickScalar(window, 'responseCadence01', 0.42),
    recentPlayerShare01: pickScalar(window, 'recentPlayerShare01', 0.32),
    recentNpcShare01: pickScalar(window, 'recentNpcShare01', 0.46),
    helperReceptivity01: pickScalar(window, 'helperReceptivity01', learningProfile?.helperReceptivity01 ?? 0.44),
    helperIgnore01: pickScalar(window, 'helperIgnore01', 0),
    rescueOpportunity01: pickScalar(window, 'rescueOpportunity01', 0.34),
    visibilityExposure01: pickScalar(window, 'visibilityExposure01', 0.62),
    switchStress01: pickScalar(window, 'switchStress01', 0),
    averageMessageLength01: pickScalar(window, 'averageMessageLength01', 0.28),
    helperDensity01: pickScalar(window, 'helperDensity01', 0.12),
    haterDensity01: pickScalar(window, 'haterDensity01', 0.16),
    roomCrowding01: pickScalar(window, 'roomCrowding01', 0.34),
    confidence01: pickScalar(window, 'confidence01', window.canonicalSnapshot?.affect.confidence01 ?? learningProfile?.affect.confidence01 ?? 0.40),
    frustration01: pickScalar(window, 'frustration01', window.canonicalSnapshot?.affect.frustration01 ?? learningProfile?.affect.frustration01 ?? 0.24),
    intimidation01: pickScalar(window, 'intimidation01', window.canonicalSnapshot?.affect.intimidation01 ?? learningProfile?.affect.intimidation01 ?? 0.18),
    attachment01: pickScalar(window, 'attachment01', window.canonicalSnapshot?.affect.attachment01 ?? learningProfile?.affect.attachment01 ?? 0.22),
    curiosity01: pickScalar(window, 'curiosity01', window.canonicalSnapshot?.affect.curiosity01 ?? learningProfile?.affect.curiosity01 ?? 0.28),
    embarrassment01: pickScalar(window, 'embarrassment01', window.canonicalSnapshot?.affect.embarrassment01 ?? learningProfile?.affect.embarrassment01 ?? 0.14),
    relief01: pickScalar(window, 'relief01', window.canonicalSnapshot?.affect.relief01 ?? learningProfile?.affect.relief01 ?? 0.12),
    affinityGlobal01: pickScalar(window, 'affinityGlobal01', learningProfile?.channelAffinity.GLOBAL ?? 0.25),
    affinitySyndicate01: pickScalar(window, 'affinitySyndicate01', learningProfile?.channelAffinity.SYNDICATE ?? 0.25),
    affinityDealRoom01: pickScalar(window, 'affinityDealRoom01', learningProfile?.channelAffinity.DEAL_ROOM ?? 0.25),
    affinityLobby01: pickScalar(window, 'affinityLobby01', learningProfile?.channelAffinity.LOBBY ?? 0.25),
    battleRescueWindowOpen01: pickScalar(window, 'battleRescueWindowOpen01', sourceSignal?.battle?.rescueWindowOpen ? 1 : 0),
    battleShieldIntegrity01: pickScalar(window, 'battleShieldIntegrity01', sourceSignal?.battle?.shieldIntegrity01 ?? 0),
    runNearSovereignty01: pickScalar(window, 'runNearSovereignty01', sourceSignal?.run?.nearSovereignty ? 1 : 0),
    runBankruptcyWarning01: pickScalar(window, 'runBankruptcyWarning01', sourceSignal?.run?.bankruptcyWarning ? 1 : 0),
    multiplayerRankingPressure01: pickScalar(window, 'multiplayerRankingPressure01', sourceSignal?.multiplayer?.rankingPressure ?? 0),
    economyLiquidityStress01: pickScalar(window, 'economyLiquidityStress01', sourceSignal?.economy?.liquidityStress01 ?? 0),
    economyOverpayRisk01: pickScalar(window, 'economyOverpayRisk01', sourceSignal?.economy?.overpayRisk01 ?? 0),
    economyBluffRisk01: pickScalar(window, 'economyBluffRisk01', sourceSignal?.economy?.bluffRisk01 ?? 0),
    liveopsHeatMultiplier01: pickScalar(window, 'liveopsHeatMultiplier01', sourceSignal?.liveops?.heatMultiplier01 ?? 0),
    liveopsHelperBlackout01: pickScalar(window, 'liveopsHelperBlackout01', sourceSignal?.liveops?.helperBlackout ? 1 : 0),
    liveopsHaterRaid01: pickScalar(window, 'liveopsHaterRaid01', sourceSignal?.liveops?.haterRaidActive ? 1 : 0),
    silenceBand: pickCategory(window, 'silenceBand', 'UNKNOWN') as EngagementModelInput['silenceBand'],
    roomSwarmDirection: pickCategory(window, 'roomSwarmDirection', 'UNKNOWN') as EngagementModelInput['roomSwarmDirection'],
    sourceEventKind: pickCategory(window, 'sourceEventKind', 'UNKNOWN'),
    sourceChannel: pickCategory(window, 'sourceChannel', 'UNKNOWN'),
    contributorBand: pickCategory(window, 'contributorBand', 'UNKNOWN') as EngagementModelInput['contributorBand'],
    freshnessMs: Math.max(0, (Date.now() - (window.generatedAt as number))),
    evidenceRowIds: window.evidenceRowIds,
    evidenceRows: [],
    canonicalSnapshot: window.canonicalSnapshot,
    learningProfile,
    sourceSignal,
  });
}

// ============================================================================
// MARK: Scoring helpers
// ============================================================================

function computePressureComposure01(input: EngagementModelInput): Score01 {
  const pressure = pressureIntensity01(input.pressureTier);
  return asScore(
    input.confidence01 * 0.38 +
      input.responseCadence01 * 0.18 +
      input.recentPlayerShare01 * 0.14 +
      input.relief01 * 0.06 +
      input.runNearSovereignty01 * 0.10 +
      (1 - input.frustration01) * 0.14 -
      pressure * Math.max(0, (input.intimidation01 as number) - (input.confidence01 as number)) * 0.18,
  );
}

function computePositiveActivation01(
  input: EngagementModelInput,
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
  affinity01: Score01,
  theatricalReadiness01: Score01,
): Score01 {
  const playerExpression =
    input.responseCadence01 * defaults.responseCadenceWeight01 +
    input.recentPlayerShare01 * defaults.playerShareWeight01 +
    affinity01 * defaults.affinityWeight01;

  const emotionalOpenness =
    input.confidence01 * defaults.confidenceEngagementWeight01 +
    input.curiosity01 * defaults.curiosityContinuityWeight01 +
    input.attachment01 * defaults.attachmentContinuityWeight01 +
    input.relief01 * 0.06;

  const situationalOpportunity =
    input.rescueOpportunity01 * 0.08 +
    input.visibilityExposure01 * 0.05 +
    theatricalReadiness01 * 0.08 +
    contributorBandDensity01(input.contributorBand) * 0.05 +
    freshnessStrength01(input, defaults) * 0.08;

  const rescueBonus = input.battleRescueWindowOpen01 > 0 ? defaults.rescueWindowResponsivenessBonus01 : 0;

  return asScore(playerExpression + emotionalOpenness + situationalOpportunity + rescueBonus);
}

function computeNegativeLoad01(
  input: EngagementModelInput,
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
  silencePenalty: Score01,
): Score01 {
  const crowdPenalty = isNegativeSwarm(input) ? defaults.negativeSwarmPenalty01 : 0;
  const frustrationLoad = input.frustration01 * 0.14;
  const embarrassmentLoad = input.embarrassment01 * 0.10;
  const intimidationLoad = input.intimidation01 * 0.08;
  const churnLoad = input.churnRisk01 * 0.18;
  const helperIgnoreLoad = input.helperIgnore01 * 0.08;
  const overloadLoad = input.switchStress01 * 0.05 + input.liveopsHelperBlackout01 * 0.03 + input.liveopsHaterRaid01 * 0.04;

  return asScore(
    silencePenalty + crowdPenalty + frustrationLoad + embarrassmentLoad + intimidationLoad + churnLoad + helperIgnoreLoad + overloadLoad,
  );
}

function computeContinuity01(
  input: EngagementModelInput,
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
  affinity01: Score01,
  prior: Nullable<EngagementModelPriorState>,
): Score01 {
  const base = asScore(
    input.attachment01 * 0.18 +
      input.curiosity01 * 0.24 +
      input.responseCadence01 * 0.16 +
      affinity01 * 0.16 +
      (1 - input.churnRisk01) * 0.14 +
      (1 - input.helperIgnore01) * 0.12,
  );

  if (!prior) return base;

  return asScore(
    (base as number) * (1 - defaults.trendBlend01) +
      (prior.continuity01 as number) * defaults.trendBlend01,
  );
}

function computeResponseLikelihood01(
  input: EngagementModelInput,
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
  pressureComposure01: Score01,
  silencePenalty: Score01,
  negotiationQuiet01Value: Score01,
): Score01 {
  const dealRoomDiscount = isDealRoom(input) ? (negotiationQuiet01Value as number) * 0.12 : 0;

  return asScore(
    input.responseCadence01 * 0.26 +
      input.recentPlayerShare01 * 0.18 +
      pressureComposure01 * 0.18 +
      input.curiosity01 * 0.10 +
      input.confidence01 * 0.08 +
      input.battleRescueWindowOpen01 * 0.08 +
      input.runBankruptcyWarning01 * 0.05 -
      (silencePenalty as number) * 0.24 -
      (input.embarrassment01 as number) * 0.08 -
      dealRoomDiscount,
  );
}

function computeFragility01(
  input: EngagementModelInput,
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
  silencePenalty: Score01,
  volatility01: Score01,
): Score01 {
  const embarrassmentLoad = (input.embarrassment01 as number) * defaults.embarrassmentFragilityWeight01;
  const intimidationLoad = (input.intimidation01 as number) * defaults.intimidationFragilityWeight01;
  const frustrationLoad = (input.frustration01 as number) * defaults.frustrationFragilityWeight01;
  const helperIgnoreLoad = (input.helperIgnore01 as number) * defaults.helperIgnoreFragilityPenalty01;

  return asScore(
    (silencePenalty as number) * 0.18 +
      (input.churnRisk01 as number) * 0.22 +
      embarrassmentLoad +
      intimidationLoad +
      frustrationLoad +
      helperIgnoreLoad +
      (input.hostileMomentum01 as number) * 0.10 +
      (volatility01 as number) * 0.12 +
      (isNegativeSwarm(input) ? 0.08 : 0) +
      (input.liveopsHaterRaid01 as number) * 0.05,
  );
}

function computeSoftDropoffRisk01(
  input: EngagementModelInput,
  fragility01: Score01,
  responseLikelihood01: Score01,
): Score01 {
  return asScore(
    (fragility01 as number) * 0.42 +
      (input.churnRisk01 as number) * 0.28 +
      (1 - (responseLikelihood01 as number)) * 0.18 +
      (input.helperIgnore01 as number) * 0.06 +
      (input.silenceBand === 'HARD' ? 0.06 : input.silenceBand === 'STALE' ? 0.03 : 0),
  );
}

function computeCrowdReadiness01(
  input: EngagementModelInput,
  theatricalReadiness01: Score01,
  fragility01: Score01,
): Score01 {
  if (!isGlobal(input) && !isLobby(input)) {
    return asScore(
      input.visibilityExposure01 * 0.34 +
        input.confidence01 * 0.18 +
        input.recentPlayerShare01 * 0.12 +
        (1 - fragility01) * 0.18 +
        input.roomHeat01 * 0.18,
    );
  }

  return asScore(
    (theatricalReadiness01 as number) * 0.30 +
      (input.visibilityExposure01 as number) * 0.20 +
      (input.confidence01 as number) * 0.12 +
      (input.recentPlayerShare01 as number) * 0.12 +
      (1 - (fragility01 as number)) * 0.14 +
      (isPositiveSwarm(input) ? 0.08 : 0) -
      (isNegativeSwarm(input) ? 0.06 : 0),
  );
}

function computeQuality01(
  input: EngagementModelInput,
  engagement01: Score01,
  continuity01: Score01,
  responseLikelihood01: Score01,
  fragility01: Score01,
): Score01 {
  return asScore(
    (engagement01 as number) * 0.30 +
      (continuity01 as number) * 0.22 +
      (responseLikelihood01 as number) * 0.18 +
      (1 - (fragility01 as number)) * 0.18 +
      (input.averageMessageLength01 as number) * 0.06 +
      (input.curiosity01 as number) * 0.06,
  );
}

function recommendEngagementAction(
  input: EngagementModelInput,
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
  engagement01: Score01,
  fragility01: Score01,
  softDropoffRisk01: Score01,
  crowdReadiness01: Score01,
  quality01: Score01,
): EngagementRecommendation {
  if (isDealRoom(input) && input.silenceBand !== 'FRESH' && input.economyBluffRisk01 >= 0.46 && engagement01 >= 0.42) {
    return 'HOLD_DEALROOM_PRESSURE';
  }

  if (softDropoffRisk01 >= defaults.hardHelperThreshold01 && input.helperReceptivity01 >= 0.36) {
    return 'HARD_HELPER';
  }

  if (softDropoffRisk01 >= defaults.softDropoffThreshold01 && input.helperReceptivity01 >= 0.32) {
    return 'LIGHT_HELPER';
  }

  if (engagement01 >= defaults.cinematicHoldThreshold01 && input.runNearSovereignty01 >= 0.52) {
    return 'DEFER_TO_CINEMATIC_SILENCE';
  }

  if (crowdReadiness01 >= defaults.crowdAmplifyThreshold01 && quality01 >= 0.58 && !isNegativeSwarm(input)) {
    return 'AMPLIFY_ROOM';
  }

  if (fragility01 >= 0.56 && input.haterDensity01 >= 0.42) {
    return 'REDUCE_HATER';
  }

  if (engagement01 >= 0.48) return 'KEEP_AMBIENT';
  return 'NONE';
}

function buildExplanationFactors(
  input: EngagementModelInput,
  defaults: typeof CHAT_ENGAGEMENT_MODEL_DEFAULTS,
  scores: {
    affinity01: Score01;
    theatricalReadiness01: Score01;
    negotiationQuiet01Value: Score01;
    pressureComposure01: Score01;
    silencePenalty: Score01;
    positiveActivation01: Score01;
    negativeLoad01: Score01;
    continuity01: Score01;
    responseLikelihood01: Score01;
    fragility01: Score01;
    volatility01: Score01;
    crowdReadiness01: Score01;
  },
): readonly EngagementScoreContribution[] {
  const factors: EngagementScoreContribution[] = [];

  factors.push(signedContribution(
    'response_cadence',
    (input.responseCadence01 as number) * 0.18,
    'Recent response cadence is contributing to present engagement posture.',
  ));

  factors.push(signedContribution(
    'player_share',
    (input.recentPlayerShare01 as number) * 0.14,
    'Player message share inside the active window is sustaining expressive participation.',
  ));

  factors.push(signedContribution(
    'channel_affinity',
    (scores.affinity01 as number) * defaults.affinityWeight01,
    'Channel affinity indicates how naturally this player tends to stay active in the current lane.',
  ));

  factors.push(signedContribution(
    'pressure_composure',
    (scores.pressureComposure01 as number) * 0.14,
    'Composure under current pressure is supporting continuity instead of panic collapse.',
  ));

  factors.push(signedContribution(
    'continuity',
    (scores.continuity01 as number) * 0.12,
    'Attachment, curiosity, and behavioral carryover are sustaining ongoing chat presence.',
  ));

  factors.push(signedContribution(
    'crowd_readiness',
    (scores.crowdReadiness01 as number) * 0.10,
    'The current channel / room posture is either helping or limiting visible participation.',
  ));

  factors.push(signedContribution(
    'silence_penalty',
    -(scores.silencePenalty as number),
    'Room-adjusted silence interpretation is reducing active-engagement confidence.',
  ));

  factors.push(signedContribution(
    'fragility',
    -(scores.fragility01 as number) * 0.18,
    'Fragility indicates that present engagement may break if pressure rises or hater load continues.',
  ));

  factors.push(signedContribution(
    'soft_dropoff_risk_proxy',
    -((input.churnRisk01 as number) * 0.14 + (input.helperIgnore01 as number) * 0.06),
    'Churn history and ignored-helper posture are dragging long-form participation durability.',
  ));

  if (scores.negotiationQuiet01Value > 0 && isDealRoom(input)) {
    factors.push(signedContribution(
      'dealroom_tactical_quiet',
      (scores.negotiationQuiet01Value as number) * 0.10,
      'Deal-room quiet may be tactical bluff / read behavior rather than disengagement.',
    ));
  }

  if (isGlobal(input) || isLobby(input)) {
    factors.push(signedContribution(
      'theatrical_readiness',
      (scores.theatricalReadiness01 as number) * 0.08,
      'The active room is reading as a stage; theatrical readiness affects how visible participation should be interpreted.',
    ));
  }

  if (scores.volatility01 > 0.32) {
    factors.push(signedContribution(
      'volatility',
      -(scores.volatility01 as number) * 0.10,
      'Short-window volatility suggests brittle engagement rather than stable momentum.',
    ));
  }

  const sorted = factors
    .sort((left, right) => Math.abs(right.signedDelta01) - Math.abs(left.signedDelta01))
    .slice(0, defaults.maxExplanationFactors);

  return Object.freeze(sorted);
}

// ============================================================================
// MARK: Model implementation
// ============================================================================

export class EngagementModel {
  private readonly context: EngagementModelContext;

  public constructor(options: EngagementModelOptions = {}) {
    this.context = Object.freeze({
      logger: options.logger ?? DEFAULT_LOGGER,
      clock: options.clock ?? DEFAULT_CLOCK,
      defaults: Object.freeze({
        ...CHAT_ENGAGEMENT_MODEL_DEFAULTS,
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
      readonly prior?: Nullable<EngagementModelPriorState>;
    } = {},
  ): EngagementModelScore {
    const input = normalizeAggregateInput(
      aggregate,
      options.learningProfile ?? null,
      options.sourceSignal ?? null,
    );
    return this.scoreInput(input, options.prior ?? null);
  }

  public scoreInferenceWindow(
    window: ChatOnlineInferenceWindow,
    options: {
      readonly roomId?: Nullable<ChatRoomId>;
      readonly sessionId?: Nullable<ChatSessionId>;
      readonly userId?: Nullable<ChatUserId>;
      readonly learningProfile?: Nullable<ChatLearningProfile>;
      readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
      readonly prior?: Nullable<EngagementModelPriorState>;
    } = {},
  ): EngagementModelScore {
    const input = normalizeWindowInput(
      window,
      {
        roomId: options.roomId ?? null,
        sessionId: options.sessionId ?? null,
        userId: options.userId ?? null,
      },
      options.learningProfile ?? null,
      options.sourceSignal ?? null,
    );
    return this.scoreInput(input, options.prior ?? null);
  }

  public scoreRows(
    rowsOrBatch: readonly ChatFeatureRow[] | ChatFeatureIngestResult,
    options: {
      readonly learningProfile?: Nullable<ChatLearningProfile>;
      readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
      readonly prior?: Nullable<EngagementModelPriorState>;
    } = {},
  ): EngagementModelScore {
    const aggregate = aggregateOnlineFeatureWindow(rowsOrBatch, 'ENGAGEMENT');
    return this.scoreAggregate(aggregate, options);
  }

  public scoreStore(
    store: OnlineFeatureStore,
    query: ChatOnlineFeatureStoreQuery,
    options: {
      readonly learningProfile?: Nullable<ChatLearningProfile>;
      readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
      readonly prior?: Nullable<EngagementModelPriorState>;
    } = {},
  ): EngagementModelScore {
    const aggregate = store.aggregate({ ...query, family: 'ENGAGEMENT' });
    return this.scoreAggregate(aggregate, options);
  }

  public scoreBatch(
    aggregates: readonly ChatOnlineFeatureAggregate[],
    options: {
      readonly learningProfilesByUserId?: Readonly<Record<string, ChatLearningProfile>>;
      readonly priorByUserId?: Readonly<Record<string, EngagementModelPriorState>>;
      readonly sourceSignalByRoomId?: Readonly<Record<string, ChatSignalEnvelope>>;
    } = {},
  ): EngagementScoreBatchResult {
    const generatedAt = this.context.clock.now();
    const scores = aggregates.map((aggregate) => {
      const userId = aggregate.userId ?? undefined;
      const roomId = aggregate.roomId ?? undefined;
      return this.scoreAggregate(aggregate, {
        learningProfile: userId ? options.learningProfilesByUserId?.[userId] ?? null : null,
        prior: userId ? options.priorByUserId?.[userId] ?? null : null,
        sourceSignal: roomId ? options.sourceSignalByRoomId?.[roomId] ?? null : null,
      });
    });

    const strongest = scores.length
      ? scores.reduce((best, current) => (current.engagement01 > best.engagement01 ? current : best))
      : null;

    const weakest = scores.length
      ? scores.reduce((worst, current) => (current.engagement01 < worst.engagement01 ? current : worst))
      : null;

    return Object.freeze({
      generatedAt,
      scores: Object.freeze(scores),
      strongest,
      weakest,
    });
  }

  public toPriorState(score: EngagementModelScore): EngagementModelPriorState {
    return Object.freeze({
      engagement01: score.engagement01,
      continuity01: score.continuity01,
      responseLikelihood01: score.responseLikelihood01,
      fragility01: score.fragility01,
      softDropoffRisk01: score.softDropoffRisk01,
      generatedAt: score.generatedAt,
    });
  }

  public scoreInput(
    input: EngagementModelInput,
    prior: Nullable<EngagementModelPriorState> = null,
  ): EngagementModelScore {
    const { defaults, logger } = this.context;

    const affinity01 = activeAffinity01(input);
    const silencePenalty = silencePenalty01(input, defaults);
    const theatricalReadiness01 = theatricalHeatReadiness01(input, defaults);
    const negotiationQuiet01Value = negotiationQuiet01(input);
    const pressureComposure01 = computePressureComposure01(input);
    const volatility01 = computeVolatility01(input.evidenceRows, defaults);

    const positiveActivation01 = computePositiveActivation01(
      input,
      defaults,
      affinity01,
      theatricalReadiness01,
    );

    const negativeLoad01 = computeNegativeLoad01(
      input,
      defaults,
      silencePenalty,
    );

    const baseline = lowEvidence(input, defaults)
      ? defaults.lowEvidenceFallback01
      : 0.46 + channelBias01(input.activeVisibleChannel, defaults) + roomBias01(input.roomKind, defaults);

    const engagementUnblended01 = asScore(
      baseline +
        (positiveActivation01 as number) -
        (negativeLoad01 as number) +
        (pressureComposure01 as number) * 0.08 +
        (negotiationQuiet01Value as number) * (isDealRoom(input) ? 0.06 : 0) +
        (theatricalReadiness01 as number) * (isGlobal(input) || isLobby(input) ? 0.05 : 0),
    );

    const baselineFromLearning = input.learningProfile?.engagementBaseline01 ?? null;
    const engagementWithLearning01 = baselineFromLearning !== null
      ? asScore(
          (engagementUnblended01 as number) * (1 - defaults.baselineBlend01) +
            (baselineFromLearning as number) * defaults.baselineBlend01,
        )
      : engagementUnblended01;

    const engagement01 = prior
      ? asScore(
          (engagementWithLearning01 as number) * (1 - defaults.trendBlend01) +
            (prior.engagement01 as number) * defaults.trendBlend01,
        )
      : engagementWithLearning01;

    const continuity01 = computeContinuity01(input, defaults, affinity01, prior);
    const responseLikelihood01 = computeResponseLikelihood01(
      input,
      defaults,
      pressureComposure01,
      silencePenalty,
      negotiationQuiet01Value,
    );

    const fragility01 = computeFragility01(input, defaults, silencePenalty, volatility01);
    const softDropoffRisk01 = computeSoftDropoffRisk01(input, fragility01, responseLikelihood01);
    const crowdReadiness01 = computeCrowdReadiness01(input, theatricalReadiness01, fragility01);
    const quality01 = computeQuality01(input, engagement01, continuity01, responseLikelihood01, fragility01);
    const recommendation = recommendEngagementAction(
      input,
      defaults,
      engagement01,
      fragility01,
      softDropoffRisk01,
      crowdReadiness01,
      quality01,
    );

    const shouldHoldCinematicSilence = recommendation === 'DEFER_TO_CINEMATIC_SILENCE';
    const shouldInviteAmbientWitnesses = recommendation === 'AMPLIFY_ROOM';
    const shouldSoftHelper = recommendation === 'LIGHT_HELPER';
    const shouldHardHelper = recommendation === 'HARD_HELPER';

    const explanationFactors = buildExplanationFactors(input, defaults, {
      affinity01,
      theatricalReadiness01,
      negotiationQuiet01Value,
      pressureComposure01,
      silencePenalty,
      positiveActivation01,
      negativeLoad01,
      continuity01,
      responseLikelihood01,
      fragility01,
      volatility01,
      crowdReadiness01,
    });

    const diagnostics: EngagementModelDiagnostics = Object.freeze({
      rowCount: input.evidenceRows.length || input.evidenceRowIds.length,
      freshnessMs: input.freshnessMs,
      lowEvidence: lowEvidence(input, defaults),
      activeAffinity01: affinity01,
      pressureComposure01,
      silenceInterpretationPenalty01: silencePenalty,
      theatricalReadiness01,
      negotiationQuiet01: negotiationQuiet01Value,
      volatility01,
      explanationFactors,
    });

    const score: EngagementModelScore = Object.freeze({
      generatedAt: input.generatedAt,
      roomId: input.roomId,
      userId: input.userId,
      activeVisibleChannel: input.activeVisibleChannel,
      band: bandForEngagement(engagement01),
      engagement01,
      engagement100: asScore100((engagement01 as number) * 100),
      continuity01,
      responseLikelihood01,
      fragility01,
      softDropoffRisk01,
      crowdReadiness01,
      quality01,
      recommendation,
      shouldHoldCinematicSilence,
      shouldInviteAmbientWitnesses,
      shouldSoftHelper,
      shouldHardHelper,
      diagnostics,
    });

    logger.debug('Engagement score generated.', {
      module: CHAT_ENGAGEMENT_MODEL_MODULE_NAME,
      version: CHAT_ENGAGEMENT_MODEL_VERSION,
      roomId: input.roomId,
      userId: input.userId,
      activeVisibleChannel: input.activeVisibleChannel,
      engagement01: score.engagement01,
      fragility01: score.fragility01,
      recommendation: score.recommendation,
    });

    return score;
  }
}

// ============================================================================
// MARK: Public helpers
// ============================================================================

export function createEngagementModel(
  options: EngagementModelOptions = {},
): EngagementModel {
  return new EngagementModel(options);
}

export function scoreEngagementAggregate(
  aggregate: ChatOnlineFeatureAggregate,
  options: EngagementModelOptions & {
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly prior?: Nullable<EngagementModelPriorState>;
  } = {},
): EngagementModelScore {
  const model = new EngagementModel(options);
  return model.scoreAggregate(aggregate, options);
}

export function scoreEngagementStore(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery,
  options: EngagementModelOptions & {
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly prior?: Nullable<EngagementModelPriorState>;
  } = {},
): EngagementModelScore {
  const model = new EngagementModel(options);
  return model.scoreStore(store, query, options);
}

export function scoreEngagementRows(
  rowsOrBatch: readonly ChatFeatureRow[] | ChatFeatureIngestResult,
  options: EngagementModelOptions & {
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly prior?: Nullable<EngagementModelPriorState>;
  } = {},
): EngagementModelScore {
  const model = new EngagementModel(options);
  return model.scoreRows(rowsOrBatch, options);
}

export function scoreEngagementInferenceWindow(
  window: ChatOnlineInferenceWindow,
  options: EngagementModelOptions & {
    readonly roomId?: Nullable<ChatRoomId>;
    readonly sessionId?: Nullable<ChatSessionId>;
    readonly userId?: Nullable<ChatUserId>;
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly prior?: Nullable<EngagementModelPriorState>;
  } = {},
): EngagementModelScore {
  const model = new EngagementModel(options);
  return model.scoreInferenceWindow(window, options);
}

export function serializeEngagementScore(score: EngagementModelScore): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    generatedAt: score.generatedAt as number,
    roomId: score.roomId,
    userId: score.userId,
    activeVisibleChannel: score.activeVisibleChannel,
    band: score.band,
    engagement01: score.engagement01 as number,
    engagement100: score.engagement100 as number,
    continuity01: score.continuity01 as number,
    responseLikelihood01: score.responseLikelihood01 as number,
    fragility01: score.fragility01 as number,
    softDropoffRisk01: score.softDropoffRisk01 as number,
    crowdReadiness01: score.crowdReadiness01 as number,
    quality01: score.quality01 as number,
    recommendation: score.recommendation,
    shouldHoldCinematicSilence: score.shouldHoldCinematicSilence,
    shouldInviteAmbientWitnesses: score.shouldInviteAmbientWitnesses,
    shouldSoftHelper: score.shouldSoftHelper,
    shouldHardHelper: score.shouldHardHelper,
    diagnostics: {
      rowCount: score.diagnostics.rowCount,
      freshnessMs: score.diagnostics.freshnessMs,
      lowEvidence: score.diagnostics.lowEvidence,
      activeAffinity01: score.diagnostics.activeAffinity01 as number,
      pressureComposure01: score.diagnostics.pressureComposure01 as number,
      silenceInterpretationPenalty01: score.diagnostics.silenceInterpretationPenalty01 as number,
      theatricalReadiness01: score.diagnostics.theatricalReadiness01 as number,
      negotiationQuiet01: score.diagnostics.negotiationQuiet01 as number,
      volatility01: score.diagnostics.volatility01 as number,
      explanationFactors: score.diagnostics.explanationFactors.map((factor) => ({
        key: factor.key,
        signedDelta01: factor.signedDelta01,
        reason: factor.reason,
      })),
    },
  });
}

export function hydratePriorEngagementState(
  payload: Partial<Record<keyof EngagementModelPriorState, unknown>>,
): Nullable<EngagementModelPriorState> {
  if (!payload) return null;

  const generatedAt = safeNumber(payload.generatedAt, 0);
  if (!generatedAt) return null;

  return Object.freeze({
    engagement01: asScore(safeNumber(payload.engagement01, 0.44)),
    continuity01: asScore(safeNumber(payload.continuity01, 0.42)),
    responseLikelihood01: asScore(safeNumber(payload.responseLikelihood01, 0.40)),
    fragility01: asScore(safeNumber(payload.fragility01, 0.24)),
    softDropoffRisk01: asScore(safeNumber(payload.softDropoffRisk01, 0.20)),
    generatedAt: asUnixMs(generatedAt),
  });
}

export const CHAT_ENGAGEMENT_MODEL_NAMESPACE = Object.freeze({
  moduleName: CHAT_ENGAGEMENT_MODEL_MODULE_NAME,
  version: CHAT_ENGAGEMENT_MODEL_VERSION,
  runtimeLaws: CHAT_ENGAGEMENT_MODEL_RUNTIME_LAWS,
  defaults: CHAT_ENGAGEMENT_MODEL_DEFAULTS,
  create: createEngagementModel,
  scoreAggregate: scoreEngagementAggregate,
  scoreStore: scoreEngagementStore,
  scoreRows: scoreEngagementRows,
  scoreInferenceWindow: scoreEngagementInferenceWindow,
  serialize: serializeEngagementScore,
  hydratePriorState: hydratePriorEngagementState,
  featureStoreDefaults: CHAT_ONLINE_FEATURE_STORE_DEFAULTS,
} as const);

export default EngagementModel;
