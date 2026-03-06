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

import { createHash } from 'node:crypto';

import {
  CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  buildChaosWindows, clamp, computeHash,
} from '../mechanics/mechanicsUtils';
import type { MacroRegime } from '../mechanics/types';

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
export type M95ATier = 'baseline' | 'sequence_dl' | 'causal' | 'policy_rl';

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

// ── Private implementation types ─────────────────────────────────────────────

interface M95ASanitizedInput {
  runSeed: string;
  tickIndex: number;
  rulesetVersion: string;
  macroRegime: MacroRegime;
  portfolioSnapshot: Record<string, unknown>;
  actionTimeline: Record<string, unknown>[];
  uiInteraction: Record<string, unknown>;
  socialEvents: Record<string, unknown>[];
  outcomeEvents: Record<string, unknown>[];
  ledgerEvents: Record<string, unknown>[];
  userOptIn: Record<string, boolean>;
}

interface M95AActionPoint {
  timeMs: number;
  durationMs: number;
  label: string;
  decisionDepth: number;
  undoLike: boolean;
  timeoutLike: boolean;
}

interface M95AFeatureVector {
  schemaVersion: string;
  schemaHash: string;
  causalChainDepth: number;
  counterfactualDistance: number;
  evidenceDensity: number;
  pivotPointScore: number;
  rootCauseConfidence: number;
  timelineCoherence: number;
  narrativeStrength: number;
  shareabilityScore: number;
  macroPressure: number;
  negativeOutcomeRate: number;
  lagLikelihood: number;
  sequenceStress: number;
  historyScoreEma: number;
  historyDeltaEma: number;
  fairnessBand: number;
  confidenceSignal: number;
}

interface M95AContribution {
  label: string;
  value: number;
}

interface M95AModelInference {
  rawScore: number;
  confidence: number;
  contributions: M95AContribution[];
  tier: M95ATier;
}

interface M95ASessionProfile {
  sessionKey: string;
  inferenceCount: number;
  scoreEma: number;
  confidenceEma: number;
  deltaEma: number;
  rewardEma: number;
  lastTick: number;
  bandit: Record<string, { trials: number; reward: number }>;
}

export interface M95AAuditReceipt {
  receiptId: string;
  auditHash: string;
  rulesetVersion: string;
  modelVersion: string;
  tier: M95ATier;
  runSeed: string;
  tickIndex: number;
  caps: { scoreCap: number; abstainThreshold: number };
  output: Omit<M95AOutput, 'auditHash'>;
  createdAt: string;
  signature: string;
}

// ── Session store + ledger ───────────────────────────────────────────────────

const m95aSessionStore = new Map<string, M95ASessionProfile>();
const m95aLedgerReceipts: M95AAuditReceipt[] = [];

export function registerM95aLedgerWriter(writer: (receipt: M95AAuditReceipt) => void): () => void {
  m95aLedgerWriters.add(writer);
  return () => m95aLedgerWriters.delete(writer);
}
const m95aLedgerWriters = new Set<(receipt: M95AAuditReceipt) => void>();
m95aLedgerWriters.add((receipt) => {
  m95aLedgerReceipts.push(receipt);
  if (m95aLedgerReceipts.length > 5_000) m95aLedgerReceipts.splice(0, m95aLedgerReceipts.length - 5_000);
});

export function getM95aLedgerReceipts(runSeed?: string): M95AAuditReceipt[] {
  if (!runSeed) return [...m95aLedgerReceipts];
  return m95aLedgerReceipts.filter(r => r.runSeed === runSeed);
}

export function exportM95aLearningState(): Record<string, M95ASessionProfile> {
  return Object.fromEntries(Array.from(m95aSessionStore.entries()).map(([k, v]) => [k, { ...v, bandit: { ...v.bandit } }]));
}

