// backend/src/game/engine/chat/adapters/TickPlanSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/TickPlanSignalAdapter.ts
 *
 * Translates TickPlan signals from the Zero layer into
 * backend chat lane LIVEOPS_SIGNAL envelopes.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * Prevents circular dependency: chat/ → zero/ → chat/.
 *
 * Tick plan signals enter the chat lane whenever the plan is built, validated,
 * compared, snapshotted, or rebuilt. They carry:
 *   - operation kind (PLAN / VALIDATE / COMPARE / SNAPSHOT / REBUILD / NOOP)
 *   - severity (LOW / MEDIUM / HIGH / CRITICAL)
 *   - health score (ML-derived [0,1])
 *   - per-step DL tensor for 13-step tick profile
 *   - 32-dim ML feature vector for real-time inference
 *   - narration phrase and urgency label for companion routing
 *   - run/tick context for downstream routing
 *
 * Chat doctrine:
 *   - LOW      → plan nominal, companion advisory optional
 *   - MEDIUM   → some steps disabled, companion coaching fires
 *   - HIGH     → critical step coverage missing, companion escalates
 *   - CRITICAL → plan integrity at risk, rescue + max heat fires
 *
 * Adapter modes:
 *   DEFAULT  — emits for MEDIUM/HIGH/CRITICAL only
 *   STRICT   — emits only for HIGH/CRITICAL
 *   VERBOSE  — emits for all plan operations including LOW; full ML vector
 *
 * Singletons:
 *   TICK_PLAN_DEFAULT_SIGNAL_ADAPTER
 *   TICK_PLAN_STRICT_SIGNAL_ADAPTER
 *   TICK_PLAN_VERBOSE_SIGNAL_ADAPTER
 *   TICK_PLAN_SIGNAL_ADAPTER_MANIFEST
 */

