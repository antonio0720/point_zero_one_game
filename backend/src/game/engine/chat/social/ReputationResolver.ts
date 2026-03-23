/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SOCIAL LANE
 * FILE: backend/src/game/engine/chat/social/ReputationResolver.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative backend resolver for chat-facing reputation state.
 *
 * Design constraints
 * ------------------
 * - Shared contracts define reputation law; this file resolves application.
 * - Backend ownership only: deterministic, replayable, and auditable.
 * - No UI state, no browser assumptions, no socket transport coupling.
 * - The resolver must be able to answer three classes of questions:
 *   1. what changed,
 *   2. why it changed,
 *   3. how that should project into channel behavior, social pressure, and
 *      authored response selection.
 * - The file must support rivalry, helper trust, witnesses, proofs, quotes,
 *   callbacks, negotiation, rescue, legend, and post-run carryover.
 *
 * This is intentionally a deep backend authority rather than a helper.
 * ============================================================================
 */

/* eslint-disable max-lines */

export type ReputationUnixMs = number & { readonly __brand: 'ReputationUnixMs' };
export type ReputationRoomId = string & { readonly __brand: 'ReputationRoomId' };
export type ReputationParticipantId = string & { readonly __brand: 'ReputationParticipantId' };
export type ReputationEntryId = string & { readonly __brand: 'ReputationEntryId' };
export type ReputationSceneId = string & { readonly __brand: 'ReputationSceneId' };
export type ReputationMomentId = string & { readonly __brand: 'ReputationMomentId' };
export type ReputationProofHash = string & { readonly __brand: 'ReputationProofHash' };
export type ReputationQuoteId = string & { readonly __brand: 'ReputationQuoteId' };
export type ReputationChannelId =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'LOBBY'
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type ReputationMetricKey =
  | 'respect'
  | 'fear'
  | 'contempt'
  | 'fascination'
  | 'trust'
  | 'familiarity'
  | 'rivalry'
  | 'rescueDebt'
  | 'notoriety'
  | 'dealCredibility'
  | 'bluffExposure'
  | 'legend';

export type ReputationSourceKind =
  | 'MESSAGE'
  | 'PROOF'
  | 'QUOTE'
  | 'CALLBACK'
  | 'RELATIONSHIP'
  | 'SCENE'
  | 'MOMENT'
  | 'DEAL'
  | 'RESCUE'
  | 'COUNTERPLAY'
  | 'RUN_STATE'
  | 'WORLD_EVENT'
  | 'MANUAL';

export type ReputationReason =
  | 'MOCKED_PUBLICLY'
  | 'SHIELDED_SUCCESSFULLY'
  | 'SURVIVED_COLLAPSE'
  | 'BOTCHED_COUNTERPLAY'
  | 'VERIFIED_PROOF'
  | 'CAUGHT_BLUFFING'
  | 'DEAL_ROOM_WIN'
  | 'DEAL_ROOM_LOSS'
  | 'HELPER_IGNORED'
  | 'HELPER_HEEDED'
  | 'RESCUED'
  | 'RESCUED_OTHERS'
  | 'RIVALRY_ESCALATED'
  | 'RIVALRY_COOLED'
  | 'LEGEND_MOMENT'
  | 'QUOTE_RETURNED'
  | 'CALLBACK_TRIGGERED'
  | 'WORLD_EVENT'
  | 'MANUAL';

export interface ReputationVector {
  readonly respect: number;
  readonly fear: number;
  readonly contempt: number;
  readonly fascination: number;
  readonly trust: number;
  readonly familiarity: number;
  readonly rivalry: number;
  readonly rescueDebt: number;
  readonly notoriety: number;
  readonly dealCredibility: number;
  readonly bluffExposure: number;
  readonly legend: number;
}

export interface ReputationState {
  readonly roomId: ReputationRoomId;
  readonly participantId: ReputationParticipantId;
  readonly vector: ReputationVector;
  readonly projectedAura: string;
  readonly crowdExposure: number;
  readonly helperAvailabilityBias: number;
  readonly rivalryPressureBias: number;
  readonly rescueUrgencyBias: number;
  readonly lastUpdatedAt: ReputationUnixMs;
  readonly lastReason: ReputationReason;
  readonly lastSceneId?: ReputationSceneId;
  readonly lastMomentId?: ReputationMomentId;
  readonly metadata: Readonly<JsonObject>;
}

export interface ReputationDelta {
  readonly vectorDelta: Partial<Record<ReputationMetricKey, number>>;
  readonly crowdExposureDelta?: number;
  readonly helperAvailabilityBiasDelta?: number;
  readonly rivalryPressureBiasDelta?: number;
  readonly rescueUrgencyBiasDelta?: number;
  readonly reason: ReputationReason;
  readonly sourceKind: ReputationSourceKind;
  readonly sceneId?: ReputationSceneId;
  readonly momentId?: ReputationMomentId;
  readonly proofHash?: ReputationProofHash;
  readonly quoteId?: ReputationQuoteId;
  readonly actorId?: ReputationParticipantId;
  readonly targetId?: ReputationParticipantId;
  readonly metadata?: Readonly<JsonObject>;
}

export interface ReputationInput {
  readonly roomId: ReputationRoomId;
  readonly participantId: ReputationParticipantId;
  readonly occurredAt: ReputationUnixMs;
  readonly delta: ReputationDelta;
}

export interface ReputationEntry {
  readonly entryId: ReputationEntryId;
  readonly roomId: ReputationRoomId;
  readonly participantId: ReputationParticipantId;
  readonly occurredAt: ReputationUnixMs;
  readonly previousState: ReputationState;
  readonly nextState: ReputationState;
  readonly delta: ReputationDelta;
}

export interface ReputationSnapshot {
  readonly roomId: ReputationRoomId;
  readonly participants: Readonly<Record<string, ReputationState>>;
  readonly exportedAt: ReputationUnixMs;
}

export interface ReputationProjection {
  readonly participantId: ReputationParticipantId;
  readonly visibleChannelBias: Readonly<Record<ReputationChannelId, number>>;
  readonly helperTrustIndex: number;
  readonly rivalryEscalationIndex: number;
  readonly rescueEligibilityIndex: number;
  readonly proofMagnifier: number;
  readonly quoteRiskIndex: number;
  readonly callbackPotency: number;
  readonly auraSummary: string;
}

export interface ReputationDiagnostics {
  readonly roomId: ReputationRoomId;
  readonly participantCount: number;
  readonly entryCount: number;
  readonly hottestParticipant?: ReputationParticipantId;
  readonly highestLegend?: number;
  readonly highestBluffExposure?: number;
  readonly highestRivalry?: number;
  readonly generatedAt: ReputationUnixMs;
}

export interface ReputationResolverOptions {
  readonly now?: () => number;
  readonly maxEntriesPerRoom?: number;
  readonly maxMetadataKeys?: number;
}

const DEFAULT_MAX_ENTRIES_PER_ROOM = 12_288;
const DEFAULT_MAX_METADATA_KEYS = 48;