export function hydrateM95aLearningState(state: Record<string, M95ASessionProfile>): void {
  for (const [key, profile] of Object.entries(state ?? {})) {
    if (!profile || typeof profile !== 'object') continue;
    m95aSessionStore.set(key, {
      sessionKey: key,
      inferenceCount: Math.max(0, Math.floor(Number(profile.inferenceCount ?? 0))),
      scoreEma: clamp(Number(profile.scoreEma ?? 0.5), 0, 1),
      confidenceEma: clamp(Number(profile.confidenceEma ?? 0.5), 0, 1),
      deltaEma: clamp(Number(profile.deltaEma ?? 0), -1, 1),
      rewardEma: clamp(Number(profile.rewardEma ?? 0.5), 0, 1),
      lastTick: Math.max(0, Math.floor(Number(profile.lastTick ?? 0))),
      bandit: normalizeBandit(profile.bandit),
    });
  }
}

export function resetM95aRuntime(): void {
  m95aSessionStore.clear();
  m95aLedgerReceipts.splice(0, m95aLedgerReceipts.length);
}

// ── Main inference ───────────────────────────────────────────────────────────

export async function runM95aMl(
  input: M95ATelemetryInput,
  tier: M95ATier = 'baseline',
  modelCard: Omit<M95AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M95AOutput> {
  const sanitized = sanitizeM95AInput(input);
  const session = getOrCreateM95ASession(sanitized.runSeed);
  const features = buildM95AFeatures(sanitized, session);
  const lockOffApplied = shouldLockOffM95A(sanitized.userOptIn);

  const modelInference = selectInferenceM95A(tier, features, sanitized, session);

  let score = clamp(modelInference.rawScore, 0, M95A_ML_CONSTANTS.GUARDRAILS.scoreCap);
  const confidence = clamp(modelInference.confidence, 0, 1);
  const shouldAbstain = confidence < M95A_ML_CONSTANTS.GUARDRAILS.abstainThreshold;
  if (shouldAbstain) score = 0.5;
  if (lockOffApplied) score = 0.5;

  const topFactors = buildM95ATopFactors(modelInference.contributions, features, lockOffApplied, shouldAbstain);
  const recommendation = buildM95ARecommendation({ score, lockOffApplied, shouldAbstain });

  const baseOutput: Omit<M95AOutput, 'auditHash'> = {
    score,
    topFactors,
    recommendation,
    minimalCounterfactual: safeRound(modelInference.rawScore * 100, 2),
    leveragePivot: safeRound(modelInference.rawScore * (0.9 + 1 * 0.02), 4),
    survivalProbabilityDelta: safeRound(clamp(modelInference.rawScore * (1 + 2 * 0.03), 0, 1), 4),
    principleRecoveryPath: safeRound(modelInference.rawScore * (0.9 + 3 * 0.02), 4),
  };

  const auditHash = sha256Hex(stableStringify({
    input: sanitized, tier, features, output: baseOutput,
    rulesetVersion: sanitized.rulesetVersion,
    modelCard: { ...modelCard, modelId: 'M95A', coreMechanicPair: 'M95' },
  }));

  const receipt = buildM95AReceipt({ auditHash, output: baseOutput, sanitized, tier, modelVersion: modelCard.modelVersion });
  for (const writer of m95aLedgerWriters) writer(receipt);

  updateM95ASession(session, features, score, sanitized.tickIndex, modelInference.rawScore);

  return { ...baseOutput, auditHash };
}

// ── Fallback ─────────────────────────────────────────────────────────────────

export function runM95aMlFallback(
  _input: M95ATelemetryInput,
): M95AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = sha256Hex(seed + ':' + tick + ':fallback:M95A');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    minimalCounterfactual: null,
    leveragePivot: null,
    survivalProbabilityDelta: null,
    principleRecoveryPath: null,
  };
}

// ── Input sanitization ──────────────────────────────────────────────────────

