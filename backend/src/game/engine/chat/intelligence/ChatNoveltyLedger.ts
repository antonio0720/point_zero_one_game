/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT NOVELTY LEDGER
 * FILE: pzo-web/src/engines/chat/intelligence/ChatNoveltyLedger.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Tracks perceived repetition and novelty at the authoritative server lane.
 * This ledger exists to stop authored chat from "feeling" repetitive even
 * before backend authority || semantic retrieval answers the same question.
 *
 * It does not replace backend truth.
 * It protects authoritative anti-repeat scoring and persistence prep.
 * ============================================================================
 */

import type {
  ChatMessage,
  ChatScenePlan,
  ChatVisibleChannel,
  UnixMs,
} from '../types';

import type { BotId } from '../types';

export type NoveltyPressureBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ChatNoveltyLedgerCandidate {
  readonly candidateId: string;
  readonly lineId?: string;
  readonly botId?: BotId | string | null;
  readonly counterpartId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: ChatVisibleChannel | string | null;
  readonly pressureBand?: NoveltyPressureBand;
  readonly motifIds?: readonly string[];
  readonly rhetoricalForms?: readonly string[];
  readonly sceneRoles?: readonly string[];
  readonly semanticClusterIds?: readonly string[];
  readonly callbackSourceIds?: readonly string[];
  readonly tags?: readonly string[];
  readonly text?: string;
}

export interface ChatNoveltyLedgerEvent {
  readonly eventId: string;
  readonly occurredAt: UnixMs;
  readonly lineId?: string;
  readonly botId?: BotId | string | null;
  readonly counterpartId?: string | null;
  readonly roomId?: string | null;
  readonly channelId?: ChatVisibleChannel | string | null;
  readonly pressureBand?: NoveltyPressureBand;
  readonly motifIds: readonly string[];
  readonly rhetoricalForms: readonly string[];
  readonly sceneRoles: readonly string[];
  readonly semanticClusterIds: readonly string[];
  readonly callbackSourceIds: readonly string[];
  readonly tags: readonly string[];
  readonly text?: string;
}

export interface ChatNoveltyLedgerCounter {
  readonly key: string;
  readonly firstSeenAt: UnixMs;
  readonly lastSeenAt: UnixMs;
  readonly totalSeen: number;
}

export interface ChatNoveltyLedgerFatigue {
  readonly channelId: string;
  readonly fatigue01: number;
  readonly lastUpdatedAt: UnixMs;
  readonly dominantMotifs: readonly string[];
  readonly dominantForms: readonly string[];
  readonly dominantSemanticClusters: readonly string[];
  readonly recentExactLines: readonly string[];
}

export interface ChatNoveltyLedgerScore {
  readonly candidateId: string;
  readonly noveltyScore01: number;
  readonly penaltyTotal: number;
  readonly exactLinePenalty: number;
  readonly motifPenalty: number;
  readonly rhetoricPenalty: number;
  readonly semanticPenalty: number;
  readonly callbackPenalty: number;
  readonly channelPenalty: number;
  readonly counterpartPenalty: number;
  readonly pressurePenalty: number;
  readonly scenePenalty: number;
  readonly tagPenalty: number;
  readonly freshnessBoost: number;
  readonly unseenFacetBoost: number;
  readonly fatigueRisk: number;
  readonly notes: readonly string[];
}

export interface ChatNoveltyLedgerSnapshot {
  readonly createdAt: UnixMs;
  readonly updatedAt: UnixMs;
  readonly recentEvents: readonly ChatNoveltyLedgerEvent[];
  readonly lineCounters: readonly ChatNoveltyLedgerCounter[];
  readonly motifCounters: readonly ChatNoveltyLedgerCounter[];
  readonly rhetoricalCounters: readonly ChatNoveltyLedgerCounter[];
  readonly semanticCounters: readonly ChatNoveltyLedgerCounter[];
  readonly sceneRoleCounters: readonly ChatNoveltyLedgerCounter[];
  readonly counterpartCounters: readonly ChatNoveltyLedgerCounter[];
  readonly callbackCounters: readonly ChatNoveltyLedgerCounter[];
  readonly channelCounters: readonly ChatNoveltyLedgerCounter[];
  readonly fatigueByChannel: readonly ChatNoveltyLedgerFatigue[];
}

