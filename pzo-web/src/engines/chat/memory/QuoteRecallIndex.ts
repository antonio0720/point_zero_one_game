/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT QUOTE RECALL INDEX
 * FILE: pzo-web/src/engines/chat/memory/QuoteRecallIndex.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend retrieval and ranking index for quote-backed memory. This module is
 * intentionally positioned between transcript truth and callback planning:
 *
 * - It ingests visible and shadow transcript messages.
 * - It extracts quote candidates from player, rival, helper, system, and crowd lanes.
 * - It normalizes quote metadata for pressure, channel, scene, proof, and relationship use.
 * - It provides fast in-session ranking for “receipts,” “callbacks,” “remember when,”
 *   humiliation beats, helper reminders, and post-run narrative recall.
 * - It stays deterministic enough for client preview and UI explainability, while still
 *   being rich enough to mirror the long-term backend memory store.
 *
 * Design laws
 * -----------
 * - Transcript truth first. Never invent memory that is not grounded in actual messages
 *   or authoritative callback plans.
 * - Quote reuse must respect privacy, proof-bearing metadata, channel context,
 *   and relationship posture.
 * - Ranking should prefer relevance + specificity + salience over raw recency alone.
 * - Helper recall should feel caring. Rival recall should feel predatory. System recall
 *   should feel exact.
 * - This file is intentionally frontend-owned today, but shaped to converge with
 *   /shared/contracts/chat/ChatQuote.ts and /shared/contracts/chat/ChatCallback.ts.
 *
 * Boundaries
 * ----------
 * - This module does not perform network IO.
 * - This module does not author final messages.
 * - This module does not mutate engine state by itself.
 * - This module does provide deterministic retrieval, ranking, preview, and recall
 *   bundles that higher layers can consume.
 * ============================================================================
 */

import type {
  ChatChannelId,
  ChatEngineState,
  ChatMessage,
  ChatMessageId,
  ChatMountTarget,
  ChatPressureTier,
  ChatProofHash,
  ChatQuoteId,
  ChatRelationshipState,
  ChatSceneId,
  ChatUserId,
  JsonObject,
  Score01,
  UnixMs,
} from '../types';
import type {
  ChatCallbackContext,
  ChatCallbackKind,
  ChatCallbackPrivacyClass,
  ChatCallbackRelationshipJoin,
  ChatCallbackQuoteJoin,
} from '../../../../shared/contracts/chat/ChatCallback';
import type {
  ChatQuoteAudienceClass,
  ChatQuoteCallbackEligibility,
  ChatQuoteContextSnapshot,
  ChatQuoteLegacyProjection,
  ChatQuoteRange,
  ChatQuoteRecord,
  ChatQuoteReferenceBundle,
  ChatQuoteSearchHit,
  ChatQuoteSearchQuery,
  ChatQuoteSelectionCandidate,
  ChatQuoteToneClass,
  ChatQuoteUseIntent,
} from '../../../../shared/contracts/chat/ChatQuote';
import type {
  LegacyChatRelationshipState,
} from './RelationshipState';

// ============================================================================
// MARK: Constants and vocabularies
// ============================================================================

export const CHAT_QUOTE_RECALL_INDEX_VERSION = '1.0.0' as const;
export const CHAT_QUOTE_RECALL_INDEX_FILE_PATH =
  'pzo-web/src/engines/chat/memory/QuoteRecallIndex.ts' as const;

export const QUOTE_RECALL_RANKING_REASONS = [
  'EXACT_TEXT',
  'TOKEN_OVERLAP',
  'RECENCY',
  'PRESSURE_MATCH',
  'CHANNEL_MATCH',
  'SCENE_MATCH',
  'RELATIONSHIP_MATCH',
  'COUNTERPART_MATCH',
  'PROOF_PRESENT',
  'SIGNATURE_LINE',
  'HUMILIATION_WINDOW',
  'HELPER_GUIDANCE_WINDOW',
  'COMEBACK_WINDOW',
  'COLLAPSE_WINDOW',
  'NEGOTIATION_WINDOW',
  'PUBLIC_RECEIPT',
  'PRIVATE_RECEIPT',
  'SHADOW_RECEIPT',
  'WORLD_EVENT_ALIGNMENT',
  'RUN_TURNING_POINT',
] as const;

export const QUOTE_RECALL_CONTEXT_TAGS = [
  'player_flex',
  'player_taunt',
  'player_question',
  'player_hesitation',
  'player_calm',
  'player_anger',
  'helper_warning',
  'helper_rescue',
  'rival_taunt',
  'rival_hunt',
  'system_receipt',
  'collapse',
  'comeback',
  'shield_break',
  'near_sovereignty',
  'deal_room',
  'crowd_witness',
  'public_witness',
  'private_witness',
  'proof_hash',
  'legend_moment',
  'world_event',
  'post_run',
] as const;

export const QUOTE_RECALL_DEFAULT_STOPWORDS = new Set<string>([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'had',
  'has',
  'have',
  'he',
  'her',
  'him',
  'his',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'me',
  'my',
  'of',
  'on',
  'or',
  'our',
  'ours',
  'she',
  'so',
  'that',
  'the',
  'their',
  'them',
  'they',
  'this',
  'to',
  'too',
  'us',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'you',
  'your',
  'yours',
]);

export type QuoteRecallRankingReason =
  (typeof QUOTE_RECALL_RANKING_REASONS)[number];
export type QuoteRecallContextTag = (typeof QUOTE_RECALL_CONTEXT_TAGS)[number];

// ============================================================================
// MARK: Config and runtime contracts
// ============================================================================

export interface QuoteRecallIndexConfig {
  readonly maxQuotes: number;
  readonly maxQuotesPerSpeaker: number;
  readonly maxQuotesPerChannel: number;
  readonly minBodyLength: number;
  readonly maxBodyLength: number;
  readonly recentWindowMs: number;
  readonly staleWindowMs: number;
  readonly humiliationWindowMs: number;
  readonly helperWindowMs: number;
  readonly quoteReuseCooldownMs: number;
  readonly proofBonus01: number;
  readonly signatureLineBonus01: number;
  readonly relationshipBonus01: number;
  readonly exactTextBonus01: number;
  readonly channelMatchBonus01: number;
  readonly sceneMatchBonus01: number;
  readonly pressureMatchBonus01: number;
  readonly maxSearchHits: number;
  readonly maxSelectionCandidates: number;
  readonly tokenLimit: number;
  readonly preserveShadowQuotes: boolean;
  readonly includeSystemQuotes: boolean;
  readonly includeCrowdQuotes: boolean;
  readonly includeShortQuestions: boolean;
  readonly stopwords: ReadonlySet<string>;
}

