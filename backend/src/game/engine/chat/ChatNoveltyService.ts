/**
 * Durable novelty ledger persistence and candidate ranking.
 */
import type {
  NoveltyCandidateDescriptor,
  NoveltyCandidateScoreBreakdown,
  NoveltyEventRecord,
  NoveltyFacet,
  NoveltyFacetCounter,
  NoveltyFatigueSnapshot,
  NoveltyLedgerSnapshot,
  NoveltyRankingRequest,
  NoveltyRankingResult,
  NoveltyScope,
} from '../../../../../shared/contracts/chat/novelty';
import { DEFAULT_NOVELTY_WINDOWS, clamp01 } from '../../../../../shared/contracts/chat/novelty';

export interface ChatNoveltyServiceConfig {
  readonly recentEventLimit: number;
  readonly fatigueWindowSize: number;
}

export const DEFAULT_CHAT_NOVELTY_SERVICE_CONFIG: ChatNoveltyServiceConfig = Object.freeze({
  recentEventLimit: 4096,
  fatigueWindowSize: 96,
});

interface PlayerNoveltyBucket {
  readonly playerId: string;
  updatedAt: number;
  seasonId?: string | null;
  events: NoveltyEventRecord[];
}

function now(): number { return Date.now(); }
function keyOf(facet: NoveltyFacet, key: string): string { return `${facet}:${key}`; }

export class ChatNoveltyService {
  private readonly config: ChatNoveltyServiceConfig;
  private readonly players = new Map<string, PlayerNoveltyBucket>();

