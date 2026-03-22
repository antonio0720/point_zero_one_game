/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT RETRIEVAL RANKING AUTHORITY
 * FILE: backend/src/game/engine/chat/intelligence/dl/MemoryRankingPolicy.ts
 * VERSION: 2026.03.22-retrieval-continuity.v3
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
 * - It preserves contract truth by using MemoryAnchors contract factories for
 *   query, match, receipt, baseline scoring, and preview derivation.
 * ============================================================================
 */

import type { JsonValue } from '../../types';
import type {
  MemoryAnchor,
  MemoryAnchorId,
  MemoryAnchorKind,
  MemoryAnchorMatch,
  MemoryAnchorQuery,
  MemoryAnchorQueryIntent,
  MemoryAnchorReceipt,
  MemoryAnchorRetrievalPriority,
  MemoryAnchorStabilityClass,
} from '../../../../../../../shared/contracts/chat/learning/MemoryAnchors';

import {
  computeAnchorTagScore,
  computeMemoryAnchorEvidenceWeight,
  createMemoryAnchorMatch,
  createMemoryAnchorPreview,
  createMemoryAnchorQuery,
  createMemoryAnchorReceipt,
  inferAnchorPurpose,
  memoryAnchorHasTag,
  rankMemoryAnchors,
  scoreMemoryAnchorMatch,
  summarizeMemoryAnchorMatch,
} from '../../../../../../../shared/contracts/chat/learning/MemoryAnchors';

export const MEMORY_RANKING_POLICY_VERSION =
  '2026.03.22-retrieval-continuity.v3' as const;

export type MemoryRankingRetrievalSource =
  | 'INDEX'
  | 'WINDOW'
  | 'VECTOR'
  | 'HYBRID'
  | 'BASELINE'
  | 'SHADOW'
  | 'UNKNOWN';

export type MemoryRankingLane =
  | 'GENERAL'
  | 'CALLBACK'
  | 'RESCUE'
  | 'TAUNT'
  | 'CELEBRATION'
  | 'RELATIONSHIP'
  | 'DEALROOM'
  | 'POSTRUN'
  | 'LIVEOPS'
  | 'RANKING';

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
  readonly baseline: number;
  readonly mode: number;
  readonly family: number;
  readonly purpose: number;
  readonly evidenceVariety: number;
  readonly proofDensity: number;
  readonly freshnessWindow: number;
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
  readonly currentStageMood?: string;
  readonly currentPhaseId?: string;
  readonly retrievalOrdinal?: number;
  readonly retrievalSource?: MemoryRankingRetrievalSource;
  readonly lane?: MemoryRankingLane;
  readonly sourceWindowId?: string;
  readonly windowAnchorIds?: readonly MemoryAnchorId[];
  readonly shadowSignals?: readonly string[];
  readonly pressureSignals?: readonly string[];
  readonly reputationSignals?: readonly string[];
  readonly audienceSignals?: readonly string[];
  readonly authoredHints?: readonly string[];
  readonly strategyTags?: readonly string[];
  readonly evidenceHints?: readonly string[];
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
  readonly currentStageMood?: string;
  readonly currentPhaseId?: string;
  readonly topK?: number;
  readonly minimumScore?: number;
  readonly excludedAnchorIds?: readonly MemoryAnchorId[];
  readonly excludedFamilyIds?: readonly string[];
  readonly alreadyUsedCallbackPhrases?: readonly string[];
  readonly preferredLane?: MemoryRankingLane;
  readonly requiredPurposes?: readonly string[];
  readonly blockedPurposes?: readonly string[];
  readonly desiredRetrievalSources?: readonly MemoryRankingRetrievalSource[];
  readonly disfavoredRetrievalSources?: readonly MemoryRankingRetrievalSource[];
  readonly diversityByFamilyCap?: number;
  readonly diversityByKindCap?: number;
  readonly preferUnresolved?: boolean;
  readonly allowShadowCandidates?: boolean;
  readonly requireEvidence?: boolean;
  readonly baselineCrossCheckEnabled?: boolean;
  readonly proofPressure?: number;
  readonly humiliationPressure?: number;
  readonly hypePressure?: number;
  readonly urgencyPressure?: number;
  readonly sceneIntensity?: number;
  readonly liveopsHeat?: number;
  readonly authoredHints?: readonly string[];
  readonly strategyTags?: readonly string[];
  readonly evidenceHints?: readonly string[];
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
  readonly canonicalScore: number;
  readonly canonicalRankHint?: number;
  readonly preview: string;
  readonly summary: string;
  readonly lane: MemoryRankingLane;
  readonly retrievalSource: MemoryRankingRetrievalSource;
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
  readonly baselineMatches: readonly MemoryAnchorMatch[];
  readonly canonicalQuery: MemoryAnchorQuery;
  readonly receipt: MemoryAnchorReceipt;
}

export interface MemoryRankingPolicyOptions {
  readonly weights?: Partial<MemoryRankingPolicyWeights>;
  readonly candidateCap?: number;
  readonly baseMinimumScore?: number;
  readonly halfLifeMs?: number;
  readonly canonicalBaselineTopK?: number;
  readonly diversityByFamilyCap?: number;
  readonly diversityByKindCap?: number;
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
    context?: MemoryRankingContext,
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
  readonly preferredLane: MemoryRankingLane;
  readonly topK: number;
  readonly currentModeId?: string;
  readonly currentStageMood?: string;
  readonly currentPhaseId?: string;
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
  readonly requiredPurposes: readonly string[];
  readonly blockedPurposes: readonly string[];
  readonly desiredRetrievalSources: readonly MemoryRankingRetrievalSource[];
  readonly disfavoredRetrievalSources: readonly MemoryRankingRetrievalSource[];
  readonly diversityByFamilyCap: number;
  readonly diversityByKindCap: number;
  readonly preferUnresolved: boolean;
  readonly allowShadowCandidates: boolean;
  readonly requireEvidence: boolean;
  readonly baselineCrossCheckEnabled: boolean;
  readonly proofPressure: number;
  readonly humiliationPressure: number;
  readonly hypePressure: number;
  readonly urgencyPressure: number;
  readonly sceneIntensity: number;
  readonly liveopsHeat: number;
  readonly authoredHints: readonly string[];
  readonly strategyTags: readonly string[];
  readonly evidenceHints: readonly string[];
}

interface InternalRankedMemoryAnchor extends RankedMemoryAnchor {
  readonly lane: MemoryRankingLane;
  readonly retrievalSource: MemoryRankingRetrievalSource;
  readonly canonicalScore: number;
  readonly canonicalRankHint?: number;
  readonly purpose: string;
  readonly familyId?: string;
  readonly kindKey: string;
}

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

export const MEMORY_RANKING_POLICY_RETRIEVAL_SOURCE_WEIGHT = Object.freeze<
  Record<MemoryRankingRetrievalSource, number>
>({
  INDEX: 0.66,
  WINDOW: 0.58,
  VECTOR: 0.74,
  HYBRID: 0.92,
  BASELINE: 0.62,
  SHADOW: 0.61,
  UNKNOWN: 0.4,
});

export const MEMORY_RANKING_POLICY_DEFAULTS = Object.freeze({
  topK: 6,
  candidateCap: 128,
  canonicalBaselineTopK: 10,
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
  blockedPurposePenalty: 0.35,
  requiredTagMissPenalty: 0.35,
  coldStartFallback: 0.42,
  targetKindMismatchPenalty: 0.32,
  queryTextFallback: 0.18,
  retrievalOrdinalSpan: 24,
  retrievalOrdinalBoost: 0.1,
  retrievalSourceBoost: 0.12,
  currentModeBoost: 0.08,
  exactActorPersonaBoost: 0.1,
  shadowPenalty: 0.12,
  missingEvidencePenalty: 0.18,
  familyDiversityCap: 2,
  kindDiversityCap: 2,
  minimumCanonicalScore: 0.18,
  canonicalBackstopBoost: 0.08,
  canonicalDisagreementPenalty: 0.1,
  proofPressureBoost: 0.08,
  humiliationPressureBoost: 0.1,
  hypePressureBoost: 0.08,
  urgencyPressureBoost: 0.07,
  sceneIntensityBoost: 0.07,
  liveopsHeatBoost: 0.05,
  authoredHintBoost: 0.05,
  strategyTagBoost: 0.04,
  evidenceHintBoost: 0.04,
  familyContinuationBoost: 0.08,
  predecessorSuccessorBoost: 0.08,
  purposeMatchBoost: 0.09,
  evidenceVarietyBoost: 0.08,
  proofDensityBoost: 0.07,
  freshnessWindowMs: 1000 * 60 * 4,
  freshnessWindowBoost: 0.08,
  laneBiasBoost: 0.06,
  modeMoodBoost: 0.06,
  baselineRankBoost: 0.08,
});