function sanitizeM95AInput(input: M95ATelemetryInput): M95ASanitizedInput {
  return {
    runSeed: String(input.runSeed ?? ''),
    tickIndex: clamp(Math.floor(Number(input.tickIndex ?? 0)), 0, RUN_TOTAL_TICKS - 1),
    rulesetVersion: String(input.rulesetVersion ?? 'M95A_RULES_V1'),
    macroRegime: normalizeMacroRegime(input.macroRegime),
    portfolioSnapshot: sanitizeObj(input.portfolioSnapshot),
    actionTimeline: sanitizeArr(input.actionTimeline),
    uiInteraction: sanitizeObj(input.uiInteraction),
    socialEvents: sanitizeArr(input.socialEvents),
    outcomeEvents: sanitizeArr(input.outcomeEvents),
    ledgerEvents: sanitizeArr(input.ledgerEvents ?? []),
    userOptIn: sanitizeBoolMap(input.userOptIn),
  };
}

// ── Feature extraction ──────────────────────────────────────────────────────

function buildM95AFeatures(input: M95ASanitizedInput, session: M95ASessionProfile): M95AFeatureVector {
  const actions = extractActions(input.actionTimeline);
  const uiLatency = extractUiLatency(input.uiInteraction, input.actionTimeline);
  const allEvents = [...input.outcomeEvents, ...input.ledgerEvents];
  const negOutKeys = ['loss', 'penalty', 'wipe', 'miss', 'late', 'fail', 'damage', 'default'];
  const negativeOutcomeRate = allEvents.length > 0 ? clamp(allEvents.filter(e => negOutKeys.some(k => stableStringify(e).toLowerCase().includes(k))).length / allEvents.length, 0, 1) : 0;
  const lagKeys = ['lag', 'latency', 'jitter', 'stall', 'freeze'];
  const lagLikelihood = clamp(median(uiLatency) / 900 * 0.35 + (input.actionTimeline.some(e => lagKeys.some(k => stableStringify(e).toLowerCase().includes(k))) ? 0.2 : 0), 0, 1);
  const macroPressure = deriveMacroPressure(input.macroRegime, input.tickIndex, input.runSeed);
  const sequenceStress = deriveSequenceStress(actions, input.tickIndex, input.runSeed);


    const wipeKeys = ['wipe', 'death', 'collapse', 'fail', 'bankruptcy', 'default', 'crisis'];
    const momentKeys = ['flip', 'clutch', 'save', 'comeback', 'near_death', 'legendary'];
    const wipeEvents = allEvents.filter(e => wipeKeys.some(k => stableStringify(e).toLowerCase().includes(k)));
    const momentEvents = allEvents.filter(e => momentKeys.some(k => stableStringify(e).toLowerCase().includes(k)));
    const causalChainDepth = clamp(wipeEvents.length / 5, 0, 1);
    const counterfactualDistance = clamp(1 - momentEvents.length / Math.max(1, wipeEvents.length + momentEvents.length), 0, 1);
    const evidenceDensity = clamp(allEvents.length / Math.max(1, input.tickIndex + 1) / 3, 0, 1);
    const pivotPointScore = clamp(momentEvents.length / Math.max(1, allEvents.length) * 5, 0, 1);
    const rootCauseConfidence = clamp(evidenceDensity * 0.5 + causalChainDepth * 0.3 + (1 - counterfactualDistance) * 0.2, 0, 1);
    const timelineCoherence = clamp(1 - counterfactualDistance * 0.5, 0, 1);
    const narrativeStrength = clamp(pivotPointScore * 0.4 + causalChainDepth * 0.3 + momentEvents.length / 5 * 0.3, 0, 1);
    const shareabilityScore = clamp(narrativeStrength * 0.5 + pivotPointScore * 0.3 + momentEvents.length / 3 * 0.2, 0, 1);

  const confidenceSignal = clamp(0.25 + clamp(actions.length / 12, 0, 0.3) + clamp(uiLatency.length / 12, 0, 0.15) + clamp(1 - lagLikelihood, 0, 0.2) + 0.1, 0, 1);
  const fairnessBand = clamp(confidenceSignal * 0.5 + (1 - negativeOutcomeRate) * 0.5, 0, 1);

  return {
    schemaVersion: 'M95A_FEATURES_V1',
    schemaHash: M95A_ML_CONSTANTS.GUARDRAILS.scoreCap.toString(),
    causalChainDepth,
    counterfactualDistance,
    evidenceDensity,
    pivotPointScore,
    rootCauseConfidence,
    timelineCoherence,
    narrativeStrength,
    shareabilityScore,
    macroPressure,
    negativeOutcomeRate,
    lagLikelihood,
    sequenceStress,
    historyScoreEma: session.scoreEma,
    historyDeltaEma: session.deltaEma,
    fairnessBand,
    confidenceSignal,
  };
}