  public constructor(config: Partial<ChatNoveltyServiceConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_CHAT_NOVELTY_SERVICE_CONFIG, ...config });
  }

  private ensure(playerId: string): PlayerNoveltyBucket {
    const existing = this.players.get(playerId);
    if (existing) return existing;
    const bucket: PlayerNoveltyBucket = { playerId, updatedAt: now(), events: [] };
    this.players.set(playerId, bucket);
    return bucket;
  }

  public recordEvent(playerId: string, event: NoveltyEventRecord): NoveltyEventRecord {
    const bucket = this.ensure(playerId);
    bucket.events.unshift(event);
    bucket.events = bucket.events.slice(0, this.config.recentEventLimit);
    bucket.updatedAt = now();
    return event;
  }

  public rank(request: NoveltyRankingRequest): NoveltyRankingResult {
    const bucket = this.ensure(request.playerId ?? 'GLOBAL');
    const fatigue = this.computeFatigue(bucket, request.channelId ?? 'GLOBAL');
    const rankedCandidates = request.candidates
      .map((candidate) => this.scoreCandidate(bucket, fatigue, candidate))
      .sort((a, b) => b.noveltyScore01 - a.noveltyScore01 || a.candidateId.localeCompare(b.candidateId));

    return {
      requestId: request.requestId,
      rankedCandidates,
      recommendedCandidateId: rankedCandidates[0]?.candidateId,
      computedAt: request.createdAt,
    };
  }

  public getSnapshot(playerId: string): NoveltyLedgerSnapshot {
    const bucket = this.ensure(playerId);
    const counters = this.computeCounters(bucket);
    const fatigueByChannel = this.computeAllFatigue(bucket);
    const uniqueLines = new Set(bucket.events.map((event) => event.lineId).filter(Boolean));
    const uniqueMotifs = new Set(bucket.events.flatMap((event) => event.motifIds));
    const uniqueRhetoricalForms = new Set(bucket.events.flatMap((event) => event.rhetoricalForms));
    const uniqueSemanticClusters = new Set(bucket.events.flatMap((event) => event.semanticClusterIds));
    return {
      createdAt: bucket.events.at(-1)?.occurredAt ?? now(),
      updatedAt: bucket.updatedAt,
      playerId,
      seasonId: bucket.seasonId,
      counters,
      recentEvents: bucket.events,
      fatigueByChannel,
      totalEvents: bucket.events.length,
      totalUniqueLines: uniqueLines.size,
      totalUniqueMotifs: uniqueMotifs.size,
      totalUniqueRhetoricalForms: uniqueRhetoricalForms.size,
      totalUniqueSemanticClusters: uniqueSemanticClusters.size,
    };
  }

  private scoreCandidate(bucket: PlayerNoveltyBucket, fatigue: NoveltyFatigueSnapshot, candidate: NoveltyCandidateDescriptor): NoveltyCandidateScoreBreakdown {
    let exactLinePenalty = 0;
    let motifPenalty = 0;
    let rhetoricPenalty = 0;
    let semanticPenalty = 0;
    let pressurePenalty = 0;
    let scenePenalty = 0;
    let channelPenalty = 0;
    let counterpartPenalty = 0;
    let callbackPenalty = 0;
    let tagPenalty = 0;
    let freshnessBoost = 0.08;
    let unseenFacetBoost = 0;
    const notes: string[] = [];

    for (const policy of DEFAULT_NOVELTY_WINDOWS) {
      const events = bucket.events.filter((event) => bucket.updatedAt - event.occurredAt <= policy.lookbackMs);
      if (candidate.lineId && events.some((event) => event.lineId === candidate.lineId)) exactLinePenalty += policy.exactRepeatPenalty;
      if (candidate.motifIds?.length) motifPenalty += policy.motifPenalty * candidate.motifIds.filter((motif) => events.some((event) => event.motifIds.includes(motif))).length;
      if (candidate.rhetoricalForms?.length) rhetoricPenalty += policy.rhetoricPenalty * candidate.rhetoricalForms.filter((form) => events.some((event) => event.rhetoricalForms.includes(form))).length;
      if (candidate.semanticClusterIds?.length) semanticPenalty += policy.semanticPenalty * candidate.semanticClusterIds.filter((cluster) => events.some((event) => event.semanticClusterIds.includes(cluster))).length;
      if (candidate.callbackSourceIds?.length) callbackPenalty += policy.callbackPenalty * candidate.callbackSourceIds.filter((id) => events.some((event) => event.callbackSourceIds.includes(id))).length;
    }

    if (candidate.pressureBand && bucket.events.slice(0, 18).some((event) => event.pressureBand === candidate.pressureBand)) pressurePenalty += 0.08;
    if (candidate.sceneRoles?.some((role) => fatigue.dominantRhetoricalForms.includes(role))) scenePenalty += 0.06;
    if (candidate.channelId && bucket.events.slice(0, 24).filter((event) => event.channelId === candidate.channelId).length > 10) channelPenalty += 0.05;
    if (candidate.counterpartId && fatigue.recentCounterparts.includes(candidate.counterpartId)) counterpartPenalty += 0.06;
    if (candidate.tags?.length) tagPenalty += candidate.tags.filter((tag) => fatigue.dominantMotifs.includes(tag)).length * 0.03;

    if (candidate.lineId && !bucket.events.some((event) => event.lineId === candidate.lineId)) unseenFacetBoost += 0.12;
    if (candidate.semanticClusterIds?.every((cluster) => !bucket.events.some((event) => event.semanticClusterIds.includes(cluster)))) unseenFacetBoost += 0.10;
    if (candidate.rhetoricalForms?.every((form) => !bucket.events.some((event) => event.rhetoricalForms.includes(form)))) unseenFacetBoost += 0.08;

    const penaltyTotal = exactLinePenalty + motifPenalty + rhetoricPenalty + semanticPenalty + pressurePenalty + scenePenalty + channelPenalty + counterpartPenalty + callbackPenalty + tagPenalty;
    const noveltyScore01 = clamp01(1 - penaltyTotal + freshnessBoost + unseenFacetBoost - fatigue.fatigue01 * 0.25);
    if (exactLinePenalty > 0) notes.push('exact_line_seen_recently');
    if (semanticPenalty > 0) notes.push('semantic_cluster_seen_recently');
    if (rhetoricPenalty > 0) notes.push('rhetorical_form_seen_recently');

    return {
      candidateId: candidate.candidateId,
      noveltyScore01,
      penaltyTotal,
      exactLinePenalty,
      motifPenalty,
      rhetoricPenalty,
      semanticPenalty,
      pressurePenalty,
      scenePenalty,
      channelPenalty,
      counterpartPenalty,
      callbackPenalty,
      tagPenalty,
      freshnessBoost,
      unseenFacetBoost,
      fatigueRisk: fatigue.fatigue01,
      notes,
    };
  }

  private computeCounters(bucket: PlayerNoveltyBucket): readonly NoveltyFacetCounter[] {
    const counters = new Map<string, NoveltyFacetCounter>();
    const increment = (facet: NoveltyFacet, rawKey: string | undefined, event: NoveltyEventRecord) => {
      if (!rawKey) return;
      const key = keyOf(facet, rawKey);
      const current = counters.get(key);
      const age = now() - event.occurredAt;
      const scopeHit = (scope: NoveltyScope): boolean => {
        switch (scope) {
          case 'SESSION': return age <= 6 * 60 * 60 * 1000;
          case 'DAY': return age <= 24 * 60 * 60 * 1000;
          case 'WEEK': return age <= 7 * 24 * 60 * 60 * 1000;
          case 'SEASON': return age <= 90 * 24 * 60 * 60 * 1000;
          case 'CAREER': return true;
        }
      };
      const next: NoveltyFacetCounter = current ? {
        ...current,
        lastSeenAt: Math.max(current.lastSeenAt, event.occurredAt),
        totalSeen: current.totalSeen + 1,
        sessionSeen: current.sessionSeen + Number(scopeHit('SESSION')),
        daySeen: current.daySeen + Number(scopeHit('DAY')),
        weekSeen: current.weekSeen + Number(scopeHit('WEEK')),
        seasonSeen: current.seasonSeen + Number(scopeHit('SEASON')),
        careerSeen: current.careerSeen + 1,
      } : {
        key: rawKey,
        facet,
        firstSeenAt: event.occurredAt,
        lastSeenAt: event.occurredAt,
        totalSeen: 1,
        sessionSeen: Number(scopeHit('SESSION')),
        daySeen: Number(scopeHit('DAY')),
        weekSeen: Number(scopeHit('WEEK')),
        seasonSeen: Number(scopeHit('SEASON')),
        careerSeen: 1,
      };
      counters.set(key, next);
    };

    for (const event of bucket.events) {
      increment('LINE', event.lineId ?? undefined, event);
      increment('COUNTERPART', event.counterpartId ?? undefined, event);
      increment('PRESSURE_BAND', event.pressureBand ?? undefined, event);
      for (const key of event.motifIds) increment('MOTIF', key, event);
      for (const key of event.rhetoricalForms) increment('RHETORICAL_FORM', key, event);
      for (const key of event.sceneRoles) increment('SCENE_ROLE', key, event);
      for (const key of event.semanticClusterIds) increment('SEMANTIC_CLUSTER', key, event);
      for (const key of event.callbackSourceIds) increment('CALLBACK_SOURCE', key, event);
      for (const key of event.tags) increment('TAG', key, event);
    }
    return [...counters.values()].sort((a, b) => b.totalSeen - a.totalSeen || a.key.localeCompare(b.key));
  }

  private computeFatigue(bucket: PlayerNoveltyBucket, channelId: string): NoveltyFatigueSnapshot {
    const recent = bucket.events.filter((event) => event.channelId === channelId).slice(0, this.config.fatigueWindowSize);
    const top = (items: string[]) => Object.entries(items.reduce<Record<string, number>>((acc, item) => ((acc[item] = (acc[item] ?? 0) + 1), acc), {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key]) => key);
    return {
      channelId,
      fatigue01: clamp01(Math.min(recent.length / this.config.fatigueWindowSize, 1) * 0.4 + top(recent.flatMap((e) => e.semanticClusterIds)).length * 0.05),
      lastUpdatedAt: bucket.updatedAt,
      dominantMotifs: top(recent.flatMap((event) => event.motifIds)),
      dominantRhetoricalForms: top(recent.flatMap((event) => event.rhetoricalForms)),
      dominantSemanticClusters: top(recent.flatMap((event) => event.semanticClusterIds)),
      recentExactLines: recent.map((event) => event.lineId ?? '').filter(Boolean).slice(0, 12),
      recentCounterparts: recent.map((event) => event.counterpartId ?? '').filter(Boolean).slice(0, 12),
    };
  }

  private computeAllFatigue(bucket: PlayerNoveltyBucket): readonly NoveltyFatigueSnapshot[] {
    const channels = [...new Set(bucket.events.map((event) => event.channelId).filter(Boolean))] as string[];
    return channels.map((channelId) => this.computeFatigue(bucket, channelId));
  }

  /** Set the active season ID for a player. */
  public setSeasonId(playerId: string, seasonId: string | null): void {
    const bucket = this.ensure(playerId);
    bucket.seasonId = seasonId;
  }

  /** Return all player IDs being tracked. */
  public getPlayerIds(): readonly string[] {
    return Object.freeze([...this.players.keys()]);
  }

  /** Return total events recorded for a player. */
  public eventCount(playerId: string): number {
    return this.ensure(playerId).events.length;
  }

  /** Clear all events for a player. */
  public clearPlayer(playerId: string): void {
    const bucket = this.ensure(playerId);
    bucket.events = [];
    bucket.updatedAt = now();
  }

  /** Export all event records for a player. */
  public exportPlayer(playerId: string): NoveltyPlayerExport {
    const bucket = this.ensure(playerId);
    return Object.freeze({
      playerId,
      exportedAt: now(),
      seasonId: bucket.seasonId ?? null,
      events: Object.freeze([...bucket.events]),
    });
  }

  /** Import event records for a player. */
  public importPlayer(exported: NoveltyPlayerExport): void {
    const bucket = this.ensure(exported.playerId);
    bucket.seasonId = exported.seasonId ?? undefined;
    for (const event of exported.events) {
      if (!bucket.events.some((e) => e.eventId === event.eventId)) {
        bucket.events.push(event);
      }
    }
    bucket.events = bucket.events
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, this.config.recentEventLimit);
    bucket.updatedAt = exported.exportedAt;
  }

  /** Build analytics for a player. */
  public buildAnalytics(playerId: string): NoveltyAnalytics {
    return buildNoveltyAnalytics(playerId, this.ensure(playerId));
  }

  /** Build facet frequency report. */
  public buildFacetFrequency(playerId: string): NoveltyFacetFrequencyReport {
    const snapshot = this.getSnapshot(playerId);
    return buildFacetFrequencyReport(snapshot.counters);
  }

  /** Compute novelty pressure score for a player — how saturated are they? */
  public computePressure(playerId: string, channelId: string = 'GLOBAL'): NoveltyPressureScore {
    const bucket = this.ensure(playerId);
    const fatigue = this.computeFatigue(bucket, channelId);
    return computeNoveltyPressure(playerId, bucket.events, fatigue, channelId);
  }

  /** Find events from the last N milliseconds. */
  public getRecentEvents(playerId: string, windowMs: number): readonly NoveltyEventRecord[] {
    const bucket = this.ensure(playerId);
    const cutoff = now() - windowMs;
    return Object.freeze(bucket.events.filter((e) => e.occurredAt >= cutoff));
  }

  /** Find events by channel. */
  public getEventsByChannel(playerId: string, channelId: string): readonly NoveltyEventRecord[] {
    const bucket = this.ensure(playerId);
    return Object.freeze(bucket.events.filter((e) => e.channelId === channelId));
  }

  /** Get the top N unique lines seen most recently. */
  public getTopRecentLines(playerId: string, n: number = 10): readonly string[] {
    const bucket = this.ensure(playerId);
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const event of bucket.events) {
      if (event.lineId && !seen.has(event.lineId)) {
        seen.add(event.lineId);
        lines.push(event.lineId);
        if (lines.length >= n) break;
      }
    }
    return Object.freeze(lines);
  }

  /** Compute cross-channel fatigue summary. */
  public getAllFatigue(playerId: string): readonly NoveltyFatigueSnapshot[] {
    const bucket = this.ensure(playerId);
    return this.computeAllFatigue(bucket);
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface NoveltyPlayerExport {
  readonly playerId: string;
  readonly exportedAt: number;
  readonly seasonId: string | null;
  readonly events: readonly NoveltyEventRecord[];
}

export interface NoveltyAnalytics {
  readonly playerId: string;
  readonly generatedAt: number;
  readonly totalEvents: number;
  readonly uniqueLineCount: number;
  readonly uniqueMotifCount: number;
  readonly uniqueRhetoricalFormCount: number;
  readonly uniqueSemanticClusterCount: number;
  readonly dominantFacet: NoveltyFacet | null;
  readonly avgFatigue01: number;
  readonly saturationLabel: 'FRESH' | 'BUILDING' | 'SATURATED' | 'STALE';
}

export interface NoveltyFacetFrequencyEntry {
  readonly facet: NoveltyFacet;
  readonly totalCount: number;
  readonly careerCount: number;
  readonly weekCount: number;
  readonly sessionCount: number;
}

export type NoveltyFacetFrequencyReport = readonly NoveltyFacetFrequencyEntry[];

export interface NoveltyPressureScore {
  readonly playerId: string;
  readonly channelId: string;
  readonly pressureScore01: number;
  readonly fatigueContribution01: number;
  readonly saturationContribution01: number;
  readonly pressureLabel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

// ============================================================================
// ANALYTICS FUNCTIONS
// ============================================================================

function buildNoveltyAnalytics(playerId: string, bucket: PlayerNoveltyBucket): NoveltyAnalytics {
  const events = bucket.events;
  const uniqueLines = new Set(events.map((e) => e.lineId).filter(Boolean));
  const uniqueMotifs = new Set(events.flatMap((e) => e.motifIds));
  const uniqueRhetoricalForms = new Set(events.flatMap((e) => e.rhetoricalForms));
  const uniqueSemanticClusters = new Set(events.flatMap((e) => e.semanticClusterIds));

  const facetCounts: Partial<Record<NoveltyFacet, number>> = {};
  for (const e of events) {
    for (const motif of e.motifIds) {
      facetCounts['MOTIF'] = (facetCounts['MOTIF'] ?? 0) + 1;
    }
    for (const rf of e.rhetoricalForms) {
      facetCounts['RHETORICAL_FORM'] = (facetCounts['RHETORICAL_FORM'] ?? 0) + 1;
    }
    facetCounts['LINE'] = (facetCounts['LINE'] ?? 0) + (e.lineId ? 1 : 0);
    facetCounts['TAG'] = (facetCounts['TAG'] ?? 0) + e.tags.length;
  }

  let dominantFacet: NoveltyFacet | null = null;
  let maxCount = 0;
  for (const [facet, count] of Object.entries(facetCounts) as [NoveltyFacet, number][]) {
    if (count > maxCount) { maxCount = count; dominantFacet = facet; }
  }

  const avgFatigue01 = clamp01(Math.min(events.length / bucket.events.length, 1) * 0.7);

  const saturationLabel: NoveltyAnalytics['saturationLabel'] =
    uniqueLines.size >= 200 ? 'STALE' :
    uniqueLines.size >= 100 ? 'SATURATED' :
    uniqueLines.size >= 30 ? 'BUILDING' : 'FRESH';

  return Object.freeze({
    playerId,
    generatedAt: now(),
    totalEvents: events.length,
    uniqueLineCount: uniqueLines.size,
    uniqueMotifCount: uniqueMotifs.size,
    uniqueRhetoricalFormCount: uniqueRhetoricalForms.size,
    uniqueSemanticClusterCount: uniqueSemanticClusters.size,
    dominantFacet,
    avgFatigue01,
    saturationLabel,
  });
}

function buildFacetFrequencyReport(counters: readonly NoveltyFacetCounter[]): NoveltyFacetFrequencyReport {
  const facetGroups = new Map<NoveltyFacet, NoveltyFacetCounter[]>();
  for (const counter of counters) {
    if (!facetGroups.has(counter.facet)) facetGroups.set(counter.facet, []);
    facetGroups.get(counter.facet)!.push(counter);
  }

  const entries: NoveltyFacetFrequencyEntry[] = [];
  for (const [facet, group] of facetGroups) {
    const totalCount = group.reduce((s, c) => s + c.totalSeen, 0);
    const careerCount = group.reduce((s, c) => s + c.careerSeen, 0);
    const weekCount = group.reduce((s, c) => s + c.weekSeen, 0);
    const sessionCount = group.reduce((s, c) => s + c.sessionSeen, 0);
    entries.push(Object.freeze({ facet, totalCount, careerCount, weekCount, sessionCount }));
  }
  return Object.freeze(entries.sort((a, b) => b.totalCount - a.totalCount));
}

function computeNoveltyPressure(
  playerId: string,
  events: readonly NoveltyEventRecord[],
  fatigue: NoveltyFatigueSnapshot,
  channelId: string,
): NoveltyPressureScore {
  const fatigueContribution01 = fatigue.fatigue01;
  const channelEvents = events.filter((e) => e.channelId === channelId);
  const saturationContribution01 = clamp01(channelEvents.length / 100);
  const pressureScore01 = clamp01(
    fatigueContribution01 * 0.60 +
    saturationContribution01 * 0.40,
  );
  const pressureLabel: NoveltyPressureScore['pressureLabel'] =
    pressureScore01 >= 0.80 ? 'CRITICAL' :
    pressureScore01 >= 0.55 ? 'HIGH' :
    pressureScore01 >= 0.30 ? 'MODERATE' : 'LOW';
  return Object.freeze({
    playerId,
    channelId,
    pressureScore01,
    fatigueContribution01,
    saturationContribution01,
    pressureLabel,
  });
}

// ============================================================================
// NOVELTY DECAY MANAGER — Fade old events from the scoring window
// ============================================================================

export interface NoveltyDecayResult {
  readonly playerId: string;
  readonly eventsBeforeDecay: number;
  readonly eventsAfterDecay: number;
  readonly removedCount: number;
}

export function applyNoveltyEventDecay(
  playerId: string,
  events: NoveltyEventRecord[],
  retentionWindowMs: number = 7 * 24 * 60 * 60 * 1000,
  nowMs: number = Date.now(),
): NoveltyDecayResult {
  const cutoff = nowMs - retentionWindowMs;
  const before = events.length;
  const filtered = events.filter((e) => e.occurredAt >= cutoff);
  events.splice(0, events.length, ...filtered);
  return Object.freeze({
    playerId,
    eventsBeforeDecay: before,
    eventsAfterDecay: filtered.length,
    removedCount: before - filtered.length,
  });
}

// ============================================================================
// NOVELTY CANDIDATE BATCH RANKER — Batch-rank for multiple players at once
// ============================================================================

export interface BatchNoveltyRankingResult {
  readonly playerId: string;
  readonly result: NoveltyRankingResult;
}

export function batchRankNovelty(
  service: ChatNoveltyService,
  requests: readonly NoveltyRankingRequest[],
): readonly BatchNoveltyRankingResult[] {
  return Object.freeze(
    requests.map((request) => ({
      playerId: request.playerId ?? 'GLOBAL',
      result: service.rank(request),
    })),
  );
}

// ============================================================================
// NOVELTY HEATMAP — Per-facet saturation scores across players
// ============================================================================

export interface NoveltyFacetHeatMapEntry {
  readonly facet: NoveltyFacet;
  readonly avgSaturation01: number;
  readonly peakSaturation01: number;
  readonly playerCount: number;
  readonly heatLabel: 'COLD' | 'WARM' | 'HOT' | 'BLAZING';
}

export function buildNoveltyFacetHeatMap(
  snapshots: readonly NoveltyLedgerSnapshot[],
): readonly NoveltyFacetHeatMapEntry[] {
  const facets: NoveltyFacet[] = ['LINE', 'MOTIF', 'RHETORICAL_FORM', 'SEMANTIC_CLUSTER', 'SCENE_ROLE', 'CALLBACK_SOURCE', 'TAG', 'COUNTERPART', 'PRESSURE_BAND'];
  return Object.freeze(facets.map((facet) => {
    const facetCounters = snapshots.flatMap((s) =>
      s.counters.filter((c) => c.facet === facet),
    );
    const saturations = facetCounters.map((c) => clamp01(c.totalSeen / 50));
    const avgSaturation01 = saturations.length > 0
      ? saturations.reduce((s, v) => s + v, 0) / saturations.length
      : 0;
    const peakSaturation01 = saturations.length > 0 ? Math.max(...saturations) : 0;
    const playerCount = snapshots.filter((s) =>
      s.counters.some((c) => c.facet === facet),
    ).length;
    const heatLabel: NoveltyFacetHeatMapEntry['heatLabel'] =
      avgSaturation01 >= 0.75 ? 'BLAZING' :
      avgSaturation01 >= 0.50 ? 'HOT' :
      avgSaturation01 >= 0.25 ? 'WARM' : 'COLD';
    return Object.freeze({ facet, avgSaturation01, peakSaturation01, playerCount, heatLabel });
  }));
}

// ============================================================================
// NOVELTY WATCH BUS — Observer for novelty events
// ============================================================================

export type NoveltyWatchEvent =
  | { type: 'EVENT_RECORDED'; playerId: string; event: NoveltyEventRecord }
  | { type: 'PLAYER_CLEARED'; playerId: string }
  | { type: 'SEASON_CHANGED'; playerId: string; seasonId: string | null }
  | { type: 'DECAY_APPLIED'; playerId: string; removedCount: number };

export type NoveltyWatcher = (event: NoveltyWatchEvent) => void;

export class NoveltyWatchBus {
  private readonly watchers: Set<NoveltyWatcher> = new Set();

  subscribe(watcher: NoveltyWatcher): () => void {
    this.watchers.add(watcher);
    return () => this.watchers.delete(watcher);
  }

  emit(event: NoveltyWatchEvent): void {
    for (const w of this.watchers) {
      try { w(event); } catch { /* watchers must not throw */ }
    }
  }

  subscriberCount(): number { return this.watchers.size; }
  clear(): void { this.watchers.clear(); }
}

// ============================================================================
// NOVELTY SNAPSHOT DIFF
// ============================================================================

export interface NoveltySnapshotDiff {
  readonly newEventCount: number;
  readonly newUniqueLinesCount: number;
  readonly fatigueByChannelDelta: Readonly<Record<string, number>>;
  readonly totalEventsDelta: number;
}

export function diffNoveltySnapshots(
  before: NoveltyLedgerSnapshot,
  after: NoveltyLedgerSnapshot,
): NoveltySnapshotDiff {
  const newEventCount = after.totalEvents - before.totalEvents;
  const newUniqueLinesCount = after.totalUniqueLines - before.totalUniqueLines;

  const beforeFatigue = new Map(before.fatigueByChannel.map((f) => [f.channelId, f.fatigue01]));
  const afterFatigue = new Map(after.fatigueByChannel.map((f) => [f.channelId, f.fatigue01]));
  const fatigueByChannelDelta: Record<string, number> = {};
  for (const [channelId, afterVal] of afterFatigue) {
    fatigueByChannelDelta[channelId] = afterVal - (beforeFatigue.get(channelId) ?? 0);
  }

  return Object.freeze({
    newEventCount,
    newUniqueLinesCount,
    fatigueByChannelDelta: Object.freeze(fatigueByChannelDelta),
    totalEventsDelta: after.totalEvents - before.totalEvents,
  });
}

// ============================================================================
// NOVELTY SCORE NORMALIZER — Normalize scores across a candidate set
// ============================================================================

export function normalizeNoveltyScores(
  breakdowns: readonly NoveltyCandidateScoreBreakdown[],
): readonly (NoveltyCandidateScoreBreakdown & { normalizedScore01: number })[] {
  if (breakdowns.length === 0) return Object.freeze([]);
  const maxScore = Math.max(...breakdowns.map((b) => b.noveltyScore01));
  if (maxScore === 0) return Object.freeze(breakdowns.map((b) => ({ ...b, normalizedScore01: 0 })));
  return Object.freeze(
    breakdowns.map((b) => Object.freeze({
      ...b,
      normalizedScore01: clamp01(b.noveltyScore01 / maxScore),
    })),
  );
}

// ============================================================================
// NOVELTY TRAJECTORY — Detect novelty velocity over time
// ============================================================================

export interface NoveltyTrajectoryReport {
  readonly playerId: string;
  readonly periodMs: number;
  readonly recentEventCount: number;
  readonly olderEventCount: number;
  readonly velocityDelta: number;
  readonly trajectoryLabel: 'ACCELERATING' | 'STEADY' | 'DECELERATING' | 'STALLED';
}

export function computeNoveltyTrajectory(
  playerId: string,
  events: readonly NoveltyEventRecord[],
  periodMs: number = 6 * 60 * 60 * 1000,
  nowMs: number = Date.now(),
): NoveltyTrajectoryReport {
  const playerEvents = events.filter((e) => e.playerId === playerId);
  const recent = playerEvents.filter((e) => nowMs - e.occurredAt <= periodMs);
  const older = playerEvents.filter((e) => {
    const age = nowMs - e.occurredAt;
    return age > periodMs && age <= periodMs * 2;
  });
  const velocityDelta = recent.length - older.length;
  const trajectoryLabel: NoveltyTrajectoryReport['trajectoryLabel'] =
    velocityDelta >= 3 ? 'ACCELERATING' :
    velocityDelta <= -3 ? 'DECELERATING' :
    recent.length === 0 ? 'STALLED' : 'STEADY';
  return Object.freeze({
    playerId,
    periodMs,
    recentEventCount: recent.length,
    olderEventCount: older.length,
    velocityDelta,
    trajectoryLabel,
  });
}

// ============================================================================
// NOVELTY CROSS-PLAYER COMPARISON
// ============================================================================

export interface NoveltyPlayerComparison {
  readonly playerIdA: string;
  readonly playerIdB: string;
  readonly sharedMotifs: readonly string[];
  readonly sharedSemanticClusters: readonly string[];
  readonly sharedExactLines: readonly string[];
  readonly overlapScore01: number;
  readonly comparisonLabel: 'IDENTICAL' | 'HIGH_OVERLAP' | 'MODERATE_OVERLAP' | 'DIVERGENT';
}

export function compareNoveltyProfiles(
  snapshotA: NoveltyLedgerSnapshot,
  snapshotB: NoveltyLedgerSnapshot,
): NoveltyPlayerComparison {
  const motifsA = new Set(snapshotA.counters.filter((c) => c.facet === 'MOTIF').map((c) => c.key));
  const motifsB = new Set(snapshotB.counters.filter((c) => c.facet === 'MOTIF').map((c) => c.key));
  const sharedMotifs = [...motifsA].filter((m) => motifsB.has(m));

  const clustersA = new Set(snapshotA.counters.filter((c) => c.facet === 'SEMANTIC_CLUSTER').map((c) => c.key));
  const clustersB = new Set(snapshotB.counters.filter((c) => c.facet === 'SEMANTIC_CLUSTER').map((c) => c.key));
  const sharedSemanticClusters = [...clustersA].filter((c) => clustersB.has(c));

  const linesA = new Set(snapshotA.counters.filter((c) => c.facet === 'LINE').map((c) => c.key));
  const linesB = new Set(snapshotB.counters.filter((c) => c.facet === 'LINE').map((c) => c.key));
  const sharedExactLines = [...linesA].filter((l) => linesB.has(l));

  const totalUnique = new Set([...motifsA, ...motifsB, ...clustersA, ...clustersB]).size;
  const totalShared = sharedMotifs.length + sharedSemanticClusters.length;
  const overlapScore01 = totalUnique > 0 ? clamp01(totalShared / totalUnique) : 0;

  const comparisonLabel: NoveltyPlayerComparison['comparisonLabel'] =
    overlapScore01 >= 0.85 ? 'IDENTICAL' :
    overlapScore01 >= 0.55 ? 'HIGH_OVERLAP' :
    overlapScore01 >= 0.25 ? 'MODERATE_OVERLAP' : 'DIVERGENT';

  return Object.freeze({
    playerIdA: snapshotA.playerId ?? '',
    playerIdB: snapshotB.playerId ?? '',
    sharedMotifs: Object.freeze(sharedMotifs),
    sharedSemanticClusters: Object.freeze(sharedSemanticClusters),
    sharedExactLines: Object.freeze(sharedExactLines),
    overlapScore01,
    comparisonLabel,
  });
}

// ============================================================================
// MODULE CONSTANTS
// ============================================================================

export const CHAT_NOVELTY_MODULE_NAME = 'chat-novelty' as const;
export const CHAT_NOVELTY_MODULE_VERSION = '2026.03.23.v2' as const;

export const CHAT_NOVELTY_LAWS = Object.freeze([
  'Novelty scores must be bounded to [0, 1] at all times.',
  'Penalty accumulation never drives a score below 0.',
  'Fatigue snapshots are channel-scoped — global fatigue is computed separately.',
  'Facet counters must track session, day, week, season, and career independently.',
  'Event trimming is applied on every recordEvent call — no unbounded growth.',
  'Decay removes old events — it does not modify existing event records.',
  'Cross-player novelty comparison is read-only — no mutation of either profile.',
]);

export const CHAT_NOVELTY_DEFAULTS = Object.freeze({
  recentEventLimit: DEFAULT_CHAT_NOVELTY_SERVICE_CONFIG.recentEventLimit,
  fatigueWindowSize: DEFAULT_CHAT_NOVELTY_SERVICE_CONFIG.fatigueWindowSize,
  defaultRetentionWindowMs: 7 * 24 * 60 * 60 * 1000,
  defaultMaxCandidates: 8,
});

export const CHAT_NOVELTY_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_NOVELTY_MODULE_NAME,
  version: CHAT_NOVELTY_MODULE_VERSION,
  laws: CHAT_NOVELTY_LAWS,
  defaults: CHAT_NOVELTY_DEFAULTS,
  facets: ['LINE', 'MOTIF', 'RHETORICAL_FORM', 'SEMANTIC_CLUSTER', 'SCENE_ROLE', 'CALLBACK_SOURCE', 'TAG', 'COUNTERPART', 'PRESSURE_BAND'] as NoveltyFacet[],
  scopes: ['SESSION', 'DAY', 'WEEK', 'SEASON', 'CAREER'] as NoveltyScope[],
});

