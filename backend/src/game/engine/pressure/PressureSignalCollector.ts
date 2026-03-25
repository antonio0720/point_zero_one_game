/*
 * POINT ZERO ONE — BACKEND PRESSURE SIGNAL COLLECTOR
 * /backend/src/game/engine/pressure/PressureSignalCollector.ts
 * VERSION: 2026.03.25
 *
 * Doctrine:
 * - pressure is not one number; it is a weighted composition of stress and relief
 * - the collector is deterministic, explainable, and mode-aware
 * - output is normalized 0.0 → 1.0 while preserving raw signal components
 * - pressure and relief are both first-class so dossier / ML layers can explain why
 * - companion classes implement the full ML/DL/trend/forecast/annotation pipeline
 * - every import is actively exercised — zero placeholder symbols
 *
 * Architecture:
 *   PressureSignalCollector  — deterministic tick-level signal composition (pure)
 *   CollectorMLExtractor     — 48-feature ML vector extraction and history ring buffer
 *   CollectorDLBuilder       — 64-feature × 8-tick DL sequence tensor construction
 *   CollectorTrendAnalyzer   — velocity, acceleration, spike, and plateau detection
 *   CollectorForecaster      — tick-horizon score and tier projection
 *   CollectorAnnotator       — annotation bundles and UX hints for the chat lane
 *   CollectorInspector       — diagnostic state, health, watermark, and crossing tracking
 *   CollectorAnalytics       — lifetime running statistics across the full run
 *
 * Standalone helpers:
 *   createPressureCollectorWithAnalytics — fully-wired ensemble factory
 *   extractCollectorSnapshot             — one-shot ML vector without prior history
 *   buildCollectorBundle                 — one-shot full-pipeline bundle (single tick)
 *
 * Module constants exported:
 *   COLLECTOR_MODULE_VERSION, COLLECTOR_MANIFEST
 *
 * All companion classes import their full surface from ./types.
 * Zero circular imports — types.ts is a pure leaf with no engine-side dependencies.
 */

import type { CascadeChainInstance, PressureTier } from '../core/GamePrimitives';
import type { RunStateSnapshot, PressureBand } from '../core/RunStateSnapshot';

import {
  // ── §1-§4: Tier / band helpers, weight defaults, and score utils ──────────
  clampPressureScore,
  createZeroPressureSignalMap,
  DEFAULT_MAX_DECAY_PER_TICK,
  DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
  mergePressureCollectorWeights,
  normalizeWeight,
  PRESSURE_HISTORY_DEPTH,
  resolvePressureTier,
  resolvePressureBand,
  rankPressureTier,
  rankPressureBand,
  getPressureTierMinScore,
  TOP_PRESSURE_SIGNAL_COUNT,
  // ── §5: Collector module constants ─────────────────────────────────────────
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
  // ── §6: Feature label arrays ────────────────────────────────────────────────
  COLLECTOR_ML_FEATURE_LABELS,
  COLLECTOR_DL_FEATURE_LABELS,
  // ── §10: Signal normalization and composite score helpers ──────────────────
  normalizeSignalByWeight,
  scoreToPercentage,
  computeModeScopeRatio,
  computeTierCrossing,
  computeBandCrossing,
  computeStressIndex,
  computeReliefBalance,
  rankTopContributors,
  // ── §11: Urgency classification and chat hook helpers ──────────────────────
  computeEscalationRisk,
  computeRecoveryProbability,
  classifyUrgency,
  buildChatHook,
  // ── §12: ML feature extraction ─────────────────────────────────────────────
  extractCollectorMLFeatures,
  // ── §13: DL row construction ───────────────────────────────────────────────
  buildCollectorDLRow,
  // ── §14: Trend analysis pure helpers ──────────────────────────────────────
  computeCollectorVelocity,
  computeCollectorVelocityAvg,
  computeCollectorAcceleration,
  computeCollectorAccelerationAvg,
  computeCollectorPlateauTicks,
  detectPressureSpike,
  detectPressurePlateau,
  computeRunningAvgScore,
  computeScoreStdDev,
  // ── §15: Annotation, UX hint, and history helpers ─────────────────────────
  buildCollectorAnnotation,
  buildCollectorUXHint,
  buildCollectorHistoryEntry,
  // ── §9: Mode / phase profile builders ─────────────────────────────────────
  buildCollectorModeProfile,
  buildCollectorPhaseProfile,
  // ── §16: Forecast helpers ──────────────────────────────────────────────────
  buildCollectorForecast,
  computePhaseAdjustedEscalationRisk,
  computePhaseAdjustedRecoveryProbability,
  computeModeAdjustedStressIndex,
  // ── §17: Threat, resilience, and validation helpers ────────────────────────
  computeCollectorThreatScore,
  computeCollectorResilienceScore,
  validateCollectorWeights,
} from './types';