export const MEMORY_RANKING_POLICY_KIND_WEIGHT = Object.freeze<Readonly<Record<string, number>>>({
  'QUOTE_REVERSAL': 0.95,
  'RELATIONSHIP_SHIFT': 0.82,
  'TRUST_GAIN': 0.79,
  'TRUST_LOSS': 0.83,
  'ATTACHMENT': 0.76,
  'RIVALRY_ESCALATION': 0.91,
  'RIVALRY_SOFTENING': 0.73,
  'PRESSURE_SPIKE': 0.9,
  'INTIMIDATION': 0.87,
  'EMBARRASSMENT': 0.85,
  'LEGEND': 0.81,
  'RESCUE': 0.96,
  'COMEBACK': 0.89,
  'DEALROOM_BLUFF': 0.92,
  'DEALROOM_EXPOSURE': 0.94,
  'TURNING_POINT': 0.84,
  'COLLAPSE': 0.9,
  'WORLD_EVENT': 0.77,
  'DEALROOM_LOCK': 0.93,
  'DEALROOM_CRACK': 0.91,
  'DEALROOM_LEVERAGE': 0.9,
  'PROOF_DROP': 0.88,
  'SOCIAL_PIVOT': 0.8,
  'HUMILIATION': 0.86,
  'WITNESS_SPIKE': 0.78,
  'STATUS_FLIP': 0.81,
  'PRESTIGE_GAIN': 0.76,
  'PRESTIGE_LOSS': 0.83,
  'SHADOW_WARNING': 0.72,
  'HELPER_INTERVENTION': 0.92,
  'BETRAYAL': 0.88,
  'FORGIVENESS': 0.69,
  'RECEIPT': 0.85,
  'RANK_UPDATE': 0.73,
  'CALLOUT': 0.87,
  'DEAL_SEAL': 0.86,
  'MARKET_TURN': 0.75,
  'BOARD_SHOCK': 0.74,
  'CROWD_ERUPTION': 0.81,
  'CROWD_SILENCE': 0.79,
  'NARRATIVE_ECHO': 0.7,
  'AUTHORITY_DROP': 0.84,
  'VULNERABILITY': 0.71,
  'CONFIDENCE_BREAK': 0.84,
  'CONFIDENCE_SURGE': 0.78,
  'ALLIANCE': 0.76,
  'STANDOFF': 0.74,
  'RESURRECTION': 0.8,
  'TRAP': 0.86,
  'ESCAPE': 0.79,
  'EXPOSURE': 0.87,
  'CHALLENGE': 0.82,
  'PROMISE': 0.69,
  'WARNING': 0.76,
  'RECEIPT_CHAIN': 0.88,
  'MENTOR_NOTE': 0.68,
  'RIVAL_NOTE': 0.77,
  'PROOF_CHAIN': 0.9,
  'SHADOW_BREACH': 0.83,
  'LIVEOPS_SPIKE': 0.71,
});
export const MEMORY_RANKING_POLICY_RELATIONSHIP_SIGNAL_WEIGHT = Object.freeze<Readonly<Record<string, number>>>({
  'TRUST': 0.88,
  'LOYALTY': 0.84,
  'BOND': 0.8,
  'ATTACHMENT': 0.78,
  'RESPECT': 0.76,
  'FEAR': 0.73,
  'AWE': 0.71,
  'RIVALRY': 0.9,
  'ENVY': 0.74,
  'OBSESSION': 0.82,
  'RESENTMENT': 0.79,
  'BETRAYAL': 0.86,
  'FORGIVENESS': 0.62,
  'DEBT': 0.7,
  'FAVOR': 0.69,
  'MENTOR': 0.72,
  'STUDENT': 0.66,
  'CREW': 0.71,
  'SYNDICATE': 0.75,
  'ALLY': 0.73,
  'HELPER': 0.77,
  'HATER': 0.82,
  'WITNESS': 0.58,
  'RECEIPT': 0.76,
  'PROMISE': 0.54,
  'WARNING': 0.59,
  'DEAL': 0.68,
  'STATUS': 0.63,
  'DOMINANCE': 0.85,
  'SUBMISSION': 0.78,
  'DISTANCE': 0.57,
  'RECONCILIATION': 0.6,
  'TAUNT': 0.8,
  'PROTECTION': 0.7,
  'SALVAGE': 0.67,
  'TRIAGE': 0.65,
  'SCORN': 0.83,
  'VALIDATION': 0.64,
  'RECOGNITION': 0.66,
  'LEGACY': 0.61,
  'HALLMARK': 0.56,
  'PRESSURE': 0.68,
  'WATCHFULNESS': 0.62,
});
export const MEMORY_RANKING_POLICY_EMOTION_SIGNAL_WEIGHT = Object.freeze<Readonly<Record<string, number>>>({
  'ANGER': 0.84,
  'RAGE': 0.92,
  'FEAR': 0.86,
  'PANIC': 0.94,
  'SHAME': 0.93,
  'HUMILIATION': 0.98,
  'HYPE': 0.83,
  'EXCITEMENT': 0.77,
  'RELIEF': 0.69,
  'CONFIDENCE': 0.73,
  'RESOLVE': 0.72,
  'DESPAIR': 0.88,
  'HOPE': 0.64,
  'SHOCK': 0.8,
  'AWE': 0.68,
  'SUSPICION': 0.7,
  'ENVY': 0.74,
  'CONTEMPT': 0.87,
  'ADMIRATION': 0.62,
  'PRIDE': 0.7,
  'COLLAPSE': 0.91,
  'RESCUE': 0.82,
  'TAUNT': 0.79,
  'DEFIANCE': 0.81,
  'CALM': 0.48,
  'FOCUS': 0.55,
  'PREDATORY': 0.83,
  'CEREMONIAL': 0.52,
  'COLD': 0.58,
  'NUMB': 0.63,
  'VENGEFUL': 0.84,
  'PLAYFUL': 0.46,
  'INTIMATE': 0.5,
  'LONELY': 0.66,
  'ISOLATED': 0.71,
  'CORNERED': 0.88,
  'EXPOSED': 0.82,
  'VALIDATED': 0.54,
  'WITNESSED': 0.65,
  'PRESSURED': 0.79,
  'TRAPPED': 0.87,
  'DOMINANT': 0.72,
  'SUBMISSIVE': 0.77,
  'ELECTRIC': 0.66,
  'CHARGED': 0.68,
  'UNSTABLE': 0.75,
});
export const MEMORY_RANKING_POLICY_EVIDENCE_KIND_WEIGHT = Object.freeze<Readonly<Record<string, number>>>({
  'QUOTE': 0.84,
  'RELATIONSHIP': 0.77,
  'TRANSCRIPT': 0.81,
  'MOMENT': 0.74,
  'SCENE': 0.72,
  'MESSAGE': 0.78,
  'DOCUMENT': 0.69,
  'RUN': 0.64,
  'WINDOW': 0.62,
  'SYSTEM': 0.57,
  'PROOF': 0.88,
  'RECEIPT': 0.86,
  'EMBEDDING': 0.61,
  'SUMMARY': 0.49,
});
export const MEMORY_RANKING_POLICY_PURPOSE_WEIGHT = Object.freeze<Readonly<Record<string, number>>>({
  'CHAT_MEMORY': 0.72,
  'CHAT_QUOTE': 0.88,
  'CHAT_RELATIONSHIP': 0.83,
  'CHAT_EMOTION': 0.79,
  'CHAT_MOMENT': 0.76,
  'CHAT_LIVEOPS': 0.68,
  'CHAT_DEALROOM': 0.9,
  'CHAT_RESCUE': 0.92,
  'CHAT_RANKING': 0.73,
  'CHAT_SHADOW': 0.66,
});
export const MEMORY_RANKING_POLICY_MATCH_KIND_WEIGHT = Object.freeze<Readonly<Record<string, number>>>({
  'EXACT': 1.0,
  'HYBRID': 0.84,
  'SALIENT': 0.76,
  'SEMANTIC': 0.68,
  'RELATIONSHIP': 0.82,
  'EMOTIONAL': 0.74,
  'CONTINUITY': 0.78,
  'TAG': 0.6,
  'WINDOW': 0.57,
  'BASELINE': 0.62,
  'SHADOW': 0.61,
  'UNKNOWN': 0.45,
});
export const MEMORY_RANKING_POLICY_LANE_ALIASES = Object.freeze<Readonly<Record<string, readonly string[]>>>({
  'GENERAL': Object.freeze([
    'general',
    'default',
    'normal',
    'broad',
    'ambient',
    'system',
  ]),
  'CALLBACK': Object.freeze([
    'callback',
    'receipt',
    'echo',
    'reference',
    'remember',
    'throwback',
    'call back',
  ]),
  'RESCUE': Object.freeze([
    'rescue',
    'save',
    'intercept',
    'stabilize',
    'recovery',
    'triage',
    'support',
  ]),
  'TAUNT': Object.freeze([
    'taunt',
    'pressure',
    'mock',
    'humiliate',
    'needle',
    'provoke',
    'clown',
  ]),
  'CELEBRATION': Object.freeze([
    'celebration',
    'victory',
    'hype',
    'glory',
    'honor',
    'prestige',
    'cheer',
  ]),
  'RELATIONSHIP': Object.freeze([
    'relationship',
    'bond',
    'trust',
    'rivalry',
    'attachment',
    'history',
    'status',
  ]),
  'DEALROOM': Object.freeze([
    'dealroom',
    'deal room',
    'trade',
    'negotiation',
    'bluff',
    'offer',
    'counter',
  ]),
  'POSTRUN': Object.freeze([
    'postrun',
    'post run',
    'aftermath',
    'verdict',
    'recap',
    'ledger',
    'aftermath',
  ]),
  'LIVEOPS': Object.freeze([
    'liveops',
    'world event',
    'seasonal',
    'broadcast',
    'global event',
    'override',
    'event',
  ]),
  'RANKING': Object.freeze([
    'ranking',
    'ladder',
    'rank',
    'leaderboard',
    'placement',
    'tier',
    'standing',
  ]),
});
export const MEMORY_RANKING_POLICY_MODE_MOOD_LEXICON = Object.freeze<Readonly<Record<string, readonly string[]>>>({
  'EMPIRE': Object.freeze([
    'ceremonial',
    'command',
    'ledger',
    'prestige',
    'statecraft',
    'legacy',
  ]),
  'PREDATOR': Object.freeze([
    'predatory',
    'dealroom',
    'pressure',
    'scarcity',
    'bluff',
    'read',
  ]),
  'SYNDICATE': Object.freeze([
    'tribal',
    'trust',
    'crew',
    'heat',
    'watch',
    'whisper',
  ]),
  'PHANTOM': Object.freeze([
    'stealth',
    'cold',
    'shadow',
    'isolation',
    'surveil',
    'ghost',
  ]),
  'ZERO': Object.freeze([
    'primal',
    'foundational',
    'signal',
    'recursion',
    'truth',
    'proof',
  ]),
  'LEAGUE': Object.freeze([
    'sport',
    'hype',
    'ladder',
    'rank',
    'witness',
    'clout',
  ]),
  'LOBBY': Object.freeze([
    'warmup',
    'anticipation',
    'readiness',
    'scan',
    'gather',
    'echo',
  ]),
  'POST_RUN': Object.freeze([
    'ceremonial',
    'verdict',
    'ledger',
    'memory',
    'proof',
    'aftermath',
  ]),
});
export const MEMORY_RANKING_POLICY_INTENT_LANES = Object.freeze<Readonly<Record<MemoryAnchorQueryIntent, readonly MemoryRankingLane[]>>>({
  CALLBACK: Object.freeze([
    'CALLBACK' as MemoryRankingLane,
    'GENERAL' as MemoryRankingLane,
    'RELATIONSHIP' as MemoryRankingLane,
    'RANKING' as MemoryRankingLane,
  ]),
  RESCUE: Object.freeze([
    'RESCUE' as MemoryRankingLane,
    'RELATIONSHIP' as MemoryRankingLane,
    'GENERAL' as MemoryRankingLane,
  ]),
  TAUNT: Object.freeze([
    'TAUNT' as MemoryRankingLane,
    'CALLBACK' as MemoryRankingLane,
    'DEALROOM' as MemoryRankingLane,
    'GENERAL' as MemoryRankingLane,
  ]),
  CELEBRATION: Object.freeze([
    'CELEBRATION' as MemoryRankingLane,
    'POSTRUN' as MemoryRankingLane,
    'GENERAL' as MemoryRankingLane,
  ]),
  RELATIONSHIP_CONTEXT: Object.freeze([
    'RELATIONSHIP' as MemoryRankingLane,
    'CALLBACK' as MemoryRankingLane,
    'GENERAL' as MemoryRankingLane,
  ]),
  DEALROOM_CONTEXT: Object.freeze([
    'DEALROOM' as MemoryRankingLane,
    'TAUNT' as MemoryRankingLane,
    'RANKING' as MemoryRankingLane,
  ]),
  RANKING_CONTEXT: Object.freeze([
    'RANKING' as MemoryRankingLane,
    'GENERAL' as MemoryRankingLane,
    'POSTRUN' as MemoryRankingLane,
  ]),
  POSTRUN_CONTEXT: Object.freeze([
    'POSTRUN' as MemoryRankingLane,
    'CELEBRATION' as MemoryRankingLane,
    'CALLBACK' as MemoryRankingLane,
  ]),
  LIVEOPS_CONTEXT: Object.freeze([
    'LIVEOPS' as MemoryRankingLane,
    'GENERAL' as MemoryRankingLane,
    'RANKING' as MemoryRankingLane,
  ]),
});
export const MEMORY_RANKING_POLICY_SIGNAL_TAXONOMY = Object.freeze<Readonly<Record<string, readonly string[]>>>({
  'RESCUE': Object.freeze([
    'rescue',
    'save',
    'catch',
    'stabilize',
    'hold',
    'recover',
    'recovering',
    'recoverable',
    'triage',
    'support',
    'help',
    'lifeline',
    'reset',
    'steady',
    'guide',
    'intercept',
    'calm',
    'protect',
    'buffer',
    'soften',
  ]),
  'TAUNT': Object.freeze([
    'taunt',
    'needle',
    'mock',
    'clown',
    'shame',
    'shaming',
    'humiliate',
    'humiliation',
    'callout',
    'expose',
    'receipt',
    'roast',
    'bully',
    'pressure',
    'squeeze',
    'laugh',
    'drag',
    'corner',
    'bait',
    'provoke',
  ]),
  'DEALROOM': Object.freeze([
    'deal',
    'offer',
    'counter',
    'bid',
    'price',
    'pricing',
    'spread',
    'bluff',
    'read',
    'readthrough',
    'stall',
    'anchor',
    'close',
    'terms',
    'leverage',
    'walkaway',
    'scarcity',
    'deadline',
    'seller',
    'buyer',
  ]),
  'RELATIONSHIP': Object.freeze([
    'bond',
    'trust',
    'loyalty',
    'respect',
    'fear',
    'envy',
    'obsession',
    'rivalry',
    'history',
    'attachment',
    'status',
    'crew',
    'ally',
    'mentor',
    'student',
    'helper',
    'hater',
    'promise',
    'betrayal',
    'reconcile',
  ]),
  'LIVEOPS': Object.freeze([
    'event',
    'world',
    'broadcast',
    'season',
    'seasonal',
    'override',
    'hotfix',
    'spotlight',
    'ceremony',
    'league',
    'ladder',
    'patch',
    'moment',
    'drop',
    'surge',
    'rotation',
    'festival',
    'state',
    'worldstate',
    'global',
  ]),
  'POSTRUN': Object.freeze([
    'verdict',
    'after',
    'aftermath',
    'recap',
    'postrun',
    'ledger',
    'memory',
    'receipt',
    'review',
    'summary',
    'timeline',
    'breakdown',
    'closure',
    'consequence',
    'aftersmoke',
    'witness',
    'epilogue',
    'debrief',
    'decompression',
    'reset',
  ]),
  'CALLBACK': Object.freeze([
    'callback',
    'remember',
    'again',
    'before',
    'last',
    'previous',
    'throwback',
    'once',
    'earlier',
    'echo',
    'receipt',
    'repeat',
    'history',
    'that_time',
    'you_said',
    'you_did',
    'same',
    'pattern',
    'already',
    'still',
  ]),
  'RANKING': Object.freeze([
    'rank',
    'ranking',
    'ladder',
    'leaderboard',
    'placement',
    'tier',
    'elo',
    'standing',
    'position',
    'climb',
    'fall',
    'promotion',
    'demotion',
    'seed',
    'qualify',
    'status',
    'record',
    'streak',
    'split',
    'division',
  ]),
  'SHADOW': Object.freeze([
    'shadow',
    'under',
    'latent',
    'whisper',
    'offscreen',
    'hidden',
    'unseen',
    'ghost',
    'phantom',
    'trace',
    'lurking',
    'watching',
    'overhear',
    'ambient',
    'unspoken',
    'implied',
    'pressure',
    'risk',
    'marker',
    'signal',
  ]),
});

