// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m09a_opportunity_value_model_regret_stamp_generator.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M09A — Opportunity Value Model + Regret Stamp Generator
// Core Pair    : M09
// Family       : market
// Category     : predictor
// IntelSignal  : alpha
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
 * M09A — Opportunity Value Model + Regret Stamp Generator
 *
 * Primary function:
 *   Score opportunity value in context; generate regret stamps when a passed opportunity later proves pivotal
 *
 * What this adds to M09:
 * 1. Score opportunity value in the context of the player's current position and macro regime.
 * 2. Generates a regret stamp when a passed opportunity later proves pivotal.
 * 3. Feeds the 'missed the bag' share-moment hook.
 *
 * Intelligence signal → IntelligenceState.alpha
 * Core mechanic pair  → M09
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M09ATelemetryInput {
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
  // Extended inputs for M09A (market family)

}

// Telemetry events subscribed by M09A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M09ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M09AOutput extends M09ABaseOutput {
  opportunityValueScore: unknown;  // opportunity_value_score
  regretProbability: unknown;  // regret_probability
  regretStamp: unknown;  // regret_stamp
  shareMomentFlag: unknown;  // share_moment_flag
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M09ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M09A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M09ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M09A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M09ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M09A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M09APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M09APlacement = 'client' | 'server';

export interface M09AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M09AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M09AEvalContract {
  /** opportunity_value_calibration */
  /** regret_stamp_precision */
  /** share_moment_yield */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M09AModelCard {
  modelId:            'M09A';
  coreMechanicPair:   'M09';
  intelligenceSignal: 'alpha';
  modelCategory:      'predictor';
  family:             'market';
  tier:               M09ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M09A_ML_CONSTANTS = {
  ML_ID:              'M09A',
  CORE_PAIR:          'M09',
  MODEL_NAME:         'Opportunity Value Model + Regret Stamp Generator',
  INTEL_SIGNAL:       'alpha' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'market' as const,
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
  EVAL_FOCUS:         ["opportunity_value_calibration", "regret_stamp_precision", "share_moment_yield"],
  PRIMARY_OUTPUTS:    ["opportunity_value_score", "regret_probability", "regret_stamp", "share_moment_flag"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM09aMl
 *
 * Fires after M09 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M09AOutput with signed auditHash
 */
export async function runM09aMl(
  input:     M09ATelemetryInput,
  tier:      M09ATier = 'baseline',
  modelCard: Omit<M09AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M09AOutput> {
  // ── TODO: implement M09A — Opportunity Value Model + Regret Stamp Generator ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M09A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M09A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M09AOutput — NEVER mutate run state directly
  //
  // Placement: client, server | Budget: real_time
  // ExecHook:  after_m09_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M09A (Opportunity Value Model + Regret Stamp Generator) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM09aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M09AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM09aMlFallback(
  _input: M09ATelemetryInput,
): M09AOutput {
  // TODO: implement rule-based fallback for M09A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M09A-specific extended outputs
  throw new Error('M09A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.alpha
// Heuristic substitute (until ML is live):
//   intelligence.alpha = portfolioValue * cashflowRate
// Replace with: runM09aMl(telemetry, tier, modelCard).then(out => intelligence.alpha = out.score)
