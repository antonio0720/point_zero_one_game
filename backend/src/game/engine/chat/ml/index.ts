/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ML BARREL + STACK
 * FILE: backend/src/game/engine/chat/ml/index.ts
 * VERSION: 2026.03.22
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Single authoritative entry surface for the backend chat ML lane.
 *
 * This barrel does six jobs:
 *
 *   1. Re-exports every model, store, and ingestor contract so any downstream
 *      module can import from one path and reach the full symbol graph.
 *
 *   2. Resolves the `scoreWindowBatch` name collision between ToxicityRiskModel
 *      and ChurnRiskModel by exporting aliased versions:
 *        • scoreToxicityWindowBatch  ← ToxicityRiskModel.scoreWindowBatch
 *        • scoreChurnWindowBatch     ← ChurnRiskModel.scoreWindowBatch
 *
 *   3. Exposes one coordinated ChatMlModelStack that scores the full chain
 *      in the repo-true dependency order:
 *
 *        FeatureIngestor → OnlineFeatureStore
 *          → Engagement → Hater → Helper → Channel
 *            → Toxicity → Churn → InterventionPolicy
 *
 *   4. Exposes every evaluation entry point:
 *        • evaluateAggregate        — score from a pre-built aggregate
 *        • evaluateRows             — score from raw feature rows
 *        • evaluateStore            — score by querying the internal store
 *        • evaluateInferenceWindow  — score from a pre-built inference window
 *        • evaluateIngestResult     — ingest-first path; uses scoreIngestResult
 *                                     on Toxicity, Churn, and InterventionPolicy
 *        • ingestAndEvaluate        — append → aggregate → evaluateAggregate
 *
 *   5. Exposes lifecycle management helpers:
 *        • storeStats / storeSnapshot / storeHydrate / storeApplyDelta
 *        • pruneStore / hasEvidence
 *        • storeEntityProfile / storeTopEntities
 *        • healthReports / allAuditLogs / clearAllAuditLogs
 *        • priorsFromScores / appendIngestResult
 *
 *   6. Exposes a NAMESPACE object that contains every per-model NAMESPACE,
 *      every model class, the stack factory, and every standalone helper.
 *
 * Module layout
 * -------------
 *   FeatureIngestor        — ingest, validate, hash, quality-grade raw rows
 *   OnlineFeatureStore     — in-memory store, aggregate, inference window
 *   EngagementModel        — vitality, continuity, fragility, response likelihood
 *   HaterTargetingModel    — attack opportunity, shadow priming, suppression
 *   HelperTimingModel      — helper speak-now timing, style, urgency
 *   ChannelAffinityModel   — channel fit, migration pressure, privacy needs
 *   ToxicityRiskModel      — harm, escalation, blast radius, shadow-route
 *   ChurnRiskModel         — withdrawal, rage-quit, rescue urgency, recovery
 *   InterventionPolicyModel — final advisory coordination, action recommendation
 *
 * Constraint
 * ----------
 * The stack does not become transcript truth and does not bypass policy.
 * It is a composition helper for backend chat authority only.
 *
 * Changelog
 * ---------
 * 2026.03.22 — v3
 *   • evaluateIngestResult added: routes Toxicity, Churn, Intervention through
 *     their dedicated .scoreIngestResult() paths for semantic correctness.
 *   • scoreWindowBatch alias exports added to resolve the export* collision.
 *   • storeStats, storeSnapshot, storeHydrate, storeApplyDelta, pruneStore,
 *     hasEvidence, storeEntityProfile, storeTopEntities exposed on stack.
 *   • healthReports, allAuditLogs, clearAllAuditLogs added on stack.
 *   • multiAggregateByFamily added on stack.
 *   • ChatMlHealthBundle, ChatMlAuditBundle, ChatMlStoreOpsResult interfaces.
 *   • serializeScoreBundle, scoreBundleSummaryLines standalone helpers.
 *   • NAMESPACE expanded to include all standalone helpers, per-model
 *     NAMESPACE objects, and every new stack method / type reference.
 * 2026.03.21 — v2
 *   • All models upgraded to v2 with prior-state blending, ratchet logic,
 *     liveops amplification, trend direction, audit logs, and health reports.
 *   • priorsFromScores uses derivePriorState* helpers from Toxicity and Churn.
 *   • CHAT_BACKEND_ML_STACK_NAMESPACE includes every per-model NAMESPACE.
 * ============================================================================
 */

// ============================================================================
// MARK: Wildcard re-exports — all public surface from every lane module
// ============================================================================
//
// NOTE: ToxicityRiskModel and ChurnRiskModel both export a top-level function
// named `scoreWindowBatch`. TypeScript silently drops ambiguous names from a
// barrel that has two conflicting `export *` declarations. The explicit aliased
// re-exports below restore both symbols under collision-free names. Callers
// should import `scoreToxicityWindowBatch` and `scoreChurnWindowBatch`.
//
export * from './FeatureIngestor';
export * from './OnlineFeatureStore';
export * from './EngagementModel';
export * from './HaterTargetingModel';
export * from './HelperTimingModel';
export * from './ChannelAffinityModel';
export * from './ToxicityRiskModel';  // scoreWindowBatch — ambiguous, see aliases ↓
export * from './ChurnRiskModel';     // scoreWindowBatch — ambiguous, see aliases ↓
export * from './InterventionPolicyModel';

// ── scoreWindowBatch collision fix ─────────────────────────────────────────
// Explicitly re-exporting under aliases resolves the TS2308 ambiguity that
// arises when two `export *` declarations both export the same name.
// The bare `scoreWindowBatch` name is pinned to ToxicityRiskModel here;
// callers should prefer the aliased versions.
export { scoreWindowBatch }                            from './ToxicityRiskModel';
export { scoreWindowBatch as scoreToxicityWindowBatch } from './ToxicityRiskModel';
export { scoreWindowBatch as scoreChurnWindowBatch }    from './ChurnRiskModel';

// ============================================================================
// MARK: Explicit named imports — FeatureIngestor
// ============================================================================
import {
  // consts
  CHAT_FEATURE_INGESTOR_MODULE_NAME,
  CHAT_FEATURE_INGESTOR_VERSION,
  CHAT_FEATURE_INGESTOR_RUNTIME_LAWS,
  CHAT_FEATURE_INGESTOR_DEFAULTS,
  CHAT_MODEL_FAMILIES,
  // class + options
  ChatFeatureIngestor,
  type ChatFeatureIngestorOptions,
  // core types
  type ChatFeatureIngestResult,
  type ChatFeatureRow,
  type ChatModelFamily,
  type ChatFeatureQualityGrade,
  type ChatFeatureRowViolationKind,
  type ChatFeatureAnchorSet,
  type ChatFeatureWindowSummary,
  type ChatFeatureScalarMap,
  type ChatFeatureCategoricalMap,
  type ChatFeatureDiagnostics,
  type ChatFeatureBatchResult,
  type ChatFeatureRowViolation,
  type ChatFeatureRowValidationResult,
  type ChatFeatureQualityReport,
  type ChatFeatureDriftReport,
  type ChatFeatureDriftEntry,
  type ChatFeatureAuditEntry,
  type ChatFeatureIngestorStats,
  type ChatFeatureIngestorLoggerPort,
  type ChatFeatureIngestorClockPort,
  type ChatFeatureIngestorHashPort,
  // standalone helpers
  createChatFeatureIngestor,
  ingestChatFeatures,
  ingestChatFeaturesBatch,
  validateChatFeatureRow,
  buildChatFeatureQualityReport,
  chatFeatureRowDigest,
  deriveChatFeatureRowContext,
  chatFeatureModelFamilyPrefix,
  chatFeatureRowHasTag,
  chatFeatureRowsForFamily,
  chatFeatureRowsForEntity,
  chatFeatureRowAgeMs,
  chatFeatureScalarDensity01,
  chatFeatureRowSummaryLine,
  // namespace
  CHAT_FEATURE_INGESTOR_NAMESPACE,
} from './FeatureIngestor';

