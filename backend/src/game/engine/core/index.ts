/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/index.ts
 *
 * Doctrine:
 * - this is the master export and wiring surface for all core engine primitives
 * - every symbol exported here is used by at least one engine, adapter, or chat lane
 * - ML/DL action routing is a first-class concern at this layer
 * - no circular imports — this file imports from leaf modules only
 * - chat, cascade, pressure, tension, shield, battle, sovereignty all consume this
 * - EngineOrchestrator is the authoritative runtime; this index wires it at startup
 */

// ============================================================================
// MARK: Internal imports — local bindings for constants and types used in this
//       file's runtime code. These are separate from the re-export declarations
//       below, which expose the same symbols to external consumers.
// ============================================================================

import {
  CLOCK_SOURCE_MODULE_VERSION,
  CLOCK_SOURCE_MODULE_READY,
  CLOCK_EXTENDED_ML_FEATURE_COUNT,
} from './ClockSource';

import {
  ENGINE_CONTRACTS_MODULE_VERSION,
} from './EngineContracts';
import type { ContractHealthGrade } from './EngineContracts';

import {
  DECISION_WINDOW_MODULE_VERSION,
  DECISION_WINDOW_DL_FEATURE_COUNT,
} from './DecisionWindowService';
import type { DecisionWindowHealthGrade } from './DecisionWindowService';

import {
  ENGINE_RUNTIME_MODULE_VERSION,
  ENGINE_RUNTIME_DL_FEATURE_COUNT,
} from './EngineRuntime';
import type { EngineRuntimeHealthGrade } from './EngineRuntime';

import {
  ENGINE_REGISTRY_MODULE_VERSION,
} from './EngineRegistry';
import type { EngineRegistryHealthGrade } from './EngineRegistry';

import {
  CARD_OVERLAY_MODULE_VERSION,
} from './CardOverlayResolver';
import type { CardOverlayHealthGrade } from './CardOverlayResolver';

import {
  CHECKPOINT_STORE_MODULE_VERSION,
  CHECKPOINT_ML_FEATURE_COUNT,
  CHECKPOINT_DL_FEATURE_COUNT,
} from './RuntimeCheckpointStore';

import {
  OUTCOME_RESOLVER_MODULE_VERSION,
  OUTCOME_ML_FEATURE_COUNT,
  OUTCOME_DL_FEATURE_COUNT,
} from './RuntimeOutcomeResolver';

import {
  THREAT_ROUTING_MODULE_VERSION,
  THREAT_ML_FEATURE_COUNT,
  THREAT_DL_FEATURE_COUNT,
} from './ThreatRoutingService';

// ============================================================================
// MARK: GamePrimitives — canonical type surface
// ============================================================================

export {
  // Union type exports
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  SHIELD_LAYER_IDS,
  HATER_BOT_IDS,
  TIMING_CLASSES,
  DECK_TYPES,
  VISIBILITY_LEVELS,
  INTEGRITY_STATUSES,
  VERIFIED_GRADES,
  SHIELD_LAYER_LABEL_BY_ID,
  DEFAULT_MODE_OVERLAY,

  // Type guards
  isModeCode,
  isPressureTier,
  isRunPhase,
  isRunOutcome,
  isShieldLayerId,
  isHaterBotId,
  isTimingClass,
  isDeckType,
  isVisibilityLevel,
  isIntegrityStatus,
  isVerifiedGrade,

  // Factory/utility functions
  normalizeModeOverlay,
  resolveModeOverlay,
  createCardInstance,
  mergeEffectPayload,
  getShieldLayerLabel,
} from './GamePrimitives';

export type {
  ModeCode,
  PressureTier,
  RunPhase,
  RunOutcome,
  ShieldLayerId,
  ShieldLayerLabel,
  HaterBotId,
  BotState,
  Targeting,
  Counterability,
  TimingClass,
  DeckType,
  VisibilityLevel,
  DivergencePotential,
  IntegrityStatus,
  AttackCategory,
  CardRarity,
  VerifiedGrade,
  AttackTargetEntity,
  EffectPayload,
  ModeOverlay,
  ModeOverlayPatch,
  ModeOverlayMap,
  CardDefinition,
  CardInstance,
  AttackEvent,
  ThreatEnvelope,
  CascadeLink,
  CascadeChainInstance,
  LegendMarker,
  EngineEventMap,
} from './GamePrimitives';

// ============================================================================
// MARK: RunStateSnapshot — immutable run read model + v2 analytics surface
// ============================================================================

export {
  // Snapshot predicate functions (v2)
  isSnapshotTerminal,
  isSnapshotWin,
  isSnapshotLoss,
  isSnapshotInEndgame,
  isSnapshotInCrisis,
  isShieldFailing,
  isEconomyHealthy,
  isBattleEscalating,
  isCascadeCritical,
  isSovereigntyAtRisk,
  hasActiveDecisionWindows,
  hasPlayableCards,
  hasCriticalPendingAttacks,
  isRunFlagged,
  getPressureTierUrgencyLabel,
  getNormalizedPressureTier,
  getMinHoldTicksForCurrentTier,
  isKnownMode,
  validateSnapshotEnums,
  buildSnapshotHealthReport,
  canonicalizeSnapshot,
  computeSnapshotTickFingerprint,
  isSameTickFingerprint,
  computeSnapshotCompositeRisk,
  getSnapshotModuleHealth,
  isSnapshotInEndgame as isEndgameSnapshot,
  // Scorer classes (v2)
  SnapshotEconomyScorer,
  SnapshotShieldScorer,
  SnapshotBattleScorer,
  SnapshotPressureTensionScorer,
  SnapshotCascadeScorer,
  SnapshotSovereigntyScorer,
  SnapshotCardsModeScorer,
  SnapshotTimerScorer,
  SnapshotTelemetryScorer,
  SnapshotMLFeatureExtractor,
  SnapshotDLTensorBuilder,
  SnapshotComparator,
  SnapshotUXProjector,
  SnapshotReadModel,
  // Module constants (v2)
  SNAPSHOT_MODULE_VERSION,
  SNAPSHOT_ML_FEATURE_COUNT,
  SNAPSHOT_DL_FEATURE_COUNT,
  SNAPSHOT_DL_TENSOR_SHAPE,
  SNAPSHOT_ML_FEATURE_LABELS,
  SNAPSHOT_DL_FEATURE_LABELS,
  SNAPSHOT_COMPOSITE_RISK_WEIGHTS,
  SNAPSHOT_UX_URGENCY_THRESHOLDS,
  SNAPSHOT_NORMALIZATION_CAPS,
} from './RunStateSnapshot';

export type {
  ModePresentationCode,
  PressureBand,
  OutcomeReasonCode,
  DecisionWindowMetadataValue,
  RuntimeDecisionWindowSnapshot,
  ShieldLayerState,
  EconomyState,
  PressureState,
  TensionState,
  ShieldState,
  BotRuntimeState,
  BattleState,
  CascadeState,
  SovereigntyState,
  CardsState,
  ModeState,
  TimerState,
  TimersState,
  DecisionRecord,
  TelemetryState,
  RunStateSnapshot,
  // New v2 types
  SnapshotValidationResult,
  EconomyScore,
  ShieldScore,
  BotThreatProfile,
  BattleScore,
  PressureTensionScore,
  CascadeScore,
  SovereigntyScore,
  CardHandScore,
  ModeScore,
  TimerScore,
  TelemetryScore,
  EffectAnalysisSummary,
  SnapshotMLVector,
  SnapshotDLTensor,
  SnapshotFieldDelta,
  SnapshotDeltaReport,
  SnapshotHealthReport,
  SnapshotModuleHealth,
  SnapshotHealthGrade,
  UXUrgencyLevel,
  UXCompanionTone,
  UXChatSignalPriority,
} from './RunStateSnapshot';

// ============================================================================
// MARK: RunStateFactory — initial state construction
// ============================================================================

export {
  createInitialRunState,
} from './RunStateFactory';

export type {
  RunFactoryInput,
} from './RunStateFactory';

// ============================================================================
// MARK: Deterministic — proof-chain primitives
// ============================================================================

export {
  stableStringify,
  sha256,
  sha512,
  hmacSha256,
  checksumBuffer,
  checksumSnapshot,
  checksumParts,
  createDeterministicId,
  cloneJson,
  deepFreeze,
  deepFrozenClone,
  canonicalSort,
  flattenCanonical,
  computeProofHash,
  computeExtendedProofHash,
  computeTickSeal,
  computeChainedTickSeal,
  GENESIS_SEAL,
  createDeterministicRNG,
  advanceDeterministicRNG,
  DeterministicRNG,
  MerkleChain,
  RunAuditLog,
  ReplayHashBuilder,
  DeterministicSnapshotDiff,
  CanonicalEncoder,
  DeterministicIdRegistry,
  verifyProofHash,
  verifyExtendedProofHash,
  verifyTickSeal,
  verifyReplayFrame,
  VerificationSuite,
  DETERMINISTIC_ML_FEATURE_LABELS,
  DeterministicMLVectorBuilder,
  DeterministicRunContext,
  buildDeterministicRunContext,
  linkAuditLogToMerkleChain,
  buildReplayVerificationSuite,
  generateNonce,
  buildRunId,
} from './Deterministic';

export type {
  ProofHashInput,
  ExtendedProofHashInput,
  TickSealInput,
  ChainedTickSealInput,
  DeterministicRNGState,
  MerkleLeaf,
  MerkleNode,
  MerkleProof,
  MerkleChainState,
  AuditEventKind,
  AuditEntry,
  RunAuditLogOptions,
  AuditLogState,
  AuditLogSummary,
  ReplayFrame,
  ReplayHashBuilderOptions,
  ReplayHashReport,
  ReplayVerificationResult,
  DiffOperation,
  SnapshotDiffEntry,
  SnapshotDiff,
  CanonicalEncoderOptions,
  CanonicalEncoderStats,
  IdRegistryEntry,
  IdRegistryOptions,
  IdRegistryStats,
  VerificationStatus,
  VerificationResult,
  VerificationContext,
  BatchVerificationResult,
  DeterministicMLVector,
  DeterministicMLContext,
  DeterministicRunContextOptions,
} from './Deterministic';

// ============================================================================
// MARK: ClockSource — deterministic time
// ============================================================================

export {
  SystemClock,
  DeterministicClock,
  OffsetClock,
  FrozenClock,
} from './ClockSource';

export type {
  ClockSource,
  MutableClockSource,
} from './ClockSource';

