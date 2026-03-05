// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — pzo_engine/src/ml/m02a_pressure_aware_difficulty_shaping_timer_stress_model.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_ml_mechanics.py — DO NOT EDIT MANUALLY
// Regenerate: python3 scripts/build_ml_mechanics.py --force
//
// ML Companion : M02A — Pressure-Aware Difficulty Shaping (Timer Stress Model)
// Core Pair    : M02
// Family       : balance
// Category     : controller
// IntelSignal  : personalization
// Tiers        : BASELINE, SEQUENCE_DL, POLICY_RL
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
  CHAOS_WINDOWS_PER_RUN,
  MACRO_EVENTS_PER_RUN,
  REGIME_MULTIPLIERS,
  REGIME_WEIGHTS,
  RUN_TOTAL_TICKS,
  buildChaosWindows,
  buildMacroSchedule,
  clamp,
  computeDecayRate,
  computeHash,
} from '../mechanics/mechanicsUtils';
import type { MacroEvent, MacroRegime } from '../mechanics/types';

export interface M02ATelemetryInput {
  runSeed: string;
  tickIndex: number;
  rulesetVersion: string;
  macroRegime: string;
  portfolioSnapshot: Record<string, unknown>;
  actionTimeline: Record<string, unknown>[];
  uiInteraction: Record<string, unknown>;
  socialEvents: Record<string, unknown>[];
  outcomeEvents: Record<string, unknown>[];
  ledgerEvents?: Record<string, unknown>[];
  contractGraph?: Record<string, unknown>;
  userOptIn: Record<string, boolean>;
}

export interface M02ABaseOutput {
  score: number;
  topFactors: string[];
  recommendation: string;
  auditHash: string;
}

export interface M02AOutput extends M02ABaseOutput {
  stressScore: number;
  decisionSpeedBaseline: number;
  difficultyEnvelopeDelta: number;
  lagFlag: boolean;
  confidence: number;
  confidenceDecay: number;
  lockOffApplied: boolean;
  auditReceiptId: string;
}

export type M02ATier = 'baseline' | 'sequence_dl' | 'policy_rl';

export interface M02ABaselineConfig {
  enabled: boolean;
  modelVersion: string;
  featureSchemaHash: string;
  latencySLOMs: number;
}

export interface M02ASequenceDlConfig {
  enabled: boolean;
  modelVersion: string;
  featureSchemaHash: string;
  latencySLOMs: number;
}

export interface M02APolicyRlConfig {
  enabled: boolean;
  modelVersion: string;
  featureSchemaHash: string;
  latencySLOMs: number;
}

export type M02APlacement = 'client' | 'server';

export interface M02AInferencePlacement {
  client: boolean;
  server: boolean;
  budget: 'real_time';
}

export interface M02AGuardrails {
  determinismPreserved: true;
  boundedNudges: true;
  auditabilityRequired: true;
  privacyEnforced: true;
  competitiveLockOffAllowed: true;
  scoreCap: 1.0;
  abstainThreshold: number;
}

export interface M02AEvalContract {
  momentYieldMinimum: 3;
  maxRiggedReportRate: number;
  maxFairnessDrift: number;
}

export interface M02AModelCard {
  modelId: 'M02A';
  coreMechanicPair: 'M02';
  intelligenceSignal: 'personalization';
  modelCategory: 'controller';
  family: 'balance';
  tier: M02ATier;
  modelVersion: string;
  trainCutDate: string;
  featureSchemaHash: string;
  rulesetVersion: string;
}

