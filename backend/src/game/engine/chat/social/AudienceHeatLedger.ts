/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SOCIAL LANE
 * FILE: backend/src/game/engine/chat/social/AudienceHeatLedger.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend authority for audience heat state across chat-visible and shadow
 * channels. This file is intentionally stateful and ledger-oriented.
 *
 * Design constraints
 * ------------------
 * - Preserve the existing backend chat engine ownership model.
 * - Treat shared/contracts/chat as the durable contract authority.
 * - Keep this file backend-authoritative: no React, no browser storage, no UI.
 * - Support visible channels and shadow channels as first-class citizens.
 * - Turn gameplay, messaging, proof, rescue, rivalry, scene, and world-event
 *   inputs into durable heat state that can drive orchestration.
 * - Keep witness math and decay deterministic.
 * - Maintain a complete audit trail for debugging, replay, and moderation.
 *
 * This file is purposely deep. The goal is not a thin helper; the goal is a
 * complete backend authority that other chat systems can depend on.
 * ============================================================================
 */

/* eslint-disable max-lines */
/* eslint-disable @typescript-eslint/consistent-type-definitions */

export type LedgerUnixMs = number & { readonly __brand: 'LedgerUnixMs' };
export type LedgerRoomId = string & { readonly __brand: 'LedgerRoomId' };
export type LedgerChannelId = string & { readonly __brand: 'LedgerChannelId' };
export type LedgerParticipantId = string & { readonly __brand: 'LedgerParticipantId' };
export type LedgerEntryId = string & { readonly __brand: 'LedgerEntryId' };
export type LedgerSceneId = string & { readonly __brand: 'LedgerSceneId' };
export type LedgerMomentId = string & { readonly __brand: 'LedgerMomentId' };
export type LedgerProofHash = string & { readonly __brand: 'LedgerProofHash' };

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type AudienceVisibleChannel = 'GLOBAL' | 'SYNDICATE' | 'DEAL_ROOM' | 'LOBBY';
export type AudienceShadowChannel =
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW';
export type AudienceChannelId = AudienceVisibleChannel | AudienceShadowChannel;

export type AudienceHeatBand =
  | 'FROZEN'
  | 'LOW'
  | 'WARM'
  | 'RISING'
  | 'HOT'
  | 'BLAZING'
  | 'FERAL';

export type AudienceHeatVectorKey =
  | 'hype'
  | 'ridicule'
  | 'fear'
  | 'pressure'
  | 'suspicion'
  | 'conspiracy'
  | 'predation'
  | 'sympathy'
  | 'legend'
  | 'chaos';

export type AudienceWitnessKind =
  | 'SYSTEM'
  | 'RIVAL'
  | 'HELPER'
  | 'CROWD'
  | 'DEALER'
  | 'SPECTATOR'
  | 'LIVEOPS';

export type AudienceHeatSourceKind =
  | 'MESSAGE'
  | 'SCENE'
  | 'MOMENT'
  | 'PROOF'
  | 'COUNTERPLAY'
  | 'RESCUE'
  | 'RELATIONSHIP'
  | 'WORLD_EVENT'
  | 'NEGOTIATION'
  | 'RUN_STATE'
  | 'MANUAL';

export type AudienceTransitionReason =
  | 'MESSAGE_INGESTED'
  | 'SCENE_OPENED'
  | 'SCENE_PROGRESS'
  | 'SCENE_CLOSED'
  | 'RUN_PRESSURE_SHIFT'
  | 'RUN_COLLAPSE_WARNING'
  | 'RUN_COMEBACK'
  | 'RUN_SOVEREIGNTY'
  | 'PROOF_PUBLISHED'
  | 'NEGOTIATION_LEAK'
  | 'RESCUE_INTERVENTION'
  | 'RIVALRY_ESCALATION'
  | 'WORLD_EVENT'
  | 'DECAY'
  | 'ROLLUP'
  | 'MANUAL';

export type AudiencePresenceState = 'ABSENT' | 'LURKING' | 'WATCHING' | 'SWARMING';

export interface AudienceHeatVector {
  readonly hype: number;
  readonly ridicule: number;
  readonly fear: number;
  readonly pressure: number;
  readonly suspicion: number;
  readonly conspiracy: number;
  readonly predation: number;
  readonly sympathy: number;
  readonly legend: number;
  readonly chaos: number;
}

export interface AudienceThresholds {
  readonly warm: number;
  readonly rising: number;
  readonly hot: number;
  readonly blazing: number;
  readonly feral: number;
}

export interface AudienceDecayPolicy {
  readonly msPerTick: number;
  readonly passiveDecayPerTick: number;
  readonly activeDecayPerTick: number;
  readonly shadowDecayMultiplier: number;
  readonly visibleDecayMultiplier: number;
  readonly postSceneGraceMs: number;
  readonly worldEventLockMs: number;
}

export interface AudienceWitnessWindow {
  readonly kind: AudienceWitnessKind;
  readonly participantId?: LedgerParticipantId;
  readonly openedAt: LedgerUnixMs;
  readonly closesAt: LedgerUnixMs;
  readonly weight: number;
  readonly visibility: 'PUBLIC' | 'PRIVATE' | 'SHADOW_ONLY';
}

export interface AudienceHeatState {
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly score: number;
  readonly band: AudienceHeatBand;
  readonly presence: AudiencePresenceState;
  readonly vector: AudienceHeatVector;
  readonly crowdVelocity: number;
  readonly witnessDensity: number;
  readonly witnessWindows: readonly AudienceWitnessWindow[];
  readonly lastTransitionReason: AudienceTransitionReason;
  readonly lastUpdatedAt: LedgerUnixMs;
  readonly lastNonDecayAt: LedgerUnixMs;
  readonly lastSceneId?: LedgerSceneId;
  readonly lastMomentId?: LedgerMomentId;
  readonly lockUntil?: LedgerUnixMs;
  readonly shadowMirrors: readonly AudienceShadowChannel[];
  readonly metadata: Readonly<JsonObject>;
}

export interface AudienceHeatDelta {
  readonly scoreDelta: number;
  readonly vectorDelta: Partial<Record<AudienceHeatVectorKey, number>>;
  readonly crowdVelocityDelta?: number;
  readonly witnessDensityDelta?: number;
  readonly presenceOverride?: AudiencePresenceState;
  readonly reason: AudienceTransitionReason;
  readonly sourceKind: AudienceHeatSourceKind;
  readonly sceneId?: LedgerSceneId;
  readonly momentId?: LedgerMomentId;
  readonly proofHash?: LedgerProofHash;
  readonly actorId?: LedgerParticipantId;
  readonly targetId?: LedgerParticipantId;
  readonly metadata?: Readonly<JsonObject>;
}

export interface AudienceHeatInput {
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly occurredAt: LedgerUnixMs;
  readonly delta: AudienceHeatDelta;
  readonly witnessWindows?: readonly AudienceWitnessWindow[];
}

export interface AudienceHeatEntry {
  readonly entryId: LedgerEntryId;
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly occurredAt: LedgerUnixMs;
  readonly previousState: AudienceHeatState;
  readonly nextState: AudienceHeatState;
  readonly delta: AudienceHeatDelta;
}

export interface AudienceRoomSnapshot {
  readonly roomId: LedgerRoomId;
  readonly channels: Readonly<Record<AudienceChannelId, AudienceHeatState>>;
  readonly hottestChannelId: AudienceChannelId;
  readonly coldestChannelId: AudienceChannelId;
  readonly averageHeatScore: number;
  readonly roomPressureIndex: number;
  readonly roomWitnessIndex: number;
  readonly exportedAt: LedgerUnixMs;
}

export interface AudienceHeatSummary {
  readonly roomId: LedgerRoomId;
  readonly hottestVisibleChannel: AudienceVisibleChannel;
  readonly hottestShadowChannel: AudienceShadowChannel;
  readonly pressureIndex: number;
  readonly mockeryIndex: number;
  readonly legendIndex: number;
  readonly rescueNeedIndex: number;
  readonly dealPredationIndex: number;
  readonly syndicateConspiracyIndex: number;
  readonly generatedAt: LedgerUnixMs;
}

export interface AudienceHeatDiagnostics {
  readonly roomId: LedgerRoomId;
  readonly entryCount: number;
  readonly visibleChannelCount: number;
  readonly shadowChannelCount: number;
  readonly averageVelocity: number;
  readonly witnessWindowCount: number;
  readonly lockedChannelCount: number;
  readonly hottestScoreSeen: number;
  readonly lastUpdatedAt?: LedgerUnixMs;
}

export interface AudienceHeatLedgerOptions {
  readonly now?: () => number;
  readonly thresholds?: Partial<AudienceThresholds>;
  readonly decayPolicy?: Partial<AudienceDecayPolicy>;
  readonly maxEntriesPerRoom?: number;
  readonly maxWitnessWindowsPerChannel?: number;
  readonly maxMetadataKeys?: number;
  readonly enableShadowMirrors?: boolean;
}

const VISIBLE_CHANNELS: readonly AudienceVisibleChannel[] = [
  'GLOBAL',
  'SYNDICATE',
  'DEAL_ROOM',
  'LOBBY',
] as const;

const SHADOW_CHANNELS: readonly AudienceShadowChannel[] = [
  'SYSTEM_SHADOW',
  'NPC_SHADOW',
  'RIVALRY_SHADOW',
  'RESCUE_SHADOW',
  'LIVEOPS_SHADOW',
] as const;

const ALL_CHANNELS: readonly AudienceChannelId[] = [
  ...VISIBLE_CHANNELS,
  ...SHADOW_CHANNELS,
] as const;

const DEFAULT_THRESHOLDS: AudienceThresholds = Object.freeze({
  warm: 14,
  rising: 28,
  hot: 48,
  blazing: 72,
  feral: 92,
});

const DEFAULT_DECAY_POLICY: AudienceDecayPolicy = Object.freeze({
  msPerTick: 5_000,
  passiveDecayPerTick: 0.55,
  activeDecayPerTick: 0.22,
  shadowDecayMultiplier: 0.82,
  visibleDecayMultiplier: 1,
  postSceneGraceMs: 18_000,
  worldEventLockMs: 20_000,
});