// ============================================================================
// MARK: Explicit named imports — OnlineFeatureStore
// ============================================================================
import {
  // consts
  CHAT_ONLINE_FEATURE_STORE_MODULE_NAME,
  CHAT_ONLINE_FEATURE_STORE_VERSION,
  CHAT_ONLINE_FEATURE_STORE_RUNTIME_LAWS,
  CHAT_ONLINE_FEATURE_STORE_DEFAULTS,
  // class + options
  OnlineFeatureStore,
  type ChatOnlineFeatureStoreOptions,
  // query + record types
  type ChatOnlineFeatureStoreQuery,
  type ChatOnlineFeatureStoreRecord,
  type ChatOnlineFeatureStoreStats,
  type ChatOnlineFeatureStoreLoggerPort,
  type ChatOnlineFeatureStoreClockPort,
  // aggregate / window / snapshot types
  type ChatOnlineFeatureAggregate,
  type ChatOnlineInferenceWindow,
  type ChatOnlineFeatureStoreHydrationSnapshot,
  type ChatOnlineFeatureStoreDeltaSnapshot,
  type ChatOnlineFeatureEntityProfile,
  type ChatOnlineFeatureWindowComparison,
  type ChatOnlineFeatureStoreWatchEntry,
  type ChatOnlineFeatureMultiAggregate,
  // standalone helpers
  createOnlineFeatureStore,
  hydrateOnlineFeatureStore,
  aggregateOnlineFeatureWindow,
  multiAggregateOnlineFeatureWindow,
  scalarFromAggregate,
  categoryFromAggregate,
  inferenceWindowFreshnessMs,
  inferenceWindowIsStale,
  aggregateSummaryLine,
  // namespace
  CHAT_ONLINE_FEATURE_STORE_NAMESPACE,
} from './OnlineFeatureStore';

// ============================================================================
// MARK: Explicit named imports — EngagementModel
// ============================================================================
import {
  // consts
  CHAT_ENGAGEMENT_MODEL_MODULE_NAME,
  CHAT_ENGAGEMENT_MODEL_VERSION,
  CHAT_ENGAGEMENT_MODEL_RUNTIME_LAWS,
  CHAT_ENGAGEMENT_MODEL_DEFAULTS,
  // class + options
  EngagementModel,
  type EngagementModelOptions,
  type EngagementModelLoggerPort,
  type EngagementModelClockPort,
  // context / input / prior / score types
  type EngagementModelContext,
  type EngagementModelInput,
  type EngagementModelPriorState,
  type EngagementModelScore,
  type EngagementBand,
  type EngagementRecommendation,
  type EngagementTrendDirection,
  type EngagementChannelPostureKind,
  type EngagementScoreContribution,
  type EngagementModelDiagnostics,
  type EngagementScoreBatchResult,
  type EngagementBatchStats,
  type EngagementTrendSignal,
  type EngagementPressureProfile,
  type EngagementChannelPosture,
  type EngagementAuditEntry,
  type EngagementHealthReport,
  // standalone helpers
  createEngagementModel,
  scoreEngagementAggregate,
  scoreEngagementStore,
  scoreEngagementRows,
  scoreEngagementInferenceWindow,
  serializeEngagementScore,
  hydratePriorEngagementState,
  engagementIsElectric,
  engagementIsFrozen,
  engagementIsFragile,
  engagementIsDealRoomColdPlay,
  engagementShouldSilenceChannel,
  engagementBandLabel,
  engagementChannelPostureLabel,
  engagementTrendLabel,
  engagementExplanationSummary,
  engagementScoreCompare,
  engagementConfidence100,
  engagementScoreToTelemetry,
  deriveEngagementChannelPosture,
  sortEngagementScoresDescending,
  engagementScoresNeedingHelper,
  engagementScoresCritical,
  engagementIsStableActive,
  // namespace
  CHAT_ENGAGEMENT_MODEL_NAMESPACE,
} from './EngagementModel';

// ============================================================================
// MARK: Explicit named imports — HaterTargetingModel
// ============================================================================
import {
  // consts
  CHAT_HATER_TARGETING_MODEL_MODULE_NAME,
  CHAT_HATER_TARGETING_MODEL_VERSION,
  CHAT_HATER_TARGETING_MODEL_RUNTIME_LAWS,
  CHAT_HATER_TARGETING_MODEL_DEFAULTS,
  // class + options
  HaterTargetingModel,
  type HaterTargetingModelOptions,
  type HaterTargetingModelLoggerPort,
  type HaterTargetingModelClockPort,
  // context / input / prior / score types
  type HaterTargetingModelContext,
  type HaterTargetingModelInput,
  type HaterTargetingPriorState,
  type HaterTargetingScore,
  type HaterEscalationBand,
  type HaterTactic,
  type HaterTargetingRecommendation,
  type HaterTargetingTrendDirection,
  type HaterPersonaAffinity,
  type HaterTargetingContribution,
  type HaterTargetingDiagnostics,
  type HaterTargetingBatchResult,
  type HaterTargetingBatchStats,
  type HaterTargetingAuditEntry,
  type HaterTargetingHealthReport,
  // standalone helpers
  createHaterTargetingModel,
  scoreHaterTargetingAggregate,
  scoreHaterTargetingStore,
  scoreHaterTargetingRows,
  scoreHaterTargetingInferenceWindow,
  serializeHaterTargetingScore,
  hydratePriorHaterTargetingState,
  haterTargetingIsActive,
  haterTargetingIsSuppressed,
  haterTargetingIsCeremonial,
  haterTargetingIsInvasionAmbush,
  haterEscalationBandLabel,
  haterTacticLabel,
  haterTargetingExplanationSummary,
  haterTargetingScoreCompare,
  haterTargetingToTelemetry,
  sortHaterTargetingScoresDescending,
  haterTargetingScoresNeedingAction,
  haterTargetingScoresCritical,
  haterTargetingPersonaSummary,
  // namespace
  CHAT_HATER_TARGETING_MODEL_NAMESPACE,
} from './HaterTargetingModel';

// ============================================================================
// MARK: Explicit named imports — HelperTimingModel
// ============================================================================
import {
  // consts
  CHAT_HELPER_TIMING_MODEL_MODULE_NAME,
  CHAT_HELPER_TIMING_MODEL_VERSION,
  CHAT_HELPER_TIMING_MODEL_RUNTIME_LAWS,
  CHAT_HELPER_TIMING_MODEL_DEFAULTS,
  // class + options
  HelperTimingModel,
  type HelperTimingModelOptions,
  type HelperTimingModelLoggerPort,
  type HelperTimingModelClockPort,
  // context / input / prior / score types
  type HelperTimingModelContext,
  type HelperTimingModelInput,
  type HelperTimingPriorState,
  type HelperTimingScore,
  type HelperInterventionRecommendation,
  type HelperInterventionStyle,
  type HelperTimingTrendDirection,
  type HelperPersonaAffinity,
  type HelperTimingExplanationFactor,
  type HelperTimingTrendSignal,
  type HelperTimingBatchResult,
  type HelperTimingBatchStats,
  type HelperTimingAuditEntry,
  type HelperTimingHealthReport,
  // standalone helpers
  createHelperTimingModel,
  scoreHelperTimingAggregate,
  scoreHelperTimingStore,
  scoreHelperTimingRows,
  scoreHelperTimingInferenceWindow,
  serializeHelperTimingScore,
  hydratePriorHelperTimingState,
  helperTimingSummary,
  helperTimingShouldSpeak,
  helperTimingIsEmergency,
  helperTimingPrefersPrivate,
  helperTimingConfidence100,
  helperInterventionRecommendationLabel,
  helperInterventionStyleLabel,
  helperTimingExplanationSummary,
  helperTimingScoreCompare,
  helperTimingToTelemetry,
  sortHelperTimingScoresDescending,
  helperTimingScoresNeedingAction,
  helperTimingScoresEmergency,
  helperTimingPersonaSummary,
  // namespace
  CHAT_HELPER_TIMING_MODEL_NAMESPACE,
} from './HelperTimingModel';

// ============================================================================
// MARK: Explicit named imports — ChannelAffinityModel
// ============================================================================
import {
  // consts
  CHAT_CHANNEL_AFFINITY_MODEL_MODULE_NAME,
  CHAT_CHANNEL_AFFINITY_MODEL_VERSION,
  CHAT_CHANNEL_AFFINITY_MODEL_RUNTIME_LAWS,
  CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
  CHANNEL_STAGE_PROFILES,
  // class + options
  ChannelAffinityModel,
  type ChannelAffinityModelOptions,
  type ChannelAffinityModelLoggerPort,
  type ChannelAffinityModelClockPort,
  // context / input / prior / score types
  type ChannelAffinityModelContext,
  type ChannelAffinityModelInput,
  type ChannelAffinityPriorState,
  type ChannelAffinityScore,
  type ChannelAffinityRecommendation,
  type ChannelAffinityTrendDirection,
  type ChannelCongestLevel,
  type ChannelAffinityConfidenceLevel,
  type ChannelScoreMap,
  type ChannelAffinityExplanationFactor,
  type ChannelAffinityTrendSummary,
  type ChannelAffinityPriorSnapshot,
  type ChannelAffinityScenario,
  type ChannelAffinityAuditReport,
  type ChannelAffinityBatchResult,
  // standalone helpers
  createChannelAffinityModel,
  channelAffinitySummary,
  channelAffinityShouldMove,
  channelAffinityPrimaryScore,
  channelAffinityScoreDelta,
  channelAffinityIsStable,
  channelAffinityTopReasons,
  channelAffinityDiagnosticLines,
  // namespace
  CHAT_CHANNEL_AFFINITY_MODEL_NAMESPACE,
} from './ChannelAffinityModel';

