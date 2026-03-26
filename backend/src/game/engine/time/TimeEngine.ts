/* ============================================================================
 * FILE: backend/src/game/engine/time/TimeEngine.ts
 * POINT ZERO ONE — BACKEND TIME ENGINE v3
 *
 * Doctrine:
 * - backend is the authoritative simulation surface for cadence and budget consumption
 * - time executes only in STEP_02_TIME
 * - decision-window expiry, phase movement, and next-tick authority live here
 * - this engine must stay compatible with the current snapshot contract
 *   while pushing the backend closer to the frontend time doctrine
 * - forced/tutorial cadence overrides are runtime-local and fully resettable
 * - runtime-opened / runtime-closed windows must survive until snapshot commit
 * - hold usage must become durable snapshot truth, not just transient local state
 * - ML feature vector (28-dimensional) drives the chat lane's online inference
 * - DL sequence tensor (40×6) feeds the time sequence model for forecast
 * - season calendar pressure multiplies cadence for live-ops urgency
 * - hold ledger is the authoritative contract surface for decision extends
 * - budget service centralizes all arithmetic; this engine delegates faithfully
 *
 * Surface summary:
 *   § 1  — Imports (comprehensive, all used in runtime code)
 *   § 2  — TIME_ML_FEATURE_LABELS — 28-dimensional feature vector labels
 *   § 3  — TIME_DL_COLUMN_LABELS  — 6-column DL sequence tensor labels
 *   § 4  — Exported interface definitions
 *          TimeMLVector, TimeDLTensor, TimeRuntimeSnapshot, TimeTrendSnapshot,
 *          TimeSessionAnalytics, TimePhaseAnalytics, TimeBudgetAnalytics,
 *          TimeDecisionWindowAnalytics, TimeHoldAnalytics, TimeCadenceSnapshot,
 *          TimeNarrative, TimeResilienceScore, TimeRecoveryForecast,
 *          TimeScoreDecomposition, TimeExportBundle, TimeValidationResult,
 *          TimeSelfTestResult, TimeTickRecord, TimeChatSignal,
 *          TimeDecisionWindowSummary, TimeCadenceResolutionSnapshot
 *   § 5  — Internal type definitions
 *   § 6  — Module-level limits, weights, and thresholds
 *   § 7  — Pure helper utilities
 *   § 8  — TimeEngine class
 *          8a — Core SimulationEngine interface (tick, canRun, getHealth, reset)
 *          8b — Decision window management (open, resolve, nullify, card-typed)
 *          8c — Hold management (apply, release, spend, ledger)
 *          8d — Tier forcing and cadence overrides
 *          8e — ML/DL pipeline (extractMLVector, extractDLTensor)
 *          8f — Runtime snapshot
 *          8g — Session analytics
 *          8h — Trend analysis
 *          8i — Phase analytics
 *          8j — Budget analytics
 *          8k — Decision window analytics
 *          8l — Hold analytics
 *          8m — Cadence resolution + interpolation plan
 *          8n — Narrative generation
 *          8o — Resilience scoring
 *          8p — Recovery forecasting
 *          8q — Score decomposition
 *          8r — Export bundle
 *          8s — Validation
 *          8t — Self-test
 *          8u — Season calendar integration
 *          8v — Pressure reader integration
 *          8w — Budget service integration
 *          8x — History (tick history, ML history, event history)
 *          8y — Chat signal generation
 *          8z — Serialization
 *          8α — Private helpers
 * ============================================================================ */

/* ============================================================================
 * § 1 — IMPORTS
 * ============================================================================ */

import {
  createEngineHealth,
  createEngineSignal,
  type EngineHealth,
  type EngineSignal,
  type EngineSignalSeverity,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
} from '../core/EngineContracts';

import type {
  ModeCode,
  PressureTier,
  RunPhase,
  TimingClass,
  RunOutcome,
} from '../core/GamePrimitives';

import type {
  RunStateSnapshot,
  RuntimeDecisionWindowSnapshot,
  TimerState,
  TelemetryState,
} from '../core/RunStateSnapshot';

import { DecisionTimer } from './DecisionTimer';
import { TickRateInterpolator } from './TickRateInterpolator';

import {
  SeasonClock,
  SeasonWindowType,
  type SeasonLifecycleState,
  type SeasonTimelineManifest,
  type SeasonPressureContext,
  type SeasonClockSnapshot,
  type SeasonTimeWindow,
} from './SeasonClock';

import {
  HoldActionLedger,
  type ActiveHoldRecord,
  type HoldSpendRequest,
  type HoldSpendResult,
  type HoldLedgerSnapshot,
} from './HoldActionLedger';

import {
  TimeBudgetService,
  type TimeBudgetProjection,
  type TimeAdvanceRequest,
} from './TimeBudgetService';

import type {
  TimeCadenceResolution,
  TimeProjectionResult,
  TimeRuntimeContext,
} from './contracts';

import {
  TickTier,
  TICK_TIER_CONFIGS,
  TICK_TIER_BY_PRESSURE_TIER,
  PRESSURE_TIER_BY_TICK_TIER,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  PHASE_BOUNDARIES_MS,
  pressureTierToTickTier,
  tickTierToPressureTier,
  getTickTierConfigByPressureTier,
  getTickTierConfig,
  getDefaultTickDurationMs,
  getDecisionWindowDurationMs,
  clampNonNegativeInteger,
  clampTickDurationMs,
  normalizeTickDurationMs,
  computeInterpolationTickCount,
  createInterpolationPlan,
  resolvePhaseFromElapsedMs,
  isPhaseBoundaryTransition,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  DecisionCardType,
  type PressureReader,
  type TickTierConfig,
  type TickInterpolationPlan,
  type DecisionWindow,
  type DecisionWindowTickEvent,
  type TickEvent,
  type TierChangeEvent,
  type DecisionWindowOpenedEvent,
  type DecisionWindowExpiredEvent,
  type DecisionWindowResolvedEvent,
  type HoldActionUsedEvent,
  type RunTimeoutEvent,
  type TickTierForcedEvent,
  type TimeEngineEvent,
  type TimeEngineEventMap,
  type PhaseBoundary,
} from './types';

/* ============================================================================
 * § 2 — TIME_ML_FEATURE_LABELS  (28-dimensional)
 * ============================================================================ */

export const TIME_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'elapsed_ms_normalized',            // 0 — elapsed / total_budget
  'remaining_budget_normalized',      // 1 — remaining / total_budget
  'current_tick_duration_normalized', // 2 — tick_ms / SOVEREIGN_max_ms (20 000)
  'tier_index_normalized',            // 3 — T0=0, T1=0.25, T2=0.5, T3=0.75, T4=1.0
  'tier_interpolating',               // 4 — 1 if mid-transition, else 0
  'tier_interpolation_progress',      // 5 — (total−remaining)/total within transition
  'tier_transition_direction',        // 6 — +1 escalating, −1 de-escalating, 0 stable
  'phase_index_normalized',           // 7 — FOUNDATION=0, ESCALATION=0.5, SOVEREIGNTY=1
  'phase_boundary_windows_remaining', // 8 — boundary_remaining / DEFAULT_PHASE_WINDOWS
  'active_decision_windows_normalized', // 9 — count / 5 clamped to [0,1]
  'frozen_windows_ratio',             // 10 — frozen / max(active,1)
  'hold_charges_remaining',           // 11 — 0 or 1
  'hold_consumed_flag',               // 12 — 1 if hold used this run
  'hold_enabled_flag',                // 13 — 1 if hold enabled
  'forced_tier_active_flag',          // 14 — 1 if forced tier override active
  'forced_tier_ticks_remaining_norm', // 15 — remaining / 10 clamped
  'timeout_proximity',                // 16 — soft signal: 1 − remaining_budget_normalized
  'budget_urgency',                   // 17 — 1 if remaining < 20 % of total
  'tier_duration_vs_t1_ratio',        // 18 — current_duration / T1_default (13 000 ms)
  'decision_window_density',          // 19 — active / (active + expired_this_run) clamped
  'decision_window_expiry_rate',      // 20 — expired / max(total_opened, 1)
  'decision_window_hold_rate',        // 21 — holds_applied / max(windows_opened, 1)
  'average_window_urgency',           // 22 — mean urgency across active windows [0,1]
  'phase_time_pct',                   // 23 — ms_into_phase / phase_total_duration
  'season_pressure_multiplier_norm',  // 24 — (multiplier − 0.1) / (4.0 − 0.1)
  'tier_change_count_normalized',     // 25 — tier_changes / 10 clamped to [0,1]
  'tick_count_normalized',            // 26 — tick / expected_total_ticks
  'budget_extension_ratio',           // 27 — extension / max(season_budget,1)
]);

/* ============================================================================
 * § 3 — TIME_DL_COLUMN_LABELS  (6-column sequence tensor, 40 rows)
 * ============================================================================ */

export const TIME_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  'tick_duration_normalized', // col 0
  'tier_index_normalized',    // col 1
  'budget_utilization',       // col 2
  'phase_progress',           // col 3
  'active_windows_norm',      // col 4
  'hold_consumed_flag',       // col 5
]);

/** DL sequence row count (history depth). */
export const TIME_DL_ROW_COUNT = 40 as const;

/** DL column count. */
export const TIME_DL_COL_COUNT = TIME_DL_COLUMN_LABELS.length as 6;

/* ============================================================================
 * § 4 — EXPORTED INTERFACE DEFINITIONS
 * ============================================================================ */

/** 28-dimensional ML feature vector keyed by label index. */
export interface TimeMLVector {
  readonly features: Readonly<Float64Array>;
  readonly labels: readonly string[];
  readonly tick: number;
  readonly computedAtMs: number;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
}

/** 40×6 DL sequence tensor for time sequence modelling. */
export interface TimeDLTensor {
  /** Row-major flat array: rows × cols = 40 × 6 = 240 values. */
  readonly values: Readonly<Float64Array>;
  readonly rowCount: 40;
  readonly colCount: 6;
  readonly columnLabels: readonly string[];
  readonly tickStart: number;
  readonly tickEnd: number;
}

/** Authoritative runtime state snapshot for the time engine. */
export interface TimeRuntimeSnapshot {
  readonly engineId: 'time';
  readonly tick: number;
  readonly phase: RunPhase;
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly tickTierConfig: TickTierConfig;
  readonly currentTickDurationMs: number;
  readonly elapsedMs: number;
  readonly seasonBudgetMs: number;
  readonly extensionBudgetMs: number;
  readonly totalBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly budgetUtilizationPct: number;
  readonly holdEnabled: boolean;
  readonly holdChargesRemaining: number;
  readonly holdConsumedThisRun: boolean;
  readonly activeDecisionWindowCount: number;
  readonly frozenDecisionWindowCount: number;
  readonly forcedTierActive: boolean;
  readonly forcedTier: PressureTier | null;
  readonly forcedTierTicksRemaining: number;
  readonly interpolating: boolean;
  readonly interpolationRemainingTicks: number;
  readonly phaseBoundaryWindowsRemaining: number;
  readonly lastTierChangeTick: number | null;
  readonly tierChangeCountThisRun: number;
  readonly windowsOpenedThisRun: number;
  readonly windowsExpiredThisRun: number;
  readonly windowsResolvedThisRun: number;
  readonly seasonPressureMultiplier: number;
  readonly seasonLifecycle: SeasonLifecycleState;
}

/** Per-tick record stored in history. */
export interface TimeTickRecord {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly durationMs: number;
  readonly elapsedMs: number;
  readonly budgetUtilizationPct: number;
  readonly phaseChanged: boolean;
  readonly tierChanged: boolean;
  readonly expiredWindowCount: number;
  readonly holdConsumed: boolean;
  readonly timeoutReached: boolean;
  readonly forcedTierActive: boolean;
  readonly seasonMultiplier: number;
  readonly nowMs: number;
  readonly mlVector: TimeMLVector | null;
}

/** Trend analysis over the last N ticks. */
export interface TimeTrendSnapshot {
  readonly windowSize: number;
  readonly avgTickDurationMs: number;
  readonly minTickDurationMs: number;
  readonly maxTickDurationMs: number;
  readonly tierFrequency: Readonly<Record<PressureTier, number>>;
  readonly phaseFrequency: Readonly<Record<RunPhase, number>>;
  readonly avgBudgetUtilizationDelta: number;
  readonly totalExpiredWindowsInWindow: number;
  readonly totalHoldsAppliedInWindow: number;
  readonly tierEscalationCount: number;
  readonly tierDeEscalationCount: number;
  readonly phaseTransitionCount: number;
  readonly isAcceleratingThisTick: boolean;
  readonly isDeceleratingThisTick: boolean;
  readonly dominantTier: PressureTier;
  readonly dominantPhase: RunPhase;
}

/** Full session summary for the active run. */
export interface TimeSessionAnalytics {
  readonly totalTicks: number;
  readonly totalElapsedMs: number;
  readonly budgetUtilizationPct: number;
  readonly remainingBudgetMs: number;
  readonly phaseBreakdown: Readonly<Record<RunPhase, number>>;
  readonly tierBreakdown: Readonly<Record<PressureTier, number>>;
  readonly totalWindowsOpened: number;
  readonly totalWindowsExpired: number;
  readonly totalWindowsResolved: number;
  readonly windowExpiryRate: number;
  readonly windowResolutionRate: number;
  readonly holdUsed: boolean;
  readonly holdChargesRemaining: number;
  readonly totalTierChanges: number;
  readonly avgTierDurationTicks: number;
  readonly timeInCollapseImminentTicks: number;
  readonly timeInSovereignTicks: number;
  readonly totalTimeoutRisk: number;
  readonly seasonLifecycle: SeasonLifecycleState;
  readonly seasonPressureMultiplierAvg: number;
  readonly longestWindowDurationMs: number;
  readonly shortestWindowDurationMs: number;
  readonly currentPhase: RunPhase;
  readonly currentTier: PressureTier;
  readonly projectedTicksRemaining: number;
}

/** Per-phase timing breakdown. */
export interface TimePhaseAnalytics {
  readonly currentPhase: RunPhase;
  readonly phaseStartElapsedMs: number;
  readonly phaseElapsedMs: number;
  readonly phaseDurationEstimateMs: number;
  readonly phaseProgressPct: number;
  readonly ticksInPhase: number;
  readonly avgTierInPhase: number;
  readonly windowsOpenedInPhase: number;
  readonly windowsExpiredInPhase: number;
  readonly phaseBoundaryWindowsRemaining: number;
  readonly phaseTransitionImminent: boolean;
  readonly nextPhase: RunPhase | null;
  readonly boundaries: readonly PhaseBoundary[];
}

/** Budget consumption analysis. */
export interface TimeBudgetAnalytics {
  readonly seasonBudgetMs: number;
  readonly extensionBudgetMs: number;
  readonly totalBudgetMs: number;
  readonly elapsedMs: number;
  readonly remainingBudgetMs: number;
  readonly utilizationPct: number;
  readonly projectedExhaustionTick: number;
  readonly projectedExhaustionMs: number;
  readonly avgTickDurationMs: number;
  readonly isNearingBudgetEnd: boolean;
  readonly budgetAlertLevel: 'OK' | 'CAUTION' | 'WARNING' | 'CRITICAL';
  readonly hasExtension: boolean;
  readonly extensionPct: number;
  readonly ticksAtCurrentTierUntilExhaustion: number;
  readonly budgetProjection: TimeBudgetProjection | null;
}

/** Decision window health metrics. */
export interface TimeDecisionWindowAnalytics {
  readonly activeWindowCount: number;
  readonly frozenWindowCount: number;
  readonly openedThisRun: number;
  readonly expiredThisRun: number;
  readonly resolvedThisRun: number;
  readonly nullifiedThisRun: number;
  readonly expiryRate: number;
  readonly resolutionRate: number;
  readonly avgWindowDurationMs: number;
  readonly longestOpenWindowMs: number;
  readonly urgentWindowCount: number;
  readonly windowSummaries: readonly TimeDecisionWindowSummary[];
  readonly holdRate: number;
}

/** Enriched decision window view. */
export interface TimeDecisionWindowSummary {
  readonly windowId: string;
  readonly timingClass: TimingClass;
  readonly label: string;
  readonly source: string;
  readonly openedAtTick: number;
  readonly openedAtMs: number;
  readonly closesAtMs: number | null;
  readonly remainingMs: number | null;
  readonly frozen: boolean;
  readonly urgency: number;
  readonly actorId: string | null;
  readonly cardInstanceId: string | null;
  readonly mode: ModeCode;
}

/** Hold usage summary. */
export interface TimeHoldAnalytics {
  readonly enabled: boolean;
  readonly chargesRemaining: number;
  readonly chargesConsumedThisRun: number;
  readonly holdConsumedThisRun: boolean;
  readonly activeHold: ActiveHoldRecord | null;
  readonly frozenWindowIds: readonly string[];
  readonly holdLedgerSnapshot: HoldLedgerSnapshot;
  readonly defaultHoldDurationMs: number;
  readonly holdDurationMs: number;
}

/** Current cadence state snapshot. */
export interface TimeCadenceSnapshot {
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly config: TickTierConfig;
  readonly currentDurationMs: number;
  readonly defaultDurationMs: number;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly decisionWindowMs: number;
  readonly isInterpolating: boolean;
  readonly interpolationRemainingTicks: number;
  readonly interpolationPlan: TickInterpolationPlan | null;
  readonly seasonPressureMultiplier: number;
  readonly effectiveDurationMs: number;
  readonly visualBorderClass: string;
  readonly audioSignal: string | null;
  readonly screenShake: boolean;
}

/** UX narrative output for the current time state. */
export interface TimeNarrative {
  readonly headline: string;
  readonly subtext: string;
  readonly urgencyLevel: 'CALM' | 'HEIGHTENED' | 'URGENT' | 'CRITICAL';
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly cadenceLabel: string;
  readonly budgetRemainingLabel: string;
  readonly holdAvailableLabel: string;
  readonly activeWindowsLabel: string;
  readonly phaseProgressLabel: string;
  readonly timeoutWarning: string | null;
  readonly seasonLabel: string | null;
  readonly uxTags: readonly string[];
  readonly companionPriority: number;
}

/** Composite resilience score for the time lane. */
export interface TimeResilienceScore {
  readonly overall: number;
  readonly budgetHealth: number;
  readonly decisionWindowHealth: number;
  readonly holdReadiness: number;
  readonly cadenceStability: number;
  readonly phaseProgress: number;
  readonly label: 'SOVEREIGN' | 'STABLE' | 'UNDER_PRESSURE' | 'CRITICAL' | 'COLLAPSING';
  readonly breakdown: Readonly<{
    budgetWeight: number;
    windowWeight: number;
    holdWeight: number;
    cadenceWeight: number;
    phaseWeight: number;
  }>;
}

/** Recovery forecast: path back to optimal cadence. */
export interface TimeRecoveryForecast {
  readonly currentTier: PressureTier;
  readonly targetTier: PressureTier;
  readonly ticksToRecovery: number;
  readonly msToRecovery: number;
  readonly recoveryProbability: number;
  readonly blockers: readonly string[];
  readonly recommendations: readonly string[];
  readonly budgetSufficient: boolean;
  readonly forecastLabel: string;
}

