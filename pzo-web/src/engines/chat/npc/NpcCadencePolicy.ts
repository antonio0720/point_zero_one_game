// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/npc/NpcCadencePolicy.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT NPC CADENCE POLICY
 * FILE: pzo-web/src/engines/chat/npc/NpcCadencePolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical cadence policy for the new frontend chat engine lane.
 *
 * This file is the arbitration layer that decides when chat should speak,
 * who should speak, how quickly they should speak, when silence is stronger
 * than another line, and how the room’s emotional tempo should evolve as the
 * run moves from ceremony → pressure → collapse → comeback → sovereignty.
 *
 * This is not a generic cooldown table.
 *
 * It exists because your donor logic already made cadence a first-class
 * mechanic:
 * - `SovereignChatKernel.ts` explicitly states that engagement from second one
 *   adapts bot aggression, helper frequency, and NPC cadence.
 * - `useChatEngine.ts` already called out that NPC cadence varies by TickTier,
 *   slower at SOVEREIGN and faster at CRISIS.
 * - `HelperCharacters.ts` already encoded helper frequency and idle trigger
 *   ticks.
 * - `HaterDialogueTrees.ts` already encoded context-sensitive pressure timing.
 *
 * The missing move was canonizing that into a dedicated policy module under:
 *   /pzo-web/src/engines/chat/npc
 *
 * Design laws
 * -----------
 * 1. Cadence must preserve channel identity.
 *    - GLOBAL is theatrical.
 *    - SYNDICATE is intimate and tactical.
 *    - DEAL_ROOM is predatory and restrained.
 *    - LOBBY is ceremonial and anticipatory.
 *
 * 2. Not every event should speak.
 *    Some moments deserve silence so the next witness line lands harder.
 *
 * 3. Helpers must feel timely, not spammy.
 *    Rescue windows, morale windows, and coach windows must remain distinct.
 *
 * 4. Haters must feel personal, not random.
 *    If the room is hot and the player is exposed, cadence should accelerate.
 *
 * 5. Ambient witnesses must texture the room, not drown the player.
 *
 * 6. Cadence must react to:
 *    - tick/tick-tier tempo,
 *    - pressure tier,
 *    - player silence,
 *    - crowd heat,
 *    - cold-start learning,
 *    - aggression preference,
 *    - rescue state,
 *    - channel family,
 *    - post-run / near-sovereignty moments,
 *    - anti-repeat and anti-burst constraints.
 *
 * Ownership boundaries
 * --------------------
 * This policy owns:
 * - frontend timing arbitration
 * - class quotas per pass
 * - silence windows
 * - delay shaping
 * - scene pacing memory
 * - cross-actor burst protection
 * - emergency rescue preemption
 * - witness / swarm / ceremony timing
 *
 * This policy does NOT own:
 * - transcript truth
 * - server fanout
 * - moderation authority
 * - permanent learning profile writes
 * - final replay indexing
 *
 * Long-term authority
 * -------------------
 * /shared/contracts/chat
 * /pzo-web/src/engines/chat
 * /pzo-web/src/components/chat
 * /backend/src/game/engine/chat
 * /pzo-server/src/chat
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type { ChatChannelId, ChatMountTarget } from '../types';

import {
  getAllAmbientRegistryEntries,
  ambientCanSpeakInChannel,
  pickAmbientDialogueLine,
  listAmbientActorsForContext,
  type AmbientDialogueContext,
  type AmbientNpcId,
  type AmbientRegistryEntry,
} from './AmbientNpcRegistry';

import {
  haterResponsePlanner,
  type FrontendRunMode,
  type HaterDialogueContext,
  type HaterResponsePlan,
  type HaterResponsePlannerInput,
  type HaterThreatBand,
} from './HaterResponsePlanner';

import {
  helperResponsePlanner,
  type HelperCharacterId,
  type HelperResponsePlan,
  type HelperResponsePlannerInput,
  type HelperDeliveryLane,
} from './HelperResponsePlanner';

/* ============================================================================
 * MARK: Versions, actor classes, tempo bands, and public exports
 * ============================================================================
 */

export const NPC_CADENCE_POLICY_VERSION = '2026.03.13' as const;

export type NpcCadenceActorClass =
  | 'HATER'
  | 'HELPER'
  | 'AMBIENT';

export type NpcCadenceTempoBand =
  | 'CEREMONIAL'
  | 'LOW'
  | 'STEADY'
  | 'PRESSURE'
  | 'CRISIS'
  | 'FINISHER';

export type NpcCadenceStageMood =
  | 'CALM'
  | 'TENSE'
  | 'HOSTILE'
  | 'PREDATORY'
  | 'CEREMONIAL';

export type NpcCadenceDeliveryLane =
  | 'PUBLIC'
  | 'PRIVATE'
  | 'WHISPER'
  | 'BANNER'
  | 'SHADOW';

export type NpcCadenceDecisionReason =
  | 'tempo-band'
  | 'class-quota'
  | 'player-grace'
  | 'forced-silence'
  | 'rescue-preemption'
  | 'coach-window'
  | 'morale-window'
  | 'intel-window'
  | 'heat-escalation'
  | 'crowd-witness'
  | 'deal-pressure'
  | 'lobby-ceremony'
  | 'sovereignty-ceremony'
  | 'post-loss-witness'
  | 'world-event'
  | 'cold-start'
  | 'anti-burst'
  | 'anti-repeat'
  | 'cooldown'
  | 'channel-fit'
  | 'mode-fit'
  | 'silence-preferred'
  | 'legend-echo'
  | 'ambient-texture'
  | 'fallback';

export type TickTierLike =
  | 'OPENING'
  | 'EARLY'
  | 'MID'
  | 'LATE'
  | 'ENDGAME'
  | 'CRISIS'
  | 'SOVEREIGN'
  | string;

export type PressureTierLike =
  | 'CALM'
  | 'ELEVATED'
  | 'TENSE'
  | 'CRITICAL'
  | 'CRISIS'
  | string;

/* ============================================================================
 * MARK: Input / output contracts
 * ============================================================================
 */

export interface NpcCadenceLearningInput {
  readonly totalRuns?: number;
  readonly trollRate?: number;
  readonly flexRate?: number;
  readonly angerRate?: number;
  readonly helpSeekRate?: number;
  readonly silenceRate?: number;
  readonly preferredAggressionLevel?: number;
  readonly avgMessagesPerRun?: number;
  readonly avgResponseTimeMs?: number;
}

export interface NpcCadencePolicyInput {
  readonly nowMs: number;
  readonly sceneId?: string;
  readonly channelId: ChatChannelId;
  readonly runMode: FrontendRunMode;
  readonly mountTarget?: ChatMountTarget | string;
  readonly tick: number;
  readonly tickTier?: TickTierLike;
  readonly pressureTier?: PressureTierLike;
  readonly stageMood?: NpcCadenceStageMood;
  readonly crowdHeat?: number;
  readonly relationshipHeat?: number;
  readonly worldEventActive?: boolean;
  readonly playerSilenceTicks?: number;
  readonly playerTiltScore?: number;
  readonly playerConfidenceScore?: number;
  readonly playerComposerOpen?: boolean;
  readonly playerRecentlyMessaged?: boolean;
  readonly legendJustOccurred?: boolean;
  readonly rescueOpen?: boolean;
  readonly dealTension?: number;
  readonly allowHaters?: boolean;
  readonly allowHelpers?: boolean;
  readonly allowAmbient?: boolean;
  readonly learning?: NpcCadenceLearningInput;
  readonly haterInput?: HaterResponsePlannerInput;
  readonly helperInput?: HelperResponsePlannerInput;
  readonly ambientRequestedContexts?: readonly AmbientDialogueContext[];
  readonly ambientSuppressedIds?: readonly AmbientNpcId[];
  readonly ambientUsedLineTexts?: ReadonlySet<string>;
  readonly rng?: () => number;
}

export interface NpcCadenceDecisionScore {
  readonly plannerBase: number;
  readonly tempoFit: number;
  readonly channelFit: number;
  readonly classFit: number;
  readonly heatFit: number;
  readonly rescueFit: number;
  readonly silenceFit: number;
  readonly ceremonyFit: number;
  readonly repeatPenalty: number;
  readonly burstPenalty: number;
  readonly cooldownPenalty: number;
  readonly total: number;
}

export interface NpcCadenceDecision {
  readonly actorClass: NpcCadenceActorClass;
  readonly actorId: string;
  readonly actorDisplayName: string;
  readonly channelId: ChatChannelId;
  readonly context: string;
  readonly text: string;
  readonly delayMs: number;
  readonly speakAtMs: number;
  readonly deliveryLane: NpcCadenceDeliveryLane;
  readonly score: NpcCadenceDecisionScore;
  readonly tempoBand: NpcCadenceTempoBand;
  readonly reasons: readonly NpcCadenceDecisionReason[];
  readonly source:
    | { readonly kind: 'HATER'; readonly plan: HaterResponsePlan }
    | { readonly kind: 'HELPER'; readonly plan: HelperResponsePlan }
    | {
        readonly kind: 'AMBIENT';
        readonly ambientId: AmbientNpcId;
        readonly context: AmbientDialogueContext;
      };
}

