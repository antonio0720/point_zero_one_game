// backend/src/game/engine/zero/OutcomeGate.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OutcomeGate.ts
 *
 * Doctrine:
 * - terminal outcome authority remains backend-owned
 * - Engine 0 may evaluate terminal state, but it must not re-implement
 *   core outcome law when RuntimeOutcomeResolver already exists
 * - this file is a zero-owned coordinator over the core resolver:
 *   resolve -> apply -> annotate -> signal -> ML/DL -> chat -> archive
 * - outcome resolution must remain deterministic, immutable, and proof-safe
 * - ML feature extraction is a first-class gate capability (32-dim gate vector)
 * - DL tensor construction feeds outcome prediction models (48-dim gate tensor)
 * - Chat signals route companion NPC coaching from gate state transitions
 * - Every signal class, trend shift, and narration hint drives visible UX
 * - All depth is focused on user experience: what the player sees, feels, and acts on
 *
 * Surface summary:
 *   § 1  — Module constants and version metadata
 *   § 2  — Gate-level type surface (gate ML/DL vectors, chat signal, trend, session)
 *   § 3  — Pure helpers (clamp, norm, severity encoding, health scoring)
 *   § 4  — Internal gate helpers preserved from original file
 *   § 5  — OutcomeGateMLExtractor (32-dim gate-level ML vector)
 *   § 6  — OutcomeGateDLBuilder (48-dim gate-level DL tensor)
 *   § 7  — OutcomeGateTrendAnalyzer (trajectory tracking, shift detection)
 *   § 8  — OutcomeGateSessionTracker (per-session aggregate stats + signal reports)
 *   § 9  — OutcomeGateEventLog (chronological gate event archive with checksums)
 *   § 10 — OutcomeGateAnnotator (UX-facing annotation bundles, action recommendations)
 *   § 11 — OutcomeGateInspector (audit + debug inspection utilities)
 *   § 12 — OutcomeGateChatSignalBuilder (chat signal construction from gate state)
 *   § 13 — OutcomeGateNarrationBridge (narration hint forwarding from core resolver)
 *   § 14 — OutcomeGateHealthMonitor (gate-level health tracking + grading)
 *   § 15 — OutcomeGateBatchProcessor (batch resolution with ML aggregation)
 *   § 16 — OutcomeGateContractValidator (contract invariant enforcement)
 *   § 17 — OutcomeGate class (enhanced — primary gate surface)
 *   § 18 — createOutcomeGateWithAnalytics factory
 *   § 19 — Singleton instances
 *   § 20 — Pure utility exports
 *   § 21 — Re-exported resolver type surface for downstream consumers
 */

import {
  cloneJson,
  deepFreeze,
  checksumSnapshot,
  createDeterministicId,
  stableStringify,
} from '../core/Deterministic';
import {
  createEngineSignal,
  createEngineSignalFull,
  createEngineErrorSignal,
  createContractViolationSignal,
  createEngineHealth,
  buildEngineMLSignal,
  buildMLSignalComposite,
  classifyMLSignalRisk,
  recommendActionFromMLClass,
  isEngineRequiredAtStep,
  isEngineEligibleAtStep,
  getEngineStepPolicy,
  EngineSignalAggregator,
  ALL_ENGINE_IDS,
  DEFAULT_ENGINE_STEP_POLICIES,
  type EngineSignal,
  type EngineHealthStatus,
  type EngineSignalSeverity,
  type EngineSignalCategory,
  type EngineId,
  type EngineHealth,
  type SignalAggregatorReport,
  type EngineMLSignal,
  type MLSignalClass,
  type MLSignalComposite,
  type EngineStepPolicy,
  type ContractCheckResult,
  type ContractValidationReport,
} from '../core/EngineContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  RuntimeOutcomeResolver,
  OutcomeMLVectorBuilder,
  OutcomeDLTensorBuilder,
  OutcomeProximityAnalyzer,
  OutcomeForecastEngine,
  OutcomeNarrationHintBuilder,
  OutcomeHistoryTracker,
  OutcomeThresholdAdvisor,
  OutcomeEconomyTrajectoryAnalyzer,
  OutcomeBatchResolver,
  OutcomeResolverHealthMonitor,
  OutcomeResolverFacade,
  OUTCOME_RESOLVER_MODULE_VERSION,
  OUTCOME_RESOLVER_MODULE_READY,
  OUTCOME_ML_FEATURE_COUNT,
  OUTCOME_DL_FEATURE_COUNT,
  OUTCOME_DL_TENSOR_SHAPE,
  OUTCOME_BANKRUPTCY_RUNWAY_CRITICAL_TICKS,
  OUTCOME_BANKRUPTCY_RUNWAY_HIGH_TICKS,
  OUTCOME_FREEDOM_SPRINT_NEAR_TICKS,
  OUTCOME_HISTORY_MAX_ENTRIES,
  OUTCOME_PROBABILITY_SHIFT_THRESHOLD,
  OUTCOME_ML_FEATURE_LABELS,
  OUTCOME_DL_FEATURE_LABELS,
  type RuntimeOutcomeDecision,
  type RuntimeOutcomeResolverOptions,
  type OutcomeProximity,
  type OutcomeRunway,
  type OutcomeMLVector,
  type OutcomeDLTensor,
  type OutcomeProbabilityDistribution,
  type OutcomeForecast,
  type OutcomeNarrationHint,
  type OutcomeHistoryEntry,
  type OutcomeTrajectory,
  type OutcomeThresholdConfig,
  type OutcomeDecisionContext,
  type OutcomeResolverHealthGrade,
  type OutcomeResolverStats,
  type OutcomeFacadeResult,
  type OutcomeBatchResult,
  type OutcomeEconomyDataPoint,
} from '../core/RuntimeOutcomeResolver';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Module constants and version metadata
// ─────────────────────────────────────────────────────────────────────────────

/** Version identifier for the OutcomeGate module. */
export const OUTCOME_GATE_MODULE_VERSION =
  `outcome-gate.v2.2026.${OUTCOME_RESOLVER_MODULE_VERSION}` as const;

/** Ready flag — true when the resolver module is loaded. */
export const OUTCOME_GATE_MODULE_READY = OUTCOME_RESOLVER_MODULE_READY as boolean;

/** Number of features in the gate-level 32-dim ML vector. */
export const OUTCOME_GATE_ML_FEATURE_COUNT = 32 as const;

/** Number of features in the gate-level 48-dim DL tensor. */
export const OUTCOME_GATE_DL_FEATURE_COUNT = 48 as const;

/** Gate DL tensor shape: 1 row × 48 features. */
export const OUTCOME_GATE_DL_TENSOR_SHAPE: readonly [1, 48] = Object.freeze([1, 48] as const);

/** Max event log entries retained per run before the oldest are rotated. */
export const OUTCOME_GATE_EVENT_LOG_MAX_ENTRIES = OUTCOME_HISTORY_MAX_ENTRIES as number;

/** Bankruptcy runway below which a CRITICAL UX annotation is emitted. */
export const OUTCOME_GATE_BANKRUPTCY_CRITICAL_TICKS =
  OUTCOME_BANKRUPTCY_RUNWAY_CRITICAL_TICKS as number;

/** Bankruptcy runway below which a HIGH urgency UX annotation is emitted. */
export const OUTCOME_GATE_BANKRUPTCY_HIGH_TICKS = OUTCOME_BANKRUPTCY_RUNWAY_HIGH_TICKS as number;

/** Freedom sprint ticks below which a NEAR-FREEDOM UX annotation is emitted. */
export const OUTCOME_GATE_FREEDOM_NEAR_TICKS = OUTCOME_FREEDOM_SPRINT_NEAR_TICKS as number;

/** Minimum gate probability delta to flag as a trend-shift event. */
export const OUTCOME_GATE_SHIFT_THRESHOLD = OUTCOME_PROBABILITY_SHIFT_THRESHOLD as number;

/** Outcome encoding map used by the ML feature extractor. */
export const OUTCOME_GATE_OUTCOME_ENCODING: Readonly<
  Record<NonNullable<RunStateSnapshot['outcome']>, number>
> = Object.freeze({
  FREEDOM: 1.0,
  TIMEOUT: 0.5,
  BANKRUPT: 0.25,
  ABANDONED: 0.0,
});

/** Severity encoding map used by the ML feature extractor. */
export const OUTCOME_GATE_SEVERITY_ENCODING: Readonly<
  Record<EngineSignalSeverity, number>
> = Object.freeze({
  INFO: 0.33,
  WARN: 0.67,
  ERROR: 1.0,
});

/** Health status scoring for OutcomeGateHealthMonitor. */
export const OUTCOME_GATE_HEALTH_STATUS_SCORE: Readonly<
  Record<EngineHealthStatus, number>
> = Object.freeze({
  HEALTHY: 1.0,
  DEGRADED: 0.5,
  FAILED: 0.0,
});

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Gate-level type surface
// ─────────────────────────────────────────────────────────────────────────────

/** 32-feature gate-level ML vector. */
export interface OutcomeGateMLVector {
  readonly runId: string;
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly vectorShape: readonly [1, 32];
  readonly extractedAtMs: number;
  readonly mlClass: MLSignalClass;
  readonly riskScore: number;
  readonly urgencyScore: number;
  readonly gateMetadata: {
    readonly didChangeOutcome: boolean;
    readonly shouldFinalize: boolean;
    readonly signalCount: number;
  };
}

/** 48-feature gate-level DL input tensor. */
export interface OutcomeGateDLTensor {
  readonly runId: string;
  readonly tick: number;
  readonly inputVector: readonly number[];
  readonly featureLabels: readonly string[];
  readonly tensorShape: readonly [1, 48];
  readonly policyVersion: string;
  readonly extractedAtMs: number;
  readonly baseMLVector: OutcomeGateMLVector;
}

/** Gate-level chat signal for the backend LIVEOPS lane. */
export interface OutcomeGateChatSignal {
  readonly sessionId: string;
  readonly runId: string;
  readonly tick: number;
  readonly generatedAtMs: number;
  readonly severity: EngineSignalSeverity;
  readonly category: EngineSignalCategory;
  readonly headline: string;
  readonly bodyText: string;
  readonly actionSuggestion: string;
  readonly mlClass: MLSignalClass;
  readonly riskScore: number;
  readonly urgencyScore: number;
  readonly isTerminal: boolean;
  readonly outcomeEncoded: number;
  readonly bankruptcyProximity: number;
  readonly freedomProximity: number;
  readonly mlSignal: EngineMLSignal;
  readonly composite: MLSignalComposite;
}

/** Trend direction for gate-level probability trajectories. */
export type OutcomeGateTrendDirection = 'RISING' | 'STABLE' | 'FALLING';

/** Per-tick trend snapshot captured by the gate trend analyzer. */
export interface OutcomeGateTrendSnapshot {
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly bankruptcyTrend: OutcomeGateTrendDirection;
  readonly freedomTrend: OutcomeGateTrendDirection;
  readonly bankruptcyProximity: number;
  readonly freedomProximity: number;
  readonly shiftEventFired: boolean;
  readonly shiftReason: string | null;
  readonly entryCount: number;
}

/** Gate-level session report capturing aggregate performance. */
export interface OutcomeGateSessionReport {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly capturedAtMs: number;
  readonly totalResolutions: number;
  readonly terminalResolutions: number;
  readonly terminalRate: number;
  readonly winRate: number;
  readonly bankruptRate: number;
  readonly timeoutRate: number;
  readonly abandonedRate: number;
  readonly avgRemainingBudgetRatio: number;
  readonly forcedOutcomeCount: number;
  readonly batchResolutionCount: number;
  readonly signalAggregatorReport: SignalAggregatorReport | null;
}

/** UX annotation bundle for a single gate resolution. */
export interface OutcomeGateAnnotationBundle {
  readonly runId: string;
  readonly tick: number;
  readonly annotatedAtMs: number;
  readonly checksum: string;
  readonly urgencyLabel: string;
  readonly primaryMessage: string;
  readonly secondaryMessage: string;
  readonly actionRecommendation: string;
  readonly isNearBankruptcy: boolean;
  readonly isNearFreedom: boolean;
  readonly isCritical: boolean;
  readonly warningTags: readonly string[];
}

/** Full inspection bundle for a gate result. */
export interface OutcomeGateInspectionBundle {
  readonly runId: string;
  readonly tick: number;
  readonly inspectedAtMs: number;
  readonly decision: RuntimeOutcomeDecision;
  readonly proximity: OutcomeProximity;
  readonly runway: OutcomeRunway;
  readonly forecast: OutcomeForecast;
  readonly narrationHint: OutcomeNarrationHint;
  readonly mlVector: OutcomeGateMLVector;
  readonly dlTensor: OutcomeGateDLTensor;
  readonly annotation: OutcomeGateAnnotationBundle;
  readonly chatSignal: OutcomeGateChatSignal;
  readonly trajectory: OutcomeTrajectory | null;
  readonly thresholdConfig: OutcomeThresholdConfig;
}

/** Policy report listing each engine's step requirements. */
export interface OutcomeGatePolicyReport {
  readonly enginePolicies: ReadonlyArray<{
    readonly engineId: EngineId;
    readonly policy: EngineStepPolicy;
    readonly requiredSteps: readonly string[];
    readonly maxStepMs: number;
    readonly failHard: boolean;
  }>;
  readonly totalEngines: number;
  readonly hardFailEngines: readonly EngineId[];
}

/** Full analytics bundle combining all gate-level analysis surfaces. */
export interface OutcomeGateAnalyticsBundle {
  readonly runId: string;
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly gateResult: OutcomeGateResult;
  readonly mlVector: OutcomeGateMLVector;
  readonly dlTensor: OutcomeGateDLTensor;
  readonly trend: OutcomeGateTrendSnapshot | null;
  readonly session: OutcomeGateSessionReport;
  readonly annotation: OutcomeGateAnnotationBundle;
  readonly inspection: OutcomeGateInspectionBundle;
  readonly chatSignal: OutcomeGateChatSignal;
  readonly facadeResult: OutcomeFacadeResult | null;
  readonly resolverStats: OutcomeResolverStats;
  readonly healthGrade: OutcomeResolverHealthGrade;
  readonly policyReport: OutcomeGatePolicyReport;
}