// ============================================================================
// MARK: EventBus — typed pub/sub runtime bus
// ============================================================================

export {
  EventBus,
} from './EventBus';

export type {
  Listener,
  EventEnvelope,
  AnyEventListener,
  EventBusOptions,
  EmitOptions,
  ClearOptions,
} from './EventBus';

// ============================================================================
// MARK: EngineContracts — engine simulation interfaces
// ============================================================================

export {
  createEngineHealth,
  createEngineSignal,
  createEngineSignalFull,
  createEngineErrorSignal,
  createContractViolationSignal,
  normalizeEngineTickResult,
  ALL_ENGINE_IDS,
  ENGINE_STEP_SLOTS,
  DEFAULT_ENGINE_STEP_POLICIES,
  getEngineStepPolicy,
  isEngineRequiredAtStep,
  isEngineEligibleAtStep,
  buildEngineStepMetrics,
  buildTickStepMetrics,
  classifyMLSignalRisk,
  recommendActionFromMLClass,
  buildEngineMLSignal,
  buildMLSignalComposite,
  buildEngineTickOrchestrationPlan,
  ENGINE_CONTRACT_ML_FEATURE_LABELS,
  buildEngineContractsMLVector,
  EngineSignalAggregator,
  EngineContractValidator,
  ModeHookRegistry,
  TickContextBuilder,
  EngineStepRouter,
  EngineHealthMonitor,
  EngineSignalRouter,
  EngineStepTimer,
  EngineRosterValidator,
} from './EngineContracts';

export type {
  EngineId,
  EngineHealthStatus,
  EngineSignalSeverity,
  EngineSignalCategory,
  EngineSignal,
  TickTrace,
  TickContext,
  EngineHealth,
  EngineTickResult,
  ModeLifecycleHooks,
  SimulationEngine,
  EngineStepPolicy,
  EngineStepMetrics,
  TickStepMetrics,
  SignalAggregatorReport,
  MLSignalClass,
  EngineMLSignal,
  MLSignalComposite,
  ContractCheckResult,
  ContractValidationReport,
  ModeHookRegistryOptions,
  TickContextBuilderOptions,
  StepRouteResult,
  EngineStepRouterOptions,
  HealthRecord,
  HealthTrend,
  EngineHealthTrend,
  EngineSignalSubscriber,
  StepTimerRecord,
  StepTimerStats,
  RosterValidationResult,
  OrchestrationStep,
  EngineTickOrchestrationPlan,
  EngineContractsMLVector,
} from './EngineContracts';

// ============================================================================
// MARK: EngineRegistry — engine registration and order enforcement
// ============================================================================

export {
  EngineRegistry,
} from './EngineRegistry';

export type {
  EngineRegistrationOptions,
  EngineRegistrySnapshot,
} from './EngineRegistry';

// ============================================================================
// MARK: TickSequence — authoritative tick step order
// ============================================================================

export {
  TICK_SEQUENCE,
  ENGINE_EXECUTION_STEPS,
  TICK_STEP_DESCRIPTORS,
  isTickStep,
  getTickStepIndex,
  getTickStepDescriptor,
  getNextTickStep,
  getPreviousTickStep,
  isEngineExecutionStep,
  assertValidTickSequence,
} from './TickSequence';

export type {
  TickStep,
  TickStepPhase,
  TickStepOwner,
  TickStepDescriptor,
} from './TickSequence';

// ============================================================================
// MARK: DecisionWindowService — timing window management
// ============================================================================

export {
  DecisionWindowService,
  TIMING_CLASS_LABELS,
  WINDOW_TIMING_POLICY,
  computeWindowUrgency,
  isModeEligibleForTimingClass,
  WindowEventLog,
  WindowAnalyticsTracker,
  WindowPredictor,
  WINDOW_ML_FEATURE_LABELS,
  WindowMLVectorBuilder,
  buildWindowDiagnosticsReport,
  buildWindowMLContext,
  DecisionWindowServiceFacade,
  createDecisionWindowFacade,
} from './DecisionWindowService';

export type {
  DecisionWindowState,
  WindowOpenRequest,
  WindowReconcileInput,
  WindowAvailabilityQuery,
  WindowSnapshot,
  DecisionWindowServiceOptions,
  WindowTimingPolicyEntry,
  WindowEventKind,
  WindowEvent,
  WindowClassAnalytics,
  WindowAnalytics,
  PredictionConfidence,
  WindowPrediction,
  WindowMLVector,
  WindowSystemHealth,
  WindowDiagnosticsReport,
  WindowMLContext,
} from './DecisionWindowService';

// ============================================================================
// MARK: CardOverlayResolver — card legality and overlay engine
// ============================================================================

export {
  CardOverlayResolver,
} from './CardOverlayResolver';

export type {
  ResourceType,
  ResolvedCardView,
  ValidateCardPlayInput,
  CardPlayValidationResult,
} from './CardOverlayResolver';

// ============================================================================
// MARK: EngineOrchestrator — authoritative orchestration surface
// ============================================================================

export {
  EngineOrchestrator,
} from './EngineOrchestrator';

export type {
  OrchestratorStartResult,
  OrchestratorTickResult,
  PlayCardRequest,
  PlayCardResult,
  DrawCardResult,
  EngineOrchestratorOptions,
} from './EngineOrchestrator';

// ============================================================================
// MARK: EngineRuntime — simplified runtime (non-orchestrator path)
// ============================================================================

export {
  EngineRuntime,
} from './EngineRuntime';

export type {
  RuntimeTickResult,
} from './EngineRuntime';

// ============================================================================
// MARK: EngineTickTransaction — atomic tick boundary wrapper
// ============================================================================

export {
  EngineTickTransaction,
} from './EngineTickTransaction';

export type {
  EngineTickTransactionMeta,
  EngineTickTransactionState,
  EngineTickRollbackOptions,
} from './EngineTickTransaction';

// ============================================================================
// MARK: RunStateInvariantGuard — state correctness enforcement + v2 analytics
// ============================================================================

export {
  RunStateInvariantGuard,
  // v2 classes
  RunStateInvariantHistorian,
  RunStateInvariantMLAdapter,
  RunStateInvariantBatchInspector,
  RunStateInvariantRemediationAdvisor,
  RunStateInvariantChatSignalBridge,
  RunStateInvariantAnalytics,
  // v2 factory + convenience functions
  buildInvariantAnalyticsStack,
  deepInspectSnapshot,
  isSnapshotValid,
  isTransitionSequenceValid,
  // v2 constants
  INVARIANT_ERROR_CODES,
  INVARIANT_CRITICAL_ERROR_CODES,
  INVARIANT_HIGH_RISK_ERROR_CODES,
  INVARIANT_GUARD_MODULE_VERSION,
  INVARIANT_GUARD_MODULE_READY,
  INVARIANT_ML_FEATURE_COUNT,
  INVARIANT_ML_FEATURE_LABELS,
} from './RunStateInvariantGuard';

export type {
  InvariantSeverity,
  InvariantStage,
  InvariantIssue,
  RunStateInvariantOptions,
  RunStateTransitionOptions,
  RunStateInvariantReport,
  // v2 types
  InvariantMLRiskClass,
  InvariantMLSignal,
  InvariantRemediationAction,
  InvariantRemediationSuggestion,
  InvariantChatSignal,
  InvariantHistoryEntry,
  InvariantCodeStats,
  InvariantAnalyticsSummary,
  InvariantHistorianOptions,
  InvariantBatchInspectorOptions,
  InvariantBatchResult,
  InvariantMLAdapterOptions,
} from './RunStateInvariantGuard';

// ============================================================================
// MARK: RuntimeOutcomeResolver — terminal condition authority
// ============================================================================

export {
  RuntimeOutcomeResolver,
  OutcomeMLVectorBuilder,
  OutcomeDLTensorBuilder,
  OutcomeProximityAnalyzer,
  OutcomeEconomyTrajectoryAnalyzer,
  OutcomeForecastEngine,
  OutcomeNarrationHintBuilder,
  OutcomeHistoryTracker,
  OutcomeThresholdAdvisor,
  OutcomeBatchResolver,
  OutcomeResolverHealthMonitor,
  OutcomeResolverFacade,
  OUTCOME_RESOLVER_MODULE_VERSION,
  OUTCOME_RESOLVER_MODULE_READY,
  OUTCOME_ML_FEATURE_COUNT,
  OUTCOME_DL_FEATURE_COUNT,
  OUTCOME_DL_TENSOR_SHAPE,
  OUTCOME_BANKRUPTCY_RUNWAY_CRITICAL_TICKS,
  OUTCOME_BANKRUPTCY_RUNWAY_HIGH_TICKS,
  OUTCOME_FREEDOM_SPRINT_NEAR_TICKS,
  OUTCOME_HISTORY_MAX_ENTRIES,
  OUTCOME_PROBABILITY_SHIFT_THRESHOLD,
  OUTCOME_ML_FEATURE_LABELS,
  OUTCOME_DL_FEATURE_LABELS,
} from './RuntimeOutcomeResolver';

export type {
  RuntimeOutcomeResolverOptions,
  RuntimeOutcomeDecision,
  OutcomeProximity,
  OutcomeRunway,
  OutcomeMLVector,
  OutcomeDLTensor,
  OutcomeProbabilityDistribution,
  OutcomeForecast,
  OutcomeNarrationHint,
  OutcomeHistoryEntry,
  OutcomeTrajectory,
  OutcomeThresholdConfig,
  OutcomeDecisionContext,
  OutcomeResolverHealthGrade,
  OutcomeResolverStats,
  OutcomeEconomyDataPoint,
  OutcomeBatchResult,
  OutcomeFacadeResult,
} from './RuntimeOutcomeResolver';

// ============================================================================
// MARK: RuntimeCheckpointStore — rollback anchors + v2 analytics stack
// ============================================================================

