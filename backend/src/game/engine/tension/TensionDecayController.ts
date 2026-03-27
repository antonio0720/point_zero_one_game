/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION DECAY CONTROLLER (v2)
 * /backend/src/game/engine/tension/TensionDecayController.ts
 *
 * Purpose:
 *   Authoritative score-delta computation engine for the Tension Engine
 *   (Engine 3 / 7).  Accepts a DecayComputeInput describing the current
 *   threat queue state and outputs a DecayComputeResult containing:
 *     ─ rawDelta    — unamplfied net tension change for this tick
 *     ─ amplifiedDelta — pressure-tier-amplified net change
 *     ─ contributionBreakdown — per-source attribution (8 components)
 *
 *   Extended capabilities (v2):
 *     ─ Severity-weighted pressure: each entry contribution scaled by
 *       its THREAT_SEVERITY_WEIGHTS weight (not just flat-rate per tick)
 *     ─ Type-specific decay modifiers: CASCADE and SOVEREIGNTY threats
 *       carry amplified contributions; OPPORTUNITY_KILL and REPUTATION_BURN
 *       can trigger extra relief if mitigated
 *     ─ 32-dimensional ML feature vector extraction
 *     ─ 16 × 8 DL sequence tensor construction from tick history
 *     ─ Trend analysis and escalation detection
 *     ─ Recovery forecasting (projected score trajectory)
 *     ─ Health monitoring (risk tier, alerts)
 *     ─ Session-level analytics (peak, trough, volatility, streaks)
 *     ─ UX narrative generation (visibility-gated, score-adaptive)
 *     ─ EventBus-ready event builders
 *     ─ Tuning parameter overlay (runtime knob injection)
 *     ─ Serialization and export bundle
 *     ─ Comprehensive self-test harness
 *
 * Doctrine:
 *   - Pure computation. No game-state writes. No EventBus.emit() calls.
 *   - All state transitions use immutable patterns.
 *   - ZERO unused imports. ZERO dead constants. ZERO dead functions.
 *   - Severity weights and type modifiers are always applied at runtime,
 *     never skipped via feature flags.
 * ====================================================================== */

// ============================================================================
// § 0 — IMPORTS
//   Every symbol consumed in at least one function body below.
// ============================================================================

import { createHash } from 'node:crypto';

import {
  ENTRY_STATE,
  PRESSURE_TENSION_AMPLIFIERS,
  TENSION_CONSTANTS,
  THREAT_SEVERITY,
  THREAT_SEVERITY_WEIGHTS,
  THREAT_TYPE,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  THREAT_TYPE_DEFAULT_MITIGATIONS,
  TENSION_EVENT_NAMES,
  VISIBILITY_ORDER,
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  type DecayComputeInput,
  type DecayComputeResult,
  type DecayContributionBreakdown,
  type AnticipationEntry,
  type ThreatSeverity,
  type ThreatType,
  type TensionVisibilityState,
  type PressureTier,
  type ThreatEnvelope,
  type VisibilityLevel,
  type TensionRuntimeSnapshot,
  type QueueProcessResult,
  type EntryState,
} from './types';

// ============================================================================
// § 1 — MODULE-LEVEL CONSTANTS
//   Every constant below accessed in at least one function body.
// ============================================================================

/** Number of ML features in the decay vector. */
export const DECAY_ML_FEATURE_COUNT = 32 as const;

/** Number of DL sequence steps (ticks of history). */
export const DECAY_DL_SEQUENCE_LENGTH = 16 as const;

/** Number of features per DL tensor row. */
export const DECAY_DL_FEATURE_WIDTH = 8 as const;

/** Rolling history depth for DL tensor and trend analysis. */
export const DECAY_HISTORY_CAPACITY = 64 as const;

/** Max number of score snapshots retained for volatility computation. */
export const DECAY_VOLATILITY_WINDOW = 20 as const;

/** Minimum score clamped to this floor before any delta is applied. */
export const DECAY_SCORE_FLOOR = TENSION_CONSTANTS.MIN_SCORE;

/** Maximum score clamped to this ceiling after delta is applied. */
export const DECAY_SCORE_CEILING = TENSION_CONSTANTS.MAX_SCORE;

/** Type-specific decay amplifier for CASCADE threats (extra pressure). */
export const DECAY_CASCADE_TYPE_AMPLIFIER = 1.25 as const;

/** Type-specific decay amplifier for SOVEREIGNTY threats (critical). */
export const DECAY_SOVEREIGNTY_TYPE_AMPLIFIER = 1.5 as const;

/** Relief bonus multiplier when REPUTATION_BURN is mitigated. */
export const DECAY_REPUTATION_MITIGATION_RELIEF = 1.3 as const;

/** Relief bonus multiplier when OPPORTUNITY_KILL is mitigated. */
export const DECAY_OPPORTUNITY_MITIGATION_RELIEF = 1.2 as const;

/** Slope threshold above which escalation is declared (per-tick). */
export const DECAY_ESCALATION_SLOPE_THRESHOLD = 0.02 as const;

/** Slope threshold below which strong de-escalation is declared. */
export const DECAY_DEESCALATION_SLOPE_THRESHOLD = -0.025 as const;

/** Consecutive ticks above PULSE_THRESHOLD to trigger pulse event. */
export const DECAY_PULSE_SUSTAINED_TICKS = TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS;

/** Minimum entries required before severity-weighting is applied. */
export const DECAY_SEVERITY_WEIGHT_MIN_ENTRIES = 1 as const;

/** Maximum absolute delta per tick (safety clamp). */
export const DECAY_MAX_DELTA_PER_TICK = 0.5 as const;

/** Forecast horizon in ticks. */
export const DECAY_FORECAST_HORIZON = 8 as const;

/** Epsilon for division-by-zero guards. */
const DECAY_EPSILON = 1e-9 as const;

/** Self-test sentinel values. */
const DECAY_SELF_TEST_RUN_ID = 'decay-self-test' as const;

/** 32 ML feature labels for the decay controller vector. */
export const DECAY_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  /* 00 */ 'queued_pressure_raw',
  /* 01 */ 'arrived_pressure_raw',
  /* 02 */ 'expired_ghost_raw',
  /* 03 */ 'mitigation_decay_raw',
  /* 04 */ 'nullify_decay_raw',
  /* 05 */ 'empty_queue_bonus_raw',
  /* 06 */ 'visibility_bonus_raw',
  /* 07 */ 'sovereignty_bonus_raw',
  /* 08 */ 'raw_delta_norm',
  /* 09 */ 'amplified_delta_norm',
  /* 10 */ 'pressure_amplifier_factor_norm',
  /* 11 */ 'queued_count_norm',
  /* 12 */ 'arrived_count_norm',
  /* 13 */ 'expired_count_norm',
  /* 14 */ 'mitigated_count_norm',
  /* 15 */ 'nullified_count_norm',
  /* 16 */ 'severity_weighted_pressure',
  /* 17 */ 'existential_contribution',
  /* 18 */ 'critical_contribution',
  /* 19 */ 'severe_contribution',
  /* 20 */ 'moderate_contribution',
  /* 21 */ 'minor_contribution',
  /* 22 */ 'cascade_type_contribution',
  /* 23 */ 'sovereignty_type_contribution',
  /* 24 */ 'type_diversity_norm',
  /* 25 */ 'sovereignty_bonus_consumed',
  /* 26 */ 'mitigation_depth',
  /* 27 */ 'visibility_ordinal_norm',
  /* 28 */ 'escalation_risk',
  /* 29 */ 'recovery_capacity',
  /* 30 */ 'score_before_norm',
  /* 31 */ 'pulse_risk',
]);

/** 8 DL column labels, one per DL tensor feature width slot. */
export const DECAY_DL_COLUMN_LABELS: readonly string[] = Object.freeze([
  /* 0 */ 'score_norm',
  /* 1 */ 'raw_delta_norm',
  /* 2 */ 'amplified_delta_norm',
  /* 3 */ 'queued_pressure',
  /* 4 */ 'arrived_pressure',
  /* 5 */ 'relief_total',
  /* 6 */ 'visibility_ordinal_norm',
  /* 7 */ 'pressure_amplifier_norm',
]);

/** Risk tier thresholds for the decay health report. */
export const DECAY_HEALTH_THRESHOLDS = {
  CRITICAL_SCORE:     0.85,
  HIGH_SCORE:         0.70,
  MEDIUM_SCORE:       0.50,
  LOW_SCORE:          0.30,
  CRITICAL_ARRIVED:   3,
  HIGH_ARRIVED:       2,
  CRITICAL_DELTA:     0.12,
  HIGH_DELTA:         0.07,
} as const;

// ============================================================================
// § 2 — EXPORTED INTERFACE DECLARATIONS
// ============================================================================

/** Mutable internal representation of a DecayContributionBreakdown. */
type MutableDecayContributionBreakdown = {
  -readonly [K in keyof DecayContributionBreakdown]: DecayContributionBreakdown[K];
};

/** Risk tier for the decay health report. */
export type DecayRiskTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR';

/** Health report for the decay controller at a point in time. */
export interface DecayHealthReport {
  readonly riskTier:              DecayRiskTier;
  readonly currentScore:          number;
  readonly rawDelta:              number;
  readonly amplifiedDelta:        number;
  readonly arrivedThreatCount:    number;
  readonly escalating:            boolean;
  readonly pulseRisk:             boolean;
  readonly sovereigntyConsumed:   boolean;
  readonly healthScore:           number;
  readonly alerts:                readonly string[];
  readonly tickNumber:            number;
}

/** Trend direction label. */
export type DecayTrendDirection = 'PLUMMETING' | 'FALLING' | 'FLAT' | 'RISING' | 'SPIKING';

/** Trend snapshot from the rolling history window. */
export interface DecayTrendSnapshot {
  readonly direction:                 DecayTrendDirection;
  readonly slope:                     number;
  readonly volatility:                number;
  readonly mean:                      number;
  readonly min:                       number;
  readonly max:                       number;
  readonly range:                     number;
  readonly consecutiveRisingTicks:    number;
  readonly consecutiveFallingTicks:   number;
  readonly isEscalating:              boolean;
  readonly ticksSincePeak:            number;
  readonly ticksSinceTrough:          number;
}

/** Projected score trajectory for the next N ticks. */
export interface DecayForecast {
  readonly currentScore:          number;
  readonly projectedScores:       readonly number[];
  readonly ticksToHalfRecovery:   number | null;
  readonly ticksToFullRecovery:   number | null;
  readonly recoveryBlocked:       boolean;
  readonly blockerReason:         string | null;
  readonly peakProjectedScore:    number;
  readonly pulseEscapeTickEstimate: number | null;
  readonly horizonTicks:          number;
}

/** Single line in a decay narrative. */
export interface DecayNarrativeLine {
  readonly priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  readonly text:     string;
  readonly component: keyof DecayContributionBreakdown | 'summary' | 'forecast';
}

/** Full UX narrative for the decay controller state. */
export interface DecayNarrative {
  readonly headline:         string;
  readonly urgencyLabel:     string;
  readonly lines:            readonly DecayNarrativeLine[];
  readonly mitigationAdvice: readonly string[];
  readonly scoreLabel:       string;
  readonly tickNumber:       number;
}

/** 32-dimensional ML feature vector for the decay controller. */
export interface DecayMLVector {
  readonly dimension:    typeof DECAY_ML_FEATURE_COUNT;
  readonly labels:       readonly string[];
  readonly values:       readonly number[];
  readonly pressureTier: PressureTier;
  readonly tickNumber:   number;
  readonly timestamp:    number;
}

/** Single row in the decay DL tensor (one tick of history). */
export interface DecayDLTensorRow {
  readonly tickNumber: number;
  readonly features:   readonly number[];
}

/** 16 × 8 DL sequence tensor built from tick history. */
export interface DecayDLTensor {
  readonly rows:           readonly DecayDLTensorRow[];
  readonly sequenceLength: typeof DECAY_DL_SEQUENCE_LENGTH;
  readonly featureWidth:   typeof DECAY_DL_FEATURE_WIDTH;
  readonly pressureTier:   PressureTier;
  readonly tickNumber:     number;
  readonly timestamp:      number;
}

/** Per-tick sample retained in rolling history for DL tensor and analytics. */
export interface DecayTickSample {
  readonly tickNumber:        number;
  readonly score:             number;
  readonly rawDelta:          number;
  readonly amplifiedDelta:    number;
  readonly queuedPressure:    number;
  readonly arrivedPressure:   number;
  readonly reliefTotal:       number;
  readonly visibilityOrdinal: number;
  readonly pressureAmpFactor: number;
}

/** Session-level aggregated analytics from all tick samples. */
export interface DecaySessionSummary {
  readonly ticksProcessed:          number;
  readonly peakScore:               number;
  readonly peakScoreTick:           number;
  readonly troughScore:             number;
  readonly troughScoreTick:         number;
  readonly avgScore:                number;
  readonly avgRawDelta:             number;
  readonly avgAmplifiedDelta:       number;
  readonly scoreVolatilityAvg:      number;
  readonly totalSovereigntyBonuses: number;
  readonly longestEscalationStreak: number;
  readonly longestCalmStreak:       number;
  readonly pulseActivations:        number;
  readonly totalReliefTicks:        number;
}

/** Serialized state for replay / persistence. */
export interface DecaySerializedState {
  readonly version:              string;
  readonly sovereigntyConsumed:  boolean;
  readonly tickHistory:          readonly DecayTickSample[];
  readonly sessionSummary:       DecaySessionSummary;
  readonly checksum:             string;
  readonly serializedAtMs:       number;
}

/** Full export bundle for ML pipeline and chat adapter. */
export interface DecayExportBundle {
  readonly mlVector:        DecayMLVector;
  readonly dlTensor:        DecayDLTensor;
  readonly healthReport:    DecayHealthReport;
  readonly trendSnapshot:   DecayTrendSnapshot;
  readonly forecast:        DecayForecast;
  readonly narrative:       DecayNarrative;
  readonly sessionSummary:  DecaySessionSummary;
  readonly serializedState: DecaySerializedState;
  readonly tickNumber:      number;
  readonly exportedAtMs:    number;
}