export interface NpcCadencePassResult {
  readonly tempoBand: NpcCadenceTempoBand;
  readonly classBudget: NpcCadenceClassBudget;
  readonly decisions: readonly NpcCadenceDecision[];
  readonly suppressedReasons: readonly string[];
}

export interface NpcCadenceCandidate {
  readonly actorClass: NpcCadenceActorClass;
  readonly actorId: string;
  readonly actorDisplayName: string;
  readonly context: string;
  readonly text: string;
  readonly deliveryLane: NpcCadenceDeliveryLane;
  readonly plannerBase: number;
  readonly initialDelayMs: number;
  readonly source:
    | { readonly kind: 'HATER'; readonly plan: HaterResponsePlan }
    | { readonly kind: 'HELPER'; readonly plan: HelperResponsePlan }
    | {
        readonly kind: 'AMBIENT';
        readonly ambientId: AmbientNpcId;
        readonly context: AmbientDialogueContext;
        readonly registryEntry: AmbientRegistryEntry;
      };
}

/* ============================================================================
 * MARK: Stateful cadence memory
 * ============================================================================
 */

export interface NpcCadenceRecentEmission {
  readonly actorClass: NpcCadenceActorClass;
  readonly actorId: string;
  readonly channelId: ChatChannelId;
  readonly context: string;
  readonly text: string;
  readonly emittedAtMs: number;
  readonly sceneId?: string;
}

export interface NpcCadenceSceneMemory {
  readonly sceneId: string;
  readonly channelId: ChatChannelId;
  readonly createdAtMs: number;
  lastPassAtMs: number;
  lastPlayerMessageAtMs: number | null;
  lastEmissionAtMs: number | null;
  forcedSilenceUntilMs: number;
  lastEmissionByActor: Map<string, number>;
  lastEmissionByContext: Map<string, number>;
  lastEmissionByClass: Map<NpcCadenceActorClass, number>;
  recentEmissions: NpcCadenceRecentEmission[];
  actorBurstCounters: Map<string, number>;
  tickEmissionCounter: Map<number, number>;
}

export interface NpcCadenceSnapshot {
  readonly sceneCount: number;
  readonly scenes: readonly {
    readonly sceneId: string;
    readonly channelId: ChatChannelId;
    readonly lastPassAtMs: number;
    readonly lastPlayerMessageAtMs: number | null;
    readonly lastEmissionAtMs: number | null;
    readonly forcedSilenceUntilMs: number;
    readonly recentEmissions: number;
  }[];
}

/* ============================================================================
 * MARK: Config surface
 * ============================================================================
 */

export interface NpcCadenceClassBudget {
  readonly maxTotal: number;
  readonly hater: number;
  readonly helper: number;
  readonly ambient: number;
}

export interface NpcCadenceTempoConfig {
  readonly minGapMs: number;
  readonly actorRepeatGapMs: number;
  readonly contextRepeatGapMs: number;
  readonly maxBurstPerActor: number;
  readonly helperScalar: number;
  readonly haterScalar: number;
  readonly ambientScalar: number;
  readonly defaultBudget: NpcCadenceClassBudget;
}

export interface NpcCadenceChannelConfig {
  readonly minGapScalar: number;
  readonly actorRepeatScalar: number;
  readonly contextRepeatScalar: number;
  readonly helperBias: number;
  readonly haterBias: number;
  readonly ambientBias: number;
  readonly ceremonyBias: number;
  readonly crowdBias: number;
  readonly allowSwarm: boolean;
  readonly publicWeight: number;
  readonly privateWeight: number;
  readonly silencePreference: number;
}

export interface NpcCadenceConfig {
  readonly sceneMemoryLimit: number;
  readonly emissionHistoryLimit: number;
  readonly playerGraceMs: number;
  readonly rescueGraceMs: number;
  readonly legendGraceMs: number;
  readonly postLossWitnessMs: number;
  readonly ambientWitnessDelayFloorMs: number;
  readonly ambientWitnessDelayCeilMs: number;
  readonly haterEmergencyAccelerationMs: number;
  readonly helperEmergencyAccelerationMs: number;
  readonly worldEventHeatBonus: number;
  readonly coldStartRunBoundary: number;
  readonly hotCrowdThreshold: number;
  readonly lowSilenceTicks: number;
  readonly mediumSilenceTicks: number;
  readonly highSilenceTicks: number;
  readonly tempo: Readonly<Record<NpcCadenceTempoBand, NpcCadenceTempoConfig>>;
  readonly channels: Readonly<Record<ChatChannelId, NpcCadenceChannelConfig>>;
}

const DEFAULT_TEMPO_CONFIG: Readonly<Record<NpcCadenceTempoBand, NpcCadenceTempoConfig>> = Object.freeze({
  CEREMONIAL: Object.freeze({
    minGapMs: 5_800,
    actorRepeatGapMs: 14_500,
    contextRepeatGapMs: 11_500,
    maxBurstPerActor: 1,
    helperScalar: 0.92,
    haterScalar: 0.68,
    ambientScalar: 1.22,
    defaultBudget: Object.freeze({ maxTotal: 1, hater: 0, helper: 1, ambient: 1 }),
  }),
  LOW: Object.freeze({
    minGapMs: 4_600,
    actorRepeatGapMs: 12_000,
    contextRepeatGapMs: 9_600,
    maxBurstPerActor: 1,
    helperScalar: 1.00,
    haterScalar: 0.82,
    ambientScalar: 1.14,
    defaultBudget: Object.freeze({ maxTotal: 1, hater: 1, helper: 1, ambient: 1 }),
  }),
  STEADY: Object.freeze({
    minGapMs: 3_850,
    actorRepeatGapMs: 9_900,
    contextRepeatGapMs: 8_250,
    maxBurstPerActor: 1,
    helperScalar: 1.05,
    haterScalar: 1.00,
    ambientScalar: 1.00,
    defaultBudget: Object.freeze({ maxTotal: 2, hater: 1, helper: 1, ambient: 1 }),
  }),
  PRESSURE: Object.freeze({
    minGapMs: 3_050,
    actorRepeatGapMs: 8_200,
    contextRepeatGapMs: 6_900,
    maxBurstPerActor: 1,
    helperScalar: 1.12,
    haterScalar: 1.18,
    ambientScalar: 0.82,
    defaultBudget: Object.freeze({ maxTotal: 2, hater: 1, helper: 1, ambient: 1 }),
  }),
  CRISIS: Object.freeze({
    minGapMs: 2_250,
    actorRepeatGapMs: 6_500,
    contextRepeatGapMs: 5_500,
    maxBurstPerActor: 2,
    helperScalar: 1.26,
    haterScalar: 1.30,
    ambientScalar: 0.68,
    defaultBudget: Object.freeze({ maxTotal: 3, hater: 1, helper: 1, ambient: 1 }),
  }),
  FINISHER: Object.freeze({
    minGapMs: 1_450,
    actorRepeatGapMs: 4_500,
    contextRepeatGapMs: 3_850,
    maxBurstPerActor: 2,
    helperScalar: 1.18,
    haterScalar: 1.42,
    ambientScalar: 0.56,
    defaultBudget: Object.freeze({ maxTotal: 3, hater: 2, helper: 1, ambient: 1 }),
  }),
});

