// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m22a_moment_forge_classifier_3_moment_guarantee_controller.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M22A — Moment Forge Classifier (3-Moment Guarantee Controller)
// Core Pair    : M22
// Family       : social
// Category     : classifier
// IntelSignal  : rewardFit
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
 * M22A — Moment Forge Classifier (3-Moment Guarantee Controller)
 *
 * Primary function:
 *   Classify in-run events for shareability; guarantee ≥3 share moments per run without scripting outcomes
 *
 * What this adds to M22:
 * 1. Classify in-run events for shareability and route moment budget to guarantee ≥3 share moments per run.
 * 2. Detects FUBAR-killed-me, opportunity-flip, and missed-the-bag events in real time.
 * 3. Never scripts outcomes; detects naturally occurring shareable moments.
 *
 * Intelligence signal → IntelligenceState.rewardFit
 * Core mechanic pair  → M22
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M22ATelemetryInput {
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
  // Extended inputs for M22A (social family)

}

// Telemetry events subscribed by M22A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M22ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M22AOutput extends M22ABaseOutput {
  momentClass: unknown;  // moment_class
  shareabilityScore: unknown;  // shareability_score
  momentBudgetStatus: unknown;  // moment_budget_status
  clipBoundarySuggestion: unknown;  // clip_boundary_suggestion
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M22ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M22A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M22ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M22A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M22ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M22A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M22APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M22APlacement = 'client' | 'server';

export interface M22AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M22AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M22AEvalContract {
  /** moment_yield_per_run */
  /** moment_precision */
  /** false_moment_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M22AModelCard {
  modelId:            'M22A';
  coreMechanicPair:   'M22';
  intelligenceSignal: 'rewardFit';
  modelCategory:      'classifier';
  family:             'social';
  tier:               M22ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M22A_ML_CONSTANTS = {
  ML_ID:              'M22A',
  CORE_PAIR:          'M22',
  MODEL_NAME:         'Moment Forge Classifier (3-Moment Guarantee Controller)',
  INTEL_SIGNAL:       'rewardFit' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'social' as const,
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
  EVAL_FOCUS:         ["moment_yield_per_run", "moment_precision", "false_moment_rate"],
  PRIMARY_OUTPUTS:    ["moment_class", "shareability_score", "moment_budget_status", "clip_boundary_suggestion"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM22aMl
 *
 * Fires after M22 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M22AOutput with signed auditHash
 */
export async function runM22aMl(
  input:     M22ATelemetryInput,
  tier:      M22ATier = 'baseline',
  modelCard: Omit<M22AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M22AOutput> {
  // ── TODO: implement M22A — Moment Forge Classifier (3-Moment Guarantee Controller) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M22A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M22A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M22AOutput — NEVER mutate run state directly
  //
  // Placement: client, server | Budget: real_time
  // ExecHook:  after_m22_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M22A (Moment Forge Classifier (3-Moment Guarantee Controller)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM22aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M22AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM22aMlFallback(
  _input: M22ATelemetryInput,
): M22AOutput {
  // TODO: implement rule-based fallback for M22A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M22A-specific extended outputs
  throw new Error('M22A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.rewardFit
// Heuristic substitute (until ML is live):
//   intelligence.rewardFit = momentYieldPerRun * shareEventDensity
// Replace with: runM22aMl(telemetry, tier, modelCard).then(out => intelligence.rewardFit = out.score)
