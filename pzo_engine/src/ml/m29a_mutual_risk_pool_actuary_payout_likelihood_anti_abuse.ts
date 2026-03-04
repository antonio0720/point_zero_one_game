// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m29a_mutual_risk_pool_actuary_payout_likelihood_anti_abuse.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M29A — Mutual Risk Pool Actuary (Payout Likelihood + Anti-Abuse)
// Core Pair    : M29
// Family       : co_op
// Category     : anomaly_detector
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
// Placement    : server
// Budget       : real_time
// Lock-Off     : NO — always active (integrity / anti-cheat)
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
 * M29A — Mutual Risk Pool Actuary (Payout Likelihood + Anti-Abuse)
 *
 * Primary function:
 *   Actuarially score risk pool payout likelihood; detect coordinated abuse of mutual insurance mechanics
 *
 * What this adds to M29:
 * 1. Actuarially score risk pool payout likelihood given current run state and partner history.
 * 2. Detects coordinated abuse: players gaming mutual insurance for guaranteed payouts.
 * 3. Feeds pool sustainability reports for season balancing.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M29
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M29ATelemetryInput {
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
  // Extended inputs for M29A (co_op family)

}

// Telemetry events subscribed by M29A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M29ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M29AOutput extends M29ABaseOutput {
  payoutProbability: unknown;  // payout_probability
  abuseProbability: unknown;  // abuse_probability
  poolSustainabilityScore: unknown;  // pool_sustainability_score
  coordinatedAbuseFlag: unknown;  // coordinated_abuse_flag
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M29ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M29A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M29ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M29A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M29ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M29A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M29AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M29A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M29APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M29APlacement = 'server';

export interface M29AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M29AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M29AEvalContract {
  /** payout_calibration_ECE */
  /** abuse_detection_AUC */
  /** pool_sustainability_KPI */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M29AModelCard {
  modelId:            'M29A';
  coreMechanicPair:   'M29';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'co_op';
  tier:               M29ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M29A_ML_CONSTANTS = {
  ML_ID:              'M29A',
  CORE_PAIR:          'M29',
  MODEL_NAME:         'Mutual Risk Pool Actuary (Payout Likelihood + Anti-Abuse)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
  FAMILY:             'co_op' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'real_time' as const,
  CAN_LOCK_OFF:        false,
  GUARDRAILS: {
    determinismPreserved:      true,
    boundedNudges:             true,
    auditabilityRequired:      true,
    privacyEnforced:           true,
    competitiveLockOffAllowed: false,
    scoreCap:                  1.0,
    abstainThreshold:          0.35,
  },
  EVAL_FOCUS:         ["payout_calibration_ECE", "abuse_detection_AUC", "pool_sustainability_KPI"],
  PRIMARY_OUTPUTS:    ["payout_probability", "abuse_probability", "pool_sustainability_score", "coordinated_abuse_flag"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM29aMl
 *
 * Fires after M29 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M29AOutput with signed auditHash
 */
export async function runM29aMl(
  input:     M29ATelemetryInput,
  tier:      M29ATier = 'baseline',
  modelCard: Omit<M29AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M29AOutput> {
  // ── TODO: implement M29A — Mutual Risk Pool Actuary (Payout Likelihood + Anti-Abuse) ─────────────────────────────────
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
  // □ Apply output caps: score = Math.min(score, M29A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M29A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M29AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: real_time
  // ExecHook:  after_m29_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M29A (Mutual Risk Pool Actuary (Payout Likelihood + Anti-Abuse)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM29aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M29AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM29aMlFallback(
  _input: M29ATelemetryInput,
): M29AOutput {
  // TODO: implement rule-based fallback for M29A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M29A-specific extended outputs
  throw new Error('M29A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM29aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
