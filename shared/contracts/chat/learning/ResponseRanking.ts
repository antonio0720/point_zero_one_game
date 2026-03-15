/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT RESPONSE RANKING CONTRACTS
 * FILE: shared/contracts/chat/learning/ResponseRanking.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical candidate, context, scoring, rerank, receipt, and evaluation
 * contracts for the unified chat response ranking lane.
 *
 * Ranking doctrine
 * ----------------
 * 1. Ranking orders candidates; it never bypasses backend policy.
 * 2. Ranking must preserve helper timing, hater escalation, negotiation
 *    counterplay, memory continuity, rescue interception, and scene pacing.
 * 3. Score breakdowns must be explainable and replay-linkable.
 * ============================================================================
 */
import {
  type Brand,
  type ChatChannelId,
  type ChatModeScope,
  type ChatMountTarget,
  type ChatRoomId,
  type JsonObject,
  type Optional,
  type Score01,
  type Score100,
  type UnixMs,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from '../ChatChannels';

import {
  type ChatAuthority,
  type ChatInterventionId,
  type ChatLegendId,
  type ChatMemoryAnchorId,
  type ChatMessageId,
  type ChatNpcId,
  type ChatOfferId,
  type ChatProofHash,
  type ChatReplayId,
  type ChatSceneId,
  type ChatSessionId,
  type ChatTelemetryId,
  type ChatUserId,
  type ChatWorldEventId,
  CHAT_AUTHORITIES,
} from '../ChatEvents';

import {
  type ChatMessageKind,
  type ChatMessageToneBand,
  type ChatMessageVisibilityClass,
  type ChatThreadId,
} from '../ChatMessage';

import {
  type ChatModerationDecision,
  type ChatModerationSeverityBand,
} from '../ChatModeration';

import {
  type ChatInvasionClass,
  type ChatInvasionId,
  type ChatInvasionKind,
  type ChatInvasionStage,
} from '../ChatInvasion';

import {
  type LearningColdStartBasis,
  type LearningEvaluationVerdict,
  type LearningFeatureBag,
  type LearningFeatureName,
  type LearningInterventionOutcome,
  type LearningLabel,
  type LearningLabelConfidenceBand,
  type LearningLabelKind,
  type LearningModelFamily,
  type LearningModelRef,
  type LearningObservationWindow,
  type LearningPrivacyEnvelope,
  type LearningProfileId,
  type LearningRankingObservation,
  type LearningRankingObservationId,
  type LearningRankingSource,
  LEARNING_DEFAULT_PRIVACY_ENVELOPE,
  LEARNING_EMPTY_OBSERVATION_WINDOW,
  LEARNING_EVALUATION_VERDICTS,
  LEARNING_INTERVENTION_OUTCOMES,
  LEARNING_LABEL_CONFIDENCE_BANDS,
  LEARNING_LABEL_KINDS,
  LEARNING_MODEL_FAMILIES,
  LEARNING_RANKING_SOURCES,
} from './LearningEvents';

import {
  type LearningCanonicalFeatureGroup,
  type LearningFeatureManifest,
  type LearningFeatureSetRecord,
  type LearningFeatureSnapshot,
  type LearningFeatureVectorSegment,
  LEARNING_CANONICAL_FEATURE_GROUPS,
  LEARNING_CANONICAL_FEATURE_NAMES,
  LEARNING_FEATURE_VECTOR_SEGMENTS,
} from './LearningFeatures';

import {
  type LearningEmotionProfile,
  type LearningHaterSusceptibilityProfile,
  type LearningHelperReceptivityProfile,
  type LearningMemoryProfile,
  type LearningNegotiationProfile,
  type LearningProfileAuthority,
  type LearningProfileHeader,
  type LearningRoomSignature,
  LEARNING_PROFILE_AUTHORITIES,
} from './LearningProfile';

import {
  type LearningDatasetTarget,
  type LearningTruthSet,
} from './LearningLabels';

import {
  type LearningColdStartPacket,
  type LearningColdStartPolicyKind,
  type LearningColdStartVectorPreset,
  LEARNING_COLD_START_CONTRACT_MANIFEST,
  LEARNING_DEFAULT_COLD_START_RANKING_SEEDS,
} from './ColdStartDefaults';

// ============================================================================
// MARK: Local identifiers
// ============================================================================
export type LearningResponseCandidateId = Brand<string, 'LearningResponseCandidateId'>;
export type LearningRankingRequestId = Brand<string, 'LearningRankingRequestId'>;
export type LearningRankingResultId = Brand<string, 'LearningRankingResultId'>;
export type LearningRankingReceiptId = Brand<string, 'LearningRankingReceiptId'>;
export type LearningRankingPolicyId = Brand<string, 'LearningRankingPolicyId'>;
export type LearningRankingWeightSetId = Brand<string, 'LearningRankingWeightSetId'>;
export type LearningRankingContextId = Brand<string, 'LearningRankingContextId'>;
export type LearningRankingGuardrailId = Brand<string, 'LearningRankingGuardrailId'>;
export type LearningRankingScoreId = Brand<string, 'LearningRankingScoreId'>;
export type LearningRankingExplanationId = Brand<string, 'LearningRankingExplanationId'>;
export type LearningRankingDecisionId = Brand<string, 'LearningRankingDecisionId'>;
export type LearningRankingFamilyId = Brand<string, 'LearningRankingFamilyId'>;
export type LearningRankingEvaluationCaseId = Brand<string, 'LearningRankingEvaluationCaseId'>;
export type LearningRankingCandidateSetId = Brand<string, 'LearningRankingCandidateSetId'>;

// ============================================================================
// MARK: Vocabularies
// ============================================================================
export const LEARNING_RESPONSE_CANDIDATE_KINDS = [
  'HELPER_LINE',
  'HATER_LINE',
  'AMBIENT_NPC_LINE',
  'CHANNEL_SWITCH',
  'DEALROOM_COUNTER',
  'RESCUE_PROMPT',
  'POST_RUN_SUMMARY',
  'SYSTEM_NOTICE',
] as const;
export const LEARNING_RANKING_POLICY_KINDS = [
  'HELPER_TIMING',
  'HATER_ESCALATION',
  'AMBIENT_SCENE',
  'CHANNEL_RECOMMENDATION',
  'NEGOTIATION_COUNTER',
  'RESCUE_INTERCEPTION',
  'POST_RUN_RITUAL',
  'MIXED_SCENE',
] as const;
export const LEARNING_RANKING_COMPONENT_KINDS = [
  'BASE_PRIOR',
  'FEATURE_MATCH',
  'PROFILE_MATCH',
  'MEMORY_CONTINUITY',
  'EMOTION_TIMING',
  'NEGOTIATION_FIT',
  'SCENE_PACING',
  'CHANNEL_FIT',
  'NPC_VOICE_FIT',
  'SAFETY_GUARDRAIL',
  'DIVERSITY_BONUS',
  'NOVELTY_BONUS',
  'REPLAY_CONTINUITY',
  'LATENCY_COST',
  'LIVEOPS_ALIGNMENT',
] as const;
export const LEARNING_RANKING_GUARDRAIL_KINDS = [
  'MODERATION_BLOCK',
  'CHANNEL_BLOCK',
  'PACING_BLOCK',
  'NPC_SUPPRESSION',
  'RISK_CAP',
  'NEGOTIATION_SANITY',
  'RESCUE_PRIORITY',
  'LIVEOPS_SUPPRESSION',
  'PRIVACY_RESTRICTION',
] as const;
export const LEARNING_RANKING_GUARDRAIL_VERDICTS = [
  'PASS',
  'SOFT_PENALTY',
  'HARD_BLOCK',
  'DEFER',
] as const;
export const LEARNING_RANKING_EXPLANATION_KINDS = [
  'TOP_REASON',
  'MATCH_SIGNAL',
  'RISK_SIGNAL',
  'MEMORY_SIGNAL',
  'NEGOTIATION_SIGNAL',
  'SCENE_SIGNAL',
  'COLD_START_SIGNAL',
  'GUARDRAIL_SIGNAL',
] as const;
export const LEARNING_RANKING_DECISION_KINDS = [
  'SELECT_ONE',
  'SELECT_TOP_K',
  'SELECT_AND_STAGE',
  'SELECT_AND_DEFER',
  'NO_SAFE_CANDIDATE',
] as const;
export const LEARNING_RANKING_ORDERING_MODES = [
  'TOTAL_SCORE',
  'SAFETY_THEN_SCORE',
  'SCENE_THEN_SCORE',
  'NEGOTIATION_THEN_SCORE',
  'RESCUE_THEN_SCORE',
] as const;
export type LearningResponseCandidateKind = (typeof LEARNING_RESPONSE_CANDIDATE_KINDS)[number];
export type LearningRankingPolicyKind = (typeof LEARNING_RANKING_POLICY_KINDS)[number];
export type LearningRankingComponentKind = (typeof LEARNING_RANKING_COMPONENT_KINDS)[number];
export type LearningRankingGuardrailKind = (typeof LEARNING_RANKING_GUARDRAIL_KINDS)[number];
export type LearningRankingGuardrailVerdict = (typeof LEARNING_RANKING_GUARDRAIL_VERDICTS)[number];
export type LearningRankingExplanationKind = (typeof LEARNING_RANKING_EXPLANATION_KINDS)[number];
export type LearningRankingDecisionKind = (typeof LEARNING_RANKING_DECISION_KINDS)[number];
export type LearningRankingOrderingMode = (typeof LEARNING_RANKING_ORDERING_MODES)[number];

// ============================================================================
// MARK: Interfaces
// ============================================================================
export interface LearningResponseCandidatePayload {
  readonly body: string;
  readonly toneBand: ChatMessageToneBand;
  readonly visibilityClass: ChatMessageVisibilityClass;
  readonly messageKind: ChatMessageKind;
  readonly npcId?: ChatNpcId;
  readonly offerId?: ChatOfferId;
  readonly interventionId?: ChatInterventionId;
  readonly worldEventId?: ChatWorldEventId;
  readonly sceneId?: ChatSceneId;
  readonly proofHash?: ChatProofHash;
}
export interface LearningResponseCandidateConstraints {
  readonly allowedChannels: readonly ChatChannelId[];
  readonly blockedChannels: readonly ChatChannelId[];
  readonly allowedModes: readonly ChatModeScope[];
  readonly blockedModes: readonly ChatModeScope[];
  readonly allowedMounts: readonly ChatMountTarget[];
  readonly maxRiskScore: Score01;
  readonly requiresNpcPresence?: boolean;
  readonly requiresInvasionContext?: boolean;
  readonly requiresOfferContext?: boolean;
  readonly requiresMemoryContext?: boolean;
}
export interface LearningResponseCandidate {
  readonly candidateId: LearningResponseCandidateId;
  readonly candidateSetId: LearningRankingCandidateSetId;
  readonly source: LearningRankingSource;
  readonly candidateKind: LearningResponseCandidateKind;
  readonly payload: LearningResponseCandidatePayload;
  readonly constraints: LearningResponseCandidateConstraints;
  readonly featureBag?: LearningFeatureBag;
  readonly labels?: readonly LearningLabel[];
  readonly coldStartBasis?: LearningColdStartBasis;
  readonly coldStartVectorPreset?: LearningColdStartVectorPreset;
  readonly trainingExampleEligible: boolean;
}
export interface LearningRankingContextBundle {
  readonly contextId: LearningRankingContextId;
  readonly profileId: LearningProfileId;
  readonly authority: LearningProfileAuthority;
  readonly channelId: ChatChannelId;
  readonly mode: ChatModeScope;
  readonly mountTarget: ChatMountTarget;
  readonly roomId?: ChatRoomId;
  readonly roomSignature?: LearningRoomSignature;
  readonly sessionId: ChatSessionId;
  readonly userId: ChatUserId;
  readonly threadId?: ChatThreadId;
  readonly messageId?: ChatMessageId;
  readonly sceneId?: ChatSceneId;
  readonly replayId?: ChatReplayId;
  readonly invasionId?: ChatInvasionId;
  readonly invasionClass?: ChatInvasionClass;
  readonly invasionKind?: ChatInvasionKind;
  readonly invasionStage?: ChatInvasionStage;
  readonly offerId?: ChatOfferId;
  readonly worldEventId?: ChatWorldEventId;
  readonly legendId?: ChatLegendId;
  readonly memoryAnchorIds: readonly ChatMemoryAnchorId[];
  readonly featureSnapshot?: LearningFeatureSnapshot;
  readonly featureSet?: LearningFeatureSetRecord;
  readonly profileHeader?: LearningProfileHeader;
  readonly helperReceptivity?: LearningHelperReceptivityProfile;
  readonly haterSusceptibility?: LearningHaterSusceptibilityProfile;
  readonly negotiation?: LearningNegotiationProfile;
  readonly emotion?: LearningEmotionProfile;
  readonly memory?: LearningMemoryProfile;
  readonly coldStartPacket?: LearningColdStartPacket;
  readonly rankingObservation?: LearningRankingObservation;
  readonly truthSet?: LearningTruthSet;
  readonly datasetTargets?: readonly LearningDatasetTarget[];
  readonly observationWindow: LearningObservationWindow;
  readonly privacy: LearningPrivacyEnvelope;
}
export interface LearningRankingComponentScore {
  readonly scoreId: LearningRankingScoreId;
  readonly candidateId: LearningResponseCandidateId;
  readonly componentKind: LearningRankingComponentKind;
  readonly rawScore: number;
  readonly weightedScore: number;
  readonly weight: number;
  readonly explanation: string;
}
export interface LearningRankingGuardrailResult {
  readonly guardrailId: LearningRankingGuardrailId;
  readonly candidateId: LearningResponseCandidateId;
  readonly guardrailKind: LearningRankingGuardrailKind;
  readonly verdict: LearningRankingGuardrailVerdict;
  readonly riskScore: Score01;
  readonly explanation: string;
}
export interface LearningRankingExplanation {
  readonly explanationId: LearningRankingExplanationId;
  readonly candidateId: LearningResponseCandidateId;
  readonly kind: LearningRankingExplanationKind;
  readonly summary: string;
  readonly evidenceMessageIds: readonly ChatMessageId[];
  readonly evidenceAnchorIds: readonly ChatMemoryAnchorId[];
}
export interface LearningRankingCandidateScore {
  readonly candidateId: LearningResponseCandidateId;
  readonly totalScore: number;
  readonly safetyScore: Score01;
  readonly continuityScore: Score01;
  readonly noveltyScore: Score01;
  readonly diversityScore: Score01;
  readonly latencyCostScore: Score01;
  readonly componentScores: readonly LearningRankingComponentScore[];
  readonly guardrails: readonly LearningRankingGuardrailResult[];
  readonly explanations: readonly LearningRankingExplanation[];
  readonly blocked: boolean;
}
export interface LearningRankingWeightSet {
  readonly weightSetId: LearningRankingWeightSetId;
  readonly policyKind: LearningRankingPolicyKind;
  readonly source: LearningRankingSource;
  readonly orderingMode: LearningRankingOrderingMode;
  readonly basePriorWeight: number;
  readonly featureMatchWeight: number;
  readonly profileMatchWeight: number;
  readonly memoryContinuityWeight: number;
  readonly emotionTimingWeight: number;
  readonly negotiationFitWeight: number;
  readonly scenePacingWeight: number;
  readonly channelFitWeight: number;
  readonly npcVoiceFitWeight: number;
  readonly safetyGuardrailWeight: number;
  readonly diversityBonusWeight: number;
  readonly noveltyBonusWeight: number;
  readonly replayContinuityWeight: number;
  readonly latencyCostWeight: number;
  readonly liveopsAlignmentWeight: number;
}
export interface LearningRankingPolicy {
  readonly policyId: LearningRankingPolicyId;
  readonly familyId: LearningRankingFamilyId;
  readonly kind: LearningRankingPolicyKind;
  readonly source: LearningRankingSource;
  readonly description: string;
  readonly orderingMode: LearningRankingOrderingMode;
  readonly topK: number;
  readonly minimumSafeScore: Score01;
  readonly minimumContinuityScore: Score01;
  readonly maximumRiskScore: Score01;
  readonly enabled: boolean;
  readonly weightSet: LearningRankingWeightSet;
}
export interface LearningRankingRequest {
  readonly requestId: LearningRankingRequestId;
  readonly profileId: LearningProfileId;
  readonly source: LearningRankingSource;
  readonly policyKind: LearningRankingPolicyKind;
  readonly context: LearningRankingContextBundle;
  readonly candidates: readonly LearningResponseCandidate[];
  readonly modelRef?: LearningModelRef;
  readonly coldStartBasis?: LearningColdStartBasis;
  readonly privacy: LearningPrivacyEnvelope;
  readonly createdAt: UnixMs;
}
export interface LearningRankingDecision {
  readonly decisionId: LearningRankingDecisionId;
  readonly kind: LearningRankingDecisionKind;
  readonly selectedCandidateIds: readonly LearningResponseCandidateId[];
  readonly stagedCandidateIds: readonly LearningResponseCandidateId[];
  readonly blockedCandidateIds: readonly LearningResponseCandidateId[];
  readonly rationale: readonly string[];
}
export interface LearningRankingResult {
  readonly resultId: LearningRankingResultId;
  readonly requestId: LearningRankingRequestId;
  readonly source: LearningRankingSource;
  readonly policy: LearningRankingPolicy;
  readonly candidateScores: readonly LearningRankingCandidateScore[];
  readonly orderedCandidateIds: readonly LearningResponseCandidateId[];
  readonly decision: LearningRankingDecision;
  readonly createdAt: UnixMs;
}
export interface LearningRankingReceipt {
  readonly receiptId: LearningRankingReceiptId;
  readonly resultId: LearningRankingResultId;
  readonly requestId: LearningRankingRequestId;
  readonly source: LearningRankingSource;
  readonly policyId: LearningRankingPolicyId;
  readonly orderedCandidateIds: readonly LearningResponseCandidateId[];
  readonly selectedCandidateIds: readonly LearningResponseCandidateId[];
  readonly blockedCandidateIds: readonly LearningResponseCandidateId[];
  readonly observation?: LearningRankingObservation;
  readonly privacy: LearningPrivacyEnvelope;
  readonly createdAt: UnixMs;
}
export interface LearningRankingEvaluationCase {
  readonly evaluationCaseId: LearningRankingEvaluationCaseId;
  readonly source: LearningRankingSource;
  readonly request: LearningRankingRequest;
  readonly expectedCandidateIds: readonly LearningResponseCandidateId[];
  readonly expectedTopCandidateId?: LearningResponseCandidateId;
  readonly expectedOutcome?: LearningInterventionOutcome;
  readonly verdict?: LearningEvaluationVerdict;
}

// ============================================================================
// MARK: Default weight sets
// ============================================================================
export const LEARNING_DEFAULT_RANKING_WEIGHT_SETS: readonly LearningRankingWeightSet[] = [
  {
    weightSetId: 'ranking-weights::helper' as LearningRankingWeightSetId,
    policyKind: 'HELPER_TIMING',
    source: 'HELPER_RESPONSE',
    orderingMode: 'SAFETY_THEN_SCORE',
    basePriorWeight: 1.0,
    featureMatchWeight: 1.18,
    profileMatchWeight: 1.12,
    memoryContinuityWeight: 0.84,
    emotionTimingWeight: 1.26,
    negotiationFitWeight: 0.34,
    scenePacingWeight: 0.93,
    channelFitWeight: 0.71,
    npcVoiceFitWeight: 0.52,
    safetyGuardrailWeight: 1.5,
    diversityBonusWeight: 0.22,
    noveltyBonusWeight: 0.17,
    replayContinuityWeight: 0.34,
    latencyCostWeight: 0.28,
    liveopsAlignmentWeight: 0.19,
  },
  {
    weightSetId: 'ranking-weights::hater' as LearningRankingWeightSetId,
    policyKind: 'HATER_ESCALATION',
    source: 'HATER_RESPONSE',
    orderingMode: 'TOTAL_SCORE',
    basePriorWeight: 1.04,
    featureMatchWeight: 1.09,
    profileMatchWeight: 1.06,
    memoryContinuityWeight: 0.98,
    emotionTimingWeight: 0.96,
    negotiationFitWeight: 0.18,
    scenePacingWeight: 1.08,
    channelFitWeight: 0.76,
    npcVoiceFitWeight: 0.81,
    safetyGuardrailWeight: 1.24,
    diversityBonusWeight: 0.31,
    noveltyBonusWeight: 0.28,
    replayContinuityWeight: 0.42,
    latencyCostWeight: 0.14,
    liveopsAlignmentWeight: 0.33,
  },
  {
    weightSetId: 'ranking-weights::dealroom' as LearningRankingWeightSetId,
    policyKind: 'NEGOTIATION_COUNTER',
    source: 'DEALROOM_COUNTER',
    orderingMode: 'NEGOTIATION_THEN_SCORE',
    basePriorWeight: 1.02,
    featureMatchWeight: 1.13,
    profileMatchWeight: 1.04,
    memoryContinuityWeight: 0.71,
    emotionTimingWeight: 0.44,
    negotiationFitWeight: 1.34,
    scenePacingWeight: 0.63,
    channelFitWeight: 0.88,
    npcVoiceFitWeight: 0.41,
    safetyGuardrailWeight: 1.11,
    diversityBonusWeight: 0.22,
    noveltyBonusWeight: 0.15,
    replayContinuityWeight: 0.29,
    latencyCostWeight: 0.11,
    liveopsAlignmentWeight: 0.21,
  },
  {
    weightSetId: 'ranking-weights::rescue' as LearningRankingWeightSetId,
    policyKind: 'RESCUE_INTERCEPTION',
    source: 'RESCUE_PROMPT',
    orderingMode: 'RESCUE_THEN_SCORE',
    basePriorWeight: 1.07,
    featureMatchWeight: 1.16,
    profileMatchWeight: 1.21,
    memoryContinuityWeight: 0.79,
    emotionTimingWeight: 1.31,
    negotiationFitWeight: 0.16,
    scenePacingWeight: 0.86,
    channelFitWeight: 0.67,
    npcVoiceFitWeight: 0.46,
    safetyGuardrailWeight: 1.63,
    diversityBonusWeight: 0.17,
    noveltyBonusWeight: 0.09,
    replayContinuityWeight: 0.23,
    latencyCostWeight: 0.33,
    liveopsAlignmentWeight: 0.18,
  },
];
export const LEARNING_DEFAULT_RANKING_POLICIES: readonly LearningRankingPolicy[] = [
  {
    policyId: 'ranking-policy::helper' as LearningRankingPolicyId,
    familyId: 'ranking-family::core' as LearningRankingFamilyId,
    kind: 'HELPER_TIMING',
    source: 'HELPER_RESPONSE',
    description: 'Ranks helper lines for timing, fit, safety, and emotional usefulness.',
    orderingMode: 'SAFETY_THEN_SCORE',
    topK: 3,
    minimumSafeScore: 0.72 as Score01,
    minimumContinuityScore: 0.31 as Score01,
    maximumRiskScore: 0.22 as Score01,
    enabled: true,
    weightSet: LEARNING_DEFAULT_RANKING_WEIGHT_SETS[0],
  },
  {
    policyId: 'ranking-policy::hater' as LearningRankingPolicyId,
    familyId: 'ranking-family::core' as LearningRankingFamilyId,
    kind: 'HATER_ESCALATION',
    source: 'HATER_RESPONSE',
    description: 'Ranks hater lines for spectacle, escalation fit, and guardrailed pressure.',
    orderingMode: 'TOTAL_SCORE',
    topK: 3,
    minimumSafeScore: 0.48 as Score01,
    minimumContinuityScore: 0.39 as Score01,
    maximumRiskScore: 0.46 as Score01,
    enabled: true,
    weightSet: LEARNING_DEFAULT_RANKING_WEIGHT_SETS[1],
  },
  {
    policyId: 'ranking-policy::dealroom' as LearningRankingPolicyId,
    familyId: 'ranking-family::core' as LearningRankingFamilyId,
    kind: 'NEGOTIATION_COUNTER',
    source: 'DEALROOM_COUNTER',
    description: 'Ranks negotiation counters for bluff fit, urgency handling, and counteroffer sanity.',
    orderingMode: 'NEGOTIATION_THEN_SCORE',
    topK: 3,
    minimumSafeScore: 0.61 as Score01,
    minimumContinuityScore: 0.22 as Score01,
    maximumRiskScore: 0.33 as Score01,
    enabled: true,
    weightSet: LEARNING_DEFAULT_RANKING_WEIGHT_SETS[2],
  },
  {
    policyId: 'ranking-policy::rescue' as LearningRankingPolicyId,
    familyId: 'ranking-family::core' as LearningRankingFamilyId,
    kind: 'RESCUE_INTERCEPTION',
    source: 'RESCUE_PROMPT',
    description: 'Ranks rescue prompts for churn prevention, safety, pacing, and personal relevance.',
    orderingMode: 'RESCUE_THEN_SCORE',
    topK: 2,
    minimumSafeScore: 0.81 as Score01,
    minimumContinuityScore: 0.24 as Score01,
    maximumRiskScore: 0.16 as Score01,
    enabled: true,
    weightSet: LEARNING_DEFAULT_RANKING_WEIGHT_SETS[3],
  },
];

// ============================================================================
// MARK: Source component defaults
// ============================================================================
export const LEARNING_RANKING_SOURCE_COMPONENT_DEFAULTS = {
  HELPER_RESPONSE: {
    BASE_PRIOR: 0.176,
    FEATURE_MATCH: 0.189,
    PROFILE_MATCH: 0.202,
    MEMORY_CONTINUITY: 0.215,
    EMOTION_TIMING: 0.228,
    NEGOTIATION_FIT: 0.241,
    SCENE_PACING: 0.254,
    CHANNEL_FIT: 0.267,
    NPC_VOICE_FIT: 0.28,
    SAFETY_GUARDRAIL: 0.293,
    DIVERSITY_BONUS: 0.306,
    NOVELTY_BONUS: 0.319,
    REPLAY_CONTINUITY: 0.332,
    LATENCY_COST: 0.345,
    LIVEOPS_ALIGNMENT: 0.358,
  },
  HATER_RESPONSE: {
    BASE_PRIOR: 0.202,
    FEATURE_MATCH: 0.228,
    PROFILE_MATCH: 0.254,
    MEMORY_CONTINUITY: 0.28,
    EMOTION_TIMING: 0.306,
    NEGOTIATION_FIT: 0.332,
    SCENE_PACING: 0.358,
    CHANNEL_FIT: 0.384,
    NPC_VOICE_FIT: 0.41,
    SAFETY_GUARDRAIL: 0.436,
    DIVERSITY_BONUS: 0.462,
    NOVELTY_BONUS: 0.488,
    REPLAY_CONTINUITY: 0.514,
    LATENCY_COST: 0.54,
    LIVEOPS_ALIGNMENT: 0.566,
  },
  NPC_AMBIENT: {
    BASE_PRIOR: 0.228,
    FEATURE_MATCH: 0.267,
    PROFILE_MATCH: 0.306,
    MEMORY_CONTINUITY: 0.345,
    EMOTION_TIMING: 0.384,
    NEGOTIATION_FIT: 0.423,
    SCENE_PACING: 0.462,
    CHANNEL_FIT: 0.501,
    NPC_VOICE_FIT: 0.54,
    SAFETY_GUARDRAIL: 0.579,
    DIVERSITY_BONUS: 0.618,
    NOVELTY_BONUS: 0.657,
    REPLAY_CONTINUITY: 0.696,
    LATENCY_COST: 0.735,
    LIVEOPS_ALIGNMENT: 0.774,
  },
  CHANNEL_RECOMMENDATION: {
    BASE_PRIOR: 0.254,
    FEATURE_MATCH: 0.306,
    PROFILE_MATCH: 0.358,
    MEMORY_CONTINUITY: 0.41,
    EMOTION_TIMING: 0.462,
    NEGOTIATION_FIT: 0.514,
    SCENE_PACING: 0.566,
    CHANNEL_FIT: 0.618,
    NPC_VOICE_FIT: 0.67,
    SAFETY_GUARDRAIL: 0.722,
    DIVERSITY_BONUS: 0.774,
    NOVELTY_BONUS: 0.826,
    REPLAY_CONTINUITY: 0.878,
    LATENCY_COST: 0.93,
    LIVEOPS_ALIGNMENT: 0.982,
  },
  DEALROOM_COUNTER: {
    BASE_PRIOR: 0.28,
    FEATURE_MATCH: 0.345,
    PROFILE_MATCH: 0.41,
    MEMORY_CONTINUITY: 0.475,
    EMOTION_TIMING: 0.54,
    NEGOTIATION_FIT: 0.605,
    SCENE_PACING: 0.67,
    CHANNEL_FIT: 0.735,
    NPC_VOICE_FIT: 0.8,
    SAFETY_GUARDRAIL: 0.865,
    DIVERSITY_BONUS: 0.93,
    NOVELTY_BONUS: 0.995,
    REPLAY_CONTINUITY: 1.06,
    LATENCY_COST: 1.125,
    LIVEOPS_ALIGNMENT: 1.19,
  },
  RESCUE_PROMPT: {
    BASE_PRIOR: 0.306,
    FEATURE_MATCH: 0.384,
    PROFILE_MATCH: 0.462,
    MEMORY_CONTINUITY: 0.54,
    EMOTION_TIMING: 0.618,
    NEGOTIATION_FIT: 0.696,
    SCENE_PACING: 0.774,
    CHANNEL_FIT: 0.852,
    NPC_VOICE_FIT: 0.93,
    SAFETY_GUARDRAIL: 1.008,
    DIVERSITY_BONUS: 1.086,
    NOVELTY_BONUS: 1.164,
    REPLAY_CONTINUITY: 1.242,
    LATENCY_COST: 0.22,
    LIVEOPS_ALIGNMENT: 0.298,
  },
  POST_RUN_SUMMARY: {
    BASE_PRIOR: 0.332,
    FEATURE_MATCH: 0.423,
    PROFILE_MATCH: 0.514,
    MEMORY_CONTINUITY: 0.605,
    EMOTION_TIMING: 0.696,
    NEGOTIATION_FIT: 0.787,
    SCENE_PACING: 0.878,
    CHANNEL_FIT: 0.969,
    NPC_VOICE_FIT: 1.06,
    SAFETY_GUARDRAIL: 1.151,
    DIVERSITY_BONUS: 1.242,
    NOVELTY_BONUS: 0.233,
    REPLAY_CONTINUITY: 0.324,
    LATENCY_COST: 0.415,
    LIVEOPS_ALIGNMENT: 0.506,
  },
} as const;

// ============================================================================
// MARK: Candidate template presets
// ============================================================================
export const LEARNING_RANKING_CANDIDATE_TEMPLATE_PRESETS = {
  HELPER_DIRECT: {
    source: 'HELPER_RESPONSE' as LearningRankingSource,
    candidateKind: 'HELPER_LINE' as LearningResponseCandidateKind,
    toneBand: 'CALM_GUIDANCE' as ChatMessageToneBand,
    visibilityClass: 'PRIVATE' as ChatMessageVisibilityClass,
    maxRiskScore: 0.12 as Score01,
    requiresMemoryContext: false,
    requiresOfferContext: false,
    requiresInvasionContext: false,
  },
  HELPER_BLUNT: {
    source: 'HELPER_RESPONSE' as LearningRankingSource,
    candidateKind: 'HELPER_LINE' as LearningResponseCandidateKind,
    toneBand: 'HARD_TRUTH' as ChatMessageToneBand,
    visibilityClass: 'PRIVATE' as ChatMessageVisibilityClass,
    maxRiskScore: 0.17 as Score01,
    requiresMemoryContext: false,
    requiresOfferContext: false,
    requiresInvasionContext: false,
  },
  HATER_SWARM: {
    source: 'HATER_RESPONSE' as LearningRankingSource,
    candidateKind: 'HATER_LINE' as LearningResponseCandidateKind,
    toneBand: 'TAUNT' as ChatMessageToneBand,
    visibilityClass: 'PUBLIC' as ChatMessageVisibilityClass,
    maxRiskScore: 0.22 as Score01,
    requiresMemoryContext: true,
    requiresOfferContext: false,
    requiresInvasionContext: true,
  },
  HATER_SNIPER: {
    source: 'HATER_RESPONSE' as LearningRankingSource,
    candidateKind: 'HATER_LINE' as LearningResponseCandidateKind,
    toneBand: 'CUTTING' as ChatMessageToneBand,
    visibilityClass: 'PUBLIC' as ChatMessageVisibilityClass,
    maxRiskScore: 0.27 as Score01,
    requiresMemoryContext: true,
    requiresOfferContext: false,
    requiresInvasionContext: true,
  },
  AMBIENT_CROWD: {
    source: 'NPC_AMBIENT' as LearningRankingSource,
    candidateKind: 'AMBIENT_NPC_LINE' as LearningResponseCandidateKind,
    toneBand: 'ATMOSPHERIC' as ChatMessageToneBand,
    visibilityClass: 'PUBLIC' as ChatMessageVisibilityClass,
    maxRiskScore: 0.32 as Score01,
    requiresMemoryContext: false,
    requiresOfferContext: false,
    requiresInvasionContext: false,
  },
  CHANNEL_SHIFT: {
    source: 'CHANNEL_RECOMMENDATION' as LearningRankingSource,
    candidateKind: 'CHANNEL_SWITCH' as LearningResponseCandidateKind,
    toneBand: 'SYSTEM' as ChatMessageToneBand,
    visibilityClass: 'PRIVATE' as ChatMessageVisibilityClass,
    maxRiskScore: 0.37 as Score01,
    requiresMemoryContext: false,
    requiresOfferContext: false,
    requiresInvasionContext: false,
  },
  DEAL_COUNTER_FIRM: {
    source: 'DEALROOM_COUNTER' as LearningRankingSource,
    candidateKind: 'DEALROOM_COUNTER' as LearningResponseCandidateKind,
    toneBand: 'NEGOTIATION' as ChatMessageToneBand,
    visibilityClass: 'PRIVATE' as ChatMessageVisibilityClass,
    maxRiskScore: 0.42 as Score01,
    requiresMemoryContext: false,
    requiresOfferContext: true,
    requiresInvasionContext: false,
  },
  RESCUE_BREAK_GLASS: {
    source: 'RESCUE_PROMPT' as LearningRankingSource,
    candidateKind: 'RESCUE_PROMPT' as LearningResponseCandidateKind,
    toneBand: 'URGENT_SUPPORT' as ChatMessageToneBand,
    visibilityClass: 'PRIVATE' as ChatMessageVisibilityClass,
    maxRiskScore: 0.47 as Score01,
    requiresMemoryContext: false,
    requiresOfferContext: false,
    requiresInvasionContext: false,
  },
  POSTRUN_EULOGY: {
    source: 'POST_RUN_SUMMARY' as LearningRankingSource,
    candidateKind: 'POST_RUN_SUMMARY' as LearningResponseCandidateKind,
    toneBand: 'REFLECTIVE' as ChatMessageToneBand,
    visibilityClass: 'PUBLIC' as ChatMessageVisibilityClass,
    maxRiskScore: 0.52 as Score01,
    requiresMemoryContext: true,
    requiresOfferContext: false,
    requiresInvasionContext: false,
  },
} as const;

// ============================================================================
// MARK: Evaluation matrix defaults
// ============================================================================
export const LEARNING_RANKING_EVALUATION_EXPECTATIONS = {
  HELPER_RESPONSE: {
    expectedTopK: 3,
    minimumSafetyScore: 0.72 as Score01,
    minimumContinuityScore: 0.31 as Score01,
    maximumRiskScore: 0.22 as Score01,
  },
  HATER_RESPONSE: {
    expectedTopK: 3,
    minimumSafetyScore: 0.48 as Score01,
    minimumContinuityScore: 0.22 as Score01,
    maximumRiskScore: 0.46 as Score01,
  },
  NPC_AMBIENT: {
    expectedTopK: 3,
    minimumSafetyScore: 0.57 as Score01,
    minimumContinuityScore: 0.22 as Score01,
    maximumRiskScore: 0.22 as Score01,
  },
  CHANNEL_RECOMMENDATION: {
    expectedTopK: 3,
    minimumSafetyScore: 0.57 as Score01,
    minimumContinuityScore: 0.22 as Score01,
    maximumRiskScore: 0.22 as Score01,
  },
  DEALROOM_COUNTER: {
    expectedTopK: 3,
    minimumSafetyScore: 0.61 as Score01,
    minimumContinuityScore: 0.22 as Score01,
    maximumRiskScore: 0.33 as Score01,
  },
  RESCUE_PROMPT: {
    expectedTopK: 2,
    minimumSafetyScore: 0.8 as Score01,
    minimumContinuityScore: 0.24 as Score01,
    maximumRiskScore: 0.16 as Score01,
  },
  POST_RUN_SUMMARY: {
    expectedTopK: 2,
    minimumSafetyScore: 0.57 as Score01,
    minimumContinuityScore: 0.22 as Score01,
    maximumRiskScore: 0.22 as Score01,
  },
} as const;

// ============================================================================
// MARK: Helpers
// ============================================================================
export function createLearningRankingRequestId(seed: string): LearningRankingRequestId {
  return `ranking-request::${seed}` as LearningRankingRequestId;
}
export function createLearningRankingResultId(seed: string): LearningRankingResultId {
  return `ranking-result::${seed}` as LearningRankingResultId;
}
export function createLearningResponseCandidateId(seed: string): LearningResponseCandidateId {
  return `ranking-candidate::${seed}` as LearningResponseCandidateId;
}
export function createLearningRankingReceiptId(seed: string): LearningRankingReceiptId {
  return `ranking-receipt::${seed}` as LearningRankingReceiptId;
}
export function createLearningRankingReceipt(result: LearningRankingResult, observation?: LearningRankingObservation): LearningRankingReceipt {
  return {
    receiptId: createLearningRankingReceiptId(result.resultId),
    resultId: result.resultId,
    requestId: result.requestId,
    source: result.source,
    policyId: result.policy.policyId,
    orderedCandidateIds: result.orderedCandidateIds,
    selectedCandidateIds: result.decision.selectedCandidateIds,
    blockedCandidateIds: result.decision.blockedCandidateIds,
    observation,
    privacy: LEARNING_DEFAULT_PRIVACY_ENVELOPE,
    createdAt: result.createdAt,
  };
}

// ============================================================================
// MARK: Manifest
// ============================================================================
export const LEARNING_RESPONSE_RANKING_CONTRACT_MANIFEST = {
  file: 'shared/contracts/chat/learning/ResponseRanking.ts',
  version: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  chatAuthorities: CHAT_AUTHORITIES,
  profileAuthorities: LEARNING_PROFILE_AUTHORITIES,
  rankingSources: LEARNING_RANKING_SOURCES,
  modelFamilies: LEARNING_MODEL_FAMILIES,
  labelKinds: LEARNING_LABEL_KINDS,
  labelConfidenceBands: LEARNING_LABEL_CONFIDENCE_BANDS,
  evaluationVerdicts: LEARNING_EVALUATION_VERDICTS,
  interventionOutcomes: LEARNING_INTERVENTION_OUTCOMES,
  candidateKinds: LEARNING_RESPONSE_CANDIDATE_KINDS,
  policyKinds: LEARNING_RANKING_POLICY_KINDS,
  componentKinds: LEARNING_RANKING_COMPONENT_KINDS,
  guardrailKinds: LEARNING_RANKING_GUARDRAIL_KINDS,
  guardrailVerdicts: LEARNING_RANKING_GUARDRAIL_VERDICTS,
  explanationKinds: LEARNING_RANKING_EXPLANATION_KINDS,
  decisionKinds: LEARNING_RANKING_DECISION_KINDS,
  orderingModes: LEARNING_RANKING_ORDERING_MODES,
  defaultWeightSets: LEARNING_DEFAULT_RANKING_WEIGHT_SETS,
  defaultPolicies: LEARNING_DEFAULT_RANKING_POLICIES,
  sourceComponentDefaults: LEARNING_RANKING_SOURCE_COMPONENT_DEFAULTS,
  candidateTemplates: LEARNING_RANKING_CANDIDATE_TEMPLATE_PRESETS,
  evaluationExpectations: LEARNING_RANKING_EVALUATION_EXPECTATIONS,
  coldStartManifest: LEARNING_COLD_START_CONTRACT_MANIFEST,
} as const;
export type LearningResponseRankingContractManifest = typeof LEARNING_RESPONSE_RANKING_CONTRACT_MANIFEST;
