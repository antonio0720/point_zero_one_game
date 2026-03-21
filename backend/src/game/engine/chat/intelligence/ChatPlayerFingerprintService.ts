/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT PLAYER FINGERPRINT SERVICE
 * FILE: backend/src/game/engine/chat/intelligence/ChatPlayerFingerprintService.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Durable backend authority for player fingerprint aggregation.
 *
 * This service deliberately keeps the frontend fingerprint model as the
 * canonical vector/archetype estimator while adding backend-only
 * responsibilities that the thin repo baseline does not yet own:
 *
 * - append-only event journaling
 * - replay-safe restore/export flows
 * - room/channel indexing
 * - archetype and axis lookup surfaces
 * - bulk observe / bulk query lanes
 * - room/channel heat summaries for directors and orchestrators
 * - stale-player pruning and deterministic rebuilds
 *
 * Design contract
 * ---------------
 * The service does not fork the fingerprint math. It wraps the shared model so
 * the classification logic stays aligned with the repo's existing frontend
 * intelligence surface while the backend gains operational depth.
 * ============================================================================
 */

import {
  type ChatPlayerArchetypeId,
  type ChatPlayerCounterplayHint,
  type ChatPlayerFingerprintAxisId,
  type ChatPlayerFingerprintEvent,
  type ChatPlayerFingerprintEventType,
  type ChatPlayerFingerprintSnapshot,
  clamp01,
} from '../../../../../../shared/contracts/chat/player-fingerprint';
import {
  ChatPlayerFingerprintModel,
} from '../../../../../../pzo-web/src/engines/chat/intelligence/ChatPlayerFingerprintModel';

const DEFAULT_EVENT_JOURNAL_LIMIT = 10_000;
const DEFAULT_TAIL_SIZE = 160;
const DEFAULT_MAX_PLAYERS = 4_096;
const DEFAULT_PRUNE_IDLE_MS = 1000 * 60 * 60 * 6;
const DEFAULT_RECENT_WINDOW_MS = 1000 * 60 * 20;
const DEFAULT_SUMMARY_PLAYER_LIMIT = 12;
const UNKNOWN_ROOM_ID = '__unknown_room__';
const UNKNOWN_CHANNEL_ID = '__unknown_channel__';

export type FingerprintRiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
export type FingerprintTiltBand = 'STEADY' | 'UNSETTLED' | 'TILTED' | 'BROKEN';
export type FingerprintPublicnessBand = 'PRIVATE' | 'MIXED' | 'PUBLIC';

export interface ChatPlayerFingerprintServiceClock {
  now(): number;
}

export interface ChatPlayerFingerprintServiceOptions {
  readonly tailSize?: number;
  readonly maxPlayers?: number;
  readonly eventJournalLimit?: number;
  readonly pruneIdleMs?: number;
  readonly recentWindowMs?: number;
  readonly clock?: ChatPlayerFingerprintServiceClock;
}

export interface ChatPlayerFingerprintEnvelope {
  readonly snapshot: ChatPlayerFingerprintSnapshot;
  readonly counterplay: ChatPlayerCounterplayHint;
  readonly riskBand: FingerprintRiskBand;
  readonly tiltBand: FingerprintTiltBand;
  readonly publicnessBand: FingerprintPublicnessBand;
  readonly lastObservedAt: number;
  readonly recentRooms: readonly string[];
  readonly recentChannels: readonly string[];
  readonly recentEventTypes: readonly ChatPlayerFingerprintEventType[];
  readonly confidenceLabel: 'COLD' | 'EARLY' | 'WARM' | 'LOCKED';
}

export interface ChatPlayerFingerprintServiceExport {
  readonly exportedAt: number;
  readonly knownPlayerIds: readonly string[];
  readonly journal: readonly ChatPlayerFingerprintEvent[];
}

export interface ChatPlayerFingerprintServiceStats {
  readonly knownPlayers: number;
  readonly totalEvents: number;
  readonly mostRecentEventAt: number | null;
  readonly earliestEventAt: number | null;
  readonly hotRooms: readonly ChatPlayerFingerprintRoomSummary[];
  readonly hotChannels: readonly ChatPlayerFingerprintChannelSummary[];
}

export interface ChatPlayerFingerprintRoomSummary {
  readonly roomId: string;
  readonly playerCount: number;
  readonly playerIds: readonly string[];
  readonly averageRisk01: number;
  readonly averageTilt01: number;
  readonly averagePublicness01: number;
  readonly archetypeSpread: Readonly<Record<ChatPlayerArchetypeId, number>>;
  readonly leadingAxes: readonly ChatPlayerFingerprintAxisId[];
  readonly recommendedObjectives: readonly string[];
  readonly commonSeams: readonly string[];
  readonly hottestPlayers: readonly string[];
  readonly mostRecentEventAt: number | null;
}

