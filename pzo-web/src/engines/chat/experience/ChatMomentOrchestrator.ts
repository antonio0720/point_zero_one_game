/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT MOMENT ORCHESTRATOR
 * FILE: pzo-web/src/engines/chat/experience/ChatMomentOrchestrator.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend moment pipeline that turns a game/chat signal into a
 * complete, scene-aware, silence-aware runtime package for the UI/engine lane.
 *
 * This module sits directly above ChatDramaDirector and ChatSilenceEngine.
 * It is not a replacement for either one:
 *
 * - ChatDramaDirector decides the dramatic composition of a moment.
 * - ChatSilenceEngine decides whether the room should hold before revealing.
 * - ChatMomentOrchestrator coordinates both, applies queue law, merges
 *   delayed reveals, handles moment dedupe/cooldown, and emits one coherent
 *   runtime package for the consuming engine/store shell.
 *
 * Why this file matters
 * ---------------------
 * The repo’s frontend chat plan already calls out dramaturgy modules like:
 * - experience/ChatDramaDirector.ts
 * - experience/ChatMomentOrchestrator.ts
 * - experience/ChatSilenceEngine.ts
 * - experience/ChatInterruptPriority.ts
 * - experience/ChatRevealScheduler.ts
 *
 * That means the right next move is not another helper. It is a first-class
 * orchestrator that keeps scene, silence, reveal, crowd heat, rescue timing,
 * and reply windows inside one deterministic planning envelope.
 *
 * Design laws
 * -----------
 * - Every major moment should have one canonical orchestrated answer.
 * - Duplicate events should not create spammed theatrical scenes.
 * - More than one valid speaker may exist, but only one sequence should own
 *   the room at a time.
 * - Scene planning should remain stable under rapid mode/event churn.
 * - The orchestrator may merge and suppress; it must never flatten the engine’s
 *   dramatic intent into generic chat output.
 * ============================================================================
 */

import type {
  BotId,
} from '../../battle/types';
import type {
  ChatActorKind,
  ChatChannelId,
  ChatInterruptionRule,
  ChatMessage,
  ChatMessageId,
  ChatMomentId,
  ChatMomentType,
  ChatRelationshipState,
  ChatRevealSchedule,
  ChatSceneId,
  ChatVisibleChannel,
  GameChatContext,
  JsonObject,
  PressureTier,
  Score100,
  TickTier,
  UnixMs,
} from '../types';
import {
  CHAT_MOMENT_TYPES,
} from '../types';
import {
  ChatDramaDirector,
  createChatDramaDirector,
  type ChatDramaDelayedMessage,
  type ChatDramaMomentSignal,
  type ChatDramaPlan,
  type ChatDramaPlanningInput,
} from './ChatDramaDirector';
import {
  ChatSilenceEngine,
  createChatSilenceEngine,
  type ChatSilenceContextSnapshot,
  type ChatSilenceSignal,
  type ChatSilenceWindow,
} from './ChatSilenceEngine';

// ============================================================================
// MARK: Public orchestrator contracts
// ============================================================================

export type ChatMomentSource =
  | 'ENGINE_EVENT'
  | 'PLAYER_MESSAGE'
  | 'BOT_ATTACK'
  | 'HELPER_TRIGGER'
  | 'SYSTEM_WORLD_EVENT'
  | 'POST_RUN'
  | 'DEAL_ROOM'
  | 'RECOVERY'
  | 'REPLAY';

export interface ChatMomentEnvelope {
  readonly envelopeId: string;
  readonly source: ChatMomentSource;
  readonly emittedAt: UnixMs;
  readonly signal: ChatDramaMomentSignal;
  readonly context?: GameChatContext;
  readonly featureSnapshot?: ChatDramaPlanningInput['featureSnapshot'];
  readonly learningProfile?: ChatDramaPlanningInput['learningProfile'];
  readonly state?: ChatDramaPlanningInput['state'];
  readonly relationships?: readonly ChatRelationshipState[];
  readonly metadata?: JsonObject;
}

