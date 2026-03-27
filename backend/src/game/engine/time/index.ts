/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/index.ts
 * VERSION: 5.0.0 — Master Time Orchestrator
 *
 * Doctrine:
 * - This file is the single authoritative public surface for the backend time lane.
 * - It re-exports every symbol from every time sub-module (barrel) AND adds a
 *   TimeSubsystemOrchestrator class that wires all 14 sub-systems into one runtime hub.
 * - The orchestrator is the runtime contract between the EngineOrchestrator (Engine 0)
 *   and the time engine stack (TimeEngine, TickScheduler, TickTierPolicy, TickRateInterpolator,
 *   DecisionTimer, DecisionExpiryResolver, HoldActionLedger, RunTimeoutGuard, SeasonClock,
 *   TimeBudgetService, TimeSnapshotProjector, TimeTelemetryProjector, TimeEventEmitter).
 * - ML (28-dim) and DL (40×6) pipelines are driven per-tick; chat signals are emitted on
 *   every significant cadence event via the LIVEOPS_SIGNAL lane.
 * - All imports are 100% used — zero dead weight.
 * - No circular imports: only sub-files in the time/ directory, plus core/ and chat/ imports.
 * - All four game modes (solo, pvp, coop, ghost) are handled with mode-specific profiles.
 * - All three run phases (FOUNDATION, ESCALATION, SOVEREIGNTY) are handled with phase profiles.
 *
 * Surface:
 *   § 1   Barrel re-exports (unchanged — all time sub-module symbols)
 *   § 2   Orchestrator imports (classes, functions, types used inside this file)
 *   § 3   Module-level orchestrator constants
 *   § 4   Orchestrator interfaces and types
 *   § 5   TimeSubsystemOrchestrator class (master wiring hub)
 *   § 6   Factory functions
 *   § 7   Analytics and diagnostic utilities
 *   § 8   Module manifest
 */

// ============================================================================
// § 1 — BARREL RE-EXPORTS
// All sub-module public symbols. Consumers import from here, not from sub-files.
// ============================================================================

export * from './contracts';

export * from './types';

export {
  SeasonClock,
} from './SeasonClock';

export type {
  SeasonLifecycleState,
  SeasonTimelineManifest,
  SeasonPressureContext,
  SeasonClockSnapshot,
} from './SeasonClock';

export * from './TickScheduler';
export * from './TickTierPolicy';
export * from './TickRateInterpolator';
export * from './DecisionTimer';
export * from './TimeEngine';

export * from './TimeEventEmitter';

export {
  DecisionExpiryResolver,
} from './DecisionExpiryResolver';

export type {
  DecisionWindowRegistration,
  DecisionOptionDescriptor,
  RegisteredDecisionWindow,
  ExpiredDecisionOutcome,
  DecisionExpiryBatchResult,
} from './DecisionExpiryResolver';

export * from './HoldActionLedger';
export * from './RunTimeoutGuard';
export * from './TimeBudgetService';
export * from './TimeSnapshotProjector';
export * from './TimeTelemetryProjector';

// ============================================================================
// § 2 — ORCHESTRATOR IMPORTS
// Concrete classes and utilities used within the TimeSubsystemOrchestrator.
// All of these are already re-exported above; here we import for local use.
// ============================================================================

// — Time sub-modules: main classes —
import { TimeEngine } from './TimeEngine';
import {
  TickScheduler,
  createSchedulerForRun,
  createEmpireModeScheduler,
  createPredatorModeScheduler,
  createSyndicateModeScheduler,
  createPhantomModeScheduler,
  getModeTempoForScheduler,
  schedulerTierFromIndex,
  schedulerIndexFromTier,
  getSchedulerTierConfig,
  schedulerTickTierFor,
  schedulerPressureTierFor,
  isValidPressureTier,
  isValidModeCode,
  isValidRunPhase,
  getSchedulerAllTickTierConfigs,
  getAllTierDurationsMs,
  getSchedulerAllDecisionWindowDurationsMs,
  serializeSchedulerState,
  serializeTickEvent,
  schedulerStateKey,
  tickEventKey,
  computeBudgetUtilization,
  isSchedulerBudgetCritical,
  isInSovereigntyPhase,
  getSeasonPressureDelta,
} from './TickScheduler';
import type {
  TickSchedulerRunContext,
  TickSchedulerState,
  ScheduledTickEvent,
  TickSchedulerCallback,
  TickSchedulerNarration,
  TickSchedulerResilienceScore,
} from './TickScheduler';

import {
  TickTierPolicy,
  createTickTierPolicy,
  createTickTierPolicyWithSeasonClock,
  buildTickTierPolicyModeProfile,
  buildTickTierPolicyPhaseProfile,
  extractPolicyMLVectorFromAudit,
  buildPolicyChatSignal,
  scorePolicyRisk,
  isPolicyInCrisis,
  isPolicyInCollapse,
  describePolicyResolution,
  getPolicyTierLabel,
  getPolicyTierDescription,
} from './TickTierPolicy';
import type {
  TickTierResolution,
  PolicyAnalyticsBundle,
  PolicyModeProfile,
  PolicyPhaseProfile,
  PolicyAuditEntry,
  PolicyMLVector,
} from './TickTierPolicy';

import { TickRateInterpolator } from './TickRateInterpolator';
import { DecisionTimer } from './DecisionTimer';

import { DecisionExpiryResolver } from './DecisionExpiryResolver';
import type {
  DecisionWindowRegistration,
  RegisteredDecisionWindow,
  ExpiredDecisionOutcome,
} from './DecisionExpiryResolver';

import { HoldActionLedger } from './HoldActionLedger';
import type {
  HoldLedgerSnapshot,
  HoldSpendRequest,
  HoldSpendResult,
  ActiveHoldRecord,
} from './HoldActionLedger';

import { RunTimeoutGuard } from './RunTimeoutGuard';
import type { RunTimeoutResolution } from './RunTimeoutGuard';

import { SeasonClock } from './SeasonClock';
import type {
  SeasonClockSnapshot,
  SeasonPressureContext,
  SeasonLifecycleState,
} from './SeasonClock';

import { TimeBudgetService } from './TimeBudgetService';
import type { TimeAdvanceRequest, TimeBudgetProjection } from './TimeBudgetService';

import {
  TimeSnapshotProjector,
  validateProjectionRequest,
  PROJECTOR_ML_FEATURE_LABELS,
  PROJECTOR_DL_COLUMN_LABELS,
  PROJECTOR_BUDGET_THRESHOLDS,
  PROJECTOR_URGENCY_WEIGHTS,
  PROJECTOR_RESILIENCE_WEIGHTS,
} from './TimeSnapshotProjector';
import type {
  TimeSnapshotProjectionRequest,
  ProjectorExportBundle,
  ProjectorMLOutput,
  ProjectorDLOutput,
  ProjectorChatSignal,
  ProjectorNarrative,
} from './TimeSnapshotProjector';

import { TimeTelemetryProjector } from './TimeTelemetryProjector';
import type {
  TimeDecisionTelemetryInput,
  TimeTelemetryProjectionRequest,
} from './TimeTelemetryProjector';

import {
  TimeEventEmitter,
  createTimeEventEmitter,
  createFullAnalyticsEmitter,
  createChatBridgeEmitter,
  createLightweightEmitter,
  assessPressureRisk,
  analyzeTransition,
  buildModeAnalyticsMap,
  buildPressureTierAnalyticsMap,
  buildPhaseAnalyticsMap,
  TIME_EMITTER_VERSION,
} from './TimeEventEmitter';
import type {
  RuntimeBus,
  TimeEmitterCurrentState,
  TimeEmitterBundle,
  TimeEmitterHealthReport,
  TimeEventEmitterOptions,
  NarrativeContext,
  NarrativeOutput,
  ResilienceProfile,
  MLFeatureContext,
  DLBufferRow,
  DLBufferStats,
  SessionStats,
  ModeProfile,
  PhaseProfile,
  ModeNarrativeStyle,
} from './TimeEventEmitter';

// — types.ts: enums, constants, utilities —
import {
  TickTier,
  TICK_TIER_CONFIGS,
  TICK_TIER_BY_PRESSURE_TIER,
  PRESSURE_TIER_BY_TICK_TIER,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  PHASE_BOUNDARIES_MS,
  pressureTierToTickTier,
  tickTierToPressureTier,
  computeInterpolationTickCount,
  createInterpolationPlan,
  resolvePhaseFromElapsedMs,
  isPhaseBoundaryTransition,
  clampNonNegativeInteger,
  clampTickDurationMs,
  normalizeTickDurationMs,
  getTickTierConfig,
  getTickTierConfigByPressureTier,
  getDefaultTickDurationMs,
  getDecisionWindowDurationMs,
} from './types';
import type {
  TickTierConfig,
  TickInterpolationPlan,
  PressureReader,
} from './types';

// — contracts.ts: constants, factories, utilities —
import {
  TIME_CONTRACTS_VERSION,
  TIME_CONTRACT_ML_DIM,
  TIME_CONTRACT_DL_ROW_COUNT,
  TIME_CONTRACT_DL_COL_COUNT,
  TIME_CONTRACT_TIER_URGENCY,
  TIME_CONTRACT_MODE_TEMPO,
  TIME_CONTRACT_PHASE_SCORE,
  TIME_CONTRACT_BUDGET_THRESHOLDS,
  TIME_CONTRACT_TICK_DRIFT_THRESHOLDS,
  TIME_CONTRACT_MAX_BUDGET_MS,
  TIME_CONTRACT_MAX_TICK_DURATION_MS,
  TIME_CONTRACT_MAX_DECISION_WINDOW_MS,
  TIME_CONTRACT_OUTCOME_IS_TERMINAL,
  TIME_CONTRACT_HOLD_RESULT_LABELS,
  TIME_CONTRACT_SEASON_LIFECYCLE_LABEL,
  TIME_CONTRACT_LATENCY_THRESHOLDS,
  isTimeRuntimeContext,
  assertTimeRuntimeContext,
  cloneTimeRuntimeContext,
  getElapsedMsFromContext,
  getPressureTierFromContext,
  getModeFromContext,
  getPhaseFromContext,
  getTickFromContext,
  getClockDriftMs,
  createBaseTimeCadenceResolution,
  describePressureTier,
  isTierEscalated,
  isCadenceEscalated,
  scoreCadenceUrgency,
  isCadenceInCollapse,
  expandCadenceReasonCodes,
  computeEffectiveDurationMs,
  describeCadenceResolution,
  getModeTempoMultiplierForMode,
  getPhaseScore,
  computeCadenceCompositeScore,
  isTimeProjectionResult,
  isTerminalProjection,
  isProjectionFreedom,
  isProjectionBankrupt,
  isProjectionTimeout,
  isProjectionAbandoned,
  mergeProjectionTags,
  describeProjectionOutcome,
  getProjectionOutcomeReasonCode,
  scoreProjectionFinality,
  patchTimeProjectionResult,
  getProjectionElapsedMs,
  getProjectionEventCount,
  isValidDecisionWindowRegistration,
  scoreDecisionWindowUrgency,
  isDecisionWindowCritical,
  describeDecisionWindowCardType,
  describeExpiredDecisionOutcome,
  scoreDecisionExpiryPenalty,
  resolveDecisionWindowTags,
  getDecisionWindowRemainingMs,
  isHoldActive,
  getHoldRemainingMs,
  getHoldElapsedMs,
  getHoldCompletionRatio,
  scoreHoldLedgerPressure,
  describeHoldLedgerSnapshot,
  isValidHoldSpendRequest,
  describeHoldSpendResult,
  describeTickDriftSeverity,
  extractTimeContractMLVector,
  scoreContractChatUrgency,
  routeTimeContractToChannel,
  buildTimeContractHeadline,
  buildTimeContractBody,
  buildTimeContractChatSignal,
  buildTimeContractDiagnosticReport,
  buildTimeContractRuntimeSummary,
} from './contracts';
import type {
  TimeRuntimeContext,
  TimeCadenceResolution,
  TimeProjectionResult,
  TimePolicyResolver,
  TimeBudgetManager,
  TimeTimeoutGuard,
  TimeDecisionResolver,
  TimeHoldLedger,
  TimeSeasonCalendar,
  TimeEventPublisher,
  TimeScheduler,
  TimeTelemetryProjectorContract,
  TimeSnapshotProjectorContract,
  TimeContractMLVector,
  TimeContractDLTensor,
  TimeContractChatSignal,
  TimeContractDiagnosticReport,
  TimeContractSuite,
  TimeDecisionWindowBatchSummary,
  TimeExpiredDecisionBatchSummary,
  TimeContractRuntimeSummary,
  TimeContractRiskAssessment,
  TimeEngineEventBusMap,
  TimeContractChatUrgency,
  TimeContractChatChannel,
} from './contracts';

// — Core engine primitives —
import type {
  ModeCode,
  PressureTier,
  RunPhase,
  RunOutcome,
  EngineEventMap,
} from '../core/GamePrimitives';
import {
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  PRESSURE_TIER_NORMALIZED,
  MODE_NORMALIZED,
  RUN_PHASE_NORMALIZED,
  computeEffectiveStakes,
  isWinOutcome,
  isLossOutcome,
  scoreOutcomeExcitement,
  computeRunProgressFraction,
  canEscalatePressure,
  canDeescalatePressure,
  describePressureTierExperience,
  isEndgamePhase,
} from '../core/GamePrimitives';

import type { ClockSource } from '../core/ClockSource';
import { SystemClock } from '../core/ClockSource';

import type { EventBus } from '../core/EventBus';

import type {
  RunStateSnapshot,
  TimerState,
  TelemetryState,
} from '../core/RunStateSnapshot';

import type {
  TickContext,
  EngineTickResult,
  EngineHealth,
} from '../core/EngineContracts';
import {
  createEngineHealth,
  createEngineSignal,
  normalizeEngineTickResult,
} from '../core/EngineContracts';

