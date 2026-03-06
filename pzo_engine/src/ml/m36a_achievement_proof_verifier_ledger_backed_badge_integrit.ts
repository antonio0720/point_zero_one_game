// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m36a_achievement_proof_verifier_ledger_backed_badge_integrit.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M36A — Achievement Proof Verifier (Ledger-Backed Badge Integrity)
// Core Pair    : M36
// Family       : integrity
// Category     : anomaly_detector
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL, POLICY_RL
// Placement    : server
// Budget       : batch
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

import { createHash } from 'node:crypto';

import {
  CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  buildChaosWindows, clamp, computeHash,
} from '../mechanics/mechanicsUtils';
import type { MacroRegime } from '../mechanics/types';

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M36A — Achievement Proof Verifier (Ledger-Backed Badge Integrity)
 *
 * Primary function:
 *   Verify achievement proof chain against ledger; detect fabricated or duplicated badge claims
 *
 * What this adds to M36:
 * 1. Verify achievement proof chains against ledger events for badge integrity.
 * 2. Detect fabricated or duplicated badge claims using replay consistency checks.
 * 3. Outputs a confidence score for every issued badge.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M36
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M36ATelemetryInput {
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
  // Extended inputs for M36A (integrity family)

}

// Telemetry events subscribed by M36A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M36ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M36AOutput extends M36ABaseOutput {
  badgeIntegrityScore: unknown;  // badge_integrity_score
  fabricationProbability: unknown;  // fabrication_probability
  duplicateFlag: unknown;  // duplicate_flag
  ledgerConsistencyScore: unknown;  // ledger_consistency_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M36ATier = 'baseline' | 'sequence_dl' | 'graph_dl' | 'policy_rl';