const DEFAULT_MAX_ENTRIES_PER_ROOM = 8_192;
const DEFAULT_MAX_WITNESS_WINDOWS_PER_CHANNEL = 96;
const DEFAULT_MAX_METADATA_KEYS = 48;

function asUnixMs(value: number): LedgerUnixMs {
  return value as LedgerUnixMs;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function safeRound(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function shallowCloneObject<T extends JsonObject>(value?: Readonly<T>): Readonly<T> {
  if (!value) {
    return {} as Readonly<T>;
  }
  return Object.freeze({ ...(value as JsonObject) }) as Readonly<T>;
}

function createEntryId(now: LedgerUnixMs, roomId: LedgerRoomId, channelId: AudienceChannelId): LedgerEntryId {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `${roomId}:${channelId}:${now}:${entropy}` as LedgerEntryId;
}

function isShadowChannel(channelId: AudienceChannelId): channelId is AudienceShadowChannel {
  return (SHADOW_CHANNELS as readonly string[]).includes(channelId);
}

function defaultVector(): AudienceHeatVector {
  return {
    hype: 0,
    ridicule: 0,
    fear: 0,
    pressure: 0,
    suspicion: 0,
    conspiracy: 0,
    predation: 0,
    sympathy: 0,
    legend: 0,
    chaos: 0,
  };
}

function vectorScore(vector: AudienceHeatVector): number {
  return safeRound(
    vector.hype * 0.9 +
      vector.ridicule * 1.05 +
      vector.fear * 0.95 +
      vector.pressure * 1.15 +
      vector.suspicion * 0.75 +
      vector.conspiracy * 0.72 +
      vector.predation * 1.2 +
      vector.sympathy * 0.55 +
      vector.legend * 0.8 +
      vector.chaos * 1.05,
    4,
  );
}

function bandFromScore(score: number, thresholds: AudienceThresholds): AudienceHeatBand {
  if (score >= thresholds.feral) return 'FERAL';
  if (score >= thresholds.blazing) return 'BLAZING';
  if (score >= thresholds.hot) return 'HOT';
  if (score >= thresholds.rising) return 'RISING';
  if (score >= thresholds.warm) return 'WARM';
  if (score > 0) return 'LOW';
  return 'FROZEN';
}

function presenceFromScore(score: number, band: AudienceHeatBand): AudiencePresenceState {
  if (band === 'FERAL' || band === 'BLAZING') return 'SWARMING';
  if (band === 'HOT' || band === 'RISING') return 'WATCHING';
  if (score > 0) return 'LURKING';
  return 'ABSENT';
}

function normalizeWitnessWindows(
  windows: readonly AudienceWitnessWindow[] | undefined,
  maxWindows: number,
  now: LedgerUnixMs,
): readonly AudienceWitnessWindow[] {
  if (!windows?.length) return [];
  return Object.freeze(
    windows
      .filter((window) => window.closesAt > now && window.weight > 0)
      .slice(0, maxWindows)
      .map((window) => Object.freeze({ ...window })),
  );
}

function mergeWitnessWindows(
  current: readonly AudienceWitnessWindow[],
  incoming: readonly AudienceWitnessWindow[],
  maxWindows: number,
  now: LedgerUnixMs,
): readonly AudienceWitnessWindow[] {
  const combined = [...current, ...incoming]
    .filter((window) => window.closesAt > now && window.weight > 0)
    .sort((a, b) => b.weight - a.weight || b.closesAt - a.closesAt)
    .slice(0, maxWindows)
    .map((window) => Object.freeze({ ...window }));
  return Object.freeze(combined);
}

function computeWitnessDensity(windows: readonly AudienceWitnessWindow[]): number {
  if (!windows.length) return 0;
  const total = windows.reduce((sum, window) => sum + clamp(window.weight, 0, 10), 0);
  return safeRound(total / windows.length, 4);
}

function sanitizeMetadata(input: Readonly<JsonObject> | undefined, maxKeys: number): Readonly<JsonObject> {
  if (!input) return Object.freeze({});
  const entries = Object.entries(input).slice(0, maxKeys);
  return Object.freeze(Object.fromEntries(entries));
}

function initialState(
  roomId: LedgerRoomId,
  channelId: AudienceChannelId,
  now: LedgerUnixMs,
  metadata?: Readonly<JsonObject>,
): AudienceHeatState {
  return Object.freeze({
    roomId,
    channelId,
    score: 0,
    band: 'FROZEN',
    presence: 'ABSENT',
    vector: Object.freeze(defaultVector()),
    crowdVelocity: 0,
    witnessDensity: 0,
    witnessWindows: Object.freeze([]),
    lastTransitionReason: 'ROLLUP',
    lastUpdatedAt: now,
    lastNonDecayAt: now,
    shadowMirrors: Object.freeze(
      channelId === 'GLOBAL'
        ? (['LIVEOPS_SHADOW', 'RIVALRY_SHADOW'] as const)
        : channelId === 'SYNDICATE'
          ? (['NPC_SHADOW', 'RIVALRY_SHADOW'] as const)
          : channelId === 'DEAL_ROOM'
            ? (['NPC_SHADOW', 'SYSTEM_SHADOW'] as const)
            : channelId === 'LOBBY'
              ? (['SYSTEM_SHADOW', 'RESCUE_SHADOW'] as const)
              : ([] as const),
    ),
    metadata: sanitizeMetadata(metadata, DEFAULT_MAX_METADATA_KEYS),
  });
}

function mergeVector(
  current: AudienceHeatVector,
  delta: Partial<Record<AudienceHeatVectorKey, number>> | undefined,
): AudienceHeatVector {
  if (!delta) return current;
  const next = { ...current };
  (Object.keys(delta) as AudienceHeatVectorKey[]).forEach((key) => {
    next[key] = safeRound(clamp(next[key] + (delta[key] ?? 0), 0, 100), 4);
  });
  return Object.freeze(next);
}

function applyDecayToVector(
  vector: AudienceHeatVector,
  decayPerTick: number,
  ticks: number,
): AudienceHeatVector {
  const totalDecay = decayPerTick * ticks;
  const next: AudienceHeatVector = {
    hype: safeRound(clamp(vector.hype - totalDecay * 0.8, 0, 100), 4),
    ridicule: safeRound(clamp(vector.ridicule - totalDecay * 0.95, 0, 100), 4),
    fear: safeRound(clamp(vector.fear - totalDecay * 0.92, 0, 100), 4),
    pressure: safeRound(clamp(vector.pressure - totalDecay * 1.0, 0, 100), 4),
    suspicion: safeRound(clamp(vector.suspicion - totalDecay * 0.7, 0, 100), 4),
    conspiracy: safeRound(clamp(vector.conspiracy - totalDecay * 0.66, 0, 100), 4),
    predation: safeRound(clamp(vector.predation - totalDecay * 0.96, 0, 100), 4),
    sympathy: safeRound(clamp(vector.sympathy - totalDecay * 0.55, 0, 100), 4),
    legend: safeRound(clamp(vector.legend - totalDecay * 0.25, 0, 100), 4),
    chaos: safeRound(clamp(vector.chaos - totalDecay * 1.05, 0, 100), 4),
  };
  return Object.freeze(next);
}

function decayMultiplier(channelId: AudienceChannelId, decayPolicy: AudienceDecayPolicy): number {
  return isShadowChannel(channelId)
    ? decayPolicy.shadowDecayMultiplier
    : decayPolicy.visibleDecayMultiplier;
}

function compareChannelHeat(a: AudienceHeatState, b: AudienceHeatState): number {
  return b.score - a.score || b.crowdVelocity - a.crowdVelocity || b.witnessDensity - a.witnessDensity;
}

export class AudienceHeatLedger {
  private readonly now: () => number;
  private readonly thresholds: AudienceThresholds;
  private readonly decayPolicy: AudienceDecayPolicy;
  private readonly maxEntriesPerRoom: number;
  private readonly maxWitnessWindowsPerChannel: number;
  private readonly maxMetadataKeys: number;
  private readonly enableShadowMirrors: boolean;

  private readonly roomState = new Map<LedgerRoomId, Map<AudienceChannelId, AudienceHeatState>>();
  private readonly roomEntries = new Map<LedgerRoomId, AudienceHeatEntry[]>();

  public constructor(options: AudienceHeatLedgerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.thresholds = Object.freeze({
      ...DEFAULT_THRESHOLDS,
      ...(options.thresholds ?? {}),
    });
    this.decayPolicy = Object.freeze({
      ...DEFAULT_DECAY_POLICY,
      ...(options.decayPolicy ?? {}),
    });
    this.maxEntriesPerRoom = options.maxEntriesPerRoom ?? DEFAULT_MAX_ENTRIES_PER_ROOM;
    this.maxWitnessWindowsPerChannel =
      options.maxWitnessWindowsPerChannel ?? DEFAULT_MAX_WITNESS_WINDOWS_PER_CHANNEL;
    this.maxMetadataKeys = options.maxMetadataKeys ?? DEFAULT_MAX_METADATA_KEYS;
    this.enableShadowMirrors = options.enableShadowMirrors ?? true;
  }

  public ensureRoom(roomId: LedgerRoomId, metadata?: Readonly<JsonObject>): AudienceRoomSnapshot {
    const now = asUnixMs(this.now());
    const channels = this.getOrCreateRoomChannels(roomId, now, metadata);
    return this.buildSnapshot(roomId, channels, now);
  }

  public ingest(input: AudienceHeatInput): AudienceHeatEntry {
    const now = input.occurredAt;
    const channels = this.getOrCreateRoomChannels(input.roomId, now);
    const previousState = this.getState(input.roomId, input.channelId, now);
    const decayedState = this.decayState(previousState, now);
    const mergedWitnesses = mergeWitnessWindows(
      decayedState.witnessWindows,
      normalizeWitnessWindows(input.witnessWindows, this.maxWitnessWindowsPerChannel, now),
      this.maxWitnessWindowsPerChannel,
      now,
    );
    const nextState = this.applyDelta(decayedState, input.delta, mergedWitnesses, now);

    channels.set(input.channelId, nextState);

    const entry: AudienceHeatEntry = Object.freeze({
      entryId: createEntryId(now, input.roomId, input.channelId),
      roomId: input.roomId,
      channelId: input.channelId,
      occurredAt: now,
      previousState,
      nextState,
      delta: Object.freeze({ ...input.delta }),
    });

    this.pushEntry(input.roomId, entry);

    if (this.enableShadowMirrors && !isShadowChannel(input.channelId)) {
      this.ingestShadowMirrors(input.roomId, nextState, input.delta, now);
    }

    return entry;
  }

  public decayRoom(roomId: LedgerRoomId, at: LedgerUnixMs = asUnixMs(this.now())): AudienceRoomSnapshot {
    const channels = this.getOrCreateRoomChannels(roomId, at);
    ALL_CHANNELS.forEach((channelId) => {
      const current = channels.get(channelId) ?? initialState(roomId, channelId, at);
      channels.set(channelId, this.decayState(current, at));
    });
    return this.buildSnapshot(roomId, channels, at);
  }

  public getState(
    roomId: LedgerRoomId,
    channelId: AudienceChannelId,
    at: LedgerUnixMs = asUnixMs(this.now()),
  ): AudienceHeatState {
    const channels = this.getOrCreateRoomChannels(roomId, at);
    const current = channels.get(channelId);
    if (current) {
      return current;
    }
    const seeded = initialState(roomId, channelId, at);
    channels.set(channelId, seeded);
    return seeded;
  }

  public getSnapshot(roomId: LedgerRoomId, at: LedgerUnixMs = asUnixMs(this.now())): AudienceRoomSnapshot {
    const channels = this.getOrCreateRoomChannels(roomId, at);
    return this.buildSnapshot(roomId, channels, at);
  }

  public getSummary(roomId: LedgerRoomId, at: LedgerUnixMs = asUnixMs(this.now())): AudienceHeatSummary {
    const snapshot = this.getSnapshot(roomId, at);
    const visibleStates = VISIBLE_CHANNELS.map((channelId) => snapshot.channels[channelId]);
    const shadowStates = SHADOW_CHANNELS.map((channelId) => snapshot.channels[channelId]);

    const hottestVisible = [...visibleStates].sort(compareChannelHeat)[0];
    const hottestShadow = [...shadowStates].sort(compareChannelHeat)[0];

    return Object.freeze({
      roomId,
      hottestVisibleChannel: hottestVisible.channelId as AudienceVisibleChannel,
      hottestShadowChannel: hottestShadow.channelId as AudienceShadowChannel,
      pressureIndex: safeRound(visibleStates.reduce((sum, state) => sum + state.vector.pressure, 0) / visibleStates.length, 4),
      mockeryIndex: safeRound(visibleStates.reduce((sum, state) => sum + state.vector.ridicule, 0) / visibleStates.length, 4),
      legendIndex: safeRound(visibleStates.reduce((sum, state) => sum + state.vector.legend, 0) / visibleStates.length, 4),
      rescueNeedIndex: safeRound(snapshot.channels.RESCUE_SHADOW.vector.sympathy + snapshot.channels.LOBBY.vector.pressure, 4),
      dealPredationIndex: safeRound(snapshot.channels.DEAL_ROOM.vector.predation, 4),
      syndicateConspiracyIndex: safeRound(snapshot.channels.SYNDICATE.vector.conspiracy, 4),
      generatedAt: at,
    });
  }

  public getDiagnostics(roomId: LedgerRoomId, at: LedgerUnixMs = asUnixMs(this.now())): AudienceHeatDiagnostics {
    const snapshot = this.getSnapshot(roomId, at);
    const entries = this.roomEntries.get(roomId) ?? [];
    const states = Object.values(snapshot.channels);
    const lastUpdatedAt = states.reduce<LedgerUnixMs | undefined>((latest, state) => {
      if (!latest || state.lastUpdatedAt > latest) {
        return state.lastUpdatedAt;
      }
      return latest;
    }, undefined);

    return Object.freeze({
      roomId,
      entryCount: entries.length,
      visibleChannelCount: VISIBLE_CHANNELS.length,
      shadowChannelCount: SHADOW_CHANNELS.length,
      averageVelocity: safeRound(states.reduce((sum, state) => sum + state.crowdVelocity, 0) / states.length, 4),
      witnessWindowCount: states.reduce((sum, state) => sum + state.witnessWindows.length, 0),
      lockedChannelCount: states.filter((state) => state.lockUntil && state.lockUntil > at).length,
      hottestScoreSeen: entries.reduce((max, entry) => Math.max(max, entry.nextState.score), 0),
      lastUpdatedAt,
    });
  }

  public getEntries(roomId: LedgerRoomId): readonly AudienceHeatEntry[] {
    return Object.freeze([...(this.roomEntries.get(roomId) ?? [])]);
  }

  public clearRoom(roomId: LedgerRoomId): void {
    this.roomState.delete(roomId);
    this.roomEntries.delete(roomId);
  }

  public exportState(): Readonly<Record<string, AudienceRoomSnapshot>> {
    const now = asUnixMs(this.now());
    const exported: Record<string, AudienceRoomSnapshot> = {};
    Array.from(this.roomState.keys()).forEach((roomId) => {
      exported[roomId] = this.getSnapshot(roomId, now);
    });
    return Object.freeze(exported);
  }

  public importSnapshot(snapshot: AudienceRoomSnapshot): void {
    const channels = new Map<AudienceChannelId, AudienceHeatState>();
    ALL_CHANNELS.forEach((channelId) => {
      channels.set(channelId, Object.freeze({ ...snapshot.channels[channelId] }));
    });
    this.roomState.set(snapshot.roomId, channels);
    if (!this.roomEntries.has(snapshot.roomId)) {
      this.roomEntries.set(snapshot.roomId, []);
    }
  }

  private ingestShadowMirrors(
    roomId: LedgerRoomId,
    sourceState: AudienceHeatState,
    delta: AudienceHeatDelta,
    now: LedgerUnixMs,
  ): void {
    sourceState.shadowMirrors.forEach((shadowChannelId) => {
      const mirroredDelta: AudienceHeatDelta = Object.freeze({
        scoreDelta: safeRound(delta.scoreDelta * 0.42, 4),
        vectorDelta: Object.freeze({
          pressure: (delta.vectorDelta.pressure ?? 0) * 0.35,
          suspicion: (delta.vectorDelta.suspicion ?? 0) * 0.75 + (delta.vectorDelta.ridicule ?? 0) * 0.12,
          conspiracy: (delta.vectorDelta.conspiracy ?? 0) * 0.75 + (delta.vectorDelta.hype ?? 0) * 0.08,
          predation: (delta.vectorDelta.predation ?? 0) * 0.45 + (delta.vectorDelta.pressure ?? 0) * 0.2,
          fear: (delta.vectorDelta.fear ?? 0) * 0.45,
          legend: (delta.vectorDelta.legend ?? 0) * 0.3,
          chaos: (delta.vectorDelta.chaos ?? 0) * 0.4,
        }),
        crowdVelocityDelta: safeRound((delta.crowdVelocityDelta ?? 0) * 0.4, 4),
        witnessDensityDelta: safeRound((delta.witnessDensityDelta ?? 0) * 0.25, 4),
        reason: delta.reason,
        sourceKind: delta.sourceKind,
        sceneId: delta.sceneId,
        momentId: delta.momentId,
        proofHash: delta.proofHash,
        actorId: delta.actorId,
        targetId: delta.targetId,
        metadata: Object.freeze({
          mirroredFrom: sourceState.channelId,
          ...(delta.metadata ?? {}),
        }),
      });

      this.ingest({
        roomId,
        channelId: shadowChannelId,
        occurredAt: now,
        delta: mirroredDelta,
      });
    });
  }

  private getOrCreateRoomChannels(
    roomId: LedgerRoomId,
    now: LedgerUnixMs,
    metadata?: Readonly<JsonObject>,
  ): Map<AudienceChannelId, AudienceHeatState> {
    const existing = this.roomState.get(roomId);
    if (existing) {
      return existing;
    }

    const created = new Map<AudienceChannelId, AudienceHeatState>();
    ALL_CHANNELS.forEach((channelId) => {
      created.set(channelId, initialState(roomId, channelId, now, metadata));
    });
    this.roomState.set(roomId, created);
    this.roomEntries.set(roomId, []);
    return created;
  }

  private buildSnapshot(
    roomId: LedgerRoomId,
    channels: Map<AudienceChannelId, AudienceHeatState>,
    exportedAt: LedgerUnixMs,
  ): AudienceRoomSnapshot {
    const states = ALL_CHANNELS.map((channelId) => channels.get(channelId) ?? initialState(roomId, channelId, exportedAt));
    const sorted = [...states].sort(compareChannelHeat);
    const hottest = sorted[0];
    const coldest = sorted[sorted.length - 1];
    const averageHeatScore = safeRound(states.reduce((sum, state) => sum + state.score, 0) / states.length, 4);
    const roomPressureIndex = safeRound(states.reduce((sum, state) => sum + state.vector.pressure, 0) / states.length, 4);
    const roomWitnessIndex = safeRound(states.reduce((sum, state) => sum + state.witnessDensity, 0) / states.length, 4);

    const exportedChannels = Object.freeze(
      Object.fromEntries(states.map((state) => [state.channelId, state])) as Record<AudienceChannelId, AudienceHeatState>,
    );

    return Object.freeze({
      roomId,
      channels: exportedChannels,
      hottestChannelId: hottest.channelId,
      coldestChannelId: coldest.channelId,
      averageHeatScore,
      roomPressureIndex,
      roomWitnessIndex,
      exportedAt,
    });
  }

  private decayState(state: AudienceHeatState, now: LedgerUnixMs): AudienceHeatState {
    if (now <= state.lastUpdatedAt) {
      return state;
    }

    const lockUntil = state.lockUntil;
    if (lockUntil && lockUntil > now) {
      const retainedWitnesses = normalizeWitnessWindows(
        state.witnessWindows,
        this.maxWitnessWindowsPerChannel,
        now,
      );
      return Object.freeze({
        ...state,
        witnessWindows: retainedWitnesses,
        witnessDensity: computeWitnessDensity(retainedWitnesses),
        lastUpdatedAt: now,
      });
    }

    const elapsedMs = now - state.lastUpdatedAt;
    const ticks = Math.floor(elapsedMs / this.decayPolicy.msPerTick);
    if (ticks <= 0) {
      return state;
    }

    const multiplier = decayMultiplier(state.channelId, this.decayPolicy);
    const inGraceWindow = now - state.lastNonDecayAt <= this.decayPolicy.postSceneGraceMs;
    const perTick = (inGraceWindow
      ? this.decayPolicy.activeDecayPerTick
      : this.decayPolicy.passiveDecayPerTick) * multiplier;

    const decayedVector = applyDecayToVector(state.vector, perTick, ticks);
    const decayedScore = safeRound(clamp(vectorScore(decayedVector), 0, 100), 4);
    const decayedBand = bandFromScore(decayedScore, this.thresholds);
    const decayedPresence = presenceFromScore(decayedScore, decayedBand);
    const nextVelocity = safeRound(clamp(state.crowdVelocity - perTick * ticks * 0.8, -100, 100), 4);
    const witnessWindows = normalizeWitnessWindows(state.witnessWindows, this.maxWitnessWindowsPerChannel, now);

    return Object.freeze({
      ...state,
      score: decayedScore,
      band: decayedBand,
      presence: decayedPresence,
      vector: decayedVector,
      crowdVelocity: nextVelocity,
      witnessDensity: computeWitnessDensity(witnessWindows),
      witnessWindows,
      lastTransitionReason: 'DECAY',
      lastUpdatedAt: now,
    });
  }

  private applyDelta(
    state: AudienceHeatState,
    delta: AudienceHeatDelta,
    witnessWindows: readonly AudienceWitnessWindow[],
    now: LedgerUnixMs,
  ): AudienceHeatState {
    const nextVector = mergeVector(state.vector, delta.vectorDelta);
    const vectorDrivenScore = vectorScore(nextVector);
    const nextScore = safeRound(clamp(vectorDrivenScore + delta.scoreDelta, 0, 100), 4);
    const nextBand = bandFromScore(nextScore, this.thresholds);
    const nextPresence = delta.presenceOverride ?? presenceFromScore(nextScore, nextBand);
    const nextVelocity = safeRound(
      clamp(state.crowdVelocity + (delta.crowdVelocityDelta ?? delta.scoreDelta * 0.5), -100, 100),
      4,
    );
    const nextWitnessDensity = safeRound(
      clamp(computeWitnessDensity(witnessWindows) + (delta.witnessDensityDelta ?? 0), 0, 100),
      4,
    );
    const nextMetadata = sanitizeMetadata(
      {
        ...(state.metadata as JsonObject),
        ...(delta.metadata ?? {}),
      },
      this.maxMetadataKeys,
    );

    const shouldLock = delta.sourceKind === 'WORLD_EVENT';

    return Object.freeze({
      ...state,
      score: nextScore,
      band: nextBand,
      presence: nextPresence,
      vector: nextVector,
      crowdVelocity: nextVelocity,
      witnessDensity: nextWitnessDensity,
      witnessWindows,
      lastTransitionReason: delta.reason,
      lastUpdatedAt: now,
      lastNonDecayAt: delta.reason === 'DECAY' ? state.lastNonDecayAt : now,
      lastSceneId: delta.sceneId ?? state.lastSceneId,
      lastMomentId: delta.momentId ?? state.lastMomentId,
      lockUntil: shouldLock ? asUnixMs(now + this.decayPolicy.worldEventLockMs) : state.lockUntil,
      metadata: nextMetadata,
    });
  }

  private pushEntry(roomId: LedgerRoomId, entry: AudienceHeatEntry): void {
    const entries = this.roomEntries.get(roomId) ?? [];
    entries.push(entry);
    if (entries.length > this.maxEntriesPerRoom) {
      entries.splice(0, entries.length - this.maxEntriesPerRoom);
    }
    this.roomEntries.set(roomId, entries);
  }
}

export function createAudienceHeatLedger(options: AudienceHeatLedgerOptions = {}): AudienceHeatLedger {
  return new AudienceHeatLedger(options);
}

// ============================================================================
// MARK: Temporal window analysis
// ============================================================================

export interface AudienceHeatTemporalWindow {
  readonly windowStartMs: LedgerUnixMs;
  readonly windowEndMs: LedgerUnixMs;
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly entryCount: number;
  readonly averageScore: number;
  readonly peakScore: number;
  readonly averageVector: AudienceHeatVector;
  readonly dominantTransitionReason: AudienceTransitionReason;
  readonly witnessWindowCount: number;
  readonly bandAtPeak: AudienceHeatBand;
}

export function buildAudienceHeatTemporalWindows(
  entries: readonly AudienceHeatEntry[],
  windowMs: number = 30_000,
): readonly AudienceHeatTemporalWindow[] {
  if (!entries.length) return Object.freeze([]);
  const minTs = Math.min(...entries.map((e) => e.occurredAt));
  const maxTs = Math.max(...entries.map((e) => e.occurredAt));
  const results: AudienceHeatTemporalWindow[] = [];

  const byChannel = new Map<string, AudienceHeatEntry[]>();
  for (const e of entries) {
    const key = `${e.roomId}:${e.channelId}`;
    const existing = byChannel.get(key) ?? [];
    existing.push(e);
    byChannel.set(key, existing);
  }

  for (const [key, channelEntries] of byChannel.entries()) {
    const [roomId, channelId] = key.split(':') as [LedgerRoomId, AudienceChannelId];
    for (let start = minTs; start <= maxTs; start += windowMs) {
      const end = start + windowMs;
      const window = channelEntries.filter((e) => e.occurredAt >= start && e.occurredAt < end);
      if (!window.length) continue;

      const scores = window.map((e) => e.nextState.score);
      const peakScore = Math.max(...scores);
      const averageScore = safeRound(scores.reduce((a, b) => a + b, 0) / scores.length, 4);

      const vectorKeys: (keyof AudienceHeatVector)[] = ['hype', 'ridicule', 'fear', 'pressure', 'suspicion', 'conspiracy', 'predation', 'sympathy', 'legend', 'chaos'];
      const avgVector: AudienceHeatVector = Object.freeze(
        Object.fromEntries(
          vectorKeys.map((k) => [
            k,
            safeRound(window.reduce((acc, e) => acc + e.nextState.vector[k], 0) / window.length, 4),
          ]),
        ) as unknown as AudienceHeatVector,
      );

      const reasonCounts = new Map<AudienceTransitionReason, number>();
      for (const e of window) {
        reasonCounts.set(e.nextState.lastTransitionReason, (reasonCounts.get(e.nextState.lastTransitionReason) ?? 0) + 1);
      }
      let dominantTransitionReason: AudienceTransitionReason = 'ROLLUP';
      let dominantCount = 0;
      for (const [reason, count] of reasonCounts.entries()) {
        if (count > dominantCount) { dominantCount = count; dominantTransitionReason = reason; }
      }

      const peakEntry = window.find((e) => e.nextState.score === peakScore)!;
      results.push(Object.freeze({
        windowStartMs: asUnixMs(start),
        windowEndMs: asUnixMs(end),
        roomId,
        channelId,
        entryCount: window.length,
        averageScore,
        peakScore,
        averageVector: avgVector,
        dominantTransitionReason,
        witnessWindowCount: window.reduce((acc, e) => acc + e.nextState.witnessWindows.length, 0),
        bandAtPeak: peakEntry.nextState.band,
      }));
    }
  }

  return Object.freeze(results.sort((a, b) => a.windowStartMs - b.windowStartMs));
}

export function peakHeatWindowForChannel(
  roomId: LedgerRoomId,
  channelId: AudienceChannelId,
  windows: readonly AudienceHeatTemporalWindow[],
): AudienceHeatTemporalWindow | null {
  const channelWindows = windows.filter((w) => w.roomId === roomId && w.channelId === channelId);
  if (!channelWindows.length) return null;
  return channelWindows.reduce((best, w) => w.peakScore > best.peakScore ? w : best);
}

// ============================================================================
// MARK: Momentum state
// ============================================================================

export interface AudienceHeatMomentumState {
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly currentScore: number;
  readonly scoreDelta: number;
  readonly velocityTrend: 'ACCELERATING' | 'DECELERATING' | 'STABLE' | 'REVERSING';
  readonly predictedScoreIn30s: number;
  readonly predictedBandIn30s: AudienceHeatBand;
  readonly isEscalating: boolean;
  readonly isCooling: boolean;
  readonly sampledAt: LedgerUnixMs;
}

export function computeAudienceHeatMomentum(
  state: AudienceHeatState,
  priorEntries: readonly AudienceHeatEntry[],
  thresholds: AudienceThresholds = DEFAULT_THRESHOLDS,
): AudienceHeatMomentumState {
  const channelEntries = priorEntries
    .filter((e) => e.channelId === state.channelId && e.roomId === state.roomId)
    .slice(-5);

  const scoreDelta = channelEntries.length >= 2
    ? state.score - channelEntries[channelEntries.length - 2].nextState.score
    : 0;

  const velocities = channelEntries.slice(1).map((e, i) =>
    e.nextState.score - channelEntries[i].nextState.score,
  );

  const avgVelocity = velocities.length > 0
    ? velocities.reduce((a, b) => a + b, 0) / velocities.length
    : 0;

  const velocityTrend: AudienceHeatMomentumState['velocityTrend'] =
    Math.abs(avgVelocity) < 0.5 ? 'STABLE' :
    scoreDelta > 0 && avgVelocity > 0 ? 'ACCELERATING' :
    scoreDelta < 0 && avgVelocity < 0 ? 'DECELERATING' : 'REVERSING';

  const predictedScore = safeRound(clamp(state.score + avgVelocity * 3, 0, 100), 4);
  const predictedBand = bandFromScore(predictedScore, thresholds);

  return Object.freeze({
    roomId: state.roomId,
    channelId: state.channelId,
    currentScore: state.score,
    scoreDelta: safeRound(scoreDelta, 4),
    velocityTrend,
    predictedScoreIn30s: predictedScore,
    predictedBandIn30s: predictedBand,
    isEscalating: velocityTrend === 'ACCELERATING' && state.score >= thresholds.warm,
    isCooling: velocityTrend === 'DECELERATING' && state.score < thresholds.hot,
    sampledAt: state.lastUpdatedAt,
  });
}

// ============================================================================
// MARK: Diff
// ============================================================================

export interface AudienceHeatLedgerDiff {
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly scoreDelta: number;
  readonly bandChanged: boolean;
  readonly presenceChanged: boolean;
  readonly beforeBand: AudienceHeatBand;
  readonly afterBand: AudienceHeatBand;
  readonly beforePresence: AudiencePresenceState;
  readonly afterPresence: AudiencePresenceState;
  readonly vectorDeltas: Partial<Record<AudienceHeatVectorKey, number>>;
  readonly witnessWindowCountDelta: number;
  readonly velocityDelta: number;
  readonly transitionReason: AudienceTransitionReason;
}

export function diffAudienceHeatStates(
  before: AudienceHeatState,
  after: AudienceHeatState,
): AudienceHeatLedgerDiff {
  const vectorKeys: AudienceHeatVectorKey[] = ['hype', 'ridicule', 'fear', 'pressure', 'suspicion', 'conspiracy', 'predation', 'sympathy', 'legend', 'chaos'];
  const vectorDeltas: Partial<Record<AudienceHeatVectorKey, number>> = {};
  for (const key of vectorKeys) {
    const delta = safeRound(after.vector[key] - before.vector[key], 4);
    if (delta !== 0) vectorDeltas[key] = delta;
  }

  return Object.freeze({
    roomId: after.roomId,
    channelId: after.channelId,
    scoreDelta: safeRound(after.score - before.score, 4),
    bandChanged: after.band !== before.band,
    presenceChanged: after.presence !== before.presence,
    beforeBand: before.band,
    afterBand: after.band,
    beforePresence: before.presence,
    afterPresence: after.presence,
    vectorDeltas: Object.freeze(vectorDeltas),
    witnessWindowCountDelta: after.witnessWindows.length - before.witnessWindows.length,
    velocityDelta: safeRound(after.crowdVelocity - before.crowdVelocity, 4),
    transitionReason: after.lastTransitionReason,
  });
}

export function diffAudienceRoomSnapshots(
  before: AudienceRoomSnapshot,
  after: AudienceRoomSnapshot,
): readonly AudienceHeatLedgerDiff[] {
  const diffs: AudienceHeatLedgerDiff[] = [];
  for (const channelId of Object.keys(after.channels) as AudienceChannelId[]) {
    const beforeState = before.channels[channelId];
    const afterState = after.channels[channelId];
    if (beforeState && afterState) {
      diffs.push(diffAudienceHeatStates(beforeState, afterState));
    }
  }
  return Object.freeze(diffs.sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta)));
}

