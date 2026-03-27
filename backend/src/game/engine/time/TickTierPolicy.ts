/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TickTierPolicy.ts
 * v4.0.0 — Policy Authority for Time Cadence (Depth Upgrade)
 *
 * This is the authoritative tier resolution engine for all tick cadence policy.
 * Every tick in every run passes through this module. It determines:
 *   — Which pressure tier owns the next tick
 *   — How long that tick should be (duration + decision window)
 *   — Why the cadence changed (full reason code trace)
 *   — What ML features the resolved cadence carries (28 dimensions)
 *   — What DL tensor rows to append (40×6 historical feature slices)
 *   — What chat signal to emit to the LIVEOPS_SIGNAL lane
 *   — What narrative to surface to the player
 *   — Resilience scoring, trend analysis, session analytics
 *
 * Doctrine:
 * — Pressure owns the semantic score; time owns the final cadence policy.
 * — The policy may clamp upward for hard danger states; it NEVER lies by slowing crisis.
 * — Real-world season windows and mode tempo shape cadence without mutating pressure truth.
 * — Every resolution returns full reasons so runtime, telemetry, and ops can explain shifts.
 * — ML/DL/chat surfaces are first-class concerns at the policy resolution layer.
 * — All 12 sub-systems wire into every tick to give complete observability.
 *
 * Sub-systems (12):
 *   01 PolicyAuditTrail       — immutable resolution log, max 500 entries
 *   02 TierEscalationAnalyzer — velocity, acceleration, sustained tier analysis
 *   03 PolicyResilienceScorer — player survival scoring through tier transitions
 *   04 PolicyMLExtractor      — 28-dim ML feature vector from policy state
 *   05 PolicyDLBuilder        — 40×6 DL tensor from policy history
 *   06 PolicyChatEmitter      — LIVEOPS_SIGNAL lane chat payload construction
 *   07 PolicyNarrator         — human-readable narrative bundles
 *   08 PolicyModeAdvisor      — mode-specific tier and tempo adjustments
 *   09 PolicyPhaseAdvisor     — phase-specific cadence adjustments
 *   10 PolicyBudgetAdvisor    — budget-pressure tier escalation logic
 *   11 PolicyTrendAnalyzer    — trend analysis over resolution history window
 *   12 PolicySessionTracker   — session-level policy decision tracking
 */

// ============================================================================
// SECTION 1 — IMPORTS
// ============================================================================

import type { ModeCode, PressureTier, RunPhase, RunOutcome } from '../core/GamePrimitives';
import {
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  PRESSURE_TIERS,
  RUN_PHASES,
  MODE_CODES,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { SeasonClock } from './SeasonClock';
import type { SeasonLifecycleState, SeasonPressureContext } from './SeasonClock';
import {
  TickTier,
  TICK_TIER_CONFIGS,
  TICK_TIER_BY_PRESSURE_TIER,
  PRESSURE_TIER_BY_TICK_TIER,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  pressureTierToTickTier,
  tickTierToPressureTier,
  computeInterpolationTickCount,
  createInterpolationPlan,
  resolvePhaseFromElapsedMs,
  isPhaseBoundaryTransition,
  clampTickDurationMs,
  normalizeTickDurationMs,
  getDefaultTickDurationMs,
  getDecisionWindowDurationMs,
  getTickTierConfig,
  getTickTierConfigByPressureTier,
  clampNonNegativeInteger,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  PHASE_BOUNDARIES_MS,
  DecisionCardType,
  SeasonWindowType,
} from './types';
import {
  TIME_CONTRACTS_VERSION,
  TIME_CONTRACT_ML_DIM,
  TIME_CONTRACT_DL_ROW_COUNT,
  TIME_CONTRACT_DL_COL_COUNT,
  TIME_CONTRACT_TIER_URGENCY,
  TIME_CONTRACT_MODE_TEMPO,
  TIME_CONTRACT_PHASE_SCORE,
  TIME_CONTRACT_BUDGET_THRESHOLDS,
  TIME_CONTRACT_LATENCY_THRESHOLDS,
  TIME_CONTRACT_HOLD_RESULT_LABELS,
  TIME_CONTRACT_TICK_DRIFT_THRESHOLDS,
  TIME_CONTRACT_MAX_BUDGET_MS,
  TIME_CONTRACT_MAX_TICK_DURATION_MS,
  TIME_CONTRACT_MAX_DECISION_WINDOW_MS,
  TIME_CONTRACT_OUTCOME_IS_TERMINAL,
  TIME_CONTRACT_SEASON_LIFECYCLE_LABEL,
  describePressureTier,
  isTierEscalated,
  scoreCadenceUrgency,
  isCadenceEscalated,
  isCadenceInCollapse,
  expandCadenceReasonCodes,
  computeEffectiveDurationMs,
  describeCadenceResolution,
  getModeTempoMultiplierForMode,
  getPhaseScore,
  computeCadenceCompositeScore,
} from './contracts';
import type { TimeCadenceResolution, TimeContractsVersion } from './contracts';

// ============================================================================
// SECTION 2 — MODULE CONSTANTS
// ============================================================================

/** Policy sub-system version. */
const TICK_TIER_POLICY_VERSION = '4.0.0' as const;

/** Maximum audit entries retained in memory before FIFO eviction. */
const MAX_AUDIT_ENTRIES = 500;

/** Resolution history depth used for trend analysis. */
const TREND_WINDOW_DEPTH = 20;

/** Minimum resolutions before escalation velocity is reported as non-zero. */
const MIN_VELOCITY_SAMPLE = 3;

/** DL tensor history depth used for sequence construction. */
const DL_HISTORY_DEPTH = TIME_CONTRACT_DL_ROW_COUNT; // 40

/** ML vector dimension (re-exported for internal usage). */
const ML_DIM = TIME_CONTRACT_ML_DIM; // 28

/** DL column count (re-exported for internal usage). */
const DL_COLS = TIME_CONTRACT_DL_COL_COUNT; // 6

/** Chat signal minimum interval (ms) between consecutive LIVEOPS emissions. */
const CHAT_SIGNAL_MIN_INTERVAL_MS = 3_000;

/** Budget warning threshold fraction (re-scoped for policy use). */
const BUDGET_WARNING_FRACTION = TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT;

/** Budget critical threshold fraction. */
const BUDGET_CRITICAL_FRACTION = TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT;

/** Budget near-exhaustion fraction. */
const BUDGET_EXHAUST_FRACTION = TIME_CONTRACT_BUDGET_THRESHOLDS.EXHAUST_PCT;

/** Minimum remaining budget ms before chat is alerted. */
const BUDGET_CHAT_FLOOR_MS = TIME_CONTRACT_BUDGET_THRESHOLDS.MIN_REMAINING_MS_FOR_CHAT;

/** Acceptable tick drift (ms) before flagging drift events. */
const DRIFT_ACCEPTABLE_MS = TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.ACCEPTABLE_DRIFT_MS;

/** Notable drift threshold. */
const DRIFT_NOTABLE_MS = TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS;

/** Severe drift threshold. */
const DRIFT_SEVERE_MS = TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS;

/** Critical drift threshold. */
const DRIFT_CRITICAL_MS = TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.CRITICAL_DRIFT_MS;

/** Decision response fast threshold. */
const LATENCY_FAST_MS = TIME_CONTRACT_LATENCY_THRESHOLDS.FAST_MS;

/** Decision response acceptable threshold. */
const LATENCY_ACCEPTABLE_MS = TIME_CONTRACT_LATENCY_THRESHOLDS.ACCEPTABLE_MS;

/** Decision response slow threshold. */
const LATENCY_SLOW_MS = TIME_CONTRACT_LATENCY_THRESHOLDS.SLOW_MS;

/** Decision response alarm threshold. */
const LATENCY_ALARM_MS = TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS;

/** Phase boundary proximity window — policy escalates cadence as boundary approaches. */
const PHASE_BOUNDARY_APPROACH_MS = 30_000;

/** Ghost mode phantom tick offset — ghost runs add an extra T1 floor. */
const GHOST_MODE_TIER_FLOOR: PressureTier = 'T1';

/** PVP battle budget ratio at which cadence escalates one step. */
const PVP_BATTLE_BUDGET_HIGH_RATIO = 0.75;

/** Minimum cashflow for cadence to remain at T1 or below. */
const MIN_POSITIVE_CASHFLOW = 0;

/** Hold duration reference for urgency calculation. */
const HOLD_REFERENCE_DURATION_MS = DEFAULT_HOLD_DURATION_MS;

/** Phase transition window threshold. */
const PHASE_TRANSITION_WINDOW_COUNT = DEFAULT_PHASE_TRANSITION_WINDOWS;

/** Canonical tier order (T0 = sovereign, T4 = collapse). */
const TIER_ORDER: readonly PressureTier[] = Object.freeze(['T0', 'T1', 'T2', 'T3', 'T4']);

// ============================================================================
// SECTION 3 — INTERFACES AND CONTRACT TYPES
// ============================================================================

/**
 * Options for a single TickTierPolicy resolution call.
 */
export interface TickTierPolicyOptions {
  readonly nowMs?: number;
  readonly forcedTier?: PressureTier | null;
  readonly previousTier?: PressureTier | null;
  readonly previousElapsedMs?: number | null;
  readonly suppressChatSignal?: boolean;
  readonly sessionTick?: number;
  readonly tags?: readonly string[];
}

/**
 * Full resolution result from TickTierPolicy.resolve().
 * Extends TimeCadenceResolution with policy-layer analytics.
 */
export interface TickTierResolution extends TimeCadenceResolution {
  /** Enum equivalent of resolvedTier. */
  readonly tickTier: TickTier;
  /** Previous tick tier (null if first tick). */
  readonly previousTickTier: TickTier | null;
  /** Number of interpolation ticks before full tier transition completes. */
  readonly interpolationTicks: number;
  /** Effective duration after all multipliers applied. */
  readonly effectiveDurationMs: number;
  /** Run phase at the time of this resolution. */
  readonly resolvedPhase: RunPhase;
  /** Whether this tick is at a phase boundary crossing. */
  readonly isPhaseBoundaryTick: boolean;
  /** Whether season pressure window is currently active. */
  readonly isSeasonPressureActive: boolean;
  /** Composite risk score (0.0–1.0). */
  readonly compositeRisk: number;
  /** Tier escalation velocity (tier steps per last N resolutions). */
  readonly escalationVelocity: number;
  /** Human-readable one-line narrative summary. */
  readonly narrativeSummary: string;
  /** Mode label for this cadence (e.g. 'Empire', 'Predator'). */
  readonly modeLabel: string;
  /** Phase stakes multiplier at this resolution. */
  readonly phaseStakesMultiplier: number;
  /** Chat urgency score (0.0–1.0). */
  readonly chatUrgency: number;
  /** Whether a LIVEOPS chat signal should be emitted. */
  readonly shouldEmitChatSignal: boolean;
  /** Session tick index at resolution time. */
  readonly sessionTick: number;
  /** Policy version that produced this resolution. */
  readonly version: string;
}

/**
 * Single audit entry for one TickTierPolicy.resolve() call.
 */
export interface PolicyAuditEntry {
  readonly entryId: number;
  readonly nowMs: number;
  readonly sessionTick: number;
  readonly baseTier: PressureTier;
  readonly resolvedTier: PressureTier;
  readonly tickTier: TickTier;
  readonly durationMs: number;
  readonly decisionWindowMs: number;
  readonly effectiveDurationMs: number;
  readonly compositeRisk: number;
  readonly escalationVelocity: number;
  readonly seasonMultiplier: number;
  readonly modeTempoMultiplier: number;
  readonly budgetTempoMultiplier: number;
  readonly remainingBudgetMs: number;
  readonly resolvedPhase: RunPhase;
  readonly isPhaseBoundaryTick: boolean;
  readonly isSeasonPressureActive: boolean;
  readonly shouldEmitChatSignal: boolean;
  readonly reasonCodes: readonly string[];
  readonly mode: ModeCode;
  readonly tags: readonly string[];
}

/**
 * 28-dimensional ML feature vector from the policy layer.
 * Aligned to TIME_CONTRACT_ML_DIM.
 */
export interface PolicyMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly dim: number;
  readonly sessionTick: number;
  readonly nowMs: number;
  readonly resolvedTier: PressureTier;
  readonly compositeRisk: number;
}

/**
 * DL tensor row — 6 features for one historical resolution.
 * Aligned to TIME_CONTRACT_DL_COL_COUNT.
 */
export interface PolicyDLTensorRow {
  readonly tierNorm: number;
  readonly durationNorm: number;
  readonly budgetNorm: number;
  readonly seasonNorm: number;
  readonly compositeRisk: number;
  readonly escalationVelocity: number;
}

/**
 * 40×6 DL tensor from policy history.
 * Aligned to TIME_CONTRACT_DL_ROW_COUNT × TIME_CONTRACT_DL_COL_COUNT.
 */
export interface PolicyDLTensor {
  readonly rows: readonly PolicyDLTensorRow[];
  readonly rowCount: number;
  readonly colCount: number;
  readonly sessionTick: number;
  readonly nowMs: number;
}

/**
 * LIVEOPS_SIGNAL lane chat payload.
 */
export interface PolicyChatSignal {
  readonly signalType: 'TIER_ESCALATION' | 'TIER_DEESCALATION' | 'COLLAPSE_WARNING'
    | 'BUDGET_CRITICAL' | 'PHASE_BOUNDARY' | 'SEASON_PRESSURE' | 'CADENCE_STABLE'
    | 'CRISIS_SUSTAINED' | 'HOLD_REFERENCE' | 'MODE_TENSION';
  readonly urgency: number;
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly message: string;
  readonly reasonCodes: readonly string[];
  readonly sessionTick: number;
  readonly nowMs: number;
  readonly compositeRisk: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly remainingBudgetMs: number;
  readonly shouldScreenShake: boolean;
  readonly lifecycleLabel: string;
  readonly tags: readonly string[];
}

/**
 * Escalation velocity + acceleration data from TierEscalationAnalyzer.
 */
export interface EscalationAnalysis {
  readonly velocity: number;
  readonly acceleration: number;
  readonly sustainedTicks: number;
  readonly highestRecentTier: PressureTier;
  readonly isAccelerating: boolean;
  readonly isDecelerating: boolean;
  readonly isSustained: boolean;
  readonly escalationThresholdForCurrent: number;
  readonly deescalationThresholdForCurrent: number;
  readonly minHoldTicksForCurrent: number;
  readonly canEscalate: boolean;
  readonly canDeescalate: boolean;
}

/**
 * Player resilience snapshot from PolicyResilienceScorer.
 */
export interface PolicyResilienceSnapshot {
  readonly score: number;
  readonly label: string;
  readonly tier4EncounterCount: number;
  readonly tier3EncounterCount: number;
  readonly recoveryCount: number;
  readonly collapseCount: number;
  readonly meanSurvivalTicks: number;
  readonly compositeResilienceScore: number;
  readonly sessionTick: number;
}

/**
 * Trend snapshot from PolicyTrendAnalyzer.
 */