const DEFAULT_CHANNEL_CONFIG: Readonly<Record<ChatChannelId, NpcCadenceChannelConfig>> = Object.freeze({
  GLOBAL: Object.freeze({
    minGapScalar: 1.00,
    actorRepeatScalar: 1.00,
    contextRepeatScalar: 1.00,
    helperBias: 1.02,
    haterBias: 1.08,
    ambientBias: 1.18,
    ceremonyBias: 1.12,
    crowdBias: 1.24,
    allowSwarm: true,
    publicWeight: 1.25,
    privateWeight: 0.66,
    silencePreference: 0.78,
  }),
  SYNDICATE: Object.freeze({
    minGapScalar: 0.86,
    actorRepeatScalar: 0.90,
    contextRepeatScalar: 0.90,
    helperBias: 1.18,
    haterBias: 0.94,
    ambientBias: 0.72,
    ceremonyBias: 0.84,
    crowdBias: 0.60,
    allowSwarm: false,
    publicWeight: 0.58,
    privateWeight: 1.18,
    silencePreference: 0.92,
  }),
  DEAL_ROOM: Object.freeze({
    minGapScalar: 1.14,
    actorRepeatScalar: 1.18,
    contextRepeatScalar: 1.12,
    helperBias: 0.94,
    haterBias: 1.16,
    ambientBias: 0.62,
    ceremonyBias: 0.56,
    crowdBias: 0.38,
    allowSwarm: false,
    publicWeight: 0.42,
    privateWeight: 1.26,
    silencePreference: 1.12,
  }),
  LOBBY: Object.freeze({
    minGapScalar: 1.08,
    actorRepeatScalar: 1.04,
    contextRepeatScalar: 1.02,
    helperBias: 1.00,
    haterBias: 0.88,
    ambientBias: 1.24,
    ceremonyBias: 1.28,
    crowdBias: 1.12,
    allowSwarm: true,
    publicWeight: 1.16,
    privateWeight: 0.62,
    silencePreference: 0.70,
  }),
  SYSTEM_SHADOW: Object.freeze({
    minGapScalar: 0.70,
    actorRepeatScalar: 0.82,
    contextRepeatScalar: 0.82,
    helperBias: 0.90,
    haterBias: 1.00,
    ambientBias: 0.80,
    ceremonyBias: 0.40,
    crowdBias: 0.20,
    allowSwarm: false,
    publicWeight: 0.00,
    privateWeight: 0.90,
    silencePreference: 1.18,
  }),
  NPC_SHADOW: Object.freeze({
    minGapScalar: 0.76,
    actorRepeatScalar: 0.84,
    contextRepeatScalar: 0.84,
    helperBias: 0.86,
    haterBias: 1.02,
    ambientBias: 0.84,
    ceremonyBias: 0.34,
    crowdBias: 0.16,
    allowSwarm: false,
    publicWeight: 0.00,
    privateWeight: 0.94,
    silencePreference: 1.16,
  }),
  RIVALRY_SHADOW: Object.freeze({
    minGapScalar: 0.82,
    actorRepeatScalar: 0.88,
    contextRepeatScalar: 0.88,
    helperBias: 0.76,
    haterBias: 1.12,
    ambientBias: 0.72,
    ceremonyBias: 0.22,
    crowdBias: 0.34,
    allowSwarm: false,
    publicWeight: 0.00,
    privateWeight: 1.00,
    silencePreference: 1.10,
  }),
  RESCUE_SHADOW: Object.freeze({
    minGapScalar: 0.68,
    actorRepeatScalar: 0.80,
    contextRepeatScalar: 0.80,
    helperBias: 1.24,
    haterBias: 0.60,
    ambientBias: 0.56,
    ceremonyBias: 0.20,
    crowdBias: 0.12,
    allowSwarm: false,
    publicWeight: 0.00,
    privateWeight: 1.18,
    silencePreference: 1.24,
  }),
  LIVEOPS_SHADOW: Object.freeze({
    minGapScalar: 0.90,
    actorRepeatScalar: 0.94,
    contextRepeatScalar: 0.94,
    helperBias: 0.72,
    haterBias: 0.94,
    ambientBias: 1.10,
    ceremonyBias: 0.44,
    crowdBias: 0.88,
    allowSwarm: false,
    publicWeight: 0.00,
    privateWeight: 0.86,
    silencePreference: 0.92,
  }),
});

export const DEFAULT_NPC_CADENCE_CONFIG: NpcCadenceConfig = Object.freeze({
  sceneMemoryLimit: 16,
  emissionHistoryLimit: 40,
  playerGraceMs: 1_050,
  rescueGraceMs: 700,
  legendGraceMs: 1_200,
  postLossWitnessMs: 900,
  ambientWitnessDelayFloorMs: 780,
  ambientWitnessDelayCeilMs: 2_500,
  haterEmergencyAccelerationMs: 650,
  helperEmergencyAccelerationMs: 550,
  worldEventHeatBonus: 0.12,
  coldStartRunBoundary: 5,
  hotCrowdThreshold: 0.72,
  lowSilenceTicks: 2,
  mediumSilenceTicks: 5,
  highSilenceTicks: 9,
  tempo: DEFAULT_TEMPO_CONFIG,
  channels: DEFAULT_CHANNEL_CONFIG,
});

/* ============================================================================
 * MARK: Low-level utilities
 * ============================================================================
 */

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function firstDefined<T>(...values: readonly (T | undefined | null)[]): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) return value as T;
  }
  return undefined;
}

function ensureArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return value ?? Object.freeze([]);
}

function asSceneId(input: NpcCadencePolicyInput): string {
  const explicit = safeString(input.sceneId, '').trim();
  if (explicit) return explicit;
  return `${input.channelId}:${input.runMode}`;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function uniqueAmbientContexts(values: readonly AmbientDialogueContext[]): readonly AmbientDialogueContext[] {
  return Object.freeze([...new Set(values)]);
}

function isVisibleChannel(channelId: ChatChannelId): boolean {
  return channelId === 'GLOBAL'
    || channelId === 'SYNDICATE'
    || channelId === 'DEAL_ROOM'
    || channelId === 'LOBBY';
}

function isShadowChannel(channelId: ChatChannelId): boolean {
  return !isVisibleChannel(channelId);
}

function resolveStageMood(input: NpcCadencePolicyInput): NpcCadenceStageMood {
  if (input.stageMood) return input.stageMood;
  if (input.channelId === 'DEAL_ROOM') return 'PREDATORY';
  if (input.channelId === 'LOBBY') return 'CEREMONIAL';
  if ((input.crowdHeat ?? 0) >= 0.68) return 'HOSTILE';
  if ((input.pressureTier ?? '') === 'CRISIS') return 'HOSTILE';
  return 'TENSE';
}

function resolveTickTier(input: NpcCadencePolicyInput): TickTierLike {
  return firstDefined(input.tickTier, input.haterInput?.run.tick.toString() as TickTierLike, input.helperInput?.run.tick.toString() as TickTierLike) ?? 'MID';
}

function resolvePressureTier(input: NpcCadencePolicyInput): PressureTierLike {
  return firstDefined(input.pressureTier, 'TENSE') ?? 'TENSE';
}

function isColdStart(learning: NpcCadenceLearningInput | undefined, boundary: number): boolean {
  return safeNumber(learning?.totalRuns, 0) < boundary;
}

function computeSilenceBand(
  input: NpcCadencePolicyInput,
  config: NpcCadenceConfig,
): 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' {
  const ticks = safeNumber(
    firstDefined(
      input.playerSilenceTicks,
      input.haterInput?.run.playerIdleTicks,
      input.helperInput?.run.playerIdleTicks,
    ),
    0,
  );

  if (ticks >= config.highSilenceTicks) return 'HIGH';
  if (ticks >= config.mediumSilenceTicks) return 'MEDIUM';
  if (ticks >= config.lowSilenceTicks) return 'LOW';
  return 'NONE';
}

function computePlayerTilt(input: NpcCadencePolicyInput): number {
  return clamp01(
    firstDefined(
      input.playerTiltScore,
      input.helperInput?.run.playerTiltScore,
    ) ?? 0,
  );
}

function computePlayerConfidence(input: NpcCadencePolicyInput): number {
  return clamp01(
    firstDefined(
      input.playerConfidenceScore,
      input.helperInput?.run.playerConfidenceScore,
    ) ?? 0,
  );
}

function computeCrowdHeat(input: NpcCadencePolicyInput, config: NpcCadenceConfig): number {
  const base = clamp01(safeNumber(input.crowdHeat, 0));
  if (!input.worldEventActive) return base;
  return clamp01(base + config.worldEventHeatBonus);
}

/* ============================================================================
 * MARK: Tempo resolution
 * ============================================================================
 */

function tickTierSuggestsFinisher(tickTier: TickTierLike): boolean {
  const upper = safeString(tickTier, '').toUpperCase();
  return upper.includes('END') || upper.includes('SOVEREIGN') || upper.includes('LATE');
}

function tickTierSuggestsCrisis(tickTier: TickTierLike): boolean {
  const upper = safeString(tickTier, '').toUpperCase();
  return upper.includes('CRISIS');
}

function pressureTierSuggestsCrisis(pressureTier: PressureTierLike): boolean {
  const upper = safeString(pressureTier, '').toUpperCase();
  return upper.includes('CRISIS') || upper.includes('CRITICAL');
}

function pressureTierSuggestsPressure(pressureTier: PressureTierLike): boolean {
  const upper = safeString(pressureTier, '').toUpperCase();
  return upper.includes('TENSE') || upper.includes('ELEVATED');
}

