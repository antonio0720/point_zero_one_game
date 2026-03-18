/**
 * ============================================================================
 * POINT ZERO ONE — CHAT EXPERIENCE REVEAL SCHEDULER
 * FILE: pzo-web/src/engines/chat/experience/ChatRevealScheduler.ts
 * VERSION: 2026.03.18
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic reveal scheduling for the sovereign chat runtime.
 *
 * The current engine already supports delayed reveals through pending schedules
 * and a payload map. This file turns that seed into a first-class scheduling
 * authority that can drive:
 * - hater delayed entries,
 * - helper timed rescues,
 * - quote callbacks,
 * - scene staging,
 * - liveops world events,
 * - negotiation read-pressure,
 * - reveal deferral during silence,
 * - authoritative merge and replay-safe inspection.
 *
 * Design laws
 * -----------
 * 1. Scheduling is pure and deterministic from the same inputs.
 * 2. Queue state must be inspectable without firing it.
 * 3. Silence can defer reveals but not erase them.
 * 4. Deal room reveal law differs from global reveal law.
 * 5. Staging must preserve scene order while still allowing interruption.
 * 6. Queue items carry full payload metadata; runtime should not guess later.
 * 7. Shadow and visible lanes can be planned together, then rendered separately.
 * 8. The scheduler must be able to absorb authoritative schedules from backend.
 *
 * Long-term extraction
 * --------------------
 * Today this file consumes the bridge contracts from ../types.
 * As the canonical tree finishes, the reusable scheduling contract should move
 * into /shared/contracts/chat and be shared by frontend/backend/server.
 *
 * ============================================================================
 */

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_ENGINE_CONSTANTS,
} from '../types';

import type {
  ChatActorKind,
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatChannelId,
  ChatChannelMood,
  ChatFeatureSnapshot,
  ChatInterruptPriority,
  ChatMessage,
  ChatMomentId,
  ChatMomentType,
  ChatRevealSchedule,
  ChatSceneBeatType,
  ChatSceneId,
  ChatScenePlan,
  ChatSilenceDecision,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import {
  createChatInterruptPriorityEngine,
  type ChatInterruptCandidate,
  type ChatInterruptResolution,
} from './ChatInterruptPriority';

// ============================================================================
// MARK: Helpers
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function unix(value: number): UnixMs {
  return Math.round(value) as UnixMs;
}

function safeString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return fallback;
}

function compareNumbersAsc(a: number, b: number): number {
  return a - b;
}

function compareStringsAsc(a: string, b: string): number {
  return a.localeCompare(b);
}

function addUnixMs(value: UnixMs, delta: number): UnixMs {
  return unix((value as number) + delta);
}

function buildDeterministicKey(parts: readonly string[]): string {
  return parts.join('|');
}

function buildFallbackPayloadRef(parts: readonly string[]): string {
  return buildDeterministicKey(['reveal', ...parts]);
}

function isVisibleChannel(channelId: ChatChannelId): channelId is ChatVisibleChannel {
  return channelId === 'GLOBAL' || channelId === 'SYNDICATE' || channelId === 'DEAL_ROOM' || channelId === 'LOBBY';
}

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type ChatRevealDisposition = 'PENDING' | 'DEFERRED' | 'FIRED' | 'CANCELLED' | 'EXPIRED';

export interface ChatRevealCandidate {
  readonly candidateId: string;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly channelId: ChatChannelId;
  readonly message: ChatMessage;
  readonly revealReason: ChatRevealSchedule['revealReason'];
  readonly baseDelayMs?: number;
  readonly earliestAt?: UnixMs;
  readonly latestAt?: UnixMs;
  readonly canBreakSilence?: boolean;
  readonly canInterruptScene?: boolean;
  readonly naturalDelayMs?: number;
  readonly sceneBeatType?: ChatSceneBeatType;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly momentType?: ChatMomentType;
  readonly tags?: readonly string[];
}