interface M02ASanitizedInput {
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

interface M02AActionPoint {
  timeMs: number;
  durationMs: number;
  label: string;
  decisionDepth: number;
  undoLike: boolean;
  timeoutLike: boolean;
}

interface M02AFeatureVector {
  schemaVersion: string;
  schemaHash: string;
  cadenceMedianMs: number;
  cadenceP90Ms: number;
  cadenceVolatility: number;
  actionDensity: number;
  hesitationRate: number;
  timeoutLikeRate: number;
  undoRate: number;
  uiLatencyMedianMs: number;
  uiLatencyP95Ms: number;
  uiBurstiness: number;
  portfolioComplexity: number;
  macroPressure: number;
  lateRunPressure: number;
  negativeOutcomeRate: number;
  baselineGap: number;
  lagLikelihood: number;
  decisionDepthMean: number;
  sequenceStress: number;
  historyStressEma: number;
  historyLagEma: number;
  historyDeltaEma: number;
  fairnessBand: number;
  confidenceSignal: number;
}

interface M02AContribution {
  label: string;
  value: number;
}

interface M02AModelInference {
  rawStress: number;
  confidence: number;
  contributions: M02AContribution[];
  tier: M02ATier;
}

interface M02APolicyDecision {
  delta: number;
  rewardProxy: number;
  candidateScores: Array<{ delta: number; utility: number }>;
}

interface M02ASessionProfile {
  sessionKey: string;
  inferenceCount: number;
  decisionBaselineMs: number;
  stressEma: number;
  lagEma: number;
  deltaEma: number;
  rewardEma: number;
  lastTick: number;
  bandit: Record<string, { trials: number; reward: number }>;
}

export interface M02AAuditReceipt {
  receiptId: string;
  auditHash: string;
  rulesetVersion: string;
  featureSchemaHash: string;
  modelVersion: string;
  tier: M02ATier;
  runSeed: string;
  tickIndex: number;
  caps: {
    scoreCap: number;
    minDelta: number;
    maxDelta: number;
    abstainThreshold: number;
  };
  output: Omit<M02AOutput, 'auditHash' | 'auditReceiptId'>;
  createdAt: string;
  signature: string;
}

export type M02ALedgerWriter = (receipt: M02AAuditReceipt) => void;

const M02A_SCHEMA_VERSION = 'M02A_FEATURES_V1';
const M02A_RULES_VERSION = 'M02A_RULES_V1';
const M02A_MIN_DELTA = -0.18;
const M02A_MAX_DELTA = 0.04;
const M02A_NEUTRAL_BASELINE_MS = 1400;
const M02A_MIN_ACTION_DURATION_MS = 80;
const M02A_MAX_ACTION_DURATION_MS = 20_000;
const M02A_MAX_UI_LATENCY_MS = 12_000;
const M02A_NEGATIVE_OUTCOME_KEYS = ['loss', 'penalty', 'wipe', 'miss', 'late', 'fail', 'damage', 'default'];
const M02A_LAG_KEYS = ['lag', 'latency', 'ping', 'jitter', 'dropped', 'stall', 'freeze'];
const M02A_LOCKOFF_KEYS = ['competitive_mode', 'competitive_lockoff', 'disable_balance_nudges', 'ranked_mode'];
const M02A_MODEL_VERSION_DEFAULTS: Record<M02ATier, string> = {
  baseline: 'm02a-baseline-1.0.0',
  sequence_dl: 'm02a-sequence-1.0.0',
  policy_rl: 'm02a-policy-1.0.0',
};

const M02A_TIER_CONFIG: Record<M02ATier, M02ABaselineConfig | M02ASequenceDlConfig | M02APolicyRlConfig> = {
  baseline: {
    enabled: true,
    modelVersion: M02A_MODEL_VERSION_DEFAULTS.baseline,
    featureSchemaHash: sha256Hex(M02A_SCHEMA_VERSION),
    latencySLOMs: 8,
  },
  sequence_dl: {
    enabled: true,
    modelVersion: M02A_MODEL_VERSION_DEFAULTS.sequence_dl,
    featureSchemaHash: sha256Hex(M02A_SCHEMA_VERSION),
    latencySLOMs: 14,
  },
  policy_rl: {
    enabled: true,
    modelVersion: M02A_MODEL_VERSION_DEFAULTS.policy_rl,
    featureSchemaHash: sha256Hex(M02A_SCHEMA_VERSION),
    latencySLOMs: 18,
  },
};

export const M02A_ML_CONSTANTS = {
  ML_ID: 'M02A',
  CORE_PAIR: 'M02',
  MODEL_NAME: 'Pressure-Aware Difficulty Shaping (Timer Stress Model)',
  INTEL_SIGNAL: 'personalization' as const,
  MODEL_CATEGORY: 'controller' as const,
  FAMILY: 'balance' as const,
  TIERS: ['baseline', 'sequence_dl', 'policy_rl'] as const,
  PLACEMENT: ['client', 'server'] as const,
  BUDGET: 'real_time' as const,
  CAN_LOCK_OFF: true,
  GUARDRAILS: {
    determinismPreserved: true,
    boundedNudges: true,
    auditabilityRequired: true,
    privacyEnforced: true,
    competitiveLockOffAllowed: true,
    scoreCap: 1.0,
    abstainThreshold: 0.35,
  },
  EVAL_FOCUS: ['calibration_ECE', 'fairness_drift_across_skill_bands', 'lag_false_positive_rate'],
  PRIMARY_OUTPUTS: ['stress_score', 'decision_speed_baseline', 'difficulty_envelope_delta', 'lag_flag'],
  TELEMETRY_EVENTS: [
    'M02_TICK_COMPLETE',
    'M02_PHASE_TRANSITION',
    'M02_TIMER_EXPIRED',
    'M02_CLOCK_ESCALATION',
    'M17_BAILOUT_APPLIED',
    'M132_CASE_FILE_GENERATED',
  ],
  SCHEMA_VERSION: M02A_SCHEMA_VERSION,
  SCHEMA_HASH: sha256Hex(M02A_SCHEMA_VERSION),
  RULES_VERSION: M02A_RULES_VERSION,
  MIN_DELTA: M02A_MIN_DELTA,
  MAX_DELTA: M02A_MAX_DELTA,
} as const;

const m02aSessionStore = new Map<string, M02ASessionProfile>();
const m02aLedgerReceipts: M02AAuditReceipt[] = [];
const m02aLedgerWriters = new Set<M02ALedgerWriter>();

m02aLedgerWriters.add((receipt) => {
  m02aLedgerReceipts.push(receipt);
  if (m02aLedgerReceipts.length > 5_000) {
    m02aLedgerReceipts.splice(0, m02aLedgerReceipts.length - 5_000);
  }
});

export function registerM02aLedgerWriter(writer: M02ALedgerWriter): () => void {
  m02aLedgerWriters.add(writer);
  return () => m02aLedgerWriters.delete(writer);
}

export function getM02aLedgerReceipts(runSeed?: string): M02AAuditReceipt[] {
  if (!runSeed) return [...m02aLedgerReceipts];
  return m02aLedgerReceipts.filter((receipt) => receipt.runSeed === runSeed);
}

export function exportM02aLearningState(): Record<string, M02ASessionProfile> {
  return Object.fromEntries(Array.from(m02aSessionStore.entries()).map(([key, value]) => [key, { ...value, bandit: { ...value.bandit } }]));
}

export function hydrateM02aLearningState(state: Record<string, M02ASessionProfile>): void {
  for (const [key, profile] of Object.entries(state ?? {})) {
    if (!profile || typeof profile !== 'object') continue;
    m02aSessionStore.set(key, {
      sessionKey: key,
      inferenceCount: Math.max(0, Math.floor(Number(profile.inferenceCount ?? 0))),
      decisionBaselineMs: clamp(Number(profile.decisionBaselineMs ?? M02A_NEUTRAL_BASELINE_MS), 200, 15_000),
      stressEma: clamp(Number(profile.stressEma ?? 0.5), 0, 1),
      lagEma: clamp(Number(profile.lagEma ?? 0), 0, 1),
      deltaEma: clamp(Number(profile.deltaEma ?? 0), M02A_MIN_DELTA, M02A_MAX_DELTA),
      rewardEma: clamp(Number(profile.rewardEma ?? 0.5), 0, 1),
      lastTick: Math.max(0, Math.floor(Number(profile.lastTick ?? 0))),
      bandit: normalizeBandit(profile.bandit),
    });
  }
}

export function resetM02aRuntime(): void {
  m02aSessionStore.clear();
  m02aLedgerReceipts.splice(0, m02aLedgerReceipts.length);
}

export async function runM02aMl(
  input: M02ATelemetryInput,
  tier: M02ATier = 'baseline',
  modelCard: Omit<M02AModelCard, 'modelId' | 'coreMechanicPair'>,
): Promise<M02AOutput> {
  const tierConfig = M02A_TIER_CONFIG[tier];
  const sanitized = sanitizeInput(input);
  const schemaIsValid = validateFeatureSchema(modelCard.featureSchemaHash, tierConfig.featureSchemaHash);
  const session = getOrCreateSessionProfile(sanitized.runSeed);
  const features = buildFeatureVector(sanitized, session);
  const lockOffApplied = shouldLockOffNudges(sanitized.userOptIn);

  const modelInference = schemaIsValid
    ? selectInferenceBackend(tier, features, sanitized, session)
    : {
        rawStress: 0.5,
        confidence: 0.24,
        contributions: [{ label: 'Schema mismatch — inference degraded to neutral profile', value: 0.5 }],
        tier,
      } satisfies M02AModelInference;

  const lagFlag = features.lagLikelihood >= 0.64;
  const decisionSpeedBaseline = Math.round(session.decisionBaselineMs);

  let stressScore = clamp(modelInference.rawStress, 0, M02A_ML_CONSTANTS.GUARDRAILS.scoreCap);
  let policyDecision = decideEnvelopeDelta(stressScore, modelInference.confidence, features, sanitized, session, tier);

  if (lagFlag) {
    policyDecision = {
      ...policyDecision,
      delta: Math.min(policyDecision.delta, -0.02),
      rewardProxy: clamp(policyDecision.rewardProxy + 0.08, 0, 1),
    };
  }

  if (lockOffApplied) {
    policyDecision = {
      ...policyDecision,
      delta: 0,
    };
  }

  const confidence = clamp(modelInference.confidence, 0, 1);
  const shouldAbstain = confidence < M02A_ML_CONSTANTS.GUARDRAILS.abstainThreshold;
  const finalDelta = shouldAbstain ? 0 : applyMonotonicConstraints(policyDecision.delta, stressScore, features, lagFlag);
  const score = shouldAbstain ? 0.5 : stressScore;
  const confidenceDecay = clamp(computeDecayRate(sanitized.macroRegime, 0.03) + features.lagLikelihood * 0.06, 0.02, 0.25);

  const topFactors = buildTopFactors(modelInference.contributions, features, lagFlag, lockOffApplied, shouldAbstain);
  const recommendation = buildRecommendation({
    stressScore,
    delta: finalDelta,
    lagFlag,
    lockOffApplied,
    shouldAbstain,
  });

  const baseOutput: Omit<M02AOutput, 'auditHash' | 'auditReceiptId'> = {
    score,
    topFactors,
    recommendation,
    stressScore,
    decisionSpeedBaseline,
    difficultyEnvelopeDelta: finalDelta,
    lagFlag,
    confidence,
    confidenceDecay,
    lockOffApplied,
  };

  const auditHash = sha256Hex(
    stableStringify({
      input: sanitized,
      tier,
      features,
      output: baseOutput,
      rulesetVersion: sanitized.rulesetVersion,
      caps: {
        scoreCap: M02A_ML_CONSTANTS.GUARDRAILS.scoreCap,
        minDelta: M02A_MIN_DELTA,
        maxDelta: M02A_MAX_DELTA,
        abstainThreshold: M02A_ML_CONSTANTS.GUARDRAILS.abstainThreshold,
      },
      modelCard: {
        ...modelCard,
        modelId: 'M02A',
        coreMechanicPair: 'M02',
      },
    }),
  );

  const receipt = buildReceipt({
    auditHash,
    output: baseOutput,
    sanitized,
    tier,
    modelVersion: modelCard.modelVersion,
    featureSchemaHash: modelCard.featureSchemaHash,
  });
  writeAuditReceipt(receipt);

  updateSessionProfile(session, features, stressScore, lagFlag, finalDelta, policyDecision.rewardProxy, sanitized.tickIndex);

  return {
    ...baseOutput,
    auditHash,
    auditReceiptId: receipt.receiptId,
  };
}

export function runM02aMlFallback(input: M02ATelemetryInput): M02AOutput {
  const sanitized = sanitizeInput(input);
  const decisionSpeedBaseline = deriveFallbackBaseline(sanitized.actionTimeline);
  const lagFlag = deriveFallbackLagFlag(sanitized.uiInteraction, sanitized.actionTimeline);
  const auditHash = sha256Hex(stableStringify({ runSeed: sanitized.runSeed, tickIndex: sanitized.tickIndex, mode: 'fallback' }));

  const output: Omit<M02AOutput, 'auditHash' | 'auditReceiptId'> = {
    score: 0.5,
    topFactors: ['ML unavailable — rule-based fallback active'],
    recommendation: 'See rule engine output',
    stressScore: 0.5,
    decisionSpeedBaseline,
    difficultyEnvelopeDelta: 0,
    lagFlag,
    confidence: 0.2,
    confidenceDecay: 0.1,
    lockOffApplied: shouldLockOffNudges(sanitized.userOptIn),
  };

  const receipt = buildReceipt({
    auditHash,
    output,
    sanitized,
    tier: 'baseline',
    modelVersion: 'fallback',
    featureSchemaHash: M02A_ML_CONSTANTS.SCHEMA_HASH,
  });
  writeAuditReceipt(receipt);

  return {
    ...output,
    auditHash,
    auditReceiptId: receipt.receiptId,
  };
}

function sanitizeInput(input: M02ATelemetryInput): M02ASanitizedInput {
  const normalizedRegime = normalizeMacroRegime(input.macroRegime);
  return {
    runSeed: String(input.runSeed ?? ''),
    tickIndex: clamp(Math.floor(Number(input.tickIndex ?? 0)), 0, RUN_TOTAL_TICKS - 1),
    rulesetVersion: String(input.rulesetVersion ?? M02A_RULES_VERSION),
    macroRegime: normalizedRegime,
    portfolioSnapshot: sanitizeObject(input.portfolioSnapshot),
    actionTimeline: sanitizeArrayOfObjects(input.actionTimeline),
    uiInteraction: sanitizeObject(input.uiInteraction),
    socialEvents: sanitizeArrayOfObjects(input.socialEvents),
    outcomeEvents: sanitizeArrayOfObjects(input.outcomeEvents),
    ledgerEvents: sanitizeArrayOfObjects(input.ledgerEvents ?? []),
    userOptIn: sanitizeBooleanMap(input.userOptIn),
  };
}

function sanitizeObject(input: Record<string, unknown> | undefined | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = String(rawKey);
    if (isDisallowedPrivacyKey(key)) continue;
    out[key] = sanitizeUnknown(rawValue);
  }
  return out;
}