export {
  RuntimeCheckpointStore,
  // v2 analytics classes
  CheckpointMLExtractor,
  CheckpointDiffAnalyzer,
  CheckpointTrendAnalyzer,
  CheckpointChatSignalBridge,
  CheckpointReplayVerifier,
  CheckpointQueryEngine,
  CheckpointCompactionStrategy,
  CheckpointExporter,
  CheckpointAnalyticsStack,
  // v2 constants
  CHECKPOINT_STORE_MODULE_VERSION,
  CHECKPOINT_STORE_MODULE_READY,
  CHECKPOINT_ML_FEATURE_COUNT,
  CHECKPOINT_DL_FEATURE_COUNT,
  CHECKPOINT_DL_TENSOR_SHAPE,
  CHECKPOINT_ML_FEATURE_LABELS,
  CHECKPOINT_DL_FEATURE_LABELS,
  CHECKPOINT_CHAT_SIGNAL_RISK_THRESHOLD,
  CHECKPOINT_CHAT_SIGNAL_MAX_PER_WRITE,
  CHECKPOINT_TREND_LOOKBACK_DEFAULT,
  CHECKPOINT_DIFF_SIGNIFICANCE_THRESHOLD,
  CHECKPOINT_REPLAY_TOLERANCE,
  CHECKPOINT_INVARIANT_COMPAT_VERSION,
  // v2 factory + convenience functions
  buildCheckpointStoreHealth,
  buildCheckpointAnalyticsStack,
  analyzeCheckpointPair,
  isCriticalCheckpoint,
  getCheckpointRiskScore,
  buildCheckpointChatSignals,
  verifyCheckpointReplay,
  exportCheckpoints,
  getCheckpointMLMetadata,
  findCrisisCheckpoints,
  analyzeRunTrend,
  isCheckpointStoreReady,
} from './RuntimeCheckpointStore';

export type {
  RuntimeCheckpointReason,
  RuntimeCheckpointStoreOptions,
  RuntimeCheckpointWriteInput,
  RuntimeCheckpoint,
  // v2 types
  CheckpointMLRiskClass,
  CheckpointChatSignalPriority,
  CheckpointReplayStatus,
  CheckpointCompactionMode,
  CheckpointExportFormat,
  CheckpointStoreHealthGrade,
  CheckpointDiffFieldCategory,
  TrendDirection,
  CheckpointMLVector,
  CheckpointDLTensor,
  CheckpointDiffEntry,
  CheckpointDeltaReport,
  CheckpointTrendPoint,
  CheckpointTrendReport,
  CheckpointChatSignal,
  CheckpointChatSignalBridgeOptions,
  CheckpointReplayFrame,
  CheckpointReplayResult,
  CheckpointQueryFilter,
  CheckpointQueryResult,
  CheckpointCompactionOptions,
  CheckpointCompactionResult,
  CheckpointExportResult,
  CheckpointStoreHealthReport,
  CheckpointAnalyticsStackOptions,
} from './RuntimeCheckpointStore';

// ============================================================================
// MARK: TickTraceRecorder — deterministic forensic traces
// ============================================================================

export {
  TickTraceRecorder,
} from './TickTraceRecorder';

export type {
  TickTraceStatus,
  TickTraceRecorderOptions,
  TickTraceHandle,
  TickTraceMutationSummary,
  TickTraceRecord,
} from './TickTraceRecorder';

// ============================================================================
// MARK: ProofSealer — terminal run sealing
// ============================================================================

export {
  ProofSealer,
} from './ProofSealer';

export type {
  VerifiedGrade as SealVerifiedGrade,
  SealScoreComponents,
  SealScoreBreakdown,
  TickSealResult,
  RunSealResult,
} from './ProofSealer';

// ============================================================================
// MARK: ThreatRoutingService — threat → attack translation
// ============================================================================

export {
  ThreatRoutingService,
  ThreatMLVectorBuilder,
  ThreatDLTensorBuilder,
  ThreatTrajectoryAnalyzer,
  ThreatIntelEngine,
  CounterStrategyAdvisor,
  ThreatBotBehaviorPredictor,
  ThreatSurgeDetector,
  ThreatChatSignalGenerator,
  ThreatHistoryTracker,
  ThreatRoutingFacade,
  THREAT_ROUTING_MODULE_VERSION,
  THREAT_ROUTING_MODULE_READY,
  THREAT_ML_FEATURE_COUNT,
  THREAT_DL_FEATURE_COUNT,
  THREAT_DL_TENSOR_SHAPE,
  THREAT_HISTORY_MAX_ENTRIES,
  THREAT_SURGE_DELTA_THRESHOLD,
  THREAT_SIGNIFICANCE_MIN_ROUTES,
  THREAT_ML_FEATURE_LABELS,
  THREAT_DL_FEATURE_LABELS,
  getThreatRoutingDiagnosticLabels,
  freezeRoutingSnapshot,
} from './ThreatRoutingService';

export type {
  ThreatRoutingOptions,
  RoutedThreat,
  ThreatRoutingResult,
  ThreatMLVector,
  ThreatDLTensor,
  ThreatTrajectoryPoint,
  ThreatTrajectory,
  ThreatIntelEntry,
  ThreatIntelReport,
  CounterStrategyAdvice,
  ThreatBotPrediction,
  ThreatSurgeEvent,
  ThreatChatSignalPayload,
  ThreatRoutingStats,
  ThreatFacadeTickResult,
} from './ThreatRoutingService';

// ============================================================================
// MARK: ModeRuleCompiler — compiled mode rules
// ============================================================================

export {
  ModeRuleCompiler,
} from './ModeRuleCompiler';

export type {
  ModeLabel,
  ModeCompilationOverrides,
  ModeTimingPolicy,
  ModeEconomyPolicy,
  CompiledModeRules,
} from './ModeRuleCompiler';

// ============================================================================
// MARK: RunStateSnapshot — additional utility
// ============================================================================

// ============================================================================
// MARK: CoreEngineStack — factory for full production engine stack
// ============================================================================

import { EngineOrchestrator, type EngineOrchestratorOptions } from './EngineOrchestrator';
import { EngineRuntime } from './EngineRuntime';
import { EngineRegistry } from './EngineRegistry';
import { EventBus } from './EventBus';
import { DeterministicClock, SystemClock, OffsetClock, FrozenClock, type MutableClockSource } from './ClockSource';
import { DecisionWindowService } from './DecisionWindowService';
import { CardOverlayResolver } from './CardOverlayResolver';
import { RunStateInvariantGuard } from './RunStateInvariantGuard';
import { RuntimeOutcomeResolver } from './RuntimeOutcomeResolver';
import { RuntimeCheckpointStore } from './RuntimeCheckpointStore';
import { TickTraceRecorder } from './TickTraceRecorder';
import { ProofSealer } from './ProofSealer';
import { ThreatRoutingService } from './ThreatRoutingService';
import { ModeRuleCompiler } from './ModeRuleCompiler';
import { EngineTickTransaction } from './EngineTickTransaction';
import type { ModeCode, EngineEventMap } from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import type { RunFactoryInput } from './RunStateFactory';
import { createInitialRunState } from './RunStateFactory';
import { checksumSnapshot, createDeterministicId, deepFreeze, cloneJson } from './Deterministic';
import { TICK_SEQUENCE, TICK_STEP_DESCRIPTORS, assertValidTickSequence, isTickStep, getTickStepIndex } from './TickSequence';
import { createEngineSignal, createEngineHealth, normalizeEngineTickResult } from './EngineContracts';
import type { SimulationEngine, EngineHealth, EngineSignal, TickContext } from './EngineContracts';

/**
 * Full engine stack bundle — all services wired together.
 * This is the canonical production composition point.
 */
export interface CoreEngineStack {
  readonly orchestrator: EngineOrchestrator;
  readonly runtime: EngineRuntime;
  readonly registry: EngineRegistry;
  readonly bus: EventBus<EngineEventMap & Record<string, unknown>>;
  readonly clock: MutableClockSource;
  readonly windows: DecisionWindowService;
  readonly overlays: CardOverlayResolver;
  readonly invariantGuard: RunStateInvariantGuard;
  readonly outcomeResolver: RuntimeOutcomeResolver;
  readonly checkpointStore: RuntimeCheckpointStore;
  readonly traceRecorder: TickTraceRecorder;
  readonly proofSealer: ProofSealer;
  readonly threatRouter: ThreatRoutingService;
  readonly modeCompiler: ModeRuleCompiler;
}

/**
 * Options for building a CoreEngineStack.
 */
export interface CoreEngineStackOptions extends EngineOrchestratorOptions {
  readonly engines?: readonly SimulationEngine[];
  readonly enforceTickSequence?: boolean;
}

/**
 * Build a fully-wired CoreEngineStack.
 *
 * Usage:
 *   import { buildCoreEngineStack } from './core';
 *   const stack = buildCoreEngineStack({ engines: [timeEngine, pressureEngine, ...] });
 *   const { snapshot } = stack.orchestrator.startRun(input);
 */
export function buildCoreEngineStack(options: CoreEngineStackOptions = {}): CoreEngineStack {
  const registry = options.registry ?? new EngineRegistry();
  const bus = options.bus ?? new EventBus<EngineEventMap & Record<string, unknown>>();
  const clock = options.clock ?? new DeterministicClock(0);
  const windows = options.windows ?? new DecisionWindowService();
  const overlays = options.overlays ?? new CardOverlayResolver();
  const invariantGuard = options.invariantGuard ?? new RunStateInvariantGuard();
  const outcomeResolver = options.outcomeResolver ?? new RuntimeOutcomeResolver();
  const checkpointStore = options.checkpointStore ?? new RuntimeCheckpointStore();
  const traceRecorder = options.traceRecorder ?? new TickTraceRecorder();
  const proofSealer = new ProofSealer();
  const threatRouter = new ThreatRoutingService();
  const modeCompiler = new ModeRuleCompiler();

  if (options.engines && options.engines.length > 0) {
    registry.registerMany(options.engines, { allowReplace: false });
  }

  if (options.enforceTickSequence !== false) {
    assertValidTickSequence();
  }

  const orchestrator = new EngineOrchestrator({
    registry,
    bus,
    clock,
    windows,
    overlays,
    invariantGuard,
    outcomeResolver,
    checkpointStore,
    traceRecorder,
    modeHooksByMode: options.modeHooksByMode,
    enforceCompleteRegistry: options.enforceCompleteRegistry,
    failFastOnInvariantError: options.failFastOnInvariantError,
  });

  const runtime = new EngineRuntime({
    registry,
    bus,
    clock: clock as DeterministicClock,
    windows,
    overlays,
  });

  return Object.freeze({
    orchestrator,
    runtime,
    registry,
    bus,
    clock,
    windows,
    overlays,
    invariantGuard,
    outcomeResolver,
    checkpointStore,
    traceRecorder,
    proofSealer,
    threatRouter,
    modeCompiler,
  });
}

// ============================================================================
// MARK: CoreMLSignal — ML/DL routing surface
// ============================================================================