function resolveTempoBand(
  input: NpcCadencePolicyInput,
  config: NpcCadenceConfig,
): NpcCadenceTempoBand {
  const tickTier = resolveTickTier(input);
  const pressureTier = resolvePressureTier(input);
  const stageMood = resolveStageMood(input);
  const crowdHeat = computeCrowdHeat(input, config);
  const rescueOpen = input.rescueOpen
    || input.helperInput?.run.nearBankruptcy
    || input.helperInput?.run.playerLost
    || input.haterInput?.run.nearBankruptcy
    || false;

  if (tickTierSuggestsCrisis(tickTier) || pressureTierSuggestsCrisis(pressureTier)) {
    return rescueOpen ? 'CRISIS' : 'PRESSURE';
  }

  if (rescueOpen) return 'CRISIS';

  if (input.legendJustOccurred || input.helperInput?.run.nearSovereignty || input.haterInput?.run.nearSovereignty) {
    return 'FINISHER';
  }

  if (tickTierSuggestsFinisher(tickTier)) {
    return stageMood === 'CEREMONIAL' ? 'CEREMONIAL' : 'FINISHER';
  }

  if (pressureTierSuggestsPressure(pressureTier)) {
    return crowdHeat >= config.hotCrowdThreshold ? 'CRISIS' : 'PRESSURE';
  }

  if (stageMood === 'CEREMONIAL' || input.channelId === 'LOBBY') return 'CEREMONIAL';
  if (crowdHeat >= config.hotCrowdThreshold) return 'PRESSURE';
  if (stageMood === 'CALM') return 'LOW';
  return 'STEADY';
}

/* ============================================================================
 * MARK: Scene memory helpers
 * ============================================================================
 */

function createSceneMemory(
  sceneId: string,
  channelId: ChatChannelId,
  nowMs: number,
): NpcCadenceSceneMemory {
  return {
    sceneId,
    channelId,
    createdAtMs: nowMs,
    lastPassAtMs: 0,
    lastPlayerMessageAtMs: null,
    lastEmissionAtMs: null,
    forcedSilenceUntilMs: 0,
    lastEmissionByActor: new Map<string, number>(),
    lastEmissionByContext: new Map<string, number>(),
    lastEmissionByClass: new Map<NpcCadenceActorClass, number>(),
    recentEmissions: [],
    actorBurstCounters: new Map<string, number>(),
    tickEmissionCounter: new Map<number, number>(),
  };
}

function pruneRecentEmissions(
  recent: readonly NpcCadenceRecentEmission[],
  nowMs: number,
  maxAgeMs: number,
  limit: number,
): readonly NpcCadenceRecentEmission[] {
  return Object.freeze(
    recent
      .filter((item) => nowMs - item.emittedAtMs <= maxAgeMs)
      .slice(-limit),
  );
}

function pushRecentEmission(
  memory: NpcCadenceSceneMemory,
  emission: NpcCadenceRecentEmission,
  limit: number,
): void {
  memory.recentEmissions = [...memory.recentEmissions, emission].slice(-limit);
}

function trackBurst(memory: NpcCadenceSceneMemory, actorId: string): void {
  const current = safeNumber(memory.actorBurstCounters.get(actorId), 0);
  memory.actorBurstCounters.set(actorId, current + 1);
}

function decayBurstCounters(memory: NpcCadenceSceneMemory): void {
  for (const [actorId, count] of memory.actorBurstCounters.entries()) {
    if (count <= 1) memory.actorBurstCounters.delete(actorId);
    else memory.actorBurstCounters.set(actorId, count - 1);
  }
}

function markTickEmission(memory: NpcCadenceSceneMemory, tick: number): void {
  const current = safeNumber(memory.tickEmissionCounter.get(tick), 0);
  memory.tickEmissionCounter.set(tick, current + 1);

  for (const [otherTick] of memory.tickEmissionCounter.entries()) {
    if (otherTick < tick - 4) memory.tickEmissionCounter.delete(otherTick);
  }
}

/* ============================================================================
 * MARK: Class budgets and quotas
 * ============================================================================
 */

function cloneBudget(budget: NpcCadenceClassBudget): NpcCadenceClassBudget {
  return Object.freeze({
    maxTotal: budget.maxTotal,
    hater: budget.hater,
    helper: budget.helper,
    ambient: budget.ambient,
  });
}

function computeClassBudget(
  input: NpcCadencePolicyInput,
  tempoBand: NpcCadenceTempoBand,
  config: NpcCadenceConfig,
): NpcCadenceClassBudget {
  const base = cloneBudget(config.tempo[tempoBand].defaultBudget);
  const channel = config.channels[input.channelId];
  const stageMood = resolveStageMood(input);
  const crowdHeat = computeCrowdHeat(input, config);
  const coldStart = isColdStart(input.learning, config.coldStartRunBoundary);
  const rescueOpen = input.rescueOpen
    || input.helperInput?.run.nearBankruptcy
    || input.helperInput?.run.playerLost
    || false;
  const nearSovereignty = input.helperInput?.run.nearSovereignty
    || input.haterInput?.run.nearSovereignty
    || false;

  let hater = base.hater;
  let helper = base.helper;
  let ambient = base.ambient;
  let maxTotal = base.maxTotal;

  if (channel.allowSwarm && crowdHeat >= config.hotCrowdThreshold) {
    ambient += 1;
    maxTotal += 1;
  }

  if (stageMood === 'CEREMONIAL' || input.channelId === 'LOBBY') {
    ambient += 1;
  }

  if (input.channelId === 'DEAL_ROOM') {
    hater += 1;
    ambient = Math.max(0, ambient - 1);
  }

  if (input.channelId === 'SYNDICATE') {
    helper += 1;
    ambient = Math.max(0, ambient - 1);
  }

  if (coldStart) {
    helper += 1;
    maxTotal += 1;
  }

  if (rescueOpen) {
    helper = Math.max(helper, 1);
    maxTotal = Math.max(maxTotal, 2);
    ambient = Math.max(0, ambient - 1);
  }

  if (nearSovereignty) {
    ambient += 1;
    helper = Math.max(helper, 1);
  }

  if (tempoBand === 'FINISHER') {
    hater = Math.max(hater, 1);
    helper = Math.max(helper, 1);
    ambient = Math.max(ambient, 1);
    maxTotal = Math.max(maxTotal, 2);
  }

  if (tempoBand === 'CRISIS') {
    hater = Math.max(hater, 1);
    helper = Math.max(helper, 1);
    maxTotal = Math.max(maxTotal, 2);
  }

  if (stageMood === 'CALM' && tempoBand === 'LOW') {
    hater = Math.max(0, hater - 1);
  }

  return Object.freeze({
    maxTotal: Math.max(0, maxTotal),
    hater: Math.max(0, hater),
    helper: Math.max(0, helper),
    ambient: Math.max(0, ambient),
  });
}

/* ============================================================================
 * MARK: Delay shaping
 * ============================================================================
 */

function randomBetween(min: number, max: number, rng: () => number): number {
  if (max <= min) return min;
  return Math.round(min + (max - min) * rng());
}

function resolveDeliveryLane(
  lane: string,
): NpcCadenceDeliveryLane {
  switch (lane) {
    case 'PRIVATE':
      return 'PRIVATE';
    case 'WHISPER':
      return 'WHISPER';
    case 'BANNER':
      return 'BANNER';
    case 'SHADOW':
      return 'SHADOW';
    default:
      return 'PUBLIC';
  }
}

function computeTempoDelayScalar(
  tempoBand: NpcCadenceTempoBand,
): number {
  switch (tempoBand) {
    case 'CEREMONIAL':
      return 1.35;
    case 'LOW':
      return 1.18;
    case 'STEADY':
      return 1.00;
    case 'PRESSURE':
      return 0.88;
    case 'CRISIS':
      return 0.72;
    case 'FINISHER':
      return 0.64;
    default:
      return 1;
  }
}

function computeLaneDelayScalar(
  lane: NpcCadenceDeliveryLane,
): number {
  switch (lane) {
    case 'BANNER':
      return 0.72;
    case 'PRIVATE':
      return 0.88;
    case 'WHISPER':
      return 0.94;
    case 'SHADOW':
      return 0.78;
    case 'PUBLIC':
    default:
      return 1.00;
  }
}

function computeClassDelayBias(
  actorClass: NpcCadenceActorClass,
): number {
  switch (actorClass) {
    case 'HATER':
      return 1.00;
    case 'HELPER':
      return 0.92;
    case 'AMBIENT':
      return 1.16;
    default:
      return 1;
  }
}