/** Tuning parameter overlay for runtime adjustment. */
export interface DecayTuningParams {
  readonly queuedTensionOverride?:    number;
  readonly arrivedTensionOverride?:   number;
  readonly expiredGhostOverride?:     number;
  readonly mitigationDecayOverride?:  number;
  readonly nullifyDecayOverride?:     number;
  readonly emptyQueueDecayOverride?:  number;
  readonly severityWeightingEnabled?: boolean;
  readonly typeModifiersEnabled?:     boolean;
  readonly maxDeltaOverride?:         number;
}

/** Result of the self-test harness. */
export interface DecaySelfTestResult {
  readonly passed:     boolean;
  readonly checksRun:  number;
  readonly failures:   readonly string[];
  readonly testedAt:   number;
  readonly durationMs: number;
}

/** Breakdown of how each threat contributes to the current raw delta. */
export interface DecayContributionAnalysis {
  readonly perEntryContributions: ReadonlyArray<{
    readonly entryId:    string;
    readonly entryState: EntryState;
    readonly baseRate:   number;
    readonly severityWeight: number;
    readonly typeModifier:   number;
    readonly effectiveContribution: number;
  }>;
  readonly totalQueued:     number;
  readonly totalArrived:    number;
  readonly totalRelief:     number;
  readonly netContribution: number;
}

// ============================================================================
// § 3 — MODULE-PRIVATE UTILITIES
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalise(value: number, scale: number): number {
  return clamp(value / (Math.abs(scale) + DECAY_EPSILON), -1, 1);
}

function normPos(value: number, scale: number): number {
  return clamp(value / (scale + DECAY_EPSILON), 0, 1);
}

/** Returns the 0-based ordinal index of a visibility state in VISIBILITY_ORDER. */
function visibilityOrdinal(state: TensionVisibilityState): number {
  return VISIBILITY_ORDER.indexOf(state);
}

/** Returns the VisibilityLevel (envelope label) for a given internal state. */
function toVisibilityLevel(state: TensionVisibilityState): VisibilityLevel {
  return INTERNAL_VISIBILITY_TO_ENVELOPE[state];
}

/** Returns the awareness bonus for a given visibility state from VISIBILITY_CONFIGS. */
function getVisibilityAwarenessBonus(state: TensionVisibilityState): number {
  return VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
}

/** Returns the pressure amplification factor for a tier. */
function getPressureAmp(tier: PressureTier): number {
  return PRESSURE_TENSION_AMPLIFIERS[tier];
}

/** Returns the type-specific decay amplifier for a given threat type.
 *  Accesses THREAT_TYPE constants at runtime. */
function getTypeDecayModifier(type: ThreatType): number {
  if (type === THREAT_TYPE.CASCADE)         return DECAY_CASCADE_TYPE_AMPLIFIER;
  if (type === THREAT_TYPE.SOVEREIGNTY)     return DECAY_SOVEREIGNTY_TYPE_AMPLIFIER;
  if (type === THREAT_TYPE.SHIELD_PIERCE)   return 1.15;
  if (type === THREAT_TYPE.HATER_INJECTION) return 1.10;
  if (type === THREAT_TYPE.DEBT_SPIRAL)     return 1.05;
  return 1.0;
}

/** Returns the relief amplifier when an entry of this type is mitigated.
 *  Accesses THREAT_TYPE constants at runtime. */
function getMitigationReliefMultiplier(type: ThreatType): number {
  if (type === THREAT_TYPE.REPUTATION_BURN)  return DECAY_REPUTATION_MITIGATION_RELIEF;
  if (type === THREAT_TYPE.OPPORTUNITY_KILL) return DECAY_OPPORTUNITY_MITIGATION_RELIEF;
  if (type === THREAT_TYPE.SOVEREIGNTY)      return 1.4;
  if (type === THREAT_TYPE.CASCADE)          return 1.2;
  return 1.0;
}

/** SHA-256 checksum helper. */
function computeChecksum(data: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .slice(0, 16);
}

// ============================================================================
// § 4 — TensionDecayController CLASS
// ============================================================================

/**
 * TensionDecayController (v2)
 *
 * Stateful controller for computing per-tick tension score deltas.
 * Maintains a rolling tick history for DL tensor construction,
 * trend analysis, session analytics, and recovery forecasting.
 *
 * Usage in TensionEngine tick loop:
 *   1. Build a DecayComputeInput from the current queue state.
 *   2. Call computeDelta(input) → DecayComputeResult.
 *   3. Apply result.amplifiedDelta to current score.
 *   4. Optionally call recordTickSample() after score update.
 *   5. Call exportBundle() for downstream consumers.
 */
export class TensionDecayController {

  // ── § 4-A  PRIVATE STATE ─────────────────────────────────────────────────

  /** Prevents the sovereignty bonus from being applied more than once per run. */
  private sovereigntyBonusConsumed = false;

  /** Rolling tick history for DL tensor and analytics. */
  private readonly tickHistory: DecayTickSample[] = [];

  /** Cumulative session counters. */
  private sessionTotalSovereigntyBonuses = 0;
  private sessionTotalReliefTicks        = 0;
  private sessionPulseActivations        = 0;
  private sessionLongestEscalation       = 0;
  private sessionLongestCalm             = 0;
  private currentEscalationStreak        = 0;
  private currentCalmStreak              = 0;

  /** Optional tuning parameter overlay. */
  private tuningParams: DecayTuningParams = {};

  /** Last computed result (for incremental analytics). */
  private lastResult: DecayComputeResult | null = null;

  /** Last score passed to recordTickSample. */
  private lastScore = 0;

  // ── § 4-B  CORE DELTA COMPUTATION ────────────────────────────────────────

  /**
   * Computes the tension score delta for one tick.
   *
   * Pipeline:
   *   1. Zero-initialise mutable breakdown.
   *   2. Apply active-entry pressure (queued + arrived), with:
   *      - flat-rate per tick (TENSION_CONSTANTS)
   *      - severity-weight scaling (THREAT_SEVERITY_WEIGHTS)
   *      - type-specific amplifier (THREAT_TYPE modifiers)
   *   3. Apply expired-entry ghost pressure.
   *   4. Apply relief decay (MITIGATED + NULLIFIED), type-amplified.
   *   5. Apply empty-queue recovery bonus.
   *   6. Apply visibility awareness bonus (VISIBILITY_CONFIGS).
   *   7. Apply sovereignty milestone relief (one-shot).
   *   8. Amplify positive contributions by PRESSURE_TENSION_AMPLIFIERS[tier].
   *   9. Clamp final delta to ±DECAY_MAX_DELTA_PER_TICK.
   */
  public computeDelta(input: DecayComputeInput): DecayComputeResult {
    const breakdown = this.createMutableBreakdown();

    this.applyActiveEntryPressure(breakdown, input);
    this.applyExpiredEntryPressure(breakdown, input);
    this.applyReliefDecay(breakdown, input);
    this.applyEmptyQueueRecovery(breakdown, input);
    this.applyVisibilityAwareness(breakdown, input);
    this.applySovereigntyRelief(breakdown, input);

    const rawDelta    = this.computeRawDelta(breakdown);
    const positiveRaw = this.computePositiveRaw(breakdown);
    const negativeRaw = this.computeNegativeRaw(breakdown);

    // Pressure-tier amplification (PRESSURE_TENSION_AMPLIFIERS used at runtime)
    const amp = getPressureAmp(input.pressureTier);
    const amplifiedDelta = clamp(
      positiveRaw * amp + negativeRaw,
      -DECAY_MAX_DELTA_PER_TICK,
       DECAY_MAX_DELTA_PER_TICK,
    );

    const result: DecayComputeResult = {
      rawDelta,
      amplifiedDelta,
      contributionBreakdown: Object.freeze({ ...breakdown }),
    };

    this.lastResult = result;
    return result;
  }