/**
 * The canonical ML signal envelope emitted by the core engine layer.
 * All ML/DL actions flow through this structure before being dispatched.
 */
export interface CoreMLSignal {
  readonly signalId: string;
  readonly tick: number;
  readonly runId: string;
  readonly mode: ModeCode;
  readonly engineId: string;
  readonly featureKey: string;
  readonly featureVector: readonly number[];
  readonly predictedValue: number;
  readonly confidence: number;
  readonly actionType: CoreMLActionType;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly emittedAtMs: number;
}

export type CoreMLActionType =
  | 'TIMING_ADAPT'
  | 'PRESSURE_PREDICT'
  | 'CARD_RECOMMEND'
  | 'THREAT_CLASSIFY'
  | 'CASCADE_PREDICT'
  | 'OUTCOME_ESTIMATE'
  | 'SHIELD_OPTIMIZE'
  | 'TENSION_SCORE'
  | 'DECISION_PACE'
  | 'CHAT_SIGNAL';

/**
 * DL input tensor descriptor for deep learning inference.
 */
export interface CoreDLTensorDescriptor {
  readonly signalId: string;
  readonly tick: number;
  readonly runId: string;
  readonly mode: ModeCode;
  readonly inputShape: readonly number[];
  readonly outputShape: readonly number[];
  readonly inputData: readonly number[];
  readonly modelKey: string;
  readonly inferenceContext: Readonly<Record<string, unknown>>;
}

/**
 * ML routing hub — aggregates signals across all engine subsystems
 * and routes them to the appropriate ML/DL models.
 */
export class CoreMLRouter {
  private readonly signals: CoreMLSignal[] = [];
  private readonly tensors: CoreDLTensorDescriptor[] = [];
  private readonly maxSignals: number;
  private readonly maxTensors: number;

  public constructor(options: { maxSignals?: number; maxTensors?: number } = {}) {
    this.maxSignals = options.maxSignals ?? 2_048;
    this.maxTensors = options.maxTensors ?? 512;
  }

  /**
   * Emit an ML signal from any engine layer.
   */
  public emitSignal(signal: Omit<CoreMLSignal, 'signalId'>): CoreMLSignal {
    const signalId = createDeterministicId(
      'ml-signal',
      signal.runId,
      signal.tick,
      signal.engineId,
      signal.featureKey,
      signal.emittedAtMs,
    );

    const full: CoreMLSignal = Object.freeze({ ...signal, signalId });

    this.signals.push(full);

    if (this.signals.length > this.maxSignals) {
      this.signals.splice(0, this.signals.length - this.maxSignals);
    }

    return full;
  }

  /**
   * Submit a DL tensor for model inference.
   */
  public submitTensor(tensor: Omit<CoreDLTensorDescriptor, 'signalId'>): CoreDLTensorDescriptor {
    const signalId = createDeterministicId(
      'dl-tensor',
      tensor.runId,
      tensor.tick,
      tensor.modelKey,
    );

    const full: CoreDLTensorDescriptor = Object.freeze({ ...tensor, signalId });
    this.tensors.push(full);

    if (this.tensors.length > this.maxTensors) {
      this.tensors.splice(0, this.tensors.length - this.maxTensors);
    }

    return full;
  }

  /**
   * Get all signals for a given action type.
   */
  public getSignalsByAction(actionType: CoreMLActionType): readonly CoreMLSignal[] {
    return this.signals.filter((s) => s.actionType === actionType);
  }

  /**
   * Get all signals for a given run.
   */
  public getSignalsForRun(runId: string): readonly CoreMLSignal[] {
    return this.signals.filter((s) => s.runId === runId);
  }

  /**
   * Get the most recent signal for a given feature key.
   */
  public getLatestSignal(featureKey: string): CoreMLSignal | null {
    for (let i = this.signals.length - 1; i >= 0; i--) {
      if (this.signals[i].featureKey === featureKey) {
        return this.signals[i];
      }
    }
    return null;
  }

  /**
   * Get all pending tensors for a given model.
   */
  public getTensorsForModel(modelKey: string): readonly CoreDLTensorDescriptor[] {
    return this.tensors.filter((t) => t.modelKey === modelKey);
  }

  /**
   * Drain all signals and tensors (after batch inference).
   */
  public drain(): { signals: readonly CoreMLSignal[]; tensors: readonly CoreDLTensorDescriptor[] } {
    const signals = Object.freeze([...this.signals]);
    const tensors = Object.freeze([...this.tensors]);
    this.signals.length = 0;
    this.tensors.length = 0;
    return { signals, tensors };
  }

  /**
   * Reset the router (on run start).
   */
  public reset(): void {
    this.signals.length = 0;
    this.tensors.length = 0;
  }

  public signalCount(): number {
    return this.signals.length;
  }

  public tensorCount(): number {
    return this.tensors.length;
  }
}

// ============================================================================
// MARK: CoreSnapshotInspector — read-only analytics over RunStateSnapshot
// ============================================================================

/**
 * Stateless analytics surface. Reads a snapshot and emits structured
 * insights used by ML models, chat adapters, and the proof chain.
 */
export class CoreSnapshotInspector {
  /**
   * Compute the net shield integrity ratio (0.0–1.0).
   */
  public static shieldIntegrityRatio(snapshot: RunStateSnapshot): number {
    const layers = snapshot.shield.layers;
    if (layers.length === 0) return 1.0;
    const total = layers.reduce((s, l) => s + l.max, 0);
    const current = layers.reduce((s, l) => s + l.current, 0);
    return total === 0 ? 1.0 : Math.min(1.0, current / total);
  }

  /**
   * Compute normalized economy progress toward freedom target.
   */
  public static economyProgressRatio(snapshot: RunStateSnapshot): number {
    const { netWorth, freedomTarget } = snapshot.economy;
    if (freedomTarget <= 0) return 0;
    return Math.min(1.0, Math.max(0, netWorth / freedomTarget));
  }

  /**
   * Compute time budget consumption ratio (0.0–1.0).
   */
  public static timeBudgetConsumptionRatio(snapshot: RunStateSnapshot): number {
    const total = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    if (total <= 0) return 1.0;
    return Math.min(1.0, snapshot.timers.elapsedMs / total);
  }

  /**
   * Compute average decision latency over the last N decisions.
   */
  public static avgDecisionLatencyMs(snapshot: RunStateSnapshot, window = 10): number {
    const decisions = snapshot.telemetry.decisions.slice(-window).filter((d) => d.accepted);
    if (decisions.length === 0) return 0;
    return decisions.reduce((s, d) => s + d.latencyMs, 0) / decisions.length;
  }

  /**
   * Check whether the run is in endgame (within 30s of budget).
   */
  public static isEndgame(snapshot: RunStateSnapshot): boolean {
    const total = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    return total - snapshot.timers.elapsedMs <= 30_000;
  }

  /**
   * Count active cascade chains by positive/negative classification.
   */
  public static cascadeStats(snapshot: RunStateSnapshot): { positive: number; negative: number; broken: number; completed: number } {
    const positive = snapshot.cascade.activeChains.filter((c) => c.positive).length;
    const negative = snapshot.cascade.activeChains.filter((c) => !c.positive).length;
    return {
      positive,
      negative,
      broken: snapshot.cascade.brokenChains,
      completed: snapshot.cascade.completedChains,
    };
  }

  /**
   * Compute sabotage defense rate (blocked / total sabotage exposure).
   */
  public static sabotageDefenseRate(snapshot: RunStateSnapshot): number {
    const blocked = snapshot.shield.blockedThisRun;
    const total = blocked + snapshot.shield.breachesThisRun;
    return total === 0 ? 1.0 : blocked / total;
  }

  /**
   * Emit a ML feature vector derived from the snapshot for DL model ingestion.
   * This is the canonical DL input extraction path.
   */
  public static extractDLInputVector(snapshot: RunStateSnapshot): number[] {
    const PRESSURE_ORDER = ['T0', 'T1', 'T2', 'T3', 'T4'];
    const PHASE_ORDER = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
    const MODE_ORDER = ['solo', 'pvp', 'coop', 'ghost'];

    return [
      snapshot.pressure.score,
      PRESSURE_ORDER.indexOf(snapshot.pressure.tier) / 4,
      PHASE_ORDER.indexOf(snapshot.phase) / 2,
      MODE_ORDER.indexOf(snapshot.mode) / 3,
      CoreSnapshotInspector.shieldIntegrityRatio(snapshot),
      CoreSnapshotInspector.economyProgressRatio(snapshot),
      CoreSnapshotInspector.timeBudgetConsumptionRatio(snapshot),
      snapshot.tension.score,
      snapshot.tension.anticipation,
      Math.min(1, snapshot.tension.visibleThreats.length / 5),
      CoreSnapshotInspector.sabotageDefenseRate(snapshot),
      snapshot.cascade.activeChains.length / 10,
      snapshot.cards.hand.length / 8,
      snapshot.modeState.bleedMode ? 1 : 0,
      snapshot.battle.firstBloodClaimed ? 1 : 0,
      Math.min(1, snapshot.modeState.sharedTreasuryBalance / 50_000),
      snapshot.sovereignty.gapVsLegend,
      snapshot.sovereignty.gapClosingRate,
      CoreSnapshotInspector.avgDecisionLatencyMs(snapshot) / 10_000,
      CoreSnapshotInspector.isEndgame(snapshot) ? 1 : 0,
    ];
  }

  /**
   * Compute the canonical tick checksum for integrity proofs.
   */
  public static computeChecksum(snapshot: RunStateSnapshot): string {
    return checksumSnapshot({
      runId: snapshot.runId,
      tick: snapshot.tick,
      outcome: snapshot.outcome,
      economy: { cash: snapshot.economy.cash, netWorth: snapshot.economy.netWorth },
      pressure: { tier: snapshot.pressure.tier, score: snapshot.pressure.score },
    });
  }

  /**
   * Build a compact summary for chat adapter ingestion.
   */
  public static buildChatSummary(snapshot: RunStateSnapshot): Readonly<{
    tick: number;
    mode: ModeCode;
    phase: string;
    pressureTier: string;
    pressureScore: number;
    shieldPct: number;
    economyProgress: number;
    isEndgame: boolean;
    outcome: string | null;
    cascadeActiveCount: number;
    tensionScore: number;
    decisionLatencyAvg: number;
  }> {
    return Object.freeze({
      tick: snapshot.tick,
      mode: snapshot.mode,
      phase: snapshot.phase,
      pressureTier: snapshot.pressure.tier,
      pressureScore: snapshot.pressure.score,
      shieldPct: CoreSnapshotInspector.shieldIntegrityRatio(snapshot),
      economyProgress: CoreSnapshotInspector.economyProgressRatio(snapshot),
      isEndgame: CoreSnapshotInspector.isEndgame(snapshot),
      outcome: snapshot.outcome,
      cascadeActiveCount: snapshot.cascade.activeChains.length,
      tensionScore: snapshot.tension.score,
      decisionLatencyAvg: CoreSnapshotInspector.avgDecisionLatencyMs(snapshot),
    });
  }
}