// ============================================================================
// MARK: Cross-room summary
// ============================================================================

export interface AudienceHeatCrossRoomEntry {
  readonly roomId: LedgerRoomId;
  readonly averageScore: number;
  readonly hottestChannel: AudienceChannelId;
  readonly hottestScore: number;
  readonly dominantBand: AudienceHeatBand;
  readonly totalWitnessWindows: number;
  readonly exportedAt: LedgerUnixMs;
}

export interface AudienceHeatCrossRoomSummary {
  readonly rooms: readonly AudienceHeatCrossRoomEntry[];
  readonly globalHottestRoomId: LedgerRoomId | null;
  readonly globalAverageScore: number;
  readonly generatedAt: LedgerUnixMs;
}

export function buildAudienceCrossRoomSummary(
  snapshots: readonly AudienceRoomSnapshot[],
  now: LedgerUnixMs = asUnixMs(Date.now()),
): AudienceHeatCrossRoomSummary {
  const rooms: AudienceHeatCrossRoomEntry[] = snapshots.map((snap) => {
    const states = Object.values(snap.channels);
    const sorted = [...states].sort((a, b) => b.score - a.score);
    const hottest = sorted[0];
    const avgScore = safeRound(states.reduce((acc, s) => acc + s.score, 0) / Math.max(states.length, 1), 4);
    const bandCounts = new Map<AudienceHeatBand, number>();
    for (const s of states) { bandCounts.set(s.band, (bandCounts.get(s.band) ?? 0) + 1); }
    let dominantBand: AudienceHeatBand = 'FROZEN';
    let dominantCount = 0;
    for (const [band, count] of bandCounts.entries()) {
      if (count > dominantCount) { dominantCount = count; dominantBand = band; }
    }
    return Object.freeze({
      roomId: snap.roomId,
      averageScore: avgScore,
      hottestChannel: hottest?.channelId ?? 'GLOBAL',
      hottestScore: hottest?.score ?? 0,
      dominantBand,
      totalWitnessWindows: states.reduce((acc, s) => acc + s.witnessWindows.length, 0),
      exportedAt: snap.exportedAt,
    });
  });

  const sortedRooms = [...rooms].sort((a, b) => b.hottestScore - a.hottestScore);
  const globalAverageScore = safeRound(
    rooms.reduce((acc, r) => acc + r.averageScore, 0) / Math.max(rooms.length, 1),
    4,
  );

  return Object.freeze({
    rooms: Object.freeze(sortedRooms),
    globalHottestRoomId: sortedRooms[0]?.roomId ?? null,
    globalAverageScore,
    generatedAt: now,
  });
}