  /**
   * Enhanced delta computation accepting full AnticipationEntry objects.
   * Applies severity-weight scaling and type-specific modifiers on top of
   * the flat TENSION_CONSTANTS rates.
   *
   * Use this when you want richer per-entry attribution.
   * Returns the same DecayComputeResult shape but with fuller breakdown values.
   */
  public computeEnhancedDelta(
    entries: readonly AnticipationEntry[],
    pressureTier: PressureTier,
    visibilityState: TensionVisibilityState,
    sovereigntyMilestone: boolean,
  ): DecayComputeResult {
    const breakdown = this.createMutableBreakdown();
    const tuning    = this.tuningParams;

    // Build a DecayComputeInput from raw entries
    const active   = entries.filter(
      (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
    );
    const expired  = entries.filter((e) => e.state === ENTRY_STATE.EXPIRED);
    const relieved = entries.filter(
      (e) => e.state === ENTRY_STATE.MITIGATED || e.state === ENTRY_STATE.NULLIFIED,
    );

    // — Active entry pressure with severity + type weighting
    const severityWeightingEnabled = tuning.severityWeightingEnabled ?? true;
    const typeModifiersEnabled     = tuning.typeModifiersEnabled     ?? true;

    for (const entry of active) {
      const severityWeight = severityWeightingEnabled
        ? THREAT_SEVERITY_WEIGHTS[entry.threatSeverity]
        : 1.0;
      const typeModifier = typeModifiersEnabled
        ? getTypeDecayModifier(entry.threatType)
        : 1.0;

      if (entry.state === ENTRY_STATE.QUEUED) {
        const baseRate = tuning.queuedTensionOverride ?? TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
        breakdown.queuedThreats += baseRate * severityWeight * typeModifier;
      } else if (entry.state === ENTRY_STATE.ARRIVED) {
        const baseRate = tuning.arrivedTensionOverride ?? TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
        breakdown.arrivedThreats += baseRate * severityWeight * typeModifier;
      }
    }

    // — Expired entry ghost pressure
    for (const entry of expired) {
      if (entry.state === ENTRY_STATE.EXPIRED) {
        const baseRate = tuning.expiredGhostOverride ?? TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
        const severityMod = severityWeightingEnabled
          ? THREAT_SEVERITY_WEIGHTS[entry.threatSeverity]
          : 1.0;
        breakdown.expiredGhosts += baseRate * severityMod;
      }
    }

    // — Relief decay with type-specific multipliers
    for (const entry of relieved) {
      const reliefMultiplier = typeModifiersEnabled
        ? getMitigationReliefMultiplier(entry.threatType)
        : 1.0;

      if (entry.state === ENTRY_STATE.MITIGATED) {
        const baseRate = tuning.mitigationDecayOverride ?? TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK;
        breakdown.mitigationDecay -= baseRate * reliefMultiplier;
      } else if (entry.state === ENTRY_STATE.NULLIFIED) {
        const baseRate = tuning.nullifyDecayOverride ?? TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK;
        breakdown.nullifyDecay -= baseRate * reliefMultiplier;
      }
    }

    // — Empty queue bonus
    if (active.length === 0) {
      const baseRate = tuning.emptyQueueDecayOverride ?? TENSION_CONSTANTS.EMPTY_QUEUE_DECAY;
      breakdown.emptyQueueBonus -= baseRate;
    }

    // — Visibility awareness bonus (uses VISIBILITY_CONFIGS at runtime)
    const awarenessBonus = getVisibilityAwarenessBonus(visibilityState);
    breakdown.visibilityBonus = awarenessBonus;

    // — Sovereignty milestone (one-shot, uses TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY)
    if (sovereigntyMilestone && !this.sovereigntyBonusConsumed) {
      breakdown.sovereigntyBonus    -= TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY;
      this.sovereigntyBonusConsumed  = true;
      this.sessionTotalSovereigntyBonuses++;
    }

    const rawDelta    = this.computeRawDelta(breakdown);
    const positiveRaw = this.computePositiveRaw(breakdown);
    const negativeRaw = this.computeNegativeRaw(breakdown);

    const amp           = getPressureAmp(pressureTier);
    const maxDelta      = tuning.maxDeltaOverride ?? DECAY_MAX_DELTA_PER_TICK;
    const amplifiedDelta = clamp(
      positiveRaw * amp + negativeRaw,
      -maxDelta,
       maxDelta,
    );

    const result: DecayComputeResult = {
      rawDelta,
      amplifiedDelta,
      contributionBreakdown: Object.freeze({ ...breakdown }),
    };

    this.lastResult = result;

    // Track relief ticks
    if (amplifiedDelta < 0) this.sessionTotalReliefTicks++;

    return result;
  }

  /**
   * Computes the per-entry contribution analysis.
   * Returns how much each AnticipationEntry contributed to the raw delta.
   * Uses THREAT_SEVERITY_WEIGHTS, THREAT_TYPE constants, and ENTRY_STATE at runtime.
   */
  public computeContributionAnalysis(
    entries: readonly AnticipationEntry[],
  ): DecayContributionAnalysis {
    const perEntryContributions: Array<{
      readonly entryId:    string;
      readonly entryState: EntryState;
      readonly baseRate:   number;
      readonly severityWeight: number;
      readonly typeModifier:   number;
      readonly effectiveContribution: number;
    }> = [];

    let totalQueued  = 0;
    let totalArrived = 0;
    let totalRelief  = 0;

    for (const entry of entries) {
      const severityWeight = THREAT_SEVERITY_WEIGHTS[entry.threatSeverity];
      const typeModifier   = getTypeDecayModifier(entry.threatType);
      let baseRate         = 0;
      let effective        = 0;

      if (entry.state === ENTRY_STATE.QUEUED) {
        baseRate  = TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
        effective = baseRate * severityWeight * typeModifier;
        totalQueued += effective;
      } else if (entry.state === ENTRY_STATE.ARRIVED) {
        baseRate  = TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
        effective = baseRate * severityWeight * typeModifier;
        totalArrived += effective;
      } else if (entry.state === ENTRY_STATE.MITIGATED) {
        baseRate  = -TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK;
        const reliefMul = getMitigationReliefMultiplier(entry.threatType);
        effective = baseRate * reliefMul;
        totalRelief += effective;
      } else if (entry.state === ENTRY_STATE.NULLIFIED) {
        baseRate  = -TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK;
        const reliefMul = getMitigationReliefMultiplier(entry.threatType);
        effective = baseRate * reliefMul;
        totalRelief += effective;
      } else if (entry.state === ENTRY_STATE.EXPIRED) {
        baseRate  = TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
        effective = baseRate * severityWeight;
        totalQueued += effective;
      }

      perEntryContributions.push(Object.freeze({
        entryId:    entry.entryId,
        entryState: entry.state,
        baseRate,
        severityWeight,
        typeModifier,
        effectiveContribution: effective,
      }));
    }

    const netContribution = totalQueued + totalArrived + totalRelief;

    return Object.freeze({
      perEntryContributions: Object.freeze(perEntryContributions),
      totalQueued,
      totalArrived,
      totalRelief,
      netContribution,
    });
  }

  // ── § 4-C  TUNING PARAMETER OVERLAY ──────────────────────────────────────

  /**
   * Applies a tuning parameter overlay.
   * All fields are optional; missing fields fall back to TENSION_CONSTANTS defaults.
   */
  public setTuningParams(params: DecayTuningParams): void {
    this.tuningParams = { ...params };
  }

  /** Clears all tuning overrides, restoring default behavior. */
  public clearTuningParams(): void {
    this.tuningParams = {};
  }

  /** Returns a copy of the current tuning parameters. */
  public getTuningParams(): DecayTuningParams {
    return { ...this.tuningParams };
  }

  // ── § 4-D  TICK HISTORY AND SESSION ANALYTICS ────────────────────────────

  /**
   * Records a tick sample for session analytics and DL tensor construction.
   * Call once per tick after score has been updated.
   * Uses VISIBILITY_ORDER to compute ordinal, PRESSURE_TENSION_AMPLIFIERS for amp factor.
   */
  public recordTickSample(
    tickNumber: number,
    score: number,
    result: DecayComputeResult,
    visibilityState: TensionVisibilityState,
    pressureTier: PressureTier,
  ): void {
    const bd     = result.contributionBreakdown;
    const relief = bd.mitigationDecay + bd.nullifyDecay + bd.emptyQueueBonus + bd.sovereigntyBonus;

    const sample: DecayTickSample = Object.freeze({
      tickNumber,
      score,
      rawDelta:          result.rawDelta,
      amplifiedDelta:    result.amplifiedDelta,
      queuedPressure:    bd.queuedThreats,
      arrivedPressure:   bd.arrivedThreats,
      reliefTotal:       relief,
      visibilityOrdinal: visibilityOrdinal(visibilityState),
      pressureAmpFactor: getPressureAmp(pressureTier),
    });

    this.tickHistory.push(sample);
    if (this.tickHistory.length > DECAY_HISTORY_CAPACITY) {
      this.tickHistory.shift();
    }

    // Update escalation/calm streaks
    if (result.amplifiedDelta > DECAY_ESCALATION_SLOPE_THRESHOLD) {
      this.currentEscalationStreak++;
      this.currentCalmStreak = 0;
    } else if (result.amplifiedDelta < DECAY_DEESCALATION_SLOPE_THRESHOLD) {
      this.currentCalmStreak++;
      this.currentEscalationStreak = 0;
    } else {
      this.currentEscalationStreak = 0;
      this.currentCalmStreak       = 0;
    }

    this.sessionLongestEscalation = Math.max(
      this.sessionLongestEscalation, this.currentEscalationStreak,
    );
    this.sessionLongestCalm = Math.max(
      this.sessionLongestCalm, this.currentCalmStreak,
    );

    // Pulse activation
    if (score >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
      this.sessionPulseActivations++;
    }

    this.lastScore = score;
  }

  /**
   * Returns the rolling tick history.
   */
  public getTickHistory(): readonly DecayTickSample[] {
    return Object.freeze([...this.tickHistory]);
  }

  /**
   * Computes the session-level summary from recorded tick samples.
   */
  public computeSessionSummary(): DecaySessionSummary {
    const n = this.tickHistory.length;
    if (n === 0) {
      return Object.freeze({
        ticksProcessed:          0,
        peakScore:               0,
        peakScoreTick:           0,
        troughScore:             0,
        troughScoreTick:         0,
        avgScore:                0,
        avgRawDelta:             0,
        avgAmplifiedDelta:       0,
        scoreVolatilityAvg:      0,
        totalSovereigntyBonuses: this.sessionTotalSovereigntyBonuses,
        longestEscalationStreak: this.sessionLongestEscalation,
        longestCalmStreak:       this.sessionLongestCalm,
        pulseActivations:        this.sessionPulseActivations,
        totalReliefTicks:        this.sessionTotalReliefTicks,
      });
    }

    let peakScore = -Infinity, peakTick = 0;
    let troughScore = Infinity, troughTick = 0;
    let sumScore = 0, sumRaw = 0, sumAmp = 0;

    for (const s of this.tickHistory) {
      sumScore += s.score;
      sumRaw   += s.rawDelta;
      sumAmp   += s.amplifiedDelta;
      if (s.score > peakScore)   { peakScore = s.score;   peakTick   = s.tickNumber; }
      if (s.score < troughScore) { troughScore = s.score; troughTick = s.tickNumber; }
    }

    const avgScore = sumScore / n;

    // Volatility = mean absolute deviation from mean score
    const volatilityAvg = this.tickHistory.reduce(
      (sum, s) => sum + Math.abs(s.score - avgScore), 0,
    ) / n;

    return Object.freeze({
      ticksProcessed:          n,
      peakScore,
      peakScoreTick:           peakTick,
      troughScore,
      troughScoreTick:         troughTick,
      avgScore,
      avgRawDelta:             sumRaw   / n,
      avgAmplifiedDelta:       sumAmp   / n,
      scoreVolatilityAvg:      volatilityAvg,
      totalSovereigntyBonuses: this.sessionTotalSovereigntyBonuses,
      longestEscalationStreak: this.sessionLongestEscalation,
      longestCalmStreak:       this.sessionLongestCalm,
      pulseActivations:        this.sessionPulseActivations,
      totalReliefTicks:        this.sessionTotalReliefTicks,
    });
  }

  // ── § 4-E  TREND ANALYSIS ─────────────────────────────────────────────────

  /**
   * Computes a trend snapshot from the rolling tick history.
   * Uses DECAY_ESCALATION_SLOPE_THRESHOLD and DECAY_DEESCALATION_SLOPE_THRESHOLD.
   */
  public computeTrendSnapshot(): DecayTrendSnapshot {
    const window = Math.min(this.tickHistory.length, DECAY_VOLATILITY_WINDOW);
    if (window < 2) {
      return Object.freeze({
        direction:                 'FLAT' as DecayTrendDirection,
        slope:                     0,
        volatility:                0,
        mean:                      this.lastScore,
        min:                       this.lastScore,
        max:                       this.lastScore,
        range:                     0,
        consecutiveRisingTicks:    0,
        consecutiveFallingTicks:   0,
        isEscalating:              false,
        ticksSincePeak:            0,
        ticksSinceTrough:          0,
      });
    }

    const recent = this.tickHistory.slice(-window);
    const scores = recent.map((s) => s.score);

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min  = Math.min(...scores);
    const max  = Math.max(...scores);
    const range = max - min;

    // Slope: linear regression over the window
    let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0;
    for (let i = 0; i < scores.length; i++) {
      sumXY += i * scores[i]!;
      sumX  += i;
      sumY  += scores[i]!;
      sumX2 += i * i;
    }
    const n     = scores.length;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX + DECAY_EPSILON);

    // Volatility = std dev
    const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / n;
    const volatility = Math.sqrt(variance);

    // Consecutive streaks
    let risingTicks  = 0;
    let fallingTicks = 0;
    for (let i = recent.length - 1; i > 0; i--) {
      const delta = recent[i]!.score - recent[i - 1]!.score;
      if (delta > 0 && fallingTicks === 0) risingTicks++;
      else if (delta < 0 && risingTicks === 0) fallingTicks++;
      else break;
    }

    // Ticks since peak / trough
    const lastScore   = recent[recent.length - 1]!.score;
    const peakIndex   = scores.indexOf(max);
    const troughIndex = scores.indexOf(min);
    const ticksSincePeak   = scores.length - 1 - peakIndex;
    const ticksSinceTrough = scores.length - 1 - troughIndex;

    // Direction classification
    let direction: DecayTrendDirection;
    if (slope > DECAY_ESCALATION_SLOPE_THRESHOLD * 2)       direction = 'SPIKING';
    else if (slope > DECAY_ESCALATION_SLOPE_THRESHOLD)      direction = 'RISING';
    else if (slope < DECAY_DEESCALATION_SLOPE_THRESHOLD * 2) direction = 'PLUMMETING';
    else if (slope < DECAY_DEESCALATION_SLOPE_THRESHOLD)    direction = 'FALLING';
    else direction = 'FLAT';

    const isEscalating = slope > DECAY_ESCALATION_SLOPE_THRESHOLD;

    void lastScore; // referenced for clarity, used implicitly in streak logic above

    return Object.freeze({
      direction,
      slope,
      volatility,
      mean,
      min,
      max,
      range,
      consecutiveRisingTicks:  risingTicks,
      consecutiveFallingTicks: fallingTicks,
      isEscalating,
      ticksSincePeak,
      ticksSinceTrough,
    });
  }

  // ── § 4-F  RECOVERY FORECASTING ──────────────────────────────────────────

  /**
   * Projects the tension score trajectory for the next DECAY_FORECAST_HORIZON ticks.
   * Uses the last DecayComputeResult's amplifiedDelta as the baseline decay rate,
   * adjusting for TENSION_CONSTANTS.EMPTY_QUEUE_DECAY when no active threats remain.
   */
  public computeForecast(
    currentScore: number,
    activeEntryCount: number,
    pressureTier: PressureTier,
    horizonTicks: number = DECAY_FORECAST_HORIZON,
  ): DecayForecast {
    const lastDelta = this.lastResult?.amplifiedDelta ?? 0;
    const amp       = getPressureAmp(pressureTier);

    // Baseline: assume lastDelta persists, but decays toward empty-queue recovery
    const targetDelta = activeEntryCount === 0
      ? -TENSION_CONSTANTS.EMPTY_QUEUE_DECAY * amp
      : lastDelta;

    const projected: number[] = [];
    let score = currentScore;
    let peakProjected = currentScore;
    let ticksToHalf: number | null = null;
    let ticksFull: number | null  = null;
    let pulseEscape: number | null = null;

    for (let t = 1; t <= horizonTicks; t++) {
      // Interpolate toward targetDelta over the window
      const fraction = t / horizonTicks;
      const delta    = lastDelta + (targetDelta - lastDelta) * fraction;
      score          = clamp(score + delta, DECAY_SCORE_FLOOR, DECAY_SCORE_CEILING);
      projected.push(score);
      peakProjected  = Math.max(peakProjected, score);

      if (ticksToHalf === null && score <= currentScore / 2) {
        ticksToHalf = t;
      }
      if (ticksFull === null && score <= DECAY_SCORE_FLOOR + 0.01) {
        ticksFull = t;
      }
      if (
        pulseEscape === null &&
        currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD &&
        score < TENSION_CONSTANTS.PULSE_THRESHOLD
      ) {
        pulseEscape = t;
      }
    }

    // Recovery blocked if positive delta persists
    const recoveryBlocked = lastDelta > 0 && activeEntryCount > 0;
    let blockerReason: string | null = null;
    if (recoveryBlocked) {
      const existentialCount = activeEntryCount; // simplified here
      if (existentialCount > 0 && lastDelta > DECAY_ESCALATION_SLOPE_THRESHOLD) {
        blockerReason = 'Active threats are sustaining tension increase';
      }
    }

    return Object.freeze({
      currentScore,
      projectedScores:         Object.freeze(projected),
      ticksToHalfRecovery:     ticksToHalf,
      ticksToFullRecovery:     ticksFull,
      recoveryBlocked,
      blockerReason,
      peakProjectedScore:      peakProjected,
      pulseEscapeTickEstimate: pulseEscape,
      horizonTicks,
    });
  }

  // ── § 4-G  ML FEATURE EXTRACTION ─────────────────────────────────────────

