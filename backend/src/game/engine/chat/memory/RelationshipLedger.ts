/**
 * POINT ZERO ONE — BACKEND CHAT RELATIONSHIP LEDGER
 * FILE: backend/src/game/engine/chat/memory/RelationshipLedger.ts
 *
 * Purpose:
 * Durable ledger facade that canonizes relationship events, snapshots,
 * callback recall, hot-counterpart ranking, channel focus continuity,
 * archive-friendly export, and bridge-friendly read models on top of the
 * backend ChatRelationshipService.
 *
 * Notes:
 * - This file is intentionally additive to the existing backend relationship
 *   service. It does not replace the service's vector evolution rules.
 * - The ledger owns indexing, read models, projections, pruning, retention,
 *   and high-throughput query helpers needed by drama, rescue, hater, helper,
 *   scene, liveops, and memory lanes.
 */

import type {
  ChatRelationshipAxisId,
  ChatRelationshipCounterpartKind,
  ChatRelationshipCounterpartState,
  ChatRelationshipEventDescriptor,
  ChatRelationshipEventType,
  ChatRelationshipLegacyProjection,
  ChatRelationshipNpcSignal,
  ChatRelationshipPressureBand,
  ChatRelationshipSnapshot,
  ChatRelationshipStance,
  ChatRelationshipSummaryView,
} from '../../../../../../shared/contracts/chat/relationship';
import { clamp01 } from '../../../../../../shared/contracts/chat/relationship';
import {
  ChatRelationshipService,
  DEFAULT_CHAT_RELATIONSHIP_SERVICE_CONFIG,
  type ChatRelationshipServiceConfig,
} from '../ChatRelationshipService';

export interface RelationshipLedgerRetentionPolicy {
  readonly maxEventsPerPlayer: number;
  readonly maxEventsPerCounterpart: number;
  readonly maxCallbacksPerCounterpart: number;
  readonly maxExportsPerPlayer: number;
  readonly maxSceneTail: number;
  readonly pruneIfIdleMs: number;
}

export interface RelationshipLedgerConfig {
  readonly relationshipService: ChatRelationshipService;
  readonly retention: RelationshipLedgerRetentionPolicy;
  readonly highHeatThreshold01: number;
  readonly rescueDebtThreshold01: number;
  readonly rivalryThreshold01: number;
  readonly trustThreshold01: number;
  readonly callbackThreshold01: number;
  readonly hotCounterpartWindowMs: number;
}

export interface RelationshipLedgerIndexEntry {
  readonly playerId: string;
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly eventCount: number;
  readonly firstTouchedAt: number;
  readonly lastTouchedAt: number;
  readonly lastEventId: string;
  readonly lastEventType: ChatRelationshipEventType;
  readonly lastSceneId?: string | null;
  readonly lastChannelId?: string | null;
  readonly lastPressureBand?: ChatRelationshipPressureBand | null;
  readonly stance: ChatRelationshipStance;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly trust01: number;
  readonly rivalry01: number;
  readonly rescueDebt01: number;
  readonly callbackReadiness01: number;
  readonly dominantAxes: readonly ChatRelationshipAxisId[];
  readonly tags: readonly string[];
}

export interface RelationshipLedgerCallbackReceipt {
  readonly callbackId: string;
  readonly counterpartId: string;
  readonly playerId: string;
  readonly label: string;
  readonly text: string;
  readonly weight01: number;
  readonly createdAt: number;
  readonly sourceEventId: string;
  readonly sourceEventType: ChatRelationshipEventType;
  readonly sourceSceneId?: string | null;
  readonly sourceChannelId?: string | null;
}

export interface RelationshipLedgerSceneSummary {
  readonly sceneId: string;
  readonly playerId: string;
  readonly counterpartIds: readonly string[];
  readonly eventIds: readonly string[];
  readonly firstSeenAt: number;
  readonly lastSeenAt: number;
  readonly witnessCount: number;
  readonly helperCount: number;
  readonly rivalCount: number;
  readonly publicHeat01: number;
  readonly pressurePeak: ChatRelationshipPressureBand;
}

export interface RelationshipLedgerChannelSummary {
  readonly channelId: string;
  readonly playerId: string;
  readonly focusedCounterpartId?: string;
  readonly totalEvents: number;
  readonly lastEventAt: number;
  readonly publicWitnessEvents: number;
  readonly privateWitnessEvents: number;
  readonly helperRescueEvents: number;
  readonly botTauntEvents: number;
  readonly comebackEvents: number;
  readonly collapseEvents: number;
  readonly avgIntensity01: number;
  readonly avgPublicWitness01: number;
}

export interface RelationshipLedgerPlayerExport {
  readonly playerId: string;
  readonly exportedAt: number;
  readonly snapshot: ChatRelationshipSnapshot;
  readonly summaries: readonly ChatRelationshipSummaryView[];
  readonly indices: readonly RelationshipLedgerIndexEntry[];
  readonly callbacks: readonly RelationshipLedgerCallbackReceipt[];
  readonly channels: readonly RelationshipLedgerChannelSummary[];
  readonly scenes: readonly RelationshipLedgerSceneSummary[];
}

export interface RelationshipLedgerStats {
  readonly playersTracked: number;
  readonly counterpartBucketsTracked: number;
  readonly totalEventsStored: number;
  readonly totalCallbacksStored: number;
  readonly totalSceneSummariesStored: number;
  readonly oldestActivityAt?: number;
  readonly newestActivityAt?: number;
}

export interface RelationshipLedgerEventRecord {
  readonly descriptor: ChatRelationshipEventDescriptor;
  readonly counterpartState: ChatRelationshipCounterpartState;
  readonly index: RelationshipLedgerIndexEntry;
  readonly callbackReceipt?: RelationshipLedgerCallbackReceipt;
  readonly channelSummary?: RelationshipLedgerChannelSummary;
  readonly sceneSummary?: RelationshipLedgerSceneSummary;
}

export interface RelationshipLedgerHotCounterpart {
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly score01: number;
  readonly trust01: number;
  readonly rivalry01: number;
  readonly rescueDebt01: number;
  readonly callbackReadiness01: number;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly stance: ChatRelationshipStance;
  readonly rationale: readonly string[];
}

export interface RelationshipLedgerQuery {
  readonly playerId: string;
  readonly counterpartIds?: readonly string[];
  readonly kinds?: readonly ChatRelationshipCounterpartKind[];
  readonly eventTypes?: readonly ChatRelationshipEventType[];
  readonly since?: number;
  readonly until?: number;
  readonly sceneId?: string;
  readonly channelId?: string;
  readonly minIntensity01?: number;
  readonly maxResults?: number;
}

