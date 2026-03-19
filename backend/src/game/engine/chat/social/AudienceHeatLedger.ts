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
