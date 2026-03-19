/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT SHADOW REVEAL QUEUE
 * FILE: pzo-web/src/engines/chat/shadow/RevealQueue.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend scheduler for shadow reveals.
 *
 * This file owns the timing, ordering, gating, and materialization policy for
 * hidden chat effects that should become visible later. It is deliberately not
 * a generic priority queue. It is tuned for the Point Zero One chat lane and
 * the way your repo already separates visible transcript truth from hidden
 * dramaturgy, rescue timing, rivalry pressure, negotiation traps, and liveops.
 *
 * Design doctrine
 * ---------------
 * - A reveal queue is authored pressure with a clock.
 * - Not every latent item should reveal.
 * - Suppressed replies and witness events must compete lawfully.
 * - Rescue reveals can preempt mockery reveals.
 * - Deal-room reveals should respect negotiation positioning.
 * - Crowd reveals should feel earned, not spammy.
 * - Queue evaluation must stay deterministic and inspectable.
 * ============================================================================
 */

import * as ShadowContract from '../../../../shared/contracts/chat/ChatShadowState';
import * as ChatStateModel from '../ChatState';

import type {
  ChatAuthoritativeFrame,
  ChatChannelId,
  ChatCounterplayWindow,
  ChatEngineState,
  ChatFeatureSnapshot,
  ChatMessage,
  ChatMessageId,
  ChatRevealSchedule,
  ChatScenePlan,
  ChatSilenceDecision,
  ChatVisibleChannel,
  JsonObject,
  Nullable,
  PressureTier,
  Score100,
  TickTier,
  UnixMs,
} from '../types';

// ============================================================================
// MARK: Local queue contracts
// ============================================================================

export type RevealQueueReason =
  | 'TIME_DUE'
  | 'COUNTER_WINDOW_OPEN'
  | 'SILENCE_BROKEN'
  | 'PRESSURE_THRESHOLD'
  | 'NEGOTIATION_RESPONSE'
  | 'RESCUE_TRIGGER'
  | 'SCENE_PHASE'
  | 'RUN_END'
  | 'PLAYER_COLLAPSE'
  | 'PLAYER_COMEBACK'
  | 'BOSS_FIGHT_OPEN'
  | 'BLUFF_EXPOSED'
  | 'PROOF_CONFIRMED';

export type RevealQueueDecision =
  | 'KEEP_PENDING'
  | 'ARM'
  | 'READY'
  | 'RELEASE'
  | 'CANCEL'
  | 'EXPIRE';

export interface RevealQueueOptions {
  readonly maxItems?: number;
  readonly maxReleasesPerPoll?: number;
  readonly armLeadMs?: number;
  readonly readyLeadMs?: number;
  readonly releaseSpacingMs?: number;
  readonly expiryGraceMs?: number;
  readonly rescuePreemptionBoost?: number;
  readonly rivalryPenaltyDuringSilence?: number;
  readonly crowdPenaltyDuringQuiet?: number;
  readonly negotiationPenaltyDuringProbe?: number;
  readonly debugEcho?: boolean;
}

export interface RevealQueueTicket {
  readonly queueId: string;
  readonly roomId: string;
  readonly item: ShadowContract.ChatShadowRevealQueueItem;
  readonly insertedAt: UnixMs;
  readonly score: number;
  readonly decision: RevealQueueDecision;
  readonly decisionReason: RevealQueueReason;
}

export interface RevealQueueRelease {
  readonly roomId: string;
  readonly item: ShadowContract.ChatShadowRevealQueueItem;
  readonly reveal: ChatRevealSchedule;
  readonly releaseReason: RevealQueueReason;
  readonly score: number;
}

export interface RevealQueuePollResult {
  readonly state: ChatEngineState;
  readonly releases: readonly RevealQueueRelease[];
  readonly kept: readonly RevealQueueTicket[];
  readonly expired: readonly RevealQueueTicket[];
  readonly cancelled: readonly RevealQueueTicket[];
}

export interface RevealQueueSnapshot {
  readonly total: number;
  readonly pending: number;
  readonly ready: number;
  readonly releasable: number;
  readonly expired: number;
  readonly highestScore?: number;
}