import type {
  PressureCollectorLimits,
  PressureCollectorWeights,
  PressurePositiveSignalKey,
  PressureReliefSignalKey,
  PressureSignalCollection,
  PressureSignalContribution,
  PressureSignalMap,
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
  CollectorHistoryEntry,
  CollectorWatermark,
  CollectorInspectorState,
  CollectorModeProfile,
  CollectorPhaseProfile,
  CollectorMLFeaturesParams,
  CollectorDLRowParams,
  CollectorAnnotationParams,
  CollectorForecastParams,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Module version and manifest
// ─────────────────────────────────────────────────────────────────────────────

export const COLLECTOR_MODULE_VERSION = '2026.03.25' as const;

/**
 * Runtime manifest describing every dimension of the collector subsystem.
 * Consumed by chat adapters, ML pipelines, and diagnostic tooling to verify
 * compatibility with the feature schema before ingesting vectors.
 */
export const COLLECTOR_MANIFEST = Object.freeze({
  version:          COLLECTOR_MODULE_VERSION,
  mlFeatureCount:   COLLECTOR_ML_FEATURE_COUNT,
  dlFeatureCount:   COLLECTOR_DL_FEATURE_COUNT,
  dlSequenceLength: COLLECTOR_DL_SEQUENCE_LENGTH,
  historyDepth:     COLLECTOR_HISTORY_DEPTH,
  trendWindow:      COLLECTOR_TREND_WINDOW,
  signalCategories: Object.keys(COLLECTOR_SIGNAL_CATEGORIES) as readonly string[],
  urgencyLevels:    Object.keys(COLLECTOR_URGENCY_THRESHOLDS) as readonly string[],
  reliefPriorities: COLLECTOR_RELIEF_PRIORITIES,
  features: Object.freeze({
    ml: COLLECTOR_ML_FEATURE_LABELS,
    dl: COLLECTOR_DL_FEATURE_LABELS,
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// §1  PressureSignalCollector
//     Deterministic tick-level signal composition. Pure: given the same
//     snapshot it always returns the same PressureSignalCollection.
// ═══════════════════════════════════════════════════════════════════════════════

export class PressureSignalCollector {
  private readonly weights: PressureCollectorWeights;
  private readonly limits:  PressureCollectorLimits;

  public constructor(
    weights: Partial<PressureCollectorWeights> = {},
    limits:  Partial<PressureCollectorLimits>  = {},
  ) {
    this.weights = mergePressureCollectorWeights(
      DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
      weights,
    );
    this.limits = Object.freeze({
      ...DEFAULT_PRESSURE_COLLECTOR_LIMITS,
      ...limits,
    });
  }

  /** Frozen snapshot of the resolved weight configuration. */
  public getWeights(): PressureCollectorWeights {
    return this.weights;
  }

  /** Frozen snapshot of the resolved limit configuration. */
  public getLimits(): PressureCollectorLimits {
    return this.limits;
  }

  /**
   * Compute the complete pressure signal collection for one tick.
   *
   * Computes all 17 positive pressure signals and 6 relief signals from the
   * snapshot, sums them, clamps the result to [0,1], and returns a frozen
   * PressureSignalCollection explaining every contribution.
   */
  public collect(snapshot: RunStateSnapshot): PressureSignalCollection {
    const pressureBreakdown = createZeroPressureSignalMap();
    const reliefBreakdown   = createZeroPressureSignalMap();

    const pressureContributions: PressureSignalContribution[] = [];
    const reliefContributions:   PressureSignalContribution[] = [];

    // ── Universal pressure signals (all modes) ────────────────────────────
    this.pushPressure(pressureContributions, pressureBreakdown,
      'cash_crisis',
      this.cashStress(snapshot),
      `cash=${snapshot.economy.cash}`,
      false,
    );

    this.pushPressure(pressureContributions, pressureBreakdown,
      'net_worth_collapse',
      this.netWorthStress(snapshot),
      `netWorth=${snapshot.economy.netWorth}`,
      false,
    );

    this.pushPressure(pressureContributions, pressureBreakdown,
      'cashflow_deficit',
      this.cashflowStress(snapshot),
      `incomePerTick=${snapshot.economy.incomePerTick},expensesPerTick=${snapshot.economy.expensesPerTick}`,
      false,
    );

    this.pushPressure(pressureContributions, pressureBreakdown,
      'shield_damage',
      this.shieldDamageStress(snapshot),
      `weakestRatio=${snapshot.shield.weakestLayerRatio.toFixed(3)}`,
      false,
    );

    this.pushPressure(pressureContributions, pressureBreakdown,
      'shield_breach',
      this.shieldBreachStress(snapshot),
      `breachedLayers=${snapshot.shield.layers.filter((l) => l.breached).length}`,
      false,
    );

    this.pushPressure(pressureContributions, pressureBreakdown,
      'attack_queue',
      this.attackQueueStress(snapshot),
      `pendingAttacks=${snapshot.battle.pendingAttacks.length}`,
      false,
    );

    this.pushPressure(pressureContributions, pressureBreakdown,
      'cascade_pressure',
      this.cascadeStress(snapshot),
      `negativeChains=${this.countNegativeChains(snapshot.cascade.activeChains)}`,
      false,
    );

    this.pushPressure(pressureContributions, pressureBreakdown,
      'hater_heat',
      this.haterHeatStress(snapshot),
      `haterHeat=${snapshot.economy.haterHeat}`,
      false,
    );

    this.pushPressure(pressureContributions, pressureBreakdown,
      'phase_pressure',
      this.phaseStress(snapshot),
      `phase=${snapshot.phase}`,
      false,
    );

    this.pushPressure(pressureContributions, pressureBreakdown,
      'time_burn',
      this.timeBurnStress(snapshot),
      `elapsedMs=${snapshot.timers.elapsedMs},seasonBudgetMs=${snapshot.timers.seasonBudgetMs}`,
      false,
    );

    // ── Mode-scoped pressure signals ──────────────────────────────────────
    switch (snapshot.mode) {
      case 'solo':
        this.pushPressure(pressureContributions, pressureBreakdown,
          'solo_isolation_tax',
          this.soloIsolationStress(snapshot),
          `opportunitiesPurchased=${snapshot.economy.opportunitiesPurchased},tick=${snapshot.tick}`,
          true,
        );
        this.pushPressure(pressureContributions, pressureBreakdown,
          'bleed_mode_tax',
          this.bleedModeStress(snapshot),
          `bleedMode=${snapshot.modeState.bleedMode}`,
          true,
        );
        break;

      case 'pvp':
        this.pushPressure(pressureContributions, pressureBreakdown,
          'pvp_rivalry_heat',
          this.pvpRivalryStress(snapshot),
          `rivalryHeatCarry=${snapshot.battle.rivalryHeatCarry}`,
          true,
        );
        break;

      case 'coop':
        this.pushPressure(pressureContributions, pressureBreakdown,
          'coop_trust_fracture',
          this.coopTrustFractureStress(snapshot),
          `avgTrust=${this.averageTrust(snapshot).toFixed(2)}`,
          true,
        );
        this.pushPressure(pressureContributions, pressureBreakdown,
          'coop_defection_risk',
          this.coopDefectionRiskStress(snapshot),
          `maxDefectionStep=${this.maxDefectionStep(snapshot)}`,
          true,
        );
        break;

      case 'ghost':
        this.pushPressure(pressureContributions, pressureBreakdown,
          'ghost_community_heat',
          this.ghostCommunityStress(snapshot),
          `communityHeatModifier=${snapshot.modeState.communityHeatModifier}`,
          true,
        );
        this.pushPressure(pressureContributions, pressureBreakdown,
          'ghost_gap_pressure',
          this.ghostGapStress(snapshot),
          `gapVsLegend=${snapshot.sovereignty.gapVsLegend}`,
          true,
        );
        break;
    }

    // ── Universal relief signals ──────────────────────────────────────────
    this.pushRelief(reliefContributions, reliefBreakdown,
      'prosperity_relief',
      this.prosperityRelief(snapshot),
      `netWorth=${snapshot.economy.netWorth},freedomTarget=${snapshot.economy.freedomTarget}`,
      false,
    );

    this.pushRelief(reliefContributions, reliefBreakdown,
      'full_security_relief',
      this.fullSecurityRelief(snapshot),
      `pendingAttacks=${snapshot.battle.pendingAttacks.length},negativeChains=${this.countNegativeChains(snapshot.cascade.activeChains)}`,
      false,
    );

    this.pushRelief(reliefContributions, reliefBreakdown,
      'runway_relief',
      this.runwayRelief(snapshot),
      `cash=${snapshot.economy.cash},expensesPerTick=${snapshot.economy.expensesPerTick}`,
      false,
    );

    this.pushRelief(reliefContributions, reliefBreakdown,
      'income_surplus_relief',
      this.incomeSurplusRelief(snapshot),
      `incomePerTick=${snapshot.economy.incomePerTick},expensesPerTick=${snapshot.economy.expensesPerTick}`,
      false,
    );

    // ── Mode-scoped relief signals ────────────────────────────────────────
    if (snapshot.mode === 'coop') {
      this.pushRelief(reliefContributions, reliefBreakdown,
        'coop_cohesion_relief',
        this.coopCohesionRelief(snapshot),
        `avgTrust=${this.averageTrust(snapshot).toFixed(2)}`,
        true,
      );
    }

    if (snapshot.mode === 'ghost') {
      this.pushRelief(reliefContributions, reliefBreakdown,
        'ghost_alignment_relief',
        this.ghostAlignmentRelief(snapshot),
        `gapVsLegend=${snapshot.sovereignty.gapVsLegend}`,
        true,
      );
    }

    // ── Aggregate ─────────────────────────────────────────────────────────
    const rawPositiveScore = this.sumContributions(pressureContributions);
    const rawReliefScore   = this.sumContributions(reliefContributions);
    const rawScore         = Number((rawPositiveScore - rawReliefScore).toFixed(6));
    const score            = clampPressureScore(rawScore);

    const netBreakdown = this.buildNetBreakdown(pressureBreakdown, reliefBreakdown);

    return Object.freeze({
      rawPositiveScore,
      rawReliefScore,
      rawScore,
      score,
      contributions:       Object.freeze([...pressureContributions]),
      reliefContributions: Object.freeze([...reliefContributions]),
      dominantPressureKey: this.findDominantPressureKey(pressureContributions),
      dominantReliefKey:   this.findDominantReliefKey(reliefContributions),
      pressureBreakdown:   Object.freeze({ ...pressureBreakdown }) as PressureSignalMap,
      reliefBreakdown:     Object.freeze({ ...reliefBreakdown }) as PressureSignalMap,
      netBreakdown:        Object.freeze({ ...netBreakdown }) as PressureSignalMap,
    });
  }

  // ── Private stress calculators ──────────────────────────────────────────

  private cashStress(snapshot: RunStateSnapshot): number {
    const cash   = snapshot.economy.cash;
    const weight = this.weights.cash_crisis;
    if (cash <= 0)                               return weight;
    if (cash < this.limits.cashDangerThreshold)  return Number((weight * 0.85).toFixed(6));
    if (cash < this.limits.cashWarningThreshold) return Number((weight * 0.55).toFixed(6));
    if (cash < this.limits.cashSoftThreshold)    return Number((weight * 0.30).toFixed(6));
    return 0;
  }

  private netWorthStress(snapshot: RunStateSnapshot): number {
    const netWorth      = snapshot.economy.netWorth;
    const freedomTarget = Math.max(1, snapshot.economy.freedomTarget);
    const weight        = this.weights.net_worth_collapse;
    if (netWorth < 0)                     return weight;
    if (netWorth < freedomTarget * 0.10)  return Number((weight * 0.60).toFixed(6));
    if (netWorth < freedomTarget * 0.25)  return Number((weight * 0.30).toFixed(6));
    return 0;
  }

  private cashflowStress(snapshot: RunStateSnapshot): number {
    const income   = snapshot.economy.incomePerTick;
    const expenses = snapshot.economy.expensesPerTick;
    const deficit  = Math.max(0, expenses - income);
    if (deficit <= 0) return 0;
    const ratio  = expenses > 0 ? deficit / expenses : 1;
    const scaled = Math.max(
      this.weights.cashflow_deficit * 0.20,
      Math.min(this.weights.cashflow_deficit, ratio * this.weights.cashflow_deficit),
    );
    return Number(scaled.toFixed(6));
  }

  private shieldDamageStress(snapshot: RunStateSnapshot): number {
    if (snapshot.shield.layers.length === 0) return 0;
    const avgMissing =
      snapshot.shield.layers.reduce((sum, l) => sum + (1 - l.integrityRatio), 0) /
      snapshot.shield.layers.length;
    const weakestPenalty =
      snapshot.shield.weakestLayerRatio < this.limits.weakShieldThreshold
        ? (this.limits.weakShieldThreshold - snapshot.shield.weakestLayerRatio) /
          this.limits.weakShieldThreshold
        : 0;
    const pressure =
      avgMissing     * this.weights.shield_damage * 0.70 +
      weakestPenalty * this.weights.shield_damage * 0.30;
    return Number(Math.min(this.weights.shield_damage, pressure).toFixed(6));
  }

  private shieldBreachStress(snapshot: RunStateSnapshot): number {
    const breached = snapshot.shield.layers.filter((l) => l.breached).length;
    if (breached <= 0 && snapshot.shield.weakestLayerRatio > this.limits.criticalShieldThreshold) {
      return 0;
    }
    let pressure =
      Math.min(1, breached / Math.max(1, snapshot.shield.layers.length)) *
      this.weights.shield_breach;
    if (snapshot.shield.weakestLayerRatio <= this.limits.criticalShieldThreshold) {
      pressure += this.weights.shield_breach * 0.35;
    }
    return Number(Math.min(this.weights.shield_breach, pressure).toFixed(6));
  }

  private attackQueueStress(snapshot: RunStateSnapshot): number {
    const queueLength = snapshot.battle.pendingAttacks.length;
    if (queueLength <= 0) return 0;
    const attackMagnitude = snapshot.battle.pendingAttacks.reduce(
      (sum, a) => sum + Math.max(0, a.magnitude), 0,
    );
    const normalized = queueLength * 0.40 + Math.min(1.0, attackMagnitude / 100);
    return Number(
      Math.min(this.weights.attack_queue, normalized * this.weights.attack_queue).toFixed(6),
    );
  }

  private cascadeStress(snapshot: RunStateSnapshot): number {
    const negativeChains = this.countNegativeChains(snapshot.cascade.activeChains);
    const positiveChains = snapshot.cascade.activeChains.length - negativeChains;
    if (negativeChains <= 0 && positiveChains <= 0) return 0;
    const pressure =
      negativeChains * this.weights.cascade_pressure * 0.55 +
      positiveChains * this.weights.cascade_pressure * 0.10;
    return Number(Math.min(this.weights.cascade_pressure, pressure).toFixed(6));
  }

  private haterHeatStress(snapshot: RunStateSnapshot): number {
    const threshold = this.limits.haterHeatThreshold;
    const max  = this.limits.haterHeatMax;
    const heat = snapshot.economy.haterHeat;
    if (heat <= threshold) return 0;
    const excess     = Math.min(max - threshold, Math.max(0, heat - threshold));
    const normalized = excess / Math.max(1, max - threshold);
    return Number(
      Math.min(this.weights.hater_heat, normalized * this.weights.hater_heat).toFixed(6),
    );
  }

  private phaseStress(snapshot: RunStateSnapshot): number {
    switch (snapshot.phase) {
      case 'FOUNDATION':  return 0;
      case 'ESCALATION':  return Number((this.weights.phase_pressure * 0.50).toFixed(6));
      case 'SOVEREIGNTY': return this.weights.phase_pressure;
      default:            return 0;
    }
  }

  private timeBurnStress(snapshot: RunStateSnapshot): number {
    const totalBudget  = Math.max(1, snapshot.timers.seasonBudgetMs);
    const elapsedRatio = snapshot.timers.elapsedMs / totalBudget;
    if (elapsedRatio < this.limits.lastThirdStartRatio) return 0;
    const normalized =
      (elapsedRatio - this.limits.lastThirdStartRatio) /
      (1 - this.limits.lastThirdStartRatio);
    return Number(
      Math.min(this.weights.time_burn, normalized * this.weights.time_burn).toFixed(6),
    );
  }

  private soloIsolationStress(snapshot: RunStateSnapshot): number {
    if (snapshot.tick <= this.limits.soloIsolationTickGate)   return 0;
    if (snapshot.economy.opportunitiesPurchased > 0)           return 0;
    if (snapshot.economy.incomePerTick > snapshot.economy.expensesPerTick) {
      return Number((this.weights.solo_isolation_tax * 0.50).toFixed(6));
    }
    return this.weights.solo_isolation_tax;
  }

  private bleedModeStress(snapshot: RunStateSnapshot): number {
    return snapshot.modeState.bleedMode ? this.weights.bleed_mode_tax : 0;
  }

  private pvpRivalryStress(snapshot: RunStateSnapshot): number {
    if (snapshot.battle.rivalryHeatCarry <= 0) return 0;
    const normalized = Math.min(1, snapshot.battle.rivalryHeatCarry / 25);
    return Number((normalized * this.weights.pvp_rivalry_heat).toFixed(6));
  }

  private coopTrustFractureStress(snapshot: RunStateSnapshot): number {
    const avgTrust = this.averageTrust(snapshot);
    if (avgTrust >= 70) return 0;
    if (avgTrust <= 30) return this.weights.coop_trust_fracture;
    const normalized = (70 - avgTrust) / 40;
    return Number((normalized * this.weights.coop_trust_fracture).toFixed(6));
  }

  private coopDefectionRiskStress(snapshot: RunStateSnapshot): number {
    const maxStep = this.maxDefectionStep(snapshot);
    if (maxStep <= 0) return 0;
    const normalized = Math.min(1, maxStep / 3);
    return Number((normalized * this.weights.coop_defection_risk).toFixed(6));
  }

  private ghostCommunityStress(snapshot: RunStateSnapshot): number {
    if (snapshot.modeState.communityHeatModifier <= 0) return 0;
    const normalized = Math.min(1, snapshot.modeState.communityHeatModifier / 150);
    return Number((normalized * this.weights.ghost_community_heat).toFixed(6));
  }

  private ghostGapStress(snapshot: RunStateSnapshot): number {
    if (snapshot.sovereignty.gapVsLegend >= 0) return 0;
    const normalized = Math.min(1, Math.abs(snapshot.sovereignty.gapVsLegend) / 0.50);
    return Number((normalized * this.weights.ghost_gap_pressure).toFixed(6));
  }

  // ── Private relief calculators ────────────────────────────────────────────

  private prosperityRelief(snapshot: RunStateSnapshot): number {
    const freedomTarget = snapshot.economy.freedomTarget;
    if (freedomTarget <= 0 || snapshot.economy.netWorth <= 0) return 0;
    const normalized = Math.min(1, snapshot.economy.netWorth / (2 * freedomTarget));
    return Number((normalized * this.weights.prosperity_relief).toFixed(6));
  }

  private fullSecurityRelief(snapshot: RunStateSnapshot): number {
    const allFull   = snapshot.shield.layers.every((l) => l.integrityRatio >= 1);
    const noPending = snapshot.battle.pendingAttacks.length === 0;
    const noNegCasc = this.countNegativeChains(snapshot.cascade.activeChains) === 0;
    return allFull && noPending && noNegCasc ? this.weights.full_security_relief : 0;
  }

  private runwayRelief(snapshot: RunStateSnapshot): number {
    const expenses = snapshot.economy.expensesPerTick;
    if (expenses <= 0 || snapshot.economy.cash <= 0) return 0;
    const runwayTicks = snapshot.economy.cash / expenses;
    const normalized  = Math.min(1, runwayTicks / this.limits.cashRunwayMonthsForFullRelief);
    return Number((normalized * this.weights.runway_relief).toFixed(6));
  }

  private incomeSurplusRelief(snapshot: RunStateSnapshot): number {
    const income   = snapshot.economy.incomePerTick;
    const expenses = snapshot.economy.expensesPerTick;
    if (income <= expenses || income <= 0) return 0;
    const normalized = Math.min(1, (income - expenses) / income);
    return Number((normalized * this.weights.income_surplus_relief).toFixed(6));
  }

  private coopCohesionRelief(snapshot: RunStateSnapshot): number {
    const avgTrust = this.averageTrust(snapshot);
    if (avgTrust <= 80) return 0;
    const normalized = Math.min(1, (avgTrust - 80) / 20);
    return Number((normalized * this.weights.coop_cohesion_relief).toFixed(6));
  }

  private ghostAlignmentRelief(snapshot: RunStateSnapshot): number {
    if (snapshot.sovereignty.gapVsLegend <= 0) return 0;
    const normalized = Math.min(1, snapshot.sovereignty.gapVsLegend / 0.25);
    return Number((normalized * this.weights.ghost_alignment_relief).toFixed(6));
  }

  // ── Private utility helpers ───────────────────────────────────────────────

  private averageTrust(snapshot: RunStateSnapshot): number {
    const values = Object.values(snapshot.modeState.trustScores);
    if (values.length === 0) return 100;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private maxDefectionStep(snapshot: RunStateSnapshot): number {
    const values = Object.values(snapshot.modeState.defectionStepByPlayer);
    if (values.length === 0) return 0;
    return Math.max(...values);
  }

  private countNegativeChains(chains: readonly CascadeChainInstance[]): number {
    return chains.filter((c) => !c.positive).length;
  }

  private sumContributions(contributions: readonly PressureSignalContribution[]): number {
    return Number(contributions.reduce((sum, item) => sum + item.amount, 0).toFixed(6));
  }

  private buildNetBreakdown(
    pressureBreakdown: PressureSignalMap,
    reliefBreakdown:   PressureSignalMap,
  ): Record<keyof PressureSignalMap, number> {
    const net = createZeroPressureSignalMap();
    for (const key of Object.keys(net) as Array<keyof PressureSignalMap>) {
      net[key] = Number(
        ((pressureBreakdown[key] ?? 0) - (reliefBreakdown[key] ?? 0)).toFixed(6),
      );
    }
    return net;
  }

  private findDominantPressureKey(
    contributions: readonly PressureSignalContribution[],
  ): PressurePositiveSignalKey | null {
    if (contributions.length === 0) return null;
    const dominant = [...contributions].sort((a, b) => b.amount - a.amount)[0];
    return dominant ? (dominant.key as PressurePositiveSignalKey) : null;
  }

  private findDominantReliefKey(
    contributions: readonly PressureSignalContribution[],
  ): PressureReliefSignalKey | null {
    if (contributions.length === 0) return null;
    const dominant = [...contributions].sort((a, b) => b.amount - a.amount)[0];
    return dominant ? (dominant.key as PressureReliefSignalKey) : null;
  }

  private pushPressure(
    contributions: PressureSignalContribution[],
    breakdown: Record<string, number>,
    key: PressurePositiveSignalKey,
    amount: number,
    reason: string,
    modeScoped: boolean,
  ): void {
    this.push(contributions, breakdown, key, 'PRESSURE', amount, reason, modeScoped);
  }

  private pushRelief(
    contributions: PressureSignalContribution[],
    breakdown: Record<string, number>,
    key: PressureReliefSignalKey,
    amount: number,
    reason: string,
    modeScoped: boolean,
  ): void {
    this.push(contributions, breakdown, key, 'RELIEF', amount, reason, modeScoped);
  }

  private push(
    contributions: PressureSignalContribution[],
    breakdown: Record<string, number>,
    key: string,
    polarity: 'PRESSURE' | 'RELIEF',
    amount: number,
    reason: string,
    modeScoped: boolean,
  ): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const normalizedAmount = Number(amount.toFixed(6));
    breakdown[key] = normalizedAmount;
    contributions.push(
      Object.freeze({
        key,
        polarity,
        amount: normalizedAmount,
        reason,
        modeScoped,
      }) as PressureSignalContribution,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2  CollectorMLExtractor
//     48-feature ML vector extraction with internal history ring buffer.
//     The ring buffer is bounded by COLLECTOR_HISTORY_DEPTH and is the source
//     of truth for velocity, acceleration, and windowed averages.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extracts a labeled 48-feature CollectorMLVector from each pressure tick.
 *
 * Maintains an internal ring buffer (COLLECTOR_HISTORY_DEPTH entries) of
 * CollectorHistoryEntry records. Consecutive-tick counters for T3/T4 tiers
 * are tracked automatically across calls.
 *
 * Usage:
 *   const extractor = new CollectorMLExtractor(collector);
 *   const vector    = extractor.extract(snapshot);
 *   const history   = extractor.getHistory();
 */
export class CollectorMLExtractor {
  private readonly collector: PressureSignalCollector;
  private readonly history:   CollectorHistoryEntry[];
  private prevTier:            PressureTier;
  private prevBand:            PressureBand;
  private consecutiveHighTier: number;
  private consecutiveCritical: number;
  private extractCount:        number;

  public constructor(collector: PressureSignalCollector) {
    this.collector           = collector;
    this.history             = [];
    this.prevTier            = 'T0';
    this.prevBand            = 'CALM';
    this.consecutiveHighTier = 0;
    this.consecutiveCritical = 0;
    this.extractCount        = 0;
  }

  /**
   * Run a full pressure collection for the snapshot tick, append the result
   * to the history ring buffer, and return the 48-feature CollectorMLVector.
   *
   * Side effects:
   * - Internal history ring buffer is updated (bounded by COLLECTOR_HISTORY_DEPTH)
   * - prevTier, prevBand, and consecutive-tick counters are advanced
   * - extractCount is incremented
   */
  public extract(snapshot: RunStateSnapshot): CollectorMLVector {
    const collection = this.collector.collect(snapshot);
    const tick       = snapshot.tick;
    const tier       = resolvePressureTier(collection.score);
    const band       = resolvePressureBand(collection.score);

    // Compute motion and scope metrics from existing history before appending
    const velocity              = computeCollectorVelocity(this.history);
    const velocityWindowAvg     = computeCollectorVelocityAvg(this.history, COLLECTOR_TREND_WINDOW);
    const accelerationWindowAvg = computeCollectorAccelerationAvg(this.history, COLLECTOR_TREND_WINDOW);
    const modeScopeRatio        = computeModeScopeRatio(collection);

    // Advance consecutive high-tier and critical-tier counters
    this.consecutiveHighTier = rankPressureTier(tier) >= 3 ? this.consecutiveHighTier + 1 : 0;
    this.consecutiveCritical = tier === 'T4'             ? this.consecutiveCritical + 1  : 0;

    const params: CollectorMLFeaturesParams = {
      collection,
      tier,
      prevTier:                 this.prevTier,
      band,
      prevBand:                 this.prevBand,
      tick,
      consecutiveHighTierTicks: this.consecutiveHighTier,
      consecutiveCriticalTicks: this.consecutiveCritical,
      velocity,
      velocityWindowAvg,
      accelerationWindowAvg,
      modeScopeRatio,
    };

    const features     = extractCollectorMLFeatures(params);
    const stressIndex  = computeStressIndex(collection);
    const reliefBal    = computeReliefBalance(collection);

    // Invariant check — feature count must match the published schema
    if (features.length !== COLLECTOR_ML_FEATURE_COUNT) {
      throw new Error(
        `CollectorMLExtractor: feature count mismatch — ` +
        `expected ${COLLECTOR_ML_FEATURE_COUNT}, got ${features.length}`,
      );
    }

    // Build and push history entry
    const entry = buildCollectorHistoryEntry({ collection, tier, band, tick });
    this.pushHistory(entry);

    // Advance prev-state trackers for the next call
    this.prevTier = tier;
    this.prevBand = band;
    this.extractCount++;

    return Object.freeze({
      featureCount:  COLLECTOR_ML_FEATURE_COUNT,
      features,
      labels:        COLLECTOR_ML_FEATURE_LABELS,
      tick,
      score:         collection.score,
      tier,
      band,
      stressIndex,
      reliefBalance: reliefBal,
    });
  }

  /**
   * Build a CollectorMLFeaturesParams object from externally-supplied values.
   *
   * Useful for replay pipelines that supply their own velocity / acceleration
   * without relying on the internal ring buffer state.
   */
  public buildParams(
    collection:               PressureSignalCollection,
    tick:                     number,
    tier:                     PressureTier,
    prevTier:                 PressureTier,
    band:                     PressureBand,
    prevBand:                 PressureBand,
    consecutiveHighTierTicks: number,
    consecutiveCriticalTicks: number,
    velocity:                 number,
    velocityWindowAvg:        number,
    accelerationWindowAvg:    number,
    modeScopeRatio:           number,
  ): CollectorMLFeaturesParams {
    return {
      collection,
      tier,
      prevTier,
      band,
      prevBand,
      tick,
      consecutiveHighTierTicks,
      consecutiveCriticalTicks,
      velocity,
      velocityWindowAvg,
      accelerationWindowAvg,
      modeScopeRatio,
    };
  }

  /**
   * Return the normalized [0-1] value for a single positive pressure signal.
   *
   * Divides the raw breakdown amount by the signal's configured weight cap.
   * Useful for per-signal diagnostic displays and chat adapter signal routing.
   */
  public getSignalNormalized(
    collection: PressureSignalCollection,
    key: PressurePositiveSignalKey,
  ): number {
    const weights = this.collector.getWeights();
    return normalizeSignalByWeight(collection.pressureBreakdown[key], weights[key]);
  }

  /**
   * Return all normalized signal values for the provided collection.
   * Returns a record keyed by PressurePositiveSignalKey.
   */
  public getAllSignalsNormalized(
    collection: PressureSignalCollection,
  ): Record<PressurePositiveSignalKey, number> {
    const weights = this.collector.getWeights();
    const result = {} as Record<PressurePositiveSignalKey, number>;
    for (const contrib of collection.contributions) {
      const key = contrib.key as PressurePositiveSignalKey;
      result[key] = normalizeSignalByWeight(collection.pressureBreakdown[key], weights[key]);
    }
    return result;
  }

  /** Frozen copy of the current history ring buffer (oldest-first). */
  public getHistory(): readonly CollectorHistoryEntry[] {
    return Object.freeze([...this.history]);
  }

  /** Most recent history entry, or null if no extraction has occurred yet. */
  public getLatestEntry(): CollectorHistoryEntry | null {
    return this.history.length > 0 ? this.history[this.history.length - 1]! : null;
  }

  /** Total number of extract() calls since construction or last reset(). */
  public getExtractCount(): number {
    return this.extractCount;
  }

  /** Clears all state. Safe to call between runs in a persistent process. */
  public reset(): void {
    this.history.length      = 0;
    this.prevTier            = 'T0';
    this.prevBand            = 'CALM';
    this.consecutiveHighTier = 0;
    this.consecutiveCritical = 0;
    this.extractCount        = 0;
  }

  /** Enforce ring buffer cap. Oldest entry evicted when full. */
  private pushHistory(entry: CollectorHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > COLLECTOR_HISTORY_DEPTH) {
      this.history.shift();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3  CollectorDLBuilder
//     64-feature × COLLECTOR_DL_SEQUENCE_LENGTH-tick DL sequence tensor.
//     Accumulates per-tick DL rows into a sliding window oldest-first tensor
//     suitable for LSTM or Transformer pressure prediction models.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Builds and accumulates CollectorDLTensor objects one row per tick.
 *
 * Row shape is COLLECTOR_DL_FEATURE_COUNT (64): 48 ML features plus 16
 * one-hot context dimensions (mode, phase, tier, and 4 context flags).
 * Sequence window is bounded by COLLECTOR_DL_SEQUENCE_LENGTH (8 ticks).
 *
 * Usage:
 *   const dlBuilder = new CollectorDLBuilder(extractor);
 *   const tensor    = dlBuilder.build(collection, tick, mode, phase, ...);
 */
export class CollectorDLBuilder {
  private readonly extractor: CollectorMLExtractor;
  private readonly rowBuffer: Array<readonly number[]>;
  private buildCount: number;

  public constructor(extractor: CollectorMLExtractor) {
    this.extractor  = extractor;
    this.rowBuffer  = [];
    this.buildCount = 0;
  }

  /**
   * Build a new 64-feature DL row from the provided collection context,
   * append it to the sequence buffer, and return the complete tensor.
   *
   * All velocity, acceleration, and tier context are derived from the
   * CollectorMLExtractor's ring buffer state at the time of the call.
   */
  public build(
    collection:          PressureSignalCollection,
    tick:                number,
    mode:                'solo' | 'pvp' | 'coop' | 'ghost',
    phase:               'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
    peakScore:           number,
    haterInjectionArmed: boolean,
    shieldDrainActive:   boolean,
  ): CollectorDLTensor {
    const history = this.extractor.getHistory();

    // Resolve tier and band from history when available, fall back to current score
    const tier     = history.length > 0
      ? history[history.length - 1]!.tier
      : resolvePressureTier(collection.score);
    const band     = history.length > 0
      ? history[history.length - 1]!.band
      : resolvePressureBand(collection.score);
    const prevTier = history.length > 1 ? history[history.length - 2]!.tier : tier;
    const prevBand = history.length > 1 ? history[history.length - 2]!.band : band;

    const velocity              = computeCollectorVelocity(history);
    const velocityWindowAvg     = computeCollectorVelocityAvg(history, COLLECTOR_TREND_WINDOW);
    const accelerationWindowAvg = computeCollectorAccelerationAvg(history, COLLECTOR_TREND_WINDOW);
    const modeScopeRatio        = computeModeScopeRatio(collection);

    // Derive consecutive T3+ and T4 streaks from the tail of history
    const consecutiveHighTier = history.reduce(
      (count, e) => rankPressureTier(e.tier) >= 3 ? count + 1 : 0, 0,
    );
    const consecutiveCritical = history.reduce(
      (count, e) => e.tier === 'T4' ? count + 1 : 0, 0,
    );

    const rowParams: CollectorDLRowParams = {
      collection,
      tier,
      prevTier,
      band,
      prevBand,
      tick,
      consecutiveHighTierTicks: consecutiveHighTier,
      consecutiveCriticalTicks: consecutiveCritical,
      velocity,
      velocityWindowAvg,
      accelerationWindowAvg,
      modeScopeRatio,
      mode,
      phase,
      peakScore,
      haterInjectionArmed,
      shieldDrainActive,
    };

    const row = buildCollectorDLRow(rowParams);

    if (row.length !== COLLECTOR_DL_FEATURE_COUNT) {
      throw new Error(
        `CollectorDLBuilder: row dimension mismatch — ` +
        `expected ${COLLECTOR_DL_FEATURE_COUNT}, got ${row.length}`,
      );
    }

    this.appendRow(row);
    this.buildCount++;

    return this.assembleTensor(tick);
  }

  /**
   * Build a DL row from a fully-specified CollectorDLRowParams object.
   *
   * Used by replay pipelines that supply their own params rather than deriving
   * them from the extractor's ring buffer.
   */
  public buildFromParams(params: CollectorDLRowParams): CollectorDLTensor {
    const row = buildCollectorDLRow(params);
    this.appendRow(row);
    this.buildCount++;
    return this.assembleTensor(params.tick);
  }

  /**
   * Return the current tensor snapshot without appending a new row.
   * Safe to call on every tick for read-only consumers.
   */
  public getTensor(tick: number): CollectorDLTensor {
    return this.assembleTensor(tick);
  }

  /** Total number of rows appended since construction or last reset(). */
  public getBuildCount(): number {
    return this.buildCount;
  }

  /** Clears the row buffer. Safe to call between runs. */
  public reset(): void {
    this.rowBuffer.length = 0;
    this.buildCount       = 0;
  }

  /** Enforce sequence buffer window depth using COLLECTOR_DL_SEQUENCE_LENGTH. */
  private appendRow(row: readonly number[]): void {
    this.rowBuffer.push(row);
    if (this.rowBuffer.length > COLLECTOR_DL_SEQUENCE_LENGTH) {
      this.rowBuffer.shift();
    }
  }

  /** Assemble a frozen CollectorDLTensor from the current row buffer. */
  private assembleTensor(tick: number): CollectorDLTensor {
    return Object.freeze({
      featureCount:   COLLECTOR_DL_FEATURE_COUNT,
      sequenceLength: this.rowBuffer.length,
      rows:           Object.freeze(this.rowBuffer.map((r) => Object.freeze([...r]))),
      labels:         COLLECTOR_DL_FEATURE_LABELS,
      tick,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4  CollectorTrendAnalyzer
//     Stateless velocity / acceleration / spike / plateau analysis over a
//     sliding history window. All methods are pure functions of the input.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stateless trend analysis over a sliding window of CollectorHistoryEntry records.
 *
 * Creates CollectorTrendSummary objects containing velocity, acceleration,
 * spike detection, plateau detection, and a semantic CollectorTrendLabel.
 * Uses all four configured COLLECTOR_TREND/PLATEAU/SPIKE constants.
 *
 * Usage:
 *   const analyzer = new CollectorTrendAnalyzer();
 *   const trend    = analyzer.analyze(extractor.getHistory());
 */
export class CollectorTrendAnalyzer {
  public constructor() {}

  /**
   * Produce a full CollectorTrendSummary from a history slice.
   *
   * Delegates to: computeCollectorVelocity, computeCollectorVelocityAvg,
   * computeCollectorAcceleration, computeCollectorAccelerationAvg,
   * computeCollectorPlateauTicks, detectPressureSpike, detectPressurePlateau.
   *
   * Thresholds: COLLECTOR_TREND_WINDOW, COLLECTOR_PLATEAU_TICKS,
   * COLLECTOR_SPIKE_THRESHOLD, COLLECTOR_PLATEAU_TOLERANCE.
   */
  public analyze(history: readonly CollectorHistoryEntry[]): CollectorTrendSummary {
    const velocity       = computeCollectorVelocity(history);
    const velocityAvg    = computeCollectorVelocityAvg(history, COLLECTOR_TREND_WINDOW);
    const acceleration   = computeCollectorAcceleration(history);
    const accelAvg       = computeCollectorAccelerationAvg(history, COLLECTOR_TREND_WINDOW);
    const plateauTicks   = computeCollectorPlateauTicks(history, COLLECTOR_PLATEAU_TOLERANCE);
    const isSpike        = detectPressureSpike(history, COLLECTOR_SPIKE_THRESHOLD);
    const isPlateau      = detectPressurePlateau(history, COLLECTOR_PLATEAU_TOLERANCE, COLLECTOR_PLATEAU_TICKS);
    const decelerating   = acceleration < -0.005 && velocity > 0;
    const accelerating   = acceleration >  0.005 && velocity > 0;
    const trendLabel     = this.classifyTrendLabel(velocityAvg, accelAvg, isSpike, isPlateau);

    return Object.freeze({
      velocity,
      acceleration,
      isSpike,
      isPlateau,
      plateauTicks,
      decelerating,
      accelerating,
      trendLabel,
      window: Math.min(history.length, COLLECTOR_TREND_WINDOW),
    });
  }

  /**
   * Classify a CollectorTrendLabel from windowed velocity, acceleration,
   * and spike / plateau detection flags.
   *
   * Priority order: SPIKING → PLATEAUING → RISING → FALLING → STABLE
   */
  public classifyTrendLabel(
    velocityAvg: number,
    accelAvg:    number,
    isSpike:     boolean,
    isPlateau:   boolean,
  ): CollectorTrendLabel {
    if (isSpike)                                              return 'SPIKING';
    if (isPlateau)                                            return 'PLATEAUING';
    if (velocityAvg >  0.015)                                 return 'RISING';
    if (velocityAvg < -0.015)                                 return 'FALLING';
    if (Math.abs(velocityAvg) <= 0.015 && Math.abs(accelAvg) <= 0.005) return 'STABLE';
    return velocityAvg > 0 ? 'RISING' : 'FALLING';
  }

  /** Instantaneous velocity from the two most recent history entries. */
  public getVelocity(history: readonly CollectorHistoryEntry[]): number {
    return computeCollectorVelocity(history);
  }

  /** Window-averaged velocity over COLLECTOR_TREND_WINDOW ticks. */
  public getVelocityAvg(history: readonly CollectorHistoryEntry[]): number {
    return computeCollectorVelocityAvg(history, COLLECTOR_TREND_WINDOW);
  }

  /** Instantaneous acceleration from the three most recent history entries. */
  public getAcceleration(history: readonly CollectorHistoryEntry[]): number {
    return computeCollectorAcceleration(history);
  }

  /** Window-averaged acceleration over COLLECTOR_TREND_WINDOW ticks. */
  public getAccelerationAvg(history: readonly CollectorHistoryEntry[]): number {
    return computeCollectorAccelerationAvg(history, COLLECTOR_TREND_WINDOW);
  }

  /**
   * Count consecutive plateau ticks from the end of history.
   * Uses the default COLLECTOR_PLATEAU_TOLERANCE threshold.
   */
  public getPlateauCount(history: readonly CollectorHistoryEntry[]): number {
    return computeCollectorPlateauTicks(history, COLLECTOR_PLATEAU_TOLERANCE);
  }

  /**
   * Returns true when the most recent tick is a single-tick spike
   * above COLLECTOR_SPIKE_THRESHOLD.
   */
  public isSpike(history: readonly CollectorHistoryEntry[]): boolean {
    return detectPressureSpike(history, COLLECTOR_SPIKE_THRESHOLD);
  }

  /**
   * Returns true when pressure has plateaued for at least COLLECTOR_PLATEAU_TICKS
   * consecutive ticks within COLLECTOR_PLATEAU_TOLERANCE.
   */
  public isPlateau(history: readonly CollectorHistoryEntry[]): boolean {
    return detectPressurePlateau(history, COLLECTOR_PLATEAU_TOLERANCE, COLLECTOR_PLATEAU_TICKS);
  }

  /**
   * Returns true when the trend is currently decelerating (velocity > 0 but
   * acceleration is negative — pressure is still rising but slowing down).
   */
  public isDecelerating(history: readonly CollectorHistoryEntry[]): boolean {
    const v = computeCollectorVelocity(history);
    const a = computeCollectorAcceleration(history);
    return v > 0 && a < -0.005;
  }

  /**
   * Returns true when the trend is actively accelerating (velocity > 0 and
   * acceleration is positive — pressure is rising AND speeding up).
   */
  public isAccelerating(history: readonly CollectorHistoryEntry[]): boolean {
    const v = computeCollectorVelocity(history);
    const a = computeCollectorAcceleration(history);
    return v > 0 && a > 0.005;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5  CollectorForecaster
//     Tick-horizon score and tier projection from velocity and acceleration.
//     Model: score(t) = currentScore + velocity*t + 0.5 * acceleration * t²
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stateless tick-horizon forecast generation.
 *
 * Builds CollectorForecast objects with 5, 10, and 20-tick score projections,
 * time-to-calm, time-to-tier-crossing, escalation likelihood, and recovery
 * probability. Phase-adjusted variants are available via forecastWithPhase().
 *
 * Usage:
 *   const forecaster = new CollectorForecaster();
 *   const forecast   = forecaster.forecast({ currentScore, currentTier, velocity, acceleration });
 */
export class CollectorForecaster {
  public constructor() {}

  /**
   * Build a full CollectorForecast from the supplied params.
   * Falls back to DEFAULT_MAX_DECAY_PER_TICK when maxDecayPerTick is zero.
   */
  public forecast(params: CollectorForecastParams): CollectorForecast {
    return buildCollectorForecast({
      ...params,
      maxDecayPerTick: params.maxDecayPerTick > 0
        ? params.maxDecayPerTick
        : DEFAULT_MAX_DECAY_PER_TICK,
    });
  }

  /**
   * Build a phase-adjusted forecast.
   *
   * Returns the base forecast extended with phaseAdjustedEscalationRisk and
   * phaseAdjustedRecoveryProbability computed from the phase's sensitivity
   * multiplier, escalation penalty, and recovery bonus.
   *
   * SOVEREIGNTY amplifies both escalation risk and recovery difficulty.
   * FOUNDATION softens both.
   */
  public forecastWithPhase(
    currentScore:    number,
    currentTier:     PressureTier,
    velocity:        number,
    acceleration:    number,
    phase:           'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
    maxDecayPerTick: number = DEFAULT_MAX_DECAY_PER_TICK,
  ): CollectorForecast & {
    readonly phaseAdjustedEscalationRisk:    number;
    readonly phaseAdjustedRecoveryProbability: number;
  } {
    const base = buildCollectorForecast({ currentScore, currentTier, velocity, acceleration, maxDecayPerTick });
    const phaseAdjustedEscalationRisk    = computePhaseAdjustedEscalationRisk(currentScore, velocity, currentTier, phase);
    const phaseAdjustedRecoveryProbability = computePhaseAdjustedRecoveryProbability(currentScore, velocity, phase);
    return Object.freeze({ ...base, phaseAdjustedEscalationRisk, phaseAdjustedRecoveryProbability });
  }

  /**
   * Returns the minimum score required to reach the next lower tier.
   * Returns null when already at T0.
   */
  public getNextTierDownTarget(tier: PressureTier): number | null {
    const rank = rankPressureTier(tier);
    if (rank <= 0) return null;
    const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    return getPressureTierMinScore(tiers[rank - 1]!);
  }

  /**
   * Returns the minimum score required to enter the next higher tier.
   * Returns null when already at T4.
   */
  public getNextTierUpTarget(tier: PressureTier): number | null {
    const rank = rankPressureTier(tier);
    if (rank >= 4) return null;
    const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    return getPressureTierMinScore(tiers[rank + 1]!);
  }

  /**
   * Returns true if a forecast's escalation likelihood is at or above
   * the high-escalation threshold (COLLECTOR_ESCALATION_RISK_HIGH).
   */
  public isEscalationImminent(forecast: CollectorForecast): boolean {
    return forecast.escalationLikelihood >= COLLECTOR_ESCALATION_RISK_HIGH;
  }

  /**
   * Returns true if a forecast's recovery likelihood is at or above
   * the high-recovery threshold (COLLECTOR_RECOVERY_PROB_HIGH).
   */
  public isRecoveryLikely(forecast: CollectorForecast): boolean {
    return forecast.recoveryLikelihood >= COLLECTOR_RECOVERY_PROB_HIGH;
  }

  /**
   * Estimate ticks to calm given only score and velocity — no full forecast needed.
   * Returns null if the score is already calm or velocity is not negative.
   */
  public quickTicksToCalm(score: number, velocity: number): number | null {
    if (score < 0.12) return 0;
    const effectiveDecay = velocity < 0 ? Math.abs(velocity) : DEFAULT_MAX_DECAY_PER_TICK;
    if (effectiveDecay <= 0) return null;
    return Math.ceil((score - 0.12) / effectiveDecay);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §6  CollectorAnnotator
//     Stateless annotation and UX hint generation for the backend chat lane.
//     The CollectorAnnotationBundle and CollectorUXHint produced here are the
//     primary per-tick inputs consumed by CollectorSignalAdapter.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Produces CollectorAnnotationBundle and CollectorUXHint objects from raw
 * pressure signal collection data.
 *
 * All methods are stateless — same inputs always produce the same outputs.
 * Exposes individual helper surfaces (chat hook lookup, urgency classification,
 * risk profile, mode/phase profiles) consumed by the chat adapter directly.
 *
 * Usage:
 *   const annotator  = new CollectorAnnotator();
 *   const bundle     = annotator.annotate(params);
 *   const hint       = annotator.buildUXHint(bundle.urgencyLabel, tier, collection, forecast);
 */
export class CollectorAnnotator {
  public constructor() {}

  /**
   * Build a full CollectorAnnotationBundle from tick-level pressure data.
   *
   * Computes and packages: stressIndex, reliefBalance, escalationRisk,
   * recoveryProbability, urgencyLabel, chatHook, tier/band labels,
   * dominant keys, and top contributor lists.
   */
  public annotate(params: CollectorAnnotationParams): CollectorAnnotationBundle {
    return buildCollectorAnnotation(params);
  }

  /**
   * Build a CollectorUXHint for companion speech and overlay display.
   * Requires a pre-computed CollectorForecast for projection fields.
   */
  public buildUXHint(
    urgency:    CollectorUrgencyLabel,
    tier:       PressureTier,
    collection: PressureSignalCollection,
    forecast:   CollectorForecast,
  ): CollectorUXHint {
    return buildCollectorUXHint(urgency, tier, collection, forecast);
  }

  /**
   * Classify urgency from a raw pressure score against COLLECTOR_URGENCY_THRESHOLDS.
   * Fast path for routing decisions before a full annotation is needed.
   */
  public classifyCurrentUrgency(score: number): CollectorUrgencyLabel {
    if (score >= COLLECTOR_URGENCY_THRESHOLDS['CRITICAL']) return 'CRITICAL';
    if (score >= COLLECTOR_URGENCY_THRESHOLDS['HIGH'])     return 'HIGH';
    if (score >= COLLECTOR_URGENCY_THRESHOLDS['MEDIUM'])   return 'MEDIUM';
    if (score >= COLLECTOR_URGENCY_THRESHOLDS['LOW'])      return 'LOW';
    return 'AMBIENT';
  }

  /**
   * Classify urgency from tier, velocity, and consecutive tick count.
   * Full classification rules including sustained T1 elevation.
   */
  public classifyFromTier(
    tier:             PressureTier,
    velocity:         number,
    consecutiveTicks: number,
  ): CollectorUrgencyLabel {
    return classifyUrgency(tier, velocity, consecutiveTicks);
  }

  /**
   * Return the root chat hook key for a given urgency, tier, and dominant signal.
   * Signal-level hook is preferred when urgency is not AMBIENT.
   */
  public getChatHookForCollection(
    urgency:     CollectorUrgencyLabel,
    tier:        PressureTier,
    dominantKey: PressurePositiveSignalKey | null,
  ): string {
    return buildChatHook(urgency, tier, dominantKey);
  }

  /**
   * Returns the full tier-level chat hook map (COLLECTOR_CHAT_HOOK_MAP).
   * Consumed by the chat adapter for tier → dialogue line routing.
   */
  public getTierChatHooks(): Readonly<Record<PressureTier, string>> {
    return COLLECTOR_CHAT_HOOK_MAP;
  }

  /**
   * Returns the full signal-level chat hook map (COLLECTOR_SIGNAL_CHAT_HOOKS).
   * Consumed by the chat adapter for dominant-driver → dialogue line routing.
   */
  public getSignalChatHooks(): Readonly<Record<PressurePositiveSignalKey, string>> {
    return COLLECTOR_SIGNAL_CHAT_HOOKS;
  }

  /**
   * Return the top-N signal contributions ranked by amount descending.
   * Defaults to TOP_PRESSURE_SIGNAL_COUNT when n is not specified.
   */
  public getTopContributors(
    contributions: readonly PressureSignalContribution[],
    n: number = TOP_PRESSURE_SIGNAL_COUNT,
  ): readonly PressureSignalContribution[] {
    return rankTopContributors(contributions, n);
  }

  /**
   * Format a normalized pressure score [0-1] as a percentage string.
   * Example: 0.734 → "73.40%"
   */
  public formatScore(score: number): string {
    return `${scoreToPercentage(score).toFixed(2)}%`;
  }

  /**
   * Classify a numeric escalation risk value against the two alert thresholds.
   * Returns 'HIGH' when risk ≥ COLLECTOR_ESCALATION_RISK_HIGH,
   *         'MEDIUM' when ≥ COLLECTOR_ESCALATION_RISK_MEDIUM,
   *         'NONE' otherwise.
   */
  public getEscalationAlertLevel(risk: number): 'HIGH' | 'MEDIUM' | 'NONE' {
    if (risk >= COLLECTOR_ESCALATION_RISK_HIGH)   return 'HIGH';
    if (risk >= COLLECTOR_ESCALATION_RISK_MEDIUM) return 'MEDIUM';
    return 'NONE';
  }

  /**
   * Returns true when recovery probability is at or above
   * COLLECTOR_RECOVERY_PROB_HIGH — a positive companion signal.
   */
  public isRecoveryStrong(recoveryProbability: number): boolean {
    return recoveryProbability >= COLLECTOR_RECOVERY_PROB_HIGH;
  }

  /**
   * Return the highest-priority available relief signal from the collection
   * using COLLECTOR_RELIEF_PRIORITIES order (first active key wins).
   * Returns null when no relief is active.
   */
  public getReliefPriority(collection: PressureSignalCollection): PressureReliefSignalKey | null {
    for (const key of COLLECTOR_RELIEF_PRIORITIES) {
      const amount = collection.reliefBreakdown[key];
      if (typeof amount === 'number' && amount > 0) return key;
    }
    return null;
  }

  /**
   * Return the CollectorModeProfile for the given game mode.
   * Profiles drive companion speech intensity and escalation threshold routing.
   */
  public getModeProfile(mode: 'solo' | 'pvp' | 'coop' | 'ghost'): CollectorModeProfile {
    return buildCollectorModeProfile(mode);
  }

  /**
   * Return the CollectorPhaseProfile for the given game phase.
   * Profiles drive escalation sensitivity and recovery probability adjustments.
   */
  public getPhaseProfile(
    phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
  ): CollectorPhaseProfile {
    return buildCollectorPhaseProfile(phase);
  }

  /**
   * Returns true when the score exceeds the mode's escalation threshold.
   * Used by the chat adapter to trigger mode-specific urgency routing.
   */
  public isAboveModeEscalationThreshold(
    score: number,
    mode:  'solo' | 'pvp' | 'coop' | 'ghost',
  ): boolean {
    return score >= COLLECTOR_MODE_PROFILES[mode].escalationThreshold;
  }

  /**
   * Returns true when the score is below the mode's de-escalation threshold.
   * Used by the chat adapter to trigger mode-specific recovery callbacks.
   */
  public isBelowModeDeescalationThreshold(
    score: number,
    mode:  'solo' | 'pvp' | 'coop' | 'ghost',
  ): boolean {
    return score < COLLECTOR_MODE_PROFILES[mode].deescalationThreshold;
  }

  /**
   * Returns the tier at which phase-specific danger alerts activate.
   * A score at or above this tier's min warrants heightened companion attention
   * within the active phase.
   */
  public getPhaseDangerFloor(
    phase: 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
  ): PressureTier {
    return COLLECTOR_PHASE_PROFILES[phase].dangerFloorTier;
  }

  /**
   * Compute escalation risk and recovery probability from first principles.
   * Fast path when a full annotation bundle is not yet available for the tick.
   */
  public computeRiskProfile(
    score:    number,
    velocity: number,
    tier:     PressureTier,
  ): { readonly escalationRisk: number; readonly recoveryProbability: number } {
    return Object.freeze({
      escalationRisk:      computeEscalationRisk(score, velocity, tier),
      recoveryProbability: computeRecoveryProbability(score, velocity),
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7  CollectorInspector
//     Tracks tier and band crossings, watermarks, and health state across ticks.
//     Stateful — call update() each tick with prev/new tier and band.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tracks tier and band crossing events, watermarks, escalation counts,
 * and collector health state across the lifetime of a run.
 *
 * update() must be called each tick with the previous and new tier / band.
 * inspect() produces a full frozen CollectorInspectorState snapshot.
 * getHealthState() validates configuration and returns CollectorHealthState.
 *
 * Usage:
 *   const inspector = new CollectorInspector();
 *   inspector.update(prevTier, newTier, prevBand, newBand);
 *   const state = inspector.inspect(history, watermark, mlCount, dlCount, tick);
 */
export class CollectorInspector {
  private readonly version:     string;
  private totalEscalations:     number;
  private totalDeescalations:   number;
  private totalCriticalEnters:  number;
  private bandEscalations:      number;
  private bandDeescalations:    number;
  private doubleEscalations:    number;

  public constructor(version: string = COLLECTOR_MODULE_VERSION) {
    this.version             = version;
    this.totalEscalations    = 0;
    this.totalDeescalations  = 0;
    this.totalCriticalEnters = 0;
    this.bandEscalations     = 0;
    this.bandDeescalations   = 0;
    this.doubleEscalations   = 0;
  }

  /**
   * Process a tier and band transition for this tick.
   *
   * Uses computeTierCrossing and computeBandCrossing to classify the change.
   * Uses rankPressureTier to detect double-tier jumps (rank delta ≥ 2).
   * Uses rankPressureBand to detect double-band jumps.
   */
  public update(
    prevTier: PressureTier,
    newTier:  PressureTier,
    prevBand: PressureBand,
    newBand:  PressureBand,
  ): void {
    const tierCrossing = computeTierCrossing(prevTier, newTier);
    const bandCrossing = computeBandCrossing(prevBand, newBand);

    if (tierCrossing === 'escalation') {
      this.totalEscalations++;
      if (newTier === 'T4') this.totalCriticalEnters++;
      // Detect double-tier escalation (skipping a tier)
      if (rankPressureTier(newTier) - rankPressureTier(prevTier) >= 2) {
        this.doubleEscalations++;
      }
    } else if (tierCrossing === 'deescalation') {
      this.totalDeescalations++;
    }

    if (bandCrossing === 'escalation') {
      this.bandEscalations++;
      // Detect double-band jump using rankPressureBand
      if (rankPressureBand(newBand) - rankPressureBand(prevBand) >= 2) {
        this.doubleEscalations++;
      }
    } else if (bandCrossing === 'deescalation') {
      this.bandDeescalations++;
    }
  }

  /**
   * Build a full CollectorInspectorState snapshot from all accumulated state.
   *
   * Computes running averages for score, reliefBalance, and stressIndex from
   * the provided history slice. The watermark, trend, and forecast are passed
   * in as pre-computed values from the companion classes.
   */
  public inspect(
    history:        readonly CollectorHistoryEntry[],
    watermark:      CollectorWatermark | null,
    mlExtractCount: number,
    dlBuildCount:   number,
    tick:           number,
    trendSummary:   CollectorTrendSummary | null = null,
    forecast:       CollectorForecast | null     = null,
  ): CollectorInspectorState {
    const n      = history.length;
    const latest = n > 0 ? history[n - 1]! : null;

    const avgScore        = n > 0 ? history.reduce((s, e) => s + e.score,         0) / n : 0;
    const avgReliefBal    = n > 0 ? history.reduce((s, e) => s + e.reliefBalance,  0) / n : 0;
    const avgStressIdx    = n > 0 ? history.reduce((s, e) => s + e.stressIndex,    0) / n : 0;

    return Object.freeze({
      version:             this.version,
      tick,
      totalCollections:    n,
      currentScore:        latest?.score  ?? 0,
      currentTier:         latest?.tier   ?? 'T0',
      currentBand:         latest?.band   ?? 'CALM',
      peakScore:           watermark?.score ?? 0,
      peakTick:            watermark?.tick  ?? 0,
      totalEscalations:    this.totalEscalations,
      totalDeescalations:  this.totalDeescalations,
      totalCriticalEnters: this.totalCriticalEnters,
      mlExtractCount,
      dlBuildCount,
      avgScore:            Number(avgScore.toFixed(6)),
      avgReliefBalance:    Number(avgReliefBal.toFixed(6)),
      avgStressIndex:      Number(avgStressIdx.toFixed(6)),
      watermark,
      lastTrendSummary:    trendSummary,
      lastForecast:        forecast,
    });
  }

  /**
   * Update the watermark if the new entry is a new all-time peak.
   * Returns the new watermark, or the existing one unchanged.
   */
  public updateWatermark(
    entry:    CollectorHistoryEntry,
    existing: CollectorWatermark | null,
  ): CollectorWatermark {
    if (existing === null || entry.score > existing.score) {
      return Object.freeze({
        score:     entry.score,
        tick:      entry.tick,
        tier:      entry.tier,
        band:      entry.band,
        timestamp: Date.now(),
      });
    }
    return existing;
  }

  /**
   * Validate the collector's weight config and return a full CollectorHealthState.
   *
   * Uses validateCollectorWeights to check all signal weights.
   * Uses PRESSURE_HISTORY_DEPTH to determine whether the history buffer is
   * mature (has reached the target depth for reliable trend analysis).
   */
  public getHealthState(
    weights:          PressureCollectorWeights,
    limits:           PressureCollectorLimits,
    history:          readonly CollectorHistoryEntry[],
    droppedScores:    number,
    lastClampedScore: number | null,
  ): CollectorHealthState {
    const validation     = validateCollectorWeights(weights);
    const hasHistory     = history.length > 0;
    const limitsValid    = Object.values(limits).every(
      (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
    );
    return Object.freeze({
      initialized:      hasHistory,
      weightsValid:     validation.valid,
      limitsValid,
      droppedScores,
      lastClampedScore,
      hasHistory,
    });
  }

  /**
   * Returns the fraction of PRESSURE_HISTORY_DEPTH that has been filled [0-1].
   * A value < 1.0 means trend analysis results have limited historical context.
   */
  public getHistoryFullnessFraction(history: readonly CollectorHistoryEntry[]): number {
    return Math.min(1, history.length / PRESSURE_HISTORY_DEPTH);
  }

  /**
   * Return the numeric rank [0-4] for the given pressure tier.
   * Useful for chat adapters that need numeric tier context without extra imports.
   */
  public getTierRank(tier: PressureTier): number {
    return rankPressureTier(tier);
  }

  /**
   * Return the numeric rank [0-4] for the given pressure band.
   * Useful for chat adapters that need numeric band context without extra imports.
   */
  public getBandRank(band: PressureBand): number {
    return rankPressureBand(band);
  }

  /** Total tier escalation events since construction. */
  public getTotalEscalations():    number { return this.totalEscalations; }
  /** Total tier de-escalation events since construction. */
  public getTotalDeescalations():  number { return this.totalDeescalations; }
  /** Total times T4 CRITICAL tier was entered. */
  public getTotalCriticalEnters(): number { return this.totalCriticalEnters; }
  /** Total band escalation events. */
  public getBandEscalations():     number { return this.bandEscalations; }
  /** Total band de-escalation events. */
  public getBandDeescalations():   number { return this.bandDeescalations; }
  /** Total double-tier or double-band jump events (severity indicator). */
  public getDoubleEscalations():   number { return this.doubleEscalations; }

  /** Reset all counters. Safe to call between runs. */
  public reset(): void {
    this.totalEscalations    = 0;
    this.totalDeescalations  = 0;
    this.totalCriticalEnters = 0;
    this.bandEscalations     = 0;
    this.bandDeescalations   = 0;
    this.doubleEscalations   = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8  CollectorAnalytics
//     Lifetime running statistics across the full run. Tracks score distribution,
//     stress patterns, mode-adjusted intensity, threat/resilience scores, and
//     ML / DL emission counts.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Accumulates running analytics across every tick of a run.
 *
 * Call update() on each tick after ML extraction completes. Call getSummary()
 * at any point for a frozen snapshot of all accumulated statistics.
 *
 * Uses: computeRunningAvgScore, computeScoreStdDev, computeModeAdjustedStressIndex,
 * computeCollectorThreatScore, computeCollectorResilienceScore, validateCollectorWeights,
 * COLLECTOR_SIGNAL_CATEGORIES, normalizeWeight, computeTierCrossing, rankPressureTier.
 *
 * Usage:
 *   const analytics = new CollectorAnalytics(collector.getWeights());
 *   analytics.update(entry, 'solo', 'FOUNDATION', velocity);
 *   const summary = analytics.getSummary();
 */
export class CollectorAnalytics {
  private readonly weights:         PressureCollectorWeights;
  private readonly scoreHistory:    CollectorHistoryEntry[];
  private totalMLExtracts:          number;
  private totalDLBuilds:            number;
  private tierEscalations:          number;
  private tierDeescalations:        number;
  private highPressureTicks:        number;
  private criticalPressureTicks:    number;
  private peakScore:                number;
  private peakTick:                 number;
  private runningStressIndexSum:    number;
  private runningReliefBalanceSum:  number;
  private runningModeStressSum:     number;
  private runningThreatSum:         number;
  private runningResilienceSum:     number;
  private prevTier:                 PressureTier;
  private configValidationResult:   ReturnType<typeof validateCollectorWeights> | null;

  public constructor(weights: PressureCollectorWeights = DEFAULT_PRESSURE_COLLECTOR_WEIGHTS) {
    this.weights                 = weights;
    this.scoreHistory            = [];
    this.totalMLExtracts         = 0;
    this.totalDLBuilds           = 0;
    this.tierEscalations         = 0;
    this.tierDeescalations       = 0;
    this.highPressureTicks       = 0;
    this.criticalPressureTicks   = 0;
    this.peakScore               = 0;
    this.peakTick                = 0;
    this.runningStressIndexSum   = 0;
    this.runningReliefBalanceSum = 0;
    this.runningModeStressSum    = 0;
    this.runningThreatSum        = 0;
    this.runningResilienceSum    = 0;
    this.prevTier                = 'T0';
    this.configValidationResult  = null;
  }

  /**
   * Record a new tick into the running analytics.
   *
   * Updates: score history, peak tracking, tier crossing counters,
   * high-pressure / critical-pressure tick counters, running stress index,
   * mode-adjusted stress index, threat score, and resilience score.
   */
  public update(
    entry:    CollectorHistoryEntry,
    mode:     'solo' | 'pvp' | 'coop' | 'ghost',
    phase:    'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
    velocity: number,
  ): void {
    // Maintain score history ring buffer
    this.scoreHistory.push(entry);
    if (this.scoreHistory.length > COLLECTOR_HISTORY_DEPTH) {
      this.scoreHistory.shift();
    }

    // Peak score tracking
    if (entry.score > this.peakScore) {
      this.peakScore = entry.score;
      this.peakTick  = entry.tick;
    }

    // Tier crossing counters — uses computeTierCrossing
    const tierCross = computeTierCrossing(this.prevTier, entry.tier);
    if (tierCross === 'escalation')   this.tierEscalations++;
    if (tierCross === 'deescalation') this.tierDeescalations++;
    this.prevTier = entry.tier;

    // High-pressure and critical counters — uses rankPressureTier
    const tierRank = rankPressureTier(entry.tier);
    if (tierRank >= 3)      this.highPressureTicks++;
    if (entry.tier === 'T4') this.criticalPressureTicks++;

    // Running composite indices
    this.runningStressIndexSum   += entry.stressIndex;
    this.runningReliefBalanceSum += entry.reliefBalance;

    // Mode-adjusted stress — uses computeModeAdjustedStressIndex
    this.runningModeStressSum += computeModeAdjustedStressIndex(entry.collection, mode);

    // Threat score — uses computeCollectorThreatScore
    this.runningThreatSum += computeCollectorThreatScore(entry.score, velocity, entry.tier, phase);

    // Resilience score — uses computeCollectorResilienceScore
    this.runningResilienceSum += computeCollectorResilienceScore(entry.score, velocity, entry.reliefBalance);
  }

  /** Increment the ML extract count. Call immediately after CollectorMLExtractor.extract(). */
  public recordMLExtract(): void {
    this.totalMLExtracts++;
  }

  /** Increment the DL build count. Call immediately after CollectorDLBuilder.build(). */
  public recordDLBuild(): void {
    this.totalDLBuilds++;
  }

  /**
   * Return a frozen CollectorAnalyticsSummary from all accumulated data.
   *
   * Uses computeRunningAvgScore and computeScoreStdDev over the score history
   * for statistically accurate mean and standard deviation.
   */
  public getSummary(): CollectorAnalyticsSummary {
    const n           = this.scoreHistory.length;
    const avgScore    = computeRunningAvgScore(this.scoreHistory);
    const stdDevScore = computeScoreStdDev(this.scoreHistory);
    const avgStress   = n > 0 ? this.runningStressIndexSum   / n : 0;
    const avgRelief   = n > 0 ? this.runningReliefBalanceSum / n : 0;

    return Object.freeze({
      totalCollections:      n,
      avgScore,
      stdDevScore,
      peakScore:             this.peakScore,
      peakTick:              this.peakTick,
      tierEscalations:       this.tierEscalations,
      tierDeescalations:     this.tierDeescalations,
      highPressureTicks:     this.highPressureTicks,
      criticalPressureTicks: this.criticalPressureTicks,
      mlExtractCount:        this.totalMLExtracts,
      dlBuildCount:          this.totalDLBuilds,
      avgStressIndex:        Number(avgStress.toFixed(6)),
      avgReliefBalance:      Number(avgRelief.toFixed(6)),
    });
  }

  /**
   * Return a breakdown of active signal counts per category for a collection.
   *
   * Uses COLLECTOR_SIGNAL_CATEGORIES to group the 17 positive pressure signals
   * into economy, shield, battle, temporal, and modeSpecific buckets.
   */
  public getSignalCategoryBreakdown(
    collection: PressureSignalCollection,
  ): Readonly<Record<keyof typeof COLLECTOR_SIGNAL_CATEGORIES, number>> {
    const result: Record<string, number> = {};
    for (const [category, keys] of Object.entries(COLLECTOR_SIGNAL_CATEGORIES)) {
      result[category] = (keys as readonly PressurePositiveSignalKey[]).reduce(
        (sum, key) => sum + ((collection.pressureBreakdown[key] ?? 0) > 0 ? 1 : 0),
        0,
      );
    }
    return Object.freeze(result) as Readonly<Record<keyof typeof COLLECTOR_SIGNAL_CATEGORIES, number>>;
  }

  /**
   * Validate the configured weights and cache the result.
   *
   * Uses validateCollectorWeights for the full health check.
   * Uses normalizeWeight to surface a representative clamped weight value.
   */
  public validateConfig(): {
    readonly valid:                   boolean;
    readonly errors:                  readonly string[];
    readonly sampleNormalizedWeight:  number;
  } {
    const result = validateCollectorWeights(this.weights);
    this.configValidationResult = result;
    return Object.freeze({
      ...result,
      sampleNormalizedWeight: normalizeWeight(this.weights.cash_crisis),
    });
  }

  /** Running mean of the mode-adjusted stress index across all recorded ticks. */
  public getAvgModeStress(): number {
    const n = this.scoreHistory.length;
    return n > 0 ? Number((this.runningModeStressSum / n).toFixed(6)) : 0;
  }

  /** Running mean threat score across all recorded ticks. */
  public getAvgThreatScore(): number {
    const n = this.scoreHistory.length;
    return n > 0 ? Number((this.runningThreatSum / n).toFixed(6)) : 0;
  }

  /** Running mean resilience score across all recorded ticks. */
  public getAvgResilienceScore(): number {
    const n = this.scoreHistory.length;
    return n > 0 ? Number((this.runningResilienceSum / n).toFixed(6)) : 0;
  }

  /** True when validateConfig() has been called at least once. */
  public isConfigValidated(): boolean {
    return this.configValidationResult !== null;
  }

  /** Reset all accumulated data and counters. Safe to call between runs. */
  public reset(): void {
    this.scoreHistory.length     = 0;
    this.totalMLExtracts         = 0;
    this.totalDLBuilds           = 0;
    this.tierEscalations         = 0;
    this.tierDeescalations       = 0;
    this.highPressureTicks       = 0;
    this.criticalPressureTicks   = 0;
    this.peakScore               = 0;
    this.peakTick                = 0;
    this.runningStressIndexSum   = 0;
    this.runningReliefBalanceSum = 0;
    this.runningModeStressSum    = 0;
    this.runningThreatSum        = 0;
    this.runningResilienceSum    = 0;
    this.prevTier                = 'T0';
    this.configValidationResult  = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9  CollectorEnsemble and factory helpers
//     Pre-wired ensemble, one-shot extractors, and bundle builders.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fully-wired ensemble of all collector companion objects.
 * Created by createPressureCollectorWithAnalytics().
 */
export interface CollectorEnsemble {
  readonly collector:   PressureSignalCollector;
  readonly extractor:   CollectorMLExtractor;
  readonly dlBuilder:   CollectorDLBuilder;
  readonly analyzer:    CollectorTrendAnalyzer;
  readonly forecaster:  CollectorForecaster;
  readonly annotator:   CollectorAnnotator;
  readonly inspector:   CollectorInspector;
  readonly analytics:   CollectorAnalytics;
  readonly version:     string;
}

/**
 * Create a fully-wired CollectorEnsemble.
 *
 * All companion objects share the same PressureSignalCollector instance and
 * are connected through the CollectorMLExtractor. This is the recommended
 * factory for production engine use.
 *
 * The inspector and analytics are initialized with the collector's weight
 * config so validation is config-coherent from the first tick.
 *
 *   const ensemble = createPressureCollectorWithAnalytics();
 *   const vector   = ensemble.extractor.extract(snapshot);
 *   const trend    = ensemble.analyzer.analyze(ensemble.extractor.getHistory());
 *   const forecast = ensemble.forecaster.forecast({ ... });
 */
export function createPressureCollectorWithAnalytics(
  opts: {
    weights?: Partial<PressureCollectorWeights>;
    limits?:  Partial<PressureCollectorLimits>;
    version?: string;
  } = {},
): CollectorEnsemble {
  const collector  = new PressureSignalCollector(opts.weights ?? {}, opts.limits ?? {});
  const extractor  = new CollectorMLExtractor(collector);
  const dlBuilder  = new CollectorDLBuilder(extractor);
  const analyzer   = new CollectorTrendAnalyzer();
  const forecaster = new CollectorForecaster();
  const annotator  = new CollectorAnnotator();
  const inspector  = new CollectorInspector(opts.version ?? COLLECTOR_MODULE_VERSION);
  const analytics  = new CollectorAnalytics(collector.getWeights());

  return Object.freeze({
    collector,
    extractor,
    dlBuilder,
    analyzer,
    forecaster,
    annotator,
    inspector,
    analytics,
    version: opts.version ?? COLLECTOR_MODULE_VERSION,
  });
}

/**
 * One-shot ML vector extraction without requiring a pre-built ensemble.
 *
 * Creates a fresh PressureSignalCollector and CollectorMLExtractor, runs
 * a single extract(), and returns the CollectorMLVector. Velocity and
 * acceleration will be zero (no prior history).
 *
 * For sequential analysis across ticks, use createPressureCollectorWithAnalytics.
 */
export function extractCollectorSnapshot(
  snapshot: RunStateSnapshot,
  weights?: Partial<PressureCollectorWeights>,
): CollectorMLVector {
  const collector = new PressureSignalCollector(weights ?? {});
  const extractor = new CollectorMLExtractor(collector);
  return extractor.extract(snapshot);
}

/**
 * Full one-shot pipeline bundle for a single tick.
 *
 * Runs: collect → extract → DL build → trend analyze → forecast → annotate → UX hint
 * Returns all outputs as a frozen record. Velocity and acceleration are zero
 * (no prior history). For multi-tick sequential analysis use the ensemble.
 */
export function buildCollectorBundle(
  snapshot: RunStateSnapshot,
  mode:     'solo' | 'pvp' | 'coop' | 'ghost',
  phase:    'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY',
  weights?: Partial<PressureCollectorWeights>,
): {
  readonly collection:  PressureSignalCollection;
  readonly mlVector:    CollectorMLVector;
  readonly dlTensor:    CollectorDLTensor;
  readonly trend:       CollectorTrendSummary;
  readonly forecast:    CollectorForecast;
  readonly annotation:  CollectorAnnotationBundle;
  readonly uxHint:      CollectorUXHint;
} {
  const ensemble  = createPressureCollectorWithAnalytics({ weights: weights ?? {} });
  const mlVector  = ensemble.extractor.extract(snapshot);
  const history   = ensemble.extractor.getHistory();

  // Retrieve the collection stored in the latest history entry (no double compute)
  const latestEntry = ensemble.extractor.getLatestEntry()!;
  const collection  = latestEntry.collection;

  const dlTensor = ensemble.dlBuilder.build(
    collection,
    snapshot.tick,
    mode,
    phase,
    mlVector.score,
    false,
    false,
  );

  const trend    = ensemble.analyzer.analyze(history);
  const forecast = ensemble.forecaster.forecast({
    currentScore:    mlVector.score,
    currentTier:     mlVector.tier,
    velocity:        trend.velocity,
    acceleration:    trend.acceleration,
    maxDecayPerTick: DEFAULT_MAX_DECAY_PER_TICK,
  });

  const annotation = ensemble.annotator.annotate({
    collection,
    tier:             mlVector.tier,
    band:             mlVector.band,
    tick:             snapshot.tick,
    velocity:         trend.velocity,
    consecutiveTicks: 1,
  });

  const uxHint = ensemble.annotator.buildUXHint(
    annotation.urgencyLabel,
    mlVector.tier,
    collection,
    forecast,
  );

  return Object.freeze({
    collection,
    mlVector,
    dlTensor,
    trend,
    forecast,
    annotation,
    uxHint,
  });
}
