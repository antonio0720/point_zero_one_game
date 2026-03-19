/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT SHADOW STATE MIRROR
 * FILE: pzo-web/src/engines/chat/shadow/ShadowStateMirror.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend runtime mirror for hidden chat state.
 *
 * This module exists because visible transcript state is not the whole war.
 * The frontend needs a deterministic mirror for invisible pressure so it can:
 * - retain authored shadow intent without spamming the transcript,
 * - keep reveal queues, suppressed replies, and witness pressure coherent,
 * - project hidden pressure into UI surfaces without mutating truth,
 * - preserve continuity between silence, rescue, rivalry, and deal-room lanes,
 * - stage revealable effects before the backend authoritatively materializes them,
 * - let debug/dev/QA tooling inspect latent forces without cracking runtime internals.
 *
 * Design doctrine
 * ---------------
 * - Hidden state is authored state.
 * - Mirror does not claim permanent authority over transcript truth.
 * - Backend remains sovereign over final replay, moderation, and long-lived history.
 * - Frontend mirror must still be deterministic, auditable, and serializable.
 * - Shadow pressure should feel inevitable, not random.
 * - Every latent effect needs provenance and a release path.
 * ============================================================================
 */

import * as ShadowContract from '../../../../shared/contracts/chat/ChatShadowState';
import * as ChatStateModel from '../ChatState';

import {
  CHAT_SHADOW_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
  type ChatAuthoritativeFrame,
  type ChatAffectSnapshot,
  type ChatChannelId,
  type ChatEngineState,
  type ChatFeatureSnapshot,
  type ChatLiveOpsState,
  type ChatMessage,
  type ChatMessageId,
  type ChatRevealSchedule,
  type ChatScenePlan,
  type ChatSilenceDecision,
  type ChatVisibleChannel,
  type JsonObject,
  type Nullable,
  type Percentage,
  type PressureTier,
  type Score100,
  type TickTier,
  type UnixMs,
} from '../types';

// ============================================================================
// MARK: Local mirror contracts
// ============================================================================

export type ShadowMirrorEventKind =
  | 'FRAME_INGESTED'
  | 'PRESSURE_SEEDED'
  | 'SUPPRESSION_STAGED'
  | 'REVEAL_STAGED'
  | 'MEMORY_MARKER_STAGED'
  | 'WITNESS_RECOMPUTED'
  | 'ROOM_PRUNED'
  | 'QUEUE_RELEASED'
  | 'QUEUE_CANCELLED'
  | 'QUEUE_EXPIRED'
  | 'DIAGNOSTICS_BUILT';

export interface ShadowMirrorOptions {
  readonly defaultRoomId?: string;
  readonly defaultRunId?: string;
  readonly maxAnchorsPerRoom?: number;
  readonly maxSuppressedRepliesPerRoom?: number;
  readonly maxRevealQueueItemsPerRoom?: number;
  readonly maxMarkersPerRoom?: number;
  readonly maxWitnessesPerRoom?: number;
  readonly queueArmLeadMs?: number;
  readonly queueReadyLeadMs?: number;
  readonly queueExpiryPadMs?: number;
  readonly staleAnchorMs?: number;
  readonly staleWitnessMs?: number;
  readonly staleMarkerMs?: number;
  readonly diagnosticsPressureWarnThreshold?: number;
  readonly diagnosticsRevealWarnThreshold?: number;
  readonly promoteCrowdHeatThreshold?: number;
  readonly promoteRescuePressureThreshold?: number;
  readonly debugEcho?: boolean;
}

export interface ShadowMirrorContext {
  readonly roomId?: string;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly now?: UnixMs;
}

export interface ShadowMirrorEvent {
  readonly kind: ShadowMirrorEventKind;
  readonly at: UnixMs;
  readonly roomId: string;
  readonly detail?: JsonObject;
}

export interface ShadowMirrorObservation {
  readonly roomId: string;
  readonly preview: ShadowContract.ChatShadowRoomPreview;
  readonly diagnostics: ShadowContract.ChatShadowDiagnostics;
  readonly hiddenThreatCount: number;
  readonly revealableSuppressedCount: number;
  readonly callbackAnchorCount: number;
  readonly rescuePressureActive: boolean;
  readonly negotiationTrapActive: boolean;
  readonly crowdBoilActive: boolean;
}

export interface ShadowMirrorReleaseEnvelope {
  readonly roomId: string;
  readonly item: ShadowContract.ChatShadowRevealQueueItem;
  readonly reveal: ChatRevealSchedule;
  readonly sourceLane: ShadowContract.ChatShadowLane;
  readonly releaseAt: UnixMs;
}

export interface ShadowMirrorDiagnosticsBundle {
  readonly roomId: string;
  readonly diagnostics: ShadowContract.ChatShadowDiagnostics;
  readonly preview: ShadowContract.ChatShadowRoomPreview;
  readonly queueSummary: ShadowContract.ChatShadowQueueSummary;
}

export interface ShadowMirrorMaterializeResult {
  readonly state: ChatEngineState;
  readonly released: readonly ShadowMirrorReleaseEnvelope[];
  readonly room?: ShadowContract.ChatShadowRoomSnapshot;
}

export interface ShadowMirrorSuppressionParams extends ShadowMirrorContext {
  readonly lane: ShadowContract.ChatShadowLane;
  readonly channelId?: ChatChannelId;
  readonly sourceKind: ShadowContract.ChatShadowSourceKind;
  readonly sourceId: string;
  readonly actorId: string;
  readonly reason: ShadowContract.ChatShadowSuppressionReason;
  readonly body: string;
  readonly targetKind?: ShadowContract.ChatShadowSuppressedReply['targetKind'];
  readonly targetId?: string;
  readonly readyAt?: UnixMs;
  readonly revealAt?: UnixMs;
  readonly notes?: readonly string[];
}