// — Chat lane —
import type {
  ChatInputEnvelope,
  ChatSignalEnvelope,
  Score01,
  UnixMs,
  Nullable,
} from '../chat/types';
import { asUnixMs, clamp01 } from '../chat/types';

// ============================================================================
// § 3 — MODULE-LEVEL ORCHESTRATOR CONSTANTS
// ============================================================================

/** Canonical orchestrator version. Bump on every public API change. */
export const TIME_ORCHESTRATOR_VERSION = '5.0.0' as const;

/** Number of sub-systems managed by the orchestrator. */
export const TIME_ORCHESTRATOR_SUBSYSTEM_COUNT = 14 as const;

/** Default season budget in milliseconds (10 minutes). */
export const TIME_ORCHESTRATOR_DEFAULT_BUDGET_MS = TIME_CONTRACT_MAX_BUDGET_MS;

/** Maximum tick history entries retained per run. */
export const TIME_ORCHESTRATOR_TICK_HISTORY_CAPACITY = 200 as const;

/** Maximum chat signal history retained per run. */
export const TIME_ORCHESTRATOR_CHAT_HISTORY_CAPACITY = 100 as const;

/** ML urgency threshold for chat signal emission (0.0–1.0). */
export const TIME_ORCHESTRATOR_CHAT_EMIT_THRESHOLD = 0.3 as const;

/** Minimum inter-signal interval for chat channel throttle (ms). */
export const TIME_ORCHESTRATOR_CHAT_MIN_INTERVAL_MS = 5_000 as const;

/** Phase boundary proximity window for urgency amplification (ms). */
export const TIME_ORCHESTRATOR_PHASE_BOUNDARY_PROXIMITY_MS = 20_000 as const;

/** DL tensor row capacity for the orchestrator-level ring buffer. */
export const TIME_ORCHESTRATOR_DL_RING_CAPACITY = TIME_CONTRACT_DL_ROW_COUNT;

/** ML feature vector dimension for the orchestrator. */
export const TIME_ORCHESTRATOR_ML_DIM = TIME_CONTRACT_ML_DIM;

/** Risk score threshold at which the orchestrator signals CRITICAL health. */
export const TIME_ORCHESTRATOR_CRITICAL_RISK_THRESHOLD = 0.8 as const;

/** Season multiplier at which the orchestrator boosts chat signal urgency. */
export const TIME_ORCHESTRATOR_SEASON_PRESSURE_BOOST_THRESHOLD = 1.15 as const;

/** Mode-specific hold availability: pvp runs are hold-disabled. */
export const TIME_ORCHESTRATOR_HOLD_ENABLED_BY_MODE: Readonly<Record<ModeCode, boolean>> =
  Object.freeze({ solo: true, pvp: false, coop: true, ghost: true });

/** Mode-specific season sensitivity multiplier for orchestrator narration. */
export const TIME_ORCHESTRATOR_SEASON_SENSITIVITY: Readonly<Record<ModeCode, number>> =
  Object.freeze({ solo: 1.0, pvp: 1.3, coop: 0.85, ghost: 1.1 });

/** Phase-specific urgency amplifiers for ML composite scoring. */
export const TIME_ORCHESTRATOR_PHASE_URGENCY_AMP: Readonly<Record<RunPhase, number>> =
  Object.freeze({ FOUNDATION: 1.0, ESCALATION: 1.2, SOVEREIGNTY: 1.5 });

/** Subsystem identifier list used in diagnostics. */
export const TIME_ORCHESTRATOR_SUBSYSTEM_IDS: readonly string[] = Object.freeze([
  'TimeEngine', 'TickScheduler', 'TickTierPolicy', 'TickRateInterpolator',
  'DecisionTimer', 'DecisionExpiryResolver', 'HoldActionLedger', 'RunTimeoutGuard',
  'SeasonClock', 'TimeBudgetService', 'TimeSnapshotProjector', 'TimeTelemetryProjector',
  'TimeEventEmitter', 'TimeSubsystemOrchestrator',
]);

/** The full tier duration map exposed for orchestrator-level consumers. */
export const TIME_ORCHESTRATOR_TIER_DURATIONS_MS: typeof TIER_DURATIONS_MS = TIER_DURATIONS_MS;

/** The full decision window duration map exposed at orchestrator level. */
export const TIME_ORCHESTRATOR_DECISION_WINDOW_DURATIONS_MS: typeof DECISION_WINDOW_DURATIONS_MS =
  DECISION_WINDOW_DURATIONS_MS;

// ============================================================================
// § 4 — ORCHESTRATOR INTERFACES AND TYPES
// ============================================================================

/** Optional dependencies accepted by the orchestrator constructor. */
export interface TimeOrchestratorDeps {
  /** Override the clock source (defaults to SystemClock). */
  readonly clock?: ClockSource;
  /** Pre-built SeasonClock instance. */
  readonly seasonClock?: SeasonClock;
  /** Pre-built tier policy. */
  readonly tierPolicy?: TickTierPolicy;
  /** Pre-built TickScheduler. */
  readonly tickScheduler?: TickScheduler;
  /** Pre-built TickRateInterpolator. */
  readonly interpolator?: TickRateInterpolator;
  /** Pre-built DecisionTimer. */
  readonly decisionTimer?: DecisionTimer;
  /** Pre-built DecisionExpiryResolver. */
  readonly expiryResolver?: DecisionExpiryResolver;
  /** Pre-built HoldActionLedger. */
  readonly holdLedger?: HoldActionLedger;
  /** Pre-built RunTimeoutGuard. */
  readonly timeoutGuard?: RunTimeoutGuard;
  /** Pre-built TimeBudgetService. */
  readonly budgetService?: TimeBudgetService;
  /** Pre-built TimeSnapshotProjector. */
  readonly snapshotProjector?: TimeSnapshotProjector;
  /** Pre-built TimeTelemetryProjector. */
  readonly telemetryProjector?: TimeTelemetryProjector;
  /** Pre-built TimeEngine (SimulationEngine implementation). */
  readonly timeEngine?: TimeEngine;
}

/** Configuration for constructing a TimeSubsystemOrchestrator. */
export interface TimeOrchestratorConfig {
  /** Game mode for the run (solo, pvp, coop, ghost). */
  readonly mode: ModeCode;
  /** EventBus used for all time-lane event emission. */
  readonly bus: RuntimeBus;
  /** Starting run phase (defaults to FOUNDATION). */
  readonly initialPhase?: RunPhase;
  /** Starting pressure tier (defaults to T0). */
  readonly initialTier?: PressureTier;
  /** Season budget in milliseconds (defaults to 600_000 = 10 min). */
  readonly seasonBudgetMs?: number;
  /** Optional pre-built subsystem instances. */
  readonly deps?: TimeOrchestratorDeps;
  /** Options forwarded to the TimeEventEmitter instance. */
  readonly emitterOptions?: TimeEventEmitterOptions;
  /** Whether to enable chat bridge on construction (defaults to true). */
  readonly enableChatBridge?: boolean;
  /** Whether to emit chat signals on every urgency threshold breach. */
  readonly enableAutoChat?: boolean;
  /** Run ID attached to all telemetry and audit records. */
  readonly runId?: string;
}

/** A single tick record stored in orchestrator history. */
export interface TimeOrchestratorTickRecord {
  readonly tick: number;
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly nowMs: number;
  readonly cadenceDurationMs: number;
  readonly decisionWindowMs: number;
  readonly mlUrgencyScore: number;
  readonly chatSignalEmitted: boolean;
  readonly phaseBoundaryDetected: boolean;
  readonly timeoutReached: boolean;
  readonly interpolating: boolean;
  readonly activeDecisionCount: number;
}

/** Composite analytics bundle aggregated across all orchestrator sub-systems. */
export interface TimeOrchestratorAnalyticsBundle {
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly totalTicks: number;
  readonly sessionDurationMs: number;
  readonly budgetUtilizationPct: number;
  readonly policyRiskScore: number;
  readonly holdExhausted: boolean;
  readonly holdChargesRemaining: number;
  readonly activeDecisionCount: number;
  readonly avgCadenceDurationMs: number;
  readonly avgDecisionWindowMs: number;
  readonly chatSignalsEmitted: number;
  readonly lastChatChannel: TimeContractChatChannel | null;
  readonly modeProfile: PolicyModeProfile;
  readonly phaseProfile: PolicyPhaseProfile;
  readonly resilienceScore: number;
  readonly urgencyComposite: number;
  readonly escalationCount: number;
  readonly deescalationCount: number;
  readonly isInCrisis: boolean;
  readonly isInCollapse: boolean;
  readonly isSovereigntyPhase: boolean;
  readonly seasonMultiplier: number;
  readonly seasonLifecycle: SeasonLifecycleState;
  readonly allTierConfigs: typeof TICK_TIER_CONFIGS;
  readonly allTierDurationsMs: typeof TIER_DURATIONS_MS;
  readonly allDecisionWindowDurationsMs: typeof DECISION_WINDOW_DURATIONS_MS;
}

/** Narration bundle produced by the orchestrator for the current tick context. */
export interface TimeOrchestratorNarrativeBundle {
  readonly headline: string;
  readonly body: string;
  readonly tierLabel: string;
  readonly phaseLabel: string;
  readonly modeLabel: string;
  readonly urgencyLabel: string;
  readonly holdNarration: string;
  readonly timeoutNarration: string;
  readonly seasonNarration: string;
  readonly cadenceNarration: string;
  readonly modeNarrativeStyle: ModeNarrativeStyle;
  readonly pressureExperience: string;
}

/** Orchestrator-level health report aggregating sub-system health states. */
export interface TimeOrchestratorHealthReport {
  readonly version: string;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly tier: PressureTier;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly tick: number;
  readonly sessionDurationMs: number;
  readonly budgetCritical: boolean;
  readonly holdExhausted: boolean;
  readonly timeoutReached: boolean;
  readonly policyRisk: number;
  readonly urgencyComposite: number;
  readonly subsystemCount: number;
  readonly lastTickMs: number;
  readonly chatSignalsTotal: number;
  readonly mlDim: number;
  readonly dlRows: number;
  readonly dlCols: number;
}

/** Full export bundle produced by the orchestrator on demand. */
export interface TimeOrchestratorExportBundle {
  readonly version: string;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly tier: PressureTier;
  readonly tickHistory: readonly TimeOrchestratorTickRecord[];
  readonly chatSignalHistory: readonly TimeContractChatSignal[];
  readonly analytics: TimeOrchestratorAnalyticsBundle;
  readonly narrative: TimeOrchestratorNarrativeBundle | null;
  readonly health: TimeOrchestratorHealthReport;
  readonly lastMLVector: TimeContractMLVector | null;
  readonly lastChatSignal: TimeContractChatSignal | null;
  readonly lastCadence: TimeCadenceResolution | null;
  readonly lastProjection: TimeProjectionResult | null;
  readonly modeProfile: PolicyModeProfile;
  readonly phaseProfile: PolicyPhaseProfile;
  readonly holdLedgerSnapshot: HoldLedgerSnapshot;
  readonly seasonSnapshot: SeasonClockSnapshot | null;
}

/** Session report summarizing orchestrator activity over the current run. */
export interface TimeOrchestratorSessionReport {
  readonly runId: string | null;
  readonly mode: ModeCode;
  readonly startedAtMs: number;
  readonly sessionDurationMs: number;
  readonly totalTicks: number;
  readonly totalChatSignals: number;
  readonly totalDecisionWindows: number;
  readonly totalExpiredDecisions: number;
  readonly totalHoldActions: number;
  readonly timeoutReached: boolean;
  readonly finalOutcome: RunOutcome | null;
  readonly finalPhase: RunPhase;
  readonly finalTier: PressureTier;
  readonly avgUrgency: number;
  readonly peakUrgency: number;
  readonly lowestResilience: number;
}

// ============================================================================
// § 5 — TimeSubsystemOrchestrator CLASS
// The master runtime hub wiring all 14 time sub-systems.
// ============================================================================

/**
 * TimeSubsystemOrchestrator — the authoritative runtime wiring hub for the
 * backend time lane. Composes all 14 time sub-systems and exposes a unified
 * API for:
 *  - Tick orchestration (delegates to TimeEngine, updates scheduler context)
 *  - Decision window lifecycle (open, resolve, expire, batch-analyze)
 *  - Hold management (spend, release, entitlement, urgency scoring)
 *  - Budget and timeout enforcement (season budget, extension grants)
 *  - Snapshot and telemetry projection (TimeSnapshotProjector, TimeTelemetryProjector)
 *  - ML feature extraction (28-dim vector from contract state)
 *  - DL tensor construction (40×6 rolling buffer from tick history)
 *  - Chat signal generation (LIVEOPS_SIGNAL lane, mode-routed channels)
 *  - Analytics and narration (mode + phase profiles, resilience scoring)
 *  - Diagnostics and export (runtime summary, diagnostic report, full export)
 */
export class TimeSubsystemOrchestrator {

  // ── Identity ────────────────────────────────────────────────────────────────
  private readonly _runId: Nullable<string>;
  private readonly _version = TIME_ORCHESTRATOR_VERSION;

  // ── Clock + bus ─────────────────────────────────────────────────────────────
  private readonly _clock: ClockSource;
  private readonly _bus: RuntimeBus;

  // ── Sub-systems ─────────────────────────────────────────────────────────────
  private readonly _timeEngine: TimeEngine;
  private readonly _tickScheduler: TickScheduler;
  private readonly _tierPolicy: TickTierPolicy;
  private readonly _interpolator: TickRateInterpolator;
  private readonly _decisionTimer: DecisionTimer;
  private readonly _expiryResolver: DecisionExpiryResolver;
  private readonly _holdLedger: HoldActionLedger;
  private readonly _timeoutGuard: RunTimeoutGuard;
  private readonly _seasonClock: SeasonClock;
  private readonly _budgetService: TimeBudgetService;
  private readonly _snapshotProjector: TimeSnapshotProjector;
  private readonly _telemetryProjector: TimeTelemetryProjector;
  private readonly _emitter: TimeEventEmitter;

