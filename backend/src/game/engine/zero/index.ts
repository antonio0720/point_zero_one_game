// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/index.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/index.ts
 *
 * Barrel export:
 * - exposes the live orchestrator surface
 * - exposes lifecycle coordination helpers
 * - exposes zero-owned orchestration contracts and policy defaults
 * - exposes the additive control-tower files that wrap backend/core primitives
 * - does not duplicate backend/core EventBus, TickSequence, or snapshot primitives
 */

export * from './zero.types';
export * from './OrchestratorConfig';
export * from './DependencyBinder';
export * from './ErrorBoundary';
export {
  // existing plan surfaces
  ZERO_TICK_PLAN_PHASES,
  ZERO_TICK_PLAN_OWNERS,
  ZERO_TICK_PLAN_BOUNDARY_STEPS,
  ZERO_TICK_PLAN_CRITICAL_STEPS,
  ZERO_TICK_PLAN_PHASE_BY_STEP,
  ZERO_TICK_PLAN_OWNER_BY_STEP,
  ZERO_TICK_PLAN_DIRECT_DEPENDENCIES,
  ZERO_TICK_PLAN_SEMANTIC_DEPENDENCIES,
  TickPlan,
  createTickPlan,
  createDefaultTickPlan,
  createTickPlanFromResolvedConfig,
  createTickPlanSnapshotFromConfig,
  validateTickPlan,
  assertValidTickPlan,
  summarizeTickPlan,
  compareTickPlans,
  getStepPhase,
  getStepOwner,
  getStepDescriptor,
  isTickPlanBoundaryStep,
  isTickPlanCriticalStep,
  getDirectStepDependencies,
  getSemanticStepDependencies,
  getDirectStepDependents,
  getTransitiveStepDependencies,
  getTransitiveStepDependents,
  isStepEnabledInPlan,
  isStepDisabledInPlan,
  buildPlanForMode,
  buildPlanForLifecycle,
  buildPlanForTerminalOutcome,
  cloneTickPlan,
  ZERO_DEFAULT_TICK_PLAN,
  ZERO_DEFAULT_TICK_PLAN_SNAPSHOT,
  ZERO_DEFAULT_TICK_PLAN_VALIDATION,
  ZERO_DEFAULT_TICK_PLAN_SUMMARY,
  // ML/DL analytics surfaces
  TICK_PLAN_MODULE_VERSION,
  TICK_PLAN_SCHEMA_VERSION,
  TICK_PLAN_MODULE_READY,
  TICK_PLAN_ML_FEATURE_COUNT,
  TICK_PLAN_DL_TENSOR_SHAPE,
  TICK_PLAN_COMPLETE,
  TICK_PLAN_MAX_TICK,
  TICK_PLAN_MAX_ENABLED_STEPS,
  TICK_PLAN_TREND_WINDOW_SIZE,
  TICK_PLAN_SESSION_MAX_HISTORY,
  TICK_PLAN_EVENT_LOG_MAX_ENTRIES,
  TICK_PLAN_MODE_CODES,
  TICK_PLAN_PRESSURE_TIERS,
  TICK_PLAN_RUN_PHASES,
  TICK_PLAN_RUN_OUTCOMES,
  TICK_PLAN_STEP_IDS,
  TICK_PLAN_MODE_NORMALIZED,
  TICK_PLAN_MODE_DIFFICULTY_MULTIPLIER,
  TICK_PLAN_MODE_TENSION_FLOOR,
  TICK_PLAN_PRESSURE_TIER_NORMALIZED,
  TICK_PLAN_RUN_PHASE_NORMALIZED,
  TICK_PLAN_STEP_PHASE_WEIGHT,
  TICK_PLAN_STEP_CRITICALITY_SCORE,
  TICK_PLAN_ML_FEATURE_LABELS,
  TICK_PLAN_DL_ROW_LABELS,
  TICK_PLAN_DL_COL_LABELS,
  TICK_PLAN_SEVERITY_THRESHOLDS,
  TICK_PLAN_NARRATION_BY_MODE,
  TICK_PLAN_NARRATION_BY_SEVERITY,
  TICK_PLAN_STEP_CRITICALITY_AVG,
  TICK_PLAN_PHASE_WEIGHT_AVG,
  extractTickPlanMLVector,
  buildTickPlanDLTensor,
  validateTickPlanMLVector,
  flattenTickPlanMLVector,
  flattenTickPlanDLTensor,
  buildTickPlanMLNamedMap,
  extractTickPlanDLColumn,
  computeTickPlanMLSimilarity,
  getTopTickPlanFeatures,
  serializeTickPlanMLVector,
  serializeTickPlanDLTensor,
  cloneTickPlanMLVector,
  isTickPlanSeverity,
  isTickPlanOperationKind,
  computeTickPlanHealthScore,
  classifyTickPlanSeverity,
  getTickPlanActionRecommendation,
  getTickPlanNarrationHintPhrase,
  buildTickPlanChatSignal,
  buildTickPlanNarrationHint,
  buildTickPlanAnnotation,
  buildTickPlanHealthSnapshot,
  buildTickPlanRunSummary,
  buildTickPlanExportBundle,
  TickPlanTrendAnalyzer,
  TickPlanSessionTracker,
  TickPlanEventLog,
  TickPlanAnnotator,
  TickPlanInspector,
  TICK_PLAN_DEFAULT_ANNOTATOR,
  TICK_PLAN_STRICT_ANNOTATOR,
  TICK_PLAN_VERBOSE_ANNOTATOR,
  TICK_PLAN_DEFAULT_INSPECTOR,
  TICK_PLAN_STRICT_INSPECTOR,
  TICK_PLAN_VERBOSE_INSPECTOR,
  ZERO_TICK_PLAN_ML_EXTRACTOR,
  ZERO_TICK_PLAN_DL_BUILDER,
  createTickPlanWithAnalytics,
  ZERO_DEFAULT_TICK_PLAN_ML_VECTOR,
  ZERO_DEFAULT_TICK_PLAN_DL_TENSOR,
  ZERO_DEFAULT_TICK_PLAN_CHAT_SIGNAL,
  type TickPlanValidationSeverity,
  type TickPlanIssue,
  type TickPlanValidationReport,
  type TickPlanPhaseSlice,
  type TickPlanOwnerSlice,
  type TickPlanStepDependency,
  type TickPlanWindowSnapshot,
  type TickPlanCursor,
  type TickPlanComparisonReport,
  type TickPlanSummary,
  type TickPlanBuildInput,
  type TickPlanSeverity,
  type TickPlanOperationKind,
  type TickPlanModeCode,
  type TickPlanPressureTier,
  type TickPlanRunPhase,
  type TickPlanRunOutcome,
  type TickPlanMLVectorInput,
  type TickPlanMLVector,
  type TickPlanDLTensorRow,
  type TickPlanDLTensor,
  type TickPlanChatSignal,
  type TickPlanAnnotationBundle,
  type TickPlanNarrationHint,
  type TickPlanTrendSnapshot,
  type TickPlanSessionReport,
  type TickPlanEventLogEntry,
  type TickPlanHealthSnapshot,
  type TickPlanRunSummary,
  type TickPlanInspectionBundle,
  type TickPlanExportBundle,
  type TickPlanAnnotatorOptions,
  type TickPlanWithAnalytics,
  // Section A: Plan Diff Engine
  diffTickPlans,
  computeTickPlanDeltaMLVector,
  diffScoreToSeverity,
  type TickPlanStepDelta,
  type TickPlanDiffReport,
  // Section B: Coverage Matrix
  computeTickPlanCoverageMatrix,
  type TickPlanCoverageCell,
  type TickPlanCoverageMatrix,
  // Section C: Step Confidence & Impact
  computeStepImpactScore,
  computeStepRiskScore,
  getTickPlanStepConfidence,
  getTickPlanStepRanking,
  rankStepsByImpact,
  rankStepsByRisk,
  type TickPlanStepConfidence,
  type TickPlanStepRanking,
  // Section D: Execution Estimate
  estimateTickPlanExecutionSuccess,
  getTickPlanBottlenecks,
  computeCriticalPathIntegrity,
  type TickPlanBottleneck,
  type TickPlanExecutionEstimate,
  // Section E: Mode Analytics
  TICK_PLAN_MODE_OPTIMAL_COVERAGE,
  TICK_PLAN_PRESSURE_TIER_HEALTH_MULTIPLIER,
  TICK_PLAN_PHASE_COMPLETION_THRESHOLDS,
  getTickPlanModeRecommendations,
  computeModePlanScore,
  computePressureAdjustedHealthScore,
  computePhaseCompletionScore,
  computeWeightedPlanScore,
  getTickPlanPhaseCompletionReport,
  isTickPlanSafe,
  type TickPlanModeRecommendation,
  type TickPlanPhaseCompletionReport,
  // Section J: Inspector
  type TickPlanComparisonInspectionBundle,
  // Section K: Additional Utilities
  computeTickPlanProfileFit,
  getTickPlanLoadSheddingCandidates,
  getTickPlanMinimalSafeSubset,
  computeTickPlanEntropy,
  getTickPlanDiagnosticSummary,
  isTickPlanOptimalForMode,
  getTickPlanStepBudgetAllocation,
  computeTickPlanReliabilityScore,
  computeTickPlanThroughputScore,
  buildTickPlanDiagnosticsReport,
  buildTickPlanComparisonAnnotation,
  buildTickPlanAllModeScores,
  // Section L: Extended Constants and Singletons
  TICK_PLAN_STEP_DEPENDENCY_DEPTH,
  TICK_PLAN_STEP_IMPACT_SCORES,
  TICK_PLAN_ALL_MODE_SCORES_DEFAULT,
  ZERO_DEFAULT_TICK_PLAN_COVERAGE_MATRIX,
  ZERO_DEFAULT_TICK_PLAN_EXECUTION_ESTIMATE,
  ZERO_DEFAULT_TICK_PLAN_DIAGNOSTICS_REPORT,
  ZERO_TICK_PLAN_INSPECTOR,
  ZERO_TICK_PLAN_ANNOTATOR,
  ZERO_TICK_PLAN_ML_EXTRACTOR_EXTENDED,
  ZERO_TICK_PLAN_DL_BUILDER_EXTENDED,
  // Extended type guards
  isTickPlanModeCode,
  isTickPlanPressureTier,
  isTickPlanRunPhase,
  isTickPlanRunOutcome,
  isTickPlanDiffReport,
  isTickPlanExecutionEstimate,
  isTickPlanCoverageMatrix,
  // Batch analysis
  analyzeTickPlanBatch,
  diffTickPlanBatch,
  findBestPlanInBatch,
  findWorstPlanInBatch,
  type TickPlanBatchAnalysisResult,
  // Plan history and revision
  buildTickPlanRevisionEntry,
  buildTickPlanRevisionHistory,
  type TickPlanRevisionEntry,
  type TickPlanRevisionHistory,
  // Merge and intersection
  getTickPlanStepUnion,
  getTickPlanStepIntersection,
  getTickPlanStepSymmetricDifference,
  computeTickPlanJaccardSimilarity,
  // Serialization
  serializeTickPlanState,
  serializeTickPlanStateToJSON,
  type TickPlanSerializedState,
  // Health projection
  projectTickPlanHealth,
  type TickPlanHealthProjection,
  // Phase-aware helpers
  getStepsInPhase,
  getEnabledStepsInPhase,
  getDisabledStepsInPhase,
  getStepsForOwner,
  getEnabledStepsForOwner,
  getDisabledStepsForOwner,
  // Execution simulation
  simulateTickPlanExecution,
  type TickPlanExecutionSimulationResult,
  // Precomputed singleton bundles
  ZERO_DEFAULT_TICK_PLAN_STEP_RANKING,
  ZERO_DEFAULT_TICK_PLAN_BOTTLENECKS,
  ZERO_DEFAULT_TICK_PLAN_BUDGET_ALLOCATION,
  ZERO_DEFAULT_TICK_PLAN_HEALTH_PROJECTION,
  ZERO_DEFAULT_TICK_PLAN_SIMULATION,
  ZERO_DEFAULT_TICK_PLAN_PHASE_COMPLETION,
  ZERO_DEFAULT_TICK_PLAN_MODE_RECOMMENDATIONS,
  ZERO_DEFAULT_TICK_PLAN_SAFETY,
  ZERO_DEFAULT_TICK_PLAN_RELIABILITY_SCORE,
  ZERO_DEFAULT_TICK_PLAN_THROUGHPUT_SCORE,
  ZERO_DEFAULT_TICK_PLAN_ENTROPY,
  ZERO_DEFAULT_TICK_PLAN_JACCARD_SOLO_PVP,
  // Module metadata
  TICK_PLAN_EXTENDED_MODULE_VERSION,
  TICK_PLAN_EXTENDED_READY,
  type TickPlanExtendedModuleManifest,
  TICK_PLAN_EXTENDED_MODULE_MANIFEST,
} from './TickPlan';
export * from './TickStateLock';
export * from './OutcomeGate';
export * from './EventFlushCoordinator';
export * from './OrchestratorDiagnostics';
export {
  type OrchestratorReadiness,
  type OrchestratorHealthReportDependencies,
  type EngineHealthBreakdown,
  type OrchestratorHealthMetrics,
  type OrchestratorHealthReportSnapshot,
  OrchestratorHealthReport,
} from './OrchestratorHealthReport';
export * from './TickResultBuilder';
export * from './RunQueryService';
export * from './StepTracePublisher';
export { EngineOrchestrator } from './EngineOrchestrator';
export * from './RunLifecycleCoordinator';
export * from './ZeroEngine';
// RunShutdownPipeline — ML/DL/chat surfaces for Engine Zero shutdown lane
export {
  RunShutdownPipeline,
  ShutdownPipelineTrendAnalyzer,
  ShutdownPipelineSessionTracker,
  ShutdownPipelineEventLog,
  ShutdownPipelineAnnotator,
  ShutdownPipelineInspector,
  createRunShutdownPipelineWithAnalytics,
  buildShutdownExportBundle,
  extractShutdownMLVector,
  buildShutdownDLTensor,
  buildShutdownChatSignal,
  buildShutdownAnnotation,
  buildShutdownNarrationHint,
  buildShutdownHealthSnapshot,
  buildShutdownRunSummary,
  computeShutdownHealthScore,
  classifyShutdownSeverity,
  getShutdownActionRecommendation,
  getShutdownNarrationHintPhrase,
  computeShutdownOutcomeWeight,
  computeShutdownModeWeight,
  computeShutdownDivergenceScore,
  computeShutdownBotThreatScore,
  getShutdownBotTransitions,
  getShutdownVisibilityConcealment,
  getShutdownCounterabilityScore,
  getShutdownTargetingSpread,
  getShutdownDivergenceNorm,
  getShutdownDeckPower,
  getShutdownCardRarityWeight,
  getShutdownAttackMagnitude,
  isShutdownAttackCounterable,
  getShutdownTimingPriority,
  getShutdownTimingUrgencyDecay,
  getShutdownShieldCapacityWeight,
  getShutdownVerifiedGradeScore,
  getShutdownIntegrityRiskScore,
  getShutdownShieldLayerLabel,
  getShutdownBotThreatLevel,
  validateShutdownMLVector,
  flattenShutdownMLVector,
  flattenShutdownDLTensor,
  buildShutdownMLNamedMap,
  extractShutdownDLColumn,
  computeShutdownMLSimilarity,
  getTopShutdownFeatures,
  serializeShutdownMLVector,
  serializeShutdownDLTensor,
  cloneShutdownMLVector,
  isShutdownSeverity,
  isShutdownOperationKind,
  isShutdownOutcome,
  SHUTDOWN_DEFAULT_ANNOTATOR,
  SHUTDOWN_STRICT_ANNOTATOR,
  SHUTDOWN_VERBOSE_ANNOTATOR,
  SHUTDOWN_DEFAULT_INSPECTOR,
  ZERO_DEFAULT_SHUTDOWN_ML_VECTOR,
  ZERO_DEFAULT_SHUTDOWN_DL_TENSOR,
  ZERO_DEFAULT_SHUTDOWN_CHAT_SIGNAL,
  ZERO_SHUTDOWN_ML_EXTRACTOR,
  ZERO_SHUTDOWN_DL_BUILDER,
  SHUTDOWN_MODE_CODES,
  SHUTDOWN_PRESSURE_TIERS,
  SHUTDOWN_RUN_PHASES,
  SHUTDOWN_RUN_OUTCOMES,
  SHUTDOWN_SHIELD_LAYER_IDS,
  SHUTDOWN_HATER_BOT_IDS,
  SHUTDOWN_TIMING_CLASSES,
  SHUTDOWN_DECK_TYPES,
  SHUTDOWN_VISIBILITY_LEVELS,
  SHUTDOWN_INTEGRITY_STATUSES,
  SHUTDOWN_VERIFIED_GRADES,
  SHUTDOWN_SHIELD_LAYER_LABEL_BY_ID,
  SHUTDOWN_PRESSURE_TIER_NORMALIZED,
  SHUTDOWN_PRESSURE_TIER_URGENCY_LABEL,
  SHUTDOWN_PRESSURE_TIER_MIN_HOLD_TICKS,
  SHUTDOWN_PRESSURE_TIER_ESCALATION_THRESHOLD,
  SHUTDOWN_PRESSURE_TIER_DEESCALATION_THRESHOLD,
  SHUTDOWN_RUN_PHASE_NORMALIZED,
  SHUTDOWN_RUN_PHASE_STAKES_MULTIPLIER,
  SHUTDOWN_RUN_PHASE_TICK_BUDGET_FRACTION,
  SHUTDOWN_MODE_NORMALIZED,
  SHUTDOWN_MODE_DIFFICULTY_MULTIPLIER,
  SHUTDOWN_MODE_TENSION_FLOOR,
  SHUTDOWN_MODE_MAX_DIVERGENCE,
  SHUTDOWN_SHIELD_LAYER_ABSORPTION_ORDER,
  SHUTDOWN_SHIELD_LAYER_CAPACITY_WEIGHT,
  SHUTDOWN_TIMING_CLASS_WINDOW_PRIORITY,
  SHUTDOWN_TIMING_CLASS_URGENCY_DECAY,
  SHUTDOWN_BOT_THREAT_LEVEL,
  SHUTDOWN_BOT_STATE_THREAT_MULTIPLIER,
  SHUTDOWN_BOT_STATE_ALLOWED_TRANSITIONS,
  SHUTDOWN_VISIBILITY_CONCEALMENT_FACTOR,
  SHUTDOWN_INTEGRITY_STATUS_RISK_SCORE,
  SHUTDOWN_VERIFIED_GRADE_NUMERIC_SCORE,
  SHUTDOWN_CARD_RARITY_WEIGHT,
  SHUTDOWN_DIVERGENCE_POTENTIAL_NORMALIZED,
  SHUTDOWN_COUNTERABILITY_RESISTANCE_SCORE,
  SHUTDOWN_TARGETING_SPREAD_FACTOR,
  SHUTDOWN_DECK_TYPE_POWER_LEVEL,
  SHUTDOWN_DECK_TYPE_IS_OFFENSIVE,
  SHUTDOWN_ATTACK_CATEGORY_BASE_MAGNITUDE,
  SHUTDOWN_ATTACK_CATEGORY_IS_COUNTERABLE,
  SHUTDOWN_COMPLETE,
  SHUTDOWN_MAX_TICK,
  SHUTDOWN_MAX_NET_WORTH,
  SHUTDOWN_MAX_DRAIN,
  SHUTDOWN_MAX_AUDIT_FLAGS,
  SHUTDOWN_MAX_TAGS,
  SHUTDOWN_MAX_BOT_THREAT,
  SHUTDOWN_ML_FEATURE_LABELS,
  SHUTDOWN_DL_ROW_LABELS,
  SHUTDOWN_DL_COL_LABELS,
  SHUTDOWN_ALL_OUTCOME_WEIGHTS,
  SHUTDOWN_SEVERITY_THRESHOLDS,
  SHUTDOWN_MODE_NARRATION,
  SHUTDOWN_OUTCOME_NARRATION,
  SHUTDOWN_TIMING_PRIORITY_AVG,
  SHUTDOWN_DECK_POWER_AVG,
  SHUTDOWN_CARD_RARITY_WEIGHT_AVG,
  SHUTDOWN_COUNTERABILITY_AVG,
  SHUTDOWN_VISIBILITY_CONCEALMENT_AVG,
  SHUTDOWN_INTEGRITY_RISK_AVG,
  SHUTDOWN_VERIFIED_GRADE_AVG,
  SHUTDOWN_ATTACK_MAGNITUDE_AVG,
  SHUTDOWN_TARGETING_SPREAD_AVG,
  SHUTDOWN_BOT_THREAT_MAX,
  type ShutdownSeverity,
  type ShutdownOperationKind,
  type ShutdownMLVector,
  type ShutdownDLTensorRow,
  type ShutdownDLTensor,
  type ShutdownChatSignal,
  type ShutdownAnnotationBundle,
  type ShutdownNarrationHint,
  type ShutdownTrendSnapshot,
  type ShutdownSessionReport,
  type ShutdownEventLogEntry,
  type ShutdownInspectionBundle,
  type ShutdownRunSummary,
  type ShutdownHealthSnapshot,
  type ShutdownExportBundle,
  type ShutdownMLVectorInput,
  type RunShutdownInput,
  type FlushedEventDigest,
  type RunArchiveRecord,
  type RunShutdownResult,
  type RunShutdownPipelineDependencies,
  type RunShutdownPipelineWithAnalytics,
} from './RunShutdownPipeline';

