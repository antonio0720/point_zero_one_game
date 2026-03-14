/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT HATER TARGETING MODEL
 * FILE: backend/src/game/engine/chat/ml/HaterTargetingModel.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend owner for deciding whether a hater sequence should target a
 * player right now, how hard it should target them, through which channel,
 * using which tactical frame, and with which dominant persona.
 *
 * Backend-truth question
 * ----------------------
 *
 *   "Given accepted authoritative feature rows, current room posture,
 *    pressure state, visibility posture, helper and churn risk, bluff /
 *    sovereignty / bankruptcy windows, crowd heat, and current engagement,
 *    should hostile chat enter the scene at all — and if so, what form of
 *    hostility best fits the actual game state?"
 *
 * Doctrine
 * --------
 * - This model does not emit transcript truth.
 * - This model does not override moderation, channel law, or silence policy.
 * - This model does not mutate battle simulation.
 * - This model does not replace the HaterResponseOrchestrator.
 * - This model does score and explain targeting opportunity for the
 *   orchestrator, allowing backend chat to stay predictive without becoming
 *   arbitrary.
 *
 * Why this file is deep
 * ---------------------
 * In Point Zero One, hostility is not one thing:
 * - sometimes a player should be publicly shamed,
 * - sometimes they should be privately needled,
 * - sometimes the right move is bluff exposure,
 * - sometimes pressure should be held in shadow,
 * - sometimes a hater should wait because helper timing matters more,
 * - sometimes high hostility exists but the room is wrong for expression,
 * - sometimes sovereignty proximity changes the entire meaning of an attack,
 * - sometimes a deal-room predator should stay quiet and let the silence work.
 *
 * So this model must judge:
 * 1. whether there is lawful / useful targeting opportunity,
 * 2. whether current engagement can absorb hostile pressure,
 * 3. whether the room wants public theater or private predation,
 * 4. whether the right tactic is confidence puncture, bluff exposure,
 *    shield funeral, crowd summon, sovereignty denial, or quiet shadow priming,
 * 5. which canonical persona family best matches the opening.
 *
 * The result is an explainable targeting packet for downstream orchestration.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type AttackType,
  type BotId,
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

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_HATER_TARGETING_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_HATER_TARGETING_MODEL' as const;

export const CHAT_HATER_TARGETING_MODEL_VERSION =
  '2026.03.14-hater-targeting-model.v1' as const;

export const CHAT_HATER_TARGETING_MODEL_RUNTIME_LAWS = Object.freeze([
  'Targeting is a recommendation surface for orchestration, not transcript authority.',
  'A player near collapse is not always a valid public target; rescue state and helper posture matter.',
  'Deal-room predation is interpreted differently from global theatrical hostility.',
  'Sovereignty proximity materially changes the value of denial / puncture tactics.',
  'Bluff exposure prefers pressure and shadow leakage over generic taunts.',
  'Targeting opportunity must consider visibility, crowd heat, fragility, and expressive capacity together.',
  'Persona routing is contextual and explainable; it is never random-only.',
  'When suppression is recommended, that recommendation is part of the truth surface for orchestration.',
] as const);

export const CHAT_HATER_TARGETING_MODEL_DEFAULTS = Object.freeze({
  lowEvidenceFallback01: 0.26,
  lowEvidenceRowCount: 2,
  publicVisibilityThreshold01: 0.58,
  crowdHeatPublicThreshold01: 0.62,
  crowdHeatOverheatThreshold01: 0.86,
  shadowPrimeThreshold01: 0.42,
  publicLeakThreshold01: 0.68,
  ceremonialThreshold01: 0.90,
  helperSuppressionThreshold01: 0.70,
  fragilitySuppressionThreshold01: 0.78,
  engagementFloorToTarget01: 0.18,
  criticalPressureBonus01: 0.12,
  rescueWindowSuppressionPenalty01: 0.14,
  sovereigntyPunishBonus01: 0.16,
  bluffExposureBonus01: 0.14,
  bankruptcyPunishBonus01: 0.13,
  negativeSwarmPublicBonus01: 0.10,
  positiveSwarmTheaterBonus01: 0.06,
  privatePredationBonus01: 0.10,
  haterRaidBonus01: 0.12,
  helperBlackoutBonus01: 0.08,
  confidencePunishThreshold01: 0.64,
  overconfidenceGapThreshold01: 0.24,
  dealRoomQuietBoost01: 0.08,
  silenceBreakThreshold01: 0.58,
  explanationFactorLimit: 12,
  cooldownBaseMs: 7_500,
  cooldownMinimumMs: 1_500,
  cooldownMaximumMs: 18_000,
  attackWindowBaseMs: 5_500,
  attackWindowMinimumMs: 1_000,
  attackWindowMaximumMs: 12_000,
  defaultPreferredChannel: 'GLOBAL' as ChatVisibleChannel,
  defaultPrivateChannel: 'SYNDICATE' as ChatVisibleChannel,
  defaultNegotiationChannel: 'DEAL_ROOM' as ChatVisibleChannel,
  defaultLobbyChannel: 'LOBBY' as ChatVisibleChannel,
} as const);

// ============================================================================
// MARK: Ports and options
// ============================================================================

export interface HaterTargetingModelLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface HaterTargetingModelClockPort {
  now(): UnixMs;
}

export interface HaterTargetingModelOptions {
  readonly logger?: HaterTargetingModelLoggerPort;
  readonly clock?: HaterTargetingModelClockPort;
  readonly defaults?: Partial<typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS>;
  readonly runtimeOverride?: Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>;
}

export interface HaterTargetingModelContext {
  readonly logger: HaterTargetingModelLoggerPort;
  readonly clock: HaterTargetingModelClockPort;
  readonly defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS;
  readonly runtime: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
}

// ============================================================================
// MARK: Model-specific contracts
// ============================================================================

// ============================================================================
// MARK: Local tactic / escalation mirrors
// ============================================================================

export type HaterEscalationBand =
  | 'NONE'
  | 'PROBING'
  | 'PRESSURE'
  | 'HARD'
  | 'RUTHLESS'
  | 'CEREMONIAL_EXECUTION';

export type HaterTactic =
  | 'TAUNT'
  | 'PUNCTURE_CONFIDENCE'
  | 'PUNISH_OVERCONFIDENCE'
  | 'PREDATORY_SILENCE_BREAK'
  | 'CROWD_SUMMON'
  | 'BLUFF_EXPOSURE'
  | 'SHIELD_FUNERAL'
  | 'SOVEREIGNTY_DENIAL'
  | 'DEALROOM_THREAT'
  | 'PUBLIC_EXECUTION';

export type HaterTargetingRecommendation =
  | 'SUPPRESS'
  | 'DEFER'
  | 'SHADOW_PRIME'
  | 'PRIVATE_PROBE'
  | 'PUBLIC_STRIKE'
  | 'CROWD_PILEON'
  | 'CEREMONIAL_EXECUTION';

export interface HaterPersonaAffinity {
  readonly botId: BotId;
  readonly label:
    | 'LIQUIDATOR'
    | 'BUREAUCRAT'
    | 'MANIPULATOR'
    | 'CRASH_PROPHET'
    | 'LEGACY_HEIR';
  readonly score01: Score01;
  readonly preferredAttackType: AttackType;
  readonly reasons: readonly string[];
}

export interface HaterTargetingContribution {
  readonly key: string;
  readonly signedDelta01: number;
  readonly reason: string;
}

export interface HaterTargetingDiagnostics {
  readonly rowCount: number;
  readonly freshnessMs: number;
  readonly lowEvidence: boolean;
  readonly publicOpportunity01: Score01;
  readonly privatePredation01: Score01;
  readonly shadowPriming01: Score01;
  readonly suppression01: Score01;
  readonly volatility01: Score01;
  readonly explanationFactors: readonly HaterTargetingContribution[];
}

export interface HaterTargetingScore {
  readonly generatedAt: UnixMs;
  readonly roomId: Nullable<ChatRoomId>;
  readonly userId: Nullable<string>;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly recommendation: HaterTargetingRecommendation;
  readonly targeting01: Score01;
  readonly targeting100: Score100;
  readonly shadowPriming01: Score01;
  readonly publicLeak01: Score01;
  readonly suppression01: Score01;
  readonly escalationBand: HaterEscalationBand;
  readonly tactic: HaterTactic;
  readonly preferredAttackType: AttackType;
  readonly preferredChannel: ChatVisibleChannel;
  readonly preferredBotId: BotId;
  readonly personaAffinities: readonly HaterPersonaAffinity[];
  readonly cooldownMs: number;
  readonly attackWindowMs: number;
  readonly shouldTarget: boolean;
  readonly shouldShadowPrime: boolean;
  readonly shouldLeakToGlobal: boolean;
  readonly shouldSuppress: boolean;
  readonly shouldEscalate: boolean;
  readonly diagnostics: HaterTargetingDiagnostics;
}