/** Component score breakdown. */
export interface TimeScoreDecomposition {
  readonly budgetUtilizationScore: number;
  readonly decisionPerformanceScore: number;
  readonly holdEfficiencyScore: number;
  readonly cadenceScore: number;
  readonly phaseProgressScore: number;
  readonly composite: number;
  readonly weights: Readonly<{
    budget: number;
    decision: number;
    hold: number;
    cadence: number;
    phase: number;
  }>;
}

/** Full state export bundle. */
export interface TimeExportBundle {
  readonly engineId: 'time';
  readonly exportedAtMs: number;
  readonly runtimeSnapshot: TimeRuntimeSnapshot;
  readonly mlVector: TimeMLVector;
  readonly dlTensor: TimeDLTensor;
  readonly sessionAnalytics: TimeSessionAnalytics;
  readonly trendSnapshot: TimeTrendSnapshot;
  readonly phaseAnalytics: TimePhaseAnalytics;
  readonly budgetAnalytics: TimeBudgetAnalytics;
  readonly windowAnalytics: TimeDecisionWindowAnalytics;
  readonly holdAnalytics: TimeHoldAnalytics;
  readonly cadenceSnapshot: TimeCadenceSnapshot;
  readonly narrative: TimeNarrative;
  readonly resilienceScore: TimeResilienceScore;
  readonly recoveryForecast: TimeRecoveryForecast;
  readonly scoreDecomposition: TimeScoreDecomposition;
  readonly seasonSnapshot: SeasonClockSnapshot;
  readonly validation: TimeValidationResult;
  readonly tickHistory: readonly TimeTickRecord[];
  readonly mlHistory: readonly TimeMLVector[];
}

/** Validation report. */
export interface TimeValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly checks: Readonly<Record<string, boolean>>;
  readonly score: number;
}

/** Self-test result. */
export interface TimeSelfTestResult {
  readonly passed: boolean;
  readonly testCount: number;
  readonly passCount: number;
  readonly failCount: number;
  readonly results: readonly Readonly<{
    name: string;
    passed: boolean;
    error: string | null;
    durationMs: number;
  }>[];
  readonly totalDurationMs: number;
}

/** Chat-lane signal payload. */
export interface TimeChatSignal {
  readonly signalType: 'TIME_TICK' | 'TIME_TIER_CHANGE' | 'TIME_PHASE_CHANGE'
    | 'TIME_TIMEOUT_WARNING' | 'TIME_HOLD_CONSUMED' | 'TIME_WINDOW_EXPIRED'
    | 'TIME_BUDGET_CRITICAL' | 'TIME_WINDOW_OPENED';
  readonly priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'AMBIENT';
  readonly tick: number;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly budgetUtilizationPct: number;
  readonly remainingBudgetMs: number;
  readonly narrative: string;
  readonly urgencyScore: number;
  readonly mlFeatures: Readonly<Float64Array>;
  readonly tags: readonly string[];
  readonly suppressIfSameTierFor: number;
  readonly companionChannelHint: string;
}

/** Cadence resolution snapshot computed from full policy. */
export interface TimeCadenceResolutionSnapshot {
  readonly baseTier: PressureTier;
  readonly resolvedTier: PressureTier;
  readonly durationMs: number;
  readonly decisionWindowMs: number;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly seasonMultiplier: number;
  readonly modeTempoMultiplier: number;
  readonly budgetTempoMultiplier: number;
  readonly remainingBudgetMs: number;
  readonly shouldScreenShake: boolean;
  readonly shouldOpenEndgameWindow: boolean;
  readonly shouldInterpolate: boolean;
  readonly reasonCodes: readonly string[];
}

/* ============================================================================
 * § 5 — INTERNAL TYPES
 * ============================================================================ */

interface ForcedTierOverride {
  readonly tier: PressureTier;
  ticksRemaining: number;
}

interface OpenDecisionWindowOptions {
  readonly timingClass?: TimingClass;
  readonly label?: string;
  readonly source?: string;
  readonly mode?: ModeCode;
  readonly openedAtTick?: number;
  readonly openedAtMs?: number;
  readonly closesAtTick?: number | null;
  readonly exclusive?: boolean;
  readonly actorId?: string | null;
  readonly targetActorId?: string | null;
  readonly cardInstanceId?: string | null;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

interface OpenDecisionWindowForCardOptions extends OpenDecisionWindowOptions {
  readonly cardType: DecisionCardType;
  readonly cardId: string;
  readonly worstOptionIndex?: number;
}

interface PhaseRecord {
  readonly phase: RunPhase;
  readonly enteredAtTick: number;
  readonly enteredAtElapsedMs: number;
  tickCount: number;
  windowsOpened: number;
  windowsExpired: number;
  tierSum: number;
}

interface TierRecord {
  readonly tier: PressureTier;
  readonly enteredAtTick: number;
  tickCount: number;
}

interface EventRecord<K extends keyof TimeEngineEventMap> {
  readonly eventType: K;
  readonly payload: TimeEngineEventMap[K];
  readonly tick: number;
  readonly nowMs: number;
}

type AnyEventRecord = {
  [K in keyof TimeEngineEventMap]: EventRecord<K>;
}[keyof TimeEngineEventMap];

/* ============================================================================
 * § 6 — MODULE-LEVEL LIMITS, WEIGHTS, AND THRESHOLDS
 * ============================================================================ */

/** Maximum ticks retained in the tick history ring buffer. */
const MAX_TICK_HISTORY = 50 as const;

/** Maximum ML vectors retained in the ML history ring buffer. */
const MAX_ML_HISTORY = 50 as const;

/** Maximum events retained in the event history ring buffer. */
const MAX_EVENT_HISTORY = 100 as const;

/** Maximum forced-tier tick count (used for normalization). */
const MAX_FORCED_TIER_TICKS = 10 as const;

/** Maximum expected decision windows open simultaneously (for normalization). */
const MAX_EXPECTED_ACTIVE_WINDOWS = 5 as const;

/** Normalized T1 default tick duration used as reference (13 000 ms). */
const T1_DEFAULT_DURATION_MS = TIER_DURATIONS_MS['T1'];

/** Maximum tick duration for normalization anchor (T0 = 20 000 ms). */
const MAX_TICK_DURATION_MS = TICK_TIER_CONFIGS[TickTier.SOVEREIGN].maxDurationMs;

/** Budget urgency threshold: alert when < 20% remaining. */
const BUDGET_URGENCY_THRESHOLD = 0.20 as const;

/** Budget caution threshold: caution when < 40% remaining. */
const BUDGET_CAUTION_THRESHOLD = 0.40 as const;

/** Budget warning threshold: warning when < 15% remaining. */
const BUDGET_WARNING_THRESHOLD = 0.15 as const;

/** Budget critical threshold: critical when < 8% remaining. */
const BUDGET_CRITICAL_THRESHOLD = 0.08 as const;

/** Score decomposition weights (must sum to 1.0). */
const SCORE_WEIGHTS = Object.freeze({
  budget:   0.30,
  decision: 0.25,
  hold:     0.15,
  cadence:  0.20,
  phase:    0.10,
});

/** Approximate total ticks in a full run at T1 cadence (10 min / 13 s ≈ 46). */
const ESTIMATED_TOTAL_TICKS_T1 = Math.round(
  (10 * 60 * 1_000) / T1_DEFAULT_DURATION_MS,
);

/** Phase duration estimates (ms). */
const PHASE_DURATION_ESTIMATES_MS: Readonly<Record<RunPhase, number>> = Object.freeze({
  FOUNDATION:  4 * 60 * 1_000,
  ESCALATION:  4 * 60 * 1_000,
  SOVEREIGNTY: 2 * 60 * 1_000,
});

/** Window urgency high threshold: alert when < 2 s remaining. */
const WINDOW_URGENT_REMAINING_MS = 2_000 as const;

/* ============================================================================
 * § 7 — PURE HELPER UTILITIES
 * ============================================================================ */

/**
 * Deduplicate and freeze tags from heterogeneous inputs.
 */
function dedupeTags(
  ...parts: ReadonlyArray<readonly string[] | string | null | undefined>
): readonly string[] {
  const tags = new Set<string>();

  for (const part of parts) {
    if (part === null || part === undefined) continue;
    if (typeof part === 'string') {
      if (part.length > 0) tags.add(part);
      continue;
    }
    for (const tag of part) {
      if (tag.length > 0) tags.add(tag);
    }
  }

  return Object.freeze([...tags]);
}

/**
 * Compute remaining ms for a decision window given current time.
 */
function getWindowRemainingMs(
  window: RuntimeDecisionWindowSnapshot,
  nowMs: number,
): number | null {
  if (window.closesAtMs === null) return null;
  return Math.max(0, Math.trunc(window.closesAtMs) - Math.trunc(nowMs));
}

/**
 * Compute duration ms for a decision window.
 */
function getWindowDurationMs(
  window: RuntimeDecisionWindowSnapshot,
  nowMs: number,
): number {
  if (window.closesAtMs === null) return 0;
  return Math.max(0, Math.trunc(window.closesAtMs) - Math.trunc(nowMs));
}

/**
 * Normalize a value to [0, 1] range.
 */
function normalize01(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Clamp a value to [0, 1] range with NaN guard.
 */
function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Map a PressureTier to a normalized [0, 1] index.
 */
function tierToNormalized(tier: PressureTier): number {
  const map: Readonly<Record<PressureTier, number>> = {
    T0: 0.00,
    T1: 0.25,
    T2: 0.50,
    T3: 0.75,
    T4: 1.00,
  };
  return map[tier] ?? 0.25;
}

/**
 * Map a RunPhase to a normalized [0, 1] index.
 */
function phaseToNormalized(phase: RunPhase): number {
  const map: Readonly<Record<RunPhase, number>> = {
    FOUNDATION:  0.00,
    ESCALATION:  0.50,
    SOVEREIGNTY: 1.00,
  };
  return map[phase] ?? 0.00;
}

/**
 * Build an empty TimeMLVector with all features set to zero.
 */
function buildZeroMLVector(): TimeMLVector {
  return {
    features: Object.freeze(new Float64Array(TIME_ML_FEATURE_LABELS.length)),
    labels:   TIME_ML_FEATURE_LABELS,
    tick:     0,
    computedAtMs: 0,
    tier:     'T1',
    phase:    'FOUNDATION',
  };
}

/**
 * Build a zero DL tensor row.
 */
function buildZeroDLRow(): Float64Array {
  return new Float64Array(TIME_DL_COL_COUNT);
}

/**
 * Determine tier transition direction from previous to current.
 * Returns +1 (escalating), -1 (de-escalating), or 0 (stable).
 */
function computeTierTransitionDirection(
  fromTier: PressureTier,
  toTier: PressureTier,
): number {
  const order: Readonly<Record<PressureTier, number>> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };
  const diff = order[toTier] - order[fromTier];
  if (diff > 0) return 1;
  if (diff < 0) return -1;
  return 0;
}

/**
 * Compute window urgency score (0–1) where 1 = most urgent.
 */
function computeWindowUrgencyScore(
  window: RuntimeDecisionWindowSnapshot,
  nowMs: number,
): number {
  if (window.closesAtMs === null) return 0;
  const remaining = Math.max(0, Math.trunc(window.closesAtMs) - Math.trunc(nowMs));
  const total = Math.max(
    1,
    Math.trunc(window.closesAtMs) - Math.trunc(window.openedAtMs),
  );
  // Urgency = 1 − (remaining / total), clamped
  return clamp01(1 - remaining / total);
}

/**
 * Compute the narrative urgency level based on tier and budget.
 */
function computeNarrativeUrgencyLevel(
  tier: PressureTier,
  budgetUtilizationPct: number,
): TimeNarrative['urgencyLevel'] {
  if (tier === 'T4' || budgetUtilizationPct >= 0.92) return 'CRITICAL';
  if (tier === 'T3' || budgetUtilizationPct >= 0.80) return 'URGENT';
  if (tier === 'T2' || budgetUtilizationPct >= 0.60) return 'HEIGHTENED';
  return 'CALM';
}

/**
 * Format ms into human-readable label (e.g. "2m 34s").
 */
function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Compute mode tempo multiplier for cadence policy.
 * Solo runs are baseline 1.0; multiplayer modes apply light pressure.
 */
function getModeTempoMultiplier(mode: ModeCode): number {
  const tempoMap: Readonly<Record<ModeCode, number>> = {
    solo:  1.00,
    ghost: 1.05,
    pvp:   1.10,
    coop:  0.95,
  };
  return tempoMap[mode] ?? 1.0;
}

/**
 * Compute budget tempo multiplier: increase pressure when budget is low.
 */
function getBudgetTempoMultiplier(remainingBudgetMs: number, totalBudgetMs: number): number {
  if (totalBudgetMs <= 0) return 1.0;
  const remaining = clamp01(remainingBudgetMs / totalBudgetMs);
  if (remaining < 0.05) return 1.30;
  if (remaining < 0.10) return 1.20;
  if (remaining < 0.20) return 1.10;
  return 1.00;
}

/**
 * Compute cadence label for narrative display.
 */
function computeCadenceLabel(tier: PressureTier): string {
  const labels: Readonly<Record<PressureTier, string>> = {
    T0: 'Sovereign Pace',
    T1: 'Stable Cadence',
    T2: 'Compressed Window',
    T3: 'Crisis Mode',
    T4: 'Collapse Imminent',
  };
  return labels[tier];
}

/**
 * Compute resilience label from overall resilience score.
 */
function computeResilienceLabel(score: number): TimeResilienceScore['label'] {
  if (score >= 0.80) return 'SOVEREIGN';
  if (score >= 0.60) return 'STABLE';
  if (score >= 0.40) return 'UNDER_PRESSURE';
  if (score >= 0.20) return 'CRITICAL';
  return 'COLLAPSING';
}

/**
 * Compute forecast label from recovery probability.
 */
function computeForecastLabel(probability: number): string {
  if (probability >= 0.80) return 'Strong recovery path';
  if (probability >= 0.55) return 'Moderate recovery possible';
  if (probability >= 0.30) return 'Challenging — act quickly';
  return 'Recovery unlikely without hold or tier drop';
}

/**
 * Map PressureTier to TickTier using TICK_TIER_BY_PRESSURE_TIER.
 * Uses both the function and constant for runtime verification.
 */
function resolveTickTier(tier: PressureTier): TickTier {
  const fromFunction = pressureTierToTickTier(tier);
  const fromConstant = TICK_TIER_BY_PRESSURE_TIER[tier];
  // Both paths must agree — if they do not, the constant wins for determinism
  return fromConstant ?? fromFunction;
}

/**
 * Map TickTier to PressureTier using PRESSURE_TIER_BY_TICK_TIER.
 */
function resolvePressureTier(tickTier: TickTier): PressureTier {
  const fromFunction = tickTierToPressureTier(tickTier);
  const fromConstant = PRESSURE_TIER_BY_TICK_TIER[tickTier];
  return fromConstant ?? fromFunction;
}

/**
 * Compute projected ticks remaining based on remaining budget and current tier duration.
 */
function computeProjectedTicksRemaining(
  remainingBudgetMs: number,
  currentDurationMs: number,
): number {
  if (currentDurationMs <= 0) return 0;
  return Math.max(0, Math.floor(remainingBudgetMs / currentDurationMs));
}

/**
 * Compute interpolation plan between two pressure tiers.
 * Wraps createInterpolationPlan from types.ts.
 */
function buildInterpolationPlanForTiers(
  fromTier: PressureTier,
  toTier: PressureTier,
): TickInterpolationPlan {
  const fromTickTier = resolveTickTier(fromTier);
  const toTickTier = resolveTickTier(toTier);
  const fromDurationMs = getDefaultTickDurationMs(fromTier);
  const toDurationMs = getDefaultTickDurationMs(toTier);
  return createInterpolationPlan(fromTickTier, toTickTier, fromDurationMs, toDurationMs);
}

/**
 * Compute tier change count normalization.
 */
function normalizeTierChangeCount(count: number): number {
  return clamp01(clampNonNegativeInteger(count) / MAX_FORCED_TIER_TICKS);
}

/**
 * Build a DecisionWindow runtime view from a RuntimeDecisionWindowSnapshot.
 */
function buildDecisionWindowView(
  windowId: string,
  snapshot: RuntimeDecisionWindowSnapshot,
  nowMs: number,
): DecisionWindow {
  const durationMs = snapshot.closesAtMs !== null
    ? Math.max(0, Math.trunc(snapshot.closesAtMs) - Math.trunc(snapshot.openedAtMs))
    : 0;
  const remainingMs = snapshot.closesAtMs !== null
    ? Math.max(0, Math.trunc(snapshot.closesAtMs) - Math.trunc(nowMs))
    : 0;

  return {
    windowId,
    cardId:           snapshot.cardInstanceId ?? windowId,
    cardType:         DecisionCardType.FORCED_FATE,
    durationMs,
    remainingMs,
    openedAtMs:       snapshot.openedAtMs,
    expiresAtMs:      snapshot.closesAtMs ?? (snapshot.openedAtMs + durationMs),
    isOnHold:         snapshot.frozen,
    holdExpiresAtMs:  null,
    worstOptionIndex: 0,
    isExpired:        snapshot.closesAtMs !== null && Math.trunc(snapshot.closesAtMs) <= Math.trunc(nowMs),
    isResolved:       snapshot.consumed,
  };
}

/**
 * Build a TimeDecisionWindowSummary from a RuntimeDecisionWindowSnapshot.
 */
function buildWindowSummary(
  windowId: string,
  snapshot: RuntimeDecisionWindowSnapshot,
  nowMs: number,
): TimeDecisionWindowSummary {
  const remaining = getWindowRemainingMs(snapshot, nowMs);
  return {
    windowId,
    timingClass:    snapshot.timingClass,
    label:          snapshot.label,
    source:         snapshot.source,
    openedAtTick:   snapshot.openedAtTick,
    openedAtMs:     snapshot.openedAtMs,
    closesAtMs:     snapshot.closesAtMs,
    remainingMs:    remaining,
    frozen:         snapshot.frozen,
    urgency:        computeWindowUrgencyScore(snapshot, nowMs),
    actorId:        snapshot.actorId,
    cardInstanceId: snapshot.cardInstanceId,
    mode:           snapshot.mode,
  };
}

/**
 * Build a TickEvent payload from a completed tick.
 */
function buildTickEventPayload(
  tick: number,
  durationMs: number,
  tier: TickTier,
  tierChangedThisTick: boolean,
  previousTier: TickTier | null,
  expiredWindowIds: readonly string[],
  resolvedWindowIds: readonly string[],
  holdUsed: boolean,
  nowMs: number,
): TickEvent {
  return {
    eventType:                  'TICK_COMPLETE',
    tickNumber:                 tick,
    tickDurationMs:             durationMs,
    tier,
    tierChangedThisTick,
    previousTier:               tierChangedThisTick ? previousTier : null,
    timestamp:                  nowMs,
    decisionsExpiredThisTick:   [...expiredWindowIds],
    decisionsResolvedThisTick:  [...resolvedWindowIds],
    holdActionUsedThisTick:     holdUsed,
  };
}

/**
 * Build a TierChangeEvent payload.
 */
function buildTierChangeEventPayload(
  from: TickTier,
  to: TickTier,
  interpolationTicks: number,
  nowMs: number,
): TierChangeEvent {
  return {
    eventType:          'TICK_TIER_CHANGED',
    from,
    to,
    interpolationTicks: computeInterpolationTickCount(
      Math.abs(
        TIER_DURATIONS_MS[resolvePressureTier(to)] -
        TIER_DURATIONS_MS[resolvePressureTier(from)],
      ),
    ),
    timestamp: nowMs,
  };
}

/**
 * Build a DecisionWindowOpenedEvent payload.
 */
function buildWindowOpenedPayload(
  windowId: string,
  window: DecisionWindow,
): DecisionWindowOpenedEvent {
  return {
    eventType: 'DECISION_WINDOW_OPENED',
    window,
  };
}

/**
 * Build a DecisionWindowExpiredEvent payload.
 */
function buildWindowExpiredPayload(
  windowId: string,
  cardId: string,
  autoResolvedToOptionIndex: number,
  holdWasActive: boolean,
): DecisionWindowExpiredEvent {
  return {
    eventType:                  'DECISION_WINDOW_EXPIRED',
    windowId,
    cardId,
    autoResolvedToOptionIndex,
    holdWasActive,
  };
}

/**
 * Build a DecisionWindowResolvedEvent payload.
 */
function buildWindowResolvedPayload(
  windowId: string,
  cardId: string,
  chosenOptionIndex: number,
  msRemainingAtResolution: number,
): DecisionWindowResolvedEvent {
  return {
    eventType:                  'DECISION_WINDOW_RESOLVED',
    windowId,
    cardId,
    chosenOptionIndex,
    msRemainingAtResolution,
  };
}

/**
 * Build a HoldActionUsedEvent payload.
 */
function buildHoldUsedPayload(
  windowId: string,
  holdDurationMs: number,
  holdExpiresAtMs: number,
  holdsRemainingInRun: number,
): HoldActionUsedEvent {
  return {
    eventType:            'HOLD_ACTION_USED',
    windowId,
    holdDurationMs,
    holdExpiresAtMs,
    holdsRemainingInRun,
  };
}

/**
 * Build a RunTimeoutEvent payload.
 */
function buildRunTimeoutPayload(ticksElapsed: number): RunTimeoutEvent {
  return {
    eventType:    'RUN_TIMEOUT',
    ticksElapsed,
    outcome:      'TIMEOUT',
  };
}

/**
 * Build a TickTierForcedEvent payload.
 */
function buildTierForcedPayload(
  tier: TickTier,
  durationTicks: number,
  nowMs: number,
): TickTierForcedEvent {
  return {
    eventType:      'TICK_TIER_FORCED',
    tier,
    durationTicks,
    timestamp:      nowMs,
  };
}

/**
 * Build a DecisionWindowTickEvent countdown payload.
 */
function buildWindowTickEventPayload(
  windowId: string,
  remainingMs: number,
  nowMs: number,
): DecisionWindowTickEvent {
  return {
    eventType:   'DECISION_WINDOW_TICK',
    windowId,
    remainingMs,
    timestamp:   nowMs,
  };
}

/* ============================================================================
 * § 8 — TimeEngine CLASS
 * ============================================================================ */

export class TimeEngine implements SimulationEngine {
  public readonly engineId = 'time' as const;