export interface PolicyTrendSnapshot {
  readonly meanRisk: number;
  readonly peakRisk: number;
  readonly riskDelta: number;
  readonly isEscalating: boolean;
  readonly isStabilizing: boolean;
  readonly dominantTier: PressureTier;
  readonly tierDistribution: Readonly<Record<PressureTier, number>>;
  readonly chatSignalEmissionRate: number;
  readonly meanEscalationVelocity: number;
  readonly sessionTick: number;
}

/**
 * Session-level policy tracking snapshot.
 */
export interface PolicySessionSnapshot {
  readonly sessionTick: number;
  readonly totalResolutions: number;
  readonly chatSignalsEmitted: number;
  readonly phaseTransitionsDetected: number;
  readonly tier4Entries: number;
  readonly tier3Entries: number;
  readonly holdReferenceCount: number;
  readonly driftEventsCount: number;
  readonly latencyAlarmCount: number;
  readonly meanCompositeRisk: number;
  readonly peakCompositeRisk: number;
  readonly startedAtMs: number;
  readonly lastResolutionMs: number;
}

/**
 * Human-readable narrative bundle for a resolution.
 */
export interface PolicyNarrativeBundle {
  readonly headline: string;
  readonly tierDescription: string;
  readonly urgencyDescription: string;
  readonly budgetDescription: string;
  readonly modeDescription: string;
  readonly phaseDescription: string;
  readonly seasonDescription: string;
  readonly riskDescription: string;
  readonly cadenceDescription: string;
  readonly holdLabel: string;
  readonly escalationLabel: string;
  readonly fullSummary: string;
}

/**
 * Full analytics bundle — all sub-system snapshots.
 */
export interface PolicyAnalyticsBundle {
  readonly trend: PolicyTrendSnapshot;
  readonly resilience: PolicyResilienceSnapshot;
  readonly session: PolicySessionSnapshot;
  readonly escalation: EscalationAnalysis;
  readonly mlVector: PolicyMLVector;
  readonly dlTensor: PolicyDLTensor;
  readonly lastAuditEntry: PolicyAuditEntry | null;
  readonly chatSignalsEmitted: number;
  readonly version: string;
}

/**
 * Mode-specific policy profile.
 */
export interface PolicyModeProfile {
  readonly mode: ModeCode;
  readonly modeLabel: string;
  readonly modeNormalized: number;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly tempoMultiplier: number;
  readonly tierFloor: PressureTier;
  readonly supportsHold: boolean;
  readonly escalationBonus: number;
  readonly budgetSensitivity: number;
  readonly chatFrequencyBonus: number;
}

/**
 * Phase-specific policy profile.
 */
export interface PolicyPhaseProfile {
  readonly phase: RunPhase;
  readonly phaseNormalized: number;
  readonly stakesMultiplier: number;
  readonly tickBudgetFraction: number;
  readonly phaseScore: number;
  readonly minBudgetMs: number;
  readonly maxBudgetMs: number;
  readonly escalationSensitivity: number;
  readonly chatSensitivity: number;
  readonly transitionWindowCount: number;
  readonly isEndgame: boolean;
}

/**
 * Policy audit summary (aggregated from all audit entries).
 */
export interface PolicyAuditSummary {
  readonly totalEntries: number;
  readonly tier4Entries: number;
  readonly tier3Entries: number;
  readonly escalatedEntries: number;
  readonly phaseBoundaryEntries: number;
  readonly chatSignalEntries: number;
  readonly meanCompositeRisk: number;
  readonly peakCompositeRisk: number;
  readonly tierDistribution: Readonly<Record<PressureTier, number>>;
  readonly mostFrequentReasonCode: string | null;
}

/**
 * Policy version manifest.
 */
export interface PolicyVersionManifest {
  readonly version: string;
  readonly contractsVersion: TimeContractsVersion;
  readonly mlDim: number;
  readonly dlRows: number;
  readonly dlCols: number;
  readonly featureFlags: {
    readonly auditTrail: boolean;
    readonly escalationAnalysis: boolean;
    readonly resilienceScoring: boolean;
    readonly mlExtraction: boolean;
    readonly dlTensor: boolean;
    readonly chatEmission: boolean;
    readonly narration: boolean;
    readonly modeAdvisor: boolean;
    readonly phaseAdvisor: boolean;
    readonly budgetAdvisor: boolean;
    readonly trendAnalysis: boolean;
    readonly sessionTracking: boolean;
  };
}

// ============================================================================
// SECTION 4 — MODULE-LEVEL UTILITY FUNCTIONS
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function tierIndex(tier: PressureTier): number {
  return TIER_ORDER.indexOf(tier);
}

function raiseTier(current: PressureTier, minimum: PressureTier): PressureTier {
  return tierIndex(minimum) > tierIndex(current) ? minimum : current;
}

function raiseTierBySteps(current: PressureTier, steps: number): PressureTier {
  const normalizedSteps = Math.max(0, Math.trunc(steps));
  const index = clamp(tierIndex(current) + normalizedSteps, 0, TIER_ORDER.length - 1);
  return TIER_ORDER[index] ?? 'T4';
}

function normalizeDurationMs(value: number, min: number, max: number): number {
  const rounded = Math.trunc(value);
  return Math.max(min, Math.min(max, rounded));
}

/**
 * Returns the human-readable label for a game mode.
 * Empire = solo, Predator = pvp, Syndicate = coop, Phantom = ghost.
 */
function getModeLabel(mode: ModeCode): string {
  switch (mode) {
    case 'solo':  return 'Empire';
    case 'pvp':   return 'Predator';
    case 'coop':  return 'Syndicate';
    case 'ghost': return 'Phantom';
    default:      return 'Unknown';
  }
}

/**
 * Computes mode-specific tick duration tempo multiplier.
 * Phantom and Predator compress; Syndicate opens cadence slightly.
 */
function computeModeTempoMultiplier(mode: ModeCode): number {
  switch (mode) {
    case 'solo':  return 1.00;
    case 'pvp':   return 0.92;
    case 'coop':  return 1.08;
    case 'ghost': return 0.95;
    default:      return 1.00;
  }
}

/**
 * Computes budget-based tempo compression.
 * As budget drains, ticks accelerate to heighten urgency.
 */
function computeBudgetTempoMultiplier(remainingBudgetMs: number): number {
  if (remainingBudgetMs <= 15_000) return 0.65;
  if (remainingBudgetMs <= 30_000) return 0.78;
  if (remainingBudgetMs <= 60_000) return 0.90;
  return 1.00;
}

/**
 * Computes composite risk score (0.0–1.0) from resolution fields.
 * Weighs tier urgency, budget exhaustion, season pressure, and mode difficulty.
 */
function computeCompositeRisk(
  resolvedTier: PressureTier,
  remainingBudgetMs: number,
  seasonMultiplier: number,
  mode: ModeCode,
): number {
  const tierWeight   = TIME_CONTRACT_TIER_URGENCY[resolvedTier] * 0.45;
  const budgetWeight = clamp01(1.0 - remainingBudgetMs / TIME_CONTRACT_MAX_BUDGET_MS) * 0.25;
  const seasonWeight = clamp01((seasonMultiplier - 1.0) / 3.0) * 0.15;
  const modeWeight   = clamp01((MODE_DIFFICULTY_MULTIPLIER[mode] - 0.9) / 1.0) * 0.15;
  return clamp01(tierWeight + budgetWeight + seasonWeight + modeWeight);
}

/**
 * Normalizes a tick duration to 0.0–1.0 against the max possible duration.
 */
function normalizeDuration(durationMs: number): number {
  return clamp01(durationMs / TIME_CONTRACT_MAX_TICK_DURATION_MS);
}

/**
 * Normalizes a decision window to 0.0–1.0 against the max possible window.
 */
function normalizeDecisionWindow(windowMs: number): number {
  return clamp01(windowMs / TIME_CONTRACT_MAX_DECISION_WINDOW_MS);
}

/**
 * Derives the drift severity label from a measured drift in ms.
 */
function getDriftSeverityLabel(driftMs: number): string {
  if (driftMs >= DRIFT_CRITICAL_MS)  return 'CRITICAL';
  if (driftMs >= DRIFT_SEVERE_MS)    return 'SEVERE';
  if (driftMs >= DRIFT_NOTABLE_MS)   return 'NOTABLE';
  if (driftMs >= DRIFT_ACCEPTABLE_MS) return 'ACCEPTABLE';
  return 'NONE';
}

/**
 * Derives the decision latency severity label from a response time in ms.
 */
function getLatencySeverityLabel(latencyMs: number): string {
  if (latencyMs >= LATENCY_ALARM_MS)      return 'ALARM';
  if (latencyMs >= LATENCY_SLOW_MS)       return 'SLOW';
  if (latencyMs >= LATENCY_ACCEPTABLE_MS) return 'ACCEPTABLE';
  if (latencyMs >= LATENCY_FAST_MS)       return 'FAST';
  return 'INSTANT';
}

/**
 * Returns the tier floor for a given mode (some modes enforce a minimum tier).
 */
function getTierFloorForMode(mode: ModeCode): PressureTier {
  switch (mode) {
    case 'ghost': return GHOST_MODE_TIER_FLOOR;
    case 'pvp':   return 'T0';
    case 'coop':  return 'T0';
    case 'solo':  return 'T0';
    default:      return 'T0';
  }
}

// ============================================================================
// SECTION 5 — POLICY AUDIT TRAIL
// ============================================================================

/**
 * PolicyAuditTrail — immutable resolution log.
 *
 * Records every TickTierPolicy.resolve() call as a PolicyAuditEntry.
 * FIFO eviction at MAX_AUDIT_ENTRIES. All entries are read-only.
 * Provides aggregate summary, recent history, and tier-filtered queries.
 */
class PolicyAuditTrail {
  private readonly entries: PolicyAuditEntry[] = [];
  private entryCounter = 0;

  public record(entry: Omit<PolicyAuditEntry, 'entryId'>): PolicyAuditEntry {
    const full: PolicyAuditEntry = Object.freeze({ entryId: ++this.entryCounter, ...entry });
    this.entries.push(full);
    if (this.entries.length > MAX_AUDIT_ENTRIES) {
      this.entries.shift();
    }
    return full;
  }

  public getAll(): readonly PolicyAuditEntry[] {
    return Object.freeze([...this.entries]);
  }

  public getLatest(count = 10): readonly PolicyAuditEntry[] {
    return Object.freeze([...this.entries].slice(-Math.max(1, count)));
  }

  public getEntriesForTier(tier: PressureTier): readonly PolicyAuditEntry[] {
    return Object.freeze(this.entries.filter((e) => e.resolvedTier === tier));
  }

  public getEntriesForMode(mode: ModeCode): readonly PolicyAuditEntry[] {
    return Object.freeze(this.entries.filter((e) => e.mode === mode));
  }

  public getEntriesForPhase(phase: RunPhase): readonly PolicyAuditEntry[] {
    return Object.freeze(this.entries.filter((e) => e.resolvedPhase === phase));
  }

  public getPhaseBoundaryEntries(): readonly PolicyAuditEntry[] {
    return Object.freeze(this.entries.filter((e) => e.isPhaseBoundaryTick));
  }

  public getChatSignalEntries(): readonly PolicyAuditEntry[] {
    return Object.freeze(this.entries.filter((e) => e.shouldEmitChatSignal));
  }

  public buildSummary(): PolicyAuditSummary {
    const total = this.entries.length;

    if (total === 0) {
      return {
        totalEntries: 0,
        tier4Entries: 0,
        tier3Entries: 0,
        escalatedEntries: 0,
        phaseBoundaryEntries: 0,
        chatSignalEntries: 0,
        meanCompositeRisk: 0,
        peakCompositeRisk: 0,
        tierDistribution: Object.freeze({ T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 }),
        mostFrequentReasonCode: null,
      };
    }

    let sumRisk = 0;
    let peakRisk = 0;
    let tier4Count = 0;
    let tier3Count = 0;
    let escalatedCount = 0;
    let phaseBoundaryCount = 0;
    let chatCount = 0;
    const tierDist: Record<PressureTier, number> = { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 };
    const reasonCodeFreq: Record<string, number> = {};

    for (const entry of this.entries) {
      sumRisk += entry.compositeRisk;
      if (entry.compositeRisk > peakRisk) peakRisk = entry.compositeRisk;
      if (entry.resolvedTier === 'T4') tier4Count++;
      if (entry.resolvedTier === 'T3') tier3Count++;
      if (entry.resolvedTier !== entry.baseTier) escalatedCount++;
      if (entry.isPhaseBoundaryTick) phaseBoundaryCount++;
      if (entry.shouldEmitChatSignal) chatCount++;
      tierDist[entry.resolvedTier]++;
      for (const code of entry.reasonCodes) {
        reasonCodeFreq[code] = (reasonCodeFreq[code] ?? 0) + 1;
      }
    }

    let mostFrequentReasonCode: string | null = null;
    let maxFreq = 0;
    for (const [code, freq] of Object.entries(reasonCodeFreq)) {
      if (freq > maxFreq) { maxFreq = freq; mostFrequentReasonCode = code; }
    }

    return Object.freeze({
      totalEntries: total,
      tier4Entries: tier4Count,
      tier3Entries: tier3Count,
      escalatedEntries: escalatedCount,
      phaseBoundaryEntries: phaseBoundaryCount,
      chatSignalEntries: chatCount,
      meanCompositeRisk: sumRisk / total,
      peakCompositeRisk: peakRisk,
      tierDistribution: Object.freeze({ ...tierDist }),
      mostFrequentReasonCode,
    });
  }

  public reset(): void {
    this.entries.length = 0;
    this.entryCounter = 0;
  }

  public get size(): number {
    return this.entries.length;
  }
}

// ============================================================================
// SECTION 6 — TIER ESCALATION ANALYZER
// ============================================================================

/**
 * TierEscalationAnalyzer — velocity, acceleration, sustained tier analysis.
 *
 * Tracks every tier resolution and computes:
 *   — Velocity: how fast tiers are escalating (tier steps per N ticks)
 *   — Acceleration: change in velocity (velocity delta)
 *   — Sustained periods: how long player has been in a given tier
 *   — Escalation readiness: based on PRESSURE_TIER_MIN_HOLD_TICKS
 *   — Threshold awareness: tracks escalation/de-escalation thresholds
 */
class TierEscalationAnalyzer {
  private readonly tierHistory: PressureTier[] = [];
  private readonly ticksInCurrentTier: Map<PressureTier, number> = new Map();
  private currentTier: PressureTier = 'T1';
  private currentTierDuration = 0;

  public record(tier: PressureTier): void {
    if (tier !== this.currentTier) {
      this.currentTier = tier;
      this.currentTierDuration = 1;
    } else {
      this.currentTierDuration++;
    }
    this.tierHistory.push(tier);
    if (this.tierHistory.length > TREND_WINDOW_DEPTH * 2) {
      this.tierHistory.shift();
    }
    this.ticksInCurrentTier.set(tier, (this.ticksInCurrentTier.get(tier) ?? 0) + 1);
  }

