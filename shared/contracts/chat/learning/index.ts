/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT LEARNING CONTRACT BARREL
 * FILE: shared/contracts/chat/learning/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical export barrel, module manifest, dependency graph, runtime namespace,
 * and introspection surface for the unified chat learning contract lane.
 *
 * Barrel doctrine
 * --------------
 * 1. This file is the only stable import root for shared chat-learning contracts.
 * 2. Frontend, backend, and transport lanes may import module-specific files
 *    directly when needed, but all cross-lane contract discovery should resolve
 *    through this barrel.
 * 3. Export order is intentional: events first, then profile, features, labels,
 *    cold-start doctrine, and response ranking.
 * 4. This barrel may expose runtime metadata, but it must not mutate sibling
 *    module state or become a hidden policy engine.
 * ============================================================================
 */

import {
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
} from '../ChatChannels';

import * as LearningEventsModule from './LearningEvents';
import * as LearningProfileModule from './LearningProfile';
import * as LearningFeaturesModule from './LearningFeatures';
import * as LearningLabelsModule from './LearningLabels';
import * as ColdStartDefaultsModule from './ColdStartDefaults';
import * as ResponseRankingModule from './ResponseRanking';

export * from './LearningEvents';
export * from './LearningProfile';
export * from './LearningFeatures';
export * from './LearningLabels';
export * from './ColdStartDefaults';
export * from './ResponseRanking';

export const LEARNING_CONTRACT_BARREL_PATH =
  'shared/contracts/chat/learning/index.ts' as const;

export const LEARNING_CONTRACT_BARREL_VERSION =
  CHAT_CONTRACT_VERSION;

export const LEARNING_CONTRACT_MODULE_KEYS = [
  'LearningEvents',
  'LearningProfile',
  'LearningFeatures',
  'LearningLabels',
  'ColdStartDefaults',
  'ResponseRanking',
] as const;

export type LearningContractModuleKey =
  (typeof LEARNING_CONTRACT_MODULE_KEYS)[number];

export const LEARNING_CONTRACT_RELATIVE_PATHS = {
  LearningEvents: './LearningEvents',
  LearningProfile: './LearningProfile',
  LearningFeatures: './LearningFeatures',
  LearningLabels: './LearningLabels',
  ColdStartDefaults: './ColdStartDefaults',
  ResponseRanking: './ResponseRanking',
} as const satisfies Record<LearningContractModuleKey, string>;

export type LearningContractModulePath =
  (typeof LEARNING_CONTRACT_RELATIVE_PATHS)[LearningContractModuleKey];

export const LEARNING_CONTRACT_AUTHORITIES =
  CHAT_CONTRACT_AUTHORITIES;

export type LearningContractModuleNamespace =
  | typeof LearningEventsModule
  | typeof LearningProfileModule
  | typeof LearningFeaturesModule
  | typeof LearningLabelsModule
  | typeof ColdStartDefaultsModule
  | typeof ResponseRankingModule;

export interface LearningContractModuleDescriptor {
  readonly key: LearningContractModuleKey;
  readonly path: LearningContractModulePath;
  readonly dependsOn: readonly LearningContractModuleKey[];
  readonly exportNames: readonly string[];
  readonly exportCount: number;
  readonly description: string;
}

export interface LearningContractManifest {
  readonly path: typeof LEARNING_CONTRACT_BARREL_PATH;
  readonly version: typeof LEARNING_CONTRACT_BARREL_VERSION;
  readonly authorities: typeof LEARNING_CONTRACT_AUTHORITIES;
  readonly moduleOrder: readonly LearningContractModuleKey[];
  readonly modules: readonly LearningContractModuleDescriptor[];
}