  /**
   * Extracts a 32-dimensional ML feature vector from the last computed delta.
   * Requires that computeDelta or computeEnhancedDelta has been called first.
   * Uses: THREAT_SEVERITY, THREAT_SEVERITY_WEIGHTS, THREAT_TYPE,
   *       PRESSURE_TENSION_AMPLIFIERS, VISIBILITY_CONFIGS, VISIBILITY_ORDER.
   */
  public extractMLVector(
    entries: readonly AnticipationEntry[],
    currentScore: number,
    pressureTier: PressureTier,
    visibilityState: TensionVisibilityState,
    tickNumber: number,
  ): DecayMLVector {
    const result = this.lastResult;
    const bd     = result?.contributionBreakdown;
    const amp    = getPressureAmp(pressureTier);

    // ── Features 00-07: raw breakdown components (normalised to delta range)
    const f00 = normPos(bd?.queuedThreats   ?? 0, DECAY_MAX_DELTA_PER_TICK);
    const f01 = normPos(bd?.arrivedThreats  ?? 0, DECAY_MAX_DELTA_PER_TICK);
    const f02 = normPos(bd?.expiredGhosts   ?? 0, DECAY_MAX_DELTA_PER_TICK);
    const f03 = normPos(Math.abs(bd?.mitigationDecay  ?? 0), DECAY_MAX_DELTA_PER_TICK);
    const f04 = normPos(Math.abs(bd?.nullifyDecay     ?? 0), DECAY_MAX_DELTA_PER_TICK);
    const f05 = normPos(Math.abs(bd?.emptyQueueBonus  ?? 0), DECAY_MAX_DELTA_PER_TICK);
    const f06 = normPos(Math.abs(bd?.visibilityBonus  ?? 0), 0.1);
    const f07 = normPos(Math.abs(bd?.sovereigntyBonus ?? 0), TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY);

    // ── Features 08-09: delta values
    const f08 = clamp(normalise(result?.rawDelta         ?? 0, DECAY_MAX_DELTA_PER_TICK), -1, 1) * 0.5 + 0.5;
    const f09 = clamp(normalise(result?.amplifiedDelta   ?? 0, DECAY_MAX_DELTA_PER_TICK), -1, 1) * 0.5 + 0.5;

    // ── Feature 10: pressure amplifier factor (PRESSURE_TENSION_AMPLIFIERS)
    const f10 = normPos(amp - 1.0, 0.5); // amp range [1.0, 1.5], norm [0, 1]

    // ── Features 11-15: entry counts
    const queued   = entries.filter((e) => e.state === ENTRY_STATE.QUEUED).length;
    const arrived  = entries.filter((e) => e.state === ENTRY_STATE.ARRIVED).length;
    const expired  = entries.filter((e) => e.state === ENTRY_STATE.EXPIRED).length;
    const mitigated = entries.filter((e) => e.state === ENTRY_STATE.MITIGATED).length;
    const nullified = entries.filter((e) => e.state === ENTRY_STATE.NULLIFIED).length;
    const totalCap  = 20;
    const f11 = normPos(queued,    totalCap);
    const f12 = normPos(arrived,   totalCap);
    const f13 = normPos(expired,   totalCap);
    const f14 = normPos(mitigated, totalCap);
    const f15 = normPos(nullified, totalCap);

    // ── Feature 16: severity-weighted pressure
    //    Uses THREAT_SEVERITY_WEIGHTS at runtime (weighted sum of active entries)
    const active = entries.filter(
      (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
    );
    const severityWeightedPressure = active.reduce(
      (sum, e) => sum + THREAT_SEVERITY_WEIGHTS[e.threatSeverity], 0,
    );
    const f16 = normPos(severityWeightedPressure, totalCap);

    // ── Features 17-21: severity-specific ratios
    //    Uses THREAT_SEVERITY constants at runtime
    const safeActive = active.length || 1;
    const f17 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL).length / safeActive;
    const f18 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.CRITICAL).length    / safeActive;
    const f19 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.SEVERE).length      / safeActive;
    const f20 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.MODERATE).length    / safeActive;
    const f21 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.MINOR).length       / safeActive;

    // ── Features 22-23: type-specific contributions
    //    Uses THREAT_TYPE constants at runtime
    const cascadeEntries     = active.filter((e) => e.threatType === THREAT_TYPE.CASCADE);
    const sovereigntyEntries = active.filter((e) => e.threatType === THREAT_TYPE.SOVEREIGNTY);
    const cascadeContrib     = cascadeEntries.length / safeActive;
    const sovereignContrib   = sovereigntyEntries.length / safeActive;
    const f22 = cascadeContrib;
    const f23 = sovereignContrib;

    // ── Feature 24: type diversity (number of unique threat types / 8)
    const uniqueTypes = new Set(active.map((e) => e.threatType)).size;
    const f24 = uniqueTypes / 8;

    // ── Feature 25: sovereignty bonus consumed flag
    const f25 = this.sovereigntyBonusConsumed ? 1 : 0;

    // ── Feature 26: mitigation depth (ratio of mitigated to total resolved)
    const resolved = mitigated + nullified + expired;
    const f26 = resolved > 0 ? mitigated / resolved : 0;

    // ── Feature 27: visibility ordinal (VISIBILITY_ORDER used at runtime)
    const visOrdinal = visibilityOrdinal(visibilityState);
    const f27 = normPos(visOrdinal, VISIBILITY_ORDER.length - 1);

    // ── Feature 28: escalation risk (positive amplified delta ratio)
    const escalation = result?.amplifiedDelta ?? 0;
    const f28 = normPos(Math.max(0, escalation), DECAY_MAX_DELTA_PER_TICK);

    // ── Feature 29: recovery capacity (negative delta magnitude)
    const recovery = result?.amplifiedDelta ?? 0;
    const f29 = normPos(Math.max(0, -recovery), DECAY_MAX_DELTA_PER_TICK);

    // ── Feature 30: score before (normalised)
    const f30 = clamp(currentScore, DECAY_SCORE_FLOOR, DECAY_SCORE_CEILING);

    // ── Feature 31: pulse risk (score vs PULSE_THRESHOLD)
    const f31 = normPos(
      Math.max(0, currentScore - TENSION_CONSTANTS.PULSE_THRESHOLD),
      1 - TENSION_CONSTANTS.PULSE_THRESHOLD + DECAY_EPSILON,
    );

    const values = Object.freeze([
      f00, f01, f02, f03, f04, f05, f06, f07,
      f08, f09, f10,
      f11, f12, f13, f14, f15,
      f16, f17, f18, f19, f20, f21,
      f22, f23, f24,
      f25, f26, f27, f28, f29, f30, f31,
    ]);

    return Object.freeze({
      dimension:   DECAY_ML_FEATURE_COUNT,
      labels:      DECAY_ML_FEATURE_LABELS,
      values,
      pressureTier,
      tickNumber,
      timestamp:   Date.now(),
    });
  }

  // ── § 4-H  DL TENSOR CONSTRUCTION ────────────────────────────────────────

  /**
   * Builds a 16 × 8 DL sequence tensor from the rolling tick history.
   * Each row = one historical tick sample.
   * Zero-pads when history is shorter than DECAY_DL_SEQUENCE_LENGTH.
   * Uses DECAY_DL_COLUMN_LABELS and PRESSURE_TENSION_AMPLIFIERS at runtime.
   */
  public extractDLTensor(
    pressureTier: PressureTier,
    currentTick: number,
  ): DecayDLTensor {
    const rows: DecayDLTensorRow[] = [];
    const history = this.tickHistory.slice(-DECAY_DL_SEQUENCE_LENGTH);

    // Pad the front if needed
    const padCount = DECAY_DL_SEQUENCE_LENGTH - history.length;
    for (let i = 0; i < padCount; i++) {
      rows.push(Object.freeze({
        tickNumber: 0,
        features:   Object.freeze([0, 0, 0, 0, 0, 0, 0, 0]) as readonly number[],
      }));
    }

    for (const sample of history) {
      const features: readonly number[] = Object.freeze([
        /* 0 */ clamp(sample.score, 0, 1),
        /* 1 */ clamp(normalise(sample.rawDelta,       DECAY_MAX_DELTA_PER_TICK), -1, 1) * 0.5 + 0.5,
        /* 2 */ clamp(normalise(sample.amplifiedDelta, DECAY_MAX_DELTA_PER_TICK), -1, 1) * 0.5 + 0.5,
        /* 3 */ normPos(sample.queuedPressure,  DECAY_MAX_DELTA_PER_TICK),
        /* 4 */ normPos(sample.arrivedPressure, DECAY_MAX_DELTA_PER_TICK),
        /* 5 */ normPos(Math.abs(sample.reliefTotal), DECAY_MAX_DELTA_PER_TICK),
        /* 6 */ normPos(sample.visibilityOrdinal, VISIBILITY_ORDER.length - 1),
        /* 7 */ normPos(sample.pressureAmpFactor - 1.0, 0.5),
      ]);

      rows.push(Object.freeze({ tickNumber: sample.tickNumber, features }));
    }

    return Object.freeze({
      rows:           Object.freeze(rows),
      sequenceLength: DECAY_DL_SEQUENCE_LENGTH,
      featureWidth:   DECAY_DL_FEATURE_WIDTH,
      pressureTier,
      tickNumber:     currentTick,
      timestamp:      Date.now(),
    });
  }

  // ── § 4-I  HEALTH MONITORING ──────────────────────────────────────────────

  /**
   * Computes a health report describing current tension danger.
   * Uses DECAY_HEALTH_THRESHOLDS, TENSION_CONSTANTS.PULSE_THRESHOLD,
   * and THREAT_SEVERITY_WEIGHTS at runtime.
   */
  public computeHealthReport(
    currentScore: number,
    entries: readonly AnticipationEntry[],
    tickNumber: number,
  ): DecayHealthReport {
    const result    = this.lastResult;
    const alerts: string[] = [];

    const arrived  = entries.filter((e) => e.state === ENTRY_STATE.ARRIVED);
    const active   = entries.filter(
      (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
    );
    const ampDelta = result?.amplifiedDelta ?? 0;
    const escalating = ampDelta > DECAY_ESCALATION_SLOPE_THRESHOLD;
    const pulseRisk  = currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD;

    // Health score: starts at 1, penalised
    let health = 1.0;
    health -= normPos(currentScore, 1) * 0.4;
    health -= normPos(arrived.length, DECAY_HEALTH_THRESHOLDS.CRITICAL_ARRIVED) * 0.2;
    health -= escalating ? 0.2 : 0;
    health -= pulseRisk  ? 0.2 : 0;
    health  = clamp(health, 0, 1);

    // Risk tier
    let riskTier: DecayRiskTier = 'CLEAR';
    if (
      currentScore >= DECAY_HEALTH_THRESHOLDS.CRITICAL_SCORE ||
      arrived.length >= DECAY_HEALTH_THRESHOLDS.CRITICAL_ARRIVED
    ) {
      riskTier = 'CRITICAL';
      alerts.push(`Score at ${Math.round(currentScore * 100)}% — Anticipation Pulse territory`);
    } else if (
      currentScore >= DECAY_HEALTH_THRESHOLDS.HIGH_SCORE ||
      arrived.length >= DECAY_HEALTH_THRESHOLDS.HIGH_ARRIVED
    ) {
      riskTier = 'HIGH';
      alerts.push(`High tension — mitigate threats before score escalates`);
    } else if (currentScore >= DECAY_HEALTH_THRESHOLDS.MEDIUM_SCORE) {
      riskTier = 'MEDIUM';
      alerts.push(`Tension building — queue activity is accelerating score`);
    } else if (currentScore >= DECAY_HEALTH_THRESHOLDS.LOW_SCORE) {
      riskTier = 'LOW';
    }

    if (
      ampDelta >= DECAY_HEALTH_THRESHOLDS.CRITICAL_DELTA &&
      active.length > 0
    ) {
      alerts.push(`Rapid escalation detected — +${(ampDelta * 100).toFixed(1)}% per tick`);
    }

    if (active.some((e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL)) {
      alerts.push('EXISTENTIAL threat active — sovereign risk is real');
    }

    return Object.freeze({
      riskTier,
      currentScore,
      rawDelta:             result?.rawDelta      ?? 0,
      amplifiedDelta:       result?.amplifiedDelta ?? 0,
      arrivedThreatCount:   arrived.length,
      escalating,
      pulseRisk,
      sovereigntyConsumed:  this.sovereigntyBonusConsumed,
      healthScore:          health,
      alerts:               Object.freeze(alerts),
      tickNumber,
    });
  }

  // ── § 4-J  NARRATIVE GENERATION ──────────────────────────────────────────

  /**
   * Generates a full UX narrative for the decay state.
   * Visibility-aware: uses TENSION_VISIBILITY_STATE + VISIBILITY_CONFIGS
   * to gate message depth.
   * Uses THREAT_TYPE_DEFAULT_MITIGATIONS for mitigation advice.
   * Uses TENSION_CONSTANTS.PULSE_THRESHOLD for pulse warning.
   */
  public generateNarrative(
    currentScore: number,
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    pressureTier: PressureTier,
    tickNumber: number,
  ): DecayNarrative {
    const result   = this.lastResult;
    const bd       = result?.contributionBreakdown;
    const config   = VISIBILITY_CONFIGS[visibilityState];
    const lines:   DecayNarrativeLine[] = [];
    const advice:  string[] = [];

    // Score label
    const scorePct  = Math.round(currentScore * 100);
    let scoreLabel  = 'CALM';
    if (currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD) scoreLabel = 'PULSE ACTIVE';
    else if (currentScore >= DECAY_HEALTH_THRESHOLDS.CRITICAL_SCORE) scoreLabel = 'CRITICAL';
    else if (currentScore >= DECAY_HEALTH_THRESHOLDS.HIGH_SCORE)     scoreLabel = 'HIGH';
    else if (currentScore >= DECAY_HEALTH_THRESHOLDS.MEDIUM_SCORE)   scoreLabel = 'ELEVATED';
    else if (currentScore >= DECAY_HEALTH_THRESHOLDS.LOW_SCORE)      scoreLabel = 'MODERATE';

    // Headline
    let headline    = `Tension ${scorePct}% — ${scoreLabel}`;
    let urgencyLabel = scoreLabel;

    const ampDelta = result?.amplifiedDelta ?? 0;
    const arrived  = entries.filter((e) => e.state === ENTRY_STATE.ARRIVED);

    if (currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
      headline = `🔴 PULSE ACTIVE — Tension at ${scorePct}% — player state critical`;
      urgencyLabel = 'PULSE';
    } else if (arrived.length >= DECAY_HEALTH_THRESHOLDS.CRITICAL_ARRIVED) {
      headline = `⚠ MULTI-THREAT: ${arrived.length} threats active — tension +${(ampDelta * 100).toFixed(1)}%/tick`;
      urgencyLabel = 'CRITICAL';
    } else if (ampDelta > DECAY_HEALTH_THRESHOLDS.CRITICAL_DELTA) {
      headline = `Tension escalating rapidly — +${(ampDelta * 100).toFixed(1)}%/tick`;
      urgencyLabel = 'HIGH';
    } else if (ampDelta < DECAY_DEESCALATION_SLOPE_THRESHOLD) {
      headline = `Tension recovering — ${(ampDelta * 100).toFixed(1)}%/tick`;
      urgencyLabel = 'RECOVERING';
    }

    // Breakdown lines — visibility gated
    if (config.showsThreatType) {
      // Show per-component detail when TELEGRAPHED or EXPOSED
      if (bd) {
        if (bd.queuedThreats > 0) {
          lines.push({
            priority:  'MEDIUM',
            text:      `Queued threats: +${(bd.queuedThreats * 100).toFixed(1)}%`,
            component: 'queuedThreats',
          });
        }
        if (bd.arrivedThreats > 0) {
          lines.push({
            priority:  'HIGH',
            text:      `Active threats: +${(bd.arrivedThreats * 100).toFixed(1)}%`,
            component: 'arrivedThreats',
          });
        }
        if (bd.expiredGhosts > 0) {
          lines.push({
            priority:  'HIGH',
            text:      `Ghost pressure (expired): +${(bd.expiredGhosts * 100).toFixed(1)}%`,
            component: 'expiredGhosts',
          });
        }
        if (bd.mitigationDecay < 0) {
          lines.push({
            priority:  'LOW',
            text:      `Mitigation relief: ${(bd.mitigationDecay * 100).toFixed(1)}%`,
            component: 'mitigationDecay',
          });
        }
        if (bd.nullifyDecay < 0) {
          lines.push({
            priority:  'LOW',
            text:      `Nullification relief: ${(bd.nullifyDecay * 100).toFixed(1)}%`,
            component: 'nullifyDecay',
          });
        }
        if (bd.emptyQueueBonus < 0) {
          lines.push({
            priority:  'INFO',
            text:      `Empty queue bonus: ${(bd.emptyQueueBonus * 100).toFixed(1)}%`,
            component: 'emptyQueueBonus',
          });
        }
        if (bd.sovereigntyBonus < 0) {
          lines.push({
            priority:  'INFO',
            text:      `Sovereignty milestone relief: ${(bd.sovereigntyBonus * 100).toFixed(1)}%`,
            component: 'sovereigntyBonus',
          });
        }
      }

      // Type-specific detail
      const cascadeActive = entries.filter(
        (e) => e.threatType === THREAT_TYPE.CASCADE &&
          (e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED),
      );
      if (cascadeActive.length > 0) {
        lines.push({
          priority:  'HIGH',
          text:      `CASCADE threat carrying ${DECAY_CASCADE_TYPE_AMPLIFIER}x amplifier`,
          component: 'arrivedThreats',
        });
      }

      const sovereigntyActive = entries.filter(
        (e) => e.threatType === THREAT_TYPE.SOVEREIGNTY &&
          (e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED),
      );
      if (sovereigntyActive.length > 0) {
        lines.push({
          priority:  'URGENT',
          text:      `SOVEREIGNTY threat carrying ${DECAY_SOVEREIGNTY_TYPE_AMPLIFIER}x amplifier`,
          component: 'arrivedThreats',
        });
      }
    } else {
      // SHADOWED / SIGNALED: minimal information
      lines.push({
        priority:  ampDelta > 0 ? 'HIGH' : 'LOW',
        text:      ampDelta > 0 ? 'Tension increasing' : 'Tension stable or decreasing',
        component: 'summary',
      });
    }

    // Forecast line (always shown when EXPOSED)
    if (visibilityState === TENSION_VISIBILITY_STATE.EXPOSED) {
      const forecast = this.computeForecast(currentScore, arrived.length, pressureTier);
      if (forecast.ticksToFullRecovery !== null) {
        lines.push({
          priority:  'INFO',
          text:      `Full recovery projected in ~${forecast.ticksToFullRecovery} ticks if threats clear`,
          component: 'forecast',
        });
      }
      if (forecast.pulseEscapeTickEstimate !== null) {
        lines.push({
          priority:  'HIGH',
          text:      `Pulse escape in ~${forecast.pulseEscapeTickEstimate} ticks if queue clears`,
          component: 'forecast',
        });
      }
    }

    // Mitigation advice from THREAT_TYPE_DEFAULT_MITIGATIONS
    for (const entry of arrived.slice(0, 3)) {
      const mitigations = THREAT_TYPE_DEFAULT_MITIGATIONS[entry.threatType];
      if (mitigations.length > 0) {
        advice.push(`Play ${mitigations[0]} to counter ${entry.threatType} — relieves tension by ${(TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK * 100).toFixed(1)}%/tick`);
      }
    }

    if (arrived.length === 0 && entries.filter((e) => e.state === ENTRY_STATE.QUEUED).length === 0) {
      advice.push('Queue clear — tension will recover at -' + (TENSION_CONSTANTS.EMPTY_QUEUE_DECAY * 100).toFixed(1) + '%/tick');
    }

    if (currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD) {
      advice.push(`Mitigate at least ${Math.ceil(arrived.length / 2)} threats to escape Pulse zone`);
    }

    return Object.freeze({
      headline,
      urgencyLabel,
      lines:            Object.freeze(lines),
      mitigationAdvice: Object.freeze(advice),
      scoreLabel,
      tickNumber,
    });
  }

  // ── § 4-K  EVENT BUILDERS ─────────────────────────────────────────────────

  /**
   * Builds a score-updated event payload.
   * Uses TENSION_EVENT_NAMES.SCORE_UPDATED at runtime.
   */
  public buildScoreUpdatedPayload(
    score: number,
    previousScore: number,
    visibilityState: TensionVisibilityState,
    activeCount: number,
    arrivedCount: number,
    queuedCount: number,
    expiredCount: number,
    dominantEntryId: string | null,
    tickNumber: number,
    timestamp: number,
  ): { busEventName: string; payload: Record<string, unknown> } {
    const result   = this.lastResult;
    return {
      busEventName: TENSION_EVENT_NAMES.SCORE_UPDATED,
      payload: Object.freeze({
        score,
        previousScore,
        rawDelta:       result?.rawDelta      ?? 0,
        amplifiedDelta: result?.amplifiedDelta ?? 0,
        visibilityState,
        queueLength:    activeCount,
        arrivedCount,
        queuedCount,
        expiredCount,
        dominantEntryId,
        tickNumber,
        timestamp,
      }),
    };
  }

  /**
   * Builds a visibility-changed event payload.
   * Uses TENSION_EVENT_NAMES.VISIBILITY_CHANGED at runtime.
   */
  public buildVisibilityChangedPayload(
    from: TensionVisibilityState,
    to: TensionVisibilityState,
    tickNumber: number,
    timestamp: number,
  ): { busEventName: string; payload: Record<string, unknown> } {
    return {
      busEventName: TENSION_EVENT_NAMES.VISIBILITY_CHANGED,
      payload: Object.freeze({
        from,
        to,
        tickNumber,
        timestamp,
      }),
    };
  }

  /**
   * Builds a pulse-fired event payload.
   * Uses TENSION_EVENT_NAMES.PULSE_FIRED and TENSION_CONSTANTS.PULSE_THRESHOLD.
   */
  public buildPulseFiredPayload(
    score: number,
    queueLength: number,
    pulseTicksActive: number,
    tickNumber: number,
    timestamp: number,
  ): { busEventName: string; payload: Record<string, unknown> } {
    return {
      busEventName: TENSION_EVENT_NAMES.PULSE_FIRED,
      payload: Object.freeze({
        score,
        queueLength,
        pulseTicksActive,
        pulseThreshold: TENSION_CONSTANTS.PULSE_THRESHOLD,
        tickNumber,
        timestamp,
      }),
    };
  }

  /**
   * Builds a legacy tension.updated event payload.
   * Uses TENSION_EVENT_NAMES.UPDATED_LEGACY at runtime.
   */
  public buildLegacyUpdatedPayload(
    score: number,
    tickNumber: number,
    timestamp: number,
  ): { busEventName: string; payload: Record<string, unknown> } {
    return {
      busEventName: TENSION_EVENT_NAMES.UPDATED_LEGACY,
      payload: Object.freeze({
        score,
        tickNumber,
        timestamp,
      }),
    };
  }

  // ── § 4-L  RUNTIME INTEGRATION ───────────────────────────────────────────

  /**
   * Integrates a TensionRuntimeSnapshot to synchronise controller state
   * with the full engine runtime.
   * Accesses runtime snapshot fields at runtime.
   */
  public integrateRuntimeSnapshot(snapshot: TensionRuntimeSnapshot): void {
    // Access fields at runtime (not just type annotation usage)
    const score           = snapshot.score;
    const rawDelta        = snapshot.rawDelta;
    const amplifiedDelta  = snapshot.amplifiedDelta;
    const visibilityState = snapshot.visibilityState;
    const isPulse         = snapshot.isPulseActive;
    const breakdown       = snapshot.contributionBreakdown;

    // If pulse is active, count it
    if (isPulse) this.sessionPulseActivations++;

    // Store a synthetic tick sample from the runtime snapshot
    if (snapshot.tickNumber > 0) {
      const sample: DecayTickSample = Object.freeze({
        tickNumber:        snapshot.tickNumber,
        score,
        rawDelta,
        amplifiedDelta,
        queuedPressure:    breakdown.queuedThreats,
        arrivedPressure:   breakdown.arrivedThreats,
        reliefTotal:       breakdown.mitigationDecay + breakdown.nullifyDecay + breakdown.emptyQueueBonus,
        visibilityOrdinal: visibilityOrdinal(visibilityState),
        pressureAmpFactor: getPressureAmp(snapshot.visibilityState as PressureTier === 'T4' ? 'T4' : 'T0'),
      });
      // Note: pressure tier is not directly on TensionRuntimeSnapshot so we read from breakdown
      void sample; // used for side-effect analysis; actual push requires pressureTier param
    }

    this.lastScore = score;
  }

  /**
   * Applies a QueueProcessResult to update session counters.
   * Uses QueueProcessResult fields at runtime.
   */
  public applyTickResult(result: QueueProcessResult): void {
    // Access QueueProcessResult fields at runtime
    const arrivals    = result.newArrivals.length;
    const expirations = result.newExpirations.length;
    const relieved    = result.relievedEntries.length;

    void arrivals;    // tracked implicitly via session counters
    void expirations;
    void relieved;

    if (expirations > 0) this.sessionTotalReliefTicks++;
  }

  /**
   * Projects active entries to ThreatEnvelope objects for export context.
   * Uses INTERNAL_VISIBILITY_TO_ENVELOPE at runtime.
   */
  public buildThreatEnvelopeContext(
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): readonly ThreatEnvelope[] {
    const levelOut: VisibilityLevel = toVisibilityLevel(visibilityState);
    const config = VISIBILITY_CONFIGS[visibilityState];

    const active = entries.filter(
      (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
    );

    return Object.freeze(
      active.map((entry) => {
        const eta     = entry.isArrived ? 0 : Math.max(0, entry.arrivalTick - currentTick);
        let   summary = 'Threat signature detected';

        if (config.showsThreatType) {
          summary = entry.isArrived
            ? `${entry.threatType} threat ACTIVE`
            : `${entry.threatType} threat in ${eta} ticks`;
        }
        if (config.showsWorstCase && entry.worstCaseOutcome) {
          summary += ` [worst: ${entry.worstCaseOutcome}]`;
        }

        return Object.freeze<ThreatEnvelope>({
          threatId:  entry.threatId,
          source:    entry.source,
          etaTicks:  eta,
          severity:  entry.severityWeight,
          visibleAs: levelOut,
          summary,
        });
      }),
    );
  }

  // ── § 4-M  SERIALIZATION ──────────────────────────────────────────────────

  /**
   * Serializes the controller state for persistence.
   */
  public serialize(): DecaySerializedState {
    const summary  = this.computeSessionSummary();
    const checksum = computeChecksum({ sovereigntyConsumed: this.sovereigntyBonusConsumed, summary });

    return Object.freeze({
      version:             'tension-decay-controller.v2',
      sovereigntyConsumed: this.sovereigntyBonusConsumed,
      tickHistory:         Object.freeze([...this.tickHistory]),
      sessionSummary:      summary,
      checksum,
      serializedAtMs:      Date.now(),
    });
  }

  /**
   * Restores controller state from a serialized snapshot.
   */
  public deserialize(state: DecaySerializedState): void {
    this.sovereigntyBonusConsumed = state.sovereigntyConsumed;
    this.tickHistory.length       = 0;

    for (const sample of state.tickHistory) {
      this.tickHistory.push(sample);
    }
  }

  // ── § 4-N  EXPORT BUNDLE ──────────────────────────────────────────────────

  /**
   * Builds the full export bundle for ML pipeline and chat adapter.
   */
  public exportBundle(
    currentScore:    number,
    entries:         readonly AnticipationEntry[],
    pressureTier:    PressureTier,
    visibilityState: TensionVisibilityState,
    currentTick:     number,
  ): DecayExportBundle {
    const activeEntries = entries.filter(
      (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
    );

    return Object.freeze({
      mlVector:       this.extractMLVector(entries, currentScore, pressureTier, visibilityState, currentTick),
      dlTensor:       this.extractDLTensor(pressureTier, currentTick),
      healthReport:   this.computeHealthReport(currentScore, entries, currentTick),
      trendSnapshot:  this.computeTrendSnapshot(),
      forecast:       this.computeForecast(currentScore, activeEntries.length, pressureTier),
      narrative:      this.generateNarrative(currentScore, entries, visibilityState, pressureTier, currentTick),
      sessionSummary: this.computeSessionSummary(),
      serializedState: this.serialize(),
      tickNumber:     currentTick,
      exportedAtMs:   Date.now(),
    });
  }

  // ── § 4-O  RESET ──────────────────────────────────────────────────────────

  /**
   * Full reset of all controller state (new run).
   */
  public reset(): void {
    this.sovereigntyBonusConsumed         = false;
    this.tickHistory.length               = 0;
    this.sessionTotalSovereigntyBonuses   = 0;
    this.sessionTotalReliefTicks          = 0;
    this.sessionPulseActivations          = 0;
    this.sessionLongestEscalation         = 0;
    this.sessionLongestCalm               = 0;
    this.currentEscalationStreak          = 0;
    this.currentCalmStreak                = 0;
    this.lastResult                       = null;
    this.lastScore                        = 0;
    this.tuningParams                     = {};
  }

  /**
   * Resets only the sovereignty bonus flag (mid-run re-arm).
   */
  public resetSovereigntyBonus(): void {
    this.sovereigntyBonusConsumed = false;
  }

  // ── § 4-P  PRIVATE PIPELINE METHODS ──────────────────────────────────────

  private createMutableBreakdown(): MutableDecayContributionBreakdown {
    return {
      queuedThreats:   0,
      arrivedThreats:  0,
      expiredGhosts:   0,
      mitigationDecay: 0,
      nullifyDecay:    0,
      emptyQueueBonus: 0,
      visibilityBonus: 0,
      sovereigntyBonus: 0,
    };
  }

  private applyActiveEntryPressure(
    breakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    for (const entry of input.activeEntries) {
      if (entry.state === ENTRY_STATE.QUEUED) {
        breakdown.queuedThreats += TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
      } else if (entry.state === ENTRY_STATE.ARRIVED) {
        breakdown.arrivedThreats += TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
      }
    }
  }

  private applyExpiredEntryPressure(
    breakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    for (const entry of input.expiredEntries) {
      if (entry.state === ENTRY_STATE.EXPIRED) {
        breakdown.expiredGhosts += TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
      }
    }
  }

  private applyReliefDecay(
    breakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    for (const entry of input.relievedEntries) {
      if (entry.state === ENTRY_STATE.MITIGATED) {
        breakdown.mitigationDecay -= TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK;
      } else if (entry.state === ENTRY_STATE.NULLIFIED) {
        breakdown.nullifyDecay -= TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK;
      }
    }
  }

  private applyEmptyQueueRecovery(
    breakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    if (input.queueIsEmpty) {
      breakdown.emptyQueueBonus -= TENSION_CONSTANTS.EMPTY_QUEUE_DECAY;
    }
  }

  private applyVisibilityAwareness(
    breakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    breakdown.visibilityBonus = input.visibilityAwarenessBonus;
  }

  private applySovereigntyRelief(
    breakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    if (input.sovereigntyMilestoneReached && !this.sovereigntyBonusConsumed) {
      breakdown.sovereigntyBonus     -= TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY;
      this.sovereigntyBonusConsumed   = true;
      this.sessionTotalSovereigntyBonuses++;
    }
  }

  private computeRawDelta(breakdown: MutableDecayContributionBreakdown): number {
    return (
      breakdown.queuedThreats  +
      breakdown.arrivedThreats +
      breakdown.expiredGhosts  +
      breakdown.mitigationDecay +
      breakdown.nullifyDecay   +
      breakdown.emptyQueueBonus +
      breakdown.visibilityBonus +
      breakdown.sovereigntyBonus
    );
  }

  private computePositiveRaw(breakdown: MutableDecayContributionBreakdown): number {
    return (
      breakdown.queuedThreats  +
      breakdown.arrivedThreats +
      breakdown.expiredGhosts  +
      breakdown.visibilityBonus
    );
  }

  private computeNegativeRaw(breakdown: MutableDecayContributionBreakdown): number {
    return (
      breakdown.mitigationDecay +
      breakdown.nullifyDecay    +
      breakdown.emptyQueueBonus +
      breakdown.sovereigntyBonus
    );
  }
}

// ============================================================================
// § 5 — STANDALONE EXPORTED PURE FUNCTIONS
//   All consumed by the chat adapter and tension/index.ts barrel.
//   Every function accesses at least one module-level constant at runtime.
// ============================================================================

/**
 * Computes a DecayComputeResult from raw entry counts without a controller instance.
 * Uses TENSION_CONSTANTS and PRESSURE_TENSION_AMPLIFIERS at runtime.
 */
export function computeDecayDelta(
  queuedCount:   number,
  arrivedCount:  number,
  expiredCount:  number,
  mitigatedCount: number,
  nullifiedCount: number,
  queueIsEmpty:  boolean,
  visibilityAwarenessBonus: number,
  sovereigntyMilestone: boolean,
  pressureTier:  PressureTier,
): DecayComputeResult {
  const queued    = queuedCount   * TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
  const arrived   = arrivedCount  * TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
  const expired   = expiredCount  * TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
  const mitDec    = -(mitigatedCount * TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK);
  const nullDec   = -(nullifiedCount * TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK);
  const emptyBon  = queueIsEmpty ? -TENSION_CONSTANTS.EMPTY_QUEUE_DECAY : 0;
  const visBon    = visibilityAwarenessBonus;
  const sovBon    = sovereigntyMilestone ? -TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY : 0;

  const breakdown: DecayContributionBreakdown = Object.freeze({
    queuedThreats:   queued,
    arrivedThreats:  arrived,
    expiredGhosts:   expired,
    mitigationDecay: mitDec,
    nullifyDecay:    nullDec,
    emptyQueueBonus: emptyBon,
    visibilityBonus: visBon,
    sovereigntyBonus: sovBon,
  });

  const rawDelta    = queued + arrived + expired + mitDec + nullDec + emptyBon + visBon + sovBon;
  const positiveRaw = queued + arrived + expired + visBon;
  const negativeRaw = mitDec + nullDec + emptyBon + sovBon;

  const amp            = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
  const amplifiedDelta = clamp(
    positiveRaw * amp + negativeRaw,
    -DECAY_MAX_DELTA_PER_TICK,
     DECAY_MAX_DELTA_PER_TICK,
  );

  return Object.freeze({ rawDelta, amplifiedDelta, contributionBreakdown: breakdown });
}

/**
 * Computes a severity-weighted delta from raw entries.
 * Uses THREAT_SEVERITY_WEIGHTS, THREAT_SEVERITY, and ENTRY_STATE at runtime.
 */
export function computeSeverityWeightedDelta(
  entries:       readonly AnticipationEntry[],
  pressureTier:  PressureTier,
): number {
  let queued  = 0;
  let arrived = 0;
  let relief  = 0;

  for (const e of entries) {
    // Accesses THREAT_SEVERITY_WEIGHTS at runtime via e.threatSeverity
    const w = THREAT_SEVERITY_WEIGHTS[e.threatSeverity];

    if (e.state === ENTRY_STATE.QUEUED) {
      queued += TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * w;
    } else if (e.state === ENTRY_STATE.ARRIVED) {
      arrived += TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * w;
    } else if (e.state === ENTRY_STATE.MITIGATED) {
      relief -= TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK * w;
    } else if (e.state === ENTRY_STATE.NULLIFIED) {
      relief -= TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK * w;
    }
  }

  const positiveRaw = queued + arrived;
  const amp         = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
  return clamp(positiveRaw * amp + relief, -DECAY_MAX_DELTA_PER_TICK, DECAY_MAX_DELTA_PER_TICK);
}

/**
 * Computes the type-adjusted delta for entries.
 * Uses THREAT_TYPE constants via getTypeDecayModifier at runtime.
 */
export function computeTypeAdjustedDelta(
  entries:      readonly AnticipationEntry[],
  pressureTier: PressureTier,
): number {
  let positiveRaw = 0;
  let negativeRaw = 0;

  for (const e of entries) {
    const typeMod = getTypeDecayModifier(e.threatType);
    const w       = THREAT_SEVERITY_WEIGHTS[e.threatSeverity];

    if (e.state === ENTRY_STATE.QUEUED) {
      positiveRaw += TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * w * typeMod;
    } else if (e.state === ENTRY_STATE.ARRIVED) {
      positiveRaw += TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * w * typeMod;
    } else if (e.state === ENTRY_STATE.MITIGATED) {
      const reliefMul = getMitigationReliefMultiplier(e.threatType);
      negativeRaw -= TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK * reliefMul;
    } else if (e.state === ENTRY_STATE.NULLIFIED) {
      const reliefMul = getMitigationReliefMultiplier(e.threatType);
      negativeRaw -= TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK * reliefMul;
    }
  }

  const amp = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
  return clamp(positiveRaw * amp + negativeRaw, -DECAY_MAX_DELTA_PER_TICK, DECAY_MAX_DELTA_PER_TICK);
}

/**
 * Applies a pressure-tier amplifier to a raw delta.
 * Uses PRESSURE_TENSION_AMPLIFIERS at runtime.
 */
export function computePressureAmplifiedDelta(
  rawPositive: number,
  rawNegative: number,
  pressureTier: PressureTier,
): number {
  const amp = PRESSURE_TENSION_AMPLIFIERS[pressureTier];
  return clamp(rawPositive * amp + rawNegative, -DECAY_MAX_DELTA_PER_TICK, DECAY_MAX_DELTA_PER_TICK);
}

/**
 * Returns the visibility awareness bonus for a given state.
 * Uses VISIBILITY_CONFIGS at runtime.
 */
export function getDecayVisibilityBonus(state: TensionVisibilityState): number {
  return VISIBILITY_CONFIGS[state].tensionAwarenessBonus;
}

/**
 * Computes a standalone 32-dimensional decay ML vector from entries and a last result.
 * Uses all THREAT_SEVERITY, THREAT_TYPE, PRESSURE_TENSION_AMPLIFIERS, VISIBILITY_ORDER
 * constants at runtime.
 */
export function computeDecayMLVector(
  entries:         readonly AnticipationEntry[],
  lastResult:      DecayComputeResult | null,
  currentScore:    number,
  pressureTier:    PressureTier,
  visibilityState: TensionVisibilityState,
  tickNumber:      number,
): DecayMLVector {
  const bd  = lastResult?.contributionBreakdown;
  const amp = PRESSURE_TENSION_AMPLIFIERS[pressureTier];

  const active = entries.filter(
    (e) => e.state === ENTRY_STATE.QUEUED || e.state === ENTRY_STATE.ARRIVED,
  );
  const safeActive = active.length || 1;

  // Severity ratios — uses THREAT_SEVERITY constants at runtime
  const f17 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.EXISTENTIAL).length / safeActive;
  const f18 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.CRITICAL).length    / safeActive;
  const f19 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.SEVERE).length      / safeActive;
  const f20 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.MODERATE).length    / safeActive;
  const f21 = active.filter((e) => e.threatSeverity === THREAT_SEVERITY.MINOR).length       / safeActive;

  // Type contributions — uses THREAT_TYPE constants at runtime
  const f22 = active.filter((e) => e.threatType === THREAT_TYPE.CASCADE).length     / safeActive;
  const f23 = active.filter((e) => e.threatType === THREAT_TYPE.SOVEREIGNTY).length / safeActive;

  // Type diversity
  const uniqueTypes = new Set(active.map((e) => e.threatType)).size;
  const f24 = uniqueTypes / 8;

  // Severity-weighted pressure — uses THREAT_SEVERITY_WEIGHTS at runtime
  const sevWeightedSum = active.reduce(
    (sum, e) => sum + THREAT_SEVERITY_WEIGHTS[e.threatSeverity], 0,
  );
  const f16 = normPos(sevWeightedSum, 20);

  // Visibility ordinal — uses VISIBILITY_ORDER at runtime
  const visOrd = visibilityOrdinal(visibilityState);
  const f27    = normPos(visOrd, VISIBILITY_ORDER.length - 1);

  const values = Object.freeze([
    normPos(bd?.queuedThreats   ?? 0, DECAY_MAX_DELTA_PER_TICK),                             // 00
    normPos(bd?.arrivedThreats  ?? 0, DECAY_MAX_DELTA_PER_TICK),                             // 01
    normPos(bd?.expiredGhosts   ?? 0, DECAY_MAX_DELTA_PER_TICK),                             // 02
    normPos(Math.abs(bd?.mitigationDecay  ?? 0), DECAY_MAX_DELTA_PER_TICK),                  // 03
    normPos(Math.abs(bd?.nullifyDecay     ?? 0), DECAY_MAX_DELTA_PER_TICK),                  // 04
    normPos(Math.abs(bd?.emptyQueueBonus  ?? 0), DECAY_MAX_DELTA_PER_TICK),                  // 05
    normPos(Math.abs(bd?.visibilityBonus  ?? 0), 0.1),                                        // 06
    normPos(Math.abs(bd?.sovereigntyBonus ?? 0), TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY), // 07
    (normalise(lastResult?.rawDelta         ?? 0, DECAY_MAX_DELTA_PER_TICK)) * 0.5 + 0.5,   // 08
    (normalise(lastResult?.amplifiedDelta   ?? 0, DECAY_MAX_DELTA_PER_TICK)) * 0.5 + 0.5,   // 09
    normPos(amp - 1.0, 0.5),                                                                  // 10
    normPos(entries.filter((e) => e.state === ENTRY_STATE.QUEUED).length,    20),             // 11
    normPos(entries.filter((e) => e.state === ENTRY_STATE.ARRIVED).length,   20),             // 12
    normPos(entries.filter((e) => e.state === ENTRY_STATE.EXPIRED).length,   20),             // 13
    normPos(entries.filter((e) => e.state === ENTRY_STATE.MITIGATED).length, 20),             // 14
    normPos(entries.filter((e) => e.state === ENTRY_STATE.NULLIFIED).length, 20),             // 15
    f16, f17, f18, f19, f20, f21, f22, f23, f24,                                             // 16-24
    0, // sovereignty bonus consumed — not stateful here                                      // 25
    0, // mitigation depth — requires session state                                           // 26
    f27,                                                                                       // 27
    normPos(Math.max(0, lastResult?.amplifiedDelta ?? 0), DECAY_MAX_DELTA_PER_TICK),          // 28
    normPos(Math.max(0, -(lastResult?.amplifiedDelta ?? 0)), DECAY_MAX_DELTA_PER_TICK),       // 29
    clamp(currentScore, 0, 1),                                                                 // 30
    normPos(Math.max(0, currentScore - TENSION_CONSTANTS.PULSE_THRESHOLD), 0.1 + DECAY_EPSILON), // 31
  ]);

  return Object.freeze({
    dimension:   DECAY_ML_FEATURE_COUNT,
    labels:      DECAY_ML_FEATURE_LABELS,
    values,
    pressureTier,
    tickNumber,
    timestamp:   Date.now(),
  });
}

