
/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT RETRIEVAL RANKING AUTHORITY
 * FILE: backend/src/game/engine/chat/intelligence/dl/MemoryRankingPolicy.ts
 * VERSION: 2026.03.21-retrieval-continuity.v2
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic ranking authority for retrieval-backed chat continuity.
 *
 * This file owns the scoring policy for durable memory anchors when backend chat
 * needs to answer questions such as:
 * - Which remembered beat should a rival call back right now?
 * - Which rescue memory should a helper surface under pressure?
 * - Which emotional / social / relationship memory matters most for this lane?
 * - Which anchors should become the retrieval context for downstream authored
 *   response selection, scene planning, or liveops overlays?
 *
 * Design doctrine
 * ---------------
 * - This file does not own durable persistence.
 * - This file does not own ANN / vector search.
 * - This file scores already-known candidates in a deterministic way.
 * - It remains explainable: every score can be decomposed into named factors.
 * - It stays compatible with both canonical intelligence/dl and legacy dl lanes.
 * ============================================================================
 */

import type { JsonValue } from '../../types';
import type {
  MemoryAnchor,
  MemoryAnchorId,
  MemoryAnchorKind,
  MemoryAnchorMatch,
  MemoryAnchorQueryIntent,
  MemoryAnchorRetrievalPriority,
  MemoryAnchorStabilityClass,
} from '../../../../../../../shared/contracts/chat/learning/MemoryAnchors';

export const MEMORY_RANKING_POLICY_VERSION =
  '2026.03.21-retrieval-continuity.v2' as const;

export const MEMORY_RANKING_POLICY_PRIORITY_WEIGHT = Object.freeze<
  Record<MemoryAnchorRetrievalPriority, number>
>({
  LOW: 0.35,
  MEDIUM: 0.58,
  HIGH: 0.82,
  CRITICAL: 1,
});

export const MEMORY_RANKING_POLICY_STABILITY_WEIGHT = Object.freeze<
  Record<MemoryAnchorStabilityClass, number>
>({
  VOLATILE: 0.36,
  RUN_STABLE: 0.58,
  MULTI_RUN: 0.76,
  CANONICAL: 0.9,
  LEGENDARY: 1,
});

export const MEMORY_RANKING_POLICY_INTENT_WEIGHT = Object.freeze<
  Record<MemoryAnchorQueryIntent, number>
>({
  CALLBACK: 0.86,
  RESCUE: 0.92,
  TAUNT: 0.9,
  CELEBRATION: 0.78,
  RELATIONSHIP_CONTEXT: 0.8,
  DEALROOM_CONTEXT: 0.84,
  RANKING_CONTEXT: 0.74,
  POSTRUN_CONTEXT: 0.81,
  LIVEOPS_CONTEXT: 0.69,
});

export const MEMORY_RANKING_POLICY_MATCH_KIND_WEIGHT = Object.freeze<
  Record<string, number>
>({
  EXACT: 1,
  HYBRID: 0.84,
  SALIENT: 0.76,
  SEMANTIC: 0.68,
  RELATIONSHIP: 0.82,
  EMOTIONAL: 0.74,
  CONTINUITY: 0.78,
  TAG: 0.6,
  WINDOW: 0.57,
  UNKNOWN: 0.45,
});

export const MEMORY_RANKING_POLICY_RETRIEVAL_SOURCE_WEIGHT = Object.freeze<
  Record<NonNullable<MemoryRankingCandidate['retrievalSource']>, number>
>({
  INDEX: 0.66,
  WINDOW: 0.58,
  VECTOR: 0.74,
  HYBRID: 0.92,
  UNKNOWN: 0.4,
});

export const MEMORY_RANKING_POLICY_DEFAULTS = Object.freeze({
  topK: 6,
  candidateCap: 128,
  baseMinimumScore: 0.16,
  halfLifeMs: 1000 * 60 * 12,
  evidenceWeightCap: 1,
  hitCountNormalizer: 7,
  reaffirmCountNormalizer: 4,
  duplicateFamilyPenalty: 0.24,
  duplicateAnchorPenalty: 0.5,
  unresolvedBoost: 0.12,
  callbackPhraseBoost: 0.1,
  quoteBoost: 0.1,
  relationshipBoost: 0.12,
  emotionBoost: 0.09,
  continuityBoost: 0.11,
  channelMatchBoost: 0.08,
  runMatchBoost: 0.08,
  sceneMatchBoost: 0.07,
  momentMatchBoost: 0.06,
  actorMatchBoost: 0.08,
  roomMatchBoost: 0.08,
  blockedTagPenalty: 0.45,
  requiredTagMissPenalty: 0.35,
  coldStartFallback: 0.42,
  targetKindMismatchPenalty: 0.32,
  queryTextFallback: 0.18,
  retrievalOrdinalSpan: 24,
  retrievalOrdinalBoost: 0.1,
  retrievalSourceBoost: 0.12,
  currentModeBoost: 0.08,
  exactActorPersonaBoost: 0.1,
});

export interface MemoryRankingPolicyWeights {
  readonly salience: number;
  readonly priority: number;
  readonly intent: number;
  readonly recency: number;
  readonly evidence: number;
  readonly hitCount: number;
  readonly reaffirm: number;
  readonly tagOverlap: number;
  readonly embedding: number;
  readonly stability: number;
  readonly relationship: number;
  readonly emotion: number;
  readonly continuity: number;
  readonly scopeMatch: number;
  readonly callbacks: number;
  readonly queryText: number;
  readonly retrievalSignal: number;
  readonly targetKind: number;
}

export interface MemoryRankingEmbeddingMatch {
  readonly documentId?: string;
  readonly kind?: string;
  readonly score?: number;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly preview?: string;
}