export interface HaterTargetingBatchResult {
  readonly generatedAt: UnixMs;
  readonly scores: readonly HaterTargetingScore[];
  readonly hottest: Nullable<HaterTargetingScore>;
  readonly coldest: Nullable<HaterTargetingScore>;
}

export interface HaterTargetingPriorState {
  readonly targeting01: Score01;
  readonly shadowPriming01: Score01;
  readonly publicLeak01: Score01;
  readonly suppression01: Score01;
  readonly generatedAt: UnixMs;
}

export interface HaterTargetingModelInput {
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
  readonly battleLastAttackRecent01: Score01;
  readonly runNearSovereignty01: Score01;
  readonly runBankruptcyWarning01: Score01;
  readonly multiplayerRankingPressure01: Score01;
  readonly economyLiquidityStress01: Score01;
  readonly economyOverpayRisk01: Score01;
  readonly economyBluffRisk01: Score01;
  readonly liveopsHeatMultiplier01: Score01;
  readonly liveopsHelperBlackout01: Score01;
  readonly liveopsHaterRaid01: Score01;
  readonly toxicityRisk01: Score01;
  readonly silenceConcern01: Score01;
  readonly roomSwarmDirection: 'NEGATIVE' | 'POSITIVE' | 'NEUTRAL' | 'UNKNOWN';
  readonly silenceBand: 'FRESH' | 'STALE' | 'HARD' | 'UNKNOWN';
  readonly contributorBand: 'QUIET' | 'ACTIVE' | 'SWARM' | 'UNKNOWN';
  readonly sourceEventKind: string;
  readonly sourceChannel: string;
  readonly sourceAttackType: AttackType | 'NONE';
  readonly sourceBotId: BotId | 'NONE';
  readonly roomStageMood:
    | 'FOCUSED'
    | 'HYPED'
    | 'HOSTILE'
    | 'WOUNDED'
    | 'PREDATORY'
    | 'MOURNFUL'
    | 'UNKNOWN';
  readonly runPhase: string;
  readonly runOutcome: string;
  readonly factionName: Nullable<string>;
  readonly worldEventName: Nullable<string>;
  readonly invasionState: 'ACTIVE' | 'CLEAR' | 'UNKNOWN';
  readonly freshnessMs: number;
  readonly evidenceRowIds: readonly string[];
  readonly evidenceRows: readonly ChatFeatureRow[];
  readonly canonicalSnapshot: Nullable<ChatFeatureSnapshot>;
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
  readonly engagement?: Nullable<EngagementModelScore>;
  readonly engagementPrior?: Nullable<EngagementModelPriorState>;
}

// ============================================================================
// MARK: Internal defaults and helpers
// ============================================================================

