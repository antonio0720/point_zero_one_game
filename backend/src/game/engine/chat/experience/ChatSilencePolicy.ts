/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SILENCE POLICY
 * FILE: backend/src/game/engine/chat/experience/ChatSilencePolicy.ts
 * VERSION: 2026.03.18
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend policy layer that decides when silence is stronger than
 * text, when a scene must hold before reveal, when a helper must wait before
 * rescue, when the crowd should be delayed to preserve dread, and when visible
 * delivery should yield to shadow preparation.
 *
 * This file does not emit messages and does not own archival truth. It computes
 * hold / gap / reveal / interruption policy so the drama orchestrator can stage
 * scenes with intentional breathing room.
 */

import type {
  SharedChatMomentType,
  SharedChatSceneArchetype,
  SharedChatSceneBeat,
  SharedChatSceneBeatType,
  SharedChatScenePlan,
  SharedPressureTier,
} from '../../../../../../shared/contracts/chat/scene';

import { CHAT_RUNTIME_DEFAULTS } from '../types';

import type {
  ChatChannelId,
  ChatRuntimeConfig,
  ChatShadowChannel,
  ChatVisibleChannel,
} from '../types';

/* ============================================================================
 * MARK: scalar helpers
 * ============================================================================
 */

function now(): number {
  return Date.now();
}

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function uniq<T>(values: readonly T[]): readonly T[] {
  const out: T[] = [];
  const seen = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function normalizeVisibleChannel(value: string | undefined | null): ChatVisibleChannel {
  const upper = String(value ?? '').toUpperCase();
  switch (upper) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return upper;
    default:
      return 'GLOBAL';
  }
}

function normalizeShadowChannel(value: string | undefined | null): ChatShadowChannel {
  const upper = String(value ?? '').toUpperCase();
  switch (upper) {
    case 'SYSTEM_SHADOW':
    case 'NPC_SHADOW':
    case 'RIVALRY_SHADOW':
    case 'RESCUE_SHADOW':
    case 'LIVEOPS_SHADOW':
      return upper;
    default:
      return 'SYSTEM_SHADOW';
  }
}

function normalizePressureTier(value: string | undefined | null): SharedPressureTier | undefined {
  const upper = String(value ?? '').toUpperCase();
  switch (upper) {
    case 'CALM':
    case 'WATCHFUL':
    case 'PRESSURED':
    case 'CRITICAL':
    case 'BREAKPOINT':
      return upper;
    default:
      return undefined;
  }
}

function pressure01(tier: SharedPressureTier | undefined): number {
  switch (tier) {
    case 'CALM':
      return 0.1;
    case 'WATCHFUL':
      return 0.28;
    case 'PRESSURED':
      return 0.56;
    case 'CRITICAL':
      return 0.82;
    case 'BREAKPOINT':
      return 0.97;
    default:
      return 0.4;
  }
}

/* ============================================================================
 * MARK: public contracts
 * ============================================================================
 */

export type ChatSilencePurpose =
  | 'FALSE_CALM'
  | 'PRE_ATTACK_TENSION'
  | 'POST_ATTACK_SHOCK'
  | 'PRE_RESCUE_GAP'
  | 'REVEAL_BUFFER'
  | 'PLAYER_REPLY_WINDOW'
  | 'DEAL_ROOM_WAIT'
  | 'WORLD_EVENT_HUSH'
  | 'LEGEND_BREATH'
  | 'MOURNING'
  | 'COOLDOWN'
  | 'TYPING_THEATER';

export type ChatSilenceDecisionKind =
  | 'EMIT_NOW'
  | 'HOLD_VISIBLE'
  | 'SHADOW_ONLY'
  | 'WAIT_FOR_REVEAL'
  | 'WAIT_FOR_PLAYER'
  | 'WAIT_FOR_HELPER'
  | 'WAIT_FOR_CROWD'
  | 'WAIT_FOR_COOLDOWN'
  | 'DROP_NONESSENTIAL'
  | 'CANCEL_WINDOW';

export type ChatInterruptDisposition =
  | 'ALLOW'
  | 'ALLOW_SHADOW_ONLY'
  | 'ALLOW_RESCUE_ONLY'
  | 'DENY'
  | 'DENY_UNLESS_BREAKPOINT'
  | 'PREEMPT_EXISTING_WINDOW'
  | 'QUEUE_AFTER_WINDOW';

export interface ChatSilenceLedgerWindowLike {
  readonly silenceId: string;
  readonly roomId: string;
  readonly momentId: string;
  readonly sceneId?: string;
  readonly channelId: ChatChannelId;
  readonly purpose: string;
  readonly opensAt: number;
  readonly closesAt: number;
  readonly weight01: number;
  readonly interruptible: boolean;
  readonly shadowOnly: boolean;
  readonly preferredCounterpartId?: string;
  readonly tags: readonly string[];
  readonly closedAt?: number;
}

export interface ChatRevealReservationLike {
  readonly reservationId: string;
  readonly roomId: string;
  readonly momentId: string;
  readonly sceneId?: string;
  readonly channelId: ChatChannelId;
  readonly revealKind: string;
  readonly payloadId: string;
  readonly weight01: number;
  readonly notBefore: number;
  readonly expiresAt: number;
  readonly status: string;
  readonly counterpartId?: string;
  readonly callbackAnchorIds: readonly string[];
  readonly tags: readonly string[];
}

export interface ChatMomentLike {
  readonly momentId: string;
  readonly roomId: string;
  readonly playerId: string;
  readonly primaryChannelId: ChatVisibleChannel;
  readonly momentType: SharedChatMomentType;
  readonly pressureTier?: SharedPressureTier;
  readonly intensity01: number;
  readonly importance01: number;
  readonly status: string;
  readonly sceneId?: string;
  readonly sceneArchetype?: SharedChatSceneArchetype;
  readonly counterpartIds: readonly string[];
  readonly callbackAnchorIds: readonly string[];
  readonly worldTags: readonly string[];
  readonly planningTags: readonly string[];
  readonly unresolvedReasons: readonly string[];
  readonly summaryLine: string;
}

