/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT LEARNING CONTRACT
 * FILE: shared/contracts/chat/learning/MemoryAnchors.ts
 * VERSION: 2026.03.20-retrieval-continuity.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for memory anchors.
 *
 * Memory anchors are the durable, retrieval-friendly units that say:
 * "this specific chat beat mattered."
 *
 * They exist so every lane can agree on:
 * - which moments deserve durable recall,
 * - what caused them to matter,
 * - what relationships / quotes / emotions / scenes they bind to,
 * - how long they should persist,
 * - what retrieval hints they should emit later,
 * - how they should be summarized for ranking, previews, receipts, and debug.
 *
 * This file is contract truth only.
 * It does not own vector storage, ANN search, or backend persistence.
 * ============================================================================
 */

import type {
  ConversationEmbeddingDocument,
  EmbeddingDocumentId,
  EmbeddingMatchKind,
  EmbeddingPreview,
  EmbeddingPurpose,
  EmbeddingRetentionClass,
  EmbeddingSearchMatch,
  EmbeddingSourceKind,
} from './ConversationEmbeddings';

export const MEMORY_ANCHOR_VERSION =
  '2026.03.20-retrieval-continuity.v1' as const;

export const MEMORY_ANCHOR_KINDS = [
  'COLLAPSE',
  'COMEBACK',
  'RESCUE',
  'BETRAYAL',
  'TRUST_GAIN',
  'TRUST_LOSS',
  'QUOTE_REVERSAL',
  'RIVALRY_ESCALATION',
  'RIVALRY_SOFTENING',
  'LEGEND',
  'DEALROOM_BLUFF',
  'DEALROOM_EXPOSURE',
  'EMBARRASSMENT',
  'INTIMIDATION',
  'ATTACHMENT',
  'PRESSURE_SPIKE',
  'SILENCE',
  'WORLD_EVENT',
  'RELATIONSHIP_SHIFT',
  'TURNING_POINT',
] as const;

export type MemoryAnchorKind = (typeof MEMORY_ANCHOR_KINDS)[number];

export const MEMORY_ANCHOR_EVIDENCE_KINDS = [
  'MESSAGE',
  'QUOTE',
  'MOMENT',
  'SCENE',
  'EMOTION',
  'RELATIONSHIP',
  'REPLAY',
  'SYSTEM_FACT',
  'OUTCOME',
] as const;

export type MemoryAnchorEvidenceKind =
  (typeof MEMORY_ANCHOR_EVIDENCE_KINDS)[number];

export const MEMORY_ANCHOR_STABILITY_CLASSES = [
  'VOLATILE',
  'RUN_STABLE',
  'MULTI_RUN',
  'CANONICAL',
  'LEGENDARY',
] as const;

export type MemoryAnchorStabilityClass =
  (typeof MEMORY_ANCHOR_STABILITY_CLASSES)[number];

export const MEMORY_ANCHOR_RETRIEVAL_PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;

export type MemoryAnchorRetrievalPriority =
  (typeof MEMORY_ANCHOR_RETRIEVAL_PRIORITIES)[number];

export const MEMORY_ANCHOR_TRIGGER_KINDS = [
  'AUTO',
  'MODEL',
  'RULE',
  'SYSTEM',
  'MANUAL',
  'IMPORT',
] as const;

export type MemoryAnchorTriggerKind =
  (typeof MEMORY_ANCHOR_TRIGGER_KINDS)[number];

export const MEMORY_ANCHOR_QUERY_INTENTS = [
  'CALLBACK',
  'RESCUE',
  'TAUNT',
  'CELEBRATION',
  'RELATIONSHIP_CONTEXT',
  'DEALROOM_CONTEXT',
  'RANKING_CONTEXT',
  'POSTRUN_CONTEXT',
  'LIVEOPS_CONTEXT',
] as const;

export type MemoryAnchorQueryIntent =
  (typeof MEMORY_ANCHOR_QUERY_INTENTS)[number];

export type MemoryAnchorId = `cma_${string}`;
export type MemoryAnchorFamilyId = `cmf_${string}`;
export type MemoryAnchorWindowId = `cmw_${string}`;
export type MemoryAnchorReceiptId = `cmr_${string}`;
export type MemoryAnchorPreviewId = `cmp_${string}`;
export type MemoryAnchorQueryId = `cmq_${string}`;

export interface MemoryAnchorSubjectRef {
  readonly sourceKind: EmbeddingSourceKind;
  readonly sourceId?: string;
  readonly actorId?: string;
  readonly actorPersonaId?: string;
  readonly relationshipId?: string;
  readonly quoteId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
}

export interface MemoryAnchorEvidence {
  readonly kind: MemoryAnchorEvidenceKind;
  readonly documentId?: EmbeddingDocumentId;
  readonly quoteId?: string;
  readonly relationshipId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly messageId?: string;
  readonly description: string;
  readonly excerpt?: string;
  readonly weight: number;
}

export interface MemoryAnchorSalienceProfile {
  readonly immediate: number;
  readonly emotional: number;
  readonly narrative: number;
  readonly social: number;
  readonly relationship: number;
  readonly comeback: number;
  readonly collapse: number;
  readonly rescue: number;
  readonly prestige: number;
  readonly retrieval: number;
  readonly final: number;
}