export interface ChatMomentQueueEntry {
  readonly queueId: string;
  readonly momentType?: ChatMomentType;
  readonly channelId: ChatVisibleChannel;
  readonly source: ChatMomentSource;
  readonly enqueuedAt: UnixMs;
  readonly priority: number;
  readonly signature: string;
  readonly envelope: ChatMomentEnvelope;
}

export interface ChatMomentCooldownEntry {
  readonly signature: string;
  readonly lastPlannedAt: UnixMs;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly count: number;
}

export interface ChatRevealEntry {
  readonly revealId: string;
  readonly schedule: ChatRevealSchedule;
  readonly message: ChatMessage;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly sourceEnvelopeId: string;
}

export interface ChatMomentRuntimePackage {
  readonly sceneId: ChatSceneId;
  readonly momentId: ChatMomentId;
  readonly momentType: ChatMomentType;
  readonly channelId: ChatVisibleChannel;
  readonly source: ChatMomentSource;
  readonly immediateMessages: readonly ChatMessage[];
  readonly delayedMessages: readonly ChatDramaDelayedMessage[];
  readonly revealEntries: readonly ChatRevealEntry[];
  readonly interruptionRules: readonly ChatInterruptionRule[];
  readonly silenceWindow?: ChatSilenceWindow;
  readonly notes: readonly string[];
  readonly queueSignature: string;
  readonly dominantBotId?: BotId;
  readonly helperPersonaId?: string;
  readonly emittedAt: UnixMs;
}

export interface ChatMomentOrchestratorSnapshot {
  readonly queue: readonly ChatMomentQueueEntry[];
  readonly reveals: readonly ChatRevealEntry[];
  readonly cooldowns: readonly ChatMomentCooldownEntry[];
  readonly activeSceneByChannel: Readonly<Record<ChatVisibleChannel, ChatSceneId | undefined>>;
  readonly activeSilenceByChannel: Readonly<Record<ChatVisibleChannel, ChatSilenceWindow | undefined>>;
}

export interface ChatMomentOrchestratorOptions {
  readonly dramaDirector?: ChatDramaDirector;
  readonly silenceEngine?: ChatSilenceEngine;
  readonly clock?: {
    now(): number;
  };
  readonly cooldownMs?: number;
  readonly sameChannelSuppressionMs?: number;
}

export interface ChatMomentBatchPlanningInput {
  readonly envelopes: readonly ChatMomentEnvelope[];
  readonly sharedState?: ChatDramaPlanningInput['state'];
  readonly sharedRelationships?: readonly ChatRelationshipState[];
  readonly sharedContext?: GameChatContext;
  readonly silenceState?: ChatSilenceContextSnapshot;
}

// ============================================================================
// MARK: Internal defaults
// ============================================================================

const DEFAULT_CLOCK = {
  now: () => Date.now(),
};

const DEFAULT_COOLDOWN_MS = 1450;
const DEFAULT_SAME_CHANNEL_SUPPRESSION_MS = 520;

const MOMENT_PRIORITY_MAP: Readonly<Record<ChatMomentType, number>> = Object.freeze({
  RUN_START: 18,
  RUN_END: 34,
  PRESSURE_SURGE: 54,
  SHIELD_BREACH: 68,
  CASCADE_TRIGGER: 61,
  CASCADE_BREAK: 44,
  BOT_ATTACK: 57,
  BOT_RETREAT: 28,
  HELPER_RESCUE: 72,
  DEAL_ROOM_STANDOFF: 77,
  SOVEREIGN_APPROACH: 63,
  SOVEREIGN_ACHIEVED: 82,
  LEGEND_MOMENT: 88,
  WORLD_EVENT: 80,
});

const SOURCE_PRIORITY_BONUS: Readonly<Record<ChatMomentSource, number>> = Object.freeze({
  ENGINE_EVENT: 14,
  PLAYER_MESSAGE: 8,
  BOT_ATTACK: 16,
  HELPER_TRIGGER: 18,
  SYSTEM_WORLD_EVENT: 26,
  POST_RUN: 20,
  DEAL_ROOM: 24,
  RECOVERY: 17,
  REPLAY: 6,
});