export interface ChatPlayerFingerprintChannelSummary {
  readonly channelId: string;
  readonly playerCount: number;
  readonly playerIds: readonly string[];
  readonly averageRisk01: number;
  readonly averageTilt01: number;
  readonly averagePublicness01: number;
  readonly recommendedSceneArchetypes: readonly string[];
  readonly pressureResponseTags: readonly string[];
  readonly resilienceTags: readonly string[];
  readonly mostRecentEventAt: number | null;
}

interface PlayerLedgerEntry {
  readonly playerId: string;
  readonly events: readonly ChatPlayerFingerprintEvent[];
  readonly lastObservedAt: number;
  readonly lastRoomId: string | null;
  readonly lastChannelId: string | null;
}

interface PlayerDerivedState {
  readonly snapshot: ChatPlayerFingerprintSnapshot;
  readonly counterplay: ChatPlayerCounterplayHint;
  readonly lastObservedAt: number;
}

interface MessageObservationInput {
  readonly playerId: string;
  readonly messageId: string;
  readonly text: string;
  readonly createdAt?: number;
  readonly roomId?: string | null;
  readonly channelId?: string | null;
}

const ARCHETYPES: readonly ChatPlayerArchetypeId[] = [
  'THE_SPECULATOR',
  'THE_LAWYER',
  'THE_SHOWMAN',
  'THE_SURVIVOR',
  'THE_GHOST',
  'THE_COUNTERPUNCHER',
  'THE_PERFECTIONIST',
  'THE_SHARK_BAIT',
] as const;

const AXES: readonly ChatPlayerFingerprintAxisId[] = [
  'IMPULSIVE_VS_PATIENT',
  'GREED_VS_DEFENSE',
  'BLUFF_VS_LITERAL',
  'COMEBACK_VS_COLLAPSE',
  'PUBLIC_VS_PRIVATE',
  'PROCEDURE_AWARE_VS_CARELESS',
  'NOVELTY_SEEKING_VS_STABILITY',
  'TILT_VS_DISCIPLINE',
  'RISK_APPETITE',
  'RECOVERY_STRENGTH',
] as const;

const OBJECTIVE_STOP_WORDS = new Set(['AND', 'OR', 'THE', 'A']);

export class ChatPlayerFingerprintService {
  private model: ChatPlayerFingerprintModel;
  private readonly tailSize: number;
  private readonly maxPlayers: number;
  private readonly eventJournalLimit: number;
  private readonly pruneIdleMs: number;
  private readonly recentWindowMs: number;
  private readonly clock: ChatPlayerFingerprintServiceClock;

  private readonly journal: ChatPlayerFingerprintEvent[] = [];
  private readonly perPlayerJournal = new Map<string, PlayerLedgerEntry>();
  private readonly derivedByPlayer = new Map<string, PlayerDerivedState>();
  private readonly playersByRoom = new Map<string, Set<string>>();
  private readonly playersByChannel = new Map<string, Set<string>>();
  private readonly playersByArchetype = new Map<ChatPlayerArchetypeId, Set<string>>();
  private readonly latestSnapshotByRoom = new Map<string, number>();
  private readonly latestSnapshotByChannel = new Map<string, number>();

  constructor(options: ChatPlayerFingerprintServiceOptions = {}) {
    this.tailSize = Math.max(24, options.tailSize ?? DEFAULT_TAIL_SIZE);
    this.maxPlayers = Math.max(32, options.maxPlayers ?? DEFAULT_MAX_PLAYERS);
    this.eventJournalLimit = Math.max(256, options.eventJournalLimit ?? DEFAULT_EVENT_JOURNAL_LIMIT);
    this.pruneIdleMs = Math.max(1000 * 60, options.pruneIdleMs ?? DEFAULT_PRUNE_IDLE_MS);
    this.recentWindowMs = Math.max(1000 * 5, options.recentWindowMs ?? DEFAULT_RECENT_WINDOW_MS);
    this.clock = options.clock ?? { now: () => Date.now() };
    this.model = new ChatPlayerFingerprintModel({ tailSize: this.tailSize });

    for (const archetype of ARCHETYPES) {
      this.playersByArchetype.set(archetype, new Set<string>());
    }
  }

  // ==========================================================================
  // Primary authoritative observation lane
  // ==========================================================================

  observe(event: ChatPlayerFingerprintEvent): ChatPlayerFingerprintSnapshot {
    const normalized = this.normalizeEvent(event);
    const snapshot = this.model.observe(normalized);
    this.recordObservation(normalized, snapshot);
    this.enforceCapacity(normalized.playerId);
    return snapshot;
  }

  observeMany(events: readonly ChatPlayerFingerprintEvent[]): readonly ChatPlayerFingerprintSnapshot[] {
    if (events.length === 0) return [];

    const sorted = [...events].sort((left, right) => {
      if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
      return left.eventId.localeCompare(right.eventId);
    });

    const snapshots: ChatPlayerFingerprintSnapshot[] = [];
    for (const event of sorted) {
      snapshots.push(this.observe(event));
    }
    return snapshots;
  }