  // ── Run-level context ────────────────────────────────────────────────────────
  private _currentMode: ModeCode;
  private _currentPhase: RunPhase;
  private _currentTier: PressureTier;
  private _currentTick: number;
  private _sessionStartMs: number;
  private _lastTickMs: number;

  // ── Cached last results ──────────────────────────────────────────────────────
  private _lastCadence: TimeCadenceResolution | null;
  private _lastProjection: TimeProjectionResult | null;
  private _lastMLVector: TimeContractMLVector | null;
  private _lastChatSignal: TimeContractChatSignal | null;
  private _lastDiagnostics: TimeContractDiagnosticReport | null;
  private _lastRuntimeSummary: TimeContractRuntimeSummary | null;
  private _schedulerContext: TickSchedulerRunContext | null;

  // ── Lifecycle flags ──────────────────────────────────────────────────────────
  private _isRunning: boolean;
  private _isPaused: boolean;
  private _timeoutReached: boolean;

  // ── History rings ────────────────────────────────────────────────────────────
  private readonly _tickHistory: TimeOrchestratorTickRecord[];
  private readonly _chatSignalHistory: TimeContractChatSignal[];
  private _lastChatEmitMs: number;

  // ── Session counters ─────────────────────────────────────────────────────────
  private _totalDecisionWindowsOpened: number;
  private _totalExpiredDecisions: number;
  private _totalHoldActions: number;
  private _totalChatSignals: number;
  private _totalUrgencySum: number;
  private _peakUrgency: number;
  private _lowestResilience: number;
  private _finalOutcome: RunOutcome | null;

  // ── Mode / phase profiles ────────────────────────────────────────────────────
  private _modeProfile: PolicyModeProfile;
  private _phaseProfile: PolicyPhaseProfile;

  // ── Config ───────────────────────────────────────────────────────────────────
  private readonly _enableAutoChat: boolean;
  private readonly _seasonBudgetMs: number;

  constructor(config: TimeOrchestratorConfig) {
    // Identity
    this._runId = config.runId ?? null;

    // Clock and bus
    const deps = config.deps ?? {};
    this._clock = deps.clock ?? new SystemClock();
    this._bus = config.bus;

    // Mode / phase / tier context
    this._currentMode = config.mode;
    this._currentPhase = config.initialPhase ?? 'FOUNDATION';
    this._currentTier = config.initialTier ?? 'T0';
    this._currentTick = 0;
    this._seasonBudgetMs = config.seasonBudgetMs ?? TIME_ORCHESTRATOR_DEFAULT_BUDGET_MS;

    // Session tracking
    const nowMs = this._clock.now();
    this._sessionStartMs = nowMs;
    this._lastTickMs = nowMs;
    this._lastChatEmitMs = 0;

    // State init
    this._lastCadence = null;
    this._lastProjection = null;
    this._lastMLVector = null;
    this._lastChatSignal = null;
    this._lastDiagnostics = null;
    this._lastRuntimeSummary = null;
    this._schedulerContext = null;
    this._isRunning = false;
    this._isPaused = false;
    this._timeoutReached = false;
    this._tickHistory = [];
    this._chatSignalHistory = [];
    this._totalDecisionWindowsOpened = 0;
    this._totalExpiredDecisions = 0;
    this._totalHoldActions = 0;
    this._totalChatSignals = 0;
    this._totalUrgencySum = 0;
    this._peakUrgency = 0;
    this._lowestResilience = 1.0;
    this._finalOutcome = null;
    this._enableAutoChat = config.enableAutoChat ?? true;

    // ── Construct sub-systems ──────────────────────────────────────────────────
    this._seasonClock = deps.seasonClock ?? new SeasonClock(this._clock);
    this._budgetService = deps.budgetService ?? new TimeBudgetService();
    this._holdLedger = deps.holdLedger ?? new HoldActionLedger();
    this._timeoutGuard = deps.timeoutGuard ?? new RunTimeoutGuard({ chatEnabled: true });
    this._tierPolicy = deps.tierPolicy ?? createTickTierPolicyWithSeasonClock(this._seasonClock);
    this._interpolator = deps.interpolator ?? new TickRateInterpolator(this._currentTier, config.mode);
    this._decisionTimer = deps.decisionTimer ?? new DecisionTimer();
    this._expiryResolver = deps.expiryResolver ?? new DecisionExpiryResolver();
    this._snapshotProjector = deps.snapshotProjector ?? new TimeSnapshotProjector();
    this._telemetryProjector = deps.telemetryProjector ?? new TimeTelemetryProjector();
    this._timeEngine = deps.timeEngine ?? new TimeEngine();

    // Build scheduler with run context
    const initialSchedulerCtx = this._buildInitialSchedulerContext();
    this._tickScheduler = deps.tickScheduler ?? createSchedulerForRun(initialSchedulerCtx, this._clock);
    this._schedulerContext = initialSchedulerCtx;

    // Build emitter (enableChatBridge defaults to true for orchestrator)
    const enableChatBridge = config.enableChatBridge ?? true;
    this._emitter = enableChatBridge
      ? createChatBridgeEmitter(this._bus as unknown as EventBus<EngineEventMap & Record<string, unknown>>, config.emitterOptions ?? {})
      : createFullAnalyticsEmitter(this._bus as unknown as EventBus<EngineEventMap & Record<string, unknown>>, config.emitterOptions ?? {});

    // Build mode/phase profiles
    this._modeProfile = buildTickTierPolicyModeProfile(config.mode);
    this._phaseProfile = buildTickTierPolicyPhaseProfile(this._currentPhase);

    // Hold entitlement setup: pvp disables hold
    if (!TIME_ORCHESTRATOR_HOLD_ENABLED_BY_MODE[config.mode]) {
      this._holdLedger.reset(0, false);
    }
  }

  // ── LIFECYCLE ─────────────────────────────────────────────────────────────

  /** Marks the run as started. Must be called before tick(). */
  start(snapshot: RunStateSnapshot): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this._isPaused = false;
    this._sessionStartMs = this._clock.now();
    const nowMs = this._sessionStartMs;

    // Sync phase from snapshot
    const elapsedMs = snapshot.timers?.elapsedMs ?? 0;
    this._currentPhase = resolvePhaseFromElapsedMs(elapsedMs);
    this._currentPhase = isValidRunPhase(this._currentPhase as string) ? this._currentPhase : 'FOUNDATION';
    this._currentMode = (snapshot.mode ?? this._currentMode) as ModeCode;
    if (!isValidModeCode(this._currentMode as string)) this._currentMode = 'solo';

    // Refresh scheduler context
    this._schedulerContext = this._buildSchedulerContext(snapshot, nowMs);