// ============================================================================
// MARK: Decay report
// ============================================================================

export interface AudienceHeatDecayReport {
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly currentScore: number;
  readonly projectedScoreAfterDecay: number;
  readonly ticksUntilFrozen: number;
  readonly isInGraceWindow: boolean;
  readonly isLocked: boolean;
  readonly reportedAt: LedgerUnixMs;
}

export function buildAudienceHeatDecayReport(
  state: AudienceHeatState,
  decayPolicy: AudienceDecayPolicy = DEFAULT_DECAY_POLICY,
  thresholds: AudienceThresholds = DEFAULT_THRESHOLDS,
  now: LedgerUnixMs = asUnixMs(Date.now()),
): AudienceHeatDecayReport {
  const isLocked = !!(state.lockUntil && state.lockUntil > now);
  const isInGraceWindow = (now - state.lastNonDecayAt) <= decayPolicy.postSceneGraceMs;
  const perTick = isInGraceWindow
    ? decayPolicy.activeDecayPerTick
    : decayPolicy.passiveDecayPerTick;

  let projected = state.score;
  let ticks = 0;
  while (projected > 0 && ticks < 10_000) {
    projected = Math.max(0, projected - perTick);
    ticks += 1;
    if (bandFromScore(projected, thresholds) === 'FROZEN') break;
  }

  return Object.freeze({
    roomId: state.roomId,
    channelId: state.channelId,
    currentScore: state.score,
    projectedScoreAfterDecay: safeRound(projected, 4),
    ticksUntilFrozen: ticks,
    isInGraceWindow,
    isLocked,
    reportedAt: now,
  });
}

