// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m132a_case_files_forensic_summarizer_root_cause_ranker.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M132A — Case Files Forensic Summarizer + Root-Cause Ranker
// Core Pair    : M132
// Family       : forensics
// Category     : predictor
// IntelSignal  : personalization
// Tiers        : BASELINE, CAUSAL, RETRIEVAL
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

import { createHash } from 'node:crypto';

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M132A — Case Files Forensic Summarizer + Root-Cause Ranker
 *
 * Primary function:
 *   Auto-write wipe/close-call dossiers using causal inference; rank highest-leverage pivots the player missed
 *
 * What this adds to M132:
 * 1. Auto-write wipe/close-call dossier with timeline and top causal chain.
 * 2. Rank 1–2 highest-leverage pivots you missed (non-exploit).
 * 3. Builds a season-wide forensic library for replay training.
 *
 * Intelligence signal → IntelligenceState.personalization
 * Core mechanic pair  → M132
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M132ATelemetryInput {
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
  // Extended inputs for M132A (forensics family)

}

// Telemetry events subscribed by M132A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M132ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M132AOutput extends M132ABaseOutput {
  caseFileDossier: unknown;  // case_file_dossier
  pivotRanking: unknown;  // pivot_ranking
  causalChain: unknown;  // causal_chain
  seasonLibraryEntry: unknown;  // season_library_entry
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M132ATier = 'baseline' | 'causal' | 'retrieval';

/** M132A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M132ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M132A — Tier: CAUSAL
 *  Causal inference + DiD (counterfactual explanations)
 */
export interface M132ACausalConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M132A — Tier: RETRIEVAL
 *  Dense retrieval over season case library (similarity search)
 */
export interface M132ARetrievalConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M132APlacement = 'server';

export interface M132AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M132AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M132AEvalContract {
  /** dossier_accuracy */
  /** pivot_ranking_precision */
  /** causal_chain_validity */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M132AModelCard {
  modelId:            'M132A';
  coreMechanicPair:   'M132';
  intelligenceSignal: 'personalization';
  modelCategory:      'predictor';
  family:             'forensics';
  tier:               M132ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M132A_ML_CONSTANTS = {
  ML_ID:              'M132A',
  CORE_PAIR:          'M132',
  MODEL_NAME:         'Case Files Forensic Summarizer + Root-Cause Ranker',
  INTEL_SIGNAL:       'personalization' as const,
  MODEL_CATEGORY:     'predictor' as const,
  FAMILY:             'forensics' as const,
  TIERS:              ['baseline', 'causal', 'retrieval'] as const,
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
  EVAL_FOCUS:         ["dossier_accuracy", "pivot_ranking_precision", "causal_chain_validity"],
  PRIMARY_OUTPUTS:    ["case_file_dossier", "pivot_ranking", "causal_chain", "season_library_entry"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Main inference function ───────────────────────────────────────────────────
/**
 * runM132aMl
 *
 * Fires after M132 exec_hook, reads resolved output, returns advisory signals.
 * NEVER mutates game state. All suggestions are bounded.
 * Competitive mode may disable balance nudges (can_lock_off=true).
 * Integrity signals always run regardless of lock-off state.
 *
 * @param input     Telemetry snapshot
 * @param tier      Model tier to route (default: 'baseline' for latency budget)
 * @param modelCard Identity stamp written to every audit receipt
 * @returns         M132AOutput with signed auditHash
 */
export async function runM132aMl(
  input:     M132ATelemetryInput,
  tier:      M132ATier = 'baseline',
  modelCard: Omit<M132AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M132AOutput> {
  // Day-1 operational: delegates to fallback until full ML implementation is deployed.
  // Full implementation checklist preserved in git history.
  return runM132aMlFallback(input);
}

// ── Degraded-mode fallback ────────────────────────────────────────────────────
/**
 * runM132aMlFallback — rule-based fallback when ML is unavailable.
 * Must never throw. Returns valid (degraded) M132AOutput.
 * Competitive modes use this when ML nudges are locked off.
 */
export function runM132aMlFallback(
  _input: M132ATelemetryInput,
): M132AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = createHash('sha256')
    .update(seed + ':' + tick + ':fallback:M132A')
    .digest('hex');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    caseFileDossier: null,
    pivotRanking: null,
    causalChain: null,
    seasonLibraryEntry: null,
  };
}

// ── IntelligenceState integration note ───────────────────────────────────────
// This mechanic writes to IntelligenceState.personalization
// Heuristic substitute (until ML is live):
//   intelligence.personalization = skillBandIndex * sessionProgressionRate
// Replace with: runM132aMl(telemetry, tier, modelCard).then(out => intelligence.personalization = out.score)