  // ─── Core subsystem components ──────────────────────────────────────────────
  private readonly interpolator = new TickRateInterpolator('T1');
  private readonly decisionTimer = new DecisionTimer();
  private readonly seasonClock = new SeasonClock();
  private readonly holdLedger = new HoldActionLedger();
  private readonly budgetService = new TimeBudgetService();

  // ─── Runtime ledger ──────────────────────────────────────────────────────────
  private forcedTierOverride: ForcedTierOverride | null = null;
  private holdConsumedThisRun = false;
  private lastResolvedTier: PressureTier = 'T1';
  private runtimeHoldCharges: number | null = null;
  private runtimeHoldEnabled = true;

  // ─── Counters and tracking ───────────────────────────────────────────────────
  private windowsOpenedThisRun = 0;
  private windowsExpiredThisRun = 0;
  private windowsResolvedThisRun = 0;
  private windowsNullifiedThisRun = 0;
  private tierChangeCountThisRun = 0;
  private holdsAppliedThisRun = 0;
  private lastSeasonMultiplier = 1.0;

  // ─── Phase / tier ledgers ────────────────────────────────────────────────────
  private currentPhaseRecord: PhaseRecord | null = null;
  private currentTierRecord: TierRecord | null = null;
  private phaseHistory: PhaseRecord[] = [];
  private tierHistory: TierRecord[] = [];

  // ─── History ring buffers ────────────────────────────────────────────────────
  private readonly tickHistory: TimeTickRecord[] = [];
  private readonly mlHistory: TimeMLVector[] = [];
  private readonly eventHistory: AnyEventRecord[] = [];

  // ─── DL tensor ring buffer (40 rows) ─────────────────────────────────────────
  private readonly dlRows: Float64Array[] = [];

  // ─── Pressure reader cache ────────────────────────────────────────────────────
  private latestPressureReading: PressureReader | null = null;

  // ─── Cached last snapshot (set each tick) ────────────────────────────────────
  private lastSnapshot: RunStateSnapshot | null = null;
  private lastNowMs = 0;

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8a — Core SimulationEngine interface
   * ══════════════════════════════════════════════════════════════════════════ */

  public reset(): void {
    this.interpolator.reset('T1');
    this.decisionTimer.reset();
    this.seasonClock.reset();
    this.holdLedger.reset(1, true);
    this.forcedTierOverride = null;
    this.holdConsumedThisRun = false;
    this.lastResolvedTier = 'T1';
    this.runtimeHoldCharges = null;
    this.runtimeHoldEnabled = true;
    this.windowsOpenedThisRun = 0;
    this.windowsExpiredThisRun = 0;
    this.windowsResolvedThisRun = 0;
    this.windowsNullifiedThisRun = 0;
    this.tierChangeCountThisRun = 0;
    this.holdsAppliedThisRun = 0;
    this.lastSeasonMultiplier = 1.0;
    this.currentPhaseRecord = null;
    this.currentTierRecord = null;
    this.phaseHistory = [];
    this.tierHistory = [];
    this.tickHistory.length = 0;
    this.mlHistory.length = 0;
    this.eventHistory.length = 0;
    this.dlRows.length = 0;
    this.latestPressureReading = null;
    this.lastSnapshot = null;
    this.lastNowMs = 0;
  }

  public canRun(snapshot: RunStateSnapshot, context: TickContext): boolean {
    return snapshot.outcome === null && context.step === 'STEP_02_TIME';
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): EngineTickResult {
    const nowMs = Math.trunc(context.nowMs);
    const nextTick = snapshot.tick + 1;

    this.lastSnapshot = snapshot;
    this.lastNowMs = nowMs;

    // ── Sync hold ledger from snapshot ──────────────────────────────────────────
    this.syncRuntimeHoldLedger(snapshot);
    this.holdLedger.rehydrateFromSnapshot(snapshot);

    // ── Sync decision timer from snapshot ───────────────────────────────────────
    const syncResult = this.decisionTimer.syncFromSnapshot(
      snapshot.timers.activeDecisionWindows,
      snapshot.timers.frozenWindowIds,
      nowMs,
    );

    // ── Emit decision.window.opened for newly synced windows ────────────────────
    for (const windowId of syncResult.openedWindowIds) {
      const windowSnapshot = snapshot.timers.activeDecisionWindows[windowId];

      if (windowSnapshot !== undefined) {
        const windowView = buildDecisionWindowView(windowId, windowSnapshot, nowMs);
        const openedPayload = buildWindowOpenedPayload(windowId, windowView);

        context.bus.emit(
          'decision.window.opened',
          {
            windowId,
            tick: nextTick,
            durationMs: getWindowDurationMs(windowSnapshot, nowMs),
            actorId: windowSnapshot.actorId ?? undefined,
          },
          {
            emittedAtTick: nextTick,
            tags: ['engine:time', 'decision:opened'],
          },
        );

        this.recordEvent('DECISION_WINDOW_OPENED', openedPayload, nextTick, nowMs);
        this.windowsOpenedThisRun++;
      }
    }

    // ── Resolve cadence tier ─────────────────────────────────────────────────────
    const effectiveTier = this.resolveCadenceTierFromSnapshot(snapshot);
    const priorTier = this.interpolator.getCurrentTier() ?? this.lastResolvedTier;
    const tierChangedThisTick = priorTier !== effectiveTier;

    if (tierChangedThisTick) {
      this.tierChangeCountThisRun++;
      this.closeTierRecord(nextTick);
      this.openTierRecord(effectiveTier, nextTick);
    }

    this.lastResolvedTier = effectiveTier;

    // ── Advance interpolator ─────────────────────────────────────────────────────
    const durationMs = normalizeTickDurationMs(
      effectiveTier,
      this.interpolator.resolveDurationMs(effectiveTier),
    );
    const effectiveNowMs = nowMs + durationMs;
    const elapsedMs = snapshot.timers.elapsedMs + durationMs;

    // ── Resolve phase ────────────────────────────────────────────────────────────
    const phase = resolvePhaseFromElapsedMs(elapsedMs);
    const phaseChanged = phase !== snapshot.phase;

    if (phaseChanged) {
      this.closePhaseRecord(nextTick);
      this.openPhaseRecord(phase, nextTick, elapsedMs);
    }

    this.currentPhaseRecord && this.currentPhaseRecord.tickCount++;
    this.currentTierRecord && this.currentTierRecord.tickCount++;

    // ── Detect phase boundary transition for analytics ───────────────────────────
    const isBoundaryTransition = isPhaseBoundaryTransition(
      snapshot.timers.elapsedMs,
      elapsedMs,
    );

    const phaseBoundaryWindowsRemaining = phaseChanged
      ? DEFAULT_PHASE_TRANSITION_WINDOWS
      : Math.max(0, snapshot.modeState.phaseBoundaryWindowsRemaining - 1);

    // ── Close expired decision windows ───────────────────────────────────────────
    const expiredWindowIds = this.decisionTimer.closeExpired(effectiveNowMs);
    this.windowsExpiredThisRun += expiredWindowIds.length;

    for (const windowId of expiredWindowIds) {
      const expiredSnapshot = snapshot.timers.activeDecisionWindows[windowId];
      const expiredPayload = buildWindowExpiredPayload(
        windowId,
        expiredSnapshot?.cardInstanceId ?? windowId,
        0,
        expiredSnapshot?.frozen ?? false,
      );

      context.bus.emit(
        'decision.window.closed',
        {
          windowId,
          tick: nextTick,
          accepted: false,
          actorId: expiredSnapshot?.actorId ?? undefined,
        },
        {
          emittedAtTick: nextTick,
          tags: ['engine:time', 'decision:expired'],
        },
      );

      this.recordEvent('DECISION_WINDOW_EXPIRED', expiredPayload, nextTick, nowMs);

      if (this.currentPhaseRecord) {
        this.currentPhaseRecord.windowsExpired++;
      }
    }

    // ── Budget / timeout ─────────────────────────────────────────────────────────
    const totalBudgetMs =
      snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const timeoutReached = snapshot.outcome === null && elapsedMs >= totalBudgetMs;

    const nextOutcome: RunOutcome | null = timeoutReached ? 'TIMEOUT' : snapshot.outcome;
    const nextWarnings = timeoutReached
      ? [...new Set([...snapshot.telemetry.warnings, 'Season budget exhausted.'])]
      : snapshot.telemetry.warnings;

    if (timeoutReached) {
      const timeoutPayload = buildRunTimeoutPayload(nextTick);
      this.recordEvent('RUN_TIMEOUT', timeoutPayload, nextTick, nowMs);
    }

    // ── Hold charges ─────────────────────────────────────────────────────────────
    const nextHoldCharges = snapshot.modeState.holdEnabled
      ? this.resolveRuntimeHoldCharges(snapshot)
      : 0;
    const holdConsumedThisTick = nextHoldCharges < snapshot.timers.holdCharges;

    if (holdConsumedThisTick) {
      const holdPayload = buildHoldUsedPayload(
        'unknown',
        DEFAULT_HOLD_DURATION_MS,
        effectiveNowMs + DEFAULT_HOLD_DURATION_MS,
        nextHoldCharges,
      );
      this.recordEvent('HOLD_ACTION_USED', holdPayload, nextTick, nowMs);
    }

    // ── Season pressure multiplier ────────────────────────────────────────────────
    const seasonMultiplier = this.seasonClock.getPressureMultiplier(nowMs);
    this.lastSeasonMultiplier = seasonMultiplier;

    // ── Emit tier-change event ────────────────────────────────────────────────────
    if (tierChangedThisTick) {
      const priorTickTier = resolveTickTier(priorTier);
      const newTickTier = resolveTickTier(effectiveTier);
      const tierChangePayload = buildTierChangeEventPayload(
        priorTickTier,
        newTickTier,
        computeInterpolationTickCount(
          Math.abs(
            TIER_DURATIONS_MS[effectiveTier] - TIER_DURATIONS_MS[priorTier],
          ),
        ),
        nowMs,
      );
      this.recordEvent('TICK_TIER_CHANGED', tierChangePayload, nextTick, nowMs);
    }

    // ── Compute decision window countdown events ──────────────────────────────────
    const activeWindowSnapshot = this.decisionTimer.snapshot();
    for (const [wid, wsnap] of Object.entries(activeWindowSnapshot)) {
      const remaining = getWindowRemainingMs(wsnap, effectiveNowMs);
      if (remaining !== null && remaining < WINDOW_URGENT_REMAINING_MS) {
        const countdownPayload = buildWindowTickEventPayload(wid, remaining, effectiveNowMs);
        this.recordEvent('DECISION_WINDOW_TICK', countdownPayload, nextTick, effectiveNowMs);
      }
    }

    // ── Build next snapshot ───────────────────────────────────────────────────────
    const nextSnapshot: RunStateSnapshot = {
      ...snapshot,
      tick: nextTick,
      phase,
      outcome: nextOutcome,
      modeState: {
        ...snapshot.modeState,
        phaseBoundaryWindowsRemaining,
      },
      timers: {
        ...snapshot.timers,
        elapsedMs,
        currentTickDurationMs: durationMs,
        nextTickAtMs: timeoutReached ? null : effectiveNowMs,
        holdCharges: nextHoldCharges,
        activeDecisionWindows: this.decisionTimer.snapshot(),
        frozenWindowIds: this.decisionTimer.frozenIds(effectiveNowMs),
        lastTierChangeTick: tierChangedThisTick
          ? nextTick
          : snapshot.timers.lastTierChangeTick,
        tierInterpolationRemainingTicks:
          this.interpolator.getRemainingTransitionTicks(),
        forcedTierOverride: this.forcedTierOverride?.tier ?? null,
      },
      telemetry: {
        ...snapshot.telemetry,
        outcomeReason: timeoutReached
          ? 'Season budget exhausted before financial freedom was achieved.'
          : snapshot.telemetry.outcomeReason,
        outcomeReasonCode: timeoutReached
          ? 'SEASON_BUDGET_EXHAUSTED'
          : snapshot.telemetry.outcomeReasonCode,
        warnings: nextWarnings,
      },
      tags: dedupeTags(
        snapshot.tags,
        phaseChanged ? `phase:${phase.toLowerCase()}:entered` : null,
        tierChangedThisTick ? `time:tier:${effectiveTier.toLowerCase()}` : null,
        expiredWindowIds.length > 0 ? 'decision_window:expired' : null,
        holdConsumedThisTick ? 'time:hold-consumed' : null,
        timeoutReached ? 'run:timeout' : null,
        this.interpolator.isTransitioning() ? 'time:interpolating' : null,
        this.forcedTierOverride !== null ? 'time:forced-tier' : null,
        isBoundaryTransition ? 'time:phase-boundary' : null,
        seasonMultiplier > 1.0 ? `time:season-pressure:${seasonMultiplier.toFixed(2)}` : null,
      ),
    };

    // ── Update internal ledger ────────────────────────────────────────────────────
    this.runtimeHoldCharges = nextHoldCharges;
    this.runtimeHoldEnabled = snapshot.modeState.holdEnabled;

    // ── Build ML vector for this tick ─────────────────────────────────────────────
    const mlVector = this.buildMLVectorFromState(
      nextSnapshot,
      nextTick,
      effectiveNowMs,
      effectiveTier,
      phase,
      expiredWindowIds.length,
      holdConsumedThisTick,
    );

    // ── Store ML vector and DL row in history ─────────────────────────────────────
    this.pushMLHistory(mlVector);
    this.pushDLRow(mlVector);

    // ── Record tick history ───────────────────────────────────────────────────────
    const tickRecord = this.buildTickRecord(
      nextTick,
      phase,
      effectiveTier,
      durationMs,
      elapsedMs,
      totalBudgetMs,
      phaseChanged,
      tierChangedThisTick,
      expiredWindowIds.length,
      holdConsumedThisTick,
      timeoutReached,
      seasonMultiplier,
      effectiveNowMs,
      mlVector,
    );
    this.pushTickHistory(tickRecord);

    // ── Emit TickEvent ────────────────────────────────────────────────────────────
    const tickEventPayload = buildTickEventPayload(
      nextTick,
      durationMs,
      resolveTickTier(effectiveTier),
      tierChangedThisTick,
      tierChangedThisTick ? resolveTickTier(priorTier) : null,
      expiredWindowIds,
      [],
      holdConsumedThisTick,
      effectiveNowMs,
    );
    this.recordEvent('TICK_COMPLETE', tickEventPayload, nextTick, effectiveNowMs);

    // ── Consume forced override tick ──────────────────────────────────────────────
    this.consumeForcedOverrideTick();

    // ── Build engine signals ──────────────────────────────────────────────────────
    const signals = this.buildSignals(
      nextTick,
      phase,
      snapshot.phase,
      effectiveTier,
      priorTier,
      tierChangedThisTick,
      expiredWindowIds,
      holdConsumedThisTick,
      nextHoldCharges,
      timeoutReached,
    );

    return {
      snapshot: nextSnapshot,
      signals,
    };
  }