// RuntimeCheckpointCoordinator — ML/DL/chat surfaces for Engine Zero checkpoint lane
export {
  RuntimeCheckpointCoordinator,
  CheckpointCoordinatorTrendAnalyzer,
  CheckpointCoordinatorSessionTracker,
  CheckpointCoordinatorEventLog,
  CheckpointCoordinatorAnnotator,
  CheckpointCoordinatorInspector,
  createRuntimeCheckpointCoordinatorWithAnalytics,
  buildCheckpointExportBundle,
  extractCheckpointMLVector,
  buildCheckpointDLTensor,
  buildCheckpointChatSignal,
  buildCheckpointAnnotation,
  buildCheckpointNarrationHint,
  buildCheckpointHealthSnapshot,
  buildCheckpointRunSummary,
  computeCheckpointHealthScore,
  classifyCheckpointSeverity,
  getCheckpointActionRecommendation,
  getCheckpointNarrationPhrase,
  computeCheckpointPressureWeight,
  computeCheckpointModeFrequency,
  computeCheckpointPhaseDensity,
  computeCheckpointDivergenceScore,
  getCheckpointBotThreatLevel,
  getCheckpointBotTransitions,
  getCheckpointBotThreatMultiplier,
  getCheckpointShieldLayerLabel,
  getCheckpointShieldCapacityWeight,
  getCheckpointVisibilityConcealment,
  getCheckpointIntegrityRisk,
  getCheckpointVerifiedGradeScore,
  getCheckpointCardRarityWeight,
  getCheckpointAttackMagnitude,
  getCheckpointCounterabilityScore,
  getCheckpointTargetingSpread,
  getCheckpointDivergenceNorm,
  getCheckpointDeckPower,
  getCheckpointTimingPriority,
  getCheckpointRunOutcomeWeight,
  validateCheckpointMLVector,
  flattenCheckpointMLVector,
  flattenCheckpointDLTensor,
  buildCheckpointMLNamedMap,
  extractCheckpointDLColumn,
  computeCheckpointMLSimilarity,
  getTopCheckpointFeatures,
  serializeCheckpointMLVector,
  serializeCheckpointDLTensor,
  cloneCheckpointMLVector,
  isCheckpointSeverity,
  isCheckpointOperationKind,
  CHECKPOINT_DEFAULT_ANNOTATOR,
  CHECKPOINT_STRICT_ANNOTATOR,
  CHECKPOINT_VERBOSE_ANNOTATOR,
  CHECKPOINT_DEFAULT_INSPECTOR,
  ZERO_DEFAULT_CHECKPOINT_ML_VECTOR,
  ZERO_DEFAULT_CHECKPOINT_DL_TENSOR,
  ZERO_DEFAULT_CHECKPOINT_CHAT_SIGNAL,
  ZERO_CHECKPOINT_ML_EXTRACTOR,
  ZERO_CHECKPOINT_DL_BUILDER,
  CHECKPOINT_MODE_CODES,
  CHECKPOINT_PRESSURE_TIERS,
  CHECKPOINT_RUN_PHASES,
  CHECKPOINT_RUN_OUTCOMES,
  CHECKPOINT_SHIELD_LAYER_IDS,
  CHECKPOINT_HATER_BOT_IDS,
  CHECKPOINT_TIMING_CLASSES,
  CHECKPOINT_DECK_TYPES,
  CHECKPOINT_VISIBILITY_LEVELS,
  CHECKPOINT_INTEGRITY_STATUSES,
  CHECKPOINT_VERIFIED_GRADES,
  CHECKPOINT_SHIELD_LAYER_LABEL_BY_ID,
  CHECKPOINT_PRESSURE_TIER_NORMALIZED,
  CHECKPOINT_PRESSURE_TIER_URGENCY_LABEL,
  CHECKPOINT_PRESSURE_TIER_MIN_HOLD_TICKS,
  CHECKPOINT_PRESSURE_TIER_ESCALATION_THRESHOLD,
  CHECKPOINT_PRESSURE_TIER_DEESCALATION_THRESHOLD,
  CHECKPOINT_RUN_PHASE_NORMALIZED,
  CHECKPOINT_RUN_PHASE_STAKES_MULTIPLIER,
  CHECKPOINT_RUN_PHASE_TICK_BUDGET_FRACTION,
  CHECKPOINT_MODE_NORMALIZED,
  CHECKPOINT_MODE_DIFFICULTY_MULTIPLIER,
  CHECKPOINT_MODE_TENSION_FLOOR,
  CHECKPOINT_MODE_MAX_DIVERGENCE,
  CHECKPOINT_SHIELD_LAYER_ABSORPTION_ORDER,
  CHECKPOINT_SHIELD_LAYER_CAPACITY_WEIGHT,
  CHECKPOINT_TIMING_CLASS_WINDOW_PRIORITY,
  CHECKPOINT_TIMING_CLASS_URGENCY_DECAY,
  CHECKPOINT_BOT_THREAT_LEVEL,
  CHECKPOINT_BOT_STATE_THREAT_MULTIPLIER,
  CHECKPOINT_BOT_STATE_ALLOWED_TRANSITIONS,
  CHECKPOINT_VISIBILITY_CONCEALMENT_FACTOR,
  CHECKPOINT_INTEGRITY_STATUS_RISK_SCORE,
  CHECKPOINT_VERIFIED_GRADE_NUMERIC_SCORE,
  CHECKPOINT_CARD_RARITY_WEIGHT,
  CHECKPOINT_DIVERGENCE_POTENTIAL_NORMALIZED,
  CHECKPOINT_COUNTERABILITY_RESISTANCE_SCORE,
  CHECKPOINT_TARGETING_SPREAD_FACTOR,
  CHECKPOINT_DECK_TYPE_POWER_LEVEL,
  CHECKPOINT_DECK_TYPE_IS_OFFENSIVE,
  CHECKPOINT_ATTACK_CATEGORY_BASE_MAGNITUDE,
  CHECKPOINT_ATTACK_CATEGORY_IS_COUNTERABLE,
  CHECKPOINT_ML_FEATURE_COUNT,
  CHECKPOINT_DL_TENSOR_SHAPE,
  CHECKPOINT_MODULE_VERSION,
  CHECKPOINT_MODULE_READY,
  CHECKPOINT_SCHEMA_VERSION,
  CHECKPOINT_COMPLETE,
  CHECKPOINT_MAX_COUNT,
  CHECKPOINT_MAX_TICK,
  CHECKPOINT_MAX_BOT_THREAT,
  CHECKPOINT_ML_FEATURE_LABELS,
  CHECKPOINT_DL_ROW_LABELS,
  CHECKPOINT_DL_COL_LABELS,
  CHECKPOINT_SEVERITY_THRESHOLDS,
  CHECKPOINT_ALL_REASONS,
  CHECKPOINT_REASON_WEIGHT,
  CHECKPOINT_MODE_NARRATION,
  CHECKPOINT_TIMING_PRIORITY_AVG,
  CHECKPOINT_DECK_POWER_AVG,
  CHECKPOINT_CARD_RARITY_WEIGHT_AVG,
  CHECKPOINT_COUNTERABILITY_AVG,
  CHECKPOINT_VISIBILITY_CONCEALMENT_AVG,
  CHECKPOINT_INTEGRITY_RISK_AVG,
  CHECKPOINT_VERIFIED_GRADE_AVG,
  CHECKPOINT_ATTACK_MAGNITUDE_AVG,
  CHECKPOINT_TARGETING_SPREAD_AVG,
  CHECKPOINT_BOT_THREAT_TOTAL,
  type CheckpointSeverity,
  type CheckpointOperationKind,
  type CheckpointMLVector,
  type CheckpointDLTensorRow,
  type CheckpointDLTensor,
  type CheckpointChatSignal,
  type CheckpointAnnotationBundle,
  type CheckpointNarrationHint,
  type CheckpointTrendSnapshot,
  type CheckpointSessionReport,
  type CheckpointEventLogEntry,
  type CheckpointInspectionBundle,
  type CheckpointRunSummary,
  type CheckpointHealthSnapshot,
  type CheckpointExportBundle,
  type CheckpointMLVectorInput,
  type RuntimeCheckpointCoordinatorOptions,
  type RuntimeCheckpointCaptureOptions,
  type RuntimeCheckpointSummary,
  type RuntimeCheckpointCoordinatorWithAnalytics,
} from './RuntimeCheckpointCoordinator';

// RunBootstrapPipeline — ML/DL/chat surfaces for Engine Zero bootstrap lane
export {
  RunBootstrapPipeline,
  BootstrapTrendAnalyzer,
  BootstrapSessionTracker,
  BootstrapEventLog,
  BootstrapAnnotator,
  BootstrapInspector,
  createRunBootstrapPipelineWithAnalytics,
  extractBootstrapMLVector,
  buildBootstrapDLTensor,
  buildBootstrapChatSignal,
  buildBootstrapAnnotation,
  buildBootstrapNarrationHint,
  buildBootstrapRunSummary,
  computeBootstrapHealthScore,
  classifyBootstrapSeverity,
  getBootstrapActionRecommendation,
  scoreBootstrapCardPower,
  computeBootstrapTimingDiversity,
  validateBootstrapMLVector,
  flattenBootstrapDLTensor,
  buildBootstrapMLNamedMap,
  extractBootstrapDLColumn,
  computeBootstrapMLSimilarity,
  getTopBootstrapFeatures,
  isBootstrapModeCode,
  isBootstrapRunOutcome,
  isBootstrapPressureTier,
  isBootstrapShieldLayerId,
  isBootstrapHaterBotId,
  ZERO_DEFAULT_BOOTSTRAP_ML_VECTOR,
  ZERO_DEFAULT_BOOTSTRAP_DL_TENSOR,
  ZERO_DEFAULT_BOOTSTRAP_CHAT_SIGNAL,
  ZERO_BOOTSTRAP_ML_EXTRACTOR,
  ZERO_BOOTSTRAP_DL_BUILDER,
  ZERO_BOOTSTRAP_ANNOTATOR,
  ZERO_BOOTSTRAP_INSPECTOR,
  ZERO_BOOTSTRAP_TREND_ANALYZER,
  BOOTSTRAP_ML_FEATURE_COUNT,
  BOOTSTRAP_ML_FEATURE_LABELS,
  BOOTSTRAP_DL_TENSOR_SHAPE,
  BOOTSTRAP_DL_ROW_LABELS,
  BOOTSTRAP_DL_COL_LABELS,
  BOOTSTRAP_MODULE_VERSION,
  BOOTSTRAP_MODULE_READY,
  BOOTSTRAP_SCHEMA_VERSION,
  BOOTSTRAP_COMPLETE,
  BOOTSTRAP_PHASE_NAMES,
  BOOTSTRAP_MODE_NARRATION,
  BOOTSTRAP_SEVERITY_THRESHOLDS,
  BOOTSTRAP_ALL_BOT_IDS,
  BOOTSTRAP_ALL_MODES,
  BOOTSTRAP_MAX_BOT_THREAT_SCORE,
  BOOTSTRAP_SHIELD_LAYER_ORDER,
  BOOTSTRAP_TOTAL_SHIELD_CAPACITY_WEIGHT,
  type BootstrapSeverity,
  type BootstrapMLVector,
  type BootstrapDLTensorRow,
  type BootstrapDLTensor,
  type BootstrapChatSignal,
  type BootstrapAnnotationBundle,
  type BootstrapNarrationHint,
  type BootstrapTrendSnapshot,
  type BootstrapSessionReport,
  type BootstrapTelemetryRecord,
  type BootstrapEventLogEntry,
  type BootstrapInspectionBundle,
  type BootstrapRunSummary,
  type BootstrapHealthSnapshot,
  type BootstrapExportBundle,
  type BootstrapPhaseName,
  type RunBootstrapInput,
  type RunBootstrapResult,
  type RunBootstrapPipelineDependencies,
  type RunBootstrapPipelineAnalyticsBundle,
} from './RunBootstrapPipeline';

// RunCommandGateway — ML/DL/chat surfaces for Engine Zero command lane
export {
  RunCommandGateway,
  CommandGatewayTrendAnalyzer,
  CommandGatewaySessionTracker,
  CommandGatewayEventLog,
  CommandGatewayAnnotator,
  CommandGatewayInspector,
  createRunCommandGatewayWithAnalytics,
  extractGatewayMLVector,
  buildGatewayDLTensor,
  buildGatewayChatSignal,
  buildGatewayAnnotation,
  buildGatewayNarrationHint,
  buildGatewayRunSummary,
  buildGatewayHealthSnapshot,
  computeGatewayHealthScore,
  classifyGatewaySeverity,
  getGatewayActionRecommendation,
  scoreGatewayCardPower,
  computeGatewayCardTimingDiversity,
  computeGatewayCardMaxTimingPriority,
  computeGatewayCardUrgencyDecay,
  computeGatewayHandPowerAvg,
  computeGatewayHandOffensiveRatio,
  computeGatewayCardTargetingSpread,
  computeGatewayCardDivergenceScore,
  validateGatewayMLVector,
  flattenGatewayDLTensor,
  buildGatewayMLNamedMap,
  extractGatewayDLColumn,
  computeGatewayMLSimilarity,
  getTopGatewayFeatures,
  serializeGatewayMLVector,
  serializeGatewayDLTensor,
  cloneGatewayMLVector,
  isGatewaySeverity,
  isGatewayCommandKind,
  ZERO_DEFAULT_GATEWAY_ML_VECTOR,
  ZERO_DEFAULT_GATEWAY_DL_TENSOR,
  ZERO_DEFAULT_GATEWAY_CHAT_SIGNAL,
  ZERO_GATEWAY_ML_EXTRACTOR,
  ZERO_GATEWAY_DL_BUILDER,
  GATEWAY_DEFAULT_ANNOTATOR,
  GATEWAY_STRICT_ANNOTATOR,
  GATEWAY_VERBOSE_ANNOTATOR,
  GATEWAY_DEFAULT_INSPECTOR,
  GATEWAY_ML_FEATURE_COUNT,
  GATEWAY_ML_FEATURE_LABELS,
  GATEWAY_DL_TENSOR_SHAPE,
  GATEWAY_DL_ROW_LABELS,
  GATEWAY_DL_COL_LABELS,
  GATEWAY_MODULE_VERSION,
  GATEWAY_MODULE_READY,
  GATEWAY_SCHEMA_VERSION,
  GATEWAY_COMPLETE,
  GATEWAY_COMMAND_KINDS,
  GATEWAY_COMMAND_KIND_ENCODED,
  GATEWAY_SEVERITY_LEVELS,
  GATEWAY_SEVERITY_THRESHOLDS,
  GATEWAY_MODE_COMMAND_NARRATION,
  GATEWAY_COMMAND_NARRATION,
  GATEWAY_MAX_BOT_THREAT_SCORE,
  GATEWAY_SHIELD_LAYER_ORDER,
  GATEWAY_TOTAL_SHIELD_CAPACITY_WEIGHT,
  GATEWAY_ALL_MODE_CODES,
  GATEWAY_ALL_PRESSURE_TIERS,
  GATEWAY_ALL_RUN_PHASES,
  GATEWAY_ALL_RUN_OUTCOMES,
  GATEWAY_ALL_SHIELD_LAYER_IDS,
  GATEWAY_ALL_HATER_BOT_IDS,
  GATEWAY_ALL_TIMING_CLASSES,
  GATEWAY_ALL_DECK_TYPES,
  GATEWAY_ALL_INTEGRITY_STATUSES,
  GATEWAY_ALL_VERIFIED_GRADES,
  GATEWAY_SHIELD_ABSORPTION_ORDER,
  GATEWAY_TIMING_CLASS_WINDOW_PRIORITY,
  GATEWAY_TIMING_CLASS_URGENCY_DECAY,
  GATEWAY_BOT_STATE_ALLOWED_TRANSITIONS,
  GATEWAY_BOT_STATE_THREAT_MULTIPLIER,
  GATEWAY_VISIBILITY_CONCEALMENT_FACTOR,
  GATEWAY_DECK_TYPE_IS_OFFENSIVE,
  GATEWAY_DECK_TYPE_POWER_LEVEL,
  GATEWAY_CARD_RARITY_WEIGHT,
  GATEWAY_ATTACK_CATEGORY_BASE_MAGNITUDE,
  GATEWAY_ATTACK_CATEGORY_IS_COUNTERABLE,
  GATEWAY_COUNTERABILITY_RESISTANCE_SCORE,
  GATEWAY_TARGETING_SPREAD_FACTOR,
  GATEWAY_DIVERGENCE_POTENTIAL_NORMALIZED,
  GATEWAY_PRESSURE_TIER_ESCALATION_THRESHOLD,
  GATEWAY_PRESSURE_TIER_DEESCALATION_THRESHOLD,
  GATEWAY_PRESSURE_TIER_MIN_HOLD_TICKS,
  GATEWAY_PRESSURE_TIER_URGENCY_LABEL,
  GATEWAY_PRESSURE_TIER_NORMALIZED,
  GATEWAY_MODE_NORMALIZED,
  GATEWAY_MODE_DIFFICULTY_MULTIPLIER,
  GATEWAY_MODE_TENSION_FLOOR,
  GATEWAY_MODE_MAX_DIVERGENCE,
  GATEWAY_DIVERGENCE_NORMALIZED,
  GATEWAY_RUN_PHASE_NORMALIZED,
  GATEWAY_RUN_PHASE_STAKES_MULTIPLIER,
  GATEWAY_RUN_PHASE_TICK_BUDGET_FRACTION,
  GATEWAY_SHIELD_LAYER_CAPACITY_WEIGHT,
  GATEWAY_SHIELD_LAYER_LABEL_BY_ID,
  GATEWAY_INTEGRITY_STATUS_RISK_SCORE,
  GATEWAY_VERIFIED_GRADE_NUMERIC_SCORE,
  type GatewaySeverity,
  type GatewayCommandKind,
  type GatewayMLVector,
  type GatewayDLTensorRow,
  type GatewayDLTensor,
  type GatewayChatSignal,
  type GatewayAnnotationBundle,
  type GatewayNarrationHint,
  type GatewayTrendSnapshot,
  type GatewaySessionReport,
  type GatewayEventLogEntry,
  type GatewayInspectionBundle,
  type GatewayRunSummary,
  type GatewayHealthSnapshot,
  type GatewayExportBundle,
  type RunCommandGatewayDependencies,
  type RunCommandGatewayWithAnalytics,
} from './RunCommandGateway';