export const DEFAULT_QUOTE_RECALL_INDEX_CONFIG: QuoteRecallIndexConfig = Object.freeze({
  maxQuotes: 1800,
  maxQuotesPerSpeaker: 180,
  maxQuotesPerChannel: 420,
  minBodyLength: 8,
  maxBodyLength: 400,
  recentWindowMs: 1000 * 60 * 6,
  staleWindowMs: 1000 * 60 * 45,
  humiliationWindowMs: 1000 * 60 * 8,
  helperWindowMs: 1000 * 60 * 12,
  quoteReuseCooldownMs: 1000 * 45,
  proofBonus01: 0.08,
  signatureLineBonus01: 0.06,
  relationshipBonus01: 0.10,
  exactTextBonus01: 0.16,
  channelMatchBonus01: 0.05,
  sceneMatchBonus01: 0.05,
  pressureMatchBonus01: 0.04,
  maxSearchHits: 16,
  maxSelectionCandidates: 12,
  tokenLimit: 18,
  preserveShadowQuotes: true,
  includeSystemQuotes: true,
  includeCrowdQuotes: true,
  includeShortQuestions: true,
  stopwords: QUOTE_RECALL_DEFAULT_STOPWORDS,
});

export interface QuoteRecallSpeakerProfile {
  readonly speakerId: string;
  readonly actorLabel: string;
  readonly audienceClass: ChatQuoteAudienceClass;
  readonly relationshipCounterpartId?: string;
  readonly relationshipIntensity01?: number;
  readonly toneClass: ChatQuoteToneClass;
  readonly trust01?: number;
  readonly rivalry01?: number;
  readonly rescue01?: number;
}

export interface QuoteRecallIndexRecord {
  readonly quoteId: ChatQuoteId;
  readonly messageId: ChatMessageId;
  readonly createdAt: UnixMs;
  readonly roomId?: string | null;
  readonly channelId: ChatChannelId;
  readonly sceneId?: ChatSceneId | null;
  readonly mountTarget?: ChatMountTarget | null;
  readonly speakerId: string;
  readonly speakerLabel: string;
  readonly actorKind?: string | null;
  readonly body: string;
  readonly normalizedBody: string;
  readonly excerpt: string;
  readonly tokenSet: readonly string[];
  readonly stemSet: readonly string[];
  readonly quoteRange: ChatQuoteRange;
  readonly audienceClass: ChatQuoteAudienceClass;
  readonly callbackEligibility: ChatQuoteCallbackEligibility;
  readonly useHistoryCount: number;
  readonly pressureTier?: ChatPressureTier | null;
  readonly proofHash?: ChatProofHash | null;
  readonly relationshipCounterpartId?: string | null;
  readonly relationshipId?: string | null;
  readonly tags: readonly string[];
  readonly contexts: readonly QuoteRecallContextTag[];
  readonly legacy?: ChatQuoteLegacyProjection | null;
  readonly contextSnapshot?: ChatQuoteContextSnapshot | null;
  readonly lastSelectedAt?: UnixMs | null;
  readonly sourceScore01: Score01;
}

export interface QuoteRecallUseLedgerEntry {
  readonly quoteId: ChatQuoteId;
  readonly usedAt: UnixMs;
  readonly useIntent: ChatQuoteUseIntent;
  readonly callbackKind?: ChatCallbackKind | null;
  readonly channelId?: ChatChannelId | null;
  readonly privacyClass?: ChatCallbackPrivacyClass | null;
  readonly requestId?: string | null;
  readonly sceneId?: string | null;
  readonly notes: readonly string[];
}

export interface QuoteRecallRankBreakdown {
  readonly total01: number;
  readonly exactText01: number;
  readonly tokenOverlap01: number;
  readonly recency01: number;
  readonly pressureMatch01: number;
  readonly channelMatch01: number;
  readonly sceneMatch01: number;
  readonly counterpartMatch01: number;
  readonly relationshipMatch01: number;
  readonly proofBonus01: number;
  readonly signatureLineBonus01: number;
  readonly usePenalty01: number;
  readonly stalePenalty01: number;
  readonly reasons: readonly QuoteRecallRankingReason[];
}

export interface QuoteRecallSelectionQuery {
  readonly text?: string;
  readonly exactText?: string;
  readonly channelId?: ChatChannelId | null;
  readonly sceneId?: ChatSceneId | null;
  readonly speakerId?: string | null;
  readonly counterpartId?: string | null;
  readonly pressureTier?: ChatPressureTier | null;
  readonly audienceClass?: ChatQuoteAudienceClass | null;
  readonly useIntent?: ChatQuoteUseIntent | null;
  readonly privacyClass?: ChatCallbackPrivacyClass | null;
  readonly callbackContext?: ChatCallbackContext | null;
  readonly relationshipJoin?: ChatCallbackRelationshipJoin | null;
  readonly limit?: number;
}

export interface QuoteRecallSearchResult {
  readonly hits: readonly ChatQuoteSearchHit[];
  readonly candidateRecords: readonly QuoteRecallIndexRecord[];
  readonly selectionCandidates: readonly ChatQuoteSelectionCandidate[];
  readonly rankByQuoteId: Readonly<Record<string, QuoteRecallRankBreakdown>>;
}

export interface QuoteRecallSnapshot {
  readonly createdAt: UnixMs;
  readonly totalQuotes: number;
  readonly byChannel: Readonly<Record<string, number>>;
  readonly bySpeaker: Readonly<Record<string, number>>;
  readonly byContextTag: Readonly<Record<string, number>>;
  readonly recentQuoteIds: readonly ChatQuoteId[];
  readonly signatureQuoteIds: readonly ChatQuoteId[];
  readonly mostUsedQuoteIds: readonly ChatQuoteId[];
}

export interface QuoteRecallHydrationOptions {
  readonly messages?: readonly ChatMessage[];
  readonly engineState?: ChatEngineState | null;
  readonly relationships?: readonly LegacyChatRelationshipState[];
  readonly replaceExisting: boolean;
  readonly reason: string;
  readonly now?: UnixMs;
}

export interface QuoteRecallIndexMutation {
  readonly reason: string;
  readonly addedQuoteIds: readonly ChatQuoteId[];
  readonly updatedQuoteIds: readonly ChatQuoteId[];
  readonly removedQuoteIds: readonly ChatQuoteId[];
  readonly totalQuotes: number;
  readonly at: UnixMs;
}

export type QuoteRecallSubscriber = (mutation: QuoteRecallIndexMutation) => void;

// ============================================================================
// MARK: Primitive helpers
// ============================================================================

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeText(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9\s'"?!.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function tokenize(value: string, limit: number, stopwords: ReadonlySet<string>): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => !stopwords.has(token));
  return tokens.slice(0, limit);
}