  observeMessage(input: MessageObservationInput): ChatPlayerFingerprintSnapshot {
    const createdAt = input.createdAt ?? this.clock.now();
    const snapshot = this.model.observeMessage(
      input.playerId,
      input.messageId,
      input.text,
      createdAt,
      input.channelId ?? null,
      input.roomId ?? null,
    );

    const event = snapshot.eventTail[snapshot.eventTail.length - 1] ?? this.deriveMessageEvent({
      playerId: input.playerId,
      messageId: input.messageId,
      text: input.text,
      createdAt,
      channelId: input.channelId ?? null,
      roomId: input.roomId ?? null,
    });

    this.recordObservation(event, snapshot);
    this.enforceCapacity(input.playerId);
    return snapshot;
  }

  observeSystemEvent(
    playerId: string,
    eventType: ChatPlayerFingerprintEventType,
    options: {
      readonly eventId: string;
      readonly createdAt?: number;
      readonly roomId?: string | null;
      readonly channelId?: string | null;
      readonly text?: string | null;
      readonly tags?: readonly string[];
      readonly intensity01?: number;
      readonly publicWitness01?: number;
    },
  ): ChatPlayerFingerprintSnapshot {
    return this.observe({
      eventId: options.eventId,
      playerId,
      eventType,
      createdAt: options.createdAt ?? this.clock.now(),
      roomId: options.roomId ?? null,
      channelId: options.channelId ?? null,
      text: options.text ?? null,
      tags: options.tags ?? [],
      intensity01: options.intensity01,
      publicWitness01: options.publicWitness01,
    });
  }

  // ==========================================================================
  // Direct read APIs
  // ==========================================================================

  hasPlayer(playerId: string): boolean {
    return this.derivedByPlayer.has(playerId);
  }

  getSnapshot(playerId: string): ChatPlayerFingerprintSnapshot {
    return this.derivedByPlayer.get(playerId)?.snapshot ?? this.model.getSnapshot(playerId);
  }

  getSnapshots(playerIds: readonly string[]): readonly ChatPlayerFingerprintSnapshot[] {
    return playerIds.map((playerId) => this.getSnapshot(playerId));
  }

  getCounterplayHint(playerId: string): ChatPlayerCounterplayHint {
    return this.derivedByPlayer.get(playerId)?.counterplay ?? this.model.getCounterplayHint(playerId);
  }

  getCounterplayHints(playerIds: readonly string[]): readonly ChatPlayerCounterplayHint[] {
    return playerIds.map((playerId) => this.getCounterplayHint(playerId));
  }

  getEnvelope(playerId: string): ChatPlayerFingerprintEnvelope {
    const derived = this.derivedByPlayer.get(playerId);
    const snapshot = derived?.snapshot ?? this.getSnapshot(playerId);
    const counterplay = derived?.counterplay ?? this.getCounterplayHint(playerId);
    const ledger = this.perPlayerJournal.get(playerId);
    const recentEvents = ledger?.events.slice(-6) ?? snapshot.eventTail.slice(-6);

    return {
      snapshot,
      counterplay,
      riskBand: this.resolveRiskBand(snapshot),
      tiltBand: this.resolveTiltBand(snapshot),
      publicnessBand: this.resolvePublicnessBand(snapshot),
      lastObservedAt: derived?.lastObservedAt ?? snapshot.updatedAt,
      recentRooms: this.collectRecentRooms(snapshot),
      recentChannels: this.collectRecentChannels(snapshot),
      recentEventTypes: recentEvents.map((event) => event.eventType),
      confidenceLabel: this.resolveConfidenceLabel(snapshot.confidence01),
    };
  }

  getKnownPlayerIds(): readonly string[] {
    return [...this.derivedByPlayer.keys()].sort();
  }

  getKnownPlayerCount(): number {
    return this.derivedByPlayer.size;
  }

  getRecentEvents(playerId: string, limit = 12): readonly ChatPlayerFingerprintEvent[] {
    const safeLimit = Math.max(1, limit);
    return (this.perPlayerJournal.get(playerId)?.events ?? []).slice(-safeLimit);
  }

  getAllRecentEvents(limit = 64): readonly ChatPlayerFingerprintEvent[] {
    const safeLimit = Math.max(1, limit);
    return this.journal.slice(-safeLimit);
  }

  // ==========================================================================
  // Archetype / axis / counterplay query surfaces
  // ==========================================================================

  getArchetype(playerId: string): ChatPlayerArchetypeId {
    return this.getSnapshot(playerId).archetype;
  }

  getPlayersByArchetype(archetype: ChatPlayerArchetypeId): readonly string[] {
    return [...(this.playersByArchetype.get(archetype) ?? new Set<string>())].sort();
  }