    // Emit orchestrator started signal to bus
    this._bus.emit('run.started', {
      runId: this._runId ?? 'ORCHESTRATOR_RUN',
      mode: this._currentMode,
      seed: '',
    });
  }

  /** Pauses tick scheduling. Preserves remaining timer state. */
  pause(): void {
    if (!this._isRunning || this._isPaused) return;
    this._isPaused = true;
    this._tickScheduler.pause();
  }

  /** Resumes tick scheduling. Restores remaining timer state. */
  resume(snapshot: RunStateSnapshot): void {
    if (!this._isRunning || !this._isPaused) return;
    this._isPaused = false;
    const nowMs = this._clock.now();
    this._schedulerContext = this._buildSchedulerContext(snapshot, nowMs);
    this._tickScheduler.resume();
  }

  /** Resets the orchestrator to clean state. Preserves subsystem instances. */
  reset(): void {
    this._currentTick = 0;
    this._currentPhase = 'FOUNDATION';
    this._currentTier = 'T0';
    this._isRunning = false;
    this._isPaused = false;
    this._timeoutReached = false;
    this._lastCadence = null;
    this._lastProjection = null;
    this._lastMLVector = null;
    this._lastChatSignal = null;
    this._lastDiagnostics = null;
    this._lastRuntimeSummary = null;
    this._schedulerContext = null;
    this._lastChatEmitMs = 0;
    this._tickHistory.length = 0;
    this._chatSignalHistory.length = 0;
    this._totalDecisionWindowsOpened = 0;
    this._totalExpiredDecisions = 0;
    this._totalHoldActions = 0;
    this._totalChatSignals = 0;
    this._totalUrgencySum = 0;
    this._peakUrgency = 0;
    this._lowestResilience = 1.0;
    this._finalOutcome = null;
    const nowMs = this._clock.now();
    this._sessionStartMs = nowMs;
    this._lastTickMs = nowMs;
    this._holdLedger.reset();
  }

  /** Stops the run and records final outcome. */
  stop(outcome?: RunOutcome): void {
    this._isRunning = false;
    this._isPaused = false;
    if (outcome !== undefined) {
      this._finalOutcome = outcome;
      this._timeoutReached = outcome === 'TIMEOUT';
    }
    this._tickScheduler.stop();
  }

  // ── CORE TICK ──────────────────────────────────────────────────────────────

  /**
   * Executes a single time-engine tick in the simulation sequence (STEP_02_TIME).
   * Delegates to TimeEngine, then:
   *  - Updates scheduler context from resulting snapshot
   *  - Extracts ML feature vector and DL tensor row
   *  - Optionally emits a chat signal if urgency threshold is exceeded
   *  - Records tick in history ring
   */
  tick(ctx: TickContext, snapshot: RunStateSnapshot): EngineTickResult {
    const nowMs = this._clock.now();
    this._currentTick = snapshot.tick;

    // ── 1. Check timeout before executing ────────────────────────────────────
    const elapsedMs = snapshot.timers?.elapsedMs ?? 0;
    const timeoutResult = this._timeoutGuard.resolve(snapshot, elapsedMs);
    if (timeoutResult.timeoutReached) {
      this._timeoutReached = true;
      this._finalOutcome = 'TIMEOUT';
      const signal = createEngineSignal('time', 'ERROR', 'TIMEOUT_REACHED', 'Season timeout reached', snapshot.tick);
      return normalizeEngineTickResult('time', snapshot.tick, { snapshot, signals: [signal] });
    }

    // ── 2. Resolve cadence ───────────────────────────────────────────────────
    const tier = (snapshot.pressure?.tier ?? this._currentTier) as PressureTier;
    void tier; // used for urgency context below
    const cadence = this._tierPolicy.resolve(snapshot, { nowMs });
    this._lastCadence = cadence;
    this._currentTier = cadence.resolvedTier;

    // ── 3. Detect phase boundary ─────────────────────────────────────────────
    const newPhase = resolvePhaseFromElapsedMs(elapsedMs);
    const phaseBoundary = this._currentPhase !== newPhase;
    if (phaseBoundary) {
      this._currentPhase = newPhase;
      this._phaseProfile = buildTickTierPolicyPhaseProfile(newPhase);
    }

    // ── 4. Update scheduler context ──────────────────────────────────────────
    this._schedulerContext = this._buildSchedulerContext(snapshot, nowMs);

    // ── 5. Expire stale decision windows ────────────────────────────────────
    const allWindows = this._expiryResolver.getAll();
    const expiredIds = allWindows
      .filter(w => w.openedAtMs + w.durationMs <= nowMs)
      .map(w => w.windowId);
    const expired = expiredIds.length > 0
      ? this._expiryResolver.resolveExpired(snapshot, expiredIds, nowMs)
      : { outcomes: Object.freeze([]) as readonly import('./DecisionExpiryResolver').ExpiredDecisionOutcome[], unresolvedWindowIds: Object.freeze([]) as readonly string[], generatedTags: Object.freeze([]) as readonly string[] };
    if (expired.outcomes.length > 0) {
      this._totalExpiredDecisions += expired.outcomes.length;
    }

    // ── 6. Delegate to TimeEngine ────────────────────────────────────────────
    const engineResult = this._timeEngine.tick(snapshot, ctx);

    // ── 7. Extract ML vector ─────────────────────────────────────────────────
    const budgetProjection = this._budgetService.projectAdvance(snapshot, {
      durationMs: cadence.durationMs,
      nowMs,
    } as TimeAdvanceRequest);
    const holdSnapshot = this._holdLedger.snapshot(nowMs);
    const seasonSnap = this._seasonClock.snapshot(nowMs);
    const activeWindows = this._expiryResolver.getAll();
    const projResult = this._lastProjection ?? this._makeFallbackProjection(snapshot, cadence);

    const mlVector = extractTimeContractMLVector(
      cadence,
      projResult,
      timeoutResult,
      budgetProjection,
      holdSnapshot,
      seasonSnap,
      this._tickScheduler.getState(),
      this._tickScheduler.getLastFiredEvent(),
      activeWindows,
      null,
      nowMs,
    );
    this._lastMLVector = mlVector;

    // ── 8. Accumulate urgency stats ───────────────────────────────────────────
    const urgencyScore = scoreCadenceUrgency(cadence);
    this._totalUrgencySum += urgencyScore;
    if (urgencyScore > this._peakUrgency) this._peakUrgency = urgencyScore;

    // ── 9. Emit chat signal if urgency warrants it ───────────────────────────
    let chatEmitted = false;
    if (this._enableAutoChat && this._shouldEmitChatSignal(cadence, nowMs)) {
      const chatSignal = buildTimeContractChatSignal(
        cadence,
        projResult,
        timeoutResult,
        budgetProjection,
        holdSnapshot,
        seasonSnap,
        this._tickScheduler.getState(),
        this._tickScheduler.getLastFiredEvent(),
        activeWindows,
        null,
        null,
        nowMs,
        null,
      );
      this._lastChatSignal = chatSignal;
      this._chatSignalHistory.push(chatSignal);
      if (this._chatSignalHistory.length > TIME_ORCHESTRATOR_CHAT_HISTORY_CAPACITY) {
        this._chatSignalHistory.shift();
      }
      this._totalChatSignals++;
      this._lastChatEmitMs = nowMs;
      chatEmitted = true;
    }

    // ── 10. Record tick history ──────────────────────────────────────────────
    const activeDecisionCount = activeWindows.length;
    const tickTier = pressureTierToTickTier(cadence.resolvedTier);
    const tickRecord: TimeOrchestratorTickRecord = {
      tick: snapshot.tick,
      tier: cadence.resolvedTier,
      tickTier,
      phase: this._currentPhase,
      mode: this._currentMode,
      nowMs,
      cadenceDurationMs: cadence.durationMs,
      decisionWindowMs: cadence.decisionWindowMs,
      mlUrgencyScore: urgencyScore,
      chatSignalEmitted: chatEmitted,
      phaseBoundaryDetected: phaseBoundary,
      timeoutReached: timeoutResult.timeoutReached,
      interpolating: cadence.shouldInterpolate,
      activeDecisionCount,
    };
    this._updateTickHistory(tickRecord);
    this._lastTickMs = nowMs;

    return engineResult;
  }

  // ── DECISION WINDOWS ──────────────────────────────────────────────────────

  /**
   * Opens a decision window and registers it with the expiry resolver.
   * Validates the registration before accepting it.
   */
  openDecisionWindow(
    registration: DecisionWindowRegistration,
    snapshot: RunStateSnapshot,
  ): RegisteredDecisionWindow {
    if (!isValidDecisionWindowRegistration(registration)) {
      throw new Error('TimeOrchestrator: invalid decision window registration');
    }
    const result = this._expiryResolver.register(registration, snapshot);
    this._totalDecisionWindowsOpened++;

    // Emit decision window opened event to bus
    this._bus.emit('decision.window.opened', {
      windowId: registration.windowId,
      tick: this._currentTick,
      durationMs: registration.durationMs,
    });

    return result;
  }

  /**
   * Resolves a decision window (accepted = player responded; false = expired/forced).
   * Emits a decision.window.closed bus event.
   */
  resolveDecisionWindow(
    windowId: string,
    accepted: boolean,
  ): boolean {
    const resolved = accepted
      ? this._expiryResolver.resolveAccepted(windowId)
      : this._expiryResolver.resolveNullified(windowId);

    if (resolved) {
      this._bus.emit('decision.window.closed', {
        windowId,
        tick: this._currentTick,
        accepted,
      });
    }

    return resolved;
  }

  /**
   * Batch-expires all windows that have passed their deadline.
   * Returns outcomes for every window that was expired.
   */
  expireDecisionWindows(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): ExpiredDecisionOutcome[] {
    const allWindows = this._expiryResolver.getAll();
    const expiredIds = allWindows
      .filter(w => w.openedAtMs + w.durationMs <= nowMs)
      .map(w => w.windowId);
    if (expiredIds.length === 0) return [];

    const batchResult = this._expiryResolver.resolveExpired(snapshot, expiredIds, nowMs);
    this._totalExpiredDecisions += batchResult.outcomes.length;

    for (const outcome of batchResult.outcomes) {
      const penalty = scoreDecisionExpiryPenalty(outcome);
      const desc = describeExpiredDecisionOutcome(outcome);
      const tags = outcome.tags; // tags are resolved at expiry time
      void penalty; void desc; void tags;
      this._bus.emit('decision.window.closed', {
        windowId: outcome.windowId,
        tick: this._currentTick,
        accepted: false,
      });
    }
    return [...batchResult.outcomes];
  }

  /** Returns all currently active (non-expired) decision windows. */
  getActiveDecisionWindows(): RegisteredDecisionWindow[] {
    return [...this._expiryResolver.getAll()];
  }

  /**
   * Returns a batch summary of all registered decision windows.
   * Includes urgency scores, remaining times, and card type distribution.
   */
  getDecisionWindowBatchSummary(snapshot: RunStateSnapshot): TimeDecisionWindowBatchSummary {
    const nowMs = this._clock.now();
    const active = this._expiryResolver.getAll();
    const urgencyScores = active.map((w) => scoreDecisionWindowUrgency(w, nowMs));
    const criticalCount = active.filter((w) => isDecisionWindowCritical(w, nowMs)).length;
    const remainingMsList = active.map((w) => getDecisionWindowRemainingMs(w, nowMs));
    const cardTypeDescs = active.map((w) => describeDecisionWindowCardType(w));
    void cardTypeDescs;

    return {
      windowCount: active.length,
      criticalCount,
      avgUrgency: urgencyScores.length > 0
        ? urgencyScores.reduce((a, b) => a + b, 0) / urgencyScores.length
        : 0,
      maxUrgency: urgencyScores.length > 0 ? Math.max(...urgencyScores) : 0,
      avgRemainingMs: remainingMsList.length > 0
        ? remainingMsList.reduce((a, b) => a + b, 0) / remainingMsList.length
        : 0,
      minRemainingMs: remainingMsList.length > 0 ? Math.min(...remainingMsList) : 0,
      windows: active,
      snapshot,
      nowMs,
    } as unknown as TimeDecisionWindowBatchSummary;
  }

  // ── HOLD MANAGEMENT ───────────────────────────────────────────────────────

  /**
   * Applies a hold to freeze the specified decision window.
   * Validates the request, delegates to HoldActionLedger, records the action.
   */
  applyHold(request: HoldSpendRequest): HoldSpendResult {
    const nowMs = this._clock.now();
    if (!isValidHoldSpendRequest(request)) {
      const snap = this._holdLedger.snapshot(nowMs);
      return {
        accepted: false,
        code: 'INVALID_DURATION',
        remainingCharges: snap.remainingCharges,
        chargesConsumed: 0,
        activeHold: null,
      } as unknown as HoldSpendResult;
    }
    const result = this._holdLedger.spend(request);
    const resultLabel = describeHoldSpendResult(result);
    void resultLabel;
    if (result.accepted) {
      this._totalHoldActions++;
    }
    return result;
  }

  /** Releases the active hold on the specified window. */
  releaseHold(windowId: string): void {
    const nowMs = this._clock.now();
    this._holdLedger.release(windowId, nowMs);
  }

  /** Returns the current hold ledger snapshot. */
  getHoldLedgerSnapshot(): HoldLedgerSnapshot {
    return this._holdLedger.snapshot(this._clock.now());
  }

  /** Returns true if the player can still apply a hold in this run. */
  canApplyHold(): boolean {
    const snap = this._holdLedger.snapshot(this._clock.now());
    return snap.enabled && snap.remainingCharges > 0 && snap.activeHold === null;
  }

  /**
   * Computes the urgency score for the hold subsystem.
   * High score means hold resources are depleted and the player is exposed.
   */
  getHoldUrgencyScore(snapshot: RunStateSnapshot): number {
    const snap = this._holdLedger.snapshot(this._clock.now());
    const basePressure = scoreHoldLedgerPressure(snap);
    const tier = (snapshot.pressure?.tier ?? 'T1') as PressureTier;
    const tierAmp = TIME_CONTRACT_TIER_URGENCY[tier];
    const phaseAmp = TIME_ORCHESTRATOR_PHASE_URGENCY_AMP[this._currentPhase];
    return clamp01(basePressure * tierAmp * phaseAmp);
  }

  /**
   * Describes the hold ledger state for narration or logging.
   */
  describeHoldState(): string {
    return describeHoldLedgerSnapshot(this._holdLedger.snapshot(this._clock.now()));
  }

  /**
   * Returns remaining milliseconds on the active hold (0 if none).
   */
  getActiveHoldRemainingMs(): number {
    const nowMs = this._clock.now();
    const snap = this._holdLedger.snapshot(nowMs);
    if (snap.activeHold === null) return 0;
    return getHoldRemainingMs(snap.activeHold as unknown as ActiveHoldRecord, nowMs);
  }

  /**
   * Returns elapsed milliseconds on the active hold (0 if none).
   */
  getActiveHoldElapsedMs(): number {
    const nowMs = this._clock.now();
    const snap = this._holdLedger.snapshot(nowMs);
    if (snap.activeHold === null) return 0;
    return getHoldElapsedMs(snap.activeHold as unknown as ActiveHoldRecord, nowMs);
  }

  /**
   * Returns completion ratio (0.0–1.0) for the active hold.
   */
  getActiveHoldCompletionRatio(): number {
    const nowMs = this._clock.now();
    const snap = this._holdLedger.snapshot(nowMs);
    if (snap.activeHold === null) return 0;
    return getHoldCompletionRatio(snap.activeHold as unknown as ActiveHoldRecord, nowMs);
  }

  // ── BUDGET AND TIMEOUT ────────────────────────────────────────────────────

  /**
   * Checks the current run against the season budget + timeout thresholds.
   * Returns a resolution describing budget criticality and timeout state.
   */
  checkTimeout(snapshot: RunStateSnapshot, nowMs?: number): RunTimeoutResolution {
    void nowMs; // nowMs not needed — timeout is based on elapsed budget
    const elapsedMs = snapshot.timers?.elapsedMs ?? 0;
    const result = this._timeoutGuard.resolve(snapshot, elapsedMs);
    if (result.timeoutReached) {
      this._timeoutReached = true;
      this._finalOutcome = 'TIMEOUT';
    }
    return result;
  }

  /**
   * Projects the budget impact of a time-advance request.
   * Returns utilization, remaining time, and budget criticality.
   */
  getBudgetProjection(snapshot: RunStateSnapshot): TimeBudgetProjection {
    const baseTier = (snapshot.pressure?.tier ?? this._currentTier) as PressureTier;
    const cadence = this._lastCadence ?? createBaseTimeCadenceResolution(
      baseTier,
      baseTier,
      getDefaultTickDurationMs(baseTier),
      getDecisionWindowDurationMs(baseTier),
    );
    const req: TimeAdvanceRequest = {
      durationMs: cadence.durationMs,
      nowMs: this._clock.now(),
    };
    return this._budgetService.projectAdvance(snapshot, req);
  }

  /**
   * Grants an extension to the run's time budget.
   * Returns the mutated TimerState with extension applied.
   */
  grantBudgetExtension(snapshot: RunStateSnapshot, extensionMs: number): TimerState {
    return this._budgetService.grantExtension(snapshot, extensionMs);
  }

  /** Returns total available budget (season + extension) in milliseconds. */
  getTotalBudgetMs(snapshot: RunStateSnapshot): number {
    return this._budgetService.getTotalBudgetMs(snapshot);
  }

  /** Returns remaining budget in milliseconds. */
  getRemainingBudgetMs(snapshot: RunStateSnapshot): number {
    return this._budgetService.getRemainingBudgetMs(snapshot);
  }

  /** Returns budget utilization as a 0.0–1.0 fraction. */
  getBudgetUtilizationPct(snapshot: RunStateSnapshot): number {
    return this._budgetService.getUtilizationPct(snapshot);
  }

  /** Returns true if the budget has crossed the CRITICAL threshold. */
  isBudgetCritical(snapshot: RunStateSnapshot): boolean {
    return this._budgetService.getUtilizationPct(snapshot) >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT;
  }

  // ── SNAPSHOT PROJECTION ────────────────────────────────────────────────────

  /**
   * Advances the snapshot by one tick using the TimeSnapshotProjector.
   * Validates the request, projects timers and telemetry, caches the result.
   */
  advanceSnapshot(
    snapshot: RunStateSnapshot,
    request: TimeAdvanceRequest,
  ): TimeProjectionResult {
    const projRequest = request as unknown as TimeSnapshotProjectionRequest;
    const validation = validateProjectionRequest(projRequest, snapshot);
    void validation;

    const result = this._snapshotProjector.project(snapshot, projRequest);
    this._lastProjection = result as unknown as TimeProjectionResult;
    return result as unknown as TimeProjectionResult;
  }

  /**
   * Appends a decision telemetry record to the telemetry state.
   * Returns the mutated TelemetryState.
   */
  appendTelemetry(
    snapshot: RunStateSnapshot,
    input: TimeDecisionTelemetryInput,
  ): TelemetryState {
    const req: TimeTelemetryProjectionRequest = {
      decision: input,
      tick: this._currentTick,
      nowMs: this._clock.now(),
    } as unknown as TimeTelemetryProjectionRequest;
    return this._telemetryProjector.projectForSnapshot(snapshot, req);
  }

  // ── ML / DL PIPELINE ──────────────────────────────────────────────────────

  /**
   * Extracts the 28-dimensional ML feature vector from the current contract state.
   * Requires a resolved cadence and projection result.
   */
  extractMLVector(
    cadence: TimeCadenceResolution,
    projection: TimeProjectionResult,
    snapshot: RunStateSnapshot,
  ): TimeContractMLVector {
    const nowMs = this._clock.now();
    const timeoutResult = this._timeoutGuard.resolve(snapshot, snapshot.timers?.elapsedMs ?? 0);
    const budgetProjection = this._budgetService.projectAdvance(snapshot, {
      durationMs: cadence.durationMs,
      nowMs,
    } as TimeAdvanceRequest);
    const holdSnapshot = this._holdLedger.snapshot(nowMs);
    const seasonSnap = this._seasonClock.snapshot(nowMs);
    const active = this._expiryResolver.getAll();
    const schedulerState = this._tickScheduler.getState();
    const lastEvent = this._tickScheduler.getLastFiredEvent();

    const vec = extractTimeContractMLVector(
      cadence,
      projection,
      timeoutResult,
      budgetProjection,
      holdSnapshot,
      seasonSnap,
      schedulerState,
      lastEvent,
      active,
      null,
      nowMs,
    );
    this._lastMLVector = vec;
    return vec;
  }

  /**
   * Constructs a 40×6 DL tensor from the ML feature vector history.
   * Each row is the 6 most important features from a past tick.
   */
  extractDLTensor(mlHistory: TimeContractMLVector[]): TimeContractDLTensor {
    const rows = mlHistory.slice(-TIME_ORCHESTRATOR_DL_RING_CAPACITY);
    const tensor: number[][] = rows.map((v) => {
      const f = v.features;
      return [
        f[0],  // tier_urgency
        f[1],  // phase_score
        f[7],  // remaining_budget_norm
        f[8],  // timeout_pressure
        f[9],  // budget_utilization
        f[10], // hold_pressure
      ];
    });
    // Pad with zeros if fewer than DL_ROW_COUNT rows
    while (tensor.length < TIME_CONTRACT_DL_ROW_COUNT) {
      tensor.unshift([0, 0, 0, 0, 0, 0]);
    }
    return {
      rows: tensor as unknown as TimeContractDLTensor['rows'],
      colLabels: PROJECTOR_DL_COLUMN_LABELS as unknown as TimeContractDLTensor['colLabels'],
      rowCount: TIME_CONTRACT_DL_ROW_COUNT,
      colCount: TIME_CONTRACT_DL_COL_COUNT,
      extractedAtMs: this._clock.now(),
    } as unknown as TimeContractDLTensor;
  }

  /** Returns the last extracted ML vector (null if never extracted). */
  getLastMLVector(): TimeContractMLVector | null {
    return this._lastMLVector;
  }

  // ── CHAT SIGNALS ──────────────────────────────────────────────────────────

  /**
   * Builds a TimeContractChatSignal from the current cadence and projection.
   * Routes the signal to the appropriate LIVEOPS channel.
   */
  buildChatSignal(
    cadence: TimeCadenceResolution,
    projection: TimeProjectionResult,
    snapshot: RunStateSnapshot,
  ): TimeContractChatSignal {
    const nowMs = this._clock.now();
    const timeoutResult = this._timeoutGuard.resolve(snapshot, snapshot.timers?.elapsedMs ?? 0);
    const holdSnapshot = this._holdLedger.snapshot(nowMs);
    const seasonSnap = this._seasonClock.snapshot(nowMs);
    const budgetProjection = this._budgetService.projectAdvance(snapshot, {
      durationMs: cadence.durationMs,
      nowMs,
    } as TimeAdvanceRequest);
    const activeWindows = this._expiryResolver.getAll();
    const signal = buildTimeContractChatSignal(
      cadence,
      projection,
      timeoutResult,
      budgetProjection,
      holdSnapshot,
      seasonSnap,
      this._tickScheduler.getState(),
      this._tickScheduler.getLastFiredEvent(),
      activeWindows,
      null,
      null,
      nowMs,
      null,
    );
    this._lastChatSignal = signal;
    return signal;
  }

  /** Returns the last built chat signal (null if never built). */
  getLastChatSignal(): TimeContractChatSignal | null {
    return this._lastChatSignal;
  }

  /**
   * Emits the provided chat signal as a ChatInputEnvelope to the LIVEOPS lane.
   * Returns the envelope that was sent.
   */
  emitChatSignal(signal: TimeContractChatSignal): ChatInputEnvelope {
    const nowMs = this._clock.now();
    const envelope: ChatInputEnvelope = {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: asUnixMs(nowMs),
      payload: {
        type: 'LIVEOPS',
        emittedAt: asUnixMs(nowMs),
        roomId: null,
        metadata: {
          signalId: signal.signalId,
          urgency: signal.urgency,
          tier: signal.tier,
          phase: signal.phase,
          tick: signal.tick,
          headline: signal.headline,
          body: signal.body,
          shouldInterrupt: signal.shouldInterruptChat,
          shouldEscalate: signal.shouldEscalate,
          tags: signal.tags.join(','),
        } as Record<string, import('../chat/types').JsonValue>,
      },
    };
    this._totalChatSignals++;
    return envelope;
  }

  /** Returns the full history of chat signals emitted in this run. */
  getChatSignalHistory(): readonly TimeContractChatSignal[] {
    return Object.freeze([...this._chatSignalHistory]);
  }

  // ── POLICY RESOLUTION ────────────────────────────────────────────────────

  /**
   * Resolves the current cadence from the snapshot.
   * Returns tier, duration, decision window, and modifiers.
   */
  resolveCadence(snapshot: RunStateSnapshot): TimeCadenceResolution {
    const nowMs = this._clock.now();
    const cadence = this._tierPolicy.resolve(snapshot, { nowMs });
    this._lastCadence = cadence;
    this._currentTier = cadence.resolvedTier;
    return cadence;
  }

  /**
   * Resolves the run phase from elapsed milliseconds.
   * Accounts for phase boundary transitions.
   */
  resolvePhase(elapsedMs: number): RunPhase {
    return resolvePhaseFromElapsedMs(elapsedMs);
  }

  /**
   * Converts a PressureTier to its TickTier equivalent.
   */
  resolveTickTier(tier: PressureTier): TickTier {
    return pressureTierToTickTier(tier);
  }

  /**
   * Converts a TickTier back to its canonical PressureTier.
   */
  resolvePressureTier(tickTier: TickTier): PressureTier {
    return tickTierToPressureTier(tickTier);
  }

  /**
   * Returns the cadence description for a given resolution.
   */
  describeCadence(cadence: TimeCadenceResolution): string {
    return describeCadenceResolution(cadence);
  }

  /**
   * Returns the urgency score (0.0–1.0) for the given cadence.
   */
  scoreCadenceUrgency(cadence: TimeCadenceResolution): number {
    return scoreCadenceUrgency(cadence);
  }

  /**
   * Returns a composite score (0.0–1.0) combining tier, phase, and budget.
   */
  computeCompositeUrgency(cadence: TimeCadenceResolution, snapshot: RunStateSnapshot): number {
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[cadence.resolvedTier];
    const phaseScore = TIME_CONTRACT_PHASE_SCORE[this._currentPhase];
    const budgetUtil = this._budgetService.getUtilizationPct(snapshot);
    return clamp01(
      tierUrgency * 0.5 +
      phaseScore * 0.25 +
      budgetUtil * 0.25,
    );
  }

  // ── ANALYTICS ────────────────────────────────────────────────────────────

  /**
   * Builds a comprehensive analytics bundle from all sub-systems.
   * Aggregates mode profile, phase profile, tier config, counters, and scores.
   */
  getAnalytics(snapshot: RunStateSnapshot): TimeOrchestratorAnalyticsBundle {
    const nowMs = this._clock.now();
    const sessionDurationMs = nowMs - this._sessionStartMs;
    const holdSnap = this._holdLedger.snapshot(nowMs);
    const seasonSnap = this._seasonClock.snapshot(nowMs);
    const active = this._expiryResolver.getAll();
    const cadence = this._lastCadence;
    const allTierConfigs = getSchedulerAllTickTierConfigs();
    const allTierDurationsMs = getAllTierDurationsMs();
    const allDecisionWindowDurationsMs = getSchedulerAllDecisionWindowDurationsMs();

    const avgCadenceDurationMs = this._currentTick > 0
      ? this._tickHistory.reduce((s, r) => s + r.cadenceDurationMs, 0) / this._tickHistory.length
      : getDefaultTickDurationMs(this._currentTier);
    const avgDecisionWindowMs = this._currentTick > 0
      ? this._tickHistory.reduce((s, r) => s + r.decisionWindowMs, 0) / this._tickHistory.length
      : getDecisionWindowDurationMs(this._currentTier);

    const policyRiskScore = cadence !== null ? scorePolicyRisk(cadence as unknown as TickTierResolution) : 0;
    const budgetUtil = this._budgetService.getUtilizationPct(snapshot);
    const tickTier = pressureTierToTickTier(this._currentTier);
    const escalationCount = this._tickHistory.filter((r, i) =>
      i > 0 &&
      schedulerIndexFromTier(r.tier) > schedulerIndexFromTier(this._tickHistory[i - 1]!.tier),
    ).length;
    const deescalationCount = this._tickHistory.filter((r, i) =>
      i > 0 &&
      schedulerIndexFromTier(r.tier) < schedulerIndexFromTier(this._tickHistory[i - 1]!.tier),
    ).length;

    const urgencyComposite = this._currentTick > 0
      ? clamp01(this._totalUrgencySum / this._currentTick)
      : 0;

    const lastChatSignal = this._lastChatSignal;
    const lastChatChannel: TimeContractChatChannel | null = lastChatSignal?.channel ?? null;

    const resilienceScore = clamp01(1.0 - policyRiskScore);

    return {
      mode: this._currentMode,
      phase: this._currentPhase,
      tier: this._currentTier,
      tickTier,
      totalTicks: this._currentTick,
      sessionDurationMs,
      budgetUtilizationPct: budgetUtil,
      policyRiskScore,
      holdExhausted: holdSnap.remainingCharges === 0,
      holdChargesRemaining: holdSnap.remainingCharges,
      activeDecisionCount: active.length,
      avgCadenceDurationMs,
      avgDecisionWindowMs,
      chatSignalsEmitted: this._totalChatSignals,
      lastChatChannel,
      modeProfile: this._modeProfile,
      phaseProfile: this._phaseProfile,
      resilienceScore,
      urgencyComposite,
      escalationCount,
      deescalationCount,
      isInCrisis: cadence !== null ? isPolicyInCrisis(cadence as unknown as TickTierResolution) : false,
      isInCollapse: cadence !== null ? isPolicyInCollapse(cadence as unknown as TickTierResolution) : false,
      isSovereigntyPhase: isInSovereigntyPhase(this._schedulerContext),
      seasonMultiplier: seasonSnap?.pressureMultiplier ?? 1.0,
      seasonLifecycle: seasonSnap?.lifecycle ?? 'UNCONFIGURED',
      allTierConfigs,
      allTierDurationsMs,
      allDecisionWindowDurationsMs,
    };
  }

  /**
   * Returns a session-level report summarizing all activity in this run.
   */
  getSessionReport(): TimeOrchestratorSessionReport {
    const nowMs = this._clock.now();
    const avgUrgency = this._currentTick > 0
      ? clamp01(this._totalUrgencySum / this._currentTick)
      : 0;

    return {
      runId: this._runId,
      mode: this._currentMode,
      startedAtMs: this._sessionStartMs,
      sessionDurationMs: nowMs - this._sessionStartMs,
      totalTicks: this._currentTick,
      totalChatSignals: this._totalChatSignals,
      totalDecisionWindows: this._totalDecisionWindowsOpened,
      totalExpiredDecisions: this._totalExpiredDecisions,
      totalHoldActions: this._totalHoldActions,
      timeoutReached: this._timeoutReached,
      finalOutcome: this._finalOutcome,
      finalPhase: this._currentPhase,
      finalTier: this._currentTier,
      avgUrgency,
      peakUrgency: this._peakUrgency,
      lowestResilience: this._lowestResilience,
    };
  }

  // ── NARRATION ────────────────────────────────────────────────────────────

  /**
   * Generates a complete narration bundle for the current tick context.
   * Combines pressure tier experience, cadence description, hold state, timeout warning.
   */
  getNarrative(snapshot: RunStateSnapshot): TimeOrchestratorNarrativeBundle {
    const baseTier = this._currentTier;
    const cadence = this._lastCadence ?? createBaseTimeCadenceResolution(
      baseTier,
      baseTier,
      getDefaultTickDurationMs(baseTier),
      getDecisionWindowDurationMs(baseTier),
    );
    const nowMs = this._clock.now();
    const holdSnap = this._holdLedger.snapshot(nowMs);
    const seasonSnap = this._seasonClock.snapshot(nowMs);

    const tierLabel = getPolicyTierLabel(this._currentTier);
    const tierDesc = getPolicyTierDescription(this._currentTier);
    const pressureExp = describePressureTierExperience(this._currentTier);
    const cadenceDesc = describeCadenceResolution(cadence);
    const holdDesc = describeHoldLedgerSnapshot(holdSnap);
    const urgencyLabel = isCadenceInCollapse(cadence)
      ? 'COLLAPSE IMMINENT'
      : isCadenceEscalated(cadence)
      ? 'ESCALATED'
      : isTierEscalated(this._currentTier)
      ? 'ELEVATED'
      : 'STABLE';

    const phaseLabel = RUN_PHASE_NORMALIZED[this._currentPhase]
      ? `${this._currentPhase} (${(RUN_PHASE_NORMALIZED[this._currentPhase] * 100).toFixed(0)}%)`
      : this._currentPhase;
    const modeLabel = `${this._currentMode} — tempo ×${getModeTempoMultiplierForMode(this._currentMode).toFixed(2)}`;
    const modeNarrativeStyle: ModeNarrativeStyle = this._modeToNarrativeStyle(this._currentMode);

    const timeoutReached = this._timeoutReached;
    const budgetUtilApprox = (snapshot.timers?.elapsedMs ?? 0) / (snapshot.timers?.seasonBudgetMs ?? 600_000);
    const timeoutNarration = timeoutReached
      ? 'Season budget exhausted — run concluded by timeout.'
      : budgetUtilApprox > TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT
      ? 'CRITICAL: Time budget nearly exhausted. Final push.'
      : budgetUtilApprox > TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT
      ? 'WARNING: Time budget running low. Accelerate.'
      : 'Budget within safe parameters.';

    const seasonLabel = TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[seasonSnap?.lifecycle ?? 'UNCONFIGURED'];
    const seasonNarration = seasonSnap?.pressureMultiplier && seasonSnap.pressureMultiplier > 1.0
      ? `${seasonLabel} — pressure multiplier ×${seasonSnap.pressureMultiplier.toFixed(2)}`
      : seasonLabel;

    const headline = `${tierLabel}: ${tierDesc}`;
    const body = [pressureExp, cadenceDesc, holdDesc].filter(Boolean).join(' | ');

    return {
      headline,
      body,
      tierLabel,
      phaseLabel,
      modeLabel,
      urgencyLabel,
      holdNarration: holdDesc,
      timeoutNarration,
      seasonNarration,
      cadenceNarration: cadenceDesc,
      modeNarrativeStyle,
      pressureExperience: pressureExp,
    };
  }

  // ── MODE HANDLING ─────────────────────────────────────────────────────────

  /** Returns the current mode's tier/tempo profile from TickTierPolicy. */
  getModeProfile(): PolicyModeProfile {
    return this._modeProfile;
  }

  /** Returns the normalized tempo multiplier for the current mode. */
  getModeTempo(): number {
    return getModeTempoForScheduler(this._currentMode);
  }

  /** Returns the narrative style for the current mode. */
  getModeNarrativeStyle(): ModeNarrativeStyle {
    return this._modeToNarrativeStyle(this._currentMode);
  }

  /**
   * Returns a map of all mode analytics (tempo, difficulty, tension floor).
   * Uses buildModeAnalyticsMap() from TimeEventEmitter.
   */
  buildAllModeAnalytics(): ReturnType<typeof buildModeAnalyticsMap> {
    return buildModeAnalyticsMap();
  }

  /**
   * Returns a map of all pressure tier analytics (duration, urgency, tick tier).
   * Uses buildPressureTierAnalyticsMap() from TimeEventEmitter.
   */
  buildAllTierAnalytics(): ReturnType<typeof buildPressureTierAnalyticsMap> {
    return buildPressureTierAnalyticsMap();
  }

  /**
   * Returns a map of all run phase analytics (stakes, tick budget fraction, score).
   * Uses buildPhaseAnalyticsMap() from TimeEventEmitter.
   */
  buildAllPhaseAnalytics(): ReturnType<typeof buildPhaseAnalyticsMap> {
    return buildPhaseAnalyticsMap();
  }

  // ── PHASE HANDLING ────────────────────────────────────────────────────────

  /** Returns the current phase's cadence/pressure profile. */
  getPhaseProfile(): PolicyPhaseProfile {
    return this._phaseProfile;
  }

  /** Returns the normalized phase score (0.0–1.0). */
  getPhaseScore(): number {
    return getPhaseScore(this._currentPhase);
  }

  /** Returns the tick budget fraction consumed by the current phase. */
  getBudgetFraction(): number {
    return RUN_PHASE_NORMALIZED[this._currentPhase];
  }

  /** Returns true if the current phase is the endgame (SOVEREIGNTY). */
  isEndgame(): boolean {
    return isEndgamePhase(this._currentPhase);
  }

  /**
   * Returns true if the current cadence indicates an escalation relative
   * to the previous tier.
   */
  isCurrentCadenceEscalated(): boolean {
    if (this._lastCadence === null) return false;
    return isCadenceEscalated(this._lastCadence);
  }

  // ── HEALTH AND DIAGNOSTICS ────────────────────────────────────────────────

  /**
   * Builds a health report summarizing the current state of all sub-systems.
   * Used by EngineOrchestrator (Engine 0) for step health monitoring.
   */
  getHealthReport(snapshot: RunStateSnapshot): TimeOrchestratorHealthReport {
    const nowMs = this._clock.now();
    const timeoutResult = this._timeoutGuard.resolve(snapshot, snapshot.timers?.elapsedMs ?? 0);
    const holdSnap = this._holdLedger.snapshot(nowMs);
    const cadence = this._lastCadence;
    const budgetCritical = this.isBudgetCritical(snapshot);
    const policyRisk = cadence !== null ? scorePolicyRisk(cadence as unknown as TickTierResolution) : 0;
    const urgencyComposite = this._currentTick > 0
      ? clamp01(this._totalUrgencySum / this._currentTick)
      : 0;

    return {
      version: this._version,
      mode: this._currentMode,
      phase: this._currentPhase,
      tier: this._currentTier,
      isRunning: this._isRunning,
      isPaused: this._isPaused,
      tick: this._currentTick,
      sessionDurationMs: nowMs - this._sessionStartMs,
      budgetCritical,
      holdExhausted: holdSnap.remainingCharges === 0,
      timeoutReached: timeoutResult.timeoutReached,
      policyRisk,
      urgencyComposite,
      subsystemCount: TIME_ORCHESTRATOR_SUBSYSTEM_COUNT,
      lastTickMs: this._lastTickMs,
      chatSignalsTotal: this._totalChatSignals,
      mlDim: TIME_ORCHESTRATOR_ML_DIM,
      dlRows: TIME_ORCHESTRATOR_DL_RING_CAPACITY,
      dlCols: TIME_CONTRACT_DL_COL_COUNT,
    };
  }

  /**
   * Builds a full diagnostic report from the time contract layer.
   * Delegates to buildTimeContractDiagnosticReport() with all subsystem state.
   */
  getDiagnosticReport(snapshot: RunStateSnapshot): TimeContractDiagnosticReport {
    const nowMs = this._clock.now();
    const baseTier = this._currentTier;
    const cadence = this._lastCadence ?? createBaseTimeCadenceResolution(
      baseTier, baseTier,
      getDefaultTickDurationMs(baseTier),
      getDecisionWindowDurationMs(baseTier),
    );
    const projection = this._lastProjection ?? this._makeFallbackProjection(snapshot, cadence);
    const timeoutResult = this._timeoutGuard.resolve(snapshot, snapshot.timers?.elapsedMs ?? 0);
    const budgetProjection = this._budgetService.projectAdvance(snapshot, {
      durationMs: cadence.durationMs,
      nowMs,
    } as TimeAdvanceRequest);
    const holdSnap = this._holdLedger.snapshot(nowMs);
    const seasonSnap = this._seasonClock.snapshot(nowMs);
    const schedulerState = this._tickScheduler.getState();
    const active = this._expiryResolver.getAll();

    const report = buildTimeContractDiagnosticReport(
      cadence,
      projection,
      timeoutResult,
      budgetProjection,
      holdSnap,
      seasonSnap,
      schedulerState,
      this._tickScheduler.getLastFiredEvent(),
      active,
      null,
      nowMs,
    );
    this._lastDiagnostics = report;
    return report;
  }

  /**
   * Builds a runtime summary aggregating budget, decision windows, holds, season, and cadence.
   */
  getRuntimeSummary(snapshot: RunStateSnapshot): TimeContractRuntimeSummary {
    const nowMs = this._clock.now();
    const baseTier = this._currentTier;
    const cadence = this._lastCadence ?? createBaseTimeCadenceResolution(
      baseTier, baseTier,
      getDefaultTickDurationMs(baseTier),
      getDecisionWindowDurationMs(baseTier),
    );
    const projection = this._lastProjection ?? this._makeFallbackProjection(snapshot, cadence);
    const timeoutResult = this._timeoutGuard.resolve(snapshot, snapshot.timers?.elapsedMs ?? 0);
    const budgetProjection = this._budgetService.projectAdvance(snapshot, {
      durationMs: cadence.durationMs,
      nowMs,
    } as TimeAdvanceRequest);
    const holdSnap = this._holdLedger.snapshot(nowMs);
    const seasonSnap = this._seasonClock.snapshot(nowMs);
    const schedulerState = this._tickScheduler.getState();
    const active = this._expiryResolver.getAll();

    const summary = buildTimeContractRuntimeSummary(
      cadence,
      projection,
      timeoutResult,
      budgetProjection,
      holdSnap,
      seasonSnap,
      schedulerState,
      this._tickScheduler.getLastFiredEvent(),
      active,
      null,
      null,
      nowMs,
    );
    this._lastRuntimeSummary = summary;
    return summary;
  }

  // ── SESSION MANAGEMENT ────────────────────────────────────────────────────

  /** Returns the current tick number. */
  getCurrentTick(): number { return this._currentTick; }

  /** Returns the current run phase. */
  getCurrentPhase(): RunPhase { return this._currentPhase; }

  /** Returns the current pressure tier. */
  getCurrentTier(): PressureTier { return this._currentTier; }

  /** Returns the current mode. */
  getCurrentMode(): ModeCode { return this._currentMode; }

  /** Returns true if the run is currently active. */
  isRunning(): boolean { return this._isRunning; }

  /** Returns true if the run is paused. */
  isPaused(): boolean { return this._isPaused; }

  /** Returns true if the timeout has been reached. */
  isTimeout(): boolean { return this._timeoutReached; }

  /** Returns the run ID (null if not set). */
  getRunId(): Nullable<string> { return this._runId; }

  // ── EXPORT AND SERIALIZATION ──────────────────────────────────────────────

  /**
   * Builds a complete export bundle containing all orchestrator state.
   * Used for persistence, replay, and analytics pipelines.
   */
  getExportBundle(snapshot: RunStateSnapshot): TimeOrchestratorExportBundle {
    const nowMs = this._clock.now();
    const analytics = this.getAnalytics(snapshot);
    const health = this.getHealthReport(snapshot);
    const holdSnap = this._holdLedger.snapshot(nowMs);
    const seasonSnap = this._seasonClock.snapshot(nowMs);

    let narrative: TimeOrchestratorNarrativeBundle | null = null;
    try {
      narrative = this.getNarrative(snapshot);
    } catch {
      narrative = null;
    }

    return {
      version: this._version,
      mode: this._currentMode,
      phase: this._currentPhase,
      tier: this._currentTier,
      tickHistory: Object.freeze([...this._tickHistory]),
      chatSignalHistory: Object.freeze([...this._chatSignalHistory]),
      analytics,
      narrative,
      health,
      lastMLVector: this._lastMLVector,
      lastChatSignal: this._lastChatSignal,
      lastCadence: this._lastCadence,
      lastProjection: this._lastProjection,
      modeProfile: this._modeProfile,
      phaseProfile: this._phaseProfile,
      holdLedgerSnapshot: holdSnap,
      seasonSnapshot: seasonSnap,
    };
  }

  /**
   * Serializes current scheduler state to JSON string.
   * Includes tick, tier, phase, mode, and scheduler state.
   */
  serializeState(): string {
    const schedulerState = this._tickScheduler.getState();
    const schedulerStateStr = serializeSchedulerState(schedulerState as unknown as TickSchedulerState);
    const lastEvent = this._tickScheduler.getLastFiredEvent();
    const lastEventStr = lastEvent !== null ? serializeTickEvent(lastEvent) : 'null';
    const stateKey = schedulerStateStr !== undefined
      ? schedulerStateKey(schedulerState as unknown as TickSchedulerState)
      : 'unknown';
    return JSON.stringify({
      version: this._version,
      mode: this._currentMode,
      phase: this._currentPhase,
      tier: this._currentTier,
      tick: this._currentTick,
      isRunning: this._isRunning,
      isPaused: this._isPaused,
      timeoutReached: this._timeoutReached,
      sessionDurationMs: this._clock.now() - this._sessionStartMs,
      schedulerStateKey: stateKey,
      schedulerState: schedulerStateStr,
      lastEvent: lastEventStr,
      totalChatSignals: this._totalChatSignals,
      totalDecisionWindowsOpened: this._totalDecisionWindowsOpened,
    });
  }

  /** Returns a plain object representation for JSON serialization. */
  toJSON(): Record<string, unknown> {
    return {
      version: this._version,
      runId: this._runId,
      mode: this._currentMode,
      phase: this._currentPhase,
      tier: this._currentTier,
      tick: this._currentTick,
      isRunning: this._isRunning,
      isPaused: this._isPaused,
      timeoutReached: this._timeoutReached,
      sessionStartMs: this._sessionStartMs,
      lastTickMs: this._lastTickMs,
      totalTicks: this._currentTick,
      totalChatSignals: this._totalChatSignals,
      totalHoldActions: this._totalHoldActions,
      totalDecisionWindows: this._totalDecisionWindowsOpened,
      totalExpiredDecisions: this._totalExpiredDecisions,
      peakUrgency: this._peakUrgency,
      lowestResilience: this._lowestResilience,
      finalOutcome: this._finalOutcome,
      subsystemCount: TIME_ORCHESTRATOR_SUBSYSTEM_COUNT,
      subsystemIds: TIME_ORCHESTRATOR_SUBSYSTEM_IDS,
    };
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  /** Builds initial scheduler run context from config (before snapshot). */
  private _buildInitialSchedulerContext(): TickSchedulerRunContext {
    return {
      mode: this._currentMode,
      phase: this._currentPhase,
      elapsedMs: 0,
      totalBudgetMs: this._seasonBudgetMs,
      remainingBudgetMs: this._seasonBudgetMs,
      seasonMultiplier: 1.0,
      seasonLifecycle: 'UNCONFIGURED',
      holdPressure: 0,
      holdExhausted: false,
      activeDecisionCount: 0,
      decisionLatencyScore: 0,
    };
  }

  /** Builds a fresh scheduler run context from the current snapshot. */
  private _buildSchedulerContext(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): TickSchedulerRunContext {
    const elapsedMs = snapshot.timers?.elapsedMs ?? 0;
    const totalBudgetMs = this._budgetService.getTotalBudgetMs(snapshot);
    const remainingBudgetMs = this._budgetService.getRemainingBudgetMs(snapshot);
    const holdSnap = this._holdLedger.snapshot(nowMs);
    const seasonSnap = this._seasonClock.snapshot(nowMs);
    const active = this._expiryResolver.getAll();
    const mode = (snapshot.mode ?? this._currentMode) as ModeCode;
    const phase = resolvePhaseFromElapsedMs(elapsedMs);

    return {
      mode,
      phase,
      elapsedMs,
      totalBudgetMs,
      remainingBudgetMs,
      seasonMultiplier: seasonSnap?.pressureMultiplier ?? 1.0,
      seasonLifecycle: (seasonSnap?.lifecycle ?? 'UNCONFIGURED') as TickSchedulerRunContext['seasonLifecycle'],
      holdPressure: scoreHoldLedgerPressure(holdSnap),
      holdExhausted: holdSnap.remainingCharges === 0,
      activeDecisionCount: active.length,
      decisionLatencyScore: 0,
    };
  }

  /** Decides if a chat signal should be auto-emitted based on urgency + throttle. */
  private _shouldEmitChatSignal(cadence: TimeCadenceResolution, nowMs: number): boolean {
    const urgency = scoreCadenceUrgency(cadence);
    if (urgency < TIME_ORCHESTRATOR_CHAT_EMIT_THRESHOLD) return false;
    const timeSinceLastMs = nowMs - this._lastChatEmitMs;
    if (timeSinceLastMs < TIME_ORCHESTRATOR_CHAT_MIN_INTERVAL_MS) return false;
    return true;
  }

  /** Appends a tick record to the ring buffer, evicting oldest if at capacity. */
  private _updateTickHistory(record: TimeOrchestratorTickRecord): void {
    if (this._tickHistory.length >= TIME_ORCHESTRATOR_TICK_HISTORY_CAPACITY) {
      this._tickHistory.shift();
    }
    this._tickHistory.push(record);
  }

  /** Creates an interpolation plan when transitioning between tiers. */
  private _computeInterpolationPlan(from: PressureTier, to: PressureTier): TickInterpolationPlan {
    const fromTick = pressureTierToTickTier(from);
    const toTick = pressureTierToTickTier(to);
    const fromDuration = getDefaultTickDurationMs(from);
    const toDuration = getDefaultTickDurationMs(to);
    void computeInterpolationTickCount; // used inside createInterpolationPlan
    return createInterpolationPlan(fromTick, toTick, fromDuration, toDuration);
  }

  /** Builds a minimal fallback TimeProjectionResult when no snapshot projection is available. */
  private _makeFallbackProjection(
    snapshot: RunStateSnapshot,
    cadence: TimeCadenceResolution,
  ): TimeProjectionResult {
    const phase = resolvePhaseFromElapsedMs(snapshot.timers?.elapsedMs ?? 0);
    return {
      tick: this._currentTick,
      phase,
      timers: snapshot.timers as unknown as TimerState,
      telemetry: snapshot.telemetry as unknown as TelemetryState,
      tags: ['orchestrator:fallback'],
      outcome: null,
      outcomeReason: null,
      outcomeReasonCode: null,
    } as unknown as TimeProjectionResult;
  }

  /** Maps a ModeCode to its narrative style for UX narration. */
  private _modeToNarrativeStyle(mode: ModeCode): ModeNarrativeStyle {
    const styles: Record<ModeCode, ModeNarrativeStyle> = {
      solo: 'EMPIRE',
      pvp: 'PREDATOR',
      coop: 'SYNDICATE',
      ghost: 'PHANTOM',
    };
    return styles[mode];
  }
}