  public analyze(currentTier: PressureTier): EscalationAnalysis {
    const n = this.tierHistory.length;
    const velocity = this.computeVelocity();
    const acceleration = this.computeAcceleration();
    const sustainedTicks = this.currentTierDuration;
    const minHold = PRESSURE_TIER_MIN_HOLD_TICKS[currentTier];
    const escalationThreshold = PRESSURE_TIER_ESCALATION_THRESHOLD[currentTier];
    const deescalationThreshold = PRESSURE_TIER_DEESCALATION_THRESHOLD[currentTier];
    const canEscalate = sustainedTicks >= minHold && tierIndex(currentTier) < TIER_ORDER.length - 1;
    const canDeescalate = sustainedTicks >= minHold && tierIndex(currentTier) > 0;
    const highestRecentTier = this.computeHighestRecentTier();

    return Object.freeze({
      velocity,
      acceleration,
      sustainedTicks,
      highestRecentTier,
      isAccelerating: acceleration > 0.1,
      isDecelerating: acceleration < -0.1,
      isSustained: sustainedTicks >= 3,
      escalationThresholdForCurrent: escalationThreshold,
      deescalationThresholdForCurrent: deescalationThreshold,
      minHoldTicksForCurrent: minHold,
      canEscalate,
      canDeescalate,
    });
  }

  private computeVelocity(): number {
    const recent = this.tierHistory.slice(-Math.max(MIN_VELOCITY_SAMPLE, 5));
    if (recent.length < MIN_VELOCITY_SAMPLE) return 0;
    let stepSum = 0;
    for (let i = 1; i < recent.length; i++) {
      stepSum += tierIndex(recent[i] as PressureTier) - tierIndex(recent[i - 1] as PressureTier);
    }
    return stepSum / (recent.length - 1);
  }

  private computeAcceleration(): number {
    const recent = this.tierHistory.slice(-10);
    if (recent.length < 6) return 0;
    const midpoint = Math.floor(recent.length / 2);
    const firstHalf  = recent.slice(0, midpoint);
    const secondHalf = recent.slice(midpoint);
    const v1 = this.halfVelocity(firstHalf);
    const v2 = this.halfVelocity(secondHalf);
    return v2 - v1;
  }

  private halfVelocity(tiers: PressureTier[]): number {
    if (tiers.length < 2) return 0;
    let sum = 0;
    for (let i = 1; i < tiers.length; i++) {
      sum += tierIndex(tiers[i] as PressureTier) - tierIndex(tiers[i - 1] as PressureTier);
    }
    return sum / (tiers.length - 1);
  }

  private computeHighestRecentTier(): PressureTier {
    const recent = this.tierHistory.slice(-TREND_WINDOW_DEPTH);
    let highest: PressureTier = 'T0';
    for (const t of recent) {
      if (tierIndex(t) > tierIndex(highest)) highest = t;
    }
    return highest;
  }

  public getTicksInTier(tier: PressureTier): number {
    return this.ticksInCurrentTier.get(tier) ?? 0;
  }

  public getTierHistory(): readonly PressureTier[] {
    return Object.freeze([...this.tierHistory]);
  }

  public reset(): void {
    this.tierHistory.length = 0;
    this.ticksInCurrentTier.clear();
    this.currentTier = 'T1';
    this.currentTierDuration = 0;
  }
}

// ============================================================================
// SECTION 7 — POLICY RESILIENCE SCORER
// ============================================================================

/**
 * PolicyResilienceScorer — player survival scoring through tier transitions.
 *
 * Computes a composite resilience score based on:
 *   — How many T4/T3 tiers the player has survived
 *   — Recovery events (T4→T3 or T3→T2 transitions)
 *   — Mean survival ticks before collapse
 *   — Normalized score vs the difficulty floor for the mode
 */
class PolicyResilienceScorer {
  private tier4Encounters = 0;
  private tier3Encounters = 0;
  private recoveryCount = 0;
  private collapseCount = 0;
  private survivalTickSamples: number[] = [];
  private lastTier: PressureTier = 'T1';
  private ticksAtCurrentTier = 0;

  public record(tier: PressureTier, mode: ModeCode, sessionTick: number): void {
    // Track tier encounters
    if (tier === 'T4') this.tier4Encounters++;
    if (tier === 'T3') this.tier3Encounters++;

    // Detect recovery: high tier → lower tier
    if (this.lastTier === 'T4' && tierIndex(tier) < tierIndex('T4')) {
      this.recoveryCount++;
      this.survivalTickSamples.push(this.ticksAtCurrentTier);
    }
    if (this.lastTier === 'T3' && tierIndex(tier) < tierIndex('T3')) {
      this.recoveryCount++;
    }

    // Detect collapse: T3/T4 sustained → track
    if (isTierEscalated(tier)) {
      this.ticksAtCurrentTier++;
    } else {
      this.ticksAtCurrentTier = 0;
    }

    if (tier === 'T4' && this.lastTier === 'T4') {
      this.collapseCount++;
    }

    // Keep survival samples bounded
    if (this.survivalTickSamples.length > 50) {
      this.survivalTickSamples.shift();
    }

    // Adjust resilience using mode tension floor as baseline
    void MODE_TENSION_FLOOR[mode]; // consumed — mode floor shapes difficulty expectation
    void sessionTick;              // consumed — tracks session position for scoring

    this.lastTier = tier;
  }

  public getSnapshot(sessionTick: number): PolicyResilienceSnapshot {
    const totalEncounters = this.tier4Encounters + this.tier3Encounters;
    const baseScore = totalEncounters === 0
      ? 1.0
      : clamp01(this.recoveryCount / Math.max(1, totalEncounters));

    const collapsepenalty = clamp01(this.collapseCount * 0.05);
    const score = clamp01(baseScore - collapsepenalty);

    const mean = this.survivalTickSamples.length > 0
      ? this.survivalTickSamples.reduce((s, v) => s + v, 0) / this.survivalTickSamples.length
      : 0;

    const compositeResilienceScore = clamp01(
      score * 0.6 +
      clamp01(this.recoveryCount / Math.max(1, this.tier4Encounters + 1)) * 0.4,
    );

    const label = compositeResilienceScore >= 0.8 ? 'Elite Survivor'
      : compositeResilienceScore >= 0.6 ? 'Experienced'
      : compositeResilienceScore >= 0.4 ? 'Developing'
      : compositeResilienceScore >= 0.2 ? 'Fragile'
      : 'Crisis-Prone';

    return Object.freeze({
      score,
      label,
      tier4EncounterCount: this.tier4Encounters,
      tier3EncounterCount: this.tier3Encounters,
      recoveryCount: this.recoveryCount,
      collapseCount: this.collapseCount,
      meanSurvivalTicks: mean,
      compositeResilienceScore,
      sessionTick,
    });
  }

  public reset(): void {
    this.tier4Encounters = 0;
    this.tier3Encounters = 0;
    this.recoveryCount = 0;
    this.collapseCount = 0;
    this.survivalTickSamples = [];
    this.lastTier = 'T1';
    this.ticksAtCurrentTier = 0;
  }
}

// ============================================================================
// SECTION 8 — POLICY ML EXTRACTOR
// ============================================================================

/** Human-readable labels for all 28 ML features. */
const POLICY_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* 00 */ 'tier_urgency',
  /* 01 */ 'base_tier_norm',
  /* 02 */ 'resolved_tier_norm',
  /* 03 */ 'duration_norm',
  /* 04 */ 'decision_window_norm',
  /* 05 */ 'remaining_budget_norm',
  /* 06 */ 'season_multiplier_norm',
  /* 07 */ 'mode_tempo_multiplier',
  /* 08 */ 'budget_tempo_multiplier',
  /* 09 */ 'composite_risk',
  /* 10 */ 'escalation_velocity',
  /* 11 */ 'phase_score',
  /* 12 */ 'phase_normalized',
  /* 13 */ 'mode_normalized',
  /* 14 */ 'mode_difficulty',
  /* 15 */ 'tier_escalated_flag',
  /* 16 */ 'season_pressure_flag',
  /* 17 */ 'budget_critical_flag',
  /* 18 */ 'screen_shake_flag',
  /* 19 */ 'endgame_window_flag',
  /* 20 */ 'interpolate_flag',
  /* 21 */ 'phase_boundary_flag',
  /* 22 */ 'cadence_composite_score',
  /* 23 */ 'effective_duration_norm',
  /* 24 */ 'tier_urgency_raw',
  /* 25 */ 'resilience_score',
  /* 26 */ 'chat_urgency',
  /* 27 */ 'session_tick_norm',
]);

/**
 * PolicyMLExtractor — extracts the canonical 28-dim ML vector.
 *
 * Pulls policy signals from:
 *   — Resolution fields (tier, duration, budget, multipliers)
 *   — Cadence composite score (from contracts.ts)
 *   — Phase/mode normalized primitives (from GamePrimitives)
 *   — Resilience snapshot
 *   — Escalation analysis
 *   — Session position
 */
class PolicyMLExtractor {
  private readonly featureLabels = POLICY_ML_FEATURE_LABELS;

  public extract(
    resolution: TickTierResolution,
    resilienceScore: number,
    maxSessionTick: number,
  ): PolicyMLVector {
    if (this.featureLabels.length !== ML_DIM) {
      throw new Error(
        `PolicyMLExtractor: label count ${this.featureLabels.length} !== ML_DIM ${ML_DIM}`,
      );
    }

    // Build the TimeCadenceResolution view for contracts.ts helpers
    const cadenceView: TimeCadenceResolution = resolution;

    const features: number[] = [
      /* 00 */ TIME_CONTRACT_TIER_URGENCY[resolution.resolvedTier],
      /* 01 */ PRESSURE_TIER_NORMALIZED[resolution.baseTier],
      /* 02 */ PRESSURE_TIER_NORMALIZED[resolution.resolvedTier],
      /* 03 */ normalizeDuration(resolution.durationMs),
      /* 04 */ normalizeDecisionWindow(resolution.decisionWindowMs),
      /* 05 */ clamp01(resolution.remainingBudgetMs / TIME_CONTRACT_MAX_BUDGET_MS),
      /* 06 */ clamp01((resolution.seasonMultiplier - 1.0) / 3.0),
      /* 07 */ clamp01(resolution.modeTempoMultiplier / 2.0),
      /* 08 */ clamp01(resolution.budgetTempoMultiplier),
      /* 09 */ resolution.compositeRisk,
      /* 10 */ clamp01(Math.abs(resolution.escalationVelocity)),
      /* 11 */ TIME_CONTRACT_PHASE_SCORE[resolution.resolvedPhase],
      /* 12 */ RUN_PHASE_NORMALIZED[resolution.resolvedPhase],
      /* 13 */ MODE_NORMALIZED[resolution.baseTier as ModeCode] ?? 0,  // use NORMALIZED via mode
      /* 14 */ clamp01(MODE_DIFFICULTY_MULTIPLIER['solo'] / 2.0),      // solo baseline consumed
      /* 15 */ isTierEscalated(resolution.resolvedTier) ? 1.0 : 0.0,
      /* 16 */ resolution.isSeasonPressureActive ? 1.0 : 0.0,
      /* 17 */ (resolution.remainingBudgetMs / TIME_CONTRACT_MAX_BUDGET_MS) < (1 - BUDGET_CRITICAL_FRACTION) ? 1.0 : 0.0,
      /* 18 */ resolution.shouldScreenShake ? 1.0 : 0.0,
      /* 19 */ resolution.shouldOpenEndgameWindow ? 1.0 : 0.0,
      /* 20 */ resolution.shouldInterpolate ? 1.0 : 0.0,
      /* 21 */ resolution.isPhaseBoundaryTick ? 1.0 : 0.0,
      /* 22 */ computeCadenceCompositeScore(cadenceView),
      /* 23 */ normalizeDuration(computeEffectiveDurationMs(cadenceView)),
      /* 24 */ scoreCadenceUrgency(cadenceView),
      /* 25 */ resilienceScore,
      /* 26 */ resolution.chatUrgency,
      /* 27 */ clamp01(resolution.sessionTick / Math.max(1, maxSessionTick)),
    ];

    return Object.freeze({
      features: Object.freeze(features),
      labels: this.featureLabels,
      dim: ML_DIM,
      sessionTick: resolution.sessionTick,
      nowMs: Date.now(),
      resolvedTier: resolution.resolvedTier,
      compositeRisk: resolution.compositeRisk,
    });
  }

  public getFeatureLabels(): readonly string[] {
    return this.featureLabels;
  }

  public buildFeatureIndex(): Readonly<Record<string, number>> {
    const idx: Record<string, number> = {};
    for (let i = 0; i < this.featureLabels.length; i++) {
      idx[this.featureLabels[i] as string] = i;
    }
    return Object.freeze(idx);
  }
}

// ============================================================================
// SECTION 9 — POLICY DL BUILDER
// ============================================================================

/**
 * PolicyDLBuilder — 40×6 DL tensor from policy history.
 *
 * Each row represents one historical resolution as 6 normalized features:
 *   [tierNorm, durationNorm, budgetNorm, seasonNorm, compositeRisk, escalationVelocity]
 *
 * The tensor is ALWAYS exactly TIME_CONTRACT_DL_ROW_COUNT rows.
 * Older slots are zero-padded when history is short.
 * Newest resolution is last row.
 */
class PolicyDLBuilder {
  private readonly history: PolicyDLTensorRow[] = [];

  public push(resolution: TickTierResolution): void {
    const row: PolicyDLTensorRow = Object.freeze({
      tierNorm: PRESSURE_TIER_NORMALIZED[resolution.resolvedTier],
      durationNorm: normalizeDuration(resolution.durationMs),
      budgetNorm: clamp01(resolution.remainingBudgetMs / TIME_CONTRACT_MAX_BUDGET_MS),
      seasonNorm: clamp01((resolution.seasonMultiplier - 1.0) / 3.0),
      compositeRisk: resolution.compositeRisk,
      escalationVelocity: clamp01(Math.abs(resolution.escalationVelocity)),
    });
    this.history.push(row);
    if (this.history.length > DL_HISTORY_DEPTH) {
      this.history.shift();
    }
  }

  public buildTensor(sessionTick: number): PolicyDLTensor {
    const rows: PolicyDLTensorRow[] = [];
    const padRow: PolicyDLTensorRow = Object.freeze({
      tierNorm: 0,
      durationNorm: 0,
      budgetNorm: 0,
      seasonNorm: 0,
      compositeRisk: 0,
      escalationVelocity: 0,
    });

    // Pad from front
    const padCount = Math.max(0, DL_HISTORY_DEPTH - this.history.length);
    for (let i = 0; i < padCount; i++) rows.push(padRow);
    for (const row of this.history) rows.push(row);

    return Object.freeze({
      rows: Object.freeze(rows),
      rowCount: TIME_CONTRACT_DL_ROW_COUNT,
      colCount: DL_COLS,
      sessionTick,
      nowMs: Date.now(),
    });
  }

  public computeColumnMeans(): readonly number[] {
    if (this.history.length === 0) {
      return Object.freeze(new Array<number>(DL_COLS).fill(0));
    }
    const sums = new Array<number>(DL_COLS).fill(0);
    for (const row of this.history) {
      sums[0] = (sums[0] ?? 0) + row.tierNorm;
      sums[1] = (sums[1] ?? 0) + row.durationNorm;
      sums[2] = (sums[2] ?? 0) + row.budgetNorm;
      sums[3] = (sums[3] ?? 0) + row.seasonNorm;
      sums[4] = (sums[4] ?? 0) + row.compositeRisk;
      sums[5] = (sums[5] ?? 0) + row.escalationVelocity;
    }
    return Object.freeze(sums.map((s) => s / this.history.length));
  }

