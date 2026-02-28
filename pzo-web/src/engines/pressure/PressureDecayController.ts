/**
 * FILE: pzo-web/src/engines/pressure/PressureDecayController.ts
 * Stateful decay controller. Ensures pressure cannot drop more than 0.05/tick.
 * Models psychological inertia of financial relief.
 * Imports from types.ts only.
 */

/** Maximum pressure reduction per tick. Governs recovery speed. */
export const MAX_DECAY_PER_TICK = 0.05;
// 1.0 / 0.05 = 20 ticks minimum to fully recover from CRITICAL (score 1.0) to CALM (0.0)
// 0.80 / 0.05 = 16 ticks minimum from HIGH floor to CALM

export class PressureDecayController {
  private currentScore: number;

  constructor(initialScore: number = 0.0) {
    this.currentScore = Math.max(0, Math.min(1, initialScore));
  }

  /**
   * Apply decay constraints to the raw score from PressureSignalCollector.
   * Pressure jumps up instantly. Pressure can only fall by MAX_DECAY_PER_TICK per tick.
   *
   * @param rawScore  Unconstrained score from this tick's signals.
   * @returns         New score, clamped to [0.0, 1.0].
   */
  public applyDecay(rawScore: number): number {
    let next: number;

    if (rawScore >= this.currentScore) {
      // Pressure increases: jump immediately — no delay on the way up
      next = rawScore;
    } else {
      // Pressure decreases: cannot drop more than MAX_DECAY_PER_TICK from current
      next = Math.max(rawScore, this.currentScore - MAX_DECAY_PER_TICK);
    }

    this.currentScore = Math.max(0, Math.min(1, next));
    return this.currentScore;
  }

  /** Read current score without modifying state. */
  public getCurrentScore(): number {
    return this.currentScore;
  }

  /**
   * How many ticks until score reaches targetScore (assuming rawScore = 0.0 each tick).
   * Used for UI tooltip: "X ticks to recover".
   */
  public ticksToReach(targetScore: number): number {
    if (this.currentScore <= targetScore) return 0;
    return Math.ceil((this.currentScore - targetScore) / MAX_DECAY_PER_TICK);
  }

  /** Full reset — called by EngineOrchestrator on run start. */
  public reset(): void {
    this.currentScore = 0.0;
  }

  /**
   * Force-set score (admin/tutorial/test only).
   * Hard jump — bypasses decay. Never call during live gameplay tick.
   */
  public forceScore(score: number): void {
    this.currentScore = Math.max(0, Math.min(1, score));
  }
}