/** Factory function for ChatNoveltyService. */
export function createChatNoveltyService(
  config?: Partial<ChatNoveltyServiceConfig>,
): ChatNoveltyService {
  return new ChatNoveltyService(config);
}

/** Check if a candidate is fully novel (no penalties applied). */
export function isCandidateFullyNovel(breakdown: NoveltyCandidateScoreBreakdown): boolean {
  return breakdown.penaltyTotal === 0 && breakdown.exactLinePenalty === 0;
}

/** Sort candidates by novelty score descending. */
export function sortCandidatesByNovelty(
  breakdowns: readonly NoveltyCandidateScoreBreakdown[],
): readonly NoveltyCandidateScoreBreakdown[] {
  return Object.freeze([...breakdowns].sort((a, b) => b.noveltyScore01 - a.noveltyScore01));
}

/** Return only candidates above a minimum novelty threshold. */
export function filterHighNovelty(
  breakdowns: readonly NoveltyCandidateScoreBreakdown[],
  minScore01: number = 0.60,
): readonly NoveltyCandidateScoreBreakdown[] {
  return Object.freeze(breakdowns.filter((b) => b.noveltyScore01 >= minScore01));
}

/** Compute the average novelty score across a set of candidates. */
export function averageNoveltyScore(
  breakdowns: readonly NoveltyCandidateScoreBreakdown[],
): number {
  if (breakdowns.length === 0) return 0;
  return clamp01(
    breakdowns.reduce((s, b) => s + b.noveltyScore01, 0) / breakdowns.length,
  );
}