export const MEMORY_RANKING_POLICY_PLAYBOOK = Object.freeze<Readonly<Record<string, readonly string[]>>>({
  'CALLBACK': Object.freeze([
    'favor quote-backed anchors',
    'preserve callback phrase freshness',
    'prefer anchors with repeatable social receipts',
    'bias unresolved rivalry threads',
    'promote rank-consistent echoes',
    'defer stale callbacks when proof pressure is high',
    'boost anchors that mirror current mode mood',
    'avoid blocked family duplication',
  ]),
  'RESCUE': Object.freeze([
    'prefer anchors with high rescue salience',
    'promote helpers over pure humiliation',
    'weight evidence-backed recovery beats',
    'elevate recent stabilizations under urgency',
    'prefer relationship-safe context',
    'deprioritize stale dealroom bravado',
    'carry unresolved support threads',
    'keep proof-bearing anchors available for intervention',
  ]),
  'TAUNT': Object.freeze([
    'prefer embarrassment and quote reversal anchors',
    'surface leverage-relevant receipts',
    'reward canonically-ranked social wounds',
    'bias toward pressure-compatible tone',
    'prefer anchors with crowd witness',
    'penalize shadow-only items when public proof is required',
    'retain rivalry family continuity',
    'favor compact callbacks over broad summaries',
  ]),
  'DEALROOM': Object.freeze([
    'prefer bluff exposure and leverage anchors',
    'promote precise proof density',
    'favor recent negotiation windows',
    'bias toward threat and scarcity semantics',
    'deprioritize celebration-only beats',
    'require scope alignment to room or run when possible',
    'carry family continuation of negotiation history',
    'amplify evidentiary anchors under proof pressure',
  ]),
  'RELATIONSHIP': Object.freeze([
    'favor trust, rivalry, attachment, and debt semantics',
    'prefer actor persona alignment',
    'promote follow-persona continuity',
    'weight relationship tags above general tags',
    'retain predecessor-successor flow',
    'deprioritize purely ambient world events',
    'use callback freshness to prevent spam',
    'prefer memories with strong relationship refs',
  ]),
  'POSTRUN': Object.freeze([
    'prefer turning points, collapses, comebacks, and legends',
    'reward canonical baseline agreement',
    'use receipt density for recap anchors',
    'favor anchors with diverse evidence kinds',
    'promote final-scene or moment scope matches',
    'retain unresolved fallout threads',
    'blend ranking and narrative salience',
    'prefer ledger-friendly summaries',
  ]),
  'RANKING': Object.freeze([
    'prefer rank updates, status flips, prestige changes, and witnessed victories',
    'reward ladder vocabulary alignment',
    'use crowd witness tags and proof density',
    'prefer anchors with durable stability',
    'blend baseline and authored query overlap',
    'deprioritize purely emotional but unproven beats',
    'respect family caps to avoid monotony',
    'favor canonical query agreement',
  ]),
  'LIVEOPS': Object.freeze([
    'prefer world events and season-state anchors',
    'reward mode mood alignment and global tags',
    'blend urgency with recency',
    'deprioritize narrow personal wounds unless they are canonical',
    'favor anchors with strong proof or document evidence',
    'surface high-salience low-noise beats',
    'retain cross-run continuity',
    'prefer broadcast-friendly previews',
  ]),
});

export const MEMORY_RANKING_POLICY_SCENARIO_TOKENS = Object.freeze<Readonly<Record<string, readonly string[]>>>({
  'pressure_spike': Object.freeze([
    'humiliation',
    'pressure',
    'crowd',
    'receipt',
    'squeeze',
    'stare',
    'clock',
    'risk',
    'taunt',
    'overreach',
  ]),
  'comeback_arc': Object.freeze([
    'recover',
    'return',
    'steady',
    'answer',
    'resolve',
    'witness',
    'legend',
    'swing',
    'flip',
    'cheer',
  ]),
  'dealroom_read': Object.freeze([
    'offer',
    'counter',
    'bluff',
    'read',
    'stall',
    'deadline',
    'leverage',
    'walkaway',
    'spread',
    'close',
  ]),
  'shadow_watch': Object.freeze([
    'shadow',
    'watch',
    'unseen',
    'ghost',
    'lurking',
    'marker',
    'trace',
    'ambient',
    'whisper',
    'preload',
  ]),
  'rescue_intercept': Object.freeze([
    'intercept',
    'rescue',
    'stabilize',
    'triage',
    'guide',
    'reset',
    'protect',
    'help',
    'buffer',
    'calm',
  ]),
  'rank_pressure': Object.freeze([
    'ladder',
    'rank',
    'placement',
    'status',
    'tier',
    'standing',
    'seed',
    'record',
    'streak',
    'promote',
  ]),
  'relationship_fallout': Object.freeze([
    'trust',
    'betrayal',
    'rivalry',
    'history',
    'bond',
    'resentment',
    'attachment',
    'distance',
    'fear',
    'respect',
  ]),
  'world_broadcast': Object.freeze([
    'world',
    'event',
    'season',
    'broadcast',
    'override',
    'drop',
    'global',
    'league',
    'ceremony',
    'rotation',
  ]),
});

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

      const canonicalQuery = buildCanonicalQuery(prepared, options);
      const canonicalBaselineMatches = prepared.baselineCrossCheckEnabled
        ? rankMemoryAnchors(
            canonicalQuery,
            candidates.map((candidate) => candidate.anchor),
          ).slice(
            0,
            Math.max(
              prepared.topK,
              options.canonicalBaselineTopK ??
                MEMORY_RANKING_POLICY_DEFAULTS.canonicalBaselineTopK,
            ),
          )
        : Object.freeze([] as MemoryAnchorMatch[]);

      const baselineRankHints = createBaselineHintMap(canonicalBaselineMatches);
      const limitedCandidates = candidates
        .slice(0, cap)
        .filter((candidate) => shouldKeepCandidateForPreparedContext(candidate, prepared));

      const scored = limitedCandidates.map((candidate) =>
        scoreCandidateInternal(
          candidate,
          prepared,
          weights,
          options,
          baselineRankHints,
        ),
      );

      const sorted = scored
        .filter((entry) => entry.trace.passedThreshold)
        .sort(compareInternalRankedAnchors);

      const diversified = applyDiversityGuards(sorted, prepared);
      const ranked = diversified
        .slice(0, prepared.topK)
        .map((entry, index) => finalizeRankedAnchor(entry, index + 1, api, context));

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

      const receipt = createRankingReceipt(
        canonicalQuery,
        ranked.map((value) => value.projection),
        limitedCandidates.length,
        canonicalBaselineMatches,
        traces,
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
        returnedCount: ranked.length,
        thresholdScore: prepared.thresholdScore,
        ranked: Object.freeze(ranked),
        traces,
        baselineMatches: Object.freeze(canonicalBaselineMatches),
        canonicalQuery,
        receipt,
      });
    },

    scoreCandidate(
      candidate: MemoryRankingCandidate,
      context: MemoryRankingContext,
    ): RankedMemoryAnchor {
      const prepared = prepareContext(context, options);
      const canonicalQuery = buildCanonicalQuery(prepared, options);
      const baseline = createBaselineHintMap(
        prepared.baselineCrossCheckEnabled
          ? rankMemoryAnchors(canonicalQuery, [candidate.anchor])
          : Object.freeze([] as MemoryAnchorMatch[]),
      );
      const ranked = scoreCandidateInternal(candidate, prepared, weights, options, baseline);
      return finalizeRankedAnchor(ranked, 0, api, context);
    },

    projectMatch(
      ranked: Pick<
        RankedMemoryAnchor,
        'rank' | 'anchor' | 'score' | 'trace' | 'matchedTags' | 'blockedTags'
      >,
      context?: MemoryRankingContext,
    ): MemoryAnchorMatch {
      const prepared = prepareContext(context ?? { intent: 'CALLBACK' }, options);
      const query = buildCanonicalQuery(prepared, options);
      const canonical = createMemoryAnchorMatch(
        Math.max(0, ranked.rank),
        query,
        ranked.anchor,
      );

      return Object.freeze({
        ...canonical,
        retrievalScore: round4(
          clampUnit(
            canonical.retrievalScore * 0.4 +
              ranked.trace.retrievalScore * 0.6,
          ),
        ),
        evidenceWeight: round4(
          clampUnit(
            computeMemoryAnchorEvidenceWeight(ranked.anchor) * 0.6 +
              canonical.evidenceWeight * 0.4,
          ),
        ),
        continuityBoost: round4(
          clampUnit(
            canonical.continuityBoost +
              continuityScoreFromPreparedContext(ranked.anchor, prepared) * 0.5,
          ),
        ),
        matchedTags: Object.freeze(
          dedupeStrings([
            ...canonical.matchedTags,
            ...ranked.matchedTags,
          ]),
        ),
      });
    },
  };

  return Object.freeze(api);
}

