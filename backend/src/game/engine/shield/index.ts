/*
 * POINT ZERO ONE — BACKEND SHIELD SUBSYSTEM BARREL
 * /backend/src/game/engine/shield/index.ts
 * VERSION: 2026.03.25-v2
 *
 * Doctrine:
 * - authoritative barrel for the full shield subsystem
 * - every symbol exported here is consumed by chat adapters, ML pipelines,
 *   the engine orchestrator, or the engine index
 * - no circular imports — this file imports from leaf modules only
 * - the engine/index.ts exports this barrel under the Shield namespace
 *
 * Consumers:
 *   import { Shield } from '../../engine';
 *   const router = new Shield.AttackRouter();
 *   const resolver = new Shield.BreachCascadeResolver();
 *   const ensemble = Shield.createBreachCascadeResolverWithAnalytics();
 *   const modeProfile = Shield.buildAttackRouterModeProfile('ghost');
 *   const report = Shield.buildShieldHealthReport(layers);
 *   const bridge = new Shield.ShieldUXBridge();
 */

// ── Attack Router ─────────────────────────────────────────────────────────────
export {
  AttackRouter,
  AttackRouterMLExtractor,
  AttackRouterDLBuilder,
  AttackRouterTrendAnalyzer,
  AttackRouterAnnotator,
  AttackRouterInspector,
  AttackRouterAnalytics,
  createAttackRouterWithAnalytics,
  getAttackChatChannel,
  buildAttackNarrativeWeight,
  scoreAttackBatchRisk,
  extractAttackRouterMLArray,
  describeRoutingDecision,
  buildAttackRouterSessionReport,
  buildAttackRouterModeProfile,
  buildAttackRouterPhaseProfile,
  computePreRoutingThreatExposure,
  validateAttackBatchUniqueness,
  computeBatchDoctrineCoherence,
  computeBotStateThreatPressure,
  buildPreRoutingAttackProfile,
  computeThreateningDoctrineExposure,
  computeCascadeGateExposure,
  scoreEnvelopeThreatBatch,
  classifyThreatBatch,
  computeLayerIncomingDamage,
  computeTicksUntilLayerBreach,
  computeCounterableRatio,
  computeBatchBotThreatScore,
  scoreCategoryMagnitude,
  buildLayerAttackPressureMap,
  computePerLayerBreachRisk,
  normalizeBatchSize,
  mapLayersForIntegrity,
  scoreL4RouteRisk,
  computeDoctrineConfidence,
  computeDoctrineEntropy,
  findDominantDoctrine,
  buildDoctrineBreakdown,
  buildTargetLayerBreakdown,
  buildSeverityBreakdown,
  extractAttackRouterMLFeatures,
  buildAttackRouterDLRow,
  buildAttackRouterTrendSummary,
  buildAttackRouterAnnotation,
  buildAttackRouterUXHint,
  buildAttackRouterHistoryEntry,
  // Module constants
  ATTACK_ROUTER_MODULE_VERSION,
  ATTACK_ROUTER_ML_FEATURE_COUNT,
  ATTACK_ROUTER_DL_FEATURE_COUNT,
  ATTACK_ROUTER_DL_SEQUENCE_LENGTH,
  ATTACK_ROUTER_HISTORY_DEPTH,
  ATTACK_ROUTER_TREND_WINDOW,
  ATTACK_ROUTER_MAX_BATCH_SIZE,
  ATTACK_ROUTER_GHOST_HATER_AMPLIFY,
  ATTACK_ROUTER_SOVEREIGNTY_L4_RISK,
  ATTACK_ROUTER_DOCTRINE_CONFIDENCE_THRESHOLD,
  ATTACK_ROUTER_EXPOSED_VULNERABILITY_THRESHOLD,
  ATTACK_ROUTER_MANIFEST,
  ATTACK_ROUTER_ML_FEATURE_LABELS,
  ATTACK_ROUTER_DL_FEATURE_LABELS,
  ATTACK_ROUTER_MODE_PRIORITY_WEIGHT,
  ATTACK_ROUTER_PHASE_ESCALATION_FACTOR,
  ATTACK_ROUTER_GHOST_DUAL_TARGET,
  ATTACK_ROUTER_PHASE_HINT_ELIGIBLE,
  ATTACK_ROUTER_MODE_MAX_BATCH,
  ATTACK_DOCTRINE_DANGER_INDEX,
  ATTACK_DOCTRINE_IS_CASCADE_RISK,
  ATTACK_ROUTER_PRESSURE_TIER_URGENCY,
} from './AttackRouter';

