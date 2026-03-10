/*
 * POINT ZERO ONE — BACKEND PRESSURE SIGNAL COLLECTOR
 * /backend/src/game/engine/pressure/PressureSignalCollector.ts
 *
 * Doctrine:
 * - pressure is not one signal; it is a blended semantic score
 * - contributions must remain deterministic and mode-aware
 * - score output is normalized to 0.0 → 1.0 for RunStateSnapshot v2
 * - collector should explain why pressure is rising, not only how much
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  clampPressureScore,
  type PressureSignalCollection,
  type PressureSignalContribution,
  type PressureSignalKey,
} from './types';

export class PressureSignalCollector {
  public collect(snapshot: RunStateSnapshot): PressureSignalCollection {
    const contributions: PressureSignalContribution[] = [];

    this.push(
      contributions,
      'cash_crisis',
      this.cashStress(snapshot.economy.cash),
      `cash=${snapshot.economy.cash}`,
    );

    this.push(
      contributions,
      'net_worth_collapse',
      this.netWorthStress(snapshot.economy.netWorth),
      `netWorth=${snapshot.economy.netWorth}`,
    );

    this.push(
      contributions,
      'cashflow_deficit',
      this.cashflowStress(
        snapshot.economy.incomePerTick,
        snapshot.economy.expensesPerTick,
      ),
      `income=${snapshot.economy.incomePerTick},expenses=${snapshot.economy.expensesPerTick}`,
    );

    this.push(
      contributions,
      'shield_damage',
      this.shieldDamageStress(snapshot),
      `weakestRatio=${snapshot.shield.weakestLayerRatio.toFixed(3)}`,
    );

    this.push(
      contributions,
      'shield_breach',
      this.shieldBreachStress(snapshot),
      `breaches=${snapshot.shield.layers.filter((layer) => layer.breached).length}`,
    );

    this.push(
      contributions,
      'attack_queue',
      Math.min(0.12, snapshot.battle.pendingAttacks.length * 0.03),
      `pendingAttacks=${snapshot.battle.pendingAttacks.length}`,
    );

    this.push(
      contributions,
      'cascade_pressure',
      Math.min(0.12, snapshot.cascade.activeChains.length * 0.045),
      `activeChains=${snapshot.cascade.activeChains.length}`,
    );

    this.push(
      contributions,
      'hater_heat',
      Math.min(0.08, snapshot.economy.haterHeat / 1250),
      `haterHeat=${snapshot.economy.haterHeat}`,
    );

    this.push(
      contributions,
      'phase_pressure',
      this.phaseStress(snapshot),
      `phase=${snapshot.phase}`,
    );

    this.push(
      contributions,
      'time_burn',
      this.timeBurnStress(snapshot),
      `elapsedMs=${snapshot.timers.elapsedMs}`,
    );

    switch (snapshot.mode) {
      case 'solo':
        this.push(
          contributions,
          snapshot.modeState.bleedMode ? 'bleed_mode_tax' : 'solo_isolation_tax',
          this.soloModeStress(snapshot),
          `opportunitiesPurchased=${snapshot.economy.opportunitiesPurchased},bleed=${snapshot.modeState.bleedMode}`,
        );
        break;

      case 'pvp':
        this.push(
          contributions,
          'pvp_rivalry_heat',
          Math.min(0.05, snapshot.battle.rivalryHeatCarry / 500),
          `rivalryHeatCarry=${snapshot.battle.rivalryHeatCarry}`,
        );
        break;

      case 'coop':
        this.push(
          contributions,
          'coop_trust_fracture',
          this.coopTrustStress(snapshot),
          `avgTrust=${this.averageTrust(snapshot).toFixed(2)}`,
        );

        this.push(
          contributions,
          'coop_defection_risk',
          this.coopDefectionStress(snapshot),
          `defectionMax=${this.maxDefectionStep(snapshot)}`,
        );
        break;

      case 'ghost':
        this.push(
          contributions,
          'ghost_community_heat',
          Math.min(0.06, snapshot.modeState.communityHeatModifier / 2500),
          `communityHeatModifier=${snapshot.modeState.communityHeatModifier}`,
        );

        this.push(
          contributions,
          'ghost_gap_pressure',
          this.ghostGapStress(snapshot),
          `gapVsLegend=${snapshot.sovereignty.gapVsLegend}`,
        );
        break;
    }

    const rawScore = contributions.reduce((sum, item) => sum + item.amount, 0);
    const score = clampPressureScore(rawScore);

    return {
      rawScore: Number(rawScore.toFixed(6)),
      score,
      contributions,
    };
  }

  private cashStress(cash: number): number {
    if (cash <= 0) {
      return 0.26;
    }
    if (cash < 2000) {
      return 0.22;
    }
    if (cash < 5000) {
      return 0.14;
    }
    if (cash < 10000) {
      return 0.08;
    }
    return 0;
  }

  private netWorthStress(netWorth: number): number {
    if (netWorth < 0) {
      return 0.08;
    }
    if (netWorth < 10000) {
      return 0.03;
    }
    return 0;
  }

  private cashflowStress(incomePerTick: number, expensesPerTick: number): number {
    const deficit = Math.max(0, expensesPerTick - incomePerTick);
    if (deficit <= 0) {
      return 0;
    }

    const ratio =
      expensesPerTick > 0 ? deficit / expensesPerTick : 1;

    return Math.min(0.16, Number((0.02 + ratio * 0.18).toFixed(6)));
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

    return Number(Math.min(0.18, averageMissingIntegrity * 0.18).toFixed(6));
  }

  private shieldBreachStress(snapshot: RunStateSnapshot): number {
    const breachedLayers = snapshot.shield.layers.filter((layer) => layer.breached).length;

    let stress = breachedLayers * 0.06;

    if (snapshot.shield.weakestLayerRatio <= 0.15) {
      stress += 0.04;
    }

    return Number(Math.min(0.14, stress).toFixed(6));
  }

  private phaseStress(snapshot: RunStateSnapshot): number {
    switch (snapshot.phase) {
      case 'FOUNDATION':
        return 0;
      case 'ESCALATION':
        return 0.03;
      case 'SOVEREIGNTY':
        return 0.06;
      default:
        return 0;
    }
  }

  private timeBurnStress(snapshot: RunStateSnapshot): number {
    const totalBudget = Math.max(1, snapshot.timers.seasonBudgetMs);
    const elapsedRatio = snapshot.timers.elapsedMs / totalBudget;

    if (elapsedRatio < 2 / 3) {
      return 0;
    }

    return Number(Math.min(0.05, (elapsedRatio - 2 / 3) * 0.15).toFixed(6));
  }

  private soloModeStress(snapshot: RunStateSnapshot): number {
    if (snapshot.economy.opportunitiesPurchased > 0 || snapshot.tick <= 10) {
      return 0;
    }

    return snapshot.modeState.bleedMode ? 0.05 : 0.03;
  }

  private coopTrustStress(snapshot: RunStateSnapshot): number {
    const averageTrust = this.averageTrust(snapshot);

    if (averageTrust >= 70) {
      return 0;
    }

    if (averageTrust <= 30) {
      return 0.06;
    }

    return Number((((70 - averageTrust) / 40) * 0.06).toFixed(6));
  }

  private coopDefectionStress(snapshot: RunStateSnapshot): number {
    const maxStep = this.maxDefectionStep(snapshot);

    if (maxStep <= 0) {
      return 0;
    }

    return Number(Math.min(0.06, maxStep * 0.02).toFixed(6));
  }

  private ghostGapStress(snapshot: RunStateSnapshot): number {
    if (snapshot.sovereignty.gapVsLegend >= 0) {
      return 0;
    }

    return Number(Math.min(0.04, Math.abs(snapshot.sovereignty.gapVsLegend) * 0.08).toFixed(6));
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

  private push(
    contributions: PressureSignalContribution[],
    key: PressureSignalKey,
    amount: number,
    reason: string,
  ): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    contributions.push({
      key,
      amount: Number(amount.toFixed(6)),
      reason,
    });
  }
}