export interface ChatSilencePolicyContext {
  readonly at?: number;
  readonly roomId: string;
  readonly playerId: string;
  readonly channelId: ChatVisibleChannel;
  readonly shadowChannelId?: ChatShadowChannel;
  readonly momentType: SharedChatMomentType;
  readonly pressureTier?: SharedPressureTier | string;
  readonly momentIntensity01?: number;
  readonly momentImportance01?: number;
  readonly momentStatus?: string;
  readonly momentSummary?: string;
  readonly sceneId?: string;
  readonly sceneArchetype?: SharedChatSceneArchetype;
  readonly beat?: SharedChatSceneBeat;
  readonly scene?: SharedChatScenePlan;
  readonly beatIndex?: number;
  readonly totalBeatCount?: number;
  readonly activeWindows?: readonly ChatSilenceLedgerWindowLike[];
  readonly activeReveals?: readonly ChatRevealReservationLike[];
  readonly sameChannelRecentMessageAt?: number;
  readonly sameSpeakerRecentMessageAt?: number;
  readonly sameRoleRecentMessageAt?: number;
  readonly sameCounterpartRecentMessageAt?: number;
  readonly counterpartId?: string;
  readonly actorRole?: 'SYSTEM' | 'HATER' | 'HELPER' | 'CROWD' | 'PLAYER' | 'CALLBACK' | 'UNKNOWN';
  readonly actorPriority01?: number;
  readonly relationshipIntensity01?: number;
  readonly relationshipObsession01?: number;
  readonly relationshipRespect01?: number;
  readonly relationshipFear01?: number;
  readonly relationshipContempt01?: number;
  readonly helperNeed01?: number;
  readonly crowdHeat01?: number;
  readonly callbackOpportunity01?: number;
  readonly revealPressure01?: number;
  readonly unresolvedBusiness01?: number;
  readonly publicWitnessRequired?: boolean;
  readonly privatePressureMode?: boolean;
  readonly allowSilence?: boolean;
  readonly allowShadowOnly?: boolean;
  readonly allowPlayerReplyWindow?: boolean;
  readonly allowCrowdDelay?: boolean;
  readonly worldTags?: readonly string[];
  readonly planningTags?: readonly string[];
  readonly unresolvedReasons?: readonly string[];
}

export interface ChatSilenceWindowPlan {
  readonly silenceId: string;
  readonly purpose: ChatSilencePurpose;
  readonly channelId: ChatChannelId;
  readonly opensAt: number;
  readonly closesAt: number;
  readonly weight01: number;
  readonly interruptible: boolean;
  readonly shadowOnly: boolean;
  readonly preferredCounterpartId?: string;
  readonly reasonSummary: string;
  readonly tags: readonly string[];
}

export interface ChatSilenceDecision {
  readonly kind: ChatSilenceDecisionKind;
  readonly holdMs: number;
  readonly notBefore: number;
  readonly until?: number;
  readonly purpose?: ChatSilencePurpose;
  readonly shadowChannelId?: ChatShadowChannel;
  readonly shouldPrimeShadow: boolean;
  readonly shouldAdvanceRevealLease: boolean;
  readonly shouldEscalateToHelper: boolean;
  readonly shouldSuppressCrowd: boolean;
  readonly shouldAllowSystemNotice: boolean;
  readonly score01: number;
  readonly reasons: readonly string[];
  readonly tags: readonly string[];
  readonly suggestedWindow?: ChatSilenceWindowPlan;
}

export interface ChatInterruptAssessment {
  readonly disposition: ChatInterruptDisposition;
  readonly score01: number;
  readonly reasons: readonly string[];
  readonly tags: readonly string[];
  readonly keepWindowId?: string;
  readonly preemptWindowId?: string;
  readonly notBefore?: number;
}

export interface ChatBeatScheduleEntry {
  readonly beatId: string;
  readonly beatType: SharedChatSceneBeatType;
  readonly sceneRole: string;
  readonly actorId?: string;
  readonly emitAt: number;
  readonly holdMs: number;
  readonly shadowOnly: boolean;
  readonly tags: readonly string[];
  readonly reasons: readonly string[];
}

export interface ChatSceneSilencePlan {
  readonly sceneId: string;
  readonly roomId: string;
  readonly channelId: ChatVisibleChannel;
  readonly generatedAt: number;
  readonly beatSchedule: readonly ChatBeatScheduleEntry[];
  readonly windows: readonly ChatSilenceWindowPlan[];
  readonly revealFirstBeatIds: readonly string[];
  readonly helperProtectedBeatIds: readonly string[];
  readonly crowdDelayedBeatIds: readonly string[];
  readonly summary: string;
}

export interface ChatSilencePolicyConfig {
  readonly runtimeConfig: ChatRuntimeConfig;
  readonly enableFalseCalm: boolean;
  readonly enableRevealBuffers: boolean;
  readonly enablePlayerReplySilence: boolean;
  readonly enableCrowdDelay: boolean;
  readonly enableLegendBreath: boolean;
  readonly enableWorldEventHush: boolean;
  readonly minHoldMs: number;
  readonly maxHoldMs: number;
  readonly falseCalmMinMs: number;
  readonly falseCalmMaxMs: number;
  readonly revealBufferMinMs: number;
  readonly revealBufferMaxMs: number;
  readonly helperGapMinMs: number;
  readonly helperGapMaxMs: number;
  readonly crowdDelayMinMs: number;
  readonly crowdDelayMaxMs: number;
  readonly replyWindowMinMs: number;
  readonly replyWindowMaxMs: number;
  readonly cooldownMinMs: number;
  readonly cooldownMaxMs: number;
  readonly shockMinMs: number;
  readonly shockMaxMs: number;
  readonly globalCrowdAmplification01: number;
  readonly syndicatePrivateBias01: number;
  readonly dealRoomPredatoryPause01: number;
  readonly revealSensitivity01: number;
  readonly helperProtection01: number;
  readonly crowdDelaySensitivity01: number;
  readonly publicWitnessSensitivity01: number;
  readonly silenceDropThreshold01: number;
}