export const DEFAULT_RELATIONSHIP_LEDGER_CONFIG: RelationshipLedgerConfig = Object.freeze({
  relationshipService: new ChatRelationshipService(DEFAULT_CHAT_RELATIONSHIP_SERVICE_CONFIG),
  retention: {
    maxEventsPerPlayer: 1200,
    maxEventsPerCounterpart: 180,
    maxCallbacksPerCounterpart: 24,
    maxExportsPerPlayer: 12,
    maxSceneTail: 96,
    pruneIfIdleMs: 1000 * 60 * 60 * 24 * 7,
  },
  highHeatThreshold01: 0.68,
  rescueDebtThreshold01: 0.57,
  rivalryThreshold01: 0.62,
  trustThreshold01: 0.58,
  callbackThreshold01: 0.46,
  hotCounterpartWindowMs: 1000 * 60 * 12,
});

interface PlayerLedgerBucket {
  readonly playerId: string;
  updatedAt: number;
  firstSeenAt: number;
  totalEvents: number;
  events: ChatRelationshipEventDescriptor[];
  indicesByCounterpartId: Map<string, RelationshipLedgerIndexEntry>;
  callbacksByCounterpartId: Map<string, RelationshipLedgerCallbackReceipt[]>;
  channels: Map<string, RelationshipLedgerChannelSummary>;
  scenes: Map<string, RelationshipLedgerSceneSummary>;
  exports: RelationshipLedgerPlayerExport[];
}

function now(): number { return Date.now(); }

function safeChannelId(event: ChatRelationshipEventDescriptor): string {
  return event.channelId ?? 'GLOBAL';
}

function safeSceneId(event: ChatRelationshipEventDescriptor): string {
  return event.sceneId ?? `scene:auto:${safeChannelId(event)}:${Math.floor(event.createdAt / 30_000)}`;
}

function uniqStrings(values: readonly (string | undefined | null)[]): readonly string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function trust01FromState(state: ChatRelationshipCounterpartState): number {
  return clamp01(state.vector.familiarity01 * 0.54 + state.vector.patience01 * 0.18 + state.vector.respect01 * 0.28);
}

function rivalry01FromState(state: ChatRelationshipCounterpartState): number {
  return clamp01(state.vector.contempt01 * 0.38 + state.vector.unfinishedBusiness01 * 0.32 + state.vector.obsession01 * 0.16 + state.publicPressureBias01 * 0.14);
}

function rescueDebt01FromState(state: ChatRelationshipCounterpartState): number {
  return clamp01(state.vector.traumaDebt01 * 0.72 + state.privatePressureBias01 * 0.18 + state.vector.familiarity01 * 0.10);
}

function callbackReadiness01FromState(state: ChatRelationshipCounterpartState): number {
  const topHint = state.callbackHints[0]?.weight01 ?? 0;
  return clamp01(topHint * 0.40 + state.vector.unfinishedBusiness01 * 0.25 + state.vector.predictiveConfidence01 * 0.15 + state.vector.familiarity01 * 0.20);
}

function publicWitness01(event: ChatRelationshipEventDescriptor): number {
  return clamp01(event.publicWitness01 ?? (
    event.eventType === 'PUBLIC_WITNESS' ? 0.80 :
    event.eventType === 'PRIVATE_WITNESS' ? 0.10 :
    event.eventType === 'BOT_TAUNT_EMITTED' ? 0.62 :
    event.eventType === 'RIVAL_WITNESS_EMITTED' ? 0.70 :
    event.eventType === 'ARCHIVIST_WITNESS_EMITTED' ? 0.38 :
    event.eventType === 'AMBIENT_WITNESS_EMITTED' ? 0.28 : 0.22
  ));
}

function pressureScore01(band: ChatRelationshipPressureBand | undefined | null): number {
  switch (band) {
    case 'CRITICAL': return 1;
    case 'HIGH': return 0.72;
    case 'MEDIUM': return 0.44;
    case 'LOW': return 0.18;
    default: return 0.28;
  }
}

function pressurePeak(a: ChatRelationshipPressureBand | undefined | null, b: ChatRelationshipPressureBand | undefined | null): ChatRelationshipPressureBand {
  const ranking: Record<ChatRelationshipPressureBand, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const aa = a ?? 'LOW';
  const bb = b ?? 'LOW';
  return ranking[aa] >= ranking[bb] ? aa : bb;
}

function hasAny<T>(candidate: readonly T[] | undefined, value: T): boolean {
  return !!candidate && candidate.includes(value);
}

function uniqueTags(event: ChatRelationshipEventDescriptor, state: ChatRelationshipCounterpartState): readonly string[] {
  return uniqStrings([
    ...(event.tags ?? []),
    state.stance,
    state.objective,
    ...state.dominantAxes,
    event.eventType,
    event.pressureBand ?? undefined,
  ]);
}

function matchesQueryEvent(event: ChatRelationshipEventDescriptor, query: RelationshipLedgerQuery): boolean {
  if (query.counterpartIds && !query.counterpartIds.includes(event.counterpartId)) return false;
  if (query.eventTypes && !query.eventTypes.includes(event.eventType)) return false;
  if (query.since !== undefined && event.createdAt < query.since) return false;
  if (query.until !== undefined && event.createdAt > query.until) return false;
  if (query.sceneId && safeSceneId(event) !== query.sceneId) return false;
  if (query.channelId && safeChannelId(event) !== query.channelId) return false;
  return true;
}

function hotScore01(
  state: ChatRelationshipCounterpartState,
  entry: RelationshipLedgerIndexEntry,
  updatedAt: number,
  windowMs: number,
): number {
  const freshness01 = clamp01(1 - Math.max(0, updatedAt - entry.lastTouchedAt) / Math.max(1, windowMs));
  return clamp01(
    state.intensity01 * 0.30 +
    rivalry01FromState(state) * 0.18 +
    trust01FromState(state) * 0.12 +
    rescueDebt01FromState(state) * 0.12 +
    callbackReadiness01FromState(state) * 0.10 +
    state.volatility01 * 0.08 +
    freshness01 * 0.10
  );
}

function hotRationale(
  state: ChatRelationshipCounterpartState,
  entry: RelationshipLedgerIndexEntry,
  score01: number,
): readonly string[] {
  const reasons: string[] = [];
  if (rivalry01FromState(state) > 0.60) reasons.push('rivalry_hot');
  if (trust01FromState(state) > 0.58) reasons.push('trustworthy_helper_lane');
  if (rescueDebt01FromState(state) > 0.56) reasons.push('rescue_debt_open');
  if (callbackReadiness01FromState(state) > 0.48) reasons.push('callback_ready');
  if (state.volatility01 > 0.45) reasons.push('volatile');
  if (entry.lastPressureBand === 'HIGH' || entry.lastPressureBand === 'CRITICAL') reasons.push('pressure_recent');
  if (score01 > 0.78) reasons.push('top_priority');
  return reasons;
}