export type {
  AttackRouteDecision,
  AttackRouterBatchResult,
  AttackRouterMLVector,
  AttackRouterDLTensor,
  AttackRouterTrendSummary,
  AttackRouterAnnotationBundle,
  AttackRouterUXHint,
  AttackRouterHistoryEntry,
  AttackRouterInspectorState,
  AttackRouterAnalyticsSummary,
  AttackRouterEnsemble,
  AttackRouterMLFeaturesParams,
  AttackRouterDLRowParams,
  AttackRouterSessionReport,
  AttackRouterModeProfile,
  AttackRouterPhaseProfile,
  PreRoutingAttackProfile,
} from './AttackRouter';

// ── Breach Cascade Resolver ───────────────────────────────────────────────────
export {
  BreachCascadeResolver,
  CascadeMLExtractor,
  CascadeDLBuilder,
  CascadeTrendAnalyzer,
  CascadeAnnotator,
  CascadeInspector,
  CascadeAnalytics,
  createBreachCascadeResolverWithAnalytics,
  getCascadeChatChannel,
  buildCascadeNarrativeWeight,
  extractCascadeMLArray,
  describeCascadeContext,
  buildCascadeSessionReport,
  buildCascadeModeProfile,
  buildCascadePhaseProfile,
  validateCascadeLayerState,
  gradeCascadeRisk,
  computeCascadeNarrativeImpact,
  mapCascadeLayersForIntegrity,
  computeL4CascadeImminentScore,
  computeGhostL3CascadeImminentScore,
  computeCrackMultiplier,
  scoreCascadeRisk,
  detectCascadeSurge,
  computeAvgIntegrityDrop,
  computeAvgCrackDepth,
  findDominantBreachLayer,
  computeCascadeBotThreatWeight,
  buildCascadeVulnerabilities,
  extractCascadeMLFeatures,
  buildCascadeDLRow,
  buildCascadeTrendSummary,
  buildCascadeAnnotation,
  buildCascadeUXHint,
  buildCascadeHistoryEntry,
  buildCascadeAttackImpactProfiles,
  scoreCascadeThreatFromEnvelopes,
  classifyCascadeThreatBatch,
  computePerLayerCascadeExposure,
  computeTicksUntilCascade,
  computeCascadeChainIntegrityRatio,
  computeSovereigntyFatalityRisk,
  scoreCascadeFromBotStates,
  computeAbsorptionOrderExposure,
  computeLayerCascadePriority,
  // Module constants
  BREACH_CASCADE_MODULE_VERSION,
  CASCADE_ML_FEATURE_COUNT,
  CASCADE_DL_FEATURE_COUNT,
  CASCADE_DL_SEQUENCE_LENGTH,
  CASCADE_HISTORY_DEPTH,
  CASCADE_TREND_WINDOW,
  CASCADE_SURGE_THRESHOLD,
  CASCADE_GHOST_L3_ENABLED,
  CASCADE_SOVEREIGNTY_L4_FATAL,
  CASCADE_SOVEREIGNTY_CRACK_MULTIPLIER,
  CASCADE_GHOST_CRACK_MULTIPLIER,
  CASCADE_IMMINENT_L4_THRESHOLD,
  CASCADE_GHOST_L3_IMMINENT_THRESHOLD,
  BREACH_CASCADE_MANIFEST,
  CASCADE_ML_FEATURE_LABELS,
  CASCADE_DL_FEATURE_LABELS,
  CASCADE_MODE_SENSITIVITY,
  CASCADE_PHASE_RISK_FACTOR,
  CASCADE_GHOST_ECHO_ELIGIBLE,
  CASCADE_SOVEREIGNTY_FATAL_ELIGIBLE,
  CASCADE_MODE_COUNT_WEIGHT,
  CASCADE_TEMPLATE_BY_LAYER,
  CASCADE_BREACH_CONSEQUENCE_LABEL,
  CASCADE_LAYER_DANGER_INDEX,
  CASCADE_PRESSURE_TIER_WEIGHT,
  CASCADE_DOCTRINE_TARGET_LAYER,
} from './BreachCascadeResolver';

