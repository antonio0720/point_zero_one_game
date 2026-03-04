// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m93a_loadout_lab_constraint_explainer_preview_accuracy_cord.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M93A — Loadout Lab Constraint Explainer (Preview Accuracy + CORD Estimator)
// Core Pair    : M93
// Family       : progression
// Category     : predictor
// IntelSignal  : recommendationPower
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : client, server
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
 * M93A — Loadout Lab Constraint Explainer (Preview Accuracy + CORD Estimator)
 *
 * Primary function:
 *   Explain loadout constraint impact in plain language; provide accurate CORD premium estimates before run start
 *
 * What this adds to M93:
 * 1. Explain loadout constraint impact in plain language before run start.
 * 2. Provide accurate CORD premium estimates — players should never be surprised.
 * 3. Detects mis-configured loadouts that produce degenerate constraint combinations.
 *
 * Intelligence signal → IntelligenceState.recommendationPower
 * Core mechanic pair  → M93
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M93ATelemetryInput {
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
  // Extended inputs for M93A (progression family)

}

// Telemetry events subscribed by M93A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M93ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M93AOutput extends M93ABaseOutput {
  constraintExplanation: unknown;  // constraint_explanation
  cordPremiumEstimate: unknown;  // cord_premium_estimate
  degeneracyFlag: unknown;  // degeneracy_flag
  misconfigurationAlert: unknown;  // misconfiguration_alert
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M93ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M93A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M93ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M93A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M93ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M93A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M93APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M93APlacement = 'client' | 'server';

export interface M93AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M93AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M93AEvalContract {
  /** explanation_clarity_score */
  /** cord_estimate_accuracy */
  /** degeneracy_recall */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M93AModelCard {
  modelId:            'M93A';
  coreMechanicPair:   'M93';
  intelligenceSignal: 'recommendationPower';
  modelCategory:      'predictor';
  family:             'progression';
  tier:               M93ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M93A_ML_CONSTANTS = {
  ML_ID:              'M93A',
  CORE_PAIR:          'M93',
  MODEL_NAME:         'Loadout Lab Constraint Explainer (Preview Accuracy + CORD Estimator)',
  INTEL_SIGNAL:       'recommendationPower' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'progression' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['client', 'server'] as const,
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
  EVAL_FOCUS:         ["explanation_clarity_score", "cord_estimate_accuracy", "degeneracy_recall"],
  PRIMARY_OUTPUTS:    ["constraint_explanation", "cord_premium_estimate", "degeneracy_flag", "misconfiguration_alert"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM93aMl
 *
 * Fires after M93 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M93AOutput with signed auditHash
 */
export async function runM93aMl(
  input:     M93ATelemetryInput,
  tier:      M93ATier = 'baseline',
  modelCard: Omit<M93AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M93AOutput> {
  // ── TODO: implement M93A — Loadout Lab Constraint Explainer (Preview Accuracy + CORD Estimator) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M93A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M93A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M93AOutput — NEVER mutate run state directly
  //
  // Placement: client, server | Budget: real_time
  // ExecHook:  after_m93_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M93A (Loadout Lab Constraint Explainer (Preview Accuracy + CORD Estimator)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM93aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M93AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM93aMlFallback(
  _input: M93ATelemetryInput,
): M93AOutput {
  // TODO: implement rule-based fallback for M93A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M93A-specific extended outputs
  throw new Error('M93A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.recommendationPower
// Heuristic substitute (until ML is live):
//   intelligence.recommendationPower = archetypeMatchScore * noveltyEntropy
// Replace with: runM93aMl(telemetry, tier, modelCard).then(out => intelligence.recommendationPower = out.score)