export interface MemoryRankingCandidate {
  readonly anchor: MemoryAnchor;
  readonly embeddingMatches?: readonly MemoryRankingEmbeddingMatch[];
  readonly relationshipSignals?: readonly string[];
  readonly emotionSignals?: readonly string[];
  readonly currentTags?: readonly string[];
  readonly currentModeId?: string;
  readonly retrievalOrdinal?: number;
  readonly retrievalSource?: 'INDEX' | 'WINDOW' | 'VECTOR' | 'HYBRID' | 'UNKNOWN';
}

export interface MemoryRankingContext {
  readonly nowMs?: number;
  readonly intent: MemoryAnchorQueryIntent;
  readonly queryText?: string;
  readonly requiredTags?: readonly string[];
  readonly blockedTags?: readonly string[];
  readonly targetKinds?: readonly MemoryAnchorKind[];
  readonly actorId?: string;
  readonly actorPersonaId?: string;
  readonly relationshipId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly emotionSignals?: readonly string[];
  readonly relationshipSignals?: readonly string[];
  readonly currentTags?: readonly string[];
  readonly currentModeId?: string;
  readonly topK?: number;
  readonly minimumScore?: number;
  readonly excludedAnchorIds?: readonly MemoryAnchorId[];
  readonly excludedFamilyIds?: readonly string[];
  readonly alreadyUsedCallbackPhrases?: readonly string[];
}

export interface MemoryRankingComponentTrace {
  readonly key: string;
  readonly value: number;
  readonly note?: string;
}

export interface MemoryRankingTrace {
  readonly anchorId: MemoryAnchorId;
  readonly totalScore: number;
  readonly retrievalScore: number;
  readonly thresholdScore: number;
  readonly passedThreshold: boolean;
  readonly components: readonly MemoryRankingComponentTrace[];
  readonly matchedTags: readonly string[];
  readonly blockedTags: readonly string[];
  readonly familyId?: string;
  readonly duplicatePenaltyApplied: boolean;
}

export interface RankedMemoryAnchor {
  readonly rank: number;
  readonly anchor: MemoryAnchor;
  readonly score: number;
  readonly retrievalScore: number;
  readonly finalScore: number;
  readonly thresholdScore: number;
  readonly matchedTags: readonly string[];
  readonly blockedTags: readonly string[];
  readonly trace: MemoryRankingTrace;
  readonly projection: MemoryAnchorMatch;
}

export interface MemoryRankingResult {
  readonly nowMs: number;
  readonly context: MemoryRankingContext;
  readonly totalCandidates: number;
  readonly returnedCount: number;
  readonly thresholdScore: number;
  readonly ranked: readonly RankedMemoryAnchor[];
  readonly traces: readonly MemoryRankingTrace[];
}

export interface MemoryRankingPolicyOptions {
  readonly weights?: Partial<MemoryRankingPolicyWeights>;
  readonly candidateCap?: number;
  readonly baseMinimumScore?: number;
  readonly halfLifeMs?: number;
}

export interface MemoryRankingPolicyApi {
  readonly version: typeof MEMORY_RANKING_POLICY_VERSION;
  readonly defaults: typeof MEMORY_RANKING_POLICY_DEFAULTS;
  readonly weights: Readonly<MemoryRankingPolicyWeights>;
  rank(
    candidates: readonly MemoryRankingCandidate[],
    context: MemoryRankingContext,
  ): MemoryRankingResult;
  scoreCandidate(
    candidate: MemoryRankingCandidate,
    context: MemoryRankingContext,
  ): RankedMemoryAnchor;
  projectMatch(
    ranked: Pick<
      RankedMemoryAnchor,
      'rank' | 'anchor' | 'score' | 'trace' | 'matchedTags' | 'blockedTags'
    >,
  ): MemoryAnchorMatch;
}

interface PreparedRankingContext {
  readonly nowMs: number;
  readonly thresholdScore: number;
  readonly requiredTags: readonly string[];
  readonly blockedTags: readonly string[];
  readonly currentTags: readonly string[];
  readonly emotionSignals: readonly string[];
  readonly relationshipSignals: readonly string[];
  readonly targetKinds: readonly MemoryAnchorKind[];
  readonly excludedAnchorIds: readonly MemoryAnchorId[];
  readonly excludedFamilyIds: readonly string[];
  readonly alreadyUsedCallbackPhrases: readonly string[];
  readonly queryTokens: readonly string[];
  readonly topK: number;
  readonly currentModeId?: string;
  readonly actorId?: string;
  readonly actorPersonaId?: string;
  readonly relationshipId?: string;
  readonly roomId?: string;
  readonly channelId?: string;
  readonly runId?: string;
  readonly sceneId?: string;
  readonly momentId?: string;
  readonly intent: MemoryAnchorQueryIntent;
  readonly queryText?: string;
}