// ============================================================================
// MARK: Utility helpers
// ============================================================================

function toUnixMs(value: number): UnixMs {
  return value as UnixMs;
}

function isVisibleChannel(value: ChatChannelId | undefined): value is ChatVisibleChannel {
  return value === 'GLOBAL' || value === 'SYNDICATE' || value === 'DEAL_ROOM' || value === 'LOBBY';
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter(Boolean))];
}

function clampScore100(value: number | Score100 | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return 0;
  const numeric = Number(value);
  if (numeric <= 0) return 0;
  if (numeric >= 100) return 100;
  return Math.round(numeric);
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (v !== undefined) {
      out[key] = v;
    }
  }
  return out as T;
}

// ============================================================================
// MARK: Orchestrator
// ============================================================================

export class ChatMomentOrchestrator {
  private readonly dramaDirector: ChatDramaDirector;
  private readonly silenceEngine: ChatSilenceEngine;
  private readonly clock: { now(): number };
  private readonly cooldownMs: number;
  private readonly sameChannelSuppressionMs: number;

  private readonly queue: ChatMomentQueueEntry[] = [];
  private readonly revealQueue: ChatRevealEntry[] = [];
  private readonly cooldowns = new Map<string, ChatMomentCooldownEntry>();
  private readonly activeSceneByChannel = new Map<ChatVisibleChannel, ChatSceneId>();
  private readonly activeSilenceByChannel = new Map<ChatVisibleChannel, ChatSilenceWindow>();
  private readonly lastEventAtByChannel = new Map<ChatVisibleChannel, UnixMs>();

  constructor(options: ChatMomentOrchestratorOptions = {}) {
    this.dramaDirector = options.dramaDirector ?? createChatDramaDirector();
    this.silenceEngine = options.silenceEngine ?? createChatSilenceEngine();
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.sameChannelSuppressionMs =
      options.sameChannelSuppressionMs ?? DEFAULT_SAME_CHANNEL_SUPPRESSION_MS;
  }

  reset(): void {
    this.queue.length = 0;
    this.revealQueue.length = 0;
    this.cooldowns.clear();
    this.activeSceneByChannel.clear();
    this.activeSilenceByChannel.clear();
    this.lastEventAtByChannel.clear();
    this.silenceEngine.reset();
  }

  snapshot(now?: UnixMs): ChatMomentOrchestratorSnapshot {
    const referenceNow = Number(now ?? (this.clock.now() as UnixMs));
    this.garbageCollect(referenceNow);

    return {
      queue: [...this.queue],
      reveals: [...this.revealQueue],
      cooldowns: [...this.cooldowns.values()],
      activeSceneByChannel: {
        GLOBAL: this.activeSceneByChannel.get('GLOBAL'),
        SYNDICATE: this.activeSceneByChannel.get('SYNDICATE'),
        DEAL_ROOM: this.activeSceneByChannel.get('DEAL_ROOM'),
        LOBBY: this.activeSceneByChannel.get('LOBBY'),
      },
      activeSilenceByChannel: {
        GLOBAL: this.activeSilenceByChannel.get('GLOBAL'),
        SYNDICATE: this.activeSilenceByChannel.get('SYNDICATE'),
        DEAL_ROOM: this.activeSilenceByChannel.get('DEAL_ROOM'),
        LOBBY: this.activeSilenceByChannel.get('LOBBY'),
      },
    };
  }

  enqueue(envelope: ChatMomentEnvelope): ChatMomentQueueEntry | undefined {
    const now = envelope.emittedAt;
    const momentType = this.resolveMomentType(envelope);
    const channelId = this.resolveChannel(envelope);
    const signature = this.signatureFor(envelope, momentType, channelId);

    if (this.shouldSuppress({
      now,
      signature,
      channelId,
      momentType,
    })) {
      return undefined;
    }

    const entry: ChatMomentQueueEntry = {
      queueId: `moment-queue:${channelId}:${Number(now)}:${this.queue.length + 1}`,
      momentType,
      channelId,
      source: envelope.source,
      enqueuedAt: now,
      priority: this.computePriority(envelope, momentType, channelId),
      signature,
      envelope,
    };

    this.queue.push(entry);
    this.sortQueue();
    return entry;
  }