export interface RevealQueueRoomDiagnostics {
  readonly roomId: string;
  readonly snapshot: RevealQueueSnapshot;
  readonly hiddenThreatCount: number;
  readonly revealableSuppressedCount: number;
  readonly callbackAnchorCount: number;
  readonly rescuePressureActive: boolean;
  readonly negotiationTrapActive: boolean;
  readonly crowdBoilActive: boolean;
  readonly witnessDensity: number;
  readonly lines: readonly string[];
}

export interface RevealQueuePlanningContext {
  readonly now: UnixMs;
  readonly pressureTier?: PressureTier;
  readonly tickTier?: TickTier;
  readonly featureSnapshot?: ChatFeatureSnapshot;
  readonly currentSilence?: Nullable<ChatSilenceDecision>;
  readonly activeCounterWindow?: Nullable<ChatCounterplayWindow>;
  readonly activeScene?: Nullable<ChatScenePlan>;
  readonly bluffExposed?: boolean;
  readonly runEnding?: boolean;
  readonly collapseDetected?: boolean;
  readonly comebackDetected?: boolean;
}

const DEFAULT_OPTIONS: Required<RevealQueueOptions> = Object.freeze({
  maxItems: 256,
  maxReleasesPerPoll: 5,
  armLeadMs: 600,
  readyLeadMs: 120,
  releaseSpacingMs: 350,
  expiryGraceMs: 20_000,
  rescuePreemptionBoost: 22,
  rivalryPenaltyDuringSilence: 18,
  crowdPenaltyDuringQuiet: 12,
  negotiationPenaltyDuringProbe: 14,
  debugEcho: false,
});

function nowUnixMs(): UnixMs {
  return Date.now() as UnixMs;
}

function toIso(ms: UnixMs): string {
  return new Date(Number(ms)).toISOString();
}

function asUnixMs(value: number): UnixMs {
  return value as UnixMs;
}

function normalizeOptions(options: RevealQueueOptions = {}): Required<RevealQueueOptions> {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

function inferVisibleRevealChannel(item: ShadowContract.ChatShadowRevealQueueItem): ChatVisibleChannel {
  const target = item.targetId as ChatChannelId | undefined;
  switch (target) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'DIRECT':
    case 'SPECTATOR':
      return target;
    default:
      switch (item.lane) {
        case 'NEGOTIATION_SHADOW':
          return 'DEAL_ROOM';
        case 'RESCUE_SHADOW':
          return 'DIRECT';
        case 'RIVALRY_SHADOW':
          return 'GLOBAL';
        case 'CROWD_SHADOW':
          return 'GLOBAL';
        default:
          return 'GLOBAL';
      }
  }
}

function toRevealReason(item: ShadowContract.ChatShadowRevealQueueItem): ChatRevealSchedule['revealReason'] {
  switch (item.lane) {
    case 'RESCUE_SHADOW':
      return 'HELPER_RESCUE';
    case 'RIVALRY_SHADOW':
      return 'RIVALRY_ESCALATION';
    case 'LIVEOPS_SHADOW':
      return 'LIVEOPS_SEQUENCE';
    default:
      return 'SCENE_REVEAL';
  }
}

function revealAtOf(item: ShadowContract.ChatShadowRevealQueueItem, now: UnixMs): UnixMs {
  if (item.revealAt) return Date.parse(item.revealAt) as UnixMs;
  if (item.readyAt) return Date.parse(item.readyAt) as UnixMs;
  return now;
}

function expiresAtOf(item: ShadowContract.ChatShadowRevealQueueItem): UnixMs | undefined {
  return item.expiresAt ? (Date.parse(item.expiresAt) as UnixMs) : undefined;
}

function laneBoost(item: ShadowContract.ChatShadowRevealQueueItem, options: Required<RevealQueueOptions>): number {
  switch (item.lane) {
    case 'RESCUE_SHADOW':
      return options.rescuePreemptionBoost;
    case 'RIVALRY_SHADOW':
      return 8;
    case 'NEGOTIATION_SHADOW':
      return 6;
    case 'LIVEOPS_SHADOW':
      return 10;
    case 'WITNESS_SHADOW':
      return 4;
    default:
      return 0;
  }
}

function snapshot(state: ChatEngineState): RevealQueueSnapshot {
  const total = state.pendingReveals.length;
  return {
    total,
    pending: total,
    ready: 0,
    releasable: 0,
    expired: 0,
    highestScore: undefined,
  };
}

// ============================================================================
// MARK: RevealQueue class
// ============================================================================