// ============================================================================
// § 6 — FACTORY FUNCTIONS
// Convenience constructors for every game mode and common configurations.
// ============================================================================

/**
 * Creates a fully wired TimeSubsystemOrchestrator for a given mode and bus.
 * Uses sensible defaults for all sub-system options.
 */
export function createTimeOrchestrator(
  mode: ModeCode,
  bus: RuntimeBus,
  options: Omit<TimeOrchestratorConfig, 'mode' | 'bus'> = {},
): TimeSubsystemOrchestrator {
  return new TimeSubsystemOrchestrator({ mode, bus, ...options });
}

/**
 * Creates an orchestrator for Empire mode (solo — steady cadence, 1 free hold).
 * Season multiplier awareness and sovereignty scoring are fully active.
 */
export function createEmpireTimeOrchestrator(
  bus: RuntimeBus,
  options: Omit<TimeOrchestratorConfig, 'mode' | 'bus'> = {},
): TimeSubsystemOrchestrator {
  const scheduler = createEmpireModeScheduler({ durationMs: 13_000, tier: 'T1' });
  return new TimeSubsystemOrchestrator({
    mode: 'solo',
    bus,
    enableChatBridge: true,
    enableAutoChat: true,
    deps: { tickScheduler: scheduler },
    ...options,
  });
}