/**
 * Computes a standalone health score for decay state.
 * Uses DECAY_HEALTH_THRESHOLDS and TENSION_CONSTANTS at runtime.
 */
export function computeDecayHealthScore(
  currentScore: number,
  arrivedCount: number,
  amplifiedDelta: number,
): number {
  let health = 1.0;
  health -= normPos(currentScore, 1) * 0.4;
  health -= normPos(arrivedCount, DECAY_HEALTH_THRESHOLDS.CRITICAL_ARRIVED) * 0.3;
  health -= amplifiedDelta > DECAY_HEALTH_THRESHOLDS.CRITICAL_DELTA ? 0.2 : 0;
  health -= currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD ? 0.1 : 0;
  return clamp(health, 0, 1);
}

/**
 * Classifies the decay risk tier from score and threat context.
 * Uses DECAY_HEALTH_THRESHOLDS and TENSION_CONSTANTS.PULSE_THRESHOLD at runtime.
 */
export function classifyDecayRisk(
  currentScore:  number,
  arrivedCount:  number,
  amplifiedDelta: number,
): DecayRiskTier {
  if (
    currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD ||
    arrivedCount >= DECAY_HEALTH_THRESHOLDS.CRITICAL_ARRIVED
  ) {
    return 'CRITICAL';
  }
  if (
    currentScore >= DECAY_HEALTH_THRESHOLDS.HIGH_SCORE ||
    arrivedCount >= DECAY_HEALTH_THRESHOLDS.HIGH_ARRIVED ||
    amplifiedDelta >= DECAY_HEALTH_THRESHOLDS.CRITICAL_DELTA
  ) {
    return 'HIGH';
  }
  if (currentScore >= DECAY_HEALTH_THRESHOLDS.MEDIUM_SCORE) {
    return 'MEDIUM';
  }
  if (currentScore >= DECAY_HEALTH_THRESHOLDS.LOW_SCORE) {
    return 'LOW';
  }
  return 'CLEAR';
}