export interface MemoryAnchorFormation {
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly triggerKind: MemoryAnchorTriggerKind;
  readonly triggerReason: string;
  readonly firstSeenAtMs: number;
  readonly reaffirmedAtMs?: number;
  readonly hitCount: number;
  readonly reaffirmCount: number;
}

export interface MemoryAnchorContinuityLinks {
  readonly predecessorAnchorIds: readonly MemoryAnchorId[];
  readonly successorAnchorIds: readonly MemoryAnchorId[];
  readonly familyId?: MemoryAnchorFamilyId;
  readonly carriesAcrossModes: boolean;
  readonly carriesAcrossRuns: boolean;
  readonly followPersonaIds: readonly string[];
  readonly unresolved: boolean;
}

export interface MemoryAnchorRetrievalHints {
  readonly queryIntents: readonly MemoryAnchorQueryIntent[];
  readonly requiredTags: readonly string[];
  readonly blockedTags: readonly string[];
  readonly matchKinds: readonly EmbeddingMatchKind[];
  readonly priority: MemoryAnchorRetrievalPriority;
  readonly weight: number;
  readonly minimumScore: number;
  readonly timeDecayHalfLifeMs?: number;
  readonly relationshipBoost: number;
  readonly emotionBoost: number;
  readonly continuityBoost: number;
}

export interface MemoryAnchorPayload {
  readonly headline: string;
  readonly summary: string;
  readonly canonicalText: string;
  readonly tags: readonly string[];
  readonly emotions: readonly string[];
  readonly relationshipTags: readonly string[];
  readonly callbackPhrases: readonly string[];
}

export interface MemoryAnchorWindow {
  readonly id: MemoryAnchorWindowId;
  readonly openedAtMs: number;
  readonly closedAtMs?: number;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly anchorIds: readonly MemoryAnchorId[];
  readonly dominantKinds: readonly MemoryAnchorKind[];
  readonly totalFinalSalience: number;
}

export interface MemoryAnchor {
  readonly id: MemoryAnchorId;
  readonly kind: MemoryAnchorKind;
  readonly purpose: EmbeddingPurpose;
  readonly stabilityClass: MemoryAnchorStabilityClass;
  readonly retentionClass: EmbeddingRetentionClass;
  readonly subject: MemoryAnchorSubjectRef;
  readonly formation: MemoryAnchorFormation;
  readonly payload: MemoryAnchorPayload;
  readonly salience: MemoryAnchorSalienceProfile;
  readonly evidence: readonly MemoryAnchorEvidence[];
  readonly continuity: MemoryAnchorContinuityLinks;
  readonly retrieval: MemoryAnchorRetrievalHints;
  readonly embeddingDocumentIds: readonly EmbeddingDocumentId[];
  readonly quoteRefs: readonly string[];
  readonly relationshipRefs: readonly string[];
  readonly debugNotes: readonly string[];
}

export interface MemoryAnchorQuery {
  readonly id: MemoryAnchorQueryId;
  readonly createdAtMs: number;
  readonly intent: MemoryAnchorQueryIntent;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly actorId?: string;
  readonly actorPersonaId?: string;
  readonly relationshipId?: string;
  readonly kinds: readonly MemoryAnchorKind[];
  readonly requiredTags: readonly string[];
  readonly blockedTags: readonly string[];
  readonly minimumFinalSalience: number;
  readonly topK: number;
}

export interface MemoryAnchorMatch {
  readonly rank: number;
  readonly anchorId: MemoryAnchorId;
  readonly kind: MemoryAnchorKind;
  readonly stabilityClass: MemoryAnchorStabilityClass;
  readonly priority: MemoryAnchorRetrievalPriority;
  readonly headline: string;
  readonly summary: string;
  readonly finalSalience: number;
  readonly retrievalScore: number;
  readonly evidenceWeight: number;
  readonly continuityBoost: number;
  readonly reaffirmCount: number;
  readonly quoteRefs: readonly string[];
  readonly relationshipRefs: readonly string[];
  readonly matchedTags: readonly string[];
}

export interface MemoryAnchorReceipt {
  readonly id: MemoryAnchorReceiptId;
  readonly queryId: MemoryAnchorQueryId;
  readonly createdAtMs: number;
  readonly candidateCount: number;
  readonly returnedCount: number;
  readonly topAnchorIds: readonly MemoryAnchorId[];
  readonly debugNotes: readonly string[];
}

export interface MemoryAnchorPreview {
  readonly id: MemoryAnchorPreviewId;
  readonly anchorId: MemoryAnchorId;
  readonly title: string;
  readonly subtitle: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly finalSalience: number;
  readonly retrievalPriority: MemoryAnchorRetrievalPriority;
  readonly stabilityClass: MemoryAnchorStabilityClass;
}

export const MEMORY_ANCHOR_DEFAULT_TOP_K = 6 as const;
export const MEMORY_ANCHOR_DEFAULT_MINIMUM_FINAL_SALIENCE = 0.35 as const;

export const MEMORY_ANCHOR_CONTRACT_MANIFEST = Object.freeze({
  version: MEMORY_ANCHOR_VERSION,
  kinds: MEMORY_ANCHOR_KINDS,
  evidenceKinds: MEMORY_ANCHOR_EVIDENCE_KINDS,
  stabilityClasses: MEMORY_ANCHOR_STABILITY_CLASSES,
  retrievalPriorities: MEMORY_ANCHOR_RETRIEVAL_PRIORITIES,
  triggerKinds: MEMORY_ANCHOR_TRIGGER_KINDS,
  queryIntents: MEMORY_ANCHOR_QUERY_INTENTS,
  defaults: Object.freeze({
    topK: MEMORY_ANCHOR_DEFAULT_TOP_K,
    minimumFinalSalience: MEMORY_ANCHOR_DEFAULT_MINIMUM_FINAL_SALIENCE,
  }),
});