export interface ShadowMirrorPressureParams extends ShadowMirrorContext {
  readonly lane: ShadowContract.ChatShadowLane;
  readonly sourceKind: ShadowContract.ChatShadowSourceKind;
  readonly sourceId: string;
  readonly pressureKind: ShadowContract.ChatShadowPressureKind;
  readonly hostility?: number;
  readonly intimidation?: number;
  readonly ridicule?: number;
  readonly judgment?: number;
  readonly panic?: number;
  readonly rescuePull?: number;
  readonly crowdHeat?: number;
  readonly rivalry?: number;
  readonly negotiation?: number;
  readonly liveOps?: number;
  readonly holdUntil?: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly notes?: readonly string[];
}

export interface ShadowMirrorMarkerParams extends ShadowMirrorContext {
  readonly lane: ShadowContract.ChatShadowLane;
  readonly sourceKind: ShadowContract.ChatShadowSourceKind;
  readonly sourceId: string;
  readonly markerKind: ShadowContract.ChatShadowMarkerKind;
  readonly label: string;
  readonly excerpt?: string;
  readonly salience?: number;
  readonly callbackId?: string;
  readonly notes?: readonly string[];
}

// ============================================================================
// MARK: Constants and helpers
// ============================================================================

const DEFAULT_OPTIONS: Required<ShadowMirrorOptions> = Object.freeze({
  defaultRoomId: 'room:frontend-shadow-default',
  defaultRunId: 'run:frontend-shadow-default',
  maxAnchorsPerRoom: 384,
  maxSuppressedRepliesPerRoom: 256,
  maxRevealQueueItemsPerRoom: 256,
  maxMarkersPerRoom: 256,
  maxWitnessesPerRoom: 64,
  queueArmLeadMs: 400,
  queueReadyLeadMs: 80,
  queueExpiryPadMs: 30_000,
  staleAnchorMs: 15 * 60_000,
  staleWitnessMs: 8 * 60_000,
  staleMarkerMs: 30 * 60_000,
  diagnosticsPressureWarnThreshold: 70,
  diagnosticsRevealWarnThreshold: 16,
  promoteCrowdHeatThreshold: 66,
  promoteRescuePressureThreshold: 64,
  debugEcho: false,
});

function nowUnixMs(): UnixMs {
  return Date.now() as UnixMs;
}

function toIso(value: UnixMs): string {
  return new Date(Number(value)).toISOString();
}

function fromMaybeUnix(value?: UnixMs): string | undefined {
  return value ? toIso(value) : undefined;
}

