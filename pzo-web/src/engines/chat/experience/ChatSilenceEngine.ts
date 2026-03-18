/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT SILENCE ENGINE
 * FILE: pzo-web/src/engines/chat/experience/ChatSilenceEngine.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Centralized silence and read-theater policy for the frontend chat runtime.
 *
 * This file promotes silence from a side-effect into an authored mechanic.
 * It determines when the room should hold, when helper rescue should wait,
 * when the deal room should weaponize delay, when dread should breathe, and
 * when a visible chat reaction should be deferred even though a scene already
 * knows the next speaker.
 *
 * Authority alignment
 * -------------------
 * This module is intentionally shaped around the existing frontend chat lane:
 * - pzo-web/src/engines/chat/types.ts
 * - pzo-web/src/engines/chat/experience/ChatDramaDirector.ts
 *
 * It does not invent a generic scheduler or a generic time-engine abstraction.
 * It speaks in the repo’s own terms:
 * - channels
 * - moments
 * - scene beats
 * - interruption law
 * - rescue windows
 * - audience heat
 * - read receipts
 * - presence theater
 *
 * Design laws
 * -----------
 * - Silence is a beat, not a void.
 * - Different channels deserve different silence.
 * - Deal Room silence is predatory.
 * - Global silence is theatrical.
 * - Syndicate silence is intimate and tactical.
 * - Rescue often lands harder after a short hold than immediately.
 * - Silence is breakable, but only for the right reasons.
 * - Delayed reactions should not feel like dropped logic.
 * ============================================================================
 */

import type {
  ChatActorKind,
  ChatChannelId,
  ChatInterruptionRule,
  ChatMessage,
  ChatMessageId,
  ChatMomentType,
  ChatPresenceSnapshot,
  ChatReadReceipt,
  ChatRevealSchedule,
  ChatSceneBeat,
  ChatSceneBeatType,
  ChatSceneId,
  ChatSilenceDecision,
  ChatTypingSnapshot,
  ChatVisibleChannel,
  GameChatContext,
  JsonObject,
  PressureTier,
  Score100,
  Score01,
  TickTier,
  UnixMs,
} from '../types';
import type {
  ChatDramaDelayedMessage,
  ChatDramaPlan,
  ChatDramaPlanningInput,
} from './ChatDramaDirector';

// ============================================================================
// MARK: Public engine contracts
// ============================================================================

export interface ChatSilenceWindow {
  readonly windowId: string;
  readonly sceneId?: ChatSceneId;
  readonly channelId: ChatChannelId;
  readonly momentType?: ChatMomentType;
  readonly reason: ChatSilenceDecision['reason'];
  readonly opensAt: UnixMs;
  readonly closesAt: UnixMs;
  readonly durationMs: number;
  readonly protectsComposer: boolean;
  readonly protectsCrowd: boolean;
  readonly protectsHelper: boolean;
  readonly protectsDealRoom: boolean;
  readonly breakConditions: readonly string[];
  readonly metadata?: JsonObject;
}

export interface ChatSilenceClock {
  now(): number;
}

export interface ChatReadTheaterPlan {
  readonly enabled: boolean;
  readonly actorId?: string;
  readonly actorKind?: ChatActorKind;
  readonly holdUntil?: UnixMs;
  readonly reason?: ChatSilenceDecision['reason'] | 'NPC_LATENCY';
  readonly createReadReceipt: boolean;
}

export interface ChatSilenceSignal {
  readonly cause:
    | 'SCENE_PLAN'
    | 'READ_THEATER'
    | 'NEGOTIATION_PRESSURE'
    | 'HELPER_RESCUE'
    | 'POST_RUN'
    | 'WORLD_EVENT'
    | 'AUTHORITATIVE_OVERRIDE';
  readonly channelId?: ChatVisibleChannel;
  readonly momentType?: ChatMomentType;
  readonly forceSilence?: boolean;
  readonly allowReadTheater?: boolean;
  readonly helperWillSpeak?: boolean;
  readonly haterWillSpeak?: boolean;
  readonly dealLocked?: boolean;
  readonly playerReplyPending?: boolean;
  readonly actorId?: string;
  readonly actorKind?: ChatActorKind;
  readonly tags?: readonly string[];
  readonly metadata?: JsonObject;
}

export interface ChatSilenceContextSnapshot {
  readonly activeVisibleChannel?: ChatVisibleChannel;
  readonly affect?: {
    readonly intimidation?: Score100;
    readonly confidence?: Score100;
    readonly frustration?: Score100;
    readonly curiosity?: Score100;
    readonly attachment?: Score100;
    readonly socialEmbarrassment?: Score100;
    readonly relief?: Score100;
    readonly dominance?: Score100;
    readonly desperation?: Score100;
    readonly trust?: Score100;
  };
  readonly audienceHeatByChannel?: Partial<
    Record<
      ChatVisibleChannel,
      {
        readonly heat?: Score100;
        readonly hype?: Score100;
        readonly ridicule?: Score100;
        readonly scrutiny?: Score100;
        readonly volatility?: Score100;
      }
    >
  >;
  readonly channelMoodByChannel?: Partial<
    Record<
      ChatVisibleChannel,
      {
        readonly mood?:
          | 'CALM'
          | 'HOSTILE'
          | 'ECSTATIC'
          | 'MOURNFUL'
          | 'PREDATORY'
          | 'SUSPICIOUS'
          | 'INTIMATE';
        readonly updatedAt?: UnixMs;
      }
    >
  >;
  readonly recentMessagesByChannel?: Partial<Record<ChatVisibleChannel, readonly ChatMessage[]>>;
  readonly livePresence?: readonly ChatPresenceSnapshot[];
  readonly liveTyping?: readonly ChatTypingSnapshot[];
  readonly lastReadReceipts?: readonly ChatReadReceipt[];
}

