//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/sovereignty/RunGradeAssigner.ts

// ═══════════════════════════════════════════════════════════════════
// POINT ZERO ONE — SOVEREIGNTY ENGINE — RUN GRADE ASSIGNER
// Density6 LLC · Confidential · Do not distribute
//
// Responsibilities:
//   · Step 3 of the 3-step sovereignty pipeline: GRADE ASSIGNMENT + REWARD DISPATCH
//   · Compute all five normalized score components (0.0–1.0 each)
//   · Apply SOVEREIGNTY_WEIGHTS to produce rawScore
//   · Apply outcome_multiplier to produce finalScore (0.0–1.5)
//   · Assign letter grade via GRADE_THRESHOLDS brackets
//   · Build GradeReward payload and dispatch RUN_REWARD_DISPATCHED via EventBus
//
// Import rules: may import from types.ts and EventBus ONLY.
// ═══════════════════════════════════════════════════════════════════

import type { EventBus } from '../core/EventBus';
import type {
  RunAccumulatorStats,
  SovereigntyScore,
  SovereigntyScoreComponents,
  GradeReward,
  RunGrade,
  BadgeTier,
} from './types';
import {
  SOVEREIGNTY_WEIGHTS,
  OUTCOME_MULTIPLIERS,
  GRADE_THRESHOLDS,
} from './types';

export class RunGradeAssigner {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ── PUBLIC: COMPUTE SCORE ─────────────────────────────────────────
  /**
   * Compute the full SovereigntyScore for a completed run.
   *
   * Phase 1: computeComponents() normalizes all five raw inputs to 0.0–1.0.
   * Phase 2: Weighted sum via SOVEREIGNTY_WEIGHTS (weights sum to 1.0).
   * Phase 3: Multiply by OUTCOME_MULTIPLIERS[outcome] → finalScore.
   * Phase 4: Cap finalScore at 1.5 (defensive — FREEDOM*1.0 raw is the ceiling).
   * Phase 5: assignGrade() maps finalScore to letter grade via GRADE_THRESHOLDS.
   */
  public computeScore(acc: RunAccumulatorStats): SovereigntyScore {
    const components = this.computeComponents(acc);

    const rawScore =
      (components.ticksSurvivedPct     * SOVEREIGNTY_WEIGHTS.TICKS_SURVIVED) +
      (components.shieldsMaintainedPct * SOVEREIGNTY_WEIGHTS.SHIELDS_MAINTAINED) +
      (components.haterBlockRate       * SOVEREIGNTY_WEIGHTS.HATER_BLOCKS) +
      (components.decisionSpeedScore   * SOVEREIGNTY_WEIGHTS.DECISION_SPEED) +
      (components.cascadeBreakRate     * SOVEREIGNTY_WEIGHTS.CASCADE_BREAKS);

    const outcomeMultiplier = OUTCOME_MULTIPLIERS[acc.outcome];
    const finalScore        = Math.min(1.5, rawScore * outcomeMultiplier);
    const grade             = this.assignGrade(finalScore);

    return {
      components,
      rawScore,
      outcomeMultiplier,
      finalScore,
      grade,
      computedAt: Date.now(),
    };
  }

  // ── PUBLIC: DISPATCH REWARD ───────────────────────────────────────
  /**
   * Build the GradeReward for the assigned grade and emit RUN_REWARD_DISPATCHED.
   * The backend listener writes XP + cosmetic unlocks to the DB.
   * This method is async to match the pipeline contract but is synchronous internally.
   */
  public async dispatchReward(params: {
    runId:  string;
    userId: string;
    score:  SovereigntyScore;
  }): Promise<GradeReward> {
    const reward = this.buildReward(params.score.grade);

    this.eventBus.emit('RUN_REWARD_DISPATCHED', {
      runId:     params.runId,
      userId:    params.userId,
      grade:     params.score.grade,
      xp:        reward.xpAwarded,
      cosmetics: reward.cosmeticsUnlocked,
    });

    return reward;
  }

