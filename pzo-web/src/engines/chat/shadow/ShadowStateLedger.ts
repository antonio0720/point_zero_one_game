/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SHADOW STATE LEDGER
 * FILE: backend/src/game/engine/chat/shadow/ShadowStateLedger.ts
 * VERSION: 2026.03.19
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 */

import * as ShadowContract from '../../../../../../shared/contracts/chat/ChatShadowState';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type ChatRoomId = string;
export type UnixMs = number;

export interface ShadowStateLedgerClock {
  now(): number;
}

export interface ShadowStateLedgerLogger {
  debug(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(event: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ShadowStateLedgerOptions {
  readonly clock?: ShadowStateLedgerClock;
  readonly logger?: ShadowStateLedgerLogger;
  readonly maxRooms?: number;
  readonly maxAnchorsPerRoom?: number;
  readonly maxSuppressedRepliesPerRoom?: number;
  readonly maxRevealQueueItemsPerRoom?: number;
  readonly maxMemoryMarkersPerRoom?: number;
  readonly staleAnchorMs?: number;
  readonly staleSuppressedMs?: number;
  readonly staleRevealMs?: number;
  readonly staleMarkerMs?: number;
  readonly staleWitnessMs?: number;
  readonly pressureDecayHalfLifeMs?: number;
  readonly revealPromotionWindowMs?: number;
  readonly diagnosticsWarnPressure?: number;
  readonly diagnosticsWarnQueue?: number;
}

export interface ShadowLedgerWriteContext {
  readonly roomId: ChatRoomId;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly eventId?: string;
  readonly sourceKind?: ShadowContract.ChatShadowSourceKind;
  readonly sourceId?: string;
  readonly actorId?: string;
  readonly now?: UnixMs;
}

export interface ShadowLedgerRoomEnvelope {
  readonly roomId: ChatRoomId;
  readonly snapshot: ShadowContract.ChatShadowRoomSnapshot;
  readonly diagnostics: ShadowContract.ChatShadowDiagnostics;
  readonly preview: ShadowContract.ChatShadowRoomPreview;
  readonly queueSummary: ShadowContract.ChatShadowQueueSummary;
  readonly updatedAt: UnixMs;
}

export interface ShadowLedgerMutationReceipt {
  readonly roomId: ChatRoomId;
  readonly updatedAt: UnixMs;
  readonly diagnostics: ShadowContract.ChatShadowDiagnostics;
  readonly preview: ShadowContract.ChatShadowRoomPreview;
  readonly queueSummary: ShadowContract.ChatShadowQueueSummary;
  readonly hiddenThreatCount: number;
  readonly revealableSuppressedCount: number;
  readonly callbackAnchorCount: number;
}

export interface ShadowLedgerStagePressureParams extends ShadowLedgerWriteContext {
  readonly lane: ShadowContract.ChatShadowLane;
  readonly purpose?: ShadowContract.ChatShadowPurpose;
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
  readonly witness?: number;
  readonly priority?: ShadowContract.ChatShadowPriorityBand;
  readonly visibility?: ShadowContract.ChatShadowVisibility;
  readonly holdUntil?: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly notes?: readonly string[];
}

export interface ShadowLedgerStageSuppressedReplyParams extends ShadowLedgerWriteContext {
  readonly lane: ShadowContract.ChatShadowLane;
  readonly channelId?: string;
  readonly reason: ShadowContract.ChatShadowSuppressionReason;
  readonly body: string;
  readonly targetKind?: ShadowContract.ChatShadowSuppressedReply['targetKind'];
  readonly targetId?: string;
  readonly priority?: ShadowContract.ChatShadowPriorityBand;
  readonly readyAt?: UnixMs;
  readonly revealAt?: UnixMs;
  readonly notes?: readonly string[];
}

export interface ShadowLedgerStageRevealParams extends ShadowLedgerWriteContext {
  readonly lane: ShadowContract.ChatShadowLane;
  readonly purpose?: ShadowContract.ChatShadowPurpose;
  readonly sourceAtomKind: ShadowContract.ChatShadowRevealQueueItem['sourceAtomKind'];
  readonly sourceAtomId: string;
  readonly trigger: ShadowContract.ChatShadowRevealTrigger;
  readonly status?: ShadowContract.ChatShadowRevealStatus;
  readonly priority?: ShadowContract.ChatShadowPriorityBand;
  readonly channelId?: string;
  readonly deliverAt?: UnixMs;
  readonly armAt?: UnixMs;
  readonly readyAt?: UnixMs;
  readonly expiresAt?: UnixMs;
  readonly notes?: readonly string[];
}

export interface ShadowLedgerStageMarkerParams extends ShadowLedgerWriteContext {
  readonly lane: ShadowContract.ChatShadowLane;
  readonly purpose?: ShadowContract.ChatShadowPurpose;
  readonly kind: ShadowContract.ChatShadowMarkerKind;
  readonly anchorId?: string;
  readonly callbackId?: string;
  readonly messageId?: string;
  readonly proofId?: string;
  readonly legendId?: string;
  readonly rescueId?: string;
  readonly rivalryId?: string;
  readonly negotiationId?: string;
  readonly liveOpsId?: string;
  readonly payload?: Readonly<Record<string, JsonValue>>;
  readonly priority?: ShadowContract.ChatShadowPriorityBand;
  readonly visibility?: ShadowContract.ChatShadowVisibility;
  readonly notes?: readonly string[];
}

export interface ShadowLedgerHydrationEnvelope {
  readonly roomId: ChatRoomId;
  readonly snapshot: ShadowContract.ChatShadowRoomSnapshot;
  readonly replace?: boolean;
}

const DEFAULT_OPTIONS: Required<ShadowStateLedgerOptions> = Object.freeze({
  clock: { now: () => Date.now() },
  logger: { debug: () => undefined, info: () => undefined, warn: () => undefined },
  maxRooms: 256,
  maxAnchorsPerRoom: 96,
  maxSuppressedRepliesPerRoom: 96,
  maxRevealQueueItemsPerRoom: 128,
  maxMemoryMarkersPerRoom: 128,
  staleAnchorMs: 18 * 60_000,
  staleSuppressedMs: 18 * 60_000,
  staleRevealMs: 24 * 60_000,
  staleMarkerMs: 24 * 60_000,
  staleWitnessMs: 12 * 60_000,
  pressureDecayHalfLifeMs: 90_000,
  revealPromotionWindowMs: 4_000,
  diagnosticsWarnPressure: 72,
  diagnosticsWarnQueue: 24,
});

const LANE_SORT_ORDER: Readonly<Record<ShadowContract.ChatShadowLane, number>> = Object.freeze({
  SYSTEM_SHADOW: 1,
  NPC_SHADOW: 2,
  RIVALRY_SHADOW: 3,
  RESCUE_SHADOW: 4,
  LIVEOPS_SHADOW: 5,
  NEGOTIATION_SHADOW: 6,
  CROWD_SHADOW: 7,
  MEMORY_SHADOW: 8,
  WITNESS_SHADOW: 9,
  TRANSPORT_SHADOW: 10,
});

const PRIORITY_SORT_ORDER: Readonly<Record<ShadowContract.ChatShadowPriorityBand, number>> = Object.freeze({
  BACKGROUND: 1,
  LOW: 2,
  NORMAL: 3,
  HIGH: 4,
  CRITICAL: 5,
  OVERRIDE: 6,
});

const PRESSURE_FIELD_KEYS = [
  'hostility',
  'intimidation',
  'ridicule',
  'judgment',
  'panic',
  'rescuePull',
  'crowdHeat',
  'rivalry',
  'negotiation',
  'liveOps',
  'witness',
] as const;

type PressureFieldKey = typeof PRESSURE_FIELD_KEYS[number];

function nowMs(clock: ShadowStateLedgerClock): UnixMs {
  return clock.now() as UnixMs;
}

function asUnixMs(value: number): UnixMs {
  return value as UnixMs;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function stableSortByLaneAndPriority<T extends { lane: ShadowContract.ChatShadowLane; priority: ShadowContract.ChatShadowPriorityBand; createdAt: string }>(items: readonly T[]): readonly T[] {
  return [...items].sort((a, b) => {
    const laneDiff = LANE_SORT_ORDER[a.lane] - LANE_SORT_ORDER[b.lane];
    if (laneDiff !== 0) return laneDiff;
    const priorityDiff = PRIORITY_SORT_ORDER[b.priority] - PRIORITY_SORT_ORDER[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function shallowClonePayload(payload?: Readonly<Record<string, JsonValue>>): Readonly<Record<string, JsonValue>> | undefined {
  return payload ? Object.freeze({ ...payload }) : undefined;
}

function toDiagnostics(snapshot: ShadowContract.ChatShadowRoomSnapshot): ShadowContract.ChatShadowDiagnostics {
  return ShadowContract.buildShadowDiagnostics(snapshot);
}

function toPreview(snapshot: ShadowContract.ChatShadowRoomSnapshot): ShadowContract.ChatShadowRoomPreview {
  return ShadowContract.toShadowRoomPreview(snapshot);
}

function toQueueSummary(snapshot: ShadowContract.ChatShadowRoomSnapshot): ShadowContract.ChatShadowQueueSummary {
  return ShadowContract.summarizeShadowQueue(snapshot.revealQueue, Date.now());
}

function applyCapacityLimit<T>(items: readonly T[], max: number): readonly T[] {
  if (items.length <= max) return items;
  return items.slice(items.length - max);
}

function provenanceFromContext(context: ShadowLedgerWriteContext): ShadowContract.ChatShadowProvenance {
  return {
    sourceKind: context.sourceKind ?? 'UNKNOWN',
    sourceId: context.sourceId ?? 'shadow-ledger',
    actorId: context.actorId,
    eventId: context.eventId,
    runId: context.runId,
    sceneId: context.sceneId,
    momentId: context.momentId,
    notes: [],
  };
}

function compute_hostility_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.hostility, 0, 100);
}

function compute_intimidation_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.intimidation, 0, 100);
}

function compute_ridicule_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.ridicule, 0, 100);
}

function compute_judgment_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.judgment, 0, 100);
}