// ============================================================================
// MARK: Ledger stats
// ============================================================================

export interface AudienceHeatLedgerStats {
  readonly roomId: LedgerRoomId;
  readonly entryCount: number;
  readonly channelCount: number;
  readonly averageScoreAcrossChannels: number;
  readonly hottestChannelId: AudienceChannelId;
  readonly hottestScore: number;
  readonly coldestChannelId: AudienceChannelId;
  readonly coldestScore: number;
  readonly totalWitnessWindows: number;
  readonly lockedChannelCount: number;
  readonly shadowChannelCount: number;
  readonly visibleChannelCount: number;
  readonly bandDistribution: Readonly<Record<string, number>>;
  readonly generatedAt: LedgerUnixMs;
}

export function buildAudienceHeatLedgerStats(
  snapshot: AudienceRoomSnapshot,
  entries: readonly AudienceHeatEntry[],
  now: LedgerUnixMs = asUnixMs(Date.now()),
): AudienceHeatLedgerStats {
  const states = Object.values(snapshot.channels);
  const sorted = [...states].sort((a, b) => b.score - a.score);
  const hottest = sorted[0];
  const coldest = sorted[sorted.length - 1];

  const bandDist: Record<string, number> = {};
  for (const s of states) { bandDist[s.band] = (bandDist[s.band] ?? 0) + 1; }

  const avgScore = safeRound(states.reduce((acc, s) => acc + s.score, 0) / Math.max(states.length, 1), 4);
  const lockedCount = states.filter((s) => s.lockUntil && s.lockUntil > now).length;
  const shadowCount = states.filter((s) => isShadowChannel(s.channelId)).length;
  const visibleCount = states.length - shadowCount;

  return Object.freeze({
    roomId: snapshot.roomId,
    entryCount: entries.filter((e) => e.roomId === snapshot.roomId).length,
    channelCount: states.length,
    averageScoreAcrossChannels: avgScore,
    hottestChannelId: hottest?.channelId ?? 'GLOBAL',
    hottestScore: hottest?.score ?? 0,
    coldestChannelId: coldest?.channelId ?? 'SYSTEM_SHADOW',
    coldestScore: coldest?.score ?? 0,
    totalWitnessWindows: states.reduce((acc, s) => acc + s.witnessWindows.length, 0),
    lockedChannelCount: lockedCount,
    shadowChannelCount: shadowCount,
    visibleChannelCount: visibleCount,
    bandDistribution: Object.freeze(bandDist),
    generatedAt: now,
  });
}

// ============================================================================
// MARK: Policy violation detection
// ============================================================================

export interface AudienceHeatPolicyViolation {
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly violationType: 'SCORE_OVERFLOW' | 'VECTOR_OVERFLOW' | 'STALE_LOCK' | 'WITNESS_OVERFLOW' | 'METADATA_OVERFLOW';
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly description: string;
}