// ============================================================================
// MARK: Explicit named imports — ToxicityRiskModel
// ============================================================================
import {
  // consts
  CHAT_TOXICITY_RISK_MODEL_MODULE_NAME,
  CHAT_TOXICITY_RISK_MODEL_VERSION,
  CHAT_TOXICITY_RISK_MODEL_RUNTIME_LAWS,
  CHAT_TOXICITY_RISK_MODEL_DEFAULTS,
  // class + options
  ToxicityRiskModel,
  type ToxicityRiskModelOptions,
  type ToxicityRiskModelLoggerPort,
  type ToxicityRiskModelClockPort,
  // context / input / prior / score types
  type ToxicityRiskModelContext,
  type ToxicityRiskModelInput,
  type ToxicityRiskPriorState,
  type ToxicityRiskScore,
  type ToxicityBand,
  type ToxicityRecommendation,
  type ToxicityTrendDirection,
  type ToxicityContribution,
  type ToxicityRiskModelDiagnostics,
  type ToxicityTrendSignal,
  type ToxicityBatchStats,
  type ToxicityAuditEntry,
  type ToxicityHealthReport,
  type ToxicityRiskBatchResult,
  // standalone helpers
  createToxicityRiskModel,
  scoreToxicityRiskAggregate,
  scoreToxicityRiskStore,
  scoreToxicityRiskRows,
  scoreToxicityRiskInferenceWindow,
  serializeToxicityRiskScore,
  hydratePriorToxicityRiskState,
  toxicityRiskSummary,
  toxicityRiskNeedsHardBlock,
  toxicityRiskNeedsReview,
  toxicityRiskNeedsShadowRoute,
  toxicityIsCritical,
  toxicityNeedsImmediate,
  toxicityIsInPublicCrowd,
  toxicityIsDealRoomCoercion,
  toxicityIsPileOnDriven,
  toxicityIsEscalating,
  toxicityIsCooling,
  toxicityIsLiveopsAmplified,
  toxicityBandLabel,
  toxicityRecommendationLabel,
  toxicityTrendLabel,
  toxicityExplanationSummary,
  toxicityPersonaSummary,
  toxicityScoreCompare,
  sortToxicityScoresDescending,
  toxicityScoresNeedingAction,
  toxicityScoresCritical,
  toxicityScoresNeedingHardBlock,
  toxicityConfidence100,
  toxicityScoreToTelemetry,
  // prior-state deriver (used by priorsFromScores)
  derivePriorStateToxicity,
  // scoreWindowBatch — imported under alias to resolve barrel collision
  scoreWindowBatch as scoreToxicityWindowBatchFn,
  // namespace
  CHAT_TOXICITY_RISK_MODEL_NAMESPACE,
} from './ToxicityRiskModel';

// ============================================================================
// MARK: Explicit named imports — ChurnRiskModel
// ============================================================================
import {
  // consts
  CHAT_CHURN_RISK_MODEL_MODULE_NAME,
  CHAT_CHURN_RISK_MODEL_VERSION,
  CHAT_CHURN_RISK_MODEL_RUNTIME_LAWS,
  CHAT_CHURN_RISK_MODEL_DEFAULTS,
  // class + options
  ChurnRiskModel,
  type ChurnRiskModelOptions,
  type ChurnRiskModelLoggerPort,
  type ChurnRiskModelClockPort,
  // context / input / prior / score types
  type ChurnRiskModelContext,
  type ChurnRiskModelInput,
  type ChurnRiskPriorState,
  type ChurnRiskScore,
  type ChurnBand,
  type ChurnRecommendation,
  type ChurnTrendDirection,
  type ChurnTrendSignal,
  type ChurnBatchStats,
  type ChurnAuditEntry,
  type ChurnHealthReport,
  type ChurnContribution,
  type ChurnRiskModelDiagnostics,
  type ChurnRiskBatchResult,
  // standalone helpers
  createChurnRiskModel,
  scoreChurnRiskAggregate,
  scoreChurnRiskStore,
  scoreChurnRiskRows,
  scoreChurnRiskInferenceWindow,
  serializeChurnRiskScore,
  hydratePriorChurnRiskState,
  churnRiskSummary,
  churnRiskNeedsRescue,
  churnRiskNeedsPublicWitness,
  churnRiskShouldHold,
  churnIsCritical,
  churnIsEmergency,
  churnIsDealRoomSilent,
  churnIsRageDriven,
  churnIsQuietWithdrawal,
  churnIsLiveopsAmplified,
  churnIsWorsening,
  churnIsRecovering,
  churnIsBankruptcyRage,
  churnHasHighRecovery,
  churnBandLabel,
  churnRecommendationLabel,
  churnTrendLabel,
  churnExplanationSummary,
  churnScoreToTelemetry,
  churnScoreCompare,
  sortChurnScoresDescending,
  churnScoresNeedingAction,
  churnScoresCritical,
  churnScoresEmergency,
  churnConfidence100,
  // prior-state deriver (used by priorsFromScores)
  derivePriorStateChurn,
  // scoreWindowBatch — imported under alias to resolve barrel collision
  scoreWindowBatch as scoreChurnWindowBatchFn,
  // namespace
  CHAT_CHURN_RISK_MODEL_NAMESPACE,
} from './ChurnRiskModel';

// ============================================================================
// MARK: Explicit named imports — InterventionPolicyModel
// ============================================================================
import {
  // consts
  CHAT_INTERVENTION_POLICY_MODEL_MODULE_NAME,
  CHAT_INTERVENTION_POLICY_MODEL_VERSION,
  CHAT_INTERVENTION_POLICY_MODEL_RUNTIME_LAWS,
  CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS,
  // class + options
  InterventionPolicyModel,
  type InterventionPolicyModelOptions,
  type InterventionPolicyModelLoggerPort,
  type InterventionPolicyModelClockPort,
  // context / input / prior / score types
  type InterventionPolicyModelContext,
  type InterventionPolicyInput,
  type InterventionPolicyPriorState,
  type InterventionPolicyScore,
  type InterventionRecommendation,
  type InterventionUrgencyBand,
  type InterventionSeverityBand,
  type InterventionTrendDirection,
  type InterventionExplanationFactor,
  type InterventionLaneDecision,
  type InterventionTrendSignal,
  type InterventionBatchStats,
  type InterventionAuditEntry,
  type InterventionHealthReport,
  type InterventionPolicyBatchResult,
  // standalone helpers
  createInterventionPolicyModel,
  scoreInterventionPolicyRows,
  scoreInterventionPolicyAggregate,
  scoreInterventionPolicyInferenceWindow,
  scoreInterventionPolicyStore,
  scoreInterventionPolicyIngestResult,
  serializeInterventionPolicyScore,
  hydratePriorInterventionPolicyState,
  interventionPolicySummary,
  interventionPolicyNeedsModeration,
  interventionPolicyNeedsRecovery,
  interventionPolicyNeedsRedirect,
  interventionPolicyAllowsHater,
  interventionIsHardBlock,
  interventionIsQuarantine,
  interventionHasSiblingConflict,
  interventionIsLiveopsAmplified,
  interventionIsEscalating,
  interventionIsDeescalating,
  interventionNeedsHelper,
  interventionNeedsPublicWitness,
  interventionIsHoldSilence,
  interventionIsTeaching,
  interventionIsNegotiation,
  interventionIsShadowHater,
  interventionRecommendationLabel,
  interventionUrgencyLabel,
  interventionTrendLabel,
  interventionExplanationSummary,
  interventionScoreToTelemetry,
  interventionScoreCompare,
  sortInterventionScoresDescending,
  interventionScoresNeedingAction,
  interventionScoresHardBlock,
  interventionScoresEscalating,
  interventionConfidence100,
  // namespace
  CHAT_INTERVENTION_POLICY_MODEL_NAMESPACE,
} from './InterventionPolicyModel';

// ── Shared primitive types ───────────────────────────────────────────────────
import type {
  JsonValue,
  Nullable,
  UnixMs,
  ChatLearningProfile,
  ChatSignalEnvelope,
  ChatRoomId,
  ChatSessionId,
  ChatUserId,
} from '../types';

// ============================================================================
// MARK: Stack identity constants
// ============================================================================

export const CHAT_BACKEND_ML_STACK_MODULE_NAME =
  'PZO_BACKEND_CHAT_ML_STACK' as const;

export const CHAT_BACKEND_ML_STACK_VERSION =
  '2026.03.22-backend-chat-ml-stack.v3' as const;

// ============================================================================
// MARK: Logger port
// ============================================================================