function simpleStem(token: string): string {
  return token
    .replace(/(ing|edly|edly|edly|ed|ly|ies|s)$/i, '')
    .replace(/(er|est)$/i, '');
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function asArray<T>(value: readonly T[] | T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function bodyExcerpt(value: string, max = 180): string {
  const text = normalizeWhitespace(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function buildRangeFromBody(body: string): ChatQuoteRange {
  return {
    rangeId: `range:${body.length}:${body.slice(0, 12)}` as ChatQuoteRange['rangeId'],
    startOffset: 0,
    endOffset: Math.max(0, body.length),
    lineStart: 1,
    lineEnd: 1,
  };
}

function scoreRecency(createdAt: number, now: number, recentWindowMs: number, staleWindowMs: number): number {
  const age = Math.max(0, now - createdAt);
  if (age <= recentWindowMs) return 1;
  if (age >= staleWindowMs) return 0.1;
  const span = staleWindowMs - recentWindowMs;
  const progress = (age - recentWindowMs) / Math.max(1, span);
  return clamp01(1 - progress * 0.9);
}

function overlapScore(a: readonly string[], b: readonly string[]): number {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const token of a) {
    if (setB.has(token)) hits += 1;
  }
  return clamp01(hits / Math.max(a.length, b.length));
}

function hasSignatureLine(body: string): boolean {
  if (body.length < 20) return false;
  return /\b(always|never|again|remember|watch|easy|mine|yours|told you|you said)\b/i.test(body);
}

function pressureMatchScore(a?: ChatPressureTier | null, b?: ChatPressureTier | null): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const order: ChatPressureTier[] = [
    'OPENING' as ChatPressureTier,
    'STABLE' as ChatPressureTier,
    'BUILDING' as ChatPressureTier,
    'COMPRESSED' as ChatPressureTier,
    'CRISIS' as ChatPressureTier,
    'COLLAPSE_IMMINENT' as ChatPressureTier,
  ];
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  if (ai < 0 || bi < 0) return 0;
  const distance = Math.abs(ai - bi);
  if (distance === 1) return 0.66;
  if (distance === 2) return 0.33;
  return 0.1;
}

function toScore01(value: number): Score01 {
  return clamp01(value) as Score01;
}

function inferAudienceClass(message: ChatMessage): ChatQuoteAudienceClass {
  const actor = (message as { actorKind?: string }).actorKind;
  const channel = (message as { channelId?: string }).channelId;
  if (channel && String(channel).includes('SHADOW')) return 'SHADOW';
  if (actor === 'PLAYER') return 'PRIVATE';
  if (actor === 'HELPER') return 'HELPER';
  if (actor === 'RIVAL' || actor === 'BOT') return 'RIVAL';
  if (actor === 'SYSTEM') return 'SYSTEM';
  if (actor === 'CROWD' || actor === 'AMBIENT') return 'PUBLIC';
  return 'PRIVATE';
}

function inferToneClass(body: string, audienceClass: ChatQuoteAudienceClass): ChatQuoteToneClass {
  if (/\b(help|careful|breathe|wait|listen|recover)\b/i.test(body)) return 'GUIDING';
  if (/\b(told you|easy|weak|fold|again|pathetic|mine)\b/i.test(body)) return 'PREDATORY';
  if (/\b(remember|you said|last time|receipt|witness)\b/i.test(body)) return 'FORENSIC';
  if (/\b(win|own|take|sovereign|finish)\b/i.test(body)) return 'DECLARATIVE';
  if (audienceClass === 'SYSTEM') return 'FORENSIC';
  if (audienceClass === 'HELPER') return 'GUIDING';
  if (audienceClass === 'RIVAL') return 'PREDATORY';
  return 'OBSERVATIONAL';
}

function inferCallbackEligibility(body: string, audienceClass: ChatQuoteAudienceClass): ChatQuoteCallbackEligibility {
  if (body.length < 10) return 'LIMITED';
  if (/\b(remember|you said|last time|receipt|again)\b/i.test(body)) return 'HIGH';
  if (audienceClass === 'SHADOW') return 'MEDIUM';
  return 'MEDIUM';
}

function inferContextTags(message: ChatMessage, body: string): QuoteRecallContextTag[] {
  const tags: QuoteRecallContextTag[] = [];
  const actor = String((message as { actorKind?: string }).actorKind ?? '');
  const channel = String((message as { channelId?: string }).channelId ?? '');
  if (/\beasy|mine|weak|fold\b/i.test(body)) tags.push('player_flex');
  if (/\bwhy|how|what|when\b/i.test(body)) tags.push('player_question');
  if (/\bwait|hold|breathe|recover\b/i.test(body)) tags.push('helper_rescue');
  if (/\bremember|receipt|you said|last time\b/i.test(body)) tags.push('system_receipt');
  if (/\bbreach|broke|collapse|failed\b/i.test(body)) tags.push('collapse');
  if (/\bcomeback|recovered|again|still here\b/i.test(body)) tags.push('comeback');
  if (/\bproof\b/i.test(body)) tags.push('proof_hash');
  if (channel === 'DEAL_ROOM') tags.push('deal_room');
  if (actor === 'HELPER') tags.push('helper_warning');
  if (actor === 'RIVAL' || actor === 'BOT') tags.push('rival_taunt');
  if (actor === 'SYSTEM') tags.push('public_witness');
  if (!tags.length) tags.push('private_witness');
  return uniqueStrings(tags) as QuoteRecallContextTag[];
}

function relationshipIdForCounterpart(counterpartId: string | undefined): string | undefined {
  if (!counterpartId) return undefined;
  return `rel:${counterpartId}`;
}

// ============================================================================
// MARK: QuoteRecallIndex
// ============================================================================

export class QuoteRecallIndex {
  private readonly config: QuoteRecallIndexConfig;
  private readonly quoteById = new Map<ChatQuoteId, QuoteRecallIndexRecord>();
  private readonly quoteIdsByMessageId = new Map<string, ChatQuoteId[]>();
  private readonly quoteIdsBySpeakerId = new Map<string, ChatQuoteId[]>();
  private readonly quoteIdsByChannelId = new Map<string, ChatQuoteId[]>();
  private readonly quoteIdsByContextTag = new Map<string, ChatQuoteId[]>();
  private readonly quoteIdsByToken = new Map<string, ChatQuoteId[]>();
  private readonly useLedgerByQuoteId = new Map<string, QuoteRecallUseLedgerEntry[]>();
  private readonly subscribers = new Set<QuoteRecallSubscriber>();

  public constructor(config: Partial<QuoteRecallIndexConfig> = {}) {
    this.config = {
      ...DEFAULT_QUOTE_RECALL_INDEX_CONFIG,
      ...config,
      stopwords: config.stopwords ?? DEFAULT_QUOTE_RECALL_INDEX_CONFIG.stopwords,
    };
  }

  public subscribe(subscriber: QuoteRecallSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public clear(reason = 'clear'): void {
    const removed = Array.from(this.quoteById.keys());
    this.quoteById.clear();
    this.quoteIdsByMessageId.clear();
    this.quoteIdsBySpeakerId.clear();
    this.quoteIdsByChannelId.clear();
    this.quoteIdsByContextTag.clear();
    this.quoteIdsByToken.clear();
    this.useLedgerByQuoteId.clear();
    this.emitMutation({
      reason,
      addedQuoteIds: [],
      updatedQuoteIds: [],
      removedQuoteIds: removed,
      totalQuotes: 0,
      at: nowMs(),
    });
  }

  public hydrate(options: QuoteRecallHydrationOptions): QuoteRecallIndexMutation {
    const now = options.now ?? nowMs();
    if (options.replaceExisting) {
      this.clear(`hydrate:${options.reason}`);
    }

    const messages = options.messages ?? this.messagesFromEngine(options.engineState);
    const relationships = options.relationships ?? this.relationshipsFromEngine(options.engineState);
    const relationshipByCounterpartId = new Map<string, LegacyChatRelationshipState>();
    for (const relationship of relationships) {
      relationshipByCounterpartId.set(relationship.counterpartId, relationship);
    }

    const added: ChatQuoteId[] = [];
    const updated: ChatQuoteId[] = [];
    for (const message of messages) {
      const mutation = this.ingestMessage(message, relationshipByCounterpartId, now, 'hydrate');
      added.push(...mutation.addedQuoteIds);
      updated.push(...mutation.updatedQuoteIds);
    }

    const result: QuoteRecallIndexMutation = {
      reason: `hydrate:${options.reason}`,
      addedQuoteIds: added,
      updatedQuoteIds: updated,
      removedQuoteIds: [],
      totalQuotes: this.quoteById.size,
      at: now,
    };
    this.emitMutation(result);
    return result;
  }

  public ingestMessage(
    message: ChatMessage,
    relationshipByCounterpartId: ReadonlyMap<string, LegacyChatRelationshipState> = new Map(),
    now: UnixMs = nowMs(),
    reason = 'message',
  ): QuoteRecallIndexMutation {
    const messageId = String((message as { messageId?: string; id?: string }).messageId ?? (message as { id?: string }).id ?? '');
    const body = safeString((message as { body?: string; text?: string; content?: string }).body)
      ?? safeString((message as { text?: string }).text)
      ?? safeString((message as { content?: string }).content)
      ?? '';
    if (!messageId || !body) {
      return {
        reason: `${reason}:skipped-empty`,
        addedQuoteIds: [],
        updatedQuoteIds: [],
        removedQuoteIds: [],
        totalQuotes: this.quoteById.size,
        at: now,
      };
    }

    if (body.length < this.config.minBodyLength && !this.config.includeShortQuestions) {
      return {
        reason: `${reason}:skipped-short`,
        addedQuoteIds: [],
        updatedQuoteIds: [],
        removedQuoteIds: [],
        totalQuotes: this.quoteById.size,
        at: now,
      };
    }

    const quoteId = this.quoteIdForMessage(messageId, body);
    const counterpartId = safeString((message as { counterpartId?: string; actorId?: string; speakerId?: string }).counterpartId)
      ?? safeString((message as { actorId?: string }).actorId)
      ?? safeString((message as { speakerId?: string }).speakerId);
    const relationship = counterpartId ? relationshipByCounterpartId.get(counterpartId) : undefined;

    const tokens = tokenize(body, this.config.tokenLimit, this.config.stopwords);
    const stems = uniqueStrings(tokens.map(simpleStem));
    const channelId = String((message as { channelId?: string }).channelId ?? 'GLOBAL') as ChatChannelId;
    const speakerId = String(
      (message as { speakerId?: string; actorId?: string; senderId?: string }).speakerId
      ?? (message as { actorId?: string }).actorId
      ?? (message as { senderId?: string }).senderId
      ?? counterpartId
      ?? 'unknown:speaker'
    );
    const audienceClass = inferAudienceClass(message);
    const toneClass = inferToneClass(body, audienceClass);
    const proofHash = safeString((message as { proofHash?: string }).proofHash) as ChatProofHash | undefined;
    const contexts = inferContextTags(message, body);
    const existing = this.quoteById.get(quoteId);
    const useHistory = this.useLedgerByQuoteId.get(String(quoteId)) ?? [];

    const record: QuoteRecallIndexRecord = {
      quoteId,
      messageId: messageId as ChatMessageId,
      createdAt: ((message as { createdAt?: number; timestamp?: number }).createdAt
        ?? (message as { timestamp?: number }).timestamp
        ?? now) as UnixMs,
      roomId: safeString((message as { roomId?: string }).roomId) ?? null,
      channelId,
      sceneId: (safeString((message as { sceneId?: string }).sceneId) ?? null) as ChatSceneId | null,
      mountTarget: (safeString((message as { mountTarget?: string }).mountTarget) ?? null) as ChatMountTarget | null,
      speakerId,
      speakerLabel: safeString((message as { speakerLabel?: string; displayName?: string }).speakerLabel)
        ?? safeString((message as { displayName?: string }).displayName)
        ?? speakerId,
      actorKind: safeString((message as { actorKind?: string }).actorKind) ?? null,
      body: body.slice(0, this.config.maxBodyLength),
      normalizedBody: normalizeText(body),
      excerpt: bodyExcerpt(body),
      tokenSet: tokens,
      stemSet: stems,
      quoteRange: buildRangeFromBody(body),
      audienceClass,
      callbackEligibility: inferCallbackEligibility(body, audienceClass),
      useHistoryCount: useHistory.length,
      pressureTier: ((message as { pressureTier?: ChatPressureTier }).pressureTier ?? null),
      proofHash: proofHash ?? null,
      relationshipCounterpartId: counterpartId ?? null,
      relationshipId: (relationshipIdForCounterpart(counterpartId) ?? null) as string | null,
      tags: uniqueStrings([...(Array.isArray((message as { tags?: string[] }).tags) ? ((message as { tags?: string[] }).tags as string[]) : []), ...contexts]),
      contexts,
      legacy: relationship ? this.buildLegacyProjection(relationship, toneClass) : null,
      contextSnapshot: this.buildContextSnapshot(message, body, audienceClass, toneClass, contexts, relationship),
      lastSelectedAt: existing?.lastSelectedAt ?? null,
      sourceScore01: toScore01(this.sourceScore(body, proofHash, toneClass, relationship)),
    };

    this.upsertRecord(record);

    const mutation: QuoteRecallIndexMutation = {
      reason,
      addedQuoteIds: existing ? [] : [quoteId],
      updatedQuoteIds: existing ? [quoteId] : [],
      removedQuoteIds: [],
      totalQuotes: this.quoteById.size,
      at: now,
    };
    return mutation;
  }

  public search(query: ChatQuoteSearchQuery | QuoteRecallSelectionQuery, now: UnixMs = nowMs()): QuoteRecallSearchResult {
    const normalizedQuery = this.normalizeQuery(query);
    const candidateIds = this.collectCandidateIds(normalizedQuery);
    const ranked: Array<{ record: QuoteRecallIndexRecord; rank: QuoteRecallRankBreakdown }> = [];
    for (const quoteId of candidateIds) {
      const record = this.quoteById.get(quoteId as ChatQuoteId);
      if (!record) continue;
      const rank = this.rankRecord(record, normalizedQuery, now);
      if (rank.total01 <= 0) continue;
      ranked.push({ record, rank });
    }
    ranked.sort((a, b) => b.rank.total01 - a.rank.total01 || Number(b.record.createdAt) - Number(a.record.createdAt));

    const trimmed = ranked.slice(0, this.config.maxSearchHits);
    const hits: ChatQuoteSearchHit[] = trimmed.map(({ record, rank }) => this.toSearchHit(record, rank));
    const candidates = trimmed.slice(0, this.config.maxSelectionCandidates).map(({ record, rank }) =>
      this.toSelectionCandidate(record, rank, normalizedQuery.useIntent ?? null)
    );
    const rankByQuoteId = Object.fromEntries(trimmed.map(({ record, rank }) => [record.quoteId, rank])) as Readonly<Record<string, QuoteRecallRankBreakdown>>;
    return {
      hits,
      candidateRecords: trimmed.map((entry) => entry.record),
      selectionCandidates: candidates,
      rankByQuoteId,
    };
  }

  public selectBest(query: QuoteRecallSelectionQuery, now: UnixMs = nowMs()): ChatQuoteSelectionCandidate | undefined {
    return this.search(query, now).selectionCandidates[0];
  }

  public buildQuoteJoin(
    query: QuoteRecallSelectionQuery,
    now: UnixMs = nowMs(),
  ): ChatCallbackQuoteJoin {
    const result = this.search(query, now);
    const primary = result.candidateRecords[0];
    return {
      primaryQuote: primary ? this.toQuoteRecord(primary) : null,
      candidateQuotes: result.candidateRecords.map((record) => this.toQuoteRecord(record)),
      selectedQuoteCandidate: result.selectionCandidates[0] ?? null,
      quoteReference: result.selectionCandidates[0]
        ? this.toQuoteReference(result.selectionCandidates[0])
        : null,
    };
  }

  public rememberUse(
    quoteId: ChatQuoteId,
    useIntent: ChatQuoteUseIntent,
    callbackKind?: ChatCallbackKind | null,
    context?: Partial<ChatCallbackContext> | null,
    notes: readonly string[] = [],
    at: UnixMs = nowMs(),
  ): void {
    const current = this.useLedgerByQuoteId.get(String(quoteId)) ?? [];
    current.push({
      quoteId,
      usedAt: at,
      useIntent,
      callbackKind: callbackKind ?? null,
      channelId: context?.channelId ?? null,
      privacyClass: context?.privacyClass ?? null,
      requestId: context?.requestId ?? null,
      sceneId: context?.sceneId ?? null,
      notes,
    });
    this.useLedgerByQuoteId.set(String(quoteId), current.slice(-24));
    const existing = this.quoteById.get(quoteId);
    if (!existing) return;
    this.quoteById.set(quoteId, {
      ...existing,
      useHistoryCount: current.length,
      lastSelectedAt: at,
    });
  }

  public snapshot(now: UnixMs = nowMs()): QuoteRecallSnapshot {
    const byChannel: Record<string, number> = {};
    const bySpeaker: Record<string, number> = {};
    const byContextTag: Record<string, number> = {};
    const records = Array.from(this.quoteById.values()).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    for (const record of records) {
      byChannel[record.channelId] = (byChannel[record.channelId] ?? 0) + 1;
      bySpeaker[record.speakerId] = (bySpeaker[record.speakerId] ?? 0) + 1;
      for (const contextTag of record.contexts) {
        byContextTag[contextTag] = (byContextTag[contextTag] ?? 0) + 1;
      }
    }

    const signatureQuoteIds = records.filter((record) => hasSignatureLine(record.body)).slice(0, 16).map((record) => record.quoteId);
    const mostUsedQuoteIds = [...records]
      .sort((a, b) => b.useHistoryCount - a.useHistoryCount || Number(b.createdAt) - Number(a.createdAt))
      .slice(0, 16)
      .map((record) => record.quoteId);

    return {
      createdAt: now,
      totalQuotes: records.length,
      byChannel,
      bySpeaker,
      byContextTag,
      recentQuoteIds: records.slice(0, 24).map((record) => record.quoteId),
      signatureQuoteIds,
      mostUsedQuoteIds,
    };
  }

  public getRecord(quoteId: ChatQuoteId): QuoteRecallIndexRecord | undefined {
    return this.quoteById.get(quoteId);
  }

  public getAllRecords(): readonly QuoteRecallIndexRecord[] {
    return Array.from(this.quoteById.values()).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  }

  public prune(now: UnixMs = nowMs()): QuoteRecallIndexMutation {
    const removed: ChatQuoteId[] = [];
    const records = this.getAllRecords();
    const removeIfNeeded = (record: QuoteRecallIndexRecord): boolean => {
      const age = now - Number(record.createdAt);
      if (age > this.config.staleWindowMs * 3 && record.useHistoryCount <= 0) return true;
      const channelList = this.quoteIdsByChannelId.get(record.channelId) ?? [];
      if (channelList.length > this.config.maxQuotesPerChannel) return true;
      const speakerList = this.quoteIdsBySpeakerId.get(record.speakerId) ?? [];
      if (speakerList.length > this.config.maxQuotesPerSpeaker) return true;
      return false;
    };
    for (const record of records.slice(this.config.maxQuotes)) {
      if (!removeIfNeeded(record)) continue;
      removed.push(record.quoteId);
      this.removeQuote(record.quoteId);
    }
    const mutation: QuoteRecallIndexMutation = {
      reason: 'prune',
      addedQuoteIds: [],
      updatedQuoteIds: [],
      removedQuoteIds: removed,
      totalQuotes: this.quoteById.size,
      at: now,
    };
    if (removed.length > 0) this.emitMutation(mutation);
    return mutation;
  }

  private normalizeQuery(query: ChatQuoteSearchQuery | QuoteRecallSelectionQuery): QuoteRecallSelectionQuery {
    if ('callbackContext' in query || 'exactText' in query) return query as QuoteRecallSelectionQuery;
    const q = query as ChatQuoteSearchQuery;
    return {
      text: q.searchText,
      exactText: q.exactText,
      channelId: q.channelId,
      sceneId: q.sceneId,
      speakerId: q.speakerId,
      counterpartId: q.counterpartId,
      pressureTier: q.pressureTier,
      audienceClass: q.audienceClass,
      useIntent: q.useIntent,
      limit: q.limit,
    };
  }

  private collectCandidateIds(query: QuoteRecallSelectionQuery): string[] {
    const sets: string[][] = [];
    const exactText = safeString(query.exactText);
    const text = safeString(query.text);
    if (exactText) {
      const ids = this.exactBodyMatches(exactText);
      if (ids.length) sets.push(ids);
    }
    if (text) {
      const tokens = tokenize(text, this.config.tokenLimit, this.config.stopwords);
      for (const token of tokens) {
        const ids = this.quoteIdsByToken.get(token);
        if (ids && ids.length) sets.push(ids);
      }
    }
    if (query.speakerId) {
      const ids = this.quoteIdsBySpeakerId.get(query.speakerId);
      if (ids && ids.length) sets.push(ids);
    }
    if (query.channelId) {
      const ids = this.quoteIdsByChannelId.get(query.channelId);
      if (ids && ids.length) sets.push(ids);
    }
    if (query.counterpartId) {
      const speakerIds = this.quoteIdsBySpeakerId.get(query.counterpartId);
      if (speakerIds && speakerIds.length) sets.push(speakerIds);
    }

    if (!sets.length) {
      return this.getAllRecords().map((record) => String(record.quoteId));
    }

    const merged = new Set<string>();
    for (const set of sets) {
      for (const id of set) merged.add(String(id));
    }
    return Array.from(merged);
  }

  private exactBodyMatches(text: string): string[] {
    const normalized = normalizeText(text);
    const result: string[] = [];
    for (const record of this.quoteById.values()) {
      if (record.normalizedBody === normalized) result.push(String(record.quoteId));
    }
    return result;
  }

  private rankRecord(record: QuoteRecallIndexRecord, query: QuoteRecallSelectionQuery, now: UnixMs): QuoteRecallRankBreakdown {
    const reasons = new Set<QuoteRecallRankingReason>();
    const queryTokens = tokenize(query.text ?? query.exactText ?? '', this.config.tokenLimit, this.config.stopwords);
    const exactText01 = query.exactText && normalizeText(query.exactText) === record.normalizedBody
      ? (reasons.add('EXACT_TEXT'), 1)
      : 0;
    const tokenOverlap01 = overlapScore(queryTokens, record.tokenSet);
    if (tokenOverlap01 > 0.3) reasons.add('TOKEN_OVERLAP');
    const recency01 = scoreRecency(Number(record.createdAt), Number(now), this.config.recentWindowMs, this.config.staleWindowMs);
    reasons.add('RECENCY');
    const pressureMatch01 = pressureMatchScore(query.pressureTier, record.pressureTier);
    if (pressureMatch01 > 0.4) reasons.add('PRESSURE_MATCH');
    const channelMatch01 = query.channelId && query.channelId === record.channelId ? (reasons.add('CHANNEL_MATCH'), 1) : 0;
    const sceneMatch01 = query.sceneId && query.sceneId === record.sceneId ? (reasons.add('SCENE_MATCH'), 1) : 0;
    const counterpartMatch01 = query.counterpartId && query.counterpartId === record.relationshipCounterpartId ? (reasons.add('COUNTERPART_MATCH'), 1) : 0;
    const relationshipMatch01 = query.relationshipJoin?.counterpartState &&
      query.relationshipJoin.counterpartState.counterpartId === record.relationshipCounterpartId
      ? (reasons.add('RELATIONSHIP_MATCH'), clamp01((query.relationshipJoin.counterpartState.intensity01 ?? 0.5)))
      : 0;
    const proofBonus01 = record.proofHash ? (reasons.add('PROOF_PRESENT'), this.config.proofBonus01) : 0;
    const signatureLineBonus01 = hasSignatureLine(record.body) ? (reasons.add('SIGNATURE_LINE'), this.config.signatureLineBonus01) : 0;

    const useHistory = this.useLedgerByQuoteId.get(String(record.quoteId)) ?? [];
    let usePenalty01 = 0;
    if (useHistory.length > 0) {
      const last = useHistory[useHistory.length - 1];
      const age = Number(now) - Number(last.usedAt);
      if (age < this.config.quoteReuseCooldownMs) {
        usePenalty01 = clamp01(1 - age / Math.max(1, this.config.quoteReuseCooldownMs)) * 0.25;
      }
    }

    let stalePenalty01 = 0;
    if (recency01 < 0.2) {
      stalePenalty01 = 0.08;
    }

    let total01 =
      exactText01 * this.config.exactTextBonus01 +
      tokenOverlap01 * 0.30 +
      recency01 * 0.18 +
      pressureMatch01 * this.config.pressureMatchBonus01 +
      channelMatch01 * this.config.channelMatchBonus01 +
      sceneMatch01 * this.config.sceneMatchBonus01 +
      counterpartMatch01 * 0.10 +
      relationshipMatch01 * this.config.relationshipBonus01 +
      proofBonus01 +
      signatureLineBonus01 +
      Number(record.sourceScore01) * 0.12;

    total01 -= usePenalty01 + stalePenalty01;
    total01 = clamp01(total01);

    if (query.useIntent === 'HUMILIATE' && /you said|easy|mine|weak|again/i.test(record.body)) {
      total01 = clamp01(total01 + 0.08);
      reasons.add('HUMILIATION_WINDOW');
    }
    if (query.useIntent === 'GUIDE' && /wait|breathe|recover|listen/i.test(record.body)) {
      total01 = clamp01(total01 + 0.08);
      reasons.add('HELPER_GUIDANCE_WINDOW');
    }
    if (/collapse|failed|broke/i.test(record.body)) reasons.add('COLLAPSE_WINDOW');
    if (/comeback|still here|again/i.test(record.body)) reasons.add('COMEBACK_WINDOW');
    if (record.channelId === 'DEAL_ROOM') reasons.add('NEGOTIATION_WINDOW');
    if (query.privacyClass === 'PUBLIC') reasons.add('PUBLIC_RECEIPT');
    if (query.privacyClass === 'PRIVATE' || query.privacyClass === 'HELPER_ONLY') reasons.add('PRIVATE_RECEIPT');
    if (query.privacyClass === 'SHADOW') reasons.add('SHADOW_RECEIPT');

    return {
      total01,
      exactText01,
      tokenOverlap01,
      recency01,
      pressureMatch01,
      channelMatch01,
      sceneMatch01,
      counterpartMatch01,
      relationshipMatch01,
      proofBonus01,
      signatureLineBonus01,
      usePenalty01,
      stalePenalty01,
      reasons: Array.from(reasons),
    };
  }

  private upsertRecord(record: QuoteRecallIndexRecord): void {
    const existing = this.quoteById.get(record.quoteId);
    if (existing) {
      this.removeIndexReferences(existing);
    }
    this.quoteById.set(record.quoteId, record);
    this.pushIndexValue(this.quoteIdsByMessageId, record.messageId, record.quoteId);
    this.pushIndexValue(this.quoteIdsBySpeakerId, record.speakerId, record.quoteId);
    this.pushIndexValue(this.quoteIdsByChannelId, record.channelId, record.quoteId);
    for (const context of record.contexts) {
      this.pushIndexValue(this.quoteIdsByContextTag, context, record.quoteId);
    }
    for (const token of record.tokenSet) {
      this.pushIndexValue(this.quoteIdsByToken, token, record.quoteId);
    }
  }

  private removeQuote(quoteId: ChatQuoteId): void {
    const existing = this.quoteById.get(quoteId);
    if (!existing) return;
    this.removeIndexReferences(existing);
    this.quoteById.delete(quoteId);
    this.useLedgerByQuoteId.delete(String(quoteId));
  }

  private removeIndexReferences(record: QuoteRecallIndexRecord): void {
    this.removeIndexValue(this.quoteIdsByMessageId, record.messageId, record.quoteId);
    this.removeIndexValue(this.quoteIdsBySpeakerId, record.speakerId, record.quoteId);
    this.removeIndexValue(this.quoteIdsByChannelId, record.channelId, record.quoteId);
    for (const context of record.contexts) {
      this.removeIndexValue(this.quoteIdsByContextTag, context, record.quoteId);
    }
    for (const token of record.tokenSet) {
      this.removeIndexValue(this.quoteIdsByToken, token, record.quoteId);
    }
  }

  private pushIndexValue(map: Map<string, ChatQuoteId[]>, key: string, quoteId: ChatQuoteId): void {
    const current = map.get(String(key)) ?? [];
    if (!current.includes(quoteId)) current.push(quoteId);
    map.set(String(key), current);
  }

  private removeIndexValue(map: Map<string, ChatQuoteId[]>, key: string, quoteId: ChatQuoteId): void {
    const current = map.get(String(key));
    if (!current) return;
    const next = current.filter((id) => id !== quoteId);
    if (next.length > 0) map.set(String(key), next);
    else map.delete(String(key));
  }

  private sourceScore(
    body: string,
    proofHash: ChatProofHash | undefined,
    toneClass: ChatQuoteToneClass,
    relationship?: LegacyChatRelationshipState,
  ): number {
    let score = 0.34;
    if (proofHash) score += this.config.proofBonus01;
    if (hasSignatureLine(body)) score += this.config.signatureLineBonus01;
    if (toneClass === 'FORENSIC' || toneClass === 'PREDATORY') score += 0.05;
    if (relationship) {
      score += clamp01((relationship.rivalryIntensity + relationship.trust) / 200) * 0.10;
    }
    if (/\b(you said|remember|again|last time)\b/i.test(body)) score += 0.07;
    return clamp01(score);
  }

  private buildLegacyProjection(
    relationship: LegacyChatRelationshipState,
    toneClass: ChatQuoteToneClass,
  ): ChatQuoteLegacyProjection {
    return {
      counterpartId: relationship.counterpartId,
      respect: relationship.respect,
      fear: relationship.fear,
      contempt: relationship.contempt,
      fascination: relationship.fascination,
      trust: relationship.trust,
      familiarity: relationship.familiarity,
      rivalryIntensity: relationship.rivalryIntensity,
      rescueDebt: relationship.rescueDebt,
      adviceObedience: relationship.adviceObedience,
      escalationTier: relationship.escalationTier,
      dominantToneClass: toneClass,
    } as ChatQuoteLegacyProjection;
  }

  private buildContextSnapshot(
    message: ChatMessage,
    body: string,
    audienceClass: ChatQuoteAudienceClass,
    toneClass: ChatQuoteToneClass,
    contexts: readonly QuoteRecallContextTag[],
    relationship?: LegacyChatRelationshipState,
  ): ChatQuoteContextSnapshot {
    return {
      requestId: `ctx:${safeString((message as { messageId?: string; id?: string }).messageId) ?? safeString((message as { id?: string }).id) ?? 'unknown'}` as ChatQuoteContextSnapshot['requestId'],
      roomId: (safeString((message as { roomId?: string }).roomId) ?? null) as ChatQuoteContextSnapshot['roomId'],
      channelId: String((message as { channelId?: string }).channelId ?? 'GLOBAL') as ChatChannelId,
      sceneId: (safeString((message as { sceneId?: string }).sceneId) ?? null) as ChatSceneId | null,
      momentType: null,
      sceneArchetype: null,
      sceneRole: null,
      mountTarget: (safeString((message as { mountTarget?: string }).mountTarget) ?? null) as ChatMountTarget | null,
      pressureTier: ((message as { pressureTier?: ChatPressureTier }).pressureTier ?? null),
      audienceClass,
      toneClass,
      relationshipCounterpartId: relationship?.counterpartId ?? null,
      relationshipStance: null,
      relationshipObjective: null,
      relationshipIntensity01: relationship ? clamp01((relationship.rivalryIntensity + relationship.trust) / 200) : null,
      memoryEventType: null,
      sourceTags: contexts,
      additionalMetadata: {
        excerpt: bodyExcerpt(body, 72),
      } as JsonObject,
    };
  }

  private toSearchHit(record: QuoteRecallIndexRecord, rank: QuoteRecallRankBreakdown): ChatQuoteSearchHit {
    return {
      quoteId: record.quoteId,
      score01: toScore01(rank.total01),
      excerpt: record.excerpt,
      speakerId: record.speakerId as ChatUserId,
      channelId: record.channelId,
      createdAt: record.createdAt,
      reasons: rank.reasons,
      proofHash: record.proofHash ?? null,
    } as ChatQuoteSearchHit;
  }

  private toSelectionCandidate(
    record: QuoteRecallIndexRecord,
    rank: QuoteRecallRankBreakdown,
    useIntent: ChatQuoteUseIntent | null,
  ): ChatQuoteSelectionCandidate {
    return {
      quoteId: record.quoteId,
      score01: toScore01(rank.total01),
      excerpt: record.excerpt,
      body: record.body,
      speakerId: record.speakerId as ChatUserId,
      speakerLabel: record.speakerLabel,
      channelId: record.channelId,
      createdAt: record.createdAt,
      audienceClass: record.audienceClass,
      toneClass: inferToneClass(record.body, record.audienceClass),
      useIntent: useIntent ?? ('RECALL' as ChatQuoteUseIntent),
      proofHash: record.proofHash ?? null,
      reasons: rank.reasons,
      callbackEligibility: record.callbackEligibility,
      contextTags: record.contexts,
    } as ChatQuoteSelectionCandidate;
  }

  private toQuoteRecord(record: QuoteRecallIndexRecord): ChatQuoteRecord {
    return {
      quoteId: record.quoteId,
      fingerprint: `fingerprint:${record.quoteId}` as ChatQuoteRecord['fingerprint'],
      sourceKind: 'CHAT_MESSAGE',
      requestId: `req:${record.messageId}` as ChatQuoteRecord['requestId'],
      sourcePointer: {
        messageId: record.messageId,
        roomId: (record.roomId ?? null) as ChatQuoteRecord['sourcePointer']['roomId'],
        replayId: null,
        proofHash: record.proofHash ?? null,
        speakerId: record.speakerId as ChatUserId,
        npcId: null,
        relationshipId: (record.relationshipId ?? null) as ChatQuoteRecord['sourcePointer']['relationshipId'],
      },
      range: record.quoteRange,
      speaker: {
        actorKind: (record.actorKind ?? 'SYSTEM') as ChatQuoteRecord['speaker']['actorKind'],
        speakerId: record.speakerId as ChatUserId,
        label: record.speakerLabel,
        audienceClass: record.audienceClass,
        toneClass: inferToneClass(record.body, record.audienceClass),
      },
      context: record.contextSnapshot ?? this.buildContextSnapshot({} as ChatMessage, record.body, record.audienceClass, inferToneClass(record.body, record.audienceClass), record.contexts, undefined),
      excerpt: {
        excerptId: `excerpt:${record.quoteId}` as ChatQuoteRecord['excerpt']['excerptId'],
        body: record.body,
        excerpt: record.excerpt,
        normalizedBody: record.normalizedBody,
        tokenSet: record.tokenSet,
        stemSet: record.stemSet,
      },
      proof: {
        proofHash: record.proofHash ?? null,
        proofTier: record.proofHash ? 'HASHED' : 'NONE',
        confidence01: toScore01(record.proofHash ? 0.95 : 0.62),
      },
      redactionPolicy: {
        reason: 'NONE',
        isRedacted: false,
        allowedForPublicRecall: record.audienceClass !== 'PRIVATE',
        allowedForPrivateRecall: true,
        allowedForShadowRecall: true,
      },
      reuseBudget: {
        maxPublicUses: 4,
        maxPrivateUses: 10,
        maxShadowUses: 16,
        cooldownMs: this.config.quoteReuseCooldownMs,
      },
      useHistory: asArray(this.useLedgerByQuoteId.get(String(record.quoteId))).map((entry) => ({
        usedAt: entry.usedAt,
        useIntent: entry.useIntent,
        callbackKind: entry.callbackKind ?? null,
        channelId: entry.channelId ?? null,
        privacyClass: entry.privacyClass ?? null,
      })),
      callbackHint: null,
      semanticMarkers: {
        contexts: record.contexts,
        sentimentPolarity01: toScore01(/weak|fold|again|broke|failed/i.test(record.body) ? -0.55 + 1 : 0.55),
        intimidation01: toScore01(/weak|fold|mine|watch/i.test(record.body) ? 0.78 : 0.22),
        embarrassment01: toScore01(/you said|receipt|remember/i.test(record.body) ? 0.72 : 0.18),
        trust01: toScore01(record.legacy ? record.legacy.trust / 100 : 0.18),
        rivalry01: toScore01(record.legacy ? record.legacy.rivalryIntensity / 100 : 0.12),
      },
      audienceClass: record.audienceClass,
      visibilityState: record.channelId.includes('SHADOW') ? 'SHADOW_ONLY' : 'VISIBLE',
      lifecycleState: 'ACTIVE',
      extractionMethod: 'TRANSCRIPT_SLICE',
      callbackEligibility: record.callbackEligibility,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
      metadata: {
        sourceScore01: Number(record.sourceScore01),
        contexts: record.contexts,
      },
    } as ChatQuoteRecord;
  }

  private toQuoteReference(candidate: ChatQuoteSelectionCandidate): ChatQuoteReferenceBundle {
    return {
      primaryQuoteId: candidate.quoteId,
      quoteIds: [candidate.quoteId],
      excerpts: [candidate.excerpt],
      proofHashes: candidate.proofHash ? [candidate.proofHash] : [],
    } as ChatQuoteReferenceBundle;
  }

  private quoteIdForMessage(messageId: string, body: string): ChatQuoteId {
    return `quote:${messageId}:${normalizeText(body).slice(0, 24)}` as ChatQuoteId;
  }

  private messagesFromEngine(engineState?: ChatEngineState | null): readonly ChatMessage[] {
    if (!engineState) return [];
    const direct = (engineState as { messages?: readonly ChatMessage[] }).messages;
    if (Array.isArray(direct)) return direct;
    const allMessages = (engineState as { allMessages?: readonly ChatMessage[] }).allMessages;
    if (Array.isArray(allMessages)) return allMessages;
    return [];
  }

  private relationshipsFromEngine(engineState?: ChatEngineState | null): readonly LegacyChatRelationshipState[] {
    if (!engineState) return [];
    const direct = (engineState as { relationships?: readonly LegacyChatRelationshipState[] }).relationships;
    if (Array.isArray(direct)) return direct;
    const mapLike = (engineState as { relationshipStateById?: Record<string, LegacyChatRelationshipState> }).relationshipStateById;
    if (mapLike && typeof mapLike === 'object') return Object.values(mapLike);
    return [];
  }

  private emitMutation(mutation: QuoteRecallIndexMutation): void {
    for (const subscriber of this.subscribers) {
      subscriber(mutation);
    }
  }
}

// ============================================================================
// MARK: Convenience builders
// ============================================================================

export function buildQuoteRecallIndex(
  config: Partial<QuoteRecallIndexConfig> = {},
): QuoteRecallIndex {
  return new QuoteRecallIndex(config);
}

export function buildQuoteRecallFromEngine(
  engineState: ChatEngineState,
  config: Partial<QuoteRecallIndexConfig> = {},
): QuoteRecallIndex {
  const index = new QuoteRecallIndex(config);
  index.hydrate({
    engineState,
    replaceExisting: true,
    reason: 'engine-bootstrap',
  });
  return index;
}

export const CHAT_QUOTE_RECALL_INDEX_MANIFEST = Object.freeze({
  version: CHAT_QUOTE_RECALL_INDEX_VERSION,
  filePath: CHAT_QUOTE_RECALL_INDEX_FILE_PATH,
  authorities: {
    sharedContractsRoot: '/shared/contracts/chat',
    frontendEngineRoot: '/pzo-web/src/engines/chat',
    backendEngineRoot: '/backend/src/game/engine/chat',
    serverTransportRoot: '/pzo-server/src/chat',
  },
  exports: [
    'QuoteRecallIndex',
    'buildQuoteRecallIndex',
    'buildQuoteRecallFromEngine',
  ] as const,
});