export type {
  CascadeResolutionContext,
  CascadeMLVector,
  CascadeDLTensor,
  CascadeTrendSummary,
  CascadeAnnotationBundle,
  CascadeUXHint,
  CascadeHistoryEntry,
  CascadeInspectorState,
  CascadeAnalyticsSummary,
  CascadeEnsemble,
  CascadeMLFeaturesParams,
  CascadeDLRowParams,
  CascadeSessionReport,
  CascadeModeProfile,
  CascadePhaseProfile,
  CascadeAttackImpactProfile,
} from './BreachCascadeResolver';

// ── Shield Layer Manager ──────────────────────────────────────────────────────
export {
  ShieldLayerManager,
  ShieldLayerManagerMLExtractor,
  ShieldLayerManagerDLBuilder,
  ShieldLayerManagerTrendAnalyzer,
  ShieldLayerManagerResilienceForecaster,
  ShieldLayerManagerAnnotator,
  ShieldLayerManagerInspector,
  ShieldLayerManagerAnalytics,
  createShieldLayerManagerWithAnalytics,
  buildShieldLayerManagerSessionReport,
  buildLayerManagerThresholdReport,
  buildLayerManagerMLCompat,
  // Pure helpers
  buildLayerVulnerabilityMap,
  computeWeightedIntegrity,
  computeNormalizedRegenCapacity,
  findCriticalLayerIds,
  findLowIntegrityLayerIds,
  getAbsorptionPriority,
  scoreOverallBreachRisk,
  classifyBreachRisk,
  getLayerManagerChatChannel,
  buildLayerManagerUXHeadline,
  buildRecommendedAction,
  scoreRepairUrgency,
  classifyIncomingAttackSeverity,
  classifyMostUrgentThreat,
  computeLayerBotThreatScore,
  computeModeTensionFloor,
  computeRegenMultiplier,
  computeBreachSensitivity,
  buildLayerConfigMap,
  inferDoctrineFromRoutedAttack,
  buildLayerIntegrityLabel,
  buildLayerManagerNarrativeWeight,
  computeLayerPressureRiskScore,
  extractMLArray,
  validateMLArrayLength,
  validateDLRowLength,
  describeLayerManagerState,
  // Module constants
  SHIELD_LAYER_MANAGER_MODULE_VERSION,
  SHIELD_LAYER_MANAGER_READY,
  SHIELD_LAYER_MANAGER_ML_FEATURE_COUNT,
  SHIELD_LAYER_MANAGER_DL_FEATURE_COUNT,
  SHIELD_LAYER_MANAGER_DL_SEQUENCE_LENGTH,
  SHIELD_LAYER_MANAGER_HISTORY_DEPTH,
  SHIELD_LAYER_MANAGER_TREND_WINDOW,
  SHIELD_LAYER_MANAGER_FORECAST_LOW_THRESHOLD,
  SHIELD_LAYER_MANAGER_FORECAST_CRITICAL_THRESHOLD,
  SHIELD_LAYER_MANAGER_FORECAST_MAX_HORIZON,
  SHIELD_LAYER_MANAGER_STABLE_THRESHOLD,
  SHIELD_LAYER_MANAGER_HIGH_DAMAGE_THRESHOLD,
  SHIELD_LAYER_MANAGER_HIGH_REPAIR_THRESHOLD,
  SHIELD_LAYER_MANAGER_BREACH_HISTORY_DEPTH,
  SHIELD_LAYER_MANAGER_ML_FEATURE_LABELS,
  SHIELD_LAYER_MANAGER_DL_FEATURE_LABELS,
  SHIELD_LAYER_MANAGER_MANIFEST,
} from './ShieldLayerManager';