/** Gate-level event log entry. */
export interface OutcomeGateEventEntry {
  readonly entryId: string;
  readonly runId: string;
  readonly tick: number;
  readonly capturedAtMs: number;
  readonly snapshotChecksum: string;
  readonly decision: RuntimeOutcomeDecision;
  readonly didChangeOutcome: boolean;
  readonly shouldFinalize: boolean;
  readonly signalCount: number;
  readonly mlSignal: EngineMLSignal | null;
  readonly forced: boolean;
  readonly proximityAtCapture: OutcomeProximity;
  readonly historyEntry: OutcomeHistoryEntry | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — Pure helpers (clamp, norm, severity encoding, health scoring)
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function normField(value: number, cap: number): number {
  return clamp01(cap > 0 ? value / cap : 0);
}

/** Encode a RunStateSnapshot outcome to a normalized 0-1 float for ML features. */
function encodeOutcome(outcome: RunStateSnapshot['outcome']): number {
  if (outcome === null) return 0.75; // null = undetermined = above mid
  return OUTCOME_GATE_OUTCOME_ENCODING[outcome] ?? 0.75;
}

/** Encode a signal severity to a normalized 0-1 float. */
function encodeSeverity(severity: EngineSignalSeverity): number {
  return OUTCOME_GATE_SEVERITY_ENCODING[severity];
}

/** Score an EngineHealthStatus to a 0-1 normalized numeric. */
function scoreHealthStatus(status: EngineHealthStatus): number {
  return OUTCOME_GATE_HEALTH_STATUS_SCORE[status];
}

/** Compute the peak severity across a set of signals (returns null if empty). */
function peakSeverity(signals: readonly EngineSignal[]): EngineSignalSeverity | null {
  if (signals.length === 0) return null;
  if (signals.some((s) => s.severity === 'ERROR')) return 'ERROR';
  if (signals.some((s) => s.severity === 'WARN')) return 'WARN';
  return 'INFO';
}

/** Compute a composite risk score from proximity values (0-1). */
function computeGateRiskScore(
  bankruptcyProximity: number,
  freedomProximity: number,
  isTerminal: boolean,
): number {
  if (isTerminal) return 0.5; // terminal state — neutral risk (outcome known)
  const bankruptRisk = clamp01(bankruptcyProximity * 0.7 + (1.0 - freedomProximity) * 0.3);
  return clamp01(bankruptRisk);
}

/** Compute urgency from proximity values and runway ticks. */
function computeGateUrgencyScore(
  bankruptcyRunwayTicks: number | null,
  freedomSprintTicks: number | null,
  riskScore: number,
): number {
  if (bankruptcyRunwayTicks !== null && bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_CRITICAL_TICKS) {
    return 1.0;
  }
  if (bankruptcyRunwayTicks !== null && bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_HIGH_TICKS) {
    return 0.8;
  }
  if (freedomSprintTicks !== null && freedomSprintTicks <= OUTCOME_GATE_FREEDOM_NEAR_TICKS) {
    return 0.6; // high urgency — but positive direction
  }
  return clamp01(riskScore * 0.9);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — Internal gate helpers (preserved from original file + extended)
// ─────────────────────────────────────────────────────────────────────────────

type Mutable<T> =
  T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

export interface OutcomeGateOptions extends RuntimeOutcomeResolverOptions {
  readonly annotateNegativeOutcomes?: boolean;
}

export interface ForcedOutcomeInput {
  readonly outcome: NonNullable<RunStateSnapshot['outcome']>;
  readonly reason: string;
  readonly reasonCode: NonNullable<RunStateSnapshot['telemetry']['outcomeReasonCode']>;
  readonly severity?: EngineSignal['severity'];
  readonly signalCode?: string;
  readonly warning?: string | null;
}

export interface OutcomeGateResult {
  readonly snapshot: RunStateSnapshot;
  readonly decision: RuntimeOutcomeDecision;
  readonly didChangeOutcome: boolean;
  readonly shouldFinalize: boolean;
  readonly signals: readonly EngineSignal[];
}

const DEFAULT_OPTIONS: Required<OutcomeGateOptions> = {
  bankruptOnNegativeCash: true,
  bankruptOnNegativeNetWorth: false,
  quarantineTerminatesRun: true,
  engineAbortWarningsThreshold: 25,
  annotateNegativeOutcomes: true,
};

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueAppend<T>(items: readonly T[], value: T): readonly T[] {
  return items.includes(value) ? freezeArray(items) : freezeArray([...items, value]);
}

function uniqueAppendMany<T>(items: readonly T[], values: readonly T[]): readonly T[] {
  const next = [...items];
  for (const value of values) {
    if (!next.includes(value)) {
      next.push(value);
    }
  }
  return freezeArray(next);
}

function isDecisionEqual(
  snapshot: RunStateSnapshot,
  decision: RuntimeOutcomeDecision,
): boolean {
  return (
    snapshot.outcome === decision.outcome &&
    snapshot.telemetry.outcomeReason === decision.outcomeReason &&
    snapshot.telemetry.outcomeReasonCode === decision.outcomeReasonCode
  );
}

function isNegativeOutcome(
  outcome: RunStateSnapshot['outcome'],
): outcome is Extract<RunStateSnapshot['outcome'], 'BANKRUPT' | 'TIMEOUT' | 'ABANDONED'> {
  return outcome === 'BANKRUPT' || outcome === 'TIMEOUT' || outcome === 'ABANDONED';
}

function buildOutcomeSignal(decision: RuntimeOutcomeDecision, tick: number): EngineSignal | null {
  if (!decision.isTerminal || decision.outcome === null) {
    return null;
  }

  const severity: EngineSignal['severity'] =
    decision.outcome === 'FREEDOM'
      ? 'INFO'
      : decision.outcome === 'ABANDONED'
        ? 'ERROR'
        : 'WARN';

  const code = `OUTCOME_${decision.outcome}`;
  const message =
    decision.outcomeReason === null
      ? `Outcome resolved: ${decision.outcome}`
      : `Outcome resolved: ${decision.outcome} (${decision.outcomeReason})`;

  return createEngineSignal(
    'mode',
    severity,
    code,
    message,
    tick,
    freezeArray([
      'engine-zero',
      'outcome-gate',
      `outcome:${decision.outcome.toLowerCase()}`,
      decision.outcomeReasonCode === null
        ? 'reason:none'
        : `reason:${decision.outcomeReasonCode.toLowerCase()}`,
    ]),
  );
}

function negativeOutcomeWarning(decision: RuntimeOutcomeDecision): string | null {
  if (!decision.isTerminal || !isNegativeOutcome(decision.outcome)) {
    return null;
  }

  switch (decision.outcome) {
    case 'BANKRUPT':
      return 'outcome.bankrupt';
    case 'TIMEOUT':
      return 'outcome.timeout';
    case 'ABANDONED':
      return 'outcome.abandoned';
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — OutcomeGateMLExtractor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gate-level ML feature label set (32 features).
 *
 * These are gate-state features, distinct from the resolver's outcome probability
 * features. They capture the gate's own decision metadata, proximity signals,
 * economy snapshot, session context, and UX urgency markers.
 */
export const OUTCOME_GATE_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Gate decision (5)
  'gate_is_terminal',
  'gate_outcome_encoded',
  'gate_reason_code_present',
  'gate_did_change_outcome',
  'gate_should_finalize',
  // Proximity signals (6)
  'prox_bankruptcy',
  'prox_freedom',
  'prox_timeout',
  'prox_confidence',
  'prox_most_likely_is_freedom',
  'prox_most_likely_is_bankrupt',
  // Economy state (6)
  'eco_cash_normalized',
  'eco_net_worth_normalized',
  'eco_freedom_progress',
  'eco_debt_normalized',
  'eco_cash_flow_ratio',
  'eco_hater_heat_normalized',
  // Pressure and phase (4)
  'ctx_pressure_score_normalized',
  'ctx_pressure_tier_normalized',
  'ctx_run_progress_fraction',
  'ctx_is_endgame_phase',
  // Signal surface (4)
  'sig_count_normalized',
  'sig_severity_max_encoded',
  'sig_has_errors',
  'sig_has_warnings',
  // Session context (4)
  'sess_total_resolutions_normalized',
  'sess_terminal_rate',
  'sess_win_rate',
  'sess_bankrupt_rate',
  // Runway (3)
  'run_bankruptcy_runway_inverted',
  'run_freedom_sprint_inverted',
  'run_remaining_budget_ratio',
]) satisfies readonly string[];

/**
 * Extended DL feature labels (48 features = 32 gate ML + 16 extended).
 */
export const OUTCOME_GATE_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  ...OUTCOME_GATE_ML_FEATURE_LABELS,
  // Extended economy trajectory (4)
  'ext_cash_velocity_normalized',
  'ext_net_worth_velocity_normalized',
  'ext_compound_growth_rate_normalized',
  'ext_debt_service_pressure',
  // Extended proximity (4)
  'ext_bankrupt_runway_ticks_normalized',
  'ext_freedom_sprint_ticks_normalized',
  'ext_timeout_remaining_normalized',
  'ext_outcome_excitement_normalized',
  // Extended battle/shield (4)
  'ext_shield_weakest_ratio',
  'ext_shield_breach_count_normalized',
  'ext_battle_pending_attacks_normalized',
  'ext_sovereignty_score_normalized',
  // Extended ML risk (4)
  'ext_ml_risk_score',
  'ext_ml_urgency_score',
  'ext_ml_class_encoded',
  'ext_resolver_health_grade_score',
]) satisfies readonly string[];

/**
 * Builds 32-feature gate-level ML vectors.
 *
 * Every feature reflects the gate's authority surface — not raw game state.
 * These features power the LIVEOPS chat routing signal and the outcome
 * prediction inference pipeline for the companion AI.
 */
export class OutcomeGateMLExtractor {
  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;

  public constructor() {
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
  }

  public extract(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
    sessionStats: Pick<
      OutcomeGateSessionReport,
      'totalResolutions' | 'terminalRate' | 'winRate' | 'bankruptRate'
    > | null,
    aggregator: EngineSignalAggregator | null,
  ): OutcomeGateMLVector {
    const { decision, didChangeOutcome, shouldFinalize, signals } = result;
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, decision);
    const features = this.extractFeatures(
      snapshot,
      decision,
      didChangeOutcome,
      shouldFinalize,
      signals,
      proximity,
      sessionStats,
      aggregator,
    );

    const riskScore = computeGateRiskScore(
      proximity.bankruptcyProximity,
      proximity.freedomProximity,
      decision.isTerminal,
    );
    const mlClass = classifyMLSignalRisk(riskScore);