// ============================================================================
// MARK: CoreEventRouter — route engine events to downstream consumers
// ============================================================================

/**
 * Routes EngineEventMap events to chat, ML, and analytics consumers.
 * Wired by the main engine/index.ts startup.
 */
export class CoreEventRouter {
  private readonly mlRouter: CoreMLRouter;
  private readonly chatListeners: Array<(summary: ReturnType<typeof CoreSnapshotInspector.buildChatSummary>) => void> = [];
  private readonly signalListeners: Array<(signal: CoreMLSignal) => void> = [];

  public constructor(mlRouter: CoreMLRouter) {
    this.mlRouter = mlRouter;
  }

  /**
   * Bind to an EventBus and route all events.
   */
  public bindTo(
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
    getSnapshot: () => RunStateSnapshot | null,
    nowMs: () => number,
  ): void {
    bus.onAny((envelope) => {
      const snapshot = getSnapshot();
      if (!snapshot) return;

      this.routeEngineEvent(envelope.event as keyof EngineEventMap, snapshot, nowMs());
    });
  }

  /**
   * Register a listener for chat summary updates.
   */
  public onChatSummary(listener: (summary: ReturnType<typeof CoreSnapshotInspector.buildChatSummary>) => void): () => void {
    this.chatListeners.push(listener);
    return () => {
      const index = this.chatListeners.indexOf(listener);
      if (index >= 0) this.chatListeners.splice(index, 1);
    };
  }

  /**
   * Register a listener for ML signals.
   */
  public onMLSignal(listener: (signal: CoreMLSignal) => void): () => void {
    this.signalListeners.push(listener);
    return () => {
      const index = this.signalListeners.indexOf(listener);
      if (index >= 0) this.signalListeners.splice(index, 1);
    };
  }

  public reset(): void {
    this.chatListeners.length = 0;
    this.signalListeners.length = 0;
  }

  private routeEngineEvent(
    event: keyof EngineEventMap,
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): void {
    const actionType = this.mapEventToMLAction(event);
    if (!actionType) return;

    const featureVector = CoreSnapshotInspector.extractDLInputVector(snapshot);

    const signal = this.mlRouter.emitSignal({
      tick: snapshot.tick,
      runId: snapshot.runId,
      mode: snapshot.mode,
      engineId: 'core-router',
      featureKey: event as string,
      featureVector,
      predictedValue: 0,
      confidence: 0.7,
      actionType,
      payload: { event },
      emittedAtMs: nowMs,
    });

    for (const listener of [...this.signalListeners]) {
      listener(signal);
    }

    if (
      event === 'tick.completed' ||
      event === 'pressure.changed' ||
      event === 'shield.breached' ||
      event === 'cascade.chain.created' ||
      event === 'run.started' ||
      event === 'sovereignty.completed'
    ) {
      const summary = CoreSnapshotInspector.buildChatSummary(snapshot);
      for (const listener of [...this.chatListeners]) {
        listener(summary);
      }
    }
  }

  private mapEventToMLAction(event: keyof EngineEventMap): CoreMLActionType | null {
    const MAP: Partial<Record<keyof EngineEventMap, CoreMLActionType>> = {
      'pressure.changed': 'PRESSURE_PREDICT',
      'tick.completed': 'TIMING_ADAPT',
      'tick.started': 'TIMING_ADAPT',
      'card.played': 'CARD_RECOMMEND',
      'threat.routed': 'THREAT_CLASSIFY',
      'cascade.chain.created': 'CASCADE_PREDICT',
      'cascade.chain.progressed': 'CASCADE_PREDICT',
      'shield.breached': 'SHIELD_OPTIMIZE',
      'tension.updated': 'TENSION_SCORE',
      'decision.window.opened': 'DECISION_PACE',
      'decision.window.closed': 'DECISION_PACE',
      'sovereignty.completed': 'OUTCOME_ESTIMATE',
      'proof.sealed': 'OUTCOME_ESTIMATE',
    };
    return MAP[event] ?? null;
  }
}

// ============================================================================
// MARK: CoreRunFactory — convenience run factory that emits the full stack
// ============================================================================

export interface CoreRunContext {
  readonly stack: CoreEngineStack;
  readonly mlRouter: CoreMLRouter;
  readonly eventRouter: CoreEventRouter;
  readonly startResult: ReturnType<EngineOrchestrator['startRun']>;
}

/**
 * Build a complete run context: stack + ML router + event router + run start.
 */
export function startCoreRun(
  input: RunFactoryInput,
  engines: readonly SimulationEngine[] = [],
  options: CoreEngineStackOptions = {},
): CoreRunContext {
  const stack = buildCoreEngineStack({ ...options, engines });
  const mlRouter = new CoreMLRouter();
  const eventRouter = new CoreEventRouter(mlRouter);

  eventRouter.bindTo(
    stack.bus,
    () => {
      try {
        return stack.orchestrator.current();
      } catch {
        return null;
      }
    },
    () => stack.clock.now(),
  );

  const startResult = stack.orchestrator.startRun(input);

  return Object.freeze({ stack, mlRouter, eventRouter, startResult });
}

// ============================================================================
// MARK: CoreDiagnosticsReport — full engine health snapshot
// ============================================================================

export interface CoreDiagnosticsReport {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly engineHealth: readonly EngineHealth[];
  readonly registrySnapshot: ReturnType<EngineRegistry['snapshot']>;
  readonly snapshotChecksum: string;
  readonly shieldIntegrityRatio: number;
  readonly economyProgressRatio: number;
  readonly timeBudgetConsumptionRatio: number;
  readonly cascadeStats: ReturnType<typeof CoreSnapshotInspector.cascadeStats>;
  readonly sabotageDefenseRate: number;
  readonly mlSignalCount: number;
  readonly activeDecisionWindowCount: number;
  readonly recentTraceCount: number;
  readonly checkpointCount: number;
  readonly warnings: readonly string[];
  readonly signals: readonly EngineSignal[];
}

/**
 * Generate a full diagnostics report from a live run context.
 */
export function generateCoreDiagnostics(
  context: CoreRunContext,
  signals: readonly EngineSignal[] = [],
): CoreDiagnosticsReport {
  let snapshot: RunStateSnapshot;
  try {
    snapshot = context.stack.orchestrator.current();
  } catch {
    throw new Error('generateCoreDiagnostics: orchestrator has no active run.');
  }

  return Object.freeze({
    runId: snapshot.runId,
    tick: snapshot.tick,
    mode: snapshot.mode,
    engineHealth: context.stack.orchestrator.getHealth(),
    registrySnapshot: context.stack.registry.snapshot(),
    snapshotChecksum: CoreSnapshotInspector.computeChecksum(snapshot),
    shieldIntegrityRatio: CoreSnapshotInspector.shieldIntegrityRatio(snapshot),
    economyProgressRatio: CoreSnapshotInspector.economyProgressRatio(snapshot),
    timeBudgetConsumptionRatio: CoreSnapshotInspector.timeBudgetConsumptionRatio(snapshot),
    cascadeStats: CoreSnapshotInspector.cascadeStats(snapshot),
    sabotageDefenseRate: CoreSnapshotInspector.sabotageDefenseRate(snapshot),
    mlSignalCount: context.mlRouter.signalCount(),
    activeDecisionWindowCount: Object.keys(snapshot.timers.activeDecisionWindows).length,
    recentTraceCount: context.stack.orchestrator.listRecentTraces(50).length,
    checkpointCount: context.stack.orchestrator.listRunCheckpoints().length,
    warnings: snapshot.telemetry.warnings,
    signals,
  });
}

// ============================================================================
// MARK: Re-export all wire-up utilities needed by the full engine barrel
// ============================================================================

// Make sure all imported classes are re-exported via named exports so
// engine/index.ts Core namespace has zero dead imports.
export {
  DeterministicClock as CoreDeterministicClock,
  SystemClock as CoreSystemClock,
  OffsetClock as CoreOffsetClock,
  FrozenClock as CoreFrozenClock,
  EngineTickTransaction as CoreEngineTickTransaction,
  assertValidTickSequence as coreAssertValidTickSequence,
  isTickStep as coreIsTickStep,
  getTickStepIndex as coreGetTickStepIndex,
  createEngineSignal as coreCreateEngineSignal,
  createEngineHealth as coreCreateEngineHealth,
  normalizeEngineTickResult as coreNormalizeEngineTickResult,
  createInitialRunState as coreCreateInitialRunState,
  checksumSnapshot as coreChecksumSnapshot,
  createDeterministicId as coreCreateDeterministicId,
  deepFreeze as coreDeepFreeze,
  cloneJson as coreCloneJson,
  TICK_SEQUENCE as CORE_TICK_SEQUENCE,
  TICK_STEP_DESCRIPTORS as CORE_TICK_STEP_DESCRIPTORS,
};

// ============================================================================
// MARK: ClockSource — extended analytics and diagnostics surfaces
// ============================================================================

export {
  ClockDriftSampleMonitor,
  ClockTickBudget,
  ClockTickRateAnalyzer,
  ClockPhaseCrossingTracker,
  ClockDiagnosticsService,
  ClockSimulationScheduler,
  ClockReplayValidator,
  ClockMLFeatureExtractor,
  ClockSourceAdapterSuite,
  diffClockSnapshots,
  serializeClockSnapshot,
  deserializeClockSnapshot,
  clockIsBefore,
  clockIsAfter,
  clockIsBetween,
  clockMidpoint,
  clockTicksFromMs,
  clockMsFromTicks,
  CLOCK_SOURCE_MODULE_VERSION,
  CLOCK_DRIFT_WARN_THRESHOLD_MS,
  CLOCK_DRIFT_CRITICAL_THRESHOLD_MS,
  CLOCK_TICK_BUDGET_VIOLATION_RATE_WARN,
  CLOCK_DIAGNOSTICS_CAPACITY,
  CLOCK_SOURCE_MODULE_READY,
  CLOCK_SOURCE_ADAPTER_SUITE_READY,
  CLOCK_EXTENDED_ML_FEATURE_LABELS,
  CLOCK_EXTENDED_ML_FEATURE_COUNT,
  CLOCK_MODULE_EXPORTS,
  CLOCK_SNAPSHOT_SERIALIZATION_VERSION,
  CLOCK_SOURCE_COMPLETE,
} from './ClockSource';

