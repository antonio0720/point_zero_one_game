/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT BOSS FIGHT CONTRACTS
 * FILE: shared/contracts/chat/ChatBossFight.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for conversational boss encounters.
 *
 * This file promotes select chat sequences from "ambient taunting" into
 * structured, stateful, playable language combat. A chat boss fight is a
 * formally staged encounter where:
 * - attacks have telegraphs,
 * - windows can open and close,
 * - replies can counter or whiff,
 * - crowd heat can amplify outcomes,
 * - helpers can intervene,
 * - silence can be tactical,
 * - negotiation pressure can become a weapon,
 * - and the encounter can end in humiliation, containment, rescue,
 *   extraction, or legend.
 *
 * Design laws
 * -----------
 * 1. Boss fights are not generic scene bundles. They are playable combat states.
 * 2. Every boss attack must expose enough metadata to validate counters.
 * 3. Telegraphed attacks should create player-readable tension, not confusion.
 * 4. Timing, witnesses, and reputation are first-class fight variables.
 * 5. A boss fight can exist in public, private, negotiation, or shadow lanes.
 * 6. Fight state must survive transport boundaries without relying on UI-only
 *    assumptions.
 * 7. All exported helpers in this file are deterministic and side-effect free.
 * ============================================================================
 */

import type {
  Brand,
  ChatActorKind,
  ChatChannelAudienceProfile,
  ChatChannelId,
  ChatDeliveryPriority,
  ChatInterventionId,
  ChatMemoryAnchorId,
  ChatMessageId,
  ChatMomentId,
  ChatMountKey,
  ChatNpcId,
  ChatProofHash,
  ChatRelationshipId,
  ChatReplayId,
  ChatRequestId,
  ChatRoomId,
  ChatRouteKey,
  ChatSceneId,
  ChatSessionId,
  ChatStageMood,
  ChatUserId,
  ChatVisibleChannel,
  ChatWorldEventId,
  JsonObject,
  Score01,
  Score100,
  TickNumber,
  UnixMs,
} from './ChatChannels';
import {
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from './ChatChannels';

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatAttackType,
  ChatLearningProfile,
  ChatPressureTier,
  ChatReputationState,
  ChatRescueDecision,
  ChatRunOutcome,
} from './ChatEvents';

import type { ChatMessageToneBand } from './ChatMessage';

import type {
  ChatCounterEfficacyBand,
  ChatCounterExecutionMode,
  ChatCounterplayPlan,
  ChatCounterplayResolution,
  ChatCounterTimingClass,
  ChatCounterWindowId,
} from './ChatCounterplay';

import type { EpisodicMemoryEventType } from './memory';

import type {
  ChatRelationshipCounterpartKind,
  ChatRelationshipObjective,
  ChatRelationshipStance,
} from './relationship';

import type {
  SharedChatMomentType,
  SharedChatSceneArchetype,
  SharedChatSceneRole,
} from './scene';

// ============================================================================
// MARK: Contract metadata
// ============================================================================

export const CHAT_BOSS_FIGHT_CONTRACT_VERSION = '2026-03-19.1' as const;
export const CHAT_BOSS_FIGHT_CONTRACT_REVISION = 1 as const;
export const CHAT_BOSS_FIGHT_PUBLIC_API_VERSION = 'v1' as const;

export const CHAT_BOSS_FIGHT_AUTHORITIES = Object.freeze({
  ...CHAT_CONTRACT_AUTHORITIES,
  sharedContractFile: '/shared/contracts/chat/ChatBossFight.ts',
  frontendBossFightRoot: '/pzo-web/src/engines/chat/combat',
  backendBossFightRoot: '/backend/src/game/engine/chat/combat',
  serverBossFightRoot: '/pzo-server/src/chat',
} as const);

// ============================================================================
// MARK: Branded identifiers
// ============================================================================

export type ChatBossFightId = Brand<string, 'ChatBossFightId'>;
export type ChatBossPhaseId = Brand<string, 'ChatBossPhaseId'>;
export type ChatBossRoundId = Brand<string, 'ChatBossRoundId'>;
export type ChatBossAttackId = Brand<string, 'ChatBossAttackId'>;
export type ChatBossPatternId = Brand<string, 'ChatBossPatternId'>;
export type ChatBossTelegraphId = Brand<string, 'ChatBossTelegraphId'>;
export type ChatBossStateLedgerId = Brand<string, 'ChatBossStateLedgerId'>;
export type ChatBossResolutionId = Brand<string, 'ChatBossResolutionId'>;
export type ChatBossRewardHookId = Brand<string, 'ChatBossRewardHookId'>;

// ============================================================================
// MARK: Core discriminants
// ============================================================================

export const CHAT_BOSS_FIGHT_KINDS = [
  'PUBLIC_HUMILIATION',
  'RIVAL_ASCENSION',
  'SHIELD_SIEGE',
  'PRESSURE_TRIAL',
  'DEAL_ROOM_AMBUSH',
  'HELPER_BLACKOUT',
  'CROWD_SWARM_HUNT',
  'WORLD_EVENT_HUNT',
  'ARCHIVIST_RECKONING',
  'FINAL_WORD_DUEL',
] as const;
export type ChatBossFightKind = (typeof CHAT_BOSS_FIGHT_KINDS)[number];

export const CHAT_BOSS_FIGHT_STATES = [
  'STAGED',
  'TELEGRAPHING',
  'WINDOW_OPEN',
  'RESOLVING',
  'ESCALATING',
  'BROKEN',
  'WON',
  'LOST',
  'ABORTED',
] as const;
export type ChatBossFightState = (typeof CHAT_BOSS_FIGHT_STATES)[number];

export const CHAT_BOSS_PHASE_KINDS = [
  'INTRO',
  'MEASURE',
  'BAIT',
  'PRESSURE',
  'BREAKPOINT',
  'ENRAGE',
  'RESCUE_CHECK',
  'FINISHER',
  'AFTERMATH',
] as const;
export type ChatBossPhaseKind = (typeof CHAT_BOSS_PHASE_KINDS)[number];

export const CHAT_BOSS_ATTACK_CLASSES = [
  'TAUNT_SPIKE',
  'QUOTE_TRAP',
  'PROOF_CHALLENGE',
  'PUBLIC_SHAME',
  'DEAL_ROOM_SQUEEZE',
  'SILENCE_BAIT',
  'FALSE_RESPECT',
  'TIMEBOXED_DEMAND',
  'CASCADE_TRIGGER',
  'SHIELD_CRACKER',
  'HELPER_DENIAL',
  'CROWD_SIGNAL',
] as const;
export type ChatBossAttackClass = (typeof CHAT_BOSS_ATTACK_CLASSES)[number];

