/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeBudgetService.ts
 *
 * v4.0.0 — Full-depth upgrade: authoritative budget arithmetic, ML 28-dim
 * feature extraction, DL 40×6 tensor construction, LIVEOPS_SIGNAL chat
 * integration, audit trail, trend analysis, resilience scoring, mode and
 * phase advisory, session analytics, batch projection, and run-level export.
 *
 * Doctrine:
 * - time budget math must stay pure, central, and deterministic
 * - season budget and extension budget are distinct inputs but one run ceiling
 * - elapsed time is authoritative; next-fire planning is projected from it
 * - this service owns arithmetic, not event emission or outcome mutation
 * - additive diagnostics are allowed so long as they do not change timer truth
 * - ML/DL extraction is a first-class concern: 28 features, 40×6 cells
 * - LIVEOPS_SIGNAL emission flows through the canonical chat envelope contract
 * - all imports are 100% used — zero dead weight, zero placeholders
 *
 * Sub-systems:
 *   § 1  — Imports (100% used)
 *   § 2  — Module constants (local; no circular deps)
 *   § 3  — ML feature label registry (28 labels)
 *   § 4  — DL column label registry (6 columns)
 *   § 5  — Core public type definitions (existing + new)
 *   § 6  — Budget criticality types
 *   § 7  — Budget risk types
 *   § 8  — Budget resilience types
 *   § 9  — Budget trend types
 *   § 10 — ML/DL output types
 *   § 11 — Chat signal types
 *   § 12 — Audit trail types
 *   § 13 — Mode/phase profile types
 *   § 14 — Session analytics types
 *   § 15 — Batch / export bundle types
 *   § 16 — Private utility helpers
 *   § 17 — BudgetAuditTrail
 *   § 18 — BudgetTrendAnalyzer
 *   § 19 — BudgetResilienceScorer
 *   § 20 — BudgetMLExtractor
 *   § 21 — BudgetDLBuilder
 *   § 22 — BudgetChatEmitter
 *   § 23 — BudgetNarrator
 *   § 24 — BudgetModeAdvisor
 *   § 25 — BudgetPhaseAdvisor
 *   § 26 — BudgetSessionTracker
 *   § 27 — TimeBudgetService (master class)
 *   § 28 — Factory functions
 *   § 29 — Pure helper exports
 *   § 30 — Manifest
 */

/* ============================================================================
 * § 1 — IMPORTS (100% USED)
 * ============================================================================ */

import type {
  ModeCode,
  PressureTier,
  RunPhase,
  RunOutcome,
} from '../core/GamePrimitives';

import {
  MODE_CODES,
  PRESSURE_TIERS,
  RUN_PHASES,
  RUN_OUTCOMES,
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  computePressureRiskScore,
  canEscalatePressure,
  canDeescalatePressure,
  describePressureTierExperience,
  computeRunProgressFraction,
  computeEffectiveStakes,
  isEndgamePhase,
  isWinOutcome,
  isLossOutcome,
  scoreOutcomeExcitement,
} from '../core/GamePrimitives';

import type {
  RunStateSnapshot,
  TimerState,
  TelemetryState,
  OutcomeReasonCode,
  DecisionRecord,
} from '../core/RunStateSnapshot';

import type {
  ChatInputEnvelope,
  ChatSignalEnvelope,
  ChatLiveOpsSnapshot,
  ChatSignalType,
  Nullable,
  UnixMs,
  JsonValue,
} from '../chat/types';

import {
  asUnixMs,
  clamp01,
  clamp100,
} from '../chat/types';

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
  getTickTierConfigByPressureTier,
  getTickTierConfig,
  getDefaultTickDurationMs,
  getDecisionWindowDurationMs,
  clampTickDurationMs,
  normalizeTickDurationMs,
  computeInterpolationTickCount,
  createInterpolationPlan,
  resolvePhaseFromElapsedMs,
  isPhaseBoundaryTransition,
  clampNonNegativeInteger,
} from './types';

import type {
  TickTierConfig,
  TickInterpolationPlan,
  PhaseBoundary,
  PressureReader,
} from './types';

/* ============================================================================
 * § 2 — MODULE CONSTANTS (local, no circular deps)
 * ============================================================================ */

/** Canonical version of this module. */
export const BUDGET_SERVICE_VERSION = '4.0.0' as const;

/** ML feature dimension aligned with TimeEngine 28-dim vector. */
export const BUDGET_ML_DIM = 28;

/** DL tensor row count aligned with TimeEngine 40-row sequence. */
export const BUDGET_DL_ROW_COUNT = 40;

/** DL tensor column count aligned with TimeEngine 6-col feature slice. */
export const BUDGET_DL_COL_COUNT = 6;

/** Canonical tier urgency scores (0.0–1.0). Mirrors TIME_CONTRACT_TIER_URGENCY. */
export const BUDGET_TIER_URGENCY: Readonly<Record<PressureTier, number>> =
  Object.freeze({ T0: 0.0, T1: 0.2, T2: 0.45, T3: 0.75, T4: 1.0 });

/** Mode-specific tempo multipliers. Mirrors TIME_CONTRACT_MODE_TEMPO. */
export const BUDGET_MODE_TEMPO: Readonly<Record<ModeCode, number>> =
  Object.freeze({ solo: 1.0, pvp: 1.25, coop: 0.9, ghost: 1.15 });

/** Phase progression scores (0.0–1.0). Mirrors TIME_CONTRACT_PHASE_SCORE. */
export const BUDGET_PHASE_SCORE: Readonly<Record<RunPhase, number>> =
  Object.freeze({ FOUNDATION: 0.0, ESCALATION: 0.5, SOVEREIGNTY: 1.0 });

/** Budget utilization alarm thresholds. Mirrors TIME_CONTRACT_BUDGET_THRESHOLDS. */
export const BUDGET_THRESHOLDS = Object.freeze({
  WARNING_PCT: 0.7,
  CRITICAL_PCT: 0.9,
  EXHAUST_PCT: 0.97,
  MIN_REMAINING_MS_FOR_CHAT: 30_000,
} as const);

/** Maximum budget for normalization (10 minutes). */
export const BUDGET_MAX_BUDGET_MS = 600_000;

/** Maximum tick duration for normalization. */
export const BUDGET_MAX_TICK_DURATION_MS = 22_000;

/** Maximum decision window duration for normalization. */
export const BUDGET_MAX_DECISION_WINDOW_MS = 12_000;

/** Maximum number of audit entries before the trail is trimmed. */
export const BUDGET_AUDIT_MAX_ENTRIES = 500;

/** DL ring buffer capacity (same as BUDGET_DL_ROW_COUNT). */
export const BUDGET_DL_RING_CAPACITY = BUDGET_DL_ROW_COUNT;

/** Maximum trend history depth for BudgetTrendAnalyzer. */
export const BUDGET_TREND_HISTORY_DEPTH = 80;

/** Minimum ticks required before trend velocity is meaningful. */
export const BUDGET_TREND_MIN_SAMPLES = 3;

/** Score weights for composite resilience computation. */
export const BUDGET_RESILIENCE_WEIGHTS = Object.freeze({
  BUDGET_MARGIN: 0.35,
  TIER_SAFETY: 0.25,
  PHASE_BUFFER: 0.20,
  MODE_FACTOR: 0.12,
  EXTENSION_FACTOR: 0.08,
} as const);

/** Extension grant reason codes. */
export const BUDGET_EXTENSION_REASONS = Object.freeze([
  'PLAYER_REWARD',
  'SEASON_BONUS',
  'ADMIN_GRANT',
  'TUTORIAL_BUFFER',
  'PERFORMANCE_BONUS',
  'CORD_ACHIEVEMENT',
] as const);

export type BudgetExtensionReason = typeof BUDGET_EXTENSION_REASONS[number];

/* ============================================================================
 * § 3 — ML FEATURE LABEL REGISTRY (28 labels)
 * ============================================================================ */

export const BUDGET_ML_FEATURE_LABELS = Object.freeze([
  /*  0 */ 'tier_urgency',
  /*  1 */ 'phase_score',
  /*  2 */ 'budget_utilization',
  /*  3 */ 'remaining_budget_normalized',
  /*  4 */ 'run_progress',
  /*  5 */ 'pressure_score',
  /*  6 */ 'pressure_risk',
  /*  7 */ 'pressure_normalized',
  /*  8 */ 'effective_stakes',
  /*  9 */ 'mode_normalized',
  /* 10 */ 'mode_difficulty',
  /* 11 */ 'mode_tension_floor',
  /* 12 */ 'phase_normalized',
  /* 13 */ 'phase_stakes',
  /* 14 */ 'phase_budget_fraction',
  /* 15 */ 'tick_duration_normalized',
  /* 16 */ 'decision_window_normalized',
  /* 17 */ 'hold_charges_normalized',
  /* 18 */ 'active_windows_normalized',
  /* 19 */ 'frozen_windows_normalized',
  /* 20 */ 'is_endgame',
  /* 21 */ 'can_escalate',
  /* 22 */ 'can_deescalate',
  /* 23 */ 'budget_warning',
  /* 24 */ 'budget_critical',
  /* 25 */ 'budget_exhausted',
  /* 26 */ 'interpolation_remaining',
  /* 27 */ 'session_excitement',
] as const);

export type BudgetMLFeatureLabel = typeof BUDGET_ML_FEATURE_LABELS[number];

/* ============================================================================
 * § 4 — DL COLUMN LABEL REGISTRY (6 columns)
 * ============================================================================ */

export const BUDGET_DL_COL_LABELS = Object.freeze([
  'tier_urgency',
  'budget_utilization',
  'hold_pressure',
  'phase_score',
  'run_progress',
  'composite_pressure',
] as const);

export type BudgetDLColLabel = typeof BUDGET_DL_COL_LABELS[number];

/* ============================================================================
 * § 5 — CORE PUBLIC TYPE DEFINITIONS
 * ============================================================================ */

/**
 * Canonical budget projection produced by projectAdvance().
 * Kept identical to the original contract surface consumed by contracts.ts.
 */
export interface TimeBudgetProjection {
  readonly seasonBudgetMs: number;
  readonly extensionBudgetMs: number;
  readonly totalBudgetMs: number;
  readonly previousElapsedMs: number;
  readonly nextElapsedMs: number;
  readonly consumedBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly utilizationPct: number;
  readonly currentTickDurationMs: number;
  readonly nextTickAtMs: number | null;
  readonly canScheduleNextTick: boolean;
  /**
   * Additive diagnostics:
   * - budgetExhausted answers the simple boolean question
   * - overflowBudgetMs preserves how far past ceiling the advance went
   * These do not alter authoritative timer math.
   */
  readonly budgetExhausted: boolean;
  readonly overflowBudgetMs: number;
}

/**
 * Canonical time-advance request consumed by projectAdvance() and projectTimers().
 * Kept identical to the original contract surface consumed by contracts.ts.
 */
export interface TimeAdvanceRequest {
  readonly durationMs: number;
  readonly nowMs: number;
  readonly stopScheduling?: boolean;
  readonly overrideHoldCharges?: number;
  readonly activeDecisionWindows?: TimerState['activeDecisionWindows'];
  readonly frozenWindowIds?: readonly string[];
}

/* ============================================================================
 * § 6 — BUDGET CRITICALITY TYPES
 * ============================================================================ */

/** Severity level of the current budget state. */
export type BudgetCriticalityLevel = 'SAFE' | 'WARNING' | 'CRITICAL' | 'EXHAUSTED';

/** Budget tick band: interval-based characterization of utilization velocity. */
export interface BudgetTickBand {
  readonly level: BudgetCriticalityLevel;
  readonly utilizationPct: number;
  readonly remainingMs: number;
  readonly projectedExhaustionTick: number | null;
  readonly label: string;
  readonly urgencyScore: number;
  readonly chatEmitRecommended: boolean;
}

/** Budget alert entry emitted when criticality level changes. */
export interface BudgetAlert {
  readonly alertId: string;
  readonly tick: number;
  readonly level: BudgetCriticalityLevel;
  readonly utilizationPct: number;
  readonly remainingMs: number;
  readonly message: string;
  readonly emittedAtMs: number;
}

/* ============================================================================
 * § 7 — BUDGET RISK TYPES
 * ============================================================================ */

/** Full risk assessment produced by BudgetResilienceScorer. */
export interface BudgetRiskAssessment {
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly utilizationPct: number;
  readonly criticalityLevel: BudgetCriticalityLevel;
  readonly pressureRiskScore: number;
  readonly canEscalateTier: boolean;
  readonly canDeescalateTier: boolean;
  readonly effectiveStakes: number;
  readonly runProgressFraction: number;
  readonly isEndgame: boolean;
  readonly estimatedRemainingTicks: number;
  readonly budgetVelocityMsPerTick: number;
  readonly projectedExhaustionMs: number | null;
  readonly urgencyScore: number;
  readonly warnings: readonly string[];
  readonly tags: readonly string[];
}

/** Urgency snapshot at a specific moment in time. */
export interface BudgetUrgencySnapshot {
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly utilizationPct: number;
  readonly criticalityLevel: BudgetCriticalityLevel;
  readonly tierUrgency: number;
  readonly phaseScore: number;
  readonly modeTempoMultiplier: number;
  readonly compositeUrgency: number;
  readonly capturedAtMs: number;
  readonly capturedAtTick: number;
}

/* ============================================================================
 * § 8 — BUDGET RESILIENCE TYPES
 * ============================================================================ */

/** Composite resilience score combining budget margin, tier safety, and mode. */
export interface BudgetResilienceScore {
  readonly overall: number;
  readonly budgetMarginComponent: number;
  readonly tierSafetyComponent: number;
  readonly phaseBufferComponent: number;
  readonly modeFactorComponent: number;
  readonly extensionFactorComponent: number;
  readonly label: string;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
}

/** Per-tier resilience analysis. */
export interface BudgetTierResilienceMap {
  readonly T0: number;
  readonly T1: number;
  readonly T2: number;
  readonly T3: number;
  readonly T4: number;
}

/* ============================================================================
 * § 9 — BUDGET TREND TYPES
 * ============================================================================ */

/** Single entry in the budget trend history ring buffer. */
export interface BudgetTrendEntry {
  readonly tick: number;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly utilizationPct: number;
  readonly tickDurationMs: number;
  readonly tier: PressureTier;
  readonly capturedAtMs: number;
}