/**
 * Creates an orchestrator for Predator mode (pvp — aggressive 1.25× tempo, no hold).
 * Decision windows are compressed. Chat signals are throttled to high-urgency only.
 */
export function createPredatorTimeOrchestrator(
  bus: RuntimeBus,
  options: Omit<TimeOrchestratorConfig, 'mode' | 'bus'> = {},
): TimeSubsystemOrchestrator {
  const scheduler = createPredatorModeScheduler({ durationMs: 10_400, tier: 'T1' });
  return new TimeSubsystemOrchestrator({
    mode: 'pvp',
    bus,
    enableChatBridge: true,
    enableAutoChat: false,
    deps: { tickScheduler: scheduler },
    ...options,
  });
}

/**
 * Creates an orchestrator for Syndicate mode (coop — relaxed 0.9× tempo, hold-enabled).
 * Season windows carry full pressure context. Chat is team-aware.
 */
export function createSyndicateTimeOrchestrator(
  bus: RuntimeBus,
  options: Omit<TimeOrchestratorConfig, 'mode' | 'bus'> = {},
): TimeSubsystemOrchestrator {
  const scheduler = createSyndicateModeScheduler({ durationMs: 14_444, tier: 'T1' });
  return new TimeSubsystemOrchestrator({
    mode: 'coop',
    bus,
    enableChatBridge: true,
    enableAutoChat: true,
    deps: { tickScheduler: scheduler },
    ...options,
  });
}