export interface ChatSilenceInput {
  readonly now?: UnixMs;
  readonly signal: ChatSilenceSignal;
  readonly dramaInput?: ChatDramaPlanningInput;
  readonly dramaPlan?: ChatDramaPlan;
  readonly state?: ChatSilenceContextSnapshot;
  readonly context?: GameChatContext;
}

export interface ChatSilenceResolution {
  readonly decision: ChatSilenceDecision;
  readonly window?: ChatSilenceWindow;
  readonly readTheater?: ChatReadTheaterPlan;
  readonly delayedMessages: readonly ChatDramaDelayedMessage[];
  readonly rewrittenImmediateMessages: readonly ChatMessage[];
  readonly insertedBeats: readonly ChatSceneBeat[];
  readonly interruptionRules: readonly ChatInterruptionRule[];
  readonly notes: readonly string[];
}

export interface ChatSilenceState {
  readonly windowsByChannel: ReadonlyMap<ChatChannelId, ChatSilenceWindow>;
  readonly lastResolvedAtByChannel: ReadonlyMap<ChatChannelId, UnixMs>;
}

export interface ChatSilenceEngineOptions {
  readonly clock?: ChatSilenceClock;
}

// ============================================================================
// MARK: Internal constants
// ============================================================================

const DEFAULT_CLOCK: ChatSilenceClock = {
  now: () => Date.now(),
};

const CHANNEL_BASELINE_MS: Readonly<Record<ChatVisibleChannel, number>> = Object.freeze({
  GLOBAL: 780,
  SYNDICATE: 620,
  DEAL_ROOM: 1180,
  LOBBY: 460,
});

const MOMENT_BASELINE_MS: Readonly<Record<ChatMomentType, number>> = Object.freeze({
  RUN_START: 200,
  RUN_END: 1280,
  PRESSURE_SURGE: 980,
  SHIELD_BREACH: 1240,
  CASCADE_TRIGGER: 860,
  CASCADE_BREAK: 680,
  BOT_ATTACK: 540,
  BOT_RETREAT: 320,
  HELPER_RESCUE: 920,
  DEAL_ROOM_STANDOFF: 1480,
  SOVEREIGN_APPROACH: 720,
  SOVEREIGN_ACHIEVED: 420,
  LEGEND_MOMENT: 760,
  WORLD_EVENT: 520,
});

const MAX_SILENCE_MS = 2400;
const MIN_SILENCE_MS = 120;

const SILENCE_BREAK_PRIORITY: Readonly<Record<ChatActorKind, number>> = Object.freeze({
  PLAYER: 4,
  SYSTEM: 7,
  HATER: 3,
  HELPER: 5,
  AMBIENT_NPC: 2,
  CROWD: 1,
  DEAL_AGENT: 6,
  LIVEOPS: 7,
});

const BEAT_INSERTION_PRIORITY: Readonly<Record<ChatSceneBeatType, number>> = Object.freeze({
  SYSTEM_NOTICE: 10,
  HATER_ENTRY: 8,
  CROWD_SWARM: 4,
  HELPER_INTERVENTION: 9,
  PLAYER_REPLY_WINDOW: 7,
  SILENCE: 11,
  REVEAL: 6,
  POST_BEAT_ECHO: 3,
});

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function clampScore100(value: number | Score100 | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const numeric = Number(value);
  if (numeric <= 0) return 0;
  if (numeric >= 100) return 100;
  return Math.round(numeric);
}

function clampScore01(value: number | Score01 | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const numeric = Number(value);
  if (numeric <= 0) return 0;
  if (numeric >= 1) return 1;
  return Number(numeric.toFixed(6));
}

function clampMs(value: number): number {
  if (!Number.isFinite(value)) return MIN_SILENCE_MS;
  if (value <= MIN_SILENCE_MS) return MIN_SILENCE_MS;
  if (value >= MAX_SILENCE_MS) return MAX_SILENCE_MS;
  return Math.round(value);
}

function toUnixMs(value: number): UnixMs {
  return value as UnixMs;
}

function isVisibleChannel(value: ChatChannelId | undefined): value is ChatVisibleChannel {
  return value === 'GLOBAL' || value === 'SYNDICATE' || value === 'DEAL_ROOM' || value === 'LOBBY';
}

function isDealRoom(channelId: ChatChannelId | undefined): channelId is 'DEAL_ROOM' {
  return channelId === 'DEAL_ROOM';
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))];
}

function appendTags(
  base: readonly string[] | undefined,
  added: readonly string[],
): readonly string[] {
  return dedupeStrings([...(base ?? []), ...added]);
}

function sortBeats(beats: readonly ChatSceneBeat[]): readonly ChatSceneBeat[] {
  return [...beats].sort((left, right) => {
    if (left.delayMs !== right.delayMs) return left.delayMs - right.delayMs;
    return BEAT_INSERTION_PRIORITY[right.beatType] - BEAT_INSERTION_PRIORITY[left.beatType];
  });
}