/** Build a trace string for a novelty ranking result. */
export function traceNoveltyResult(result: NoveltyRankingResult): string {
  const topScore = result.rankedCandidates[0]?.noveltyScore01?.toFixed(3) ?? 'N/A';
  return `[NOVELTY top=${result.recommendedCandidateId ?? 'NONE'} score=${topScore} candidates=${result.rankedCandidates.length}]`;
}

// ============================================================================
// NOVELTY EVENT BUILDER — Fluent builder for NoveltyEventRecord
// ============================================================================

interface MutableNoveltyEventState {
  _eventId?: string;
  _playerId?: string | null;
  _channelId?: string | null;
  _counterpartId?: string | null;
  _lineId?: string | null;
  _occurredAt?: number;
  _motifIds: string[];
  _rhetoricalForms: string[];
  _sceneRoles: string[];
  _semanticClusterIds: string[];
  _callbackSourceIds: string[];
  _tags: string[];
  _pressureBand?: NoveltyEventRecord['pressureBand'];
  _seasonId?: string | null;
}

export class NoveltyEventBuilder {
  private readonly s: MutableNoveltyEventState = {
    _motifIds: [],
    _rhetoricalForms: [],
    _sceneRoles: [],
    _semanticClusterIds: [],
    _callbackSourceIds: [],
    _tags: [],
  };

  eventId(id: string): this { this.s._eventId = id; return this; }
  playerId(id: string | null): this { this.s._playerId = id; return this; }
  channelId(id: string | null): this { this.s._channelId = id; return this; }
  counterpartId(id: string | null): this { this.s._counterpartId = id; return this; }
  lineId(id: string | null): this { this.s._lineId = id; return this; }
  occurredAt(ms: number): this { this.s._occurredAt = ms; return this; }
  motifIds(ids: string[]): this { this.s._motifIds = [...ids]; return this; }
  addMotif(id: string): this { this.s._motifIds.push(id); return this; }
  rhetoricalForms(forms: string[]): this { this.s._rhetoricalForms = [...forms]; return this; }
  addRhetoricalForm(form: string): this { this.s._rhetoricalForms.push(form); return this; }
  sceneRoles(roles: string[]): this { this.s._sceneRoles = [...roles]; return this; }
  addSceneRole(role: string): this { this.s._sceneRoles.push(role); return this; }
  semanticClusterIds(ids: string[]): this { this.s._semanticClusterIds = [...ids]; return this; }
  addSemanticCluster(id: string): this { this.s._semanticClusterIds.push(id); return this; }
  callbackSourceIds(ids: string[]): this { this.s._callbackSourceIds = [...ids]; return this; }
  addCallbackSource(id: string): this { this.s._callbackSourceIds.push(id); return this; }
  tags(t: string[]): this { this.s._tags = [...t]; return this; }
  addTag(t: string): this { this.s._tags.push(t); return this; }
  pressureBand(band: NoveltyEventRecord['pressureBand']): this { this.s._pressureBand = band; return this; }
  seasonId(id: string | null): this { this.s._seasonId = id; return this; }

  build(): NoveltyEventRecord {
    if (!this.s._eventId) throw new Error('eventId is required');
    return Object.freeze({
      eventId: this.s._eventId,
      playerId: this.s._playerId ?? null,
      channelId: this.s._channelId ?? null,
      counterpartId: this.s._counterpartId ?? null,
      lineId: this.s._lineId ?? null,
      occurredAt: this.s._occurredAt ?? Date.now(),
      motifIds: Object.freeze(this.s._motifIds),
      rhetoricalForms: Object.freeze(this.s._rhetoricalForms),
      sceneRoles: Object.freeze(this.s._sceneRoles),
      semanticClusterIds: Object.freeze(this.s._semanticClusterIds),
      callbackSourceIds: Object.freeze(this.s._callbackSourceIds),
      tags: Object.freeze(this.s._tags),
      pressureBand: this.s._pressureBand ?? null,
      seasonId: this.s._seasonId ?? null,
    });
  }
}

/** Factory for NoveltyEventBuilder. */
export function buildNoveltyEvent(): NoveltyEventBuilder {
  return new NoveltyEventBuilder();
}

// ============================================================================
// SEASON NOVELTY TRACKER — Track novelty signals across a season boundary
// ============================================================================

export interface SeasonNoveltyState {
  readonly seasonId: string;
  readonly playerIds: readonly string[];
  readonly totalEvents: number;
  readonly uniqueLines: number;
  readonly uniqueMotifs: number;
  readonly dominantChannels: readonly string[];
  readonly startedAt: number;
  readonly lastUpdatedAt: number;
}

export class SeasonNoveltyTracker {
  private readonly seasonId: string;
  private readonly playerEvents = new Map<string, NoveltyEventRecord[]>();
  private startedAt: number = Date.now();
  private lastUpdatedAt: number = Date.now();

  constructor(seasonId: string) {
    this.seasonId = seasonId;
  }

  record(playerId: string, event: NoveltyEventRecord): void {
    if (!this.playerEvents.has(playerId)) this.playerEvents.set(playerId, []);
    this.playerEvents.get(playerId)!.push(event);
    this.lastUpdatedAt = Date.now();
  }

  getState(): SeasonNoveltyState {
    const allEvents = [...this.playerEvents.values()].flat();
    const uniqueLines = new Set(allEvents.map((e) => e.lineId).filter(Boolean)).size;
    const uniqueMotifs = new Set(allEvents.flatMap((e) => e.motifIds)).size;
    const channelCounts = new Map<string, number>();
    for (const e of allEvents) {
      if (e.channelId) channelCounts.set(e.channelId, (channelCounts.get(e.channelId) ?? 0) + 1);
    }
    const dominantChannels = [...channelCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ch]) => ch);
    return Object.freeze({
      seasonId: this.seasonId,
      playerIds: Object.freeze([...this.playerEvents.keys()]),
      totalEvents: allEvents.length,
      uniqueLines,
      uniqueMotifs,
      dominantChannels: Object.freeze(dominantChannels),
      startedAt: this.startedAt,
      lastUpdatedAt: this.lastUpdatedAt,
    });
  }

  reset(): void {
    this.playerEvents.clear();
    this.startedAt = Date.now();
    this.lastUpdatedAt = Date.now();
  }
}

// ============================================================================
// CHANNEL NOVELTY POLICY — Per-channel rules for novelty enforcement
// ============================================================================