  planNext(input?: {
    readonly sharedState?: ChatDramaPlanningInput['state'];
    readonly sharedRelationships?: readonly ChatRelationshipState[];
    readonly sharedContext?: GameChatContext;
    readonly silenceState?: ChatSilenceContextSnapshot;
  }): ChatMomentRuntimePackage | undefined {
    this.garbageCollect(Number(this.clock.now()));
    const entry = this.queue.shift();
    if (!entry) return undefined;
    return this.planEntry(entry, input);
  }

  planEnvelope(
    envelope: ChatMomentEnvelope,
    input?: {
      readonly sharedState?: ChatDramaPlanningInput['state'];
      readonly sharedRelationships?: readonly ChatRelationshipState[];
      readonly sharedContext?: GameChatContext;
      readonly silenceState?: ChatSilenceContextSnapshot;
    },
  ): ChatMomentRuntimePackage | undefined {
    const entry = this.enqueue(envelope);
    if (!entry) return undefined;

    const index = this.queue.findIndex((queued) => queued.queueId === entry.queueId);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
    return this.planEntry(entry, input);
  }

  planBatch(input: ChatMomentBatchPlanningInput): readonly ChatMomentRuntimePackage[] {
    const outputs: ChatMomentRuntimePackage[] = [];

    for (const envelope of input.envelopes) {
      const planned = this.planEnvelope(envelope, {
        sharedState: input.sharedState,
        sharedRelationships: input.sharedRelationships,
        sharedContext: input.sharedContext,
        silenceState: input.silenceState,
      });
      if (planned) {
        outputs.push(planned);
      }
    }

    return outputs;
  }

  flushReveals(now?: UnixMs): readonly ChatRevealEntry[] {
    const referenceNow = Number(now ?? (this.clock.now() as UnixMs));
    const due = this.revealQueue.filter(
      (entry) => Number(entry.schedule.revealAt) <= referenceNow,
    );
    const pending = this.revealQueue.filter(
      (entry) => Number(entry.schedule.revealAt) > referenceNow,
    );

    this.revealQueue.length = 0;
    this.revealQueue.push(...pending);

    return due.sort(
      (left, right) => Number(left.schedule.revealAt) - Number(right.schedule.revealAt),
    );
  }

  private planEntry(
    entry: ChatMomentQueueEntry,
    input?: {
      readonly sharedState?: ChatDramaPlanningInput['state'];
      readonly sharedRelationships?: readonly ChatRelationshipState[];
      readonly sharedContext?: GameChatContext;
      readonly silenceState?: ChatSilenceContextSnapshot;
    },
  ): ChatMomentRuntimePackage {
    const envelope = entry.envelope;
    const planningInput = this.toDramaPlanningInput(entry, input);
    const planned = this.dramaDirector.plan(planningInput);

    const silenceMerged = this.silenceEngine.mergeWithDramaPlan({
      now: envelope.emittedAt,
      plan: planned,
      dramaInput: planningInput,
      state: input?.silenceState,
      context: planningInput.context,
      signal: this.toSilenceSignal(entry, planned),
    });

    const revealEntries = this.toRevealEntries({
      sourceEnvelopeId: envelope.envelopeId,
      sceneId: silenceMerged.scene.sceneId,
      momentId: silenceMerged.scene.momentId,
      delayedMessages: silenceMerged.delayedMessages,
    });

    this.revealQueue.push(...revealEntries);
    this.sortRevealQueue();

    const silenceWindow = this.silenceEngine.getActiveWindow(
      entry.channelId,
      envelope.emittedAt,
    );
    if (silenceWindow) {
      this.activeSilenceByChannel.set(entry.channelId, silenceWindow);
    } else {
      this.activeSilenceByChannel.delete(entry.channelId);
    }

    this.activeSceneByChannel.set(entry.channelId, silenceMerged.scene.sceneId);
    this.lastEventAtByChannel.set(entry.channelId, envelope.emittedAt);
    this.bumpCooldown(entry, silenceMerged);

    return {
      sceneId: silenceMerged.scene.sceneId,
      momentId: silenceMerged.scene.momentId,
      momentType: silenceMerged.scene.momentType,
      channelId: entry.channelId,
      source: entry.source,
      immediateMessages: silenceMerged.immediateMessages,
      delayedMessages: silenceMerged.delayedMessages,
      revealEntries,
      interruptionRules: silenceMerged.interruptionRules,
      silenceWindow,
      notes: dedupeStrings([
        ...silenceMerged.notes,
        `queue-priority:${entry.priority}`,
        `source:${entry.source}`,
      ]),
      queueSignature: entry.signature,
      dominantBotId: silenceMerged.dominantBotId,
      helperPersonaId: silenceMerged.selectedHelperPersonaId,
      emittedAt: envelope.emittedAt,
    };
  }