function computeFinalDelayMs(
  candidate: NpcCadenceCandidate,
  tempoBand: NpcCadenceTempoBand,
  input: NpcCadencePolicyInput,
  config: NpcCadenceConfig,
  rng: () => number,
): number {
  const laneScalar = computeLaneDelayScalar(candidate.deliveryLane);
  const tempoScalar = computeTempoDelayScalar(tempoBand);
  const classBias = computeClassDelayBias(candidate.actorClass);
  const stageMood = resolveStageMood(input);
  const rescueOpen = input.rescueOpen
    || input.helperInput?.run.nearBankruptcy
    || input.helperInput?.run.playerLost
    || false;

  let delay = Math.round(candidate.initialDelayMs * laneScalar * tempoScalar * classBias);

  if (candidate.actorClass === 'HATER' && tempoBand === 'CRISIS') {
    delay = Math.max(180, delay - config.haterEmergencyAccelerationMs);
  }

  if (candidate.actorClass === 'HELPER' && rescueOpen) {
    delay = Math.max(120, delay - config.helperEmergencyAccelerationMs);
  }

  if (candidate.actorClass === 'AMBIENT') {
    delay = randomBetween(
      config.ambientWitnessDelayFloorMs,
      config.ambientWitnessDelayCeilMs,
      rng,
    );
  }

  if (stageMood === 'CEREMONIAL' && candidate.actorClass === 'AMBIENT') {
    delay = Math.max(delay, 1_050);
  }

  if (input.legendJustOccurred && candidate.actorClass !== 'AMBIENT') {
    delay = Math.max(delay, config.legendGraceMs);
  }

  if (candidate.context === 'PLAYER_LOST' || candidate.context === 'POST_RUN_FAIL') {
    delay = Math.max(delay, config.postLossWitnessMs);
  }

  return Math.max(90, delay);
}

/* ============================================================================
 * MARK: Candidate construction from planner outputs
 * ============================================================================
 */

function normalizeHaterCandidates(
  input: NpcCadencePolicyInput,
): readonly NpcCadenceCandidate[] {
  if (input.allowHaters === false || !input.haterInput) return Object.freeze([]);
  const plans = haterResponsePlanner.plan(input.haterInput);

  return Object.freeze(
    plans
      .filter((plan) => plan.line !== null)
      .map((plan) =>
        Object.freeze({
          actorClass: 'HATER' as const,
          actorId: plan.haterId,
          actorDisplayName: plan.displayName,
          context: plan.context,
          text: plan.line?.text ?? '',
          deliveryLane: plan.deliveryLane === 'SHADOW'
            ? 'SHADOW'
            : plan.deliveryLane === 'WHISPER'
              ? 'WHISPER'
              : 'PUBLIC',
          plannerBase: safeNumber(plan.score.total, 0),
          initialDelayMs: Math.max(120, safeNumber(plan.delayMs, 800)),
          source: Object.freeze({ kind: 'HATER' as const, plan }),
        }),
      ),
  );
}

function normalizeHelperCandidates(
  input: NpcCadencePolicyInput,
): readonly NpcCadenceCandidate[] {
  if (input.allowHelpers === false || !input.helperInput) return Object.freeze([]);
  const plans = helperResponsePlanner.plan(input.helperInput);

  return Object.freeze(
    plans
      .filter((plan) => plan.line !== null)
      .map((plan) =>
        Object.freeze({
          actorClass: 'HELPER' as const,
          actorId: plan.helperId,
          actorDisplayName: plan.displayName,
          context: plan.context,
          text: plan.line?.text ?? '',
          deliveryLane: resolveDeliveryLane(plan.deliveryLane),
          plannerBase: safeNumber(plan.score.total, 0),
          initialDelayMs: Math.max(100, safeNumber(plan.delayMs, 650)),
          source: Object.freeze({ kind: 'HELPER' as const, plan }),
        }),
      ),
  );
}

function buildAmbientContextQueue(
  input: NpcCadencePolicyInput,
  config: NpcCadenceConfig,
): readonly AmbientDialogueContext[] {
  const explicit = ensureArray(input.ambientRequestedContexts);
  if (explicit.length > 0) return uniqueAmbientContexts(explicit);

  const queue: AmbientDialogueContext[] = [];
  const crowdHeat = computeCrowdHeat(input, config);
  const rescueOpen = input.rescueOpen || input.helperInput?.run.nearBankruptcy || input.helperInput?.run.playerLost || false;
  const nearSovereignty = input.helperInput?.run.nearSovereignty || input.haterInput?.run.nearSovereignty || false;
  const channelId = input.channelId;

  if (channelId === 'LOBBY') queue.push('QUEUE_FORMING', 'LOBBY_TAUNT');
  if (channelId === 'SYNDICATE') queue.push('SYNDICATE_SIGNAL');
  if (channelId === 'DEAL_ROOM') queue.push('DEAL_SILENCE');

  if (input.helperInput?.run.playerIncomeRoseThisWindow || input.haterInput?.run.playerIncomeRoseThisWindow) {
    queue.push('PLAYER_INCOME_UP');
  }

  if (input.helperInput?.run.playerPlayedCardThisWindow || input.haterInput?.run.playerPlayedCardThisWindow) {
    queue.push('PLAYER_CARD_PLAY');
  }

  if (input.helperInput?.run.playerTriggeredCascadeThisWindow || input.haterInput?.run.playerTriggeredCascadeThisWindow) {
    queue.push('CASCADE_CHAIN');
  }

  if (input.helperInput?.run.playerComebackThisWindow || input.haterInput?.run.playerComebackThisWindow) {
    queue.push('PLAYER_COMEBACK', 'ROOM_RECOGNITION');
  }

  if (rescueOpen) {
    queue.push('PLAYER_NEAR_BANKRUPTCY');
    queue.push('POST_RUN_FAIL');
  }

  if (crowdHeat >= config.hotCrowdThreshold) {
    queue.push('CHANNEL_HEAT_RISING');
  } else if (crowdHeat <= 0.24) {
    queue.push('CHANNEL_HEAT_BREAKING');
  }

  if (nearSovereignty || input.legendJustOccurred) {
    queue.push('NEAR_SOVEREIGNTY', 'ROOM_RECOGNITION', 'POST_RUN_WIN');
  }

  if (input.haterInput?.run.playerLost || input.helperInput?.run.playerLost) {
    queue.push('PLAYER_LOST', 'POST_RUN_FAIL');
  }

  if (queue.length === 0) {
    if (channelId === 'GLOBAL') queue.push('ROOM_RECOGNITION');
    else if (channelId === 'DEAL_ROOM') queue.push('DEAL_SILENCE');
    else if (channelId === 'SYNDICATE') queue.push('SYNDICATE_SIGNAL');
    else queue.push('QUEUE_FORMING');
  }

  return uniqueAmbientContexts(queue);
}

function buildAmbientCandidates(
  input: NpcCadencePolicyInput,
  config: NpcCadenceConfig,
): readonly NpcCadenceCandidate[] {
  if (input.allowAmbient === false) return Object.freeze([]);

  const rng = input.rng ?? Math.random;
  const requestedContexts = buildAmbientContextQueue(input, config);
  const suppressed = new Set<AmbientNpcId>(input.ambientSuppressedIds ?? []);
  const usedLineTexts = input.ambientUsedLineTexts;
  const out: NpcCadenceCandidate[] = [];

  for (const context of requestedContexts) {
    const actorIds = listAmbientActorsForContext(
      context,
      input.channelId,
      input.runMode,
      {
        crowdHeat: computeCrowdHeat(input, config),
        rescueOpen: input.rescueOpen || input.helperInput?.run.nearBankruptcy || false,
        dealTension: input.dealTension,
      },
    );

    for (const ambientId of actorIds) {
      if (suppressed.has(ambientId)) continue;
      if (!ambientCanSpeakInChannel(ambientId, input.channelId)) continue;

      const registryEntry = getAllAmbientRegistryEntries().find((entry) => entry.ambientId === ambientId);
      if (!registryEntry) continue;

      const selection = pickAmbientDialogueLine({
        ambientId,
        requestedContext: context,
        currentTick: input.tick,
        channelId: input.channelId,
        runMode: input.runMode,
        crowdHeat: computeCrowdHeat(input, config),
        rescueOpen: input.rescueOpen || input.helperInput?.run.nearBankruptcy || false,
        dealTension: input.dealTension,
        usedLineTexts,
        rng,
      });

      if (!selection.line) continue;

      const plannerBase =
        registryEntry.channelPolicy.publicWeight * 0.18
        + registryEntry.channelPolicy.privateWeight * 0.12
        + registryEntry.heatSensitivity * computeCrowdHeat(input, config) * 0.18
        + registryEntry.modeAffinity.solo * 0.04;

      out.push(
        Object.freeze({
          actorClass: 'AMBIENT' as const,
          actorId: ambientId,
          actorDisplayName: registryEntry.displayName,
          context,
          text: selection.line.text,
          deliveryLane: isShadowChannel(input.channelId) ? 'SHADOW' : 'PUBLIC',
          plannerBase,
          initialDelayMs: registryEntry.cadence.floorMs,
          source: Object.freeze({
            kind: 'AMBIENT' as const,
            ambientId,
            context,
            registryEntry,
          }),
        }),
      );
    }
  }

  return Object.freeze(out);
}

/* ============================================================================
 * MARK: Candidate scoring
 * ============================================================================
 */

