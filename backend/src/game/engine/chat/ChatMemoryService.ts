/**
 * Durable episodic memory persistence and callback selection.
 */
import type {
  EpisodicMemoryCallbackCandidate,
  EpisodicMemoryCallbackRequest,
  EpisodicMemoryCallbackResponse,
  EpisodicMemoryQuery,
  EpisodicMemoryRecord,
  EpisodicMemorySnapshot,
} from '../../../../../shared/contracts/chat/memory';
import { buildCountsByEventType, clamp01 } from '../../../../../shared/contracts/chat/memory';

export interface ChatMemoryServiceConfig {
  readonly maxActivePerPlayer: number;
  readonly maxArchivedPerPlayer: number;
  readonly historyTail: number;
}

export const DEFAULT_CHAT_MEMORY_SERVICE_CONFIG: ChatMemoryServiceConfig = Object.freeze({
  maxActivePerPlayer: 512,
  maxArchivedPerPlayer: 2048,
  historyTail: 64,
});

interface PlayerMemoryBucket {
  active: Map<string, EpisodicMemoryRecord>;
  archived: Map<string, EpisodicMemoryRecord>;
  updatedAt: number;
}

function now(): number {
  return Date.now();
}

function scoreCandidate(record: EpisodicMemoryRecord, request: EpisodicMemoryCallbackRequest): EpisodicMemoryCallbackCandidate[] {
  const preferredTones = new Set(request.preferredTones ?? []);
  const results: EpisodicMemoryCallbackCandidate[] = [];
  for (const variant of record.callbackVariants) {
    const toneMatchBoost = preferredTones.size === 0 || preferredTones.has(variant.tone) ? 0.16 : -0.08;
    const unresolvedBoost = record.unresolved ? 0.12 : 0;
    const recencyPenalty = record.lastReferencedAt ? clamp01((request.createdAt - record.lastReferencedAt) / (14 * 24 * 60 * 60 * 1000)) * -0.08 : 0.05;
    const score01 = clamp01(
      record.salience01 * 0.32 +
      record.emotionalWeight01 * 0.18 +
      record.strategicWeight01 * 0.18 +
      variant.usageBias * 0.14 +
      toneMatchBoost +
      unresolvedBoost +
      recencyPenalty,
    );
    results.push({
      memoryId: record.memoryId,
      callbackId: variant.callbackId,
      eventType: record.eventType,
      salience01: record.salience01,
      unresolved: record.unresolved,
      text: variant.text,
      tone: variant.tone,
      score01,
      notes: Object.freeze([
        record.unresolved ? 'unresolved_memory' : 'resolved_memory',
        preferredTones.size === 0 || preferredTones.has(variant.tone) ? 'tone_match' : 'tone_mismatch',
      ]),
    });
  }
  return results;
}

export class ChatMemoryService {
  private readonly config: ChatMemoryServiceConfig;
  private readonly players = new Map<string, PlayerMemoryBucket>();

  public constructor(config: Partial<ChatMemoryServiceConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_CHAT_MEMORY_SERVICE_CONFIG, ...config });
  }

  private ensure(playerId: string): PlayerMemoryBucket {
    const current = this.players.get(playerId);
    if (current) return current;
    const bucket: PlayerMemoryBucket = { active: new Map(), archived: new Map(), updatedAt: now() };
    this.players.set(playerId, bucket);
    return bucket;
  }

  public upsert(record: EpisodicMemoryRecord): EpisodicMemoryRecord {
    const playerId = record.playerId ?? 'GLOBAL';
    const bucket = this.ensure(playerId);
    const target = record.status === 'ARCHIVED' || record.status === 'EXPIRED' ? bucket.archived : bucket.active;
    target.set(record.memoryId, record);
    bucket.updatedAt = now();
    this.trimBucket(bucket);
    return record;
  }

  public ingest(records: readonly EpisodicMemoryRecord[]): readonly EpisodicMemoryRecord[] {
    return records.map((record) => this.upsert(record));
  }

  public markReferenced(playerId: string, memoryId: string, at: number = now()): EpisodicMemoryRecord | undefined {
    const bucket = this.ensure(playerId);
    const current = bucket.active.get(memoryId) ?? bucket.archived.get(memoryId);
    if (!current) return undefined;
    const next: EpisodicMemoryRecord = {
      ...current,
      lastReferencedAt: at,
      timesReused: current.timesReused + 1,
    };
    this.upsert(next);
    return next;
  }

  public resolve(playerId: string, memoryId: string): EpisodicMemoryRecord | undefined {
    const bucket = this.ensure(playerId);
    const current = bucket.active.get(memoryId);
    if (!current) return undefined;
    const next: EpisodicMemoryRecord = {
      ...current,
      unresolved: false,
      status: 'DORMANT',
      lastStrengthenedAt: now(),
    };
    this.upsert(next);
    return next;
  }

  public archive(playerId: string, memoryId: string): EpisodicMemoryRecord | undefined {
    const bucket = this.ensure(playerId);
    const current = bucket.active.get(memoryId) ?? bucket.archived.get(memoryId);
    if (!current) return undefined;
    bucket.active.delete(memoryId);
    const next: EpisodicMemoryRecord = { ...current, status: 'ARCHIVED' };
    bucket.archived.set(memoryId, next);
    this.trimBucket(bucket);
    return next;
  }

  public query(query: EpisodicMemoryQuery): readonly EpisodicMemoryRecord[] {
    const bucket = this.ensure(query.playerId ?? 'GLOBAL');
    const pool = [
      ...(query.activeOnly ? bucket.active.values() : bucket.active.values()),
      ...(query.activeOnly ? [] : bucket.archived.values()),
    ];
    return [...pool]
      .filter((record) => !query.botId || record.botId === query.botId)
      .filter((record) => !query.counterpartId || record.counterpartId === query.counterpartId)
      .filter((record) => !query.roomId || record.triggerContext.roomId === query.roomId)
      .filter((record) => !query.channelId || record.triggerContext.channelId === query.channelId)
      .filter((record) => !query.eventTypes?.length || query.eventTypes.includes(record.eventType))
      .filter((record) => !query.unresolvedOnly || record.unresolved)
      .filter((record) => query.minSalience01 == null || record.salience01 >= query.minSalience01)
      .sort((a, b) => (b.lastReferencedAt ?? b.createdAt) - (a.lastReferencedAt ?? a.createdAt))
      .slice(0, query.limit ?? this.config.historyTail);
  }

  public selectCallbacks(request: EpisodicMemoryCallbackRequest): EpisodicMemoryCallbackResponse {
    const pool = this.query({
      playerId: request.playerId,
      botId: request.botId,
      counterpartId: request.counterpartId,
      roomId: request.roomId,
      channelId: request.channelId,
      activeOnly: true,
      unresolvedOnly: false,
      limit: this.config.historyTail,
    });

    const candidates = pool
      .flatMap((record) => scoreCandidate(record, request))
      .sort((a, b) => b.score01 - a.score01 || a.callbackId.localeCompare(b.callbackId))
      .slice(0, request.maxResults ?? 8);

    return {
      requestId: request.requestId,
      createdAt: request.createdAt,
      candidates,
    };
  }

  public getSnapshot(playerId: string): EpisodicMemorySnapshot {
    const bucket = this.ensure(playerId);
    const activeMemories = [...bucket.active.values()].sort((a, b) => b.createdAt - a.createdAt);
    const archivedMemories = [...bucket.archived.values()].sort((a, b) => b.createdAt - a.createdAt);
    return {
      createdAt: activeMemories.at(-1)?.createdAt ?? now(),
      updatedAt: bucket.updatedAt,
      playerId,
      activeMemories,
      archivedMemories,
      unresolvedMemoryIds: activeMemories.filter((record) => record.unresolved).map((record) => record.memoryId),
      lastCarryoverSummary: activeMemories.filter((record) => record.unresolved).slice(0, 3).map((record) => record.triggerContext.summary).join(' | ') || undefined,
      countsByEventType: buildCountsByEventType([...activeMemories, ...archivedMemories]),
    };
  }

  public restore(snapshot: EpisodicMemorySnapshot): void {
    const bucket = this.ensure(snapshot.playerId ?? 'GLOBAL');
    bucket.active.clear();
    bucket.archived.clear();
    for (const record of snapshot.activeMemories) bucket.active.set(record.memoryId, record);
    for (const record of snapshot.archivedMemories) bucket.archived.set(record.memoryId, record);
    bucket.updatedAt = snapshot.updatedAt;
    this.trimBucket(bucket);
  }

  private trimBucket(bucket: PlayerMemoryBucket): void {
    const trim = (map: Map<string, EpisodicMemoryRecord>, max: number) => {
      const sorted = [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
      map.clear();
      for (const record of sorted.slice(0, max)) map.set(record.memoryId, record);
    };
    trim(bucket.active, this.config.maxActivePerPlayer);
    trim(bucket.archived, this.config.maxArchivedPerPlayer);
  }

  /** Bulk resolve multiple memories at once. */
  public resolveMany(playerId: string, memoryIds: readonly string[]): readonly EpisodicMemoryRecord[] {
    return memoryIds
      .map((id) => this.resolve(playerId, id))
      .filter((r): r is EpisodicMemoryRecord => r != null);
  }

  /** Bulk archive multiple memories at once. */
  public archiveMany(playerId: string, memoryIds: readonly string[]): readonly EpisodicMemoryRecord[] {
    return memoryIds
      .map((id) => this.archive(playerId, id))
      .filter((r): r is EpisodicMemoryRecord => r != null);
  }

  /** Return all player IDs tracked. */
  public getPlayerIds(): readonly string[] {
    return Object.freeze([...this.players.keys()]);
  }

  /** Return total active memory count for a player. */
  public activeCount(playerId: string): number {
    return this.ensure(playerId).active.size;
  }

  /** Return total archived memory count for a player. */
  public archivedCount(playerId: string): number {
    return this.ensure(playerId).archived.size;
  }

  /** Get a single memory record by ID. */
  public get(playerId: string, memoryId: string): EpisodicMemoryRecord | undefined {
    const bucket = this.ensure(playerId);
    return bucket.active.get(memoryId) ?? bucket.archived.get(memoryId);
  }

  /** Remove a memory record entirely. */
  public remove(playerId: string, memoryId: string): boolean {
    const bucket = this.ensure(playerId);
    return bucket.active.delete(memoryId) || bucket.archived.delete(memoryId);
  }

  /** Clear all memories for a player. */
  public clearPlayer(playerId: string): void {
    const bucket = this.ensure(playerId);
    bucket.active.clear();
    bucket.archived.clear();
    bucket.updatedAt = now();
  }

  /** Apply salience decay to all active memories — older un-referenced memories fade. */
  public applyDecay(playerId: string, decayRate: number = 0.04): readonly EpisodicMemoryRecord[] {
    const bucket = this.ensure(playerId);
    const updated: EpisodicMemoryRecord[] = [];
    const nowMs = now();
    for (const [id, record] of bucket.active) {
      const ageMs = nowMs - (record.lastReferencedAt ?? record.createdAt);
      const ageFactor = Math.min(1, ageMs / (7 * 24 * 60 * 60 * 1000));
      const decayedSalience = clamp01(record.salience01 * (1 - decayRate * ageFactor));
      const status: EpisodicMemoryStatus =
        decayedSalience < 0.15 ? 'DORMANT' : record.status;
      const next: EpisodicMemoryRecord = { ...record, salience01: decayedSalience, status };
      bucket.active.set(id, next);
      updated.push(next);
    }
    bucket.updatedAt = nowMs;
    return Object.freeze(updated);
  }

  /** Reinforce a memory's salience (used when player demonstrates memory in play). */
  public strengthen(playerId: string, memoryId: string, boost01: number = 0.12): EpisodicMemoryRecord | undefined {
    const bucket = this.ensure(playerId);
    const current = bucket.active.get(memoryId);
    if (!current) return undefined;
    const next: EpisodicMemoryRecord = {
      ...current,
      salience01: clamp01(current.salience01 + boost01),
      lastStrengthenedAt: now(),
      timesReused: current.timesReused + 1,
      status: 'ACTIVE',
    };
    bucket.active.set(memoryId, next);
    return next;
  }

  /** Expire memories that have passed their expiresAt threshold. */
  public expireStale(playerId: string): readonly string[] {
    const bucket = this.ensure(playerId);
    const expiredIds: string[] = [];
    const nowMs = now();
    for (const [id, record] of bucket.active) {
      if (record.expiresAt != null && record.expiresAt < nowMs) {
        const expired: EpisodicMemoryRecord = { ...record, status: 'EXPIRED' };
        bucket.active.delete(id);
        bucket.archived.set(id, expired);
        expiredIds.push(id);
      }
    }
    return Object.freeze(expiredIds);
  }

  /** Find all memories referencing a specific counterpart. */
  public findByCounterpart(playerId: string, counterpartId: string): readonly EpisodicMemoryRecord[] {
    const bucket = this.ensure(playerId);
    const all = [...bucket.active.values(), ...bucket.archived.values()];
    return Object.freeze(all.filter((r) => r.counterpartId === counterpartId));
  }

  /** Find all memories matching one or more event types. */
  public findByEventTypes(
    playerId: string,
    eventTypes: readonly EpisodicMemoryEventType[],
    activeOnly = true,
  ): readonly EpisodicMemoryRecord[] {
    const bucket = this.ensure(playerId);
    const set = new Set(eventTypes);
    const pool = activeOnly
      ? [...bucket.active.values()]
      : [...bucket.active.values(), ...bucket.archived.values()];
    return Object.freeze(pool.filter((r) => set.has(r.eventType)));
  }

  /** Find all unresolved memories sorted by salience. */
  public getUnresolved(playerId: string): readonly EpisodicMemoryRecord[] {
    const bucket = this.ensure(playerId);
    return Object.freeze(
      [...bucket.active.values()]
        .filter((r) => r.unresolved)
        .sort((a, b) => b.salience01 - a.salience01),
    );
  }

  /** Compute high-salience unresolved memories for carryover. */
  public getCarryoverCandidates(
    playerId: string,
    minSalience01: number = 0.55,
    limit: number = 8,
  ): readonly EpisodicMemoryRecord[] {
    return this.getUnresolved(playerId)
      .filter((r) => r.salience01 >= minSalience01)
      .slice(0, limit);
  }

  /** Export all data for a player. */
  public exportPlayer(playerId: string): MemoryPlayerExport {
    const bucket = this.ensure(playerId);
    return Object.freeze({
      playerId,
      exportedAt: now(),
      active: Object.freeze([...bucket.active.values()]),
      archived: Object.freeze([...bucket.archived.values()]),
    });
  }

  /** Restore from an export. */
  public importPlayer(exported: MemoryPlayerExport): void {
    const bucket = this.ensure(exported.playerId);
    for (const r of exported.active) bucket.active.set(r.memoryId, r);
    for (const r of exported.archived) bucket.archived.set(r.memoryId, r);
    bucket.updatedAt = exported.exportedAt;
  }

  /** Build full analytics for a player. */
  public buildAnalytics(playerId: string): MemoryAnalytics {
    return buildMemoryAnalytics(playerId, this.ensure(playerId));
  }

  /** Build heatmap of event types across all active memories. */
  public buildEventTypeHeatMap(playerId: string): MemoryEventTypeHeatMap {
    const bucket = this.ensure(playerId);
    return buildEventTypeHeatMap([...bucket.active.values()]);
  }

  /** Cross-player: find players who have memories of the same counterpart. */
  public findPlayersWithCounterpart(counterpartId: string): readonly string[] {
    const result: string[] = [];
    for (const [pid, bucket] of this.players) {
      const all = [...bucket.active.values(), ...bucket.archived.values()];
      if (all.some((r) => r.counterpartId === counterpartId)) result.push(pid);
    }
    return Object.freeze(result);
  }

  /** Cross-player: build global event type frequency across all players. */
  public buildGlobalEventTypeFrequency(): Readonly<Partial<Record<EpisodicMemoryEventType, number>>> {
    const counts: Partial<Record<EpisodicMemoryEventType, number>> = {};
    for (const bucket of this.players.values()) {
      for (const r of bucket.active.values()) {
        counts[r.eventType] = (counts[r.eventType] ?? 0) + 1;
      }
    }
    return Object.freeze(counts);
  }
}