export type {
  ShieldLayerManagerMLVector,
  ShieldLayerManagerDLRow,
  ShieldLayerManagerDLTensor,
  ShieldLayerManagerLayerTrend,
  ShieldLayerManagerTrendSummary,
  ShieldLayerManagerLayerForecast,
  ShieldLayerManagerResilienceForecast,
  ShieldLayerManagerBreachAnnotation,
  ShieldLayerManagerAnnotationBundle,
  ShieldLayerManagerUXHint,
  ShieldLayerManagerHistoryEntry,
  ShieldLayerManagerInspectorState,
  ShieldLayerManagerAnalyticsSummary,
  ShieldLayerManagerEnsemble,
  ShieldLayerManagerMLParams,
  ShieldLayerManagerDLRowParams,
  ShieldLayerManagerSessionReport,
} from './ShieldLayerManager';

// ── Shield Repair Queue ───────────────────────────────────────────────────────
export {
  ShieldRepairQueue,
  ShieldRepairQueueMLExtractor,
  ShieldRepairQueueDLBuilder,
  ShieldRepairQueueTrendAnalyzer,
  ShieldRepairQueueForecaster,
  ShieldRepairQueueAnnotator,
  ShieldRepairQueueInspector,
  ShieldRepairQueueAnalytics,
  createShieldRepairQueueWithAnalytics,
  buildShieldRepairQueueSessionReport,
  buildEnqueueAccepted,
  buildEnqueueRejected,
  // Pure helpers
  computeActiveJobCountPerLayer,
  computePendingHpPerLayer,
  computeProgressRatioPerLayer,
  computeDeliveryRatePerLayer,
  computeOverallUtilization,
  isLayerAtOverflowRisk,
  buildOverflowRiskMap,
  computeRepairQueueUrgency,
  classifyRepairQueueUrgency,
  getRepairQueueChatChannel,
  buildRepairQueueUXHeadline,
  computeRepairBotThreatContribution,
  buildRepairQueueNarrativeWeight,
  buildRepairQueueRecommendedAction,
  computeRepairEfficiencyMultiplier,
  computeRepairAbsorptionWeight,
  findRepairPriorityLayers,
  computeTotalPendingHp,
  computeCompletionRate,
  extractRepairQueueMLArray,
  validateRepairQueueMLArray,
  validateRepairQueueDLRow,
  buildRepairStatusLabel,
  describeRepairQueueState,
  computeRepairThreatPressure,
  scoreThreatLayerUrgency,
  buildRepairLayerConfigMap,
  resolveRepairJobDoctrine,
  isKnownShieldAlias,
  buildRepairQueueThresholdReport,
  buildRepairQueueMLCompat,
  applyRepairToLayerState,
  scoreRepairCoverageRatio,
  computeQueueSaturation,
  // Low-throughput and stress helpers (wire SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD)
  computeLowThroughputRisk,
  findLowThroughputLayerIds,
  computePerLayerThroughputHealth,
  computeRepairMomentum,
  buildRepairRiskVector,
  scoreRepairDoctrineAlignment,
  estimateTicksToFullRepair,
  computeRepairQueueStressScore,
  // Module constants
  SHIELD_REPAIR_QUEUE_MODULE_VERSION,
  SHIELD_REPAIR_QUEUE_READY,
  SHIELD_REPAIR_QUEUE_ML_FEATURE_COUNT,
  SHIELD_REPAIR_QUEUE_DL_FEATURE_COUNT,
  SHIELD_REPAIR_QUEUE_DL_SEQUENCE_LENGTH,
  SHIELD_REPAIR_QUEUE_HISTORY_DEPTH,
  SHIELD_REPAIR_QUEUE_TREND_WINDOW,
  SHIELD_REPAIR_QUEUE_FORECAST_MAX_HORIZON,
  SHIELD_REPAIR_QUEUE_OVERFLOW_RISK_THRESHOLD,
  SHIELD_REPAIR_QUEUE_CRITICAL_UTILIZATION,
  SHIELD_REPAIR_QUEUE_LOW_THROUGHPUT_THRESHOLD,
  SHIELD_REPAIR_QUEUE_MAX_HP_PER_TICK,
  SHIELD_REPAIR_QUEUE_REJECTION_HISTORY_DEPTH,
  SHIELD_REPAIR_QUEUE_MAX_QUEUED_HP,
  SHIELD_REPAIR_QUEUE_CRITICAL_URGENCY_THRESHOLD,
  SHIELD_REPAIR_QUEUE_ML_FEATURE_LABELS,
  SHIELD_REPAIR_QUEUE_DL_FEATURE_LABELS,
  SHIELD_REPAIR_QUEUE_MANIFEST,
} from './ShieldRepairQueue';