export function createMemoryAnchorId(seed: string): MemoryAnchorId {
  return `cma_${normalizeMemoryAnchorSeed(seed)}`;
}

export function createMemoryAnchorFamilyId(seed: string): MemoryAnchorFamilyId {
  return `cmf_${normalizeMemoryAnchorSeed(seed)}`;
}

export function createMemoryAnchorWindowId(seed: string): MemoryAnchorWindowId {
  return `cmw_${normalizeMemoryAnchorSeed(seed)}`;
}

export function createMemoryAnchorReceiptId(seed: string): MemoryAnchorReceiptId {
  return `cmr_${normalizeMemoryAnchorSeed(seed)}`;
}

export function createMemoryAnchorPreviewId(seed: string): MemoryAnchorPreviewId {
  return `cmp_${normalizeMemoryAnchorSeed(seed)}`;
}

export function createMemoryAnchorQueryId(seed: string): MemoryAnchorQueryId {
  return `cmq_${normalizeMemoryAnchorSeed(seed)}`;
}

export function normalizeMemoryAnchorSeed(seed: string): string {
  return (seed || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96) || 'unknown';
}

export function createMemoryAnchorSubjectRef(
  partial: Partial<MemoryAnchorSubjectRef> = {},
): MemoryAnchorSubjectRef {
  return Object.freeze({
    sourceKind: partial.sourceKind ?? 'SYSTEM',
    sourceId: partial.sourceId,
    actorId: partial.actorId,
    actorPersonaId: partial.actorPersonaId,
    relationshipId: partial.relationshipId,
    quoteId: partial.quoteId,
    roomId: partial.roomId,
    channelId: partial.channelId,
    runId: partial.runId,
    sceneId: partial.sceneId,
    momentId: partial.momentId,
  });
}

export function createMemoryAnchorEvidence(
  partial: Omit<MemoryAnchorEvidence, 'weight'> & { readonly weight?: number },
): MemoryAnchorEvidence {
  return Object.freeze({
    ...partial,
    weight: clampUnit(partial.weight ?? 0.5),
  });
}

export function createDefaultMemoryAnchorSalience(): MemoryAnchorSalienceProfile {
  return Object.freeze({
    immediate: 0.5,
    emotional: 0.5,
    narrative: 0.5,
    social: 0.5,
    relationship: 0.5,
    comeback: 0,
    collapse: 0,
    rescue: 0,
    prestige: 0,
    retrieval: 0.5,
    final: 0.5,
  });
}

export function computeMemoryAnchorFinalSalience(
  profile: Partial<MemoryAnchorSalienceProfile>,
): number {
  const weighted =
    (profile.immediate ?? 0.5) * 0.14 +
    (profile.emotional ?? 0.5) * 0.14 +
    (profile.narrative ?? 0.5) * 0.12 +
    (profile.social ?? 0.5) * 0.09 +
    (profile.relationship ?? 0.5) * 0.13 +
    (profile.comeback ?? 0) * 0.08 +
    (profile.collapse ?? 0) * 0.08 +
    (profile.rescue ?? 0) * 0.08 +
    (profile.prestige ?? 0) * 0.06 +
    (profile.retrieval ?? 0.5) * 0.08;
  return clampUnit(weighted);
}

export function createMemoryAnchorFormation(
  partial: Partial<MemoryAnchorFormation> & {
    readonly triggerKind?: MemoryAnchorTriggerKind;
    readonly triggerReason?: string;
  } = {},
): MemoryAnchorFormation {
  const now = partial.createdAtMs ?? Date.now();
  return Object.freeze({
    createdAtMs: now,
    updatedAtMs: partial.updatedAtMs ?? now,
    triggerKind: partial.triggerKind ?? 'AUTO',
    triggerReason: partial.triggerReason ?? 'unspecified',
    firstSeenAtMs: partial.firstSeenAtMs ?? now,
    reaffirmedAtMs: partial.reaffirmedAtMs,
    hitCount: Math.max(1, Math.floor(partial.hitCount ?? 1)),
    reaffirmCount: Math.max(0, Math.floor(partial.reaffirmCount ?? 0)),
  });
}

export function createDefaultMemoryAnchorContinuityLinks(): MemoryAnchorContinuityLinks {
  return Object.freeze({
    predecessorAnchorIds: Object.freeze([]),
    successorAnchorIds: Object.freeze([]),
    familyId: undefined,
    carriesAcrossModes: true,
    carriesAcrossRuns: false,
    followPersonaIds: Object.freeze([]),
    unresolved: false,
  });
}

export function createDefaultMemoryAnchorRetrievalHints(): MemoryAnchorRetrievalHints {
  return Object.freeze({
    queryIntents: Object.freeze(['CALLBACK'] as const),
    requiredTags: Object.freeze([]),
    blockedTags: Object.freeze([]),
    matchKinds: Object.freeze(['SALIENT', 'HYBRID'] as const),
    priority: 'MEDIUM',
    weight: 0.5,
    minimumScore: 0.2,
    timeDecayHalfLifeMs: undefined,
    relationshipBoost: 0.15,
    emotionBoost: 0.12,
    continuityBoost: 0.18,
  });
}