// ============================================================================
// TYPES
// ============================================================================

type EpisodicMemoryStatus = EpisodicMemoryRecord['status'];
type EpisodicMemoryEventType = EpisodicMemoryRecord['eventType'];

export interface MemoryPlayerExport {
  readonly playerId: string;
  readonly exportedAt: number;
  readonly active: readonly EpisodicMemoryRecord[];
  readonly archived: readonly EpisodicMemoryRecord[];
}

export interface MemoryEventTypeHeatMapEntry {
  readonly eventType: EpisodicMemoryEventType;
  readonly count: number;
  readonly avgSalience01: number;
  readonly unresolvedCount: number;
  readonly heat: 'COLD' | 'WARM' | 'HOT' | 'BLAZING';
}

export type MemoryEventTypeHeatMap = readonly MemoryEventTypeHeatMapEntry[];

export interface MemoryAnalytics {
  readonly playerId: string;
  readonly generatedAt: number;
  readonly activeCount: number;
  readonly archivedCount: number;
  readonly unresolvedCount: number;
  readonly averageSalience01: number;
  readonly averageEmotionalWeight01: number;
  readonly averageStrategicWeight01: number;
  readonly topEventTypes: readonly { eventType: EpisodicMemoryEventType; count: number }[];
  readonly topCounterparts: readonly { counterpartId: string; count: number }[];
  readonly callbackReadinessScore01: number;
  readonly memoryHealthLabel: 'SPARSE' | 'ACTIVE' | 'DENSE' | 'SATURATED';
}

// ============================================================================
// ANALYTICS FUNCTIONS
// ============================================================================

function buildMemoryAnalytics(playerId: string, bucket: PlayerMemoryBucket): MemoryAnalytics {
  const active = [...bucket.active.values()];
  const archived = [...bucket.archived.values()];
  const all = [...active, ...archived];
  const unresolved = active.filter((r) => r.unresolved);

  const averageSalience01 = active.length > 0
    ? active.reduce((s, r) => s + r.salience01, 0) / active.length
    : 0;
  const averageEmotionalWeight01 = active.length > 0
    ? active.reduce((s, r) => s + r.emotionalWeight01, 0) / active.length
    : 0;
  const averageStrategicWeight01 = active.length > 0
    ? active.reduce((s, r) => s + r.strategicWeight01, 0) / active.length
    : 0;

  const eventTypeCounts = new Map<EpisodicMemoryEventType, number>();
  for (const r of all) {
    eventTypeCounts.set(r.eventType, (eventTypeCounts.get(r.eventType) ?? 0) + 1);
  }
  const topEventTypes = [...eventTypeCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([eventType, count]) => ({ eventType, count }));

  const counterpartCounts = new Map<string, number>();
  for (const r of all) {
    if (r.counterpartId) {
      counterpartCounts.set(r.counterpartId, (counterpartCounts.get(r.counterpartId) ?? 0) + 1);
    }
  }
  const topCounterparts = [...counterpartCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([counterpartId, count]) => ({ counterpartId, count }));

  const callbackReadyMemories = active.filter(
    (r) => r.callbackVariants.length > 0 && r.salience01 >= 0.45,
  );
  const callbackReadinessScore01 = clamp01(callbackReadyMemories.length / Math.max(active.length, 1));

  const memoryHealthLabel: MemoryAnalytics['memoryHealthLabel'] =
    active.length === 0 ? 'SPARSE' :
    active.length >= 400 ? 'SATURATED' :
    active.length >= 150 ? 'DENSE' : 'ACTIVE';

  return Object.freeze({
    playerId,
    generatedAt: now(),
    activeCount: active.length,
    archivedCount: archived.length,
    unresolvedCount: unresolved.length,
    averageSalience01,
    averageEmotionalWeight01,
    averageStrategicWeight01,
    topEventTypes: Object.freeze(topEventTypes),
    topCounterparts: Object.freeze(topCounterparts),
    callbackReadinessScore01,
    memoryHealthLabel,
  });
}

