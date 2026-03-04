// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m16a_consensus_vs_contrarian_predictor_hot_seat_vote.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M16A — Consensus vs Contrarian Predictor (Hot Seat Vote)
// Core Pair    : M16
// Family       : social
// Category     : predictor
// IntelSignal  : recommendationPower
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

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M16A — Consensus vs Contrarian Predictor (Hot Seat Vote)
 *
 * Primary function:
 *   Predict vote outcome distribution and surface minority-view confidence to improve decision quality at the table
 *
 * What this adds to M16:
 * 1. Predict vote outcome distribution and surface contrarian confidence where minority view is well-founded.
 * 2. Reduces groupthink at the table without overriding player choice.
 * 3. Feeds 'surprising consensus' share-moment detection.
 *
 * Intelligence signal → IntelligenceState.recommendationPower
 * Core mechanic pair  → M16
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M16ATelemetryInput {
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
  // Extended inputs for M16A (social family)

}

// Telemetry events subscribed by M16A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M16ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M16AOutput extends M16ABaseOutput {
  voteDistributionPrediction: unknown;  // vote_distribution_prediction
  contrarianConfidence: unknown;  // contrarian_confidence
  groupthinkFlag: unknown;  // groupthink_flag
  consensusMomentFlag: unknown;  // consensus_moment_flag
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M16ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M16A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M16ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M16A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M16ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M16A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M16APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M16APlacement = 'server';

export interface M16AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M16AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M16AEvalContract {
  /** vote_calibration_ECE */
  /** contrarian_surface_precision */
  /** groupthink_reduction_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M16AModelCard {
  modelId:            'M16A';
  coreMechanicPair:   'M16';
  intelligenceSignal: 'recommendationPower';
  modelCategory:      'predictor';
  family:             'social';
  tier:               M16ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M16A_ML_CONSTANTS = {
  ML_ID:              'M16A',
  CORE_PAIR:          'M16',
  MODEL_NAME:         'Consensus vs Contrarian Predictor (Hot Seat Vote)',
  INTEL_SIGNAL:       'recommendationPower' as const,
  MODEL_CATEGORY:     'predictor' as const,
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
  EVAL_FOCUS:         ["vote_calibration_ECE", "contrarian_surface_precision", "groupthink_reduction_rate"],
  PRIMARY_OUTPUTS:    ["vote_distribution_prediction", "contrarian_confidence", "groupthink_flag", "consensus_moment_flag"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM16aMl
 *
 * Fires after M16 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M16AOutput with signed auditHash
 */
export async function runM16aMl(
  input:     M16ATelemetryInput,
  tier:      M16ATier = 'baseline',
  modelCard: Omit<M16AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M16AOutput> {
  // ── TODO: implement M16A — Consensus vs Contrarian Predictor (Hot Seat Vote) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M16A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M16A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M16AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: real_time
  // ExecHook:  after_m16_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M16A (Consensus vs Contrarian Predictor (Hot Seat Vote)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM16aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M16AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM16aMlFallback(
  _input: M16ATelemetryInput,
): M16AOutput {
  // TODO: implement rule-based fallback for M16A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M16A-specific extended outputs
  throw new Error('M16A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.recommendationPower
// Heuristic substitute (until ML is live):
//   intelligence.recommendationPower = archetypeMatchScore * noveltyEntropy
// Replace with: runM16aMl(telemetry, tier, modelCard).then(out => intelligence.recommendationPower = out.score)