export function buildMemoryRankingQueryFromContext(
  context: MemoryRankingContext,
  options: MemoryRankingPolicyOptions = {},
): MemoryAnchorQuery {
  return buildCanonicalQuery(prepareContext(context, options), options);
}

export function createCanonicalBaselineMatches(
  anchors: readonly MemoryAnchor[],
  context: MemoryRankingContext,
  options: MemoryRankingPolicyOptions = {},
): readonly MemoryAnchorMatch[] {
  const prepared = prepareContext(context, options);
  const query = buildCanonicalQuery(prepared, options);

  return Object.freeze(
    rankMemoryAnchors(query, anchors).slice(
      0,
      Math.max(
        prepared.topK,
        options.canonicalBaselineTopK ??
          MEMORY_RANKING_POLICY_DEFAULTS.canonicalBaselineTopK,
      ),
    ),
  );
}

export function summarizeMemoryRankingResult(
  result: MemoryRankingResult,
): readonly string[] {
  const lines: string[] = [];
  lines.push(
    `query=${result.canonicalQuery.id}`,
    `intent=${result.canonicalQuery.intent}`,
    `candidates=${result.totalCandidates}`,
    `returned=${result.returnedCount}`,
    `threshold=${round4(result.thresholdScore).toFixed(4)}`,
  );

  for (const value of result.ranked) {
    lines.push(
      explainRankedAnchor(value),
      value.trace.summary,
    );
  }

  for (const value of result.baselineMatches.slice(0, 3)) {
    lines.push(`baseline=${summarizeMemoryAnchorMatch(value)}`);
  }

  return Object.freeze(lines);
}

export function explainMemoryRankingTrace(trace: MemoryRankingTrace): string {
  const parts = [
    `anchor=${trace.anchorId}`,
    `total=${round4(trace.totalScore).toFixed(4)}`,
    `retrieval=${round4(trace.retrievalScore).toFixed(4)}`,
    `threshold=${round4(trace.thresholdScore).toFixed(4)}`,
    `lane=${trace.lane}`,
    `source=${trace.retrievalSource}`,
    `canonical=${round4(trace.canonicalScore).toFixed(4)}`,
    `preview=${trace.preview}`,
  ];

  return parts.join(' | ');
}

export function explainRankedAnchor(ranked: RankedMemoryAnchor): string {
  const preview = createMemoryAnchorPreview(ranked.anchor);
  return [
    `rank=${ranked.rank}`,
    `anchor=${ranked.anchor.id}`,
    `score=${round4(ranked.finalScore).toFixed(4)}`,
    `retrieval=${round4(ranked.retrievalScore).toFixed(4)}`,
    `priority=${ranked.anchor.retrieval.priority}`,
    `kind=${ranked.anchor.kind}`,
    preview,
  ].join(' | ');
}

export function createMemoryRankingCandidate(
  anchor: MemoryAnchor,
  partial: Omit<Partial<MemoryRankingCandidate>, 'anchor'> = {},
): MemoryRankingCandidate {
  return Object.freeze({
    anchor,
    embeddingMatches: Object.freeze([...(partial.embeddingMatches ?? [])]),
    relationshipSignals: Object.freeze([...(partial.relationshipSignals ?? [])]),
    emotionSignals: Object.freeze([...(partial.emotionSignals ?? [])]),
    currentTags: Object.freeze([...(partial.currentTags ?? [])]),
    currentModeId: partial.currentModeId,
    currentStageMood: partial.currentStageMood,
    currentPhaseId: partial.currentPhaseId,
    retrievalOrdinal: partial.retrievalOrdinal,
    retrievalSource: partial.retrievalSource ?? 'UNKNOWN',
    lane: partial.lane ?? inferLaneFromSignals(
      partial.currentTags ?? [],
      partial.strategyTags ?? [],
      partial.shadowSignals ?? [],
      partial.pressureSignals ?? [],
      partial.authoredHints ?? [],
    ),
    sourceWindowId: partial.sourceWindowId,
    windowAnchorIds: Object.freeze([...(partial.windowAnchorIds ?? [])]),
    shadowSignals: Object.freeze([...(partial.shadowSignals ?? [])]),
    pressureSignals: Object.freeze([...(partial.pressureSignals ?? [])]),
    reputationSignals: Object.freeze([...(partial.reputationSignals ?? [])]),
    audienceSignals: Object.freeze([...(partial.audienceSignals ?? [])]),
    authoredHints: Object.freeze([...(partial.authoredHints ?? [])]),
    strategyTags: Object.freeze([...(partial.strategyTags ?? [])]),
    evidenceHints: Object.freeze([...(partial.evidenceHints ?? [])]),
  });
}

export function groupRankedAnchorsByFamily(
  ranked: readonly RankedMemoryAnchor[],
): Readonly<Record<string, readonly RankedMemoryAnchor[]>> {
  const grouped: Record<string, RankedMemoryAnchor[]> = Object.create(null);

  for (const value of ranked) {
    const familyId = normalizeOptionalToken(value.anchor.continuity.familyId) ?? '__none__';
    grouped[familyId] ??= [];
    grouped[familyId].push(value);
  }

  const output: Record<string, readonly RankedMemoryAnchor[]> = Object.create(null);
  for (const [key, values] of Object.entries(grouped)) {
    output[key] = Object.freeze([...values].sort(compareRankedAnchors));
  }

  return Object.freeze(output);
}

function finalizeRankedAnchor(
  ranked: InternalRankedMemoryAnchor,
  rank: number,
  api: MemoryRankingPolicyApi,
  context: MemoryRankingContext,
): RankedMemoryAnchor {
  const projection = api.projectMatch(
    {
      rank,
      anchor: ranked.anchor,
      score: ranked.score,
      trace: ranked.trace,
      matchedTags: ranked.matchedTags,
      blockedTags: ranked.blockedTags,
    },
    context,
  );

  return Object.freeze({
    ...ranked,
    rank,
    projection,
  });
}