export interface ChatScheduledReveal {
  readonly schedule: ChatRevealSchedule;
  readonly message: ChatMessage;
  readonly candidateId: string;
  readonly actorId: string;
  readonly actorKind: ChatActorKind;
  readonly disposition: ChatRevealDisposition;
  readonly createdAt: UnixMs;
  readonly visibleToPlayer: boolean;
  readonly canBreakSilence: boolean;
  readonly canInterruptScene: boolean;
  readonly sceneBeatType?: ChatSceneBeatType;
  readonly sceneId?: ChatSceneId;
  readonly momentId?: ChatMomentId;
  readonly priority: ChatInterruptPriority;
  readonly tags: readonly string[];
  readonly orderingKey: string;
  readonly deferredCount: number;
  readonly debug: {
    readonly baseDelayMs: number;
    readonly jitterMs: number;
    readonly channelBiasMs: number;
    readonly interruptScheduledDelayMs: number;
  };
}

export interface ChatRevealSchedulerSnapshot {
  readonly pending: readonly ChatScheduledReveal[];
  readonly fired: readonly ChatScheduledReveal[];
  readonly cancelled: readonly ChatScheduledReveal[];
  readonly queueVersion: number;
}

export interface ChatRevealSchedulerContext {
  readonly now: UnixMs;
  readonly activeChannel: ChatVisibleChannel;
  readonly activeScene?: ChatScenePlan;
  readonly currentSilence?: ChatSilenceDecision;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly affect?: ChatAffectSnapshot;
  readonly audienceHeatByChannel?: Partial<Record<ChatVisibleChannel, ChatAudienceHeat>>;
  readonly channelMoodByChannel?: Partial<Record<ChatChannelId, ChatChannelMood>>;
  readonly maxVisibleInterrupts?: number;
}

export interface ChatSceneRevealPlan {
  readonly scene: ChatScenePlan;
  readonly resolution: ChatInterruptResolution;
  readonly scheduled: readonly ChatScheduledReveal[];
}

export interface ChatDueRevealBatch {
  readonly now: UnixMs;
  readonly due: readonly ChatScheduledReveal[];
  readonly remaining: readonly ChatScheduledReveal[];
}

// ============================================================================
// MARK: Jitter and channel policy
// ============================================================================

const CHANNEL_BASE_JITTER_MS: Readonly<Record<ChatVisibleChannel, readonly [number, number]>> = Object.freeze({
  GLOBAL: [0, 55],
  SYNDICATE: [12, 48],
  DEAL_ROOM: [60, 140],
  LOBBY: [8, 40],
});

const PRIORITY_JITTER_MODIFIER: Readonly<Record<ChatInterruptPriority, number>> = Object.freeze({
  ABSOLUTE: -30,
  CRITICAL: -20,
  HIGH: -8,
  NORMAL: 0,
  LOW: 18,
});

function computeDeterministicJitter(
  channelId: ChatVisibleChannel,
  priority: ChatInterruptPriority,
  seed: string,
): number {
  const [min, max] = CHANNEL_BASE_JITTER_MS[channelId];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const span = Math.max(1, max - min + 1);
  const jitter = min + (hash % span) + PRIORITY_JITTER_MODIFIER[priority];
  return Math.max(0, jitter);
}

function computeChannelDelayBias(
  channelId: ChatVisibleChannel,
  mood?: ChatChannelMood,
): number {
  let bias = 0;

  if (channelId === 'DEAL_ROOM') bias += 85;
  if (channelId === 'SYNDICATE') bias += 22;
  if (channelId === 'LOBBY') bias += 8;

  switch (mood?.mood) {
    case 'PREDATORY':
      if (channelId === 'DEAL_ROOM') bias += 70;
      break;
    case 'HOSTILE':
      if (channelId === 'GLOBAL') bias -= 15;
      break;
    case 'ECSTATIC':
      if (channelId === 'GLOBAL') bias -= 10;
      break;
    case 'MOURNFUL':
      bias += 40;
      break;
    case 'SUSPICIOUS':
      if (channelId === 'SYNDICATE' || channelId === 'DEAL_ROOM') bias += 18;
      break;
    case 'CALM':
    default:
      break;
  }

  return bias;
}