function sanitizeArrayOfObjects(input: Record<string, unknown>[] | undefined | null): Record<string, unknown>[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => sanitizeObject(item)).slice(0, 5_000);
}

function sanitizeBooleanMap(input: Record<string, boolean> | undefined | null): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, value] of Object.entries(input)) out[String(key)] = Boolean(value);
  return out;
}

function sanitizeUnknown(value: unknown): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeUnknown(item)).slice(0, 250);
  if (typeof value === 'object') return sanitizeObject(value as Record<string, unknown>);
  return null;
}

function isDisallowedPrivacyKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes('email') ||
    lower.includes('phone') ||
    lower.includes('address') ||
    lower.includes('contact') ||
    lower.includes('ip') ||
    lower.includes('geo') ||
    lower.includes('lat') ||
    lower.includes('lng') ||
    lower.includes('longitude') ||
    lower.includes('latitude')
  );
}

function validateFeatureSchema(requestedHash: string, expectedHash: string): boolean {
  return String(requestedHash ?? '') === String(expectedHash ?? '');
}

function shouldLockOffNudges(userOptIn: Record<string, boolean>): boolean {
  for (const [key, value] of Object.entries(userOptIn)) {
    const normalized = key.toLowerCase();
    if (!value) continue;
    if (M02A_LOCKOFF_KEYS.includes(normalized)) return true;
  }
  return false;
}