function buildEventTypeHeatMap(records: readonly EpisodicMemoryRecord[]): MemoryEventTypeHeatMap {
  const groups = new Map<EpisodicMemoryEventType, EpisodicMemoryRecord[]>();
  for (const r of records) {
    if (!groups.has(r.eventType)) groups.set(r.eventType, []);
    groups.get(r.eventType)!.push(r);
  }
  const entries: MemoryEventTypeHeatMapEntry[] = [];
  for (const [eventType, group] of groups) {
    const count = group.length;
    const avgSalience01 = group.reduce((s, r) => s + r.salience01, 0) / count;
    const unresolvedCount = group.filter((r) => r.unresolved).length;
    const heat: MemoryEventTypeHeatMapEntry['heat'] =
      count >= 20 ? 'BLAZING' :
      count >= 10 ? 'HOT' :
      count >= 4 ? 'WARM' : 'COLD';
    entries.push(Object.freeze({ eventType, count, avgSalience01, unresolvedCount, heat }));
  }
  return Object.freeze(entries.sort((a, b) => b.count - a.count));
}

// ============================================================================
// MEMORY CLUSTERING — Group memories by shared contextual signals
// ============================================================================

export interface MemoryCluster {
  readonly clusterId: string;
  readonly eventType: EpisodicMemoryEventType;
  readonly memberIds: readonly string[];
  readonly avgSalience01: number;
  readonly latestAt: number;
  readonly hasUnresolved: boolean;
}

export function clusterMemoriesByEventType(
  records: readonly EpisodicMemoryRecord[],
): readonly MemoryCluster[] {
  const groups = new Map<EpisodicMemoryEventType, EpisodicMemoryRecord[]>();
  for (const r of records) {
    if (!groups.has(r.eventType)) groups.set(r.eventType, []);
    groups.get(r.eventType)!.push(r);
  }
  const clusters: MemoryCluster[] = [];
  for (const [eventType, group] of groups) {
    clusters.push(Object.freeze({
      clusterId: `cluster:${eventType}`,
      eventType,
      memberIds: Object.freeze(group.map((r) => r.memoryId)),
      avgSalience01: group.reduce((s, r) => s + r.salience01, 0) / group.length,
      latestAt: Math.max(...group.map((r) => r.createdAt)),
      hasUnresolved: group.some((r) => r.unresolved),
    }));
  }
  return Object.freeze(clusters.sort((a, b) => b.avgSalience01 - a.avgSalience01));
}

// ============================================================================
// MEMORY PRESSURE SCORING — Compute urgency of callback for a player
// ============================================================================

export interface MemoryCallbackPressureReport {
  readonly playerId: string;
  readonly pressureScore01: number;
  readonly unresolvedCount: number;
  readonly highSalienceUnresolvedCount: number;
  readonly oldestUnresolvedAgeMs: number;
  readonly pressureLabel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export function computeCallbackPressure(
  playerId: string,
  records: readonly EpisodicMemoryRecord[],
  nowMs: number = Date.now(),
): MemoryCallbackPressureReport {
  const playerRecords = records.filter((r) => r.playerId === playerId);
  const unresolved = playerRecords.filter((r) => r.unresolved);
  if (unresolved.length === 0) {
    return Object.freeze({
      playerId,
      pressureScore01: 0,
      unresolvedCount: 0,
      highSalienceUnresolvedCount: 0,
      oldestUnresolvedAgeMs: 0,
      pressureLabel: 'NONE',
    });
  }

  const highSalience = unresolved.filter((r) => r.salience01 >= 0.65);
  const oldestAge = Math.max(...unresolved.map((r) => nowMs - r.createdAt));
  const salienceScore = unresolved.reduce((s, r) => s + r.salience01, 0) / unresolved.length;
  const countScore = clamp01(unresolved.length / 20);
  const ageFactor = clamp01(oldestAge / (14 * 24 * 60 * 60 * 1000));
  const pressureScore01 = clamp01(salienceScore * 0.45 + countScore * 0.30 + ageFactor * 0.25);

  const pressureLabel: MemoryCallbackPressureReport['pressureLabel'] =
    pressureScore01 >= 0.80 ? 'CRITICAL' :
    pressureScore01 >= 0.60 ? 'HIGH' :
    pressureScore01 >= 0.35 ? 'MEDIUM' : 'LOW';

  return Object.freeze({
    playerId,
    pressureScore01,
    unresolvedCount: unresolved.length,
    highSalienceUnresolvedCount: highSalience.length,
    oldestUnresolvedAgeMs: oldestAge,
    pressureLabel,
  });
}

// ============================================================================
// MEMORY BRIDGE — Connect memory system with continuity and experience engines
// ============================================================================

export interface MemoryContinuityBridgeEntry {
  readonly memoryId: string;
  readonly playerId: string;
  readonly eventType: EpisodicMemoryEventType;
  readonly salience01: number;
  readonly emotionalWeight01: number;
  readonly strategicWeight01: number;
  readonly unresolved: boolean;
  readonly callbackCount: number;
  readonly ageMs: number;
  readonly pressureScore01: number;
}

export function buildMemoryContinuityBridgeEntries(
  records: readonly EpisodicMemoryRecord[],
  minSalience01: number = 0.4,
  nowMs: number = Date.now(),
): readonly MemoryContinuityBridgeEntry[] {
  const result: MemoryContinuityBridgeEntry[] = [];
  for (const r of records) {
    if (!r.playerId) continue;
    if (r.salience01 < minSalience01 && !r.unresolved) continue;
    const ageMs = nowMs - r.createdAt;
    const ageFactor = Math.max(0, 1 - ageMs / (48 * 60 * 60 * 1000));
    const pressureScore01 = clamp01(
      r.salience01 * 0.40 +
      r.emotionalWeight01 * 0.25 +
      r.strategicWeight01 * 0.20 +
      (r.unresolved ? 0.15 : 0) * ageFactor,
    );
    result.push(Object.freeze({
      memoryId: r.memoryId,
      playerId: r.playerId,
      eventType: r.eventType,
      salience01: r.salience01,
      emotionalWeight01: r.emotionalWeight01,
      strategicWeight01: r.strategicWeight01,
      unresolved: r.unresolved,
      callbackCount: r.callbackVariants.length,
      ageMs,
      pressureScore01,
    }));
  }
  return Object.freeze(result.sort((a, b) => b.pressureScore01 - a.pressureScore01));
}

// ============================================================================
// MEMORY REPLAY — Ordered playback of memory events by room or counterpart
// ============================================================================

export class MemoryReplayIterator {
  private cursor: number = 0;
  private readonly sorted: readonly EpisodicMemoryRecord[];

  constructor(records: readonly EpisodicMemoryRecord[], sortOrder: 'NEWEST_FIRST' | 'OLDEST_FIRST' = 'NEWEST_FIRST') {
    this.sorted = [...records].sort((a, b) =>
      sortOrder === 'NEWEST_FIRST'
        ? b.createdAt - a.createdAt
        : a.createdAt - b.createdAt,
    );
  }

  hasNext(): boolean { return this.cursor < this.sorted.length; }
  hasPrev(): boolean { return this.cursor > 0; }

  next(): EpisodicMemoryRecord | null {
    return this.sorted[this.cursor++] ?? null;
  }

  prev(): EpisodicMemoryRecord | null {
    if (this.cursor <= 0) return null;
    return this.sorted[--this.cursor] ?? null;
  }

  peek(): EpisodicMemoryRecord | null {
    return this.sorted[this.cursor] ?? null;
  }

  seekTo(index: number): this {
    this.cursor = Math.max(0, Math.min(this.sorted.length, index));
    return this;
  }

  remaining(): number { return this.sorted.length - this.cursor; }
  totalCount(): number { return this.sorted.length; }