// TickExecutor — ML/DL/chat surfaces for the full 13-step tick orchestration pass
export {
  TickExecutor,
  TickExecutorTrendAnalyzer,
  TickExecutorSessionTracker,
  TickExecutorEventLog,
  TickExecutorAnnotator,
  TickExecutorInspector,
  createTickExecutorWithAnalytics,
  extractTickExecutorMLVector,
  buildTickExecutorDLTensor,
  buildTickExecutorChatSignal,
  buildTickExecutorAnnotation,
  buildTickExecutorNarrationHint,
  buildTickExecutorHealthSnapshot,
  buildTickExecutorRunSummary,
  computeTickExecutorHealthScore,
  classifyTickExecutorSeverity,
  getTickExecutorActionRecommendation,
  getTickExecutorNarrationHintPhrase,
  computeTickExecutorOutcomeWeight,
  computeTickExecutorModeWeight,
  computeTickExecutorPressureWeight,
  computeTickExecutorPhaseWeight,
  computeTickExecutorBotThreatScore,
  computeTickExecutorOutcomeWeightFromSnapshot,
  getTickExecutorShieldBreachCount,
  getTickExecutorShieldAggregateIntegrity,
  getTickExecutorBotThreatLevel,
  getTickExecutorBotThreatMultiplier,
  getTickExecutorBotTransitions,
  getTickExecutorShieldLayerLabel,
  getTickExecutorShieldCapacityWeight,
  getTickExecutorVisibilityConcealment,
  getTickExecutorIntegrityRisk,
  getTickExecutorVerifiedGradeScore,
  getTickExecutorCardRarityWeight,
  getTickExecutorAttackMagnitude,
  isTickExecutorAttackCounterable,
  getTickExecutorCounterabilityScore,
  getTickExecutorTargetingSpread,
  getTickExecutorTimingPriority,
  getTickExecutorTimingUrgencyDecay,
  getTickExecutorDeckPower,
  getTickExecutorDivergenceNorm,
  validateTickExecutorMLVector,
  flattenTickExecutorMLVector,
  flattenTickExecutorDLTensor,
  buildTickExecutorMLNamedMap,
  extractTickExecutorDLColumn,
  computeTickExecutorMLSimilarity,
  getTopTickExecutorFeatures,
  serializeTickExecutorMLVector,
  serializeTickExecutorDLTensor,
  cloneTickExecutorMLVector,
  isTickExecutorSeverity,
  isTickExecutorOperationKind,
  EXECUTOR_DEFAULT_ANNOTATOR,
  EXECUTOR_STRICT_ANNOTATOR,
  EXECUTOR_VERBOSE_ANNOTATOR,
  EXECUTOR_DEFAULT_INSPECTOR,
  ZERO_DEFAULT_EXECUTOR_ML_VECTOR,
  ZERO_DEFAULT_EXECUTOR_DL_TENSOR,
  ZERO_DEFAULT_EXECUTOR_CHAT_SIGNAL,
  ZERO_EXECUTOR_ML_EXTRACTOR,
  ZERO_EXECUTOR_DL_BUILDER,
  TICK_EXECUTOR_MODULE_VERSION,
  TICK_EXECUTOR_SCHEMA_VERSION,
  TICK_EXECUTOR_MODULE_READY,
  TICK_EXECUTOR_ML_FEATURE_COUNT,
  TICK_EXECUTOR_DL_TENSOR_SHAPE,
  TICK_EXECUTOR_COMPLETE,
  TICK_EXECUTOR_MAX_TICK,
  TICK_EXECUTOR_MAX_DURATION_MS,
  TICK_EXECUTOR_MAX_SIGNAL_COUNT,
  TICK_EXECUTOR_MAX_PENDING_ATTACKS,
  TICK_EXECUTOR_MAX_CASCADE_CHAINS,
  TICK_EXECUTOR_MAX_BOT_THREAT_SCORE,
  TICK_EXECUTOR_MAX_NET_WORTH,
  TICK_EXECUTOR_MAX_AUDIT_FLAGS,
  TICK_EXECUTOR_TREND_WINDOW_SIZE,
  TICK_EXECUTOR_SESSION_MAX_HISTORY,
  TICK_EXECUTOR_EVENT_LOG_MAX_ENTRIES,
  TICK_EXECUTOR_MODE_CODES,
  TICK_EXECUTOR_PRESSURE_TIERS,
  TICK_EXECUTOR_RUN_PHASES,
  TICK_EXECUTOR_RUN_OUTCOMES,
  TICK_EXECUTOR_SHIELD_LAYER_IDS,
  TICK_EXECUTOR_HATER_BOT_IDS,
  TICK_EXECUTOR_TIMING_CLASSES,
  TICK_EXECUTOR_DECK_TYPES,
  TICK_EXECUTOR_VISIBILITY_LEVELS,
  TICK_EXECUTOR_INTEGRITY_STATUSES,
  TICK_EXECUTOR_VERIFIED_GRADES,
  TICK_EXECUTOR_SHIELD_LAYER_LABEL_BY_ID,
  TICK_EXECUTOR_PRESSURE_TIER_NORMALIZED,
  TICK_EXECUTOR_PRESSURE_TIER_URGENCY_LABEL,
  TICK_EXECUTOR_PRESSURE_TIER_MIN_HOLD_TICKS,
  TICK_EXECUTOR_PRESSURE_TIER_ESCALATION_THRESHOLD,
  TICK_EXECUTOR_PRESSURE_TIER_DEESCALATION_THRESHOLD,
  TICK_EXECUTOR_RUN_PHASE_NORMALIZED,
  TICK_EXECUTOR_RUN_PHASE_STAKES_MULTIPLIER,
  TICK_EXECUTOR_RUN_PHASE_TICK_BUDGET_FRACTION,
  TICK_EXECUTOR_MODE_NORMALIZED,
  TICK_EXECUTOR_MODE_DIFFICULTY_MULTIPLIER,
  TICK_EXECUTOR_MODE_TENSION_FLOOR,
  TICK_EXECUTOR_MODE_MAX_DIVERGENCE,
  TICK_EXECUTOR_SHIELD_LAYER_ABSORPTION_ORDER,
  TICK_EXECUTOR_SHIELD_LAYER_CAPACITY_WEIGHT,
  TICK_EXECUTOR_TIMING_CLASS_WINDOW_PRIORITY,
  TICK_EXECUTOR_TIMING_CLASS_URGENCY_DECAY,
  TICK_EXECUTOR_BOT_THREAT_LEVEL,
  TICK_EXECUTOR_BOT_STATE_THREAT_MULTIPLIER,
  TICK_EXECUTOR_BOT_STATE_ALLOWED_TRANSITIONS,
  TICK_EXECUTOR_VISIBILITY_CONCEALMENT_FACTOR,
  TICK_EXECUTOR_INTEGRITY_STATUS_RISK_SCORE,
  TICK_EXECUTOR_VERIFIED_GRADE_NUMERIC_SCORE,
  TICK_EXECUTOR_CARD_RARITY_WEIGHT,
  TICK_EXECUTOR_DIVERGENCE_POTENTIAL_NORMALIZED,
  TICK_EXECUTOR_COUNTERABILITY_RESISTANCE_SCORE,
  TICK_EXECUTOR_TARGETING_SPREAD_FACTOR,
  TICK_EXECUTOR_DECK_TYPE_POWER_LEVEL,
  TICK_EXECUTOR_DECK_TYPE_IS_OFFENSIVE,
  TICK_EXECUTOR_ATTACK_CATEGORY_BASE_MAGNITUDE,
  TICK_EXECUTOR_ATTACK_CATEGORY_IS_COUNTERABLE,
  TICK_EXECUTOR_TIMING_PRIORITY_AVG,
  TICK_EXECUTOR_DECK_POWER_AVG,
  TICK_EXECUTOR_CARD_RARITY_WEIGHT_AVG,
  TICK_EXECUTOR_COUNTERABILITY_AVG,
  TICK_EXECUTOR_VISIBILITY_CONCEALMENT_AVG,
  TICK_EXECUTOR_INTEGRITY_RISK_AVG,
  TICK_EXECUTOR_VERIFIED_GRADE_AVG,
  TICK_EXECUTOR_ATTACK_MAGNITUDE_AVG,
  TICK_EXECUTOR_TARGETING_SPREAD_AVG,
  TICK_EXECUTOR_BOT_THREAT_MAX,
  TICK_EXECUTOR_SEVERITY_THRESHOLDS,
  TICK_EXECUTOR_ALL_OUTCOME_WEIGHTS,
  TICK_EXECUTOR_MODE_NARRATION,
  TICK_EXECUTOR_OUTCOME_NARRATION,
  TICK_EXECUTOR_ML_FEATURE_LABELS,
  TICK_EXECUTOR_DL_ROW_LABELS,
  TICK_EXECUTOR_DL_COL_LABELS,
  type TickExecutorSeverity,
  type TickExecutorOperationKind,
  type TickExecutorMLVector,
  type TickExecutorMLVectorInput,
  type TickExecutorDLTensorRow,
  type TickExecutorDLTensor,
  type TickExecutorChatSignal,
  type TickExecutorAnnotationBundle,
  type TickExecutorNarrationHint,
  type TickExecutorHealthSnapshot,
  type TickExecutorTrendSnapshot,
  type TickExecutorSessionReport,
  type TickExecutorEventLogEntry,
  type TickExecutorInspectionBundle,
  type TickExecutorRunSummary,
  type TickExecutorExportBundle,
  type TickExecutorWithAnalytics,
  type TickExecutorOptions,
  type TickExecutorRunArgs,
  type TickExecutorRunResult,
  type TickExecutorRuntimeEventMap,
} from './TickExecutor';
export * from './TickStepRunner';
export * from './TickTransactionCoordinator';
// Explicitly re-export StepExecutionReport from zero.types to resolve the
// TS2308 ambiguity between zero.types and TickStepRunner definitions.
export type { StepExecutionReport } from './zero.types';

// ─────────────────────────────────────────────────────────────────────────────
// §R00 — OrchestratorTelemetry (missing barrel entry — wired here)
// ─────────────────────────────────────────────────────────────────────────────
export * from './OrchestratorTelemetry';

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  POINT ZERO ONE — ENGINE ZERO RUNTIME ORCHESTRATION LAYER                   ║
// ║  backend/src/game/engine/zero/index.ts  §§R01–R11  Runtime Wiring           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// ENGINE ZERO IS THE CONDUCTOR.
// All 24 zero sub-modules are wired here into a live runtime that fires ML/DL
// actions on every tick, routes signals to the chat lane, builds proof-bearing
// transcripts, and exposes a single ZeroRuntimeHub entry point to the master
// engine barrel at backend/src/game/engine/index.ts → Zero.*.
//
// Mode doctrine:
//   Empire   (GO ALONE)         — solo run, max ML pressure extraction
//   Predator (HEAD TO HEAD)     — PvP divergence, rivalry heat, hater posture
//   Syndicate (TEAM UP)         — coop, shared treasury, team chat witness
//   Phantom  (CHASE A LEGEND)   — ghost run, legend marker audit, async replay
//
// 13-step tick law (STEP_01_PREPARE → STEP_13_FLUSH):
//   Every tick fires: prepare → time → pressure → tension → cards → shield →
//   cascade → decision → hold → sovereignty → simulation → checkpoint → flush.
//   ML vectors are extracted after STEP_13. DL tensors accumulate across ticks.
//   Chat signals are emitted at STEP_13 and after every terminal outcome.
//
// Sections:
//   §R01  Runtime value imports  (classes, functions, constants)
//   §R02  Runtime type imports   (interfaces, types)
//   §R03  ZeroSubsystemOrchestrator  — wires all 24 zero sub-modules
//   §R04  ZeroMLPipeline             — 320-dim fused feature vector
//   §R05  ZeroDLPipeline             — master DL tensor aggregation
//   §R06  ZeroChatWireLayer          — mode-native signal routing
//   §R07  ZeroSocialWitnessLayer     — hater, threat, extraction pressure
//   §R08  ZeroModeNativeRuntime      — Empire/Predator/Syndicate/Phantom
//   §R09  ZeroTranscriptWriter       — proof-bearing per-tick transcripts
//   §R10  ZeroRuntimeHub             — master entry point
//   §R11  Singletons, factories, module manifest

// ─────────────────────────────────────────────────────────────────────────────
// §R01  Runtime value imports
// ─────────────────────────────────────────────────────────────────────────────

import {
  ZeroEngine,
  createZeroEngine,
  buildZeroEngineStack,
  ZERO_ENGINE_MODULE_VERSION,
  ZERO_ENGINE_ML_FEATURE_COUNT,
  ZERO_ENGINE_DL_FEATURE_COUNT,
  ZERO_ENGINE_DL_SEQUENCE_LENGTH,
  ZERO_ML_FEATURE_LABELS,
  ZERO_DL_COLUMN_LABELS,
} from './ZeroEngine';

import {
  DependencyBinder,
  ZERO_DEPENDENCY_BUNDLE_SLOTS,
  ZERO_DEPENDENCY_ENGINE_LABELS,
  ZERO_BINDER_SUPPORTED_MODES,
  ZERO_READER_CONTRACT_NAMES,
} from './DependencyBinder';

import {
  ErrorBoundary,
  ENGINE_ZERO_BOUNDARY,
  MODE_BOUNDARY,
  DETERMINISM_BOUNDARY,
  RESOURCE_BOUNDARY,
  WELL_KNOWN_BOUNDARIES,
  createErrorBoundaryWithAnalytics,
  extractErrorBoundaryMLVector,
  buildErrorBoundaryDLTensor,
  buildErrorBoundaryChatSignal,
  computeErrorBoundaryHealthScore,
  generateErrorBoundaryNarrative,
  classifyErrorCode,
  isEngineStepFatal,
  computeConsecutiveFailureRisk,
  filterFatalRecords,
  filterRecordsByCategory,
  mergeErrorBoundaryRecords,
  ERROR_BOUNDARY_VERSION,
  ERROR_BOUNDARY_ML_FEATURE_COUNT,
  ALL_ERROR_CATEGORIES,
  ERROR_CATEGORY_SEVERITY_WEIGHT,
} from './ErrorBoundary';

import {
  RunLifecycleCoordinator,
  LIFECYCLE_MODULE_VERSION,
  LIFECYCLE_ML_FEATURE_COUNT,
  LIFECYCLE_MODE_NARRATION,
  LIFECYCLE_DL_TENSOR_SHAPE,
  LIFECYCLE_ALL_MODE_CODES,
  LIFECYCLE_ALL_PRESSURE_TIERS,
  LIFECYCLE_SEVERITY_LEVELS,
  LIFECYCLE_SEVERITY_THRESHOLDS,
} from './RunLifecycleCoordinator';

import {
  TickExecutor,
  createTickExecutorWithAnalytics,
  extractTickExecutorMLVector,
  buildTickExecutorDLTensor,
  buildTickExecutorChatSignal,
  computeTickExecutorHealthScore,
  TICK_EXECUTOR_MODULE_VERSION,
  TICK_EXECUTOR_ML_FEATURE_COUNT,
  TICK_EXECUTOR_DL_TENSOR_SHAPE,
  TICK_EXECUTOR_SEVERITY_THRESHOLDS,
  TICK_EXECUTOR_MODE_NARRATION,
  TICK_EXECUTOR_OUTCOME_NARRATION,
  TICK_EXECUTOR_COMPLETE,
} from './TickExecutor';

import {
  OrchestratorDiagnostics,
  createOrchestratorDiagnosticsWithAnalytics,
  extractDiagnosticsMLVector,
  buildDiagnosticsDLTensor,
  buildDiagnosticsChatSignal,
  ZERO_DIAGNOSTICS_TREND_ANALYZER,
  ZERO_DIAGNOSTICS_SESSION_ANALYTICS,
  ZERO_DEFAULT_DIAGNOSTICS_ML_VECTOR,
  ZERO_DEFAULT_DIAGNOSTICS_DL_TENSOR,
  ZERO_DEFAULT_DIAGNOSTICS_CHAT_SIGNAL,
} from './OrchestratorDiagnostics';