export interface ChannelNoveltyPolicy {
  readonly channelId: string;
  readonly maxFatigue01: number;
  readonly exactLineCooldownMs: number;
  readonly motifCooldownMs: number;
  readonly requireFreshSemanticCluster: boolean;
  readonly penaltyMultiplier: number;
}

export const DEFAULT_CHANNEL_NOVELTY_POLICIES: Readonly<Record<string, ChannelNoveltyPolicy>> = Object.freeze({
  'HATER': { channelId: 'HATER', maxFatigue01: 0.75, exactLineCooldownMs: 30 * 60 * 1000, motifCooldownMs: 5 * 60 * 1000, requireFreshSemanticCluster: false, penaltyMultiplier: 1.0 },
  'HELPER': { channelId: 'HELPER', maxFatigue01: 0.65, exactLineCooldownMs: 60 * 60 * 1000, motifCooldownMs: 15 * 60 * 1000, requireFreshSemanticCluster: true, penaltyMultiplier: 0.85 },
  'DEAL_ROOM': { channelId: 'DEAL_ROOM', maxFatigue01: 0.70, exactLineCooldownMs: 45 * 60 * 1000, motifCooldownMs: 10 * 60 * 1000, requireFreshSemanticCluster: true, penaltyMultiplier: 1.20 },
  'NPC': { channelId: 'NPC', maxFatigue01: 0.80, exactLineCooldownMs: 20 * 60 * 1000, motifCooldownMs: 3 * 60 * 1000, requireFreshSemanticCluster: false, penaltyMultiplier: 0.90 },
  'GLOBAL': { channelId: 'GLOBAL', maxFatigue01: 0.85, exactLineCooldownMs: 15 * 60 * 1000, motifCooldownMs: 2 * 60 * 1000, requireFreshSemanticCluster: false, penaltyMultiplier: 1.0 },
});

export function getChannelNoveltyPolicy(channelId: string): ChannelNoveltyPolicy {
  return DEFAULT_CHANNEL_NOVELTY_POLICIES[channelId] ?? DEFAULT_CHANNEL_NOVELTY_POLICIES['GLOBAL']!;
}

export function isChannelFatigued(
  fatigue: NoveltyFatigueSnapshot,
  policy: ChannelNoveltyPolicy,
): boolean {
  return fatigue.fatigue01 >= policy.maxFatigue01;
}

// ============================================================================
// NOVELTY ESCALATION DETECTOR — Detect when novelty system is in crisis
// ============================================================================

export interface NoveltyEscalationSignal {
  readonly playerId: string;
  readonly escalationLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly triggeringChannels: readonly string[];
  readonly avgFatigue01: number;
  readonly recommendations: readonly string[];
}

export function detectNoveltyEscalation(
  playerId: string,
  fatigueSnapshots: readonly NoveltyFatigueSnapshot[],
): NoveltyEscalationSignal {
  if (fatigueSnapshots.length === 0) {
    return Object.freeze({
      playerId,
      escalationLevel: 'NONE',
      triggeringChannels: Object.freeze([]),
      avgFatigue01: 0,
      recommendations: Object.freeze([]),
    });
  }

  const avgFatigue01 = fatigueSnapshots.reduce((s, f) => s + f.fatigue01, 0) / fatigueSnapshots.length;
  const highFatigueChannels = fatigueSnapshots.filter((f) => f.fatigue01 >= 0.70).map((f) => f.channelId);

  const escalationLevel: NoveltyEscalationSignal['escalationLevel'] =
    avgFatigue01 >= 0.85 ? 'CRITICAL' :
    avgFatigue01 >= 0.70 ? 'HIGH' :
    avgFatigue01 >= 0.55 ? 'MEDIUM' :
    avgFatigue01 >= 0.35 ? 'LOW' : 'NONE';

  const recommendations: string[] = [];
  if (escalationLevel === 'CRITICAL' || escalationLevel === 'HIGH') {
    recommendations.push('inject_fresh_semantic_clusters');
    recommendations.push('pause_motif_reuse');
  }
  if (highFatigueChannels.length > 0) {
    recommendations.push(`rotate_content_away_from:${highFatigueChannels.join(',')}`);
  }
  if (escalationLevel === 'MEDIUM') {
    recommendations.push('increase_candidate_diversity');
  }

  return Object.freeze({
    playerId,
    escalationLevel,
    triggeringChannels: Object.freeze(highFatigueChannels),
    avgFatigue01,
    recommendations: Object.freeze(recommendations),
  });
}

// ============================================================================
// NOVELTY RANKING AGGREGATOR — Merge results from multiple ranking calls
// ============================================================================

export interface AggregatedNoveltyRankingResult {
  readonly aggregatedAt: number;
  readonly totalCandidates: number;
  readonly mergedRankings: readonly NoveltyCandidateScoreBreakdown[];
  readonly topCandidateId: string | null;
}

export function aggregateNoveltyRankings(
  results: readonly NoveltyRankingResult[],
): AggregatedNoveltyRankingResult {
  const scoreMap = new Map<string, number[]>();
  for (const result of results) {
    for (const candidate of result.rankedCandidates) {
      if (!scoreMap.has(candidate.candidateId)) scoreMap.set(candidate.candidateId, []);
      scoreMap.get(candidate.candidateId)!.push(candidate.noveltyScore01);
    }
  }

  const mergedCandidates: NoveltyCandidateScoreBreakdown[] = [];
  for (const [candidateId, scores] of scoreMap) {
    const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
    // Build a minimal breakdown with averaged scores
    const firstResult = results
      .flatMap((r) => r.rankedCandidates)
      .find((c) => c.candidateId === candidateId);
    if (!firstResult) continue;
    mergedCandidates.push({ ...firstResult, noveltyScore01: clamp01(avgScore) });
  }

  mergedCandidates.sort((a, b) => b.noveltyScore01 - a.noveltyScore01);
  const topCandidateId = mergedCandidates[0]?.candidateId ?? null;

  return Object.freeze({
    aggregatedAt: Date.now(),
    totalCandidates: mergedCandidates.length,
    mergedRankings: Object.freeze(mergedCandidates),
    topCandidateId,
  });
}

// ============================================================================
// NOVELTY CAPACITY ESTIMATOR
// ============================================================================

export interface NoveltyCapacityEstimate {
  readonly playerId: string;
  readonly currentEventCount: number;
  readonly maxEventCount: number;
  readonly utilizationRate01: number;
  readonly estimatedEventsUntilSaturation: number;
  readonly capacityLabel: 'AMPLE' | 'FILLING' | 'NEAR_CAPACITY' | 'AT_CAPACITY';
}

export function estimateNoveltyCapacity(
  playerId: string,
  currentEventCount: number,
  maxEventCount: number = DEFAULT_CHAT_NOVELTY_SERVICE_CONFIG.recentEventLimit,
): NoveltyCapacityEstimate {
  const utilizationRate01 = clamp01(currentEventCount / maxEventCount);
  const estimatedEventsUntilSaturation = Math.max(0, maxEventCount - currentEventCount);
  const capacityLabel: NoveltyCapacityEstimate['capacityLabel'] =
    utilizationRate01 >= 0.98 ? 'AT_CAPACITY' :
    utilizationRate01 >= 0.80 ? 'NEAR_CAPACITY' :
    utilizationRate01 >= 0.50 ? 'FILLING' : 'AMPLE';
  return Object.freeze({
    playerId,
    currentEventCount,
    maxEventCount,
    utilizationRate01,
    estimatedEventsUntilSaturation,
    capacityLabel,
  });
}

// ============================================================================
// NOVELTY NDJSON EXPORT
// ============================================================================

export function exportNoveltyEventsNdjson(
  events: readonly NoveltyEventRecord[],
  maxEvents: number = 10000,
): string {
  return events
    .slice(0, maxEvents)
    .map((e) => JSON.stringify(e))
    .join('\n');
}

export function importNoveltyEventsNdjson(ndjson: string): NoveltyEventRecord[] {
  return ndjson
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as NoveltyEventRecord;
      } catch {
        return null;
      }
    })
    .filter((e): e is NoveltyEventRecord => e != null);
}

// ============================================================================
// NOVELTY MOTIF COLORING — Map motif frequency to a display color band
// ============================================================================

export type MotifColorBand = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PURPLE';

export function motifColorBand(
  counter: NoveltyFacetCounter,
  saturationThresholds: readonly [number, number, number, number] = [5, 15, 30, 60],
): MotifColorBand {
  const [y, o, r, p] = saturationThresholds;
  if (counter.totalSeen >= p) return 'PURPLE';
  if (counter.totalSeen >= r) return 'RED';
  if (counter.totalSeen >= o) return 'ORANGE';
  if (counter.totalSeen >= y) return 'YELLOW';
  return 'GREEN';
}

export function buildMotifColorMap(
  counters: readonly NoveltyFacetCounter[],
): Readonly<Record<string, MotifColorBand>> {
  const map: Record<string, MotifColorBand> = {};
  for (const counter of counters.filter((c) => c.facet === 'MOTIF')) {
    map[counter.key] = motifColorBand(counter);
  }
  return Object.freeze(map);
}

// ============================================================================
// NOVELTY PRESSURE BAND MAPPING — Map NoveltyPressureBand to scalar
// ============================================================================

export const NOVELTY_PRESSURE_BAND_SCALARS: Readonly<Record<string, number>> = Object.freeze({
  LOW: 0.20,
  MEDIUM: 0.45,
  HIGH: 0.70,
  CRITICAL: 0.90,
});

export function pressureBandToScalar(band: string | null | undefined): number {
  if (!band) return 0;
  return NOVELTY_PRESSURE_BAND_SCALARS[band] ?? 0.5;
}

// ============================================================================
// NOVELTY SCORE AUDIT — Detailed breakdown for debugging
// ============================================================================

export interface NoveltyScoreAuditEntry {
  readonly candidateId: string;
  readonly noveltyScore01: number;
  readonly penaltyBreakdown: Readonly<Record<string, number>>;
  readonly boostBreakdown: Readonly<Record<string, number>>;
  readonly fatigueRisk: number;
  readonly finalScore01: number;
}