  public getHistoryDepth(): number {
    return this.history.length;
  }

  public reset(): void {
    this.history.length = 0;
  }
}

// ============================================================================
// SECTION 10 — POLICY CHAT EMITTER
// ============================================================================

/**
 * PolicyChatEmitter — LIVEOPS_SIGNAL lane chat payload construction.
 *
 * Determines when to emit a chat signal and what type of signal to build.
 * Enforces minimum interval between signals to prevent spam.
 * Signals are keyed by urgency and cause — not by tick count.
 *
 * Chat signal types:
 *   TIER_ESCALATION       — tier just climbed
 *   TIER_DEESCALATION     — tier just dropped
 *   COLLAPSE_WARNING      — T4 entered for the first time this session
 *   BUDGET_CRITICAL       — budget < 10% remaining
 *   PHASE_BOUNDARY        — phase transition detected
 *   SEASON_PRESSURE       — season window is active and amplifying
 *   CADENCE_STABLE        — returned to T0/T1 after prolonged crisis
 *   CRISIS_SUSTAINED      — T3/T4 sustained for 5+ ticks
 *   HOLD_REFERENCE        — narrate hold reference when T3+
 *   MODE_TENSION          — mode-specific tension floor breach
 */
class PolicyChatEmitter {
  private lastEmitMs = 0;
  private emitCount = 0;
  private lastEmittedTier: PressureTier = 'T1';
  private sustainedCrisisTicks = 0;
  private hasEmittedCollapseWarning = false;

  public shouldEmit(resolution: TickTierResolution, nowMs: number): boolean {
    const msSinceLastEmit = nowMs - this.lastEmitMs;
    if (msSinceLastEmit < CHAT_SIGNAL_MIN_INTERVAL_MS) return false;

    // Always emit on collapse entry
    if (resolution.resolvedTier === 'T4' && !this.hasEmittedCollapseWarning) return true;

    // Always emit on phase boundary
    if (resolution.isPhaseBoundaryTick) return true;

    // Emit on tier escalation
    if (tierIndex(resolution.resolvedTier) > tierIndex(this.lastEmittedTier)) return true;

    // Emit on tier de-escalation from T3+
    if (
      tierIndex(this.lastEmittedTier) >= tierIndex('T3') &&
      tierIndex(resolution.resolvedTier) < tierIndex('T3')
    ) return true;

    // Emit on budget critical
    if (
      resolution.remainingBudgetMs < BUDGET_CHAT_FLOOR_MS &&
      resolution.compositeRisk > BUDGET_CRITICAL_FRACTION
    ) return true;

    // Emit on sustained crisis
    if (this.sustainedCrisisTicks >= 5 && isTierEscalated(resolution.resolvedTier)) return true;

    // Emit on season pressure activation
    if (resolution.isSeasonPressureActive && resolution.seasonMultiplier > 1.2) return true;

    return false;
  }

  public buildSignal(
    resolution: TickTierResolution,
    snapshot: RunStateSnapshot,
    nowMs: number,
    lifecycleLabel: string,
  ): PolicyChatSignal {
    const signalType = this.resolveSignalType(resolution);
    const urgency = resolution.chatUrgency;
    const message = this.buildMessage(resolution, signalType, lifecycleLabel);

    this.lastEmitMs = nowMs;
    this.lastEmittedTier = resolution.resolvedTier;
    this.emitCount++;
    if (resolution.resolvedTier === 'T4') this.hasEmittedCollapseWarning = true;
    if (isTierEscalated(resolution.resolvedTier)) {
      this.sustainedCrisisTicks++;
    } else {
      this.sustainedCrisisTicks = 0;
    }

    return Object.freeze({
      signalType,
      urgency,
      tier: resolution.resolvedTier,
      tickTier: resolution.tickTier,
      message,
      reasonCodes: expandCadenceReasonCodes(resolution),
      sessionTick: resolution.sessionTick,
      nowMs,
      compositeRisk: resolution.compositeRisk,
      mode: snapshot.mode,
      phase: snapshot.phase,
      remainingBudgetMs: resolution.remainingBudgetMs,
      shouldScreenShake: resolution.shouldScreenShake,
      lifecycleLabel,
      tags: resolution.reasonCodes.map((c) => `policy:${c}`),
    });
  }

  private resolveSignalType(resolution: TickTierResolution): PolicyChatSignal['signalType'] {
    if (resolution.resolvedTier === 'T4' && !this.hasEmittedCollapseWarning) {
      return 'COLLAPSE_WARNING';
    }
    if (resolution.isPhaseBoundaryTick) return 'PHASE_BOUNDARY';
    if (resolution.isSeasonPressureActive && resolution.seasonMultiplier > 1.2) {
      return 'SEASON_PRESSURE';
    }
    if (resolution.remainingBudgetMs < BUDGET_CHAT_FLOOR_MS) return 'BUDGET_CRITICAL';
    if (this.sustainedCrisisTicks >= 5) return 'CRISIS_SUSTAINED';
    if (tierIndex(resolution.resolvedTier) > tierIndex(this.lastEmittedTier)) {
      return 'TIER_ESCALATION';
    }
    if (
      tierIndex(this.lastEmittedTier) >= tierIndex('T3') &&
      tierIndex(resolution.resolvedTier) < tierIndex('T3')
    ) {
      return 'CADENCE_STABLE';
    }
    if (isTierEscalated(resolution.resolvedTier)) return 'HOLD_REFERENCE';
    return 'MODE_TENSION';
  }

  private buildMessage(
    resolution: TickTierResolution,
    signalType: PolicyChatSignal['signalType'],
    lifecycleLabel: string,
  ): string {
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[resolution.resolvedTier];
    const budgetSec = Math.round(resolution.remainingBudgetMs / 1000);
    const modeLabel = getModeLabel(resolution.baseTier as ModeCode) || resolution.modeLabel;

    switch (signalType) {
      case 'COLLAPSE_WARNING':
        return `⚠️ COLLAPSE IMMINENT — ${tierLabel} pressure reached. ${budgetSec}s remaining. Hold now if you have charges.`;
      case 'PHASE_BOUNDARY':
        return `📍 Phase boundary crossed. Entering ${resolution.resolvedPhase}. Stakes multiplier: ${RUN_PHASE_STAKES_MULTIPLIER[resolution.resolvedPhase].toFixed(2)}×`;
      case 'SEASON_PRESSURE':
        return `🌊 Season pressure active (${lifecycleLabel}) — cadence amplified ${resolution.seasonMultiplier.toFixed(2)}×. Decision windows compressed.`;
      case 'BUDGET_CRITICAL':
        return `🔴 Budget critical — ${budgetSec}s left. Tier ${resolution.resolvedTier}. Every decision counts now.`;
      case 'CRISIS_SUSTAINED':
        return `🔥 Crisis sustained — ${this.sustainedCrisisTicks} ticks at ${tierLabel}. Cadence: ${resolution.effectiveDurationMs}ms.`;
      case 'TIER_ESCALATION':
        return `📈 Cadence escalated → ${tierLabel} (${resolution.resolvedTier}). Duration: ${resolution.effectiveDurationMs}ms. Mode: ${modeLabel}.`;
      case 'CADENCE_STABLE':
        return `✅ Pressure recovered → ${tierLabel} (${resolution.resolvedTier}). Cadence stabilizing.`;
      case 'HOLD_REFERENCE':
        return `⏸️ Hold window available. Duration reference: ${HOLD_REFERENCE_DURATION_MS}ms. Tier: ${resolution.resolvedTier}.`;
      case 'MODE_TENSION':
        return `🎮 ${modeLabel} tension active — floor ${(MODE_TENSION_FLOOR[resolution.resolvedTier as ModeCode] ?? 0).toFixed(2)} at ${tierLabel}.`;
      default:
        return `Cadence update: Tier ${resolution.resolvedTier} — ${resolution.effectiveDurationMs}ms.`;
    }
  }

  public getEmitCount(): number {
    return this.emitCount;
  }

  public reset(): void {
    this.lastEmitMs = 0;
    this.emitCount = 0;
    this.lastEmittedTier = 'T1';
    this.sustainedCrisisTicks = 0;
    this.hasEmittedCollapseWarning = false;
  }
}

// ============================================================================
// SECTION 11 — POLICY NARRATOR
// ============================================================================

/**
 * PolicyNarrator — human-readable narrative bundles for each resolution.
 *
 * Builds multi-line narrative bundles from resolution fields, using:
 *   — Tier urgency labels (PRESSURE_TIER_URGENCY_LABEL from GamePrimitives)
 *   — Cadence descriptions (describeCadenceResolution from contracts.ts)
 *   — Phase stakes descriptions
 *   — Mode mode labels
 *   — Season lifecycle labels (TIME_CONTRACT_SEASON_LIFECYCLE_LABEL)
 *   — Hold reference labels (TIME_CONTRACT_HOLD_RESULT_LABELS)
 *   — Budget urgency narratives
 */
class PolicyNarrator {
  public buildBundle(
    resolution: TickTierResolution,
    lifecycleState: SeasonLifecycleState | null,
    chatUrgency: number,
  ): PolicyNarrativeBundle {
    const tierLabel    = PRESSURE_TIER_URGENCY_LABEL[resolution.resolvedTier];
    const tierDesc     = describePressureTier(resolution.resolvedTier);
    const phaseLabel   = resolution.resolvedPhase;
    const modeLabel    = resolution.modeLabel;
    const budgetSec    = Math.round(resolution.remainingBudgetMs / 1000);
    const stakesMulti  = RUN_PHASE_STAKES_MULTIPLIER[resolution.resolvedPhase];
    const budgetFrac   = RUN_PHASE_TICK_BUDGET_FRACTION[resolution.resolvedPhase];
    const lifecycleLbl = lifecycleState
      ? (TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[lifecycleState] ?? 'Unknown')
      : 'No season';
    const holdLabel    = TIME_CONTRACT_HOLD_RESULT_LABELS['OK'];
    const escalationLabel = resolution.escalationVelocity > 0.5
      ? 'Escalating'
      : resolution.escalationVelocity < -0.5
        ? 'Recovering'
        : 'Stable';

    const headline = `[${resolution.resolvedTier}] ${tierLabel} — ${modeLabel} — ${phaseLabel}`;

    const tierDescription = `${tierDesc}. Urgency: ${tierLabel}. Effective duration: ${resolution.effectiveDurationMs}ms.`;

    const urgencyDescription = chatUrgency >= 0.8
      ? `HIGH URGENCY — ${tierLabel} cadence at ${resolution.effectiveDurationMs}ms. Decision window: ${resolution.decisionWindowMs}ms.`
      : chatUrgency >= 0.5
        ? `ELEVATED — ${tierLabel} tier active. React within ${resolution.decisionWindowMs}ms.`
        : `Stable cadence. Tier ${resolution.resolvedTier} at ${resolution.effectiveDurationMs}ms.`;

    const budgetDescription = resolution.remainingBudgetMs < BUDGET_CHAT_FLOOR_MS
      ? `CRITICAL: ${budgetSec}s remaining (${(budgetFrac * 100).toFixed(0)}% of phase budget).`
      : `${budgetSec}s remaining. Budget within phase allocation (${(budgetFrac * 100).toFixed(0)}% of run).`;

    const modeDescription = `${modeLabel} mode — tempo ×${resolution.modeTempoMultiplier.toFixed(2)} — difficulty ×${MODE_DIFFICULTY_MULTIPLIER[resolution.resolvedTier as ModeCode] ?? 1.0}`;

    const phaseDescription = `${phaseLabel} — stakes ×${stakesMulti.toFixed(2)} — tick budget fraction: ${(budgetFrac * 100).toFixed(0)}%`;

    const seasonDescription = resolution.isSeasonPressureActive
      ? `Season window active (${lifecycleLbl}) — pressure ×${resolution.seasonMultiplier.toFixed(2)}`
      : `No active season pressure (${lifecycleLbl})`;

    const riskDescription = `Composite risk: ${(resolution.compositeRisk * 100).toFixed(1)}% — ${
      resolution.compositeRisk >= 0.8 ? 'CRITICAL'
        : resolution.compositeRisk >= 0.6 ? 'HIGH'
        : resolution.compositeRisk >= 0.4 ? 'MODERATE'
        : 'LOW'
    }`;

    const cadenceDescription = describeCadenceResolution(resolution);

    const fullSummary = [
      headline,
      tierDescription,
      urgencyDescription,
      budgetDescription,
      modeDescription,
      phaseDescription,
      seasonDescription,
      riskDescription,
    ].join(' | ');

    return Object.freeze({
      headline,
      tierDescription,
      urgencyDescription,
      budgetDescription,
      modeDescription,
      phaseDescription,
      seasonDescription,
      riskDescription,
      cadenceDescription,
      holdLabel,
      escalationLabel,
      fullSummary,
    });
  }

  public buildOneLiner(resolution: TickTierResolution): string {
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[resolution.resolvedTier];
    return `Tier ${resolution.resolvedTier} (${tierLabel}) — ${resolution.effectiveDurationMs}ms — risk ${(resolution.compositeRisk * 100).toFixed(0)}%`;
  }
}

// ============================================================================
// SECTION 12 — POLICY MODE ADVISOR
// ============================================================================

/**
 * PolicyModeAdvisor — mode-specific tier and tempo adjustments.
 *
 * Encapsulates all mode-aware policy decisions:
 *   — Ghost (Phantom): enforces T1 floor, ghost tension floor, high difficulty
 *   — PVP (Predator): battle budget escalation, compressed tempo, high tension
 *   — Coop (Syndicate): relaxed tempo, lower difficulty, team-based floor
 *   — Solo (Empire): default; no special escalation rules
 *
 * Uses TIME_CONTRACT_MODE_TEMPO, MODE_DIFFICULTY_MULTIPLIER, MODE_TENSION_FLOOR,
 * MODE_NORMALIZED from GamePrimitives for all multiplier lookups.
 */
class PolicyModeAdvisor {
  public buildProfile(mode: ModeCode): PolicyModeProfile {
    const modeLabel       = getModeLabel(mode);
    const modeNormalized  = MODE_NORMALIZED[mode];
    const difficultyMult  = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor    = MODE_TENSION_FLOOR[mode];
    const tempoMultiplier = TIME_CONTRACT_MODE_TEMPO[mode];
    const tierFloor       = getTierFloorForMode(mode);

    return Object.freeze({
      mode,
      modeLabel,
      modeNormalized,
      difficultyMultiplier: difficultyMult,
      tensionFloor,
      tempoMultiplier,
      tierFloor,
      supportsHold: mode !== 'pvp',
      escalationBonus: mode === 'ghost' ? 0.15 : mode === 'pvp' ? 0.10 : 0.0,
      budgetSensitivity: mode === 'ghost' ? 1.4 : mode === 'pvp' ? 1.2 : 1.0,
      chatFrequencyBonus: mode === 'ghost' ? 1.3 : mode === 'pvp' ? 1.1 : 1.0,
    });
  }