export const DEFAULT_CHAT_SILENCE_POLICY_CONFIG: ChatSilencePolicyConfig = Object.freeze({
  runtimeConfig: CHAT_RUNTIME_DEFAULTS,
  enableFalseCalm: true,
  enableRevealBuffers: true,
  enablePlayerReplySilence: true,
  enableCrowdDelay: true,
  enableLegendBreath: true,
  enableWorldEventHush: true,
  minHoldMs: 450,
  maxHoldMs: 12_000,
  falseCalmMinMs: 1_300,
  falseCalmMaxMs: 4_400,
  revealBufferMinMs: 900,
  revealBufferMaxMs: 3_800,
  helperGapMinMs: 700,
  helperGapMaxMs: 3_600,
  crowdDelayMinMs: 350,
  crowdDelayMaxMs: 2_700,
  replyWindowMinMs: 2_400,
  replyWindowMaxMs: 8_000,
  cooldownMinMs: 600,
  cooldownMaxMs: 3_000,
  shockMinMs: 900,
  shockMaxMs: 4_000,
  globalCrowdAmplification01: 0.9,
  syndicatePrivateBias01: 0.78,
  dealRoomPredatoryPause01: 0.88,
  revealSensitivity01: 0.82,
  helperProtection01: 0.84,
  crowdDelaySensitivity01: 0.72,
  publicWitnessSensitivity01: 0.68,
  silenceDropThreshold01: 0.91,
});

/* ============================================================================
 * MARK: policy tables
 * ============================================================================
 */

const MOMENT_BASE_SILENCE: Readonly<Record<SharedChatMomentType, number>> = Object.freeze({
  RUN_START: 0.08,
  RUN_END: 0.42,
  PRESSURE_SURGE: 0.38,
  SHIELD_BREACH: 0.78,
  CASCADE_TRIGGER: 0.66,
  CASCADE_BREAK: 0.56,
  BOT_ATTACK: 0.44,
  BOT_RETREAT: 0.32,
  HELPER_RESCUE: 0.47,
  DEAL_ROOM_STANDOFF: 0.64,
  SOVEREIGN_APPROACH: 0.72,
  SOVEREIGN_ACHIEVED: 0.88,
  LEGEND_MOMENT: 0.92,
  WORLD_EVENT: 0.58,
});

const ARCHETYPE_SILENCE: Readonly<Record<SharedChatSceneArchetype, number>> = Object.freeze({
  BREACH_SCENE: 0.82,
  TRAP_SCENE: 0.79,
  RESCUE_SCENE: 0.52,
  PUBLIC_HUMILIATION_SCENE: 0.61,
  COMEBACK_WITNESS_SCENE: 0.44,
  DEAL_ROOM_PRESSURE_SCENE: 0.7,
  FALSE_CALM_SCENE: 0.98,
  END_OF_RUN_RECKONING_SCENE: 0.55,
  LONG_ARC_CALLBACK_SCENE: 0.67,
  SEASON_EVENT_INTRUSION_SCENE: 0.63,
});

const BEAT_INTRUSION_WEIGHT: Readonly<Record<SharedChatSceneBeatType, number>> = Object.freeze({
  SYSTEM_NOTICE: 0.16,
  HATER_ENTRY: 0.62,
  CROWD_SWARM: 0.74,
  HELPER_INTERVENTION: 0.68,
  PLAYER_REPLY_WINDOW: 0.95,
  SILENCE: 1,
  REVEAL: 0.9,
  POST_BEAT_ECHO: 0.38,
});

const BEAT_ROLE_SILENCE_BIAS: Readonly<Record<string, number>> = Object.freeze({
  OPEN: 0.18,
  PRESSURE: 0.62,
  MOCK: 0.54,
  DEFEND: 0.47,
  WITNESS: 0.29,
  CALLBACK: 0.74,
  REVEAL: 0.88,
  SILENCE: 1,
  ECHO: 0.33,
  CLOSE: 0.22,
});

const PURPOSE_BASE_WEIGHT: Readonly<Record<ChatSilencePurpose, number>> = Object.freeze({
  FALSE_CALM: 0.94,
  PRE_ATTACK_TENSION: 0.72,
  POST_ATTACK_SHOCK: 0.81,
  PRE_RESCUE_GAP: 0.63,
  REVEAL_BUFFER: 0.84,
  PLAYER_REPLY_WINDOW: 0.92,
  DEAL_ROOM_WAIT: 0.77,
  WORLD_EVENT_HUSH: 0.73,
  LEGEND_BREATH: 0.88,
  MOURNING: 0.7,
  COOLDOWN: 0.36,
  TYPING_THEATER: 0.48,
});

const PURPOSE_PREFERRED_SHADOW: Readonly<Record<ChatSilencePurpose, ChatShadowChannel>> = Object.freeze({
  FALSE_CALM: 'SYSTEM_SHADOW',
  PRE_ATTACK_TENSION: 'NPC_SHADOW',
  POST_ATTACK_SHOCK: 'RIVALRY_SHADOW',
  PRE_RESCUE_GAP: 'RESCUE_SHADOW',
  REVEAL_BUFFER: 'SYSTEM_SHADOW',
  PLAYER_REPLY_WINDOW: 'SYSTEM_SHADOW',
  DEAL_ROOM_WAIT: 'NPC_SHADOW',
  WORLD_EVENT_HUSH: 'LIVEOPS_SHADOW',
  LEGEND_BREATH: 'SYSTEM_SHADOW',
  MOURNING: 'RIVALRY_SHADOW',
  COOLDOWN: 'SYSTEM_SHADOW',
  TYPING_THEATER: 'NPC_SHADOW',
});

/* ============================================================================
 * MARK: local scorers
 * ============================================================================
 */

function channelPrivateBias(channelId: ChatVisibleChannel): number {
  switch (channelId) {
    case 'GLOBAL':
      return 0.12;
    case 'SYNDICATE':
      return 0.64;
    case 'DEAL_ROOM':
      return 0.72;
    case 'LOBBY':
      return 0.18;
    default:
      return 0.2;
  }
}

