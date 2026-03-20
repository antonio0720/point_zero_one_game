/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND NPC PRESENCE STYLE REGISTRY
 * FILE: pzo-web/src/engines/chat/presence/NpcPresenceStyle.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend registry and planning layer for ambient presence theater.
 *
 * This file gives the pzo-web chat engine a deterministic, repo-faithful way to
 * decide how rivals, helpers, deal-room agents, crowd voices, and liveops actors
 * should *feel* before a literal message lands. It bridges:
 *
 * - /shared/contracts/chat/ChatPresenceStyle.ts
 * - /pzo-web/src/engines/chat/ChatPresenceController.ts
 * - /pzo-web/src/engines/chat/ChatTypingController.ts
 * - /pzo-web/src/engines/chat/ChatBotResponseDirector.ts
 * - /pzo-web/src/engines/chat/types.ts
 *
 * Design doctrine
 * ---------------
 * 1. Presence is authored state, not an afterthought.
 * 2. The frontend may stage pressure quickly, but backend remains sovereign over
 *    final transcript truth and durable replay/ledger state.
 * 3. GLOBAL should feel theatrical, SYNDICATE intimate, DEAL_ROOM predatory,
 *    LOBBY socially readable, and shadow channels latent.
 * 4. A rival should be recognizable by delay rhythm before text appears.
 * 5. A helper should time care without becoming spam.
 * 6. A deal-room entity should weaponize unread, pause, and feint.
 * 7. A style planner must remain deterministic, inspectable, and debug-friendly.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  CHAT_PRESENCE_DEFAULT_LURK_WINDOW,
  CHAT_PRESENCE_DEFAULT_READ_WINDOW,
  CHAT_PRESENCE_DEFAULT_TYPING_WINDOW,
  createChatPresenceCue,
  createChatPresenceStyle,
  isChatPresenceShadowChannel,
  type ChatPresenceActorKind as SharedChatPresenceActorKind,
  type ChatPresenceAddressableChannel,
  type ChatPresenceChannelProfile,
  type ChatPresenceCue,
  type ChatPresenceIntent,
  type ChatPresenceInterruptionProfile,
  type ChatPresenceLatencyWindow,
  type ChatPresenceLurkPolicy,
  type ChatPresencePosture,
  type ChatPresencePressureMode,
  type ChatPresenceReadPolicy,
  type ChatPresenceSignalInput,
  type ChatPresenceStyle,
  type ChatPresenceTrigger,
  type ChatPresenceTypingPhase,
} from '../../../../../shared/contracts/chat/ChatPresenceStyle';

import type {
  ChatActorKind,
  ChatChannelId,
  ChatPresenceState,
  ChatShadowChannel,
  ChatTypingState,
  ChatVisibleChannel,
  JsonObject,
  PressureTier,
  Score100,
  TickTier,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: Local registry contracts
// ============================================================================

export type NpcPresenceArchetype =
  | 'LIQUIDATOR_RIVAL'
  | 'PREDATORY_RIVAL'
  | 'SWARM_RIVAL'
  | 'STEADY_HELPER'
  | 'BLUNT_HELPER'
  | 'NEGOTIATION_BROKER'
  | 'CEREMONIAL_SYSTEM'
  | 'CROWD_WITNESS'
  | 'LIVEOPS_OPERATOR'
  | 'AMBIENT_WATCHER';

export type NpcPresenceReactionMode =
  | 'INSTANT_STRIKE'
  | 'STEADY'
  | 'SLOW_BURN'
  | 'FEINT'
  | 'STALL'
  | 'RESCUE_HOLD'
  | 'NEUTRAL';

export interface NpcPresenceRuntimeContext {
  readonly now: UnixMs;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly trigger: ChatPresenceTrigger;
  readonly preferredIntent?: ChatPresenceIntent;
  readonly currentPressureTier?: PressureTier;
  readonly currentTickTier?: TickTier;
  readonly pressureScore?: number;
  readonly tensionScore?: number;
  readonly urgencyScore?: number;
  readonly embarrassmentScore?: number;
  readonly rescueRiskScore?: number;
  readonly rivalryScore?: number;
  readonly crowdHeatScore?: number;
  readonly negotiationRiskScore?: number;
  readonly worldEventWeight?: number;
  readonly helperProtectionWindowActive?: boolean;
  readonly legendCandidate?: boolean;
  readonly counterplayWindowOpen?: boolean;
  readonly lastVisibleCueAt?: UnixMs;
  readonly lastShadowCueAt?: UnixMs;
  readonly lastReadAt?: UnixMs;
  readonly unreadStreak?: number;
  readonly rescueDebt?: number;
  readonly ignoredAdviceCount?: number;
  readonly comebackCount?: number;
  readonly collapseCount?: number;
  readonly rivalryEscalationCount?: number;
  readonly metadata?: JsonObject;
}

export interface NpcPresenceSessionState {
  readonly actorId: string;
  readonly styleId: string;
  readonly archetype: NpcPresenceArchetype;
  readonly lastVisibleCueAt?: UnixMs;
  readonly lastShadowCueAt?: UnixMs;
  readonly lastTypingAt?: UnixMs;
  readonly lastReadAt?: UnixMs;
  readonly unreadStreak: number;
  readonly rescueDebt: number;
  readonly ignoredAdviceCount: number;
  readonly rivalryEscalationCount: number;
  readonly comebackCount: number;
  readonly collapseCount: number;
}

export interface NpcPresencePlannedCue {
  readonly cue: ChatPresenceCue;
  readonly style: ChatPresenceStyle;
  readonly channelProfile: ChatPresenceChannelProfile;
  readonly typingPhase?: ChatPresenceTypingPhase;
  readonly readPolicy?: ChatPresenceReadPolicy;
  readonly lurkPolicy?: ChatPresenceLurkPolicy;
  readonly localPresenceState: ChatPresenceState;
  readonly localTypingState: ChatTypingState;
  readonly computedLatencyMs: number;
  readonly reactionMode: NpcPresenceReactionMode;
  readonly visibleToPlayer: boolean;
}

export interface NpcPresenceRegistrySnapshot {
  readonly styleCount: number;
  readonly actorBindingCount: number;
  readonly sessionCount: number;
  readonly metrics: NpcPresenceRegistryMetrics;
}

export interface NpcPresenceRegistryMetrics {
  readonly plannedCueCount: number;
  readonly shadowCueCount: number;
  readonly visibleCueCount: number;
  readonly rescueDeferenceCount: number;
  readonly negotiationStallCount: number;
  readonly instantStrikeCount: number;
  readonly feintCount: number;
}

export interface NpcPresenceStyleRegistryOptions {
  readonly styles?: readonly ChatPresenceStyle[];
  readonly log?: (message: string, context?: Record<string, unknown>) => void;
}

interface RegisteredStyleBinding {
  readonly actorId: string;
  readonly styleId: string;
  readonly archetype: NpcPresenceArchetype;
}

const DEFAULT_METRICS: NpcPresenceRegistryMetrics = Object.freeze({
  plannedCueCount: 0,
  shadowCueCount: 0,
  visibleCueCount: 0,
  rescueDeferenceCount: 0,
  negotiationStallCount: 0,
  instantStrikeCount: 0,
  feintCount: 0,
});

const DEFAULT_INTERRUPTION: Readonly<ChatPresenceInterruptionProfile> = Object.freeze({
  mayInterrupt: true,
  basePriority: 50,
  escalationPriority: 85,
  cooldownMs: 900,
  preferredTriggers: ['PRESSURE_CHANGE', 'BOT_ATTACK', 'WORLD_EVENT'],
  blockedByPostures: ['ABSENT', 'LURKING'],
});

const FRONTEND_VISIBLE_CHANNELS: readonly ChatVisibleChannel[] = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
] as const;

