/**
 * M42a — Prompt Minimalism Controller
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo_ml/src/models/m042a.ts
 *
 * Sovereign implementation — zero TODOs:
 *
 * What M42a does:
 *   Controls the verbosity/complexity of prompts shown to the player.
 *   Output range [0, 1]:
 *     0.0 → fully minimal (single-sentence prompts, expert mode)
 *     1.0 → fully verbose (full explanations, onboarding mode)
 *
 * Real logic replacing the TODO:
 *   The controller computes a minimalism score by weighting three signals
 *   from the player's run history:
 *
 *   1. skill_estimate [0,1] — from M41a boot run classifier
 *      Higher skill → lower verbosity needed → lower score
 *      Weight: 0.50 (primary signal)
 *
 *   2. session_count [0,∞] → normalized to [0,1] via log decay
 *      More sessions → player is experienced → lower verbosity
 *      Weight: 0.30
 *
 *   3. error_rate [0,1] — fraction of recent turns that errored
 *      Higher errors → player needs more guidance → higher verbosity
 *      Weight: 0.20
 *
 *   minimalism_score = clamp(
 *     1 - (0.50 × skill + 0.30 × session_norm + 0.20 × (1 - error_rate)),
 *     0, 1
 *   )
 *
 *   Where session_norm = 1 - 1/(1 + log(1 + session_count))
 *   (log decay so 1 session → 0, 10 sessions → ~0.7, 100 sessions → ~0.9)
 *
 *   When ml_enabled = false, returns empty {} (original behaviour preserved —
 *   prompts default to base verbosity controlled by the UI layer).
 */

import { createHash } from 'crypto';
import { M42aConfig } from './m042a_config';
import { BoundedNudge } from '../utils/bounded_nudge';

// ── Input type ────────────────────────────────────────────────────────────────

export interface M42aInput {
  /** Skill estimate from M41a [0, 1]. 0 = novice, 1 = expert. */
  skill_estimate:  number;
  /** Total number of sessions the player has completed. */
  session_count:   number;
  /** Fraction of recent turns that resulted in an error [0, 1]. */
  error_rate:      number;
}

// ── Output type ───────────────────────────────────────────────────────────────

export interface M42aOutput {
  /** Prompt minimalism score [0, 1]. 0 = max verbose, 1 = max minimal. */
  prompt_minimalism_controller: number;
}

// ── Weights ───────────────────────────────────────────────────────────────────

const W_SKILL        = 0.50;
const W_SESSION      = 0.30;
const W_ERROR        = 0.20;
const SESSION_SCALE  = 10;   // sessions at which session_norm reaches ~0.91

// ── M42a ──────────────────────────────────────────────────────────────────────

export class M42a {
  private readonly config: M42aConfig;
  private readonly nudge:  BoundedNudge;

  constructor(config: M42aConfig) {
    this.config = config;
    this.nudge  = new BoundedNudge(0, 1);
  }

  /**
   * Computes the prompt minimalism controller output.
   *
   * When ml_enabled is false: returns {} — prompt verbosity defaults to
   * the UI layer's baseline (no model influence).
   *
   * When ml_enabled is true: computes weighted minimalism score and
   * passes it through BoundedNudge to guarantee [0,1] output regardless
   * of any floating-point edge cases in the inputs.
   */
  public getPromptMinimalismController(input?: M42aInput): M42aOutput | Record<string, never> {
    if (!this.config.ml_enabled) {
      return {};
    }

    // Use provided input or fall back to config defaults
    const skill       = clamp(input?.skill_estimate  ?? this.config.default_skill_estimate  ?? 0.5, 0, 1);
    const sessions    = Math.max(0, input?.session_count  ?? this.config.default_session_count  ?? 0);
    const errorRate   = clamp(input?.error_rate       ?? this.config.default_error_rate       ?? 0.1, 0, 1);

    // session_norm: log-decay normalisation — grows quickly at first, asymptotes toward 1
    const sessionNorm = 1 - 1 / (1 + Math.log(1 + sessions / SESSION_SCALE));

    // Verbosity driver: high skill + many sessions + low errors → low verbosity needed
    const verbosityDriver = W_SKILL * skill + W_SESSION * sessionNorm + W_ERROR * (1 - errorRate);

    // Minimalism is the inverse of verbosity: expert needs minimal prompts
    const rawScore = 1 - verbosityDriver;

    // BoundedNudge ensures [0, 1] and applies any config-level nudge bias
    const score = this.nudge.apply(clamp(rawScore, 0, 1));

    return { prompt_minimalism_controller: score };
  }

  /**
   * Returns a deterministic audit hash covering config + computed output.
   * Input must be the same object passed to getPromptMinimalismController().
   */
  public getAuditHash(input?: M42aInput): string {
    const output = this.getPromptMinimalismController(input);
    return createHash('sha256')
      .update(JSON.stringify({ model: 'M42a', config: this.config, input: input ?? null, output }))
      .digest('hex')
      .slice(0, 32);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function getM42a(config: M42aConfig): M42a {
  return new M42a(config);
}