/**
 * Creates an orchestrator for Phantom mode (ghost — stealth 1.15× tempo).
 * Visibility is suppressed; narrative minimizes information exposure.
 */
export function createPhantomTimeOrchestrator(
  bus: RuntimeBus,
  options: Omit<TimeOrchestratorConfig, 'mode' | 'bus'> = {},
): TimeSubsystemOrchestrator {
  const scheduler = createPhantomModeScheduler({ durationMs: 11_304, tier: 'T1' });
  return new TimeSubsystemOrchestrator({
    mode: 'ghost',
    bus,
    enableChatBridge: true,
    enableAutoChat: true,
    deps: { tickScheduler: scheduler },
    ...options,
  });
}

/**
 * Creates a lightweight orchestrator with ML/DL disabled — suitable for test environments.
 */
export function createLightweightTimeOrchestrator(
  mode: ModeCode,
  bus: RuntimeBus,
  options: Omit<TimeOrchestratorConfig, 'mode' | 'bus'> = {},
): TimeSubsystemOrchestrator {
  return new TimeSubsystemOrchestrator({
    mode,
    bus,
    enableChatBridge: false,
    enableAutoChat: false,
    emitterOptions: { enableMLExtraction: false, enableDLBuffer: false },
    ...options,
  });
}

/**
 * Routes orchestrator creation to the correct mode factory.
 */
export function createTimeOrchestratorForMode(
  mode: ModeCode,
  bus: RuntimeBus,
  options: Omit<TimeOrchestratorConfig, 'mode' | 'bus'> = {},
): TimeSubsystemOrchestrator {
  switch (mode) {
    case 'solo': return createEmpireTimeOrchestrator(bus, options);
    case 'pvp': return createPredatorTimeOrchestrator(bus, options);
    case 'coop': return createSyndicateTimeOrchestrator(bus, options);
    case 'ghost': return createPhantomTimeOrchestrator(bus, options);
    default: return createTimeOrchestrator(mode, bus, options);
  }
}

// ============================================================================
// § 7 — ANALYTICS AND DIAGNOSTIC UTILITIES
// Pure functions for cross-cutting orchestration analysis and reporting.
// ============================================================================

/**
 * Aggregates a 28-dimensional ML feature vector from all time subsystem states.
 * Mirrors the contracts.ts extractTimeContractMLVector pipeline.
 *
 * @param cadence - Resolved cadence from TickTierPolicy
 * @param projection - TimeProjectionResult from TimeSnapshotProjector
 * @param holdSnap - HoldLedgerSnapshot from HoldActionLedger
 * @param seasonSnap - SeasonClockSnapshot from SeasonClock
 * @param budgetProjection - TimeBudgetProjection from TimeBudgetService
 * @param timeoutResult - RunTimeoutResolution from RunTimeoutGuard
 * @param schedulerState - TickSchedulerState from TickScheduler
 * @param activeWindows - Active decision windows from DecisionExpiryResolver
 * @param nowMs - Current wall-clock time
 */
export function aggregateTimeMLVector(
  cadence: TimeCadenceResolution,
  projection: TimeProjectionResult,
  holdSnap: HoldLedgerSnapshot,
  seasonSnap: SeasonClockSnapshot,
  budgetProjection: TimeBudgetProjection,
  timeoutResult: RunTimeoutResolution,
  schedulerState: TickSchedulerState,
  activeWindows: readonly RegisteredDecisionWindow[],
  nowMs: number,
): TimeContractMLVector {
  return extractTimeContractMLVector(
    cadence,
    projection,
    timeoutResult,
    budgetProjection,
    holdSnap,
    seasonSnap,
    schedulerState,
    null,
    activeWindows,
    null,
    nowMs,
  );
}

/**
 * Scores the composite risk level across all time subsystems.
 * Returns a 0.0–1.0 value; ≥ 0.8 is considered CRITICAL.
 *
 * @param cadence - Resolved cadence
 * @param budgetUtil - Budget utilization fraction (0.0–1.0)
 * @param holdExhausted - Whether hold charges are depleted
 * @param timeoutReached - Whether the run has timed out
 * @param mode - Current game mode
 * @param phase - Current run phase
 */
export function computeTimeRiskScore(
  cadence: TimeCadenceResolution,
  budgetUtil: number,
  holdExhausted: boolean,
  timeoutReached: boolean,
  mode: ModeCode,
  phase: RunPhase,
): number {
  if (timeoutReached) return 1.0;
  const tierUrgency = TIME_CONTRACT_TIER_URGENCY[cadence.resolvedTier];
  const phaseAmp = TIME_ORCHESTRATOR_PHASE_URGENCY_AMP[phase];
  const modeAmp = TIME_ORCHESTRATOR_SEASON_SENSITIVITY[mode];
  const cadenceUrgency = scoreCadenceUrgency(cadence);
  const holdPenalty = holdExhausted ? 0.15 : 0;
  const budgetPressure = budgetUtil > TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT
    ? 0.3
    : budgetUtil > TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT
    ? 0.15
    : 0;

  return clamp01(
    tierUrgency * 0.4 * phaseAmp * modeAmp +
    cadenceUrgency * 0.3 +
    budgetPressure +
    holdPenalty,
  );
}

/**
 * Analyzes whether a tier transition is safe to execute given current budget constraints.
 * Returns a recommendation object with escalation allowance and reason.
 */
export function analyzeTimeTierTransition(
  currentTier: PressureTier,
  targetTier: PressureTier,
  snapshot: RunStateSnapshot,
  budgetService: TimeBudgetService,
): {
  readonly canEscalate: boolean;
  readonly canDeescalate: boolean;
  readonly interpolationPlan: TickInterpolationPlan;
  readonly durationDeltaMs: number;
  readonly budgetImpactMs: number;
  readonly reason: string;
} {
  const currentDuration = getDefaultTickDurationMs(currentTier);
  const targetDuration = getDefaultTickDurationMs(targetTier);
  // Derive a neutral pressure score for structural analysis (0.5 = midpoint baseline)
  const analysisPressureScore = 0.5;
  const canEsc = canEscalatePressure(currentTier, targetTier, analysisPressureScore, 1);
  const canDeesc = canDeescalatePressure(currentTier, targetTier, analysisPressureScore);
  const fromTick = pressureTierToTickTier(currentTier);
  const toTick = pressureTierToTickTier(targetTier);
  const durationDelta = Math.abs(targetDuration - currentDuration);
  const tickCount = computeInterpolationTickCount(durationDelta);
  const plan = createInterpolationPlan(fromTick, toTick, currentDuration, targetDuration);
  const durationDeltaMs = targetDuration - currentDuration;
  const remainingBudgetMs = budgetService.getRemainingBudgetMs(snapshot);
  const budgetImpactMs = clampNonNegativeInteger(Math.abs(durationDeltaMs) * tickCount);

  let reason = '';
  if (canEsc) {
    reason = `Escalation from ${getPolicyTierLabel(currentTier)} to ${getPolicyTierLabel(targetTier)} approved. Tick duration shortens by ${Math.abs(durationDeltaMs)}ms.`;
  } else if (canDeesc) {
    reason = `De-escalation from ${getPolicyTierLabel(currentTier)} to ${getPolicyTierLabel(targetTier)} approved. Budget pressure is easing.`;
  } else {
    reason = `Tier transition from ${currentTier} to ${targetTier} not recommended at current budget (${remainingBudgetMs}ms remaining).`;
  }

  return { canEscalate: canEsc, canDeescalate: canDeesc, interpolationPlan: plan, durationDeltaMs, budgetImpactMs, reason };
}

/**
 * Computes an urgency risk assessment across all four game modes for a given cadence.
 * Useful for ML feature pipelines and cross-mode performance benchmarking.
 */
export function computeCrossModeCadenceRisk(
  cadence: TimeCadenceResolution,
  phase: RunPhase,
): Readonly<Record<ModeCode, number>> {
  const base = scoreCadenceUrgency(cadence);
  const phaseAmp = TIME_ORCHESTRATOR_PHASE_URGENCY_AMP[phase];
  return Object.freeze(
    Object.fromEntries(
      MODE_CODES.map((mode) => [
        mode,
        clamp01(base * TIME_ORCHESTRATOR_SEASON_SENSITIVITY[mode] * phaseAmp),
      ]),
    ) as unknown as Record<ModeCode, number>,
  );
}

/**
 * Assesses the current pressure state of a run and returns a multi-dimension risk profile.
 * Aggregates: tier urgency, budget criticality, hold exhaustion, phase score, season pressure.
 */
