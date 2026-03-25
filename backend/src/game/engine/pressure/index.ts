/*
 * POINT ZERO ONE — BACKEND PRESSURE SUBSYSTEM BARREL
 * /backend/src/game/engine/pressure/index.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - this is the authoritative barrel for the full pressure subsystem
 * - every symbol exported here is consumed by chat adapters, ML pipelines,
 *   the engine orchestrator, or the engine index
 * - no circular imports — this file imports from leaf modules only
 * - the engine/index.ts exports this barrel under the Pressure namespace
 *
 * Consumers:
 *   import { Pressure } from '../../engine';
 *   const engine = new Pressure.PressureEngine();
 *   const mlVec  = engine.getLastMLVector();
 *   const collector = new Pressure.PressureSignalCollector();
 *   const ensemble  = Pressure.createPressureCollectorWithAnalytics();
 */

// ── Core engine and sub-components ─────────────────────────────────────────
export {
  PressureEngine,
  PressureMLExtractor,
  PressureDLBuilder,
  PressureTrendAnalyzer,
  PressureRecoveryForecaster,
  PressureAnnotator,
  PressureUXProjector,
  createPressureEngine,
  PRESSURE_ENGINE_MODULE_VERSION,
  PRESSURE_ENGINE_ML_FEATURE_COUNT,
  PRESSURE_ENGINE_DL_FEATURE_COUNT,
  PRESSURE_ENGINE_DL_SEQUENCE_LENGTH,
  PRESSURE_ENGINE_MANIFEST,
} from './PressureEngine';

export type {
  PressureMLVector,
  PressureDLTensor,
  PressureTrendSummary,
  PressureRecoveryForecast,
  PressureDecayAnalysis,
  PressureEscalationPrediction,
  PressureAnnotationBundle,
  PressureUXHint,
  PressureInspectorState,
} from './PressureEngine';

// ── Decay controller ─────────────────────────────────────────────────────────
export {
  PressureDecayController,
  DecayMLExtractor,
  DecayDLBuilder,
  DecayTrendAnalyzer,
  DecayPolicyAdvisor,
  DecayScenarioSimulator,
  DecayAnnotator,
  DecayInspector,
  createDecayController,
  buildDecayAnnotation,
  simulateDecayToCalm,
  buildDecayPolicySummary,
  extractDecayMLVector,
  DECAY_CONTROLLER_MODULE_VERSION,
  DECAY_ML_FEATURE_COUNT,
  DECAY_DL_FEATURE_COUNT,
  DECAY_DL_SEQUENCE_LENGTH,
  DECAY_SCENARIO_MAX_TICKS,
  DECAY_SCENARIO_CALM_THRESHOLD,
  DECAY_FULLY_CONSTRAINED_RATIO,
  DECAY_CONTROLLER_MANIFEST,
  DECAY_ML_FEATURE_LABELS,
} from './PressureDecayController';

export type {
  DecayHistoryEntry,
  DecayApplicationResult,
  DecayMLVector,
  DecayDLTensor,
  DecayTrendSummary,
  DecayPolicySummary,
  DecayPathSimulation,
  DecayTierCrossing,
  DecayBandCrossing,
  DecayAnnotationBundle,
  DecayAnnotatedSignal,
  DecayInspectorState,
  DecayContributionAnalysis,
  DecayPolicyImpact,
} from './PressureDecayController';

// ── Event emitter ────────────────────────────────────────────────────────────
export {
  PressureEventEmitter,
  PressureEmitterStateTracker,
  PressureEmitterMLExtractor,
  PressureEmitterDLBuilder,
  PressureEmitterAnalytics,
  PressureEmitterSignalRouter,
  PressureEmitterBatchProcessor,
  createPressureEventEmitter,
  createPressureEmitterBatchProcessor,
  extractEmitterMLVector,
  getEmitterChannelRecommendation,
  buildEmitterAnalyticsSummary,
  PRESSURE_EMITTER_MODULE_VERSION,
  PRESSURE_EMITTER_ML_FEATURE_COUNT,
  PRESSURE_EMITTER_DL_FEATURE_COUNT,
  PRESSURE_EMITTER_DL_SEQUENCE_LENGTH,
  PRESSURE_EMITTER_HIGH_PERSISTENCE_TICKS,
  PRESSURE_EMITTER_PLATEAU_TICKS,
  PRESSURE_EMITTER_SPIKE_THRESHOLD,
  PRESSURE_EMITTER_PLATEAU_TOLERANCE,
  PRESSURE_EMITTER_MANIFEST,
  EMITTER_ML_FEATURE_LABELS,
} from './PressureEventEmitter';

export type {
  PressureEmissionMeta,
  PressureEmissionResult,
  PressureEventBusPort,
  EmitterMLVector,
  EmitterDLTensor,
  EmitterAnalyticsState,
  EmitterMilestoneState,
  EmissionHistoryEntry,
  EmitterChannelRecommendation,
  EmitterBatchEntry,
  EmitterBatchResult,
} from './PressureEventEmitter';