export type {
  ShieldRepairQueueMLVector,
  ShieldRepairQueueDLRow,
  ShieldRepairQueueDLTensor,
  ShieldRepairQueueLayerTrend,
  ShieldRepairQueueTrendSummary,
  ShieldRepairQueueLayerForecast,
  ShieldRepairQueueCapacityForecast,
  ShieldRepairQueueJobAnnotation,
  ShieldRepairQueueCompletionAnnotation,
  ShieldRepairQueueAnnotationBundle,
  ShieldRepairQueueUXHint,
  ShieldRepairQueueHistoryEntry,
  ShieldRepairQueueInspectorState,
  ShieldRepairQueueAnalyticsSummary,
  ShieldRepairQueueEnsemble,
  ShieldRepairQueueMLParams,
  ShieldRepairQueueDLRowParams,
  ShieldRepairQueueSessionReport,
  ShieldRepairQueueEnqueueResult,
} from './ShieldRepairQueue';

// ── Shield UX Bridge ─────────────────────────────────────────────────────────
export { ShieldUXBridge } from './ShieldUXBridge';

// ── Shield Engine ─────────────────────────────────────────────────────────────
export {
  ShieldEngine,
  ShieldMLExtractor,
  ShieldDLBuilder,
  ShieldTrendAnalyzer,
  ShieldResilienceForecaster,
  ShieldAnnotator,
  ShieldInspector,
  ShieldAnalytics,
  createShieldEngineWithAnalytics,
  buildShieldEngineBundle,
  scoreShieldBreachRisk,
  getShieldChatChannel,
  buildShieldNarrativeWeight,
} from './ShieldEngine';

// ── Types: Original Exports ──────────────────────────────────────────────────
export {
  // Core constants
  SHIELD_LAYER_ORDER,
  SHIELD_LAYER_CONFIGS,
  SHIELD_CONSTANTS,
  SHIELD_ATTACK_ALIASES,
  // Core functions
  isShieldLayerId,
  getLayerConfig,
  buildShieldLayerState,
  normalizeShieldNoteTags,
  resolveShieldAlias,
  layerOrderIndex,
} from './types';

export type {
  // Core types
  RepairLayerId,
  ShieldDoctrineAttackType,
  ShieldLayerConfig,
  RepairJob,
  PendingRepairSlice,
  QueueRejection,
  RoutedAttack,
  DamageResolution,
  CascadeResolution,
} from './types';

