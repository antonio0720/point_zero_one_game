// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m95a_wipe_clinic_causal_explainer_minimal_counterfactual_gen.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M95A — Wipe Clinic Causal Explainer (Minimal Counterfactual Generator)
// Core Pair    : M95
// Family       : forensics
// Category     : predictor
// IntelSignal  : personalization
// Tiers        : BASELINE, SEQUENCE_DL, CAUSAL
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
 * M95A — Wipe Clinic Causal Explainer (Minimal Counterfactual Generator)
 *
 * Primary function:
 *   Generate minimal counterfactual explanations for wipe causes using causal inference; show what one change would have changed
 *
 * What this adds to M95:
 * 1. Generate minimal counterfactual explanations: 'if you had done X at tick T, you survive.'
 * 2. Uses causal inference to isolate the single highest-leverage pivot.
 * 3. Never teaches exploitation; focuses on principle recovery paths.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M95
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M95ATelemetryInput {
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
  // Extended inputs for M95A (forensics family)

}

// Telemetry events subscribed by M95A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M95ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M95AOutput extends M95ABaseOutput {
  minimalCounterfactual: unknown;  // minimal_counterfactual
  leveragePivot: unknown;  // leverage_pivot
  survivalProbabilityDelta: unknown;  // survival_probability_delta
  principleRecoveryPath: unknown;  // principle_recovery_path
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M95ATier = 'baseline' | 'sequence_dl' | 'causal';

/** M95A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M95ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M95A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M95ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M95A — Tier: CAUSAL
 *  Causal inference + DiD (counterfactual explanations)
 */
export interface M95ACausalConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M95APlacement = 'server';

export interface M95AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M95AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M95AEvalContract {
  /** counterfactual_plausibility */
  /** leverage_pivot_accuracy */
  /** exploitation_guard_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M95AModelCard {
  modelId:            'M95A';
  coreMechanicPair:   'M95';
  intelligenceSignal: 'personalization';
  modelCategory:      'predictor';
  family:             'forensics';
  tier:               M95ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M95A_ML_CONSTANTS = {
  ML_ID:              'M95A',
  CORE_PAIR:          'M95',
  MODEL_NAME:         'Wipe Clinic Causal Explainer (Minimal Counterfactual Generator)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'forensics' as const,
  TIERS:              ['baseline', 'sequence_dl', 'causal'] as const,
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
  EVAL_FOCUS:         ["counterfactual_plausibility", "leverage_pivot_accuracy", "exploitation_guard_AUC"],
  PRIMARY_OUTPUTS:    ["minimal_counterfactual", "leverage_pivot", "survival_probability_delta", "principle_recovery_path"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM95aMl
 *
 * Fires after M95 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M95AOutput with signed auditHash
 */
export async function runM95aMl(
  input:     M95ATelemetryInput,
  tier:      M95ATier = 'baseline',
  modelCard: Omit<M95AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M95AOutput> {
  // ── TODO: implement M95A — Wipe Clinic Causal Explainer (Minimal Counterfactual Generator) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'causal' → Causal inference + DiD (counterfactual explanations)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M95A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M95A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M95AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: batch
  // ExecHook:  after_m95_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M95A (Wipe Clinic Causal Explainer (Minimal Counterfactual Generator)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM95aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M95AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM95aMlFallback(
  _input: M95ATelemetryInput,
): M95AOutput {
  // TODO: implement rule-based fallback for M95A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M95A-specific extended outputs
  throw new Error('M95A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM95aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