  public getHealth(): EngineHealth {
    const tickTier = resolveTickTier(this.lastResolvedTier);
    const config = getTickTierConfig(tickTier);

    return createEngineHealth(
      this.engineId,
      'HEALTHY',
      Date.now(),
      [
        `currentDurationMs=${this.interpolator.getCurrentDurationMs()}`,
        `transitioning=${this.interpolator.isTransitioning()}`,
        `activeDecisionWindows=${this.decisionTimer.activeCount()}`,
        `lastResolvedTier=${this.lastResolvedTier}`,
        `forcedTier=${this.forcedTierOverride?.tier ?? 'none'}`,
        `forcedTicksRemaining=${this.forcedTierOverride?.ticksRemaining ?? 0}`,
        `holdConsumedThisRun=${this.holdConsumedThisRun}`,
        `runtimeHoldEnabled=${this.runtimeHoldEnabled}`,
        `runtimeHoldCharges=${this.runtimeHoldCharges ?? 'unknown'}`,
        `windowsOpenedThisRun=${this.windowsOpenedThisRun}`,
        `windowsExpiredThisRun=${this.windowsExpiredThisRun}`,
        `tierChangeCountThisRun=${this.tierChangeCountThisRun}`,
        `tickHistorySize=${this.tickHistory.length}`,
        `mlHistorySize=${this.mlHistory.length}`,
        `seasonLifecycle=${this.seasonClock.getLifecycle()}`,
        `seasonPressureMultiplier=${this.lastSeasonMultiplier.toFixed(3)}`,
        `tickTierConfigDecisionWindowMs=${config.decisionWindowMs}`,
        `screenShake=${config.screenShake}`,
        `holdLedgerCharges=${this.holdLedger.getRemainingCharges()}`,
      ],
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8b — Decision window management
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Open a generic decision window. Called by external surfaces (cards, mode, admin).
   */
  public openDecisionWindow(
    windowId: string,
    closesAtMs: number,
    options: OpenDecisionWindowOptions = {},
  ): void {
    const decisionWindowMs = getDecisionWindowDurationMs(
      options.mode ? this.lastResolvedTier : this.lastResolvedTier,
    );
    const resolvedClosesAtMs = closesAtMs > 0
      ? closesAtMs
      : (this.lastNowMs + decisionWindowMs);

    this.decisionTimer.open(windowId, resolvedClosesAtMs, {
      timingClass: options.timingClass ?? 'FATE',
      label:       options.label ?? windowId,
      source:      options.source ?? 'time-engine',
      mode:        options.mode ?? 'solo',
      openedAtTick:  options.openedAtTick ?? 0,
      openedAtMs:    options.openedAtMs,
      closesAtTick:  options.closesAtTick ?? null,
      exclusive:     options.exclusive ?? false,
      actorId:       options.actorId ?? null,
      targetActorId: options.targetActorId ?? null,
      cardInstanceId: options.cardInstanceId ?? null,
      metadata:      options.metadata,
    });

    this.windowsOpenedThisRun++;

    if (this.currentPhaseRecord) {
      this.currentPhaseRecord.windowsOpened++;
    }
  }

  /**
   * Open a decision window typed to a specific card category.
   * Uses DecisionCardType to differentiate FORCED_FATE, HATER_INJECTION, CRISIS_EVENT.
   */
  public openDecisionWindowForCard(
    windowId: string,
    options: OpenDecisionWindowForCardOptions,
  ): void {
    const tier = this.lastResolvedTier;
    const decisionWindowMs = getDecisionWindowDurationMs(tier);
    const closesAtMs = this.lastNowMs + decisionWindowMs;

    // Map card type to timing class
    const timingClassByCardType: Readonly<Record<DecisionCardType, TimingClass>> = {
      [DecisionCardType.FORCED_FATE]:       'FATE',
      [DecisionCardType.HATER_INJECTION]:   'PSK',
      [DecisionCardType.CRISIS_EVENT]:      'FATE',
    };

    const resolvedTimingClass = options.timingClass
      ?? timingClassByCardType[options.cardType]
      ?? 'FATE';

    this.decisionTimer.open(windowId, closesAtMs, {
      timingClass:    resolvedTimingClass,
      label:          options.label ?? `${options.cardType}:${options.cardId}`,
      source:         options.source ?? `card:${options.cardType.toLowerCase()}`,
      mode:           options.mode ?? 'solo',
      openedAtTick:   options.openedAtTick ?? 0,
      openedAtMs:     options.openedAtMs ?? this.lastNowMs,
      closesAtTick:   options.closesAtTick ?? null,
      exclusive:      options.exclusive ?? false,
      actorId:        options.actorId ?? null,
      targetActorId:  options.targetActorId ?? null,
      cardInstanceId: options.cardInstanceId ?? options.cardId,
      metadata:       options.metadata,
    });

    this.windowsOpenedThisRun++;

    if (this.currentPhaseRecord) {
      this.currentPhaseRecord.windowsOpened++;
    }
  }

  /**
   * Resolve a decision window as accepted (player acted).
   */
  public resolveDecisionWindow(windowId: string): boolean {
    const resolved = this.decisionTimer.resolve(windowId);
    if (resolved) {
      this.windowsResolvedThisRun++;
    }
    return resolved;
  }

  /**
   * Nullify a decision window (cancelled externally).
   */
  public nullifyDecisionWindow(windowId: string): boolean {
    const nullified = this.decisionTimer.nullify(windowId);
    if (nullified) {
      this.windowsNullifiedThisRun++;
    }
    return nullified;
  }

  /**
   * Get a rich decision window view by ID.
   */
  public getWindowSummary(
    windowId: string,
    nowMs: number = this.lastNowMs,
  ): TimeDecisionWindowSummary | null {
    const windowState = this.decisionTimer.getWindow(windowId);
    if (windowState === null) return null;
    return buildWindowSummary(windowId, windowState.snapshot, nowMs);
  }

  /**
   * Get all active window summaries.
   */
  public getAllActiveWindowSummaries(
    nowMs: number = this.lastNowMs,
  ): readonly TimeDecisionWindowSummary[] {
    const active = this.decisionTimer.snapshot();
    return Object.freeze(
      Object.entries(active).map(([id, snap]) =>
        buildWindowSummary(id, snap, nowMs),
      ),
    );
  }

  /**
   * Compute the urgency of a specific active window.
   */
  public computeWindowUrgency(
    windowId: string,
    nowMs: number = this.lastNowMs,
  ): number {
    const windowState = this.decisionTimer.getWindow(windowId);
    if (windowState === null) return 0;
    return computeWindowUrgencyScore(windowState.snapshot, nowMs);
  }

  /**
   * Get a full DecisionWindow view for a window (uses types.ts DecisionWindow interface).
   */
  public getDecisionWindowView(
    windowId: string,
    nowMs: number = this.lastNowMs,
  ): DecisionWindow | null {
    const windowState = this.decisionTimer.getWindow(windowId);
    if (windowState === null) return null;
    return buildDecisionWindowView(windowId, windowState.snapshot, nowMs);
  }

  /**
   * Compute a countdown tick event payload for a window.
   */
  public computeWindowCountdown(
    windowId: string,
    nowMs: number = this.lastNowMs,
  ): DecisionWindowTickEvent | null {
    const windowState = this.decisionTimer.getWindow(windowId);
    if (windowState === null) return null;
    const remaining = getWindowRemainingMs(windowState.snapshot, nowMs);
    if (remaining === null) return null;
    return buildWindowTickEventPayload(windowId, remaining, nowMs);
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8c — Hold management
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Apply a hold to a decision window (extends deadline by holdDurationMs).
   * Uses both the DecisionTimer and HoldActionLedger for dual-source truth.
   */
  public applyHold(
    windowId: string,
    nowMs: number,
    holdDurationMs: number = DEFAULT_HOLD_DURATION_MS,
  ): boolean {
    if (!this.runtimeHoldEnabled || this.holdConsumedThisRun) return false;

    const availableHoldCharges = this.runtimeHoldCharges ?? 1;
    if (availableHoldCharges <= 0) return false;

    // Attempt via DecisionTimer (authoritative expiry extension)
    const applied = this.decisionTimer.freeze(
      windowId,
      Math.trunc(nowMs),
      holdDurationMs,
    );

    if (applied) {
      this.holdConsumedThisRun = true;
      this.runtimeHoldCharges = Math.max(0, availableHoldCharges - 1);
      this.holdsAppliedThisRun++;

      // Also spend via HoldLedger for audit trail
      const spendRequest: HoldSpendRequest = {
        windowId,
        nowMs: Math.trunc(nowMs),
        durationMs: holdDurationMs,
      };
      const spendResult: HoldSpendResult = this.holdLedger.spend(spendRequest);

      // Record hold event
      const holdPayload = buildHoldUsedPayload(
        windowId,
        holdDurationMs,
        Math.trunc(nowMs) + holdDurationMs,
        spendResult.remainingCharges,
      );
      this.recordEvent('HOLD_ACTION_USED', holdPayload, 0, nowMs);
    }

    return applied;
  }

  /**
   * Release a hold on a decision window.
   */
  public releaseHold(windowId: string): boolean {
    const released = this.decisionTimer.unfreeze(windowId);
    if (released) {
      this.holdLedger.release(windowId, this.lastNowMs);
    }
    return released;
  }

  /**
   * Spend a hold via the HoldActionLedger directly (for external callers).
   */
  public spendHoldViaLedger(request: HoldSpendRequest): HoldSpendResult {
    return this.holdLedger.spend(request);
  }

  /**
   * Get the current hold ledger snapshot.
   */
  public getHoldLedgerSnapshot(nowMs: number = this.lastNowMs): HoldLedgerSnapshot {
    return this.holdLedger.snapshot(nowMs);
  }

  /**
   * Get the active hold record (null if no active hold).
   */
  public getActiveHold(nowMs: number = this.lastNowMs): ActiveHoldRecord | null {
    return this.holdLedger.getActiveHold(nowMs);
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8d — Tier forcing and cadence overrides
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Forces a specific cadence tier for a fixed number of backend time steps.
   * This is a hard jump, not an interpolation.
   * Emits a TICK_TIER_FORCED event record.
   */
  public forceTickTier(tier: PressureTier, durationTicks: number): void {
    const normalizedDurationTicks = Math.max(0, Math.trunc(durationTicks));

    if (normalizedDurationTicks <= 0) {
      this.forcedTierOverride = null;
      return;
    }

    this.forcedTierOverride = {
      tier,
      ticksRemaining: normalizedDurationTicks,
    };

    this.lastResolvedTier = tier;
    this.interpolator.forceTier(tier);

    const tickTier = resolveTickTier(tier);
    const forcedPayload = buildTierForcedPayload(tickTier, durationTicks, this.lastNowMs);
    this.recordEvent('TICK_TIER_FORCED', forcedPayload, 0, this.lastNowMs);
  }

  /**
   * Get the interpolation plan between the last resolved tier and a target tier.
   * Uses createInterpolationPlan from types.ts.
   */
  public getInterpolationPlan(targetTier: PressureTier): TickInterpolationPlan {
    return buildInterpolationPlanForTiers(this.lastResolvedTier, targetTier);
  }

  /**
   * Get the current interpolation plan (in-progress transition, or null).
   */
  public getCurrentInterpolationPlan(): TickInterpolationPlan | null {
    const remaining = this.interpolator.getRemainingTransitionTicks();
    const target = this.interpolator.getTargetTier();
    const current = this.interpolator.getCurrentTier() ?? this.lastResolvedTier;

    if (!this.interpolator.isTransitioning() || target === null) return null;

    const fromTier = resolveTickTier(current);
    const toTier = resolveTickTier(target);

    return {
      fromTier,
      toTier,
      fromDurationMs: getDefaultTickDurationMs(current),
      toDurationMs:   getDefaultTickDurationMs(target),
      totalTicks:     computeInterpolationTickCount(
        Math.abs(
          getDefaultTickDurationMs(target) - getDefaultTickDurationMs(current),
        ),
      ),
      ticksRemaining: remaining,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8e — ML/DL Pipeline
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Extract the 28-dimensional ML feature vector for the current state.
   * Requires a RunStateSnapshot to compute all features accurately.
   */
  public extractMLVector(snapshot: RunStateSnapshot): TimeMLVector {
    const nowMs = this.lastNowMs;
    const tick = snapshot.tick;
    const tier = this.lastResolvedTier;
    const phase = snapshot.phase;

    return this.buildMLVectorFromState(
      snapshot,
      tick,
      nowMs,
      tier,
      phase,
      this.windowsExpiredThisRun,
      this.holdConsumedThisRun,
    );
  }

  /**
   * Get the most recent ML vector (null if no ticks recorded).
   */
  public getLastMLVector(): TimeMLVector | null {
    return this.mlHistory[this.mlHistory.length - 1] ?? null;
  }

  /**
   * Get all stored ML vectors (most recent first).
   */
  public getAllMLVectors(): readonly TimeMLVector[] {
    return Object.freeze([...this.mlHistory].reverse());
  }

  /**
   * Extract the 40×6 DL sequence tensor for the time lane.
   * Pads with zeros if fewer than 40 ticks have been recorded.
   */
  public extractDLTensor(snapshot: RunStateSnapshot): TimeDLTensor {
    const rowCount = TIME_DL_ROW_COUNT;
    const colCount = TIME_DL_COL_COUNT;
    const values = new Float64Array(rowCount * colCount);

    // Fill from history, most-recent at the end
    const historyRows = this.dlRows.slice(-rowCount);
    const offset = rowCount - historyRows.length;

    for (let i = 0; i < historyRows.length; i++) {
      const srcRow = historyRows[i];
      const destOffset = (offset + i) * colCount;
      for (let c = 0; c < colCount; c++) {
        values[destOffset + c] = srcRow[c] ?? 0;
      }
    }

    const tickHistory = this.tickHistory;
    const tickStart = tickHistory[0]?.tick ?? 0;
    const tickEnd = tickHistory[tickHistory.length - 1]?.tick ?? snapshot.tick;

    return {
      values:       Object.freeze(values),
      rowCount:     TIME_DL_ROW_COUNT,
      colCount:     TIME_DL_COL_COUNT,
      columnLabels: TIME_DL_COLUMN_LABELS,
      tickStart,
      tickEnd,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8f — Runtime Snapshot
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Get the authoritative runtime snapshot for the time engine.
   * Requires the last RunStateSnapshot to compute budget fields.
   */
  public getRuntimeSnapshot(snapshot?: RunStateSnapshot): TimeRuntimeSnapshot {
    const snap = snapshot ?? this.lastSnapshot;

    if (snap === null) {
      return this.buildEmptyRuntimeSnapshot();
    }

    const tier = this.lastResolvedTier;
    const tickTier = resolveTickTier(tier);
    const config = getTickTierConfigByPressureTier(tier);
    const totalBudgetMs = this.budgetService.getTotalBudgetMs(snap);
    const remainingBudgetMs = this.budgetService.getRemainingBudgetMs(snap);
    const utilizationPct = this.budgetService.getUtilizationPct(snap);
    const seasonLifecycle = this.seasonClock.getLifecycle(this.lastNowMs);

    return {
      engineId:                       'time',
      tick:                           snap.tick,
      phase:                          snap.phase,
      tier,
      tickTier,
      tickTierConfig:                 config,
      currentTickDurationMs:          snap.timers.currentTickDurationMs,
      elapsedMs:                      snap.timers.elapsedMs,
      seasonBudgetMs:                 snap.timers.seasonBudgetMs,
      extensionBudgetMs:              snap.timers.extensionBudgetMs,
      totalBudgetMs,
      remainingBudgetMs,
      budgetUtilizationPct:           utilizationPct,
      holdEnabled:                    snap.modeState.holdEnabled,
      holdChargesRemaining:           snap.timers.holdCharges,
      holdConsumedThisRun:            this.holdConsumedThisRun,
      activeDecisionWindowCount:      this.decisionTimer.activeCount(),
      frozenDecisionWindowCount:      snap.timers.frozenWindowIds.length,
      forcedTierActive:               this.forcedTierOverride !== null,
      forcedTier:                     this.forcedTierOverride?.tier ?? null,
      forcedTierTicksRemaining:       this.forcedTierOverride?.ticksRemaining ?? 0,
      interpolating:                  this.interpolator.isTransitioning(),
      interpolationRemainingTicks:    this.interpolator.getRemainingTransitionTicks(),
      phaseBoundaryWindowsRemaining:  snap.modeState.phaseBoundaryWindowsRemaining,
      lastTierChangeTick:             snap.timers.lastTierChangeTick,
      tierChangeCountThisRun:         this.tierChangeCountThisRun,
      windowsOpenedThisRun:           this.windowsOpenedThisRun,
      windowsExpiredThisRun:          this.windowsExpiredThisRun,
      windowsResolvedThisRun:         this.windowsResolvedThisRun,
      seasonPressureMultiplier:       this.lastSeasonMultiplier,
      seasonLifecycle,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8g — Session Analytics
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Compute full session analytics for the active run.
   */
  public computeSessionAnalytics(snapshot: RunStateSnapshot): TimeSessionAnalytics {
    const totalTicks = snapshot.tick;
    const totalElapsedMs = this.budgetService.getElapsedMs(snapshot);
    const remainingBudgetMs = this.budgetService.getRemainingBudgetMs(snapshot);
    const budgetUtilizationPct = this.budgetService.getUtilizationPct(snapshot);

    // Phase breakdown (ticks per phase)
    const phaseBreakdown: Record<RunPhase, number> = {
      FOUNDATION: 0, ESCALATION: 0, SOVEREIGNTY: 0,
    };
    for (const record of this.tickHistory) {
      phaseBreakdown[record.phase] = (phaseBreakdown[record.phase] ?? 0) + 1;
    }

    // Tier breakdown (ticks per tier)
    const tierBreakdown: Record<PressureTier, number> = {
      T0: 0, T1: 0, T2: 0, T3: 0, T4: 0,
    };
    for (const record of this.tickHistory) {
      tierBreakdown[record.tier] = (tierBreakdown[record.tier] ?? 0) + 1;
    }

    const totalWindowsOpened = this.windowsOpenedThisRun;
    const totalWindowsExpired = this.windowsExpiredThisRun;
    const totalWindowsResolved = this.windowsResolvedThisRun;

    const windowExpiryRate = totalWindowsOpened > 0
      ? totalWindowsExpired / totalWindowsOpened
      : 0;
    const windowResolutionRate = totalWindowsOpened > 0
      ? totalWindowsResolved / totalWindowsOpened
      : 0;

    const timeInCollapseImminentTicks = tierBreakdown['T4'];
    const timeInSovereignTicks = tierBreakdown['T0'];

    const avgTierDurationTicks = this.tierChangeCountThisRun > 0
      ? totalTicks / Math.max(1, this.tierChangeCountThisRun)
      : totalTicks;

    const seasonMultiplierHistory = this.tickHistory.map(r => r.seasonMultiplier);
    const seasonPressureMultiplierAvg = seasonMultiplierHistory.length > 0
      ? seasonMultiplierHistory.reduce((a, b) => a + b, 0) / seasonMultiplierHistory.length
      : 1.0;

    const windowDurations = this.tickHistory
      .filter(r => r.expiredWindowCount > 0)
      .map(r => r.durationMs);
    const longestWindowDurationMs = windowDurations.length > 0
      ? Math.max(...windowDurations)
      : 0;
    const shortestWindowDurationMs = windowDurations.length > 0
      ? Math.min(...windowDurations)
      : 0;

    const currentTierDurationMs = this.interpolator.getCurrentDurationMs();
    const projectedTicksRemaining = computeProjectedTicksRemaining(
      remainingBudgetMs,
      Math.max(1, currentTierDurationMs),
    );

    const totalTimeoutRisk = clamp01(
      budgetUtilizationPct > 0.90
        ? 1.0
        : budgetUtilizationPct > 0.75
          ? 0.7
          : budgetUtilizationPct > 0.60
            ? 0.4
            : 0.1,
    );

    return {
      totalTicks,
      totalElapsedMs,
      budgetUtilizationPct,
      remainingBudgetMs,
      phaseBreakdown:                Object.freeze(phaseBreakdown),
      tierBreakdown:                 Object.freeze(tierBreakdown),
      totalWindowsOpened,
      totalWindowsExpired,
      totalWindowsResolved,
      windowExpiryRate,
      windowResolutionRate,
      holdUsed:                      this.holdConsumedThisRun,
      holdChargesRemaining:          snapshot.timers.holdCharges,
      totalTierChanges:              this.tierChangeCountThisRun,
      avgTierDurationTicks,
      timeInCollapseImminentTicks,
      timeInSovereignTicks,
      totalTimeoutRisk,
      seasonLifecycle:               this.seasonClock.getLifecycle(this.lastNowMs),
      seasonPressureMultiplierAvg,
      longestWindowDurationMs,
      shortestWindowDurationMs,
      currentPhase:                  snapshot.phase,
      currentTier:                   this.lastResolvedTier,
      projectedTicksRemaining,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8h — Trend Analysis
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Compute trend snapshot over the last N ticks.
   */
  public computeTrendSnapshot(windowSize: number = 10): TimeTrendSnapshot {
    const window = this.tickHistory.slice(-Math.max(1, windowSize));

    if (window.length === 0) {
      return this.buildEmptyTrendSnapshot(windowSize);
    }

    const durations = window.map(r => r.durationMs);
    const avgTickDurationMs = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minTickDurationMs = Math.min(...durations);
    const maxTickDurationMs = Math.max(...durations);

    const tierFrequency: Record<PressureTier, number> = { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 };
    const phaseFrequency: Record<RunPhase, number> = { FOUNDATION: 0, ESCALATION: 0, SOVEREIGNTY: 0 };

    for (const record of window) {
      tierFrequency[record.tier]++;
      phaseFrequency[record.phase]++;
    }

    let budgetDeltaSum = 0;
    for (let i = 1; i < window.length; i++) {
      budgetDeltaSum += window[i].budgetUtilizationPct - window[i - 1].budgetUtilizationPct;
    }
    const avgBudgetUtilizationDelta = window.length > 1
      ? budgetDeltaSum / (window.length - 1)
      : 0;

    const totalExpiredWindowsInWindow = window.reduce((s, r) => s + r.expiredWindowCount, 0);
    const totalHoldsAppliedInWindow = window.filter(r => r.holdConsumed).length;
    const tierEscalationCount = window.filter(r => r.tierChanged && this.wasTierEscalation(r)).length;
    const tierDeEscalationCount = window.filter(r => r.tierChanged && !this.wasTierEscalation(r)).length;
    const phaseTransitionCount = window.filter(r => r.phaseChanged).length;

    const lastRecord = window[window.length - 1];
    const secondLastRecord = window.length >= 2 ? window[window.length - 2] : null;

    const isAcceleratingThisTick = secondLastRecord !== null
      && lastRecord.durationMs < secondLastRecord.durationMs;
    const isDeceleratingThisTick = secondLastRecord !== null
      && lastRecord.durationMs > secondLastRecord.durationMs;

    const dominantTierEntry = (Object.entries(tierFrequency) as [PressureTier, number][])
      .reduce<[PressureTier, number]>(
        (best, curr) => curr[1] > best[1] ? curr : best,
        ['T1', 0],
      );
    const dominantTier = dominantTierEntry[0];

    const dominantPhaseEntry = (Object.entries(phaseFrequency) as [RunPhase, number][])
      .reduce<[RunPhase, number]>(
        (best, curr) => curr[1] > best[1] ? curr : best,
        ['FOUNDATION', 0],
      );
    const dominantPhase = dominantPhaseEntry[0];

    return {
      windowSize,
      avgTickDurationMs,
      minTickDurationMs,
      maxTickDurationMs,
      tierFrequency:                 Object.freeze(tierFrequency),
      phaseFrequency:                Object.freeze(phaseFrequency),
      avgBudgetUtilizationDelta,
      totalExpiredWindowsInWindow,
      totalHoldsAppliedInWindow,
      tierEscalationCount,
      tierDeEscalationCount,
      phaseTransitionCount,
      isAcceleratingThisTick,
      isDeceleratingThisTick,
      dominantTier,
      dominantPhase,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8i — Phase Analytics
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Compute per-phase timing and window breakdown.
   */
  public computePhaseAnalytics(snapshot: RunStateSnapshot): TimePhaseAnalytics {
    const currentPhase = snapshot.phase;
    const elapsedMs = snapshot.timers.elapsedMs;

    // Find phase start elapsed ms from PHASE_BOUNDARIES_MS
    let phaseStartElapsedMs = 0;
    for (const boundary of PHASE_BOUNDARIES_MS) {
      if (boundary.phase === currentPhase) {
        phaseStartElapsedMs = boundary.startsAtMs;
        break;
      }
    }

    const phaseElapsedMs = Math.max(0, elapsedMs - phaseStartElapsedMs);
    const phaseDurationEstimateMs = PHASE_DURATION_ESTIMATES_MS[currentPhase] ?? 240_000;
    const phaseProgressPct = clamp01(phaseElapsedMs / Math.max(1, phaseDurationEstimateMs));

    // Ticks in current phase from tick history
    const phaseRecords = this.tickHistory.filter(r => r.phase === currentPhase);
    const ticksInPhase = phaseRecords.length;

    // Average tier in phase (as numeric index)
    const avgTierInPhase = ticksInPhase > 0
      ? phaseRecords.reduce((s, r) => s + tierToNormalized(r.tier) * 4, 0) / ticksInPhase
      : 0;

    // Window stats for current phase
    const windowsOpenedInPhase = this.currentPhaseRecord?.windowsOpened ?? 0;
    const windowsExpiredInPhase = this.currentPhaseRecord?.windowsExpired ?? 0;
    const phaseBoundaryWindowsRemaining = snapshot.modeState.phaseBoundaryWindowsRemaining;
    const phaseTransitionImminent = phaseBoundaryWindowsRemaining <= 2;

    // Next phase determination
    const phaseOrder: readonly RunPhase[] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const nextPhase = currentIndex >= 0 && currentIndex < phaseOrder.length - 1
      ? phaseOrder[currentIndex + 1]
      : null;

    return {
      currentPhase,
      phaseStartElapsedMs,
      phaseElapsedMs,
      phaseDurationEstimateMs,
      phaseProgressPct,
      ticksInPhase,
      avgTierInPhase,
      windowsOpenedInPhase,
      windowsExpiredInPhase,
      phaseBoundaryWindowsRemaining,
      phaseTransitionImminent,
      nextPhase,
      boundaries: PHASE_BOUNDARIES_MS,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8j — Budget Analytics
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Compute budget consumption analysis.
   */
  public computeBudgetAnalytics(snapshot: RunStateSnapshot): TimeBudgetAnalytics {
    const seasonBudgetMs = this.budgetService.getSeasonBudgetMs(snapshot);
    const extensionBudgetMs = this.budgetService.getExtensionBudgetMs(snapshot);
    const totalBudgetMs = this.budgetService.getTotalBudgetMs(snapshot);
    const elapsedMs = this.budgetService.getElapsedMs(snapshot);
    const remainingBudgetMs = this.budgetService.getRemainingBudgetMs(snapshot);
    const utilizationPct = this.budgetService.getUtilizationPct(snapshot);

    const avgTickDurationMs = this.tickHistory.length > 0
      ? this.tickHistory.reduce((s, r) => s + r.durationMs, 0) / this.tickHistory.length
      : this.interpolator.getCurrentDurationMs();

    const ticksAtCurrentTierUntilExhaustion = computeProjectedTicksRemaining(
      remainingBudgetMs,
      Math.max(1, clampTickDurationMs(this.lastResolvedTier, this.interpolator.getCurrentDurationMs())),
    );

    const projectedExhaustionTick = snapshot.tick + ticksAtCurrentTierUntilExhaustion;
    const projectedExhaustionMs = elapsedMs + remainingBudgetMs;

    const isNearingBudgetEnd = utilizationPct >= (1 - BUDGET_URGENCY_THRESHOLD);

    let budgetAlertLevel: TimeBudgetAnalytics['budgetAlertLevel'] = 'OK';
    const remaining01 = 1 - utilizationPct;
    if (remaining01 < BUDGET_CRITICAL_THRESHOLD)      budgetAlertLevel = 'CRITICAL';
    else if (remaining01 < BUDGET_WARNING_THRESHOLD)  budgetAlertLevel = 'WARNING';
    else if (remaining01 < BUDGET_CAUTION_THRESHOLD)  budgetAlertLevel = 'CAUTION';

    const hasExtension = extensionBudgetMs > 0;
    const extensionPct = totalBudgetMs > 0
      ? clamp01(extensionBudgetMs / totalBudgetMs)
      : 0;

    // Optional budget projection for next tick
    let budgetProjection: TimeBudgetProjection | null = null;
    try {
      const advanceRequest: TimeAdvanceRequest = {
        durationMs: this.interpolator.getCurrentDurationMs(),
        nowMs:      this.lastNowMs,
      };
      budgetProjection = this.budgetService.projectAdvance(snapshot, advanceRequest);
    } catch {
      budgetProjection = null;
    }

    return {
      seasonBudgetMs,
      extensionBudgetMs,
      totalBudgetMs,
      elapsedMs,
      remainingBudgetMs,
      utilizationPct,
      projectedExhaustionTick,
      projectedExhaustionMs,
      avgTickDurationMs,
      isNearingBudgetEnd,
      budgetAlertLevel,
      hasExtension,
      extensionPct,
      ticksAtCurrentTierUntilExhaustion,
      budgetProjection,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8k — Decision Window Analytics
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Compute decision window health metrics.
   */
  public computeDecisionWindowAnalytics(
    snapshot: RunStateSnapshot,
  ): TimeDecisionWindowAnalytics {
    const nowMs = this.lastNowMs;
    const activeSnapshots = snapshot.timers.activeDecisionWindows;
    const activeWindowCount = Object.keys(activeSnapshots).length;
    const frozenWindowCount = snapshot.timers.frozenWindowIds.length;

    const windowSummaries = Object.entries(activeSnapshots).map(([id, snap]) =>
      buildWindowSummary(id, snap, nowMs),
    );

    const openedThisRun = this.windowsOpenedThisRun;
    const expiredThisRun = this.windowsExpiredThisRun;
    const resolvedThisRun = this.windowsResolvedThisRun;
    const nullifiedThisRun = this.windowsNullifiedThisRun;

    const expiryRate = openedThisRun > 0 ? expiredThisRun / openedThisRun : 0;
    const resolutionRate = openedThisRun > 0 ? resolvedThisRun / openedThisRun : 0;
    const holdRate = openedThisRun > 0 ? this.holdsAppliedThisRun / openedThisRun : 0;

    // Average window duration (opened to closes) from snapshot
    const durations = Object.values(activeSnapshots)
      .map(snap => getWindowDurationMs(snap, nowMs))
      .filter(d => d > 0);
    const avgWindowDurationMs = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    const longestOpenWindowMs = durations.length > 0 ? Math.max(...durations) : 0;

    const urgentWindowCount = windowSummaries.filter(
      s => s.remainingMs !== null && s.remainingMs < WINDOW_URGENT_REMAINING_MS,
    ).length;

    return {
      activeWindowCount,
      frozenWindowCount,
      openedThisRun,
      expiredThisRun,
      resolvedThisRun,
      nullifiedThisRun,
      expiryRate,
      resolutionRate,
      avgWindowDurationMs,
      longestOpenWindowMs,
      urgentWindowCount,
      windowSummaries: Object.freeze(windowSummaries),
      holdRate,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8l — Hold Analytics
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Compute hold usage analytics.
   */
  public computeHoldAnalytics(
    snapshot: RunStateSnapshot,
  ): TimeHoldAnalytics {
    const nowMs = this.lastNowMs;
    const ledgerSnapshot = this.holdLedger.snapshot(nowMs);
    const activeHold = this.holdLedger.getActiveHold(nowMs);
    const chargesConsumedThisRun = this.holdsAppliedThisRun;

    return {
      enabled:                ledgerSnapshot.enabled,
      chargesRemaining:       ledgerSnapshot.remainingCharges,
      chargesConsumedThisRun,
      holdConsumedThisRun:    this.holdConsumedThisRun,
      activeHold,
      frozenWindowIds:        snapshot.timers.frozenWindowIds,
      holdLedgerSnapshot:     ledgerSnapshot,
      defaultHoldDurationMs:  DEFAULT_HOLD_DURATION_MS,
      holdDurationMs:         DEFAULT_HOLD_DURATION_MS,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8m — Cadence Resolution + Interpolation Plan
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Compute full cadence resolution for the current state.
   * Applies season multiplier and mode tempo multiplier.
   * Returns a TimeCadenceResolutionSnapshot (mirrors TimeCadenceResolution from contracts.ts).
   */
  public resolveCadence(
    snapshot: RunStateSnapshot,
    options?: {
      readonly forcedTier?: PressureTier | null;
      readonly nowMs?: number;
    },
  ): TimeCadenceResolutionSnapshot {
    const nowMs = options?.nowMs ?? this.lastNowMs;
    const baseTier = options?.forcedTier ?? this.resolveCadenceTierFromSnapshot(snapshot);
    const resolvedTier = baseTier;

    const config = getTickTierConfigByPressureTier(resolvedTier);
    const durationMs = getDefaultTickDurationMs(resolvedTier);
    const decisionWindowMs = getDecisionWindowDurationMs(resolvedTier);

    const seasonMultiplier = this.seasonClock.getPressureMultiplier(nowMs);
    const modeTempoMultiplier = getModeTempoMultiplier(snapshot.mode);
    const remainingBudgetMs = this.budgetService.getRemainingBudgetMs(snapshot);
    const totalBudgetMs = this.budgetService.getTotalBudgetMs(snapshot);
    const budgetTempoMultiplier = getBudgetTempoMultiplier(remainingBudgetMs, totalBudgetMs);

    const shouldScreenShake = config.screenShake;
    const shouldOpenEndgameWindow = remainingBudgetMs < durationMs * 3;
    const shouldInterpolate = this.interpolator.isTransitioning();

    const reasonCodes: string[] = [];
    if (this.forcedTierOverride !== null) reasonCodes.push('FORCED_OVERRIDE');
    if (seasonMultiplier > 1.0) reasonCodes.push('SEASON_PRESSURE');
    if (budgetTempoMultiplier > 1.0) reasonCodes.push('BUDGET_URGENCY');
    if (modeTempoMultiplier !== 1.0) reasonCodes.push('MODE_TEMPO');
    if (shouldInterpolate) reasonCodes.push('INTERPOLATING');

    // Use the contracts.ts TimeCadenceResolution interface shape through our snapshot
    const cadenceResolution: TimeCadenceResolution = {
      baseTier,
      resolvedTier,
      durationMs,
      decisionWindowMs,
      minDurationMs:          config.minDurationMs,
      maxDurationMs:          config.maxDurationMs,
      seasonMultiplier,
      modeTempoMultiplier,
      budgetTempoMultiplier,
      remainingBudgetMs,
      shouldScreenShake,
      shouldOpenEndgameWindow,
      shouldInterpolate,
      reasonCodes:            Object.freeze(reasonCodes),
    };

    // Mirror into our snapshot type
    return {
      baseTier:               cadenceResolution.baseTier,
      resolvedTier:           cadenceResolution.resolvedTier,
      durationMs:             cadenceResolution.durationMs,
      decisionWindowMs:       cadenceResolution.decisionWindowMs,
      minDurationMs:          cadenceResolution.minDurationMs,
      maxDurationMs:          cadenceResolution.maxDurationMs,
      seasonMultiplier:       cadenceResolution.seasonMultiplier,
      modeTempoMultiplier:    cadenceResolution.modeTempoMultiplier,
      budgetTempoMultiplier:  cadenceResolution.budgetTempoMultiplier,
      remainingBudgetMs:      cadenceResolution.remainingBudgetMs,
      shouldScreenShake:      cadenceResolution.shouldScreenShake,
      shouldOpenEndgameWindow: cadenceResolution.shouldOpenEndgameWindow,
      shouldInterpolate:      cadenceResolution.shouldInterpolate,
      reasonCodes:            cadenceResolution.reasonCodes,
    };
  }

  /**
   * Get the current cadence snapshot (tier, config, duration, DL features).
   */
  public getCadenceSnapshot(
    snapshot: RunStateSnapshot,
  ): TimeCadenceSnapshot {
    const tier = this.lastResolvedTier;
    const tickTier = resolveTickTier(tier);
    const config = getTickTierConfig(tickTier);
    const currentDurationMs = this.interpolator.getCurrentDurationMs();
    const defaultDurationMs = getDefaultTickDurationMs(tier);
    const decisionWindowMs = getDecisionWindowDurationMs(tier);
    const interpolationPlan = this.getCurrentInterpolationPlan();
    const seasonMultiplier = this.seasonClock.getPressureMultiplier(this.lastNowMs);
    const effectiveDurationMs = clampTickDurationMs(tier, currentDurationMs);

    return {
      tier,
      tickTier,
      config,
      currentDurationMs,
      defaultDurationMs,
      minDurationMs:         config.minDurationMs,
      maxDurationMs:         config.maxDurationMs,
      decisionWindowMs,
      isInterpolating:       this.interpolator.isTransitioning(),
      interpolationRemainingTicks: this.interpolator.getRemainingTransitionTicks(),
      interpolationPlan,
      seasonPressureMultiplier: seasonMultiplier,
      effectiveDurationMs,
      visualBorderClass:     config.visualBorderClass,
      audioSignal:           config.audioSignal,
      screenShake:           config.screenShake,
    };
  }

  /**
   * Project what the next tick would look like.
   * Uses TimeBudgetService and contracts.ts's TimeProjectionResult shape.
   */
  public projectNextTick(
    snapshot: RunStateSnapshot,
  ): TimeProjectionResult {
    const tier = this.resolveCadenceTierFromSnapshot(snapshot);
    const durationMs = this.interpolator.getCurrentDurationMs();
    const nextElapsedMs = snapshot.timers.elapsedMs + durationMs;
    const phase = resolvePhaseFromElapsedMs(nextElapsedMs);
    const totalBudgetMs = this.budgetService.getTotalBudgetMs(snapshot);
    const timeoutReached = nextElapsedMs >= totalBudgetMs;
    const nextOutcome: RunOutcome | null = timeoutReached ? 'TIMEOUT' : null;

    const nextTimers: TimerState = {
      ...snapshot.timers,
      elapsedMs:              nextElapsedMs,
      currentTickDurationMs:  durationMs,
      nextTickAtMs:           timeoutReached ? null : snapshot.timers.elapsedMs + durationMs,
    };

    const nextTelemetry: TelemetryState = {
      ...snapshot.telemetry,
      outcomeReason: timeoutReached
        ? 'Season budget exhausted.'
        : snapshot.telemetry.outcomeReason,
      outcomeReasonCode: timeoutReached
        ? 'SEASON_BUDGET_EXHAUSTED'
        : snapshot.telemetry.outcomeReasonCode,
    };

    // Construct the contracts.ts TimeProjectionResult
    const result: TimeProjectionResult = {
      tick:               snapshot.tick + 1,
      phase,
      timers:             nextTimers,
      telemetry:          nextTelemetry,
      tags:               snapshot.tags,
      outcome:            nextOutcome,
      outcomeReason:      nextOutcome === 'TIMEOUT'
        ? 'Season budget exhausted.'
        : null,
      outcomeReasonCode:  nextOutcome === 'TIMEOUT'
        ? 'SEASON_BUDGET_EXHAUSTED'
        : null,
    };

    return result;
  }

  /**
   * Build the runtime context shape from contracts.ts (TimeRuntimeContext).
   * This is used to verify the time engine's context compatibility.
   */
  public buildRuntimeContext(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): TimeRuntimeContext {
    return {
      clock: context.clock,
      bus:   context.bus,
      snapshot,
      nowMs: Math.trunc(context.nowMs),
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8n — Narrative Generation
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Generate UX narrative for the current time state.
   * Drives companion commentary, urgency UI, and chat channel routing.
   */
  public generateNarrative(snapshot: RunStateSnapshot): TimeNarrative {
    const tier = this.lastResolvedTier;
    const phase = snapshot.phase;
    const remainingBudgetMs = this.budgetService.getRemainingBudgetMs(snapshot);
    const budgetUtilizationPct = this.budgetService.getUtilizationPct(snapshot);
    const urgencyLevel = computeNarrativeUrgencyLevel(tier, budgetUtilizationPct);
    const cadenceLabel = computeCadenceLabel(tier);
    const activeWindowCount = this.decisionTimer.activeCount();

    // Headline
    const headlines: Readonly<Record<TimeNarrative['urgencyLevel'], string>> = {
      CALM:       'Your financial timeline is under control.',
      HEIGHTENED: 'Pressure is building — stay sharp.',
      URGENT:     'Critical window: every second counts.',
      CRITICAL:   'COLLAPSE IMMINENT — act now or lose everything.',
    };

    // Subtext
    const subtexts: Readonly<Record<TimeNarrative['urgencyLevel'], string>> = {
      CALM:       `You're in ${phase} phase at ${cadenceLabel}. Budget is healthy.`,
      HEIGHTENED: `You're in ${phase} phase. Budget at ${(budgetUtilizationPct * 100).toFixed(0)}%. Compressed cadence active.`,
      URGENT:     `${phase} phase. Only ${formatMs(remainingBudgetMs)} budget left. Decisions auto-resolve in ${getDecisionWindowDurationMs(tier) / 1_000}s.`,
      CRITICAL:   `System failure threshold reached. ${formatMs(remainingBudgetMs)} remains. Tier: ${tier}. Hold ${this.holdConsumedThisRun ? 'exhausted' : 'available'}.`,
    };

    const budgetRemainingLabel = formatMs(remainingBudgetMs);
    const holdAvailableLabel = !this.holdConsumedThisRun && this.runtimeHoldEnabled
      ? `Hold available (${DEFAULT_HOLD_DURATION_MS / 1_000}s freeze)`
      : 'Hold consumed';
    const activeWindowsLabel = activeWindowCount > 0
      ? `${activeWindowCount} decision window${activeWindowCount > 1 ? 's' : ''} open`
      : 'No active decision windows';

    const phaseElapsedMs = (() => {
      let start = 0;
      for (const b of PHASE_BOUNDARIES_MS) {
        if (b.phase === phase) { start = b.startsAtMs; break; }
      }
      return Math.max(0, snapshot.timers.elapsedMs - start);
    })();
    const phaseDurationMs = PHASE_DURATION_ESTIMATES_MS[phase] ?? 240_000;
    const phaseProgressPct = clamp01(phaseElapsedMs / Math.max(1, phaseDurationMs));
    const phaseProgressLabel = `${phase}: ${(phaseProgressPct * 100).toFixed(0)}% complete`;

    const timeoutWarning = budgetUtilizationPct >= 0.85
      ? `⚠ Season ends in ${formatMs(remainingBudgetMs)}`
      : null;

    const seasonLifecycle = this.seasonClock.getLifecycle(this.lastNowMs);
    const seasonActive = seasonLifecycle === 'ACTIVE';
    const seasonMultiplier = this.seasonClock.getPressureMultiplier(this.lastNowMs);
    const seasonLabel = seasonActive && seasonMultiplier > 1.0
      ? `Season boost: ${((seasonMultiplier - 1) * 100).toFixed(0)}% pressure multiplier`
      : null;

    const uxTags: string[] = ['time', `tier:${tier}`, `phase:${phase}`];
    if (urgencyLevel === 'CRITICAL') uxTags.push('interrupt');
    if (urgencyLevel === 'URGENT') uxTags.push('priority:high');
    if (activeWindowCount > 0) uxTags.push('decision:active');
    if (seasonActive) uxTags.push('season:active');

    const companionPriority =
      urgencyLevel === 'CRITICAL' ? 100 :
      urgencyLevel === 'URGENT'   ? 75 :
      urgencyLevel === 'HEIGHTENED' ? 50 :
      25;

    return {
      headline:              headlines[urgencyLevel],
      subtext:               subtexts[urgencyLevel],
      urgencyLevel,
      tier,
      phase,
      cadenceLabel,
      budgetRemainingLabel,
      holdAvailableLabel,
      activeWindowsLabel,
      phaseProgressLabel,
      timeoutWarning,
      seasonLabel,
      uxTags:                Object.freeze(uxTags),
      companionPriority,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8o — Resilience Scoring
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Compute composite resilience score for the time lane.
   * Aggregates budget health, decision window health, hold readiness,
   * cadence stability, and phase progress into one 0–1 score.
   */
  public computeResilienceScore(snapshot: RunStateSnapshot): TimeResilienceScore {
    const budgetHealth = clamp01(1 - this.budgetService.getUtilizationPct(snapshot));
    const activeWindows = this.decisionTimer.activeCount();
    const decisionWindowHealth = clamp01(1 - activeWindows / MAX_EXPECTED_ACTIVE_WINDOWS);
    const holdReadiness = !this.holdConsumedThisRun && snapshot.modeState.holdEnabled ? 1.0 : 0.0;
    const tier = this.lastResolvedTier;
    // Cadence stability: T1 = best, T4 = worst
    const cadenceStability = clamp01(1 - tierToNormalized(tier));
    const phase = snapshot.phase;
    const phaseProgress = phaseToNormalized(phase);

    const composite = clamp01(
      budgetHealth    * SCORE_WEIGHTS.budget   +
      decisionWindowHealth * SCORE_WEIGHTS.decision +
      holdReadiness   * SCORE_WEIGHTS.hold     +
      cadenceStability * SCORE_WEIGHTS.cadence  +
      phaseProgress   * SCORE_WEIGHTS.phase,
    );

    return {
      overall:             composite,
      budgetHealth,
      decisionWindowHealth,
      holdReadiness,
      cadenceStability,
      phaseProgress,
      label:               computeResilienceLabel(composite),
      breakdown: {
        budgetWeight:   SCORE_WEIGHTS.budget,
        windowWeight:   SCORE_WEIGHTS.decision,
        holdWeight:     SCORE_WEIGHTS.hold,
        cadenceWeight:  SCORE_WEIGHTS.cadence,
        phaseWeight:    SCORE_WEIGHTS.phase,
      },
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8p — Recovery Forecasting
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Compute a recovery forecast: how many ticks and what probability to reach T1.
   */
  public computeRecoveryForecast(snapshot: RunStateSnapshot): TimeRecoveryForecast {
    const currentTier = this.lastResolvedTier;
    const targetTier: PressureTier = 'T1';
    const remainingBudgetMs = this.budgetService.getRemainingBudgetMs(snapshot);

    const tierOrder: Readonly<Record<PressureTier, number>> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };
    const tierDistance = Math.max(0, tierOrder[currentTier] - tierOrder[targetTier]);

    // Each tier step back takes ~3 ticks to interpolate
    const ticksToRecovery = tierDistance === 0 ? 0 : tierDistance * 3;
    const msToRecovery = ticksToRecovery * getDefaultTickDurationMs(targetTier);

    const budgetSufficient = remainingBudgetMs >= msToRecovery;
    const recoveryProbability = budgetSufficient
      ? clamp01(1.0 - tierDistance * 0.20)
      : clamp01(remainingBudgetMs / Math.max(1, msToRecovery));

    const blockers: string[] = [];
    const recommendations: string[] = [];

    if (tierDistance === 0) {
      recommendations.push('Already at or above T1. Maintain cashflow momentum.');
    } else {
      if (currentTier === 'T4') {
        blockers.push('Collapse Imminent tier requires immediate cashflow reversal.');
        recommendations.push('Prioritize emergency income card immediately.');
        recommendations.push('Use hold if available to buy time for decision.');
      }
      if (currentTier === 'T3') {
        blockers.push('Crisis tier: cashflow negative or hater heat > 60.');
        recommendations.push('Block incoming attacks with shield cards.');
        recommendations.push('Reduce hater heat before next window opens.');
      }
      if (!budgetSufficient) {
        blockers.push('Insufficient budget remaining for full recovery arc.');
        recommendations.push('Focus on sovereignty cards for immediate yield.');
      }
      if (this.holdConsumedThisRun) {
        blockers.push('Hold action already consumed this run.');
      } else {
        recommendations.push('Hold is available — use it on the highest-urgency decision window.');
      }
    }

    return {
      currentTier,
      targetTier,
      ticksToRecovery,
      msToRecovery,
      recoveryProbability,
      blockers:         Object.freeze(blockers),
      recommendations:  Object.freeze(recommendations),
      budgetSufficient,
      forecastLabel:    computeForecastLabel(recoveryProbability),
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8q — Score Decomposition
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Decompose the time lane performance into five scored components.
   */
  public computeScoreDecomposition(snapshot: RunStateSnapshot): TimeScoreDecomposition {
    const budgetUtilization = this.budgetService.getUtilizationPct(snapshot);
    const budgetUtilizationScore = clamp01(1 - budgetUtilization);

    const totalOpened = Math.max(1, this.windowsOpenedThisRun);
    const decisionPerformanceScore = clamp01(
      1 - this.windowsExpiredThisRun / totalOpened,
    );

    const holdEfficiencyScore = this.holdConsumedThisRun
      ? (this.windowsExpiredThisRun === 0 ? 1.0 : 0.5)
      : (snapshot.modeState.holdEnabled ? 0.8 : 0.5);

    const tier = this.lastResolvedTier;
    const cadenceScore = clamp01(1 - tierToNormalized(tier));

    const phase = snapshot.phase;
    const phaseProgressScore = phaseToNormalized(phase);

    const composite = clamp01(
      budgetUtilizationScore  * SCORE_WEIGHTS.budget   +
      decisionPerformanceScore * SCORE_WEIGHTS.decision +
      holdEfficiencyScore     * SCORE_WEIGHTS.hold     +
      cadenceScore            * SCORE_WEIGHTS.cadence  +
      phaseProgressScore      * SCORE_WEIGHTS.phase,
    );

    return {
      budgetUtilizationScore,
      decisionPerformanceScore,
      holdEfficiencyScore,
      cadenceScore,
      phaseProgressScore,
      composite,
      weights: {
        budget:   SCORE_WEIGHTS.budget,
        decision: SCORE_WEIGHTS.decision,
        hold:     SCORE_WEIGHTS.hold,
        cadence:  SCORE_WEIGHTS.cadence,
        phase:    SCORE_WEIGHTS.phase,
      },
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8r — Export Bundle
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Build a full export bundle containing all time engine analytics.
   */
  public buildExportBundle(snapshot: RunStateSnapshot): TimeExportBundle {
    const exportedAtMs = Date.now();

    return {
      engineId:           'time',
      exportedAtMs,
      runtimeSnapshot:    this.getRuntimeSnapshot(snapshot),
      mlVector:           this.extractMLVector(snapshot),
      dlTensor:           this.extractDLTensor(snapshot),
      sessionAnalytics:   this.computeSessionAnalytics(snapshot),
      trendSnapshot:      this.computeTrendSnapshot(),
      phaseAnalytics:     this.computePhaseAnalytics(snapshot),
      budgetAnalytics:    this.computeBudgetAnalytics(snapshot),
      windowAnalytics:    this.computeDecisionWindowAnalytics(snapshot),
      holdAnalytics:      this.computeHoldAnalytics(snapshot),
      cadenceSnapshot:    this.getCadenceSnapshot(snapshot),
      narrative:          this.generateNarrative(snapshot),
      resilienceScore:    this.computeResilienceScore(snapshot),
      recoveryForecast:   this.computeRecoveryForecast(snapshot),
      scoreDecomposition: this.computeScoreDecomposition(snapshot),
      seasonSnapshot:     this.seasonClock.snapshot(this.lastNowMs),
      validation:         this.validate(snapshot),
      tickHistory:        Object.freeze([...this.tickHistory]),
      mlHistory:          Object.freeze([...this.mlHistory]),
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8s — Validation
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Validate time engine state against invariants.
   */
  public validate(snapshot: RunStateSnapshot): TimeValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const checks: Record<string, boolean> = {};

    // Check 1: elapsed ms is non-negative
    checks['elapsed_non_negative'] = snapshot.timers.elapsedMs >= 0;
    if (!checks['elapsed_non_negative']) {
      errors.push('Elapsed ms is negative — invalid state.');
    }

    // Check 2: elapsed <= total budget (or outcome set to TIMEOUT)
    const totalBudgetMs = this.budgetService.getTotalBudgetMs(snapshot);
    checks['elapsed_within_budget'] = snapshot.timers.elapsedMs <= totalBudgetMs
      || snapshot.outcome === 'TIMEOUT';
    if (!checks['elapsed_within_budget']) {
      errors.push(`Elapsed ${snapshot.timers.elapsedMs}ms exceeds budget ${totalBudgetMs}ms without TIMEOUT outcome.`);
    }

    // Check 3: hold charges non-negative
    checks['hold_charges_non_negative'] = snapshot.timers.holdCharges >= 0;
    if (!checks['hold_charges_non_negative']) {
      errors.push('Hold charges is negative.');
    }

    // Check 4: current tick duration is positive
    checks['tick_duration_positive'] = snapshot.timers.currentTickDurationMs > 0;
    if (!checks['tick_duration_positive']) {
      warnings.push('Current tick duration is zero — may indicate uninitialized state.');
    }

    // Check 5: active decision windows are valid
    const activeWindows = Object.entries(snapshot.timers.activeDecisionWindows);
    let windowsValid = true;
    for (const [windowId, windowSnap] of activeWindows) {
      if (windowSnap.closesAtMs !== null && windowSnap.closesAtMs < 0) {
        errors.push(`Decision window ${windowId} has negative closesAtMs.`);
        windowsValid = false;
      }
    }
    checks['decision_windows_valid'] = windowsValid;

    // Check 6: forced tier ticks remaining is non-negative
    checks['forced_tier_ticks_non_negative'] =
      this.forcedTierOverride === null || this.forcedTierOverride.ticksRemaining >= 0;
    if (!checks['forced_tier_ticks_non_negative']) {
      errors.push('Forced tier ticks remaining is negative.');
    }

    // Check 7: ML feature count correct
    const lastML = this.getLastMLVector();
    checks['ml_feature_count_correct'] =
      lastML === null || lastML.features.length === TIME_ML_FEATURE_LABELS.length;
    if (!checks['ml_feature_count_correct']) {
      errors.push(`ML vector has ${lastML?.features.length ?? 0} features; expected ${TIME_ML_FEATURE_LABELS.length}.`);
    }

    // Check 8: DL tensor dimensions
    const dlTensor = this.extractDLTensor(snapshot);
    checks['dl_tensor_dimensions'] =
      dlTensor.values.length === TIME_DL_ROW_COUNT * TIME_DL_COL_COUNT;
    if (!checks['dl_tensor_dimensions']) {
      errors.push(`DL tensor has ${dlTensor.values.length} values; expected ${TIME_DL_ROW_COUNT * TIME_DL_COL_COUNT}.`);
    }

    // Check 9: Season clock state (if manifest loaded)
    checks['season_clock_healthy'] = true;
    if (this.seasonClock.hasManifest()) {
      const lifecycle = this.seasonClock.getLifecycle(this.lastNowMs);
      if (lifecycle === 'UNCONFIGURED') {
        warnings.push('Season manifest loaded but lifecycle reports UNCONFIGURED.');
        checks['season_clock_healthy'] = false;
      }
    }

    // Check 10: Phase boundaries are correct
    checks['phase_consistent_with_elapsed'] =
      resolvePhaseFromElapsedMs(snapshot.timers.elapsedMs) === snapshot.phase;
    if (!checks['phase_consistent_with_elapsed']) {
      warnings.push(`Phase ${snapshot.phase} is inconsistent with elapsed ms ${snapshot.timers.elapsedMs}.`);
    }

    const allChecksPass = Object.values(checks).every(Boolean);
    const score = Object.values(checks).filter(Boolean).length / Math.max(1, Object.values(checks).length);

    return {
      valid:    errors.length === 0,
      errors:   Object.freeze(errors),
      warnings: Object.freeze(warnings),
      checks:   Object.freeze(checks),
      score,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8t — Self-Test
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Run a comprehensive self-test of the time engine's internals.
   */
  public selfTest(): TimeSelfTestResult {
    const startMs = Date.now();
    const results: Array<{ name: string; passed: boolean; error: string | null; durationMs: number }> = [];

    const runTest = (name: string, fn: () => void): void => {
      const t0 = Date.now();
      try {
        fn();
        results.push({ name, passed: true, error: null, durationMs: Date.now() - t0 });
      } catch (err) {
        results.push({
          name,
          passed:    false,
          error:     err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - t0,
        });
      }
    };

    // Test 1: ML feature labels length
    runTest('ml_feature_labels_count', () => {
      if (TIME_ML_FEATURE_LABELS.length !== 28) {
        throw new Error(`Expected 28 ML feature labels, got ${TIME_ML_FEATURE_LABELS.length}`);
      }
    });

    // Test 2: DL column labels length
    runTest('dl_column_labels_count', () => {
      if (TIME_DL_COLUMN_LABELS.length !== TIME_DL_COL_COUNT) {
        throw new Error(`Expected ${TIME_DL_COL_COUNT} DL column labels, got ${TIME_DL_COLUMN_LABELS.length}`);
      }
    });

    // Test 3: Zero ML vector builds correctly
    runTest('zero_ml_vector_builds', () => {
      const v = buildZeroMLVector();
      if (v.features.length !== 28) throw new Error('Zero ML vector wrong length');
    });

    // Test 4: TickTier enum values match TICK_TIER_BY_PRESSURE_TIER
    runTest('tick_tier_enum_consistency', () => {
      for (const tier of ['T0', 'T1', 'T2', 'T3', 'T4'] as PressureTier[]) {
        const tickTier = resolveTickTier(tier);
        const backTier = resolvePressureTier(tickTier);
        if (backTier !== tier) {
          throw new Error(`Round-trip mismatch for ${tier}: got ${backTier}`);
        }
      }
    });

    // Test 5: pressureTierToTickTier and tickTierToPressureTier are inverses
    runTest('tier_conversion_invertible', () => {
      const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
      for (const t of tiers) {
        const tt = pressureTierToTickTier(t);
        const back = tickTierToPressureTier(tt);
        if (back !== t) throw new Error(`${t} → ${tt} → ${back} !== ${t}`);
      }
    });

    // Test 6: TIER_DURATIONS_MS values are positive
    runTest('tier_durations_positive', () => {
      for (const tier of ['T0', 'T1', 'T2', 'T3', 'T4'] as PressureTier[]) {
        if (TIER_DURATIONS_MS[tier] <= 0) {
          throw new Error(`TIER_DURATIONS_MS[${tier}] is not positive`);
        }
      }
    });

    // Test 7: DECISION_WINDOW_DURATIONS_MS values are positive
    runTest('decision_window_durations_positive', () => {
      for (const tier of ['T0', 'T1', 'T2', 'T3', 'T4'] as PressureTier[]) {
        if (DECISION_WINDOW_DURATIONS_MS[tier] <= 0) {
          throw new Error(`DECISION_WINDOW_DURATIONS_MS[${tier}] is not positive`);
        }
      }
    });

    // Test 8: PHASE_BOUNDARIES_MS is sorted ascending
    runTest('phase_boundaries_sorted', () => {
      for (let i = 1; i < PHASE_BOUNDARIES_MS.length; i++) {
        const b = PHASE_BOUNDARIES_MS[i];
        const prev = PHASE_BOUNDARIES_MS[i - 1];
        if (b.startsAtMs < prev.startsAtMs) {
          throw new Error(`Phase boundaries not sorted at index ${i}`);
        }
      }
    });

    // Test 9: clampNonNegativeInteger handles edge cases
    runTest('clamp_non_negative_integer', () => {
      if (clampNonNegativeInteger(-5) !== 0) throw new Error('Expected 0 for -5');
      if (clampNonNegativeInteger(3.7) !== 3) throw new Error('Expected 3 for 3.7');
      if (clampNonNegativeInteger(NaN) !== 0) throw new Error('Expected 0 for NaN');
    });

    // Test 10: getTickTierConfig returns correct config
    runTest('get_tick_tier_config', () => {
      const config = getTickTierConfig(TickTier.COLLAPSE_IMMINENT);
      if (!config.screenShake) throw new Error('T4 must have screenShake=true');
      const stableConfig = getTickTierConfig(TickTier.STABLE);
      if (stableConfig.screenShake) throw new Error('T1 must have screenShake=false');
    });

    // Test 11: createInterpolationPlan produces valid plan
    runTest('create_interpolation_plan', () => {
      const plan = buildInterpolationPlanForTiers('T1', 'T4');
      if (plan.totalTicks <= 0) throw new Error('Interpolation plan totalTicks must be > 0');
      if (plan.fromDurationMs >= plan.toDurationMs) {
        throw new Error('T1→T4 should increase duration (T4 is faster)');
      }
    });

    // Test 12: resolvePhaseFromElapsedMs boundary
    runTest('resolve_phase_from_elapsed', () => {
      const p0 = resolvePhaseFromElapsedMs(0);
      if (p0 !== 'FOUNDATION') throw new Error(`Expected FOUNDATION at 0ms, got ${p0}`);
      const p1 = resolvePhaseFromElapsedMs(4 * 60 * 1000);
      if (p1 !== 'ESCALATION') throw new Error(`Expected ESCALATION at 4min, got ${p1}`);
      const p2 = resolvePhaseFromElapsedMs(8 * 60 * 1000);
      if (p2 !== 'SOVEREIGNTY') throw new Error(`Expected SOVEREIGNTY at 8min, got ${p2}`);
    });

    // Test 13: isPhaseBoundaryTransition works correctly
    runTest('is_phase_boundary_transition', () => {
      const transition = isPhaseBoundaryTransition(3 * 60 * 1000 + 59_000, 4 * 60 * 1000 + 1_000);
      if (!transition) throw new Error('Expected phase boundary transition across 4min');
      const noTransition = isPhaseBoundaryTransition(1_000, 10_000);
      if (noTransition) throw new Error('No transition expected within first minute');
    });

    // Test 14: DecisionCardType values are correct strings
    runTest('decision_card_type_values', () => {
      if (DecisionCardType.FORCED_FATE !== 'FORCED_FATE') throw new Error('FORCED_FATE value wrong');
      if (DecisionCardType.HATER_INJECTION !== 'HATER_INJECTION') throw new Error('HATER_INJECTION value wrong');
      if (DecisionCardType.CRISIS_EVENT !== 'CRISIS_EVENT') throw new Error('CRISIS_EVENT value wrong');
    });

    // Test 15: SeasonClock starts UNCONFIGURED
    runTest('season_clock_unconfigured_initially', () => {
      const testClock = new SeasonClock();
      if (testClock.getLifecycle() !== 'UNCONFIGURED') {
        throw new Error('Fresh SeasonClock should be UNCONFIGURED');
      }
    });

    // Test 16: SeasonWindowType enum contains all expected values
    runTest('season_window_type_values', () => {
      const expected = ['KICKOFF', 'LIVEOPS_EVENT', 'SEASON_FINALE', 'ARCHIVE_CLOSE', 'REENGAGE_WINDOW'];
      for (const val of expected) {
        if (!Object.values(SeasonWindowType).includes(val as SeasonWindowType)) {
          throw new Error(`Missing SeasonWindowType: ${val}`);
        }
      }
    });

    // Test 17: HoldActionLedger starts with 1 charge
    runTest('hold_ledger_initial_charge', () => {
      const ledger = new HoldActionLedger();
      if (ledger.getRemainingCharges() !== 1) {
        throw new Error('HoldActionLedger should start with 1 charge');
      }
    });

    // Test 18: getDefaultTickDurationMs returns correct values
    runTest('get_default_tick_duration_ms', () => {
      const t1 = getDefaultTickDurationMs('T1');
      if (t1 !== T1_DEFAULT_DURATION_MS) {
        throw new Error(`Expected T1 default ${T1_DEFAULT_DURATION_MS}ms, got ${t1}`);
      }
    });

    // Test 19: TICK_TIER_CONFIGS has all 5 tiers
    runTest('tick_tier_configs_complete', () => {
      const tiers = Object.values(TickTier);
      for (const tier of tiers) {
        if (TICK_TIER_CONFIGS[tier] === undefined) {
          throw new Error(`Missing config for TickTier.${tier}`);
        }
      }
    });

    // Test 20: Score weights sum to 1.0
    runTest('score_weights_sum_to_one', () => {
      const sum = SCORE_WEIGHTS.budget + SCORE_WEIGHTS.decision +
        SCORE_WEIGHTS.hold + SCORE_WEIGHTS.cadence + SCORE_WEIGHTS.phase;
      if (Math.abs(sum - 1.0) > 0.0001) {
        throw new Error(`Score weights sum to ${sum}, expected 1.0`);
      }
    });

    // Test 21: TickRateInterpolator resets correctly
    runTest('tick_rate_interpolator_reset', () => {
      const interp = new TickRateInterpolator('T2');
      interp.reset('T1');
      const dur = interp.resolveDurationMs('T1');
      if (dur !== T1_DEFAULT_DURATION_MS) {
        throw new Error(`Expected ${T1_DEFAULT_DURATION_MS}ms after reset to T1, got ${dur}`);
      }
    });

    // Test 22: normalizeTickDurationMs clamps to tier bounds
    runTest('normalize_tick_duration_ms_clamping', () => {
      const clamped = normalizeTickDurationMs('T1', 9999999);
      const config = getTickTierConfigByPressureTier('T1');
      if (clamped > config.maxDurationMs) {
        throw new Error(`normalizeTickDurationMs did not clamp: got ${clamped} > ${config.maxDurationMs}`);
      }
    });

    // Test 23: computeInterpolationTickCount returns 2 for small delta
    runTest('compute_interpolation_tick_count', () => {
      const count = computeInterpolationTickCount(1_000);
      if (count !== 2) throw new Error(`Expected 2 ticks for 1s delta, got ${count}`);
    });

    // Test 24: PressureReader interface shape used in updatePressureReading
    runTest('pressure_reader_interface_update', () => {
      const reader: PressureReader = { score: 0.5, tier: 'T2' };
      this.updatePressureReading(reader);
      if (this.latestPressureReading?.tier !== 'T2') {
        throw new Error('updatePressureReading did not store reading');
      }
    });

    // Test 25: getInterpolationPlan produces valid output
    runTest('get_interpolation_plan', () => {
      const plan = this.getInterpolationPlan('T3');
      if (plan.totalTicks <= 0) throw new Error('Plan totalTicks must be > 0');
    });

    const totalDurationMs = Date.now() - startMs;
    const passCount = results.filter(r => r.passed).length;
    const failCount = results.filter(r => !r.passed).length;

    return {
      passed:         failCount === 0,
      testCount:      results.length,
      passCount,
      failCount,
      results:        Object.freeze(results.map(r => Object.freeze(r))),
      totalDurationMs,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8u — Season Calendar Integration
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Load a season manifest into the internal SeasonClock.
   * This immediately applies season pressure multipliers to cadence resolution.
   */
  public loadSeasonManifest(manifest: SeasonTimelineManifest): void {
    this.seasonClock.loadSeasonManifest(manifest);
  }

  /**
   * Get the current season pressure context.
   */
  public getSeasonPressureContext(nowMs: number = this.lastNowMs): SeasonPressureContext {
    return this.seasonClock.getPressureContext(nowMs);
  }

  /**
   * Get the SeasonClock snapshot for the given reference time.
   */
  public getSeasonClockSnapshot(nowMs: number = this.lastNowMs): SeasonClockSnapshot {
    return this.seasonClock.snapshot(nowMs);
  }

  /**
   * Get the current season lifecycle state.
   */
  public getSeasonLifecycle(nowMs: number = this.lastNowMs): SeasonLifecycleState {
    return this.seasonClock.getLifecycle(nowMs);
  }

  /**
   * Check if a specific season window type is currently active.
   */
  public isSeasonWindowActive(
    type: SeasonWindowType,
    nowMs: number = this.lastNowMs,
  ): boolean {
    return this.seasonClock.hasWindowType(type, nowMs);
  }

  /**
   * Get all active season windows.
   */
  public getActiveSeasonWindows(nowMs: number = this.lastNowMs): readonly SeasonTimeWindow[] {
    return this.seasonClock.getActiveWindows(nowMs);
  }

  /**
   * Get the next season window (optional type filter).
   */
  public getNextSeasonWindow(
    nowMs: number = this.lastNowMs,
    type?: SeasonWindowType,
  ): SeasonTimeWindow | null {
    return this.seasonClock.getNextWindow(nowMs, type);
  }

  /**
   * Access the raw SeasonClock instance (for advanced callers).
   */
  public getSeasonClock(): SeasonClock {
    return this.seasonClock;
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8v — Pressure Reader Integration
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Update the internal pressure reading from an external PressureReader.
   * The PressureReader provides the current pressure score and tier without
   * requiring the full RunStateSnapshot — useful for cross-engine bridge calls.
   */
  public updatePressureReading(reader: PressureReader): void {
    this.latestPressureReading = { ...reader };
    // If the reader provides a different tier than the snapshot tier,
    // the reader takes precedence for the next cadence resolution
    if (reader.tier !== this.lastResolvedTier) {
      // Don't immediately change tier — let the next tick resolve it
      // But update last resolved so pressure reader can influence forecasting
      this.lastResolvedTier = reader.tier;
    }
  }

  /**
   * Get the last external pressure reading.
   */
  public getLatestPressureReading(): PressureReader | null {
    return this.latestPressureReading;
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8w — Budget Service Integration
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Get a budget projection for advancing by the current tick duration.
   */
  public getBudgetProjection(snapshot: RunStateSnapshot): TimeBudgetProjection {
    const request: TimeAdvanceRequest = {
      durationMs:  this.interpolator.getCurrentDurationMs(),
      nowMs:       this.lastNowMs,
    };
    return this.budgetService.projectAdvance(snapshot, request);
  }

  /**
   * Check if the run will exhaust its budget on the next tick.
   */
  public willExhaustBudgetNextTick(snapshot: RunStateSnapshot): boolean {
    return this.budgetService.willExhaustBudget(
      snapshot,
      this.interpolator.getCurrentDurationMs(),
    );
  }

  /**
   * Get the remaining budget in ms.
   */
  public getRemainingBudgetMs(snapshot: RunStateSnapshot): number {
    return this.budgetService.getRemainingBudgetMs(snapshot);
  }

  /**
   * Get the budget utilization percentage.
   */
  public getBudgetUtilizationPct(snapshot: RunStateSnapshot): number {
    return this.budgetService.getUtilizationPct(snapshot);
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8x — History
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Get the tick history (last 50 ticks, oldest first).
   */
  public getTickHistory(): readonly TimeTickRecord[] {
    return Object.freeze([...this.tickHistory]);
  }

  /**
   * Get the last N tick records.
   */
  public getLastNTicks(n: number): readonly TimeTickRecord[] {
    return Object.freeze(this.tickHistory.slice(-Math.max(1, n)));
  }

  /**
   * Get the event history for a specific event type.
   * Uses the TimeEngineEventMap for typed lookup.
   */
  public getEventHistory<K extends keyof TimeEngineEventMap>(
    eventType: K,
  ): ReadonlyArray<TimeEngineEventMap[K]> {
    return Object.freeze(
      this.eventHistory
        .filter((r) => r.eventType === eventType)
        .map((r) => (r as unknown as EventRecord<K>).payload),
    );
  }

  /**
   * Get all events as a flat TimeEngineEvent union array.
   */
  public getAllEvents(): readonly TimeEngineEvent[] {
    return Object.freeze(
      this.eventHistory.map(r => r.payload as TimeEngineEvent),
    );
  }

  /**
   * Clear all history buffers. Useful after export or reset.
   */
  public clearHistory(): void {
    this.tickHistory.length = 0;
    this.mlHistory.length = 0;
    this.eventHistory.length = 0;
    this.dlRows.length = 0;
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8y — Chat Signal Generation
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Generate a chat-native signal payload from the current time state.
   * Routes to the appropriate priority and companion channel.
   */
  public generateChatSignal(snapshot: RunStateSnapshot): TimeChatSignal {
    const tier = this.lastResolvedTier;
    const phase = snapshot.phase;
    const budgetUtilizationPct = this.budgetService.getUtilizationPct(snapshot);
    const remainingBudgetMs = this.budgetService.getRemainingBudgetMs(snapshot);
    const activeWindows = this.decisionTimer.activeCount();
    const expiredThisTick = this.windowsExpiredThisRun;

    // Determine signal type
    let signalType: TimeChatSignal['signalType'] = 'TIME_TICK';
    if (tier === 'T4') signalType = 'TIME_TIMEOUT_WARNING';
    else if (budgetUtilizationPct >= 0.90) signalType = 'TIME_BUDGET_CRITICAL';
    else if (expiredThisTick > 0) signalType = 'TIME_WINDOW_EXPIRED';
    else if (activeWindows > 0) signalType = 'TIME_WINDOW_OPENED';

    // Priority
    let priority: TimeChatSignal['priority'] = 'AMBIENT';
    if (tier === 'T4' || budgetUtilizationPct >= 0.92) priority = 'CRITICAL';
    else if (tier === 'T3' || budgetUtilizationPct >= 0.80) priority = 'HIGH';
    else if (tier === 'T2' || activeWindows > 0) priority = 'MEDIUM';
    else if (tier === 'T1') priority = 'LOW';

    // Urgency score (0–1)
    const urgencyScore = clamp01(
      tierToNormalized(tier) * 0.5 + budgetUtilizationPct * 0.5,
    );

    // Narrative text
    const narrative = this.generateNarrative(snapshot).headline;

    // ML features for chat lane inference
    const mlVector = this.getLastMLVector() ?? buildZeroMLVector();

    // Dedupe suppression: same tier for N ticks
    const suppressIfSameTierFor = tier === 'T0' ? 5 : tier === 'T1' ? 3 : 1;

    // Companion channel hint
    const channelHint = priority === 'CRITICAL' ? 'hater' :
      priority === 'HIGH' ? 'helper' :
      'advisor';

    const tags: string[] = [
      'engine:time',
      `tier:${tier}`,
      `phase:${phase}`,
      `priority:${priority.toLowerCase()}`,
      signalType.toLowerCase(),
    ];

    if (budgetUtilizationPct >= BUDGET_URGENCY_THRESHOLD) {
      tags.push('budget:urgent');
    }
    if (activeWindows > 0) {
      tags.push('decision:active');
    }

    return {
      signalType,
      priority,
      tick:                   snapshot.tick,
      tier,
      phase,
      budgetUtilizationPct,
      remainingBudgetMs,
      narrative,
      urgencyScore,
      mlFeatures:             mlVector.features,
      tags:                   Object.freeze(tags),
      suppressIfSameTierFor,
      companionChannelHint:   channelHint,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8z — Serialization
   * ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Serialize the internal runtime state (excluding history buffers).
   * Suitable for diagnostics and lightweight state transfer.
   */
  public serializeState(): string {
    const state = {
      engineId:               this.engineId,
      lastResolvedTier:       this.lastResolvedTier,
      holdConsumedThisRun:    this.holdConsumedThisRun,
      runtimeHoldCharges:     this.runtimeHoldCharges,
      runtimeHoldEnabled:     this.runtimeHoldEnabled,
      forcedTierOverride:     this.forcedTierOverride,
      windowsOpenedThisRun:   this.windowsOpenedThisRun,
      windowsExpiredThisRun:  this.windowsExpiredThisRun,
      windowsResolvedThisRun: this.windowsResolvedThisRun,
      tierChangeCountThisRun: this.tierChangeCountThisRun,
      holdsAppliedThisRun:    this.holdsAppliedThisRun,
      lastSeasonMultiplier:   this.lastSeasonMultiplier,
      seasonHasManifest:      this.seasonClock.hasManifest(),
      tickHistorySize:        this.tickHistory.length,
      mlHistorySize:          this.mlHistory.length,
      eventHistorySize:       this.eventHistory.length,
      interpolatorDurationMs: this.interpolator.getCurrentDurationMs(),
      interpolatorTransitioning: this.interpolator.isTransitioning(),
      decisionTimerActiveCount: this.decisionTimer.activeCount(),
    };
    return JSON.stringify(state);
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * § 8α — Private Helpers
   * ══════════════════════════════════════════════════════════════════════════ */

  private resolveCadenceTierFromSnapshot(snapshot: RunStateSnapshot): PressureTier {
    if (
      this.forcedTierOverride !== null &&
      this.forcedTierOverride.ticksRemaining > 0
    ) {
      return this.forcedTierOverride.tier;
    }

    // Use external pressure reader tier if more recent
    if (
      this.latestPressureReading !== null &&
      this.latestPressureReading.tier !== snapshot.pressure.tier
    ) {
      // Prefer snapshot authority unless pressure reader is more escalated
      const pressureTierOrder: Readonly<Record<PressureTier, number>> = {
        T0: 0, T1: 1, T2: 2, T3: 3, T4: 4,
      };
      const readerOrd = pressureTierOrder[this.latestPressureReading.tier];
      const snapshotOrd = pressureTierOrder[snapshot.pressure.tier];
      // Conservative: use the higher (more escalated) tier
      return readerOrd > snapshotOrd
        ? this.latestPressureReading.tier
        : snapshot.pressure.tier;
    }

    return snapshot.pressure.tier;
  }

  private consumeForcedOverrideTick(): void {
    if (this.forcedTierOverride === null) return;
    this.forcedTierOverride.ticksRemaining -= 1;
    if (this.forcedTierOverride.ticksRemaining <= 0) {
      this.forcedTierOverride = null;
    }
  }

  private syncRuntimeHoldLedger(snapshot: RunStateSnapshot): void {
    if (!snapshot.modeState.holdEnabled) {
      this.runtimeHoldEnabled = false;
      this.runtimeHoldCharges = 0;
      return;
    }

    this.runtimeHoldEnabled = true;
    const snapshotHoldCharges = Math.max(0, Math.trunc(snapshot.timers.holdCharges));

    if (this.runtimeHoldCharges === null) {
      this.runtimeHoldCharges = snapshotHoldCharges;
      return;
    }

    this.runtimeHoldCharges = Math.min(this.runtimeHoldCharges, snapshotHoldCharges);
  }

  private resolveRuntimeHoldCharges(snapshot: RunStateSnapshot): number {
    if (!snapshot.modeState.holdEnabled) return 0;
    if (this.runtimeHoldCharges === null) {
      return Math.max(0, Math.trunc(snapshot.timers.holdCharges));
    }
    return Math.max(0, Math.trunc(this.runtimeHoldCharges));
  }

  private buildMLVectorFromState(
    snapshot: RunStateSnapshot,
    tick: number,
    computedAtMs: number,
    tier: PressureTier,
    phase: RunPhase,
    expiredWindowCountThisTick: number,
    holdConsumedThisTick: boolean,
  ): TimeMLVector {
    const totalBudgetMs = this.budgetService.getTotalBudgetMs(snapshot);
    const elapsedMs = this.budgetService.getElapsedMs(snapshot);
    const remainingBudgetMs = this.budgetService.getRemainingBudgetMs(snapshot);
    const utilizationPct = totalBudgetMs > 0 ? elapsedMs / totalBudgetMs : 0;
    const remaining01 = totalBudgetMs > 0 ? remainingBudgetMs / totalBudgetMs : 1;

    const currentDurationMs = this.interpolator.getCurrentDurationMs();
    const tierNorm = tierToNormalized(tier);
    const isInterpolating = this.interpolator.isTransitioning() ? 1 : 0;
    const remainingInterpTicks = this.interpolator.getRemainingTransitionTicks();
    const totalInterpTicks = computeInterpolationTickCount(
      Math.abs(currentDurationMs - getDefaultTickDurationMs(tier)),
    );
    const interpProgress = totalInterpTicks > 0
      ? clamp01((totalInterpTicks - remainingInterpTicks) / totalInterpTicks)
      : 0;

    const prevTier = this.tickHistory.length > 0
      ? this.tickHistory[this.tickHistory.length - 1]?.tier ?? tier
      : tier;
    const transitionDirection = computeTierTransitionDirection(prevTier, tier);

    const phaseNorm = phaseToNormalized(phase);
    const phaseBoundaryRemaining = snapshot.modeState.phaseBoundaryWindowsRemaining;
    const phaseBoundaryNorm = clamp01(phaseBoundaryRemaining / DEFAULT_PHASE_TRANSITION_WINDOWS);

    const activeWindowCount = this.decisionTimer.activeCount();
    const activeWindowNorm = clamp01(activeWindowCount / MAX_EXPECTED_ACTIVE_WINDOWS);
    const frozenWindowCount = snapshot.timers.frozenWindowIds.length;
    const frozenRatio = activeWindowCount > 0
      ? clamp01(frozenWindowCount / activeWindowCount)
      : 0;

    const holdChargesRemaining = Math.max(0, Math.trunc(snapshot.timers.holdCharges));
    const holdConsumedFlag = this.holdConsumedThisRun ? 1 : 0;
    const holdEnabledFlag = snapshot.modeState.holdEnabled ? 1 : 0;
    const forcedTierActiveFlag = this.forcedTierOverride !== null ? 1 : 0;
    const forcedTierTicksNorm = this.forcedTierOverride !== null
      ? clamp01(this.forcedTierOverride.ticksRemaining / MAX_FORCED_TIER_TICKS)
      : 0;

    const timeoutProximity = clamp01(utilizationPct);
    const budgetUrgency = remaining01 < BUDGET_URGENCY_THRESHOLD ? 1 : 0;
    const tierVsT1Ratio = T1_DEFAULT_DURATION_MS > 0
      ? clamp01(currentDurationMs / T1_DEFAULT_DURATION_MS)
      : 0;

    const totalOpened = this.windowsOpenedThisRun;
    const windowDensity = totalOpened > 0
      ? clamp01(activeWindowCount / (activeWindowCount + this.windowsExpiredThisRun + 1))
      : 0;
    const windowExpiryRate = totalOpened > 0
      ? clamp01(this.windowsExpiredThisRun / totalOpened)
      : 0;
    const windowHoldRate = totalOpened > 0
      ? clamp01(this.holdsAppliedThisRun / totalOpened)
      : 0;

    // Average window urgency
    const windowSnapshots = Object.entries(snapshot.timers.activeDecisionWindows);
    const avgWindowUrgency = windowSnapshots.length > 0
      ? windowSnapshots.reduce(
          (sum, [, wsnap]) => sum + computeWindowUrgencyScore(wsnap, computedAtMs),
          0,
        ) / windowSnapshots.length
      : 0;

    // Phase time pct
    let phaseStartMs = 0;
    for (const b of PHASE_BOUNDARIES_MS) {
      if (b.phase === phase) { phaseStartMs = b.startsAtMs; break; }
    }
    const phaseElapsedMs = Math.max(0, elapsedMs - phaseStartMs);
    const phaseDurationMs = PHASE_DURATION_ESTIMATES_MS[phase] ?? 240_000;
    const phaseTimePct = clamp01(phaseElapsedMs / Math.max(1, phaseDurationMs));

    const seasonMultiplier = this.seasonClock.getPressureMultiplier(computedAtMs);
    const seasonMultiplierNorm = normalize01(seasonMultiplier, 0.1, 4.0);

    const tierChangeNorm = normalizeTierChangeCount(this.tierChangeCountThisRun);
    const tickCountNorm = clamp01(tick / Math.max(1, ESTIMATED_TOTAL_TICKS_T1));

    const seasonBudgetMs = this.budgetService.getSeasonBudgetMs(snapshot);
    const extensionBudgetMs = this.budgetService.getExtensionBudgetMs(snapshot);
    const budgetExtensionRatio = seasonBudgetMs > 0
      ? clamp01(extensionBudgetMs / seasonBudgetMs)
      : 0;

    const featureValues = [
      clamp01(utilizationPct),          // 0  elapsed_ms_normalized
      clamp01(remaining01),             // 1  remaining_budget_normalized
      clamp01(currentDurationMs / MAX_TICK_DURATION_MS), // 2 current_tick_duration_normalized
      tierNorm,                         // 3  tier_index_normalized
      isInterpolating,                  // 4  tier_interpolating
      interpProgress,                   // 5  tier_interpolation_progress
      (transitionDirection + 1) / 2,   // 6  tier_transition_direction (mapped 0-1)
      phaseNorm,                        // 7  phase_index_normalized
      phaseBoundaryNorm,                // 8  phase_boundary_windows_remaining
      activeWindowNorm,                 // 9  active_decision_windows_normalized
      frozenRatio,                      // 10 frozen_windows_ratio
      clamp01(holdChargesRemaining),    // 11 hold_charges_remaining
      holdConsumedFlag,                 // 12 hold_consumed_flag
      holdEnabledFlag,                  // 13 hold_enabled_flag
      forcedTierActiveFlag,             // 14 forced_tier_active_flag
      forcedTierTicksNorm,              // 15 forced_tier_ticks_remaining_norm
      timeoutProximity,                 // 16 timeout_proximity
      budgetUrgency,                    // 17 budget_urgency
      tierVsT1Ratio,                    // 18 tier_duration_vs_t1_ratio
      windowDensity,                    // 19 decision_window_density
      windowExpiryRate,                 // 20 decision_window_expiry_rate
      windowHoldRate,                   // 21 decision_window_hold_rate
      clamp01(avgWindowUrgency),        // 22 average_window_urgency
      phaseTimePct,                     // 23 phase_time_pct
      seasonMultiplierNorm,             // 24 season_pressure_multiplier_norm
      tierChangeNorm,                   // 25 tier_change_count_normalized
      tickCountNorm,                    // 26 tick_count_normalized
      budgetExtensionRatio,             // 27 budget_extension_ratio
    ];

    const features = Object.freeze(Float64Array.from(featureValues));

    return {
      features,
      labels:       TIME_ML_FEATURE_LABELS,
      tick,
      computedAtMs,
      tier,
      phase,
    };
  }

  private buildDLRowFromMLVector(mlVector: TimeMLVector): Float64Array {
    const row = buildZeroDLRow();
    // Col 0: tick_duration_normalized
    row[0] = mlVector.features[2] ?? 0;
    // Col 1: tier_index_normalized
    row[1] = mlVector.features[3] ?? 0;
    // Col 2: budget_utilization
    row[2] = mlVector.features[0] ?? 0;
    // Col 3: phase_progress
    row[3] = mlVector.features[7] ?? 0;
    // Col 4: active_windows_norm
    row[4] = mlVector.features[9] ?? 0;
    // Col 5: hold_consumed_flag
    row[5] = mlVector.features[12] ?? 0;
    return row;
  }

  private buildTickRecord(
    tick: number,
    phase: RunPhase,
    tier: PressureTier,
    durationMs: number,
    elapsedMs: number,
    totalBudgetMs: number,
    phaseChanged: boolean,
    tierChanged: boolean,
    expiredWindowCount: number,
    holdConsumed: boolean,
    timeoutReached: boolean,
    seasonMultiplier: number,
    nowMs: number,
    mlVector: TimeMLVector,
  ): TimeTickRecord {
    const budgetUtilizationPct = totalBudgetMs > 0
      ? clamp01(elapsedMs / totalBudgetMs)
      : 0;
    const tickTier = resolveTickTier(tier);

    return {
      tick,
      phase,
      tier,
      tickTier,
      durationMs,
      elapsedMs,
      budgetUtilizationPct,
      phaseChanged,
      tierChanged,
      expiredWindowCount,
      holdConsumed,
      timeoutReached,
      forcedTierActive: this.forcedTierOverride !== null,
      seasonMultiplier,
      nowMs,
      mlVector,
    };
  }

  private buildSignals(
    nextTick: number,
    phase: RunPhase,
    previousPhase: RunPhase,
    effectiveTier: PressureTier,
    priorTier: PressureTier,
    tierChangedThisTick: boolean,
    expiredWindowIds: readonly string[],
    holdConsumedThisTick: boolean,
    nextHoldCharges: number,
    timeoutReached: boolean,
  ): readonly EngineSignal[] {
    const signals: EngineSignal[] = [];

    if (phase !== previousPhase) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'TIME_PHASE_ADVANCED',
          `Run phase advanced from ${previousPhase} to ${phase}.`,
          nextTick,
          ['phase-change', `from:${previousPhase}`, `to:${phase}`],
        ),
      );
    }

    if (tierChangedThisTick) {
      const severity: EngineSignalSeverity =
        effectiveTier === 'T4' ? 'WARN' :
        effectiveTier === 'T3' ? 'WARN' :
        'INFO';
      signals.push(
        createEngineSignal(
          this.engineId,
          severity,
          'TIME_TIER_CHANGED',
          `Cadence tier changed from ${priorTier} to ${effectiveTier}.`,
          nextTick,
          ['tier-change', `from:${priorTier}`, `to:${effectiveTier}`],
        ),
      );
    }

    for (const windowId of expiredWindowIds) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'TIME_DECISION_WINDOW_EXPIRED',
          `Decision window ${windowId} expired before resolution.`,
          nextTick,
          ['decision-window', 'expired', `id:${windowId}`],
        ),
      );
    }

    if (holdConsumedThisTick) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'TIME_HOLD_CONSUMED',
          'A hold charge was consumed and persisted into timer state.',
          nextTick,
          ['hold', `remaining:${nextHoldCharges}`],
        ),
      );
    }

    if (timeoutReached) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'WARN',
          'TIME_SEASON_BUDGET_EXHAUSTED',
          'Run timed out because the season time budget was exhausted.',
          nextTick,
          ['timeout', 'terminal'],
        ),
      );
    }

    if (this.forcedTierOverride !== null) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'TIME_FORCED_TIER_ACTIVE',
          `Forced cadence tier ${this.forcedTierOverride.tier} remains active for ${this.forcedTierOverride.ticksRemaining} more tick(s).`,
          nextTick,
          ['time', 'forced-tier', `tier:${this.forcedTierOverride.tier}`],
        ),
      );
    }

    if (this.interpolator.isTransitioning()) {
      const remaining = this.interpolator.getRemainingTransitionTicks();
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'TIME_TIER_INTERPOLATING',
          `Cadence interpolating: ${remaining} tick(s) remaining to target tier.`,
          nextTick,
          ['time', 'interpolating', `remaining:${remaining}`],
        ),
      );
    }

    if (this.lastSeasonMultiplier > 1.0) {
      signals.push(
        createEngineSignal(
          this.engineId,
          'INFO',
          'TIME_SEASON_PRESSURE_ACTIVE',
          `Season pressure multiplier active: ×${this.lastSeasonMultiplier.toFixed(2)}.`,
          nextTick,
          ['season', 'pressure', `multiplier:${this.lastSeasonMultiplier.toFixed(2)}`],
        ),
      );
    }

    return Object.freeze(signals);
  }

  private openPhaseRecord(phase: RunPhase, atTick: number, atElapsedMs: number): void {
    this.currentPhaseRecord = {
      phase,
      enteredAtTick: atTick,
      enteredAtElapsedMs: atElapsedMs,
      tickCount: 0,
      windowsOpened: 0,
      windowsExpired: 0,
      tierSum: 0,
    };
  }

  private closePhaseRecord(atTick: number): void {
    if (this.currentPhaseRecord !== null) {
      this.phaseHistory.push(this.currentPhaseRecord);
      this.currentPhaseRecord = null;
    }
  }

  private openTierRecord(tier: PressureTier, atTick: number): void {
    this.currentTierRecord = {
      tier,
      enteredAtTick: atTick,
      tickCount: 0,
    };
  }

  private closeTierRecord(atTick: number): void {
    if (this.currentTierRecord !== null) {
      this.tierHistory.push(this.currentTierRecord);
      this.currentTierRecord = null;
    }
  }

  private pushTickHistory(record: TimeTickRecord): void {
    this.tickHistory.push(record);
    if (this.tickHistory.length > MAX_TICK_HISTORY) {
      this.tickHistory.shift();
    }
  }

  private pushMLHistory(vector: TimeMLVector): void {
    this.mlHistory.push(vector);
    if (this.mlHistory.length > MAX_ML_HISTORY) {
      this.mlHistory.shift();
    }
  }

  private pushDLRow(mlVector: TimeMLVector): void {
    this.dlRows.push(this.buildDLRowFromMLVector(mlVector));
    if (this.dlRows.length > TIME_DL_ROW_COUNT) {
      this.dlRows.shift();
    }
  }

  private recordEvent<K extends keyof TimeEngineEventMap>(
    eventType: K,
    payload: TimeEngineEventMap[K],
    tick: number,
    nowMs: number,
  ): void {
    this.eventHistory.push({ eventType, payload, tick, nowMs } as AnyEventRecord);
    if (this.eventHistory.length > MAX_EVENT_HISTORY) {
      this.eventHistory.shift();
    }
  }

  private buildEmptyRuntimeSnapshot(): TimeRuntimeSnapshot {
    const config = getTickTierConfigByPressureTier('T1');
    return {
      engineId:                       'time',
      tick:                           0,
      phase:                          'FOUNDATION',
      tier:                           'T1',
      tickTier:                       TickTier.STABLE,
      tickTierConfig:                 config,
      currentTickDurationMs:          T1_DEFAULT_DURATION_MS,
      elapsedMs:                      0,
      seasonBudgetMs:                 0,
      extensionBudgetMs:              0,
      totalBudgetMs:                  0,
      remainingBudgetMs:              0,
      budgetUtilizationPct:           0,
      holdEnabled:                    true,
      holdChargesRemaining:           1,
      holdConsumedThisRun:            false,
      activeDecisionWindowCount:      0,
      frozenDecisionWindowCount:      0,
      forcedTierActive:               false,
      forcedTier:                     null,
      forcedTierTicksRemaining:       0,
      interpolating:                  false,
      interpolationRemainingTicks:    0,
      phaseBoundaryWindowsRemaining:  DEFAULT_PHASE_TRANSITION_WINDOWS,
      lastTierChangeTick:             null,
      tierChangeCountThisRun:         0,
      windowsOpenedThisRun:           0,
      windowsExpiredThisRun:          0,
      windowsResolvedThisRun:         0,
      seasonPressureMultiplier:       1.0,
      seasonLifecycle:                'UNCONFIGURED',
    };
  }

  private buildEmptyTrendSnapshot(windowSize: number): TimeTrendSnapshot {
    return {
      windowSize,
      avgTickDurationMs:                T1_DEFAULT_DURATION_MS,
      minTickDurationMs:                T1_DEFAULT_DURATION_MS,
      maxTickDurationMs:                T1_DEFAULT_DURATION_MS,
      tierFrequency:                    Object.freeze({ T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 }),
      phaseFrequency:                   Object.freeze({ FOUNDATION: 0, ESCALATION: 0, SOVEREIGNTY: 0 }),
      avgBudgetUtilizationDelta:        0,
      totalExpiredWindowsInWindow:      0,
      totalHoldsAppliedInWindow:        0,
      tierEscalationCount:              0,
      tierDeEscalationCount:            0,
      phaseTransitionCount:             0,
      isAcceleratingThisTick:           false,
      isDeceleratingThisTick:           false,
      dominantTier:                     'T1',
      dominantPhase:                    'FOUNDATION',
    };
  }

  private wasTierEscalation(record: TimeTickRecord): boolean {
    const prevRecord = this.tickHistory.find(r => r.tick === record.tick - 1);
    if (!prevRecord) return false;
    const order: Readonly<Record<PressureTier, number>> = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };
    return order[record.tier] > order[prevRecord.tier];
  }
}