function asUnixMs(value: number): ReputationUnixMs {
  return value as ReputationUnixMs;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function sanitizeMetadata(metadata?: Readonly<JsonObject>, maxKeys = DEFAULT_MAX_METADATA_KEYS): Readonly<JsonObject> {
  if (!metadata) return Object.freeze({});
  return Object.freeze(Object.fromEntries(Object.entries(metadata).slice(0, maxKeys)));
}

function defaultVector(): ReputationVector {
  return {
    respect: 0,
    fear: 0,
    contempt: 0,
    fascination: 0,
    trust: 0,
    familiarity: 0,
    rivalry: 0,
    rescueDebt: 0,
    notoriety: 0,
    dealCredibility: 0,
    bluffExposure: 0,
    legend: 0,
  };
}

function createEntryId(now: ReputationUnixMs, roomId: ReputationRoomId, participantId: ReputationParticipantId): ReputationEntryId {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `${roomId}:${participantId}:${now}:${entropy}` as ReputationEntryId;
}

function computeProjectedAura(vector: ReputationVector): string {
  const score =
    vector.respect * 0.9 +
    vector.fear * 0.82 -
    vector.contempt * 0.75 +
    vector.fascination * 0.7 +
    vector.trust * 0.88 +
    vector.legend * 1.05 -
    vector.bluffExposure * 0.8;

  if (score >= 80) return 'ASCENDANT';
  if (score >= 60) return 'DOMINANT';
  if (score >= 40) return 'PRESSURING';
  if (score >= 20) return 'NOTICED';
  if (score <= -20) return 'EXPOSED';
  return 'NEUTRAL';
}

function mergeVector(
  current: ReputationVector,
  delta: Partial<Record<ReputationMetricKey, number>> | undefined,
): ReputationVector {
  if (!delta) return current;
  const next = { ...current };
  (Object.keys(delta) as ReputationMetricKey[]).forEach((key) => {
    next[key] = round(clamp(next[key] + (delta[key] ?? 0), 0, 100), 4);
  });
  return Object.freeze(next);
}

function initialState(
  roomId: ReputationRoomId,
  participantId: ReputationParticipantId,
  now: ReputationUnixMs,
): ReputationState {
  const vector = Object.freeze(defaultVector());
  return Object.freeze({
    roomId,
    participantId,
    vector,
    projectedAura: computeProjectedAura(vector),
    crowdExposure: 0,
    helperAvailabilityBias: 0,
    rivalryPressureBias: 0,
    rescueUrgencyBias: 0,
    lastUpdatedAt: now,
    lastReason: 'MANUAL',
    metadata: Object.freeze({}),
  });
}

export class ReputationResolver {
  private readonly now: () => number;
  private readonly maxEntriesPerRoom: number;
  private readonly maxMetadataKeys: number;

  public readonly roomParticipants = new Map<ReputationRoomId, Map<ReputationParticipantId, ReputationState>>();
  public readonly roomEntries = new Map<ReputationRoomId, ReputationEntry[]>();

  public constructor(options: ReputationResolverOptions = {}) {
    this.now = options.now ?? Date.now;
    this.maxEntriesPerRoom = options.maxEntriesPerRoom ?? DEFAULT_MAX_ENTRIES_PER_ROOM;
    this.maxMetadataKeys = options.maxMetadataKeys ?? DEFAULT_MAX_METADATA_KEYS;
  }

  public ensureParticipant(
    roomId: ReputationRoomId,
    participantId: ReputationParticipantId,
    now: ReputationUnixMs = asUnixMs(this.now()),
  ): ReputationState {
    const room = this.getOrCreateRoom(roomId);
    const existing = room.get(participantId);
    if (existing) return existing;
    const seeded = initialState(roomId, participantId, now);
    room.set(participantId, seeded);
    return seeded;
  }

  public ingest(input: ReputationInput): ReputationEntry {
    const room = this.getOrCreateRoom(input.roomId);
    const previousState = room.get(input.participantId) ?? initialState(input.roomId, input.participantId, input.occurredAt);
    const nextState = this.applyDelta(previousState, input.delta, input.occurredAt);
    room.set(input.participantId, nextState);

    const entry: ReputationEntry = Object.freeze({
      entryId: createEntryId(input.occurredAt, input.roomId, input.participantId),
      roomId: input.roomId,
      participantId: input.participantId,
      occurredAt: input.occurredAt,
      previousState,
      nextState,
      delta: Object.freeze({ ...input.delta }),
    });

    this.pushEntry(input.roomId, entry);
    return entry;
  }

  public getState(
    roomId: ReputationRoomId,
    participantId: ReputationParticipantId,
    now: ReputationUnixMs = asUnixMs(this.now()),
  ): ReputationState {
    return this.ensureParticipant(roomId, participantId, now);
  }

  public getSnapshot(roomId: ReputationRoomId, exportedAt: ReputationUnixMs = asUnixMs(this.now())): ReputationSnapshot {
    const room = this.getOrCreateRoom(roomId);
    const participants = Object.freeze(
      Object.fromEntries(Array.from(room.entries()).map(([participantId, state]) => [participantId, state])) as Record<string, ReputationState>,
    );
    return Object.freeze({ roomId, participants, exportedAt });
  }

  public getProjection(
    roomId: ReputationRoomId,
    participantId: ReputationParticipantId,
    now: ReputationUnixMs = asUnixMs(this.now()),
  ): ReputationProjection {
    const state = this.getState(roomId, participantId, now);
    const vector = state.vector;

    const visibleChannelBias: Record<ReputationChannelId, number> = {
      GLOBAL: round(vector.notoriety * 0.9 + vector.legend * 0.55 + vector.bluffExposure * 0.35, 4),
      SYNDICATE: round(vector.fear * 0.25 + vector.respect * 0.42 + vector.rivalry * 0.33, 4),
      DEAL_ROOM: round(vector.dealCredibility * 0.9 - vector.bluffExposure * 0.65 + vector.respect * 0.22, 4),
      LOBBY: round(vector.familiarity * 0.8 + vector.trust * 0.45 - vector.contempt * 0.22, 4),
      SYSTEM_SHADOW: round(vector.bluffExposure * 0.7 + vector.legend * 0.2 + vector.rivalry * 0.1, 4),
      NPC_SHADOW: round(vector.fascination * 0.55 + vector.respect * 0.2 + vector.rivalry * 0.2, 4),
      RIVALRY_SHADOW: round(vector.rivalry * 0.95 + vector.contempt * 0.44 + vector.fear * 0.18, 4),
      RESCUE_SHADOW: round(vector.rescueDebt * 0.85 + (100 - vector.trust) * 0.12, 4),
      LIVEOPS_SHADOW: round(vector.notoriety * 0.45 + vector.legend * 0.45 + vector.bluffExposure * 0.18, 4),
    };

    return Object.freeze({
      participantId,
      visibleChannelBias: Object.freeze(visibleChannelBias),
      helperTrustIndex: round(vector.trust * 0.65 + vector.familiarity * 0.2 - vector.contempt * 0.3, 4),
      rivalryEscalationIndex: round(vector.rivalry * 0.8 + vector.contempt * 0.45 + vector.fear * 0.15, 4),
      rescueEligibilityIndex: round(vector.rescueDebt * 0.72 + (100 - vector.trust) * 0.12 + state.rescueUrgencyBias, 4),
      proofMagnifier: round(1 + vector.legend * 0.01 + vector.notoriety * 0.004, 4),
      quoteRiskIndex: round(vector.bluffExposure * 0.72 + vector.notoriety * 0.24 + vector.rivalry * 0.18, 4),
      callbackPotency: round(vector.fascination * 0.4 + vector.rivalry * 0.33 + vector.legend * 0.28, 4),
      auraSummary: state.projectedAura,
    });
  }

  public getDiagnostics(
    roomId: ReputationRoomId,
    now: ReputationUnixMs = asUnixMs(this.now()),
  ): ReputationDiagnostics {
    const room = this.getOrCreateRoom(roomId);
    const entries = this.roomEntries.get(roomId) ?? [];
    const states = Array.from(room.values());
    const byLegend = [...states].sort((a, b) => b.vector.legend - a.vector.legend);
    const byBluff = [...states].sort((a, b) => b.vector.bluffExposure - a.vector.bluffExposure);
    const byRivalry = [...states].sort((a, b) => b.vector.rivalry - a.vector.rivalry);
    const hottest = [...states].sort((a, b) => b.crowdExposure - a.crowdExposure)[0];

    return Object.freeze({
      roomId,
      participantCount: states.length,
      entryCount: entries.length,
      hottestParticipant: hottest?.participantId,
      highestLegend: byLegend[0]?.vector.legend,
      highestBluffExposure: byBluff[0]?.vector.bluffExposure,
      highestRivalry: byRivalry[0]?.vector.rivalry,
      generatedAt: now,
    });
  }

  public clearRoom(roomId: ReputationRoomId): void {
    this.roomParticipants.delete(roomId);
    this.roomEntries.delete(roomId);
  }

  private getOrCreateRoom(roomId: ReputationRoomId): Map<ReputationParticipantId, ReputationState> {
    const existing = this.roomParticipants.get(roomId);
    if (existing) return existing;
    const created = new Map<ReputationParticipantId, ReputationState>();
    this.roomParticipants.set(roomId, created);
    this.roomEntries.set(roomId, []);
    return created;
  }

  private applyDelta(
    state: ReputationState,
    delta: ReputationDelta,
    now: ReputationUnixMs,
  ): ReputationState {
    const nextVector = mergeVector(state.vector, delta.vectorDelta);
    const nextExposure = round(clamp(state.crowdExposure + (delta.crowdExposureDelta ?? this.defaultExposureDelta(delta, nextVector)), 0, 100), 4);
    const nextHelperBias = round(clamp(state.helperAvailabilityBias + (delta.helperAvailabilityBiasDelta ?? this.defaultHelperBiasDelta(delta, nextVector)), -100, 100), 4);
    const nextRivalryBias = round(clamp(state.rivalryPressureBias + (delta.rivalryPressureBiasDelta ?? this.defaultRivalryBiasDelta(delta, nextVector)), -100, 100), 4);
    const nextRescueBias = round(clamp(state.rescueUrgencyBias + (delta.rescueUrgencyBiasDelta ?? this.defaultRescueBiasDelta(delta, nextVector)), -100, 100), 4);

    return Object.freeze({
      ...state,
      vector: nextVector,
      projectedAura: computeProjectedAura(nextVector),
      crowdExposure: nextExposure,
      helperAvailabilityBias: nextHelperBias,
      rivalryPressureBias: nextRivalryBias,
      rescueUrgencyBias: nextRescueBias,
      lastUpdatedAt: now,
      lastReason: delta.reason,
      lastSceneId: delta.sceneId ?? state.lastSceneId,
      lastMomentId: delta.momentId ?? state.lastMomentId,
      metadata: sanitizeMetadata({
        ...(state.metadata as JsonObject),
        ...(delta.metadata ?? {}),
      }, this.maxMetadataKeys),
    });
  }

  private defaultExposureDelta(delta: ReputationDelta, vector: ReputationVector): number {
    switch (delta.sourceKind) {
      case 'PROOF':
        return round(vector.legend * 0.15 + vector.notoriety * 0.08, 4);
      case 'QUOTE':
      case 'CALLBACK':
        return round(vector.bluffExposure * 0.18 + vector.notoriety * 0.1, 4);
      case 'DEAL':
        return round(vector.dealCredibility * 0.12 - vector.bluffExposure * 0.08, 4);
      case 'WORLD_EVENT':
        return 6;
      default:
        return round(vector.notoriety * 0.05 + vector.legend * 0.03, 4);
    }
  }

  private defaultHelperBiasDelta(delta: ReputationDelta, vector: ReputationVector): number {
    switch (delta.reason) {
      case 'HELPER_HEEDED':
        return round(vector.trust * 0.04 + vector.familiarity * 0.02, 4);
      case 'HELPER_IGNORED':
        return -4.5;
      case 'RESCUED':
        return 5.4;
      default:
        return round(vector.trust * 0.01 - vector.contempt * 0.015, 4);
    }
  }

  private defaultRivalryBiasDelta(delta: ReputationDelta, vector: ReputationVector): number {
    switch (delta.reason) {
      case 'RIVALRY_ESCALATED':
      case 'QUOTE_RETURNED':
      case 'CALLBACK_TRIGGERED':
        return round(vector.rivalry * 0.08 + vector.contempt * 0.03, 4);
      case 'RIVALRY_COOLED':
        return -4.2;
      case 'VERIFIED_PROOF':
        return round(vector.fear * 0.03 + vector.legend * 0.02, 4);
      default:
        return round(vector.rivalry * 0.015, 4);
    }
  }

  private defaultRescueBiasDelta(delta: ReputationDelta, vector: ReputationVector): number {
    switch (delta.reason) {
      case 'RESCUED':
        return 9.5;
      case 'HELPER_IGNORED':
        return round(vector.rescueDebt * 0.03 + (100 - vector.trust) * 0.02, 4);
      case 'SURVIVED_COLLAPSE':
        return -2.8;
      case 'BOTCHED_COUNTERPLAY':
        return 4.4;
      default:
        return round(vector.rescueDebt * 0.01, 4);
    }
  }

  private pushEntry(roomId: ReputationRoomId, entry: ReputationEntry): void {
    const entries = this.roomEntries.get(roomId) ?? [];
    entries.push(entry);
    if (entries.length > this.maxEntriesPerRoom) {
      entries.splice(0, entries.length - this.maxEntriesPerRoom);
    }
    this.roomEntries.set(roomId, entries);
  }
}

export function createReputationResolver(options: ReputationResolverOptions = {}): ReputationResolver {
  return new ReputationResolver(options);
}

export function deriveReputationDeltaFromProof(input: {
  readonly verified: boolean;
  readonly humiliatesRival?: boolean;
  readonly savesRun?: boolean;
  readonly proofHash: ReputationProofHash;
  readonly actorId?: ReputationParticipantId;
  readonly targetId?: ReputationParticipantId;
}): ReputationDelta {
  const respect = input.verified ? 8.5 : 2.5;
  const legend = input.verified ? 9.2 : 3.2;
  const fear = input.humiliatesRival ? 5.6 : 1.8;
  const trust = input.savesRun ? 4.2 : 0.8;
  const notoriety = input.verified ? 6.5 : 2.4;

  return Object.freeze({
    vectorDelta: Object.freeze({
      respect,
      legend,
      fear,
      trust,
      notoriety,
      rivalry: input.humiliatesRival ? 2.8 : 0,
      rescueDebt: input.savesRun ? 1.6 : 0,
    }),
    crowdExposureDelta: 7.4,
    reason: 'VERIFIED_PROOF',
    sourceKind: 'PROOF',
    proofHash: input.proofHash,
    actorId: input.actorId,
    targetId: input.targetId,
    metadata: Object.freeze({
      humiliatesRival: input.humiliatesRival ?? false,
      savesRun: input.savesRun ?? false,
    }),
  });
}

export function deriveReputationDeltaFromQuote(input: {
  readonly quoteId: ReputationQuoteId;
  readonly hostile?: boolean;
  readonly exposedBluff?: boolean;
  readonly actorId?: ReputationParticipantId;
  readonly targetId?: ReputationParticipantId;
}): ReputationDelta {
  return Object.freeze({
    vectorDelta: Object.freeze({
      bluffExposure: input.exposedBluff ? 7.8 : 1.4,
      contempt: input.hostile ? 4.6 : 0,
      notoriety: 3.6,
      rivalry: input.hostile ? 3.2 : 1.1,
      fascination: input.hostile ? 1.8 : 2.4,
    }),
    crowdExposureDelta: input.exposedBluff ? 6.8 : 3.2,
    rivalryPressureBiasDelta: input.hostile ? 4.4 : 1.4,
    reason: 'QUOTE_RETURNED',
    sourceKind: 'QUOTE',
    quoteId: input.quoteId,
    actorId: input.actorId,
    targetId: input.targetId,
  });
}

export function deriveReputationDeltaFromDeal(input: {
  readonly wonDeal: boolean;
  readonly exposedBluff?: boolean;
  readonly actorId?: ReputationParticipantId;
  readonly targetId?: ReputationParticipantId;
}): ReputationDelta {
  return Object.freeze({
    vectorDelta: Object.freeze({
      dealCredibility: input.wonDeal ? 7.2 : -0.5,
      bluffExposure: input.exposedBluff ? 8.2 : 0,
      respect: input.wonDeal ? 2.5 : 0.5,
      notoriety: input.wonDeal ? 2.2 : 1.3,
    }),
    crowdExposureDelta: input.wonDeal ? 4.2 : 3,
    reason: input.wonDeal ? 'DEAL_ROOM_WIN' : 'DEAL_ROOM_LOSS',
    sourceKind: 'DEAL',
    actorId: input.actorId,
    targetId: input.targetId,
    metadata: Object.freeze({
      exposedBluff: input.exposedBluff ?? false,
    }),
  });
}

export interface ReputationChannelProjection {
  readonly channelId: ReputationChannelId;
  readonly participantId: ReputationParticipantId;
  readonly visibilityWeight: number;
  readonly intimidationWeight: number;
  readonly trustWeight: number;
  readonly humiliationRisk: number;
  readonly callbackReadiness: number;
  readonly helperInterventionWeight: number;
  readonly recommendedTone: 'QUIET' | 'WATCHFUL' | 'PRESSURING' | 'PREDATORY' | 'CEREMONIAL';
}

export interface ReputationBatchInput {
  readonly roomId: ReputationRoomId;
  readonly occurredAt: ReputationUnixMs;
  readonly deltas: ReadonlyArray<{
    readonly participantId: ReputationParticipantId;
    readonly delta: ReputationDelta;
  }>;
}

export interface ReputationConflictPair {
  readonly leftParticipantId: ReputationParticipantId;
  readonly rightParticipantId: ReputationParticipantId;
  readonly pressure: number;
  readonly asymmetry: number;
  readonly humiliationRisk: number;
  readonly callbackRisk: number;
  readonly helperNeed: number;
}

export interface ReputationCarryoverSummary {
  readonly roomId: ReputationRoomId;
  readonly leaderboards: {
    readonly mostRespected: readonly ReputationParticipantId[];
    readonly mostFeared: readonly ReputationParticipantId[];
    readonly mostExposed: readonly ReputationParticipantId[];
    readonly mostLegendary: readonly ReputationParticipantId[];
    readonly highestRivalry: readonly ReputationParticipantId[];
  };
  readonly conflictPairs: readonly ReputationConflictPair[];
  readonly generatedAt: ReputationUnixMs;
}

export interface ReputationExportEnvelope {
  readonly snapshot: ReputationSnapshot;
  readonly entries: readonly ReputationEntry[];
  readonly diagnostics: ReputationDiagnostics;
  readonly carryover: ReputationCarryoverSummary;
}

export interface ReputationSceneInfluenceInput {
  readonly roomId: ReputationRoomId;
  readonly sceneId: ReputationSceneId;
  readonly momentId?: ReputationMomentId;
  readonly occurredAt: ReputationUnixMs;
  readonly actors: readonly ReputationParticipantId[];
  readonly visibilityWeight: number;
  readonly tensionWeight: number;
  readonly humiliationTargetId?: ReputationParticipantId;
  readonly rescueTargetId?: ReputationParticipantId;
  readonly winnerId?: ReputationParticipantId;
  readonly loserId?: ReputationParticipantId;
}

export interface ReputationNegotiationLeakInput {
  readonly roomId: ReputationRoomId;
  readonly occurredAt: ReputationUnixMs;
  readonly dealerId: ReputationParticipantId;
  readonly targetId: ReputationParticipantId;
  readonly leakSeverity: number;
  readonly provedBluff: boolean;
}

export interface ReputationRescueInfluenceInput {
  readonly roomId: ReputationRoomId;
  readonly occurredAt: ReputationUnixMs;
  readonly helperId: ReputationParticipantId;
  readonly rescuedId: ReputationParticipantId;
  readonly severity: number;
  readonly wasHeeded: boolean;
}

export interface ReputationWorldEventInfluenceInput {
  readonly roomId: ReputationRoomId;
  readonly occurredAt: ReputationUnixMs;
  readonly participantIds: readonly ReputationParticipantId[];
  readonly eventName: string;
  readonly pressureWeight: number;
  readonly spotlightWeight: number;
}

export interface ReputationResolver {
  batchIngest(input: ReputationBatchInput): readonly ReputationEntry[];
  getChannelProjection(
    roomId: ReputationRoomId,
    participantId: ReputationParticipantId,
    channelId: ReputationChannelId,
    now?: ReputationUnixMs,
  ): ReputationChannelProjection;
  getProjectionMatrix(roomId: ReputationRoomId, now?: ReputationUnixMs): ReputationProjectionMatrix;
  getRankingRows(roomId: ReputationRoomId, now?: ReputationUnixMs): readonly ReputationRankingRow[];
  getIndexSummary(roomId: ReputationRoomId, now?: ReputationUnixMs): ReputationIndexSummary;
  resolveConflictPairs(roomId: ReputationRoomId, now?: ReputationUnixMs): readonly ReputationConflictPair[];
  getCarryoverSummary(roomId: ReputationRoomId, now?: ReputationUnixMs): ReputationCarryoverSummary;
  exportEnvelope(roomId: ReputationRoomId, now?: ReputationUnixMs): ReputationExportEnvelope;
  importSnapshot(snapshot: ReputationSnapshot): void;
  applySceneInfluence(input: ReputationSceneInfluenceInput): readonly ReputationEntry[];
  applyNegotiationLeak(input: ReputationNegotiationLeakInput): readonly ReputationEntry[];
  applyRescueInfluence(input: ReputationRescueInfluenceInput): readonly ReputationEntry[];
  applyWorldEventInfluence(input: ReputationWorldEventInfluenceInput): readonly ReputationEntry[];
}

export interface ReputationProjectionMatrix {
  readonly roomId: ReputationRoomId;
  readonly byParticipant: Readonly<Record<string, readonly ReputationChannelProjection[]>>;
  readonly generatedAt: ReputationUnixMs;
}

export interface ReputationRankingRow {
  readonly participantId: ReputationParticipantId;
  readonly aura: string;
  readonly respect: number;
  readonly fear: number;
  readonly contempt: number;
  readonly trust: number;
  readonly rivalry: number;
  readonly exposure: number;
  readonly legend: number;
}

export interface ReputationIndexSummary {
  readonly roomId: ReputationRoomId;
  readonly averageRespect: number;
  readonly averageFear: number;
  readonly averageTrust: number;
  readonly averageExposure: number;
  readonly averageLegend: number;
  readonly averageRivalry: number;
  readonly generatedAt: ReputationUnixMs;
}

ReputationResolver.prototype.batchIngest = function batchIngest(this: ReputationResolver, input: ReputationBatchInput): readonly ReputationEntry[] {
  const results: ReputationEntry[] = [];
  for (const item of input.deltas) {
    results.push(
      this.ingest({
        roomId: input.roomId,
        participantId: item.participantId,
        occurredAt: input.occurredAt,
        delta: item.delta,
      }),
    );
  }
  return Object.freeze(results);
};

ReputationResolver.prototype.getChannelProjection = function getChannelProjection(
  this: ReputationResolver,
  roomId: ReputationRoomId,
  participantId: ReputationParticipantId,
  channelId: ReputationChannelId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationChannelProjection {
  const projection = this.getProjection(roomId, participantId, now);
  const state = this.getState(roomId, participantId, now);
  const visibilityWeight = projection.visibleChannelBias[channelId];
  const intimidationWeight = round(state.vector.fear * 0.7 + state.vector.rivalry * 0.2 + state.vector.legend * 0.1, 4);
  const trustWeight = round(state.vector.trust * 0.8 + state.vector.familiarity * 0.2, 4);
  const humiliationRisk = round(state.vector.bluffExposure * 0.72 + state.vector.contempt * 0.15, 4);
  const callbackReadiness = round(projection.callbackPotency + state.vector.fascination * 0.1, 4);
  const helperInterventionWeight = round(projection.helperTrustIndex * 0.4 + state.rescueUrgencyBias * 0.6, 4);

  let recommendedTone: ReputationChannelProjection['recommendedTone'] = 'WATCHFUL';
  if (channelId === 'DEAL_ROOM') {
    recommendedTone = humiliationRisk > 40 ? 'PREDATORY' : 'QUIET';
  } else if (channelId === 'GLOBAL') {
    recommendedTone = visibilityWeight > 50 ? 'CEREMONIAL' : intimidationWeight > 35 ? 'PRESSURING' : 'WATCHFUL';
  } else if (channelId === 'SYNDICATE') {
    recommendedTone = trustWeight > 35 ? 'QUIET' : 'WATCHFUL';
  } else if (channelId.endsWith('SHADOW')) {
    recommendedTone = callbackReadiness > 30 ? 'PRESSURING' : 'WATCHFUL';
  }

  return Object.freeze({
    channelId,
    participantId,
    visibilityWeight,
    intimidationWeight,
    trustWeight,
    humiliationRisk,
    callbackReadiness,
    helperInterventionWeight,
    recommendedTone,
  });
};

ReputationResolver.prototype.getProjectionMatrix = function getProjectionMatrix(
  this: ReputationResolver,
  roomId: ReputationRoomId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationProjectionMatrix {
  const snapshot = this.getSnapshot(roomId, now);
  const byParticipant: Record<string, readonly ReputationChannelProjection[]> = {};
  for (const participantId of Object.keys(snapshot.participants)) {
    const pid = participantId as ReputationParticipantId;
    byParticipant[participantId] = Object.freeze(([
      'GLOBAL',
      'SYNDICATE',
      'DEAL_ROOM',
      'LOBBY',
      'SYSTEM_SHADOW',
      'NPC_SHADOW',
      'RIVALRY_SHADOW',
      'RESCUE_SHADOW',
      'LIVEOPS_SHADOW',
    ] as const).map((channelId) => this.getChannelProjection(roomId, pid, channelId, now)));
  }
  return Object.freeze({ roomId, byParticipant: Object.freeze(byParticipant), generatedAt: now });
};

ReputationResolver.prototype.getRankingRows = function getRankingRows(
  this: ReputationResolver,
  roomId: ReputationRoomId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): readonly ReputationRankingRow[] {
  const snapshot = this.getSnapshot(roomId, now);
  const rows = Object.values(snapshot.participants)
    .map((state) =>
      Object.freeze({
        participantId: state.participantId,
        aura: state.projectedAura,
        respect: state.vector.respect,
        fear: state.vector.fear,
        contempt: state.vector.contempt,
        trust: state.vector.trust,
        rivalry: state.vector.rivalry,
        exposure: state.crowdExposure,
        legend: state.vector.legend,
      }),
    )
    .sort((a, b) => b.legend - a.legend || b.exposure - a.exposure || b.respect - a.respect);
  return Object.freeze(rows);
};

ReputationResolver.prototype.getIndexSummary = function getIndexSummary(
  this: ReputationResolver,
  roomId: ReputationRoomId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationIndexSummary {
  const snapshot = this.getSnapshot(roomId, now);
  const states = Object.values(snapshot.participants);
  const divisor = Math.max(states.length, 1);
  return Object.freeze({
    roomId,
    averageRespect: round(states.reduce((sum, state) => sum + state.vector.respect, 0) / divisor, 4),
    averageFear: round(states.reduce((sum, state) => sum + state.vector.fear, 0) / divisor, 4),
    averageTrust: round(states.reduce((sum, state) => sum + state.vector.trust, 0) / divisor, 4),
    averageExposure: round(states.reduce((sum, state) => sum + state.crowdExposure, 0) / divisor, 4),
    averageLegend: round(states.reduce((sum, state) => sum + state.vector.legend, 0) / divisor, 4),
    averageRivalry: round(states.reduce((sum, state) => sum + state.vector.rivalry, 0) / divisor, 4),
    generatedAt: now,
  });
};

ReputationResolver.prototype.resolveConflictPairs = function resolveConflictPairs(
  this: ReputationResolver,
  roomId: ReputationRoomId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): readonly ReputationConflictPair[] {
  const snapshot = this.getSnapshot(roomId, now);
  const states = Object.values(snapshot.participants);
  const pairs: ReputationConflictPair[] = [];
  for (let i = 0; i < states.length; i += 1) {
    for (let j = i + 1; j < states.length; j += 1) {
      const left = states[i];
      const right = states[j];
      const pressure = round(
        (left.vector.rivalry + right.vector.rivalry) * 0.55 +
          (left.vector.contempt + right.vector.contempt) * 0.25 +
          Math.abs(left.vector.legend - right.vector.legend) * 0.15,
        4,
      );
      const asymmetry = round(Math.abs(left.vector.respect - right.vector.respect) + Math.abs(left.crowdExposure - right.crowdExposure), 4);
      const humiliationRisk = round((left.vector.bluffExposure + right.vector.bluffExposure) * 0.55 + asymmetry * 0.15, 4);
      const callbackRisk = round((left.vector.fascination + right.vector.fascination) * 0.25 + pressure * 0.3, 4);
      const helperNeed = round((left.rescueUrgencyBias + right.rescueUrgencyBias) * 0.4 + pressure * 0.25, 4);
      if (pressure >= 10 || humiliationRisk >= 12) {
        pairs.push(
          Object.freeze({
            leftParticipantId: left.participantId,
            rightParticipantId: right.participantId,
            pressure,
            asymmetry,
            humiliationRisk,
            callbackRisk,
            helperNeed,
          }),
        );
      }
    }
  }
  return Object.freeze(pairs.sort((a, b) => b.pressure - a.pressure || b.humiliationRisk - a.humiliationRisk));
};

ReputationResolver.prototype.getCarryoverSummary = function getCarryoverSummary(
  this: ReputationResolver,
  roomId: ReputationRoomId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationCarryoverSummary {
  const rows = this.getRankingRows(roomId, now);
  const byRespect = [...rows].sort((a, b) => b.respect - a.respect);
  const byFear = [...rows].sort((a, b) => b.fear - a.fear);
  const byExposure = [...rows].sort((a, b) => b.exposure - a.exposure);
  const byLegend = [...rows].sort((a, b) => b.legend - a.legend);
  const byRivalry = [...rows].sort((a, b) => b.rivalry - a.rivalry);
  return Object.freeze({
    roomId,
    leaderboards: Object.freeze({
      mostRespected: Object.freeze(byRespect.slice(0, 5).map((row) => row.participantId)),
      mostFeared: Object.freeze(byFear.slice(0, 5).map((row) => row.participantId)),
      mostExposed: Object.freeze(byExposure.slice(0, 5).map((row) => row.participantId)),
      mostLegendary: Object.freeze(byLegend.slice(0, 5).map((row) => row.participantId)),
      highestRivalry: Object.freeze(byRivalry.slice(0, 5).map((row) => row.participantId)),
    }),
    conflictPairs: this.resolveConflictPairs(roomId, now).slice(0, 12),
    generatedAt: now,
  });
};

ReputationResolver.prototype.exportEnvelope = function exportEnvelope(
  this: ReputationResolver,
  roomId: ReputationRoomId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationExportEnvelope {
  return Object.freeze({
    snapshot: this.getSnapshot(roomId, now),
    entries: Object.freeze([...(this.roomEntries.get(roomId) ?? [])]),
    diagnostics: this.getDiagnostics(roomId, now),
    carryover: this.getCarryoverSummary(roomId, now),
  });
};

ReputationResolver.prototype.importSnapshot = function importSnapshot(
  this: ReputationResolver,
  snapshot: ReputationSnapshot,
): void {
  const room = new Map<ReputationParticipantId, ReputationState>();
  for (const [participantId, state] of Object.entries(snapshot.participants)) {
    room.set(participantId as ReputationParticipantId, Object.freeze({ ...state }));
  }
  this.roomParticipants.set(snapshot.roomId, room);
  if (!this.roomEntries.has(snapshot.roomId)) {
    this.roomEntries.set(snapshot.roomId, []);
  }
};

ReputationResolver.prototype.applySceneInfluence = function applySceneInfluence(
  this: ReputationResolver,
  input: ReputationSceneInfluenceInput,
): readonly ReputationEntry[] {
  const entries: ReputationEntry[] = [];
  for (const actorId of input.actors) {
    const delta: ReputationDelta = Object.freeze({
      vectorDelta: Object.freeze({
        notoriety: round(input.visibilityWeight * 0.6, 4),
        familiarity: round(input.visibilityWeight * 0.35, 4),
        rivalry: actorId === input.loserId ? round(input.tensionWeight * 0.4, 4) : round(input.tensionWeight * 0.15, 4),
        legend: actorId === input.winnerId ? round(input.visibilityWeight * 0.3, 4) : 0,
        contempt: actorId === input.humiliationTargetId ? round(input.tensionWeight * 0.45, 4) : 0,
        rescueDebt: actorId === input.rescueTargetId ? round(input.visibilityWeight * 0.22, 4) : 0,
      }),
      crowdExposureDelta: round(input.visibilityWeight * 0.8, 4),
      rivalryPressureBiasDelta: round(input.tensionWeight * 0.35, 4),
      rescueUrgencyBiasDelta: actorId === input.rescueTargetId ? round(input.tensionWeight * 0.28, 4) : 0,
      reason: actorId === input.winnerId ? 'LEGEND_MOMENT' : actorId === input.loserId ? 'RIVALRY_ESCALATED' : 'MANUAL',
      sourceKind: 'SCENE',
      sceneId: input.sceneId,
      momentId: input.momentId,
      metadata: Object.freeze({
        visibilityWeight: input.visibilityWeight,
        tensionWeight: input.tensionWeight,
      }),
    });
    entries.push(
      this.ingest({
        roomId: input.roomId,
        participantId: actorId,
        occurredAt: input.occurredAt,
        delta,
      }),
    );
  }
  return Object.freeze(entries);
};

ReputationResolver.prototype.applyNegotiationLeak = function applyNegotiationLeak(
  this: ReputationResolver,
  input: ReputationNegotiationLeakInput,
): readonly ReputationEntry[] {
  return Object.freeze([
    this.ingest({
      roomId: input.roomId,
      participantId: input.dealerId,
      occurredAt: input.occurredAt,
      delta: Object.freeze({
        vectorDelta: Object.freeze({
          dealCredibility: input.provedBluff ? -4.2 : 2.4,
          bluffExposure: input.provedBluff ? round(input.leakSeverity * 0.9, 4) : 0,
          notoriety: round(input.leakSeverity * 0.35, 4),
        }),
        crowdExposureDelta: round(input.leakSeverity * 0.55, 4),
        reason: input.provedBluff ? 'CAUGHT_BLUFFING' : 'DEAL_ROOM_WIN',
        sourceKind: 'DEAL',
        actorId: input.dealerId,
        targetId: input.targetId,
      }),
    }),
    this.ingest({
      roomId: input.roomId,
      participantId: input.targetId,
      occurredAt: input.occurredAt,
      delta: Object.freeze({
        vectorDelta: Object.freeze({
          respect: input.provedBluff ? 2.2 : 0.8,
          fear: round(input.leakSeverity * 0.2, 4),
          rivalry: round(input.leakSeverity * 0.25, 4),
        }),
        crowdExposureDelta: round(input.leakSeverity * 0.18, 4),
        reason: input.provedBluff ? 'QUOTE_RETURNED' : 'DEAL_ROOM_LOSS',
        sourceKind: 'DEAL',
        actorId: input.dealerId,
        targetId: input.targetId,
      }),
    }),
  ]);
};

ReputationResolver.prototype.applyRescueInfluence = function applyRescueInfluence(
  this: ReputationResolver,
  input: ReputationRescueInfluenceInput,
): readonly ReputationEntry[] {
  return Object.freeze([
    this.ingest({
      roomId: input.roomId,
      participantId: input.helperId,
      occurredAt: input.occurredAt,
      delta: Object.freeze({
        vectorDelta: Object.freeze({
          trust: round(input.severity * 0.45, 4),
          respect: round(input.severity * 0.32, 4),
          legend: round(input.severity * 0.18, 4),
        }),
        helperAvailabilityBiasDelta: round(input.severity * 0.35, 4),
        reason: 'RESCUED_OTHERS',
        sourceKind: 'RESCUE',
        actorId: input.helperId,
        targetId: input.rescuedId,
      }),
    }),
    this.ingest({
      roomId: input.roomId,
      participantId: input.rescuedId,
      occurredAt: input.occurredAt,
      delta: Object.freeze({
        vectorDelta: Object.freeze({
          rescueDebt: round(input.severity * 0.55, 4),
          trust: input.wasHeeded ? round(input.severity * 0.35, 4) : round(input.severity * 0.12, 4),
          familiarity: round(input.severity * 0.2, 4),
        }),
        rescueUrgencyBiasDelta: round(-input.severity * 0.25, 4),
        helperAvailabilityBiasDelta: input.wasHeeded ? 1.5 : -1.8,
        reason: 'RESCUED',
        sourceKind: 'RESCUE',
        actorId: input.helperId,
        targetId: input.rescuedId,
      }),
    }),
  ]);
};

ReputationResolver.prototype.applyWorldEventInfluence = function applyWorldEventInfluence(
  this: ReputationResolver,
  input: ReputationWorldEventInfluenceInput,
): readonly ReputationEntry[] {
  return Object.freeze(
    input.participantIds.map((participantId) =>
      this.ingest({
        roomId: input.roomId,
        participantId,
        occurredAt: input.occurredAt,
        delta: Object.freeze({
          vectorDelta: Object.freeze({
            notoriety: round(input.spotlightWeight * 0.45, 4),
            fear: round(input.pressureWeight * 0.22, 4),
            fascination: round(input.spotlightWeight * 0.18, 4),
          }),
          crowdExposureDelta: round(input.spotlightWeight * 0.62, 4),
          rivalryPressureBiasDelta: round(input.pressureWeight * 0.2, 4),
          reason: 'WORLD_EVENT',
          sourceKind: 'WORLD_EVENT',
          metadata: Object.freeze({ eventName: input.eventName }),
        }),
      }),
    ),
  );
};

export function deriveReputationDeltaFromCallback(input: {
  readonly actorId?: ReputationParticipantId;
  readonly targetId?: ReputationParticipantId;
  readonly exposedBoast?: boolean;
  readonly humiliatesTarget?: boolean;
}): ReputationDelta {
  return Object.freeze({
    vectorDelta: Object.freeze({
      rivalry: input.humiliatesTarget ? 4.4 : 2.1,
      bluffExposure: input.exposedBoast ? 6.4 : 1.4,
      notoriety: 3.8,
      fascination: 2.2,
      contempt: input.humiliatesTarget ? 3.6 : 0,
    }),
    crowdExposureDelta: input.exposedBoast ? 5.8 : 2.4,
    rivalryPressureBiasDelta: input.humiliatesTarget ? 4.8 : 2.1,
    reason: 'CALLBACK_TRIGGERED',
    sourceKind: 'CALLBACK',
    actorId: input.actorId,
    targetId: input.targetId,
  });
}

// ============================================================================
// MARK: Temporal window analysis
// ============================================================================

export interface ReputationTemporalWindow {
  readonly windowStartMs: ReputationUnixMs;
  readonly windowEndMs: ReputationUnixMs;
  readonly roomId: ReputationRoomId;
  readonly participantId: ReputationParticipantId;
  readonly entryCount: number;
  readonly averageRespect: number;
  readonly averageLegend: number;
  readonly averageRivalry: number;
  readonly averageBluffExposure: number;
  readonly averageCrowdExposure: number;
  readonly dominantReason: ReputationReason;
}

export function buildReputationTemporalWindows(
  entries: readonly ReputationEntry[],
  windowMs: number = 30_000,
): readonly ReputationTemporalWindow[] {
  if (!entries.length) return Object.freeze([]);
  const minTs = Math.min(...entries.map((e) => e.occurredAt));
  const maxTs = Math.max(...entries.map((e) => e.occurredAt));
  const results: ReputationTemporalWindow[] = [];

  const byParticipant = new Map<string, ReputationEntry[]>();
  for (const e of entries) {
    const key = `${e.roomId}:${e.participantId}`;
    const existing = byParticipant.get(key) ?? [];
    existing.push(e);
    byParticipant.set(key, existing);
  }

  for (const [key, pEntries] of byParticipant.entries()) {
    const [roomId, participantId] = key.split(':') as [ReputationRoomId, ReputationParticipantId];
    for (let start = minTs; start <= maxTs; start += windowMs) {
      const end = start + windowMs;
      const window = pEntries.filter((e) => e.occurredAt >= start && e.occurredAt < end);
      if (!window.length) continue;

      const reasonCounts = new Map<ReputationReason, number>();
      for (const e of window) {
        reasonCounts.set(e.delta.reason, (reasonCounts.get(e.delta.reason) ?? 0) + 1);
      }
      let dominantReason: ReputationReason = 'MANUAL';
      let dominantCount = 0;
      for (const [reason, count] of reasonCounts.entries()) {
        if (count > dominantCount) { dominantCount = count; dominantReason = reason; }
      }

      const n = Math.max(window.length, 1);
      results.push(Object.freeze({
        windowStartMs: asUnixMs(start),
        windowEndMs: asUnixMs(end),
        roomId,
        participantId,
        entryCount: window.length,
        averageRespect: round(window.reduce((acc, e) => acc + e.nextState.vector.respect, 0) / n, 4),
        averageLegend: round(window.reduce((acc, e) => acc + e.nextState.vector.legend, 0) / n, 4),
        averageRivalry: round(window.reduce((acc, e) => acc + e.nextState.vector.rivalry, 0) / n, 4),
        averageBluffExposure: round(window.reduce((acc, e) => acc + e.nextState.vector.bluffExposure, 0) / n, 4),
        averageCrowdExposure: round(window.reduce((acc, e) => acc + e.nextState.crowdExposure, 0) / n, 4),
        dominantReason,
      }));
    }
  }

  return Object.freeze(results.sort((a, b) => a.windowStartMs - b.windowStartMs));
}

// ============================================================================
// MARK: Momentum state
// ============================================================================

export interface ReputationMomentumState {
  readonly participantId: ReputationParticipantId;
  readonly roomId: ReputationRoomId;
  readonly legendTrend: 'RISING' | 'FALLING' | 'STABLE';
  readonly rivalryTrend: 'ESCALATING' | 'COOLING' | 'STABLE';
  readonly trustTrend: 'BUILDING' | 'ERODING' | 'STABLE';
  readonly exposureTrend: 'EXPANDING' | 'CONTRACTING' | 'STABLE';
  readonly overallMomentum: 'ASCENDING' | 'DESCENDING' | 'NEUTRAL';
  readonly sampledEntryCount: number;
  readonly sampledAt: ReputationUnixMs;
}

export function computeReputationMomentum(
  state: ReputationState,
  priorEntries: readonly ReputationEntry[],
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationMomentumState {
  const relevant = priorEntries
    .filter((e) => e.participantId === state.participantId && e.roomId === state.roomId)
    .slice(-6);

  function trend(values: number[]): 'RISING' | 'FALLING' | 'STABLE' | 'ESCALATING' | 'COOLING' | 'BUILDING' | 'ERODING' | 'EXPANDING' | 'CONTRACTING' {
    if (values.length < 2) return 'STABLE';
    const delta = values[values.length - 1] - values[0];
    if (Math.abs(delta) < 1) return 'STABLE';
    return delta > 0 ? 'RISING' : 'FALLING';
  }

  const legendValues = relevant.map((e) => e.nextState.vector.legend);
  const rivalryValues = relevant.map((e) => e.nextState.vector.rivalry);
  const trustValues = relevant.map((e) => e.nextState.vector.trust);
  const exposureValues = relevant.map((e) => e.nextState.crowdExposure);

  const legendTrend = trend(legendValues) === 'RISING' ? 'RISING' : trend(legendValues) === 'FALLING' ? 'FALLING' : 'STABLE';
  const rivalryTrend = trend(rivalryValues) === 'RISING' ? 'ESCALATING' : trend(rivalryValues) === 'FALLING' ? 'COOLING' : 'STABLE';
  const trustTrend = trend(trustValues) === 'RISING' ? 'BUILDING' : trend(trustValues) === 'FALLING' ? 'ERODING' : 'STABLE';
  const exposureTrend = trend(exposureValues) === 'RISING' ? 'EXPANDING' : trend(exposureValues) === 'FALLING' ? 'CONTRACTING' : 'STABLE';

  const positiveSignals = [legendTrend === 'RISING', trustTrend === 'BUILDING', exposureTrend === 'EXPANDING'].filter(Boolean).length;
  const negativeSignals = [legendTrend === 'FALLING', trustTrend === 'ERODING', rivalryTrend === 'ESCALATING'].filter(Boolean).length;
  const overallMomentum: ReputationMomentumState['overallMomentum'] =
    positiveSignals > negativeSignals ? 'ASCENDING' :
    negativeSignals > positiveSignals ? 'DESCENDING' : 'NEUTRAL';

  return Object.freeze({
    participantId: state.participantId,
    roomId: state.roomId,
    legendTrend,
    rivalryTrend,
    trustTrend,
    exposureTrend,
    overallMomentum,
    sampledEntryCount: relevant.length,
    sampledAt: now,
  });
}

// ============================================================================
// MARK: Diff
// ============================================================================

export interface ReputationStateDiff {
  readonly participantId: ReputationParticipantId;
  readonly roomId: ReputationRoomId;
  readonly vectorDeltas: Partial<Record<ReputationMetricKey, number>>;
  readonly crowdExposureDelta: number;
  readonly helperBiasDelta: number;
  readonly rivalryBiasDelta: number;
  readonly rescueBiasDelta: number;
  readonly auraChanged: boolean;
  readonly beforeAura: string;
  readonly afterAura: string;
}

export function diffReputationStates(
  before: ReputationState,
  after: ReputationState,
): ReputationStateDiff {
  const keys: ReputationMetricKey[] = ['respect', 'fear', 'contempt', 'fascination', 'trust', 'familiarity', 'rivalry', 'rescueDebt', 'notoriety', 'dealCredibility', 'bluffExposure', 'legend'];
  const vectorDeltas: Partial<Record<ReputationMetricKey, number>> = {};
  for (const key of keys) {
    const delta = round(after.vector[key] - before.vector[key], 4);
    if (delta !== 0) vectorDeltas[key] = delta;
  }

  return Object.freeze({
    participantId: after.participantId,
    roomId: after.roomId,
    vectorDeltas: Object.freeze(vectorDeltas),
    crowdExposureDelta: round(after.crowdExposure - before.crowdExposure, 4),
    helperBiasDelta: round(after.helperAvailabilityBias - before.helperAvailabilityBias, 4),
    rivalryBiasDelta: round(after.rivalryPressureBias - before.rivalryPressureBias, 4),
    rescueBiasDelta: round(after.rescueUrgencyBias - before.rescueUrgencyBias, 4),
    auraChanged: after.projectedAura !== before.projectedAura,
    beforeAura: before.projectedAura,
    afterAura: after.projectedAura,
  });
}

export function diffReputationSnapshots(
  before: ReputationSnapshot,
  after: ReputationSnapshot,
): readonly ReputationStateDiff[] {
  const diffs: ReputationStateDiff[] = [];
  const allIds = new Set([...Object.keys(before.participants), ...Object.keys(after.participants)]);
  for (const id of allIds) {
    const beforeState = before.participants[id];
    const afterState = after.participants[id];
    if (beforeState && afterState) {
      diffs.push(diffReputationStates(beforeState, afterState));
    }
  }
  return Object.freeze(diffs.sort((a, b) => Math.abs(Object.values(b.vectorDeltas).reduce((s, v) => s + Math.abs(v ?? 0), 0)) - Math.abs(Object.values(a.vectorDeltas).reduce((s, v) => s + Math.abs(v ?? 0), 0))));
}

// ============================================================================
// MARK: Annotation
// ============================================================================

export interface ReputationAnnotation {
  readonly roomId: ReputationRoomId;
  readonly participantId: ReputationParticipantId;
  readonly annotatedAtMs: ReputationUnixMs;
  readonly label: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly flagged: boolean;
}

const _reputationAnnotationMap = new Map<string, ReputationAnnotation>();

export function annotateReputationState(
  state: ReputationState,
  annotation: Omit<ReputationAnnotation, 'roomId' | 'participantId' | 'annotatedAtMs'>,
): ReputationAnnotation {
  const key = `${state.roomId}:${state.participantId}`;
  const record = Object.freeze({
    roomId: state.roomId,
    participantId: state.participantId,
    annotatedAtMs: asUnixMs(Date.now()),
    ...annotation,
  });
  _reputationAnnotationMap.set(key, record);
  return record;
}

export function getReputationAnnotation(
  roomId: ReputationRoomId,
  participantId: ReputationParticipantId,
): ReputationAnnotation | null {
  return _reputationAnnotationMap.get(`${roomId}:${participantId}`) ?? null;
}

export function listReputationAnnotations(): readonly ReputationAnnotation[] {
  return Object.freeze([..._reputationAnnotationMap.values()]);
}

export function listFlaggedReputationAnnotations(): readonly ReputationAnnotation[] {
  return Object.freeze([..._reputationAnnotationMap.values()].filter((a) => a.flagged));
}

// ============================================================================
// MARK: Hotspot detection
// ============================================================================

export interface ReputationHotspot {
  readonly roomId: ReputationRoomId;
  readonly participantId: ReputationParticipantId;
  readonly peakLegend: number;
  readonly peakRivalry: number;
  readonly peakBluffExposure: number;
  readonly peakCrowdExposure: number;
  readonly dominantAura: string;
  readonly entryCount: number;
}

export function detectReputationHotspots(
  entries: readonly ReputationEntry[],
  legendThreshold: number = 30,
): readonly ReputationHotspot[] {
  const byParticipant = new Map<string, ReputationEntry[]>();
  for (const e of entries) {
    const key = `${e.roomId}:${e.participantId}`;
    const existing = byParticipant.get(key) ?? [];
    existing.push(e);
    byParticipant.set(key, existing);
  }

  const hotspots: ReputationHotspot[] = [];
  for (const [key, pEntries] of byParticipant.entries()) {
    const [roomId, participantId] = key.split(':') as [ReputationRoomId, ReputationParticipantId];
    const hot = pEntries.filter((e) => e.nextState.vector.legend >= legendThreshold || e.nextState.vector.bluffExposure >= legendThreshold);
    if (!hot.length) continue;

    const peakLegend = Math.max(...hot.map((e) => e.nextState.vector.legend));
    const peakRivalry = Math.max(...hot.map((e) => e.nextState.vector.rivalry));
    const peakBluffExposure = Math.max(...hot.map((e) => e.nextState.vector.bluffExposure));
    const peakCrowdExposure = Math.max(...hot.map((e) => e.nextState.crowdExposure));
    const peakEntry = hot.reduce((best, e) => e.nextState.vector.legend > best.nextState.vector.legend ? e : best);

    hotspots.push(Object.freeze({
      roomId, participantId, peakLegend, peakRivalry, peakBluffExposure, peakCrowdExposure,
      dominantAura: peakEntry.nextState.projectedAura,
      entryCount: hot.length,
    }));
  }

  return Object.freeze(hotspots.sort((a, b) => b.peakLegend - a.peakLegend));
}

// ============================================================================
// MARK: Batch admit
// ============================================================================

export interface ReputationBatchAdmitResult {
  readonly processedCount: number;
  readonly entries: readonly ReputationEntry[];
  readonly errors: readonly string[];
}

export function batchAdmitReputationInputs(
  resolver: ReputationResolver,
  inputs: readonly ReputationInput[],
): ReputationBatchAdmitResult {
  const entries: ReputationEntry[] = [];
  const errors: string[] = [];
  for (const input of inputs) {
    try {
      entries.push(resolver.ingest(input));
    } catch (err) {
      errors.push(`Failed for ${input.participantId}@${input.occurredAt}: ${String(err)}`);
    }
  }
  return Object.freeze({ processedCount: entries.length, entries: Object.freeze(entries), errors: Object.freeze(errors) });
}

// ============================================================================
// MARK: Forecast
// ============================================================================

export interface ReputationForecast {
  readonly participantId: ReputationParticipantId;
  readonly roomId: ReputationRoomId;
  readonly predictedLegend: number;
  readonly predictedRivalry: number;
  readonly predictedTrust: number;
  readonly predictedBluffExposure: number;
  readonly predictedAura: string;
  readonly confidence: number;
  readonly generatedAt: ReputationUnixMs;
}

export function forecastReputation(
  state: ReputationState,
  priorEntries: readonly ReputationEntry[],
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationForecast {
  const relevant = priorEntries
    .filter((e) => e.participantId === state.participantId && e.roomId === state.roomId)
    .slice(-6);

  function projectMetric(current: number, values: number[]): number {
    if (values.length < 2) return current;
    const velocities = values.slice(1).map((v, i) => v - values[i]);
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    return round(clamp(current + avgVelocity * 3, 0, 100), 4);
  }

  const legendValues = relevant.map((e) => e.nextState.vector.legend);
  const rivalryValues = relevant.map((e) => e.nextState.vector.rivalry);
  const trustValues = relevant.map((e) => e.nextState.vector.trust);
  const bluffValues = relevant.map((e) => e.nextState.vector.bluffExposure);

  const predictedLegend = projectMetric(state.vector.legend, legendValues);
  const predictedRivalry = projectMetric(state.vector.rivalry, rivalryValues);
  const predictedTrust = projectMetric(state.vector.trust, trustValues);
  const predictedBluffExposure = projectMetric(state.vector.bluffExposure, bluffValues);
  const predictedVector = { ...state.vector, legend: predictedLegend, rivalry: predictedRivalry, trust: predictedTrust, bluffExposure: predictedBluffExposure };
  const predictedAura = computeProjectedAura(predictedVector as ReputationVector);
  const confidence = round(clamp(relevant.length / 6, 0, 1), 4);

  return Object.freeze({
    participantId: state.participantId,
    roomId: state.roomId,
    predictedLegend,
    predictedRivalry,
    predictedTrust,
    predictedBluffExposure,
    predictedAura,
    confidence,
    generatedAt: now,
  });
}

// ============================================================================
// MARK: Ledger stats
// ============================================================================

export interface ReputationLedgerStats {
  readonly roomId: ReputationRoomId;
  readonly participantCount: number;
  readonly entryCount: number;
  readonly averageLegend: number;
  readonly averageRespect: number;
  readonly averageTrust: number;
  readonly averageRivalry: number;
  readonly averageBluffExposure: number;
  readonly averageCrowdExposure: number;
  readonly auraDistribution: Readonly<Record<string, number>>;
  readonly dominantReason: ReputationReason;
  readonly generatedAt: ReputationUnixMs;
}

export function buildReputationLedgerStats(
  snapshot: ReputationSnapshot,
  entries: readonly ReputationEntry[],
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationLedgerStats {
  const states = Object.values(snapshot.participants);
  const n = Math.max(states.length, 1);

  const auraDist: Record<string, number> = {};
  for (const s of states) { auraDist[s.projectedAura] = (auraDist[s.projectedAura] ?? 0) + 1; }

  const roomEntries = entries.filter((e) => e.roomId === snapshot.roomId);
  const reasonCounts = new Map<ReputationReason, number>();
  for (const e of roomEntries) { reasonCounts.set(e.delta.reason, (reasonCounts.get(e.delta.reason) ?? 0) + 1); }
  let dominantReason: ReputationReason = 'MANUAL';
  let dominantCount = 0;
  for (const [reason, count] of reasonCounts.entries()) {
    if (count > dominantCount) { dominantCount = count; dominantReason = reason; }
  }

  return Object.freeze({
    roomId: snapshot.roomId,
    participantCount: states.length,
    entryCount: roomEntries.length,
    averageLegend: round(states.reduce((acc, s) => acc + s.vector.legend, 0) / n, 4),
    averageRespect: round(states.reduce((acc, s) => acc + s.vector.respect, 0) / n, 4),
    averageTrust: round(states.reduce((acc, s) => acc + s.vector.trust, 0) / n, 4),
    averageRivalry: round(states.reduce((acc, s) => acc + s.vector.rivalry, 0) / n, 4),
    averageBluffExposure: round(states.reduce((acc, s) => acc + s.vector.bluffExposure, 0) / n, 4),
    averageCrowdExposure: round(states.reduce((acc, s) => acc + s.crowdExposure, 0) / n, 4),
    auraDistribution: Object.freeze(auraDist),
    dominantReason,
    generatedAt: now,
  });
}

// ============================================================================
// MARK: Volatility index
// ============================================================================

export interface ReputationVolatilityIndex {
  readonly participantId: ReputationParticipantId;
  readonly roomId: ReputationRoomId;
  readonly legendVariance: number;
  readonly rivalryVariance: number;
  readonly trustVariance: number;
  readonly volatilityTier: 'STABLE' | 'FLUCTUATING' | 'VOLATILE' | 'CHAOTIC';
  readonly isVolatile: boolean;
  readonly sampledEntryCount: number;
}

export function computeReputationVolatility(
  entries: readonly ReputationEntry[],
): readonly ReputationVolatilityIndex[] {
  const byParticipant = new Map<string, ReputationEntry[]>();
  for (const e of entries) {
    const key = `${e.roomId}:${e.participantId}`;
    const existing = byParticipant.get(key) ?? [];
    existing.push(e);
    byParticipant.set(key, existing);
  }

  const results: ReputationVolatilityIndex[] = [];
  for (const [key, pEntries] of byParticipant.entries()) {
    const [roomId, participantId] = key.split(':') as [ReputationRoomId, ReputationParticipantId];
    if (pEntries.length < 2) {
      results.push(Object.freeze({ participantId, roomId, legendVariance: 0, rivalryVariance: 0, trustVariance: 0, volatilityTier: 'STABLE', isVolatile: false, sampledEntryCount: pEntries.length }));
      continue;
    }
    const legend = pEntries.map((e) => e.nextState.vector.legend);
    const rivalry = pEntries.map((e) => e.nextState.vector.rivalry);
    const trust = pEntries.map((e) => e.nextState.vector.trust);
    const variance = (vals: number[]) => { const m = vals.reduce((a, b) => a + b, 0) / vals.length; return round(vals.reduce((acc, v) => acc + (v - m) ** 2, 0) / vals.length, 4); };
    const lv = variance(legend); const rv = variance(rivalry); const tv = variance(trust);
    const composite = lv * 0.5 + rv * 0.3 + tv * 0.2;
    const volatilityTier: ReputationVolatilityIndex['volatilityTier'] = composite >= 400 ? 'CHAOTIC' : composite >= 150 ? 'VOLATILE' : composite >= 50 ? 'FLUCTUATING' : 'STABLE';
    results.push(Object.freeze({ participantId, roomId, legendVariance: lv, rivalryVariance: rv, trustVariance: tv, volatilityTier, isVolatile: composite >= 150, sampledEntryCount: pEntries.length }));
  }
  return Object.freeze(results.sort((a, b) => b.legendVariance - a.legendVariance));
}

// ============================================================================
// MARK: Profile system
// ============================================================================

export type ReputationResolverProfile = 'STANDARD' | 'COMPACT' | 'FORENSIC' | 'HIGH_VOLUME' | 'PRESTIGE_FIRST';

export interface ReputationResolverProfileDescriptor {
  readonly name: ReputationResolverProfile;
  readonly description: string;
  readonly options: ReputationResolverOptions;
}

const REPUTATION_RESOLVER_PROFILE_DESCRIPTORS: readonly ReputationResolverProfileDescriptor[] = [
  { name: 'STANDARD', description: 'Balanced reputation resolution for general gameplay.', options: {} },
  { name: 'COMPACT', description: 'Reduced retention for performance contexts.', options: { maxEntriesPerRoom: 2_048 } },
  { name: 'FORENSIC', description: 'Maximum retention for audit and replay.', options: { maxEntriesPerRoom: 24_576 } },
  { name: 'HIGH_VOLUME', description: 'Optimized for high-frequency event streams.', options: { maxEntriesPerRoom: 4_096 } },
  { name: 'PRESTIGE_FIRST', description: 'Extended retention with legend-weighted resolution.', options: { maxEntriesPerRoom: 16_384 } },
] as const;

export const REPUTATION_RESOLVER_DOCTRINE = Object.freeze({
  authority: 'BACKEND' as const,
  version: '2026.03.23-reputation-resolver-doctrine.v1',
  maxVectorScore: 100,
  auraThresholds: { ASCENDANT: 80, DOMINANT: 60, PRESSURING: 40, NOTICED: 20 },
  supportedProfiles: ['STANDARD', 'COMPACT', 'FORENSIC', 'HIGH_VOLUME', 'PRESTIGE_FIRST'] as const,
});

// ============================================================================
// MARK: Module objects
// ============================================================================

export const ChatReputationResolverModule = Object.freeze({
  create: (options?: ReputationResolverOptions): ReputationResolver => new ReputationResolver(options),
  createCompact: (): ReputationResolver => new ReputationResolver(REPUTATION_RESOLVER_PROFILE_DESCRIPTORS.find((p) => p.name === 'COMPACT')!.options),
  createForensic: (): ReputationResolver => new ReputationResolver(REPUTATION_RESOLVER_PROFILE_DESCRIPTORS.find((p) => p.name === 'FORENSIC')!.options),
  createHighVolume: (): ReputationResolver => new ReputationResolver(REPUTATION_RESOLVER_PROFILE_DESCRIPTORS.find((p) => p.name === 'HIGH_VOLUME')!.options),
  createPrestigeFirst: (): ReputationResolver => new ReputationResolver(REPUTATION_RESOLVER_PROFILE_DESCRIPTORS.find((p) => p.name === 'PRESTIGE_FIRST')!.options),
  batchAdmit: batchAdmitReputationInputs,
  buildTemporalWindows: buildReputationTemporalWindows,
  computeMomentum: computeReputationMomentum,
  diffStates: diffReputationStates,
  diffSnapshots: diffReputationSnapshots,
  annotate: annotateReputationState,
  getAnnotation: getReputationAnnotation,
  listAnnotated: listReputationAnnotations,
  listFlagged: listFlaggedReputationAnnotations,
  detectHotspots: detectReputationHotspots,
  forecast: forecastReputation,
  buildLedgerStats: buildReputationLedgerStats,
  computeVolatility: computeReputationVolatility,
  deriveFromProof: deriveReputationDeltaFromProof,
  deriveFromQuote: deriveReputationDeltaFromQuote,
  deriveFromDeal: deriveReputationDeltaFromDeal,
  deriveFromCallback: deriveReputationDeltaFromCallback,
  doctrine: REPUTATION_RESOLVER_DOCTRINE,
} as const);

export const ChatReputationResolverProfileModule = Object.freeze({
  all: (): readonly ReputationResolverProfileDescriptor[] => REPUTATION_RESOLVER_PROFILE_DESCRIPTORS,
  byName: (name: ReputationResolverProfile): ReputationResolverProfileDescriptor | undefined =>
    REPUTATION_RESOLVER_PROFILE_DESCRIPTORS.find((p) => p.name === name),
  STANDARD: REPUTATION_RESOLVER_PROFILE_DESCRIPTORS[0],
  COMPACT: REPUTATION_RESOLVER_PROFILE_DESCRIPTORS[1],
  FORENSIC: REPUTATION_RESOLVER_PROFILE_DESCRIPTORS[2],
  HIGH_VOLUME: REPUTATION_RESOLVER_PROFILE_DESCRIPTORS[3],
  PRESTIGE_FIRST: REPUTATION_RESOLVER_PROFILE_DESCRIPTORS[4],
} as const);

// ============================================================================
// MARK: Export envelope
// ============================================================================

export interface ReputationExportEnvelopeFull {
  readonly snapshot: ReputationSnapshot;
  readonly entries: readonly ReputationEntry[];
  readonly diagnostics: ReputationDiagnostics;
  readonly carryover: ReputationCarryoverSummary;
  readonly stats: ReputationLedgerStats;
  readonly hotspots: readonly ReputationHotspot[];
  readonly annotations: readonly ReputationAnnotation[];
  readonly exportedAt: ReputationUnixMs;
}

export function exportReputationEnvelopeFull(
  resolver: ReputationResolver,
  roomId: ReputationRoomId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationExportEnvelopeFull {
  const snapshot = resolver.getSnapshot(roomId, now);
  const entries = [...(resolver.roomEntries.get(roomId) ?? [])];
  const diagnostics = resolver.getDiagnostics(roomId, now);
  const carryover = resolver.getCarryoverSummary(roomId, now);
  const stats = buildReputationLedgerStats(snapshot, entries, now);
  const hotspots = detectReputationHotspots(entries);
  const annotations = listReputationAnnotations().filter((a) => a.roomId === roomId);

  return Object.freeze({ snapshot, entries: Object.freeze(entries), diagnostics, carryover, stats, hotspots, annotations, exportedAt: now });
}

// ============================================================================
// MARK: Rebuild audit
// ============================================================================

export interface ReputationRebuildResult {
  readonly roomId: ReputationRoomId;
  readonly processedParticipantCount: number;
  readonly entryCount: number;
  readonly hotspots: readonly ReputationHotspot[];
  readonly stats: ReputationLedgerStats;
  readonly volatility: readonly ReputationVolatilityIndex[];
  readonly rebuiltAtMs: ReputationUnixMs;
}

export function rebuildAndAuditReputation(
  resolver: ReputationResolver,
  roomId: ReputationRoomId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationRebuildResult {
  const snapshot = resolver.getSnapshot(roomId, now);
  const entries = [...(resolver.roomEntries.get(roomId) ?? [])];
  const stats = buildReputationLedgerStats(snapshot, entries, now);
  const hotspots = detectReputationHotspots(entries);
  const volatility = computeReputationVolatility(entries);

  return Object.freeze({
    roomId,
    processedParticipantCount: Object.keys(snapshot.participants).length,
    entryCount: entries.length,
    hotspots,
    stats,
    volatility,
    rebuiltAtMs: now,
  });
}

// ============================================================================
// MARK: Channel-specific projection helpers
// ============================================================================

export function projectReputationToChannel(
  resolver: ReputationResolver,
  roomId: ReputationRoomId,
  participantId: ReputationParticipantId,
  channelId: ReputationChannelId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationChannelProjection {
  return resolver.getChannelProjection(roomId, participantId, channelId, now);
}

export function buildAllChannelProjections(
  resolver: ReputationResolver,
  roomId: ReputationRoomId,
  participantId: ReputationParticipantId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): readonly ReputationChannelProjection[] {
  const channels: ReputationChannelId[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'SYSTEM_SHADOW', 'NPC_SHADOW', 'RIVALRY_SHADOW', 'RESCUE_SHADOW', 'LIVEOPS_SHADOW'];
  return Object.freeze(channels.map((c) => resolver.getChannelProjection(roomId, participantId, c, now)));
}

// ============================================================================
// MARK: Conflict graph
// ============================================================================

export interface ReputationConflictGraph {
  readonly roomId: ReputationRoomId;
  readonly edges: readonly ReputationConflictPair[];
  readonly mostConnectedParticipantId: ReputationParticipantId | null;
  readonly edgeCount: number;
  readonly averagePressure: number;
  readonly generatedAt: ReputationUnixMs;
}

export function buildReputationConflictGraph(
  resolver: ReputationResolver,
  roomId: ReputationRoomId,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationConflictGraph {
  const pairs = resolver.resolveConflictPairs(roomId, now);
  const connectionCount = new Map<string, number>();
  for (const pair of pairs) {
    connectionCount.set(pair.leftParticipantId, (connectionCount.get(pair.leftParticipantId) ?? 0) + 1);
    connectionCount.set(pair.rightParticipantId, (connectionCount.get(pair.rightParticipantId) ?? 0) + 1);
  }

  let mostConnected: ReputationParticipantId | null = null;
  let maxConnections = 0;
  for (const [id, count] of connectionCount.entries()) {
    if (count > maxConnections) { maxConnections = count; mostConnected = id as ReputationParticipantId; }
  }

  const avgPressure = pairs.length > 0
    ? round(pairs.reduce((acc, p) => acc + p.pressure, 0) / pairs.length, 4)
    : 0;

  return Object.freeze({
    roomId,
    edges: pairs,
    mostConnectedParticipantId: mostConnected,
    edgeCount: pairs.length,
    averagePressure: avgPressure,
    generatedAt: now,
  });
}

// ============================================================================
// MARK: Sorting and filtering helpers
// ============================================================================

export function filterEntriesByParticipant(
  entries: readonly ReputationEntry[],
  participantId: ReputationParticipantId,
): readonly ReputationEntry[] {
  return Object.freeze(entries.filter((e) => e.participantId === participantId));
}

export function filterEntriesByReason(
  entries: readonly ReputationEntry[],
  reason: ReputationReason,
): readonly ReputationEntry[] {
  return Object.freeze(entries.filter((e) => e.delta.reason === reason));
}

export function sortEntriesByLegend(
  entries: readonly ReputationEntry[],
  descending = true,
): readonly ReputationEntry[] {
  return Object.freeze(
    [...entries].sort((a, b) =>
      descending
        ? b.nextState.vector.legend - a.nextState.vector.legend
        : a.nextState.vector.legend - b.nextState.vector.legend,
    ),
  );
}

export function sortStatesByAura(
  states: readonly ReputationState[],
): readonly ReputationState[] {
  const auraOrder = ['ASCENDANT', 'DOMINANT', 'PRESSURING', 'NOTICED', 'NEUTRAL', 'EXPOSED'];
  return Object.freeze(
    [...states].sort((a, b) => auraOrder.indexOf(a.projectedAura) - auraOrder.indexOf(b.projectedAura)),
  );
}

// ============================================================================
// MARK: Carryover policy helpers
// ============================================================================

export interface ReputationCarryoverPolicy {
  readonly decayPercentage: number;
  readonly legendRetentionPercentage: number;
  readonly rivalryRetentionPercentage: number;
  readonly trustRetentionPercentage: number;
  readonly bluffExposureRetentionPercentage: number;
  readonly resetCrowdExposure: boolean;
  readonly resetBiases: boolean;
}

const DEFAULT_CARRYOVER_POLICY: ReputationCarryoverPolicy = Object.freeze({
  decayPercentage: 0.35,
  legendRetentionPercentage: 0.75,
  rivalryRetentionPercentage: 0.55,
  trustRetentionPercentage: 0.6,
  bluffExposureRetentionPercentage: 0.4,
  resetCrowdExposure: true,
  resetBiases: false,
});

export function applyCarryoverPolicy(
  state: ReputationState,
  policy: ReputationCarryoverPolicy = DEFAULT_CARRYOVER_POLICY,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationState {
  const nextVector: ReputationVector = Object.freeze({
    respect: round(state.vector.respect * (1 - policy.decayPercentage), 4),
    fear: round(state.vector.fear * (1 - policy.decayPercentage), 4),
    contempt: round(state.vector.contempt * (1 - policy.decayPercentage), 4),
    fascination: round(state.vector.fascination * (1 - policy.decayPercentage), 4),
    trust: round(state.vector.trust * policy.trustRetentionPercentage, 4),
    familiarity: round(state.vector.familiarity * (1 - policy.decayPercentage * 0.5), 4),
    rivalry: round(state.vector.rivalry * policy.rivalryRetentionPercentage, 4),
    rescueDebt: round(state.vector.rescueDebt * (1 - policy.decayPercentage * 0.8), 4),
    notoriety: round(state.vector.notoriety * (1 - policy.decayPercentage * 1.1), 4),
    dealCredibility: round(state.vector.dealCredibility * (1 - policy.decayPercentage * 0.9), 4),
    bluffExposure: round(state.vector.bluffExposure * policy.bluffExposureRetentionPercentage, 4),
    legend: round(state.vector.legend * policy.legendRetentionPercentage, 4),
  });

  return Object.freeze({
    ...state,
    vector: nextVector,
    projectedAura: computeProjectedAura(nextVector),
    crowdExposure: policy.resetCrowdExposure ? 0 : state.crowdExposure,
    helperAvailabilityBias: policy.resetBiases ? 0 : state.helperAvailabilityBias,
    rivalryPressureBias: policy.resetBiases ? 0 : state.rivalryPressureBias,
    rescueUrgencyBias: policy.resetBiases ? 0 : state.rescueUrgencyBias,
    lastUpdatedAt: now,
    lastReason: 'MANUAL',
  });
}

export function applyCarryoverToSnapshot(
  snapshot: ReputationSnapshot,
  policy: ReputationCarryoverPolicy = DEFAULT_CARRYOVER_POLICY,
  now: ReputationUnixMs = asUnixMs(Date.now()),
): ReputationSnapshot {
  const nextParticipants: Record<string, ReputationState> = {};
  for (const [id, state] of Object.entries(snapshot.participants)) {
    nextParticipants[id] = applyCarryoverPolicy(state, policy, now);
  }
  return Object.freeze({ roomId: snapshot.roomId, participants: Object.freeze(nextParticipants), exportedAt: now });
}

export function deriveCarryoverSummaryFromPolicy(
  snapshot: ReputationSnapshot,
  policy: ReputationCarryoverPolicy = DEFAULT_CARRYOVER_POLICY,
): { readonly retainedCount: number; readonly resetCount: number; readonly averageLegendRetained: number } {
  const states = Object.values(snapshot.participants);
  const n = Math.max(states.length, 1);
  const averageLegendRetained = round(
    states.reduce((acc, s) => acc + s.vector.legend * policy.legendRetentionPercentage, 0) / n,
    4,
  );
  return Object.freeze({
    retainedCount: states.length,
    resetCount: policy.resetCrowdExposure ? states.length : 0,
    averageLegendRetained,
  });
}

export function getTopLegendParticipants(
  snapshot: ReputationSnapshot,
  limit: number = 5,
): readonly ReputationState[] {
  return Object.freeze(
    Object.values(snapshot.participants)
      .sort((a, b) => b.vector.legend - a.vector.legend)
      .slice(0, limit),
  );
}

export function getTopRivalryParticipants(
  snapshot: ReputationSnapshot,
  limit: number = 5,
): readonly ReputationState[] {
  return Object.freeze(
    Object.values(snapshot.participants)
      .sort((a, b) => b.vector.rivalry - a.vector.rivalry)
      .slice(0, limit),
  );
}

export function getTopBluffExposureParticipants(
  snapshot: ReputationSnapshot,
  limit: number = 5,
): readonly ReputationState[] {
  return Object.freeze(
    Object.values(snapshot.participants)
      .sort((a, b) => b.vector.bluffExposure - a.vector.bluffExposure)
      .slice(0, limit),
  );
}

export { DEFAULT_CARRYOVER_POLICY as REPUTATION_DEFAULT_CARRYOVER_POLICY };

export function countParticipantsByAura(
  snapshot: ReputationSnapshot,
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const state of Object.values(snapshot.participants)) {
    counts[state.projectedAura] = (counts[state.projectedAura] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

export function filterParticipantsByAura(
  snapshot: ReputationSnapshot,
  aura: string,
): readonly ReputationState[] {
  return Object.freeze(Object.values(snapshot.participants).filter((s) => s.projectedAura === aura));
}
