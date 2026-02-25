/**
 * M42aConfig
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_ml/src/models/m042a_config.ts
 */

export interface M42aConfig {
  /** Toggle ML influence. When false, M42a returns {} and UI defaults take over. */
  ml_enabled: boolean;

  /** Fallback skill estimate when no M41a input is available [0, 1]. Default: 0.5 */
  default_skill_estimate?: number;

  /** Fallback session count when no session data is available. Default: 0 */
  default_session_count?: number;

  /** Fallback error rate when no error data is available [0, 1]. Default: 0.1 */
  default_error_rate?: number;

  /**
   * Optional nudge bias applied by BoundedNudge after score computation.
   * Positive → push score toward 1 (more minimal).
   * Negative → push score toward 0 (more verbose).
   * Range: [-1, 1]. Default: 0 (no bias).
   */
  nudge_bias?: number;
}

/** Production-safe defaults */
export const DEFAULT_M42A_CONFIG: M42aConfig = {
  ml_enabled:              true,
  default_skill_estimate:  0.5,
  default_session_count:   0,
  default_error_rate:      0.1,
  nudge_bias:              0,
};