function scoreCandidateInternal(
  candidate: MemoryRankingCandidate,
  prepared: PreparedRankingContext,
  weights: Readonly<MemoryRankingPolicyWeights>,
  options: MemoryRankingPolicyOptions,
  baselineRankHints: Readonly<Map<MemoryAnchorId, number>>,
): InternalRankedMemoryAnchor {
  const anchor = candidate.anchor;
  const canonicalQuery = buildCanonicalQuery(prepared, options);
  const canonicalProjection = createMemoryAnchorMatch(0, canonicalQuery, anchor);
  const canonicalScore = scoreMemoryAnchorMatch(canonicalQuery, anchor);
  const canonicalRankHint = baselineRankHints.get(anchor.id);

  const anchorTags = collectAnchorTags(anchor);
  const candidateTags = collectCandidateTags(prepared, candidate);
  const matchedTags = intersectTags(anchorTags, candidateTags);
  const blockedTags = intersectTags(anchorTags, prepared.blockedTags);
  const lane = candidate.lane ?? inferLane(anchor, prepared, candidate);
  const retrievalSource = candidate.retrievalSource ?? 'UNKNOWN';
  const purpose = normalizeToken(String(anchor.purpose || inferAnchorPurpose(anchor.kind)));

  const components: MemoryRankingComponentTrace[] = [];
  const add = (key: string, value: number, note?: string): number => {
    const normalized = round4(value);
    components.push(Object.freeze({ key, value: normalized, note }));
    return normalized;
  };

  const excludedByAnchorId = prepared.excludedAnchorIds.includes(anchor.id);
  const excludedFamily = Boolean(
    anchor.continuity.familyId &&
      prepared.excludedFamilyIds.includes(
        normalizeToken(anchor.continuity.familyId),
      ),
  );
  const targetKindMismatch =
    prepared.targetKinds.length > 0 && !prepared.targetKinds.includes(anchor.kind);
  const blockedPurpose = prepared.blockedPurposes.includes(purpose);
  const requireEvidencePenalty =
    prepared.requireEvidence && anchor.evidence.length === 0
      ? MEMORY_RANKING_POLICY_DEFAULTS.missingEvidencePenalty
      : 0;

  const salience = add(
    'salience.final',
    clampUnit(anchor.salience.final) * weights.salience,
    `final=${round4(anchor.salience.final)}`,
  );
  const priority = add(
    'retrieval.priority',
    priorityScore(anchor.retrieval.priority) * weights.priority,
    anchor.retrieval.priority,
  );
  const intent = add(
    'intent.alignment',
    intentScore(anchor, prepared.intent) * weights.intent,
    prepared.intent,
  );
  const recency = add(
    'formation.recency',
    recencyScore(anchor, prepared.nowMs, options.halfLifeMs) * weights.recency,
  );
  const evidence = add(
    'evidence.weight',
    evidenceScore(anchor) * weights.evidence,
    `evidence=${anchor.evidence.length}`,
  );
  const hitCount = add(
    'formation.hitCount',
    normalizeCounter(
      anchor.formation.hitCount,
      MEMORY_RANKING_POLICY_DEFAULTS.hitCountNormalizer,
    ) * weights.hitCount,
    `${anchor.formation.hitCount}`,
  );
  const reaffirm = add(
    'formation.reaffirmCount',
    normalizeCounter(
      anchor.formation.reaffirmCount,
      MEMORY_RANKING_POLICY_DEFAULTS.reaffirmCountNormalizer,
    ) * weights.reaffirm,
    `${anchor.formation.reaffirmCount}`,
  );
  const tagOverlap = add(
    'tags.overlap',
    tagOverlapScore(anchor, prepared, candidate, matchedTags, blockedTags) *
      weights.tagOverlap,
    matchedTags.join(', ') || 'none',
  );
  const embedding = add(
    'embedding.match',
    embeddingScore(candidate.embeddingMatches, anchor) * weights.embedding,
  );
  const stability = add(
    'stability.class',
    stabilityScore(anchor.stabilityClass) * weights.stability,
    anchor.stabilityClass,
  );
  const relationship = add(
    'relationship.signal',
    relationshipScore(anchor, prepared, candidate) * weights.relationship,
  );
  const emotion = add(
    'emotion.signal',
    emotionScore(anchor, prepared, candidate) * weights.emotion,
  );
  const continuity = add(
    'continuity.signal',
    continuityScore(anchor, prepared, candidate) * weights.continuity,
  );
  const scopeMatch = add(
    'scope.match',
    scopeScore(anchor, prepared, candidate) * weights.scopeMatch,
  );
  const callbacks = add(
    'callback.signal',
    callbackScore(anchor, prepared) * weights.callbacks,
  );
  const queryText = add(
    'query.text',
    queryTextScore(anchor, prepared, candidate) * weights.queryText,
    prepared.queryText ? prepared.queryTokens.join(', ') : 'none',
  );
  const retrievalSignal = add(
    'retrieval.signal',
    retrievalSignalScore(candidate, prepared) * weights.retrievalSignal,
    `${retrievalSource}:${candidate.retrievalOrdinal ?? 'na'}`,
  );
  const targetKind = add(
    'target.kind',
    targetKindScore(anchor, prepared) * weights.targetKind,
    prepared.targetKinds.length ? prepared.targetKinds.join(', ') : 'none',
  );
  const baseline = add(
    'baseline.canonical',
    baselineScore(canonicalScore, canonicalRankHint, prepared) * weights.baseline,
    canonicalRankHint ? `rank=${canonicalRankHint}` : 'unranked',
  );
  const mode = add(
    'mode.mood',
    modeMoodScore(prepared, candidate, anchor) * weights.mode,
    `${prepared.currentModeId ?? 'none'}:${prepared.currentStageMood ?? 'none'}`,
  );
  const family = add(
    'family.flow',
    familyScore(anchor, prepared) * weights.family,
    anchor.continuity.familyId ?? 'none',
  );
  const purposeScoreValue = add(
    'purpose.match',
    purposeScore(anchor, prepared, lane) * weights.purpose,
    purpose,
  );
  const evidenceVariety = add(
    'evidence.variety',
    evidenceVarietyScore(anchor, prepared) * weights.evidenceVariety,
  );
  const proofDensity = add(
    'proof.density',
    proofDensityScore(anchor, prepared) * weights.proofDensity,
  );
  const freshnessWindow = add(
    'freshness.window',
    freshnessWindowScore(anchor, prepared) * weights.freshnessWindow,
  );

  const blockedPenalty = blockedTags.length
    ? MEMORY_RANKING_POLICY_DEFAULTS.blockedTagPenalty
    : 0;
  add('penalty.blockedTags', -blockedPenalty, blockedTags.join(', ') || undefined);

  const requiredMissPenalty = requiredMissPenaltyScore(anchor, prepared);
  add('penalty.requiredMiss', -requiredMissPenalty);

  const duplicatePenalty = excludedByAnchorId
    ? MEMORY_RANKING_POLICY_DEFAULTS.duplicateAnchorPenalty
    : excludedFamily
      ? MEMORY_RANKING_POLICY_DEFAULTS.duplicateFamilyPenalty
      : 0;
  add(
    'penalty.duplicate',
    -duplicatePenalty,
    excludedByAnchorId ? 'excluded-anchor-id' : excludedFamily ? 'duplicate-family' : undefined,
  );

  const targetKindPenalty = targetKindMismatch
    ? MEMORY_RANKING_POLICY_DEFAULTS.targetKindMismatchPenalty
    : 0;
  add(
    'penalty.targetKindMismatch',
    -targetKindPenalty,
    targetKindMismatch ? anchor.kind : undefined,
  );

  const blockedPurposePenalty = blockedPurpose
    ? MEMORY_RANKING_POLICY_DEFAULTS.blockedPurposePenalty
    : 0;
  add('penalty.blockedPurpose', -blockedPurposePenalty, blockedPurpose ? purpose : undefined);

  if (requireEvidencePenalty > 0) {
    add('penalty.missingEvidence', -requireEvidencePenalty);
  }

  const shadowPenalty =
    !prepared.allowShadowCandidates &&
    retrievalSource === 'SHADOW'
      ? MEMORY_RANKING_POLICY_DEFAULTS.shadowPenalty
      : 0;
  if (shadowPenalty > 0) {
    add('penalty.shadow', -shadowPenalty);
  }

  const positiveScore =
    salience +
    priority +
    intent +
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
    targetKind +
    baseline +
    mode +
    family +
    purposeScoreValue +
    evidenceVariety +
    proofDensity +
    freshnessWindow;

  const unclampedTotal =
    positiveScore -
    blockedPenalty -
    requiredMissPenalty -
    duplicatePenalty -
    targetKindPenalty -
    blockedPurposePenalty -
    requireEvidencePenalty -
    shadowPenalty;

  const totalScore =
    excludedByAnchorId || blockedPurpose
      ? 0
      : clampUnit(unclampedTotal);

  const retrievalScore = clampUnit(
    (
      priority +
      intent +
      embedding +
      relationship +
      emotion +
      continuity +
      queryText +
      retrievalSignal +
      baseline
    ) /
      maxSafe(
        weights.priority +
          weights.intent +
          weights.embedding +
          weights.relationship +
          weights.emotion +
          weights.continuity +
          weights.queryText +
          weights.retrievalSignal +
          weights.baseline,
        0.0001,
      ),
  );

  const preview = createMemoryAnchorPreview(anchor).title;
  const summary = summarizeMemoryAnchorMatch(canonicalProjection);
  const trace: MemoryRankingTrace = Object.freeze({
    anchorId: anchor.id,
    totalScore: round4(totalScore),
    retrievalScore: round4(retrievalScore),
    thresholdScore: round4(prepared.thresholdScore),
    passedThreshold: totalScore >= prepared.thresholdScore,
    components: Object.freeze(components),
    matchedTags: Object.freeze(dedupeStrings([...canonicalProjection.matchedTags, ...matchedTags])),
    blockedTags: Object.freeze(blockedTags),
    familyId: anchor.continuity.familyId,
    duplicatePenaltyApplied: duplicatePenalty > 0,
    canonicalScore: round4(canonicalScore),
    canonicalRankHint,
    preview,
    summary,
    lane,
    retrievalSource,
  });

  return Object.freeze({
    rank: 0,
    anchor,
    score: totalScore,
    retrievalScore,
    finalScore: totalScore,
    thresholdScore: prepared.thresholdScore,
    matchedTags: Object.freeze(dedupeStrings([...canonicalProjection.matchedTags, ...matchedTags])),
    blockedTags: Object.freeze(blockedTags),
    trace,
    projection: canonicalProjection,
    lane,
    retrievalSource,
    canonicalScore,
    canonicalRankHint,
    purpose,
    familyId: anchor.continuity.familyId,
    kindKey: normalizeToken(anchor.kind),
  });
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
    baseline: overrides?.baseline ?? 0.04,
    mode: overrides?.mode ?? 0.03,
    family: overrides?.family ?? 0.03,
    purpose: overrides?.purpose ?? 0.03,
    evidenceVariety: overrides?.evidenceVariety ?? 0.02,
    proofDensity: overrides?.proofDensity ?? 0.02,
    freshnessWindow: overrides?.freshnessWindow ?? 0.02,
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
    preferredLane:
      context.preferredLane ??
      defaultLaneForIntent(context.intent),
    topK,
    currentModeId: normalizeOptionalToken(context.currentModeId),
    currentStageMood: normalizeOptionalToken(context.currentStageMood),
    currentPhaseId: normalizeOptionalToken(context.currentPhaseId),
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
    requiredPurposes: normalizeStringList(context.requiredPurposes ?? []),
    blockedPurposes: normalizeStringList(context.blockedPurposes ?? []),
    desiredRetrievalSources: Object.freeze([
      ...(context.desiredRetrievalSources ?? []),
    ]),
    disfavoredRetrievalSources: Object.freeze([
      ...(context.disfavoredRetrievalSources ?? []),
    ]),
    diversityByFamilyCap: Math.max(
      1,
      Math.floor(
        context.diversityByFamilyCap ??
          options.diversityByFamilyCap ??
          MEMORY_RANKING_POLICY_DEFAULTS.familyDiversityCap,
      ),
    ),
    diversityByKindCap: Math.max(
      1,
      Math.floor(
        context.diversityByKindCap ??
          options.diversityByKindCap ??
          MEMORY_RANKING_POLICY_DEFAULTS.kindDiversityCap,
      ),
    ),
    preferUnresolved: context.preferUnresolved ?? true,
    allowShadowCandidates: context.allowShadowCandidates ?? false,
    requireEvidence: context.requireEvidence ?? false,
    baselineCrossCheckEnabled: context.baselineCrossCheckEnabled ?? true,
    proofPressure: clampUnit(context.proofPressure ?? 0),
    humiliationPressure: clampUnit(context.humiliationPressure ?? 0),
    hypePressure: clampUnit(context.hypePressure ?? 0),
    urgencyPressure: clampUnit(context.urgencyPressure ?? 0),
    sceneIntensity: clampUnit(context.sceneIntensity ?? 0),
    liveopsHeat: clampUnit(context.liveopsHeat ?? 0),
    authoredHints: normalizeStringList(context.authoredHints ?? []),
    strategyTags: normalizeStringList(context.strategyTags ?? []),
    evidenceHints: normalizeStringList(context.evidenceHints ?? []),
  });
}

