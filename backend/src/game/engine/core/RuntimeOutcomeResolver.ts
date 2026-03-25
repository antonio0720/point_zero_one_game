/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/RuntimeOutcomeResolver.ts
 *
 * Doctrine:
 * - terminal outcome resolution belongs to the backend authority surface
 * - outcomes must be deterministic, explicit, and telemetry-addressable
 * - reason codes are as important as the terminal state itself
 * - applying an outcome must never mutate the caller's snapshot
 * - ML outcome probabilities are a first-class resolved surface
 * - economy trajectory analysis drives runway forecasting and chat urgency
 * - narration hints feed companion AI — never invented by the adapter layer
 * - batch resolution is a performance contract, not an afterthought
 *
 * Surface summary:
 *   § 1  — Module constants and version metadata
 *   § 2  — ML/DL feature label arrays
 *   § 3  — Existing core types (preserved)
 *   § 4  — Extended analytical types
 *   § 5  — OutcomeMLVectorBuilder
 *   § 6  — OutcomeDLTensorBuilder
 *   § 7  — OutcomeProximityAnalyzer
 *   § 8  — OutcomeEconomyTrajectoryAnalyzer
 *   § 9  — OutcomeForecastEngine
 *   § 10 — OutcomeNarrationHintBuilder
 *   § 11 — OutcomeHistoryTracker
 *   § 12 — OutcomeThresholdAdvisor
 *   § 13 — OutcomeBatchResolver
 *   § 14 — OutcomeResolverHealthMonitor
 *   § 15 — RuntimeOutcomeResolver (enhanced)
 *   § 16 — OutcomeResolverFacade
 */

import type { RunStateSnapshot } from './RunStateSnapshot';
import {
  cloneJson,
  deepFreeze,
  checksumSnapshot,
  createDeterministicId,
  deepFrozenClone,
  stableStringify,
} from './Deterministic';
import type {
  ModeCode,
  PressureTier,
  RunPhase,
  RunOutcome,
} from './GamePrimitives';
import {
  PRESSURE_TIER_NORMALIZED,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_ESCALATION_THRESHOLD,
  PRESSURE_TIER_DEESCALATION_THRESHOLD,
  isModeCode,
  isPressureTier,
  isRunPhase,
  isRunOutcome,
  computeRunProgressFraction,
  computeEffectiveStakes,
  isEndgamePhase,
  isWinOutcome,
  isLossOutcome,
  scoreOutcomeExcitement,
  computePressureRiskScore,
  describePressureTierExperience,
} from './GamePrimitives';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Module constants and version metadata
// ─────────────────────────────────────────────────────────────────────────────

export const OUTCOME_RESOLVER_MODULE_VERSION = 'outcome-resolver.v2.2026' as const;
export const OUTCOME_RESOLVER_MODULE_READY = true as const;

/** Total features in the 32-dim ML outcome probability vector. */
export const OUTCOME_ML_FEATURE_COUNT = 32 as const;

/** Total features in the 48-dim DL outcome tensor. */
export const OUTCOME_DL_FEATURE_COUNT = 48 as const;

/** DL tensor shape [batch=1, features=48]. */
export const OUTCOME_DL_TENSOR_SHAPE: readonly [1, 48] = Object.freeze([1, 48] as const);

/** Bankruptcy runway ticks below which a CRITICAL chat signal is emitted. */
export const OUTCOME_BANKRUPTCY_RUNWAY_CRITICAL_TICKS = 5 as const;

/** Bankruptcy runway ticks below which a HIGH urgency signal is emitted. */
export const OUTCOME_BANKRUPTCY_RUNWAY_HIGH_TICKS = 15 as const;

/** Freedom sprint ticks below which a HIGH urgency (positive) signal is emitted. */
export const OUTCOME_FREEDOM_SPRINT_NEAR_TICKS = 10 as const;

/** History tracker max entries per run before it rotates. */
export const OUTCOME_HISTORY_MAX_ENTRIES = 128 as const;

/** Minimum outcome probability delta to flag as a shift event. */
export const OUTCOME_PROBABILITY_SHIFT_THRESHOLD = 0.15 as const;

/** Maximum run tick budget cap used for normalization. */
const OUTCOME_MAX_TICK_BUDGET = 1_000 as const;
const OUTCOME_MAX_CASH = 1_000_000 as const;
const OUTCOME_MAX_NET_WORTH = 2_000_000 as const;
const OUTCOME_MAX_DEBT = 500_000 as const;
const OUTCOME_MAX_ELAPSED_MS = 3_600_000 as const;

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — ML / DL feature label arrays
// ─────────────────────────────────────────────────────────────────────────────

/** 32-feature ML label set for outcome resolution context. */
export const OUTCOME_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Economy (8)
  'economy_cash_normalized',
  'economy_net_worth_normalized',
  'economy_freedom_progress',
  'economy_debt_normalized',
  'economy_income_rate_normalized',
  'economy_expense_rate_normalized',
  'economy_cash_flow_ratio',
  'economy_hater_heat_normalized',
  // Pressure (6)
  'pressure_score_normalized',
  'pressure_tier_normalized',
  'pressure_risk_score',
  'pressure_upward_crossings_normalized',
  'pressure_escalation_threshold_normalized',
  'pressure_deescalation_threshold_normalized',
  // Run context (6)
  'run_progress_fraction',
  'phase_normalized',
  'mode_normalized',
  'mode_difficulty',
  'effective_stakes',
  'is_endgame_phase',
  // Terminal proximity signals (6)
  'bankruptcy_proximity',
  'freedom_proximity',
  'timeout_proximity',
  'is_outcome_terminal',
  'outcome_is_win_path',
  'outcome_excitement_normalized',
  // Timer context (6)
  'elapsed_ms_normalized',
  'remaining_budget_ratio',
  'season_budget_normalized',
  'extension_budget_normalized',
  'hold_charges_normalized',
  'active_windows_normalized',
] as const);

/** 48-feature DL input label set for outcome deep learning. */
export const OUTCOME_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...OUTCOME_ML_FEATURE_LABELS,
  // Extended economy trajectory (4)
  'economy_velocity_cash_per_tick',
  'economy_velocity_net_worth_per_tick',
  'economy_compound_growth_rate',
  'economy_debt_service_pressure',
  // Extended pressure trajectory (4)
  'pressure_survived_high_ticks_normalized',
  'pressure_tier_urgency_numeric',
  'pressure_stakes_multiplier',
  'pressure_min_hold_ticks_normalized',
  // Extended battle/shield context (4)
  'shield_weakest_ratio',
  'shield_breach_count_normalized',
  'battle_budget_normalized',
  'battle_active_bot_count_normalized',
  // Extended sovereignty (4)
  'sovereignty_score_normalized',
  'sovereignty_integrity_risk',
  'sovereignty_gap_vs_legend_normalized',
  'sovereignty_cord_score_normalized',
  // Extended cascade (4)
  'cascade_active_chains_normalized',
  'cascade_broken_ratio',
  'cascade_completed_ratio',
  'cascade_risk_composite',
] as const);

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Existing core types (preserved)
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimeOutcomeResolverOptions {
  readonly bankruptOnNegativeCash?: boolean;
  readonly bankruptOnNegativeNetWorth?: boolean;
  readonly quarantineTerminatesRun?: boolean;
  readonly engineAbortWarningsThreshold?: number;
}