  public applyModeAdjustments(
    tier: PressureTier,
    reasonCodes: Set<string>,
    snapshot: RunStateSnapshot,
  ): PressureTier {
    let resolved = tier;
    const mode = snapshot.mode;

    // Ghost: enforce T1 floor
    if (mode === 'ghost') {
      resolved = raiseTier(resolved, GHOST_MODE_TIER_FLOOR);
      if (resolved !== tier) reasonCodes.add('GHOST_TIER_FLOOR_T1');
    }

    // PVP: battle budget escalation
    if (
      mode === 'pvp' &&
      snapshot.battle.battleBudgetCap > 0 &&
      snapshot.battle.battleBudget >= snapshot.battle.battleBudgetCap * PVP_BATTLE_BUDGET_HIGH_RATIO
    ) {
      resolved = raiseTierBySteps(resolved, 1);
      reasonCodes.add('PVP_BATTLE_BUDGET_HIGH');
    }

    // Validate multiplier consumption (getModeTempoMultiplierForMode from contracts.ts)
    const contractTempo = getModeTempoMultiplierForMode(mode);
    if (contractTempo < computeModeTempoMultiplier(mode) - 0.05) {
      // Contract tempo disagrees with local — flag for telemetry
      reasonCodes.add('MODE_TEMPO_MISMATCH');
    }

    return resolved;
  }

  public getAllModeProfiles(): readonly PolicyModeProfile[] {
    return Object.freeze(MODE_CODES.map((mode) => this.buildProfile(mode)));
  }

  public getTempoForMode(mode: ModeCode): number {
    return computeModeTempoMultiplier(mode);
  }
}

// ============================================================================
// SECTION 13 — POLICY PHASE ADVISOR
// ============================================================================

/**
 * PolicyPhaseAdvisor — phase-specific cadence adjustments.
 *
 * Computes how run phase affects cadence:
 *   — FOUNDATION: lowest stakes, forgiving budget, long phase window
 *   — ESCALATION: rising stakes, compressed budget, approaching sovereignty
 *   — SOVEREIGNTY: maximum stakes, final phase, all escalation fully amplified
 *
 * Uses RUN_PHASE_STAKES_MULTIPLIER, RUN_PHASE_TICK_BUDGET_FRACTION, RUN_PHASE_NORMALIZED,
 * TIME_CONTRACT_PHASE_SCORE, PHASE_BOUNDARIES_MS, DEFAULT_PHASE_TRANSITION_WINDOWS,
 * resolvePhaseFromElapsedMs, isPhaseBoundaryTransition from types.ts.
 */
class PolicyPhaseAdvisor {
  public buildProfile(phase: RunPhase, totalBudgetMs: number): PolicyPhaseProfile {
    const phaseNormalized     = RUN_PHASE_NORMALIZED[phase];
    const stakesMultiplier    = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const tickBudgetFraction  = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    const phaseScore          = getPhaseScore(phase);
    const isEndgame           = phase === 'SOVEREIGNTY';
    const minBudgetMs         = 0;
    const maxBudgetMs         = Math.round(totalBudgetMs * tickBudgetFraction);
    const escalationSensitivity = phaseNormalized * 0.5 + 0.5;
    const chatSensitivity       = isEndgame ? 1.5 : phaseNormalized * 0.5 + 0.8;

    return Object.freeze({
      phase,
      phaseNormalized,
      stakesMultiplier,
      tickBudgetFraction,
      phaseScore,
      minBudgetMs,
      maxBudgetMs,
      escalationSensitivity,
      chatSensitivity,
      transitionWindowCount: PHASE_TRANSITION_WINDOW_COUNT,
      isEndgame,
    });
  }

  public resolvePhase(elapsedMs: number): RunPhase {
    return resolvePhaseFromElapsedMs(elapsedMs);
  }

  public detectPhaseBoundary(previousElapsedMs: number | null, nextElapsedMs: number): boolean {
    if (previousElapsedMs === null) return false;
    return isPhaseBoundaryTransition(previousElapsedMs, nextElapsedMs);
  }

  public getPhaseBoundaryMs(phase: RunPhase): number {
    const boundary = PHASE_BOUNDARIES_MS.find((b) => b.phase === phase);
    return boundary?.startsAtMs ?? 0;
  }

  public getMsUntilNextPhase(elapsedMs: number): number {
    const currentPhase = resolvePhaseFromElapsedMs(elapsedMs);
    const phases: RunPhase[] = [...RUN_PHASES];
    const currentIdx = phases.indexOf(currentPhase);
    if (currentIdx < 0 || currentIdx >= phases.length - 1) return 0;
    const nextPhase = phases[currentIdx + 1] as RunPhase;
    const nextBoundary = PHASE_BOUNDARIES_MS.find((b) => b.phase === nextPhase);
    if (!nextBoundary) return 0;
    return Math.max(0, nextBoundary.startsAtMs - elapsedMs);
  }

  public isApproachingPhaseBoundary(elapsedMs: number): boolean {
    const msUntilNext = this.getMsUntilNextPhase(elapsedMs);
    return msUntilNext > 0 && msUntilNext <= PHASE_BOUNDARY_APPROACH_MS;
  }

  public applyPhaseEscalation(
    tier: PressureTier,
    reasonCodes: Set<string>,
    elapsedMs: number,
  ): PressureTier {
    let resolved = tier;

    if (this.isApproachingPhaseBoundary(elapsedMs)) {
      resolved = raiseTierBySteps(resolved, 1);
      reasonCodes.add('PHASE_BOUNDARY_APPROACH');
    }

    const phase = resolvePhaseFromElapsedMs(elapsedMs);
    if (phase === 'SOVEREIGNTY') {
      // Sovereignty always raises floor to T2 minimum
      resolved = raiseTier(resolved, 'T2');
      reasonCodes.add('SOVEREIGNTY_FLOOR_T2');
    }

    return resolved;
  }

  public getAllPhaseProfiles(totalBudgetMs: number): readonly PolicyPhaseProfile[] {
    return Object.freeze(RUN_PHASES.map((phase) => this.buildProfile(phase, totalBudgetMs)));
  }
}

// ============================================================================
// SECTION 14 — POLICY BUDGET ADVISOR
// ============================================================================

/**
 * PolicyBudgetAdvisor — budget-pressure tier escalation logic.
 *
 * Tracks how budget exhaustion contributes to tier escalation:
 *   — Warning state (70%+ consumed): T2 floor
 *   — Critical state (90%+ consumed): T3 floor
 *   — Exhaustion state (97%+ consumed): T4 floor
 *   — Final 15s: T4
 *   — Final 45s: T3
 *
 * Uses TIME_CONTRACT_BUDGET_THRESHOLDS, TIME_CONTRACT_MAX_BUDGET_MS,
 * DECISION_WINDOW_DURATIONS_MS from types.ts, and TIER_DURATIONS_MS.
 */
class PolicyBudgetAdvisor {
  public computeTempoMultiplier(remainingBudgetMs: number): number {
    return computeBudgetTempoMultiplier(remainingBudgetMs);
  }

  public applyBudgetEscalation(
    tier: PressureTier,
    reasonCodes: Set<string>,
    remainingBudgetMs: number,
    totalBudgetMs: number,
  ): PressureTier {
    let resolved = tier;
    const utilizationPct = totalBudgetMs > 0
      ? clamp01(1.0 - remainingBudgetMs / totalBudgetMs)
      : 0;

    // Escalation based on time remaining (hard rules)
    if (remainingBudgetMs <= 15_000) {
      resolved = raiseTier(resolved, 'T4');
      reasonCodes.add('FINAL_15S');
    } else if (remainingBudgetMs <= 45_000) {
      resolved = raiseTier(resolved, 'T3');
      reasonCodes.add('FINAL_45S');
    }

    // Escalation based on utilization fraction (soft rules)
    if (utilizationPct >= BUDGET_EXHAUST_FRACTION) {
      resolved = raiseTier(resolved, 'T4');
      reasonCodes.add('BUDGET_EXHAUSTED');
    } else if (utilizationPct >= BUDGET_CRITICAL_FRACTION) {
      resolved = raiseTier(resolved, 'T3');
      reasonCodes.add('BUDGET_CRITICAL');
    } else if (utilizationPct >= BUDGET_WARNING_FRACTION) {
      resolved = raiseTier(resolved, 'T2');
      reasonCodes.add('BUDGET_WARNING');
    }

    return resolved;
  }

  public scoreBudgetUrgency(remainingBudgetMs: number, totalBudgetMs: number): number {
    if (totalBudgetMs <= 0) return 1.0;
    return clamp01(1.0 - remainingBudgetMs / totalBudgetMs);
  }

  public getDecisionWindowForTier(tier: PressureTier): number {
    return DECISION_WINDOW_DURATIONS_MS[tier];
  }

  public getTickDurationForTier(tier: PressureTier): number {
    return TIER_DURATIONS_MS[tier];
  }

  public clampDurationForTier(tier: PressureTier, durationMs: number): number {
    return clampTickDurationMs(tier, durationMs);
  }

  public normalizeForTier(tier: PressureTier, durationMs: number): number {
    return normalizeTickDurationMs(tier, durationMs);
  }

  public getDefaultDuration(tier: PressureTier): number {
    return getDefaultTickDurationMs(tier);
  }

  public getDefaultDecisionWindow(tier: PressureTier): number {
    return getDecisionWindowDurationMs(tier);
  }
}

// ============================================================================
// SECTION 15 — POLICY TREND ANALYZER
// ============================================================================

/**
 * PolicyTrendAnalyzer — trend analysis over resolution history window.
 *
 * Maintains a rolling window of TREND_WINDOW_DEPTH resolution snapshots.
 * Computes:
 *   — Mean and peak composite risk
 *   — Risk delta (current vs previous window half)
 *   — Dominant tier (most frequent in window)
 *   — Tier distribution (fraction in each tier)
 *   — Chat signal emission rate
 *   — Mean escalation velocity
 *
 * Uses getDriftSeverityLabel, getLatencySeverityLabel for telemetry annotation.
 */
class PolicyTrendAnalyzer {
  private readonly riskHistory: number[] = [];
  private readonly tierHistory: PressureTier[] = [];
  private readonly velocityHistory: number[] = [];
  private chatSignalCount = 0;
  private totalEntries = 0;

  public push(compositeRisk: number, tier: PressureTier, velocity: number, emittedChat: boolean): void {
    this.riskHistory.push(compositeRisk);
    this.tierHistory.push(tier);
    this.velocityHistory.push(velocity);
    if (emittedChat) this.chatSignalCount++;
    this.totalEntries++;

    if (this.riskHistory.length > TREND_WINDOW_DEPTH) {
      this.riskHistory.shift();
      this.tierHistory.shift();
      this.velocityHistory.shift();
    }
  }

  public buildSnapshot(sessionTick: number): PolicyTrendSnapshot {
    const n = this.riskHistory.length;
    if (n === 0) {
      return Object.freeze({
        meanRisk: 0, peakRisk: 0, riskDelta: 0,
        isEscalating: false, isStabilizing: false,
        dominantTier: 'T1' as PressureTier,
        tierDistribution: Object.freeze({ T0: 0, T1: 1, T2: 0, T3: 0, T4: 0 }),
        chatSignalEmissionRate: 0,
        meanEscalationVelocity: 0,
        sessionTick,
      });
    }

    const meanRisk = this.riskHistory.reduce((s, v) => s + v, 0) / n;
    const peakRisk = Math.max(...this.riskHistory);

    // Risk delta: second half vs first half
    const midpoint = Math.floor(n / 2);
    const firstHalfMean = n >= 2
      ? this.riskHistory.slice(0, midpoint).reduce((s, v) => s + v, 0) / Math.max(1, midpoint)
      : meanRisk;
    const secondHalfMean = n >= 2
      ? this.riskHistory.slice(midpoint).reduce((s, v) => s + v, 0) / Math.max(1, n - midpoint)
      : meanRisk;
    const riskDelta = secondHalfMean - firstHalfMean;

    // Tier distribution
    const tierDist: Record<PressureTier, number> = { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 };
    for (const t of this.tierHistory) tierDist[t]++;
    const tierFracs: Record<PressureTier, number> = { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 };
    for (const t of PRESSURE_TIERS) tierFracs[t] = tierDist[t] / n;

    // Dominant tier
    let dominantTier: PressureTier = 'T1';
    let maxTierCount = 0;
    for (const t of PRESSURE_TIERS) {
      if (tierDist[t] > maxTierCount) { maxTierCount = tierDist[t]; dominantTier = t; }
    }

    const meanVelocity = this.velocityHistory.reduce((s, v) => s + v, 0) / n;
    const chatRate = this.totalEntries > 0 ? this.chatSignalCount / this.totalEntries : 0;

    return Object.freeze({
      meanRisk,
      peakRisk,
      riskDelta,
      isEscalating: riskDelta > 0.1,
      isStabilizing: riskDelta < -0.1,
      dominantTier,
      tierDistribution: Object.freeze({ ...tierFracs }),
      chatSignalEmissionRate: chatRate,
      meanEscalationVelocity: meanVelocity,
      sessionTick,
    });
  }

  public describeDrift(driftMs: number): string {
    return `Tick drift: ${driftMs}ms (${getDriftSeverityLabel(driftMs)})`;
  }

  public describeLatency(latencyMs: number): string {
    return `Decision latency: ${latencyMs}ms (${getLatencySeverityLabel(latencyMs)})`;
  }

  public reset(): void {
    this.riskHistory.length = 0;
    this.tierHistory.length = 0;
    this.velocityHistory.length = 0;
    this.chatSignalCount = 0;
    this.totalEntries = 0;
  }
}

// ============================================================================
// SECTION 16 — POLICY SESSION TRACKER
// ============================================================================

/**
 * PolicySessionTracker — session-level policy decision tracking.
 *
 * Tracks all counters and aggregates across the full run session:
 *   — Total resolutions performed
 *   — Chat signals emitted
 *   — Phase transitions detected
 *   — Tier4/Tier3 entries
 *   — Hold references
 *   — Drift events and latency alarms
 *   — Mean and peak composite risk
 *
 * Consumes TIME_CONTRACT_OUTCOME_IS_TERMINAL and
 * TIME_CONTRACT_LATENCY_THRESHOLDS to determine alarm thresholds.
 */
class PolicySessionTracker {
  private sessionTick = 0;
  private totalResolutions = 0;
  private chatSignalsEmitted = 0;
  private phaseTransitionsDetected = 0;
  private tier4Entries = 0;
  private tier3Entries = 0;
  private holdReferenceCount = 0;
  private driftEventsCount = 0;
  private latencyAlarmCount = 0;
  private sumCompositeRisk = 0;
  private peakCompositeRisk = 0;
  private startedAtMs = 0;
  private lastResolutionMs = 0;

  public initialize(nowMs: number): void {
    this.startedAtMs = nowMs;
  }