export interface ChatNoveltyLedgerOptions {
  readonly maxRecentEvents?: number;
  readonly sessionLookbackMs?: number;
  readonly dayLookbackMs?: number;
  readonly weekLookbackMs?: number;
  readonly seasonLookbackMs?: number;
  readonly exactRepeatPenalty?: number;
  readonly motifPenalty?: number;
  readonly rhetoricPenalty?: number;
  readonly semanticPenalty?: number;
  readonly callbackPenalty?: number;
  readonly channelPenalty?: number;
  readonly scenePenalty?: number;
  readonly counterpartPenalty?: number;
  readonly pressurePenalty?: number;
  readonly tagPenalty?: number;
  readonly freshnessBoostCap?: number;
}

const DEFAULT_OPTIONS: Required<ChatNoveltyLedgerOptions> = {
  maxRecentEvents: 2048,
  sessionLookbackMs: 6 * 60 * 60 * 1000,
  dayLookbackMs: 24 * 60 * 60 * 1000,
  weekLookbackMs: 7 * 24 * 60 * 60 * 1000,
  seasonLookbackMs: 90 * 24 * 60 * 60 * 1000,
  exactRepeatPenalty: 0.52,
  motifPenalty: 0.22,
  rhetoricPenalty: 0.16,
  semanticPenalty: 0.18,
  callbackPenalty: 0.10,
  channelPenalty: 0.06,
  scenePenalty: 0.08,
  counterpartPenalty: 0.07,
  pressurePenalty: 0.04,
  tagPenalty: 0.03,
  freshnessBoostCap: 0.28,
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function normalizeText(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function pushCounter(
  map: Map<string, ChatNoveltyLedgerCounter>,
  key: string,
  occurredAt: UnixMs,
): void {
  if (!key) return;
  const prev = map.get(key);
  if (!prev) {
    map.set(key, {
      key,
      firstSeenAt: occurredAt,
      lastSeenAt: occurredAt,
      totalSeen: 1,
    });
    return;
  }
  map.set(key, {
    ...prev,
    lastSeenAt: occurredAt,
    totalSeen: prev.totalSeen + 1,
  });
}

function mapValues<T>(map: Map<string, T>): readonly T[] {
  return [...map.values()].sort((a: any, b: any) => {
    const aTime = Number(a.lastSeenAt ?? 0);
    const bTime = Number(b.lastSeenAt ?? 0);
    if (aTime !== bTime) return bTime - aTime;
    return String(a.key ?? '').localeCompare(String(b.key ?? ''));
  });
}

export class ChatNoveltyLedger {
  private readonly options: Required<ChatNoveltyLedgerOptions>;
  private readonly createdAt: UnixMs;
  private updatedAt: UnixMs;

  private readonly recentEvents: ChatNoveltyLedgerEvent[] = [];
  private readonly lineCounters = new Map<string, ChatNoveltyLedgerCounter>();
  private readonly motifCounters = new Map<string, ChatNoveltyLedgerCounter>();
  private readonly rhetoricalCounters = new Map<string, ChatNoveltyLedgerCounter>();
  private readonly semanticCounters = new Map<string, ChatNoveltyLedgerCounter>();
  private readonly sceneRoleCounters = new Map<string, ChatNoveltyLedgerCounter>();
  private readonly counterpartCounters = new Map<string, ChatNoveltyLedgerCounter>();
  private readonly callbackCounters = new Map<string, ChatNoveltyLedgerCounter>();
  private readonly channelCounters = new Map<string, ChatNoveltyLedgerCounter>();

  public constructor(options: ChatNoveltyLedgerOptions = {}, now: UnixMs = Date.now() as UnixMs) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    this.createdAt = now;
    this.updatedAt = now;
  }

  public restore(snapshot: ChatNoveltyLedgerSnapshot): this {
    this.recentEvents.splice(0, this.recentEvents.length, ...snapshot.recentEvents.map((item) => ({ ...item })));
    this.hydrateCounterMap(this.lineCounters, snapshot.lineCounters);
    this.hydrateCounterMap(this.motifCounters, snapshot.motifCounters);
    this.hydrateCounterMap(this.rhetoricalCounters, snapshot.rhetoricalCounters);
    this.hydrateCounterMap(this.semanticCounters, snapshot.semanticCounters);
    this.hydrateCounterMap(this.sceneRoleCounters, snapshot.sceneRoleCounters);
    this.hydrateCounterMap(this.counterpartCounters, snapshot.counterpartCounters);
    this.hydrateCounterMap(this.callbackCounters, snapshot.callbackCounters);
    this.hydrateCounterMap(this.channelCounters, snapshot.channelCounters);
    this.updatedAt = snapshot.updatedAt;
    return this;
  }

  public snapshot(now: UnixMs = this.updatedAt): ChatNoveltyLedgerSnapshot {
    return {
      createdAt: this.createdAt,
      updatedAt: now,
      recentEvents: this.recentEvents.map((item) => ({ ...item })),
      lineCounters: mapValues(this.lineCounters),
      motifCounters: mapValues(this.motifCounters),
      rhetoricalCounters: mapValues(this.rhetoricalCounters),
      semanticCounters: mapValues(this.semanticCounters),
      sceneRoleCounters: mapValues(this.sceneRoleCounters),
      counterpartCounters: mapValues(this.counterpartCounters),
      callbackCounters: mapValues(this.callbackCounters),
      channelCounters: mapValues(this.channelCounters),
      fatigueByChannel: this.getFatigueByChannel(now),
    };
  }

  public noteMessage(message: ChatMessage, now: UnixMs = message.createdAt as UnixMs): void {
    this.noteEvent({
      eventId: String(message.id),
      occurredAt: now,
      lineId: message.id,
      botId: (message.attribution as any)?.botId ?? null,
      counterpartId: (message.attribution as any)?.actorId ?? null,
      channelId: message.channelId,
      pressureBand: this.toPressureBand((message.metadata as any)?.pressureTier),
      motifIds: this.extractMotifsFromMessage(message),
      rhetoricalForms: this.extractRhetoricalFormsFromText(message.plainText),
      sceneRoles: (message.metadata as any)?.sceneId ? ['SCENE_LINE'] : [],
      semanticClusterIds: this.extractSemanticKeysFromText(message.plainText),
      callbackSourceIds: (message.metadata as any)?.quoteIds?.map((item: unknown) => String(item)) ?? [],
      tags: message.tags ?? [],
      text: message.plainText,
    });
  }

  public noteScene(scene: ChatScenePlan, channelId?: ChatVisibleChannel, now: UnixMs = scene.openedAt): void {
    this.noteEvent({
      eventId: String(scene.sceneId),
      occurredAt: now,
      lineId: undefined,
      botId: null,
      counterpartId: null,
      channelId: channelId ?? (scene as any).primaryChannel,
      motifIds: [],
      rhetoricalForms: [],
      sceneRoles: [
        String((scene as any).momentType ?? 'SCENE'),
        ...((scene as any).beats ?? []).map((beat: any) => String(beat.beatType)),
      ],
      semanticClusterIds: [],
      callbackSourceIds: [],
      tags: ['scene'],
      text: undefined,
    });
  }

  public noteEvent(event: ChatNoveltyLedgerEvent): void {
    this.updatedAt = event.occurredAt;
    this.recentEvents.push({
      ...event,
      motifIds: [...event.motifIds],
      rhetoricalForms: [...event.rhetoricalForms],
      sceneRoles: [...event.sceneRoles],
      semanticClusterIds: [...event.semanticClusterIds],
      callbackSourceIds: [...event.callbackSourceIds],
      tags: [...event.tags],
    });
    if (this.recentEvents.length > this.options.maxRecentEvents) {
      this.recentEvents.splice(0, this.recentEvents.length - this.options.maxRecentEvents);
    }

    if (event.lineId) pushCounter(this.lineCounters, String(event.lineId), event.occurredAt);
    for (const motif of event.motifIds) pushCounter(this.motifCounters, motif, event.occurredAt);
    for (const form of event.rhetoricalForms) pushCounter(this.rhetoricalCounters, form, event.occurredAt);
    for (const semantic of event.semanticClusterIds) pushCounter(this.semanticCounters, semantic, event.occurredAt);
    for (const sceneRole of event.sceneRoles) pushCounter(this.sceneRoleCounters, sceneRole, event.occurredAt);
    for (const callback of event.callbackSourceIds) pushCounter(this.callbackCounters, callback, event.occurredAt);
    for (const tag of event.tags) pushCounter(this.channelCounters, `tag:${tag}`, event.occurredAt);
    if (event.counterpartId) pushCounter(this.counterpartCounters, event.counterpartId, event.occurredAt);
    if (event.channelId) pushCounter(this.channelCounters, `channel:${event.channelId}`, event.occurredAt);

    this.prune(event.occurredAt);
  }

  public scoreCandidate(candidate: ChatNoveltyLedgerCandidate, now: UnixMs = Date.now() as UnixMs): ChatNoveltyLedgerScore {
    const notes: string[] = [];
    const exactLinePenalty = candidate.lineId ? this.computePenalty(this.lineCounters.get(String(candidate.lineId)), now, this.options.exactRepeatPenalty) : 0;
    const motifPenalty = this.computeAggregatePenalty(candidate.motifIds, this.motifCounters, now, this.options.motifPenalty);
    const rhetoricPenalty = this.computeAggregatePenalty(candidate.rhetoricalForms, this.rhetoricalCounters, now, this.options.rhetoricPenalty);
    const semanticPenalty = this.computeAggregatePenalty(candidate.semanticClusterIds, this.semanticCounters, now, this.options.semanticPenalty);
    const callbackPenalty = this.computeAggregatePenalty(candidate.callbackSourceIds, this.callbackCounters, now, this.options.callbackPenalty);
    const scenePenalty = this.computeAggregatePenalty(candidate.sceneRoles, this.sceneRoleCounters, now, this.options.scenePenalty);
    const tagPenalty = this.computeAggregatePenalty(candidate.tags, this.channelCounters, now, this.options.tagPenalty, 'tag:');
    const channelPenalty = candidate.channelId ? this.computePenalty(this.channelCounters.get(`channel:${candidate.channelId}`), now, this.options.channelPenalty) : 0;
    const counterpartPenalty = candidate.counterpartId ? this.computePenalty(this.counterpartCounters.get(candidate.counterpartId), now, this.options.counterpartPenalty) : 0;
    const pressurePenalty = candidate.pressureBand ? this.computePressurePenalty(candidate.pressureBand, now) : 0;

    const penaltyTotal = clamp01(
      exactLinePenalty +
      motifPenalty +
      rhetoricPenalty +
      semanticPenalty +
      callbackPenalty +
      scenePenalty +
      tagPenalty +
      channelPenalty +
      counterpartPenalty +
      pressurePenalty,
    );

    const freshnessBoost = this.computeFreshnessBoost(candidate, now);
    const unseenFacetBoost = this.computeUnseenFacetBoost(candidate);
    const fatigueRisk = candidate.channelId ? this.getChannelFatigueScore(String(candidate.channelId), now) : 0;
    const noveltyScore01 = clamp01(1 - penaltyTotal + freshnessBoost + unseenFacetBoost - (fatigueRisk * 0.15));

    if (exactLinePenalty > 0.3) notes.push('exact_line_recent');
    if (motifPenalty > 0.12) notes.push('motif_overused');
    if (rhetoricPenalty > 0.08) notes.push('rhetoric_overused');
    if (semanticPenalty > 0.10) notes.push('semantic_cluster_familiar');
    if (callbackPenalty > 0.06) notes.push('callback_recent');
    if (fatigueRisk > 0.5) notes.push('channel_fatigue_elevated');
    if (freshnessBoost > 0.15) notes.push('freshness_bonus');
    if (unseenFacetBoost > 0.10) notes.push('unseen_facets');

    return {
      candidateId: candidate.candidateId,
      noveltyScore01,
      penaltyTotal,
      exactLinePenalty,
      motifPenalty,
      rhetoricPenalty,
      semanticPenalty,
      callbackPenalty,
      channelPenalty,
      counterpartPenalty,
      pressurePenalty,
      scenePenalty,
      tagPenalty,
      freshnessBoost,
      unseenFacetBoost,
      fatigueRisk,
      notes,
    };
  }

  public rankCandidates(
    candidates: readonly ChatNoveltyLedgerCandidate[],
    now: UnixMs = Date.now() as UnixMs,
  ): readonly ChatNoveltyLedgerScore[] {
    return candidates
      .map((candidate) => this.scoreCandidate(candidate, now))
      .sort((a, b) => {
        if (a.noveltyScore01 !== b.noveltyScore01) return b.noveltyScore01 - a.noveltyScore01;
        return a.candidateId.localeCompare(b.candidateId);
      });
  }

  public getFatigueByChannel(now: UnixMs = Date.now() as UnixMs): readonly ChatNoveltyLedgerFatigue[] {
    const channelIds = new Set<string>();
    for (const event of this.recentEvents) {
      if (event.channelId) channelIds.add(String(event.channelId));
    }
    return [...channelIds].map((channelId) => ({
      channelId,
      fatigue01: this.getChannelFatigueScore(channelId, now),
      lastUpdatedAt: now,
      dominantMotifs: this.getDominantKeys(channelId, 'motif', now),
      dominantForms: this.getDominantKeys(channelId, 'form', now),
      dominantSemanticClusters: this.getDominantKeys(channelId, 'semantic', now),
      recentExactLines: this.recentEvents
        .filter((item) => String(item.channelId ?? '') === channelId && item.lineId)
        .slice(-6)
        .map((item) => String(item.lineId)),
    }));
  }

  public getSuggestedExclusions(channelId: string, now: UnixMs = Date.now() as UnixMs): {
    readonly motifIds: readonly string[];
    readonly rhetoricalForms: readonly string[];
    readonly semanticClusterIds: readonly string[];
    readonly lineIds: readonly string[];
  } {
    const fatigue = this.getFatigueByChannel(now).find((item) => item.channelId === channelId);
    return {
      motifIds: fatigue?.dominantMotifs ?? [],
      rhetoricalForms: fatigue?.dominantForms ?? [],
      semanticClusterIds: fatigue?.dominantSemanticClusters ?? [],
      lineIds: fatigue?.recentExactLines ?? [],
    };
  }

  public hasSeenLineRecently(lineId: string, now: UnixMs = Date.now() as UnixMs): boolean {
    const counter = this.lineCounters.get(lineId);
    if (!counter) return false;
    return (Number(now) - Number(counter.lastSeenAt)) <= this.options.sessionLookbackMs;
  }

  public prune(now: UnixMs = Date.now() as UnixMs): void {
    const keepAfter = Number(now) - this.options.seasonLookbackMs;
    while (this.recentEvents.length > 0 && Number(this.recentEvents[0].occurredAt) < keepAfter) {
      this.recentEvents.shift();
    }
  }

  private hydrateCounterMap(
    target: Map<string, ChatNoveltyLedgerCounter>,
    counters: readonly ChatNoveltyLedgerCounter[],
  ): void {
    target.clear();
    for (const counter of counters) target.set(counter.key, { ...counter });
  }

  private computeAggregatePenalty(
    keys: readonly string[] | undefined,
    counters: Map<string, ChatNoveltyLedgerCounter>,
    now: UnixMs,
    basePenalty: number,
    prefix = '',
  ): number {
    if (!keys?.length) return 0;
    return clamp01(
      keys.reduce((sum, key) => sum + this.computePenalty(counters.get(`${prefix}${key}`), now, basePenalty), 0),
    );
  }

  private computePenalty(
    counter: ChatNoveltyLedgerCounter | undefined,
    now: UnixMs,
    basePenalty: number,
  ): number {
    if (!counter) return 0;
    const ageMs = Math.max(0, Number(now) - Number(counter.lastSeenAt));
    const sessionFactor = ageMs <= this.options.sessionLookbackMs ? 1 : ageMs <= this.options.dayLookbackMs ? 0.65 : ageMs <= this.options.weekLookbackMs ? 0.35 : 0.15;
    const saturation = Math.min(1.35, 1 + ((counter.totalSeen - 1) * 0.08));
    return clamp01(basePenalty * sessionFactor * saturation);
  }

  private computePressurePenalty(pressureBand: NoveltyPressureBand, now: UnixMs): number {
    const recent = this.recentEvents
      .filter((item) => item.pressureBand === pressureBand)
      .filter((item) => (Number(now) - Number(item.occurredAt)) <= this.options.sessionLookbackMs)
      .length;
    return clamp01(recent * this.options.pressurePenalty);
  }

  private computeFreshnessBoost(candidate: ChatNoveltyLedgerCandidate, now: UnixMs): number {
    const facets = [
      ...(candidate.motifIds ?? []),
      ...(candidate.rhetoricalForms ?? []),
      ...(candidate.semanticClusterIds ?? []),
      ...(candidate.sceneRoles ?? []),
      ...(candidate.callbackSourceIds ?? []),
    ];

    let unseen = 0;
    for (const key of facets) {
      const line = this.lineCounters.get(key);
      const motif = this.motifCounters.get(key);
      const rhetoric = this.rhetoricalCounters.get(key);
      const semantic = this.semanticCounters.get(key);
      const scene = this.sceneRoleCounters.get(key);
      const callback = this.callbackCounters.get(key);
      if (!line && !motif && !rhetoric && !semantic && !scene && !callback) unseen += 1;
    }

    const freshnessAge = candidate.lineId ? this.lineCounters.get(candidate.lineId)?.lastSeenAt : undefined;
    const freshnessWindowBoost = freshnessAge == null
      ? this.options.freshnessBoostCap
      : Math.min(this.options.freshnessBoostCap, Math.max(0, (Number(now) - Number(freshnessAge)) / this.options.weekLookbackMs) * 0.10);

    return clamp01(freshnessWindowBoost + (unseen * 0.02));
  }

  private computeUnseenFacetBoost(candidate: ChatNoveltyLedgerCandidate): number {
    let score = 0;
    if (candidate.lineId && !this.lineCounters.has(candidate.lineId)) score += 0.08;
    if (candidate.counterpartId && !this.counterpartCounters.has(candidate.counterpartId)) score += 0.03;
    if (candidate.channelId && !this.channelCounters.has(`channel:${candidate.channelId}`)) score += 0.02;
    return clamp01(score);
  }

  private getChannelFatigueScore(channelId: string, now: UnixMs): number {
    const recent = this.recentEvents.filter((item) => String(item.channelId ?? '') === channelId);
    if (recent.length === 0) return 0;
    const sessionRecent = recent.filter((item) => (Number(now) - Number(item.occurredAt)) <= this.options.sessionLookbackMs);
    const motifVariety = new Set(sessionRecent.flatMap((item) => item.motifIds)).size;
    const rhetoricVariety = new Set(sessionRecent.flatMap((item) => item.rhetoricalForms)).size;
    const semanticVariety = new Set(sessionRecent.flatMap((item) => item.semanticClusterIds)).size;
    const exactLinePressure = new Set(sessionRecent.map((item) => item.lineId).filter(Boolean)).size / Math.max(1, sessionRecent.length);
    const repetition = 1 - ((motifVariety + rhetoricVariety + semanticVariety) / Math.max(1, sessionRecent.length * 3));
    return clamp01((repetition * 0.65) + ((1 - exactLinePressure) * 0.35));
  }

  private getDominantKeys(
    channelId: string,
    mode: 'motif' | 'form' | 'semantic',
    now: UnixMs,
  ): readonly string[] {
    const counts = new Map<string, number>();
    const recent = this.recentEvents.filter((item) => String(item.channelId ?? '') === channelId && (Number(now) - Number(item.occurredAt)) <= this.options.weekLookbackMs);
    for (const event of recent) {
      const keys = mode === 'motif'
        ? event.motifIds
        : mode === 'form'
          ? event.rhetoricalForms
          : event.semanticClusterIds;
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([key]) => key);
  }

  private extractMotifsFromMessage(message: ChatMessage): readonly string[] {
    const motifs = new Set<string>();
    for (const tag of message.tags ?? []) {
      if (tag.includes(':')) motifs.add(tag.split(':')[0].toLowerCase());
      motifs.add(tag.toLowerCase());
    }
    if (message.kind) motifs.add(String(message.kind).toLowerCase());
    if (message.channel) motifs.add(`channel:${String(message.channel).toLowerCase()}`);
    return [...motifs];
  }

  private extractRhetoricalFormsFromText(text: string | undefined): readonly string[] {
    const normalized = normalizeText(text);
    if (!normalized) return [];
    const forms = new Set<string>();
    if (normalized.includes('you thought')) forms.add('you-thought-i-was');
    if (normalized.includes('i call it')) forms.add('i-call-it');
    if (normalized.includes('the system')) forms.add('system-assertion');
    if (normalized.includes('not because')) forms.add('not-because-because');
    if (normalized.includes('for now')) forms.add('for-now');
    if (normalized.includes('this was not')) forms.add('not-this-but-that');
    if (normalized.includes('i was waiting')) forms.add('waiting-reveal');
    if (normalized.includes('?')) forms.add('interrogative');
    if (forms.size === 0) forms.add('plain-declarative');
    return [...forms];
  }

  private extractSemanticKeysFromText(text: string | undefined): readonly string[] {
    const normalized = normalizeText(text);
    if (!normalized) return [];
    const keys = new Set<string>();
    if (normalized.match(/\bliquid|floor|distress|clearance|pricing\b/)) keys.add('macro:liquidity-distress');
    if (normalized.match(/\breview|compliance|forms|queue|approval\b/)) keys.add('macro:bureaucratic-delay');
    if (normalized.match(/\bpattern|predictable|readable|cadence|model\b/)) keys.add('macro:behavioral-modeling');
    if (normalized.match(/\bstorm|cycle|macro|correction|regime\b/)) keys.add('macro:systemic-crash');
    if (normalized.match(/\binheritance|legacy|cushion|structure|floor\b/)) keys.add('macro:structural-privilege');
    if (keys.size === 0) keys.add(`surface:${normalized.slice(0, 24)}`);
    return [...keys];
  }

  private toPressureBand(value: unknown): NoveltyPressureBand | undefined {
    const normalized = String(value ?? '').toUpperCase();
    if (normalized === 'CRITICAL') return 'CRITICAL';
    if (normalized === 'HIGH') return 'HIGH';
    if (normalized === 'MEDIUM' || normalized === 'ELEVATED') return 'MEDIUM';
    if (normalized === 'LOW' || normalized === 'BUILDING') return 'LOW';
    return undefined;
  }
}

export function createChatNoveltyLedger(
  options: ChatNoveltyLedgerOptions = {},
  now: UnixMs = Date.now() as UnixMs,
): ChatNoveltyLedger {
  return new ChatNoveltyLedger(options, now);
}