function scorePressureTier(pressureTier: PressureTier | undefined): number {
  switch (pressureTier) {
    case 'CALM':
      return 12;
    case 'WATCHFUL':
      return 28;
    case 'PRESSURED':
      return 56;
    case 'CRITICAL':
      return 78;
    case 'BREAKPOINT':
      return 92;
    default:
      return 0;
  }
}

function scoreTickTier(tickTier: TickTier | undefined): number {
  switch (tickTier) {
    case 'OPENING':
      return 10;
    case 'STABLE':
      return 18;
    case 'BUILDING':
      return 36;
    case 'COMPRESSED':
      return 54;
    case 'CRISIS':
      return 72;
    case 'COLLAPSE_IMMINENT':
      return 90;
    default:
      return 0;
  }
}

// ============================================================================
// MARK: Engine
// ============================================================================

export class ChatSilenceEngine {
  private readonly clock: ChatSilenceClock;
  private state: ChatSilenceState = {
    windowsByChannel: new Map(),
    lastResolvedAtByChannel: new Map(),
  };

  constructor(options: ChatSilenceEngineOptions = {}) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
  }

  getState(): ChatSilenceState {
    return {
      windowsByChannel: new Map(this.state.windowsByChannel),
      lastResolvedAtByChannel: new Map(this.state.lastResolvedAtByChannel),
    };
  }

  reset(): void {
    this.state = {
      windowsByChannel: new Map(),
      lastResolvedAtByChannel: new Map(),
    };
  }

  hasActiveWindow(channelId: ChatChannelId, now?: UnixMs): boolean {
    const active = this.state.windowsByChannel.get(channelId);
    if (!active) return false;
    const referenceNow = Number(now ?? (this.clock.now() as UnixMs));
    return Number(active.closesAt) > referenceNow;
  }

  getActiveWindow(channelId: ChatChannelId, now?: UnixMs): ChatSilenceWindow | undefined {
    const window = this.state.windowsByChannel.get(channelId);
    if (!window) return undefined;
    const referenceNow = Number(now ?? (this.clock.now() as UnixMs));
    if (Number(window.closesAt) <= referenceNow) {
      this.state.windowsByChannel.delete(channelId);
      return undefined;
    }
    return window;
  }

  resolve(input: ChatSilenceInput): ChatSilenceResolution {
    const now = input.now ?? (this.clock.now() as UnixMs);
    const channel = this.resolveChannel(input);
    const momentType = this.resolveMomentType(input);
    const notes: string[] = [];
    const delayedMessages: ChatDramaDelayedMessage[] = [];
    const rewrittenImmediateMessages: ChatMessage[] = [];
    const insertedBeats: ChatSceneBeat[] = [];
    const interruptionRules: ChatInterruptionRule[] = [];
    const activeWindow = this.getActiveWindow(channel, now);

    const profile = this.buildSilenceProfile({
      now,
      channel,
      momentType,
      input,
      activeWindow,
    });

    notes.push(...profile.notes);

    const decision = this.buildDecision(profile);
    const shouldOpenWindow = decision.enforced && decision.durationMs > 0;

    let window: ChatSilenceWindow | undefined;
    if (shouldOpenWindow) {
      window = this.createWindow({
        now,
        channel,
        momentType,
        decision,
        input,
      });
      this.state.windowsByChannel.set(channel, window);
      notes.push(`window-open:${window.windowId}`);
    } else if (activeWindow) {
      this.state.windowsByChannel.delete(channel);
      notes.push(`window-clear:${channel}`);
    }

    const readTheater = this.buildReadTheaterPlan({
      now,
      input,
      decision,
      channel,
      momentType,
      activeWindow: window ?? activeWindow,
    });

    if (input.dramaPlan) {
      const messageRewrite = this.rewriteDramaMessages({
        now,
        plan: input.dramaPlan,
        decision,
        window: window ?? activeWindow,
        readTheater,
      });
      rewrittenImmediateMessages.push(...messageRewrite.rewrittenImmediateMessages);
      delayedMessages.push(...messageRewrite.delayedMessages);
      insertedBeats.push(...messageRewrite.insertedBeats);
      interruptionRules.push(...messageRewrite.interruptionRules);
      notes.push(...messageRewrite.notes);
    }

    this.state.lastResolvedAtByChannel.set(channel, now);

    return {
      decision,
      window,
      readTheater,
      delayedMessages: delayedMessages.sort(
        (left, right) => Number(left.schedule.revealAt) - Number(right.schedule.revealAt),
      ),
      rewrittenImmediateMessages,
      insertedBeats: sortBeats(insertedBeats),
      interruptionRules,
      notes: dedupeStrings(notes),
    };
  }

  mergeWithDramaPlan(input: {
    readonly now?: UnixMs;
    readonly plan: ChatDramaPlan;
    readonly dramaInput?: ChatDramaPlanningInput;
    readonly state?: ChatSilenceContextSnapshot;
    readonly context?: GameChatContext;
    readonly signal?: Partial<ChatSilenceSignal>;
  }): ChatDramaPlan {
    const now = input.now ?? (this.clock.now() as UnixMs);
    const resolution = this.resolve({
      now,
      dramaPlan: input.plan,
      dramaInput: input.dramaInput,
      state: input.state,
      context: input.context,
      signal: {
        cause: input.signal?.cause ?? 'SCENE_PLAN',
        channelId: input.signal?.channelId ?? (isVisibleChannel(input.plan.scene.primaryChannel)
          ? input.plan.scene.primaryChannel
          : undefined),
        momentType: input.signal?.momentType ?? input.plan.scene.momentType,
        forceSilence: input.signal?.forceSilence,
        allowReadTheater: input.signal?.allowReadTheater ?? true,
        helperWillSpeak: input.signal?.helperWillSpeak ?? this.planHasHelper(input.plan),
        haterWillSpeak: input.signal?.haterWillSpeak ?? this.planHasHater(input.plan),
        dealLocked: input.signal?.dealLocked,
        playerReplyPending:
          input.signal?.playerReplyPending ?? this.planHasReplyWindow(input.plan.scene.beats),
        actorId: input.signal?.actorId,
        actorKind: input.signal?.actorKind,
        tags: input.signal?.tags,
        metadata: input.signal?.metadata,
      },
    });

    const baseImmediate =
      resolution.rewrittenImmediateMessages.length > 0
        ? resolution.rewrittenImmediateMessages
        : input.plan.immediateMessages;

    const mergedDelayed = [
      ...input.plan.delayedMessages,
      ...resolution.delayedMessages,
    ].sort((left, right) => Number(left.schedule.revealAt) - Number(right.schedule.revealAt));

    const silence = resolution.decision.enforced ? resolution.decision : input.plan.silence;
    const mergedInterruptionRules = dedupeInterruptionRules([
      ...input.plan.interruptionRules,
      ...resolution.interruptionRules,
    ]);

    const mergedScene: ChatDramaPlan['scene'] =
      resolution.insertedBeats.length === 0
        ? input.plan.scene
        : {
            ...input.plan.scene,
            beats: sortBeats([...input.plan.scene.beats, ...resolution.insertedBeats]),
            expectedDurationMs:
              input.plan.scene.expectedDurationMs +
              resolution.insertedBeats.reduce((sum, beat) => sum + beat.delayMs, 0),
          };

    return {
      ...input.plan,
      scene: mergedScene,
      immediateMessages: baseImmediate,
      delayedMessages: mergedDelayed,
      silence,
      interruptionRules: mergedInterruptionRules,
      notes: dedupeStrings([...input.plan.notes, ...resolution.notes]),
    };
  }

  private resolveChannel(input: ChatSilenceInput): ChatChannelId {
    if (input.signal.channelId) return input.signal.channelId;
    if (input.dramaPlan?.scene.primaryChannel) return input.dramaPlan.scene.primaryChannel;
    if (input.dramaInput?.signal.requestedChannel) return input.dramaInput.signal.requestedChannel;
    if (input.dramaInput?.featureSnapshot?.activeVisibleChannel) {
      return input.dramaInput.featureSnapshot.activeVisibleChannel;
    }
    if (input.dramaInput?.state?.activeVisibleChannel) {
      return input.dramaInput.state.activeVisibleChannel;
    }
    if (input.state?.activeVisibleChannel) {
      return input.state.activeVisibleChannel;
    }
    return 'GLOBAL';
  }

  private resolveMomentType(input: ChatSilenceInput): ChatMomentType | undefined {
    return (
      input.signal.momentType ??
      input.dramaPlan?.scene.momentType ??
      input.dramaInput?.signal.momentType
    );
  }

  private buildSilenceProfile(input: {
    readonly now: UnixMs;
    readonly channel: ChatChannelId;
    readonly momentType?: ChatMomentType;
    readonly input: ChatSilenceInput;
    readonly activeWindow?: ChatSilenceWindow;
  }): {
    readonly enforce: boolean;
    readonly durationMs: number;
    readonly reason: ChatSilenceDecision['reason'];
    readonly breakConditions: readonly string[];
    readonly notes: readonly string[];
    readonly protectCrowd: boolean;
    readonly protectHelper: boolean;
    readonly protectDealRoom: boolean;
    readonly protectComposer: boolean;
  } {
    const notes: string[] = [];
    const channel = input.channel;
    const visibleChannel = isVisibleChannel(channel) ? channel : 'GLOBAL';
    const affect = this.resolveAffect(input.input);
    const pressureTier = this.resolvePressureTier(input.input);
    const tickTier = this.resolveTickTier(input.input);
    const channelHeat = this.channelHeatScore(input.input, visibleChannel);
    const channelMood = this.channelMood(input.input, visibleChannel);
    const baseChannel = CHANNEL_BASELINE_MS[visibleChannel];
    const baseMoment = input.momentType ? MOMENT_BASELINE_MS[input.momentType] : 360;
    const frustration = clampScore100(affect.frustration);
    const embarrassment = clampScore100(affect.socialEmbarrassment);
    const desperation = clampScore100(affect.desperation);
    const intimidation = clampScore100(affect.intimidation);
    const confidence = clampScore100(affect.confidence);
    const trust = clampScore100(affect.trust);
    const pressureScore = scorePressureTier(pressureTier);
    const tickScore = scoreTickTier(tickTier);
    const tags = new Set([
      ...(input.input.signal.tags ?? []),
      ...(input.input.dramaInput?.signal.tags ?? []),
    ]);

    let enforce = Boolean(input.input.signal.forceSilence);
    let reason: ChatSilenceDecision['reason'] = 'NONE';
    let durationMs = baseChannel;
    let protectCrowd = false;
    let protectHelper = false;
    let protectDealRoom = false;
    let protectComposer = false;

    if (input.activeWindow && Number(input.activeWindow.closesAt) > Number(input.now)) {
      notes.push('carry-forward-active-window');
      enforce = true;
      durationMs = Math.max(
        durationMs,
        Number(input.activeWindow.closesAt) - Number(input.now),
      );
      reason = input.activeWindow.reason;
      protectCrowd = input.activeWindow.protectsCrowd;
      protectHelper = input.activeWindow.protectsHelper;
      protectDealRoom = input.activeWindow.protectsDealRoom;
      protectComposer = input.activeWindow.protectsComposer;
    }

    if (isDealRoom(channel)) {
      enforce = true;
      protectDealRoom = true;
      protectCrowd = true;
      protectComposer = true;
      durationMs = Math.max(durationMs, baseMoment);
      notes.push('deal-room-baseline');
      if (input.input.signal.dealLocked) {
        durationMs += 260;
        reason = 'NEGOTIATION_PRESSURE';
        notes.push('deal-locked');
      }
      if (channelMood === 'PREDATORY' || channelHeat.scrutiny >= 60) {
        durationMs += 140;
        reason = 'NEGOTIATION_PRESSURE';
        notes.push('predatory-room');
      }
    }

    if (
      input.momentType === 'SHIELD_BREACH' ||
      input.momentType === 'CASCADE_TRIGGER' ||
      input.momentType === 'PRESSURE_SURGE'
    ) {
      enforce = true;
      protectCrowd = true;
      durationMs = Math.max(durationMs, baseMoment + 180);
      reason = 'DREAD';
      notes.push(`dread-moment:${input.momentType}`);
    }

    if (
      input.momentType === 'HELPER_RESCUE' ||
      input.input.signal.helperWillSpeak ||
      tags.has('helper-rescue')
    ) {
      const helperHold = this.helperRescueHold({
        frustration,
        embarrassment,
        desperation,
        trust,
        confidence,
        visibleChannel,
      });
      if (helperHold.shouldWait) {
        enforce = true;
        protectHelper = true;
        durationMs = Math.max(durationMs, helperHold.durationMs);
        reason = 'RESCUE_WAIT';
        notes.push('helper-rescue-wait');
      }
    }

    if (
      input.input.signal.allowReadTheater &&
      this.shouldUseReadTheater({
        channel: visibleChannel,
        frustration,
        embarrassment,
        desperation,
        pressureScore,
        signal: input.input.signal,
      })
    ) {
      enforce = true;
      durationMs = Math.max(durationMs, this.readTheaterDuration(visibleChannel, pressureScore));
      reason = reason === 'NONE' ? 'READ_THEATER' : reason;
      notes.push('read-theater');
    }

    if (
      embarrassment >= 74 ||
      desperation >= 80 ||
      intimidation >= 72 ||
      pressureScore >= 78 ||
      tickScore >= 72
    ) {
      enforce = true;
      protectCrowd = true;
      protectComposer = true;
      durationMs += 140;
      reason = reason === 'NONE' ? 'SCENE_COMPOSITION' : reason;
      notes.push('emotional-composition');
    }

    if (
      input.momentType === 'RUN_END' ||
      tags.has('post-run') ||
      input.input.signal.cause === 'POST_RUN'
    ) {
      enforce = true;
      protectCrowd = false;
      protectComposer = false;
      durationMs = Math.max(durationMs, baseMoment + 260);
      reason = reason === 'NONE' ? 'SCENE_COMPOSITION' : reason;
      notes.push('post-run-breath');
    }

    if (
      input.momentType === 'WORLD_EVENT' ||
      input.input.signal.cause === 'WORLD_EVENT'
    ) {
      enforce = true;
      protectCrowd = false;
      protectDealRoom = false;
      durationMs = Math.max(durationMs, 420);
      if (reason === 'NONE') {
        reason = 'SCENE_COMPOSITION';
      }
      notes.push('world-event-hold');
    }

    if (
      input.input.signal.playerReplyPending &&
      confidence >= 70 &&
      frustration <= 42 &&
      input.momentType === 'COMEBACK'
    ) {
      durationMs -= 220;
      notes.push('fast-reply-latency');
    }

    if (
      channelHeat.volatility >= 72 &&
      visibleChannel === 'GLOBAL' &&
      input.input.signal.haterWillSpeak
    ) {
      enforce = true;
      protectCrowd = true;
      durationMs += 130;
      reason = reason === 'NONE' ? 'SCENE_COMPOSITION' : reason;
      notes.push('global-theater');
    }

    if (!enforce) {
      reason = 'NONE';
      durationMs = 0;
    } else {
      durationMs = clampMs(durationMs);
      if (reason === 'NONE') {
        reason = 'SCENE_COMPOSITION';
      }
    }

    const breakConditions = dedupeStrings(
      reason === 'NONE'
        ? []
        : [
            'player-reply',
            'authoritative-sync',
            'scene-timeout',
            ...(protectHelper ? ['helper-override'] : []),
            ...(protectDealRoom ? ['deal-counter'] : []),
            ...(input.input.signal.cause === 'WORLD_EVENT' ? ['world-event-fanout'] : []),
          ],
    );

    return {
      enforce,
      durationMs,
      reason,
      breakConditions,
      notes,
      protectCrowd,
      protectHelper,
      protectDealRoom,
      protectComposer,
    };
  }

  private buildDecision(profile: {
    readonly enforce: boolean;
    readonly durationMs: number;
    readonly reason: ChatSilenceDecision['reason'];
    readonly breakConditions: readonly string[];
  }): ChatSilenceDecision {
    return {
      enforced: profile.enforce,
      durationMs: profile.durationMs,
      reason: profile.reason,
      breakConditions: profile.breakConditions,
    };
  }

  private createWindow(input: {
    readonly now: UnixMs;
    readonly channel: ChatChannelId;
    readonly momentType?: ChatMomentType;
    readonly decision: ChatSilenceDecision;
    readonly input: ChatSilenceInput;
  }): ChatSilenceWindow {
    const opensAt = input.now;
    const closesAt = toUnixMs(Number(opensAt) + input.decision.durationMs);
    return {
      windowId: [
        'silence',
        input.channel,
        input.momentType ?? 'NO_MOMENT',
        Number(opensAt),
      ].join(':'),
      sceneId: input.input.dramaPlan?.scene.sceneId,
      channelId: input.channel,
      momentType: input.momentType,
      reason: input.decision.reason,
      opensAt,
      closesAt,
      durationMs: input.decision.durationMs,
      protectsComposer:
        input.decision.reason === 'SCENE_COMPOSITION' ||
        input.decision.reason === 'NEGOTIATION_PRESSURE',
      protectsCrowd:
        input.decision.reason === 'DREAD' ||
        input.decision.reason === 'RESCUE_WAIT' ||
        input.decision.reason === 'NEGOTIATION_PRESSURE',
      protectsHelper: input.decision.reason === 'RESCUE_WAIT',
      protectsDealRoom: isDealRoom(input.channel),
      breakConditions: input.decision.breakConditions,
      metadata: input.input.signal.metadata,
    };
  }

  private buildReadTheaterPlan(input: {
    readonly now: UnixMs;
    readonly input: ChatSilenceInput;
    readonly decision: ChatSilenceDecision;
    readonly channel: ChatChannelId;
    readonly momentType?: ChatMomentType;
    readonly activeWindow?: ChatSilenceWindow;
  }): ChatReadTheaterPlan | undefined {
    if (!input.input.signal.allowReadTheater) {
      return {
        enabled: false,
        createReadReceipt: false,
      };
    }

    if (!input.decision.enforced || input.decision.reason === 'NONE') {
      return {
        enabled: false,
        createReadReceipt: false,
      };
    }

    const actorKind =
      input.input.signal.actorKind ??
      (isDealRoom(input.channel)
        ? 'DEAL_AGENT'
        : input.input.signal.helperWillSpeak
          ? 'HELPER'
          : input.input.signal.haterWillSpeak
            ? 'HATER'
            : 'AMBIENT_NPC');

    const actorId =
      input.input.signal.actorId ??
      (actorKind === 'DEAL_AGENT'
        ? 'deal:room'
        : actorKind === 'HELPER'
          ? 'npc:helper:presence'
          : actorKind === 'HATER'
            ? 'npc:hater:presence'
            : 'npc:ambient:presence');

    const createReadReceipt =
      actorKind === 'DEAL_AGENT' ||
      actorKind === 'HELPER' ||
      actorKind === 'HATER';

    const holdUntil = input.activeWindow?.closesAt;

    return {
      enabled: createReadReceipt,
      actorId,
      actorKind,
      holdUntil,
      reason:
        input.decision.reason === 'NONE' ? 'NPC_LATENCY' : input.decision.reason,
      createReadReceipt,
    };
  }

  private rewriteDramaMessages(input: {
    readonly now: UnixMs;
    readonly plan: ChatDramaPlan;
    readonly decision: ChatSilenceDecision;
    readonly window?: ChatSilenceWindow;
    readonly readTheater?: ChatReadTheaterPlan;
  }): {
    readonly delayedMessages: readonly ChatDramaDelayedMessage[];
    readonly rewrittenImmediateMessages: readonly ChatMessage[];
    readonly insertedBeats: readonly ChatSceneBeat[];
    readonly interruptionRules: readonly ChatInterruptionRule[];
    readonly notes: readonly string[];
  } {
    const delayedMessages: ChatDramaDelayedMessage[] = [];
    const rewrittenImmediateMessages: ChatMessage[] = [];
    const insertedBeats: ChatSceneBeat[] = [];
    const interruptionRules: ChatInterruptionRule[] = [];
    const notes: string[] = [];

    if (!input.decision.enforced || input.decision.durationMs <= 0) {
      return {
        delayedMessages,
        rewrittenImmediateMessages: input.plan.immediateMessages,
        insertedBeats,
        interruptionRules,
        notes,
      };
    }

    const holdMs = input.decision.durationMs;
    const revealAtBase = Number(input.now) + holdMs;

    rewrittenImmediateMessages.push(
      ...input.plan.immediateMessages.filter(
        (message) => !this.shouldDelayMessage(message, input.window),
      ),
    );

    const delayedFromImmediate = input.plan.immediateMessages
      .filter((message) => this.shouldDelayMessage(message, input.window))
      .map((message, index) => ({
        schedule: {
          revealAt: toUnixMs(revealAtBase + index * 120),
          revealChannel: message.channel,
          revealReason: this.revealReasonForMessage(message),
          payloadRef: message.id,
        } satisfies ChatRevealSchedule,
        message: {
          ...message,
          tags: appendTags(message.tags, [
            'silence-delayed',
            `silence-reason:${input.decision.reason}`,
          ]),
        },
      }));

    delayedMessages.push(...delayedFromImmediate);
    if (delayedFromImmediate.length > 0) {
      notes.push(`delayed-immediate:${delayedFromImmediate.length}`);
    }

    if (input.window) {
      insertedBeats.push({
        beatType: 'SILENCE',
        delayMs: 0,
        requiredChannel: input.window.channelId,
        skippable: false,
        canInterrupt: true,
        payloadHint: input.window.reason,
      });

      insertedBeats.push({
        beatType: 'REVEAL',
        delayMs: input.window.durationMs,
        requiredChannel: input.window.channelId,
        skippable: true,
        canInterrupt: true,
        payloadHint: 'silence-release',
      });

      notes.push('inserted-silence-beats');
    }

    if (input.window?.protectsCrowd) {
      interruptionRules.push({
        interrupterActorKind: 'CROWD',
        priority: 'LOW',
        canBreakSilence: false,
        canPreemptCrowd: false,
        canPreemptHelper: false,
        canPreemptDealRoom: false,
      });
    }

    if (input.window?.protectsHelper) {
      interruptionRules.push({
        interrupterActorKind: 'HELPER',
        priority: 'HIGH',
        canBreakSilence: true,
        canPreemptCrowd: true,
        canPreemptHelper: false,
        canPreemptDealRoom: false,
      });
    }

    if (input.window?.protectsDealRoom) {
      interruptionRules.push({
        interrupterActorKind: 'DEAL_AGENT',
        priority: 'ABSOLUTE',
        canBreakSilence: true,
        canPreemptCrowd: true,
        canPreemptHelper: false,
        canPreemptDealRoom: true,
      });
    }

    if (input.readTheater?.enabled && input.readTheater.createReadReceipt) {
      notes.push(`read-theater:${input.readTheater.actorKind ?? 'UNKNOWN'}`);
    }

    return {
      delayedMessages,
      rewrittenImmediateMessages,
      insertedBeats,
      interruptionRules,
      notes,
    };
  }

  private shouldDelayMessage(
    message: ChatMessage,
    window?: ChatSilenceWindow,
  ): boolean {
    if (!window) return false;

    if (message.kind === 'SYSTEM' || message.kind === 'WORLD_EVENT') {
      return false;
    }

    if (window.protectsDealRoom && message.kind === 'NEGOTIATION_COUNTER') {
      return false;
    }

    if (window.protectsHelper && message.kind === 'HELPER_RESCUE') {
      return true;
    }

    if (window.protectsCrowd && message.kind === 'CROWD_REACTION') {
      return true;
    }

    if (window.reason === 'DREAD' && (message.kind === 'HATER_TELEGRAPH' || message.kind === 'HATER_PUNISH')) {
      return true;
    }

    if (window.reason === 'READ_THEATER' && message.kind === 'HELPER_PROMPT') {
      return true;
    }

    return false;
  }

  private revealReasonForMessage(message: ChatMessage): ChatRevealSchedule['revealReason'] {
    switch (message.kind) {
      case 'HATER_TELEGRAPH':
      case 'HATER_PUNISH':
        return 'DELAYED_HATER';
      case 'HELPER_PROMPT':
      case 'HELPER_RESCUE':
        return 'DELAYED_HELPER';
      case 'WORLD_EVENT':
        return 'WORLD_EVENT';
      default:
        return 'SCENE_STAGING';
    }
  }

  private helperRescueHold(input: {
    readonly frustration: number;
    readonly embarrassment: number;
    readonly desperation: number;
    readonly trust: number;
    readonly confidence: number;
    readonly visibleChannel: ChatVisibleChannel;
  }): {
    readonly shouldWait: boolean;
    readonly durationMs: number;
  } {
    const publicPressureBonus =
      input.visibleChannel === 'GLOBAL' ? 160 : input.visibleChannel === 'SYNDICATE' ? 80 : 40;

    const shameHeavy =
      input.embarrassment >= 70 ||
      (input.frustration >= 74 && input.confidence <= 42) ||
      input.desperation >= 82;

    if (!shameHeavy) {
      return {
        shouldWait: false,
        durationMs: 0,
      };
    }

    const trustDiscount = input.trust >= 66 ? 140 : input.trust <= 24 ? 0 : 60;

    return {
      shouldWait: true,
      durationMs: clampMs(
        920 +
          publicPressureBonus +
          Math.max(0, input.desperation - 70) * 4 -
          trustDiscount,
      ),
    };
  }

  private shouldUseReadTheater(input: {
    readonly channel: ChatVisibleChannel;
    readonly frustration: number;
    readonly embarrassment: number;
    readonly desperation: number;
    readonly pressureScore: number;
    readonly signal: ChatSilenceSignal;
  }): boolean {
    if (input.signal.forceSilence) return true;
    if (input.signal.cause === 'NEGOTIATION_PRESSURE') return true;
    if (input.channel === 'DEAL_ROOM') return true;
    if (input.embarrassment >= 76) return true;
    if (input.pressureScore >= 78 && input.signal.haterWillSpeak) return true;
    if (input.frustration >= 68 && input.desperation >= 72 && input.signal.helperWillSpeak) {
      return true;
    }
    return false;
  }

  private readTheaterDuration(channel: ChatVisibleChannel, pressureScore: number): number {
    const baseline = channel === 'DEAL_ROOM' ? 980 : channel === 'GLOBAL' ? 760 : 620;
    return clampMs(baseline + Math.round(pressureScore * 1.8));
  }

  private resolveAffect(input: ChatSilenceInput): NonNullable<ChatSilenceContextSnapshot['affect']> {
    return (
      input.state?.affect ??
      input.dramaInput?.state?.affect ??
      {
        intimidation: 0 as Score100,
        confidence: 0 as Score100,
        frustration: 0 as Score100,
        curiosity: 0 as Score100,
        attachment: 0 as Score100,
        socialEmbarrassment: 0 as Score100,
        relief: 0 as Score100,
        dominance: 0 as Score100,
        desperation: 0 as Score100,
        trust: 0 as Score100,
      }
    );
  }

  private resolvePressureTier(input: ChatSilenceInput): PressureTier | undefined {
    return (
      input.context?.pressureTier ??
      input.dramaInput?.context?.pressureTier ??
      input.dramaPlan?.immediateMessages.find((message) => message.pressureTier)?.pressureTier
    );
  }

  private resolveTickTier(input: ChatSilenceInput): TickTier | undefined {
    return (
      input.context?.tickTier ??
      input.dramaInput?.context?.tickTier ??
      input.dramaPlan?.immediateMessages.find((message) => message.tickTier)?.tickTier
    );
  }

  private channelHeatScore(
    input: ChatSilenceInput,
    channel: ChatVisibleChannel,
  ): {
    readonly heat: number;
    readonly hype: number;
    readonly ridicule: number;
    readonly scrutiny: number;
    readonly volatility: number;
  } {
    const snapshot =
      input.state?.audienceHeatByChannel?.[channel] ??
      input.dramaInput?.state?.audienceHeat?.[channel];

    return {
      heat: clampScore100((snapshot as any)?.heat),
      hype: clampScore100((snapshot as any)?.hype),
      ridicule: clampScore100((snapshot as any)?.ridicule),
      scrutiny: clampScore100((snapshot as any)?.scrutiny),
      volatility: clampScore100((snapshot as any)?.volatility),
    };
  }

  private channelMood(
    input: ChatSilenceInput,
    channel: ChatVisibleChannel,
  ):
    | 'CALM'
    | 'HOSTILE'
    | 'ECSTATIC'
    | 'MOURNFUL'
    | 'PREDATORY'
    | 'SUSPICIOUS'
    | 'INTIMATE'
    | undefined {
    const stateMood =
      input.state?.channelMoodByChannel?.[channel]?.mood ??
      (input.dramaInput?.state?.channelMoodByChannel as any)?.[channel]?.mood;
    return stateMood as any;
  }

  private planHasHelper(plan: ChatDramaPlan): boolean {
    return plan.immediateMessages.some(
      (message) => message.kind === 'HELPER_PROMPT' || message.kind === 'HELPER_RESCUE',
    );
  }

  private planHasHater(plan: ChatDramaPlan): boolean {
    return plan.immediateMessages.some(
      (message) => message.kind === 'HATER_TELEGRAPH' || message.kind === 'HATER_PUNISH',
    );
  }

  private planHasReplyWindow(beats: readonly ChatSceneBeat[]): boolean {
    return beats.some((beat) => beat.beatType === 'PLAYER_REPLY_WINDOW');
  }
}