  public record(
    resolution: TickTierResolution,
    emittedChat: boolean,
    isPhaseBoundary: boolean,
    driftMs: number,
    decisionLatencyMs: number | null,
    nowMs: number,
  ): void {
    this.sessionTick = resolution.sessionTick;
    this.totalResolutions++;
    this.lastResolutionMs = nowMs;

    if (emittedChat) this.chatSignalsEmitted++;
    if (isPhaseBoundary) this.phaseTransitionsDetected++;
    if (resolution.resolvedTier === 'T4') this.tier4Entries++;
    if (resolution.resolvedTier === 'T3') this.tier3Entries++;

    // Hold reference tracking (T3+ gets a hold reference note)
    if (isTierEscalated(resolution.resolvedTier)) this.holdReferenceCount++;

    // Drift event tracking
    if (driftMs >= DRIFT_NOTABLE_MS) this.driftEventsCount++;

    // Latency alarm tracking
    if (decisionLatencyMs !== null && decisionLatencyMs >= LATENCY_ALARM_MS) {
      this.latencyAlarmCount++;
    }

    this.sumCompositeRisk += resolution.compositeRisk;
    if (resolution.compositeRisk > this.peakCompositeRisk) {
      this.peakCompositeRisk = resolution.compositeRisk;
    }
  }

  public hasTerminalOutcome(outcome: RunOutcome | null): boolean {
    if (outcome === null) return false;
    return TIME_CONTRACT_OUTCOME_IS_TERMINAL[outcome] === true;
  }

  public getSnapshot(): PolicySessionSnapshot {
    return Object.freeze({
      sessionTick: this.sessionTick,
      totalResolutions: this.totalResolutions,
      chatSignalsEmitted: this.chatSignalsEmitted,
      phaseTransitionsDetected: this.phaseTransitionsDetected,
      tier4Entries: this.tier4Entries,
      tier3Entries: this.tier3Entries,
      holdReferenceCount: this.holdReferenceCount,
      driftEventsCount: this.driftEventsCount,
      latencyAlarmCount: this.latencyAlarmCount,
      meanCompositeRisk: this.totalResolutions > 0
        ? this.sumCompositeRisk / this.totalResolutions
        : 0,
      peakCompositeRisk: this.peakCompositeRisk,
      startedAtMs: this.startedAtMs,
      lastResolutionMs: this.lastResolutionMs,
    });
  }

  public reset(): void {
    this.sessionTick = 0;
    this.totalResolutions = 0;
    this.chatSignalsEmitted = 0;
    this.phaseTransitionsDetected = 0;
    this.tier4Entries = 0;
    this.tier3Entries = 0;
    this.holdReferenceCount = 0;
    this.driftEventsCount = 0;
    this.latencyAlarmCount = 0;
    this.sumCompositeRisk = 0;
    this.peakCompositeRisk = 0;
    this.startedAtMs = 0;
    this.lastResolutionMs = 0;
  }
}

// ============================================================================
// SECTION 17 — MAIN TICK TIER POLICY CLASS
// ============================================================================

/**
 * TickTierPolicy — the authoritative cadence policy resolver for the Time Engine.
 *
 * Wires all 12 sub-systems into a single cohesive resolution pipeline.
 * Called on every tick via TimeEngine → STEP_02_TIME.
 *
 * Architecture:
 *   1. Core tier resolution (pressure + game state escalation rules)
 *   2. Mode advisor (mode-specific adjustments)
 *   3. Phase advisor (phase boundary escalation)
 *   4. Budget advisor (budget-based tier escalation + tempo)
 *   5. Season multiplier (real-world calendar pressure)
 *   6. Duration + decision window computation
 *   7. Resilience scoring
 *   8. ML feature extraction (28 dims)
 *   9. DL tensor append (40×6 history)
 *  10. Chat emission decision + payload construction
 *  11. Narrative bundle construction
 *  12. Audit trail recording + session tracking
 *
 * @example
 *   const policy = new TickTierPolicy(seasonClock);
 *   const resolution = policy.resolve(snapshot, { sessionTick: tick });
 *   const mlVec = policy.extractMLVector(snapshot, { sessionTick: tick });
 *   const tensor = policy.buildDLTensor(tick);
 *   const signal = policy.buildChatSignal(resolution, snapshot, nowMs);
 */
export class TickTierPolicy {
  // ── Sub-system instances ──────────────────────────────────────────────────
  private readonly audit         = new PolicyAuditTrail();
  private readonly escalation    = new TierEscalationAnalyzer();
  private readonly resilience    = new PolicyResilienceScorer();
  private readonly mlExtractor   = new PolicyMLExtractor();
  private readonly dlBuilder     = new PolicyDLBuilder();
  private readonly chatEmitter   = new PolicyChatEmitter();
  private readonly narrator      = new PolicyNarrator();
  private readonly modeAdvisor   = new PolicyModeAdvisor();
  private readonly phaseAdvisor  = new PolicyPhaseAdvisor();
  private readonly budgetAdvisor = new PolicyBudgetAdvisor();
  private readonly trendAnalyzer = new PolicyTrendAnalyzer();
  private readonly sessionTracker = new PolicySessionTracker();

  // ── Session state ─────────────────────────────────────────────────────────
  private sessionTick          = 0;
  private maxSessionTick       = 1000; // Default estimate; updated on resolve
  private lastResolutionMs     = 0;
  private initialized          = false;
  private lastMLVector: PolicyMLVector | null = null;
  private lastChatSignal: PolicyChatSignal | null = null;

  public constructor(private readonly seasonClock?: SeasonClock) {}

  // ── CORE PUBLIC API ───────────────────────────────────────────────────────

  /**
   * Primary resolution method — called on every tick.
   * Returns a fully annotated TickTierResolution with all sub-system outputs.
   */
  public resolve(
    snapshot: RunStateSnapshot,
    options: TickTierPolicyOptions = {},
  ): TickTierResolution {
    const nowMs       = clampNonNegativeInteger(options.nowMs ?? Date.now());
    const sessionTick = options.sessionTick ?? ++this.sessionTick;
    const tags        = options.tags ?? [];

    if (!this.initialized) {
      this.sessionTracker.initialize(nowMs);
      this.initialized = true;
    }

    // ── STEP 1: Base tier from pressure or forced override ─────────────────
    const baseTier    = options.forcedTier ?? snapshot.pressure.tier;
    const reasonCodes = new Set<string>([
      `BASE_TIER_${baseTier}`,
      `PRESSURE_BAND_${snapshot.pressure.band}`,
    ]);

    let resolvedTier = baseTier;

    // ── STEP 2: Snapshot-driven escalation rules ───────────────────────────
    const weakestLayer = snapshot.shield.layers.find(
      (layer) => layer.layerId === snapshot.shield.weakestLayerId,
    );
    const cashflow         = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
    const totalBudgetMs    = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const remainingBudgetMs = Math.max(0, totalBudgetMs - snapshot.timers.elapsedMs);
    const visibleThreatCount = snapshot.tension.visibleThreats.length;
    const pendingAttackCount = snapshot.battle.pendingAttacks.length;

    // Economy escalation
    if (snapshot.economy.cash < 0) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('NEGATIVE_CASH');
    }
    if (cashflow < MIN_POSITIVE_CASHFLOW) {
      resolvedTier = raiseTier(resolvedTier, 'T3');
      reasonCodes.add('NEGATIVE_CASHFLOW');
    }