function asUnixMs(value: number): UnixMs {
  return value as UnixMs;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clamp100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function pct(value: number): Percentage {
  return clamp100(value) as Percentage;
}

function score100(value: number): Score100 {
  return clamp100(value) as Score100;
}

function stableId(prefix: string, parts: readonly unknown[]): string {
  const flat = parts
    .map((part) => String(part ?? ''))
    .join('|')
    .replace(/[^a-zA-Z0-9:_|-]+/g, '_');
  return `${prefix}:${flat}`;
}

function normalizeOptions(options: ShadowMirrorOptions = {}): Required<ShadowMirrorOptions> {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

function createProvenance(params: {
  sourceKind: ShadowContract.ChatShadowSourceKind;
  sourceId: string;
  roomId: string;
  runId: string;
  sceneId?: string;
  momentId?: string;
}): ShadowContract.ChatShadowProvenance {
  return {
    sourceKind: params.sourceKind,
    sourceId: params.sourceId,
    roomId: params.roomId,
    runId: params.runId,
    sceneId: params.sceneId,
    momentId: params.momentId,
  };
}

function resolveRoomId(options: Required<ShadowMirrorOptions>, context?: ShadowMirrorContext): string {
  return context?.roomId || options.defaultRoomId;
}

function resolveRunId(options: Required<ShadowMirrorOptions>, context?: ShadowMirrorContext): string {
  return context?.runId || options.defaultRunId;
}

function isVisibleChannel(channel: ChatChannelId): channel is ChatVisibleChannel {
  return (CHAT_VISIBLE_CHANNELS as readonly string[]).includes(channel);
}

function toRevealReason(lane: ShadowContract.ChatShadowLane): ChatRevealSchedule['revealReason'] {
  switch (lane) {
    case 'RESCUE_SHADOW':
      return 'HELPER_RESCUE';
    case 'RIVALRY_SHADOW':
      return 'RIVALRY_ESCALATION';
    case 'LIVEOPS_SHADOW':
      return 'LIVEOPS_SEQUENCE';
    case 'NPC_SHADOW':
      return 'SCENE_REVEAL';
    case 'NEGOTIATION_SHADOW':
      return 'SCENE_REVEAL';
    case 'CROWD_SHADOW':
      return 'SCENE_REVEAL';
    case 'MEMORY_SHADOW':
      return 'SCENE_REVEAL';
    case 'WITNESS_SHADOW':
      return 'SCENE_REVEAL';
    default:
      return 'SYSTEM_DELAY';
  }
}

function inferVisibleRevealChannel(item: ShadowContract.ChatShadowRevealQueueItem): ChatVisibleChannel {
  const target = item.targetId;
  if (target && isVisibleChannel(target as ChatChannelId)) {
    return target as ChatVisibleChannel;
  }

  switch (item.lane) {
    case 'NEGOTIATION_SHADOW':
      return 'DEAL_ROOM';
    case 'RIVALRY_SHADOW':
      return 'GLOBAL';
    case 'RESCUE_SHADOW':
      return 'DIRECT';
    case 'CROWD_SHADOW':
      return 'GLOBAL';
    default:
      return 'GLOBAL';
  }
}

function inferRevealAt(item: ShadowContract.ChatShadowRevealQueueItem, now: UnixMs): UnixMs {
  if (item.revealAt) return Date.parse(item.revealAt) as UnixMs;
  if (item.readyAt) return Date.parse(item.readyAt) as UnixMs;
  return now;
}

function createReleaseEnvelope(
  roomId: string,
  item: ShadowContract.ChatShadowRevealQueueItem,
  now: UnixMs,
): ShadowMirrorReleaseEnvelope {
  const revealAt = inferRevealAt(item, now);
  const reveal: ChatRevealSchedule = {
    revealAt,
    revealChannel: inferVisibleRevealChannel(item),
    revealReason: toRevealReason(item.lane),
  } as ChatRevealSchedule;

  return {
    roomId,
    item,
    reveal,
    sourceLane: item.lane,
    releaseAt: revealAt,
  };
}

function coerceAffectFallback(): ChatAffectSnapshot {
  return {
    dominantEmotion: 'PRESSURED',
    confidenceScore: score100(50),
    intimidationScore: score100(45),
    frustrationScore: score100(40),
    trustScore: score100(50),
    attachmentScore: score100(35),
    embarrassmentScore: score100(30),
    reliefScore: score100(20),
    dominanceScore: score100(30),
    desperationScore: score100(25),
    updatedAt: nowUnixMs(),
  } as unknown as ChatAffectSnapshot;
}

function affectToPressureAnchor(
  affect: Nullable<ChatAffectSnapshot>,
  params: {
    roomId: string;
    runId: string;
    sceneId?: string;
    lane?: ShadowContract.ChatShadowLane;
    sourceKind?: ShadowContract.ChatShadowSourceKind;
    sourceId?: string;
  },
): ShadowContract.ChatShadowPressureAnchor {
  const safe = affect ?? coerceAffectFallback();
  const now = safe.updatedAt ?? nowUnixMs();
  return ShadowContract.createShadowPressureAnchor({
    id: stableId('shadow-affect', [params.roomId, params.runId, now]),
    lane: params.lane ?? 'SYSTEM_SHADOW',
    createdAt: toIso(now),
    provenance: createProvenance({
      sourceKind: params.sourceKind ?? 'SYSTEM',
      sourceId: params.sourceId ?? 'affect',
      roomId: params.roomId,
      runId: params.runId,
      sceneId: params.sceneId,
    }),
    pressureId: stableId('pressure', [params.roomId, params.runId, now]),
    pressureKind: 'HOSTILITY',
    hostility: Number(safe.intimidationScore ?? 0),
    intimidation: Number(safe.intimidationScore ?? 0),
    ridicule: Number(safe.embarrassmentScore ?? 0),
    judgment: Number(safe.frustrationScore ?? 0),
    panic: Number(safe.desperationScore ?? 0),
    rescuePull: 100 - Number(safe.trustScore ?? 50),
    crowdHeat: Number(safe.embarrassmentScore ?? 0),
    rivalry: Number(safe.dominanceScore ?? 0),
    negotiation: Number(safe.confidenceScore ?? 0),
  });
}

function shouldRecomputeWitnesses(frame: ChatAuthoritativeFrame): boolean {
  return Boolean(frame.messages?.length || frame.scene || frame.reveal || frame.silence);
}

function buildWitnessLabel(frame: ChatAuthoritativeFrame): string {
  if (frame.scene) return `scene:${frame.scene.sceneId}`;
  if (frame.reveal) return `reveal:${frame.reveal.revealReason}`;
  if (frame.silence) return `silence:${frame.silence.reason}`;
  return `channel:${frame.channelId}`;
}

// ============================================================================
// MARK: ShadowStateMirror
// ============================================================================

export class ShadowStateMirror {
  private readonly options: Required<ShadowMirrorOptions>;
  private readonly rooms = new Map<string, ShadowContract.ChatShadowRoomSnapshot>();
  private readonly events: ShadowMirrorEvent[] = [];

  public constructor(options: ShadowMirrorOptions = {}) {
    this.options = normalizeOptions(options);
  }

  public getOptions(): Required<ShadowMirrorOptions> {
    return { ...this.options };
  }

  public hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  public roomIds(): readonly string[] {
    return [...this.rooms.keys()];
  }

  public cloneRoom(roomId: string): ShadowContract.ChatShadowRoomSnapshot | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    return ShadowContract.foldShadowDelta(room, {
      roomId: room.roomId,
      updatedAt: room.updatedAt,
      appendedAnchors: [],
      appendedSuppressedReplies: [],
      appendedRevealQueueItems: [],
      appendedMemoryMarkers: [],
      appendedWitnesses: [],
    });
  }

  public ensureRoom(context: ShadowMirrorContext = {}): ShadowContract.ChatShadowRoomSnapshot {
    const roomId = resolveRoomId(this.options, context);
    const runId = resolveRunId(this.options, context);
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    const room = ShadowContract.createEmptyShadowRoomSnapshot({
      roomId,
      runId,
      sceneId: context.sceneId,
      createdAt: toIso(context.now ?? nowUnixMs()),
      thresholds: ShadowContract.CHAT_SHADOW_DEFAULT_THRESHOLDS,
    });
    this.rooms.set(roomId, room);
    return room;
  }

  public mirrorState(state: ChatEngineState, context: ShadowMirrorContext = {}): ShadowContract.ChatShadowRoomSnapshot {
    const roomId = resolveRoomId(this.options, context);
    const runId = resolveRunId(this.options, context);
    const now = context.now ?? nowUnixMs();

    const room = this.ensureRoom({ ...context, roomId, runId, now });
    let next = room;

    const affectAnchor = affectToPressureAnchor(state.affect, {
      roomId,
      runId,
      sceneId: state.activeScene?.sceneId ?? context.sceneId,
      lane: 'SYSTEM_SHADOW',
      sourceKind: 'SYSTEM',
      sourceId: 'frontend-state-affect',
    });

    const deltas: ShadowContract.ChatShadowDelta[] = [
      {
        roomId,
        updatedAt: toIso(now),
        appendedAnchors: [affectAnchor],
        appendedSuppressedReplies: [],
        appendedRevealQueueItems: [],
        appendedMemoryMarkers: [],
        appendedWitnesses: [],
      },
    ];

    if (state.currentSilence) {
      deltas.push(this.deltaFromSilence(roomId, runId, state.currentSilence, now, state.activeScene));
    }

    if (state.pendingReveals.length > 0) {
      deltas.push(this.deltaFromPendingReveals(roomId, runId, state.pendingReveals, now, state.activeScene));
    }

    if (this.hasElevatedCrowdHeat(state.featureSnapshot, state.liveOps)) {
      deltas.push(this.deltaFromCrowdHeat(roomId, runId, state, now));
    }

    if (state.shadowMessageCountByChannel.RESCUE_SHADOW > 0) {
      deltas.push(this.deltaFromRescueShadowCount(roomId, runId, state, now));
    }

    for (const delta of deltas) {
      next = ShadowContract.foldShadowDelta(next, delta);
    }

    next = this.recomputeWitnesses(next, {
      state,
      roomId,
      runId,
      now,
    });

    next = this.pruneRoom(next, now);
    this.rooms.set(roomId, next);
    this.pushEvent({
      kind: 'FRAME_INGESTED',
      at: now,
      roomId,
      detail: {
        mirrored: true,
        revealCount: state.pendingReveals.length,
        visibleActiveChannel: state.activeVisibleChannel,
      },
    });

    return next;
  }

  public ingestAuthoritativeFrame(
    state: ChatEngineState,
    frame: ChatAuthoritativeFrame,
    context: ShadowMirrorContext = {},
  ): ShadowContract.ChatShadowRoomSnapshot {
    const roomId = resolveRoomId(this.options, context);
    const runId = resolveRunId(this.options, context);
    const now = context.now ?? frame.syncedAt ?? nowUnixMs();
    let room = this.ensureRoom({ ...context, roomId, runId, now });

    const appendedAnchors: ShadowContract.ChatShadowPressureAnchor[] = [];
    const appendedSuppressedReplies: ShadowContract.ChatShadowSuppressedReply[] = [];
    const appendedRevealQueueItems: ShadowContract.ChatShadowRevealQueueItem[] = [];
    const appendedMemoryMarkers: ShadowContract.ChatShadowMemoryMarker[] = [];

    if ((CHAT_SHADOW_CHANNELS as readonly string[]).includes(frame.channelId)) {
      appendedAnchors.push(
        ShadowContract.createShadowPressureAnchor({
          id: stableId('shadow-frame-anchor', [roomId, frame.channelId, now]),
          lane: frame.channelId as ShadowContract.ChatShadowLane,
          createdAt: toIso(now),
          provenance: createProvenance({
            sourceKind: 'SYSTEM',
            sourceId: 'authoritative-frame',
            roomId,
            runId,
            sceneId: frame.scene?.sceneId ?? context.sceneId,
          }),
          pressureId: stableId('anchor', [roomId, frame.channelId, now]),
          pressureKind: 'HOSTILITY',
          hostility: 14,
          intimidation: 10,
          judgment: frame.messages?.length ? Math.min(frame.messages.length * 8, 70) : 8,
          crowdHeat: frame.channelId === 'LIVEOPS_SHADOW' ? 22 : 8,
          rescuePull: frame.channelId === 'RESCUE_SHADOW' ? 38 : 0,
          rivalry: frame.channelId === 'RIVALRY_SHADOW' ? 30 : 0,
          negotiation: frame.channelId === 'NEGOTIATION_SHADOW' ? 28 : 0,
          liveOps: frame.channelId === 'LIVEOPS_SHADOW' ? 40 : 0,
        }),
      );
    }

    if (frame.reveal) {
      appendedRevealQueueItems.push(
        ShadowContract.createShadowRevealQueueItem({
          id: stableId('shadow-frame-reveal', [roomId, frame.channelId, frame.reveal.revealReason, now]),
          lane: 'SYSTEM_SHADOW',
          createdAt: toIso(now),
          provenance: createProvenance({
            sourceKind: 'SYSTEM',
            sourceId: 'authoritative-reveal',
            roomId,
            runId,
            sceneId: frame.scene?.sceneId ?? context.sceneId,
          }),
          queueId: stableId('queue', [roomId, 'authoritative']),
          revealId: stableId('reveal', [roomId, frame.reveal.revealReason, now]),
          targetKind: 'VISIBLE_CHANNEL',
          targetId: frame.reveal.revealChannel,
          revealTrigger: 'EVENT',
          readyAt: toIso(frame.reveal.revealAt),
          revealAt: toIso(frame.reveal.revealAt),
          priority: 'HIGH',
        }),
      );
    }

    if (frame.silence) {
      appendedMemoryMarkers.push(
        ShadowContract.createShadowMemoryMarker({
          id: stableId('shadow-silence-marker', [roomId, frame.silence.reason, now]),
          lane: 'SYSTEM_SHADOW',
          createdAt: toIso(now),
          provenance: createProvenance({
            sourceKind: 'SYSTEM',
            sourceId: 'silence',
            roomId,
            runId,
            sceneId: frame.scene?.sceneId ?? context.sceneId,
          }),
          markerId: stableId('marker', [roomId, 'silence', now]),
          markerKind: 'THREAT',
          label: `Silence window: ${frame.silence.reason}`,
          excerpt: frame.silence.playerFacingLabel,
          salience: 62,
        }),
      );
    }

    if (frame.messages?.length) {
      for (const message of frame.messages) {
        const seed = this.seedFromMessage(roomId, runId, message, frame.channelId, frame.scene, now);
        if (seed.anchor) appendedAnchors.push(seed.anchor);
        if (seed.suppressed) appendedSuppressedReplies.push(seed.suppressed);
        if (seed.marker) appendedMemoryMarkers.push(seed.marker);
      }
    }

    room = ShadowContract.foldShadowDelta(room, {
      roomId,
      updatedAt: toIso(now),
      appendedAnchors,
      appendedSuppressedReplies,
      appendedRevealQueueItems,
      appendedMemoryMarkers,
      appendedWitnesses: [],
    });

    if (shouldRecomputeWitnesses(frame)) {
      room = this.recomputeWitnesses(room, {
        state,
        roomId,
        runId,
        now,
        frame,
      });
    }

    room = this.pruneRoom(room, now);
    this.rooms.set(roomId, room);

    this.pushEvent({
      kind: 'FRAME_INGESTED',
      at: now,
      roomId,
      detail: {
        channelId: frame.channelId,
        appendedAnchors: appendedAnchors.length,
        appendedSuppressedReplies: appendedSuppressedReplies.length,
        appendedRevealQueueItems: appendedRevealQueueItems.length,
        appendedMemoryMarkers: appendedMemoryMarkers.length,
      },
    });

    return room;
  }

  public stageSuppressedReply(params: ShadowMirrorSuppressionParams): ShadowContract.ChatShadowSuppressedReply {
    const roomId = resolveRoomId(this.options, params);
    const runId = resolveRunId(this.options, params);
    const now = params.now ?? nowUnixMs();
    const room = this.ensureRoom({ ...params, roomId, runId, now });

    const reply = ShadowContract.createShadowSuppressedReply({
      id: stableId('suppressed', [roomId, params.actorId, params.reason, now]),
      lane: params.lane,
      createdAt: toIso(now),
      provenance: createProvenance({
        sourceKind: params.sourceKind,
        sourceId: params.sourceId,
        roomId,
        runId,
        sceneId: params.sceneId,
        momentId: params.momentId,
      }),
      suppressionId: stableId('suppression', [roomId, params.actorId, now]),
      actorId: params.actorId,
      body: params.body,
      reason: params.reason,
      targetKind: params.targetKind ?? 'VISIBLE_CHANNEL',
      targetId: params.targetId ?? params.channelId,
      readyAt: fromMaybeUnix(params.readyAt),
      revealAt: fromMaybeUnix(params.revealAt),
      notes: params.notes,
    });

    const next = ShadowContract.foldShadowDelta(room, {
      roomId,
      updatedAt: toIso(now),
      appendedAnchors: [],
      appendedSuppressedReplies: [reply],
      appendedRevealQueueItems: [],
      appendedMemoryMarkers: [],
      appendedWitnesses: [],
    });

    this.rooms.set(roomId, this.pruneRoom(next, now));
    this.pushEvent({
      kind: 'SUPPRESSION_STAGED',
      at: now,
      roomId,
      detail: {
        lane: params.lane,
        actorId: params.actorId,
        reason: params.reason,
      },
    });

    return reply;
  }

  public stagePressureAnchor(params: ShadowMirrorPressureParams): ShadowContract.ChatShadowPressureAnchor {
    const roomId = resolveRoomId(this.options, params);
    const runId = resolveRunId(this.options, params);
    const now = params.now ?? nowUnixMs();
    const room = this.ensureRoom({ ...params, roomId, runId, now });

    const anchor = ShadowContract.createShadowPressureAnchor({
      id: stableId('anchor', [roomId, params.sourceId, params.pressureKind, now]),
      lane: params.lane,
      createdAt: toIso(now),
      updatedAt: toIso(now),
      provenance: createProvenance({
        sourceKind: params.sourceKind,
        sourceId: params.sourceId,
        roomId,
        runId,
        sceneId: params.sceneId,
        momentId: params.momentId,
      }),
      pressureId: stableId('pressure', [roomId, params.sourceId, now]),
      pressureKind: params.pressureKind,
      hostility: params.hostility,
      intimidation: params.intimidation,
      ridicule: params.ridicule,
      judgment: params.judgment,
      panic: params.panic,
      rescuePull: params.rescuePull,
      crowdHeat: params.crowdHeat,
      rivalry: params.rivalry,
      negotiation: params.negotiation,
      liveOps: params.liveOps,
      holdUntil: fromMaybeUnix(params.holdUntil),
      expiresAt: fromMaybeUnix(params.expiresAt),
      notes: params.notes,
    });

    const next = ShadowContract.foldShadowDelta(room, {
      roomId,
      updatedAt: toIso(now),
      appendedAnchors: [anchor],
      appendedSuppressedReplies: [],
      appendedRevealQueueItems: [],
      appendedMemoryMarkers: [],
      appendedWitnesses: [],
    });

    this.rooms.set(roomId, this.pruneRoom(next, now));
    this.pushEvent({
      kind: 'PRESSURE_SEEDED',
      at: now,
      roomId,
      detail: {
        lane: params.lane,
        pressureKind: params.pressureKind,
      },
    });

    return anchor;
  }

  public stageMemoryMarker(params: ShadowMirrorMarkerParams): ShadowContract.ChatShadowMemoryMarker {
    const roomId = resolveRoomId(this.options, params);
    const runId = resolveRunId(this.options, params);
    const now = params.now ?? nowUnixMs();
    const room = this.ensureRoom({ ...params, roomId, runId, now });

    const marker = ShadowContract.createShadowMemoryMarker({
      id: stableId('marker', [roomId, params.markerKind, params.label, now]),
      lane: params.lane,
      createdAt: toIso(now),
      provenance: createProvenance({
        sourceKind: params.sourceKind,
        sourceId: params.sourceId,
        roomId,
        runId,
        sceneId: params.sceneId,
        momentId: params.momentId,
      }),
      markerId: stableId('memory', [roomId, params.markerKind, now]),
      markerKind: params.markerKind,
      label: params.label,
      excerpt: params.excerpt,
      salience: params.salience,
      callbackId: params.callbackId,
      notes: params.notes,
    });

    const next = ShadowContract.foldShadowDelta(room, {
      roomId,
      updatedAt: toIso(now),
      appendedAnchors: [],
      appendedSuppressedReplies: [],
      appendedRevealQueueItems: [],
      appendedMemoryMarkers: [marker],
      appendedWitnesses: [],
    });

    this.rooms.set(roomId, this.pruneRoom(next, now));
    this.pushEvent({
      kind: 'MEMORY_MARKER_STAGED',
      at: now,
      roomId,
      detail: {
        lane: params.lane,
        markerKind: params.markerKind,
        label: params.label,
      },
    });

    return marker;
  }

  public releaseDueReveals(
    state: ChatEngineState,
    context: ShadowMirrorContext = {},
  ): ShadowMirrorMaterializeResult {
    const roomId = resolveRoomId(this.options, context);
    const now = context.now ?? nowUnixMs();
    const room = this.rooms.get(roomId);

    if (!room || room.revealQueue.length === 0) {
      return { state, released: [], room };
    }

    const released: ShadowMirrorReleaseEnvelope[] = [];
    const keep: ShadowContract.ChatShadowRevealQueueItem[] = [];

    for (const item of room.revealQueue) {
      const revealAt = inferRevealAt(item, now);
      const expiresAt = item.expiresAt ? (Date.parse(item.expiresAt) as UnixMs) : undefined;
      if (expiresAt && Number(expiresAt) < Number(now)) {
        this.pushEvent({
          kind: 'QUEUE_EXPIRED',
          at: now,
          roomId,
          detail: {
            revealId: item.revealId,
            lane: item.lane,
          },
        });
        continue;
      }

      if (Number(revealAt) <= Number(now) && ShadowContract.shadowLaneCanReveal(item.lane)) {
        released.push(createReleaseEnvelope(roomId, item, now));
      } else {
        keep.push(item);
      }
    }

    let nextState = state;
    for (const envelope of released) {
      nextState = ChatStateModel.scheduleRevealInState(nextState, envelope.reveal);
      this.pushEvent({
        kind: 'QUEUE_RELEASED',
        at: now,
        roomId,
        detail: {
          revealChannel: envelope.reveal.revealChannel,
          reason: envelope.reveal.revealReason,
          sourceLane: envelope.sourceLane,
        },
      });
    }

    const nextRoom: ShadowContract.ChatShadowRoomSnapshot = {
      ...room,
      revealQueue: keep,
      updatedAt: toIso(now),
    };

    this.rooms.set(roomId, this.pruneRoom(nextRoom, now));
    return {
      state: nextState,
      released,
      room: nextRoom,
    };
  }

  public buildObservation(roomId: string): ShadowMirrorObservation | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const preview = ShadowContract.toShadowRoomPreview(room);
    const diagnostics = ShadowContract.buildShadowDiagnostics(room);

    return {
      roomId,
      preview,
      diagnostics,
      hiddenThreatCount: ShadowContract.countHiddenThreatAnchors(room),
      revealableSuppressedCount: ShadowContract.countRevealableSuppressedReplies(room),
      callbackAnchorCount: ShadowContract.countCallbackAnchors(room),
      rescuePressureActive: ShadowContract.hasShadowRescuePressure(room),
      negotiationTrapActive: ShadowContract.hasShadowNegotiationTrap(room),
      crowdBoilActive: ShadowContract.hasShadowCrowdBoil(room),
    };
  }

  public buildDiagnostics(roomId: string): ShadowMirrorDiagnosticsBundle | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const bundle: ShadowMirrorDiagnosticsBundle = {
      roomId,
      diagnostics: ShadowContract.buildShadowDiagnostics(room),
      preview: ShadowContract.toShadowRoomPreview(room),
      queueSummary: ShadowContract.summarizeShadowQueue(room.revealQueue),
    };

    this.pushEvent({
      kind: 'DIAGNOSTICS_BUILT',
      at: nowUnixMs(),
      roomId,
      detail: {
        revealCount: bundle.queueSummary.total,
        visibleCount: bundle.queueSummary.visibleTargetCount,
      },
    });

    return bundle;
  }

  public consumeEvents(): readonly ShadowMirrorEvent[] {
    const copy = this.events.map((event) => ({ ...event, detail: event.detail ? { ...event.detail } : undefined }));
    this.events.splice(0, this.events.length);
    return copy;
  }

  public clearRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  public clearAll(): void {
    this.rooms.clear();
    this.events.splice(0, this.events.length);
  }

  // ========================================================================
  // MARK: Internal delta builders
  // ========================================================================

  private deltaFromSilence(
    roomId: string,
    runId: string,
    silence: ChatSilenceDecision,
    now: UnixMs,
    scene?: ChatScenePlan,
  ): ShadowContract.ChatShadowDelta {
    return {
      roomId,
      updatedAt: toIso(now),
      appendedAnchors: [
        ShadowContract.createShadowPressureAnchor({
          id: stableId('silence-anchor', [roomId, silence.reason, now]),
          lane: 'SYSTEM_SHADOW',
          createdAt: toIso(now),
          provenance: createProvenance({
            sourceKind: 'SYSTEM',
            sourceId: 'silence-state',
            roomId,
            runId,
            sceneId: scene?.sceneId,
          }),
          pressureId: stableId('pressure', [roomId, 'silence', now]),
          pressureKind: 'INTIMIDATION',
          intimidation: 25,
          judgment: 12,
          panic: silence.reason === 'POST_COLLAPSE_BREATH' ? 16 : 6,
          rescuePull: silence.reason === 'POST_COLLAPSE_BREATH' ? 28 : 0,
        }),
      ],
      appendedSuppressedReplies: [],
      appendedRevealQueueItems: [],
      appendedMemoryMarkers: [
        ShadowContract.createShadowMemoryMarker({
          id: stableId('silence-marker', [roomId, silence.reason, now]),
          lane: 'SYSTEM_SHADOW',
          createdAt: toIso(now),
          provenance: createProvenance({
            sourceKind: 'SYSTEM',
            sourceId: 'silence-state',
            roomId,
            runId,
            sceneId: scene?.sceneId,
          }),
          markerId: stableId('marker', [roomId, 'silence', now]),
          markerKind: 'THREAT',
          label: `Silence hold: ${silence.reason}`,
          excerpt: silence.playerFacingLabel,
          salience: 58,
        }),
      ],
      appendedWitnesses: [],
    };
  }

  private deltaFromPendingReveals(
    roomId: string,
    runId: string,
    reveals: readonly ChatRevealSchedule[],
    now: UnixMs,
    scene?: ChatScenePlan,
  ): ShadowContract.ChatShadowDelta {
    return {
      roomId,
      updatedAt: toIso(now),
      appendedAnchors: [],
      appendedSuppressedReplies: [],
      appendedRevealQueueItems: reveals.map((reveal, index) => ShadowContract.createShadowRevealQueueItem({
        id: stableId('pending-reveal', [roomId, reveal.revealChannel, reveal.revealReason, reveal.revealAt, index]),
        lane: reveal.revealReason === 'HELPER_RESCUE' ? 'RESCUE_SHADOW' : 'SYSTEM_SHADOW',
        createdAt: toIso(now),
        provenance: createProvenance({
          sourceKind: 'SYSTEM',
          sourceId: 'pending-reveals',
          roomId,
          runId,
          sceneId: scene?.sceneId,
        }),
        queueId: stableId('queue', [roomId, reveal.revealChannel]),
        revealId: stableId('reveal', [roomId, reveal.revealReason, index]),
        targetKind: 'VISIBLE_CHANNEL',
        targetId: reveal.revealChannel,
        revealTrigger: 'TIME',
        readyAt: toIso(reveal.revealAt),
        revealAt: toIso(reveal.revealAt),
        expiresAt: toIso(asUnixMs(Number(reveal.revealAt) + this.options.queueExpiryPadMs)),
        priority: reveal.revealReason === 'HELPER_RESCUE' ? 'CRITICAL' : 'HIGH',
      })),
      appendedMemoryMarkers: [],
      appendedWitnesses: [],
    };
  }

  private deltaFromCrowdHeat(
    roomId: string,
    runId: string,
    state: ChatEngineState,
    now: UnixMs,
  ): ShadowContract.ChatShadowDelta {
    const heat = Number(state.audienceHeat.GLOBAL?.heatScore ?? 0);
    return {
      roomId,
      updatedAt: toIso(now),
      appendedAnchors: [
        ShadowContract.createShadowPressureAnchor({
          id: stableId('crowd-heat', [roomId, now]),
          lane: 'CROWD_SHADOW',
          createdAt: toIso(now),
          provenance: createProvenance({
            sourceKind: 'CROWD',
            sourceId: 'audience-heat',
            roomId,
            runId,
            sceneId: state.activeScene?.sceneId,
          }),
          pressureId: stableId('pressure', [roomId, 'crowd-heat', now]),
          pressureKind: 'CROWD_HEAT',
          hostility: heat * 0.2,
          ridicule: heat * 0.35,
          judgment: heat * 0.25,
          crowdHeat: heat,
        }),
      ],
      appendedSuppressedReplies: [],
      appendedRevealQueueItems: [],
      appendedMemoryMarkers: [],
      appendedWitnesses: [],
    };
  }

  private deltaFromRescueShadowCount(
    roomId: string,
    runId: string,
    state: ChatEngineState,
    now: UnixMs,
  ): ShadowContract.ChatShadowDelta {
    const count = Number(state.shadowMessageCountByChannel.RESCUE_SHADOW ?? 0);
    return {
      roomId,
      updatedAt: toIso(now),
      appendedAnchors: [
        ShadowContract.createShadowPressureAnchor({
          id: stableId('rescue-shadow-count', [roomId, count, now]),
          lane: 'RESCUE_SHADOW',
          createdAt: toIso(now),
          provenance: createProvenance({
            sourceKind: 'RESCUE',
            sourceId: 'rescue-shadow-count',
            roomId,
            runId,
            sceneId: state.activeScene?.sceneId,
          }),
          pressureId: stableId('pressure', [roomId, 'rescue-shadow-count', now]),
          pressureKind: 'RESCUE_PULL',
          rescuePull: Math.min(count * 8, 80),
          panic: Math.min(count * 3, 40),
        }),
      ],
      appendedSuppressedReplies: [],
      appendedRevealQueueItems: [],
      appendedMemoryMarkers: [],
      appendedWitnesses: [],
    };
  }

  private seedFromMessage(
    roomId: string,
    runId: string,
    message: ChatMessage,
    channelId: ChatChannelId,
    scene: ChatScenePlan | undefined,
    now: UnixMs,
  ): {
    anchor?: ShadowContract.ChatShadowPressureAnchor;
    suppressed?: ShadowContract.ChatShadowSuppressedReply;
    marker?: ShadowContract.ChatShadowMemoryMarker;
  } {
    const body = message.body ?? '';
    const lc = body.toLowerCase();
    const result: {
      anchor?: ShadowContract.ChatShadowPressureAnchor;
      suppressed?: ShadowContract.ChatShadowSuppressedReply;
      marker?: ShadowContract.ChatShadowMemoryMarker;
    } = {};

    if (/(watch|wait|not yet|hold|later|soon)/.test(lc)) {
      result.suppressed = ShadowContract.createShadowSuppressedReply({
        id: stableId('message-suppressed', [roomId, message.id, now]),
        lane: 'SYSTEM_SHADOW',
        createdAt: toIso(now),
        provenance: createProvenance({
          sourceKind: 'NPC',
          sourceId: message.authorId,
          roomId,
          runId,
          sceneId: scene?.sceneId,
        }),
        suppressionId: stableId('suppression', [roomId, message.id]),
        actorId: message.authorId,
        body: body.slice(0, 180),
        reason: 'WAIT_FOR_BETTER_MOMENT',
        targetKind: 'VISIBLE_CHANNEL',
        targetId: channelId,
        readyAt: toIso(asUnixMs(Number(now) + this.options.queueArmLeadMs)),
        revealAt: toIso(asUnixMs(Number(now) + this.options.queueExpiryPadMs / 10)),
      });
    }

    if (/(bluff|trap|fold|liar|panic|mercy|debt|interest)/.test(lc)) {
      result.anchor = ShadowContract.createShadowPressureAnchor({
        id: stableId('message-anchor', [roomId, message.id, now]),
        lane: channelId === 'DEAL_ROOM' ? 'NEGOTIATION_SHADOW' : 'RIVALRY_SHADOW',
        createdAt: toIso(now),
        provenance: createProvenance({
          sourceKind: 'NPC',
          sourceId: message.authorId,
          roomId,
          runId,
          sceneId: scene?.sceneId,
        }),
        pressureId: stableId('pressure', [roomId, message.id]),
        pressureKind: channelId === 'DEAL_ROOM' ? 'NEGOTIATION' : 'RIVALRY',
        hostility: /(liar|panic)/.test(lc) ? 22 : 8,
        intimidation: /(mercy|debt|interest)/.test(lc) ? 18 : 6,
        ridicule: /(bluff|fold)/.test(lc) ? 16 : 0,
        judgment: /(trap)/.test(lc) ? 20 : 0,
        negotiation: channelId === 'DEAL_ROOM' ? 28 : 0,
        rivalry: channelId !== 'DEAL_ROOM' ? 24 : 0,
      });
    }

    if (message.legendMeta || /(remember|never forget|everyone saw)/.test(lc)) {
      result.marker = ShadowContract.createShadowMemoryMarker({
        id: stableId('message-marker', [roomId, message.id, now]),
        lane: 'MEMORY_SHADOW',
        createdAt: toIso(now),
        provenance: createProvenance({
          sourceKind: 'MEMORY',
          sourceId: message.authorId,
          roomId,
          runId,
          sceneId: scene?.sceneId,
        }),
        markerId: stableId('marker', [roomId, message.id]),
        markerKind: 'CALLBACK',
        label: `Message memory: ${message.authorId}`,
        excerpt: body.slice(0, 180),
        salience: message.legendMeta ? 82 : 56,
      });
    }

    return result;
  }

  private recomputeWitnesses(
    room: ShadowContract.ChatShadowRoomSnapshot,
    params: {
      state: ChatEngineState;
      roomId: string;
      runId: string;
      now: UnixMs;
      frame?: ChatAuthoritativeFrame;
    },
  ): ShadowContract.ChatShadowRoomSnapshot {
    const witnessSeed = room.anchors.map((anchor, index): ShadowContract.ChatShadowWitness => ({
      witnessId: stableId('witness', [params.roomId, anchor.id, index]),
      sourceKind: anchor.provenance.sourceKind,
      sourceId: anchor.provenance.sourceId,
      label: buildWitnessLabel(params.frame ?? ({ channelId: params.state.activeVisibleChannel } as ChatAuthoritativeFrame)),
      observedAt: anchor.updatedAt,
      intensity: pct(
        clamp100(
          Number(anchor.pressure.crowdHeat) +
          Number(anchor.pressure.hostility) +
          Number(anchor.pressure.ridicule),
        ) / 3,
      ),
    }));

    const envelope = ShadowContract.computeShadowWitnessEnvelope(
      witnessSeed.slice(-this.options.maxWitnessesPerRoom),
    );

    const next: ShadowContract.ChatShadowRoomSnapshot = {
      ...room,
      witnesses: envelope,
      updatedAt: toIso(params.now),
    };

    this.pushEvent({
      kind: 'WITNESS_RECOMPUTED',
      at: params.now,
      roomId: params.roomId,
      detail: {
        witnessCount: envelope.witnesses.length,
      },
    });

    return next;
  }

  private pruneRoom(
    room: ShadowContract.ChatShadowRoomSnapshot,
    now: UnixMs,
  ): ShadowContract.ChatShadowRoomSnapshot {
    const staleAnchorBefore = Number(now) - this.options.staleAnchorMs;
    const staleWitnessBefore = Number(now) - this.options.staleWitnessMs;
    const staleMarkerBefore = Number(now) - this.options.staleMarkerMs;

    const anchors = room.anchors
      .filter((anchor) => Date.parse(anchor.updatedAt) >= staleAnchorBefore)
      .slice(-this.options.maxAnchorsPerRoom);

    const suppressedReplies = room.suppressedReplies
      .filter((reply) => {
        if (reply.revealAt) return Date.parse(reply.revealAt) + this.options.queueExpiryPadMs >= Number(now);
        return true;
      })
      .slice(-this.options.maxSuppressedRepliesPerRoom);

    const revealQueue = room.revealQueue
      .filter((item) => {
        if (item.expiresAt) return Date.parse(item.expiresAt) >= Number(now);
        return true;
      })
      .slice(-this.options.maxRevealQueueItemsPerRoom);

    const memoryMarkers = room.memoryMarkers
      .filter((marker) => Date.parse(marker.updatedAt) >= staleMarkerBefore)
      .slice(-this.options.maxMarkersPerRoom);

    const witnesses = {
      ...room.witnesses,
      witnesses: room.witnesses.witnesses
        .filter((witness) => Date.parse(witness.observedAt) >= staleWitnessBefore)
        .slice(-this.options.maxWitnessesPerRoom),
      updatedAt: toIso(now),
    };

    const next: ShadowContract.ChatShadowRoomSnapshot = {
      ...room,
      anchors,
      suppressedReplies,
      revealQueue,
      memoryMarkers,
      witnesses,
      updatedAt: toIso(now),
    };

    if (
      anchors.length !== room.anchors.length ||
      suppressedReplies.length !== room.suppressedReplies.length ||
      revealQueue.length !== room.revealQueue.length ||
      memoryMarkers.length !== room.memoryMarkers.length ||
      witnesses.witnesses.length !== room.witnesses.witnesses.length
    ) {
      this.pushEvent({
        kind: 'ROOM_PRUNED',
        at: now,
        roomId: room.roomId,
        detail: {
          anchors: anchors.length,
          suppressedReplies: suppressedReplies.length,
          revealQueue: revealQueue.length,
          memoryMarkers: memoryMarkers.length,
          witnesses: witnesses.witnesses.length,
        },
      });
    }

    return next;
  }

  private hasElevatedCrowdHeat(
    featureSnapshot: Nullable<ChatFeatureSnapshot>,
    liveOps: ChatLiveOpsState,
  ): boolean {
    const crowd = Number(featureSnapshot?.globalCrowdHeatScore ?? 0);
    const liveOpsIntensity = Number(liveOps.activeWorldEvent?.intensity ?? 0);
    return crowd >= this.options.promoteCrowdHeatThreshold || liveOpsIntensity >= this.options.promoteCrowdHeatThreshold;
  }

  private pushEvent(event: ShadowMirrorEvent): void {
    this.events.push(event);
    if (this.events.length > 512) {
      this.events.splice(0, this.events.length - 512);
    }

    if (this.options.debugEcho) {
      // eslint-disable-next-line no-console
      console.debug('[ShadowStateMirror]', event.kind, event.roomId, event.detail ?? {});
    }
  }
}

// ============================================================================
// MARK: Free functions and module surface
// ============================================================================

export function createShadowStateMirror(options: ShadowMirrorOptions = {}): ShadowStateMirror {
  return new ShadowStateMirror(options);
}

export const ShadowStateMirrorModule = Object.freeze({
  displayName: 'ShadowStateMirror',
  file: 'pzo-web/src/engines/chat/shadow/ShadowStateMirror.ts',
  category: 'frontend-chat-shadow-runtime',
  authorities: {
    frontend: '/pzo-web/src/engines/chat/shadow',
    backend: '/backend/src/game/engine/chat/shadow',
    shared: '/shared/contracts/chat',
  },
  create: createShadowStateMirror,
});