  getDominantAxes(playerId: string): readonly ChatPlayerFingerprintAxisId[] {
    return this.getSnapshot(playerId).dominantAxes;
  }

  getTopPlayersByAxis(
    axis: ChatPlayerFingerprintAxisId,
    limit = DEFAULT_SUMMARY_PLAYER_LIMIT,
  ): readonly string[] {
    const safeLimit = Math.max(1, limit);
    return [...this.derivedByPlayer.values()]
      .map((entry) => ({
        playerId: entry.snapshot.playerId,
        score: this.resolveAxisScore(entry.snapshot, axis),
      }))
      .sort((left, right) => right.score - left.score || left.playerId.localeCompare(right.playerId))
      .slice(0, safeLimit)
      .map((entry) => entry.playerId);
  }

  getPlayersByRiskBand(riskBand: FingerprintRiskBand): readonly string[] {
    return [...this.derivedByPlayer.values()]
      .filter((entry) => this.resolveRiskBand(entry.snapshot) === riskBand)
      .map((entry) => entry.snapshot.playerId)
      .sort();
  }

  getPlayersByTiltBand(tiltBand: FingerprintTiltBand): readonly string[] {
    return [...this.derivedByPlayer.values()]
      .filter((entry) => this.resolveTiltBand(entry.snapshot) === tiltBand)
      .map((entry) => entry.snapshot.playerId)
      .sort();
  }

  // ==========================================================================
  // Room / channel authority surfaces
  // ==========================================================================

  getPlayersForRoom(roomId: string): readonly string[] {
    const key = this.normalizeRoomId(roomId);
    return [...(this.playersByRoom.get(key) ?? new Set<string>())].sort();
  }

  getPlayersForChannel(channelId: string): readonly string[] {
    const key = this.normalizeChannelId(channelId);
    return [...(this.playersByChannel.get(key) ?? new Set<string>())].sort();
  }

  getRoomSummary(roomId: string): ChatPlayerFingerprintRoomSummary {
    const playerIds = this.getPlayersForRoom(roomId);
    const snapshots = playerIds.map((playerId) => this.getSnapshot(playerId));
    const hints = playerIds.map((playerId) => this.getCounterplayHint(playerId));

    return {
      roomId,
      playerCount: playerIds.length,
      playerIds,
      averageRisk01: this.average(snapshots.map((snapshot) => snapshot.vector.riskAppetite01)),
      averageTilt01: this.average(snapshots.map((snapshot) => snapshot.vector.tilt01)),
      averagePublicness01: this.average(snapshots.map((snapshot) => snapshot.vector.publicness01)),
      archetypeSpread: this.resolveArchetypeSpread(snapshots),
      leadingAxes: this.resolveLeadingAxesForSnapshots(snapshots),
      recommendedObjectives: this.resolveMostCommonTokens(
        hints.flatMap((hint) => hint.idealBotObjectives),
        6,
      ),
      commonSeams: this.resolveMostCommonTokens(
        snapshots.flatMap((snapshot) => snapshot.exploitableSeams),
        6,
      ),
      hottestPlayers: [...snapshots]
        .sort((left, right) => {
          const delta = this.computePressureWeight(right) - this.computePressureWeight(left);
          if (delta !== 0) return delta;
          return left.playerId.localeCompare(right.playerId);
        })
        .slice(0, 5)
        .map((snapshot) => snapshot.playerId),
      mostRecentEventAt: this.latestSnapshotByRoom.get(this.normalizeRoomId(roomId)) ?? null,
    };
  }

  getChannelSummary(channelId: string): ChatPlayerFingerprintChannelSummary {
    const playerIds = this.getPlayersForChannel(channelId);
    const snapshots = playerIds.map((playerId) => this.getSnapshot(playerId));
    const hints = playerIds.map((playerId) => this.getCounterplayHint(playerId));

    return {
      channelId,
      playerCount: playerIds.length,
      playerIds,
      averageRisk01: this.average(snapshots.map((snapshot) => snapshot.vector.riskAppetite01)),
      averageTilt01: this.average(snapshots.map((snapshot) => snapshot.vector.tilt01)),
      averagePublicness01: this.average(snapshots.map((snapshot) => snapshot.vector.publicness01)),
      recommendedSceneArchetypes: this.resolveMostCommonTokens(
        hints.flatMap((hint) => hint.idealSceneArchetypes),
        6,
      ),
      pressureResponseTags: this.resolveMostCommonTokens(
        snapshots.flatMap((snapshot) => snapshot.pressureResponseTags),
        6,
      ),
      resilienceTags: this.resolveMostCommonTokens(
        snapshots.flatMap((snapshot) => snapshot.resilienceTags),
        6,
      ),
      mostRecentEventAt: this.latestSnapshotByChannel.get(this.normalizeChannelId(channelId)) ?? null,
    };
  }