export function auditNoveltyScore(
  breakdown: NoveltyCandidateScoreBreakdown,
): NoveltyScoreAuditEntry {
  const penaltyBreakdown = Object.freeze({
    exactLine: breakdown.exactLinePenalty,
    motif: breakdown.motifPenalty,
    rhetoric: breakdown.rhetoricPenalty,
    semantic: breakdown.semanticPenalty,
    pressure: breakdown.pressurePenalty,
    scene: breakdown.scenePenalty,
    channel: breakdown.channelPenalty,
    counterpart: breakdown.counterpartPenalty,
    callback: breakdown.callbackPenalty,
    tag: breakdown.tagPenalty,
  });
  const boostBreakdown = Object.freeze({
    freshness: breakdown.freshnessBoost,
    unseenFacet: breakdown.unseenFacetBoost,
  });
  return Object.freeze({
    candidateId: breakdown.candidateId,
    noveltyScore01: breakdown.noveltyScore01,
    penaltyBreakdown,
    boostBreakdown,
    fatigueRisk: breakdown.fatigueRisk,
    finalScore01: breakdown.noveltyScore01,
  });
}

/** Compute a global novelty health score across all players. */
export function computeGlobalNoveltyHealth(
  snapshots: readonly NoveltyLedgerSnapshot[],
): number {
  if (snapshots.length === 0) return 1.0;
  const totalFatigue = snapshots
    .flatMap((s) => s.fatigueByChannel)
    .reduce((sum, f) => sum + f.fatigue01, 0);
  const avgFatigue = totalFatigue / Math.max(snapshots.flatMap((s) => s.fatigueByChannel).length, 1);
  return clamp01(1 - avgFatigue);
}

// ============================================================================
// NOVELTY WINDOW ADVISOR — Recommend optimal lookback windows for scoring
// ============================================================================