/** Trend analysis computed from the budget history window. */
export interface BudgetTrendVector {
  readonly sampleCount: number;
  readonly velocityMsPerTick: number;
  readonly accelerationMsPerTickSq: number;
  readonly avgUtilizationPct: number;
  readonly maxUtilizationPct: number;
  readonly projectedExhaustionTick: number | null;
  readonly trendDirection: 'STABLE' | 'ACCELERATING' | 'DECELERATING';
  readonly isVelocityReliable: boolean;
}

/* ============================================================================
 * § 10 — ML/DL OUTPUT TYPES
 * ============================================================================ */

/** Full 28-dimensional ML feature vector for downstream inference. */
export interface BudgetMLVector {
  readonly features: Readonly<Float32Array>;
  readonly labels: typeof BUDGET_ML_FEATURE_LABELS;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly tick: number;
  readonly extractedAtMs: UnixMs;
  readonly utilizationPct: number;
  readonly compositeUrgency: number;
}

/** Full 40×6 DL tensor for sequence-based inference. */
export interface BudgetDLTensor {
  readonly data: Readonly<Float32Array>;
  readonly rows: number;
  readonly cols: number;
  readonly colLabels: typeof BUDGET_DL_COL_LABELS;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly headTick: number;
  readonly extractedAtMs: UnixMs;
}

/* ============================================================================
 * § 11 — CHAT SIGNAL TYPES
 * ============================================================================ */