  collectRemaining(): readonly EpisodicMemoryRecord[] {
    const result = this.sorted.slice(this.cursor);
    this.cursor = this.sorted.length;
    return Object.freeze(result);
  }
}

// ============================================================================
// MEMORY SNAPSHOT DIFF
// ============================================================================

export interface MemorySnapshotDiff {
  readonly addedMemoryIds: readonly string[];
  readonly removedMemoryIds: readonly string[];
  readonly modifiedMemoryIds: readonly string[];
  readonly unresolvedDelta: number;
  readonly salienceDelta: number;
}

export function diffMemorySnapshots(
  before: EpisodicMemorySnapshot,
  after: EpisodicMemorySnapshot,
): MemorySnapshotDiff {
  const beforeIds = new Set(before.activeMemories.map((r) => r.memoryId));
  const afterIds = new Set(after.activeMemories.map((r) => r.memoryId));
  const beforeMap = new Map(before.activeMemories.map((r) => [r.memoryId, r]));
  const afterMap = new Map(after.activeMemories.map((r) => [r.memoryId, r]));

  const addedMemoryIds = [...afterIds].filter((id) => !beforeIds.has(id));
  const removedMemoryIds = [...beforeIds].filter((id) => !afterIds.has(id));
  const modifiedMemoryIds = [...afterIds].filter((id) => {
    const a = beforeMap.get(id);
    const b = afterMap.get(id);
    if (!a || !b) return false;
    return a.salience01 !== b.salience01 || a.unresolved !== b.unresolved || a.timesReused !== b.timesReused;
  });

  const unresolvedDelta = after.unresolvedMemoryIds.length - before.unresolvedMemoryIds.length;
  const beforeAvgSalience = before.activeMemories.length > 0
    ? before.activeMemories.reduce((s, r) => s + r.salience01, 0) / before.activeMemories.length
    : 0;
  const afterAvgSalience = after.activeMemories.length > 0
    ? after.activeMemories.reduce((s, r) => s + r.salience01, 0) / after.activeMemories.length
    : 0;

  return Object.freeze({
    addedMemoryIds: Object.freeze(addedMemoryIds),
    removedMemoryIds: Object.freeze(removedMemoryIds),
    modifiedMemoryIds: Object.freeze(modifiedMemoryIds),
    unresolvedDelta,
    salienceDelta: afterAvgSalience - beforeAvgSalience,
  });
}

// ============================================================================
// MEMORY SALIENCE PREDICTOR — Predict how salient a memory will be
// ============================================================================

export interface MemorySaliencePrediction {
  readonly estimatedSalience01: number;
  readonly emotionalFactor01: number;
  readonly strategicFactor01: number;
  readonly rarityFactor01: number;
  readonly label: 'NEGLIGIBLE' | 'MINOR' | 'NOTABLE' | 'SIGNIFICANT' | 'DEFINING';
}

export function predictMemorySalience(
  record: Pick<EpisodicMemoryRecord, 'eventType' | 'emotionalWeight01' | 'strategicWeight01' | 'embarrassmentRisk01'>,
  existingRecords: readonly EpisodicMemoryRecord[],
): MemorySaliencePrediction {
  const EVENT_BASE_SALIENCE: Partial<Record<EpisodicMemoryEventType, number>> = {
    HUMILIATION: 0.85,
    COMEBACK: 0.80,
    COLLAPSE: 0.78,
    BREACH: 0.75,
    RESCUE: 0.72,
    DEAL_ROOM_STANDOFF: 0.70,
    SOVEREIGNTY: 0.92,
    PERFECT_DEFENSE: 0.82,
    OVERCONFIDENCE: 0.65,
    BLUFF: 0.60,
    FAILED_GAMBLE: 0.68,
    GREED: 0.58,
    PUBLIC_WITNESS: 0.62,
    PRIVATE_CONFESSION: 0.55,
    DISCIPLINE: 0.65,
    HESITATION: 0.40,
  };

  const baseSalience = EVENT_BASE_SALIENCE[record.eventType as EpisodicMemoryEventType] ?? 0.45;
  const emotionalFactor01 = record.emotionalWeight01;
  const strategicFactor01 = record.strategicWeight01;

  // Rarity: how often has this event type appeared in existing records?
  const sameTypeCount = existingRecords.filter((r) => r.eventType === record.eventType).length;
  const rarityFactor01 = clamp01(1 - sameTypeCount / 20);

  const estimatedSalience01 = clamp01(
    baseSalience * 0.35 +
    emotionalFactor01 * 0.25 +
    strategicFactor01 * 0.20 +
    rarityFactor01 * 0.15 +
    record.embarrassmentRisk01 * 0.05,
  );

  const label: MemorySaliencePrediction['label'] =
    estimatedSalience01 >= 0.80 ? 'DEFINING' :
    estimatedSalience01 >= 0.62 ? 'SIGNIFICANT' :
    estimatedSalience01 >= 0.44 ? 'NOTABLE' :
    estimatedSalience01 >= 0.25 ? 'MINOR' : 'NEGLIGIBLE';

  return Object.freeze({
    estimatedSalience01,
    emotionalFactor01,
    strategicFactor01,
    rarityFactor01,
    label,
  });
}

// ============================================================================
// MODULE CONSTANTS
// ============================================================================

export const CHAT_MEMORY_MODULE_NAME = 'chat-memory' as const;
export const CHAT_MEMORY_MODULE_VERSION = '2026.03.23.v2' as const;

export const CHAT_MEMORY_LAWS = Object.freeze([
  'Memory salience is bounded to [0, 1] — never allow values outside this range.',
  'Decay moves salience toward zero — never below it.',
  'Unresolved memories are never auto-resolved — explicit resolution is required.',
  'Carryover candidates must exceed minSalience01 threshold.',
  'Callback scoring uses multi-factor weighted blend — no single factor dominates.',
  'Trim occurs on every upsert — memory buckets never exceed configured caps.',
  'Export/import is idempotent — duplicate import must not double-count records.',
  'Event type heat maps use active records only, not archived.',
]);

export const CHAT_MEMORY_DEFAULTS = Object.freeze({
  maxActivePerPlayer: DEFAULT_CHAT_MEMORY_SERVICE_CONFIG.maxActivePerPlayer,
  maxArchivedPerPlayer: DEFAULT_CHAT_MEMORY_SERVICE_CONFIG.maxArchivedPerPlayer,
  historyTail: DEFAULT_CHAT_MEMORY_SERVICE_CONFIG.historyTail,
  defaultDecayRate: 0.04,
  strengthenBoost01: 0.12,
  carryoverMinSalience01: 0.55,
  carryoverLimit: 8,
});

export const CHAT_MEMORY_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_MEMORY_MODULE_NAME,
  version: CHAT_MEMORY_MODULE_VERSION,
  laws: CHAT_MEMORY_LAWS,
  defaults: CHAT_MEMORY_DEFAULTS,
});

/** Factory function that creates a ChatMemoryService with default config. */
export function createChatMemoryService(config?: Partial<ChatMemoryServiceConfig>): ChatMemoryService {
  return new ChatMemoryService(config);
}

/** Build a trace string for a memory record. */
export function traceMemoryRecord(record: EpisodicMemoryRecord): string {
  const status = record.status;
  const unresolved = record.unresolved ? 'UNRESOLVED' : 'resolved';
  return `[MEMORY id=${record.memoryId} type=${record.eventType} salience=${record.salience01.toFixed(2)} ${unresolved} status=${status}]`;
}

/** Sort records by combined salience + emotional weight. */
export function rankMemoriesByImpact(
  records: readonly EpisodicMemoryRecord[],
): readonly EpisodicMemoryRecord[] {
  return Object.freeze(
    [...records].sort((a, b) => {
      const scoreA = a.salience01 * 0.55 + a.emotionalWeight01 * 0.30 + a.strategicWeight01 * 0.15;
      const scoreB = b.salience01 * 0.55 + b.emotionalWeight01 * 0.30 + b.strategicWeight01 * 0.15;
      return scoreB - scoreA;
    }),
  );
}

/** Compute average salience across a set of records. */
export function averageSalience(records: readonly EpisodicMemoryRecord[]): number {
  if (records.length === 0) return 0;
  return records.reduce((s, r) => s + r.salience01, 0) / records.length;
}

/** Build a compact fingerprint string for a memory snapshot. */
export function memorySnapshotFingerprint(snapshot: EpisodicMemorySnapshot): string {
  const ids = snapshot.activeMemories.map((r) => r.memoryId).sort().join(',');
  return `${snapshot.playerId ?? 'GLOBAL'}@${snapshot.updatedAt}|${ids.length}:${ids.slice(0, 64)}`;
}

/** Merge two memory exports for the same player (used in distributed systems). */
export function mergeMemoryExports(
  exportA: MemoryPlayerExport,
  exportB: MemoryPlayerExport,
): MemoryPlayerExport {
  const allActive = new Map([
    ...exportA.active.map((r) => [r.memoryId, r] as [string, EpisodicMemoryRecord]),
    ...exportB.active.map((r) => [r.memoryId, r] as [string, EpisodicMemoryRecord]),
  ]);
  const allArchived = new Map([
    ...exportA.archived.map((r) => [r.memoryId, r] as [string, EpisodicMemoryRecord]),
    ...exportB.archived.map((r) => [r.memoryId, r] as [string, EpisodicMemoryRecord]),
  ]);
  return Object.freeze({
    playerId: exportA.playerId,
    exportedAt: Math.max(exportA.exportedAt, exportB.exportedAt),
    active: Object.freeze([...allActive.values()]),
    archived: Object.freeze([...allArchived.values()]),
  });
}

/** Compute a "memory richness" score for a player based on volume and diversity. */
export function computeMemoryRichness01(records: readonly EpisodicMemoryRecord[]): number {
  if (records.length === 0) return 0;
  const uniqueTypes = new Set(records.map((r) => r.eventType)).size;
  const uniqueCounterparts = new Set(records.map((r) => r.counterpartId).filter(Boolean)).size;
  const countFactor = clamp01(records.length / 64);
  const diversityFactor = clamp01(uniqueTypes / 12);
  const counterpartFactor = clamp01(uniqueCounterparts / 8);
  return clamp01(countFactor * 0.45 + diversityFactor * 0.35 + counterpartFactor * 0.20);
}

/** Return all memories that have callback variants eligible for the given channel. */
export function filterCallbackEligibleMemories(
  records: readonly EpisodicMemoryRecord[],
  channelId: string,
  minSalience01: number = 0.35,
): readonly EpisodicMemoryRecord[] {
  return Object.freeze(
    records.filter((r) =>
      r.salience01 >= minSalience01 &&
      r.callbackVariants.some((v) =>
        v.eligibleChannels.length === 0 || v.eligibleChannels.includes(channelId),
      ),
    ),
  );
}

// ============================================================================
// MEMORY DECAY CURVE — Configurable decay profiles for different use cases
// ============================================================================

export type MemoryDecayCurveType = 'LINEAR' | 'EXPONENTIAL' | 'STEP' | 'FLAT';