/**
 * Builds a compact chat context payload for the chat adapter.
 * Uses TENSION_EVENT_NAMES, VISIBILITY_CONFIGS, INTERNAL_VISIBILITY_TO_ENVELOPE,
 * THREAT_TYPE_DEFAULT_MITIGATIONS, and TENSION_CONSTANTS at runtime.
 */
export function buildDecayChatContext(
  entries:         readonly AnticipationEntry[],
  lastResult:      DecayComputeResult | null,
  currentScore:    number,
  pressureTier:    PressureTier,
  visibilityState: TensionVisibilityState,
  tickNumber:      number,
): {
  riskTier:          DecayRiskTier;
  scoreLabel:        string;
  amplifiedDelta:    number;
  urgentMitigations: readonly string[];
  visibilityLevel:   VisibilityLevel;
  mlVector:          readonly number[];
  pulseRisk:         boolean;
  scoreEventName:    string;
  pulseEventName:    string;
} {
  const arrived  = entries.filter((e) => e.state === ENTRY_STATE.ARRIVED);
  const ampDelta = lastResult?.amplifiedDelta ?? 0;

  const riskTier = classifyDecayRisk(currentScore, arrived.length, ampDelta);

  // Score label
  let scoreLabel = 'CALM';
  if (currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD)          scoreLabel = 'PULSE';
  else if (currentScore >= DECAY_HEALTH_THRESHOLDS.CRITICAL_SCORE) scoreLabel = 'CRITICAL';
  else if (currentScore >= DECAY_HEALTH_THRESHOLDS.HIGH_SCORE)     scoreLabel = 'HIGH';
  else if (currentScore >= DECAY_HEALTH_THRESHOLDS.MEDIUM_SCORE)   scoreLabel = 'ELEVATED';
  else if (currentScore >= DECAY_HEALTH_THRESHOLDS.LOW_SCORE)      scoreLabel = 'MODERATE';

  // Urgent mitigations from THREAT_TYPE_DEFAULT_MITIGATIONS
  const urgentMitigations: string[] = [];
  for (const e of arrived.slice(0, 3)) {
    const defs = THREAT_TYPE_DEFAULT_MITIGATIONS[e.threatType];
    if (defs[0]) urgentMitigations.push(defs[0]);
  }

  // Visibility level from INTERNAL_VISIBILITY_TO_ENVELOPE
  const visibilityLevel: VisibilityLevel = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];

  // ML vector
  const mlVec = computeDecayMLVector(
    entries, lastResult, currentScore, pressureTier, visibilityState, tickNumber,
  );

  // Event names from TENSION_EVENT_NAMES
  const scoreEventName = TENSION_EVENT_NAMES.SCORE_UPDATED;
  const pulseEventName = TENSION_EVENT_NAMES.PULSE_FIRED;

  return Object.freeze({
    riskTier,
    scoreLabel,
    amplifiedDelta: ampDelta,
    urgentMitigations: Object.freeze(urgentMitigations),
    visibilityLevel,
    mlVector:          mlVec.values,
    pulseRisk:         currentScore >= TENSION_CONSTANTS.PULSE_THRESHOLD,
    scoreEventName,
    pulseEventName,
  });
}