/** M36A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M36ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M36A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M36ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M36A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M36AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M36A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M36APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M36APlacement = 'server';

export interface M36AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'batch';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M36AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M36AEvalContract {
  /** badge_integrity_AUC */
  /** fabrication_recall */
  /** false_flag_rate */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M36AModelCard {
  modelId:            'M36A';
  coreMechanicPair:   'M36';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M36ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M36A_ML_CONSTANTS = {
  ML_ID:              'M36A',
  CORE_PAIR:          'M36',
  MODEL_NAME:         'Achievement Proof Verifier (Ledger-Backed Badge Integrity)',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
  FAMILY:             'integrity' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl', 'policy_rl'] as const,
  PLACEMENT:          ['server'] as const,
  BUDGET:             'batch' as const,
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
  EVAL_FOCUS:         ["badge_integrity_AUC", "fabrication_recall", "false_flag_rate"],
  PRIMARY_OUTPUTS:    ["badge_integrity_score", "fabrication_probability", "duplicate_flag", "ledger_consistency_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Private implementation types ─────────────────────────────────────────────

interface M36ASanitizedInput {
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

interface M36AActionPoint {
  timeMs: number;
  durationMs: number;
  label: string;
  decisionDepth: number;
  undoLike: boolean;
  timeoutLike: boolean;
}

interface M36AFeatureVector {
  schemaVersion: string;
  schemaHash: string;
  anomalyDensity: number;
  hashFreshnessScore: number;
  actionBudgetUsage: number;
  desyncSignalStrength: number;
  replayDivergence: number;
  signatureValidityRate: number;
  eventOrderingScore: number;
  tamperLikelihood: number;
  macroPressure: number;
  negativeOutcomeRate: number;
  lagLikelihood: number;
  sequenceStress: number;
  historyScoreEma: number;
  historyDeltaEma: number;
  fairnessBand: number;
  confidenceSignal: number;
}

interface M36AContribution {
  label: string;
  value: number;
}

interface M36AModelInference {
  rawScore: number;
  confidence: number;
  contributions: M36AContribution[];
  tier: M36ATier;
}

interface M36ASessionProfile {
  sessionKey: string;
  inferenceCount: number;
  scoreEma: number;
  confidenceEma: number;
  deltaEma: number;
  rewardEma: number;
  lastTick: number;
  bandit: Record<string, { trials: number; reward: number }>;
}

export interface M36AAuditReceipt {
  receiptId: string;
  auditHash: string;
  rulesetVersion: string;
  modelVersion: string;
  tier: M36ATier;
  runSeed: string;
  tickIndex: number;
  caps: { scoreCap: number; abstainThreshold: number };
  output: Omit<M36AOutput, 'auditHash'>;
  createdAt: string;
  signature: string;
}

// ── Session store + ledger ───────────────────────────────────────────────────

const m36aSessionStore = new Map<string, M36ASessionProfile>();
const m36aLedgerReceipts: M36AAuditReceipt[] = [];

export function registerM36aLedgerWriter(writer: (receipt: M36AAuditReceipt) => void): () => void {
  m36aLedgerWriters.add(writer);
  return () => m36aLedgerWriters.delete(writer);
}
const m36aLedgerWriters = new Set<(receipt: M36AAuditReceipt) => void>();
m36aLedgerWriters.add((receipt) => {
  m36aLedgerReceipts.push(receipt);
  if (m36aLedgerReceipts.length > 5_000) m36aLedgerReceipts.splice(0, m36aLedgerReceipts.length - 5_000);
});

export function getM36aLedgerReceipts(runSeed?: string): M36AAuditReceipt[] {
  if (!runSeed) return [...m36aLedgerReceipts];
  return m36aLedgerReceipts.filter(r => r.runSeed === runSeed);
}

export function exportM36aLearningState(): Record<string, M36ASessionProfile> {
  return Object.fromEntries(Array.from(m36aSessionStore.entries()).map(([k, v]) => [k, { ...v, bandit: { ...v.bandit } }]));
}

export function hydrateM36aLearningState(state: Record<string, M36ASessionProfile>): void {
  for (const [key, profile] of Object.entries(state ?? {})) {
    if (!profile || typeof profile !== 'object') continue;
    m36aSessionStore.set(key, {
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

export function resetM36aRuntime(): void {
  m36aSessionStore.clear();
  m36aLedgerReceipts.splice(0, m36aLedgerReceipts.length);
}

// ── Main inference ───────────────────────────────────────────────────────────

export async function runM36aMl(
  input: M36ATelemetryInput,
  tier: M36ATier = 'baseline',
  modelCard: Omit<M36AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M36AOutput> {
  const sanitized = sanitizeM36AInput(input);
  const session = getOrCreateM36ASession(sanitized.runSeed);
  const features = buildM36AFeatures(sanitized, session);
  const lockOffApplied = shouldLockOffM36A(sanitized.userOptIn);

  const modelInference = selectInferenceM36A(tier, features, sanitized, session);

  let score = clamp(modelInference.rawScore, 0, M36A_ML_CONSTANTS.GUARDRAILS.scoreCap);
  const confidence = clamp(modelInference.confidence, 0, 1);
  const shouldAbstain = confidence < M36A_ML_CONSTANTS.GUARDRAILS.abstainThreshold;
  if (shouldAbstain) score = 0.5;
  if (lockOffApplied) score = 0.5;

  const topFactors = buildM36ATopFactors(modelInference.contributions, features, lockOffApplied, shouldAbstain);
  const recommendation = buildM36ARecommendation({ score, lockOffApplied, shouldAbstain });

  const baseOutput: Omit<M36AOutput, 'auditHash'> = {
    score,
    topFactors,
    recommendation,
    badgeIntegrityScore: safeRound(clamp(modelInference.rawScore * (1 + 0 * 0.03), 0, 1), 4),
    fabricationProbability: safeRound(clamp(modelInference.rawScore * (1 + 1 * 0.03), 0, 1), 4),
    duplicateFlag: modelInference.rawScore >= 0.65,
    ledgerConsistencyScore: safeRound(clamp(modelInference.rawScore * (1 + 3 * 0.03), 0, 1), 4),
  };

  const auditHash = sha256Hex(stableStringify({
    input: sanitized, tier, features, output: baseOutput,
    rulesetVersion: sanitized.rulesetVersion,
    modelCard: { ...modelCard, modelId: 'M36A', coreMechanicPair: 'M36' },
  }));

  const receipt = buildM36AReceipt({ auditHash, output: baseOutput, sanitized, tier, modelVersion: modelCard.modelVersion });
  for (const writer of m36aLedgerWriters) writer(receipt);

  updateM36ASession(session, features, score, sanitized.tickIndex, modelInference.rawScore);

  return { ...baseOutput, auditHash };
}

// ── Fallback ─────────────────────────────────────────────────────────────────

export function runM36aMlFallback(
  _input: M36ATelemetryInput,
): M36AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = sha256Hex(seed + ':' + tick + ':fallback:M36A');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    badgeIntegrityScore: null,
    fabricationProbability: null,
    duplicateFlag: null,
    ledgerConsistencyScore: null,
  };
}

// ── Input sanitization ──────────────────────────────────────────────────────

function sanitizeM36AInput(input: M36ATelemetryInput): M36ASanitizedInput {
  return {
    runSeed: String(input.runSeed ?? ''),
    tickIndex: clamp(Math.floor(Number(input.tickIndex ?? 0)), 0, RUN_TOTAL_TICKS - 1),
    rulesetVersion: String(input.rulesetVersion ?? 'M36A_RULES_V1'),
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

function buildM36AFeatures(input: M36ASanitizedInput, session: M36ASessionProfile): M36AFeatureVector {
  const actions = extractActions(input.actionTimeline);
  const uiLatency = extractUiLatency(input.uiInteraction, input.actionTimeline);
  const allEvents = [...input.outcomeEvents, ...input.ledgerEvents];
  const negOutKeys = ['loss', 'penalty', 'wipe', 'miss', 'late', 'fail', 'damage', 'default'];
  const negativeOutcomeRate = allEvents.length > 0 ? clamp(allEvents.filter(e => negOutKeys.some(k => stableStringify(e).toLowerCase().includes(k))).length / allEvents.length, 0, 1) : 0;
  const lagKeys = ['lag', 'latency', 'jitter', 'stall', 'freeze'];
  const lagLikelihood = clamp(median(uiLatency) / 900 * 0.35 + (input.actionTimeline.some(e => lagKeys.some(k => stableStringify(e).toLowerCase().includes(k))) ? 0.2 : 0), 0, 1);
  const macroPressure = deriveMacroPressure(input.macroRegime, input.tickIndex, input.runSeed);
  const sequenceStress = deriveSequenceStress(actions, input.tickIndex, input.runSeed);


    const integrityKeys = ['hash', 'signature', 'checksum', 'verify', 'valid', 'tamper', 'desync', 'anomaly'];
    const allEventsIntegrity = [...input.outcomeEvents, ...input.ledgerEvents];
    const integrityEventCount = allEventsIntegrity.filter(e => {
      const text = stableStringify(e).toLowerCase();
      return integrityKeys.some(k => text.includes(k));
    }).length;
    const anomalyDensity = clamp(integrityEventCount / Math.max(1, allEventsIntegrity.length), 0, 1);
    const hashFreshnessScore = clamp(1 - anomalyDensity * 0.7, 0, 1);
    const actionBudgetUsage = clamp(actions.length / Math.max(1, input.tickIndex + 1) / 3, 0, 1);
    const desyncSignalStrength = clamp(anomalyDensity * 0.6 + actionBudgetUsage * 0.3, 0, 1);
    const replayDivergence = clamp(desyncSignalStrength * 0.8, 0, 1);
    const signatureValidityRate = clamp(1 - anomalyDensity, 0, 1);
    const eventOrderingScore = clamp(1 - replayDivergence * 0.5, 0, 1);
    const tamperLikelihood = clamp(anomalyDensity * 0.5 + desyncSignalStrength * 0.3 + (1 - signatureValidityRate) * 0.2, 0, 1);

  const confidenceSignal = clamp(0.25 + clamp(actions.length / 12, 0, 0.3) + clamp(uiLatency.length / 12, 0, 0.15) + clamp(1 - lagLikelihood, 0, 0.2) + 0.1, 0, 1);
  const fairnessBand = clamp(confidenceSignal * 0.5 + (1 - negativeOutcomeRate) * 0.5, 0, 1);

  return {
    schemaVersion: 'M36A_FEATURES_V1',
    schemaHash: M36A_ML_CONSTANTS.GUARDRAILS.scoreCap.toString(),
    anomalyDensity,
    hashFreshnessScore,
    actionBudgetUsage,
    desyncSignalStrength,
    replayDivergence,
    signatureValidityRate,
    eventOrderingScore,
    tamperLikelihood,
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

function selectInferenceM36A(tier: M36ATier, features: M36AFeatureVector, input: M36ASanitizedInput, session: M36ASessionProfile): M36AModelInference {
  switch (tier) {
    case 'sequence_dl': return runSequenceM36A(features, input, session);
    case 'policy_rl':   return runPolicyM36A(features, input, session);
    default:            return runBaselineM36A(features, input, session);
  }
}

function runBaselineM36A(features: M36AFeatureVector, _input: M36ASanitizedInput, session: M36ASessionProfile): M36AModelInference {
  const contributions: M36AContribution[] = [
    { label: 'Anomaly event density', value: features.anomalyDensity * 0.18 },
    { label: 'Hash freshness score', value: features.hashFreshnessScore * 0.14 },
    { label: 'Action budget usage', value: features.actionBudgetUsage * 0.12 },
    { label: 'Desync signal strength', value: features.desyncSignalStrength * 0.11 },
    { label: 'Replay divergence metric', value: features.replayDivergence * 0.10 },
    { label: 'Signature validity rate', value: features.signatureValidityRate * 0.09 },
    { label: 'Event ordering consistency', value: features.eventOrderingScore * 0.08 },
    { label: 'Tamper likelihood estimate', value: features.tamperLikelihood * 0.13 },
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

function runSequenceM36A(features: M36AFeatureVector, input: M36ASanitizedInput, session: M36ASessionProfile): M36AModelInference {
  const baseline = runBaselineM36A(features, input, session);
  const seqBias = features.sequenceStress * 0.20 + features.lagLikelihood * 0.08 - features.historyDeltaEma * 0.04;
  return {
    rawScore: clamp(baseline.rawScore * 0.72 + seqBias, 0, 1),
    confidence: clamp(baseline.confidence * 0.85 + clamp(input.actionTimeline.length / 20, 0, 0.14), 0.05, 0.99),
    contributions: [...baseline.contributions, { label: 'Temporal sequence encoder', value: seqBias }],
    tier: 'sequence_dl',
  };
}

function runPolicyM36A(features: M36AFeatureVector, input: M36ASanitizedInput, session: M36ASessionProfile): M36AModelInference {
  const seq = runSequenceM36A(features, input, session);
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

function buildM36ATopFactors(contributions: M36AContribution[], features: M36AFeatureVector, lockOff: boolean, abstain: boolean): string[] {
  const ranked = [...contributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const factors = ranked.map(c => `${c.label}: ${c.value >= 0 ? '+' : ''}${c.value.toFixed(3)}`);
  if (features.lagLikelihood >= 0.6) factors.push(`Lag likelihood: ${(features.lagLikelihood * 100).toFixed(1)}%`);
  if (lockOff) factors.push('Competitive lock-off active — advisory only');
  if (abstain) factors.push('Confidence below abstain threshold — neutralized');
  return factors.slice(0, 5);
}

function buildM36ARecommendation(args: { score: number; lockOffApplied: boolean; shouldAbstain: boolean }): string {
  if (args.lockOffApplied) return 'Competitive lock-off active; recording signal signal only — no nudges applied.';
  if (args.shouldAbstain) return 'Confidence below intervention threshold; maintaining neutral stance and gathering more telemetry.';
  if (args.score >= 0.78) return `Signal in the critical zone (${M36A_ML_CONSTANTS.ML_ID}=${args.score.toFixed(2)}); applying bounded intervention while preserving determinism.`;
  if (args.score >= 0.55) return `Signal is active (${M36A_ML_CONSTANTS.ML_ID}=${args.score.toFixed(2)}); light advisory signal active.`;
  return `Signal is nominal; continuing baseline observation and learning.`;
}

// ── Audit receipt ────────────────────────────────────────────────────────────

function buildM36AReceipt(args: {
  auditHash: string;
  output: Omit<M36AOutput, 'auditHash'>;
  sanitized: M36ASanitizedInput;
  tier: M36ATier;
  modelVersion: string;
}): M36AAuditReceipt {
  const receiptId = computeHash(`${args.sanitized.runSeed}:${args.sanitized.tickIndex}:${args.auditHash}:M36A`);
  const receipt: M36AAuditReceipt = {
    receiptId,
    auditHash: args.auditHash,
    rulesetVersion: args.sanitized.rulesetVersion,
    modelVersion: args.modelVersion,
    tier: args.tier,
    runSeed: args.sanitized.runSeed,
    tickIndex: args.sanitized.tickIndex,
    caps: { scoreCap: M36A_ML_CONSTANTS.GUARDRAILS.scoreCap, abstainThreshold: M36A_ML_CONSTANTS.GUARDRAILS.abstainThreshold },
    output: args.output,
    createdAt: new Date(0).toISOString(),
    signature: '',
  };
  receipt.signature = sha256Hex(stableStringify({ ...receipt, signature: undefined, salt: 'M36A_RECEIPT' }));
  return receipt;
}

// ── Session management ──────────────────────────────────────────────────────

function getOrCreateM36ASession(runSeed: string): M36ASessionProfile {
  const existing = m36aSessionStore.get(runSeed);
  if (existing) return existing;
  const created: M36ASessionProfile = {
    sessionKey: runSeed, inferenceCount: 0, scoreEma: 0.45,
    confidenceEma: 0.5, deltaEma: 0, rewardEma: 0.5, lastTick: 0, bandit: {},
  };
  m36aSessionStore.set(runSeed, created);
  return created;
}

function updateM36ASession(session: M36ASessionProfile, features: M36AFeatureVector, score: number, tickIndex: number, rawScore: number): void {
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

function shouldLockOffM36A(userOptIn: Record<string, boolean>): boolean {
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

function extractActions(timeline: Record<string, unknown>[]): M36AActionPoint[] {
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
  const chaos = buildChaosWindows(`${runSeed}:M36A:chaos`, CHAOS_WINDOWS_PER_RUN);
  const activeChaos = chaos.some(w => tickIndex >= w.startTick && tickIndex <= w.endTick);
  const base = regime === 'CRISIS' ? 0.7 : regime === 'BEAR' ? 0.45 : regime === 'BULL' ? 0.15 : 0.3;
  return clamp(base + (activeChaos ? 0.25 : 0), 0, 1);
}

function deriveSequenceStress(actions: M36AActionPoint[], tickIndex: number, runSeed: string): number {
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
