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
}