export const LEARNING_EVENTS_EXPORT_NAMES = [
  'LEARNING_EVENT_KINDS',
  'LEARNING_EVENT_SOURCES',
  'LEARNING_SUBJECT_KINDS',
  'LEARNING_FACT_STATUSES',
  'LEARNING_FEATURE_VALUE_KINDS',
  'LEARNING_LABEL_KINDS',
  'LEARNING_LABEL_CONFIDENCE_BANDS',
  'LEARNING_DATA_SPLITS',
  'LEARNING_INTERVENTION_OUTCOMES',
  'LEARNING_COLD_START_BASES',
  'LEARNING_MODEL_FAMILIES',
  'LEARNING_PRIVACY_MODES',
  'LEARNING_RETENTION_CLASSES',
  'LEARNING_UPDATE_MODES',
  'LEARNING_DRIFT_STATUSES',
  'LEARNING_EVALUATION_VERDICTS',
  'LEARNING_RANKING_SOURCES',
  'LEARNING_MEMORY_ANCHOR_KINDS',
  'LEARNING_CONSENT_STATES',
  'LEARNING_EMBEDDING_SOURCE_KINDS',
  'LEARNING_DEFAULT_PRIVACY_ENVELOPE',
  'LEARNING_EMPTY_OBSERVATION_WINDOW',
  'LEARNING_EMPTY_FEATURE_BAG',
  'LEARNING_EVENT_KIND_SET',
  'LEARNING_EVENT_SOURCE_SET',
  'LEARNING_LABEL_KIND_SET',
  'LEARNING_MODEL_FAMILY_SET',
  'LEARNING_MEMORY_ANCHOR_KIND_SET',
  'LEARNING_EVENT_DESCRIPTION_REGISTRY',
  'LEARNING_EVENT_CONTRACT_MANIFEST',
  'LearningEventId',
  'LearningBatchId',
  'LearningEventCursor',
  'LearningFeatureId',
  'LearningFeatureWindowId',
  'LearningFeatureVectorId',
  'LearningObservationId',
  'LearningLabelId',
  'LearningLabelSetId',
  'LearningOutcomeId',
  'LearningPolicyId',
  'LearningPolicyRunId',
  'LearningProfileId',
  'LearningRoomProfileId',
  'LearningAnchorId',
  'LearningAnchorBundleId',
  'LearningEmbeddingId',
  'LearningEmbeddingSpaceId',
  'LearningMemorySpanId',
  'LearningDriftRunId',
  'LearningEvaluationRunId',
  'LearningRankingObservationId',
  'LearningInterventionDecisionId',
  'LearningTrainingExampleId',
  'LearningExportId',
  'LearningQueryId',
  'LearningConsentId',
  'LearningRetentionKey',
  'LearningColdStartId',
  'LearningModelSnapshotId',
  'LearningFeatureName',
  'LearningDenseIndex',
  'LearningEventKind',
  'LearningEventSource',
  'LearningSubjectKind',
  'LearningFactStatus',
  'LearningFeatureValueKind',
  'LearningLabelKind',
  'LearningLabelConfidenceBand',
  'LearningDataSplit',
  'LearningInterventionOutcome',
  'LearningColdStartBasis',
  'LearningModelFamily',
  'LearningPrivacyMode',
  'LearningRetentionClass',
  'LearningUpdateMode',
  'LearningDriftStatus',
  'LearningEvaluationVerdict',
  'LearningRankingSource',
  'LearningMemoryAnchorKind',
  'LearningConsentState',
  'LearningEmbeddingSourceKind',
  'LearningEventPayload',
  'AnyLearningEventRecord',
  'LearningEventContractManifest',
  'LearningObservationWindow',
  'LearningEventCausality',
  'LearningSubjectRef',
  'LearningSourceRef',
  'LearningModelRef',
  'LearningPrivacyEnvelope',
  'LearningFeatureValue',
  'LearningDenseFeature',
  'LearningSparseFeature',
  'LearningFeatureBag',
  'LearningLabel',
  'LearningAnchorDescriptor',
  'LearningEmbeddingRecord',
  'LearningRankingCandidate',
  'LearningRankingObservation',
  'LearningChatOpenedPayload',
  'LearningChatClosedPayload',
  'LearningMessageDraftedPayload',
  'LearningMessageSubmittedPayload',
  'LearningMessageAcceptedPayload',
  'LearningMessageRejectedPayload',
  'LearningMessageReadPayload',
  'LearningMessageReactedPayload',
  'LearningMessageQuotedPayload',
  'LearningMessageRecalledPayload',
  'LearningChannelSwitchedPayload',
  'LearningPresenceChangedPayload',
  'LearningTypingStatePayload',
  'LearningNpcMessagePayload',
  'LearningHelperInterventionPayload',
  'LearningHaterEscalationPayload',
  'LearningInvasionPayload',
  'LearningNegotiationPayload',
  'LearningProofPayload',
  'LearningModerationPayload',
  'LearningRescuePayload',
  'LearningChurnWarningPayload',
  'LearningRankingDecisionPayload',
  'LearningMemoryAnchorPayload',
  'LearningReplayReviewedPayload',
  'LearningWorldEventLinkedPayload',
  'LearningLegendMomentPayload',
  'LearningProfileMutationPayload',
  'LearningDriftPayload',
  'LearningEvaluationPayload',
  'LearningEventPayloadMap',
  'LearningEventRecord',
  'LearningFeatureWindowRecord',
  'LearningLabelAssignmentRecord',
  'LearningAnchorBundle',
  'LearningInterventionDecisionRecord',
  'LearningTrainingExample',
  'LearningTelemetryJoin',
  'LearningTranscriptJoin',
  'LearningProofJoin',
  'LearningInvasionJoin',
  'LearningJoinedFact',
  'LearningEventBatch',
  'LearningEventAppendRequest',
  'LearningEventAppendResult',
  'LearningEventQuery',
  'LearningEventQueryResult',
  'LearningExportReceipt',
  'isLearningEventKind',
  'isLearningEventSource',
  'isLearningLabelKind',
  'isLearningModelFamily',
  'isLearningMemoryAnchorKind',
  'createLearningEventId',
  'createLearningBatchId',
  'createLearningLabelId',
  'createLearningProfileId',
  'createLearningAnchorId',
  'createLearningFeatureName',
  'createLearningEventRecord',
  'createLearningAnchorDescriptor',
  'createLearningLabel',
  'summarizeLearningFeatureBag',
  'getLearningEventDescription',
] as const;

