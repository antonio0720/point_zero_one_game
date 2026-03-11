// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/sovereignty/RunGradeAssigner.ts

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
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public computeScore(acc: RunAccumulatorStats): SovereigntyScore {
    const components = this.computeComponents(acc);

    const rawScore =
      (components.ticksSurvivedPct * SOVEREIGNTY_WEIGHTS.TICKS_SURVIVED) +
      (components.shieldsMaintainedPct * SOVEREIGNTY_WEIGHTS.SHIELDS_MAINTAINED) +
      (components.haterBlockRate * SOVEREIGNTY_WEIGHTS.HATER_BLOCKS) +
      (components.decisionSpeedScore * SOVEREIGNTY_WEIGHTS.DECISION_SPEED) +
      (components.cascadeBreakRate * SOVEREIGNTY_WEIGHTS.CASCADE_BREAKS);

    const outcomeMultiplier = OUTCOME_MULTIPLIERS[acc.outcome];
    const finalScore = Math.min(1.5, rawScore * outcomeMultiplier);
    const grade = this.assignGrade(finalScore);

    return {
      components,
      rawScore: this.roundTo(rawScore, 6),
      outcomeMultiplier,
      finalScore: this.roundTo(finalScore, 6),
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
    const safeSeasonBudget = acc.seasonTickBudget > 0 ? acc.seasonTickBudget : 1;

    const ticksSurvivedPct = this.clamp(acc.ticksSurvived / safeSeasonBudget, 0, 1);

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
      ticksSurvivedPct,
      shieldsMaintainedPct,
      haterBlockRate,
      decisionSpeedScore,
      cascadeBreakRate,
    };
  }

  private computeDecisionSpeedScore(records: RunAccumulatorStats['decisionRecords']): number {
    if (records.length === 0) {
      return 0.5;
    }

    const total = records.reduce((sum, record) => {
      const normalized = Number.isFinite(record.speedScore)
        ? this.clamp(record.speedScore, 0, 1)
        : 0;
      return sum + normalized;
    }, 0);

    return this.clamp(total / records.length, 0, 1);
  }

  private assignGrade(finalScore: number): RunGrade {
    if (finalScore >= GRADE_THRESHOLDS.A.min) return 'A';
    if (finalScore >= GRADE_THRESHOLDS.B.min) return 'B';
    if (finalScore >= GRADE_THRESHOLDS.C.min) return 'C';
    if (finalScore >= GRADE_THRESHOLDS.D.min) return 'D';
    return 'F';
  }

  private buildReward(grade: RunGrade): GradeReward {
    const rewards: Record<RunGrade, GradeReward> = {
      A: {
        grade: 'A',
        xpAwarded: 500,
        cosmeticsUnlocked: ['badge_sovereignty_gold'],
        badgeTierEarned: 'GOLD',
        canExportProof: true,
      },
      B: {
        grade: 'B',
        xpAwarded: 300,
        cosmeticsUnlocked: ['badge_sovereignty_silver'],
        badgeTierEarned: 'SILVER',
        canExportProof: true,
      },
      C: {
        grade: 'C',
        xpAwarded: 150,
        cosmeticsUnlocked: [],
        badgeTierEarned: 'BRONZE',
        canExportProof: true,
      },
      D: {
        grade: 'D',
        xpAwarded: 50,
        cosmeticsUnlocked: [],
        badgeTierEarned: 'IRON',
        canExportProof: true,
      },
      F: {
        grade: 'F',
        xpAwarded: 10,
        cosmeticsUnlocked: [],
        badgeTierEarned: 'IRON',
        canExportProof: true,
      },
    };

    const reward = rewards[grade];

    return {
      grade: reward.grade,
      xpAwarded: reward.xpAwarded,
      cosmeticsUnlocked: [...reward.cosmeticsUnlocked],
      badgeTierEarned: reward.badgeTierEarned as BadgeTier,
      canExportProof: reward.canExportProof,
    };
  }

  private roundTo(value: number, digits: number): number {
    const scalar = 10 ** digits;
    return Math.round(value * scalar) / scalar;
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }
}