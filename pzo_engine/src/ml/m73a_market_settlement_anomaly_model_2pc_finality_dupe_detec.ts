// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m73a_market_settlement_anomaly_model_2pc_finality_dupe_detec.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M73A — Market Settlement Anomaly Model (2PC / Finality Dupe Detection)
// Core Pair    : M73
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
 * M73A — Market Settlement Anomaly Model (2PC / Finality Dupe Detection)
 *
 * Primary function:
 *   Detect settlement anomalies indicating duplication exploits, double-spend patterns, or 2PC race conditions
 *
 * What this adds to M73:
 * 1. Detect settlement anomalies indicating duplication exploits or double-spend patterns.
 * 2. Identifies 2PC race condition exploitation.
 * 3. Feeds market escrow finality pipeline with risk-scored transactions.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M73
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M73ATelemetryInput {
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
  // Extended inputs for M73A (integrity family)

}

// Telemetry events subscribed by M73A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M73ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M73AOutput extends M73ABaseOutput {
  settlementAnomalyScore: unknown;  // settlement_anomaly_score
  dupeProbability: unknown;  // dupe_probability
  raceConditionFlag: unknown;  // race_condition_flag
  riskScoredTransaction: unknown;  // risk_scored_transaction
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M73ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M73A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M73ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M73A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M73ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M73A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M73AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M73A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M73APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M73APlacement = 'server';

export interface M73AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M73AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M73AEvalContract {
  /** dupe_detection_AUC */
  /** race_condition_recall */
  /** false_block_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M73AModelCard {
  modelId:            'M73A';
  coreMechanicPair:   'M73';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M73ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M73A_ML_CONSTANTS = {
  ML_ID:              'M73A',
  CORE_PAIR:          'M73',
  MODEL_NAME:         'Market Settlement Anomaly Model (2PC / Finality Dupe Detection)',
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
  EVAL_FOCUS:         ["dupe_detection_AUC", "race_condition_recall", "false_block_rate"],
  PRIMARY_OUTPUTS:    ["settlement_anomaly_score", "dupe_probability", "race_condition_flag", "risk_scored_transaction"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM73aMl
 *
 * Fires after M73 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=false).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M73AOutput with signed auditHash
 */
export async function runM73aMl(
  input:     M73ATelemetryInput,
  tier:      M73ATier = 'baseline',
  modelCard: Omit<M73AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M73AOutput> {
  // ── TODO: implement M73A — Market Settlement Anomaly Model (2PC / Finality Dupe Detection) ─────────────────────────────────
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
  // □ Apply output caps: score = Math.min(score, M73A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M73A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M73AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: real_time
  // ExecHook:  after_m73_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M73A (Market Settlement Anomaly Model (2PC / Finality Dupe Detection)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM73aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M73AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM73aMlFallback(
  _input: M73ATelemetryInput,
): M73AOutput {
  // TODO: implement rule-based fallback for M73A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M73A-specific extended outputs
  throw new Error('M73A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.antiCheat
// Heuristic substitute (until ML is live):
//   intelligence.antiCheat = replayConsistencyScore * signatureValidity
// Replace with: runM73aMl(telemetry, tier, modelCard).then(out => intelligence.antiCheat = out.score)
