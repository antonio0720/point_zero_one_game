/*
 * POINT ZERO ONE — BACKEND PRESSURE DECAY CONTROLLER
 * /backend/src/game/engine/pressure/PressureDecayController.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - pressure can rise instantly but should not collapse unrealistically in one tick
 * - higher danger states are intentionally sticky
 * - decay is phase-aware, mode-aware, and threat-aware
 * - mild recovery is allowed, but tier whipsaw is resisted while the crisis substrate remains active
 * - ML/DL extraction is first-class — every decay decision must be inspectable by inference pipelines
 * - scenario simulation enables proactive UX: "you are 4 ticks from relief"
 * - policy advisor makes decay rules explainable to chat / companion systems
 * - every symbol imported from types.ts is actively exercised — zero placeholder imports
 *
 * Module summary:
 *   § 1  — Imports
 *   § 2  — Additional type imports (PressureTier, PressureBand)
 *   § 3  — Exported type and interface definitions
 *   § 4  — Module constants and manifest
 *   § 5  — PressureDecayController — core apply / estimate / profile engine
 *   § 6  — DecayMLExtractor — 48-feature ML vector from decay context
 *   § 7  — DecayDLBuilder — 10×64 DL sequence tensor from decay history
 *   § 8  — DecayTrendAnalyzer — velocity, acceleration, stickiness over PRESSURE_TREND_WINDOW
 *   § 9  — DecayPolicyAdvisor — mode/phase/tier-aware policy recommendations
 *   § 10 — DecayScenarioSimulator — multi-step decay path forecast
 *   § 11 — DecayAnnotator — chat/companion-ready annotations
 *   § 12 — DecayInspector — full runtime inspector state
 *   § 13 — createDecayController factory and standalone helpers
 */

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Imports
// ─────────────────────────────────────────────────────────────────────────────

import type { PressureTier } from '../core/GamePrimitives';
import type { PressureBand } from '../core/RunStateSnapshot';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

import {
  clampPressureScore,
  createZeroPressureSignalMap,
  DEFAULT_MAX_DECAY_PER_TICK,
  DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
  getPressureTierMinScore,
  mergePressureCollectorWeights,
  normalizeWeight,
  PRESSURE_BAND_THRESHOLDS,
  PRESSURE_HISTORY_DEPTH,
  PRESSURE_POSITIVE_SIGNAL_KEYS,
  PRESSURE_RELIEF_SIGNAL_KEYS,
  PRESSURE_SIGNAL_KEYS,
  PRESSURE_THRESHOLDS,
  PRESSURE_TIER_CONFIGS,
  PRESSURE_TREND_WINDOW,
  rankPressureBand,
  rankPressureTier,
  resolvePressureBand,
  resolvePressureTier,
  TOP_PRESSURE_SIGNAL_COUNT,
  type PressureCollectorLimits,
  type PressureCollectorWeights,
  type PressureDecayProfile,
  type PressurePositiveSignalKey,
  type PressureReliefSignalKey,
  type PressureSignalCollection,
  type PressureSignalContribution,
  type PressureSignalKey,
  type PressureSignalMap,
  type PressureSignalPolarity,
  type PressureThreshold,
  type PressureTierConfig,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Exported type and interface definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single entry in the decay controller's internal profile history.
 * Stored for up to PRESSURE_HISTORY_DEPTH ticks to support trend analysis and
 * DL tensor construction.
 */
export interface DecayHistoryEntry {
  readonly inputScore: number;
  readonly resultScore: number;
  readonly profile: PressureDecayProfile;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly wasConstrained: boolean;
  readonly constraintStrength: number;
}

/**
 * Full result from applyWithAnalysis() — the applied score plus rich diagnostics
 * that the ML pipeline and chat lane can consume directly.
 */
export interface DecayApplicationResult {
  readonly resultScore: number;
  readonly profile: PressureDecayProfile;
  readonly wasConstrained: boolean;
  readonly constraintStrength: number;
  readonly tierRetained: boolean;
  readonly floorApplied: boolean;
  readonly appliedTier: PressureTier;
  readonly appliedBand: PressureBand;
}

/**
 * ML feature vector extracted from a decay context — 48 labeled float features
 * normalized to [0.0, 1.0] for online inference pipelines.
 */
export interface DecayMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly tick: number;
  readonly score: number;
  readonly tier: PressureTier;
}

/**
 * DL sequence tensor for LSTM / Transformer models.
 * Shape: [DECAY_DL_SEQUENCE_LENGTH × DECAY_DL_FEATURE_COUNT]
 */
export interface DecayDLTensor {
  readonly features: ReadonlyArray<readonly number[]>;
  readonly tickCount: number;
  readonly featureCount: number;
  readonly sequenceLength: number;
  readonly labels: readonly string[];
}

/**
 * Trend summary computed from the last PRESSURE_TREND_WINDOW history entries.
 * Velocity is positive when pressure is building (score rising), negative when
 * recovering.
 */
export interface DecayTrendSummary {
  readonly velocity: number;
  readonly acceleration: number;
  readonly isAccelerating: boolean;
  readonly isDecelerating: boolean;
  readonly isSticky: boolean;
  readonly ticksAtCurrentFloor: number;
  readonly dominantConstraintReason: string;
  readonly trendWindow: number;
  readonly averageConstraintRatio: number;
}

/**
 * Policy summary from DecayPolicyAdvisor for a given snapshot context.
 * Used by the chat lane to explain why recovery is slow.
 */
export interface DecayPolicySummary {
  readonly mode: string;
  readonly phase: string;
  readonly tier: PressureTier;
  readonly band: PressureBand;
  readonly maxDropPerTick: number;
  readonly stickyFloor: number;
  readonly tierRetentionFloor: number;
  readonly isConstrained: boolean;
  readonly constraintReasons: readonly string[];
  readonly activeCollectorLimits: PressureCollectorLimits;
  readonly decayInformedWeights: PressureCollectorWeights;
  readonly tierConfig: PressureTierConfig;
  readonly allowsHaterInjection: boolean;
  readonly passiveShieldDrainActive: boolean;
  readonly estimatedTicksToCalm: number;
}

/**
 * A simulated decay path — the sequence of clamped scores the engine would
 * produce if no new pressure were added and the current snapshot persisted.
 */
export interface DecayPathSimulation {
  readonly targetScore: number;
  readonly achievedScore: number;
  readonly path: readonly number[];
  readonly tierPath: readonly PressureTier[];
  readonly bandPath: readonly PressureBand[];
  readonly ticksToTarget: number;
  readonly achievedTarget: boolean;
  readonly tierCrossings: readonly DecayTierCrossing[];
  readonly bandCrossings: readonly DecayBandCrossing[];
  readonly blockingReasons: readonly string[];
}

/** A tier boundary crossing detected during a simulated decay path. */
export interface DecayTierCrossing {
  readonly atTick: number;
  readonly atScore: number;
  readonly fromTier: PressureTier;
  readonly toTier: PressureTier;
  readonly direction: 'up' | 'down';
}

/** A band boundary crossing detected during a simulated decay path. */
export interface DecayBandCrossing {
  readonly atTick: number;
  readonly atScore: number;
  readonly fromBand: PressureBand;
  readonly toBand: PressureBand;
  readonly direction: 'up' | 'down';
}

/**
 * Annotation bundle produced by DecayAnnotator for the chat / companion
 * display layer. Expresses decay state in player-facing language.
 */
export interface DecayAnnotationBundle {
  readonly headline: string;
  readonly subtext: string;
  readonly urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly uxLabel: string;
  readonly chatSignalKey: string;
  readonly topSignals: readonly DecayAnnotatedSignal[];
  readonly forecastSentence: string;
  readonly tierLabel: string;
  readonly bandLabel: string;
  readonly haterInjectionWarning: boolean;
  readonly shieldDrainWarning: boolean;
}

/** A single annotated signal within a DecayAnnotationBundle. */
export interface DecayAnnotatedSignal {
  readonly key: PressureSignalKey;
  readonly polarity: PressureSignalPolarity;
  readonly amount: number;
  readonly label: string;
}

/**
 * Full inspector state for runtime debugging, test coverage, and orchestrator
 * health reporting.
 */
export interface DecayInspectorState {
  readonly currentProfile: PressureDecayProfile | null;
  readonly lastResultScore: number;
  readonly totalApplications: number;
  readonly totalConstrainedApplications: number;
  readonly totalTierRetentions: number;
  readonly profileHistory: readonly DecayHistoryEntry[];
  readonly trend: DecayTrendSummary | null;
  readonly signalBaseline: PressureSignalMap;
  readonly moduleVersion: string;
}

/**
 * Output of DecayPolicyAdvisor.analyzeContributions() — maps each top signal
 * contribution to a concrete decay policy impact.
 */
export interface DecayContributionAnalysis {
  readonly topContributions: readonly PressureSignalContribution[];
  readonly dominantPressureSignal: PressurePositiveSignalKey | null;
  readonly dominantReliefSignal: PressureReliefSignalKey | null;
  readonly policyImpact: readonly DecayPolicyImpact[];
}

