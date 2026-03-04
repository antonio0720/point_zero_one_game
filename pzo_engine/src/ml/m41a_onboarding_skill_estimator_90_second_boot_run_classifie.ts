// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m41a_onboarding_skill_estimator_90_second_boot_run_classifie.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M41A — Onboarding Skill Estimator (90-Second Boot Run Classifier)
// Core Pair    : M41
// Family       : progression
// Category     : classifier
// IntelSignal  : personalization
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
 * M41A — Onboarding Skill Estimator (90-Second Boot Run Classifier)
 *
 * Primary function:
 *   Classify new player skill level from boot run behavior; route to appropriate starter path and difficulty
 *
 * What this adds to M41:
 * 1. Classify new player skill level from 90-second boot run decision patterns.
 * 2. Routes to appropriate starter path and initial difficulty without asking.
 * 3. Detects smurfs: experienced players hiding behind new accounts.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M41
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M41ATelemetryInput {
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
  // Extended inputs for M41A (progression family)

}

// Telemetry events subscribed by M41A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M41ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M41AOutput extends M41ABaseOutput {
  skillTierClassification: unknown;  // skill_tier_classification
  starterPathRecommendation: unknown;  // starter_path_recommendation
  smurfProbability: unknown;  // smurf_probability
  difficultyRoute: unknown;  // difficulty_route
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M41ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M41A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M41ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M41A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M41ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M41A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M41AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M41A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M41APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M41APlacement = 'server';

export interface M41AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M41AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M41AEvalContract {
  /** skill_classification_accuracy */
  /** smurf_detection_AUC */
  /** onboarding_completion_lift */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M41AModelCard {
  modelId:            'M41A';
  coreMechanicPair:   'M41';
  intelligenceSignal: 'personalization';
  modelCategory:      'classifier';
  family:             'progression';
  tier:               M41ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M41A_ML_CONSTANTS = {
  ML_ID:              'M41A',
  CORE_PAIR:          'M41',
  MODEL_NAME:         'Onboarding Skill Estimator (90-Second Boot Run Classifier)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'progression' as const,
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
  EVAL_FOCUS:         ["skill_classification_accuracy", "smurf_detection_AUC", "onboarding_completion_lift"],
  PRIMARY_OUTPUTS:    ["skill_tier_classification", "starter_path_recommendation", "smurf_probability", "difficulty_route"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM41aMl
 *
 * Fires after M41 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M41AOutput with signed auditHash
 */
export async function runM41aMl(
  input:     M41ATelemetryInput,
  tier:      M41ATier = 'baseline',
  modelCard: Omit<M41AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M41AOutput> {
  // ── TODO: implement M41A — Onboarding Skill Estimator (90-Second Boot Run Classifier) ─────────────────────────────────
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
  // □ Apply output caps: score = Math.min(score, M41A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M41A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M41AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: real_time
  // ExecHook:  after_m41_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M41A (Onboarding Skill Estimator (90-Second Boot Run Classifier)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM41aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M41AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM41aMlFallback(
  _input: M41ATelemetryInput,
): M41AOutput {
  // TODO: implement rule-based fallback for M41A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M41A-specific extended outputs
  throw new Error('M41A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM41aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