  private toDramaPlanningInput(
    entry: ChatMomentQueueEntry,
    input?: {
      readonly sharedState?: ChatDramaPlanningInput['state'];
      readonly sharedRelationships?: readonly ChatRelationshipState[];
      readonly sharedContext?: GameChatContext;
    },
  ): ChatDramaPlanningInput {
    const envelope = entry.envelope;
    return {
      state: envelope.state ?? input?.sharedState,
      context: envelope.context ?? input?.sharedContext,
      featureSnapshot: envelope.featureSnapshot,
      learningProfile: envelope.learningProfile,
      relationships: envelope.relationships ?? input?.sharedRelationships,
      signal: {
        ...envelope.signal,
        requestedChannel: envelope.signal.requestedChannel ?? entry.channelId,
        momentType: envelope.signal.momentType ?? entry.momentType,
        tags: dedupeStrings([
          ...(envelope.signal.tags ?? []),
          `source:${entry.source.toLowerCase()}`,
        ]),
      },
      now: envelope.emittedAt,
    };
  }

  private toSilenceSignal(
    entry: ChatMomentQueueEntry,
    planned: ChatDramaPlan,
  ): Partial<ChatSilenceSignal> {
    return {
      cause:
        entry.source === 'DEAL_ROOM'
          ? 'NEGOTIATION_PRESSURE'
          : entry.source === 'HELPER_TRIGGER'
            ? 'HELPER_RESCUE'
            : entry.source === 'POST_RUN'
              ? 'POST_RUN'
              : entry.source === 'SYSTEM_WORLD_EVENT'
                ? 'WORLD_EVENT'
                : 'SCENE_PLAN',
      channelId: entry.channelId,
      momentType: planned.scene.momentType,
      helperWillSpeak: planned.immediateMessages.some(
        (message) => message.kind === 'HELPER_PROMPT' || message.kind === 'HELPER_RESCUE',
      ),
      haterWillSpeak: planned.immediateMessages.some(
        (message) => message.kind === 'HATER_TELEGRAPH' || message.kind === 'HATER_PUNISH',
      ),
      dealLocked:
        entry.channelId === 'DEAL_ROOM' &&
        planned.immediateMessages.some(
          (message) =>
            message.kind === 'NEGOTIATION_OFFER' || message.kind === 'NEGOTIATION_COUNTER',
        ),
      playerReplyPending: planned.scene.beats.some(
        (beat) => beat.beatType === 'PLAYER_REPLY_WINDOW',
      ),
      tags: planned.notes,
    };
  }

  private toRevealEntries(input: {
    readonly sourceEnvelopeId: string;
    readonly sceneId: ChatSceneId;
    readonly momentId: ChatMomentId;
    readonly delayedMessages: readonly ChatDramaDelayedMessage[];
  }): readonly ChatRevealEntry[] {
    return input.delayedMessages.map((delayed, index) => ({
      revealId: `reveal:${input.sceneId}:${index + 1}:${delayed.message.id}`,
      schedule: delayed.schedule,
      message: delayed.message,
      sceneId: input.sceneId,
      momentId: input.momentId,
      sourceEnvelopeId: input.sourceEnvelopeId,
    }));
  }