export function detectAudienceHeatPolicyViolations(
  snapshot: AudienceRoomSnapshot,
  options: { maxWitnessWindows?: number; maxMetadataKeys?: number; maxLockAgeMs?: number } = {},
  now: LedgerUnixMs = asUnixMs(Date.now()),
): readonly AudienceHeatPolicyViolation[] {
  const maxWitnessWindows = options.maxWitnessWindows ?? DEFAULT_MAX_WITNESS_WINDOWS_PER_CHANNEL;
  const maxMetadataKeys = options.maxMetadataKeys ?? DEFAULT_MAX_METADATA_KEYS;
  const maxLockAgeMs = options.maxLockAgeMs ?? 120_000;
  const violations: AudienceHeatPolicyViolation[] = [];

  for (const state of Object.values(snapshot.channels)) {
    if (state.score > 100) {
      violations.push(Object.freeze({ roomId: state.roomId, channelId: state.channelId, violationType: 'SCORE_OVERFLOW', severity: 'HIGH', description: `Score ${state.score} exceeds maximum 100` }));
    }
    for (const key of Object.keys(state.vector) as AudienceHeatVectorKey[]) {
      if (state.vector[key] > 100) {
        violations.push(Object.freeze({ roomId: state.roomId, channelId: state.channelId, violationType: 'VECTOR_OVERFLOW', severity: 'MEDIUM', description: `Vector key '${key}' is ${state.vector[key]}` }));
      }
    }
    if (state.lockUntil && state.lockUntil < now && (now - state.lockUntil) > maxLockAgeMs) {
      violations.push(Object.freeze({ roomId: state.roomId, channelId: state.channelId, violationType: 'STALE_LOCK', severity: 'LOW', description: `Lock expired ${now - state.lockUntil}ms ago` }));
    }
    if (state.witnessWindows.length > maxWitnessWindows) {
      violations.push(Object.freeze({ roomId: state.roomId, channelId: state.channelId, violationType: 'WITNESS_OVERFLOW', severity: 'MEDIUM', description: `${state.witnessWindows.length} witness windows exceeds max ${maxWitnessWindows}` }));
    }
    if (Object.keys(state.metadata).length > maxMetadataKeys) {
      violations.push(Object.freeze({ roomId: state.roomId, channelId: state.channelId, violationType: 'METADATA_OVERFLOW', severity: 'LOW', description: `Metadata has ${Object.keys(state.metadata).length} keys` }));
    }
  }

  return Object.freeze(violations);
}

// ============================================================================
// MARK: Batch admit
// ============================================================================

export interface AudienceHeatBatchAdmitResult {
  readonly processedCount: number;
  readonly entries: readonly AudienceHeatEntry[];
  readonly errors: readonly string[];
  readonly snapshot: AudienceRoomSnapshot;
}

export function cloneAudienceHeatMetadata(metadata?: Readonly<JsonObject>): Readonly<JsonObject> {
  return shallowCloneObject(metadata);
}

export function batchAdmitAudienceHeatInputs(
  ledger: AudienceHeatLedger,
  inputs: readonly AudienceHeatInput[],
): AudienceHeatBatchAdmitResult {
  const entries: AudienceHeatEntry[] = [];
  const errors: string[] = [];
  let lastRoomId: LedgerRoomId | null = null;

  for (const input of inputs) {
    try {
      entries.push(ledger.ingest(input));
      lastRoomId = input.roomId;
    } catch (err) {
      errors.push(`Failed to ingest ${input.channelId}@${input.occurredAt}: ${String(err)}`);
    }
  }

  const roomId = lastRoomId ?? (inputs[0]?.roomId ?? 'UNKNOWN' as LedgerRoomId);
  const snapshot = ledger.getSnapshot(roomId);

  return Object.freeze({
    processedCount: entries.length,
    entries: Object.freeze(entries),
    errors: Object.freeze(errors),
    snapshot,
  });
}

// ============================================================================
// MARK: Profile system
// ============================================================================

export type AudienceHeatLedgerProfile = 'STANDARD' | 'COMPACT' | 'FORENSIC' | 'HIGH_VOLUME' | 'WORLD_EVENT';

export interface AudienceHeatLedgerProfileDescriptor {
  readonly name: AudienceHeatLedgerProfile;
  readonly description: string;
  readonly options: AudienceHeatLedgerOptions;
}

const AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS: readonly AudienceHeatLedgerProfileDescriptor[] = [
  {
    name: 'STANDARD',
    description: 'Balanced heat tracking for general room events.',
    options: {},
  },
  {
    name: 'COMPACT',
    description: 'Reduced retention windows for performance-sensitive contexts.',
    options: { maxEntriesPerRoom: 2_048, maxWitnessWindowsPerChannel: 32 },
  },
  {
    name: 'FORENSIC',
    description: 'Maximum retention and witness density for audit and replay.',
    options: { maxEntriesPerRoom: 16_384, maxWitnessWindowsPerChannel: 192, enableShadowMirrors: true },
  },
  {
    name: 'HIGH_VOLUME',
    description: 'Optimized for high-frequency event ingestion.',
    options: { maxEntriesPerRoom: 4_096, maxWitnessWindowsPerChannel: 48, enableShadowMirrors: false },
  },
  {
    name: 'WORLD_EVENT',
    description: 'Extended locks and amplified witness windows for world event contexts.',
    options: {
      maxEntriesPerRoom: 8_192,
      maxWitnessWindowsPerChannel: 128,
      enableShadowMirrors: true,
      decayPolicy: { worldEventLockMs: 60_000, passiveDecayPerTick: 0.3, activeDecayPerTick: 0.12 },
    },
  },
] as const;

export const AUDIENCE_HEAT_LEDGER_DOCTRINE = Object.freeze({
  authority: 'BACKEND' as const,
  version: '2026.03.23-audience-heat-ledger-doctrine.v1',
  maxScore: 100,
  maxVector: 100,
  shadowMirrorRatio: 0.42,
  defaultDecayTick: 5_000,
  supportedProfiles: ['STANDARD', 'COMPACT', 'FORENSIC', 'HIGH_VOLUME', 'WORLD_EVENT'] as const,
});

// ============================================================================
// MARK: Module objects
// ============================================================================

export const ChatAudienceHeatLedgerModule = Object.freeze({
  create: (options?: AudienceHeatLedgerOptions): AudienceHeatLedger => new AudienceHeatLedger(options),
  createCompact: (): AudienceHeatLedger => new AudienceHeatLedger(AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS.find((p) => p.name === 'COMPACT')!.options),
  createForensic: (): AudienceHeatLedger => new AudienceHeatLedger(AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS.find((p) => p.name === 'FORENSIC')!.options),
  createHighVolume: (): AudienceHeatLedger => new AudienceHeatLedger(AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS.find((p) => p.name === 'HIGH_VOLUME')!.options),
  createWorldEvent: (): AudienceHeatLedger => new AudienceHeatLedger(AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS.find((p) => p.name === 'WORLD_EVENT')!.options),
  batchAdmit: batchAdmitAudienceHeatInputs,
  buildTemporalWindows: buildAudienceHeatTemporalWindows,
  peakWindowForChannel: peakHeatWindowForChannel,
  computeMomentum: computeAudienceHeatMomentum,
  diffStates: diffAudienceHeatStates,
  diffSnapshots: diffAudienceRoomSnapshots,
  buildCrossRoomSummary: buildAudienceCrossRoomSummary,
  buildDecayReport: buildAudienceHeatDecayReport,
  buildLedgerStats: buildAudienceHeatLedgerStats,
  detectViolations: detectAudienceHeatPolicyViolations,
  doctrine: AUDIENCE_HEAT_LEDGER_DOCTRINE,
  deriveFromMessage: deriveAudienceHeatDeltaFromMessage,
  deriveFromProof: deriveAudienceHeatDeltaFromProof,
  deriveFromWorldEvent: deriveAudienceHeatDeltaFromWorldEvent,
} as const);

export const ChatAudienceHeatLedgerProfileModule = Object.freeze({
  all: (): readonly AudienceHeatLedgerProfileDescriptor[] => AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS,
  byName: (name: AudienceHeatLedgerProfile): AudienceHeatLedgerProfileDescriptor | undefined =>
    AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS.find((p) => p.name === name),
  STANDARD: AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS[0],
  COMPACT: AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS[1],
  FORENSIC: AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS[2],
  HIGH_VOLUME: AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS[3],
  WORLD_EVENT: AUDIENCE_HEAT_LEDGER_PROFILE_DESCRIPTORS[4],
} as const);

export function deriveAudienceHeatDeltaFromMessage(input: {
  readonly body: string;
  readonly channelId: AudienceChannelId;
  readonly pressureScore?: number;
  readonly ridiculeScore?: number;
  readonly legendScore?: number;
  readonly fearScore?: number;
  readonly actorId?: LedgerParticipantId;
  readonly targetId?: LedgerParticipantId;
  readonly occurredAt?: LedgerUnixMs;
}): AudienceHeatDelta {
  const exclamationCount = (input.body.match(/!/g) ?? []).length;
  const questionCount = (input.body.match(/\?/g) ?? []).length;
  const upperCount = (input.body.match(/[A-Z]/g) ?? []).length;
  const lengthWeight = Math.min(input.body.length / 140, 1.4);

  const ridicule = safeRound((input.ridiculeScore ?? 0) + exclamationCount * 0.4 + upperCount * 0.03, 4);
  const pressure = safeRound((input.pressureScore ?? 0) + questionCount * 0.25 + lengthWeight * 0.9, 4);
  const legend = safeRound((input.legendScore ?? 0) + (input.body.includes('proof') ? 1.3 : 0), 4);
  const fear = safeRound((input.fearScore ?? 0) + (input.body.includes('collapse') ? 1.25 : 0), 4);

  return Object.freeze({
    scoreDelta: safeRound(ridicule * 0.4 + pressure * 0.52 + legend * 0.35 + fear * 0.42, 4),
    vectorDelta: Object.freeze({
      ridicule,
      pressure,
      legend,
      fear,
      chaos: safeRound(exclamationCount * 0.22 + questionCount * 0.11, 4),
      hype: safeRound(legend * 0.5, 4),
    }),
    crowdVelocityDelta: safeRound((ridicule + pressure + legend) * 0.25, 4),
    witnessDensityDelta: safeRound(lengthWeight * 0.35, 4),
    reason: 'MESSAGE_INGESTED',
    sourceKind: 'MESSAGE',
    actorId: input.actorId,
    targetId: input.targetId,
    metadata: Object.freeze({
      derivedFrom: 'message',
      occurredAt: input.occurredAt ?? null,
      channelId: input.channelId,
    }),
  });
}

