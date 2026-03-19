
/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT MEMORY PREVIEW
 * FILE: pzo-web/src/engines/chat/memory/ChatMemoryPreview.ts
 * ============================================================================
 *
 * Read-model purpose
 * ------------------
 * This module composes a deterministic preview of what the chat memory layer
 * currently "wants" to surface next, without authoring final bot copy.
 *
 * It exists because the runtime already has:
 * - transcript truth in ChatEngineState
 * - quote extraction / ranking in QuoteRecallIndex
 * - callback planning in CallbackMemory
 * - relationship continuity in state.relationshipsByCounterpartId
 * - scene timing, silence windows, audience heat, affect, and continuity
 *
 * The missing frontend read-model is a single composition layer that can tell
 * UI code and higher-order directors:
 * - what memory is hot right now
 * - which quote is recall-worthy
 * - which counterpart is dominating continuity
 * - whether rescue, rivalry, witness, or silence should win
 * - which surfaces should stay private vs public
 *
 * Design laws
 * -----------
 * - Preview never fabricates source truth.
 * - Preview may rank, summarize, score, and shape visibility.
 * - Preview is scene-aware and silence-aware.
 * - Preview treats private rescue differently from public witness.
 * - Preview is deterministic enough for debugging, replay, and telemetry.
 *
 * ============================================================================
 */

import type {
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatChannelId,
  ChatContinuityState,
  ChatEngineState,
  ChatMessage,
  ChatMessageId,
  ChatMountTarget,
  ChatRelationshipState,
  ChatRoomId,
  ChatScenePlan,
  ChatVisibleChannel,
  JsonObject,
  Score100,
  UnixMs,
} from '../types';
import { CHAT_VISIBLE_CHANNELS } from '../types';

import type {
  ChatCallbackCandidate,
  ChatCallbackContext,
  ChatCallbackKind,
  ChatCallbackLedgerSnapshot,
  ChatCallbackPlan,
  ChatCallbackPrivacyClass,
  ChatCallbackRecord,
} from '../../../../shared/contracts/chat/ChatCallback';

import type {
  ChatQuoteRecord,
  ChatQuoteSearchHit,
  ChatQuoteSelectionCandidate,
  ChatQuoteUseIntent,
} from '../../../../shared/contracts/chat/ChatQuote';

import {
  CallbackMemory,
  type CallbackMemoryConfig,
  type CallbackMemorySnapshot,
} from './CallbackMemory';

import {
  QuoteRecallIndex,
  type QuoteRecallIndexConfig,
  type QuoteRecallIndexRecord,
  type QuoteRecallSearchResult,
  type QuoteRecallSelectionQuery,
  type QuoteRecallSnapshot,
} from './QuoteRecallIndex';

import {
  buildTrustGraphRecommendations,
  buildTrustGraphSnapshot,
  type TrustGraphRecommendations,
  type TrustGraphSnapshot,
} from './TrustGraph';

// ============================================================================
// MARK: Constants
// ============================================================================

export const CHAT_MEMORY_PREVIEW_VERSION = '1.0.0' as const;
export const CHAT_MEMORY_PREVIEW_FILE_PATH =
  'pzo-web/src/engines/chat/memory/ChatMemoryPreview.ts' as const;

export const CHAT_MEMORY_PREVIEW_CARD_KINDS = [
  'CALLBACK',
  'QUOTE',
  'RELATIONSHIP',
  'SCENE',
  'SILENCE',
  'AUDIENCE',
  'AFFECT',
  'CONTINUITY',
  'SUMMARY',
  'WARNING',
  'WITNESS',
  'DEBUG',
] as const;

export const CHAT_MEMORY_PREVIEW_ACTION_KINDS = [
  'EMIT_PUBLIC_RECEIPT',
  'EMIT_PRIVATE_WARNING',
  'HOLD_FOR_SILENCE',
  'QUEUE_RESCUE',
  'WAIT_FOR_SCENE_BEAT',
  'PIN_QUOTE',
  'PIN_COUNTERPART',
  'SHIFT_PRIVATE',
  'SHIFT_PUBLIC',
  'DO_NOT_USE',
] as const;

export const CHAT_MEMORY_PREVIEW_PRIORITIES = [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
] as const;

export type ChatMemoryPreviewCardKind =
  (typeof CHAT_MEMORY_PREVIEW_CARD_KINDS)[number];

export type ChatMemoryPreviewActionKind =
  (typeof CHAT_MEMORY_PREVIEW_ACTION_KINDS)[number];

export type ChatMemoryPreviewPriority =
  (typeof CHAT_MEMORY_PREVIEW_PRIORITIES)[number];

// ============================================================================
// MARK: Contracts
// ============================================================================

export interface ChatMemoryPreviewConfig {
  readonly maxCardsTotal: number;
  readonly maxCardsPerChannel: number;
  readonly maxActionsTotal: number;
  readonly maxEvidenceTotal: number;
  readonly maxSummaries: number;
  readonly maxCallbacks: number;
  readonly maxQuotes: number;
  readonly maxRelationships: number;
  readonly maxWitnessCards: number;
  readonly dismissalTtlMs: number;
  readonly staleWindowMs: number;
  readonly useTrustGraphByDefault: boolean;
  readonly includeDebugCards: boolean;
  readonly includeDiagnostics: boolean;
  readonly autoSuppressDismissed: boolean;

  readonly callbackWeight01: number;
  readonly quoteWeight01: number;
  readonly relationshipWeight01: number;
  readonly sceneWeight01: number;
  readonly silenceWeight01: number;
  readonly audienceWeight01: number;
  readonly affectWeight01: number;
  readonly continuityWeight01: number;
  readonly proofBonus01: number;

  readonly warningThreshold01: number;
  readonly criticalThreshold01: number;
  readonly rivalryThresholdScore: Score100;
  readonly trustThresholdScore: Score100;
  readonly embarrassmentThresholdScore: Score100;
  readonly rescueDebtThresholdScore: Score100;

  readonly callbackMemory?: Partial<CallbackMemoryConfig>;
  readonly quoteRecall?: Partial<QuoteRecallIndexConfig>;
}

export const DEFAULT_CHAT_MEMORY_PREVIEW_CONFIG: ChatMemoryPreviewConfig =
  Object.freeze({
    maxCardsTotal: 48,
    maxCardsPerChannel: 14,
    maxActionsTotal: 14,
    maxEvidenceTotal: 128,
    maxSummaries: 12,
    maxCallbacks: 10,
    maxQuotes: 8,
    maxRelationships: 8,
    maxWitnessCards: 5,
    dismissalTtlMs: 1000 * 45,
    staleWindowMs: 1000 * 60 * 10,
    useTrustGraphByDefault: true,
    includeDebugCards: false,
    includeDiagnostics: true,
    autoSuppressDismissed: true,

    callbackWeight01: 0.16,
    quoteWeight01: 0.13,
    relationshipWeight01: 0.14,
    sceneWeight01: 0.10,
    silenceWeight01: 0.10,
    audienceWeight01: 0.09,
    affectWeight01: 0.09,
    continuityWeight01: 0.08,
    proofBonus01: 0.11,

    warningThreshold01: 0.56,
    criticalThreshold01: 0.84,
    rivalryThresholdScore: 61 as Score100,
    trustThresholdScore: 60 as Score100,
    embarrassmentThresholdScore: 62 as Score100,
    rescueDebtThresholdScore: 58 as Score100,

    callbackMemory: {},
    quoteRecall: {},
  });

export interface ChatMemoryPreviewEvidence {
  readonly evidenceId: string;
  readonly kind:
    | 'MESSAGE'
    | 'QUOTE'
    | 'CALLBACK'
    | 'RELATIONSHIP'
    | 'SCENE'
    | 'AFFECT'
    | 'AUDIENCE'
    | 'CONTINUITY'
    | 'DEBUG';
  readonly label: string;
  readonly description: string;
  readonly relatedMessageId?: ChatMessageId | null;
  readonly relatedQuoteId?: string | null;
  readonly relatedCallbackId?: string | null;
  readonly relatedCounterpartId?: string | null;
  readonly proofHash?: string | null;
  readonly score01?: number;
  readonly tags: readonly string[];
  readonly raw?: JsonObject;
}

export interface ChatMemoryPreviewAction {
  readonly actionId: string;
  readonly kind: ChatMemoryPreviewActionKind;
  readonly label: string;
  readonly reason: string;
  readonly priority: ChatMemoryPreviewPriority;
  readonly score01: number;
  readonly channelId?: ChatVisibleChannel | null;
  readonly counterpartId?: string | null;
  readonly callbackId?: string | null;
  readonly quoteId?: string | null;
  readonly sceneId?: string | null;
  readonly privatePreferred: boolean;
  readonly tags: readonly string[];
}

export interface ChatMemoryPreviewCard {
  readonly cardId: string;
  readonly kind: ChatMemoryPreviewCardKind;
  readonly priority: ChatMemoryPreviewPriority;
  readonly channelId?: ChatVisibleChannel | null;
  readonly counterpartId?: string | null;
  readonly title: string;
  readonly subtitle?: string;
  readonly body: string;
  readonly hint?: string;
  readonly score01: number;
  readonly visibility: 'PUBLIC' | 'PRIVATE' | 'MIXED';
  readonly suppressibleBySilence: boolean;
  readonly canPromoteToAction: boolean;
  readonly dismissalKey: string;
  readonly createdAt: UnixMs;
  readonly staleAt: UnixMs;
  readonly messageIds: readonly ChatMessageId[];
  readonly quoteIds: readonly string[];
  readonly callbackIds: readonly string[];
  readonly evidence: readonly ChatMemoryPreviewEvidence[];
  readonly actions: readonly ChatMemoryPreviewAction[];
  readonly tags: readonly string[];
  readonly raw?: JsonObject;
}

export interface ChatMemoryPreviewChannelPanel {
  readonly channelId: ChatVisibleChannel;
  readonly headline: string;
  readonly summary: string;
  readonly heatLabel: string;
  readonly riskLabel: string;
  readonly cards: readonly ChatMemoryPreviewCard[];
  readonly actions: readonly ChatMemoryPreviewAction[];
  readonly dominantCounterpartId?: string;
  readonly silentRecommended: boolean;
}