export const CHAT_BOSS_ATTACK_SEVERITIES = [
  'PROBING',
  'HEAVY',
  'CRITICAL',
  'EXECUTION',
] as const;
export type ChatBossAttackSeverity = (typeof CHAT_BOSS_ATTACK_SEVERITIES)[number];

export const CHAT_BOSS_OPENING_MODES = [
  'IMMEDIATE',
  'STAGGERED',
  'CROWD_PRIMED',
  'NEGOTIATION_READ_DELAYED',
  'SILENCE_LURE',
] as const;
export type ChatBossOpeningMode = (typeof CHAT_BOSS_OPENING_MODES)[number];

export const CHAT_BOSS_PUNISHMENT_CLASSES = [
  'EMBARRASSMENT_SPIKE',
  'PRESSURE_SPIKE',
  'REPUTATION_HIT',
  'SHIELD_DAMAGE',
  'DEAL_REPRICE',
  'HELPER_SUPPRESSION',
  'CROWD_SWARM',
  'EXIT_DENIAL',
] as const;
export type ChatBossPunishmentClass = (typeof CHAT_BOSS_PUNISHMENT_CLASSES)[number];

export const CHAT_BOSS_COUNTER_DEMANDS = [
  'VISIBLE_REPLY',
  'PROOF_REPLY',
  'QUOTE_REPLY',
  'TIMED_REPLY',
  'SILENCE_REPLY',
  'HELPER_REPLY',
  'NEGOTIATION_REPLY',
] as const;
export type ChatBossCounterDemand = (typeof CHAT_BOSS_COUNTER_DEMANDS)[number];

export const CHAT_BOSS_RESOLUTION_CLASSES = [
  'PLAYER_DOMINATES',
  'PLAYER_STABILIZES',
  'MUTUAL_STANDOFF',
  'BOSS_ADVANTAGE',
  'BOSS_EXECUTION',
  'RESCUE_EXTRACTION',
  'SYSTEM_ABORT',
] as const;
export type ChatBossResolutionClass = (typeof CHAT_BOSS_RESOLUTION_CLASSES)[number];

export const CHAT_BOSS_LEGEND_CLASSES = [
  'NONE',
  'PUBLIC_REVERSAL',
  'PERFECT_DEFENSE',
  'MIRACLE_ESCAPE',
  'RECEIPT_EXECUTION',
  'LAST_WORD',
] as const;
export type ChatBossLegendClass = (typeof CHAT_BOSS_LEGEND_CLASSES)[number];

// ============================================================================
// MARK: Actor and fight context
// ============================================================================

export interface ChatBossFightActor {
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly userId?: ChatUserId | null;
  readonly npcId?: ChatNpcId | null;
  readonly relationshipId?: ChatRelationshipId | null;
  readonly counterpartKind?: ChatRelationshipCounterpartKind | null;
  readonly displayName: string;
  readonly handle?: string | null;
  readonly stance: ChatRelationshipStance;
  readonly objective: ChatRelationshipObjective;
  readonly toneBand?: ChatMessageToneBand | null;
  readonly pressureBias01: Score01;
  readonly crowdBias01: Score01;
  readonly proofBias01: Score01;
  readonly quoteBias01: Score01;
  readonly silenceBias01: Score01;
  readonly rescueBias01: Score01;
  readonly legendBias01: Score01;
  readonly notes: readonly string[];
}

export interface ChatBossFightContext {
  readonly roomId: ChatRoomId;
  readonly sessionId?: ChatSessionId | null;
  readonly requestId?: ChatRequestId | null;
  readonly visibleChannel: ChatVisibleChannel;
  readonly channelId: ChatChannelId;
  readonly audienceProfile?: ChatChannelAudienceProfile | null;
  readonly momentId?: ChatMomentId | null;
  readonly sceneId?: ChatSceneId | null;
  readonly mountKey?: ChatMountKey | null;
  readonly routeKey?: ChatRouteKey | null;
  readonly worldEventId?: ChatWorldEventId | null;
  readonly tick?: TickNumber | null;
  readonly pressureTier?: ChatPressureTier | null;
  readonly outcomeHint?: ChatRunOutcome | null;
  readonly affect?: ChatAffectSnapshot | null;
  readonly audienceHeat?: ChatAudienceHeat | null;
  readonly reputation?: ChatReputationState | null;
  readonly rescueDecision?: ChatRescueDecision | null;
  readonly learningProfile?: ChatLearningProfile | null;
  readonly stageMood?: ChatStageMood | null;
  readonly witnessDensity?: number | null;
  readonly publicExposure01: Score01;
  readonly humiliationRisk01: Score01;
  readonly churnRisk01: Score01;
  readonly comebackPotential01: Score01;
  readonly notes: readonly string[];
}

// ============================================================================
// MARK: Telegraphs, attacks, phases
// ============================================================================

export interface ChatBossTelegraph {
  readonly telegraphId: ChatBossTelegraphId;
  readonly label: string;
  readonly attackClass: ChatBossAttackClass;
  readonly openingMode: ChatBossOpeningMode;
  readonly visibleToPlayer: boolean;
  readonly canFakeOut: boolean;
  readonly typingTheaterRecommended: boolean;
  readonly silenceLeadInMs: number;
  readonly revealDelayMs: number;
  readonly beatCount: number;
  readonly demandHints: readonly ChatBossCounterDemand[];
  readonly notes: readonly string[];
}

export interface ChatBossAttack {
  readonly attackId: ChatBossAttackId;
  readonly patternId: ChatBossPatternId;
  readonly label: string;
  readonly attackType: ChatAttackType;
  readonly attackClass: ChatBossAttackClass;
  readonly severity: ChatBossAttackSeverity;
  readonly primaryPunishment: ChatBossPunishmentClass;
  readonly counterDemands: readonly ChatBossCounterDemand[];
  readonly preferredCounterTiming: ChatCounterTimingClass;
  readonly preferredCounterModes: readonly ChatCounterExecutionMode[];
  readonly telegraph: ChatBossTelegraph;
  readonly opensCounterWindow: boolean;
  readonly allowsSilenceOutplay: boolean;
  readonly allowsHelperAssistance: boolean;
  readonly allowsNegotiationEscape: boolean;
  readonly proofWeighted: boolean;
  readonly quoteWeighted: boolean;
  readonly crowdAmplified: boolean;
  readonly timeboxedMs?: number | null;
  readonly pressureDeltaScore: Score100;
  readonly embarrassmentDeltaScore: Score100;
  readonly dominanceDeltaScore: Score100;
  readonly reputationDeltaScore: Score100;
  readonly notes: readonly string[];
}