function compute_panic_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.panic, 0, 100);
}

function compute_rescue_pull_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.rescuePull, 0, 100);
}

function compute_crowd_heat_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.crowdHeat, 0, 100);
}

function compute_rivalry_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.rivalry, 0, 100);
}

function compute_negotiation_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.negotiation, 0, 100);
}

function compute_liveops_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.liveOps, 0, 100);
}

function compute_witness_signal(anchor: ShadowContract.ChatShadowPressureAnchor): number {
  return clamp(anchor.pressure.witness, 0, 100);
}

function decayPressureValue(value: number, ageMs: number, halfLifeMs: number): number {
  if (value <= 0) return 0;
  if (ageMs <= 0) return clamp(value);
  const exponent = ageMs / Math.max(halfLifeMs, 1);
  return clamp(value * Math.pow(0.5, exponent));
}

function decayAnchor(anchor: ShadowContract.ChatShadowPressureAnchor, now: UnixMs, halfLifeMs: number): ShadowContract.ChatShadowPressureAnchor {
  const created = Date.parse(anchor.createdAt);
  const age = Math.max(0, Number(now) - created);
  const pressure: ShadowContract.ChatShadowPressureVector = ShadowContract.normalizeShadowPressureVector({
    hostility: decayPressureValue(anchor.pressure.hostility, age, halfLifeMs),
    intimidation: decayPressureValue(anchor.pressure.intimidation, age, halfLifeMs),
    ridicule: decayPressureValue(anchor.pressure.ridicule, age, halfLifeMs),
    judgment: decayPressureValue(anchor.pressure.judgment, age, halfLifeMs),
    panic: decayPressureValue(anchor.pressure.panic, age, halfLifeMs),
    rescuePull: decayPressureValue(anchor.pressure.rescuePull, age, halfLifeMs),
    crowdHeat: decayPressureValue(anchor.pressure.crowdHeat, age, halfLifeMs),
    rivalry: decayPressureValue(anchor.pressure.rivalry, age, halfLifeMs),
    negotiation: decayPressureValue(anchor.pressure.negotiation, age, halfLifeMs),
    liveOps: decayPressureValue(anchor.pressure.liveOps, age, halfLifeMs),
    witness: decayPressureValue(anchor.pressure.witness, age, halfLifeMs),
  });
  return { ...anchor, pressure };
}