function buildFeatureVector(input: M02ASanitizedInput, session: M02ASessionProfile): M02AFeatureVector {
  const actions = extractActionPoints(input.actionTimeline);
  const actionDurations = actions.map((action) => action.durationMs);
  const actionTimes = actions.map((action) => action.timeMs).sort((a, b) => a - b);
  const intervals = deriveIntervals(actionTimes);
  const uiLatency = extractUiLatencySamples(input.uiInteraction, input.actionTimeline);
  const portfolioComplexity = derivePortfolioComplexity(input.portfolioSnapshot);
  const macroPressure = deriveMacroPressure(input.macroRegime, input.tickIndex, input.runSeed);
  const lateRunPressure = clamp(input.tickIndex / Math.max(1, RUN_TOTAL_TICKS - 1), 0, 1);
  const negativeOutcomeRate = deriveNegativeOutcomeRate(input.outcomeEvents, input.ledgerEvents);
  const uiBurstiness = deriveBurstiness(uiLatency);
  const lagLikelihood = deriveLagLikelihood(uiLatency, actionDurations, input.uiInteraction, input.outcomeEvents);
  const decisionDepthMean = mean(actions.map((action) => action.decisionDepth));
  const sequenceStress = deriveSequenceStress(actions, input.tickIndex, input.runSeed);

  const cadenceMedianMs = safeRound(median(actionDurations), 3, M02A_NEUTRAL_BASELINE_MS);
  const cadenceP90Ms = safeRound(percentile(actionDurations, 0.9), 3, cadenceMedianMs);
  const cadenceVolatility = safeRound(coefficientOfVariation(intervals.length > 0 ? intervals : actionDurations), 4, 0);
  const actionDensity = safeRound(actions.length / Math.max(1, input.tickIndex + 1), 4, 0);
  const hesitationRate = safeRound(actions.filter((action) => action.durationMs >= session.decisionBaselineMs * 1.35).length / Math.max(1, actions.length), 4, 0);
  const timeoutLikeRate = safeRound(actions.filter((action) => action.timeoutLike).length / Math.max(1, actions.length), 4, 0);
  const undoRate = safeRound(actions.filter((action) => action.undoLike).length / Math.max(1, actions.length), 4, 0);
  const uiLatencyMedianMs = safeRound(median(uiLatency), 3, 0);
  const uiLatencyP95Ms = safeRound(percentile(uiLatency, 0.95), 3, uiLatencyMedianMs);
  const baselineGap = safeRound((cadenceMedianMs - session.decisionBaselineMs) / Math.max(250, session.decisionBaselineMs), 4, 0);
  const fairnessBand = safeRound(clamp(portfolioComplexity * 0.55 + actionDensity * 0.45, 0, 1), 4, 0.5);
  const confidenceSignal = safeRound(
    clamp(
      0.25 + clamp(actions.length / 12, 0, 0.3) + clamp(uiLatency.length / 12, 0, 0.15) + clamp(1 - Math.abs(baselineGap), 0, 0.2) + clamp(1 - lagLikelihood, 0, 0.1),
      0,
      1,
    ),
    4,
    0.25,
  );

  return {
    schemaVersion: M02A_SCHEMA_VERSION,
    schemaHash: M02A_ML_CONSTANTS.SCHEMA_HASH,
    cadenceMedianMs,
    cadenceP90Ms,
    cadenceVolatility,
    actionDensity,
    hesitationRate,
    timeoutLikeRate,
    undoRate,
    uiLatencyMedianMs,
    uiLatencyP95Ms,
    uiBurstiness,
    portfolioComplexity,
    macroPressure,
    lateRunPressure,
    negativeOutcomeRate,
    baselineGap,
    lagLikelihood,
    decisionDepthMean,
    sequenceStress,
    historyStressEma: session.stressEma,
    historyLagEma: session.lagEma,
    historyDeltaEma: session.deltaEma,
    fairnessBand,
    confidenceSignal,
  };
}

