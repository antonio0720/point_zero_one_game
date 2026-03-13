
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE TYPING CONTROLLER
 * FILE: pzo-web/src/engines/chat/ChatTypingController.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend typing authority for the unified chat engine.
 *
 * This file does not treat typing as a cosmetic boolean. In Point Zero One,
 * typing is part of the pressure system:
 * - GLOBAL should feel busy, theatrical, and socially alive.
 * - SYNDICATE should feel intentional, trusted, and tactically restrained.
 * - DEAL_ROOM should feel delayed, predatory, and psychologically quiet.
 * - LOBBY should feel welcoming but not noisy.
 *
 * Why this file exists
 * --------------------
 * The current donor hook in pzo-web/src/components/chat/useChatEngine.ts mixes:
 * - message send behavior,
 * - NPC cadence,
 * - unread ownership,
 * - socket ownership,
 * - engine event reflection,
 * - and basic chat UX.
 *
 * The new canonical chat engine needs typing to become its own subsystem so
 * presence, transport, notification, and intelligence lanes can evolve without
 * components owning timing policy.
 *
 * Design laws
 * -----------
 * - UI never emits raw typing socket events directly.
 * - Typing should begin only when intent is real.
 * - Typing should refresh while composition remains meaningful.
 * - Typing should stop deterministically on send, blur, hide, cooldown, or
 *   suppression.
 * - Different channels deserve different emotional timing.
 * - NPC/helper/hater typing theatre can be staged here, but transcript truth
 *   remains server authoritative.
 *
 * Migration note
 * --------------
 * This file is intentionally self-contained against the canonical engine files
 * already generated in this session:
 * - ./ChatSocketClient
 * - ./ChatPresenceController
 *
 * Once /shared/contracts/chat and pzo-web/src/engines/chat/types.ts are live,
 * local compatibility types can be replaced with canonical imports.
 *
 * Density6 LLC · Point Zero One · Production-first architecture
 */

import {
  ChatSocketClient,
  type ChatChannel,
  type ChatDisconnectReason,
  type ChatSocketClientStateSnapshot,
  type ChatTransportState,
} from './ChatSocketClient';

import {
  ChatPresenceController,
  type ChatPresenceAudienceMood,
  type ChatPresenceStripView,
  type ChatPresenceTransitionReason,
} from './ChatPresenceController';

export type ChatTypingLifecycleState =
  | 'IDLE'
  | 'ARMED'
  | 'STARTING'
  | 'TYPING'
  | 'COOLDOWN'
  | 'SUPPRESSED'
  | 'DESTROYED';

export type ChatTypingSuppressionReason =
  | 'none'
  | 'empty'
  | 'whitespace_only'
  | 'cooldown'
  | 'window_hidden'
  | 'window_blurred'
  | 'transport_offline'
  | 'chat_closed'
  | 'composer_unfocused'
  | 'message_send'
  | 'manual_force_stop'
  | 'rate_shaping'
  | 'mode_policy'
  | 'channel_policy'
  | 'length_insufficient'
  | 'duplicate_buffer'
  | 'frozen'
  | 'destroyed';

export type ChatTypingStartReason =
  | 'input_started'
  | 'input_resumed'
  | 'programmatic_restore'
  | 'focus_then_text'
  | 'channel_switch_with_text';

export type ChatTypingStopReason =
  | 'input_cleared'
  | 'input_deleted'
  | 'send_success'
  | 'send_failure'
  | 'transport_disconnected'
  | 'chat_closed'
  | 'window_hidden'
  | 'window_blurred'
  | 'focus_lost'
  | 'idle_timeout'
  | 'cooldown_timeout'
  | 'manual_force_stop'
  | 'destroyed';

export type ChatTypingRefreshReason =
  | 'meaningful_delta'
  | 'keystroke_keepalive'
  | 'focus_keepalive'
  | 'paste'
  | 'emoji'
  | 'composition_commit'
  | 'dealroom_offer_edit'
  | 'syndicate_tactical_update';

export type ChatTypingComposerFocusReason =
  | 'user_focus'
  | 'keyboard_shortcut'
  | 'auto_expand'
  | 'restore_draft'
  | 'channel_switch'
  | 'unknown';

export type ChatTypingLatencyBand =
  | 'INSTANT'
  | 'FAST'
  | 'STEADY'
  | 'CAUTIOUS'
  | 'PREDATORY';

export type ChatTypingChannelArchetype =
  | 'GLOBAL_THEATER'
  | 'SYNDICATE_TRUST'
  | 'DEALROOM_PRESSURE'
  | 'LOBBY_WELCOME';

export type ChatTypingTheaterActorRole =
  | 'NPC'
  | 'HELPER'
  | 'HATER'
  | 'SYSTEM';

export interface ChatTypingChannelPolicy {
  channel: ChatChannel;
  archetype: ChatTypingChannelArchetype;
  minCharsToStart: number;
  minWordsToRefresh: number;
  debounceStartMs: number;
  refreshPulseMs: number;
  idleStopMs: number;
  cooldownMs: number;
  duplicateWindowMs: number;
  maxContinuousMs: number;
  allowNpcTheater: boolean;
  allowAggressiveRefresh: boolean;
  latencyBand: ChatTypingLatencyBand;
}

export interface ChatTypingComposerSnapshot {
  channel: ChatChannel;
  rawText: string;
  normalizedText: string;
  length: number;
  trimmedLength: number;
  wordCount: number;
  lastEditedAt: number | null;
  lastMeaningfulEditAt: number | null;
  lastSentAt: number | null;
  lastStartedAt: number | null;
  lastStoppedAt: number | null;
  state: ChatTypingLifecycleState;
  suppressionReason: ChatTypingSuppressionReason;
  focused: boolean;
  visible: boolean;
  chatOpen: boolean;
  connected: boolean;
  active: boolean;
}

export interface ChatTypingStartDecision {
  allow: boolean;
  reason?: ChatTypingStartReason;
  suppressionReason?: ChatTypingSuppressionReason;
  channelPolicy: ChatTypingChannelPolicy;
  metrics: {
    trimmedLength: number;
    wordCount: number;
    meaningfulDelta: number;
  };
}

export interface ChatTypingRefreshDecision {
  allow: boolean;
  reason?: ChatTypingRefreshReason;
  suppressionReason?: ChatTypingSuppressionReason;
  nextPulseAt?: number;
  metrics: {
    trimmedLength: number;
    wordCount: number;
    meaningfulDelta: number;
    elapsedSinceLastRefreshMs: number;
  };
}

export interface ChatTypingStopDecision {
  shouldStop: boolean;
  reason?: ChatTypingStopReason;
  nextCheckAt?: number;
}

