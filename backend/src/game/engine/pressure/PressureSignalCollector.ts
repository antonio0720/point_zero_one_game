/*
 * POINT ZERO ONE — BACKEND PRESSURE SIGNAL COLLECTOR
 * /backend/src/game/engine/pressure/PressureSignalCollector.ts
 *
 * Doctrine:
 * - pressure is not one number; it is a weighted composition of stress and relief
 * - the collector is deterministic, explainable, and mode-aware
 * - output is normalized to 0.0 → 1.0 while preserving raw components
 * - pressure and relief are both first-class so dossier / ML layers can explain why
 */

import type { CascadeChainInstance } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  clampPressureScore,
  createZeroPressureSignalMap,
  DEFAULT_PRESSURE_COLLECTOR_LIMITS,
  DEFAULT_PRESSURE_COLLECTOR_WEIGHTS,
  mergePressureCollectorWeights,
  type PressureCollectorLimits,
  type PressureCollectorWeights,
  type PressurePositiveSignalKey,
  type PressureReliefSignalKey,
  type PressureSignalCollection,
  type PressureSignalContribution,
  type PressureSignalMap,
} from './types';

export class PressureSignalCollector {
  private readonly weights: PressureCollectorWeights;
  private readonly limits: PressureCollectorLimits;

  public constructor(
    weights: Partial<PressureCollectorWeights> = {},
    limits: Partial<PressureCollectorLimits> = {},
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

  public collect(snapshot: RunStateSnapshot): PressureSignalCollection {
    const pressureBreakdown = createZeroPressureSignalMap();
    const reliefBreakdown = createZeroPressureSignalMap();

    const pressureContributions: PressureSignalContribution[] = [];
    const reliefContributions: PressureSignalContribution[] = [];

    this.pushPressure(
      pressureContributions,
      pressureBreakdown,
      'cash_crisis',
      this.cashStress(snapshot),
      `cash=${snapshot.economy.cash}`,
      false,
    );

    this.pushPressure(
      pressureContributions,
      pressureBreakdown,
      'net_worth_collapse',
      this.netWorthStress(snapshot),
      `netWorth=${snapshot.economy.netWorth}`,
      false,
    );

    this.pushPressure(
      pressureContributions,
      pressureBreakdown,
      'cashflow_deficit',
      this.cashflowStress(snapshot),
      `incomePerTick=${snapshot.economy.incomePerTick},expensesPerTick=${snapshot.economy.expensesPerTick}`,
      false,
    );

    this.pushPressure(
      pressureContributions,
      pressureBreakdown,
      'shield_damage',
      this.shieldDamageStress(snapshot),
      `weakestRatio=${snapshot.shield.weakestLayerRatio.toFixed(3)}`,
      false,
    );

    this.pushPressure(
      pressureContributions,
      pressureBreakdown,
      'shield_breach',
      this.shieldBreachStress(snapshot),
      `breachedLayers=${snapshot.shield.layers.filter((layer) => layer.breached).length}`,
      false,
    );

    this.pushPressure(
      pressureContributions,
      pressureBreakdown,
      'attack_queue',
      this.attackQueueStress(snapshot),
      `pendingAttacks=${snapshot.battle.pendingAttacks.length}`,
      false,
    );

    this.pushPressure(
      pressureContributions,
      pressureBreakdown,
      'cascade_pressure',
      this.cascadeStress(snapshot),
      `negativeChains=${this.countNegativeChains(snapshot.cascade.activeChains)}`,
      false,
    );

    this.pushPressure(
      pressureContributions,
      pressureBreakdown,
      'hater_heat',
      this.haterHeatStress(snapshot),
      `haterHeat=${snapshot.economy.haterHeat}`,
      false,
    );

    this.pushPressure(
      pressureContributions,
      pressureBreakdown,
      'phase_pressure',
      this.phaseStress(snapshot),
      `phase=${snapshot.phase}`,
      false,
    );

    this.pushPressure(
      pressureContributions,
      pressureBreakdown,
      'time_burn',
      this.timeBurnStress(snapshot),
      `elapsedMs=${snapshot.timers.elapsedMs},seasonBudgetMs=${snapshot.timers.seasonBudgetMs}`,
      false,
    );

    switch (snapshot.mode) {
      case 'solo':
        this.pushPressure(
          pressureContributions,
          pressureBreakdown,
          'solo_isolation_tax',
          this.soloIsolationStress(snapshot),
          `opportunitiesPurchased=${snapshot.economy.opportunitiesPurchased},tick=${snapshot.tick}`,
          true,
        );

        this.pushPressure(
          pressureContributions,
          pressureBreakdown,
          'bleed_mode_tax',
          this.bleedModeStress(snapshot),
          `bleedMode=${snapshot.modeState.bleedMode}`,
          true,
        );
        break;

      case 'pvp':
        this.pushPressure(
          pressureContributions,
          pressureBreakdown,
          'pvp_rivalry_heat',
          this.pvpRivalryStress(snapshot),
          `rivalryHeatCarry=${snapshot.battle.rivalryHeatCarry}`,
          true,
        );
        break;

      case 'coop':
        this.pushPressure(
          pressureContributions,
          pressureBreakdown,
          'coop_trust_fracture',
          this.coopTrustFractureStress(snapshot),
          `avgTrust=${this.averageTrust(snapshot).toFixed(2)}`,
          true,
        );

        this.pushPressure(
          pressureContributions,
          pressureBreakdown,
          'coop_defection_risk',
          this.coopDefectionRiskStress(snapshot),
          `maxDefectionStep=${this.maxDefectionStep(snapshot)}`,
          true,
        );
        break;

      case 'ghost':
        this.pushPressure(
          pressureContributions,
          pressureBreakdown,
          'ghost_community_heat',
          this.ghostCommunityStress(snapshot),
          `communityHeatModifier=${snapshot.modeState.communityHeatModifier}`,
          true,
        );

        this.pushPressure(
          pressureContributions,
          pressureBreakdown,
          'ghost_gap_pressure',
          this.ghostGapStress(snapshot),
          `gapVsLegend=${snapshot.sovereignty.gapVsLegend}`,
          true,
        );
        break;
    }

    this.pushRelief(
      reliefContributions,
      reliefBreakdown,
      'prosperity_relief',
      this.prosperityRelief(snapshot),
      `netWorth=${snapshot.economy.netWorth},freedomTarget=${snapshot.economy.freedomTarget}`,
      false,
    );

    this.pushRelief(
      reliefContributions,
      reliefBreakdown,
      'full_security_relief',
      this.fullSecurityRelief(snapshot),
      `pendingAttacks=${snapshot.battle.pendingAttacks.length},negativeChains=${this.countNegativeChains(snapshot.cascade.activeChains)}`,
      false,
    );

    this.pushRelief(
      reliefContributions,
      reliefBreakdown,
      'runway_relief',
      this.runwayRelief(snapshot),
      `cash=${snapshot.economy.cash},expensesPerTick=${snapshot.economy.expensesPerTick}`,
      false,
    );

    this.pushRelief(
      reliefContributions,
      reliefBreakdown,
      'income_surplus_relief',
      this.incomeSurplusRelief(snapshot),
      `incomePerTick=${snapshot.economy.incomePerTick},expensesPerTick=${snapshot.economy.expensesPerTick}`,
      false,
    );

    if (snapshot.mode === 'coop') {
      this.pushRelief(
        reliefContributions,
        reliefBreakdown,
        'coop_cohesion_relief',
        this.coopCohesionRelief(snapshot),
        `avgTrust=${this.averageTrust(snapshot).toFixed(2)}`,
        true,
      );
    }

    if (snapshot.mode === 'ghost') {
      this.pushRelief(
        reliefContributions,
        reliefBreakdown,
        'ghost_alignment_relief',
        this.ghostAlignmentRelief(snapshot),
        `gapVsLegend=${snapshot.sovereignty.gapVsLegend}`,
        true,
      );
    }

    const rawPositiveScore = this.sumContributions(pressureContributions);
    const rawReliefScore = this.sumContributions(reliefContributions);
    const rawScore = Number((rawPositiveScore - rawReliefScore).toFixed(6));
    const score = clampPressureScore(rawScore);

    const netBreakdown = this.buildNetBreakdown(
      pressureBreakdown,
      reliefBreakdown,
    );

    return Object.freeze({
      rawPositiveScore,
      rawReliefScore,
      rawScore,
      score,
      contributions: Object.freeze([...pressureContributions]),
      reliefContributions: Object.freeze([...reliefContributions]),
      dominantPressureKey: this.findDominantPressureKey(pressureContributions),
      dominantReliefKey: this.findDominantReliefKey(reliefContributions),
      pressureBreakdown: Object.freeze({ ...pressureBreakdown }) as PressureSignalMap,
      reliefBreakdown: Object.freeze({ ...reliefBreakdown }) as PressureSignalMap,
      netBreakdown: Object.freeze({ ...netBreakdown }) as PressureSignalMap,
    });
  }

  private cashStress(snapshot: RunStateSnapshot): number {
    const cash = snapshot.economy.cash;
    const weight = this.weights.cash_crisis;

    if (cash <= 0) {
      return weight;
    }
    if (cash < this.limits.cashDangerThreshold) {
      return Number((weight * 0.85).toFixed(6));
    }
    if (cash < this.limits.cashWarningThreshold) {
      return Number((weight * 0.55).toFixed(6));
    }
    if (cash < this.limits.cashSoftThreshold) {
      return Number((weight * 0.30).toFixed(6));
    }

    return 0;
  }

  private netWorthStress(snapshot: RunStateSnapshot): number {
    const netWorth = snapshot.economy.netWorth;
    const freedomTarget = Math.max(1, snapshot.economy.freedomTarget);
    const weight = this.weights.net_worth_collapse;

    if (netWorth < 0) {
      return weight;
    }

    if (netWorth < freedomTarget * 0.10) {
      return Number((weight * 0.60).toFixed(6));
    }

    if (netWorth < freedomTarget * 0.25) {
      return Number((weight * 0.30).toFixed(6));
    }

    return 0;
  }

  private cashflowStress(snapshot: RunStateSnapshot): number {
    const income = snapshot.economy.incomePerTick;
    const expenses = snapshot.economy.expensesPerTick;
    const deficit = Math.max(0, expenses - income);

    if (deficit <= 0) {
      return 0;
    }

    const ratio = expenses > 0 ? deficit / expenses : 1;
    const scaled = Math.max(
      this.weights.cashflow_deficit * 0.20,
      Math.min(this.weights.cashflow_deficit, ratio * this.weights.cashflow_deficit),
    );

    return Number(scaled.toFixed(6));
  }

  private shieldDamageStress(snapshot: RunStateSnapshot): number {
    if (snapshot.shield.layers.length === 0) {
      return 0;
    }

    const averageMissingIntegrity =
      snapshot.shield.layers.reduce(
        (sum, layer) => sum + (1 - layer.integrityRatio),
        0,
      ) / snapshot.shield.layers.length;

    const weakestPenalty =
      snapshot.shield.weakestLayerRatio < this.limits.weakShieldThreshold
        ? (this.limits.weakShieldThreshold - snapshot.shield.weakestLayerRatio) /
          this.limits.weakShieldThreshold
        : 0;

    const pressure =
      averageMissingIntegrity * this.weights.shield_damage * 0.70 +
      weakestPenalty * this.weights.shield_damage * 0.30;

    return Number(
      Math.min(this.weights.shield_damage, pressure).toFixed(6),
    );
  }

  private shieldBreachStress(snapshot: RunStateSnapshot): number {
    const breachedLayers = snapshot.shield.layers.filter((layer) => layer.breached).length;

    if (breachedLayers <= 0 && snapshot.shield.weakestLayerRatio > this.limits.criticalShieldThreshold) {
      return 0;
    }

    let pressure =
      Math.min(1, breachedLayers / Math.max(1, snapshot.shield.layers.length)) *
      this.weights.shield_breach;

    if (snapshot.shield.weakestLayerRatio <= this.limits.criticalShieldThreshold) {
      pressure += this.weights.shield_breach * 0.35;
    }

    return Number(
      Math.min(this.weights.shield_breach, pressure).toFixed(6),
    );
  }

  private attackQueueStress(snapshot: RunStateSnapshot): number {
    const queueLength = snapshot.battle.pendingAttacks.length;
    if (queueLength <= 0) {
      return 0;
    }

    const attackMagnitude = snapshot.battle.pendingAttacks.reduce(
      (sum, attack) => sum + Math.max(0, attack.magnitude),
      0,
    );

    const normalized =
      queueLength * 0.40 + Math.min(1.0, attackMagnitude / 100);

    return Number(
      Math.min(this.weights.attack_queue, normalized * this.weights.attack_queue).toFixed(6),
    );
  }

  private cascadeStress(snapshot: RunStateSnapshot): number {
    const activeNegativeChains = this.countNegativeChains(snapshot.cascade.activeChains);
    const activePositiveChains =
      snapshot.cascade.activeChains.length - activeNegativeChains;

    if (activeNegativeChains <= 0 && activePositiveChains <= 0) {
      return 0;
    }

    const pressure =
      activeNegativeChains * this.weights.cascade_pressure * 0.55 +
      activePositiveChains * this.weights.cascade_pressure * 0.10;

    return Number(
      Math.min(this.weights.cascade_pressure, pressure).toFixed(6),
    );
  }

  private haterHeatStress(snapshot: RunStateSnapshot): number {
    const threshold = this.limits.haterHeatThreshold;
    const max = this.limits.haterHeatMax;
    const heat = snapshot.economy.haterHeat;

    if (heat <= threshold) {
      return 0;
    }

    const excess = Math.min(max - threshold, Math.max(0, heat - threshold));
    const normalized = excess / Math.max(1, max - threshold);

    return Number(
      Math.min(this.weights.hater_heat, normalized * this.weights.hater_heat).toFixed(6),
    );
  }

  private phaseStress(snapshot: RunStateSnapshot): number {
    switch (snapshot.phase) {
      case 'FOUNDATION':
        return 0;
      case 'ESCALATION':
        return Number((this.weights.phase_pressure * 0.50).toFixed(6));
      case 'SOVEREIGNTY':
        return this.weights.phase_pressure;
      default:
        return 0;
    }
  }

  private timeBurnStress(snapshot: RunStateSnapshot): number {
    const totalBudget = Math.max(1, snapshot.timers.seasonBudgetMs);
    const elapsedRatio = snapshot.timers.elapsedMs / totalBudget;

    if (elapsedRatio < this.limits.lastThirdStartRatio) {
      return 0;
    }

    const normalized =
      (elapsedRatio - this.limits.lastThirdStartRatio) /
      (1 - this.limits.lastThirdStartRatio);

    return Number(
      Math.min(this.weights.time_burn, normalized * this.weights.time_burn).toFixed(6),
    );
  }

  private soloIsolationStress(snapshot: RunStateSnapshot): number {
    if (snapshot.tick <= this.limits.soloIsolationTickGate) {
      return 0;
    }

    if (snapshot.economy.opportunitiesPurchased > 0) {
      return 0;
    }

    if (snapshot.economy.incomePerTick > snapshot.economy.expensesPerTick) {
      return Number((this.weights.solo_isolation_tax * 0.50).toFixed(6));
    }

    return this.weights.solo_isolation_tax;
  }

  private bleedModeStress(snapshot: RunStateSnapshot): number {
    return snapshot.modeState.bleedMode
      ? this.weights.bleed_mode_tax
      : 0;
  }

  private pvpRivalryStress(snapshot: RunStateSnapshot): number {
    if (snapshot.battle.rivalryHeatCarry <= 0) {
      return 0;
    }

    const normalized = Math.min(1, snapshot.battle.rivalryHeatCarry / 25);

    return Number(
      (normalized * this.weights.pvp_rivalry_heat).toFixed(6),
    );
  }

  private coopTrustFractureStress(snapshot: RunStateSnapshot): number {
    const avgTrust = this.averageTrust(snapshot);

    if (avgTrust >= 70) {
      return 0;
    }

    if (avgTrust <= 30) {
      return this.weights.coop_trust_fracture;
    }

    const normalized = (70 - avgTrust) / 40;
    return Number(
      (normalized * this.weights.coop_trust_fracture).toFixed(6),
    );
  }

  private coopDefectionRiskStress(snapshot: RunStateSnapshot): number {
    const maxStep = this.maxDefectionStep(snapshot);
    if (maxStep <= 0) {
      return 0;
    }

    const normalized = Math.min(1, maxStep / 3);
    return Number(
      (normalized * this.weights.coop_defection_risk).toFixed(6),
    );
  }

  private ghostCommunityStress(snapshot: RunStateSnapshot): number {
    if (snapshot.modeState.communityHeatModifier <= 0) {
      return 0;
    }

    const normalized = Math.min(1, snapshot.modeState.communityHeatModifier / 150);
    return Number(
      (normalized * this.weights.ghost_community_heat).toFixed(6),
    );
  }

  private ghostGapStress(snapshot: RunStateSnapshot): number {
    if (snapshot.sovereignty.gapVsLegend >= 0) {
      return 0;
    }

    const normalized = Math.min(1, Math.abs(snapshot.sovereignty.gapVsLegend) / 0.50);
    return Number(
      (normalized * this.weights.ghost_gap_pressure).toFixed(6),
    );
  }

  private prosperityRelief(snapshot: RunStateSnapshot): number {
    const freedomTarget = snapshot.economy.freedomTarget;
    if (freedomTarget <= 0 || snapshot.economy.netWorth <= 0) {
      return 0;
    }

    const normalized = Math.min(
      1,
      snapshot.economy.netWorth / (2 * freedomTarget),
    );

    return Number(
      (normalized * this.weights.prosperity_relief).toFixed(6),
    );
  }

  private fullSecurityRelief(snapshot: RunStateSnapshot): number {
    const allLayersFull = snapshot.shield.layers.every(
      (layer) => layer.integrityRatio >= 1,
    );
    const noPendingAttacks = snapshot.battle.pendingAttacks.length === 0;
    const noNegativeCascades = this.countNegativeChains(snapshot.cascade.activeChains) === 0;

    return allLayersFull && noPendingAttacks && noNegativeCascades
      ? this.weights.full_security_relief
      : 0;
  }

  private runwayRelief(snapshot: RunStateSnapshot): number {
    const expensesPerTick = snapshot.economy.expensesPerTick;
    if (expensesPerTick <= 0 || snapshot.economy.cash <= 0) {
      return 0;
    }

    const runwayTicks = snapshot.economy.cash / expensesPerTick;
    const normalized = Math.min(
      1,
      runwayTicks / this.limits.cashRunwayMonthsForFullRelief,
    );

    return Number(
      (normalized * this.weights.runway_relief).toFixed(6),
    );
  }

  private incomeSurplusRelief(snapshot: RunStateSnapshot): number {
    const income = snapshot.economy.incomePerTick;
    const expenses = snapshot.economy.expensesPerTick;

    if (income <= expenses || income <= 0) {
      return 0;
    }

    const normalized = Math.min(1, (income - expenses) / income);

    return Number(
      (normalized * this.weights.income_surplus_relief).toFixed(6),
    );
  }

  private coopCohesionRelief(snapshot: RunStateSnapshot): number {
    const avgTrust = this.averageTrust(snapshot);

    if (avgTrust <= 80) {
      return 0;
    }

    const normalized = Math.min(1, (avgTrust - 80) / 20);

    return Number(
      (normalized * this.weights.coop_cohesion_relief).toFixed(6),
    );
  }

  private ghostAlignmentRelief(snapshot: RunStateSnapshot): number {
    if (snapshot.sovereignty.gapVsLegend <= 0) {
      return 0;
    }

    const normalized = Math.min(1, snapshot.sovereignty.gapVsLegend / 0.25);

    return Number(
      (normalized * this.weights.ghost_alignment_relief).toFixed(6),
    );
  }

  private averageTrust(snapshot: RunStateSnapshot): number {
    const values = Object.values(snapshot.modeState.trustScores);
    if (values.length === 0) {
      return 100;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private maxDefectionStep(snapshot: RunStateSnapshot): number {
    const values = Object.values(snapshot.modeState.defectionStepByPlayer);
    if (values.length === 0) {
      return 0;
    }

    return Math.max(...values);
  }

  private countNegativeChains(chains: readonly CascadeChainInstance[]): number {
    return chains.filter((chain) => !chain.positive).length;
  }

  private sumContributions(
    contributions: readonly PressureSignalContribution[],
  ): number {
    return Number(
      contributions.reduce((sum, item) => sum + item.amount, 0).toFixed(6),
    );
  }

  private buildNetBreakdown(
    pressureBreakdown: PressureSignalMap,
    reliefBreakdown: PressureSignalMap,
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
    if (contributions.length === 0) {
      return null;
    }

    const dominant = [...contributions].sort(
      (left, right) => right.amount - left.amount,
    )[0];

    return dominant ? (dominant.key as PressurePositiveSignalKey) : null;
  }

  private findDominantReliefKey(
    contributions: readonly PressureSignalContribution[],
  ): PressureReliefSignalKey | null {
    if (contributions.length === 0) {
      return null;
    }

    const dominant = [...contributions].sort(
      (left, right) => right.amount - left.amount,
    )[0];

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
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

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