// ============================================================================
// MARK: Trajectory tracking types
// ============================================================================

export interface RelationshipTrajectorySnapshot {
  readonly timestamp: number;
  readonly trust01: number;
  readonly rivalry01: number;
  readonly intensity01: number;
  readonly volatility01: number;
  readonly obsession01: number;
  readonly stance: ChatRelationshipStance;
}

export type RelationshipTrajectoryTrend = 'RISING' | 'FALLING' | 'PLATEAUED' | 'OSCILLATING' | 'ERUPTING' | 'INSUFFICIENT_DATA';

// ============================================================================
// MARK: Counterpart cluster types
// ============================================================================

export interface CounterpartCluster {
  readonly clusterId: string;
  readonly memberIds: readonly string[];
  readonly coOccurrenceStrength: 'WEAK' | 'MODERATE' | 'STRONG';
  readonly clusterRole: 'PACK' | 'ALLIANCE' | 'ENTOURAGE' | 'ORBIT';
  readonly memberCount: number;
}

// ============================================================================
// MARK: Compacted relationship summary
// ============================================================================

export interface CompactedRelationshipSummary {
  readonly counterpartId: string;
  readonly counterpartKind: ChatRelationshipCounterpartKind;
  readonly peakIntensity01: number;
  readonly lastTouchedAt: number;
  readonly eventCount: number;
  readonly stance: ChatRelationshipStance;
  readonly compactedAt: number;
}



// ============================================================================
// MARK: Cross-player relationship view
// ============================================================================

export interface CrossPlayerRelationshipView {
  readonly counterpartId: string;
  readonly playerAId: string;
  readonly playerBId: string;
  readonly stanceA: ChatRelationshipStance;
  readonly stanceB: ChatRelationshipStance;
  readonly trustDelta01: number;
  readonly rivalryDelta01: number;
  readonly intensityDelta01: number;
  readonly asymmetryScore01: number;
  readonly shareRival: boolean;
  readonly shareHelper: boolean;
}

// ============================================================================
// MARK: Event pattern types
// ============================================================================

export interface EventPattern {
  readonly patternId: string;
  readonly triggerEventType: string;
  readonly responseEventType: string;
  readonly confidence01: number;
  readonly recurrenceCount: number;
  readonly description: string;
}


export class RelationshipLedger {
  private readonly config: RelationshipLedgerConfig;
  private readonly players = new Map<string, PlayerLedgerBucket>();

  public constructor(config: Partial<Omit<RelationshipLedgerConfig, 'relationshipService'>> & {
    relationshipService?: ChatRelationshipService;
    relationshipServiceConfig?: Partial<ChatRelationshipServiceConfig>;
  } = {}) {
    const relationshipService =
      config.relationshipService ??
      new ChatRelationshipService(config.relationshipServiceConfig ?? DEFAULT_CHAT_RELATIONSHIP_SERVICE_CONFIG);

    this.config = Object.freeze({
      ...DEFAULT_RELATIONSHIP_LEDGER_CONFIG,
      ...config,
      relationshipService,
      retention: {
        ...DEFAULT_RELATIONSHIP_LEDGER_CONFIG.retention,
        ...(config.retention ?? {}),
      },
    });
  }

  private ensure(playerId: string): PlayerLedgerBucket {
    const existing = this.players.get(playerId);
    if (existing) return existing;
    const createdAt = now();
    const next: PlayerLedgerBucket = {
      playerId,
      updatedAt: createdAt,
      firstSeenAt: createdAt,
      totalEvents: 0,
      events: [],
      indicesByCounterpartId: new Map(),
      callbacksByCounterpartId: new Map(),
      channels: new Map(),
      scenes: new Map(),
      exports: [],
    };
    this.players.set(playerId, next);
    return next;
  }

  private getPlayerId(event: ChatRelationshipEventDescriptor): string {
    return event.playerId ?? 'GLOBAL';
  }

  private updateIndex(
    bucket: PlayerLedgerBucket,
    event: ChatRelationshipEventDescriptor,
    state: ChatRelationshipCounterpartState,
  ): RelationshipLedgerIndexEntry {
    const existing = bucket.indicesByCounterpartId.get(event.counterpartId);
    const next: RelationshipLedgerIndexEntry = {
      playerId: bucket.playerId,
      counterpartId: event.counterpartId,
      counterpartKind: event.counterpartKind,
      eventCount: (existing?.eventCount ?? 0) + 1,
      firstTouchedAt: existing?.firstTouchedAt ?? event.createdAt,
      lastTouchedAt: event.createdAt,
      lastEventId: event.eventId,
      lastEventType: event.eventType,
      lastSceneId: event.sceneId ?? existing?.lastSceneId ?? null,
      lastChannelId: event.channelId ?? existing?.lastChannelId ?? null,
      lastPressureBand: event.pressureBand ?? existing?.lastPressureBand ?? null,
      stance: state.stance,
      intensity01: state.intensity01,
      volatility01: state.volatility01,
      trust01: trust01FromState(state),
      rivalry01: rivalry01FromState(state),
      rescueDebt01: rescueDebt01FromState(state),
      callbackReadiness01: callbackReadiness01FromState(state),
      dominantAxes: state.dominantAxes,
      tags: uniqueTags(event, state),
    };
    bucket.indicesByCounterpartId.set(event.counterpartId, next);
    return next;
  }

  private updateCallbacks(
    bucket: PlayerLedgerBucket,
    event: ChatRelationshipEventDescriptor,
    state: ChatRelationshipCounterpartState,
  ): RelationshipLedgerCallbackReceipt | undefined {
    const best = state.callbackHints[0];
    if (!best || best.weight01 < this.config.callbackThreshold01) return undefined;
    const existing = bucket.callbacksByCounterpartId.get(event.counterpartId) ?? [];
    const next: RelationshipLedgerCallbackReceipt = {
      callbackId: best.callbackId,
      counterpartId: event.counterpartId,
      playerId: bucket.playerId,
      label: best.label,
      text: best.text,
      weight01: best.weight01,
      createdAt: event.createdAt,
      sourceEventId: event.eventId,
      sourceEventType: event.eventType,
      sourceSceneId: event.sceneId ?? null,
      sourceChannelId: event.channelId ?? null,
    };
    const updated = [next, ...existing.filter((item) => item.callbackId !== next.callbackId)]
      .slice(0, this.config.retention.maxCallbacksPerCounterpart);
    bucket.callbacksByCounterpartId.set(event.counterpartId, updated);
    return next;
  }