export function createDefaultMemoryAnchorPayload(
  headline = 'Memory anchor',
  summary = 'Important memory anchor.',
): MemoryAnchorPayload {
  return Object.freeze({
    headline,
    summary,
    canonicalText: canonicalizeAnchorText(`${headline}. ${summary}`),
    tags: Object.freeze([]),
    emotions: Object.freeze([]),
    relationshipTags: Object.freeze([]),
    callbackPhrases: Object.freeze([]),
  });
}

export function createMemoryAnchor(input: {
  readonly idSeed: string;
  readonly kind: MemoryAnchorKind;
  readonly purpose?: EmbeddingPurpose;
  readonly stabilityClass?: MemoryAnchorStabilityClass;
  readonly retentionClass?: EmbeddingRetentionClass;
  readonly subject?: Partial<MemoryAnchorSubjectRef>;
  readonly formation?: Partial<MemoryAnchorFormation>;
  readonly payload?: Partial<MemoryAnchorPayload>;
  readonly salience?: Partial<MemoryAnchorSalienceProfile>;
  readonly evidence?: readonly MemoryAnchorEvidence[];
  readonly continuity?: Partial<MemoryAnchorContinuityLinks>;
  readonly retrieval?: Partial<MemoryAnchorRetrievalHints>;
  readonly embeddingDocumentIds?: readonly EmbeddingDocumentId[];
  readonly quoteRefs?: readonly string[];
  readonly relationshipRefs?: readonly string[];
  readonly debugNotes?: readonly string[];
}): MemoryAnchor {
  const salience = {
    ...createDefaultMemoryAnchorSalience(),
    ...(input.salience ?? {}),
  };
  return Object.freeze({
    id: createMemoryAnchorId(input.idSeed),
    kind: input.kind,
    purpose: input.purpose ?? inferAnchorPurpose(input.kind),
    stabilityClass: input.stabilityClass ?? inferAnchorStabilityClass(input.kind),
    retentionClass: input.retentionClass ?? inferAnchorRetentionClass(input.kind),
    subject: createMemoryAnchorSubjectRef(input.subject),
    formation: createMemoryAnchorFormation(input.formation),
    payload: mergeMemoryAnchorPayload(input.payload),
    salience: Object.freeze({
      ...salience,
      final: computeMemoryAnchorFinalSalience(salience),
    }),
    evidence: Object.freeze([...(input.evidence ?? [])]),
    continuity: Object.freeze({
      ...createDefaultMemoryAnchorContinuityLinks(),
      ...(input.continuity ?? {}),
      predecessorAnchorIds: Object.freeze([
        ...(input.continuity?.predecessorAnchorIds ?? []),
      ]),
      successorAnchorIds: Object.freeze([
        ...(input.continuity?.successorAnchorIds ?? []),
      ]),
      followPersonaIds: Object.freeze([
        ...(input.continuity?.followPersonaIds ?? []),
      ]),
    }),
    retrieval: Object.freeze({
      ...createDefaultMemoryAnchorRetrievalHints(),
      ...(input.retrieval ?? {}),
      queryIntents: Object.freeze(
        dedupeStrings(
          (input.retrieval?.queryIntents ?? ['CALLBACK']) as readonly string[],
        ) as readonly MemoryAnchorQueryIntent[],
      ),
      requiredTags: Object.freeze([...(input.retrieval?.requiredTags ?? [])]),
      blockedTags: Object.freeze([...(input.retrieval?.blockedTags ?? [])]),
      matchKinds: Object.freeze([...(input.retrieval?.matchKinds ?? ['SALIENT'])]),
      weight: clampUnit(input.retrieval?.weight ?? 0.5),
      minimumScore: clampUnit(input.retrieval?.minimumScore ?? 0.2),
      relationshipBoost: clampUnit(input.retrieval?.relationshipBoost ?? 0.15),
      emotionBoost: clampUnit(input.retrieval?.emotionBoost ?? 0.12),
      continuityBoost: clampUnit(input.retrieval?.continuityBoost ?? 0.18),
    }),
    embeddingDocumentIds: Object.freeze([...(input.embeddingDocumentIds ?? [])]),
    quoteRefs: Object.freeze([...(input.quoteRefs ?? [])]),
    relationshipRefs: Object.freeze([...(input.relationshipRefs ?? [])]),
    debugNotes: Object.freeze([...(input.debugNotes ?? [])]),
  });
}

export function createMemoryAnchorWindow(input: {
  readonly idSeed: string;
  readonly openedAtMs?: number;
  readonly closedAtMs?: number;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly anchorIds?: readonly MemoryAnchorId[];
  readonly dominantKinds?: readonly MemoryAnchorKind[];
  readonly totalFinalSalience?: number;
}): MemoryAnchorWindow {
  return Object.freeze({
    id: createMemoryAnchorWindowId(input.idSeed),
    openedAtMs: input.openedAtMs ?? Date.now(),
    closedAtMs: input.closedAtMs,
    runId: input.runId,
    sceneId: input.sceneId,
    momentId: input.momentId,
    roomId: input.roomId,
    channelId: input.channelId,
    anchorIds: Object.freeze([...(input.anchorIds ?? [])]),
    dominantKinds: Object.freeze([...(input.dominantKinds ?? [])]),
    totalFinalSalience: clampUnit(input.totalFinalSalience ?? 0),
  });
}