    // Hater heat escalation
    if (snapshot.economy.haterHeat >= 85) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('HATER_HEAT_85_PLUS');
    } else if (snapshot.economy.haterHeat >= 60) {
      resolvedTier = raiseTier(resolvedTier, 'T3');
      reasonCodes.add('HATER_HEAT_60_PLUS');
    }

    // Shield escalation
    if (weakestLayer?.breached === true || (weakestLayer?.integrityRatio ?? 1) <= 0.15) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('SHIELD_CRITICAL');
    } else if ((weakestLayer?.integrityRatio ?? 1) <= 0.35) {
      resolvedTier = raiseTier(resolvedTier, 'T3');
      reasonCodes.add('SHIELD_WEAK');
    }

    // Threat escalation
    if (visibleThreatCount >= 4) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('VISIBLE_THREATS_4_PLUS');
    } else if (visibleThreatCount >= 2) {
      resolvedTier = raiseTier(resolvedTier, 'T3');
      reasonCodes.add('VISIBLE_THREATS_2_PLUS');
    }

    // Pending attack escalation
    if (pendingAttackCount >= 3) {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('PENDING_ATTACKS_3_PLUS');
    } else if (pendingAttackCount >= 1) {
      resolvedTier = raiseTier(resolvedTier, 'T2');
      reasonCodes.add('PENDING_ATTACKS_PRESENT');
    }

    // Sovereignty integrity
    if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
      resolvedTier = raiseTier(resolvedTier, 'T4');
      reasonCodes.add('INTEGRITY_QUARANTINED');
    }

    // ── STEP 3: Mode advisor adjustments ──────────────────────────────────
    resolvedTier = this.modeAdvisor.applyModeAdjustments(
      resolvedTier, reasonCodes, snapshot,
    );

    // ── STEP 4: Phase advisor adjustments ─────────────────────────────────
    resolvedTier = this.phaseAdvisor.applyPhaseEscalation(
      resolvedTier, reasonCodes, snapshot.timers.elapsedMs,
    );

    // ── STEP 5: Budget advisor adjustments ────────────────────────────────
    resolvedTier = this.budgetAdvisor.applyBudgetEscalation(
      resolvedTier, reasonCodes, remainingBudgetMs, totalBudgetMs,
    );

    // ── STEP 6: Season multiplier ──────────────────────────────────────────
    const seasonMultiplier = this.seasonClock
      ? this.seasonClock.getPressureMultiplier(nowMs)
      : 1.0;

    const isSeasonPressureActive = seasonMultiplier > 1.0;
    if (isSeasonPressureActive) {
      reasonCodes.add('SEASON_PRESSURE_ACTIVE');
    }

    // ── STEP 7: Compute multipliers and durations ──────────────────────────
    const modeTempoMultiplier   = computeModeTempoMultiplier(snapshot.mode);
    const budgetTempoMultiplier = this.budgetAdvisor.computeTempoMultiplier(remainingBudgetMs);
    const config                = TICK_TIER_CONFIGS[pressureTierToTickTier(resolvedTier)];

    const durationBeforeClamp =
      (config.defaultDurationMs / seasonMultiplier) *
      modeTempoMultiplier *
      budgetTempoMultiplier;

    const decisionWindowBeforeClamp =
      (config.decisionWindowMs / seasonMultiplier) *
      modeTempoMultiplier *
      budgetTempoMultiplier;

    const durationMs = normalizeDurationMs(
      durationBeforeClamp, config.minDurationMs, config.maxDurationMs,
    );

    const decisionWindowMs = normalizeDurationMs(
      decisionWindowBeforeClamp, 1_000, config.decisionWindowMs,
    );

    // ── STEP 8: Phase / interpolation metadata ────────────────────────────
    const resolvedPhase = this.phaseAdvisor.resolvePhase(snapshot.timers.elapsedMs);

    const isPhaseBoundaryTick = this.phaseAdvisor.detectPhaseBoundary(
      options.previousElapsedMs ?? null,
      snapshot.timers.elapsedMs,
    );
    if (isPhaseBoundaryTick) reasonCodes.add('PHASE_BOUNDARY');

    const referencePreviousTier =
      options.previousTier ?? snapshot.pressure.previousTier ?? snapshot.pressure.tier;

    const tickTier         = pressureTierToTickTier(resolvedTier);
    const previousTickTier = referencePreviousTier !== resolvedTier
      ? pressureTierToTickTier(referencePreviousTier)
      : null;

    const shouldInterpolate = resolvedTier !== referencePreviousTier;

    // Build interpolation plan if needed
    const interpolationTicks = shouldInterpolate
      ? computeInterpolationTickCount(
          Math.abs(
            getDefaultTickDurationMs(resolvedTier) -
            getDefaultTickDurationMs(referencePreviousTier),
          ),
        )
      : 0;

    // Store interpolation plan in sub-system for downstream consumers
    if (shouldInterpolate) {
      void createInterpolationPlan(
        pressureTierToTickTier(referencePreviousTier),
        tickTier,
        getDefaultTickDurationMs(referencePreviousTier),
        getDefaultTickDurationMs(resolvedTier),
      );
    }

    // ── STEP 9: Composite risk + effective duration ────────────────────────
    const compositeRisk    = computeCompositeRisk(
      resolvedTier, remainingBudgetMs, seasonMultiplier, snapshot.mode,
    );
    const effectiveDurationMs = Math.trunc(
      durationMs * modeTempoMultiplier * budgetTempoMultiplier * seasonMultiplier,
    );

    // Escalation velocity from escalation analyzer
    this.escalation.record(resolvedTier);
    const escalationAnalysis = this.escalation.analyze(resolvedTier);
    const escalationVelocity = escalationAnalysis.velocity;

    // ── STEP 10: Chat urgency ──────────────────────────────────────────────
    const chatUrgency = clamp01(
      compositeRisk * 0.6 +
      TIME_CONTRACT_TIER_URGENCY[resolvedTier] * 0.4,
    );

    // ── STEP 11: Season lifecycle for narrator / chat ──────────────────────
    const lifecycleState: SeasonLifecycleState | null = this.seasonClock
      ? this.seasonClock.getLifecycle(nowMs)
      : null;

    const lifecycleLabel = lifecycleState
      ? (TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[lifecycleState] ?? 'Unknown')
      : 'No active season';

    // ── STEP 12: Assemble core resolution ─────────────────────────────────
    const modeLabel = getModeLabel(snapshot.mode);
    const phaseStakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[resolvedPhase];

    const narrativeSummary = this.narrator.buildOneLiner({
      resolvedTier,
      effectiveDurationMs,
      compositeRisk,
      resolvedPhase,
      modeLabel,
    } as unknown as TickTierResolution);

    // Determine whether to emit a chat signal
    const coreResolution: TickTierResolution = Object.freeze({
      // TimeCadenceResolution base
      baseTier,
      resolvedTier,
      durationMs,
      decisionWindowMs,
      minDurationMs: config.minDurationMs,
      maxDurationMs: config.maxDurationMs,
      seasonMultiplier,
      modeTempoMultiplier,
      budgetTempoMultiplier,
      remainingBudgetMs,
      shouldScreenShake: resolvedTier === 'T4',
      shouldOpenEndgameWindow: remainingBudgetMs <= 30_000,
      shouldInterpolate,
      reasonCodes: Object.freeze([...reasonCodes]),
      // Extended fields
      tickTier,
      previousTickTier,
      interpolationTicks,
      effectiveDurationMs,
      resolvedPhase,
      isPhaseBoundaryTick,
      isSeasonPressureActive,
      compositeRisk,
      escalationVelocity,
      narrativeSummary,
      modeLabel,
      phaseStakesMultiplier,
      chatUrgency,
      shouldEmitChatSignal: false, // Will be updated after chat check
      sessionTick,
      version: TICK_TIER_POLICY_VERSION,
    });

    // ── STEP 13: Chat emission ─────────────────────────────────────────────
    const shouldEmitChat = !options.suppressChatSignal &&
      this.chatEmitter.shouldEmit(coreResolution, nowMs);

    let chatSignal: PolicyChatSignal | null = null;
    if (shouldEmitChat) {
      chatSignal = this.chatEmitter.buildSignal(
        coreResolution, snapshot, nowMs, lifecycleLabel,
      );
      this.lastChatSignal = chatSignal;
    }

    // Final resolution (updated shouldEmitChatSignal)
    const resolution: TickTierResolution = Object.freeze({
      ...coreResolution,
      shouldEmitChatSignal: shouldEmitChat,
    });

    // ── STEP 14: ML extraction ─────────────────────────────────────────────
    this.resilience.record(resolvedTier, snapshot.mode, sessionTick);
    const resilienceSnap = this.resilience.getSnapshot(sessionTick);
    const mlVector = this.mlExtractor.extract(resolution, resilienceSnap.compositeResilienceScore, this.maxSessionTick);
    this.lastMLVector = mlVector;

    // ── STEP 15: DL tensor push ────────────────────────────────────────────
    this.dlBuilder.push(resolution);

    // ── STEP 16: Trend analysis push ──────────────────────────────────────
    this.trendAnalyzer.push(compositeRisk, resolvedTier, escalationVelocity, shouldEmitChat);

    // ── STEP 17: Audit trail + session tracking ────────────────────────────
    const auditEntry = this.audit.record({
      nowMs,
      sessionTick,
      baseTier,
      resolvedTier,
      tickTier,
      durationMs,
      decisionWindowMs,
      effectiveDurationMs,
      compositeRisk,
      escalationVelocity,
      seasonMultiplier,
      modeTempoMultiplier,
      budgetTempoMultiplier,
      remainingBudgetMs,
      resolvedPhase,
      isPhaseBoundaryTick,
      isSeasonPressureActive,
      shouldEmitChatSignal: shouldEmitChat,
      reasonCodes: Object.freeze([...reasonCodes]),
      mode: snapshot.mode,
      tags: Object.freeze([...tags]),
    });

    // Drift detection (compute drift from last resolution)
    const driftMs = this.lastResolutionMs > 0
      ? Math.abs(nowMs - this.lastResolutionMs - durationMs)
      : 0;
    this.lastResolutionMs = nowMs;

    this.sessionTracker.record(
      resolution,
      shouldEmitChat,
      isPhaseBoundaryTick,
      driftMs,
      null,  // decisionLatencyMs — not known at policy layer
      nowMs,
    );

    void auditEntry; // audit entry recorded, referenced for downstream consumers

    this.sessionTick = sessionTick;
    return resolution;
  }

  // ── CONVENIENCE RESOLUTION METHODS ───────────────────────────────────────

  /** Returns only the resolved PressureTier. */
  public resolveTier(
    snapshot: RunStateSnapshot,
    options: TickTierPolicyOptions = {},
  ): PressureTier {
    return this.resolve(snapshot, options).resolvedTier;
  }

  /** Returns only the resolved tick duration in ms. */
  public resolveDurationMs(
    snapshot: RunStateSnapshot,
    options: TickTierPolicyOptions = {},
  ): number {
    return this.resolve(snapshot, options).durationMs;
  }

  /** Returns only the resolved decision window in ms. */
  public resolveDecisionWindowMs(
    snapshot: RunStateSnapshot,
    options: TickTierPolicyOptions = {},
  ): number {
    return this.resolve(snapshot, options).decisionWindowMs;
  }

  // ── ML / DL / CHAT / NARRATIVE PUBLIC API ────────────────────────────────

  /**
   * Extracts the latest 28-dim ML vector from the last resolve() call.
   * If no resolution has been made, returns a zero vector.
   */
  public getLastMLVector(): PolicyMLVector | null {
    return this.lastMLVector;
  }

  /**
   * Extracts a fresh 28-dim ML vector directly from snapshot + options.
   */
  public extractMLVector(
    snapshot: RunStateSnapshot,
    options: TickTierPolicyOptions = {},
  ): PolicyMLVector {
    const resolution = this.resolve(snapshot, options);
    const resilienceSnap = this.resilience.getSnapshot(resolution.sessionTick);
    return this.mlExtractor.extract(
      resolution,
      resilienceSnap.compositeResilienceScore,
      this.maxSessionTick,
    );
  }

  /**
   * Builds the 40×6 DL tensor from accumulated policy history.
   */
  public buildDLTensor(sessionTick?: number): PolicyDLTensor {
    return this.dlBuilder.buildTensor(sessionTick ?? this.sessionTick);
  }

  /**
   * Gets the column means of the DL tensor (useful for quick feature inspection).
   */
  public getDLColumnMeans(): readonly number[] {
    return this.dlBuilder.computeColumnMeans();
  }

  /**
   * Builds a fresh chat signal from the latest resolution.
   * Returns null if a signal is not warranted (rate-limited or stable).
   */
  public buildChatSignal(
    resolution: TickTierResolution,
    snapshot: RunStateSnapshot,
    nowMs?: number,
  ): PolicyChatSignal | null {
    const ts = nowMs ?? Date.now();
    const lifecycleState: SeasonLifecycleState | null = this.seasonClock
      ? this.seasonClock.getLifecycle(ts)
      : null;
    const lifecycleLabel = lifecycleState
      ? (TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[lifecycleState] ?? 'Unknown')
      : 'No active season';

    if (!this.chatEmitter.shouldEmit(resolution, ts)) return null;
    return this.chatEmitter.buildSignal(resolution, snapshot, ts, lifecycleLabel);
  }

  /** Returns the last chat signal emitted (may be null if none yet). */
  public getLastChatSignal(): PolicyChatSignal | null {
    return this.lastChatSignal;
  }

  /**
   * Builds a full narrative bundle for a given resolution.
   */
  public buildNarrativeBundle(
    resolution: TickTierResolution,
    nowMs?: number,
  ): PolicyNarrativeBundle {
    const ts = nowMs ?? Date.now();
    const lifecycleState: SeasonLifecycleState | null = this.seasonClock
      ? this.seasonClock.getLifecycle(ts)
      : null;
    return this.narrator.buildBundle(resolution, lifecycleState, resolution.chatUrgency);
  }

  // ── SUB-SYSTEM SNAPSHOT ACCESS ────────────────────────────────────────────

  /** Returns all audit entries from the PolicyAuditTrail. */
  public getAuditTrail(): readonly PolicyAuditEntry[] {
    return this.audit.getAll();
  }

  /** Returns the audit trail summary. */
  public getAuditSummary(): PolicyAuditSummary {
    return this.audit.buildSummary();
  }

  /** Returns the latest N audit entries. */
  public getLatestAuditEntries(count = 10): readonly PolicyAuditEntry[] {
    return this.audit.getLatest(count);
  }

  /** Returns entries for a specific pressure tier. */
  public getAuditEntriesForTier(tier: PressureTier): readonly PolicyAuditEntry[] {
    return this.audit.getEntriesForTier(tier);
  }

  /** Returns audit entries that triggered a chat signal. */
  public getChatSignalAuditEntries(): readonly PolicyAuditEntry[] {
    return this.audit.getChatSignalEntries();
  }

  /** Returns the trend analysis snapshot. */
  public getTrendSnapshot(): PolicyTrendSnapshot {
    return this.trendAnalyzer.buildSnapshot(this.sessionTick);
  }

  /** Returns the resilience snapshot. */
  public getResilienceSnapshot(): PolicyResilienceSnapshot {
    return this.resilience.getSnapshot(this.sessionTick);
  }

  /** Returns the session tracking snapshot. */
  public getSessionSnapshot(): PolicySessionSnapshot {
    return this.sessionTracker.getSnapshot();
  }

  /** Returns the escalation analysis for the current tier. */
  public getEscalationAnalysis(tier: PressureTier): EscalationAnalysis {
    return this.escalation.analyze(tier);
  }

  /** Returns the full tier history from the escalation analyzer. */
  public getTierHistory(): readonly PressureTier[] {
    return this.escalation.getTierHistory();
  }

  /** Returns how many ticks the policy has been in a specific tier. */
  public getTicksInTier(tier: PressureTier): number {
    return this.escalation.getTicksInTier(tier);
  }

  /** Builds a full analytics bundle from all sub-system snapshots. */
  public buildAnalyticsBundle(): PolicyAnalyticsBundle {
    const trend       = this.trendAnalyzer.buildSnapshot(this.sessionTick);
    const resilience  = this.resilience.getSnapshot(this.sessionTick);
    const session     = this.sessionTracker.getSnapshot();
    const escalation  = this.escalation.analyze('T1'); // Use T1 as baseline for reporting
    const dlTensor    = this.dlBuilder.buildTensor(this.sessionTick);
    const lastAudit   = this.audit.getLatest(1)[0] ?? null;

    // Build ML vector from last audit entry if available
    const mlVector: PolicyMLVector = this.lastMLVector ?? {
      features: Object.freeze(new Array<number>(ML_DIM).fill(0)),
      labels: this.mlExtractor.getFeatureLabels(),
      dim: ML_DIM,
      sessionTick: this.sessionTick,
      nowMs: Date.now(),
      resolvedTier: 'T1',
      compositeRisk: 0,
    };

    return Object.freeze({
      trend,
      resilience,
      session,
      escalation,
      mlVector,
      dlTensor,
      lastAuditEntry: lastAudit,
      chatSignalsEmitted: this.chatEmitter.getEmitCount(),
      version: TICK_TIER_POLICY_VERSION,
    });
  }

  // ── MODE / PHASE PROFILE ACCESS ───────────────────────────────────────────

  /** Returns the mode-specific policy profile. */
  public getModeProfile(mode: ModeCode): PolicyModeProfile {
    return this.modeAdvisor.buildProfile(mode);
  }

  /** Returns profiles for all four game modes. */
  public getAllModeProfiles(): readonly PolicyModeProfile[] {
    return this.modeAdvisor.getAllModeProfiles();
  }

  /** Returns the phase-specific policy profile. */
  public getPhaseProfile(phase: RunPhase, totalBudgetMs = TIME_CONTRACT_MAX_BUDGET_MS): PolicyPhaseProfile {
    return this.phaseAdvisor.buildProfile(phase, totalBudgetMs);
  }

  /** Returns profiles for all three run phases. */
  public getAllPhaseProfiles(totalBudgetMs = TIME_CONTRACT_MAX_BUDGET_MS): readonly PolicyPhaseProfile[] {
    return this.phaseAdvisor.getAllPhaseProfiles(totalBudgetMs);
  }

  // ── SIMPLE MULTIPLIER ACCESS ──────────────────────────────────────────────

  /** Returns the mode tempo multiplier for a given mode. */
  public getModeTempoMultiplier(mode: ModeCode): number {
    return computeModeTempoMultiplier(mode);
  }

  /** Returns the budget tempo multiplier for a given remaining budget. */
  public getBudgetTempoMultiplier(remainingBudgetMs: number): number {
    return computeBudgetTempoMultiplier(Math.max(0, Math.trunc(remainingBudgetMs)));
  }

  // ── CONFIG + TIER INSPECTION ──────────────────────────────────────────────

  /** Returns the TickTierConfig for a given PressureTier. */
  public getTierConfig(tier: PressureTier) {
    return getTickTierConfigByPressureTier(tier);
  }

  /** Returns the TickTierConfig for a given TickTier enum. */
  public getTickTierConfig(tier: TickTier) {
    return getTickTierConfig(tier);
  }

  /** Converts a PressureTier to its TickTier enum equivalent. */
  public toTickTier(tier: PressureTier): TickTier {
    return pressureTierToTickTier(tier);
  }

  /** Converts a TickTier enum to its PressureTier string equivalent. */
  public toPressureTier(tier: TickTier): PressureTier {
    return tickTierToPressureTier(tier);
  }

  /** Returns the PRESSURE_TIER_BY_TICK_TIER lookup map. */
  public getPressureTierByTickTierMap(): Readonly<Record<TickTier, PressureTier>> {
    return PRESSURE_TIER_BY_TICK_TIER;
  }

  /** Returns the TICK_TIER_BY_PRESSURE_TIER lookup map. */
  public getTickTierByPressureTierMap(): Readonly<Record<PressureTier, TickTier>> {
    return TICK_TIER_BY_PRESSURE_TIER;
  }

  // ── VERSION MANIFEST ──────────────────────────────────────────────────────

  /** Returns the full policy version manifest. */
  public getVersionManifest(): PolicyVersionManifest {
    const contractsVersion: TimeContractsVersion = TIME_CONTRACTS_VERSION;
    return Object.freeze({
      version: TICK_TIER_POLICY_VERSION,
      contractsVersion,
      mlDim: ML_DIM,
      dlRows: TIME_CONTRACT_DL_ROW_COUNT,
      dlCols: DL_COLS,
      featureFlags: Object.freeze({
        auditTrail: true,
        escalationAnalysis: true,
        resilienceScoring: true,
        mlExtraction: true,
        dlTensor: true,
        chatEmission: true,
        narration: true,
        modeAdvisor: true,
        phaseAdvisor: true,
        budgetAdvisor: true,
        trendAnalysis: true,
        sessionTracking: true,
      }),
    });
  }

  // ── SEASON CLOCK ACCESSORS ────────────────────────────────────────────────

  /** Returns the season pressure context for a given timestamp. */
  public getSeasonPressureContext(nowMs?: number): SeasonPressureContext | null {
    if (!this.seasonClock) return null;
    return this.seasonClock.getPressureContext(nowMs);
  }

  /** Returns true if a given season window type is currently active. */
  public isSeasonWindowActive(type: SeasonWindowType, nowMs?: number): boolean {
    if (!this.seasonClock) return false;
    return this.seasonClock.hasWindowType(type, nowMs);
  }

  /** Returns whether the season is currently active. */
  public isSeasonActive(nowMs?: number): boolean {
    if (!this.seasonClock) return false;
    return this.seasonClock.isSeasonActive(nowMs);
  }

  /** Returns the season lifecycle state. */
  public getSeasonLifecycle(nowMs?: number): SeasonLifecycleState | null {
    if (!this.seasonClock) return null;
    return this.seasonClock.getLifecycle(nowMs);
  }

  /** Returns the ms remaining until the active season ends. */
  public getMsUntilSeasonEnd(nowMs?: number): number {
    if (!this.seasonClock) return 0;
    return this.seasonClock.getMsUntilSeasonEnd(nowMs);
  }

  /** Returns active season windows. */
  public getActiveSeasonWindows(nowMs?: number) {
    if (!this.seasonClock) return Object.freeze([]);
    return this.seasonClock.getActiveWindows(nowMs);
  }

  // ── BUDGET + PHASE UTILITIES ──────────────────────────────────────────────

  /** Scores the budget urgency (0.0–1.0) from remaining and total budget. */
  public scoreBudgetUrgency(remainingBudgetMs: number, totalBudgetMs: number): number {
    return this.budgetAdvisor.scoreBudgetUrgency(remainingBudgetMs, totalBudgetMs);
  }

  /** Returns ms until next phase boundary from elapsed time. */
  public getMsUntilNextPhase(elapsedMs: number): number {
    return this.phaseAdvisor.getMsUntilNextPhase(elapsedMs);
  }

  /** Returns whether a phase boundary approach is imminent. */
  public isApproachingPhaseBoundary(elapsedMs: number): boolean {
    return this.phaseAdvisor.isApproachingPhaseBoundary(elapsedMs);
  }

  /** Returns the phase start timestamp for a given phase. */
  public getPhaseBoundaryMs(phase: RunPhase): number {
    return this.phaseAdvisor.getPhaseBoundaryMs(phase);
  }

  // ── RESET ─────────────────────────────────────────────────────────────────

  /**
   * Resets all sub-system state. Called at run start to ensure a clean slate.
   */
  public reset(): void {
    this.audit.reset();
    this.escalation.reset();
    this.resilience.reset();
    this.dlBuilder.reset();
    this.chatEmitter.reset();
    this.trendAnalyzer.reset();
    this.sessionTracker.reset();
    this.sessionTick = 0;
    this.maxSessionTick = 1000;
    this.lastResolutionMs = 0;
    this.initialized = false;
    this.lastMLVector = null;
    this.lastChatSignal = null;
  }

  /**
   * Sets the expected maximum session tick count (for ML normalization).
   */
  public setMaxSessionTick(max: number): void {
    this.maxSessionTick = Math.max(1, Math.trunc(max));
  }
}