export function createMemoryRankingPolicy(
  options: MemoryRankingPolicyOptions = {},
): MemoryRankingPolicyApi {
  const weights = createWeights(options.weights);

  const api: MemoryRankingPolicyApi = {
    version: MEMORY_RANKING_POLICY_VERSION,
    defaults: MEMORY_RANKING_POLICY_DEFAULTS,
    weights,

    rank(
      candidates: readonly MemoryRankingCandidate[],
      context: MemoryRankingContext,
    ): MemoryRankingResult {
      const prepared = prepareContext(context, options);
      const cap = Math.max(
        1,
        Math.floor(options.candidateCap ?? MEMORY_RANKING_POLICY_DEFAULTS.candidateCap),
      );

      const limitedCandidates = candidates.slice(0, cap);
      const scored = limitedCandidates.map((candidate) =>
        api.scoreCandidate(candidate, {
          ...context,
          nowMs: prepared.nowMs,
          topK: prepared.topK,
          minimumScore: prepared.thresholdScore,
        }),
      );

      const ranked = scored
        .filter((rankedCandidate) => rankedCandidate.trace.passedThreshold)
        .sort(compareRankedAnchors)
        .map((rankedCandidate, index) => {
          const rank = index + 1;
          const projection = api.projectMatch({
            rank,
            anchor: rankedCandidate.anchor,
            score: rankedCandidate.score,
            trace: rankedCandidate.trace,
            matchedTags: rankedCandidate.matchedTags,
            blockedTags: rankedCandidate.blockedTags,
          });

          return Object.freeze({
            ...rankedCandidate,
            rank,
            projection,
          });
        });

      const limited = Object.freeze(ranked.slice(0, prepared.topK));
      const traces = Object.freeze(
        scored
          .map((entry) => entry.trace)
          .sort((left, right) => {
            return (
              right.totalScore - left.totalScore ||
              right.retrievalScore - left.retrievalScore ||
              left.anchorId.localeCompare(right.anchorId)
            );
          }),
      );

      return Object.freeze({
        nowMs: prepared.nowMs,
        context: Object.freeze({
          ...context,
          nowMs: prepared.nowMs,
          minimumScore: prepared.thresholdScore,
          topK: prepared.topK,
        }),
        totalCandidates: limitedCandidates.length,
        returnedCount: limited.length,
        thresholdScore: prepared.thresholdScore,
        ranked: limited,
        traces,
      });
    },

    scoreCandidate(
      candidate: MemoryRankingCandidate,
      context: MemoryRankingContext,
    ): RankedMemoryAnchor {
      const anchor = candidate.anchor;
      const prepared = prepareContext(context, options);
      const anchorTags = collectAnchorTags(anchor);
      const candidateTags = collectCandidateTags(prepared, candidate);
      const matchedTags = intersectTags(anchorTags, candidateTags);
      const blockedTags = intersectTags(anchorTags, prepared.blockedTags);

      const components: MemoryRankingComponentTrace[] = [];
      const addComponent = (key: string, value: number, note?: string): number => {
        const normalized = round4(value);
        components.push(Object.freeze({ key, value: normalized, note }));
        return normalized;
      };

      const excludedByAnchorId = prepared.excludedAnchorIds.includes(anchor.id);
      const targetKindMismatch =
        prepared.targetKinds.length > 0 && !prepared.targetKinds.includes(anchor.kind);
      const duplicatePenaltyApplied = shouldApplyDuplicatePenalty(anchor, prepared);

      const baseSalience =
        clampUnit(anchor.salience.final) * weights.salience;
      addComponent(
        'salience.final',
        baseSalience,
        `anchor.salience.final=${round4(anchor.salience.final)}`,
      );

      const priorityWeight =
        priorityScore(anchor.retrieval.priority) * weights.priority;
      addComponent('retrieval.priority', priorityWeight, anchor.retrieval.priority);

      const intentAlignment =
        intentScore(anchor, prepared.intent) * weights.intent;
      addComponent('intent.alignment', intentAlignment, prepared.intent);

      const recency =
        recencyScore(anchor, prepared.nowMs, options.halfLifeMs) * weights.recency;
      addComponent('formation.recency', recency);

      const evidence =
        evidenceScore(anchor) * weights.evidence;
      addComponent('evidence.weight', evidence);

      const hitCount =
        normalizeCounter(
          anchor.formation.hitCount,
          MEMORY_RANKING_POLICY_DEFAULTS.hitCountNormalizer,
        ) * weights.hitCount;
      addComponent('formation.hitCount', hitCount);

      const reaffirm =
        normalizeCounter(
          anchor.formation.reaffirmCount,
          MEMORY_RANKING_POLICY_DEFAULTS.reaffirmCountNormalizer,
        ) * weights.reaffirm;
      addComponent('formation.reaffirmCount', reaffirm);

      const tagOverlap =
        tagOverlapScore(anchor, prepared, candidate, matchedTags, blockedTags) *
        weights.tagOverlap;
      addComponent('tags.overlap', tagOverlap, matchedTags.join(', ') || 'none');

      const embedding =
        embeddingScore(candidate.embeddingMatches, anchor) * weights.embedding;
      addComponent('embedding.match', embedding);

      const stability =
        stabilityScore(anchor.stabilityClass) * weights.stability;
      addComponent('stability.class', stability, anchor.stabilityClass);

      const relationship =
        relationshipScore(anchor, prepared, candidate) * weights.relationship;
      addComponent('relationship.signal', relationship);

      const emotion =
        emotionScore(anchor, prepared, candidate) * weights.emotion;
      addComponent('emotion.signal', emotion);

      const continuity =
        continuityScore(anchor, prepared, candidate) * weights.continuity;
      addComponent('continuity.signal', continuity);

      const scopeMatch =
        scopeScore(anchor, prepared, candidate) * weights.scopeMatch;
      addComponent('scope.match', scopeMatch);

      const callbacks =
        callbackScore(anchor, prepared) * weights.callbacks;
      addComponent('callback.signal', callbacks);

      const queryText =
        queryTextScore(anchor, prepared, candidate) * weights.queryText;
      addComponent(
        'query.text',
        queryText,
        prepared.queryText ? prepared.queryTokens.join(', ') || 'query' : 'no_query',
      );

      const retrievalSignal =
        retrievalSignalScore(candidate) * weights.retrievalSignal;
      addComponent(
        'retrieval.signal',
        retrievalSignal,
        `${candidate.retrievalSource ?? 'UNKNOWN'}:${candidate.retrievalOrdinal ?? 'na'}`,
      );

      const targetKindAlignment =
        targetKindScore(anchor, prepared) * weights.targetKind;
      addComponent(
        'target.kind',
        targetKindAlignment,
        prepared.targetKinds.length ? prepared.targetKinds.join(', ') : 'none',
      );

      const positiveScore =
        baseSalience +
        priorityWeight +
        intentAlignment +
        recency +
        evidence +
        hitCount +
        reaffirm +
        tagOverlap +
        embedding +
        stability +
        relationship +
        emotion +
        continuity +
        scopeMatch +
        callbacks +
        queryText +
        retrievalSignal +
        targetKindAlignment;

      const blockedPenalty = blockedTags.length
        ? MEMORY_RANKING_POLICY_DEFAULTS.blockedTagPenalty
        : 0;
      addComponent(
        'penalty.blockedTags',
        -blockedPenalty,
        blockedTags.join(', ') || undefined,
      );

      const requiredMissPenalty = requiredMissPenaltyScore(anchor, prepared);
      addComponent('penalty.requiredMiss', -requiredMissPenalty);

      const duplicatePenalty = excludedByAnchorId
        ? MEMORY_RANKING_POLICY_DEFAULTS.duplicateAnchorPenalty
        : duplicatePenaltyApplied
          ? MEMORY_RANKING_POLICY_DEFAULTS.duplicateFamilyPenalty
          : 0;
      addComponent(
        'penalty.duplicate',
        -duplicatePenalty,
        excludedByAnchorId ? 'excluded-anchor-id' : duplicatePenaltyApplied ? 'duplicate-family' : undefined,
      );

      const targetKindPenalty = targetKindMismatch
        ? MEMORY_RANKING_POLICY_DEFAULTS.targetKindMismatchPenalty
        : 0;
      addComponent(
        'penalty.targetKindMismatch',
        -targetKindPenalty,
        targetKindMismatch ? anchor.kind : undefined,
      );

      const gatedOut = excludedByAnchorId;
      addComponent(
        'gate.excludedAnchor',
        gatedOut ? -1 : 0,
        gatedOut ? anchor.id : undefined,
      );

      const unclampedTotal =
        positiveScore -
        blockedPenalty -
        requiredMissPenalty -
        duplicatePenalty -
        targetKindPenalty;

      const totalScore = gatedOut ? 0 : clampUnit(unclampedTotal);

      const retrievalScore = gatedOut
        ? 0
        : clampUnit(
            (
              priorityWeight +
              intentAlignment +
              embedding +
              continuity +
              relationship +
              emotion +
              queryText +
              retrievalSignal
            ) /
              maxSafe(
                weights.priority +
                  weights.intent +
                  weights.embedding +
                  weights.continuity +
                  weights.relationship +
                  weights.emotion +
                  weights.queryText +
                  weights.retrievalSignal,
                0.0001,
              ),
          );

      const trace: MemoryRankingTrace = Object.freeze({
        anchorId: anchor.id,
        totalScore: round4(totalScore),
        retrievalScore: round4(retrievalScore),
        thresholdScore: round4(prepared.thresholdScore),
        passedThreshold: totalScore >= prepared.thresholdScore,
        components: Object.freeze(components),
        matchedTags: Object.freeze(matchedTags),
        blockedTags: Object.freeze(blockedTags),
        familyId: anchor.continuity.familyId,
        duplicatePenaltyApplied,
      });

      const ranked: RankedMemoryAnchor = Object.freeze({
        rank: 0,
        anchor,
        score: totalScore,
        retrievalScore,
        finalScore: totalScore,
        thresholdScore: prepared.thresholdScore,
        matchedTags: Object.freeze(matchedTags),
        blockedTags: Object.freeze(blockedTags),
        trace,
        projection: api.projectMatch({
          rank: 0,
          anchor,
          score: totalScore,
          trace,
          matchedTags,
          blockedTags,
        }),
      });

      return ranked;
    },

    projectMatch(
      ranked: Pick<
        RankedMemoryAnchor,
        'rank' | 'anchor' | 'score' | 'trace' | 'matchedTags' | 'blockedTags'
      >,
    ): MemoryAnchorMatch {
      const anchor = ranked.anchor;
      return Object.freeze({
        rank: ranked.rank,
        anchorId: anchor.id,
        kind: anchor.kind,
        stabilityClass: anchor.stabilityClass,
        priority: anchor.retrieval.priority,
        headline: anchor.payload.headline,
        summary: anchor.payload.summary,
        finalSalience: round4(anchor.salience.final),
        retrievalScore: round4(ranked.trace.retrievalScore),
        evidenceWeight: round4(totalEvidenceWeight(anchor)),
        continuityBoost: round4(
          continuityScore(
            anchor,
            Object.freeze({
              nowMs: 0,
              thresholdScore: 0,
              requiredTags: Object.freeze([]),
              blockedTags: Object.freeze([]),
              currentTags: Object.freeze([]),
              emotionSignals: Object.freeze([]),
              relationshipSignals: Object.freeze([]),
              targetKinds: Object.freeze([]),
              excludedAnchorIds: Object.freeze([]),
              excludedFamilyIds: Object.freeze([]),
              alreadyUsedCallbackPhrases: Object.freeze([]),
              queryTokens: Object.freeze([]),
              topK: MEMORY_RANKING_POLICY_DEFAULTS.topK,
              intent: 'CALLBACK',
            }),
            Object.freeze({ anchor }),
          ),
        ),
        reaffirmCount: anchor.formation.reaffirmCount,
        quoteRefs: Object.freeze([...anchor.quoteRefs]),
        relationshipRefs: Object.freeze([...anchor.relationshipRefs]),
        matchedTags: Object.freeze(ranked.matchedTags),
      });
    },
  };

  return Object.freeze(api);
}