export interface ChatBossCounterWindowBinding {
  readonly windowId: ChatCounterWindowId;
  readonly attackId: ChatBossAttackId;
  readonly createdAt: UnixMs;
  readonly expiresAt: UnixMs;
  readonly requiredDemands: readonly ChatBossCounterDemand[];
  readonly idealTiming: ChatCounterTimingClass;
  readonly primaryPunishment: ChatBossPunishmentClass;
  readonly counterplayPlan?: ChatCounterplayPlan | null;
  readonly notes: readonly string[];
}

export interface ChatBossPhase {
  readonly phaseId: ChatBossPhaseId;
  readonly phaseKind: ChatBossPhaseKind;
  readonly label: string;
  readonly order: number;
  readonly attacks: readonly ChatBossAttack[];
  readonly minRounds: number;
  readonly maxRounds: number;
  readonly escalationThreshold01: Score01;
  readonly breakThreshold01: Score01;
  readonly rescueThreshold01: Score01;
  readonly crowdHeatMultiplier: number;
  readonly pressureMultiplier: number;
  readonly reputationMultiplier: number;
  readonly unlocksLegendOnWin: boolean;
  readonly notes: readonly string[];
}

export interface ChatBossPatternDescriptor {
  readonly patternId: ChatBossPatternId;
  readonly label: string;
  readonly fightKind: ChatBossFightKind;
  readonly openingMode: ChatBossOpeningMode;
  readonly preferredSceneArchetype?: SharedChatSceneArchetype | null;
  readonly preferredSceneRole?: SharedChatSceneRole | null;
  readonly momentTypeHint?: SharedChatMomentType | null;
  readonly memoryEventHint?: EpisodicMemoryEventType | null;
  readonly publicEncounter: boolean;
  readonly negotiationEncounter: boolean;
  readonly rescueSensitive: boolean;
  readonly legendEligible: boolean;
  readonly notes: readonly string[];
}

// ============================================================================
// MARK: Fight plans and state
// ============================================================================

export interface ChatBossFightPlan {
  readonly bossFightId: ChatBossFightId;
  readonly kind: ChatBossFightKind;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly visibleChannel: ChatVisibleChannel;
  readonly requestId?: ChatRequestId | null;
  readonly sessionId?: ChatSessionId | null;
  readonly momentId?: ChatMomentId | null;
  readonly sceneId?: ChatSceneId | null;
  readonly plannedAt: UnixMs;
  readonly startsAt: UnixMs;
  readonly expectedEndAt?: UnixMs | null;
  readonly boss: ChatBossFightActor;
  readonly player: ChatBossFightActor;
  readonly supportActors: readonly ChatBossFightActor[];
  readonly pattern: ChatBossPatternDescriptor;
  readonly phases: readonly ChatBossPhase[];
  readonly initialState: ChatBossFightState;
  readonly openingMood?: ChatStageMood | null;
  readonly publicExposure01: Score01;
  readonly rescueAllowed: boolean;
  readonly shadowLedgerEnabled: boolean;
  readonly legendEligible: boolean;
  readonly notes: readonly string[];
}

export interface ChatBossRound {
  readonly roundId: ChatBossRoundId;
  readonly bossFightId: ChatBossFightId;
  readonly phaseId: ChatBossPhaseId;
  readonly order: number;
  readonly attack: ChatBossAttack;
  readonly stateAtOpen: ChatBossFightState;
  readonly openedAt: UnixMs;
  readonly closesAt: UnixMs;
  readonly counterWindow?: ChatBossCounterWindowBinding | null;
  readonly resolvedAt?: UnixMs | null;
  readonly counterResolution?: ChatCounterplayResolution | null;
  readonly punishmentApplied: boolean;
  readonly notes: readonly string[];
}

export interface ChatBossFightSnapshot {
  readonly bossFightId: ChatBossFightId;
  readonly state: ChatBossFightState;
  readonly kind: ChatBossFightKind;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly currentPhaseId?: ChatBossPhaseId | null;
  readonly currentRoundId?: ChatBossRoundId | null;
  readonly phaseIndex: number;
  readonly roundIndex: number;
  readonly publicExposure01: Score01;
  readonly accumulatedPressureScore: Score100;
  readonly accumulatedEmbarrassmentScore: Score100;
  readonly accumulatedDominanceScore: Score100;
  readonly accumulatedReputationSwingScore: Score100;
  readonly playerStabilityScore: Score100;
  readonly bossControlScore: Score100;
  readonly rescueUrgencyScore: Score100;
  readonly legendChargeScore: Score100;
  readonly activeCounterWindowIds: readonly ChatCounterWindowId[];
  readonly notes: readonly string[];
}

export interface ChatBossFightLedger {
  readonly ledgerId: ChatBossStateLedgerId;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly activeFight?: ChatBossFightPlan | null;
  readonly snapshot?: ChatBossFightSnapshot | null;
  readonly rounds: readonly ChatBossRound[];
  readonly archivedResolutionIds: readonly ChatBossResolutionId[];
  readonly lastUpdatedAt: UnixMs;
  readonly contractVersion: typeof CHAT_BOSS_FIGHT_CONTRACT_VERSION;
  readonly inheritedChatContractVersion: typeof CHAT_CONTRACT_VERSION;
}

// ============================================================================
// MARK: Resolution surfaces
// ============================================================================

export interface ChatBossLegendHint {
  readonly legendClass: ChatBossLegendClass;
  readonly rewardHookId?: ChatBossRewardHookId | null;
  readonly replayId?: ChatReplayId | null;
  readonly memoryAnchorIds?: readonly ChatMemoryAnchorId[];
  readonly proofHash?: ChatProofHash | null;
  readonly titleHint?: string | null;
  readonly notes: readonly string[];
}

export interface ChatBossFightResolution {
  readonly resolutionId: ChatBossResolutionId;
  readonly bossFightId: ChatBossFightId;
  readonly resolvedAt: UnixMs;
  readonly resolutionClass: ChatBossResolutionClass;
  readonly playerWon: boolean;
  readonly bossBroken: boolean;
  readonly rescued: boolean;
  readonly aborted: boolean;
  readonly totalRounds: number;
  readonly finalPhaseId?: ChatBossPhaseId | null;
  readonly finalRoundId?: ChatBossRoundId | null;
  readonly peakPressureScore: Score100;
  readonly peakEmbarrassmentScore: Score100;
  readonly finalDominanceScore: Score100;
  readonly finalReputationSwingScore: Score100;
  readonly strongestCounterBand?: ChatCounterEfficacyBand | null;
  readonly strongestCounterplayId?: string | null;
  readonly legendHint?: ChatBossLegendHint | null;
  readonly replayId?: ChatReplayId | null;
  readonly likelyMemoryEvent?: EpisodicMemoryEventType | null;
  readonly notes: readonly string[];
}