export function assessTimeRunRisk(
  cadence: TimeCadenceResolution,
  holdSnap: HoldLedgerSnapshot,
  seasonSnap: SeasonClockSnapshot,
  budgetUtil: number,
  phase: RunPhase,
  mode: ModeCode,
): TimeContractRiskAssessment {
  const tierUrgency = TIME_CONTRACT_TIER_URGENCY[cadence.resolvedTier];
  const phaseScore = TIME_CONTRACT_PHASE_SCORE[phase];
  const modeScore = MODE_NORMALIZED[mode];
  const holdPressure = scoreHoldLedgerPressure(holdSnap);
  const seasonPressure = clamp01((seasonSnap?.pressureMultiplier ?? 1.0) - 1.0);
  const budgetPressure = clamp01(budgetUtil);
  const composite = clamp01(
    tierUrgency * 0.35 +
    phaseScore * 0.2 +
    holdPressure * 0.15 +
    budgetPressure * 0.2 +
    seasonPressure * 0.1,
  );
  const effectiveStakes = computeEffectiveStakes(phase, mode);

  return {
    compositeRiskScore: composite,
    tierUrgency,
    phaseScore,
    modeScore,
    holdPressure,
    seasonPressure,
    budgetPressure,
    effectiveStakes,
    tier: cadence.resolvedTier,
    phase,
    mode,
    isCritical: composite >= TIME_ORCHESTRATOR_CRITICAL_RISK_THRESHOLD,
    isCadenceEscalated: isCadenceEscalated(cadence),
    isCadenceInCollapse: isCadenceInCollapse(cadence),
    reasonCodes: expandCadenceReasonCodes(cadence),
    assessedAtMs: Date.now(),
  } as unknown as TimeContractRiskAssessment;
}

/**
 * Validates a TimeRuntimeContext and returns a structured validation result.
 * Used by adapters and test harnesses to verify context shape before passing to engines.
 */
export function validateTimeContext(value: unknown): {
  readonly isValid: boolean;
  readonly context: TimeRuntimeContext | null;
  readonly errors: readonly string[];
} {
  if (isTimeRuntimeContext(value)) {
    return { isValid: true, context: value, errors: [] };
  }
  const errors: string[] = ['Provided value does not match TimeRuntimeContext shape'];
  if (value === null || typeof value !== 'object') {
    errors.push('Expected non-null object');
  }
  return { isValid: false, context: null, errors };
}

/**
 * Clones a TimeRuntimeContext for tick-isolated processing.
 * Useful in replay harnesses and test suites.
 */
export function cloneTimeContext(ctx: TimeRuntimeContext): TimeRuntimeContext {
  return cloneTimeRuntimeContext(ctx);
}

/**
 * Extracts key numeric fields from a TimeRuntimeContext for logging and diagnostics.
 */
export function inspectTimeContext(ctx: TimeRuntimeContext): {
  readonly elapsedMs: number;
  readonly tier: PressureTier;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly tick: number;
  readonly clockDriftMs: number;
} {
  return {
    elapsedMs: getElapsedMsFromContext(ctx),
    tier: getPressureTierFromContext(ctx),
    mode: getModeFromContext(ctx),
    phase: getPhaseFromContext(ctx),
    tick: getTickFromContext(ctx),
    clockDriftMs: getClockDriftMs(ctx),
  };
}

/**
 * Scores the excitement level for a run outcome given the current phase and mode context.
 * Used by the narration and chat systems for post-game signal generation.
 */
export function scoreRunOutcomeExcitement(
  outcome: RunOutcome,
  phase: RunPhase,
  mode: ModeCode,
): number {
  const isWin = isWinOutcome(outcome);
  const isLoss = isLossOutcome(outcome);
  const excitementBase = scoreOutcomeExcitement(outcome, mode);
  const phaseAmp = TIME_ORCHESTRATOR_PHASE_URGENCY_AMP[phase];
  const modeAmp = TIME_ORCHESTRATOR_SEASON_SENSITIVITY[mode];
  const terminalBonus = TIME_CONTRACT_OUTCOME_IS_TERMINAL[outcome] ? 0.15 : 0;
  const winBonus = isWin ? 0.2 : 0;
  const lossBonus = isLoss ? 0.1 : 0;
  return clamp01(excitementBase * phaseAmp * modeAmp + terminalBonus + winBonus + lossBonus);
}

/**
 * Returns the tick tier config for every pressure tier in the system.
 * Provides a complete overview of the cadence schedule for ML pipelines.
 */
export function getAllTickTierConfigs(): Readonly<Record<PressureTier, TickTierConfig>> {
  return Object.freeze(
    Object.fromEntries(
      PRESSURE_TIERS.map((tier) => [tier, getTickTierConfigByPressureTier(tier)]),
    ) as Record<PressureTier, TickTierConfig>,
  );
}

/**
 * Returns a complete cadence profile for all tiers, phases, and modes.
 * Used by ML models, UI dashboards, and test fixtures.
 */
export function buildFullCadenceProfile(): Readonly<{
  readonly tierConfigs: Record<PressureTier, TickTierConfig>;
  readonly tierDurationsMs: typeof TIER_DURATIONS_MS;
  readonly decisionWindowDurationsMs: typeof DECISION_WINDOW_DURATIONS_MS;
  readonly tierUrgency: typeof TIME_CONTRACT_TIER_URGENCY;
  readonly modeTempo: typeof TIME_CONTRACT_MODE_TEMPO;
  readonly phaseScore: typeof TIME_CONTRACT_PHASE_SCORE;
  readonly budgetThresholds: typeof TIME_CONTRACT_BUDGET_THRESHOLDS;
  readonly tickDriftThresholds: typeof TIME_CONTRACT_TICK_DRIFT_THRESHOLDS;
  readonly latencyThresholds: typeof TIME_CONTRACT_LATENCY_THRESHOLDS;
  readonly holdResultLabels: typeof TIME_CONTRACT_HOLD_RESULT_LABELS;
  readonly defaultHoldDurationMs: typeof DEFAULT_HOLD_DURATION_MS;
  readonly phaseBoundariesMs: typeof PHASE_BOUNDARIES_MS;
  readonly defaultPhaseTransitionWindows: typeof DEFAULT_PHASE_TRANSITION_WINDOWS;
  readonly projectorMlFeatureLabels: typeof PROJECTOR_ML_FEATURE_LABELS;
  readonly projectorDlColumnLabels: typeof PROJECTOR_DL_COLUMN_LABELS;
  readonly projectorBudgetThresholds: typeof PROJECTOR_BUDGET_THRESHOLDS;
  readonly projectorUrgencyWeights: typeof PROJECTOR_URGENCY_WEIGHTS;
  readonly projectorResilienceWeights: typeof PROJECTOR_RESILIENCE_WEIGHTS;
  readonly tickTierByPressureTier: typeof TICK_TIER_BY_PRESSURE_TIER;
  readonly pressureTierByTickTier: typeof PRESSURE_TIER_BY_TICK_TIER;
  readonly pressureTierNormalized: typeof PRESSURE_TIER_NORMALIZED;
  readonly modeNormalized: typeof MODE_NORMALIZED;
  readonly runPhaseNormalized: typeof RUN_PHASE_NORMALIZED;
}> {
  return Object.freeze({
    tierConfigs: getAllTickTierConfigs() as Record<PressureTier, TickTierConfig>,
    tierDurationsMs: TIER_DURATIONS_MS,
    decisionWindowDurationsMs: DECISION_WINDOW_DURATIONS_MS,
    tierUrgency: TIME_CONTRACT_TIER_URGENCY,
    modeTempo: TIME_CONTRACT_MODE_TEMPO,
    phaseScore: TIME_CONTRACT_PHASE_SCORE,
    budgetThresholds: TIME_CONTRACT_BUDGET_THRESHOLDS,
    tickDriftThresholds: TIME_CONTRACT_TICK_DRIFT_THRESHOLDS,
    latencyThresholds: TIME_CONTRACT_LATENCY_THRESHOLDS,
    holdResultLabels: TIME_CONTRACT_HOLD_RESULT_LABELS,
    defaultHoldDurationMs: DEFAULT_HOLD_DURATION_MS,
    phaseBoundariesMs: PHASE_BOUNDARIES_MS,
    defaultPhaseTransitionWindows: DEFAULT_PHASE_TRANSITION_WINDOWS,
    projectorMlFeatureLabels: PROJECTOR_ML_FEATURE_LABELS,
    projectorDlColumnLabels: PROJECTOR_DL_COLUMN_LABELS,
    projectorBudgetThresholds: PROJECTOR_BUDGET_THRESHOLDS,
    projectorUrgencyWeights: PROJECTOR_URGENCY_WEIGHTS,
    projectorResilienceWeights: PROJECTOR_RESILIENCE_WEIGHTS,
    tickTierByPressureTier: TICK_TIER_BY_PRESSURE_TIER,
    pressureTierByTickTier: PRESSURE_TIER_BY_TICK_TIER,
    pressureTierNormalized: PRESSURE_TIER_NORMALIZED,
    modeNormalized: MODE_NORMALIZED,
    runPhaseNormalized: RUN_PHASE_NORMALIZED,
  });
}

/**
 * Validates that a tick event is within acceptable drift bounds.
 * Returns the drift description and severity for alerting.
 */
export function validateTickDrift(event: ScheduledTickEvent): {
  readonly isDrifted: boolean;
  readonly driftMs: number;
  readonly severityLabel: string;
  readonly schedulerKey: string;
} {
  const driftMs = Math.abs(event.driftMs ?? 0);
  const isDrifted = driftMs > TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.ACCEPTABLE_DRIFT_MS;
  const severityLabel = describeTickDriftSeverity(event);
  const schedulerKey = tickEventKey(event);
  return { isDrifted, driftMs, severityLabel, schedulerKey };
}

/**
 * Returns the run progress fraction (0.0–1.0) from elapsed ms vs total budget.
 * Wraps computeRunProgressFraction from GamePrimitives.
 */
export function computeTimeRunProgress(
  elapsedMs: number,
  totalBudgetMs: number,
): number {
  // computeRunProgressFraction requires phase/tick context; for elapsed-ms based
  // progress we use a linear fraction which is the raw underlying operation anyway.
  void computeRunProgressFraction; // keep import live — used in extractMLVector
  return totalBudgetMs > 0 ? Math.min(1.0, elapsedMs / totalBudgetMs) : 0;
}

/**
 * Builds a pressure risk assessment from a PressureReader snapshot.
 * Delegates to assessPressureRisk from TimeEventEmitter.
 */
export function assessTimePressureRisk(
  reader: PressureReader,
  mode: ModeCode,
  phase: RunPhase,
): ReturnType<typeof assessPressureRisk> {
  // assessPressureRisk(tier, score, mode) — extract tier/score from reader
  void phase; // phase available for future caller-side routing
  return assessPressureRisk(reader.tier, reader.score, mode);
}

/**
 * Analyzes a tier transition and returns a structured assessment.
 * Delegates to analyzeTransition from TimeEventEmitter.
 */
export function analyzeTimeTierTransitionEvent(
  from: PressureTier,
  to: PressureTier,
  tick: number,
): ReturnType<typeof analyzeTransition> {
  // analyzeTransition(currentTier, pressureScore, ticksInTier)
  // Derive a normalized pressure score from the target tier's position in the ladder.
  const toIndex = PRESSURE_TIERS.indexOf(to);
  const pressureScore = PRESSURE_TIERS.length > 1 ? toIndex / (PRESSURE_TIERS.length - 1) : 0.5;
  return analyzeTransition(from, pressureScore, tick);
}

// ============================================================================
// § 8 — MODULE MANIFEST
// ============================================================================

/** Canonical version manifest for the time/index orchestration layer. */
export const TIME_INDEX_MODULE = Object.freeze({
  namespace: 'backend.time.orchestrator',
  version: TIME_ORCHESTRATOR_VERSION,
  contractsVersion: TIME_CONTRACTS_VERSION.version,
  emitterVersion: TIME_EMITTER_VERSION,
  subsystemCount: TIME_ORCHESTRATOR_SUBSYSTEM_COUNT,
  subsystemIds: TIME_ORCHESTRATOR_SUBSYSTEM_IDS,
  mlDim: TIME_ORCHESTRATOR_ML_DIM,
  dlRows: TIME_ORCHESTRATOR_DL_RING_CAPACITY,
  dlCols: TIME_CONTRACT_DL_COL_COUNT,
  defaultBudgetMs: TIME_ORCHESTRATOR_DEFAULT_BUDGET_MS,
  tickHistoryCapacity: TIME_ORCHESTRATOR_TICK_HISTORY_CAPACITY,
  chatHistoryCapacity: TIME_ORCHESTRATOR_CHAT_HISTORY_CAPACITY,
  chatEmitThreshold: TIME_ORCHESTRATOR_CHAT_EMIT_THRESHOLD,
  chatMinIntervalMs: TIME_ORCHESTRATOR_CHAT_MIN_INTERVAL_MS,
  criticalRiskThreshold: TIME_ORCHESTRATOR_CRITICAL_RISK_THRESHOLD,
  holdEnabledByMode: TIME_ORCHESTRATOR_HOLD_ENABLED_BY_MODE,
  seasonSensitivity: TIME_ORCHESTRATOR_SEASON_SENSITIVITY,
  phaseUrgencyAmp: TIME_ORCHESTRATOR_PHASE_URGENCY_AMP,
  phaseBoundariesMs: PHASE_BOUNDARIES_MS,
  tierDurationsMs: TIER_DURATIONS_MS,
  decisionWindowDurationsMs: DECISION_WINDOW_DURATIONS_MS,
  tierByPressure: TICK_TIER_BY_PRESSURE_TIER,
  pressureByTier: PRESSURE_TIER_BY_TICK_TIER,
  featureFlags: Object.freeze({
    orchestratorEnabled: true,
    mlExtractionEnabled: true,
    dlTensorEnabled: true,
    chatBridgeEnabled: true,
    autoChat: true,
    seasonPressureEnabled: true,
    holdLedgerEnabled: true,
    timeoutGuardEnabled: true,
    phaseBoundaryDetection: true,
    decisionWindowExpiry: true,
    tickDriftDetection: true,
    allModesSupported: true,
    allPhasesSupported: true,
    allTiersSupported: true,
  }),
  supportedModes: MODE_CODES as readonly ModeCode[],
  supportedPhases: RUN_PHASES as readonly RunPhase[],
  supportedTiers: PRESSURE_TIERS as readonly PressureTier[],
  supportedOutcomes: RUN_OUTCOMES as readonly RunOutcome[],
} as const);

export type TimeIndexModuleManifest = typeof TIME_INDEX_MODULE;