export interface MemoryDecayCurveConfig {
  readonly type: MemoryDecayCurveType;
  readonly halfLifeMs: number;
  readonly floor01: number;
  readonly ceiling01: number;
}

export const MEMORY_DECAY_CURVE_PRESETS: Readonly<Record<string, MemoryDecayCurveConfig>> = Object.freeze({
  DEFAULT: { type: 'EXPONENTIAL', halfLifeMs: 7 * 24 * 60 * 60 * 1000, floor01: 0.05, ceiling01: 1.0 },
  FAST: { type: 'EXPONENTIAL', halfLifeMs: 24 * 60 * 60 * 1000, floor01: 0.10, ceiling01: 1.0 },
  SLOW: { type: 'EXPONENTIAL', halfLifeMs: 30 * 24 * 60 * 60 * 1000, floor01: 0.15, ceiling01: 1.0 },
  FLAT: { type: 'FLAT', halfLifeMs: Infinity, floor01: 0.0, ceiling01: 1.0 },
  STEP_7: { type: 'STEP', halfLifeMs: 7 * 24 * 60 * 60 * 1000, floor01: 0.0, ceiling01: 1.0 },
});

export function applyDecayCurve(
  salience01: number,
  ageMs: number,
  config: MemoryDecayCurveConfig,
): number {
  const { type, halfLifeMs, floor01, ceiling01 } = config;
  let decayed: number;
  switch (type) {
    case 'EXPONENTIAL':
      decayed = salience01 * Math.pow(0.5, ageMs / halfLifeMs);
      break;
    case 'LINEAR':
      decayed = salience01 * Math.max(0, 1 - ageMs / (halfLifeMs * 2));
      break;
    case 'STEP':
      decayed = ageMs >= halfLifeMs ? 0 : salience01;
      break;
    case 'FLAT':
    default:
      decayed = salience01;
      break;
  }
  return clamp01(Math.max(floor01, Math.min(ceiling01, decayed)));
}

// ============================================================================
// MEMORY ANNOTATION SYSTEM — Attach metadata tags to memory records
// ============================================================================

export interface MemoryAnnotation {
  readonly memoryId: string;
  readonly annotationId: string;
  readonly tag: string;
  readonly value: string;
  readonly createdAt: number;
  readonly createdBy: string;
}

export class MemoryAnnotationStore {
  private readonly annotations = new Map<string, MemoryAnnotation[]>();

  addAnnotation(annotation: MemoryAnnotation): void {
    const existing = this.annotations.get(annotation.memoryId) ?? [];
    // Replace if same tag
    const filtered = existing.filter((a) => a.tag !== annotation.tag);
    this.annotations.set(annotation.memoryId, [...filtered, annotation]);
  }

  getAnnotations(memoryId: string): readonly MemoryAnnotation[] {
    return Object.freeze(this.annotations.get(memoryId) ?? []);
  }

  getAnnotationsByTag(tag: string): readonly MemoryAnnotation[] {
    const result: MemoryAnnotation[] = [];
    for (const anns of this.annotations.values()) {
      for (const ann of anns) {
        if (ann.tag === tag) result.push(ann);
      }
    }
    return Object.freeze(result);
  }

  removeAnnotation(memoryId: string, tag: string): boolean {
    const existing = this.annotations.get(memoryId);
    if (!existing) return false;
    const filtered = existing.filter((a) => a.tag !== tag);
    this.annotations.set(memoryId, filtered);
    return filtered.length !== existing.length;
  }

  clearMemory(memoryId: string): void {
    this.annotations.delete(memoryId);
  }

  hasAnnotation(memoryId: string, tag: string): boolean {
    return (this.annotations.get(memoryId) ?? []).some((a) => a.tag === tag);
  }

  annotationCount(): number {
    let total = 0;
    for (const anns of this.annotations.values()) total += anns.length;
    return total;
  }
}

// ============================================================================
// MEMORY WATCH BUS — Observer pattern for memory mutations
// ============================================================================

export type MemoryWatchEvent =
  | { type: 'RECORD_UPSERTED'; record: EpisodicMemoryRecord }
  | { type: 'RECORD_RESOLVED'; memoryId: string; playerId: string }
  | { type: 'RECORD_ARCHIVED'; memoryId: string; playerId: string }
  | { type: 'RECORD_EXPIRED'; memoryId: string; playerId: string }
  | { type: 'PLAYER_CLEARED'; playerId: string }
  | { type: 'DECAY_APPLIED'; playerId: string; count: number };

export type MemoryWatcher = (event: MemoryWatchEvent) => void;

export class MemoryWatchBus {
  private readonly watchers: Set<MemoryWatcher> = new Set();

  subscribe(watcher: MemoryWatcher): () => void {
    this.watchers.add(watcher);
    return () => this.watchers.delete(watcher);
  }

  emit(event: MemoryWatchEvent): void {
    for (const watcher of this.watchers) {
      try { watcher(event); } catch { /* watchers must not throw */ }
    }
  }

  subscriberCount(): number { return this.watchers.size; }
  clear(): void { this.watchers.clear(); }
}

// ============================================================================
// MEMORY TREND ANALYSIS — Detect shifts in memory patterns over time
// ============================================================================

export interface MemoryTrendReport {
  readonly playerId: string;
  readonly generatedAt: number;
  readonly periodMs: number;
  readonly recentEventTypes: readonly EpisodicMemoryEventType[];
  readonly dominantEventType: EpisodicMemoryEventType | null;
  readonly salienceVelocity01: number;
  readonly unresolvedGrowthRate: number;
  readonly mostActiveCounterpart: string | null;
  readonly trendLabel: 'ESCALATING' | 'STABLE' | 'DE_ESCALATING' | 'DORMANT';
}

export function computeMemoryTrend(
  playerId: string,
  records: readonly EpisodicMemoryRecord[],
  periodMs: number = 24 * 60 * 60 * 1000,
  nowMs: number = Date.now(),
): MemoryTrendReport {
  const playerRecords = records.filter((r) => r.playerId === playerId);
  const recent = playerRecords.filter((r) => nowMs - r.createdAt <= periodMs);
  const older = playerRecords.filter((r) => nowMs - r.createdAt > periodMs && nowMs - r.createdAt <= periodMs * 2);

  if (recent.length === 0) {
    return Object.freeze({
      playerId,
      generatedAt: nowMs,
      periodMs,
      recentEventTypes: Object.freeze([]),
      dominantEventType: null,
      salienceVelocity01: 0,
      unresolvedGrowthRate: 0,
      mostActiveCounterpart: null,
      trendLabel: 'DORMANT',
    });
  }

  const eventTypeCounts = new Map<EpisodicMemoryEventType, number>();
  for (const r of recent) {
    eventTypeCounts.set(r.eventType, (eventTypeCounts.get(r.eventType) ?? 0) + 1);
  }
  const recentEventTypes = [...new Set(recent.map((r) => r.eventType))];
  let dominantEventType: EpisodicMemoryEventType | null = null;
  let maxCount = 0;
  for (const [et, count] of eventTypeCounts) {
    if (count > maxCount) { maxCount = count; dominantEventType = et; }
  }

  const recentAvgSalience = recent.length > 0
    ? recent.reduce((s, r) => s + r.salience01, 0) / recent.length
    : 0;
  const olderAvgSalience = older.length > 0
    ? older.reduce((s, r) => s + r.salience01, 0) / older.length
    : recentAvgSalience;
  const salienceVelocity01 = recentAvgSalience - olderAvgSalience;

  const recentUnresolved = recent.filter((r) => r.unresolved).length;
  const olderUnresolved = older.filter((r) => r.unresolved).length;
  const unresolvedGrowthRate = older.length > 0
    ? (recentUnresolved - olderUnresolved) / older.length
    : recentUnresolved;

  const counterpartCounts = new Map<string, number>();
  for (const r of recent) {
    if (r.counterpartId) {
      counterpartCounts.set(r.counterpartId, (counterpartCounts.get(r.counterpartId) ?? 0) + 1);
    }
  }
  let mostActiveCounterpart: string | null = null;
  let maxCpCount = 0;
  for (const [cp, count] of counterpartCounts) {
    if (count > maxCpCount) { maxCpCount = count; mostActiveCounterpart = cp; }
  }

  const trendLabel: MemoryTrendReport['trendLabel'] =
    salienceVelocity01 >= 0.10 ? 'ESCALATING' :
    salienceVelocity01 <= -0.10 ? 'DE_ESCALATING' :
    recent.length > 0 ? 'STABLE' : 'DORMANT';

  return Object.freeze({
    playerId,
    generatedAt: nowMs,
    periodMs,
    recentEventTypes: Object.freeze(recentEventTypes),
    dominantEventType,
    salienceVelocity01,
    unresolvedGrowthRate,
    mostActiveCounterpart,
    trendLabel,
  });
}

// ============================================================================
// MEMORY COMPRESSION — Summarize old memories into lightweight entries
// ============================================================================

export interface MemoryCompressionResult {
  readonly compressedCount: number;
  readonly retainedCount: number;
  readonly summaryEntries: readonly string[];
  readonly freedEstimateBytes: number;
}

export function compressOldResolvedMemories(
  records: EpisodicMemoryRecord[],
  retentionWindowMs: number = 30 * 24 * 60 * 60 * 1000,
  nowMs: number = Date.now(),
): { kept: EpisodicMemoryRecord[]; result: MemoryCompressionResult } {
  const cutoff = nowMs - retentionWindowMs;
  const toCompress = records.filter(
    (r) => !r.unresolved && r.status === 'ARCHIVED' && r.createdAt < cutoff && r.timesReused === 0,
  );
  const toKeep = records.filter(
    (r) => !(!r.unresolved && r.status === 'ARCHIVED' && r.createdAt < cutoff && r.timesReused === 0),
  );
  const summaryEntries = toCompress.map((r) =>
    `${r.memoryId}|${r.eventType}|sal=${r.salience01.toFixed(2)}|at=${r.createdAt}`,
  );
  const estimatedBytesPerRecord = 512;
  return {
    kept: toKeep,
    result: Object.freeze({
      compressedCount: toCompress.length,
      retainedCount: toKeep.length,
      summaryEntries: Object.freeze(summaryEntries),
      freedEstimateBytes: toCompress.length * estimatedBytesPerRecord,
    }),
  };
}

