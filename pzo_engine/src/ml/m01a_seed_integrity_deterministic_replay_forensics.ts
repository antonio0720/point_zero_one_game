// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m01a_seed_integrity_deterministic_replay_forensics.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M01A — Seed Integrity + Deterministic Replay Forensics
// Core Pair    : M01
// Family       : integrity
// Category     : anomaly_detector
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : client, server
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
 * M01A — Seed Integrity + Deterministic Replay Forensics
 *
 * Primary function:
 *   Detect replay/seed tampering and impossible action sequences; output a signed Replay Integrity Score
 *
 * What this adds to M01:
 * 1. Detect replay/seed tampering and impossible action sequences while keeping runs deterministic.
 * 2. Uses lightweight anomaly detection over action timelines + consistency checks against the deterministic simulator.
 * 3. Outputs a signed 'Replay Integrity Score' for challenges, leaderboards, and share links.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M01
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M01ATelemetryInput {
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
  // Extended inputs for M01A (integrity family)

}

// Telemetry events subscribed by M01A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M01ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M01AOutput extends M01ABaseOutput {
  replayIntegrityScore: unknown;  // replay_integrity_score
  tamperProbability: unknown;  // tamper_probability
  impossibleSequenceFlags: unknown;  // impossible_sequence_flags
  signedReceipt: unknown;  // signed_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M01ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M01A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M01ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M01A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M01ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M01A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M01APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M01APlacement = 'client' | 'server';

export interface M01AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M01AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M01AEvalContract {
  /** false_positive_rate_on_lag_spikes */
  /** tamper_detection_AUC */
  /** replay_consistency_delta */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M01AModelCard {
  modelId:            'M01A';
  coreMechanicPair:   'M01';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M01ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M01A_ML_CONSTANTS = {
  ML_ID:              'M01A',
  CORE_PAIR:          'M01',
  MODEL_NAME:         'Seed Integrity + Deterministic Replay Forensics',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
  FAMILY:             'integrity' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['client', 'server'] as const,
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
  EVAL_FOCUS:         ["false_positive_rate_on_lag_spikes", "tamper_detection_AUC", "replay_consistency_delta"],
  PRIMARY_OUTPUTS:    ["replay_integrity_score", "tamper_probability", "impossible_sequence_flags", "signed_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM01aMl
 *
 * Fires after M01 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M01AOutput with signed auditHash
 */
export async function runM01aMl(
  input:     M01ATelemetryInput,
  tier:      M01ATier = 'baseline',
  modelCard: Omit<M01AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M01AOutput> {
  // ── TODO: implement M01A — Seed Integrity + Deterministic Replay Forensics ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M01A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M01A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M01AOutput — NEVER mutate run state directly
  //
  // Placement: client, server | Budget: real_time
  // ExecHook:  after_m01_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M01A (Seed Integrity + Deterministic Replay Forensics) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM01aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M01AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM01aMlFallback(
  _input: M01ATelemetryInput,
): M01AOutput {
  // TODO: implement rule-based fallback for M01A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M01A-specific extended outputs
  throw new Error('M01A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM01aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