export type {
  ClockDriftSample,
  ClockDriftSeverity,
  ClockDriftReport,
  ClockTickBudgetEntry,
  ClockTickBudgetReport,
  ClockTickRateSnapshot,
  ClockTickRateReport,
  ClockPhaseCrossing,
  ClockDiagnosticsSnapshot,
  ClockScheduleEntry,
  ClockSchedulerStats,
  ClockReplayFrame,
  ClockReplayValidationResult,
  ClockMLFeatureVector,
  ClockSnapshotDiff,
} from './ClockSource';

// ============================================================================
// MARK: EngineContracts — extended policy enforcement and audit surfaces
// ============================================================================

export {
  EngineContractAuditLog,
  EngineContractPolicyEnforcer,
  EngineContractRollingViolationWindow,
  buildEngineContractDiagnosticsSnapshot,
  gradeContractHealth,
  buildContractHealthSummary,
  DEFAULT_CONTRACT_POLICY,
  ENGINE_CONTRACTS_MODULE_VERSION,
  ENGINE_CONTRACTS_MODULE_READY,
  ENGINE_CONTRACT_VIOLATION_KINDS,
  ENGINE_CONTRACTS_COMPLETE,
} from './EngineContracts';

export type {
  ContractViolationKind,
  ContractViolation,
  ContractPolicy,
  PolicyEnforcementResult,
  EngineContractDiagnosticsSnapshot,
  ViolationWindowSnapshot,
  ContractHealthGrade,
  ContractHealthSummary,
} from './EngineContracts';

// ============================================================================
// MARK: DecisionWindowService — extended analytics and diagnostics
// ============================================================================

export {
  DecisionWindowRollingStats,
  DecisionWindowHealthTracker,
  DecisionWindowMLExtractor,
  DecisionWindowDiagnosticsService,
  DecisionWindowEventLog,
  DECISION_WINDOW_MODULE_VERSION,
  DECISION_WINDOW_MODULE_READY,
  DECISION_WINDOW_ROLLING_CAPACITY,
  DECISION_WINDOW_DL_FEATURE_LABELS,
  DECISION_WINDOW_DL_FEATURE_COUNT,
  DECISION_WINDOW_COMPLETE,
} from './DecisionWindowService';

export type {
  DecisionWindowTickSnapshot,
  DecisionWindowTrend,
  DecisionWindowHealthGrade,
  DecisionWindowHealthReport,
  DecisionWindowDLVector,
  DecisionWindowEventKind,
  DecisionWindowEvent,
} from './DecisionWindowService';

// ============================================================================
// MARK: EngineRuntime — extended rolling window, health, and ML surfaces
// ============================================================================

export {
  EngineRuntimeRollingWindow,
  EngineRuntimeHealthTracker,
  EngineRuntimeMLExtractor,
  EngineRuntimeDiagnosticsService,
  ENGINE_RUNTIME_DL_FEATURE_LABELS,
  ENGINE_RUNTIME_PRESSURE_NUMERIC,
  ENGINE_RUNTIME_MODULE_VERSION,
  ENGINE_RUNTIME_MODULE_READY,
  ENGINE_RUNTIME_DL_FEATURE_COUNT,
  ENGINE_RUNTIME_COMPLETE,
} from './EngineRuntime';

export type {
  EngineRuntimeTickSnapshot,
  EngineRuntimeTrend,
  EngineRuntimeHealthGrade,
  EngineRuntimeHealthReport,
  EngineRuntimeDLVector,
} from './EngineRuntime';

// ============================================================================
// MARK: EngineRegistry — extended rolling stats and health grader
// ============================================================================

export {
  EngineRegistryRollingStats,
  gradeEngineRegistry,
  buildEngineRegistryHealthSummary,
  ENGINE_REGISTRY_MODULE_VERSION,
  ENGINE_REGISTRY_MODULE_READY,
  ENGINE_REGISTRY_ROLLING_CAPACITY,
  ENGINE_REGISTRY_COMPLETE,
} from './EngineRegistry';

export type {
  EngineRegistryTickSnapshot,
  EngineRegistryHealthGrade,
  EngineRegistryHealthSummary,
} from './EngineRegistry';

// ============================================================================
// MARK: CardOverlayResolver — extended rolling stats and health grader
// ============================================================================

export {
  CardOverlayRollingStats,
  gradeCardOverlayHealth,
  buildCardOverlayHealthSummary,
  CARD_OVERLAY_MODULE_VERSION,
  CARD_OVERLAY_MODULE_READY,
  CARD_OVERLAY_ROLLING_CAPACITY,
  CARD_OVERLAY_COMPLETE,
} from './CardOverlayResolver';

export type {
  CardOverlayTickStats,
  CardOverlayHealthGrade,
  CardOverlayHealthSummary,
} from './CardOverlayResolver';

// CoreEngineStack is defined above (line ~598) and exported inline.
// No re-export needed — it is already part of the public surface.

// ============================================================================
// MARK: Core engine version and module manifest
// ============================================================================

export const CORE_ENGINE_MODULE_VERSION = '2.0.0' as const;
export const CORE_ENGINE_MODULE_READY = true;
export const CORE_ENGINE_INDEX_COMPLETE = true;

export const CORE_ENGINE_SUBSYSTEM_VERSIONS = Object.freeze({
  clockSource: CLOCK_SOURCE_MODULE_VERSION,
  engineContracts: ENGINE_CONTRACTS_MODULE_VERSION,
  decisionWindow: DECISION_WINDOW_MODULE_VERSION,
  engineRuntime: ENGINE_RUNTIME_MODULE_VERSION,
  engineRegistry: ENGINE_REGISTRY_MODULE_VERSION,
  cardOverlay: CARD_OVERLAY_MODULE_VERSION,
  checkpointStore: CHECKPOINT_STORE_MODULE_VERSION,
  outcomeResolver: OUTCOME_RESOLVER_MODULE_VERSION,
  threatRouting: THREAT_ROUTING_MODULE_VERSION,
} as const);

// ============================================================================
// MARK: CoreEngineDiagnosticsAggregator
// ============================================================================

/**
 * Aggregates diagnostics snapshots from all core engine sub-systems into a
 * single object. Used by ChatEventBridge and observability pipelines to build
 * per-tick telemetry reports without importing individual sub-systems.
 */
export interface CoreEngineDiagnosticsAggregate {
  readonly tick: number;
  readonly clockReady: boolean;
  readonly registryHealthGrade: EngineRegistryHealthGrade;
  readonly contractHealthGrade: ContractHealthGrade;
  readonly runtimeHealthGrade: EngineRuntimeHealthGrade;
  readonly decisionWindowHealthGrade: DecisionWindowHealthGrade;
  readonly cardOverlayHealthGrade: CardOverlayHealthGrade;
  readonly isAllHealthy: boolean;
  readonly criticalSubsystems: readonly string[];
  readonly subsystemVersions: typeof CORE_ENGINE_SUBSYSTEM_VERSIONS;
}

export function buildCoreEngineDiagnosticsAggregate(
  tick: number,
  registryGrade: EngineRegistryHealthGrade,
  contractGrade: ContractHealthGrade,
  runtimeGrade: EngineRuntimeHealthGrade,
  windowGrade: DecisionWindowHealthGrade,
  overlayGrade: CardOverlayHealthGrade,
): CoreEngineDiagnosticsAggregate {
  const HEALTHY_GRADES = new Set(['S', 'A', 'B']);
  const criticalSubsystems: string[] = [];
  if (!HEALTHY_GRADES.has(registryGrade)) criticalSubsystems.push('engineRegistry');
  if (!HEALTHY_GRADES.has(contractGrade)) criticalSubsystems.push('engineContracts');
  if (!HEALTHY_GRADES.has(runtimeGrade)) criticalSubsystems.push('engineRuntime');
  if (!HEALTHY_GRADES.has(windowGrade)) criticalSubsystems.push('decisionWindow');
  if (!HEALTHY_GRADES.has(overlayGrade)) criticalSubsystems.push('cardOverlay');

  return Object.freeze({
    tick,
    clockReady: CLOCK_SOURCE_MODULE_READY,
    registryHealthGrade: registryGrade,
    contractHealthGrade: contractGrade,
    runtimeHealthGrade: runtimeGrade,
    decisionWindowHealthGrade: windowGrade,
    cardOverlayHealthGrade: overlayGrade,
    isAllHealthy: criticalSubsystems.length === 0,
    criticalSubsystems: Object.freeze(criticalSubsystems),
    subsystemVersions: CORE_ENGINE_SUBSYSTEM_VERSIONS,
  });
}

// ============================================================================
// MARK: CoreMLVectorAggregator — merges DL feature vectors across sub-systems
// ============================================================================

export interface CoreMLAggregateVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly subsystemCount: number;
  readonly generatedAt: number;
}

export function mergeCoreMLVectors(
  tick: number,
  vectors: ReadonlyArray<{ features: readonly number[]; labels: readonly string[] }>,
): CoreMLAggregateVector {
  const features: number[] = [];
  const labels: string[] = [];
  for (const v of vectors) {
    for (let i = 0; i < v.features.length; i++) {
      features.push(v.features[i]);
      labels.push(v.labels[i] ?? `feat_${labels.length}`);
    }
  }
  return Object.freeze({
    tick,
    features: Object.freeze(features),
    labels: Object.freeze(labels),
    subsystemCount: vectors.length,
    generatedAt: Date.now(),
  });
}

// ============================================================================
// MARK: CoreEngineHealthGrader — single composite grade for full engine stack
// ============================================================================

export type CoreEngineHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

const GRADE_NUMERIC: Record<string, number> = {
  S: 6, A: 5, B: 4, C: 3, D: 2, F: 1,
};

export function computeCoreEngineHealthGrade(
  grades: ReadonlyArray<string>,
): CoreEngineHealthGrade {
  if (grades.length === 0) return 'A';
  const min = Math.min(...grades.map(g => GRADE_NUMERIC[g] ?? 1));
  const avg = grades.reduce((s, g) => s + (GRADE_NUMERIC[g] ?? 1), 0) / grades.length;
  const combined = Math.floor((min + avg) / 2);
  if (combined >= 5.5) return 'S';
  if (combined >= 4.5) return 'A';
  if (combined >= 3.5) return 'B';
  if (combined >= 2.5) return 'C';
  if (combined >= 1.5) return 'D';
  return 'F';
}

