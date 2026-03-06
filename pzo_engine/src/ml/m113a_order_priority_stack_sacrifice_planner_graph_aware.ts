// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — src/ml/m113a_order_priority_stack_sacrifice_planner_graph_aware.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M113A — Order Priority Stack Sacrifice Planner (Graph-Aware)
// Core Pair    : M113
// Family       : market
// Category     : rl_policy
// IntelSignal  : momentum
// Tiers        : BASELINE, SEQUENCE_DL, GRAPH_DL
// Placement    : client, server
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

import { createHash } from 'node:crypto';

import {
  CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  buildChaosWindows, clamp, computeHash,
} from '../mechanics/mechanicsUtils';
import type { MacroRegime } from '../mechanics/types';

// ── What this adds ────────────────────────────────────────────────────────────
/**
 * M113A — Order Priority Stack Sacrifice Planner (Graph-Aware)
 *
 * Primary function:
 *   Plan sacrifice order to minimize cascade loss using portfolio dependency graph; surface highest-leverage protection choices
 *
 * What this adds to M113:
 * 1. Plan sacrifice order to minimize cascade loss using portfolio dependency graph analysis.
 * 2. Surface highest-leverage protection choices under incoming damage.
 * 3. Generates sacrifice plan receipts for Case File.
 *
 * Intelligence signal → IntelligenceState.momentum
 * Core mechanic pair  → M113
 */

// ── Telemetry input ───────────────────────────────────────────────────────────
export interface M113ATelemetryInput {
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
  // Extended inputs for M113A (market family)

}

// Telemetry events subscribed by M113A
// 

// ── Primary output contract ───────────────────────────────────────────────────
export interface M113ABaseOutput {
  score:          number;  // 0–1, semantic depends on mechanic
  topFactors:     string[];
  recommendation: string;
  auditHash:      string;  // SHA256(inputs + outputs + ruleset_version + caps)
}

export interface M113AOutput extends M113ABaseOutput {
  sacrificeOrderPlan: unknown;  // sacrifice_order_plan
  cascadeMinimizationScore: unknown;  // cascade_minimization_score
  protectionPriority: unknown;  // protection_priority
  caseFileReceipt: unknown;  // case_file_receipt
}

// ── Model tiers ───────────────────────────────────────────────────────────────
export type M113ATier = 'baseline' | 'sequence_dl' | 'graph_dl';

/** M113A — Tier: BASELINE
 *  GBM + calibrated logistic (fast, low-cost, production default)
 */
export interface M113ABaselineConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M113A — Tier: SEQUENCE_DL
 *  TCN / Transformer encoder over event streams (sequential patterns)
 */
export interface M113ASequenceDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

/** M113A — Tier: GRAPH_DL
 *  GNN over contract / market / ledger graphs (relationship-aware)
 */
export interface M113AGraphDlConfig {
  enabled:          boolean;
  modelVersion:     string;
  featureSchemaHash: string;
  latencySLOMs:     number;   // 0 = batch/async
}

// ── Inference placement ───────────────────────────────────────────────────────
export type M113APlacement = 'client' | 'server';

export interface M113AInferencePlacement {
  /** On-device — privacy-safe, low-latency UX signals */
  client: boolean;
  /** Server-side — integrity, balancing, anti-abuse, economy */
  server: boolean;
  budget: 'real_time';
}

// ── Guardrails (non-negotiable) ───────────────────────────────────────────────
export interface M113AGuardrails {
  determinismPreserved:        true;
  boundedNudges:               true;
  auditabilityRequired:        true;
  privacyEnforced:             true;
  competitiveLockOffAllowed:   true;
  scoreCap:                    1.0;
  abstainThreshold:            number;
}

// ── Evaluation contract ───────────────────────────────────────────────────────
export interface M113AEvalContract {
  /** sacrifice_plan_optimality */
  /** cascade_minimization_AUC */
  /** protection_accuracy */
  momentYieldMinimum:  3;
  maxRiggedReportRate: number;
  maxFairnessDrift:    number;
}