function createWeights(
  overrides: Partial<MemoryRankingPolicyWeights> | undefined,
): Readonly<MemoryRankingPolicyWeights> {
  return Object.freeze({
    salience: overrides?.salience ?? 0.15,
    priority: overrides?.priority ?? 0.1,
    intent: overrides?.intent ?? 0.12,
    recency: overrides?.recency ?? 0.07,
    evidence: overrides?.evidence ?? 0.05,
    hitCount: overrides?.hitCount ?? 0.05,
    reaffirm: overrides?.reaffirm ?? 0.04,
    tagOverlap: overrides?.tagOverlap ?? 0.07,
    embedding: overrides?.embedding ?? 0.09,
    stability: overrides?.stability ?? 0.05,
    relationship: overrides?.relationship ?? 0.05,
    emotion: overrides?.emotion ?? 0.04,
    continuity: overrides?.continuity ?? 0.04,
    scopeMatch: overrides?.scopeMatch ?? 0.03,
    callbacks: overrides?.callbacks ?? 0.03,
    queryText: overrides?.queryText ?? 0.04,
    retrievalSignal: overrides?.retrievalSignal ?? 0.04,
    targetKind: overrides?.targetKind ?? 0.02,
  });
}

function prepareContext(
  context: MemoryRankingContext,
  options: MemoryRankingPolicyOptions,
): PreparedRankingContext {
  const nowMs = normalizeNow(context.nowMs);
  const thresholdScore = clampUnit(
    context.minimumScore ??
      options.baseMinimumScore ??
      MEMORY_RANKING_POLICY_DEFAULTS.baseMinimumScore,
  );
  const topK = Math.max(
    1,
    Math.floor(context.topK ?? MEMORY_RANKING_POLICY_DEFAULTS.topK),
  );

  return Object.freeze({
    nowMs,
    thresholdScore,
    requiredTags: normalizeStringList(context.requiredTags ?? []),
    blockedTags: normalizeStringList(context.blockedTags ?? []),
    currentTags: normalizeStringList(context.currentTags ?? []),
    emotionSignals: normalizeStringList(context.emotionSignals ?? []),
    relationshipSignals: normalizeStringList(context.relationshipSignals ?? []),
    targetKinds: Object.freeze([...(context.targetKinds ?? [])]),
    excludedAnchorIds: Object.freeze([...(context.excludedAnchorIds ?? [])]),
    excludedFamilyIds: normalizeStringList(context.excludedFamilyIds ?? []),
    alreadyUsedCallbackPhrases: normalizeStringList(
      context.alreadyUsedCallbackPhrases ?? [],
    ),
    queryTokens: tokenizeText(context.queryText),
    topK,
    currentModeId: normalizeOptionalToken(context.currentModeId),
    actorId: normalizeOptionalToken(context.actorId),
    actorPersonaId: normalizeOptionalToken(context.actorPersonaId),
    relationshipId: normalizeOptionalToken(context.relationshipId),
    roomId: normalizeOptionalToken(context.roomId),
    channelId: normalizeOptionalToken(context.channelId),
    runId: normalizeOptionalToken(context.runId),
    sceneId: normalizeOptionalToken(context.sceneId),
    momentId: normalizeOptionalToken(context.momentId),
    intent: context.intent,
    queryText: context.queryText,
  });
}