  getHotRooms(limit = 8): readonly ChatPlayerFingerprintRoomSummary[] {
    const safeLimit = Math.max(1, limit);
    return [...this.playersByRoom.keys()]
      .filter((roomId) => roomId !== UNKNOWN_ROOM_ID)
      .map((roomId) => this.getRoomSummary(roomId))
      .sort((left, right) => {
        if (right.playerCount !== left.playerCount) return right.playerCount - left.playerCount;
        return (right.mostRecentEventAt ?? 0) - (left.mostRecentEventAt ?? 0);
      })
      .slice(0, safeLimit);
  }

  getHotChannels(limit = 8): readonly ChatPlayerFingerprintChannelSummary[] {
    const safeLimit = Math.max(1, limit);
    return [...this.playersByChannel.keys()]
      .filter((channelId) => channelId !== UNKNOWN_CHANNEL_ID)
      .map((channelId) => this.getChannelSummary(channelId))
      .sort((left, right) => {
        if (right.playerCount !== left.playerCount) return right.playerCount - left.playerCount;
        return (right.mostRecentEventAt ?? 0) - (left.mostRecentEventAt ?? 0);
      })
      .slice(0, safeLimit);
  }

  // ==========================================================================
  // Lifecycle / replay / export / pruning
  // ==========================================================================

  exportState(): ChatPlayerFingerprintServiceExport {
    return {
      exportedAt: this.clock.now(),
      knownPlayerIds: this.getKnownPlayerIds(),
      journal: [...this.journal],
    };
  }

  restore(state: ChatPlayerFingerprintServiceExport): void {
    this.reset();
    this.observeMany(state.journal);
  }

  pruneStalePlayers(now = this.clock.now()): readonly string[] {
    const threshold = now - this.pruneIdleMs;
    const stalePlayerIds = [...this.derivedByPlayer.values()]
      .filter((entry) => entry.lastObservedAt < threshold)
      .map((entry) => entry.snapshot.playerId);

    if (stalePlayerIds.length === 0) return [];

    const staleSet = new Set(stalePlayerIds);
    const retainedJournal = this.journal.filter((event) => !staleSet.has(event.playerId));
    this.reset();
    this.observeMany(retainedJournal);
    return stalePlayerIds.sort();
  }

  resetPlayer(playerId: string): boolean {
    if (!this.derivedByPlayer.has(playerId)) return false;
    const retainedJournal = this.journal.filter((event) => event.playerId !== playerId);
    this.reset();
    this.observeMany(retainedJournal);
    return true;
  }

  reset(): void {
    this.model = new ChatPlayerFingerprintModel({ tailSize: this.tailSize });
    this.journal.length = 0;
    this.perPlayerJournal.clear();
    this.derivedByPlayer.clear();
    this.playersByRoom.clear();
    this.playersByChannel.clear();
    this.latestSnapshotByRoom.clear();
    this.latestSnapshotByChannel.clear();

    for (const archetype of ARCHETYPES) {
      this.playersByArchetype.set(archetype, new Set<string>());
    }
  }

  rebuild(): void {
    const retainedJournal = [...this.journal];
    this.reset();
    this.observeMany(retainedJournal);
  }

  getStats(): ChatPlayerFingerprintServiceStats {
    return {
      knownPlayers: this.getKnownPlayerCount(),
      totalEvents: this.journal.length,
      mostRecentEventAt: this.journal.length === 0 ? null : this.journal[this.journal.length - 1]?.createdAt ?? null,
      earliestEventAt: this.journal.length === 0 ? null : this.journal[0]?.createdAt ?? null,
      hotRooms: this.getHotRooms(5),
      hotChannels: this.getHotChannels(5),
    };
  }

  // ==========================================================================
  // Internal record / indexing / normalization lane
  // ==========================================================================

  private recordObservation(
    event: ChatPlayerFingerprintEvent,
    snapshot: ChatPlayerFingerprintSnapshot,
  ): void {
    const counterplay = this.model.getCounterplayHint(event.playerId);
    const previous = this.perPlayerJournal.get(event.playerId);
    const previousSnapshot = this.derivedByPlayer.get(event.playerId)?.snapshot;
    const lastObservedAt = Math.max(previous?.lastObservedAt ?? 0, event.createdAt, snapshot.updatedAt);
    const nextEvents = this.appendPlayerEvent(previous?.events ?? [], event);
    const roomId = this.normalizeRoomId(event.roomId ?? this.lastNonNullRoomId(snapshot));
    const channelId = this.normalizeChannelId(event.channelId ?? this.lastNonNullChannelId(snapshot));

    this.journal.push(event);
    if (this.journal.length > this.eventJournalLimit) {
      this.journal.splice(0, this.journal.length - this.eventJournalLimit);
    }

    this.perPlayerJournal.set(event.playerId, {
      playerId: event.playerId,
      events: nextEvents,
      lastObservedAt,
      lastRoomId: roomId === UNKNOWN_ROOM_ID ? null : roomId,
      lastChannelId: channelId === UNKNOWN_CHANNEL_ID ? null : channelId,
    });

    this.derivedByPlayer.set(event.playerId, {
      snapshot,
      counterplay,
      lastObservedAt,
    });

    this.updateArchetypeIndex(event.playerId, previousSnapshot?.archetype ?? null, snapshot.archetype);
    this.updateMembershipIndex(this.playersByRoom, roomId, event.playerId);
    this.updateMembershipIndex(this.playersByChannel, channelId, event.playerId);
    this.latestSnapshotByRoom.set(roomId, Math.max(this.latestSnapshotByRoom.get(roomId) ?? 0, event.createdAt));
    this.latestSnapshotByChannel.set(channelId, Math.max(this.latestSnapshotByChannel.get(channelId) ?? 0, event.createdAt));
  }

