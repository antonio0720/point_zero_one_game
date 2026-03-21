/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT NOVELTY LEDGER
 * FILE: backend/src/game/engine/chat/intelligence/ChatNoveltyLedger.ts
 * VERSION: 2026.03.21-backend-contract-aligned
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Tracks perceived repetition and novelty at the authoritative server lane.
 *
 * This ledger does not replace backend truth. It exists to:
 * 1. score anti-repeat risk for authoritative chat candidates,
 * 2. preserve channel-level fatigue memory,
 * 3. keep scenes from collapsing into repetitive motif/rhetoric clusters,
 * 4. prepare deterministic novelty signals for persistence and downstream AI.
 *
 * Guardrails
 * ----------
 * - Backend types are the source of truth.
 * - This file must remain compilable against backend/src/game/engine/chat/types.ts.
 * - No frontend-only message fields are allowed here.
 * - All metadata reads are defensive and typed through narrow helpers.
 * ============================================================================
 */

import type {
  ChatMessage,
  ChatScenePlan,
  ChatVisibleChannel,
  UnixMs,
} from '../types';
import type { BotId } from '../types';

export const CHAT_NOVELTY_LEDGER_MODULE_NAME =
  'PZO_BACKEND_CHAT_NOVELTY_LEDGER' as const;

export const CHAT_NOVELTY_LEDGER_VERSION =
  '2026.03.21-backend-contract-aligned' as const;

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

const DEFAULT_OPTIONS: Required<ChatNoveltyLedgerOptions> = Object.freeze({
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
});

type CounterMap = Map<string, ChatNoveltyLedgerCounter>;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function normalizeText(value?: string | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9:_\-./]+/g, '')
    .replace(/-{2,}/g, '-');
}

function uniqueStrings(values: readonly string[] | undefined): readonly string[] {
  if (!values?.length) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    const normalized = normalizeToken(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }
  return ordered;
}

function copyEvent(event: ChatNoveltyLedgerEvent): ChatNoveltyLedgerEvent {
  return {
    ...event,
    motifIds: [...event.motifIds],
    rhetoricalForms: [...event.rhetoricalForms],
    sceneRoles: [...event.sceneRoles],
    semanticClusterIds: [...event.semanticClusterIds],
    callbackSourceIds: [...event.callbackSourceIds],
    tags: [...event.tags],
  };
}

function pushCounter(
  map: CounterMap,
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

function hydrateCounterMap(
  target: CounterMap,
  counters: readonly ChatNoveltyLedgerCounter[],
): void {
  target.clear();
  for (const counter of counters) {
    target.set(counter.key, { ...counter });
  }
}

function pruneCounterMap(target: CounterMap, keepAfter: number): void {
  for (const [key, counter] of target.entries()) {
    if (Number(counter.lastSeenAt) < keepAfter) {
      target.delete(key);
    }
  }
}

function mapValues<T extends { readonly key: string; readonly lastSeenAt?: UnixMs }>(
  map: ReadonlyMap<string, T>,
): readonly T[] {
  return [...map.values()].sort((left, right) => {
    const leftTime = Number(left.lastSeenAt ?? 0);
    const rightTime = Number(right.lastSeenAt ?? 0);
    if (leftTime !== rightTime) return rightTime - leftTime;
    return left.key.localeCompare(right.key);
  });
}

function metadataRecordOf(message: ChatMessage): Readonly<Record<string, unknown>> {
  return message.metadata as Readonly<Record<string, unknown>>;
}

function stringArrayFromUnknown(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const values: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' || typeof item === 'number') {
      const normalized = String(item).trim();
      if (normalized) values.push(normalized);
    }
  }
  return values;
}

function stringFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function coerceUnixMs(value: unknown, fallback: UnixMs): UnixMs {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value as UnixMs;
  }
  return fallback;
}

export class ChatNoveltyLedger {
  private readonly options: Required<ChatNoveltyLedgerOptions>;
  private readonly createdAt: UnixMs;
  private updatedAt: UnixMs;

  private readonly recentEvents: ChatNoveltyLedgerEvent[] = [];
  private readonly lineCounters: CounterMap = new Map();
  private readonly motifCounters: CounterMap = new Map();
  private readonly rhetoricalCounters: CounterMap = new Map();
  private readonly semanticCounters: CounterMap = new Map();
  private readonly sceneRoleCounters: CounterMap = new Map();
  private readonly counterpartCounters: CounterMap = new Map();
  private readonly callbackCounters: CounterMap = new Map();
  private readonly channelCounters: CounterMap = new Map();