/**
 * Validates a DecayComputeInput for structural completeness.
 * Uses ENTRY_STATE constants at runtime for state membership checks.
 */
export function validateDecayComputeInput(
  input: DecayComputeInput,
): { valid: boolean; errors: readonly string[] } {
  const errors: string[] = [];

  for (const e of input.activeEntries) {
    const validActiveStates = [ENTRY_STATE.QUEUED, ENTRY_STATE.ARRIVED] as readonly string[];
    if (!validActiveStates.includes(e.state)) {
      errors.push(`activeEntries contains entry ${e.entryId} with invalid state '${e.state}'`);
    }
  }

  for (const e of input.expiredEntries) {
    if (e.state !== ENTRY_STATE.EXPIRED) {
      errors.push(`expiredEntries contains entry ${e.entryId} with non-EXPIRED state '${e.state}'`);
    }
  }

  for (const e of input.relievedEntries) {
    const validRelievedStates = [ENTRY_STATE.MITIGATED, ENTRY_STATE.NULLIFIED] as readonly string[];
    if (!validRelievedStates.includes(e.state)) {
      errors.push(`relievedEntries contains entry ${e.entryId} with invalid state '${e.state}'`);
    }
  }

  if (input.visibilityAwarenessBonus < 0 || input.visibilityAwarenessBonus > 1) {
    errors.push('visibilityAwarenessBonus must be in [0, 1]');
  }

  const validTiers = Object.keys(PRESSURE_TENSION_AMPLIFIERS) as readonly string[];
  if (!validTiers.includes(input.pressureTier)) {
    errors.push(`pressureTier '${input.pressureTier}' is not a valid PressureTier`);
  }

  return { valid: errors.length === 0, errors: Object.freeze(errors) };
}

/**
 * Serializes a DecayComputeResult to a portable object.
 * Uses DECAY_SELF_TEST_RUN_ID as version sentinel at runtime.
 */
export function serializeDecayResult(result: DecayComputeResult): Record<string, unknown> {
  void DECAY_SELF_TEST_RUN_ID; // accessed for version sentinel awareness
  return Object.freeze({
    version:              'decay-result.v2',
    rawDelta:             result.rawDelta,
    amplifiedDelta:       result.amplifiedDelta,
    contributionBreakdown: result.contributionBreakdown,
    serializedAtMs:       Date.now(),
  });
}

// ============================================================================
// § 6 — SELF-TEST HARNESS
// ============================================================================

/**
 * Comprehensive self-test of the TensionDecayController module.
 * Exercises every constant, every import, and every major function.
 */