export function deriveAudienceHeatDeltaFromProof(input: {
  readonly proofHash: LedgerProofHash;
  readonly hasCounterplay: boolean;
  readonly verified: boolean;
  readonly humiliatesRival?: boolean;
  readonly savesRun?: boolean;
  readonly actorId?: LedgerParticipantId;
  readonly targetId?: LedgerParticipantId;
}): AudienceHeatDelta {
  const legend = input.verified ? 8.5 : 4.25;
  const ridicule = input.humiliatesRival ? 6.4 : 1.8;
  const sympathy = input.savesRun ? 4.6 : 0;
  const pressure = input.hasCounterplay ? 3.8 : 1.4;

  return Object.freeze({
    scoreDelta: safeRound(legend + ridicule * 0.55 + sympathy * 0.25 + pressure * 0.35, 4),
    vectorDelta: Object.freeze({
      legend,
      ridicule,
      sympathy,
      pressure,
      hype: safeRound(legend * 0.75, 4),
      chaos: safeRound(ridicule * 0.35, 4),
    }),
    crowdVelocityDelta: safeRound(legend * 0.45 + ridicule * 0.22, 4),
    witnessDensityDelta: 1.2,
    reason: 'PROOF_PUBLISHED',
    sourceKind: 'PROOF',
    proofHash: input.proofHash,
    actorId: input.actorId,
    targetId: input.targetId,
    metadata: Object.freeze({
      verified: input.verified,
      humiliatesRival: input.humiliatesRival ?? false,
      savesRun: input.savesRun ?? false,
    }),
  });
}

export function deriveAudienceHeatDeltaFromWorldEvent(input: {
  readonly eventName: string;
  readonly pressureBoost?: number;
  readonly chaosBoost?: number;
  readonly predationBoost?: number;
  readonly suspicionBoost?: number;
  readonly witnessWeight?: number;
}): AudienceHeatDelta {
  const pressure = input.pressureBoost ?? 6.5;
  const chaos = input.chaosBoost ?? 7.5;
  const predation = input.predationBoost ?? 5;
  const suspicion = input.suspicionBoost ?? 4.2;

  return Object.freeze({
    scoreDelta: safeRound(pressure * 0.55 + chaos * 0.6 + predation * 0.5 + suspicion * 0.35, 4),
    vectorDelta: Object.freeze({
      pressure,
      chaos,
      predation,
      suspicion,
      fear: safeRound(pressure * 0.45, 4),
    }),
    crowdVelocityDelta: safeRound(pressure * 0.4 + chaos * 0.45, 4),
    witnessDensityDelta: input.witnessWeight ?? 1.8,
    presenceOverride: 'WATCHING',
    reason: 'WORLD_EVENT',
    sourceKind: 'WORLD_EVENT',
    metadata: Object.freeze({
      eventName: input.eventName,
    }),
  });
}

// ============================================================================
// MARK: Forecast
// ============================================================================

export interface AudienceHeatForecast {
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly forecastWindowMs: number;
  readonly predictedScore: number;
  readonly predictedBand: AudienceHeatBand;
  readonly predictedPresence: AudiencePresenceState;
  readonly swarmRisk: 'NONE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  readonly confidence: number;
  readonly generatedAt: LedgerUnixMs;
}

export function forecastAudienceHeat(
  state: AudienceHeatState,
  priorEntries: readonly AudienceHeatEntry[],
  forecastWindowMs: number = 30_000,
  thresholds: AudienceThresholds = DEFAULT_THRESHOLDS,
  now: LedgerUnixMs = asUnixMs(Date.now()),
): AudienceHeatForecast {
  const channelEntries = priorEntries
    .filter((e) => e.channelId === state.channelId && e.roomId === state.roomId)
    .slice(-8);

  const n = channelEntries.length;
  const weights = channelEntries.map((_, i) => (i + 1) / Math.max(n, 1));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  const weightedScore = n > 0
    ? channelEntries.reduce((acc, e, i) => acc + e.nextState.score * weights[i], 0) / weightSum
    : state.score;

  const velocities = channelEntries.slice(1).map((e, i) =>
    e.nextState.score - channelEntries[i].nextState.score,
  );
  const avgVelocity = velocities.length > 0
    ? velocities.reduce((a, b) => a + b, 0) / velocities.length
    : 0;

  const forecastSteps = forecastWindowMs / (5_000);
  const predictedScore = safeRound(clamp(weightedScore + avgVelocity * forecastSteps, 0, 100), 4);
  const predictedBand = bandFromScore(predictedScore, thresholds);
  const predictedPresence = presenceFromScore(predictedScore, predictedBand);

  const swarmRisk: AudienceHeatForecast['swarmRisk'] =
    predictedScore >= 90 ? 'CRITICAL' :
    predictedScore >= 72 ? 'HIGH' :
    predictedScore >= 48 ? 'ELEVATED' :
    predictedScore >= 28 ? 'LOW' : 'NONE';

  const confidence = safeRound(clamp(n / 8, 0, 1), 4);

  return Object.freeze({
    roomId: state.roomId,
    channelId: state.channelId,
    forecastWindowMs,
    predictedScore,
    predictedBand,
    predictedPresence,
    swarmRisk,
    confidence,
    generatedAt: now,
  });
}

// ============================================================================
// MARK: Hotspot detection
// ============================================================================

export interface AudienceHeatHotspot {
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly peakScore: number;
  readonly peakBand: AudienceHeatBand;
  readonly peakAt: LedgerUnixMs;
  readonly sustained: boolean;
  readonly entryCountAboveThreshold: number;
}

export function detectAudienceHeatHotspots(
  entries: readonly AudienceHeatEntry[],
  scoreThreshold: number = 48,
): readonly AudienceHeatHotspot[] {
  const byChannel = new Map<string, AudienceHeatEntry[]>();
  for (const e of entries) {
    const key = `${e.roomId}:${e.channelId}`;
    const existing = byChannel.get(key) ?? [];
    existing.push(e);
    byChannel.set(key, existing);
  }

  const hotspots: AudienceHeatHotspot[] = [];
  for (const [key, channelEntries] of byChannel.entries()) {
    const [roomId, channelId] = key.split(':') as [LedgerRoomId, AudienceChannelId];
    const hot = channelEntries.filter((e) => e.nextState.score >= scoreThreshold);
    if (!hot.length) continue;
    const peak = hot.reduce((best, e) => e.nextState.score > best.nextState.score ? e : best);
    hotspots.push(Object.freeze({
      roomId,
      channelId,
      peakScore: peak.nextState.score,
      peakBand: peak.nextState.band,
      peakAt: peak.occurredAt,
      sustained: hot.length >= 3,
      entryCountAboveThreshold: hot.length,
    }));
  }

  return Object.freeze(hotspots.sort((a, b) => b.peakScore - a.peakScore));
}

// ============================================================================
// MARK: Export envelope
// ============================================================================

export interface AudienceHeatExportEnvelope {
  readonly snapshot: AudienceRoomSnapshot;
  readonly entries: readonly AudienceHeatEntry[];
  readonly summary: AudienceHeatSummary;
  readonly diagnostics: AudienceHeatDiagnostics;
  readonly stats: AudienceHeatLedgerStats;
  readonly hotspots: readonly AudienceHeatHotspot[];
  readonly exportedAt: LedgerUnixMs;
}

export function exportAudienceHeatEnvelope(
  ledger: AudienceHeatLedger,
  roomId: LedgerRoomId,
  now: LedgerUnixMs = asUnixMs(Date.now()),
): AudienceHeatExportEnvelope {
  const snapshot = ledger.getSnapshot(roomId, now);
  const entries = ledger.getEntries(roomId);
  const summary = ledger.getSummary(roomId, now);
  const diagnostics = ledger.getDiagnostics(roomId, now);
  const stats = buildAudienceHeatLedgerStats(snapshot, entries, now);
  const hotspots = detectAudienceHeatHotspots(entries);

  return Object.freeze({ snapshot, entries, summary, diagnostics, stats, hotspots, exportedAt: now });
}

// ============================================================================
// MARK: Annotation
// ============================================================================

export interface AudienceHeatAnnotation {
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly annotatedAtMs: LedgerUnixMs;
  readonly label: string;
  readonly notes: string;
  readonly tags: readonly string[];
  readonly flagged: boolean;
}

const _heatAnnotationMap = new Map<string, AudienceHeatAnnotation>();

export function annotateAudienceHeatState(
  state: AudienceHeatState,
  annotation: Omit<AudienceHeatAnnotation, 'roomId' | 'channelId' | 'annotatedAtMs'>,
): AudienceHeatAnnotation {
  const key = `${state.roomId}:${state.channelId}`;
  const record = Object.freeze({
    roomId: state.roomId,
    channelId: state.channelId,
    annotatedAtMs: asUnixMs(Date.now()),
    ...annotation,
  });
  _heatAnnotationMap.set(key, record);
  return record;
}

export function getAudienceHeatAnnotation(
  roomId: LedgerRoomId,
  channelId: AudienceChannelId,
): AudienceHeatAnnotation | null {
  return _heatAnnotationMap.get(`${roomId}:${channelId}`) ?? null;
}

export function listAudienceHeatAnnotations(): readonly AudienceHeatAnnotation[] {
  return Object.freeze([..._heatAnnotationMap.values()]);
}

export function listFlaggedAudienceHeatAnnotations(): readonly AudienceHeatAnnotation[] {
  return Object.freeze([..._heatAnnotationMap.values()].filter((a) => a.flagged));
}

// ============================================================================
// MARK: Rebuild audit
// ============================================================================

export interface AudienceHeatRebuildResult {
  readonly roomId: LedgerRoomId;
  readonly processedChannelCount: number;
  readonly violationCount: number;
  readonly violations: readonly AudienceHeatPolicyViolation[];
  readonly hotspots: readonly AudienceHeatHotspot[];
  readonly stats: AudienceHeatLedgerStats;
  readonly rebuiltAtMs: LedgerUnixMs;
}

export function rebuildAndAuditAudienceHeat(
  ledger: AudienceHeatLedger,
  roomId: LedgerRoomId,
  now: LedgerUnixMs = asUnixMs(Date.now()),
): AudienceHeatRebuildResult {
  const snapshot = ledger.getSnapshot(roomId, now);
  const entries = ledger.getEntries(roomId);
  const violations = detectAudienceHeatPolicyViolations(snapshot, {}, now);
  const hotspots = detectAudienceHeatHotspots(entries);
  const stats = buildAudienceHeatLedgerStats(snapshot, entries, now);

  return Object.freeze({
    roomId,
    processedChannelCount: Object.keys(snapshot.channels).length,
    violationCount: violations.length,
    violations,
    hotspots,
    stats,
    rebuiltAtMs: now,
  });
}