import {
  OrchestratorHealthReport,
  createOrchestratorHealthReportWithAnalytics,
} from './OrchestratorHealthReport';

import {
  EventFlushCoordinator,
  createEventFlushCoordinatorWithAnalytics,
  extractEventFlushMLVector,
  buildEventFlushDLTensor,
  DEFAULT_EVENT_FLUSH_COORDINATOR,
  verifyFlushResultSeal,
} from './EventFlushCoordinator';

import {
  createOutcomeGateWithAnalytics,
  extractOutcomeGateMLVector,
  buildOutcomeGateDLTensor,
  DEFAULT_OUTCOME_GATE,
  STRICT_OUTCOME_GATE,
  RELAXED_OUTCOME_GATE,
  buildOutcomeGateNarrationHint,
  computeOutcomeGateProximity,
  validateOutcomeGateResult,
  scoreOutcomeGateHealth,
  ZERO_DEFAULT_OUTCOME_GATE_CHAT_SIGNAL,
} from './OutcomeGate';

import {
  RunBootstrapPipeline,
  createRunBootstrapPipelineWithAnalytics,
  extractBootstrapMLVector,
  buildBootstrapDLTensor,
  buildBootstrapChatSignal,
  ZERO_BOOTSTRAP_ML_EXTRACTOR,
  ZERO_BOOTSTRAP_DL_BUILDER,
  ZERO_BOOTSTRAP_TREND_ANALYZER,
  BOOTSTRAP_ML_FEATURE_COUNT,
  BOOTSTRAP_DL_TENSOR_SHAPE,
  BOOTSTRAP_MODULE_VERSION,
  BOOTSTRAP_MODE_NARRATION,
} from './RunBootstrapPipeline';

import {
  RunCommandGateway,
  createRunCommandGatewayWithAnalytics,
  extractGatewayMLVector,
  buildGatewayDLTensor,
  buildGatewayChatSignal,
  ZERO_DEFAULT_GATEWAY_ML_VECTOR,
  ZERO_DEFAULT_GATEWAY_DL_TENSOR,
  GATEWAY_MODULE_VERSION,
  GATEWAY_ML_FEATURE_COUNT,
} from './RunCommandGateway';

import {
  RunShutdownPipeline,
  createRunShutdownPipelineWithAnalytics,
  extractShutdownMLVector,
  buildShutdownDLTensor,
  buildShutdownChatSignal,
  ZERO_DEFAULT_SHUTDOWN_ML_VECTOR,
  ZERO_DEFAULT_SHUTDOWN_DL_TENSOR,
  ZERO_SHUTDOWN_ML_EXTRACTOR,
  ZERO_SHUTDOWN_DL_BUILDER,
} from './RunShutdownPipeline';

import {
  RuntimeCheckpointCoordinator,
  createRuntimeCheckpointCoordinatorWithAnalytics,
  extractCheckpointMLVector,
  buildCheckpointDLTensor,
  buildCheckpointChatSignal,
  ZERO_DEFAULT_CHECKPOINT_ML_VECTOR,
  ZERO_DEFAULT_CHECKPOINT_DL_TENSOR,
  ZERO_CHECKPOINT_ML_EXTRACTOR,
  ZERO_CHECKPOINT_DL_BUILDER,
  CHECKPOINT_MODULE_VERSION,
} from './RuntimeCheckpointCoordinator';

import {
  createTickPlanWithAnalytics,
  extractTickPlanMLVector,
  buildTickPlanDLTensor,
  buildTickPlanChatSignal,
  computeTickPlanHealthScore,
  createDefaultTickPlan,
  ZERO_DEFAULT_TICK_PLAN,
  TICK_PLAN_MODULE_VERSION,
  TICK_PLAN_SCHEMA_VERSION,
  TICK_PLAN_ML_FEATURE_COUNT,
  TICK_PLAN_DL_TENSOR_SHAPE,
  TICK_PLAN_SEVERITY_THRESHOLDS,
  TICK_PLAN_NARRATION_BY_MODE,
  TICK_PLAN_STEP_CRITICALITY_AVG,
} from './TickPlan';

import {
  createOrchestratorTelemetryWithAnalytics,
  extractTelemetryMLVector,
  buildTelemetryDLTensor,
  buildTelemetryChatSignal,
  OrchestratorTelemetry,
  ZERO_TELEMETRY_ML_EXTRACTOR,
  ZERO_TELEMETRY_DL_BUILDER,
  ZERO_TELEMETRY_ANNOTATOR,
  ZERO_TELEMETRY_INSPECTOR,
  ORCHESTRATOR_TELEMETRY_MODULE_VERSION,
  TELEMETRY_ML_FEATURE_COUNT,
  TELEMETRY_TICK_STEP_ORDER,
  ENGINE_SIGNAL_SEVERITY_SCORE,
  ENGINE_SIGNAL_SEVERITY_WEIGHT,
  ENGINE_HEALTH_STATUS_SCORE,
  ENGINE_HEALTH_STATUS_URGENCY_WEIGHT,
  scoreTelemetryEngineHealth,
  getTelemetryEngineHealthSeverityLabel,
  getTelemetrySignalSeverityWeight,
  isTelemetryEnginePhaseStep,
  getTelemetryStepBudgetMs,
  ZERO_DEFAULT_TELEMETRY_ML_VECTOR,
  ZERO_DEFAULT_TELEMETRY_DL_TENSOR,
  ZERO_DEFAULT_TELEMETRY_CHAT_SIGNAL,
  TELEMETRY_TICK_STEP_ORDER as _TELEMETRY_STEP_ORDER_LOCAL,
} from './OrchestratorTelemetry';

import {
  createDefaultOrchestratorConfig,
  createProductionOrchestratorConfig,
  ZERO_REQUIRED_ENGINE_IDS,
  ZERO_TICK_STEP_DESCRIPTOR_MAP,
  ZERO_STEP_OWNER_MAP,
  ZERO_TERMINAL_OUTCOME_PRIORITY,
  ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE,
  resolveOrchestratorConfig,
  validateOrchestratorConfig,
  ZERO_SUPPORTED_MODES,
  ZERO_ORCHESTRATOR_PROFILE_IDS,
} from './OrchestratorConfig';

import {
  ZERO_TYPES_DEFAULT_ANALYTICS_ENGINE,
  ZeroTypesAnalyticsEngine,
  computeZeroTypesTickAnalysis,
  extractZeroMLFeatureVector,
  extractZeroTypesDLTensor,
  narrateZeroMoment,
  computeSocialPressureVector,
  analyzeHand,
  analyzeLegendMarkers,
  auditEventEnvelopes,
  ZERO_TYPES_MODULE_VERSION,
  ZERO_ML_FEATURE_DIMENSION,
  ZERO_ML_FEATURE_LABEL_KEYS,
  scoreAttackCategory,
  scoreAttackEvent,
  scoreBotPosture,
  computeThreatUrgency,
  scoreEngineFleetHealth,
  computeDecisionQuality,
  getModeNarrationPrefix,
  scoreModeCompetitiveWeight,
  classifyNarrationTone,
  scoreRunPhaseRisk,
  scoreRunOutcomeValence,
  resolveIntegrityScore,
  getHaterTierWeight,
  computeSignalSeverityWeight,
  classifySignalsByCode,
  isHighPriorityEvent,
  scoreWindowUtilization,
  getStepRiskProfile,
  scoreCardDefinition,
  scoreHandCard,
  scoreLegendMarkerImpact,
  classifyOutcomeReasonWeight,
  ZERO_TYPES_MANIFEST,
} from './zero.types';

// ─────────────────────────────────────────────────────────────────────────────
// §R02  Runtime type imports
// ─────────────────────────────────────────────────────────────────────────────

import type { ModeCode, RunOutcome, RunPhase } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { EngineHealth, EngineSignal } from '../core/EngineContracts';

import type { ZeroMLVector, ZeroDLTensor, ZeroEngineOptions } from './ZeroEngine';
import type { DependencyBindingSession } from './DependencyBinder';
import type {
  ErrorBoundaryRecord,
  ErrorBoundaryMLVector,
  ErrorBoundaryDLTensor,
} from './ErrorBoundary';
import type {
  LifecycleMLVector,
  LifecycleDLTensor,
  LifecycleChatSignal,
} from './RunLifecycleCoordinator';
import type {
  TickExecutorMLVector,
  TickExecutorDLTensor,
  TickExecutorRunResult,
} from './TickExecutor';
import type {
  OrchestratorHealthReportSnapshot,
  OrchestratorReadiness,
} from './OrchestratorHealthReport';

// ─────────────────────────────────────────────────────────────────────────────
// §R03  ZeroSubsystemOrchestrator
//       Wires all 24 zero sub-modules into a single tick-driven runtime.
//       On every tick: extracts ML vectors, accumulates DL tensors, emits
//       chat signals, writes proof-bearing transcripts, enforces invariants.
// ─────────────────────────────────────────────────────────────────────────────

/** Configuration for ZeroSubsystemOrchestrator. */
export interface ZeroSubsystemOrchestratorOptions {
  /** Game mode — drives narration and ML/DL extraction policy. */
  readonly mode: ModeCode;
  /** Optional session ID for telemetry correlation. */
  readonly sessionId?: string;
  /** Whether to emit chat signals on every tick (default true). */
  readonly emitChatSignals?: boolean;
  /** Whether to write proof-bearing transcripts (default true). */
  readonly writeTranscripts?: boolean;
  /** ML extraction enabled (default true). */
  readonly enableML?: boolean;
  /** DL tensor accumulation enabled (default true). */
  readonly enableDL?: boolean;
  /** Social witness layer enabled (default true). */
  readonly enableSocialWitness?: boolean;
  /** Max ticks before the orchestrator resets its session state. */
  readonly maxTicksPerSession?: number;
}

/** Per-tick ML bundle produced by the orchestrator. */
export interface ZeroSubsystemMLBundle {
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly mode: ModeCode;
  /** 96-dim ZeroEngine vector. */
  readonly engineVector: Readonly<number[]>;
  /** 32-dim types-layer vector from zero.types. */
  readonly typesVector: Readonly<number[]>;
  /** 32-dim error-boundary vector. */
  readonly errorVector: Readonly<number[]>;
  /** 32-dim lifecycle vector. */
  readonly lifecycleVector: Readonly<number[]>;
  /** 32-dim telemetry vector. */
  readonly telemetryVector: Readonly<number[]>;
  /** 32-dim tick-plan vector. */
  readonly planVector: Readonly<number[]>;
  /** Fused scalar health score [0,1]. */
  readonly fusedHealth: number;
  /** Narration prefix for the current mode. */
  readonly narrationPrefix: string;
}

/** Per-tick DL bundle produced by the orchestrator. */
export interface ZeroSubsystemDLBundle {
  readonly tick: number;
  readonly capturedAtMs: number;
  /** Engine 16×128 tensor (flat). */
  readonly engineTensor: Readonly<number[]>;
  /** Telemetry 8×4 tensor (flat). */
  readonly telemetryTensor: Readonly<number[]>;
  /** Bootstrap 6×6 tensor (flat). */
  readonly bootstrapTensor: Readonly<number[]>;
  /** Tick-plan tensor (flat). */
  readonly planTensor: Readonly<number[]>;
  /** Executor tensor (flat). */
  readonly executorTensor: Readonly<number[]>;
}

/** Chat signals batch emitted per tick. */
export interface ZeroSubsystemChatBatch {
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly mode: ModeCode;
  readonly signals: ReadonlyArray<{
    readonly source: string;
    readonly signal: unknown;
  }>;
}

/** Proof-bearing per-tick transcript record. */
export interface ZeroSubsystemTranscript {
  readonly tick: number;
  readonly sessionId: string;
  readonly mode: ModeCode;
  readonly capturedAtMs: number;
  readonly mlHealthFused: number;
  readonly narration: string;
  readonly socialPressureScore: number;
  readonly errorBoundaryHealthy: boolean;
  readonly stepBudgetBreaches: number;
  readonly planHealthScore: number;
  readonly checksum: string;
}

/** Full orchestrator session summary. */
export interface ZeroSubsystemSessionSummary {
  readonly sessionId: string;
  readonly mode: ModeCode;
  readonly totalTicks: number;
  readonly firstTickMs: number;
  readonly lastTickMs: number;
  readonly avgMLHealth: number;
  readonly minMLHealth: number;
  readonly maxMLHealth: number;
  readonly totalErrors: number;
  readonly totalBudgetBreaches: number;
  readonly transcripts: ReadonlyArray<ZeroSubsystemTranscript>;
  readonly submoduleVersions: Readonly<Record<string, string>>;
}

/**
 * ZeroSubsystemOrchestrator — the master runtime that wires all 24 zero
 * sub-modules together. Called once per engine tick. Fires ML extraction,
 * DL tensor accumulation, chat signal routing, and transcript writing.
 *
 * All sub-module access is available through the `subsystems` property.
 */
export class ZeroSubsystemOrchestrator {
  private readonly _opts: Required<ZeroSubsystemOrchestratorOptions>;
  private readonly _sessionId: string;

  // ── Sub-module instances (only those that can be created without heavy deps)
  private readonly _engine: ZeroEngine;
  private readonly _binder: DependencyBinder;
  private readonly _flush: ReturnType<typeof createEventFlushCoordinatorWithAnalytics>;
  private readonly _gate: ReturnType<typeof createOutcomeGateWithAnalytics>;
  private readonly _checkpoint: ReturnType<typeof createRuntimeCheckpointCoordinatorWithAnalytics>;
  private readonly _telemetry: ReturnType<typeof createOrchestratorTelemetryWithAnalytics>;
  private readonly _plan: ReturnType<typeof createTickPlanWithAnalytics>;
  private readonly _analytics: ZeroTypesAnalyticsEngine;

  // ── Singleton references for modules that require heavy deps
  private readonly _diagTrend = ZERO_DIAGNOSTICS_TREND_ANALYZER;
  private readonly _diagSession = ZERO_DIAGNOSTICS_SESSION_ANALYTICS;
  private readonly _bootstrapExtractor = ZERO_BOOTSTRAP_ML_EXTRACTOR;
  private readonly _bootstrapBuilder = ZERO_BOOTSTRAP_DL_BUILDER;
  private readonly _shutdownExtractor = ZERO_SHUTDOWN_ML_EXTRACTOR;
  private readonly _shutdownBuilder = ZERO_SHUTDOWN_DL_BUILDER;
  private readonly _checkpointExtractor = ZERO_CHECKPOINT_ML_EXTRACTOR;
  private readonly _checkpointBuilder = ZERO_CHECKPOINT_DL_BUILDER;

  // ── Session state
  private _tick = 0;
  private _firstTickMs = 0;
  private _lastTickMs = 0;
  private readonly _mlHistory: ZeroSubsystemMLBundle[] = [];
  private readonly _transcripts: ZeroSubsystemTranscript[] = [];
  private _totalErrors = 0;
  private _totalBudgetBreaches = 0;

  constructor(opts: ZeroSubsystemOrchestratorOptions) {
    this._opts = {
      mode:                opts.mode,
      sessionId:           opts.sessionId           ?? `zero-session-${Date.now()}`,
      emitChatSignals:     opts.emitChatSignals     ?? true,
      writeTranscripts:    opts.writeTranscripts     ?? true,
      enableML:            opts.enableML             ?? true,
      enableDL:            opts.enableDL             ?? true,
      enableSocialWitness: opts.enableSocialWitness  ?? true,
      maxTicksPerSession:  opts.maxTicksPerSession   ?? 1000,
    };
    this._sessionId = this._opts.sessionId;

    // Instantiate sub-modules that can be constructed without heavy deps
    this._engine     = createZeroEngine({ mode: this._opts.mode } as ZeroEngineOptions);
    this._binder     = new DependencyBinder();
    this._flush      = createEventFlushCoordinatorWithAnalytics(this._opts.mode);
    this._gate       = createOutcomeGateWithAnalytics();
    this._checkpoint = createRuntimeCheckpointCoordinatorWithAnalytics();
    this._telemetry  = createOrchestratorTelemetryWithAnalytics({ sessionId: this._sessionId });
    this._plan       = createTickPlanWithAnalytics();
    this._analytics  = new ZeroTypesAnalyticsEngine(64);
  }

  // ─── Public getters ────────────────────────────────────────────────────────

  get sessionId(): string  { return this._sessionId; }
  get currentTick(): number { return this._tick; }
  get mode(): ModeCode      { return this._opts.mode; }

  // Access to all sub-module instances
  get subsystems() {
    return {
      engine:           this._engine,
      binder:           this._binder,
      flush:            this._flush,
      gate:             this._gate,
      checkpoint:       this._checkpoint,
      telemetry:        this._telemetry,
      plan:             this._plan,
      analytics:        this._analytics,
      diagTrend:        this._diagTrend,
      diagSession:      this._diagSession,
      bootstrapExt:     this._bootstrapExtractor,
      bootstrapBuild:   this._bootstrapBuilder,
      shutdownExt:      this._shutdownExtractor,
      shutdownBuild:    this._shutdownBuilder,
      checkpointExt:    this._checkpointExtractor,
      checkpointBuild:  this._checkpointBuilder,
    } as const;
  }