// ============================================================================
// MEMORY SCORE MATRIX — Multi-dimensional ranking of memory significance
// ============================================================================

export interface MemoryScoreMatrix {
  readonly memoryId: string;
  readonly salienceScore: number;
  readonly emotionalScore: number;
  readonly strategicScore: number;
  readonly reuseScore: number;
  readonly callbackScore: number;
  readonly compositeScore: number;
  readonly rank: number;
}

export function buildMemoryScoreMatrix(
  records: readonly EpisodicMemoryRecord[],
): readonly MemoryScoreMatrix[] {
  const scored = records.map((r) => {
    const reuseScore = clamp01(r.timesReused / 10);
    const callbackScore = clamp01(r.callbackVariants.length / 5);
    const compositeScore = clamp01(
      r.salience01 * 0.35 +
      r.emotionalWeight01 * 0.20 +
      r.strategicWeight01 * 0.20 +
      reuseScore * 0.15 +
      callbackScore * 0.10,
    );
    return {
      memoryId: r.memoryId,
      salienceScore: r.salience01,
      emotionalScore: r.emotionalWeight01,
      strategicScore: r.strategicWeight01,
      reuseScore,
      callbackScore,
      compositeScore,
      rank: 0,
    };
  });
  scored.sort((a, b) => b.compositeScore - a.compositeScore);
  return Object.freeze(scored.map((s, i) => Object.freeze({ ...s, rank: i + 1 })));
}

// ============================================================================
// CALLBACK TONE DIVERSITY ANALYZER
// ============================================================================

export interface CallbackToneDiversityReport {
  readonly toneFrequency: Readonly<Record<string, number>>;
  readonly dominantTone: string | null;
  readonly diversityScore01: number;
  readonly isMonotone: boolean;
}

export function analyzeCallbackToneDiversity(
  records: readonly EpisodicMemoryRecord[],
): CallbackToneDiversityReport {
  const toneCounts: Record<string, number> = {};
  for (const r of records) {
    for (const v of r.callbackVariants) {
      toneCounts[v.tone] = (toneCounts[v.tone] ?? 0) + 1;
    }
  }

  const toneFrequency = Object.freeze(toneCounts);
  const entries = Object.entries(toneCounts);
  let dominantTone: string | null = null;
  let maxCount = 0;
  for (const [tone, count] of entries) {
    if (count > maxCount) { maxCount = count; dominantTone = tone; }
  }

  const totalVariants = entries.reduce((s, [, c]) => s + c, 0);
  const uniqueTones = entries.length;
  const diversityScore01 = totalVariants > 0 ? clamp01(uniqueTones / 8) : 0;
  const isMonotone = uniqueTones <= 1;

  return Object.freeze({
    toneFrequency,
    dominantTone,
    diversityScore01,
    isMonotone,
  });
}

// ============================================================================
// MEMORY ISOLATION — Detect memories that have no callback variants
// ============================================================================

export function findOrphanedMemories(
  records: readonly EpisodicMemoryRecord[],
): readonly EpisodicMemoryRecord[] {
  return Object.freeze(records.filter((r) => r.callbackVariants.length === 0));
}

/** Detect memories with embarrassment risk above threshold. */
export function findHighRiskMemories(
  records: readonly EpisodicMemoryRecord[],
  riskThreshold01: number = 0.65,
): readonly EpisodicMemoryRecord[] {
  return Object.freeze(records.filter((r) => r.embarrassmentRisk01 >= riskThreshold01));
}

/** Build a counterpart interaction matrix showing co-occurrence of counterparts in memories. */
export function buildCounterpartCooccurrenceMatrix(
  records: readonly EpisodicMemoryRecord[],
): Readonly<Record<string, Readonly<Record<string, number>>>> {
  // Group memories by bot and counterpart combos
  const botMemories = new Map<string, string[]>();
  for (const r of records) {
    if (!r.botId || !r.counterpartId) continue;
    if (!botMemories.has(r.botId)) botMemories.set(r.botId, []);
    botMemories.get(r.botId)!.push(r.counterpartId);
  }

  const matrix: Record<string, Record<string, number>> = {};
  for (const [botId, counterparts] of botMemories) {
    if (!matrix[botId]) matrix[botId] = {};
    for (const cp of counterparts) {
      matrix[botId][cp] = (matrix[botId][cp] ?? 0) + 1;
    }
  }

  const frozen: Record<string, Readonly<Record<string, number>>> = {};
  for (const [k, v] of Object.entries(matrix)) {
    frozen[k] = Object.freeze(v);
  }
  return Object.freeze(frozen);
}

/** Check if two memory records represent closely related events (same counterpart + event type within time window). */
export function areRelatedMemories(
  a: EpisodicMemoryRecord,
  b: EpisodicMemoryRecord,
  timeWindowMs: number = 30 * 60 * 1000,
): boolean {
  if (a.memoryId === b.memoryId) return false;
  if (a.eventType !== b.eventType) return false;
  if (a.counterpartId !== b.counterpartId) return false;
  return Math.abs(a.createdAt - b.createdAt) <= timeWindowMs;
}

/** De-duplicate closely related memory records, keeping the highest-salience one. */
export function deduplicateRelatedMemories(
  records: readonly EpisodicMemoryRecord[],
  timeWindowMs: number = 30 * 60 * 1000,
): readonly EpisodicMemoryRecord[] {
  const sorted = [...records].sort((a, b) => b.salience01 - a.salience01);
  const kept: EpisodicMemoryRecord[] = [];
  for (const candidate of sorted) {
    const isDuplicate = kept.some((k) => areRelatedMemories(k, candidate, timeWindowMs));
    if (!isDuplicate) kept.push(candidate);
  }
  return Object.freeze(kept);
}

/** Compute a global memory pressure indicator across all players. */
export function computeGlobalMemoryPressure(
  snapshots: readonly EpisodicMemorySnapshot[],
): number {
  if (snapshots.length === 0) return 0;
  const totalUnresolved = snapshots.reduce((s, snap) => s + snap.unresolvedMemoryIds.length, 0);
  const avgUnresolved = totalUnresolved / snapshots.length;
  return clamp01(avgUnresolved / 20);
}

/** Build a chronological timeline of memory events for a player. */
export function buildMemoryTimeline(
  records: readonly EpisodicMemoryRecord[],
  playerId?: string,
): readonly EpisodicMemoryRecord[] {
  const filtered = playerId
    ? records.filter((r) => r.playerId === playerId)
    : records;
  return Object.freeze([...filtered].sort((a, b) => a.createdAt - b.createdAt));
}

/** Count the total number of unresolved memories across all snapshots. */
export function countTotalUnresolvedAcrossSnapshots(
  snapshots: readonly EpisodicMemorySnapshot[],
): number {
  return snapshots.reduce((s, snap) => s + snap.unresolvedMemoryIds.length, 0);
}

/** Find memories that were referenced many times (high callback utility). */
export function findHighReuseMemories(
  records: readonly EpisodicMemoryRecord[],
  minReuseCount: number = 3,
): readonly EpisodicMemoryRecord[] {
  return Object.freeze(
    records.filter((r) => r.timesReused >= minReuseCount)
      .sort((a, b) => b.timesReused - a.timesReused),
  );
}

/** Estimate the "total narrative weight" of a player's memory corpus. */
export function computeTotalNarrativeWeight(
  records: readonly EpisodicMemoryRecord[],
): number {
  return records.reduce(
    (s, r) => s + r.salience01 * 0.4 + r.emotionalWeight01 * 0.35 + r.strategicWeight01 * 0.25,
    0,
  );
}