export const LEARNING_PROFILE_EXPORT_NAMES = [
  'LEARNING_PROFILE_AUTHORITIES',
  'LEARNING_COLD_START_STATES',
  'LEARNING_ENGAGEMENT_TIERS',
  'LEARNING_HELPER_RECEPTIVITY_BANDS',
  'LEARNING_HATER_SUSCEPTIBILITY_BANDS',
  'LEARNING_CHANNEL_AFFINITY_BANDS',
  'LEARNING_NEGOTIATION_STYLES',
  'LEARNING_RISK_BANDS',
  'LEARNING_MEMORY_SALIENCE_BANDS',
  'LEARNING_TRUST_BANDS',
  'LEARNING_CADENCE_MODES',
  'LEARNING_EMOTION_AXES',
  'LEARNING_ROOM_SIGNATURE_KINDS',
  'LEARNING_DECAY_STRATEGIES',
  'LEARNING_PROFILE_VISIBILITY_MODES',
  'LEARNING_DEFAULT_ENGAGEMENT',
  'LEARNING_DEFAULT_HELPER_RECEPTIVITY',
  'LEARNING_DEFAULT_HATER_SUSCEPTIBILITY',
  'LEARNING_DEFAULT_NEGOTIATION_PROFILE',
  'LEARNING_DEFAULT_RESCUE_HISTORY',
  'LEARNING_DEFAULT_EMOTION_PROFILE',
  'LEARNING_DEFAULT_MEMORY_PROFILE',
  'LEARNING_DEFAULT_DRIFT_STATE',
  'LEARNING_DEFAULT_EVALUATION_STATE',
  'LEARNING_DEFAULT_MODEL_STATE',
  'LEARNING_DEFAULT_FEATURE_WINDOW_SUMMARY',
  'LEARNING_PROFILE_CONTRACT_MANIFEST',
  'LearningProfileVersionId',
  'LearningProfileSnapshotId',
  'LearningProfileMutationId',
  'LearningProfileWindowId',
  'LearningProfileDecayId',
  'LearningProfileClusterId',
  'LearningProfileTag',
  'LearningProfileNoteId',
  'LearningReceptivityWindowId',
  'LearningSusceptibilityWindowId',
  'LearningNegotiationHistoryId',
  'LearningChannelAffinityId',
  'LearningEmotionBandId',
  'LearningRelationshipProfileId',
  'LearningRoomSignatureId',
  'LearningTrustWindowId',
  'LearningMemorySummaryId',
  'LearningRescueHistoryId',
  'LearningPreferenceId',
  'LearningProfileAuthority',
  'LearningColdStartState',
  'LearningEngagementTier',
  'LearningHelperReceptivityBand',
  'LearningHaterSusceptibilityBand',
  'LearningChannelAffinityBand',
  'LearningNegotiationStyle',
  'LearningRiskBand',
  'LearningMemorySalienceBand',
  'LearningTrustBand',
  'LearningCadenceMode',
  'LearningEmotionAxis',
  'LearningRoomSignatureKind',
  'LearningDecayStrategy',
  'LearningProfileVisibilityMode',
  'LearningProfileContractManifest',
  'LearningProfileHeader',
  'LearningScoreWithHistory',
  'LearningBandWithScore',
  'LearningFeatureWindowSummary',
  'LearningChannelAffinityEntry',
  'LearningChannelAffinityMatrix',
  'LearningHelperReceptivityProfile',
  'LearningHaterSusceptibilityProfile',
  'LearningNegotiationProfile',
  'LearningRescueHistory',
  'LearningEmotionEntry',
  'LearningEmotionProfile',
  'LearningMemoryProfile',
  'LearningRelationshipProfile',
  'LearningRoomSignature',
  'LearningColdStartDescriptor',
  'LearningDriftState',
  'LearningEvaluationState',
  'LearningModelState',
  'LearningProfileNote',
  'LearningPreferenceHint',
  'LearningPlayerProfile',
  'LearningRoomProfile',
  'LearningPlayerProfileMirror',
  'LearningRoomProfileMirror',
  'LearningProfileMutationPatch',
  'LearningPlayerProfileSnapshot',
  'LearningRoomProfileSnapshot',
  'LearningProfileEnvelope',
  'LearningProfileQuery',
  'LearningProfileUpdateRequest',
  'LearningProfileUpdateResult',
  'LearningMirrorSyncPacket',
  'createLearningProfileVersionId',
  'createLearningProfileSnapshotId',
  'createLearningRoomProfileId',
  'createLearningRoomSignatureId',
  'createLearningRelationshipProfileId',
  'createLearningProfileHeader',
  'createDefaultLearningPlayerProfile',
  'createDefaultLearningRoomProfile',
  'toLearningPlayerProfileMirror',
  'toLearningRoomProfileMirror',
  'getLearningChannelAffinity',
  'getLearningRelationshipProfile',
  'getLearningEmotionScore',
  'getLearningMemorySalienceBand',
] as const;

export const LEARNING_FEATURES_EXPORT_NAMES = [
  'LEARNING_FEATURE_TEMPORAL_SCALES',
  'LEARNING_FEATURE_AGGREGATION_KINDS',
  'LEARNING_FEATURE_MISSING_VALUE_POLICIES',
  'LEARNING_FEATURE_NORMALIZATION_KINDS',
  'LEARNING_FEATURE_LIFECYCLE_STATES',
  'LEARNING_FEATURE_PRIVACY_CLASSES',
  'LEARNING_FEATURE_FRESHNESS_CLASSES',
  'LEARNING_FEATURE_VECTOR_SEGMENTS',
  'LEARNING_FEATURE_STORE_WRITE_MODES',
  'LEARNING_FEATURE_EXTRACTION_STAGES',
  'LEARNING_ENGAGEMENT_FEATURE_NAMES',
  'LEARNING_HELPER_FEATURE_NAMES',
  'LEARNING_HATER_FEATURE_NAMES',
  'LEARNING_CHANNEL_FEATURE_NAMES',
  'LEARNING_MODERATION_FEATURE_NAMES',
  'LEARNING_EMOTION_FEATURE_NAMES',
  'LEARNING_NEGOTIATION_FEATURE_NAMES',
  'LEARNING_MEMORY_FEATURE_NAMES',
  'LEARNING_INVASION_FEATURE_NAMES',
  'LEARNING_PRESENCE_FEATURE_NAMES',
  'LEARNING_SOCIAL_HEAT_FEATURE_NAMES',
  'LEARNING_DRAMA_FEATURE_NAMES',
  'LEARNING_CANONICAL_FEATURE_NAMES',
  'LEARNING_FEATURE_PACKS',
  'LEARNING_CANONICAL_FEATURE_SCHEMAS',
  'LEARNING_FEATURE_MANIFEST',
  'LEARNING_FEATURE_CONTRACT_MANIFEST',
  'LearningFeatureSchemaId',
  'LearningFeatureExtractorId',
  'LearningFeatureStoreId',
  'LearningFeatureSetId',
  'LearningFeatureSnapshotId',
  'LearningFeatureRevisionId',
  'LearningNormalizationPolicyId',
  'LearningFeatureAuditId',
  'LearningFeaturePackId',
  'LearningFeatureManifestId',
  'LearningFeatureLineageId',
  'LearningFeatureStoreWriteId',
  'LearningFeatureRegistryVersionId',
  'LearningFeatureTemporalScale',
  'LearningFeatureAggregationKind',
  'LearningFeatureMissingValuePolicy',
  'LearningFeatureNormalizationKind',
  'LearningFeatureLifecycleState',
  'LearningFeaturePrivacyClass',
  'LearningFeatureFreshnessClass',
  'LearningFeatureVectorSegment',
  'LearningFeatureStoreWriteMode',
  'LearningFeatureExtractionStage',
  'LearningFeatureSchema',
  'LearningFeatureContractManifest',
  'LearningFeatureNumericConstraints',
  'LearningFeatureCategoricalConstraints',
  'LearningFeatureBooleanConstraints',
  'LearningFeatureVectorConstraints',
  'LearningFeatureExtractionLineage',
  'LearningFeatureSchemaBase',
  'LearningScalarFeatureSchema',
  'LearningVectorFeatureSchema',
  'LearningDerivedFeatureRule',
  'LearningDerivedFeatureSchema',
  'LearningFeaturePack',
  'LearningFeatureManifest',
  'LearningFeatureExtractionContext',
  'LearningFeatureObservationPoint',
  'LearningFeatureComputationTrace',
  'LearningFeatureNormalizationPolicy',
  'LearningFeatureVectorSlot',
  'LearningFeatureVectorLayout',
  'LearningFeatureSnapshot',
  'LearningFeatureSetRecord',
  'LearningFeatureStoreWriteRequest',
  'LearningFeatureStoreWriteResult',
  'LearningFeatureAuditRecord',
  'LearningFeatureExtractionRequest',
  'LearningFeatureExtractionResult',
  'LearningFeatureOnlineStoreView',
  'LearningFeatureDriftExpectation',
  'LearningFeatureModelBinding',
  'LearningFeatureRankingInput',
] as const;

