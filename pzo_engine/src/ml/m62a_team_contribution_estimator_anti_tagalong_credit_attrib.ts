// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m62a_team_contribution_estimator_anti_tagalong_credit_attrib.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M62A — Team Contribution Estimator (Anti-Tagalong Credit Attribution)
// Core Pair    : M62
// Family       : co_op
// Category     : predictor
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
// Placement    : server
// Budget       : batch
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
 * M62A — Team Contribution Estimator (Anti-Tagalong Credit Attribution)
 *
 * Primary function:
 *   Estimate individual contribution in team runs; detect tagalong patterns to ensure fair badge attribution
 *
 * What this adds to M62:
 * 1. Estimate individual contribution in team runs using causal attribution.
 * 2. Detect tagalong patterns: players free-riding on teammates for shared achievements.
 * 3. Ensures fair badge attribution with explainable evidence.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M62
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M62ATelemetryInput {
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
  // Extended inputs for M62A (co_op family)

}

// Telemetry events subscribed by M62A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M62ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M62AOutput extends M62ABaseOutput {
  contributionEstimate: unknown;  // contribution_estimate
  tagalongProbability: unknown;  // tagalong_probability
  attributionReceipt: unknown;  // attribution_receipt
  badgeEligibilityScore: unknown;  // badge_eligibility_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M62ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M62A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M62ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M62A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M62ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M62A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M62AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M62A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M62APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M62APlacement = 'server';

export interface M62AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M62AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M62AEvalContract {
  /** attribution_accuracy */
  /** tagalong_detection_AUC */
  /** badge_fairness_rating */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M62AModelCard {
  modelId:            'M62A';
  coreMechanicPair:   'M62';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'predictor';
  family:             'co_op';
  tier:               M62ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M62A_ML_CONSTANTS = {
  ML_ID:              'M62A',
  CORE_PAIR:          'M62',
  MODEL_NAME:         'Team Contribution Estimator (Anti-Tagalong Credit Attribution)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'co_op' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'batch' as const,
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
  EVAL_FOCUS:         ["attribution_accuracy", "tagalong_detection_AUC", "badge_fairness_rating"],
  PRIMARY_OUTPUTS:    ["contribution_estimate", "tagalong_probability", "attribution_receipt", "badge_eligibility_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM62aMl
 *
 * Fires after M62 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M62AOutput with signed auditHash
 */
export async function runM62aMl(
  input:     M62ATelemetryInput,
  tier:      M62ATier = 'baseline',
  modelCard: Omit<M62AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M62AOutput> {
  // ── TODO: implement M62A — Team Contribution Estimator (Anti-Tagalong Credit Attribution) ─────────────────────────────────
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
  // □ Apply output caps: score = Math.min(score, M62A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M62A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M62AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: batch
  // ExecHook:  after_m62_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M62A (Team Contribution Estimator (Anti-Tagalong Credit Attribution)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM62aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M62AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM62aMlFallback(
  _input: M62ATelemetryInput,
): M62AOutput {
  // TODO: implement rule-based fallback for M62A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M62A-specific extended outputs
  throw new Error('M62A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM62aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
