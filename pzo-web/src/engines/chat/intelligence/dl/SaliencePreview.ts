// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/intelligence/dl/SaliencePreview.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT DL SALIENCE PREVIEW
 * FILE: pzo-web/src/engines/chat/intelligence/dl/SaliencePreview.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * UI-safe, planner-safe preview material for the retrieval-backed continuity
 * lane.
 *
 * The retrieval client returns ranked memory artifacts. This module translates
 * those ranked artifacts into compact preview structures that higher surfaces
 * can consume without needing to understand the full embedding / anchor
 * contract estate.
 *
 * In practice this lets the frontend:
 * - explain why a callback surfaced,
 * - show the strongest remembered pressure lines,
 * - bias helper or hater follow-up timing,
 * - preview social residue before a scene is realized,
 * - keep retrieval visible to debug, QA, replay, and dramaturgy lanes.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import type { Score01, UnixMs } from '../../types';

import {
  summarizeEmbeddingMatch,
  type ConversationEmbeddingDocument,
  type EmbeddingPreview,
  type EmbeddingSearchMatch,
} from '../../../../../../shared/contracts/chat/learning/ConversationEmbeddings';

import {
  summarizeMemoryAnchor,
  summarizeMemoryAnchorMatch,
  type MemoryAnchor,
  type MemoryAnchorMatch,
  type MemoryAnchorPreview,
} from '../../../../../../shared/contracts/chat/learning/MemoryAnchors';

import type {
  ChatMemoryRetrievalReason,
  ChatMemoryRetrievalResult,
} from './MemoryRetrievalClient';

/* ========================================================================== */
/* MARK: Module constants                                                     */
/* ========================================================================== */

export const CHAT_SALIENCE_PREVIEW_MODULE_NAME =
  'PZO_CHAT_SALIENCE_PREVIEW' as const;

export const CHAT_SALIENCE_PREVIEW_VERSION =
  '2026.03.20-salience-preview.v1' as const;

export const CHAT_SALIENCE_PREVIEW_RUNTIME_LAWS = Object.freeze([
  'Preview must stay UI-safe and deterministic.',
  'Explain the retrieval outcome without leaking transport or backend truth assumptions.',
  'The strongest preview card should correspond to real ranked evidence.',
  'Anchor and document residue should be visible as different kinds of memory.',
  'Pressure, rescue, comeback, and humiliation should read as different preview moods.',
  'Preview should help scene planners choose timing, not just show debug numbers.',
] as const);

export const CHAT_SALIENCE_PREVIEW_DEFAULTS = Object.freeze({
  maxCards: 8,
  maxTagsPerCard: 8,
  maxReasonsPerCard: 5,
  maxHeadlineChars: 96,
  maxSummaryChars: 180,
  maxNotes: 12,
  callbackThreshold01: 0.58,
  witnessThreshold01: 0.62,
  silenceThreshold01: 0.54,
} as const);

/* ========================================================================== */
/* MARK: Public contracts                                                     */
/* ========================================================================== */

export type ChatSalienceBand =
  | 'LOW'
  | 'RISING'
  | 'HOT'
  | 'CRITICAL'
  | 'LEGENDARY';

export type ChatSalienceCardKind = 'ANCHOR' | 'DOCUMENT' | 'HYBRID';

export interface ChatSaliencePreviewCard {
  readonly id: string;
  readonly kind: ChatSalienceCardKind;
  readonly band: ChatSalienceBand;
  readonly score01: Score01;
  readonly title: string;
  readonly subtitle: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly reasons: readonly string[];
  readonly callbackEligible: boolean;
  readonly witnessHeavy: boolean;
  readonly silencePreferred: boolean;
}

export interface ChatSalienceRecommendation {
  readonly preferCallback: boolean;
  readonly preferWitnessLine: boolean;
  readonly preferSilenceBeat: boolean;
  readonly preferHelperEntry: boolean;
  readonly preferHaterEntry: boolean;
  readonly dominantResidue: 'HELPER' | 'HATER' | 'CROWD' | 'SYSTEM' | 'MIXED';
}