export function createMemoryAnchorQuery(
  partial: Partial<MemoryAnchorQuery> & { readonly idSeed: string; readonly intent: MemoryAnchorQueryIntent },
): MemoryAnchorQuery {
  return Object.freeze({
    id: createMemoryAnchorQueryId(partial.idSeed),
    createdAtMs: partial.createdAtMs ?? Date.now(),
    intent: partial.intent,
    roomId: partial.roomId,
    channelId: partial.channelId,
    runId: partial.runId,
    sceneId: partial.sceneId,
    momentId: partial.momentId,
    actorId: partial.actorId,
    actorPersonaId: partial.actorPersonaId,
    relationshipId: partial.relationshipId,
    kinds: Object.freeze([...(partial.kinds ?? [])]),
    requiredTags: Object.freeze([...(partial.requiredTags ?? [])]),
    blockedTags: Object.freeze([...(partial.blockedTags ?? [])]),
    minimumFinalSalience: clampUnit(
      partial.minimumFinalSalience ?? MEMORY_ANCHOR_DEFAULT_MINIMUM_FINAL_SALIENCE,
    ),
    topK: Math.max(1, Math.floor(partial.topK ?? MEMORY_ANCHOR_DEFAULT_TOP_K)),
  });
}

export function anchorMatchesQuery(
  query: MemoryAnchorQuery,
  anchor: MemoryAnchor,
): boolean {
  if (query.kinds.length && !query.kinds.includes(anchor.kind)) return false;
  if (query.roomId && anchor.subject.roomId !== query.roomId) return false;
  if (query.channelId && anchor.subject.channelId !== query.channelId) return false;
  if (query.runId && anchor.subject.runId !== query.runId) return false;
  if (query.sceneId && anchor.subject.sceneId !== query.sceneId) return false;
  if (query.momentId && anchor.subject.momentId !== query.momentId) return false;
  if (query.actorId && anchor.subject.actorId !== query.actorId) return false;
  if (
    query.actorPersonaId &&
    anchor.subject.actorPersonaId !== query.actorPersonaId
  ) {
    return false;
  }
  if (
    query.relationshipId &&
    !anchor.relationshipRefs.includes(query.relationshipId) &&
    anchor.subject.relationshipId !== query.relationshipId
  ) {
    return false;
  }
  if (anchor.salience.final < query.minimumFinalSalience) return false;
  if (
    query.requiredTags.length &&
    !query.requiredTags.every((tag) => memoryAnchorHasTag(anchor, tag))
  ) {
    return false;
  }
  if (
    query.blockedTags.some((tag) => memoryAnchorHasTag(anchor, tag))
  ) {
    return false;
  }
  return true;
}

export function memoryAnchorHasTag(anchor: MemoryAnchor, tag: string): boolean {
  const normalized = tag.toLowerCase();
  const tags = [
    ...anchor.payload.tags,
    ...anchor.payload.emotions,
    ...anchor.payload.relationshipTags,
    ...anchor.payload.callbackPhrases,
  ].map((value) => value.toLowerCase());
  return tags.includes(normalized);
}

export function scoreMemoryAnchorMatch(
  query: MemoryAnchorQuery,
  anchor: MemoryAnchor,
): number {
  const intentScore = anchor.retrieval.queryIntents.includes(query.intent) ? 0.22 : 0;
  const salienceScore = anchor.salience.final * 0.28;
  const priorityScore = memoryAnchorPriorityWeight(anchor.retrieval.priority) * 0.18;
  const tagScore = computeAnchorTagScore(query, anchor) * 0.1;
  const continuityBoost = anchor.continuity.unresolved ? 0.1 : 0;
  const evidenceWeight = computeMemoryAnchorEvidenceWeight(anchor) * 0.12;
  const reaffirmScore = Math.min(0.1, anchor.formation.reaffirmCount * 0.02);
  return clampUnit(
    intentScore +
      salienceScore +
      priorityScore +
      tagScore +
      continuityBoost +
      evidenceWeight +
      reaffirmScore,
  );
}

export function createMemoryAnchorMatch(
  rank: number,
  query: MemoryAnchorQuery,
  anchor: MemoryAnchor,
): MemoryAnchorMatch {
  return Object.freeze({
    rank,
    anchorId: anchor.id,
    kind: anchor.kind,
    stabilityClass: anchor.stabilityClass,
    priority: anchor.retrieval.priority,
    headline: anchor.payload.headline,
    summary: anchor.payload.summary,
    finalSalience: anchor.salience.final,
    retrievalScore: scoreMemoryAnchorMatch(query, anchor),
    evidenceWeight: computeMemoryAnchorEvidenceWeight(anchor),
    continuityBoost: anchor.continuity.unresolved
      ? anchor.retrieval.continuityBoost
      : 0,
    reaffirmCount: anchor.formation.reaffirmCount,
    quoteRefs: Object.freeze([...anchor.quoteRefs]),
    relationshipRefs: Object.freeze([...anchor.relationshipRefs]),
    matchedTags: Object.freeze(
      dedupeStrings(
        query.requiredTags.filter((tag) => memoryAnchorHasTag(anchor, tag)),
      ),
    ),
  });
}