  private resolveMomentType(envelope: ChatMomentEnvelope): ChatMomentType {
    if (envelope.signal.momentType) {
      return envelope.signal.momentType;
    }

    const tags = new Set(envelope.signal.tags ?? []);
    const reason = `${envelope.signal.reason ?? ''} ${envelope.signal.bodyHint ?? ''}`.toLowerCase();
    const context = envelope.context;

    if (tags.has('world-event')) return 'WORLD_EVENT';
    if (tags.has('post-run')) return 'RUN_END';
    if (tags.has('legend')) return 'LEGEND_MOMENT';
    if (tags.has('helper-rescue')) return 'HELPER_RESCUE';
    if (tags.has('deal') || envelope.source === 'DEAL_ROOM') return 'DEAL_ROOM_STANDOFF';

    if (reason.includes('shield') || reason.includes('breach')) return 'SHIELD_BREACH';
    if (reason.includes('cascade')) return 'CASCADE_TRIGGER';
    if (reason.includes('attack')) return 'BOT_ATTACK';
    if (reason.includes('retreat')) return 'BOT_RETREAT';
    if (reason.includes('sovereign') && reason.includes('approach')) return 'SOVEREIGN_APPROACH';
    if (reason.includes('sovereign')) return 'SOVEREIGN_ACHIEVED';
    if (reason.includes('comeback')) return 'LEGEND_MOMENT';
    if (reason.includes('start')) return 'RUN_START';
    if (reason.includes('end')) return 'RUN_END';

    if (context?.pressureTier === 'CRITICAL' || context?.pressureTier === 'BREAKPOINT') {
      return 'PRESSURE_SURGE';
    }

    return 'RUN_START';
  }

  private resolveChannel(envelope: ChatMomentEnvelope): ChatVisibleChannel {
    if (envelope.signal.requestedChannel) return envelope.signal.requestedChannel;
    if (envelope.featureSnapshot?.activeVisibleChannel) {
      return envelope.featureSnapshot.activeVisibleChannel;
    }
    if (envelope.state?.activeVisibleChannel) {
      return envelope.state.activeVisibleChannel;
    }
    if (envelope.source === 'DEAL_ROOM') return 'DEAL_ROOM';
    return 'GLOBAL';
  }