export interface ChatMemoryPreviewSummaryLine {
  readonly summaryId: string;
  readonly priority: ChatMemoryPreviewPriority;
  readonly text: string;
  readonly tags: readonly string[];
}

export interface ChatMemoryPreviewDiagnostics {
  readonly callbackSnapshot?: CallbackMemorySnapshot;
  readonly callbackLedger?: ChatCallbackLedgerSnapshot;
  readonly quoteSnapshot?: QuoteRecallSnapshot;
  readonly trustSnapshot?: TrustGraphSnapshot;
  readonly trustRecommendations?: TrustGraphRecommendations;
  readonly activeCardsByKind: Readonly<Record<string, number>>;
  readonly droppedCardReasons: Readonly<Record<string, number>>;
  readonly dismissedCardCount: number;
}

export interface ChatMemoryPreviewSnapshot {
  readonly version: string;
  readonly createdAt: UnixMs;
  readonly roomId?: ChatRoomId | null;
  readonly mountTarget: ChatMountTarget;
  readonly activeVisibleChannel: ChatVisibleChannel;
  readonly headline: string;
  readonly summaries: readonly ChatMemoryPreviewSummaryLine[];
  readonly activeCards: readonly ChatMemoryPreviewCard[];
  readonly channelPanels: readonly ChatMemoryPreviewChannelPanel[];
  readonly actionRail: readonly ChatMemoryPreviewAction[];
  readonly evidenceLedger: readonly ChatMemoryPreviewEvidence[];
  readonly silentRecommended: boolean;
  readonly hotCounterpartIds: readonly string[];
  readonly diagnostics?: ChatMemoryPreviewDiagnostics;
}

export interface BuildChatMemoryPreviewOptions {
  readonly now?: UnixMs;
  readonly trustSnapshot?: TrustGraphSnapshot;
  readonly trustRecommendations?: TrustGraphRecommendations;
  readonly includeDebugCards?: boolean;
  readonly includeDismissed?: boolean;
  readonly contextTag?: string;
}

export interface ChatMemoryPreviewSubscriber {
  (snapshot: ChatMemoryPreviewSnapshot): void;
}

// ============================================================================
// MARK: Local helpers
// ============================================================================

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Number(value.toFixed(6));
}

function toScore01(value: Score100 | number | undefined | null): number {
  if (value == null) return 0;
  return clamp01(Number(value) / 100);
}

function compact<T>(values: readonly (T | null | undefined)[]): readonly T[] {
  return values.filter((value): value is T => value != null);
}

function uniqueStrings(values: readonly (string | null | undefined)[]): readonly string[] {
  const out = new Set<string>();
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (!normalized) continue;
    out.add(normalized);
  }
  return [...out];
}

function trimText(text: string | undefined | null, max: number): string {
  const normalized = String(text ?? '').trim();
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function summarizeText(text: string | undefined | null, max = 144): string {
  const out = trimText(text, max);
  return out || 'No summary available.';
}

function joinPhrases(parts: readonly (string | null | undefined)[]): string {
  return compact(parts.map((part) => {
    const normalized = String(part ?? '').trim();
    return normalized || null;
  })).join(' · ');
}

function stableFragment(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function cardId(kind: string, key: string): string {
  return `cmp:${kind.toLowerCase()}:${stableFragment(key)}`;
}

function actionId(kind: string, key: string): string {
  return `act:${kind.toLowerCase()}:${stableFragment(key)}`;
}

function evidenceId(kind: string, key: string): string {
  return `ev:${kind.toLowerCase()}:${stableFragment(key)}`;
}

function scoreToPriority(score01: number): ChatMemoryPreviewPriority {
  if (score01 >= 0.84) return 'CRITICAL';
  if (score01 >= 0.64) return 'HIGH';
  if (score01 >= 0.38) return 'NORMAL';
  return 'LOW';
}

function previewVisibility(
  privacyClass?: ChatCallbackPrivacyClass | null,
  channelId?: ChatVisibleChannel | null,
): 'PUBLIC' | 'PRIVATE' | 'MIXED' {
  if (privacyClass === 'PRIVATE') return 'PRIVATE';
  if (privacyClass === 'PUBLIC') return 'PUBLIC';
  if (channelId === 'DIRECT') return 'PRIVATE';
  if (channelId === 'DEAL_ROOM') return 'MIXED';
  return 'PUBLIC';
}

function channelHeadline(channelId: ChatVisibleChannel): string {
  switch (channelId) {
    case 'GLOBAL':
      return 'Global witness pressure';
    case 'SYNDICATE':
      return 'Syndicate continuity';
    case 'DEAL_ROOM':
      return 'Deal-room leverage';
    case 'DIRECT':
      return 'Direct/private continuity';
    case 'SPECTATOR':
      return 'Spectator witness pressure';
    default:
      return `${channelId} memory preview`;
  }
}

function heatLabel(heat: ChatAudienceHeat | undefined): string {
  if (!heat) return 'unknown';
  if (Number(heat.heat) >= 82) return 'boiling';
  if (Number(heat.heat) >= 62) return 'hot';
  if (Number(heat.heat) >= 40) return 'active';
  return 'quiet';
}

function dominantRiskLabel(
  relationship: ChatRelationshipState | undefined,
  affect: ChatAffectSnapshot | undefined,
): string {
  const rivalry = toScore01(relationship?.vector.rivalryIntensity);
  const trust = toScore01(relationship?.vector.trust);
  const embarrassment = toScore01(affect?.vector.embarrassment);
  const desperation = toScore01(affect?.vector.desperation);

  if (Math.max(rivalry, embarrassment, desperation) >= 0.8) return 'exposed';
  if (trust >= 0.72 && rivalry <= 0.42) return 'recoverable';
  if (rivalry >= 0.58) return 'hostile';
  if (embarrassment >= 0.58 || desperation >= 0.58) return 'fragile';
  return 'stable';
}

function newestMessage(messages: readonly ChatMessage[]): ChatMessage | undefined {
  return [...messages].sort((a, b) => Number(b.ts) - Number(a.ts))[0];
}

function flattenMessages(state: ChatEngineState): readonly ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const channelId of CHAT_VISIBLE_CHANNELS) {
    out.push(...state.messagesByChannel[channelId]);
  }
  return out.sort((a, b) => Number(b.ts) - Number(a.ts));
}

function relationshipsByHotness(
  state: ChatEngineState,
): readonly ChatRelationshipState[] {
  return Object.values(state.relationshipsByCounterpartId).sort((a, b) => {
    const ax =
      Number(a.vector.rivalryIntensity) * 1.3 +
      Number(a.vector.rescueDebt) * 0.6 +
      Number(a.vector.fascination) * 0.4 +
      Number(a.vector.trust) * 0.25;
    const bx =
      Number(b.vector.rivalryIntensity) * 1.3 +
      Number(b.vector.rescueDebt) * 0.6 +
      Number(b.vector.fascination) * 0.4 +
      Number(b.vector.trust) * 0.25;
    return bx - ax;
  });
}

function topSelectionCandidates(
  result: QuoteRecallSearchResult | undefined,
  limit: number,
): readonly ChatQuoteSelectionCandidate[] {
  return result?.selectionCandidates.slice(0, Math.max(0, limit)) ?? [];
}

function topCandidateRecords(
  result: QuoteRecallSearchResult | undefined,
  limit: number,
): readonly QuoteRecallIndexRecord[] {
  return result?.candidateRecords.slice(0, Math.max(0, limit)) ?? [];
}

function topHits(
  result: QuoteRecallSearchResult | undefined,
  limit: number,
): readonly ChatQuoteSearchHit[] {
  return result?.hits.slice(0, Math.max(0, limit)) ?? [];
}

function previewChannelList(active: ChatVisibleChannel): readonly ChatVisibleChannel[] {
  return [active, ...CHAT_VISIBLE_CHANNELS.filter((channel) => channel !== active)];
}

function buildEvidence(
  kind: ChatMemoryPreviewEvidence['kind'],
  key: string,
  label: string,
  description: string,
  extras: Partial<ChatMemoryPreviewEvidence> = {},
): ChatMemoryPreviewEvidence {
  return {
    evidenceId: evidenceId(kind, key),
    kind,
    label,
    description,
    tags: [],
    ...extras,
  };
}

function buildAction(
  kind: ChatMemoryPreviewActionKind,
  key: string,
  label: string,
  reason: string,
  score01: number,
  priority: ChatMemoryPreviewPriority,
  extras: Partial<ChatMemoryPreviewAction> = {},
): ChatMemoryPreviewAction {
  return {
    actionId: actionId(kind, key),
    kind,
    label,
    reason,
    priority,
    score01: clamp01(score01),
    privatePreferred: false,
    tags: [],
    ...extras,
  };
}

function createCountSeed(keys: readonly string[]): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const key of keys) out[key] = 0;
  return out;
}

function sceneSummary(scene?: ChatScenePlan | null): string {
  if (!scene) return 'No active scene.';
  return joinPhrases([
    scene.momentType,
    scene.primaryChannel,
    `${scene.beats.length} beats`,
    scene.allowPlayerComposerDuringScene ? 'composer open' : 'composer held',
  ]);
}

function continuitySummary(continuity: ChatContinuityState): string {
  return joinPhrases([
    continuity.lastMountTarget ?? 'no prior mount',
    continuity.activeSceneId ? `scene ${continuity.activeSceneId}` : 'no scene',
    `${continuity.unresolvedMomentIds.length} unresolved`,
    `${continuity.carriedPersonaIds.length} carried personas`,
  ]);
}

function callbackChannel(
  record: ChatCallbackRecord,
  fallback: ChatVisibleChannel,
): ChatVisibleChannel {
  const raw = String(record.context.channelId ?? fallback).trim() as ChatVisibleChannel;
  return CHAT_VISIBLE_CHANNELS.includes(raw) ? raw : fallback;
}

