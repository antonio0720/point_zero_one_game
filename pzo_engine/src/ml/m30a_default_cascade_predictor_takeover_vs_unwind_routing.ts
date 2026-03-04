// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m30a_default_cascade_predictor_takeover_vs_unwind_routing.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M30A — Default Cascade Predictor (Takeover vs Unwind Routing)
// Core Pair    : M30
// Family       : co_op
// Category     : predictor
// IntelSignal  : risk
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M30A — Default Cascade Predictor (Takeover vs Unwind Routing)
 *
 * Primary function:
 *   Predict whether partner default cascades into multi-asset liquidation; propose least-degenerate unwind path
 *
 * What this adds to M30:
 * 1. Predict whether partner default will cascade into multi-asset liquidation and propose the least-degenerate unwind path.
 * 2. Detect betrayal-like patterns (strategic nonpayment) and tighten safeguards without deleting drama.
 * 3. Generates cinematic 'buyout flip' vs 'default wipe' proof cards.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M30
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M30ATelemetryInput {
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
  // Extended inputs for M30A (co_op family)

}

// Telemetry events subscribed by M30A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M30ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M30AOutput extends M30ABaseOutput {
  cascadeProbability: unknown;  // cascade_probability
  unwindPathRecommendation: unknown;  // unwind_path_recommendation
  betrayalPatternFlag: unknown;  // betrayal_pattern_flag
  proofCardRoute: unknown;  // proof_card_route
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M30ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M30A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M30ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M30A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M30ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M30A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M30AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M30A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M30APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M30APlacement = 'server';

export interface M30AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M30AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M30AEvalContract {
  /** cascade_AUC */
  /** betrayal_detection_precision */
  /** unwind_path_optimality */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M30AModelCard {
  modelId:            'M30A';
  coreMechanicPair:   'M30';
  intelligenceSignal: 'risk';
  modelCategory:      'predictor';
  family:             'co_op';
  tier:               M30ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M30A_ML_CONSTANTS = {
  ML_ID:              'M30A',
  CORE_PAIR:          'M30',
  MODEL_NAME:         'Default Cascade Predictor (Takeover vs Unwind Routing)',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'co_op' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["cascade_AUC", "betrayal_detection_precision", "unwind_path_optimality"],
  PRIMARY_OUTPUTS:    ["cascade_probability", "unwind_path_recommendation", "betrayal_pattern_flag", "proof_card_route"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM30aMl
 *
 * Fires after M30 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M30AOutput with signed auditHash
 */
export async function runM30aMl(
  input:     M30ATelemetryInput,
  tier:      M30ATier = 'baseline',
  modelCard: Omit<M30AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M30AOutput> {
  // ── TODO: implement M30A — Default Cascade Predictor (Takeover vs Unwind Routing) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'graph_dl' → GNN over contract / market / ledger graphs (relationship-aware)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M30A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M30A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M30AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: real_time
  // ExecHook:  after_m30_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M30A (Default Cascade Predictor (Takeover vs Unwind Routing)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM30aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M30AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM30aMlFallback(
  _input: M30ATelemetryInput,
): M30AOutput {
  // TODO: implement rule-based fallback for M30A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M30A-specific extended outputs
  throw new Error('M30A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM30aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