/** Structural logger port consumed by ChatMlModelStack. */
export interface ChatMlStackLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

// ============================================================================
// MARK: Stack option interfaces
// ============================================================================

/**
 * Construction options forwarded to each model and store in the stack.
 * Every key is optional; unset keys fall back to the model's own defaults.
 */
export interface ChatMlModelStackOptions {
  readonly logger?: ChatMlStackLoggerPort;
  readonly featureIngestor?: ChatFeatureIngestorOptions;
  readonly onlineFeatureStore?: ChatOnlineFeatureStoreOptions;
  readonly engagement?: EngagementModelOptions;
  readonly hater?: HaterTargetingModelOptions;
  readonly helper?: HelperTimingModelOptions;
  readonly channel?: ChannelAffinityModelOptions;
  readonly toxicity?: ToxicityRiskModelOptions;
  readonly churn?: ChurnRiskModelOptions;
  readonly intervention?: InterventionPolicyModelOptions;
}

// ============================================================================
// MARK: Score + prior bundle interfaces
// ============================================================================

/**
 * A bundle of prior states from the previous scoring cycle, threaded into
 * the next cycle for ratchet logic and trend direction tracking.
 */
export interface ChatMlPriorStateBundle {
  readonly engagement?: Nullable<EngagementModelPriorState>;
  readonly hater?: Nullable<HaterTargetingPriorState>;
  readonly helper?: Nullable<HelperTimingPriorState>;
  readonly channel?: Nullable<ChannelAffinityPriorState>;
  readonly toxicity?: Nullable<ToxicityRiskPriorState>;
  readonly churn?: Nullable<ChurnRiskPriorState>;
  readonly intervention?: Nullable<InterventionPolicyPriorState>;
}

/**
 * The complete set of scores produced for one evaluation cycle.
 * Immutable after construction.
 */
export interface ChatMlScoreBundle {
  readonly engagement: EngagementModelScore;
  readonly hater: HaterTargetingScore;
  readonly helper: HelperTimingScore;
  readonly channel: ChannelAffinityScore;
  readonly toxicity: ToxicityRiskScore;
  readonly churn: ChurnRiskScore;
  readonly intervention: InterventionPolicyScore;
}

// ============================================================================
// MARK: Evaluation context and result interfaces
// ============================================================================

/**
 * Caller-supplied context threaded through every model in the stack.
 * All fields are optional; absent context falls back to model defaults.
 */
export interface ChatMlEvaluationContext {
  readonly learningProfile?: Nullable<ChatLearningProfile>;
  readonly sourceSignals?: readonly ChatSignalEnvelope[];
  readonly priors?: ChatMlPriorStateBundle;
}

/** Result of an evaluateAggregate / evaluateStore call. */
export interface ChatMlAggregateEvaluation {
  readonly aggregate: ChatOnlineFeatureAggregate;
  readonly scores: ChatMlScoreBundle;
}

/** Result of an evaluateRows call. */
export interface ChatMlRowsEvaluation {
  readonly rows: readonly ChatFeatureRow[];
  readonly scores: ChatMlScoreBundle;
}

/**
 * Result of evaluateIngestResult and ingestAndEvaluate.
 * Includes the original ingestResult, current store row count, and scores.
 */
export interface ChatMlIngestEvaluation {
  readonly ingestResult: ChatFeatureIngestResult;
  readonly storedRowCount: number;
  readonly scores: ChatMlScoreBundle;
}

// ============================================================================
// MARK: Health and audit bundle interfaces
// ============================================================================

/**
 * Aggregated health reports from all models that expose getHealthReport().
 * ChannelAffinityModel exposes buildAuditReport/scoreAndAudit rather than a
 * standalone health report, so it is intentionally absent from this bundle.
 */
export interface ChatMlHealthBundle {
  readonly engagement: EngagementHealthReport;
  readonly hater: HaterTargetingHealthReport;
  readonly helper: HelperTimingHealthReport;
  readonly toxicity: ToxicityHealthReport;
  readonly churn: ChurnHealthReport;
  readonly intervention: InterventionHealthReport;
  /** Live store statistics captured at the same timestamp. */
  readonly store: ChatOnlineFeatureStoreStats;
}

/**
 * Aggregated audit logs from all models that expose getAuditLog().
 * ChannelAffinityModel uses buildAuditReport/scoreAndAudit and is absent here.
 */
export interface ChatMlAuditBundle {
  readonly engagement: readonly EngagementAuditEntry[];
  readonly hater: readonly HaterTargetingAuditEntry[];
  readonly helper: readonly HelperTimingAuditEntry[];
  readonly toxicity: readonly ToxicityAuditEntry[];
  readonly churn: readonly ChurnAuditEntry[];
  readonly intervention: readonly InterventionAuditEntry[];
}

/**
 * Metadata returned by store-management operations (prune, hydrate, etc.).
 */
export interface ChatMlStoreOpsResult {
  /** How many rows were affected (pruned / added / removed). */
  readonly rowsAffected: number;
  /** Live stats captured immediately after the operation. */
  readonly stats: ChatOnlineFeatureStoreStats;
}

// ============================================================================
// MARK: Internal helpers
// ============================================================================

const DEFAULT_LOGGER: ChatMlStackLoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** Derive a ChatOnlineFeatureStoreQuery from any aggregate. */
function entityQueryFromAggregate(
  aggregate: ChatOnlineFeatureAggregate,
): ChatOnlineFeatureStoreQuery {
  return {
    roomId:    aggregate.roomId    ?? undefined,
    sessionId: aggregate.sessionId ?? undefined,
    userId:    aggregate.userId    ?? undefined,
    entityKey: aggregate.entityKeys[0],
  };
}

// ============================================================================
// MARK: ChatMlModelStack
// ============================================================================

/**
 * Coordinated ML stack for the backend chat authority lane.
 *
 * Instantiates and wires all nine models in the correct dependency order:
 *
 *   FeatureIngestor → OnlineFeatureStore
 *     → Engagement → Hater → Helper → Channel
 *       → Toxicity → Churn → InterventionPolicy
 *
 * All evaluation methods return immutable result objects. The stack owns
 * the store's mutable state; callers must not access store.upsert() directly
 * except through appendIngestResult or ingestAndEvaluate.
 */
export class ChatMlModelStack {

  // ── Public model refs (readable, not writable) ───────────────────────────
  public readonly featureIngestor: ChatFeatureIngestor;
  public readonly store:           OnlineFeatureStore;
  public readonly engagement:      EngagementModel;
  public readonly hater:           HaterTargetingModel;
  public readonly helper:          HelperTimingModel;
  public readonly channel:         ChannelAffinityModel;
  public readonly toxicity:        ToxicityRiskModel;
  public readonly churn:           ChurnRiskModel;
  public readonly intervention:    InterventionPolicyModel;

  private readonly logger: ChatMlStackLoggerPort;

  // ── Constructor ──────────────────────────────────────────────────────────

  public constructor(options: ChatMlModelStackOptions = {}) {
    this.logger          = options.logger ?? DEFAULT_LOGGER;
    this.featureIngestor = new ChatFeatureIngestor(options.featureIngestor ?? {});
    this.store           = new OnlineFeatureStore(options.onlineFeatureStore ?? {});
    this.engagement      = new EngagementModel(options.engagement ?? {});
    this.hater           = new HaterTargetingModel(options.hater ?? {});
    this.helper          = new HelperTimingModel(options.helper ?? {});
    this.channel         = new ChannelAffinityModel(options.channel ?? {});
    this.toxicity        = new ToxicityRiskModel(options.toxicity ?? {});
    this.churn           = new ChurnRiskModel(options.churn ?? {});
    this.intervention    = new InterventionPolicyModel(options.intervention ?? {});
  }

  // ── MARK: Evaluation — aggregate ─────────────────────────────────────────

  /**
   * Score all models from a pre-built ChatOnlineFeatureAggregate.
   * Use when the aggregate is already materialised; avoids a re-query.
   */
  public evaluateAggregate(
    aggregate: ChatOnlineFeatureAggregate,
    context: ChatMlEvaluationContext = {},
  ): ChatMlAggregateEvaluation {
    const priors = context.priors ?? {};

    // ── Layer 1: Engagement ────────────────────────────────────────────────
    const engagement = this.engagement.scoreAggregate(aggregate, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      prior:           priors.engagement ?? null,
    });