function computeSilenceDeferralMs(
  candidate: ChatRevealCandidate,
  silence?: ChatSilenceDecision,
): number {
  if (!silence?.enforced) return 0;
  if (candidate.canBreakSilence) return 0;

  switch (silence.reason) {
    case 'NEGOTIATION_PRESSURE':
      return candidate.channelId === 'DEAL_ROOM' ? Math.max(0, silence.durationMs - 40) : silence.durationMs + 90;
    case 'RESCUE_WAIT':
      return candidate.actorKind === 'HELPER' ? 0 : silence.durationMs + 60;
    case 'SCENE_COMPOSITION':
      return silence.durationMs;
    case 'READ_THEATER':
      return silence.durationMs + 40;
    case 'DREAD':
      return silence.durationMs + 25;
    case 'NONE':
    default:
      return silence.durationMs;
  }
}

// ============================================================================
// MARK: Scheduler
// ============================================================================

export interface CreateChatRevealSchedulerOptions {
  readonly interruptEngine?: ReturnType<typeof createChatInterruptPriorityEngine>;
}

export class ChatRevealScheduler {
  private readonly interruptEngine: ReturnType<typeof createChatInterruptPriorityEngine>;

  private pending: ChatScheduledReveal[] = [];

  private fired: ChatScheduledReveal[] = [];

  private cancelled: ChatScheduledReveal[] = [];

  private queueVersion = 0;

  constructor(options: CreateChatRevealSchedulerOptions = {}) {
    this.interruptEngine = options.interruptEngine ?? createChatInterruptPriorityEngine();
  }

  public snapshot(): ChatRevealSchedulerSnapshot {
    return {
      pending: this.pending.map((item) => this.cloneScheduledReveal(item)),
      fired: this.fired.map((item) => this.cloneScheduledReveal(item)),
      cancelled: this.cancelled.map((item) => this.cloneScheduledReveal(item)),
      queueVersion: this.queueVersion,
    };
  }

  public clear(): void {
    this.pending = [];
    this.fired = [];
    this.cancelled = [];
    this.bumpVersion();
  }

  public enqueue(
    candidate: ChatRevealCandidate,
    context: ChatRevealSchedulerContext,
  ): ChatScheduledReveal {
    const interruptCandidate = this.toInterruptCandidate(candidate, context.now);
    const ranked = this.interruptEngine.scoreCandidate(interruptCandidate, {
      now: context.now,
      activeChannel: context.activeChannel,
      activeScene: context.activeScene,
      currentSilence: context.currentSilence,
      featureSnapshot: context.featureSnapshot,
      affect: context.affect,
      audienceHeatByChannel: context.audienceHeatByChannel,
      channelMoodByChannel: context.channelMoodByChannel,
      maxVisibleInterrupts: context.maxVisibleInterrupts,
    });

    const next = this.buildScheduledReveal(candidate, context, ranked.priority, ranked.scheduledDelayMs);
    this.upsertPending(next);
    return this.cloneScheduledReveal(next);
  }

  public enqueueMany(
    candidates: readonly ChatRevealCandidate[],
    context: ChatRevealSchedulerContext,
  ): readonly ChatScheduledReveal[] {
    return candidates.map((candidate) => this.enqueue(candidate, context));
  }