export interface NoveltyWindowRecommendation {
  readonly recommendedLookbackMs: number;
  readonly rationale: string;
  readonly fatigueLevel01: number;
  readonly pressureLabel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

export function recommendNoveltyWindow(
  fatigue: NoveltyFatigueSnapshot,
  policy: ChannelNoveltyPolicy,
): NoveltyWindowRecommendation {
  const fatigueLevel01 = fatigue.fatigue01;
  // When fatigue is high, shorten the lookback window to be less penalizing
  const baseWindowMs = policy.exactLineCooldownMs;
  const adjustedWindowMs = fatigueLevel01 >= 0.75
    ? baseWindowMs * 0.5
    : fatigueLevel01 >= 0.50
    ? baseWindowMs * 0.75
    : baseWindowMs;

  const pressureLabel: NoveltyWindowRecommendation['pressureLabel'] =
    fatigueLevel01 >= 0.80 ? 'CRITICAL' :
    fatigueLevel01 >= 0.60 ? 'HIGH' :
    fatigueLevel01 >= 0.35 ? 'MODERATE' : 'LOW';

  const rationale =
    fatigueLevel01 >= 0.75 ? 'High fatigue: shortened lookback to permit fresher reuse' :
    fatigueLevel01 >= 0.50 ? 'Moderate fatigue: slightly reduced lookback window' :
    'Low fatigue: standard lookback window applied';

  return Object.freeze({
    recommendedLookbackMs: adjustedWindowMs,
    rationale,
    fatigueLevel01,
    pressureLabel,
  });
}

// ============================================================================
// NOVELTY SIGNAL INJECTOR — Force-inject novelty boost signals for NPC behavior
// ============================================================================

export interface NoveltyBoostInjection {
  readonly targetPlayerId: string;
  readonly boostAmount01: number;
  readonly affectedFacets: readonly NoveltyFacet[];
  readonly injectedAt: number;
  readonly reason: string;
}

export function createNoveltyBoostInjection(
  targetPlayerId: string,
  boostAmount01: number,
  affectedFacets: readonly NoveltyFacet[],
  reason: string,
): NoveltyBoostInjection {
  return Object.freeze({
    targetPlayerId,
    boostAmount01: clamp01(boostAmount01),
    affectedFacets: Object.freeze([...affectedFacets]),
    injectedAt: Date.now(),
    reason,
  });
}

// ============================================================================
// NOVELTY CANDIDATE SIEVE — Pre-filter candidates before ranking
// ============================================================================

export interface NoveltySieveResult {
  readonly passed: readonly NoveltyCandidateDescriptor[];
  readonly rejected: readonly { candidate: NoveltyCandidateDescriptor; reason: string }[];
  readonly sievedCount: number;
}

export function sieveCandidates(
  candidates: readonly NoveltyCandidateDescriptor[],
  fatigue: NoveltyFatigueSnapshot,
  policy: ChannelNoveltyPolicy,
): NoveltySieveResult {
  const passed: NoveltyCandidateDescriptor[] = [];
  const rejected: { candidate: NoveltyCandidateDescriptor; reason: string }[] = [];

  for (const candidate of candidates) {
    // Block candidates whose lineId is in recent exact lines
    if (candidate.lineId && fatigue.recentExactLines.includes(candidate.lineId)) {
      rejected.push({ candidate, reason: 'exact_line_in_recent_history' });
      continue;
    }

    // Block if channel is too fatigued and policy requires freshness
    if (policy.requireFreshSemanticCluster && fatigue.fatigue01 >= policy.maxFatigue01) {
      const allClustersStale = (candidate.semanticClusterIds ?? []).every((c) =>
        fatigue.dominantSemanticClusters.includes(c),
      );
      if (allClustersStale) {
        rejected.push({ candidate, reason: 'all_semantic_clusters_are_dominant' });
        continue;
      }
    }

    passed.push(candidate);
  }

  return Object.freeze({
    passed: Object.freeze(passed),
    rejected: Object.freeze(rejected),
    sievedCount: rejected.length,
  });
}

// ============================================================================
// NOVELTY BENCHMARK — Compute baseline scores for a set of events
// ============================================================================

export interface NoveltyBenchmarkResult {
  readonly sampleSize: number;
  readonly avgNoveltyScore01: number;
  readonly p10Score01: number;
  readonly p50Score01: number;
  readonly p90Score01: number;
  readonly freshCandidateRate01: number;
  readonly staleCandidateRate01: number;
}

export function benchmarkNoveltyScores(
  breakdowns: readonly NoveltyCandidateScoreBreakdown[],
): NoveltyBenchmarkResult {
  if (breakdowns.length === 0) {
    return Object.freeze({
      sampleSize: 0,
      avgNoveltyScore01: 0,
      p10Score01: 0,
      p50Score01: 0,
      p90Score01: 0,
      freshCandidateRate01: 0,
      staleCandidateRate01: 0,
    });
  }
  const sorted = [...breakdowns].sort((a, b) => a.noveltyScore01 - b.noveltyScore01);
  const avg = sorted.reduce((s, b) => s + b.noveltyScore01, 0) / sorted.length;
  const p10 = sorted[Math.floor(sorted.length * 0.10)]?.noveltyScore01 ?? 0;
  const p50 = sorted[Math.floor(sorted.length * 0.50)]?.noveltyScore01 ?? 0;
  const p90 = sorted[Math.floor(sorted.length * 0.90)]?.noveltyScore01 ?? 0;
  const freshCount = breakdowns.filter((b) => b.penaltyTotal === 0).length;
  const staleCount = breakdowns.filter((b) => b.exactLinePenalty > 0).length;
  return Object.freeze({
    sampleSize: breakdowns.length,
    avgNoveltyScore01: avg,
    p10Score01: p10,
    p50Score01: p50,
    p90Score01: p90,
    freshCandidateRate01: clamp01(freshCount / breakdowns.length),
    staleCandidateRate01: clamp01(staleCount / breakdowns.length),
  });
}

// ============================================================================
// NOVELTY CROSS-CHANNEL BALANCER — Ensure no single channel hogs novelty space
// ============================================================================

export interface ChannelNoveltyBalance {
  readonly channelId: string;
  readonly eventCount: number;
  readonly share01: number;
  readonly isOverRepresented: boolean;
  readonly recommendedMaxEventsNext: number;
}

export function computeChannelNoveltyBalance(
  events: readonly NoveltyEventRecord[],
  targetEvenDistribution: boolean = true,
): readonly ChannelNoveltyBalance[] {
  if (events.length === 0) return Object.freeze([]);

  const channelCounts = new Map<string, number>();
  for (const e of events) {
    const ch = e.channelId ?? 'UNKNOWN';
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
  }

  const channelCount = channelCounts.size;
  const targetShare = targetEvenDistribution ? 1 / channelCount : 0.25;
  const entries: ChannelNoveltyBalance[] = [];

  for (const [channelId, count] of channelCounts) {
    const share01 = count / events.length;
    const isOverRepresented = share01 > targetShare * 1.5;
    const recommendedMaxEventsNext = isOverRepresented
      ? Math.floor(count * 0.75)
      : count;
    entries.push(Object.freeze({
      channelId,
      eventCount: count,
      share01,
      isOverRepresented,
      recommendedMaxEventsNext,
    }));
  }

  return Object.freeze(entries.sort((a, b) => b.share01 - a.share01));
}

// ============================================================================
// NOVELTY COUNTER MERGER — Merge facet counters from multiple snapshots
// ============================================================================

export function mergeNoveltyCounters(
  snapshots: readonly NoveltyLedgerSnapshot[],
): readonly NoveltyFacetCounter[] {
  const merged = new Map<string, NoveltyFacetCounter>();

  for (const snapshot of snapshots) {
    for (const counter of snapshot.counters) {
      const key = `${counter.facet}:${counter.key}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...counter });
        continue;
      }
      merged.set(key, {
        ...existing,
        lastSeenAt: Math.max(existing.lastSeenAt, counter.lastSeenAt),
        totalSeen: existing.totalSeen + counter.totalSeen,
        sessionSeen: existing.sessionSeen + counter.sessionSeen,
        daySeen: existing.daySeen + counter.daySeen,
        weekSeen: existing.weekSeen + counter.weekSeen,
        seasonSeen: existing.seasonSeen + counter.seasonSeen,
        careerSeen: existing.careerSeen + counter.careerSeen,
      });
    }
  }

  return Object.freeze([...merged.values()].sort((a, b) => b.totalSeen - a.totalSeen));
}

// ============================================================================
// NOVELTY STALE DETECTION — Find players whose novelty ledger hasn't been updated
// ============================================================================

export interface NoveltyStaleReport {
  readonly playerId: string;
  readonly lastEventAt: number | null;
  readonly staleDurationMs: number;
  readonly isStale: boolean;
  readonly staleLabel: 'FRESH' | 'AGING' | 'STALE' | 'DORMANT';
}

export function detectStaleNoveltyLedgers(
  snapshots: readonly NoveltyLedgerSnapshot[],
  staleThresholdMs: number = 24 * 60 * 60 * 1000,
  nowMs: number = Date.now(),
): readonly NoveltyStaleReport[] {
  return Object.freeze(snapshots.map((snap): NoveltyStaleReport => {
    const lastEventAt = snap.recentEvents.length > 0
      ? Math.max(...snap.recentEvents.map((e) => e.occurredAt))
      : null;
    const staleDurationMs = lastEventAt != null ? nowMs - lastEventAt : Infinity;
    const isStale = staleDurationMs >= staleThresholdMs;
    const staleLabel: NoveltyStaleReport['staleLabel'] =
      staleDurationMs >= 7 * 24 * 60 * 60 * 1000 ? 'DORMANT' :
      staleDurationMs >= staleThresholdMs ? 'STALE' :
      staleDurationMs >= staleThresholdMs * 0.5 ? 'AGING' : 'FRESH';
    return Object.freeze({
      playerId: snap.playerId ?? 'UNKNOWN',
      lastEventAt,
      staleDurationMs,
      isStale,
      staleLabel,
    });
  }));
}

// ============================================================================
// NOVELTY FINGERPRINT REGISTRY
// ============================================================================

export class NoveltyEventFingerprintRegistry {
  private readonly seen = new Set<string>();

  register(event: NoveltyEventRecord): boolean {
    const fp = `${event.playerId ?? 'NONE'}:${event.lineId ?? 'NONE'}:${event.occurredAt}`;
    if (this.seen.has(fp)) return false;
    this.seen.add(fp);
    return true;
  }

  has(event: NoveltyEventRecord): boolean {
    const fp = `${event.playerId ?? 'NONE'}:${event.lineId ?? 'NONE'}:${event.occurredAt}`;
    return this.seen.has(fp);
  }

  clear(): void { this.seen.clear(); }
  size(): number { return this.seen.size; }
}

// ============================================================================
// NOVELTY STATISTICS REPORTER
// ============================================================================

export interface NoveltyStatisticsReport {
  readonly totalPlayers: number;
  readonly totalEvents: number;
  readonly avgEventsPerPlayer: number;
  readonly totalUniqueLines: number;
  readonly totalUniqueMotifs: number;
  readonly globalFatigue01: number;
  readonly mostsaturatedPlayerId: string | null;
  readonly freshestPlayerId: string | null;
}

export function buildGlobalNoveltyStatistics(
  snapshots: readonly NoveltyLedgerSnapshot[],
): NoveltyStatisticsReport {
  if (snapshots.length === 0) {
    return Object.freeze({
      totalPlayers: 0,
      totalEvents: 0,
      avgEventsPerPlayer: 0,
      totalUniqueLines: 0,
      totalUniqueMotifs: 0,
      globalFatigue01: 0,
      mostsaturatedPlayerId: null,
      freshestPlayerId: null,
    });
  }

  const totalEvents = snapshots.reduce((s, snap) => s + snap.totalEvents, 0);
  const avgEventsPerPlayer = totalEvents / snapshots.length;
  const totalUniqueLines = snapshots.reduce((s, snap) => s + snap.totalUniqueLines, 0);
  const totalUniqueMotifs = snapshots.reduce((s, snap) => s + snap.totalUniqueMotifs, 0);

  const allFatigue = snapshots.flatMap((s) => s.fatigueByChannel);
  const globalFatigue01 = allFatigue.length > 0
    ? clamp01(allFatigue.reduce((s, f) => s + f.fatigue01, 0) / allFatigue.length)
    : 0;

  const sortedByEvents = [...snapshots].sort((a, b) => b.totalEvents - a.totalEvents);
  const mostsaturatedPlayerId = sortedByEvents[0]?.playerId ?? null;
  const freshestPlayerId = sortedByEvents[sortedByEvents.length - 1]?.playerId ?? null;

  return Object.freeze({
    totalPlayers: snapshots.length,
    totalEvents,
    avgEventsPerPlayer,
    totalUniqueLines,
    totalUniqueMotifs,
    globalFatigue01,
    mostsaturatedPlayerId,
    freshestPlayerId,
  });
}

// ============================================================================
// NOVELTY EXTENDED SERVICE — ChatNoveltyService with watch bus and sieve
// ============================================================================

export class ChatNoveltyServiceExtended extends ChatNoveltyService {
  public readonly watchBus = new NoveltyWatchBus();
  public readonly fingerprintRegistry = new NoveltyEventFingerprintRegistry();

  public override recordEvent(playerId: string, event: NoveltyEventRecord): NoveltyEventRecord {
    const result = super.recordEvent(playerId, event);
    this.fingerprintRegistry.register(event);
    this.watchBus.emit({ type: 'EVENT_RECORDED', playerId, event: result });
    return result;
  }

  public override setSeasonId(playerId: string, seasonId: string | null): void {
    super.setSeasonId(playerId, seasonId);
    this.watchBus.emit({ type: 'SEASON_CHANGED', playerId, seasonId });
  }

  public override clearPlayer(playerId: string): void {
    super.clearPlayer(playerId);
    this.watchBus.emit({ type: 'PLAYER_CLEARED', playerId });
  }

  /** Rank with pre-sieving applied. */
  public rankWithSieve(
    request: NoveltyRankingRequest,
    policy?: ChannelNoveltyPolicy,
  ): NoveltyRankingResult {
    const channelId = request.channelId ?? 'GLOBAL';
    const resolvedPolicy = policy ?? getChannelNoveltyPolicy(channelId);
    const fatigue = this.getAllFatigue(request.playerId ?? 'GLOBAL')
      .find((f) => f.channelId === channelId);

    if (fatigue) {
      const sieved = sieveCandidates(request.candidates, fatigue, resolvedPolicy);
      const sievedRequest: NoveltyRankingRequest = {
        ...request,
        candidates: sieved.passed,
      };
      return super.rank(sievedRequest);
    }
    return super.rank(request);
  }
}

/** Factory for ChatNoveltyServiceExtended. */
export function createChatNoveltyServiceExtended(
  config?: Partial<ChatNoveltyServiceConfig>,
): ChatNoveltyServiceExtended {
  return new ChatNoveltyServiceExtended(config);
}

// ============================================================================
// NOVELTY SCOPE WEIGHT MAP — Weight each scope by time sensitivity
// ============================================================================

export const NOVELTY_SCOPE_WEIGHTS: Readonly<Record<NoveltyScope, number>> = Object.freeze({
  SESSION: 1.00,
  DAY: 0.80,
  WEEK: 0.55,
  SEASON: 0.30,
  CAREER: 0.10,
});

export function weightedScopeScore(counter: NoveltyFacetCounter): number {
  return clamp01(
    counter.sessionSeen * NOVELTY_SCOPE_WEIGHTS['SESSION'] * 0.08 +
    counter.daySeen * NOVELTY_SCOPE_WEIGHTS['DAY'] * 0.05 +
    counter.weekSeen * NOVELTY_SCOPE_WEIGHTS['WEEK'] * 0.03 +
    counter.seasonSeen * NOVELTY_SCOPE_WEIGHTS['SEASON'] * 0.02 +
    counter.careerSeen * NOVELTY_SCOPE_WEIGHTS['CAREER'] * 0.01,
  );
}

// ============================================================================
// NOVELTY CANDIDATE DESCRIPTOR BUILDER
// ============================================================================

export interface NoveltyCandidateDescriptorBuilder {
  candidateId: string;
  channelId?: string;
  lineId?: string;
  counterpartId?: string;
  pressureBand?: string;
  motifIds?: string[];
  rhetoricalForms?: string[];
  semanticClusterIds?: string[];
  sceneRoles?: string[];
  callbackSourceIds?: string[];
  tags?: string[];
  customPenalty?: number;
  customBoost?: number;
}

export function buildNoveltyCandidateDescriptor(
  b: NoveltyCandidateDescriptorBuilder,
): NoveltyCandidateDescriptor {
  return Object.freeze({
    candidateId: b.candidateId,
    channelId: b.channelId,
    lineId: b.lineId,
    counterpartId: b.counterpartId,
    pressureBand: b.pressureBand as NoveltyEventRecord['pressureBand'],
    motifIds: Object.freeze(b.motifIds ?? []),
    rhetoricalForms: Object.freeze(b.rhetoricalForms ?? []),
    semanticClusterIds: Object.freeze(b.semanticClusterIds ?? []),
    sceneRoles: Object.freeze(b.sceneRoles ?? []),
    callbackSourceIds: Object.freeze(b.callbackSourceIds ?? []),
    tags: Object.freeze(b.tags ?? []),
    customPenalty: b.customPenalty,
    customBoost: b.customBoost,
  });
}

// ============================================================================
// NOVELTY EVENT DEDUPLICATION
// ============================================================================

export function deduplicateNoveltyEvents(
  events: readonly NoveltyEventRecord[],
): readonly NoveltyEventRecord[] {
  const seen = new Set<string>();
  const result: NoveltyEventRecord[] = [];
  for (const event of events) {
    const key = `${event.playerId ?? ''}:${event.lineId ?? ''}:${event.occurredAt}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(event);
    }
  }
  return Object.freeze(result);
}

// ============================================================================
// NOVELTY EVENT PROJECTIONS
// ============================================================================

export interface NoveltyEventProjection {
  readonly eventId: string;
  readonly playerId: string | null;
  readonly channelId: string | null;
  readonly occurredAt: number;
  readonly hasFreshLine: boolean;
  readonly motifCount: number;
  readonly tag: string;
}

export function projectNoveltyEvent(event: NoveltyEventRecord): NoveltyEventProjection {
  return Object.freeze({
    eventId: event.eventId,
    playerId: event.playerId ?? null,
    channelId: event.channelId ?? null,
    occurredAt: event.occurredAt,
    hasFreshLine: event.lineId != null,
    motifCount: event.motifIds.length,
    tag: event.tags[0] ?? 'UNTAGGED',
  });
}

export function projectNoveltyEvents(
  events: readonly NoveltyEventRecord[],
): readonly NoveltyEventProjection[] {
  return Object.freeze(events.map(projectNoveltyEvent));
}

// ============================================================================
// NOVELTY PRESSURE RATE TRACKER
// ============================================================================

export interface NoveltyPressureRateSnapshot {
  readonly channelId: string;
  readonly eventsInWindow: number;
  readonly windowMs: number;
  readonly ratePerMinute: number;
  readonly isSpiking: boolean;
  readonly spikeThreshold: number;
}

export function computeNoveltyPressureRate(
  events: readonly NoveltyEventRecord[],
  channelId: string,
  windowMs: number = 30 * 60 * 1000,
  spikeThreshold: number = 20,
  nowMs: number = Date.now(),
): NoveltyPressureRateSnapshot {
  const cutoff = nowMs - windowMs;
  const inWindow = events.filter((e) => e.channelId === channelId && e.occurredAt >= cutoff);
  const ratePerMinute = inWindow.length / (windowMs / 60000);
  return Object.freeze({
    channelId,
    eventsInWindow: inWindow.length,
    windowMs,
    ratePerMinute,
    isSpiking: inWindow.length >= spikeThreshold,
    spikeThreshold,
  });
}

// ============================================================================
// NOVELTY SCORE FLOOR ENFORCER — Prevent extreme penalty stacking
// ============================================================================

export const NOVELTY_SCORE_FLOOR = 0.05 as const;
export const NOVELTY_SCORE_CEILING = 1.00 as const;

export function enforceNoveltyScoreBounds(score: number): number {
  return Math.max(NOVELTY_SCORE_FLOOR, Math.min(NOVELTY_SCORE_CEILING, score));
}

export function applyScoreFloorToBreakdowns(
  breakdowns: readonly NoveltyCandidateScoreBreakdown[],
): readonly NoveltyCandidateScoreBreakdown[] {
  return Object.freeze(
    breakdowns.map((b) => ({
      ...b,
      noveltyScore01: enforceNoveltyScoreBounds(b.noveltyScore01),
    })),
  );
}

// ============================================================================
// NOVELTY PERIOD SUMMARY — Summarize events across a specific time period
// ============================================================================

export interface NoveltyPeriodSummary {
  readonly playerId: string;
  readonly periodLabel: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly eventCount: number;
  readonly uniqueLineCount: number;
  readonly topMotifs: readonly string[];
  readonly topChannels: readonly string[];
  readonly avgPressureBandScalar: number;
}

export function buildNoveltyPeriodSummary(
  playerId: string,
  events: readonly NoveltyEventRecord[],
  startMs: number,
  endMs: number,
  periodLabel: string = 'CUSTOM',
): NoveltyPeriodSummary {
  const period = events.filter(
    (e) => (e.playerId == null || e.playerId === playerId) &&
      e.occurredAt >= startMs && e.occurredAt < endMs,
  );

  const uniqueLines = new Set(period.map((e) => e.lineId).filter(Boolean));
  const motifCounts = new Map<string, number>();
  for (const e of period) {
    for (const m of e.motifIds) motifCounts.set(m, (motifCounts.get(m) ?? 0) + 1);
  }
  const topMotifs = [...motifCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([m]) => m);

  const channelCounts = new Map<string, number>();
  for (const e of period) {
    const ch = e.channelId ?? 'UNKNOWN';
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
  }
  const topChannels = [...channelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ch]) => ch);

  const pressureScalars = period.map((e) => pressureBandToScalar(e.pressureBand));
  const avgPressureBandScalar = pressureScalars.length > 0
    ? pressureScalars.reduce((s, v) => s + v, 0) / pressureScalars.length
    : 0;

  return Object.freeze({
    playerId,
    periodLabel,
    startMs,
    endMs,
    eventCount: period.length,
    uniqueLineCount: uniqueLines.size,
    topMotifs: Object.freeze(topMotifs),
    topChannels: Object.freeze(topChannels),
    avgPressureBandScalar,
  });
}