const DEFAULT_LOGGER: HaterTargetingModelLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const DEFAULT_CLOCK: HaterTargetingModelClockPort = {
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

function pressureIntensity01(pressureTier: PressureTier): Score01 {
  switch (pressureTier) {
    case 'NONE':
      return asScore(0);
    case 'BUILDING':
      return asScore(0.24);
    case 'ELEVATED':
      return asScore(0.50);
    case 'HIGH':
      return asScore(0.76);
    case 'CRITICAL':
      return asScore(1);
    default:
      return asScore(0.50);
  }
}

function isDealRoom(input: HaterTargetingModelInput): boolean {
  return input.activeVisibleChannel === 'DEAL_ROOM' || input.roomKind === 'DEAL_ROOM';
}

function isSyndicate(input: HaterTargetingModelInput): boolean {
  return input.activeVisibleChannel === 'SYNDICATE' || input.roomKind === 'SYNDICATE';
}

function isLobby(input: HaterTargetingModelInput): boolean {
  return input.activeVisibleChannel === 'LOBBY' || input.roomKind === 'LOBBY';
}

function isGlobal(input: HaterTargetingModelInput): boolean {
  return input.activeVisibleChannel === 'GLOBAL' || input.roomKind === 'GLOBAL';
}

function isNegativeSwarm(input: HaterTargetingModelInput): boolean {
  return input.roomSwarmDirection === 'NEGATIVE';
}

function isPositiveSwarm(input: HaterTargetingModelInput): boolean {
  return input.roomSwarmDirection === 'POSITIVE';
}

function lowEvidence(
  input: HaterTargetingModelInput,
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
): boolean {
  return input.evidenceRows.length < defaults.lowEvidenceRowCount;
}

function contributorBandDensity01(band: HaterTargetingModelInput['contributorBand']): Score01 {
  switch (band) {
    case 'QUIET':
      return asScore(0.24);
    case 'ACTIVE':
      return asScore(0.58);
    case 'SWARM':
      return asScore(0.86);
    default:
      return asScore(0.40);
  }
}

function normalizeAggregateInput(
  aggregate: ChatOnlineFeatureAggregate,
  options: {
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly engagement?: Nullable<EngagementModelScore>;
    readonly engagementPrior?: Nullable<EngagementModelPriorState>;
  } = {},
): HaterTargetingModelInput {
  const canonical = aggregate.canonicalSnapshot;
  const latestRow = aggregate.latestRow;
  const roomKind = pickCategory(aggregate, 'roomKind', 'UNKNOWN') as ChatRoomKind | 'UNKNOWN';
  const activeVisibleChannel = pickCategory(aggregate, 'activeVisibleChannel', 'GLOBAL') as ChatVisibleChannel;
  const pressureTier = pickCategory(aggregate, 'pressureTier', canonical?.pressureTier ?? 'BUILDING') as PressureTier;

  return Object.freeze({
    generatedAt: aggregate.generatedAt,
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
    helperReceptivity01: pickScalar(aggregate, 'helperReceptivity01', options.learningProfile?.helperReceptivity01 ?? 0.44),
    helperIgnore01: pickScalar(aggregate, 'helperIgnore01', 0),
    rescueOpportunity01: pickScalar(aggregate, 'rescueOpportunity01', 0.34),
    visibilityExposure01: pickScalar(aggregate, 'visibilityExposure01', 0.62),
    switchStress01: pickScalar(aggregate, 'switchStress01', 0),
    averageMessageLength01: pickScalar(aggregate, 'averageMessageLength01', 0.28),
    helperDensity01: pickScalar(aggregate, 'helperDensity01', 0.12),
    haterDensity01: pickScalar(aggregate, 'haterDensity01', 0.16),
    roomCrowding01: pickScalar(aggregate, 'roomCrowding01', 0.34),
    confidence01: pickScalar(aggregate, 'confidence01', canonical?.affect.confidence01 ?? options.learningProfile?.affect.confidence01 ?? 0.40),
    frustration01: pickScalar(aggregate, 'frustration01', canonical?.affect.frustration01 ?? options.learningProfile?.affect.frustration01 ?? 0.24),
    intimidation01: pickScalar(aggregate, 'intimidation01', canonical?.affect.intimidation01 ?? options.learningProfile?.affect.intimidation01 ?? 0.18),
    attachment01: pickScalar(aggregate, 'attachment01', canonical?.affect.attachment01 ?? options.learningProfile?.affect.attachment01 ?? 0.22),
    curiosity01: pickScalar(aggregate, 'curiosity01', canonical?.affect.curiosity01 ?? options.learningProfile?.affect.curiosity01 ?? 0.28),
    embarrassment01: pickScalar(aggregate, 'embarrassment01', canonical?.affect.embarrassment01 ?? options.learningProfile?.affect.embarrassment01 ?? 0.14),
    relief01: pickScalar(aggregate, 'relief01', canonical?.affect.relief01 ?? options.learningProfile?.affect.relief01 ?? 0.12),
    affinityGlobal01: pickScalar(aggregate, 'affinityGlobal01', options.learningProfile?.channelAffinity.GLOBAL ?? 0.25),
    affinitySyndicate01: pickScalar(aggregate, 'affinitySyndicate01', options.learningProfile?.channelAffinity.SYNDICATE ?? 0.25),
    affinityDealRoom01: pickScalar(aggregate, 'affinityDealRoom01', options.learningProfile?.channelAffinity.DEAL_ROOM ?? 0.25),
    affinityLobby01: pickScalar(aggregate, 'affinityLobby01', options.learningProfile?.channelAffinity.LOBBY ?? 0.25),
    battleRescueWindowOpen01: pickScalar(aggregate, 'battleRescueWindowOpen01', options.sourceSignal?.battle?.rescueWindowOpen ? 1 : 0),
    battleShieldIntegrity01: pickScalar(aggregate, 'battleShieldIntegrity01', options.sourceSignal?.battle?.shieldIntegrity01 ?? 0),
    battleLastAttackRecent01: pickScalar(aggregate, 'battleLastAttackRecent01', 0),
    runNearSovereignty01: pickScalar(aggregate, 'runNearSovereignty01', options.sourceSignal?.run?.nearSovereignty ? 1 : 0),
    runBankruptcyWarning01: pickScalar(aggregate, 'runBankruptcyWarning01', options.sourceSignal?.run?.bankruptcyWarning ? 1 : 0),
    multiplayerRankingPressure01: pickScalar(aggregate, 'multiplayerRankingPressure01', options.sourceSignal?.multiplayer?.rankingPressure ?? 0),
    economyLiquidityStress01: pickScalar(aggregate, 'economyLiquidityStress01', options.sourceSignal?.economy?.liquidityStress01 ?? 0),
    economyOverpayRisk01: pickScalar(aggregate, 'economyOverpayRisk01', options.sourceSignal?.economy?.overpayRisk01 ?? 0),
    economyBluffRisk01: pickScalar(aggregate, 'economyBluffRisk01', options.sourceSignal?.economy?.bluffRisk01 ?? 0),
    liveopsHeatMultiplier01: pickScalar(aggregate, 'liveopsHeatMultiplier01', options.sourceSignal?.liveops?.heatMultiplier01 ?? 0),
    liveopsHelperBlackout01: pickScalar(aggregate, 'liveopsHelperBlackout01', options.sourceSignal?.liveops?.helperBlackout ? 1 : 0),
    liveopsHaterRaid01: pickScalar(aggregate, 'liveopsHaterRaid01', options.sourceSignal?.liveops?.haterRaidActive ? 1 : 0),
    toxicityRisk01: pickScalar(aggregate, 'toxicityRisk01', 0.18),
    silenceConcern01: pickScalar(aggregate, 'silenceConcern01', 0),
    roomSwarmDirection: pickCategory(aggregate, 'roomSwarmDirection', 'UNKNOWN') as HaterTargetingModelInput['roomSwarmDirection'],
    silenceBand: pickCategory(aggregate, 'silenceBand', 'UNKNOWN') as HaterTargetingModelInput['silenceBand'],
    contributorBand: pickCategory(aggregate, 'contributorBand', 'UNKNOWN') as HaterTargetingModelInput['contributorBand'],
    sourceEventKind: pickCategory(aggregate, 'sourceEventKind', latestRow?.diagnostics.sourceEventKind ?? 'UNKNOWN'),
    sourceChannel: pickCategory(aggregate, 'sourceChannel', latestRow?.diagnostics.sourceChannel ?? 'UNKNOWN'),
    sourceAttackType: pickCategory(aggregate, 'sourceAttackType', 'NONE') as AttackType | 'NONE',
    sourceBotId: pickCategory(aggregate, 'sourceBotId', 'NONE') as BotId | 'NONE',
    roomStageMood: pickCategory(aggregate, 'roomStageMood', 'UNKNOWN') as HaterTargetingModelInput['roomStageMood'],
    runPhase: pickCategory(aggregate, 'runPhase', options.sourceSignal?.run?.runPhase ?? 'UNKNOWN'),
    runOutcome: pickCategory(aggregate, 'runOutcome', options.sourceSignal?.run?.outcome ?? 'UNKNOWN'),
    factionName: pickCategory(aggregate, 'factionName', options.sourceSignal?.multiplayer?.factionName ?? 'NONE'),
    worldEventName: pickCategory(aggregate, 'worldEventName', options.sourceSignal?.liveops?.worldEventName ?? 'NONE'),
    invasionState: pickCategory(aggregate, 'invasionState', 'UNKNOWN') as HaterTargetingModelInput['invasionState'],
    freshnessMs: aggregate.freshnessMs,
    evidenceRowIds: aggregate.rows.map((row) => row.rowId),
    evidenceRows: aggregate.rows,
    canonicalSnapshot: canonical,
    learningProfile: options.learningProfile ?? null,
    sourceSignal: options.sourceSignal ?? null,
    engagement: options.engagement ?? null,
    engagementPrior: options.engagementPrior ?? null,
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
  } = {},
): HaterTargetingModelInput {
  const roomKind = pickCategory(window, 'roomKind', 'UNKNOWN') as ChatRoomKind | 'UNKNOWN';
  const activeVisibleChannel = pickCategory(window, 'activeVisibleChannel', 'GLOBAL') as ChatVisibleChannel;
  const pressureTier = pickCategory(window, 'pressureTier', window.canonicalSnapshot?.pressureTier ?? 'BUILDING') as PressureTier;

  return Object.freeze({
    generatedAt: window.generatedAt,
    roomId: options.roomId ?? null,
    sessionId: options.sessionId ?? null,
    userId: options.userId ?? null,
    roomKind,
    activeVisibleChannel,
    pressureTier,
    roomHeat01: window.canonicalSnapshot?.roomHeat01 ?? pickScalar(window, 'roomHeat01', 0.16),
    hostileMomentum01: window.canonicalSnapshot?.hostileMomentum01 ?? pickScalar(window, 'hostileMomentum01', 0.18),
    churnRisk01: window.canonicalSnapshot?.churnRisk01 ?? pickScalar(window, 'churnRisk01', 0.22),
    responseCadence01: pickScalar(window, 'responseCadence01', 0.42),
    recentPlayerShare01: pickScalar(window, 'recentPlayerShare01', 0.32),
    recentNpcShare01: pickScalar(window, 'recentNpcShare01', 0.46),
    helperReceptivity01: pickScalar(window, 'helperReceptivity01', options.learningProfile?.helperReceptivity01 ?? 0.44),
    helperIgnore01: pickScalar(window, 'helperIgnore01', 0),
    rescueOpportunity01: pickScalar(window, 'rescueOpportunity01', 0.34),
    visibilityExposure01: pickScalar(window, 'visibilityExposure01', 0.62),
    switchStress01: pickScalar(window, 'switchStress01', 0),
    averageMessageLength01: pickScalar(window, 'averageMessageLength01', 0.28),
    helperDensity01: pickScalar(window, 'helperDensity01', 0.12),
    haterDensity01: pickScalar(window, 'haterDensity01', 0.16),
    roomCrowding01: pickScalar(window, 'roomCrowding01', 0.34),
    confidence01: pickScalar(window, 'confidence01', window.canonicalSnapshot?.affect.confidence01 ?? options.learningProfile?.affect.confidence01 ?? 0.40),
    frustration01: pickScalar(window, 'frustration01', window.canonicalSnapshot?.affect.frustration01 ?? options.learningProfile?.affect.frustration01 ?? 0.24),
    intimidation01: pickScalar(window, 'intimidation01', window.canonicalSnapshot?.affect.intimidation01 ?? options.learningProfile?.affect.intimidation01 ?? 0.18),
    attachment01: pickScalar(window, 'attachment01', window.canonicalSnapshot?.affect.attachment01 ?? options.learningProfile?.affect.attachment01 ?? 0.22),
    curiosity01: pickScalar(window, 'curiosity01', window.canonicalSnapshot?.affect.curiosity01 ?? options.learningProfile?.affect.curiosity01 ?? 0.28),
    embarrassment01: pickScalar(window, 'embarrassment01', window.canonicalSnapshot?.affect.embarrassment01 ?? options.learningProfile?.affect.embarrassment01 ?? 0.14),
    relief01: pickScalar(window, 'relief01', window.canonicalSnapshot?.affect.relief01 ?? options.learningProfile?.affect.relief01 ?? 0.12),
    affinityGlobal01: pickScalar(window, 'affinityGlobal01', options.learningProfile?.channelAffinity.GLOBAL ?? 0.25),
    affinitySyndicate01: pickScalar(window, 'affinitySyndicate01', options.learningProfile?.channelAffinity.SYNDICATE ?? 0.25),
    affinityDealRoom01: pickScalar(window, 'affinityDealRoom01', options.learningProfile?.channelAffinity.DEAL_ROOM ?? 0.25),
    affinityLobby01: pickScalar(window, 'affinityLobby01', options.learningProfile?.channelAffinity.LOBBY ?? 0.25),
    battleRescueWindowOpen01: pickScalar(window, 'battleRescueWindowOpen01', options.sourceSignal?.battle?.rescueWindowOpen ? 1 : 0),
    battleShieldIntegrity01: pickScalar(window, 'battleShieldIntegrity01', options.sourceSignal?.battle?.shieldIntegrity01 ?? 0),
    battleLastAttackRecent01: pickScalar(window, 'battleLastAttackRecent01', 0),
    runNearSovereignty01: pickScalar(window, 'runNearSovereignty01', options.sourceSignal?.run?.nearSovereignty ? 1 : 0),
    runBankruptcyWarning01: pickScalar(window, 'runBankruptcyWarning01', options.sourceSignal?.run?.bankruptcyWarning ? 1 : 0),
    multiplayerRankingPressure01: pickScalar(window, 'multiplayerRankingPressure01', options.sourceSignal?.multiplayer?.rankingPressure ?? 0),
    economyLiquidityStress01: pickScalar(window, 'economyLiquidityStress01', options.sourceSignal?.economy?.liquidityStress01 ?? 0),
    economyOverpayRisk01: pickScalar(window, 'economyOverpayRisk01', options.sourceSignal?.economy?.overpayRisk01 ?? 0),
    economyBluffRisk01: pickScalar(window, 'economyBluffRisk01', options.sourceSignal?.economy?.bluffRisk01 ?? 0),
    liveopsHeatMultiplier01: pickScalar(window, 'liveopsHeatMultiplier01', options.sourceSignal?.liveops?.heatMultiplier01 ?? 0),
    liveopsHelperBlackout01: pickScalar(window, 'liveopsHelperBlackout01', options.sourceSignal?.liveops?.helperBlackout ? 1 : 0),
    liveopsHaterRaid01: pickScalar(window, 'liveopsHaterRaid01', options.sourceSignal?.liveops?.haterRaidActive ? 1 : 0),
    toxicityRisk01: pickScalar(window, 'toxicityRisk01', 0.18),
    silenceConcern01: pickScalar(window, 'silenceConcern01', 0),
    roomSwarmDirection: pickCategory(window, 'roomSwarmDirection', 'UNKNOWN') as HaterTargetingModelInput['roomSwarmDirection'],
    silenceBand: pickCategory(window, 'silenceBand', 'UNKNOWN') as HaterTargetingModelInput['silenceBand'],
    contributorBand: pickCategory(window, 'contributorBand', 'UNKNOWN') as HaterTargetingModelInput['contributorBand'],
    sourceEventKind: pickCategory(window, 'sourceEventKind', 'UNKNOWN'),
    sourceChannel: pickCategory(window, 'sourceChannel', 'UNKNOWN'),
    sourceAttackType: pickCategory(window, 'sourceAttackType', 'NONE') as AttackType | 'NONE',
    sourceBotId: pickCategory(window, 'sourceBotId', 'NONE') as BotId | 'NONE',
    roomStageMood: pickCategory(window, 'roomStageMood', 'UNKNOWN') as HaterTargetingModelInput['roomStageMood'],
    runPhase: pickCategory(window, 'runPhase', options.sourceSignal?.run?.runPhase ?? 'UNKNOWN'),
    runOutcome: pickCategory(window, 'runOutcome', options.sourceSignal?.run?.outcome ?? 'UNKNOWN'),
    factionName: pickCategory(window, 'factionName', options.sourceSignal?.multiplayer?.factionName ?? 'NONE'),
    worldEventName: pickCategory(window, 'worldEventName', options.sourceSignal?.liveops?.worldEventName ?? 'NONE'),
    invasionState: pickCategory(window, 'invasionState', 'UNKNOWN') as HaterTargetingModelInput['invasionState'],
    freshnessMs: Math.max(0, Date.now() - (window.generatedAt as number)),
    evidenceRowIds: window.evidenceRowIds,
    evidenceRows: [],
    canonicalSnapshot: window.canonicalSnapshot,
    learningProfile: options.learningProfile ?? null,
    sourceSignal: options.sourceSignal ?? null,
    engagement: options.engagement ?? null,
    engagementPrior: options.engagementPrior ?? null,
  });
}

function computeVolatility01(
  rows: readonly ChatFeatureRow[],
): Score01 {
  const slice = rows.slice(0, 6);
  if (slice.length < 2) return asScore(0.08);

  let delta = 0;
  for (let index = 1; index < slice.length; index += 1) {
    const left = slice[index - 1];
    const right = slice[index];
    delta += Math.abs(safeNumber(left.scalarFeatures.hostileMomentum01, 0) - safeNumber(right.scalarFeatures.hostileMomentum01, 0));
    delta += Math.abs(safeNumber(left.scalarFeatures.frustration01, 0) - safeNumber(right.scalarFeatures.frustration01, 0)) * 0.75;
    delta += Math.abs(safeNumber(left.scalarFeatures.confidence01, 0) - safeNumber(right.scalarFeatures.confidence01, 0)) * 0.60;
    delta += Math.abs(safeNumber(left.scalarFeatures.responseCadence01, 0) - safeNumber(right.scalarFeatures.responseCadence01, 0)) * 0.50;
  }

  return asScore(clamp01(delta / Math.max((slice.length - 1) * 2.4, 1)));
}

function computeOverconfidenceGap01(input: HaterTargetingModelInput): Score01 {
  return asScore(
    clamp01(
      (input.confidence01 as number) -
        ((input.battleShieldIntegrity01 as number) * 0.35 +
          (1 - (input.economyLiquidityStress01 as number)) * 0.20 +
          (1 - (input.churnRisk01 as number)) * 0.15 +
          (1 - (input.frustration01 as number)) * 0.10 +
          (1 - (input.intimidation01 as number)) * 0.08),
    ),
  );
}

function computeSuppression01(
  input: HaterTargetingModelInput,
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
): Score01 {
  const engagement = input.engagement;
  const lowEngagementPenalty = engagement && engagement.engagement01 < defaults.engagementFloorToTarget01 ? 0.20 : 0;
  const helperPressure = input.helperReceptivity01 >= defaults.helperSuppressionThreshold01 && input.rescueOpportunity01 >= 0.48
    ? 0.18
    : 0;
  const fragilityPenalty = engagement && engagement.fragility01 >= defaults.fragilitySuppressionThreshold01 ? 0.18 : 0;
  const rescueWindowPenalty = input.battleRescueWindowOpen01 > 0 ? defaults.rescueWindowSuppressionPenalty01 : 0;
  const positiveSwarmSoftening = isPositiveSwarm(input) ? 0.04 : 0;
  const helperDensityPenalty = (input.helperDensity01 as number) * 0.12;
  const attachmentPenalty = (input.attachment01 as number) * 0.06;

  return asScore(
    lowEngagementPenalty +
      helperPressure +
      fragilityPenalty +
      rescueWindowPenalty +
      helperDensityPenalty +
      attachmentPenalty +
      positiveSwarmSoftening,
  );
}

function computeShadowPriming01(
  input: HaterTargetingModelInput,
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
): Score01 {
  const quietRoomBonus = input.silenceBand === 'HARD' ? 0.12 : input.silenceBand === 'STALE' ? 0.08 : 0;
  const dealRoomBonus = isDealRoom(input) ? defaults.dealRoomQuietBoost01 : 0;
  const bluffBonus = (input.economyBluffRisk01 as number) * 0.20;
  const intimidationBonus = (input.intimidation01 as number) * 0.08;
  const haterHeat = (input.hostileMomentum01 as number) * 0.16;
  const visibilityDiscount = (1 - (input.visibilityExposure01 as number)) * 0.16;
  const helperDiscount = (input.helperDensity01 as number) * 0.06;

  return asScore(
    quietRoomBonus + dealRoomBonus + bluffBonus + intimidationBonus + haterHeat + visibilityDiscount - helperDiscount,
  );
}

function computePrivatePredation01(
  input: HaterTargetingModelInput,
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
): Score01 {
  const dealRoom = isDealRoom(input) ? defaults.privatePredationBonus01 : 0;
  const syndicate = isSyndicate(input) ? 0.06 : 0;
  const bluff = (input.economyBluffRisk01 as number) * 0.24;
  const overpay = (input.economyOverpayRisk01 as number) * 0.14;
  const intimidation = (input.intimidation01 as number) * 0.08;
  const visibilityDiscount = (1 - (input.visibilityExposure01 as number)) * 0.12;
  const roomCrowdingDiscount = (1 - (input.roomCrowding01 as number)) * 0.06;
  const negativeSwarmDiscount = isNegativeSwarm(input) ? 0.02 : 0;

  return asScore(
    dealRoom + syndicate + bluff + overpay + intimidation + visibilityDiscount + roomCrowdingDiscount - negativeSwarmDiscount,
  );
}

function computePublicOpportunity01(
  input: HaterTargetingModelInput,
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
): Score01 {
  const visibility = (input.visibilityExposure01 as number) * 0.24;
  const crowd = (input.roomHeat01 as number) * 0.16 + (contributorBandDensity01(input.contributorBand) as number) * 0.10;
  const negativeSwarmBonus = isNegativeSwarm(input) ? defaults.negativeSwarmPublicBonus01 : 0;
  const positiveSwarmTheater = isPositiveSwarm(input) ? defaults.positiveSwarmTheaterBonus01 : 0;
  const confidencePunish = computeOverconfidenceGap01(input) >= defaults.overconfidenceGapThreshold01 ? 0.08 : 0;
  const nearSovereignty = (input.runNearSovereignty01 as number) * 0.12;
  const bankruptcy = (input.runBankruptcyWarning01 as number) * 0.10;
  const helperDensityPenalty = (input.helperDensity01 as number) * 0.08;

  return asScore(
    visibility + crowd + negativeSwarmBonus + positiveSwarmTheater + confidencePunish + nearSovereignty + bankruptcy - helperDensityPenalty,
  );
}

function computeTargetingPressure01(
  input: HaterTargetingModelInput,
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
  publicOpportunity01: Score01,
  privatePredation01: Score01,
  shadowPriming01: Score01,
): Score01 {
  const pressure = pressureIntensity01(input.pressureTier);
  const hostility = (input.hostileMomentum01 as number) * 0.22;
  const toxicity = (input.toxicityRisk01 as number) * 0.08;
  const haterDensity = (input.haterDensity01 as number) * 0.10;
  const criticalBonus = input.pressureTier === 'CRITICAL' ? defaults.criticalPressureBonus01 : 0;
  const sovereigntyBonus = (input.runNearSovereignty01 as number) * defaults.sovereigntyPunishBonus01;
  const bluffBonus = (input.economyBluffRisk01 as number) * defaults.bluffExposureBonus01;
  const bankruptcyBonus = (input.runBankruptcyWarning01 as number) * defaults.bankruptcyPunishBonus01;
  const helperBlackoutBonus = input.liveopsHelperBlackout01 > 0 ? defaults.helperBlackoutBonus01 : 0;
  const raidBonus = input.liveopsHaterRaid01 > 0 ? defaults.haterRaidBonus01 : 0;
  const publicOrPrivate = Math.max(publicOpportunity01 as number, privatePredation01 as number);

  return asScore(
    (pressure as number) * 0.12 +
      hostility +
      toxicity +
      haterDensity +
      criticalBonus +
      sovereigntyBonus +
      bluffBonus +
      bankruptcyBonus +
      helperBlackoutBonus +
      raidBonus +
      publicOrPrivate * 0.18 +
      (shadowPriming01 as number) * 0.06,
  );
}

function computeTargeting01(
  input: HaterTargetingModelInput,
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
  publicOpportunity01: Score01,
  privatePredation01: Score01,
  shadowPriming01: Score01,
  suppression01: Score01,
  volatility01: Score01,
): Score01 {
  const engagementBoost = input.engagement ? (input.engagement.engagement01 as number) * 0.08 : 0;
  const fragilityPenalty = input.engagement ? (input.engagement.fragility01 as number) * 0.10 : 0;
  const targetingPressure = computeTargetingPressure01(
    input,
    defaults,
    publicOpportunity01,
    privatePredation01,
    shadowPriming01,
  );

  const base = lowEvidence(input, defaults)
    ? defaults.lowEvidenceFallback01
    : 0.28 + (isGlobal(input) ? 0.04 : 0) + (isDealRoom(input) ? 0.02 : 0);

  return asScore(
    base +
      (targetingPressure as number) +
      engagementBoost -
      (suppression01 as number) -
      fragilityPenalty -
      (volatility01 as number) * 0.06,
  );
}

function preferredChannelForTargeting(
  input: HaterTargetingModelInput,
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
  publicOpportunity01: Score01,
  privatePredation01: Score01,
  recommendation: HaterTargetingRecommendation,
): ChatVisibleChannel {
  if (recommendation === 'CEREMONIAL_EXECUTION' || recommendation === 'CROWD_PILEON') {
    return 'GLOBAL';
  }

  if (recommendation === 'PUBLIC_STRIKE' && publicOpportunity01 >= defaults.publicVisibilityThreshold01) {
    return 'GLOBAL';
  }

  if (isDealRoom(input) || privatePredation01 > publicOpportunity01) {
    return defaults.defaultNegotiationChannel;
  }

  if (isSyndicate(input)) {
    return defaults.defaultPrivateChannel;
  }

  if (isLobby(input)) {
    return defaults.defaultLobbyChannel;
  }

  return defaults.defaultPreferredChannel;
}

function preferredAttackTypeForInput(
  input: HaterTargetingModelInput,
  publicOpportunity01: Score01,
  privatePredation01: Score01,
  shadowPriming01: Score01,
): AttackType {
  if (input.runNearSovereignty01 >= 0.72) return 'SABOTAGE';
  if (input.runBankruptcyWarning01 >= 0.58 || input.economyLiquidityStress01 >= 0.62) return 'LIQUIDATION';
  if (input.economyBluffRisk01 >= 0.62) return 'SHADOW_LEAK';
  if (publicOpportunity01 >= 0.72) return 'CROWD_SWARM';
  if (privatePredation01 >= 0.60) return 'COMPLIANCE';
  if (shadowPriming01 >= 0.56) return 'SHADOW_LEAK';
  return 'TAUNT';
}

function tacticForInput(
  input: HaterTargetingModelInput,
  targeting01: Score01,
  publicOpportunity01: Score01,
  privatePredation01: Score01,
  shadowPriming01: Score01,
): HaterTactic {
  if (targeting01 >= 0.90) return 'PUBLIC_EXECUTION';
  if (input.runNearSovereignty01 >= 0.60) return 'SOVEREIGNTY_DENIAL';
  if (input.economyBluffRisk01 >= 0.56) return 'BLUFF_EXPOSURE';
  if (input.runBankruptcyWarning01 >= 0.54 || input.battleShieldIntegrity01 <= 0.24) return 'SHIELD_FUNERAL';
  if (publicOpportunity01 >= 0.70) return 'CROWD_SUMMON';
  if (privatePredation01 >= 0.60 && isDealRoom(input)) return 'DEALROOM_THREAT';
  if (shadowPriming01 >= 0.54 && input.silenceBand !== 'FRESH') return 'PREDATORY_SILENCE_BREAK';
  if (computeOverconfidenceGap01(input) >= 0.24) return 'PUNISH_OVERCONFIDENCE';
  if (input.confidence01 >= 0.60) return 'PUNCTURE_CONFIDENCE';
  return 'TAUNT';
}

function escalationBandForTargeting(
  targeting01: Score01,
  suppression01: Score01,
  recommendation: HaterTargetingRecommendation,
): HaterEscalationBand {
  if (recommendation === 'SUPPRESS') return 'NONE';
  if (recommendation === 'SHADOW_PRIME') return 'PROBING';
  if (recommendation === 'PRIVATE_PROBE') return 'PRESSURE';
  if (recommendation === 'PUBLIC_STRIKE') return targeting01 >= 0.74 ? 'HARD' : 'PRESSURE';
  if (recommendation === 'CROWD_PILEON') return 'RUTHLESS';
  if (recommendation === 'CEREMONIAL_EXECUTION') return 'CEREMONIAL_EXECUTION';
  if (suppression01 >= 0.5) return 'PROBING';
  if (targeting01 >= 0.72) return 'HARD';
  if (targeting01 >= 0.54) return 'PRESSURE';
  return 'PROBING';
}

function recommendationForTargeting(
  input: HaterTargetingModelInput,
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
  targeting01: Score01,
  publicOpportunity01: Score01,
  privatePredation01: Score01,
  shadowPriming01: Score01,
  suppression01: Score01,
): HaterTargetingRecommendation {
  if (suppression01 >= 0.72) return 'SUPPRESS';

  if (targeting01 >= defaults.ceremonialThreshold01) {
    return publicOpportunity01 >= 0.52 ? 'CEREMONIAL_EXECUTION' : 'PUBLIC_STRIKE';
  }

  if (publicOpportunity01 >= defaults.publicLeakThreshold01 && targeting01 >= 0.64) {
    return isNegativeSwarm(input) || input.liveopsHaterRaid01 > 0 ? 'CROWD_PILEON' : 'PUBLIC_STRIKE';
  }

  if (privatePredation01 >= 0.56 && targeting01 >= 0.48) {
    return 'PRIVATE_PROBE';
  }

  if (shadowPriming01 >= defaults.shadowPrimeThreshold01 && targeting01 >= 0.36) {
    return 'SHADOW_PRIME';
  }

  if (targeting01 >= 0.32) return 'DEFER';
  return 'SUPPRESS';
}

function computeCooldownMs(
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
  targeting01: Score01,
  suppression01: Score01,
): number {
  const aggressionAcceleration = (targeting01 as number) * 0.60;
  const suppressionDrag = (suppression01 as number) * 0.55;
  const scalar = 1 - aggressionAcceleration + suppressionDrag;
  const ms = defaults.cooldownBaseMs * clamp01(Math.max(0.10, scalar));
  return Math.max(defaults.cooldownMinimumMs, Math.min(defaults.cooldownMaximumMs, Math.round(ms)));
}

function computeAttackWindowMs(
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
  targeting01: Score01,
  publicOpportunity01: Score01,
  shadowPriming01: Score01,
): number {
  const urgency = (targeting01 as number) * 0.52 + (publicOpportunity01 as number) * 0.22 + (shadowPriming01 as number) * 0.08;
  const scalar = 1 - urgency;
  const ms = defaults.attackWindowBaseMs * clamp01(Math.max(0.18, scalar));
  return Math.max(defaults.attackWindowMinimumMs, Math.min(defaults.attackWindowMaximumMs, Math.round(ms)));
}

function personaAffinitiesForInput(
  input: HaterTargetingModelInput,
  preferredAttackType: AttackType,
): readonly HaterPersonaAffinity[] {
  const results: HaterPersonaAffinity[] = [];

  const liquidatorReasons: string[] = [];
  let liquidator = 0.10;
  if (input.runBankruptcyWarning01 >= 0.40) {
    liquidator += 0.26;
    liquidatorReasons.push('Bankruptcy warning is active.');
  }
  if (input.economyLiquidityStress01 >= 0.42) {
    liquidator += 0.22;
    liquidatorReasons.push('Liquidity stress is visible.');
  }
  if (input.battleShieldIntegrity01 <= 0.32) {
    liquidator += 0.12;
    liquidatorReasons.push('Shield integrity is weak.');
  }
  if (preferredAttackType === 'LIQUIDATION') {
    liquidator += 0.12;
    liquidatorReasons.push('Current attack type maps to LIQUIDATION pressure.');
  }
  results.push(Object.freeze({
    botId: 'BOT_01',
    label: 'LIQUIDATOR',
    score01: asScore(liquidator),
    preferredAttackType: 'LIQUIDATION',
    reasons: Object.freeze(liquidatorReasons),
  }));

  const bureaucratReasons: string[] = [];
  let bureaucrat = 0.10;
  if (isDealRoom(input) || input.roomStageMood === 'PREDATORY') {
    bureaucrat += 0.16;
    bureaucratReasons.push('Room posture supports procedural pressure.');
  }
  if (input.switchStress01 >= 0.24) {
    bureaucrat += 0.12;
    bureaucratReasons.push('Switch stress suggests exploitable instability.');
  }
  if (input.economyOverpayRisk01 >= 0.36) {
    bureaucrat += 0.16;
    bureaucratReasons.push('Overpay risk invites compliance-style scrutiny.');
  }
  if (preferredAttackType === 'COMPLIANCE') {
    bureaucrat += 0.12;
    bureaucratReasons.push('Current attack type maps to COMPLIANCE pressure.');
  }
  results.push(Object.freeze({
    botId: 'BOT_02',
    label: 'BUREAUCRAT',
    score01: asScore(bureaucrat),
    preferredAttackType: 'COMPLIANCE',
    reasons: Object.freeze(bureaucratReasons),
  }));

  const manipulatorReasons: string[] = [];
  let manipulator = 0.10;
  if (input.economyBluffRisk01 >= 0.34) {
    manipulator += 0.24;
    manipulatorReasons.push('Bluff risk is elevated.');
  }
  if (input.silenceBand !== 'FRESH') {
    manipulator += 0.10;
    manipulatorReasons.push('Stale silence supports shadow leverage.');
  }
  if (input.intimidation01 >= 0.28) {
    manipulator += 0.10;
    manipulatorReasons.push('Intimidation is high enough for manipulation tactics.');
  }
  if (preferredAttackType === 'SHADOW_LEAK') {
    manipulator += 0.14;
    manipulatorReasons.push('Current attack type maps to SHADOW_LEAK pressure.');
  }
  results.push(Object.freeze({
    botId: 'BOT_03',
    label: 'MANIPULATOR',
    score01: asScore(manipulator),
    preferredAttackType: 'SHADOW_LEAK',
    reasons: Object.freeze(manipulatorReasons),
  }));

  const crashReasons: string[] = [];
  let crash = 0.10;
  if (pressureIntensity01(input.pressureTier) >= 0.50) {
    crash += 0.18;
    crashReasons.push('Pressure tier is elevated.');
  }
  if (input.roomHeat01 >= 0.54) {
    crash += 0.10;
    crashReasons.push('Room heat supports a crash-prophet frame.');
  }
  if (input.runNearSovereignty01 >= 0.36) {
    crash += 0.08;
    crashReasons.push('Sovereignty proximity can be sabotaged.');
  }
  if (preferredAttackType === 'SABOTAGE') {
    crash += 0.14;
    crashReasons.push('Current attack type maps to SABOTAGE pressure.');
  }
  results.push(Object.freeze({
    botId: 'BOT_04',
    label: 'CRASH_PROPHET',
    score01: asScore(crash),
    preferredAttackType: 'SABOTAGE',
    reasons: Object.freeze(crashReasons),
  }));

  const legacyReasons: string[] = [];
  let legacy = 0.10;
  if (isGlobal(input) || input.roomCrowding01 >= 0.42) {
    legacy += 0.18;
    legacyReasons.push('Crowd conditions support status-based pressure.');
  }
  if (input.embarrassment01 >= 0.22) {
    legacy += 0.12;
    legacyReasons.push('Embarrassment posture is high enough for social humiliation tactics.');
  }
  if (input.visibilityExposure01 >= 0.54) {
    legacy += 0.10;
    legacyReasons.push('Player visibility is high enough for prestige-based attacks.');
  }
  if (preferredAttackType === 'CROWD_SWARM') {
    legacy += 0.14;
    legacyReasons.push('Current attack type maps to CROWD_SWARM pressure.');
  }
  results.push(Object.freeze({
    botId: 'BOT_05',
    label: 'LEGACY_HEIR',
    score01: asScore(legacy),
    preferredAttackType: 'CROWD_SWARM',
    reasons: Object.freeze(legacyReasons),
  }));

  return Object.freeze(results.sort((left, right) => (right.score01 as number) - (left.score01 as number)));
}

function explanationFactorsForTargeting(
  input: HaterTargetingModelInput,
  defaults: typeof CHAT_HATER_TARGETING_MODEL_DEFAULTS,
  values: {
    publicOpportunity01: Score01;
    privatePredation01: Score01;
    shadowPriming01: Score01;
    suppression01: Score01;
    volatility01: Score01;
    targeting01: Score01;
    recommendation: HaterTargetingRecommendation;
  },
): readonly HaterTargetingContribution[] {
  const factors: HaterTargetingContribution[] = [];

  factors.push(Object.freeze({
    key: 'hostile_momentum',
    signedDelta01: (input.hostileMomentum01 as number) * 0.22,
    reason: 'Hostile room momentum is raising the expected value of hater intervention.',
  }));

  factors.push(Object.freeze({
    key: 'pressure_tier',
    signedDelta01: (pressureIntensity01(input.pressureTier) as number) * 0.12,
    reason: 'Current pressure tier is changing how valuable a hostile timing window would be.',
  }));

  factors.push(Object.freeze({
    key: 'public_opportunity',
    signedDelta01: values.publicOpportunity01 as number,
    reason: 'Visibility, crowd heat, and channel posture are shaping the value of public attack.',
  }));

  factors.push(Object.freeze({
    key: 'private_predation',
    signedDelta01: values.privatePredation01 as number,
    reason: 'Private predation conditions measure whether quiet pressure is more efficient than public theater.',
  }));

  factors.push(Object.freeze({
    key: 'shadow_priming',
    signedDelta01: values.shadowPriming01 as number,
    reason: 'Shadow priming estimates whether invisible pressure is preferable before visible contact.',
  }));

  factors.push(Object.freeze({
    key: 'suppression',
    signedDelta01: -(values.suppression01 as number),
    reason: 'Suppression captures helper / rescue / fragility conditions that should inhibit immediate hostile action.',
  }));

  if (input.economyBluffRisk01 > 0.20) {
    factors.push(Object.freeze({
      key: 'bluff_exposure',
      signedDelta01: (input.economyBluffRisk01 as number) * defaults.bluffExposureBonus01,
      reason: 'Bluff exposure is materially increasing hater opportunity.',
    }));
  }

  if (input.runNearSovereignty01 > 0.20) {
    factors.push(Object.freeze({
      key: 'sovereignty_denial',
      signedDelta01: (input.runNearSovereignty01 as number) * defaults.sovereigntyPunishBonus01,
      reason: 'Sovereignty proximity increases denial value and ceremonial attack potential.',
    }));
  }

  if (input.runBankruptcyWarning01 > 0.20) {
    factors.push(Object.freeze({
      key: 'bankruptcy_window',
      signedDelta01: (input.runBankruptcyWarning01 as number) * defaults.bankruptcyPunishBonus01,
      reason: 'Bankruptcy warning increases liquidation / public collapse pressure.',
    }));
  }

  if (values.volatility01 > 0.20) {
    factors.push(Object.freeze({
      key: 'volatility',
      signedDelta01: -(values.volatility01 as number) * 0.10,
      reason: 'Short-window volatility reduces the certainty that a hostile strike lands cleanly.',
    }));
  }

  if (input.liveopsHaterRaid01 > 0) {
    factors.push(Object.freeze({
      key: 'liveops_hater_raid',
      signedDelta01: defaults.haterRaidBonus01,
      reason: 'A liveops raid is increasing ambient authorization for hater activity.',
    }));
  }

  if (input.engagement) {
    factors.push(Object.freeze({
      key: 'engagement_floor',
      signedDelta01: (input.engagement.engagement01 as number) * 0.08,
      reason: 'Player engagement determines whether hater pressure has an audience worth attacking.',
    }));
  }

  const sorted = factors
    .sort((left, right) => Math.abs(right.signedDelta01) - Math.abs(left.signedDelta01))
    .slice(0, defaults.explanationFactorLimit);

  return Object.freeze(sorted);
}

// ============================================================================
// MARK: Model implementation
// ============================================================================

export class HaterTargetingModel {
  private readonly context: HaterTargetingModelContext;

  public constructor(options: HaterTargetingModelOptions = {}) {
    this.context = Object.freeze({
      logger: options.logger ?? DEFAULT_LOGGER,
      clock: options.clock ?? DEFAULT_CLOCK,
      defaults: Object.freeze({
        ...CHAT_HATER_TARGETING_MODEL_DEFAULTS,
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
      readonly prior?: Nullable<HaterTargetingPriorState>;
    } = {},
  ): HaterTargetingScore {
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
      readonly prior?: Nullable<HaterTargetingPriorState>;
    } = {},
  ): HaterTargetingScore {
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
      readonly prior?: Nullable<HaterTargetingPriorState>;
    } = {},
  ): HaterTargetingScore {
    const aggregate = aggregateOnlineFeatureWindow(rowsOrBatch, 'HATER_TARGETING');
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
      readonly prior?: Nullable<HaterTargetingPriorState>;
    } = {},
  ): HaterTargetingScore {
    const aggregate = store.aggregate({ ...query, family: 'HATER_TARGETING' });
    return this.scoreAggregate(aggregate, options);
  }

  public scoreBatch(
    aggregates: readonly ChatOnlineFeatureAggregate[],
    options: {
      readonly learningProfilesByUserId?: Readonly<Record<string, ChatLearningProfile>>;
      readonly signalsByRoomId?: Readonly<Record<string, ChatSignalEnvelope>>;
      readonly engagementsByUserId?: Readonly<Record<string, EngagementModelScore>>;
      readonly priorsByUserId?: Readonly<Record<string, HaterTargetingPriorState>>;
      readonly engagementPriorsByUserId?: Readonly<Record<string, EngagementModelPriorState>>;
    } = {},
  ): HaterTargetingBatchResult {
    const generatedAt = this.context.clock.now();
    const scores = aggregates.map((aggregate) => {
      const userId = aggregate.userId ?? undefined;
      const roomId = aggregate.roomId ?? undefined;
      return this.scoreAggregate(aggregate, {
        learningProfile: userId ? options.learningProfilesByUserId?.[userId] ?? null : null,
        sourceSignal: roomId ? options.signalsByRoomId?.[roomId] ?? null : null,
        engagement: userId ? options.engagementsByUserId?.[userId] ?? null : null,
        prior: userId ? options.priorsByUserId?.[userId] ?? null : null,
        engagementPrior: userId ? options.engagementPriorsByUserId?.[userId] ?? null : null,
      });
    });

    const hottest = scores.length
      ? scores.reduce((best, current) => (current.targeting01 > best.targeting01 ? current : best))
      : null;

    const coldest = scores.length
      ? scores.reduce((worst, current) => (current.targeting01 < worst.targeting01 ? current : worst))
      : null;

    return Object.freeze({
      generatedAt,
      scores: Object.freeze(scores),
      hottest,
      coldest,
    });
  }

  public toPriorState(score: HaterTargetingScore): HaterTargetingPriorState {
    return Object.freeze({
      targeting01: score.targeting01,
      shadowPriming01: score.shadowPriming01,
      publicLeak01: score.publicLeak01,
      suppression01: score.suppression01,
      generatedAt: score.generatedAt,
    });
  }

  public scoreInput(
    input: HaterTargetingModelInput,
    prior: Nullable<HaterTargetingPriorState> = null,
  ): HaterTargetingScore {
    const { defaults, logger } = this.context;

    const suppression01 = computeSuppression01(input, defaults);
    const shadowPriming01Raw = computeShadowPriming01(input, defaults);
    const privatePredation01 = computePrivatePredation01(input, defaults);
    const publicOpportunity01 = computePublicOpportunity01(input, defaults);
    const volatility01 = computeVolatility01(input.evidenceRows);

    const targeting01Unblended = computeTargeting01(
      input,
      defaults,
      publicOpportunity01,
      privatePredation01,
      shadowPriming01Raw,
      suppression01,
      volatility01,
    );

    const targeting01 = prior
      ? asScore(
          (targeting01Unblended as number) * 0.76 +
            (prior.targeting01 as number) * 0.24,
        )
      : targeting01Unblended;

    const shadowPriming01 = prior
      ? asScore((shadowPriming01Raw as number) * 0.78 + (prior.shadowPriming01 as number) * 0.22)
      : shadowPriming01Raw;

    const publicLeak01Raw = asScore(
      (publicOpportunity01 as number) * 0.58 +
        (targeting01 as number) * 0.24 +
        (isNegativeSwarm(input) ? 0.08 : 0) +
        (input.liveopsHaterRaid01 as number) * 0.08 -
        (suppression01 as number) * 0.16,
    );

    const publicLeak01 = prior
      ? asScore((publicLeak01Raw as number) * 0.78 + (prior.publicLeak01 as number) * 0.22)
      : publicLeak01Raw;

    const recommendation = recommendationForTargeting(
      input,
      defaults,
      targeting01,
      publicOpportunity01,
      privatePredation01,
      shadowPriming01,
      suppression01,
    );

    const preferredChannel = preferredChannelForTargeting(
      input,
      defaults,
      publicOpportunity01,
      privatePredation01,
      recommendation,
    );

    const preferredAttackType = preferredAttackTypeForInput(
      input,
      publicOpportunity01,
      privatePredation01,
      shadowPriming01,
    );

    const tactic = tacticForInput(
      input,
      targeting01,
      publicOpportunity01,
      privatePredation01,
      shadowPriming01,
    );

    const personaAffinities = personaAffinitiesForInput(input, preferredAttackType);
    const preferredBotId = personaAffinities[0]?.botId ?? 'BOT_01';
    const escalationBand = escalationBandForTargeting(targeting01, suppression01, recommendation);
    const cooldownMs = computeCooldownMs(defaults, targeting01, suppression01);
    const attackWindowMs = computeAttackWindowMs(defaults, targeting01, publicOpportunity01, shadowPriming01);

    const shouldSuppress = recommendation === 'SUPPRESS';
    const shouldShadowPrime = recommendation === 'SHADOW_PRIME';
    const shouldLeakToGlobal =
      recommendation === 'CROWD_PILEON' ||
      recommendation === 'CEREMONIAL_EXECUTION' ||
      (recommendation === 'PUBLIC_STRIKE' && preferredChannel === 'GLOBAL');
    const shouldTarget = !shouldSuppress && recommendation !== 'DEFER';
    const shouldEscalate = escalationBand === 'HARD' || escalationBand === 'RUTHLESS' || escalationBand === 'CEREMONIAL_EXECUTION';

    const explanationFactors = explanationFactorsForTargeting(input, defaults, {
      publicOpportunity01,
      privatePredation01,
      shadowPriming01,
      suppression01,
      volatility01,
      targeting01,
      recommendation,
    });

    const diagnostics: HaterTargetingDiagnostics = Object.freeze({
      rowCount: input.evidenceRows.length || input.evidenceRowIds.length,
      freshnessMs: input.freshnessMs,
      lowEvidence: lowEvidence(input, defaults),
      publicOpportunity01,
      privatePredation01,
      shadowPriming01,
      suppression01,
      volatility01,
      explanationFactors,
    });

    const result: HaterTargetingScore = Object.freeze({
      generatedAt: input.generatedAt,
      roomId: input.roomId,
      userId: input.userId,
      activeVisibleChannel: input.activeVisibleChannel,
      recommendation,
      targeting01,
      targeting100: asScore100((targeting01 as number) * 100),
      shadowPriming01,
      publicLeak01,
      suppression01,
      escalationBand,
      tactic,
      preferredAttackType,
      preferredChannel,
      preferredBotId,
      personaAffinities,
      cooldownMs,
      attackWindowMs,
      shouldTarget,
      shouldShadowPrime,
      shouldLeakToGlobal,
      shouldSuppress,
      shouldEscalate,
      diagnostics,
    });

    logger.debug('Hater targeting score generated.', {
      module: CHAT_HATER_TARGETING_MODEL_MODULE_NAME,
      version: CHAT_HATER_TARGETING_MODEL_VERSION,
      roomId: input.roomId,
      userId: input.userId,
      targeting01: result.targeting01,
      recommendation: result.recommendation,
      preferredAttackType: result.preferredAttackType,
      preferredChannel: result.preferredChannel,
      preferredBotId: result.preferredBotId,
    });

    return result;
  }
}

// ============================================================================
// MARK: Public helpers
// ============================================================================

export function createHaterTargetingModel(
  options: HaterTargetingModelOptions = {},
): HaterTargetingModel {
  return new HaterTargetingModel(options);
}

export function scoreHaterTargetingAggregate(
  aggregate: ChatOnlineFeatureAggregate,
  options: HaterTargetingModelOptions & {
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly engagement?: Nullable<EngagementModelScore>;
    readonly engagementPrior?: Nullable<EngagementModelPriorState>;
    readonly prior?: Nullable<HaterTargetingPriorState>;
  } = {},
): HaterTargetingScore {
  const model = new HaterTargetingModel(options);
  return model.scoreAggregate(aggregate, options);
}

export function scoreHaterTargetingStore(
  store: OnlineFeatureStore,
  query: ChatOnlineFeatureStoreQuery,
  options: HaterTargetingModelOptions & {
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly engagement?: Nullable<EngagementModelScore>;
    readonly engagementPrior?: Nullable<EngagementModelPriorState>;
    readonly prior?: Nullable<HaterTargetingPriorState>;
  } = {},
): HaterTargetingScore {
  const model = new HaterTargetingModel(options);
  return model.scoreStore(store, query, options);
}

export function scoreHaterTargetingRows(
  rowsOrBatch: readonly ChatFeatureRow[] | ChatFeatureIngestResult,
  options: HaterTargetingModelOptions & {
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly engagement?: Nullable<EngagementModelScore>;
    readonly engagementPrior?: Nullable<EngagementModelPriorState>;
    readonly prior?: Nullable<HaterTargetingPriorState>;
  } = {},
): HaterTargetingScore {
  const model = new HaterTargetingModel(options);
  return model.scoreRows(rowsOrBatch, options);
}

export function scoreHaterTargetingInferenceWindow(
  window: ChatOnlineInferenceWindow,
  options: HaterTargetingModelOptions & {
    readonly roomId?: Nullable<ChatRoomId>;
    readonly sessionId?: Nullable<string>;
    readonly userId?: Nullable<string>;
    readonly learningProfile?: Nullable<ChatLearningProfile>;
    readonly sourceSignal?: Nullable<ChatSignalEnvelope>;
    readonly engagement?: Nullable<EngagementModelScore>;
    readonly engagementPrior?: Nullable<EngagementModelPriorState>;
    readonly prior?: Nullable<HaterTargetingPriorState>;
  } = {},
): HaterTargetingScore {
  const model = new HaterTargetingModel(options);
  return model.scoreInferenceWindow(window, options);
}

export function serializeHaterTargetingScore(
  score: HaterTargetingScore,
): Readonly<Record<string, JsonValue>> {
  return Object.freeze({
    generatedAt: score.generatedAt as number,
    roomId: score.roomId,
    userId: score.userId,
    activeVisibleChannel: score.activeVisibleChannel,
    recommendation: score.recommendation,
    targeting01: score.targeting01 as number,
    targeting100: score.targeting100 as number,
    shadowPriming01: score.shadowPriming01 as number,
    publicLeak01: score.publicLeak01 as number,
    suppression01: score.suppression01 as number,
    escalationBand: score.escalationBand,
    tactic: score.tactic,
    preferredAttackType: score.preferredAttackType,
    preferredChannel: score.preferredChannel,
    preferredBotId: score.preferredBotId,
    cooldownMs: score.cooldownMs,
    attackWindowMs: score.attackWindowMs,
    shouldTarget: score.shouldTarget,
    shouldShadowPrime: score.shouldShadowPrime,
    shouldLeakToGlobal: score.shouldLeakToGlobal,
    shouldSuppress: score.shouldSuppress,
    shouldEscalate: score.shouldEscalate,
    personaAffinities: score.personaAffinities.map((entry) => ({
      botId: entry.botId,
      label: entry.label,
      score01: entry.score01 as number,
      preferredAttackType: entry.preferredAttackType,
      reasons: entry.reasons,
    })),
    diagnostics: {
      rowCount: score.diagnostics.rowCount,
      freshnessMs: score.diagnostics.freshnessMs,
      lowEvidence: score.diagnostics.lowEvidence,
      publicOpportunity01: score.diagnostics.publicOpportunity01 as number,
      privatePredation01: score.diagnostics.privatePredation01 as number,
      shadowPriming01: score.diagnostics.shadowPriming01 as number,
      suppression01: score.diagnostics.suppression01 as number,
      volatility01: score.diagnostics.volatility01 as number,
      explanationFactors: score.diagnostics.explanationFactors.map((factor) => ({
        key: factor.key,
        signedDelta01: factor.signedDelta01,
        reason: factor.reason,
      })),
    },
  });
}

export function hydratePriorHaterTargetingState(
  payload: Partial<Record<keyof HaterTargetingPriorState, unknown>>,
): Nullable<HaterTargetingPriorState> {
  if (!payload) return null;
  const generatedAt = safeNumber(payload.generatedAt, 0);
  if (!generatedAt) return null;

  return Object.freeze({
    targeting01: asScore(safeNumber(payload.targeting01, 0.26)),
    shadowPriming01: asScore(safeNumber(payload.shadowPriming01, 0.20)),
    publicLeak01: asScore(safeNumber(payload.publicLeak01, 0.18)),
    suppression01: asScore(safeNumber(payload.suppression01, 0.24)),
    generatedAt: asUnixMs(generatedAt),
  });
}

export const CHAT_HATER_TARGETING_MODEL_NAMESPACE = Object.freeze({
  moduleName: CHAT_HATER_TARGETING_MODEL_MODULE_NAME,
  version: CHAT_HATER_TARGETING_MODEL_VERSION,
  runtimeLaws: CHAT_HATER_TARGETING_MODEL_RUNTIME_LAWS,
  defaults: CHAT_HATER_TARGETING_MODEL_DEFAULTS,
  create: createHaterTargetingModel,
  scoreAggregate: scoreHaterTargetingAggregate,
  scoreStore: scoreHaterTargetingStore,
  scoreRows: scoreHaterTargetingRows,
  scoreInferenceWindow: scoreHaterTargetingInferenceWindow,
  serialize: serializeHaterTargetingScore,
  hydratePriorState: hydratePriorHaterTargetingState,
} as const);

export default HaterTargetingModel;