  public constructor(
    options: ChatNoveltyLedgerOptions = {},
    now: UnixMs = Date.now() as UnixMs,
  ) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    this.createdAt = now;
    this.updatedAt = now;
  }

  public restore(snapshot: ChatNoveltyLedgerSnapshot): this {
    this.recentEvents.splice(
      0,
      this.recentEvents.length,
      ...snapshot.recentEvents.map((event) => copyEvent(event)),
    );

    hydrateCounterMap(this.lineCounters, snapshot.lineCounters);
    hydrateCounterMap(this.motifCounters, snapshot.motifCounters);
    hydrateCounterMap(this.rhetoricalCounters, snapshot.rhetoricalCounters);
    hydrateCounterMap(this.semanticCounters, snapshot.semanticCounters);
    hydrateCounterMap(this.sceneRoleCounters, snapshot.sceneRoleCounters);
    hydrateCounterMap(this.counterpartCounters, snapshot.counterpartCounters);
    hydrateCounterMap(this.callbackCounters, snapshot.callbackCounters);
    hydrateCounterMap(this.channelCounters, snapshot.channelCounters);

    this.updatedAt = snapshot.updatedAt;
    this.prune(this.updatedAt);
    return this;
  }

  public snapshot(now: UnixMs = this.updatedAt): ChatNoveltyLedgerSnapshot {
    return {
      createdAt: this.createdAt,
      updatedAt: now,
      recentEvents: this.recentEvents.map((event) => copyEvent(event)),
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

  public reset(now: UnixMs = Date.now() as UnixMs): this {
    this.recentEvents.splice(0, this.recentEvents.length);
    this.lineCounters.clear();
    this.motifCounters.clear();
    this.rhetoricalCounters.clear();
    this.semanticCounters.clear();
    this.sceneRoleCounters.clear();
    this.counterpartCounters.clear();
    this.callbackCounters.clear();
    this.channelCounters.clear();
    this.updatedAt = now;
    return this;
  }

  public noteMessage(
    message: ChatMessage,
    now: UnixMs = message.createdAt,
  ): void {
    const metadata = metadataRecordOf(message);
    const sceneRoles = this.extractSceneRolesFromMessage(message);
    const callbackSourceIds = this.extractCallbackSourceIdsFromMessage(message);
    const semanticClusterIds = this.extractSemanticKeysFromText(
      message.plainText,
      message.tags,
    );
    const motifIds = this.extractMotifsFromMessage(message);

    this.noteEvent({
      eventId: String(message.id),
      occurredAt: coerceUnixMs(now, message.createdAt),
      lineId: String(message.id),
      botId: message.attribution.botId ?? null,
      counterpartId: message.attribution.actorId ?? null,
      roomId: String(message.roomId),
      channelId: String(message.channelId),
      pressureBand: this.extractPressureBandFromMessage(message, metadata),
      motifIds,
      rhetoricalForms: this.extractRhetoricalFormsFromText(message.plainText),
      sceneRoles,
      semanticClusterIds,
      callbackSourceIds,
      tags: [...message.tags],
      text: message.plainText,
    });
  }

  public noteMessages(
    messages: readonly ChatMessage[],
    now: UnixMs = Date.now() as UnixMs,
  ): void {
    for (const message of messages) {
      this.noteMessage(
        message,
        coerceUnixMs(message.createdAt, now),
      );
    }
  }

  public noteScene(
    scene: ChatScenePlan,
    channelId?: ChatVisibleChannel,
    now: UnixMs = scene.openedAt,
  ): void {
    this.noteEvent({
      eventId: String(scene.sceneId),
      occurredAt: coerceUnixMs(now, scene.openedAt),
      lineId: undefined,
      botId: null,
      counterpartId: null,
      roomId: String(scene.roomId),
      channelId: channelId ?? this.deriveSceneChannelId(scene),
      pressureBand: undefined,
      motifIds: this.extractMotifsFromScene(scene),
      rhetoricalForms: this.extractRhetoricalFormsFromScene(scene),
      sceneRoles: this.extractSceneRolesFromScene(scene),
      semanticClusterIds: this.extractSemanticKeysFromScene(scene),
      callbackSourceIds: this.extractCallbackSourceIdsFromScene(scene),
      tags: this.extractSceneTags(scene),
      text: undefined,
    });
  }

  public noteEvent(event: ChatNoveltyLedgerEvent): void {
    const normalized: ChatNoveltyLedgerEvent = {
      ...event,
      eventId: String(event.eventId),
      lineId: event.lineId ? String(event.lineId) : undefined,
      botId: event.botId != null ? String(event.botId) : null,
      counterpartId: event.counterpartId != null ? String(event.counterpartId) : null,
      roomId: event.roomId != null ? String(event.roomId) : null,
      channelId: event.channelId != null ? String(event.channelId) : null,
      motifIds: uniqueStrings(event.motifIds),
      rhetoricalForms: uniqueStrings(event.rhetoricalForms),
      sceneRoles: uniqueStrings(event.sceneRoles),
      semanticClusterIds: uniqueStrings(event.semanticClusterIds),
      callbackSourceIds: uniqueStrings(event.callbackSourceIds),
      tags: uniqueStrings(event.tags),
      text: event.text,
    };

    this.updatedAt = normalized.occurredAt;
    this.recentEvents.push(copyEvent(normalized));

    if (this.recentEvents.length > this.options.maxRecentEvents) {
      this.recentEvents.splice(
        0,
        this.recentEvents.length - this.options.maxRecentEvents,
      );
    }

    if (normalized.lineId) {
      pushCounter(this.lineCounters, normalized.lineId, normalized.occurredAt);
    }
    for (const motif of normalized.motifIds) {
      pushCounter(this.motifCounters, motif, normalized.occurredAt);
    }
    for (const form of normalized.rhetoricalForms) {
      pushCounter(this.rhetoricalCounters, form, normalized.occurredAt);
    }
    for (const semantic of normalized.semanticClusterIds) {
      pushCounter(this.semanticCounters, semantic, normalized.occurredAt);
    }
    for (const sceneRole of normalized.sceneRoles) {
      pushCounter(this.sceneRoleCounters, sceneRole, normalized.occurredAt);
    }
    for (const callbackSourceId of normalized.callbackSourceIds) {
      pushCounter(this.callbackCounters, callbackSourceId, normalized.occurredAt);
    }
    for (const tag of normalized.tags) {
      pushCounter(this.channelCounters, `tag:${tag}`, normalized.occurredAt);
    }
    if (normalized.counterpartId) {
      pushCounter(
        this.counterpartCounters,
        normalized.counterpartId,
        normalized.occurredAt,
      );
    }
    if (normalized.channelId) {
      pushCounter(
        this.channelCounters,
        `channel:${normalized.channelId}`,
        normalized.occurredAt,
      );
    }

    this.prune(normalized.occurredAt);
  }

  public scoreCandidate(
    candidate: ChatNoveltyLedgerCandidate,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatNoveltyLedgerScore {
    const lineId = candidate.lineId ? String(candidate.lineId) : undefined;
    const motifIds = uniqueStrings(candidate.motifIds);
    const rhetoricalForms = uniqueStrings(candidate.rhetoricalForms);
    const semanticClusterIds = uniqueStrings(candidate.semanticClusterIds);
    const sceneRoles = uniqueStrings(candidate.sceneRoles);
    const callbackSourceIds = uniqueStrings(candidate.callbackSourceIds);
    const tags = uniqueStrings(candidate.tags);
    const channelId = candidate.channelId ? String(candidate.channelId) : undefined;
    const counterpartId = candidate.counterpartId
      ? String(candidate.counterpartId)
      : undefined;

    const notes: string[] = [];

    const exactLinePenalty = lineId
      ? this.computePenalty(
          this.lineCounters.get(lineId),
          now,
          this.options.exactRepeatPenalty,
        )
      : 0;
    const motifPenalty = this.computeAggregatePenalty(
      motifIds,
      this.motifCounters,
      now,
      this.options.motifPenalty,
    );
    const rhetoricPenalty = this.computeAggregatePenalty(
      rhetoricalForms,
      this.rhetoricalCounters,
      now,
      this.options.rhetoricPenalty,
    );
    const semanticPenalty = this.computeAggregatePenalty(
      semanticClusterIds,
      this.semanticCounters,
      now,
      this.options.semanticPenalty,
    );
    const callbackPenalty = this.computeAggregatePenalty(
      callbackSourceIds,
      this.callbackCounters,
      now,
      this.options.callbackPenalty,
    );
    const scenePenalty = this.computeAggregatePenalty(
      sceneRoles,
      this.sceneRoleCounters,
      now,
      this.options.scenePenalty,
    );
    const tagPenalty = this.computeAggregatePenalty(
      tags.map((tag) => `tag:${tag}`),
      this.channelCounters,
      now,
      this.options.tagPenalty,
    );
    const channelPenalty = channelId
      ? this.computePenalty(
          this.channelCounters.get(`channel:${channelId}`),
          now,
          this.options.channelPenalty,
        )
      : 0;
    const counterpartPenalty = counterpartId
      ? this.computePenalty(
          this.counterpartCounters.get(counterpartId),
          now,
          this.options.counterpartPenalty,
        )
      : 0;
    const pressurePenalty = candidate.pressureBand
      ? this.computePressurePenalty(candidate.pressureBand, now)
      : 0;

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

    const freshnessBoost = this.computeFreshnessBoost(
      {
        ...candidate,
        lineId,
        motifIds,
        rhetoricalForms,
        semanticClusterIds,
        sceneRoles,
        callbackSourceIds,
        tags,
        channelId,
        counterpartId,
      },
      now,
    );
    const unseenFacetBoost = this.computeUnseenFacetBoost({
      ...candidate,
      lineId,
      motifIds,
      rhetoricalForms,
      semanticClusterIds,
      sceneRoles,
      callbackSourceIds,
      tags,
      channelId,
      counterpartId,
    });
    const fatigueRisk = channelId
      ? this.getChannelFatigueScore(channelId, now)
      : 0;
    const noveltyScore01 = clamp01(
      1 -
        penaltyTotal +
        freshnessBoost +
        unseenFacetBoost -
        (fatigueRisk * 0.15),
    );

    if (exactLinePenalty > 0.30) notes.push('exact_line_recent');
    if (motifPenalty > 0.12) notes.push('motif_overused');
    if (rhetoricPenalty > 0.08) notes.push('rhetoric_overused');
    if (semanticPenalty > 0.10) notes.push('semantic_cluster_familiar');
    if (callbackPenalty > 0.06) notes.push('callback_recent');
    if (channelPenalty > 0.04) notes.push('channel_repeated');
    if (counterpartPenalty > 0.05) notes.push('counterpart_repeated');
    if (pressurePenalty > 0.08) notes.push('pressure_band_saturated');
    if (fatigueRisk > 0.50) notes.push('channel_fatigue_elevated');
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

  public explainCandidate(
    candidate: ChatNoveltyLedgerCandidate,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatNoveltyLedgerScore {
    return this.scoreCandidate(candidate, now);
  }

  public rankCandidates(
    candidates: readonly ChatNoveltyLedgerCandidate[],
    now: UnixMs = Date.now() as UnixMs,
  ): readonly ChatNoveltyLedgerScore[] {
    return candidates
      .map((candidate) => this.scoreCandidate(candidate, now))
      .sort((left, right) => {
        if (left.noveltyScore01 !== right.noveltyScore01) {
          return right.noveltyScore01 - left.noveltyScore01;
        }
        if (left.penaltyTotal !== right.penaltyTotal) {
          return left.penaltyTotal - right.penaltyTotal;
        }
        return left.candidateId.localeCompare(right.candidateId);
      });
  }

  public getFatigueByChannel(
    now: UnixMs = Date.now() as UnixMs,
  ): readonly ChatNoveltyLedgerFatigue[] {
    const channelIds = new Set<string>();
    for (const event of this.recentEvents) {
      if (event.channelId) channelIds.add(String(event.channelId));
    }

    return [...channelIds]
      .map((channelId) => ({
        channelId,
        fatigue01: this.getChannelFatigueScore(channelId, now),
        lastUpdatedAt: now,
        dominantMotifs: this.getDominantKeys(channelId, 'motif', now),
        dominantForms: this.getDominantKeys(channelId, 'form', now),
        dominantSemanticClusters: this.getDominantKeys(channelId, 'semantic', now),
        recentExactLines: this.recentEvents
          .filter(
            (event) =>
              String(event.channelId ?? '') === channelId &&
              Boolean(event.lineId),
          )
          .slice(-6)
          .map((event) => String(event.lineId)),
      }))
      .sort((left, right) => {
        if (left.fatigue01 !== right.fatigue01) {
          return right.fatigue01 - left.fatigue01;
        }
        return left.channelId.localeCompare(right.channelId);
      });
  }

  public getSuggestedExclusions(
    channelId: string,
    now: UnixMs = Date.now() as UnixMs,
  ): {
    readonly motifIds: readonly string[];
    readonly rhetoricalForms: readonly string[];
    readonly semanticClusterIds: readonly string[];
    readonly lineIds: readonly string[];
  } {
    const fatigue = this.getFatigueByChannel(now).find(
      (item) => item.channelId === channelId,
    );
    return {
      motifIds: fatigue?.dominantMotifs ?? [],
      rhetoricalForms: fatigue?.dominantForms ?? [],
      semanticClusterIds: fatigue?.dominantSemanticClusters ?? [],
      lineIds: fatigue?.recentExactLines ?? [],
    };
  }

  public hasSeenLineRecently(
    lineId: string,
    now: UnixMs = Date.now() as UnixMs,
  ): boolean {
    const counter = this.lineCounters.get(lineId);
    if (!counter) return false;
    return (
      Number(now) - Number(counter.lastSeenAt)
    ) <= this.options.sessionLookbackMs;
  }

  public prune(now: UnixMs = Date.now() as UnixMs): void {
    const keepAfter = Number(now) - this.options.seasonLookbackMs;

    while (
      this.recentEvents.length > 0 &&
      Number(this.recentEvents[0].occurredAt) < keepAfter
    ) {
      this.recentEvents.shift();
    }

    pruneCounterMap(this.lineCounters, keepAfter);
    pruneCounterMap(this.motifCounters, keepAfter);
    pruneCounterMap(this.rhetoricalCounters, keepAfter);
    pruneCounterMap(this.semanticCounters, keepAfter);
    pruneCounterMap(this.sceneRoleCounters, keepAfter);
    pruneCounterMap(this.counterpartCounters, keepAfter);
    pruneCounterMap(this.callbackCounters, keepAfter);
    pruneCounterMap(this.channelCounters, keepAfter);
  }

  private computeAggregatePenalty(
    keys: readonly string[],
    counters: CounterMap,
    now: UnixMs,
    basePenalty: number,
  ): number {
    if (!keys.length) return 0;
    let total = 0;
    for (const key of keys) {
      total += this.computePenalty(counters.get(key), now, basePenalty);
    }
    return clamp01(total);
  }

  private computePenalty(
    counter: ChatNoveltyLedgerCounter | undefined,
    now: UnixMs,
    basePenalty: number,
  ): number {
    if (!counter) return 0;

    const ageMs = Math.max(0, Number(now) - Number(counter.lastSeenAt));
    const sessionFactor =
      ageMs <= this.options.sessionLookbackMs
        ? 1
        : ageMs <= this.options.dayLookbackMs
          ? 0.65
          : ageMs <= this.options.weekLookbackMs
            ? 0.35
            : 0.15;

    const saturation = Math.min(
      1.35,
      1 + ((counter.totalSeen - 1) * 0.08),
    );

    return clamp01(basePenalty * sessionFactor * saturation);
  }

  private computePressurePenalty(
    pressureBand: NoveltyPressureBand,
    now: UnixMs,
  ): number {
    const recentCount = this.recentEvents
      .filter((event) => event.pressureBand === pressureBand)
      .filter(
        (event) =>
          (Number(now) - Number(event.occurredAt)) <=
          this.options.sessionLookbackMs,
      )
      .length;

    return clamp01(recentCount * this.options.pressurePenalty);
  }

  private computeFreshnessBoost(
    candidate: ChatNoveltyLedgerCandidate,
    now: UnixMs,
  ): number {
    const facets = [
      ...(candidate.motifIds ?? []),
      ...(candidate.rhetoricalForms ?? []),
      ...(candidate.semanticClusterIds ?? []),
      ...(candidate.sceneRoles ?? []),
      ...(candidate.callbackSourceIds ?? []),
    ];

    let unseen = 0;
    for (const key of facets) {
      const normalized = normalizeToken(key);
      if (!normalized) continue;

      const line = this.lineCounters.get(normalized);
      const motif = this.motifCounters.get(normalized);
      const rhetoric = this.rhetoricalCounters.get(normalized);
      const semantic = this.semanticCounters.get(normalized);
      const scene = this.sceneRoleCounters.get(normalized);
      const callback = this.callbackCounters.get(normalized);

      if (!line && !motif && !rhetoric && !semantic && !scene && !callback) {
        unseen += 1;
      }
    }

    const freshnessAge = candidate.lineId
      ? this.lineCounters.get(candidate.lineId)?.lastSeenAt
      : undefined;

    const freshnessWindowBoost = freshnessAge == null
      ? this.options.freshnessBoostCap
      : Math.min(
          this.options.freshnessBoostCap,
          Math.max(
            0,
            (Number(now) - Number(freshnessAge)) / this.options.weekLookbackMs,
          ) * 0.10,
        );

    return clamp01(freshnessWindowBoost + (unseen * 0.02));
  }

  private computeUnseenFacetBoost(
    candidate: ChatNoveltyLedgerCandidate,
  ): number {
    let score = 0;
    if (candidate.lineId && !this.lineCounters.has(candidate.lineId)) score += 0.08;
    if (
      candidate.counterpartId &&
      !this.counterpartCounters.has(candidate.counterpartId)
    ) {
      score += 0.03;
    }
    if (
      candidate.channelId &&
      !this.channelCounters.has(`channel:${candidate.channelId}`)
    ) {
      score += 0.02;
    }
    return clamp01(score);
  }

  private getChannelFatigueScore(
    channelId: string,
    now: UnixMs,
  ): number {
    const recent = this.recentEvents.filter(
      (event) => String(event.channelId ?? '') === channelId,
    );
    if (recent.length === 0) return 0;

    const sessionRecent = recent.filter(
      (event) =>
        (Number(now) - Number(event.occurredAt)) <=
        this.options.sessionLookbackMs,
    );
    if (sessionRecent.length === 0) return 0;

    const motifVariety = new Set(
      sessionRecent.flatMap((event) => event.motifIds),
    ).size;
    const rhetoricVariety = new Set(
      sessionRecent.flatMap((event) => event.rhetoricalForms),
    ).size;
    const semanticVariety = new Set(
      sessionRecent.flatMap((event) => event.semanticClusterIds),
    ).size;
    const exactLinePressure = new Set(
      sessionRecent.map((event) => event.lineId).filter(Boolean),
    ).size / Math.max(1, sessionRecent.length);

    const repetition = 1 - (
      (motifVariety + rhetoricVariety + semanticVariety) /
      Math.max(1, sessionRecent.length * 3)
    );

    return clamp01((repetition * 0.65) + ((1 - exactLinePressure) * 0.35));
  }

  private getDominantKeys(
    channelId: string,
    mode: 'motif' | 'form' | 'semantic',
    now: UnixMs,
  ): readonly string[] {
    const counts = new Map<string, number>();
    const recent = this.recentEvents.filter(
      (event) =>
        String(event.channelId ?? '') === channelId &&
        (Number(now) - Number(event.occurredAt)) <=
          this.options.weekLookbackMs,
    );

    for (const event of recent) {
      const keys =
        mode === 'motif'
          ? event.motifIds
          : mode === 'form'
            ? event.rhetoricalForms
            : event.semanticClusterIds;

      for (const key of keys) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 4)
      .map(([key]) => key);
  }

  private extractMotifsFromMessage(message: ChatMessage): readonly string[] {
    const motifs = new Set<string>();

    motifs.add(`channel:${normalizeToken(message.channelId)}`);

    const actorId = normalizeToken(message.attribution.actorId);
    if (actorId) motifs.add(`actor:${actorId}`);

    const sourceType = normalizeToken(message.attribution.sourceType);
    if (sourceType) motifs.add(`source:${sourceType}`);

    const npcRole = normalizeToken(message.attribution.npcRole);
    if (npcRole) motifs.add(`npc-role:${npcRole}`);

    const botId = normalizeToken(message.attribution.botId);
    if (botId) motifs.add(`bot:${botId}`);

    for (const tag of message.tags) {
      const normalizedTag = normalizeToken(tag);
      if (!normalizedTag) continue;
      motifs.add(normalizedTag);
      if (normalizedTag.includes(':')) {
        const [family] = normalizedTag.split(':', 1);
        if (family) motifs.add(`tag-family:${family}`);
      }
    }

    const replaySceneId = normalizeToken(message.replay.sceneId);
    if (replaySceneId) motifs.add(`scene:${replaySceneId}`);

    return [...motifs];
  }

  private extractMotifsFromScene(scene: ChatScenePlan): readonly string[] {
    const motifs = new Set<string>();

    motifs.add('scene');
    motifs.add(`scene:${normalizeToken(scene.sceneId)}`);
    motifs.add(`room:${normalizeToken(scene.roomId)}`);

    const labelTokens = scene.label
      .split(/\s+/g)
      .map((token) => normalizeToken(token))
      .filter(Boolean)
      .slice(0, 6);

    for (const token of labelTokens) {
      motifs.add(`label:${token}`);
    }

    for (const message of scene.messages) {
      motifs.add(`channel:${normalizeToken(message.channelId)}`);
      for (const tag of message.tags) {
        const normalizedTag = normalizeToken(tag);
        if (normalizedTag) motifs.add(normalizedTag);
      }
    }

    if (scene.legendCandidate) motifs.add('legend-candidate');
    if (scene.silence?.active) motifs.add('silence-enforced');

    return [...motifs];
  }

  private extractRhetoricalFormsFromText(
    text: string | undefined,
  ): readonly string[] {
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
    if (normalized.includes('!')) forms.add('exclamatory');
    if (/^(yes|no|wait|listen)\b/.test(normalized)) forms.add('hard-opener');

    if (forms.size === 0) {
      forms.add('plain-declarative');
    }

    return [...forms];
  }

  private extractRhetoricalFormsFromScene(
    scene: ChatScenePlan,
  ): readonly string[] {
    const forms = new Set<string>();

    if (scene.silence?.active) forms.add('silence-window');
    if (scene.legendCandidate) forms.add('legend-setup');

    for (const message of scene.messages) {
      for (const form of this.extractRhetoricalFormsFromText(message.text)) {
        forms.add(form);
      }
    }

    if (forms.size === 0) {
      forms.add('scene-assembly');
    }

    return [...forms];
  }

  private extractSemanticKeysFromText(
    text: string | undefined,
    tags: readonly string[] = [],
  ): readonly string[] {
    const normalized = normalizeText(text);
    const keys = new Set<string>();

    if (normalized.match(/\bliquid|floor|distress|clearance|pricing\b/)) {
      keys.add('macro:liquidity-distress');
    }
    if (normalized.match(/\breview|compliance|forms|queue|approval\b/)) {
      keys.add('macro:bureaucratic-delay');
    }
    if (normalized.match(/\bpattern|predictable|readable|cadence|model\b/)) {
      keys.add('macro:behavioral-modeling');
    }
    if (normalized.match(/\bstorm|cycle|macro|correction|regime\b/)) {
      keys.add('macro:systemic-crash');
    }
    if (normalized.match(/\binheritance|legacy|cushion|structure|floor\b/)) {
      keys.add('macro:structural-privilege');
    }
    if (normalized.match(/\bdeal|offer|counter|bid|terms\b/)) {
      keys.add('macro:negotiation');
    }
    if (normalized.match(/\bhelp|save|extract|rescue|backup\b/)) {
      keys.add('macro:rescue');
    }
    if (normalized.match(/\bthreat|watching|tracking|read you|predict\b/)) {
      keys.add('macro:surveillance');
    }

    for (const tag of tags) {
      const normalizedTag = normalizeToken(tag);
      if (!normalizedTag) continue;
      if (normalizedTag.startsWith('topic:')) keys.add(`topic:${normalizedTag.slice(6)}`);
      if (normalizedTag.startsWith('mood:')) keys.add(`mood:${normalizedTag.slice(5)}`);
      if (normalizedTag.startsWith('cause:')) keys.add(`cause:${normalizedTag.slice(6)}`);
    }

    if (keys.size === 0 && normalized) {
      keys.add(`surface:${normalized.slice(0, 24).replace(/\s+/g, '_')}`);
    }

    return [...keys];
  }

  private extractSemanticKeysFromScene(
    scene: ChatScenePlan,
  ): readonly string[] {
    const keys = new Set<string>();

    keys.add(`scene:${normalizeToken(scene.sceneId)}`);
    keys.add(`room:${normalizeToken(scene.roomId)}`);

    for (const key of this.extractSemanticKeysFromText(scene.label)) {
      keys.add(key);
    }

    for (const message of scene.messages) {
      for (const key of this.extractSemanticKeysFromText(message.text, message.tags)) {
        keys.add(key);
      }
      if (message.causeEventId) {
        keys.add(`cause-event:${normalizeToken(message.causeEventId)}`);
      }
    }

    if (scene.legendCandidate) keys.add('scene:legend');
    if (scene.silence?.active) keys.add('scene:silence');

    return [...keys];
  }

  private extractCallbackSourceIdsFromMessage(
    message: ChatMessage,
  ): readonly string[] {
    const callbacks = new Set<string>();

    for (const parentMessageId of message.proof.causalParentMessageIds) {
      callbacks.add(String(parentMessageId));
    }
    for (const parentEventId of message.proof.causalParentEventIds) {
      callbacks.add(String(parentEventId));
    }

    const metadata = metadataRecordOf(message);
    for (const key of ['quoteIds', 'quotedMessageIds', 'callbackSourceIds']) {
      for (const value of stringArrayFromUnknown(metadata[key])) {
        callbacks.add(value);
      }
    }

    const replayAnchorKey = stringFromUnknown(message.replay.replayAnchorKey);
    if (replayAnchorKey) callbacks.add(replayAnchorKey);

    return [...callbacks];
  }

  private extractCallbackSourceIdsFromScene(
    scene: ChatScenePlan,
  ): readonly string[] {
    const callbacks = new Set<string>();

    for (const message of scene.messages) {
      if (message.causeEventId) callbacks.add(String(message.causeEventId));
    }

    return [...callbacks];
  }

  private extractSceneRolesFromMessage(
    message: ChatMessage,
  ): readonly string[] {
    const roles = new Set<string>();

    roles.add('message');
    roles.add(`channel:${normalizeToken(message.channelId)}`);

    if (message.replay.sceneId) roles.add('scene-line');
    if (message.replay.momentId) roles.add('moment-line');
    if (message.attribution.botId) roles.add('bot-line');
    if (message.attribution.npcRole) {
      roles.add(`npc:${normalizeToken(message.attribution.npcRole)}`);
    }
    if (message.policy.shadowOnly) roles.add('shadow-only');
    if (message.policy.wasRewritten) roles.add('rewritten');
    if (message.policy.wasMasked) roles.add('masked');

    return [...roles];
  }

  private extractSceneRolesFromScene(
    scene: ChatScenePlan,
  ): readonly string[] {
    const roles = new Set<string>();

    roles.add('scene');
    roles.add('scene-open');

    if (scene.silence?.active) roles.add('silence');
    if (scene.legendCandidate) roles.add('legend-candidate');

    for (const message of scene.messages) {
      roles.add(`channel:${normalizeToken(message.channelId)}`);
      if (message.moderationBypassAllowed) roles.add('bypass-eligible');
    }

    return [...roles];
  }

  private extractSceneTags(scene: ChatScenePlan): readonly string[] {
    const tags = new Set<string>();

    tags.add('scene');
    if (scene.legendCandidate) tags.add('legend');
    if (scene.silence?.active) tags.add('silence');

    for (const message of scene.messages) {
      for (const tag of message.tags) {
        const normalizedTag = normalizeToken(tag);
        if (normalizedTag) tags.add(normalizedTag);
      }
    }

    return [...tags];
  }

  private extractPressureBandFromMessage(
    message: ChatMessage,
    metadata: Readonly<Record<string, unknown>>,
  ): NoveltyPressureBand | undefined {
    const directKeys = [
      'pressureTier',
      'pressureBand',
      'pressure_band',
      'pressure',
    ] as const;

    for (const key of directKeys) {
      const value = stringFromUnknown(metadata[key]);
      const band = this.toPressureBand(value);
      if (band) return band;
    }

    for (const tag of message.tags) {
      const normalizedTag = normalizeToken(tag);
      if (normalizedTag.startsWith('pressure:')) {
        const band = this.toPressureBand(normalizedTag.slice('pressure:'.length));
        if (band) return band;
      }
    }

    return undefined;
  }

  private deriveSceneChannelId(
    scene: ChatScenePlan,
  ): string | undefined {
    if (scene.messages.length === 0) return undefined;

    const byPriority = [...scene.messages].sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority;
      return left.delayMs - right.delayMs;
    });

    return String(byPriority[0].channelId);
  }

  private toPressureBand(value: unknown): NoveltyPressureBand | undefined {
    const normalized = String(value ?? '').trim().toUpperCase();
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