export class RevealQueue {
  private readonly options: Required<RevealQueueOptions>;
  private lastReleaseAtByRoom = new Map<string, UnixMs>();
  private debugEvents: Array<{ at: UnixMs; roomId: string; event: string; detail?: JsonObject }> = [];

  public constructor(options: RevealQueueOptions = {}) {
    this.options = normalizeOptions(options);
  }

  public getOptions(): Required<RevealQueueOptions> {
    return { ...this.options };
  }

  public projectSnapshot(room: ShadowContract.ChatShadowRoomSnapshot, state?: ChatEngineState): RevealQueueSnapshot {
    let ready = 0;
    let releasable = 0;
    let expired = 0;
    let highestScore: number | undefined;
    const now = nowUnixMs();

    for (const item of room.revealQueue) {
      const score = this.scoreItem(item, {
        now,
        state,
        room,
      });
      if (highestScore === undefined || score > highestScore) highestScore = score;

      const expiresAt = expiresAtOf(item);
      if (expiresAt && Number(expiresAt) < Number(now)) {
        expired += 1;
        continue;
      }

      if (this.isReady(item, now)) ready += 1;
      if (this.isReleasable(item, now, room, state)) releasable += 1;
    }

    return {
      total: room.revealQueue.length,
      pending: room.revealQueue.length - ready - expired,
      ready,
      releasable,
      expired,
      highestScore,
    };
  }

  public enqueueSuppressedReply(
    room: ShadowContract.ChatShadowRoomSnapshot,
    reply: ShadowContract.ChatShadowSuppressedReply,
    context: {
      now?: UnixMs;
      trigger?: ShadowContract.ChatShadowRevealTrigger;
      priority?: ShadowContract.ChatShadowPriorityBand;
    } = {},
  ): ShadowContract.ChatShadowRoomSnapshot {
    const now = context.now ?? nowUnixMs();
    const item = ShadowContract.createShadowRevealQueueItem({
      id: `reveal:${reply.id}`,
      lane: reply.lane,
      createdAt: toIso(now),
      provenance: reply.provenance,
      queueId: reply.queueId ?? `queue:${room.roomId}:${reply.lane}`,
      revealId: `reveal:${reply.suppressionId}`,
      targetKind: reply.targetKind,
      targetId: reply.targetId,
      revealTrigger: context.trigger ?? 'TIME',
      readyAt: reply.readyAt,
      revealAt: reply.revealAt,
      expiresAt: reply.expiresAt,
      priority: context.priority ?? reply.priority,
    });

    const next = ShadowContract.foldShadowDelta(room, {
      roomId: room.roomId,
      updatedAt: toIso(now),
      appendedAnchors: [],
      appendedSuppressedReplies: [],
      appendedRevealQueueItems: [item],
      appendedMemoryMarkers: [],
      appendedWitnesses: [],
    });

    return this.prune(next, now);
  }

  public enqueueMarkerReveal(
    room: ShadowContract.ChatShadowRoomSnapshot,
    marker: ShadowContract.ChatShadowMemoryMarker,
    context: {
      now?: UnixMs;
      targetId?: string;
      trigger?: ShadowContract.ChatShadowRevealTrigger;
      priority?: ShadowContract.ChatShadowPriorityBand;
      revealAt?: UnixMs;
    } = {},
  ): ShadowContract.ChatShadowRoomSnapshot {
    const now = context.now ?? nowUnixMs();
    const revealAt = context.revealAt ?? asUnixMs(Number(now) + this.options.armLeadMs + this.options.readyLeadMs);
    const item = ShadowContract.createShadowRevealQueueItem({
      id: `marker-reveal:${marker.id}`,
      lane: marker.lane,
      createdAt: toIso(now),
      provenance: marker.provenance,
      queueId: `queue:${room.roomId}:${marker.lane}`,
      revealId: `reveal:${marker.markerId}`,
      targetKind: 'VISIBLE_CHANNEL',
      targetId: context.targetId,
      revealTrigger: context.trigger ?? 'SCENE_PHASE',
      readyAt: toIso(revealAt),
      revealAt: toIso(revealAt),
      expiresAt: toIso(asUnixMs(Number(revealAt) + this.options.expiryGraceMs)),
      priority: context.priority ?? 'NORMAL',
    });

    const next = ShadowContract.foldShadowDelta(room, {
      roomId: room.roomId,
      updatedAt: toIso(now),
      appendedAnchors: [],
      appendedSuppressedReplies: [],
      appendedRevealQueueItems: [item],
      appendedMemoryMarkers: [],
      appendedWitnesses: [],
    });

    return this.prune(next, now);
  }