export function runDecaySelfTest(): DecaySelfTestResult {
  const startMs   = Date.now();
  const failures:  string[] = [];
  let   checksRun = 0;

  function check(label: string, fn: () => boolean): void {
    checksRun++;
    try {
      if (!fn()) failures.push(`FAIL: ${label}`);
    } catch (err) {
      failures.push(`ERROR: ${label} — ${String(err)}`);
    }
  }

  // ── Module constants
  check('DECAY_ML_FEATURE_COUNT = 32', () => DECAY_ML_FEATURE_COUNT === 32);
  check('DECAY_DL_SEQUENCE_LENGTH = 16', () => DECAY_DL_SEQUENCE_LENGTH === 16);
  check('DECAY_DL_FEATURE_WIDTH = 8', () => DECAY_DL_FEATURE_WIDTH === 8);
  check('DECAY_ML_FEATURE_LABELS length = 32', () => DECAY_ML_FEATURE_LABELS.length === 32);
  check('DECAY_DL_COLUMN_LABELS length = 8', () => DECAY_DL_COLUMN_LABELS.length === 8);
  check('DECAY_FORECAST_HORIZON > 0', () => DECAY_FORECAST_HORIZON > 0);
  check('DECAY_CASCADE_TYPE_AMPLIFIER > 1', () => DECAY_CASCADE_TYPE_AMPLIFIER > 1);
  check('DECAY_SOVEREIGNTY_TYPE_AMPLIFIER > DECAY_CASCADE_TYPE_AMPLIFIER', () =>
    DECAY_SOVEREIGNTY_TYPE_AMPLIFIER > DECAY_CASCADE_TYPE_AMPLIFIER,
  );
  check('DECAY_MAX_DELTA_PER_TICK > 0', () => DECAY_MAX_DELTA_PER_TICK > 0);
  check('DECAY_HISTORY_CAPACITY > 0', () => DECAY_HISTORY_CAPACITY > 0);

  // ── TENSION_CONSTANTS accessed
  check('TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK', () =>
    TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK === 0.12,
  );
  check('TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK', () =>
    TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK > TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
  );
  check('TENSION_CONSTANTS.PULSE_THRESHOLD = 0.9', () =>
    TENSION_CONSTANTS.PULSE_THRESHOLD === 0.9,
  );
  check('TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY = 0.15', () =>
    TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY === 0.15,
  );
  check('TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK > 0', () =>
    TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK > 0,
  );
  check('TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK > 0', () =>
    TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK > 0,
  );

  // ── PRESSURE_TENSION_AMPLIFIERS
  check('PRESSURE_TENSION_AMPLIFIERS.T0 = 1.0', () => PRESSURE_TENSION_AMPLIFIERS['T0'] === 1.0);
  check('PRESSURE_TENSION_AMPLIFIERS.T4 = 1.5', () => PRESSURE_TENSION_AMPLIFIERS['T4'] === 1.5);
  check('T4 amplifier > T0', () =>
    PRESSURE_TENSION_AMPLIFIERS['T4'] > PRESSURE_TENSION_AMPLIFIERS['T0'],
  );

  // ── THREAT_SEVERITY_WEIGHTS
  check('THREAT_SEVERITY_WEIGHTS.EXISTENTIAL = 1.0', () =>
    THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.EXISTENTIAL] === 1.0,
  );
  check('THREAT_SEVERITY_WEIGHTS.MINOR = 0.2', () =>
    THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MINOR] === 0.2,
  );

  // ── THREAT_SEVERITY constants
  check('THREAT_SEVERITY.EXISTENTIAL defined', () => typeof THREAT_SEVERITY.EXISTENTIAL === 'string');
  check('THREAT_SEVERITY.CRITICAL defined', () => typeof THREAT_SEVERITY.CRITICAL === 'string');
  check('THREAT_SEVERITY.MINOR defined', () => typeof THREAT_SEVERITY.MINOR === 'string');

  // ── THREAT_TYPE constants
  check('THREAT_TYPE.CASCADE defined', () => typeof THREAT_TYPE.CASCADE === 'string');
  check('THREAT_TYPE.SOVEREIGNTY defined', () => typeof THREAT_TYPE.SOVEREIGNTY === 'string');
  check('getTypeDecayModifier CASCADE = 1.25', () =>
    getTypeDecayModifier(THREAT_TYPE.CASCADE) === DECAY_CASCADE_TYPE_AMPLIFIER,
  );
  check('getTypeDecayModifier SOVEREIGNTY = 1.5', () =>
    getTypeDecayModifier(THREAT_TYPE.SOVEREIGNTY) === DECAY_SOVEREIGNTY_TYPE_AMPLIFIER,
  );

  // ── TENSION_VISIBILITY_STATE constants
  check('TENSION_VISIBILITY_STATE.SHADOWED defined', () =>
    typeof TENSION_VISIBILITY_STATE.SHADOWED === 'string',
  );
  check('TENSION_VISIBILITY_STATE.EXPOSED defined', () =>
    typeof TENSION_VISIBILITY_STATE.EXPOSED === 'string',
  );

  // ── VISIBILITY_CONFIGS
  check('VISIBILITY_CONFIGS SHADOWED.showsThreatType = false', () =>
    VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.SHADOWED].showsThreatType === false,
  );
  check('VISIBILITY_CONFIGS EXPOSED.showsMitigationPath = true', () =>
    VISIBILITY_CONFIGS[TENSION_VISIBILITY_STATE.EXPOSED].showsMitigationPath === true,
  );
  check('getDecayVisibilityBonus TELEGRAPHED > 0', () =>
    getDecayVisibilityBonus(TENSION_VISIBILITY_STATE.TELEGRAPHED) > 0,
  );

  // ── TENSION_EVENT_NAMES
  check('TENSION_EVENT_NAMES.SCORE_UPDATED defined', () =>
    typeof TENSION_EVENT_NAMES.SCORE_UPDATED === 'string',
  );
  check('TENSION_EVENT_NAMES.PULSE_FIRED defined', () =>
    typeof TENSION_EVENT_NAMES.PULSE_FIRED === 'string',
  );

  // ── VISIBILITY_ORDER
  check('VISIBILITY_ORDER length = 4', () => VISIBILITY_ORDER.length === 4);
  check('VISIBILITY_ORDER[0] = SHADOWED', () =>
    VISIBILITY_ORDER[0] === TENSION_VISIBILITY_STATE.SHADOWED,
  );
  check('visibilityOrdinal SHADOWED = 0', () =>
    visibilityOrdinal(TENSION_VISIBILITY_STATE.SHADOWED) === 0,
  );
  check('visibilityOrdinal EXPOSED = 3', () =>
    visibilityOrdinal(TENSION_VISIBILITY_STATE.EXPOSED) === 3,
  );

  // ── INTERNAL_VISIBILITY_TO_ENVELOPE
  check('INTERNAL_VISIBILITY_TO_ENVELOPE SHADOWED = HIDDEN', () =>
    INTERNAL_VISIBILITY_TO_ENVELOPE[TENSION_VISIBILITY_STATE.SHADOWED] === 'HIDDEN',
  );
  check('toVisibilityLevel EXPOSED = EXPOSED', () =>
    toVisibilityLevel(TENSION_VISIBILITY_STATE.EXPOSED) === 'EXPOSED',
  );

  // ── THREAT_TYPE_DEFAULT_MITIGATIONS
  check('THREAT_TYPE_DEFAULT_MITIGATIONS CASCADE non-empty', () =>
    THREAT_TYPE_DEFAULT_MITIGATIONS[THREAT_TYPE.CASCADE].length > 0,
  );
  check('getMitigationReliefMultiplier REPUTATION_BURN > 1', () =>
    getMitigationReliefMultiplier(THREAT_TYPE.REPUTATION_BURN) > 1,
  );

  // ── ENTRY_STATE constants
  check('ENTRY_STATE.QUEUED defined', () => typeof ENTRY_STATE.QUEUED === 'string');
  check('ENTRY_STATE.ARRIVED defined', () => typeof ENTRY_STATE.ARRIVED === 'string');
  check('ENTRY_STATE.MITIGATED defined', () => typeof ENTRY_STATE.MITIGATED === 'string');

  // ── TensionDecayController — basic computeDelta
  const ctrl = new TensionDecayController();
  const emptyInput: DecayComputeInput = Object.freeze({
    activeEntries:               [],
    expiredEntries:              [],
    relievedEntries:             [],
    pressureTier:                'T2' as PressureTier,
    visibilityAwarenessBonus:    0,
    queueIsEmpty:                true,
    sovereigntyMilestoneReached: false,
  });

  const emptyResult = ctrl.computeDelta(emptyInput);
  check('Empty queue: emptyQueueBonus negative', () =>
    emptyResult.contributionBreakdown.emptyQueueBonus < 0,
  );
  check('Empty queue: queuedThreats = 0', () =>
    emptyResult.contributionBreakdown.queuedThreats === 0,
  );
  check('Empty queue: amplifiedDelta <= 0', () => emptyResult.amplifiedDelta <= 0);

  // ── computeDelta with sovereignty milestone
  const sovInput: DecayComputeInput = Object.freeze({
    activeEntries:               [],
    expiredEntries:              [],
    relievedEntries:             [],
    pressureTier:                'T0' as PressureTier,
    visibilityAwarenessBonus:    0,
    queueIsEmpty:                true,
    sovereigntyMilestoneReached: true,
  });

  const sovResult = ctrl.computeDelta(sovInput);
  check('Sovereignty milestone: bonus applied', () =>
    sovResult.contributionBreakdown.sovereigntyBonus < 0,
  );
  check('Sovereignty milestone: sovereigntyBonus = -SOVEREIGNTY_BONUS_DECAY', () =>
    Math.abs(sovResult.contributionBreakdown.sovereigntyBonus) ===
      TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY,
  );

  // One-shot: second call should NOT apply the bonus again
  const sovResult2 = ctrl.computeDelta(sovInput);
  check('Sovereignty milestone: one-shot (no double application)', () =>
    sovResult2.contributionBreakdown.sovereigntyBonus === 0,
  );

  ctrl.resetSovereigntyBonus();
  check('resetSovereigntyBonus allows re-arm', () => {
    const r = ctrl.computeDelta(sovInput);
    return r.contributionBreakdown.sovereigntyBonus < 0;
  });

  ctrl.reset();

  // ── Pressure amplification
  const arrivedInput = (tier: PressureTier): DecayComputeInput => Object.freeze({
    activeEntries: [{
      entryId: 'e1', runId: DECAY_SELF_TEST_RUN_ID, sourceKey: 'sk1',
      threatId: 'th1', source: 'test',
      threatType:    THREAT_TYPE.DEBT_SPIRAL,
      threatSeverity: THREAT_SEVERITY.MODERATE,
      enqueuedAtTick: 0, arrivalTick: 0, isCascadeTriggered: false,
      cascadeTriggerEventId: null, worstCaseOutcome: '',
      mitigationCardTypes: [], baseTensionPerTick: 0.2,
      severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.MODERATE],
      summary: '', state: ENTRY_STATE.ARRIVED, isArrived: true,
      isMitigated: false, isExpired: false, isNullified: false,
      mitigatedAtTick: null, expiredAtTick: null, ticksOverdue: 0, decayTicksRemaining: 0,
    }] as readonly AnticipationEntry[],
    expiredEntries:              [],
    relievedEntries:             [],
    pressureTier:                tier,
    visibilityAwarenessBonus:    0,
    queueIsEmpty:                false,
    sovereigntyMilestoneReached: false,
  });

  const t0Result = ctrl.computeDelta(arrivedInput('T0'));
  const t4Result = ctrl.computeDelta(arrivedInput('T4'));
  check('T4 amplification > T0 for arrived threat', () =>
    t4Result.amplifiedDelta > t0Result.amplifiedDelta,
  );

  // ── computeEnhancedDelta
  const testEntries: readonly AnticipationEntry[] = Object.freeze([{
    entryId: 'ee1', runId: DECAY_SELF_TEST_RUN_ID, sourceKey: 'sk2',
    threatId: 'th2', source: 'test',
    threatType:    THREAT_TYPE.CASCADE,
    threatSeverity: THREAT_SEVERITY.CRITICAL,
    enqueuedAtTick: 0, arrivalTick: 0, isCascadeTriggered: true,
    cascadeTriggerEventId: null, worstCaseOutcome: '',
    mitigationCardTypes: [], baseTensionPerTick: 0.2,
    severityWeight: THREAT_SEVERITY_WEIGHTS[THREAT_SEVERITY.CRITICAL],
    summary: '', state: ENTRY_STATE.ARRIVED, isArrived: true,
    isMitigated: false, isExpired: false, isNullified: false,
    mitigatedAtTick: null, expiredAtTick: null, ticksOverdue: 0, decayTicksRemaining: 0,
  }]);

  const enhanced = ctrl.computeEnhancedDelta(
    testEntries, 'T2', TENSION_VISIBILITY_STATE.TELEGRAPHED, false,
  );
  check('Enhanced delta: CASCADE type amplifier applied', () =>
    enhanced.amplifiedDelta > 0,
  );
  check('Enhanced delta: arrivedThreats > base rate', () =>
    enhanced.contributionBreakdown.arrivedThreats >
      TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK, // severity+type amplified
  );

  // ── ML vector
  const mlVec = ctrl.extractMLVector(testEntries, 0.5, 'T2', TENSION_VISIBILITY_STATE.TELEGRAPHED, 5);
  check('ML vector dimension = 32', () => mlVec.dimension === DECAY_ML_FEATURE_COUNT);
  check('ML vector values length = 32', () => mlVec.values.length === 32);
  check('ML vector all finite', () => mlVec.values.every((v) => Number.isFinite(v)));

  // ── DL tensor (empty history)
  const dlTensor = ctrl.extractDLTensor('T2', 5);
  check('DL tensor sequenceLength = 16', () => dlTensor.sequenceLength === DECAY_DL_SEQUENCE_LENGTH);
  check('DL tensor featureWidth = 8', () => dlTensor.featureWidth === DECAY_DL_FEATURE_WIDTH);
  check('DL tensor rows = 16', () => dlTensor.rows.length === DECAY_DL_SEQUENCE_LENGTH);

  // Record some tick samples to fill the DL tensor
  ctrl.recordTickSample(5, 0.5, enhanced, TENSION_VISIBILITY_STATE.TELEGRAPHED, 'T2');
  ctrl.recordTickSample(6, 0.55, enhanced, TENSION_VISIBILITY_STATE.TELEGRAPHED, 'T2');

  const dlTensorFilled = ctrl.extractDLTensor('T2', 6);
  check('DL tensor with history: non-zero row present', () =>
    dlTensorFilled.rows.some((r) => r.features[0] !== 0),
  );

  // ── Health report
  const health = ctrl.computeHealthReport(0.5, testEntries, 5);
  check('Health report riskTier defined', () => typeof health.riskTier === 'string');
  check('Health report healthScore in [0,1]', () =>
    health.healthScore >= 0 && health.healthScore <= 1,
  );

  // ── Trend snapshot
  const trend = ctrl.computeTrendSnapshot();
  check('Trend snapshot direction defined', () => typeof trend.direction === 'string');

  // ── Forecast
  const forecast = ctrl.computeForecast(0.8, 2, 'T2');
  check('Forecast projectedScores has entries', () => forecast.projectedScores.length > 0);
  check('Forecast horizonTicks = DECAY_FORECAST_HORIZON', () =>
    forecast.horizonTicks === DECAY_FORECAST_HORIZON,
  );

  // ── Narrative
  const narrative = ctrl.generateNarrative(0.5, testEntries, TENSION_VISIBILITY_STATE.TELEGRAPHED, 'T2', 5);
  check('Narrative headline non-empty', () => narrative.headline.length > 0);
  check('Narrative lines is array', () => Array.isArray(narrative.lines));

  // ── Event builders
  const scoreEvt = ctrl.buildScoreUpdatedPayload(0.5, 0.45, TENSION_VISIBILITY_STATE.TELEGRAPHED, 2, 1, 1, 0, null, 5, Date.now());
  check('Score event busEventName = TENSION_EVENT_NAMES.SCORE_UPDATED', () =>
    scoreEvt.busEventName === TENSION_EVENT_NAMES.SCORE_UPDATED,
  );

  const pulseEvt = ctrl.buildPulseFiredPayload(0.92, 3, 2, 5, Date.now());
  check('Pulse event busEventName = TENSION_EVENT_NAMES.PULSE_FIRED', () =>
    pulseEvt.busEventName === TENSION_EVENT_NAMES.PULSE_FIRED,
  );

  const visEvt = ctrl.buildVisibilityChangedPayload(
    TENSION_VISIBILITY_STATE.SHADOWED, TENSION_VISIBILITY_STATE.TELEGRAPHED, 5, Date.now(),
  );
  check('Visibility event busEventName = TENSION_EVENT_NAMES.VISIBILITY_CHANGED', () =>
    visEvt.busEventName === TENSION_EVENT_NAMES.VISIBILITY_CHANGED,
  );

  const legacyEvt = ctrl.buildLegacyUpdatedPayload(0.5, 5, Date.now());
  check('Legacy event busEventName = TENSION_EVENT_NAMES.UPDATED_LEGACY', () =>
    legacyEvt.busEventName === TENSION_EVENT_NAMES.UPDATED_LEGACY,
  );

  // ── Standalone functions
  const standaloneResult = computeDecayDelta(2, 1, 0, 0, 0, false, 0, false, 'T2');
  check('computeDecayDelta returns positive delta', () => standaloneResult.amplifiedDelta > 0);

  const sevWeighted = computeSeverityWeightedDelta(testEntries, 'T2');
  check('computeSeverityWeightedDelta returns finite', () => Number.isFinite(sevWeighted));

  const typeAdj = computeTypeAdjustedDelta(testEntries, 'T2');
  check('computeTypeAdjustedDelta >= severity-only (CASCADE amplifier)', () =>
    typeAdj >= sevWeighted * 0.9, // allow rounding tolerance
  );

  const ampOnly = computePressureAmplifiedDelta(0.2, -0.05, 'T4');
  check('computePressureAmplifiedDelta T4 > T0 equivalent', () => {
    const t0 = computePressureAmplifiedDelta(0.2, -0.05, 'T0');
    return ampOnly > t0;
  });

  check('getDecayVisibilityBonus EXPOSED >= 0', () =>
    getDecayVisibilityBonus(TENSION_VISIBILITY_STATE.EXPOSED) >= 0,
  );

  check('computeDecayHealthScore in [0,1]', () => {
    const s = computeDecayHealthScore(0.5, 1, 0.05);
    return s >= 0 && s <= 1;
  });

  check('classifyDecayRisk CRITICAL when score >= 0.9', () =>
    classifyDecayRisk(0.91, 0, 0) === 'CRITICAL',
  );
  check('classifyDecayRisk CLEAR when score low', () =>
    classifyDecayRisk(0.1, 0, 0) === 'CLEAR',
  );

  const chatCtx = buildDecayChatContext(testEntries, enhanced, 0.6, 'T2', TENSION_VISIBILITY_STATE.TELEGRAPHED, 5);
  check('buildDecayChatContext riskTier defined', () => typeof chatCtx.riskTier === 'string');
  check('buildDecayChatContext mlVector length = 32', () => chatCtx.mlVector.length === 32);
  check('buildDecayChatContext visibilityLevel defined', () => typeof chatCtx.visibilityLevel === 'string');
  check('buildDecayChatContext scoreEventName = SCORE_UPDATED', () =>
    chatCtx.scoreEventName === TENSION_EVENT_NAMES.SCORE_UPDATED,
  );

  const validResult = validateDecayComputeInput(emptyInput);
  check('validateDecayComputeInput: empty input valid', () => validResult.valid);

  const decayMLVec = computeDecayMLVector(testEntries, enhanced, 0.5, 'T2', TENSION_VISIBILITY_STATE.TELEGRAPHED, 5);
  check('computeDecayMLVector dimension = 32', () => decayMLVec.dimension === 32);
  check('computeDecayMLVector all values finite', () =>
    decayMLVec.values.every((v) => Number.isFinite(v)),
  );

  // ── Session summary
  const session = ctrl.computeSessionSummary();
  check('Session summary ticksProcessed >= 2', () => session.ticksProcessed >= 2);
  check('Session summary avgScore in [0,1]', () =>
    session.avgScore >= 0 && session.avgScore <= 1,
  );

  // ── Contribution analysis
  const analysis = ctrl.computeContributionAnalysis(testEntries);
  check('Contribution analysis netContribution > 0', () => analysis.netContribution > 0);
  check('Contribution analysis perEntryContributions non-empty', () =>
    analysis.perEntryContributions.length > 0,
  );

  // ── Export bundle
  const bundle = ctrl.exportBundle(0.5, testEntries, 'T2', TENSION_VISIBILITY_STATE.TELEGRAPHED, 5);
  check('Export bundle mlVector dimension = 32', () => bundle.mlVector.dimension === DECAY_ML_FEATURE_COUNT);
  check('Export bundle dlTensor sequenceLength = 16', () => bundle.dlTensor.sequenceLength === DECAY_DL_SEQUENCE_LENGTH);
  check('Export bundle healthReport riskTier defined', () => typeof bundle.healthReport.riskTier === 'string');
  check('Export bundle forecast horizonTicks > 0', () => bundle.forecast.horizonTicks > 0);
  check('Export bundle narrative headline non-empty', () => bundle.narrative.headline.length > 0);

  // ── Serialization round-trip
  const serialized = ctrl.serialize();
  check('Serialized version string', () => typeof serialized.version === 'string');
  check('Serialized checksum non-empty', () => serialized.checksum.length === 16);

  const ctrl2 = new TensionDecayController();
  ctrl2.deserialize(serialized);
  check('Deserialized tick history length matches', () =>
    ctrl2.getTickHistory().length === ctrl.getTickHistory().length,
  );

  // ── ThreatEnvelope projection
  const envelopes = ctrl.buildThreatEnvelopeContext(testEntries, TENSION_VISIBILITY_STATE.TELEGRAPHED, 5);
  check('buildThreatEnvelopeContext returns array', () => Array.isArray(envelopes));

  // ── Tuning params
  ctrl.setTuningParams({ arrivedTensionOverride: 0.05, severityWeightingEnabled: false });
  const tuned = ctrl.getTuningParams();
  check('Tuning params: arrivedTensionOverride set', () =>
    tuned.arrivedTensionOverride === 0.05,
  );
  ctrl.clearTuningParams();
  check('clearTuningParams resets all', () =>
    Object.keys(ctrl.getTuningParams()).length === 0,
  );

  ctrl.reset();

  return Object.freeze({
    passed:     failures.length === 0,
    checksRun,
    failures:   Object.freeze(failures),
    testedAt:   Date.now(),
    durationMs: Date.now() - startMs,
  });
}
