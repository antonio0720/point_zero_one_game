// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m18a_griefing_detection_adversarial_budgeting.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M18A — Griefing Detection + Adversarial Budgeting
// Core Pair    : M18
// Family       : integrity
// Category     : anomaly_detector
// IntelSignal  : antiCheat
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
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

import { createHash } from 'node:crypto';

import {
  CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  buildChaosWindows, clamp, computeHash,
} from '../mechanics/mechanicsUtils';
import type { MacroRegime } from '../mechanics/types';

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M18A — Griefing Detection + Adversarial Budgeting
 *
 * Primary function:
 *   Detect sabotage patterns crossing from competitive play into griefing; adjust adversarial budget in real time
 *
 * What this adds to M18:
 * 1. Detect sabotage patterns that cross from competitive play into griefing.
 * 2. Adjusts adversarial budget in real time without hard-blocking legitimate aggression.
 * 3. Feeds Exploit Taxonomy (M49) escalation pipeline.
 *
 * Intelligence signal → IntelligenceState.antiCheat
 * Core mechanic pair  → M18
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M18ATelemetryInput {
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
  // Extended inputs for M18A (integrity family)

}

// Telemetry events subscribed by M18A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M18ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M18AOutput extends M18ABaseOutput {
  griefProbability: unknown;  // grief_probability
  adversarialBudgetDelta: unknown;  // adversarial_budget_delta
  escalationFlag: unknown;  // escalation_flag
  legitimateAggressionScore: unknown;  // legitimate_aggression_score
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M18ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

/** M18A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M18ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M18A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M18ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M18A — Tier: POLICY_RL
 *  Constrained contextual bandit / offline PPO (bounded nudges)
 */
export interface M18APolicyRlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M18APlacement = 'server';