  public cancelByLane(
    room: ShadowContract.ChatShadowRoomSnapshot,
    lane: ShadowContract.ChatShadowLane,
    now: UnixMs = nowUnixMs(),
  ): ShadowContract.ChatShadowRoomSnapshot {
    const next: ShadowContract.ChatShadowRoomSnapshot = {
      ...room,
      revealQueue: room.revealQueue.filter((item) => item.lane !== lane),
      updatedAt: toIso(now),
    };
    this.pushDebug(room.roomId, 'cancelByLane', { lane });
    return next;
  }

  public poll(
    state: ChatEngineState,
    room: ShadowContract.ChatShadowRoomSnapshot,
    context: {
      now?: UnixMs;
      pressureTier?: PressureTier;
      tickTier?: TickTier;
      featureSnapshot?: ChatFeatureSnapshot;
      currentSilence?: ChatSilenceDecision;
      activeCounterWindow?: Nullable<ChatCounterplayWindow>;
      activeScene?: Nullable<ChatScenePlan>;
      bluffExposed?: boolean;
      runEnding?: boolean;
      collapseDetected?: boolean;
      comebackDetected?: boolean;
    } = {},
  ): RevealQueuePollResult {
    const now = context.now ?? nowUnixMs();
    const kept: RevealQueueTicket[] = [];
    const expired: RevealQueueTicket[] = [];
    const cancelled: RevealQueueTicket[] = [];
    const releases: RevealQueueRelease[] = [];

    const sorted = [...room.revealQueue].sort((a, b) => this.compareQueueItems(a, b, { now, room, state, context }));

    for (const item of sorted) {
      const decision = this.evaluateDecision(item, { now, room, state, context });
      const ticket: RevealQueueTicket = {
        queueId: item.queueId,
        roomId: room.roomId,
        item,
        insertedAt: Date.parse(item.createdAt) as UnixMs,
        score: this.scoreItem(item, { now, room, state, context }),
        decision: decision.decision,
        decisionReason: decision.reason,
      };

      switch (decision.decision) {
        case 'EXPIRE':
          expired.push(ticket);
          break;
        case 'CANCEL':
          cancelled.push(ticket);
          break;
        case 'RELEASE':
          if (releases.length < this.options.maxReleasesPerPoll && this.respectsSpacing(room.roomId, now)) {
            const reveal: ChatRevealSchedule = {
              revealAt: now,
              revealChannel: inferVisibleRevealChannel(item),
              revealReason: toRevealReason(item),
            } as ChatRevealSchedule;
            releases.push({
              roomId: room.roomId,
              item,
              reveal,
              releaseReason: decision.reason,
              score: ticket.score,
            });
            this.lastReleaseAtByRoom.set(room.roomId, now);
          } else {
            kept.push({ ...ticket, decision: 'READY' });
          }
          break;
        default:
          kept.push(ticket);
          break;
      }
    }

    let nextState = state;
    for (const release of releases) {
      nextState = ChatStateModel.scheduleRevealInState(nextState, release.reveal);
    }

    this.pushDebug(room.roomId, 'poll', {
      releases: releases.length,
      kept: kept.length,
      expired: expired.length,
      cancelled: cancelled.length,
    });

    return {
      state: nextState,
      releases,
      kept,
      expired,
      cancelled,
    };
  }

  public applyPollResult(
    room: ShadowContract.ChatShadowRoomSnapshot,
    poll: RevealQueuePollResult,
    now: UnixMs = nowUnixMs(),
  ): ShadowContract.ChatShadowRoomSnapshot {
    const cancelledIds = new Set<string>([
      ...poll.expired.map((ticket) => ticket.item.id),
      ...poll.cancelled.map((ticket) => ticket.item.id),
      ...poll.releases.map((release) => release.item.id),
    ]);

    const queue = room.revealQueue.filter((item) => !cancelledIds.has(item.id));
    return this.prune(
      {
        ...room,
        revealQueue: queue,
        updatedAt: toIso(now),
      },
      now,
    );
  }