  public planScene(
    scene: ChatScenePlan,
    candidates: readonly ChatRevealCandidate[],
    context: ChatRevealSchedulerContext,
  ): ChatSceneRevealPlan {
    const interruptCandidates: ChatInterruptCandidate[] = candidates.map((candidate) => this.toInterruptCandidate(candidate, context.now));
    const resolution = this.interruptEngine.resolve(interruptCandidates, {
      now: context.now,
      activeChannel: context.activeChannel,
      activeScene: context.activeScene ?? scene,
      currentSilence: context.currentSilence,
      featureSnapshot: context.featureSnapshot,
      affect: context.affect,
      audienceHeatByChannel: context.audienceHeatByChannel,
      channelMoodByChannel: context.channelMoodByChannel,
      maxVisibleInterrupts: context.maxVisibleInterrupts,
    });

    const rankedById = new Map(
      resolution.queue
        .concat(resolution.suppressed)
        .map((entry) => [entry.candidate.candidateId, entry] as const),
    );

    const sceneStartedAt = scene.startedAt;
    const scheduled: ChatScheduledReveal[] = [];

    for (const candidate of candidates) {
      const ranked = rankedById.get(candidate.candidateId);
      if (!ranked) continue;
      const beatDelay = this.resolveBeatDelay(scene, candidate);
      const mergedCandidate: ChatRevealCandidate = {
        ...candidate,
        sceneId: candidate.sceneId ?? scene.sceneId,
        momentId: candidate.momentId ?? scene.momentId,
        momentType: candidate.momentType ?? scene.momentType,
        earliestAt: candidate.earliestAt ?? addUnixMs(sceneStartedAt, beatDelay),
        naturalDelayMs: (candidate.naturalDelayMs ?? 0) + beatDelay,
      };
      const item = this.buildScheduledReveal(mergedCandidate, context, ranked.priority, ranked.scheduledDelayMs);
      scheduled.push(item);
      this.upsertPending(item);
    }

    return {
      scene,
      resolution,
      scheduled: scheduled.map((item) => this.cloneScheduledReveal(item)),
    };
  }

  public drainDue(
    now: UnixMs,
  ): ChatDueRevealBatch {
    const due: ChatScheduledReveal[] = [];
    const keep: ChatScheduledReveal[] = [];

    for (const item of this.pending) {
      if (item.disposition === 'CANCELLED' || item.disposition === 'EXPIRED') {
        continue;
      }

      if (item.schedule.revealAt <= now) {
        const firedItem: ChatScheduledReveal = {
          ...item,
          disposition: 'FIRED',
        };
        due.push(firedItem);
        this.fired.push(firedItem);
      } else {
        keep.push(item);
      }
    }

    if (due.length > 0) {
      this.pending = keep;
      this.bumpVersion();
    }

    return {
      now,
      due: due.map((item) => this.cloneScheduledReveal(item)),
      remaining: this.pending.map((item) => this.cloneScheduledReveal(item)),
    };
  }

  public deferDuringSilence(
    silence: ChatSilenceDecision,
    now: UnixMs,
  ): readonly ChatScheduledReveal[] {
    if (!silence.enforced) return this.pending.map((item) => this.cloneScheduledReveal(item));

    const deferred: ChatScheduledReveal[] = [];

    this.pending = this.pending.map((item) => {
      if (item.canBreakSilence) return item;
      const deferralMs = computeSilenceDeferralMs(
        {
          candidateId: item.candidateId,
          actorId: item.actorId,
          actorKind: item.actorKind,
          channelId: item.schedule.revealChannel,
          message: item.message,
          revealReason: item.schedule.revealReason,
          canBreakSilence: item.canBreakSilence,
        },
        silence,
      );

      if (deferralMs <= 0) return item;

      const next: ChatScheduledReveal = {
        ...item,
        disposition: 'DEFERRED',
        deferredCount: item.deferredCount + 1,
        schedule: {
          ...item.schedule,
          revealAt: addUnixMs(item.schedule.revealAt, deferralMs),
        },
      };
      deferred.push(next);
      return next;
    });

    if (deferred.length > 0) {
      this.pending.sort(this.compareScheduledReveal);
      this.bumpVersion();
    }

    return deferred.map((item) => this.cloneScheduledReveal(item));
  }

  public cancelByScene(sceneId: ChatSceneId): readonly ChatScheduledReveal[] {
    return this.cancelWhere((item) => item.sceneId === sceneId);
  }

  public cancelByMoment(momentId: ChatMomentId): readonly ChatScheduledReveal[] {
    return this.cancelWhere((item) => item.momentId === momentId);
  }

  public cancelByPayloadRef(payloadRef: string): readonly ChatScheduledReveal[] {
    return this.cancelWhere((item) => item.schedule.payloadRef === payloadRef);
  }