export interface RuntimeOutcomeDecision {
  readonly outcome: RunStateSnapshot['outcome'];
  readonly outcomeReason: string | null;
  readonly outcomeReasonCode: RunStateSnapshot['telemetry']['outcomeReasonCode'];
  readonly totalBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly isTerminal: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Extended analytical types
// ─────────────────────────────────────────────────────────────────────────────

/** Estimated distance to each terminal outcome. */
export interface OutcomeProximity {
  readonly runId: string;
  readonly tick: number;
  /** Normalized 0-1 — higher = closer to bankruptcy (more dangerous). */
  readonly bankruptcyProximity: number;
  /** Normalized 0-1 — higher = closer to freedom (more desirable). */
  readonly freedomProximity: number;
  /** Normalized 0-1 — higher = closer to timeout (less time remaining). */
  readonly timeoutProximity: number;
  /** Most likely terminal outcome given current state. */
  readonly mostLikelyOutcome: RunOutcome | null;
  /** Confidence in the most-likely-outcome prediction (0-1). */
  readonly confidence: number;
  /** Ticks estimated until bankruptcy at current rates (null = not at risk). */
  readonly bankruptcyRunwayTicks: number | null;
  /** Ticks estimated until freedom at current growth rate (null = not approaching). */
  readonly freedomSprintTicks: number | null;
  /** Ticks remaining before timer runs out. */
  readonly timeoutRemainingTicks: number | null;
}

/** Outcome runway assessment focused on economic timing. */
export interface OutcomeRunway {
  readonly runId: string;
  readonly tick: number;
  readonly cashRunwayTicks: number | null;
  readonly freedomRunwayTicks: number | null;
  readonly budgetRunwayMs: number;
  readonly budgetRunwayTicks: number | null;
  readonly cashVelocityPerTick: number;
  readonly netWorthVelocityPerTick: number;
  readonly compoundGrowthRateToFreedom: number;
  readonly debtServicePressure: number;
  readonly estimatedOutcome: RunOutcome | null;
}

/** 32-feature ML vector for outcome prediction inference. */
export interface OutcomeMLVector {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly vectorShape: readonly [1, 32];
  readonly extractedAtMs: number;
  readonly decisionContext: RuntimeOutcomeDecision;
}

/** 48-feature DL tensor for deep outcome prediction. */
export interface OutcomeDLTensor {
  readonly runId: string;
  readonly tick: number;
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly tensorShape: readonly [1, 48];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
  readonly decisionContext: RuntimeOutcomeDecision;
}

/** Probability distribution over all four terminal outcomes. */
export interface OutcomeProbabilityDistribution {
  readonly FREEDOM: number;
  readonly TIMEOUT: number;
  readonly BANKRUPT: number;
  readonly ABANDONED: number;
}

/** Full outcome forecast including confidence intervals. */
export interface OutcomeForecast {
  readonly runId: string;
  readonly tick: number;
  readonly probabilities: OutcomeProbabilityDistribution;
  readonly mostLikely: RunOutcome;
  readonly confidence: number;
  readonly forecastHorizonTicks: number;
  readonly lowerBoundProbabilities: OutcomeProbabilityDistribution;
  readonly upperBoundProbabilities: OutcomeProbabilityDistribution;
  readonly forecastedAt: number;
  readonly warningFlags: readonly string[];
}

/** Companion AI narration hint for a given outcome decision. */
export interface OutcomeNarrationHint {
  readonly runId: string;
  readonly tick: number;
  readonly urgencyLevel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly headline: string;
  readonly bodyText: string;
  readonly actionSuggestion: string;
  readonly tierContextMessage: string;
  readonly isWinPath: boolean;
  readonly excitementScore: number;
  readonly chatKind: 'RUN_SIGNAL' | 'BATTLE_SIGNAL';
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Single history entry for outcome probability tracking. */
export interface OutcomeHistoryEntry {
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly decision: RuntimeOutcomeDecision;
  readonly proximity: OutcomeProximity;
  readonly snapshotChecksum: string;
}

/** Aggregated trajectory of outcome probability over time. */
export interface OutcomeTrajectory {
  readonly runId: string;
  readonly entryCount: number;
  readonly firstTick: number;
  readonly lastTick: number;
  readonly bankruptcyTrend: 'RISING' | 'STABLE' | 'FALLING';
  readonly freedomTrend: 'RISING' | 'STABLE' | 'FALLING';
  readonly shiftEvents: readonly string[];
  readonly peakBankruptcyProximity: number;
  readonly peakFreedomProximity: number;
}

/** Adaptive threshold recommendation based on current game state. */
export interface OutcomeThresholdConfig {
  readonly bankruptOnNegativeCash: boolean;
  readonly bankruptOnNegativeNetWorth: boolean;
  readonly quarantineTerminatesRun: boolean;
  readonly engineAbortWarningsThreshold: number;
  readonly rationale: string;
}

/** Result type for extended resolve-with-context call. */
export interface OutcomeDecisionContext {
  readonly decision: RuntimeOutcomeDecision;
  readonly proximity: OutcomeProximity;
  readonly runway: OutcomeRunway;
  readonly forecast: OutcomeForecast;
  readonly narrationHint: OutcomeNarrationHint;
  readonly mlVector: OutcomeMLVector;
}

/** Health grade for the resolver. */
export type OutcomeResolverHealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Per-session stats for the outcome resolver. */
export interface OutcomeResolverStats {
  readonly totalResolutions: number;
  readonly terminalResolutions: number;
  readonly freedomResolutions: number;
  readonly bankruptResolutions: number;
  readonly timeoutResolutions: number;
  readonly abandonedResolutions: number;
  readonly avgRemainingBudgetRatio: number;
  readonly lastResolvedAtMs: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — OutcomeMLVectorBuilder
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function normField(value: number, cap: number): number {
  return clamp01(cap > 0 ? value / cap : 0);
}

/**
 * Builds 32-feature ML vectors for outcome prediction.
 * All GamePrimitives scoring maps and functions are actively applied
 * to produce a semantically-weighted, fully-normalized feature set.
 */
export class OutcomeMLVectorBuilder {
  public build(snapshot: RunStateSnapshot, decision: RuntimeOutcomeDecision): OutcomeMLVector {
    const features = this.extractFeatures(snapshot, decision);
    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      features: Object.freeze(features),
      featureLabels: OUTCOME_ML_FEATURE_LABELS,
      vectorShape: [1, OUTCOME_ML_FEATURE_COUNT],
      extractedAtMs: Date.now(),
      decisionContext: decision,
    };
  }

  private extractFeatures(snap: RunStateSnapshot, decision: RuntimeOutcomeDecision): number[] {
    // Economy
    const cashNorm = normField(Math.max(0, snap.economy.cash), OUTCOME_MAX_CASH);
    const nwNorm = normField(Math.max(0, snap.economy.netWorth), OUTCOME_MAX_NET_WORTH);
    const freedomProg = clamp01(
      snap.economy.freedomTarget > 0
        ? snap.economy.netWorth / snap.economy.freedomTarget
        : 0,
    );
    const debtNorm = normField(Math.max(0, snap.economy.debt), OUTCOME_MAX_DEBT);
    const incomeNorm = normField(snap.economy.incomePerTick, 5000);
    const expenseNorm = normField(snap.economy.expensesPerTick, 5000);
    const cashFlowRatio = clamp01(
      snap.economy.incomePerTick + snap.economy.expensesPerTick > 0
        ? snap.economy.incomePerTick / (snap.economy.incomePerTick + snap.economy.expensesPerTick + 0.01)
        : 0.5,
    );
    const haterHeatNorm = normField(snap.economy.haterHeat, 100);

    // Pressure
    const pressureScoreNorm = clamp01(snap.pressure.score / 100);
    const tierNorm = PRESSURE_TIER_NORMALIZED[snap.pressure.tier];
    const pressureRisk = computePressureRiskScore(snap.pressure.tier, snap.pressure.score);
    const upwardCrossingsNorm = normField(snap.pressure.upwardCrossings, 20);
    const escalationThreshNorm = normField(
      PRESSURE_TIER_ESCALATION_THRESHOLD[snap.pressure.tier],
      100,
    );
    const deescalationThreshNorm = normField(
      PRESSURE_TIER_DEESCALATION_THRESHOLD[snap.pressure.tier] < 0
        ? 0
        : PRESSURE_TIER_DEESCALATION_THRESHOLD[snap.pressure.tier],
      100,
    );

    // Run context
    const runProgress = computeRunProgressFraction(snap.phase, snap.tick, OUTCOME_MAX_TICK_BUDGET);
    const phaseNorm = RUN_PHASE_NORMALIZED[snap.phase];
    const modeNorm = MODE_NORMALIZED[snap.mode];
    const modeDiff = clamp01(MODE_DIFFICULTY_MULTIPLIER[snap.mode] / 2.0);
    const stakes = clamp01(computeEffectiveStakes(snap.phase, snap.mode) / 2.0);
    const endgame = isEndgamePhase(snap.phase) ? 1.0 : 0.0;

    // Terminal proximity
    const bankruptcyProx = this.computeBankruptcyProximity(snap);
    const freedomProx = clamp01(freedomProg);
    const budgetTotal = decision.totalBudgetMs;
    const timeoutProx = budgetTotal > 0
      ? clamp01(1.0 - decision.remainingBudgetMs / budgetTotal)
      : 0;
    const isTerminal = decision.isTerminal ? 1.0 : 0.0;
    const isWin = snap.outcome !== null && isRunOutcome(snap.outcome) && isWinOutcome(snap.outcome)
      ? 1.0 : 0.0;
    const excitement = snap.outcome !== null && isRunOutcome(snap.outcome)
      ? scoreOutcomeExcitement(snap.outcome, snap.mode) / 5.0
      : 0.0;

    // Timer context
    const elapsedNorm = normField(snap.timers.elapsedMs, OUTCOME_MAX_ELAPSED_MS);
    const remainingRatio = budgetTotal > 0
      ? clamp01(decision.remainingBudgetMs / budgetTotal)
      : 0;
    const seasonNorm = normField(snap.timers.seasonBudgetMs, OUTCOME_MAX_ELAPSED_MS);
    const extensionNorm = normField(snap.timers.extensionBudgetMs, 3_600_000);
    const holdChargesNorm = normField(snap.timers.holdCharges, 10);
    const activeWindowsNorm = normField(
      Object.keys(snap.timers.activeDecisionWindows).length,
      20,
    );

    return [
      // Economy (8)
      cashNorm, nwNorm, freedomProg, debtNorm, incomeNorm, expenseNorm, cashFlowRatio, haterHeatNorm,
      // Pressure (6)
      pressureScoreNorm, tierNorm, pressureRisk, upwardCrossingsNorm, escalationThreshNorm, deescalationThreshNorm,
      // Run context (6)
      runProgress, phaseNorm, modeNorm, modeDiff, stakes, endgame,
      // Terminal proximity (6)
      bankruptcyProx, freedomProx, timeoutProx, isTerminal, isWin, excitement,
      // Timer context (6)
      elapsedNorm, remainingRatio, seasonNorm, extensionNorm, holdChargesNorm, activeWindowsNorm,
    ];
  }

