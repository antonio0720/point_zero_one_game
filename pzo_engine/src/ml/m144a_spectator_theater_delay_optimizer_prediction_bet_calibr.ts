// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m144a_spectator_theater_delay_optimizer_prediction_bet_calibr.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M144A — Spectator Theater Delay Optimizer + Prediction Bet Calibrator
// Core Pair    : M144
// Family       : social
// Category     : controller
// IntelSignal  : rewardFit
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : server
// Budget       : real_time
// Lock-Off     : YES — competitive mode can disable balance nudges
//
// ML Design Laws (non-negotiable):
//   ✦ ML can suggest; rules decide — NEVER rewrite resolved ledger history
//   ✦ Bounded nudges — all outputs have explicit caps + monotonic constraints
//   ✦ Auditability — every inference writes (ruleset_version, seed, tick, cap, output)
//   ✦ Privacy — no contact-graph mining; in-session signals only
//
// Density6 LLC · Point Zero One · Confidential · All Rights Reserved
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from 'node:crypto';

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M144A — Spectator Theater Delay Optimizer + Prediction Bet Calibrator
 *
 * Primary function:
 *   Optimize spectator delay to maximize drama without spoiling live outcome; calibrate prediction bet odds for fairness
 *
 * What this adds to M144:
 * 1. Optimize spectator delay to maximize drama without spoiling live outcome.
 * 2. Calibrate prediction bet odds in real time for fair expected value.
 * 3. Anti-collusion: detects when spectators share live run state with active player.
 *
 * Intelligence signal → IntelligenceState.rewardFit
 * Core mechanic pair  → M144
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M144ATelemetryInput {
  runSeed:           string;
  tickIndex:         number;
  rulesetVersion:    string;
  macroRegime:       string;
  portfolioSnapshot: Record<string, unknown>;
  actionTimeline:    Record<string, unknown>[];
  uiInteraction:     Record<string, unknown>;
  socialEvents:      Record<string, unknown>[];
  outcomeEvents:     Record<string, unknown>[];
  ledgerEvents?:     Record<string, unknown>[];
  contractGraph?:    Record<string, unknown>;
  userOptIn:         Record<string, boolean>;
  // Extended inputs for M144A (social family)

}

// Telemetry events subscribed by M144A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M144ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M144AOutput extends M144ABaseOutput {
  optimalDelay: unknown;  // optimal_delay
  calibratedBetOdds: unknown;  // calibrated_bet_odds
  collusionFlag: unknown;  // collusion_flag
  dramaScore: unknown;  // drama_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M144ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M144A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M144ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M144A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M144ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M144A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M144APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M144APlacement = 'server';

export interface M144AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M144AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M144AEvalContract {
  /** delay_drama_lift */
  /** bet_odds_calibration_ECE */
  /** collusion_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M144AModelCard {
  modelId:            'M144A';
  coreMechanicPair:   'M144';
  intelligenceSignal: 'rewardFit';
  modelCategory:      'controller';
  family:             'social';
  tier:               M144ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M144A_ML_CONSTANTS = {
  ML_ID:              'M144A',
  CORE_PAIR:          'M144',
  MODEL_NAME:         'Spectator Theater Delay Optimizer + Prediction Bet Calibrator',
  INTEL_SIGNAL:       'rewardFit' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'social' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'real_time' as const,
  CAN_LOCK_OFF:        true,
  GUARDRAILS: {
    determinismPreserved:      true,
    boundedNudges:             true,
    auditabilityRequired:      true,
    privacyEnforced:           true,
    competitiveLockOffAllowed: true,
    scoreCap:                  1.0,
    abstainThreshold:          0.35,
  },
  EVAL_FOCUS:         ["delay_drama_lift", "bet_odds_calibration_ECE", "collusion_AUC"],
  PRIMARY_OUTPUTS:    ["optimal_delay", "calibrated_bet_odds", "collusion_flag", "drama_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM144aMl
 *
 * Fires after M144 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M144AOutput with signed auditHash
 */
export async function runM144aMl(
  input:     M144ATelemetryInput,
  tier:      M144ATier = 'baseline',
  modelCard: Omit<M144AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M144AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM144aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM144aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M144AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM144aMlFallback(
  _input: M144ATelemetryInput,
): M144AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M144A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    optimalDelay: null,
    calibratedBetOdds: null,
    collusionFlag: null,
    dramaScore: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.rewardFit
// Heuristic substitute (until ML is live):
//   intelligence.rewardFit = momentYieldPerRun * shareEventDensity
// Replace with: runM144aMl(telemetry, tier, modelCard).then(out => intelligence.rewardFit = out.score)