export const LEARNING_LABELS_EXPORT_NAMES = [
  'LEARNING_LABEL_PROVENANCE_KINDS',
  'LEARNING_LABEL_SUBJECT_KINDS',
  'LEARNING_LABEL_ADJUDICATION_STATES',
  'LEARNING_LABEL_HORIZONS',
  'LEARNING_LABEL_TARGET_KINDS',
  'LEARNING_LABEL_SEVERITY_BANDS',
  'LEARNING_ENGAGEMENT_OUTCOMES_LABELS',
  'LEARNING_HELPER_OUTCOMES_LABELS',
  'LEARNING_HATER_OUTCOMES_LABELS',
  'LEARNING_MODERATION_OUTCOMES_LABELS',
  'LEARNING_CHANNEL_OUTCOMES_LABELS',
  'LEARNING_NEGOTIATION_OUTCOMES_LABELS',
  'LEARNING_MEMORY_OUTCOMES_LABELS',
  'LEARNING_INVASION_OUTCOMES_LABELS',
  'LEARNING_EMOTION_OUTCOMES_LABELS',
  'LEARNING_DRAMA_OUTCOMES_LABELS',
  'LEARNING_CANONICAL_LABEL_NAMES',
  'LEARNING_LABEL_SCHEMAS',
  'LEARNING_DATASET_TARGETS',
  'LEARNING_LABEL_POLICIES',
  'LEARNING_LABEL_MANIFEST',
  'LEARNING_LABEL_CONTRACT_MANIFEST',
  'LearningLabelPolicyId',
  'LearningAnnotationId',
  'LearningReviewId',
  'LearningTruthSetId',
  'LearningOutcomeWindowId',
  'LearningDatasetTargetId',
  'LearningAdjudicationId',
  'LearningEvidenceBundleId',
  'LearningLabelSchemaId',
  'LearningLabelManifestId',
  'LearningLabelProvenanceKind',
  'LearningLabelSubjectKind',
  'LearningLabelAdjudicationState',
  'LearningLabelHorizon',
  'LearningLabelTargetKind',
  'LearningLabelSeverityBand',
  'LearningLabelContractManifest',
  'LearningLabelEvidenceRef',
  'LearningLabelEvidenceBundle',
  'LearningLabelSchema',
  'LearningLabelAssignmentEnvelope',
  'LearningLabelReviewRecord',
  'LearningAnnotationRequest',
  'LearningAnnotationResult',
  'LearningOutcomeWindow',
  'LearningTruthSet',
  'LearningDatasetTarget',
  'LearningLabelPolicyRule',
  'LearningLabelPolicy',
  'LearningLabelAdjudication',
  'LearningLabelEvaluationSlice',
  'LearningLabelDriftSlice',
  'LearningLabelManifest',
] as const;