const FRONTEND_SHADOW_CHANNELS: readonly ChatShadowChannel[] = [
  'SYSTEM_SHADOW',
  'NPC_SHADOW',
  'RIVALRY_SHADOW',
  'RESCUE_SHADOW',
  'LIVEOPS_SHADOW',
] as const;

// ============================================================================
// MARK: Helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function score(value: number | undefined, fallback = 0): number {
  return clamp(Number.isFinite(value) ? Number(value) : fallback, 0, 100);
}

function asIso(value: UnixMs | number): string {
  return new Date(Number(value)).toISOString();
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicJitter(seed: string, window: ChatPresenceLatencyWindow): number {
  const hash = stableHash(seed);
  const minMs = Math.max(0, window.minMs);
  const maxMs = Math.max(minMs, window.maxMs);
  const range = Math.max(0, maxMs - minMs);
  const offset = range === 0 ? 0 : hash % (range + 1);
  const jitterCap = Math.max(0, window.jitterMs ?? 0);
  const signedJitter = jitterCap === 0 ? 0 : (hash % (jitterCap * 2 + 1)) - jitterCap;
  return clamp(minMs + offset + signedJitter, minMs, maxMs);
}

function toSharedActorKind(kind: ChatActorKind): SharedChatPresenceActorKind {
  switch (kind) {
    case 'PLAYER':
      return 'PLAYER';
    case 'SYSTEM':
      return 'SYSTEM';
    case 'HELPER':
      return 'HELPER';
    case 'DEAL_AGENT':
      return 'DEAL_AGENT';
    case 'LIVEOPS':
      return 'LIVEOPS_AGENT';
    case 'CROWD':
      return 'SPECTATOR_NPC';
    case 'HATER':
      return 'RIVAL';
    case 'AMBIENT_NPC':
    default:
      return 'SPECTATOR_NPC';
  }
}

function defaultPostureForIntent(intent: ChatPresenceIntent): ChatPresencePosture {
  switch (intent) {
    case 'PRESSURE':
    case 'THREAT':
    case 'BAIT':
      return 'WATCHING';
    case 'RESCUE':
    case 'REASSURANCE':
      return 'HESITATING';
    case 'NEGOTIATION':
    case 'STALL':
    case 'DECEPTION':
      return 'LURKING';
    case 'SURVEILLANCE':
      return 'LURKING';
    case 'CEREMONY':
    case 'WITNESS':
    case 'SPECTACLE':
      return 'READING';
    case 'COUNTERPLAY':
      return 'TYPING';
    case 'LURK':
    default:
      return 'LURKING';
  }
}

function postureToPresenceState(posture: ChatPresencePosture): ChatPresenceState {
  switch (posture) {
    case 'ABSENT':
    case 'SUPPRESSED':
    case 'EXPIRED':
      return 'OFFLINE';
    case 'WATCHING':
    case 'QUEUED':
    case 'REVEAL_PENDING':
    case 'DELIVERED':
    case 'IDLE':
      return 'WATCHING';
    case 'READING':
      return 'READING';
    case 'HESITATING':
      return 'THINKING';
    case 'TYPING':
      return 'ACTIVE';
    case 'LURKING':
    default:
      return 'LURKING';
  }
}

function intentToTypingState(intent: ChatPresenceIntent, shadowOnly: boolean): ChatTypingState {
  if (shadowOnly) {
    return 'SIMULATED';
  }
  switch (intent) {
    case 'STALL':
    case 'LURK':
      return 'PAUSED';
    case 'SURVEILLANCE':
      return 'NOT_TYPING';
    case 'PRESSURE':
    case 'THREAT':
    case 'COUNTERPLAY':
    case 'RESCUE':
    case 'NEGOTIATION':
    case 'SPECTACLE':
    case 'WITNESS':
    case 'BAIT':
    case 'DECEPTION':
    case 'CEREMONY':
    case 'REASSURANCE':
    default:
      return 'STARTED';
  }
}

function toPresenceChannel(channelId: ChatChannelId): ChatPresenceAddressableChannel {
  return channelId as unknown as ChatPresenceAddressableChannel;
}

function makeTypingPhase(
  behavior: ChatPresenceTypingPhase['behavior'],
  window: ChatPresenceLatencyWindow,
  overrides: Partial<ChatPresenceTypingPhase> = {},
): ChatPresenceTypingPhase {
  return {
    behavior,
    activeWindow: window,
    burstCount: overrides.burstCount,
    interruptionChance: overrides.interruptionChance,
    cancelChance: overrides.cancelChance,
    canFeint: overrides.canFeint,
    canRestart: overrides.canRestart,
  };
}

function makeReadPolicy(
  behavior: ChatPresenceReadPolicy['behavior'],
  window: ChatPresenceLatencyWindow,
  overrides: Partial<ChatPresenceReadPolicy> = {},
): ChatPresenceReadPolicy {
  return {
    behavior,
    markReadWindow: overrides.markReadWindow ?? window,
    holdUnreadWindow: overrides.holdUnreadWindow,
    pressureEscalationOnUnread: overrides.pressureEscalationOnUnread,
    maySuppressReadReceipt: overrides.maySuppressReadReceipt,
  };
}

function makeLurkPolicy(
  behavior: ChatPresenceLurkPolicy['behavior'],
  window: ChatPresenceLatencyWindow,
  overrides: Partial<ChatPresenceLurkPolicy> = {},
): ChatPresenceLurkPolicy {
  return {
    behavior,
    lurkWindow: overrides.lurkWindow ?? window,
    visibleHintChance: overrides.visibleHintChance,
    shadowAnchorOnly: overrides.shadowAnchorOnly,
    mayEscalateToTyping: overrides.mayEscalateToTyping,
  };
}

function visibleChannelProfile(
  channel: ChatVisibleChannel,
  pressureMode: ChatPresencePressureMode,
  input: Partial<ChatPresenceChannelProfile>,
): ChatPresenceChannelProfile {
  return {
    channel,
    pressureMode,
    typing: input.typing,
    read: input.read,
    lurk: input.lurk,
    revealMode: input.revealMode,
    allowVisibleTyping: input.allowVisibleTyping ?? true,
    allowVisibleReading: input.allowVisibleReading ?? true,
    allowShadowAnchors: input.allowShadowAnchors ?? true,
    maxConcurrentCues: input.maxConcurrentCues ?? 2,
  };
}

function shadowChannelProfile(
  channel: ChatShadowChannel,
  pressureMode: ChatPresencePressureMode,
  input: Partial<ChatPresenceChannelProfile>,
): ChatPresenceChannelProfile {
  return {
    channel,
    pressureMode,
    typing: input.typing,
    read: input.read,
    lurk: input.lurk,
    revealMode: input.revealMode ?? 'MANUAL',
    allowVisibleTyping: input.allowVisibleTyping ?? false,
    allowVisibleReading: input.allowVisibleReading ?? false,
    allowShadowAnchors: input.allowShadowAnchors ?? true,
    maxConcurrentCues: input.maxConcurrentCues ?? 4,
  };
}

function haterStyle(styleId: string, actorId: string, label: string): ChatPresenceStyle {
  return createChatPresenceStyle({
    id: styleId,
    actorId,
    actorKind: 'RIVAL',
    label,
    postureBias: 'WATCHING',
    intentBias: 'PRESSURE',
    intensityBand: 'HIGH',
    defaultLatencyBand: 'FAST',
    interruption: {
      ...DEFAULT_INTERRUPTION,
      basePriority: 70,
      escalationPriority: 92,
    },
    visibleChannels: [
      visibleChannelProfile('GLOBAL', 'CROWD', {
        typing: makeTypingPhase('SHORT_BURST', { minMs: 340, maxMs: 1150, jitterMs: 95 }, {
          interruptionChance: 0.32,
          cancelChance: 0.18,
          canFeint: true,
          canRestart: true,
        }),
        read: makeReadPolicy('STRATEGIC_DELAY', { minMs: 700, maxMs: 2600, jitterMs: 150 }, {
          holdUnreadWindow: { minMs: 1100, maxMs: 4400, jitterMs: 220 },
          pressureEscalationOnUnread: true,
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('EDGE_PEEK', { minMs: 800, maxMs: 3200, jitterMs: 180 }, {
          visibleHintChance: 0.22,
          mayEscalateToTyping: true,
        }),
        revealMode: 'EVENT_TRIGGERED',
        maxConcurrentCues: 2,
      }),
      visibleChannelProfile('SYNDICATE', 'RIVALRY', {
        typing: makeTypingPhase('FEINT', { minMs: 520, maxMs: 1900, jitterMs: 130 }, {
          interruptionChance: 0.21,
          cancelChance: 0.25,
          canFeint: true,
          canRestart: true,
        }),
        read: makeReadPolicy('DELAYED', { minMs: 450, maxMs: 1800, jitterMs: 100 }, {
          holdUnreadWindow: { minMs: 900, maxMs: 2800, jitterMs: 150 },
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('SHORT_LURK', { minMs: 700, maxMs: 2400, jitterMs: 140 }, {
          visibleHintChance: 0.1,
          mayEscalateToTyping: true,
        }),
        revealMode: 'EVENT_TRIGGERED',
      }),
      visibleChannelProfile('DEAL_ROOM', 'DEAL_ROOM', {
        typing: makeTypingPhase('AGGRESSIVE_STOP_START', { minMs: 700, maxMs: 2600, jitterMs: 200 }, {
          interruptionChance: 0.42,
          cancelChance: 0.35,
          canFeint: true,
          canRestart: true,
        }),
        read: makeReadPolicy('STRATEGIC_DELAY', { minMs: 1300, maxMs: 6200, jitterMs: 300 }, {
          holdUnreadWindow: { minMs: 1800, maxMs: 8000, jitterMs: 360 },
          pressureEscalationOnUnread: true,
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('PREDATORY_LURK', { minMs: 1400, maxMs: 6600, jitterMs: 280 }, {
          visibleHintChance: 0.06,
          mayEscalateToTyping: true,
        }),
        revealMode: 'NEGOTIATION_TRIGGERED',
      }),
      visibleChannelProfile('LOBBY', 'PREDATORY', {
        typing: makeTypingPhase('STUTTER', { minMs: 480, maxMs: 1800, jitterMs: 120 }, {
          interruptionChance: 0.16,
          cancelChance: 0.14,
        }),
        read: makeReadPolicy('DELAYED', CHAT_PRESENCE_DEFAULT_READ_WINDOW),
        lurk: makeLurkPolicy('SHORT_LURK', CHAT_PRESENCE_DEFAULT_LURK_WINDOW, {
          visibleHintChance: 0.16,
        }),
        revealMode: 'AUTO',
      }),
    ],
    shadowChannels: [
      shadowChannelProfile('RIVALRY_SHADOW', 'RIVALRY', {
        typing: makeTypingPhase('AGGRESSIVE_STOP_START', { minMs: 150, maxMs: 700, jitterMs: 50 }, {
          interruptionChance: 0.45,
          cancelChance: 0.18,
          canFeint: true,
          canRestart: true,
        }),
        read: makeReadPolicy('SHADOW_ONLY', { minMs: 0, maxMs: 0, jitterMs: 0 }, {
          maySuppressReadReceipt: true,
          pressureEscalationOnUnread: true,
        }),
        lurk: makeLurkPolicy('HEAVY_LURK', { minMs: 900, maxMs: 4200, jitterMs: 180 }, {
          shadowAnchorOnly: true,
          mayEscalateToTyping: true,
        }),
        revealMode: 'MANUAL',
      }),
      shadowChannelProfile('NPC_SHADOW', 'PREDATORY', {
        typing: makeTypingPhase('FEINT', { minMs: 200, maxMs: 900, jitterMs: 70 }, {
          canFeint: true,
          canRestart: true,
          cancelChance: 0.22,
        }),
        read: makeReadPolicy('SHADOW_ONLY', { minMs: 0, maxMs: 0, jitterMs: 0 }, {
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('HEAVY_LURK', { minMs: 600, maxMs: 2600, jitterMs: 140 }, {
          shadowAnchorOnly: true,
          mayEscalateToTyping: true,
        }),
      }),
    ],
    firstResponseWindow: { minMs: 300, maxMs: 1500, jitterMs: 120 },
    followUpWindow: { minMs: 600, maxMs: 2600, jitterMs: 180 },
    silencePreference: 0.22,
    unreadPressurePreference: 0.85,
    delayedRevealPreference: 0.68,
    instantStrikePreference: 0.72,
    rescueDeferencePreference: 0.12,
    negotiationPatiencePreference: 0.71,
    crowdTheaterPreference: 0.82,
    tags: ['rival', 'pressure', 'witnessed', 'counterplay'],
  });
}

function helperStyle(styleId: string, actorId: string, label: string, blunt = false): ChatPresenceStyle {
  return createChatPresenceStyle({
    id: styleId,
    actorId,
    actorKind: 'HELPER',
    label,
    postureBias: blunt ? 'WATCHING' : 'HESITATING',
    intentBias: blunt ? 'COUNTERPLAY' : 'RESCUE',
    intensityBand: blunt ? 'MEDIUM' : 'LOW',
    defaultLatencyBand: blunt ? 'MEASURED' : 'DELIBERATE',
    interruption: {
      ...DEFAULT_INTERRUPTION,
      basePriority: blunt ? 66 : 78,
      escalationPriority: 96,
      preferredTriggers: ['RESCUE_RISK', 'PLAYER_MESSAGE', 'COLLAPSE'],
    },
    visibleChannels: [
      visibleChannelProfile('GLOBAL', 'RESCUE', {
        typing: makeTypingPhase(blunt ? 'STEADY' : 'STUTTER', { minMs: 550, maxMs: 2100, jitterMs: 130 }, {
          interruptionChance: blunt ? 0.08 : 0.14,
          cancelChance: blunt ? 0.05 : 0.12,
          canRestart: true,
        }),
        read: makeReadPolicy('DELAYED', { minMs: 240, maxMs: 1200, jitterMs: 90 }, {
          holdUnreadWindow: { minMs: 400, maxMs: 1800, jitterMs: 120 },
        }),
        lurk: makeLurkPolicy('SHORT_LURK', { minMs: 450, maxMs: 1600, jitterMs: 110 }, {
          visibleHintChance: 0.18,
          mayEscalateToTyping: true,
        }),
        revealMode: blunt ? 'AUTO' : 'EVENT_TRIGGERED',
      }),
      visibleChannelProfile('SYNDICATE', 'RESCUE', {
        typing: makeTypingPhase(blunt ? 'STEADY' : 'SHORT_BURST', { minMs: 280, maxMs: 1000, jitterMs: 70 }, {
          interruptionChance: 0.05,
          cancelChance: 0.08,
          canRestart: true,
        }),
        read: makeReadPolicy('IMMEDIATE', { minMs: 60, maxMs: 420, jitterMs: 40 }),
        lurk: makeLurkPolicy('SHORT_LURK', { minMs: 280, maxMs: 1200, jitterMs: 80 }, {
          visibleHintChance: 0.22,
          mayEscalateToTyping: true,
        }),
        revealMode: 'AUTO',
      }),
      visibleChannelProfile('DEAL_ROOM', 'DEAL_ROOM', {
        typing: makeTypingPhase('STEADY', { minMs: 500, maxMs: 1800, jitterMs: 120 }, {
          interruptionChance: 0.1,
          cancelChance: 0.15,
          canRestart: true,
        }),
        read: makeReadPolicy('DELAYED', { minMs: 200, maxMs: 1000, jitterMs: 75 }, {
          holdUnreadWindow: { minMs: 300, maxMs: 1600, jitterMs: 100 },
        }),
        lurk: makeLurkPolicy('SHORT_LURK', { minMs: 420, maxMs: 1800, jitterMs: 110 }, {
          visibleHintChance: 0.1,
          mayEscalateToTyping: true,
        }),
        revealMode: 'EVENT_TRIGGERED',
      }),
      visibleChannelProfile('LOBBY', 'RESCUE', {
        typing: makeTypingPhase('STUTTER', CHAT_PRESENCE_DEFAULT_TYPING_WINDOW, {
          interruptionChance: 0.06,
          cancelChance: 0.08,
          canRestart: true,
        }),
        read: makeReadPolicy('IMMEDIATE', { minMs: 50, maxMs: 500, jitterMs: 45 }),
        lurk: makeLurkPolicy('SHORT_LURK', CHAT_PRESENCE_DEFAULT_LURK_WINDOW, {
          visibleHintChance: 0.2,
        }),
        revealMode: 'AUTO',
      }),
    ],
    shadowChannels: [
      shadowChannelProfile('RESCUE_SHADOW', 'RESCUE', {
        typing: makeTypingPhase('FEINT', { minMs: 120, maxMs: 600, jitterMs: 50 }, {
          canFeint: true,
          canRestart: true,
          cancelChance: 0.2,
        }),
        read: makeReadPolicy('SHADOW_ONLY', { minMs: 0, maxMs: 0, jitterMs: 0 }, {
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('HEAVY_LURK', { minMs: 350, maxMs: 1800, jitterMs: 120 }, {
          shadowAnchorOnly: true,
          mayEscalateToTyping: true,
        }),
        revealMode: 'MANUAL',
      }),
    ],
    firstResponseWindow: { minMs: blunt ? 180 : 320, maxMs: blunt ? 900 : 1400, jitterMs: 90 },
    followUpWindow: { minMs: 420, maxMs: 2200, jitterMs: 150 },
    silencePreference: blunt ? 0.16 : 0.38,
    unreadPressurePreference: 0.2,
    delayedRevealPreference: blunt ? 0.2 : 0.44,
    instantStrikePreference: blunt ? 0.56 : 0.15,
    rescueDeferencePreference: 0.94,
    negotiationPatiencePreference: 0.48,
    crowdTheaterPreference: 0.22,
    tags: blunt ? ['helper', 'directive', 'counterplay'] : ['helper', 'rescue', 'care'],
  });
}

function dealAgentStyle(styleId: string, actorId: string): ChatPresenceStyle {
  return createChatPresenceStyle({
    id: styleId,
    actorId,
    actorKind: 'DEAL_AGENT',
    label: 'Deal Room Broker',
    postureBias: 'LURKING',
    intentBias: 'NEGOTIATION',
    intensityBand: 'MEDIUM',
    defaultLatencyBand: 'DELIBERATE',
    interruption: {
      ...DEFAULT_INTERRUPTION,
      basePriority: 61,
      escalationPriority: 87,
      cooldownMs: 1600,
      preferredTriggers: ['NEGOTIATION_OFFER', 'NEGOTIATION_STALL', 'PLAYER_MESSAGE'],
    },
    visibleChannels: [
      visibleChannelProfile('DEAL_ROOM', 'DEAL_ROOM', {
        typing: makeTypingPhase('AGGRESSIVE_STOP_START', { minMs: 900, maxMs: 4200, jitterMs: 220 }, {
          interruptionChance: 0.46,
          cancelChance: 0.38,
          canFeint: true,
          canRestart: true,
        }),
        read: makeReadPolicy('STRATEGIC_DELAY', { minMs: 1200, maxMs: 6800, jitterMs: 300 }, {
          holdUnreadWindow: { minMs: 2400, maxMs: 12000, jitterMs: 500 },
          pressureEscalationOnUnread: true,
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('PREDATORY_LURK', { minMs: 1600, maxMs: 8200, jitterMs: 320 }, {
          visibleHintChance: 0.05,
          mayEscalateToTyping: true,
        }),
        revealMode: 'NEGOTIATION_TRIGGERED',
        maxConcurrentCues: 1,
      }),
      visibleChannelProfile('SYNDICATE', 'DEAL_ROOM', {
        typing: makeTypingPhase('STEADY', { minMs: 550, maxMs: 2200, jitterMs: 120 }, {
          interruptionChance: 0.18,
          cancelChance: 0.15,
          canRestart: true,
        }),
        read: makeReadPolicy('DELAYED', { minMs: 420, maxMs: 2400, jitterMs: 120 }, {
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('SHORT_LURK', { minMs: 700, maxMs: 3200, jitterMs: 160 }, {
          visibleHintChance: 0.08,
          mayEscalateToTyping: true,
        }),
        revealMode: 'EVENT_TRIGGERED',
      }),
    ],
    shadowChannels: [
      shadowChannelProfile('NPC_SHADOW', 'DEAL_ROOM', {
        typing: makeTypingPhase('FEINT', { minMs: 180, maxMs: 900, jitterMs: 70 }, {
          canFeint: true,
          canRestart: true,
          cancelChance: 0.4,
        }),
        read: makeReadPolicy('SHADOW_ONLY', { minMs: 0, maxMs: 0, jitterMs: 0 }, {
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('HEAVY_LURK', { minMs: 1200, maxMs: 6000, jitterMs: 260 }, {
          shadowAnchorOnly: true,
          mayEscalateToTyping: true,
        }),
      }),
    ],
    firstResponseWindow: { minMs: 1100, maxMs: 4600, jitterMs: 240 },
    followUpWindow: { minMs: 1500, maxMs: 8200, jitterMs: 360 },
    silencePreference: 0.62,
    unreadPressurePreference: 0.92,
    delayedRevealPreference: 0.88,
    instantStrikePreference: 0.24,
    rescueDeferencePreference: 0.18,
    negotiationPatiencePreference: 0.97,
    crowdTheaterPreference: 0.14,
    tags: ['deal-room', 'stall', 'pressure', 'broker'],
  });
}

function systemStyle(styleId: string, actorId: string): ChatPresenceStyle {
  return createChatPresenceStyle({
    id: styleId,
    actorId,
    actorKind: 'SYSTEM',
    label: 'System Presence',
    postureBias: 'WATCHING',
    intentBias: 'WITNESS',
    intensityBand: 'MEDIUM',
    defaultLatencyBand: 'MEASURED',
    interruption: {
      mayInterrupt: true,
      basePriority: 95,
      escalationPriority: 100,
      cooldownMs: 200,
      preferredTriggers: ['WORLD_EVENT', 'RUN_START', 'RUN_END', 'LEGEND_MOMENT'],
      blockedByPostures: ['ABSENT'],
    },
    visibleChannels: FRONTEND_VISIBLE_CHANNELS.map((channel) =>
      visibleChannelProfile(channel, channel === 'DEAL_ROOM' ? 'DEAL_ROOM' : 'NEUTRAL', {
        typing: makeTypingPhase('STEADY', { minMs: 120, maxMs: 900, jitterMs: 60 }, {
          interruptionChance: 0,
          cancelChance: 0,
        }),
        read: makeReadPolicy('IMMEDIATE', { minMs: 0, maxMs: 120, jitterMs: 20 }),
        lurk: makeLurkPolicy('SHORT_LURK', { minMs: 120, maxMs: 900, jitterMs: 60 }, {
          visibleHintChance: 0.28,
          mayEscalateToTyping: false,
        }),
        revealMode: 'AUTO',
        maxConcurrentCues: 1,
      }),
    ),
    shadowChannels: FRONTEND_SHADOW_CHANNELS.map((channel) =>
      shadowChannelProfile(channel, channel === 'LIVEOPS_SHADOW' ? 'LIVEOPS' : 'NEUTRAL', {
        typing: makeTypingPhase('STEADY', { minMs: 80, maxMs: 400, jitterMs: 40 }, {
          interruptionChance: 0,
          cancelChance: 0,
        }),
        read: makeReadPolicy('SHADOW_ONLY', { minMs: 0, maxMs: 0, jitterMs: 0 }, {
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('HEAVY_LURK', { minMs: 100, maxMs: 800, jitterMs: 60 }, {
          shadowAnchorOnly: true,
          mayEscalateToTyping: false,
        }),
        revealMode: 'AUTO',
      }),
    ),
    firstResponseWindow: { minMs: 80, maxMs: 500, jitterMs: 40 },
    followUpWindow: { minMs: 100, maxMs: 900, jitterMs: 60 },
    silencePreference: 0.08,
    unreadPressurePreference: 0.18,
    delayedRevealPreference: 0.1,
    instantStrikePreference: 0.9,
    rescueDeferencePreference: 0.55,
    negotiationPatiencePreference: 0.22,
    crowdTheaterPreference: 0.34,
    tags: ['system', 'witness', 'ceremony'],
  });
}

function crowdStyle(styleId: string, actorId: string): ChatPresenceStyle {
  return createChatPresenceStyle({
    id: styleId,
    actorId,
    actorKind: 'SPECTATOR_NPC',
    label: 'Crowd Witness',
    postureBias: 'WATCHING',
    intentBias: 'WITNESS',
    intensityBand: 'MEDIUM',
    defaultLatencyBand: 'FAST',
    interruption: {
      ...DEFAULT_INTERRUPTION,
      mayInterrupt: false,
      basePriority: 34,
      escalationPriority: 60,
      cooldownMs: 2200,
    },
    visibleChannels: [
      visibleChannelProfile('GLOBAL', 'CROWD', {
        typing: makeTypingPhase('SHORT_BURST', { minMs: 220, maxMs: 1100, jitterMs: 90 }, {
          interruptionChance: 0.22,
          cancelChance: 0.2,
          canRestart: true,
        }),
        read: makeReadPolicy('DELAYED', { minMs: 150, maxMs: 900, jitterMs: 70 }),
        lurk: makeLurkPolicy('EDGE_PEEK', { minMs: 600, maxMs: 2400, jitterMs: 130 }, {
          visibleHintChance: 0.3,
          mayEscalateToTyping: true,
        }),
        revealMode: 'EVENT_TRIGGERED',
        maxConcurrentCues: 3,
      }),
      visibleChannelProfile('SPECTATOR' as ChatVisibleChannel, 'CROWD', {
        typing: makeTypingPhase('STUTTER', CHAT_PRESENCE_DEFAULT_TYPING_WINDOW, {
          interruptionChance: 0.16,
          cancelChance: 0.12,
          canRestart: true,
        }),
        read: makeReadPolicy('DELAYED', CHAT_PRESENCE_DEFAULT_READ_WINDOW),
        lurk: makeLurkPolicy('EDGE_PEEK', CHAT_PRESENCE_DEFAULT_LURK_WINDOW, {
          visibleHintChance: 0.24,
          mayEscalateToTyping: true,
        }),
        revealMode: 'EVENT_TRIGGERED',
      }),
    ],
    shadowChannels: [
      shadowChannelProfile('NPC_SHADOW', 'CROWD', {
        typing: makeTypingPhase('FEINT', { minMs: 120, maxMs: 600, jitterMs: 60 }, {
          canFeint: true,
          canRestart: true,
          cancelChance: 0.24,
        }),
        read: makeReadPolicy('SHADOW_ONLY', { minMs: 0, maxMs: 0, jitterMs: 0 }, {
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('HEAVY_LURK', { minMs: 400, maxMs: 2200, jitterMs: 140 }, {
          shadowAnchorOnly: true,
          mayEscalateToTyping: true,
        }),
      }),
    ],
    firstResponseWindow: { minMs: 240, maxMs: 1300, jitterMs: 80 },
    followUpWindow: { minMs: 400, maxMs: 2200, jitterMs: 150 },
    silencePreference: 0.3,
    unreadPressurePreference: 0.36,
    delayedRevealPreference: 0.48,
    instantStrikePreference: 0.38,
    rescueDeferencePreference: 0.4,
    negotiationPatiencePreference: 0.15,
    crowdTheaterPreference: 0.96,
    tags: ['crowd', 'witness', 'swarm'],
  });
}

function liveOpsStyle(styleId: string, actorId: string): ChatPresenceStyle {
  return createChatPresenceStyle({
    id: styleId,
    actorId,
    actorKind: 'LIVEOPS_AGENT',
    label: 'LiveOps Operator',
    postureBias: 'READING',
    intentBias: 'CEREMONY',
    intensityBand: 'HIGH',
    defaultLatencyBand: 'MEASURED',
    interruption: {
      mayInterrupt: true,
      basePriority: 88,
      escalationPriority: 99,
      cooldownMs: 500,
      preferredTriggers: ['WORLD_EVENT', 'FACTION_EVENT', 'LEGEND_MOMENT'],
      blockedByPostures: ['ABSENT'],
    },
    visibleChannels: [
      visibleChannelProfile('GLOBAL', 'LIVEOPS', {
        typing: makeTypingPhase('STEADY', { minMs: 180, maxMs: 1100, jitterMs: 80 }),
        read: makeReadPolicy('IMMEDIATE', { minMs: 10, maxMs: 180, jitterMs: 30 }),
        lurk: makeLurkPolicy('SHORT_LURK', { minMs: 100, maxMs: 700, jitterMs: 60 }, {
          visibleHintChance: 0.24,
        }),
        revealMode: 'AUTO',
      }),
      visibleChannelProfile('SYNDICATE', 'LIVEOPS', {
        typing: makeTypingPhase('STEADY', { minMs: 220, maxMs: 1300, jitterMs: 90 }),
        read: makeReadPolicy('IMMEDIATE', { minMs: 20, maxMs: 220, jitterMs: 40 }),
        lurk: makeLurkPolicy('SHORT_LURK', { minMs: 120, maxMs: 900, jitterMs: 70 }, {
          visibleHintChance: 0.12,
        }),
        revealMode: 'AUTO',
      }),
    ],
    shadowChannels: [
      shadowChannelProfile('LIVEOPS_SHADOW', 'LIVEOPS', {
        typing: makeTypingPhase('SHORT_BURST', { minMs: 80, maxMs: 520, jitterMs: 60 }, {
          canRestart: true,
          cancelChance: 0,
        }),
        read: makeReadPolicy('SHADOW_ONLY', { minMs: 0, maxMs: 0, jitterMs: 0 }, {
          maySuppressReadReceipt: true,
        }),
        lurk: makeLurkPolicy('HEAVY_LURK', { minMs: 90, maxMs: 640, jitterMs: 60 }, {
          shadowAnchorOnly: true,
          mayEscalateToTyping: false,
        }),
        revealMode: 'AUTO',
      }),
    ],
    firstResponseWindow: { minMs: 90, maxMs: 620, jitterMs: 55 },
    followUpWindow: { minMs: 180, maxMs: 1200, jitterMs: 95 },
    silencePreference: 0.12,
    unreadPressurePreference: 0.24,
    delayedRevealPreference: 0.16,
    instantStrikePreference: 0.84,
    rescueDeferencePreference: 0.36,
    negotiationPatiencePreference: 0.16,
    crowdTheaterPreference: 0.74,
    tags: ['liveops', 'world-event', 'surge'],
  });
}

function buildDefaultStyles(): readonly ChatPresenceStyle[] {
  return [
    haterStyle('presence:rival:liquidator', 'rival:liquidator', 'The Liquidator'),
    haterStyle('presence:rival:predator', 'rival:predator', 'Predator Voice'),
    helperStyle('presence:helper:steady', 'helper:steady', 'Steady Helper', false),
    helperStyle('presence:helper:blunt', 'helper:blunt', 'Blunt Helper', true),
    dealAgentStyle('presence:deal:broker', 'deal:broker'),
    systemStyle('presence:system:core', 'system:core'),
    crowdStyle('presence:crowd:witness', 'crowd:witness'),
    liveOpsStyle('presence:liveops:operator', 'liveops:operator'),
  ] as const;
}

function defaultArchetypeForActorKind(kind: ChatActorKind): NpcPresenceArchetype {
  switch (kind) {
    case 'HATER':
      return 'LIQUIDATOR_RIVAL';
    case 'HELPER':
      return 'STEADY_HELPER';
    case 'DEAL_AGENT':
      return 'NEGOTIATION_BROKER';
    case 'SYSTEM':
      return 'CEREMONIAL_SYSTEM';
    case 'LIVEOPS':
      return 'LIVEOPS_OPERATOR';
    case 'CROWD':
      return 'CROWD_WITNESS';
    case 'AMBIENT_NPC':
    default:
      return 'AMBIENT_WATCHER';
  }
}

function chooseReactionMode(style: ChatPresenceStyle, context: NpcPresenceRuntimeContext): NpcPresenceReactionMode {
  const pressure = score(context.pressureScore);
  const urgency = score(context.urgencyScore);
  const rescueRisk = score(context.rescueRiskScore);
  const negotiationRisk = score(context.negotiationRiskScore);
  const rivalry = score(context.rivalryScore);

  if (context.helperProtectionWindowActive && style.actorKind !== 'HELPER') {
    return 'RESCUE_HOLD';
  }

  if (style.actorKind === 'DEAL_AGENT' && negotiationRisk >= 55) {
    return 'STALL';
  }

  if (style.actorKind === 'HELPER' && rescueRisk >= 60) {
    return 'RESCUE_HOLD';
  }

  if (style.actorKind === 'SYSTEM' || style.actorKind === 'LIVEOPS_AGENT') {
    return 'NEUTRAL';
  }

  if (pressure >= 72 || urgency >= 74 || rivalry >= 78) {
    return style.instantStrikePreference && style.instantStrikePreference >= 0.55
      ? 'INSTANT_STRIKE'
      : 'STEADY';
  }

  if (style.delayedRevealPreference && style.delayedRevealPreference >= 0.65) {
    return 'SLOW_BURN';
  }

  if (style.negotiationPatiencePreference && style.negotiationPatiencePreference >= 0.75) {
    return 'STALL';
  }

  return 'FEINT';
}

function chooseIntent(style: ChatPresenceStyle, context: NpcPresenceRuntimeContext): ChatPresenceIntent {
  if (context.preferredIntent) {
    return context.preferredIntent;
  }

  if (style.actorKind === 'HELPER') {
    if (score(context.rescueRiskScore) >= 55 || context.trigger === 'RESCUE_RISK') {
      return 'RESCUE';
    }
    if (score(context.urgencyScore) >= 65) {
      return 'COUNTERPLAY';
    }
    return style.intentBias;
  }

  if (style.actorKind === 'DEAL_AGENT') {
    if (score(context.negotiationRiskScore) >= 72) {
      return 'STALL';
    }
    return 'NEGOTIATION';
  }

  if (style.actorKind === 'SYSTEM' || style.actorKind === 'LIVEOPS_AGENT') {
    if (context.trigger === 'WORLD_EVENT' || score(context.worldEventWeight) >= 60) {
      return 'CEREMONY';
    }
    return 'WITNESS';
  }

  if (score(context.rivalryScore) >= 72 || context.trigger === 'BOT_ATTACK') {
    return 'COUNTERPLAY';
  }
  if (score(context.pressureScore) >= 64 || score(context.embarrassmentScore) >= 58) {
    return 'PRESSURE';
  }
  if (score(context.tensionScore) >= 50) {
    return 'THREAT';
  }
  return style.intentBias;
}

function chooseTrigger(context: NpcPresenceRuntimeContext): ChatPresenceTrigger {
  return context.trigger;
}

function chooseChannelProfile(
  style: ChatPresenceStyle,
  channel: ChatPresenceAddressableChannel,
): ChatPresenceChannelProfile {
  const haystack = isChatPresenceShadowChannel(channel)
    ? style.shadowChannels ?? []
    : style.visibleChannels;

  const exact = haystack.find((candidate) => candidate.channel === channel);
  if (exact) {
    return exact;
  }

  const fallback = haystack[0];
  if (fallback) {
    return fallback;
  }

  return {
    channel,
    pressureMode: 'PREDATORY',
    typing: makeTypingPhase('STEADY', CHAT_PRESENCE_DEFAULT_TYPING_WINDOW),
    read: makeReadPolicy('DELAYED', CHAT_PRESENCE_DEFAULT_READ_WINDOW),
    lurk: makeLurkPolicy('SHORT_LURK', CHAT_PRESENCE_DEFAULT_LURK_WINDOW),
    revealMode: isChatPresenceShadowChannel(channel) ? 'MANUAL' : 'EVENT_TRIGGERED',
    allowVisibleTyping: !isChatPresenceShadowChannel(channel),
    allowVisibleReading: !isChatPresenceShadowChannel(channel),
    allowShadowAnchors: true,
    maxConcurrentCues: 1,
  };
}

function computeLatency(
  style: ChatPresenceStyle,
  profile: ChatPresenceChannelProfile,
  context: NpcPresenceRuntimeContext,
  reactionMode: NpcPresenceReactionMode,
): number {
  const seed = [style.id, context.actorId, context.channelId, context.trigger, reactionMode].join('|');
  const preferredWindow = (() => {
    switch (reactionMode) {
      case 'INSTANT_STRIKE':
        return style.firstResponseWindow ?? profile.typing?.activeWindow ?? CHAT_PRESENCE_DEFAULT_TYPING_WINDOW;
      case 'STALL':
        return profile.read?.holdUnreadWindow
          ?? profile.lurk?.lurkWindow
          ?? style.followUpWindow
          ?? CHAT_PRESENCE_DEFAULT_LURK_WINDOW;
      case 'RESCUE_HOLD':
        return style.followUpWindow ?? CHAT_PRESENCE_DEFAULT_READ_WINDOW;
      case 'NEUTRAL':
        return style.firstResponseWindow ?? CHAT_PRESENCE_DEFAULT_READ_WINDOW;
      case 'SLOW_BURN':
        return style.followUpWindow ?? profile.lurk?.lurkWindow ?? CHAT_PRESENCE_DEFAULT_LURK_WINDOW;
      case 'STEADY':
      case 'FEINT':
      default:
        return profile.typing?.activeWindow ?? style.firstResponseWindow ?? CHAT_PRESENCE_DEFAULT_TYPING_WINDOW;
    }
  })();

  return deterministicJitter(seed, preferredWindow);
}

// ============================================================================
// MARK: Registry
// ============================================================================

export class NpcPresenceStyleRegistry {
  private readonly styles = new Map<string, ChatPresenceStyle>();
  private readonly bindings = new Map<string, RegisteredStyleBinding>();
  private readonly sessions = new Map<string, NpcPresenceSessionState>();
  private readonly log?: (message: string, context?: Record<string, unknown>) => void;
  private metrics: NpcPresenceRegistryMetrics = { ...DEFAULT_METRICS };

  public constructor(options: NpcPresenceStyleRegistryOptions = {}) {
    this.log = options.log;
    const bootStyles = options.styles && options.styles.length > 0 ? options.styles : buildDefaultStyles();
    for (const style of bootStyles) {
      this.registerStyle(style);
    }
  }

  public registerStyle(style: ChatPresenceStyle): void {
    const normalized = createChatPresenceStyle(style);
    this.styles.set(normalized.id, normalized);
  }

  public listStyles(): readonly ChatPresenceStyle[] {
    return [...this.styles.values()];
  }

  public bindActor(
    actorId: string,
    actorKind: ChatActorKind,
    styleId?: string,
    archetype?: NpcPresenceArchetype,
  ): RegisteredStyleBinding {
    const resolvedStyle = styleId && this.styles.has(styleId)
      ? this.styles.get(styleId)!
      : this.resolveDefaultStyleForKind(actorKind);

    const binding: RegisteredStyleBinding = {
      actorId,
      styleId: resolvedStyle.id,
      archetype: archetype ?? defaultArchetypeForActorKind(actorKind),
    };

    this.bindings.set(actorId, binding);
    if (!this.sessions.has(actorId)) {
      this.sessions.set(actorId, {
        actorId,
        styleId: binding.styleId,
        archetype: binding.archetype,
        unreadStreak: 0,
        rescueDebt: 0,
        ignoredAdviceCount: 0,
        rivalryEscalationCount: 0,
        comebackCount: 0,
        collapseCount: 0,
      });
    }

    return binding;
  }

  public getSnapshot(): NpcPresenceRegistrySnapshot {
    return {
      styleCount: this.styles.size,
      actorBindingCount: this.bindings.size,
      sessionCount: this.sessions.size,
      metrics: { ...this.metrics },
    };
  }

  public getSession(actorId: string): NpcPresenceSessionState | undefined {
    return this.sessions.get(actorId);
  }

  public recordFeedback(
    actorId: string,
    feedback: Partial<Pick<NpcPresenceSessionState, 'unreadStreak' | 'rescueDebt' | 'ignoredAdviceCount' | 'rivalryEscalationCount' | 'comebackCount' | 'collapseCount'>>,
  ): void {
    const current = this.sessions.get(actorId);
    if (!current) {
      return;
    }
    this.sessions.set(actorId, {
      ...current,
      unreadStreak: feedback.unreadStreak ?? current.unreadStreak,
      rescueDebt: feedback.rescueDebt ?? current.rescueDebt,
      ignoredAdviceCount: feedback.ignoredAdviceCount ?? current.ignoredAdviceCount,
      rivalryEscalationCount: feedback.rivalryEscalationCount ?? current.rivalryEscalationCount,
      comebackCount: feedback.comebackCount ?? current.comebackCount,
      collapseCount: feedback.collapseCount ?? current.collapseCount,
    });
  }

  public resolveStyle(actorId: string, actorKind: ChatActorKind): ChatPresenceStyle {
    const binding = this.bindings.get(actorId) ?? this.bindActor(actorId, actorKind);
    return this.styles.get(binding.styleId) ?? this.resolveDefaultStyleForKind(actorKind);
  }

  public planCue(context: NpcPresenceRuntimeContext): NpcPresencePlannedCue {
    const style = this.resolveStyle(context.actorId, context.actorKind);
    const channel = toPresenceChannel(context.channelId);
    const profile = chooseChannelProfile(style, channel);
    const intent = chooseIntent(style, context);
    const posture = defaultPostureForIntent(intent);
    const reactionMode = chooseReactionMode(style, context);
    const computedLatencyMs = computeLatency(style, profile, context, reactionMode);
    const visibleToPlayer = !isChatPresenceShadowChannel(channel);
    const createdAt = asIso(context.now);
    const visibleAt = asIso(Number(context.now) + computedLatencyMs);
    const priority = this.computePriority(style, context, reactionMode, profile);

    const cue = createChatPresenceCue({
      id: `presence-cue:${context.actorId}:${stableHash(`${context.channelId}:${createdAt}:${context.trigger}`)}`,
      actorId: context.actorId,
      actorKind: toSharedActorKind(context.actorKind),
      styleId: style.id,
      channel,
      trigger: chooseTrigger(context),
      intent,
      posture,
      pressureMode: profile.pressureMode,
      intensityBand: style.intensityBand,
      createdAt,
      visibleAt,
      revealAt: profile.revealMode === 'MANUAL' || profile.revealMode === 'NEGOTIATION_TRIGGERED'
        ? asIso(Number(context.now) + computedLatencyMs + Math.round(computedLatencyMs * 0.35))
        : visibleAt,
      priority,
      shadowOnly: !visibleToPlayer,
      queueRank: priority,
      suppressionReason:
        reactionMode === 'RESCUE_HOLD' && style.actorKind !== 'HELPER'
          ? 'RESCUE_PROTECTED_WINDOW'
          : undefined,
      revealMode: profile.revealMode,
      metadata: {
        reactionMode,
        latencyMs: computedLatencyMs,
        trigger: context.trigger,
        channelId: context.channelId,
        tickTier: context.currentTickTier,
        pressureTier: context.currentPressureTier,
        ignoredAdviceCount: context.ignoredAdviceCount,
        unreadStreak: context.unreadStreak,
        rescueDebt: context.rescueDebt,
        legendCandidate: context.legendCandidate,
        counterplayWindowOpen: context.counterplayWindowOpen,
        ...context.metadata,
      },
    });

    const session = this.sessions.get(context.actorId);
    if (session) {
      this.sessions.set(context.actorId, {
        ...session,
        lastVisibleCueAt: visibleToPlayer ? context.now : session.lastVisibleCueAt,
        lastShadowCueAt: !visibleToPlayer ? context.now : session.lastShadowCueAt,
        unreadStreak: context.unreadStreak ?? session.unreadStreak,
        rescueDebt: context.rescueDebt ?? session.rescueDebt,
        ignoredAdviceCount: context.ignoredAdviceCount ?? session.ignoredAdviceCount,
        rivalryEscalationCount: context.rivalryEscalationCount ?? session.rivalryEscalationCount,
        comebackCount: context.comebackCount ?? session.comebackCount,
        collapseCount: context.collapseCount ?? session.collapseCount,
      });
    }

    this.metrics = {
      ...this.metrics,
      plannedCueCount: this.metrics.plannedCueCount + 1,
      visibleCueCount: this.metrics.visibleCueCount + (visibleToPlayer ? 1 : 0),
      shadowCueCount: this.metrics.shadowCueCount + (visibleToPlayer ? 0 : 1),
      rescueDeferenceCount:
        this.metrics.rescueDeferenceCount + (reactionMode === 'RESCUE_HOLD' ? 1 : 0),
      negotiationStallCount:
        this.metrics.negotiationStallCount + (reactionMode === 'STALL' ? 1 : 0),
      instantStrikeCount:
        this.metrics.instantStrikeCount + (reactionMode === 'INSTANT_STRIKE' ? 1 : 0),
      feintCount: this.metrics.feintCount + (reactionMode === 'FEINT' ? 1 : 0),
    };

    this.log?.('planned_npc_presence_cue', {
      actorId: context.actorId,
      channel: context.channelId,
      styleId: style.id,
      intent,
      reactionMode,
      visibleToPlayer,
      latencyMs: computedLatencyMs,
    });

    return {
      cue,
      style,
      channelProfile: profile,
      typingPhase: profile.typing,
      readPolicy: profile.read,
      lurkPolicy: profile.lurk,
      localPresenceState: postureToPresenceState(posture),
      localTypingState: intentToTypingState(intent, !visibleToPlayer),
      computedLatencyMs,
      reactionMode,
      visibleToPlayer,
    };
  }

  public projectSignalInput(context: NpcPresenceRuntimeContext): ChatPresenceSignalInput {
    return {
      actorId: context.actorId,
      actorKind: toSharedActorKind(context.actorKind),
      trigger: context.trigger,
      intent: context.preferredIntent,
      channel: toPresenceChannel(context.channelId),
      pressureScore: context.pressureScore,
      tensionScore: context.tensionScore,
      urgencyScore: context.urgencyScore,
      embarrassmentScore: context.embarrassmentScore,
      rescueRiskScore: context.rescueRiskScore,
      rivalryScore: context.rivalryScore,
      crowdHeatScore: context.crowdHeatScore,
      negotiationRiskScore: context.negotiationRiskScore,
      worldEventWeight: context.worldEventWeight,
      helperProtectionWindowActive: context.helperProtectionWindowActive,
      legendCandidate: context.legendCandidate,
      counterplayWindowOpen: context.counterplayWindowOpen,
      metadata: context.metadata,
    };
  }

  private resolveDefaultStyleForKind(actorKind: ChatActorKind): ChatPresenceStyle {
    const lookupOrder: readonly string[] = (() => {
      switch (actorKind) {
        case 'HATER':
          return ['presence:rival:liquidator', 'presence:rival:predator'];
        case 'HELPER':
          return ['presence:helper:steady', 'presence:helper:blunt'];
        case 'DEAL_AGENT':
          return ['presence:deal:broker'];
        case 'SYSTEM':
          return ['presence:system:core'];
        case 'LIVEOPS':
          return ['presence:liveops:operator'];
        case 'CROWD':
        case 'AMBIENT_NPC':
        default:
          return ['presence:crowd:witness', 'presence:system:core'];
      }
    })();

    for (const id of lookupOrder) {
      const candidate = this.styles.get(id);
      if (candidate) {
        return candidate;
      }
    }

    const fallback = this.styles.values().next().value as ChatPresenceStyle | undefined;
    if (!fallback) {
      throw new Error('NpcPresenceStyleRegistry requires at least one registered style.');
    }
    return fallback;
  }

  private computePriority(
    style: ChatPresenceStyle,
    context: NpcPresenceRuntimeContext,
    reactionMode: NpcPresenceReactionMode,
    profile: ChatPresenceChannelProfile,
  ): number {
    const pressure = score(context.pressureScore);
    const urgency = score(context.urgencyScore);
    const rescue = score(context.rescueRiskScore);
    const rivalry = score(context.rivalryScore);
    const crowd = score(context.crowdHeatScore);
    const negotiation = score(context.negotiationRiskScore);

    let priority = 24;
    priority += pressure * 0.16;
    priority += urgency * 0.12;
    priority += rivalry * 0.1;
    priority += crowd * (profile.pressureMode === 'CROWD' ? 0.14 : 0.04);
    priority += negotiation * (profile.pressureMode === 'DEAL_ROOM' ? 0.18 : 0.03);
    priority += rescue * (style.actorKind === 'HELPER' ? 0.24 : 0.02);

    if (context.legendCandidate) priority += 10;
    if (context.counterplayWindowOpen) priority += 8;
    if (context.helperProtectionWindowActive && style.actorKind !== 'HELPER') priority -= 16;

    switch (reactionMode) {
      case 'INSTANT_STRIKE':
        priority += 14;
        break;
      case 'STALL':
        priority += 6;
        break;
      case 'RESCUE_HOLD':
        priority -= 10;
        break;
      case 'NEUTRAL':
        priority += 12;
        break;
      case 'SLOW_BURN':
        priority += 4;
        break;
      case 'FEINT':
      case 'STEADY':
      default:
        break;
    }

    return Math.round(clamp(priority, 0, 1000));
  }
}

export function createNpcPresenceStyleRegistry(
  options: NpcPresenceStyleRegistryOptions = {},
): NpcPresenceStyleRegistry {
  return new NpcPresenceStyleRegistry(options);
}