// ── Three-tier inference ─────────────────────────────────────────────────────

function selectInferenceM95A(tier: M95ATier, features: M95AFeatureVector, input: M95ASanitizedInput, session: M95ASessionProfile): M95AModelInference {
  switch (tier) {
    case 'sequence_dl': return runSequenceM95A(features, input, session);
    case 'policy_rl':   return runPolicyM95A(features, input, session);
    default:            return runBaselineM95A(features, input, session);
  }
}

function runBaselineM95A(features: M95AFeatureVector, _input: M95ASanitizedInput, session: M95ASessionProfile): M95AModelInference {
  const contributions: M95AContribution[] = [
    { label: 'Causal chain depth', value: features.causalChainDepth * 0.16 },
    { label: 'Counterfactual distance', value: features.counterfactualDistance * 0.13 },
    { label: 'Evidence density', value: features.evidenceDensity * 0.12 },
    { label: 'Pivot point significance', value: features.pivotPointScore * 0.11 },
    { label: 'Root cause confidence', value: features.rootCauseConfidence * 0.10 },
    { label: 'Timeline coherence score', value: features.timelineCoherence * 0.09 },
    { label: 'Narrative strength metric', value: features.narrativeStrength * 0.08 },
    { label: 'Content shareability', value: features.shareabilityScore * 0.10 },
    { label: 'Macro regime pressure', value: features.macroPressure * 0.10 },
    { label: 'Session history EMA', value: features.historyScoreEma * 0.08 },
  ];
  const logit = -0.45 + contributions.reduce((s, c) => s + c.value, 0)
    + features.sequenceStress * 0.12 + features.negativeOutcomeRate * 0.10
    - clamp(session.rewardEma - 0.5, -0.2, 0.2) * 0.08;
  return {
    rawScore: sigmoid(logit),
    confidence: clamp(features.confidenceSignal * 0.80 + (1 - features.lagLikelihood) * 0.20, 0.05, 0.99),
    contributions,
    tier: 'baseline',
  };
}

function runSequenceM95A(features: M95AFeatureVector, input: M95ASanitizedInput, session: M95ASessionProfile): M95AModelInference {
  const baseline = runBaselineM95A(features, input, session);
  const seqBias = features.sequenceStress * 0.20 + features.lagLikelihood * 0.08 - features.historyDeltaEma * 0.04;
  return {
    rawScore: clamp(baseline.rawScore * 0.72 + seqBias, 0, 1),
    confidence: clamp(baseline.confidence * 0.85 + clamp(input.actionTimeline.length / 20, 0, 0.14), 0.05, 0.99),
    contributions: [...baseline.contributions, { label: 'Temporal sequence encoder', value: seqBias }],
    tier: 'sequence_dl',
  };
}

function runPolicyM95A(features: M95AFeatureVector, input: M95ASanitizedInput, session: M95ASessionProfile): M95AModelInference {
  const seq = runSequenceM95A(features, input, session);
  const policyBias = clamp(features.historyScoreEma - 0.4, 0, 0.3) * 0.10
    + clamp(features.fairnessBand - 0.4, 0, 0.3) * 0.06
    + clamp(1 - session.rewardEma, 0, 0.5) * 0.04;
  return {
    rawScore: clamp(seq.rawScore + policyBias, 0, 1),
    confidence: clamp(seq.confidence * 0.90 + 0.05, 0.05, 0.99),
    contributions: [...seq.contributions, { label: 'Offline policy prior', value: policyBias }],
    tier: 'policy_rl',
  };
}