export const LEARNING_COLD_START_EXPORT_NAMES = [
  'LEARNING_COLD_START_POLICY_KINDS',
  'LEARNING_COLD_START_PACKET_TARGETS',
  'LEARNING_COLD_START_COHORT_AXES',
  'LEARNING_COLD_START_CONFIDENCE_BANDS',
  'LEARNING_COLD_START_TRANSITION_KINDS',
  'LEARNING_COLD_START_OVERRIDE_KINDS',
  'LEARNING_COLD_START_VECTOR_PRESETS',
  'LEARNING_DEFAULT_COLD_START_FEATURE_BAG',
  'LEARNING_DEFAULT_COLD_START_EMOTION',
  'LEARNING_DEFAULT_COLD_START_HELPER',
  'LEARNING_DEFAULT_COLD_START_HATER',
  'LEARNING_DEFAULT_COLD_START_NEGOTIATION',
  'LEARNING_DEFAULT_COLD_START_MEMORY',
  'LEARNING_DEFAULT_COLD_START_AUDIENCE',
  'LEARNING_DEFAULT_COLD_START_SCENE',
  'LEARNING_DEFAULT_COLD_START_RANKING_SEEDS',
  'LEARNING_MODE_CHANNEL_COLD_START_PRESETS',
  'LEARNING_DEFAULT_COLD_START_FEATURE_PRIOR_REGISTRY',
  'LEARNING_COLD_START_TRANSITION_RULES',
  'LEARNING_COLD_START_POLICIES',
  'LEARNING_COHORT_FEATURE_GROUP_DEFAULTS',
  'LEARNING_COLD_START_CONTRACT_MANIFEST',
  'LearningColdStartPolicyId',
  'LearningColdStartPacketId',
  'LearningColdStartRequestId',
  'LearningColdStartResultId',
  'LearningColdStartCohortId',
  'LearningColdStartPriorId',
  'LearningColdStartPriorSetId',
  'LearningColdStartDecisionId',
  'LearningColdStartSignatureId',
  'LearningColdStartFamilyId',
  'LearningColdStartReceiptId',
  'LearningColdStartPopulationId',
  'LearningColdStartTransitionId',
  'LearningColdStartOverrideId',
  'LearningColdStartVectorPresetId',
  'LearningColdStartPolicyKind',
  'LearningColdStartPacketTarget',
  'LearningColdStartCohortAxis',
  'LearningColdStartConfidenceBand',
  'LearningColdStartTransitionKind',
  'LearningColdStartOverrideKind',
  'LearningColdStartVectorPreset',
  'LearningModeChannelColdStartPresetKey',
  'LearningColdStartContractManifest',
  'LearningColdStartCohortSignature',
  'LearningColdStartPopulationStats',
  'LearningColdStartScalarPrior',
  'LearningColdStartRankingSeed',
  'LearningColdStartEmotionSeed',
  'LearningColdStartHelperSeed',
  'LearningColdStartHaterSeed',
  'LearningColdStartNegotiationSeed',
  'LearningColdStartMemorySeed',
  'LearningColdStartAudienceSeed',
  'LearningColdStartSceneSeed',
  'LearningColdStartPacket',
  'LearningColdStartSelectionRequest',
  'LearningColdStartTransitionRule',
  'LearningColdStartPolicy',
  'CreateLearningColdStartPacketParams',
  'createLearningColdStartPolicyId',
  'createLearningColdStartPacketId',
  'createLearningColdStartRequestId',
  'createLearningColdStartResultId',
  'createLearningColdStartReceiptId',
  'createLearningColdStartPacket',
] as const;

export const LEARNING_RESPONSE_RANKING_EXPORT_NAMES = [
  'LEARNING_RESPONSE_CANDIDATE_KINDS',
  'LEARNING_RANKING_POLICY_KINDS',
  'LEARNING_RANKING_COMPONENT_KINDS',
  'LEARNING_RANKING_GUARDRAIL_KINDS',
  'LEARNING_RANKING_GUARDRAIL_VERDICTS',
  'LEARNING_RANKING_EXPLANATION_KINDS',
  'LEARNING_RANKING_DECISION_KINDS',
  'LEARNING_RANKING_ORDERING_MODES',
  'LEARNING_DEFAULT_RANKING_WEIGHT_SETS',
  'LEARNING_DEFAULT_RANKING_POLICIES',
  'LEARNING_RANKING_SOURCE_COMPONENT_DEFAULTS',
  'LEARNING_RANKING_CANDIDATE_TEMPLATE_PRESETS',
  'LEARNING_RANKING_EVALUATION_EXPECTATIONS',
  'LEARNING_RESPONSE_RANKING_CONTRACT_MANIFEST',
  'LearningResponseCandidateId',
  'LearningRankingRequestId',
  'LearningRankingResultId',
  'LearningRankingReceiptId',
  'LearningRankingPolicyId',
  'LearningRankingWeightSetId',
  'LearningRankingContextId',
  'LearningRankingGuardrailId',
  'LearningRankingScoreId',
  'LearningRankingExplanationId',
  'LearningRankingDecisionId',
  'LearningRankingFamilyId',
  'LearningRankingEvaluationCaseId',
  'LearningRankingCandidateSetId',
  'LearningResponseCandidateKind',
  'LearningRankingPolicyKind',
  'LearningRankingComponentKind',
  'LearningRankingGuardrailKind',
  'LearningRankingGuardrailVerdict',
  'LearningRankingExplanationKind',
  'LearningRankingDecisionKind',
  'LearningRankingOrderingMode',
  'LearningResponseRankingContractManifest',
  'LearningResponseCandidatePayload',
  'LearningResponseCandidateConstraints',
  'LearningResponseCandidate',
  'LearningRankingContextBundle',
  'LearningRankingComponentScore',
  'LearningRankingGuardrailResult',
  'LearningRankingExplanation',
  'LearningRankingCandidateScore',
  'LearningRankingWeightSet',
  'LearningRankingPolicy',
  'LearningRankingRequest',
  'LearningRankingDecision',
  'LearningRankingResult',
  'LearningRankingReceipt',
  'LearningRankingEvaluationCase',
  'createLearningRankingRequestId',
  'createLearningRankingResultId',
  'createLearningResponseCandidateId',
  'createLearningRankingReceiptId',
  'createLearningRankingReceipt',
] as const;

export type LearningEventsExportName =
  (typeof LEARNING_EVENTS_EXPORT_NAMES)[number];

export type LearningProfileExportName =
  (typeof LEARNING_PROFILE_EXPORT_NAMES)[number];

export type LearningFeaturesExportName =
  (typeof LEARNING_FEATURES_EXPORT_NAMES)[number];

export type LearningLabelsExportName =
  (typeof LEARNING_LABELS_EXPORT_NAMES)[number];

export type LearningColdStartExportName =
  (typeof LEARNING_COLD_START_EXPORT_NAMES)[number];