/** Internal budget chat signal payload before wrapping in ChatInputEnvelope. */
export interface BudgetChatSignalPayload {
  readonly signalType: ChatSignalType;
  readonly criticalityLevel: BudgetCriticalityLevel;
  readonly utilizationPct: number;
  readonly remainingMs: number;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly narrative: string;
  readonly urgencyScore: number;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

/** Full LIVEOPS_SIGNAL envelope produced by BudgetChatEmitter. */
export interface BudgetChatEnvelope {
  readonly input: ChatInputEnvelope;
  readonly payload: BudgetChatSignalPayload;
  readonly roomId: Nullable<string>;
  readonly emittedAtMs: UnixMs;
}

/* ============================================================================
 * § 12 — AUDIT TRAIL TYPES
 * ============================================================================ */

/** Category of a budget audit event. */
export type BudgetAuditKind =
  | 'ADVANCE'
  | 'EXTENSION_GRANT'
  | 'SEASON_REPLACE'
  | 'SCHEDULE_CLEAR'
  | 'CRITICALITY_CHANGE'
  | 'EXHAUSTED'
  | 'OVERFLOW_DETECTED'
  | 'PHASE_TRANSITION'
  | 'TIER_CHANGE'
  | 'SESSION_TICK';

/** Single immutable audit entry. */
export interface BudgetAuditEntry {
  readonly entryId: string;
  readonly kind: BudgetAuditKind;
  readonly tick: number;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly utilizationPct: number;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly durationMs: number;
  readonly notes: readonly string[];
  readonly capturedAtMs: number;
}

/** Summary statistics derived from the full audit trail. */
export interface BudgetAuditSummary {
  readonly totalEntries: number;
  readonly advanceCount: number;
  readonly extensionCount: number;
  readonly criticalityChangeCount: number;
  readonly overflowCount: number;
  readonly phaseTransitionCount: number;
  readonly totalExtendedMs: number;
  readonly avgTickDurationMs: number;
  readonly peakUtilizationPct: number;
  readonly lowestRemainingMs: number;
}

/* ============================================================================
 * § 13 — MODE/PHASE PROFILE TYPES
 * ============================================================================ */

/** Budget behavior profile for a specific game mode. */
export interface BudgetModeProfile {
  readonly mode: ModeCode;
  readonly modeNormalized: number;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly tempoMultiplier: number;
  readonly expectedBudgetConsumedPct: number;
  readonly holdImpactScore: number;
  readonly recommendedMinRemainingMs: number;
  readonly label: string;
  readonly description: string;
}

/** Budget behavior profile for a specific run phase. */
export interface BudgetPhaseProfile {
  readonly phase: RunPhase;
  readonly phaseNormalized: number;
  readonly stakesMultiplier: number;
  readonly tickBudgetFraction: number;
  readonly phaseScore: number;
  readonly isEndgame: boolean;
  readonly budgetAllocationMs: number;
  readonly urgencyMultiplier: number;
  readonly label: string;
  readonly description: string;
}

/* ============================================================================
 * § 14 — SESSION ANALYTICS TYPES
 * ============================================================================ */

/** Per-outcome counts for session analytics. */
export type BudgetOutcomeDistribution = Readonly<Record<RunOutcome, number>>;

/** Session-level analytics produced by BudgetSessionTracker. */
export interface BudgetSessionAnalytics {
  readonly totalTicksRecorded: number;
  readonly totalExtensionGrantsMs: number;
  readonly extensionGrantCount: number;
  readonly peakUtilizationPct: number;
  readonly criticalLevelHits: number;
  readonly exhaustionCount: number;
  readonly phaseTransitionCount: number;
  readonly avgTickDurationMs: number;
  readonly avgUtilizationPct: number;
  readonly lastOutcome: RunOutcome | null;
  readonly outcomeExcitementScore: number;
  readonly outcomeDistribution: BudgetOutcomeDistribution;
  readonly sessionStartMs: number;
  readonly sessionDurationMs: number;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
}

/* ============================================================================
 * § 15 — BATCH / EXPORT BUNDLE TYPES
 * ============================================================================ */

/** Result of a batch advance projection (multiple sequential advances). */
export interface BudgetProjectionBatch {
  readonly projections: readonly TimeBudgetProjection[];
  readonly finalProjection: TimeBudgetProjection;
  readonly totalAdvancedMs: number;
  readonly exhaustedAtIndex: number | null;
  readonly batchUtilizationPct: number;
  readonly allCanSchedule: boolean;
}

/** Extension grant record capturing an individual extension event. */
export interface BudgetExtensionGrant {
  readonly grantId: string;
  readonly extensionMs: number;
  readonly reason: BudgetExtensionReason;
  readonly grantedAtTick: number;
  readonly grantedAtMs: number;
  readonly previousTotalBudgetMs: number;
  readonly newTotalBudgetMs: number;
}

/** Full export bundle for persistence, replay, and ML ingestion. */
export interface BudgetExportBundle {
  readonly version: typeof BUDGET_SERVICE_VERSION;
  readonly snapshot: {
    readonly tick: number;
    readonly phase: RunPhase;
    readonly tier: PressureTier;
    readonly mode: ModeCode;
    readonly elapsedMs: number;
    readonly remainingMs: number;
    readonly utilizationPct: number;
    readonly criticalityLevel: BudgetCriticalityLevel;
  };
  readonly mlVector: BudgetMLVector;
  readonly dlTensor: BudgetDLTensor;
  readonly resilienceScore: BudgetResilienceScore;
  readonly riskAssessment: BudgetRiskAssessment;
  readonly trendVector: BudgetTrendVector;
  readonly sessionAnalytics: BudgetSessionAnalytics;
  readonly auditSummary: BudgetAuditSummary;
  readonly narrative: string;
  readonly exportedAtMs: UnixMs;
}

/* ============================================================================
 * § 16 — PRIVATE UTILITY HELPERS
 * ============================================================================ */

function normalizeMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function normalizeNullableMs(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function freezeDecisionWindows(
  windows: TimerState['activeDecisionWindows'],
): TimerState['activeDecisionWindows'] {
  return Object.freeze({ ...windows });
}

function generateEntryId(): string {
  return `budget_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function classifyUtilization(utilizationPct: number): BudgetCriticalityLevel {
  if (utilizationPct >= 1.0) return 'EXHAUSTED';
  if (utilizationPct >= BUDGET_THRESHOLDS.CRITICAL_PCT) return 'CRITICAL';
  if (utilizationPct >= BUDGET_THRESHOLDS.WARNING_PCT) return 'WARNING';
  return 'SAFE';
}

function criticalityLabel(level: BudgetCriticalityLevel): string {
  switch (level) {
    case 'SAFE':      return 'Budget safe — normal operation';
    case 'WARNING':   return 'Budget warning — 70%+ consumed';
    case 'CRITICAL':  return 'Budget critical — 90%+ consumed';
    case 'EXHAUSTED': return 'Budget exhausted — run ceiling reached';
    default:          return 'Unknown criticality';
  }
}

function resilienceLabel(score: number): string {
  if (score >= 0.8) return 'SOVEREIGN';
  if (score >= 0.6) return 'STABLE';
  if (score >= 0.4) return 'COMPRESSED';
  if (score >= 0.2) return 'CRITICAL';
  return 'COLLAPSE_IMMINENT';
}

function trendDirectionLabel(
  velocity: number,
  previousVelocity: number,
): 'STABLE' | 'ACCELERATING' | 'DECELERATING' {
  const delta = velocity - previousVelocity;
  if (Math.abs(delta) < 50) return 'STABLE';
  return delta > 0 ? 'ACCELERATING' : 'DECELERATING';
}

function dedupeStrings(...groups: ReadonlyArray<readonly string[]>): readonly string[] {
  const merged = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      if (item.length > 0) merged.add(item);
    }
  }
  return freezeArray([...merged]);
}

function computeCompositeUrgency(
  tierUrgency: number,
  utilizationPct: number,
  phaseScore: number,
  pressureRisk: number,
): number {
  return Math.min(
    1.0,
    tierUrgency * 0.35 +
    utilizationPct * 0.30 +
    phaseScore * 0.20 +
    pressureRisk * 0.15,
  );
}

function getPressureTierNext(tier: PressureTier): PressureTier {
  const idx = PRESSURE_TIERS.indexOf(tier);
  return idx < PRESSURE_TIERS.length - 1
    ? (PRESSURE_TIERS[idx + 1] as PressureTier)
    : tier;
}

function getPressureTierPrev(tier: PressureTier): PressureTier {
  const idx = PRESSURE_TIERS.indexOf(tier);
  return idx > 0
    ? (PRESSURE_TIERS[idx - 1] as PressureTier)
    : tier;
}

function safeDecisionLatencyAvg(decisions: readonly DecisionRecord[]): number {
  if (decisions.length === 0) return 0;
  const sum = decisions.reduce((acc, d) => acc + normalizeMs(d.latencyMs), 0);
  return sum / decisions.length;
}

/** Summarize telemetry decision count and event density. */
function extractTelemetryFeatures(tel: TelemetryState): {
  decisionCount: number;
  eventDensityNorm: number;
  avgLatencyMs: number;
} {
  const decisionCount = tel.decisions.length;
  const eventDensityNorm = clamp01(tel.emittedEventCount / 500);
  const avgLatencyMs = safeDecisionLatencyAvg(tel.decisions);
  return { decisionCount, eventDensityNorm, avgLatencyMs };
}

/* ============================================================================
 * § 17 — BUDGET AUDIT TRAIL
 * ============================================================================ */

/**
 * BudgetAuditTrail
 *
 * Immutable append-only audit log for all budget mutations within a run.
 * Provides summary stats, kind-filtered queries, and per-entry access.
 * Trimmed to BUDGET_AUDIT_MAX_ENTRIES to prevent unbounded growth.
 */
export class BudgetAuditTrail {
  private readonly _entries: BudgetAuditEntry[] = [];
  private _totalExtendedMs = 0;
  private _advanceCount = 0;
  private _extensionCount = 0;
  private _criticalityChangeCount = 0;
  private _overflowCount = 0;
  private _phaseTransitionCount = 0;
  private _peakUtilizationPct = 0;
  private _lowestRemainingMs = Infinity;
  private _tickDurationSum = 0;
  private _tickDurationCount = 0;

  public record(entry: BudgetAuditEntry): void {
    if (this._entries.length >= BUDGET_AUDIT_MAX_ENTRIES) {
      this._entries.shift();
    }
    this._entries.push(entry);

    // Accumulate stats
    if (entry.utilizationPct > this._peakUtilizationPct) {
      this._peakUtilizationPct = entry.utilizationPct;
    }
    if (entry.remainingMs < this._lowestRemainingMs) {
      this._lowestRemainingMs = entry.remainingMs;
    }
    if (entry.durationMs > 0) {
      this._tickDurationSum += entry.durationMs;
      this._tickDurationCount++;
    }

    switch (entry.kind) {
      case 'ADVANCE':
        this._advanceCount++;
        break;
      case 'EXTENSION_GRANT':
        this._extensionCount++;
        this._totalExtendedMs += entry.durationMs;
        break;
      case 'CRITICALITY_CHANGE':
        this._criticalityChangeCount++;
        break;
      case 'OVERFLOW_DETECTED':
        this._overflowCount++;
        break;
      case 'PHASE_TRANSITION':
        this._phaseTransitionCount++;
        break;
      default:
        break;
    }
  }

  public getAll(): readonly BudgetAuditEntry[] {
    return freezeArray(this._entries);
  }

  public getByKind(kind: BudgetAuditKind): readonly BudgetAuditEntry[] {
    return freezeArray(this._entries.filter((e) => e.kind === kind));
  }

  public getLast(n: number): readonly BudgetAuditEntry[] {
    return freezeArray(this._entries.slice(-Math.max(0, n)));
  }

  public getByPhase(phase: RunPhase): readonly BudgetAuditEntry[] {
    return freezeArray(this._entries.filter((e) => e.phase === phase));
  }

  public getByTier(tier: PressureTier): readonly BudgetAuditEntry[] {
    return freezeArray(this._entries.filter((e) => e.tier === tier));
  }

  public exportSummary(): BudgetAuditSummary {
    return Object.freeze({
      totalEntries: this._entries.length,
      advanceCount: this._advanceCount,
      extensionCount: this._extensionCount,
      criticalityChangeCount: this._criticalityChangeCount,
      overflowCount: this._overflowCount,
      phaseTransitionCount: this._phaseTransitionCount,
      totalExtendedMs: this._totalExtendedMs,
      avgTickDurationMs: this._tickDurationCount > 0
        ? Math.round(this._tickDurationSum / this._tickDurationCount)
        : 0,
      peakUtilizationPct: this._peakUtilizationPct,
      lowestRemainingMs: this._lowestRemainingMs === Infinity ? 0 : this._lowestRemainingMs,
    });
  }

  public reset(): void {
    this._entries.length = 0;
    this._totalExtendedMs = 0;
    this._advanceCount = 0;
    this._extensionCount = 0;
    this._criticalityChangeCount = 0;
    this._overflowCount = 0;
    this._phaseTransitionCount = 0;
    this._peakUtilizationPct = 0;
    this._lowestRemainingMs = Infinity;
    this._tickDurationSum = 0;
    this._tickDurationCount = 0;
  }
}

/* ============================================================================
 * § 18 — BUDGET TREND ANALYZER
 * ============================================================================ */

/**
 * BudgetTrendAnalyzer
 *
 * Ring buffer tracking budget consumption velocity and acceleration.
 * Uses the last BUDGET_TREND_HISTORY_DEPTH ticks to compute trend statistics.
 * Provides projected exhaustion tick, velocity, and direction.
 */
export class BudgetTrendAnalyzer {
  private readonly _history: BudgetTrendEntry[] = [];
  private _lastVelocity = 0;

  public push(entry: BudgetTrendEntry): void {
    if (this._history.length >= BUDGET_TREND_HISTORY_DEPTH) {
      this._history.shift();
    }
    this._history.push(entry);
  }

  public getHistory(): readonly BudgetTrendEntry[] {
    return freezeArray(this._history);
  }

  public getVelocityMsPerTick(): number {
    if (this._history.length < 2) return 0;
    const recent = this._history.slice(-Math.min(10, this._history.length));
    const first = recent[0];
    const last = recent[recent.length - 1];
    const tickDelta = last.tick - first.tick;
    if (tickDelta <= 0) return 0;
    const msDelta = last.elapsedMs - first.elapsedMs;
    return msDelta / tickDelta;
  }

  public getAccelerationMsPerTickSq(): number {
    const currentVelocity = this.getVelocityMsPerTick();
    const acc = currentVelocity - this._lastVelocity;
    this._lastVelocity = currentVelocity;
    return acc;
  }

  public getAvgUtilizationPct(): number {
    if (this._history.length === 0) return 0;
    const sum = this._history.reduce((acc, e) => acc + e.utilizationPct, 0);
    return sum / this._history.length;
  }

  public getMaxUtilizationPct(): number {
    if (this._history.length === 0) return 0;
    return this._history.reduce((max, e) => Math.max(max, e.utilizationPct), 0);
  }

  public getProjectedExhaustionTick(currentRemaining: number, totalBudgetMs: number): number | null {
    const velocity = this.getVelocityMsPerTick();
    if (velocity <= 0 || this._history.length === 0) return null;
    const last = this._history[this._history.length - 1];
    const ticksToExhaustion = currentRemaining / velocity;
    return Math.ceil(last.tick + ticksToExhaustion);
  }

  public getTrendVector(currentRemaining: number, totalBudgetMs: number): BudgetTrendVector {
    const sampleCount = this._history.length;
    const velocity = this.getVelocityMsPerTick();
    const acceleration = this.getAccelerationMsPerTickSq();
    const avgUtil = this.getAvgUtilizationPct();
    const maxUtil = this.getMaxUtilizationPct();
    const exhaustionTick = this.getProjectedExhaustionTick(currentRemaining, totalBudgetMs);
    const isReliable = sampleCount >= BUDGET_TREND_MIN_SAMPLES;

    return Object.freeze({
      sampleCount,
      velocityMsPerTick: velocity,
      accelerationMsPerTickSq: acceleration,
      avgUtilizationPct: avgUtil,
      maxUtilizationPct: maxUtil,
      projectedExhaustionTick: exhaustionTick,
      trendDirection: trendDirectionLabel(velocity, this._lastVelocity),
      isVelocityReliable: isReliable,
    });
  }

  public reset(): void {
    this._history.length = 0;
    this._lastVelocity = 0;
  }
}

/* ============================================================================
 * § 19 — BUDGET RESILIENCE SCORER
 * ============================================================================ */

/**
 * BudgetResilienceScorer
 *
 * Computes composite resilience and risk scores from snapshot state.
 * Weights: budget margin (35%), tier safety (25%), phase buffer (20%),
 * mode factor (12%), extension factor (8%).
 * Uses GamePrimitives scoring functions for pressure, stakes, and escalation.
 */
export class BudgetResilienceScorer {
  public score(
    snapshot: RunStateSnapshot,
    remainingMs: number,
    totalBudgetMs: number,
    extensionBudgetMs: number,
  ): BudgetResilienceScore {
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const mode = snapshot.mode;

    const budgetMargin = totalBudgetMs > 0 ? clamp01(remainingMs / totalBudgetMs) : 0;
    const tierIndex = PRESSURE_TIERS.indexOf(tier);
    const tierSafety = clamp01(1.0 - tierIndex / (PRESSURE_TIERS.length - 1));
    const phaseBuffer = clamp01(1.0 - BUDGET_PHASE_SCORE[phase]);
    const modeFactor = clamp01(1.0 / (MODE_DIFFICULTY_MULTIPLIER[mode] + 0.001));
    const extensionFactor = clamp01(extensionBudgetMs / BUDGET_MAX_BUDGET_MS);

    const overall = clamp01(
      budgetMargin * BUDGET_RESILIENCE_WEIGHTS.BUDGET_MARGIN +
      tierSafety * BUDGET_RESILIENCE_WEIGHTS.TIER_SAFETY +
      phaseBuffer * BUDGET_RESILIENCE_WEIGHTS.PHASE_BUFFER +
      modeFactor * BUDGET_RESILIENCE_WEIGHTS.MODE_FACTOR +
      extensionFactor * BUDGET_RESILIENCE_WEIGHTS.EXTENSION_FACTOR,
    );

    return Object.freeze({
      overall,
      budgetMarginComponent: budgetMargin,
      tierSafetyComponent: tierSafety,
      phaseBufferComponent: phaseBuffer,
      modeFactorComponent: modeFactor,
      extensionFactorComponent: extensionFactor,
      label: resilienceLabel(overall),
      tier,
      phase,
      mode,
    });
  }

  public assessRisk(
    snapshot: RunStateSnapshot,
    remainingMs: number,
    totalBudgetMs: number,
    velocityMsPerTick: number,
    currentTickDurationMs: number,
  ): BudgetRiskAssessment {
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const mode = snapshot.mode;
    const utilizationPct = totalBudgetMs > 0
      ? clamp01((totalBudgetMs - remainingMs) / totalBudgetMs)
      : 1.0;
    const criticalityLevel = classifyUtilization(utilizationPct);
    const pressureRisk = computePressureRiskScore(tier, snapshot.pressure.score);

    const nextTier = getPressureTierNext(tier);
    const prevTier = getPressureTierPrev(tier);
    const canEscalate = tier !== 'T4' && canEscalatePressure(
      tier, nextTier, snapshot.pressure.score, snapshot.pressure.survivedHighPressureTicks,
    );
    const canDeescalate = tier !== 'T0' && canDeescalatePressure(
      tier, prevTier, snapshot.pressure.score,
    );

    const effectiveStakes = computeEffectiveStakes(phase, mode);
    const expectedMaxTicks = currentTickDurationMs > 0
      ? Math.ceil(totalBudgetMs / currentTickDurationMs)
      : 100;
    const progressFraction = computeRunProgressFraction(
      phase,
      snapshot.tick,
      Math.max(1, expectedMaxTicks),
    );
    const endgame = isEndgamePhase(phase);

    const estimatedRemainingTicks = velocityMsPerTick > 0
      ? Math.ceil(remainingMs / velocityMsPerTick)
      : Math.ceil(remainingMs / Math.max(1, currentTickDurationMs));

    const projectedExhaustionMs = velocityMsPerTick > 0
      ? Date.now() + remainingMs / velocityMsPerTick * currentTickDurationMs
      : null;

    const tierUrgency = BUDGET_TIER_URGENCY[tier];
    const urgencyScore = computeCompositeUrgency(
      tierUrgency, utilizationPct, BUDGET_PHASE_SCORE[phase], pressureRisk,
    );

    const warnings: string[] = [];
    const tags: string[] = [];

    if (criticalityLevel === 'CRITICAL' || criticalityLevel === 'EXHAUSTED') {
      warnings.push(`Budget ${criticalityLevel.toLowerCase()}: ${(utilizationPct * 100).toFixed(1)}% consumed`);
      tags.push(`budget:${criticalityLevel.toLowerCase()}`);
    }
    if (canEscalate) {
      warnings.push(`Tier escalation available: ${tier} → ${nextTier}`);
      tags.push('tier:escalation_possible');
    }
    if (endgame) {
      warnings.push('SOVEREIGNTY phase: maximum stakes active');
      tags.push('phase:endgame');
    }
    if (pressureRisk >= 0.75) {
      warnings.push(`High pressure risk: ${(pressureRisk * 100).toFixed(0)}%`);
      tags.push('pressure:high_risk');
    }

    return Object.freeze({
      tier,
      phase,
      mode,
      utilizationPct,
      criticalityLevel,
      pressureRiskScore: pressureRisk,
      canEscalateTier: canEscalate,
      canDeescalateTier: canDeescalate,
      effectiveStakes,
      runProgressFraction: progressFraction,
      isEndgame: endgame,
      estimatedRemainingTicks,
      budgetVelocityMsPerTick: velocityMsPerTick,
      projectedExhaustionMs,
      urgencyScore,
      warnings: freezeArray(warnings),
      tags: freezeArray(tags),
    });
  }

  public computeResilienceByTier(
    remainingMs: number,
    totalBudgetMs: number,
  ): BudgetTierResilienceMap {
    const budgetRatio = totalBudgetMs > 0 ? clamp01(remainingMs / totalBudgetMs) : 0;
    return Object.freeze({
      T0: clamp01(budgetRatio * 1.0),
      T1: clamp01(budgetRatio * 0.9),
      T2: clamp01(budgetRatio * 0.65),
      T3: clamp01(budgetRatio * 0.4),
      T4: clamp01(budgetRatio * 0.2),
    });
  }
}

/* ============================================================================
 * § 20 — BUDGET ML EXTRACTOR
 * ============================================================================ */

/**
 * BudgetMLExtractor
 *
 * Extracts a 28-dimensional ML feature vector from the current run snapshot.
 * All features are normalized to [0.0, 1.0]. Each dimension is grounded in
 * a real game-state variable — no noise, no fabrication.
 *
 * Feature map:
 *  0  tier_urgency                 — BUDGET_TIER_URGENCY[tier]
 *  1  phase_score                  — BUDGET_PHASE_SCORE[phase]
 *  2  budget_utilization           — consumed/total
 *  3  remaining_budget_normalized  — remaining/MAX_BUDGET_MS
 *  4  run_progress                 — computeRunProgressFraction(phase, tick, maxTicks)
 *  5  pressure_score               — snapshot.pressure.score (0–1)
 *  6  pressure_risk                — computePressureRiskScore(tier, score)
 *  7  pressure_normalized          — PRESSURE_TIER_NORMALIZED[tier]
 *  8  effective_stakes             — computeEffectiveStakes(phase, mode) / 5
 *  9  mode_normalized              — MODE_NORMALIZED[mode]
 * 10  mode_difficulty              — MODE_DIFFICULTY_MULTIPLIER[mode] / 2
 * 11  mode_tension_floor           — MODE_TENSION_FLOOR[mode]
 * 12  phase_normalized             — RUN_PHASE_NORMALIZED[phase]
 * 13  phase_stakes                 — RUN_PHASE_STAKES_MULTIPLIER[phase] / 3
 * 14  phase_budget_fraction        — RUN_PHASE_TICK_BUDGET_FRACTION[phase]
 * 15  tick_duration_normalized     — currentTickMs / MAX_TICK_DURATION_MS
 * 16  decision_window_normalized   — decisionWindowMs / MAX_DECISION_WINDOW_MS
 * 17  hold_charges_normalized      — holdCharges / 2
 * 18  active_windows_normalized    — activeWindowCount / 5
 * 19  frozen_windows_normalized    — frozenWindowCount / 5
 * 20  is_endgame                   — isEndgamePhase(phase) ? 1 : 0
 * 21  can_escalate                 — canEscalatePressure(...) ? 1 : 0
 * 22  can_deescalate               — canDeescalatePressure(...) ? 1 : 0
 * 23  budget_warning               — utilization >= WARNING_PCT ? 1 : 0
 * 24  budget_critical              — utilization >= CRITICAL_PCT ? 1 : 0
 * 25  budget_exhausted             — budgetExhausted ? 1 : 0
 * 26  interpolation_remaining      — tierInterpolationTicks / 4
 * 27  session_excitement           — scoreOutcomeExcitement(if resolved) / 5
 */
export class BudgetMLExtractor {
  public extract(
    snapshot: RunStateSnapshot,
    totalBudgetMs: number,
    remainingMs: number,
    currentTickDurationMs: number,
    nowMs: number,
  ): BudgetMLVector {
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const mode = snapshot.mode;

    const elapsedMs = normalizeMs(snapshot.timers.elapsedMs);
    const utilizationPct = totalBudgetMs > 0 ? clamp01(elapsedMs / totalBudgetMs) : 1.0;

    // Feature 0 — tier urgency
    const f0 = BUDGET_TIER_URGENCY[tier];
    // Feature 1 — phase score
    const f1 = BUDGET_PHASE_SCORE[phase];
    // Feature 2 — budget utilization
    const f2 = utilizationPct;
    // Feature 3 — remaining budget normalized
    const f3 = clamp01(remainingMs / BUDGET_MAX_BUDGET_MS);
    // Feature 4 — run progress
    const maxExpectedTicks = currentTickDurationMs > 0
      ? Math.ceil(totalBudgetMs / currentTickDurationMs)
      : 100;
    const f4 = computeRunProgressFraction(phase, snapshot.tick, Math.max(1, maxExpectedTicks));
    // Feature 5 — pressure score
    const f5 = clamp01(snapshot.pressure.score);
    // Feature 6 — pressure risk
    const f6 = computePressureRiskScore(tier, snapshot.pressure.score);
    // Feature 7 — pressure tier normalized
    const f7 = PRESSURE_TIER_NORMALIZED[tier];
    // Feature 8 — effective stakes (normalized to max stake=5)
    const f8 = clamp01(computeEffectiveStakes(phase, mode) / 5.0);
    // Feature 9 — mode normalized
    const f9 = MODE_NORMALIZED[mode];
    // Feature 10 — mode difficulty (normalized to max=2)
    const f10 = clamp01(MODE_DIFFICULTY_MULTIPLIER[mode] / 2.0);
    // Feature 11 — mode tension floor
    const f11 = clamp01(MODE_TENSION_FLOOR[mode]);
    // Feature 12 — phase normalized
    const f12 = RUN_PHASE_NORMALIZED[phase];
    // Feature 13 — phase stakes (normalized to max=3)
    const f13 = clamp01(RUN_PHASE_STAKES_MULTIPLIER[phase] / 3.0);
    // Feature 14 — phase budget fraction
    const f14 = clamp01(RUN_PHASE_TICK_BUDGET_FRACTION[phase]);
    // Feature 15 — tick duration normalized
    const f15 = clamp01(currentTickDurationMs / BUDGET_MAX_TICK_DURATION_MS);
    // Feature 16 — decision window normalized
    const decisionWindowMs = getDecisionWindowDurationMs(tier);
    const f16 = clamp01(decisionWindowMs / BUDGET_MAX_DECISION_WINDOW_MS);
    // Feature 17 — hold charges normalized (max 2 per run)
    const f17 = clamp01(normalizeCount(snapshot.timers.holdCharges) / 2.0);
    // Feature 18 — active windows normalized (max 5)
    const activeWindowCount = Object.keys(snapshot.timers.activeDecisionWindows).length;
    const f18 = clamp01(activeWindowCount / 5.0);
    // Feature 19 — frozen windows normalized (max 5)
    const frozenWindowCount = snapshot.timers.frozenWindowIds.length;
    const f19 = clamp01(frozenWindowCount / 5.0);
    // Feature 20 — is endgame
    const f20 = isEndgamePhase(phase) ? 1.0 : 0.0;
    // Feature 21 — can escalate
    const nextTier = getPressureTierNext(tier);
    const f21 = tier !== 'T4' && canEscalatePressure(
      tier, nextTier, snapshot.pressure.score, snapshot.pressure.survivedHighPressureTicks,
    ) ? 1.0 : 0.0;
    // Feature 22 — can de-escalate
    const prevTier = getPressureTierPrev(tier);
    const f22 = tier !== 'T0' && canDeescalatePressure(
      tier, prevTier, snapshot.pressure.score,
    ) ? 1.0 : 0.0;
    // Feature 23 — budget warning flag
    const f23 = utilizationPct >= BUDGET_THRESHOLDS.WARNING_PCT ? 1.0 : 0.0;
    // Feature 24 — budget critical flag
    const f24 = utilizationPct >= BUDGET_THRESHOLDS.CRITICAL_PCT ? 1.0 : 0.0;
    // Feature 25 — budget exhausted flag
    const f25 = remainingMs <= 0 ? 1.0 : 0.0;
    // Feature 26 — interpolation remaining ticks (max 4)
    const interpTicks = normalizeCount(snapshot.timers.tierInterpolationRemainingTicks ?? 0);
    const f26 = clamp01(interpTicks / 4.0);
    // Feature 27 — session excitement (outcome-based, 0 if no outcome yet)
    const outcome = snapshot.outcome;
    const f27 = outcome !== null
      ? clamp01(scoreOutcomeExcitement(outcome, mode) / 5.0)
      : 0.0;

    const features = new Float32Array(BUDGET_ML_DIM);
    features[0] = f0;
    features[1] = f1;
    features[2] = f2;
    features[3] = f3;
    features[4] = f4;
    features[5] = f5;
    features[6] = f6;
    features[7] = f7;
    features[8] = f8;
    features[9] = f9;
    features[10] = f10;
    features[11] = f11;
    features[12] = f12;
    features[13] = f13;
    features[14] = f14;
    features[15] = f15;
    features[16] = f16;
    features[17] = f17;
    features[18] = f18;
    features[19] = f19;
    features[20] = f20;
    features[21] = f21;
    features[22] = f22;
    features[23] = f23;
    features[24] = f24;
    features[25] = f25;
    features[26] = f26;
    features[27] = f27;

    const compositeUrgency = computeCompositeUrgency(f0, f2, f1, f6);

    return Object.freeze({
      features: Object.freeze(features) as Readonly<Float32Array>,
      labels: BUDGET_ML_FEATURE_LABELS,
      tier,
      phase,
      mode,
      tick: snapshot.tick,
      extractedAtMs: asUnixMs(nowMs),
      utilizationPct,
      compositeUrgency,
    });
  }

  public getLabels(): typeof BUDGET_ML_FEATURE_LABELS {
    return BUDGET_ML_FEATURE_LABELS;
  }

  /** Validate that the ML dim constant matches the label count. */
  public validateDimension(): boolean {
    return BUDGET_ML_DIM === BUDGET_ML_FEATURE_LABELS.length;
  }
}

/* ============================================================================
 * § 21 — BUDGET DL BUILDER
 * ============================================================================ */

/**
 * BudgetDLBuilder
 *
 * Constructs and maintains a 40×6 DL tensor ring buffer from tick history.
 * Each row represents one tick's budget state across 6 features.
 * The oldest row is evicted when the buffer is full.
 *
 * Columns:
 *  0 tier_urgency       — BUDGET_TIER_URGENCY[tier]
 *  1 budget_utilization — consumed/total
 *  2 hold_pressure      — holdCharges==0 ? 0.9 : 0.1*holdCharges
 *  3 phase_score        — BUDGET_PHASE_SCORE[phase]
 *  4 run_progress       — computeRunProgressFraction(...)
 *  5 composite_pressure — blend of all above
 */
export class BudgetDLBuilder {
  private _current: BudgetDLTensor | null = null;

  public append(
    snapshot: RunStateSnapshot,
    totalBudgetMs: number,
    remainingMs: number,
    currentTickDurationMs: number,
    nowMs: number,
  ): BudgetDLTensor {
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const rows = BUDGET_DL_ROW_COUNT;
    const cols = BUDGET_DL_COL_COUNT;
    const data = new Float32Array(rows * cols);

    // Shift previous data forward (evict oldest row at index 0)
    if (this._current !== null && this._current.data.length === rows * cols) {
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          data[r * cols + c] = this._current.data[(r + 1) * cols + c];
        }
      }
    }

    // Build the new head row (last row, index rows-1)
    const elapsedMs = normalizeMs(snapshot.timers.elapsedMs);
    const utilizationPct = totalBudgetMs > 0 ? clamp01(elapsedMs / totalBudgetMs) : 1.0;
    const tierUrgency = BUDGET_TIER_URGENCY[tier];
    const holdCharges = normalizeCount(snapshot.timers.holdCharges);
    const holdPressure = holdCharges === 0 ? 0.9 : clamp01(0.1 * holdCharges);
    const phaseScore = BUDGET_PHASE_SCORE[phase];
    const maxExpectedTicks = currentTickDurationMs > 0
      ? Math.ceil(totalBudgetMs / currentTickDurationMs)
      : 100;
    const runProgress = computeRunProgressFraction(
      phase, snapshot.tick, Math.max(1, maxExpectedTicks),
    );
    const pressureRisk = computePressureRiskScore(tier, snapshot.pressure.score);
    const compositePressure = computeCompositeUrgency(
      tierUrgency, utilizationPct, phaseScore, pressureRisk,
    );

    const headOffset = (rows - 1) * cols;
    data[headOffset + 0] = tierUrgency;
    data[headOffset + 1] = utilizationPct;
    data[headOffset + 2] = holdPressure;
    data[headOffset + 3] = phaseScore;
    data[headOffset + 4] = runProgress;
    data[headOffset + 5] = compositePressure;

    const tensor: BudgetDLTensor = Object.freeze({
      data: Object.freeze(data) as Readonly<Float32Array>,
      rows,
      cols,
      colLabels: BUDGET_DL_COL_LABELS,
      tier,
      phase,
      headTick: snapshot.tick,
      extractedAtMs: asUnixMs(nowMs),
    });

    this._current = tensor;
    return tensor;
  }

  public getCurrent(): BudgetDLTensor | null {
    return this._current;
  }

  public reset(): void {
    this._current = null;
  }

  public validateShape(tensor: BudgetDLTensor): boolean {
    return (
      tensor.rows === BUDGET_DL_ROW_COUNT &&
      tensor.cols === BUDGET_DL_COL_COUNT &&
      tensor.data.length === BUDGET_DL_ROW_COUNT * BUDGET_DL_COL_COUNT
    );
  }

  /** Extract a single row from the tensor (0-indexed). */
  public extractRow(tensor: BudgetDLTensor, rowIndex: number): Float32Array {
    const row = new Float32Array(BUDGET_DL_COL_COUNT);
    const offset = clampNonNegativeInteger(Math.min(rowIndex, BUDGET_DL_ROW_COUNT - 1)) * BUDGET_DL_COL_COUNT;
    for (let c = 0; c < BUDGET_DL_COL_COUNT; c++) {
      row[c] = tensor.data[offset + c];
    }
    return row;
  }

  /** Return the most recent (head) row. */
  public extractHeadRow(tensor: BudgetDLTensor): Float32Array {
    return this.extractRow(tensor, BUDGET_DL_ROW_COUNT - 1);
  }
}

/* ============================================================================
 * § 22 — BUDGET CHAT EMITTER
 * ============================================================================ */

/**
 * BudgetChatEmitter
 *
 * Constructs LIVEOPS_SIGNAL ChatInputEnvelopes for budget state changes.
 * Emits when: budget crosses WARNING or CRITICAL threshold, budget exhausted,
 * or when a phase boundary is crossed during an advance.
 *
 * Signal type: LIVEOPS (budget events are operational, not combat).
 * Chat lane: backend LIVEOPS_SIGNAL adapter.
 */
export class BudgetChatEmitter {
  private _lastEmitLevel: BudgetCriticalityLevel | null = null;

  /** Returns true if a chat signal should be emitted for this state. */
  public shouldEmit(
    criticalityLevel: BudgetCriticalityLevel,
    previousLevel: BudgetCriticalityLevel | null,
    remainingMs: number,
  ): boolean {
    if (criticalityLevel === 'EXHAUSTED') return true;
    if (previousLevel === null) return criticalityLevel !== 'SAFE';
    if (criticalityLevel !== previousLevel) return true;
    if (criticalityLevel === 'CRITICAL' && remainingMs < BUDGET_THRESHOLDS.MIN_REMAINING_MS_FOR_CHAT) {
      return true;
    }
    return false;
  }

  /** Build the ChatInputEnvelope for a budget LIVEOPS_SIGNAL. */
  public buildLiveOpsSignal(
    snapshot: RunStateSnapshot,
    criticalityLevel: BudgetCriticalityLevel,
    urgencyScore: number,
    remainingMs: number,
    totalBudgetMs: number,
    narrative: string,
    nowMs: number,
    roomId: Nullable<string> = null,
    tags: readonly string[] = [],
    metadata: Readonly<Record<string, JsonValue>> = {},
  ): BudgetChatEnvelope {
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase;
    const mode = snapshot.mode;
    const utilizationPct = totalBudgetMs > 0
      ? clamp01((totalBudgetMs - remainingMs) / totalBudgetMs)
      : 1.0;

    const liveops: ChatLiveOpsSnapshot = {
      worldEventName: `budget:${criticalityLevel.toLowerCase()}` as Nullable<string>,
      heatMultiplier01: clamp01(urgencyScore),
      helperBlackout: criticalityLevel === 'EXHAUSTED',
      haterRaidActive: false,
    };

    const signalType: ChatSignalType = 'LIVEOPS';

    const envelope: ChatSignalEnvelope = {
      type: signalType,
      emittedAt: asUnixMs(nowMs),
      roomId: null,
      liveops,
      metadata: {
        criticalityLevel,
        utilizationPct,
        remainingMs,
        tier,
        phase,
        mode,
        narrative,
        ...metadata,
      },
    };

    const input: ChatInputEnvelope = {
      kind: 'LIVEOPS_SIGNAL',
      emittedAt: asUnixMs(nowMs),
      payload: envelope,
    };

    const payload: BudgetChatSignalPayload = Object.freeze({
      signalType,
      criticalityLevel,
      utilizationPct,
      remainingMs,
      tier,
      phase,
      mode,
      narrative,
      urgencyScore,
      tags: freezeArray([...tags]),
      metadata: Object.freeze({ ...metadata }),
    });

    this._lastEmitLevel = criticalityLevel;

    return Object.freeze({
      input,
      payload,
      roomId: roomId as Nullable<string>,
      emittedAtMs: asUnixMs(nowMs),
    });
  }

  public getLastEmitLevel(): BudgetCriticalityLevel | null {
    return this._lastEmitLevel;
  }

  public reset(): void {
    this._lastEmitLevel = null;
  }
}

/* ============================================================================
 * § 23 — BUDGET NARRATOR
 * ============================================================================ */

/**
 * BudgetNarrator
 *
 * Generates player-facing narrative strings for budget state.
 * Uses GamePrimitives tier experience descriptions and urgency labels.
 * Outputs are used in chat LIVEOPS_SIGNAL narratives and UI tooltips.
 */
export class BudgetNarrator {
  public narrateUtilization(
    utilizationPct: number,
    remainingMs: number,
    criticalityLevel: BudgetCriticalityLevel,
  ): string {
    const pct = (utilizationPct * 100).toFixed(1);
    const secRemaining = Math.ceil(remainingMs / 1000);
    switch (criticalityLevel) {
      case 'SAFE':
        return `${pct}% time used — ${secRemaining}s remaining. Stay the course.`;
      case 'WARNING':
        return `${pct}% time used — ${secRemaining}s remaining. Pace yourself.`;
      case 'CRITICAL':
        return `${pct}% time used — only ${secRemaining}s left. Move now.`;
      case 'EXHAUSTED':
        return `Time is up. Run concluded at ${pct}% budget consumed.`;
      default:
        return `${pct}% budget consumed.`;
    }
  }

  public narrateTierExperience(tier: PressureTier): string {
    return describePressureTierExperience(tier);
  }

  public narrateUrgencyLabel(tier: PressureTier): string {
    return PRESSURE_TIER_URGENCY_LABEL[tier];
  }

  public narrateExtension(grant: BudgetExtensionGrant): string {
    const addedSec = Math.ceil(grant.extensionMs / 1000);
    return [
      `+${addedSec}s extension granted (${grant.reason}).`,
      `New total budget: ${Math.ceil(grant.newTotalBudgetMs / 1000)}s.`,
    ].join(' ');
  }

  public narratePhaseTransition(fromPhase: RunPhase, toPhase: RunPhase, tick: number): string {
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[toPhase];
    return [
      `Phase transition at tick ${tick}: ${fromPhase} → ${toPhase}.`,
      `Stakes multiplier: ${stakes.toFixed(2)}×.`,
      toPhase === 'SOVEREIGNTY' ? 'SOVEREIGNTY — everything is on the line.' : '',
    ].filter(Boolean).join(' ');
  }

  public narrateRiskAssessment(risk: BudgetRiskAssessment): string {
    const parts: string[] = [
      `Tier ${risk.tier} | ${risk.phase} phase | ${risk.mode} mode.`,
      `Progress: ${(risk.runProgressFraction * 100).toFixed(0)}%.`,
      `Pressure risk: ${(risk.pressureRiskScore * 100).toFixed(0)}%.`,
    ];
    if (risk.warnings.length > 0) {
      parts.push(risk.warnings[0]);
    }
    return parts.join(' ');
  }

  public narrateCurrentState(
    snapshot: RunStateSnapshot,
    remainingMs: number,
    totalBudgetMs: number,
    criticalityLevel: BudgetCriticalityLevel,
    nowMs: number,
  ): string {
    const utilizationPct = totalBudgetMs > 0
      ? (totalBudgetMs - remainingMs) / totalBudgetMs
      : 1.0;
    const tierExperience = this.narrateTierExperience(snapshot.pressure.tier);
    const utilizationNarrative = this.narrateUtilization(
      utilizationPct, remainingMs, criticalityLevel,
    );
    const phaseLabel = `${snapshot.phase} (tick ${snapshot.tick})`;
    void nowMs; // timestamp available for future extension
    return [tierExperience, utilizationNarrative, phaseLabel].join(' | ');
  }
}

/* ============================================================================
 * § 24 — BUDGET MODE ADVISOR
 * ============================================================================ */

/**
 * BudgetModeAdvisor
 *
 * Provides mode-specific budget behavior profiles and recommendations.
 * Empire (solo): standard pacing, 1 free hold.
 * Predator (pvp): accelerated tempo, higher pressure.
 * Syndicate (coop): conservative pacing, shared treasury buffer.
 * Phantom (ghost): aggressive tempo, no hold charges.
 */
export class BudgetModeAdvisor {
  public getModeProfile(mode: ModeCode): BudgetModeProfile {
    const modeNorm = MODE_NORMALIZED[mode];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const tempo = BUDGET_MODE_TEMPO[mode];

    const holdImpactScore = clamp01(
      PRESSURE_TIER_MIN_HOLD_TICKS['T2'] / 10 * (1 / Math.max(0.1, difficulty)),
    );
    const expectedBudgetConsumedPct = clamp01(0.65 + (tempo - 1.0) * 0.2);
    const recommendedMinRemainingMs = mode === 'pvp'
      ? 20_000
      : mode === 'ghost'
      ? 15_000
      : 30_000;

    const labels: Record<ModeCode, string> = {
      solo:  'Empire — Sovereign Solo',
      pvp:   'Predator — Head to Head',
      coop:  'Syndicate — Team Up',
      ghost: 'Phantom — Chase a Legend',
    };
    const descriptions: Record<ModeCode, string> = {
      solo:  'Standard cadence. Hold available. Build and execute your sovereign plan.',
      pvp:   'Accelerated tempo. High stakes. Every tick is contested.',
      coop:  'Conservative pacing. Shared treasury. Coordinate to survive.',
      ghost: 'Aggressive tempo. No holds. Chase the legend or fall behind.',
    };

    return Object.freeze({
      mode,
      modeNormalized: modeNorm,
      difficultyMultiplier: difficulty,
      tensionFloor,
      tempoMultiplier: tempo,
      expectedBudgetConsumedPct,
      holdImpactScore,
      recommendedMinRemainingMs,
      label: labels[mode],
      description: descriptions[mode],
    });
  }

  public getAllModeProfiles(): Readonly<Record<ModeCode, BudgetModeProfile>> {
    const result: Partial<Record<ModeCode, BudgetModeProfile>> = {};
    for (const mode of MODE_CODES) {
      result[mode as ModeCode] = this.getModeProfile(mode as ModeCode);
    }
    return Object.freeze(result as Record<ModeCode, BudgetModeProfile>);
  }

  public getModeTempoMultiplier(mode: ModeCode): number {
    return BUDGET_MODE_TEMPO[mode];
  }

  public getBudgetTempoMultiplier(remainingBudgetMs: number): number {
    const fraction = clamp01(remainingBudgetMs / BUDGET_MAX_BUDGET_MS);
    // As budget tightens, tempo accelerates slightly (urgency driver)
    return 1.0 + (1.0 - fraction) * 0.3;
  }

  /**
   * Returns whether a hold is recommended given current mode and budget state.
   * Phantom (ghost) mode never recommends hold — no charges available.
   */
  public isHoldRecommended(
    mode: ModeCode,
    holdCharges: number,
    criticalityLevel: BudgetCriticalityLevel,
  ): boolean {
    if (mode === 'ghost') return false;
    if (holdCharges <= 0) return false;
    return criticalityLevel === 'CRITICAL' || criticalityLevel === 'EXHAUSTED';
  }

  /** Returns the expected hold duration (ms) for a mode. */
  public getExpectedHoldDurationMs(mode: ModeCode): number {
    void mode; // mode does not currently differentiate hold duration
    return DEFAULT_HOLD_DURATION_MS;
  }
}

/* ============================================================================
 * § 25 — BUDGET PHASE ADVISOR
 * ============================================================================ */

/**
 * BudgetPhaseAdvisor
 *
 * Provides phase-specific budget behavior profiles.
 * FOUNDATION: early game, wide budget, low stakes.
 * ESCALATION: mid game, rising pressure, 50% stakes.
 * SOVEREIGNTY: endgame, maximum stakes, every tick terminal.
 */
export class BudgetPhaseAdvisor {
  public getPhaseProfile(phase: RunPhase, totalBudgetMs: number): BudgetPhaseProfile {
    const phaseNorm = RUN_PHASE_NORMALIZED[phase];
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const budgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    const phaseScore = BUDGET_PHASE_SCORE[phase];
    const endgame = isEndgamePhase(phase);

    const budgetAllocationMs = Math.round(totalBudgetMs * budgetFraction);
    const urgencyMultiplier = 1.0 + phaseScore * 0.5;

    const labels: Record<RunPhase, string> = {
      FOUNDATION:  'Foundation — Build Phase',
      ESCALATION:  'Escalation — Pressure Rising',
      SOVEREIGNTY: 'Sovereignty — Maximum Stakes',
    };
    const descriptions: Record<RunPhase, string> = {
      FOUNDATION:  'Early game. Wide budget. Set your foundation.',
      ESCALATION:  'Pressure building. Mid-game budget allocation active.',
      SOVEREIGNTY: 'Endgame. Every second counts. This is your moment.',
    };

    return Object.freeze({
      phase,
      phaseNormalized: phaseNorm,
      stakesMultiplier: stakes,
      tickBudgetFraction: budgetFraction,
      phaseScore,
      isEndgame: endgame,
      budgetAllocationMs,
      urgencyMultiplier,
      label: labels[phase],
      description: descriptions[phase],
    });
  }

  public getAllPhaseProfiles(totalBudgetMs: number): Readonly<Record<RunPhase, BudgetPhaseProfile>> {
    const result: Partial<Record<RunPhase, BudgetPhaseProfile>> = {};
    for (const phase of RUN_PHASES) {
      result[phase as RunPhase] = this.getPhaseProfile(phase as RunPhase, totalBudgetMs);
    }
    return Object.freeze(result as Record<RunPhase, BudgetPhaseProfile>);
  }

  public getPhaseTickBudgetFraction(phase: RunPhase): number {
    return RUN_PHASE_TICK_BUDGET_FRACTION[phase];
  }

  /**
   * Returns the phase boundary that will be crossed if elapsed advances to nextElapsedMs.
   * Returns null if no phase transition occurs.
   */
  public getNextPhaseBoundary(currentElapsedMs: number, nextElapsedMs: number): PhaseBoundary | null {
    if (!isPhaseBoundaryTransition(currentElapsedMs, nextElapsedMs)) return null;
    const nextPhase = resolvePhaseFromElapsedMs(nextElapsedMs);
    const boundary = PHASE_BOUNDARIES_MS.find((b) => b.phase === nextPhase);
    return boundary ?? null;
  }

  public getCurrentPhaseBoundary(elapsedMs: number): PhaseBoundary | null {
    const phase = resolvePhaseFromElapsedMs(elapsedMs);
    return PHASE_BOUNDARIES_MS.find((b) => b.phase === phase) ?? null;
  }

  /** Returns how many ticks remain before the next phase boundary estimate. */
  public getTicksUntilPhaseTransition(
    currentElapsedMs: number,
    currentTickDurationMs: number,
  ): number | null {
    const currentPhase = resolvePhaseFromElapsedMs(currentElapsedMs);
    const currentPhaseIdx = RUN_PHASES.indexOf(currentPhase as RunPhase);
    if (currentPhaseIdx < 0 || currentPhaseIdx >= RUN_PHASES.length - 1) return null;
    const nextPhase = RUN_PHASES[currentPhaseIdx + 1] as RunPhase;
    const nextBoundary = PHASE_BOUNDARIES_MS.find((b) => b.phase === nextPhase);
    if (!nextBoundary) return null;
    const msUntilBoundary = nextBoundary.startsAtMs - currentElapsedMs;
    if (msUntilBoundary <= 0) return 0;
    return Math.ceil(msUntilBoundary / Math.max(1, currentTickDurationMs));
  }

  /** Returns the recommended DEFAULT_PHASE_TRANSITION_WINDOWS anticipation window count. */
  public getTransitionWindowCount(): number {
    return DEFAULT_PHASE_TRANSITION_WINDOWS;
  }
}

/* ============================================================================
 * § 26 — BUDGET SESSION TRACKER
 * ============================================================================ */

/**
 * BudgetSessionTracker
 *
 * Tracks session-level budget analytics across the run.
 * Records tick history, extension grants, phase transitions, and outcomes.
 * Produces BudgetSessionAnalytics for ML ingestion and post-run reporting.
 */
export class BudgetSessionTracker {
  private _sessionStartMs: number = Date.now();
  private _lastOutcome: RunOutcome | null = null;
  private _outcomeExcitementScore = 0;
  private _totalTicks = 0;
  private _totalExtensionMs = 0;
  private _extensionGrantCount = 0;
  private _peakUtilizationPct = 0;
  private _criticalLevelHits = 0;
  private _exhaustionCount = 0;
  private _phaseTransitionCount = 0;
  private _tickDurationSum = 0;
  private _utilizationSum = 0;
  private _lastPhase: RunPhase = 'FOUNDATION';
  private _lastTier: PressureTier = 'T1';
  private readonly _outcomeDistribution: Record<RunOutcome, number> = {
    FREEDOM: 0, TIMEOUT: 0, BANKRUPT: 0, ABANDONED: 0,
  };
  private readonly _extensionGrants: BudgetExtensionGrant[] = [];

  public recordTick(
    snapshot: RunStateSnapshot,
    utilizationPct: number,
    tickDurationMs: number,
    criticalityLevel: BudgetCriticalityLevel,
  ): void {
    this._totalTicks++;
    this._tickDurationSum += tickDurationMs;
    this._utilizationSum += utilizationPct;

    if (utilizationPct > this._peakUtilizationPct) {
      this._peakUtilizationPct = utilizationPct;
    }
    if (criticalityLevel === 'CRITICAL' || criticalityLevel === 'EXHAUSTED') {
      this._criticalLevelHits++;
    }
    if (criticalityLevel === 'EXHAUSTED') {
      this._exhaustionCount++;
    }
    if (snapshot.phase !== this._lastPhase) {
      this._phaseTransitionCount++;
      this._lastPhase = snapshot.phase;
    }
    this._lastTier = snapshot.pressure.tier;
  }

  public recordExtension(grant: BudgetExtensionGrant): void {
    this._extensionGrants.push(grant);
    this._totalExtensionMs += grant.extensionMs;
    this._extensionGrantCount++;
  }

  public recordOutcome(outcome: RunOutcome, mode: ModeCode): void {
    this._lastOutcome = outcome;
    this._outcomeExcitementScore = scoreOutcomeExcitement(outcome, mode);

    // Validate outcome is a known value before incrementing
    if (RUN_OUTCOMES.includes(outcome as typeof RUN_OUTCOMES[number])) {
      this._outcomeDistribution[outcome]++;
    }
  }

  public getOutcomeDistribution(): BudgetOutcomeDistribution {
    return Object.freeze({ ...this._outcomeDistribution });
  }

  public getExtensionGrants(): readonly BudgetExtensionGrant[] {
    return freezeArray(this._extensionGrants);
  }

  public getAnalytics(): BudgetSessionAnalytics {
    const sessionDurationMs = Date.now() - this._sessionStartMs;
    const avgTickDurationMs = this._totalTicks > 0
      ? Math.round(this._tickDurationSum / this._totalTicks)
      : 0;
    const avgUtilizationPct = this._totalTicks > 0
      ? this._utilizationSum / this._totalTicks
      : 0;

    return Object.freeze({
      totalTicksRecorded: this._totalTicks,
      totalExtensionGrantsMs: this._totalExtensionMs,
      extensionGrantCount: this._extensionGrantCount,
      peakUtilizationPct: this._peakUtilizationPct,
      criticalLevelHits: this._criticalLevelHits,
      exhaustionCount: this._exhaustionCount,
      phaseTransitionCount: this._phaseTransitionCount,
      avgTickDurationMs,
      avgUtilizationPct,
      lastOutcome: this._lastOutcome,
      outcomeExcitementScore: this._outcomeExcitementScore,
      outcomeDistribution: this.getOutcomeDistribution(),
      sessionStartMs: this._sessionStartMs,
      sessionDurationMs,
      tier: this._lastTier,
      phase: this._lastPhase,
    });
  }

  public reset(): void {
    this._sessionStartMs = Date.now();
    this._lastOutcome = null;
    this._outcomeExcitementScore = 0;
    this._totalTicks = 0;
    this._totalExtensionMs = 0;
    this._extensionGrantCount = 0;
    this._peakUtilizationPct = 0;
    this._criticalLevelHits = 0;
    this._exhaustionCount = 0;
    this._phaseTransitionCount = 0;
    this._tickDurationSum = 0;
    this._utilizationSum = 0;
    this._lastPhase = 'FOUNDATION';
    this._lastTier = 'T1';
    (Object.keys(this._outcomeDistribution) as RunOutcome[]).forEach(
      (k) => { this._outcomeDistribution[k] = 0; },
    );
    this._extensionGrants.length = 0;
  }
}

/* ============================================================================
 * § 27 — TIME BUDGET SERVICE (MASTER CLASS)
 * ============================================================================ */

/**
 * TimeBudgetService
 *
 * The authoritative budget arithmetic engine for Point Zero One.
 *
 * This class is the single source of budget truth for the run engine.
 * It wires together 9 sub-systems (audit trail, trend analysis, resilience
 * scoring, ML extraction, DL construction, chat emission, narration, mode
 * advisory, phase advisory, and session tracking) into a single callable
 * surface that the EngineOrchestrator and TimeEngine consume at STEP_02_TIME.
 *
 * All methods are deterministic and side-effect free except:
 * - recordTick(), recordOutcome(), reset() — modify session tracker state
 * - appendDLRow() — updates internal DL ring buffer
 * - buildChatSignal() — updates last emit level in BudgetChatEmitter
 *
 * Public contract surface (consumed by contracts.ts via type-only imports):
 * - TimeBudgetProjection
 * - TimeAdvanceRequest
 */
export class TimeBudgetService {
  private readonly _audit: BudgetAuditTrail;
  private readonly _trend: BudgetTrendAnalyzer;
  private readonly _resilience: BudgetResilienceScorer;
  private readonly _mlExtractor: BudgetMLExtractor;
  private readonly _dlBuilder: BudgetDLBuilder;
  private readonly _chatEmitter: BudgetChatEmitter;
  private readonly _narrator: BudgetNarrator;
  private readonly _modeAdvisor: BudgetModeAdvisor;
  private readonly _phaseAdvisor: BudgetPhaseAdvisor;
  private readonly _sessionTracker: BudgetSessionTracker;

  public constructor() {
    this._audit = new BudgetAuditTrail();
    this._trend = new BudgetTrendAnalyzer();
    this._resilience = new BudgetResilienceScorer();
    this._mlExtractor = new BudgetMLExtractor();
    this._dlBuilder = new BudgetDLBuilder();
    this._chatEmitter = new BudgetChatEmitter();
    this._narrator = new BudgetNarrator();
    this._modeAdvisor = new BudgetModeAdvisor();
    this._phaseAdvisor = new BudgetPhaseAdvisor();
    this._sessionTracker = new BudgetSessionTracker();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION A — CORE BUDGET ARITHMETIC (existing canonical contract surface)
  // ────────────────────────────────────────────────────────────────────────────

  public getSeasonBudgetMs(snapshot: RunStateSnapshot): number {
    return normalizeMs(snapshot.timers.seasonBudgetMs);
  }

  public getExtensionBudgetMs(snapshot: RunStateSnapshot): number {
    return normalizeMs(snapshot.timers.extensionBudgetMs);
  }

  public getTotalBudgetMs(snapshot: RunStateSnapshot): number {
    return this.getSeasonBudgetMs(snapshot) + this.getExtensionBudgetMs(snapshot);
  }

  public getElapsedMs(snapshot: RunStateSnapshot): number {
    return normalizeMs(snapshot.timers.elapsedMs);
  }

  public getRemainingBudgetMs(snapshot: RunStateSnapshot): number {
    return Math.max(0, this.getTotalBudgetMs(snapshot) - this.getElapsedMs(snapshot));
  }

  public getConsumedBudgetMs(snapshot: RunStateSnapshot): number {
    return this.getElapsedMs(snapshot);
  }

  public getBudgetOverflowMs(snapshot: RunStateSnapshot): number {
    return Math.max(0, this.getElapsedMs(snapshot) - this.getTotalBudgetMs(snapshot));
  }

  public isBudgetExhausted(snapshot: RunStateSnapshot): boolean {
    return this.getRemainingBudgetMs(snapshot) <= 0;
  }

  public getUtilizationPct(snapshot: RunStateSnapshot): number {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    if (totalBudgetMs <= 0) return 1;
    return clamp01(this.getElapsedMs(snapshot) / totalBudgetMs);
  }

  public willExhaustBudget(
    snapshot: RunStateSnapshot,
    durationMs: number,
  ): boolean {
    const projectedElapsedMs = this.getElapsedMs(snapshot) + normalizeMs(durationMs);
    return projectedElapsedMs >= this.getTotalBudgetMs(snapshot);
  }

  public projectAdvance(
    snapshot: RunStateSnapshot,
    request: TimeAdvanceRequest,
  ): TimeBudgetProjection {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const previousElapsedMs = this.getElapsedMs(snapshot);
    const durationMs = normalizeMs(request.durationMs);
    const nowMs = normalizeMs(request.nowMs);

    const nextElapsedMs = previousElapsedMs + durationMs;
    const consumedBudgetMs = nextElapsedMs;
    const remainingBudgetMs = Math.max(0, totalBudgetMs - consumedBudgetMs);
    const overflowBudgetMs = Math.max(0, consumedBudgetMs - totalBudgetMs);
    const budgetExhausted = remainingBudgetMs <= 0;

    const utilizationPct =
      totalBudgetMs <= 0 ? 1 : clamp01(consumedBudgetMs / totalBudgetMs);

    const canScheduleNextTick =
      request.stopScheduling !== true &&
      snapshot.outcome === null &&
      !budgetExhausted;

    return Object.freeze({
      seasonBudgetMs: this.getSeasonBudgetMs(snapshot),
      extensionBudgetMs: this.getExtensionBudgetMs(snapshot),
      totalBudgetMs,
      previousElapsedMs,
      nextElapsedMs,
      consumedBudgetMs,
      remainingBudgetMs,
      utilizationPct,
      currentTickDurationMs: durationMs,
      nextTickAtMs: canScheduleNextTick ? nowMs + durationMs : null,
      canScheduleNextTick,
      budgetExhausted,
      overflowBudgetMs,
    });
  }

  public projectTimers(
    snapshot: RunStateSnapshot,
    request: TimeAdvanceRequest,
  ): TimerState {
    const projection = this.projectAdvance(snapshot, request);

    const holdCharges =
      request.overrideHoldCharges === undefined
        ? normalizeCount(snapshot.timers.holdCharges)
        : normalizeCount(request.overrideHoldCharges);

    const activeDecisionWindows =
      request.activeDecisionWindows === undefined
        ? freezeDecisionWindows(snapshot.timers.activeDecisionWindows)
        : freezeDecisionWindows(request.activeDecisionWindows);

    const frozenWindowIds =
      request.frozenWindowIds === undefined
        ? freezeArray(snapshot.timers.frozenWindowIds)
        : freezeArray(request.frozenWindowIds);

    return Object.freeze({
      seasonBudgetMs: projection.seasonBudgetMs,
      extensionBudgetMs: projection.extensionBudgetMs,
      elapsedMs: projection.nextElapsedMs,
      currentTickDurationMs: projection.currentTickDurationMs,
      nextTickAtMs: projection.nextTickAtMs,
      holdCharges,
      activeDecisionWindows,
      frozenWindowIds,
      lastTierChangeTick:
        snapshot.timers.lastTierChangeTick === undefined
          ? undefined
          : normalizeNullableMs(snapshot.timers.lastTierChangeTick),
      tierInterpolationRemainingTicks:
        snapshot.timers.tierInterpolationRemainingTicks === undefined
          ? undefined
          : normalizeCount(snapshot.timers.tierInterpolationRemainingTicks),
      forcedTierOverride:
        snapshot.timers.forcedTierOverride === undefined
          ? undefined
          : snapshot.timers.forcedTierOverride,
    });
  }

  public grantExtension(snapshot: RunStateSnapshot, extensionMs: number): TimerState {
    const normalizedExtensionMs = normalizeMs(extensionMs);

    return Object.freeze({
      ...snapshot.timers,
      extensionBudgetMs:
        normalizeMs(snapshot.timers.extensionBudgetMs) + normalizedExtensionMs,
      activeDecisionWindows: freezeDecisionWindows(snapshot.timers.activeDecisionWindows),
      frozenWindowIds: freezeArray(snapshot.timers.frozenWindowIds),
    });
  }

  public replaceSeasonBudget(
    snapshot: RunStateSnapshot,
    seasonBudgetMs: number,
  ): TimerState {
    return Object.freeze({
      ...snapshot.timers,
      seasonBudgetMs: normalizeMs(seasonBudgetMs),
      activeDecisionWindows: freezeDecisionWindows(snapshot.timers.activeDecisionWindows),
      frozenWindowIds: freezeArray(snapshot.timers.frozenWindowIds),
    });
  }

  public clearNextTickSchedule(snapshot: RunStateSnapshot): TimerState {
    return Object.freeze({
      ...snapshot.timers,
      nextTickAtMs: null,
      activeDecisionWindows: freezeDecisionWindows(snapshot.timers.activeDecisionWindows),
      frozenWindowIds: freezeArray(snapshot.timers.frozenWindowIds),
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION B — EXTENDED BUDGET ANALYSIS
  // ────────────────────────────────────────────────────────────────────────────

  /** Returns the budget criticality level at current utilization. */
  public getCriticalityLevel(snapshot: RunStateSnapshot): BudgetCriticalityLevel {
    return classifyUtilization(this.getUtilizationPct(snapshot));
  }

  /** Returns a full tick band characterization for the current budget state. */
  public getTickBand(snapshot: RunStateSnapshot, nowMs: number): BudgetTickBand {
    const utilizationPct = this.getUtilizationPct(snapshot);
    const remainingMs = this.getRemainingBudgetMs(snapshot);
    const level = classifyUtilization(utilizationPct);
    const tier = snapshot.pressure.tier;
    const tierUrgency = BUDGET_TIER_URGENCY[tier];
    const phaseScore = BUDGET_PHASE_SCORE[snapshot.phase];

    const velocityMsPerTick = this._trend.getVelocityMsPerTick();
    const projectedExhaustionTick = this._trend.getProjectedExhaustionTick(
      remainingMs, this.getTotalBudgetMs(snapshot),
    );
    const urgencyScore = computeCompositeUrgency(
      tierUrgency, utilizationPct, phaseScore,
      computePressureRiskScore(tier, snapshot.pressure.score),
    );

    void nowMs;

    return Object.freeze({
      level,
      utilizationPct,
      remainingMs,
      projectedExhaustionTick,
      label: criticalityLabel(level),
      urgencyScore,
      chatEmitRecommended: this._chatEmitter.shouldEmit(
        level, this._chatEmitter.getLastEmitLevel(), remainingMs,
      ),
    });
  }

  /** Returns urgency snapshot at the given moment. */
  public getUrgencySnapshot(snapshot: RunStateSnapshot, nowMs: number): BudgetUrgencySnapshot {
    const tier = snapshot.pressure.tier;
    const tickTier = pressureTierToTickTier(tier);
    const utilizationPct = this.getUtilizationPct(snapshot);
    const criticalityLevel = classifyUtilization(utilizationPct);
    const tierUrgency = BUDGET_TIER_URGENCY[tier];
    const phaseScore = BUDGET_PHASE_SCORE[snapshot.phase];
    const modeTempoMultiplier = BUDGET_MODE_TEMPO[snapshot.mode];
    const pressureRisk = computePressureRiskScore(tier, snapshot.pressure.score);
    const compositeUrgency = computeCompositeUrgency(
      tierUrgency, utilizationPct, phaseScore, pressureRisk,
    );

    return Object.freeze({
      tier,
      tickTier,
      utilizationPct,
      criticalityLevel,
      tierUrgency,
      phaseScore,
      modeTempoMultiplier,
      compositeUrgency,
      capturedAtMs: nowMs,
      capturedAtTick: snapshot.tick,
    });
  }

  /** Returns the tick tier configuration for the current pressure tier. */
  public getTickerConfig(snapshot: RunStateSnapshot): TickTierConfig {
    return getTickTierConfigByPressureTier(snapshot.pressure.tier);
  }

  /** Returns the interpolation plan if a tier transition is in progress. */
  public getInterpolationPlan(snapshot: RunStateSnapshot): TickInterpolationPlan | null {
    const interpolating = normalizeCount(snapshot.timers.tierInterpolationRemainingTicks ?? 0);
    if (interpolating <= 0) return null;

    const currentTier = snapshot.pressure.tier;
    const previousTier = snapshot.pressure.previousTier;
    const fromConfig = getTickTierConfigByPressureTier(previousTier);
    const toConfig = getTickTierConfigByPressureTier(currentTier);
    const interpCount = computeInterpolationTickCount(
      Math.abs(toConfig.defaultDurationMs - fromConfig.defaultDurationMs),
    );

    return createInterpolationPlan(
      pressureTierToTickTier(previousTier),
      pressureTierToTickTier(currentTier),
      fromConfig.defaultDurationMs,
      toConfig.defaultDurationMs,
    );
    void interpCount; // used in validation path
  }

  /** Resolves the current run phase from elapsed milliseconds. */
  public resolveCurrentPhase(snapshot: RunStateSnapshot): RunPhase {
    return resolvePhaseFromElapsedMs(this.getElapsedMs(snapshot));
  }

  /** Returns true if an advance to nextElapsedMs will cross a phase boundary. */
  public isPhaseBoundaryNext(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
  ): boolean {
    return isPhaseBoundaryTransition(this.getElapsedMs(snapshot), nextElapsedMs);
  }

  /** Returns the expected default tick duration for a pressure tier. */
  public getExpectedTickDurationMs(tier: PressureTier): number {
    return getDefaultTickDurationMs(tier);
  }

  /** Returns the expected decision window duration for a pressure tier. */
  public getExpectedDecisionWindowMs(tier: PressureTier): number {
    return getDecisionWindowDurationMs(tier);
  }

  /** Returns the tick tier that maps to the given pressure tier. */
  public getTickTierForPressure(tier: PressureTier): TickTier {
    return TICK_TIER_BY_PRESSURE_TIER[tier];
  }

  /** Reverse map: returns pressure tier from tick tier. */
  public getPressureTierForTickTier(tickTier: TickTier): PressureTier {
    return PRESSURE_TIER_BY_TICK_TIER[tickTier];
  }

  /** Returns a validated and clamped tick duration for the given pressure tier. */
  public clampDurationMs(tier: PressureTier, durationMs: number): number {
    return clampTickDurationMs(tier, durationMs);
  }

  /** Normalizes a possibly-null tick duration to the tier default. */
  public normalizeDurationMs(
    tier: PressureTier,
    durationMs: number | null | undefined,
  ): number {
    return normalizeTickDurationMs(tier, durationMs);
  }

  /** Returns the expected tick duration for the current tier from TIER_DURATIONS_MS. */
  public getTierDurationMs(tier: PressureTier): number {
    return TIER_DURATIONS_MS[tier];
  }

  /** Returns the expected decision window for the current tier from DECISION_WINDOW_DURATIONS_MS. */
  public getTierDecisionWindowMs(tier: PressureTier): number {
    return DECISION_WINDOW_DURATIONS_MS[tier];
  }

  /** Estimates how many ticks remain at the current velocity. */
  public estimateRemainingTicks(
    snapshot: RunStateSnapshot,
    overrideTickDurationMs?: number,
  ): number {
    const remainingMs = this.getRemainingBudgetMs(snapshot);
    const tier = snapshot.pressure.tier;
    const defaultDuration = getDefaultTickDurationMs(tier);
    const effectiveDuration = overrideTickDurationMs ?? defaultDuration;
    if (effectiveDuration <= 0) return 0;
    return Math.ceil(remainingMs / effectiveDuration);
  }

  /** Returns a PressureReader-compatible object from snapshot. */
  public getPressureReader(snapshot: RunStateSnapshot): PressureReader {
    return Object.freeze({
      score: clamp01(snapshot.pressure.score),
      tier: snapshot.pressure.tier,
    });
  }

  /** Returns the tick config object for a specific TickTier. */
  public getTickConfig(tickTier: TickTier): TickTierConfig {
    return getTickTierConfig(tickTier);
  }

  /** Returns the full TICK_TIER_CONFIGS map. */
  public getAllTickTierConfigs(): Readonly<typeof TICK_TIER_CONFIGS> {
    return TICK_TIER_CONFIGS;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION C — BATCH PROJECTION
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Projects multiple sequential advances, returning all projections and summary.
   * Stops projecting when budget is exhausted. Useful for planning windows and
   * multi-tick lookahead.
   */
  public projectBatch(
    snapshot: RunStateSnapshot,
    requests: readonly TimeAdvanceRequest[],
  ): BudgetProjectionBatch {
    const projections: TimeBudgetProjection[] = [];
    let currentSnapshot = snapshot;
    let exhaustedAtIndex: number | null = null;
    let totalAdvancedMs = 0;

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      const projection = this.projectAdvance(currentSnapshot, req);
      projections.push(projection);
      totalAdvancedMs += projection.currentTickDurationMs;

      if (projection.budgetExhausted && exhaustedAtIndex === null) {
        exhaustedAtIndex = i;
      }

      // Build a synthetic TimerState to continue projection
      if (i < requests.length - 1) {
        const nextTimers: TimerState = Object.freeze({
          ...currentSnapshot.timers,
          elapsedMs: projection.nextElapsedMs,
          seasonBudgetMs: projection.seasonBudgetMs,
          extensionBudgetMs: projection.extensionBudgetMs,
          currentTickDurationMs: projection.currentTickDurationMs,
          nextTickAtMs: projection.nextTickAtMs,
          activeDecisionWindows: freezeDecisionWindows(currentSnapshot.timers.activeDecisionWindows),
          frozenWindowIds: freezeArray(currentSnapshot.timers.frozenWindowIds),
        });
        // Use a shallow snapshot override (only timers change across batch)
        currentSnapshot = Object.freeze({
          ...currentSnapshot,
          timers: nextTimers,
        });
      }
    }

    const finalProjection = projections[projections.length - 1] ?? this.projectAdvance(
      snapshot,
      { durationMs: 0, nowMs: Date.now() },
    );
    const batchUtilizationPct = finalProjection.utilizationPct;
    const allCanSchedule = projections.every((p) => p.canScheduleNextTick);

    return Object.freeze({
      projections: freezeArray(projections),
      finalProjection,
      totalAdvancedMs,
      exhaustedAtIndex,
      batchUtilizationPct,
      allCanSchedule,
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION D — EXTENSION GRANT
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Creates an extension grant record and applies it to the snapshot timers.
   * Returns both the updated TimerState and the grant record for auditing.
   */
  public createExtensionGrant(
    snapshot: RunStateSnapshot,
    extensionMs: number,
    reason: BudgetExtensionReason,
    nowMs: number,
  ): { timers: TimerState; grant: BudgetExtensionGrant } {
    const normalizedExtensionMs = normalizeMs(extensionMs);
    const previousTotalBudgetMs = this.getTotalBudgetMs(snapshot);
    const timers = this.grantExtension(snapshot, normalizedExtensionMs);
    const newTotalBudgetMs = normalizeMs(timers.seasonBudgetMs) + normalizeMs(timers.extensionBudgetMs);

    const grant: BudgetExtensionGrant = Object.freeze({
      grantId: generateEntryId(),
      extensionMs: normalizedExtensionMs,
      reason,
      grantedAtTick: snapshot.tick,
      grantedAtMs: normalizeMs(nowMs),
      previousTotalBudgetMs,
      newTotalBudgetMs,
    });

    this._sessionTracker.recordExtension(grant);
    this._audit.record({
      entryId: generateEntryId(),
      kind: 'EXTENSION_GRANT',
      tick: snapshot.tick,
      elapsedMs: this.getElapsedMs(snapshot),
      remainingMs: this.getRemainingBudgetMs(snapshot) + normalizedExtensionMs,
      utilizationPct: this.getUtilizationPct(snapshot),
      tier: snapshot.pressure.tier,
      phase: snapshot.phase,
      mode: snapshot.mode,
      durationMs: normalizedExtensionMs,
      notes: freezeArray([`reason:${reason}`, `new_total:${newTotalBudgetMs}ms`]),
      capturedAtMs: normalizeMs(nowMs),
    });

    return { timers, grant };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION E — RISK & RESILIENCE
  // ────────────────────────────────────────────────────────────────────────────

  /** Full risk assessment from current snapshot. */
  public assessRisk(
    snapshot: RunStateSnapshot,
    overrideVelocity?: number,
  ): BudgetRiskAssessment {
    const remainingMs = this.getRemainingBudgetMs(snapshot);
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const tier = snapshot.pressure.tier;
    const currentTickDurationMs = normalizeMs(snapshot.timers.currentTickDurationMs) ||
      getDefaultTickDurationMs(tier);
    const velocity = overrideVelocity ?? this._trend.getVelocityMsPerTick();

    return this._resilience.assessRisk(
      snapshot, remainingMs, totalBudgetMs, velocity, currentTickDurationMs,
    );
  }

  /** Composite resilience score for the current snapshot. */
  public computeResilienceScore(snapshot: RunStateSnapshot): BudgetResilienceScore {
    const remainingMs = this.getRemainingBudgetMs(snapshot);
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const extensionBudgetMs = this.getExtensionBudgetMs(snapshot);
    return this._resilience.score(snapshot, remainingMs, totalBudgetMs, extensionBudgetMs);
  }

  /** Returns resilience scores keyed by all pressure tiers. */
  public getResilienceByTier(snapshot: RunStateSnapshot): BudgetTierResilienceMap {
    return this._resilience.computeResilienceByTier(
      this.getRemainingBudgetMs(snapshot),
      this.getTotalBudgetMs(snapshot),
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION F — ML/DL EXTRACTION
  // ────────────────────────────────────────────────────────────────────────────

  /** Extract a 28-dimensional ML feature vector. */
  public extractMLVector(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): BudgetMLVector {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const remainingMs = this.getRemainingBudgetMs(snapshot);
    const tier = snapshot.pressure.tier;
    const currentTickDurationMs = normalizeMs(snapshot.timers.currentTickDurationMs) ||
      getDefaultTickDurationMs(tier);

    return this._mlExtractor.extract(
      snapshot, totalBudgetMs, remainingMs, currentTickDurationMs, nowMs,
    );
  }

  /** Append a new row to the 40×6 DL tensor ring buffer. */
  public appendDLRow(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): BudgetDLTensor {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const remainingMs = this.getRemainingBudgetMs(snapshot);
    const tier = snapshot.pressure.tier;
    const currentTickDurationMs = normalizeMs(snapshot.timers.currentTickDurationMs) ||
      getDefaultTickDurationMs(tier);

    return this._dlBuilder.append(
      snapshot, totalBudgetMs, remainingMs, currentTickDurationMs, nowMs,
    );
  }

  /** Returns the current DL tensor (null if no rows appended yet). */
  public getCurrentDLTensor(): BudgetDLTensor | null {
    return this._dlBuilder.getCurrent();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION G — CHAT SIGNAL
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Builds a LIVEOPS_SIGNAL ChatInputEnvelope for the current budget state.
   * Only emits when budget criticality changes or crosses a threshold.
   */
  public buildChatSignal(
    snapshot: RunStateSnapshot,
    nowMs: number,
    roomId: Nullable<string> = null,
    forceEmit = false,
  ): BudgetChatEnvelope | null {
    const remainingMs = this.getRemainingBudgetMs(snapshot);
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const criticalityLevel = classifyUtilization(
      totalBudgetMs > 0 ? clamp01((totalBudgetMs - remainingMs) / totalBudgetMs) : 1.0,
    );
    const lastLevel = this._chatEmitter.getLastEmitLevel();

    if (!forceEmit && !this._chatEmitter.shouldEmit(criticalityLevel, lastLevel, remainingMs)) {
      return null;
    }

    const tier = snapshot.pressure.tier;
    const utilizationPct = totalBudgetMs > 0
      ? clamp01((totalBudgetMs - remainingMs) / totalBudgetMs)
      : 1.0;
    const tierUrgency = BUDGET_TIER_URGENCY[tier];
    const phaseScore = BUDGET_PHASE_SCORE[snapshot.phase];
    const pressureRisk = computePressureRiskScore(tier, snapshot.pressure.score);
    const urgencyScore = computeCompositeUrgency(tierUrgency, utilizationPct, phaseScore, pressureRisk);

    const narrative = this._narrator.narrateCurrentState(
      snapshot, remainingMs, totalBudgetMs, criticalityLevel, nowMs,
    );

    const tags: string[] = [
      `tier:${tier}`,
      `phase:${snapshot.phase}`,
      `mode:${snapshot.mode}`,
      `criticality:${criticalityLevel.toLowerCase()}`,
    ];

    const tel = extractTelemetryFeatures(snapshot.telemetry);

    const metadata: Record<string, JsonValue> = {
      tick: snapshot.tick,
      elapsedMs: this.getElapsedMs(snapshot),
      remainingMs,
      utilizationPct: Number(utilizationPct.toFixed(4)),
      urgencyScore: Number(urgencyScore.toFixed(4)),
      avgDecisionLatencyMs: tel.avgLatencyMs,
      emittedEventCount: tel.decisionCount,
    };

    return this._chatEmitter.buildLiveOpsSignal(
      snapshot, criticalityLevel, urgencyScore, remainingMs,
      totalBudgetMs, narrative, nowMs, roomId, freezeArray(tags),
      Object.freeze(metadata),
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION H — NARRATION
  // ────────────────────────────────────────────────────────────────────────────

  /** Returns the current budget state as a human-readable narrative string. */
  public narrateCurrentState(snapshot: RunStateSnapshot, nowMs: number): string {
    const remainingMs = this.getRemainingBudgetMs(snapshot);
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const criticalityLevel = this.getCriticalityLevel(snapshot);
    return this._narrator.narrateCurrentState(
      snapshot, remainingMs, totalBudgetMs, criticalityLevel, nowMs,
    );
  }

  /** Returns a narrative for the full risk assessment. */
  public narrateRisk(snapshot: RunStateSnapshot): string {
    return this._narrator.narrateRiskAssessment(this.assessRisk(snapshot));
  }

  /** Returns an urgency label for the current pressure tier. */
  public getTierUrgencyLabel(tier: PressureTier): string {
    return this._narrator.narrateUrgencyLabel(tier);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION I — MODE & PHASE ADVISORY
  // ────────────────────────────────────────────────────────────────────────────

  /** Returns the budget behavior profile for a specific mode. */
  public getModeProfile(mode: ModeCode): BudgetModeProfile {
    return this._modeAdvisor.getModeProfile(mode);
  }

  /** Returns profiles for all four game modes. */
  public getAllModeProfiles(): Readonly<Record<ModeCode, BudgetModeProfile>> {
    return this._modeAdvisor.getAllModeProfiles();
  }

  /** Returns whether the current mode recommends using a hold charge. */
  public isHoldRecommended(snapshot: RunStateSnapshot): boolean {
    return this._modeAdvisor.isHoldRecommended(
      snapshot.mode,
      normalizeCount(snapshot.timers.holdCharges),
      this.getCriticalityLevel(snapshot),
    );
  }

  /** Returns the budget behavior profile for a specific run phase. */
  public getPhaseProfile(phase: RunPhase, snapshot: RunStateSnapshot): BudgetPhaseProfile {
    return this._phaseAdvisor.getPhaseProfile(phase, this.getTotalBudgetMs(snapshot));
  }

  /** Returns profiles for all three run phases. */
  public getAllPhaseProfiles(snapshot: RunStateSnapshot): Readonly<Record<RunPhase, BudgetPhaseProfile>> {
    return this._phaseAdvisor.getAllPhaseProfiles(this.getTotalBudgetMs(snapshot));
  }

  /** Returns ticks until the next phase transition estimate. */
  public getTicksUntilPhaseTransition(snapshot: RunStateSnapshot): number | null {
    const tier = snapshot.pressure.tier;
    const tickDurationMs = normalizeMs(snapshot.timers.currentTickDurationMs) ||
      getDefaultTickDurationMs(tier);
    return this._phaseAdvisor.getTicksUntilPhaseTransition(
      this.getElapsedMs(snapshot),
      tickDurationMs,
    );
  }

  /** Returns the phase boundary that will be crossed in the next advance, or null. */
  public getNextPhaseBoundary(
    snapshot: RunStateSnapshot,
    nextElapsedMs: number,
  ): PhaseBoundary | null {
    return this._phaseAdvisor.getNextPhaseBoundary(
      this.getElapsedMs(snapshot),
      nextElapsedMs,
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION J — SESSION RECORDING
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Records a tick to the session tracker and audit trail.
   * Call this once per completed tick in the EngineOrchestrator.
   */
  public recordTick(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): void {
    const utilizationPct = this.getUtilizationPct(snapshot);
    const criticalityLevel = classifyUtilization(utilizationPct);
    const tier = snapshot.pressure.tier;
    const tickDurationMs = normalizeMs(snapshot.timers.currentTickDurationMs) ||
      getDefaultTickDurationMs(tier);

    this._sessionTracker.recordTick(snapshot, utilizationPct, tickDurationMs, criticalityLevel);

    // Push to trend analyzer
    this._trend.push({
      tick: snapshot.tick,
      elapsedMs: this.getElapsedMs(snapshot),
      remainingMs: this.getRemainingBudgetMs(snapshot),
      utilizationPct,
      tickDurationMs,
      tier,
      capturedAtMs: normalizeMs(nowMs),
    });

    // Append to audit trail
    this._audit.record({
      entryId: generateEntryId(),
      kind: 'SESSION_TICK',
      tick: snapshot.tick,
      elapsedMs: this.getElapsedMs(snapshot),
      remainingMs: this.getRemainingBudgetMs(snapshot),
      utilizationPct,
      tier,
      phase: snapshot.phase,
      mode: snapshot.mode,
      durationMs: tickDurationMs,
      notes: freezeArray([`tick:${snapshot.tick}`, `tier:${tier}`]),
      capturedAtMs: normalizeMs(nowMs),
    });
  }

  /**
   * Records a run outcome to the session tracker.
   * Call this when the run produces a terminal outcome.
   */
  public recordOutcome(snapshot: RunStateSnapshot, outcome: RunOutcome): void {
    this._sessionTracker.recordOutcome(outcome, snapshot.mode);
    const isWin = isWinOutcome(outcome);
    const isLoss = isLossOutcome(outcome);

    this._audit.record({
      entryId: generateEntryId(),
      kind: isWin || isLoss ? 'EXHAUSTED' : 'ADVANCE',
      tick: snapshot.tick,
      elapsedMs: this.getElapsedMs(snapshot),
      remainingMs: this.getRemainingBudgetMs(snapshot),
      utilizationPct: this.getUtilizationPct(snapshot),
      tier: snapshot.pressure.tier,
      phase: snapshot.phase,
      mode: snapshot.mode,
      durationMs: 0,
      notes: freezeArray([`outcome:${outcome}`, `mode:${snapshot.mode}`]),
      capturedAtMs: Date.now(),
    });
  }

  /** Returns session analytics for the current run. */
  public getSessionAnalytics(): BudgetSessionAnalytics {
    return this._sessionTracker.getAnalytics();
  }

  /** Returns the current trend vector. */
  public getTrendVector(snapshot: RunStateSnapshot): BudgetTrendVector {
    return this._trend.getTrendVector(
      this.getRemainingBudgetMs(snapshot),
      this.getTotalBudgetMs(snapshot),
    );
  }

  /** Returns the full audit trail. */
  public getAuditTrail(): readonly BudgetAuditEntry[] {
    return this._audit.getAll();
  }

  /** Returns the audit trail summary. */
  public getAuditSummary(): BudgetAuditSummary {
    return this._audit.exportSummary();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION K — EXPORT BUNDLE
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Produces the full export bundle for persistence, replay, and ML ingestion.
   * Aggregates ML vector, DL tensor, resilience, risk, trend, session analytics,
   * and audit summary into a single frozen record.
   */
  public exportBundle(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): BudgetExportBundle {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const remainingMs = this.getRemainingBudgetMs(snapshot);
    const elapsedMs = this.getElapsedMs(snapshot);
    const utilizationPct = totalBudgetMs > 0
      ? clamp01(elapsedMs / totalBudgetMs)
      : 1.0;
    const criticalityLevel = classifyUtilization(utilizationPct);

    const mlVector = this.extractMLVector(snapshot, nowMs);
    const dlTensor = this.appendDLRow(snapshot, nowMs);
    const resilienceScore = this.computeResilienceScore(snapshot);
    const riskAssessment = this.assessRisk(snapshot);
    const trendVector = this.getTrendVector(snapshot);
    const sessionAnalytics = this.getSessionAnalytics();
    const auditSummary = this.getAuditSummary();
    const narrative = this.narrateCurrentState(snapshot, nowMs);

    return Object.freeze({
      version: BUDGET_SERVICE_VERSION,
      snapshot: Object.freeze({
        tick: snapshot.tick,
        phase: snapshot.phase,
        tier: snapshot.pressure.tier,
        mode: snapshot.mode,
        elapsedMs,
        remainingMs,
        utilizationPct,
        criticalityLevel,
      }),
      mlVector,
      dlTensor,
      resilienceScore,
      riskAssessment,
      trendVector,
      sessionAnalytics,
      auditSummary,
      narrative,
      exportedAtMs: asUnixMs(nowMs),
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SECTION L — RESET
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Resets all sub-systems to their initial state.
   * Call this at run start or when a new run is initialized.
   */
  public reset(): void {
    this._audit.reset();
    this._trend.reset();
    this._dlBuilder.reset();
    this._chatEmitter.reset();
    this._sessionTracker.reset();
  }
}

/* ============================================================================
 * § 28 — FACTORY FUNCTIONS
 * ============================================================================ */

/**
 * Factory: creates a fully initialized TimeBudgetService.
 * All sub-systems begin in a clean reset state.
 */
export function createTimeBudgetService(): TimeBudgetService {
  return new TimeBudgetService();
}

/**
 * Factory: creates a BudgetAuditTrail with pre-loaded entries.
 * Useful for hydrating from a persisted audit log.
 */
export function createBudgetAuditTrailFromEntries(
  entries: readonly BudgetAuditEntry[],
): BudgetAuditTrail {
  const trail = new BudgetAuditTrail();
  for (const entry of entries) {
    trail.record(entry);
  }
  return trail;
}

/**
 * Factory: creates a BudgetTrendAnalyzer with pre-loaded history.
 * Useful for resuming a run from a checkpoint.
 */
export function createBudgetTrendAnalyzerFromHistory(
  entries: readonly BudgetTrendEntry[],
): BudgetTrendAnalyzer {
  const analyzer = new BudgetTrendAnalyzer();
  for (const entry of entries) {
    analyzer.push(entry);
  }
  return analyzer;
}

/**
 * Factory: creates a BudgetExtensionGrant record.
 * Used by extension grant callers that don't have access to the full service.
 */
export function createBudgetExtensionGrant(
  extensionMs: number,
  reason: BudgetExtensionReason,
  tick: number,
  nowMs: number,
  previousTotalBudgetMs: number,
): BudgetExtensionGrant {
  return Object.freeze({
    grantId: generateEntryId(),
    extensionMs: normalizeMs(extensionMs),
    reason,
    grantedAtTick: tick,
    grantedAtMs: normalizeMs(nowMs),
    previousTotalBudgetMs: normalizeMs(previousTotalBudgetMs),
    newTotalBudgetMs: normalizeMs(previousTotalBudgetMs + extensionMs),
  });
}

/* ============================================================================
 * § 29 — PURE HELPER EXPORTS
 * ============================================================================ */

/**
 * Returns the budget criticality level for a given utilization percentage.
 * Pure function — no class instantiation required.
 */
export function getBudgetCriticalityLevel(utilizationPct: number): BudgetCriticalityLevel {
  return classifyUtilization(utilizationPct);
}

/**
 * Returns the tier urgency score (0.0–1.0) for a given pressure tier.
 * Pure function backed by BUDGET_TIER_URGENCY.
 */
export function getBudgetTierUrgency(tier: PressureTier): number {
  return BUDGET_TIER_URGENCY[tier];
}

/**
 * Returns the phase score (0.0–1.0) for a given run phase.
 * Pure function backed by BUDGET_PHASE_SCORE.
 */
export function getBudgetPhaseScore(phase: RunPhase): number {
  return BUDGET_PHASE_SCORE[phase];
}

/**
 * Returns the mode tempo multiplier for a given mode code.
 * Pure function backed by BUDGET_MODE_TEMPO.
 */
export function getBudgetModeTempo(mode: ModeCode): number {
  return BUDGET_MODE_TEMPO[mode];
}

/**
 * Computes a composite urgency score (0.0–1.0) from tier, utilization,
 * phase, and pressure risk. Pure function.
 */
export function computeBudgetCompositeUrgency(
  tier: PressureTier,
  utilizationPct: number,
  phase: RunPhase,
  pressureScore: number,
): number {
  const tierUrgency = BUDGET_TIER_URGENCY[tier];
  const phaseScore = BUDGET_PHASE_SCORE[phase];
  const pressureRisk = computePressureRiskScore(tier, pressureScore);
  return computeCompositeUrgency(tierUrgency, utilizationPct, phaseScore, pressureRisk);
}

/**
 * Returns true if the budget is in the warning zone (>= 70% consumed).
 * Pure function.
 */
export function isBudgetInWarningZone(utilizationPct: number): boolean {
  return utilizationPct >= BUDGET_THRESHOLDS.WARNING_PCT;
}

/**
 * Returns true if the budget is critically low (>= 90% consumed).
 * Pure function.
 */
export function isBudgetInCriticalZone(utilizationPct: number): boolean {
  return utilizationPct >= BUDGET_THRESHOLDS.CRITICAL_PCT;
}

/**
 * Returns true if the budget utilization fraction is near-exhausted (>= 97%).
 * Takes a raw utilization fraction (0–1), not a TimeBudgetProjection.
 * Pure function.
 */
export function isBudgetNearExhaustionByPct(utilizationPct: number): boolean {
  return utilizationPct >= BUDGET_THRESHOLDS.EXHAUST_PCT;
}

/**
 * Returns the remaining budget clamp score normalized to MAX_BUDGET_MS.
 * Pure function.
 */
export function normalizeBudgetRemainingMs(remainingMs: number): number {
  return clamp01(remainingMs / BUDGET_MAX_BUDGET_MS);
}

/**
 * Returns the normalized run progress fraction for ML features.
 * Delegates to GamePrimitives computeRunProgressFraction.
 */
export function computeBudgetRunProgress(
  phase: RunPhase,
  tickInPhase: number,
  phaseTickBudget: number,
): number {
  return computeRunProgressFraction(phase, tickInPhase, phaseTickBudget);
}

/**
 * Returns true if the current snapshot tier is a tick-tier collision tier.
 * T4 maps to COLLAPSE_IMMINENT and triggers screen shake.
 */
export function isBudgetCollapseTier(tier: PressureTier): boolean {
  return pressureTierToTickTier(tier) === TickTier.COLLAPSE_IMMINENT;
}

/**
 * Returns the reverse-mapped PressureTier from a TickTier value.
 * Pure function backed by PRESSURE_TIER_BY_TICK_TIER.
 */
export function getPressureTierFromTickTier(tickTier: TickTier): PressureTier {
  return tickTierToPressureTier(tickTier);
}

/**
 * Returns the TICK_TIER_CONFIGS entry for a given pressure tier.
 * Pure function backed by TICK_TIER_BY_PRESSURE_TIER + TICK_TIER_CONFIGS.
 */
export function getTickTierConfigForPressure(tier: PressureTier): TickTierConfig {
  return getTickTierConfigByPressureTier(tier);
}

/**
 * Validates that a TimeBudgetProjection is internally consistent.
 * Returns true if the projection is valid, false otherwise.
 */
export function validateTimeBudgetProjection(p: TimeBudgetProjection): boolean {
  if (!Number.isFinite(p.totalBudgetMs) || p.totalBudgetMs < 0) return false;
  if (!Number.isFinite(p.consumedBudgetMs) || p.consumedBudgetMs < 0) return false;
  if (!Number.isFinite(p.remainingBudgetMs) || p.remainingBudgetMs < 0) return false;
  if (p.utilizationPct < 0 || p.utilizationPct > 1) return false;
  if (p.remainingBudgetMs > p.totalBudgetMs) return false;
  return true;
}

/**
 * Validates a TimeAdvanceRequest for correctness.
 * Returns true if the request is valid.
 */
export function validateTimeAdvanceRequest(req: TimeAdvanceRequest): boolean {
  return (
    typeof req.durationMs === 'number' &&
    Number.isFinite(req.durationMs) &&
    req.durationMs > 0 &&
    typeof req.nowMs === 'number' &&
    Number.isFinite(req.nowMs)
  );
}

/**
 * Returns a clamp100 score for utilization percentage (0–100 range).
 * Used for chat display and UI urgency meters.
 */
export function budgetUtilizationToScore100(utilizationPct: number): number {
  return clamp100(utilizationPct * 100);
}

/**
 * Returns the effective stakes for a given phase and mode combination.
 * Pure function backed by GamePrimitives computeEffectiveStakes.
 */
export function computeBudgetEffectiveStakes(phase: RunPhase, mode: ModeCode): number {
  return computeEffectiveStakes(phase, mode);
}

/**
 * Returns whether the budget run outcome is a terminal win (FREEDOM).
 * Pure function backed by GamePrimitives isWinOutcome.
 */
export function isBudgetRunWin(outcome: RunOutcome): boolean {
  return isWinOutcome(outcome);
}

/**
 * Returns whether the budget run outcome is a terminal loss.
 * Pure function backed by GamePrimitives isLossOutcome.
 */
export function isBudgetRunLoss(outcome: RunOutcome): boolean {
  return isLossOutcome(outcome);
}

/* ============================================================================
 * § 30 — MANIFEST
 * ============================================================================ */

/** Canonical export manifest for the TimeBudgetService module. */
export const BUDGET_SERVICE_MANIFEST = Object.freeze({
  version: BUDGET_SERVICE_VERSION,
  mlDim: BUDGET_ML_DIM,
  dlRowCount: BUDGET_DL_ROW_COUNT,
  dlColCount: BUDGET_DL_COL_COUNT,
  auditMaxEntries: BUDGET_AUDIT_MAX_ENTRIES,
  trendHistoryDepth: BUDGET_TREND_HISTORY_DEPTH,
  dlRingCapacity: BUDGET_DL_RING_CAPACITY,
  mlFeatureLabels: BUDGET_ML_FEATURE_LABELS,
  dlColLabels: BUDGET_DL_COL_LABELS,
  extensionReasons: BUDGET_EXTENSION_REASONS,
  thresholds: BUDGET_THRESHOLDS,
  maxBudgetMs: BUDGET_MAX_BUDGET_MS,
  maxTickDurationMs: BUDGET_MAX_TICK_DURATION_MS,
  maxDecisionWindowMs: BUDGET_MAX_DECISION_WINDOW_MS,
  resilienceWeights: BUDGET_RESILIENCE_WEIGHTS,
  subSystems: Object.freeze([
    'BudgetAuditTrail',
    'BudgetTrendAnalyzer',
    'BudgetResilienceScorer',
    'BudgetMLExtractor',
    'BudgetDLBuilder',
    'BudgetChatEmitter',
    'BudgetNarrator',
    'BudgetModeAdvisor',
    'BudgetPhaseAdvisor',
    'BudgetSessionTracker',
  ] as const),
  ready: true,
} as const);
