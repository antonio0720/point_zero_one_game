// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m147a_litigation_risk_early_warning_mitigation_planner.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M147A — Litigation Risk Early Warning + Mitigation Planner
// Core Pair    : M147
// Family       : contract
// Category     : predictor
// IntelSignal  : risk
// Tiers        : BASELINE, SEQUENCE_DL, CAUSAL
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
 * M147A — Litigation Risk Early Warning + Mitigation Planner
 *
 * Primary function:
 *   Provide early warning of litigation risk triggers using causal run-state analysis; generate mitigation plans before trigger fires
 *
 * What this adds to M147:
 * 1. Provide early warning of litigation risk triggers using causal run-state analysis.
 * 2. Generate mitigation plans before the trigger fires — proactive, not reactive.
 * 3. Generates litigation risk receipts for Case File.
 *
 * Intelligence signal → IntelligenceState.risk
 * Core mechanic pair  → M147
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M147ATelemetryInput {
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
  // Extended inputs for M147A (contract family)

}

// Telemetry events subscribed by M147A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M147ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M147AOutput extends M147ABaseOutput {
  earlyWarningSignal: unknown;  // early_warning_signal
  mitigationPlan: unknown;  // mitigation_plan
  triggerProbability: unknown;  // trigger_probability
  caseFileReceipt: unknown;  // case_file_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M147ATier = 'baseline' | 'sequence_dl' | 'causal';

/** M147A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M147ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M147A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M147ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M147A — Tier: CAUSAL
 *  Causal inference + DiD (counterfactual explanations)
 */
export interface M147ACausalConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M147APlacement = 'client' | 'server';

export interface M147AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M147AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M147AEvalContract {
  /** early_warning_lead_time */
  /** mitigation_plan_quality */
  /** trigger_prediction_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M147AModelCard {
  modelId:            'M147A';
  coreMechanicPair:   'M147';
  intelligenceSignal: 'risk';
  modelCategory:      'predictor';
  family:             'contract';
  tier:               M147ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M147A_ML_CONSTANTS = {
  ML_ID:              'M147A',
  CORE_PAIR:          'M147',
  MODEL_NAME:         'Litigation Risk Early Warning + Mitigation Planner',
  INTEL_SIGNAL:       'risk' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'contract' as const,
  TIERS:              ['baseline', 'sequence_dl', 'causal'] as const,
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
  EVAL_FOCUS:         ["early_warning_lead_time", "mitigation_plan_quality", "trigger_prediction_AUC"],
  PRIMARY_OUTPUTS:    ["early_warning_signal", "mitigation_plan", "trigger_probability", "case_file_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM147aMl
 *
 * Fires after M147 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M147AOutput with signed auditHash
 */
export async function runM147aMl(
  input:     M147ATelemetryInput,
  tier:      M147ATier = 'baseline',
  modelCard: Omit<M147AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M147AOutput> {
  // ── TODO: implement M147A — Litigation Risk Early Warning + Mitigation Planner ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'causal' → Causal inference + DiD (counterfactual explanations)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M147A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M147A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M147AOutput — NEVER mutate run state directly
  //
  // Placement: client, server | Budget: real_time
  // ExecHook:  after_m147_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M147A (Litigation Risk Early Warning + Mitigation Planner) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM147aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M147AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM147aMlFallback(
  _input: M147ATelemetryInput,
): M147AOutput {
  // TODO: implement rule-based fallback for M147A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M147A-specific extended outputs
  throw new Error('M147A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.risk
// Heuristic substitute (until ML is live):
//   intelligence.risk = debtServiceRatio * cascadeExposure
// Replace with: runM147aMl(telemetry, tier, modelCard).then(out => intelligence.risk = out.score)