export type LearningResponseRankingExportName =
  (typeof LEARNING_RESPONSE_RANKING_EXPORT_NAMES)[number];

export type LearningContractExportName =
  | LearningEventsExportName
  | LearningProfileExportName
  | LearningFeaturesExportName
  | LearningLabelsExportName
  | LearningColdStartExportName
  | LearningResponseRankingExportName;

export const LEARNING_CONTRACT_EXPORT_NAME_REGISTRY = {
  LearningEvents: LEARNING_EVENTS_EXPORT_NAMES,
  LearningProfile: LEARNING_PROFILE_EXPORT_NAMES,
  LearningFeatures: LEARNING_FEATURES_EXPORT_NAMES,
  LearningLabels: LEARNING_LABELS_EXPORT_NAMES,
  ColdStartDefaults: LEARNING_COLD_START_EXPORT_NAMES,
  ResponseRanking: LEARNING_RESPONSE_RANKING_EXPORT_NAMES,
} as const satisfies Record<
  LearningContractModuleKey,
  readonly LearningContractExportName[]
>;

export const LEARNING_CONTRACT_DEPENDENCY_GRAPH = {
  LearningEvents: [],
  LearningProfile: ["LearningEvents"],
  LearningFeatures: ["LearningEvents"],
  LearningLabels: ["LearningEvents", "LearningFeatures"],
  ColdStartDefaults: ["LearningEvents", "LearningFeatures", "LearningProfile", "LearningLabels"],
  ResponseRanking: ["LearningEvents", "LearningFeatures", "LearningProfile", "LearningLabels", "ColdStartDefaults"],
} as const satisfies Record<
  LearningContractModuleKey,
  readonly LearningContractModuleKey[]
>;

export const LEARNING_CONTRACT_MODULE_NAMESPACES = {
  LearningEvents: LearningEventsModule,
  LearningProfile: LearningProfileModule,
  LearningFeatures: LearningFeaturesModule,
  LearningLabels: LearningLabelsModule,
  ColdStartDefaults: ColdStartDefaultsModule,
  ResponseRanking: ResponseRankingModule,
} as const satisfies Record<
  LearningContractModuleKey,
  LearningContractModuleNamespace
>;

export const LEARNING_CONTRACT_MODULE_DESCRIPTORS = [
  {
    key: 'LearningEvents',
    path: LEARNING_CONTRACT_RELATIVE_PATHS.LearningEvents,
    dependsOn: LEARNING_CONTRACT_DEPENDENCY_GRAPH.LearningEvents,
    exportNames: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.LearningEvents,
    exportCount: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.LearningEvents.length,
    description:
      'Authoritative event, observation, privacy, label, ranking-source, and model-reference primitives for the chat learning lane.',
  },
  {
    key: 'LearningProfile',
    path: LEARNING_CONTRACT_RELATIVE_PATHS.LearningProfile,
    dependsOn: LEARNING_CONTRACT_DEPENDENCY_GRAPH.LearningProfile,
    exportNames: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.LearningProfile,
    exportCount: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.LearningProfile.length,
    description:
      'Persistent player and room profile contracts, mirror packets, default posture state, and profile mutation/query surfaces.',
  },
  {
    key: 'LearningFeatures',
    path: LEARNING_CONTRACT_RELATIVE_PATHS.LearningFeatures,
    dependsOn: LEARNING_CONTRACT_DEPENDENCY_GRAPH.LearningFeatures,
    exportNames: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.LearningFeatures,
    exportCount: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.LearningFeatures.length,
    description:
      'Canonical feature schema, extraction, normalization, packing, vector layout, online-store, and audit contracts.',
  },
  {
    key: 'LearningLabels',
    path: LEARNING_CONTRACT_RELATIVE_PATHS.LearningLabels,
    dependsOn: LEARNING_CONTRACT_DEPENDENCY_GRAPH.LearningLabels,
    exportNames: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.LearningLabels,
    exportCount: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.LearningLabels.length,
    description:
      'Truth-set, outcome-window, annotation, adjudication, dataset-target, and label-policy contracts.',
  },
  {
    key: 'ColdStartDefaults',
    path: LEARNING_CONTRACT_RELATIVE_PATHS.ColdStartDefaults,
    dependsOn: LEARNING_CONTRACT_DEPENDENCY_GRAPH.ColdStartDefaults,
    exportNames: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.ColdStartDefaults,
    exportCount: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.ColdStartDefaults.length,
    description:
      'Cold-start prior, policy, cohort, preset, transition, and boot-packet contracts spanning frontend hinting and backend authority.',
  },
  {
    key: 'ResponseRanking',
    path: LEARNING_CONTRACT_RELATIVE_PATHS.ResponseRanking,
    dependsOn: LEARNING_CONTRACT_DEPENDENCY_GRAPH.ResponseRanking,
    exportNames: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.ResponseRanking,
    exportCount: LEARNING_CONTRACT_EXPORT_NAME_REGISTRY.ResponseRanking.length,
    description:
      'Candidate, context, scoring, policy, guardrail, receipt, decision, and evaluation contracts for response selection.',
  },
] as const satisfies readonly LearningContractModuleDescriptor[];

export const LEARNING_CONTRACT_MANIFEST = {
  path: LEARNING_CONTRACT_BARREL_PATH,
  version: LEARNING_CONTRACT_BARREL_VERSION,
  authorities: LEARNING_CONTRACT_AUTHORITIES,
  moduleOrder: LEARNING_CONTRACT_MODULE_KEYS,
  modules: LEARNING_CONTRACT_MODULE_DESCRIPTORS,
} as const satisfies LearningContractManifest;