function priorityScore(priority: MemoryAnchorRetrievalPriority): number {
  return MEMORY_RANKING_POLICY_PRIORITY_WEIGHT[priority] ?? 0.5;
}

function stabilityScore(stability: MemoryAnchorStabilityClass): number {
  return MEMORY_RANKING_POLICY_STABILITY_WEIGHT[stability] ?? 0.5;
}

function intentScore(anchor: MemoryAnchor, intent: MemoryAnchorQueryIntent): number {
  const declaredMatch = anchor.retrieval.queryIntents.includes(intent) ? 1 : 0;
  const semanticBias = MEMORY_RANKING_POLICY_INTENT_WEIGHT[intent] ?? 0.5;

  if (declaredMatch >= 1) {
    return clampUnit(semanticBias + 0.14);
  }

  switch (intent) {
    case 'CALLBACK':
      return clampUnit(
        semanticBias *
          (anchor.payload.callbackPhrases.length > 0 || anchor.quoteRefs.length > 0
            ? 0.9
            : 0.44),
      );
    case 'RESCUE':
      return clampUnit(
        semanticBias *
          (anchor.kind === 'RESCUE' || anchor.salience.rescue > 0.45 ? 0.98 : 0.25),
      );
    case 'TAUNT':
      return clampUnit(
        semanticBias *
          (anchor.kind === 'QUOTE_REVERSAL' ||
          anchor.kind === 'EMBARRASSMENT' ||
          anchor.kind === 'RIVALRY_ESCALATION'
            ? 0.96
            : 0.28),
      );
    case 'CELEBRATION':
      return clampUnit(
        semanticBias *
          (anchor.kind === 'COMEBACK' || anchor.kind === 'LEGEND' ? 0.96 : 0.31),
      );
    case 'RELATIONSHIP_CONTEXT':
      return clampUnit(
        semanticBias *
          (anchor.relationshipRefs.length > 0 || anchor.salience.relationship > 0.4
            ? 0.92
            : 0.24),
      );
    case 'DEALROOM_CONTEXT':
      return clampUnit(
        semanticBias *
          (anchor.kind === 'DEALROOM_BLUFF' || anchor.kind === 'DEALROOM_EXPOSURE'
            ? 1
            : 0.2),
      );
    case 'POSTRUN_CONTEXT':
      return clampUnit(
        semanticBias *
          (anchor.kind === 'TURNING_POINT' ||
          anchor.kind === 'COLLAPSE' ||
          anchor.kind === 'COMEBACK'
            ? 0.88
            : 0.24),
      );
    case 'LIVEOPS_CONTEXT':
      return clampUnit(
        semanticBias *
          (anchor.kind === 'WORLD_EVENT' || anchor.kind === 'LEGEND' ? 0.82 : 0.2),
      );
    case 'RANKING_CONTEXT':
    default:
      return clampUnit(semanticBias * 0.54);
  }
}