    // ── Layer 2: Hater (depends on engagement) ────────────────────────────
    const hater = this.hater.scoreAggregate(aggregate, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      prior:           priors.hater ?? null,
    });

    // ── Layer 3: Helper (depends on engagement + hater) ───────────────────
    const helper = this.helper.scoreAggregate(aggregate, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      hater,
      haterPrior:      priors.hater ?? null,
      prior:           priors.helper ?? null,
    });

    // ── Layer 4: Channel (depends on engagement + hater + helper) ─────────
    const channel = this.channel.scoreAggregate(aggregate, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      hater,
      haterPrior:      priors.hater ?? null,
      helper,
      helperPrior:     priors.helper ?? null,
      prior:           priors.channel ?? null,
    });

    // ── Layer 5: Toxicity (depends on layers 1–4) ─────────────────────────
    const toxicity = this.toxicity.scoreAggregate({
      aggregate,
      engagementScore:      engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore:           hater,
      haterPriorState:      priors.hater ?? null,
      helperScore:          helper,
      helperPriorState:     priors.helper ?? null,
      channelScore:         channel,
      channelPriorState:    priors.channel ?? null,
      signals:              context.sourceSignals ?? [],
    }).score;

    // ── Layer 6: Churn (depends on layers 1–5) ────────────────────────────
    const churn = this.churn.scoreAggregate({
      aggregate,
      engagementScore:      engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore:           hater,
      haterPriorState:      priors.hater ?? null,
      helperScore:          helper,
      helperPriorState:     priors.helper ?? null,
      channelScore:         channel,
      channelPriorState:    priors.channel ?? null,
      toxicityScore:        toxicity,
      toxicityPriorState:   priors.toxicity ?? null,
      signals:              context.sourceSignals ?? [],
    }).score;

    // ── Layer 7: InterventionPolicy (depends on layers 1–6) ───────────────
    const intervention = this.intervention.scoreAggregate({
      aggregate,
      learningProfile:      context.learningProfile ?? null,
      sourceSignals:        context.sourceSignals ?? [],
      engagementScore:      engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore:           hater,
      haterPriorState:      priors.hater ?? null,
      helperScore:          helper,
      helperPriorState:     priors.helper ?? null,
      channelScore:         channel,
      channelPriorState:    priors.channel ?? null,
      toxicityScore:        toxicity,
      toxicityPriorState:   priors.toxicity ?? null,
      churnScore:           churn,
      churnPriorState:      priors.churn ?? null,
      prior:                priors.intervention ?? null,
    }).score;

    const scores = Object.freeze({
      engagement,
      hater,
      helper,
      channel,
      toxicity,
      churn,
      intervention,
    }) satisfies ChatMlScoreBundle;

    this.logger.debug('chat_ml_stack_evaluate_aggregate', {
      roomId:         aggregate.roomId as JsonValue,
      userId:         aggregate.userId as JsonValue,
      intervention:   intervention.recommendation as JsonValue,
    });

    return Object.freeze({ aggregate, scores });
  }

  // ── MARK: Evaluation — raw rows ──────────────────────────────────────────

  /**
   * Score all models directly from raw ChatFeatureRow[].
   * Does NOT write rows to the store. Use ingestAndEvaluate to persist first.
   */
  public evaluateRows(
    rows: readonly ChatFeatureRow[],
    context: ChatMlEvaluationContext & { readonly generatedAt?: number } = {},
  ): ChatMlRowsEvaluation {
    const priors = context.priors ?? {};

    // ── Layers 1–4: row-based upstream models ─────────────────────────────
    const engagement = this.engagement.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      prior:           priors.engagement ?? null,
    });

    const hater = this.hater.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      prior:           priors.hater ?? null,
    });

    const helper = this.helper.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      hater,
      haterPrior:      priors.hater ?? null,
      prior:           priors.helper ?? null,
    });

    const channel = this.channel.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      hater,
      haterPrior:      priors.hater ?? null,
      helper,
      helperPrior:     priors.helper ?? null,
      prior:           priors.channel ?? null,
    });

    // ── Layers 5–7: downstream row-based models ───────────────────────────
    const toxicity = this.toxicity.scoreRows({
      rows,
      generatedAt:          context.generatedAt === undefined ? undefined : (context.generatedAt as unknown as UnixMs),
      engagementScore:      engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore:           hater,
      haterPriorState:      priors.hater ?? null,
      helperScore:          helper,
      helperPriorState:     priors.helper ?? null,
      channelScore:         channel,
      channelPriorState:    priors.channel ?? null,
      signals:              context.sourceSignals ?? [],
    }).score;

    const churn = this.churn.scoreRows({
      rows,
      generatedAt:          context.generatedAt === undefined ? undefined : (context.generatedAt as unknown as UnixMs),
      engagementScore:      engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore:           hater,
      haterPriorState:      priors.hater ?? null,
      helperScore:          helper,
      helperPriorState:     priors.helper ?? null,
      channelScore:         channel,
      channelPriorState:    priors.channel ?? null,
      toxicityScore:        toxicity,
      toxicityPriorState:   priors.toxicity ?? null,
      signals:              context.sourceSignals ?? [],
    }).score;

    const intervention = this.intervention.scoreRows({
      rows,
      generatedAt:          context.generatedAt === undefined ? undefined : (context.generatedAt as unknown as UnixMs),
      learningProfile:      context.learningProfile ?? null,
      sourceSignals:        context.sourceSignals ?? [],
      engagementScore:      engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore:           hater,
      haterPriorState:      priors.hater ?? null,
      helperScore:          helper,
      helperPriorState:     priors.helper ?? null,
      channelScore:         channel,
      channelPriorState:    priors.channel ?? null,
      toxicityScore:        toxicity,
      toxicityPriorState:   priors.toxicity ?? null,
      churnScore:           churn,
      churnPriorState:      priors.churn ?? null,
      prior:                priors.intervention ?? null,
    }).score;

    return Object.freeze({
      rows,
      scores: Object.freeze({
        engagement, hater, helper, channel, toxicity, churn, intervention,
      }),
    });
  }

  // ── MARK: Evaluation — store query ───────────────────────────────────────

  /**
   * Aggregate from the internal store using query, then score all models.
   */
  public evaluateStore(
    query: ChatOnlineFeatureStoreQuery,
    context: ChatMlEvaluationContext = {},
  ): ChatMlAggregateEvaluation {
    const aggregate = this.store.aggregate(query);
    return this.evaluateAggregate(aggregate, context);
  }

  // ── MARK: Evaluation — inference window ──────────────────────────────────

  /**
   * Score from a pre-built ChatOnlineInferenceWindow.
   * Falls back to the store aggregate for the upstream model layers, then
   * re-runs InterventionPolicy through the window-aware path.
   */
  public evaluateInferenceWindow(
    window: ChatOnlineInferenceWindow,
    identity: {
      readonly roomId?:    Nullable<ChatRoomId>;
      readonly sessionId?: Nullable<ChatSessionId>;
      readonly userId?:    Nullable<ChatUserId>;
    } = {},
    context: ChatMlEvaluationContext = {},
  ): ChatMlAggregateEvaluation {
    const query: ChatOnlineFeatureStoreQuery = {
      roomId:    identity.roomId    ?? undefined,
      sessionId: identity.sessionId ?? undefined,
      userId:    identity.userId    ?? undefined,
      entityKey: undefined,
    };

    // Build baseline scores from the store aggregate for layers 1–6
    const fallbackAggregate = this.store.aggregate(query);
    const { scores } = this.evaluateAggregate(fallbackAggregate, context);

    // Re-score InterventionPolicy through the richer inference window path
    const intervention = this.intervention.scoreInferenceWindow({
      window,
      roomId:               identity.roomId    ?? null,
      sessionId:            identity.sessionId ?? null,
      userId:               identity.userId    ?? null,
      learningProfile:      context.learningProfile   ?? null,
      sourceSignals:        context.sourceSignals      ?? [],
      engagementScore:      scores.engagement,
      engagementPriorState: context.priors?.engagement ?? null,
      haterScore:           scores.hater,
      haterPriorState:      context.priors?.hater      ?? null,
      helperScore:          scores.helper,
      helperPriorState:     context.priors?.helper     ?? null,
      channelScore:         scores.channel,
      channelPriorState:    context.priors?.channel    ?? null,
      toxicityScore:        scores.toxicity,
      toxicityPriorState:   context.priors?.toxicity   ?? null,
      churnScore:           scores.churn,
      churnPriorState:      context.priors?.churn      ?? null,
      prior:                context.priors?.intervention ?? null,
    }).score;

    return Object.freeze({
      aggregate: fallbackAggregate,
      scores: Object.freeze({ ...scores, intervention }),
    });
  }

  // ── MARK: Evaluation — ingest-first (v3) ─────────────────────────────────

  /**
   * Evaluate using the dedicated scoreIngestResult paths on Toxicity, Churn,
   * and InterventionPolicy. Layers 1–4 use scoreRows (no ingest-specific path
   * exists on those models). The ingestResult is appended to the store.
   *
   * Use this path when:
   *  • The caller already has a ChatFeatureIngestResult from ChatFeatureIngestor.
   *  • You want semantic correctness on the downstream models' ingest path.
   *  • You want the rows persisted to the store in the same call.
   */
  public evaluateIngestResult(
    ingestResult: ChatFeatureIngestResult,
    context: ChatMlEvaluationContext = {},
  ): ChatMlIngestEvaluation {
    const priors     = context.priors ?? {};
    const rows       = ingestResult.rows;
    const generatedAt = ingestResult.generatedAt;

    // ── Layers 1–4: scoreRows (no scoreIngestResult on these models) ───────
    const engagement = this.engagement.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      prior:           priors.engagement ?? null,
    });

    const hater = this.hater.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      prior:           priors.hater ?? null,
    });

    const helper = this.helper.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      hater,
      haterPrior:      priors.hater ?? null,
      prior:           priors.helper ?? null,
    });

    const channel = this.channel.scoreRows(rows, {
      learningProfile: context.learningProfile ?? null,
      sourceSignal:    context.sourceSignals?.[0] ?? null,
      engagement,
      engagementPrior: priors.engagement ?? null,
      hater,
      haterPrior:      priors.hater ?? null,
      helper,
      helperPrior:     priors.helper ?? null,
      prior:           priors.channel ?? null,
    });

    // ── Layer 5: Toxicity — dedicated scoreIngestResult path ──────────────
    const toxicity = this.toxicity.scoreIngestResult({
      ingestResult,
      engagementScore:      engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore:           hater,
      haterPriorState:      priors.hater ?? null,
      helperScore:          helper,
      helperPriorState:     priors.helper ?? null,
      channelScore:         channel,
      channelPriorState:    priors.channel ?? null,
      signals:              context.sourceSignals ?? [],
    }).score;

    // ── Layer 6: Churn — dedicated scoreIngestResult path ─────────────────
    const churn = this.churn.scoreIngestResult({
      ingestResult,
      engagementScore:      engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore:           hater,
      haterPriorState:      priors.hater ?? null,
      helperScore:          helper,
      helperPriorState:     priors.helper ?? null,
      channelScore:         channel,
      channelPriorState:    priors.channel ?? null,
      toxicityScore:        toxicity,
      toxicityPriorState:   priors.toxicity ?? null,
      signals:              context.sourceSignals ?? [],
    }).score;

    // ── Layer 7: InterventionPolicy — dedicated scoreIngestResult path ─────
    const intervention = this.intervention.scoreIngestResult({
      ingestResult,
      learningProfile:      context.learningProfile ?? null,
      sourceSignals:        context.sourceSignals ?? [],
      engagementScore:      engagement,
      engagementPriorState: priors.engagement ?? null,
      haterScore:           hater,
      haterPriorState:      priors.hater ?? null,
      helperScore:          helper,
      helperPriorState:     priors.helper ?? null,
      channelScore:         channel,
      channelPriorState:    priors.channel ?? null,
      toxicityScore:        toxicity,
      toxicityPriorState:   priors.toxicity ?? null,
      churnScore:           churn,
      churnPriorState:      priors.churn ?? null,
      prior:                priors.intervention ?? null,
    }).score;

    // Persist rows to store after scoring so audit trail is coherent
    const storedRowCount = this.appendIngestResult(ingestResult);

    const scores = Object.freeze({
      engagement, hater, helper, channel, toxicity, churn, intervention,
    }) satisfies ChatMlScoreBundle;

    this.logger.info('chat_ml_stack_evaluate_ingest_result', {
      roomId:          ingestResult.roomId    as JsonValue,
      userId:          ingestResult.userId    as JsonValue,
      storedRowCount:  storedRowCount         as JsonValue,
      intervention:    intervention.recommendation as JsonValue,
    });

    return Object.freeze({ ingestResult, storedRowCount, scores });
  }

  // ── MARK: Evaluation — ingest + aggregate (original path) ────────────────

  /**
   * Append the ingest result to the store, then aggregate and evaluate.
   * Differs from evaluateIngestResult in that it runs the aggregate-based
   * path rather than the ingest-specific path on downstream models.
   * Prefer evaluateIngestResult for first-arrival semantics.
   */
  public ingestAndEvaluate(
    ingestResult: ChatFeatureIngestResult,
    context: ChatMlEvaluationContext = {},
  ): ChatMlIngestEvaluation {
    const storedRowCount = this.appendIngestResult(ingestResult);
    const aggregate = this.store.aggregate({
      roomId:    ingestResult.roomId    ?? undefined,
      sessionId: ingestResult.sessionId ?? undefined,
      userId:    ingestResult.userId    ?? undefined,
    });
    const { scores } = this.evaluateAggregate(aggregate, context);
    return Object.freeze({ ingestResult, storedRowCount, scores });
  }

  // ── MARK: Store management ────────────────────────────────────────────────

  /**
   * Append a ChatFeatureIngestResult to the internal store.
   * Returns the total row count after the operation.
   */
  public appendIngestResult(ingestResult: ChatFeatureIngestResult): number {
    this.store.upsert(ingestResult);
    return this.store.stats().rowCount;
  }

  /**
   * Live stats snapshot of the internal OnlineFeatureStore.
   */
  public storeStats(): ChatOnlineFeatureStoreStats {
    return this.store.stats();
  }

  /**
   * Serialise the store to a hydration snapshot for persistence or transfer.
   * @param limit — max rows to include (default: store default)
   */
  public storeSnapshot(limit?: number): ChatOnlineFeatureStoreHydrationSnapshot {
    // serialize's param is inferred as a literal type from `as const` defaults;
    // widening via function cast is safe — the method treats it as a plain number.
    return (this.store.serialize as (limit?: number) => ChatOnlineFeatureStoreHydrationSnapshot)(limit);
  }

  /**
   * Hydrate the store from a previously serialised snapshot.
   * Returns the number of rows loaded.
   */
  public storeHydrate(
    snapshot: ChatOnlineFeatureStoreHydrationSnapshot,
  ): ChatMlStoreOpsResult {
    const rowsAffected = this.store.hydrate(snapshot);
    return Object.freeze({ rowsAffected, stats: this.store.stats() });
  }

  /**
   * Apply a delta snapshot (partial update) to the store.
   * Returns the number of rows affected.
   */
  public storeApplyDelta(
    delta: ChatOnlineFeatureStoreDeltaSnapshot,
  ): ChatMlStoreOpsResult {
    const rowsAffected = this.store.applyDelta(delta);
    return Object.freeze({ rowsAffected, stats: this.store.stats() });
  }

  /**
   * Prune expired rows from the store per TTL configuration.
   * Returns the number of rows removed.
   */
  public pruneStore(): ChatMlStoreOpsResult {
    const rowsAffected = this.store.prune();
    return Object.freeze({ rowsAffected, stats: this.store.stats() });
  }

  /**
   * True if the store contains any rows matching the given query.
   */
  public hasEvidence(query: ChatOnlineFeatureStoreQuery): boolean {
    return this.store.hasEvidence(query);
  }

  /**
   * Build a multi-family aggregate from the store.
   * Useful for models that need cross-family feature comparison.
   */
  public multiAggregateByFamily(
    families: readonly ChatModelFamily[],
    query: Omit<ChatOnlineFeatureStoreQuery, 'family'> = {},
  ): ChatOnlineFeatureMultiAggregate {
    return this.store.multiAggregate(families, query);
  }

  /**
   * Entity profile for a single store entity key.
   * Returns null if no rows exist for that key.
   */
  public storeEntityProfile(entityKey: string): Nullable<ChatOnlineFeatureEntityProfile> {
    return this.store.entityProfile(entityKey);
  }

  /**
   * Top N entity profiles ranked by row count / recency.
   */
  public storeTopEntities(limit?: number): readonly ChatOnlineFeatureEntityProfile[] {
    // entityProfiles's param is inferred as a literal type from `as const` defaults;
    // widening via function cast is safe — the method treats it as a plain number.
    return (this.store.entityProfiles as (limit?: number) => readonly ChatOnlineFeatureEntityProfile[])(limit);
  }

  // ── MARK: Health reports ──────────────────────────────────────────────────

  /**
   * Collect health reports from all models that expose getHealthReport().
   * ChannelAffinityModel uses buildAuditReport and is absent from this bundle.
   */
  public healthReports(): ChatMlHealthBundle {
    return Object.freeze({
      engagement:  this.engagement.getHealthReport(),
      hater:       this.hater.getHealthReport(),
      helper:      this.helper.getHealthReport(),
      toxicity:    this.toxicity.getHealthReport(),
      churn:       this.churn.getHealthReport(),
      intervention: this.intervention.getHealthReport(),
      store:       this.store.stats(),
    });
  }

  // ── MARK: Audit logs ──────────────────────────────────────────────────────

  /**
   * Collect audit log entries from all models that expose getAuditLog().
   * ChannelAffinityModel uses buildAuditReport and is absent.
   */
  public allAuditLogs(): ChatMlAuditBundle {
    return Object.freeze({
      engagement:  this.engagement.getAuditLog(),
      hater:       this.hater.getAuditLog(),
      helper:      this.helper.getAuditLog(),
      toxicity:    this.toxicity.getAuditLog(),
      churn:       this.churn.getAuditLog(),
      intervention: this.intervention.getAuditLog(),
    });
  }

  /**
   * Clear audit logs on all models that expose clearAuditLog().
   */
  public clearAllAuditLogs(): void {
    this.engagement.clearAuditLog();
    this.hater.clearAuditLog();
    this.helper.clearAuditLog();
    this.toxicity.clearAuditLog();
    this.churn.clearAuditLog();
    this.intervention.clearAuditLog();
  }

  // ── MARK: Prior state derivation ─────────────────────────────────────────

  /**
   * Derive the full prior state bundle from a completed score bundle.
   * Pass the result into the next evaluation cycle's context.priors to
   * activate ratchet logic, trend direction, and liveops amplification.
   */
  public priorsFromScores(scores: ChatMlScoreBundle): ChatMlPriorStateBundle {
    return Object.freeze({
      engagement:  this.engagement.toPriorState(scores.engagement),
      hater:       this.hater.toPriorState(scores.hater),
      helper:      this.helper.toPriorState(scores.helper),
      channel:     this.channel.toPriorState(scores.channel),
      toxicity:    derivePriorStateToxicity(scores.toxicity),
      churn:       this.churn.toPriorState(scores.churn),
      intervention: this.intervention.toPriorState(scores.intervention),
    });
  }
}