// ============================================================================
// MARK: Rule merge helpers
// ============================================================================

function dedupeInterruptionRules(
  rules: readonly ChatInterruptionRule[],
): readonly ChatInterruptionRule[] {
  const byKey = new Map<string, ChatInterruptionRule>();

  for (const rule of rules) {
    const key = rule.interrupterActorKind;
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, rule);
      continue;
    }

    byKey.set(key, {
      interrupterActorKind: rule.interrupterActorKind,
      priority:
        compareInterruptPriority(rule.priority, previous.priority) >= 0
          ? rule.priority
          : previous.priority,
      canBreakSilence: rule.canBreakSilence || previous.canBreakSilence,
      canPreemptCrowd: rule.canPreemptCrowd || previous.canPreemptCrowd,
      canPreemptHelper: rule.canPreemptHelper || previous.canPreemptHelper,
      canPreemptDealRoom: rule.canPreemptDealRoom || previous.canPreemptDealRoom,
    });
  }

  return [...byKey.values()].sort((left, right) => {
    const leftScore = scoreInterruptionRule(left);
    const rightScore = scoreInterruptionRule(right);
    return rightScore - leftScore;
  });
}

function compareInterruptPriority(
  left: ChatInterruptionRule['priority'],
  right: ChatInterruptionRule['priority'],
): number {
  const rank = {
    LOW: 1,
    NORMAL: 2,
    HIGH: 3,
    CRITICAL: 4,
    ABSOLUTE: 5,
  } as const;
  return rank[left] - rank[right];
}

function scoreInterruptionRule(rule: ChatInterruptionRule): number {
  return (
    compareInterruptPriority(rule.priority, 'LOW') * 100 +
    (rule.canBreakSilence ? 25 : 0) +
    (rule.canPreemptCrowd ? 15 : 0) +
    (rule.canPreemptHelper ? 10 : 0) +
    (rule.canPreemptDealRoom ? 20 : 0) +
    (SILENCE_BREAK_PRIORITY[rule.interrupterActorKind] ?? 0)
  );
}

// ============================================================================
// MARK: Factory
// ============================================================================

export function createChatSilenceEngine(
  options?: ChatSilenceEngineOptions,
): ChatSilenceEngine {
  return new ChatSilenceEngine(options);
}