  private normalizeEvent(event: ChatPlayerFingerprintEvent): ChatPlayerFingerprintEvent {
    return {
      ...event,
      createdAt: Number.isFinite(event.createdAt) ? Math.max(0, Math.floor(event.createdAt)) : this.clock.now(),
      roomId: event.roomId ?? null,
      channelId: event.channelId ?? null,
      text: event.text ?? null,
      tags: this.normalizeTags(event.tags),
      intensity01: event.intensity01 == null ? undefined : clamp01(event.intensity01),
      publicWitness01: event.publicWitness01 == null ? undefined : clamp01(event.publicWitness01),
    };
  }

  private appendPlayerEvent(
    existing: readonly ChatPlayerFingerprintEvent[],
    event: ChatPlayerFingerprintEvent,
  ): readonly ChatPlayerFingerprintEvent[] {
    const next = [...existing, event]
      .sort((left, right) => {
        if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
        return left.eventId.localeCompare(right.eventId);
      })
      .slice(-this.eventJournalLimit);
    return next;
  }

  private updateMembershipIndex(index: Map<string, Set<string>>, key: string, playerId: string): void {
    const normalized = key || UNKNOWN_ROOM_ID;
    const bucket = index.get(normalized) ?? new Set<string>();
    bucket.add(playerId);
    index.set(normalized, bucket);
  }

  private updateArchetypeIndex(
    playerId: string,
    previous: ChatPlayerArchetypeId | null,
    next: ChatPlayerArchetypeId,
  ): void {
    if (previous && previous !== next) {
      this.playersByArchetype.get(previous)?.delete(playerId);
    }
    this.playersByArchetype.get(next)?.add(playerId);
  }

  private enforceCapacity(mostRecentPlayerId: string): void {
    if (this.derivedByPlayer.size <= this.maxPlayers) return;

    const evictionCandidates = [...this.derivedByPlayer.values()]
      .filter((entry) => entry.snapshot.playerId !== mostRecentPlayerId)
      .sort((left, right) => left.lastObservedAt - right.lastObservedAt);

    const overflow = this.derivedByPlayer.size - this.maxPlayers;
    const evicted = evictionCandidates.slice(0, overflow).map((entry) => entry.snapshot.playerId);
    if (evicted.length === 0) return;

    const evictedSet = new Set(evicted);
    const retainedJournal = this.journal.filter((event) => !evictedSet.has(event.playerId));
    this.reset();
    this.observeMany(retainedJournal);
  }

  // ==========================================================================
  // Summary / scoring helpers
  // ==========================================================================

  private resolveArchetypeSpread(
    snapshots: readonly ChatPlayerFingerprintSnapshot[],
  ): Readonly<Record<ChatPlayerArchetypeId, number>> {
    const spread = Object.fromEntries(ARCHETYPES.map((archetype) => [archetype, 0])) as Record<
      ChatPlayerArchetypeId,
      number
    >;

    for (const snapshot of snapshots) {
      spread[snapshot.archetype] += 1;
    }
    return spread;
  }

  private resolveLeadingAxesForSnapshots(
    snapshots: readonly ChatPlayerFingerprintSnapshot[],
  ): readonly ChatPlayerFingerprintAxisId[] {
    if (snapshots.length === 0) return [];

    return AXES
      .map((axis) => ({
        axis,
        score: this.average(snapshots.map((snapshot) => this.resolveAxisScore(snapshot, axis))),
      }))
      .sort((left, right) => right.score - left.score || left.axis.localeCompare(right.axis))
      .slice(0, 4)
      .map((entry) => entry.axis);
  }