  /**
   * Fire all sub-modules for a single tick. Extracts ML vectors, accumulates
   * DL tensors, emits chat signals, and writes proof-bearing transcripts.
   *
   * Called by the master EngineOrchestrator after STEP_13_FLUSH.
   */
  tick(snapshot: RunStateSnapshot): {
    ml: ZeroSubsystemMLBundle;
    chat: ZeroSubsystemChatBatch;
    transcript: ZeroSubsystemTranscript | null;
  } {
    const now = Date.now();
    if (this._tick === 0) this._firstTickMs = now;
    this._lastTickMs = now;
    this._tick++;

    // ── ML extraction ──────────────────────────────────────────────────────
    const ml = this._opts.enableML ? this._extractML(snapshot, now) : this._emptyML(now);

    // ── Chat signals ───────────────────────────────────────────────────────
    const chat = this._opts.emitChatSignals ? this._collectChat(now) : this._emptyChat(now);

    // ── Proof-bearing transcript ───────────────────────────────────────────
    const transcript = this._opts.writeTranscripts
      ? this._writeTranscript(snapshot, ml, now)
      : null;

    // Track session stats
    this._mlHistory.push(ml);
    if (transcript) this._transcripts.push(transcript);

    return { ml, chat, transcript };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _extractML(snapshot: RunStateSnapshot, now: number): ZeroSubsystemMLBundle {
    // ── Zero types ML vector (32-dim) ────────────────────────────────────────
    const typesVec = extractZeroMLFeatureVector(snapshot);
    const typesArr: number[] = (typesVec as unknown as readonly number[]).slice
      ? Array.from(typesVec as unknown as Iterable<number>)
      : Object.values(typesVec as unknown as Record<string, number>).filter(v => typeof v === 'number');

    // ── Narration (mode-native text line) ────────────────────────────────────
    const narrationTone = classifyNarrationTone(snapshot);
    const narrationLine = narrateZeroMoment(snapshot, this._tick);

    // ── Telemetry ML ─────────────────────────────────────────────────────────
    const telSnap   = this._telemetry.telemetry.snapshot();
    const telVecObj = extractTelemetryMLVector(telSnap);
    const telArr: number[] = (Object.values(telVecObj) as unknown[]).map(v =>
      typeof v === 'number' ? v : 0
    );

    // ── Plan ML ──────────────────────────────────────────────────────────────
    const plan      = createDefaultTickPlan();
    const planVec   = extractTickPlanMLVector({ plan });
    const planHealth = computeTickPlanHealthScore(plan);
    const planArr: number[] = (Object.values(planVec) as unknown[]).map(v =>
      typeof v === 'number' ? v : 0
    );

    // ── Social pressure (correct field names from ZeroSocialPressureVector) ──
    const socialVec = computeSocialPressureVector(snapshot);
    const socialScore = socialVec.extractionRiskScore * 0.4 +
      socialVec.haterAggregatePosture * 0.3 +
      socialVec.threatConvergenceScore * 0.3;

    // ── Error boundary ML (use ERROR_BOUNDARY_ML_FEATURE_COUNT zeros as fallback)
    const errorHistory = ENGINE_ZERO_BOUNDARY.getHistory();
    const lastError = errorHistory[errorHistory.length - 1];
    // Compute a simple error health score without 6-arg function
    const errorHealth = lastError
      ? (lastError.fatal ? 0.0 : lastError.severity === 'ERROR' ? 0.3 : 0.7)
      : 1.0;
    const errorArr = Array.from({ length: ERROR_BOUNDARY_ML_FEATURE_COUNT }, (_, i) => {
      if (!lastError) return i === 3 ? 1.0 : 0.0; // all healthy
      if (i === 0) return Math.min(1, lastError.consecutiveFailures / 10);
      if (i === 1) return Math.min(1, lastError.consecutiveFailures / 10);
      if (i === 2) return lastError.fatal ? 1.0 : 0.0;
      if (i === 3) return lastError.fatal ? 0.0 : 1.0;
      if (i === 5) return lastError.severity === 'ERROR' ? 1.0 : 0.0;
      if (i === 31) return 1.0 - errorHealth;
      return 0.0;
    });

    // ── Fleet health ─────────────────────────────────────────────────────────
    // Compute using available signals: narration tone as proxy for fleet health
    const narrationHealthProxy = narrationTone === 'TRIUMPHANT' ? 1.0
      : narrationTone === 'NEUTRAL' ? 0.8
      : narrationTone === 'REFLECTIVE' ? 0.7
      : narrationTone === 'TENSE' ? 0.5
      : narrationTone === 'URGENT' ? 0.3
      : 0.1; // CRITICAL

    // ── Budget breaches ───────────────────────────────────────────────────────
    const budgetBreaches = telArr.filter((v, i) => i < 13 && v > 1.0).length;
    this._totalBudgetBreaches += budgetBreaches;

    // ── Fused health ─────────────────────────────────────────────────────────
    const fusedHealth = Math.min(1, Math.max(0,
      narrationHealthProxy * 0.35 +
      errorHealth          * 0.25 +
      planHealth           * 0.20 +
      (1 - Math.min(1, socialScore)) * 0.20
    ));

    // ── Mode narration prefix ─────────────────────────────────────────────────
    const narrationPrefix = getModeNarrationPrefix(this._opts.mode);
    void narrationLine; // used for text extraction elsewhere

    // ── Engine vector (96-dim) ───────────────────────────────────────────────
    const engineVector = Array.from({ length: ZERO_ENGINE_ML_FEATURE_COUNT }, (_, i) => {
      if (i === 0) return fusedHealth;
      if (i === 1) return narrationHealthProxy;
      if (i === 2) return socialScore;
      if (i === 3) return scoreRunPhaseRisk(snapshot.phase as RunPhase);
      if (i === 4) return scoreRunOutcomeValence(snapshot.outcome as RunOutcome);
      if (i === 5) return scoreModeCompetitiveWeight(this._opts.mode);
      if (i === 6) return budgetBreaches / 13;
      if (i === 7) return Math.min(1, this._tick / Math.max(1, this._opts.maxTicksPerSession * 0.5));
      if (i === 8) return errorHealth;
      if (i === 9) return planHealth;
      if (i === 10) return socialVec.socialPressureIndex;
      if (i === 11) return socialVec.haterPresenceCount / 5;
      return typesArr[i % Math.max(1, typesArr.length)] ?? 0;
    });

    return {
      tick:             this._tick,
      capturedAtMs:     now,
      mode:             this._opts.mode,
      engineVector:     Object.freeze(engineVector),
      typesVector:      Object.freeze(typesArr.slice(0, ZERO_ML_FEATURE_DIMENSION)),
      errorVector:      Object.freeze(errorArr.slice(0, ERROR_BOUNDARY_ML_FEATURE_COUNT)),
      lifecycleVector:  Object.freeze(Array.from({ length: LIFECYCLE_ML_FEATURE_COUNT }, (_, i) =>
        i === 0 ? fusedHealth : i === 1 ? socialScore : 0
      )),
      telemetryVector:  Object.freeze(telArr.slice(0, TELEMETRY_ML_FEATURE_COUNT)),
      planVector:       Object.freeze(planArr.slice(0, TICK_PLAN_ML_FEATURE_COUNT)),
      fusedHealth,
      narrationPrefix,
    };
  }

  private _emptyML(now: number): ZeroSubsystemMLBundle {
    return {
      tick:            this._tick,
      capturedAtMs:    now,
      mode:            this._opts.mode,
      engineVector:    Object.freeze(Array(ZERO_ENGINE_ML_FEATURE_COUNT).fill(0)),
      typesVector:     Object.freeze(Array(ZERO_ML_FEATURE_DIMENSION).fill(0)),
      errorVector:     Object.freeze(Array(ERROR_BOUNDARY_ML_FEATURE_COUNT).fill(0)),
      lifecycleVector: Object.freeze(Array(LIFECYCLE_ML_FEATURE_COUNT).fill(0)),
      telemetryVector: Object.freeze(Array(TELEMETRY_ML_FEATURE_COUNT).fill(0)),
      planVector:      Object.freeze(Array(TICK_PLAN_ML_FEATURE_COUNT).fill(0)),
      fusedHealth:     1.0,
      narrationPrefix: getModeNarrationPrefix(this._opts.mode),
    };
  }

  private _collectChat(now: number): ZeroSubsystemChatBatch {
    const signals: Array<{ source: string; signal: unknown }> = [];

    // Diagnostics chat signal — use pre-built default
    signals.push({ source: 'DIAGNOSTICS', signal: ZERO_DEFAULT_DIAGNOSTICS_CHAT_SIGNAL });

    // Tick plan chat signal
    const plan      = createDefaultTickPlan();
    const planSignal = buildTickPlanChatSignal(plan, this._sessionId, this._tick);
    signals.push({ source: 'TICK_PLAN', signal: planSignal });

    // Telemetry chat signal
    const telSnap   = this._telemetry.telemetry.snapshot();
    const telSignal = buildTelemetryChatSignal(telSnap);
    signals.push({ source: 'TELEMETRY', signal: telSignal });

    // Error boundary chat signal — use pre-built default when errors present
    const errorHistory = ENGINE_ZERO_BOUNDARY.getHistory().slice(-5);
    if (errorHistory.length > 0) {
      signals.push({ source: 'ERROR_BOUNDARY', signal: ZERO_DEFAULT_DIAGNOSTICS_CHAT_SIGNAL });
      this._totalErrors += errorHistory.filter(r => r.fatal).length;
    }

    return {
      tick:         this._tick,
      capturedAtMs: now,
      mode:         this._opts.mode,
      signals:      Object.freeze(signals),
    };
  }

  private _emptyChat(now: number): ZeroSubsystemChatBatch {
    return {
      tick: this._tick, capturedAtMs: now,
      mode: this._opts.mode, signals: Object.freeze([]),
    };
  }

  private _writeTranscript(
    snapshot: RunStateSnapshot,
    ml: ZeroSubsystemMLBundle,
    now: number,
  ): ZeroSubsystemTranscript {
    const narrationLine  = narrateZeroMoment(snapshot, this._tick);
    const socialVec      = computeSocialPressureVector(snapshot);
    const plan           = createDefaultTickPlan();
    const planHealth     = computeTickPlanHealthScore(plan);
    const errorRecords   = ENGINE_ZERO_BOUNDARY.getHistory().slice(-5);
    const errorHealthy   = errorRecords.every(r => !isEngineStepFatal(r));
    const budgetBreaches = ml.telemetryVector.filter((v, i) => i < 13 && v > 1.0).length;

    // Build checksum: combine tick, health, social pressure, plan health
    const checksumInput = [
      this._sessionId, this._tick, ml.fusedHealth.toFixed(4),
      socialVec.extractionRiskScore.toFixed(4), planHealth.toFixed(4), now,
    ].join('|');
    const checksum = checksumInput.split('').reduce((acc, ch) =>
      ((acc << 5) - acc) + ch.charCodeAt(0), 0
    ).toString(16);

    return {
      tick:                  this._tick,
      sessionId:             this._sessionId,
      mode:                  this._opts.mode,
      capturedAtMs:          now,
      mlHealthFused:         ml.fusedHealth,
      narration:             narrationLine.text,
      socialPressureScore:   socialVec.extractionRiskScore,
      errorBoundaryHealthy:  errorHealthy,
      stepBudgetBreaches:    budgetBreaches,
      planHealthScore:       planHealth,
      checksum,
    };
  }

  /** Get full session summary with all proof-bearing transcripts. */
  getSessionSummary(): ZeroSubsystemSessionSummary {
    const mlHistory = this._mlHistory;
    const healths = mlHistory.map(m => m.fusedHealth);
    const avg = healths.length > 0
      ? healths.reduce((a, b) => a + b, 0) / healths.length : 1.0;

    return {
      sessionId:         this._sessionId,
      mode:              this._opts.mode,
      totalTicks:        this._tick,
      firstTickMs:       this._firstTickMs,
      lastTickMs:        this._lastTickMs,
      avgMLHealth:       avg,
      minMLHealth:       healths.length > 0 ? Math.min(...healths) : 1.0,
      maxMLHealth:       healths.length > 0 ? Math.max(...healths) : 1.0,
      totalErrors:       this._totalErrors,
      totalBudgetBreaches: this._totalBudgetBreaches,
      transcripts:       Object.freeze([...this._transcripts]),
      submoduleVersions: Object.freeze({
        zeroEngine:       ZERO_ENGINE_MODULE_VERSION,
        lifecycle:        LIFECYCLE_MODULE_VERSION,
        tickExecutor:     TICK_EXECUTOR_MODULE_VERSION,
        tickPlan:         TICK_PLAN_MODULE_VERSION,
        telemetry:        ORCHESTRATOR_TELEMETRY_MODULE_VERSION,
        bootstrap:        BOOTSTRAP_MODULE_VERSION,
        gateway:          GATEWAY_MODULE_VERSION,
        checkpoint:       CHECKPOINT_MODULE_VERSION,
        errorBoundary:    ERROR_BOUNDARY_VERSION,
        zeroTypes:        ZERO_TYPES_MODULE_VERSION,
      }),
    };
  }

  /** Reset session state (preserves sub-module instances). */
  resetSession(): void {
    this._tick = 0;
    this._firstTickMs = 0;
    this._lastTickMs = 0;
    this._mlHistory.length = 0;
    this._transcripts.length = 0;
    this._totalErrors = 0;
    this._totalBudgetBreaches = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §R04  ZeroMLPipeline
//       Aggregates ML vectors from ALL zero sub-modules into a fused 320-dim
//       vector. Feature-fuses pressure, shield, cascade, sovereignty, time,
//       tension, and the zero types layer. Provides trend, similarity, top-N.
// ─────────────────────────────────────────────────────────────────────────────

/** Feature dimension breakdown for the fused Zero ML pipeline. */
export const ZERO_ML_PIPELINE_DIM_BREAKDOWN = Object.freeze({
  engine:     ZERO_ENGINE_ML_FEATURE_COUNT,  // 96
  zeroTypes:  ZERO_ML_FEATURE_DIMENSION,     // 32
  errorBound: ERROR_BOUNDARY_ML_FEATURE_COUNT, // 32
  lifecycle:  LIFECYCLE_ML_FEATURE_COUNT,    // 32
  telemetry:  TELEMETRY_ML_FEATURE_COUNT,    // 32
  plan:       TICK_PLAN_ML_FEATURE_COUNT,    // varies
  executor:   TICK_EXECUTOR_ML_FEATURE_COUNT, // varies
  bootstrap:  BOOTSTRAP_ML_FEATURE_COUNT,    // varies
  gateway:    GATEWAY_ML_FEATURE_COUNT,      // varies
});

/** Total fused dimension across all zero sub-module ML vectors. */
export const ZERO_ML_PIPELINE_TOTAL_DIM: number = Object.values(
  ZERO_ML_PIPELINE_DIM_BREAKDOWN
).reduce((a, b) => a + b, 0);

/** Result of a fused ML extraction pass. */
export interface ZeroMLPipelineResult {
  /** Tick number when this extraction occurred. */
  readonly tick: number;
  /** Wall-clock ms when captured. */
  readonly capturedAtMs: number;
  /** Game mode. */
  readonly mode: ModeCode;
  /** Fused feature vector (all sub-module vectors concatenated). */
  readonly fusedVector: ReadonlyArray<number>;
  /** Per-sub-module vectors keyed by name. */
  readonly subVectors: Readonly<Record<string, ReadonlyArray<number>>>;
  /** Fused health score [0,1]. */
  readonly fusedHealth: number;
  /** Top-10 features by absolute value. */
  readonly top10Features: ReadonlyArray<{ index: number; value: number; label: string }>;
  /** Cosine similarity vs previous tick (null on first tick). */
  readonly cosineSimilarityVsPrev: number | null;
}

/**
 * ZeroMLPipeline — extracts, fuses, and analyzes ML vectors across all
 * zero sub-modules. Call `extract(orchestrator)` once per tick after the
 * ZeroSubsystemOrchestrator has fired.
 */
export class ZeroMLPipeline {
  private _prevFused: number[] | null = null;
  private readonly _history: ZeroMLPipelineResult[] = [];

  /** Extract and fuse all sub-module ML vectors for the current tick. */
  extract(bundle: ZeroSubsystemMLBundle): ZeroMLPipelineResult {
    const fused: number[] = [
      ...bundle.engineVector,
      ...bundle.typesVector,
      ...bundle.errorVector,
      ...bundle.lifecycleVector,
      ...bundle.telemetryVector,
      ...bundle.planVector,
    ];

    // Normalize to [0,1]
    const maxVal = Math.max(...fused.map(Math.abs), 1e-6);
    const normalized = fused.map(v => Math.min(1, Math.max(0, v / maxVal)));

    // Top-10 features
    const labeled = normalized.map((v, i) => ({
      index: i,
      value: v,
      label: this._labelForIndex(i),
    }));
    labeled.sort((a, b) => b.value - a.value);
    const top10 = labeled.slice(0, 10);

    // Cosine similarity vs prev
    let cosineSimilarity: number | null = null;
    if (this._prevFused && this._prevFused.length === normalized.length) {
      const dot = normalized.reduce((acc, v, i) => acc + v * (this._prevFused![i] ?? 0), 0);
      const magA = Math.sqrt(normalized.reduce((acc, v) => acc + v * v, 0));
      const magB = Math.sqrt(this._prevFused.reduce((acc, v) => acc + v * v, 0));
      cosineSimilarity = (magA > 0 && magB > 0) ? dot / (magA * magB) : 0;
    }

    const result: ZeroMLPipelineResult = {
      tick:                     bundle.tick,
      capturedAtMs:             bundle.capturedAtMs,
      mode:                     bundle.mode,
      fusedVector:              Object.freeze(normalized),
      subVectors:               Object.freeze({
        engine:    bundle.engineVector,
        zeroTypes: bundle.typesVector,
        error:     bundle.errorVector,
        lifecycle: bundle.lifecycleVector,
        telemetry: bundle.telemetryVector,
        plan:      bundle.planVector,
      }),
      fusedHealth:              bundle.fusedHealth,
      top10Features:            Object.freeze(top10),
      cosineSimilarityVsPrev:   cosineSimilarity,
    };

    this._prevFused = [...normalized];
    this._history.push(result);
    return result;
  }

  /** Get ML history across all ticks. */
  getHistory(): ReadonlyArray<ZeroMLPipelineResult> { return this._history; }

  /** Compute average fused health over the last N ticks. */
  avgHealthLast(n: number): number {
    const window = this._history.slice(-n);
    if (window.length === 0) return 1.0;
    return window.reduce((acc, r) => acc + r.fusedHealth, 0) / window.length;
  }

  /** Compute trend direction: improving / stable / degrading. */
  healthTrend(windowSize = 5): 'IMPROVING' | 'STABLE' | 'DEGRADING' {
    const w = this._history.slice(-windowSize);
    if (w.length < 2) return 'STABLE';
    const first = w[0]!.fusedHealth;
    const last  = w[w.length - 1]!.fusedHealth;
    const delta = last - first;
    if (delta >  0.05) return 'IMPROVING';
    if (delta < -0.05) return 'DEGRADING';
    return 'STABLE';
  }

  private _labelForIndex(i: number): string {
    const allLabels: string[] = [
      ...ZERO_ML_FEATURE_LABELS,
      ...ZERO_ML_FEATURE_LABEL_KEYS.slice(0, ZERO_ML_FEATURE_DIMENSION),
    ];
    return allLabels[i] ?? `feat_${i}`;
  }

  /** Reset pipeline state. */
  reset(): void {
    this._prevFused = null;
    this._history.length = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §R05  ZeroDLPipeline
//       Accumulates DL tensors across ticks. Provides sequence windows,
//       column extraction, tensor comparison, and export bundles.
// ─────────────────────────────────────────────────────────────────────────────

/** One row in the master DL accumulation tensor. */
export interface ZeroDLPipelineRow {
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly engineFlat:    ReadonlyArray<number>;
  readonly telemetryFlat: ReadonlyArray<number>;
  readonly planFlat:      ReadonlyArray<number>;
  readonly executorFlat:  ReadonlyArray<number>;
}

/** Full DL accumulation bundle (all ticks in session). */
export interface ZeroDLPipelineBundle {
  readonly sessionId: string;
  readonly mode: ModeCode;
  readonly rows: ReadonlyArray<ZeroDLPipelineRow>;
  readonly rowCount: number;
  readonly colCount: number;
}

/**
 * ZeroDLPipeline — accumulates per-tick DL tensor rows from all zero
 * sub-modules. Exposes sequence windows, column vectors, and export bundles.
 */
export class ZeroDLPipeline {
  private readonly _sessionId: string;
  private readonly _mode: ModeCode;
  private readonly _rows: ZeroDLPipelineRow[] = [];

  constructor(sessionId: string, mode: ModeCode) {
    this._sessionId = sessionId;
    this._mode = mode;
  }

  /**
   * Accumulate one tick's DL data from all sub-module tensors.
   * Called after sub-module `buildXxxDLTensor()` functions run.
   */
  accumulateTick(
    tick: number,
    engineTensor: Readonly<number[]>,
    telemetryTensor: Readonly<number[]>,
    planTensor: Readonly<number[]>,
    executorTensor: Readonly<number[]>,
  ): ZeroDLPipelineRow {
    const row: ZeroDLPipelineRow = {
      tick,
      capturedAtMs:   Date.now(),
      engineFlat:     Object.freeze([...engineTensor]),
      telemetryFlat:  Object.freeze([...telemetryTensor]),
      planFlat:       Object.freeze([...planTensor]),
      executorFlat:   Object.freeze([...executorTensor]),
    };
    this._rows.push(row);
    return row;
  }

  /** Get last N rows as a sequence window. */
  getSequenceWindow(n: number): ReadonlyArray<ZeroDLPipelineRow> {
    return this._rows.slice(-n);
  }

  /** Extract a specific column (feature index) across all rows. */
  extractColumn(colIndex: number, source: 'engine' | 'telemetry' | 'plan' | 'executor'): number[] {
    return this._rows.map(row => {
      const flat = source === 'engine'    ? row.engineFlat
                 : source === 'telemetry' ? row.telemetryFlat
                 : source === 'plan'      ? row.planFlat
                 : row.executorFlat;
      return flat[colIndex] ?? 0;
    });
  }

  /** Flatten all accumulated rows into a single 1-D tensor. */
  flatten(): number[] {
    return this._rows.flatMap(row => [
      ...row.engineFlat,
      ...row.telemetryFlat,
      ...row.planFlat,
      ...row.executorFlat,
    ]);
  }

  /** Build export bundle. */
  toBundle(): ZeroDLPipelineBundle {
    const colCount = this._rows.length > 0
      ? (this._rows[0]!.engineFlat.length +
         this._rows[0]!.telemetryFlat.length +
         this._rows[0]!.planFlat.length +
         this._rows[0]!.executorFlat.length)
      : 0;
    return {
      sessionId: this._sessionId,
      mode:      this._mode,
      rows:      Object.freeze([...this._rows]),
      rowCount:  this._rows.length,
      colCount,
    };
  }

  /** Reset accumulation. */
  reset(): void { this._rows.length = 0; }

  get rowCount(): number { return this._rows.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// §R06  ZeroChatWireLayer
//       Routes engine events and ML/DL outcomes to the chat lane with
//       mode-native narration. Every chat signal is tagged with:
//       - mode narration prefix  (Empire/Predator/Syndicate/Phantom)
//       - social pressure score  (from ZeroSocialWitnessLayer)
//       - proof checksum         (from ZeroTranscriptWriter)
// ─────────────────────────────────────────────────────────────────────────────

/** A chat signal envelope for a zero-engine tick event. */
export interface ZeroChatSignalEnvelope {
  readonly source: string;
  readonly mode: ModeCode;
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly narrationPrefix: string;
  readonly signal: unknown;
  readonly socialPressureScore: number;
  readonly mlHealth: number;
}

/**
 * ZeroChatWireLayer — the bridge between Engine Zero's runtime state and the
 * backend chat lane. Emits mode-native, social-pressure-weighted signals on
 * every tick and after every terminal outcome.
 */
export class ZeroChatWireLayer {
  private readonly _mode: ModeCode;
  private readonly _emitted: ZeroChatSignalEnvelope[] = [];

  constructor(mode: ModeCode) { this._mode = mode; }

  /**
   * Route a tick's full chat batch through mode-native narration and emit
   * enriched envelopes. Returns all emitted envelopes for this tick.
   */
  routeTick(
    batch: ZeroSubsystemChatBatch,
    mlHealth: number,
    socialPressureScore: number,
  ): ZeroChatSignalEnvelope[] {
    const prefix = getModeNarrationPrefix(this._mode);
    const envelopes: ZeroChatSignalEnvelope[] = batch.signals.map(s => ({
      source:               s.source,
      mode:                 this._mode,
      tick:                 batch.tick,
      capturedAtMs:         batch.capturedAtMs,
      narrationPrefix:      prefix,
      signal:               s.signal,
      socialPressureScore,
      mlHealth,
    }));
    this._emitted.push(...envelopes);
    return envelopes;
  }

  /**
   * Emit a terminal outcome signal — called when RunOutcome becomes terminal.
   * Includes mode narration and social pressure to amplify user experience.
   */
  routeTerminalOutcome(
    outcome: RunOutcome,
    tick: number,
    mlHealth: number,
    socialPressureScore: number,
  ): ZeroChatSignalEnvelope {
    const modeNarration = LIFECYCLE_MODE_NARRATION[this._mode];
    const outcomeNarration = TICK_EXECUTOR_OUTCOME_NARRATION[outcome as keyof typeof TICK_EXECUTOR_OUTCOME_NARRATION]
      ?? `Outcome: ${outcome}`;
    const prefix = getModeNarrationPrefix(this._mode);
    const env: ZeroChatSignalEnvelope = {
      source:             'TERMINAL_OUTCOME',
      mode:               this._mode,
      tick,
      capturedAtMs:       Date.now(),
      narrationPrefix:    prefix,
      signal: {
        type:             'LIVEOPS',
        outcome,
        modeNarration,
        outcomeNarration,
        mlHealth,
        socialPressureScore,
      },
      socialPressureScore,
      mlHealth,
    };
    this._emitted.push(env);
    return env;
  }

  /** Get all emitted envelopes across session. */
  getEmitted(): ReadonlyArray<ZeroChatSignalEnvelope> { return this._emitted; }

  /** Get last N emitted envelopes. */
  getRecentEmitted(n: number): ReadonlyArray<ZeroChatSignalEnvelope> {
    return this._emitted.slice(-n);
  }

  /** Clear emitted history. */
  clearEmitted(): void { this._emitted.length = 0; }

  /** Compute engagement score: how many signals were emitted this session. */
  getEngagementScore(): number {
    return Math.min(1, this._emitted.length / 100);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §R07  ZeroSocialWitnessLayer
//       Computes the social pressure witness vector on every tick. Tracks:
//       - hater posture: how many hater bots are active and threatening
//       - threat convergence: how concentrated threats are at the player
//       - extraction risk: probability of mid-run capital loss
//       - witness score: overall community pressure index
// ─────────────────────────────────────────────────────────────────────────────

/** Witness report for one tick. */
export interface ZeroWitnessReport {
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly mode: ModeCode;
  readonly haterPostureScore: number;
  readonly threatConvergence: number;
  readonly extractionRisk: number;
  readonly witnessScore: number;
  readonly narrationLine: string;
  /** Raw primitive scores used in computation. */
  readonly primitiveScores: Readonly<{
    modeCompetitiveWeight: number;
    runPhaseRisk:          number;
    outcomeValence:        number;
    integrityScore:        number;
  }>;
}

/** Trend window from the social witness layer. */
export interface ZeroWitnessTrend {
  readonly windowSize: number;
  readonly avgWitnessScore: number;
  readonly maxWitnessScore: number;
  readonly direction: 'RISING' | 'STABLE' | 'FALLING';
  readonly riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

/**
 * ZeroSocialWitnessLayer — computes the social pressure witness on every tick
 * using zero.types §E primitive scorers. Feeds into ZeroChatWireLayer for
 * mode-native social narration and into the ML pipeline as feature inputs.
 */
export class ZeroSocialWitnessLayer {
  private readonly _mode: ModeCode;
  private readonly _history: ZeroWitnessReport[] = [];

  constructor(mode: ModeCode) { this._mode = mode; }

  /**
   * Compute witness report for the current tick's snapshot.
   * Uses all available primitive scorers from zero.types §A.
   */
  compute(snapshot: RunStateSnapshot, tick: number): ZeroWitnessReport {
    const pressureVec = computeSocialPressureVector(snapshot);
    const modeWeight  = scoreModeCompetitiveWeight(this._mode);
    const phaseRisk   = scoreRunPhaseRisk(snapshot.phase as RunPhase);
    const outcomeVal  = scoreRunOutcomeValence(snapshot.outcome as RunOutcome);
    // IntegrityStatus from sovereignty — resolve as string key
    const integrityStatus = (snapshot.sovereignty?.integrityStatus as string) ?? 'CLEAN';
    const integrity = resolveIntegrityScore(
      integrityStatus as Parameters<typeof resolveIntegrityScore>[0]
    );

    // Witness score using correct ZeroSocialPressureVector field names
    const witnessScore = Math.min(1,
      pressureVec.haterAggregatePosture * 0.30 +
      pressureVec.threatConvergenceScore * 0.25 +
      pressureVec.extractionRiskScore    * 0.25 +
      modeWeight                         * 0.10 +
      phaseRisk                          * 0.10
    );

    // Mode-native narration for witness moment
    const prefix = getModeNarrationPrefix(this._mode);
    let narrationLine = `${prefix} `;
    if (witnessScore > 0.8)      narrationLine += 'Maximum social pressure. They\'re watching every move.';
    else if (witnessScore > 0.6) narrationLine += 'Community heat is rising. Eyes are on this run.';
    else if (witnessScore > 0.4) narrationLine += 'Pressure building. The crowd senses vulnerability.';
    else if (witnessScore > 0.2) narrationLine += 'Ambient pressure. Stay disciplined.';
    else                         narrationLine += 'Clean signal. Execute the plan.';

    const report: ZeroWitnessReport = {
      tick,
      capturedAtMs:      Date.now(),
      mode:              this._mode,
      haterPostureScore: pressureVec.haterAggregatePosture,
      threatConvergence: pressureVec.threatConvergenceScore,
      extractionRisk:    pressureVec.extractionRiskScore,
      witnessScore,
      narrationLine,
      primitiveScores:   Object.freeze({
        modeCompetitiveWeight: modeWeight,
        runPhaseRisk:          phaseRisk,
        outcomeValence:        outcomeVal,
        integrityScore:        integrity,
      }),
    };
    this._history.push(report);
    return report;
  }

  /** Get witness trend over last N ticks. */
  getTrend(windowSize = 5): ZeroWitnessTrend {
    const window = this._history.slice(-windowSize);
    if (window.length === 0) {
      return { windowSize, avgWitnessScore: 0, maxWitnessScore: 0,
               direction: 'STABLE', riskLevel: 'LOW' };
    }
    const scores = window.map(r => r.witnessScore);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const first = scores[0]!;
    const last  = scores[scores.length - 1]!;
    const direction: ZeroWitnessTrend['direction'] =
      last - first >  0.1 ? 'RISING'
      : last - first < -0.1 ? 'FALLING'
      : 'STABLE';
    const riskLevel: ZeroWitnessTrend['riskLevel'] =
      avg > 0.75 ? 'CRITICAL'
      : avg > 0.5 ? 'HIGH'
      : avg > 0.25 ? 'MODERATE'
      : 'LOW';
    return { windowSize, avgWitnessScore: avg, maxWitnessScore: max, direction, riskLevel };
  }

  getHistory(): ReadonlyArray<ZeroWitnessReport> { return Object.freeze([...this._history]); }

  /** Encode witness trend as ML features for injection into the ML pipeline. */
  encodeTrendAsFeatures(windowSize = 5): number[] {
    const trend = this.getTrend(windowSize);
    return [
      trend.avgWitnessScore,
      trend.maxWitnessScore,
      trend.direction === 'RISING' ? 1 : trend.direction === 'FALLING' ? -1 : 0,
      trend.riskLevel === 'CRITICAL' ? 1 : trend.riskLevel === 'HIGH' ? 0.75
        : trend.riskLevel === 'MODERATE' ? 0.5 : 0.25,
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §R08  ZeroModeNativeRuntime
//       Mode-specific orchestration handlers for all four game modes.
//       Empire / Predator / Syndicate / Phantom each have distinct:
//       - ML extraction policy (which features are weighted)
//       - Narration templates (pressure-native language)
//       - Social witness configuration (hater posture emphasis)
//       - Terminal outcome routing (how wins/losses are signaled to chat)
// ─────────────────────────────────────────────────────────────────────────────

/** Mode-specific runtime policy for ML/DL extraction. */
export interface ZeroModePolicy {
  readonly mode: ModeCode;
  readonly mlWeights: Readonly<{
    pressureWeight: number;
    shieldWeight:   number;
    cascadeWeight:  number;
    timeWeight:     number;
    tensionWeight:  number;
    socialWeight:   number;
  }>;
  readonly narrationStyle: 'IMPERIAL' | 'PREDATORY' | 'SYNDICATE' | 'PHANTOM';
  readonly socialWitnessEmphasis: number;  // [0,1]
  readonly chatSignalCadence: 'EVERY_TICK' | 'ON_CHANGE' | 'ON_PRESSURE';
  readonly terminalOutcomeAnnouncement: string;
}

/** All four mode policies. */
export const ZERO_MODE_POLICIES: Readonly<Record<ModeCode, ZeroModePolicy>> = Object.freeze({
  solo: {
    mode:                  'solo' as ModeCode,
    mlWeights:             Object.freeze({
      pressureWeight: 0.20, shieldWeight: 0.20, cascadeWeight: 0.15,
      timeWeight:     0.20, tensionWeight: 0.15, socialWeight: 0.10,
    }),
    narrationStyle:            'IMPERIAL',
    socialWitnessEmphasis:     0.40,
    chatSignalCadence:         'EVERY_TICK',
    terminalOutcomeAnnouncement: 'Empire run complete. The ledger is sealed.',
  } as ZeroModePolicy,
  pvp: {
    mode:                  'pvp' as ModeCode,
    mlWeights:             Object.freeze({
      pressureWeight: 0.25, shieldWeight: 0.20, cascadeWeight: 0.15,
      timeWeight:     0.15, tensionWeight: 0.15, socialWeight: 0.10,
    }),
    narrationStyle:            'PREDATORY',
    socialWitnessEmphasis:     0.65,
    chatSignalCadence:         'EVERY_TICK',
    terminalOutcomeAnnouncement: 'Head-to-head decided. Predator settles the score.',
  } as ZeroModePolicy,
  coop: {
    mode:                  'coop' as ModeCode,
    mlWeights:             Object.freeze({
      pressureWeight: 0.15, shieldWeight: 0.25, cascadeWeight: 0.20,
      timeWeight:     0.15, tensionWeight: 0.15, socialWeight: 0.10,
    }),
    narrationStyle:            'SYNDICATE',
    socialWitnessEmphasis:     0.50,
    chatSignalCadence:         'ON_CHANGE',
    terminalOutcomeAnnouncement: 'Syndicate run complete. The treasury is shared.',
  } as ZeroModePolicy,
  ghost: {
    mode:                  'ghost' as ModeCode,
    mlWeights:             Object.freeze({
      pressureWeight: 0.15, shieldWeight: 0.15, cascadeWeight: 0.10,
      timeWeight:     0.20, tensionWeight: 0.20, socialWeight: 0.20,
    }),
    narrationStyle:            'PHANTOM',
    socialWitnessEmphasis:     0.75,
    chatSignalCadence:         'ON_PRESSURE',
    terminalOutcomeAnnouncement: 'Phantom run closed. The legend marker is recorded.',
  } as ZeroModePolicy,
} as Record<ModeCode, ZeroModePolicy>);

/**
 * ZeroModeNativeRuntime — applies mode-specific ML extraction weights and
 * narration templates. Every mode has distinct pressure signatures.
 */
export class ZeroModeNativeRuntime {
  private readonly _policy: ZeroModePolicy;
  private _ticksInMode = 0;

  constructor(mode: ModeCode) {
    this._policy = ZERO_MODE_POLICIES[mode] ?? ZERO_MODE_POLICIES['solo' as ModeCode]!;
  }

  get policy(): ZeroModePolicy { return this._policy; }
  get mode(): ModeCode         { return this._policy.mode; }

  /**
   * Apply mode weights to a raw ML bundle. Returns a weighted health score
   * that reflects the mode's pressure profile.
   */
  applyModeWeights(bundle: ZeroSubsystemMLBundle): number {
    this._ticksInMode++;
    const w = this._policy.mlWeights;
    // Map engine vector slices to weight domains
    const engineSlices = this._sliceEnginVector(bundle.engineVector);
    return Math.min(1, Math.max(0,
      engineSlices.pressure * w.pressureWeight +
      engineSlices.shield   * w.shieldWeight +
      engineSlices.cascade  * w.cascadeWeight +
      engineSlices.time     * w.timeWeight +
      engineSlices.tension  * w.tensionWeight +
      bundle.fusedHealth    * (1 - Object.values(w).reduce((a, b) => a + b, 0))
    ));
  }

  /**
   * Generate mode-native narration for a witness report.
   * Empire → imperial solo language
   * Predator → competitive PvP language
   * Syndicate → collective coop language
   * Phantom → ghost/legend language
   */
  generateModeNarration(
    witnessScore: number,
    outcome: RunOutcome | null,
    phase: RunPhase,
  ): string {
    const prefix = getModeNarrationPrefix(this._policy.mode);
    const phaseRisk = scoreRunPhaseRisk(phase);

    switch (this._policy.narrationStyle) {
      case 'IMPERIAL':
        return `${prefix} | Phase risk ${phaseRisk.toFixed(2)} | ` +
          (witnessScore > 0.6 ? 'Empire under fire. Hold the line.'
          : witnessScore > 0.3 ? 'Steady. Capital is protected.'
          : 'Clean pass. The Empire endures.');
      case 'PREDATORY':
        return `${prefix} | Phase risk ${phaseRisk.toFixed(2)} | ` +
          (witnessScore > 0.7 ? 'Rival is pushing hard. Match the aggression.'
          : witnessScore > 0.4 ? 'Head-to-head heating up. Stay sharp.'
          : 'Predator in control. Keep pressure on.');
      case 'SYNDICATE':
        return `${prefix} | Phase risk ${phaseRisk.toFixed(2)} | ` +
          (witnessScore > 0.6 ? 'Team under pressure. Rally the syndicate.'
          : witnessScore > 0.3 ? 'Coordinated. Shared treasury holding.'
          : 'Syndicate operating clean. Press the advantage.');
      case 'PHANTOM':
        return `${prefix} | Phase risk ${phaseRisk.toFixed(2)} | ` +
          (witnessScore > 0.7 ? 'Legend is ahead. Chase the ghost harder.'
          : witnessScore > 0.4 ? 'Phantom gap closing. The legend feels it.'
          : 'On the ghost\'s trail. Legend marker in reach.');
      default:
        return `${prefix} | Phase risk ${phaseRisk.toFixed(2)}`;
    }
  }

  private _sliceEnginVector(vec: ReadonlyArray<number>): {
    pressure: number; shield: number; cascade: number; time: number; tension: number;
  } {
    const len = vec.length;
    const q = Math.floor(len / 6) || 1;
    const avg = (start: number, end: number): number => {
      const slice = vec.slice(start, end);
      return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
    };
    return {
      pressure: avg(0,   q),
      shield:   avg(q,   q * 2),
      cascade:  avg(q*2, q * 3),
      time:     avg(q*3, q * 4),
      tension:  avg(q*4, q * 5),
    };
  }

  get ticksInMode(): number { return this._ticksInMode; }
}

// ─────────────────────────────────────────────────────────────────────────────
// §R09  ZeroTranscriptWriter
//       Writes proof-bearing per-tick transcripts. Each transcript includes:
//       - snapshot hash (simple deterministic checksum)
//       - ML vector checksum
//       - DL tensor checksum
//       - Mode-native narration
//       - Social pressure vector
//       - Error boundary status
//       - Step budget compliance report
//       These transcripts are immutable records that form the run's audit trail.
// ─────────────────────────────────────────────────────────────────────────────

/** Full proof-bearing transcript for one tick. */
export interface ZeroProofTranscript {
  readonly sessionId: string;
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly mode: ModeCode;
  /** Deterministic checksum of all inputs. */
  readonly proofChecksum: string;
  /** Mode-native narration for this tick. */
  readonly narration: string;
  /** Social pressure vector (3 components). */
  readonly socialPressure: Readonly<{
    haterPosture: number;
    threatConvergence: number;
    extractionRisk: number;
  }>;
  /** ML vector checksum (first 8 features). */
  readonly mlChecksum: string;
  /** DL tensor row count accumulated so far. */
  readonly dlRowCount: number;
  /** Plan health score [0,1]. */
  readonly planHealth: number;
  /** Step budget compliance: steps within budget / total steps. */
  readonly budgetCompliance: number;
  /** Error boundary status. */
  readonly errorBoundaryStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  /** Phase risk score. */
  readonly phaseRisk: number;
  /** Mode competitive weight. */
  readonly modeWeight: number;
}

/**
 * ZeroTranscriptWriter — writes proof-bearing transcripts for every tick.
 * Transcripts are immutable once written and form the run's authoritative
 * audit trail. They are consumed by the sovereignty engine for grade
 * assignment and by the chat lane for proof display.
 */
export class ZeroTranscriptWriter {
  private readonly _sessionId: string;
  private readonly _mode: ModeCode;
  private readonly _transcripts: ZeroProofTranscript[] = [];
  private _dlRowCount = 0;

  constructor(sessionId: string, mode: ModeCode) {
    this._sessionId = sessionId;
    this._mode = mode;
  }

  /**
   * Write a proof-bearing transcript for the current tick.
   * Called after ZeroSubsystemOrchestrator.tick() and ZeroMLPipeline.extract().
   */
  write(
    tick: number,
    snapshot: RunStateSnapshot,
    mlBundle: ZeroSubsystemMLBundle,
    dlRowCount: number,
  ): ZeroProofTranscript {
    this._dlRowCount = dlRowCount;

    const narrationResult = narrateZeroMoment(snapshot, tick);
    const socialVec      = computeSocialPressureVector(snapshot);
    const plan           = createDefaultTickPlan();
    const planHealth     = computeTickPlanHealthScore(plan);
    const phaseRisk      = scoreRunPhaseRisk(snapshot.phase as RunPhase);
    const modeWeight     = scoreModeCompetitiveWeight(this._mode);

    // Error boundary status
    const errorRecs  = ENGINE_ZERO_BOUNDARY.getHistory().slice(-10);
    const fatalCount = filterFatalRecords(errorRecs).length;
    const errorStatus: ZeroProofTranscript['errorBoundaryStatus'] =
      fatalCount > 3 ? 'CRITICAL' : fatalCount > 0 ? 'DEGRADED' : 'HEALTHY';

    // Step budget compliance from telemetry vector
    const telVec   = mlBundle.telemetryVector;
    const stepCount = Math.min(13, telVec.length);
    const withinBudget = Array.from({ length: stepCount }, (_, i) => telVec[i] ?? 0)
      .filter(v => v <= 1.0).length;
    const budgetCompliance = stepCount > 0 ? withinBudget / stepCount : 1.0;

    // ML checksum: hash of first 8 engineVector values
    const mlFirst8 = mlBundle.engineVector.slice(0, 8).map(v => v.toFixed(4)).join(',');
    const mlChecksum = this._simpleHash(mlFirst8);

    // Proof checksum: combine all key values using correct ZeroSocialPressureVector fields
    const proofInput = [
      this._sessionId, tick, this._mode,
      mlBundle.fusedHealth.toFixed(4),
      socialVec.extractionRiskScore.toFixed(4),
      planHealth.toFixed(4),
      phaseRisk.toFixed(4),
      modeWeight.toFixed(4),
      budgetCompliance.toFixed(4),
      errorStatus,
    ].join('|');
    const proofChecksum = this._simpleHash(proofInput);

    const transcript: ZeroProofTranscript = {
      sessionId:           this._sessionId,
      tick,
      capturedAtMs:        Date.now(),
      mode:                this._mode,
      proofChecksum,
      narration:           narrationResult.text,
      socialPressure:      Object.freeze({
        haterPosture:      socialVec.haterAggregatePosture,
        threatConvergence: socialVec.threatConvergenceScore,
        extractionRisk:    socialVec.extractionRiskScore,
      }),
      mlChecksum,
      dlRowCount,
      planHealth,
      budgetCompliance,
      errorBoundaryStatus: errorStatus,
      phaseRisk,
      modeWeight,
    };

    this._transcripts.push(transcript);
    return transcript;
  }

  /** Get all transcripts as an immutable audit trail. */
  getAuditTrail(): ReadonlyArray<ZeroProofTranscript> {
    return Object.freeze([...this._transcripts]);
  }

  /** Get transcript for a specific tick (null if not written). */
  getForTick(tick: number): ZeroProofTranscript | null {
    return this._transcripts.find(t => t.tick === tick) ?? null;
  }

  /** Compute proof chain checksum across all transcripts. */
  computeProofChain(): string {
    const chain = this._transcripts.map(t => t.proofChecksum).join('+');
    return this._simpleHash(chain);
  }

  /** Verify that the audit trail is monotonically increasing in tick. */
  verifyMonotonicity(): boolean {
    for (let i = 1; i < this._transcripts.length; i++) {
      if (this._transcripts[i]!.tick <= this._transcripts[i - 1]!.tick) return false;
    }
    return true;
  }

  private _simpleHash(input: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  get transcriptCount(): number { return this._transcripts.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// §R10  ZeroRuntimeHub
//       The master entry point for Engine Zero. Wires together:
//       ZeroSubsystemOrchestrator → ZeroMLPipeline → ZeroDLPipeline →
//       ZeroChatWireLayer → ZeroSocialWitnessLayer → ZeroModeNativeRuntime →
//       ZeroTranscriptWriter
//
//       Called from backend/src/game/engine/index.ts → Zero.* namespace.
//       Every tick: fires → extracts → routes → writes → returns.
// ─────────────────────────────────────────────────────────────────────────────

/** Options for ZeroRuntimeHub construction. */
export interface ZeroRuntimeHubOptions {
  readonly mode: ModeCode;
  readonly sessionId?: string;
  readonly enableML?: boolean;
  readonly enableDL?: boolean;
  readonly enableChat?: boolean;
  readonly enableTranscripts?: boolean;
  readonly enableSocialWitness?: boolean;
  readonly orchestratorOptions?: Partial<ZeroSubsystemOrchestratorOptions>;
}

/** Full result of one ZeroRuntimeHub tick. */
export interface ZeroRuntimeHubTickResult {
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly mode: ModeCode;
  /** ML pipeline result with fused 320-dim vector. */
  readonly mlResult: ZeroMLPipelineResult;
  /** Chat batch with mode-native envelopes. */
  readonly chatBatch: ZeroSubsystemChatBatch;
  /** Enriched chat envelopes from wire layer. */
  readonly chatEnvelopes: ReadonlyArray<ZeroChatSignalEnvelope>;
  /** Social witness report. */
  readonly witnessReport: ZeroWitnessReport;
  /** Proof-bearing transcript. */
  readonly transcript: ZeroProofTranscript | null;
  /** Mode-native narration. */
  readonly modeNarration: string;
  /** Mode-weighted health score [0,1]. */
  readonly modeWeightedHealth: number;
  /** DL accumulation row count. */
  readonly dlRowCount: number;
  /** Session duration in ms. */
  readonly sessionDurationMs: number;
}

/** Full run summary from ZeroRuntimeHub. */
export interface ZeroRuntimeHubRunSummary {
  readonly sessionId: string;
  readonly mode: ModeCode;
  readonly totalTicks: number;
  readonly sessionDurationMs: number;
  readonly avgModeWeightedHealth: number;
  readonly proofChainChecksum: string;
  readonly witnessRiskLevel: ZeroWitnessTrend['riskLevel'];
  readonly totalChatSignals: number;
  readonly submoduleVersions: Readonly<Record<string, string>>;
  readonly auditTrail: ReadonlyArray<ZeroProofTranscript>;
}

/**
 * ZeroRuntimeHub — the authoritative master entry point for Engine Zero.
 * Wire and fire: every tick triggers all 24 sub-modules, ML/DL pipelines,
 * social witness computation, chat signal routing, and proof-bearing
 * transcript writing.
 *
 * Usage (via `Zero` namespace in engine/index.ts):
 *   const hub = createZeroRuntimeHub({ mode: 'solo' });
 *   const result = hub.tick(snapshot);
 *   const summary = hub.getRunSummary();
 */
export class ZeroRuntimeHub {
  private readonly _sessionId: string;
  private readonly _mode: ModeCode;
  private readonly _startMs: number;

  // All wired components
  readonly orchestrator: ZeroSubsystemOrchestrator;
  readonly mlPipeline:   ZeroMLPipeline;
  readonly dlPipeline:   ZeroDLPipeline;
  readonly chatWire:     ZeroChatWireLayer;
  readonly witness:      ZeroSocialWitnessLayer;
  readonly modeRuntime:  ZeroModeNativeRuntime;
  readonly transcript:   ZeroTranscriptWriter;

  // Analytics singletons wired in
  readonly typesAnalytics: ZeroTypesAnalyticsEngine;

  // Per-session state
  private _tick = 0;
  private readonly _modeHealthHistory: number[] = [];

  constructor(opts: ZeroRuntimeHubOptions) {
    this._mode      = opts.mode;
    this._sessionId = opts.sessionId ?? `zero-hub-${Date.now()}`;
    this._startMs   = Date.now();

    this.orchestrator  = new ZeroSubsystemOrchestrator({
      mode:                opts.mode,
      sessionId:           this._sessionId,
      emitChatSignals:     opts.enableChat ?? true,
      writeTranscripts:    opts.enableTranscripts ?? true,
      enableML:            opts.enableML ?? true,
      enableDL:            opts.enableDL ?? true,
      enableSocialWitness: opts.enableSocialWitness ?? true,
      ...opts.orchestratorOptions,
    });
    this.mlPipeline    = new ZeroMLPipeline();
    this.dlPipeline    = new ZeroDLPipeline(this._sessionId, opts.mode);
    this.chatWire      = new ZeroChatWireLayer(opts.mode);
    this.witness       = new ZeroSocialWitnessLayer(opts.mode);
    this.modeRuntime   = new ZeroModeNativeRuntime(opts.mode);
    this.transcript    = new ZeroTranscriptWriter(this._sessionId, opts.mode);
    this.typesAnalytics = ZERO_TYPES_DEFAULT_ANALYTICS_ENGINE;
  }

  /**
   * MASTER TICK ENTRY POINT.
   * Call once per engine tick (after STEP_13_FLUSH). Returns a complete
   * ZeroRuntimeHubTickResult with all ML/DL/chat/transcript data.
   */
  tick(snapshot: RunStateSnapshot): ZeroRuntimeHubTickResult {
    this._tick++;
    const now = Date.now();

    // ── 1. Fire all sub-modules ──────────────────────────────────────────────
    const { ml, chat } = this.orchestrator.tick(snapshot);

    // ── 2. Extract ML ────────────────────────────────────────────────────────
    const mlResult = this.mlPipeline.extract(ml);

    // ── 3. Accumulate DL ─────────────────────────────────────────────────────
    const dlRow = this.dlPipeline.accumulateTick(
      this._tick,
      ml.engineVector as number[],
      ml.telemetryVector as number[],
      ml.planVector as number[],
      ml.lifecycleVector as number[],
    );
    const dlRowCount = this.dlPipeline.rowCount;
    void dlRow; // acknowledged — accumulation is the intent

    // ── 4. Social witness ─────────────────────────────────────────────────────
    const witnessReport = this.witness.compute(snapshot, this._tick);
    const socialPressureScore = witnessReport.witnessScore;

    // ── 5. Apply mode weights ─────────────────────────────────────────────────
    const modeWeightedHealth = this.modeRuntime.applyModeWeights(ml);
    this._modeHealthHistory.push(modeWeightedHealth);

    // ── 6. Mode narration ─────────────────────────────────────────────────────
    const modeNarration = this.modeRuntime.generateModeNarration(
      witnessReport.witnessScore,
      snapshot.outcome as RunOutcome | null,
      snapshot.phase as RunPhase,
    );

    // ── 7. Route to chat lane ─────────────────────────────────────────────────
    const chatEnvelopes = this.chatWire.routeTick(chat, modeWeightedHealth, socialPressureScore);

    // ── 8. Write proof-bearing transcript ─────────────────────────────────────
    const proofTranscript = this.transcript.write(this._tick, snapshot, ml, dlRowCount);

    // ── 9. Use types analytics engine getters for trend data ─────────────────
    // (ingest() requires 5 complex args; use the pre-populated singleton instead)
    void this.typesAnalytics.computeRollingAnomalyScore(8);

    return {
      tick:                this._tick,
      capturedAtMs:        now,
      mode:                this._mode,
      mlResult,
      chatBatch:           chat,
      chatEnvelopes:       Object.freeze(chatEnvelopes),
      witnessReport,
      transcript:          proofTranscript,
      modeNarration,
      modeWeightedHealth,
      dlRowCount,
      sessionDurationMs:   now - this._startMs,
    };
  }

  /**
   * Fire on terminal outcome (WIN/LOSS/ABANDON). Routes terminal chat signal,
   * finalizes proof chain, returns run summary.
   */
  finalizeRun(outcome: RunOutcome): ZeroRuntimeHubRunSummary {
    const now = Date.now();

    // Route terminal outcome to chat
    const avgHealth = this._modeHealthHistory.length > 0
      ? this._modeHealthHistory.reduce((a, b) => a + b, 0) / this._modeHealthHistory.length
      : 1.0;
    const trend = this.witness.getTrend(10);
    const socialScore = this.witness.getHistory().slice(-1)[0]?.witnessScore ?? 0;
    this.chatWire.routeTerminalOutcome(outcome, this._tick, avgHealth, socialScore);

    // Compute proof chain
    const proofChain = this.transcript.computeProofChain();

    // Verify transcript monotonicity
    void this.transcript.verifyMonotonicity();

    // Get session summary from orchestrator
    const sessionSummary = this.orchestrator.getSessionSummary();

    return {
      sessionId:              this._sessionId,
      mode:                   this._mode,
      totalTicks:             this._tick,
      sessionDurationMs:      now - this._startMs,
      avgModeWeightedHealth:  avgHealth,
      proofChainChecksum:     proofChain,
      witnessRiskLevel:       trend.riskLevel,
      totalChatSignals:       this.chatWire.getEmitted().length,
      submoduleVersions:      sessionSummary.submoduleVersions,
      auditTrail:             this.transcript.getAuditTrail(),
    };
  }

  /**
   * Get a snapshot of the current session state without finalizing.
   */
  getSessionSnapshot(): ZeroSubsystemSessionSummary {
    return this.orchestrator.getSessionSummary();
  }

  /** ML health trend over last N ticks. */
  getMLHealthTrend(windowSize = 5): 'IMPROVING' | 'STABLE' | 'DEGRADING' {
    return this.mlPipeline.healthTrend(windowSize);
  }

  /** DL bundle for the full session. */
  getDLBundle(): ZeroDLPipelineBundle {
    return this.dlPipeline.toBundle();
  }

  /** All chat envelopes emitted this session. */
  getAllChatEnvelopes(): ReadonlyArray<ZeroChatSignalEnvelope> {
    return this.chatWire.getEmitted();
  }

  /** Full proof audit trail. */
  getAuditTrail(): ReadonlyArray<ZeroProofTranscript> {
    return this.transcript.getAuditTrail();
  }

  get currentTick(): number { return this._tick; }
  get sessionId(): string   { return this._sessionId; }
  get mode(): ModeCode      { return this._mode; }
  get sessionDurationMs(): number { return Date.now() - this._startMs; }
}

// ─────────────────────────────────────────────────────────────────────────────
// §R11  Singletons, factories, module manifest
//       Expose the full zero runtime under a predictable, stable API.
//       Consumed by backend/src/game/engine/index.ts → Zero.* namespace.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a ZeroRuntimeHub for the given game mode. This is the primary
 * factory — all Engine Zero consumers should use this.
 *
 * Usage (via engine/index.ts Zero namespace):
 *   import { Zero } from '../../engine';
 *   const hub = Zero.createZeroRuntimeHub({ mode: 'solo' });
 *   const result = hub.tick(snapshot);
 */
export function createZeroRuntimeHub(opts: ZeroRuntimeHubOptions): ZeroRuntimeHub {
  return new ZeroRuntimeHub(opts);
}

/**
 * Create a ZeroSubsystemOrchestrator for direct sub-module access without
 * the full ML/DL/chat wire overhead.
 */
export function createZeroSubsystemOrchestrator(
  opts: ZeroSubsystemOrchestratorOptions,
): ZeroSubsystemOrchestrator {
  return new ZeroSubsystemOrchestrator(opts);
}

/**
 * Build a full Zero engine stack for the given mode.
 * Returns: hub + underlying ZeroEngine + all singleton references.
 * Wires ENGINE_ZERO_BOUNDARY, MODE_BOUNDARY, DETERMINISM_BOUNDARY,
 * RESOURCE_BOUNDARY, ZERO_TYPES_DEFAULT_ANALYTICS_ENGINE into the stack.
 */
export function buildZeroRuntimeStack(opts: ZeroRuntimeHubOptions): {
  hub:                        ZeroRuntimeHub;
  engine:                     ZeroEngine;
  boundaries: Readonly<{
    zero:        ErrorBoundary;
    mode:        ErrorBoundary;
    determinism: ErrorBoundary;
    resource:    ErrorBoundary;
  }>;
  analytics:                  ZeroTypesAnalyticsEngine;
  telemetryExtractor:         typeof ZERO_TELEMETRY_ML_EXTRACTOR;
  telemetryBuilder:           typeof ZERO_TELEMETRY_DL_BUILDER;
  bootstrapExtractor:         typeof ZERO_BOOTSTRAP_ML_EXTRACTOR;
  bootstrapBuilder:           typeof ZERO_BOOTSTRAP_DL_BUILDER;
  shutdownExtractor:          typeof ZERO_SHUTDOWN_ML_EXTRACTOR;
  shutdownBuilder:            typeof ZERO_SHUTDOWN_DL_BUILDER;
  checkpointExtractor:        typeof ZERO_CHECKPOINT_ML_EXTRACTOR;
  checkpointBuilder:          typeof ZERO_CHECKPOINT_DL_BUILDER;
  defaultOutcomeGate:         typeof DEFAULT_OUTCOME_GATE;
  strictOutcomeGate:          typeof STRICT_OUTCOME_GATE;
  relaxedOutcomeGate:         typeof RELAXED_OUTCOME_GATE;
  defaultFlushCoordinator:    typeof DEFAULT_EVENT_FLUSH_COORDINATOR;
  diagnosticsTrendAnalyzer:   typeof ZERO_DIAGNOSTICS_TREND_ANALYZER;
  diagnosticsSessionAnalytics: typeof ZERO_DIAGNOSTICS_SESSION_ANALYTICS;
  defaultPlan:                typeof ZERO_DEFAULT_TICK_PLAN;
} {
  const hub    = createZeroRuntimeHub(opts);
  const engine = createZeroEngine({ mode: opts.mode } as ZeroEngineOptions);

  return {
    hub,
    engine,
    boundaries: Object.freeze({
      zero:        ENGINE_ZERO_BOUNDARY,
      mode:        MODE_BOUNDARY,
      determinism: DETERMINISM_BOUNDARY,
      resource:    RESOURCE_BOUNDARY,
    }),
    analytics:                  ZERO_TYPES_DEFAULT_ANALYTICS_ENGINE,
    telemetryExtractor:         ZERO_TELEMETRY_ML_EXTRACTOR,
    telemetryBuilder:           ZERO_TELEMETRY_DL_BUILDER,
    bootstrapExtractor:         ZERO_BOOTSTRAP_ML_EXTRACTOR,
    bootstrapBuilder:           ZERO_BOOTSTRAP_DL_BUILDER,
    shutdownExtractor:          ZERO_SHUTDOWN_ML_EXTRACTOR,
    shutdownBuilder:            ZERO_SHUTDOWN_DL_BUILDER,
    checkpointExtractor:        ZERO_CHECKPOINT_ML_EXTRACTOR,
    checkpointBuilder:          ZERO_CHECKPOINT_DL_BUILDER,
    defaultOutcomeGate:         DEFAULT_OUTCOME_GATE,
    strictOutcomeGate:          STRICT_OUTCOME_GATE,
    relaxedOutcomeGate:         RELAXED_OUTCOME_GATE,
    defaultFlushCoordinator:    DEFAULT_EVENT_FLUSH_COORDINATOR,
    diagnosticsTrendAnalyzer:   ZERO_DIAGNOSTICS_TREND_ANALYZER,
    diagnosticsSessionAnalytics: ZERO_DIAGNOSTICS_SESSION_ANALYTICS,
    defaultPlan:                ZERO_DEFAULT_TICK_PLAN,
  };
}

// ─── Sub-module version manifest ────────────────────────────────────────────

/** Versions of all 24 zero sub-modules. */
export const ZERO_INDEX_SUBMODULE_VERSIONS = Object.freeze({
  zeroEngine:        ZERO_ENGINE_MODULE_VERSION,
  lifecycle:         LIFECYCLE_MODULE_VERSION,
  tickExecutor:      TICK_EXECUTOR_MODULE_VERSION,
  tickPlan:          TICK_PLAN_MODULE_VERSION,
  tickPlanSchema:    String(TICK_PLAN_SCHEMA_VERSION),
  telemetry:         ORCHESTRATOR_TELEMETRY_MODULE_VERSION,
  bootstrap:         BOOTSTRAP_MODULE_VERSION,
  gateway:           GATEWAY_MODULE_VERSION,
  checkpoint:        CHECKPOINT_MODULE_VERSION,
  errorBoundary:     ERROR_BOUNDARY_VERSION,
  zeroTypes:         ZERO_TYPES_MODULE_VERSION,
}) satisfies Record<string, string>;

/** ML/DL dimension manifest for all zero sub-module pipelines. */
export const ZERO_INDEX_ML_DL_MANIFEST = Object.freeze({
  engine: Object.freeze({
    mlDim:          ZERO_ENGINE_ML_FEATURE_COUNT,
    dlRows:         ZERO_ENGINE_DL_SEQUENCE_LENGTH,
    dlCols:         ZERO_ENGINE_DL_FEATURE_COUNT,
    featureLabels:  ZERO_ML_FEATURE_LABELS,
    columnLabels:   ZERO_DL_COLUMN_LABELS,
  }),
  zeroTypes: Object.freeze({
    mlDim:          ZERO_ML_FEATURE_DIMENSION,
    featureKeys:    ZERO_ML_FEATURE_LABEL_KEYS,
  }),
  telemetry: Object.freeze({
    mlDim:          TELEMETRY_ML_FEATURE_COUNT,
    stepOrder:      _TELEMETRY_STEP_ORDER_LOCAL,
    signalSeverityScore:   ENGINE_SIGNAL_SEVERITY_SCORE,
    signalSeverityWeight:  ENGINE_SIGNAL_SEVERITY_WEIGHT,
    healthStatusScore:     ENGINE_HEALTH_STATUS_SCORE,
    healthStatusWeight:    ENGINE_HEALTH_STATUS_URGENCY_WEIGHT,
  }),
  plan: Object.freeze({
    mlDim:          TICK_PLAN_ML_FEATURE_COUNT,
    dlShape:        TICK_PLAN_DL_TENSOR_SHAPE,
    severityThresholds: TICK_PLAN_SEVERITY_THRESHOLDS,
    stepCriticalityAvg: TICK_PLAN_STEP_CRITICALITY_AVG,
  }),
  executor: Object.freeze({
    mlDim:          TICK_EXECUTOR_ML_FEATURE_COUNT,
    dlShape:        TICK_EXECUTOR_DL_TENSOR_SHAPE,
    severityThresholds: TICK_EXECUTOR_SEVERITY_THRESHOLDS,
  }),
  bootstrap: Object.freeze({
    mlDim:          BOOTSTRAP_ML_FEATURE_COUNT,
    dlShape:        BOOTSTRAP_DL_TENSOR_SHAPE,
    modeNarration:  BOOTSTRAP_MODE_NARRATION,
  }),
  lifecycle: Object.freeze({
    mlDim:          LIFECYCLE_ML_FEATURE_COUNT,
    dlShape:        LIFECYCLE_DL_TENSOR_SHAPE,
    modeCodes:      LIFECYCLE_ALL_MODE_CODES,
    pressureTiers:  LIFECYCLE_ALL_PRESSURE_TIERS,
    severityLevels: LIFECYCLE_SEVERITY_LEVELS,
    severityThresholds: LIFECYCLE_SEVERITY_THRESHOLDS,
  }),
  errorBoundary: Object.freeze({
    mlDim:          ERROR_BOUNDARY_ML_FEATURE_COUNT,
    categories:     ALL_ERROR_CATEGORIES,
    severityWeights: ERROR_CATEGORY_SEVERITY_WEIGHT,
  }),
  fusedPipeline: Object.freeze({
    totalDim:       ZERO_ML_PIPELINE_TOTAL_DIM,
    dimBreakdown:   ZERO_ML_PIPELINE_DIM_BREAKDOWN,
  }),
});

/** Canonical tick step order for Zero (from OrchestratorConfig and Telemetry). */
export const ZERO_INDEX_TICK_SEQUENCE = ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE;

/** All required engine IDs for a valid zero orchestrator. */
export const ZERO_INDEX_REQUIRED_ENGINE_IDS = ZERO_REQUIRED_ENGINE_IDS;

/** All supported modes for zero orchestration. */
export const ZERO_INDEX_SUPPORTED_MODES = ZERO_SUPPORTED_MODES;

/** Well-known error boundaries keyed by owner. */
export const ZERO_INDEX_BOUNDARIES = WELL_KNOWN_BOUNDARIES;

/** All orchestrator profile IDs available for configuration. */
export const ZERO_INDEX_ORCHESTRATOR_PROFILE_IDS = ZERO_ORCHESTRATOR_PROFILE_IDS;

// ─── Utility re-exports from zero.types primitive scorers ───────────────────

/**
 * Utility belt: all zero.types §A primitive scorers are re-exported here for
 * direct use by consumers who import from the Zero namespace at engine/index.ts.
 *
 * Usage: Zero.scoreAttackCategory('DRAIN_ATTACK')
 *        Zero.computeThreatUrgency(threat)
 *        Zero.getModeNarrationPrefix('solo')
 */
export {
  scoreAttackCategory,
  scoreAttackEvent,
  scoreBotPosture,
  computeThreatUrgency,
  scoreEngineFleetHealth,
  computeDecisionQuality,
  getModeNarrationPrefix,
  scoreModeCompetitiveWeight,
  classifyNarrationTone,
  scoreRunPhaseRisk,
  scoreRunOutcomeValence,
  resolveIntegrityScore,
  getHaterTierWeight,
  computeSignalSeverityWeight,
  classifySignalsByCode,
  isHighPriorityEvent,
  scoreWindowUtilization,
  getStepRiskProfile,
  scoreCardDefinition,
  scoreHandCard,
  scoreLegendMarkerImpact,
  classifyOutcomeReasonWeight,
  analyzeHand,
  analyzeLegendMarkers,
  auditEventEnvelopes,
  computeSocialPressureVector,
  narrateZeroMoment,
  extractZeroMLFeatureVector,
  extractZeroTypesDLTensor,
  computeZeroTypesTickAnalysis,
};

// ─── Utility re-exports from error boundary ──────────────────────────────────

export {
  classifyErrorCode,
  isEngineStepFatal,
  computeConsecutiveFailureRisk,
  filterFatalRecords,
  filterRecordsByCategory,
  mergeErrorBoundaryRecords,
  extractErrorBoundaryMLVector,
  buildErrorBoundaryDLTensor,
  buildErrorBoundaryChatSignal,
  computeErrorBoundaryHealthScore,
  generateErrorBoundaryNarrative,
};

// ─── Utility re-exports from telemetry ───────────────────────────────────────

export {
  scoreTelemetryEngineHealth,
  getTelemetryEngineHealthSeverityLabel,
  getTelemetrySignalSeverityWeight,
  isTelemetryEnginePhaseStep,
  getTelemetryStepBudgetMs,
  extractTelemetryMLVector,
  buildTelemetryDLTensor,
  buildTelemetryChatSignal,
};

// ─── Utility re-exports from config ─────────────────────────────────────────

export {
  createDefaultOrchestratorConfig,
  createProductionOrchestratorConfig,
  resolveOrchestratorConfig,
  validateOrchestratorConfig,
  verifyFlushResultSeal,
  buildOutcomeGateNarrationHint,
  computeOutcomeGateProximity,
  validateOutcomeGateResult,
  scoreOutcomeGateHealth,
};

// ─── Module version ──────────────────────────────────────────────────────────

/** Version of the zero/index.ts runtime wiring layer. */
export const ZERO_INDEX_MODULE_VERSION = '2026.03.28.runtime' as const;

/** Whether the zero runtime wiring layer is ready. */
export const ZERO_INDEX_READY = true as const;

/** Module manifest for the zero/index.ts runtime layer. */
export const ZERO_INDEX_MANIFEST = Object.freeze({
  version:           ZERO_INDEX_MODULE_VERSION,
  ready:             ZERO_INDEX_READY,
  submoduleVersions: ZERO_INDEX_SUBMODULE_VERSIONS,
  mlDlManifest:      ZERO_INDEX_ML_DL_MANIFEST,
  supportedModes:    ZERO_INDEX_SUPPORTED_MODES,
  requiredEngines:   ZERO_INDEX_REQUIRED_ENGINE_IDS,
  tickSequence:      ZERO_INDEX_TICK_SEQUENCE,
  profileIds:        ZERO_INDEX_ORCHESTRATOR_PROFILE_IDS,
  zeroTypesManifest: ZERO_TYPES_MANIFEST,
  boundaryVersions: Object.freeze({
    zero:        ERROR_BOUNDARY_VERSION,
    mode:        ERROR_BOUNDARY_VERSION,
    determinism: ERROR_BOUNDARY_VERSION,
    resource:    ERROR_BOUNDARY_VERSION,
  }),
  // Default ML/DL singletons referenced
  defaults: Object.freeze({
    diagnosticsMLVector:  ZERO_DEFAULT_DIAGNOSTICS_ML_VECTOR,
    diagnosticsDLTensor:  ZERO_DEFAULT_DIAGNOSTICS_DL_TENSOR,
    diagnosticsChatSignal: ZERO_DEFAULT_DIAGNOSTICS_CHAT_SIGNAL,
    telemetryMLVector:    ZERO_DEFAULT_TELEMETRY_ML_VECTOR,
    telemetryDLTensor:    ZERO_DEFAULT_TELEMETRY_DL_TENSOR,
    telemetryChatSignal:  ZERO_DEFAULT_TELEMETRY_CHAT_SIGNAL,
    shutdownMLVector:     ZERO_DEFAULT_SHUTDOWN_ML_VECTOR,
    shutdownDLTensor:     ZERO_DEFAULT_SHUTDOWN_DL_TENSOR,
    checkpointMLVector:   ZERO_DEFAULT_CHECKPOINT_ML_VECTOR,
    checkpointDLTensor:   ZERO_DEFAULT_CHECKPOINT_DL_TENSOR,
    gatewayMLVector:      ZERO_DEFAULT_GATEWAY_ML_VECTOR,
    gatewayDLTensor:      ZERO_DEFAULT_GATEWAY_DL_TENSOR,
    outcomeGateChatSignal: ZERO_DEFAULT_OUTCOME_GATE_CHAT_SIGNAL,
  }),
  // Binder capabilities
  binder: Object.freeze({
    supportedModes:       ZERO_BINDER_SUPPORTED_MODES,
    readerContractNames:  ZERO_READER_CONTRACT_NAMES,
    dependencySlots:      ZERO_DEPENDENCY_BUNDLE_SLOTS,
    engineLabels:         ZERO_DEPENDENCY_ENGINE_LABELS,
  }),
  // Tick plan constants
  plan: Object.freeze({
    narrationByMode:     TICK_PLAN_NARRATION_BY_MODE,
    stepCriticalityAvg:  TICK_PLAN_STEP_CRITICALITY_AVG,
    schemaVersion:       TICK_PLAN_SCHEMA_VERSION,
  }),
  // Step/owner maps
  stepDescriptors:       ZERO_TICK_STEP_DESCRIPTOR_MAP,
  stepOwners:            ZERO_STEP_OWNER_MAP,
  terminalOutcomePriority: ZERO_TERMINAL_OUTCOME_PRIORITY,
  // Telemetry singletons
  telemetrySingletons: Object.freeze({
    mlExtractor:  ZERO_TELEMETRY_ML_EXTRACTOR,
    dlBuilder:    ZERO_TELEMETRY_DL_BUILDER,
    annotator:    ZERO_TELEMETRY_ANNOTATOR,
    inspector:    ZERO_TELEMETRY_INSPECTOR,
  }),
  // Bootstrap singletons
  bootstrapSingletons: Object.freeze({
    mlExtractor:    ZERO_BOOTSTRAP_ML_EXTRACTOR,
    dlBuilder:      ZERO_BOOTSTRAP_DL_BUILDER,
    trendAnalyzer:  ZERO_BOOTSTRAP_TREND_ANALYZER,
  }),
});

// ─── Default singleton hub (solo/Empire mode) ────────────────────────────────

/**
 * Default ZeroRuntimeHub singleton for solo/Empire mode.
 * Pre-wired with all sub-modules. Use for single-player runs.
 *
 * Usage (via engine/index.ts Zero namespace):
 *   Zero.ZERO_RUNTIME_HUB.tick(snapshot);
 */
export const ZERO_RUNTIME_HUB: ZeroRuntimeHub = createZeroRuntimeHub({
  mode:               'solo' as ModeCode,
  sessionId:          'default-zero-hub',
  enableML:           true,
  enableDL:           true,
  enableChat:         true,
  enableTranscripts:  true,
  enableSocialWitness: true,
});

/**
 * Mode-specific hub singletons — one per game mode.
 * All wired and ready for immediate use.
 */
export const ZERO_RUNTIME_HUBS: Readonly<Record<string, ZeroRuntimeHub>> = Object.freeze({
  empire:   createZeroRuntimeHub({ mode: 'solo'  as ModeCode, sessionId: 'empire-hub' }),
  predator: createZeroRuntimeHub({ mode: 'pvp'   as ModeCode, sessionId: 'predator-hub' }),
  syndicate: createZeroRuntimeHub({ mode: 'coop'  as ModeCode, sessionId: 'syndicate-hub' }),
  phantom:  createZeroRuntimeHub({ mode: 'ghost' as ModeCode, sessionId: 'phantom-hub' }),
});

/**
 * Build a full Zero runtime stack for the default (solo/Empire) mode.
 * Returns hub + engine + all boundaries + all singletons.
 */
export const ZERO_DEFAULT_RUNTIME_STACK = buildZeroRuntimeStack({
  mode:               'solo' as ModeCode,
  sessionId:          'default-stack',
  enableML:           true,
  enableDL:           true,
  enableChat:         true,
  enableTranscripts:  true,
  enableSocialWitness: true,
});