function recencyScore(
  anchor: MemoryAnchor,
  nowMs: number,
  overrideHalfLifeMs?: number,
): number {
  const updatedAtMs = Math.max(
    anchor.formation.updatedAtMs || 0,
    anchor.formation.reaffirmedAtMs || 0,
    anchor.formation.createdAtMs || 0,
  );

  if (!updatedAtMs || updatedAtMs > nowMs) {
    return MEMORY_RANKING_POLICY_DEFAULTS.coldStartFallback;
  }

  const ageMs = Math.max(0, nowMs - updatedAtMs);
  const halfLifeMs =
    anchor.retrieval.timeDecayHalfLifeMs ??
    overrideHalfLifeMs ??
    MEMORY_RANKING_POLICY_DEFAULTS.halfLifeMs;
  const decay = Math.pow(0.5, ageMs / maxSafe(halfLifeMs, 1));

  return clampUnit(decay);
}

function evidenceScore(anchor: MemoryAnchor): number {
  const capped = Math.min(
    totalEvidenceWeight(anchor),
    MEMORY_RANKING_POLICY_DEFAULTS.evidenceWeightCap,
  );
  return clampUnit(capped);
}

function totalEvidenceWeight(anchor: MemoryAnchor): number {
  if (!anchor.evidence.length) {
    return 0;
  }

  const total = anchor.evidence.reduce((sum, evidence) => {
    return sum + clampUnit(evidence.weight);
  }, 0);

  return total / anchor.evidence.length;
}

function normalizeCounter(value: number, normalizer: number): number {
  return clampUnit(Math.max(0, value) / maxSafe(normalizer, 1));
}

function tagOverlapScore(
  anchor: MemoryAnchor,
  context: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
  matchedTags: readonly string[],
  blockedTags: readonly string[],
): number {
  if (blockedTags.length) {
    return 0;
  }

  const targetTags = collectCandidateTags(context, candidate);
  if (!targetTags.length) {
    return matchedTags.length ? 0.5 : 0.36;
  }

  const directRequiredOverlap = intersectTags(
    collectAnchorTags(anchor),
    context.requiredTags,
  ).length;

  const overlapRatio = matchedTags.length / maxSafe(targetTags.length, 1);
  const requiredBias = context.requiredTags.length
    ? directRequiredOverlap / maxSafe(context.requiredTags.length, 1)
    : 0;

  return clampUnit(overlapRatio * 0.84 + requiredBias * 0.16);
}

function embeddingScore(
  matches: readonly MemoryRankingEmbeddingMatch[] | undefined,
  anchor: MemoryAnchor,
): number {
  if (!matches?.length) {
    return anchor.embeddingDocumentIds.length ? 0.32 : 0;
  }

  let best = 0;

  for (const match of matches) {
    const kindWeight =
      MEMORY_RANKING_POLICY_MATCH_KIND_WEIGHT[
        normalizeToken(match.kind) || 'UNKNOWN'
      ] ?? MEMORY_RANKING_POLICY_MATCH_KIND_WEIGHT.UNKNOWN;
    const rawScore = clampUnit(match.score ?? 0);
    const documentBoost =
      match.documentId &&
      anchor.embeddingDocumentIds.includes(
        match.documentId as import('../../../../../../../shared/contracts/chat/learning/ConversationEmbeddings').EmbeddingDocumentId,
      )
        ? 0.12
        : 0;
    const overlapBoost = intersectTags(
      normalizeStringList(match.tags ?? []),
      collectAnchorTags(anchor),
    ).length
      ? 0.08
      : 0;
    const previewBoost =
      match.preview && textOverlapScore(tokenizeText(match.preview), collectAnchorSearchCorpus(anchor)) > 0.18
        ? 0.05
        : 0;

    best = Math.max(
      best,
      clampUnit(rawScore * kindWeight + documentBoost + overlapBoost + previewBoost),
    );
  }

  return clampUnit(best);
}

function relationshipScore(
  anchor: MemoryAnchor,
  context: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): number {
  let score = 0;

  if (context.relationshipId && normalizeOptionalToken(anchor.subject.relationshipId) === context.relationshipId) {
    score += 0.52;
  }

  const targetSignals = normalizeStringList([
    ...context.relationshipSignals,
    ...(candidate.relationshipSignals ?? []),
  ]);

  if (targetSignals.length) {
    const overlap = intersectTags(
      normalizeStringList(anchor.payload.relationshipTags),
      targetSignals,
    );

    score += overlap.length
      ? (overlap.length / targetSignals.length) *
        MEMORY_RANKING_POLICY_DEFAULTS.relationshipBoost
      : 0;
  }

  if (
    context.actorPersonaId &&
    normalizeOptionalToken(anchor.subject.actorPersonaId) === context.actorPersonaId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.exactActorPersonaBoost;
  }

  if (anchor.salience.relationship > 0.5) {
    score += 0.18;
  }

  return clampUnit(score);
}

function emotionScore(
  anchor: MemoryAnchor,
  context: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): number {
  const signals = normalizeStringList([
    ...context.emotionSignals,
    ...(candidate.emotionSignals ?? []),
  ]);

  if (!signals.length) {
    return anchor.payload.emotions.length ? 0.2 : 0;
  }

  const overlap = intersectTags(normalizeStringList(anchor.payload.emotions), signals);
  const ratio = overlap.length / maxSafe(signals.length, 1);
  const salienceBias = clampUnit(anchor.salience.emotional);

  return clampUnit(ratio * 0.78 + salienceBias * 0.22);
}

