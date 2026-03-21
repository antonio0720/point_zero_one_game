
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT NOVELTY LEDGER
 * FILE: backend/src/game/engine/chat/intelligence/ChatNoveltyLedger.ts
 * VERSION: 2026.03.21-backend-depth-upgrade
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
 * 2. preserve channel / room / counterpart fatigue memory,
 * 3. keep scenes from collapsing into repetitive motif/rhetoric clusters,
 * 4. prepare deterministic novelty signals for persistence and downstream AI,
 * 5. provide backend-safe director hints without depending on frontend-only
 *    structures or relaxed message shapes.
 *
 * Guardrails
 * ----------
 * - Backend chat contracts are the source of truth.
 * - This file must remain compilable against backend/src/game/engine/chat/types.ts.
 * - No frontend-only message fields are allowed here.
 * - All metadata reads are defensive and typed through narrow helpers.
 * - Snapshot growth must remain restore-safe across minor schema changes.
 * ============================================================================
 */

import type {
  ChatMessage,
  ChatResponseCandidate,
  ChatScenePlan,
  ChatVisibleChannel,
  UnixMs,
} from '../types';
import type { BotId } from '../types';

/* ========================================================================== */
/* MARK: Module identity                                                      */
/* ========================================================================== */

export const CHAT_NOVELTY_LEDGER_MODULE_NAME =
  'PZO_BACKEND_CHAT_NOVELTY_LEDGER' as const;

export const CHAT_NOVELTY_LEDGER_VERSION =
  '2026.03.21-backend-depth-upgrade' as const;

export const CHAT_NOVELTY_LEDGER_RUNTIME_LAWS = Object.freeze([
  'Backend novelty is advisory for candidate ranking, not a source of transcript truth.',
  'A line can be fresh in wording and still stale in motif, rhetoric, cadence, or callback shape.',
  'Scenes are scored as clustered social pressure, not only as isolated messages.',
  'Channel fatigue, room fatigue, and counterpart fatigue are independent surfaces.',
  'Snapshots must restore cleanly even when new counters are added later.',
  'Every metadata read must survive absent or malformed values.',
  'Deterministic novelty ranking matters more than subjective randomness.',
  'The backend must remain contract-aligned with ChatMessage and ChatScenePlan.',
] as const);

/* ========================================================================== */
/* MARK: Public types                                                         */
/* ========================================================================== */

export type NoveltyPressureBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type NoveltyTemporalBand =
  | 'INSTANT'
  | 'SESSION'
  | 'DAY'
  | 'WEEK'
  | 'SEASON'
  | 'ARCHIVAL';

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
  readonly volatility01: number;
  readonly similarity01: number;
  readonly saturation01: number;
  readonly lastUpdatedAt: UnixMs;
  readonly dominantMotifs: readonly string[];
  readonly dominantForms: readonly string[];
  readonly dominantSemanticClusters: readonly string[];
  readonly dominantTags: readonly string[];
  readonly recentExactLines: readonly string[];
  readonly recentRoomIds: readonly string[];
  readonly recentBotIds: readonly string[];
}

export interface ChatNoveltyLedgerCandidateOverlap {
  readonly againstEventId: string;
  readonly occurredAt: UnixMs;
  readonly channelId?: string;
  readonly roomId?: string;
  readonly sameLine: boolean;
  readonly sameBot: boolean;
  readonly sameCounterpart: boolean;
  readonly sameRoom: boolean;
  readonly samePressureBand: boolean;
  readonly sameSemanticClusterCount: number;
  readonly sameMotifCount: number;
  readonly sameCallbackCount: number;
  readonly sameTagCount: number;
  readonly textOverlap01: number;
  readonly signatureOverlap01: number;
}

export interface ChatNoveltyLedgerDirectorHints {
  readonly preferredMotifs: readonly string[];
  readonly preferredRhetoricalForms: readonly string[];
  readonly preferredSemanticClusters: readonly string[];
  readonly excludedMotifs: readonly string[];
  readonly excludedRhetoricalForms: readonly string[];
  readonly excludedSemanticClusters: readonly string[];
  readonly excludedLineIds: readonly string[];
  readonly excludedTagIds: readonly string[];
  readonly avoidPressureBand?: NoveltyPressureBand;
  readonly recentBodies: readonly string[];
}

export interface ChatNoveltyLedgerChannelDiagnostics {
  readonly channelId: string;
  readonly fatigue: ChatNoveltyLedgerFatigue;
  readonly lineCount: number;
  readonly motifCount: number;
  readonly formCount: number;
  readonly semanticCount: number;
  readonly callbackCount: number;
  readonly samePressureBandCount: Readonly<Record<NoveltyPressureBand, number>>;
}

export interface ChatNoveltyLedgerRoomDiagnostics {
  readonly roomId: string;
  readonly eventCount: number;
  readonly uniqueChannelCount: number;
  readonly uniqueCounterpartCount: number;
  readonly uniqueBotCount: number;
  readonly lastOccurredAt?: UnixMs;
  readonly dominantMotifs: readonly string[];
  readonly dominantSemanticClusters: readonly string[];
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
  readonly overlapPenalty: number;
  readonly roomPenalty: number;
  readonly botPenalty: number;
  readonly signaturePenalty: number;
  readonly cadencePenalty: number;
  readonly diversityBoost: number;
  readonly notes: readonly string[];
  readonly overlaps: readonly ChatNoveltyLedgerCandidateOverlap[];
  readonly recommendedTemporalBand: NoveltyTemporalBand;
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
  readonly roomCounters?: readonly ChatNoveltyLedgerCounter[];
  readonly botCounters?: readonly ChatNoveltyLedgerCounter[];
  readonly tagCounters?: readonly ChatNoveltyLedgerCounter[];
  readonly pressureCounters?: readonly ChatNoveltyLedgerCounter[];
  readonly signatureCounters?: readonly ChatNoveltyLedgerCounter[];
  readonly phraseCounters?: readonly ChatNoveltyLedgerCounter[];
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
  readonly roomPenalty?: number;
  readonly botPenalty?: number;
  readonly signaturePenalty?: number;
  readonly overlapPenalty?: number;
  readonly cadencePenalty?: number;
  readonly diversityBoostCap?: number;
  readonly sameBandSaturationPenalty?: number;
  readonly maxRecentBodiesInHints?: number;
  readonly shingleWindow?: number;
  readonly maxPairwiseOverlapComparisons?: number;
  readonly volatilityWindow?: number;
}

export const CHAT_NOVELTY_LEDGER_DEFAULTS: Required<ChatNoveltyLedgerOptions> =
  Object.freeze({
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
    roomPenalty: 0.06,
    botPenalty: 0.08,
    signaturePenalty: 0.12,
    overlapPenalty: 0.24,
    cadencePenalty: 0.08,
    diversityBoostCap: 0.18,
    sameBandSaturationPenalty: 0.06,
    maxRecentBodiesInHints: 12,
    shingleWindow: 3,
    maxPairwiseOverlapComparisons: 16,
    volatilityWindow: 24,
  });

const DEFAULT_OPTIONS = CHAT_NOVELTY_LEDGER_DEFAULTS;

/* ========================================================================== */
/* MARK: Private support types                                                */
/* ========================================================================== */

interface NormalizedNoveltyCandidate {
  readonly candidateId: string;
  readonly occurredAt: UnixMs;
  readonly lineId?: string;
  readonly botId?: string;
  readonly counterpartId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly pressureBand?: NoveltyPressureBand;
  readonly motifIds: readonly string[];
  readonly rhetoricalForms: readonly string[];
  readonly sceneRoles: readonly string[];
  readonly semanticClusterIds: readonly string[];
  readonly callbackSourceIds: readonly string[];
  readonly tags: readonly string[];
  readonly text?: string;
  readonly normalizedText: string;
  readonly tokens: readonly string[];
  readonly signatureParts: readonly string[];
  readonly signatureKey: string;
  readonly phraseKeys: readonly string[];
}

interface ChannelWindowSample {
  readonly occurredAt: UnixMs;
  readonly textOverlap01: number;
  readonly signatureOverlap01: number;
}

type CounterMap = Map<string, ChatNoveltyLedgerCounter>;