export interface M18AInferencePlacement {
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M18AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   false;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M18AEvalContract {
  /** grief_precision */
  /** legitimate_aggression_false_positive_rate */
  /** exploit_escalation_AUC */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M18AModelCard {
  modelId:            'M18A';
  coreMechanicPair:   'M18';
  intelligenceSignal: 'antiCheat';
  modelCategory:      'anomaly_detector';
  family:             'integrity';
  tier:               M18ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M18A_ML_CONSTANTS = {
  ML_ID:              'M18A',
  CORE_PAIR:          'M18',
  MODEL_NAME:         'Griefing Detection + Adversarial Budgeting',
  INTEL_SIGNAL:       'antiCheat' as const,
  MODEL_CATEGORY:     'anomaly_detector' as const,
  FAMILY:             'integrity' as const,
  TIERS:              ['baseline', 'sequence_dl', 'policy_rl'] as const,
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
  EVAL_FOCUS:         ["grief_precision", "legitimate_aggression_false_positive_rate", "exploit_escalation_AUC"],
  PRIMARY_OUTPUTS:    ["grief_probability", "adversarial_budget_delta", "escalation_flag", "legitimate_aggression_score"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Private implementation types ─────────────────────────────────────────────

interface M18ASanitizedInput {
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

interface M18AActionPoint {
  timeMs: number;
  durationMs: number;
  label: string;
  decisionDepth: number;
  undoLike: boolean;
  timeoutLike: boolean;
}

interface M18AFeatureVector {
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

interface M18AContribution {
  label: string;
  value: number;
}

interface M18AModelInference {
  rawScore: number;
  confidence: number;
  contributions: M18AContribution[];
  tier: M18ATier;
}

interface M18ASessionProfile {
  sessionKey: string;
  inferenceCount: number;
  scoreEma: number;
  confidenceEma: number;
  deltaEma: number;
  rewardEma: number;
  lastTick: number;
  bandit: Record<string, { trials: number; reward: number }>;
}

export interface M18AAuditReceipt {
  receiptId: string;
  auditHash: string;
  rulesetVersion: string;
  modelVersion: string;
  tier: M18ATier;
  runSeed: string;
  tickIndex: number;
  caps: { scoreCap: number; abstainThreshold: number };
  output: Omit<M18AOutput, 'auditHash'>;
  createdAt: string;
  signature: string;
}

// ── Session store + ledger ───────────────────────────────────────────────────

const m18aSessionStore = new Map<string, M18ASessionProfile>();
const m18aLedgerReceipts: M18AAuditReceipt[] = [];

export function registerM18aLedgerWriter(writer: (receipt: M18AAuditReceipt) => void): () => void {
  m18aLedgerWriters.add(writer);
  return () => m18aLedgerWriters.delete(writer);
}
const m18aLedgerWriters = new Set<(receipt: M18AAuditReceipt) => void>();
m18aLedgerWriters.add((receipt) => {
  m18aLedgerReceipts.push(receipt);
  if (m18aLedgerReceipts.length > 5_000) m18aLedgerReceipts.splice(0, m18aLedgerReceipts.length - 5_000);
});

export function getM18aLedgerReceipts(runSeed?: string): M18AAuditReceipt[] {
  if (!runSeed) return [...m18aLedgerReceipts];
  return m18aLedgerReceipts.filter(r => r.runSeed === runSeed);
}

export function exportM18aLearningState(): Record<string, M18ASessionProfile> {
  return Object.fromEntries(Array.from(m18aSessionStore.entries()).map(([k, v]) => [k, { ...v, bandit: { ...v.bandit } }]));
}

export function hydrateM18aLearningState(state: Record<string, M18ASessionProfile>): void {
  for (const [key, profile] of Object.entries(state ?? {})) {
    if (!profile || typeof profile !== 'object') continue;
    m18aSessionStore.set(key, {
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

export function resetM18aRuntime(): void {
  m18aSessionStore.clear();
  m18aLedgerReceipts.splice(0, m18aLedgerReceipts.length);
}

// ── Main inference ───────────────────────────────────────────────────────────

export async function runM18aMl(
  input: M18ATelemetryInput,
  tier: M18ATier = 'baseline',
  modelCard: Omit<M18AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M18AOutput> {
  const sanitized = sanitizeM18AInput(input);
  const session = getOrCreateM18ASession(sanitized.runSeed);
  const features = buildM18AFeatures(sanitized, session);
  const lockOffApplied = shouldLockOffM18A(sanitized.userOptIn);

  const modelInference = selectInferenceM18A(tier, features, sanitized, session);

  let score = clamp(modelInference.rawScore, 0, M18A_ML_CONSTANTS.GUARDRAILS.scoreCap);
  const confidence = clamp(modelInference.confidence, 0, 1);
  const shouldAbstain = confidence < M18A_ML_CONSTANTS.GUARDRAILS.abstainThreshold;
  if (shouldAbstain) score = 0.5;
  if (lockOffApplied) score = 0.5;

  const topFactors = buildM18ATopFactors(modelInference.contributions, features, lockOffApplied, shouldAbstain);
  const recommendation = buildM18ARecommendation({ score, lockOffApplied, shouldAbstain });

  const baseOutput: Omit<M18AOutput, 'auditHash'> = {
    score,
    topFactors,
    recommendation,
    griefProbability: safeRound(clamp(modelInference.rawScore * (1 + 0 * 0.03), 0, 1), 4),
    adversarialBudgetDelta: safeRound(modelInference.rawScore * 100, 2),
    escalationFlag: modelInference.rawScore >= 0.65,
    legitimateAggressionScore: safeRound(clamp(modelInference.rawScore * (1 + 3 * 0.03), 0, 1), 4),
  };

  const auditHash = sha256Hex(stableStringify({
    input: sanitized, tier, features, output: baseOutput,
    rulesetVersion: sanitized.rulesetVersion,
    modelCard: { ...modelCard, modelId: 'M18A', coreMechanicPair: 'M18' },
  }));

  const receipt = buildM18AReceipt({ auditHash, output: baseOutput, sanitized, tier, modelVersion: modelCard.modelVersion });
  for (const writer of m18aLedgerWriters) writer(receipt);

  updateM18ASession(session, features, score, sanitized.tickIndex, modelInference.rawScore);

  return { ...baseOutput, auditHash };
}

// ── Fallback ─────────────────────────────────────────────────────────────────

export function runM18aMlFallback(
  _input: M18ATelemetryInput,
): M18AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = sha256Hex(seed + ':' + tick + ':fallback:M18A');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    griefProbability: null,
    adversarialBudgetDelta: null,
    escalationFlag: null,
    legitimateAggressionScore: null,
  };
}

// ── Input sanitization ──────────────────────────────────────────────────────

function sanitizeM18AInput(input: M18ATelemetryInput): M18ASanitizedInput {
  return {
    runSeed: String(input.runSeed ?? ''),
    tickIndex: clamp(Math.floor(Number(input.tickIndex ?? 0)), 0, RUN_TOTAL_TICKS - 1),
    rulesetVersion: String(input.rulesetVersion ?? 'M18A_RULES_V1'),
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

function buildM18AFeatures(input: M18ASanitizedInput, session: M18ASessionProfile): M18AFeatureVector {
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
    const allEventsForIntegrity = [...input.outcomeEvents, ...input.ledgerEvents];
    const integrityEventCount = allEventsForIntegrity.filter(e => {
      const text = stableStringify(e).toLowerCase();
      return integrityKeys.some(k => text.includes(k));
    }).length;
    const anomalyDensity = clamp(integrityEventCount / Math.max(1, allEventsForIntegrity.length), 0, 1);
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
    schemaVersion: 'M18A_FEATURES_V1',
    schemaHash: M18A_ML_CONSTANTS.GUARDRAILS.scoreCap.toString(),
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

function selectInferenceM18A(tier: M18ATier, features: M18AFeatureVector, input: M18ASanitizedInput, session: M18ASessionProfile): M18AModelInference {
  switch (tier) {
    case 'sequence_dl': return runSequenceM18A(features, input, session);
    case 'policy_rl':   return runPolicyM18A(features, input, session);
    default:            return runBaselineM18A(features, input, session);
  }
}

function runBaselineM18A(features: M18AFeatureVector, _input: M18ASanitizedInput, session: M18ASessionProfile): M18AModelInference {
  const contributions: M18AContribution[] = [
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

function runSequenceM18A(features: M18AFeatureVector, input: M18ASanitizedInput, session: M18ASessionProfile): M18AModelInference {
  const baseline = runBaselineM18A(features, input, session);
  const seqBias = features.sequenceStress * 0.20 + features.lagLikelihood * 0.08 - features.historyDeltaEma * 0.04;
  return {
    rawScore: clamp(baseline.rawScore * 0.72 + seqBias, 0, 1),
    confidence: clamp(baseline.confidence * 0.85 + clamp(input.actionTimeline.length / 20, 0, 0.14), 0.05, 0.99),
    contributions: [...baseline.contributions, { label: 'Temporal sequence encoder', value: seqBias }],
    tier: 'sequence_dl',
  };
}

function runPolicyM18A(features: M18AFeatureVector, input: M18ASanitizedInput, session: M18ASessionProfile): M18AModelInference {
  const seq = runSequenceM18A(features, input, session);
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

function buildM18ATopFactors(contributions: M18AContribution[], features: M18AFeatureVector, lockOff: boolean, abstain: boolean): string[] {
  const ranked = [...contributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const factors = ranked.map(c => `${c.label}: ${c.value >= 0 ? '+' : ''}${c.value.toFixed(3)}`);
  if (features.lagLikelihood >= 0.6) factors.push(`Lag likelihood: ${(features.lagLikelihood * 100).toFixed(1)}%`);
  if (lockOff) factors.push('Competitive lock-off active — advisory only');
  if (abstain) factors.push('Confidence below abstain threshold — neutralized');
  return factors.slice(0, 5);
}

function buildM18ARecommendation(args: { score: number; lockOffApplied: boolean; shouldAbstain: boolean }): string {
  if (args.lockOffApplied) return 'Competitive lock-off active; recording signal signal only — no nudges applied.';
  if (args.shouldAbstain) return 'Confidence below intervention threshold; maintaining neutral stance and gathering more telemetry.';
  if (args.score >= 0.78) return `Signal in the critical zone (${M18A_ML_CONSTANTS.ML_ID}=${args.score.toFixed(2)}); applying bounded intervention while preserving determinism.`;
  if (args.score >= 0.55) return `Signal is active (${M18A_ML_CONSTANTS.ML_ID}=${args.score.toFixed(2)}); light advisory signal active.`;
  return `Signal is nominal; continuing baseline observation and learning.`;
}

// ── Audit receipt ────────────────────────────────────────────────────────────

function buildM18AReceipt(args: {
  auditHash: string;
  output: Omit<M18AOutput, 'auditHash'>;
  sanitized: M18ASanitizedInput;
  tier: M18ATier;
  modelVersion: string;
}): M18AAuditReceipt {
  const receiptId = computeHash(`${args.sanitized.runSeed}:${args.sanitized.tickIndex}:${args.auditHash}:M18A`);
  const receipt: M18AAuditReceipt = {
    receiptId,
    auditHash: args.auditHash,
    rulesetVersion: args.sanitized.rulesetVersion,
    modelVersion: args.modelVersion,
    tier: args.tier,
    runSeed: args.sanitized.runSeed,
    tickIndex: args.sanitized.tickIndex,
    caps: { scoreCap: M18A_ML_CONSTANTS.GUARDRAILS.scoreCap, abstainThreshold: M18A_ML_CONSTANTS.GUARDRAILS.abstainThreshold },
    output: args.output,
    createdAt: new Date(0).toISOString(),
    signature: '',
  };
  receipt.signature = sha256Hex(stableStringify({ ...receipt, signature: undefined, salt: 'M18A_RECEIPT' }));
  return receipt;
}

// ── Session management ──────────────────────────────────────────────────────

function getOrCreateM18ASession(runSeed: string): M18ASessionProfile {
  const existing = m18aSessionStore.get(runSeed);
  if (existing) return existing;
  const created: M18ASessionProfile = {
    sessionKey: runSeed, inferenceCount: 0, scoreEma: 0.45,
    confidenceEma: 0.5, deltaEma: 0, rewardEma: 0.5, lastTick: 0, bandit: {},
  };
  m18aSessionStore.set(runSeed, created);
  return created;
}

function updateM18ASession(session: M18ASessionProfile, features: M18AFeatureVector, score: number, tickIndex: number, rawScore: number): void {
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

function shouldLockOffM18A(userOptIn: Record<string, boolean>): boolean {
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

function extractActions(timeline: Record<string, unknown>[]): M18AActionPoint[] {
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
  const chaos = buildChaosWindows(`${runSeed}:M18A:chaos`, CHAOS_WINDOWS_PER_RUN);
  const activeChaos = chaos.some(w => tickIndex >= w.startTick && tickIndex <= w.endTick);
  const base = regime === 'CRISIS' ? 0.7 : regime === 'BEAR' ? 0.45 : regime === 'BULL' ? 0.15 : 0.3;
  return clamp(base + (activeChaos ? 0.25 : 0), 0, 1);
}

function deriveSequenceStress(actions: M18AActionPoint[], tickIndex: number, runSeed: string): number {
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