export const LEARNING_RUNTIME_EXPORT_GROUPS = {
  identity: [
    'LearningEventId',
    'LearningProfileId',
    'LearningFeatureId',
    'LearningLabelId',
    'LearningColdStartPolicyId',
    'LearningRankingRequestId',
  ],
  manifests: [
    'LEARNING_EVENT_CONTRACT_MANIFEST',
    'LEARNING_PROFILE_CONTRACT_MANIFEST',
    'LEARNING_FEATURE_CONTRACT_MANIFEST',
    'LEARNING_LABEL_CONTRACT_MANIFEST',
    'LEARNING_COLD_START_CONTRACT_MANIFEST',
    'LEARNING_RESPONSE_RANKING_CONTRACT_MANIFEST',
  ],
  defaults: [
    'LEARNING_DEFAULT_PRIVACY_ENVELOPE',
    'LEARNING_EMPTY_OBSERVATION_WINDOW',
    'LEARNING_DEFAULT_ENGAGEMENT',
    'LEARNING_DEFAULT_HELPER_RECEPTIVITY',
    'LEARNING_DEFAULT_HATER_SUSCEPTIBILITY',
    'LEARNING_DEFAULT_NEGOTIATION_PROFILE',
    'LEARNING_DEFAULT_RESCUE_HISTORY',
    'LEARNING_DEFAULT_EMOTION_PROFILE',
    'LEARNING_DEFAULT_MEMORY_PROFILE',
    'LEARNING_DEFAULT_COLD_START_FEATURE_BAG',
    'LEARNING_DEFAULT_COLD_START_RANKING_SEEDS',
    'LEARNING_DEFAULT_RANKING_WEIGHT_SETS',
  ],
  policies: [
    'LEARNING_LABEL_POLICIES',
    'LEARNING_COLD_START_POLICIES',
    'LEARNING_DEFAULT_RANKING_POLICIES',
  ],
} as const;

export type LearningRuntimeExportGroupKey =
  keyof typeof LEARNING_RUNTIME_EXPORT_GROUPS;

export function getLearningContractModuleKeys():
  readonly LearningContractModuleKey[] {
  return LEARNING_CONTRACT_MODULE_KEYS;
}

export function getLearningContractModulePath(
  key: LearningContractModuleKey,
): LearningContractModulePath {
  return LEARNING_CONTRACT_RELATIVE_PATHS[key];
}

export function getLearningContractModuleNamespace(
  key: LearningContractModuleKey,
): LearningContractModuleNamespace {
  return LEARNING_CONTRACT_MODULE_NAMESPACES[key];
}

export function getLearningContractModuleDescriptor(
  key: LearningContractModuleKey,
): LearningContractModuleDescriptor {
  const descriptor = LEARNING_CONTRACT_MODULE_DESCRIPTORS.find(
    (entry) => entry.key === key,
  );

  if (!descriptor) {
    throw new Error(`Unknown learning contract module: ${key}`);
  }

  return descriptor;
}

export function getLearningContractExportNames<K extends LearningContractModuleKey>(
  key: K,
): (typeof LEARNING_CONTRACT_EXPORT_NAME_REGISTRY)[K] {
  return LEARNING_CONTRACT_EXPORT_NAME_REGISTRY[key];
}

export function getLearningRuntimeExportGroup(
  key: LearningRuntimeExportGroupKey,
): readonly string[] {
  return LEARNING_RUNTIME_EXPORT_GROUPS[key];
}

export function hasLearningContractExportName(
  key: LearningContractModuleKey,
  exportName: string,
): boolean {
  return LEARNING_CONTRACT_EXPORT_NAME_REGISTRY[key].includes(
    exportName as LearningContractExportName,
  );
}

export function isLearningContractModuleKey(
  value: string,
): value is LearningContractModuleKey {
  return (LEARNING_CONTRACT_MODULE_KEYS as readonly string[]).includes(value);
}

export function isLearningContractExportName(
  value: string,
): value is LearningContractExportName {
  return LEARNING_CONTRACT_MODULE_KEYS.some((moduleKey) =>
    hasLearningContractExportName(moduleKey, value),
  );
}

export function listLearningModulesWithDependencies():
  readonly LearningContractModuleDescriptor[] {
  return LEARNING_CONTRACT_MODULE_DESCRIPTORS;
}

export function listLearningContractExportNames():
  readonly LearningContractExportName[] {
  return LEARNING_CONTRACT_MODULE_KEYS.flatMap(
    (moduleKey) => LEARNING_CONTRACT_EXPORT_NAME_REGISTRY[moduleKey],
  ) as readonly LearningContractExportName[];
}

export function getLearningDependencyChain(
  key: LearningContractModuleKey,
): readonly LearningContractModuleKey[] {
  const visited = new Set<LearningContractModuleKey>();
  const ordered: LearningContractModuleKey[] = [];

  const visit = (moduleKey: LearningContractModuleKey): void => {
    if (visited.has(moduleKey)) {
      return;
    }

    visited.add(moduleKey);

    for (const dependency of LEARNING_CONTRACT_DEPENDENCY_GRAPH[moduleKey]) {
      visit(dependency);
    }

    ordered.push(moduleKey);
  };

  visit(key);
  return ordered;
}

export function createLearningContractManifest(): LearningContractManifest {
  return LEARNING_CONTRACT_MANIFEST;
}

export interface LearningContractRuntimeBundle {
  readonly manifest: LearningContractManifest;
  readonly modules: typeof LEARNING_CONTRACT_MODULE_NAMESPACES;
  readonly runtimeGroups: typeof LEARNING_RUNTIME_EXPORT_GROUPS;
}

export const LEARNING_CONTRACT_RUNTIME_BUNDLE = {
  manifest: LEARNING_CONTRACT_MANIFEST,
  modules: LEARNING_CONTRACT_MODULE_NAMESPACES,
  runtimeGroups: LEARNING_RUNTIME_EXPORT_GROUPS,
} as const satisfies LearningContractRuntimeBundle;