function buildCanonicalQuery(
  prepared: PreparedRankingContext,
  options: MemoryRankingPolicyOptions,
): MemoryAnchorQuery {
  return createMemoryAnchorQuery({
    idSeed: [
      prepared.intent,
      prepared.actorId ?? 'anon',
      prepared.roomId ?? 'room',
      prepared.runId ?? 'run',
      prepared.sceneId ?? 'scene',
      prepared.momentId ?? 'moment',
    ].join('__'),
    intent: prepared.intent,
    createdAtMs: prepared.nowMs,
    roomId: prepared.roomId,
    channelId: prepared.channelId,
    runId: prepared.runId,
    sceneId: prepared.sceneId,
    momentId: prepared.momentId,
    actorId: prepared.actorId,
    actorPersonaId: prepared.actorPersonaId,
    relationshipId: prepared.relationshipId,
    kinds: Object.freeze([...(prepared.targetKinds ?? [])]),
    requiredTags: Object.freeze([
      ...prepared.requiredTags,
      ...extractIntentSynonyms(prepared.intent),
      ...extractModeMoodTags(prepared.currentModeId),
      ...prepared.authoredHints,
      ...prepared.strategyTags,
      ...prepared.evidenceHints,
    ]),
    blockedTags: Object.freeze([...prepared.blockedTags]),
    minimumFinalSalience: clampUnit(
      Math.min(
        1,
        Math.max(
          options.baseMinimumScore ?? MEMORY_RANKING_POLICY_DEFAULTS.baseMinimumScore,
          prepared.thresholdScore * 0.75,
        ),
      ),
    ),
    topK: Math.max(
      prepared.topK,
      options.canonicalBaselineTopK ??
        MEMORY_RANKING_POLICY_DEFAULTS.canonicalBaselineTopK,
    ),
  });
}

function createRankingReceipt(
  query: MemoryAnchorQuery,
  matches: readonly MemoryAnchorMatch[],
  candidateCount: number,
  baselineMatches: readonly MemoryAnchorMatch[],
  traces: readonly MemoryRankingTrace[],
): MemoryAnchorReceipt {
  const debugNotes = [
    `policy=${MEMORY_RANKING_POLICY_VERSION}`,
    `candidateCount=${candidateCount}`,
    `matchCount=${matches.length}`,
    ...baselineMatches.slice(0, 3).map((value) => `baseline=${summarizeMemoryAnchorMatch(value)}`),
    ...traces.slice(0, 3).map((trace) => `trace=${explainMemoryRankingTrace(trace)}`),
  ];

  return createMemoryAnchorReceipt(
    query,
    matches,
    candidateCount,
    Object.freeze(debugNotes),
  );
}

function shouldKeepCandidateForPreparedContext(
  candidate: MemoryRankingCandidate,
  prepared: PreparedRankingContext,
): boolean {
  const source = candidate.retrievalSource ?? 'UNKNOWN';

  if (
    prepared.desiredRetrievalSources.length > 0 &&
    !prepared.desiredRetrievalSources.includes(source)
  ) {
    return false;
  }

  if (prepared.disfavoredRetrievalSources.includes(source)) {
    return false;
  }

  if (!prepared.allowShadowCandidates && source === 'SHADOW') {
    return false;
  }

  if (
    prepared.requiredPurposes.length > 0 &&
    !prepared.requiredPurposes.includes(
      normalizeToken(String(candidate.anchor.purpose || inferAnchorPurpose(candidate.anchor.kind))),
    )
  ) {
    return false;
  }

  return true;
}

function createBaselineHintMap(
  matches: readonly MemoryAnchorMatch[],
): Readonly<Map<MemoryAnchorId, number>> {
  const map = new Map<MemoryAnchorId, number>();

  for (const value of matches) {
    map.set(value.anchorId, value.rank);
  }

  return map;
}

function applyDiversityGuards(
  values: readonly InternalRankedMemoryAnchor[],
  prepared: PreparedRankingContext,
): readonly InternalRankedMemoryAnchor[] {
  const familyCounts = new Map<string, number>();
  const kindCounts = new Map<string, number>();
  const output: InternalRankedMemoryAnchor[] = [];

  for (const value of values) {
    const familyKey = normalizeOptionalToken(value.familyId) ?? '__none__';
    const familyCount = familyCounts.get(familyKey) ?? 0;
    const kindCount = kindCounts.get(value.kindKey) ?? 0;

    if (familyCount >= prepared.diversityByFamilyCap) {
      continue;
    }

    if (kindCount >= prepared.diversityByKindCap) {
      continue;
    }

    familyCounts.set(familyKey, familyCount + 1);
    kindCounts.set(value.kindKey, kindCount + 1);
    output.push(value);
  }

  return Object.freeze(output);
}

function priorityScore(priority: MemoryAnchorRetrievalPriority): number {
  return MEMORY_RANKING_POLICY_PRIORITY_WEIGHT[priority] ?? 0.5;
}

function stabilityScore(stability: MemoryAnchorStabilityClass): number {
  return MEMORY_RANKING_POLICY_STABILITY_WEIGHT[stability] ?? 0.5;
}

function intentScore(anchor: MemoryAnchor, intent: MemoryAnchorQueryIntent): number {
  const declaredMatch = anchor.retrieval.queryIntents.includes(intent);
  const semanticBias = MEMORY_RANKING_POLICY_INTENT_WEIGHT[intent] ?? 0.5;
  const kindKey = normalizeToken(anchor.kind);
  const kindBias =
    MEMORY_RANKING_POLICY_KIND_WEIGHT[kindKey.toUpperCase()] ??
    MEMORY_RANKING_POLICY_KIND_WEIGHT[kindKey] ??
    0.5;

  if (declaredMatch) {
    return clampUnit(semanticBias * 0.74 + kindBias * 0.26 + 0.12);
  }

  switch (intent) {
    case 'CALLBACK':
      return clampUnit(
        semanticBias *
          (anchor.payload.callbackPhrases.length > 0 || anchor.quoteRefs.length > 0
            ? 0.92
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
      return clampUnit(semanticBias * 0.54 + kindBias * 0.16);
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
    anchor.formation.firstSeenAtMs || 0,
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
  const evidenceWeight = computeMemoryAnchorEvidenceWeight(anchor);
  const capped = Math.min(
    evidenceWeight,
    MEMORY_RANKING_POLICY_DEFAULTS.evidenceWeightCap,
  );

  return clampUnit(capped);
}

function normalizeCounter(value: number, normalizer: number): number {
  return clampUnit(Math.max(0, value) / maxSafe(normalizer, 1));
}

function tagOverlapScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
  matchedTags: readonly string[],
  blockedTags: readonly string[],
): number {
  if (blockedTags.length) {
    return 0;
  }

  const targetTags = collectCandidateTags(prepared, candidate);
  if (!targetTags.length) {
    return matchedTags.length ? 0.5 : 0.36;
  }

  const directRequiredOverlap = prepared.requiredTags.filter((tag) =>
    memoryAnchorHasTag(anchor, tag),
  ).length;
  const canonicalTagScore = computeAnchorTagScore(buildCanonicalQuery(prepared, {}), anchor);
  const overlapRatio = matchedTags.length / maxSafe(targetTags.length, 1);
  const requiredBias = prepared.requiredTags.length
    ? directRequiredOverlap / maxSafe(prepared.requiredTags.length, 1)
    : 0;

  return clampUnit(overlapRatio * 0.58 + requiredBias * 0.2 + canonicalTagScore * 0.22);
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
    const kindKey = normalizeOptionalToken(match.kind) ?? 'unknown';
    const kindWeight =
      MEMORY_RANKING_POLICY_MATCH_KIND_WEIGHT[kindKey.toUpperCase()] ??
      MEMORY_RANKING_POLICY_MATCH_KIND_WEIGHT[kindKey] ??
      MEMORY_RANKING_POLICY_MATCH_KIND_WEIGHT.UNKNOWN;
    const rawScore = clampUnit(match.score ?? 0);
    const documentBoost =
      match.documentId && anchor.embeddingDocumentIds.includes(match.documentId as never)
        ? 0.12
        : 0;
    const overlapBoost = intersectTags(
      normalizeStringList(match.tags ?? []),
      collectAnchorTags(anchor),
    ).length
      ? 0.08
      : 0;
    const previewBoost =
      match.preview &&
      textOverlapScore(tokenizeText(match.preview), collectAnchorSearchCorpus(anchor)) > 0.18
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
  prepared: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): number {
  let score = 0;

  if (
    prepared.relationshipId &&
    normalizeOptionalToken(anchor.subject.relationshipId) === prepared.relationshipId
  ) {
    score += 0.52;
  }

  const targetSignals = normalizeStringList([
    ...prepared.relationshipSignals,
    ...(candidate.relationshipSignals ?? []),
    ...(candidate.reputationSignals ?? []),
    ...(candidate.audienceSignals ?? []),
  ]);

  if (targetSignals.length) {
    const overlap = intersectTags(
      normalizeStringList(anchor.payload.relationshipTags),
      targetSignals,
    );

    const weightedOverlap = overlap.reduce((sum, value) => {
      const key = normalizeToken(value);
      return (
        sum +
        (MEMORY_RANKING_POLICY_RELATIONSHIP_SIGNAL_WEIGHT[key.toUpperCase()] ??
          MEMORY_RANKING_POLICY_RELATIONSHIP_SIGNAL_WEIGHT[key] ??
          0.55)
      );
    }, 0);

    score += overlap.length
      ? clampUnit(weightedOverlap / maxSafe(targetSignals.length, 1)) *
        MEMORY_RANKING_POLICY_DEFAULTS.relationshipBoost
      : 0;
  }

  if (
    prepared.actorPersonaId &&
    normalizeOptionalToken(anchor.subject.actorPersonaId) === prepared.actorPersonaId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.exactActorPersonaBoost;
  }

  if (anchor.salience.relationship > 0.5) {
    score += 0.18;
  }

  if (anchor.relationshipRefs.length) {
    score += 0.06;
  }

  return clampUnit(score);
}

function emotionScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): number {
  const signals = normalizeStringList([
    ...prepared.emotionSignals,
    ...(candidate.emotionSignals ?? []),
    ...(candidate.pressureSignals ?? []),
    ...(candidate.shadowSignals ?? []),
  ]);

  if (!signals.length) {
    return anchor.payload.emotions.length ? 0.2 : 0;
  }

  const overlap = intersectTags(normalizeStringList(anchor.payload.emotions), signals);
  const ratio = overlap.length / maxSafe(signals.length, 1);
  const weightedOverlap = overlap.reduce((sum, value) => {
    const key = normalizeToken(value);
    return (
      sum +
      (MEMORY_RANKING_POLICY_EMOTION_SIGNAL_WEIGHT[key.toUpperCase()] ??
        MEMORY_RANKING_POLICY_EMOTION_SIGNAL_WEIGHT[key] ??
        0.52)
    );
  }, 0);
  const salienceBias = clampUnit(anchor.salience.emotional);

  return clampUnit(
    ratio * 0.4 +
      clampUnit(weightedOverlap / maxSafe(overlap.length, 1)) * 0.38 +
      salienceBias * 0.22,
  );
}

function continuityScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): number {
  let score = 0;
  const candidateModeId = normalizeOptionalToken(candidate.currentModeId);

  if (
    anchor.continuity.carriesAcrossModes &&
    prepared.currentModeId &&
    candidateModeId &&
    prepared.currentModeId === candidateModeId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.currentModeBoost;
  } else if (anchor.continuity.carriesAcrossModes && prepared.currentModeId) {
    score += 0.16;
  }

  if (anchor.continuity.carriesAcrossRuns && prepared.runId) {
    score += 0.18;
  }

  if (anchor.continuity.unresolved && prepared.preferUnresolved) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.unresolvedBoost;
  }

  if (anchor.continuity.followPersonaIds.length && prepared.actorPersonaId) {
    const normalizedFollowPersonaIds = normalizeStringList(anchor.continuity.followPersonaIds);
    score += normalizedFollowPersonaIds.includes(prepared.actorPersonaId) ? 0.14 : 0;
  }

  if (anchor.continuity.predecessorAnchorIds.length) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.predecessorSuccessorBoost * 0.5;
  }

  if (anchor.continuity.successorAnchorIds.length) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.predecessorSuccessorBoost * 0.5;
  }

  if (
    prepared.momentId &&
    normalizeOptionalToken(anchor.subject.momentId) === prepared.momentId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.momentMatchBoost;
  }

  if (
    prepared.sceneId &&
    normalizeOptionalToken(anchor.subject.sceneId) === prepared.sceneId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.sceneMatchBoost;
  }

  return clampUnit(score);
}