function computeClassFit(
  candidate: NpcCadenceCandidate,
  input: NpcCadencePolicyInput,
  config: NpcCadenceConfig,
): number {
  const channel = config.channels[input.channelId];

  switch (candidate.actorClass) {
    case 'HATER':
      return channel.haterBias * 0.18;
    case 'HELPER':
      return channel.helperBias * 0.18;
    case 'AMBIENT':
      return channel.ambientBias * 0.18;
    default:
      return 0;
  }
}

function computeChannelFit(
  candidate: NpcCadenceCandidate,
  input: NpcCadencePolicyInput,
  config: NpcCadenceConfig,
): number {
  const channel = config.channels[input.channelId];
  const publicFactor = candidate.deliveryLane === 'PUBLIC' || candidate.deliveryLane === 'BANNER'
    ? channel.publicWeight
    : channel.privateWeight;
  return publicFactor * 0.16;
}

function computeHeatFit(
  candidate: NpcCadenceCandidate,
  input: NpcCadencePolicyInput,
  config: NpcCadenceConfig,
): number {
  const heat = computeCrowdHeat(input, config);

  if (candidate.actorClass === 'AMBIENT') {
    return heat * config.channels[input.channelId].crowdBias * 0.16;
  }

  if (candidate.actorClass === 'HATER') {
    const aggression = clamp01(safeNumber(input.learning?.preferredAggressionLevel, 0));
    return (heat * 0.10) + (aggression * 0.08);
  }

  return heat * 0.04;
}

function computeRescueFit(
  candidate: NpcCadenceCandidate,
  input: NpcCadencePolicyInput,
): number {
  const rescueOpen = input.rescueOpen
    || input.helperInput?.run.nearBankruptcy
    || input.helperInput?.run.playerLost
    || false;

  if (!rescueOpen) return 0;

  if (candidate.actorClass === 'HELPER') {
    return candidate.context === 'PLAYER_NEAR_BANKRUPTCY' || candidate.context === 'PLAYER_LOST'
      ? 0.32
      : 0.14;
  }

  if (candidate.actorClass === 'AMBIENT') {
    return candidate.context === 'POST_RUN_FAIL' || candidate.context === 'PLAYER_NEAR_BANKRUPTCY'
      ? 0.10
      : 0;
  }

  if (candidate.actorClass === 'HATER') {
    return candidate.context === 'PLAYER_NEAR_BANKRUPTCY' ? 0.06 : 0;
  }

  return 0;
}

function computeSilenceFit(
  candidate: NpcCadenceCandidate,
  input: NpcCadencePolicyInput,
  config: NpcCadenceConfig,
): number {
  const silenceBand = computeSilenceBand(input, config);
  const silenceRate = clamp01(safeNumber(input.learning?.silenceRate, 0));
  const channelSilencePreference = config.channels[input.channelId].silencePreference * 0.08;

  switch (silenceBand) {
    case 'HIGH':
      if (candidate.actorClass === 'HELPER') return 0.18 + silenceRate * 0.08;
      if (candidate.actorClass === 'AMBIENT') return 0.04;
      return -0.04 + channelSilencePreference;
    case 'MEDIUM':
      if (candidate.actorClass === 'HELPER') return 0.10 + silenceRate * 0.05;
      if (candidate.actorClass === 'AMBIENT') return 0.02;
      return 0;
    case 'LOW':
      return candidate.actorClass === 'AMBIENT' ? 0.04 : 0;
    case 'NONE':
    default:
      return 0;
  }
}

function computeCeremonyFit(
  candidate: NpcCadenceCandidate,
  input: NpcCadencePolicyInput,
  tempoBand: NpcCadenceTempoBand,
  config: NpcCadenceConfig,
): number {
  const stageMood = resolveStageMood(input);
  const ceremonyBias = config.channels[input.channelId].ceremonyBias;

  if (tempoBand === 'CEREMONIAL' || stageMood === 'CEREMONIAL') {
    if (candidate.actorClass === 'AMBIENT') return ceremonyBias * 0.18;
    if (candidate.actorClass === 'HELPER') return ceremonyBias * 0.08;
    return 0;
  }

  if (tempoBand === 'FINISHER' && input.legendJustOccurred) {
    if (candidate.actorClass === 'AMBIENT') return 0.12;
    if (candidate.actorClass === 'HELPER') return 0.08;
  }

  return 0;
}

function computeRepeatPenalty(
  memory: NpcCadenceSceneMemory,
  candidate: NpcCadenceCandidate,
  input: NpcCadencePolicyInput,
  tempoBand: NpcCadenceTempoBand,
  config: NpcCadenceConfig,
): number {
  const tempo = config.tempo[tempoBand];
  const channel = config.channels[input.channelId];
  const actorRepeatGapMs = tempo.actorRepeatGapMs * channel.actorRepeatScalar;
  const contextRepeatGapMs = tempo.contextRepeatGapMs * channel.contextRepeatScalar;
  const actorLast = memory.lastEmissionByActor.get(candidate.actorId);
  const contextLast = memory.lastEmissionByContext.get(`${input.channelId}:${candidate.context}`);

  let penalty = 0;

  if (actorLast !== undefined) {
    const since = input.nowMs - actorLast;
    if (since < actorRepeatGapMs) {
      penalty += clamp01(1 - (since / actorRepeatGapMs)) * 0.42;
    }
  }

  if (contextLast !== undefined) {
    const since = input.nowMs - contextLast;
    if (since < contextRepeatGapMs) {
      penalty += clamp01(1 - (since / contextRepeatGapMs)) * 0.36;
    }
  }

  return penalty;
}

function computeBurstPenalty(
  memory: NpcCadenceSceneMemory,
  candidate: NpcCadenceCandidate,
  tempoBand: NpcCadenceTempoBand,
  config: NpcCadenceConfig,
): number {
  const tempo = config.tempo[tempoBand];
  const burstCount = safeNumber(memory.actorBurstCounters.get(candidate.actorId), 0);

  if (burstCount <= 0) return 0;
  if (burstCount >= tempo.maxBurstPerActor) return 0.30;
  return burstCount * 0.12;
}

function computeCooldownPenalty(
  memory: NpcCadenceSceneMemory,
  input: NpcCadencePolicyInput,
  tempoBand: NpcCadenceTempoBand,
  config: NpcCadenceConfig,
): number {
  const lastEmissionAtMs = memory.lastEmissionAtMs;
  if (lastEmissionAtMs === null) return 0;

  const tempo = config.tempo[tempoBand];
  const channel = config.channels[input.channelId];
  const minGapMs = tempo.minGapMs * channel.minGapScalar;
  const since = input.nowMs - lastEmissionAtMs;

  if (since >= minGapMs) return 0;
  return clamp01(1 - (since / minGapMs)) * 0.56;
}

function computeCandidateScore(
  memory: NpcCadenceSceneMemory,
  candidate: NpcCadenceCandidate,
  input: NpcCadencePolicyInput,
  tempoBand: NpcCadenceTempoBand,
  config: NpcCadenceConfig,
): NpcCadenceDecisionScore {
  const plannerBase = candidate.plannerBase;
  const tempoFit = (() => {
    const tempo = config.tempo[tempoBand];
    switch (candidate.actorClass) {
      case 'HATER':
        return tempo.haterScalar * 0.16;
      case 'HELPER':
        return tempo.helperScalar * 0.16;
      case 'AMBIENT':
        return tempo.ambientScalar * 0.16;
      default:
        return 0;
    }
  })();

  const channelFit = computeChannelFit(candidate, input, config);
  const classFit = computeClassFit(candidate, input, config);
  const heatFit = computeHeatFit(candidate, input, config);
  const rescueFit = computeRescueFit(candidate, input);
  const silenceFit = computeSilenceFit(candidate, input, config);
  const ceremonyFit = computeCeremonyFit(candidate, input, tempoBand, config);
  const repeatPenalty = computeRepeatPenalty(memory, candidate, input, tempoBand, config);
  const burstPenalty = computeBurstPenalty(memory, candidate, tempoBand, config);
  const cooldownPenalty = computeCooldownPenalty(memory, input, tempoBand, config);

  const total =
    plannerBase
    + tempoFit
    + channelFit
    + classFit
    + heatFit
    + rescueFit
    + silenceFit
    + ceremonyFit
    - repeatPenalty
    - burstPenalty
    - cooldownPenalty;

  return Object.freeze({
    plannerBase,
    tempoFit,
    channelFit,
    classFit,
    heatFit,
    rescueFit,
    silenceFit,
    ceremonyFit,
    repeatPenalty,
    burstPenalty,
    cooldownPenalty,
    total,
  });
}

/* ============================================================================
 * MARK: Reason resolution and lane arbitration
 * ============================================================================
 */