function extractActionPoints(timeline: Record<string, unknown>[]): M02AActionPoint[] {
  return timeline
    .map((event, index) => {
      const eventText = stableStringify(event).toLowerCase();
      const explicitDuration = coerceFirstNumber(event, ['decisionMs', 'responseMs', 'durationMs', 'latencyMs', 'elapsedMs']);
      const durationMs = clamp(explicitDuration ?? inferDurationFromEvent(eventText), M02A_MIN_ACTION_DURATION_MS, M02A_MAX_ACTION_DURATION_MS);
      const timeMs = Math.max(0, coerceFirstNumber(event, ['atMs', 'timeMs', 'timestampMs', 'ts', 't']) ?? index * 1000 + durationMs);
      const decisionDepth = clamp(coerceFirstNumber(event, ['decisionDepth', 'branchCount', 'options', 'menuDepth']) ?? inferDecisionDepth(eventText), 1, 8);
      const label = String(coerceFirstString(event, ['type', 'event', 'action', 'name']) ?? `action_${index}`);
      const undoLike = /(undo|back|cancel|reverse|rewind|rescind)/i.test(eventText);
      const timeoutLike = /(timeout|timer_expired|expired|late|too_slow|stall)/i.test(eventText) || durationMs >= 4_500;
      return { timeMs, durationMs, label, decisionDepth, undoLike, timeoutLike };
    })
    .sort((a, b) => a.timeMs - b.timeMs);
}

function extractUiLatencySamples(uiInteraction: Record<string, unknown>, timeline: Record<string, unknown>[]): number[] {
  const samples: number[] = [];
  const flattenedUi = stableStringify(uiInteraction).toLowerCase();
  samples.push(...collectNumbers(uiInteraction, ['latencyMs', 'frameTimeMs', 'inputLatencyMs', 'renderDelayMs', 'jitterMs', 'pingMs']));
  for (const event of timeline) samples.push(...collectNumbers(event, ['latencyMs', 'frameTimeMs', 'inputLatencyMs', 'renderDelayMs', 'jitterMs', 'pingMs']));
  if (samples.length === 0 && /(lag|latency|stutter|freeze|jitter)/i.test(flattenedUi)) samples.push(450, 700, 850);
  return samples.map((value) => clamp(value, 0, M02A_MAX_UI_LATENCY_MS));
}

function derivePortfolioComplexity(snapshot: Record<string, unknown>): number {
  const assets = coerceCount(snapshot, ['assets', 'holdings', 'positions']);
  const debts = coerceCount(snapshot, ['debts', 'liabilities']);
  const shields = coerceCount(snapshot, ['shields']);
  const modifiers = coerceCount(snapshot, ['mods', 'modifiers', 'buffs']);
  const branches = coerceFirstNumber(snapshot, ['branchingOptions', 'openDecisions', 'pendingChoices']) ?? 0;
  return clamp((assets * 0.18 + debts * 0.15 + shields * 0.05 + modifiers * 0.08 + branches * 0.2) / 6, 0, 1);
}

function deriveMacroPressure(regime: MacroRegime, tickIndex: number, runSeed: string): number {
  const schedule = buildMacroSchedule(`${runSeed}:M02A:macro`, MACRO_EVENTS_PER_RUN);
  const chaos = buildChaosWindows(`${runSeed}:M02A:chaos`, CHAOS_WINDOWS_PER_RUN);
  const activeChaos = chaos.some((window) => tickIndex >= window.startTick && tickIndex <= window.endTick);
  const scheduleMultiplier = deriveRegimeFromSchedule(schedule, tickIndex, regime);
  const base = clamp(1 - (REGIME_WEIGHTS[scheduleMultiplier] ?? 1), 0, 0.5) + clamp(1 - (REGIME_MULTIPLIERS[scheduleMultiplier] ?? 1), 0, 0.5);
  return clamp(base + (activeChaos ? 0.25 : 0), 0, 1);
}

function deriveNegativeOutcomeRate(outcomes: Record<string, unknown>[], ledger: Record<string, unknown>[]): number {
  const all = [...outcomes, ...ledger];
  if (all.length === 0) return 0;
  let negative = 0;
  for (const event of all) {
    const text = stableStringify(event).toLowerCase();
    if (M02A_NEGATIVE_OUTCOME_KEYS.some((key) => text.includes(key))) negative += 1;
  }
  return clamp(negative / all.length, 0, 1);
}

