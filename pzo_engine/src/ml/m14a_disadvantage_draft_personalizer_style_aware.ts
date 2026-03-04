// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m14a_disadvantage_draft_personalizer_style_aware.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M14A — Disadvantage Draft Personalizer (Style-Aware)
// Core Pair    : M14
// Family       : progression
// Category     : recommender
// IntelSignal  : personalization
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
 * M14A — Disadvantage Draft Personalizer (Style-Aware)
 *
 * Primary function:
 *   Recommend handicap combinations that match player style while preserving CORD premium fairness
 *
 * What this adds to M14:
 * 1. Recommend handicap combinations that challenge the player's specific weak spots without being punishing.
 * 2. Learns style fingerprints; personalizes disadvantage draft without breaking CORD premium fairness.
 * 3. Detects players deliberately sandbagging via handicap selection.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M14
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M14ATelemetryInput {
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
  // Extended inputs for M14A (progression family)

}

// Telemetry events subscribed by M14A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M14ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M14AOutput extends M14ABaseOutput {
  recommendedHandicaps: unknown;  // recommended_handicaps
  styleFingerprint: unknown;  // style_fingerprint
  sandbagFlag: unknown;  // sandbag_flag
  cordPremiumFairnessScore: unknown;  // cord_premium_fairness_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M14ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M14A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M14ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M14A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M14ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M14A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M14APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M14APlacement = 'client' | 'server';

export interface M14AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M14AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M14AEvalContract {
  /** handicap_acceptance_rate */
  /** sandbag_detection_precision */
  /** cord_premium_calibration */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M14AModelCard {
  modelId:            'M14A';
  coreMechanicPair:   'M14';
  intelligenceSignal: 'personalization';
  modelCategory:      'recommender';
  family:             'progression';
  tier:               M14ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M14A_ML_CONSTANTS = {
  ML_ID:              'M14A',
  CORE_PAIR:          'M14',
  MODEL_NAME:         'Disadvantage Draft Personalizer (Style-Aware)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'recommender' as const,
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
  EVAL_FOCUS:         ["handicap_acceptance_rate", "sandbag_detection_precision", "cord_premium_calibration"],
  PRIMARY_OUTPUTS:    ["recommended_handicaps", "style_fingerprint", "sandbag_flag", "cord_premium_fairness_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM14aMl
 *
 * Fires after M14 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M14AOutput with signed auditHash
 */
export async function runM14aMl(
  input:     M14ATelemetryInput,
  tier:      M14ATier = 'baseline',
  modelCard: Omit<M14AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M14AOutput> {
  // ── TODO: implement M14A — Disadvantage Draft Personalizer (Style-Aware) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M14A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M14A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M14AOutput — NEVER mutate run state directly
  //
  // Placement: client, server | Budget: real_time
  // ExecHook:  after_m14_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M14A (Disadvantage Draft Personalizer (Style-Aware)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM14aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M14AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM14aMlFallback(
  _input: M14ATelemetryInput,
): M14AOutput {
  // TODO: implement rule-based fallback for M14A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M14A-specific extended outputs
  throw new Error('M14A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM14aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