function isExpired(iso: string | undefined, now: UnixMs): boolean {
  return typeof iso === 'string' && Number.isFinite(Date.parse(iso)) && Date.parse(iso) <= Number(now);
}

function isStale(iso: string, now: UnixMs, ttlMs: number): boolean {
  const created = Date.parse(iso);
  return Number.isFinite(created) ? Number(now) - created >= ttlMs : false;
}

export class ShadowStateLedger {
  private readonly options: Required<ShadowStateLedgerOptions>;
  private readonly rooms = new Map<ChatRoomId, ShadowContract.ChatShadowRoomSnapshot>();

  constructor(options: ShadowStateLedgerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private get clock(): ShadowStateLedgerClock {
    return this.options.clock;
  }

  private get logger(): ShadowStateLedgerLogger {
    return this.options.logger;
  }

  private stampNow(context?: ShadowLedgerWriteContext): UnixMs {
    return (context?.now ?? nowMs(this.clock)) as UnixMs;
  }

  private ensureRoom(roomId: ChatRoomId, context?: ShadowLedgerWriteContext): ShadowContract.ChatShadowRoomSnapshot {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;
    const created = ShadowContract.createEmptyShadowRoomSnapshot({
      roomId,
      runId: context?.runId,
      sceneId: context?.sceneId,
      momentId: context?.momentId,
    });
    this.rooms.set(roomId, created);
    return created;
  }

  private writeRoom(snapshot: ShadowContract.ChatShadowRoomSnapshot): void {
    this.rooms.set(snapshot.roomId, snapshot);
    if (this.rooms.size <= this.options.maxRooms) return;
    const oldest = [...this.rooms.keys()][0];
    if (oldest) this.rooms.delete(oldest);
  }

  private finalize(snapshot: ShadowContract.ChatShadowRoomSnapshot, updatedAt: UnixMs): ShadowLedgerMutationReceipt {
    this.writeRoom(snapshot);
    const diagnostics = toDiagnostics(snapshot);
    const preview = toPreview(snapshot);
    const queueSummary = ShadowContract.summarizeShadowQueue(snapshot.revealQueue, Number(updatedAt));
    return {
      roomId: snapshot.roomId,
      updatedAt,
      diagnostics,
      preview,
      queueSummary,
      hiddenThreatCount: ShadowContract.countHiddenThreatAnchors(snapshot),
      revealableSuppressedCount: ShadowContract.countRevealableSuppressedReplies(snapshot),
      callbackAnchorCount: ShadowContract.countCallbackAnchors(snapshot),
    };
  }

  hydrateRoom(envelope: ShadowLedgerHydrationEnvelope): ShadowLedgerMutationReceipt {
    const existing = this.rooms.get(envelope.roomId);
    const merged = envelope.replace || !existing
      ? envelope.snapshot
      : ShadowContract.foldShadowDelta(existing, {
          roomId: envelope.roomId,
          addAtoms: [
            ...envelope.snapshot.pressureAnchors,
            ...envelope.snapshot.suppressedReplies,
            ...envelope.snapshot.revealQueue,
            ...envelope.snapshot.memoryMarkers,
          ],
        });
    return this.finalize(merged, this.stampNow({ roomId: envelope.roomId }));
  }

  getRoom(roomId: ChatRoomId): ShadowLedgerRoomEnvelope {
    const snapshot = this.ensureRoom(roomId);
    return {
      roomId,
      snapshot,
      diagnostics: toDiagnostics(snapshot),
      preview: toPreview(snapshot),
      queueSummary: toQueueSummary(snapshot),
      updatedAt: this.stampNow({ roomId }),
    };
  }

  listRooms(): readonly ShadowLedgerRoomEnvelope[] {
    return [...this.rooms.keys()].map((roomId) => this.getRoom(roomId));
  }

  applyDelta(roomId: ChatRoomId, delta: ShadowContract.ChatShadowDelta, context?: ShadowLedgerWriteContext): ShadowLedgerMutationReceipt {
    const room = this.ensureRoom(roomId, context);
    const next = ShadowContract.foldShadowDelta(room, delta);
    return this.finalize(next, this.stampNow(context ?? { roomId }));
  }

  stagePressureAnchor(params: ShadowLedgerStagePressureParams): ShadowLedgerMutationReceipt {
    const now = this.stampNow(params);
    const anchor = ShadowContract.createShadowPressureAnchor({
      roomId: params.roomId,
      runId: params.runId,
      sceneId: params.sceneId,
      momentId: params.momentId,
      lane: params.lane,
      purpose: params.purpose ?? ShadowContract.inferShadowPurposeFromLane(params.lane),
      pressureKind: params.pressureKind,
      pressure: {
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
        witness: params.witness,
      },
      sourceKind: params.sourceKind ?? 'SYSTEM',
      sourceId: params.sourceId ?? 'shadow-ledger',
      actorId: params.actorId,
      priority: params.priority ?? ShadowContract.inferShadowPriorityFromLane(params.lane),
      visibility: params.visibility ?? ShadowContract.inferShadowVisibilityFromLane(params.lane),
      holdUntil: params.holdUntil,
      expiresAt: params.expiresAt,
      eventId: params.eventId,
      notes: params.notes ?? [],
    });
    const room = this.ensureRoom(params.roomId, params);
    const next = {
      ...room,
      pressureAnchors: applyCapacityLimit(stableSortByLaneAndPriority([...room.pressureAnchors, anchor]), this.options.maxAnchorsPerRoom),
      updatedAt: new Date(Number(now)).toISOString(),
    };
    return this.finalize(next, now);
  }

  stageSuppressedReply(params: ShadowLedgerStageSuppressedReplyParams): ShadowLedgerMutationReceipt {
    const now = this.stampNow(params);
    const reply = ShadowContract.createShadowSuppressedReply({
      roomId: params.roomId,
      runId: params.runId,
      sceneId: params.sceneId,
      momentId: params.momentId,
      lane: params.lane,
      purpose: ShadowContract.inferShadowPurposeFromLane(params.lane),
      channelId: params.channelId,
      sourceKind: params.sourceKind ?? 'SYSTEM',
      sourceId: params.sourceId ?? 'shadow-ledger',
      actorId: params.actorId,
      body: params.body,
      reason: params.reason,
      targetKind: params.targetKind,
      targetId: params.targetId,
      priority: params.priority ?? ShadowContract.inferShadowPriorityFromLane(params.lane),
      readyAt: params.readyAt,
      revealAt: params.revealAt,
      eventId: params.eventId,
      notes: params.notes ?? [],
    });
    const room = this.ensureRoom(params.roomId, params);
    const next = {
      ...room,
      suppressedReplies: applyCapacityLimit(stableSortByLaneAndPriority([...room.suppressedReplies, reply]), this.options.maxSuppressedRepliesPerRoom),
      updatedAt: new Date(Number(now)).toISOString(),
    };
    return this.finalize(next, now);
  }

  stageReveal(params: ShadowLedgerStageRevealParams): ShadowLedgerMutationReceipt {
    const now = this.stampNow(params);
    const item = ShadowContract.createShadowRevealQueueItem({
      roomId: params.roomId,
      runId: params.runId,
      sceneId: params.sceneId,
      momentId: params.momentId,
      lane: params.lane,
      purpose: params.purpose ?? ShadowContract.inferShadowPurposeFromLane(params.lane),
      sourceKind: params.sourceKind ?? 'SYSTEM',
      sourceId: params.sourceId ?? 'shadow-ledger',
      actorId: params.actorId,
      sourceAtomKind: params.sourceAtomKind,
      sourceAtomId: params.sourceAtomId,
      trigger: params.trigger,
      status: params.status ?? 'PENDING',
      priority: params.priority ?? ShadowContract.inferShadowPriorityFromLane(params.lane),
      channelId: params.channelId,
      deliverAt: params.deliverAt,
      armAt: params.armAt,
      readyAt: params.readyAt,
      expiresAt: params.expiresAt,
      eventId: params.eventId,
      notes: params.notes ?? [],
    });
    const room = this.ensureRoom(params.roomId, params);
    const next = {
      ...room,
      revealQueue: applyCapacityLimit(stableSortByLaneAndPriority([...room.revealQueue, item]), this.options.maxRevealQueueItemsPerRoom),
      updatedAt: new Date(Number(now)).toISOString(),
    };
    return this.finalize(next, now);
  }

  stageMemoryMarker(params: ShadowLedgerStageMarkerParams): ShadowLedgerMutationReceipt {
    const now = this.stampNow(params);
    const marker = ShadowContract.createShadowMemoryMarker({
      roomId: params.roomId,
      runId: params.runId,
      sceneId: params.sceneId,
      momentId: params.momentId,
      lane: params.lane,
      purpose: params.purpose ?? ShadowContract.inferShadowPurposeFromLane(params.lane),
      sourceKind: params.sourceKind ?? 'SYSTEM',
      sourceId: params.sourceId ?? 'shadow-ledger',
      actorId: params.actorId,
      kind: params.kind,
      anchorId: params.anchorId,
      callbackId: params.callbackId,
      messageId: params.messageId,
      proofId: params.proofId,
      legendId: params.legendId,
      rescueId: params.rescueId,
      rivalryId: params.rivalryId,
      negotiationId: params.negotiationId,
      liveOpsId: params.liveOpsId,
      payload: params.payload,
      priority: params.priority ?? ShadowContract.inferShadowPriorityFromLane(params.lane),
      visibility: params.visibility ?? ShadowContract.inferShadowVisibilityFromLane(params.lane),
      eventId: params.eventId,
      notes: params.notes ?? [],
    });
    const room = this.ensureRoom(params.roomId, params);
    const next = {
      ...room,
      memoryMarkers: applyCapacityLimit(stableSortByLaneAndPriority([...room.memoryMarkers, marker]), this.options.maxMemoryMarkersPerRoom),
      updatedAt: new Date(Number(now)).toISOString(),
    };
    return this.finalize(next, now);
  }

  recomputeWitnessEnvelope(roomId: ChatRoomId, context?: ShadowLedgerWriteContext): ShadowLedgerMutationReceipt {
    const room = this.ensureRoom(roomId, context);
    const witnessEnvelope = ShadowContract.computeShadowWitnessEnvelope(room);
    const next = { ...room, witnesses: witnessEnvelope, updatedAt: new Date(Number(this.stampNow(context ?? { roomId }))).toISOString() };
    return this.finalize(next, this.stampNow(context ?? { roomId }));
  }

  decayAndPrune(roomId: ChatRoomId, context?: ShadowLedgerWriteContext): ShadowLedgerMutationReceipt {
    const room = this.ensureRoom(roomId, context);
    const now = this.stampNow(context ?? { roomId });
    const anchors = room.pressureAnchors
      .map((anchor) => decayAnchor(anchor, now, this.options.pressureDecayHalfLifeMs))
      .filter((anchor) => !isExpired(anchor.expiresAt, now) && !isStale(anchor.createdAt, now, this.options.staleAnchorMs));
    const suppressedReplies = room.suppressedReplies.filter((reply) => !isExpired(reply.expiresAt, now) && !isStale(reply.createdAt, now, this.options.staleSuppressedMs));
    const revealQueue = room.revealQueue.filter((item) => !isExpired(item.expiresAt, now) && !isStale(item.createdAt, now, this.options.staleRevealMs));
    const memoryMarkers = room.memoryMarkers.filter((marker) => !isExpired(marker.expiresAt, now) && !isStale(marker.createdAt, now, this.options.staleMarkerMs));
    const next = { ...room, pressureAnchors: anchors, suppressedReplies, revealQueue, memoryMarkers, updatedAt: new Date(Number(now)).toISOString() };
    return this.finalize(next, now);
  }

  expireLane(roomId: ChatRoomId, lane: ShadowContract.ChatShadowLane, context?: ShadowLedgerWriteContext): ShadowLedgerMutationReceipt {
    const room = this.ensureRoom(roomId, context);
    const now = this.stampNow(context ?? { roomId });
    const next = {
      ...room,
      pressureAnchors: room.pressureAnchors.filter((anchor) => anchor.lane !== lane),
      suppressedReplies: room.suppressedReplies.filter((reply) => reply.lane !== lane),
      revealQueue: room.revealQueue.filter((item) => item.lane !== lane),
      memoryMarkers: room.memoryMarkers.filter((marker) => marker.lane !== lane),
      updatedAt: new Date(Number(now)).toISOString(),
    };
    return this.finalize(next, now);
  }

  buildPressureAuditLines(roomId: ChatRoomId): readonly string[] {
    const room = this.ensureRoom(roomId);
    return room.pressureAnchors.map((anchor) => `${anchor.id} | ${anchor.lane} | ${anchor.pressureKind} | h=${anchor.pressure.hostility} i=${anchor.pressure.intimidation} r=${anchor.pressure.ridicule} c=${anchor.pressure.crowdHeat}`);
  }

  buildSuppressionAuditLines(roomId: ChatRoomId): readonly string[] {
    const room = this.ensureRoom(roomId);
    return room.suppressedReplies.map((reply) => `${reply.id} | ${reply.lane} | ${reply.reason} | ${reply.body.slice(0, 72)}`);
  }

  buildRevealAuditLines(roomId: ChatRoomId): readonly string[] {
    const room = this.ensureRoom(roomId);
    return room.revealQueue.map((item) => `${item.id} | ${item.lane} | ${item.trigger} | ${item.status} | deliverAt=${item.deliverAt ?? 'n/a'}`);
  }

  buildMarkerAuditLines(roomId: ChatRoomId): readonly string[] {
    const room = this.ensureRoom(roomId);
    return room.memoryMarkers.map((marker) => `${marker.id} | ${marker.lane} | ${marker.kind} | ${marker.callbackId ?? marker.anchorId ?? marker.messageId ?? 'no-link'}`);
  }

  buildRoomEnvelope(roomId: ChatRoomId): ShadowLedgerRoomEnvelope {
    return this.getRoom(roomId);
  }
}

export function createShadowStateLedger(options: ShadowStateLedgerOptions = {}): ShadowStateLedger {
  return new ShadowStateLedger(options);
}

export const ChatShadowStateLedgerModule = Object.freeze({
  createShadowStateLedger,
  ShadowStateLedger,
});

export function shadowLedgerScoreLane_1(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_2(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_3(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_4(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_5(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_6(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_7(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_8(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_9(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_10(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_11(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_12(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_13(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_14(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_15(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_16(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_17(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_18(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_19(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_20(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_21(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_22(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_23(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_24(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_25(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_26(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_27(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_28(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_29(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_30(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_31(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_32(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_33(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_34(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_35(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_36(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_37(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_38(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}

export function shadowLedgerScoreLane_39(snapshot: ShadowContract.ChatShadowRoomSnapshot): number {
  const preview = ShadowContract.toShadowRoomPreview(snapshot);
  const diagnostics = ShadowContract.buildShadowDiagnostics(snapshot);
  return clamp(
    preview.hiddenThreatCount * 0.4 +
    preview.revealableSuppressedCount * 0.6 +
    diagnostics.warnings.length * 2 +
    (ShadowContract.hasShadowRescuePressure(snapshot) ? 8 : 0) +
    (ShadowContract.hasShadowNegotiationTrap(snapshot) ? 6 : 0) +
    (ShadowContract.hasShadowCrowdBoil(snapshot) ? 6 : 0),
    0,
    100,
  );
}