function baseSilenceScore(context: ChatSilencePolicyContext, config: ChatSilencePolicyConfig): number {
  const pressure = pressure01(normalizePressureTier(context.pressureTier));
  const momentScore = MOMENT_BASE_SILENCE[context.momentType] ?? 0.35;
  const archetypeScore = context.sceneArchetype ? ARCHETYPE_SILENCE[context.sceneArchetype] ?? 0.4 : 0.38;
  const beatTypeScore = context.beat ? BEAT_INTRUSION_WEIGHT[context.beat.beatType] ?? 0.4 : 0.35;
  const roleScore = context.beat ? BEAT_ROLE_SILENCE_BIAS[context.beat.sceneRole] ?? 0.35 : 0.3;
  const helperNeed = clamp01(context.helperNeed01 ?? 0);
  const crowdHeat = clamp01(context.crowdHeat01 ?? 0);
  const callbackOpportunity = clamp01(context.callbackOpportunity01 ?? 0);
  const revealPressure = clamp01(context.revealPressure01 ?? callbackOpportunity);
  const relationshipIntensity = clamp01(context.relationshipIntensity01 ?? 0);
  const unresolvedBusiness = clamp01(context.unresolvedBusiness01 ?? 0);
  const privateBias =
    channelPrivateBias(normalizeVisibleChannel(context.channelId)) *
    (context.privatePressureMode ? 1 : 0.65);

  return clamp01(
    momentScore * 0.18 +
      archetypeScore * 0.18 +
      beatTypeScore * 0.12 +
      roleScore * 0.08 +
      pressure * 0.14 +
      helperNeed * 0.06 +
      crowdHeat * 0.04 +
      callbackOpportunity * 0.06 +
      revealPressure * 0.06 +
      relationshipIntensity * 0.04 +
      unresolvedBusiness * 0.04 +
      privateBias * 0.1 +
      (context.publicWitnessRequired ? config.publicWitnessSensitivity01 * 0.05 : 0),
  );
}

function revealNeedScore(context: ChatSilencePolicyContext, config: ChatSilencePolicyConfig): number {
  const revealPressure = clamp01(context.revealPressure01 ?? 0);
  const callbackOpportunity = clamp01(context.callbackOpportunity01 ?? 0);
  const activeRevealWeight = max01(
    (context.activeReveals ?? []).map((reveal) => clamp01(reveal.weight01)),
  );
  const revealBeatBonus = context.beat?.beatType === 'REVEAL' ? 0.3 : 0;
  return clamp01(
    revealPressure * 0.38 +
      callbackOpportunity * 0.28 +
      activeRevealWeight * 0.24 +
      config.revealSensitivity01 * 0.1 +
      revealBeatBonus,
  );
}

function helperProtectionScore(context: ChatSilencePolicyContext, config: ChatSilencePolicyConfig): number {
  const helperNeed = clamp01(context.helperNeed01 ?? 0);
  const pressure = pressure01(normalizePressureTier(context.pressureTier));
  const relationshipFear = clamp01(context.relationshipFear01 ?? 0);
  const beatHelperBias = context.beat?.beatType === 'HELPER_INTERVENTION' ? 0.24 : 0;
  return clamp01(
    helperNeed * 0.42 +
      pressure * 0.18 +
      relationshipFear * 0.14 +
      config.helperProtection01 * 0.12 +
      beatHelperBias,
  );
}

function crowdDelayScore(context: ChatSilencePolicyContext, config: ChatSilencePolicyConfig): number {
  const crowdHeat = clamp01(context.crowdHeat01 ?? 0);
  const pressure = pressure01(normalizePressureTier(context.pressureTier));
  const publicWitness = context.publicWitnessRequired ? 1 : 0;
  const isGlobal = normalizeVisibleChannel(context.channelId) === 'GLOBAL' ? 1 : 0;
  const beatCrowd = context.beat?.beatType === 'CROWD_SWARM' ? 1 : 0;
  return clamp01(
    crowdHeat * 0.34 +
      pressure * 0.16 +
      publicWitness * 0.16 +
      isGlobal * config.globalCrowdAmplification01 * 0.16 +
      beatCrowd * 0.18,
  );
}

function falseCalmScore(context: ChatSilencePolicyContext, config: ChatSilencePolicyConfig): number {
  if (!config.enableFalseCalm) return 0;
  const archetype = context.sceneArchetype === 'FALSE_CALM_SCENE' ? 1 : 0;
  const beforeAttack =
    context.beat?.beatType === 'SYSTEM_NOTICE' || context.beat?.sceneRole === 'OPEN' ? 0.42 : 0;
  const pressure = pressure01(normalizePressureTier(context.pressureTier));
  const revealNeed = revealNeedScore(context, config);
  return clamp01(archetype * 0.46 + beforeAttack * 0.16 + pressure * 0.14 + revealNeed * 0.12);
}

function replyWindowScore(context: ChatSilencePolicyContext): number {
  if (!context.allowPlayerReplyWindow) return 0;
  const beatReply = context.beat?.beatType === 'PLAYER_REPLY_WINDOW' ? 1 : 0;
  const publicWitness = context.publicWitnessRequired ? 0.22 : 0;
  const pressure = pressure01(normalizePressureTier(context.pressureTier));
  return clamp01(beatReply * 0.6 + publicWitness + pressure * 0.1);
}

/* ============================================================================
 * MARK: duration helpers
 * ============================================================================
 */

function lerp(min: number, max: number, weight01: number): number {
  return Math.round(min + (max - min) * clamp01(weight01));
}

function holdDurationForPurpose(
  purpose: ChatSilencePurpose,
  weight01: number,
  config: ChatSilencePolicyConfig,
): number {
  switch (purpose) {
    case 'FALSE_CALM':
      return lerp(config.falseCalmMinMs, config.falseCalmMaxMs, weight01);
    case 'REVEAL_BUFFER':
      return lerp(config.revealBufferMinMs, config.revealBufferMaxMs, weight01);
    case 'PRE_RESCUE_GAP':
      return lerp(config.helperGapMinMs, config.helperGapMaxMs, weight01);
    case 'DEAL_ROOM_WAIT':
      return lerp(config.helperGapMinMs, config.crowdDelayMaxMs, weight01);
    case 'WORLD_EVENT_HUSH':
      return lerp(config.cooldownMinMs, config.falseCalmMaxMs, weight01);
    case 'LEGEND_BREATH':
      return lerp(config.shockMinMs, config.shockMaxMs, weight01);
    case 'PLAYER_REPLY_WINDOW':
      return lerp(config.replyWindowMinMs, config.replyWindowMaxMs, weight01);
    case 'POST_ATTACK_SHOCK':
      return lerp(config.shockMinMs, config.shockMaxMs, weight01);
    case 'PRE_ATTACK_TENSION':
      return lerp(config.falseCalmMinMs, config.falseCalmMaxMs, weight01 * 0.85);
    case 'MOURNING':
      return lerp(config.cooldownMinMs, config.cooldownMaxMs, weight01 * 0.9);
    case 'TYPING_THEATER':
      return lerp(config.minHoldMs, config.crowdDelayMaxMs, weight01 * 0.7);
    case 'COOLDOWN':
    default:
      return lerp(config.cooldownMinMs, config.cooldownMaxMs, weight01);
  }
}