function continuityScore(
  anchor: MemoryAnchor,
  context: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): number {
  let score = 0;
  const candidateModeId = normalizeOptionalToken(candidate.currentModeId);

  if (
    anchor.continuity.carriesAcrossModes &&
    context.currentModeId &&
    candidateModeId &&
    context.currentModeId === candidateModeId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.currentModeBoost;
  } else if (anchor.continuity.carriesAcrossModes && context.currentModeId) {
    score += 0.16;
  }

  if (anchor.continuity.carriesAcrossRuns && context.runId) {
    score += 0.18;
  }

  if (anchor.continuity.unresolved) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.unresolvedBoost;
  }

  if (context.excludedFamilyIds.length && anchor.continuity.familyId) {
    score += context.excludedFamilyIds.includes(normalizeToken(anchor.continuity.familyId))
      ? -0.2
      : 0;
  }

  if (anchor.continuity.followPersonaIds.length && context.actorPersonaId) {
    const normalizedFollowPersonaIds = normalizeStringList(anchor.continuity.followPersonaIds);
    score += normalizedFollowPersonaIds.includes(context.actorPersonaId) ? 0.14 : 0;
  }

  if (context.momentId && normalizeOptionalToken(anchor.subject.momentId) === context.momentId) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.momentMatchBoost;
  }

  if (context.sceneId && normalizeOptionalToken(anchor.subject.sceneId) === context.sceneId) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.sceneMatchBoost;
  }

  return clampUnit(score);
}

function scopeScore(
  anchor: MemoryAnchor,
  context: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): number {
  let score = 0;

  if (context.roomId && normalizeOptionalToken(anchor.subject.roomId) === context.roomId) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.roomMatchBoost;
  }

  if (context.channelId && normalizeOptionalToken(anchor.subject.channelId) === context.channelId) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.channelMatchBoost;
  }

  if (context.runId && normalizeOptionalToken(anchor.subject.runId) === context.runId) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.runMatchBoost;
  }

  if (context.sceneId && normalizeOptionalToken(anchor.subject.sceneId) === context.sceneId) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.sceneMatchBoost;
  }

  if (context.momentId && normalizeOptionalToken(anchor.subject.momentId) === context.momentId) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.momentMatchBoost;
  }

  if (context.actorId && normalizeOptionalToken(anchor.subject.actorId) === context.actorId) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.actorMatchBoost;
  }

  const candidateModeId = normalizeOptionalToken(candidate.currentModeId);
  if (candidateModeId && context.currentModeId && candidateModeId === context.currentModeId) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.currentModeBoost;
  }

  return clampUnit(score);
}

function callbackScore(anchor: MemoryAnchor, context: PreparedRankingContext): number {
  let score = 0;

  if (anchor.payload.callbackPhrases.length) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.callbackPhraseBoost;
  }

  if (anchor.quoteRefs.length) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.quoteBoost;
  }

  if (context.alreadyUsedCallbackPhrases.length && anchor.payload.callbackPhrases.length) {
    const normalizedCallbackPhrases = normalizeStringList(anchor.payload.callbackPhrases);
    const unused = normalizedCallbackPhrases.filter((phrase) => {
      return !context.alreadyUsedCallbackPhrases.includes(phrase);
    });
    score += unused.length ? 0.08 : -0.16;
  }

  return clampUnit(score);
}

function requiredMissPenaltyScore(
  anchor: MemoryAnchor,
  context: PreparedRankingContext,
): number {
  const requiredTags = context.requiredTags;
  if (!requiredTags.length) {
    return 0;
  }

  const overlap = intersectTags(collectAnchorTags(anchor), requiredTags);
  if (overlap.length === requiredTags.length) {
    return 0;
  }

  return (
    MEMORY_RANKING_POLICY_DEFAULTS.requiredTagMissPenalty *
    ((requiredTags.length - overlap.length) / requiredTags.length)
  );
}

function retrievalSignalScore(candidate: MemoryRankingCandidate): number {
  const retrievalSourceWeight =
    MEMORY_RANKING_POLICY_RETRIEVAL_SOURCE_WEIGHT[
      candidate.retrievalSource ?? 'UNKNOWN'
    ] ?? MEMORY_RANKING_POLICY_RETRIEVAL_SOURCE_WEIGHT.UNKNOWN;

  const ordinal = Number.isFinite(candidate.retrievalOrdinal)
    ? Math.max(0, Math.floor(candidate.retrievalOrdinal as number))
    : MEMORY_RANKING_POLICY_DEFAULTS.retrievalOrdinalSpan;

  const ordinalRatio =
    1 -
    Math.min(ordinal, MEMORY_RANKING_POLICY_DEFAULTS.retrievalOrdinalSpan) /
      maxSafe(MEMORY_RANKING_POLICY_DEFAULTS.retrievalOrdinalSpan, 1);

  return clampUnit(
    retrievalSourceWeight * MEMORY_RANKING_POLICY_DEFAULTS.retrievalSourceBoost +
      ordinalRatio * MEMORY_RANKING_POLICY_DEFAULTS.retrievalOrdinalBoost,
  );
}

function targetKindScore(
  anchor: MemoryAnchor,
  context: PreparedRankingContext,
): number {
  if (!context.targetKinds.length) {
    return 0.5;
  }

  return context.targetKinds.includes(anchor.kind) ? 1 : 0;
}