// ── Types: New Type Exports (v2) ─────────────────────────────────────────────
export type {
  ShieldHealthGrade,
  ShieldStatusBand,
  AttackSeverityTier,
  RepairStrategyKind,
  LayerDangerLevel,
  ShieldEventKind,
  ShieldHealthReport,
  LayerGradeEntry,
  LayerVulnerabilityScore,
  ShieldRecoveryEstimate,
  FortificationProgress,
  AttackAnalysisResult,
  AttackBatchAnalysis,
  DoctrineCoherenceResult,
  AttackPatternSignal,
  RepairPriorityEntry,
  RepairCostEstimate,
  RepairStrategyRecommendation,
  RepairQueueSaturationReport,
  RepairEffectivenessPrediction,
  ShieldMLFeatureVector,
  AttackPatternFeatureVector,
  RepairEfficiencyFeatureVector,
  ShieldUXSnapshot,
  ShieldEventUXCopy,
} from './types';

// ── Types: New Constant Exports (v2) — UX Maps ──────────────────────────────
export {
  // Attack category maps
  ATTACK_CATEGORY_DOCTRINE_MAP,
  ATTACK_CATEGORY_SEVERITY_WEIGHT,
  ATTACK_CATEGORY_PREFERRED_LAYER,
  ATTACK_CATEGORY_UX_DESCRIPTION,
  ATTACK_CATEGORY_UX_SHORT_NAME,
  ATTACK_CATEGORY_ORDER,
  ATTACK_SOURCE_UX_LABEL,
  // Doctrine maps
  DOCTRINE_TYPE_UX_DESCRIPTION,
  DOCTRINE_TYPE_ORDER,
  // Layer label maps
  LAYER_LABEL_DISPLAY_NAME,
  LAYER_LABEL_UX_DESCRIPTION,
  LAYER_LABEL_ICON_KEY,
  LAYER_LABEL_SHORT_NAME,
  // Layer danger maps
  LAYER_DANGER_THRESHOLDS,
  DANGER_LEVEL_UX_DESCRIPTION,
  DANGER_LEVEL_STATUS_TEMPLATE,
  // Status band maps
  STATUS_BAND_ICON_KEY,
  STATUS_BAND_UX_NARRATIVE,
  // Grade maps
  GRADE_SCORE_BOUNDARIES,
  GRADE_UX_NARRATIVE,
  // Severity tier maps
  SEVERITY_TIER_BOUNDARIES,
  SEVERITY_TIER_UX_DESCRIPTION,
  SEVERITY_TIER_ORDER,
  // Repair maps
  REPAIR_SOURCE_UX_LABEL,
  REPAIR_STRATEGY_UX_DESCRIPTION,
  // Shield event UX maps
  SHIELD_EVENT_UX_HEADLINE,
  SHIELD_EVENT_UX_BODY,
  // Layer scoring maps
  LAYER_HEALTH_WEIGHT,
  LAYER_REPAIR_COST_PER_HP,
  LAYER_REPAIR_SPEED,
} from './types';

// ── Types: New Function Exports (v2) — Shield Diagnostics & UX ──────────────
export {
  // Shield health grading
  computeLayerDangerLevel,
  computeGradeFromScore,
  gradeToNumericMidpoint,
  computeStatusBand,
  // Layer UX text
  generateLayerStatusLine,
  generateLayerDetailLine,
  buildLayerGradeEntry,
  // Weighted integrity
  computeWeightedIntegrity as computeWeightedIntegrityV2,
  // Health reports
  buildShieldHealthReport,
  buildShieldNarrativeSummary,
  buildShieldShortStatus,
  buildShieldStatusSummary,
  // Vulnerability analysis
  computeLayerVulnerabilities as computeLayerVulnerabilitiesV2,
  // Recovery estimation
  estimateShieldRecovery,
  // Fortification progress
  computeFortificationProgress,
  // Deflection
  computeLayerDeflection,
  isLayerAtCascadeRisk,
  // Defensive posture
  scoreDefensivePosture,
  computeLayerDistressDuration,
  generatePlayerActionHint,
} from './types';