  private updateChannelSummary(
    bucket: PlayerLedgerBucket,
    event: ChatRelationshipEventDescriptor,
    state: ChatRelationshipCounterpartState,
  ): RelationshipLedgerChannelSummary {
    const channelId = safeChannelId(event);
    const existing = bucket.channels.get(channelId);
    const totalEvents = (existing?.totalEvents ?? 0) + 1;
    const witness = publicWitness01(event);
    const next: RelationshipLedgerChannelSummary = {
      channelId,
      playerId: bucket.playerId,
      focusedCounterpartId: event.counterpartId,
      totalEvents,
      lastEventAt: event.createdAt,
      publicWitnessEvents: (existing?.publicWitnessEvents ?? 0) + (event.eventType === 'PUBLIC_WITNESS' ? 1 : 0),
      privateWitnessEvents: (existing?.privateWitnessEvents ?? 0) + (event.eventType === 'PRIVATE_WITNESS' ? 1 : 0),
      helperRescueEvents: (existing?.helperRescueEvents ?? 0) + (event.eventType === 'HELPER_RESCUE_EMITTED' ? 1 : 0),
      botTauntEvents: (existing?.botTauntEvents ?? 0) + (event.eventType === 'BOT_TAUNT_EMITTED' ? 1 : 0),
      comebackEvents: (existing?.comebackEvents ?? 0) + (event.eventType === 'PLAYER_COMEBACK' ? 1 : 0),
      collapseEvents: (existing?.collapseEvents ?? 0) + (event.eventType === 'PLAYER_COLLAPSE' ? 1 : 0),
      avgIntensity01: clamp01((((existing?.avgIntensity01 ?? 0) * (totalEvents - 1)) + state.intensity01) / totalEvents),
      avgPublicWitness01: clamp01((((existing?.avgPublicWitness01 ?? 0) * (totalEvents - 1)) + witness) / totalEvents),
    };
    bucket.channels.set(channelId, next);
    return next;
  }

  private updateSceneSummary(
    bucket: PlayerLedgerBucket,
    event: ChatRelationshipEventDescriptor,
  ): RelationshipLedgerSceneSummary {
    const sceneId = safeSceneId(event);
    const existing = bucket.scenes.get(sceneId);
    const publicHeat = publicWitness01(event);
    const counterpartIds = uniqStrings([event.counterpartId, ...(existing?.counterpartIds ?? [])]);
    const eventIds = uniqStrings([event.eventId, ...(existing?.eventIds ?? [])]).slice(0, this.config.retention.maxSceneTail);
    const next: RelationshipLedgerSceneSummary = {
      sceneId,
      playerId: bucket.playerId,
      counterpartIds,
      eventIds,
      firstSeenAt: existing?.firstSeenAt ?? event.createdAt,
      lastSeenAt: event.createdAt,
      witnessCount:
        (existing?.witnessCount ?? 0) +
        (event.eventType === 'PUBLIC_WITNESS' || event.eventType === 'PRIVATE_WITNESS' || event.eventType === 'RIVAL_WITNESS_EMITTED' || event.eventType === 'ARCHIVIST_WITNESS_EMITTED' || event.eventType === 'AMBIENT_WITNESS_EMITTED'
          ? 1 : 0),
      helperCount: (existing?.helperCount ?? 0) + (event.counterpartKind === 'HELPER' ? 1 : 0),
      rivalCount: (existing?.rivalCount ?? 0) + (event.counterpartKind === 'RIVAL' || event.counterpartKind === 'BOT' ? 1 : 0),
      publicHeat01: clamp01(Math.max(existing?.publicHeat01 ?? 0, publicHeat)),
      pressurePeak: pressurePeak(existing?.pressurePeak, event.pressureBand),
    };
    bucket.scenes.set(sceneId, next);
    return next;
  }