/* ============================================================================
 * MARK: ChatSilencePolicy
 * ============================================================================
 */

export class ChatSilencePolicy {
  private readonly config: ChatSilencePolicyConfig;

  public constructor(config: Partial<ChatSilencePolicyConfig> = {}) {
    this.config = Object.freeze({
      ...DEFAULT_CHAT_SILENCE_POLICY_CONFIG,
      ...config,
      runtimeConfig: config.runtimeConfig ?? DEFAULT_CHAT_SILENCE_POLICY_CONFIG.runtimeConfig,
    });
  }

  /* -------------------------------------------------------------------------
   * MARK: primary decision
   * -------------------------------------------------------------------------
   */

  public evaluate(context: ChatSilencePolicyContext): ChatSilenceDecision {
    const at = context.at ?? now();
    const base = baseSilenceScore(context, this.config);
    const revealNeed = revealNeedScore(context, this.config);
    const helperProtection = helperProtectionScore(context, this.config);
    const crowdDelay = this.config.enableCrowdDelay ? crowdDelayScore(context, this.config) : 0;
    const falseCalm = falseCalmScore(context, this.config);
    const replyWindow = replyWindowScore(context);

    const activeWindows = (context.activeWindows ?? [])
      .filter((window) => !window.closedAt)
      .filter((window) => window.opensAt <= at && window.closesAt >= at)
      .filter((window) => window.roomId === context.roomId)
      .filter((window) => window.channelId === context.channelId)
      .sort((a, b) => b.weight01 - a.weight01 || a.opensAt - b.opensAt);

    const activeWindow = activeWindows[0];
    const activeWindowScore = activeWindow ? clamp01(activeWindow.weight01) : 0;

    const score = clamp01(
      base * 0.28 +
        revealNeed * 0.2 +
        helperProtection * 0.12 +
        crowdDelay * 0.1 +
        falseCalm * 0.14 +
        replyWindow * 0.12 +
        activeWindowScore * 0.04,
    );

    const reasons: string[] = [];
    const tags: string[] = [];

    if (base >= 0.5) reasons.push('base_silence_bias');
    if (revealNeed >= 0.55) reasons.push('reveal_pressure');
    if (helperProtection >= 0.58) reasons.push('helper_protection');
    if (crowdDelay >= 0.58) reasons.push('crowd_delay');
    if (falseCalm >= 0.56) reasons.push('false_calm');
    if (replyWindow >= 0.64) reasons.push('player_reply_window');
    if (activeWindow) reasons.push(`active_window:${activeWindow.purpose}`);

    if (context.sceneArchetype) tags.push(`ARCHETYPE:${context.sceneArchetype}`);
    tags.push(`MOMENT:${context.momentType}`);
    tags.push(`CHANNEL:${normalizeVisibleChannel(context.channelId)}`);
    if (context.beat) {
      tags.push(`BEAT:${context.beat.beatType}`);
      tags.push(`ROLE:${context.beat.sceneRole}`);
    }

    if (score >= this.config.silenceDropThreshold01 && context.beat?.beatType === 'CROWD_SWARM') {
      reasons.push('crowd_drop_nonessential');
      return {
        kind: 'DROP_NONESSENTIAL',
        holdMs: 0,
        notBefore: at,
        purpose: 'COOLDOWN',
        shadowChannelId: normalizeShadowChannel(context.shadowChannelId ?? 'RIVALRY_SHADOW'),
        shouldPrimeShadow: true,
        shouldAdvanceRevealLease: false,
        shouldEscalateToHelper: false,
        shouldSuppressCrowd: true,
        shouldAllowSystemNotice: false,
        score01: score,
        reasons,
        tags: uniq(tags),
      };
    }

    if (activeWindow) {
      reasons.push('existing_window_blocks_emit');
      return {
        kind: activeWindow.shadowOnly ? 'SHADOW_ONLY' : 'HOLD_VISIBLE',
        holdMs: Math.max(0, activeWindow.closesAt - at),
        notBefore: activeWindow.closesAt,
        until: activeWindow.closesAt,
        purpose: (activeWindow.purpose as ChatSilencePurpose) ?? 'COOLDOWN',
        shadowChannelId: normalizeShadowChannel(
          context.shadowChannelId ?? PURPOSE_PREFERRED_SHADOW[(activeWindow.purpose as ChatSilencePurpose) ?? 'COOLDOWN'],
        ),
        shouldPrimeShadow: true,
        shouldAdvanceRevealLease: revealNeed >= 0.6,
        shouldEscalateToHelper: helperProtection >= 0.7,
        shouldSuppressCrowd: crowdDelay >= 0.54,
        shouldAllowSystemNotice: context.beat?.beatType === 'SYSTEM_NOTICE',
        score01: score,
        reasons,
        tags: uniq(tags),
      };
    }

    if (replyWindow >= 0.72 && context.allowPlayerReplyWindow) {
      const purpose: ChatSilencePurpose = 'PLAYER_REPLY_WINDOW';
      const holdMs = holdDurationForPurpose(purpose, replyWindow, this.config);
      reasons.push('waiting_for_player_reply');
      return this.makeDecision(at, score, purpose, holdMs, reasons, tags, context, {
        kind: 'WAIT_FOR_PLAYER',
        shouldPrimeShadow: true,
        shouldAdvanceRevealLease: false,
        shouldEscalateToHelper: helperProtection >= 0.78,
        shouldSuppressCrowd: true,
        shouldAllowSystemNotice: true,
      });
    }

    if (revealNeed >= 0.66 && this.config.enableRevealBuffers) {
      const purpose: ChatSilencePurpose = 'REVEAL_BUFFER';
      const holdMs = holdDurationForPurpose(purpose, revealNeed, this.config);
      reasons.push('waiting_for_reveal');
      return this.makeDecision(at, score, purpose, holdMs, reasons, tags, context, {
        kind: 'WAIT_FOR_REVEAL',
        shouldPrimeShadow: true,
        shouldAdvanceRevealLease: true,
        shouldEscalateToHelper: false,
        shouldSuppressCrowd: crowdDelay >= 0.48,
        shouldAllowSystemNotice: context.beat?.beatType === 'SYSTEM_NOTICE',
      });
    }

    if (helperProtection >= 0.72 && context.actorRole === 'HATER') {
      const purpose: ChatSilencePurpose = 'PRE_RESCUE_GAP';
      const holdMs = holdDurationForPurpose(purpose, helperProtection, this.config);
      reasons.push('holding_hater_for_helper');
      return this.makeDecision(at, score, purpose, holdMs, reasons, tags, context, {
        kind: 'WAIT_FOR_HELPER',
        shouldPrimeShadow: true,
        shouldAdvanceRevealLease: false,
        shouldEscalateToHelper: true,
        shouldSuppressCrowd: crowdDelay >= 0.45,
        shouldAllowSystemNotice: true,
      });
    }

    if (falseCalm >= 0.64 && this.config.enableFalseCalm) {
      const purpose: ChatSilencePurpose = 'FALSE_CALM';
      const holdMs = holdDurationForPurpose(purpose, falseCalm, this.config);
      reasons.push('false_calm_window');
      return this.makeDecision(at, score, purpose, holdMs, reasons, tags, context, {
        kind: 'HOLD_VISIBLE',
        shouldPrimeShadow: true,
        shouldAdvanceRevealLease: revealNeed >= 0.48,
        shouldEscalateToHelper: false,
        shouldSuppressCrowd: true,
        shouldAllowSystemNotice: true,
      });
    }

    if (crowdDelay >= 0.7 && context.beat?.beatType === 'CROWD_SWARM' && context.allowCrowdDelay !== false) {
      const purpose: ChatSilencePurpose = normalizeVisibleChannel(context.channelId) === 'DEAL_ROOM'
        ? 'DEAL_ROOM_WAIT'
        : 'POST_ATTACK_SHOCK';
      const holdMs = holdDurationForPurpose(purpose, crowdDelay, this.config);
      reasons.push('crowd_delayed');
      return this.makeDecision(at, score, purpose, holdMs, reasons, tags, context, {
        kind: 'WAIT_FOR_CROWD',
        shouldPrimeShadow: true,
        shouldAdvanceRevealLease: false,
        shouldEscalateToHelper: false,
        shouldSuppressCrowd: true,
        shouldAllowSystemNotice: false,
      });
    }

    if (
      (context.momentType === 'LEGEND_MOMENT' || context.momentType === 'SOVEREIGN_ACHIEVED') &&
      this.config.enableLegendBreath
    ) {
      const purpose: ChatSilencePurpose = 'LEGEND_BREATH';
      const holdMs = holdDurationForPurpose(purpose, Math.max(score, 0.72), this.config);
      reasons.push('legend_breath');
      return this.makeDecision(at, score, purpose, holdMs, reasons, tags, context, {
        kind: 'HOLD_VISIBLE',
        shouldPrimeShadow: true,
        shouldAdvanceRevealLease: revealNeed >= 0.42,
        shouldEscalateToHelper: false,
        shouldSuppressCrowd: false,
        shouldAllowSystemNotice: true,
      });
    }

    if (context.momentType === 'WORLD_EVENT' && this.config.enableWorldEventHush && score >= 0.58) {
      const purpose: ChatSilencePurpose = 'WORLD_EVENT_HUSH';
      const holdMs = holdDurationForPurpose(purpose, score, this.config);
      reasons.push('world_event_hush');
      return this.makeDecision(at, score, purpose, holdMs, reasons, tags, context, {
        kind: 'SHADOW_ONLY',
        shouldPrimeShadow: true,
        shouldAdvanceRevealLease: true,
        shouldEscalateToHelper: false,
        shouldSuppressCrowd: true,
        shouldAllowSystemNotice: true,
      });
    }

    if (
      score >= 0.54 &&
      context.sameChannelRecentMessageAt != null &&
      at - context.sameChannelRecentMessageAt < this.config.runtimeConfig.ratePolicy.npcMinimumGapMs
    ) {
      const purpose: ChatSilencePurpose = 'COOLDOWN';
      const holdMs = holdDurationForPurpose(purpose, score, this.config);
      reasons.push('channel_cooldown');
      return this.makeDecision(at, score, purpose, holdMs, reasons, tags, context, {
        kind: 'WAIT_FOR_COOLDOWN',
        shouldPrimeShadow: context.allowShadowOnly !== false,
        shouldAdvanceRevealLease: false,
        shouldEscalateToHelper: false,
        shouldSuppressCrowd: false,
        shouldAllowSystemNotice: true,
      });
    }

    reasons.push('emit_now');
    return {
      kind: 'EMIT_NOW',
      holdMs: 0,
      notBefore: at,
      purpose: undefined,
      shadowChannelId: undefined,
      shouldPrimeShadow: false,
      shouldAdvanceRevealLease: false,
      shouldEscalateToHelper: false,
      shouldSuppressCrowd: false,
      shouldAllowSystemNotice: true,
      score01: score,
      reasons,
      tags: uniq(tags),
    };
  }