// ============================================================================
// MARK: Channel heat ranking
// ============================================================================

export interface AudienceHeatRankingRow {
  readonly channelId: AudienceChannelId;
  readonly score: number;
  readonly band: AudienceHeatBand;
  readonly presence: AudiencePresenceState;
  readonly witnessDensity: number;
  readonly crowdVelocity: number;
  readonly dominantVector: AudienceHeatVectorKey;
  readonly isShadow: boolean;
}

export function buildAudienceHeatRanking(
  snapshot: AudienceRoomSnapshot,
): readonly AudienceHeatRankingRow[] {
  const rows: AudienceHeatRankingRow[] = Object.values(snapshot.channels).map((state) => {
    const vectorKeys: AudienceHeatVectorKey[] = ['hype', 'ridicule', 'fear', 'pressure', 'suspicion', 'conspiracy', 'predation', 'sympathy', 'legend', 'chaos'];
    let dominantVector: AudienceHeatVectorKey = 'pressure';
    let dominantValue = 0;
    for (const key of vectorKeys) {
      if (state.vector[key] > dominantValue) { dominantValue = state.vector[key]; dominantVector = key; }
    }
    return Object.freeze({
      channelId: state.channelId,
      score: state.score,
      band: state.band,
      presence: state.presence,
      witnessDensity: state.witnessDensity,
      crowdVelocity: state.crowdVelocity,
      dominantVector,
      isShadow: isShadowChannel(state.channelId),
    });
  });
  return Object.freeze(rows.sort((a, b) => b.score - a.score));
}

// ============================================================================
// MARK: Witness window analysis
// ============================================================================

export interface AudienceWitnessWindowSummary {
  readonly channelId: AudienceChannelId;
  readonly totalWindows: number;
  readonly activeWindows: number;
  readonly averageWeight: number;
  readonly heaviestKind: AudienceWitnessKind;
  readonly publicCount: number;
  readonly privateCount: number;
  readonly shadowOnlyCount: number;
}

export function summarizeWitnessWindows(
  state: AudienceHeatState,
  now: LedgerUnixMs = asUnixMs(Date.now()),
): AudienceWitnessWindowSummary {
  const active = state.witnessWindows.filter((w) => w.closesAt > now);
  const kindCounts = new Map<AudienceWitnessKind, number>();
  for (const w of active) { kindCounts.set(w.kind, (kindCounts.get(w.kind) ?? 0) + 1); }
  let heaviestKind: AudienceWitnessKind = 'CROWD';
  let heaviestCount = 0;
  for (const [kind, count] of kindCounts.entries()) {
    if (count > heaviestCount) { heaviestCount = count; heaviestKind = kind; }
  }
  const avgWeight = active.length > 0
    ? safeRound(active.reduce((acc, w) => acc + w.weight, 0) / active.length, 4)
    : 0;

  return Object.freeze({
    channelId: state.channelId,
    totalWindows: state.witnessWindows.length,
    activeWindows: active.length,
    averageWeight: avgWeight,
    heaviestKind,
    publicCount: active.filter((w) => w.visibility === 'PUBLIC').length,
    privateCount: active.filter((w) => w.visibility === 'PRIVATE').length,
    shadowOnlyCount: active.filter((w) => w.visibility === 'SHADOW_ONLY').length,
  });
}

// ============================================================================
// MARK: Volatility index
// ============================================================================

export interface AudienceHeatVolatilityIndex {
  readonly roomId: LedgerRoomId;
  readonly channelId: AudienceChannelId;
  readonly scoreVariance: number;
  readonly velocityVariance: number;
  readonly volatilityTier: 'STABLE' | 'FLUCTUATING' | 'VOLATILE' | 'CHAOTIC';
  readonly isVolatile: boolean;
  readonly sampledEntryCount: number;
}

export function computeAudienceHeatVolatility(
  entries: readonly AudienceHeatEntry[],
): readonly AudienceHeatVolatilityIndex[] {
  const byChannel = new Map<string, AudienceHeatEntry[]>();
  for (const e of entries) {
    const key = `${e.roomId}:${e.channelId}`;
    const existing = byChannel.get(key) ?? [];
    existing.push(e);
    byChannel.set(key, existing);
  }

  const results: AudienceHeatVolatilityIndex[] = [];
  for (const [key, channelEntries] of byChannel.entries()) {
    const [roomId, channelId] = key.split(':') as [LedgerRoomId, AudienceChannelId];
    if (channelEntries.length < 2) {
      results.push(Object.freeze({ roomId, channelId, scoreVariance: 0, velocityVariance: 0, volatilityTier: 'STABLE', isVolatile: false, sampledEntryCount: channelEntries.length }));
      continue;
    }
    const scores = channelEntries.map((e) => e.nextState.score);
    const velocities = channelEntries.map((e) => e.nextState.crowdVelocity);
    const scoreMean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const scoreVariance = safeRound(scores.reduce((acc, s) => acc + (s - scoreMean) ** 2, 0) / scores.length, 4);
    const velMean = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const velocityVariance = safeRound(velocities.reduce((acc, v) => acc + (v - velMean) ** 2, 0) / velocities.length, 4);
    const composite = scoreVariance * 0.7 + velocityVariance * 0.3;
    const volatilityTier: AudienceHeatVolatilityIndex['volatilityTier'] =
      composite >= 500 ? 'CHAOTIC' :
      composite >= 200 ? 'VOLATILE' :
      composite >= 60 ? 'FLUCTUATING' : 'STABLE';
    results.push(Object.freeze({ roomId, channelId, scoreVariance, velocityVariance, volatilityTier, isVolatile: composite >= 200, sampledEntryCount: channelEntries.length }));
  }

  return Object.freeze(results.sort((a, b) => b.scoreVariance - a.scoreVariance));
}

// ============================================================================
// MARK: Derive from rescue event
// ============================================================================

export function deriveAudienceHeatDeltaFromRescue(input: {
  readonly severity: number;
  readonly wasHeeded: boolean;
  readonly helperId?: LedgerParticipantId;
  readonly rescuedId?: LedgerParticipantId;
  readonly sceneId?: LedgerSceneId;
}): AudienceHeatDelta {
  const sympathy = safeRound(input.severity * 0.6 + (input.wasHeeded ? 4.5 : 1.2), 4);
  const pressure = safeRound(input.severity * 0.35, 4);
  const legend = input.wasHeeded ? safeRound(input.severity * 0.18, 4) : 0;
  const fear = safeRound(input.severity * 0.12, 4);

  return Object.freeze({
    scoreDelta: safeRound(sympathy * 0.5 + pressure * 0.35 + legend * 0.25, 4),
    vectorDelta: Object.freeze({ sympathy, pressure, legend, fear }),
    crowdVelocityDelta: safeRound(sympathy * 0.3 + pressure * 0.2, 4),
    witnessDensityDelta: input.wasHeeded ? 0.8 : 0.3,
    reason: 'RESCUE_INTERVENTION',
    sourceKind: 'RESCUE',
    sceneId: input.sceneId,
    actorId: input.helperId,
    targetId: input.rescuedId,
    metadata: Object.freeze({ severity: input.severity, wasHeeded: input.wasHeeded }),
  });
}

export function deriveAudienceHeatDeltaFromNegotiation(input: {
  readonly leakSeverity: number;
  readonly provedBluff: boolean;
  readonly dealerId?: LedgerParticipantId;
  readonly targetId?: LedgerParticipantId;
}): AudienceHeatDelta {
  const predation = safeRound(input.leakSeverity * 0.7 + (input.provedBluff ? 5.4 : 2.1), 4);
  const suspicion = safeRound(input.leakSeverity * 0.4 + (input.provedBluff ? 3.2 : 1.0), 4);
  const ridicule = input.provedBluff ? safeRound(input.leakSeverity * 0.5, 4) : 0;
  const fear = safeRound(input.leakSeverity * 0.22, 4);

  return Object.freeze({
    scoreDelta: safeRound(predation * 0.55 + suspicion * 0.3 + ridicule * 0.25, 4),
    vectorDelta: Object.freeze({ predation, suspicion, ridicule, fear }),
    crowdVelocityDelta: safeRound(predation * 0.35, 4),
    witnessDensityDelta: safeRound(input.leakSeverity * 0.15, 4),
    reason: 'NEGOTIATION_LEAK',
    sourceKind: 'NEGOTIATION',
    actorId: input.dealerId,
    targetId: input.targetId,
    metadata: Object.freeze({ leakSeverity: input.leakSeverity, provedBluff: input.provedBluff }),
  });
}

export function filterEntriesByReason(
  entries: readonly AudienceHeatEntry[],
  reason: AudienceTransitionReason,
): readonly AudienceHeatEntry[] {
  return Object.freeze(entries.filter((e) => e.nextState.lastTransitionReason === reason));
}

export function filterEntriesByBand(
  entries: readonly AudienceHeatEntry[],
  band: AudienceHeatBand,
): readonly AudienceHeatEntry[] {
  return Object.freeze(entries.filter((e) => e.nextState.band === band));
}

export function sortEntriesByScore(
  entries: readonly AudienceHeatEntry[],
  descending = true,
): readonly AudienceHeatEntry[] {
  return Object.freeze(
    [...entries].sort((a, b) =>
      descending ? b.nextState.score - a.nextState.score : a.nextState.score - b.nextState.score,
    ),
  );
}

export function countEntriesByBand(
  entries: readonly AudienceHeatEntry[],
): Readonly<Record<AudienceHeatBand, number>> {
  const counts: Partial<Record<AudienceHeatBand, number>> = {};
  for (const e of entries) {
    counts[e.nextState.band] = (counts[e.nextState.band] ?? 0) + 1;
  }
  return Object.freeze(counts as Record<AudienceHeatBand, number>);
}

export function countEntriesByPresence(
  entries: readonly AudienceHeatEntry[],
): Readonly<Record<AudiencePresenceState, number>> {
  const counts: Partial<Record<AudiencePresenceState, number>> = {};
  for (const e of entries) {
    counts[e.nextState.presence] = (counts[e.nextState.presence] ?? 0) + 1;
  }
  return Object.freeze(counts as Record<AudiencePresenceState, number>);
}