export interface ChatTypingTheaterPlan {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: ChatTypingTheaterActorRole;
  channel: ChatChannel;
  durationMs: number;
  delayBeforeStartMs: number;
  startedAt?: number;
  expiresAt?: number;
  mood?: ChatPresenceAudienceMood;
  textHint?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatTypingControllerMetricSnapshot {
  localStartCount: number;
  localRefreshCount: number;
  localStopCount: number;
  localSuppressedCount: number;
  npcTheaterCount: number;
  forcedStopCount: number;
  duplicateSuppressionCount: number;
  maxConcurrentTheater: number;
  lastStartedAt: number | null;
  lastStoppedAt: number | null;
}

export interface ChatTypingControllerSnapshot {
  activeChannel: ChatChannel;
  transportState: ChatTransportState;
  windowVisible: boolean;
  windowFocused: boolean;
  chatOpen: boolean;
  states: ChatTypingComposerSnapshot[];
  theaterQueueDepth: number;
  activeTheaterCount: number;
  metrics: ChatTypingControllerMetricSnapshot;
}

export interface ChatTypingControllerCallbacks {
  onTypingStateChanged?: (
    channel: ChatChannel,
    next: ChatTypingLifecycleState,
    previous: ChatTypingLifecycleState,
    context: {
      suppressionReason: ChatTypingSuppressionReason;
      ts: number;
    },
  ) => void;
  onTypingStarted?: (
    channel: ChatChannel,
    decision: ChatTypingStartDecision,
    snapshot: ChatTypingComposerSnapshot,
  ) => void;
  onTypingRefreshed?: (
    channel: ChatChannel,
    decision: ChatTypingRefreshDecision,
    snapshot: ChatTypingComposerSnapshot,
  ) => void;
  onTypingStopped?: (
    channel: ChatChannel,
    reason: ChatTypingStopReason,
    snapshot: ChatTypingComposerSnapshot,
  ) => void;
  onTypingSuppressed?: (
    channel: ChatChannel,
    reason: ChatTypingSuppressionReason,
    snapshot: ChatTypingComposerSnapshot,
  ) => void;
  onTheaterPlanned?: (plan: ChatTypingTheaterPlan) => void;
  onTheaterStarted?: (plan: ChatTypingTheaterPlan) => void;
  onTheaterCompleted?: (plan: ChatTypingTheaterPlan) => void;
  onSnapshotChanged?: (snapshot: ChatTypingControllerSnapshot) => void;
  onError?: (error: Error, context?: Record<string, unknown>) => void;
}

export interface ChatTypingControllerConfig {
  globalPolicy?: Partial<ChatTypingChannelPolicy>;
  syndicatePolicy?: Partial<ChatTypingChannelPolicy>;
  dealRoomPolicy?: Partial<ChatTypingChannelPolicy>;
  lobbyPolicy?: Partial<ChatTypingChannelPolicy>;
  allowTypingWhenHidden?: boolean;
  allowTypingWhenBlurred?: boolean;
  emitFocusKeepalive?: boolean;
  startOnPasteOverChars?: number;
  minimumMeaningfulDeltaChars?: number;
  maxDuplicateHashesPerChannel?: number;
  staleComposerDestroyAfterMs?: number;
  theaterRandomSeed?: number;
  log?: (message: string, context?: Record<string, unknown>) => void;
  warn?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
}

export interface ChatTypingControllerOptions {
  socketClient: ChatSocketClient;
  presenceController: ChatPresenceController;
  initialChannel?: ChatChannel;
  callbacks?: ChatTypingControllerCallbacks;
  config?: ChatTypingControllerConfig;
}

interface InternalComposerState {
  channel: ChatChannel;
  rawText: string;
  normalizedText: string;
  focused: boolean;
  visible: boolean;
  chatOpen: boolean;
  connected: boolean;
  active: boolean;
  state: ChatTypingLifecycleState;
  suppressionReason: ChatTypingSuppressionReason;
  wordCount: number;
  lastEditedAt: number | null;
  lastMeaningfulEditAt: number | null;
  lastRefreshAt: number | null;
  lastStartedAt: number | null;
  lastStoppedAt: number | null;
  lastSentAt: number | null;
  cooldownUntil: number | null;
  startTimer: ReturnType<typeof setTimeout> | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
  refreshTimer: ReturnType<typeof setTimeout> | null;
  duplicateHashes: string[];
  duplicateHashWindow: Map<string, number>;
  lastStartHash?: string;
}

interface InternalTheaterQueueEntry {
  plan: ChatTypingTheaterPlan;
  startTimer: ReturnType<typeof setTimeout> | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

const DEFAULT_GLOBAL_POLICY: ChatTypingChannelPolicy = {
  channel: 'GLOBAL',
  archetype: 'GLOBAL_THEATER',
  minCharsToStart: 1,
  minWordsToRefresh: 1,
  debounceStartMs: 180,
  refreshPulseMs: 1_500,
  idleStopMs: 4_800,
  cooldownMs: 1_000,
  duplicateWindowMs: 4_000,
  maxContinuousMs: 14_000,
  allowNpcTheater: true,
  allowAggressiveRefresh: true,
  latencyBand: 'FAST',
};

const DEFAULT_SYNDICATE_POLICY: ChatTypingChannelPolicy = {
  channel: 'SYNDICATE',
  archetype: 'SYNDICATE_TRUST',
  minCharsToStart: 2,
  minWordsToRefresh: 1,
  debounceStartMs: 260,
  refreshPulseMs: 1_800,
  idleStopMs: 5_400,
  cooldownMs: 900,
  duplicateWindowMs: 3_000,
  maxContinuousMs: 16_000,
  allowNpcTheater: true,
  allowAggressiveRefresh: false,
  latencyBand: 'STEADY',
};

const DEFAULT_DEALROOM_POLICY: ChatTypingChannelPolicy = {
  channel: 'DEAL_ROOM',
  archetype: 'DEALROOM_PRESSURE',
  minCharsToStart: 3,
  minWordsToRefresh: 1,
  debounceStartMs: 420,
  refreshPulseMs: 2_300,
  idleStopMs: 6_600,
  cooldownMs: 1_500,
  duplicateWindowMs: 5_500,
  maxContinuousMs: 22_000,
  allowNpcTheater: true,
  allowAggressiveRefresh: false,
  latencyBand: 'PREDATORY',
};

const DEFAULT_LOBBY_POLICY: ChatTypingChannelPolicy = {
  channel: 'LOBBY',
  archetype: 'LOBBY_WELCOME',
  minCharsToStart: 1,
  minWordsToRefresh: 1,
  debounceStartMs: 220,
  refreshPulseMs: 1_600,
  idleStopMs: 4_400,
  cooldownMs: 800,
  duplicateWindowMs: 2_500,
  maxContinuousMs: 10_000,
  allowNpcTheater: true,
  allowAggressiveRefresh: true,
  latencyBand: 'FAST',
};

const DEFAULT_CONFIG: Required<
  Pick<
    ChatTypingControllerConfig,
    | 'allowTypingWhenHidden'
    | 'allowTypingWhenBlurred'
    | 'emitFocusKeepalive'
    | 'startOnPasteOverChars'
    | 'minimumMeaningfulDeltaChars'
    | 'maxDuplicateHashesPerChannel'
    | 'staleComposerDestroyAfterMs'
    | 'theaterRandomSeed'
  >
> = {
  allowTypingWhenHidden: false,
  allowTypingWhenBlurred: false,
  emitFocusKeepalive: true,
  startOnPasteOverChars: 5,
  minimumMeaningfulDeltaChars: 1,
  maxDuplicateHashesPerChannel: 12,
  staleComposerDestroyAfterMs: 60_000,
  theaterRandomSeed: 71_991,
};

const CHANNELS: ChatChannel[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'];

function now(): number {
  return Date.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function coerceString(input: unknown): string {
  return typeof input === 'string' ? input : '';
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  return normalized.split(' ').filter(Boolean).length;
}

function createError(message: string, cause?: unknown): Error {
  if (cause instanceof Error) {
    return new Error(message, { cause });
  }
  return new Error(message);
}

function mergePolicy(
  base: ChatTypingChannelPolicy,
  patch?: Partial<ChatTypingChannelPolicy>,
): ChatTypingChannelPolicy {
  if (!patch) return { ...base };
  return {
    ...base,
    ...patch,
    channel: base.channel,
    archetype: patch.archetype ?? base.archetype,
  };
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `h_${hash.toString(16)}`;
}

function randomFromSeed(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0xffffffff;
  };
}

function inferMeaningfulDelta(previousNormalized: string, nextNormalized: string): number {
  if (previousNormalized === nextNormalized) return 0;
  if (!previousNormalized) return nextNormalized.length;
  if (!nextNormalized) return previousNormalized.length;
  const previousWords = previousNormalized.split(' ');
  const nextWords = nextNormalized.split(' ');
  const changedLength = Math.abs(nextNormalized.length - previousNormalized.length);
  const changedWords = Math.abs(nextWords.length - previousWords.length);
  if (changedLength === 0 && changedWords === 0) return 1;
  return Math.max(changedLength, changedWords);
}

function maybeExtractDealIntent(text: string): {
  containsMoney: boolean;
  containsPercent: boolean;
  containsOfferLanguage: boolean;
} {
  const normalized = normalizeText(text).toLowerCase();
  return {
    containsMoney: /\$[\d,.]+/.test(normalized),
    containsPercent: /\d+%/.test(normalized),
    containsOfferLanguage: /\b(offer|counter|deal|take it|final|terms|close|wire|settle)\b/.test(
      normalized,
    ),
  };
}

function deriveStopReasonFromSuppression(
  reason: ChatTypingSuppressionReason,
): ChatTypingStopReason {
  switch (reason) {
    case 'chat_closed':
      return 'chat_closed';
    case 'window_hidden':
      return 'window_hidden';
    case 'window_blurred':
      return 'window_blurred';
    case 'message_send':
      return 'send_success';
    case 'destroyed':
      return 'destroyed';
    default:
      return 'idle_timeout';
  }
}

function deriveComposerSnapshot(state: InternalComposerState): ChatTypingComposerSnapshot {
  return {
    channel: state.channel,
    rawText: state.rawText,
    normalizedText: state.normalizedText,
    length: state.rawText.length,
    trimmedLength: state.normalizedText.length,
    wordCount: state.wordCount,
    lastEditedAt: state.lastEditedAt,
    lastMeaningfulEditAt: state.lastMeaningfulEditAt,
    lastSentAt: state.lastSentAt,
    lastStartedAt: state.lastStartedAt,
    lastStoppedAt: state.lastStoppedAt,
    state: state.state,
    suppressionReason: state.suppressionReason,
    focused: state.focused,
    visible: state.visible,
    chatOpen: state.chatOpen,
    connected: state.connected,
    active: state.active,
  };
}

function shouldRespectWindowHidden(
  config: Required<Pick<ChatTypingControllerConfig, 'allowTypingWhenHidden'>>,
  visible: boolean,
): boolean {
  return !config.allowTypingWhenHidden && !visible;
}

function shouldRespectWindowBlurred(
  config: Required<Pick<ChatTypingControllerConfig, 'allowTypingWhenBlurred'>>,
  focused: boolean,
): boolean {
  return !config.allowTypingWhenBlurred && !focused;
}

function isMeaningfulPayload(
  normalizedText: string,
  policy: ChatTypingChannelPolicy,
): boolean {
  return normalizedText.length >= policy.minCharsToStart;
}

function defaultSuppressionForEmpty(normalizedText: string): ChatTypingSuppressionReason {
  if (normalizedText.length === 0) return 'empty';
  return 'whitespace_only';
}

function stateIsTyping(state: ChatTypingLifecycleState): boolean {
  return state === 'STARTING' || state === 'TYPING';
}

function archetypeWeight(policy: ChatTypingChannelPolicy): number {
  switch (policy.archetype) {
    case 'GLOBAL_THEATER':
      return 1;
    case 'LOBBY_WELCOME':
      return 2;
    case 'SYNDICATE_TRUST':
      return 3;
    case 'DEALROOM_PRESSURE':
      return 4;
    default:
      return 2;
  }
}

export class ChatTypingController {
  private readonly socketClient: ChatSocketClient;
  private readonly presenceController: ChatPresenceController;
  private readonly callbacks: ChatTypingControllerCallbacks;
  private readonly config: Required<
    Pick<
      ChatTypingControllerConfig,
      | 'allowTypingWhenHidden'
      | 'allowTypingWhenBlurred'
      | 'emitFocusKeepalive'
      | 'startOnPasteOverChars'
      | 'minimumMeaningfulDeltaChars'
      | 'maxDuplicateHashesPerChannel'
      | 'staleComposerDestroyAfterMs'
      | 'theaterRandomSeed'
    >
  >;
  private readonly log?: (message: string, context?: Record<string, unknown>) => void;
  private readonly warn?: (message: string, context?: Record<string, unknown>) => void;
  private readonly error?: (message: string, context?: Record<string, unknown>) => void;
  private readonly policies: Map<ChatChannel, ChatTypingChannelPolicy>;
  private readonly composerByChannel: Map<ChatChannel, InternalComposerState>;
  private readonly theaterQueue: Map<string, InternalTheaterQueueEntry>;
  private readonly random: () => number;

  private activeChannel: ChatChannel;
  private transportState: ChatTransportState = 'IDLE';
  private windowVisible = true;
  private windowFocused = true;
  private chatOpen = false;
  private destroyed = false;
  private staleSweepTimer: ReturnType<typeof setInterval> | null = null;
  private theaterPeak = 0;

  private readonly metrics: ChatTypingControllerMetricSnapshot = {
    localStartCount: 0,
    localRefreshCount: 0,
    localStopCount: 0,
    localSuppressedCount: 0,
    npcTheaterCount: 0,
    forcedStopCount: 0,
    duplicateSuppressionCount: 0,
    maxConcurrentTheater: 0,
    lastStartedAt: null,
    lastStoppedAt: null,
  };

  public constructor(options: ChatTypingControllerOptions) {
    this.socketClient = options.socketClient;
    this.presenceController = options.presenceController;
    this.callbacks = options.callbacks ?? {};
    this.config = {
      ...DEFAULT_CONFIG,
      ...options.config,
    };
    this.log = options.config?.log;
    this.warn = options.config?.warn;
    this.error = options.config?.error;
    this.activeChannel = options.initialChannel ?? this.presenceController.getActiveChannel();
    this.policies = new Map<ChatChannel, ChatTypingChannelPolicy>([
      ['GLOBAL', mergePolicy(DEFAULT_GLOBAL_POLICY, options.config?.globalPolicy)],
      ['SYNDICATE', mergePolicy(DEFAULT_SYNDICATE_POLICY, options.config?.syndicatePolicy)],
      ['DEAL_ROOM', mergePolicy(DEFAULT_DEALROOM_POLICY, options.config?.dealRoomPolicy)],
      ['LOBBY', mergePolicy(DEFAULT_LOBBY_POLICY, options.config?.lobbyPolicy)],
    ]);
    this.composerByChannel = new Map<ChatChannel, InternalComposerState>();
    this.theaterQueue = new Map<string, InternalTheaterQueueEntry>();
    this.random = randomFromSeed(this.config.theaterRandomSeed);

    for (const channel of CHANNELS) {
      this.composerByChannel.set(channel, this.createComposerState(channel));
    }

    try {
      const presenceSnapshot = this.presenceController.getSnapshot();
      this.windowVisible = presenceSnapshot.isWindowVisible;
      this.windowFocused = presenceSnapshot.isWindowFocused;
      this.chatOpen = presenceSnapshot.isChatOpen;
      this.transportState = presenceSnapshot.transportState;
      this.activeChannel = presenceSnapshot.activeChannel;
    } catch {
      const socketSnapshot = this.socketClient.getStateSnapshot();
      this.transportState = socketSnapshot.state;
    }

    this.staleSweepTimer = setInterval(() => {
      this.sweepStaleComposers();
      this.sweepExpiredTheater();
    }, 1_000);

    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Public read surface
  // ---------------------------------------------------------------------------

  public getActiveChannel(): ChatChannel {
    return this.activeChannel;
  }

  public getPolicy(channel: ChatChannel): ChatTypingChannelPolicy {
    return { ...this.requirePolicy(channel) };
  }

  public getComposerSnapshot(
    channel: ChatChannel = this.activeChannel,
  ): ChatTypingComposerSnapshot {
    return deriveComposerSnapshot(this.requireComposer(channel));
  }

  public getSnapshot(): ChatTypingControllerSnapshot {
    return {
      activeChannel: this.activeChannel,
      transportState: this.transportState,
      windowVisible: this.windowVisible,
      windowFocused: this.windowFocused,
      chatOpen: this.chatOpen,
      states: CHANNELS.map((channel) => this.getComposerSnapshot(channel)),
      theaterQueueDepth: this.theaterQueue.size,
      activeTheaterCount: [...this.theaterQueue.values()].filter(
        (entry) => Boolean(entry.plan.startedAt && entry.plan.expiresAt && entry.plan.expiresAt > now()),
      ).length,
      metrics: { ...this.metrics },
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    for (const state of this.composerByChannel.values()) {
      this.clearComposerTimers(state);
      state.state = 'DESTROYED';
      state.suppressionReason = 'destroyed';
    }

    for (const entry of this.theaterQueue.values()) {
      if (entry.startTimer) clearTimeout(entry.startTimer);
      if (entry.stopTimer) clearTimeout(entry.stopTimer);
    }
    this.theaterQueue.clear();

    if (this.staleSweepTimer) {
      clearInterval(this.staleSweepTimer);
      this.staleSweepTimer = null;
    }

    this.emitStateChangeForAll('DESTROYED', 'destroyed');
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Public runtime state inputs
  // ---------------------------------------------------------------------------

  public switchChannel(channel: ChatChannel): void {
    this.assertNotDestroyed('switchChannel');
    const previous = this.activeChannel;
    if (previous === channel) return;

    const previousState = this.requireComposer(previous);
    previousState.active = false;

    this.activeChannel = channel;

    const nextState = this.requireComposer(channel);
    nextState.active = true;
    nextState.chatOpen = this.chatOpen;
    nextState.visible = this.windowVisible;
    nextState.focused = this.windowFocused;
    nextState.connected = this.transportState === 'CONNECTED';

    if (nextState.focused && nextState.chatOpen && nextState.normalizedText) {
      this.evaluateStart(channel, 'channel_switch_with_text');
    }

    this.emitSnapshot();
  }

  public setChatOpen(isOpen: boolean): void {
    this.assertNotDestroyed('setChatOpen');

    this.chatOpen = isOpen;
    for (const state of this.composerByChannel.values()) {
      state.chatOpen = isOpen;
    }

    if (!isOpen) {
      for (const channel of CHANNELS) {
        this.stopTyping(channel, 'chat_closed');
      }
    } else {
      const state = this.requireComposer(this.activeChannel);
      if (state.focused && state.normalizedText) {
        this.evaluateStart(this.activeChannel, 'programmatic_restore');
      }
    }

    this.emitSnapshot();
  }

  public setWindowVisible(isVisible: boolean): void {
    this.assertNotDestroyed('setWindowVisible');

    this.windowVisible = isVisible;
    for (const state of this.composerByChannel.values()) {
      state.visible = isVisible;
    }

    if (!isVisible && !this.config.allowTypingWhenHidden) {
      for (const channel of CHANNELS) {
        this.suppress(channel, 'window_hidden');
      }
    } else if (isVisible) {
      const state = this.requireComposer(this.activeChannel);
      if (state.focused && state.chatOpen && state.normalizedText) {
        this.evaluateStart(this.activeChannel, 'programmatic_restore');
      }
    }

    this.emitSnapshot();
  }

  public setWindowFocus(isFocused: boolean): void {
    this.assertNotDestroyed('setWindowFocus');

    this.windowFocused = isFocused;
    for (const state of this.composerByChannel.values()) {
      state.focused = isFocused ? state.focused : false;
    }

    if (!isFocused && !this.config.allowTypingWhenBlurred) {
      for (const channel of CHANNELS) {
        this.suppress(channel, 'window_blurred');
      }
    } else if (isFocused && this.config.emitFocusKeepalive) {
      const state = this.requireComposer(this.activeChannel);
      if (state.focused && state.chatOpen && state.normalizedText) {
        this.evaluateRefresh(this.activeChannel, 'focus_keepalive');
      }
    }

    this.emitSnapshot();
  }

  public handleTransportState(
    next: ChatTransportState,
    _previous: ChatTransportState,
    reason?: ChatDisconnectReason,
  ): void {
    this.assertNotDestroyed('handleTransportState');

    this.transportState = next;
    const connected = next === 'CONNECTED';

    for (const state of this.composerByChannel.values()) {
      state.connected = connected;
    }

    if (!connected) {
      for (const channel of CHANNELS) {
        this.suppress(channel, 'transport_offline');
      }
      if (reason === 'destroyed') {
        this.destroy();
        return;
      }
    } else {
      const state = this.requireComposer(this.activeChannel);
      if (state.focused && state.chatOpen && state.visible && state.normalizedText) {
        this.evaluateStart(this.activeChannel, 'programmatic_restore');
      }
    }

    this.emitSnapshot();
  }

  public setComposerFocus(
    channel: ChatChannel = this.activeChannel,
    _reason: ChatTypingComposerFocusReason = 'unknown',
  ): void {
    this.assertNotDestroyed('setComposerFocus');

    const state = this.requireComposer(channel);
    state.focused = true;
    state.active = channel === this.activeChannel;

    if (
      channel === this.activeChannel &&
      state.normalizedText &&
      this.chatOpen &&
      this.windowVisible &&
      this.windowFocused
    ) {
      this.evaluateStart(channel, 'focus_then_text');
    }

    this.emitSnapshot();
  }

  public setComposerBlur(channel: ChatChannel = this.activeChannel): void {
    this.assertNotDestroyed('setComposerBlur');

    const state = this.requireComposer(channel);
    state.focused = false;
    if (!this.config.allowTypingWhenBlurred) {
      this.suppress(channel, 'composer_unfocused');
    } else {
      this.stopTyping(channel, 'focus_lost');
    }

    this.emitSnapshot();
  }

  public handleComposerInput(input: {
    channel?: ChatChannel;
    text: string;
    mode?: 'type' | 'paste' | 'replace' | 'programmatic';
    selectionStart?: number;
    selectionEnd?: number;
    isComposing?: boolean;
  }): void {
    this.assertNotDestroyed('handleComposerInput');

    const channel = input.channel ?? this.activeChannel;
    const state = this.requireComposer(channel);
    const policy = this.requirePolicy(channel);
    const text = coerceString(input.text);
    const normalizedText = normalizeText(text);
    const nextWordCount = countWords(text);
    const previousNormalized = state.normalizedText;
    const meaningfulDelta = inferMeaningfulDelta(previousNormalized, normalizedText);
    const mode = input.mode ?? 'type';
    const timestamp = now();

    state.rawText = text;
    state.normalizedText = normalizedText;
    state.wordCount = nextWordCount;
    state.lastEditedAt = timestamp;

    if (meaningfulDelta >= this.config.minimumMeaningfulDeltaChars) {
      state.lastMeaningfulEditAt = timestamp;
    }

    const pasteTrigger = mode === 'paste' && normalizedText.length >= this.config.startOnPasteOverChars;

    if (!normalizedText) {
      state.suppressionReason = defaultSuppressionForEmpty(text);
      this.stopTyping(channel, normalizedText ? 'input_deleted' : 'input_cleared');
      this.emitSnapshot();
      return;
    }

    if (this.checkDuplicateSuppression(channel, normalizedText, policy)) {
      this.suppress(channel, 'duplicate_buffer');
      this.emitSnapshot();
      return;
    }

    if (pasteTrigger) {
      this.evaluateStart(channel, 'input_resumed');
      this.evaluateRefresh(channel, 'paste');
      this.emitSnapshot();
      return;
    }

    if (!stateIsTyping(state.state)) {
      this.evaluateStart(channel, 'input_started');
    } else {
      const dealIntent = maybeExtractDealIntent(normalizedText);
      if (
        channel === 'DEAL_ROOM' &&
        (dealIntent.containsMoney || dealIntent.containsOfferLanguage || dealIntent.containsPercent)
      ) {
        this.evaluateRefresh(channel, 'dealroom_offer_edit');
      } else if (channel === 'SYNDICATE' && nextWordCount >= policy.minWordsToRefresh) {
        this.evaluateRefresh(channel, 'syndicate_tactical_update');
      } else {
        this.evaluateRefresh(channel, meaningfulDelta > 0 ? 'meaningful_delta' : 'keystroke_keepalive');
      }
    }

    this.emitSnapshot();
  }

  public noteMessageSent(args: {
    channel?: ChatChannel;
    text?: string;
    accepted?: boolean;
    messageId?: string;
  } = {}): void {
    this.assertNotDestroyed('noteMessageSent');

    const channel = args.channel ?? this.activeChannel;
    const state = this.requireComposer(channel);
    const timestamp = now();

    state.lastSentAt = timestamp;
    state.cooldownUntil = timestamp + this.requirePolicy(channel).cooldownMs;
    state.rawText = '';
    state.normalizedText = '';
    state.wordCount = 0;
    state.suppressionReason = 'message_send';

    this.presenceController.noteLocalMessageSent({
      channel,
      messageId: args.messageId,
      ts: timestamp,
    });

    this.stopTyping(channel, args.accepted === false ? 'send_failure' : 'send_success');
    this.setState(channel, 'COOLDOWN', 'message_send');
    this.scheduleCooldownRelease(channel);
    this.emitSnapshot();
  }

  public forceStopAll(reason: ChatTypingStopReason = 'manual_force_stop'): void {
    this.assertNotDestroyed('forceStopAll');

    this.metrics.forcedStopCount += 1;
    for (const channel of CHANNELS) {
      this.stopTyping(channel, reason);
    }
    this.emitSnapshot();
  }

  public handlePresenceStrip(view: ChatPresenceStripView): void {
    this.assertNotDestroyed('handlePresenceStrip');

    const localState = this.requireComposer(view.channel);
    const policy = this.requirePolicy(view.channel);

    if (!policy.allowNpcTheater) return;
    if (!localState.chatOpen || !localState.active) return;
    if (localState.focused && localState.normalizedText.length > 0) return;
    if (view.audienceMood === 'CALM') return;
    if (view.typingCount >= 2) return;

    if (view.channel === 'GLOBAL' && (view.audienceMood === 'SWARMING' || view.audienceMood === 'TENSE')) {
      this.stageTheaterFromMood(view.channel, view.audienceMood, 'NPC');
    }

    if (view.channel === 'DEAL_ROOM' && view.audienceMood === 'PREDATORY') {
      this.stageTheaterFromMood(view.channel, view.audienceMood, 'HATER');
    }

    if (view.channel === 'SYNDICATE' && view.audienceMood === 'INTIMATE') {
      this.stageTheaterFromMood(view.channel, view.audienceMood, 'HELPER');
    }
  }

  public stageNpcTyping(plan: Omit<ChatTypingTheaterPlan, 'id'>): string {
    this.assertNotDestroyed('stageNpcTyping');
    return this.stageTheater(plan);
  }

  public cancelTheater(id: string): void {
    const entry = this.theaterQueue.get(id);
    if (!entry) return;
    if (entry.startTimer) clearTimeout(entry.startTimer);
    if (entry.stopTimer) clearTimeout(entry.stopTimer);
    this.theaterQueue.delete(id);
    this.emitSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Decision surface
  // ---------------------------------------------------------------------------

  public decideStart(
    channel: ChatChannel,
    text: string,
    reason: ChatTypingStartReason,
  ): ChatTypingStartDecision {
    const policy = this.requirePolicy(channel);
    const state = this.requireComposer(channel);
    const normalizedText = normalizeText(text);
    const trimmedLength = normalizedText.length;
    const wordCount = countWords(normalizedText);
    const meaningfulDelta = inferMeaningfulDelta(state.normalizedText, normalizedText);

    if (this.destroyed) {
      return {
        allow: false,
        suppressionReason: 'destroyed',
        channelPolicy: policy,
        metrics: { trimmedLength, wordCount, meaningfulDelta },
      };
    }

    if (!trimmedLength) {
      return {
        allow: false,
        suppressionReason: defaultSuppressionForEmpty(text),
        channelPolicy: policy,
        metrics: { trimmedLength, wordCount, meaningfulDelta },
      };
    }

    if (!isMeaningfulPayload(normalizedText, policy)) {
      return {
        allow: false,
        suppressionReason: 'length_insufficient',
        channelPolicy: policy,
        metrics: { trimmedLength, wordCount, meaningfulDelta },
      };
    }

    if (!state.chatOpen) {
      return {
        allow: false,
        suppressionReason: 'chat_closed',
        channelPolicy: policy,
        metrics: { trimmedLength, wordCount, meaningfulDelta },
      };
    }

    if (shouldRespectWindowHidden(this.config, state.visible)) {
      return {
        allow: false,
        suppressionReason: 'window_hidden',
        channelPolicy: policy,
        metrics: { trimmedLength, wordCount, meaningfulDelta },
      };
    }

    if (shouldRespectWindowBlurred(this.config, state.focused)) {
      return {
        allow: false,
        suppressionReason: state.focused ? 'none' : 'composer_unfocused',
        channelPolicy: policy,
        metrics: { trimmedLength, wordCount, meaningfulDelta },
      };
    }

    if (!state.connected || this.transportState !== 'CONNECTED') {
      return {
        allow: false,
        suppressionReason: 'transport_offline',
        channelPolicy: policy,
        metrics: { trimmedLength, wordCount, meaningfulDelta },
      };
    }

    if (state.cooldownUntil && state.cooldownUntil > now()) {
      return {
        allow: false,
        suppressionReason: 'cooldown',
        channelPolicy: policy,
        metrics: { trimmedLength, wordCount, meaningfulDelta },
      };
    }

    if (this.isDuplicateHashSuppressed(channel, normalizedText, policy)) {
      return {
        allow: false,
        suppressionReason: 'duplicate_buffer',
        channelPolicy: policy,
        metrics: { trimmedLength, wordCount, meaningfulDelta },
      };
    }

    return {
      allow: true,
      reason,
      channelPolicy: policy,
      metrics: { trimmedLength, wordCount, meaningfulDelta },
    };
  }

  public decideRefresh(
    channel: ChatChannel,
    reason: ChatTypingRefreshReason,
  ): ChatTypingRefreshDecision {
    const policy = this.requirePolicy(channel);
    const state = this.requireComposer(channel);
    const timestamp = now();
    const meaningfulDelta = inferMeaningfulDelta(state.rawText, state.normalizedText);
    const elapsedSinceLastRefreshMs = state.lastRefreshAt ? timestamp - state.lastRefreshAt : Number.MAX_SAFE_INTEGER;

    if (this.destroyed) {
      return {
        allow: false,
        suppressionReason: 'destroyed',
        metrics: {
          trimmedLength: state.normalizedText.length,
          wordCount: state.wordCount,
          meaningfulDelta,
          elapsedSinceLastRefreshMs,
        },
      };
    }

    if (!state.normalizedText) {
      return {
        allow: false,
        suppressionReason: 'empty',
        metrics: {
          trimmedLength: 0,
          wordCount: 0,
          meaningfulDelta,
          elapsedSinceLastRefreshMs,
        },
      };
    }

    if (!stateIsTyping(state.state)) {
      return {
        allow: false,
        suppressionReason: 'frozen',
        metrics: {
          trimmedLength: state.normalizedText.length,
          wordCount: state.wordCount,
          meaningfulDelta,
          elapsedSinceLastRefreshMs,
        },
      };
    }

    if (elapsedSinceLastRefreshMs < Math.max(250, policy.refreshPulseMs / 2)) {
      return {
        allow: false,
        suppressionReason: 'rate_shaping',
        nextPulseAt: (state.lastRefreshAt ?? timestamp) + policy.refreshPulseMs,
        metrics: {
          trimmedLength: state.normalizedText.length,
          wordCount: state.wordCount,
          meaningfulDelta,
          elapsedSinceLastRefreshMs,
        },
      };
    }

    return {
      allow: true,
      reason,
      nextPulseAt: timestamp + policy.refreshPulseMs,
      metrics: {
        trimmedLength: state.normalizedText.length,
        wordCount: state.wordCount,
        meaningfulDelta,
        elapsedSinceLastRefreshMs,
      },
    };
  }

  public decideStop(channel: ChatChannel): ChatTypingStopDecision {
    const state = this.requireComposer(channel);
    const policy = this.requirePolicy(channel);
    const timestamp = now();

    if (!stateIsTyping(state.state)) {
      return { shouldStop: false };
    }

    if (!state.normalizedText) {
      return { shouldStop: true, reason: 'input_cleared' };
    }

    if (state.lastEditedAt && timestamp - state.lastEditedAt >= policy.idleStopMs) {
      return { shouldStop: true, reason: 'idle_timeout' };
    }

    if (state.lastStartedAt && timestamp - state.lastStartedAt >= policy.maxContinuousMs) {
      return { shouldStop: true, reason: 'cooldown_timeout' };
    }

    return {
      shouldStop: false,
      nextCheckAt: Math.min(
        (state.lastEditedAt ?? timestamp) + policy.idleStopMs,
        (state.lastStartedAt ?? timestamp) + policy.maxContinuousMs,
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // Private control plane
  // ---------------------------------------------------------------------------

  private createComposerState(channel: ChatChannel): InternalComposerState {
    return {
      channel,
      rawText: '',
      normalizedText: '',
      focused: false,
      visible: true,
      chatOpen: false,
      connected: false,
      active: channel === this.activeChannel,
      state: 'IDLE',
      suppressionReason: 'none',
      wordCount: 0,
      lastEditedAt: null,
      lastMeaningfulEditAt: null,
      lastRefreshAt: null,
      lastStartedAt: null,
      lastStoppedAt: null,
      lastSentAt: null,
      cooldownUntil: null,
      startTimer: null,
      stopTimer: null,
      refreshTimer: null,
      duplicateHashes: [],
      duplicateHashWindow: new Map<string, number>(),
      lastStartHash: undefined,
    };
  }

  private requirePolicy(channel: ChatChannel): ChatTypingChannelPolicy {
    const policy = this.policies.get(channel);
    if (!policy) {
      throw new Error(`Missing typing policy for channel: ${channel}`);
    }
    return policy;
  }

  private requireComposer(channel: ChatChannel): InternalComposerState {
    const state = this.composerByChannel.get(channel);
    if (!state) {
      throw new Error(`Missing composer state for channel: ${channel}`);
    }
    return state;
  }

  private assertNotDestroyed(operation: string): void {
    if (this.destroyed) {
      throw new Error(`ChatTypingController.${operation} called after destroy().`);
    }
  }

  private emitSnapshot(): void {
    this.callbacks.onSnapshotChanged?.(this.getSnapshot());
  }

  private emitControllerError(error: Error, context?: Record<string, unknown>): void {
    this.error?.(error.message, context);
    this.callbacks.onError?.(error, context);
  }

  private setState(
    channel: ChatChannel,
    next: ChatTypingLifecycleState,
    suppressionReason: ChatTypingSuppressionReason,
  ): void {
    const state = this.requireComposer(channel);
    const previous = state.state;
    if (previous === next && state.suppressionReason === suppressionReason) return;

    state.state = next;
    state.suppressionReason = suppressionReason;

    this.callbacks.onTypingStateChanged?.(channel, next, previous, {
      suppressionReason,
      ts: now(),
    });
  }

  private emitStateChangeForAll(
    next: ChatTypingLifecycleState,
    suppressionReason: ChatTypingSuppressionReason,
  ): void {
    for (const channel of CHANNELS) {
      this.setState(channel, next, suppressionReason);
    }
  }

  private clearComposerTimers(state: InternalComposerState): void {
    if (state.startTimer) {
      clearTimeout(state.startTimer);
      state.startTimer = null;
    }
    if (state.stopTimer) {
      clearTimeout(state.stopTimer);
      state.stopTimer = null;
    }
    if (state.refreshTimer) {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }
  }

  private scheduleStart(channel: ChatChannel, decision: ChatTypingStartDecision): void {
    const state = this.requireComposer(channel);
    const policy = decision.channelPolicy;

    if (state.startTimer) clearTimeout(state.startTimer);

    state.startTimer = setTimeout(() => {
      state.startTimer = null;
      this.startTyping(channel, decision);
    }, policy.debounceStartMs);
  }

  private startTyping(channel: ChatChannel, decision: ChatTypingStartDecision): void {
    const state = this.requireComposer(channel);
    if (this.destroyed) return;

    if (!decision.allow || !decision.reason) {
      this.suppress(channel, decision.suppressionReason ?? 'channel_policy');
      return;
    }

    const timestamp = now();
    state.lastStartedAt = timestamp;
    state.lastRefreshAt = timestamp;
    state.lastStartHash = hashText(state.normalizedText);
    this.metrics.localStartCount += 1;
    this.metrics.lastStartedAt = timestamp;

    this.setState(channel, 'STARTING', 'none');
    this.presenceController.beginTyping(channel);
    this.setState(channel, 'TYPING', 'none');
    this.armIdleStop(channel);
    this.armRefreshPulse(channel);

    this.callbacks.onTypingStarted?.(channel, decision, deriveComposerSnapshot(state));
    this.emitSnapshot();
  }

  private evaluateStart(channel: ChatChannel, reason: ChatTypingStartReason): void {
    const state = this.requireComposer(channel);
    const decision = this.decideStart(channel, state.rawText, reason);

    if (!decision.allow) {
      this.suppress(channel, decision.suppressionReason ?? 'channel_policy');
      return;
    }

    if (stateIsTyping(state.state)) {
      this.evaluateRefresh(channel, 'meaningful_delta');
      return;
    }

    this.scheduleStart(channel, decision);
  }

  private evaluateRefresh(channel: ChatChannel, reason: ChatTypingRefreshReason): void {
    const state = this.requireComposer(channel);
    const decision = this.decideRefresh(channel, reason);

    if (!decision.allow) {
      if (decision.suppressionReason === 'rate_shaping') {
        this.scheduleRefreshRetry(channel, decision.nextPulseAt);
        return;
      }
      if (decision.suppressionReason && decision.suppressionReason !== 'frozen') {
        this.suppress(channel, decision.suppressionReason);
      }
      return;
    }

    const timestamp = now();
    state.lastRefreshAt = timestamp;
    this.metrics.localRefreshCount += 1;
    this.presenceController.refreshTyping(channel);
    this.armIdleStop(channel);
    this.armRefreshPulse(channel);

    this.callbacks.onTypingRefreshed?.(channel, decision, deriveComposerSnapshot(state));
    this.emitSnapshot();
  }

  private stopTyping(channel: ChatChannel, reason: ChatTypingStopReason): void {
    const state = this.requireComposer(channel);
    const timestamp = now();

    this.clearComposerTimers(state);

    if (stateIsTyping(state.state) || state.state === 'COOLDOWN' || state.state === 'SUPPRESSED') {
      this.presenceController.stopTypingIfNeeded('manual_override', channel);
    }

    state.lastStoppedAt = timestamp;
    this.metrics.localStopCount += 1;
    this.metrics.lastStoppedAt = timestamp;

    if (reason === 'send_success' || reason === 'send_failure' || reason === 'cooldown_timeout') {
      this.setState(channel, 'COOLDOWN', reason === 'send_success' ? 'message_send' : 'cooldown');
    } else {
      this.setState(channel, 'IDLE', 'none');
    }

    this.callbacks.onTypingStopped?.(channel, reason, deriveComposerSnapshot(state));
    this.emitSnapshot();
  }

  private suppress(channel: ChatChannel, reason: ChatTypingSuppressionReason): void {
    const state = this.requireComposer(channel);
    this.clearComposerTimers(state);

    if (stateIsTyping(state.state)) {
      this.presenceController.stopTypingIfNeeded('manual_override', channel);
    }

    state.suppressionReason = reason;
    this.metrics.localSuppressedCount += 1;
    this.setState(channel, 'SUPPRESSED', reason);

    this.callbacks.onTypingSuppressed?.(channel, reason, deriveComposerSnapshot(state));
    this.emitSnapshot();
  }

  private armIdleStop(channel: ChatChannel): void {
    const state = this.requireComposer(channel);
    const policy = this.requirePolicy(channel);

    if (state.stopTimer) clearTimeout(state.stopTimer);
    state.stopTimer = setTimeout(() => {
      state.stopTimer = null;
      const decision = this.decideStop(channel);
      if (decision.shouldStop && decision.reason) {
        this.stopTyping(channel, decision.reason);
      } else if (decision.nextCheckAt) {
        this.armIdleStop(channel);
      }
    }, policy.idleStopMs);
  }

  private armRefreshPulse(channel: ChatChannel): void {
    const state = this.requireComposer(channel);
    const policy = this.requirePolicy(channel);

    if (state.refreshTimer) clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null;
      const current = this.requireComposer(channel);
      if (!stateIsTyping(current.state)) return;
      if (!current.normalizedText) {
        this.stopTyping(channel, 'input_cleared');
        return;
      }
      this.evaluateRefresh(channel, 'keystroke_keepalive');
    }, policy.refreshPulseMs);
  }

  private scheduleRefreshRetry(channel: ChatChannel, nextPulseAt?: number): void {
    const state = this.requireComposer(channel);
    if (!nextPulseAt) return;

    const delay = clamp(nextPulseAt - now(), 100, 2_000);
    if (state.refreshTimer) clearTimeout(state.refreshTimer);

    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null;
      if (!stateIsTyping(state.state)) return;
      this.evaluateRefresh(channel, 'keystroke_keepalive');
    }, delay);
  }

  private scheduleCooldownRelease(channel: ChatChannel): void {
    const state = this.requireComposer(channel);
    const policy = this.requirePolicy(channel);
    const releaseAt = state.cooldownUntil ?? now() + policy.cooldownMs;
    const delay = clamp(releaseAt - now(), 50, policy.cooldownMs);

    if (state.stopTimer) clearTimeout(state.stopTimer);
    state.stopTimer = setTimeout(() => {
      state.stopTimer = null;
      if (state.cooldownUntil && state.cooldownUntil > now()) {
        this.scheduleCooldownRelease(channel);
        return;
      }

      state.cooldownUntil = null;
      if (state.normalizedText && state.chatOpen && state.focused && state.visible && state.connected) {
        this.setState(channel, 'ARMED', 'none');
        this.evaluateStart(channel, 'input_resumed');
      } else {
        this.setState(channel, 'IDLE', 'none');
        this.emitSnapshot();
      }
    }, delay);
  }

  private checkDuplicateSuppression(
    channel: ChatChannel,
    normalizedText: string,
    policy: ChatTypingChannelPolicy,
  ): boolean {
    const state = this.requireComposer(channel);
    const hash = hashText(normalizedText);
    const timestamp = now();

    for (const [existingHash, ts] of [...state.duplicateHashWindow.entries()]) {
      if (timestamp - ts > policy.duplicateWindowMs) {
        state.duplicateHashWindow.delete(existingHash);
      }
    }

    if (
      state.lastStartHash === hash &&
      state.lastStartedAt &&
      timestamp - state.lastStartedAt <= policy.duplicateWindowMs
    ) {
      this.metrics.duplicateSuppressionCount += 1;
      return true;
    }

    const existing = state.duplicateHashWindow.get(hash);
    if (existing && timestamp - existing <= policy.duplicateWindowMs) {
      this.metrics.duplicateSuppressionCount += 1;
      return true;
    }

    state.duplicateHashWindow.set(hash, timestamp);
    state.duplicateHashes.push(hash);

    const overflow = state.duplicateHashes.length - this.config.maxDuplicateHashesPerChannel;
    if (overflow > 0) {
      const removed = state.duplicateHashes.splice(0, overflow);
      for (const entry of removed) {
        state.duplicateHashWindow.delete(entry);
      }
    }

    return false;
  }

  private isDuplicateHashSuppressed(
    channel: ChatChannel,
    normalizedText: string,
    policy: ChatTypingChannelPolicy,
  ): boolean {
    const state = this.requireComposer(channel);
    const hash = hashText(normalizedText);
    const timestamp = now();

    if (
      state.lastStartHash === hash &&
      state.lastStartedAt &&
      timestamp - state.lastStartedAt <= policy.duplicateWindowMs
    ) {
      return true;
    }

    const existing = state.duplicateHashWindow.get(hash);
    return Boolean(existing && timestamp - existing <= policy.duplicateWindowMs);
  }

  private sweepStaleComposers(): void {
    if (this.destroyed) return;

    const timestamp = now();
    for (const channel of CHANNELS) {
      const state = this.requireComposer(channel);
      if (!state.lastEditedAt) continue;
      if (timestamp - state.lastEditedAt < this.config.staleComposerDestroyAfterMs) continue;

      if (!state.normalizedText) continue;

      this.log?.('Sweeping stale composer.', {
        channel,
        ageMs: timestamp - state.lastEditedAt,
      });

      state.rawText = '';
      state.normalizedText = '';
      state.wordCount = 0;
      state.lastEditedAt = null;
      state.lastMeaningfulEditAt = null;
      if (stateIsTyping(state.state)) {
        this.stopTyping(channel, 'idle_timeout');
      } else {
        this.setState(channel, 'IDLE', 'none');
      }
    }
  }

  private stageTheaterFromMood(
    channel: ChatChannel,
    mood: ChatPresenceAudienceMood,
    actorRole: ChatTypingTheaterActorRole,
  ): void {
    const baseDuration = (() => {
      switch (mood) {
        case 'SWARMING':
          return 2_700;
        case 'TENSE':
          return 2_200;
        case 'PREDATORY':
          return 3_200;
        case 'INTIMATE':
          return 1_600;
        case 'WATCHFUL':
          return 1_300;
        default:
          return 1_100;
      }
    })();

    const weightedDelay = Math.round(250 + this.random() * 900 * archetypeWeight(this.requirePolicy(channel)));
    const plan: Omit<ChatTypingTheaterPlan, 'id'> = {
      actorId: `${actorRole.toLowerCase()}_${channel.toLowerCase()}_${Math.floor(this.random() * 1_000_000)}`,
      actorName: actorRole === 'HATER'
        ? 'THE LIQUIDATOR'
        : actorRole === 'HELPER'
          ? 'Kade'
          : actorRole === 'SYSTEM'
            ? 'SYSTEM'
            : 'Ambient',
      actorRole,
      channel,
      durationMs: baseDuration,
      delayBeforeStartMs: weightedDelay,
      mood,
      metadata: {
        origin: 'presence_strip',
      },
    };

    this.stageTheater(plan);
  }

  private stageTheater(plan: Omit<ChatTypingTheaterPlan, 'id'>): string {
    const id = `theater_${now()}_${Math.floor(this.random() * 1_000_000)}`;
    const fullPlan: ChatTypingTheaterPlan = {
      ...plan,
      id,
    };

    const entry: InternalTheaterQueueEntry = {
      plan: fullPlan,
      startTimer: null,
      stopTimer: null,
    };

    entry.startTimer = setTimeout(() => {
      entry.startTimer = null;
      this.startTheater(id);
    }, clamp(plan.delayBeforeStartMs, 0, 10_000));

    this.theaterQueue.set(id, entry);
    this.callbacks.onTheaterPlanned?.(fullPlan);
    this.emitSnapshot();
    return id;
  }

  private startTheater(id: string): void {
    const entry = this.theaterQueue.get(id);
    if (!entry || this.destroyed) return;

    const timestamp = now();
    entry.plan.startedAt = timestamp;
    entry.plan.expiresAt = timestamp + clamp(entry.plan.durationMs, 350, 10_000);

    this.metrics.npcTheaterCount += 1;
    this.theaterPeak = Math.max(this.theaterPeak, this.theaterQueue.size);
    this.metrics.maxConcurrentTheater = Math.max(
      this.metrics.maxConcurrentTheater,
      this.theaterPeak,
    );

    try {
      this.presenceController.stageNpcTyping({
        channel: entry.plan.channel,
        participantId: entry.plan.actorId,
        displayName: entry.plan.actorName,
        durationMs: entry.plan.durationMs,
        textHint: entry.plan.textHint,
      });
    } catch (error) {
      this.emitControllerError(
        createError('Failed to stage NPC typing theater.', error),
        {
          id,
          channel: entry.plan.channel,
        },
      );
      this.theaterQueue.delete(id);
      return;
    }

    this.callbacks.onTheaterStarted?.(entry.plan);

    entry.stopTimer = setTimeout(() => {
      entry.stopTimer = null;
      this.completeTheater(id);
    }, clamp(entry.plan.durationMs, 350, 10_000));

    this.emitSnapshot();
  }

  private completeTheater(id: string): void {
    const entry = this.theaterQueue.get(id);
    if (!entry) return;

    try {
      this.presenceController.clearNpcPresence({
        channel: entry.plan.channel,
        participantId: entry.plan.actorId,
      });
    } catch (error) {
      this.emitControllerError(
        createError('Failed to clear NPC presence theater.', error),
        {
          id,
          channel: entry.plan.channel,
        },
      );
    }

    this.callbacks.onTheaterCompleted?.(entry.plan);

    if (entry.startTimer) clearTimeout(entry.startTimer);
    if (entry.stopTimer) clearTimeout(entry.stopTimer);
    this.theaterQueue.delete(id);
    this.emitSnapshot();
  }

  private sweepExpiredTheater(): void {
    const timestamp = now();
    for (const [id, entry] of this.theaterQueue.entries()) {
      if (entry.plan.expiresAt && entry.plan.expiresAt <= timestamp) {
        this.completeTheater(id);
      }
    }
  }
}
