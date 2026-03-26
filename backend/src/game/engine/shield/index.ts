/*
 * POINT ZERO ONE — BACKEND SHIELD SUBSYSTEM BARREL
 * /backend/src/game/engine/shield/index.ts
 * VERSION: 2026.03.25
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
  computeLayerVulnerabilities,
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
export { ShieldLayerManager } from './ShieldLayerManager';

// ── Shield Repair Queue ───────────────────────────────────────────────────────
export { ShieldRepairQueue } from './ShieldRepairQueue';

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

// ── Types ─────────────────────────────────────────────────────────────────────
export {
  SHIELD_LAYER_ORDER,
  SHIELD_LAYER_CONFIGS,
  SHIELD_CONSTANTS,
  SHIELD_ATTACK_ALIASES,
  isShieldLayerId,
  getLayerConfig,
  buildShieldLayerState,
  normalizeShieldNoteTags,
  resolveShieldAlias,
  layerOrderIndex,
} from './types';

export type {
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