// ── Model card ────────────────────────────────────────────────────────────────
export interface M113AModelCard {
  modelId:            'M113A';
  coreMechanicPair:   'M113';
  intelligenceSignal: 'momentum';
  modelCategory:      'rl_policy';
  family:             'market';
  tier:               M113ATier;
  modelVersion:       string;
  trainCutDate:       string;
  featureSchemaHash:  string;
  rulesetVersion:     string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const M113A_ML_CONSTANTS = {
  ML_ID:              'M113A',
  CORE_PAIR:          'M113',
  MODEL_NAME:         'Order Priority Stack Sacrifice Planner (Graph-Aware)',
  INTEL_SIGNAL:       'momentum' as const,
  MODEL_CATEGORY:     'rl_policy' as const,
  FAMILY:             'market' as const,
  TIERS:              ['baseline', 'sequence_dl', 'graph_dl'] as const,
  PLACEMENT:          ['client', 'server'] as const,
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
  EVAL_FOCUS:         ["sacrifice_plan_optimality", "cascade_minimization_AUC", "protection_accuracy"],
  PRIMARY_OUTPUTS:    ["sacrifice_order_plan", "cascade_minimization_score", "protection_priority", "case_file_receipt"],
  TELEMETRY_EVENTS:   [],
} as const;

// ── Private implementation types ─────────────────────────────────────────────

interface M113ASanitizedInput {
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

interface M113AActionPoint {
  timeMs: number;
  durationMs: number;
  label: string;
  decisionDepth: number;
  undoLike: boolean;
  timeoutLike: boolean;
}

interface M113AFeatureVector {
  schemaVersion: string;
  schemaHash: string;
  portfolioValueNorm: number;
  debtServiceRatio: number;
  solvencyMargin: number;
  cashVelocity: number;
  assetConcentration: number;
  macroRegimePressure: number;
  exitWindowQuality: number;
  negativeOutcomeRate: number;
  macroPressure: number;
  lagLikelihood: number;
  sequenceStress: number;
  historyScoreEma: number;
  historyDeltaEma: number;
  fairnessBand: number;
  confidenceSignal: number;
}

interface M113AContribution {
  label: string;
  value: number;
}

interface M113AModelInference {
  rawScore: number;
  confidence: number;
  contributions: M113AContribution[];
  tier: M113ATier;
}

interface M113ASessionProfile {
  sessionKey: string;
  inferenceCount: number;
  scoreEma: number;
  confidenceEma: number;
  deltaEma: number;
  rewardEma: number;
  lastTick: number;
  bandit: Record<string, { trials: number; reward: number }>;
}

export interface M113AAuditReceipt {
  receiptId: string;
  auditHash: string;
  rulesetVersion: string;
  modelVersion: string;
  tier: M113ATier;
  runSeed: string;
  tickIndex: number;
  caps: { scoreCap: number; abstainThreshold: number };
  output: Omit<M113AOutput, 'auditHash'>;
  createdAt: string;
  signature: string;
}

// ── Session store + ledger ───────────────────────────────────────────────────

const m113aSessionStore = new Map<string, M113ASessionProfile>();
const m113aLedgerReceipts: M113AAuditReceipt[] = [];

export function registerM113aLedgerWriter(writer: (receipt: M113AAuditReceipt) => void): () => void {
  m113aLedgerWriters.add(writer);
  return () => m113aLedgerWriters.delete(writer);
}
const m113aLedgerWriters = new Set<(receipt: M113AAuditReceipt) => void>();
m113aLedgerWriters.add((receipt) => {
  m113aLedgerReceipts.push(receipt);
  if (m113aLedgerReceipts.length > 5_000) m113aLedgerReceipts.splice(0, m113aLedgerReceipts.length - 5_000);
});

export function getM113aLedgerReceipts(runSeed?: string): M113AAuditReceipt[] {
  if (!runSeed) return [...m113aLedgerReceipts];
  return m113aLedgerReceipts.filter(r => r.runSeed === runSeed);
}

export function exportM113aLearningState(): Record<string, M113ASessionProfile> {
  return Object.fromEntries(Array.from(m113aSessionStore.entries()).map(([k, v]) => [k, { ...v, bandit: { ...v.bandit } }]));
}

export function hydrateM113aLearningState(state: Record<string, M113ASessionProfile>): void {
  for (const [key, profile] of Object.entries(state ?? {})) {
    if (!profile || typeof profile !== 'object') continue;
    m113aSessionStore.set(key, {
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

export function resetM113aRuntime(): void {
  m113aSessionStore.clear();
  m113aLedgerReceipts.splice(0, m113aLedgerReceipts.length);
}

// ── Main inference ───────────────────────────────────────────────────────────

export async function runM113aMl(
  input: M113ATelemetryInput,
  tier: M113ATier = 'baseline',
  modelCard: Omit<M113AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M113AOutput> {
  const sanitized = sanitizeM113AInput(input);
  const session = getOrCreateM113ASession(sanitized.runSeed);
  const features = buildM113AFeatures(sanitized, session);
  const lockOffApplied = shouldLockOffM113A(sanitized.userOptIn);

  const modelInference = selectInferenceM113A(tier, features, sanitized, session);

  let score = clamp(modelInference.rawScore, 0, M113A_ML_CONSTANTS.GUARDRAILS.scoreCap);
  const confidence = clamp(modelInference.confidence, 0, 1);
  const shouldAbstain = confidence < M113A_ML_CONSTANTS.GUARDRAILS.abstainThreshold;
  if (shouldAbstain) score = 0.5;
  if (lockOffApplied) score = 0.5;

  const topFactors = buildM113ATopFactors(modelInference.contributions, features, lockOffApplied, shouldAbstain);
  const recommendation = buildM113ARecommendation({ score, lockOffApplied, shouldAbstain });

  const baseOutput: Omit<M113AOutput, 'auditHash'> = {
    score,
    topFactors,
    recommendation,
    sacrificeOrderPlan: safeRound(modelInference.rawScore * (0.9 + 0 * 0.02), 4),
    cascadeMinimizationScore: safeRound(clamp(modelInference.rawScore * (1 + 1 * 0.03), 0, 1), 4),
    protectionPriority: safeRound(modelInference.rawScore * (0.9 + 2 * 0.02), 4),
    caseFileReceipt: safeRound(modelInference.rawScore * (0.9 + 3 * 0.02), 4),
  };

  const auditHash = sha256Hex(stableStringify({
    input: sanitized, tier, features, output: baseOutput,
    rulesetVersion: sanitized.rulesetVersion,
    modelCard: { ...modelCard, modelId: 'M113A', coreMechanicPair: 'M113' },
  }));

  const receipt = buildM113AReceipt({ auditHash, output: baseOutput, sanitized, tier, modelVersion: modelCard.modelVersion });
  for (const writer of m113aLedgerWriters) writer(receipt);

  updateM113ASession(session, features, score, sanitized.tickIndex, modelInference.rawScore);

  return { ...baseOutput, auditHash };
}

// ── Fallback ─────────────────────────────────────────────────────────────────

export function runM113aMlFallback(
  _input: M113ATelemetryInput,
): M113AOutput {
  const seed = String(((_input as unknown) as Record<string, unknown>).runSeed ?? '');
  const tick = Number(((_input as unknown) as Record<string, unknown>).tickIndex ?? 0);
  const auditHash = sha256Hex(seed + ':' + tick + ':fallback:M113A');
  return {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    auditHash,
    sacrificeOrderPlan: null,
    cascadeMinimizationScore: null,
    protectionPriority: null,
    caseFileReceipt: null,
  };
}

// ── Input sanitization ──────────────────────────────────────────────────────

function sanitizeM113AInput(input: M113ATelemetryInput): M113ASanitizedInput {
  return {
    runSeed: String(input.runSeed ?? ''),
    tickIndex: clamp(Math.floor(Number(input.tickIndex ?? 0)), 0, RUN_TOTAL_TICKS - 1),
    rulesetVersion: String(input.rulesetVersion ?? 'M113A_RULES_V1'),
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

function buildM113AFeatures(input: M113ASanitizedInput, session: M113ASessionProfile): M113AFeatureVector {
  const actions = extractActions(input.actionTimeline);
  const uiLatency = extractUiLatency(input.uiInteraction, input.actionTimeline);
  const allEvents = [...input.outcomeEvents, ...input.ledgerEvents];
  const negOutKeys = ['loss', 'penalty', 'wipe', 'miss', 'late', 'fail', 'damage', 'default'];
  const negativeOutcomeRate = allEvents.length > 0 ? clamp(allEvents.filter(e => negOutKeys.some(k => stableStringify(e).toLowerCase().includes(k))).length / allEvents.length, 0, 1) : 0;
  const lagKeys = ['lag', 'latency', 'jitter', 'stall', 'freeze'];
  const lagLikelihood = clamp(median(uiLatency) / 900 * 0.35 + (input.actionTimeline.some(e => lagKeys.some(k => stableStringify(e).toLowerCase().includes(k))) ? 0.2 : 0), 0, 1);
  const macroPressure = deriveMacroPressure(input.macroRegime, input.tickIndex, input.runSeed);
  const sequenceStress = deriveSequenceStress(actions, input.tickIndex, input.runSeed);


    const assets = coerceCount(input.portfolioSnapshot, ['assets', 'holdings', 'positions']);
    const debts = coerceCount(input.portfolioSnapshot, ['debts', 'liabilities', 'obligations']);
    const shields = coerceCount(input.portfolioSnapshot, ['shields', 'protections']);
    const netWorth = coerceFirstNumber(input.portfolioSnapshot, ['netWorth', 'totalValue', 'cash']) ?? 10000;
    const debtTotal = coerceFirstNumber(input.portfolioSnapshot, ['debtTotal', 'totalDebt']) ?? 0;
    const cashflow = coerceFirstNumber(input.portfolioSnapshot, ['cashflow', 'monthlyNet', 'income']) ?? 500;

    const portfolioValueNorm = clamp(netWorth / 50000, 0, 1);
    const debtServiceRatio = clamp(debtTotal / Math.max(1, netWorth), 0, 1);
    const solvencyMargin = clamp(1 - debtServiceRatio, 0, 1);
    const cashVelocity = clamp(Math.abs(cashflow) / Math.max(1, netWorth) * 10, 0, 1);
    const assetConcentration = clamp((assets > 0 ? 1 / assets : 1) * 0.5 + (debts > 3 ? 0.3 : 0), 0, 1);
    const exitWindowQuality = clamp(1 - input.tickIndex / RUN_TOTAL_TICKS, 0, 1);

  const confidenceSignal = clamp(0.25 + clamp(actions.length / 12, 0, 0.3) + clamp(uiLatency.length / 12, 0, 0.15) + clamp(1 - lagLikelihood, 0, 0.2) + 0.1, 0, 1);
  const fairnessBand = clamp(confidenceSignal * 0.5 + (1 - negativeOutcomeRate) * 0.5, 0, 1);

  return {
    schemaVersion: 'M113A_FEATURES_V1',
    schemaHash: M113A_ML_CONSTANTS.GUARDRAILS.scoreCap.toString(),
    portfolioValueNorm,
    debtServiceRatio,
    solvencyMargin,
    cashVelocity,
    assetConcentration,
    macroRegimePressure: macroPressure, // Added this line
    macroPressure,
    exitWindowQuality,
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

function selectInferenceM113A(tier: M113ATier, features: M113AFeatureVector, input: M113ASanitizedInput, session: M113ASessionProfile): M113AModelInference {
  switch (tier) {
    case 'sequence_dl': return runSequenceM113A(features, input, session);
    case 'graph_dl':    return runPolicyM113A(features, input, session);
    default:            return runBaselineM113A(features, input, session);
  }
}

function runBaselineM113A(features: M113AFeatureVector, _input: M113ASanitizedInput, session: M113ASessionProfile): M113AModelInference {
  const contributions: M113AContribution[] = [
    { label: 'Portfolio value normalized', value: features.portfolioValueNorm * 0.16 },
    { label: 'Debt service pressure', value: features.debtServiceRatio * 0.14 },
    { label: 'Solvency margin distance', value: features.solvencyMargin * 0.13 },
    { label: 'Cash flow velocity', value: features.cashVelocity * 0.10 },
    { label: 'Asset concentration risk', value: features.assetConcentration * 0.09 },
    { label: 'Macro regime pressure', value: features.macroRegimePressure * 0.11 },
    { label: 'Exit window quality', value: features.exitWindowQuality * 0.08 },
    { label: 'Negative outcome rate', value: features.negativeOutcomeRate * 0.07 },
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

function runSequenceM113A(features: M113AFeatureVector, input: M113ASanitizedInput, session: M113ASessionProfile): M113AModelInference {
  const baseline = runBaselineM113A(features, input, session);
  const seqBias = features.sequenceStress * 0.20 + features.lagLikelihood * 0.08 - features.historyDeltaEma * 0.04;
  return {
    rawScore: clamp(baseline.rawScore * 0.72 + seqBias, 0, 1),
    confidence: clamp(baseline.confidence * 0.85 + clamp(input.actionTimeline.length / 20, 0, 0.14), 0.05, 0.99),
    contributions: [...baseline.contributions, { label: 'Temporal sequence encoder', value: seqBias }],
    tier: 'sequence_dl',
  };
}

function runPolicyM113A(features: M113AFeatureVector, input: M113ASanitizedInput, session: M113ASessionProfile): M113AModelInference {
  const seq = runSequenceM113A(features, input, session);
  const policyBias = clamp(features.historyScoreEma - 0.4, 0, 0.3) * 0.10
    + clamp(features.fairnessBand - 0.4, 0, 0.3) * 0.06
    + clamp(1 - session.rewardEma, 0, 0.5) * 0.04;
  return {
    rawScore: clamp(seq.rawScore + policyBias, 0, 1),
    confidence: clamp(seq.confidence * 0.90 + 0.05, 0.05, 0.99),
    contributions: [...seq.contributions, { label: 'Offline policy prior', value: policyBias }],
    tier: 'graph_dl',
  };
}

// ── Top factors + recommendation ─────────────────────────────────────────────

function buildM113ATopFactors(contributions: M113AContribution[], features: M113AFeatureVector, lockOff: boolean, abstain: boolean): string[] {
  const ranked = [...contributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const factors = ranked.map(c => `${c.label}: ${c.value >= 0 ? '+' : ''}${c.value.toFixed(3)}`);
  if (features.lagLikelihood >= 0.6) factors.push(`Lag likelihood: ${(features.lagLikelihood * 100).toFixed(1)}%`);
  if (lockOff) factors.push('Competitive lock-off active — advisory only');
  if (abstain) factors.push('Confidence below abstain threshold — neutralized');
  return factors.slice(0, 5);
}

function buildM113ARecommendation(args: { score: number; lockOffApplied: boolean; shouldAbstain: boolean }): string {
  if (args.lockOffApplied) return 'Competitive lock-off active; recording signal signal only — no nudges applied.';
  if (args.shouldAbstain) return 'Confidence below intervention threshold; maintaining neutral stance and gathering more telemetry.';
  if (args.score >= 0.78) return `Signal in the critical zone (${M113A_ML_CONSTANTS.ML_ID}=${args.score.toFixed(2)}); applying bounded intervention while preserving determinism.`;
  if (args.score >= 0.55) return `Signal is active (${M113A_ML_CONSTANTS.ML_ID}=${args.score.toFixed(2)}); light advisory signal active.`;
  return `Signal is nominal; continuing baseline observation and learning.`;
}

// ── Audit receipt ────────────────────────────────────────────────────────────

function buildM113AReceipt(args: {
  auditHash: string;
  output: Omit<M113AOutput, 'auditHash'>;
  sanitized: M113ASanitizedInput;
  tier: M113ATier;
  modelVersion: string;
}): M113AAuditReceipt {
  const receiptId = computeHash(`${args.sanitized.runSeed}:${args.sanitized.tickIndex}:${args.auditHash}:M113A`);
  const receipt: M113AAuditReceipt = {
    receiptId,
    auditHash: args.auditHash,
    rulesetVersion: args.sanitized.rulesetVersion,
    modelVersion: args.modelVersion,
    tier: args.tier,
    runSeed: args.sanitized.runSeed,
    tickIndex: args.sanitized.tickIndex,
    caps: { scoreCap: M113A_ML_CONSTANTS.GUARDRAILS.scoreCap, abstainThreshold: M113A_ML_CONSTANTS.GUARDRAILS.abstainThreshold },
    output: args.output,
    createdAt: new Date(0).toISOString(),
    signature: '',
  };
  receipt.signature = sha256Hex(stableStringify({ ...receipt, signature: undefined, salt: 'M113A_RECEIPT' }));
  return receipt;
}

// ── Session management ──────────────────────────────────────────────────────

function getOrCreateM113ASession(runSeed: string): M113ASessionProfile {
  const existing = m113aSessionStore.get(runSeed);
  if (existing) return existing;
  const created: M113ASessionProfile = {
    sessionKey: runSeed, inferenceCount: 0, scoreEma: 0.45,
    confidenceEma: 0.5, deltaEma: 0, rewardEma: 0.5, lastTick: 0, bandit: {},
  };
  m113aSessionStore.set(runSeed, created);
  return created;
}

function updateM113ASession(session: M113ASessionProfile, features: M113AFeatureVector, score: number, tickIndex: number, rawScore: number): void {
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

function shouldLockOffM113A(userOptIn: Record<string, boolean>): boolean {
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

function extractActions(timeline: Record<string, unknown>[]): M113AActionPoint[] {
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
  const chaos = buildChaosWindows(`${runSeed}:M113A:chaos`, CHAOS_WINDOWS_PER_RUN);
  const activeChaos = chaos.some(w => tickIndex >= w.startTick && tickIndex <= w.endTick);
  const base = regime === 'CRISIS' ? 0.7 : regime === 'BEAR' ? 0.45 : regime === 'BULL' ? 0.15 : 0.3;
  return clamp(base + (activeChaos ? 0.25 : 0), 0, 1);
}

function deriveSequenceStress(actions: M113AActionPoint[], tickIndex: number, runSeed: string): number {
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