// ── Signal collector — full surface ─────────────────────────────────────────
export {
  PressureSignalCollector,
  // Companion classes
  CollectorMLExtractor,
  CollectorDLBuilder,
  CollectorTrendAnalyzer,
  CollectorForecaster,
  CollectorAnnotator,
  CollectorInspector,
  CollectorAnalytics,
  // Standalone helpers
  createPressureCollectorWithAnalytics,
  extractCollectorSnapshot,
  buildCollectorBundle,
  // Module constants
  COLLECTOR_MODULE_VERSION,
  COLLECTOR_MANIFEST,
} from './PressureSignalCollector';

export type {
  CollectorEnsemble,
} from './PressureSignalCollector';

// ── Full types surface ───────────────────────────────────────────────────────
export {
  PRESSURE_TIER_CONFIGS,
  PRESSURE_THRESHOLDS,
  PRESSURE_BAND_THRESHOLDS,
  PRESSURE_POSITIVE_SIGNAL_KEYS,
  PRESSURE_RELIEF_SIGNAL_KEYS,
  PRESSURE_SIGNAL_KEYS,
  DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
  DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  DEFAULT_MAX_DECAY_PER_TICK,
  PRESSURE_HISTORY_DEPTH,
  PRESSURE_TREND_WINDOW,
  TOP_PRESSURE_SIGNAL_COUNT,
  clampPressureScore,
  normalizeWeight,
  mergePressureCollectorWeights,
  resolvePressureTier,
  resolvePressureBand,
  getPressureTierMinScore,
  rankPressureTier,
  rankPressureBand,
  createZeroPressureSignalMap,
  // §5: Collector module constants
  COLLECTOR_ML_FEATURE_COUNT,
  COLLECTOR_DL_FEATURE_COUNT,
  COLLECTOR_DL_SEQUENCE_LENGTH,
  COLLECTOR_HISTORY_DEPTH,
  COLLECTOR_TREND_WINDOW,
  COLLECTOR_PLATEAU_TICKS,
  COLLECTOR_SPIKE_THRESHOLD,
  COLLECTOR_PLATEAU_TOLERANCE,
  COLLECTOR_ESCALATION_RISK_HIGH,
  COLLECTOR_ESCALATION_RISK_MEDIUM,
  COLLECTOR_RECOVERY_PROB_HIGH,
  COLLECTOR_CHAT_HOOK_MAP,
  COLLECTOR_SIGNAL_CHAT_HOOKS,
  COLLECTOR_URGENCY_THRESHOLDS,
  COLLECTOR_SIGNAL_CATEGORIES,
  COLLECTOR_RELIEF_PRIORITIES,
  COLLECTOR_MODE_PROFILES,
  COLLECTOR_PHASE_PROFILES,
  // §6: Feature label arrays
  COLLECTOR_ML_FEATURE_LABELS,
  COLLECTOR_DL_FEATURE_LABELS,
  // §10: Normalization and composite helpers
  normalizeSignalByWeight,
  scoreToPercentage,
  computeModeScopeRatio,
  computeTierCrossing,
  computeBandCrossing,
  computeStressIndex,
  computeReliefBalance,
  rankTopContributors,
  // §11: Urgency and chat hook helpers
  computeEscalationRisk,
  computeRecoveryProbability,
  classifyUrgency,
  buildChatHook,
  // §12: ML feature extraction
  extractCollectorMLFeatures,
  // §13: DL row construction
  buildCollectorDLRow,
  // §14: Trend analysis helpers
  computeCollectorVelocity,
  computeCollectorVelocityAvg,
  computeCollectorAcceleration,
  computeCollectorAccelerationAvg,
  computeCollectorPlateauTicks,
  detectPressureSpike,
  detectPressurePlateau,
  computeRunningAvgScore,
  computeScoreStdDev,
  // §15: Annotation, UX hint, and history helpers
  buildCollectorAnnotation,
  buildCollectorUXHint,
  buildCollectorHistoryEntry,
  // §9: Mode / phase profile builders
  buildCollectorModeProfile,
  buildCollectorPhaseProfile,
  // §16: Forecast helpers
  buildCollectorForecast,
  computePhaseAdjustedEscalationRisk,
  computePhaseAdjustedRecoveryProbability,
  computeModeAdjustedStressIndex,
  // §17: Threat, resilience, and validation
  computeCollectorThreatScore,
  computeCollectorResilienceScore,
  validateCollectorWeights,
} from './types';

export type {
  PressureSignalPolarity,
  PressureThreshold,
  PressureTierConfig,
  PressureCollectorLimits,
  PressureCollectorWeights,
  PressurePositiveSignalKey,
  PressureReliefSignalKey,
  PressureSignalKey,
  PressureSignalMap,
  PressureSignalContribution,
  PressureSignalCollection,
  PressureDecayProfile,
  // §7: Collector output types
  CollectorUrgencyLabel,
  CollectorTrendLabel,
  CollectorMLVector,
  CollectorDLTensor,
  CollectorTrendSummary,
  CollectorAnnotationBundle,
  CollectorForecast,
  CollectorUXHint,
  CollectorAnalyticsSummary,
  CollectorHealthState,
  // §8: History, watermark, inspector types
  CollectorHistoryEntry,
  CollectorWatermark,
  CollectorInspectorState,
  // §9: Mode / phase profile types
  CollectorModeProfile,
  CollectorPhaseProfile,
  // §12-§16: Params interfaces
  CollectorMLFeaturesParams,
  CollectorDLRowParams,
  CollectorAnnotationParams,
  CollectorForecastParams,
} from './types';