  private makeDecision(
    at: number,
    score: number,
    purpose: ChatSilencePurpose,
    holdMs: number,
    reasons: readonly string[],
    tags: readonly string[],
    context: ChatSilencePolicyContext,
    options: {
      readonly kind: ChatSilenceDecisionKind;
      readonly shouldPrimeShadow: boolean;
      readonly shouldAdvanceRevealLease: boolean;
      readonly shouldEscalateToHelper: boolean;
      readonly shouldSuppressCrowd: boolean;
      readonly shouldAllowSystemNotice: boolean;
    },
  ): ChatSilenceDecision {
    const shadowChannelId = normalizeShadowChannel(
      context.shadowChannelId ?? PURPOSE_PREFERRED_SHADOW[purpose],
    );

    const window = this.buildWindowPlan(context, purpose, holdMs, score, shadowChannelId, reasons, tags, at);

    return {
      kind: options.kind,
      holdMs,
      notBefore: at + holdMs,
      until: at + holdMs,
      purpose,
      shadowChannelId,
      shouldPrimeShadow: options.shouldPrimeShadow,
      shouldAdvanceRevealLease: options.shouldAdvanceRevealLease,
      shouldEscalateToHelper: options.shouldEscalateToHelper,
      shouldSuppressCrowd: options.shouldSuppressCrowd,
      shouldAllowSystemNotice: options.shouldAllowSystemNotice,
      score01: score,
      reasons: uniq(reasons),
      tags: uniq(tags),
      suggestedWindow: window,
    };
  }