/* ========================================================================== */
/* MARK: Utilities                                                            */
/* ========================================================================== */

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function clampPositiveInteger(value: number, floor = 1): number {
  if (!Number.isFinite(value)) return floor;
  if (value < floor) return floor;
  return Math.round(value);
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

function tokenizeText(text: string): readonly string[] {
  const matches = text.match(/[a-z0-9]+(?:['’][a-z0-9]+)?/g);
  if (!matches) return [];
  return matches.map((token) => token.toLowerCase());
}

function createShingles(tokens: readonly string[], window: number): readonly string[] {
  if (!tokens.length) return [];
  if (tokens.length <= window) return [tokens.join('_')];
  const values: string[] = [];
  for (let index = 0; index <= tokens.length - window; index += 1) {
    values.push(tokens.slice(index, index + window).join('_'));
  }
  return values;
}

function jaccardSimilarity(a: readonly string[], b: readonly string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const value of setA) {
    if (setB.has(value)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  if (union <= 0) return 0;
  return clamp01(intersection / union);
}

function overlapCount(a: readonly string[], b: readonly string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let total = 0;
  for (const value of a) {
    if (setB.has(value)) total += 1;
  }
  return total;
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
  counters: readonly ChatNoveltyLedgerCounter[] | undefined,
): void {
  target.clear();
  if (!counters?.length) return;
  for (const counter of counters) {
    target.set(counter.key, { ...counter });
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

function topKeysByCount(
  map: ReadonlyMap<string, number>,
  limit: number,
): readonly string[] {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key]) => key);
}

function temporalBandForAge(
  ageMs: number,
  options: Required<ChatNoveltyLedgerOptions>,
): NoveltyTemporalBand {
  if (ageMs <= 60_000) return 'INSTANT';
  if (ageMs <= options.sessionLookbackMs) return 'SESSION';
  if (ageMs <= options.dayLookbackMs) return 'DAY';
  if (ageMs <= options.weekLookbackMs) return 'WEEK';
  if (ageMs <= options.seasonLookbackMs) return 'SEASON';
  return 'ARCHIVAL';
}

function decayFactorForAge(
  ageMs: number,
  options: Required<ChatNoveltyLedgerOptions>,
): number {
  if (ageMs <= 60_000) return 1.10;
  if (ageMs <= options.sessionLookbackMs) return 1.0;
  if (ageMs <= options.dayLookbackMs) return 0.65;
  if (ageMs <= options.weekLookbackMs) return 0.35;
  if (ageMs <= options.seasonLookbackMs) return 0.15;
  return 0.05;
}

function coerceUnixMs(value: unknown, fallback: number): UnixMs {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value as UnixMs;
  }
  return fallback as UnixMs;
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

/* ========================================================================== */
/* MARK: Ledger                                                               */
/* ========================================================================== */

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

  private readonly roomCounters: CounterMap = new Map();
  private readonly botCounters: CounterMap = new Map();
  private readonly tagCounters: CounterMap = new Map();
  private readonly pressureCounters: CounterMap = new Map();
  private readonly signatureCounters: CounterMap = new Map();
  private readonly phraseCounters: CounterMap = new Map();

  public constructor(
    options: ChatNoveltyLedgerOptions = {},
    now: UnixMs = Date.now() as UnixMs,
  ) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      shingleWindow: clampPositiveInteger(
        options.shingleWindow ?? DEFAULT_OPTIONS.shingleWindow,
      ),
      maxPairwiseOverlapComparisons: clampPositiveInteger(
        options.maxPairwiseOverlapComparisons ??
          DEFAULT_OPTIONS.maxPairwiseOverlapComparisons,
      ),
      volatilityWindow: clampPositiveInteger(
        options.volatilityWindow ?? DEFAULT_OPTIONS.volatilityWindow,
      ),
      maxRecentBodiesInHints: clampPositiveInteger(
        options.maxRecentBodiesInHints ?? DEFAULT_OPTIONS.maxRecentBodiesInHints,
      ),
    };
    this.createdAt = now;
    this.updatedAt = now;
  }

  /* ------------------------------------------------------------------------ */
  /* MARK: Lifecycle                                                          */
  /* ------------------------------------------------------------------------ */

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

    hydrateCounterMap(this.roomCounters, snapshot.roomCounters);
    hydrateCounterMap(this.botCounters, snapshot.botCounters);
    hydrateCounterMap(this.tagCounters, snapshot.tagCounters);
    hydrateCounterMap(this.pressureCounters, snapshot.pressureCounters);
    hydrateCounterMap(this.signatureCounters, snapshot.signatureCounters);
    hydrateCounterMap(this.phraseCounters, snapshot.phraseCounters);

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
      roomCounters: mapValues(this.roomCounters),
      botCounters: mapValues(this.botCounters),
      tagCounters: mapValues(this.tagCounters),
      pressureCounters: mapValues(this.pressureCounters),
      signatureCounters: mapValues(this.signatureCounters),
      phraseCounters: mapValues(this.phraseCounters),
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

    this.roomCounters.clear();
    this.botCounters.clear();
    this.tagCounters.clear();
    this.pressureCounters.clear();
    this.signatureCounters.clear();
    this.phraseCounters.clear();

    this.updatedAt = now;
    return this;
  }

  /* ------------------------------------------------------------------------ */
  /* MARK: Event ingestion                                                    */
  /* ------------------------------------------------------------------------ */

  public noteMessage(
    message: ChatMessage,
    now: UnixMs = message.createdAt,
  ): void {
    const metadata = metadataRecordOf(message);

    this.noteEvent({
      eventId: String(message.id),
      occurredAt: coerceUnixMs(now, Number(message.createdAt)),
      lineId: String(message.id),
      botId: message.attribution.botId ?? null,
      counterpartId: message.attribution.actorId ?? null,
      roomId: String(message.roomId),
      channelId: String(message.channelId),
      pressureBand: this.extractPressureBandFromMessage(message, metadata),
      motifIds: this.extractMotifsFromMessage(message),
      rhetoricalForms: this.extractRhetoricalFormsFromText(message.plainText),
      sceneRoles: this.extractSceneRolesFromMessage(message),
      semanticClusterIds: this.extractSemanticKeysFromText(
        message.plainText,
        message.tags,
        message,
      ),
      callbackSourceIds: this.extractCallbackSourceIdsFromMessage(message),
      tags: message.tags,
      text: message.plainText,
    });
  }

  public noteMessages(
    messages: readonly ChatMessage[],
    now: UnixMs = Date.now() as UnixMs,
  ): void {
    for (const message of messages) {
      this.noteMessage(message, coerceUnixMs(message.createdAt, now));
    }
  }

  public noteResponseCandidate(
    candidate: ChatResponseCandidate,
    now: UnixMs = Date.now() as UnixMs,
  ): void {
    const lineId = this.buildResponseCandidateLineId(candidate);
    this.noteEvent({
      eventId: lineId,
      occurredAt: now,
      lineId,
      botId: null,
      counterpartId: String(candidate.personaId),
      roomId: String(candidate.roomId),
      channelId: String(candidate.channelId),
      pressureBand: this.extractPressureBandFromTags(candidate.tags, candidate.text),
      motifIds: this.extractMotifsFromResponseCandidate(candidate),
      rhetoricalForms: this.extractRhetoricalFormsFromText(candidate.text),
      sceneRoles: this.extractSceneRolesFromResponseCandidate(candidate),
      semanticClusterIds: this.extractSemanticKeysFromText(candidate.text, candidate.tags),
      callbackSourceIds: this.extractCallbackSourceIdsFromResponseCandidate(candidate),
      tags: candidate.tags,
      text: candidate.text,
    });
  }

  public noteScene(
    scene: ChatScenePlan,
    channelId?: ChatVisibleChannel,
    now: UnixMs = scene.openedAt,
  ): void {
    const effectiveChannelId = channelId ?? this.deriveSceneChannelId(scene);

    this.noteEvent({
      eventId: String(scene.sceneId),
      occurredAt: coerceUnixMs(now, Number(scene.openedAt)),
      lineId: undefined,
      botId: null,
      counterpartId: null,
      roomId: String(scene.roomId),
      channelId: effectiveChannelId != null ? String(effectiveChannelId) : null,
      pressureBand: this.extractScenePressureBand(scene),
      motifIds: this.extractMotifsFromScene(scene),
      rhetoricalForms: this.extractRhetoricalFormsFromScene(scene),
      sceneRoles: this.extractSceneRolesFromScene(scene),
      semanticClusterIds: this.extractSemanticKeysFromScene(scene),
      callbackSourceIds: this.extractCallbackSourceIdsFromScene(scene),
      tags: this.extractSceneTags(scene),
      text: undefined,
    });

    for (const candidate of scene.messages) {
      this.noteResponseCandidate(
        candidate,
        (Number(scene.openedAt) + Math.max(0, candidate.delayMs)) as UnixMs,
      );
    }
  }

  public noteEvent(event: ChatNoveltyLedgerEvent): void {
    const normalized = this.normalizeEvent(event);
    this.updatedAt = normalized.occurredAt;
    const materialized = this.materializeEvent(normalized);
    this.recentEvents.push(copyEvent(materialized));

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
      pushCounter(this.tagCounters, tag, normalized.occurredAt);
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
    if (normalized.roomId) {
      pushCounter(this.roomCounters, normalized.roomId, normalized.occurredAt);
    }
    if (normalized.botId) {
      pushCounter(this.botCounters, normalized.botId, normalized.occurredAt);
    }
    if (normalized.pressureBand) {
      pushCounter(
        this.pressureCounters,
        normalized.pressureBand,
        normalized.occurredAt,
      );
    }

    pushCounter(
      this.signatureCounters,
      normalized.signatureKey,
      normalized.occurredAt,
    );

    for (const phraseKey of normalized.phraseKeys) {
      pushCounter(this.phraseCounters, phraseKey, normalized.occurredAt);
    }

    this.prune(normalized.occurredAt);
  }

  /* ------------------------------------------------------------------------ */
  /* MARK: Scoring                                                            */
  /* ------------------------------------------------------------------------ */

  public scoreCandidate(
    candidate: ChatNoveltyLedgerCandidate,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatNoveltyLedgerScore {
    const normalized = this.normalizeCandidate(candidate, now);

    const exactLinePenalty = normalized.lineId
      ? this.computePenalty(
          this.lineCounters.get(normalized.lineId),
          now,
          this.options.exactRepeatPenalty,
        )
      : 0;
    const motifPenalty = this.computeAggregatePenalty(
      normalized.motifIds,
      this.motifCounters,
      now,
      this.options.motifPenalty,
    );
    const rhetoricPenalty = this.computeAggregatePenalty(
      normalized.rhetoricalForms,
      this.rhetoricalCounters,
      now,
      this.options.rhetoricPenalty,
    );
    const semanticPenalty = this.computeAggregatePenalty(
      normalized.semanticClusterIds,
      this.semanticCounters,
      now,
      this.options.semanticPenalty,
    );
    const callbackPenalty = this.computeAggregatePenalty(
      normalized.callbackSourceIds,
      this.callbackCounters,
      now,
      this.options.callbackPenalty,
    );
    const scenePenalty = this.computeAggregatePenalty(
      normalized.sceneRoles,
      this.sceneRoleCounters,
      now,
      this.options.scenePenalty,
    );
    const tagPenalty = this.computeAggregatePenalty(
      normalized.tags,
      this.tagCounters,
      now,
      this.options.tagPenalty,
    );
    const channelPenalty = normalized.channelId
      ? this.computePenalty(
          this.channelCounters.get(`channel:${normalized.channelId}`),
          now,
          this.options.channelPenalty,
        )
      : 0;
    const counterpartPenalty = normalized.counterpartId
      ? this.computePenalty(
          this.counterpartCounters.get(normalized.counterpartId),
          now,
          this.options.counterpartPenalty,
        )
      : 0;
    const pressurePenalty = normalized.pressureBand
      ? this.computePressurePenalty(normalized.pressureBand, now)
      : 0;
    const roomPenalty = normalized.roomId
      ? this.computePenalty(
          this.roomCounters.get(normalized.roomId),
          now,
          this.options.roomPenalty,
        )
      : 0;
    const botPenalty = normalized.botId
      ? this.computePenalty(
          this.botCounters.get(normalized.botId),
          now,
          this.options.botPenalty,
        )
      : 0;
    const signaturePenalty = this.computePenalty(
      this.signatureCounters.get(normalized.signatureKey),
      now,
      this.options.signaturePenalty,
    );

    const overlapSummary = this.computeOverlapSummary(normalized, now);
    const cadencePenalty = this.computeCadencePenalty(normalized, now);

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
        pressurePenalty +
        roomPenalty +
        botPenalty +
        signaturePenalty +
        overlapSummary.overlapPenalty +
        cadencePenalty,
    );

    const freshnessBoost = this.computeFreshnessBoost(normalized, now);
    const unseenFacetBoost = this.computeUnseenFacetBoost(normalized);
    const diversityBoost = this.computeDiversityBoost(normalized, now);
    const fatigueRisk = normalized.channelId
      ? this.getChannelFatigueScore(normalized.channelId, now)
      : 0;

    const noveltyScore01 = clamp01(
      1 -
        penaltyTotal +
        freshnessBoost +
        unseenFacetBoost +
        diversityBoost -
        (fatigueRisk * 0.15),
    );

    const notes: string[] = [];
    if (exactLinePenalty > 0.30) notes.push('exact_line_recent');
    if (motifPenalty > 0.12) notes.push('motif_overused');
    if (rhetoricPenalty > 0.08) notes.push('rhetoric_overused');
    if (semanticPenalty > 0.10) notes.push('semantic_cluster_familiar');
    if (callbackPenalty > 0.06) notes.push('callback_recent');
    if (channelPenalty > 0.04) notes.push('channel_repeated');
    if (counterpartPenalty > 0.05) notes.push('counterpart_repeated');
    if (pressurePenalty > 0.08) notes.push('pressure_band_saturated');
    if (roomPenalty > 0.04) notes.push('room_repeated');
    if (botPenalty > 0.05) notes.push('bot_repeated');
    if (signaturePenalty > 0.06) notes.push('signature_repeated');
    if (overlapSummary.overlapPenalty > 0.10) notes.push('overlap_detected');
    if (cadencePenalty > 0.05) notes.push('cadence_collapse');
    if (fatigueRisk > 0.50) notes.push('channel_fatigue_elevated');
    if (freshnessBoost > 0.15) notes.push('freshness_bonus');
    if (unseenFacetBoost > 0.10) notes.push('unseen_facets');
    if (diversityBoost > 0.08) notes.push('diversity_bonus');

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
      overlapPenalty: overlapSummary.overlapPenalty,
      roomPenalty,
      botPenalty,
      signaturePenalty,
      cadencePenalty,
      diversityBoost,
      notes,
      overlaps: overlapSummary.overlaps,
      recommendedTemporalBand: overlapSummary.recommendedTemporalBand,
    };
  }

  public explainCandidate(
    candidate: ChatNoveltyLedgerCandidate,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatNoveltyLedgerScore {
    return this.scoreCandidate(candidate, now);
  }

  public scoreResponseCandidate(
    candidate: ChatResponseCandidate,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatNoveltyLedgerScore {
    return this.scoreCandidate(
      this.buildNoveltyCandidateFromResponseCandidate(candidate),
      now,
    );
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

  public rankResponseCandidates(
    candidates: readonly ChatResponseCandidate[],
    now: UnixMs = Date.now() as UnixMs,
  ): readonly ChatNoveltyLedgerScore[] {
    return candidates
      .map((candidate) => this.scoreResponseCandidate(candidate, now))
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

  /* ------------------------------------------------------------------------ */
  /* MARK: Hints + diagnostics                                                */
  /* ------------------------------------------------------------------------ */

  public getDirectorHints(
    channelId: string,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatNoveltyLedgerDirectorHints {
    const exclusions = this.getSuggestedExclusions(channelId, now);
    const recent = this.getRecentChannelEvents(channelId, now);
    const motifCounts = new Map<string, number>();
    const formCounts = new Map<string, number>();
    const semanticCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    const pressureCounts = new Map<NoveltyPressureBand, number>();

    for (const event of recent) {
      for (const motif of event.motifIds) {
        motifCounts.set(motif, (motifCounts.get(motif) ?? 0) + 1);
      }
      for (const rhetoricalForm of event.rhetoricalForms) {
        formCounts.set(
          rhetoricalForm,
          (formCounts.get(rhetoricalForm) ?? 0) + 1,
        );
      }
      for (const semanticClusterId of event.semanticClusterIds) {
        semanticCounts.set(
          semanticClusterId,
          (semanticCounts.get(semanticClusterId) ?? 0) + 1,
        );
      }
      for (const tag of event.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
      if (event.pressureBand) {
        pressureCounts.set(
          event.pressureBand,
          (pressureCounts.get(event.pressureBand) ?? 0) + 1,
        );
      }
    }

    const recentBodies = recent
      .map((event) => event.text)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .slice(-this.options.maxRecentBodiesInHints);

    return {
      preferredMotifs: this.selectUnderservedKeys(
        motifCounts,
        exclusions.motifIds,
      ),
      preferredRhetoricalForms: this.selectUnderservedKeys(
        formCounts,
        exclusions.rhetoricalForms,
      ),
      preferredSemanticClusters: this.selectUnderservedKeys(
        semanticCounts,
        exclusions.semanticClusterIds,
      ),
      excludedMotifs: exclusions.motifIds,
      excludedRhetoricalForms: exclusions.rhetoricalForms,
      excludedSemanticClusters: exclusions.semanticClusterIds,
      excludedLineIds: exclusions.lineIds,
      excludedTagIds: topKeysByCount(tagCounts, 4),
      avoidPressureBand: this.mostSaturatedPressureBand(pressureCounts),
      recentBodies,
    };
  }

  public getChannelDiagnostics(
    channelId: string,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatNoveltyLedgerChannelDiagnostics {
    const recent = this.getRecentChannelEvents(channelId, now);
    const pressureCounts: Record<NoveltyPressureBand, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    const motifPool = new Set<string>();
    const formPool = new Set<string>();
    const semanticPool = new Set<string>();
    const callbackPool = new Set<string>();

    for (const event of recent) {
      if (event.pressureBand) pressureCounts[event.pressureBand] += 1;
      for (const motif of event.motifIds) motifPool.add(motif);
      for (const form of event.rhetoricalForms) formPool.add(form);
      for (const semantic of event.semanticClusterIds) semanticPool.add(semantic);
      for (const callback of event.callbackSourceIds) callbackPool.add(callback);
    }

    return {
      channelId,
      fatigue: this.buildChannelFatigue(channelId, now),
      lineCount: recent.filter((item) => Boolean(item.lineId)).length,
      motifCount: motifPool.size,
      formCount: formPool.size,
      semanticCount: semanticPool.size,
      callbackCount: callbackPool.size,
      samePressureBandCount: pressureCounts,
    };
  }

  public getRoomDiagnostics(
    roomId: string,
    now: UnixMs = Date.now() as UnixMs,
  ): ChatNoveltyLedgerRoomDiagnostics {
    const normalizedRoomId = normalizeToken(roomId);
    const events = this.recentEvents.filter(
      (event) =>
        normalizeToken(String(event.roomId ?? '')) === normalizedRoomId &&
        Number(now) - Number(event.occurredAt) <= this.options.weekLookbackMs,
    );

    const channelIds = new Set<string>();
    const counterparts = new Set<string>();
    const botIds = new Set<string>();
    const motifCounts = new Map<string, number>();
    const semanticCounts = new Map<string, number>();

    let lastOccurredAt: UnixMs | undefined;
    for (const event of events) {
      if (event.channelId) channelIds.add(String(event.channelId));
      if (event.counterpartId) counterparts.add(String(event.counterpartId));
      if (event.botId) botIds.add(String(event.botId));
      if (lastOccurredAt == null || Number(event.occurredAt) > Number(lastOccurredAt)) {
        lastOccurredAt = event.occurredAt;
      }
      for (const motif of event.motifIds) {
        motifCounts.set(motif, (motifCounts.get(motif) ?? 0) + 1);
      }
      for (const semantic of event.semanticClusterIds) {
        semanticCounts.set(semantic, (semanticCounts.get(semantic) ?? 0) + 1);
      }
    }

    return {
      roomId,
      eventCount: events.length,
      uniqueChannelCount: channelIds.size,
      uniqueCounterpartCount: counterparts.size,
      uniqueBotCount: botIds.size,
      lastOccurredAt,
      dominantMotifs: topKeysByCount(motifCounts, 6),
      dominantSemanticClusters: topKeysByCount(semanticCounts, 6),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* MARK: Fatigue + exclusion surfaces                                       */
  /* ------------------------------------------------------------------------ */

  public getFatigueByChannel(
    now: UnixMs = Date.now() as UnixMs,
  ): readonly ChatNoveltyLedgerFatigue[] {
    const channelIds = new Set<string>();
    for (const event of this.recentEvents) {
      if (event.channelId) channelIds.add(String(event.channelId));
    }

    return [...channelIds]
      .map((channelId) => this.buildChannelFatigue(channelId, now))
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
    const counter = this.lineCounters.get(normalizeToken(lineId));
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

    this.pruneCounterMap(this.lineCounters, keepAfter);
    this.pruneCounterMap(this.motifCounters, keepAfter);
    this.pruneCounterMap(this.rhetoricalCounters, keepAfter);
    this.pruneCounterMap(this.semanticCounters, keepAfter);
    this.pruneCounterMap(this.sceneRoleCounters, keepAfter);
    this.pruneCounterMap(this.counterpartCounters, keepAfter);
    this.pruneCounterMap(this.callbackCounters, keepAfter);
    this.pruneCounterMap(this.channelCounters, keepAfter);

    this.pruneCounterMap(this.roomCounters, keepAfter);
    this.pruneCounterMap(this.botCounters, keepAfter);
    this.pruneCounterMap(this.tagCounters, keepAfter);
    this.pruneCounterMap(this.pressureCounters, keepAfter);
    this.pruneCounterMap(this.signatureCounters, keepAfter);
    this.pruneCounterMap(this.phraseCounters, keepAfter);
  }

  /* ------------------------------------------------------------------------ */
  /* MARK: Penalty / boost helpers                                            */
  /* ------------------------------------------------------------------------ */

  private pruneCounterMap(target: CounterMap, keepAfter: number): void {
    for (const [key, counter] of target.entries()) {
      if (Number(counter.lastSeenAt) < keepAfter) {
        target.delete(key);
      }
    }
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
    const decayFactor = decayFactorForAge(ageMs, this.options);
    const saturation = Math.min(1.35, 1 + ((counter.totalSeen - 1) * 0.08));
    return clamp01(basePenalty * decayFactor * saturation);
  }

  private computePressurePenalty(
    pressureBand: NoveltyPressureBand,
    now: UnixMs,
  ): number {
    const counter = this.pressureCounters.get(pressureBand);
    const base = this.computePenalty(counter, now, this.options.pressurePenalty);
    if (!this.isPressureBandSaturated(pressureBand, now)) return base;
    return clamp01(base + this.options.sameBandSaturationPenalty);
  }

  private isPressureBandSaturated(
    pressureBand: NoveltyPressureBand,
    now: UnixMs,
  ): boolean {
    const recent = this.recentEvents
      .filter((item) => item.pressureBand === pressureBand)
      .filter(
        (item) =>
          Number(now) - Number(item.occurredAt) <= this.options.sessionLookbackMs,
      ).length;
    return recent >= 4;
  }

  private computeFreshnessBoost(
    candidate: NormalizedNoveltyCandidate,
    now: UnixMs,
  ): number {
    let unseenFacetCount = 0;

    for (const motifId of candidate.motifIds) {
      if (!this.motifCounters.has(motifId)) unseenFacetCount += 1;
    }
    for (const rhetoricalForm of candidate.rhetoricalForms) {
      if (!this.rhetoricalCounters.has(rhetoricalForm)) unseenFacetCount += 1;
    }
    for (const semanticClusterId of candidate.semanticClusterIds) {
      if (!this.semanticCounters.has(semanticClusterId)) unseenFacetCount += 1;
    }
    for (const sceneRole of candidate.sceneRoles) {
      if (!this.sceneRoleCounters.has(sceneRole)) unseenFacetCount += 1;
    }
    for (const callbackSourceId of candidate.callbackSourceIds) {
      if (!this.callbackCounters.has(callbackSourceId)) unseenFacetCount += 1;
    }

    const freshnessAge = candidate.lineId
      ? this.lineCounters.get(candidate.lineId)?.lastSeenAt
      : undefined;

    const freshnessWindowBoost =
      freshnessAge == null
        ? this.options.freshnessBoostCap
        : Math.min(
            this.options.freshnessBoostCap,
            Math.max(
              0,
              (Number(now) - Number(freshnessAge)) / this.options.weekLookbackMs,
            ) * 0.10,
          );

    return clamp01(freshnessWindowBoost + (unseenFacetCount * 0.02));
  }

  private computeUnseenFacetBoost(
    candidate: NormalizedNoveltyCandidate,
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
    if (candidate.roomId && !this.roomCounters.has(candidate.roomId)) score += 0.02;
    if (candidate.botId && !this.botCounters.has(candidate.botId)) score += 0.03;
    if (!this.signatureCounters.has(candidate.signatureKey)) score += 0.04;

    return clamp01(score);
  }

  private computeDiversityBoost(
    candidate: NormalizedNoveltyCandidate,
    now: UnixMs,
  ): number {
    if (!candidate.channelId) return 0;
    const recent = this.getRecentChannelEvents(candidate.channelId, now);
    if (!recent.length) return this.options.diversityBoostCap;

    const motifPool = new Set<string>();
    const formPool = new Set<string>();
    const semanticPool = new Set<string>();
    const tagPool = new Set<string>();

    for (const event of recent) {
      for (const motif of event.motifIds) motifPool.add(motif);
      for (const rhetoricalForm of event.rhetoricalForms) formPool.add(rhetoricalForm);
      for (const semanticClusterId of event.semanticClusterIds) {
        semanticPool.add(semanticClusterId);
      }
      for (const tag of event.tags) tagPool.add(tag);
    }

    let diversityScore = 0;
    diversityScore += this.countMissing(candidate.motifIds, motifPool) * 0.025;
    diversityScore += this.countMissing(candidate.rhetoricalForms, formPool) * 0.020;
    diversityScore += this.countMissing(candidate.semanticClusterIds, semanticPool) * 0.025;
    diversityScore += this.countMissing(candidate.tags, tagPool) * 0.015;

    return clamp01(Math.min(diversityScore, this.options.diversityBoostCap));
  }

  private computeCadencePenalty(
    candidate: NormalizedNoveltyCandidate,
    now: UnixMs,
  ): number {
    if (!candidate.channelId) return 0;
    const recent = this.getRecentChannelEvents(candidate.channelId, now);
    if (recent.length < 2) return 0;

    const lastThree = recent.slice(-3);
    const lastEvent = this.normalizeEvent(lastThree[lastThree.length - 1]);
    const secondLastEvent =
      lastThree.length >= 2
        ? this.normalizeEvent(lastThree[lastThree.length - 2])
        : undefined;

    let cadencePenalty = 0;

    if (
      candidate.botId &&
      lastEvent.botId &&
      normalizeToken(lastEvent.botId) === candidate.botId
    ) {
      cadencePenalty += this.options.cadencePenalty * 0.45;
    }

    if (
      candidate.counterpartId &&
      secondLastEvent?.counterpartId &&
      normalizeToken(secondLastEvent.counterpartId) === candidate.counterpartId
    ) {
      cadencePenalty += this.options.cadencePenalty * 0.20;
    }

    const recentWindowMs =
      Number(lastEvent.occurredAt) -
      Number(secondLastEvent?.occurredAt ?? lastEvent.occurredAt);

    if (recentWindowMs <= 10_000) {
      cadencePenalty += this.options.cadencePenalty * 0.20;
    }

    if (
      candidate.pressureBand &&
      lastEvent.pressureBand === candidate.pressureBand &&
      secondLastEvent?.pressureBand === candidate.pressureBand
    ) {
      cadencePenalty += this.options.cadencePenalty * 0.25;
    }

    return clamp01(cadencePenalty);
  }

  private computeOverlapSummary(
    candidate: NormalizedNoveltyCandidate,
    now: UnixMs,
  ): {
    readonly overlaps: readonly ChatNoveltyLedgerCandidateOverlap[];
    readonly overlapPenalty: number;
    readonly recommendedTemporalBand: NoveltyTemporalBand;
  } {
    const relevant = this.recentEvents
      .filter((event) => {
        if (candidate.channelId) {
          return normalizeToken(String(event.channelId ?? '')) === candidate.channelId;
        }
        if (candidate.roomId) {
          return normalizeToken(String(event.roomId ?? '')) === candidate.roomId;
        }
        return true;
      })
      .slice(-this.options.maxPairwiseOverlapComparisons);

    const overlaps: ChatNoveltyLedgerCandidateOverlap[] = [];
    let maxAgeMs = this.options.seasonLookbackMs;

    for (const event of relevant) {
      const normalizedEvent = this.normalizeEvent(event);
      const textOverlap01 = candidate.normalizedText
        ? jaccardSimilarity(candidate.phraseKeys, normalizedEvent.phraseKeys)
        : 0;
      const signatureOverlap01 = jaccardSimilarity(
        candidate.signatureParts,
        normalizedEvent.signatureParts,
      );

      const overlap: ChatNoveltyLedgerCandidateOverlap = {
        againstEventId: normalizedEvent.candidateId,
        occurredAt: normalizedEvent.occurredAt,
        channelId: normalizedEvent.channelId,
        roomId: normalizedEvent.roomId,
        sameLine:
          Boolean(candidate.lineId) &&
          Boolean(normalizedEvent.lineId) &&
          candidate.lineId === normalizedEvent.lineId,
        sameBot:
          Boolean(candidate.botId) &&
          Boolean(normalizedEvent.botId) &&
          candidate.botId === normalizedEvent.botId,
        sameCounterpart:
          Boolean(candidate.counterpartId) &&
          Boolean(normalizedEvent.counterpartId) &&
          candidate.counterpartId === normalizedEvent.counterpartId,
        sameRoom:
          Boolean(candidate.roomId) &&
          Boolean(normalizedEvent.roomId) &&
          candidate.roomId === normalizedEvent.roomId,
        samePressureBand:
          Boolean(candidate.pressureBand) &&
          Boolean(normalizedEvent.pressureBand) &&
          candidate.pressureBand === normalizedEvent.pressureBand,
        sameSemanticClusterCount: overlapCount(
          candidate.semanticClusterIds,
          normalizedEvent.semanticClusterIds,
        ),
        sameMotifCount: overlapCount(candidate.motifIds, normalizedEvent.motifIds),
        sameCallbackCount: overlapCount(
          candidate.callbackSourceIds,
          normalizedEvent.callbackSourceIds,
        ),
        sameTagCount: overlapCount(candidate.tags, normalizedEvent.tags),
        textOverlap01,
        signatureOverlap01,
      };

      if (
        overlap.sameLine ||
        overlap.textOverlap01 > 0 ||
        overlap.signatureOverlap01 > 0 ||
        overlap.sameSemanticClusterCount > 0 ||
        overlap.sameMotifCount > 0 ||
        overlap.sameCallbackCount > 0 ||
        overlap.sameTagCount > 0
      ) {
        overlaps.push(overlap);
        const ageMs = Math.max(
          0,
          Number(now) - Number(normalizedEvent.occurredAt),
        );
        if (ageMs < maxAgeMs) maxAgeMs = ageMs;
      }
    }

    let overlapPenalty = 0;
    for (const overlap of overlaps) {
      if (overlap.sameLine) overlapPenalty += this.options.overlapPenalty * 0.60;
      overlapPenalty += overlap.textOverlap01 * this.options.overlapPenalty * 0.55;
      overlapPenalty += overlap.signatureOverlap01 * this.options.overlapPenalty * 0.45;
      overlapPenalty +=
        Math.min(1, overlap.sameSemanticClusterCount * 0.25) *
        this.options.overlapPenalty *
        0.20;
      overlapPenalty +=
        Math.min(1, overlap.sameMotifCount * 0.20) *
        this.options.overlapPenalty *
        0.15;
      overlapPenalty +=
        Math.min(1, overlap.sameCallbackCount * 0.34) *
        this.options.overlapPenalty *
        0.10;
      overlapPenalty +=
        Math.min(1, overlap.sameTagCount * 0.25) *
        this.options.overlapPenalty *
        0.08;
    }

    return {
      overlaps: overlaps.sort((left, right) => {
        if (left.textOverlap01 !== right.textOverlap01) {
          return right.textOverlap01 - left.textOverlap01;
        }
        if (left.signatureOverlap01 !== right.signatureOverlap01) {
          return right.signatureOverlap01 - left.signatureOverlap01;
        }
        return Number(right.occurredAt) - Number(left.occurredAt);
      }),
      overlapPenalty: clamp01(Math.min(overlapPenalty, this.options.overlapPenalty)),
      recommendedTemporalBand: temporalBandForAge(maxAgeMs, this.options),
    };
  }

  /* ------------------------------------------------------------------------ */
  /* MARK: Fatigue helpers                                                    */
  /* ------------------------------------------------------------------------ */

  private buildChannelFatigue(
    channelId: string,
    now: UnixMs,
  ): ChatNoveltyLedgerFatigue {
    const metrics = this.computeFatigueMetrics(channelId, now);
    const recent = this.getRecentChannelEvents(channelId, now);

    return {
      channelId,
      fatigue01: metrics.fatigue01,
      volatility01: metrics.volatility01,
      similarity01: metrics.similarity01,
      saturation01: metrics.saturation01,
      lastUpdatedAt: now,
      dominantMotifs: this.getDominantKeys(channelId, 'motif', now),
      dominantForms: this.getDominantKeys(channelId, 'form', now),
      dominantSemanticClusters: this.getDominantKeys(channelId, 'semantic', now),
      dominantTags: this.getDominantKeys(channelId, 'tag', now),
      recentExactLines: recent
        .filter((item) => item.lineId)
        .slice(-6)
        .map((item) => String(item.lineId)),
      recentRoomIds: uniqueStrings(
        recent
          .map((item) => normalizeToken(String(item.roomId ?? '')))
          .filter(Boolean),
      ),
      recentBotIds: uniqueStrings(
        recent
          .map((item) => normalizeToken(String(item.botId ?? '')))
          .filter(Boolean),
      ),
    };
  }

  private computeFatigueMetrics(
    channelId: string,
    now: UnixMs,
  ): {
    readonly fatigue01: number;
    readonly volatility01: number;
    readonly similarity01: number;
    readonly saturation01: number;
  } {
    const sessionRecent = this.getRecentChannelEvents(channelId, now);
    if (!sessionRecent.length) {
      return {
        fatigue01: 0,
        volatility01: 0,
        similarity01: 0,
        saturation01: 0,
      };
    }

    const motifVariety = new Set(
      sessionRecent.flatMap((item) => item.motifIds),
    ).size;
    const rhetoricVariety = new Set(
      sessionRecent.flatMap((item) => item.rhetoricalForms),
    ).size;
    const semanticVariety = new Set(
      sessionRecent.flatMap((item) => item.semanticClusterIds),
    ).size;
    const exactLinePressure =
      new Set(
        sessionRecent.map((item) => item.lineId).filter(Boolean),
      ).size / Math.max(1, sessionRecent.length);

    const repetition =
      1 -
      (motifVariety + rhetoricVariety + semanticVariety) /
        Math.max(1, sessionRecent.length * 3);

    const similarityPairs = this.computeChannelPairwiseSamples(sessionRecent);
    const similarity01 = similarityPairs.length
      ? clamp01(
          similarityPairs.reduce(
            (sum, item) =>
              sum + Math.max(item.textOverlap01, item.signatureOverlap01),
            0,
          ) / similarityPairs.length,
        )
      : 0;

    const pressureBandCounts = new Map<string, number>();
    for (const event of sessionRecent) {
      if (!event.pressureBand) continue;
      pressureBandCounts.set(
        event.pressureBand,
        (pressureBandCounts.get(event.pressureBand) ?? 0) + 1,
      );
    }
    const saturation01 = clamp01(
      Math.max(...[...pressureBandCounts.values(), 0]) /
        Math.max(1, sessionRecent.length),
    );

    const volatility01 = this.computeVolatility01(sessionRecent, now);

    return {
      fatigue01: clamp01(
        (repetition * 0.40) +
          ((1 - exactLinePressure) * 0.20) +
          (similarity01 * 0.25) +
          (saturation01 * 0.15),
      ),
      volatility01,
      similarity01,
      saturation01,
    };
  }

  private computeChannelPairwiseSamples(
    events: readonly ChatNoveltyLedgerEvent[],
  ): readonly ChannelWindowSample[] {
    if (events.length < 2) return [];
    const samples: ChannelWindowSample[] = [];
    const recent = events.slice(-this.options.volatilityWindow);

    for (let index = 1; index < recent.length; index += 1) {
      const current = this.normalizeEvent(recent[index]);
      const previous = this.normalizeEvent(recent[index - 1]);
      samples.push({
        occurredAt: current.occurredAt,
        textOverlap01: jaccardSimilarity(current.phraseKeys, previous.phraseKeys),
        signatureOverlap01: jaccardSimilarity(
          current.signatureParts,
          previous.signatureParts,
        ),
      });
    }
    return samples;
  }

  private computeVolatility01(
    events: readonly ChatNoveltyLedgerEvent[],
    now: UnixMs,
  ): number {
    if (events.length < 3) return 0;
    const recent = events.slice(-this.options.volatilityWindow);
    const deltas: number[] = [];
    for (let index = 1; index < recent.length; index += 1) {
      deltas.push(
        Math.max(
          0,
          Number(recent[index].occurredAt) - Number(recent[index - 1].occurredAt),
        ),
      );
    }
    if (!deltas.length) return 0;
    const average =
      deltas.reduce((sum, value) => sum + value, 0) / Math.max(1, deltas.length);
    const variance =
      deltas.reduce((sum, value) => sum + ((value - average) ** 2), 0) /
      Math.max(1, deltas.length);
    const normalizedVariance = clamp01(variance / Math.max(1, average ** 2));
    const recencyFactor = clamp01(
      1 -
        Math.min(
          1,
          (Number(now) - Number(recent[recent.length - 1].occurredAt)) /
            this.options.sessionLookbackMs,
        ),
    );
    return clamp01(normalizedVariance * recencyFactor);
  }

  private getChannelFatigueScore(
    channelId: string,
    now: UnixMs,
  ): number {
    return this.computeFatigueMetrics(channelId, now).fatigue01;
  }

  /* ------------------------------------------------------------------------ */
  /* MARK: Query helpers                                                      */
  /* ------------------------------------------------------------------------ */

  private getRecentChannelEvents(
    channelId: string,
    now: UnixMs,
  ): readonly ChatNoveltyLedgerEvent[] {
    const normalizedChannelId = normalizeToken(channelId);
    return this.recentEvents.filter(
      (item) =>
        normalizeToken(String(item.channelId ?? '')) === normalizedChannelId &&
        Number(now) - Number(item.occurredAt) <= this.options.sessionLookbackMs,
    );
  }

  private getDominantKeys(
    channelId: string,
    mode: 'motif' | 'form' | 'semantic' | 'tag',
    now: UnixMs,
  ): readonly string[] {
    const counts = new Map<string, number>();
    const recent = this.recentEvents.filter(
      (item) =>
        normalizeToken(String(item.channelId ?? '')) === normalizeToken(channelId) &&
        Number(now) - Number(item.occurredAt) <= this.options.weekLookbackMs,
    );

    for (const event of recent) {
      const keys =
        mode === 'motif'
          ? event.motifIds
          : mode === 'form'
            ? event.rhetoricalForms
            : mode === 'semantic'
              ? event.semanticClusterIds
              : event.tags;
      for (const key of keys) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 4)
      .map(([key]) => key);
  }

  private selectUnderservedKeys(
    counts: ReadonlyMap<string, number>,
    excluded: readonly string[],
  ): readonly string[] {
    const excludedSet = new Set(excluded.map((value) => normalizeToken(value)));
    const entries = [...counts.entries()]
      .filter(([key]) => !excludedSet.has(normalizeToken(key)))
      .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]));

    return entries.slice(0, 4).map(([key]) => key);
  }

  private mostSaturatedPressureBand(
    counts: ReadonlyMap<NoveltyPressureBand, number>,
  ): NoveltyPressureBand | undefined {
    let selected: NoveltyPressureBand | undefined;
    let selectedCount = 0;
    for (const [band, count] of counts.entries()) {
      if (count > selectedCount) {
        selected = band;
        selectedCount = count;
      }
    }
    return selectedCount >= 4 ? selected : undefined;
  }

  private countMissing(
    values: readonly string[],
    pool: ReadonlySet<string>,
  ): number {
    let total = 0;
    for (const value of values) {
      if (!pool.has(value)) total += 1;
    }
    return total;
  }

  /* ------------------------------------------------------------------------ */
  /* MARK: Candidate normalization                                            */
  /* ------------------------------------------------------------------------ */

  private normalizeEvent(
    event: ChatNoveltyLedgerEvent,
  ): NormalizedNoveltyCandidate {
    return this.normalizeCandidate(
      {
        candidateId: event.eventId,
        lineId: event.lineId,
        botId: event.botId,
        counterpartId: event.counterpartId,
        roomId: event.roomId,
        channelId: event.channelId,
        pressureBand: event.pressureBand,
        motifIds: event.motifIds,
        rhetoricalForms: event.rhetoricalForms,
        sceneRoles: event.sceneRoles,
        semanticClusterIds: event.semanticClusterIds,
        callbackSourceIds: event.callbackSourceIds,
        tags: event.tags,
        text: event.text,
      },
      event.occurredAt,
    );
  }

  private normalizeCandidate(
    candidate: ChatNoveltyLedgerCandidate,
    occurredAt?: UnixMs,
  ): NormalizedNoveltyCandidate {
    const normalizedText = normalizeText(candidate.text);
    const tokens = tokenizeText(normalizedText);

    const lineId = candidate.lineId ? normalizeToken(candidate.lineId) : undefined;
    const botId =
      candidate.botId != null ? normalizeToken(String(candidate.botId)) : undefined;
    const counterpartId = candidate.counterpartId
      ? normalizeToken(candidate.counterpartId)
      : undefined;
    const roomId = candidate.roomId ? normalizeToken(candidate.roomId) : undefined;
    const channelId = candidate.channelId
      ? normalizeToken(String(candidate.channelId))
      : undefined;

    const motifIds = uniqueStrings(candidate.motifIds);
    const rhetoricalForms = uniqueStrings(candidate.rhetoricalForms);
    const sceneRoles = uniqueStrings(candidate.sceneRoles);
    const semanticClusterIds = uniqueStrings(candidate.semanticClusterIds);
    const callbackSourceIds = uniqueStrings(candidate.callbackSourceIds);
    const tags = uniqueStrings(candidate.tags);

    const signatureParts = uniqueStrings([
      ...(lineId ? [`line:${lineId}`] : []),
      ...(botId ? [`bot:${botId}`] : []),
      ...(counterpartId ? [`counterpart:${counterpartId}`] : []),
      ...(roomId ? [`room:${roomId}`] : []),
      ...(channelId ? [`channel:${channelId}`] : []),
      ...(candidate.pressureBand ? [`pressure:${candidate.pressureBand}`] : []),
      ...motifIds.map((value) => `motif:${value}`),
      ...rhetoricalForms.map((value) => `form:${value}`),
      ...sceneRoles.map((value) => `scene:${value}`),
      ...semanticClusterIds.map((value) => `semantic:${value}`),
      ...callbackSourceIds.map((value) => `callback:${value}`),
      ...tags.map((value) => `tag:${value}`),
    ]);

    const phraseKeys = uniqueStrings(
      createShingles(tokens, this.options.shingleWindow),
    );
    const signatureKey =
      signatureParts.length > 0
        ? signatureParts.join('|')
        : normalizedText
          ? `text:${normalizedText.slice(0, 96)}`
          : `candidate:${normalizeToken(candidate.candidateId)}`;

    return {
      candidateId: normalizeToken(candidate.candidateId) || String(candidate.candidateId),
      occurredAt: occurredAt ?? (Date.now() as UnixMs),
      lineId,
      botId,
      counterpartId,
      roomId,
      channelId,
      pressureBand: candidate.pressureBand,
      motifIds,
      rhetoricalForms,
      sceneRoles,
      semanticClusterIds,
      callbackSourceIds,
      tags,
      text: candidate.text,
      normalizedText,
      tokens,
      signatureParts,
      signatureKey,
      phraseKeys,
    };
  }

  private buildNoveltyCandidateFromResponseCandidate(
    candidate: ChatResponseCandidate,
  ): ChatNoveltyLedgerCandidate {
    return {
      candidateId: this.buildResponseCandidateLineId(candidate),
      lineId: this.buildResponseCandidateLineId(candidate),
      botId: null,
      counterpartId: String(candidate.personaId),
      roomId: String(candidate.roomId),
      channelId: String(candidate.channelId),
      pressureBand: this.extractPressureBandFromTags(candidate.tags, candidate.text),
      motifIds: this.extractMotifsFromResponseCandidate(candidate),
      rhetoricalForms: this.extractRhetoricalFormsFromText(candidate.text),
      sceneRoles: this.extractSceneRolesFromResponseCandidate(candidate),
      semanticClusterIds: this.extractSemanticKeysFromText(candidate.text, candidate.tags),
      callbackSourceIds: this.extractCallbackSourceIdsFromResponseCandidate(candidate),
      tags: candidate.tags,
      text: candidate.text,
    };
  }

  private buildResponseCandidateLineId(
    candidate: ChatResponseCandidate,
  ): string {
    const cause = candidate.causeEventId ? `cause:${candidate.causeEventId}` : 'cause:none';
    return normalizeToken(
      `${candidate.personaId}:${candidate.channelId}:${candidate.priority}:${candidate.delayMs}:${cause}:${candidate.text.slice(0, 96)}`,
    );
  }

  private materializeEvent(
    candidate: NormalizedNoveltyCandidate,
  ): ChatNoveltyLedgerEvent {
    return {
      eventId: candidate.candidateId,
      occurredAt: candidate.occurredAt,
      lineId: candidate.lineId,
      botId: candidate.botId ?? null,
      counterpartId: candidate.counterpartId ?? null,
      roomId: candidate.roomId ?? null,
      channelId: candidate.channelId ?? null,
      pressureBand: candidate.pressureBand,
      motifIds: [...candidate.motifIds],
      rhetoricalForms: [...candidate.rhetoricalForms],
      sceneRoles: [...candidate.sceneRoles],
      semanticClusterIds: [...candidate.semanticClusterIds],
      callbackSourceIds: [...candidate.callbackSourceIds],
      tags: [...candidate.tags],
      text: candidate.text,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* MARK: Feature extraction                                                 */
  /* ------------------------------------------------------------------------ */

  private extractMotifsFromMessage(
    message: ChatMessage,
  ): readonly string[] {
    const motifs = new Set<string>();
    const metadata = metadataRecordOf(message);

    motifs.add(`channel:${normalizeToken(message.channelId)}`);
    motifs.add(`room:${normalizeToken(message.roomId)}`);
    motifs.add(`source:${normalizeToken(message.attribution.sourceType)}`);

    const actorId = normalizeToken(message.attribution.actorId);
    if (actorId) motifs.add(`actor:${actorId}`);

    const npcRole = normalizeToken(message.attribution.npcRole);
    if (npcRole) motifs.add(`npc-role:${npcRole}`);

    const botId = normalizeToken(message.attribution.botId);
    if (botId) motifs.add(`bot:${botId}`);

    if (message.policy.shadowOnly) motifs.add('shadow-only');
    if (message.policy.wasRewritten) motifs.add('rewritten');
    if (message.policy.wasMasked) motifs.add('masked');

    if (message.replay.sceneId) motifs.add(`scene:${normalizeToken(message.replay.sceneId)}`);
    if (message.replay.momentId) motifs.add(`moment:${normalizeToken(message.replay.momentId)}`);
    if (message.replay.legendId) motifs.add('legend');
    if (message.replay.replayAnchorKey) motifs.add('replay-anchor');

    if (message.learning.learningTriggered) motifs.add('learning-triggered');
    if (message.learning.inferenceId) motifs.add('inference-linked');

    if (message.proof.proofHash) motifs.add('proof');
    if (message.proof.causalParentMessageIds.length > 0) motifs.add('callback');
    if (message.proof.causalParentEventIds.length > 0) motifs.add('event-callback');

    for (const part of message.bodyParts) {
      if (part.type === 'SYSTEM_TAG') {
        motifs.add('system-tag');
        const normalizedTag = normalizeToken(part.tag);
        if (normalizedTag) motifs.add(`system:${normalizedTag}`);
      } else if (part.type === 'QUOTE') {
        motifs.add('quote');
      } else if (part.type === 'OFFER') {
        motifs.add('offer');
      } else if (part.type === 'EMOTE') {
        motifs.add('emote');
      } else if (part.type === 'TEXT') {
        motifs.add('text');
      }
    }

    for (const tag of message.tags) {
      const normalizedTag = normalizeToken(tag);
      if (!normalizedTag) continue;
      motifs.add(normalizedTag);
      if (normalizedTag.includes(':')) {
        const [family] = normalizedTag.split(':', 1);
        if (family) motifs.add(`tag-family:${family}`);
      }
    }

    const directMode = stringFromUnknown(metadata.mode);
    if (directMode) motifs.add(`mode:${normalizeToken(directMode)}`);

    const pressureBand = this.extractPressureBandFromMessage(message, metadata);
    if (pressureBand) motifs.add(`pressure:${normalizeToken(pressureBand)}`);

    const body = normalizeText(message.plainText);
    if (body.includes('proof')) motifs.add('proof-language');
    if (body.includes('rescue')) motifs.add('rescue-language');
    if (body.includes('offer')) motifs.add('offer-language');
    if (body.includes('trust')) motifs.add('trust-language');
    if (body.includes('heat')) motifs.add('audience-heat');
    if (body.includes('shadow')) motifs.add('shadow-language');
    if (body.includes('legend')) motifs.add('legend-language');
    if (body.includes('deal')) motifs.add('deal-room-language');
    if (body.includes('syndicate')) motifs.add('syndicate-language');
    if (body.includes('predator')) motifs.add('predator-language');
    if (body.includes('empire')) motifs.add('empire-language');
    if (body.includes('phantom')) motifs.add('phantom-language');

    return [...motifs];
  }

  private extractMotifsFromResponseCandidate(
    candidate: ChatResponseCandidate,
  ): readonly string[] {
    const motifs = new Set<string>();

    motifs.add(`channel:${normalizeToken(candidate.channelId)}`);
    motifs.add(`room:${normalizeToken(candidate.roomId)}`);
    motifs.add(`persona:${normalizeToken(candidate.personaId)}`);

    if (candidate.delayMs > 0) motifs.add('delayed');
    if (candidate.delayMs >= 2_500) motifs.add('long-delay');
    if (candidate.moderationBypassAllowed) motifs.add('bypass-eligible');
    if (candidate.causeEventId) motifs.add('event-linked');

    if (candidate.priority >= 8) motifs.add('priority-critical');
    else if (candidate.priority >= 5) motifs.add('priority-high');
    else if (candidate.priority >= 3) motifs.add('priority-medium');
    else motifs.add('priority-low');

    for (const tag of candidate.tags) {
      const normalizedTag = normalizeToken(tag);
      if (!normalizedTag) continue;
      motifs.add(normalizedTag);
      if (normalizedTag.includes(':')) {
        const [family] = normalizedTag.split(':', 1);
        if (family) motifs.add(`tag-family:${family}`);
      }
    }

    const body = normalizeText(candidate.text);
    if (body.includes('proof')) motifs.add('proof-language');
    if (body.includes('offer')) motifs.add('offer-language');
    if (body.includes('rescue')) motifs.add('rescue-language');
    if (body.includes('heat')) motifs.add('audience-heat');
    if (body.includes('shadow')) motifs.add('shadow-language');

    return [...motifs];
  }

  private extractMotifsFromScene(
    scene: ChatScenePlan,
  ): readonly string[] {
    const motifs = new Set<string>();

    motifs.add('scene');
    motifs.add(`scene:${normalizeToken(scene.sceneId)}`);
    motifs.add(`room:${normalizeToken(scene.roomId)}`);

    const labelTokens = scene.label
      .split(/\s+/g)
      .map((token) => normalizeToken(token))
      .filter(Boolean)
      .slice(0, 8);

    for (const token of labelTokens) {
      motifs.add(`label:${token}`);
    }

    for (const message of scene.messages) {
      motifs.add(`channel:${normalizeToken(message.channelId)}`);
      motifs.add(`persona:${normalizeToken(message.personaId)}`);
      if (message.causeEventId) motifs.add('event-linked');
      if (message.moderationBypassAllowed) motifs.add('bypass-eligible');
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

    if (normalized.includes('?')) forms.add('interrogative');
    if (normalized.includes('!')) forms.add('exclamatory');
    if (normalized.includes('you thought')) forms.add('you-thought');
    if (normalized.includes('i call it')) forms.add('renaming');
    if (normalized.includes('the system')) forms.add('system-assertion');
    if (normalized.includes('not because')) forms.add('negation-reversal');
    if (normalized.includes('for now')) forms.add('temporary-dread');
    if (normalized.includes('this was not')) forms.add('reframe');
    if (normalized.includes('i was waiting')) forms.add('waiting-reveal');
    if (normalized.includes('watch')) forms.add('watch-warning');
    if (normalized.includes('remember')) forms.add('memory-invocation');
    if (normalized.includes('listen')) forms.add('directive-opening');
    if (normalized.startsWith('no ')) forms.add('hard-denial');
    if (/^you\b/.test(normalized)) forms.add('direct-address');
    if (/^(yes|no|wait|listen)\b/.test(normalized)) forms.add('hard-opener');
    if (/\bif\b.+\bthen\b/.test(normalized)) forms.add('conditional-threat');
    if (/\bwhen\b.+\byou\b/.test(normalized)) forms.add('timed-prophecy');
    if (/\bbecause\b/.test(normalized)) forms.add('causal-explanation');
    if (/\bnever\b/.test(normalized)) forms.add('absolute-denial');
    if (/\balways\b/.test(normalized)) forms.add('absolute-assertion');
    if (/\bmaybe\b/.test(normalized)) forms.add('uncertainty-softener');
    if (/\bcome on\b/.test(normalized)) forms.add('crowd-taunt');
    if (/\bjust\b.+\bnot\b/.test(normalized)) forms.add('minimizing-dismissal');
    if (/\bshould have\b/.test(normalized)) forms.add('retroactive-judgment');
    if (/\bi know\b/.test(normalized)) forms.add('certainty-claim');
    if (/\blook at\b/.test(normalized)) forms.add('forced-attention');
    if (forms.size === 0) forms.add('plain-declarative');

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

    if (forms.size === 0) forms.add('scene-assembly');
    return [...forms];
  }

  private extractSemanticKeysFromText(
    text: string | undefined,
    tags: readonly string[] = [],
    message?: ChatMessage,
  ): readonly string[] {
    const normalized = normalizeText(text);
    const keys = new Set<string>();

    if (/\bliquid|floor|distress|clearance|pricing|margin\b/.test(normalized)) {
      keys.add('macro:liquidity-distress');
    }
    if (/\breview|compliance|forms|queue|approval|audit\b/.test(normalized)) {
      keys.add('macro:bureaucratic-delay');
    }
    if (/\bpattern|predictable|readable|cadence|model\b/.test(normalized)) {
      keys.add('macro:behavioral-modeling');
    }
    if (/\bstorm|cycle|macro|correction|regime|crash\b/.test(normalized)) {
      keys.add('macro:systemic-crash');
    }
    if (/\binheritance|legacy|cushion|structure|privilege\b/.test(normalized)) {
      keys.add('macro:structural-privilege');
    }
    if (/\bdeal|offer|counter|bid|ask|leverage|bluff\b/.test(normalized)) {
      keys.add('macro:dealroom-negotiation');
    }
    if (/\bhelper|rescue|steady|breathe|reset|recover\b/.test(normalized)) {
      keys.add('macro:rescue-regulation');
    }
    if (/\bheat|crowd|room|audience|witness|watching\b/.test(normalized)) {
      keys.add('macro:crowd-pressure');
    }
    if (/\bproof|hash|ledger|receipt|evidence\b/.test(normalized)) {
      keys.add('macro:proof-surface');
    }
    if (/\bshadow|echo|legend|myth|phantom\b/.test(normalized)) {
      keys.add('macro:shadow-mythic');
    }
    if (/\bsyndicate|ally|trust|network\b/.test(normalized)) {
      keys.add('macro:syndicate-coordination');
    }
    if (/\bpredator|hunt|trap|corner\b/.test(normalized)) {
      keys.add('macro:predatory-pressure');
    }
    if (/\bempire|throne|territory|dominion\b/.test(normalized)) {
      keys.add('macro:empire-posture');
    }

    for (const tag of tags) {
      const normalizedTag = normalizeToken(tag);
      if (!normalizedTag) continue;
      if (normalizedTag.startsWith('topic:')) keys.add(`topic:${normalizedTag.slice(6)}`);
      if (normalizedTag.startsWith('mood:')) keys.add(`mood:${normalizedTag.slice(5)}`);
      if (normalizedTag.startsWith('cause:')) keys.add(`cause:${normalizedTag.slice(6)}`);
      if (normalizedTag.startsWith('mode:')) keys.add(`mode:${normalizedTag.slice(5)}`);
      if (normalizedTag.startsWith('event:')) keys.add(`event:${normalizedTag.slice(6)}`);
    }

    if (message) {
      if (message.replay.sceneId) keys.add(`scene:${normalizeToken(message.replay.sceneId)}`);
      if (message.replay.momentId) keys.add(`moment:${normalizeToken(message.replay.momentId)}`);
      if (message.replay.legendId) keys.add('meta:legendary-moment');
      if (message.proof.proofHash) keys.add('meta:proof-linked');
      if (message.proof.causalParentMessageIds.length > 0) keys.add('meta:callback');
      if (message.learning.learningTriggered) keys.add('meta:learning-triggered');
      if (message.learning.inferenceId) keys.add('meta:inference-linked');
      if (message.policy.shadowOnly) keys.add('meta:shadow-only');
      if (message.policy.wasRewritten) keys.add('meta:rewritten');
      if (message.policy.wasMasked) keys.add('meta:masked');
    }

    if (keys.size === 0 && normalized) {
      keys.add(`surface:${normalized.slice(0, 24).replace(/\s+/g, '-')}`);
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
      keys.add(`persona:${normalizeToken(message.personaId)}`);
      keys.add(`channel:${normalizeToken(message.channelId)}`);
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
    const metadata = metadataRecordOf(message);

    for (const parentMessageId of message.proof.causalParentMessageIds) {
      callbacks.add(String(parentMessageId));
    }
    for (const parentEventId of message.proof.causalParentEventIds) {
      callbacks.add(String(parentEventId));
    }
    for (const part of message.bodyParts) {
      if (part.type === 'QUOTE') callbacks.add(String(part.messageId));
      if (part.type === 'OFFER') callbacks.add(String(part.offerId));
    }

    for (const key of ['quoteIds', 'quotedMessageIds', 'callbackSourceIds']) {
      for (const value of stringArrayFromUnknown(metadata[key])) {
        callbacks.add(value);
      }
    }

    const replayAnchorKey = stringFromUnknown(message.replay.replayAnchorKey);
    if (replayAnchorKey) callbacks.add(replayAnchorKey);

    return [...callbacks];
  }

  private extractCallbackSourceIdsFromResponseCandidate(
    candidate: ChatResponseCandidate,
  ): readonly string[] {
    const callbacks = new Set<string>();
    if (candidate.causeEventId) callbacks.add(String(candidate.causeEventId));

    for (const tag of candidate.tags) {
      const normalizedTag = normalizeToken(tag);
      if (normalizedTag.startsWith('callback:')) {
        callbacks.add(normalizedTag.slice('callback:'.length));
      }
      if (normalizedTag.startsWith('quote:')) {
        callbacks.add(normalizedTag.slice('quote:'.length));
      }
    }

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
    if (message.replay.legendId) roles.add('legend-line');
    if (message.attribution.botId) roles.add('bot-line');
    if (message.attribution.npcRole) {
      roles.add(`npc:${normalizeToken(message.attribution.npcRole)}`);
    }
    if (message.policy.shadowOnly) roles.add('shadow-only');
    if (message.policy.wasRewritten) roles.add('rewritten');
    if (message.policy.wasMasked) roles.add('masked');
    if (message.learning.learningTriggered) roles.add('learning-linked');

    for (const part of message.bodyParts) {
      if (part.type === 'QUOTE') roles.add('quote-line');
      if (part.type === 'OFFER') roles.add('offer-line');
      if (part.type === 'SYSTEM_TAG') roles.add('system-line');
      if (part.type === 'EMOTE') roles.add('emote-line');
    }

    return [...roles];
  }

  private extractSceneRolesFromResponseCandidate(
    candidate: ChatResponseCandidate,
  ): readonly string[] {
    const roles = new Set<string>();

    roles.add('scene-candidate');
    roles.add(`channel:${normalizeToken(candidate.channelId)}`);
    roles.add(`persona:${normalizeToken(candidate.personaId)}`);

    if (candidate.delayMs > 0) roles.add('delayed');
    if (candidate.moderationBypassAllowed) roles.add('bypass-eligible');
    if (candidate.causeEventId) roles.add('caused');

    if (candidate.priority >= 8) roles.add('priority-critical');
    else if (candidate.priority >= 5) roles.add('priority-high');
    else if (candidate.priority >= 3) roles.add('priority-medium');
    else roles.add('priority-low');

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
      roles.add(`persona:${normalizeToken(message.personaId)}`);
      if (message.moderationBypassAllowed) roles.add('bypass-eligible');
      if (message.causeEventId) roles.add('caused');
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
      'roomPressure',
    ] as const;

    for (const key of directKeys) {
      const value = stringFromUnknown(metadata[key]);
      const band = this.toPressureBand(value);
      if (band) return band;
    }

    return this.extractPressureBandFromTags(message.tags, message.plainText);
  }

  private extractPressureBandFromTags(
    tags: readonly string[],
    text?: string,
  ): NoveltyPressureBand | undefined {
    for (const tag of tags) {
      const normalizedTag = normalizeToken(tag);
      if (normalizedTag.startsWith('pressure:')) {
        const band = this.toPressureBand(normalizedTag.slice('pressure:'.length));
        if (band) return band;
      }
      if (normalizedTag.startsWith('tier:')) {
        const band = this.toPressureBand(normalizedTag.slice('tier:'.length));
        if (band) return band;
      }
    }

    const normalizedText = normalizeText(text);
    if (
      /\bpanic|collapse|doomed|finished|execution\b/.test(normalizedText)
    ) {
      return 'CRITICAL';
    }
    if (
      /\bpressure|danger|exposed|cornered|trapped\b/.test(normalizedText)
    ) {
      return 'HIGH';
    }
    if (
      /\btense|unstable|uncertain|watching\b/.test(normalizedText)
    ) {
      return 'MEDIUM';
    }
    if (
      /\bsteady|calm|soft|build\b/.test(normalizedText)
    ) {
      return 'LOW';
    }
    return undefined;
  }

  private extractScenePressureBand(
    scene: ChatScenePlan,
  ): NoveltyPressureBand | undefined {
    const counts: Record<NoveltyPressureBand, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const message of scene.messages) {
      const band = this.extractPressureBandFromTags(message.tags, message.text);
      if (band) counts[band] += 1;
    }

    if (counts.CRITICAL > 0) return 'CRITICAL';
    if (counts.HIGH > 0) return 'HIGH';
    if (counts.MEDIUM > 0) return 'MEDIUM';
    if (counts.LOW > 0) return 'LOW';
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

/* ========================================================================== */
/* MARK: Factories + helpers                                                  */
/* ========================================================================== */

export function createChatNoveltyLedger(
  options: ChatNoveltyLedgerOptions = {},
  now: UnixMs = Date.now() as UnixMs,
): ChatNoveltyLedger {
  return new ChatNoveltyLedger(options, now);
}

export function restoreChatNoveltyLedger(
  snapshot: ChatNoveltyLedgerSnapshot,
  options: ChatNoveltyLedgerOptions = {},
): ChatNoveltyLedger {
  return createChatNoveltyLedger(
    options,
    snapshot.updatedAt ?? (Date.now() as UnixMs),
  ).restore(snapshot);
}

export function describeChatNoveltyScore(
  score: ChatNoveltyLedgerScore,
): 'FRESH' | 'SAFE' | 'TENSE' | 'TIRED' | 'STALE' {
  if (score.noveltyScore01 >= 0.85) return 'FRESH';
  if (score.noveltyScore01 >= 0.67) return 'SAFE';
  if (score.noveltyScore01 >= 0.50) return 'TENSE';
  if (score.noveltyScore01 >= 0.33) return 'TIRED';
  return 'STALE';
}
