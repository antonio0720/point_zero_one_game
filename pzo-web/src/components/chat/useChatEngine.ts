/**
 * ============================================================================
 * POINT ZERO ONE — LEGACY COMPONENT CHAT HOOK (ENGINE-BACKED COMPATIBILITY)
 * FILE: pzo-web/src/components/chat/useChatEngine.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Migration-safe compatibility hook for the legacy component chat surface.
 *
 * This file preserves the long-lived import path:
 *   pzo-web/src/components/chat/useChatEngine.ts
 *
 * while stopping that path from behaving like an unauthorized second engine.
 *
 * Architectural position
 * ----------------------
 * - shared/contracts/chat            => canonical shared contracts
 * - pzo-web/src/engines/chat         => frontend runtime authority lane
 * - pzo-web/src/components/chat      => presentation lane + compatibility shims
 * - backend/src/game/engine/chat     => authoritative persistent truth
 * - pzo-server/src/chat              => transport / gateway / fanout
 *
 * This hook therefore does a constrained job:
 * - preserve the legacy outward hook shape used by existing mounts
 * - normalize the incoming component-lane GameChatContext
 * - derive stable local UI-facing messages from game reality
 * - preserve tab switching, unread, shell open/close, and local send behavior
 * - surface sabotage callbacks for runtime screens still wired to the old lane
 * - remain compatible with UnifiedChatDock.tsx while migration continues
 *
 * This hook explicitly does NOT:
 * - become the canonical source of transcript truth
 * - own transport sockets for the final architecture
 * - own moderation or persistent learning truth
 * - import battle / pressure / shield / zero engine modules directly
 * - redefine contracts already owned by shared/contracts/chat
 *
 * Design constraints
 * ------------------
 * 1. Preserve the old return shape exactly enough for current callers.
 * 2. Source all structural truth from chatTypes.ts and shared/contracts/chat.
 * 3. Keep fast local responsiveness for UI mounts.
 * 4. Make message derivation deterministic and dedupe-safe.
 * 5. Allow a later migration to replace this body with a thinner adapter over
 *    pzo-web/src/engines/chat without breaking imports.
 *
 * Scale note
 * ----------
 * The legacy hook keeps only a bounded render window. Durable truth, paging,
 * policy, replay, and multi-session authority belong outside this file.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  CHAT_TYPES_RUNTIME_BUNDLE,
  CHAT_TYPES_RUNTIME_LAWS,
  SharedChat,
  buildChannelSummaries,
  coerceChatMessage,
  coerceChatMessages,
  createEmptyGameChatContext,
  createSabotageEvent,
  extractThreatSnapshot,
  getChatChannelDescription,
  getChatChannelLabel,
  groupMessagesByChannel,
  normalizeChatChannel,
  normalizeGameChatContext,
  sortMessagesForRender,
  type AttackType,
  type BotTauntSource,
  type CascadeSeverity,
  type ChatChannel,
  type ChatChannelSummary,
  type ChatConnectionState,
  type ChatHelperPromptSnapshot,
  type ChatMessage,
  type ChatMessageMeta,
  type ChatPresenceSnapshot,
  type ChatThreatSnapshot,
  type ChatTranscriptSearchResult,
  type ExtendedMessageKind,
  type GameChatContext,
  type PressureTier,
  type RunOutcome,
  type SabotageCardType,
  type SabotageEvent,
  type ShieldLayerId,
  type TickTier,
  type UnifiedVisibleChatChannel,
  type UseChatEngineResult,
} from './chatTypes';

export type { SabotageEvent };

// ============================================================================
// MARK: Compatibility surface manifest
// ============================================================================

export const USE_CHAT_ENGINE_FILE_PATH =
  'pzo-web/src/components/chat/useChatEngine.ts' as const;

export const USE_CHAT_ENGINE_VERSION = '2026.03.15' as const;

export const USE_CHAT_ENGINE_REVISION =
  'pzo.components.chat.useChatEngine.compat.v1' as const;

export const USE_CHAT_ENGINE_MIGRATION_MODE = Object.freeze({
  isCompatibilityHook: true,
  preservesLegacyReturnShape: true,
  sharedContractBacked: true,
  componentLaneOwned: true,
  componentLaneAuthoritative: false,
  directEngineImportsAllowed: false,
  persistentTruthOwnedHere: false,
  finalSocketAuthorityOwnedHere: false,
});

export const USE_CHAT_ENGINE_RUNTIME_LAWS = Object.freeze([
  'This hook preserves the old component-lane API while authority migrates outward.',
  'The hook may synthesize UI-safe local events, but it must not claim durable transcript truth.',
  'All structural chat law is anchored on shared/contracts/chat via chatTypes.ts.',
  'The hook may keep a bounded local render window only.',
  'No direct imports from battle, zero, pressure, shield, or cascade engine modules are permitted.',
  'Unread and shell-open state may live here temporarily because current mounts still depend on them.',
  'System, helper, and hater reactions derived here are compatibility-grade local mirrors, not backend truth claims.',
  'Every later engine-lane migration must be able to replace this implementation without changing the public import path.',
] as const);

export const USE_CHAT_ENGINE_LIMITS = Object.freeze({
  maxMessages: 500,
  maxBodyLength: 280,
  maxEventsPerDigest: 48,
  maxSignalsPerTickDigest: 24,
  recentFingerprintWindow: 2048,
  localSendCooldownMs: 60,
  duplicateWindowMs: 100,
  helperRepeatCooldownMs: 18_000,
  haterRepeatCooldownMs: 12_000,
  systemRepeatCooldownMs: 7_500,
  rescueWindowMs: 14_000,
  connectionResumeWindowMs: 5_000,
});

export const USE_CHAT_ENGINE_RUNTIME_BUNDLE = Object.freeze({
  filePath: USE_CHAT_ENGINE_FILE_PATH,
  version: USE_CHAT_ENGINE_VERSION,
  revision: USE_CHAT_ENGINE_REVISION,
  migration: USE_CHAT_ENGINE_MIGRATION_MODE,
  laws: USE_CHAT_ENGINE_RUNTIME_LAWS,
  limits: USE_CHAT_ENGINE_LIMITS,
  inheritedChatTypesBundle: CHAT_TYPES_RUNTIME_BUNDLE,
});

// ============================================================================
// MARK: Internal constants
// ============================================================================

const VISIBLE_CHANNELS: readonly ChatChannel[] = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
] as const;

const CHANNEL_SENDERS = Object.freeze<Record<ChatChannel, string>>({
  GLOBAL: 'player-local-global',
  SYNDICATE: 'player-local-syndicate',
  DEAL_ROOM: 'player-local-deal-room',
});

const DEFAULT_PLAYER_NAMES = Object.freeze({
  GLOBAL: 'You',
  SYNDICATE: 'You',
  DEAL_ROOM: 'You',
});

const DEFAULT_PLAYER_RANK = 'You' as const;

const CONNECTION_PRIORITY = Object.freeze<Record<ChatConnectionState, number>>({
  DISCONNECTED: 0,
  CONNECTING: 1,
  RESUMING: 2,
  DEGRADED: 3,
  CONNECTED: 4,
});







const CHANNEL_PERSONAS = Object.freeze({
  GLOBAL: {
    helperName: 'Rook',
    helperEmoji: '🛟',
    helperRank: 'Systems Mentor',
    haterName: 'THE CROWD',
    haterEmoji: '☠️',
    haterRank: 'Public Heat',
  },
  SYNDICATE: {
    helperName: 'Kade',
    helperEmoji: '🧠',
    helperRank: 'Senior Partner',
    haterName: 'THE AUDITOR',
    haterEmoji: '🗂️',
    haterRank: 'Pressure Analyst',
  },
  DEAL_ROOM: {
    helperName: 'Mara',
    helperEmoji: '📈',
    helperRank: 'Deal Advisor',
    haterName: 'THE LIQUIDATOR',
    haterEmoji: '⚡',
    haterRank: 'Predatory Creditor',
  },
} as const);

interface RuntimePersonaProfile {
  readonly id: string;
  readonly name: string;
  readonly rank: string;
  readonly emoji: string;
  readonly attackType: AttackType;
  readonly sabotageCard: SabotageCardType;
  readonly taunts: readonly string[];
  readonly attacks: readonly string[];
  readonly retreats: readonly string[];
  readonly helperCounters: readonly string[];
}

const HATER_PERSONAS: readonly RuntimePersonaProfile[] = Object.freeze([
  Object.freeze({
    id: 'bot-liquidator',
    name: 'THE LIQUIDATOR',
    rank: 'Predatory Creditor',
    emoji: '⚡',
    attackType: 'LIQUIDITY_STRIKE',
    sabotageCard: 'EMERGENCY_EXPENSE',
    taunts: [
      'Your cash posture is soft. The market notices softness before people do.',
      'You are negotiating from need, not leverage. That smell travels.',
      'Distress pricing is not personal. It is simply efficient.',
    ],
    attacks: [
      'I am opening the window under your feet. Watch liquidity disappear first.',
      'Your margin of error has become inventory for someone stronger.',
      'This is the part where urgency starts making decisions for you.',
    ],
    retreats: [
      'You bought time. Do not confuse time with safety.',
      'The floor held. It will be tested again.',
    ],
    helperCounters: [
      'Take the ugly exit before he prices your hesitation.',
      'Protect runway first. Reputation recovers faster than insolvency.',
    ],
  }),
  Object.freeze({
    id: 'bot-bureaucrat',
    name: 'THE BUREAUCRAT',
    rank: 'Regulatory Burden',
    emoji: '📑',
    attackType: 'PRESSURE_SPIKE',
    sabotageCard: 'SYSTEM_GLITCH',
    taunts: [
      'Every exception becomes paperwork eventually.',
      'I do not need speed. Process wins by continuing to exist.',
      'Your confidence is not a filing status.',
    ],
    attacks: [
      'The form is the weapon. You noticed too late.',
      'A delay can be more expensive than an error if timed correctly.',
    ],
    retreats: [
      'You satisfied the surface requirements. I will return for the deeper layer.',
      'For now, the checkbox remains checked.',
    ],
    helperCounters: [
      'Tighten the sequence. He feeds on disorder more than weakness.',
      'Document the clean path now while there is still time to do it calmly.',
    ],
  }),
  Object.freeze({
    id: 'bot-market-maker',
    name: 'THE SPREAD',
    rank: 'Liquidity Predator',
    emoji: '📉',
    attackType: 'NEGOTIATION_TRAP',
    sabotageCard: 'MARKET_CORRECTION',
    taunts: [
      'You keep showing your urgency in public. Spreads widen when urgency talks.',
      'A bad quote is still useful if it teaches the room how desperate you are.',
      'The deal room remembers panic better than principle.',
    ],
    attacks: [
      'Your ask is now a signal against you.',
      'I am not here to trade. I am here to make your next trade worse.',
    ],
    retreats: [
      'You denied me the cheap narrative. Annoying, but temporary.',
      'Fine. The room stayed disciplined this round.',
    ],
    helperCounters: [
      'Slow the tempo. He wants visible need.',
      'Counter with structure, not emotion. Let him overplay first.',
    ],
  }),
]);

const HELPER_LINES = Object.freeze({
  calm: [
    'You do not need a dramatic move here. You need the next clean one.',
    'Hold posture. The room gets louder before it gets clearer.',
    'Breathe once, then make the smallest move that preserves optionality.',
  ],
  blunt: [
    'Stop feeding the attack. Tighten the lane and cut noise.',
    'This is recoverable only if you stop improvising in public.',
    'Do less, cleaner, faster. Your leak is sequence, not effort.',
  ],
  urgent: [
    'Protect cash now. Narrative can wait.',
    'Exit the exposed line immediately. You are being shaped by urgency.',
    'This is the rescue window. Use it before the room re-prices you.',
  ],
  strategic: [
    'Take the counter-position that preserves proof and optionality.',
    'Let the hater reveal intent. Counter after the pattern is obvious.',
    'The best move is the one that leaves the fewest usable receipts against you.',
  ],
} as const);

const SYSTEM_EVENT_PATTERNS = Object.freeze([
  { needle: 'BOT_ATTACK', kind: 'BOT_ATTACK' as const, channel: 'GLOBAL' as const },
  { needle: 'SABOTAGE', kind: 'BOT_ATTACK' as const, channel: 'GLOBAL' as const },
  { needle: 'LIQUIDATOR', kind: 'BOT_TAUNT' as const, channel: 'DEAL_ROOM' as const },
  { needle: 'SHIELD', kind: 'SHIELD_EVENT' as const, channel: 'SYNDICATE' as const },
  { needle: 'CASCADE', kind: 'CASCADE_ALERT' as const, channel: 'GLOBAL' as const },
  { needle: 'DEAL', kind: 'DEAL_RECAP' as const, channel: 'DEAL_ROOM' as const },
  { needle: 'SOVEREIGN', kind: 'ACHIEVEMENT' as const, channel: 'DEAL_ROOM' as const },
  { needle: 'BANKRUPT', kind: 'MARKET_ALERT' as const, channel: 'GLOBAL' as const },
  { needle: 'COLLAPSE', kind: 'MARKET_ALERT' as const, channel: 'GLOBAL' as const },
] as const);

// ============================================================================
// MARK: Internal types
// ============================================================================

interface HookMessageAccumulator {
  readonly nextMessages: readonly ChatMessage[];
  readonly generatedSabotageEvents: readonly SabotageEvent[];
}

interface ConnectionSnapshot {
  readonly state: ChatConnectionState;
  readonly connected: boolean;
  readonly transportReady: boolean;
  readonly reason: string;
}

interface RuntimeSignalDigest {
  readonly systemMessages: readonly ChatMessage[];
  readonly sabotageEvents: readonly SabotageEvent[];
  readonly helperSuggestion?: ChatMessage;
  readonly haterReaction?: ChatMessage;
}

interface ContextDelta {
  readonly tickChanged: boolean;
  readonly pressureChanged: boolean;
  readonly tickTierChanged: boolean;
  readonly runOutcomeChanged: boolean;
  readonly heatChanged: boolean;
  readonly netWorthDrop: boolean;
  readonly liquidityShock: boolean;
  readonly newEvents: readonly string[];
  readonly scoreShock: boolean;
}

interface HookState {
  readonly messages: readonly ChatMessage[];
  readonly activeTab: ChatChannel;
  readonly chatOpen: boolean;
  readonly unread: Record<ChatChannel, number>;
  readonly connectionState: ChatConnectionState;
}

interface FingerprintEntry {
  readonly ts: number;
  readonly messageId: string;
}

// ============================================================================
// MARK: Pure helpers
// ============================================================================

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function nowMs(): number {
  return Date.now();
}

function safeUpper(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

function toStableKey(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `k-${Math.abs(hash >>> 0).toString(36)}`;
}

function inferConnectionSnapshot(
  ctx: GameChatContext,
  accessToken?: string | null,
): ConnectionSnapshot {
  const explicit = ctx.connectionState;
  if (explicit) {
    return {
      state: explicit,
      connected: explicit === 'CONNECTED' || explicit === 'DEGRADED',
      transportReady: explicit !== 'DISCONNECTED',
      reason: 'context-explicit',
    };
  }

  if (accessToken && accessToken.trim().length > 0) {
    return {
      state: 'CONNECTED',
      connected: true,
      transportReady: true,
      reason: 'access-token-present',
    };
  }

  if ((ctx.roomId && ctx.sessionId) || ctx.playerId) {
    return {
      state: 'DEGRADED',
      connected: true,
      transportReady: false,
      reason: 'context-has-session-shape',
    };
  }

  return {
    state: 'DISCONNECTED',
    connected: false,
    transportReady: false,
    reason: 'no-token-no-session-shape',
  };
}

function chooseDefaultTab(ctx: GameChatContext): ChatChannel {
  if (ctx.activeChannel) {
    return normalizeChatChannel(ctx.activeChannel);
  }

  if (ctx.mountTarget === 'LOBBY_SCREEN' || ctx.modeScope === 'LOBBY') {
    return 'GLOBAL';
  }

  if (safeUpper(ctx.runOutcome) === 'SOVEREIGNTY') {
    return 'DEAL_ROOM';
  }

  if ((ctx.haterHeat ?? 0) >= 0.72) {
    return 'SYNDICATE';
  }

  return 'GLOBAL';
}

function inferThreatBandFromContext(ctx: GameChatContext): ChatThreatSnapshot {
  const messages = coerceChatMessages([
    {
      id: 'ctx-threat-snapshot',
      channel: chooseDefaultTab(ctx),
      kind: (ctx.haterHeat ?? 0) > 0.55 ? 'BOT_ATTACK' : 'SYSTEM',
      senderId: 'system',
      senderName: 'System',
      body: 'Threat snapshot',
      ts: nowMs(),
      pressureTier: ctx.pressureTier,
      tickTier: ctx.tickTier,
      rescueDecision:
        (ctx.haterHeat ?? 0) >= 0.78
          ? {
              interventionId: 'ctx-rescue' as any,
              triggerAt: nowMs() as any,
              style: 'DIRECTIVE',
              reason: 'FAILED_ACTION_CHAIN',
              suggestedAction: 'Protect cash and reduce exposed lines.'
            }
          : undefined,
    },
  ]);

  const base = extractThreatSnapshot(messages);
  const score01 = clamp01(
    Math.max(
      base.score01,
      (ctx.haterHeat ?? 0) * 0.65 +
        (safeUpper(ctx.pressureTier) === 'BREAKPOINT' || safeUpper(ctx.pressureTier) === 'CRITICAL' ? 0.22 : safeUpper(ctx.pressureTier) === 'PRESSURED' ? 0.12 : 0) +
        (safeUpper(ctx.tickTier) === 'SUDDEN_DEATH' ? 0.11 : 0),
    ),
  );

  const band =
    score01 >= 0.85
      ? 'SEVERE'
      : score01 >= 0.60
        ? 'HIGH'
        : score01 >= 0.35
          ? 'ELEVATED'
          : score01 >= 0.10
            ? 'LOW'
            : 'QUIET';

  return {
    ...base,
    score01,
    score100: Math.round(score01 * 100),
    band,
    rescueNeeded: base.rescueNeeded || score01 >= 0.72,
    activePressureTier: ctx.pressureTier ?? base.activePressureTier,
    activeTickTier: ctx.tickTier ?? base.activeTickTier,
  };
}

function inferHelperPrompt(
  ctx: GameChatContext,
  threat: ChatThreatSnapshot,
): ChatHelperPromptSnapshot {
  if (threat.band === 'SEVERE') {
    return {
      visible: true,
      tone: 'urgent',
      title: 'Immediate posture correction',
      body:
        'You are inside a live pressure window. Preserve cash, cut exposed lines, and stop narrating urgency in public.',
      ctaLabel: 'Stabilize now',
    };
  }

  if (safeUpper(ctx.runOutcome) === 'LOSS' || safeUpper(ctx.runOutcome) === 'BANKRUPTCY') {
    return {
      visible: true,
      tone: 'calm',
      title: 'Recovery lane is still open',
      body:
        'The collapse is real, but it is not the whole board. Recover sequence, reduce noise, and choose the next clean move.',
      ctaLabel: 'Take recovery line',
    };
  }

  if (safeUpper(ctx.pressureTier) === 'PRESSURED' || safeUpper(ctx.pressureTier) === 'CRITICAL' || safeUpper(ctx.pressureTier) === 'BREAKPOINT' || threat.band === 'HIGH') {
    return {
      visible: true,
      tone: 'strategic',
      title: 'Pressure is shaping the room',
      body:
        'Slow the tempo. The best next move is the one that preserves optionality and denies usable receipts.',
      ctaLabel: 'Hold structure',
    };
  }

  if ((ctx.haterHeat ?? 0) >= 0.55) {
    return {
      visible: true,
      tone: 'blunt',
      title: 'Visible aggression detected',
      body:
        'Do less, cleaner, faster. The attack feeds on your loose sequencing more than on your weakness.',
      ctaLabel: 'Tighten lane',
    };
  }

  return {
    visible: false,
    tone: 'calm',
    title: '',
    body: '',
    ctaLabel: '',
  };
}

function pickPersonaByContext(
  ctx: GameChatContext,
  channel: ChatChannel,
): RuntimePersonaProfile {
  if (channel === 'DEAL_ROOM') {
    return HATER_PERSONAS[0];
  }

  if (safeUpper(ctx.pressureTier) === 'CRITICAL' || safeUpper(ctx.pressureTier) === 'BREAKPOINT') {
    return HATER_PERSONAS[1];
  }

  if ((ctx.haterHeat ?? 0) >= 0.65) {
    return HATER_PERSONAS[2];
  }

  return HATER_PERSONAS[1];
}

function buildMessageMeta(
  ctx: GameChatContext,
  options: {
    statusText?: string;
    pressureTier?: PressureTier;
    tickTier?: TickTier;
    runOutcome?: RunOutcome;
    botSource?: BotTauntSource;
  } = {},
): ChatMessageMeta {
  return {
    requestId: undefined,
    roomId: ctx.roomId as any,
    channelId: undefined,
    debug: {
      statusText: options.statusText,
      pressureTier: options.pressureTier ?? ctx.pressureTier,
      tickTier: options.tickTier ?? ctx.tickTier,
      runOutcome: options.runOutcome ?? ctx.runOutcome,
      botSource: options.botSource ? {
        botId: options.botSource.botId,
        attackType: options.botSource.attackType,
        targetLayer: options.botSource.targetLayer,
      } : undefined,
    },
  };
}

function buildSystemMessage(
  ctx: GameChatContext,
  partial: Partial<ChatMessage> & {
    channel?: ChatChannel;
    kind?: ExtendedMessageKind;
    body: string;
  },
  fallbackSeed: number,
): ChatMessage {
  return coerceChatMessage(
    {
      id: partial.id,
      channel: partial.channel ?? chooseDefaultTab(ctx),
      kind: partial.kind ?? 'SYSTEM',
      senderId: partial.senderId ?? 'system',
      senderName: partial.senderName ?? 'System',
      senderRank: partial.senderRank ?? 'Runtime',
      body: partial.body,
      emoji: partial.emoji,
      ts: partial.ts ?? nowMs(),
      immutable: partial.immutable ?? true,
      proofHash: partial.proofHash,
      botSource: partial.botSource,
      pressureTier: partial.pressureTier ?? ctx.pressureTier,
      tickTier: partial.tickTier ?? ctx.tickTier,
      runOutcome: partial.runOutcome ?? ctx.runOutcome,
      shieldMeta: partial.shieldMeta,
      cascadeMeta: partial.cascadeMeta,
      meta:
        partial.meta ??
        buildMessageMeta(ctx, {
          statusText: partial.kind ?? 'SYSTEM',
          botSource: partial.botSource,
        }),
      rescueDecision: partial.rescueDecision,
      relationshipState: partial.relationshipState,
      affect: partial.affect,
      learningProfile: partial.learningProfile ?? ctx.learningProfile,
      liveOpsState: partial.liveOpsState ?? ctx.liveOpsState,
      audienceHeat: partial.audienceHeat ?? ctx.audienceHeat,
      reputationState: partial.reputationState ?? ctx.reputation,
      compatibility: {
        compatibilityLevel: 'ENGINE_BACKED',
        derivesFromSharedContracts: true,
        derivesFromEnginePublicLane: true,
        derivedFromFrameKind: 'LegacyComponentCompatibility',
        authoritative: false,
      },
    },
    fallbackSeed,
  );
}

function buildPlayerMessage(
  ctx: GameChatContext,
  channel: ChatChannel,
  body: string,
  fallbackSeed: number,
): ChatMessage {
  return coerceChatMessage(
    {
      id: `player-${channel.toLowerCase()}-${fallbackSeed}-${toStableKey(body)}`,
      channel,
      kind: 'PLAYER',
      senderId: CHANNEL_SENDERS[channel],
      senderName: ctx.playerName?.trim() || DEFAULT_PLAYER_NAMES[channel],
      senderRank: DEFAULT_PLAYER_RANK,
      senderRole: 'PLAYER',
      body: body.slice(0, USE_CHAT_ENGINE_LIMITS.maxBodyLength),
      ts: nowMs(),
      immutable: false,
      pressureTier: ctx.pressureTier,
      tickTier: ctx.tickTier,
      runOutcome: ctx.runOutcome,
      meta: buildMessageMeta(ctx, { statusText: 'PLAYER_SENT' }),
      compatibility: {
        compatibilityLevel: 'ENGINE_BACKED',
        derivesFromSharedContracts: true,
        derivesFromEnginePublicLane: true,
        derivedFromFrameKind: 'LegacyPlayerSend',
        authoritative: false,
      },
    },
    fallbackSeed,
  );
}

function buildHelperMessage(
  ctx: GameChatContext,
  channel: ChatChannel,
  tone: ChatHelperPromptSnapshot['tone'],
  body: string,
  fallbackSeed: number,
): ChatMessage {
  const persona = CHANNEL_PERSONAS[channel];
  return buildSystemMessage(
    ctx,
    {
      id: `helper-${channel.toLowerCase()}-${fallbackSeed}-${toStableKey(body)}`,
      channel,
      kind: 'HELPER_PROMPT',
      senderId: `helper-${channel.toLowerCase()}`,
      senderName: persona.helperName,
      senderRank: persona.helperRank,
      emoji: persona.helperEmoji,
      body,
      immutable: true,
      meta: buildMessageMeta(ctx, { statusText: `HELPER_${tone.toUpperCase()}` }),
      rescueDecision: {
        interventionId: `rescue-${channel.toLowerCase()}-${fallbackSeed}` as any,
        triggerAt: nowMs() as any,
        style:
          tone === 'urgent'
            ? 'DIRECTIVE'
            : tone === 'blunt'
              ? 'BLUNT'
              : tone === 'strategic'
                ? 'DIRECTIVE'
                : 'CALM',
        reason: 'FAILED_ACTION_CHAIN',
        suggestedAction:
          tone === 'urgent'
            ? 'Protect cash and cut exposed lines immediately.'
            : tone === 'blunt'
              ? 'Tighten sequencing and reduce public leakage.'
              : tone === 'strategic'
                ? 'Hold structure and preserve optionality.'
                : 'Take the next clean move.' ,
      },
    },
    fallbackSeed,
  );
}

function buildHaterMessage(
  ctx: GameChatContext,
  channel: ChatChannel,
  profile: RuntimePersonaProfile,
  body: string,
  fallbackSeed: number,
): ChatMessage {
  const botSource: BotTauntSource = {
    botId: profile.id,
    botName: profile.name,
    botState: 'ATTACKING',
    attackType: profile.attackType,
    dialogue: body,
    targetLayer: 'L2',
    isRetreat: false,
  };

  return buildSystemMessage(
    ctx,
    {
      id: `hater-${profile.id}-${fallbackSeed}-${toStableKey(body)}`,
      channel,
      kind: channel === 'DEAL_ROOM' ? 'BOT_ATTACK' : 'BOT_TAUNT',
      senderId: profile.id,
      senderName: profile.name,
      senderRank: profile.rank,
      emoji: profile.emoji,
      body,
      immutable: true,
      botSource,
      meta: buildMessageMeta(ctx, {
        statusText: 'HATER_REACTION',
        botSource,
      }),
    },
    fallbackSeed,
  );
}

function classifyEventKind(eventText: string): {
  readonly kind: ExtendedMessageKind;
  readonly channel: ChatChannel;
} {
  const upper = safeUpper(eventText);

  for (const entry of SYSTEM_EVENT_PATTERNS) {
    if (upper.includes(entry.needle)) {
      return {
        kind: entry.kind,
        channel: entry.channel,
      };
    }
  }

  return {
    kind: 'SYSTEM',
    channel: 'GLOBAL',
  };
}

function inferSabotageCard(
  attackType: AttackType,
  eventText: string,
): SabotageCardType {
  const upper = safeUpper(eventText);

  if (attackType === 'LIQUIDITY_STRIKE' || upper.includes('CASH')) {
    return 'EMERGENCY_EXPENSE';
  }

  if (attackType === 'NEGOTIATION_TRAP' || upper.includes('MARKET') || upper.includes('REPUT')) {
    return 'MARKET_CORRECTION';
  }

  if (attackType === 'PRESSURE_SPIKE' || upper.includes('AUDIT') || upper.includes('INSPECT')) {
    return 'INSPECTION_NOTICE';
  }

  if (upper.includes('DEBT')) {
    return 'DEBT_SPIRAL';
  }

  if (upper.includes('INCOME')) {
    return 'INCOME_SEIZURE';
  }

  return 'SYSTEM_GLITCH';
}

function inferShieldLayer(eventText: string): ShieldLayerId | undefined {
  const upper = safeUpper(eventText);
  if (upper.includes('L3') || upper.includes('LAYER_03') || upper.includes('LAYER 03')) return 'L3';
  if (upper.includes('L2') || upper.includes('LAYER_02') || upper.includes('LAYER 02')) return 'L2';
  if (upper.includes('L1') || upper.includes('LAYER_01') || upper.includes('LAYER 01')) return 'L1';
  return undefined;
}

function deriveContextDelta(
  previous: GameChatContext | null,
  next: GameChatContext,
): ContextDelta {
  if (!previous) {
    return {
      tickChanged: true,
      pressureChanged: true,
      tickTierChanged: true,
      runOutcomeChanged: true,
      heatChanged: true,
      netWorthDrop: false,
      liquidityShock: false,
      newEvents: next.events.slice(0, USE_CHAT_ENGINE_LIMITS.maxEventsPerDigest),
      scoreShock: false,
    };
  }

  const previousEvents = new Set(previous.events);
  const newEvents = next.events
    .filter((event) => !previousEvents.has(event))
    .slice(0, USE_CHAT_ENGINE_LIMITS.maxEventsPerDigest);

  const previousNetWorth = previous.netWorth ?? previous.economy?.netWorth ?? 0;
  const nextNetWorth = next.netWorth ?? next.economy?.netWorth ?? 0;
  const previousLiquidity = previous.economy?.availableLiquidity ?? previous.cash ?? 0;
  const nextLiquidity = next.economy?.availableLiquidity ?? next.cash ?? 0;
  const previousThreat = previous.score?.threatScore ?? previous.haterHeat ?? 0;
  const nextThreat = next.score?.threatScore ?? next.haterHeat ?? 0;

  return {
    tickChanged: previous.tick !== next.tick,
    pressureChanged: previous.pressureTier !== next.pressureTier,
    tickTierChanged: previous.tickTier !== next.tickTier,
    runOutcomeChanged: previous.runOutcome !== next.runOutcome,
    heatChanged: previous.haterHeat !== next.haterHeat,
    netWorthDrop: nextNetWorth < previousNetWorth,
    liquidityShock: nextLiquidity < previousLiquidity * 0.8,
    newEvents,
    scoreShock: nextThreat > previousThreat + 0.14,
  };
}

function buildContextDigestMessages(
  previous: GameChatContext | null,
  next: GameChatContext,
  fallbackSeedBase: number,
): HookMessageAccumulator {
  const delta = deriveContextDelta(previous, next);
  const nextMessages: ChatMessage[] = [];
  const sabotageEvents: SabotageEvent[] = [];
  let fallbackSeed = fallbackSeedBase;

  if (!previous) {
    nextMessages.push(
      buildSystemMessage(
        next,
        {
          id: 'system-boot',
          channel: chooseDefaultTab(next),
          kind: 'SYSTEM',
          senderName: 'System',
          senderRank: 'Runtime',
          body:
            'Chat runtime linked to the current game surface. Local compatibility lane is active while unified authority migration continues.',
          immutable: true,
        },
        fallbackSeed++,
      ),
    );
  }

  if (delta.pressureChanged && next.pressureTier) {
    nextMessages.push(
      buildSystemMessage(
        next,
        {
          channel: 'SYNDICATE',
          kind: safeUpper(next.pressureTier) === 'CRITICAL' || safeUpper(next.pressureTier) === 'BREAKPOINT' ? 'MARKET_ALERT' : 'SYSTEM',
          senderName: 'Pressure Feed',
          senderRank: 'Signal Runtime',
          body: `Pressure tier shifted to ${next.pressureTier}. The room will now price hesitation differently.`,
          immutable: true,
        },
        fallbackSeed++,
      ),
    );
  }

  if (delta.tickTierChanged && next.tickTier) {
    nextMessages.push(
      buildSystemMessage(
        next,
        {
          channel: 'GLOBAL',
          kind: 'SYSTEM',
          senderName: 'Tick Feed',
          senderRank: 'Run Tempo',
          body: `Run tempo advanced to ${next.tickTier}. Expect cadence and hostility patterns to shift with the clock.`,
          immutable: true,
        },
        fallbackSeed++,
      ),
    );
  }

  if (delta.runOutcomeChanged && next.runOutcome) {
    nextMessages.push(
      buildSystemMessage(
        next,
        {
          channel: safeUpper(next.runOutcome) === 'SOVEREIGNTY' ? 'DEAL_ROOM' : 'GLOBAL',
          kind:
            safeUpper(next.runOutcome) === 'SOVEREIGNTY'
              ? 'ACHIEVEMENT'
              : safeUpper(next.runOutcome) === 'LOSS' || safeUpper(next.runOutcome) === 'BANKRUPTCY'
                ? 'MARKET_ALERT'
                : 'SYSTEM',
          senderName: 'Outcome Feed',
          senderRank: 'Run Verdict',
          body:
            safeUpper(next.runOutcome) === 'SOVEREIGNTY'
              ? 'Sovereign posture achieved. The room will remember this line.'
              : safeUpper(next.runOutcome) === 'LOSS'
                ? 'Run integrity collapsed. Recovery chatter is now a first-class gameplay surface.'
                : safeUpper(next.runOutcome) === 'BANKRUPTCY'
                  ? 'Bankruptcy condition registered. Public heat will rise unless the next sequence is disciplined.'
                  : `Run outcome changed to ${next.runOutcome}.`,
          immutable: true,
        },
        fallbackSeed++,
      ),
    );
  }

  if (delta.netWorthDrop || delta.liquidityShock) {
    nextMessages.push(
      buildSystemMessage(
        next,
        {
          channel: 'GLOBAL',
          kind: 'MARKET_ALERT',
          senderName: 'Market Feed',
          senderRank: 'Liquidity Watch',
          body:
            delta.liquidityShock
              ? 'Liquidity shock detected. The wrong public reply will now cost more than silence.'
              : 'Net-worth drawdown detected. Expect hater pressure to convert loss into social leverage.',
          immutable: true,
        },
        fallbackSeed++,
      ),
    );
  }

  if (delta.heatChanged && (next.haterHeat ?? 0) >= 0.68) {
    const persona = pickPersonaByContext(next, 'GLOBAL');
    nextMessages.push(
      buildHaterMessage(
        next,
        'GLOBAL',
        persona,
        persona.taunts[(next.tick + fallbackSeed) % persona.taunts.length] ?? persona.taunts[0],
        fallbackSeed++,
      ),
    );
  }

  for (const eventText of delta.newEvents) {
    const classified = classifyEventKind(eventText);
    const kind = classified.kind;
    const channel = classified.channel;

    const persona = pickPersonaByContext(next, channel);
    const message = buildSystemMessage(
      next,
      {
        channel,
        kind,
        senderName:
          kind === 'BOT_ATTACK' || kind === 'BOT_TAUNT'
            ? persona.name
            : kind === 'DEAL_RECAP'
              ? 'Deal Wire'
              : kind === 'SHIELD_EVENT'
                ? 'Shield Feed'
                : kind === 'CASCADE_ALERT'
                  ? 'Cascade Feed'
                  : 'System',
        senderRank:
          kind === 'BOT_ATTACK' || kind === 'BOT_TAUNT'
            ? persona.rank
            : kind === 'DEAL_RECAP'
              ? 'Negotiation Ledger'
              : kind === 'SHIELD_EVENT'
                ? 'Defense Runtime'
                : kind === 'CASCADE_ALERT'
                  ? 'Cascade Runtime'
                  : 'Runtime',
        emoji:
          kind === 'BOT_ATTACK'
            ? persona.emoji
            : kind === 'BOT_TAUNT'
              ? persona.emoji
              : kind === 'SHIELD_EVENT'
                ? '🛡️'
                : kind === 'CASCADE_ALERT'
                  ? '🌊'
                  : kind === 'DEAL_RECAP'
                    ? '🤝'
                    : kind === 'ACHIEVEMENT'
                      ? '👑'
                      : kind === 'MARKET_ALERT'
                        ? '📉'
                        : '◎',
        body:
          kind === 'BOT_ATTACK'
            ? persona.attacks[(fallbackSeed + next.tick) % persona.attacks.length] ?? eventText
            : kind === 'BOT_TAUNT'
              ? persona.taunts[(fallbackSeed + next.tick) % persona.taunts.length] ?? eventText
              : eventText,
        immutable: true,
        botSource:
          kind === 'BOT_ATTACK' || kind === 'BOT_TAUNT'
            ? {
                botId: persona.id,
                botName: persona.name,
                botState: kind === 'BOT_ATTACK' ? 'ATTACKING' : 'TAUNTING',
                attackType: persona.attackType,
                targetLayer: inferShieldLayer(eventText),
                dialogue:
                  kind === 'BOT_ATTACK'
                    ? persona.attacks[(fallbackSeed + next.tick) % persona.attacks.length] ?? eventText
                    : persona.taunts[(fallbackSeed + next.tick) % persona.taunts.length] ?? eventText,
                isRetreat: false,
              }
            : undefined,
        shieldMeta:
          kind === 'SHIELD_EVENT'
            ? {
                layerId: inferShieldLayer(eventText) ?? 'L2',
                integrity: 0.31,
                maxIntegrity: 1,
                isBreached: safeUpper(eventText).includes('BREACH'),
                attackId: `shield-${toStableKey(eventText)}`,
              }
            : undefined,
        cascadeMeta:
          kind === 'CASCADE_ALERT'
            ? {
                cascadeId: `cascade-${toStableKey(eventText)}`,
                severity: safeUpper(eventText).includes('SEVERE')
                  ? ('SEVERE' as CascadeSeverity)
                  : safeUpper(eventText).includes('HIGH')
                    ? ('HIGH' as CascadeSeverity)
                    : ('MEDIUM' as CascadeSeverity),
                stepCount: 3,
                trigger: eventText,
              }
            : undefined,
      },
      fallbackSeed++,
    );

    nextMessages.push(message);

    if (kind === 'BOT_ATTACK') {
      sabotageEvents.push(
        createSabotageEvent({
          haterId: persona.id,
          haterName: persona.name,
          cardType: inferSabotageCard(persona.attackType, eventText),
          intensity: clamp01((next.haterHeat ?? 0.5) + 0.18),
          botId: persona.id,
          attackType: persona.attackType,
          targetLayer: inferShieldLayer(eventText),
          pressureTier: next.pressureTier,
          tickTier: next.tickTier,
          proofHash: message.proofHash,
          ts: message.ts,
          sourceChannel: channel,
          sourceMessageId: message.id,
          recoveryHint:
            persona.helperCounters[(fallbackSeed + next.tick) % persona.helperCounters.length] ??
            'Reduce exposure and preserve cash before responding publicly.',
          relationshipState: next.learningProfile?.relationships?.[persona.id],
          affect: next.affect,
        }),
      );
    }
  }

  return {
    nextMessages,
    generatedSabotageEvents: sabotageEvents,
  };
}

function createConnectionLifecycleMessages(
  previous: ChatConnectionState | null,
  next: ConnectionSnapshot,
  ctx: GameChatContext,
  fallbackSeedBase: number,
): readonly ChatMessage[] {
  if (!previous || previous === next.state) {
    return [];
  }

  const label =
    next.state === 'CONNECTED'
      ? 'Transport linked to the current room.'
      : next.state === 'DEGRADED'
        ? 'Transport is degraded. UI lane remains responsive while authority stays remote.'
        : next.state === 'RESUMING'
          ? 'Transport is resuming. Expect brief synchronization delay.'
          : next.state === 'CONNECTING'
            ? 'Transport handshake started.'
            : 'Transport disconnected. Local compatibility lane remains visible.';

  return [
    buildSystemMessage(
      ctx,
      {
        id: `transport-state-${next.state.toLowerCase()}`,
        channel: 'GLOBAL',
        kind: 'SYSTEM',
        senderName: 'Transport',
        senderRank: 'Gateway',
        body: label,
        immutable: true,
      },
      fallbackSeedBase,
    ),
  ];
}

function appendBounded(
  previous: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
  dedupe: Map<string, FingerprintEntry>,
): ChatMessage[] {
  if (incoming.length === 0) {
    return previous.slice();
  }

  const merged = [...previous];
  const now = nowMs();

  for (const message of incoming) {
    const fingerprint = `${message.channel}|${message.kind}|${message.senderId}|${message.body}|${message.proofHash ?? ''}`;
    const known = dedupe.get(fingerprint);

    if (known && now - known.ts <= USE_CHAT_ENGINE_LIMITS.duplicateWindowMs) {
      continue;
    }

    dedupe.set(fingerprint, { ts: now, messageId: message.id });
    merged.push(message);
  }

  if (dedupe.size > USE_CHAT_ENGINE_LIMITS.recentFingerprintWindow) {
    const sortedEntries = [...dedupe.entries()].sort((a, b) => a[1].ts - b[1].ts);
    const toDelete = sortedEntries.slice(
      0,
      Math.max(0, sortedEntries.length - USE_CHAT_ENGINE_LIMITS.recentFingerprintWindow),
    );
    for (const [key] of toDelete) {
      dedupe.delete(key);
    }
  }

  return sortMessagesForRender(merged).slice(-USE_CHAT_ENGINE_LIMITS.maxMessages);
}

function recalculateUnread(
  messages: readonly ChatMessage[],
  state: HookState,
): Record<ChatChannel, number> {
  const grouped = groupMessagesByChannel(messages);

  if (!state.chatOpen) {
    return {
      GLOBAL: grouped.GLOBAL.length,
      SYNDICATE: grouped.SYNDICATE.length,
      DEAL_ROOM: grouped.DEAL_ROOM.length,
    };
  }

  return {
    GLOBAL: state.activeTab === 'GLOBAL' ? 0 : grouped.GLOBAL.length,
    SYNDICATE: state.activeTab === 'SYNDICATE' ? 0 : grouped.SYNDICATE.length,
    DEAL_ROOM: state.activeTab === 'DEAL_ROOM' ? 0 : grouped.DEAL_ROOM.length,
  };
}

function buildHookResult(
  state: HookState,
  switchTab: (tab: ChatChannel) => void,
  toggleChat: () => void,
  sendMessage: (body: string) => void,
  clearUnread: (channel?: ChatChannel) => void,
): UseChatEngineResult {
  const summaries = buildChannelSummaries(state.messages, state.activeTab);
  const threat = extractThreatSnapshot(state.messages);

  const helperPrompt: ChatHelperPromptSnapshot = threat.rescueNeeded
    ? {
        visible: true,
        tone: threat.band === 'SEVERE' ? 'urgent' : threat.band === 'HIGH' ? 'blunt' : 'strategic',
        title:
          threat.band === 'SEVERE'
            ? 'Rescue window active'
            : threat.band === 'HIGH'
              ? 'Pressure correction needed'
              : 'Tactical posture suggested',
        body:
          threat.band === 'SEVERE'
            ? 'You are inside an expensive window. Stabilize cash, reduce exposure, and stop public leakage.'
            : threat.band === 'HIGH'
              ? 'The room is pricing your next move harshly. Tighten sequence and deny clean attack surfaces.'
              : 'Pressure is climbing. Preserve optionality and let the hater overstate before you answer.',
        ctaLabel:
          threat.band === 'SEVERE'
            ? 'Stabilize'
            : threat.band === 'HIGH'
              ? 'Tighten'
              : 'Hold lane',
      }
    : {
        visible: false,
        tone: 'calm',
        title: '',
        body: '',
        ctaLabel: '',
      };

  return {
    messages: state.messages,
    activeTab: state.activeTab,
    chatOpen: state.chatOpen,
    connected:
      state.connectionState === 'CONNECTED' || state.connectionState === 'DEGRADED',
    unread: {
      GLOBAL: state.unread.GLOBAL,
      SYNDICATE: state.unread.SYNDICATE,
      DEAL_ROOM: state.unread.DEAL_ROOM,
      global: state.unread.GLOBAL,
      syndicate: state.unread.SYNDICATE,
      deal_room: state.unread.DEAL_ROOM,
    },
    totalUnread:
      state.unread.GLOBAL + state.unread.SYNDICATE + state.unread.DEAL_ROOM,
    switchTab,
    toggleChat,
    sendMessage,
    clearUnread,
    summaries,
    threat,
    helperPrompt,
    connectionState: state.connectionState,
  };
}

// ============================================================================
// MARK: Hook
// ============================================================================

export function useChatEngine(
  gameCtx: GameChatContext,
  accessToken?: string | null,
  onSabotage?: (event: SabotageEvent) => void,
): UseChatEngineResult {
  const normalizedContext = useMemo(
    () => normalizeGameChatContext(gameCtx ?? createEmptyGameChatContext()),
    [gameCtx],
  );

  const initialTab = useMemo(
    () => chooseDefaultTab(normalizedContext),
    [normalizedContext],
  );

  const connection = useMemo(
    () => inferConnectionSnapshot(normalizedContext, accessToken),
    [normalizedContext, accessToken],
  );

  const messageSeedRef = useRef(1);
  const prevContextRef = useRef<GameChatContext | null>(null);
  const dedupeRef = useRef<Map<string, FingerprintEntry>>(new Map());
  const lastSendAtRef = useRef<number>(0);
  const lastHelperAtRef = useRef<number>(0);
  const lastHaterAtRef = useRef<number>(0);
  const lastSystemAtRef = useRef<number>(0);
  const lastConnectionStateRef = useRef<ChatConnectionState | null>(null);
  const sabotageDispatchRef = useRef<Set<string>>(new Set());

  const [state, setState] = useState<HookState>(() => {
    const bootstrapContext = normalizeGameChatContext(gameCtx);
    const bootstrapMessages = sortMessagesForRender([
      buildSystemMessage(
        bootstrapContext,
        {
          id: 'bootstrap-chat-runtime',
          channel: chooseDefaultTab(bootstrapContext),
          kind: 'SYSTEM',
          senderName: 'System',
          senderRank: 'Compatibility Lane',
          body:
            'Legacy component chat surface is online. Canonical contracts are shared-backed while migration continues.',
          immutable: true,
        },
        messageSeedRef.current++,
      ),
    ]);

    return {
      messages: bootstrapMessages,
      activeTab: chooseDefaultTab(bootstrapContext),
      chatOpen: true,
      unread: {
        GLOBAL: 0,
        SYNDICATE: 0,
        DEAL_ROOM: 0,
      },
      connectionState: inferConnectionSnapshot(bootstrapContext, accessToken).state,
    };
  });

  useEffect(() => {
    const previous = prevContextRef.current;
    const fallbackSeed = messageSeedRef.current;
    const lifecycle = createConnectionLifecycleMessages(
      lastConnectionStateRef.current,
      connection,
      normalizedContext,
      fallbackSeed,
    );

    const digest = buildContextDigestMessages(
      previous,
      normalizedContext,
      fallbackSeed + lifecycle.length,
    );

    messageSeedRef.current += lifecycle.length + digest.nextMessages.length + 4;

    const threat = inferThreatBandFromContext(normalizedContext);
    const helperPrompt = inferHelperPrompt(normalizedContext, threat);
    const generated: ChatMessage[] = [...lifecycle, ...digest.nextMessages];
    const now = nowMs();

    if (
      helperPrompt.visible &&
      now - lastHelperAtRef.current >= USE_CHAT_ENGINE_LIMITS.helperRepeatCooldownMs
    ) {
      generated.push(
        buildHelperMessage(
          normalizedContext,
          threat.band === 'SEVERE' ? 'SYNDICATE' : chooseDefaultTab(normalizedContext),
          helperPrompt.tone,
          helperPrompt.body,
          messageSeedRef.current++,
        ),
      );
      lastHelperAtRef.current = now;
    }

    if (
      threat.band === 'HIGH' || threat.band === 'SEVERE'
    ) {
      const haterChannel =
        threat.band === 'SEVERE' ? 'DEAL_ROOM' : chooseDefaultTab(normalizedContext);
      const persona = pickPersonaByContext(normalizedContext, haterChannel);
      if (now - lastHaterAtRef.current >= USE_CHAT_ENGINE_LIMITS.haterRepeatCooldownMs) {
        generated.push(
          buildHaterMessage(
            normalizedContext,
            haterChannel,
            persona,
            threat.band === 'SEVERE'
              ? persona.attacks[(normalizedContext.tick + generated.length) % persona.attacks.length] ?? persona.attacks[0]
              : persona.taunts[(normalizedContext.tick + generated.length) % persona.taunts.length] ?? persona.taunts[0],
            messageSeedRef.current++,
          ),
        );
        lastHaterAtRef.current = now;
      }
    }

    if (
      (normalizedContext.liveOpsState?.activeWorldEvents?.length ?? 0) > 0 &&
      now - lastSystemAtRef.current >= USE_CHAT_ENGINE_LIMITS.systemRepeatCooldownMs
    ) {
      generated.push(
        buildSystemMessage(
          normalizedContext,
          {
            channel: 'GLOBAL',
            kind: 'WORLD_EVENT',
            senderName: 'LiveOps',
            senderRank: 'World Event Director',
            body: `World event pressure active: ${normalizedContext.liveOpsState?.activeWorldEvents?.join(', ')}`,
            immutable: true,
          },
          messageSeedRef.current++,
        ),
      );
      lastSystemAtRef.current = now;
    }

    setState((current) => {
      const nextMessages = appendBounded(current.messages, generated, dedupeRef.current);
      const nextUnread = recalculateUnread(nextMessages, {
        ...current,
        messages: nextMessages,
        connectionState: connection.state,
      });

      return {
        ...current,
        messages: nextMessages,
        unread: nextUnread,
        connectionState: connection.state,
      };
    });

    for (const sabotage of digest.generatedSabotageEvents) {
      const dispatchKey = sabotage.sourceMessageId ?? `${sabotage.haterId}|${sabotage.cardType}|${sabotage.ts}`;
      if (!sabotageDispatchRef.current.has(dispatchKey)) {
        sabotageDispatchRef.current.add(dispatchKey);
        onSabotage?.(sabotage);
      }
    }

    prevContextRef.current = normalizedContext;
    lastConnectionStateRef.current = connection.state;
  }, [normalizedContext, connection, onSabotage]);

  const switchTab = useCallback((tab: ChatChannel) => {
    setState((current) => {
      const nextTab = normalizeChatChannel(tab, current.activeTab);
      return {
        ...current,
        activeTab: nextTab,
        unread: {
          ...current.unread,
          [nextTab]: 0,
        },
      };
    });
  }, []);

  const toggleChat = useCallback(() => {
    setState((current) => {
      const nextOpen = !current.chatOpen;
      const unread = nextOpen
        ? {
            ...current.unread,
            [current.activeTab]: 0,
          }
        : current.unread;

      return {
        ...current,
        chatOpen: nextOpen,
        unread,
      };
    });
  }, []);

  const clearUnread = useCallback((channel?: ChatChannel) => {
    setState((current) => {
      if (!channel) {
        return {
          ...current,
          unread: {
            GLOBAL: 0,
            SYNDICATE: 0,
            DEAL_ROOM: 0,
          },
        };
      }

      const normalized = normalizeChatChannel(channel, current.activeTab);
      return {
        ...current,
        unread: {
          ...current.unread,
          [normalized]: 0,
        },
      };
    });
  }, []);

  const sendMessage = useCallback((body: string) => {
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }

    const now = nowMs();
    if (now - lastSendAtRef.current < USE_CHAT_ENGINE_LIMITS.localSendCooldownMs) {
      return;
    }
    lastSendAtRef.current = now;

    setState((current) => {
      const playerMessage = buildPlayerMessage(
        normalizedContext,
        current.activeTab,
        trimmed,
        messageSeedRef.current++,
      );

      let generated: ChatMessage[] = [playerMessage];
      const upper = safeUpper(trimmed);
      const persona = pickPersonaByContext(normalizedContext, current.activeTab);

      if (
        current.activeTab === 'DEAL_ROOM' &&
        (upper.includes('BUY') || upper.includes('SELL') || upper.includes('OFFER') || upper.includes('TERMS'))
      ) {
        generated = generated.concat([
          buildSystemMessage(
            normalizedContext,
            {
              channel: 'DEAL_ROOM',
              kind: 'DEAL_RECAP',
              senderName: 'Deal Wire',
              senderRank: 'Negotiation Ledger',
              body: 'Offer logged. Deal-room transcript integrity remains active while authority migrates outward.',
              immutable: true,
            },
            messageSeedRef.current++,
          ),
        ]);
      }

      if (
        upper.includes('HELP') ||
        upper.includes('RESCUE') ||
        upper.includes('WHAT NOW') ||
        upper.includes('STUCK')
      ) {
        generated = generated.concat([
          buildHelperMessage(
            normalizedContext,
            current.activeTab,
            'strategic',
            HELPER_LINES.strategic[(generated.length + normalizedContext.tick) % HELPER_LINES.strategic.length] ?? HELPER_LINES.strategic[0],
            messageSeedRef.current++,
          ),
        ]);
      } else if (
        upper.includes('COME GET ME') ||
        upper.includes('TRY ME') ||
        upper.includes('WEAK') ||
        upper.includes('TOO EASY')
      ) {
        generated = generated.concat([
          buildHaterMessage(
            normalizedContext,
            current.activeTab,
            persona,
            persona.taunts[(generated.length + normalizedContext.tick) % persona.taunts.length] ?? persona.taunts[0],
            messageSeedRef.current++,
          ),
        ]);
      }

      const nextMessages = appendBounded(current.messages, generated, dedupeRef.current);
      const nextUnread = recalculateUnread(nextMessages, {
        ...current,
        messages: nextMessages,
      });

      return {
        ...current,
        messages: nextMessages,
        unread: nextUnread,
      };
    });
  }, [normalizedContext]);

  return useMemo(
    () =>
      buildHookResult(
        state,
        switchTab,
        toggleChat,
        sendMessage,
        clearUnread,
      ),
    [state, switchTab, toggleChat, sendMessage, clearUnread],
  );
}

// ============================================================================
// MARK: Public helpers for tests, tooling, and later engine-lane replacement
// ============================================================================

export function deriveChatSummariesForContext(
  ctx: GameChatContext,
  messages: readonly ChatMessage[],
  activeTab?: ChatChannel,
): readonly ChatChannelSummary[] {
  const normalized = normalizeGameChatContext(ctx);
  return buildChannelSummaries(
    sortMessagesForRender(messages),
    activeTab ?? chooseDefaultTab(normalized),
  );
}

export function deriveChatThreatForContext(
  ctx: GameChatContext,
  messages: readonly ChatMessage[],
): ChatThreatSnapshot {
  const messageThreat = extractThreatSnapshot(messages);
  const contextThreat = inferThreatBandFromContext(normalizeGameChatContext(ctx));

  const score01 = Math.max(messageThreat.score01, contextThreat.score01);
  return {
    ...messageThreat,
    score01,
    score100: Math.round(score01 * 100),
    band:
      score01 >= 0.85
        ? 'SEVERE'
        : score01 >= 0.60
          ? 'HIGH'
          : score01 >= 0.35
            ? 'ELEVATED'
            : score01 >= 0.10
              ? 'LOW'
              : 'QUIET',
    rescueNeeded: messageThreat.rescueNeeded || contextThreat.rescueNeeded,
    activePressureTier:
      messageThreat.activePressureTier ?? contextThreat.activePressureTier,
    activeTickTier:
      messageThreat.activeTickTier ?? contextThreat.activeTickTier,
  };
}

export function deriveHelperPromptForContext(
  ctx: GameChatContext,
  messages: readonly ChatMessage[],
): ChatHelperPromptSnapshot {
  const threat = deriveChatThreatForContext(ctx, messages);
  return inferHelperPrompt(normalizeGameChatContext(ctx), threat);
}

export function buildTranscriptSearchResult(
  messages: readonly ChatMessage[],
  query: string,
  channel: ChatChannel,
): ChatTranscriptSearchResult {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = sortMessagesForRender(messages).filter(
    (message) => normalizeChatChannel(message.channel) === normalizeChatChannel(channel),
  );

  const matched = !normalizedQuery
    ? filtered
    : filtered.filter((message) => {
        const haystacks = [
          message.body,
          message.senderName,
          message.senderRank,
          message.proofHash,
          message.botSource?.botName,
          message.meta?.statusText,
          getChatChannelLabel(message.channel),
          getChatChannelDescription(message.channel),
        ].filter(Boolean);

        return haystacks.some((value) =>
          String(value).toLowerCase().includes(normalizedQuery),
        );
      });

  return {
    query,
    totalMatches: matched.length,
    channel: normalizeChatChannel(channel),
    messageIds: matched.map((message) => message.id),
    messages: matched,
  };
}

export const USE_CHAT_ENGINE_PUBLIC_MANIFEST = Object.freeze({
  filePath: USE_CHAT_ENGINE_FILE_PATH,
  version: USE_CHAT_ENGINE_VERSION,
  revision: USE_CHAT_ENGINE_REVISION,
  migration: USE_CHAT_ENGINE_MIGRATION_MODE,
  laws: USE_CHAT_ENGINE_RUNTIME_LAWS,
  limits: USE_CHAT_ENGINE_LIMITS,
  visibleChannels: VISIBLE_CHANNELS,
  defaultPlayerRank: DEFAULT_PLAYER_RANK,
  runtimeBundle: USE_CHAT_ENGINE_RUNTIME_BUNDLE,
});

export default useChatEngine;