  public materializeFromPoll(
    state: ChatEngineState,
    room: ShadowContract.ChatShadowRoomSnapshot,
    context: Parameters<RevealQueue['poll']>[2] = {},
  ): {
    state: ChatEngineState;
    room: ShadowContract.ChatShadowRoomSnapshot;
    poll: RevealQueuePollResult;
  } {
    const poll = this.poll(state, room, context);
    const nextRoom = this.applyPollResult(room, poll, context.now ?? nowUnixMs());
    return {
      state: poll.state,
      room: nextRoom,
      poll,
    };
  }



  public buildRoomDiagnostics(
    room: ShadowContract.ChatShadowRoomSnapshot,
    state?: ChatEngineState,
  ): RevealQueueRoomDiagnostics {
    const shot = this.projectSnapshot(room, state);
    const lines: string[] = [];
    lines.push(`queue.total=${shot.total}`);
    lines.push(`queue.pending=${shot.pending}`);
    lines.push(`queue.ready=${shot.ready}`);
    lines.push(`queue.releasable=${shot.releasable}`);
    lines.push(`queue.expired=${shot.expired}`);
    lines.push(`shadow.hiddenThreats=${ShadowContract.countHiddenThreatAnchors(room)}`);
    lines.push(`shadow.revealableSuppressed=${ShadowContract.countRevealableSuppressedReplies(room)}`);
    lines.push(`shadow.callbackAnchors=${ShadowContract.countCallbackAnchors(room)}`);
    lines.push(`shadow.rescuePressure=${ShadowContract.hasShadowRescuePressure(room)}`);
    lines.push(`shadow.negotiationTrap=${ShadowContract.hasShadowNegotiationTrap(room)}`);
    lines.push(`shadow.crowdBoil=${ShadowContract.hasShadowCrowdBoil(room)}`);
    lines.push(`shadow.witnesses=${room.witnesses.witnesses.length}`);

    return {
      roomId: room.roomId,
      snapshot: shot,
      hiddenThreatCount: ShadowContract.countHiddenThreatAnchors(room),
      revealableSuppressedCount: ShadowContract.countRevealableSuppressedReplies(room),
      callbackAnchorCount: ShadowContract.countCallbackAnchors(room),
      rescuePressureActive: ShadowContract.hasShadowRescuePressure(room),
      negotiationTrapActive: ShadowContract.hasShadowNegotiationTrap(room),
      crowdBoilActive: ShadowContract.hasShadowCrowdBoil(room),
      witnessDensity: room.witnesses.witnesses.length,
      lines,
    };
  }

  public buildAuthoritativeFramesFromReleases(
    releases: readonly RevealQueueRelease[],
    now: UnixMs = nowUnixMs(),
  ): readonly ChatAuthoritativeFrame[] {
    return releases.map((release, index) => ({
      channelId: release.reveal.revealChannel,
      syncedAt: asUnixMs(Number(now) + index),
      reveal: release.reveal,
    } as ChatAuthoritativeFrame));
  }

  public seedFromSuppressedReplies(
    room: ShadowContract.ChatShadowRoomSnapshot,
    now: UnixMs = nowUnixMs(),
  ): ShadowContract.ChatShadowRoomSnapshot {
    let next = room;
    for (const reply of room.suppressedReplies) {
      if (room.revealQueue.some((item) => item.revealId === `reveal:${reply.suppressionId}`)) continue;
      next = this.enqueueSuppressedReply(next, reply, {
        now,
        trigger: reply.reason === 'WAIT_FOR_COUNTER' ? 'COUNTER_WINDOW' : 'TIME',
      });
    }
    return next;
  }

  public reprioritizeForRescue(
    room: ShadowContract.ChatShadowRoomSnapshot,
    now: UnixMs = nowUnixMs(),
  ): ShadowContract.ChatShadowRoomSnapshot {
    if (!ShadowContract.hasShadowRescuePressure(room)) return room;

    const queue = room.revealQueue.map((item) => {
      if (item.lane !== 'RESCUE_SHADOW') return item;
      return {
        ...item,
        priority: item.priority === 'OVERRIDE' ? 'OVERRIDE' : 'CRITICAL',
        readyAt: item.readyAt ?? toIso(now),
        revealAt: item.revealAt ?? toIso(now),
      };
    });

    return {
      ...room,
      revealQueue: queue,
      updatedAt: toIso(now),
    };
  }

