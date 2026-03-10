// RunGradeAssigner.ts

import type { EventBus } from '../core/EventBus';
import {
  GRADE_THRESHOLDS,
  OUTCOME_MULTIPLIERS,
  SOVEREIGNTY_WEIGHTS,
} from './types';
import type {
  BadgeTier,
  GradeReward,
  RunAccumulatorStats,
  RunGrade,
  RunRewardDispatchedPayload,
  SovereigntyScore,
  SovereigntyScoreComponents,
} from './types';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — SOVEREIGNTY ENGINE — RUN GRADE ASSIGNER
 * /pzo-web/src/engines/sovereignty/RunGradeAssigner.ts
 *
 * Step 3 of the sovereignty pipeline.
 *
 * Responsibilities:
 *   · normalize and score five sovereignty components
 *   · apply immutable weighting model
 *   · apply immutable outcome multiplier
 *   · assign permanent A–F grade
 *   · dispatch RUN_REWARD_DISPATCHED through EventBus
 *
 * Import rule: may import from types.ts and EventBus ONLY.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export class RunGradeAssigner {
  private static readonly REWARDS: Readonly<Record<RunGrade, GradeReward>> = Object.freeze({
    A: Object.freeze({
      grade: 'A',
      xpAwarded: 500,
      cosmeticsUnlocked: ['badge_sovereignty_gold'],
      badgeTierEarned: 'GOLD',
      canExportProof: true,
    }),
    B: Object.freeze({
      grade: 'B',
      xpAwarded: 300,
      cosmeticsUnlocked: ['badge_sovereignty_silver'],
      badgeTierEarned: 'SILVER',
      canExportProof: true,
    }),
    C: Object.freeze({
      grade: 'C',
      xpAwarded: 150,
      cosmeticsUnlocked: [],
      badgeTierEarned: 'BRONZE',
      canExportProof: true,
    }),
    D: Object.freeze({
      grade: 'D',
      xpAwarded: 50,
      cosmeticsUnlocked: [],
      badgeTierEarned: 'IRON',
      canExportProof: true,
    }),
    F: Object.freeze({
      grade: 'F',
      xpAwarded: 10,
      cosmeticsUnlocked: [],
      badgeTierEarned: 'IRON',
      canExportProof: true,
    }),
  });

  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public computeScore(acc: RunAccumulatorStats): SovereigntyScore {
    const components = this.computeComponents(acc);

    const rawScoreUnclamped =
      components.ticksSurvivedPct * SOVEREIGNTY_WEIGHTS.TICKS_SURVIVED +
      components.shieldsMaintainedPct * SOVEREIGNTY_WEIGHTS.SHIELDS_MAINTAINED +
      components.haterBlockRate * SOVEREIGNTY_WEIGHTS.HATER_BLOCKS +
      components.decisionSpeedScore * SOVEREIGNTY_WEIGHTS.DECISION_SPEED +
      components.cascadeBreakRate * SOVEREIGNTY_WEIGHTS.CASCADE_BREAKS;

    const rawScore = this.roundScore(this.clamp(rawScoreUnclamped, 0, 1));
    const outcomeMultiplier = OUTCOME_MULTIPLIERS[acc.outcome];
    const finalScore = this.roundScore(this.clamp(rawScore * outcomeMultiplier, 0, 1.5));
    const grade = this.assignGrade(finalScore);

    return {
      components,
      rawScore,
      outcomeMultiplier,
      finalScore,
      grade,
      computedAt: Date.now(),
    };
  }

  public async dispatchReward(params: {
    runId: string;
    userId: string;
    score: SovereigntyScore;
  }): Promise<GradeReward> {
    const reward = this.buildReward(params.score.grade);

    const payload: RunRewardDispatchedPayload = {
      runId: params.runId,
      userId: params.userId,
      grade: params.score.grade,
      xp: reward.xpAwarded,
      cosmetics: [...reward.cosmeticsUnlocked],
    };

    this.eventBus.emit('RUN_REWARD_DISPATCHED', payload);
    return reward;
  }

  private computeComponents(acc: RunAccumulatorStats): SovereigntyScoreComponents {
    const ticksSurvivedPct = acc.seasonTickBudget > 0
      ? this.clamp(acc.ticksSurvived / acc.seasonTickBudget, 0, 1)
      : 0;

    const shieldsMaintainedPct = acc.shieldSampleCount > 0
      ? this.clamp((acc.shieldIntegralSum / acc.shieldSampleCount) / 100, 0, 1)
      : 0;

    const haterBlockRate = acc.totalHaterAttempts > 0
      ? this.clamp(acc.haterSabotagesBlocked / acc.totalHaterAttempts, 0, 1)
      : 1;

    const decisionSpeedScore = this.computeDecisionSpeedScore(acc.decisionRecords);

    const cascadeBreakRate = acc.totalCascadeChains > 0
      ? this.clamp(acc.cascadeChainsBreak / acc.totalCascadeChains, 0, 1)
      : 1;

    return {
      ticksSurvivedPct: this.roundComponent(ticksSurvivedPct),
      shieldsMaintainedPct: this.roundComponent(shieldsMaintainedPct),
      haterBlockRate: this.roundComponent(haterBlockRate),
      decisionSpeedScore: this.roundComponent(decisionSpeedScore),
      cascadeBreakRate: this.roundComponent(cascadeBreakRate),
    };
  }

  private computeDecisionSpeedScore(records: RunAccumulatorStats['decisionRecords']): number {
    if (records.length === 0) {
      return 0.5;
    }

    let total = 0;
    for (const record of records) {
      total += this.resolveDecisionSpeedScore(record);
    }

    return this.clamp(total / records.length, 0, 1);
  }

  private resolveDecisionSpeedScore(
    record: RunAccumulatorStats['decisionRecords'][number],
  ): number {
    if (Number.isFinite(record.speedScore) && record.speedScore >= 0 && record.speedScore <= 1) {
      return record.speedScore;
    }

    if (record.wasAutoResolved) {
      return 0;
    }

    if (!Number.isFinite(record.decisionWindowMs) || record.decisionWindowMs <= 0) {
      return 0;
    }

    const resolvedInMs = Number.isFinite(record.resolvedInMs)
      ? this.clamp(record.resolvedInMs, 0, record.decisionWindowMs)
      : record.decisionWindowMs;

    const timeUsedPct = this.clamp(resolvedInMs / record.decisionWindowMs, 0, 1);

    if (record.wasOptimalChoice) {
      return this.clamp(Math.max(0.3, 1 - timeUsedPct * 0.7), 0, 1);
    }

    return this.clamp(Math.max(0, 0.5 - timeUsedPct * 0.3), 0, 1);
  }

  private assignGrade(finalScore: number): RunGrade {
    if (finalScore >= GRADE_THRESHOLDS.A.min) return 'A';
    if (finalScore >= GRADE_THRESHOLDS.B.min) return 'B';
    if (finalScore >= GRADE_THRESHOLDS.C.min) return 'C';
    if (finalScore >= GRADE_THRESHOLDS.D.min) return 'D';
    return 'F';
  }

  private buildReward(grade: RunGrade): GradeReward {
    const reward = RunGradeAssigner.REWARDS[grade];
    return {
      grade: reward.grade,
      xpAwarded: reward.xpAwarded,
      cosmeticsUnlocked: [...reward.cosmeticsUnlocked],
      badgeTierEarned: reward.badgeTierEarned as BadgeTier,
      canExportProof: reward.canExportProof,
    };
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }
    return Math.min(max, Math.max(min, value));
  }

  private roundComponent(value: number): number {
    return Number(value.toFixed(6));
  }

  private roundScore(value: number): number {
    return Number(value.toFixed(6));
  }
}