// ── Types: New Function Exports (v2) — Attack Analysis ──────────────────────
export {
  mapAttackCategoryToDoctrine,
  getAttackCategorySeverityWeight,
  getAttackCategoryPreferredLayer,
  classifyAttackSeverity,
  classifyAttackEventSeverity,
  validateAttackForShield,
  isAttackSourceBot,
  getAttackSourceUXLabel,
  analyzeAttack,
  analyzeAttackBatch,
  computeDoctrineCoherence,
  detectAttackPatterns,
  isAttackOnPreferredLayer,
  computeLayerHeatConcentration,
  generateAttackUXCopy,
} from './types';

// ── Types: New Function Exports (v2) — Repair Planning ──────────────────────
export {
  scoreRepairPriorities,
  estimateRepairCosts,
  recommendRepairStrategy,
  analyzeRepairQueueSaturation,
  predictRepairEffectiveness,
  computeOptimalRepairDistribution,
  estimateRepairJobCompletion,
  generateRepairJobUXCopy,
} from './types';

// ── Types: New Function Exports (v2) — ML/DL Features ──────────────────────
export {
  buildShieldMLFeatureVector,
  extractLayerIntegrityFeatures,
  buildAttackPatternFeatureVector,
  buildRepairEfficiencyFeatureVector,
  flattenShieldMLFeatures,
  flattenAttackPatternFeatures,
  flattenRepairEfficiencyFeatures,
  buildCombinedMLFeatureVector,
  getMLFeatureDimensions,
} from './types';

// ── Types: New Function Exports (v2) — Shield Event UX Copy ─────────────────
export {
  buildDamageEventUXCopy,
  buildBreachEventUXCopy,
  buildRepairStartedEventUXCopy,
  buildRepairCompletedEventUXCopy,
  buildFortificationReachedEventUXCopy,
  buildCascadeTriggeredEventUXCopy,
  buildDeflectionEventUXCopy,
  buildRegenTickEventUXCopy,
} from './types';

// ── Types: New Function Exports (v2) — UX Snapshot & Comparison ─────────────
export {
  buildShieldUXSnapshot,
  compareShieldStates,
  computeShieldMomentum,
  generateTurnShieldNarrative,
} from './types';

// ── Types: New Function Exports (v2) — Advanced Scoring ─────────────────────
export {
  computeThreatAbsorptionCapacity,
  computeEffectiveLayerHP,
  computeShieldResilienceIndex,
  isShieldInDeathSpiral,
  computeCriticalPathToCascade,
  scoreShieldBalance,
} from './types';

// ── Types: New Function Exports (v2) — Historical Trend Analysis ────────────
export {
  computeRollingIntegrity,
  detectShieldTrend,
  computeBreachFrequency,
  generateTrendNarrative,
} from './types';

// ── Types: New Function Exports (v2) — Attack Response ──────────────────────
export {
  scoreAttackResponseUrgency,
  rankAttacksByUrgency,
  getCounterDoctrineHint,
  generateTacticalAssessment,
} from './types';

// ── Types: New Function Exports (v2) — Validation ───────────────────────────
export {
  validateShieldLayerState,
  validateShieldLayerArray,
  validateRoutedAttack,
  validateRepairJob,
} from './types';

// ── Types: New Function Exports (v2) — State Factories ──────────────────────
export {
  buildFullShieldState,
  buildFullHealthShieldState,
  buildBreachedShieldState,
  buildShieldStateAtRatio,
  applyDamageToShieldState,
  applyRepairToShieldState,
  applyRegenTick,
} from './types';

// ── Types: New Function Exports (v2) — Resolution Analysis ──────────────────
export {
  analyzeDamageResolution,
  analyzeCascadeResolution,
} from './types';

// ── Types: New Function Exports (v2) — Simulation Helpers ───────────────────
export {
  simulateRegenTicks,
  simulateAttackImpact,
  simulateRepairOutcome,
  computeMinRepairToSurvive,
  computeSteadyStateDamageCapacity,
} from './types';