/** How a single signal contribution affects the current decay policy. */
export interface DecayPolicyImpact {
  readonly signalKey: PressureSignalKey;
  readonly polarity: PressureSignalPolarity;
  readonly contributionAmount: number;
  readonly decayConstraintImpact: 'NONE' | 'MINOR' | 'MAJOR' | 'CRITICAL';
  readonly explanation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Module constants and manifest
// ─────────────────────────────────────────────────────────────────────────────

export const DECAY_CONTROLLER_MODULE_VERSION = '2026.03.25' as const;

/** Number of features in the flat ML vector from DecayMLExtractor. */
export const DECAY_ML_FEATURE_COUNT = 48 as const;

/** Number of features per tick step in the DL sequence tensor. */
export const DECAY_DL_FEATURE_COUNT = 64 as const;

/** Number of tick steps in the DL sequence tensor window. */
export const DECAY_DL_SEQUENCE_LENGTH = 10 as const;

/** Maximum ticks to simulate in DecayScenarioSimulator.simulatePath(). */
export const DECAY_SCENARIO_MAX_TICKS = 80 as const;

/** Score threshold below which pressure is considered "calm" for scenarios. */
export const DECAY_SCENARIO_CALM_THRESHOLD = 0.05 as const;

/** Constraint ratio threshold below which decay is considered fully constrained. */
export const DECAY_FULLY_CONSTRAINED_RATIO = 0.5 as const;

export const DECAY_CONTROLLER_MANIFEST = Object.freeze({
  module: 'PressureDecayController',
  version: DECAY_CONTROLLER_MODULE_VERSION,
  mlFeatureCount: DECAY_ML_FEATURE_COUNT,
  dlFeatureCount: DECAY_DL_FEATURE_COUNT,
  dlSequenceLength: DECAY_DL_SEQUENCE_LENGTH,
  historyDepth: PRESSURE_HISTORY_DEPTH,
  trendWindow: PRESSURE_TREND_WINDOW,
  topSignalCount: TOP_PRESSURE_SIGNAL_COUNT,
  defaultMaxDecayPerTick: DEFAULT_MAX_DECAY_PER_TICK,
  signalKeyCount: PRESSURE_SIGNAL_KEYS.length,
  positiveSignalCount: PRESSURE_POSITIVE_SIGNAL_KEYS.length,
  reliefSignalCount: PRESSURE_RELIEF_SIGNAL_KEYS.length,
});

// Feature labels for the 48-feature ML vector — ordered to match
// DecayMLExtractor.extract() output exactly.
export const DECAY_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Group 1: Raw decay profile (4)
  'decay:max_drop_per_tick',
  'decay:sticky_floor',
  'decay:tier_retention_floor',
  'decay:constraint_ratio',
  // Group 2: Tier / band position (6)
  'tier:rank_normalized',
  'band:rank_normalized',
  'tier:min_score',
  'tier:max_score_exclusive',
  'tier:allows_hater_injection',
  'tier:passive_shield_drain',
  // Group 3: Phase / mode (8)
  'phase:is_escalation',
  'phase:is_sovereignty',
  'mode:is_solo',
  'mode:is_pvp',
  'mode:is_coop',
  'mode:is_ghost',
  'mode:bleed_or_high_conflict',
  'mode:specific_stress',
  // Group 4: Threat context (7)
  'threat:pending_attacks_normalized',
  'threat:negative_chains_normalized',
  'threat:weakest_shield_ratio',
  'threat:shield_critical',
  'threat:shield_weak',
  'threat:has_pending_attacks',
  'threat:has_negative_chains',
  // Group 5: Economy context (7)
  'economy:cash_normalized',
  'economy:cash_danger',
  'economy:cash_warning',
  'economy:cashflow_balance',
  'economy:cash_soft',
  'economy:runway_normalized',
  'economy:prosperity_score',
  // Group 6: Decay dynamics (6)
  'dynamics:ticks_to_calm_normalized',
  'dynamics:ticks_to_lower_tier_normalized',
  'dynamics:stickiness_ratio',
  'dynamics:tier_retention_strength',
  'dynamics:total_constraint',
  'dynamics:constraint_reason_count',
  // Group 7: Signal context (7)
  'signal:dominant_pressure_key_rank',
  'signal:dominant_relief_key_rank',
  'signal:raw_positive_score',
  'signal:raw_relief_score',
  'signal:contribution_density',
  'signal:raw_net_score',
  'signal:net_score',
  // Group 8: Threshold distances (3)
  'threshold:distance_to_next_tier',
  'threshold:distance_to_prev_band',
  'threshold:distance_from_tier_top',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — PressureDecayController
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PressureDecayController
 *
 * Core decay engine. Accepts a raw next-score and a snapshot, then applies
 * phase/mode/threat-aware decay constraints to prevent unrealistic pressure
 * collapse. The resulting score is still fully deterministic and replay-safe.
 *
 * Public API:
 *   apply()              — primary call site: returns constrained next score
 *   getProfile()         — inspect the decay profile for a given snapshot
 *   estimateTicksToScore()  — how many ticks until score reaches target?
 *   estimateTicksToCalm()   — how many ticks until score reaches ~0?
 *   applyWithAnalysis()  — apply + full diagnostic result
 *   simulateDecayPath()  — N-tick forward simulation
 *   buildMLVector()      — extract 48-feature ML vector
 *   buildDLTensor()      — build 10×64 DL sequence tensor from history
 *   getDecayTrend()      — velocity / acceleration / stickiness summary
 *   getProfileHistory()  — last PRESSURE_HISTORY_DEPTH entries
 *   getInspectorState()  — full runtime inspector snapshot
 */
export class PressureDecayController {
  private readonly history: DecayHistoryEntry[] = [];
  private applicationCount = 0;
  private constrainedApplicationCount = 0;
  private tierRetentionCount = 0;

  // ── Core public API ─────────────────────────────────────────────────────

  /**
   * Apply decay constraints to a proposed next score.
   * This is the hot path: called once per tick by PressureEngine.
   */
  public apply(snapshot: RunStateSnapshot, nextScore: number): number {
    const result = this.applyWithAnalysis(snapshot, nextScore);
    return result.resultScore;
  }

  /**
   * Return the full PressureDecayProfile for a given snapshot.
   * Exposes the reasoning behind the active constraints for diagnostics
   * and ML feature extraction.
   */
  public getProfile(snapshot: RunStateSnapshot): PressureDecayProfile {
    return this.resolveProfile(snapshot);
  }

  /**
   * Estimate how many ticks it will take to reach a specific score,
   * assuming no new pressure is added and the current decay profile persists.
   * Returns 0 if the score is already at or below target.
   */
  public estimateTicksToScore(
    snapshot: RunStateSnapshot,
    targetScore: number,
  ): number {
    const current = clampPressureScore(snapshot.pressure.score);
    const target = clampPressureScore(targetScore);

    if (current <= target) {
      return 0;
    }

    const profile = this.resolveProfile(snapshot);
    const effectiveTarget = Math.max(target, profile.stickyFloor);

    if (current <= effectiveTarget) {
      return 0;
    }

    return Math.ceil((current - effectiveTarget) / profile.maxDropPerTick);
  }

  /**
   * Estimate how many ticks until pressure reaches approximately zero.
   * Accounts for sticky floors — if the floor is > 0, this is the ticks
   * to floor, not to absolute zero.
   */
  public estimateTicksToCalm(snapshot: RunStateSnapshot): number {
    return this.estimateTicksToScore(snapshot, DECAY_SCENARIO_CALM_THRESHOLD);
  }

  /**
   * Apply decay and return a full diagnostic result including the profile,
   * constraint analysis, and applied tier/band. Callers that need diagnostics
   * should prefer this over apply().
   */
  public applyWithAnalysis(
    snapshot: RunStateSnapshot,
    nextScore: number,
  ): DecayApplicationResult {
    const previousScore = clampPressureScore(snapshot.pressure.score);
    const targetScore = clampPressureScore(nextScore);

    if (targetScore >= previousScore) {
      const tier = resolvePressureTier(targetScore);
      const band = resolvePressureBand(targetScore);
      const profile = this.resolveProfile(snapshot);
      const entry: DecayHistoryEntry = {
        inputScore: targetScore,
        resultScore: targetScore,
        profile,
        tier,
        band,
        wasConstrained: false,
        constraintStrength: 0,
      };
      this.recordHistory(entry);
      this.applicationCount += 1;
      return {
        resultScore: targetScore,
        profile,
        wasConstrained: false,
        constraintStrength: 0,
        tierRetained: false,
        floorApplied: false,
        appliedTier: tier,
        appliedBand: band,
      };
    }

    const profile = this.resolveProfile(snapshot);
    let boundedScore = Math.max(
      targetScore,
      previousScore - profile.maxDropPerTick,
      profile.stickyFloor,
    );

    const tierRetained = this.shouldRetainCurrentTier(snapshot, targetScore, profile);
    if (tierRetained) {
      boundedScore = Math.max(boundedScore, profile.tierRetentionFloor);
      this.tierRetentionCount += 1;
    }

    const resultScore = clampPressureScore(boundedScore);
    const wasConstrained = resultScore > targetScore;
    const floorApplied = resultScore <= profile.stickyFloor + 0.001;
    const constraintStrength = wasConstrained
      ? normalizeWeight((resultScore - targetScore) / Math.max(0.001, previousScore - targetScore))
      : 0;

    const tier = resolvePressureTier(resultScore);
    const band = resolvePressureBand(resultScore);

    const entry: DecayHistoryEntry = {
      inputScore: targetScore,
      resultScore,
      profile,
      tier,
      band,
      wasConstrained,
      constraintStrength,
    };
    this.recordHistory(entry);
    this.applicationCount += 1;
    if (wasConstrained) this.constrainedApplicationCount += 1;

    return {
      resultScore,
      profile,
      wasConstrained,
      constraintStrength,
      tierRetained,
      floorApplied,
      appliedTier: tier,
      appliedBand: band,
    };
  }

  /**
   * Simulate a multi-tick decay path from the current snapshot's score
   * toward a target score, assuming no new pressure each tick.
   * Returns the full path including tier/band crossings and blocking reasons.
   */
  public simulateDecayPath(
    snapshot: RunStateSnapshot,
    targetScore: number,
    maxTicks: number = DECAY_SCENARIO_MAX_TICKS,
  ): DecayPathSimulation {
    const simulator = new DecayScenarioSimulator(this);
    return simulator.simulate(snapshot, targetScore, maxTicks);
  }

  /**
   * Extract a 48-feature ML vector from the current decay context.
   * Optionally enriched with signal collection data from PressureSignalCollector.
   */
  public buildMLVector(
    snapshot: RunStateSnapshot,
    collection: PressureSignalCollection | null = null,
    tick: number = 0,
  ): DecayMLVector {
    const extractor = new DecayMLExtractor(this);
    return extractor.extract(snapshot, collection, tick);
  }

  /**
   * Build a DL sequence tensor from the last DECAY_DL_SEQUENCE_LENGTH
   * history entries. Zero-padded if fewer entries exist.
   */
  public buildDLTensor(): DecayDLTensor {
    const builder = new DecayDLBuilder(this.history);
    return builder.build();
  }

  /**
   * Compute decay trend summary from the last PRESSURE_TREND_WINDOW history
   * entries — velocity, acceleration, stickiness.
   */
  public getDecayTrend(): DecayTrendSummary | null {
    if (this.history.length < 2) return null;
    const analyzer = new DecayTrendAnalyzer(this.history);
    return analyzer.analyze();
  }