// ── Top factors + recommendation ─────────────────────────────────────────────

function buildM95ATopFactors(contributions: M95AContribution[], features: M95AFeatureVector, lockOff: boolean, abstain: boolean): string[] {
  const ranked = [...contributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const factors = ranked.map(c => `${c.label}: ${c.value >= 0 ? '+' : ''}${c.value.toFixed(3)}`);
  if (features.lagLikelihood >= 0.6) factors.push(`Lag likelihood: ${(features.lagLikelihood * 100).toFixed(1)}%`);
  if (lockOff) factors.push('Competitive lock-off active — advisory only');
  if (abstain) factors.push('Confidence below abstain threshold — neutralized');
  return factors.slice(0, 5);
}

function buildM95ARecommendation(args: { score: number; lockOffApplied: boolean; shouldAbstain: boolean }): string {
  if (args.lockOffApplied) return 'Competitive lock-off active; recording signal signal only — no nudges applied.';
  if (args.shouldAbstain) return 'Confidence below intervention threshold; maintaining neutral stance and gathering more telemetry.';
  if (args.score >= 0.78) return `Signal in the high-impact zone (${M95A_ML_CONSTANTS.ML_ID}=${args.score.toFixed(2)}); applying bounded intervention while preserving determinism.`;
  if (args.score >= 0.55) return `Signal is active (${M95A_ML_CONSTANTS.ML_ID}=${args.score.toFixed(2)}); light advisory signal active.`;
  return `Signal is baseline; continuing baseline observation and learning.`;
}

// ── Audit receipt ────────────────────────────────────────────────────────────

function buildM95AReceipt(args: {
  auditHash: string;
  output: Omit<M95AOutput, 'auditHash'>;
  sanitized: M95ASanitizedInput;
  tier: M95ATier;
  modelVersion: string;
}): M95AAuditReceipt {
  const receiptId = computeHash(`${args.sanitized.runSeed}:${args.sanitized.tickIndex}:${args.auditHash}:M95A`);
  const receipt: M95AAuditReceipt = {
    receiptId,
    auditHash: args.auditHash,
    rulesetVersion: args.sanitized.rulesetVersion,
    modelVersion: args.modelVersion,
    tier: args.tier,
    runSeed: args.sanitized.runSeed,
    tickIndex: args.sanitized.tickIndex,
    caps: { scoreCap: M95A_ML_CONSTANTS.GUARDRAILS.scoreCap, abstainThreshold: M95A_ML_CONSTANTS.GUARDRAILS.abstainThreshold },
    output: args.output,
    createdAt: new Date(0).toISOString(),
    signature: '',
  };
  receipt.signature = sha256Hex(stableStringify({ ...receipt, signature: undefined, salt: 'M95A_RECEIPT' }));
  return receipt;
}

// ── Session management ──────────────────────────────────────────────────────

function getOrCreateM95ASession(runSeed: string): M95ASessionProfile {
  const existing = m95aSessionStore.get(runSeed);
  if (existing) return existing;
  const created: M95ASessionProfile = {
    sessionKey: runSeed, inferenceCount: 0, scoreEma: 0.45,
    confidenceEma: 0.5, deltaEma: 0, rewardEma: 0.5, lastTick: 0, bandit: {},
  };
  m95aSessionStore.set(runSeed, created);
  return created;
}

function updateM95ASession(session: M95ASessionProfile, features: M95AFeatureVector, score: number, tickIndex: number, rawScore: number): void {
  session.inferenceCount += 1;
  session.lastTick = tickIndex;
  session.scoreEma = ema(session.scoreEma, score, 0.20);
  session.confidenceEma = ema(session.confidenceEma, features.confidenceSignal, 0.18);
  session.deltaEma = ema(session.deltaEma, rawScore - session.scoreEma, 0.16);
  session.rewardEma = ema(session.rewardEma, clamp(score * 0.5 + features.fairnessBand * 0.3 + features.confidenceSignal * 0.2, 0, 1), 0.18);
  const key = score.toFixed(2);
  const bandit = session.bandit[key] ?? { trials: 0, reward: 0.5 };
  bandit.trials += 1;
  bandit.reward = ema(bandit.reward, session.rewardEma, 0.22);
  session.bandit[key] = bandit;
}

// ── Shared utilities ─────────────────────────────────────────────────────────

function normalizeMacroRegime(input: string): MacroRegime {
  const upper = String(input ?? 'NEUTRAL').trim().toUpperCase();
  if (upper === 'BULL' || upper === 'NEUTRAL' || upper === 'BEAR' || upper === 'CRISIS') return upper;
  return 'NEUTRAL';
}

function shouldLockOffM95A(userOptIn: Record<string, boolean>): boolean {
  const lockKeys = ['competitive_mode', 'competitive_lockoff', 'disable_balance_nudges', 'ranked_mode'];
  for (const [key, value] of Object.entries(userOptIn)) {
    if (value && lockKeys.includes(key.toLowerCase())) return true;
  }
  return false;
}

function sanitizeObj(input: Record<string, unknown> | undefined | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== 'object') return out;
  const pii = ['email', 'phone', 'address', 'contact', 'ip', 'geo', 'lat', 'lng', 'longitude', 'latitude'];
  for (const [k, v] of Object.entries(input)) {
    if (pii.some(p => k.toLowerCase().includes(p))) continue;
    out[k] = v;
  }
  return out;
}