export function rankMemoryAnchors(
  query: MemoryAnchorQuery,
  anchors: readonly MemoryAnchor[],
): readonly MemoryAnchorMatch[] {
  return Object.freeze(
    anchors
      .filter((anchor) => anchorMatchesQuery(query, anchor))
      .map((anchor) => createMemoryAnchorMatch(0, query, anchor))
      .sort((left, right) => right.retrievalScore - left.retrievalScore)
      .slice(0, query.topK)
      .map((match, index) =>
        Object.freeze({
          ...match,
          rank: index + 1,
        }),
      ),
  );
}

export function createMemoryAnchorReceipt(
  query: MemoryAnchorQuery,
  matches: readonly MemoryAnchorMatch[],
  candidateCount: number,
  debugNotes: readonly string[] = [],
): MemoryAnchorReceipt {
  return Object.freeze({
    id: createMemoryAnchorReceiptId(`${query.id}_${matches.length}`),
    queryId: query.id,
    createdAtMs: Date.now(),
    candidateCount,
    returnedCount: matches.length,
    topAnchorIds: Object.freeze(matches.map((value) => value.anchorId)),
    debugNotes: Object.freeze([...debugNotes]),
  });
}

export function createMemoryAnchorPreview(
  anchor: MemoryAnchor,
): MemoryAnchorPreview {
  return Object.freeze({
    id: createMemoryAnchorPreviewId(anchor.id),
    anchorId: anchor.id,
    title: anchor.payload.headline,
    subtitle: `${anchor.kind} • ${anchor.retrieval.priority}`,
    summary: anchor.payload.summary,
    tags: Object.freeze(
      dedupeStrings([
        ...anchor.payload.tags,
        ...anchor.payload.emotions,
        ...anchor.payload.relationshipTags,
      ]).slice(0, 8),
    ),
    finalSalience: anchor.salience.final,
    retrievalPriority: anchor.retrieval.priority,
    stabilityClass: anchor.stabilityClass,
  });
}

export function createMemoryAnchorFromEmbeddingDocument(
  document: ConversationEmbeddingDocument,
  kind: MemoryAnchorKind,
  partial: {
    readonly idSeed?: string;
    readonly triggerReason?: string;
    readonly queryIntents?: readonly MemoryAnchorQueryIntent[];
    readonly familyId?: MemoryAnchorFamilyId;
    readonly unresolved?: boolean;
  } = {},
): MemoryAnchor {
  return createMemoryAnchor({
    idSeed: partial.idSeed ?? `${document.id}_${kind}`,
    kind,
    purpose: document.purpose,
    retentionClass: inferAnchorRetentionClass(kind),
    subject: {
      sourceKind: document.channelContext.sourceKind,
      sourceId: document.channelContext.sourceId,
      actorId: document.channelContext.actorId,
      actorPersonaId: document.channelContext.actorPersonaId,
      relationshipId: document.channelContext.relationshipId,
      quoteId: document.channelContext.quoteId,
      roomId: document.channelContext.roomId,
      channelId: document.channelContext.channelId,
      runId: document.channelContext.runId,
      sceneId: document.channelContext.sceneId,
      momentId: document.channelContext.momentId,
    },
    formation: {
      createdAtMs: document.createdAtMs,
      updatedAtMs: document.updatedAtMs,
      triggerKind: 'AUTO',
      triggerReason: partial.triggerReason ?? `derived_from_${document.kind}`,
      firstSeenAtMs: document.createdAtMs,
      hitCount: 1,
      reaffirmCount: 0,
    },
    payload: {
      headline: deriveMemoryAnchorHeadline(kind, document),
      summary: document.summary,
      canonicalText: document.canonicalText,
      tags: dedupeStrings([
        ...document.tags.intents,
        ...document.tags.pressureTags,
        ...document.tags.callbackTags,
        ...document.tags.continuityTags,
      ]),
      emotions: dedupeStrings(document.tags.emotions),
      relationshipTags: dedupeStrings(document.tags.relationshipTags),
      callbackPhrases: dedupeStrings(document.tags.callbackTags),
    },
    salience: {
      immediate: document.salience.baseSalience,
      emotional: document.salience.emotionalSalience,
      narrative: document.salience.narrativeSalience,
      social: document.salience.conflictSalience,
      relationship: document.salience.relationshipSalience,
      comeback: document.salience.comebackSalience,
      collapse: document.salience.collapseSalience,
      rescue: document.salience.rescueSalience,
      prestige: document.salience.prestigeSalience,
      retrieval: document.salience.finalSalience,
    },
    evidence: [
      createMemoryAnchorEvidence({
        kind: 'MESSAGE',
        documentId: document.id,
        sceneId: document.channelContext.sceneId,
        momentId: document.channelContext.momentId,
        relationshipId: document.channelContext.relationshipId,
        quoteId: document.channelContext.quoteId,
        messageId: document.channelContext.messageId,
        description: `Derived from ${document.kind.toLowerCase()} document`,
        excerpt: document.canonicalText.slice(0, 180),
        weight: document.salience.finalSalience,
      }),
    ],
    continuity: {
      familyId: partial.familyId,
      carriesAcrossModes: true,
      carriesAcrossRuns: document.retentionClass !== 'SHORT_RUN',
      unresolved: partial.unresolved ?? false,
      followPersonaIds: document.channelContext.actorPersonaId
        ? [document.channelContext.actorPersonaId]
        : [],
    },
    retrieval: {
      queryIntents: partial.queryIntents ?? inferDefaultQueryIntents(kind),
      requiredTags: [],
      blockedTags: [],
      matchKinds: inferDefaultMatchKinds(kind),
      priority: inferAnchorPriority(kind),
      weight: document.salience.finalSalience,
      minimumScore: 0.2,
      relationshipBoost: document.relationshipRefs.length ? 0.2 : 0.1,
      emotionBoost: document.tags.emotions.length ? 0.18 : 0.08,
      continuityBoost: document.anchorRefs.length ? 0.22 : 0.14,
    },
    embeddingDocumentIds: [document.id],
    quoteRefs: document.quoteRefs,
    relationshipRefs: document.relationshipRefs,
  });
}