  // ── PRIVATE: COMPUTE COMPONENTS ───────────────────────────────────
  /**
   * Normalize all five raw accumulator values to floats in [0.0, 1.0].
   *
   * Zero-count default rules (enforced here, not at call sites):
   *   · totalHaterAttempts = 0 → haterBlockRate = 1.0   (perfect defense)
   *   · totalCascadeChains = 0 → cascadeBreakRate = 1.0  (perfect cascade record)
   *   · decisionRecords.length = 0 → decisionSpeedScore = 0.5 (neutral)
   *   · shieldSampleCount = 0 → shieldsMaintainedPct = 0.0
   */
  private computeComponents(acc: RunAccumulatorStats): SovereigntyScoreComponents {
    // ── Ticks survived pct ────────────────────────────────────────
    const ticksSurvivedPct = acc.ticksSurvived / acc.seasonTickBudget;

    // ── Shields maintained (time-average) ────────────────────────
    // shieldIntegralSum is the sum of 0–100 values, one per tick.
    // Divide by sampleCount to get avg 0–100, then /100 to normalize to 0–1.
    const shieldsMaintainedPct = acc.shieldSampleCount > 0
      ? (acc.shieldIntegralSum / acc.shieldSampleCount) / 100.0
      : 0.0;

    // ── Hater block rate ─────────────────────────────────────────
    const haterBlockRate = acc.totalHaterAttempts > 0
      ? acc.haterSabotagesBlocked / acc.totalHaterAttempts
      : 1.0;  // No hater attempts = perfect defense by default

    // ── Decision speed score ─────────────────────────────────────
    const decisionSpeedScore = this.computeDecisionSpeedScore(acc.decisionRecords);

    // ── Cascade break rate ────────────────────────────────────────
    const cascadeBreakRate = acc.totalCascadeChains > 0
      ? acc.cascadeChainsBreak / acc.totalCascadeChains
      : 1.0;  // No cascades triggered = perfect cascade record

    return {
      ticksSurvivedPct,
      shieldsMaintainedPct,
      haterBlockRate,
      decisionSpeedScore,
      cascadeBreakRate,
    };
  }

  // ── PRIVATE: DECISION SPEED SCORE ────────────────────────────────
  /**
   * Aggregate per-decision speedScore values into a single normalized float.
   *
   * Per-decision speedScore is stored on DecisionRecord.speedScore (pre-computed):
   *   · wasAutoResolved          → 0.0
   *   · wasOptimalChoice         → linear: max(0.3, 1.0 - (resolvedInMs/windowMs * 0.7))
   *   · player chose, suboptimal → linear: max(0.0, 0.5 - (resolvedInMs/windowMs * 0.3))
   *
   * Aggregate: arithmetic mean across all decisions.
   * Empty records → 0.5 (neutral — no forced decisions in the run).
   */
  private computeDecisionSpeedScore(
    records: RunAccumulatorStats['decisionRecords'],
  ): number {
    if (records.length === 0) return 0.5;
    const total = records.reduce((sum, d) => sum + d.speedScore, 0);
    return total / records.length;
  }

  // ── PRIVATE: ASSIGN GRADE ─────────────────────────────────────────
  /**
   * Map finalScore to a letter grade via GRADE_THRESHOLDS.
   * Thresholds are checked from highest to lowest.
   * A score of exactly 0.0 (ABANDONED) correctly resolves to 'F'.
   */
  private assignGrade(finalScore: number): RunGrade {
    if (finalScore >= GRADE_THRESHOLDS.A.min) return 'A';
    if (finalScore >= GRADE_THRESHOLDS.B.min) return 'B';
    if (finalScore >= GRADE_THRESHOLDS.C.min) return 'C';
    if (finalScore >= GRADE_THRESHOLDS.D.min) return 'D';
    return 'F';
  }

  // ── PRIVATE: BUILD REWARD ─────────────────────────────────────────
  /**
   * Grade → GradeReward lookup table.
   *
   * Grade  XP    Badge      Cosmetics
   * ─────  ────  ─────────  ───────────────────────────────────────
   * A      500   GOLD       badge_sovereignty_gold + premium proof card
   * B      300   SILVER     badge_sovereignty_silver + proof card
   * C      150   BRONZE     proof card only
   * D       50   IRON       none
   * F       10   IRON       none
   *
   * canExportProof = true for ALL grades — the $0.99 gate is at the commerce layer.
   */
  private buildReward(grade: RunGrade): GradeReward {
    const REWARDS: Record<RunGrade, GradeReward> = {
      A: {
        grade:             'A',
        xpAwarded:         500,
        cosmeticsUnlocked: ['badge_sovereignty_gold'],
        badgeTierEarned:   'GOLD'   as BadgeTier,
        canExportProof:    true,
      },
      B: {
        grade:             'B',
        xpAwarded:         300,
        cosmeticsUnlocked: ['badge_sovereignty_silver'],
        badgeTierEarned:   'SILVER' as BadgeTier,
        canExportProof:    true,
      },
      C: {
        grade:             'C',
        xpAwarded:         150,
        cosmeticsUnlocked: [],
        badgeTierEarned:   'BRONZE' as BadgeTier,
        canExportProof:    true,
      },
      D: {
        grade:             'D',
        xpAwarded:         50,
        cosmeticsUnlocked: [],
        badgeTierEarned:   'IRON'   as BadgeTier,
        canExportProof:    true,
      },
      F: {
        grade:             'F',
        xpAwarded:         10,
        cosmeticsUnlocked: [],
        badgeTierEarned:   'IRON'   as BadgeTier,
        canExportProof:    true,
      },
    };
    return REWARDS[grade];
  }
}