  private buildWindowPlan(
    context: ChatSilencePolicyContext,
    purpose: ChatSilencePurpose,
    holdMs: number,
    score: number,
    shadowChannelId: ChatShadowChannel,
    reasons: readonly string[],
    tags: readonly string[],
    at: number,
  ): ChatSilenceWindowPlan {
    const opensAt = at;
    const closesAt = at + Math.min(this.config.maxHoldMs, Math.max(this.config.minHoldMs, holdMs));
    const beat = context.beat;
    const shadowOnly =
      context.momentType === 'WORLD_EVENT' ||
      purpose === 'WORLD_EVENT_HUSH' ||
      (beat?.beatType === 'CROWD_SWARM' && score >= 0.72 && context.allowShadowOnly !== false);

    const reasonSummary = uniq(reasons).join('|') || purpose;

    return {
      silenceId: `silence:${context.roomId}:${context.sceneId ?? context.momentType}:${at}:${purpose}`,
      purpose,
      channelId: shadowOnly ? shadowChannelId : normalizeVisibleChannel(context.channelId),
      opensAt,
      closesAt,
      weight01: score,
      interruptible:
        purpose !== 'PLAYER_REPLY_WINDOW' &&
        purpose !== 'REVEAL_BUFFER' &&
        purpose !== 'FALSE_CALM',
      shadowOnly,
      preferredCounterpartId: context.counterpartId,
      reasonSummary,
      tags: uniq([
        ...tags,
        ...asArray(context.worldTags),
        ...asArray(context.planningTags),
        `PURPOSE:${purpose}`,
      ]),
    };
  }

  /* -------------------------------------------------------------------------
   * MARK: interruption assessment
   * -------------------------------------------------------------------------
   */

  public assessInterruption(input: {
    readonly at?: number;
    readonly roomId: string;
    readonly channelId: ChatChannelId;
    readonly actorRole?: 'SYSTEM' | 'HATER' | 'HELPER' | 'CROWD' | 'PLAYER' | 'CALLBACK' | 'UNKNOWN';
    readonly priority01?: number;
    readonly pressureTier?: SharedPressureTier | string;
    readonly momentType: SharedChatMomentType;
    readonly helperNeed01?: number;
    readonly revealPressure01?: number;
    readonly existingWindows: readonly ChatSilenceLedgerWindowLike[];
  }): ChatInterruptAssessment {
    const at = input.at ?? now();
    const pressure = pressure01(normalizePressureTier(input.pressureTier));
    const helperNeed = clamp01(input.helperNeed01 ?? 0);
    const revealPressure = clamp01(input.revealPressure01 ?? 0);
    const priority = clamp01(input.priority01 ?? 0.5);

    const overlapping = input.existingWindows
      .filter((window) => !window.closedAt)
      .filter((window) => window.roomId === input.roomId)
      .filter((window) => window.channelId === input.channelId)
      .filter((window) => window.opensAt <= at && window.closesAt >= at)
      .sort((a, b) => b.weight01 - a.weight01 || a.opensAt - b.opensAt);

    const active = overlapping[0];
    if (!active) {
      return {
        disposition: 'ALLOW',
        score01: priority,
        reasons: ['no_active_window'],
        tags: [`CHANNEL:${String(input.channelId)}`],
      };
    }

    const reasons: string[] = [`window:${active.purpose}`];
    const tags: string[] = [`CHANNEL:${String(input.channelId)}`, `WINDOW:${String(active.purpose)}`];

    const pressureBreak = pressure >= 0.94 && input.momentType === 'SOVEREIGN_ACHIEVED';
    const rescueBreak = input.actorRole === 'HELPER' && helperNeed >= 0.72;
    const revealBreak = input.actorRole === 'CALLBACK' && revealPressure >= 0.72;
    const systemBreak = input.actorRole === 'SYSTEM' && priority >= 0.82;
    const crowdBreak = input.actorRole === 'CROWD' && active.shadowOnly;

    if (pressureBreak) {
      reasons.push('breakpoint_overrides_window');
      return {
        disposition: 'PREEMPT_EXISTING_WINDOW',
        score01: 1,
        reasons,
        tags,
        preemptWindowId: active.silenceId,
      };
    }

    if (rescueBreak && active.purpose !== 'PLAYER_REPLY_WINDOW') {
      reasons.push('helper_breaks_window');
      return {
        disposition: 'ALLOW_RESCUE_ONLY',
        score01: clamp01(helperNeed * 0.9 + priority * 0.1),
        reasons,
        tags,
        keepWindowId: active.silenceId,
      };
    }

    if (revealBreak && active.interruptible) {
      reasons.push('reveal_interrupts_window');
      return {
        disposition: 'PREEMPT_EXISTING_WINDOW',
        score01: clamp01(revealPressure * 0.9 + priority * 0.1),
        reasons,
        tags,
        preemptWindowId: active.silenceId,
      };
    }

    if (systemBreak && active.interruptible) {
      reasons.push('system_interruptible_window');
      return {
        disposition: 'ALLOW',
        score01: priority,
        reasons,
        tags,
        keepWindowId: active.silenceId,
      };
    }

    if (crowdBreak) {
      reasons.push('crowd_shadow_only');
      return {
        disposition: 'ALLOW_SHADOW_ONLY',
        score01: priority * 0.8,
        reasons,
        tags,
        keepWindowId: active.silenceId,
      };
    }

    if (!active.interruptible) {
      reasons.push('window_not_interruptible');
      return {
        disposition: pressure >= 0.82 ? 'DENY_UNLESS_BREAKPOINT' : 'DENY',
        score01: active.weight01,
        reasons,
        tags,
        notBefore: active.closesAt,
        keepWindowId: active.silenceId,
      };
    }

    reasons.push('queue_after_window');
    return {
      disposition: 'QUEUE_AFTER_WINDOW',
      score01: active.weight01,
      reasons,
      tags,
      notBefore: active.closesAt,
      keepWindowId: active.silenceId,
    };
  }