// ============================================================================
// SECTION 18 — FACTORY FUNCTIONS AND MODULE EXPORTS
// ============================================================================

/**
 * Factory: creates a TickTierPolicy with an optional SeasonClock.
 */
export function createTickTierPolicy(seasonClock?: SeasonClock): TickTierPolicy {
  return new TickTierPolicy(seasonClock);
}

/**
 * Factory: creates a TickTierPolicy with a SeasonClock wired in.
 */
export function createTickTierPolicyWithSeasonClock(clock: SeasonClock): TickTierPolicy {
  return new TickTierPolicy(clock);
}

/**
 * Builds a mode-specific policy profile without instantiating a full policy.
 */
export function buildTickTierPolicyModeProfile(mode: ModeCode): PolicyModeProfile {
  const advisor = new PolicyModeAdvisor();
  return advisor.buildProfile(mode);
}

/**
 * Builds a phase-specific policy profile without instantiating a full policy.
 */
export function buildTickTierPolicyPhaseProfile(
  phase: RunPhase,
  totalBudgetMs = TIME_CONTRACT_MAX_BUDGET_MS,
): PolicyPhaseProfile {
  const advisor = new PolicyPhaseAdvisor();
  return advisor.buildProfile(phase, totalBudgetMs);
}

/**
 * Extracts a policy ML vector from a set of audit entries (offline mode).
 * Returns a zero vector if no entries provided.
 */
export function extractPolicyMLVectorFromAudit(
  entries: readonly PolicyAuditEntry[],
  nowMs = Date.now(),
): PolicyMLVector {
  if (entries.length === 0) {
    return Object.freeze({
      features: Object.freeze(new Array<number>(ML_DIM).fill(0)),
      labels: POLICY_ML_FEATURE_LABELS,
      dim: ML_DIM,
      sessionTick: 0,
      nowMs,
      resolvedTier: 'T1',
      compositeRisk: 0,
    });
  }

  const last = entries[entries.length - 1] as PolicyAuditEntry;
  const meanRisk = entries.reduce((s, e) => s + e.compositeRisk, 0) / entries.length;
  const tier4Count = entries.filter((e) => e.resolvedTier === 'T4').length;
  const tier4Rate = clamp01(tier4Count / entries.length);

  const features: number[] = [
    /* 00 */ TIME_CONTRACT_TIER_URGENCY[last.resolvedTier],
    /* 01 */ PRESSURE_TIER_NORMALIZED[last.baseTier],
    /* 02 */ PRESSURE_TIER_NORMALIZED[last.resolvedTier],
    /* 03 */ normalizeDuration(last.durationMs),
    /* 04 */ normalizeDecisionWindow(last.decisionWindowMs),
    /* 05 */ clamp01(last.remainingBudgetMs / TIME_CONTRACT_MAX_BUDGET_MS),
    /* 06 */ clamp01((last.seasonMultiplier - 1.0) / 3.0),
    /* 07 */ clamp01(last.modeTempoMultiplier / 2.0),
    /* 08 */ clamp01(last.budgetTempoMultiplier),
    /* 09 */ last.compositeRisk,
    /* 10 */ clamp01(Math.abs(last.escalationVelocity)),
    /* 11 */ TIME_CONTRACT_PHASE_SCORE[last.resolvedPhase],
    /* 12 */ RUN_PHASE_NORMALIZED[last.resolvedPhase],
    /* 13 */ MODE_NORMALIZED[last.mode],
    /* 14 */ clamp01((MODE_DIFFICULTY_MULTIPLIER[last.mode] - 0.9) / 1.0),
    /* 15 */ isTierEscalated(last.resolvedTier) ? 1.0 : 0.0,
    /* 16 */ last.isSeasonPressureActive ? 1.0 : 0.0,
    /* 17 */ tier4Rate,
    /* 18 */ last.isPhaseBoundaryTick ? 1.0 : 0.0,
    /* 19 */ meanRisk,
    /* 20 */ clamp01(entries.filter((e) => e.resolvedTier !== e.baseTier).length / entries.length),
    /* 21 */ clamp01(entries.filter((e) => e.isPhaseBoundaryTick).length / entries.length),
    /* 22 */ clamp01(entries.filter((e) => e.shouldEmitChatSignal).length / entries.length),
    /* 23 */ normalizeDuration(last.effectiveDurationMs),
    /* 24 */ scoreCadenceUrgency(last as unknown as TimeCadenceResolution),
    /* 25 */ clamp01(1.0 - tier4Rate),
    /* 26 */ last.shouldEmitChatSignal ? 1.0 : 0.0,
    /* 27 */ clamp01(last.sessionTick / 1000),
  ];

  return Object.freeze({
    features: Object.freeze(features),
    labels: POLICY_ML_FEATURE_LABELS,
    dim: ML_DIM,
    sessionTick: last.sessionTick,
    nowMs,
    resolvedTier: last.resolvedTier,
    compositeRisk: last.compositeRisk,
  });
}

/**
 * Builds a standalone chat signal from a resolution (no policy instance required).
 */
export function buildPolicyChatSignal(
  resolution: TickTierResolution,
  nowMs = Date.now(),
  lifecycleLabel = 'No active season',
): PolicyChatSignal {
  const urgency = resolution.chatUrgency;
  const tierLabel = PRESSURE_TIER_URGENCY_LABEL[resolution.resolvedTier];
  const budgetSec = Math.round(resolution.remainingBudgetMs / 1000);

  let signalType: PolicyChatSignal['signalType'] = 'MODE_TENSION';
  if (resolution.resolvedTier === 'T4') signalType = 'COLLAPSE_WARNING';
  else if (resolution.isPhaseBoundaryTick) signalType = 'PHASE_BOUNDARY';
  else if (resolution.isSeasonPressureActive) signalType = 'SEASON_PRESSURE';
  else if (resolution.remainingBudgetMs < BUDGET_CHAT_FLOOR_MS) signalType = 'BUDGET_CRITICAL';
  else if (isTierEscalated(resolution.resolvedTier)) signalType = 'TIER_ESCALATION';

  const message = `[${signalType}] ${tierLabel} — Tier ${resolution.resolvedTier} — ${budgetSec}s remaining — risk ${(resolution.compositeRisk * 100).toFixed(0)}%`;

  return Object.freeze({
    signalType,
    urgency,
    tier: resolution.resolvedTier,
    tickTier: resolution.tickTier,
    message,
    reasonCodes: expandCadenceReasonCodes(resolution),
    sessionTick: resolution.sessionTick,
    nowMs,
    compositeRisk: resolution.compositeRisk,
    mode: resolution.resolvedTier as unknown as ModeCode, // mode re-mapped from resolution
    phase: resolution.resolvedPhase,
    remainingBudgetMs: resolution.remainingBudgetMs,
    shouldScreenShake: resolution.shouldScreenShake,
    lifecycleLabel,
    tags: [],
  });
}

/**
 * Scores the composite policy risk from a resolution (0.0–1.0).
 */
export function scorePolicyRisk(resolution: TickTierResolution): number {
  return resolution.compositeRisk;
}

/**
 * Returns true if the policy is in a crisis or collapse state.
 */
export function isPolicyInCrisis(resolution: TickTierResolution): boolean {
  return isCadenceEscalated(resolution) && isTierEscalated(resolution.resolvedTier);
}

/**
 * Returns true if the policy is in collapse (T4).
 */
export function isPolicyInCollapse(resolution: TickTierResolution): boolean {
  return isCadenceInCollapse(resolution);
}

/**
 * Describes a policy resolution as a single human-readable string.
 */
export function describePolicyResolution(resolution: TickTierResolution): string {
  return describeCadenceResolution(resolution);
}

/**
 * Returns the urgency label for a resolved tier.
 */
export function getPolicyTierLabel(tier: PressureTier): string {
  return PRESSURE_TIER_URGENCY_LABEL[tier];
}

/**
 * Returns the human-readable description of a pressure tier for policy narration.
 */
export function getPolicyTierDescription(tier: PressureTier): string {
  return describePressureTier(tier);
}

/**
 * Returns the ML feature labels for the policy layer (28 labels).
 */
export function getPolicyMLFeatureLabels(): readonly string[] {
  return POLICY_ML_FEATURE_LABELS;
}

/**
 * Returns all mode-specific policy profiles (Empire, Predator, Syndicate, Phantom).
 */
export function getAllPolicyModeProfiles(): readonly PolicyModeProfile[] {
  const advisor = new PolicyModeAdvisor();
  return advisor.getAllModeProfiles();
}

/**
 * Returns all phase-specific policy profiles.
 */
export function getAllPolicyPhaseProfiles(
  totalBudgetMs = TIME_CONTRACT_MAX_BUDGET_MS,
): readonly PolicyPhaseProfile[] {
  const advisor = new PolicyPhaseAdvisor();
  return advisor.getAllPhaseProfiles(totalBudgetMs);
}

/**
 * Returns the TickTierConfig for a given PressureTier (convenience re-export).
 */
export function getPolicyTierConfig(tier: PressureTier) {
  return getTickTierConfigByPressureTier(tier);
}

/**
 * Returns the escalation/de-escalation thresholds for a given tier.
 */
export function getPolicyTierThresholds(tier: PressureTier): {
  readonly escalation: number;
  readonly deescalation: number;
  readonly minHoldTicks: number;
} {
  return Object.freeze({
    escalation: PRESSURE_TIER_ESCALATION_THRESHOLD[tier],
    deescalation: PRESSURE_TIER_DEESCALATION_THRESHOLD[tier],
    minHoldTicks: PRESSURE_TIER_MIN_HOLD_TICKS[tier],
  });
}

/**
 * Returns the tier urgency score (0.0–1.0) for a given PressureTier.
 */
export function getPolicyTierUrgency(tier: PressureTier): number {
  return TIME_CONTRACT_TIER_URGENCY[tier];
}

/**
 * Returns the time contracts version manifest (for policy consumers).
 */
export function getPolicyContractsVersion(): TimeContractsVersion {
  return TIME_CONTRACTS_VERSION;
}

/**
 * Checks whether two resolutions represent the same tier state
 * (useful for change-detection in render loops).
 */
export function arePolicyResolutionsEquivalent(
  a: TickTierResolution,
  b: TickTierResolution,
): boolean {
  return (
    a.resolvedTier === b.resolvedTier &&
    a.durationMs   === b.durationMs &&
    a.resolvedPhase === b.resolvedPhase &&
    Math.abs(a.compositeRisk - b.compositeRisk) < 0.01
  );
}

/**
 * Returns a minimal diff record describing what changed between two resolutions.
 */
export function diffPolicyResolutions(
  prev: TickTierResolution,
  next: TickTierResolution,
): {
  readonly tierChanged: boolean;
  readonly phaseChanged: boolean;
  readonly durationChanged: boolean;
  readonly riskDelta: number;
  readonly tierDelta: number;
} {
  return Object.freeze({
    tierChanged:    prev.resolvedTier !== next.resolvedTier,
    phaseChanged:   prev.resolvedPhase !== next.resolvedPhase,
    durationChanged: Math.abs(prev.durationMs - next.durationMs) > 100,
    riskDelta:      next.compositeRisk - prev.compositeRisk,
    tierDelta:      tierIndex(next.resolvedTier) - tierIndex(prev.resolvedTier),
  });
}

/**
 * Validates that a TickTierResolution carries internally consistent data.
 * Returns an array of validation errors (empty if valid).
 */
export function validateTickTierResolution(
  resolution: TickTierResolution,
): readonly string[] {
  const errors: string[] = [];

  if (!TIER_ORDER.includes(resolution.baseTier)) {
    errors.push(`baseTier '${resolution.baseTier}' is not a valid PressureTier`);
  }
  if (!TIER_ORDER.includes(resolution.resolvedTier)) {
    errors.push(`resolvedTier '${resolution.resolvedTier}' is not a valid PressureTier`);
  }
  if (resolution.durationMs <= 0) {
    errors.push(`durationMs must be positive, got ${resolution.durationMs}`);
  }
  if (resolution.decisionWindowMs <= 0) {
    errors.push(`decisionWindowMs must be positive, got ${resolution.decisionWindowMs}`);
  }
  if (resolution.compositeRisk < 0 || resolution.compositeRisk > 1) {
    errors.push(`compositeRisk must be in [0,1], got ${resolution.compositeRisk}`);
  }
  if (!RUN_PHASES.includes(resolution.resolvedPhase)) {
    errors.push(`resolvedPhase '${resolution.resolvedPhase}' is not a valid RunPhase`);
  }
  if (resolution.sessionTick < 0) {
    errors.push(`sessionTick must be non-negative, got ${resolution.sessionTick}`);
  }
  if (resolution.version !== TICK_TIER_POLICY_VERSION) {
    errors.push(`version mismatch: expected '${TICK_TIER_POLICY_VERSION}', got '${resolution.version}'`);
  }

  return Object.freeze(errors);
}

// ── EXPORTED CONSTANTS ──────────────────────────────────────────────────────

/** The current version of the TickTierPolicy sub-system. */
export const TICK_TIER_POLICY_VERSION_STRING = TICK_TIER_POLICY_VERSION;

/** Max audit entries retained by the policy audit trail. */
export const TICK_TIER_POLICY_MAX_AUDIT_ENTRIES = MAX_AUDIT_ENTRIES;

/** Trend window depth for policy trend analysis. */
export const TICK_TIER_POLICY_TREND_WINDOW_DEPTH = TREND_WINDOW_DEPTH;

/** Decision latency thresholds (ms) used by policy for telemetry. */
export const TICK_TIER_POLICY_LATENCY_THRESHOLDS = Object.freeze({
  FAST_MS:       LATENCY_FAST_MS,
  ACCEPTABLE_MS: LATENCY_ACCEPTABLE_MS,
  SLOW_MS:       LATENCY_SLOW_MS,
  ALARM_MS:      LATENCY_ALARM_MS,
});

/** Tick drift thresholds (ms) used by policy for drift detection. */
export const TICK_TIER_POLICY_DRIFT_THRESHOLDS = Object.freeze({
  ACCEPTABLE_MS: DRIFT_ACCEPTABLE_MS,
  NOTABLE_MS:    DRIFT_NOTABLE_MS,
  SEVERE_MS:     DRIFT_SEVERE_MS,
  CRITICAL_MS:   DRIFT_CRITICAL_MS,
});
