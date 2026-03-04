// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m20a_macro_shock_generator_distribution_constraints.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M20A — Macro Shock Generator (Distribution + Constraints)
// Core Pair    : M20
// Family       : market
// Category     : generator
// IntelSignal  : volatility
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
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
 * M20A — Macro Shock Generator (Distribution + Constraints)
 *
 * Primary function:
 *   Generate macro shock schedules that maximize dramatic impact while staying within bounded design constraints
 *
 * What this adds to M20:
 * 1. Generate macro shock schedules that maximize dramatic impact within bounded design constraints.
 * 2. Learns which shock sequences produce the highest share-moment yield without triggering rage-quit spikes.
 * 3. Ensures shocks feel earned: player state correlation, not pure randomness.
 *
 * Intelligence signal → IntelligenceState.volatility
 * Core mechanic pair  → M20
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M20ATelemetryInput {
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
  // Extended inputs for M20A (market family)

}

// Telemetry events subscribed by M20A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M20ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M20AOutput extends M20ABaseOutput {
  shockSchedule: unknown;  // shock_schedule
  dramaImpactScore: unknown;  // drama_impact_score
  rageQuitRisk: unknown;  // rage_quit_risk
  momentYieldEstimate: unknown;  // moment_yield_estimate
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M20ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M20A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M20ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M20A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M20ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M20A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M20APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M20APlacement = 'server';

export interface M20AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M20AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M20AEvalContract {
  /** share_moment_yield */
  /** rage_quit_correlation */
  /** shock_perceived_fairness */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M20AModelCard {
  modelId:            'M20A';
  coreMechanicPair:   'M20';
  intelligenceSignal: 'volatility';
  modelCategory:      'generator';
  family:             'market';
  tier:               M20ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M20A_ML_CONSTANTS = {
  ML_ID:              'M20A',
  CORE_PAIR:          'M20',
  MODEL_NAME:         'Macro Shock Generator (Distribution + Constraints)',
  INTEL_SIGNAL:       'volatility' as const,
  MODEL_CATEGORY:     'generator' as const,
  FAMILY:             'market' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["share_moment_yield", "rage_quit_correlation", "shock_perceived_fairness"],
  PRIMARY_OUTPUTS:    ["shock_schedule", "drama_impact_score", "rage_quit_risk", "moment_yield_estimate"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM20aMl
 *
 * Fires after M20 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M20AOutput with signed auditHash
 */
export async function runM20aMl(
  input:     M20ATelemetryInput,
  tier:      M20ATier = 'baseline',
  modelCard: Omit<M20AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M20AOutput> {
  // ── TODO: implement M20A — Macro Shock Generator (Distribution + Constraints) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M20A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M20A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M20AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: batch
  // ExecHook:  after_m20_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M20A (Macro Shock Generator (Distribution + Constraints)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM20aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M20AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM20aMlFallback(
  _input: M20ATelemetryInput,
): M20AOutput {
  // TODO: implement rule-based fallback for M20A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M20A-specific extended outputs
  throw new Error('M20A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.volatility
// Heuristic substitute (until ML is live):
//   intelligence.volatility = macroRegimeConfidence * shockProbability
// Replace with: runM20aMl(telemetry, tier, modelCard).then(out => intelligence.volatility = out.score)