function deriveLagLikelihood(uiLatency: number[], actionDurations: number[], uiInteraction: Record<string, unknown>, outcomes: Record<string, unknown>[]): number {
  const latencyMedian = median(uiLatency);
  const latencyP95 = percentile(uiLatency, 0.95);
  const actionMedian = median(actionDurations);
  const actionP95 = percentile(actionDurations, 0.95);
  const uiText = stableStringify(uiInteraction).toLowerCase();
  const outcomeText = stableStringify(outcomes).toLowerCase();
  const keySignal = M02A_LAG_KEYS.some((key) => uiText.includes(key) || outcomeText.includes(key)) ? 0.18 : 0;
  const raw =
    clamp((latencyMedian - 180) / 900, 0, 0.35) +
    clamp((latencyP95 - 350) / 1200, 0, 0.25) +
    clamp((actionP95 - Math.max(1_300, actionMedian * 1.6)) / 4_000, 0, 0.22) +
    keySignal;
  return clamp(raw, 0, 1);
}

function deriveSequenceStress(actions: M02AActionPoint[], tickIndex: number, runSeed: string): number {
  if (actions.length === 0) return clamp(tickIndex / RUN_TOTAL_TICKS, 0, 1) * 0.25;
  const seedBias = (parseInt(computeHash(`${runSeed}:${tickIndex}:seq`), 16) % 11) / 100;
  let sum = 0;
  let weightTotal = 0;
  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    const recency = (i + 1) / actions.length;
    const weight = 0.2 + recency * 0.8;
    const localStress = clamp((action.durationMs - 900) / 3_800, 0, 1) * 0.55 + clamp((action.decisionDepth - 2) / 5, 0, 1) * 0.20 + (action.undoLike ? 0.08 : 0) + (action.timeoutLike ? 0.17 : 0);
    sum += localStress * weight;
    weightTotal += weight;
  }
  return clamp(sum / Math.max(weightTotal, 0.0001) + seedBias, 0, 1);
}

function selectInferenceBackend(tier: M02ATier, features: M02AFeatureVector, input: M02ASanitizedInput, session: M02ASessionProfile): M02AModelInference {
  switch (tier) {
    case 'sequence_dl':
      return runSequenceInference(features, input, session);
    case 'policy_rl':
      return runPolicyAwareInference(features, input, session);
    case 'baseline':
    default:
      return runBaselineInference(features, input, session);
  }
}

function runBaselineInference(features: M02AFeatureVector, _input: M02ASanitizedInput, session: M02ASessionProfile): M02AModelInference {
  const contributions: M02AContribution[] = [
    { label: 'Timer stress ramp', value: features.lateRunPressure * 0.18 },
    { label: 'Decision baseline drift', value: clamp(features.baselineGap, -1, 1) * 0.17 },
    { label: 'UI latency load', value: features.lagLikelihood * 0.16 },
    { label: 'Negative outcome pressure', value: features.negativeOutcomeRate * 0.12 },
    { label: 'Portfolio complexity', value: features.portfolioComplexity * 0.09 },
    { label: 'Hesitation rate', value: features.hesitationRate * 0.11 },
    { label: 'Sequence stress', value: features.sequenceStress * 0.12 },
    { label: 'Session stress memory', value: features.historyStressEma * 0.08 },
  ];

  const logit =
    -0.55 +
    contributions.reduce((sum, item) => sum + item.value, 0) +
    features.timeoutLikeRate * 0.16 +
    features.undoRate * 0.08 -
    clamp(session.rewardEma - 0.5, -0.25, 0.25) * 0.10;

  return {
    rawStress: sigmoid(logit),
    confidence: clamp(features.confidenceSignal * 0.82 + (1 - features.cadenceVolatility) * 0.18, 0.05, 0.99),
    contributions,
    tier: 'baseline',
  };
}

function runSequenceInference(features: M02AFeatureVector, input: M02ASanitizedInput, session: M02ASessionProfile): M02AModelInference {
  const baseline = runBaselineInference(features, input, session);
  const sequenceBias = features.sequenceStress * 0.22 + clamp(features.cadenceVolatility - 0.20, 0, 1) * 0.10 + clamp(features.uiBurstiness - 0.25, 0, 1) * 0.08 - features.historyDeltaEma * 0.04;
  return {
    rawStress: clamp(baseline.rawStress * 0.72 + sequenceBias, 0, 1),
    confidence: clamp(baseline.confidence * 0.84 + clamp(input.actionTimeline.length / 20, 0, 0.15), 0.05, 0.99),
    contributions: [...baseline.contributions, { label: 'Temporal sequence encoder', value: sequenceBias }, { label: 'Burst jitter context', value: features.uiBurstiness * 0.06 }],
    tier: 'sequence_dl',
  };
}

function runPolicyAwareInference(features: M02AFeatureVector, input: M02ASanitizedInput, session: M02ASessionProfile): M02AModelInference {
  const sequence = runSequenceInference(features, input, session);
  const policyBias = clamp(features.historyLagEma - 0.25, 0, 1) * 0.08 + clamp(features.fairnessBand - 0.40, 0, 1) * 0.06 + clamp(1 - session.rewardEma, 0, 1) * 0.04;
  return {
    rawStress: clamp(sequence.rawStress + policyBias, 0, 1),
    confidence: clamp(sequence.confidence * 0.90 + 0.05, 0.05, 0.99),
    contributions: [...sequence.contributions, { label: 'Offline policy prior', value: policyBias }],
    tier: 'policy_rl',
  };
}