  private trimBucket(bucket: PlayerLedgerBucket): void {
    if (bucket.events.length > this.config.retention.maxEventsPerPlayer) {
      bucket.events = bucket.events
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, this.config.retention.maxEventsPerPlayer);
    }
    for (const [counterpartId, callbacks] of bucket.callbacksByCounterpartId) {
      if (callbacks.length <= this.config.retention.maxCallbacksPerCounterpart) continue;
      bucket.callbacksByCounterpartId.set(counterpartId, callbacks.slice(0, this.config.retention.maxCallbacksPerCounterpart));
    }
    if (bucket.exports.length > this.config.retention.maxExportsPerPlayer) {
      bucket.exports = bucket.exports.slice(0, this.config.retention.maxExportsPerPlayer);
    }
  }

  private stateFor(playerId: string, counterpartId: string): ChatRelationshipCounterpartState | undefined {
    return this.config.relationshipService.getSnapshot(playerId).counterparts.find((item) => item.counterpartId === counterpartId);
  }

  public recordEvent(event: ChatRelationshipEventDescriptor): RelationshipLedgerEventRecord {
    const playerId = this.getPlayerId(event);
    const bucket = this.ensure(playerId);
    const state = this.config.relationshipService.applyEvent({ ...event, playerId });
    bucket.updatedAt = event.createdAt;
    bucket.totalEvents += 1;
    bucket.events = [event, ...bucket.events]
      .filter((item, index, arr) => index === arr.findIndex((candidate) => candidate.eventId === item.eventId))
      .sort((a, b) => b.createdAt - a.createdAt);
    const index = this.updateIndex(bucket, event, state);
    const callbackReceipt = this.updateCallbacks(bucket, event, state);
    const channelSummary = this.updateChannelSummary(bucket, event, state);
    const sceneSummary = this.updateSceneSummary(bucket, event);
    this.trimBucket(bucket);
    return {
      descriptor: event,
      counterpartState: state,
      index,
      callbackReceipt,
      channelSummary,
      sceneSummary,
    };
  }

  public recordEvents(events: readonly ChatRelationshipEventDescriptor[]): readonly RelationshipLedgerEventRecord[] {
    return [...events]
      .sort((a, b) => a.createdAt - b.createdAt || a.eventId.localeCompare(b.eventId))
      .map((event) => this.recordEvent(event));
  }

  public getSnapshot(playerId: string): ChatRelationshipSnapshot {
    return this.config.relationshipService.getSnapshot(playerId);
  }

  public getCounterpartState(playerId: string, counterpartId: string): ChatRelationshipCounterpartState | undefined {
    return this.stateFor(playerId, counterpartId);
  }

  public getCounterpartLegacyProjection(playerId: string, counterpartId: string): ChatRelationshipLegacyProjection | undefined {
    return this.config.relationshipService.getLegacyProjection(playerId, counterpartId);
  }

  public listCounterpartSummaries(playerId: string): readonly ChatRelationshipSummaryView[] {
    return this.config.relationshipService.summarize(playerId);
  }

  public listCounterpartIndices(playerId: string): readonly RelationshipLedgerIndexEntry[] {
    const bucket = this.ensure(playerId);
    return [...bucket.indicesByCounterpartId.values()].sort((a, b) =>
      b.intensity01 - a.intensity01 ||
      b.lastTouchedAt - a.lastTouchedAt ||
      a.counterpartId.localeCompare(b.counterpartId),
    );
  }

  public listHotCounterparts(playerId: string, limit = 12): readonly RelationshipLedgerHotCounterpart[] {
    const snapshot = this.getSnapshot(playerId);
    const bucket = this.ensure(playerId);
    return snapshot.counterparts
      .map((state) => {
        const entry = bucket.indicesByCounterpartId.get(state.counterpartId);
        if (!entry) return undefined;
        const score01 = hotScore01(state, entry, bucket.updatedAt, this.config.hotCounterpartWindowMs);
        return {
          counterpartId: state.counterpartId,
          counterpartKind: state.counterpartKind,
          score01,
          trust01: trust01FromState(state),
          rivalry01: rivalry01FromState(state),
          rescueDebt01: rescueDebt01FromState(state),
          callbackReadiness01: callbackReadiness01FromState(state),
          intensity01: state.intensity01,
          volatility01: state.volatility01,
          stance: state.stance,
          rationale: hotRationale(state, entry, score01),
        } satisfies RelationshipLedgerHotCounterpart;
      })
      .filter((value): value is RelationshipLedgerHotCounterpart => !!value)
      .sort((a, b) => b.score01 - a.score01 || b.intensity01 - a.intensity01 || a.counterpartId.localeCompare(b.counterpartId))
      .slice(0, limit);
  }

  public listRecentEvents(query: RelationshipLedgerQuery): readonly ChatRelationshipEventDescriptor[] {
    const bucket = this.ensure(query.playerId);
    const maxResults = query.maxResults ?? 64;
    return bucket.events
      .filter((event) => matchesQueryEvent(event, query))
      .filter((event) => {
        if (!query.kinds) return true;
        const entry = bucket.indicesByCounterpartId.get(event.counterpartId);
        return !!entry && query.kinds.includes(entry.counterpartKind);
      })
      .filter((event) => {
        if (query.minIntensity01 === undefined) return true;
        const entry = bucket.indicesByCounterpartId.get(event.counterpartId);
        return !!entry && entry.intensity01 >= query.minIntensity01;
      })
      .slice(0, maxResults);
  }

  public recallCallbacks(playerId: string, counterpartId?: string, minWeight01 = this.config.callbackThreshold01): readonly RelationshipLedgerCallbackReceipt[] {
    const bucket = this.ensure(playerId);
    const source = counterpartId
      ? (bucket.callbacksByCounterpartId.get(counterpartId) ?? [])
      : [...bucket.callbacksByCounterpartId.values()].flat();
    return source
      .filter((item) => item.weight01 >= minWeight01)
      .sort((a, b) => b.weight01 - a.weight01 || b.createdAt - a.createdAt || a.callbackId.localeCompare(b.callbackId));
  }

  public listChannelSummaries(playerId: string): readonly RelationshipLedgerChannelSummary[] {
    const bucket = this.ensure(playerId);
    return [...bucket.channels.values()].sort((a, b) => b.lastEventAt - a.lastEventAt || a.channelId.localeCompare(b.channelId));
  }

  public listSceneSummaries(playerId: string): readonly RelationshipLedgerSceneSummary[] {
    const bucket = this.ensure(playerId);
    return [...bucket.scenes.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt || a.sceneId.localeCompare(b.sceneId));
  }

  public projectNpcSignal(playerId: string, counterpartId: string): ChatRelationshipNpcSignal | undefined {
    return this.config.relationshipService.projectNpcSignal(playerId, counterpartId);
  }

  public exportPlayer(playerId: string): RelationshipLedgerPlayerExport {
    const bucket = this.ensure(playerId);
    const exportRecord: RelationshipLedgerPlayerExport = {
      playerId,
      exportedAt: now(),
      snapshot: this.getSnapshot(playerId),
      summaries: this.listCounterpartSummaries(playerId),
      indices: this.listCounterpartIndices(playerId),
      callbacks: this.recallCallbacks(playerId),
      channels: this.listChannelSummaries(playerId),
      scenes: this.listSceneSummaries(playerId),
    };
    bucket.exports = [exportRecord, ...bucket.exports].slice(0, this.config.retention.maxExportsPerPlayer);
    return exportRecord;
  }

  public listExports(playerId: string): readonly RelationshipLedgerPlayerExport[] {
    return [...this.ensure(playerId).exports];
  }

  public forgetPlayer(playerId: string): boolean {
    return this.players.delete(playerId);
  }

  public pruneIdlePlayers(referenceNow = now()): readonly string[] {
    const removed: string[] = [];
    for (const [playerId, bucket] of this.players) {
      if (referenceNow - bucket.updatedAt < this.config.retention.pruneIfIdleMs) continue;
      this.players.delete(playerId);
      removed.push(playerId);
    }
    return removed;
  }

  public stats(): RelationshipLedgerStats {
    let counterpartBucketsTracked = 0;
    let totalEventsStored = 0;
    let totalCallbacksStored = 0;
    let totalSceneSummariesStored = 0;
    let oldestActivityAt: number | undefined;
    let newestActivityAt: number | undefined;
    for (const bucket of this.players.values()) {
      counterpartBucketsTracked += bucket.indicesByCounterpartId.size;
      totalEventsStored += bucket.events.length;
      totalSceneSummariesStored += bucket.scenes.size;
      for (const callbacks of bucket.callbacksByCounterpartId.values()) totalCallbacksStored += callbacks.length;
      oldestActivityAt = oldestActivityAt === undefined ? bucket.firstSeenAt : Math.min(oldestActivityAt, bucket.firstSeenAt);
      newestActivityAt = newestActivityAt === undefined ? bucket.updatedAt : Math.max(newestActivityAt, bucket.updatedAt);
    }
    return {
      playersTracked: this.players.size,
      counterpartBucketsTracked,
      totalEventsStored,
      totalCallbacksStored,
      totalSceneSummariesStored,
      oldestActivityAt,
      newestActivityAt,
    };
  }

  public listPlayerMessageEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_MESSAGE'],
      maxResults,
    });
  }

  public listPlayerQuestionEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_QUESTION'],
      maxResults,
    });
  }

  public listPlayerAngerEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_ANGER'],
      maxResults,
    });
  }

  public listPlayerTrollEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_TROLL'],
      maxResults,
    });
  }

  public listPlayerFlexEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_FLEX'],
      maxResults,
    });
  }

  public listPlayerCalmEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_CALM'],
      maxResults,
    });
  }

  public listPlayerHesitationEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_HESITATION'],
      maxResults,
    });
  }

  public listPlayerDisciplineEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_DISCIPLINE'],
      maxResults,
    });
  }

  public listPlayerGreedEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_GREED'],
      maxResults,
    });
  }

  public listPlayerBluffEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_BLUFF'],
      maxResults,
    });
  }

  public listPlayerOverconfidenceEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_OVERCONFIDENCE'],
      maxResults,
    });
  }

  public listPlayerComebackEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_COMEBACK'],
      maxResults,
    });
  }

  public listPlayerCollapseEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_COLLAPSE'],
      maxResults,
    });
  }

  public listPlayerBreachEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_BREACH'],
      maxResults,
    });
  }

  public listPlayerPerfectDefenseEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_PERFECT_DEFENSE'],
      maxResults,
    });
  }

  public listPlayerFailedGambleEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_FAILED_GAMBLE'],
      maxResults,
    });
  }

  public listPlayerNearSovereigntyEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PLAYER_NEAR_SOVEREIGNTY'],
      maxResults,
    });
  }

  public listNegotiationWindowEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['NEGOTIATION_WINDOW'],
      maxResults,
    });
  }

  public listMarketAlertEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['MARKET_ALERT'],
      maxResults,
    });
  }

  public listBotTauntEmittedEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['BOT_TAUNT_EMITTED'],
      maxResults,
    });
  }

  public listBotRetreatEmittedEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['BOT_RETREAT_EMITTED'],
      maxResults,
    });
  }

  public listHelperRescueEmittedEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['HELPER_RESCUE_EMITTED'],
      maxResults,
    });
  }

  public listRivalWitnessEmittedEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['RIVAL_WITNESS_EMITTED'],
      maxResults,
    });
  }

  public listArchivistWitnessEmittedEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['ARCHIVIST_WITNESS_EMITTED'],
      maxResults,
    });
  }

  public listAmbientWitnessEmittedEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['AMBIENT_WITNESS_EMITTED'],
      maxResults,
    });
  }

  public listPublicWitnessEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PUBLIC_WITNESS'],
      maxResults,
    });
  }

  public listPrivateWitnessEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['PRIVATE_WITNESS'],
      maxResults,
    });
  }

  public listRunStartEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['RUN_START'],
      maxResults,
    });
  }

  public listRunEndEvents(playerId: string, maxResults = 32): readonly ChatRelationshipEventDescriptor[] {
    return this.listRecentEvents({
      playerId,
      eventTypes: ['RUN_END'],
      maxResults,
    });
  }

  public getTrustScore(playerId: string, counterpartId: string): number {
    return this.listCounterpartIndices(playerId).find((item) => item.counterpartId === counterpartId)?.trust01 ?? 0;
  }

  public getRivalryScore(playerId: string, counterpartId: string): number {
    return this.listCounterpartIndices(playerId).find((item) => item.counterpartId === counterpartId)?.rivalry01 ?? 0;
  }

  public getRescueDebtScore(playerId: string, counterpartId: string): number {
    return this.listCounterpartIndices(playerId).find((item) => item.counterpartId === counterpartId)?.rescueDebt01 ?? 0;
  }

  public getCallbackReadinessScore(playerId: string, counterpartId: string): number {
    return this.listCounterpartIndices(playerId).find((item) => item.counterpartId === counterpartId)?.callbackReadiness01 ?? 0;
  }

  public getIntensityScore(playerId: string, counterpartId: string): number {
    return this.listCounterpartIndices(playerId).find((item) => item.counterpartId === counterpartId)?.intensity01 ?? 0;
  }

  public getVolatilityScore(playerId: string, counterpartId: string): number {
    return this.listCounterpartIndices(playerId).find((item) => item.counterpartId === counterpartId)?.volatility01 ?? 0;
  }

  public listDismissiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.stance === 'DISMISSIVE')
      .slice(0, limit);
  }

  public listClinicalCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.stance === 'CLINICAL')
      .slice(0, limit);
  }

  public listProbingCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.stance === 'PROBING')
      .slice(0, limit);
  }

  public listPredatoryCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.stance === 'PREDATORY')
      .slice(0, limit);
  }

  public listHuntingCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.stance === 'HUNTING')
      .slice(0, limit);
  }

  public listObsessedCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.stance === 'OBSESSED')
      .slice(0, limit);
  }

  public listRespectfulCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.stance === 'RESPECTFUL')
      .slice(0, limit);
  }

  public listWoundedCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.stance === 'WOUNDED')
      .slice(0, limit);
  }

  public listProtectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.stance === 'PROTECTIVE')
      .slice(0, limit);
  }

  public listCuriousCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.stance === 'CURIOUS')
      .slice(0, limit);
  }

  public listHumiliateObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('HUMILIATE'))
      .slice(0, limit);
  }

  public listContainObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('CONTAIN'))
      .slice(0, limit);
  }

  public listProvokeObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('PROVOKE'))
      .slice(0, limit);
  }

  public listStudyObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('STUDY'))
      .slice(0, limit);
  }

  public listPressureObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('PRESSURE'))
      .slice(0, limit);
  }

  public listRepriceObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('REPRICE'))
      .slice(0, limit);
  }

  public listDelayObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('DELAY'))
      .slice(0, limit);
  }

  public listWitnessObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('WITNESS'))
      .slice(0, limit);
  }

  public listRescueObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('RESCUE'))
      .slice(0, limit);
  }

  public listTestObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('TEST'))
      .slice(0, limit);
  }

  public listNegotiateObjectiveCounterparts(playerId: string, limit = 16): readonly RelationshipLedgerIndexEntry[] {
    return this.listCounterpartIndices(playerId)
      .filter((item) => item.tags.includes('NEGOTIATE'))
      .slice(0, limit);
  }

  public getGlobalFocusedCounterpart(playerId: string): string | undefined {
    return this.listChannelSummaries(playerId).find((item) => item.channelId === 'GLOBAL')?.focusedCounterpartId;
  }

  public getSyndicateFocusedCounterpart(playerId: string): string | undefined {
    return this.listChannelSummaries(playerId).find((item) => item.channelId === 'SYNDICATE')?.focusedCounterpartId;
  }

  public getDealRoomFocusedCounterpart(playerId: string): string | undefined {
    return this.listChannelSummaries(playerId).find((item) => item.channelId === 'DEAL_ROOM')?.focusedCounterpartId;
  }

  public getDirectFocusedCounterpart(playerId: string): string | undefined {
    return this.listChannelSummaries(playerId).find((item) => item.channelId === 'DIRECT')?.focusedCounterpartId;
  }

  public getSpectatorFocusedCounterpart(playerId: string): string | undefined {
    return this.listChannelSummaries(playerId).find((item) => item.channelId === 'SPECTATOR')?.focusedCounterpartId;
  }

  public listTrustworthyHelpers(playerId: string, limit = 8): readonly RelationshipLedgerHotCounterpart[] {
    return this.listHotCounterparts(playerId, 48)
      .filter((item) => item.trust01 >= this.config.trustThreshold01 && item.rescueDebt01 >= this.config.rescueDebtThreshold01)
      .slice(0, limit);
  }

  public listEscalationRivals(playerId: string, limit = 8): readonly RelationshipLedgerHotCounterpart[] {
    return this.listHotCounterparts(playerId, 48)
      .filter((item) => item.rivalry01 >= this.config.rivalryThreshold01)
      .slice(0, limit);
  }

  public listCallbackReadyCounterparts(playerId: string, limit = 8): readonly RelationshipLedgerHotCounterpart[] {
    return this.listHotCounterparts(playerId, 48)
      .filter((item) => item.callbackReadiness01 >= this.config.callbackThreshold01)
      .slice(0, limit);
  }

  public getFocusedCounterpartByChannel(playerId: string, channelId: string): string | undefined {
    return this.getSnapshot(playerId).focusedCounterpartByChannel[channelId];
  }

  public hasCounterpart(playerId: string, counterpartId: string): boolean {
    return this.listCounterpartIndices(playerId).some((item) => item.counterpartId === counterpartId);
  }

  public hasScene(playerId: string, sceneId: string): boolean {
    return this.ensure(playerId).scenes.has(sceneId);
  }

  public hasChannel(playerId: string, channelId: string): boolean {
    return this.ensure(playerId).channels.has(channelId);
  }

  public totalEventsForCounterpart(playerId: string, counterpartId: string): number {
    return this.listCounterpartIndices(playerId).find((item) => item.counterpartId === counterpartId)?.eventCount ?? 0;
  }

  public totalCallbacksForCounterpart(playerId: string, counterpartId: string): number {
    return (this.ensure(playerId).callbacksByCounterpartId.get(counterpartId) ?? []).length;
  }

  public latestEventForCounterpart(playerId: string, counterpartId: string): ChatRelationshipEventDescriptor | undefined {
    return this.listRecentEvents({ playerId, counterpartIds: [counterpartId], maxResults: 1 })[0];
  }

  public latestEventForChannel(playerId: string, channelId: string): ChatRelationshipEventDescriptor | undefined {
    return this.listRecentEvents({ playerId, channelId, maxResults: 1 })[0];
  }

  public latestSceneEvent(playerId: string, sceneId: string): ChatRelationshipEventDescriptor | undefined {
    return this.listRecentEvents({ playerId, sceneId, maxResults: 1 })[0];
  }

  public counterpartTags(playerId: string, counterpartId: string): readonly string[] {
    return this.listCounterpartIndices(playerId).find((item) => item.counterpartId === counterpartId)?.tags ?? [];
  }

  public counterpartAxes(playerId: string, counterpartId: string): readonly ChatRelationshipAxisId[] {
    return this.listCounterpartIndices(playerId).find((item) => item.counterpartId === counterpartId)?.dominantAxes ?? [];
  }

  public exportStats(playerId: string): RelationshipLedgerStats & { exportsStored: number } {
    const stats = this.stats();
    return {
      ...stats,
      exportsStored: this.listExports(playerId).length,
    };
  }



  // ==========================================================================
  // MARK: Relationship trajectory tracking
  // ==========================================================================

  private readonly _trajectories = new Map<string, RelationshipTrajectorySnapshot[]>();

  /** Record a periodic trajectory snapshot for a counterpart relationship. */
  public recordTrajectorySnapshot(playerId: string, counterpartId: string, state: ChatRelationshipCounterpartState, at: number): void {
    const key = `${playerId}:${counterpartId}`;
    const entries = this._trajectories.get(key) ?? [];
    entries.push({
      timestamp: at,
      trust01: state.vector?.trust01 ?? 0,
      rivalry01: state.vector?.rivalry01 ?? 0,
      intensity01: state.intensity01,
      volatility01: state.volatility01,
      obsession01: state.vector?.obsession01 ?? 0,
      stance: state.stance,
    });
    if (entries.length > 128) entries.splice(0, entries.length - 128);
    this._trajectories.set(key, entries);
  }

  /** Get the trajectory history for a counterpart. */
  public getTrajectory(playerId: string, counterpartId: string): readonly RelationshipTrajectorySnapshot[] {
    return Object.freeze(this._trajectories.get(`${playerId}:${counterpartId}`) ?? []);
  }

  /** Compute trend direction of a relationship trajectory. */
  public computeTrajectoryTrend(playerId: string, counterpartId: string): RelationshipTrajectoryTrend {
    const entries = this.getTrajectory(playerId, counterpartId);
    if (entries.length < 4) return 'INSUFFICIENT_DATA';
    const recent = entries.slice(-8);
    const intensityDeltas = recent.slice(1).map((e, i) => e.intensity01 - recent[i]!.intensity01);
    const avg = intensityDeltas.reduce((s, d) => s + d, 0) / intensityDeltas.length;
    const vol = Math.sqrt(intensityDeltas.reduce((s, d) => s + (d - avg) ** 2, 0) / intensityDeltas.length);
    if (vol > 0.15) return 'OSCILLATING';
    if (avg > 0.04) return 'RISING';
    if (avg < -0.04) return 'FALLING';
    if (recent[recent.length - 1]!.intensity01 >= 0.9) return 'ERUPTING';
    return 'PLATEAUED';
  }

  // ==========================================================================
  // MARK: Counterpart cluster detection
  // ==========================================================================

  /** Detect social clusters — groups of counterparts that interact with the player together. */
  public detectCounterpartClusters(playerId: string): readonly CounterpartCluster[] {
    const bucket = this.ensure(playerId);
    const indices = this.listCounterpartIndices(playerId);
    const clusters: CounterpartCluster[] = [];
    const coOccurrence = new Map<string, Map<string, number>>();

    for (const idx of indices) {
      if (!coOccurrence.has(idx.counterpartId)) coOccurrence.set(idx.counterpartId, new Map());
    }

    const events = this.listRecentEvents({ playerId, maxResults: 256 });
    for (let i = 0; i < events.length; i++) {
      const a = events[i]!;
      for (let j = i + 1; j < Math.min(i + 8, events.length); j++) {
        const b = events[j]!;
        if (!a.counterpartId || !b.counterpartId || a.counterpartId === b.counterpartId) continue;
        if (Math.abs(a.timestamp - b.timestamp) > 60000) continue;
        const mapA = coOccurrence.get(a.counterpartId);
        if (mapA) mapA.set(b.counterpartId, (mapA.get(b.counterpartId) ?? 0) + 1);
        const mapB = coOccurrence.get(b.counterpartId);
        if (mapB) mapB.set(a.counterpartId, (mapB.get(a.counterpartId) ?? 0) + 1);
      }
    }

    const assigned = new Set<string>();
    for (const [cpId, neighbors] of coOccurrence) {
      if (assigned.has(cpId)) continue;
      const strong = [...neighbors.entries()].filter(([_, count]) => count >= 3).map(([nId]) => nId).filter((nId) => !assigned.has(nId));
      if (strong.length >= 1) {
        const members = [cpId, ...strong];
        for (const m of members) assigned.add(m);
        const isRivalPack = members.every((m) => {
          const idx = indices.find((i) => i.counterpartId === m);
          return idx && idx.rivalry01 >= 0.4;
        });
        clusters.push({
          clusterId: `cluster:${playerId}:${members.join(':')}`,
          memberIds: Object.freeze(members),
          coOccurrenceStrength: strong.length >= 3 ? 'STRONG' : strong.length >= 2 ? 'MODERATE' : 'WEAK',
          clusterRole: isRivalPack ? 'PACK' : 'ENTOURAGE',
          memberCount: members.length,
        });
      }
    }
    return Object.freeze(clusters);
  }

  // ==========================================================================
  // MARK: Relationship decay and dormancy
  // ==========================================================================

  /** Compute decay for a relationship entry based on elapsed time since last interaction. */
  public computeRelationshipDecay(entry: RelationshipLedgerIndexEntry, elapsedMs: number): number {
    const baseHalfLife = entry.rivalry01 >= 0.5 ? 1000 * 60 * 60 * 96 : entry.trust01 >= 0.5 ? 1000 * 60 * 60 * 72 : 1000 * 60 * 60 * 24;
    return Math.max(0.02, entry.intensity01 * Math.pow(2, -(elapsedMs / baseHalfLife)));
  }

  /** Check if a relationship should be marked dormant. */
  public shouldMarkDormant(entry: RelationshipLedgerIndexEntry, now: number): boolean {
    const elapsed = now - entry.lastTouchedAt;
    return elapsed > this.config.retention.pruneIfIdleMs && entry.intensity01 < 0.2;
  }

  // ==========================================================================
  // MARK: Ledger compaction
  // ==========================================================================

  /** Compact the ledger by summarizing least-relevant counterpart entries. */
  public compactLedger(playerId: string, retainTop = 32): readonly CompactedRelationshipSummary[] {
    const indices = this.listCounterpartIndices(playerId);
    if (indices.length <= retainTop) return [];
    const sorted = [...indices].sort((a, b) => b.intensity01 - a.intensity01);
    const toCompact = sorted.slice(retainTop);
    return Object.freeze(toCompact.map((idx) => ({
      counterpartId: idx.counterpartId,
      counterpartKind: idx.counterpartKind,
      peakIntensity01: idx.intensity01,
      lastTouchedAt: idx.lastTouchedAt,
      eventCount: idx.eventCount,
      stance: idx.stance,
      compactedAt: Date.now(),
    })));
  }




  // ==========================================================================
  // MARK: Cross-player relationship graph
  // ==========================================================================

  /** Compare how two players relate to the same counterpart. */
  public projectCrossPlayerRelationship(playerA: string, playerB: string, counterpartId: string): CrossPlayerRelationshipView | undefined {
    const stateA = this.getCounterpartState(playerA, counterpartId);
    const stateB = this.getCounterpartState(playerB, counterpartId);
    if (!stateA || !stateB) return undefined;
    const trustDelta = Math.abs((stateA.vector?.trust01 ?? 0) - (stateB.vector?.trust01 ?? 0));
    const rivalryDelta = Math.abs((stateA.vector?.rivalry01 ?? 0) - (stateB.vector?.rivalry01 ?? 0));
    const intensityDelta = Math.abs(stateA.intensity01 - stateB.intensity01);
    return Object.freeze({
      counterpartId,
      playerAId: playerA, playerBId: playerB,
      stanceA: stateA.stance, stanceB: stateB.stance,
      trustDelta01: trustDelta, rivalryDelta01: rivalryDelta, intensityDelta01: intensityDelta,
      asymmetryScore01: (trustDelta + rivalryDelta + intensityDelta) / 3,
      shareRival: (stateA.vector?.rivalry01 ?? 0) >= 0.4 && (stateB.vector?.rivalry01 ?? 0) >= 0.4,
      shareHelper: (stateA.vector?.trust01 ?? 0) >= 0.4 && (stateB.vector?.trust01 ?? 0) >= 0.4,
    });
  }

  // ==========================================================================
  // MARK: Event pattern recognition
  // ==========================================================================

  /** Detect repeating event patterns for a player-counterpart pair. */
  public detectEventPatterns(playerId: string, counterpartId: string): readonly EventPattern[] {
    const events = this.listRecentEvents({ playerId, counterpartIds: [counterpartId], maxResults: 128 });
    const patterns: EventPattern[] = [];
    const typePairs = new Map<string, number>();
    for (let i = 0; i < events.length - 1; i++) {
      const pair = `${events[i]!.eventType}:${events[i + 1]!.eventType}`;
      typePairs.set(pair, (typePairs.get(pair) ?? 0) + 1);
    }
    for (const [pair, count] of typePairs) {
      if (count >= 3) {
        const [trigger, response] = pair.split(':');
        patterns.push({
          patternId: `pattern:${playerId}:${counterpartId}:${pair}`,
          triggerEventType: trigger!, responseEventType: response!,
          confidence01: Math.min(1, count / 8), recurrenceCount: count,
          description: `After ${trigger}, ${response} follows ${count} times`,
        });
      }
    }
    return Object.freeze(patterns);
  }

  // ==========================================================================
  // MARK: Ledger diagnostic
  // ==========================================================================

  /** Build a comprehensive diagnostic of the ledger state for a player. */
  public buildLedgerDiagnostic(playerId: string): readonly string[] {
    const indices = this.listCounterpartIndices(playerId);
    const hotCounterparts = this.listHotCounterparts(playerId);
    const channels = this.listChannelSummaries(playerId);
    const stats = this.stats();
    const lines: string[] = [];
    lines.push(`ledger_diagnostic|player=${playerId}`);
    lines.push(`counterparts=${indices.length}|hot=${hotCounterparts.length}|channels=${channels.length}`);
    lines.push(`total_players=${stats.playersTracked}|total_events=${stats.totalEventsStored}`);
    for (const hot of hotCounterparts.slice(0, 6)) {
      lines.push(`  hot=${hot.counterpartId}|intensity=${hot.intensity01.toFixed(3)}|stance=${hot.stance}`);
    }
    return lines;
  }


}