function callbackPrimaryQuoteId(record: ChatCallbackRecord): string | undefined {
  return record.selectedCandidate.quoteJoin?.primaryQuote
    ? String(record.selectedCandidate.quoteJoin?.primaryQuote?.quoteId)
    : undefined;
}

function callbackSuppressionReason(record: ChatCallbackRecord): string {
  return String(record.selectedCandidate.suppressionReason ?? record.suppressionReason ?? 'NONE');
}

// ============================================================================
// MARK: Preview engine
// ============================================================================

export class ChatMemoryPreview {
  private readonly config: ChatMemoryPreviewConfig;
  private readonly callbackMemory?: CallbackMemory;
  private readonly quoteRecallIndex: QuoteRecallIndex;
  private readonly subscribers = new Set<ChatMemoryPreviewSubscriber>();
  private readonly dismissedUntilByKey = new Map<string, UnixMs>();
  private readonly droppedCardReasons = new Map<string, number>();
  private lastSnapshot?: ChatMemoryPreviewSnapshot;

  public constructor(options: {
    readonly config?: Partial<ChatMemoryPreviewConfig>;
    readonly callbackMemory?: CallbackMemory;
    readonly quoteRecallIndex?: QuoteRecallIndex;
  } = {}) {
    this.config = {
      ...DEFAULT_CHAT_MEMORY_PREVIEW_CONFIG,
      ...options.config,
      callbackMemory: {
        ...DEFAULT_CHAT_MEMORY_PREVIEW_CONFIG.callbackMemory,
        ...(options.config?.callbackMemory ?? {}),
      },
      quoteRecall: {
        ...DEFAULT_CHAT_MEMORY_PREVIEW_CONFIG.quoteRecall,
        ...(options.config?.quoteRecall ?? {}),
      },
    };

    this.callbackMemory = options.callbackMemory;
    this.quoteRecallIndex =
      options.quoteRecallIndex ??
      options.callbackMemory?.getQuoteIndex() ??
      new QuoteRecallIndex(this.config.quoteRecall);
  }

