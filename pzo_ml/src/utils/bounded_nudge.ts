/**
 * BoundedNudge
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_ml/src/utils/bounded_nudge.ts
 *
 * Guarantees a model output stays within [min, max] and applies an optional
 * signed bias that nudges the score toward one end without violating bounds.
 *
 * Usage:
 *   const nudge = new BoundedNudge(0, 1, 0.05);  // +5% bias toward max
 *   nudge.apply(0.72);  // → 0.77 (clamped to 1 if over)
 *
 * The bias is applied AFTER clamping so it can never push a boundary value
 * further out of range — the final clamp enforces the invariant unconditionally.
 */

export class BoundedNudge {
  private readonly min:  number;
  private readonly max:  number;
  private readonly bias: number;

  /**
   * @param min   Lower bound (inclusive). Default: 0
   * @param max   Upper bound (inclusive). Default: 1
   * @param bias  Signed additive nudge [-1, 1]. Default: 0
   */
  constructor(min = 0, max = 1, bias = 0) {
    if (min >= max) throw new RangeError(`BoundedNudge: min (${min}) must be < max (${max})`);
    this.min  = min;
    this.max  = max;
    this.bias = Math.min(Math.max(bias, -1), 1); // guard: bias never escapes [-1,1]
  }

  /**
   * Clamps `value` to [min, max], applies bias, then clamps again.
   * The double-clamp ensures the bias never violates bounds.
   *
   * @param value Raw model output
   * @returns     Nudged value guaranteed within [min, max]
   */
  public apply(value: number): number {
    const clamped = Math.min(Math.max(value, this.min), this.max);
    const nudged  = clamped + this.bias * (this.max - this.min);
    return Math.min(Math.max(nudged, this.min), this.max);
  }

  /** Returns a BoundedNudge with bias sourced from a config object if present. */
  static fromConfig(min: number, max: number, config?: { nudge_bias?: number }): BoundedNudge {
    return new BoundedNudge(min, max, config?.nudge_bias ?? 0);
  }
}