  private resolveAxisScore(
    snapshot: ChatPlayerFingerprintSnapshot,
    axis: ChatPlayerFingerprintAxisId,
  ): number {
    switch (axis) {
      case 'IMPULSIVE_VS_PATIENT':
        return snapshot.vector.impulsive01;
      case 'GREED_VS_DEFENSE':
        return snapshot.vector.greed01;
      case 'BLUFF_VS_LITERAL':
        return snapshot.vector.bluff01;
      case 'COMEBACK_VS_COLLAPSE':
        return snapshot.vector.comeback01;
      case 'PUBLIC_VS_PRIVATE':
        return snapshot.vector.publicness01;
      case 'PROCEDURE_AWARE_VS_CARELESS':
        return snapshot.vector.procedureAwareness01;
      case 'NOVELTY_SEEKING_VS_STABILITY':
        return snapshot.vector.noveltySeeking01;
      case 'TILT_VS_DISCIPLINE':
        return snapshot.vector.tilt01;
      case 'RISK_APPETITE':
        return snapshot.vector.riskAppetite01;
      case 'RECOVERY_STRENGTH':
        return snapshot.vector.recoveryStrength01;
      default: {
        const exhaustive: never = axis;
        return exhaustive;
      }
    }
  }

  private computePressureWeight(snapshot: ChatPlayerFingerprintSnapshot): number {
    const vector = snapshot.vector;
    return Number(
      (
        vector.riskAppetite01 * 0.26 +
        vector.tilt01 * 0.24 +
        vector.greed01 * 0.18 +
        vector.bluff01 * 0.12 +
        vector.publicness01 * 0.1 +
        (1 - vector.recoveryStrength01) * 0.1
      ).toFixed(6),
    );
  }

  private resolveRiskBand(snapshot: ChatPlayerFingerprintSnapshot): FingerprintRiskBand {
    const score = snapshot.vector.riskAppetite01;
    if (score >= 0.85) return 'EXTREME';
    if (score >= 0.65) return 'HIGH';
    if (score >= 0.35) return 'MEDIUM';
    return 'LOW';
  }

  private resolveTiltBand(snapshot: ChatPlayerFingerprintSnapshot): FingerprintTiltBand {
    const score = snapshot.vector.tilt01;
    if (score >= 0.85) return 'BROKEN';
    if (score >= 0.65) return 'TILTED';
    if (score >= 0.35) return 'UNSETTLED';
    return 'STEADY';
  }

  private resolvePublicnessBand(snapshot: ChatPlayerFingerprintSnapshot): FingerprintPublicnessBand {
    const score = snapshot.vector.publicness01;
    if (score >= 0.68) return 'PUBLIC';
    if (score >= 0.34) return 'MIXED';
    return 'PRIVATE';
  }

  private resolveConfidenceLabel(confidence01: number): 'COLD' | 'EARLY' | 'WARM' | 'LOCKED' {
    if (confidence01 >= 0.9) return 'LOCKED';
    if (confidence01 >= 0.6) return 'WARM';
    if (confidence01 >= 0.3) return 'EARLY';
    return 'COLD';
  }

  private collectRecentRooms(snapshot: ChatPlayerFingerprintSnapshot): readonly string[] {
    const seen = new Set<string>();
    for (const event of [...snapshot.eventTail].reverse()) {
      if (!event.roomId) continue;
      seen.add(event.roomId);
      if (seen.size >= 5) break;
    }
    return [...seen];
  }

  private collectRecentChannels(snapshot: ChatPlayerFingerprintSnapshot): readonly string[] {
    const seen = new Set<string>();
    for (const event of [...snapshot.eventTail].reverse()) {
      if (!event.channelId) continue;
      seen.add(event.channelId);
      if (seen.size >= 5) break;
    }
    return [...seen];
  }

  private resolveMostCommonTokens(tokens: readonly string[], limit: number): readonly string[] {
    const safeLimit = Math.max(1, limit);
    const counts = new Map<string, number>();
    for (const token of tokens) {
      const normalized = token.trim();
      if (normalized.length === 0) continue;
      if (OBJECTIVE_STOP_WORDS.has(normalized.toUpperCase())) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, safeLimit)
      .map(([token]) => token);
  }