  public subscribe(subscriber: ChatMemoryPreviewSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  public getLastSnapshot(): ChatMemoryPreviewSnapshot | undefined {
    return this.lastSnapshot;
  }

  public dismissCard(
    dismissalKey: string,
    now: UnixMs = nowMs(),
    ttlMs = this.config.dismissalTtlMs,
  ): void {
    this.dismissedUntilByKey.set(
      String(dismissalKey),
      (Number(now) + Math.max(0, ttlMs)) as UnixMs,
    );
  }

  public clearDismissed(now: UnixMs = nowMs()): void {
    for (const [key, until] of this.dismissedUntilByKey.entries()) {
      if (Number(until) <= Number(now)) {
        this.dismissedUntilByKey.delete(key);
      }
    }
  }

  public build(
    state: ChatEngineState,
    options: BuildChatMemoryPreviewOptions = {},
  ): ChatMemoryPreviewSnapshot {
    const now = options.now ?? nowMs();
    this.clearDismissed(now);

    const trustSnapshot =
      options.trustSnapshot ??
      (this.config.useTrustGraphByDefault ? buildTrustGraphSnapshot(state) : undefined);

    const trustRecommendations =
      options.trustRecommendations ??
      (this.config.useTrustGraphByDefault
        ? buildTrustGraphRecommendations(state)
        : undefined);

    const callbackRecords = this.resolveCallbackRecords(state);
    const callbackPlans = this.resolveCallbackPlans();
    const callbackLedger = this.callbackMemory?.toLedgerSnapshot(now);
    const quoteSnapshot = this.quoteRecallIndex.snapshot(now);

    const orderedChannels = previewChannelList(state.activeVisibleChannel);
    const relationships = relationshipsByHotness(state);
    const dominantRelationship = relationships[0];
    const allMessages = flattenMessages(state);

    const cards = compact<ChatMemoryPreviewCard>([
      ...this.buildCallbackCards(state, callbackRecords, now),
      ...this.buildQuoteCards(state, orderedChannels, now),
      ...this.buildRelationshipCards(state, relationships, trustRecommendations, now),
      ...this.buildSceneCards(state, now),
      ...this.buildSilenceCards(state, trustRecommendations, now),
      ...this.buildAudienceCards(state, orderedChannels, trustSnapshot, now),
      ...this.buildAffectCards(state, now),
      ...this.buildContinuityCards(state, now),
      ...this.buildSummaryCards(state, dominantRelationship, allMessages, quoteSnapshot, now),
      ...(options.includeDebugCards ?? this.config.includeDebugCards
        ? this.buildDebugCards(state, callbackRecords, callbackPlans, quoteSnapshot, trustSnapshot, trustRecommendations, now)
        : []),
    ]);

    const filteredCards = this.filterCards(cards, options.includeDismissed === true, now);
    const activeCards = [...filteredCards]
      .sort((a, b) => b.score01 - a.score01)
      .slice(0, this.config.maxCardsTotal);

    const channelPanels = orderedChannels.map((channelId) =>
      this.buildChannelPanel(channelId, activeCards, state),
    );

    const actionRail = this.buildActionRail(
      activeCards,
      state,
      trustRecommendations,
    );

    const evidenceLedger = this.buildEvidenceLedger(activeCards);
    const headline = this.buildHeadline(
      state,
      activeCards,
      dominantRelationship,
      trustRecommendations,
    );
    const summaries = this.buildSummaryLines(
      state,
      activeCards,
      callbackRecords,
      quoteSnapshot,
      trustRecommendations,
    );

    const snapshot: ChatMemoryPreviewSnapshot = {
      version: CHAT_MEMORY_PREVIEW_VERSION,
      createdAt: now,
      roomId: state.memberships[0]?.roomId ?? null,
      mountTarget: state.activeMountTarget,
      activeVisibleChannel: state.activeVisibleChannel,
      headline,
      summaries,
      activeCards,
      channelPanels,
      actionRail,
      evidenceLedger,
      silentRecommended: this.shouldRecommendSilence(
        state,
        activeCards,
        trustRecommendations,
      ),
      hotCounterpartIds: uniqueStrings(
        compact([
          dominantRelationship?.counterpartId ?? null,
          ...relationships.slice(0, 5).map((relationship) => relationship.counterpartId),
        ]),
      ),
      diagnostics: this.config.includeDiagnostics
        ? {
            callbackSnapshot: this.callbackMemory?.snapshot(now),
            callbackLedger,
            quoteSnapshot,
            trustSnapshot,
            trustRecommendations,
            activeCardsByKind: this.countCardsByKind(activeCards),
            droppedCardReasons: Object.freeze(Object.fromEntries(this.droppedCardReasons)),
            dismissedCardCount: this.dismissedUntilByKey.size,
          }
        : undefined,
    };

    this.lastSnapshot = snapshot;
    for (const subscriber of this.subscribers) subscriber(snapshot);
    return snapshot;
  }

  // --------------------------------------------------------------------------
  // MARK: Resolvers
  // --------------------------------------------------------------------------

  private resolveCallbackRecords(state: ChatEngineState): readonly ChatCallbackRecord[] {
    if (!this.callbackMemory) return [];
    const out: ChatCallbackRecord[] = [];
    const seen = new Set<string>();

    for (const record of [
      ...this.callbackMemory.getPendingForChannel(state.activeVisibleChannel),
      ...this.callbackMemory.getRecords(),
    ]) {
      if (seen.has(record.callbackId)) continue;
      seen.add(record.callbackId);
      out.push(record);
      if (out.length >= this.config.maxCallbacks) break;
    }

    return out;
  }

  private resolveCallbackPlans(): readonly ChatCallbackPlan[] {
    if (!this.callbackMemory) return [];
    return this.callbackMemory.getPlans().slice(0, this.config.maxCallbacks);
  }

  // --------------------------------------------------------------------------
  // MARK: Card builders — callback
  // --------------------------------------------------------------------------

  private buildCallbackCards(
    state: ChatEngineState,
    records: readonly ChatCallbackRecord[],
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    return records.slice(0, this.config.maxCallbacks).map((record) => {
      const candidate = record.selectedCandidate;
      const channelId = callbackChannel(record, state.activeVisibleChannel);
      const quoteId = callbackPrimaryQuoteId(record);
      const score01 = clamp01(
        Number(candidate.score01) * 0.72 +
          Number(candidate.confidence01) * 0.18 +
          this.config.callbackWeight01,
      );

      const evidence = compact<ChatMemoryPreviewEvidence>([
        buildEvidence(
          'CALLBACK',
          `${record.callbackId}:callback`,
          'Callback record',
          joinPhrases([
            `kind ${candidate.callbackKind}`,
            `privacy ${candidate.privacyClass}`,
            `state ${record.lifecycleState}`,
          ]),
          {
            relatedCallbackId: record.callbackId,
            relatedCounterpartId: record.context.counterpartId ?? null,
            score01,
            tags: ['callback', candidate.callbackKind.toLowerCase()],
          },
        ),
        quoteId
          ? buildEvidence(
              'QUOTE',
              `${record.callbackId}:quote`,
              'Primary callback quote',
              summarizeText(candidate.quoteJoin?.primaryQuote?.text, 88),
              {
                relatedQuoteId: quoteId,
                relatedMessageId: candidate.quoteJoin?.primaryQuote?.source.messageId ?? null,
                score01,
                tags: ['callback', 'quote'],
              },
            )
          : null,
        candidate.relationshipJoin?.relationshipSnapshot
          ? buildEvidence(
              'RELATIONSHIP',
              `${record.callbackId}:relationship`,
              'Relationship join',
              'Callback is relationship-grounded.',
              {
                relatedCounterpartId: record.context.counterpartId ?? null,
                score01,
                tags: ['callback', 'relationship'],
              },
            )
          : null,
      ]);

      const actions = compact<ChatMemoryPreviewAction>([
        buildAction(
          candidate.privacyClass === 'PRIVATE'
            ? 'EMIT_PRIVATE_WARNING'
            : 'EMIT_PUBLIC_RECEIPT',
          `${record.callbackId}:emit`,
          candidate.privacyClass === 'PRIVATE'
            ? 'Emit privately'
            : 'Emit publicly',
          `selected ${candidate.callbackKind.toLowerCase().replace(/_/g, ' ')}`,
          score01,
          scoreToPriority(score01),
          {
            channelId,
            counterpartId: record.context.counterpartId ?? null,
            callbackId: record.callbackId,
            privatePreferred: candidate.privacyClass === 'PRIVATE',
            tags: ['callback', candidate.callbackKind.toLowerCase()],
          },
        ),
        callbackSuppressionReason(record) !== 'NONE'
          ? buildAction(
              'DO_NOT_USE',
              `${record.callbackId}:suppress`,
              'Hold callback',
              callbackSuppressionReason(record).toLowerCase().replace(/_/g, ' '),
              clamp01(score01 * 0.8),
              scoreToPriority(score01 * 0.8),
              {
                channelId,
                callbackId: record.callbackId,
                privatePreferred: true,
                tags: ['callback', 'suppression'],
              },
            )
          : null,
      ]);

      return {
        cardId: cardId('callback', record.callbackId),
        kind: 'CALLBACK',
        priority: scoreToPriority(score01),
        channelId,
        counterpartId: record.context.counterpartId ?? null,
        title: this.callbackTitle(record),
        subtitle: joinPhrases([
          candidate.callbackKind,
          candidate.privacyClass,
          record.lifecycleState,
        ]),
        body: this.callbackBody(record),
        hint: this.callbackHint(record),
        score01,
        visibility: previewVisibility(candidate.privacyClass, channelId),
        suppressibleBySilence: record.executedPlan?.canBeSuppressedBySilenceWindow ?? true,
        canPromoteToAction: true,
        dismissalKey: `callback:${record.callbackId}`,
        createdAt: record.createdAt,
        staleAt: (Number(now) + this.config.staleWindowMs) as UnixMs,
        messageIds: record.emittedMessageIds,
        quoteIds: compact([quoteId]),
        callbackIds: [record.callbackId],
        evidence,
        actions,
        tags: uniqueStrings([
          'callback',
          candidate.callbackKind,
          candidate.narrativeIntent,
          candidate.privacyClass,
          record.lifecycleState,
        ]),
        raw: {
          callbackId: record.callbackId,
          planId: record.executedPlan?.planId ?? null,
          suppressionReason: callbackSuppressionReason(record),
        },
      };
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Card builders — quote
  // --------------------------------------------------------------------------

  private buildQuoteCards(
    state: ChatEngineState,
    orderedChannels: readonly ChatVisibleChannel[],
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    const cards: ChatMemoryPreviewCard[] = [];
    for (const channelId of orderedChannels) {
      const result = this.quoteRecallIndex.search(this.quoteQuery(state, channelId), now);
      const records = topCandidateRecords(result, 3);
      const selections = topSelectionCandidates(result, 3);
      const hits = topHits(result, 3);

      for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        const selection = selections[index];
        const hit = hits[index];
        const baseScore = selection?.score01 ?? hit?.score01 ?? record.sourceScore01 ?? 0.38;
        const score01 = clamp01(
          Number(baseScore) * 0.74 +
            (record.proofHash ? this.config.proofBonus01 : 0) +
            this.config.quoteWeight01,
        );

        const evidence = compact<ChatMemoryPreviewEvidence>([
          buildEvidence(
            'QUOTE',
            `${record.quoteId}:quote`,
            'Recallable quote',
            summarizeText(record.body, 108),
            {
              relatedQuoteId: String(record.quoteId),
              relatedMessageId: record.messageId,
              proofHash: record.proofHash ?? null,
              score01,
              tags: ['quote', ...record.tags],
            },
          ),
          hit
            ? buildEvidence(
                'DEBUG',
                `${record.quoteId}:search`,
                'Search hit',
                `search matched ${hit.score01.toFixed(3)}`,
                {
                  relatedQuoteId: String(record.quoteId),
                  relatedMessageId: record.messageId,
                  score01: hit.score01,
                  tags: ['quote', 'search'],
                },
              )
            : null,
        ]);

        const actions = compact<ChatMemoryPreviewAction>([
          buildAction(
            'PIN_QUOTE',
            `${record.quoteId}:pin`,
            'Pin quote',
            `quote is active for ${channelId}`,
            score01,
            scoreToPriority(score01),
            {
              channelId,
              counterpartId: record.relationshipCounterpartId ?? null,
              quoteId: String(record.quoteId),
              privatePreferred: channelId === 'DIRECT',
              tags: ['quote', 'pin'],
            },
          ),
          channelId === 'DIRECT' || channelId === 'DEAL_ROOM'
            ? buildAction(
                'SHIFT_PRIVATE',
                `${record.quoteId}:private`,
                'Prefer private usage',
                'channel dynamics favor private recall first',
                clamp01(score01 * 0.9),
                scoreToPriority(score01 * 0.9),
                {
                  channelId,
                  quoteId: String(record.quoteId),
                  privatePreferred: true,
                  tags: ['quote', 'private'],
                },
              )
            : null,
        ]);

        cards.push({
          cardId: cardId('quote', `${channelId}:${record.quoteId}`),
          kind: 'QUOTE',
          priority: scoreToPriority(score01),
          channelId,
          counterpartId: record.relationshipCounterpartId ?? null,
          title: `Recallable quote from ${record.speakerLabel}`,
          subtitle: joinPhrases([
            selection?.intent ?? 'REMINDER',
            record.callbackEligibility,
            record.channelId,
          ]),
          body: summarizeText(record.body, 160),
          hint: this.quoteHint(record, selection),
          score01,
          visibility: previewVisibility(
            channelId === 'DIRECT' ? 'PRIVATE' : channelId === 'GLOBAL' ? 'PUBLIC' : null,
            channelId,
          ),
          suppressibleBySilence: true,
          canPromoteToAction: true,
          dismissalKey: `quote:${record.quoteId}`,
          createdAt: record.createdAt,
          staleAt: (Number(now) + this.config.staleWindowMs) as UnixMs,
          messageIds: [record.messageId],
          quoteIds: [String(record.quoteId)],
          callbackIds: [],
          evidence,
          actions,
          tags: uniqueStrings(['quote', record.channelId, ...record.tags, ...record.contexts]),
          raw: {
            quoteId: record.quoteId,
            proofHash: record.proofHash ?? null,
            audienceClass: record.audienceClass,
          },
        });

        if (cards.length >= this.config.maxQuotes) break;
      }

      if (cards.length >= this.config.maxQuotes) break;
    }
    return cards;
  }

  // --------------------------------------------------------------------------
  // MARK: Card builders — relationship
  // --------------------------------------------------------------------------

  private buildRelationshipCards(
    state: ChatEngineState,
    relationships: readonly ChatRelationshipState[],
    trustRecommendations: TrustGraphRecommendations | undefined,
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    return relationships.slice(0, this.config.maxRelationships).map((relationship) => {
      const rivalry01 = toScore01(relationship.vector.rivalryIntensity);
      const trust01 = toScore01(relationship.vector.trust);
      const rescueDebt01 = toScore01(relationship.vector.rescueDebt);
      const familiarity01 = toScore01(relationship.vector.familiarity);
      const fascination01 = toScore01(relationship.vector.fascination);
      const score01 = clamp01(
        rivalry01 * 0.36 +
          rescueDebt01 * 0.18 +
          trust01 * 0.16 +
          familiarity01 * 0.14 +
          fascination01 * 0.16 +
          this.config.relationshipWeight01,
      );

      const disposition =
        trustRecommendations?.recommendedDispositionsByCounterpartId?.[
          relationship.counterpartId
        ];

      const evidence = [
        buildEvidence(
          'RELATIONSHIP',
          `${relationship.counterpartId}:relationship`,
          'Relationship vector',
          joinPhrases([
            `trust ${relationship.vector.trust}`,
            `rivalry ${relationship.vector.rivalryIntensity}`,
            `fear ${relationship.vector.fear}`,
            `rescue debt ${relationship.vector.rescueDebt}`,
          ]),
          {
            relatedCounterpartId: relationship.counterpartId,
            score01,
            tags: ['relationship', relationship.escalationTier.toLowerCase()],
          },
        ),
      ];

      const actions = compact<ChatMemoryPreviewAction>([
        disposition === 'TRIGGER_RESCUE'
          ? buildAction(
              'QUEUE_RESCUE',
              `${relationship.counterpartId}:rescue`,
              'Queue rescue posture',
              'trust graph recommends rescue',
              clamp01(score01 + 0.08),
              'HIGH',
              {
                channelId: state.activeVisibleChannel,
                counterpartId: relationship.counterpartId,
                privatePreferred: true,
                tags: ['relationship', 'rescue'],
              },
            )
          : null,
        disposition === 'ESCALATE_RIVAL'
          ? buildAction(
              'EMIT_PUBLIC_RECEIPT',
              `${relationship.counterpartId}:rivalry`,
              'Escalate rivalry',
              'trust graph recommends escalation',
              clamp01(score01 + 0.06),
              'HIGH',
              {
                channelId: state.activeVisibleChannel,
                counterpartId: relationship.counterpartId,
                tags: ['relationship', 'rivalry'],
              },
            )
          : null,
        trust01 >= 0.64
          ? buildAction(
              'PIN_COUNTERPART',
              `${relationship.counterpartId}:pin`,
              'Pin counterpart',
              'trust is strong enough for continuity',
              clamp01(score01 * 0.92),
              scoreToPriority(score01 * 0.92),
              {
                channelId: state.activeVisibleChannel,
                counterpartId: relationship.counterpartId,
                privatePreferred: true,
                tags: ['relationship', 'trust'],
              },
            )
          : null,
      ]);

      return {
        cardId: cardId('relationship', relationship.counterpartId),
        kind: 'RELATIONSHIP',
        priority: scoreToPriority(score01),
        channelId: state.activeVisibleChannel,
        counterpartId: relationship.counterpartId,
        title: this.relationshipTitle(relationship),
        subtitle: joinPhrases([
          relationship.counterpartKind,
          relationship.escalationTier,
          disposition ?? 'NO_DISPOSITION',
        ]),
        body: this.relationshipBody(relationship),
        hint: this.relationshipHint(relationship),
        score01,
        visibility: rivalry01 > trust01 ? 'PUBLIC' : 'PRIVATE',
        suppressibleBySilence: rivalry01 < trust01,
        canPromoteToAction: true,
        dismissalKey: `relationship:${relationship.counterpartId}`,
        createdAt: relationship.lastMeaningfulShiftAt,
        staleAt: (Number(now) + this.config.staleWindowMs) as UnixMs,
        messageIds: [],
        quoteIds: relationship.callbacksAvailable.map(String),
        callbackIds: [],
        evidence,
        actions,
        tags: uniqueStrings([
          'relationship',
          relationship.counterpartKind,
          relationship.escalationTier,
          disposition ?? 'NO_DISPOSITION',
        ]),
        raw: {
          relationshipId: relationship.relationshipId,
          vector: relationship.vector,
        },
      };
    });
  }

  // --------------------------------------------------------------------------
  // MARK: Card builders — scene
  // --------------------------------------------------------------------------

  private buildSceneCards(
    state: ChatEngineState,
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    const scene = state.activeScene;
    if (!scene) return [];

    const score01 = clamp01(
      Math.min(1, scene.beats.length / 5) * 0.32 +
        (scene.allowPlayerComposerDuringScene ? 0.12 : 0.22) +
        (scene.cancellableByAuthoritativeEvent ? 0.08 : 0.14) +
        this.config.sceneWeight01,
    );

    const evidence = [
      buildEvidence(
        'SCENE',
        `${scene.sceneId}:scene`,
        'Scene state',
        sceneSummary(scene),
        {
          score01,
          tags: ['scene', scene.momentType.toLowerCase()],
        },
      ),
      ...scene.beats.slice(0, 4).map((beat) =>
        buildEvidence(
          'SCENE',
          `${scene.sceneId}:${beat.beatIndex}`,
          `Beat ${beat.beatIndex + 1}`,
          joinPhrases([
            beat.actorId ?? 'unattributed',
            beat.requiredChannel,
            `${beat.delayMs}ms`,
          ]),
          {
            relatedMessageId: beat.relatedMessageId ?? null,
            score01: clamp01(score01 - beat.beatIndex * 0.03),
            tags: ['scene', 'beat'],
          },
        ),
      ),
    ];

    const actions = compact<ChatMemoryPreviewAction>([
      buildAction(
        'WAIT_FOR_SCENE_BEAT',
        `${scene.sceneId}:wait`,
        'Respect scene timing',
        'active scene already owns witness order',
        score01,
        scoreToPriority(score01),
        {
          channelId: state.activeVisibleChannel,
          sceneId: scene.sceneId,
          tags: ['scene'],
        },
      ),
      !scene.allowPlayerComposerDuringScene
        ? buildAction(
            'HOLD_FOR_SILENCE',
            `${scene.sceneId}:silence`,
            'Hold during scene',
            'composer is held while this scene resolves',
            clamp01(score01 * 0.94),
            'HIGH',
            {
              channelId: state.activeVisibleChannel,
              sceneId: scene.sceneId,
              privatePreferred: true,
              tags: ['scene', 'silence'],
            },
          )
        : null,
    ]);

    return [{
      cardId: cardId('scene', scene.sceneId),
      kind: 'SCENE',
      priority: scoreToPriority(score01),
      channelId: state.activeVisibleChannel,
      title: 'Scene memory is active',
      subtitle: joinPhrases([
        scene.momentType,
        `${scene.beats.length} beats`,
        scene.allowPlayerComposerDuringScene ? 'composer open' : 'composer held',
      ]),
      body: scene.beats
        .slice(0, 4)
        .map((beat) =>
          joinPhrases([
            `beat ${beat.beatIndex + 1}`,
            beat.actorId ?? 'no actor',
            beat.requiredChannel,
          ]),
        )
        .join(' · '),
      hint: 'Scene timing outranks generic callback urgency.',
      score01,
      visibility: state.activeVisibleChannel === 'DIRECT' ? 'PRIVATE' : 'MIXED',
      suppressibleBySilence: false,
      canPromoteToAction: true,
      dismissalKey: `scene:${scene.sceneId}`,
      createdAt: scene.startedAt,
      staleAt: (Number(now) + this.config.staleWindowMs) as UnixMs,
      messageIds: compact(scene.beats.map((beat) => beat.relatedMessageId ?? null)),
      quoteIds: [],
      callbackIds: [],
      evidence,
      actions,
      tags: ['scene', scene.momentType],
      raw: {
        sceneId: scene.sceneId,
        momentId: scene.momentId,
      },
    }];
  }

  // --------------------------------------------------------------------------
  // MARK: Card builders — silence
  // --------------------------------------------------------------------------

  private buildSilenceCards(
    state: ChatEngineState,
    trustRecommendations: TrustGraphRecommendations | undefined,
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    const silence = state.currentSilence;
    const graphSuggestsSilence =
      trustRecommendations?.globalDisposition === 'HOLD_SILENCE';

    if (!silence?.enforced && !graphSuggestsSilence) return [];

    const score01 = clamp01(
      (silence?.enforced ? 0.55 : 0.25) +
        (graphSuggestsSilence ? 0.2 : 0) +
        this.config.silenceWeight01,
    );

    return [{
      cardId: cardId('silence', `${silence?.reason ?? 'graph'}:${state.activeVisibleChannel}`),
      kind: 'SILENCE',
      priority: scoreToPriority(score01),
      channelId: state.activeVisibleChannel,
      title: 'Silence is a valid memory outcome',
      subtitle: joinPhrases([
        silence?.reason ?? 'GRAPH_RECOMMENDED',
        silence?.enforced ? `${silence.durationMs}ms` : 'advisory only',
      ]),
      body: silence?.breakConditions?.length
        ? `Break conditions: ${silence.breakConditions.join(', ')}`
        : 'No explicit break conditions were provided.',
      hint: 'Not every memory opportunity should become immediate text.',
      score01,
      visibility: 'MIXED',
      suppressibleBySilence: false,
      canPromoteToAction: true,
      dismissalKey: `silence:${state.activeVisibleChannel}`,
      createdAt: now,
      staleAt: (Number(now) + this.config.staleWindowMs) as UnixMs,
      messageIds: [],
      quoteIds: [],
      callbackIds: [],
      evidence: [
        buildEvidence(
          'DEBUG',
          `${state.activeVisibleChannel}:silence`,
          'Silence state',
          joinPhrases([
            `reason ${silence?.reason ?? 'GRAPH_RECOMMENDED'}`,
            silence?.enforced ? 'enforced' : 'advisory',
            `${silence?.breakConditions?.length ?? 0} break conditions`,
          ]),
          {
            score01,
            tags: ['silence'],
          },
        ),
      ],
      actions: [
        buildAction(
          'HOLD_FOR_SILENCE',
          `${state.activeVisibleChannel}:hold`,
          'Hold surface memory',
          'silence currently outranks immediate callback text',
          score01,
          scoreToPriority(score01),
          {
            channelId: state.activeVisibleChannel,
            privatePreferred: true,
            tags: ['silence'],
          },
        ),
      ],
      tags: ['silence'],
    }];
  }

  // --------------------------------------------------------------------------
  // MARK: Card builders — audience / witness
  // --------------------------------------------------------------------------

  private buildAudienceCards(
    state: ChatEngineState,
    orderedChannels: readonly ChatVisibleChannel[],
    trustSnapshot: TrustGraphSnapshot | undefined,
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    const cards: ChatMemoryPreviewCard[] = [];

    for (const channelId of orderedChannels) {
      const heat = state.audienceHeat[channelId];
      const score01 = clamp01(
        toScore01(heat.heat) * 0.26 +
          toScore01(heat.hype) * 0.22 +
          toScore01(heat.ridicule) * 0.24 +
          toScore01(heat.scrutiny) * 0.28 +
          this.config.audienceWeight01,
      );

      if (score01 < 0.46) continue;

      const channelProfile = trustSnapshot?.channels.find(
        (channel) => channel.channelId === channelId,
      );

      const evidence = compact<ChatMemoryPreviewEvidence>([
        buildEvidence(
          'AUDIENCE',
          `${channelId}:audience`,
          'Audience state',
          joinPhrases([
            `heat ${heat.heat}`,
            `hype ${heat.hype}`,
            `ridicule ${heat.ridicule}`,
            `scrutiny ${heat.scrutiny}`,
          ]),
          {
            score01,
            tags: ['audience', channelId.toLowerCase()],
          },
        ),
        channelProfile
          ? buildEvidence(
              'DEBUG',
              `${channelId}:graph`,
              'Trust graph channel profile',
              joinPhrases([
                `dominant counterpart ${channelProfile.dominantCounterpartId ?? 'none'}`,
                `signal pressure ${channelProfile.signalPressure01.toFixed(2)}`,
                `private viability ${channelProfile.privatePivotViability01.toFixed(2)}`,
              ]),
              {
                relatedCounterpartId: channelProfile.dominantCounterpartId ?? null,
                score01: channelProfile.signalPressure01,
                tags: ['audience', 'graph'],
              },
            )
          : null,
      ]);

      const actions = compact<ChatMemoryPreviewAction>([
        buildAction(
          'WAIT_FOR_SCENE_BEAT',
          `${channelId}:witness`,
          'Respect witness timing',
          `${channelId} is hot enough that timing matters`,
          score01,
          scoreToPriority(score01),
          {
            channelId,
            privatePreferred: channelId === 'DIRECT' || channelId === 'DEAL_ROOM',
            tags: ['witness', channelId.toLowerCase()],
          },
        ),
        toScore01(heat.ridicule) >= 0.62
          ? buildAction(
              'SHIFT_PRIVATE',
              `${channelId}:private`,
              'Shift private first',
              'ridicule pressure is high',
              clamp01(score01 * 0.92),
              'HIGH',
              {
                channelId,
                privatePreferred: true,
                tags: ['audience', 'ridicule'],
              },
            )
          : null,
      ]);

      cards.push({
        cardId: cardId('witness', channelId),
        kind: 'WITNESS',
        priority: scoreToPriority(score01),
        channelId,
        title: `${channelHeadline(channelId)} is live`,
        subtitle: joinPhrases([heatLabel(heat), `${heat.volatility} volatility`]),
        body: joinPhrases([
          `scrutiny ${heat.scrutiny}`,
          `ridicule ${heat.ridicule}`,
          `hype ${heat.hype}`,
        ]),
        hint: channelId === 'GLOBAL'
          ? 'The room will remember whatever survives the next public line.'
          : channelId === 'DEAL_ROOM'
            ? 'Quiet pressure is doing more work than noise.'
            : 'Witness pressure is shaping memory timing.',
        score01,
        visibility: channelId === 'DIRECT' ? 'PRIVATE' : 'PUBLIC',
        suppressibleBySilence: false,
        canPromoteToAction: true,
        dismissalKey: `witness:${channelId}`,
        createdAt: heat.lastUpdatedAt,
        staleAt: (Number(now) + this.config.staleWindowMs) as UnixMs,
        messageIds: [],
        quoteIds: [],
        callbackIds: [],
        evidence,
        actions,
        tags: ['witness', 'audience', channelId.toLowerCase()],
      });

      if (cards.length >= this.config.maxWitnessCards) break;
    }

    return cards;
  }

  // --------------------------------------------------------------------------
  // MARK: Card builders — affect
  // --------------------------------------------------------------------------

  private buildAffectCards(
    state: ChatEngineState,
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    const affect = state.affect;
    const score01 = clamp01(
      Math.max(
        toScore01(affect.vector.intimidation),
        toScore01(affect.vector.frustration),
        toScore01(affect.vector.embarrassment),
        toScore01(affect.vector.desperation),
        toScore01(affect.vector.dominance),
        toScore01(affect.vector.trust),
      ) + this.config.affectWeight01,
    );

    if (score01 < this.config.warningThreshold01) return [];

    const dominant = affect.dominantEmotion;
    const actions = compact<ChatMemoryPreviewAction>([
      dominant === 'EMBARRASSMENT' || dominant === 'DESPERATION'
        ? buildAction(
            'SHIFT_PRIVATE',
            `${dominant}:private`,
            'Move private first',
            `dominant emotion is ${dominant.toLowerCase()}`,
            score01,
            'HIGH',
            {
              channelId: state.activeVisibleChannel,
              privatePreferred: true,
              tags: ['affect', dominant.toLowerCase()],
            },
          )
        : null,
      dominant === 'DOMINANCE' || dominant === 'CONFIDENCE'
        ? buildAction(
            'EMIT_PUBLIC_RECEIPT',
            `${dominant}:public`,
            'Allow public witness',
            `dominant emotion is ${dominant.toLowerCase()}`,
            clamp01(score01 * 0.94),
            scoreToPriority(score01),
            {
              channelId: state.activeVisibleChannel,
              tags: ['affect', dominant.toLowerCase(), 'public'],
            },
          )
        : null,
    ]);

    return [{
      cardId: cardId('affect', dominant),
      kind: 'AFFECT',
      priority: scoreToPriority(score01),
      channelId: state.activeVisibleChannel,
      title: `${dominant} is shaping memory timing`,
      subtitle: joinPhrases([
        `confidence swing ${affect.confidenceSwingDelta.toFixed(2)}`,
        dominantRiskLabel(undefined, affect),
      ]),
      body: joinPhrases([
        `intimidation ${affect.vector.intimidation}`,
        `frustration ${affect.vector.frustration}`,
        `embarrassment ${affect.vector.embarrassment}`,
        `desperation ${affect.vector.desperation}`,
        `trust ${affect.vector.trust}`,
      ]),
      hint: 'Affect changes whether a receipt should sting, rescue, or wait.',
      score01,
      visibility: dominant === 'EMBARRASSMENT' ? 'PRIVATE' : 'MIXED',
      suppressibleBySilence: dominant !== 'DOMINANCE',
      canPromoteToAction: true,
      dismissalKey: `affect:${dominant}`,
      createdAt: affect.lastUpdatedAt,
      staleAt: (Number(now) + this.config.staleWindowMs) as UnixMs,
      messageIds: [],
      quoteIds: [],
      callbackIds: [],
      evidence: [
        buildEvidence(
          'AFFECT',
          `${dominant}:affect`,
          'Dominant affect',
          joinPhrases([
            `dominant ${dominant}`,
            `swing ${affect.confidenceSwingDelta.toFixed(2)}`,
          ]),
          {
            score01,
            tags: ['affect', dominant.toLowerCase()],
          },
        ),
      ],
      actions,
      tags: ['affect', dominant.toLowerCase()],
    }];
  }

  // --------------------------------------------------------------------------
  // MARK: Card builders — continuity and summary
  // --------------------------------------------------------------------------

  private buildContinuityCards(
    state: ChatEngineState,
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    const continuity = state.continuity;
    const unresolved = continuity.unresolvedMomentIds.length;
    const carried = continuity.carriedPersonaIds.length;
    const score01 = clamp01(
      Math.min(1, unresolved / 3) * 0.45 +
        Math.min(1, carried / 4) * 0.25 +
        (continuity.carryoverSummary ? 0.22 : 0) +
        (continuity.activeSceneId ? 0.08 : 0) +
        this.config.continuityWeight01,
    );

    if (score01 < 0.32) return [];

    return [{
      cardId: cardId('continuity', continuity.activeSceneId ?? continuity.lastMountTarget ?? 'continuity'),
      kind: 'CONTINUITY',
      priority: scoreToPriority(score01),
      channelId: state.activeVisibleChannel,
      title: 'Carryover memory is still active',
      subtitle: continuitySummary(continuity),
      body: continuity.carryoverSummary
        ? summarizeText(continuity.carryoverSummary, 184)
        : 'The system is carrying forward prior tension even without a textual summary.',
      hint: 'Continuity should shape witness order before new theatrics are added.',
      score01,
      visibility: 'MIXED',
      suppressibleBySilence: true,
      canPromoteToAction: true,
      dismissalKey: `continuity:${continuity.activeSceneId ?? continuity.lastMountTarget ?? 'base'}`,
      createdAt: now,
      staleAt: (Number(now) + this.config.staleWindowMs) as UnixMs,
      messageIds: [],
      quoteIds: [],
      callbackIds: [],
      evidence: [
        buildEvidence(
          'CONTINUITY',
          `${continuity.activeSceneId ?? 'none'}:continuity`,
          'Continuity state',
          continuitySummary(continuity),
          {
            score01,
            tags: ['continuity'],
          },
        ),
      ],
      actions: compact([
        unresolved > 0
          ? buildAction(
              'PIN_COUNTERPART',
              `continuity:unresolved`,
              'Resolve unresolved thread',
              `${unresolved} unresolved moment(s) are still open`,
              clamp01(score01 * 0.9),
              scoreToPriority(score01 * 0.9),
              {
                channelId: state.activeVisibleChannel,
                privatePreferred: true,
                tags: ['continuity', 'unresolved'],
              },
            )
          : null,
      ]),
      tags: ['continuity'],
    }];
  }

  private buildSummaryCards(
    state: ChatEngineState,
    dominantRelationship: ChatRelationshipState | undefined,
    allMessages: readonly ChatMessage[],
    quoteSnapshot: QuoteRecallSnapshot,
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    const latest = newestMessage(allMessages);
    const score01 = clamp01(
      (latest ? 0.22 : 0) +
        (dominantRelationship ? 0.28 : 0) +
        Math.min(0.25, quoteSnapshot.totalQuotes / 24) +
        (state.activeScene ? 0.18 : 0),
    );

    if (score01 < 0.3) return [];

    return [{
      cardId: cardId('summary', state.activeVisibleChannel),
      kind: 'SUMMARY',
      priority: scoreToPriority(score01),
      channelId: state.activeVisibleChannel,
      counterpartId: dominantRelationship?.counterpartId ?? null,
      title: 'Memory preview summary',
      subtitle: joinPhrases([
        latest ? `latest ${latest.kind.toLowerCase()}` : 'no recent message',
        dominantRelationship ? `counterpart ${dominantRelationship.counterpartId}` : 'no dominant counterpart',
        `${quoteSnapshot.totalQuotes} indexed quotes`,
      ]),
      body: joinPhrases([
        latest ? summarizeText(latest.body, 70) : 'no latest message',
        dominantRelationship ? this.relationshipBody(dominantRelationship) : 'no dominant relationship',
        state.activeScene ? sceneSummary(state.activeScene) : 'no active scene',
      ]),
      hint: 'Use this card when UI needs one stable read before drilling deeper.',
      score01,
      visibility: previewVisibility(undefined, state.activeVisibleChannel),
      suppressibleBySilence: true,
      canPromoteToAction: false,
      dismissalKey: `summary:${state.activeVisibleChannel}`,
      createdAt: latest?.ts ? (latest.ts as UnixMs) : now,
      staleAt: (Number(now) + this.config.staleWindowMs) as UnixMs,
      messageIds: latest ? [latest.id] : [],
      quoteIds: [],
      callbackIds: [],
      evidence: compact([
        latest
          ? buildEvidence(
              'MESSAGE',
              `${latest.id}:summary`,
              'Latest message',
              summarizeText(latest.body, 92),
              {
                relatedMessageId: latest.id,
                proofHash: latest.proofHash ?? latest.proof?.proofHash ?? null,
                tags: ['summary', latest.kind.toLowerCase()],
              },
            )
          : null,
      ]),
      actions: [],
      tags: ['summary'],
    }];
  }

  private buildDebugCards(
    state: ChatEngineState,
    callbackRecords: readonly ChatCallbackRecord[],
    callbackPlans: readonly ChatCallbackPlan[],
    quoteSnapshot: QuoteRecallSnapshot,
    trustSnapshot: TrustGraphSnapshot | undefined,
    trustRecommendations: TrustGraphRecommendations | undefined,
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    return [{
      cardId: cardId('debug', state.activeVisibleChannel),
      kind: 'DEBUG',
      priority: 'LOW',
      channelId: state.activeVisibleChannel,
      title: 'Memory preview diagnostics',
      subtitle: joinPhrases([
        `${callbackRecords.length} callback(s)`,
        `${callbackPlans.length} plan(s)`,
        `${quoteSnapshot.totalQuotes} quote(s)`,
      ]),
      body: joinPhrases([
        trustSnapshot
          ? `${trustSnapshot.hotCounterparts.length} hot counterpart(s)`
          : 'no trust snapshot',
        trustRecommendations
          ? `${trustRecommendations.globalDisposition} global disposition`
          : 'no trust recommendations',
      ]),
      score01: 0.21,
      visibility: 'PRIVATE',
      suppressibleBySilence: true,
      canPromoteToAction: false,
      dismissalKey: `debug:${state.activeVisibleChannel}`,
      createdAt: now,
      staleAt: (Number(now) + this.config.staleWindowMs) as UnixMs,
      messageIds: [],
      quoteIds: [],
      callbackIds: callbackRecords.map((record) => record.callbackId),
      evidence: [
        buildEvidence(
          'DEBUG',
          `${state.activeVisibleChannel}:debug`,
          'Debug summary',
          joinPhrases([
            `${callbackRecords.length} callbacks`,
            `${callbackPlans.length} plans`,
            `${quoteSnapshot.totalQuotes} quotes`,
          ]),
          {
            score01: 0.21,
            tags: ['debug'],
          },
        ),
      ],
      actions: [],
      tags: ['debug'],
    }];
  }

  // --------------------------------------------------------------------------
  // MARK: Headline, panels, actions, evidence
  // --------------------------------------------------------------------------

  private buildHeadline(
    state: ChatEngineState,
    cards: readonly ChatMemoryPreviewCard[],
    relationship: ChatRelationshipState | undefined,
    trustRecommendations: TrustGraphRecommendations | undefined,
  ): string {
    const top = cards[0];
    if (trustRecommendations?.globalDisposition === 'HOLD_SILENCE') {
      return 'Memory wants to wait before it speaks.';
    }
    if (top?.kind === 'CALLBACK') {
      return 'Memory already has a selected callback path.';
    }
    if (top?.kind === 'QUOTE') {
      return 'A quote-worthy receipt is near the top of the stack.';
    }
    if (relationship && Number(relationship.vector.rivalryIntensity) > Number(relationship.vector.trust)) {
      return `${relationship.counterpartId} is pulling memory toward rivalry.`;
    }
    if (state.activeScene) {
      return 'Scene timing is outranking generic memory output.';
    }
    return 'Memory preview is stable and ready.';
  }

  private buildSummaryLines(
    state: ChatEngineState,
    cards: readonly ChatMemoryPreviewCard[],
    callbackRecords: readonly ChatCallbackRecord[],
    quoteSnapshot: QuoteRecallSnapshot,
    trustRecommendations: TrustGraphRecommendations | undefined,
  ): readonly ChatMemoryPreviewSummaryLine[] {
    const out: ChatMemoryPreviewSummaryLine[] = [];

    if (cards[0]) {
      out.push({
        summaryId: `top:${cards[0].cardId}`,
        priority: cards[0].priority,
        text: `${cards[0].title}. ${trimText(cards[0].body, 110)}`,
        tags: cards[0].tags,
      });
    }

    if (callbackRecords[0]) {
      out.push({
        summaryId: `callback:${callbackRecords[0].callbackId}`,
        priority: scoreToPriority(callbackRecords[0].selectedCandidate.score01),
        text: `Selected callback ${callbackRecords[0].selectedCandidate.callbackKind.toLowerCase().replace(/_/g, ' ')} is ${
          callbackRecords[0].selectedCandidate.privacyClass.toLowerCase()
        } and ${callbackRecords[0].lifecycleState.toLowerCase()}.`,
        tags: ['callback'],
      });
    }

    if (quoteSnapshot.signatureQuoteIds[0]) {
      out.push({
        summaryId: `quote:${quoteSnapshot.signatureQuoteIds[0]}`,
        priority: 'NORMAL',
        text: `${quoteSnapshot.totalQuotes} quote(s) are indexed; signature quote memory is available.`,
        tags: ['quote'],
      });
    }

    if (trustRecommendations?.globalDisposition) {
      out.push({
        summaryId: `graph:${trustRecommendations.globalDisposition}`,
        priority: trustRecommendations.globalDisposition === 'HOLD_SILENCE' ? 'HIGH' : 'NORMAL',
        text: `Trust graph global disposition: ${trustRecommendations.globalDisposition.toLowerCase().replace(/_/g, ' ')}.`,
        tags: ['graph'],
      });
    }

    if (state.currentSilence?.enforced) {
      out.push({
        summaryId: 'silence:enforced',
        priority: 'HIGH',
        text: `Silence is enforced for ${state.currentSilence.durationMs}ms because ${state.currentSilence.reason.toLowerCase()}.`,
        tags: ['silence'],
      });
    }

    return out.slice(0, this.config.maxSummaries);
  }

  private buildChannelPanel(
    channelId: ChatVisibleChannel,
    cards: readonly ChatMemoryPreviewCard[],
    state: ChatEngineState,
  ): ChatMemoryPreviewChannelPanel {
    const filtered = cards
      .filter((card) => (card.channelId ?? channelId) === channelId)
      .slice(0, this.config.maxCardsPerChannel);

    const relationship = relationshipsByHotness(state).find(
      (candidate) => candidate.counterpartId === filtered[0]?.counterpartId,
    ) ?? relationshipsByHotness(state)[0];

    const actions = filtered
      .flatMap((card) => card.actions)
      .sort((a, b) => b.score01 - a.score01)
      .slice(0, 6);

    return {
      channelId,
      headline: channelHeadline(channelId),
      summary: filtered[0]
        ? `${filtered[0].title}: ${trimText(filtered[0].body, 88)}`
        : 'No active memory pressure in this channel.',
      heatLabel: heatLabel(state.audienceHeat[channelId]),
      riskLabel: dominantRiskLabel(relationship, state.affect),
      cards: filtered,
      actions,
      dominantCounterpartId: relationship?.counterpartId,
      silentRecommended: this.shouldRecommendSilence(
        { ...state, activeVisibleChannel: channelId },
        filtered,
        undefined,
      ),
    };
  }

  private buildActionRail(
    cards: readonly ChatMemoryPreviewCard[],
    state: ChatEngineState,
    trustRecommendations: TrustGraphRecommendations | undefined,
  ): readonly ChatMemoryPreviewAction[] {
    const actions = cards.flatMap((card) => card.actions).sort((a, b) => b.score01 - a.score01);

    if (
      trustRecommendations?.globalDisposition === 'HOLD_SILENCE' &&
      !actions.some((action) => action.kind === 'HOLD_FOR_SILENCE')
    ) {
      actions.unshift(
        buildAction(
          'HOLD_FOR_SILENCE',
          `global:${state.activeVisibleChannel}:silence`,
          'Prefer silence',
          'trust graph recommends holding memory output',
          0.88,
          'HIGH',
          {
            channelId: state.activeVisibleChannel,
            privatePreferred: true,
            tags: ['graph', 'silence'],
          },
        ),
      );
    }

    if (
      trustRecommendations?.globalDisposition === 'TRIGGER_RESCUE' &&
      !actions.some((action) => action.kind === 'QUEUE_RESCUE')
    ) {
      actions.unshift(
        buildAction(
          'QUEUE_RESCUE',
          `global:${state.activeVisibleChannel}:rescue`,
          'Queue rescue surface',
          'trust graph recommends rescue pressure over public theater',
          0.86,
          'HIGH',
          {
            channelId: state.activeVisibleChannel,
            privatePreferred: true,
            tags: ['graph', 'rescue'],
          },
        ),
      );
    }

    const unique = new Map<string, ChatMemoryPreviewAction>();
    for (const action of actions) {
      if (!unique.has(action.actionId)) unique.set(action.actionId, action);
    }

    return [...unique.values()].slice(0, this.config.maxActionsTotal);
  }

  private buildEvidenceLedger(
    cards: readonly ChatMemoryPreviewCard[],
  ): readonly ChatMemoryPreviewEvidence[] {
    const out: ChatMemoryPreviewEvidence[] = [];
    const seen = new Set<string>();

    for (const card of cards) {
      for (const evidence of card.evidence) {
        if (seen.has(evidence.evidenceId)) continue;
        seen.add(evidence.evidenceId);
        out.push(evidence);
        if (out.length >= this.config.maxEvidenceTotal) return out;
      }
    }

    return out;
  }

  private shouldRecommendSilence(
    state: ChatEngineState,
    cards: readonly ChatMemoryPreviewCard[],
    trustRecommendations: TrustGraphRecommendations | undefined,
  ): boolean {
    if (state.currentSilence?.enforced) return true;
    if (trustRecommendations?.globalDisposition === 'HOLD_SILENCE') return true;
    const top = cards[0];
    if (!top) return false;
    return top.kind === 'SCENE' || top.kind === 'SILENCE';
  }

  private countCardsByKind(
    cards: readonly ChatMemoryPreviewCard[],
  ): Readonly<Record<string, number>> {
    const counts: Record<string, number> = createCountSeed(
      CHAT_MEMORY_PREVIEW_CARD_KINDS,
    ) as Record<string, number>;
    for (const card of cards) {
      counts[card.kind] = (counts[card.kind] ?? 0) + 1;
    }
    return counts;
  }

  // --------------------------------------------------------------------------
  // MARK: Filtering
  // --------------------------------------------------------------------------

  private filterCards(
    cards: readonly ChatMemoryPreviewCard[],
    includeDismissed: boolean,
    now: UnixMs,
  ): readonly ChatMemoryPreviewCard[] {
    const out: ChatMemoryPreviewCard[] = [];

    for (const card of cards) {
      const dismissalUntil = this.dismissedUntilByKey.get(card.dismissalKey);
      const isDismissed =
        dismissalUntil != null && Number(dismissalUntil) > Number(now);

      if (!includeDismissed && this.config.autoSuppressDismissed && isDismissed) {
        this.bumpDropReason('dismissed');
        continue;
      }
      if (Number(card.staleAt) <= Number(now)) {
        this.bumpDropReason('stale');
        continue;
      }
      if (!String(card.body).trim()) {
        this.bumpDropReason('empty-body');
        continue;
      }

      out.push(card);
    }

    return out;
  }

  private bumpDropReason(reason: string): void {
    this.droppedCardReasons.set(
      reason,
      (this.droppedCardReasons.get(reason) ?? 0) + 1,
    );
  }

  // --------------------------------------------------------------------------
  // MARK: Query builders
  // --------------------------------------------------------------------------

  private quoteQuery(
    state: ChatEngineState,
    channelId: ChatVisibleChannel,
  ): QuoteRecallSelectionQuery {
    const relationship = relationshipsByHotness(state).find((candidate) => {
      if (channelId === 'DIRECT') {
        return Number(candidate.vector.trust) >= Number(candidate.vector.rivalryIntensity);
      }
      if (channelId === 'DEAL_ROOM') {
        return candidate.counterpartKind === 'NPC' || candidate.counterpartKind === 'HELPER';
      }
      return true;
    });

    const useIntent: ChatQuoteUseIntent =
      channelId === 'DEAL_ROOM'
        ? 'NEGOTIATION'
        : relationship && Number(relationship.vector.rivalryIntensity) >= Number(relationship.vector.trust)
          ? 'CALLBACK'
          : 'REMINDER';

    return {
      channelId,
      counterpartId: relationship?.counterpartId ?? null,
      pressureTier: state.messagesByChannel[channelId][0]?.pressureTier ?? null,
      useIntent,
      privacyClass: channelId === 'DIRECT' ? 'PRIVATE' : null,
      limit: 6,
    };
  }

  // --------------------------------------------------------------------------
  // MARK: Text builders
  // --------------------------------------------------------------------------

  private callbackTitle(record: ChatCallbackRecord): string {
    const kind = record.selectedCandidate.callbackKind.toLowerCase().replace(/_/g, ' ');
    const target =
      record.context.counterpartId ??
      record.context.targetActorId ??
      'memory target';
    return `${kind} preview for ${target}`;
  }

  private callbackBody(record: ChatCallbackRecord): string {
    const quoteText = record.selectedCandidate.quoteJoin?.primaryQuote?.text;
    const lines = compact([
      quoteText ? `Quote: ${summarizeText(quoteText, 92)}` : null,
      record.selectedCandidate.explanation[0] ?? null,
      record.executedPlan
        ? `${record.executedPlan.beats.length} beat plan is attached.`
        : null,
    ]);
    return lines.length
      ? lines.join(' ')
      : 'Callback record is selected but no authored line has been emitted yet.';
  }

  private callbackHint(record: ChatCallbackRecord): string {
    if (record.executedPlan && record.executedPlan.beats.length > 1) {
      return `Plan has ${record.executedPlan.beats.length} beat(s); scene timing may still change the final reveal.`;
    }
    if (callbackSuppressionReason(record) !== 'NONE') {
      return `Suppression reason: ${callbackSuppressionReason(record).toLowerCase().replace(/_/g, ' ')}.`;
    }
    return 'This is a preview of memory pressure, not final dialogue.';
  }

  private quoteHint(
    record: QuoteRecallIndexRecord,
    selection: ChatQuoteSelectionCandidate | undefined,
  ): string {
    if (selection) {
      return `Selected as ${selection.intent.toLowerCase()} with ${selection.score01.toFixed(2)} confidence.`;
    }
    if (record.callbackEligibility === 'ELIGIBLE') {
      return 'Quote is callback-eligible even if it is not the top selected candidate.';
    }
    return `Quote eligibility is ${record.callbackEligibility.toLowerCase()}.`;
  }

  private relationshipTitle(relationship: ChatRelationshipState): string {
    if (Number(relationship.vector.rivalryIntensity) >= Number(relationship.vector.trust)) {
      return `${relationship.counterpartId} is becoming a memory-level rival`;
    }
    if (Number(relationship.vector.trust) >= 66) {
      return `${relationship.counterpartId} is viable for trusted continuity`;
    }
    if (Number(relationship.vector.rescueDebt) >= 60) {
      return `${relationship.counterpartId} carries rescue debt`;
    }
    return `${relationship.counterpartId} is still shaping the memory lane`;
  }

  private relationshipBody(relationship: ChatRelationshipState): string {
    return joinPhrases([
      `trust ${relationship.vector.trust}`,
      `rivalry ${relationship.vector.rivalryIntensity}`,
      `fear ${relationship.vector.fear}`,
      `respect ${relationship.vector.respect}`,
      `rescue debt ${relationship.vector.rescueDebt}`,
      `advice obedience ${relationship.vector.adviceObedience}`,
    ]);
  }

  private relationshipHint(relationship: ChatRelationshipState): string {
    if (relationship.escalationTier === 'OBSESSIVE') {
      return 'This counterpart is strong enough to justify persistent callbacks and authored escalation.';
    }
    if (relationship.callbacksAvailable.length > 0) {
      return `${relationship.callbacksAvailable.length} callback-linked quote(s) are already available.`;
    }
    return 'Relationship intensity is rising even before callback quotes are selected.';
  }
}

// ============================================================================
// MARK: Standalone helpers
// ============================================================================

export function buildChatMemoryPreview(
  state: ChatEngineState,
  options: {
    readonly config?: Partial<ChatMemoryPreviewConfig>;
    readonly callbackMemory?: CallbackMemory;
    readonly quoteRecallIndex?: QuoteRecallIndex;
    readonly build?: BuildChatMemoryPreviewOptions;
  } = {},
): ChatMemoryPreviewSnapshot {
  const preview = new ChatMemoryPreview({
    config: options.config,
    callbackMemory: options.callbackMemory,
    quoteRecallIndex: options.quoteRecallIndex,
  });
  return preview.build(state, options.build);
}

export function buildChatMemoryPreviewEngine(
  options: {
    readonly config?: Partial<ChatMemoryPreviewConfig>;
    readonly callbackMemory?: CallbackMemory;
    readonly quoteRecallIndex?: QuoteRecallIndex;
  } = {},
): ChatMemoryPreview {
  return new ChatMemoryPreview(options);
}

export function buildPreviewEvidenceLedger(
  snapshot: ChatMemoryPreviewSnapshot,
): readonly ChatMemoryPreviewEvidence[] {
  return snapshot.evidenceLedger;
}

export function selectPreviewCardsForChannel(
  snapshot: ChatMemoryPreviewSnapshot,
  channelId: ChatVisibleChannel,
): readonly ChatMemoryPreviewCard[] {
  const panel = snapshot.channelPanels.find((candidate) => candidate.channelId === channelId);
  return panel?.cards ?? [];
}

export function selectTopPreviewCard(
  snapshot: ChatMemoryPreviewSnapshot,
): ChatMemoryPreviewCard | undefined {
  return snapshot.activeCards[0];
}

export function selectPreviewActionsByPriority(
  snapshot: ChatMemoryPreviewSnapshot,
  priority: ChatMemoryPreviewPriority,
): readonly ChatMemoryPreviewAction[] {
  return snapshot.actionRail.filter((action) => action.priority === priority);
}

export function previewSnapshotToJson(
  snapshot: ChatMemoryPreviewSnapshot,
): JsonObject {
  return {
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    mountTarget: snapshot.mountTarget,
    activeVisibleChannel: snapshot.activeVisibleChannel,
    headline: snapshot.headline,
    silentRecommended: snapshot.silentRecommended,
    hotCounterpartIds: [...snapshot.hotCounterpartIds],
    summaryCount: snapshot.summaries.length,
    cardCount: snapshot.activeCards.length,
    actionCount: snapshot.actionRail.length,
    evidenceCount: snapshot.evidenceLedger.length,
  };
}

export function describePreviewSnapshot(
  snapshot: ChatMemoryPreviewSnapshot,
): string {
  const top = snapshot.activeCards[0];
  const activePanel = snapshot.channelPanels.find(
    (panel) => panel.channelId === snapshot.activeVisibleChannel,
  );
  return joinPhrases([
    snapshot.headline,
    top ? `${top.kind.toLowerCase()} top card` : 'no top card',
    activePanel ? activePanel.summary : 'no channel summary',
    snapshot.silentRecommended ? 'silence recommended' : 'speech permissible',
  ]);
}

export function createPreviewCardCountSeed(): Readonly<Record<ChatMemoryPreviewCardKind, number>> {
  return Object.freeze(
    Object.fromEntries(
      CHAT_MEMORY_PREVIEW_CARD_KINDS.map((kind) => [kind, 0]),
    ) as Record<ChatMemoryPreviewCardKind, number>,
  );
}

export function countPreviewCardsByKind(
  cards: readonly ChatMemoryPreviewCard[],
): Readonly<Record<ChatMemoryPreviewCardKind, number>> {
  const seed = {
    ...createPreviewCardCountSeed(),
  } as Record<ChatMemoryPreviewCardKind, number>;
  for (const card of cards) {
    seed[card.kind] = (seed[card.kind] ?? 0) + 1;
  }
  return seed;
}

export function previewCardPrimaryAction(
  card: ChatMemoryPreviewCard,
): ChatMemoryPreviewAction | undefined {
  return [...card.actions].sort((a, b) => b.score01 - a.score01)[0];
}

export function previewCardSupportsPrivatePivot(
  card: ChatMemoryPreviewCard,
): boolean {
  return card.visibility !== 'PUBLIC' ||
    card.actions.some((action) => action.kind === 'SHIFT_PRIVATE');
}

export function previewCardSupportsPublicReceipt(
  card: ChatMemoryPreviewCard,
): boolean {
  return card.visibility !== 'PRIVATE' ||
    card.actions.some((action) => action.kind === 'EMIT_PUBLIC_RECEIPT');
}

export function isPreviewCardStale(
  card: ChatMemoryPreviewCard,
  now: UnixMs = nowMs(),
): boolean {
  return Number(card.staleAt) <= Number(now);
}