function queryTextScore(
  anchor: MemoryAnchor,
  context: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): number {
  if (!context.queryTokens.length) {
    return MEMORY_RANKING_POLICY_DEFAULTS.queryTextFallback;
  }

  const anchorCorpus = collectAnchorSearchCorpus(anchor);
  const baseOverlap = textOverlapScore(context.queryTokens, anchorCorpus);

  const embeddingPreviewCorpus = normalizeStringList(
    (candidate.embeddingMatches ?? []).flatMap((match) => {
      return [
        ...(match.tags ?? []),
        ...(tokenizeText(match.preview) ?? []),
      ];
    }),
  );

  const previewOverlap = textOverlapScore(context.queryTokens, embeddingPreviewCorpus);

  return clampUnit(baseOverlap * 0.82 + previewOverlap * 0.18);
}

function shouldApplyDuplicatePenalty(
  anchor: MemoryAnchor,
  context: PreparedRankingContext,
): boolean {
  return Boolean(
    anchor.continuity.familyId &&
      context.excludedFamilyIds.includes(normalizeToken(anchor.continuity.familyId)),
  );
}

function collectAnchorTags(anchor: MemoryAnchor): readonly string[] {
  return normalizeStringList([
    ...anchor.payload.tags,
    ...anchor.payload.emotions,
    ...anchor.payload.relationshipTags,
    ...anchor.retrieval.requiredTags,
    ...anchor.quoteRefs,
    ...anchor.relationshipRefs,
    anchor.kind,
    anchor.stabilityClass,
    anchor.retrieval.priority,
    anchor.subject.roomId,
    anchor.subject.channelId,
    anchor.subject.runId,
    anchor.subject.sceneId,
    anchor.subject.momentId,
    anchor.subject.actorId,
    anchor.subject.actorPersonaId,
    anchor.subject.relationshipId,
    anchor.continuity.familyId,
    ...anchor.continuity.followPersonaIds,
    ...anchor.retrieval.queryIntents,
  ]);
}

function collectAnchorSearchCorpus(anchor: MemoryAnchor): readonly string[] {
  const p = anchor.payload as any;
  return normalizeStringList([
    ...tokenizeText(anchor.payload.headline),
    ...tokenizeText(anchor.payload.summary),
    ...tokenizeText(p.body),
    ...tokenizeText(p.resolution),
    ...tokenizeText(p.outcome),
    ...tokenizeText(p.lessonsLearned),
    ...tokenizeText(p.worldStateHint),
    ...anchor.payload.callbackPhrases,
    ...anchor.payload.tags,
    ...anchor.payload.emotions,
    ...anchor.payload.relationshipTags,
    ...anchor.quoteRefs,
    ...anchor.relationshipRefs,
    anchor.kind,
    anchor.stabilityClass,
    anchor.retrieval.priority,
    ...anchor.retrieval.queryIntents,
  ]);
}

function collectCandidateTags(
  context: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): readonly string[] {
  return normalizeStringList([
    ...context.requiredTags,
    ...context.currentTags,
    ...(candidate.currentTags ?? []),
    ...context.relationshipSignals,
    ...(candidate.relationshipSignals ?? []),
    ...context.emotionSignals,
    ...(candidate.emotionSignals ?? []),
    context.currentModeId,
    candidate.currentModeId,
    context.roomId,
    context.channelId,
    context.runId,
    context.sceneId,
    context.momentId,
    context.actorId,
    context.actorPersonaId,
    context.relationshipId,
    ...(candidate.embeddingMatches ?? []).flatMap((match) => {
      return [match.kind, ...(match.tags ?? [])];
    }),
  ]);
}

function intersectTags(
  left: readonly string[],
  right: readonly string[],
): readonly string[] {
  if (!left.length || !right.length) {
    return Object.freeze([]);
  }

  const rightSet = new Set(right.map(normalizeToken).filter(Boolean));
  const intersection = left
    .map(normalizeToken)
    .filter((token): token is string => Boolean(token && rightSet.has(token)));

  return Object.freeze(Array.from(new Set(intersection)));
}

function textOverlapScore(
  left: readonly string[],
  right: readonly string[],
): number {
  if (!left.length || !right.length) {
    return 0;
  }

  const overlap = intersectTags(left, right);
  const precision = overlap.length / maxSafe(left.length, 1);
  const recall = overlap.length / maxSafe(right.length, 1);

  return clampUnit(precision * 0.72 + recall * 0.28);
}

function compareRankedAnchors(
  left: RankedMemoryAnchor,
  right: RankedMemoryAnchor,
): number {
  return (
    right.finalScore - left.finalScore ||
    right.retrievalScore - left.retrievalScore ||
    right.anchor.salience.final - left.anchor.salience.final ||
    right.anchor.formation.updatedAtMs - left.anchor.formation.updatedAtMs ||
    right.anchor.formation.createdAtMs - left.anchor.formation.createdAtMs ||
    left.anchor.id.localeCompare(right.anchor.id)
  );
}

function tokenizeText(value: string | undefined | null): readonly string[] {
  if (!value) {
    return Object.freeze([]);
  }

  const normalized = value
    .toLowerCase()
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[^a-z0-9:_ -]/g, ' ')
    .split(/\s+/g)
    .map((token) => normalizeToken(token))
    .filter((token): token is string => Boolean(token && token.length >= 2));

  return Object.freeze(Array.from(new Set(normalized)));
}

function normalizeStringList(
  values: readonly (string | undefined | null)[],
): readonly string[] {
  const normalized = values
    .map((value) => normalizeToken(value))
    .filter((value): value is string => Boolean(value));

  return Object.freeze(Array.from(new Set(normalized)));
}

function normalizeOptionalToken(value: string | undefined | null): string | undefined {
  const normalized = normalizeToken(value);
  return normalized || undefined;
}

function normalizeToken(value: string | undefined | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9:_-]/g, '');
}

function normalizeNow(nowMs: number | undefined): number {
  return Number.isFinite(nowMs) ? Math.max(0, Math.floor(nowMs as number)) : Date.now();
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function maxSafe(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