function decideEnvelopeDelta(
  stressScore: number,
  confidence: number,
  features: M02AFeatureVector,
  input: M02ASanitizedInput,
  session: M02ASessionProfile,
  tier: M02ATier,
): M02APolicyDecision {
  const candidates = [0, -0.03, -0.06, -0.10, -0.14, -0.18];
  const candidateScores = candidates.map((delta) => {
    const relief = Math.abs(delta) * (0.55 + stressScore * 0.45);
    const fairnessPenalty = clamp(Math.abs(delta) * (0.20 + features.fairnessBand * 0.35), 0, 0.20);
    const lagGuard = features.lagLikelihood >= 0.64 ? Math.abs(delta) * 0.05 : 0;
    const exploration = computeBanditExploration(session, delta);
    const tierBias = tier === 'policy_rl' ? 0.05 : tier === 'sequence_dl' ? 0.02 : 0;
    const utility = confidence * 0.35 + relief + exploration + tierBias - fairnessPenalty - lagGuard;
    return { delta, utility: clamp(utility, -1, 1) };
  });

  candidateScores.sort((a, b) => b.utility - a.utility);
  const best = candidateScores[0] ?? { delta: 0, utility: 0 };
  const maxAllowed = deriveMaxAllowedRelief(features, input);
  return {
    delta: clamp(best.delta, maxAllowed, 0),
    rewardProxy: clamp(stressScore * 0.55 + Math.abs(best.delta) * 0.45 - features.fairnessBand * 0.10, 0, 1),
    candidateScores,
  };
}

function applyMonotonicConstraints(delta: number, stressScore: number, features: M02AFeatureVector, lagFlag: boolean): number {
  let bounded = clamp(delta, M02A_MIN_DELTA, M02A_MAX_DELTA);
  if (stressScore < 0.42) bounded = Math.max(bounded, -0.03);
  if (stressScore >= 0.42 && stressScore < 0.65) bounded = Math.max(bounded, -0.10);
  if (features.fairnessBand > 0.85) bounded = Math.max(bounded, -0.08);
  if (lagFlag) bounded = Math.min(bounded, -0.02);
  return clamp(bounded, M02A_MIN_DELTA, M02A_MAX_DELTA);
}

function deriveMaxAllowedRelief(features: M02AFeatureVector, input: M02ASanitizedInput): number {
  const rankedClamp = shouldLockOffNudges(input.userOptIn) ? 0 : M02A_MIN_DELTA;
  const fairnessClamp = features.fairnessBand > 0.8 ? -0.08 : M02A_MIN_DELTA;
  const lowDataClamp = features.confidenceSignal < 0.4 ? -0.06 : M02A_MIN_DELTA;
  return Math.max(rankedClamp, fairnessClamp, lowDataClamp);
}

function computeBanditExploration(session: M02ASessionProfile, delta: number): number {
  const key = String(delta.toFixed(2));
  const bandit = session.bandit[key] ?? { trials: 0, reward: 0.5 };
  const exploration = 0.08 / Math.max(1, bandit.trials + 1);
  const exploitation = clamp((bandit.reward - 0.5) * 0.10, -0.05, 0.08);
  return exploration + exploitation;
}

function buildTopFactors(contributions: M02AContribution[], features: M02AFeatureVector, lagFlag: boolean, lockOffApplied: boolean, shouldAbstain: boolean): string[] {
  const ranked = [...contributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3);
  const factors = ranked.map((item) => `${item.label}: ${item.value >= 0 ? '+' : ''}${item.value.toFixed(3)}`);
  if (lagFlag) factors.push(`Lag likelihood: ${(features.lagLikelihood * 100).toFixed(1)}%`);
  if (lockOffApplied) factors.push('Competitive lock-off active — advisory only');
  if (shouldAbstain) factors.push('Confidence below abstain threshold — neutralized delta');
  return factors.slice(0, 5);
}

function buildRecommendation(args: { stressScore: number; delta: number; lagFlag: boolean; lockOffApplied: boolean; shouldAbstain: boolean }): string {
  if (args.lockOffApplied) return 'Competitive lock-off is active; record stress only and leave the difficulty envelope unchanged.';
  if (args.shouldAbstain) return 'Confidence is below the intervention threshold; keep the envelope neutral and wait for more telemetry.';
  if (args.lagFlag) return 'External lag is likely inflating perceived stress; soften only the timer envelope and avoid any outcome-facing nudge.';
  if (args.stressScore >= 0.78) return `Stress is in the unfair zone; apply a bounded difficulty envelope relief of ${args.delta.toFixed(2)} and preserve outcome determinism.`;
  if (args.stressScore >= 0.58) return `Stress is elevated; apply a light relief of ${args.delta.toFixed(2)} while preserving schedule integrity.`;
  return 'Stress is controlled; maintain the current envelope and continue learning the player baseline.';
}

function buildReceipt(args: {
  auditHash: string;
  output: Omit<M02AOutput, 'auditHash' | 'auditReceiptId'>;
  sanitized: M02ASanitizedInput;
  tier: M02ATier;
  modelVersion: string;
  featureSchemaHash: string;
}): M02AAuditReceipt {
  const receiptId = computeHash(`${args.sanitized.runSeed}:${args.sanitized.tickIndex}:${args.auditHash}:M02A`);
  const createdAt = new Date(0).toISOString();
  const receipt: M02AAuditReceipt = {
    receiptId,
    auditHash: args.auditHash,
    rulesetVersion: args.sanitized.rulesetVersion,
    featureSchemaHash: args.featureSchemaHash,
    modelVersion: args.modelVersion,
    tier: args.tier,
    runSeed: args.sanitized.runSeed,
    tickIndex: args.sanitized.tickIndex,
    caps: {
      scoreCap: M02A_ML_CONSTANTS.GUARDRAILS.scoreCap,
      minDelta: M02A_MIN_DELTA,
      maxDelta: M02A_MAX_DELTA,
      abstainThreshold: M02A_ML_CONSTANTS.GUARDRAILS.abstainThreshold,
    },
    output: args.output,
    createdAt,
    signature: '',
  };
  receipt.signature = sha256Hex(stableStringify({ ...receipt, signature: undefined, salt: 'M02A_RECEIPT_SIGNATURE' }));
  return receipt;
}