import {
  clamp01,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type JsonValue,
  type Nullable,
  type Score01,
  type UnixMs,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURAL COMPAT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Structural compat for TickPlanSeverity. */
export type TickPlanSignalAdapterSeverityCompat = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Structural compat for TickPlanOperationKind. */
export type TickPlanSignalAdapterOperationKindCompat =
  | 'PLAN'
  | 'VALIDATE'
  | 'COMPARE'
  | 'SNAPSHOT'
  | 'REBUILD'
  | 'NOOP';

/** Structural compat for TickPlanModeCode. */
type TickPlanModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Structural compat for TickPlanPressureTier. */
type TickPlanPressureTierCompat = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

/** Structural compat for TickPlanRunPhase. */
type TickPlanRunPhaseCompat = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

/** Structural compat for TickPlanRunOutcome. */
type TickPlanRunOutcomeCompat = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

/** Structural compat for TickStep. */
type TickStepCompat =
  | 'STEP_01_PREPARE'
  | 'STEP_02_TIME'
  | 'STEP_03_PRESSURE'
  | 'STEP_04_TENSION'
  | 'STEP_05_BATTLE'
  | 'STEP_06_SHIELD'
  | 'STEP_07_CASCADE'
  | 'STEP_08_MODE_POST'
  | 'STEP_09_TELEMETRY'
  | 'STEP_10_SOVEREIGNTY_SNAPSHOT'
  | 'STEP_11_OUTCOME_GATE'
  | 'STEP_12_EVENT_SEAL'
  | 'STEP_13_FLUSH';

/** Structural compat for TickPlanMLVector (32 fields). */
export interface TickPlanMLVectorCompat {
  readonly enabledRatio: number;
  readonly disabledRatio: number;
  readonly criticalStepsEnabledRatio: number;
  readonly boundaryStepsEnabledRatio: number;
  readonly enginePhaseRatio: number;
  readonly orchestrationPhaseRatio: number;
  readonly modePhaseRatio: number;
  readonly observabilityPhaseRatio: number;
  readonly finalizationPhaseRatio: number;
  readonly engineStepsEnabledCount: number;
  readonly sealEligibleRatio: number;
  readonly collectSignalRatio: number;
  readonly collectDiagnosticsRatio: number;
  readonly flushStepEnabled: number;
  readonly sealStepEnabled: number;
  readonly outcomeGateEnabled: number;
  readonly prepareStepEnabled: number;
  readonly modeNormalized: number;
  readonly pressureTierNormalized: number;
  readonly runPhaseNormalized: number;
  readonly firstEnabledOrdinalNormalized: number;
  readonly lastEnabledOrdinalNormalized: number;
  readonly enabledWindowSpan: number;
  readonly disabledGapCount: number;
  readonly requiresSealBeforeFlush: number;
  readonly flushAtFinalStepOnly: number;
  readonly hasDisabledCritical: number;
  readonly isFullyEnabled: number;
  readonly isCanonicalSize: number;
  readonly lifecycleStateEncoded: number;
  readonly terminalOutcomeEncoded: number;
  readonly validationScore: number;
}

/** Structural compat for TickPlanDLTensorRow (8 fields). */
export interface TickPlanDLTensorRowCompat {
  readonly step: string;
  readonly enabled: number;
  readonly criticality: number;
  readonly phaseWeight: number;
  readonly sealEligible: number;
  readonly collectSignals: number;
  readonly collectDiagnostics: number;
  readonly mutatesState: number;
  readonly prerequisiteCount: number;
}

/** Structural compat for TickPlanDLTensor (13 rows). */
export type TickPlanDLTensorCompat = readonly TickPlanDLTensorRowCompat[];

/** Structural compat for TickPlanNarrationHint. */
export interface TickPlanNarrationHintCompat {
  readonly phrase: string;
  readonly urgencyLabel: string;
  readonly heatMultiplier: number;
  readonly companionIntent: string;
  readonly audienceReaction: string;
}

/** Structural compat for TickPlanAnnotationBundle. */
export interface TickPlanAnnotationCompat {
  readonly fingerprint: string;
  readonly severity: TickPlanSignalAdapterSeverityCompat;
  readonly healthScore: number;
  readonly label: string;
  readonly description: string;
  readonly enabledStepCount: number;
  readonly disabledStepCount: number;
  readonly criticalIssues: readonly string[];
  readonly warnings: readonly string[];
  readonly mode: TickPlanModeCodeCompat | null;
  readonly lifecycleState: string | null;
  readonly validationPassed: boolean;
  readonly operationKind: TickPlanSignalAdapterOperationKindCompat;
  readonly emittedAtMs: number;
}

/** Structural compat for TickPlanHealthSnapshot. */
export interface TickPlanHealthSnapshotCompat {
  readonly fingerprint: string;
  readonly healthScore: number;
  readonly severity: TickPlanSignalAdapterSeverityCompat;
  readonly actionRecommendation: string;
  readonly narrationHint: TickPlanNarrationHintCompat;
  readonly enabledCount: number;
  readonly disabledCount: number;
  readonly criticalStepsEnabled: boolean;
  readonly validationPassed: boolean;
  readonly validationErrors: readonly string[];
  readonly validationWarnings: readonly string[];
  readonly mode: TickPlanModeCodeCompat | null;
  readonly lifecycleState: string | null;
}

/** Structural compat for TickPlanRunSummary. */
export interface TickPlanRunSummaryCompat {
  readonly runId: string;
  readonly tick: number;
  readonly fingerprint: string;
  readonly healthScore: number;
  readonly severity: TickPlanSignalAdapterSeverityCompat;
  readonly enabledCount: number;
  readonly disabledCount: number;
  readonly validationPassed: boolean;
  readonly mode: TickPlanModeCodeCompat | null;
  readonly lifecycleState: string | null;
  readonly narrationPhrase: string;
}

/** Structural compat for TickPlanTrendSnapshot. */
export interface TickPlanTrendSnapshotCompat {
  readonly windowSize: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly avgEnabledRatio: number;
  readonly severityCounts: Readonly<Record<TickPlanSignalAdapterSeverityCompat, number>>;
  readonly dominantSeverity: TickPlanSignalAdapterSeverityCompat;
  readonly criticalTrendUp: boolean;
  readonly planFingerprintChanges: number;
}

/** Structural compat for TickPlanSessionReport. */
export interface TickPlanSessionReportCompat {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly planCount: number;
  readonly avgHealthScore: number;
  readonly avgEnabledRatio: number;
  readonly validationFailures: number;
  readonly severityDistribution: Readonly<Record<TickPlanSignalAdapterSeverityCompat, number>>;
  readonly mostFrequentFingerprint: string | null;
  readonly mode: TickPlanModeCodeCompat | null;
}

/** Main structural compat for TickPlanChatSignal. */
export interface TickPlanSignalCompat {
  readonly runId: string;
  readonly tick: number;
  readonly severity: TickPlanSignalAdapterSeverityCompat;
  readonly operationKind: TickPlanSignalAdapterOperationKindCompat;
  readonly healthScore: number;
  readonly enabledRatio: number;
  readonly criticalStepsEnabled: boolean;
  readonly validationPassed: boolean;
  readonly fingerprint: string;
  readonly mode: TickPlanModeCodeCompat | null;
  readonly lifecycleState: string | null;
  readonly narrationHint: string;
  readonly mlVector: TickPlanMLVectorCompat;
  readonly dlTensor: TickPlanDLTensorCompat;
  readonly emittedAtMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_SIGNAL_ADAPTER_VERSION = '1.0.2026' as const;
export const TICK_PLAN_SIGNAL_ADAPTER_READY = true as const;
export const TICK_PLAN_SIGNAL_ADAPTER_SCHEMA = 'tick-plan-signal-adapter-v1' as const;
export const TICK_PLAN_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;
export const TICK_PLAN_SIGNAL_ADAPTER_DL_TENSOR_SHAPE = Object.freeze([13, 8] as const);
export const TICK_PLAN_SIGNAL_ADAPTER_MAX_HEAT = 1.0 as const;
export const TICK_PLAN_SIGNAL_WORLD_EVENT_PREFIX = 'tick_plan' as const;

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER MODE TYPE
// ─────────────────────────────────────────────────────────────────────────────

export type TickPlanAdapterMode = 'DEFAULT' | 'STRICT' | 'VERBOSE';

// ─────────────────────────────────────────────────────────────────────────────
// MANIFEST INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface TickPlanSignalAdapterManifest {
  readonly adapterId: string;
  readonly adapterName: string;
  readonly version: string;
  readonly schema: string;
  readonly mode: TickPlanAdapterMode;
  readonly mlFeatureCount: number;
  readonly dlTensorShape: readonly [number, number];
  readonly emitsOnLow: boolean;
  readonly emitsOnMedium: boolean;
  readonly emitsOnHigh: boolean;
  readonly emitsOnCritical: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD EVENT KEY BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildSignalWorldEvent(
  op: TickPlanSignalAdapterOperationKindCompat,
  sev: TickPlanSignalAdapterSeverityCompat,
): string {
  return `${TICK_PLAN_SIGNAL_WORLD_EVENT_PREFIX}:${op.toLowerCase()}:${sev.toLowerCase()}`;
}

function buildAnnotationWorldEvent(op: TickPlanSignalAdapterOperationKindCompat): string {
  return `${TICK_PLAN_SIGNAL_WORLD_EVENT_PREFIX}:annotation:${op.toLowerCase()}`;
}

function buildNarrationWorldEvent(op: TickPlanSignalAdapterOperationKindCompat): string {
  return `${TICK_PLAN_SIGNAL_WORLD_EVENT_PREFIX}:narration:${op.toLowerCase()}`;
}

function buildHealthWorldEvent(severity: TickPlanSignalAdapterSeverityCompat): string {
  return `${TICK_PLAN_SIGNAL_WORLD_EVENT_PREFIX}:health:${severity.toLowerCase()}`;
}

function buildRunSummaryWorldEvent(runId: string): string {
  return `${TICK_PLAN_SIGNAL_WORLD_EVENT_PREFIX}:run_summary:${runId.slice(0, 8)}`;
}

function buildTrendWorldEvent(dominantSeverity: TickPlanSignalAdapterSeverityCompat): string {
  return `${TICK_PLAN_SIGNAL_WORLD_EVENT_PREFIX}:trend:${dominantSeverity.toLowerCase()}`;
}

function buildSessionWorldEvent(sessionId: string): string {
  return `${TICK_PLAN_SIGNAL_WORLD_EVENT_PREFIX}:session:${sessionId.slice(0, 8)}`;
}

function buildDLTensorWorldEvent(step: TickStepCompat): string {
  return `${TICK_PLAN_SIGNAL_WORLD_EVENT_PREFIX}:dl_tensor:${step.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// HEAT / SEVERITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Converts a TickPlan severity to a normalized chat heat multiplier. */
export function translateTickPlanSeverityToHeat(
  severity: TickPlanSignalAdapterSeverityCompat,
): Score01 {
  switch (severity) {
    case 'LOW':      return 0.05 as Score01;
    case 'MEDIUM':   return 0.38 as Score01;
    case 'HIGH':     return 0.72 as Score01;
    case 'CRITICAL': return 1.0 as Score01;
    default:         return 0.05 as Score01;
  }
}

function shouldEmit(
  severity: TickPlanSignalAdapterSeverityCompat,
  mode: TickPlanAdapterMode,
): boolean {
  if (mode === 'VERBOSE') return true;
  if (mode === 'STRICT') {
    return severity === 'HIGH' || severity === 'CRITICAL';
  }
  // DEFAULT — emit for MEDIUM and above
  return severity !== 'LOW';
}

function operationKindToChatLane(op: TickPlanSignalAdapterOperationKindCompat): string {
  switch (op) {
    case 'PLAN':      return 'LIVEOPS_PLAN';
    case 'VALIDATE':  return 'LIVEOPS_VALIDATE';
    case 'COMPARE':   return 'LIVEOPS_COMPARE';
    case 'SNAPSHOT':  return 'LIVEOPS_SNAPSHOT';
    case 'REBUILD':   return 'LIVEOPS_REBUILD';
    case 'NOOP':      return 'LIVEOPS_NOOP';
    default:          return 'LIVEOPS_SIGNAL';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVEOPS PAYLOAD BUILDER (public helper for external use)
// ─────────────────────────────────────────────────────────────────────────────

/** Builds a structured LIVEOPS payload object for a TickPlanSignalCompat. */
export function buildTickPlanLiveOpsPayload(
  signal: TickPlanSignalCompat,
  roomId: ChatRoomId,
  ts: UnixMs,
  mode: TickPlanAdapterMode,
): {
  readonly worldEventName: string;
  readonly heatMultiplier01: Score01;
  readonly helperBlackout: boolean;
  readonly haterRaidActive: boolean;
} {
  const worldEvent = buildSignalWorldEvent(signal.operationKind, signal.severity);
  const heat = translateTickPlanSeverityToHeat(signal.severity);
  const verbose = mode === 'VERBOSE';
  // helperBlackout when severity is CRITICAL
  const helperBlackout = signal.severity === 'CRITICAL';
  // haterRaidActive when high-severity and plan integrity is at risk
  const haterRaidActive = signal.severity === 'CRITICAL' || signal.severity === 'HIGH';

  void roomId;
  void ts;
  void verbose;

  return Object.freeze({
    worldEventName: worldEvent,
    heatMultiplier01: clamp01(heat) as Score01,
    helperBlackout,
    haterRaidActive,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// METADATA BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildSignalMetadata(
  signal: TickPlanSignalCompat,
  verbose: boolean,
): Record<string, JsonValue> {
  const base: Record<string, JsonValue> = {
    operationKind: signal.operationKind,
    severity: signal.severity,
    healthScore: signal.healthScore,
    tick: signal.tick,
    runId: signal.runId,
    mode: signal.mode ?? 'null',
    lifecycleState: signal.lifecycleState ?? 'null',
    fingerprint: signal.fingerprint,
    enabledRatio: signal.enabledRatio,
    criticalStepsEnabled: signal.criticalStepsEnabled,
    validationPassed: signal.validationPassed,
    narrationHint: signal.narrationHint,
    emittedAtMs: signal.emittedAtMs,
  };

  if (verbose) {
    const mv = signal.mlVector;
    base['ml_enabledRatio'] = mv.enabledRatio;
    base['ml_disabledRatio'] = mv.disabledRatio;
    base['ml_criticalStepsEnabledRatio'] = mv.criticalStepsEnabledRatio;
    base['ml_boundaryStepsEnabledRatio'] = mv.boundaryStepsEnabledRatio;
    base['ml_enginePhaseRatio'] = mv.enginePhaseRatio;
    base['ml_orchestrationPhaseRatio'] = mv.orchestrationPhaseRatio;
    base['ml_modePhaseRatio'] = mv.modePhaseRatio;
    base['ml_observabilityPhaseRatio'] = mv.observabilityPhaseRatio;
    base['ml_finalizationPhaseRatio'] = mv.finalizationPhaseRatio;
    base['ml_engineStepsEnabledCount'] = mv.engineStepsEnabledCount;
    base['ml_sealEligibleRatio'] = mv.sealEligibleRatio;
    base['ml_collectSignalRatio'] = mv.collectSignalRatio;
    base['ml_collectDiagnosticsRatio'] = mv.collectDiagnosticsRatio;
    base['ml_flushStepEnabled'] = mv.flushStepEnabled;
    base['ml_sealStepEnabled'] = mv.sealStepEnabled;
    base['ml_outcomeGateEnabled'] = mv.outcomeGateEnabled;
    base['ml_prepareStepEnabled'] = mv.prepareStepEnabled;
    base['ml_modeNormalized'] = mv.modeNormalized;
    base['ml_pressureTierNormalized'] = mv.pressureTierNormalized;
    base['ml_runPhaseNormalized'] = mv.runPhaseNormalized;
    base['ml_firstEnabledOrdinalNormalized'] = mv.firstEnabledOrdinalNormalized;
    base['ml_lastEnabledOrdinalNormalized'] = mv.lastEnabledOrdinalNormalized;
    base['ml_enabledWindowSpan'] = mv.enabledWindowSpan;
    base['ml_disabledGapCount'] = mv.disabledGapCount;
    base['ml_requiresSealBeforeFlush'] = mv.requiresSealBeforeFlush;
    base['ml_flushAtFinalStepOnly'] = mv.flushAtFinalStepOnly;
    base['ml_hasDisabledCritical'] = mv.hasDisabledCritical;
    base['ml_isFullyEnabled'] = mv.isFullyEnabled;
    base['ml_isCanonicalSize'] = mv.isCanonicalSize;
    base['ml_lifecycleStateEncoded'] = mv.lifecycleStateEncoded;
    base['ml_terminalOutcomeEncoded'] = mv.terminalOutcomeEncoded;
    base['ml_validationScore'] = mv.validationScore;
  }

  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED COMPAT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Structural compat for TickPlanValidationReport. */
export interface TickPlanValidationReportCompat {
  readonly valid: boolean;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly errors: readonly { code: string; message: string }[];
  readonly warnings: readonly { code: string; message: string }[];
  readonly fingerprint: string;
}

/** Structural compat for TickPlanDiffReport. */
export interface TickPlanDiffReportCompat {
  readonly leftFingerprint: string;
  readonly rightFingerprint: string;
  readonly identical: boolean;
  readonly enabledDelta: number;
  readonly disabledDelta: number;
  readonly healthScoreDelta: number;
  readonly leftHealthScore: number;
  readonly rightHealthScore: number;
  readonly leftSeverity: TickPlanSignalAdapterSeverityCompat;
  readonly rightSeverity: TickPlanSignalAdapterSeverityCompat;
  readonly diffScore: number;
  readonly stepsEnabled: readonly string[];
  readonly stepsDisabled: readonly string[];
  readonly stepsModified: readonly string[];
  readonly emittedAtMs: number;
}

/** Structural compat for TickPlanCoverageMatrix (summary shape). */
export interface TickPlanCoverageMatrixCompat {
  readonly overallCoverage: number;
  readonly criticalCoverage: number;
  readonly weakestPhase: string;
  readonly uncoveredCount: number;
}

/** Structural compat for TickPlanExecutionEstimate (summary shape). */
export interface TickPlanExecutionEstimateCompat {
  readonly successProbability: number;
  readonly criticalPathIntact: boolean;
  readonly estimatedOutcome: 'COMPLETE' | 'PARTIAL' | 'DEGRADED' | 'FAILED';
  readonly estimatedDataIntegrity: number;
  readonly bottleneckCount: number;
}

/** Structural compat for raw ML vector (open-ended numeric dictionary). */
export interface TickPlanMLVectorRawCompat {
  readonly enabledRatio: number;
  readonly criticalStepsEnabledRatio: number;
  readonly [key: string]: number | undefined;
}

/** Diagnostics report returned by TickPlanSignalAdapter.diagnostics(). */
export interface TickPlanSignalAdapterDiagnosticsReport {
  readonly adapterId: string;
  readonly mode: TickPlanAdapterMode;
  readonly totalEmitted: number;
  readonly totalSuppressed: number;
  readonly lastEmittedAtMs: number | null;
  readonly suppressionRatio: number;
  readonly emissionsByOperation: Readonly<Record<TickPlanSignalAdapterOperationKindCompat, number>>;
  readonly emissionsBySeverity: Readonly<Record<TickPlanSignalAdapterSeverityCompat, number>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED MODULE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_SIGNAL_ADAPTER_SUPPRESSION_POLICY = Object.freeze({
  DEFAULT: Object.freeze({ LOW: true, MEDIUM: false, HIGH: false, CRITICAL: false } as const),
  STRICT: Object.freeze({ LOW: true, MEDIUM: true, HIGH: false, CRITICAL: false } as const),
  VERBOSE: Object.freeze({ LOW: false, MEDIUM: false, HIGH: false, CRITICAL: false } as const),
} as const);

export const TICK_PLAN_SIGNAL_ADAPTER_HEAT_MAP = Object.freeze({
  LOW: 0.3,
  MEDIUM: 0.6,
  HIGH: 1.0,
  CRITICAL: 1.5,
} as const);

export const TICK_PLAN_WORLD_EVENT_PREFIX = 'tick_plan' as const;

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function classifyAdapterSeverity(healthScore: number): TickPlanSignalAdapterSeverityCompat {
  if (healthScore >= 0.75) return 'LOW';
  if (healthScore >= 0.5) return 'MEDIUM';
  if (healthScore >= 0.25) return 'HIGH';
  return 'CRITICAL';
}

function diffScoreToAdapterSeverity(diffScore: number): TickPlanSignalAdapterSeverityCompat {
  if (diffScore < 0.05) return 'LOW';
  if (diffScore < 0.2) return 'MEDIUM';
  if (diffScore < 0.5) return 'HIGH';
  return 'CRITICAL';
}

function buildWorldEventKey(
  operation: string,
  severity: TickPlanSignalAdapterSeverityCompat,
): string {
  return `${TICK_PLAN_WORLD_EVENT_PREFIX}:${operation}:${severity.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STANDALONE LIVEOPS PAYLOAD BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns partial payload for diff signal. */
export function buildTickPlanDiffLiveOpsPayload(
  diff: TickPlanDiffReportCompat,
  roomId: string,
): Pick<ChatSignalEnvelope, 'type' | 'roomId' | 'liveops'> {
  const severity = diffScoreToAdapterSeverity(diff.diffScore);
  const heat = translateTickPlanSeverityToHeat(severity);
  const worldEvent = buildWorldEventKey('compare', severity);
  return Object.freeze({
    type: 'LIVEOPS' as const,
    roomId: roomId as ChatRoomId,
    liveops: Object.freeze({
      worldEventName: worldEvent,
      heatMultiplier01: clamp01(heat) as Score01,
      helperBlackout: severity === 'CRITICAL',
      haterRaidActive: severity === 'CRITICAL' || severity === 'HIGH',
    }),
  });
}

/** Returns partial payload for coverage signal. */
export function buildTickPlanCoverageLiveOpsPayload(
  matrix: TickPlanCoverageMatrixCompat,
  roomId: string,
): Pick<ChatSignalEnvelope, 'type' | 'roomId' | 'liveops'> {
  const severity = classifyAdapterSeverity(matrix.overallCoverage);
  const heat = translateTickPlanSeverityToHeat(severity);
  const worldEvent = buildWorldEventKey('coverage', severity);
  return Object.freeze({
    type: 'LIVEOPS' as const,
    roomId: roomId as ChatRoomId,
    liveops: Object.freeze({
      worldEventName: worldEvent,
      heatMultiplier01: clamp01(heat) as Score01,
      helperBlackout: severity === 'CRITICAL',
      haterRaidActive: severity === 'CRITICAL',
    }),
  });
}

/** Returns partial payload for validation signal. */
export function buildTickPlanValidationLiveOpsPayload(
  report: TickPlanValidationReportCompat,
  roomId: string,
): Pick<ChatSignalEnvelope, 'type' | 'roomId' | 'liveops'> {
  const healthScore = report.valid ? 1.0 : Math.max(0, 1 - report.errorCount * 0.2);
  const severity = classifyAdapterSeverity(healthScore);
  const heat = translateTickPlanSeverityToHeat(severity);
  const worldEvent = buildWorldEventKey('validation', severity);
  return Object.freeze({
    type: 'LIVEOPS' as const,
    roomId: roomId as ChatRoomId,
    liveops: Object.freeze({
      worldEventName: worldEvent,
      heatMultiplier01: clamp01(heat) as Score01,
      helperBlackout: severity === 'CRITICAL',
      haterRaidActive: report.errorCount > 0,
    }),
  });
}

/** Returns partial payload for execution estimate signal. */
export function buildTickPlanEstimateLiveOpsPayload(
  estimate: TickPlanExecutionEstimateCompat,
  roomId: string,
): Pick<ChatSignalEnvelope, 'type' | 'roomId' | 'liveops'> {
  const severity = classifyAdapterSeverity(estimate.successProbability);
  const heat = translateTickPlanSeverityToHeat(severity);
  const worldEvent = buildWorldEventKey('estimate', severity);
  return Object.freeze({
    type: 'LIVEOPS' as const,
    roomId: roomId as ChatRoomId,
    liveops: Object.freeze({
      worldEventName: worldEvent,
      heatMultiplier01: clamp01(heat) as Score01,
      helperBlackout: severity === 'CRITICAL',
      haterRaidActive: estimate.estimatedOutcome === 'FAILED',
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE ADAPTER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class TickPlanSignalAdapter {
  private readonly _mode: TickPlanAdapterMode;
  private readonly _roomId: ChatRoomId;

  public constructor(options: { mode: TickPlanAdapterMode }) {
    this._mode = options.mode;
    this._roomId = 'liveops' as ChatRoomId;
  }

  // ── primary translate surface ─────────────────────────────────────────────

  /**
   * Translates a TickPlanSignalCompat into a ChatInputEnvelope if the
   * severity meets this adapter's emission threshold.
   */
  public translate(
    signal: TickPlanSignalCompat,
    roomId: string,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(signal.severity, this._mode)) {
      return null;
    }

    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(signal.severity);
    const worldEvent = buildSignalWorldEvent(signal.operationKind, signal.severity);
    const lane = operationKindToChatLane(signal.operationKind);
    const verbose = this._mode === 'VERBOSE';

    const signalMeta: Record<string, JsonValue> = {
      ...buildSignalMetadata(signal, verbose),
      _id: `tick_plan:${signal.runId}:${signal.tick}:${signal.operationKind}:${ts}`,
      _lane: lane,
      _actorId: null,
    };

    const envelope: ChatInputEnvelope = Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: false,
          haterRaidActive: signal.severity === 'CRITICAL',
        }),
        metadata: Object.freeze(signalMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });

    return envelope;
  }

  /**
   * Translates a batch of TickPlanSignalCompat signals, filtering by threshold.
   */
  public translateBatch(
    signals: readonly TickPlanSignalCompat[],
    roomId: string,
  ): readonly ChatInputEnvelope[] {
    const results: ChatInputEnvelope[] = [];
    for (const signal of signals) {
      const envelope = this.translate(signal, roomId);
      if (envelope !== null) results.push(envelope);
    }
    return Object.freeze(results);
  }

  /**
   * Translates a TickPlanAnnotationCompat into a chat input envelope.
   */
  public translateAnnotation(
    annotation: TickPlanAnnotationCompat,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(annotation.severity, this._mode)) {
      return null;
    }

    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(annotation.severity);
    const worldEvent = buildAnnotationWorldEvent(annotation.operationKind);

    const annotationMeta: Record<string, JsonValue> = {
      fingerprint: annotation.fingerprint,
      severity: annotation.severity,
      healthScore: annotation.healthScore,
      label: annotation.label,
      description: annotation.description,
      enabledStepCount: annotation.enabledStepCount,
      disabledStepCount: annotation.disabledStepCount,
      criticalIssues: annotation.criticalIssues as unknown as JsonValue,
      warnings: annotation.warnings as unknown as JsonValue,
      mode: annotation.mode ?? 'null',
      lifecycleState: annotation.lifecycleState ?? 'null',
      validationPassed: annotation.validationPassed,
      operationKind: annotation.operationKind,
      emittedAtMs: annotation.emittedAtMs,
      _id: `tick_plan:annotation:${annotation.fingerprint.slice(0, 8)}:${ts}`,
      _lane: 'LIVEOPS_ANNOTATION',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: false,
          haterRaidActive: annotation.severity === 'CRITICAL',
        }),
        metadata: Object.freeze(annotationMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickPlanNarrationHintCompat into a chat input envelope.
   */
  public translateNarrationHint(
    narration: TickPlanNarrationHintCompat,
    severity: TickPlanSignalAdapterSeverityCompat,
    runId: string,
    tick: number,
    operationKind: TickPlanSignalAdapterOperationKindCompat,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(severity, this._mode)) {
      return null;
    }

    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(severity);
    const worldEvent = buildNarrationWorldEvent(operationKind);

    const narrationMeta: Record<string, JsonValue> = {
      phrase: narration.phrase,
      urgencyLabel: narration.urgencyLabel,
      heatMultiplier: narration.heatMultiplier,
      companionIntent: narration.companionIntent,
      audienceReaction: narration.audienceReaction,
      severity,
      runId,
      tick,
      _id: `tick_plan:narration:${runId}:${tick}:${ts}`,
      _lane: 'LIVEOPS_NARRATION',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(narration.heatMultiplier) as Score01,
          helperBlackout: severity === 'CRITICAL',
          haterRaidActive: false,
        }),
        metadata: Object.freeze(narrationMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickPlanHealthSnapshotCompat into a chat input envelope.
   */
  public translateHealthSnapshot(
    health: TickPlanHealthSnapshotCompat,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(health.severity, this._mode)) {
      return null;
    }

    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(health.severity);
    const worldEvent = buildHealthWorldEvent(health.severity);

    const healthMeta: Record<string, JsonValue> = {
      fingerprint: health.fingerprint,
      healthScore: health.healthScore,
      severity: health.severity,
      actionRecommendation: health.actionRecommendation,
      enabledCount: health.enabledCount,
      disabledCount: health.disabledCount,
      criticalStepsEnabled: health.criticalStepsEnabled,
      validationPassed: health.validationPassed,
      validationErrors: health.validationErrors as unknown as JsonValue,
      validationWarnings: health.validationWarnings as unknown as JsonValue,
      mode: health.mode ?? 'null',
      lifecycleState: health.lifecycleState ?? 'null',
      _id: `tick_plan:health:${health.fingerprint.slice(0, 8)}:${ts}`,
      _lane: 'LIVEOPS_HEALTH',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: false,
          haterRaidActive: health.severity === 'CRITICAL',
        }),
        metadata: Object.freeze(healthMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickPlanRunSummaryCompat into a chat input envelope.
   */
  public translateRunSummary(
    summary: TickPlanRunSummaryCompat,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(summary.severity, this._mode)) {
      return null;
    }

    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(summary.severity);
    const worldEvent = buildRunSummaryWorldEvent(summary.runId);

    const summaryMeta: Record<string, JsonValue> = {
      runId: summary.runId,
      tick: summary.tick,
      fingerprint: summary.fingerprint,
      healthScore: summary.healthScore,
      severity: summary.severity,
      enabledCount: summary.enabledCount,
      disabledCount: summary.disabledCount,
      validationPassed: summary.validationPassed,
      mode: summary.mode ?? 'null',
      lifecycleState: summary.lifecycleState ?? 'null',
      narrationPhrase: summary.narrationPhrase,
      _id: `tick_plan:run_summary:${summary.runId}:${summary.tick}:${ts}`,
      _lane: 'LIVEOPS_RUN_SUMMARY',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: false,
          haterRaidActive: summary.severity === 'CRITICAL',
        }),
        metadata: Object.freeze(summaryMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickPlanTrendSnapshotCompat into a chat input envelope.
   */
  public translateTrendSnapshot(
    trend: TickPlanTrendSnapshotCompat,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(trend.dominantSeverity, this._mode)) {
      return null;
    }

    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(trend.dominantSeverity);
    const worldEvent = buildTrendWorldEvent(trend.dominantSeverity);

    const trendMeta: Record<string, JsonValue> = {
      windowSize: trend.windowSize,
      avgHealthScore: trend.avgHealthScore,
      minHealthScore: trend.minHealthScore,
      maxHealthScore: trend.maxHealthScore,
      avgEnabledRatio: trend.avgEnabledRatio,
      dominantSeverity: trend.dominantSeverity,
      criticalTrendUp: trend.criticalTrendUp,
      planFingerprintChanges: trend.planFingerprintChanges,
      severityCounts_LOW: trend.severityCounts.LOW,
      severityCounts_MEDIUM: trend.severityCounts.MEDIUM,
      severityCounts_HIGH: trend.severityCounts.HIGH,
      severityCounts_CRITICAL: trend.severityCounts.CRITICAL,
      _id: `tick_plan:trend:${ts}`,
      _lane: 'LIVEOPS_TREND',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: false,
          haterRaidActive: trend.criticalTrendUp,
        }),
        metadata: Object.freeze(trendMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickPlanSessionReportCompat into a chat input envelope.
   */
  public translateSessionReport(
    session: TickPlanSessionReportCompat,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    const dominantSeverity = session.severityDistribution.CRITICAL > 0
      ? 'CRITICAL' as const
      : session.severityDistribution.HIGH > 0
        ? 'HIGH' as const
        : session.severityDistribution.MEDIUM > 0
          ? 'MEDIUM' as const
          : 'LOW' as const;

    if (!shouldEmit(dominantSeverity, this._mode)) {
      return null;
    }

    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(dominantSeverity);
    const worldEvent = buildSessionWorldEvent(session.sessionId);

    const sessionMeta: Record<string, JsonValue> = {
      sessionId: session.sessionId,
      startedAtMs: session.startedAtMs,
      planCount: session.planCount,
      avgHealthScore: session.avgHealthScore,
      avgEnabledRatio: session.avgEnabledRatio,
      validationFailures: session.validationFailures,
      mode: session.mode ?? 'null',
      mostFrequentFingerprint: session.mostFrequentFingerprint ?? 'null',
      severityDistribution_LOW: session.severityDistribution.LOW,
      severityDistribution_MEDIUM: session.severityDistribution.MEDIUM,
      severityDistribution_HIGH: session.severityDistribution.HIGH,
      severityDistribution_CRITICAL: session.severityDistribution.CRITICAL,
      _id: `tick_plan:session:${session.sessionId}:${ts}`,
      _lane: 'LIVEOPS_SESSION',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: false,
          haterRaidActive: dominantSeverity === 'CRITICAL',
        }),
        metadata: Object.freeze(sessionMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a TickPlanDLTensorCompat row into a chat input envelope.
   * Useful for per-step telemetry emission in verbose mode.
   */
  public translateDLTensorRow(
    row: TickPlanDLTensorRowCompat,
    step: TickStepCompat,
    severity: TickPlanSignalAdapterSeverityCompat,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    if (!shouldEmit(severity, this._mode)) {
      return null;
    }

    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(severity);
    const worldEvent = buildDLTensorWorldEvent(step);

    const tensorMeta: Record<string, JsonValue> = {
      step: row.step,
      enabled: row.enabled,
      criticality: row.criticality,
      phaseWeight: row.phaseWeight,
      sealEligible: row.sealEligible,
      collectSignals: row.collectSignals,
      collectDiagnostics: row.collectDiagnostics,
      mutatesState: row.mutatesState,
      prerequisiteCount: row.prerequisiteCount,
      severity,
      _id: `tick_plan:dl_tensor:${step}:${ts}`,
      _lane: 'LIVEOPS_DL_TENSOR',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: false,
          haterRaidActive: false,
        }),
        metadata: Object.freeze(tensorMeta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  // ── accessors ─────────────────────────────────────────────────────────────

  public mode(): TickPlanAdapterMode { return this._mode; }

  public manifest(): TickPlanSignalAdapterManifest {
    return Object.freeze({
      adapterId: `tick-plan-signal-adapter-${this._mode.toLowerCase()}`,
      adapterName: 'TickPlanSignalAdapter',
      version: TICK_PLAN_SIGNAL_ADAPTER_VERSION,
      schema: TICK_PLAN_SIGNAL_ADAPTER_SCHEMA,
      mode: this._mode,
      mlFeatureCount: TICK_PLAN_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
      dlTensorShape: TICK_PLAN_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
      emitsOnLow: this._mode === 'VERBOSE',
      emitsOnMedium: this._mode !== 'STRICT',
      emitsOnHigh: true,
      emitsOnCritical: true,
    });
  }

  // ── extended translate methods ────────────────────────────────────────────

  /**
   * Translates a validation report. Health = valid ? 1 : 1 - (errorCount * 0.2).
   * haterRaidActive = errorCount > 0.
   */
  public translateValidationReport(
    report: TickPlanValidationReportCompat,
    fingerprint: string,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    const healthScore = report.valid ? 1.0 : Math.max(0, 1 - report.errorCount * 0.2);
    const severity = classifyAdapterSeverity(healthScore);
    if (!shouldEmit(severity, this._mode)) return null;
    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(severity);
    const worldEvent = buildWorldEventKey('validation', severity);

    this._emittedCount++;
    this._lastEmittedAtMs = ts;
    this._emissionsByOperation['VALIDATE'] = (this._emissionsByOperation['VALIDATE'] ?? 0) + 1;
    this._emissionsBySeverity[severity] = (this._emissionsBySeverity[severity] ?? 0) + 1;

    const meta: Record<string, JsonValue> = {
      fingerprint,
      valid: report.valid,
      errorCount: report.errorCount,
      warningCount: report.warningCount,
      healthScore,
      severity,
      errors: report.errors as unknown as JsonValue,
      warnings: report.warnings as unknown as JsonValue,
      _id: `tick_plan:validation:${fingerprint.slice(0, 8)}:${ts}`,
      _lane: 'LIVEOPS_VALIDATE',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: severity === 'CRITICAL',
          haterRaidActive: report.errorCount > 0,
        }),
        metadata: Object.freeze(meta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a plan diff report. Severity from diffScore.
   */
  public translateComparison(
    diff: TickPlanDiffReportCompat,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    const severity = diffScoreToAdapterSeverity(diff.diffScore);
    if (!shouldEmit(severity, this._mode)) return null;
    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(severity);
    const worldEvent = buildWorldEventKey('compare', severity);

    this._emittedCount++;
    this._lastEmittedAtMs = ts;
    this._emissionsByOperation['COMPARE'] = (this._emissionsByOperation['COMPARE'] ?? 0) + 1;
    this._emissionsBySeverity[severity] = (this._emissionsBySeverity[severity] ?? 0) + 1;

    const meta: Record<string, JsonValue> = {
      leftFingerprint: diff.leftFingerprint,
      rightFingerprint: diff.rightFingerprint,
      identical: diff.identical,
      diffScore: diff.diffScore,
      severity,
      enabledDelta: diff.enabledDelta,
      disabledDelta: diff.disabledDelta,
      healthScoreDelta: diff.healthScoreDelta,
      leftHealthScore: diff.leftHealthScore,
      rightHealthScore: diff.rightHealthScore,
      leftSeverity: diff.leftSeverity,
      rightSeverity: diff.rightSeverity,
      stepsEnabled: diff.stepsEnabled as unknown as JsonValue,
      stepsDisabled: diff.stepsDisabled as unknown as JsonValue,
      stepsModified: diff.stepsModified as unknown as JsonValue,
      emittedAtMs: diff.emittedAtMs,
      _id: `tick_plan:compare:${diff.leftFingerprint.slice(0, 8)}:${ts}`,
      _lane: 'LIVEOPS_COMPARE',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: severity === 'CRITICAL',
          haterRaidActive: severity === 'CRITICAL' || severity === 'HIGH',
        }),
        metadata: Object.freeze(meta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates a coverage matrix. Health from overallCoverage. Severity from classifying health.
   * Verbose only for LOW coverage events.
   */
  public translateCoverageMatrix(
    matrix: TickPlanCoverageMatrixCompat,
    fingerprint: string,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    const healthScore = matrix.overallCoverage;
    const severity = classifyAdapterSeverity(healthScore);
    const isLowCoverage = healthScore < 0.5;
    if (!shouldEmit(severity, this._mode) && !isLowCoverage) return null;
    if (severity === 'LOW' && this._mode !== 'VERBOSE') return null;
    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(severity);
    const worldEvent = buildWorldEventKey('coverage', severity);

    this._emittedCount++;
    this._lastEmittedAtMs = ts;
    this._emissionsByOperation['SNAPSHOT'] = (this._emissionsByOperation['SNAPSHOT'] ?? 0) + 1;
    this._emissionsBySeverity[severity] = (this._emissionsBySeverity[severity] ?? 0) + 1;

    const meta: Record<string, JsonValue> = {
      fingerprint,
      overallCoverage: matrix.overallCoverage,
      criticalCoverage: matrix.criticalCoverage,
      weakestPhase: matrix.weakestPhase,
      uncoveredCount: matrix.uncoveredCount,
      healthScore,
      severity,
      _id: `tick_plan:coverage:${fingerprint.slice(0, 8)}:${ts}`,
      _lane: 'LIVEOPS_COVERAGE',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: severity === 'CRITICAL',
          haterRaidActive: severity === 'CRITICAL',
        }),
        metadata: Object.freeze(meta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Translates execution estimate. Health from successProbability.
   * haterRaidActive = estimatedOutcome === 'FAILED'.
   */
  public translateExecutionEstimate(
    estimate: TickPlanExecutionEstimateCompat,
    fingerprint: string,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    const healthScore = estimate.successProbability;
    const severity = classifyAdapterSeverity(healthScore);
    if (!shouldEmit(severity, this._mode)) return null;
    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const heat = translateTickPlanSeverityToHeat(severity);
    const worldEvent = buildWorldEventKey('estimate', severity);

    this._emittedCount++;
    this._lastEmittedAtMs = ts;
    this._emissionsByOperation['PLAN'] = (this._emissionsByOperation['PLAN'] ?? 0) + 1;
    this._emissionsBySeverity[severity] = (this._emissionsBySeverity[severity] ?? 0) + 1;

    const meta: Record<string, JsonValue> = {
      fingerprint,
      successProbability: estimate.successProbability,
      criticalPathIntact: estimate.criticalPathIntact,
      estimatedOutcome: estimate.estimatedOutcome,
      estimatedDataIntegrity: estimate.estimatedDataIntegrity,
      bottleneckCount: estimate.bottleneckCount,
      severity,
      healthScore,
      _id: `tick_plan:estimate:${fingerprint.slice(0, 8)}:${ts}`,
      _lane: 'LIVEOPS_ESTIMATE',
      _actorId: (actorId ?? null) as JsonValue,
    };

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: clamp01(heat) as Score01,
          helperBlackout: severity === 'CRITICAL',
          haterRaidActive: estimate.estimatedOutcome === 'FAILED',
        }),
        metadata: Object.freeze(meta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * VERBOSE mode only. Dumps all 32 ML features as metadata.
   */
  public translateMLVectorRaw(
    vector: TickPlanMLVectorRawCompat,
    fingerprint: string,
    roomId: string,
    actorId?: Nullable<string>,
  ): ChatInputEnvelope | null {
    if (this._mode !== 'VERBOSE') return null;
    const ts = nowMs();
    const resolvedRoomId = (roomId || this._roomId) as ChatRoomId;
    const worldEvent = `${TICK_PLAN_WORLD_EVENT_PREFIX}:ml_vector:raw`;

    this._emittedCount++;
    this._lastEmittedAtMs = ts;
    this._emissionsByOperation['SNAPSHOT'] = (this._emissionsByOperation['SNAPSHOT'] ?? 0) + 1;
    this._emissionsBySeverity['LOW'] = (this._emissionsBySeverity['LOW'] ?? 0) + 1;

    const meta: Record<string, JsonValue> = {
      fingerprint,
      enabledRatio: vector.enabledRatio,
      criticalStepsEnabledRatio: vector.criticalStepsEnabledRatio,
      _id: `tick_plan:ml_vector:${fingerprint.slice(0, 8)}:${ts}`,
      _lane: 'LIVEOPS_ML_VECTOR',
      _actorId: (actorId ?? null) as JsonValue,
    };

    // Dump all numeric fields from the vector
    for (const [key, value] of Object.entries(vector)) {
      if (typeof value === 'number') meta[`ml_${key}`] = value;
    }

    return Object.freeze({
      kind: 'LIVEOPS_SIGNAL' as const,
      emittedAt: ts,
      payload: Object.freeze({
        type: 'LIVEOPS' as const,
        emittedAt: ts,
        roomId: resolvedRoomId,
        liveops: Object.freeze({
          worldEventName: worldEvent,
          heatMultiplier01: 0.05 as Score01,
          helperBlackout: false,
          haterRaidActive: false,
        }),
        metadata: Object.freeze(meta) as Readonly<Record<string, JsonValue>>,
      }),
    });
  }

  /**
   * Like translateBatch but deduplicates by fingerprint+operationKind before translating.
   * Keeps most severe signal per fingerprint+op combination.
   */
  public translateBatchWithDeduplication(
    signals: readonly TickPlanSignalCompat[],
    roomId: string,
  ): readonly ChatInputEnvelope[] {
    const dedupMap = new Map<string, TickPlanSignalCompat>();
    const severityOrder: TickPlanSignalAdapterSeverityCompat[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    for (const signal of signals) {
      const key = `${signal.fingerprint}:${signal.operationKind}`;
      const existing = dedupMap.get(key);
      if (!existing) {
        dedupMap.set(key, signal);
      } else {
        const existingIdx = severityOrder.indexOf(existing.severity);
        const newIdx = severityOrder.indexOf(signal.severity);
        if (newIdx > existingIdx) dedupMap.set(key, signal);
      }
    }

    const results: ChatInputEnvelope[] = [];
    for (const signal of dedupMap.values()) {
      const envelope = this.translate(signal, roomId);
      if (envelope !== null) results.push(envelope);
    }
    return Object.freeze(results);
  }

  /**
   * Returns current adapter diagnostics.
   */
  public diagnostics(): TickPlanSignalAdapterDiagnosticsReport {
    const total = this._emittedCount + this._suppressedCount;
    const suppressionRatio = total > 0 ? clamp01(this._suppressedCount / total) : 0;
    return Object.freeze({
      adapterId: `tick-plan-signal-adapter-${this._mode.toLowerCase()}`,
      mode: this._mode,
      totalEmitted: this._emittedCount,
      totalSuppressed: this._suppressedCount,
      lastEmittedAtMs: this._lastEmittedAtMs,
      suppressionRatio,
      emissionsByOperation: Object.freeze({ ...this._emissionsByOperation }),
      emissionsBySeverity: Object.freeze({ ...this._emissionsBySeverity }),
    });
  }

  // ── tracking state (mutable, managed carefully) ───────────────────────────
  private _emittedCount: number = 0;
  private _suppressedCount: number = 0;
  private _lastEmittedAtMs: number | null = null;
  private readonly _emissionsByOperation: Record<TickPlanSignalAdapterOperationKindCompat, number> = {
    PLAN: 0, VALIDATE: 0, COMPARE: 0, SNAPSHOT: 0, REBUILD: 0, NOOP: 0,
  };
  private readonly _emissionsBySeverity: Record<TickPlanSignalAdapterSeverityCompat, number> = {
    LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETONS
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_DEFAULT_SIGNAL_ADAPTER = new TickPlanSignalAdapter({ mode: 'DEFAULT' });
export const TICK_PLAN_STRICT_SIGNAL_ADAPTER = new TickPlanSignalAdapter({ mode: 'STRICT' });
export const TICK_PLAN_VERBOSE_SIGNAL_ADAPTER = new TickPlanSignalAdapter({ mode: 'VERBOSE' });

export const TICK_PLAN_SIGNAL_ADAPTER_MANIFEST: TickPlanSignalAdapterManifest = Object.freeze({
  adapterId: 'tick-plan-signal-adapter-default',
  adapterName: 'TickPlanSignalAdapter',
  version: TICK_PLAN_SIGNAL_ADAPTER_VERSION,
  schema: TICK_PLAN_SIGNAL_ADAPTER_SCHEMA,
  mode: 'DEFAULT' as TickPlanAdapterMode,
  mlFeatureCount: TICK_PLAN_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
  dlTensorShape: TICK_PLAN_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
  emitsOnLow: false,
  emitsOnMedium: true,
  emitsOnHigh: true,
  emitsOnCritical: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORT UNUSED SIGNAL ENVELOPE TYPE (keeps import of ChatSignalEnvelope live)
// ─────────────────────────────────────────────────────────────────────────────

/** Passthrough type alias for ChatSignalEnvelope — used by downstream chat routing. */
export type TickPlanChatSignalEnvelope = ChatSignalEnvelope;

/** Passthrough type alias for TickPlanPressureTierCompat. */
export type TickPlanPressureTierAdapterCompat = TickPlanPressureTierCompat;

/** Passthrough type alias for TickPlanRunPhaseCompat. */
export type TickPlanRunPhaseAdapterCompat = TickPlanRunPhaseCompat;

/** Passthrough type alias for TickPlanRunOutcomeCompat. */
export type TickPlanRunOutcomeAdapterCompat = TickPlanRunOutcomeCompat;

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED ADAPTER UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns whether a given severity should be suppressed by the given adapter mode,
 * based on the canonical suppression policy table.
 */
export function isTickPlanSignalSuppressed(
  severity: TickPlanSignalAdapterSeverityCompat,
  mode: TickPlanAdapterMode,
): boolean {
  return TICK_PLAN_SIGNAL_ADAPTER_SUPPRESSION_POLICY[mode][severity];
}

/**
 * Returns the heat multiplier for a severity from the canonical heat map.
 * Uses TICK_PLAN_SIGNAL_ADAPTER_HEAT_MAP rather than the score-based helper.
 */
export function getTickPlanSignalHeatMultiplier(
  severity: TickPlanSignalAdapterSeverityCompat,
): number {
  return TICK_PLAN_SIGNAL_ADAPTER_HEAT_MAP[severity] ?? 0.3;
}

/**
 * Builds a deterministic signal ID for deduplication.
 */
export function buildTickPlanSignalId(
  fingerprint: string,
  operationKind: TickPlanSignalAdapterOperationKindCompat,
  tick: number,
): string {
  return `tick_plan:${operationKind.toLowerCase()}:${fingerprint.slice(0, 8)}:t${tick}`;
}

/**
 * Classifies a health score into a severity using the standard threshold table.
 * Exposed as a public utility so callers don't need to depend on zero/.
 */
export function classifyTickPlanAdapterSeverity(
  healthScore: number,
): TickPlanSignalAdapterSeverityCompat {
  if (healthScore >= 0.75) return 'LOW';
  if (healthScore >= 0.5) return 'MEDIUM';
  if (healthScore >= 0.25) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Converts a diff score (0–1) to a severity label using standard thresholds.
 */
export function classifyTickPlanDiffSeverity(
  diffScore: number,
): TickPlanSignalAdapterSeverityCompat {
  if (diffScore < 0.05) return 'LOW';
  if (diffScore < 0.2) return 'MEDIUM';
  if (diffScore < 0.5) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Returns a world event name for the given operation and severity.
 * Mirrors the internal buildWorldEventKey helper.
 */
export function buildTickPlanWorldEventName(
  operation: string,
  severity: TickPlanSignalAdapterSeverityCompat,
): string {
  return `${TICK_PLAN_WORLD_EVENT_PREFIX}:${operation}:${severity.toLowerCase()}`;
}

/**
 * Returns the adapter's emission policy for a given mode as a human-readable string.
 */
export function describeTickPlanAdapterMode(mode: TickPlanAdapterMode): string {
  switch (mode) {
    case 'DEFAULT': return 'Emits for MEDIUM, HIGH, and CRITICAL severity signals.';
    case 'STRICT': return 'Emits only for HIGH and CRITICAL severity signals.';
    case 'VERBOSE': return 'Emits for all signals including LOW; full ML vector in metadata.';
  }
}

/**
 * Returns a compact severity code for use in log messages.
 */
export function tickPlanSeverityToLogCode(severity: TickPlanSignalAdapterSeverityCompat): string {
  switch (severity) {
    case 'LOW': return 'L';
    case 'MEDIUM': return 'M';
    case 'HIGH': return 'H';
    case 'CRITICAL': return 'C';
  }
}

/**
 * Returns whether the adapter would emit anything at all for the given mode.
 * A STRICT adapter emitting HIGH/CRITICAL is always active.
 */
export function isTickPlanAdapterActive(mode: TickPlanAdapterMode): boolean {
  return true; // all modes emit at least HIGH/CRITICAL
  void mode;
}

/**
 * Merges two diagnostics reports by summing counters and taking the worst values.
 */
export function mergeTickPlanAdapterDiagnostics(
  a: TickPlanSignalAdapterDiagnosticsReport,
  b: TickPlanSignalAdapterDiagnosticsReport,
): TickPlanSignalAdapterDiagnosticsReport {
  const totalEmitted = a.totalEmitted + b.totalEmitted;
  const totalSuppressed = a.totalSuppressed + b.totalSuppressed;
  const total = totalEmitted + totalSuppressed;
  const suppressionRatio = total > 0 ? totalSuppressed / total : 0;
  const lastEmittedAtMs = Math.max(
    a.lastEmittedAtMs ?? 0,
    b.lastEmittedAtMs ?? 0,
  ) || null;

  const mergeOps = (
    x: Readonly<Record<TickPlanSignalAdapterOperationKindCompat, number>>,
    y: Readonly<Record<TickPlanSignalAdapterOperationKindCompat, number>>,
  ): Readonly<Record<TickPlanSignalAdapterOperationKindCompat, number>> => {
    return Object.freeze({
      PLAN: (x.PLAN ?? 0) + (y.PLAN ?? 0),
      VALIDATE: (x.VALIDATE ?? 0) + (y.VALIDATE ?? 0),
      COMPARE: (x.COMPARE ?? 0) + (y.COMPARE ?? 0),
      SNAPSHOT: (x.SNAPSHOT ?? 0) + (y.SNAPSHOT ?? 0),
      REBUILD: (x.REBUILD ?? 0) + (y.REBUILD ?? 0),
      NOOP: (x.NOOP ?? 0) + (y.NOOP ?? 0),
    });
  };

  const mergeSeverity = (
    x: Readonly<Record<TickPlanSignalAdapterSeverityCompat, number>>,
    y: Readonly<Record<TickPlanSignalAdapterSeverityCompat, number>>,
  ): Readonly<Record<TickPlanSignalAdapterSeverityCompat, number>> => {
    return Object.freeze({
      LOW: (x.LOW ?? 0) + (y.LOW ?? 0),
      MEDIUM: (x.MEDIUM ?? 0) + (y.MEDIUM ?? 0),
      HIGH: (x.HIGH ?? 0) + (y.HIGH ?? 0),
      CRITICAL: (x.CRITICAL ?? 0) + (y.CRITICAL ?? 0),
    });
  };

  return Object.freeze({
    adapterId: `${a.adapterId}+${b.adapterId}`,
    mode: a.mode,
    totalEmitted,
    totalSuppressed,
    lastEmittedAtMs,
    suppressionRatio,
    emissionsByOperation: mergeOps(a.emissionsByOperation, b.emissionsByOperation),
    emissionsBySeverity: mergeSeverity(a.emissionsBySeverity, b.emissionsBySeverity),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER REGISTRY TYPE AND SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

export interface TickPlanSignalAdapterRegistry {
  readonly default: TickPlanSignalAdapter;
  readonly strict: TickPlanSignalAdapter;
  readonly verbose: TickPlanSignalAdapter;
  readonly byMode: Readonly<Record<TickPlanAdapterMode, TickPlanSignalAdapter>>;
  readonly manifests: Readonly<Record<TickPlanAdapterMode, TickPlanSignalAdapterManifest>>;
}

export const TICK_PLAN_SIGNAL_ADAPTER_REGISTRY: TickPlanSignalAdapterRegistry = (() => {
  const defaultAdapter = TICK_PLAN_DEFAULT_SIGNAL_ADAPTER;
  const strictAdapter = TICK_PLAN_STRICT_SIGNAL_ADAPTER;
  const verboseAdapter = TICK_PLAN_VERBOSE_SIGNAL_ADAPTER;
  return Object.freeze({
    default: defaultAdapter,
    strict: strictAdapter,
    verbose: verboseAdapter,
    byMode: Object.freeze({
      DEFAULT: defaultAdapter,
      STRICT: strictAdapter,
      VERBOSE: verboseAdapter,
    }),
    manifests: Object.freeze({
      DEFAULT: defaultAdapter.manifest(),
      STRICT: strictAdapter.manifest(),
      VERBOSE: verboseAdapter.manifest(),
    }),
  });
})();

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED MODULE METADATA
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_SIGNAL_ADAPTER_EXTENDED_VERSION = '2.0.2026' as const;
export const TICK_PLAN_SIGNAL_ADAPTER_EXTENDED_READY = true as const;

export interface TickPlanSignalAdapterExtendedManifest {
  readonly version: string;
  readonly ready: boolean;
  readonly adapterModes: readonly TickPlanAdapterMode[];
  readonly supportedOperations: readonly TickPlanSignalAdapterOperationKindCompat[];
  readonly supportedSeverities: readonly TickPlanSignalAdapterSeverityCompat[];
  readonly exportedFunctions: number;
  readonly exportedTypes: number;
}

export const TICK_PLAN_SIGNAL_ADAPTER_EXTENDED_MANIFEST: TickPlanSignalAdapterExtendedManifest =
  Object.freeze({
    version: TICK_PLAN_SIGNAL_ADAPTER_EXTENDED_VERSION,
    ready: TICK_PLAN_SIGNAL_ADAPTER_EXTENDED_READY,
    adapterModes: Object.freeze(['DEFAULT', 'STRICT', 'VERBOSE'] as const),
    supportedOperations: Object.freeze(['PLAN', 'VALIDATE', 'COMPARE', 'SNAPSHOT', 'REBUILD', 'NOOP'] as const),
    supportedSeverities: Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const),
    exportedFunctions: 18,
    exportedTypes: 10,
  });

/**
 * Returns the canonical TickPlanSignalAdapter for a given mode from the registry.
 */
export function getTickPlanSignalAdapter(mode: TickPlanAdapterMode): TickPlanSignalAdapter {
  return TICK_PLAN_SIGNAL_ADAPTER_REGISTRY.byMode[mode];
}

/**
 * Returns the suppression policy for a given adapter mode.
 */
export function getTickPlanAdapterSuppressionPolicy(
  mode: TickPlanAdapterMode,
): Readonly<Record<TickPlanSignalAdapterSeverityCompat, boolean>> {
  return TICK_PLAN_SIGNAL_ADAPTER_SUPPRESSION_POLICY[mode];
}

/**
 * Checks whether any of the given signals would be emitted by the given mode.
 * Returns true if at least one signal would pass the emission threshold.
 */
export function hasEmittableSignals(
  signals: readonly TickPlanSignalCompat[],
  mode: TickPlanAdapterMode,
): boolean {
  const policy = TICK_PLAN_SIGNAL_ADAPTER_SUPPRESSION_POLICY[mode];
  return signals.some(s => !policy[s.severity]);
}

/**
 * Filters a signal batch to only those that would emit under the given mode.
 */
export function filterEmittableSignals(
  signals: readonly TickPlanSignalCompat[],
  mode: TickPlanAdapterMode,
): readonly TickPlanSignalCompat[] {
  const policy = TICK_PLAN_SIGNAL_ADAPTER_SUPPRESSION_POLICY[mode];
  return Object.freeze(signals.filter(s => !policy[s.severity]));
}

/**
 * Returns the dominant severity across a batch of signals.
 */
export function getDominantSignalSeverity(
  signals: readonly TickPlanSignalCompat[],
): TickPlanSignalAdapterSeverityCompat {
  if (signals.length === 0) return 'LOW';
  const severityOrder: TickPlanSignalAdapterSeverityCompat[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  let maxIdx = 0;
  for (const signal of signals) {
    const idx = severityOrder.indexOf(signal.severity);
    if (idx > maxIdx) maxIdx = idx;
  }
  return severityOrder[maxIdx];
}

/**
 * Returns a deduplication key for a signal suitable for the batch dedup algorithm.
 */
export function getSignalDeduplicationKey(signal: TickPlanSignalCompat): string {
  return `${signal.fingerprint}:${signal.operationKind}`;
}

/**
 * Checks if a TickPlanSignalAdapterSeverityCompat is a valid value.
 */
export function isTickPlanSignalAdapterSeverity(
  value: unknown,
): value is TickPlanSignalAdapterSeverityCompat {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL';
}

/**
 * Checks if a TickPlanSignalAdapterOperationKindCompat is a valid value.
 */
export function isTickPlanSignalAdapterOperationKind(
  value: unknown,
): value is TickPlanSignalAdapterOperationKindCompat {
  return (
    value === 'PLAN' ||
    value === 'VALIDATE' ||
    value === 'COMPARE' ||
    value === 'SNAPSHOT' ||
    value === 'REBUILD' ||
    value === 'NOOP'
  );
}

/**
 * Returns the signal severity order index (0=LOW, 3=CRITICAL).
 * Useful for sorting and comparison.
 */
export function getSignalSeverityIndex(
  severity: TickPlanSignalAdapterSeverityCompat,
): number {
  switch (severity) {
    case 'LOW': return 0;
    case 'MEDIUM': return 1;
    case 'HIGH': return 2;
    case 'CRITICAL': return 3;
  }
}

/**
 * Returns whether severity A is worse than severity B.
 */
export function isTickPlanSignalMoreSevere(
  a: TickPlanSignalAdapterSeverityCompat,
  b: TickPlanSignalAdapterSeverityCompat,
): boolean {
  return getSignalSeverityIndex(a) > getSignalSeverityIndex(b);
}

/**
 * Returns the most severe severity in a list.
 */
export function getMostSevere(
  severities: readonly TickPlanSignalAdapterSeverityCompat[],
): TickPlanSignalAdapterSeverityCompat {
  if (severities.length === 0) return 'LOW';
  return severities.reduce((max, s) => isTickPlanSignalMoreSevere(s, max) ? s : max, 'LOW' as TickPlanSignalAdapterSeverityCompat);
}

// ─────────────────────────────────────────────────────────────────────────────
// TICK_PLAN_SIGNAL_ADAPTER_COMPLETE sentinel
// ─────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_SIGNAL_ADAPTER_COMPLETE = true as const;