// ============================================================================
// MARK: Pattern registry
// ============================================================================

export const CHAT_BOSS_PATTERNS = Object.freeze([
  {
    patternId: 'boss.public.shame' as ChatBossPatternId,
    label: 'Public Shame Spiral',
    fightKind: 'PUBLIC_HUMILIATION',
    openingMode: 'CROWD_PRIMED',
    preferredSceneArchetype: 'PUBLIC_HUMILIATION_SCENE',
    preferredSceneRole: 'PRESSURE',
    momentTypeHint: 'PLAYER_FAILURE',
    memoryEventHint: 'HUMILIATION',
    publicEncounter: true,
    negotiationEncounter: false,
    rescueSensitive: true,
    legendEligible: true,
    notes: ['Crowd heat and witness density amplify every exchange.'],
  },
  {
    patternId: 'boss.shield.siege' as ChatBossPatternId,
    label: 'Shield Siege',
    fightKind: 'SHIELD_SIEGE',
    openingMode: 'STAGGERED',
    preferredSceneArchetype: 'BREACH_SCENE',
    preferredSceneRole: 'PRESSURE',
    momentTypeHint: 'SHIELD_BREACH',
    memoryEventHint: 'BREACH',
    publicEncounter: true,
    negotiationEncounter: false,
    rescueSensitive: true,
    legendEligible: true,
    notes: ['Focuses on pressure, collapse, and stabilization windows.'],
  },
  {
    patternId: 'boss.dealroom.ambush' as ChatBossPatternId,
    label: 'Deal Room Ambush',
    fightKind: 'DEAL_ROOM_AMBUSH',
    openingMode: 'NEGOTIATION_READ_DELAYED',
    preferredSceneArchetype: 'DEAL_ROOM_PRESSURE_SCENE',
    preferredSceneRole: 'PRESSURE',
    momentTypeHint: 'NEGOTIATION_WINDOW',
    memoryEventHint: 'DEAL_ROOM_STANDOFF',
    publicEncounter: false,
    negotiationEncounter: true,
    rescueSensitive: false,
    legendEligible: false,
    notes: ['Repricing, false urgency, and read-pressure are the primary weapons.'],
  },
  {
    patternId: 'boss.final.word' as ChatBossPatternId,
    label: 'Final Word Duel',
    fightKind: 'FINAL_WORD_DUEL',
    openingMode: 'IMMEDIATE',
    preferredSceneArchetype: 'LONG_ARC_CALLBACK_SCENE',
    preferredSceneRole: 'CALLBACK',
    momentTypeHint: 'COMEBACK_WINDOW',
    memoryEventHint: 'PERFECT_DEFENSE',
    publicEncounter: true,
    negotiationEncounter: true,
    rescueSensitive: false,
    legendEligible: true,
    notes: ['The boss tries to own the final perception frame.'],
  },
] as const satisfies readonly ChatBossPatternDescriptor[]);

// ============================================================================
// MARK: Deterministic helpers
// ============================================================================