function continuityScoreFromPreparedContext(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
): number {
  return continuityScore(anchor, prepared, createMemoryRankingCandidate(anchor));
}

function scopeScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): number {
  let score = 0;

  if (
    prepared.roomId &&
    normalizeOptionalToken(anchor.subject.roomId) === prepared.roomId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.roomMatchBoost;
  }

  if (
    prepared.channelId &&
    normalizeOptionalToken(anchor.subject.channelId) === prepared.channelId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.channelMatchBoost;
  }

  if (
    prepared.runId &&
    normalizeOptionalToken(anchor.subject.runId) === prepared.runId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.runMatchBoost;
  }

  if (
    prepared.sceneId &&
    normalizeOptionalToken(anchor.subject.sceneId) === prepared.sceneId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.sceneMatchBoost;
  }

  if (
    prepared.momentId &&
    normalizeOptionalToken(anchor.subject.momentId) === prepared.momentId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.momentMatchBoost;
  }

  if (
    prepared.actorId &&
    normalizeOptionalToken(anchor.subject.actorId) === prepared.actorId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.actorMatchBoost;
  }

  const candidateModeId = normalizeOptionalToken(candidate.currentModeId);
  if (
    candidateModeId &&
    prepared.currentModeId &&
    candidateModeId === prepared.currentModeId
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.currentModeBoost;
  }

  return clampUnit(score);
}

function callbackScore(anchor: MemoryAnchor, prepared: PreparedRankingContext): number {
  let score = 0;

  if (anchor.payload.callbackPhrases.length) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.callbackPhraseBoost;
  }

  if (anchor.quoteRefs.length) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.quoteBoost;
  }

  if (
    prepared.alreadyUsedCallbackPhrases.length &&
    anchor.payload.callbackPhrases.length
  ) {
    const normalizedCallbackPhrases = normalizeStringList(anchor.payload.callbackPhrases);
    const unused = normalizedCallbackPhrases.filter((phrase) => {
      return !prepared.alreadyUsedCallbackPhrases.includes(phrase);
    });
    score += unused.length ? 0.08 : -0.16;
  }

  return clampUnit(score);
}

function requiredMissPenaltyScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
): number {
  const requiredTags = prepared.requiredTags;
  if (!requiredTags.length) {
    return 0;
  }

  const overlap = requiredTags.filter((tag) => memoryAnchorHasTag(anchor, tag));
  if (overlap.length === requiredTags.length) {
    return 0;
  }

  return (
    MEMORY_RANKING_POLICY_DEFAULTS.requiredTagMissPenalty *
    ((requiredTags.length - overlap.length) / requiredTags.length)
  );
}

function retrievalSignalScore(
  candidate: MemoryRankingCandidate,
  prepared: PreparedRankingContext,
): number {
  const retrievalSource = candidate.retrievalSource ?? 'UNKNOWN';
  const retrievalSourceWeight =
    MEMORY_RANKING_POLICY_RETRIEVAL_SOURCE_WEIGHT[retrievalSource] ??
    MEMORY_RANKING_POLICY_RETRIEVAL_SOURCE_WEIGHT.UNKNOWN;

  const ordinal = Number.isFinite(candidate.retrievalOrdinal)
    ? Math.max(0, Math.floor(candidate.retrievalOrdinal as number))
    : MEMORY_RANKING_POLICY_DEFAULTS.retrievalOrdinalSpan;

  const ordinalRatio =
    1 -
    Math.min(ordinal, MEMORY_RANKING_POLICY_DEFAULTS.retrievalOrdinalSpan) /
      maxSafe(MEMORY_RANKING_POLICY_DEFAULTS.retrievalOrdinalSpan, 1);

  const desiredBoost = prepared.desiredRetrievalSources.includes(retrievalSource)
    ? 0.08
    : 0;
  const disfavoredPenalty = prepared.disfavoredRetrievalSources.includes(retrievalSource)
    ? 0.1
    : 0;

  return clampUnit(
    retrievalSourceWeight * MEMORY_RANKING_POLICY_DEFAULTS.retrievalSourceBoost +
      ordinalRatio * MEMORY_RANKING_POLICY_DEFAULTS.retrievalOrdinalBoost +
      desiredBoost -
      disfavoredPenalty,
  );
}

function targetKindScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
): number {
  if (!prepared.targetKinds.length) {
    return 0.5;
  }

  return prepared.targetKinds.includes(anchor.kind) ? 1 : 0;
}

function baselineScore(
  canonicalScore: number,
  canonicalRankHint: number | undefined,
  prepared: PreparedRankingContext,
): number {
  const scorePortion = clampUnit(
    Math.max(
      0,
      canonicalScore - MEMORY_RANKING_POLICY_DEFAULTS.minimumCanonicalScore,
    ) + MEMORY_RANKING_POLICY_DEFAULTS.canonicalBackstopBoost,
  );
  const rankBoost = canonicalRankHint
    ? clampUnit(
        1 -
          (canonicalRankHint - 1) /
            maxSafe(prepared.topK + MEMORY_RANKING_POLICY_DEFAULTS.canonicalBaselineTopK, 1),
      ) * MEMORY_RANKING_POLICY_DEFAULTS.baselineRankBoost
    : 0;

  return clampUnit(scorePortion + rankBoost);
}

function modeMoodScore(
  prepared: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
  anchor: MemoryAnchor,
): number {
  let score = 0;
  const modeTags = extractModeMoodTags(prepared.currentModeId);
  const moodTags = normalizeStringList([
    ...modeTags,
    prepared.currentStageMood,
    candidate.currentStageMood,
    candidate.currentPhaseId,
    ...candidate.currentTags ?? [],
    ...candidate.strategyTags ?? [],
    ...candidate.authoredHints ?? [],
  ]);

  if (!moodTags.length) {
    return 0.5;
  }

  const corpus = collectAnchorSearchCorpus(anchor);
  const overlap = intersectTags(moodTags, corpus);

  score += overlap.length / maxSafe(moodTags.length, 1);

  if (
    prepared.currentModeId &&
    candidate.currentModeId &&
    prepared.currentModeId === normalizeOptionalToken(candidate.currentModeId)
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.modeMoodBoost;
  }

  if (
    prepared.currentStageMood &&
    overlap.includes(prepared.currentStageMood)
  ) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.modeMoodBoost;
  }

  return clampUnit(score);
}

function familyScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
): number {
  let score = 0;

  if (anchor.continuity.familyId) {
    score += MEMORY_RANKING_POLICY_DEFAULTS.familyContinuationBoost;
  }

  if (
    anchor.continuity.familyId &&
    prepared.excludedFamilyIds.includes(normalizeToken(anchor.continuity.familyId))
  ) {
    score -= MEMORY_RANKING_POLICY_DEFAULTS.duplicateFamilyPenalty * 0.6;
  }

  if (anchor.continuity.predecessorAnchorIds.length) {
    score += 0.05;
  }

  if (anchor.continuity.successorAnchorIds.length) {
    score += 0.05;
  }

  return clampUnit(score);
}

function purposeScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
  lane: MemoryRankingLane,
): number {
  const purpose = normalizeToken(String(anchor.purpose || inferAnchorPurpose(anchor.kind)));
  const normalizedPurposeUpper = purpose.toUpperCase();
  const base =
    MEMORY_RANKING_POLICY_PURPOSE_WEIGHT[normalizedPurposeUpper] ??
    MEMORY_RANKING_POLICY_PURPOSE_WEIGHT[purpose] ??
    0.5;

  const requiredBoost = prepared.requiredPurposes.includes(purpose)
    ? MEMORY_RANKING_POLICY_DEFAULTS.purposeMatchBoost
    : 0;
  const laneBoost = lane === prepared.preferredLane
    ? MEMORY_RANKING_POLICY_DEFAULTS.laneBiasBoost
    : 0;

  return clampUnit(base * 0.72 + requiredBoost + laneBoost);
}

function evidenceVarietyScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
): number {
  if (!anchor.evidence.length) {
    return 0;
  }

  const kinds = dedupeStrings(anchor.evidence.map((value) => normalizeToken(value.kind)));
  const weighted = kinds.reduce((sum, kind) => {
    return (
      sum +
      (MEMORY_RANKING_POLICY_EVIDENCE_KIND_WEIGHT[kind.toUpperCase()] ??
        MEMORY_RANKING_POLICY_EVIDENCE_KIND_WEIGHT[kind] ??
        0.5)
    );
  }, 0);

  const hintOverlap = intersectTags(
    prepared.evidenceHints,
    kinds,
  ).length;

  return clampUnit(
    weighted / maxSafe(kinds.length, 1) * 0.84 +
      hintOverlap / maxSafe(prepared.evidenceHints.length || 1, 1) * 0.16,
  );
}

function proofDensityScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
): number {
  const quoted = anchor.quoteRefs.length ? 0.28 : 0;
  const related = anchor.relationshipRefs.length ? 0.22 : 0;
  const evidence = clampUnit(anchor.evidence.length / 4) * 0.3;
  const proofPressure = prepared.proofPressure * MEMORY_RANKING_POLICY_DEFAULTS.proofPressureBoost;
  const humiliationPressure =
    prepared.humiliationPressure * MEMORY_RANKING_POLICY_DEFAULTS.humiliationPressureBoost;
  const urgencyPressure =
    prepared.urgencyPressure * MEMORY_RANKING_POLICY_DEFAULTS.urgencyPressureBoost;

  return clampUnit(quoted + related + evidence + proofPressure + humiliationPressure + urgencyPressure);
}

function freshnessWindowScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
): number {
  const freshnessAgeMs = Math.max(
    0,
    prepared.nowMs -
      Math.max(
        anchor.formation.reaffirmedAtMs ?? 0,
        anchor.formation.updatedAtMs,
        anchor.formation.firstSeenAtMs,
        anchor.formation.createdAtMs,
      ),
  );

  if (freshnessAgeMs <= MEMORY_RANKING_POLICY_DEFAULTS.freshnessWindowMs) {
    return MEMORY_RANKING_POLICY_DEFAULTS.freshnessWindowBoost;
  }

  if (prepared.sceneIntensity > 0.5 && freshnessAgeMs <= MEMORY_RANKING_POLICY_DEFAULTS.freshnessWindowMs * 3) {
    return MEMORY_RANKING_POLICY_DEFAULTS.freshnessWindowBoost * 0.5;
  }

  return 0;
}

function queryTextScore(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): number {
  if (!prepared.queryTokens.length) {
    return MEMORY_RANKING_POLICY_DEFAULTS.queryTextFallback;
  }

  const anchorCorpus = collectAnchorSearchCorpus(anchor);
  const baseOverlap = textOverlapScore(prepared.queryTokens, anchorCorpus);

  const embeddingPreviewCorpus = normalizeStringList(
    (candidate.embeddingMatches ?? []).flatMap((match) => {
      return [
        ...(match.tags ?? []),
        ...tokenizeText(match.preview),
      ];
    }),
  );

  const authoredOverlap = textOverlapScore(
    prepared.queryTokens,
    normalizeStringList([
      ...(candidate.authoredHints ?? []),
      ...(candidate.strategyTags ?? []),
      ...(candidate.evidenceHints ?? []),
      ...(candidate.shadowSignals ?? []),
    ]),
  );
  const previewOverlap = textOverlapScore(prepared.queryTokens, embeddingPreviewCorpus);

  return clampUnit(baseOverlap * 0.68 + previewOverlap * 0.18 + authoredOverlap * 0.14);
}

function inferLane(
  anchor: MemoryAnchor,
  prepared: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): MemoryRankingLane {
  const explicit = candidate.lane;
  if (explicit) {
    return explicit;
  }

  const signalLane = inferLaneFromSignals(
    [
      ...prepared.currentTags,
      ...(candidate.currentTags ?? []),
    ],
    candidate.strategyTags ?? [],
    candidate.shadowSignals ?? [],
    candidate.pressureSignals ?? [],
    candidate.authoredHints ?? [],
  );

  if (signalLane !== 'GENERAL') {
    return signalLane;
  }

  const priorityLanes = MEMORY_RANKING_POLICY_INTENT_LANES[prepared.intent];
  const corpus = collectAnchorSearchCorpus(anchor);
  let bestLane: MemoryRankingLane = prepared.preferredLane;
  let bestScore = -1;

  for (const lane of priorityLanes) {
    const aliases = extractLaneAliases(lane);
    const overlap = intersectTags(aliases, corpus).length;
    const laneScore = overlap / maxSafe(aliases.length, 1) + (lane === prepared.preferredLane ? 0.08 : 0);

    if (laneScore > bestScore) {
      bestScore = laneScore;
      bestLane = lane;
    }
  }

  return bestLane;
}

function inferLaneFromSignals(
  currentTags: readonly string[],
  strategyTags: readonly string[],
  shadowSignals: readonly string[],
  pressureSignals: readonly string[],
  authoredHints: readonly string[],
): MemoryRankingLane {
  const corpus = normalizeStringList([
    ...currentTags,
    ...strategyTags,
    ...shadowSignals,
    ...pressureSignals,
    ...authoredHints,
  ]);

  let bestLane: MemoryRankingLane = 'GENERAL';
  let bestScore = 0;

  for (const lane of allLanes()) {
    const aliases = extractLaneAliases(lane);
    const overlap = intersectTags(aliases, corpus).length;
    const score = overlap / maxSafe(aliases.length, 1);

    if (score > bestScore) {
      bestScore = score;
      bestLane = lane;
    }
  }

  return bestLane;
}

function allLanes(): readonly MemoryRankingLane[] {
  return Object.freeze([
    'GENERAL',
    'CALLBACK',
    'RESCUE',
    'TAUNT',
    'CELEBRATION',
    'RELATIONSHIP',
    'DEALROOM',
    'POSTRUN',
    'LIVEOPS',
    'RANKING',
  ]);
}

function defaultLaneForIntent(intent: MemoryAnchorQueryIntent): MemoryRankingLane {
  switch (intent) {
    case 'CALLBACK':
      return 'CALLBACK';
    case 'RESCUE':
      return 'RESCUE';
    case 'TAUNT':
      return 'TAUNT';
    case 'CELEBRATION':
      return 'CELEBRATION';
    case 'RELATIONSHIP_CONTEXT':
      return 'RELATIONSHIP';
    case 'DEALROOM_CONTEXT':
      return 'DEALROOM';
    case 'POSTRUN_CONTEXT':
      return 'POSTRUN';
    case 'LIVEOPS_CONTEXT':
      return 'LIVEOPS';
    case 'RANKING_CONTEXT':
      return 'RANKING';
    default:
      return 'GENERAL';
  }
}

function extractIntentSynonyms(intent: MemoryAnchorQueryIntent): readonly string[] {
  const lookup = defaultLaneForIntent(intent);
  return extractLaneAliases(lookup);
}

function extractLaneAliases(lane: MemoryRankingLane): readonly string[] {
  const key = lane.toLowerCase();
  const aliases =
    MEMORY_RANKING_POLICY_LANE_ALIASES[key.toUpperCase()] ??
    MEMORY_RANKING_POLICY_LANE_ALIASES[key] ??
    [];
  return normalizeStringList(aliases);
}

function extractModeMoodTags(modeId: string | undefined): readonly string[] {
  const normalized = normalizeOptionalToken(modeId);
  if (!normalized) {
    return Object.freeze([]);
  }

  return normalizeStringList(
    MEMORY_RANKING_POLICY_MODE_MOOD_LEXICON[normalized.toUpperCase()] ??
      MEMORY_RANKING_POLICY_MODE_MOOD_LEXICON[normalized] ??
      [],
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
    anchor.subject.sourceKind,
    anchor.subject.sourceId,
    anchor.subject.quoteId,
    anchor.continuity.familyId,
    ...anchor.continuity.followPersonaIds,
    ...anchor.continuity.predecessorAnchorIds,
    ...anchor.continuity.successorAnchorIds,
    ...anchor.retrieval.queryIntents,
    String(anchor.purpose),
    String(anchor.retentionClass),
  ]);
}

function collectAnchorSearchCorpus(anchor: MemoryAnchor): readonly string[] {
  return normalizeStringList([
    ...tokenizeText(anchor.payload.headline),
    ...tokenizeText(anchor.payload.summary),
    ...tokenizeText(anchor.payload.canonicalText),
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
    ...anchor.continuity.followPersonaIds,
    anchor.continuity.familyId,
    anchor.subject.roomId,
    anchor.subject.channelId,
    anchor.subject.runId,
    anchor.subject.sceneId,
    anchor.subject.momentId,
    anchor.subject.actorId,
    anchor.subject.actorPersonaId,
    anchor.subject.relationshipId,
    anchor.subject.sourceKind,
    String(anchor.purpose),
    String(anchor.retentionClass),
    ...anchor.debugNotes,
    ...anchor.evidence.flatMap((value) => [
      value.kind,
      value.documentId,
      value.quoteId,
      value.relationshipId,
      value.sceneId,
      value.momentId,
      value.messageId,
      ...tokenizeText(value.description),
      ...tokenizeText(value.excerpt),
    ]),
  ]);
}

function collectCandidateTags(
  prepared: PreparedRankingContext,
  candidate: MemoryRankingCandidate,
): readonly string[] {
  return normalizeStringList([
    ...prepared.requiredTags,
    ...prepared.currentTags,
    ...(candidate.currentTags ?? []),
    ...prepared.relationshipSignals,
    ...(candidate.relationshipSignals ?? []),
    ...prepared.emotionSignals,
    ...(candidate.emotionSignals ?? []),
    ...prepared.authoredHints,
    ...(candidate.authoredHints ?? []),
    ...prepared.strategyTags,
    ...(candidate.strategyTags ?? []),
    ...prepared.evidenceHints,
    ...(candidate.evidenceHints ?? []),
    ...(candidate.shadowSignals ?? []),
    ...(candidate.pressureSignals ?? []),
    ...(candidate.reputationSignals ?? []),
    ...(candidate.audienceSignals ?? []),
    prepared.currentModeId,
    candidate.currentModeId,
    prepared.currentStageMood,
    candidate.currentStageMood,
    prepared.currentPhaseId,
    candidate.currentPhaseId,
    prepared.roomId,
    prepared.channelId,
    prepared.runId,
    prepared.sceneId,
    prepared.momentId,
    prepared.actorId,
    prepared.actorPersonaId,
    prepared.relationshipId,
    candidate.retrievalSource,
    candidate.sourceWindowId,
    ...(candidate.embeddingMatches ?? []).flatMap((match) => {
      return [match.kind, ...(match.tags ?? []), ...(tokenizeText(match.preview) ?? [])];
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

function compareInternalRankedAnchors(
  left: InternalRankedMemoryAnchor,
  right: InternalRankedMemoryAnchor,
): number {
  return (
    right.finalScore - left.finalScore ||
    right.retrievalScore - left.retrievalScore ||
    right.canonicalScore - left.canonicalScore ||
    right.anchor.salience.final - left.anchor.salience.final ||
    right.anchor.formation.updatedAtMs - left.anchor.formation.updatedAtMs ||
    right.anchor.formation.createdAtMs - left.anchor.formation.createdAtMs ||
    left.anchor.id.localeCompare(right.anchor.id)
  );
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

function dedupeStrings(values: readonly (string | undefined | null)[]): readonly string[] {
  return normalizeStringList(values);
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