  public foldExternalFrames(
    state: ChatEngineState,
    frames: readonly ChatAuthoritativeFrame[],
  ): ChatEngineState {
    let next = state;
    for (const frame of frames) {
      next = ChatStateModel.applyAuthoritativeFrameToState(next, {
        frame,
      } as Parameters<typeof ChatStateModel.applyAuthoritativeFrameToState>[1]);
    }
    return next;
  }

  public consumeDebugEvents(): readonly Array<{ at: UnixMs; roomId: string; event: string; detail?: JsonObject }> {
    const copy = this.debugEvents.map((event) => ({ ...event, detail: event.detail ? { ...event.detail } : undefined }));
    this.debugEvents.splice(0, this.debugEvents.length);
    return copy;
  }

  // ========================================================================
  // MARK: Internal decisioning
  // ========================================================================

  private evaluateDecision(
    item: ShadowContract.ChatShadowRevealQueueItem,
    params: {
      now: UnixMs;
      room: ShadowContract.ChatShadowRoomSnapshot;
      state: ChatEngineState;
      context: Parameters<RevealQueue['poll']>[2];
    },
  ): {
    decision: RevealQueueDecision;
    reason: RevealQueueReason;
  } {
    const { now, room, state, context } = params;
    const expiresAt = expiresAtOf(item);

    if (expiresAt && Number(expiresAt) + this.options.expiryGraceMs < Number(now)) {
      return { decision: 'EXPIRE', reason: 'TIME_DUE' };
    }

    if (context.currentSilence && item.lane === 'RIVALRY_SHADOW') {
      return { decision: 'KEEP_PENDING', reason: 'SILENCE_BROKEN' };
    }

    if (item.lane === 'NEGOTIATION_SHADOW' && state.offerState?.stance === 'PROBING') {
      return { decision: 'KEEP_PENDING', reason: 'NEGOTIATION_RESPONSE' };
    }

    if (context.bluffExposed && item.lane === 'NEGOTIATION_SHADOW') {
      return { decision: 'RELEASE', reason: 'BLUFF_EXPOSED' };
    }

    if (context.runEnding) {
      return { decision: 'RELEASE', reason: 'RUN_END' };
    }

    if (context.collapseDetected && item.lane === 'RESCUE_SHADOW') {
      return { decision: 'RELEASE', reason: 'PLAYER_COLLAPSE' };
    }

    if (context.comebackDetected && item.lane === 'RIVALRY_SHADOW') {
      return { decision: 'RELEASE', reason: 'PLAYER_COMEBACK' };
    }

    if (context.activeCounterWindow && item.revealTrigger === 'COUNTER_WINDOW') {
      return { decision: 'RELEASE', reason: 'COUNTER_WINDOW_OPEN' };
    }

    if (this.isReleasable(item, now, room, state)) {
      return { decision: 'RELEASE', reason: 'TIME_DUE' };
    }

    if (this.isReady(item, now)) {
      return { decision: 'READY', reason: 'TIME_DUE' };
    }

    if (this.isArmed(item, now)) {
      return { decision: 'ARM', reason: 'TIME_DUE' };
    }

    return { decision: 'KEEP_PENDING', reason: 'SCENE_PHASE' };
  }

  private scoreItem(
    item: ShadowContract.ChatShadowRevealQueueItem,
    params: {
      now: UnixMs;
      room: ShadowContract.ChatShadowRoomSnapshot;
      state?: ChatEngineState;
      context?: Parameters<RevealQueue['poll']>[2];
    },
  ): number {
    const revealAt = revealAtOf(item, params.now);
    const timeUntil = Math.max(Number(revealAt) - Number(params.now), 0);
    const timeScore = 100 - Math.min(timeUntil / 100, 100);
    let score = timeScore;
    score += laneBoost(item, this.options);

    if (item.priority === 'CRITICAL') score += 18;
    if (item.priority === 'OVERRIDE') score += 26;
    if (item.priority === 'BACKGROUND') score -= 20;

    if (params.context?.currentSilence && item.lane === 'RIVALRY_SHADOW') {
      score -= this.options.rivalryPenaltyDuringSilence;
    }

    if (params.context?.featureSnapshot?.globalCrowdHeatScore && item.lane === 'CROWD_SHADOW') {
      score += Number(params.context.featureSnapshot.globalCrowdHeatScore) / 8;
    }

    if (params.state?.offerState?.stance === 'PROBING' && item.lane === 'NEGOTIATION_SHADOW') {
      score -= this.options.negotiationPenaltyDuringProbe;
    }

    if (item.lane === 'RESCUE_SHADOW' && ShadowContract.hasShadowRescuePressure(params.room)) {
      score += this.options.rescuePreemptionBoost / 2;
    }

    if (item.lane === 'CROWD_SHADOW' && !ShadowContract.hasShadowCrowdBoil(params.room)) {
      score -= this.options.crowdPenaltyDuringQuiet;
    }

    return score;
  }