export function groupMemoryAnchorsIntoWindow(
  seed: string,
  anchors: readonly MemoryAnchor[],
  partial: Omit<MemoryAnchorWindow, 'id' | 'anchorIds' | 'dominantKinds' | 'totalFinalSalience'> &
    Partial<Pick<MemoryAnchorWindow, 'closedAtMs'>>,
): MemoryAnchorWindow {
  const dominantKinds = dedupeStrings(
    anchors
      .slice()
      .sort((left, right) => right.salience.final - left.salience.final)
      .slice(0, 5)
      .map((value) => value.kind),
  ) as readonly MemoryAnchorKind[];

  return Object.freeze({
    id: createMemoryAnchorWindowId(seed),
    openedAtMs: partial.openedAtMs,
    closedAtMs: partial.closedAtMs,
    runId: partial.runId,
    sceneId: partial.sceneId,
    momentId: partial.momentId,
    roomId: partial.roomId,
    channelId: partial.channelId,
    anchorIds: Object.freeze(anchors.map((value) => value.id)),
    dominantKinds: Object.freeze([...dominantKinds]),
    totalFinalSalience: clampUnit(
      anchors.reduce((sum, value) => sum + value.salience.final, 0) /
        Math.max(1, anchors.length),
    ),
  });
}

export function summarizeMemoryAnchor(anchor: MemoryAnchor): string {
  return [
    `${anchor.kind}`,
    `priority=${anchor.retrieval.priority}`,
    `salience=${anchor.salience.final.toFixed(3)}`,
    anchor.payload.headline,
  ].join(' | ');
}

export function summarizeMemoryAnchorMatch(match: MemoryAnchorMatch): string {
  return [
    `rank=${match.rank}`,
    `anchor=${match.anchorId}`,
    `score=${match.retrievalScore.toFixed(3)}`,
    match.headline,
  ].join(' | ');
}

export function convertMemoryAnchorToPreview(
  anchor: MemoryAnchor,
): MemoryAnchorPreview {
  return createMemoryAnchorPreview(anchor);
}

export function convertMemoryAnchorMatchToEmbeddingPreview(
  match: MemoryAnchorMatch,
): EmbeddingPreview {
  return Object.freeze({
    id: `cep_${normalizeMemoryAnchorSeed(match.anchorId)}` as const,
    documentId: `ced_${normalizeMemoryAnchorSeed(match.anchorId)}` as EmbeddingDocumentId,
    purpose: 'CHAT_MEMORY',
    title: match.headline,
    subtitle: `${match.kind} • ${match.priority}`,
    summary: match.summary,
    topTags: Object.freeze([...match.matchedTags]),
    sourceKind: 'SYSTEM',
    retentionClass: inferAnchorRetentionClass(match.kind),
    salience: match.finalSalience,
  });
}

export function createAnchorLinksFromMatches(
  matches: readonly EmbeddingSearchMatch[],
): readonly EmbeddingDocumentId[] {
  return Object.freeze(matches.map((value) => value.documentId));
}

export function computeMemoryAnchorEvidenceWeight(anchor: MemoryAnchor): number {
  if (!anchor.evidence.length) return 0;
  const weighted = anchor.evidence.reduce((sum, value) => sum + value.weight, 0);
  return clampUnit(weighted / anchor.evidence.length);
}

export function computeAnchorTagScore(
  query: MemoryAnchorQuery,
  anchor: MemoryAnchor,
): number {
  if (!query.requiredTags.length) return 0.5;
  const matched = query.requiredTags.filter((tag) => memoryAnchorHasTag(anchor, tag));
  return matched.length / query.requiredTags.length;
}

export function inferAnchorPurpose(kind: MemoryAnchorKind): EmbeddingPurpose {
  switch (kind) {
    case 'QUOTE_REVERSAL':
      return 'CHAT_QUOTE';
    case 'RELATIONSHIP_SHIFT':
    case 'TRUST_GAIN':
    case 'TRUST_LOSS':
    case 'ATTACHMENT':
    case 'RIVALRY_ESCALATION':
    case 'RIVALRY_SOFTENING':
      return 'CHAT_RELATIONSHIP';
    case 'PRESSURE_SPIKE':
    case 'INTIMIDATION':
    case 'EMBARRASSMENT':
      return 'CHAT_EMOTION';
    case 'LEGEND':
      return 'CHAT_MOMENT';
    default:
      return 'CHAT_MEMORY';
  }
}