// ============================================================================
// MARK: Stack factory function
// ============================================================================

/**
 * Functional factory for ChatMlModelStack.
 * Equivalent to `new ChatMlModelStack(options)` but composable.
 */
export function createChatMlModelStack(
  options: ChatMlModelStackOptions = {},
): ChatMlModelStack {
  return new ChatMlModelStack(options);
}

// ============================================================================
// MARK: Standalone composition helpers
// ============================================================================

/**
 * Serialise a full ChatMlScoreBundle to a plain JSON-safe record.
 * Each sub-record is produced by the model's own serialisation helper.
 */
export function serializeScoreBundle(
  scores: ChatMlScoreBundle,
): Readonly<Record<string, Readonly<Record<string, JsonValue>>>> {
  return Object.freeze({
    engagement:  serializeEngagementScore(scores.engagement),
    hater:       serializeHaterTargetingScore(scores.hater),
    helper:      serializeHelperTimingScore(scores.helper),
    toxicity:    serializeToxicityRiskScore(scores.toxicity),
    churn:       serializeChurnRiskScore(scores.churn),
    intervention: serializeInterventionPolicyScore(scores.intervention),
  });
}

/**
 * Produce one human-readable summary line per model from a ChatMlScoreBundle.
 * Useful for structured logging, telemetry payloads, and debug snapshots.
 */