  private compareQueueItems(
    a: ShadowContract.ChatShadowRevealQueueItem,
    b: ShadowContract.ChatShadowRevealQueueItem,
    params: {
      now: UnixMs;
      room: ShadowContract.ChatShadowRoomSnapshot;
      state: ChatEngineState;
      context: Parameters<RevealQueue['poll']>[2];
    },
  ): number {
    const aScore = this.scoreItem(a, params);
    const bScore = this.scoreItem(b, params);
    if (aScore !== bScore) return bScore - aScore;
    return Number(revealAtOf(a, params.now)) - Number(revealAtOf(b, params.now));
  }

  private isArmed(item: ShadowContract.ChatShadowRevealQueueItem, now: UnixMs): boolean {
    const revealAt = revealAtOf(item, now);
    return Number(revealAt) - Number(now) <= this.options.armLeadMs;
  }

  private isReady(item: ShadowContract.ChatShadowRevealQueueItem, now: UnixMs): boolean {
    const revealAt = revealAtOf(item, now);
    return Number(revealAt) - Number(now) <= this.options.readyLeadMs;
  }

  private isReleasable(
    item: ShadowContract.ChatShadowRevealQueueItem,
    now: UnixMs,
    room: ShadowContract.ChatShadowRoomSnapshot,
    state?: ChatEngineState,
  ): boolean {
    if (!ShadowContract.shadowLaneCanReveal(item.lane)) return false;
    const revealAt = revealAtOf(item, now);
    if (Number(revealAt) > Number(now)) return false;
    if (item.lane === 'RESCUE_SHADOW' && state?.currentSilence?.reason === 'POST_COLLAPSE_BREATH') {
      return false;
    }
    if (item.lane === 'NEGOTIATION_SHADOW' && state?.offerState?.readPressureActive) {
      return false;
    }
    if (item.lane === 'CROWD_SHADOW' && !ShadowContract.hasShadowCrowdBoil(room)) {
      return false;
    }
    return true;
  }

  private respectsSpacing(roomId: string, now: UnixMs): boolean {
    const last = this.lastReleaseAtByRoom.get(roomId);
    if (!last) return true;
    return Number(now) - Number(last) >= this.options.releaseSpacingMs;
  }

  private prune(room: ShadowContract.ChatShadowRoomSnapshot, now: UnixMs): ShadowContract.ChatShadowRoomSnapshot {
    const queue = room.revealQueue
      .filter((item) => {
        const expiresAt = expiresAtOf(item);
        if (!expiresAt) return true;
        return Number(expiresAt) + this.options.expiryGraceMs >= Number(now);
      })
      .slice(-this.options.maxItems);

    return {
      ...room,
      revealQueue: queue,
      updatedAt: toIso(now),
    };
  }

  private pushDebug(roomId: string, event: string, detail?: JsonObject): void {
    this.debugEvents.push({ at: nowUnixMs(), roomId, event, detail });
    if (this.debugEvents.length > 512) {
      this.debugEvents.splice(0, this.debugEvents.length - 512);
    }

    if (this.options.debugEcho) {
      // eslint-disable-next-line no-console
      console.debug('[RevealQueue]', roomId, event, detail ?? {});
    }
  }
}

// ============================================================================
// MARK: Free functions and module surface
// ============================================================================

export function createRevealQueue(options: RevealQueueOptions = {}): RevealQueue {
  return new RevealQueue(options);
}

export const RevealQueueModule = Object.freeze({
  displayName: 'RevealQueue',
  file: 'pzo-web/src/engines/chat/shadow/RevealQueue.ts',
  category: 'frontend-chat-shadow-runtime',
  authorities: {
    frontend: '/pzo-web/src/engines/chat/shadow',
    backend: '/backend/src/game/engine/chat/shadow',
    shared: '/shared/contracts/chat',
  },
  create: createRevealQueue,
});