  private average(values: readonly number[]): number {
    if (values.length === 0) return 0;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(6));
  }

  // ==========================================================================
  // Deterministic message fallback lane
  // ==========================================================================

  private deriveMessageEvent(input: {
    readonly playerId: string;
    readonly messageId: string;
    readonly text: string;
    readonly createdAt: number;
    readonly roomId?: string | null;
    readonly channelId?: string | null;
  }): ChatPlayerFingerprintEvent {
    const normalizedText = input.text.trim().toLowerCase();
    let eventType: ChatPlayerFingerprintEventType = 'MESSAGE_SENT';

    if (normalizedText.includes('?')) eventType = 'MESSAGE_QUESTION';
    if (/(lol|lmao|cope|skill issue|cry|owned)/i.test(input.text)) eventType = 'MESSAGE_TAUNT';
    if (/(watch me|i got this|easy|light work|i never miss)/i.test(input.text)) eventType = 'MESSAGE_BOAST';
    if (/(whatever|sure|fine|k)/i.test(input.text)) eventType = 'MESSAGE_DEFLECTION';
    if (/(breathe|steady|calm|wait|hold)/i.test(input.text)) eventType = 'MESSAGE_CALM';

    return {
      eventId: input.messageId,
      playerId: input.playerId,
      eventType,
      createdAt: input.createdAt,
      roomId: input.roomId ?? null,
      channelId: input.channelId ?? null,
      text: input.text,
      tags: this.normalizeTags(this.deriveMessageTags(input.text)),
      intensity01: this.estimateIntensityFromText(input.text),
      publicWitness01: this.estimatePublicWitness(input.channelId ?? null),
    };
  }

  private deriveMessageTags(text: string): readonly string[] {
    const tags = new Set<string>();
    const normalized = text.trim().toLowerCase();

    if (normalized.length === 0) {
      tags.add('empty');
      return [...tags];
    }

    if (normalized.includes('?')) tags.add('question');
    if (/(lol|lmao|cope|owned|cry)/i.test(text)) tags.add('taunt');
    if (/(watch me|i got this|easy|never miss|light work)/i.test(text)) tags.add('boast');
    if (/(calm|steady|breathe|wait|hold)/i.test(text)) tags.add('calm');
    if (/(deal|offer|price|counter|terms)/i.test(text)) tags.add('negotiation');
    if (/(proof|receipt|remember|said that|again)/i.test(text)) tags.add('callback');
    if (/(help|save me|need backup|rescue)/i.test(text)) tags.add('rescue');
    if (/(syndicate|crew|team|ally)/i.test(text)) tags.add('trust');
    if (/(global|crowd|everyone|chat)/i.test(text)) tags.add('public');

    return [...tags];
  }

  private estimateIntensityFromText(text: string): number {
    const trimmed = text.trim();
    if (trimmed.length === 0) return 0;

    const exclamationCount = (trimmed.match(/!/g) ?? []).length;
    const upperCaseRatio = this.computeUpperCaseRatio(trimmed);
    const tauntSignal = /(cope|owned|skill issue|cry|fraud|bait)/i.test(trimmed) ? 0.18 : 0;
    const boastSignal = /(watch me|easy|light work|never miss|too easy)/i.test(trimmed) ? 0.12 : 0;
    const calmSignal = /(steady|breathe|wait|hold|calm)/i.test(trimmed) ? -0.08 : 0;
    const punctuationSignal = Math.min(0.2, exclamationCount * 0.04);
    const lengthSignal = Math.min(0.14, trimmed.length / 280);

    return clamp01(0.2 + punctuationSignal + upperCaseRatio * 0.28 + tauntSignal + boastSignal + calmSignal + lengthSignal);
  }

  private estimatePublicWitness(channelId: string | null): number {
    if (!channelId) return 0.22;
    const normalized = channelId.trim().toUpperCase();
    if (normalized.includes('GLOBAL')) return 0.95;
    if (normalized.includes('LOBBY')) return 0.82;
    if (normalized.includes('SPECTATOR')) return 0.88;
    if (normalized.includes('DEAL')) return 0.36;
    if (normalized.includes('DIRECT')) return 0.12;
    if (normalized.includes('SYNDICATE')) return 0.3;
    return 0.45;
  }

  private computeUpperCaseRatio(text: string): number {
    const letters = text.match(/[A-Za-z]/g) ?? [];
    if (letters.length === 0) return 0;
    const upper = letters.filter((letter) => letter === letter.toUpperCase()).length;
    return clamp01(upper / letters.length);
  }

  // ==========================================================================
  // Low-level normalization helpers
  // ==========================================================================

  private normalizeTags(tags: readonly string[] | undefined): readonly string[] {
    if (!tags || tags.length === 0) return [];
    const normalized = new Set<string>();
    for (const tag of tags) {
      const value = tag.trim().toLowerCase();
      if (value.length === 0) continue;
      normalized.add(value);
    }
    return [...normalized].sort();
  }

  private normalizeRoomId(roomId: string | null | undefined): string {
    const normalized = roomId?.trim();
    return normalized && normalized.length > 0 ? normalized : UNKNOWN_ROOM_ID;
  }

  private normalizeChannelId(channelId: string | null | undefined): string {
    const normalized = channelId?.trim();
    return normalized && normalized.length > 0 ? normalized : UNKNOWN_CHANNEL_ID;
  }

  private lastNonNullRoomId(snapshot: ChatPlayerFingerprintSnapshot): string | null {
    for (const event of [...snapshot.eventTail].reverse()) {
      if (event.roomId && event.roomId.trim().length > 0) return event.roomId;
    }
    return null;
  }

  private lastNonNullChannelId(snapshot: ChatPlayerFingerprintSnapshot): string | null {
    for (const event of [...snapshot.eventTail].reverse()) {
      if (event.channelId && event.channelId.trim().length > 0) return event.channelId;
    }
    return null;
  }
}

export function createChatPlayerFingerprintService(
  options: ChatPlayerFingerprintServiceOptions = {},
): ChatPlayerFingerprintService {
  return new ChatPlayerFingerprintService(options);
}