  public mergeAuthoritativeSchedules(
    schedules: readonly ChatRevealSchedule[],
  ): readonly ChatScheduledReveal[] {
    const merged: ChatScheduledReveal[] = [];

    for (const schedule of schedules) {
      const existing = this.pending.find((item) => item.schedule.payloadRef === schedule.payloadRef);
      if (existing) {
        const patched: ChatScheduledReveal = {
          ...existing,
          schedule: { ...schedule },
        };
        this.upsertPending(patched);
        merged.push(patched);
        continue;
      }

      const placeholderMessage: ChatMessage = {
        id: `placeholder:${schedule.payloadRef}` as ChatMessage['id'],
        channel: isVisibleChannel(schedule.revealChannel) ? schedule.revealChannel : 'GLOBAL',
        kind: 'SYSTEM_SHADOW_MARKER',
        senderId: 'system:reveal',
        senderName: 'System',
        body: `Deferred payload ${schedule.payloadRef}`,
        ts: schedule.revealAt as unknown as number,
        deliveryState: 'AUTHORITATIVE',
        moderation: { state: 'ALLOWED', playerVisible: false },
      };

      const item: ChatScheduledReveal = {
        schedule: { ...schedule },
        message: placeholderMessage,
        candidateId: schedule.payloadRef,
        actorId: 'system:reveal',
        actorKind: 'SYSTEM',
        disposition: 'PENDING',
        createdAt: schedule.revealAt,
        visibleToPlayer: isVisibleChannel(schedule.revealChannel),
        canBreakSilence: schedule.revealReason !== 'SCENE_STAGING',
        canInterruptScene: schedule.revealReason !== 'SCENE_STAGING',
        priority: schedule.revealReason === 'WORLD_EVENT' ? 'CRITICAL' : 'NORMAL',
        tags: ['authoritative-merge'],
        orderingKey: buildDeterministicKey([schedule.payloadRef, String(schedule.revealAt)]),
        deferredCount: 0,
        debug: {
          baseDelayMs: 0,
          jitterMs: 0,
          channelBiasMs: 0,
          interruptScheduledDelayMs: 0,
        },
      };
      this.upsertPending(item);
      merged.push(item);
    }

    return merged.map((item) => this.cloneScheduledReveal(item));
  }

  public exportSchedules(): readonly ChatRevealSchedule[] {
    return this.pending.map((item) => ({ ...item.schedule }));
  }

  // ========================================================================
  // MARK: Internal construction
  // ========================================================================

  private resolveBeatDelay(
    scene: ChatScenePlan,
    candidate: ChatRevealCandidate,
  ): number {
    if (!candidate.sceneBeatType) return 0;
    const beat = scene.beats.find((entry) => entry.beatType === candidate.sceneBeatType);
    return beat ? Math.max(0, beat.delayMs) : 0;
  }