/** Build a per-bot memory ownership breakdown. */
export function buildBotMemoryOwnership(
  records: readonly EpisodicMemoryRecord[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const r of records) {
    if (!r.botId) continue;
    counts[r.botId] = (counts[r.botId] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

// ============================================================================
// MEMORY CONVERGENCE DETECTOR — Find when multiple players share a memory pattern
// ============================================================================

export interface MemoryConvergenceSignal {
  readonly eventType: EpisodicMemoryEventType;
  readonly counterpartId: string | null;
  readonly playerCount: number;
  readonly playerIds: readonly string[];
  readonly avgSalience01: number;
  readonly convergenceStrength01: number;
}

export function detectMemoryConvergence(
  allPlayerRecords: readonly EpisodicMemoryRecord[],
  minPlayerCount: number = 2,
): readonly MemoryConvergenceSignal[] {
  type ConvergenceKey = string;
  const groups = new Map<ConvergenceKey, EpisodicMemoryRecord[]>();

  for (const r of allPlayerRecords) {
    if (!r.playerId) continue;
    const key: ConvergenceKey = `${r.eventType}:${r.counterpartId ?? 'NONE'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const signals: MemoryConvergenceSignal[] = [];
  for (const [key, group] of groups) {
    const playerIds = [...new Set(group.map((r) => r.playerId!))];
    if (playerIds.length < minPlayerCount) continue;

    const [eventType, counterpartId] = key.split(':') as [EpisodicMemoryEventType, string];
    const avgSalience01 = group.reduce((s, r) => s + r.salience01, 0) / group.length;
    const convergenceStrength01 = clamp01(playerIds.length / 10 * 0.5 + avgSalience01 * 0.5);

    signals.push(Object.freeze({
      eventType,
      counterpartId: counterpartId === 'NONE' ? null : counterpartId,
      playerCount: playerIds.length,
      playerIds: Object.freeze(playerIds),
      avgSalience01,
      convergenceStrength01,
    }));
  }

  return Object.freeze(signals.sort((a, b) => b.convergenceStrength01 - a.convergenceStrength01));
}

// ============================================================================
// MEMORY SNAPSHOT VALIDATOR — Detect data integrity issues
// ============================================================================

export interface MemorySnapshotValidationResult {
  readonly isValid: boolean;
  readonly issues: readonly string[];
  readonly warningCount: number;
  readonly errorCount: number;
}

export function validateMemorySnapshot(snapshot: EpisodicMemorySnapshot): MemorySnapshotValidationResult {
  const issues: string[] = [];
  let warningCount = 0;
  let errorCount = 0;

  if (snapshot.activeMemories.length === 0 && snapshot.unresolvedMemoryIds.length > 0) {
    issues.push('unresolvedMemoryIds references non-existent active memories');
    errorCount++;
  }

  const activeIds = new Set(snapshot.activeMemories.map((r) => r.memoryId));
  for (const uid of snapshot.unresolvedMemoryIds) {
    if (!activeIds.has(uid)) {
      issues.push(`unresolvedMemoryId ${uid} not found in activeMemories`);
      errorCount++;
    }
  }

  for (const record of snapshot.activeMemories) {
    if (record.salience01 < 0 || record.salience01 > 1) {
      issues.push(`record ${record.memoryId} has out-of-range salience01: ${record.salience01}`);
      errorCount++;
    }
    if (record.emotionalWeight01 < 0 || record.emotionalWeight01 > 1) {
      issues.push(`record ${record.memoryId} has out-of-range emotionalWeight01`);
      warningCount++;
    }
    if (record.timesReused < 0) {
      issues.push(`record ${record.memoryId} has negative timesReused`);
      errorCount++;
    }
  }

  if (snapshot.updatedAt < snapshot.createdAt) {
    issues.push('snapshot.updatedAt is before createdAt');
    warningCount++;
  }

  return Object.freeze({
    isValid: errorCount === 0,
    issues: Object.freeze(issues),
    warningCount,
    errorCount,
  });
}

// ============================================================================
// MEMORY SERVICE EXTENDED CLASS — Adds watch bus and annotation store to service
// ============================================================================

export class ChatMemoryServiceExtended extends ChatMemoryService {
  public readonly watchBus = new MemoryWatchBus();
  public readonly annotations = new MemoryAnnotationStore();

  public override upsert(record: EpisodicMemoryRecord): EpisodicMemoryRecord {
    const result = super.upsert(record);
    this.watchBus.emit({ type: 'RECORD_UPSERTED', record: result });
    return result;
  }

  public override resolve(playerId: string, memoryId: string): EpisodicMemoryRecord | undefined {
    const result = super.resolve(playerId, memoryId);
    if (result) this.watchBus.emit({ type: 'RECORD_RESOLVED', memoryId, playerId });
    return result;
  }

  public override archive(playerId: string, memoryId: string): EpisodicMemoryRecord | undefined {
    const result = super.archive(playerId, memoryId);
    if (result) this.watchBus.emit({ type: 'RECORD_ARCHIVED', memoryId, playerId });
    return result;
  }

  public override clearPlayer(playerId: string): void {
    super.clearPlayer(playerId);
    this.watchBus.emit({ type: 'PLAYER_CLEARED', playerId });
  }

  public override applyDecay(playerId: string, decayRate?: number): readonly EpisodicMemoryRecord[] {
    const result = super.applyDecay(playerId, decayRate);
    this.watchBus.emit({ type: 'DECAY_APPLIED', playerId, count: result.length });
    return result;
  }
}

/** Factory for the extended service (with observability support). */
export function createChatMemoryServiceExtended(
  config?: Partial<ChatMemoryServiceConfig>,
): ChatMemoryServiceExtended {
  return new ChatMemoryServiceExtended(config);
}

// ============================================================================
// MEMORY EVENT SEQUENCE ANALYZER — Detect recurring patterns in memory events
// ============================================================================

export interface MemoryEventSequence {
  readonly sequence: readonly EpisodicMemoryEventType[];
  readonly occurrences: number;
  readonly avgIntervalMs: number;
  readonly isRecurring: boolean;
}

export function detectRecurringEventSequences(
  records: readonly EpisodicMemoryRecord[],
  windowSize: number = 3,
  minOccurrences: number = 2,
): readonly MemoryEventSequence[] {
  const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt);
  const sequenceCounts = new Map<string, number[]>();

  for (let i = 0; i <= sorted.length - windowSize; i++) {
    const window = sorted.slice(i, i + windowSize);
    const key = window.map((r) => r.eventType).join('→');
    if (!sequenceCounts.has(key)) sequenceCounts.set(key, []);
    const intervals = window.slice(1).map((r, j) => r.createdAt - window[j].createdAt);
    const avgInterval = intervals.length > 0
      ? intervals.reduce((s, v) => s + v, 0) / intervals.length
      : 0;
    sequenceCounts.get(key)!.push(avgInterval);
  }

  const results: MemoryEventSequence[] = [];
  for (const [key, intervals] of sequenceCounts) {
    if (intervals.length < minOccurrences) continue;
    const sequence = key.split('→') as EpisodicMemoryEventType[];
    const avgIntervalMs = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    results.push(Object.freeze({
      sequence: Object.freeze(sequence),
      occurrences: intervals.length,
      avgIntervalMs,
      isRecurring: intervals.length >= 3,
    }));
  }

  return Object.freeze(results.sort((a, b) => b.occurrences - a.occurrences));
}

// ============================================================================
// MEMORY CAPACITY PLANNER — Estimate when caps will be hit
// ============================================================================

export interface MemoryCapacityForecast {
  readonly playerId: string;
  readonly currentActive: number;
  readonly maxActive: number;
  readonly utilizationRate01: number;
  readonly avgGrowthRatePerDay: number;
  readonly daysUntilCap: number | null;
  readonly capacityLabel: 'AMPLE' | 'FILLING' | 'TIGHT' | 'AT_CAP';
}

export function forecastMemoryCapacity(
  playerId: string,
  records: readonly EpisodicMemoryRecord[],
  maxActive: number = DEFAULT_CHAT_MEMORY_SERVICE_CONFIG.maxActivePerPlayer,
  nowMs: number = Date.now(),
): MemoryCapacityForecast {
  const playerRecords = records.filter((r) => r.playerId === playerId && !r.status.startsWith('ARCH'));
  const currentActive = playerRecords.length;
  const utilizationRate01 = clamp01(currentActive / maxActive);

  // Estimate growth rate from last 7 days
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const recentRecords = playerRecords.filter((r) => r.createdAt >= sevenDaysAgo);
  const avgGrowthRatePerDay = recentRecords.length / 7;

  let daysUntilCap: number | null = null;
  if (avgGrowthRatePerDay > 0) {
    daysUntilCap = (maxActive - currentActive) / avgGrowthRatePerDay;
  }

  const capacityLabel: MemoryCapacityForecast['capacityLabel'] =
    utilizationRate01 >= 0.98 ? 'AT_CAP' :
    utilizationRate01 >= 0.80 ? 'TIGHT' :
    utilizationRate01 >= 0.55 ? 'FILLING' : 'AMPLE';

  return Object.freeze({
    playerId,
    currentActive,
    maxActive,
    utilizationRate01,
    avgGrowthRatePerDay,
    daysUntilCap: daysUntilCap != null ? Math.ceil(daysUntilCap) : null,
    capacityLabel,
  });
}

// ============================================================================
// MEMORY FINGERPRINT REGISTRY — Track known memory patterns for fast lookup
// ============================================================================

export class MemoryFingerprintRegistry {
  private readonly registry = new Map<string, Set<string>>();

  register(record: EpisodicMemoryRecord): void {
    const fp = `${record.eventType}:${record.counterpartId ?? 'NONE'}:${record.triggerContext.sceneId ?? 'NONE'}`;
    if (!this.registry.has(fp)) this.registry.set(fp, new Set());
    this.registry.get(fp)!.add(record.memoryId);
  }

  lookupByFingerprint(eventType: EpisodicMemoryEventType, counterpartId?: string, sceneId?: string): readonly string[] {
    const fp = `${eventType}:${counterpartId ?? 'NONE'}:${sceneId ?? 'NONE'}`;
    return Object.freeze([...(this.registry.get(fp) ?? [])]);
  }

  hasFingerprint(eventType: EpisodicMemoryEventType, counterpartId?: string, sceneId?: string): boolean {
    const fp = `${eventType}:${counterpartId ?? 'NONE'}:${sceneId ?? 'NONE'}`;
    return this.registry.has(fp);
  }

  registrySize(): number {
    return this.registry.size;
  }

  clear(): void {
    this.registry.clear();
  }
}

// ============================================================================
// MEMORY EVENT PROJECTION — Map memory records into lightweight projection payloads
// ============================================================================

export interface MemoryEventProjection {
  readonly memoryId: string;
  readonly eventType: EpisodicMemoryEventType;
  readonly salience01: number;
  readonly unresolved: boolean;
  readonly hasCallbacks: boolean;
  readonly counterpartId: string | null;
  readonly roomId: string | null;
  readonly createdAt: number;
  readonly label: string;
}

export function projectMemoryEvent(record: EpisodicMemoryRecord): MemoryEventProjection {
  return Object.freeze({
    memoryId: record.memoryId,
    eventType: record.eventType,
    salience01: record.salience01,
    unresolved: record.unresolved,
    hasCallbacks: record.callbackVariants.length > 0,
    counterpartId: record.counterpartId ?? null,
    roomId: record.triggerContext.roomId ?? null,
    createdAt: record.createdAt,
    label: `${record.eventType}@sal=${record.salience01.toFixed(2)}`,
  });
}

export function projectMemoryEvents(
  records: readonly EpisodicMemoryRecord[],
): readonly MemoryEventProjection[] {
  return Object.freeze(records.map(projectMemoryEvent));
}

// ============================================================================
// MEMORY COUNTERPART DIGEST — Summary per counterpart across all memories
// ============================================================================

export interface MemoryCounterpartDigest {
  readonly counterpartId: string;
  readonly memoryCount: number;
  readonly unresolvedCount: number;
  readonly avgSalience01: number;
  readonly dominantEventType: EpisodicMemoryEventType | null;
  readonly firstInteractionAt: number | null;
  readonly lastInteractionAt: number | null;
  readonly relationshipLabel: 'STRANGER' | 'KNOWN' | 'SIGNIFICANT' | 'DEFINING';
}

export function buildCounterpartDigests(
  records: readonly EpisodicMemoryRecord[],
): readonly MemoryCounterpartDigest[] {
  const groups = new Map<string, EpisodicMemoryRecord[]>();
  for (const r of records) {
    if (!r.counterpartId) continue;
    if (!groups.has(r.counterpartId)) groups.set(r.counterpartId, []);
    groups.get(r.counterpartId)!.push(r);
  }

  const digests: MemoryCounterpartDigest[] = [];
  for (const [counterpartId, group] of groups) {
    const memoryCount = group.length;
    const unresolvedCount = group.filter((r) => r.unresolved).length;
    const avgSalience01 = group.reduce((s, r) => s + r.salience01, 0) / memoryCount;
    const typeCounts = new Map<EpisodicMemoryEventType, number>();
    for (const r of group) {
      typeCounts.set(r.eventType, (typeCounts.get(r.eventType) ?? 0) + 1);
    }
    let dominantEventType: EpisodicMemoryEventType | null = null;
    let maxCount = 0;
    for (const [et, count] of typeCounts) {
      if (count > maxCount) { maxCount = count; dominantEventType = et; }
    }
    const timestamps = group.map((r) => r.createdAt).sort((a, b) => a - b);
    const firstInteractionAt = timestamps[0] ?? null;
    const lastInteractionAt = timestamps[timestamps.length - 1] ?? null;
    const relationshipLabel: MemoryCounterpartDigest['relationshipLabel'] =
      memoryCount >= 20 || avgSalience01 >= 0.75 ? 'DEFINING' :
      memoryCount >= 8 || avgSalience01 >= 0.55 ? 'SIGNIFICANT' :
      memoryCount >= 3 ? 'KNOWN' : 'STRANGER';

    digests.push(Object.freeze({
      counterpartId,
      memoryCount,
      unresolvedCount,
      avgSalience01,
      dominantEventType,
      firstInteractionAt,
      lastInteractionAt,
      relationshipLabel,
    }));
  }
  return Object.freeze(digests.sort((a, b) => b.avgSalience01 - a.avgSalience01));
}

// ============================================================================
// MEMORY RATE TRACKER — Detect spikes in memory creation velocity
// ============================================================================

export interface MemoryRateSnapshot {
  readonly playerId: string;
  readonly windowMs: number;
  readonly recordsInWindow: number;
  readonly ratePerMinute: number;
  readonly isSpike: boolean;
  readonly spikeThreshold: number;
}

export function computeMemoryCreationRate(
  playerId: string,
  records: readonly EpisodicMemoryRecord[],
  windowMs: number = 60 * 60 * 1000,
  spikeThreshold: number = 10,
  nowMs: number = Date.now(),
): MemoryRateSnapshot {
  const playerRecords = records.filter((r) => r.playerId === playerId);
  const inWindow = playerRecords.filter((r) => nowMs - r.createdAt <= windowMs);
  const ratePerMinute = inWindow.length / (windowMs / 60000);
  const isSpike = inWindow.length >= spikeThreshold;
  return Object.freeze({
    playerId,
    windowMs,
    recordsInWindow: inWindow.length,
    ratePerMinute,
    isSpike,
    spikeThreshold,
  });
}

// ============================================================================
// MEMORY MODULE DESCRIPTOR
// ============================================================================

export const CHAT_MEMORY_MODULE_DESCRIPTOR_V2 = Object.freeze({
  name: CHAT_MEMORY_MODULE_NAME,
  version: CHAT_MEMORY_MODULE_VERSION,
  laws: CHAT_MEMORY_LAWS,
  defaults: CHAT_MEMORY_DEFAULTS,
  features: Object.freeze([
    'episodic_memory_persistence',
    'callback_selection',
    'salience_decay',
    'compression',
    'replay_iteration',
    'convergence_detection',
    'capacity_forecasting',
    'trend_analysis',
    'annotation_store',
    'watch_bus',
    'fingerprint_registry',
    'extended_service',
  ]),
});

// ============================================================================
// MEMORY RECORD BUILDER — Fluent API for constructing new memory records
// ============================================================================

interface MutableMemoryBuildState {
  _memoryId?: string;
  _playerId?: string | null;
  _botId?: string | null;
  _counterpartId?: string | null;
  _eventType?: EpisodicMemoryEventType;
  _triggerContext?: EpisodicMemoryRecord['triggerContext'];
  _salience01?: number;
  _emotionalWeight01?: number;
  _strategicWeight01?: number;
  _embarrassmentRisk01?: number;
  _unresolved?: boolean;
  _status?: EpisodicMemoryRecord['status'];
  _createdAt?: number;
  _expiresAt?: number;
  _callbackVariants: EpisodicMemoryRecord['callbackVariants'][number][];
}

export class MemoryRecordBuilder {
  private readonly s: MutableMemoryBuildState = { _callbackVariants: [] };

  memoryId(id: string): this { this.s._memoryId = id; return this; }
  playerId(id: string | null): this { this.s._playerId = id; return this; }
  botId(id: string | null): this { this.s._botId = id; return this; }
  counterpartId(id: string | null): this { this.s._counterpartId = id; return this; }
  eventType(type: EpisodicMemoryEventType): this { this.s._eventType = type; return this; }
  salience(value: number): this { this.s._salience01 = clamp01(value); return this; }
  emotionalWeight(value: number): this { this.s._emotionalWeight01 = clamp01(value); return this; }
  strategicWeight(value: number): this { this.s._strategicWeight01 = clamp01(value); return this; }
  embarrassmentRisk(value: number): this { this.s._embarrassmentRisk01 = clamp01(value); return this; }
  unresolved(flag: boolean = true): this { this.s._unresolved = flag; return this; }
  status(st: EpisodicMemoryRecord['status']): this { this.s._status = st; return this; }
  createdAt(ms: number): this { this.s._createdAt = ms; return this; }
  expiresAt(ms: number): this { this.s._expiresAt = ms; return this; }
  triggerContext(ctx: EpisodicMemoryRecord['triggerContext']): this { this.s._triggerContext = ctx; return this; }
  addCallbackVariant(variant: EpisodicMemoryRecord['callbackVariants'][number]): this {
    this.s._callbackVariants = [...this.s._callbackVariants, variant];
    return this;
  }

  build(): EpisodicMemoryRecord {
    const nowMs = Date.now();
    if (!this.s._memoryId) throw new Error('memoryId is required');
    if (!this.s._eventType) throw new Error('eventType is required');
    if (!this.s._triggerContext) throw new Error('triggerContext is required');
    return Object.freeze({
      memoryId: this.s._memoryId,
      playerId: this.s._playerId ?? null,
      botId: this.s._botId ?? null,
      counterpartId: this.s._counterpartId ?? null,
      eventType: this.s._eventType,
      triggerContext: this.s._triggerContext,
      salience01: this.s._salience01 ?? 0.5,
      emotionalWeight01: this.s._emotionalWeight01 ?? 0.5,
      strategicWeight01: this.s._strategicWeight01 ?? 0.5,
      embarrassmentRisk01: this.s._embarrassmentRisk01 ?? 0.0,
      callbackVariants: Object.freeze(this.s._callbackVariants),
      createdAt: this.s._createdAt ?? nowMs,
      timesReused: 0,
      unresolved: this.s._unresolved ?? false,
      expiresAt: this.s._expiresAt,
      status: this.s._status ?? 'ACTIVE',
    });
  }
}

/** Convenience factory for MemoryRecordBuilder. */
export function buildMemoryRecord(): MemoryRecordBuilder {
  return new MemoryRecordBuilder();
}

/** Check if a memory has expired at a given point in time. */
export function isMemoryExpired(record: EpisodicMemoryRecord, nowMs: number = Date.now()): boolean {
  return record.expiresAt != null && record.expiresAt <= nowMs;
}

/** Compute how many callback variants a set of records has in total. */
export function countTotalCallbackVariants(records: readonly EpisodicMemoryRecord[]): number {
  return records.reduce((s, r) => s + r.callbackVariants.length, 0);
}

/** Find the memory with the highest salience in a set. */
export function findPeakSalienceMemory(
  records: readonly EpisodicMemoryRecord[],
): EpisodicMemoryRecord | null {
  if (records.length === 0) return null;
  return records.reduce((max, r) => r.salience01 > max.salience01 ? r : max, records[0]);
}

/** Normalize all saliencies in a set to a max of 1.0 based on the peak. */
export function normalizeSaliences(
  records: readonly EpisodicMemoryRecord[],
): readonly EpisodicMemoryRecord[] {
  const peak = findPeakSalienceMemory(records);
  if (!peak || peak.salience01 === 0) return records;
  const scale = 1 / peak.salience01;
  return Object.freeze(
    records.map((r) => ({
      ...r,
      salience01: clamp01(r.salience01 * scale),
    })),
  );
}