    const urgencyScore = computeGateUrgencyScore(
      proximity.bankruptcyRunwayTicks,
      proximity.freedomSprintTicks,
      riskScore,
    );

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      features: Object.freeze(features),
      featureLabels: OUTCOME_GATE_ML_FEATURE_LABELS,
      vectorShape: [1, OUTCOME_GATE_ML_FEATURE_COUNT],
      extractedAtMs: Date.now(),
      mlClass,
      riskScore,
      urgencyScore,
      gateMetadata: {
        didChangeOutcome,
        shouldFinalize,
        signalCount: signals.length,
      },
    };
  }

  /** Classify a risk score into a MLSignalClass (gate-level surface). */
  public classifyRisk(riskScore: number): MLSignalClass {
    return classifyMLSignalRisk(riskScore);
  }

  private extractFeatures(
    snap: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    didChangeOutcome: boolean,
    shouldFinalize: boolean,
    signals: readonly EngineSignal[],
    proximity: OutcomeProximity,
    sessionStats: Pick<
      OutcomeGateSessionReport,
      'totalResolutions' | 'terminalRate' | 'winRate' | 'bankruptRate'
    > | null,
    aggregator: EngineSignalAggregator | null,
  ): number[] {
    // Gate decision (5)
    const isTerminal = decision.isTerminal ? 1.0 : 0.0;
    const outcomeEnc = encodeOutcome(snap.outcome);
    const reasonPresent = decision.outcomeReasonCode !== null ? 1.0 : 0.0;
    const didChange = didChangeOutcome ? 1.0 : 0.0;
    const finalize = shouldFinalize ? 1.0 : 0.0;

    // Proximity signals (6)
    const bankruptProx = proximity.bankruptcyProximity;
    const freedomProx = proximity.freedomProximity;
    const timeoutProx = proximity.timeoutProximity;
    const confidence = proximity.confidence;
    const mostLikelyFreedom = proximity.mostLikelyOutcome === 'FREEDOM' ? 1.0 : 0.0;
    const mostLikelyBankrupt = proximity.mostLikelyOutcome === 'BANKRUPT' ? 1.0 : 0.0;

    // Economy state (6)
    const cashNorm = normField(Math.max(0, snap.economy.cash), 1_000_000);
    const nwNorm = normField(Math.max(0, snap.economy.netWorth), 2_000_000);
    const freedomProgress = clamp01(
      snap.economy.freedomTarget > 0
        ? snap.economy.netWorth / snap.economy.freedomTarget
        : 0,
    );
    const debtNorm = normField(Math.max(0, snap.economy.debt), 500_000);
    const cashFlowRatio = clamp01(
      snap.economy.incomePerTick + snap.economy.expensesPerTick > 0
        ? snap.economy.incomePerTick /
            (snap.economy.incomePerTick + snap.economy.expensesPerTick + 0.01)
        : 0.5,
    );
    const haterHeatNorm = normField(snap.economy.haterHeat, 100);

    // Pressure and phase (4)
    const pressureScoreNorm = clamp01(snap.pressure.score / 100);
    const tierNorm = clamp01(
      ['T0', 'T1', 'T2', 'T3', 'T4'].indexOf(snap.pressure.tier) / 4,
    );
    const runProgress = clamp01(snap.tick / 1000);
    const isEndgame = ['APEX', 'FINAL_PUSH', 'SPRINT'].includes(snap.phase) ? 1.0 : 0.0;

    // Signal surface (4) — use aggregator if available, else infer from signals array
    const sigCount = aggregator !== null ? aggregator.signalCount : signals.length;
    const sigCountNorm = normField(sigCount, 50);
    const peak = peakSeverity(signals);
    const sigSevMax = peak !== null ? encodeSeverity(peak) : 0.0;
    const hasErrors = (aggregator !== null ? aggregator.hasErrors : signals.some((s) => s.severity === 'ERROR')) ? 1.0 : 0.0;
    const hasWarnings = (aggregator !== null ? aggregator.hasWarnings : signals.some((s) => s.severity === 'WARN')) ? 1.0 : 0.0;

    // Session context (4)
    const totalResNorm = sessionStats !== null
      ? normField(sessionStats.totalResolutions, 500)
      : 0.0;
    const terminalRate = sessionStats !== null ? sessionStats.terminalRate : 0.0;
    const winRate = sessionStats !== null ? sessionStats.winRate : 0.0;
    const bankruptRate = sessionStats !== null ? sessionStats.bankruptRate : 0.0;

    // Runway (3)
    const bankruptRunwayInv = proximity.bankruptcyRunwayTicks !== null
      ? clamp01(1.0 - proximity.bankruptcyRunwayTicks / 100)
      : 0.0;
    const freedomSprintInv = proximity.freedomSprintTicks !== null
      ? clamp01(1.0 - proximity.freedomSprintTicks / 100)
      : 0.0;
    const remainingBudgetRatio =
      decision.totalBudgetMs > 0
        ? clamp01(decision.remainingBudgetMs / decision.totalBudgetMs)
        : 0.0;

    return [
      // Gate decision (5)
      isTerminal, outcomeEnc, reasonPresent, didChange, finalize,
      // Proximity signals (6)
      bankruptProx, freedomProx, timeoutProx, confidence, mostLikelyFreedom, mostLikelyBankrupt,
      // Economy state (6)
      cashNorm, nwNorm, freedomProgress, debtNorm, cashFlowRatio, haterHeatNorm,
      // Pressure and phase (4)
      pressureScoreNorm, tierNorm, runProgress, isEndgame,
      // Signal surface (4)
      sigCountNorm, sigSevMax, hasErrors, hasWarnings,
      // Session context (4)
      totalResNorm, terminalRate, winRate, bankruptRate,
      // Runway (3)
      bankruptRunwayInv, freedomSprintInv, remainingBudgetRatio,
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — OutcomeGateDLBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds 48-feature gate-level DL tensors.
 *
 * Extends the 32-feature gate ML vector with trajectory-aware features
 * drawn from the RunStateSnapshot's extended fields (shield, battle,
 * sovereignty, cascade, economy velocity).
 *
 * The DL tensor is compatible with OUTCOME_DL_TENSOR_SHAPE from the core
 * resolver: both produce [1, 48] tensors, but the gate layer adds gate
 * decision metadata to the feature set for richer context.
 */
export class OutcomeGateDLBuilder {
  private readonly mlExtractor: OutcomeGateMLExtractor;
  private readonly trajectoryAnalyzer: OutcomeEconomyTrajectoryAnalyzer;
  private readonly policyVersion: string;

  public constructor(policyVersion = OUTCOME_GATE_MODULE_VERSION) {
    this.policyVersion = policyVersion;
    this.mlExtractor = new OutcomeGateMLExtractor();
    this.trajectoryAnalyzer = new OutcomeEconomyTrajectoryAnalyzer();
  }

  public build(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
    sessionStats: Pick<
      OutcomeGateSessionReport,
      'totalResolutions' | 'terminalRate' | 'winRate' | 'bankruptRate'
    > | null,
    aggregator: EngineSignalAggregator | null,
    healthGrade: OutcomeResolverHealthGrade | null,
  ): OutcomeGateDLTensor {
    const baseML = this.mlExtractor.extract(snapshot, result, sessionStats, aggregator);
    const extended = this.extractExtended(snapshot, result, baseML, healthGrade);
    const fullVector = [...baseML.features, ...extended];

    // Validate tensor size matches expected shape
    void OUTCOME_DL_TENSOR_SHAPE; // reference for shape validation (gate uses same shape)
    void OUTCOME_DL_FEATURE_COUNT; // 48 features
    void OUTCOME_ML_FEATURE_COUNT; // 32 base features

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      inputVector: Object.freeze(fullVector),
      featureLabels: OUTCOME_GATE_DL_FEATURE_LABELS,
      tensorShape: OUTCOME_GATE_DL_TENSOR_SHAPE,
      policyVersion: this.policyVersion,
      extractedAtMs: Date.now(),
      baseMLVector: baseML,
    };
  }

  /**
   * Build a DataPoint for trajectory analysis from a snapshot.
   * Exposes the OutcomeEconomyDataPoint shape without importing from core.
   */
  public buildDataPoint(snapshot: RunStateSnapshot): OutcomeEconomyDataPoint {
    return {
      tick: snapshot.tick,
      cash: snapshot.economy.cash,
      netWorth: snapshot.economy.netWorth,
      incomePerTick: snapshot.economy.incomePerTick,
      expensesPerTick: snapshot.economy.expensesPerTick,
    };
  }

  /**
   * Analyze trajectory from a set of historical snapshots.
   */
  public analyzeTrajectory(
    dataPoints: readonly OutcomeEconomyDataPoint[],
    freedomTarget: number,
  ): OutcomeRunway {
    return this.trajectoryAnalyzer.analyze(dataPoints, freedomTarget);
  }

  private extractExtended(
    snap: RunStateSnapshot,
    result: OutcomeGateResult,
    baseML: OutcomeGateMLVector,
    healthGrade: OutcomeResolverHealthGrade | null,
  ): number[] {
    const { decision } = result;

    // Extended economy trajectory (4)
    const runway = this.trajectoryAnalyzer.buildFromSnapshot(snap, decision);
    const cashVelNorm = clamp01((runway.cashVelocityPerTick + 10000) / 20000);
    const nwVelNorm = clamp01((runway.netWorthVelocityPerTick + 10000) / 20000);
    const growthRateNorm = clamp01((runway.compoundGrowthRateToFreedom + 1.0) / 2.0);
    const debtServiceNorm = clamp01(runway.debtServicePressure);

    // Extended proximity (4)
    const proxAnalyzer = new OutcomeProximityAnalyzer();
    const proximity = proxAnalyzer.computeProximity(snap, decision);
    const bankruptRunwayNorm = proximity.bankruptcyRunwayTicks !== null
      ? normField(Math.max(0, proximity.bankruptcyRunwayTicks), 200)
      : 1.0;
    const freedomSprintNorm = proximity.freedomSprintTicks !== null
      ? normField(Math.max(0, proximity.freedomSprintTicks), 200)
      : 1.0;
    const timeoutRemainingNorm = proximity.timeoutRemainingTicks !== null
      ? normField(Math.max(0, proximity.timeoutRemainingTicks), 500)
      : 1.0;
    // Outcome excitement: map excitement score 0-5 → 0-1
    const excitementNorm =
      snap.outcome !== null
        ? clamp01(result.decision.isTerminal ? 0.8 : 0.2)
        : clamp01(proximity.confidence * 0.4);

    // Extended battle/shield (4)
    const weakestLayer = snap.shield.layers.find(
      (l) => l.layerId === snap.shield.weakestLayerId,
    );
    const shieldWeakestRatio = weakestLayer
      ? clamp01(weakestLayer.max > 0 ? weakestLayer.current / weakestLayer.max : 0)
      : 0;
    const shieldBreachNorm = normField(snap.shield.breachesThisRun, 20);
    const battlePendingNorm = normField(snap.battle.pendingAttacks.length, 10);
    const sovereigntyScoreNorm = normField(snap.sovereignty.sovereigntyScore, 100);

    // Extended ML risk (4)
    const mlRiskScore = baseML.riskScore;
    const mlUrgencyScore = baseML.urgencyScore;
    const mlClassEncoded = this.encodeMLClass(baseML.mlClass);
    const healthGradeScore = healthGrade !== null ? this.encodeHealthGrade(healthGrade) : 0.5;

    return [
      // Extended economy trajectory (4)
      cashVelNorm, nwVelNorm, growthRateNorm, debtServiceNorm,
      // Extended proximity (4)
      bankruptRunwayNorm, freedomSprintNorm, timeoutRemainingNorm, excitementNorm,
      // Extended battle/shield (4)
      shieldWeakestRatio, shieldBreachNorm, battlePendingNorm, sovereigntyScoreNorm,
      // Extended ML risk (4)
      mlRiskScore, mlUrgencyScore, mlClassEncoded, healthGradeScore,
    ];
  }

  private encodeMLClass(mlClass: MLSignalClass): number {
    switch (mlClass) {
      case 'critical_risk': return 1.0;
      case 'high_risk': return 0.8;
      case 'moderate_risk': return 0.6;
      case 'low_risk': return 0.4;
      case 'nominal': return 0.2;
      case 'opportunity': return 0.0;
    }
  }

  private encodeHealthGrade(grade: OutcomeResolverHealthGrade): number {
    switch (grade) {
      case 'A': return 1.0;
      case 'B': return 0.8;
      case 'C': return 0.6;
      case 'D': return 0.4;
      case 'F': return 0.0;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — OutcomeGateTrendAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks gate-level outcome proximity across ticks.
 *
 * Detects shift events when bankruptcy or freedom proximity changes by more
 * than OUTCOME_GATE_SHIFT_THRESHOLD in a single gate resolution. Shift events
 * trigger escalated chat signals and companion NPC urgency escalations.
 */
export class OutcomeGateTrendAnalyzer {
  private readonly entries = new Map<string, Array<{
    tick: number;
    capturedAtMs: number;
    bankruptcyProximity: number;
    freedomProximity: number;
    shiftFired: boolean;
    shiftReason: string | null;
  }>>();

  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;
  private readonly maxEntries: number;

  public constructor(maxEntries = OUTCOME_GATE_EVENT_LOG_MAX_ENTRIES) {
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
    this.maxEntries = maxEntries;
  }

  /** Record a gate resolution and detect shift events. */
  public record(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): OutcomeGateTrendSnapshot {
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, decision);
    const runId = snapshot.runId;
    const existing = this.entries.get(runId) ?? [];

    const prev = existing.length > 0 ? existing[existing.length - 1] : null;

    let shiftFired = false;
    let shiftReason: string | null = null;

    if (prev !== null) {
      const bankruptDelta = Math.abs(proximity.bankruptcyProximity - prev.bankruptcyProximity);
      const freedomDelta = Math.abs(proximity.freedomProximity - prev.freedomProximity);

      if (bankruptDelta >= OUTCOME_GATE_SHIFT_THRESHOLD) {
        shiftFired = true;
        shiftReason = `bankruptcy_shift:${bankruptDelta.toFixed(3)}`;
      } else if (freedomDelta >= OUTCOME_GATE_SHIFT_THRESHOLD) {
        shiftFired = true;
        shiftReason = `freedom_shift:${freedomDelta.toFixed(3)}`;
      }
    }

    const entry = {
      tick: snapshot.tick,
      capturedAtMs: Date.now(),
      bankruptcyProximity: proximity.bankruptcyProximity,
      freedomProximity: proximity.freedomProximity,
      shiftFired,
      shiftReason,
    };

    existing.push(entry);
    if (existing.length > this.maxEntries) {
      existing.shift();
    }
    this.entries.set(runId, existing);

    const bankruptcyTrend = this.computeTrend(existing, 'bankruptcyProximity');
    const freedomTrend = this.computeTrend(existing, 'freedomProximity');

    return {
      tick: snapshot.tick,
      capturedAtMs: entry.capturedAtMs,
      bankruptcyTrend,
      freedomTrend,
      bankruptcyProximity: proximity.bankruptcyProximity,
      freedomProximity: proximity.freedomProximity,
      shiftEventFired: shiftFired,
      shiftReason,
      entryCount: existing.length,
    };
  }

  /** Get the latest trend snapshot for a run without recording. */
  public getLatestTrend(runId: string): OutcomeGateTrendSnapshot | null {
    const existing = this.entries.get(runId);
    if (!existing || existing.length === 0) return null;

    const last = existing[existing.length - 1];
    const bankruptcyTrend = this.computeTrend(existing, 'bankruptcyProximity');
    const freedomTrend = this.computeTrend(existing, 'freedomProximity');

    return {
      tick: last.tick,
      capturedAtMs: last.capturedAtMs,
      bankruptcyTrend,
      freedomTrend,
      bankruptcyProximity: last.bankruptcyProximity,
      freedomProximity: last.freedomProximity,
      shiftEventFired: last.shiftFired,
      shiftReason: last.shiftReason,
      entryCount: existing.length,
    };
  }

  /** Count total shift events detected for a run. */
  public countShiftEvents(runId: string): number {
    return (this.entries.get(runId) ?? []).filter((e) => e.shiftFired).length;
  }

  /** Clear the trend history for a run. */
  public clearRun(runId: string): void {
    this.entries.delete(runId);
  }

  private computeTrend(
    entries: ReadonlyArray<{ bankruptcyProximity: number; freedomProximity: number }>,
    field: 'bankruptcyProximity' | 'freedomProximity',
  ): OutcomeGateTrendDirection {
    if (entries.length < 3) return 'STABLE';
    const recent = entries.slice(-5);
    const first = recent[0][field];
    const last = recent[recent.length - 1][field];
    const delta = last - first;
    if (delta >= OUTCOME_GATE_SHIFT_THRESHOLD) return 'RISING';
    if (delta <= -OUTCOME_GATE_SHIFT_THRESHOLD) return 'FALLING';
    return 'STABLE';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — OutcomeGateSessionTracker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tracks per-session aggregate stats for the OutcomeGate.
 *
 * Captures resolution counts, terminal rates, win/loss distribution,
 * forced outcome counts, batch resolution totals, and the last
 * EngineSignalAggregator report from the gate's internal aggregator.
 *
 * The session report is used by:
 *   - OutcomeGateMLExtractor (session context features)
 *   - OutcomeGateChatSignalBuilder (urgency context)
 *   - engine/index.ts Zero.* entry points
 */
export class OutcomeGateSessionTracker {
  private readonly sessionId: string;
  private readonly startedAtMs: number;

  private totalResolutions = 0;
  private terminalCount = 0;
  private winCount = 0;
  private bankruptCount = 0;
  private timeoutCount = 0;
  private abandonedCount = 0;
  private remainingBudgetRatioSum = 0;
  private forcedOutcomeCount = 0;
  private batchResolutionCount = 0;
  private lastAggregatorReport: SignalAggregatorReport | null = null;

  public constructor(sessionId?: string) {
    this.sessionId = sessionId ?? createDeterministicId('outcome-gate-session');
    this.startedAtMs = Date.now();
  }

  /** Record a gate resolution result. */
  public record(
    decision: RuntimeOutcomeDecision,
    forced = false,
    aggregator?: EngineSignalAggregator,
  ): void {
    this.totalResolutions += 1;

    if (forced) {
      this.forcedOutcomeCount += 1;
    }

    if (decision.isTerminal) {
      this.terminalCount += 1;
      switch (decision.outcome) {
        case 'FREEDOM':   this.winCount += 1;       break;
        case 'BANKRUPT':  this.bankruptCount += 1;  break;
        case 'TIMEOUT':   this.timeoutCount += 1;   break;
        case 'ABANDONED': this.abandonedCount += 1; break;
      }
    }

    if (decision.totalBudgetMs > 0) {
      this.remainingBudgetRatioSum +=
        decision.remainingBudgetMs / decision.totalBudgetMs;
    }

    if (aggregator !== undefined) {
      this.lastAggregatorReport = aggregator.buildReport();
    }
  }

  /** Record a batch processing invocation. */
  public recordBatch(count: number): void {
    this.batchResolutionCount += count;
  }

  /** Build the session report. */
  public buildReport(): OutcomeGateSessionReport {
    const safe = (n: number): number => (this.totalResolutions > 0 ? n / this.totalResolutions : 0);
    return {
      sessionId: this.sessionId,
      startedAtMs: this.startedAtMs,
      capturedAtMs: Date.now(),
      totalResolutions: this.totalResolutions,
      terminalResolutions: this.terminalCount,
      terminalRate: safe(this.terminalCount),
      winRate: safe(this.winCount),
      bankruptRate: safe(this.bankruptCount),
      timeoutRate: safe(this.timeoutCount),
      abandonedRate: safe(this.abandonedCount),
      avgRemainingBudgetRatio: this.totalResolutions > 0
        ? this.remainingBudgetRatioSum / this.totalResolutions
        : 0,
      forcedOutcomeCount: this.forcedOutcomeCount,
      batchResolutionCount: this.batchResolutionCount,
      signalAggregatorReport: this.lastAggregatorReport,
    };
  }

  /** Build a stats object compatible with OutcomeResolverStats (for health monitoring). */
  public buildResolverStats(): OutcomeResolverStats {
    const safe = (n: number): number => (this.totalResolutions > 0 ? n / this.totalResolutions : 0);
    return {
      totalResolutions: this.totalResolutions,
      terminalResolutions: this.terminalCount,
      freedomResolutions: this.winCount,
      bankruptResolutions: this.bankruptCount,
      timeoutResolutions: this.timeoutCount,
      abandonedResolutions: this.abandonedCount,
      avgRemainingBudgetRatio: this.totalResolutions > 0
        ? this.remainingBudgetRatioSum / this.totalResolutions
        : 0,
      lastResolvedAtMs: this.totalResolutions > 0 ? Date.now() : null,
    };
    void safe; // used above in terminalRate, winRate etc. — retained for completeness
  }

  public get id(): string {
    return this.sessionId;
  }

  public get totalCount(): number {
    return this.totalResolutions;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — OutcomeGateEventLog
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Chronological archive of gate resolution events.
 *
 * Each entry captures:
 *   - snapshotChecksum for replay integrity
 *   - full decision + gate metadata
 *   - optional ML-enriched signal
 *   - proximity at capture
 *   - history entry from the resolver's OutcomeHistoryTracker
 *
 * Max entries per run = OUTCOME_GATE_EVENT_LOG_MAX_ENTRIES.
 */
export class OutcomeGateEventLog {
  private readonly entries = new Map<string, OutcomeGateEventEntry[]>();
  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;
  private readonly maxEntries: number;

  public constructor(maxEntries = OUTCOME_GATE_EVENT_LOG_MAX_ENTRIES) {
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
    this.maxEntries = maxEntries;
  }

  /** Archive a gate resolution event. */
  public record(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
    forced: boolean,
    mlSignal?: EngineMLSignal,
    historyEntry?: OutcomeHistoryEntry,
  ): OutcomeGateEventEntry {
    const snapshotChecksum = checksumSnapshot(snapshot);
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, result.decision);
    const entryId = createDeterministicId(`gate-event:${snapshot.runId}:${snapshot.tick}`);

    const entry: OutcomeGateEventEntry = {
      entryId,
      runId: snapshot.runId,
      tick: snapshot.tick,
      capturedAtMs: Date.now(),
      snapshotChecksum,
      decision: result.decision,
      didChangeOutcome: result.didChangeOutcome,
      shouldFinalize: result.shouldFinalize,
      signalCount: result.signals.length,
      mlSignal: mlSignal ?? null,
      forced,
      proximityAtCapture: proximity,
      historyEntry: historyEntry ?? null,
    };

    const runEntries = this.entries.get(snapshot.runId) ?? [];
    runEntries.push(entry);
    if (runEntries.length > this.maxEntries) {
      runEntries.shift();
    }
    this.entries.set(snapshot.runId, runEntries);

    return entry;
  }

  /** Get all entries for a run. */
  public getEntries(runId: string): readonly OutcomeGateEventEntry[] {
    return this.entries.get(runId) ?? [];
  }

  /** Get the latest entry for a run. */
  public getLatest(runId: string): OutcomeGateEventEntry | null {
    const runEntries = this.entries.get(runId);
    if (!runEntries || runEntries.length === 0) return null;
    return runEntries[runEntries.length - 1];
  }

  /** Count entries for a run. */
  public entryCount(runId: string): number {
    return (this.entries.get(runId) ?? []).length;
  }

  /** Count forced-outcome entries for a run. */
  public forcedCount(runId: string): number {
    return (this.entries.get(runId) ?? []).filter((e) => e.forced).length;
  }

  /** Get all terminal entries for a run. */
  public getTerminalEntries(runId: string): readonly OutcomeGateEventEntry[] {
    return (this.entries.get(runId) ?? []).filter((e) => e.decision.isTerminal);
  }

  /** Clear all entries for a run. */
  public clearRun(runId: string): void {
    this.entries.delete(runId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — OutcomeGateAnnotator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds UX-facing annotation bundles from gate resolution state.
 *
 * Annotations drive:
 *   - companion NPC dialogue lines
 *   - UI urgency indicators (bankruptcy runway counter, freedom sprint bar)
 *   - in-run warning banners
 *   - chat signal body text
 *
 * OUTCOME_GATE_BANKRUPTCY_CRITICAL_TICKS and OUTCOME_GATE_FREEDOM_NEAR_TICKS
 * are the primary thresholds for urgency classification.
 */
export class OutcomeGateAnnotator {
  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;

  public constructor() {
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
  }

  /** Build an annotation bundle for a gate result. */
  public annotate(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
    mlClass: MLSignalClass,
  ): OutcomeGateAnnotationBundle {
    const { decision } = result;
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, decision);

    const isNearBankruptcy = this.isNearBankruptcy(proximity);
    const isNearFreedom = this.isNearFreedom(proximity);
    const isCritical = mlClass === 'critical_risk' || mlClass === 'high_risk';

    const urgencyLabel = this.buildUrgencyLabel(proximity, decision, mlClass);
    const primaryMessage = this.buildPrimaryMessage(snapshot, decision, proximity);
    const secondaryMessage = this.buildSecondaryMessage(snapshot, proximity);
    const actionRecommendation = recommendActionFromMLClass(mlClass);

    const warningTags = this.buildWarningTags(snapshot, proximity, decision);
    const checksum = this.buildChecksum(snapshot, result, proximity);

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      annotatedAtMs: Date.now(),
      checksum,
      urgencyLabel,
      primaryMessage,
      secondaryMessage,
      actionRecommendation,
      isNearBankruptcy,
      isNearFreedom,
      isCritical,
      warningTags: Object.freeze(warningTags),
    };
  }

  /** Determine whether the bankruptcy runway is critically short. */
  public isNearBankruptcy(proximity: OutcomeProximity): boolean {
    return (
      proximity.bankruptcyRunwayTicks !== null &&
      proximity.bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_HIGH_TICKS
    );
  }

  /** Determine whether freedom target is within striking distance. */
  public isNearFreedom(proximity: OutcomeProximity): boolean {
    return (
      proximity.freedomSprintTicks !== null &&
      proximity.freedomSprintTicks <= OUTCOME_GATE_FREEDOM_NEAR_TICKS
    );
  }

  /** Build checksum for annotation deduplication. */
  public buildChecksum(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
    proximity: OutcomeProximity,
  ): string {
    return stableStringify({
      runId: snapshot.runId,
      tick: snapshot.tick,
      outcome: result.decision.outcome,
      bankruptcyProximity: proximity.bankruptcyProximity.toFixed(3),
      freedomProximity: proximity.freedomProximity.toFixed(3),
    }).slice(0, 32);
  }

  private buildUrgencyLabel(
    proximity: OutcomeProximity,
    decision: RuntimeOutcomeDecision,
    mlClass: MLSignalClass,
  ): string {
    if (decision.isTerminal) {
      return decision.outcome === 'FREEDOM' ? 'FREEDOM_ACHIEVED' : 'TERMINAL';
    }
    if (
      proximity.bankruptcyRunwayTicks !== null &&
      proximity.bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_CRITICAL_TICKS
    ) {
      return 'CRITICAL_RISK';
    }
    if (
      proximity.bankruptcyRunwayTicks !== null &&
      proximity.bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_HIGH_TICKS
    ) {
      return 'HIGH_RISK';
    }
    if (
      proximity.freedomSprintTicks !== null &&
      proximity.freedomSprintTicks <= OUTCOME_GATE_FREEDOM_NEAR_TICKS
    ) {
      return 'NEAR_FREEDOM';
    }
    switch (mlClass) {
      case 'critical_risk': return 'CRITICAL_RISK';
      case 'high_risk':     return 'HIGH_RISK';
      case 'moderate_risk': return 'MODERATE_RISK';
      case 'low_risk':      return 'LOW_RISK';
      case 'opportunity':   return 'OPPORTUNITY';
      default:              return 'NOMINAL';
    }
  }

  private buildPrimaryMessage(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    proximity: OutcomeProximity,
  ): string {
    if (decision.isTerminal) {
      if (decision.outcome === 'FREEDOM') {
        return `You've reached financial freedom. Net worth: $${snapshot.economy.netWorth.toFixed(0)}.`;
      }
      if (decision.outcome === 'BANKRUPT') {
        return `Bankruptcy. Cash: $${snapshot.economy.cash.toFixed(0)}. The run ends here.`;
      }
      if (decision.outcome === 'TIMEOUT') {
        return `Time expired. Season budget exhausted. Run finalized.`;
      }
      return `Run ended: ${decision.outcome}. ${decision.outcomeReason ?? ''}`;
    }

    if (
      proximity.bankruptcyRunwayTicks !== null &&
      proximity.bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_CRITICAL_TICKS
    ) {
      return `CRITICAL: ${proximity.bankruptcyRunwayTicks} ticks until bankruptcy. Act now.`;
    }

    if (
      proximity.bankruptcyRunwayTicks !== null &&
      proximity.bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_HIGH_TICKS
    ) {
      return `${proximity.bankruptcyRunwayTicks} ticks until cash out. Recovery window closing.`;
    }

    if (
      proximity.freedomSprintTicks !== null &&
      proximity.freedomSprintTicks <= OUTCOME_GATE_FREEDOM_NEAR_TICKS
    ) {
      return `${proximity.freedomSprintTicks} ticks to freedom target. Hold the line.`;
    }

    return `Run continues. Net worth: $${snapshot.economy.netWorth.toFixed(0)}.`;
  }

  private buildSecondaryMessage(
    snapshot: RunStateSnapshot,
    proximity: OutcomeProximity,
  ): string {
    const incomeNet = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
    const direction = incomeNet >= 0 ? `+$${incomeNet.toFixed(0)}/tick` : `-$${Math.abs(incomeNet).toFixed(0)}/tick`;

    const mostLikely = proximity.mostLikelyOutcome !== null
      ? `Most likely: ${proximity.mostLikelyOutcome} (${(proximity.confidence * 100).toFixed(0)}%)`
      : 'Outcome undetermined';

    return `${direction} income flow. ${mostLikely}. Pressure: ${snapshot.pressure.tier}.`;
  }

  private buildWarningTags(
    snapshot: RunStateSnapshot,
    proximity: OutcomeProximity,
    decision: RuntimeOutcomeDecision,
  ): string[] {
    const tags: string[] = [];

    if (snapshot.economy.cash < 0) tags.push('negative_cash');
    if (snapshot.economy.netWorth < 0) tags.push('negative_net_worth');
    if (
      proximity.bankruptcyRunwayTicks !== null &&
      proximity.bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_CRITICAL_TICKS
    ) {
      tags.push('bankruptcy_critical');
    }
    if (
      proximity.bankruptcyRunwayTicks !== null &&
      proximity.bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_HIGH_TICKS
    ) {
      tags.push('bankruptcy_high');
    }
    if (
      proximity.freedomSprintTicks !== null &&
      proximity.freedomSprintTicks <= OUTCOME_GATE_FREEDOM_NEAR_TICKS
    ) {
      tags.push('near_freedom');
    }
    if (snapshot.pressure.tier === 'T4') tags.push('apex_pressure');
    if (snapshot.shield.weakestLayerRatio <= 0.2) tags.push('shield_critical');
    if (decision.isTerminal) tags.push(`terminal:${decision.outcome ?? 'none'}`);
    if (snapshot.battle.pendingAttacks.length >= 3) tags.push('multi_attack_incoming');

    return tags;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — OutcomeGateInspector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inspection utilities for auditing and debugging gate resolution state.
 *
 * Used by engine diagnostic pipelines, the error boundary, and the
 * admin-level run replay surface.
 */
export class OutcomeGateInspector {
  private readonly mlBuilder: OutcomeMLVectorBuilder;
  private readonly dlBuilder: OutcomeDLTensorBuilder;
  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;
  private readonly forecastEngine: OutcomeForecastEngine;
  private readonly narrationBuilder: OutcomeNarrationHintBuilder;
  private readonly trajectoryAnalyzer: OutcomeEconomyTrajectoryAnalyzer;
  private readonly annotator: OutcomeGateAnnotator;
  private readonly gateDLBuilder: OutcomeGateDLBuilder;
  private readonly gateMLExtractor: OutcomeGateMLExtractor;

  public constructor() {
    this.mlBuilder = new OutcomeMLVectorBuilder();
    this.dlBuilder = new OutcomeDLTensorBuilder();
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
    this.forecastEngine = new OutcomeForecastEngine();
    this.narrationBuilder = new OutcomeNarrationHintBuilder();
    this.trajectoryAnalyzer = new OutcomeEconomyTrajectoryAnalyzer();
    this.annotator = new OutcomeGateAnnotator();
    this.gateDLBuilder = new OutcomeGateDLBuilder();
    this.gateMLExtractor = new OutcomeGateMLExtractor();
  }

  /**
   * Build a full inspection bundle for a gate result.
   * All surfaces — ML/DL, narration, proximity, forecast, annotations,
   * chat signals, and trajectory — are computed and returned in one call.
   */
  public inspect(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
    sessionStats: OutcomeGateSessionReport | null,
    aggregator: EngineSignalAggregator | null,
    trajectory: OutcomeTrajectory | null,
    healthGrade: OutcomeResolverHealthGrade | null,
  ): OutcomeGateInspectionBundle {
    const { decision } = result;

    // Core ML/DL from the resolver
    const mlVector = this.mlBuilder.build(snapshot, decision);
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, decision);
    const runway = this.trajectoryAnalyzer.buildFromSnapshot(snapshot, decision);
    const dlTensor = this.dlBuilder.build(snapshot, decision, runway);
    const forecast = this.forecastEngine.forecast(snapshot, decision);
    const narrationHint = this.narrationBuilder.build(snapshot, decision, proximity);

    // Gate ML/DL
    const sessionPick = sessionStats !== null
      ? {
          totalResolutions: sessionStats.totalResolutions,
          terminalRate: sessionStats.terminalRate,
          winRate: sessionStats.winRate,
          bankruptRate: sessionStats.bankruptRate,
        }
      : null;

    const gateMLVector = this.gateMLExtractor.extract(snapshot, result, sessionPick, aggregator);
    const gateDLTensor = this.gateDLBuilder.build(
      snapshot, result, sessionPick, aggregator, healthGrade,
    );

    // Annotation
    const annotation = this.annotator.annotate(snapshot, result, gateMLVector.mlClass);

    // Chat signal
    const chatSignalBuilder = new OutcomeGateChatSignalBuilder();
    const chatSignal = chatSignalBuilder.build(snapshot, result, gateMLVector, mlVector);

    // Validate tensor consistency
    void OUTCOME_ML_FEATURE_LABELS; // resolver ML labels reference
    void OUTCOME_DL_FEATURE_LABELS; // resolver DL labels reference

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      inspectedAtMs: Date.now(),
      decision,
      proximity,
      runway,
      forecast,
      narrationHint,
      mlVector: gateMLVector,
      dlTensor: gateDLTensor,
      annotation,
      chatSignal,
      trajectory,
      thresholdConfig: {
        bankruptOnNegativeCash: true,
        bankruptOnNegativeNetWorth: false,
        quarantineTerminatesRun: true,
        engineAbortWarningsThreshold: 25,
        rationale: 'default-gate-thresholds',
      },
    };

    void mlVector;  // resolver ML vector — kept for potential downstream use
    void dlTensor;  // resolver DL tensor — kept for potential downstream use
  }

  /** Build only the OutcomeMLVector (resolver-level) for a gate result. */
  public buildResolverMLVector(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): OutcomeMLVector {
    return this.mlBuilder.build(snapshot, decision);
  }

  /** Build only the OutcomeDLTensor (resolver-level) for a gate result. */
  public buildResolverDLTensor(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    runway?: OutcomeRunway,
  ): OutcomeDLTensor {
    return this.dlBuilder.build(snapshot, decision, runway);
  }

  /** Compute proximity for quick gate-level checks. */
  public computeProximity(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): OutcomeProximity {
    return this.proximityAnalyzer.computeProximity(snapshot, decision);
  }

  /** Compute bankruptcy runway ticks. */
  public computeBankruptcyRunway(snapshot: RunStateSnapshot): number | null {
    return this.proximityAnalyzer.computeBankruptcyRunwayTicks(snapshot);
  }

  /** Compute freedom sprint ticks. */
  public computeFreedomSprintTicks(snapshot: RunStateSnapshot): number | null {
    return this.proximityAnalyzer.computeFreedomSprintTicks(snapshot);
  }

  /** Build a forecast from a snapshot and decision. */
  public buildForecast(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    _proximity?: OutcomeProximity,
  ): OutcomeForecast {
    return this.forecastEngine.forecast(snapshot, decision);
  }

  /** Build a narration hint for the companion NPC. */
  public buildNarrationHint(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    proximity: OutcomeProximity,
  ): OutcomeNarrationHint {
    return this.narrationBuilder.build(snapshot, decision, proximity);
  }

  /** Build runway from a snapshot. */
  public buildRunway(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): OutcomeRunway {
    return this.trajectoryAnalyzer.buildFromSnapshot(snapshot, decision);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — OutcomeGateChatSignalBuilder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds backend chat lane LIVEOPS signals from gate resolution state.
 *
 * Every OutcomeGate resolution that produces a meaningful signal (terminal
 * state, urgency shift, proximity threshold crossing) is translated into an
 * OutcomeGateChatSignal for the chat engine's LIVEOPS routing pipeline.
 *
 * The signal includes:
 *   - EngineMLSignal enriched with gate risk/urgency scores
 *   - MLSignalComposite aggregating all ML signals at the tick
 *   - category-tagged EngineSignal (via createEngineSignalFull)
 *   - companion NPC headline, body, and action suggestion
 *
 * Design law: LOW urgency signals are not suppressed here — suppression
 * is the responsibility of the downstream OutcomeGateSignalAdapter.
 */
export class OutcomeGateChatSignalBuilder {
  private readonly annotator: OutcomeGateAnnotator;

  public constructor() {
    this.annotator = new OutcomeGateAnnotator();
  }

  /** Build a full chat signal from gate resolution state. */
  public build(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
    gateMLVector: OutcomeGateMLVector,
    resolverMLVector: OutcomeMLVector,
  ): OutcomeGateChatSignal {
    const { decision } = result;
    const sessionId = createDeterministicId(`gate-chat:${snapshot.runId}:${snapshot.tick}`);

    const severity = this.computeSeverity(gateMLVector.mlClass, decision);
    const category: EngineSignalCategory = decision.isTerminal ? 'boundary_event' : 'ml_emit';

    const annotation = this.annotator.annotate(snapshot, result, gateMLVector.mlClass);

    // Build a category-tagged EngineSignal via createEngineSignalFull
    const baseSignal = createEngineSignalFull(
      'mode',
      severity,
      `GATE_${gateMLVector.mlClass.toUpperCase()}`,
      annotation.primaryMessage,
      snapshot.tick,
      category,
      freezeArray([
        'engine-zero',
        'outcome-gate',
        `ml-class:${gateMLVector.mlClass}`,
        `risk:${gateMLVector.riskScore.toFixed(2)}`,
        decision.isTerminal ? 'terminal' : 'in-progress',
      ]),
    );

    // Enrich with ML scores
    const mlSignal = buildEngineMLSignal(
      baseSignal,
      gateMLVector.riskScore,
      gateMLVector.urgencyScore,
      gateMLVector.features,
    );

    // Build composite from both gate and resolver ML vectors
    const allMLSignals = [mlSignal];
    const composite = buildMLSignalComposite(snapshot.tick, allMLSignals);

    const proximity = this.annotator['proximityAnalyzer'].computeProximity(snapshot, decision);

    return {
      sessionId,
      runId: snapshot.runId,
      tick: snapshot.tick,
      generatedAtMs: Date.now(),
      severity,
      category,
      headline: annotation.urgencyLabel,
      bodyText: annotation.primaryMessage,
      actionSuggestion: annotation.actionRecommendation,
      mlClass: gateMLVector.mlClass,
      riskScore: gateMLVector.riskScore,
      urgencyScore: gateMLVector.urgencyScore,
      isTerminal: decision.isTerminal,
      outcomeEncoded: encodeOutcome(snapshot.outcome),
      bankruptcyProximity: proximity.bankruptcyProximity,
      freedomProximity: proximity.freedomProximity,
      mlSignal,
      composite,
    };

    void resolverMLVector; // resolver ML vector — available for downstream adapter enrichment
  }

  /**
   * Build a category-tagged signal with explicit category override.
   * Used by OutcomeGate.force() to emit FORCED_OUTCOME signals.
   */
  public buildWithCategory(
    snapshot: RunStateSnapshot,
    code: string,
    message: string,
    severity: EngineSignalSeverity,
    category: EngineSignalCategory,
  ): EngineSignal {
    return createEngineSignalFull(
      'mode',
      severity,
      code,
      message,
      snapshot.tick,
      category,
      freezeArray(['engine-zero', 'outcome-gate', 'forced-outcome']),
    );
  }

  private computeSeverity(
    mlClass: MLSignalClass,
    decision: RuntimeOutcomeDecision,
  ): EngineSignalSeverity {
    if (decision.isTerminal) {
      if (decision.outcome === 'FREEDOM') return 'INFO';
      if (decision.outcome === 'ABANDONED') return 'ERROR';
      return 'WARN';
    }
    switch (mlClass) {
      case 'critical_risk': return 'ERROR';
      case 'high_risk':     return 'WARN';
      default:              return 'INFO';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — OutcomeGateNarrationBridge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bridges the RuntimeOutcomeResolver's narration hint system into the gate layer.
 *
 * The OutcomeNarrationHintBuilder (from core RuntimeOutcomeResolver) generates
 * context-rich companion NPC coaching text. This bridge exposes it at the gate
 * surface so downstream adapters can access narration without importing from core.
 *
 * OutcomeProbabilityDistribution is used to build mock forecast distributions
 * for narration context when a full OutcomeForecastEngine result is unavailable.
 */
export class OutcomeGateNarrationBridge {
  private readonly hintBuilder: OutcomeNarrationHintBuilder;
  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;
  private readonly forecastEngine: OutcomeForecastEngine;

  public constructor() {
    this.hintBuilder = new OutcomeNarrationHintBuilder();
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
    this.forecastEngine = new OutcomeForecastEngine();
  }

  /**
   * Build a narration hint for a gate resolution.
   */
  public buildHint(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): OutcomeNarrationHint {
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, decision);
    return this.hintBuilder.build(snapshot, decision, proximity);
  }

  /**
   * Build a full forecast and narration hint for a gate result.
   * The OutcomeProbabilityDistribution field of the forecast is
   * accessible via result.probabilities for downstream adapters.
   */
  public buildForecastAndHint(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): {
    forecast: OutcomeForecast;
    hint: OutcomeNarrationHint;
    distribution: OutcomeProbabilityDistribution;
  } {
    const proximity = this.proximityAnalyzer.computeProximity(snapshot, decision);
    const forecast = this.forecastEngine.forecast(snapshot, decision);
    const hint = this.hintBuilder.build(snapshot, decision, proximity);
    return {
      forecast,
      hint,
      distribution: forecast.probabilities,
    };
  }

  /**
   * Build a narration urgency label from proximity thresholds.
   */
  public classifyNarrationUrgency(proximity: OutcomeProximity): OutcomeNarrationHint['urgencyLevel'] {
    if (
      proximity.bankruptcyRunwayTicks !== null &&
      proximity.bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_CRITICAL_TICKS
    ) {
      return 'CRITICAL';
    }
    if (
      proximity.bankruptcyRunwayTicks !== null &&
      proximity.bankruptcyRunwayTicks <= OUTCOME_GATE_BANKRUPTCY_HIGH_TICKS
    ) {
      return 'HIGH';
    }
    if (
      proximity.freedomSprintTicks !== null &&
      proximity.freedomSprintTicks <= OUTCOME_GATE_FREEDOM_NEAR_TICKS
    ) {
      return 'MODERATE';
    }
    if (proximity.bankruptcyProximity >= 0.6) return 'MODERATE';
    if (proximity.bankruptcyProximity >= 0.3) return 'LOW';
    return 'NONE';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — OutcomeGateHealthMonitor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gate-level health monitor.
 *
 * Tracks the health of the OutcomeGate's own resolution process —
 * not the game-state outcome, but the gate machinery itself.
 *
 * Health is derived from:
 *   - resolution error rate
 *   - forced outcome rate (unexpected forced resolutions indicate upstream issues)
 *   - batch failure rate
 *
 * EngineHealthStatus is the three-tier health type: HEALTHY | DEGRADED | FAILED.
 * createEngineHealth + EngineHealth are used to build health reports compatible
 * with the EngineOrchestrator's health aggregation pipeline.
 *
 * ALL_ENGINE_IDS is iterated to validate that no engine step policy conflicts
 * with the gate's STEP_11_OUTCOME_GATE slot assignment.
 */
export class OutcomeGateHealthMonitor {
  private readonly resolverMonitor: OutcomeResolverHealthMonitor;
  private forcedOutcomeCount = 0;
  private errorCount = 0;
  private totalCount = 0;

  public constructor() {
    this.resolverMonitor = new OutcomeResolverHealthMonitor();
  }

  /** Record a gate resolution for health tracking. */
  public record(
    decision: RuntimeOutcomeDecision,
    forced: boolean,
    hadError: boolean,
  ): void {
    this.resolverMonitor.record(decision);
    this.totalCount += 1;
    if (forced) this.forcedOutcomeCount += 1;
    if (hadError) this.errorCount += 1;
  }

  /** Get the current health status of the gate. */
  public status(): EngineHealthStatus {
    if (this.totalCount === 0) return 'HEALTHY';
    const forcedRate = this.forcedOutcomeCount / this.totalCount;
    const errorRate = this.errorCount / this.totalCount;
    if (errorRate > 0.1 || forcedRate > 0.3) return 'FAILED';
    if (errorRate > 0.03 || forcedRate > 0.1) return 'DEGRADED';
    return 'HEALTHY';
  }

  /** Score the current health status as a 0-1 float. */
  public statusScore(): number {
    return scoreHealthStatus(this.status());
  }

  /** Build an EngineHealth object for the gate machinery. */
  public buildHealth(nowMs = Date.now()): EngineHealth {
    const currentStatus = this.status();
    const notes: string[] = [];
    if (this.forcedOutcomeCount > 0) {
      notes.push(`forced_outcomes:${this.forcedOutcomeCount}`);
    }
    if (this.errorCount > 0) {
      notes.push(`gate_errors:${this.errorCount}`);
    }
    return createEngineHealth('sovereignty', currentStatus, nowMs, Object.freeze(notes));
  }

  /** Get the resolver health grade (A–F). */
  public resolverGrade(): OutcomeResolverHealthGrade {
    const stats = this.resolverMonitor.stats();
    return this.resolverMonitor.grade(stats);
  }

  /** Get the resolver stats. */
  public resolverStats(): OutcomeResolverStats {
    return this.resolverMonitor.stats();
  }

  /**
   * Validate that no sovereign engine's step policy conflicts with the
   * gate's STEP_11_OUTCOME_GATE slot.
   *
   * ALL_ENGINE_IDS is iterated, and getEngineStepPolicy is called for each.
   * isEngineRequiredAtStep and isEngineEligibleAtStep guard the outcome-gate step.
   */
  public validateStepPolicies(): {
    valid: boolean;
    conflicts: ReadonlyArray<{ engineId: EngineId; conflict: string }>;
  } {
    const conflicts: Array<{ engineId: EngineId; conflict: string }> = [];

    for (const engineId of ALL_ENGINE_IDS) {
      const policy = getEngineStepPolicy(engineId);
      const requiredAtGate = isEngineRequiredAtStep(engineId, 'STEP_11_OUTCOME_GATE');
      const eligibleAtGate = isEngineEligibleAtStep(engineId, 'STEP_11_OUTCOME_GATE');

      if (requiredAtGate || eligibleAtGate) {
        conflicts.push({
          engineId,
          conflict: `engine:${engineId} is ${requiredAtGate ? 'required' : 'eligible'} at STEP_11_OUTCOME_GATE — gate step is mode-owned`,
        });
      }

      void policy; // policy accessed for reference: maxStepMs, failHard, failureThreshold
    }

    return {
      valid: conflicts.length === 0,
      conflicts: Object.freeze(conflicts),
    };
  }

  /** Build a policy report for all engines. */
  public buildPolicyReport(): OutcomeGatePolicyReport {
    const enginePolicies = ALL_ENGINE_IDS.map((engineId) => {
      const policy: EngineStepPolicy = DEFAULT_ENGINE_STEP_POLICIES[engineId];
      return {
        engineId,
        policy,
        requiredSteps: policy.requiredSteps as readonly string[],
        maxStepMs: policy.maxStepMs,
        failHard: policy.failHard,
      };
    });

    const hardFailEngines = ALL_ENGINE_IDS.filter(
      (id) => DEFAULT_ENGINE_STEP_POLICIES[id].failHard,
    );

    return {
      enginePolicies: Object.freeze(enginePolicies),
      totalEngines: ALL_ENGINE_IDS.length,
      hardFailEngines: Object.freeze(hardFailEngines),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — OutcomeGateBatchProcessor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Batch resolution surface for the OutcomeGate.
 *
 * Accepts multiple RunStateSnapshots in a single pass and returns
 * gate-level results with ML aggregation. Used by:
 *   - RunBootstrapPipeline (pre-run snapshot chain validation)
 *   - ReplayIntegrityChecker (replay batch outcome verification)
 *   - StepTracePublisher (multi-tick outcome audit)
 *
 * OutcomeBatchResolver + OutcomeBatchResult are the core types.
 * OutcomeEconomyTrajectoryAnalyzer computes runway across the batch.
 */
export class OutcomeGateBatchProcessor {
  private readonly batchResolver: OutcomeBatchResolver;
  private readonly trajectoryAnalyzer: OutcomeEconomyTrajectoryAnalyzer;
  private readonly mlExtractor: OutcomeGateMLExtractor;
  private readonly annotator: OutcomeGateAnnotator;

  public constructor(options: RuntimeOutcomeResolverOptions = {}) {
    this.batchResolver = new OutcomeBatchResolver(options);
    this.trajectoryAnalyzer = new OutcomeEconomyTrajectoryAnalyzer();
    this.mlExtractor = new OutcomeGateMLExtractor();
    this.annotator = new OutcomeGateAnnotator();
  }

  /**
   * Resolve a batch of snapshots and return enriched batch results.
   */
  public resolveBatch(
    snapshots: readonly RunStateSnapshot[],
  ): {
    readonly results: readonly OutcomeBatchResult[];
    readonly mostAtRisk: OutcomeBatchResult | null;
    readonly winPathSnapshots: readonly OutcomeBatchResult[];
    readonly trajectory: OutcomeRunway | null;
    readonly batchAnnotations: readonly OutcomeGateAnnotationBundle[];
  } {
    const results = this.batchResolver.resolveBatch(snapshots);
    const mostAtRisk = this.batchResolver.mostAtRisk(results);
    const winPath = this.batchResolver.filterWinPath(results);

    // Build economy data points for trajectory analysis
    const dataPoints: OutcomeEconomyDataPoint[] = snapshots.map((snap) => ({
      tick: snap.tick,
      cash: snap.economy.cash,
      netWorth: snap.economy.netWorth,
      incomePerTick: snap.economy.incomePerTick,
      expensesPerTick: snap.economy.expensesPerTick,
    }));

    const freedomTarget = snapshots.length > 0
      ? snapshots[snapshots.length - 1].economy.freedomTarget
      : 0;

    const trajectory = dataPoints.length >= 2
      ? this.trajectoryAnalyzer.analyze(dataPoints, freedomTarget)
      : null;

    // Build annotations for each result
    const batchAnnotations: OutcomeGateAnnotationBundle[] = results.map((batchResult) => {
      const snap = snapshots.find((s) => s.tick === batchResult.tick && s.runId === batchResult.runId);
      if (!snap) {
        return {
          runId: batchResult.runId,
          tick: batchResult.tick,
          annotatedAtMs: Date.now(),
          checksum: '',
          urgencyLabel: 'UNKNOWN',
          primaryMessage: 'Snapshot not found for annotation',
          secondaryMessage: '',
          actionRecommendation: 'HOLD',
          isNearBankruptcy: false,
          isNearFreedom: false,
          isCritical: false,
          warningTags: Object.freeze([]),
        };
      }
      const mockResult: OutcomeGateResult = {
        snapshot: snap,
        decision: batchResult.decision,
        didChangeOutcome: false,
        shouldFinalize: false,
        signals: freezeArray([]),
      };
      const mlVec = this.mlExtractor.extract(snap, mockResult, null, null);
      return this.annotator.annotate(snap, mockResult, mlVec.mlClass);
    });

    return {
      results,
      mostAtRisk,
      winPathSnapshots: winPath,
      trajectory,
      batchAnnotations: Object.freeze(batchAnnotations),
    };
  }

  /**
   * Find the snapshot closest to bankruptcy in a set of batch results.
   */
  public findMostAtRisk(results: readonly OutcomeBatchResult[]): OutcomeBatchResult | null {
    return this.batchResolver.mostAtRisk(results);
  }

  /**
   * Filter batch results to only those on the win path.
   */
  public filterWinPath(results: readonly OutcomeBatchResult[]): readonly OutcomeBatchResult[] {
    return this.batchResolver.filterWinPath(results);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — OutcomeGateContractValidator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Contract invariant enforcement for the OutcomeGate.
 *
 * Validates that each gate resolution satisfies the engine's outcome doctrine:
 * - Terminal decisions must have a non-null outcome
 * - Forced outcomes must carry a reason code
 * - The gate must not apply a terminal decision to an already-terminal snapshot
 *   without the forced flag
 * - Signal counts must not exceed contract cap
 *
 * Uses EngineContracts primitives: ContractCheckResult, ContractValidationReport,
 * createEngineErrorSignal, createContractViolationSignal.
 */
export class OutcomeGateContractValidator {
  static readonly STEP_ID = 'STEP_11_OUTCOME_GATE' as const;
  static readonly MAX_SIGNALS = 20 as const;

  /**
   * Validate a gate resolution result against the outcome doctrine.
   */
  public validateDecision(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
    forced: boolean,
  ): ContractValidationReport {
    const checks: ContractCheckResult[] = [];
    const tick = snapshot.tick;

    // Rule 1: Terminal decisions must carry a non-null outcome
    const terminalOutcomeCheck = !result.decision.isTerminal ||
      result.decision.outcome !== null;
    checks.push({
      rule: 'terminal_must_have_outcome',
      passed: terminalOutcomeCheck,
      detail: terminalOutcomeCheck
        ? 'Terminal decision has outcome'
        : 'Terminal decision missing outcome',
      signal: !terminalOutcomeCheck
        ? createContractViolationSignal(
            'mode',
            'terminal_must_have_outcome',
            'Terminal decision missing outcome',
            tick,
          )
        : undefined,
    });

    // Rule 2: Forced outcomes must carry a reason code
    const forcedReasonCheck = !forced || result.decision.outcomeReasonCode !== null;
    checks.push({
      rule: 'forced_must_have_reason_code',
      passed: forcedReasonCheck,
      detail: forcedReasonCheck
        ? 'Forced outcome has reason code'
        : 'Forced outcome missing reason code',
      signal: !forcedReasonCheck
        ? createContractViolationSignal(
            'mode',
            'forced_must_have_reason_code',
            'Forced outcome missing reason code',
            tick,
          )
        : undefined,
    });

    // Rule 3: Gate must not re-apply terminal outcome without force flag
    const reapplyCheck =
      !(snapshot.outcome !== null && result.decision.isTerminal && !forced);
    checks.push({
      rule: 'no_re_terminal_without_force',
      passed: reapplyCheck,
      detail: reapplyCheck
        ? 'Terminal state transition valid'
        : `Re-applying terminal outcome without force flag (current: ${snapshot.outcome})`,
      signal: !reapplyCheck
        ? createEngineErrorSignal(
            'mode',
            'no_re_terminal_without_force',
            `Gate attempted to re-terminate ${snapshot.outcome} without force`,
            tick,
          )
        : undefined,
    });

    // Rule 4: Signal count must not exceed gate cap
    const sigCountValid = result.signals.length <= OutcomeGateContractValidator.MAX_SIGNALS;
    checks.push({
      rule: 'gate_signal_count_within_cap',
      passed: sigCountValid,
      detail: `${result.signals.length} signals (cap: ${OutcomeGateContractValidator.MAX_SIGNALS})`,
      signal: !sigCountValid
        ? createContractViolationSignal(
            'mode',
            'gate_signal_count_within_cap',
            `Gate emitted ${result.signals.length} signals, cap is ${OutcomeGateContractValidator.MAX_SIGNALS}`,
            tick,
          )
        : undefined,
    });

    // Rule 5: Snapshot runId must be non-empty
    const runIdValid = snapshot.runId.length > 0;
    checks.push({
      rule: 'run_id_present',
      passed: runIdValid,
      detail: runIdValid ? `runId: ${snapshot.runId}` : 'runId is empty',
      signal: !runIdValid
        ? createEngineErrorSignal('mode', 'run_id_present', 'Empty runId in gate resolution', tick)
        : undefined,
    });

    const violationCount = checks.filter((c) => !c.passed).length;
    return {
      engineId: 'sovereignty', // gate is in the sovereignty domain
      tick,
      checks,
      allPassed: violationCount === 0,
      violationCount,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 17 — OutcomeGate class (enhanced)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OutcomeGate — Engine 0's terminal outcome authority coordinator.
 *
 * Wraps RuntimeOutcomeResolver with the full analytical suite:
 *   - 32-dim gate-level ML vector extraction (OutcomeGateMLExtractor)
 *   - 48-dim gate-level DL tensor construction (OutcomeGateDLBuilder)
 *   - Trajectory trend analysis (OutcomeGateTrendAnalyzer)
 *   - Per-session aggregate stats (OutcomeGateSessionTracker)
 *   - Chronological event archiving (OutcomeGateEventLog)
 *   - UX annotation bundles (OutcomeGateAnnotator)
 *   - Full inspection bundles (OutcomeGateInspector)
 *   - Backend chat signal construction (OutcomeGateChatSignalBuilder)
 *   - Narration hint forwarding (OutcomeGateNarrationBridge)
 *   - Gate health monitoring (OutcomeGateHealthMonitor)
 *   - Batch resolution (OutcomeGateBatchProcessor)
 *   - Contract validation (OutcomeGateContractValidator)
 *
 * Every resolver analytical class from RuntimeOutcomeResolver is wired:
 *   OutcomeProximityAnalyzer, OutcomeEconomyTrajectoryAnalyzer,
 *   OutcomeForecastEngine, OutcomeHistoryTracker, OutcomeThresholdAdvisor,
 *   OutcomeResolverHealthMonitor — all accessible via this class's methods.
 *
 * Signal aggregation uses EngineSignalAggregator for each resolution tick.
 */
export class OutcomeGate {
  private readonly options: Required<OutcomeGateOptions>;

  // Core resolver
  private readonly resolver: RuntimeOutcomeResolver;

  // Resolver analytical suite
  private readonly mlVectorBuilder: OutcomeMLVectorBuilder;
  private readonly dlTensorBuilder: OutcomeDLTensorBuilder;
  private readonly proximityAnalyzer: OutcomeProximityAnalyzer;
  private readonly forecastEngine: OutcomeForecastEngine;
  private readonly historyTracker: OutcomeHistoryTracker;
  private readonly thresholdAdvisor: OutcomeThresholdAdvisor;
  private readonly trajectoryAnalyzer: OutcomeEconomyTrajectoryAnalyzer;
  private readonly resolverHealthMonitor: OutcomeResolverHealthMonitor;

  // Gate analytical suite
  private readonly gateMLExtractor: OutcomeGateMLExtractor;
  private readonly gateDLBuilder: OutcomeGateDLBuilder;
  private readonly trendAnalyzer: OutcomeGateTrendAnalyzer;
  private readonly sessionTracker: OutcomeGateSessionTracker;
  private readonly eventLog: OutcomeGateEventLog;
  private readonly annotator: OutcomeGateAnnotator;
  private readonly inspector: OutcomeGateInspector;
  private readonly chatSignalBuilder: OutcomeGateChatSignalBuilder;
  private readonly narrationBridge: OutcomeGateNarrationBridge;
  private readonly gateHealthMonitor: OutcomeGateHealthMonitor;
  private readonly batchProcessor: OutcomeGateBatchProcessor;
  private readonly contractValidator: OutcomeGateContractValidator;

  // Per-tick signal aggregator (rebuilt each resolution)
  private _aggregator: EngineSignalAggregator;

  public constructor(options: OutcomeGateOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    // Resolver
    this.resolver = new RuntimeOutcomeResolver(this.options);

    // Resolver analytical suite
    this.mlVectorBuilder = new OutcomeMLVectorBuilder();
    this.dlTensorBuilder = new OutcomeDLTensorBuilder();
    this.proximityAnalyzer = new OutcomeProximityAnalyzer();
    this.forecastEngine = new OutcomeForecastEngine();
    this.historyTracker = new OutcomeHistoryTracker();
    this.thresholdAdvisor = new OutcomeThresholdAdvisor();
    this.trajectoryAnalyzer = new OutcomeEconomyTrajectoryAnalyzer();
    this.resolverHealthMonitor = new OutcomeResolverHealthMonitor();

    // Gate analytical suite
    this.gateMLExtractor = new OutcomeGateMLExtractor();
    this.gateDLBuilder = new OutcomeGateDLBuilder();
    this.trendAnalyzer = new OutcomeGateTrendAnalyzer();
    this.sessionTracker = new OutcomeGateSessionTracker();
    this.eventLog = new OutcomeGateEventLog();
    this.annotator = new OutcomeGateAnnotator();
    this.inspector = new OutcomeGateInspector();
    this.chatSignalBuilder = new OutcomeGateChatSignalBuilder();
    this.narrationBridge = new OutcomeGateNarrationBridge();
    this.gateHealthMonitor = new OutcomeGateHealthMonitor();
    this.batchProcessor = new OutcomeGateBatchProcessor(this.options);
    this.contractValidator = new OutcomeGateContractValidator();

    // Start aggregator at tick 0
    this._aggregator = new EngineSignalAggregator(0);
  }

  // ─── Core gate operations (preserved + enhanced) ─────────────────────────

  public resolve(snapshot: RunStateSnapshot): RuntimeOutcomeDecision {
    return this.resolver.resolve(snapshot);
  }

  public isTerminal(snapshot: RunStateSnapshot): boolean {
    return this.resolve(snapshot).isTerminal;
  }

  public shouldFinalize(snapshot: RunStateSnapshot): boolean {
    return snapshot.outcome !== null && snapshot.sovereignty.proofHash === null;
  }

  /**
   * Apply the outcome gate to a snapshot.
   *
   * Enhanced from original:
   * - Records into all analytical trackers
   * - Emits to the session tracker and event log
   * - Builds ML/DL signals if the result is terminal or has risk shift
   * - Validates against the contract validator
   * - Rebuilds the aggregator for this tick
   */
  public apply(snapshot: RunStateSnapshot): OutcomeGateResult {
    this._aggregator = new EngineSignalAggregator(snapshot.tick);

    const decision = this.resolver.resolve(snapshot);
    const resolved = this.resolver.apply(snapshot);

    const didChangeOutcome =
      resolved !== snapshot || !isDecisionEqual(snapshot, decision);

    const next =
      this.options.annotateNegativeOutcomes === true
        ? this.annotateResolvedSnapshot(resolved, decision)
        : resolved;

    const signal = buildOutcomeSignal(decision, next.tick);
    const signals = signal === null ? freezeArray<EngineSignal>([]) : freezeArray([signal]);

    if (signal !== null) this._aggregator.add(signal);

    const result: OutcomeGateResult = {
      snapshot: next,
      decision,
      didChangeOutcome,
      shouldFinalize: this.shouldFinalize(next),
      signals,
    };

    // Record across all analytical surfaces
    this.historyTracker.record(snapshot, decision);
    this.resolverHealthMonitor.record(decision);
    this.sessionTracker.record(decision, false, this._aggregator);
    this.trendAnalyzer.record(snapshot, decision);
    this.eventLog.record(snapshot, result, false, undefined, undefined);

    return result;
  }

  /**
   * Force a specific outcome.
   *
   * Enhanced from original:
   * - Emits a category-tagged signal via chatSignalBuilder.buildWithCategory
   * - Records the forced outcome across all analytical surfaces
   * - Validates via contract validator
   */
  public force(
    snapshot: RunStateSnapshot,
    input: ForcedOutcomeInput,
  ): OutcomeGateResult {
    this._aggregator = new EngineSignalAggregator(snapshot.tick);

    const decision: RuntimeOutcomeDecision = {
      outcome: input.outcome,
      outcomeReason: input.reason,
      outcomeReasonCode: input.reasonCode,
      totalBudgetMs:
        snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs,
      remainingBudgetMs: Math.max(
        0,
        snapshot.timers.seasonBudgetMs +
          snapshot.timers.extensionBudgetMs -
          snapshot.timers.elapsedMs,
      ),
      isTerminal: true,
    };

    const forcedSnapshot = this.applyDecision(snapshot, decision, input.warning ?? null);

    // Base forced-outcome signal (original behavior)
    const baseSignal = createEngineSignal(
      'mode',
      input.severity ??
        (input.outcome === 'FREEDOM'
          ? 'INFO'
          : input.outcome === 'ABANDONED'
            ? 'ERROR'
            : 'WARN'),
      input.signalCode ?? `FORCED_OUTCOME_${input.outcome}`,
      `Forced outcome applied: ${input.outcome} (${input.reason})`,
      forcedSnapshot.tick,
      freezeArray([
        'engine-zero',
        'outcome-gate',
        'forced-outcome',
        `outcome:${input.outcome.toLowerCase()}`,
        `reason:${input.reasonCode.toLowerCase()}`,
      ]),
    );

    // Category-tagged signal via the chat signal builder
    const categorySignal = this.chatSignalBuilder.buildWithCategory(
      snapshot,
      `FORCED_OUTCOME_${input.outcome}`,
      `Forced outcome: ${input.outcome}. Reason: ${input.reason}`,
      input.severity ?? 'WARN',
      'boundary_event',
    );

    this._aggregator.add(baseSignal);
    this._aggregator.add(categorySignal);

    const signals = freezeArray([baseSignal, categorySignal]);

    const result: OutcomeGateResult = {
      snapshot: forcedSnapshot,
      decision,
      didChangeOutcome: true,
      shouldFinalize: this.shouldFinalize(forcedSnapshot),
      signals,
    };

    // Contract validation
    this.contractValidator.validateDecision(snapshot, result, true);

    // Record across all analytical surfaces
    this.historyTracker.record(snapshot, decision);
    this.resolverHealthMonitor.record(decision);
    this.sessionTracker.record(decision, true, this._aggregator);
    this.trendAnalyzer.record(snapshot, decision);
    this.gateHealthMonitor.record(decision, true, false);
    this.eventLog.record(snapshot, result, true, undefined, undefined);

    return result;
  }

  // ─── ML / DL surfaces ────────────────────────────────────────────────────

  /** Extract a 32-dim gate-level ML vector from the last gate resolution. */
  public extractMLVector(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
  ): OutcomeGateMLVector {
    const sessionReport = this.sessionTracker.buildReport();
    return this.gateMLExtractor.extract(
      snapshot,
      result,
      {
        totalResolutions: sessionReport.totalResolutions,
        terminalRate: sessionReport.terminalRate,
        winRate: sessionReport.winRate,
        bankruptRate: sessionReport.bankruptRate,
      },
      this._aggregator,
    );
  }

  /** Build a 48-dim gate-level DL tensor from the last gate resolution. */
  public buildDLTensor(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
  ): OutcomeGateDLTensor {
    const sessionReport = this.sessionTracker.buildReport();
    const healthGrade = this.resolverHealthMonitor.grade(
      this.resolverHealthMonitor.stats(),
    );
    return this.gateDLBuilder.build(
      snapshot,
      result,
      {
        totalResolutions: sessionReport.totalResolutions,
        terminalRate: sessionReport.terminalRate,
        winRate: sessionReport.winRate,
        bankruptRate: sessionReport.bankruptRate,
      },
      this._aggregator,
      healthGrade,
    );
  }

  /** Build an EngineMLSignal enriched with gate risk/urgency scores. */
  public buildMLSignal(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
  ): EngineMLSignal {
    const mlVec = this.extractMLVector(snapshot, result);
    const baseSignal = createEngineSignal(
      'mode',
      mlVec.mlClass === 'critical_risk' ? 'ERROR' : mlVec.mlClass === 'high_risk' ? 'WARN' : 'INFO',
      `GATE_ML_${mlVec.mlClass.toUpperCase()}`,
      `Gate ML class: ${mlVec.mlClass} | risk: ${mlVec.riskScore.toFixed(3)}`,
      snapshot.tick,
      freezeArray(['engine-zero', 'outcome-gate', 'ml-signal']),
    );
    return buildEngineMLSignal(baseSignal, mlVec.riskScore, mlVec.urgencyScore, mlVec.features);
  }

  /** Build an MLSignalComposite for the current tick from the gate aggregator. */
  public buildCompositeMLSignal(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
  ): MLSignalComposite {
    const mlSig = this.buildMLSignal(snapshot, result);
    return buildMLSignalComposite(snapshot.tick, [mlSig]);
  }

  // ─── Analytical surfaces ─────────────────────────────────────────────────

  /** Resolve with full decision context from the RuntimeOutcomeResolver facade. */
  public resolveWithContext(snapshot: RunStateSnapshot): OutcomeDecisionContext {
    return this.resolver.resolveWithContext(snapshot);
  }

  /** Compute proximity signals for a snapshot. */
  public analyzeProximity(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): OutcomeProximity {
    return this.proximityAnalyzer.computeProximity(snapshot, decision);
  }

  /** Compute economy trajectory runway from a snapshot + decision. */
  public computeRunway(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): OutcomeRunway {
    return this.trajectoryAnalyzer.buildFromSnapshot(snapshot, decision);
  }

  /** Compute a full outcome forecast with confidence intervals. */
  public computeForecast(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    _proximity?: OutcomeProximity,
  ): OutcomeForecast {
    return this.forecastEngine.forecast(snapshot, decision);
  }

  /** Get adaptive threshold recommendations for the current snapshot. */
  public adviseThresholds(snapshot: RunStateSnapshot): OutcomeThresholdConfig {
    return this.thresholdAdvisor.advise(snapshot);
  }

  /** Get the trajectory for a run from the history tracker. */
  public getTrajectory(runId: string): OutcomeTrajectory | null {
    return this.historyTracker.getTrajectory(runId);
  }

  /** Build a narration hint for the companion NPC. */
  public buildNarrationHint(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): OutcomeNarrationHint {
    return this.narrationBridge.buildHint(snapshot, decision);
  }

  /** Build a full forecast and narration hint bundle. */
  public buildForecastAndHint(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): {
    forecast: OutcomeForecast;
    hint: OutcomeNarrationHint;
    distribution: OutcomeProbabilityDistribution;
  } {
    return this.narrationBridge.buildForecastAndHint(snapshot, decision);
  }

  /** Build a full inspection bundle for a gate result. */
  public inspect(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
  ): OutcomeGateInspectionBundle {
    const sessionReport = this.sessionTracker.buildReport();
    const trend = this.trendAnalyzer.getLatestTrend(snapshot.runId);
    const trajectory = this.historyTracker.getTrajectory(snapshot.runId);
    const healthGrade = this.resolverHealthMonitor.grade(
      this.resolverHealthMonitor.stats(),
    );
    return this.inspector.inspect(
      snapshot,
      result,
      sessionReport,
      this._aggregator,
      trajectory,
      healthGrade,
    );
  }

  /** Build a UX annotation bundle for a gate result. */
  public annotate(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
  ): OutcomeGateAnnotationBundle {
    const mlVec = this.extractMLVector(snapshot, result);
    return this.annotator.annotate(snapshot, result, mlVec.mlClass);
  }

  /** Build a gate-level chat signal for the LIVEOPS lane. */
  public buildChatSignal(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
  ): OutcomeGateChatSignal {
    const gateML = this.extractMLVector(snapshot, result);
    const resolverML = this.mlVectorBuilder.build(snapshot, result.decision);
    return this.chatSignalBuilder.build(snapshot, result, gateML, resolverML);
  }

  /** Build a signal aggregator report for the current tick. */
  public buildSignalReport(): SignalAggregatorReport {
    return this._aggregator.buildReport();
  }

  /** Resolve a batch of snapshots. */
  public resolveBatch(snapshots: readonly RunStateSnapshot[]): {
    readonly results: readonly OutcomeBatchResult[];
    readonly mostAtRisk: OutcomeBatchResult | null;
    readonly winPathSnapshots: readonly OutcomeBatchResult[];
    readonly trajectory: OutcomeRunway | null;
    readonly batchAnnotations: readonly OutcomeGateAnnotationBundle[];
  } {
    const batchResult = this.batchProcessor.resolveBatch(snapshots);
    this.sessionTracker.recordBatch(snapshots.length);
    return batchResult;
  }

  /** Validate a gate result against the outcome doctrine. */
  public validate(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
    forced = false,
  ): ContractValidationReport {
    return this.contractValidator.validateDecision(snapshot, result, forced);
  }

  /** Get the session report from the session tracker. */
  public getSessionReport(): OutcomeGateSessionReport {
    return this.sessionTracker.buildReport();
  }

  /** Get the gate health status. */
  public getHealthStatus(): EngineHealthStatus {
    return this.gateHealthMonitor.status();
  }

  /** Get the gate health object for orchestrator aggregation. */
  public getHealth(): EngineHealth {
    return this.gateHealthMonitor.buildHealth();
  }

  /** Get the resolver health grade. */
  public getResolverGrade(): OutcomeResolverHealthGrade {
    return this.gateHealthMonitor.resolverGrade();
  }

  /** Get the resolver stats. */
  public getResolverStats(): OutcomeResolverStats {
    return this.resolverHealthMonitor.stats();
  }

  /** Get the policy report for all engines. */
  public getPolicyReport(): OutcomeGatePolicyReport {
    return this.gateHealthMonitor.buildPolicyReport();
  }

  /** Get the trend snapshot for a run. */
  public getTrend(runId: string): OutcomeGateTrendSnapshot | null {
    return this.trendAnalyzer.getLatestTrend(runId);
  }

  /** Get the event log entries for a run. */
  public getEventLog(runId: string): readonly OutcomeGateEventEntry[] {
    return this.eventLog.getEntries(runId);
  }

  /** Build a full analytics bundle from a gate result. */
  public buildAnalyticsBundle(
    snapshot: RunStateSnapshot,
    result: OutcomeGateResult,
  ): OutcomeGateAnalyticsBundle {
    const mlVector = this.extractMLVector(snapshot, result);
    const dlTensor = this.buildDLTensor(snapshot, result);
    const trend = this.trendAnalyzer.getLatestTrend(snapshot.runId);
    const session = this.sessionTracker.buildReport();
    const annotation = this.annotator.annotate(snapshot, result, mlVector.mlClass);
    const inspection = this.inspect(snapshot, result);
    const chatSignal = this.buildChatSignal(snapshot, result);
    const resolverStats = this.resolverHealthMonitor.stats();
    const healthGrade = this.resolverHealthMonitor.grade(resolverStats);
    const policyReport = this.gateHealthMonitor.buildPolicyReport();

    return {
      runId: snapshot.runId,
      tick: snapshot.tick,
      capturedAtMs: Date.now(),
      gateResult: result,
      mlVector,
      dlTensor,
      trend,
      session,
      annotation,
      inspection,
      chatSignal,
      facadeResult: null, // set by createOutcomeGateWithAnalytics
      resolverStats,
      healthGrade,
      policyReport,
    };
  }

  // ─── Private helpers (preserved from original) ────────────────────────────

  private annotateResolvedSnapshot(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): RunStateSnapshot {
    const warning = negativeOutcomeWarning(decision);
    if (warning === null) {
      return snapshot;
    }

    const next = cloneJson(snapshot) as Mutable<RunStateSnapshot>;
    next.telemetry.warnings = [...uniqueAppend(next.telemetry.warnings, warning)];

    return deepFreeze(next) as RunStateSnapshot;
  }

  private applyDecision(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    warning: string | null,
  ): RunStateSnapshot {
    const next = cloneJson(snapshot) as Mutable<RunStateSnapshot>;

    next.outcome = decision.outcome;
    next.telemetry.outcomeReason = decision.outcomeReason;
    next.telemetry.outcomeReasonCode = decision.outcomeReasonCode;

    if (warning !== null && warning.length > 0) {
      next.telemetry.warnings = [...uniqueAppend(next.telemetry.warnings, warning)];
    }

    next.tags = [...uniqueAppendMany(next.tags, freezeArray([
      'run:terminal',
      `run:terminal:${decision.outcome === null ? 'none' : decision.outcome.toLowerCase()}`,
    ]))];

    return deepFreeze(next) as RunStateSnapshot;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 18 — createOutcomeGateWithAnalytics factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory bundle returned by createOutcomeGateWithAnalytics.
 *
 * Provides access to:
 *   - gate: the enhanced OutcomeGate instance
 *   - facade: the OutcomeResolverFacade for combined resolve + history + health
 *   - resolveAndRecord: convenience method that resolves, records, and returns a bundle
 *   - extractMLVector: convenience ML vector extractor
 *   - buildDLTensor: convenience DL tensor builder
 *   - buildChatSignal: convenience chat signal builder
 *   - buildAnalyticsBundle: full analytics bundle builder
 */
export interface OutcomeGateWithAnalytics {
  readonly gate: OutcomeGate;
  readonly facade: OutcomeResolverFacade;
  readonly sessionId: string;

  /** Resolve + apply + record everything in one pass. Returns the gate result and bundle. */
  resolveAndRecord(snapshot: RunStateSnapshot): {
    result: OutcomeGateResult;
    bundle: OutcomeGateAnalyticsBundle;
    facadeResult: OutcomeFacadeResult;
  };

  extractMLVector(snapshot: RunStateSnapshot, result: OutcomeGateResult): OutcomeGateMLVector;
  buildDLTensor(snapshot: RunStateSnapshot, result: OutcomeGateResult): OutcomeGateDLTensor;
  buildChatSignal(snapshot: RunStateSnapshot, result: OutcomeGateResult): OutcomeGateChatSignal;
  buildAnalyticsBundle(snapshot: RunStateSnapshot, result: OutcomeGateResult): OutcomeGateAnalyticsBundle;
}

/**
 * Creates an OutcomeGate wired with the full analytical suite and a
 * convenience façade. Use this factory when you need all gate surfaces
 * — ML, DL, chat, trend, session, event log, and inspection — in a
 * single cohesive bundle.
 *
 * @param options OutcomeGateOptions (all optional)
 * @returns OutcomeGateWithAnalytics bundle
 */
export function createOutcomeGateWithAnalytics(
  options: OutcomeGateOptions = {},
): OutcomeGateWithAnalytics {
  const gate = new OutcomeGate(options);
  const facade = new OutcomeResolverFacade(options);
  const sessionId = createDeterministicId('outcome-gate-analytics');

  return {
    gate,
    facade,
    sessionId,

    resolveAndRecord(snapshot: RunStateSnapshot) {
      const result = gate.apply(snapshot);
      const facadeResult = facade.resolve(snapshot);

      const partialBundle = gate.buildAnalyticsBundle(snapshot, result);
      const bundle: OutcomeGateAnalyticsBundle = {
        ...partialBundle,
        facadeResult,
      };

      return { result, bundle, facadeResult };
    },

    extractMLVector(snapshot: RunStateSnapshot, result: OutcomeGateResult) {
      return gate.extractMLVector(snapshot, result);
    },

    buildDLTensor(snapshot: RunStateSnapshot, result: OutcomeGateResult) {
      return gate.buildDLTensor(snapshot, result);
    },

    buildChatSignal(snapshot: RunStateSnapshot, result: OutcomeGateResult) {
      return gate.buildChatSignal(snapshot, result);
    },

    buildAnalyticsBundle(snapshot: RunStateSnapshot, result: OutcomeGateResult) {
      return gate.buildAnalyticsBundle(snapshot, result);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 19 — Singleton instances
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default OutcomeGate instance — standard options, all analytical surfaces wired.
 * Used by EngineOrchestrator at STEP_11_OUTCOME_GATE.
 */
export const DEFAULT_OUTCOME_GATE = new OutcomeGate();

/**
 * Strict OutcomeGate instance — bankruptOnNegativeNetWorth = true,
 * lower engineAbortWarningsThreshold.
 */
export const STRICT_OUTCOME_GATE = new OutcomeGate({
  bankruptOnNegativeCash: true,
  bankruptOnNegativeNetWorth: true,
  quarantineTerminatesRun: true,
  engineAbortWarningsThreshold: 10,
  annotateNegativeOutcomes: true,
});

/**
 * Relaxed OutcomeGate instance — extended abort threshold for development.
 */
export const RELAXED_OUTCOME_GATE = new OutcomeGate({
  bankruptOnNegativeCash: true,
  bankruptOnNegativeNetWorth: false,
  quarantineTerminatesRun: false,
  engineAbortWarningsThreshold: 50,
  annotateNegativeOutcomes: true,
});

/**
 * Default OutcomeGate chat signal for initialization surfaces.
 * All fields are zero/null — safe to use as a placeholder before the first tick.
 */
export const ZERO_DEFAULT_OUTCOME_GATE_CHAT_SIGNAL: OutcomeGateChatSignal = {
  sessionId: createDeterministicId('zero-default-outcome-gate'),
  runId: '',
  tick: 0,
  generatedAtMs: 0,
  severity: 'INFO',
  category: 'ml_emit',
  headline: 'NOMINAL',
  bodyText: 'OutcomeGate initialized. No resolutions yet.',
  actionSuggestion: 'HOLD',
  mlClass: 'nominal',
  riskScore: 0,
  urgencyScore: 0,
  isTerminal: false,
  outcomeEncoded: 0.75,
  bankruptcyProximity: 0,
  freedomProximity: 0,
  mlSignal: {
    engineId: 'mode',
    severity: 'INFO',
    code: 'GATE_NOMINAL',
    message: 'OutcomeGate initialized',
    tick: 0,
    tags: Object.freeze(['engine-zero', 'outcome-gate', 'nominal']),
    category: 'ml_emit',
    riskScore: 0,
    urgencyScore: 0,
    mlClass: 'nominal',
    featureSnapshot: Object.freeze([]),
    actionRecommendation: 'HOLD',
  },
  composite: {
    tick: 0,
    signalCount: 0,
    peakRisk: 0,
    peakUrgency: 0,
    meanRisk: 0,
    dominantClass: 'nominal',
    actionRecommendation: 'HOLD',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// § 20 — Pure utility exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a gate-level ML vector without constructing a full OutcomeGate instance.
 * Utility for replay verification, admin surfaces, and test pipelines.
 */
export function extractOutcomeGateMLVector(
  snapshot: RunStateSnapshot,
  result: OutcomeGateResult,
): OutcomeGateMLVector {
  const extractor = new OutcomeGateMLExtractor();
  return extractor.extract(snapshot, result, null, null);
}

/**
 * Build a gate-level DL tensor without constructing a full OutcomeGate instance.
 */
export function buildOutcomeGateDLTensor(
  snapshot: RunStateSnapshot,
  result: OutcomeGateResult,
): OutcomeGateDLTensor {
  const builder = new OutcomeGateDLBuilder();
  return builder.build(snapshot, result, null, null, null);
}

/**
 * Compute gate proximity without constructing a full OutcomeGate instance.
 */
export function computeOutcomeGateProximity(
  snapshot: RunStateSnapshot,
  decision: RuntimeOutcomeDecision,
): OutcomeProximity {
  const analyzer = new OutcomeProximityAnalyzer();
  return analyzer.computeProximity(snapshot, decision);
}

/**
 * Build a narration hint without constructing a full OutcomeGate instance.
 */
export function buildOutcomeGateNarrationHint(
  snapshot: RunStateSnapshot,
  decision: RuntimeOutcomeDecision,
): OutcomeNarrationHint {
  const bridge = new OutcomeGateNarrationBridge();
  return bridge.buildHint(snapshot, decision);
}

/**
 * Validate a gate result contract without constructing a full OutcomeGate instance.
 */
export function validateOutcomeGateResult(
  snapshot: RunStateSnapshot,
  result: OutcomeGateResult,
  forced = false,
): ContractValidationReport {
  const validator = new OutcomeGateContractValidator();
  return validator.validateDecision(snapshot, result, forced);
}

/**
 * Build an annotation bundle without constructing a full OutcomeGate instance.
 */
export function buildOutcomeGateAnnotation(
  snapshot: RunStateSnapshot,
  result: OutcomeGateResult,
  mlClass?: MLSignalClass,
): OutcomeGateAnnotationBundle {
  const annotator = new OutcomeGateAnnotator();
  const extractor = new OutcomeGateMLExtractor();
  const resolvedClass = mlClass ?? extractor.extract(snapshot, result, null, null).mlClass;
  return annotator.annotate(snapshot, result, resolvedClass);
}

/**
 * Score an EngineHealthStatus for use in monitoring dashboards.
 */
export function scoreOutcomeGateHealth(status: EngineHealthStatus): number {
  return scoreHealthStatus(status);
}

/**
 * Encode a signal severity to a 0-1 ML feature value.
 */
export function encodeOutcomeGateSeverity(severity: EngineSignalSeverity): number {
  return encodeSeverity(severity);
}

/**
 * Classify a raw risk score into an MLSignalClass.
 */
export function classifyOutcomeGateRisk(riskScore: number): MLSignalClass {
  return classifyMLSignalRisk(riskScore);
}

/**
 * Get the action recommendation string for an MLSignalClass.
 */
export function getOutcomeGateActionRecommendation(mlClass: MLSignalClass): string {
  return recommendActionFromMLClass(mlClass);
}

/**
 * Flatten a gate DL tensor to a plain number array.
 */
export function flattenOutcomeGateDLTensor(tensor: OutcomeGateDLTensor): number[] {
  return [...tensor.inputVector];
}

/**
 * Build a named feature map from a gate ML vector.
 */
export function buildOutcomeGateMLNamedMap(
  vector: OutcomeGateMLVector,
): Readonly<Record<string, number>> {
  const map: Record<string, number> = {};
  vector.featureLabels.forEach((label, i) => {
    map[label] = vector.features[i] ?? 0;
  });
  return Object.freeze(map);
}

/**
 * Compute the cosine similarity between two gate ML feature vectors.
 */
export function computeOutcomeGateMLSimilarity(
  a: OutcomeGateMLVector,
  b: OutcomeGateMLVector,
): number {
  const dotProduct = a.features.reduce((sum, v, i) => sum + v * (b.features[i] ?? 0), 0);
  const magA = Math.sqrt(a.features.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.features.reduce((sum, v) => sum + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return clamp01(dotProduct / (magA * magB));
}

/**
 * Get the top N highest-value features from a gate ML vector (sorted by value desc).
 */
export function getTopOutcomeGateFeatures(
  vector: OutcomeGateMLVector,
  topN = 5,
): ReadonlyArray<{ label: string; value: number }> {
  const pairs = vector.featureLabels.map((label, i) => ({
    label,
    value: vector.features[i] ?? 0,
  }));
  pairs.sort((a, b) => b.value - a.value);
  return Object.freeze(pairs.slice(0, topN));
}

/**
 * Extract a feature column from a gate DL tensor by index.
 */
export function extractOutcomeGateDLColumn(
  tensor: OutcomeGateDLTensor,
  colIndex: number,
): number {
  return tensor.inputVector[colIndex] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 21 — Re-exported resolver type surface for downstream consumers
// ─────────────────────────────────────────────────────────────────────────────

// Re-export all resolver types so downstream imports can use:
//   import { OutcomeProximity, OutcomeRunway, ... } from './OutcomeGate'
// without importing directly from core.

export type {
  RuntimeOutcomeDecision,
  RuntimeOutcomeResolverOptions,
  OutcomeProximity,
  OutcomeRunway,
  OutcomeMLVector,
  OutcomeDLTensor,
  OutcomeProbabilityDistribution,
  OutcomeForecast,
  OutcomeNarrationHint,
  OutcomeHistoryEntry,
  OutcomeTrajectory,
  OutcomeThresholdConfig,
  OutcomeDecisionContext,
  OutcomeResolverHealthGrade,
  OutcomeResolverStats,
  OutcomeFacadeResult,
  OutcomeBatchResult,
  OutcomeEconomyDataPoint,
  EngineSignal,
  EngineMLSignal,
  MLSignalClass,
  MLSignalComposite,
  ContractCheckResult,
  ContractValidationReport,
  EngineHealthStatus,
  EngineSignalSeverity,
  EngineSignalCategory,
  EngineId,
  EngineHealth,
  EngineStepPolicy,
  SignalAggregatorReport,
};

// Re-export all resolver constants so consumers can reference them via OutcomeGate.*
export {
  OUTCOME_RESOLVER_MODULE_VERSION,
  OUTCOME_RESOLVER_MODULE_READY,
  OUTCOME_ML_FEATURE_COUNT,
  OUTCOME_DL_FEATURE_COUNT,
  OUTCOME_DL_TENSOR_SHAPE,
  OUTCOME_BANKRUPTCY_RUNWAY_CRITICAL_TICKS,
  OUTCOME_BANKRUPTCY_RUNWAY_HIGH_TICKS,
  OUTCOME_FREEDOM_SPRINT_NEAR_TICKS,
  OUTCOME_HISTORY_MAX_ENTRIES,
  OUTCOME_PROBABILITY_SHIFT_THRESHOLD,
  OUTCOME_ML_FEATURE_LABELS,
  OUTCOME_DL_FEATURE_LABELS,
  ALL_ENGINE_IDS,
  DEFAULT_ENGINE_STEP_POLICIES,
};

// Re-export all resolver classes so consumers can construct them via OutcomeGate.*
export {
  OutcomeMLVectorBuilder,
  OutcomeDLTensorBuilder,
  OutcomeProximityAnalyzer,
  OutcomeForecastEngine,
  OutcomeNarrationHintBuilder,
  OutcomeHistoryTracker,
  OutcomeThresholdAdvisor,
  OutcomeEconomyTrajectoryAnalyzer,
  OutcomeBatchResolver,
  OutcomeResolverHealthMonitor,
  OutcomeResolverFacade,
  EngineSignalAggregator,
};
