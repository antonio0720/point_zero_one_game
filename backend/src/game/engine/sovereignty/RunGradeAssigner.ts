/*
 * POINT ZERO ONE — BACKEND SOVEREIGNTY — RUN GRADE ASSIGNER
 * /backend/src/game/engine/sovereignty/RunGradeAssigner.ts
 *
 * Doctrine:
 * - score is derived from backend-authoritative snapshot fields only
 * - no UI-trusted shape is required
 * - badges are honors, not hidden score hacks
 * - ABANDONED always collapses to 0.0000 via outcome multiplier
 * - zero-count cases are explicitly normalized to avoid divide-by-zero drift
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { CORD_WEIGHTS, OUTCOME_MULTIPLIER } from './types';

export type SovereigntyGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface RunGradeComponentBreakdown {
  avgShieldPct: number;
  decisionSpeedScore: number;
  blockedRatio: number;
  brokenRatio: number;
  pressureSurvival: number;
  baseScore: number;
  outcomeMultiplier: number;
}

export interface RunGradeScoreResult {
  score: number;
  grade: SovereigntyGrade;
  badges: string[];
  breakdown: RunGradeComponentBreakdown;
}

export class RunGradeAssigner {
  public score(snapshot: RunStateSnapshot): RunGradeScoreResult {
    const avgShieldPct = this.computeAverageShieldPct(snapshot);
    const decisionSpeedScore = this.computeDecisionSpeedScore(snapshot);
    const blockedRatio = this.computeBlockedRatio(snapshot);
    const brokenRatio = this.computeBrokenRatio(snapshot);
    const pressureSurvival = this.computePressureSurvival(snapshot);

    const weightedBase =
      decisionSpeedScore * CORD_WEIGHTS.decision_speed_score +
      avgShieldPct * CORD_WEIGHTS.shields_maintained_pct +
      blockedRatio * CORD_WEIGHTS.hater_sabotages_blocked +
      brokenRatio * CORD_WEIGHTS.cascade_chains_broken +
      pressureSurvival * CORD_WEIGHTS.pressure_survived_score;

    const outcome = snapshot.outcome ?? 'ABANDONED';
    const outcomeMultiplier =
      OUTCOME_MULTIPLIER[outcome as keyof typeof OUTCOME_MULTIPLIER] ?? 0;

    const finalScore = this.clamp(weightedBase * outcomeMultiplier, 0, 1.5);
    const grade = this.assignGrade(finalScore);
    const badges = this.computeBadges(snapshot, {
      avgShieldPct,
      decisionSpeedScore,
      blockedRatio,
      brokenRatio,
      pressureSurvival,
      baseScore: weightedBase,
      outcomeMultiplier,
    });

    return {
      score: Number(finalScore.toFixed(4)),
      grade,
      badges,
      breakdown: {
        avgShieldPct: Number(avgShieldPct.toFixed(6)),
        decisionSpeedScore: Number(decisionSpeedScore.toFixed(6)),
        blockedRatio: Number(blockedRatio.toFixed(6)),
        brokenRatio: Number(brokenRatio.toFixed(6)),
        pressureSurvival: Number(pressureSurvival.toFixed(6)),
        baseScore: Number(weightedBase.toFixed(6)),
        outcomeMultiplier,
      },
    };
  }

  private computeAverageShieldPct(snapshot: RunStateSnapshot): number {
    const layers = Array.isArray(snapshot.shield.layers) ? snapshot.shield.layers : [];

    if (layers.length === 0) {
      return 0;
    }

    const total = layers.reduce((sum, layer) => {
      if (!Number.isFinite(layer.current) || !Number.isFinite(layer.max) || layer.max <= 0) {
        return sum;
      }

      return sum + this.clamp(layer.current / layer.max, 0, 1);
    }, 0);

    return this.clamp(total / layers.length, 0, 1);
  }

  private computeDecisionSpeedScore(snapshot: RunStateSnapshot): number {
    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];

    if (decisions.length === 0) {
      return 0.5;
    }

    const referenceWindowMs = Math.max(
      1,
      Number.isFinite(snapshot.timers.currentTickDurationMs)
        ? snapshot.timers.currentTickDurationMs
        : 1,
    );

    const total = decisions.reduce((sum, decision) => {
      const latencyMs = this.clamp(
        Number.isFinite(decision.latencyMs) ? decision.latencyMs : referenceWindowMs,
        0,
        referenceWindowMs * 4,
      );

      const timeUsedPct = this.clamp(latencyMs / referenceWindowMs, 0, 1);
      const timingClasses = Array.isArray(decision.timingClass) ? decision.timingClass : [];
      const urgencyBoost = timingClasses.includes('FATE')
        ? 0.08
        : timingClasses.includes('CTR')
          ? 0.04
          : 0;

      const baseScore = decision.accepted
        ? Math.max(0.35, 1 - timeUsedPct * 0.65)
        : Math.max(0.05, 0.45 - timeUsedPct * 0.30);

      return sum + this.clamp(baseScore + urgencyBoost, 0, 1);
    }, 0);

    return this.clamp(total / decisions.length, 0, 1);
  }

  private computeBlockedRatio(snapshot: RunStateSnapshot): number {
    const blocked = Math.max(
      0,
      Number.isFinite(snapshot.shield.blockedThisRun) ? snapshot.shield.blockedThisRun : 0,
    );
    const damaged = Math.max(
      0,
      Number.isFinite(snapshot.shield.damagedThisRun) ? snapshot.shield.damagedThisRun : 0,
    );
    const total = blocked + damaged;

    return total > 0 ? this.clamp(blocked / total, 0, 1) : 1;
  }

  private computeBrokenRatio(snapshot: RunStateSnapshot): number {
    const broken = Math.max(
      0,
      Number.isFinite(snapshot.cascade.brokenChains) ? snapshot.cascade.brokenChains : 0,
    );
    const completed = Math.max(
      0,
      Number.isFinite(snapshot.cascade.completedChains) ? snapshot.cascade.completedChains : 0,
    );
    const total = broken + completed;

    return total > 0 ? this.clamp(broken / total, 0, 1) : 1;
  }

  private computePressureSurvival(snapshot: RunStateSnapshot): number {
    const survivedHighPressureTicks = Math.max(
      0,
      Number.isFinite(snapshot.pressure.survivedHighPressureTicks)
        ? snapshot.pressure.survivedHighPressureTicks
        : 0,
    );

    const observedTicks = Math.max(
      1,
      this.resolveObservedTickCount(snapshot),
    );

    return this.clamp(survivedHighPressureTicks / observedTicks, 0, 1);
  }

  private resolveObservedTickCount(snapshot: RunStateSnapshot): number {
    const fromTick = Number.isFinite(snapshot.tick) ? Math.max(0, Math.trunc(snapshot.tick)) : 0;
    const fromChecksums = Array.isArray(snapshot.sovereignty.tickChecksums)
      ? snapshot.sovereignty.tickChecksums.length
      : 0;
    const fromDecisionTicks = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions.reduce((max, decision) => {
          const tick = Number.isFinite(decision.tick) ? Math.trunc(decision.tick) : 0;
          return Math.max(max, tick + 1);
        }, 0)
      : 0;

    return Math.max(fromTick, fromChecksums, fromDecisionTicks);
  }

  private computeBadges(
    snapshot: RunStateSnapshot,
    breakdown: RunGradeComponentBreakdown,
  ): string[] {
    const badges = new Set<string>();
    const decisions = Array.isArray(snapshot.telemetry.decisions)
      ? snapshot.telemetry.decisions
      : [];
    const fastAcceptedDecisions = decisions.filter((decision) => {
      const windowMs = Math.max(1, snapshot.timers.currentTickDurationMs);
      return decision.accepted && decision.latencyMs <= windowMs * 0.35;
    }).length;

    if (fastAcceptedDecisions >= 3) {
      badges.add('CLUTCH');
    }

    if (
      snapshot.mode === 'solo' &&
      snapshot.modeState.holdEnabled &&
      snapshot.timers.holdCharges === 1 &&
      snapshot.timers.frozenWindowIds.length === 0
    ) {
      badges.add('NO_HOLD_RUN');
    }

    if (snapshot.mode === 'pvp' && snapshot.battle.firstBloodClaimed) {
      badges.add('FIRST_BLOOD');
    }

    if (
      snapshot.mode === 'coop' &&
      Object.values(snapshot.modeState.defectionStepByPlayer).some((step) => step >= 3) &&
      snapshot.outcome === 'FREEDOM'
    ) {
      badges.add('BETRAYAL_SURVIVOR');
    }

    if (snapshot.mode === 'ghost' && snapshot.sovereignty.gapVsLegend >= 0.15) {
      badges.add('GHOST_SLAYER');
    }

    if (breakdown.blockedRatio >= 0.9 && snapshot.shield.blockedThisRun >= 5) {
      badges.add('IRON_WALL');
    }

    if (breakdown.brokenRatio >= 1 && snapshot.cascade.brokenChains >= 3) {
      badges.add('CASCADE_BREAKER');
    }

    if (
      breakdown.pressureSurvival >= 0.6 &&
      snapshot.pressure.maxScoreSeen >= 0.65
    ) {
      badges.add('PRESSURE_WALKER');
    }

    if (
      snapshot.sovereignty.integrityStatus === 'VERIFIED' &&
      typeof snapshot.sovereignty.proofHash === 'string' &&
      snapshot.sovereignty.proofHash.length > 0
    ) {
      badges.add('SEALED_PROOF');
    }

    if (
      snapshot.economy.netWorth > 0 &&
      snapshot.economy.debt <= 0 &&
      snapshot.outcome === 'FREEDOM'
    ) {
      badges.add('CLEAN_LEDGER');
    }

    if (
      snapshot.modeState.bleedMode &&
      breakdown.baseScore >= 0.9 &&
      snapshot.outcome === 'FREEDOM'
    ) {
      badges.add('BLEED_CROWN');
    }

    return [...badges];
  }

  private assignGrade(score: number): SovereigntyGrade {
    if (score >= 1.10) return 'A';
    if (score >= 0.80) return 'B';
    if (score >= 0.55) return 'C';
    if (score >= 0.30) return 'D';
    return 'F';
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }
}