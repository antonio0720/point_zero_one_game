// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m72a_action_budget_anomaly_detector_anti_bot_pace_control.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M72A — Action Budget Anomaly Detector (Anti-Bot Pace Control)
// Core Pair    : M72
// Family       : integrity
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
 * M72A — Action Budget Anomaly Detector (Anti-Bot Pace Control)
 *
 * Primary function:
 *   Detect bot-like action pacing patterns from action budget signals; distinguish bots from high-skill humans
 *
 * What this adds to M72:
 * 1. Detect bot-like action pacing from action budget signals.
 * 2. Distinguishes bots from high-skill humans: fast doesn't mean bot.
 * 3. Feeds Device Trust Fusion (M71a) with behavioral anomaly signals.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M72
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M72ATelemetryInput {
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
  // Extended inputs for M72A (integrity family)

}

// Telemetry events subscribed by M72A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M72ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M72AOutput extends M72ABaseOutput {
  botProbability: unknown;  // bot_probability
  pacingAnomalyScore: unknown;  // pacing_anomaly_score
  humanSkillEstimate: unknown;  // human_skill_estimate
  deviceTrustSignal: unknown;  // device_trust_signal
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M72ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M72A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M72ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M72A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M72ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M72A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M72AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M72A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M72APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M72APlacement = 'server';

export interface M72AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M72AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M72AEvalContract {
  /** bot_detection_AUC */
  /** human_false_positive_rate */
  /** pacing_calibration */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M72AModelCard {
  modelId:            'M72A';
  coreMechanicPair:   'M72';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M72ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M72A_ML_CONSTANTS = {
  ML_ID:              'M72A',
  CORE_PAIR:          'M72',
  MODEL_NAME:         'Action Budget Anomaly Detector (Anti-Bot Pace Control)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
  FAMILY:             'integrity' as const,
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
  EVAL_FOCUS:         ["bot_detection_AUC", "human_false_positive_rate", "pacing_calibration"],
  PRIMARY_OUTPUTS:    ["bot_probability", "pacing_anomaly_score", "human_skill_estimate", "device_trust_signal"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM72aMl
 *
 * Fires after M72 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M72AOutput with signed auditHash
 */
export async function runM72aMl(
  input:     M72ATelemetryInput,
  tier:      M72ATier = 'baseline',
  modelCard: Omit<M72AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M72AOutput> {
  // ── TODO: implement M72A — Action Budget Anomaly Detector (Anti-Bot Pace Control) ─────────────────────────────────
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
  // □ Apply output caps: score = Math.min(score, M72A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M72A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M72AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: real_time
  // ExecHook:  after_m72_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M72A (Action Budget Anomaly Detector (Anti-Bot Pace Control)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM72aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M72AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM72aMlFallback(
  _input: M72ATelemetryInput,
): M72AOutput {
  // TODO: implement rule-based fallback for M72A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M72A-specific extended outputs
  throw new Error('M72A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM72aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
