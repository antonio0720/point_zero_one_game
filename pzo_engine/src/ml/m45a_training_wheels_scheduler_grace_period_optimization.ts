// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m45a_training_wheels_scheduler_grace_period_optimization.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M45A — Training Wheels Scheduler (Grace-Period Optimization)
// Core Pair    : M45
// Family       : progression
// Category     : controller
// IntelSignal  : churnRisk
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
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
 * M45A — Training Wheels Scheduler (Grace-Period Optimization)
 *
 * Primary function:
 *   Optimize grace period duration and protection strength per player; remove training wheels at the right moment
 *
 * What this adds to M45:
 * 1. Optimize grace period duration and protection strength per player skill trajectory.
 * 2. Remove training wheels at the exact moment the player is ready — not too early, not too late.
 * 3. Detects grace period abuse: players deliberately staying in protection mode.
 *
 * Intelligence signal → IntelligenceState.churnRisk
 * Core mechanic pair  → M45
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M45ATelemetryInput {
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
  // Extended inputs for M45A (progression family)

}

// Telemetry events subscribed by M45A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M45ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M45AOutput extends M45ABaseOutput {
  optimalGraceDuration: unknown;  // optimal_grace_duration
  removalReadinessScore: unknown;  // removal_readiness_score
  abuseFlag: unknown;  // abuse_flag
  protectionStrengthDelta: unknown;  // protection_strength_delta
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M45ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M45A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M45ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M45A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M45ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M45A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M45AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M45A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M45APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M45APlacement = 'server';

export interface M45AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M45AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M45AEvalContract {
  /** grace_removal_success_rate */
  /** abuse_detection_AUC */
  /** post_grace_retention */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M45AModelCard {
  modelId:            'M45A';
  coreMechanicPair:   'M45';
  intelligenceSignal: 'churnRisk';
  modelCategory:      'controller';
  family:             'progression';
  tier:               M45ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M45A_ML_CONSTANTS = {
  ML_ID:              'M45A',
  CORE_PAIR:          'M45',
  MODEL_NAME:         'Training Wheels Scheduler (Grace-Period Optimization)',
  INTEL_SIGNAL:       'churnRisk' as const,
  MODEL_CATEGORY:     'controller' as const,
  FAMILY:             'progression' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["grace_removal_success_rate", "abuse_detection_AUC", "post_grace_retention"],
  PRIMARY_OUTPUTS:    ["optimal_grace_duration", "removal_readiness_score", "abuse_flag", "protection_strength_delta"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM45aMl
 *
 * Fires after M45 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M45AOutput with signed auditHash
 */
export async function runM45aMl(
  input:     M45ATelemetryInput,
  tier:      M45ATier = 'baseline',
  modelCard: Omit<M45AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M45AOutput> {
  // ── TODO: implement M45A — Training Wheels Scheduler (Grace-Period Optimization) ─────────────────────────────────
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
  // □ Apply output caps: score = Math.min(score, M45A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M45A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M45AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: batch
  // ExecHook:  after_m45_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M45A (Training Wheels Scheduler (Grace-Period Optimization)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM45aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M45AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM45aMlFallback(
  _input: M45ATelemetryInput,
): M45AOutput {
  // TODO: implement rule-based fallback for M45A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M45A-specific extended outputs
  throw new Error('M45A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.churnRisk
// Heuristic substitute (until ML is live):
//   intelligence.churnRisk = (1 - retentionRate) * ragequitCorrelation
// Replace with: runM45aMl(telemetry, tier, modelCard).then(out => intelligence.churnRisk = out.score)
