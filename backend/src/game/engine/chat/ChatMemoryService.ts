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
}