  private signatureFor(
    envelope: ChatMomentEnvelope,
    momentType: ChatMomentType,
    channelId: ChatVisibleChannel,
  ): string {
    const sourceBot = envelope.signal.botId ?? 'NO_BOT';
    const reason = (envelope.signal.reason ?? envelope.signal.bodyHint ?? 'NO_REASON')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 64);
    return [channelId, envelope.source, momentType, sourceBot, reason].join(':');
  }

  private computePriority(
    envelope: ChatMomentEnvelope,
    momentType: ChatMomentType,
    channelId: ChatVisibleChannel,
  ): number {
    const affect = envelope.state?.affect;
    const embarrassment = clampScore100((affect as any)?.socialEmbarrassment);
    const frustration = clampScore100((affect as any)?.frustration);
    const desperation = clampScore100((affect as any)?.desperation);
    const pressure = this.pressureWeight(envelope.context?.pressureTier);
    const channelWeight = channelId === 'DEAL_ROOM' ? 18 : channelId === 'GLOBAL' ? 10 : 7;
    const momentWeight = MOMENT_PRIORITY_MAP[momentType] ?? 18;
    const sourceWeight = SOURCE_PRIORITY_BONUS[envelope.source] ?? 0;
    const forceWeight =
      (envelope.signal.forceSilence ? 6 : 0) +
      (envelope.signal.forceHelper ? 10 : 0) +
      (envelope.signal.forceCrowdWitness ? 3 : 0);

    return (
      momentWeight +
      sourceWeight +
      pressure +
      channelWeight +
      Math.round((embarrassment + frustration + desperation) / 12) +
      forceWeight
    );
  }

  private pressureWeight(pressureTier: PressureTier | undefined): number {
    switch (pressureTier) {
      case 'CALM':
        return 0;
      case 'WATCHFUL':
        return 4;
      case 'PRESSURED':
        return 12;
      case 'CRITICAL':
        return 18;
      case 'BREAKPOINT':
        return 24;
      default:
        return 0;
    }
  }

  private shouldSuppress(input: {
    readonly now: UnixMs;
    readonly signature: string;
    readonly channelId: ChatVisibleChannel;
    readonly momentType: ChatMomentType;
  }): boolean {
    const existing = this.cooldowns.get(input.signature);
    if (existing && Number(input.now) - Number(existing.lastPlannedAt) <= this.cooldownMs) {
      return true;
    }

    const lastChannelAt = this.lastEventAtByChannel.get(input.channelId);
    if (
      lastChannelAt &&
      Number(input.now) - Number(lastChannelAt) <= this.sameChannelSuppressionMs &&
      input.momentType !== 'WORLD_EVENT' &&
      input.momentType !== 'HELPER_RESCUE'
    ) {
      return true;
    }

    return false;
  }

  private bumpCooldown(entry: ChatMomentQueueEntry, plan: ChatDramaPlan): void {
    const existing = this.cooldowns.get(entry.signature);
    this.cooldowns.set(entry.signature, {
      signature: entry.signature,
      lastPlannedAt: entry.enqueuedAt,
      sceneId: plan.scene.sceneId,
      momentId: plan.scene.momentId,
      count: (existing?.count ?? 0) + 1,
    });
  }

  private sortQueue(): void {
    this.queue.sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority;
      if (left.enqueuedAt !== right.enqueuedAt) {
        return Number(left.enqueuedAt) - Number(right.enqueuedAt);
      }
      return left.queueId.localeCompare(right.queueId);
    });
  }

  private sortRevealQueue(): void {
    this.revealQueue.sort((left, right) => {
      if (left.schedule.revealAt !== right.schedule.revealAt) {
        return Number(left.schedule.revealAt) - Number(right.schedule.revealAt);
      }
      return left.revealId.localeCompare(right.revealId);
    });
  }

  private garbageCollect(referenceNow: number): void {
    for (const [signature, cooldown] of this.cooldowns.entries()) {
      if (referenceNow - Number(cooldown.lastPlannedAt) > this.cooldownMs * 6) {
        this.cooldowns.delete(signature);
      }
    }

    for (const channel of ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY'] as const) {
      const silenceWindow = this.silenceEngine.getActiveWindow(channel, toUnixMs(referenceNow));
      if (silenceWindow) {
        this.activeSilenceByChannel.set(channel, silenceWindow);
      } else {
        this.activeSilenceByChannel.delete(channel);
      }
    }

    const pending = this.revealQueue.filter(
      (entry) => Number(entry.schedule.revealAt) + 15000 > referenceNow,
    );
    this.revealQueue.length = 0;
    this.revealQueue.push(...pending);
  }
}

// ============================================================================
// MARK: Advanced planning helpers
// ============================================================================

export interface ChatMomentContinuityCheck {
  readonly shouldCarryForward: boolean;
  readonly activeSceneId?: ChatSceneId;
  readonly activeChannel?: ChatVisibleChannel;
  readonly reason?: string;
}

export function checkMomentContinuity(input: {
  readonly snapshot: ChatMomentOrchestratorSnapshot;
  readonly channelId: ChatVisibleChannel;
  readonly now?: UnixMs;
}): ChatMomentContinuityCheck {
  const activeSceneId = input.snapshot.activeSceneByChannel[input.channelId];
  const activeSilence = input.snapshot.activeSilenceByChannel[input.channelId];

  if (activeSilence) {
    return {
      shouldCarryForward: true,
      activeSceneId,
      activeChannel: input.channelId,
      reason: `Silence window still owns ${input.channelId}.`,
    };
  }

  if (activeSceneId) {
    return {
      shouldCarryForward: true,
      activeSceneId,
      activeChannel: input.channelId,
      reason: `Channel ${input.channelId} still has an active scene.`,
    };
  }

  return {
    shouldCarryForward: false,
  };
}