function inferCandidateReasons(
  candidate: NpcCadenceCandidate,
  input: NpcCadencePolicyInput,
  tempoBand: NpcCadenceTempoBand,
  config: NpcCadenceConfig,
): readonly NpcCadenceDecisionReason[] {
  const reasons: NpcCadenceDecisionReason[] = ['tempo-band', 'class-quota'];
  const rescueOpen = input.rescueOpen
    || input.helperInput?.run.nearBankruptcy
    || input.helperInput?.run.playerLost
    || false;
  const coldStart = isColdStart(input.learning, config.coldStartRunBoundary);
  const silenceBand = computeSilenceBand(input, config);
  const channelId = input.channelId;

  if (input.worldEventActive) reasons.push('world-event');
  if (coldStart && candidate.actorClass === 'HELPER') reasons.push('cold-start');
  if (rescueOpen && candidate.actorClass === 'HELPER') reasons.push('rescue-preemption');
  if (candidate.actorClass === 'HATER' && (tempoBand === 'PRESSURE' || tempoBand === 'CRISIS' || tempoBand === 'FINISHER')) {
    reasons.push('heat-escalation');
  }
  if (candidate.actorClass === 'AMBIENT') reasons.push('ambient-texture');

  if (candidate.actorClass === 'HELPER') {
    if (candidate.context === 'PLAYER_NEAR_BANKRUPTCY' || candidate.context === 'PLAYER_LOST') reasons.push('rescue-preemption');
    if (candidate.context === 'PLAYER_IDLE' || candidate.context === 'TIME_PRESSURE' || candidate.context === 'NEAR_SOVEREIGNTY') reasons.push('coach-window');
    if (candidate.context === 'PLAYER_COMEBACK' || candidate.context === 'PLAYER_INCOME_UP') reasons.push('morale-window');
    if (candidate.context === 'PLAYER_CARD_PLAY' || candidate.context === 'CASCADE_CHAIN') reasons.push('intel-window');
  }

  if (candidate.actorClass === 'AMBIENT') {
    if (candidate.context === 'ROOM_RECOGNITION' || candidate.context === 'CHANNEL_HEAT_RISING') reasons.push('crowd-witness');
    if (candidate.context === 'DEAL_SILENCE') reasons.push('deal-pressure');
    if (candidate.context === 'QUEUE_FORMING' || candidate.context === 'LOBBY_TAUNT') reasons.push('lobby-ceremony');
    if (candidate.context === 'POST_RUN_FAIL' || candidate.context === 'PLAYER_LOST') reasons.push('post-loss-witness');
    if (candidate.context === 'POST_RUN_WIN' || candidate.context === 'NEAR_SOVEREIGNTY') reasons.push('sovereignty-ceremony');
  }

  if (input.legendJustOccurred) reasons.push('legend-echo');
  if (silenceBand === 'HIGH') reasons.push('silence-preferred');
  if (channelId === 'DEAL_ROOM') reasons.push('deal-pressure');
  if (channelId === 'LOBBY') reasons.push('lobby-ceremony');

  return uniqueStrings(reasons) as readonly NpcCadenceDecisionReason[];
}

function candidateFitsBudget(
  candidate: NpcCadenceCandidate,
  selected: readonly NpcCadenceDecision[],
  budget: NpcCadenceClassBudget,
): boolean {
  const haterCount = selected.filter((item) => item.actorClass === 'HATER').length;
  const helperCount = selected.filter((item) => item.actorClass === 'HELPER').length;
  const ambientCount = selected.filter((item) => item.actorClass === 'AMBIENT').length;

  if (selected.length >= budget.maxTotal) return false;
  if (candidate.actorClass === 'HATER' && haterCount >= budget.hater) return false;
  if (candidate.actorClass === 'HELPER' && helperCount >= budget.helper) return false;
  if (candidate.actorClass === 'AMBIENT' && ambientCount >= budget.ambient) return false;
  return true;
}

function shouldHoldForPlayerGrace(
  memory: NpcCadenceSceneMemory,
  candidate: NpcCadenceCandidate,
  input: NpcCadencePolicyInput,
  config: NpcCadenceConfig,
): boolean {
  const lastPlayerMessageAtMs = memory.lastPlayerMessageAtMs;
  if (lastPlayerMessageAtMs === null) return false;

  const since = input.nowMs - lastPlayerMessageAtMs;
  const rescueOpen = input.rescueOpen
    || input.helperInput?.run.nearBankruptcy
    || input.helperInput?.run.playerLost
    || false;

  if (candidate.actorClass === 'HELPER' && rescueOpen) {
    return since < config.rescueGraceMs;
  }

  if (input.legendJustOccurred) {
    return since < config.legendGraceMs;
  }

  return since < config.playerGraceMs;
}

function shouldRespectForcedSilence(
  memory: NpcCadenceSceneMemory,
  input: NpcCadencePolicyInput,
): boolean {
  return input.nowMs < memory.forcedSilenceUntilMs;
}

/* ============================================================================
 * MARK: Policy class
 * ============================================================================
 */

export class NpcCadencePolicy {
  private readonly config: NpcCadenceConfig;
  private readonly scenes = new Map<string, NpcCadenceSceneMemory>();

  constructor(config?: Partial<NpcCadenceConfig>) {
    this.config = Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG,
      ...(config ?? {}),
      tempo: Object.freeze({
        ...DEFAULT_NPC_CADENCE_CONFIG.tempo,
        ...(config?.tempo ?? {}),
      }),
      channels: Object.freeze({
        ...DEFAULT_NPC_CADENCE_CONFIG.channels,
        ...(config?.channels ?? {}),
      }),
    });
  }

  public reset(): void {
    this.scenes.clear();
  }

  public notePlayerMessage(
    channelId: ChatChannelId,
    atMs: number,
    sceneId = `${channelId}:default`,
  ): void {
    const memory = this.ensureScene(sceneId, channelId, atMs);
    memory.lastPlayerMessageAtMs = atMs;
  }

  public forceSilence(
    channelId: ChatChannelId,
    untilMs: number,
    sceneId = `${channelId}:default`,
  ): void {
    const memory = this.ensureScene(sceneId, channelId, untilMs);
    memory.forcedSilenceUntilMs = Math.max(memory.forcedSilenceUntilMs, untilMs);
  }

  public noteEmission(decision: NpcCadenceDecision, sceneId?: string): void {
    const resolvedSceneId = sceneId ?? `${decision.channelId}:default`;
    const memory = this.ensureScene(resolvedSceneId, decision.channelId, decision.speakAtMs);

    memory.lastEmissionAtMs = decision.speakAtMs;
    memory.lastEmissionByActor.set(decision.actorId, decision.speakAtMs);
    memory.lastEmissionByClass.set(decision.actorClass, decision.speakAtMs);
    memory.lastEmissionByContext.set(`${decision.channelId}:${decision.context}`, decision.speakAtMs);
    pushRecentEmission(
      memory,
      Object.freeze({
        actorClass: decision.actorClass,
        actorId: decision.actorId,
        channelId: decision.channelId,
        context: decision.context,
        text: decision.text,
        emittedAtMs: decision.speakAtMs,
        sceneId: resolvedSceneId,
      }),
      this.config.emissionHistoryLimit,
    );
    trackBurst(memory, decision.actorId);
  }

  public getSnapshot(): NpcCadenceSnapshot {
    return Object.freeze({
      sceneCount: this.scenes.size,
      scenes: Object.freeze(
        [...this.scenes.values()].map((memory) =>
          Object.freeze({
            sceneId: memory.sceneId,
            channelId: memory.channelId,
            lastPassAtMs: memory.lastPassAtMs,
            lastPlayerMessageAtMs: memory.lastPlayerMessageAtMs,
            lastEmissionAtMs: memory.lastEmissionAtMs,
            forcedSilenceUntilMs: memory.forcedSilenceUntilMs,
            recentEmissions: memory.recentEmissions.length,
          }),
        ),
      ),
    });
  }

  public planPass(input: NpcCadencePolicyInput): NpcCadencePassResult {
    const sceneId = asSceneId(input);
    const memory = this.ensureScene(sceneId, input.channelId, input.nowMs);
    const tempoBand = resolveTempoBand(input, this.config);
    const classBudget = computeClassBudget(input, tempoBand, this.config);
    const suppressedReasons: string[] = [];
    const rng = input.rng ?? Math.random;

    memory.lastPassAtMs = input.nowMs;
    memory.recentEmissions = [...pruneRecentEmissions(memory.recentEmissions, input.nowMs, 60_000, this.config.emissionHistoryLimit)];
    decayBurstCounters(memory);

    if (shouldRespectForcedSilence(memory, input)) {
      suppressedReasons.push('forced-silence');
      return Object.freeze({
        tempoBand,
        classBudget,
        decisions: Object.freeze([]),
        suppressedReasons: Object.freeze(suppressedReasons),
      });
    }

    const rawCandidates = Object.freeze([
      ...normalizeHaterCandidates(input),
      ...normalizeHelperCandidates(input),
      ...buildAmbientCandidates(input, this.config),
    ]);

    if (rawCandidates.length === 0) {
      suppressedReasons.push('no-candidates');
      return Object.freeze({
        tempoBand,
        classBudget,
        decisions: Object.freeze([]),
        suppressedReasons: Object.freeze(suppressedReasons),
      });
    }

    const scored = rawCandidates.map((candidate) => {
      const score = computeCandidateScore(memory, candidate, input, tempoBand, this.config);
      const reasons = inferCandidateReasons(candidate, input, tempoBand, this.config);
      return Object.freeze({ candidate, score, reasons });
    });

    const sorted = Object.freeze(
      [...scored].sort((a, b) => {
        if (b.score.total !== a.score.total) return b.score.total - a.score.total;

        if (a.candidate.actorClass !== b.candidate.actorClass) {
          const priority = { HELPER: 3, HATER: 2, AMBIENT: 1 } as const;
          return priority[b.candidate.actorClass] - priority[a.candidate.actorClass];
        }

        return a.candidate.initialDelayMs - b.candidate.initialDelayMs;
      }),
    );

    const selected: NpcCadenceDecision[] = [];

    for (const item of sorted) {
      const { candidate, score, reasons } = item;
      if (score.total <= 0) {
        suppressedReasons.push(`score<=0:${candidate.actorId}:${candidate.context}`);
        continue;
      }

      if (!candidateFitsBudget(candidate, selected, classBudget)) {
        suppressedReasons.push(`budget:${candidate.actorId}:${candidate.actorClass}`);
        continue;
      }

      if (shouldHoldForPlayerGrace(memory, candidate, input, this.config)) {
        suppressedReasons.push(`player-grace:${candidate.actorId}:${candidate.actorClass}`);
        continue;
      }

      const finalDelayMs = computeFinalDelayMs(candidate, tempoBand, input, this.config, rng);
      const speakAtMs = input.nowMs + finalDelayMs;

      const decision: NpcCadenceDecision = Object.freeze({
        actorClass: candidate.actorClass,
        actorId: candidate.actorId,
        actorDisplayName: candidate.actorDisplayName,
        channelId: input.channelId,
        context: candidate.context,
        text: candidate.text,
        delayMs: finalDelayMs,
        speakAtMs,
        deliveryLane: candidate.deliveryLane,
        score,
        tempoBand,
        reasons,
        source: candidate.source,
      });

      selected.push(decision);
      this.noteEmission(decision, sceneId);
      markTickEmission(memory, input.tick);

      if (selected.length >= classBudget.maxTotal) break;
    }

    if (selected.length === 0) suppressedReasons.push('all-suppressed');

    return Object.freeze({
      tempoBand,
      classBudget,
      decisions: Object.freeze(selected),
      suppressedReasons: Object.freeze(uniqueStrings(suppressedReasons)),
    });
  }

  public planAndCommit(input: NpcCadencePolicyInput): readonly NpcCadenceDecision[] {
    return this.planPass(input).decisions;
  }

  public explainWhySilent(input: NpcCadencePolicyInput): readonly string[] {
    const result = this.planPass(input);
    if (result.decisions.length > 0) {
      return Object.freeze(['not-silent']);
    }
    return result.suppressedReasons;
  }

  private ensureScene(
    sceneId: string,
    channelId: ChatChannelId,
    nowMs: number,
  ): NpcCadenceSceneMemory {
    let memory = this.scenes.get(sceneId);
    if (!memory) {
      memory = createSceneMemory(sceneId, channelId, nowMs);
      this.scenes.set(sceneId, memory);
      this.enforceSceneLimit();
    }
    return memory;
  }

  private enforceSceneLimit(): void {
    if (this.scenes.size <= this.config.sceneMemoryLimit) return;

    const ordered = [...this.scenes.values()]
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    while (ordered.length > this.config.sceneMemoryLimit) {
      const oldest = ordered.shift();
      if (!oldest) break;
      this.scenes.delete(oldest.sceneId);
    }
  }
}