export function scoreBundleSummaryLines(
  scores: ChatMlScoreBundle,
): Readonly<Record<string, string>> {
  return Object.freeze({
    engagement:  engagementExplanationSummary(scores.engagement),
    hater:       haterTargetingExplanationSummary(scores.hater),
    helper:      helperTimingExplanationSummary(scores.helper),
    channel:     channelAffinitySummary(scores.channel),
    toxicity:    toxicityExplanationSummary(scores.toxicity),
    churn:       churnExplanationSummary(scores.churn),
    intervention: interventionExplanationSummary(scores.intervention),
  });
}

/**
 * Derive a ChatMlPriorStateBundle from a score bundle without a stack instance.
 * Stateless; suitable for use in serverless / edge contexts.
 */
export function createPriorsFromScoreBundle(
  scores: ChatMlScoreBundle,
): ChatMlPriorStateBundle {
  // Layer 1–4 priors use toPriorState() via ephemeral model instances
  const eng  = new EngagementModel();
  const hat  = new HaterTargetingModel();
  const hel  = new HelperTimingModel();
  const cha  = new ChannelAffinityModel();
  const chu  = new ChurnRiskModel();
  const pol  = new InterventionPolicyModel();

  return Object.freeze({
    engagement:  eng.toPriorState(scores.engagement),
    hater:       hat.toPriorState(scores.hater),
    helper:      hel.toPriorState(scores.helper),
    channel:     cha.toPriorState(scores.channel),
    toxicity:    derivePriorStateToxicity(scores.toxicity),
    churn:       chu.toPriorState(scores.churn),
    intervention: pol.toPriorState(scores.intervention),
  });
}

// ============================================================================
// MARK: NAMESPACE — full authoritative symbol graph
// ============================================================================

