// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m94a_glossary_ping_relevance_model_speak_only_when_needed.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M94A — Glossary Ping Relevance Model (Speak-Only-When-Needed)
// Core Pair    : M94
// Family       : progression
// Category     : classifier
// IntelSignal  : personalization
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
// Placement    : client
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
 * M94A — Glossary Ping Relevance Model (Speak-Only-When-Needed)
 *
 * Primary function:
 *   Score glossary ping relevance for the specific game state; enforce speak-only-when-needed minimalism
 *
 * What this adds to M94:
 * 1. Score glossary ping relevance for the exact game state and player knowledge level.
 * 2. Enforces minimalism: only ping when the term is genuinely unfamiliar AND currently relevant.
 * 3. Learns individual vocabulary: stops pinging terms the player demonstrably knows.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M94
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M94ATelemetryInput {
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
  // Extended inputs for M94A (progression family)

}

// Telemetry events subscribed by M94A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M94ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M94AOutput extends M94ABaseOutput {
  relevanceScore: unknown;  // relevance_score
  familiarTermFlag: unknown;  // familiar_term_flag
  pingRecommendation: unknown;  // ping_recommendation
  vocabularyModelUpdate: unknown;  // vocabulary_model_update
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M94ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M94A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M94ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M94A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M94ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M94A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M94APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M94APlacement = 'client';

export interface M94AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M94AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M94AEvalContract {
  /** ping_precision */
  /** annoyance_rate */
  /** vocabulary_learning_accuracy */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M94AModelCard {
  modelId:            'M94A';
  coreMechanicPair:   'M94';
  intelligenceSignal: 'personalization';
  modelCategory:      'classifier';
  family:             'progression';
  tier:               M94ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M94A_ML_CONSTANTS = {
  ML_ID:              'M94A',
  CORE_PAIR:          'M94',
  MODEL_NAME:         'Glossary Ping Relevance Model (Speak-Only-When-Needed)',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'classifier' as const,
  FAMILY:             'progression' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT:          ['client'] as const,
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
  EVAL_FOCUS:         ["ping_precision", "annoyance_rate", "vocabulary_learning_accuracy"],
  PRIMARY_OUTPUTS:    ["relevance_score", "familiar_term_flag", "ping_recommendation", "vocabulary_model_update"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM94aMl
 *
 * Fires after M94 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M94AOutput with signed auditHash
 */
export async function runM94aMl(
  input:     M94ATelemetryInput,
  tier:      M94ATier = 'baseline',
  modelCard: Omit<M94AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M94AOutput> {
  // ── TODO: implement M94A — Glossary Ping Relevance Model (Speak-Only-When-Needed) ─────────────────────────────────
  //
  // Implementation checklist:
  // □ Validate input schema against featureSchemaHash
  // □ Select inference backend based on `tier` parameter
  // □ tier === 'baseline' → GBM + calibrated logistic (fast, low-cost, production default)
  // □ tier === 'sequence_dl' → TCN / Transformer encoder over event streams (sequential patterns)
  // □ tier === 'policy_rl' → Constrained contextual bandit / offline PPO (bounded nudges)
  // □ Apply input privacy filters (no PII, no cross-player contact graph)
  // □ Run inference → raw score + top_factors
  // □ Apply output caps: score = Math.min(score, M94A_ML_CONSTANTS.GUARDRAILS.scoreCap)
  // □ Apply monotonic constraints where relevant
  // □ Abstain if confidence < M94A_ML_CONSTANTS.GUARDRAILS.abstainThreshold
  // □ Compute auditHash = SHA256(inputs + outputs + ruleset_version + caps)
  // □ Write signed receipt to run ledger (NEVER skip)
  // □ Return M94AOutput — NEVER mutate run state directly
  //
  // Placement: client | Budget: real_time
  // ExecHook:  after_m94_resolve
  // ─────────────────────────────────────────────────────────────────────────
  throw new Error('M94A (Glossary Ping Relevance Model (Speak-Only-When-Needed)) ML inference not yet implemented.');
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM94aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M94AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM94aMlFallback(
  _input: M94ATelemetryInput,
): M94AOutput {
  // TODO: implement rule-based fallback for M94A
  // Fallback must:
  //   □ Return score = 0.5 (neutral / unknown)
  //   □ Return topFactors = ['ML unavailable — rule-based fallback active']
  //   □ Return recommendation = 'See rule engine output'
  //   □ Compute deterministic auditHash from input seed + 'fallback'
  //   □ Zero-out all M94A-specific extended outputs
  throw new Error('M94A fallback not yet implemented.');
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM94aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