  private computeBankruptcyProximity(snap: RunStateSnapshot): number {
    const cashRisk = snap.economy.cash < 0 ? 1.0 : clamp01(1.0 - snap.economy.cash / OUTCOME_MAX_CASH);
    const nwRisk = snap.economy.netWorth < 0 ? 1.0 : clamp01(1.0 - snap.economy.netWorth / OUTCOME_MAX_NET_WORTH);
    const debtRisk = normField(snap.economy.debt, OUTCOME_MAX_DEBT);
    return clamp01(cashRisk * 0.5 + nwRisk * 0.3 + debtRisk * 0.2);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — OutcomeDLTensorBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds 48-feature DL tensors from snapshot + outcome decision context.
 * Extends the 32-feature ML vector with trajectory-aware features.
 */
export class OutcomeDLTensorBuilder {
  private readonly mlBuilder: OutcomeMLVectorBuilder;
  private readonly policyVersion: string;

  public constructor(
    policyVersion = OUTCOME_RESOLVER_MODULE_VERSION,
    mlBuilder?: OutcomeMLVectorBuilder,
  ) {
    this.policyVersion = policyVersion;
    this.mlBuilder = mlBuilder ?? new OutcomeMLVectorBuilder();
  }

  public build(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    runway?: OutcomeRunway,
  ): OutcomeDLTensor {
    const mlVector = this.mlBuilder.build(snapshot, decision);
    const extended = this.extractExtended(snapshot, decision, runway);
    const fullVector = [...mlVector.features, ...extended];

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      inputVector: Object.freeze(fullVector),
      featureLabels: OUTCOME_DL_FEATURE_LABELS,
      tensorShape: OUTCOME_DL_TENSOR_SHAPE,
      policyVersion: this.policyVersion,
      extractedAtMs: Date.now(),
      decisionContext: decision,
    };
  }

  private extractExtended(
    snap: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    runway?: OutcomeRunway,
  ): number[] {
    // Economy trajectory (4)
    const cashVelNorm = runway
      ? clamp01((runway.cashVelocityPerTick + 10000) / 20000)
      : 0.5;
    const nwVelNorm = runway
      ? clamp01((runway.netWorthVelocityPerTick + 10000) / 20000)
      : 0.5;
    const growthRateNorm = runway
      ? clamp01((runway.compoundGrowthRateToFreedom + 1.0) / 2.0)
      : 0.5;
    const debtServiceNorm = runway ? clamp01(runway.debtServicePressure) : 0;

    // Extended pressure trajectory (4)
    const survivedHighNorm = normField(snap.pressure.survivedHighPressureTicks, 100);
    const tierUrgencyNumeric = PRESSURE_TIER_NORMALIZED[snap.pressure.tier];
    const stakesMultiplier = clamp01(computeEffectiveStakes(snap.phase, snap.mode) / 2.0);
    const minHoldTicksNorm = normField(
      snap.timers.currentTickDurationMs > 0
        ? snap.timers.currentTickDurationMs
        : 0,
      5000,
    );

    // Extended battle/shield (4)
    const weakestLayer = snap.shield.layers.find((l) => l.layerId === snap.shield.weakestLayerId);
    const shieldWeakestRatio = weakestLayer
      ? clamp01(weakestLayer.max > 0 ? weakestLayer.current / weakestLayer.max : 0)
      : 0;
    const shieldBreachNorm = normField(snap.shield.breachesThisRun, 20);
    const battleBudgetNorm = normField(snap.battle.battleBudget, 100_000);
    const activeBotNorm = normField(
      snap.battle.bots.filter((b) => !b.neutralized).length,
      5,
    );

    // Extended sovereignty (4)
    const sovNorm = normField(snap.sovereignty.sovereigntyScore, 1000);
    const integrityRisk = snap.sovereignty.integrityStatus === 'QUARANTINED' ? 1.0
      : snap.sovereignty.integrityStatus === 'UNVERIFIED' ? 0.5
      : 0.25;
    const gapNorm = normField(Math.max(0, snap.sovereignty.gapVsLegend), 1000);
    const cordNorm = normField(snap.sovereignty.cordScore, 100);

    // Extended cascade (4)
    const activeChainsNorm = normField(snap.cascade.activeChains.length, 20);
    const totalChains = snap.cascade.brokenChains + snap.cascade.completedChains;
    const brokenRatio = totalChains > 0 ? clamp01(snap.cascade.brokenChains / totalChains) : 0;
    const completedRatio = totalChains > 0 ? clamp01(snap.cascade.completedChains / totalChains) : 0;
    const cascadeRisk = clamp01(activeChainsNorm * 0.6 + brokenRatio * 0.4);

    // Use decision context for enhanced remaining budget feature
    void decision; // consumed via mlVector features; extended features use runway

    return [
      // Economy trajectory (4)
      cashVelNorm, nwVelNorm, growthRateNorm, debtServiceNorm,
      // Extended pressure trajectory (4)
      survivedHighNorm, tierUrgencyNumeric, stakesMultiplier, minHoldTicksNorm,
      // Extended battle/shield (4)
      shieldWeakestRatio, shieldBreachNorm, battleBudgetNorm, activeBotNorm,
      // Extended sovereignty (4)
      sovNorm, integrityRisk, gapNorm, cordNorm,
      // Extended cascade (4)
      activeChainsNorm, brokenRatio, completedRatio, cascadeRisk,
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — OutcomeProximityAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes how close the current snapshot is to each terminal outcome.
 * Proximity scores drive urgency escalation in the chat system and the
 * companion narration hints.
 */
export class OutcomeProximityAnalyzer {
  public computeProximity(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): OutcomeProximity {
    const bankruptcyProx = this.computeBankruptcyProximity(snapshot);
    const freedomProx = this.computeFreedomProximity(snapshot);
    const timeoutProx = this.computeTimeoutProximity(decision);

    const bankruptcyRunway = this.computeBankruptcyRunwayTicks(snapshot);
    const freedomSprint = this.computeFreedomSprintTicks(snapshot);

    const budgetTotal = decision.totalBudgetMs;
    const msPerTick = Math.max(1, snapshot.timers.currentTickDurationMs);
    const timeoutRemainingTicks = Math.ceil(decision.remainingBudgetMs / msPerTick);

    const mostLikely = this.estimateMostLikelyOutcome(
      bankruptcyProx, freedomProx, timeoutProx, snapshot,
    );
    const confidence = this.computeConfidence(snapshot, decision);

    // Use budgetTotal for validation
    void budgetTotal;

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      bankruptcyProximity: Number(bankruptcyProx.toFixed(4)),
      freedomProximity: Number(freedomProx.toFixed(4)),
      timeoutProximity: Number(timeoutProx.toFixed(4)),
      mostLikelyOutcome: mostLikely,
      confidence: Number(confidence.toFixed(4)),
      bankruptcyRunwayTicks: bankruptcyRunway,
      freedomSprintTicks: freedomSprint,
      timeoutRemainingTicks: timeoutRemainingTicks > 0 ? timeoutRemainingTicks : null,
    };
  }

  /** Estimate ticks until bankruptcy at current cash burn rate. */
  public computeBankruptcyRunwayTicks(snapshot: RunStateSnapshot): number | null {
    const burnRate = snapshot.economy.expensesPerTick - snapshot.economy.incomePerTick;
    if (burnRate <= 0) return null; // not losing money
    if (snapshot.economy.cash <= 0) return 0;
    const ticks = snapshot.economy.cash / burnRate;
    return Math.ceil(ticks);
  }

  /** Estimate ticks until freedom target at current net worth growth rate. */
  public computeFreedomSprintTicks(snapshot: RunStateSnapshot): number | null {
    const growthPerTick = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
    if (growthPerTick <= 0) return null; // not growing
    const gap = snapshot.economy.freedomTarget - snapshot.economy.netWorth;
    if (gap <= 0) return 0; // already there
    return Math.ceil(gap / growthPerTick);
  }

  private computeBankruptcyProximity(snap: RunStateSnapshot): number {
    const cashFraction = snap.economy.cash / Math.max(1, OUTCOME_MAX_CASH);
    const nwFraction = snap.economy.netWorth / Math.max(1, OUTCOME_MAX_NET_WORTH);
    const cashRisk = cashFraction <= 0 ? 1.0 : clamp01(1.0 - cashFraction);
    const nwRisk = nwFraction <= 0 ? 1.0 : clamp01(1.0 - nwFraction);
    const burnRateRisk = this.computeBurnRateRisk(snap);
    return clamp01(cashRisk * 0.4 + nwRisk * 0.35 + burnRateRisk * 0.25);
  }

  private computeFreedomProximity(snap: RunStateSnapshot): number {
    if (snap.economy.freedomTarget <= 0) return 0;
    return clamp01(snap.economy.netWorth / snap.economy.freedomTarget);
  }

  private computeTimeoutProximity(decision: RuntimeOutcomeDecision): number {
    if (decision.totalBudgetMs <= 0) return 0;
    return clamp01(1.0 - decision.remainingBudgetMs / decision.totalBudgetMs);
  }

  private computeBurnRateRisk(snap: RunStateSnapshot): number {
    const burnRate = snap.economy.expensesPerTick - snap.economy.incomePerTick;
    if (burnRate <= 0) return 0;
    const runwayTicks = snap.economy.cash > 0 ? snap.economy.cash / burnRate : 0;
    return clamp01(1.0 - runwayTicks / 50);
  }

  private estimateMostLikelyOutcome(
    bankruptcyProx: number,
    freedomProx: number,
    timeoutProx: number,
    snap: RunStateSnapshot,
  ): RunOutcome | null {
    if (snap.outcome !== null) return snap.outcome;

    // Strong freedom signal
    if (freedomProx >= 0.90) return 'FREEDOM';
    // Strong bankruptcy signal
    if (bankruptcyProx >= 0.85) return 'BANKRUPT';
    // Timeout approaching fast
    if (timeoutProx >= 0.90) return 'TIMEOUT';

    // Weighted vote
    const scores: Record<RunOutcome, number> = {
      FREEDOM: freedomProx * 1.5,
      BANKRUPT: bankruptcyProx * 1.2,
      TIMEOUT: timeoutProx * 0.8,
      ABANDONED: 0.1,
    };

    let best: RunOutcome = 'TIMEOUT';
    let bestScore = 0;
    for (const [outcome, score] of Object.entries(scores) as [RunOutcome, number][]) {
      if (score > bestScore) {
        bestScore = score;
        best = outcome;
      }
    }

    return bestScore > 0.3 ? best : null;
  }

  private computeConfidence(snap: RunStateSnapshot, decision: RuntimeOutcomeDecision): number {
    if (decision.isTerminal) return 1.0;
    const timeoutConf = clamp01(1.0 - decision.remainingBudgetMs / Math.max(1, decision.totalBudgetMs));
    const econConf = snap.economy.cash <= 0 || snap.economy.netWorth <= 0 ? 0.9 : 0.3;
    const freedomConf = snap.economy.freedomTarget > 0
      ? clamp01(snap.economy.netWorth / snap.economy.freedomTarget)
      : 0;
    return clamp01(Math.max(timeoutConf, econConf, freedomConf));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — OutcomeEconomyTrajectoryAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/** A lightweight snapshot used for trajectory analysis without full state. */
export interface OutcomeEconomyDataPoint {
  readonly tick: number;
  readonly cash: number;
  readonly netWorth: number;
  readonly incomePerTick: number;
  readonly expensesPerTick: number;
}

/**
 * Analyzes economy trajectory across a sequence of snapshots.
 * Computes cash velocity, net worth acceleration, and compound growth
 * rate toward the freedom target.
 */
export class OutcomeEconomyTrajectoryAnalyzer {
  public analyze(
    dataPoints: readonly OutcomeEconomyDataPoint[],
    freedomTarget: number,
  ): OutcomeRunway {
    const sorted = [...dataPoints].sort((a, b) => a.tick - b.tick);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (!first || !last) {
      return this.emptyRunway('');
    }

    const cashVelocity = this.computeVelocity(sorted, 'cash');
    const nwVelocity = this.computeVelocity(sorted, 'netWorth');
    const compoundGrowthRate = this.computeCompoundGrowthRate(first.netWorth, last.netWorth, last.tick - first.tick);
    const debtServicePressure = this.computeDebtServicePressure(last);

    const cashRunway = this.computeCashRunway(last, cashVelocity);
    const freedomRunway = this.computeFreedomRunway(last, nwVelocity, freedomTarget);

    return {
      runId: '',
      tick: last.tick,
      cashRunwayTicks: cashRunway,
      freedomRunwayTicks: freedomRunway,
      budgetRunwayMs: 0,
      budgetRunwayTicks: null,
      cashVelocityPerTick: cashVelocity,
      netWorthVelocityPerTick: nwVelocity,
      compoundGrowthRateToFreedom: compoundGrowthRate,
      debtServicePressure,
      estimatedOutcome: this.estimateOutcomeFromRunway(cashRunway, freedomRunway, debtServicePressure),
    };
  }

  public buildFromSnapshot(snapshot: RunStateSnapshot, decision: RuntimeOutcomeDecision): OutcomeRunway {
    const cashVelocity = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
    const burnRate = snapshot.economy.expensesPerTick - snapshot.economy.incomePerTick;
    const cashRunway = burnRate > 0 && snapshot.economy.cash > 0
      ? Math.ceil(snapshot.economy.cash / burnRate)
      : null;
    const freedomGap = snapshot.economy.freedomTarget - snapshot.economy.netWorth;
    const freedomRunway = cashVelocity > 0 && freedomGap > 0
      ? Math.ceil(freedomGap / cashVelocity)
      : null;
    const msPerTick = Math.max(1, snapshot.timers.currentTickDurationMs);
    const budgetRunwayMs = decision.remainingBudgetMs;
    const budgetRunwayTicks = Math.ceil(budgetRunwayMs / msPerTick);
    const debtService = this.computeDebtServicePressureFromSnapshot(snapshot);
    const compoundGrowth = cashVelocity / Math.max(1, snapshot.economy.netWorth);

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      cashRunwayTicks: cashRunway,
      freedomRunwayTicks: freedomRunway,
      budgetRunwayMs,
      budgetRunwayTicks,
      cashVelocityPerTick: cashVelocity,
      netWorthVelocityPerTick: cashVelocity,
      compoundGrowthRateToFreedom: compoundGrowth,
      debtServicePressure: debtService,
      estimatedOutcome: this.estimateOutcomeFromRunway(cashRunway, freedomRunway, debtService),
    };
  }

  private computeVelocity(
    points: readonly OutcomeEconomyDataPoint[],
    field: 'cash' | 'netWorth',
  ): number {
    if (points.length < 2) return 0;
    const first = points[0];
    const last = points[points.length - 1];
    const tickDelta = last.tick - first.tick;
    if (tickDelta === 0) return 0;
    const valueDelta = field === 'cash'
      ? last.cash - first.cash
      : last.netWorth - first.netWorth;
    return valueDelta / tickDelta;
  }

  private computeCompoundGrowthRate(
    initialValue: number,
    finalValue: number,
    ticks: number,
  ): number {
    if (ticks <= 0 || initialValue <= 0) return 0;
    return Math.pow(Math.max(0.001, finalValue / initialValue), 1 / ticks) - 1;
  }

  private computeDebtServicePressure(point: OutcomeEconomyDataPoint): number {
    const burnRate = point.expensesPerTick - point.incomePerTick;
    if (burnRate <= 0) return 0;
    const cashBuffer = Math.max(0, point.cash);
    return clamp01(cashBuffer > 0 ? burnRate / (cashBuffer + burnRate) : 1.0);
  }

  private computeDebtServicePressureFromSnapshot(snap: RunStateSnapshot): number {
    const burnRate = snap.economy.expensesPerTick - snap.economy.incomePerTick;
    if (burnRate <= 0) return 0;
    return clamp01(burnRate / (Math.max(0, snap.economy.cash) + burnRate + 1));
  }

  private computeCashRunway(
    point: OutcomeEconomyDataPoint,
    velocity: number,
  ): number | null {
    if (velocity >= 0) return null;
    return point.cash > 0 ? Math.ceil(point.cash / -velocity) : 0;
  }

  private computeFreedomRunway(
    point: OutcomeEconomyDataPoint,
    velocity: number,
    freedomTarget: number,
  ): number | null {
    if (velocity <= 0) return null;
    const gap = freedomTarget - point.netWorth;
    if (gap <= 0) return 0;
    return Math.ceil(gap / velocity);
  }

  private estimateOutcomeFromRunway(
    cashRunway: number | null,
    freedomRunway: number | null,
    debtService: number,
  ): RunOutcome | null {
    if (cashRunway !== null && cashRunway <= 3) return 'BANKRUPT';
    if (freedomRunway !== null && freedomRunway <= 5) return 'FREEDOM';
    if (debtService >= 0.9) return 'BANKRUPT';
    return null;
  }

  private emptyRunway(runId: string): OutcomeRunway {
    return {
      runId,
      tick: 0,
      cashRunwayTicks: null,
      freedomRunwayTicks: null,
      budgetRunwayMs: 0,
      budgetRunwayTicks: null,
      cashVelocityPerTick: 0,
      netWorthVelocityPerTick: 0,
      compoundGrowthRateToFreedom: 0,
      debtServicePressure: 0,
      estimatedOutcome: null,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — OutcomeForecastEngine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates probabilistic outcome forecasts with confidence intervals.
 * The forecasting model applies ML proximity scores weighted by mode difficulty
 * and stakes multipliers to compute Bayesian-inspired probability distributions.
 */
export class OutcomeForecastEngine {
  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;

  public constructor() {
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
  }

  public forecast(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    horizonTicks = 20,
  ): OutcomeForecast {
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, decision);
    const modeDiff = MODE_DIFFICULTY_MULTIPLIER[snapshot.mode];
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[snapshot.phase];
    const warningFlags: string[] = [];

    if (proximity.bankruptcyRunwayTicks !== null && proximity.bankruptcyRunwayTicks <= OUTCOME_BANKRUPTCY_RUNWAY_CRITICAL_TICKS) {
      warningFlags.push(`bankruptcy_runway_critical:${proximity.bankruptcyRunwayTicks}ticks`);
    }
    if (proximity.freedomSprintTicks !== null && proximity.freedomSprintTicks <= OUTCOME_FREEDOM_SPRINT_NEAR_TICKS) {
      warningFlags.push(`freedom_sprint_near:${proximity.freedomSprintTicks}ticks`);
    }
    if (snapshot.pressure.tier === 'T4') {
      warningFlags.push('apex_pressure_active');
    }

    const probs = this.computeProbabilities(proximity, snapshot, modeDiff, stakes);
    const lower = this.computeLowerBound(probs, proximity);
    const upper = this.computeUpperBound(probs, proximity);
    const mostLikely = this.pickMostLikely(probs);
    const confidence = this.computeConfidence(proximity, decision, warningFlags.length);

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      probabilities: probs,
      mostLikely,
      confidence,
      forecastHorizonTicks: horizonTicks,
      lowerBoundProbabilities: lower,
      upperBoundProbabilities: upper,
      forecastedAt: Date.now(),
      warningFlags: Object.freeze(warningFlags),
    };
  }

  private computeProbabilities(
    proximity: OutcomeProximity,
    snap: RunStateSnapshot,
    modeDiff: number,
    stakes: number,
  ): OutcomeProbabilityDistribution {
    // Raw scores
    let bankrupt = proximity.bankruptcyProximity * modeDiff * stakes;
    let freedom = proximity.freedomProximity * (1.0 / modeDiff) * stakes;
    let timeout = proximity.timeoutProximity * stakes;
    let abandoned = 0.05; // small baseline

    // If already terminal, collapse to certainty
    if (snap.outcome !== null && isRunOutcome(snap.outcome)) {
      return this.certaintyDistribution(snap.outcome);
    }

    // Pressure amplification on bankruptcy
    if (snap.pressure.tier === 'T4') {
      bankrupt *= 1.3;
    }

    // Endgame phase amplification on both freedom and bankrupt
    if (isEndgamePhase(snap.phase)) {
      bankrupt *= 1.1;
      freedom *= 1.2;
    }

    // Normalize to sum to 1.0
    const total = bankrupt + freedom + timeout + abandoned;
    if (total > 0) {
      bankrupt /= total;
      freedom /= total;
      timeout /= total;
      abandoned /= total;
    }

    return {
      FREEDOM: clamp01(freedom),
      TIMEOUT: clamp01(timeout),
      BANKRUPT: clamp01(bankrupt),
      ABANDONED: clamp01(abandoned),
    };
  }

  private computeLowerBound(
    probs: OutcomeProbabilityDistribution,
    proximity: OutcomeProximity,
  ): OutcomeProbabilityDistribution {
    const confidence = proximity.confidence;
    const margin = (1.0 - confidence) * 0.15;
    return {
      FREEDOM: clamp01(probs.FREEDOM - margin),
      TIMEOUT: clamp01(probs.TIMEOUT - margin),
      BANKRUPT: clamp01(probs.BANKRUPT - margin),
      ABANDONED: clamp01(probs.ABANDONED - margin * 0.5),
    };
  }

  private computeUpperBound(
    probs: OutcomeProbabilityDistribution,
    proximity: OutcomeProximity,
  ): OutcomeProbabilityDistribution {
    const confidence = proximity.confidence;
    const margin = (1.0 - confidence) * 0.15;
    return {
      FREEDOM: clamp01(probs.FREEDOM + margin),
      TIMEOUT: clamp01(probs.TIMEOUT + margin),
      BANKRUPT: clamp01(probs.BANKRUPT + margin),
      ABANDONED: clamp01(probs.ABANDONED + margin * 0.5),
    };
  }

  private pickMostLikely(probs: OutcomeProbabilityDistribution): RunOutcome {
    const entries: [RunOutcome, number][] = [
      ['FREEDOM', probs.FREEDOM],
      ['TIMEOUT', probs.TIMEOUT],
      ['BANKRUPT', probs.BANKRUPT],
      ['ABANDONED', probs.ABANDONED],
    ];
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  private computeConfidence(
    proximity: OutcomeProximity,
    decision: RuntimeOutcomeDecision,
    warningCount: number,
  ): number {
    if (decision.isTerminal) return 1.0;
    const base = proximity.confidence;
    const warningPenalty = Math.min(0.3, warningCount * 0.1);
    return clamp01(base - warningPenalty + 0.1);
  }

  private certaintyDistribution(outcome: RunOutcome): OutcomeProbabilityDistribution {
    return {
      FREEDOM: outcome === 'FREEDOM' ? 1.0 : 0.0,
      TIMEOUT: outcome === 'TIMEOUT' ? 1.0 : 0.0,
      BANKRUPT: outcome === 'BANKRUPT' ? 1.0 : 0.0,
      ABANDONED: outcome === 'ABANDONED' ? 1.0 : 0.0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — OutcomeNarrationHintBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds companion AI narration hints from an outcome decision + proximity.
 * Uses PRESSURE_TIER_URGENCY_LABEL and describePressureTierExperience to
 * ground the companion message in authentic pressure-tier language.
 * Uses scoreOutcomeExcitement to calibrate drama intensity.
 * Uses isWinOutcome/isLossOutcome for routing win vs. loss framing.
 */
export class OutcomeNarrationHintBuilder {
  public build(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    proximity: OutcomeProximity,
  ): OutcomeNarrationHint {
    const tier = snapshot.pressure.tier;
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[tier];
    const tierExperience = describePressureTierExperience(tier);

    const validMode = isModeCode(snapshot.mode) ? snapshot.mode : 'solo';
    const validPhase = isRunPhase(snapshot.phase) ? snapshot.phase : 'FOUNDATION';
    const validTier = isPressureTier(tier) ? tier : 'T0';

    const excitement = snapshot.outcome !== null && isRunOutcome(snapshot.outcome)
      ? scoreOutcomeExcitement(snapshot.outcome, validMode) / 5.0
      : 0.0;

    const isWin = snapshot.outcome !== null && isRunOutcome(snapshot.outcome)
      ? isWinOutcome(snapshot.outcome)
      : false;

    const isLoss = snapshot.outcome !== null && isRunOutcome(snapshot.outcome)
      ? isLossOutcome(snapshot.outcome)
      : false;

    const urgency = this.computeUrgency(proximity, decision, snapshot);
    const chatKind: OutcomeNarrationHint['chatKind'] =
      urgency === 'CRITICAL' || urgency === 'HIGH' ? 'BATTLE_SIGNAL' : 'RUN_SIGNAL';

    const headline = this.buildHeadline(decision, proximity, snapshot, isWin, isLoss, tierLabel);
    const bodyText = this.buildBodyText(decision, proximity, snapshot, tierExperience, validPhase, validTier);
    const actionSuggestion = this.buildActionSuggestion(proximity, snapshot, decision);

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      urgencyLevel: urgency,
      headline,
      bodyText,
      actionSuggestion,
      tierContextMessage: tierExperience,
      isWinPath: isWin,
      excitementScore: excitement,
      chatKind,
      metadata: Object.freeze({
        phase: validPhase,
        tier: validTier,
        mode: validMode,
        bankruptcyProximity: proximity.bankruptcyProximity,
        freedomProximity: proximity.freedomProximity,
        timeoutProximity: proximity.timeoutProximity,
        mostLikelyOutcome: proximity.mostLikelyOutcome,
        isTerminal: decision.isTerminal,
      }),
    };
  }

  private computeUrgency(
    proximity: OutcomeProximity,
    decision: RuntimeOutcomeDecision,
    snap: RunStateSnapshot,
  ): OutcomeNarrationHint['urgencyLevel'] {
    if (decision.isTerminal) return 'CRITICAL';

    const bankruptcyRunway = proximity.bankruptcyRunwayTicks;
    if (bankruptcyRunway !== null && bankruptcyRunway <= OUTCOME_BANKRUPTCY_RUNWAY_CRITICAL_TICKS) {
      return 'CRITICAL';
    }
    if (bankruptcyRunway !== null && bankruptcyRunway <= OUTCOME_BANKRUPTCY_RUNWAY_HIGH_TICKS) {
      return 'HIGH';
    }

    const freedomSprint = proximity.freedomSprintTicks;
    if (freedomSprint !== null && freedomSprint <= OUTCOME_FREEDOM_SPRINT_NEAR_TICKS) {
      return 'HIGH';
    }

    if (proximity.bankruptcyProximity >= 0.75) return 'HIGH';
    if (proximity.timeoutProximity >= 0.90) return 'HIGH';
    if (snap.pressure.tier === 'T4') return 'MODERATE';
    if (snap.pressure.tier === 'T3') return 'MODERATE';
    if (proximity.bankruptcyProximity >= 0.5) return 'MODERATE';
    if (proximity.freedomProximity >= 0.8) return 'LOW';

    return 'NONE';
  }

  private buildHeadline(
    decision: RuntimeOutcomeDecision,
    proximity: OutcomeProximity,
    snap: RunStateSnapshot,
    isWin: boolean,
    isLoss: boolean,
    tierLabel: string,
  ): string {
    if (decision.isTerminal) {
      if (isWin) return `RUN COMPLETE: FREEDOM achieved at tick ${snap.tick}.`;
      if (isLoss) return `RUN ENDED: ${snap.outcome ?? decision.outcomeReason ?? 'terminal'} at tick ${snap.tick}.`;
      return `Run resolved: ${decision.outcomeReason ?? 'unknown'} — tick ${snap.tick}.`;
    }

    if (proximity.bankruptcyRunwayTicks !== null && proximity.bankruptcyRunwayTicks <= 5) {
      return `BANKRUPTCY IN ${proximity.bankruptcyRunwayTicks} TICKS — take action now.`;
    }
    if (proximity.freedomSprintTicks !== null && proximity.freedomSprintTicks <= 5) {
      return `FREEDOM IN REACH — ${proximity.freedomSprintTicks} ticks at current growth.`;
    }

    return `${tierLabel} pressure at tick ${snap.tick}. Run is ${
      (proximity.freedomProximity * 100).toFixed(0)
    }% toward freedom.`;
  }

  private buildBodyText(
    decision: RuntimeOutcomeDecision,
    proximity: OutcomeProximity,
    snap: RunStateSnapshot,
    tierExperience: string,
    phase: RunPhase,
    tier: PressureTier,
  ): string {
    const economyStatus = `Cash: ${snap.economy.cash.toFixed(0)}, ` +
      `Net Worth: ${snap.economy.netWorth.toFixed(0)}, ` +
      `Income: +${snap.economy.incomePerTick.toFixed(0)}/tick, ` +
      `Expenses: -${snap.economy.expensesPerTick.toFixed(0)}/tick.`;

    const pressureStatus = `Phase: ${phase}. Tier: ${tier}. ${tierExperience}`;
    const remainingMs = decision.remainingBudgetMs;
    const timeStatus = `${(remainingMs / 1000).toFixed(0)}s remaining.`;

    const outcomeStatus = proximity.mostLikelyOutcome !== null
      ? `Most likely outcome: ${proximity.mostLikelyOutcome} (${(proximity.confidence * 100).toFixed(0)}% confidence).`
      : 'Outcome undetermined.';

    return `${economyStatus} ${pressureStatus} ${timeStatus} ${outcomeStatus}`;
  }

  private buildActionSuggestion(
    proximity: OutcomeProximity,
    snap: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): string {
    if (decision.isTerminal) return 'Run is complete — review your run summary.';

    if (proximity.bankruptcyRunwayTicks !== null && proximity.bankruptcyRunwayTicks <= 5) {
      return 'Play income cards immediately. Counter any pending extractions. Reduce expenses.';
    }

    if (proximity.freedomSprintTicks !== null && proximity.freedomSprintTicks <= 10) {
      return 'Defend your income base. Avoid risk cards. Hold until freedom target is reached.';
    }

    if (snap.pressure.tier === 'T4') {
      return 'Apex pressure — play CTR or FATE timing windows. Every tick is critical.';
    }

    if (snap.shield.weakestLayerRatio <= 0.20) {
      return `${snap.shield.weakestLayerId} shield is critical. Play RESCUE or DEFENSE cards.`;
    }

    if (snap.battle.pendingAttacks.length >= 3) {
      return 'Multiple attacks incoming — prioritize COUNTER cards this tick.';
    }

    return 'Stay focused. Optimize your play sequence for maximum income efficiency.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — OutcomeHistoryTracker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks outcome proximity over time to detect probability shifts.
 * A shift event fires when any outcome probability changes by more
 * than OUTCOME_PROBABILITY_SHIFT_THRESHOLD in a single step.
 */
export class OutcomeHistoryTracker {
  private readonly entries = new Map<string, OutcomeHistoryEntry[]>();
  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;

  public constructor() {
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
  }

  public record(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): void {
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, decision);
    const entry: OutcomeHistoryEntry = {
      tick: snapshot.tick,
      capturedAtMs: Date.now(),
      decision,
      proximity,
      snapshotChecksum: checksumSnapshot(snapshot),
    };

    const runEntries = this.entries.get(snapshot.runId) ?? [];
    runEntries.push(entry);

    if (runEntries.length > OUTCOME_HISTORY_MAX_ENTRIES) {
      runEntries.shift();
    }

    this.entries.set(snapshot.runId, runEntries);
  }

  public getTrajectory(runId: string): OutcomeTrajectory | null {
    const runEntries = this.entries.get(runId);
    if (!runEntries || runEntries.length === 0) return null;

    const first = runEntries[0];
    const last = runEntries[runEntries.length - 1];

    const bankruptcyTrend = this.computeProxTrend(runEntries, 'bankruptcyProximity');
    const freedomTrend = this.computeProxTrend(runEntries, 'freedomProximity');
    const shiftEvents = this.detectShiftEvents(runEntries);

    const peakBankruptcy = Math.max(...runEntries.map((e) => e.proximity.bankruptcyProximity));
    const peakFreedom = Math.max(...runEntries.map((e) => e.proximity.freedomProximity));

    return {
      runId,
      entryCount: runEntries.length,
      firstTick: first.tick,
      lastTick: last.tick,
      bankruptcyTrend,
      freedomTrend,
      shiftEvents: Object.freeze(shiftEvents),
      peakBankruptcyProximity: peakBankruptcy,
      peakFreedomProximity: peakFreedom,
    };
  }

  public clearRun(runId: string): void {
    this.entries.delete(runId);
  }

  private computeProxTrend(
    entries: OutcomeHistoryEntry[],
    field: keyof OutcomeProximity,
  ): 'RISING' | 'STABLE' | 'FALLING' {
    if (entries.length < 3) return 'STABLE';
    const values = entries.map((e) => e.proximity[field] as number);
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const delta = avgSecond - avgFirst;
    if (delta > 0.08) return 'RISING';
    if (delta < -0.08) return 'FALLING';
    return 'STABLE';
  }

  private detectShiftEvents(entries: OutcomeHistoryEntry[]): string[] {
    const shifts: string[] = [];
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1].proximity;
      const curr = entries[i].proximity;
      const bankruptDelta = Math.abs(curr.bankruptcyProximity - prev.bankruptcyProximity);
      const freedomDelta = Math.abs(curr.freedomProximity - prev.freedomProximity);
      if (bankruptDelta >= OUTCOME_PROBABILITY_SHIFT_THRESHOLD) {
        shifts.push(
          `bankruptcy_shift:tick=${entries[i].tick}:delta=${bankruptDelta.toFixed(3)}`,
        );
      }
      if (freedomDelta >= OUTCOME_PROBABILITY_SHIFT_THRESHOLD) {
        shifts.push(
          `freedom_shift:tick=${entries[i].tick}:delta=${freedomDelta.toFixed(3)}`,
        );
      }
    }
    return shifts;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — OutcomeThresholdAdvisor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Advises adaptive thresholds for the OutcomeResolver based on current snapshot.
 * Ghost mode and endgame phase warrant stricter thresholds.
 * Coop mode can tolerate looser bankruptcy thresholds since shared treasury helps.
 */
export class OutcomeThresholdAdvisor {
  public advise(snapshot: RunStateSnapshot): OutcomeThresholdConfig {
    const mode = isModeCode(snapshot.mode) ? snapshot.mode : 'solo';
    const phase = isRunPhase(snapshot.phase) ? snapshot.phase : 'FOUNDATION';
    const endgame = isEndgamePhase(phase);

    const warningThreshold = this.computeWarningsThreshold(snapshot, mode);
    const quarantineTerminates = snapshot.sovereignty.integrityStatus === 'QUARANTINED';

    let bankruptCash = true;
    let bankruptNW = false;
    let rationale = '';

    switch (mode) {
      case 'ghost': {
        bankruptCash = true;
        bankruptNW = endgame;
        rationale = 'Ghost mode: strict cash threshold; net-worth bankruptcy only at SOVEREIGNTY.';
        break;
      }
      case 'pvp': {
        bankruptCash = true;
        bankruptNW = true;
        rationale = 'PvP mode: both cash and net-worth trigger bankruptcy due to rivalry pressure.';
        break;
      }
      case 'coop': {
        bankruptCash = snapshot.modeState.sharedTreasury
          ? snapshot.modeState.sharedTreasuryBalance <= 0
          : true;
        bankruptNW = false;
        rationale = 'Coop mode: shared treasury affects bankruptcy sensitivity.';
        break;
      }
      default: {
        bankruptCash = true;
        bankruptNW = false;
        rationale = 'Solo mode: standard cash bankruptcy threshold active.';
      }
    }

    return {
      bankruptOnNegativeCash: bankruptCash,
      bankruptOnNegativeNetWorth: bankruptNW,
      quarantineTerminatesRun: quarantineTerminates,
      engineAbortWarningsThreshold: warningThreshold,
      rationale,
    };
  }

  /** Build a resolver options object from an adaptive threshold config. */
  public toResolverOptions(config: OutcomeThresholdConfig): RuntimeOutcomeResolverOptions {
    return {
      bankruptOnNegativeCash: config.bankruptOnNegativeCash,
      bankruptOnNegativeNetWorth: config.bankruptOnNegativeNetWorth,
      quarantineTerminatesRun: config.quarantineTerminatesRun,
      engineAbortWarningsThreshold: config.engineAbortWarningsThreshold,
    };
  }

  private computeWarningsThreshold(snap: RunStateSnapshot, mode: ModeCode): number {
    const base = 25;
    const modePenalty = mode === 'ghost' || mode === 'pvp' ? -5 : 0;
    const tierBonus = snap.pressure.tier === 'T4' ? -5 : 0;
    return Math.max(10, base + modePenalty + tierBonus);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — OutcomeBatchResolver
// ─────────────────────────────────────────────────────────────────────────────

/** Result of a batch resolution. */
export interface OutcomeBatchResult {
  readonly runId: string;
  readonly tick: number;
  readonly decision: RuntimeOutcomeDecision;
  readonly proximity: OutcomeProximity;
  readonly elapsedMicros: number;
}

/**
 * Resolves outcomes for multiple snapshots in a single pass.
 * Uses a shared resolver instance to avoid repeated option initialization.
 */
export class OutcomeBatchResolver {
  private readonly resolver: RuntimeOutcomeResolver;
  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;

  public constructor(options: RuntimeOutcomeResolverOptions = {}) {
    this.resolver = new RuntimeOutcomeResolver(options);
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
  }

  public resolveBatch(snapshots: readonly RunStateSnapshot[]): readonly OutcomeBatchResult[] {
    return snapshots.map((snap) => {
      const start = Date.now();
      const decision = this.resolver.resolve(snap);
      const proximity = this.proximityAnalyzer.computeProximity(snap, decision);
      const elapsedMicros = (Date.now() - start) * 1000;
      return {
        runId: snap.runId,
        tick: snap.tick,
        decision,
        proximity,
        elapsedMicros,
      };
    });
  }

  /** Find the most at-risk snapshot from a batch. */
  public mostAtRisk(results: readonly OutcomeBatchResult[]): OutcomeBatchResult | null {
    if (results.length === 0) return null;
    return results.reduce((most, current) =>
      current.proximity.bankruptcyProximity > most.proximity.bankruptcyProximity
        ? current
        : most,
    );
  }

  /** Find all snapshots within a batch that are closer to FREEDOM than to BANKRUPT. */
  public filterWinPath(results: readonly OutcomeBatchResult[]): readonly OutcomeBatchResult[] {
    return results.filter(
      (r) => r.proximity.freedomProximity > r.proximity.bankruptcyProximity,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — OutcomeResolverHealthMonitor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks runtime health and session statistics for the OutcomeResolver.
 */
export class OutcomeResolverHealthMonitor {
  private totalResolutions = 0;
  private terminalCount = 0;
  private freedomCount = 0;
  private bankruptCount = 0;
  private timeoutCount = 0;
  private abandonedCount = 0;
  private remainingBudgetRatioSum = 0;
  private lastResolvedAtMs: number | null = null;

  public record(decision: RuntimeOutcomeDecision): void {
    this.totalResolutions += 1;
    this.lastResolvedAtMs = Date.now();

    if (decision.isTerminal) {
      this.terminalCount += 1;
      switch (decision.outcome) {
        case 'FREEDOM':   this.freedomCount += 1;   break;
        case 'BANKRUPT':  this.bankruptCount += 1;  break;
        case 'TIMEOUT':   this.timeoutCount += 1;   break;
        case 'ABANDONED': this.abandonedCount += 1; break;
        default: break;
      }
    }

    if (decision.totalBudgetMs > 0) {
      this.remainingBudgetRatioSum +=
        decision.remainingBudgetMs / decision.totalBudgetMs;
    }
  }

  public stats(): OutcomeResolverStats {
    const avg = this.totalResolutions > 0
      ? this.remainingBudgetRatioSum / this.totalResolutions
      : 0;

    return {
      totalResolutions: this.totalResolutions,
      terminalResolutions: this.terminalCount,
      freedomResolutions: this.freedomCount,
      bankruptResolutions: this.bankruptCount,
      timeoutResolutions: this.timeoutCount,
      abandonedResolutions: this.abandonedCount,
      avgRemainingBudgetRatio: Number(avg.toFixed(4)),
      lastResolvedAtMs: this.lastResolvedAtMs,
    };
  }

  public grade(stats: OutcomeResolverStats): OutcomeResolverHealthGrade {
    if (stats.totalResolutions === 0) return 'D';
    const winRate = stats.totalResolutions > 0
      ? stats.freedomResolutions / stats.totalResolutions
      : 0;
    if (winRate >= 0.4) return 'A';
    if (winRate >= 0.25) return 'B';
    if (winRate >= 0.10) return 'C';
    if (stats.bankruptResolutions > stats.freedomResolutions) return 'D';
    return 'F';
  }

  public reset(): void {
    this.totalResolutions = 0;
    this.terminalCount = 0;
    this.freedomCount = 0;
    this.bankruptCount = 0;
    this.timeoutCount = 0;
    this.abandonedCount = 0;
    this.remainingBudgetRatioSum = 0;
    this.lastResolvedAtMs = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — RuntimeOutcomeResolver (enhanced)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<RuntimeOutcomeResolverOptions> = {
  bankruptOnNegativeCash: true,
  bankruptOnNegativeNetWorth: false,
  quarantineTerminatesRun: true,
  engineAbortWarningsThreshold: 25,
};

function totalBudgetMs(snapshot: RunStateSnapshot): number {
  return snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
}

function hasUserAbandonSignal(snapshot: RunStateSnapshot): boolean {
  return (
    snapshot.outcome === 'ABANDONED' ||
    snapshot.telemetry.outcomeReasonCode === 'USER_ABANDON' ||
    snapshot.telemetry.outcomeReason === 'run.user_abandoned' ||
    snapshot.tags.includes('run:user-abandoned')
  );
}

function hasIntegrityQuarantine(snapshot: RunStateSnapshot): boolean {
  return (
    snapshot.sovereignty.integrityStatus === 'QUARANTINED' ||
    snapshot.telemetry.outcomeReasonCode === 'INTEGRITY_QUARANTINE' ||
    snapshot.telemetry.outcomeReason === 'integrity.quarantined' ||
    snapshot.sovereignty.auditFlags.some((flag) => flag === 'integrity.quarantined')
  );
}

function hasEngineAbortSignal(
  snapshot: RunStateSnapshot,
  threshold: number,
): boolean {
  return (
    snapshot.telemetry.outcomeReasonCode === 'ENGINE_ABORT' ||
    snapshot.telemetry.outcomeReason === 'runtime.engine_abort' ||
    snapshot.tags.includes('run:engine-abort') ||
    snapshot.telemetry.warnings.length >= threshold
  );
}

/**
 * Authoritative terminal outcome resolver.
 * Enhanced with:
 * - resolveWithContext(): returns decision + proximity + runway + forecast + narration + ML vector
 * - forecastOutcome(): probabilistic outcome forecast
 * - proximityAnalysis(): structured proximity scores
 * - narrationHint(): companion AI message
 * - applyAdaptiveThresholds(): re-resolves with mode-aware thresholds
 * - buildMLVector(): 32-feature ML vector from the current resolution
 */
export class RuntimeOutcomeResolver {
  private readonly options: Required<RuntimeOutcomeResolverOptions>;
  private readonly mlBuilder: OutcomeMLVectorBuilder;
  private readonly dlBuilder: OutcomeDLTensorBuilder;
  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;
  private readonly trajectoryAnalyzer: OutcomeEconomyTrajectoryAnalyzer;
  private readonly forecastEngine: OutcomeForecastEngine;
  private readonly narrationBuilder: OutcomeNarrationHintBuilder;

  public constructor(options: RuntimeOutcomeResolverOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.mlBuilder = new OutcomeMLVectorBuilder();
    this.dlBuilder = new OutcomeDLTensorBuilder();
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
    this.trajectoryAnalyzer = new OutcomeEconomyTrajectoryAnalyzer();
    this.forecastEngine = new OutcomeForecastEngine();
    this.narrationBuilder = new OutcomeNarrationHintBuilder();
  }

  public resolve(snapshot: RunStateSnapshot): RuntimeOutcomeDecision {
    const totalBudget = totalBudgetMs(snapshot);
    const remainingBudget = Math.max(0, totalBudget - snapshot.timers.elapsedMs);

    if (hasUserAbandonSignal(snapshot)) {
      return {
        outcome: 'ABANDONED',
        outcomeReason: 'run.user_abandoned',
        outcomeReasonCode: 'USER_ABANDON',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: remainingBudget,
        isTerminal: true,
      };
    }

    if (this.options.quarantineTerminatesRun && hasIntegrityQuarantine(snapshot)) {
      return {
        outcome: 'ABANDONED',
        outcomeReason: 'integrity.quarantined',
        outcomeReasonCode: 'INTEGRITY_QUARANTINE',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: remainingBudget,
        isTerminal: true,
      };
    }

    if (hasEngineAbortSignal(snapshot, this.options.engineAbortWarningsThreshold)) {
      return {
        outcome: 'ABANDONED',
        outcomeReason: 'runtime.engine_abort',
        outcomeReasonCode: 'ENGINE_ABORT',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: remainingBudget,
        isTerminal: true,
      };
    }

    if (snapshot.economy.netWorth >= snapshot.economy.freedomTarget) {
      return {
        outcome: 'FREEDOM',
        outcomeReason: 'economy.freedom_target_reached',
        outcomeReasonCode: 'TARGET_REACHED',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: remainingBudget,
        isTerminal: true,
      };
    }

    const negativeCash = this.options.bankruptOnNegativeCash && snapshot.economy.cash < 0;
    const negativeNetWorth =
      this.options.bankruptOnNegativeNetWorth && snapshot.economy.netWorth < 0;

    if (negativeCash || negativeNetWorth) {
      return {
        outcome: 'BANKRUPT',
        outcomeReason: negativeCash
          ? 'economy.cash_below_zero'
          : 'economy.net_worth_below_zero',
        outcomeReasonCode: 'NET_WORTH_COLLAPSE',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: remainingBudget,
        isTerminal: true,
      };
    }

    if (snapshot.timers.elapsedMs >= totalBudget) {
      return {
        outcome: 'TIMEOUT',
        outcomeReason: 'timer.expired',
        outcomeReasonCode: 'SEASON_BUDGET_EXHAUSTED',
        totalBudgetMs: totalBudget,
        remainingBudgetMs: 0,
        isTerminal: true,
      };
    }

    return {
      outcome: null,
      outcomeReason: null,
      outcomeReasonCode: null,
      totalBudgetMs: totalBudget,
      remainingBudgetMs: remainingBudget,
      isTerminal: false,
    };
  }

  public apply(snapshot: RunStateSnapshot): RunStateSnapshot {
    const decision = this.resolve(snapshot);

    if (
      snapshot.outcome === decision.outcome &&
      snapshot.telemetry.outcomeReason === decision.outcomeReason &&
      snapshot.telemetry.outcomeReasonCode === decision.outcomeReasonCode
    ) {
      return snapshot;
    }

    const next = cloneJson(snapshot) as RunStateSnapshot & {
      -readonly [K in keyof RunStateSnapshot]: RunStateSnapshot[K];
    };
    (next as { outcome: RunStateSnapshot['outcome'] }).outcome = decision.outcome;
    (next.telemetry as { outcomeReason: RunStateSnapshot['telemetry']['outcomeReason'] }).outcomeReason = decision.outcomeReason;
    (next.telemetry as { outcomeReasonCode: RunStateSnapshot['telemetry']['outcomeReasonCode'] }).outcomeReasonCode = decision.outcomeReasonCode;
    return deepFreeze(next) as RunStateSnapshot;
  }

  /** Resolve with full analytical context: proximity, runway, forecast, narration, ML vector. */
  public resolveWithContext(snapshot: RunStateSnapshot): OutcomeDecisionContext {
    const decision = this.resolve(snapshot);
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, decision);
    const runway = this.trajectoryAnalyzer.buildFromSnapshot(snapshot, decision);
    const forecast = this.forecastEngine.forecast(snapshot, decision);
    const narrationHint = this.narrationBuilder.build(snapshot, decision, proximity);
    const mlVector = this.mlBuilder.build(snapshot, decision);

    return { decision, proximity, runway, forecast, narrationHint, mlVector };
  }

  /** Generate a probabilistic forecast for a snapshot. */
  public forecastOutcome(snapshot: RunStateSnapshot, horizonTicks = 20): OutcomeForecast {
    const decision = this.resolve(snapshot);
    return this.forecastEngine.forecast(snapshot, decision, horizonTicks);
  }

  /** Compute structured proximity scores for a snapshot. */
  public proximityAnalysis(snapshot: RunStateSnapshot): OutcomeProximity {
    const decision = this.resolve(snapshot);
    return this.proximityAnalyzer.computeProximity(snapshot, decision);
  }

  /** Get companion narration hint for the current state. */
  public narrationHint(snapshot: RunStateSnapshot): OutcomeNarrationHint {
    const decision = this.resolve(snapshot);
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, decision);
    return this.narrationBuilder.build(snapshot, decision, proximity);
  }

  /** Build a 32-feature ML vector from the current resolution. */
  public buildMLVector(snapshot: RunStateSnapshot): OutcomeMLVector {
    const decision = this.resolve(snapshot);
    return this.mlBuilder.build(snapshot, decision);
  }

  /** Build a 48-feature DL tensor from the current resolution and runway. */
  public buildDLTensor(snapshot: RunStateSnapshot): OutcomeDLTensor {
    const decision = this.resolve(snapshot);
    const runway = this.trajectoryAnalyzer.buildFromSnapshot(snapshot, decision);
    return this.dlBuilder.build(snapshot, decision, runway);
  }

  /**
   * Re-resolve using mode-adaptive thresholds computed from the snapshot.
   * Returns both the adaptive config and the decision it produced.
   */
  public applyAdaptiveThresholds(snapshot: RunStateSnapshot): {
    config: OutcomeThresholdConfig;
    decision: RuntimeOutcomeDecision;
  } {
    const advisor = new OutcomeThresholdAdvisor();
    const config = advisor.advise(snapshot);
    const adaptiveOptions = advisor.toResolverOptions(config);
    const adaptiveResolver = new RuntimeOutcomeResolver(adaptiveOptions);
    const decision = adaptiveResolver.resolve(snapshot);
    return { config, decision };
  }

  /**
   * Produce a stable fingerprint for this decision state.
   * Used by checkpoint and replay systems to detect duplicate resolutions.
   */
  public fingerprintDecision(snapshot: RunStateSnapshot): string {
    const decision = this.resolve(snapshot);
    return createDeterministicId(
      'outcome-decision',
      snapshot.runId,
      snapshot.tick,
      decision.outcome ?? 'null',
      decision.outcomeReasonCode ?? 'null',
      checksumSnapshot(snapshot).slice(0, 12),
    );
  }

  /**
   * Produce a frozen copy of snapshot with the resolved outcome applied.
   * Uses deepFrozenClone to ensure full immutability.
   */
  public applyFrozen(snapshot: RunStateSnapshot): RunStateSnapshot {
    const applied = this.apply(snapshot);
    return deepFrozenClone(applied);
  }

  /**
   * Produce a stable string summary of the decision for logging/telemetry.
   * Uses stableStringify to guarantee reproducible output.
   */
  public summarize(snapshot: RunStateSnapshot): string {
    const decision = this.resolve(snapshot);
    return stableStringify({
      runId: snapshot.runId,
      tick: snapshot.tick,
      outcome: decision.outcome,
      reason: decision.outcomeReason,
      code: decision.outcomeReasonCode,
      isTerminal: decision.isTerminal,
      remainingBudgetMs: decision.remainingBudgetMs,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — OutcomeResolverFacade
// ─────────────────────────────────────────────────────────────────────────────

/** Full facade analysis result. */
export interface OutcomeFacadeResult {
  readonly decision: RuntimeOutcomeDecision;
  readonly context: OutcomeDecisionContext;
  readonly trajectory: OutcomeTrajectory | null;
  readonly batchResults: readonly OutcomeBatchResult[];
  readonly stats: OutcomeResolverStats;
  readonly healthGrade: OutcomeResolverHealthGrade;
}

/**
 * Single entry point for the full outcome resolution + analytical suite.
 * Combines RuntimeOutcomeResolver, OutcomeHistoryTracker, OutcomeBatchResolver,
 * and OutcomeResolverHealthMonitor into a unified surface.
 *
 * Mode guard (isModeCode) and tier guard (isPressureTier) are applied
 * in the threshold advisor before constructing adaptive resolvers.
 */
export class OutcomeResolverFacade {
  public readonly resolver: RuntimeOutcomeResolver;
  private readonly historyTracker: OutcomeHistoryTracker;
  private readonly batchResolver: OutcomeBatchResolver;
  private readonly healthMonitor: OutcomeResolverHealthMonitor;
  private readonly thresholdAdvisor: OutcomeThresholdAdvisor;

  public constructor(options: RuntimeOutcomeResolverOptions = {}) {
    this.resolver = new RuntimeOutcomeResolver(options);
    this.historyTracker = new OutcomeHistoryTracker();
    this.batchResolver = new OutcomeBatchResolver(options);
    this.healthMonitor = new OutcomeResolverHealthMonitor();
    this.thresholdAdvisor = new OutcomeThresholdAdvisor();
  }

  /** Resolve a single snapshot with full context + history recording. */
  public resolve(snapshot: RunStateSnapshot): OutcomeFacadeResult {
    const context = this.resolver.resolveWithContext(snapshot);
    this.historyTracker.record(snapshot, context.decision);
    this.healthMonitor.record(context.decision);

    const trajectory = this.historyTracker.getTrajectory(snapshot.runId);
    const stats = this.healthMonitor.stats();
    const healthGrade = this.healthMonitor.grade(stats);

    return {
      decision: context.decision,
      context,
      trajectory,
      batchResults: [],
      stats,
      healthGrade,
    };
  }

  /** Resolve a batch of snapshots and return aggregated results. */
  public resolveBatch(snapshots: readonly RunStateSnapshot[]): OutcomeFacadeResult {
    const batchResults = this.batchResolver.resolveBatch(snapshots);
    const latest = snapshots[snapshots.length - 1];

    if (!latest) {
      const stats = this.healthMonitor.stats();
      return {
        decision: {
          outcome: null,
          outcomeReason: null,
          outcomeReasonCode: null,
          totalBudgetMs: 0,
          remainingBudgetMs: 0,
          isTerminal: false,
        },
        context: {} as OutcomeDecisionContext,
        trajectory: null,
        batchResults,
        stats,
        healthGrade: this.healthMonitor.grade(stats),
      };
    }

    batchResults.forEach((r) => this.healthMonitor.record(r.decision));
    const context = this.resolver.resolveWithContext(latest);
    const trajectory = this.historyTracker.getTrajectory(latest.runId);
    const stats = this.healthMonitor.stats();

    return {
      decision: context.decision,
      context,
      trajectory,
      batchResults,
      stats,
      healthGrade: this.healthMonitor.grade(stats),
    };
  }

  /** Get adaptive threshold recommendation for a snapshot. */
  public adaptiveThresholds(snapshot: RunStateSnapshot): OutcomeThresholdConfig {
    return this.thresholdAdvisor.advise(snapshot);
  }

  /** Get the current health stats. */
  public health(): { stats: OutcomeResolverStats; grade: OutcomeResolverHealthGrade } {
    const stats = this.healthMonitor.stats();
    return { stats, grade: this.healthMonitor.grade(stats) };
  }

  /** Clear history for a run. */
  public clearRunHistory(runId: string): void {
    this.historyTracker.clearRun(runId);
  }

  /** Reset all health monitoring counters. */
  public resetHealth(): void {
    this.healthMonitor.reset();
  }
}