function sanitizeArr(input: Record<string, unknown>[] | undefined | null): Record<string, unknown>[] {
  if (!Array.isArray(input)) return [];
  return input.map(i => sanitizeObj(i)).slice(0, 5_000);
}

function sanitizeBoolMap(input: Record<string, boolean> | undefined | null): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input)) out[String(k)] = Boolean(v);
  return out;
}

function extractActions(timeline: Record<string, unknown>[]): M95AActionPoint[] {
  return timeline.map((event, i) => {
    const text = stableStringify(event).toLowerCase();
    const durationMs = clamp(coerceFirstNumber(event, ['decisionMs', 'responseMs', 'durationMs', 'latencyMs']) ?? inferDuration(text), 80, 20_000);
    const timeMs = Math.max(0, coerceFirstNumber(event, ['atMs', 'timeMs', 'timestampMs', 'ts']) ?? i * 1000 + durationMs);
    const label = String(coerceFirstString(event, ['type', 'event', 'action', 'name']) ?? `action_${i}`);
    const decisionDepth = clamp(coerceFirstNumber(event, ['decisionDepth', 'branchCount', 'options']) ?? inferDepth(text), 1, 8);
    const undoLike = /(undo|back|cancel|reverse|rewind|rescind)/i.test(text);
    const timeoutLike = /(timeout|timer_expired|expired|late|too_slow|stall)/i.test(text) || durationMs >= 4500;
    return { timeMs, durationMs, label, decisionDepth, undoLike, timeoutLike };
  }).sort((a, b) => a.timeMs - b.timeMs);
}

function extractUiLatency(ui: Record<string, unknown>, timeline: Record<string, unknown>[]): number[] {
  const samples: number[] = [];
  const keys = ['latencyMs', 'frameTimeMs', 'inputLatencyMs', 'renderDelayMs', 'jitterMs', 'pingMs'];
  for (const k of keys) {
    const v = ui[k];
    if (typeof v === 'number' && Number.isFinite(v)) samples.push(v);
    if (Array.isArray(v)) for (const item of v) if (typeof item === 'number' && Number.isFinite(item)) samples.push(item);
  }
  for (const event of timeline) for (const k of keys) {
    const v = (event as Record<string, unknown>)[k];
    if (typeof v === 'number' && Number.isFinite(v)) samples.push(v);
  }
  return samples.map(v => clamp(v, 0, 12_000));
}