function writeAuditReceipt(receipt: M02AAuditReceipt): void {
  for (const writer of m02aLedgerWriters) writer(receipt);
}

function getOrCreateSessionProfile(runSeed: string): M02ASessionProfile {
  const existing = m02aSessionStore.get(runSeed);
  if (existing) return existing;
  const created: M02ASessionProfile = {
    sessionKey: runSeed,
    inferenceCount: 0,
    decisionBaselineMs: M02A_NEUTRAL_BASELINE_MS,
    stressEma: 0.45,
    lagEma: 0,
    deltaEma: 0,
    rewardEma: 0.5,
    lastTick: 0,
    bandit: {},
  };
  m02aSessionStore.set(runSeed, created);
  return created;
}

function updateSessionProfile(session: M02ASessionProfile, features: M02AFeatureVector, stressScore: number, lagFlag: boolean, delta: number, rewardProxy: number, tickIndex: number): void {
  session.inferenceCount += 1;
  session.lastTick = tickIndex;
  session.decisionBaselineMs = ema(session.decisionBaselineMs, features.cadenceMedianMs || session.decisionBaselineMs, 0.18);
  session.stressEma = ema(session.stressEma, stressScore, 0.22);
  session.lagEma = ema(session.lagEma, lagFlag ? 1 : features.lagLikelihood, 0.20);
  session.deltaEma = ema(session.deltaEma, delta, 0.18);
  session.rewardEma = ema(session.rewardEma, rewardProxy, 0.16);
  const key = delta.toFixed(2);
  const bandit = session.bandit[key] ?? { trials: 0, reward: 0.5 };
  bandit.trials += 1;
  bandit.reward = ema(bandit.reward, rewardProxy, 0.22);
  session.bandit[key] = bandit;
}

function deriveFallbackBaseline(actionTimeline: Record<string, unknown>[]): number {
  return Math.round(median(extractActionPoints(actionTimeline).map((action) => action.durationMs)) || M02A_NEUTRAL_BASELINE_MS);
}

function deriveFallbackLagFlag(uiInteraction: Record<string, unknown>, actionTimeline: Record<string, unknown>[]): boolean {
  return percentile(extractUiLatencySamples(uiInteraction, actionTimeline), 0.95) >= 700;
}

function normalizeMacroRegime(input: string): MacroRegime {
  const upper = String(input ?? 'NEUTRAL').trim().toUpperCase();
  if (upper === 'BULL' || upper === 'NEUTRAL' || upper === 'BEAR' || upper === 'CRISIS') return upper;
  return 'NEUTRAL';
}

function deriveRegimeFromSchedule(schedule: MacroEvent[], tickIndex: number, fallback: MacroRegime): MacroRegime {
  let regime = fallback;
  for (const event of [...schedule].sort((a, b) => a.tick - b.tick)) {
    if (event.tick > tickIndex) break;
    if (event.regimeChange) regime = event.regimeChange;
  }
  return regime;
}

function collectNumbers(source: Record<string, unknown>, keys: string[]): number[] {
  const out: number[] = [];
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) out.push(value);
    if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'number' && Number.isFinite(item)) out.push(item);
    }
  }
  return out;
}

function coerceFirstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function coerceFirstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function coerceCount(source: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
    if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length;
  }
  return 0;
}

function inferDurationFromEvent(text: string): number {
  if (/auction|bid|confirm/.test(text)) return 1800;
  if (/menu|inspect|hover/.test(text)) return 850;
  if (/sell|buy|play|move|draw/.test(text)) return 1200;
  if (/timeout|late|stall/.test(text)) return 5200;
  return 1000;
}

function inferDecisionDepth(text: string): number {
  if (/auction|hedge|optimize|branch|refi|liquidity/.test(text)) return 4;
  if (/menu|inspect|preview|compare/.test(text)) return 3;
  if (/sell|buy|play|draw|move/.test(text)) return 2;
  return 1;
}

function deriveIntervals(values: number[]): number[] {
  if (values.length <= 1) return [];
  const out: number[] = [];
  for (let i = 1; i < values.length; i += 1) out.push(Math.max(0, values[i] - values[i - 1]));
  return out;
}

function deriveBurstiness(values: number[]): number {
  if (values.length === 0) return 0;
  return clamp(coefficientOfVariation(values), 0, 1);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(Math.ceil(sorted.length * p) - 1, 0, sorted.length - 1);
  return sorted[idx];
}

function coefficientOfVariation(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  if (avg === 0) return 0;
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance) / avg;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function ema(current: number, next: number, alpha: number): number {
  return current * (1 - alpha) + next * alpha;
}

function safeRound(value: number, digits: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const pow = 10 ** digits;
  return Math.round(value * pow) / pow;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortJson(item));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = sortJson((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeBandit(input: Record<string, { trials: number; reward: number }> | undefined): Record<string, { trials: number; reward: number }> {
  const out: Record<string, { trials: number; reward: number }> = {};
  if (!input) return out;
  for (const [key, value] of Object.entries(input)) {
    out[key] = {
      trials: Math.max(0, Math.floor(Number(value?.trials ?? 0))),
      reward: clamp(Number(value?.reward ?? 0.5), 0, 1),
    };
  }
  return out;
}