/* ============================================================================
 * MARK: Stateless convenience exports
 * ============================================================================
 */

export const npcCadencePolicy = Object.freeze(new NpcCadencePolicy());

export function planNpcCadence(
  input: NpcCadencePolicyInput,
): NpcCadencePassResult {
  return npcCadencePolicy.planPass(input);
}

export function planNpcCadenceDecisions(
  input: NpcCadencePolicyInput,
): readonly NpcCadenceDecision[] {
  return npcCadencePolicy.planPass(input).decisions;
}

export function explainNpcCadenceSilence(
  input: NpcCadencePolicyInput,
): readonly string[] {
  return npcCadencePolicy.explainWhySilent(input);
}

/* ============================================================================
 * MARK: Rich helper exports for directors / tests / future backend parity
 * ============================================================================
 */

export function resolveNpcCadenceTempoBand(
  input: NpcCadencePolicyInput,
  config?: Partial<NpcCadenceConfig>,
): NpcCadenceTempoBand {
  const merged = Object.freeze({
    ...DEFAULT_NPC_CADENCE_CONFIG,
    ...(config ?? {}),
    tempo: Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG.tempo,
      ...(config?.tempo ?? {}),
    }),
    channels: Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG.channels,
      ...(config?.channels ?? {}),
    }),
  }) as NpcCadenceConfig;
  return resolveTempoBand(input, merged);
}

export function computeNpcCadenceBudget(
  input: NpcCadencePolicyInput,
  config?: Partial<NpcCadenceConfig>,
): NpcCadenceClassBudget {
  const merged = Object.freeze({
    ...DEFAULT_NPC_CADENCE_CONFIG,
    ...(config ?? {}),
    tempo: Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG.tempo,
      ...(config?.tempo ?? {}),
    }),
    channels: Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG.channels,
      ...(config?.channels ?? {}),
    }),
  }) as NpcCadenceConfig;

  const tempoBand = resolveTempoBand(input, merged);
  return computeClassBudget(input, tempoBand, merged);
}

export function buildNpcAmbientContextQueue(
  input: NpcCadencePolicyInput,
  config?: Partial<NpcCadenceConfig>,
): readonly AmbientDialogueContext[] {
  const merged = Object.freeze({
    ...DEFAULT_NPC_CADENCE_CONFIG,
    ...(config ?? {}),
    tempo: Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG.tempo,
      ...(config?.tempo ?? {}),
    }),
    channels: Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG.channels,
      ...(config?.channels ?? {}),
    }),
  }) as NpcCadenceConfig;

  return buildAmbientContextQueue(input, merged);
}

export function scoreNpcCadenceCandidate(
  input: NpcCadencePolicyInput,
  candidate: NpcCadenceCandidate,
  options?: {
    readonly sceneId?: string;
    readonly config?: Partial<NpcCadenceConfig>;
  },
): NpcCadenceDecisionScore {
  const merged = Object.freeze({
    ...DEFAULT_NPC_CADENCE_CONFIG,
    ...(options?.config ?? {}),
    tempo: Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG.tempo,
      ...(options?.config?.tempo ?? {}),
    }),
    channels: Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG.channels,
      ...(options?.config?.channels ?? {}),
    }),
  }) as NpcCadenceConfig;

  const tempoBand = resolveTempoBand(input, merged);
  const memory = createSceneMemory(
    options?.sceneId ?? asSceneId(input),
    input.channelId,
    input.nowMs,
  );

  return computeCandidateScore(memory, candidate, input, tempoBand, merged);
}

export function normalizeNpcCadenceCandidates(
  input: NpcCadencePolicyInput,
  config?: Partial<NpcCadenceConfig>,
): readonly NpcCadenceCandidate[] {
  const merged = Object.freeze({
    ...DEFAULT_NPC_CADENCE_CONFIG,
    ...(config ?? {}),
    tempo: Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG.tempo,
      ...(config?.tempo ?? {}),
    }),
    channels: Object.freeze({
      ...DEFAULT_NPC_CADENCE_CONFIG.channels,
      ...(config?.channels ?? {}),
    }),
  }) as NpcCadenceConfig;

  return Object.freeze([
    ...normalizeHaterCandidates(input),
    ...normalizeHelperCandidates(input),
    ...buildAmbientCandidates(input, merged),
  ]);
}

/* ============================================================================
 * MARK: Notes for future backend parity
 * ============================================================================
 *
 * The backend counterpart should mirror the same high-level cadence doctrine,
 * but move final timing authority, transcript-linked repeat suppression,
 * world-event scheduling, and replay-sourced callback timing into:
 *
 *   /backend/src/game/engine/chat/npc/NpcCadencePolicy.ts
 *
 * Server fanout should remain a servant:
 *
 *   /pzo-server/src/chat/*
 *
 * Frontend should stay the optimistic preview lane:
 * - fast enough to feel immediate,
 * - structured enough to remain deterministic-friendly,
 * - strict enough not to spam,
 * - expressive enough to preserve your “chat as emotional game director”
 *   doctrine.
 * ============================================================================
 */
