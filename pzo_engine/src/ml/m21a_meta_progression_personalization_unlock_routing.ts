// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m21a_meta_progression_personalization_unlock_routing.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M21A — Meta-Progression Personalization (Unlock Routing)
// Core Pair    : M21
// Family       : progression
// Category     : recommender
// IntelSignal  : churnRisk
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
 * M21A — Meta-Progression Personalization (Unlock Routing)
 *
 * Primary function:
 *   Route unlock progression to match player style and retention risk; prevent both under-challenge and overwhelm
 *
 * What this adds to M21:
 * 1. Route unlock progression to match player style, skill growth, and retention risk.
 * 2. Prevents both under-challenge (boredom) and complexity overwhelm.
 * 3. Feeds Progressive Disclosure (M67) gate scheduling.
 *
 * Intelligence signal → IntelligenceState.churnRisk
 * Core mechanic pair  → M21
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M21ATelemetryInput {
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
  // Extended inputs for M21A (progression family)

}

// Telemetry events subscribed by M21A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M21ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M21AOutput extends M21ABaseOutput {
  unlockRoute: unknown;  // unlock_route
  retentionRiskScore: unknown;  // retention_risk_score
  overwhelmFlag: unknown;  // overwhelm_flag
  progressionTierDelta: unknown;  // progression_tier_delta
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M21ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M21A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M21ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M21A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M21ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M21A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M21APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M21APlacement = 'server';

export interface M21AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M21AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M21AEvalContract {
  /** unlock_acceptance_rate */
  /** retention_lift */
  /** overwhelm_detection_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M21AModelCard {
  modelId:            'M21A';
  coreMechanicPair:   'M21';
  intelligenceSignal: 'churnRisk';
  modelCategory:      'recommender';
  family:             'progression';
  tier:               M21ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M21A_ML_CONSTANTS = {
  ML_ID:              'M21A',
  CORE_PAIR:          'M21',
  MODEL_NAME:         'Meta-Progression Personalization (Unlock Routing)',
  INTEL_SIGNAL:       'churnRisk' as const,
  MODEL_CATEGORY:     'recommender' as const,
  FAMILY:             'progression' as const,
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
  EVAL_FOCUS:         ["unlock_acceptance_rate", "retention_lift", "overwhelm_detection_AUC"],
  PRIMARY_OUTPUTS:    ["unlock_route", "retention_risk_score", "overwhelm_flag", "progression_tier_delta"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM21aMl
 *
 * Fires after M21 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M21AOutput with signed auditHash
 */
export async function runM21aMl(
  input:     M21ATelemetryInput,
  tier:      M21ATier = 'baseline',
  modelCard: Omit<M21AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M21AOutput> {
  // ── TODO: implement M21A — Meta-Progression Personalization (Unlock Routing) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M21A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M21A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M21AOutput — NEVER mutate run state directly
  //
  // Placement: server | Budget: batch
  // ExecHook:  after_m21_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M21A (Meta-Progression Personalization (Unlock Routing)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM21aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M21AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM21aMlFallback(
  _input: M21ATelemetryInput,
): M21AOutput {
  // TODO: implement rule-based fallback for M21A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M21A-specific extended outputs
  throw new Error('M21A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.churnRisk
// Heuristic substitute (until ML is live):
//   intelligence.churnRisk = (1 - retentionRate) * ragequitCorrelation
// Replace with: runM21aMl(telemetry, tier, modelCard).then(out => intelligence.churnRisk = out.score)