function clamp01Number(value: number): number {
  if (Number.isNaN(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function clamp100Number(value: number): number {
  if (Number.isNaN(value) || value <= 0) return 0;
  if (value >= 100) return 100;
  return Number(value.toFixed(3));
}

export function toScore01(value: number): Score01 {
  return clamp01Number(value) as Score01;
}

export function toScore100(value: number): Score100 {
  return clamp100Number(value) as Score100;
}

export function score100To01(value: Score100 | number | null | undefined): Score01 {
  return toScore01((Number(value ?? 0) || 0) / 100);
}

export function deriveBossFightInitialState(
  plan: Pick<ChatBossFightPlan, 'pattern' | 'startsAt' | 'plannedAt'>,
): ChatBossFightState {
  if (Number(plan.startsAt) <= Number(plan.plannedAt)) {
    return plan.pattern.openingMode === 'IMMEDIATE' ? 'WINDOW_OPEN' : 'TELEGRAPHING';
  }
  return 'STAGED';
}

export function deriveBossTelegraph(
  attackClass: ChatBossAttackClass,
  openingMode: ChatBossOpeningMode,
): ChatBossTelegraph {
  switch (attackClass) {
    case 'QUOTE_TRAP':
      return {
        telegraphId: (`telegraph:${attackClass}`) as ChatBossTelegraphId,
        label: 'Quote Trap Telegraph',
        attackClass,
        openingMode,
        visibleToPlayer: true,
        canFakeOut: true,
        typingTheaterRecommended: true,
        silenceLeadInMs: 650,
        revealDelayMs: 1100,
        beatCount: 2,
        demandHints: ['QUOTE_REPLY', 'TIMED_REPLY'],
        notes: ['Lets the player feel the callback before the trap fully lands.'],
      };
    case 'PROOF_CHALLENGE':
      return {
        telegraphId: (`telegraph:${attackClass}`) as ChatBossTelegraphId,
        label: 'Proof Challenge Telegraph',
        attackClass,
        openingMode,
        visibleToPlayer: true,
        canFakeOut: false,
        typingTheaterRecommended: false,
        silenceLeadInMs: 300,
        revealDelayMs: 500,
        beatCount: 1,
        demandHints: ['PROOF_REPLY', 'TIMED_REPLY'],
        notes: ['Minimal ceremony; the boss wants immediate evidence pressure.'],
      };
    case 'SILENCE_BAIT':
      return {
        telegraphId: (`telegraph:${attackClass}`) as ChatBossTelegraphId,
        label: 'Silence Bait Telegraph',
        attackClass,
        openingMode,
        visibleToPlayer: false,
        canFakeOut: true,
        typingTheaterRecommended: true,
        silenceLeadInMs: 1800,
        revealDelayMs: 600,
        beatCount: 1,
        demandHints: ['SILENCE_REPLY'],
        notes: ['The real attack is the pressure of waiting.'],
      };
    default:
      return {
        telegraphId: (`telegraph:${attackClass}`) as ChatBossTelegraphId,
        label: 'Standard Telegraph',
        attackClass,
        openingMode,
        visibleToPlayer: true,
        canFakeOut: false,
        typingTheaterRecommended: true,
        silenceLeadInMs: 400,
        revealDelayMs: 700,
        beatCount: 1,
        demandHints: ['VISIBLE_REPLY', 'TIMED_REPLY'],
        notes: ['Standard authored boss-fight telegraph.'],
      };
  }
}

export function deriveBossCounterDemands(
  attackClass: ChatBossAttackClass,
): readonly ChatBossCounterDemand[] {
  switch (attackClass) {
    case 'QUOTE_TRAP':
      return ['QUOTE_REPLY', 'TIMED_REPLY'];
    case 'PROOF_CHALLENGE':
      return ['PROOF_REPLY', 'TIMED_REPLY'];
    case 'PUBLIC_SHAME':
      return ['VISIBLE_REPLY', 'TIMED_REPLY'];
    case 'DEAL_ROOM_SQUEEZE':
      return ['NEGOTIATION_REPLY', 'TIMED_REPLY'];
    case 'SILENCE_BAIT':
      return ['SILENCE_REPLY'];
    case 'HELPER_DENIAL':
      return ['VISIBLE_REPLY', 'HELPER_REPLY'];
    case 'TIMEBOXED_DEMAND':
      return ['TIMED_REPLY'];
    case 'FALSE_RESPECT':
      return ['QUOTE_REPLY', 'VISIBLE_REPLY'];
    default:
      return ['VISIBLE_REPLY'];
  }
}

export function deriveBossPunishmentScores(
  punishment: ChatBossPunishmentClass,
): {
  pressure: Score100;
  embarrassment: Score100;
  dominance: Score100;
  reputation: Score100;
} {
  switch (punishment) {
    case 'EMBARRASSMENT_SPIKE':
      return {
        pressure: toScore100(38),
        embarrassment: toScore100(76),
        dominance: toScore100(55),
        reputation: toScore100(42),
      };
    case 'PRESSURE_SPIKE':
      return {
        pressure: toScore100(82),
        embarrassment: toScore100(30),
        dominance: toScore100(48),
        reputation: toScore100(24),
      };
    case 'SHIELD_DAMAGE':
      return {
        pressure: toScore100(68),
        embarrassment: toScore100(22),
        dominance: toScore100(62),
        reputation: toScore100(18),
      };
    case 'DEAL_REPRICE':
      return {
        pressure: toScore100(54),
        embarrassment: toScore100(28),
        dominance: toScore100(40),
        reputation: toScore100(50),
      };
    case 'CROWD_SWARM':
      return {
        pressure: toScore100(60),
        embarrassment: toScore100(64),
        dominance: toScore100(52),
        reputation: toScore100(58),
      };
    default:
      return {
        pressure: toScore100(44),
        embarrassment: toScore100(34),
        dominance: toScore100(36),
        reputation: toScore100(20),
      };
  }
}

export function createBossAttack(
  attackId: ChatBossAttackId,
  patternId: ChatBossPatternId,
  label: string,
  attackType: ChatAttackType,
  attackClass: ChatBossAttackClass,
  severity: ChatBossAttackSeverity,
  punishment: ChatBossPunishmentClass,
  openingMode: ChatBossOpeningMode,
): ChatBossAttack {
  const telegraph = deriveBossTelegraph(attackClass, openingMode);
  const scores = deriveBossPunishmentScores(punishment);

  return {
    attackId,
    patternId,
    label,
    attackType,
    attackClass,
    severity,
    primaryPunishment: punishment,
    counterDemands: deriveBossCounterDemands(attackClass),
    preferredCounterTiming:
      attackClass === 'SILENCE_BAIT'
        ? 'READ_PRESSURE_DELAYED'
        : severity === 'EXECUTION'
          ? 'INSTANT'
          : 'FAST',
    preferredCounterModes:
      attackClass === 'PROOF_CHALLENGE'
        ? ['PLAYER_SELECTED', 'SYSTEM_GUIDED']
        : attackClass === 'DEAL_ROOM_SQUEEZE'
          ? ['PLAYER_TYPED', 'PLAYER_SELECTED', 'AUTO_SUGGESTED']
          : ['PLAYER_TYPED', 'PLAYER_SELECTED'],
    telegraph,
    opensCounterWindow: true,
    allowsSilenceOutplay: attackClass === 'SILENCE_BAIT' || attackClass === 'FALSE_RESPECT',
    allowsHelperAssistance: attackClass !== 'HELPER_DENIAL' && severity !== 'EXECUTION',
    allowsNegotiationEscape: attackClass === 'DEAL_ROOM_SQUEEZE',
    proofWeighted: attackClass === 'PROOF_CHALLENGE' || attackClass === 'DEAL_ROOM_SQUEEZE',
    quoteWeighted: attackClass === 'QUOTE_TRAP' || attackClass === 'FALSE_RESPECT',
    crowdAmplified: attackClass === 'PUBLIC_SHAME' || attackClass === 'CROWD_SIGNAL',
    timeboxedMs:
      attackClass === 'TIMEBOXED_DEMAND'
        ? 2500
        : severity === 'EXECUTION'
          ? 1800
          : 5000,
    pressureDeltaScore: scores.pressure,
    embarrassmentDeltaScore: scores.embarrassment,
    dominanceDeltaScore: scores.dominance,
    reputationDeltaScore: scores.reputation,
    notes: [`severity=${severity}`, `punishment=${punishment}`],
  };
}

export function deriveBossFightEscalationScore(
  snapshot: Pick<
    ChatBossFightSnapshot,
    'accumulatedPressureScore' | 'accumulatedEmbarrassmentScore' | 'bossControlScore'
  >,
  context?: Pick<ChatBossFightContext, 'publicExposure01' | 'humiliationRisk01'> | null,
): Score100 {
  const exposure = Number(context?.publicExposure01 ?? 0.4);
  const humiliation = Number(context?.humiliationRisk01 ?? 0.35);

  return toScore100(
    Number(snapshot.accumulatedPressureScore) * 0.35 +
    Number(snapshot.accumulatedEmbarrassmentScore) * 0.25 +
    Number(snapshot.bossControlScore) * 0.25 +
    exposure * 10 +
    humiliation * 5,
  );
}

export function deriveBossFightBreakScore(
  snapshot: Pick<
    ChatBossFightSnapshot,
    'playerStabilityScore' | 'bossControlScore' | 'rescueUrgencyScore'
  >,
): Score100 {
  return toScore100(
    (100 - Number(snapshot.playerStabilityScore)) * 0.50 +
    Number(snapshot.bossControlScore) * 0.35 +
    Number(snapshot.rescueUrgencyScore) * 0.15,
  );
}

export function deriveBossLegendChargeScore(
  context: Pick<ChatBossFightContext, 'publicExposure01' | 'comebackPotential01'>,
  round: Pick<ChatBossRound, 'counterResolution'>,
): Score100 {
  const counterScore =
    round.counterResolution == null
      ? 0
      : Number(round.counterResolution.pressureReliefScore) * 0.25 +
        Number(round.counterResolution.dominanceSwingScore) * 0.35 +
        (round.counterResolution.legendQualified ? 25 : 0);

  return toScore100(
    Number(context.publicExposure01) * 35 +
    Number(context.comebackPotential01) * 20 +
    counterScore,
  );
}

export function createEmptyBossFightLedger(
  roomId: ChatRoomId,
  channelId: ChatChannelId,
  now: UnixMs,
): ChatBossFightLedger {
  return {
    ledgerId: (`ledger:boss:${roomId}:${channelId}`) as ChatBossStateLedgerId,
    roomId,
    channelId,
    activeFight: null,
    snapshot: null,
    rounds: [],
    archivedResolutionIds: [],
    lastUpdatedAt: now,
    contractVersion: CHAT_BOSS_FIGHT_CONTRACT_VERSION,
    inheritedChatContractVersion: CHAT_CONTRACT_VERSION,
  };
}

export function createBossFightSnapshot(
  plan: ChatBossFightPlan,
  context: ChatBossFightContext,
): ChatBossFightSnapshot {
  return {
    bossFightId: plan.bossFightId,
    state: deriveBossFightInitialState(plan),
    kind: plan.kind,
    roomId: plan.roomId,
    channelId: plan.channelId,
    currentPhaseId: plan.phases[0]?.phaseId ?? null,
    currentRoundId: null,
    phaseIndex: 0,
    roundIndex: 0,
    publicExposure01: plan.publicExposure01,
    accumulatedPressureScore: toScore100(Number(context.humiliationRisk01) * 30),
    accumulatedEmbarrassmentScore: toScore100(Number(context.humiliationRisk01) * 45),
    accumulatedDominanceScore: toScore100(0),
    accumulatedReputationSwingScore: toScore100(0),
    playerStabilityScore: toScore100(
      Number(context.comebackPotential01) * 45 + (1 - Number(context.churnRisk01)) * 55,
    ),
    bossControlScore: toScore100(Number(plan.boss.pressureBias01) * 60),
    rescueUrgencyScore: toScore100(Number(context.churnRisk01) * 100),
    legendChargeScore: toScore100(Number(plan.publicExposure01) * 25),
    activeCounterWindowIds: [],
    notes: [`initialState=${deriveBossFightInitialState(plan)}`],
  };
}

export function applyBossAttackToSnapshot(
  snapshot: ChatBossFightSnapshot,
  attack: ChatBossAttack,
  context?: Pick<ChatBossFightContext, 'audienceHeat' | 'publicExposure01'> | null,
): ChatBossFightSnapshot {
  const crowdAmplifier =
    attack.crowdAmplified
      ? 1 + Number(context?.publicExposure01 ?? 0.25) * 0.45
      : 1;

  const heatAmplifier =
    attack.crowdAmplified && context?.audienceHeat != null
      ? 1 + Number(context.audienceHeat.heatScore) / 300
      : 1;

  const pressureGain = Number(attack.pressureDeltaScore) * crowdAmplifier * heatAmplifier;
  const embarrassmentGain =
    Number(attack.embarrassmentDeltaScore) * crowdAmplifier * heatAmplifier;
  const dominanceGain = Number(attack.dominanceDeltaScore) * heatAmplifier;
  const reputationGain = Number(attack.reputationDeltaScore) * crowdAmplifier;

  return {
    ...snapshot,
    accumulatedPressureScore: toScore100(
      Number(snapshot.accumulatedPressureScore) + pressureGain,
    ),
    accumulatedEmbarrassmentScore: toScore100(
      Number(snapshot.accumulatedEmbarrassmentScore) + embarrassmentGain,
    ),
    accumulatedDominanceScore: toScore100(
      Number(snapshot.accumulatedDominanceScore) + dominanceGain,
    ),
    accumulatedReputationSwingScore: toScore100(
      Number(snapshot.accumulatedReputationSwingScore) + reputationGain,
    ),
    bossControlScore: toScore100(Number(snapshot.bossControlScore) + dominanceGain * 0.5),
    playerStabilityScore: toScore100(
      Number(snapshot.playerStabilityScore) - pressureGain * 0.35 - embarrassmentGain * 0.20,
    ),
    notes: [
      ...snapshot.notes,
      `attack=${attack.attackClass}`,
      `pressureGain=${pressureGain.toFixed(2)}`,
      `embarrassmentGain=${embarrassmentGain.toFixed(2)}`,
    ],
  };
}

export function applyCounterResolutionToSnapshot(
  snapshot: ChatBossFightSnapshot,
  resolution: ChatCounterplayResolution,
  context?: Pick<ChatBossFightContext, 'publicExposure01' | 'comebackPotential01'> | null,
): ChatBossFightSnapshot {
  const relief = Number(resolution.pressureReliefScore);
  const dominance = Number(resolution.dominanceSwingScore);
  const reputation = Number(resolution.reputationDeltaScore);

  const legendBoost =
    resolution.legendQualified
      ? 18 + Number(context?.publicExposure01 ?? 0.2) * 20
      : 0;

  return {
    ...snapshot,
    accumulatedPressureScore: toScore100(
      Number(snapshot.accumulatedPressureScore) - relief * 0.8,
    ),
    accumulatedEmbarrassmentScore: toScore100(
      Number(snapshot.accumulatedEmbarrassmentScore) - Number(resolution.embarrassmentSwingScore) * 0.65,
    ),
    accumulatedDominanceScore: toScore100(
      Number(snapshot.accumulatedDominanceScore) - dominance * 0.55,
    ),
    accumulatedReputationSwingScore: toScore100(
      Number(snapshot.accumulatedReputationSwingScore) + reputation * 0.4,
    ),
    playerStabilityScore: toScore100(
      Number(snapshot.playerStabilityScore) + relief * 0.55 + dominance * 0.25,
    ),
    bossControlScore: toScore100(
      Number(snapshot.bossControlScore) - relief * 0.30 - dominance * 0.20,
    ),
    rescueUrgencyScore: toScore100(
      Number(snapshot.rescueUrgencyScore) - relief * 0.45,
    ),
    legendChargeScore: toScore100(
      Number(snapshot.legendChargeScore) + legendBoost + Number(context?.comebackPotential01 ?? 0.2) * 8,
    ),
    notes: [
      ...snapshot.notes,
      `counter=${resolution.counterplayId}`,
      `relief=${relief.toFixed(2)}`,
      `dominanceSwing=${dominance.toFixed(2)}`,
    ],
  };
}

export function inferBossResolutionClass(
  snapshot: ChatBossFightSnapshot,
  strongestCounterBand?: ChatCounterEfficacyBand | null,
  rescueDecision?: ChatRescueDecision | null,
): ChatBossResolutionClass {
  if (rescueDecision != null && Number(snapshot.rescueUrgencyScore) >= 70) {
    return 'RESCUE_EXTRACTION';
  }
  if (snapshot.state === 'ABORTED') return 'SYSTEM_ABORT';
  if (Number(snapshot.playerStabilityScore) <= 12 && Number(snapshot.bossControlScore) >= 72) {
    return 'BOSS_EXECUTION';
  }
  if (Number(snapshot.playerStabilityScore) <= 28) {
    return 'BOSS_ADVANTAGE';
  }
  if (strongestCounterBand === 'LEGENDARY' || Number(snapshot.legendChargeScore) >= 88) {
    return 'PLAYER_DOMINATES';
  }
  if (strongestCounterBand === 'DOMINANT' || Number(snapshot.playerStabilityScore) >= 64) {
    return 'PLAYER_STABILIZES';
  }
  return 'MUTUAL_STANDOFF';
}

export function inferBossLegendClass(
  resolutionClass: ChatBossResolutionClass,
  strongestCounterBand?: ChatCounterEfficacyBand | null,
  publicExposure01: Score01 | number = 0,
): ChatBossLegendClass {
  if (resolutionClass === 'RESCUE_EXTRACTION') return 'MIRACLE_ESCAPE';
  if (strongestCounterBand === 'LEGENDARY' && Number(publicExposure01) >= 0.45) {
    return 'PUBLIC_REVERSAL';
  }
  if (strongestCounterBand === 'LEGENDARY') return 'PERFECT_DEFENSE';
  if (resolutionClass === 'PLAYER_DOMINATES' && Number(publicExposure01) >= 0.60) {
    return 'LAST_WORD';
  }
  if (resolutionClass === 'PLAYER_STABILIZES' && Number(publicExposure01) >= 0.50) {
    return 'RECEIPT_EXECUTION';
  }
  return 'NONE';
}

export function inferBossMemoryEvent(
  kind: ChatBossFightKind,
  resolutionClass: ChatBossResolutionClass,
): EpisodicMemoryEventType | null {
  if (resolutionClass === 'RESCUE_EXTRACTION') return 'RESCUE';
  if (resolutionClass === 'PLAYER_DOMINATES') return 'PERFECT_DEFENSE';
  if (resolutionClass === 'BOSS_EXECUTION') return 'COLLAPSE';

  switch (kind) {
    case 'PUBLIC_HUMILIATION':
      return 'HUMILIATION';
    case 'DEAL_ROOM_AMBUSH':
      return 'DEAL_ROOM_STANDOFF';
    case 'SHIELD_SIEGE':
      return 'BREACH';
    case 'RIVAL_ASCENSION':
      return 'COMEBACK';
    default:
      return null;
  }
}

export function resolveBossFight(
  plan: ChatBossFightPlan,
  snapshot: ChatBossFightSnapshot,
  rounds: readonly ChatBossRound[],
  resolvedAt: UnixMs,
  rescueDecision?: ChatRescueDecision | null,
): ChatBossFightResolution {
  const strongestResolution = rounds
    .map((round) => round.counterResolution)
    .filter((value): value is ChatCounterplayResolution => value != null)
    .sort((a, b) => Number(b.pressureReliefScore) - Number(a.pressureReliefScore))[0] ?? null;

  const strongestCounterBand = strongestResolution?.efficacyBand ?? null;
  const resolutionClass = inferBossResolutionClass(snapshot, strongestCounterBand, rescueDecision);
  const legendClass = inferBossLegendClass(
    resolutionClass,
    strongestCounterBand,
    snapshot.publicExposure01,
  );

  return {
    resolutionId: (`resolve:${plan.bossFightId}`) as ChatBossResolutionId,
    bossFightId: plan.bossFightId,
    resolvedAt,
    resolutionClass,
    playerWon:
      resolutionClass === 'PLAYER_DOMINATES' || resolutionClass === 'PLAYER_STABILIZES',
    bossBroken: resolutionClass === 'PLAYER_DOMINATES',
    rescued: resolutionClass === 'RESCUE_EXTRACTION',
    aborted: resolutionClass === 'SYSTEM_ABORT',
    totalRounds: rounds.length,
    finalPhaseId: snapshot.currentPhaseId ?? null,
    finalRoundId: snapshot.currentRoundId ?? null,
    peakPressureScore: snapshot.accumulatedPressureScore,
    peakEmbarrassmentScore: snapshot.accumulatedEmbarrassmentScore,
    finalDominanceScore: snapshot.accumulatedDominanceScore,
    finalReputationSwingScore: snapshot.accumulatedReputationSwingScore,
    strongestCounterBand,
    strongestCounterplayId: strongestResolution?.counterplayId ?? null,
    legendHint:
      legendClass === 'NONE'
        ? null
        : {
            legendClass,
            rewardHookId: (`reward:${plan.bossFightId}`) as ChatBossRewardHookId,
            replayId: null,
            memoryAnchorIds: [],
            proofHash: null,
            titleHint: plan.kind === 'FINAL_WORD_DUEL' ? 'Last Word' : 'Bossbreaker',
            notes: [`legendClass=${legendClass}`],
          },
    replayId: null,
    likelyMemoryEvent: inferBossMemoryEvent(plan.kind, resolutionClass),
    notes: [
      `resolution=${resolutionClass}`,
      `strongestBand=${strongestCounterBand ?? 'NONE'}`,
    ],
  };
}

// ============================================================================
// MARK: Policy predicates
// ============================================================================

export function shouldStartBossFight(
  context: Pick<
    ChatBossFightContext,
    'pressureTier' | 'humiliationRisk01' | 'publicExposure01' | 'witnessDensity'
  >,
  attackType: ChatAttackType,
  pattern: ChatBossPatternDescriptor,
): boolean {
  if (pattern.fightKind === 'DEAL_ROOM_AMBUSH') {
    return attackType === 'NEGOTIATION_TRAP';
  }

  if (attackType === 'SHIELD_BREAK' || attackType === 'CASCADE_PUSH') {
    return true;
  }

  const pressureBoost =
    context.pressureTier === 'CRITICAL'
      ? 0.25
      : context.pressureTier === 'HIGH'
        ? 0.18
        : 0.10;

  const exposure = Number(context.publicExposure01);
  const humiliation = Number(context.humiliationRisk01);
  const witnesses = Math.min(1, Number(context.witnessDensity ?? 0) / 10);

  return humiliation + exposure * 0.4 + witnesses * 0.15 + pressureBoost >= 0.72;
}

export function shouldAdvanceBossPhase(
  snapshot: ChatBossFightSnapshot,
  phase: ChatBossPhase,
): boolean {
  const escalation = deriveBossFightEscalationScore(snapshot);
  const breakScore = deriveBossFightBreakScore(snapshot);

  return (
    Number(escalation) >= Number(phase.escalationThreshold01) * 100 ||
    Number(breakScore) >= Number(phase.breakThreshold01) * 100
  );
}

export function isBossFightBroken(
  snapshot: ChatBossFightSnapshot,
): boolean {
  return Number(snapshot.bossControlScore) <= 16 && Number(snapshot.playerStabilityScore) >= 66;
}

export function isBossFightLost(
  snapshot: ChatBossFightSnapshot,
): boolean {
  return Number(snapshot.playerStabilityScore) <= 10 && Number(snapshot.bossControlScore) >= 75;
}

// ============================================================================
// MARK: Default phase factories
// ============================================================================

export function createDefaultBossPhases(
  pattern: ChatBossPatternDescriptor,
): readonly ChatBossPhase[] {
  const intro = {
    phaseId: (`phase:${pattern.patternId}:intro`) as ChatBossPhaseId,
    phaseKind: 'INTRO',
    label: 'Intro',
    order: 0,
    attacks: [
      createBossAttack(
        (`attack:${pattern.patternId}:intro`) as ChatBossAttackId,
        pattern.patternId,
        'Opening Probe',
        'TAUNT',
        'TAUNT_SPIKE',
        'PROBING',
        'PRESSURE_SPIKE',
        pattern.openingMode,
      ),
    ],
    minRounds: 1,
    maxRounds: 1,
    escalationThreshold01: toScore01(0.32),
    breakThreshold01: toScore01(0.75),
    rescueThreshold01: toScore01(0.90),
    crowdHeatMultiplier: 1,
    pressureMultiplier: 1,
    reputationMultiplier: 1,
    unlocksLegendOnWin: false,
    notes: ['Entry phase.'],
  } as const satisfies ChatBossPhase;

  const pressure = {
    phaseId: (`phase:${pattern.patternId}:pressure`) as ChatBossPhaseId,
    phaseKind: 'PRESSURE',
    label: 'Pressure',
    order: 1,
    attacks: [
      createBossAttack(
        (`attack:${pattern.patternId}:pressure:1`) as ChatBossAttackId,
        pattern.patternId,
        'Timed Demand',
        pattern.negotiationEncounter ? 'NEGOTIATION_TRAP' : 'PRESSURE_SPIKE',
        pattern.negotiationEncounter ? 'DEAL_ROOM_SQUEEZE' : 'TIMEBOXED_DEMAND',
        'HEAVY',
        pattern.negotiationEncounter ? 'DEAL_REPRICE' : 'PRESSURE_SPIKE',
        pattern.openingMode,
      ),
      createBossAttack(
        (`attack:${pattern.patternId}:pressure:2`) as ChatBossAttackId,
        pattern.patternId,
        'Quote Compression',
        'TELEGRAPH',
        'QUOTE_TRAP',
        'HEAVY',
        'EMBARRASSMENT_SPIKE',
        pattern.openingMode,
      ),
    ],
    minRounds: 1,
    maxRounds: 2,
    escalationThreshold01: toScore01(0.58),
    breakThreshold01: toScore01(0.82),
    rescueThreshold01: toScore01(0.78),
    crowdHeatMultiplier: pattern.publicEncounter ? 1.25 : 1,
    pressureMultiplier: 1.2,
    reputationMultiplier: pattern.negotiationEncounter ? 1.3 : 1.05,
    unlocksLegendOnWin: false,
    notes: ['Core pressure phase.'],
  } as const satisfies ChatBossPhase;

  const finisher = {
    phaseId: (`phase:${pattern.patternId}:finisher`) as ChatBossPhaseId,
    phaseKind: 'FINISHER',
    label: 'Finisher',
    order: 2,
    attacks: [
      createBossAttack(
        (`attack:${pattern.patternId}:finisher`) as ChatBossAttackId,
        pattern.patternId,
        pattern.publicEncounter ? 'Public Execution Attempt' : 'Closing Trap',
        pattern.negotiationEncounter ? 'NEGOTIATION_TRAP' : 'SHIELD_BREAK',
        pattern.publicEncounter ? 'PUBLIC_SHAME' : 'PROOF_CHALLENGE',
        'EXECUTION',
        pattern.publicEncounter ? 'CROWD_SWARM' : 'SHIELD_DAMAGE',
        pattern.openingMode,
      ),
    ],
    minRounds: 1,
    maxRounds: 1,
    escalationThreshold01: toScore01(0.78),
    breakThreshold01: toScore01(0.90),
    rescueThreshold01: toScore01(0.70),
    crowdHeatMultiplier: pattern.publicEncounter ? 1.5 : 1.1,
    pressureMultiplier: 1.35,
    reputationMultiplier: 1.25,
    unlocksLegendOnWin: pattern.legendEligible,
    notes: ['High-salience closing phase.'],
  } as const satisfies ChatBossPhase;

  return [intro, pressure, finisher];
}

// ============================================================================
// MARK: Fight plan builders
// ============================================================================

export function buildBossFightPlan(
  bossFightId: ChatBossFightId,
  kind: ChatBossFightKind,
  boss: ChatBossFightActor,
  player: ChatBossFightActor,
  context: ChatBossFightContext,
  pattern: ChatBossPatternDescriptor,
  plannedAt: UnixMs,
  startsAt: UnixMs,
  supportActors: readonly ChatBossFightActor[] = [],
): ChatBossFightPlan {
  const phases = createDefaultBossPhases(pattern);

  const basePublicExposure =
    pattern.publicEncounter
      ? Math.max(Number(context.publicExposure01), 0.45)
      : Number(context.publicExposure01) * 0.65;

  return {
    bossFightId,
    kind,
    roomId: context.roomId,
    channelId: context.channelId,
    visibleChannel: context.visibleChannel,
    requestId: context.requestId ?? null,
    sessionId: context.sessionId ?? null,
    momentId: context.momentId ?? null,
    sceneId: context.sceneId ?? null,
    plannedAt,
    startsAt,
    expectedEndAt: ((Number(startsAt) + 15000) as UnixMs),
    boss,
    player,
    supportActors,
    pattern,
    phases,
    initialState: deriveBossFightInitialState({ pattern, startsAt, plannedAt }),
    openingMood: context.stageMood ?? null,
    publicExposure01: toScore01(basePublicExposure),
    rescueAllowed: pattern.rescueSensitive,
    shadowLedgerEnabled: true,
    legendEligible: pattern.legendEligible,
    notes: [
      `kind=${kind}`,
      `pattern=${pattern.patternId}`,
      `publicExposure=${basePublicExposure.toFixed(3)}`,
    ],
  };
}