// ============================================================================
// NOVELTY FACET TRANSITION MATRIX — Track how players move between facets
// ============================================================================

export interface FacetTransitionEntry {
  readonly fromFacet: NoveltyFacet;
  readonly toFacet: NoveltyFacet;
  readonly occurrences: number;
  readonly avgIntervalMs: number;
}

export function buildFacetTransitionMatrix(
  events: readonly NoveltyEventRecord[],
): readonly FacetTransitionEntry[] {
  const sorted = [...events].sort((a, b) => a.occurredAt - b.occurredAt);
  const transitions = new Map<string, { count: number; totalIntervalMs: number }>();

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const facetsA: NoveltyFacet[] = [
      ...(a.motifIds.length > 0 ? ['MOTIF' as NoveltyFacet] : []),
      ...(a.rhetoricalForms.length > 0 ? ['RHETORICAL_FORM' as NoveltyFacet] : []),
      ...(a.lineId ? ['LINE' as NoveltyFacet] : []),
    ];
    const facetsB: NoveltyFacet[] = [
      ...(b.motifIds.length > 0 ? ['MOTIF' as NoveltyFacet] : []),
      ...(b.rhetoricalForms.length > 0 ? ['RHETORICAL_FORM' as NoveltyFacet] : []),
      ...(b.lineId ? ['LINE' as NoveltyFacet] : []),
    ];
    const intervalMs = b.occurredAt - a.occurredAt;
    for (const fa of facetsA) {
      for (const fb of facetsB) {
        const key = `${fa}→${fb}`;
        const existing = transitions.get(key) ?? { count: 0, totalIntervalMs: 0 };
        transitions.set(key, { count: existing.count + 1, totalIntervalMs: existing.totalIntervalMs + intervalMs });
      }
    }
  }

  const entries: FacetTransitionEntry[] = [];
  for (const [key, data] of transitions) {
    const [fromFacet, toFacet] = key.split('→') as [NoveltyFacet, NoveltyFacet];
    entries.push(Object.freeze({
      fromFacet,
      toFacet,
      occurrences: data.count,
      avgIntervalMs: data.count > 0 ? data.totalIntervalMs / data.count : 0,
    }));
  }

  return Object.freeze(entries.sort((a, b) => b.occurrences - a.occurrences));
}

// ============================================================================
// NOVELTY CLEANUP UTILITY
// ============================================================================

export interface NoveltyCleanupSummary {
  readonly playerId: string;
  readonly eventsRemovedByDecay: number;
  readonly duplicatesRemoved: number;
  readonly totalBefore: number;
  readonly totalAfter: number;
}

export function performNoveltyCleanup(
  playerId: string,
  events: NoveltyEventRecord[],
  retentionWindowMs: number = 7 * 24 * 60 * 60 * 1000,
  nowMs: number = Date.now(),
): NoveltyCleanupSummary {
  const totalBefore = events.length;
  const decayResult = applyNoveltyEventDecay(playerId, events, retentionWindowMs, nowMs);
  const deduplicated = deduplicateNoveltyEvents(events);
  const duplicatesRemoved = events.length - deduplicated.length;
  events.splice(0, events.length, ...deduplicated);
  return Object.freeze({
    playerId,
    eventsRemovedByDecay: decayResult.removedCount,
    duplicatesRemoved,
    totalBefore,
    totalAfter: events.length,
  });
}

// ============================================================================
// NOVELTY MODULE FINAL EXPORTS
// ============================================================================

/** Check if two novelty events share any overlapping motifs. */
export function noveltyEventsShareMotifs(
  a: NoveltyEventRecord,
  b: NoveltyEventRecord,
): boolean {
  return a.motifIds.some((m) => b.motifIds.includes(m));
}

/** Check if two novelty events share the exact same line. */
export function noveltyEventsShareLine(
  a: NoveltyEventRecord,
  b: NoveltyEventRecord,
): boolean {
  return a.lineId != null && b.lineId != null && a.lineId === b.lineId;
}

/** Rank facet counters by their session heat. */
export function rankCountersBySessionHeat(
  counters: readonly NoveltyFacetCounter[],
): readonly NoveltyFacetCounter[] {
  return Object.freeze([...counters].sort((a, b) => b.sessionSeen - a.sessionSeen));
}

/** Get a single facet counter for a specific key. */
export function findFacetCounter(
  counters: readonly NoveltyFacetCounter[],
  facet: NoveltyFacet,
  key: string,
): NoveltyFacetCounter | null {
  return counters.find((c) => c.facet === facet && c.key === key) ?? null;
}

/** Compute total events that have at least one motif tag. */
export function countMotifTaggedEvents(events: readonly NoveltyEventRecord[]): number {
  return events.filter((e) => e.motifIds.length > 0).length;
}

// ============================================================================
// NOVELTY MODULE AUTHORITY OBJECT
// ============================================================================

export const ChatNoveltyServiceModule = Object.freeze({
  name: CHAT_NOVELTY_MODULE_NAME,
  version: CHAT_NOVELTY_MODULE_VERSION,
  laws: CHAT_NOVELTY_LAWS,
  defaults: CHAT_NOVELTY_DEFAULTS,
  descriptor: CHAT_NOVELTY_MODULE_DESCRIPTOR,
  DEFAULT_CHAT_NOVELTY_SERVICE_CONFIG,
  DEFAULT_CHANNEL_NOVELTY_POLICIES,
  NOVELTY_PRESSURE_BAND_SCALARS,
  NOVELTY_SCOPE_WEIGHTS,
  NOVELTY_SCORE_FLOOR,
  NOVELTY_SCORE_CEILING,
  ChatNoveltyService,
  ChatNoveltyServiceExtended,
  NoveltyWatchBus,
  NoveltyEventBuilder,
  NoveltyEventFingerprintRegistry,
  SeasonNoveltyTracker,
  createChatNoveltyService,
  createChatNoveltyServiceExtended,
  buildNoveltyEvent,
  applyNoveltyEventDecay,
  batchRankNovelty,
  buildNoveltyFacetHeatMap,
  diffNoveltySnapshots,
  normalizeNoveltyScores,
  computeNoveltyTrajectory,
  compareNoveltyProfiles,
  isCandidateFullyNovel,
  sortCandidatesByNovelty,
  filterHighNovelty,
  averageNoveltyScore,
  traceNoveltyResult,
  getChannelNoveltyPolicy,
  isChannelFatigued,
  detectNoveltyEscalation,
  aggregateNoveltyRankings,
  estimateNoveltyCapacity,
  exportNoveltyEventsNdjson,
  importNoveltyEventsNdjson,
  motifColorBand,
  buildMotifColorMap,
  pressureBandToScalar,
  auditNoveltyScore,
  computeGlobalNoveltyHealth,
  recommendNoveltyWindow,
  createNoveltyBoostInjection,
  sieveCandidates,
  benchmarkNoveltyScores,
  computeChannelNoveltyBalance,
  mergeNoveltyCounters,
  detectStaleNoveltyLedgers,
  buildGlobalNoveltyStatistics,
  weightedScopeScore,
  buildNoveltyCandidateDescriptor,
  deduplicateNoveltyEvents,
  projectNoveltyEvent,
  projectNoveltyEvents,
  computeNoveltyPressureRate,
  enforceNoveltyScoreBounds,
  applyScoreFloorToBreakdowns,
  buildNoveltyPeriodSummary,
  buildFacetTransitionMatrix,
  performNoveltyCleanup,
  noveltyEventsShareMotifs,
  noveltyEventsShareLine,
  rankCountersBySessionHeat,
  findFacetCounter,
  countMotifTaggedEvents,
} as const);