  private buildScheduledReveal(
    candidate: ChatRevealCandidate,
    context: ChatRevealSchedulerContext,
    priority: ChatInterruptPriority,
    interruptScheduledDelayMs: number,
  ): ChatScheduledReveal {
    const revealChannel = isVisibleChannel(candidate.channelId)
      ? candidate.channelId
      : (candidate.message.channel ?? context.activeChannel);

    const mood = context.channelMoodByChannel?.[revealChannel];
    const payloadRef = safeString(
      candidate.message.audit?.requestId ?? candidate.message.proof?.proofHash ?? candidate.message.id,
      buildFallbackPayloadRef([
        candidate.candidateId,
        candidate.actorId,
        candidate.revealReason,
        String(candidate.message.ts),
      ]),
    );

    const jitterSeed = buildDeterministicKey([
      candidate.candidateId,
      candidate.actorId,
      priority,
      candidate.revealReason,
      payloadRef,
    ]);

    const jitterMs = computeDeterministicJitter(revealChannel, priority, jitterSeed);
    const channelBiasMs = computeChannelDelayBias(revealChannel, mood);
    const silenceDeferralMs = computeSilenceDeferralMs(candidate, context.currentSilence);
    const baseDelayMs = Math.max(0, Math.round(candidate.baseDelayMs ?? 0));
    const naturalDelayMs = Math.max(0, Math.round(candidate.naturalDelayMs ?? 0));

    const effectiveDelayMs = clamp(
      baseDelayMs +
        naturalDelayMs +
        interruptScheduledDelayMs +
        jitterMs +
        channelBiasMs +
        silenceDeferralMs,
      0,
      CHAT_ENGINE_CONSTANTS.sceneSoftTimeoutMs * 4,
    );

    const earliestAt = candidate.earliestAt ?? context.now;
    const revealAt = addUnixMs(earliestAt, effectiveDelayMs);
    const latestAt = candidate.latestAt;
    const normalizedRevealAt = latestAt && revealAt > latestAt ? latestAt : revealAt;

    const schedule: ChatRevealSchedule = {
      revealAt: normalizedRevealAt,
      revealChannel,
      revealReason: candidate.revealReason,
      payloadRef,
    };

    const visibleToPlayer = CHAT_CHANNEL_DESCRIPTORS[revealChannel].visibleToPlayer;

    return {
      schedule,
      message: {
        ...candidate.message,
        channel: revealChannel,
        ts: normalizedRevealAt as unknown as number,
        sceneId: candidate.sceneId ?? candidate.message.sceneId,
        momentId: candidate.momentId ?? candidate.message.momentId,
      },
      candidateId: candidate.candidateId,
      actorId: candidate.actorId,
      actorKind: candidate.actorKind,
      disposition: silenceDeferralMs > 0 ? 'DEFERRED' : 'PENDING',
      createdAt: context.now,
      visibleToPlayer,
      canBreakSilence: Boolean(candidate.canBreakSilence),
      canInterruptScene: Boolean(candidate.canInterruptScene),
      sceneBeatType: candidate.sceneBeatType,
      sceneId: candidate.sceneId,
      momentId: candidate.momentId,
      priority,
      tags: [...(candidate.tags ?? [])],
      orderingKey: buildDeterministicKey([
        revealChannel,
        String(normalizedRevealAt),
        priority,
        candidate.candidateId,
      ]),
      deferredCount: silenceDeferralMs > 0 ? 1 : 0,
      debug: {
        baseDelayMs,
        jitterMs,
        channelBiasMs,
        interruptScheduledDelayMs,
      },
    };
  }

  private toInterruptCandidate(
    candidate: ChatRevealCandidate,
    now: UnixMs,
  ): ChatInterruptCandidate {
    return {
      candidateId: candidate.candidateId,
      actorId: candidate.actorId,
      actorKind: candidate.actorKind,
      channelId: candidate.channelId,
      messageKind: candidate.message.kind,
      momentType: candidate.momentType,
      sceneBeatType: candidate.sceneBeatType,
      requestedAt: candidate.earliestAt ?? now,
      naturalDelayMs: candidate.naturalDelayMs ?? candidate.baseDelayMs,
      canBreakSilence: candidate.canBreakSilence,
      canInterruptScene: candidate.canInterruptScene,
      payloadRef: candidate.message.id,
      tags: candidate.tags,
    };
  }

  private upsertPending(next: ChatScheduledReveal): void {
    const index = this.pending.findIndex((item) => item.schedule.payloadRef === next.schedule.payloadRef);
    if (index >= 0) {
      this.pending[index] = next;
    } else {
      this.pending.push(next);
    }
    this.pending.sort(this.compareScheduledReveal);
    this.bumpVersion();
  }

  private compareScheduledReveal(left: ChatScheduledReveal, right: ChatScheduledReveal): number {
    const timeOrder = compareNumbersAsc(left.schedule.revealAt as number, right.schedule.revealAt as number);
    if (timeOrder !== 0) return timeOrder;

    const priorityOrder = compareNumbersAsc(this.priorityToSortRank(left.priority), this.priorityToSortRank(right.priority));
    if (priorityOrder !== 0) return priorityOrder;

    return compareStringsAsc(left.orderingKey, right.orderingKey);
  }