  /* -------------------------------------------------------------------------
   * MARK: scene scheduling
   * -------------------------------------------------------------------------
   */

  public planScene(
    scene: SharedChatScenePlan,
    context: Omit<ChatSilencePolicyContext, 'beat' | 'beatIndex' | 'scene' | 'sceneId' | 'sceneArchetype' | 'momentType' | 'channelId'> & {
      readonly at?: number;
      readonly channelId?: ChatVisibleChannel;
      readonly shadowChannelId?: ChatShadowChannel;
      readonly activeWindows?: readonly ChatSilenceLedgerWindowLike[];
      readonly activeReveals?: readonly ChatRevealReservationLike[];
    },
  ): ChatSceneSilencePlan {
    const generatedAt = context.at ?? now();
    const channelId = normalizeVisibleChannel(context.channelId ?? scene.primaryChannel);
    const beatSchedule: ChatBeatScheduleEntry[] = [];
    const windows: ChatSilenceWindowPlan[] = [];
    const revealFirstBeatIds: string[] = [];
    const helperProtectedBeatIds: string[] = [];
    const crowdDelayedBeatIds: string[] = [];

    let cursor = generatedAt;
    let previousEmitAt = generatedAt - (this.config.runtimeConfig.ratePolicy.npcMinimumGapMs + 1);

    scene.beats.forEach((beat, index) => {
      const decision = this.evaluate({
        ...context,
        at: cursor,
        roomId: context.roomId,
        playerId: context.playerId,
        channelId,
        shadowChannelId: context.shadowChannelId,
        momentType: scene.momentType,
        momentIntensity01: context.momentIntensity01,
        momentImportance01: context.momentImportance01,
        momentStatus: context.momentStatus,
        momentSummary: context.momentSummary,
        sceneId: scene.sceneId,
        sceneArchetype: scene.archetype,
        scene,
        beat,
        beatIndex: index,
        totalBeatCount: scene.beats.length,
      });

      const minGap = this.minimumGapForBeat(beat);
      const emitAt = Math.max(cursor + decision.holdMs, previousEmitAt + minGap);
      previousEmitAt = emitAt;
      cursor = emitAt;

      beatSchedule.push({
        beatId: beat.beatId,
        beatType: beat.beatType,
        sceneRole: beat.sceneRole,
        actorId: beat.actorId,
        emitAt,
        holdMs: decision.holdMs,
        shadowOnly: decision.kind === 'SHADOW_ONLY',
        tags: decision.tags,
        reasons: decision.reasons,
      });

      if (decision.suggestedWindow) {
        windows.push(decision.suggestedWindow);
      }
      if (decision.shouldAdvanceRevealLease) revealFirstBeatIds.push(beat.beatId);
      if (decision.shouldEscalateToHelper) helperProtectedBeatIds.push(beat.beatId);
      if (decision.shouldSuppressCrowd) crowdDelayedBeatIds.push(beat.beatId);

      if (beat.beatType === 'PLAYER_REPLY_WINDOW') {
        cursor += this.config.runtimeConfig.ratePolicy.typingHeartbeatWindowMs;
      }
    });

    return {
      sceneId: scene.sceneId,
      roomId: context.roomId,
      channelId,
      generatedAt,
      beatSchedule,
      windows: uniqByWindow(windows),
      revealFirstBeatIds: uniq(revealFirstBeatIds),
      helperProtectedBeatIds: uniq(helperProtectedBeatIds),
      crowdDelayedBeatIds: uniq(crowdDelayedBeatIds),
      summary: this.buildSceneSummary(scene, beatSchedule, windows),
    };
  }

  private minimumGapForBeat(beat: SharedChatSceneBeat): number {
    switch (beat.beatType) {
      case 'SYSTEM_NOTICE':
        return Math.min(
          this.config.runtimeConfig.ratePolicy.npcMinimumGapMs,
          this.config.cooldownMinMs,
        );
      case 'HELPER_INTERVENTION':
        return this.config.runtimeConfig.ratePolicy.helperMinimumGapMs;
      case 'HATER_ENTRY':
        return this.config.runtimeConfig.ratePolicy.haterMinimumGapMs;
      case 'CROWD_SWARM':
        return this.config.crowdDelayMinMs;
      case 'PLAYER_REPLY_WINDOW':
        return this.config.replyWindowMinMs;
      case 'REVEAL':
        return this.config.revealBufferMinMs;
      case 'SILENCE':
        return this.config.falseCalmMinMs;
      case 'POST_BEAT_ECHO':
      default:
        return this.config.runtimeConfig.ratePolicy.npcMinimumGapMs;
    }
  }

  private buildSceneSummary(
    scene: SharedChatScenePlan,
    beatSchedule: readonly ChatBeatScheduleEntry[],
    windows: readonly ChatSilenceWindowPlan[],
  ): string {
    const beats = beatSchedule.map((entry) => `${entry.beatType}@${entry.emitAt}`).join(' > ');
    const holds = windows.map((window) => `${window.purpose}:${window.closesAt - window.opensAt}`).join(', ');
    return `${scene.archetype}:${scene.momentType} :: beats=${beats} :: holds=${holds}`;
  }
}

/* ============================================================================
 * MARK: local list helpers
 * ============================================================================
 */

function uniqByWindow(values: readonly ChatSilenceWindowPlan[]): readonly ChatSilenceWindowPlan[] {
  const out: ChatSilenceWindowPlan[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = `${value.purpose}:${value.opensAt}:${value.closesAt}:${value.channelId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.sort((a, b) => a.opensAt - b.opensAt || b.weight01 - a.weight01);
}

function asArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : [];
}