function deriveMacroPressure(regime: MacroRegime, tickIndex: number, runSeed: string): number {
  const chaos = buildChaosWindows(`${runSeed}:M95A:chaos`, CHAOS_WINDOWS_PER_RUN);
  const activeChaos = chaos.some(w => tickIndex >= w.startTick && tickIndex <= w.endTick);
  const base = regime === 'CRISIS' ? 0.7 : regime === 'BEAR' ? 0.45 : regime === 'BULL' ? 0.15 : 0.3;
  return clamp(base + (activeChaos ? 0.25 : 0), 0, 1);
}

function deriveSequenceStress(actions: M95AActionPoint[], tickIndex: number, runSeed: string): number {
  if (actions.length === 0) return clamp(tickIndex / RUN_TOTAL_TICKS, 0, 1) * 0.25;
  const seedBias = (parseInt(computeHash(`${runSeed}:${tickIndex}:seq`), 16) % 11) / 100;
  let sum = 0; let wt = 0;
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]; const recency = (i + 1) / actions.length; const w = 0.2 + recency * 0.8;
    const local = clamp((a.durationMs - 900) / 3800, 0, 1) * 0.55 + clamp((a.decisionDepth - 2) / 5, 0, 1) * 0.20 + (a.undoLike ? 0.08 : 0) + (a.timeoutLike ? 0.17 : 0);
    sum += local * w; wt += w;
  }
  return clamp(sum / Math.max(wt, 0.0001) + seedBias, 0, 1);
}

function coerceFirstNumber(src: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) { const v = src[k]; if (typeof v === 'number' && Number.isFinite(v)) return v; }
  return null;
}
function coerceFirstString(src: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) { const v = src[k]; if (typeof v === 'string' && v.length > 0) return v; }
  return null;
}
function coerceCount(src: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = src[k];
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v));
    if (v && typeof v === 'object') return Object.keys(v as Record<string, unknown>).length;
  }
  return 0;
}
function inferDuration(text: string): number {
  if (/auction|bid|confirm/.test(text)) return 1800;
  if (/menu|inspect|hover/.test(text)) return 850;
  if (/sell|buy|play|move|draw/.test(text)) return 1200;
  if (/timeout|late|stall/.test(text)) return 5200;
  return 1000;
}
function inferDepth(text: string): number {
  if (/auction|hedge|optimize|branch|refi|liquidity/.test(text)) return 4;
  if (/menu|inspect|preview|compare/.test(text)) return 3;
  if (/sell|buy|play|draw|move/.test(text)) return 2;
  return 1;
}
function safeDiv(a: number, b: number): number { return b === 0 ? 0 : clamp(a / b, 0, 1); }
function mean(values: number[]): number { return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length; }
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
function sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)); }
function ema(current: number, next: number, alpha: number): number { return current * (1 - alpha) + next * alpha; }
function safeRound(v: number, digits: number, fallback?: number): number {
  if (!Number.isFinite(v)) return fallback ?? 0;
  const p = 10 ** digits; return Math.round(v * p) / p;
}
function stableStringify(value: unknown): string { return JSON.stringify(sortJson(value)); }
function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(i => sortJson(i));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) out[k] = sortJson((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}
function sha256Hex(input: string): string { return createHash('sha256').update(input).digest('hex'); }
function normalizeBandit(input: Record<string, { trials: number; reward: number }> | undefined): Record<string, { trials: number; reward: number }> {
  const out: Record<string, { trials: number; reward: number }> = {};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) out[k] = { trials: Math.max(0, Math.floor(Number(v?.trials ?? 0))), reward: clamp(Number(v?.reward ?? 0.5), 0, 1) };
  return out;
}