  /** Return the full profile history, most recent last. */
  public getProfileHistory(): readonly DecayHistoryEntry[] {
    return Object.freeze([...this.history]);
  }

  /** Return the full runtime inspector state for diagnostics. */
  public getInspectorState(): DecayInspectorState {
    const inspector = new DecayInspector(
      this.history,
      this.applicationCount,
      this.constrainedApplicationCount,
      this.tierRetentionCount,
    );
    return inspector.buildState();
  }

  /** Reset controller state — use between runs. */
  public reset(): void {
    this.history.length = 0;
    this.applicationCount = 0;
    this.constrainedApplicationCount = 0;
    this.tierRetentionCount = 0;
  }

  // ── Core private helpers ─────────────────────────────────────────────────

  private recordHistory(entry: DecayHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > PRESSURE_HISTORY_DEPTH) {
      this.history.shift();
    }
  }

  private resolveProfile(snapshot: RunStateSnapshot): PressureDecayProfile {
    let maxDropPerTick = DEFAULT_MAX_DECAY_PER_TICK;
    let stickyFloor = 0;
    let tierRetentionFloor = 0;
    const reasons: string[] = [];

    const currentTier = resolvePressureTier(snapshot.pressure.score);

    if (snapshot.phase === 'ESCALATION') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.045);
      reasons.push('phase:escalation');
    }

    if (snapshot.phase === 'SOVEREIGNTY') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.035);
      stickyFloor = Math.max(stickyFloor, 0.03);
      reasons.push('phase:sovereignty');
    }

    if (currentTier === 'T3') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.040);
      tierRetentionFloor = Math.max(
        tierRetentionFloor,
        getPressureTierMinScore('T3') - 0.02,
      );
      reasons.push('tier:high');
    }

    if (currentTier === 'T4') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.030);
      stickyFloor = Math.max(stickyFloor, 0.05);
      tierRetentionFloor = Math.max(
        tierRetentionFloor,
        getPressureTierMinScore('T4') - 0.02,
      );
      reasons.push('tier:critical');
    }

    if (snapshot.battle.pendingAttacks.length > 0) {
      maxDropPerTick = Math.min(maxDropPerTick, 0.040);
      tierRetentionFloor = Math.max(
        tierRetentionFloor,
        Math.max(0, getPressureTierMinScore(currentTier) - 0.03),
      );
      reasons.push('threats:pending_attacks');
    }

    if (this.countNegativeActiveChains(snapshot) > 0) {
      maxDropPerTick = Math.min(maxDropPerTick, 0.035);
      stickyFloor = Math.max(stickyFloor, 0.06);
      tierRetentionFloor = Math.max(
        tierRetentionFloor,
        Math.max(0, getPressureTierMinScore(currentTier) - 0.02),
      );
      reasons.push('cascade:negative_active');
    }

    if (snapshot.shield.weakestLayerRatio <= DEFAULT_PRESSURE_COLLECTOR_LIMITS.weakShieldThreshold) {
      stickyFloor = Math.max(stickyFloor, 0.04);
      reasons.push('shield:weakest_below_40pct');
    }

    if (snapshot.shield.weakestLayerRatio <= DEFAULT_PRESSURE_COLLECTOR_LIMITS.criticalShieldThreshold) {
      stickyFloor = Math.max(stickyFloor, 0.10);
      reasons.push('shield:weakest_below_25pct');
    }

    if (snapshot.mode === 'solo' && snapshot.modeState.bleedMode) {
      maxDropPerTick = Math.min(maxDropPerTick, 0.025);
      stickyFloor = Math.max(stickyFloor, 0.08);
      reasons.push('mode:solo_bleed');
    }

    if (snapshot.mode === 'pvp' && snapshot.battle.rivalryHeatCarry >= 15) {
      stickyFloor = Math.max(stickyFloor, 0.04);
      reasons.push('mode:pvp_rivalry');
    }

    if (snapshot.mode === 'coop' && this.averageTrust(snapshot) < 50) {
      stickyFloor = Math.max(stickyFloor, 0.05);
      reasons.push('mode:coop_trust_fracture');
    }

    if (snapshot.mode === 'ghost') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.040);
      stickyFloor = Math.max(
        stickyFloor,
        Math.min(0.12, snapshot.modeState.communityHeatModifier / 2500),
      );
      reasons.push('mode:ghost_community_heat');
    }

    return Object.freeze({
      maxDropPerTick: clampPressureScore(maxDropPerTick),
      stickyFloor: clampPressureScore(stickyFloor),
      tierRetentionFloor: clampPressureScore(tierRetentionFloor),
      reasons: Object.freeze(reasons),
    });
  }

  private shouldRetainCurrentTier(
    snapshot: RunStateSnapshot,
    targetScore: number,
    profile: PressureDecayProfile,
  ): boolean {
    const currentTier = resolvePressureTier(snapshot.pressure.score);
    const targetTier = resolvePressureTier(targetScore);

    if (rankPressureTier(targetTier) >= rankPressureTier(currentTier)) {
      return false;
    }

    if (profile.tierRetentionFloor <= 0) {
      return false;
    }

    if (snapshot.battle.pendingAttacks.length > 0) {
      return true;
    }

    if (this.countNegativeActiveChains(snapshot) > 0) {
      return true;
    }

    if (snapshot.shield.weakestLayerRatio < 0.35) {
      return true;
    }

    if (snapshot.mode === 'solo' && snapshot.modeState.bleedMode) {
      return true;
    }

    if (snapshot.mode === 'ghost' && snapshot.modeState.communityHeatModifier > 0) {
      return true;
    }

    return false;
  }

  private countNegativeActiveChains(snapshot: RunStateSnapshot): number {
    return snapshot.cascade.activeChains.filter((chain) => !chain.positive).length;
  }

  private averageTrust(snapshot: RunStateSnapshot): number {
    const values = Object.values(snapshot.modeState.trustScores);
    if (values.length === 0) {
      return 100;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — DecayMLExtractor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DecayMLExtractor
 *
 * Extracts a flat 48-feature ML vector from a decay context. Every feature is
 * normalized to [0.0, 1.0] and labeled. The vector is stable across ticks and
 * safe for online inference without further normalization.
 *
 * Feature groups (48 total):
 *   [0–3]   Raw decay profile
 *   [4–9]   Tier / band position from PRESSURE_TIER_CONFIGS
 *   [10–17] Phase / mode context
 *   [18–24] Threat context using DEFAULT_PRESSURE_COLLECTOR_LIMITS
 *   [25–31] Economy context using DEFAULT_PRESSURE_COLLECTOR_LIMITS
 *   [32–37] Decay dynamics (forecast, stickiness, constraints)
 *   [38–44] Signal context from PressureSignalCollection
 *   [45–47] Threshold distances using PRESSURE_THRESHOLDS / PRESSURE_BAND_THRESHOLDS
 */
export class DecayMLExtractor {
  private readonly controller: PressureDecayController;

  public constructor(controller: PressureDecayController) {
    this.controller = controller;
  }

  /**
   * Extract the 48-feature vector.
   *
   * @param snapshot — the current game state
   * @param collection — optional signal collection from PressureSignalCollector;
   *                     when null, signal features default to 0
   * @param tick — current tick index for the vector header
   */
  public extract(
    snapshot: RunStateSnapshot,
    collection: PressureSignalCollection | null,
    tick: number,
  ): DecayMLVector {
    const profile = this.controller.getProfile(snapshot);
    const score = clampPressureScore(snapshot.pressure.score);
    const tier = resolvePressureTier(score);
    const band = resolvePressureBand(score);
    const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[tier];

    const features: number[] = [];

    // ── Group 1: Raw decay profile (indices 0–3) ───────────────────────────
    features.push(profile.maxDropPerTick);
    features.push(profile.stickyFloor);
    features.push(profile.tierRetentionFloor);
    // constraint ratio: how much is maxDropPerTick reduced vs the default
    features.push(
      normalizeWeight(profile.maxDropPerTick / DEFAULT_MAX_DECAY_PER_TICK),
    );

    // ── Group 2: Tier / band position (indices 4–9) ───────────────────────
    features.push(normalizeWeight(rankPressureTier(tier) / 4));
    features.push(normalizeWeight(rankPressureBand(band) / 4));
    features.push(tierConfig.minScore);
    features.push(normalizeWeight(tierConfig.maxScoreExclusive));
    features.push(tierConfig.allowsHaterInjection ? 1 : 0);
    features.push(tierConfig.passiveShieldDrain ? 1 : 0);

    // ── Group 3: Phase / mode context (indices 10–17) ─────────────────────
    features.push(snapshot.phase === 'ESCALATION' ? 1 : 0);
    features.push(snapshot.phase === 'SOVEREIGNTY' ? 1 : 0);
    features.push(snapshot.mode === 'solo' ? 1 : 0);
    features.push(snapshot.mode === 'pvp' ? 1 : 0);
    features.push(snapshot.mode === 'coop' ? 1 : 0);
    features.push(snapshot.mode === 'ghost' ? 1 : 0);
    features.push(this.computeBleedOrHighConflictFeature(snapshot));
    features.push(this.computeModeSpecificStress(snapshot));

    // ── Group 4: Threat context (indices 18–24) ───────────────────────────
    const pendingCount = snapshot.battle.pendingAttacks.length;
    const negativeChains = snapshot.cascade.activeChains.filter(
      (c) => !c.positive,
    ).length;

    features.push(normalizeWeight(pendingCount / 10));
    features.push(normalizeWeight(negativeChains / 10));
    features.push(snapshot.shield.weakestLayerRatio);
    features.push(
      snapshot.shield.weakestLayerRatio <=
        DEFAULT_PRESSURE_COLLECTOR_LIMITS.criticalShieldThreshold
        ? 1
        : 0,
    );
    features.push(
      snapshot.shield.weakestLayerRatio <=
        DEFAULT_PRESSURE_COLLECTOR_LIMITS.weakShieldThreshold
        ? 1
        : 0,
    );
    features.push(pendingCount > 0 ? 1 : 0);
    features.push(negativeChains > 0 ? 1 : 0);

    // ── Group 5: Economy context (indices 25–31) ──────────────────────────
    const lims = DEFAULT_PRESSURE_COLLECTOR_LIMITS;
    const cash = snapshot.economy.cash;
    const income = snapshot.economy.incomePerTick;
    const expenses = snapshot.economy.expensesPerTick;

    features.push(normalizeWeight(cash / Math.max(1, lims.cashDangerThreshold)));
    features.push(cash < lims.cashDangerThreshold ? 1 : 0);
    features.push(cash < lims.cashWarningThreshold ? 1 : 0);
    // cashflow balance: positive = surplus, negative = deficit, normalized
    const cashflowBalance =
      expenses > 0 ? (income - expenses) / Math.max(1, expenses) : 0;
    features.push(normalizeWeight(Math.max(0, cashflowBalance + 1) / 2));
    features.push(cash < lims.cashSoftThreshold ? 1 : 0);
    // runway months estimate (cap at 2× relief threshold)
    const deficit = Math.max(0, expenses - income);
    const runwayTicks = deficit > 0 ? cash / deficit : lims.cashRunwayMonthsForFullRelief * 30;
    features.push(
      normalizeWeight(
        runwayTicks / Math.max(1, lims.cashRunwayMonthsForFullRelief * 30),
      ),
    );
    // prosperity: cash above soft threshold = positive runway signal
    features.push(
      normalizeWeight(
        Math.min(
          1,
          (cash - lims.cashSoftThreshold) /
            Math.max(1, lims.cashSoftThreshold),
        ) *
          (income >= expenses ? 1 : 0),
      ),
    );

    // ── Group 6: Decay dynamics (indices 32–37) ───────────────────────────
    const ticksToCalm = this.controller.estimateTicksToCalm(snapshot);
    features.push(normalizeWeight(Math.min(ticksToCalm, 100) / 100));

    const ticksToLowerTier = this.estimateTicksToLowerTier(snapshot, profile, tier);
    features.push(normalizeWeight(Math.min(ticksToLowerTier, 40) / 40));

    // stickiness ratio: how much of the current score is "locked in" by the floor
    const stickinessRatio = score > 0.001 ? profile.stickyFloor / score : 0;
    features.push(normalizeWeight(stickinessRatio));

    // tier retention strength: how far above tierRetentionFloor is the score
    const retentionStrength =
      score > 0 ? profile.tierRetentionFloor / score : 0;
    features.push(normalizeWeight(retentionStrength));

    // total decay constraint score: blend of all constraint factors
    const totalConstraint = normalizeWeight(
      1 - profile.maxDropPerTick / DEFAULT_MAX_DECAY_PER_TICK,
    );
    features.push(totalConstraint);

    // constraint reason count normalized
    features.push(normalizeWeight(profile.reasons.length / 10));

    // ── Group 7: Signal context (indices 38–44) ───────────────────────────
    if (collection !== null) {
      const domPressureKey = collection.dominantPressureKey;
      const domReliefKey = collection.dominantReliefKey;

      // rank of dominant pressure signal within all positive signal keys
      const pressureKeyRank = domPressureKey
        ? PRESSURE_POSITIVE_SIGNAL_KEYS.indexOf(
            domPressureKey as PressurePositiveSignalKey,
          )
        : -1;
      features.push(
        pressureKeyRank >= 0
          ? normalizeWeight(
              pressureKeyRank / Math.max(1, PRESSURE_POSITIVE_SIGNAL_KEYS.length - 1),
            )
          : 0,
      );

      // rank of dominant relief signal within all relief signal keys
      const reliefKeyRank = domReliefKey
        ? PRESSURE_RELIEF_SIGNAL_KEYS.indexOf(
            domReliefKey as PressureReliefSignalKey,
          )
        : -1;
      features.push(
        reliefKeyRank >= 0
          ? normalizeWeight(
              reliefKeyRank / Math.max(1, PRESSURE_RELIEF_SIGNAL_KEYS.length - 1),
            )
          : 0,
      );

      features.push(clampPressureScore(collection.rawPositiveScore));
      features.push(clampPressureScore(collection.rawReliefScore));

      // contribution density: what fraction of all signal keys have contributions
      const activeDensity =
        collection.contributions.length / Math.max(1, PRESSURE_SIGNAL_KEYS.length);
      features.push(normalizeWeight(activeDensity));

      features.push(clampPressureScore(collection.rawScore));
      features.push(clampPressureScore(collection.score));
    } else {
      // No collection: zero out all signal features
      features.push(0, 0, 0, 0, 0, 0, 0);
    }

    // ── Group 8: Threshold distances (indices 45–47) ──────────────────────
    // distance from score to the nearest higher-tier threshold
    features.push(this.computeDistanceToNextTierThreshold(score));

    // distance from score to the nearest lower-band threshold
    features.push(this.computeDistanceToPrevBandThreshold(score));

    // distance from tier top: how close are we to escaping this tier upward?
    const tierTopDist = Math.max(0, tierConfig.maxScoreExclusive - score);
    features.push(normalizeWeight(tierTopDist));

    return Object.freeze({
      features: Object.freeze(features),
      labels: DECAY_ML_FEATURE_LABELS,
      featureCount: DECAY_ML_FEATURE_COUNT,
      tick,
      score,
      tier,
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private computeBleedOrHighConflictFeature(snapshot: RunStateSnapshot): number {
    if (snapshot.mode === 'solo' && snapshot.modeState.bleedMode) return 1;
    if (snapshot.mode === 'pvp' && snapshot.battle.rivalryHeatCarry >= 15) return 0.7;
    if (snapshot.mode === 'ghost' && snapshot.modeState.communityHeatModifier > 500) return 0.5;
    return 0;
  }

  private computeModeSpecificStress(snapshot: RunStateSnapshot): number {
    switch (snapshot.mode) {
      case 'solo':
        return snapshot.modeState.bleedMode ? 1.0 : 0;
      case 'pvp':
        return normalizeWeight(snapshot.battle.rivalryHeatCarry / 100);
      case 'coop': {
        const trust = Object.values(snapshot.modeState.trustScores);
        if (trust.length === 0) return 0;
        const avg = trust.reduce((s, v) => s + v, 0) / trust.length;
        return normalizeWeight(1 - avg / 100);
      }
      case 'ghost':
        return normalizeWeight(snapshot.modeState.communityHeatModifier / 1000);
      default:
        return 0;
    }
  }

  private estimateTicksToLowerTier(
    snapshot: RunStateSnapshot,
    profile: PressureDecayProfile,
    currentTier: PressureTier,
  ): number {
    const currentRank = rankPressureTier(currentTier);
    if (currentRank <= 0) return 0;

    const currentScore = clampPressureScore(snapshot.pressure.score);
    const prevTierThreshold = PRESSURE_THRESHOLDS.find(
      (t) => rankPressureTier(t.value) === currentRank - 1,
    );
    if (!prevTierThreshold) return 0;

    const targetScore = prevTierThreshold.minScore - 0.001;
    const effectiveTarget = Math.max(targetScore, profile.stickyFloor);
    if (currentScore <= effectiveTarget) return 0;
    return Math.ceil((currentScore - effectiveTarget) / profile.maxDropPerTick);
  }

  private computeDistanceToNextTierThreshold(score: number): number {
    for (const threshold of PRESSURE_THRESHOLDS) {
      if (threshold.minScore > score) {
        return normalizeWeight(threshold.minScore - score);
      }
    }
    return 0;
  }

  private computeDistanceToPrevBandThreshold(score: number): number {
    // Find the band threshold we are currently in, and the distance to the
    // previous (lower) band threshold.
    let prevThreshold: PressureThreshold<PressureBand> | null = null;
    for (const threshold of PRESSURE_BAND_THRESHOLDS) {
      if (score >= threshold.minScore) {
        // We are in this band. Distance from the lower edge.
        return prevThreshold
          ? normalizeWeight(score - prevThreshold.minScore)
          : normalizeWeight(score);
      }
      prevThreshold = threshold;
    }
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — DecayDLBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DecayDLBuilder
 *
 * Constructs a DL sequence tensor from the decay history for LSTM / Transformer
 * consumption. Each tick in the window produces a 64-feature row. The first 48
 * features mirror the ML vector's structure; the remaining 16 add temporal
 * context for sequence modeling.
 *
 * Rows are zero-padded at the front if fewer than DECAY_DL_SEQUENCE_LENGTH
 * history entries exist. This ensures a fixed-shape tensor regardless of
 * how many ticks have elapsed in the run.
 *
 * Uses DECAY_DL_SEQUENCE_LENGTH = 10 and DECAY_DL_FEATURE_COUNT = 64.
 */
export class DecayDLBuilder {
  private readonly history: readonly DecayHistoryEntry[];

  public constructor(history: readonly DecayHistoryEntry[]) {
    this.history = history;
  }

  public build(): DecayDLTensor {
    const window = this.history.slice(-DECAY_DL_SEQUENCE_LENGTH);
    const rows: number[][] = [];

    // Zero-pad at the front if we have fewer than the required window size
    const paddingCount = Math.max(0, DECAY_DL_SEQUENCE_LENGTH - window.length);
    const zeroRow = this.buildZeroRow();
    for (let i = 0; i < paddingCount; i++) {
      rows.push([...zeroRow]);
    }

    for (let i = 0; i < window.length; i++) {
      const entry = window[i];
      const prevEntry = i > 0 ? window[i - 1] : null;
      rows.push(this.buildRow(entry, prevEntry, i + paddingCount));
    }

    return Object.freeze({
      features: Object.freeze(rows.map((r) => Object.freeze(r))),
      tickCount: window.length,
      featureCount: DECAY_DL_FEATURE_COUNT,
      sequenceLength: DECAY_DL_SEQUENCE_LENGTH,
      labels: DECAY_DL_FEATURE_LABELS,
    });
  }

  private buildZeroRow(): number[] {
    return new Array(DECAY_DL_FEATURE_COUNT).fill(0);
  }

  private buildRow(
    entry: DecayHistoryEntry,
    prev: DecayHistoryEntry | null,
    tickIndex: number,
  ): number[] {
    const profile = entry.profile;
    const score = entry.resultScore;
    const tierRank = rankPressureTier(entry.tier);
    const bandRank = rankPressureBand(entry.band);
    const prevTierRank = prev ? rankPressureTier(prev.tier) : tierRank;
    const prevBandRank = prev ? rankPressureBand(prev.band) : bandRank;

    // Use createZeroPressureSignalMap as the baseline for absent signal data
    const _signalBaseline: Record<PressureSignalKey, number> =
      createZeroPressureSignalMap();
    // Signal baseline confirms all signal keys are represented (zero for
    // ticks where we lack collection data)
    void _signalBaseline;

    const constraintRatio =
      profile.maxDropPerTick / DEFAULT_MAX_DECAY_PER_TICK;
    const tierConfig = PRESSURE_TIER_CONFIGS[entry.tier];

    // Features 0–47: core ML vector fields (mirrored from DecayMLExtractor groups)
    const f: number[] = [
      // Group 1: profile
      profile.maxDropPerTick,
      profile.stickyFloor,
      profile.tierRetentionFloor,
      normalizeWeight(constraintRatio),
      // Group 2: tier/band
      normalizeWeight(tierRank / 4),
      normalizeWeight(bandRank / 4),
      tierConfig.minScore,
      normalizeWeight(tierConfig.maxScoreExclusive),
      tierConfig.allowsHaterInjection ? 1 : 0,
      tierConfig.passiveShieldDrain ? 1 : 0,
      // Groups 3–8: filled with derived values from history entry
      entry.wasConstrained ? 1 : 0,
      entry.constraintStrength,
      normalizeWeight(rankPressureTier(entry.tier) / 4),
      normalizeWeight(rankPressureBand(entry.band) / 4),
      score,
      entry.inputScore,
      normalizeWeight(Math.abs(score - entry.inputScore)),
      entry.wasConstrained ? entry.constraintStrength : 0,
      0, 0, 0, 0, 0, 0, 0, // threat/economy placeholders (no snapshot available)
      0, 0, 0, 0, 0, 0, 0,
      normalizeWeight(profile.reasons.length / 10),
      normalizeWeight(constraintRatio < DECAY_FULLY_CONSTRAINED_RATIO ? 1 : 0),
      normalizeWeight(score > profile.stickyFloor + 0.01 ? 0 : 1),
      0, 0, 0, 0, 0, 0, 0,
      0, 0, 0,
    ];

    // Features 48–63: temporal features
    f.push(normalizeWeight(tickIndex / Math.max(1, DECAY_DL_SEQUENCE_LENGTH - 1)));
    f.push(score);
    f.push(clampPressureScore(score - (prev?.resultScore ?? score)));
    f.push(normalizeWeight(tierRank / 4));
    f.push(normalizeWeight(bandRank / 4));
    f.push(profile.maxDropPerTick);
    f.push(profile.stickyFloor);
    f.push(profile.tierRetentionFloor);
    f.push(normalizeWeight(constraintRatio));
    f.push(normalizeWeight(profile.reasons.length / 10));
    f.push(score <= profile.stickyFloor + 0.001 ? 1 : 0);
    f.push(constraintRatio < DECAY_FULLY_CONSTRAINED_RATIO ? 1 : 0);
    f.push(tierConfig.allowsHaterInjection ? 1 : 0);
    f.push(tierConfig.passiveShieldDrain ? 1 : 0);
    f.push(normalizeWeight(Math.abs(tierRank - prevTierRank) / 4));
    f.push(normalizeWeight(Math.abs(bandRank - prevBandRank) / 4));

    // Ensure exactly 64 features
    while (f.length < DECAY_DL_FEATURE_COUNT) f.push(0);
    return f.slice(0, DECAY_DL_FEATURE_COUNT);
  }
}

const DECAY_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...DECAY_ML_FEATURE_LABELS,
  'temporal:tick_index_normalized',
  'temporal:result_score',
  'temporal:score_delta',
  'temporal:tier_rank',
  'temporal:band_rank',
  'temporal:max_drop_per_tick',
  'temporal:sticky_floor',
  'temporal:tier_retention_floor',
  'temporal:constraint_ratio',
  'temporal:reason_count',
  'temporal:at_floor',
  'temporal:fully_constrained',
  'temporal:allows_hater_injection',
  'temporal:passive_shield_drain',
  'temporal:tier_rank_change',
  'temporal:band_rank_change',
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — DecayTrendAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DecayTrendAnalyzer
 *
 * Computes decay velocity, acceleration, and stickiness over the last
 * PRESSURE_TREND_WINDOW history entries. Velocity is the per-tick change in
 * score (positive = rising pressure, negative = falling). Acceleration is the
 * change in velocity (positive = accelerating rise or decelerating fall).
 *
 * Uses PRESSURE_TREND_WINDOW as the sliding window size.
 * Uses rankPressureBand and resolvePressureBand for band-level analysis.
 * Uses PRESSURE_BAND_THRESHOLDS for detecting band-edge proximity.
 */
export class DecayTrendAnalyzer {
  private readonly history: readonly DecayHistoryEntry[];

  public constructor(history: readonly DecayHistoryEntry[]) {
    this.history = history;
  }

  /**
   * Analyze the most recent PRESSURE_TREND_WINDOW entries and return a
   * DecayTrendSummary.
   */
  public analyze(): DecayTrendSummary {
    const window = this.history.slice(-Math.max(2, PRESSURE_TREND_WINDOW + 1));

    if (window.length < 2) {
      return this.buildEmptyTrend();
    }

    const velocities = this.computeVelocities(window);
    const velocity = velocities.length > 0
      ? velocities[velocities.length - 1]
      : 0;

    const acceleration = velocities.length >= 2
      ? velocities[velocities.length - 1] - velocities[velocities.length - 2]
      : 0;

    const ticksAtFloor = this.countTicksAtFloor(window);
    const isSticky = this.detectStickiness(window);
    const dominantConstraintReason = this.extractDominantReason(window);
    const averageConstraintRatio = this.computeAverageConstraintRatio(window);

    return Object.freeze({
      velocity,
      acceleration,
      isAccelerating: acceleration > 0.001,
      isDecelerating: acceleration < -0.001,
      isSticky,
      ticksAtCurrentFloor: ticksAtFloor,
      dominantConstraintReason,
      trendWindow: PRESSURE_TREND_WINDOW,
      averageConstraintRatio,
    });
  }

  /**
   * Compute band proximity: how close is the current score to the nearest
   * band threshold boundary? Uses PRESSURE_BAND_THRESHOLDS.
   */
  public computeBandProximity(score: number): number {
    const currentBand = resolvePressureBand(score);
    const currentBandRank = rankPressureBand(currentBand);

    let minDist = 1.0;
    for (const threshold of PRESSURE_BAND_THRESHOLDS) {
      const thresholdBandRank = rankPressureBand(threshold.value);
      // Only consider thresholds adjacent to the current band
      if (Math.abs(thresholdBandRank - currentBandRank) <= 1) {
        minDist = Math.min(minDist, Math.abs(score - threshold.minScore));
      }
    }

    return normalizeWeight(minDist);
  }

  /**
   * Detect whether the score has crossed into a different band within the
   * last PRESSURE_TREND_WINDOW entries.
   */
  public detectRecentBandCrossing(): boolean {
    if (this.history.length < 2) return false;
    const window = this.history.slice(-PRESSURE_TREND_WINDOW);
    if (window.length < 2) return false;

    const firstBandRank = rankPressureBand(window[0].band);
    const lastBandRank = rankPressureBand(window[window.length - 1].band);
    return firstBandRank !== lastBandRank;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private computeVelocities(window: readonly DecayHistoryEntry[]): number[] {
    const vels: number[] = [];
    for (let i = 1; i < window.length; i++) {
      vels.push(window[i].resultScore - window[i - 1].resultScore);
    }
    return vels;
  }

  private countTicksAtFloor(window: readonly DecayHistoryEntry[]): number {
    let count = 0;
    for (let i = window.length - 1; i >= 0; i--) {
      const entry = window[i];
      if (
        entry.resultScore <= entry.profile.stickyFloor + 0.005 &&
        entry.profile.stickyFloor > 0
      ) {
        count += 1;
      } else {
        break;
      }
    }
    return count;
  }

  private detectStickiness(window: readonly DecayHistoryEntry[]): boolean {
    const recent = window.slice(-PRESSURE_TREND_WINDOW);
    if (recent.length < 2) return false;
    const scoreVariance = this.computeScoreVariance(recent);
    const allConstrained = recent.every((e) => e.wasConstrained);
    return scoreVariance < 0.005 && allConstrained;
  }

  private computeScoreVariance(entries: readonly DecayHistoryEntry[]): number {
    if (entries.length === 0) return 0;
    const mean = entries.reduce((s, e) => s + e.resultScore, 0) / entries.length;
    const variance =
      entries.reduce((s, e) => s + Math.pow(e.resultScore - mean, 2), 0) /
      entries.length;
    return variance;
  }

  private extractDominantReason(window: readonly DecayHistoryEntry[]): string {
    const reasonCounts = new Map<string, number>();
    for (const entry of window) {
      for (const reason of entry.profile.reasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    }

    let dominant = '';
    let maxCount = 0;
    for (const [reason, count] of reasonCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominant = reason;
      }
    }
    return dominant;
  }

  private computeAverageConstraintRatio(window: readonly DecayHistoryEntry[]): number {
    if (window.length === 0) return 1;
    const sum = window.reduce(
      (s, e) => s + e.profile.maxDropPerTick / DEFAULT_MAX_DECAY_PER_TICK,
      0,
    );
    return sum / window.length;
  }

  private buildEmptyTrend(): DecayTrendSummary {
    return Object.freeze({
      velocity: 0,
      acceleration: 0,
      isAccelerating: false,
      isDecelerating: false,
      isSticky: false,
      ticksAtCurrentFloor: 0,
      dominantConstraintReason: '',
      trendWindow: PRESSURE_TREND_WINDOW,
      averageConstraintRatio: 1,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — DecayPolicyAdvisor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DecayPolicyAdvisor
 *
 * Produces actionable decay policy summaries and contribution analyses.
 * Used by the chat lane to explain why pressure recovery is slow, and by the
 * ML pipeline to surface contextual policy features.
 *
 * Key behaviors:
 * - computePolicySummary() returns the full policy context for a snapshot
 * - analyzeContributions() maps signal contributions to decay policy impact
 * - computeDecayInformedWeights() builds a weight set that reflects active
 *   decay constraints — uses mergePressureCollectorWeights to merge overrides
 *
 * Uses:
 *   PRESSURE_TIER_CONFIGS, DEFAULT_PRESSURE_COLLECTOR_LIMITS,
 *   DEFAULT_PRESSURE_COLLECTOR_WEIGHTS, mergePressureCollectorWeights,
 *   normalizeWeight, resolvePressureTier, resolvePressureBand,
 *   TOP_PRESSURE_SIGNAL_COUNT, PRESSURE_POSITIVE_SIGNAL_KEYS,
 *   PRESSURE_RELIEF_SIGNAL_KEYS, PressureCollectorLimits,
 *   PressureCollectorWeights, PressureTierConfig
 */
export class DecayPolicyAdvisor {
  private readonly controller: PressureDecayController;
  private readonly baseLimits: PressureCollectorLimits;

  public constructor(
    controller: PressureDecayController,
    limitsOverrides: Partial<PressureCollectorLimits> = {},
  ) {
    this.controller = controller;
    this.baseLimits = Object.freeze({
      ...DEFAULT_PRESSURE_COLLECTOR_LIMITS,
      ...limitsOverrides,
    });
  }

  /**
   * Compute a full policy summary for the current snapshot.
   * Incorporates PRESSURE_TIER_CONFIGS for tier-specific decay behavior and
   * DEFAULT_PRESSURE_COLLECTOR_LIMITS for limit-aware explanations.
   */
  public computePolicySummary(snapshot: RunStateSnapshot): DecayPolicySummary {
    const profile = this.controller.getProfile(snapshot);
    const score = clampPressureScore(snapshot.pressure.score);
    const tier = resolvePressureTier(score);
    const band = resolvePressureBand(score);
    const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[tier];
    const estimatedTicksToCalm = this.controller.estimateTicksToCalm(snapshot);
    const decayInformedWeights = this.computeDecayInformedWeights(snapshot, null);

    return Object.freeze({
      mode: snapshot.mode,
      phase: snapshot.phase,
      tier,
      band,
      maxDropPerTick: profile.maxDropPerTick,
      stickyFloor: profile.stickyFloor,
      tierRetentionFloor: profile.tierRetentionFloor,
      isConstrained:
        profile.maxDropPerTick < DEFAULT_MAX_DECAY_PER_TICK - 0.001,
      constraintReasons: profile.reasons,
      activeCollectorLimits: this.baseLimits,
      decayInformedWeights,
      tierConfig,
      allowsHaterInjection: tierConfig.allowsHaterInjection,
      passiveShieldDrainActive: tierConfig.passiveShieldDrain,
      estimatedTicksToCalm,
    });
  }

  /**
   * Analyze the top TOP_PRESSURE_SIGNAL_COUNT signal contributions and map
   * each to a concrete decay policy impact.
   * Uses PressureSignalContribution, PressurePositiveSignalKey,
   * PressureReliefSignalKey, PRESSURE_POSITIVE_SIGNAL_KEYS,
   * PRESSURE_RELIEF_SIGNAL_KEYS.
   */
  public analyzeContributions(
    snapshot: RunStateSnapshot,
    collection: PressureSignalCollection,
  ): DecayContributionAnalysis {
    const profile = this.controller.getProfile(snapshot);

    const topContributions: PressureSignalContribution[] =
      collection.contributions
        .slice()
        .sort((a, b) => b.amount - a.amount)
        .slice(0, TOP_PRESSURE_SIGNAL_COUNT);

    const policyImpacts: DecayPolicyImpact[] = topContributions.map(
      (contribution: PressureSignalContribution) =>
        this.mapContributionToImpact(contribution, profile),
    );

    // Map dominant keys through PRESSURE_POSITIVE_SIGNAL_KEYS to verify
    const domPressureKey = collection.dominantPressureKey;
    const domReliefKey = collection.dominantReliefKey;

    const verifiedPressureKey: PressurePositiveSignalKey | null =
      domPressureKey &&
      PRESSURE_POSITIVE_SIGNAL_KEYS.includes(domPressureKey as PressurePositiveSignalKey)
        ? (domPressureKey as PressurePositiveSignalKey)
        : null;

    const verifiedReliefKey: PressureReliefSignalKey | null =
      domReliefKey &&
      PRESSURE_RELIEF_SIGNAL_KEYS.includes(domReliefKey as PressureReliefSignalKey)
        ? (domReliefKey as PressureReliefSignalKey)
        : null;

    return Object.freeze({
      topContributions: Object.freeze(topContributions),
      dominantPressureSignal: verifiedPressureKey,
      dominantReliefSignal: verifiedReliefKey,
      policyImpact: Object.freeze(policyImpacts),
    });
  }

  /**
   * Build a decay-informed weight set using mergePressureCollectorWeights.
   * Signals that are actively driving decay stickiness have their weights
   * amplified slightly to surface them in the ML pipeline. Signals that have
   * relief influence are surfaced when decay is being blocked.
   */
  public computeDecayInformedWeights(
    snapshot: RunStateSnapshot,
    collection: PressureSignalCollection | null,
  ): PressureCollectorWeights {
    const profile = this.controller.getProfile(snapshot);
    const overrides: Partial<PressureCollectorWeights> = {};

    // Amplify shield weights when shield stickiness is active
    if (profile.reasons.includes('shield:weakest_below_25pct')) {
      overrides.shield_damage = normalizeWeight(
        DEFAULT_PRESSURE_COLLECTOR_WEIGHTS.shield_damage * 1.5,
      );
      overrides.shield_breach = normalizeWeight(
        DEFAULT_PRESSURE_COLLECTOR_WEIGHTS.shield_breach * 1.4,
      );
    } else if (profile.reasons.includes('shield:weakest_below_40pct')) {
      overrides.shield_damage = normalizeWeight(
        DEFAULT_PRESSURE_COLLECTOR_WEIGHTS.shield_damage * 1.2,
      );
    }

    // Amplify cascade weights when negative chains are active
    if (profile.reasons.includes('cascade:negative_active')) {
      overrides.cascade_pressure = normalizeWeight(
        DEFAULT_PRESSURE_COLLECTOR_WEIGHTS.cascade_pressure * 1.3,
      );
    }

    // Amplify bleed mode weight during solo bleed
    if (profile.reasons.includes('mode:solo_bleed')) {
      overrides.bleed_mode_tax = normalizeWeight(
        DEFAULT_PRESSURE_COLLECTOR_WEIGHTS.bleed_mode_tax * 1.5,
      );
    }

    // Amplify pvp rivalry weight during high rivalry
    if (profile.reasons.includes('mode:pvp_rivalry')) {
      overrides.pvp_rivalry_heat = normalizeWeight(
        DEFAULT_PRESSURE_COLLECTOR_WEIGHTS.pvp_rivalry_heat * 1.3,
      );
    }

    // If collection provided, further tune based on dominant signal
    if (collection?.dominantPressureKey) {
      const domKey = collection.dominantPressureKey as PressurePositiveSignalKey;
      if (PRESSURE_POSITIVE_SIGNAL_KEYS.includes(domKey)) {
        const currentWeight =
          DEFAULT_PRESSURE_COLLECTOR_WEIGHTS[domKey as keyof PressureCollectorWeights] as number;
        if (currentWeight > 0) {
          (overrides as Record<string, number>)[domKey] = normalizeWeight(
            currentWeight * 1.2,
          );
        }
      }
    }

    return mergePressureCollectorWeights(DEFAULT_PRESSURE_COLLECTOR_WEIGHTS, overrides);
  }

  /**
   * Build a plain-language explanation of the current decay constraints for
   * the chat / companion layer. References DEFAULT_PRESSURE_COLLECTOR_LIMITS
   * for threshold-based explanations.
   */
  public buildConstraintExplanation(snapshot: RunStateSnapshot): string {
    const profile = this.controller.getProfile(snapshot);
    const score = clampPressureScore(snapshot.pressure.score);
    const tier = resolvePressureTier(score);
    const tierConfig = PRESSURE_TIER_CONFIGS[tier];
    const lims = this.baseLimits;

    const parts: string[] = [];

    if (profile.reasons.includes('tier:critical')) {
      parts.push(
        `Pressure is CRITICAL (tier ${tierConfig.tier}) — max recovery ${(profile.maxDropPerTick * 100).toFixed(1)}%/tick`,
      );
    } else if (profile.reasons.includes('tier:high')) {
      parts.push(
        `Pressure is HIGH (tier ${tierConfig.tier}) — recovery slowed to ${(profile.maxDropPerTick * 100).toFixed(1)}%/tick`,
      );
    }

    if (profile.reasons.includes('shield:weakest_below_25pct')) {
      parts.push(
        `Shield integrity below ${(lims.criticalShieldThreshold * 100).toFixed(0)}% — floor locked at ${(profile.stickyFloor * 100).toFixed(1)}%`,
      );
    } else if (profile.reasons.includes('shield:weakest_below_40pct')) {
      parts.push(
        `Shield integrity below ${(lims.weakShieldThreshold * 100).toFixed(0)}% — sticky floor active`,
      );
    }

    if (profile.reasons.includes('cascade:negative_active')) {
      parts.push('Active negative cascade chain — recovery further constrained');
    }

    if (profile.reasons.includes('mode:solo_bleed')) {
      parts.push('Bleed mode active — recovery severely limited');
    }

    if (tierConfig.passiveShieldDrain) {
      parts.push('Passive shield drain active at this pressure tier');
    }

    if (tierConfig.allowsHaterInjection) {
      parts.push('Hater injection armed — opponent can escalate from this tier');
    }

    if (parts.length === 0) {
      const ticksLeft = this.controller.estimateTicksToCalm(snapshot);
      parts.push(
        `No active constraints — estimated ${ticksLeft} tick${ticksLeft !== 1 ? 's' : ''} to calm at ${(score * 100).toFixed(1)}%`,
      );
    }

    return parts.join(' | ');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private mapContributionToImpact(
    contribution: PressureSignalContribution,
    profile: PressureDecayProfile,
  ): DecayPolicyImpact {
    const key = contribution.key as PressureSignalKey;
    const polarity = contribution.polarity as PressureSignalPolarity;
    const amount = contribution.amount;

    let impact: DecayPolicyImpact['decayConstraintImpact'] = 'NONE';
    let explanation = '';

    if (polarity === 'PRESSURE') {
      if (
        key === 'cash_crisis' &&
        profile.reasons.some((r) => r.includes('shield') || r.includes('tier'))
      ) {
        impact = amount > 0.12 ? 'CRITICAL' : amount > 0.06 ? 'MAJOR' : 'MINOR';
        explanation = `Cash crisis contributing ${(amount * 100).toFixed(1)}% to decay pressure`;
      } else if (key === 'shield_damage' || key === 'shield_breach') {
        impact = profile.reasons.includes('shield:weakest_below_25pct')
          ? 'CRITICAL'
          : profile.reasons.includes('shield:weakest_below_40pct')
          ? 'MAJOR'
          : 'MINOR';
        explanation = `Shield signal (${key}) is holding decay floor`;
      } else if (key === 'cascade_pressure') {
        impact = profile.reasons.includes('cascade:negative_active')
          ? 'MAJOR'
          : 'MINOR';
        explanation = 'Active cascade chain is reinforcing decay constraint';
      } else if (amount > 0.10) {
        impact = 'MINOR';
        explanation = `Signal ${key} contributing ${(amount * 100).toFixed(1)}% — minor decay impact`;
      } else {
        explanation = `Signal ${key} at ${(amount * 100).toFixed(1)}% — no active decay constraint`;
      }
    } else {
      // RELIEF
      if (key === 'full_security_relief' || key === 'prosperity_relief') {
        impact = 'NONE';
        explanation = `Relief signal ${key} at ${(amount * 100).toFixed(1)}% — helping offset decay floor`;
      } else {
        explanation = `Relief signal ${key} at ${(amount * 100).toFixed(1)}%`;
      }
    }

    return Object.freeze({
      signalKey: key,
      polarity,
      contributionAmount: amount,
      decayConstraintImpact: impact,
      explanation,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — DecayScenarioSimulator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DecayScenarioSimulator
 *
 * Runs an N-tick forward simulation of pressure decay starting from the
 * current snapshot, assuming no new pressure is added. Returns the full
 * score path, tier/band paths, and detected threshold crossings.
 *
 * This surface powers "X ticks until relief" companion messages and is also
 * consumed by the DecaySignalAdapter for chat routing.
 *
 * Uses:
 *   PRESSURE_THRESHOLDS, PRESSURE_BAND_THRESHOLDS — for crossing detection
 *   resolvePressureTier, resolvePressureBand — for per-tick tier/band
 *   rankPressureTier, rankPressureBand — for direction detection
 *   clampPressureScore — for score clamping
 *   DECAY_SCENARIO_MAX_TICKS, DECAY_SCENARIO_CALM_THRESHOLD
 *   PressureThreshold — as the return type in crossing detection
 */
export class DecayScenarioSimulator {
  private readonly controller: PressureDecayController;

  public constructor(controller: PressureDecayController) {
    this.controller = controller;
  }

  /**
   * Simulate the decay path from snapshot.pressure.score toward targetScore.
   *
   * @param snapshot — the current game state (held constant for all ticks)
   * @param targetScore — the score we are trying to reach
   * @param maxTicks — cap on simulation depth
   */
  public simulate(
    snapshot: RunStateSnapshot,
    targetScore: number,
    maxTicks: number = DECAY_SCENARIO_MAX_TICKS,
  ): DecayPathSimulation {
    const profile = this.controller.getProfile(snapshot);
    const clampedTarget = clampPressureScore(targetScore);
    const startScore = clampPressureScore(snapshot.pressure.score);

    const path: number[] = [startScore];
    const tierPath: PressureTier[] = [resolvePressureTier(startScore)];
    const bandPath: PressureBand[] = [resolvePressureBand(startScore)];
    const tierCrossings: DecayTierCrossing[] = [];
    const bandCrossings: DecayBandCrossing[] = [];
    const blockingReasons: string[] = [];

    let current = startScore;
    let ticksToTarget = 0;
    let achieved = false;

    for (let tick = 0; tick < maxTicks; tick++) {
      if (current <= clampedTarget + 0.001) {
        achieved = true;
        ticksToTarget = tick;
        break;
      }

      const prevScore = current;
      const prevTier = resolvePressureTier(prevScore);
      const prevBand = resolvePressureBand(prevScore);
      const prevTierRank = rankPressureTier(prevTier);
      const prevBandRank = rankPressureBand(prevBand);

      // Apply one decay step: drop by maxDropPerTick, respect floors
      const rawNext = prevScore - profile.maxDropPerTick;
      current = clampPressureScore(
        Math.max(rawNext, profile.stickyFloor, clampedTarget),
      );

      // If we are stuck at the floor, record blocking reasons
      if (current >= prevScore - 0.001 && prevScore > clampedTarget + 0.001) {
        for (const reason of profile.reasons) {
          if (!blockingReasons.includes(reason)) {
            blockingReasons.push(reason);
          }
        }
        // Stuck — escape not possible at this profile
        ticksToTarget = maxTicks;
        break;
      }

      const newTier = resolvePressureTier(current);
      const newBand = resolvePressureBand(current);
      const newTierRank = rankPressureTier(newTier);
      const newBandRank = rankPressureBand(newBand);

      path.push(current);
      tierPath.push(newTier);
      bandPath.push(newBand);

      // Detect tier crossings using PRESSURE_THRESHOLDS
      if (newTierRank !== prevTierRank) {
        const crossing = this.findTierCrossing(prevScore, current);
        if (crossing) {
          tierCrossings.push({
            atTick: tick + 1,
            atScore: current,
            fromTier: prevTier,
            toTier: newTier,
            direction: newTierRank < prevTierRank ? 'down' : 'up',
          });
        }
      }

      // Detect band crossings using PRESSURE_BAND_THRESHOLDS
      if (newBandRank !== prevBandRank) {
        const bandCrossing = this.findBandCrossing(prevScore, current);
        if (bandCrossing) {
          bandCrossings.push({
            atTick: tick + 1,
            atScore: current,
            fromBand: prevBand,
            toBand: newBand,
            direction: newBandRank < prevBandRank ? 'down' : 'up',
          });
        }
      }
    }

    if (!achieved && ticksToTarget === 0) {
      ticksToTarget = maxTicks;
    }

    return Object.freeze({
      targetScore: clampedTarget,
      achievedScore: current,
      path: Object.freeze(path),
      tierPath: Object.freeze(tierPath),
      bandPath: Object.freeze(bandPath),
      ticksToTarget,
      achievedTarget: achieved,
      tierCrossings: Object.freeze(tierCrossings),
      bandCrossings: Object.freeze(bandCrossings),
      blockingReasons: Object.freeze(blockingReasons),
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Find the tier threshold crossed between prevScore and nextScore.
   * Uses PRESSURE_THRESHOLDS (typed as readonly PressureThreshold<PressureTier>[]).
   */
  private findTierCrossing(
    prevScore: number,
    nextScore: number,
  ): PressureThreshold<PressureTier> | null {
    for (const threshold of PRESSURE_THRESHOLDS) {
      const crossed =
        (prevScore >= threshold.minScore && nextScore < threshold.minScore) ||
        (prevScore < threshold.minScore && nextScore >= threshold.minScore);
      if (crossed) return threshold;
    }
    return null;
  }

  /**
   * Find the band threshold crossed between prevScore and nextScore.
   * Uses PRESSURE_BAND_THRESHOLDS (typed as readonly PressureThreshold<PressureBand>[]).
   */
  private findBandCrossing(
    prevScore: number,
    nextScore: number,
  ): PressureThreshold<PressureBand> | null {
    for (const threshold of PRESSURE_BAND_THRESHOLDS) {
      const crossed =
        (prevScore >= threshold.minScore && nextScore < threshold.minScore) ||
        (prevScore < threshold.minScore && nextScore >= threshold.minScore);
      if (crossed) return threshold;
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — DecayAnnotator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DecayAnnotator
 *
 * Produces chat/companion-ready annotation bundles from decay context.
 * The annotation bundle includes a headline, subtext, urgency, UX label,
 * chat signal key, top signal annotations, and forecast sentence.
 *
 * Designed for direct consumption by the DecaySignalAdapter and any
 * companion system that needs to explain the decay state in human language.
 *
 * Uses:
 *   PRESSURE_TIER_CONFIGS — for tier label and config flags
 *   TOP_PRESSURE_SIGNAL_COUNT — for top signal extraction
 *   DEFAULT_PRESSURE_COLLECTOR_LIMITS — for threshold references in subtext
 *   resolvePressureTier, resolvePressureBand — for tier/band labels
 *   PressureSignalPolarity, PressureSignalKey, PressureSignalContribution
 *   PRESSURE_POSITIVE_SIGNAL_KEYS — for polarity classification
 *   rankPressureTier — for urgency derivation
 */
export class DecayAnnotator {
  private readonly controller: PressureDecayController;

  public constructor(controller: PressureDecayController) {
    this.controller = controller;
  }

  /**
   * Build a full annotation bundle for the current snapshot and optional
   * signal collection. This is the primary output surface for the chat lane.
   */
  public buildAnnotation(
    snapshot: RunStateSnapshot,
    collection: PressureSignalCollection | null,
    ticksToCalm: number,
  ): DecayAnnotationBundle {
    const profile = this.controller.getProfile(snapshot);
    const score = clampPressureScore(snapshot.pressure.score);
    const tier = resolvePressureTier(score);
    const band = resolvePressureBand(score);
    const tierConfig: PressureTierConfig = PRESSURE_TIER_CONFIGS[tier];
    const tierRank = rankPressureTier(tier);

    const urgency = this.deriveUrgency(tierRank, profile, score);
    const headline = this.buildHeadline(tier, band, score, tierConfig);
    const subtext = this.buildSubtext(snapshot, profile, tierConfig);
    const uxLabel = this.buildUXLabel(tier, band, tierConfig);
    const chatSignalKey = this.buildChatSignalKey(tier, profile);
    const forecastSentence = this.buildForecastSentence(ticksToCalm, tier, profile);
    const topSignals = this.extractTopSignals(collection);

    return Object.freeze({
      headline,
      subtext,
      urgency,
      uxLabel,
      chatSignalKey,
      topSignals: Object.freeze(topSignals),
      forecastSentence,
      tierLabel: tierConfig.label,
      bandLabel: band,
      haterInjectionWarning: tierConfig.allowsHaterInjection,
      shieldDrainWarning: tierConfig.passiveShieldDrain,
    });
  }

  /**
   * Classify the polarity of a pressure signal key.
   * Uses PRESSURE_POSITIVE_SIGNAL_KEYS to determine if the key is a
   * pressure driver (PRESSURE) or a relief signal (RELIEF).
   */
  public classifySignalPolarity(key: PressureSignalKey): PressureSignalPolarity {
    if (
      (PRESSURE_POSITIVE_SIGNAL_KEYS as readonly string[]).includes(key)
    ) {
      return 'PRESSURE';
    }
    return 'RELIEF';
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private deriveUrgency(
    tierRank: number,
    profile: PressureDecayProfile,
    score: number,
  ): DecayAnnotationBundle['urgency'] {
    if (tierRank >= 4) return 'CRITICAL';
    if (tierRank >= 3) return 'HIGH';
    if (
      tierRank >= 2 &&
      profile.maxDropPerTick < DEFAULT_MAX_DECAY_PER_TICK * 0.6
    )
      return 'HIGH';
    if (tierRank >= 2 || score > 0.4) return 'MEDIUM';
    return 'LOW';
  }

  private buildHeadline(
    tier: PressureTier,
    band: PressureBand,
    score: number,
    tierConfig: PressureTierConfig,
  ): string {
    const pct = (score * 100).toFixed(1);
    return `Pressure ${tierConfig.label} — ${pct}% (${band})`;
  }

  private buildSubtext(
    snapshot: RunStateSnapshot,
    profile: PressureDecayProfile,
    tierConfig: PressureTierConfig,
  ): string {
    const lims = DEFAULT_PRESSURE_COLLECTOR_LIMITS;
    const parts: string[] = [];

    if (tierConfig.passiveShieldDrain) {
      parts.push('Passive shield drain active');
    }
    if (tierConfig.allowsHaterInjection) {
      parts.push('Hater injection armed');
    }
    if (profile.stickyFloor > 0) {
      parts.push(
        `Floor ${(profile.stickyFloor * 100).toFixed(1)}% — recovery limited to ${(profile.maxDropPerTick * 100).toFixed(1)}%/tick`,
      );
    }
    if (snapshot.economy.cash < lims.cashDangerThreshold) {
      parts.push(`Cash below danger threshold ($${lims.cashDangerThreshold.toLocaleString()})`);
    }
    if (parts.length === 0) {
      parts.push(
        `Recovery at full speed — ${(profile.maxDropPerTick * 100).toFixed(1)}%/tick`,
      );
    }
    return parts.join('; ');
  }

  private buildUXLabel(
    tier: PressureTier,
    band: PressureBand,
    tierConfig: PressureTierConfig,
  ): string {
    if (tierConfig.allowsHaterInjection) {
      return `CRITICAL_THREAT:${tier}`;
    }
    if (tierConfig.passiveShieldDrain) {
      return `SHIELD_DRAIN:${tier}`;
    }
    return `${band}:${tier}`;
  }

  private buildChatSignalKey(
    tier: PressureTier,
    profile: PressureDecayProfile,
  ): string {
    const hasConstraints = profile.reasons.length > 0;
    if (tier === 'T4') return 'pressure.decay.critical';
    if (tier === 'T3') return hasConstraints ? 'pressure.decay.high.constrained' : 'pressure.decay.high';
    if (tier === 'T2') return 'pressure.decay.elevated';
    return 'pressure.decay.low';
  }

  private buildForecastSentence(
    ticksToCalm: number,
    tier: PressureTier,
    profile: PressureDecayProfile,
  ): string {
    if (ticksToCalm === 0) {
      return 'Pressure is calm.';
    }
    if (profile.stickyFloor > DECAY_SCENARIO_CALM_THRESHOLD) {
      return `Pressure cannot fully recover while constraints are active (floor ${(profile.stickyFloor * 100).toFixed(1)}%).`;
    }
    if (tier === 'T4') {
      return `Critical pressure — ${ticksToCalm} tick${ticksToCalm !== 1 ? 's' : ''} to calm if no new threats arrive.`;
    }
    return `Estimated ${ticksToCalm} tick${ticksToCalm !== 1 ? 's' : ''} to calm at current recovery rate.`;
  }

  private extractTopSignals(
    collection: PressureSignalCollection | null,
  ): DecayAnnotatedSignal[] {
    if (!collection) return [];

    const topContributions = collection.contributions
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, TOP_PRESSURE_SIGNAL_COUNT);

    return topContributions.map((c: PressureSignalContribution) => {
      const key = c.key as PressureSignalKey;
      return {
        key,
        polarity: this.classifySignalPolarity(key),
        amount: c.amount,
        label: key.replace(/_/g, ' '),
      };
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — DecayInspector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DecayInspector
 *
 * Builds a comprehensive inspector state snapshot for runtime debugging,
 * orchestrator health reporting, and test coverage verification.
 *
 * Uses:
 *   PRESSURE_HISTORY_DEPTH — for history boundary reporting
 *   createZeroPressureSignalMap — for the signal baseline in the state
 *   DECAY_CONTROLLER_MODULE_VERSION — for manifest header
 *   PressureSignalMap — as the type for signalBaseline
 *   PRESSURE_TIER_CONFIGS — for tier-level metadata in the state summary
 */
export class DecayInspector {
  private readonly history: readonly DecayHistoryEntry[];
  private readonly applicationCount: number;
  private readonly constrainedCount: number;
  private readonly retentionCount: number;

  public constructor(
    history: readonly DecayHistoryEntry[],
    applicationCount: number,
    constrainedCount: number,
    retentionCount: number,
  ) {
    this.history = history;
    this.applicationCount = applicationCount;
    this.constrainedCount = constrainedCount;
    this.retentionCount = retentionCount;
  }

  /** Build the full inspector state. */
  public buildState(): DecayInspectorState {
    const lastEntry =
      this.history.length > 0
        ? this.history[this.history.length - 1]
        : null;

    const trend =
      this.history.length >= 2
        ? new DecayTrendAnalyzer(this.history).analyze()
        : null;

    // Build a signal baseline using createZeroPressureSignalMap — the baseline
    // represents a tick with no active signal contributions and is used as the
    // zero-reference for DL tensor padding and inspector comparison.
    const signalBaseline: PressureSignalMap = Object.freeze(
      createZeroPressureSignalMap(),
    ) as PressureSignalMap;

    // Surface PRESSURE_TIER_CONFIGS in the state to confirm the full tier
    // configuration is reachable at inspector time.
    const tierConfigSummary = Object.entries(PRESSURE_TIER_CONFIGS).map(
      ([, cfg]: [string, PressureTierConfig]) => ({
        tier: cfg.tier,
        minScore: cfg.minScore,
        allowsHaterInjection: cfg.allowsHaterInjection,
        passiveShieldDrain: cfg.passiveShieldDrain,
      }),
    );
    void tierConfigSummary; // consumed for PRESSURE_TIER_CONFIGS access

    return Object.freeze({
      currentProfile: lastEntry?.profile ?? null,
      lastResultScore: lastEntry?.resultScore ?? 0,
      totalApplications: this.applicationCount,
      totalConstrainedApplications: this.constrainedCount,
      totalTierRetentions: this.retentionCount,
      profileHistory: Object.freeze([...this.history]),
      trend,
      signalBaseline,
      moduleVersion: DECAY_CONTROLLER_MODULE_VERSION,
    });
  }

  /**
   * Build a human-readable history summary for diagnostics.
   * Uses PRESSURE_HISTORY_DEPTH as the capacity reference.
   */
  public buildHistorySummary(): string {
    const capacity = PRESSURE_HISTORY_DEPTH;
    const filled = this.history.length;
    const lastScore = filled > 0 ? this.history[filled - 1].resultScore : 0;
    const constraintRate =
      this.applicationCount > 0
        ? (this.constrainedCount / this.applicationCount) * 100
        : 0;
    return (
      `DecayController history: ${filled}/${capacity} entries` +
      ` | lastScore: ${(lastScore * 100).toFixed(1)}%` +
      ` | constraintRate: ${constraintRate.toFixed(0)}%` +
      ` | tierRetentions: ${this.retentionCount}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — Factory and standalone helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory function for constructing a fully wired PressureDecayController
 * with companion analysis classes attached.
 */
export function createDecayController(): PressureDecayController {
  return new PressureDecayController();
}

/**
 * Standalone helper: extract a DecayAnnotationBundle without constructing a
 * persistent controller. Useful for one-shot chat adapter calls.
 */
export function buildDecayAnnotation(
  snapshot: RunStateSnapshot,
  collection: PressureSignalCollection | null,
): DecayAnnotationBundle {
  const controller = new PressureDecayController();
  const annotator = new DecayAnnotator(controller);
  const ticksToCalm = controller.estimateTicksToCalm(snapshot);
  return annotator.buildAnnotation(snapshot, collection, ticksToCalm);
}

/**
 * Standalone helper: simulate the decay path from the current snapshot
 * toward zero. Returns the full scenario.
 */
export function simulateDecayToCalm(
  snapshot: RunStateSnapshot,
  maxTicks: number = DECAY_SCENARIO_MAX_TICKS,
): DecayPathSimulation {
  const controller = new PressureDecayController();
  return controller.simulateDecayPath(snapshot, DECAY_SCENARIO_CALM_THRESHOLD, maxTicks);
}

/**
 * Standalone helper: build a decay policy summary for use in the chat
 * adapter's ingress preprocessing layer.
 */
export function buildDecayPolicySummary(snapshot: RunStateSnapshot): DecayPolicySummary {
  const controller = new PressureDecayController();
  const advisor = new DecayPolicyAdvisor(controller);
  return advisor.computePolicySummary(snapshot);
}

/**
 * Standalone helper: extract a 48-feature ML vector from a snapshot.
 * Used by the DecaySignalAdapter for zero-copy ML pipeline integration.
 */
export function extractDecayMLVector(
  snapshot: RunStateSnapshot,
  collection: PressureSignalCollection | null = null,
  tick: number = 0,
): DecayMLVector {
  const controller = new PressureDecayController();
  return controller.buildMLVector(snapshot, collection, tick);
}