export interface ChatSaliencePreviewOutput {
  readonly createdAtMs: UnixMs;
  readonly requestId: string;
  readonly reason: ChatMemoryRetrievalReason;
  readonly cards: readonly ChatSaliencePreviewCard[];
  readonly headline: string;
  readonly subheadline: string;
  readonly recommendation: ChatSalienceRecommendation;
  readonly anchorPreviews: readonly MemoryAnchorPreview[];
  readonly documentPreviews: readonly EmbeddingPreview[];
  readonly debugNotes: readonly string[];
}

export interface ChatSaliencePreviewOptions {
  readonly defaults?: Partial<typeof CHAT_SALIENCE_PREVIEW_DEFAULTS>;
}

/* ========================================================================== */
/* MARK: Utility helpers                                                      */
/* ========================================================================== */

function clamp01(value: number): Score01 {
  if (!Number.isFinite(value)) return 0 as Score01;
  if (value <= 0) return 0 as Score01;
  if (value >= 1) return 1 as Score01;
  return Number(value.toFixed(6)) as Score01;
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

function uniqueStrings(values: readonly (string | null | undefined)[]): readonly string[] {
  return Object.freeze(
    Array.from(
      new Set(
        values
          .map((value) => (value ?? '').trim())
          .filter(Boolean),
      ),
    ),
  );
}

function bandFromScore(score01: number): ChatSalienceBand {
  if (score01 >= 0.86) return 'LEGENDARY';
  if (score01 >= 0.72) return 'CRITICAL';
  if (score01 >= 0.56) return 'HOT';
  if (score01 >= 0.36) return 'RISING';
  return 'LOW';
}

function dominantResidueFromCards(
  cards: readonly ChatSaliencePreviewCard[],
): ChatSalienceRecommendation['dominantResidue'] {
  const joined = cards
    .slice(0, 3)
    .map((value) => `${value.title} ${value.summary} ${value.tags.join(' ')}`.toLowerCase())
    .join(' ');
  let helper = 0;
  let hater = 0;
  let crowd = 0;
  let system = 0;
  if (joined.includes('helper')) helper += 2;
  if (joined.includes('rescue')) helper += 2;
  if (joined.includes('hater') || joined.includes('rival')) hater += 2;
  if (joined.includes('humiliat') || joined.includes('taunt')) hater += 1;
  if (joined.includes('crowd') || joined.includes('public')) crowd += 2;
  if (joined.includes('witness')) crowd += 1;
  if (joined.includes('system')) system += 2;
  const buckets = [
    ['HELPER', helper],
    ['HATER', hater],
    ['CROWD', crowd],
    ['SYSTEM', system],
  ] as const;
  const sorted = [...buckets].sort((left, right) => right[1] - left[1]);
  if (sorted[0][1] === sorted[1][1]) return 'MIXED';
  return sorted[0][0];
}

function createCardFromAnchor(
  anchor: MemoryAnchor,
  match: MemoryAnchorMatch,
  defaults: typeof CHAT_SALIENCE_PREVIEW_DEFAULTS,
): ChatSaliencePreviewCard {
  const tags = uniqueStrings([
    ...anchor.payload.tags,
    ...anchor.payload.emotions,
    ...anchor.payload.relationshipTags,
  ]).slice(0, defaults.maxTagsPerCard);
  const reasons = uniqueStrings([
    `salience ${anchor.salience.final.toFixed(2)}`,
    `priority ${anchor.retrieval.priority}`,
    anchor.continuity.unresolved ? 'unresolved continuity' : null,
    anchor.relationshipRefs.length ? 'relationship-linked' : null,
    anchor.quoteRefs.length ? 'quote-linked' : null,
    ...match.matchedTags,
  ]).slice(0, defaults.maxReasonsPerCard);
  const score01 = clamp01((anchor.salience.final * 0.55) + (match.retrievalScore * 0.45));
  return Object.freeze({
    id: `anchor:${anchor.id}`,
    kind: 'ANCHOR',
    band: bandFromScore(score01),
    score01,
    title: truncate(anchor.payload.headline, defaults.maxHeadlineChars),
    subtitle: `${anchor.kind} • ${anchor.retrieval.priority}`,
    summary: truncate(anchor.payload.summary, defaults.maxSummaryChars),
    tags,
    reasons,
    callbackEligible: score01 >= defaults.callbackThreshold01,
    witnessHeavy: tags.includes('public') || tags.includes('crowd'),
    silencePreferred:
      anchor.continuity.unresolved &&
      score01 >= defaults.silenceThreshold01 &&
      !tags.includes('helper'),
  });
}

function createCardFromDocument(
  document: ConversationEmbeddingDocument,
  match: EmbeddingSearchMatch,
  defaults: typeof CHAT_SALIENCE_PREVIEW_DEFAULTS,
): ChatSaliencePreviewCard {
  const tags = uniqueStrings([
    ...document.tags.emotions,
    ...document.tags.pressureTags,
    ...document.tags.relationshipTags,
    ...document.tags.callbackTags,
    ...document.tags.continuityTags,
  ]).slice(0, defaults.maxTagsPerCard);
  const reasons = uniqueStrings([
    `rank ${match.rank}`,
    `semantic ${match.score.semanticScore.toFixed(2)}`,
    `salience ${match.score.salienceScore.toFixed(2)}`,
    document.channelContext.sourceKind.toLowerCase(),
    document.channelContext.channelId ?? null,
  ]).slice(0, defaults.maxReasonsPerCard);
  const score01 = clamp01(match.score.finalScore / 1.2);
  return Object.freeze({
    id: `document:${document.id}`,
    kind: 'DOCUMENT',
    band: bandFromScore(score01),
    score01,
    title: truncate(`${document.kind}:${document.channelContext.sourceKind}`, defaults.maxHeadlineChars),
    subtitle:
      document.channelContext.actorPersonaId ??
      document.channelContext.actorId ??
      document.channelContext.channelId ??
      'memory document',
    summary: truncate(document.summary, defaults.maxSummaryChars),
    tags,
    reasons,
    callbackEligible: score01 >= defaults.callbackThreshold01 && document.tags.callbackTags.length > 0,
    witnessHeavy:
      document.tags.relationshipTags.includes('crowd') ||
      document.tags.callbackTags.includes('public_witness'),
    silencePreferred:
      document.tags.revealTags.includes('deferred') &&
      score01 >= defaults.silenceThreshold01,
  });
}

function createHybridCard(
  anchorCard: ChatSaliencePreviewCard,
  documentCard: ChatSaliencePreviewCard,
  defaults: typeof CHAT_SALIENCE_PREVIEW_DEFAULTS,
): ChatSaliencePreviewCard {
  const score01 = clamp01((anchorCard.score01 * 0.6) + (documentCard.score01 * 0.4));
  return Object.freeze({
    id: `${anchorCard.id}|${documentCard.id}`,
    kind: 'HYBRID',
    band: bandFromScore(score01),
    score01,
    title: truncate(anchorCard.title, defaults.maxHeadlineChars),
    subtitle: `${anchorCard.subtitle} ↔ ${documentCard.subtitle}`,
    summary: truncate(`${anchorCard.summary} ${documentCard.summary}`, defaults.maxSummaryChars),
    tags: uniqueStrings([...anchorCard.tags, ...documentCard.tags]).slice(0, defaults.maxTagsPerCard),
    reasons: uniqueStrings([...anchorCard.reasons, ...documentCard.reasons]).slice(0, defaults.maxReasonsPerCard),
    callbackEligible: anchorCard.callbackEligible || documentCard.callbackEligible,
    witnessHeavy: anchorCard.witnessHeavy || documentCard.witnessHeavy,
    silencePreferred: anchorCard.silencePreferred && documentCard.silencePreferred,
  });
}

/* ========================================================================== */
/* MARK: Builder                                                               */
/* ========================================================================== */

export class SaliencePreview {
  private readonly defaults: typeof CHAT_SALIENCE_PREVIEW_DEFAULTS;

  constructor(options: ChatSaliencePreviewOptions = {}) {
    this.defaults = Object.freeze({
      ...CHAT_SALIENCE_PREVIEW_DEFAULTS,
      ...(options.defaults ?? {}),
    });
  }

  public build(result: ChatMemoryRetrievalResult): ChatSaliencePreviewOutput {
    const anchorCards = result.selectedAnchors
      .slice(0, this.defaults.maxCards)
      .map((anchor, index) => {
        const match = result.anchorMatches[index] ?? result.anchorMatches[0];
        return match ? createCardFromAnchor(anchor, match, this.defaults) : null;
      })
      .filter((value): value is ChatSaliencePreviewCard => Boolean(value));

    const documentCards = result.selectedDocuments
      .slice(0, this.defaults.maxCards)
      .map((document, index) => {
        const match = result.documentMatches[index] ?? result.documentMatches[0];
        return match ? createCardFromDocument(document, match, this.defaults) : null;
      })
      .filter((value): value is ChatSaliencePreviewCard => Boolean(value));

    const hybridCards: ChatSaliencePreviewCard[] = [];
    if (anchorCards.length && documentCards.length) {
      hybridCards.push(createHybridCard(anchorCards[0], documentCards[0], this.defaults));
    }

    const cards = [...hybridCards, ...anchorCards, ...documentCards]
      .sort((left, right) => right.score01 - left.score01)
      .slice(0, this.defaults.maxCards);

    const primary = cards[0];
    const recommendation: ChatSalienceRecommendation = Object.freeze({
      preferCallback: cards.some((value) => value.callbackEligible),
      preferWitnessLine: cards.some((value) => value.witnessHeavy && value.score01 >= this.defaults.witnessThreshold01),
      preferSilenceBeat: cards.some((value) => value.silencePreferred),
      preferHelperEntry: cards.some((value) => value.tags.includes('helper') || value.tags.includes('rescue')),
      preferHaterEntry: cards.some((value) => value.tags.includes('rival') || value.tags.includes('hater')),
      dominantResidue: dominantResidueFromCards(cards),
    });

    const headline = primary
      ? truncate(primary.title, this.defaults.maxHeadlineChars)
      : 'No dominant memory residue';
    const subheadline = primary
      ? truncate(primary.summary, this.defaults.maxSummaryChars)
      : 'Retrieval returned no visible preview card.';

    const debugNotes = uniqueStrings([
      `documents=${result.documentMatches.length}`,
      `anchors=${result.anchorMatches.length}`,
      `reason=${result.reason}`,
      ...result.documentMatches.slice(0, 2).map((value) => summarizeEmbeddingMatch(value)),
      ...result.anchorMatches.slice(0, 2).map((value) => summarizeMemoryAnchorMatch(value)),
      ...result.selectedAnchors.slice(0, 1).map((value) => summarizeMemoryAnchor(value)),
      ...result.selectedDocuments.slice(0, 1).map((value) => summarizeEmbeddingDocument(value)),
      ...result.debugNotes,
    ]).slice(0, this.defaults.maxNotes);

    return Object.freeze({
      createdAtMs: result.createdAtMs,
      requestId: result.requestId,
      reason: result.reason,
      cards: Object.freeze(cards),
      headline,
      subheadline,
      recommendation,
      anchorPreviews: result.anchorPreviews,
      documentPreviews: result.documentPreviews,
      debugNotes,
    });
  }
}

/* ========================================================================== */
/* MARK: Public helpers                                                       */
/* ========================================================================== */

export function createSaliencePreview(
  options: ChatSaliencePreviewOptions = {},
): SaliencePreview {
  return new SaliencePreview(options);
}

export function buildChatSaliencePreview(
  result: ChatMemoryRetrievalResult,
  options: ChatSaliencePreviewOptions = {},
): ChatSaliencePreviewOutput {
  return new SaliencePreview(options).build(result);
}

export function summarizeChatSaliencePreview(
  output: ChatSaliencePreviewOutput,
): string {
  const top = output.cards[0];
  if (!top) {
    return `${output.reason} | no preview cards`;
  }
  return [
    output.reason,
    top.kind,
    top.band,
    top.title,
    `score=${top.score01.toFixed(3)}`,
  ].join(' | ');
}