  private priorityToSortRank(priority: ChatInterruptPriority): number {
    switch (priority) {
      case 'ABSOLUTE':
        return 0;
      case 'CRITICAL':
        return 1;
      case 'HIGH':
        return 2;
      case 'NORMAL':
        return 3;
      case 'LOW':
      default:
        return 4;
    }
  }

  private cancelWhere(
    predicate: (item: ChatScheduledReveal) => boolean,
  ): readonly ChatScheduledReveal[] {
    const kept: ChatScheduledReveal[] = [];
    const cancelled: ChatScheduledReveal[] = [];

    for (const item of this.pending) {
      if (!predicate(item)) {
        kept.push(item);
        continue;
      }
      const next: ChatScheduledReveal = {
        ...item,
        disposition: 'CANCELLED',
      };
      cancelled.push(next);
      this.cancelled.push(next);
    }

    if (cancelled.length > 0) {
      this.pending = kept;
      this.bumpVersion();
    }

    return cancelled.map((item) => this.cloneScheduledReveal(item));
  }

  private cloneScheduledReveal(item: ChatScheduledReveal): ChatScheduledReveal {
    return {
      ...item,
      schedule: { ...item.schedule },
      message: {
        ...item.message,
        sender: item.message.sender ? { ...item.message.sender } : undefined,
        moderation: item.message.moderation ? { ...item.message.moderation } : undefined,
        proof: item.message.proof ? { ...item.message.proof } : undefined,
        replay: item.message.replay ? { ...item.message.replay } : undefined,
        legend: item.message.legend ? { ...item.message.legend } : undefined,
        audit: item.message.audit ? { ...item.message.audit } : undefined,
        meta: item.message.meta
          ? {
              ...item.message.meta,
              pressure: item.message.meta.pressure ? { ...item.message.meta.pressure } : undefined,
              tick: item.message.meta.tick ? { ...item.message.meta.tick } : undefined,
              shieldMeta: item.message.meta.shieldMeta ? { ...item.message.meta.shieldMeta } : undefined,
              cascadeMeta: item.message.meta.cascadeMeta ? { ...item.message.meta.cascadeMeta } : undefined,
              dealRoom: item.message.meta.dealRoom ? { ...item.message.meta.dealRoom } : undefined,
              injection: item.message.meta.injection ? { ...item.message.meta.injection } : undefined,
            }
          : undefined,
        relationshipIds: item.message.relationshipIds ? [...item.message.relationshipIds] : undefined,
        quoteIds: item.message.quoteIds ? [...item.message.quoteIds] : undefined,
        readReceipts: item.message.readReceipts ? [...item.message.readReceipts] : undefined,
        tags: item.message.tags ? [...item.message.tags] : undefined,
      },
      tags: [...item.tags],
      debug: { ...item.debug },
    };
  }

  private bumpVersion(): void {
    this.queueVersion += 1;
  }
}

// ============================================================================
// MARK: Stateless convenience
// ============================================================================

export function createChatRevealScheduler(
  options: CreateChatRevealSchedulerOptions = {},
): ChatRevealScheduler {
  return new ChatRevealScheduler(options);
}

export function planSceneReveals(
  scene: ChatScenePlan,
  candidates: readonly ChatRevealCandidate[],
  context: ChatRevealSchedulerContext,
  options: CreateChatRevealSchedulerOptions = {},
): ChatSceneRevealPlan {
  return createChatRevealScheduler(options).planScene(scene, candidates, context);
}

export function scheduleRevealCandidate(
  candidate: ChatRevealCandidate,
  context: ChatRevealSchedulerContext,
  options: CreateChatRevealSchedulerOptions = {},
): ChatScheduledReveal {
  return createChatRevealScheduler(options).enqueue(candidate, context);
}

export const CHAT_REVEAL_SCHEDULER_NAMESPACE = Object.freeze({
  createChatRevealScheduler,
  planSceneReveals,
  scheduleRevealCandidate,
});