export function getLearningContractRuntimeBundle():
  LearningContractRuntimeBundle {
  return LEARNING_CONTRACT_RUNTIME_BUNDLE;
}

export const LEARNING_IMPORT_RECIPES = {
  barrel: {
    path: 'shared/contracts/chat/learning',
    examples: [
      "import { LearningProfileId } from 'shared/contracts/chat/learning';",
      "import { LEARNING_CONTRACT_MANIFEST } from 'shared/contracts/chat/learning';",
      "import { createLearningColdStartPacket } from 'shared/contracts/chat/learning';",
      "import { createLearningRankingReceipt } from 'shared/contracts/chat/learning';",
    ],
  },
  direct: {
    LearningEvents: 'shared/contracts/chat/learning/LearningEvents',
    LearningProfile: 'shared/contracts/chat/learning/LearningProfile',
    LearningFeatures: 'shared/contracts/chat/learning/LearningFeatures',
    LearningLabels: 'shared/contracts/chat/learning/LearningLabels',
    ColdStartDefaults: 'shared/contracts/chat/learning/ColdStartDefaults',
    ResponseRanking: 'shared/contracts/chat/learning/ResponseRanking',
  },
} as const;

export interface LearningCrossModuleSurface {
  readonly events: typeof LearningEventsModule;
  readonly profile: typeof LearningProfileModule;
  readonly features: typeof LearningFeaturesModule;
  readonly labels: typeof LearningLabelsModule;
  readonly coldStart: typeof ColdStartDefaultsModule;
  readonly ranking: typeof ResponseRankingModule;
}

export const LEARNING_CROSS_MODULE_SURFACE = {
  events: LearningEventsModule,
  profile: LearningProfileModule,
  features: LearningFeaturesModule,
  labels: LearningLabelsModule,
  coldStart: ColdStartDefaultsModule,
  ranking: ResponseRankingModule,
} as const satisfies LearningCrossModuleSurface;

export function getLearningCrossModuleSurface():
  LearningCrossModuleSurface {
  return LEARNING_CROSS_MODULE_SURFACE;
}

export const LEARNING_BOOTSTRAP_EXPORT_PAIRS = [
  ['LearningEvents', 'LEARNING_DEFAULT_PRIVACY_ENVELOPE'],
  ['LearningEvents', 'LEARNING_EMPTY_OBSERVATION_WINDOW'],
  ['LearningProfile', 'createDefaultLearningPlayerProfile'],
  ['LearningProfile', 'createDefaultLearningRoomProfile'],
  ['LearningFeatures', 'LEARNING_FEATURE_MANIFEST'],
  ['LearningLabels', 'LEARNING_LABEL_MANIFEST'],
  ['ColdStartDefaults', 'createLearningColdStartPacket'],
  ['ResponseRanking', 'createLearningRankingReceipt'],
] as const;

export type LearningBootstrapExportPair =
  (typeof LEARNING_BOOTSTRAP_EXPORT_PAIRS)[number];

export function isLearningBootstrapExportPair(
  moduleKey: LearningContractModuleKey,
  exportName: string,
): boolean {
  return LEARNING_BOOTSTRAP_EXPORT_PAIRS.some(
    ([candidateModule, candidateExport]) =>
      candidateModule === moduleKey && candidateExport === exportName,
  );
}

export const LEARNING_EXPORT_COUNTS = {
  LearningEvents: LEARNING_EVENTS_EXPORT_NAMES.length,
  LearningProfile: LEARNING_PROFILE_EXPORT_NAMES.length,
  LearningFeatures: LEARNING_FEATURES_EXPORT_NAMES.length,
  LearningLabels: LEARNING_LABELS_EXPORT_NAMES.length,
  ColdStartDefaults: LEARNING_COLD_START_EXPORT_NAMES.length,
  ResponseRanking: LEARNING_RESPONSE_RANKING_EXPORT_NAMES.length,
} as const satisfies Record<LearningContractModuleKey, number>;

export const LEARNING_TOTAL_EXPORT_COUNT =
  LEARNING_EVENTS_EXPORT_NAMES.length +
  LEARNING_PROFILE_EXPORT_NAMES.length +
  LEARNING_FEATURES_EXPORT_NAMES.length +
  LEARNING_LABELS_EXPORT_NAMES.length +
  LEARNING_COLD_START_EXPORT_NAMES.length +
  LEARNING_RESPONSE_RANKING_EXPORT_NAMES.length;

export interface LearningModuleStats {
  readonly key: LearningContractModuleKey;
  readonly exportCount: number;
  readonly dependencyCount: number;
}

export const LEARNING_MODULE_STATS = LEARNING_CONTRACT_MODULE_KEYS.map(
  (key) => ({
    key,
    exportCount: LEARNING_EXPORT_COUNTS[key],
    dependencyCount: LEARNING_CONTRACT_DEPENDENCY_GRAPH[key].length,
  }),
) as readonly LearningModuleStats[];

export function getLearningModuleStats(
  key: LearningContractModuleKey,
): LearningModuleStats {
  const entry = LEARNING_MODULE_STATS.find((candidate) => candidate.key === key);

  if (!entry) {
    throw new Error(`Unknown learning module stats key: ${key}`);
  }

  return entry;
}

export function getLearningTotalExportCount(): number {
  return LEARNING_TOTAL_EXPORT_COUNT;
}

export const LEARNING_CONTRACT_INTEGRITY_CHECK = {
  moduleCount: LEARNING_CONTRACT_MODULE_KEYS.length,
  totalExportCount: LEARNING_TOTAL_EXPORT_COUNT,
  barrelPath: LEARNING_CONTRACT_BARREL_PATH,
  barrelVersion: LEARNING_CONTRACT_BARREL_VERSION,
} as const;