export interface ChatMomentMergeDecision {
  readonly merge: boolean;
  readonly preferredEnvelopeId?: string;
  readonly reason: string;
}

export function decideMomentMerge(input: {
  readonly left: ChatMomentEnvelope;
  readonly right: ChatMomentEnvelope;
}): ChatMomentMergeDecision {
  const leftMoment = input.left.signal.momentType;
  const rightMoment = input.right.signal.momentType;
  const leftChannel = input.left.signal.requestedChannel;
  const rightChannel = input.right.signal.requestedChannel;

  if (leftChannel && rightChannel && leftChannel !== rightChannel) {
    return {
      merge: false,
      reason: 'Channels differ.',
    };
  }

  if (leftMoment && rightMoment && leftMoment !== rightMoment) {
    return {
      merge: false,
      reason: 'Moment types differ.',
    };
  }

  const leftReason = (input.left.signal.reason ?? input.left.signal.bodyHint ?? '').trim();
  const rightReason = (input.right.signal.reason ?? input.right.signal.bodyHint ?? '').trim();

  if (leftReason && rightReason && leftReason !== rightReason) {
    return {
      merge: false,
      reason: 'Reason strings differ.',
    };
  }

  const preferredEnvelopeId =
    Number(input.left.emittedAt) <= Number(input.right.emittedAt)
      ? input.left.envelopeId
      : input.right.envelopeId;

  return {
    merge: true,
    preferredEnvelopeId,
    reason: 'Moment envelopes are merge-compatible.',
  };
}

export interface ChatMomentProjection {
  readonly nextImmediateSpeakerKind?: ChatActorKind;
  readonly nextLikelyRevealAt?: UnixMs;
  readonly estimatedSceneDurationMs?: number;
  readonly replyWindowExpected: boolean;
}

export function projectMomentPackage(
  packageResult: ChatMomentRuntimePackage,
): ChatMomentProjection {
  const firstImmediate = packageResult.immediateMessages[0];
  const nextReveal = packageResult.revealEntries[0];

  return {
    nextImmediateSpeakerKind: inferActorKindFromMessage(firstImmediate),
    nextLikelyRevealAt: nextReveal?.schedule.revealAt,
    estimatedSceneDurationMs:
      packageResult.revealEntries.length > 0
        ? Number(packageResult.revealEntries[packageResult.revealEntries.length - 1].schedule.revealAt) -
          Number(packageResult.emittedAt)
        : 0,
    replyWindowExpected: packageResult.interruptionRules.some(
      (rule) => rule.interrupterActorKind === 'PLAYER' || rule.canBreakSilence === false,
    ),
  };
}

function inferActorKindFromMessage(message: ChatMessage | undefined): ChatActorKind | undefined {
  if (!message) return undefined;

  switch (message.kind) {
    case 'PLAYER':
      return 'PLAYER';
    case 'HELPER_PROMPT':
    case 'HELPER_RESCUE':
      return 'HELPER';
    case 'HATER_TELEGRAPH':
    case 'HATER_PUNISH':
      return 'HATER';
    case 'CROWD_REACTION':
      return 'CROWD';
    case 'NEGOTIATION_OFFER':
    case 'NEGOTIATION_COUNTER':
      return 'DEAL_AGENT';
    case 'WORLD_EVENT':
      return 'LIVEOPS';
    case 'SYSTEM':
    case 'SYSTEM_SHADOW_MARKER':
    case 'MARKET_ALERT':
    case 'ACHIEVEMENT':
    case 'SHIELD_EVENT':
    case 'CASCADE_ALERT':
    case 'LEGEND_MOMENT':
    case 'POST_RUN_RITUAL':
      return 'SYSTEM';
    default:
      return 'AMBIENT_NPC';
  }
}

// ============================================================================
// MARK: Factory
// ============================================================================

export function createChatMomentOrchestrator(
  options?: ChatMomentOrchestratorOptions,
): ChatMomentOrchestrator {
  return new ChatMomentOrchestrator(options);
}