// ============================================================================
// MARK: CoreEngineIndexSummary — static metadata for observability
// ============================================================================

export const CORE_ENGINE_EXPORTED_SUBSYSTEMS = Object.freeze([
  'GamePrimitives',
  'RunStateFactory',
  'Deterministic',
  'ClockSource',
  'EventBus',
  'EngineContracts',
  'EngineRegistry',
  'EngineRuntime',
  'EngineTickTransaction',
  'EngineOrchestrator',
  'DecisionWindowService',
  'CardOverlayResolver',
  'RuntimeCheckpointStore',
  'RuntimeOutcomeResolver',
  'ThreatRoutingService',
] as const);

export const CORE_ENGINE_ML_FEATURE_COUNTS = Object.freeze({
  clockSource: CLOCK_EXTENDED_ML_FEATURE_COUNT,
  engineRuntime: ENGINE_RUNTIME_DL_FEATURE_COUNT,
  decisionWindow: DECISION_WINDOW_DL_FEATURE_COUNT,
  checkpointStore: CHECKPOINT_ML_FEATURE_COUNT,
  checkpointStoreDL: CHECKPOINT_DL_FEATURE_COUNT,
  outcomeResolver: OUTCOME_ML_FEATURE_COUNT,
  outcomeResolverDL: OUTCOME_DL_FEATURE_COUNT,
  threatRouting: THREAT_ML_FEATURE_COUNT,
  threatRoutingDL: THREAT_DL_FEATURE_COUNT,
} as const);

export const CORE_ENGINE_TOTAL_ML_FEATURES =
  CLOCK_EXTENDED_ML_FEATURE_COUNT +
  ENGINE_RUNTIME_DL_FEATURE_COUNT +
  DECISION_WINDOW_DL_FEATURE_COUNT +
  CHECKPOINT_ML_FEATURE_COUNT +
  OUTCOME_ML_FEATURE_COUNT +
  THREAT_ML_FEATURE_COUNT;

// CoreEngineDiagnosticsAggregate, CoreMLAggregateVector, CoreEngineHealthGrade
// are all defined inline in this file and exported directly above.
// No re-export from self needed.

// ============================================================================
// MARK: Utility guards for core sub-system grades
// ============================================================================

export function isCoreHealthGradePassing(grade: string): boolean {
  return grade === 'S' || grade === 'A' || grade === 'B';
}

export function isCoreHealthGradeCritical(grade: string): boolean {
  return grade === 'F' || grade === 'D';
}

export function coreHealthGradeToScore(grade: string): number {
  const map: Record<string, number> = { S: 1, A: 0.85, B: 0.7, C: 0.5, D: 0.3, F: 0 };
  return map[grade] ?? 0.5;
}

// ============================================================================
// MARK: Final module flag
// ============================================================================

export const CORE_INDEX_MODULE_READY = true;

// ============================================================================
// MARK: CoreEngineHealthMonitor — per-tick subsystem grade observer
// ============================================================================

export type CoreEngineHealthCallback = (snapshot: CoreEngineDiagnosticsAggregate) => void;

export class CoreEngineHealthMonitor {
  private readonly _callbacks: CoreEngineHealthCallback[] = [];
  private _lastAggregate: CoreEngineDiagnosticsAggregate | null = null;
  private _degradationCount = 0;
  private _recoveryCount = 0;
  private _tickCount = 0;

  subscribe(cb: CoreEngineHealthCallback): () => void {
    this._callbacks.push(cb);
    return () => {
      const idx = this._callbacks.indexOf(cb);
      if (idx !== -1) this._callbacks.splice(idx, 1);
    };
  }

  observe(aggregate: CoreEngineDiagnosticsAggregate): void {
    this._tickCount++;
    const prev = this._lastAggregate;
    this._lastAggregate = aggregate;

    if (prev !== null) {
      const wasHealthy = prev.isAllHealthy;
      const nowHealthy = aggregate.isAllHealthy;
      if (wasHealthy && !nowHealthy) this._degradationCount++;
      if (!wasHealthy && nowHealthy) this._recoveryCount++;
    }

    for (const cb of this._callbacks) {
      try { cb(aggregate); } catch { /* observer errors are silenced */ }
    }
  }

  get lastAggregate(): CoreEngineDiagnosticsAggregate | null { return this._lastAggregate; }
  get degradationCount(): number { return this._degradationCount; }
  get recoveryCount(): number { return this._recoveryCount; }
  get tickCount(): number { return this._tickCount; }
  get degradationRate(): number {
    return this._tickCount === 0 ? 0 : this._degradationCount / this._tickCount;
  }

  snapshot(): {
    tickCount: number;
    degradationCount: number;
    recoveryCount: number;
    degradationRate: number;
    isCurrentlyHealthy: boolean;
  } {
    return {
      tickCount: this._tickCount,
      degradationCount: this._degradationCount,
      recoveryCount: this._recoveryCount,
      degradationRate: this.degradationRate,
      isCurrentlyHealthy: this._lastAggregate?.isAllHealthy ?? true,
    };
  }

  reset(): void {
    this._lastAggregate = null;
    this._degradationCount = 0;
    this._recoveryCount = 0;
    this._tickCount = 0;
  }
}

// ============================================================================
// MARK: CoreEngineTelemetrySink — captures ML vectors + grades per tick
// ============================================================================

export interface CoreEngineTelemetryRecord {
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly compositeGrade: CoreEngineHealthGrade;
  readonly mlVector: CoreMLAggregateVector;
  readonly criticalSubsystems: readonly string[];
}

export class CoreEngineTelemetrySink {
  private readonly _capacity: number;
  private readonly _records: CoreEngineTelemetryRecord[] = [];

  constructor(capacity = 120) {
    this._capacity = Math.max(1, capacity);
  }

  record(
    aggregate: CoreEngineDiagnosticsAggregate,
    mlVector: CoreMLAggregateVector,
  ): CoreEngineTelemetryRecord {
    const grades = [
      aggregate.registryHealthGrade,
      aggregate.contractHealthGrade,
      aggregate.runtimeHealthGrade,
      aggregate.decisionWindowHealthGrade,
      aggregate.cardOverlayHealthGrade,
    ];
    const entry: CoreEngineTelemetryRecord = Object.freeze({
      tick: aggregate.tick,
      capturedAtMs: Date.now(),
      compositeGrade: computeCoreEngineHealthGrade(grades),
      mlVector,
      criticalSubsystems: aggregate.criticalSubsystems,
    });
    this._records.push(entry);
    if (this._records.length > this._capacity) this._records.shift();
    return entry;
  }

  get records(): readonly CoreEngineTelemetryRecord[] { return this._records; }
  get size(): number { return this._records.length; }

  lastN(n: number): readonly CoreEngineTelemetryRecord[] {
    return this._records.slice(Math.max(0, this._records.length - n));
  }

  gradeDistribution(): Record<CoreEngineHealthGrade, number> {
    const dist: Record<CoreEngineHealthGrade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const r of this._records) dist[r.compositeGrade]++;
    return dist;
  }

  criticalRatio(): number {
    if (this._records.length === 0) return 0;
    return this._records.filter(r => isCoreHealthGradeCritical(r.compositeGrade)).length /
      this._records.length;
  }

  averageFeatureVector(): number[] {
    if (this._records.length === 0) return [];
    const len = this._records[0].mlVector.features.length;
    const sums = new Array<number>(len).fill(0);
    for (const r of this._records) {
      for (let i = 0; i < len; i++) sums[i] += r.mlVector.features[i] ?? 0;
    }
    return sums.map(s => s / this._records.length);
  }

  clear(): void { this._records.length = 0; }
}

// ============================================================================
// MARK: CoreEngineAlertRule — configurable alert rule over health grades
// ============================================================================

export type CoreEngineAlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface CoreEngineAlertRule {
  readonly id: string;
  readonly subsystem: keyof CoreEngineDiagnosticsAggregate | 'composite';
  readonly triggerGrades: readonly string[];
  readonly severity: CoreEngineAlertSeverity;
  readonly cooldownTicks: number;
  readonly message: string;
}

export interface CoreEngineAlert {
  readonly ruleId: string;
  readonly tick: number;
  readonly firedAtMs: number;
  readonly severity: CoreEngineAlertSeverity;
  readonly message: string;
  readonly grade: string;
}

export const DEFAULT_CORE_ENGINE_ALERT_RULES: readonly CoreEngineAlertRule[] = Object.freeze([
  {
    id: 'registry_degraded',
    subsystem: 'registryHealthGrade',
    triggerGrades: ['D', 'F'],
    severity: 'CRITICAL',
    cooldownTicks: 10,
    message: 'Engine registry health is critically degraded',
  },
  {
    id: 'contracts_warn',
    subsystem: 'contractHealthGrade',
    triggerGrades: ['C', 'D', 'F'],
    severity: 'WARN',
    cooldownTicks: 5,
    message: 'Engine contracts showing policy violations',
  },
  {
    id: 'runtime_degraded',
    subsystem: 'runtimeHealthGrade',
    triggerGrades: ['D', 'F'],
    severity: 'CRITICAL',
    cooldownTicks: 8,
    message: 'Engine runtime health is critically degraded',
  },
  {
    id: 'decision_window_warn',
    subsystem: 'decisionWindowHealthGrade',
    triggerGrades: ['C', 'D', 'F'],
    severity: 'WARN',
    cooldownTicks: 5,
    message: 'Decision window service under stress',
  },
  {
    id: 'overlay_degraded',
    subsystem: 'cardOverlayHealthGrade',
    triggerGrades: ['D', 'F'],
    severity: 'CRITICAL',
    cooldownTicks: 10,
    message: 'Card overlay resolver health is critically degraded',
  },
]);

export class CoreEngineAlertEngine {
  private readonly _rules: readonly CoreEngineAlertRule[];
  private readonly _cooldowns = new Map<string, number>();
  private readonly _fired: CoreEngineAlert[] = [];
  private readonly _maxHistory: number;

  constructor(
    rules: readonly CoreEngineAlertRule[] = DEFAULT_CORE_ENGINE_ALERT_RULES,
    maxHistory = 200,
  ) {
    this._rules = rules;
    this._maxHistory = maxHistory;
  }