export const CHAT_BACKEND_ML_STACK_NAMESPACE = Object.freeze({

  // ── Stack identity ────────────────────────────────────────────────────────
  moduleName:    CHAT_BACKEND_ML_STACK_MODULE_NAME,
  moduleVersion: CHAT_BACKEND_ML_STACK_VERSION,

  // ── Stack class + factory ─────────────────────────────────────────────────
  ChatMlModelStack,
  createChatMlModelStack,

  // ── Stack-level composition helpers ──────────────────────────────────────
  serializeScoreBundle,
  scoreBundleSummaryLines,
  createPriorsFromScoreBundle,

  // ── Model classes ─────────────────────────────────────────────────────────
  ChatFeatureIngestor,
  OnlineFeatureStore,
  EngagementModel,
  HaterTargetingModel,
  HelperTimingModel,
  ChannelAffinityModel,
  ToxicityRiskModel,
  ChurnRiskModel,
  InterventionPolicyModel,

  // ── Per-model NAMESPACE objects (full helper graphs) ─────────────────────
  CHAT_FEATURE_INGESTOR_NAMESPACE,
  CHAT_ONLINE_FEATURE_STORE_NAMESPACE,
  CHAT_ENGAGEMENT_MODEL_NAMESPACE,
  CHAT_HATER_TARGETING_MODEL_NAMESPACE,
  CHAT_HELPER_TIMING_MODEL_NAMESPACE,
  CHAT_CHANNEL_AFFINITY_MODEL_NAMESPACE,
  CHAT_TOXICITY_RISK_MODEL_NAMESPACE,
  CHAT_CHURN_RISK_MODEL_NAMESPACE,
  CHAT_INTERVENTION_POLICY_MODEL_NAMESPACE,

  // ── Module meta-consts ────────────────────────────────────────────────────
  CHAT_FEATURE_INGESTOR_MODULE_NAME,
  CHAT_FEATURE_INGESTOR_VERSION,
  CHAT_FEATURE_INGESTOR_RUNTIME_LAWS,
  CHAT_FEATURE_INGESTOR_DEFAULTS,
  CHAT_MODEL_FAMILIES,

  CHAT_ONLINE_FEATURE_STORE_MODULE_NAME,
  CHAT_ONLINE_FEATURE_STORE_VERSION,
  CHAT_ONLINE_FEATURE_STORE_RUNTIME_LAWS,
  CHAT_ONLINE_FEATURE_STORE_DEFAULTS,

  CHAT_ENGAGEMENT_MODEL_MODULE_NAME,
  CHAT_ENGAGEMENT_MODEL_VERSION,
  CHAT_ENGAGEMENT_MODEL_RUNTIME_LAWS,
  CHAT_ENGAGEMENT_MODEL_DEFAULTS,

  CHAT_HATER_TARGETING_MODEL_MODULE_NAME,
  CHAT_HATER_TARGETING_MODEL_VERSION,
  CHAT_HATER_TARGETING_MODEL_RUNTIME_LAWS,
  CHAT_HATER_TARGETING_MODEL_DEFAULTS,

  CHAT_HELPER_TIMING_MODEL_MODULE_NAME,
  CHAT_HELPER_TIMING_MODEL_VERSION,
  CHAT_HELPER_TIMING_MODEL_RUNTIME_LAWS,
  CHAT_HELPER_TIMING_MODEL_DEFAULTS,

  CHAT_CHANNEL_AFFINITY_MODEL_MODULE_NAME,
  CHAT_CHANNEL_AFFINITY_MODEL_VERSION,
  CHAT_CHANNEL_AFFINITY_MODEL_RUNTIME_LAWS,
  CHAT_CHANNEL_AFFINITY_MODEL_DEFAULTS,
  CHANNEL_STAGE_PROFILES,

  CHAT_TOXICITY_RISK_MODEL_MODULE_NAME,
  CHAT_TOXICITY_RISK_MODEL_VERSION,
  CHAT_TOXICITY_RISK_MODEL_RUNTIME_LAWS,
  CHAT_TOXICITY_RISK_MODEL_DEFAULTS,

  CHAT_CHURN_RISK_MODEL_MODULE_NAME,
  CHAT_CHURN_RISK_MODEL_VERSION,
  CHAT_CHURN_RISK_MODEL_RUNTIME_LAWS,
  CHAT_CHURN_RISK_MODEL_DEFAULTS,

  CHAT_INTERVENTION_POLICY_MODEL_MODULE_NAME,
  CHAT_INTERVENTION_POLICY_MODEL_VERSION,
  CHAT_INTERVENTION_POLICY_MODEL_RUNTIME_LAWS,
  CHAT_INTERVENTION_POLICY_MODEL_DEFAULTS,

  // ── FeatureIngestor standalone helpers ────────────────────────────────────
  createChatFeatureIngestor,
  ingestChatFeatures,
  ingestChatFeaturesBatch,
  validateChatFeatureRow,
  buildChatFeatureQualityReport,
  chatFeatureRowDigest,
  deriveChatFeatureRowContext,
  chatFeatureModelFamilyPrefix,
  chatFeatureRowHasTag,
  chatFeatureRowsForFamily,
  chatFeatureRowsForEntity,
  chatFeatureRowAgeMs,
  chatFeatureScalarDensity01,
  chatFeatureRowSummaryLine,

  // ── OnlineFeatureStore standalone helpers ─────────────────────────────────
  createOnlineFeatureStore,
  hydrateOnlineFeatureStore,
  aggregateOnlineFeatureWindow,
  multiAggregateOnlineFeatureWindow,
  scalarFromAggregate,
  categoryFromAggregate,
  inferenceWindowFreshnessMs,
  inferenceWindowIsStale,
  aggregateSummaryLine,

  // ── EngagementModel standalone helpers ───────────────────────────────────
  createEngagementModel,
  scoreEngagementAggregate,
  scoreEngagementStore,
  scoreEngagementRows,
  scoreEngagementInferenceWindow,
  serializeEngagementScore,
  hydratePriorEngagementState,
  engagementIsElectric,
  engagementIsFrozen,
  engagementIsFragile,
  engagementIsDealRoomColdPlay,
  engagementShouldSilenceChannel,
  engagementBandLabel,
  engagementChannelPostureLabel,
  engagementTrendLabel,
  engagementExplanationSummary,
  engagementScoreCompare,
  engagementConfidence100,
  engagementScoreToTelemetry,
  deriveEngagementChannelPosture,
  sortEngagementScoresDescending,
  engagementScoresNeedingHelper,
  engagementScoresCritical,
  engagementIsStableActive,

  // ── HaterTargetingModel standalone helpers ───────────────────────────────
  createHaterTargetingModel,
  scoreHaterTargetingAggregate,
  scoreHaterTargetingStore,
  scoreHaterTargetingRows,
  scoreHaterTargetingInferenceWindow,
  serializeHaterTargetingScore,
  hydratePriorHaterTargetingState,
  haterTargetingIsActive,
  haterTargetingIsSuppressed,
  haterTargetingIsCeremonial,
  haterTargetingIsInvasionAmbush,
  haterEscalationBandLabel,
  haterTacticLabel,
  haterTargetingExplanationSummary,
  haterTargetingScoreCompare,
  haterTargetingToTelemetry,
  sortHaterTargetingScoresDescending,
  haterTargetingScoresNeedingAction,
  haterTargetingScoresCritical,
  haterTargetingPersonaSummary,

  // ── HelperTimingModel standalone helpers ──────────────────────────────────
  createHelperTimingModel,
  scoreHelperTimingAggregate,
  scoreHelperTimingStore,
  scoreHelperTimingRows,
  scoreHelperTimingInferenceWindow,
  serializeHelperTimingScore,
  hydratePriorHelperTimingState,
  helperTimingSummary,
  helperTimingShouldSpeak,
  helperTimingIsEmergency,
  helperTimingPrefersPrivate,
  helperTimingConfidence100,
  helperInterventionRecommendationLabel,
  helperInterventionStyleLabel,
  helperTimingExplanationSummary,
  helperTimingScoreCompare,
  helperTimingToTelemetry,
  sortHelperTimingScoresDescending,
  helperTimingScoresNeedingAction,
  helperTimingScoresEmergency,
  helperTimingPersonaSummary,

  // ── ChannelAffinityModel standalone helpers ───────────────────────────────
  createChannelAffinityModel,
  channelAffinitySummary,
  channelAffinityShouldMove,
  channelAffinityPrimaryScore,
  channelAffinityScoreDelta,
  channelAffinityIsStable,
  channelAffinityTopReasons,
  channelAffinityDiagnosticLines,

  // ── ToxicityRiskModel standalone helpers ──────────────────────────────────
  createToxicityRiskModel,
  scoreToxicityRiskAggregate,
  scoreToxicityRiskStore,
  scoreToxicityRiskRows,
  scoreToxicityRiskInferenceWindow,
  serializeToxicityRiskScore,
  hydratePriorToxicityRiskState,
  toxicityRiskSummary,
  toxicityRiskNeedsHardBlock,
  toxicityRiskNeedsReview,
  toxicityRiskNeedsShadowRoute,
  toxicityIsCritical,
  toxicityNeedsImmediate,
  toxicityIsInPublicCrowd,
  toxicityIsDealRoomCoercion,
  toxicityIsPileOnDriven,
  toxicityIsEscalating,
  toxicityIsCooling,
  toxicityIsLiveopsAmplified,
  toxicityBandLabel,
  toxicityRecommendationLabel,
  toxicityTrendLabel,
  toxicityExplanationSummary,
  toxicityPersonaSummary,
  toxicityScoreCompare,
  sortToxicityScoresDescending,
  toxicityScoresNeedingAction,
  toxicityScoresCritical,
  toxicityScoresNeedingHardBlock,
  toxicityConfidence100,
  toxicityScoreToTelemetry,
  derivePriorStateToxicity,
  scoreToxicityWindowBatch: scoreToxicityWindowBatchFn,

  // ── ChurnRiskModel standalone helpers ────────────────────────────────────
  createChurnRiskModel,
  scoreChurnRiskAggregate,
  scoreChurnRiskStore,
  scoreChurnRiskRows,
  scoreChurnRiskInferenceWindow,
  serializeChurnRiskScore,
  hydratePriorChurnRiskState,
  churnRiskSummary,
  churnRiskNeedsRescue,
  churnRiskNeedsPublicWitness,
  churnRiskShouldHold,
  churnIsCritical,
  churnIsEmergency,
  churnIsDealRoomSilent,
  churnIsRageDriven,
  churnIsQuietWithdrawal,
  churnIsLiveopsAmplified,
  churnIsWorsening,
  churnIsRecovering,
  churnIsBankruptcyRage,
  churnHasHighRecovery,
  churnBandLabel,
  churnRecommendationLabel,
  churnTrendLabel,
  churnExplanationSummary,
  churnScoreToTelemetry,
  churnScoreCompare,
  sortChurnScoresDescending,
  churnScoresNeedingAction,
  churnScoresCritical,
  churnScoresEmergency,
  churnConfidence100,
  derivePriorStateChurn,
  scoreChurnWindowBatch: scoreChurnWindowBatchFn,

  // ── InterventionPolicyModel standalone helpers ────────────────────────────
  createInterventionPolicyModel,
  scoreInterventionPolicyRows,
  scoreInterventionPolicyAggregate,
  scoreInterventionPolicyInferenceWindow,
  scoreInterventionPolicyStore,
  scoreInterventionPolicyIngestResult,
  serializeInterventionPolicyScore,
  hydratePriorInterventionPolicyState,
  interventionPolicySummary,
  interventionPolicyNeedsModeration,
  interventionPolicyNeedsRecovery,
  interventionPolicyNeedsRedirect,
  interventionPolicyAllowsHater,
  interventionIsHardBlock,
  interventionIsQuarantine,
  interventionHasSiblingConflict,
  interventionIsLiveopsAmplified,
  interventionIsEscalating,
  interventionIsDeescalating,
  interventionNeedsHelper,
  interventionNeedsPublicWitness,
  interventionIsHoldSilence,
  interventionIsTeaching,
  interventionIsNegotiation,
  interventionIsShadowHater,
  interventionRecommendationLabel,
  interventionUrgencyLabel,
  interventionTrendLabel,
  interventionExplanationSummary,
  interventionScoreToTelemetry,
  interventionScoreCompare,
  sortInterventionScoresDescending,
  interventionScoresNeedingAction,
  interventionScoresHardBlock,
  interventionScoresEscalating,
  interventionConfidence100,
});

export default CHAT_BACKEND_ML_STACK_NAMESPACE;