export function inferAnchorStabilityClass(
  kind: MemoryAnchorKind,
): MemoryAnchorStabilityClass {
  switch (kind) {
    case 'LEGEND':
    case 'TURNING_POINT':
      return 'LEGENDARY';
    case 'RELATIONSHIP_SHIFT':
    case 'RIVALRY_ESCALATION':
    case 'RIVALRY_SOFTENING':
      return 'CANONICAL';
    case 'COMEBACK':
    case 'COLLAPSE':
    case 'RESCUE':
      return 'MULTI_RUN';
    default:
      return 'RUN_STABLE';
  }
}

export function inferAnchorRetentionClass(
  kind: MemoryAnchorKind,
): EmbeddingRetentionClass {
  switch (kind) {
    case 'LEGEND':
    case 'TURNING_POINT':
      return 'FOREVER';
    case 'RELATIONSHIP_SHIFT':
    case 'RIVALRY_ESCALATION':
    case 'RIVALRY_SOFTENING':
      return 'LEGENDARY';
    case 'COMEBACK':
    case 'COLLAPSE':
    case 'RESCUE':
      return 'MULTI_RUN';
    default:
      return 'SHORT_RUN';
  }
}

export function inferAnchorPriority(
  kind: MemoryAnchorKind,
): MemoryAnchorRetrievalPriority {
  switch (kind) {
    case 'LEGEND':
    case 'TURNING_POINT':
    case 'RESCUE':
      return 'CRITICAL';
    case 'COMEBACK':
    case 'COLLAPSE':
    case 'RIVALRY_ESCALATION':
    case 'RELATIONSHIP_SHIFT':
      return 'HIGH';
    case 'EMBARRASSMENT':
    case 'INTIMIDATION':
    case 'ATTACHMENT':
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

export function inferDefaultQueryIntents(
  kind: MemoryAnchorKind,
): readonly MemoryAnchorQueryIntent[] {
  switch (kind) {
    case 'RESCUE':
      return Object.freeze(['RESCUE', 'CALLBACK']);
    case 'COMEBACK':
      return Object.freeze(['CELEBRATION', 'CALLBACK']);
    case 'COLLAPSE':
      return Object.freeze(['CALLBACK', 'POSTRUN_CONTEXT']);
    case 'DEALROOM_BLUFF':
    case 'DEALROOM_EXPOSURE':
      return Object.freeze(['DEALROOM_CONTEXT', 'CALLBACK']);
    case 'RELATIONSHIP_SHIFT':
    case 'ATTACHMENT':
      return Object.freeze(['RELATIONSHIP_CONTEXT', 'CALLBACK']);
    default:
      return Object.freeze(['CALLBACK']);
  }
}

export function inferDefaultMatchKinds(
  kind: MemoryAnchorKind,
): readonly EmbeddingMatchKind[] {
  switch (kind) {
    case 'RESCUE':
    case 'COMEBACK':
    case 'COLLAPSE':
      return Object.freeze(['SALIENT', 'EMOTION_BOOSTED', 'HYBRID']);
    case 'RELATIONSHIP_SHIFT':
    case 'ATTACHMENT':
      return Object.freeze(['RELATIONSHIP_BOOSTED', 'SALIENT']);
    default:
      return Object.freeze(['SALIENT', 'HYBRID']);
  }
}

export function deriveMemoryAnchorHeadline(
  kind: MemoryAnchorKind,
  document: ConversationEmbeddingDocument,
): string {
  const actor =
    document.channelContext.actorPersonaId ??
    document.channelContext.actorId ??
    document.channelContext.sourceKind;
  switch (kind) {
    case 'COMEBACK':
      return `${actor} comeback anchored`;
    case 'COLLAPSE':
      return `${actor} collapse anchored`;
    case 'RESCUE':
      return `${actor} rescue anchored`;
    case 'QUOTE_REVERSAL':
      return `${actor} quote reversal anchored`;
    case 'RELATIONSHIP_SHIFT':
      return `${actor} relationship shift anchored`;
    default:
      return `${actor} ${kind.toLowerCase().replace(/_/g, ' ')} anchored`;
  }
}

export function mergeMemoryAnchorPayload(
  partial?: Partial<MemoryAnchorPayload>,
): MemoryAnchorPayload {
  const base = createDefaultMemoryAnchorPayload();
  return Object.freeze({
    headline: partial?.headline ?? base.headline,
    summary: partial?.summary ?? base.summary,
    canonicalText:
      partial?.canonicalText ??
      canonicalizeAnchorText(
        `${partial?.headline ?? base.headline}. ${partial?.summary ?? base.summary}`,
      ),
    tags: Object.freeze(dedupeStrings([...(partial?.tags ?? base.tags)])),
    emotions: Object.freeze(
      dedupeStrings([...(partial?.emotions ?? base.emotions)]),
    ),
    relationshipTags: Object.freeze(
      dedupeStrings([
        ...(partial?.relationshipTags ?? base.relationshipTags),
      ]),
    ),
    callbackPhrases: Object.freeze(
      dedupeStrings([
        ...(partial?.callbackPhrases ?? base.callbackPhrases),
      ]),
    ),
  });
}

export function canonicalizeAnchorText(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function memoryAnchorPriorityWeight(
  priority: MemoryAnchorRetrievalPriority,
): number {
  switch (priority) {
    case 'CRITICAL':
      return 1;
    case 'HIGH':
      return 0.8;
    case 'MEDIUM':
      return 0.55;
    case 'LOW':
    default:
      return 0.3;
  }
}

export function dedupeStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return Object.freeze(output);
}

export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
