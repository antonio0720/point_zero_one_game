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
 *   const mlVec = engine.getLastMLVector();
 *   const forecast = engine.computeRecoveryForecast(snapshot);
 */

// ── Core engine and sub-components
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

// ── Decay controller — full surface including ML/DL classes and all helpers
export {
  PressureDecayController,
  // Companion analysis classes
  DecayMLExtractor,
  DecayDLBuilder,
  DecayTrendAnalyzer,
  DecayPolicyAdvisor,
  DecayScenarioSimulator,
  DecayAnnotator,
  DecayInspector,
  // Standalone helpers
  createDecayController,
  buildDecayAnnotation,
  simulateDecayToCalm,
  buildDecayPolicySummary,
  extractDecayMLVector,
  // Module constants
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

// ── Event emitter — full surface including analytics/ML/DL classes and all helpers
export {
  PressureEventEmitter,
  // Companion classes
  PressureEmitterStateTracker,
  PressureEmitterMLExtractor,
  PressureEmitterDLBuilder,
  PressureEmitterAnalytics,
  PressureEmitterSignalRouter,
  PressureEmitterBatchProcessor,
  // Standalone helpers
  createPressureEventEmitter,
  createPressureEmitterBatchProcessor,
  extractEmitterMLVector,
  getEmitterChannelRecommendation,
  buildEmitterAnalyticsSummary,
  // Module constants
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

// ── Signal collector
export { PressureSignalCollector } from './PressureSignalCollector';

// ── Full types surface
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
} from './types';