  evaluate(aggregate: CoreEngineDiagnosticsAggregate): readonly CoreEngineAlert[] {
    const newAlerts: CoreEngineAlert[] = [];
    for (const rule of this._rules) {
      const lastFired = this._cooldowns.get(rule.id) ?? -Infinity;
      if (aggregate.tick - lastFired < rule.cooldownTicks) continue;

      const gradeStr = rule.subsystem === 'composite'
        ? computeCoreEngineHealthGrade([
            aggregate.registryHealthGrade,
            aggregate.contractHealthGrade,
            aggregate.runtimeHealthGrade,
            aggregate.decisionWindowHealthGrade,
            aggregate.cardOverlayHealthGrade,
          ])
        : String((aggregate as unknown as Record<string, unknown>)[rule.subsystem] ?? '');

      if (rule.triggerGrades.includes(gradeStr)) {
        const alert: CoreEngineAlert = Object.freeze({
          ruleId: rule.id,
          tick: aggregate.tick,
          firedAtMs: Date.now(),
          severity: rule.severity,
          message: rule.message,
          grade: gradeStr,
        });
        newAlerts.push(alert);
        this._fired.push(alert);
        this._cooldowns.set(rule.id, aggregate.tick);
      }
    }
    while (this._fired.length > this._maxHistory) this._fired.shift();
    return Object.freeze(newAlerts);
  }

  get firedAlerts(): readonly CoreEngineAlert[] { return this._fired; }

  criticalAlerts(): readonly CoreEngineAlert[] {
    return this._fired.filter(a => a.severity === 'CRITICAL');
  }

  alertsForRule(ruleId: string): readonly CoreEngineAlert[] {
    return this._fired.filter(a => a.ruleId === ruleId);
  }

  reset(): void {
    this._cooldowns.clear();
    this._fired.length = 0;
  }
}

// ============================================================================
// MARK: CoreEngineMLPipeline — end-to-end feature extraction → scoring
// ============================================================================

export interface CoreEngineMLPrediction {
  readonly tick: number;
  readonly healthScore: number;
  readonly pressureScore: number;
  readonly stabilityScore: number;
  readonly riskScore: number;
  readonly confidence: number;
  readonly featureCount: number;
}

export class CoreEngineMLPipeline {
  private readonly _history: CoreEngineMLPrediction[] = [];
  private readonly _capacity: number;
  private _processedTicks = 0;

  constructor(capacity = 60) {
    this._capacity = Math.max(1, capacity);
  }

  process(mlVector: CoreMLAggregateVector): CoreEngineMLPrediction {
    this._processedTicks++;
    const features = mlVector.features;
    const n = features.length;

    const healthScore = n > 0
      ? features.slice(0, Math.ceil(n * 0.3)).reduce((s, f) => s + f, 0) / Math.ceil(n * 0.3)
      : 0.5;

    const pressureScore = n > Math.ceil(n * 0.3)
      ? features.slice(Math.ceil(n * 0.3), Math.ceil(n * 0.6)).reduce((s, f) => s + f, 0) /
        Math.max(1, Math.ceil(n * 0.3))
      : 0.5;

    const stabilityScore = n > Math.ceil(n * 0.6)
      ? features.slice(Math.ceil(n * 0.6), Math.ceil(n * 0.8)).reduce((s, f) => s + f, 0) /
        Math.max(1, Math.ceil(n * 0.2))
      : 0.5;

    const riskScore = Math.max(0, Math.min(1, 1 - (healthScore * 0.5 + stabilityScore * 0.5)));
    const confidence = n >= 10 ? 0.9 : n >= 5 ? 0.7 : 0.5;

    const prediction: CoreEngineMLPrediction = Object.freeze({
      tick: mlVector.tick,
      healthScore: Math.max(0, Math.min(1, healthScore)),
      pressureScore: Math.max(0, Math.min(1, pressureScore)),
      stabilityScore: Math.max(0, Math.min(1, stabilityScore)),
      riskScore,
      confidence,
      featureCount: n,
    });
    this._history.push(prediction);
    if (this._history.length > this._capacity) this._history.shift();
    return prediction;
  }

  get history(): readonly CoreEngineMLPrediction[] { return this._history; }
  get processedTicks(): number { return this._processedTicks; }

  averageRiskScore(): number {
    if (this._history.length === 0) return 0;
    return this._history.reduce((s, p) => s + p.riskScore, 0) / this._history.length;
  }

  averageHealthScore(): number {
    if (this._history.length === 0) return 1;
    return this._history.reduce((s, p) => s + p.healthScore, 0) / this._history.length;
  }

  latestPrediction(): CoreEngineMLPrediction | null {
    return this._history[this._history.length - 1] ?? null;
  }
}

// ============================================================================
// MARK: CoreEngineTickSummaryBuilder — assembles a full per-tick summary
// ============================================================================

export interface CoreEngineTickSummary {
  readonly tick: number;
  readonly builtAtMs: number;
  readonly compositeGrade: CoreEngineHealthGrade;
  readonly compositeScore: number;
  readonly subsystemGrades: {
    readonly registry: string;
    readonly contracts: string;
    readonly runtime: string;
    readonly decisionWindow: string;
    readonly cardOverlay: string;
  };
  readonly criticalSubsystems: readonly string[];
  readonly alerts: readonly CoreEngineAlert[];
  readonly mlPrediction: CoreEngineMLPrediction | null;
  readonly isHealthy: boolean;
}

export class CoreEngineTickSummaryBuilder {
  private readonly _alertEngine: CoreEngineAlertEngine;
  private readonly _mlPipeline: CoreEngineMLPipeline;
  private _builtCount = 0;

  constructor(
    alertEngine: CoreEngineAlertEngine = new CoreEngineAlertEngine(),
    mlPipeline: CoreEngineMLPipeline = new CoreEngineMLPipeline(),
  ) {
    this._alertEngine = alertEngine;
    this._mlPipeline = mlPipeline;
  }

  build(
    aggregate: CoreEngineDiagnosticsAggregate,
    mlVector: CoreMLAggregateVector,
  ): CoreEngineTickSummary {
    this._builtCount++;
    const alerts = this._alertEngine.evaluate(aggregate);
    const mlPrediction = this._mlPipeline.process(mlVector);

    const grades = [
      aggregate.registryHealthGrade,
      aggregate.contractHealthGrade,
      aggregate.runtimeHealthGrade,
      aggregate.decisionWindowHealthGrade,
      aggregate.cardOverlayHealthGrade,
    ];
    const compositeGrade = computeCoreEngineHealthGrade(grades);
    const compositeScore = coreHealthGradeToScore(compositeGrade);

    return Object.freeze({
      tick: aggregate.tick,
      builtAtMs: Date.now(),
      compositeGrade,
      compositeScore,
      subsystemGrades: Object.freeze({
        registry: aggregate.registryHealthGrade,
        contracts: aggregate.contractHealthGrade,
        runtime: aggregate.runtimeHealthGrade,
        decisionWindow: aggregate.decisionWindowHealthGrade,
        cardOverlay: aggregate.cardOverlayHealthGrade,
      }),
      criticalSubsystems: aggregate.criticalSubsystems,
      alerts,
      mlPrediction,
      isHealthy: aggregate.isAllHealthy && alerts.length === 0,
    });
  }

  get builtCount(): number { return this._builtCount; }
  get alertEngine(): CoreEngineAlertEngine { return this._alertEngine; }
  get mlPipeline(): CoreEngineMLPipeline { return this._mlPipeline; }
}

// ============================================================================
// MARK: CoreEngineObservabilitySuite — bundles all monitoring surfaces
// ============================================================================

export class CoreEngineObservabilitySuite {
  readonly healthMonitor: CoreEngineHealthMonitor;
  readonly telemetrySink: CoreEngineTelemetrySink;
  readonly alertEngine: CoreEngineAlertEngine;
  readonly mlPipeline: CoreEngineMLPipeline;
  readonly tickSummaryBuilder: CoreEngineTickSummaryBuilder;

  constructor(
    telemetryCapacity = 120,
    mlHistoryCapacity = 60,
    alertHistoryCapacity = 200,
    alertRules: readonly CoreEngineAlertRule[] = DEFAULT_CORE_ENGINE_ALERT_RULES,
  ) {
    this.healthMonitor = new CoreEngineHealthMonitor();
    this.telemetrySink = new CoreEngineTelemetrySink(telemetryCapacity);
    this.alertEngine = new CoreEngineAlertEngine(alertRules, alertHistoryCapacity);
    this.mlPipeline = new CoreEngineMLPipeline(mlHistoryCapacity);
    this.tickSummaryBuilder = new CoreEngineTickSummaryBuilder(
      this.alertEngine,
      this.mlPipeline,
    );
  }

  processTick(
    aggregate: CoreEngineDiagnosticsAggregate,
    mlVector: CoreMLAggregateVector,
  ): CoreEngineTickSummary {
    this.healthMonitor.observe(aggregate);
    this.telemetrySink.record(aggregate, mlVector);
    return this.tickSummaryBuilder.build(aggregate, mlVector);
  }

  fullSnapshot(): {
    health: ReturnType<CoreEngineHealthMonitor['snapshot']>;
    telemetrySize: number;
    criticalRatio: number;
    averageRiskScore: number;
    totalAlertsEverFired: number;
    gradeDistribution: Record<CoreEngineHealthGrade, number>;
  } {
    return {
      health: this.healthMonitor.snapshot(),
      telemetrySize: this.telemetrySink.size,
      criticalRatio: this.telemetrySink.criticalRatio(),
      averageRiskScore: this.mlPipeline.averageRiskScore(),
      totalAlertsEverFired: this.alertEngine.firedAlerts.length,
      gradeDistribution: this.telemetrySink.gradeDistribution(),
    };
  }

  reset(): void {
    this.healthMonitor.reset();
    this.telemetrySink.clear();
    this.alertEngine.reset();
  }
}

// ============================================================================
// MARK: Module-level constants — feature labels and suite metadata
// ============================================================================

export const CORE_INDEX_ALERT_RULE_IDS = Object.freeze(
  DEFAULT_CORE_ENGINE_ALERT_RULES.map(r => r.id),
);

export const CORE_INDEX_SUBSYSTEM_COUNT = CORE_ENGINE_EXPORTED_SUBSYSTEMS.length;

export const CORE_INDEX_OBSERVABILITY_SUITE_READY = true;

export const CORE_INDEX_COMPLETE = true;
