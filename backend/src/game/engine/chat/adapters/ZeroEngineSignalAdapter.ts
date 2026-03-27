/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT ZERO ENGINE SIGNAL ADAPTER
 * FILE: backend/src/game/engine/chat/adapters/ZeroEngineSignalAdapter.ts
 * VERSION: 2026.03.27
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend adapter that translates ZeroEngine orchestration signals —
 * lifecycle transitions, tick completions, outcome gates, quarantine events,
 * ML/DL anomaly vectors, health degradation reports, and snapshot projections —
 * into authoritative backend-chat ingress envelopes.
 *
 * Backend-truth question
 * ----------------------
 *   "When the ZeroEngine transitions lifecycle state, completes a tick,
 *    resolves an outcome gate, enters quarantine, projects a snapshot, or
 *    detects an anomaly via ML/DL inference, what exact chat-native signal
 *    should the authoritative backend chat engine ingest to preserve
 *    orchestration fidelity and make the chat layer feel alive?"
 *
 * Design laws
 * -----------
 * - No circular imports from core/. All ZeroEngine types are mirrored as
 *   structural compat interfaces below.
 * - Lifecycle transitions always emit — they represent orchestration truth.
 * - Tick completions emit only when duration exceeds budget or errors occur.
 * - Outcome gate signals always emit — they represent game-critical decisions.
 * - Quarantine entry/exit always emit — safety-critical orchestration events.
 * - ML vectors emit only when anomaly score exceeds configurable threshold.
 * - DL tensors emit only when anomaly score exceeds configurable threshold.
 * - Health degradations always emit at CRITICAL severity.
 * - Snapshot projections emit at configurable cadence to prevent flood.
 * - Chat bridge emissions always emit — they are direct chat-layer requests.
 * ============================================================================
 */

import {
  asUnixMs,
  clamp01,
  clamp100,
  type ChatInputEnvelope,
  type ChatRoomId,
  type ChatSignalEnvelope,
  type ChatVisibleChannel,
  type JsonValue,
  type Nullable,
  type Score01,
  type Score100,
  type UnixMs,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Structural compat interfaces — mirrors ZeroEngine orchestration domain types
// WITHOUT importing them to avoid circular dependency chains.
// ─────────────────────────────────────────────────────────────────────────────

// ── Lifecycle compat ──────────────────────────────────────────────────────────

export type ZeroEngineLifecyclePhase =
  | 'UNINITIALIZED'
  | 'BOOTING'
  | 'CALIBRATING'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'DRAINING'
  | 'FINALIZING'
  | 'SHUTDOWN'
  | 'CRASHED'
  | 'QUARANTINED';

export interface ZeroEngineLifecycleTransitionCompat {
  readonly surface: 'zero_engine';
  readonly kind: 'LIFECYCLE_TRANSITION';
  readonly runId: string;
  readonly tick: number;
  readonly previousPhase: ZeroEngineLifecyclePhase;
  readonly nextPhase: ZeroEngineLifecyclePhase;
  readonly reason: string;
  readonly transitionDurationMs: number;
  readonly orchestratorVersion: string;
  readonly uptimeMs: number;
  readonly errorMessage?: string | null;
  readonly triggerSource?: string | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

// ── Tick completion compat ────────────────────────────────────────────────────

export type ZeroEngineTickOutcome =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'TIMEOUT'
  | 'ERROR'
  | 'SKIPPED';

export interface ZeroEngineTickStepResult {
  readonly stepName: string;
  readonly durationMs: number;
  readonly budgetMs: number;
  readonly outcome: ZeroEngineTickOutcome;
  readonly errorMessage?: string | null;
  readonly retryCount: number;
  readonly memoryDeltaBytes: number;
}

export interface ZeroEngineTickCompletionCompat {
  readonly surface: 'zero_engine';
  readonly kind: 'TICK_COMPLETION';
  readonly runId: string;
  readonly tick: number;
  readonly totalDurationMs: number;
  readonly budgetMs: number;
  readonly outcome: ZeroEngineTickOutcome;
  readonly stepResults: readonly ZeroEngineTickStepResult[];
  readonly stepsCompleted: number;
  readonly stepsTotal: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly memoryUsageBytes: number;
  readonly gcPauseTotalMs: number;
  readonly completedAtMs: number;
  readonly isOverBudget: boolean;
  readonly overBudgetRatio: number;
  readonly ticksPerSecond: number;
  readonly avgStepDurationMs: number;
  readonly slowestStepName: string | null;
  readonly slowestStepDurationMs: number;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

// ── Outcome gate compat ──────────────────────────────────────────────────────

export type ZeroEngineOutcomeVerdict =
  | 'PASS'
  | 'FAIL'
  | 'DEFER'
  | 'OVERRIDE'
  | 'TIMEOUT';

export type ZeroEngineOutcomeGateKind =
  | 'WIN_CONDITION'
  | 'LOSS_CONDITION'
  | 'DRAW_CONDITION'
  | 'FORFEIT'
  | 'MERCY_RULE'
  | 'TIME_LIMIT'
  | 'SCORE_THRESHOLD'
  | 'SURVIVAL_CHECK'
  | 'ELIMINATION_CHECK'
  | 'CUSTOM_GATE';

export interface ZeroEngineOutcomeGateCompat {
  readonly surface: 'zero_engine';
  readonly kind: 'OUTCOME_GATE';
  readonly runId: string;
  readonly tick: number;
  readonly gateKind: ZeroEngineOutcomeGateKind;
  readonly verdict: ZeroEngineOutcomeVerdict;
  readonly reason: string;
  readonly evaluatedAtMs: number;
  readonly evaluationDurationMs: number;
  readonly confidenceScore: number;
  readonly playerScore: number;
  readonly opponentScore: number;
  readonly thresholdValue: number;
  readonly actualValue: number;
  readonly overrideSource?: string | null;
  readonly overrideReason?: string | null;
  readonly affectedPlayerIds: readonly string[];
  readonly gateIndex: number;
  readonly gatesTotal: number;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

// ── Quarantine compat ────────────────────────────────────────────────────────

export type ZeroEngineQuarantineReason =
  | 'DESYNC_DETECTED'
  | 'INTEGRITY_VIOLATION'
  | 'MEMORY_OVERFLOW'
  | 'TICK_STARVATION'
  | 'DEADLOCK_SUSPECTED'
  | 'STATE_CORRUPTION'
  | 'EXTERNAL_ABORT'
  | 'ANOMALY_THRESHOLD'
  | 'RESOURCE_EXHAUSTION'
  | 'MANUAL_OVERRIDE';

export interface ZeroEngineQuarantineEntryCompat {
  readonly surface: 'zero_engine';
  readonly kind: 'QUARANTINE_ENTRY';
  readonly runId: string;
  readonly tick: number;
  readonly reason: ZeroEngineQuarantineReason;
  readonly severity: 'warn' | 'error' | 'critical';
  readonly message: string;
  readonly enteredAtMs: number;
  readonly estimatedRecoveryMs: number;
  readonly affectedSubsystems: readonly string[];
  readonly snapshotHash: string;
  readonly canAutoRecover: boolean;
  readonly recoveryStrategy: string;
  readonly quarantineId: string;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

export interface ZeroEngineQuarantineExitCompat {
  readonly surface: 'zero_engine';
  readonly kind: 'QUARANTINE_EXIT';
  readonly runId: string;
  readonly tick: number;
  readonly quarantineId: string;
  readonly reason: ZeroEngineQuarantineReason;
  readonly exitedAtMs: number;
  readonly durationMs: number;
  readonly recoveryOutcome: 'RECOVERED' | 'DEGRADED' | 'FAILED';
  readonly recoveryStepsTaken: readonly string[];
  readonly integrityCheckPassed: boolean;
  readonly stateRolledBack: boolean;
  readonly rollbackTickDelta: number;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

// ── ML vector compat ─────────────────────────────────────────────────────────

export interface ZeroEngineMLVectorCompat {
  readonly surface: 'zero_engine';
  readonly kind: 'ML_VECTOR';
  readonly runId: string;
  readonly tick: number;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly features: readonly number[];
  readonly featureNames: readonly string[];
  readonly featureCount: number;
  readonly anomalyScore: number;
  readonly predictionConfidence: number;
  readonly predictionLabel: string;
  readonly inferenceDurationMs: number;
  readonly generatedAtMs: number;
  readonly driftScore: number;
  readonly calibrationOffset: number;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

// ── DL tensor compat ─────────────────────────────────────────────────────────

export interface ZeroEngineDLTensorCompat {
  readonly surface: 'zero_engine';
  readonly kind: 'DL_TENSOR';
  readonly runId: string;
  readonly tick: number;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly shape: readonly number[];
  readonly data: readonly number[];
  readonly layerName: string;
  readonly activationFunction: string;
  readonly anomalyScore: number;
  readonly reconstructionError: number;
  readonly latentDim: number;
  readonly featureCount: number;
  readonly inferenceDurationMs: number;
  readonly generatedAtMs: number;
  readonly confidenceInterval: readonly [number, number];
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

// ── Health report compat ─────────────────────────────────────────────────────

export type ZeroEngineHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface ZeroEngineSubsystemHealth {
  readonly name: string;
  readonly grade: ZeroEngineHealthGrade;
  readonly errorRate: number;
  readonly avgLatencyMs: number;
  readonly p95LatencyMs: number;
  readonly memoryUsageBytes: number;
  readonly isResponsive: boolean;
  readonly lastHeartbeatMs: number;
  readonly warningCount: number;
  readonly criticalCount: number;
}

export interface ZeroEngineHealthReportCompat {
  readonly surface: 'zero_engine';
  readonly kind: 'HEALTH_REPORT';
  readonly runId: string;
  readonly tick: number;
  readonly overallGrade: ZeroEngineHealthGrade;
  readonly previousGrade: ZeroEngineHealthGrade | null;
  readonly subsystems: readonly ZeroEngineSubsystemHealth[];
  readonly subsystemCount: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly criticalCount: number;
  readonly totalErrorRate: number;
  readonly avgLatencyMs: number;
  readonly p95LatencyMs: number;
  readonly memoryUsageTotalBytes: number;
  readonly memoryLimitBytes: number;
  readonly memoryUtilization: number;
  readonly uptimeMs: number;
  readonly ticksSinceLastReport: number;
  readonly recommendations: readonly string[];
  readonly generatedAtMs: number;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

// ── Snapshot projection compat ───────────────────────────────────────────────

export type ZeroEngineSnapshotScope =
  | 'FULL'
  | 'INCREMENTAL'
  | 'DELTA'
  | 'CHECKPOINT'
  | 'DIAGNOSTIC';

export interface ZeroEngineSnapshotEntitySummary {
  readonly entityType: string;
  readonly entityCount: number;
  readonly dirtyCount: number;
  readonly bytesEstimate: number;
  readonly lastMutatedTick: number;
}

export interface ZeroEngineSnapshotProjectionCompat {
  readonly surface: 'zero_engine';
  readonly kind: 'SNAPSHOT_PROJECTION';
  readonly runId: string;
  readonly tick: number;
  readonly scope: ZeroEngineSnapshotScope;
  readonly projectedAtMs: number;
  readonly projectionDurationMs: number;
  readonly snapshotHash: string;
  readonly parentHash: string | null;
  readonly entitySummaries: readonly ZeroEngineSnapshotEntitySummary[];
  readonly totalEntities: number;
  readonly dirtyEntities: number;
  readonly totalBytesEstimate: number;
  readonly compressionRatio: number;
  readonly sequenceNumber: number;
  readonly isConsistent: boolean;
  readonly consistencyCheckDurationMs: number;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

// ── Chat bridge emission compat ──────────────────────────────────────────────

export type ZeroEngineChatBridgeTone =
  | 'NEUTRAL'
  | 'TENSE'
  | 'TRIUMPHANT'
  | 'DESPERATE'
  | 'CURIOUS'
  | 'OMINOUS'
  | 'CELEBRATORY'
  | 'MOURNING';

export type ZeroEngineChatBridgePriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT';

export interface ZeroEngineChatBridgeEmissionCompat {
  readonly surface: 'zero_engine';
  readonly kind: 'CHAT_BRIDGE_EMISSION';
  readonly runId: string;
  readonly tick: number;
  readonly bridgeChannel: string;
  readonly tone: ZeroEngineChatBridgeTone;
  readonly priority: ZeroEngineChatBridgePriority;
  readonly narrativeFragment: string;
  readonly triggerEvent: string;
  readonly triggerSeverity: 'info' | 'warn' | 'error';
  readonly suppressible: boolean;
  readonly ttlMs: number;
  readonly emittedAtMs: number;
  readonly targetRoomId?: string | null;
  readonly targetChannel?: string | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

// ── Aggregate orchestration signal ───────────────────────────────────────────

export type ZeroEngineOrchestrationSignalCompat =
  | ZeroEngineLifecycleTransitionCompat
  | ZeroEngineTickCompletionCompat
  | ZeroEngineOutcomeGateCompat
  | ZeroEngineQuarantineEntryCompat
  | ZeroEngineQuarantineExitCompat
  | ZeroEngineMLVectorCompat
  | ZeroEngineDLTensorCompat
  | ZeroEngineHealthReportCompat
  | ZeroEngineSnapshotProjectionCompat
  | ZeroEngineChatBridgeEmissionCompat;

// ─────────────────────────────────────────────────────────────────────────────
// Adapter infrastructure types
// ─────────────────────────────────────────────────────────────────────────────

export interface ZeroEngineSignalAdapterLogger {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  info(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ZeroEngineSignalAdapterClock {
  now(): UnixMs;
}

export interface ZeroEngineSignalAdapterOptions {
  readonly defaultRoomId: ChatRoomId | string;
  readonly defaultVisibleChannel?: ChatVisibleChannel;
  readonly dedupeWindowMs?: number;
  readonly maxHistory?: number;
  readonly anomalyThreshold?: number;
  readonly dlAnomalyThreshold?: number;
  readonly tickOverBudgetMultiplier?: number;
  readonly snapshotCadenceMs?: number;
  readonly suppressRoutineTickCompletions?: boolean;
  readonly suppressRoutineSnapshots?: boolean;
  readonly suppressLowPriorityBridgeEmissions?: boolean;
  readonly alwaysEmitLifecycleTransitions?: boolean;
  readonly alwaysEmitOutcomeGates?: boolean;
  readonly alwaysEmitQuarantineEvents?: boolean;
  readonly batchLimit?: number;
  readonly severityFloor?: ZeroEngineSignalAdapterSeverity;
  readonly logger?: ZeroEngineSignalAdapterLogger;
  readonly clock?: ZeroEngineSignalAdapterClock;
}

export interface ZeroEngineSignalAdapterContext {
  readonly roomId?: ChatRoomId | string | null;
  readonly routeChannel?: ChatVisibleChannel;
  readonly emittedAt?: number;
  readonly source?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export type ZeroEngineSignalAdapterEventName =
  | 'zero.lifecycle.booting'
  | 'zero.lifecycle.calibrating'
  | 'zero.lifecycle.ready'
  | 'zero.lifecycle.running'
  | 'zero.lifecycle.paused'
  | 'zero.lifecycle.draining'
  | 'zero.lifecycle.finalizing'
  | 'zero.lifecycle.shutdown'
  | 'zero.lifecycle.crashed'
  | 'zero.lifecycle.quarantined'
  | 'zero.tick.completed'
  | 'zero.tick.over_budget'
  | 'zero.tick.error'
  | 'zero.tick.timeout'
  | 'zero.tick.slow_step'
  | 'zero.outcome.pass'
  | 'zero.outcome.fail'
  | 'zero.outcome.defer'
  | 'zero.outcome.override'
  | 'zero.outcome.timeout'
  | 'zero.quarantine.entry'
  | 'zero.quarantine.exit'
  | 'zero.quarantine.recovered'
  | 'zero.quarantine.degraded'
  | 'zero.quarantine.failed'
  | 'zero.ml.anomaly'
  | 'zero.ml.drift'
  | 'zero.ml.prediction'
  | 'zero.dl.anomaly'
  | 'zero.dl.reconstruction_error'
  | 'zero.health.degraded'
  | 'zero.health.recovered'
  | 'zero.health.critical'
  | 'zero.health.subsystem_down'
  | 'zero.snapshot.projected'
  | 'zero.snapshot.inconsistency'
  | 'zero.bridge.emission'
  | 'zero.bridge.urgent'
  | string;

export type ZeroEngineSignalAdapterNarrativeWeight =
  | 'AMBIENT'
  | 'OPERATIONAL'
  | 'CRITICAL'
  | 'CINEMATIC';

export type ZeroEngineSignalAdapterSeverity =
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'CRITICAL';

export interface ZeroEngineSignalAdapterArtifact {
  readonly envelope: ChatInputEnvelope;
  readonly dedupeKey: string;
  readonly routeChannel: ChatVisibleChannel;
  readonly narrativeWeight: ZeroEngineSignalAdapterNarrativeWeight;
  readonly severity: ZeroEngineSignalAdapterSeverity;
  readonly eventName: ZeroEngineSignalAdapterEventName;
  readonly tick: number;
  readonly runId: string;
  readonly signalKind: string;
  readonly orchestrationPhase: string;
  readonly anomalyScore: Score01;
  readonly durationMs: number;
  readonly budgetMs: number;
  readonly isError: boolean;
  readonly isOverBudget: boolean;
  readonly isAnomaly: boolean;
  readonly isQuarantineEvent: boolean;
  readonly isLifecycleEvent: boolean;
  readonly isOutcomeEvent: boolean;
  readonly healthGrade: Nullable<string>;
  readonly completionRatio: Score01;
  readonly confidenceScore: Score01;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface ZeroEngineSignalAdapterRejection {
  readonly eventName: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface ZeroEngineSignalAdapterDeduped {
  readonly eventName: string;
  readonly dedupeKey: string;
  readonly reason: string;
  readonly details: Readonly<Record<string, JsonValue>>;
}

export interface ZeroEngineSignalAdapterHistoryEntry {
  readonly artifact: ZeroEngineSignalAdapterArtifact;
  readonly acceptedAt: UnixMs;
  readonly domainId: 'ZERO_ENGINE';
}

export interface ZeroEngineSignalAdapterState {
  readonly accepted: number;
  readonly rejected: number;
  readonly deduped: number;
  readonly lifecycleTransitions: number;
  readonly tickCompletions: number;
  readonly outcomeGates: number;
  readonly quarantineEntries: number;
  readonly quarantineExits: number;
  readonly mlVectors: number;
  readonly dlTensors: number;
  readonly healthReports: number;
  readonly healthDegradations: number;
  readonly healthRecoveries: number;
  readonly snapshotProjections: number;
  readonly bridgeEmissions: number;
  readonly errorSignals: number;
  readonly anomalySignals: number;
  readonly overBudgetSignals: number;
  readonly lastAcceptedAt: UnixMs | null;
  readonly lastHealthGrade: string | null;
  readonly lastLifecyclePhase: ZeroEngineLifecyclePhase | null;
  readonly lastQuarantineId: string | null;
  readonly currentPhase: ZeroEngineLifecyclePhase | null;
}

export interface ZeroEngineSignalAdapterReport {
  readonly state: ZeroEngineSignalAdapterState;
  readonly recentHistory: readonly ZeroEngineSignalAdapterHistoryEntry[];
  readonly recentRejections: readonly ZeroEngineSignalAdapterRejection[];
  readonly recentDeduped: readonly ZeroEngineSignalAdapterDeduped[];
  readonly domainId: 'ZERO_ENGINE';
  readonly generatedAt: UnixMs;
}

export interface ZeroEngineSignalAdapterDiagnostics {
  readonly adapterVersion: string;
  readonly state: ZeroEngineSignalAdapterState;
  readonly dedupeMapSize: number;
  readonly historyLength: number;
  readonly rejectionLength: number;
  readonly dedupedLength: number;
  readonly snapshotTimestampMap: readonly { readonly runId: string; readonly lastMs: number }[];
  readonly domainId: 'ZERO_ENGINE';
  readonly generatedAt: UnixMs;
}

export interface ZeroEngineSignalAdapterReadiness {
  readonly ready: boolean;
  readonly reason: string;
  readonly adapterVersion: string;
  readonly optionsSnapshot: Readonly<Record<string, JsonValue>>;
  readonly domainId: 'ZERO_ENGINE';
  readonly checkedAt: UnixMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_ANOMALY_THRESHOLD = 0.6;
const DEFAULT_DL_ANOMALY_THRESHOLD = 0.55;
const DEFAULT_TICK_OVER_BUDGET_MULTIPLIER = 2.5;
const DEFAULT_DEDUPE_WINDOW_MS = 3_000;
const DEFAULT_MAX_HISTORY = 128;
const DEFAULT_SNAPSHOT_CADENCE_MS = 15_000;
const DEFAULT_BATCH_LIMIT = 64;

const SEVERITY_RANK: Readonly<Record<ZeroEngineSignalAdapterSeverity, number>> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  CRITICAL: 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper functions
// ─────────────────────────────────────────────────────────────────────────────

function lifecycleToEventName(
  nextPhase: ZeroEngineLifecyclePhase,
): ZeroEngineSignalAdapterEventName {
  const MAP: Record<ZeroEngineLifecyclePhase, ZeroEngineSignalAdapterEventName> = {
    UNINITIALIZED: 'zero.lifecycle.booting',
    BOOTING: 'zero.lifecycle.booting',
    CALIBRATING: 'zero.lifecycle.calibrating',
    READY: 'zero.lifecycle.ready',
    RUNNING: 'zero.lifecycle.running',
    PAUSED: 'zero.lifecycle.paused',
    DRAINING: 'zero.lifecycle.draining',
    FINALIZING: 'zero.lifecycle.finalizing',
    SHUTDOWN: 'zero.lifecycle.shutdown',
    CRASHED: 'zero.lifecycle.crashed',
    QUARANTINED: 'zero.lifecycle.quarantined',
  };
  return MAP[nextPhase] ?? `zero.lifecycle.${nextPhase.toLowerCase()}`;
}

function tickOutcomeToEventName(
  outcome: ZeroEngineTickOutcome,
  isOverBudget: boolean,
): ZeroEngineSignalAdapterEventName {
  if (outcome === 'ERROR') return 'zero.tick.error';
  if (outcome === 'TIMEOUT') return 'zero.tick.timeout';
  if (isOverBudget) return 'zero.tick.over_budget';
  return 'zero.tick.completed';
}

function outcomeVerdictToEventName(
  verdict: ZeroEngineOutcomeVerdict,
): ZeroEngineSignalAdapterEventName {
  const MAP: Record<ZeroEngineOutcomeVerdict, ZeroEngineSignalAdapterEventName> = {
    PASS: 'zero.outcome.pass',
    FAIL: 'zero.outcome.fail',
    DEFER: 'zero.outcome.defer',
    OVERRIDE: 'zero.outcome.override',
    TIMEOUT: 'zero.outcome.timeout',
  };
  return MAP[verdict];
}

function quarantineExitToEventName(
  recoveryOutcome: 'RECOVERED' | 'DEGRADED' | 'FAILED',
): ZeroEngineSignalAdapterEventName {
  const MAP: Record<string, ZeroEngineSignalAdapterEventName> = {
    RECOVERED: 'zero.quarantine.recovered',
    DEGRADED: 'zero.quarantine.degraded',
    FAILED: 'zero.quarantine.failed',
  };
  return MAP[recoveryOutcome] ?? 'zero.quarantine.exit';
}

function mapLifecycleSeverity(
  nextPhase: ZeroEngineLifecyclePhase,
): ZeroEngineSignalAdapterSeverity {
  if (nextPhase === 'CRASHED') return 'CRITICAL';
  if (nextPhase === 'QUARANTINED') return 'CRITICAL';
  if (nextPhase === 'DRAINING' || nextPhase === 'FINALIZING') return 'WARN';
  if (nextPhase === 'SHUTDOWN') return 'WARN';
  if (nextPhase === 'PAUSED') return 'INFO';
  return 'INFO';
}

function mapTickSeverity(
  outcome: ZeroEngineTickOutcome,
  isOverBudget: boolean,
  errorCount: number,
): ZeroEngineSignalAdapterSeverity {
  if (outcome === 'ERROR' || errorCount > 0) return 'CRITICAL';
  if (outcome === 'TIMEOUT') return 'CRITICAL';
  if (isOverBudget) return 'WARN';
  if (outcome === 'PARTIAL') return 'WARN';
  return 'INFO';
}

function mapOutcomeSeverity(
  verdict: ZeroEngineOutcomeVerdict,
): ZeroEngineSignalAdapterSeverity {
  if (verdict === 'FAIL') return 'WARN';
  if (verdict === 'TIMEOUT') return 'CRITICAL';
  if (verdict === 'OVERRIDE') return 'WARN';
  return 'INFO';
}

function mapQuarantineEntrySeverity(
  severity: 'warn' | 'error' | 'critical',
): ZeroEngineSignalAdapterSeverity {
  if (severity === 'critical') return 'CRITICAL';
  if (severity === 'error') return 'CRITICAL';
  return 'WARN';
}

function mapQuarantineExitSeverity(
  recoveryOutcome: 'RECOVERED' | 'DEGRADED' | 'FAILED',
): ZeroEngineSignalAdapterSeverity {
  if (recoveryOutcome === 'FAILED') return 'CRITICAL';
  if (recoveryOutcome === 'DEGRADED') return 'WARN';
  return 'INFO';
}

function mapHealthReportSeverity(
  grade: ZeroEngineHealthGrade,
  previousGrade: ZeroEngineHealthGrade | null,
): ZeroEngineSignalAdapterSeverity {
  if (grade === 'F') return 'CRITICAL';
  if (grade === 'D') return 'CRITICAL';
  if (grade === 'C') return 'WARN';
  const passingNow = grade === 'S' || grade === 'A' || grade === 'B';
  const passingBefore = previousGrade === null || previousGrade === 'S' || previousGrade === 'A' || previousGrade === 'B';
  if (!passingNow && passingBefore) return 'CRITICAL';
  if (passingNow && !passingBefore) return 'INFO';
  return 'INFO';
}

function mapSnapshotSeverity(
  isConsistent: boolean,
): ZeroEngineSignalAdapterSeverity {
  return isConsistent ? 'DEBUG' : 'WARN';
}

function mapBridgeSeverity(
  priority: ZeroEngineChatBridgePriority,
  triggerSeverity: 'info' | 'warn' | 'error',
): ZeroEngineSignalAdapterSeverity {
  if (priority === 'URGENT' || triggerSeverity === 'error') return 'CRITICAL';
  if (priority === 'HIGH' || triggerSeverity === 'warn') return 'WARN';
  return 'INFO';
}

function mapNarrativeWeight(
  severity: ZeroEngineSignalAdapterSeverity,
  isLifecycle: boolean,
  isOutcome: boolean,
  isQuarantine: boolean,
): ZeroEngineSignalAdapterNarrativeWeight {
  if (severity === 'CRITICAL') return 'CRITICAL';
  if (isQuarantine) return 'CRITICAL';
  if (isOutcome) return 'CINEMATIC';
  if (isLifecycle) return 'OPERATIONAL';
  if (severity === 'WARN') return 'OPERATIONAL';
  return 'AMBIENT';
}

function severityMeetsFloor(
  severity: ZeroEngineSignalAdapterSeverity,
  floor: ZeroEngineSignalAdapterSeverity,
): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[floor];
}

function gradeIsPassing(grade: ZeroEngineHealthGrade | string | null): boolean {
  return grade === 'S' || grade === 'A' || grade === 'B';
}

function buildRunSignalEnvelope(
  emittedAt: UnixMs,
  roomId: ChatRoomId,
  metadata: Readonly<Record<string, JsonValue>>,
): ChatSignalEnvelope {
  return Object.freeze({
    type: 'RUN' as const,
    emittedAt,
    roomId,
    metadata,
  });
}

function buildChatInputEnvelope(
  emittedAt: UnixMs,
  signalPayload: ChatSignalEnvelope,
): ChatInputEnvelope {
  return Object.freeze({
    kind: 'RUN_SIGNAL' as const,
    emittedAt,
    payload: signalPayload,
  });
}

function buildDetails(
  base: Record<string, JsonValue>,
  contextMeta?: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  const merged = contextMeta ? { ...base, ...contextMeta } : base;
  return Object.freeze(merged);
}

function buildTags(
  contextTags: readonly string[] | undefined,
  ...extra: string[]
): readonly string[] {
  const tags = [...(contextTags ?? []), ...extra];
  return Object.freeze(tags);
}

// ─────────────────────────────────────────────────────────────────────────────
// ZeroEngineSignalAdapter — main adapter class
// ─────────────────────────────────────────────────────────────────────────────

export class ZeroEngineSignalAdapter {
  private readonly _opts: {
    readonly defaultRoomId: ChatRoomId | string;
    readonly defaultVisibleChannel: ChatVisibleChannel;
    readonly dedupeWindowMs: number;
    readonly maxHistory: number;
    readonly anomalyThreshold: number;
    readonly dlAnomalyThreshold: number;
    readonly tickOverBudgetMultiplier: number;
    readonly snapshotCadenceMs: number;
    readonly suppressRoutineTickCompletions: boolean;
    readonly suppressRoutineSnapshots: boolean;
    readonly suppressLowPriorityBridgeEmissions: boolean;
    readonly alwaysEmitLifecycleTransitions: boolean;
    readonly alwaysEmitOutcomeGates: boolean;
    readonly alwaysEmitQuarantineEvents: boolean;
    readonly batchLimit: number;
    readonly severityFloor: ZeroEngineSignalAdapterSeverity;
    readonly logger: ZeroEngineSignalAdapterLogger | null;
    readonly clock: ZeroEngineSignalAdapterClock;
  };

  // ── Counters ──────────────────────────────────────────────────────────────
  private _accepted = 0;
  private _rejected = 0;
  private _deduped = 0;
  private _lifecycleTransitions = 0;
  private _tickCompletions = 0;
  private _outcomeGates = 0;
  private _quarantineEntries = 0;
  private _quarantineExits = 0;
  private _mlVectors = 0;
  private _dlTensors = 0;
  private _healthReports = 0;
  private _healthDegradations = 0;
  private _healthRecoveries = 0;
  private _snapshotProjections = 0;
  private _bridgeEmissions = 0;
  private _errorSignals = 0;
  private _anomalySignals = 0;
  private _overBudgetSignals = 0;
  private _lastAcceptedAt: UnixMs | null = null;
  private _lastHealthGrade: string | null = null;
  private _lastLifecyclePhase: ZeroEngineLifecyclePhase | null = null;
  private _lastQuarantineId: string | null = null;
  private _currentPhase: ZeroEngineLifecyclePhase | null = null;

  // ── Buffers ───────────────────────────────────────────────────────────────
  private readonly _history: ZeroEngineSignalAdapterHistoryEntry[] = [];
  private readonly _rejections: ZeroEngineSignalAdapterRejection[] = [];
  private readonly _dedupedList: ZeroEngineSignalAdapterDeduped[] = [];
  private readonly _dedupeCache = new Map<string, number>();
  private readonly _snapshotTimestamps = new Map<string, number>();

  public constructor(options: ZeroEngineSignalAdapterOptions) {
    this._opts = {
      defaultRoomId: options.defaultRoomId,
      defaultVisibleChannel: options.defaultVisibleChannel ?? 'LOBBY',
      dedupeWindowMs: options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
      maxHistory: options.maxHistory ?? DEFAULT_MAX_HISTORY,
      anomalyThreshold: options.anomalyThreshold ?? DEFAULT_ANOMALY_THRESHOLD,
      dlAnomalyThreshold: options.dlAnomalyThreshold ?? DEFAULT_DL_ANOMALY_THRESHOLD,
      tickOverBudgetMultiplier: options.tickOverBudgetMultiplier ?? DEFAULT_TICK_OVER_BUDGET_MULTIPLIER,
      snapshotCadenceMs: options.snapshotCadenceMs ?? DEFAULT_SNAPSHOT_CADENCE_MS,
      suppressRoutineTickCompletions: options.suppressRoutineTickCompletions ?? true,
      suppressRoutineSnapshots: options.suppressRoutineSnapshots ?? true,
      suppressLowPriorityBridgeEmissions: options.suppressLowPriorityBridgeEmissions ?? false,
      alwaysEmitLifecycleTransitions: options.alwaysEmitLifecycleTransitions ?? true,
      alwaysEmitOutcomeGates: options.alwaysEmitOutcomeGates ?? true,
      alwaysEmitQuarantineEvents: options.alwaysEmitQuarantineEvents ?? true,
      batchLimit: options.batchLimit ?? DEFAULT_BATCH_LIMIT,
      severityFloor: options.severityFloor ?? 'DEBUG',
      logger: options.logger ?? null,
      clock: options.clock ?? { now: () => asUnixMs(Date.now()) },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE TRANSITION
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptLifecycleTransition(
    signal: ZeroEngineLifecycleTransitionCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const now = this._opts.clock.now();
    const eventName = lifecycleToEventName(signal.nextPhase);
    const severity = mapLifecycleSeverity(signal.nextPhase);

    if (!severityMeetsFloor(severity, this._opts.severityFloor) && !this._opts.alwaysEmitLifecycleTransitions) {
      return this._reject(eventName, 'Lifecycle severity below floor', {
        nextPhase: signal.nextPhase,
        previousPhase: signal.previousPhase,
        tick: signal.tick,
        severityFloor: this._opts.severityFloor,
      });
    }

    const dedupeKey = `${signal.runId}::lifecycle::${signal.previousPhase}::${signal.nextPhase}`;
    const dedupeResult = this._checkDedupe(dedupeKey, eventName, now, this._opts.alwaysEmitLifecycleTransitions, {
      runId: signal.runId,
      previousPhase: signal.previousPhase,
      nextPhase: signal.nextPhase,
      tick: signal.tick,
    });
    if (dedupeResult !== null) return dedupeResult;

    const isError = signal.nextPhase === 'CRASHED';
    const narrativeWeight = mapNarrativeWeight(severity, true, false, signal.nextPhase === 'QUARANTINED');
    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const anomalyScore = clamp01(isError ? 1.0 : signal.nextPhase === 'QUARANTINED' ? 0.9 : 0);

    const details = buildDetails({
      signalKind: signal.kind,
      previousPhase: signal.previousPhase,
      nextPhase: signal.nextPhase,
      reason: signal.reason,
      transitionDurationMs: signal.transitionDurationMs,
      orchestratorVersion: signal.orchestratorVersion,
      uptimeMs: signal.uptimeMs,
      tick: signal.tick,
      runId: signal.runId,
      ...(signal.errorMessage ? { errorMessage: signal.errorMessage } : {}),
      ...(signal.triggerSource ? { triggerSource: signal.triggerSource } : {}),
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      `lifecycle:${signal.nextPhase.toLowerCase()}`,
      `from:${signal.previousPhase.toLowerCase()}`,
      `severity:${severity.toLowerCase()}`,
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'LIFECYCLE_TRANSITION',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      previousPhase: signal.previousPhase,
      nextPhase: signal.nextPhase,
      reason: signal.reason,
      transitionDurationMs: signal.transitionDurationMs,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._lastLifecyclePhase = signal.previousPhase;
    this._currentPhase = signal.nextPhase;
    this._lifecycleTransitions++;
    if (isError) this._errorSignals++;

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'LIFECYCLE_TRANSITION',
      orchestrationPhase: signal.nextPhase,
      anomalyScore,
      durationMs: signal.transitionDurationMs,
      budgetMs: 0,
      isError,
      isOverBudget: false,
      isAnomaly: anomalyScore >= this._opts.anomalyThreshold,
      isQuarantineEvent: signal.nextPhase === 'QUARANTINED',
      isLifecycleEvent: true,
      isOutcomeEvent: false,
      healthGrade: null,
      completionRatio: clamp01(0) as Score01,
      confidenceScore: clamp01(1.0) as Score01,
      details,
    }, now);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TICK COMPLETION
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptTickCompletion(
    signal: ZeroEngineTickCompletionCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const now = this._opts.clock.now();
    const isOverBudget = signal.isOverBudget || signal.totalDurationMs > signal.budgetMs * this._opts.tickOverBudgetMultiplier;
    const hasErrors = signal.errorCount > 0;
    const isTimeout = signal.outcome === 'TIMEOUT';
    const eventName = tickOutcomeToEventName(signal.outcome, isOverBudget);
    const severity = mapTickSeverity(signal.outcome, isOverBudget, signal.errorCount);

    const isRoutine = signal.outcome === 'SUCCESS' && !isOverBudget && !hasErrors;
    if (isRoutine && this._opts.suppressRoutineTickCompletions) {
      return this._reject(eventName, 'Routine tick completion suppressed', {
        tick: signal.tick,
        runId: signal.runId,
        outcome: signal.outcome,
        totalDurationMs: signal.totalDurationMs,
      });
    }

    if (!severityMeetsFloor(severity, this._opts.severityFloor) && !hasErrors && !isTimeout) {
      return this._reject(eventName, 'Tick severity below floor', {
        tick: signal.tick,
        runId: signal.runId,
        severity,
        severityFloor: this._opts.severityFloor,
      });
    }

    const alwaysAccept = hasErrors || isTimeout || isOverBudget;
    const dedupeKey = `${signal.runId}::tick::${signal.outcome}::${signal.tick}`;
    const dedupeResult = this._checkDedupe(dedupeKey, eventName, now, alwaysAccept, {
      runId: signal.runId,
      tick: signal.tick,
      outcome: signal.outcome,
    });
    if (dedupeResult !== null) return dedupeResult;

    const narrativeWeight = mapNarrativeWeight(severity, false, false, false);
    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const completionRatio = clamp01(signal.stepsCompleted / Math.max(1, signal.stepsTotal));
    const anomalyScore = clamp01(
      (hasErrors ? 0.5 : 0) +
      (isOverBudget ? signal.overBudgetRatio * 0.3 : 0) +
      (isTimeout ? 0.4 : 0),
    );

    const slowStepDetails: Record<string, JsonValue> = {};
    let hasSlow = false;
    for (const step of signal.stepResults) {
      if (step.durationMs > step.budgetMs * this._opts.tickOverBudgetMultiplier) {
        slowStepDetails[`slowStep_${step.stepName}`] = {
          durationMs: step.durationMs,
          budgetMs: step.budgetMs,
          ratio: Math.round((step.durationMs / Math.max(1, step.budgetMs)) * 100) / 100,
          outcome: step.outcome,
        };
        hasSlow = true;
      }
    }

    const errorStepDetails: Record<string, JsonValue> = {};
    for (const step of signal.stepResults) {
      if (step.outcome === 'ERROR' && step.errorMessage) {
        errorStepDetails[`errorStep_${step.stepName}`] = {
          errorMessage: step.errorMessage,
          durationMs: step.durationMs,
          retryCount: step.retryCount,
        };
      }
    }

    const details = buildDetails({
      signalKind: signal.kind,
      tick: signal.tick,
      runId: signal.runId,
      outcome: signal.outcome,
      totalDurationMs: signal.totalDurationMs,
      budgetMs: signal.budgetMs,
      stepsCompleted: signal.stepsCompleted,
      stepsTotal: signal.stepsTotal,
      errorCount: signal.errorCount,
      warningCount: signal.warningCount,
      isOverBudget,
      overBudgetRatio: signal.overBudgetRatio,
      ticksPerSecond: signal.ticksPerSecond,
      avgStepDurationMs: signal.avgStepDurationMs,
      memoryUsageBytes: signal.memoryUsageBytes,
      gcPauseTotalMs: signal.gcPauseTotalMs,
      ...(signal.slowestStepName ? { slowestStepName: signal.slowestStepName } : {}),
      ...(signal.slowestStepDurationMs > 0 ? { slowestStepDurationMs: signal.slowestStepDurationMs } : {}),
      ...(hasSlow ? slowStepDetails : {}),
      ...errorStepDetails,
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      `tick:${signal.tick}`,
      `outcome:${signal.outcome.toLowerCase()}`,
      `severity:${severity.toLowerCase()}`,
      ...(isOverBudget ? ['over_budget'] : []),
      ...(hasErrors ? ['has_errors'] : []),
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'TICK_COMPLETION',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      outcome: signal.outcome,
      totalDurationMs: signal.totalDurationMs,
      budgetMs: signal.budgetMs,
      stepsCompleted: signal.stepsCompleted,
      stepsTotal: signal.stepsTotal,
      completionRatio,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._tickCompletions++;
    if (hasErrors) this._errorSignals++;
    if (isOverBudget) this._overBudgetSignals++;
    if (anomalyScore >= this._opts.anomalyThreshold) this._anomalySignals++;

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'TICK_COMPLETION',
      orchestrationPhase: signal.outcome,
      anomalyScore,
      durationMs: signal.totalDurationMs,
      budgetMs: signal.budgetMs,
      isError: hasErrors || isTimeout,
      isOverBudget,
      isAnomaly: anomalyScore >= this._opts.anomalyThreshold,
      isQuarantineEvent: false,
      isLifecycleEvent: false,
      isOutcomeEvent: false,
      healthGrade: null,
      completionRatio,
      confidenceScore: clamp01(1.0 - anomalyScore) as Score01,
      details,
    }, now);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTCOME GATE
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptOutcomeGate(
    signal: ZeroEngineOutcomeGateCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const now = this._opts.clock.now();
    const eventName = outcomeVerdictToEventName(signal.verdict);
    const severity = mapOutcomeSeverity(signal.verdict);

    if (!severityMeetsFloor(severity, this._opts.severityFloor) && !this._opts.alwaysEmitOutcomeGates) {
      return this._reject(eventName, 'Outcome gate severity below floor', {
        gateKind: signal.gateKind,
        verdict: signal.verdict,
        tick: signal.tick,
      });
    }

    const dedupeKey = `${signal.runId}::outcome::${signal.gateKind}::${signal.verdict}::${signal.gateIndex}`;
    const dedupeResult = this._checkDedupe(dedupeKey, eventName, now, this._opts.alwaysEmitOutcomeGates, {
      runId: signal.runId,
      gateKind: signal.gateKind,
      verdict: signal.verdict,
      tick: signal.tick,
    });
    if (dedupeResult !== null) return dedupeResult;

    const narrativeWeight = mapNarrativeWeight(severity, false, true, false);
    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const confidenceScore = clamp01(signal.confidenceScore);
    const anomalyScore = clamp01(signal.verdict === 'TIMEOUT' ? 0.8 : signal.verdict === 'OVERRIDE' ? 0.6 : 0);
    const completionRatio = clamp01(signal.gateIndex / Math.max(1, signal.gatesTotal));

    const details = buildDetails({
      signalKind: signal.kind,
      tick: signal.tick,
      runId: signal.runId,
      gateKind: signal.gateKind,
      verdict: signal.verdict,
      reason: signal.reason,
      evaluationDurationMs: signal.evaluationDurationMs,
      confidenceScore: signal.confidenceScore,
      playerScore: signal.playerScore,
      opponentScore: signal.opponentScore,
      thresholdValue: signal.thresholdValue,
      actualValue: signal.actualValue,
      gateIndex: signal.gateIndex,
      gatesTotal: signal.gatesTotal,
      affectedPlayerCount: signal.affectedPlayerIds.length,
      ...(signal.overrideSource ? { overrideSource: signal.overrideSource } : {}),
      ...(signal.overrideReason ? { overrideReason: signal.overrideReason } : {}),
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      `gate:${signal.gateKind.toLowerCase()}`,
      `verdict:${signal.verdict.toLowerCase()}`,
      `severity:${severity.toLowerCase()}`,
      `gate_index:${signal.gateIndex}`,
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'OUTCOME_GATE',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      gateKind: signal.gateKind,
      verdict: signal.verdict,
      reason: signal.reason,
      confidenceScore: signal.confidenceScore,
      playerScore: signal.playerScore,
      opponentScore: signal.opponentScore,
      completionRatio,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._outcomeGates++;
    if (signal.verdict === 'TIMEOUT') this._errorSignals++;
    if (anomalyScore >= this._opts.anomalyThreshold) this._anomalySignals++;

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'OUTCOME_GATE',
      orchestrationPhase: `${signal.gateKind}::${signal.verdict}`,
      anomalyScore,
      durationMs: signal.evaluationDurationMs,
      budgetMs: 0,
      isError: signal.verdict === 'TIMEOUT',
      isOverBudget: false,
      isAnomaly: anomalyScore >= this._opts.anomalyThreshold,
      isQuarantineEvent: false,
      isLifecycleEvent: false,
      isOutcomeEvent: true,
      healthGrade: null,
      completionRatio,
      confidenceScore,
      details,
    }, now);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUARANTINE ENTRY
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptQuarantineEntry(
    signal: ZeroEngineQuarantineEntryCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const now = this._opts.clock.now();
    const eventName: ZeroEngineSignalAdapterEventName = 'zero.quarantine.entry';
    const severity = mapQuarantineEntrySeverity(signal.severity);

    if (!severityMeetsFloor(severity, this._opts.severityFloor) && !this._opts.alwaysEmitQuarantineEvents) {
      return this._reject(eventName, 'Quarantine entry severity below floor', {
        reason: signal.reason,
        quarantineId: signal.quarantineId,
        tick: signal.tick,
      });
    }

    const dedupeKey = `${signal.runId}::quarantine_entry::${signal.quarantineId}`;
    const dedupeResult = this._checkDedupe(dedupeKey, eventName, now, this._opts.alwaysEmitQuarantineEvents, {
      runId: signal.runId,
      quarantineId: signal.quarantineId,
      reason: signal.reason,
      tick: signal.tick,
    });
    if (dedupeResult !== null) return dedupeResult;

    const narrativeWeight = mapNarrativeWeight(severity, false, false, true);
    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const anomalyScore = clamp01(signal.severity === 'critical' ? 1.0 : signal.severity === 'error' ? 0.85 : 0.7);

    const details = buildDetails({
      signalKind: signal.kind,
      tick: signal.tick,
      runId: signal.runId,
      reason: signal.reason,
      severity: signal.severity,
      message: signal.message,
      quarantineId: signal.quarantineId,
      estimatedRecoveryMs: signal.estimatedRecoveryMs,
      affectedSubsystems: signal.affectedSubsystems as unknown as JsonValue,
      snapshotHash: signal.snapshotHash,
      canAutoRecover: signal.canAutoRecover,
      recoveryStrategy: signal.recoveryStrategy,
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      'quarantine:entry',
      `reason:${signal.reason.toLowerCase()}`,
      `severity:${severity.toLowerCase()}`,
      `quarantine_id:${signal.quarantineId}`,
      ...(signal.canAutoRecover ? ['auto_recoverable'] : ['manual_intervention']),
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'QUARANTINE_ENTRY',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      quarantineReason: signal.reason,
      quarantineId: signal.quarantineId,
      message: signal.message,
      canAutoRecover: signal.canAutoRecover,
      recoveryStrategy: signal.recoveryStrategy,
      estimatedRecoveryMs: signal.estimatedRecoveryMs,
      affectedSubsystemCount: signal.affectedSubsystems.length,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._quarantineEntries++;
    this._lastQuarantineId = signal.quarantineId;
    this._errorSignals++;
    if (anomalyScore >= this._opts.anomalyThreshold) this._anomalySignals++;

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'QUARANTINE_ENTRY',
      orchestrationPhase: `QUARANTINE::${signal.reason}`,
      anomalyScore,
      durationMs: 0,
      budgetMs: 0,
      isError: true,
      isOverBudget: false,
      isAnomaly: true,
      isQuarantineEvent: true,
      isLifecycleEvent: false,
      isOutcomeEvent: false,
      healthGrade: null,
      completionRatio: clamp01(0) as Score01,
      confidenceScore: clamp01(0) as Score01,
      details,
    }, now);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUARANTINE EXIT
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptQuarantineExit(
    signal: ZeroEngineQuarantineExitCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const now = this._opts.clock.now();
    const eventName = quarantineExitToEventName(signal.recoveryOutcome);
    const severity = mapQuarantineExitSeverity(signal.recoveryOutcome);

    if (!severityMeetsFloor(severity, this._opts.severityFloor) && !this._opts.alwaysEmitQuarantineEvents) {
      return this._reject(eventName, 'Quarantine exit severity below floor', {
        quarantineId: signal.quarantineId,
        recoveryOutcome: signal.recoveryOutcome,
        tick: signal.tick,
      });
    }

    const dedupeKey = `${signal.runId}::quarantine_exit::${signal.quarantineId}::${signal.recoveryOutcome}`;
    const dedupeResult = this._checkDedupe(dedupeKey, eventName, now, this._opts.alwaysEmitQuarantineEvents, {
      runId: signal.runId,
      quarantineId: signal.quarantineId,
      recoveryOutcome: signal.recoveryOutcome,
      tick: signal.tick,
    });
    if (dedupeResult !== null) return dedupeResult;

    const narrativeWeight = mapNarrativeWeight(severity, false, false, true);
    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const isRecovered = signal.recoveryOutcome === 'RECOVERED';
    const isFailed = signal.recoveryOutcome === 'FAILED';
    const anomalyScore = clamp01(isFailed ? 0.95 : isRecovered ? 0.2 : 0.6);

    const details = buildDetails({
      signalKind: signal.kind,
      tick: signal.tick,
      runId: signal.runId,
      quarantineId: signal.quarantineId,
      reason: signal.reason,
      recoveryOutcome: signal.recoveryOutcome,
      durationMs: signal.durationMs,
      integrityCheckPassed: signal.integrityCheckPassed,
      stateRolledBack: signal.stateRolledBack,
      rollbackTickDelta: signal.rollbackTickDelta,
      recoveryStepCount: signal.recoveryStepsTaken.length,
      recoverySteps: signal.recoveryStepsTaken as unknown as JsonValue,
      message: signal.message,
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      'quarantine:exit',
      `recovery:${signal.recoveryOutcome.toLowerCase()}`,
      `severity:${severity.toLowerCase()}`,
      `quarantine_id:${signal.quarantineId}`,
      ...(signal.stateRolledBack ? ['state_rolled_back'] : []),
      ...(signal.integrityCheckPassed ? ['integrity_passed'] : ['integrity_failed']),
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'QUARANTINE_EXIT',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      quarantineId: signal.quarantineId,
      quarantineReason: signal.reason,
      recoveryOutcome: signal.recoveryOutcome,
      durationMs: signal.durationMs,
      message: signal.message,
      integrityCheckPassed: signal.integrityCheckPassed,
      stateRolledBack: signal.stateRolledBack,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._quarantineExits++;
    if (isFailed) this._errorSignals++;
    if (anomalyScore >= this._opts.anomalyThreshold) this._anomalySignals++;

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'QUARANTINE_EXIT',
      orchestrationPhase: `QUARANTINE_EXIT::${signal.recoveryOutcome}`,
      anomalyScore,
      durationMs: signal.durationMs,
      budgetMs: 0,
      isError: isFailed,
      isOverBudget: false,
      isAnomaly: anomalyScore >= this._opts.anomalyThreshold,
      isQuarantineEvent: true,
      isLifecycleEvent: false,
      isOutcomeEvent: false,
      healthGrade: null,
      completionRatio: clamp01(isRecovered ? 1.0 : isFailed ? 0.0 : 0.5) as Score01,
      confidenceScore: clamp01(signal.integrityCheckPassed ? 0.9 : 0.3) as Score01,
      details,
    }, now);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ML VECTOR
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptMLVector(
    signal: ZeroEngineMLVectorCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection {
    const now = this._opts.clock.now();
    const anomalyScore = clamp01(signal.anomalyScore);

    if (anomalyScore < this._opts.anomalyThreshold) {
      const driftExceeds = signal.driftScore > 0.5;
      if (!driftExceeds) {
        return this._reject('zero.ml.anomaly', `ML anomaly score ${anomalyScore.toFixed(3)} below threshold ${this._opts.anomalyThreshold}`, {
          tick: signal.tick,
          runId: signal.runId,
          modelName: signal.modelName,
          anomalyScore,
          driftScore: signal.driftScore,
          featureCount: signal.featureCount,
        });
      }
    }

    const hasDrift = signal.driftScore > 0.3;
    const eventName: ZeroEngineSignalAdapterEventName = hasDrift ? 'zero.ml.drift' : 'zero.ml.anomaly';
    const severity: ZeroEngineSignalAdapterSeverity = anomalyScore >= 0.9 ? 'CRITICAL' : anomalyScore >= 0.7 ? 'WARN' : 'INFO';
    const narrativeWeight = mapNarrativeWeight(severity, false, false, false);
    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const confidenceScore = clamp01(signal.predictionConfidence);

    const topFeatureIndices = identifyTopFeatures(signal.features, 5);
    const topFeatures: Record<string, JsonValue> = {};
    for (const idx of topFeatureIndices) {
      const name = signal.featureNames[idx] ?? `feature_${idx}`;
      topFeatures[name] = signal.features[idx] ?? 0;
    }

    const details = buildDetails({
      signalKind: signal.kind,
      tick: signal.tick,
      runId: signal.runId,
      modelName: signal.modelName,
      modelVersion: signal.modelVersion,
      anomalyScore,
      predictionConfidence: signal.predictionConfidence,
      predictionLabel: signal.predictionLabel,
      driftScore: signal.driftScore,
      calibrationOffset: signal.calibrationOffset,
      inferenceDurationMs: signal.inferenceDurationMs,
      featureCount: signal.featureCount,
      topFeatures,
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      `model:${signal.modelName}`,
      `severity:${severity.toLowerCase()}`,
      `prediction:${signal.predictionLabel}`,
      ...(hasDrift ? ['drift_detected'] : []),
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'ML_VECTOR',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      modelName: signal.modelName,
      predictionLabel: signal.predictionLabel,
      predictionConfidence: signal.predictionConfidence,
      driftScore: signal.driftScore,
      inferenceDurationMs: signal.inferenceDurationMs,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._mlVectors++;
    if (anomalyScore >= this._opts.anomalyThreshold) this._anomalySignals++;

    const dedupeKey = `${signal.runId}::ml::${signal.modelName}::${signal.tick}`;
    this._dedupeCache.set(dedupeKey, now);

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'ML_VECTOR',
      orchestrationPhase: 'OBSERVABILITY',
      anomalyScore,
      durationMs: signal.inferenceDurationMs,
      budgetMs: 0,
      isError: false,
      isOverBudget: false,
      isAnomaly: anomalyScore >= this._opts.anomalyThreshold,
      isQuarantineEvent: false,
      isLifecycleEvent: false,
      isOutcomeEvent: false,
      healthGrade: null,
      completionRatio: clamp01(0) as Score01,
      confidenceScore,
      details,
    }, now);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DL TENSOR
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptDLTensor(
    signal: ZeroEngineDLTensorCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection {
    const now = this._opts.clock.now();
    const anomalyScore = clamp01(signal.anomalyScore);
    const reconstructionError = signal.reconstructionError;

    if (anomalyScore < this._opts.dlAnomalyThreshold && reconstructionError < 0.4) {
      return this._reject('zero.dl.anomaly', `DL anomaly score ${anomalyScore.toFixed(3)} below threshold ${this._opts.dlAnomalyThreshold}, reconstruction error ${reconstructionError.toFixed(3)}`, {
        tick: signal.tick,
        runId: signal.runId,
        modelName: signal.modelName,
        anomalyScore,
        reconstructionError,
        featureCount: signal.featureCount,
      });
    }

    const hasHighReconstruction = reconstructionError >= 0.6;
    const eventName: ZeroEngineSignalAdapterEventName = hasHighReconstruction ? 'zero.dl.reconstruction_error' : 'zero.dl.anomaly';
    const severity: ZeroEngineSignalAdapterSeverity = anomalyScore >= 0.9 || reconstructionError >= 0.8 ? 'CRITICAL' : anomalyScore >= 0.7 || reconstructionError >= 0.6 ? 'WARN' : 'INFO';
    const narrativeWeight = mapNarrativeWeight(severity, false, false, false);
    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const confidenceInterval01Low = clamp01(signal.confidenceInterval[0] ?? 0);
    const confidenceInterval01High = clamp01(signal.confidenceInterval[1] ?? 1);
    const confidenceWidth = Math.abs(confidenceInterval01High - confidenceInterval01Low);
    const confidenceScore = clamp01(1.0 - confidenceWidth);

    const shapeStr = signal.shape.join('x');

    const details = buildDetails({
      signalKind: signal.kind,
      tick: signal.tick,
      runId: signal.runId,
      modelName: signal.modelName,
      modelVersion: signal.modelVersion,
      anomalyScore,
      reconstructionError,
      layerName: signal.layerName,
      activationFunction: signal.activationFunction,
      latentDim: signal.latentDim,
      featureCount: signal.featureCount,
      inferenceDurationMs: signal.inferenceDurationMs,
      shape: shapeStr,
      confidenceIntervalLow: signal.confidenceInterval[0] ?? 0,
      confidenceIntervalHigh: signal.confidenceInterval[1] ?? 1,
      confidenceWidth,
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      `model:${signal.modelName}`,
      `layer:${signal.layerName}`,
      `severity:${severity.toLowerCase()}`,
      ...(hasHighReconstruction ? ['high_reconstruction_error'] : []),
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'DL_TENSOR',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      reconstructionError,
      modelName: signal.modelName,
      layerName: signal.layerName,
      shape: shapeStr,
      latentDim: signal.latentDim,
      inferenceDurationMs: signal.inferenceDurationMs,
      confidenceScore,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._dlTensors++;
    if (anomalyScore >= this._opts.dlAnomalyThreshold) this._anomalySignals++;

    const dedupeKey = `${signal.runId}::dl::${signal.modelName}::${signal.layerName}::${signal.tick}`;
    this._dedupeCache.set(dedupeKey, now);

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'DL_TENSOR',
      orchestrationPhase: 'OBSERVABILITY',
      anomalyScore,
      durationMs: signal.inferenceDurationMs,
      budgetMs: 0,
      isError: false,
      isOverBudget: false,
      isAnomaly: anomalyScore >= this._opts.dlAnomalyThreshold,
      isQuarantineEvent: false,
      isLifecycleEvent: false,
      isOutcomeEvent: false,
      healthGrade: null,
      completionRatio: clamp01(0) as Score01,
      confidenceScore,
      details,
    }, now);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptHealthReport(
    signal: ZeroEngineHealthReportCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | null {
    const now = this._opts.clock.now();
    const currentPassing = gradeIsPassing(signal.overallGrade);
    const previousPassing = gradeIsPassing(signal.previousGrade ?? this._lastHealthGrade);

    const hasCriticalSubsystem = signal.criticalCount > 0;
    const hasSubsystemDown = signal.subsystems.some(s => !s.isResponsive);
    const gradeChanged = signal.previousGrade !== null && signal.overallGrade !== signal.previousGrade;
    const transitioned = currentPassing !== previousPassing;

    if (!transitioned && !hasCriticalSubsystem && !hasSubsystemDown && !gradeChanged) {
      return null;
    }

    const isDegradation = !currentPassing && previousPassing;
    const isRecovery = currentPassing && !previousPassing;
    const eventName: ZeroEngineSignalAdapterEventName =
      hasSubsystemDown ? 'zero.health.subsystem_down' :
      hasCriticalSubsystem ? 'zero.health.critical' :
      isDegradation ? 'zero.health.degraded' :
      isRecovery ? 'zero.health.recovered' :
      'zero.health.degraded';

    const severity = mapHealthReportSeverity(signal.overallGrade, signal.previousGrade ?? this._lastHealthGrade as ZeroEngineHealthGrade | null);

    if (!severityMeetsFloor(severity, this._opts.severityFloor)) {
      return this._reject(eventName, 'Health report severity below floor', {
        overallGrade: signal.overallGrade,
        previousGrade: signal.previousGrade,
        tick: signal.tick,
      });
    }

    const anomalyScore = clamp01(
      signal.totalErrorRate * 0.4 +
      (signal.criticalCount / Math.max(1, signal.subsystemCount)) * 0.3 +
      signal.memoryUtilization * 0.2 +
      (hasSubsystemDown ? 0.3 : 0),
    );

    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const narrativeWeight = mapNarrativeWeight(severity, false, false, false);
    const confidenceScore = clamp01(signal.healthyCount / Math.max(1, signal.subsystemCount));
    const completionRatio = clamp01(signal.healthyCount / Math.max(1, signal.subsystemCount));

    const degradedSubsystems: Record<string, JsonValue> = {};
    for (const sub of signal.subsystems) {
      if (!gradeIsPassing(sub.grade) || !sub.isResponsive) {
        degradedSubsystems[sub.name] = {
          grade: sub.grade,
          errorRate: sub.errorRate,
          avgLatencyMs: sub.avgLatencyMs,
          p95LatencyMs: sub.p95LatencyMs,
          isResponsive: sub.isResponsive,
          warningCount: sub.warningCount,
          criticalCount: sub.criticalCount,
        };
      }
    }

    const details = buildDetails({
      signalKind: signal.kind,
      tick: signal.tick,
      runId: signal.runId,
      overallGrade: signal.overallGrade,
      previousGrade: signal.previousGrade,
      subsystemCount: signal.subsystemCount,
      healthyCount: signal.healthyCount,
      degradedCount: signal.degradedCount,
      criticalCount: signal.criticalCount,
      totalErrorRate: signal.totalErrorRate,
      avgLatencyMs: signal.avgLatencyMs,
      p95LatencyMs: signal.p95LatencyMs,
      memoryUsageTotalBytes: signal.memoryUsageTotalBytes,
      memoryLimitBytes: signal.memoryLimitBytes,
      memoryUtilization: signal.memoryUtilization,
      uptimeMs: signal.uptimeMs,
      ticksSinceLastReport: signal.ticksSinceLastReport,
      recommendations: signal.recommendations as unknown as JsonValue,
      degradedSubsystems,
      isDegradation,
      isRecovery,
      hasSubsystemDown,
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      `grade:${signal.overallGrade.toLowerCase()}`,
      `severity:${severity.toLowerCase()}`,
      ...(isDegradation ? ['health_degraded'] : []),
      ...(isRecovery ? ['health_recovered'] : []),
      ...(hasSubsystemDown ? ['subsystem_down'] : []),
      ...(hasCriticalSubsystem ? ['critical_subsystem'] : []),
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'HEALTH_REPORT',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      overallGrade: signal.overallGrade,
      previousGrade: signal.previousGrade,
      subsystemCount: signal.subsystemCount,
      healthyCount: signal.healthyCount,
      degradedCount: signal.degradedCount,
      criticalCount: signal.criticalCount,
      memoryUtilization: signal.memoryUtilization,
      isDegradation,
      isRecovery,
      completionRatio,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._healthReports++;
    this._lastHealthGrade = signal.overallGrade;
    if (isDegradation) this._healthDegradations++;
    if (isRecovery) this._healthRecoveries++;
    if (hasCriticalSubsystem || hasSubsystemDown) this._errorSignals++;
    if (anomalyScore >= this._opts.anomalyThreshold) this._anomalySignals++;

    const dedupeKey = `${signal.runId}::health::${signal.overallGrade}::${signal.tick}`;
    this._dedupeCache.set(dedupeKey, now);

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'HEALTH_REPORT',
      orchestrationPhase: `HEALTH::${signal.overallGrade}`,
      anomalyScore,
      durationMs: 0,
      budgetMs: 0,
      isError: hasCriticalSubsystem || hasSubsystemDown,
      isOverBudget: false,
      isAnomaly: anomalyScore >= this._opts.anomalyThreshold,
      isQuarantineEvent: false,
      isLifecycleEvent: false,
      isOutcomeEvent: false,
      healthGrade: signal.overallGrade,
      completionRatio,
      confidenceScore,
      details,
    }, now);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SNAPSHOT PROJECTION
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptSnapshotProjection(
    signal: ZeroEngineSnapshotProjectionCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | null {
    const now = this._opts.clock.now();

    if (!signal.isConsistent) {
      return this._adaptInconsistentSnapshot(signal, context, now);
    }

    if (this._opts.suppressRoutineSnapshots && signal.scope !== 'DIAGNOSTIC') {
      const lastTs = this._snapshotTimestamps.get(signal.runId);
      if (lastTs !== undefined && now - lastTs < this._opts.snapshotCadenceMs) {
        return null;
      }
    }

    this._snapshotTimestamps.set(signal.runId, now);

    const eventName: ZeroEngineSignalAdapterEventName = 'zero.snapshot.projected';
    const severity = mapSnapshotSeverity(signal.isConsistent);

    if (!severityMeetsFloor(severity, this._opts.severityFloor)) {
      return this._reject(eventName, 'Snapshot severity below floor', {
        tick: signal.tick,
        runId: signal.runId,
        scope: signal.scope,
      });
    }

    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const narrativeWeight: ZeroEngineSignalAdapterNarrativeWeight = 'AMBIENT';
    const anomalyScore = clamp01(0);
    const dirtyRatio = signal.dirtyEntities / Math.max(1, signal.totalEntities);
    const completionRatio = clamp01(1.0 - dirtyRatio);
    const confidenceScore = clamp01(signal.isConsistent ? 1.0 : 0.0);

    const entityBreakdown: Record<string, JsonValue> = {};
    for (const entity of signal.entitySummaries) {
      entityBreakdown[entity.entityType] = {
        entityCount: entity.entityCount,
        dirtyCount: entity.dirtyCount,
        bytesEstimate: entity.bytesEstimate,
        lastMutatedTick: entity.lastMutatedTick,
      };
    }

    const details = buildDetails({
      signalKind: signal.kind,
      tick: signal.tick,
      runId: signal.runId,
      scope: signal.scope,
      projectionDurationMs: signal.projectionDurationMs,
      snapshotHash: signal.snapshotHash,
      parentHash: signal.parentHash,
      totalEntities: signal.totalEntities,
      dirtyEntities: signal.dirtyEntities,
      dirtyRatio,
      totalBytesEstimate: signal.totalBytesEstimate,
      compressionRatio: signal.compressionRatio,
      sequenceNumber: signal.sequenceNumber,
      isConsistent: signal.isConsistent,
      consistencyCheckDurationMs: signal.consistencyCheckDurationMs,
      entityBreakdown,
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      `scope:${signal.scope.toLowerCase()}`,
      `severity:${severity.toLowerCase()}`,
      'snapshot:consistent',
      `seq:${signal.sequenceNumber}`,
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'SNAPSHOT_PROJECTION',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      scope: signal.scope,
      snapshotHash: signal.snapshotHash,
      totalEntities: signal.totalEntities,
      dirtyEntities: signal.dirtyEntities,
      totalBytesEstimate: signal.totalBytesEstimate,
      compressionRatio: signal.compressionRatio,
      sequenceNumber: signal.sequenceNumber,
      isConsistent: signal.isConsistent,
      completionRatio,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._snapshotProjections++;

    const dedupeKey = `${signal.runId}::snapshot::${signal.scope}::${signal.sequenceNumber}`;
    this._dedupeCache.set(dedupeKey, now);

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'SNAPSHOT_PROJECTION',
      orchestrationPhase: `SNAPSHOT::${signal.scope}`,
      anomalyScore,
      durationMs: signal.projectionDurationMs,
      budgetMs: 0,
      isError: false,
      isOverBudget: false,
      isAnomaly: false,
      isQuarantineEvent: false,
      isLifecycleEvent: false,
      isOutcomeEvent: false,
      healthGrade: null,
      completionRatio,
      confidenceScore,
      details,
    }, now);
  }

  private _adaptInconsistentSnapshot(
    signal: ZeroEngineSnapshotProjectionCompat,
    context: ZeroEngineSignalAdapterContext,
    now: UnixMs,
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection {
    const eventName: ZeroEngineSignalAdapterEventName = 'zero.snapshot.inconsistency';
    const severity: ZeroEngineSignalAdapterSeverity = 'CRITICAL';
    const narrativeWeight: ZeroEngineSignalAdapterNarrativeWeight = 'CRITICAL';
    const routeChannel = context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const anomalyScore = clamp01(0.95);
    const completionRatio = clamp01(0) as Score01;
    const confidenceScore = clamp01(0) as Score01;

    this._snapshotTimestamps.set(signal.runId, now);

    const details = buildDetails({
      signalKind: signal.kind,
      tick: signal.tick,
      runId: signal.runId,
      scope: signal.scope,
      projectionDurationMs: signal.projectionDurationMs,
      snapshotHash: signal.snapshotHash,
      parentHash: signal.parentHash,
      totalEntities: signal.totalEntities,
      dirtyEntities: signal.dirtyEntities,
      totalBytesEstimate: signal.totalBytesEstimate,
      compressionRatio: signal.compressionRatio,
      sequenceNumber: signal.sequenceNumber,
      isConsistent: false,
      consistencyCheckDurationMs: signal.consistencyCheckDurationMs,
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      `scope:${signal.scope.toLowerCase()}`,
      `severity:${severity.toLowerCase()}`,
      'snapshot:inconsistent',
      `seq:${signal.sequenceNumber}`,
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'SNAPSHOT_PROJECTION',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      scope: signal.scope,
      snapshotHash: signal.snapshotHash,
      isConsistent: false,
      totalEntities: signal.totalEntities,
      dirtyEntities: signal.dirtyEntities,
      sequenceNumber: signal.sequenceNumber,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._snapshotProjections++;
    this._errorSignals++;
    this._anomalySignals++;

    const dedupeKey = `${signal.runId}::snapshot_inconsistency::${signal.sequenceNumber}`;
    this._dedupeCache.set(dedupeKey, now);

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'SNAPSHOT_PROJECTION',
      orchestrationPhase: 'SNAPSHOT::INCONSISTENT',
      anomalyScore,
      durationMs: signal.projectionDurationMs,
      budgetMs: 0,
      isError: true,
      isOverBudget: false,
      isAnomaly: true,
      isQuarantineEvent: false,
      isLifecycleEvent: false,
      isOutcomeEvent: false,
      healthGrade: null,
      completionRatio,
      confidenceScore,
      details,
    }, now);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT BRIDGE EMISSION
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptChatBridgeEmission(
    signal: ZeroEngineChatBridgeEmissionCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const now = this._opts.clock.now();
    const isUrgent = signal.priority === 'URGENT';
    const eventName: ZeroEngineSignalAdapterEventName = isUrgent ? 'zero.bridge.urgent' : 'zero.bridge.emission';
    const severity = mapBridgeSeverity(signal.priority, signal.triggerSeverity);

    if (this._opts.suppressLowPriorityBridgeEmissions && signal.priority === 'LOW' && signal.suppressible) {
      return this._reject(eventName, 'Low-priority suppressible bridge emission suppressed', {
        tick: signal.tick,
        runId: signal.runId,
        priority: signal.priority,
        bridgeChannel: signal.bridgeChannel,
      });
    }

    if (!severityMeetsFloor(severity, this._opts.severityFloor) && !isUrgent) {
      return this._reject(eventName, 'Bridge emission severity below floor', {
        tick: signal.tick,
        runId: signal.runId,
        severity,
        priority: signal.priority,
      });
    }

    const dedupeKey = `${signal.runId}::bridge::${signal.bridgeChannel}::${signal.triggerEvent}::${signal.tick}`;
    const dedupeResult = this._checkDedupe(dedupeKey, eventName, now, isUrgent, {
      runId: signal.runId,
      bridgeChannel: signal.bridgeChannel,
      triggerEvent: signal.triggerEvent,
      tick: signal.tick,
    });
    if (dedupeResult !== null) return dedupeResult;

    const narrativeWeight = mapNarrativeWeight(severity, false, false, false);
    const routeChannel = (signal.targetChannel as ChatVisibleChannel) ?? context.routeChannel ?? this._opts.defaultVisibleChannel;
    const roomId = signal.targetRoomId ?? context.roomId ?? this._opts.defaultRoomId;
    const emittedAt = asUnixMs(context.emittedAt ?? now);
    const anomalyScore = clamp01(isUrgent ? 0.6 : 0);
    const confidenceScore = clamp01(1.0) as Score01;
    const completionRatio = clamp01(0) as Score01;

    const details = buildDetails({
      signalKind: signal.kind,
      tick: signal.tick,
      runId: signal.runId,
      bridgeChannel: signal.bridgeChannel,
      tone: signal.tone,
      priority: signal.priority,
      narrativeFragment: signal.narrativeFragment,
      triggerEvent: signal.triggerEvent,
      triggerSeverity: signal.triggerSeverity,
      suppressible: signal.suppressible,
      ttlMs: signal.ttlMs,
      ...(signal.targetRoomId ? { targetRoomId: signal.targetRoomId } : {}),
      ...(signal.targetChannel ? { targetChannel: signal.targetChannel } : {}),
    }, context.metadata);

    const tags = buildTags(
      context.tags,
      `bridge:${signal.bridgeChannel}`,
      `tone:${signal.tone.toLowerCase()}`,
      `priority:${signal.priority.toLowerCase()}`,
      `severity:${severity.toLowerCase()}`,
      `trigger:${signal.triggerEvent}`,
    );

    const metadata: Record<string, JsonValue> = {
      eventName,
      visibleChannel: routeChannel,
      surface: 'zero_engine',
      signalKind: 'CHAT_BRIDGE_EMISSION',
      tick: signal.tick,
      runId: signal.runId,
      severity,
      narrativeWeight,
      anomalyScore,
      bridgeChannel: signal.bridgeChannel,
      tone: signal.tone,
      priority: signal.priority,
      narrativeFragment: signal.narrativeFragment,
      triggerEvent: signal.triggerEvent,
      ttlMs: signal.ttlMs,
      details,
      tags,
    };

    const signalPayload = buildRunSignalEnvelope(emittedAt, String(roomId) as ChatRoomId, Object.freeze(metadata) as Readonly<Record<string, JsonValue>>);
    const envelope = buildChatInputEnvelope(emittedAt, signalPayload);

    this._bridgeEmissions++;
    if (isUrgent) this._errorSignals++;
    if (anomalyScore >= this._opts.anomalyThreshold) this._anomalySignals++;

    return this._accept(envelope, {
      dedupeKey,
      routeChannel,
      narrativeWeight,
      severity,
      eventName,
      tick: signal.tick,
      runId: signal.runId,
      signalKind: 'CHAT_BRIDGE_EMISSION',
      orchestrationPhase: `BRIDGE::${signal.tone}`,
      anomalyScore,
      durationMs: 0,
      budgetMs: 0,
      isError: isUrgent,
      isOverBudget: false,
      isAnomaly: anomalyScore >= this._opts.anomalyThreshold,
      isQuarantineEvent: false,
      isLifecycleEvent: false,
      isOutcomeEvent: false,
      healthGrade: null,
      completionRatio,
      confidenceScore,
      details,
    }, now);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POLYMORPHIC DISPATCH — adaptSignal
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptSignal(
    signal: ZeroEngineOrchestrationSignalCompat,
    context: ZeroEngineSignalAdapterContext = {},
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped | null {
    switch (signal.kind) {
      case 'LIFECYCLE_TRANSITION':
        return this.adaptLifecycleTransition(signal, context);
      case 'TICK_COMPLETION':
        return this.adaptTickCompletion(signal, context);
      case 'OUTCOME_GATE':
        return this.adaptOutcomeGate(signal, context);
      case 'QUARANTINE_ENTRY':
        return this.adaptQuarantineEntry(signal, context);
      case 'QUARANTINE_EXIT':
        return this.adaptQuarantineExit(signal, context);
      case 'ML_VECTOR':
        return this.adaptMLVector(signal, context);
      case 'DL_TENSOR':
        return this.adaptDLTensor(signal, context);
      case 'HEALTH_REPORT':
        return this.adaptHealthReport(signal, context);
      case 'SNAPSHOT_PROJECTION':
        return this.adaptSnapshotProjection(signal, context);
      case 'CHAT_BRIDGE_EMISSION':
        return this.adaptChatBridgeEmission(signal, context);
      default:
        return this._reject('unknown', `Unknown ZeroEngine signal kind: ${(signal as { kind: string }).kind}`, {
          kind: (signal as { kind: string }).kind,
        });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH PROCESSING
  // ═══════════════════════════════════════════════════════════════════════════

  public adaptBatch(
    signals: readonly ZeroEngineOrchestrationSignalCompat[],
    context: ZeroEngineSignalAdapterContext = {},
  ): readonly (ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped | null)[] {
    const limit = Math.min(signals.length, this._opts.batchLimit);
    const results: (ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped | null)[] = [];
    for (let i = 0; i < limit; i++) {
      results.push(this.adaptSignal(signals[i]!, context));
    }
    if (signals.length > limit) {
      this._opts.logger?.warn?.(`[ZeroEngineSignalAdapter] Batch truncated: ${signals.length} signals exceed limit ${limit}`, {
        total: signals.length,
        limit,
      });
    }
    return Object.freeze(results);
  }

  public adaptBatchFiltered(
    signals: readonly ZeroEngineOrchestrationSignalCompat[],
    context: ZeroEngineSignalAdapterContext = {},
  ): readonly ZeroEngineSignalAdapterArtifact[] {
    const all = this.adaptBatch(signals, context);
    const artifacts: ZeroEngineSignalAdapterArtifact[] = [];
    for (const result of all) {
      if (result !== null && 'envelope' in result) {
        artifacts.push(result);
      }
    }
    return Object.freeze(artifacts);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE / REPORT / DIAGNOSTICS / READINESS / RESET
  // ═══════════════════════════════════════════════════════════════════════════

  public state(): ZeroEngineSignalAdapterState {
    return Object.freeze({
      accepted: this._accepted,
      rejected: this._rejected,
      deduped: this._deduped,
      lifecycleTransitions: this._lifecycleTransitions,
      tickCompletions: this._tickCompletions,
      outcomeGates: this._outcomeGates,
      quarantineEntries: this._quarantineEntries,
      quarantineExits: this._quarantineExits,
      mlVectors: this._mlVectors,
      dlTensors: this._dlTensors,
      healthReports: this._healthReports,
      healthDegradations: this._healthDegradations,
      healthRecoveries: this._healthRecoveries,
      snapshotProjections: this._snapshotProjections,
      bridgeEmissions: this._bridgeEmissions,
      errorSignals: this._errorSignals,
      anomalySignals: this._anomalySignals,
      overBudgetSignals: this._overBudgetSignals,
      lastAcceptedAt: this._lastAcceptedAt,
      lastHealthGrade: this._lastHealthGrade,
      lastLifecyclePhase: this._lastLifecyclePhase,
      lastQuarantineId: this._lastQuarantineId,
      currentPhase: this._currentPhase,
    });
  }

  public report(): ZeroEngineSignalAdapterReport {
    return Object.freeze({
      state: this.state(),
      recentHistory: Object.freeze([...this._history]),
      recentRejections: Object.freeze([...this._rejections]),
      recentDeduped: Object.freeze([...this._dedupedList]),
      domainId: 'ZERO_ENGINE' as const,
      generatedAt: this._opts.clock.now(),
    });
  }

  public diagnostics(): ZeroEngineSignalAdapterDiagnostics {
    const snapshotEntries: { readonly runId: string; readonly lastMs: number }[] = [];
    for (const [runId, lastMs] of this._snapshotTimestamps) {
      snapshotEntries.push(Object.freeze({ runId, lastMs }));
    }
    return Object.freeze({
      adapterVersion: ZERO_ENGINE_SIGNAL_ADAPTER_MODULE_VERSION,
      state: this.state(),
      dedupeMapSize: this._dedupeCache.size,
      historyLength: this._history.length,
      rejectionLength: this._rejections.length,
      dedupedLength: this._dedupedList.length,
      snapshotTimestampMap: Object.freeze(snapshotEntries),
      domainId: 'ZERO_ENGINE' as const,
      generatedAt: this._opts.clock.now(),
    });
  }

  public readiness(): ZeroEngineSignalAdapterReadiness {
    const now = this._opts.clock.now();
    return Object.freeze({
      ready: true,
      reason: 'ZeroEngineSignalAdapter is initialized and accepting signals',
      adapterVersion: ZERO_ENGINE_SIGNAL_ADAPTER_MODULE_VERSION,
      optionsSnapshot: Object.freeze({
        defaultRoomId: String(this._opts.defaultRoomId),
        defaultVisibleChannel: this._opts.defaultVisibleChannel,
        dedupeWindowMs: this._opts.dedupeWindowMs,
        maxHistory: this._opts.maxHistory,
        anomalyThreshold: this._opts.anomalyThreshold,
        dlAnomalyThreshold: this._opts.dlAnomalyThreshold,
        tickOverBudgetMultiplier: this._opts.tickOverBudgetMultiplier,
        snapshotCadenceMs: this._opts.snapshotCadenceMs,
        suppressRoutineTickCompletions: this._opts.suppressRoutineTickCompletions,
        suppressRoutineSnapshots: this._opts.suppressRoutineSnapshots,
        suppressLowPriorityBridgeEmissions: this._opts.suppressLowPriorityBridgeEmissions,
        alwaysEmitLifecycleTransitions: this._opts.alwaysEmitLifecycleTransitions,
        alwaysEmitOutcomeGates: this._opts.alwaysEmitOutcomeGates,
        alwaysEmitQuarantineEvents: this._opts.alwaysEmitQuarantineEvents,
        batchLimit: this._opts.batchLimit,
        severityFloor: this._opts.severityFloor,
      }),
      domainId: 'ZERO_ENGINE' as const,
      checkedAt: now,
    });
  }

  public reset(): void {
    this._accepted = 0;
    this._rejected = 0;
    this._deduped = 0;
    this._lifecycleTransitions = 0;
    this._tickCompletions = 0;
    this._outcomeGates = 0;
    this._quarantineEntries = 0;
    this._quarantineExits = 0;
    this._mlVectors = 0;
    this._dlTensors = 0;
    this._healthReports = 0;
    this._healthDegradations = 0;
    this._healthRecoveries = 0;
    this._snapshotProjections = 0;
    this._bridgeEmissions = 0;
    this._errorSignals = 0;
    this._anomalySignals = 0;
    this._overBudgetSignals = 0;
    this._lastAcceptedAt = null;
    this._lastHealthGrade = null;
    this._lastLifecyclePhase = null;
    this._lastQuarantineId = null;
    this._currentPhase = null;
    this._history.length = 0;
    this._rejections.length = 0;
    this._dedupedList.length = 0;
    this._dedupeCache.clear();
    this._snapshotTimestamps.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private _reject(
    eventName: string,
    reason: string,
    details: Record<string, JsonValue>,
  ): ZeroEngineSignalAdapterRejection {
    const rejection: ZeroEngineSignalAdapterRejection = Object.freeze({
      eventName,
      reason,
      details: Object.freeze(details),
    });
    this._rejected++;
    this._rejections.push(rejection);
    if (this._rejections.length > this._opts.maxHistory) this._rejections.shift();
    this._opts.logger?.debug?.(`[ZeroEngineSignalAdapter] Rejected ${eventName}: ${reason}`, details);
    return rejection;
  }

  private _checkDedupe(
    dedupeKey: string,
    eventName: string,
    now: number,
    alwaysAccept: boolean,
    details: Record<string, JsonValue>,
  ): ZeroEngineSignalAdapterDeduped | null {
    const lastSeen = this._dedupeCache.get(dedupeKey);
    if (!alwaysAccept && lastSeen !== undefined && now - lastSeen < this._opts.dedupeWindowMs) {
      const deduped: ZeroEngineSignalAdapterDeduped = Object.freeze({
        eventName,
        dedupeKey,
        reason: `Deduped within ${this._opts.dedupeWindowMs}ms window`,
        details: Object.freeze(details),
      });
      this._deduped++;
      this._dedupedList.push(deduped);
      if (this._dedupedList.length > this._opts.maxHistory) this._dedupedList.shift();
      return deduped;
    }
    this._dedupeCache.set(dedupeKey, now);
    return null;
  }

  private _accept(
    envelope: ChatInputEnvelope,
    artifactFields: Omit<ZeroEngineSignalAdapterArtifact, 'envelope'>,
    now: UnixMs,
  ): ZeroEngineSignalAdapterArtifact {
    const artifact: ZeroEngineSignalAdapterArtifact = Object.freeze({
      envelope,
      ...artifactFields,
    });

    this._accepted++;
    this._lastAcceptedAt = now;

    const entry: ZeroEngineSignalAdapterHistoryEntry = Object.freeze({
      artifact,
      acceptedAt: now,
      domainId: 'ZERO_ENGINE' as const,
    });
    this._history.push(entry);
    if (this._history.length > this._opts.maxHistory) this._history.shift();

    this._opts.logger?.debug?.(`[ZeroEngineSignalAdapter] Accepted ${artifactFields.eventName}`, {
      tick: artifactFields.tick,
      runId: artifactFields.runId,
      signalKind: artifactFields.signalKind,
      severity: artifactFields.severity,
      anomalyScore: artifactFields.anomalyScore,
    });

    return artifact;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ZeroEngineSignalRateController
// ─────────────────────────────────────────────────────────────────────────────

export interface ZeroEngineRateBucket {
  readonly kind: string;
  readonly count: number;
  readonly limit: number;
  readonly resetsAtMs: number;
}

export class ZeroEngineSignalRateController {
  private readonly _buckets = new Map<string, { count: number; resetsAtMs: number }>();
  private readonly _windowMs: number;
  private readonly _limits: Readonly<Record<string, number>>;

  public constructor(
    windowMs = 10_000,
    limits: Readonly<Record<string, number>> = {
      'zero.lifecycle.booting': 2,
      'zero.lifecycle.calibrating': 2,
      'zero.lifecycle.ready': 2,
      'zero.lifecycle.running': 5,
      'zero.lifecycle.paused': 3,
      'zero.lifecycle.draining': 2,
      'zero.lifecycle.finalizing': 2,
      'zero.lifecycle.shutdown': 2,
      'zero.lifecycle.crashed': 5,
      'zero.lifecycle.quarantined': 5,
      'zero.tick.completed': 30,
      'zero.tick.over_budget': 20,
      'zero.tick.error': 15,
      'zero.tick.timeout': 10,
      'zero.tick.slow_step': 20,
      'zero.outcome.pass': 10,
      'zero.outcome.fail': 10,
      'zero.outcome.defer': 8,
      'zero.outcome.override': 5,
      'zero.outcome.timeout': 5,
      'zero.quarantine.entry': 5,
      'zero.quarantine.exit': 5,
      'zero.quarantine.recovered': 5,
      'zero.quarantine.degraded': 5,
      'zero.quarantine.failed': 5,
      'zero.ml.anomaly': 10,
      'zero.ml.drift': 8,
      'zero.ml.prediction': 15,
      'zero.dl.anomaly': 10,
      'zero.dl.reconstruction_error': 8,
      'zero.health.degraded': 3,
      'zero.health.recovered': 3,
      'zero.health.critical': 5,
      'zero.health.subsystem_down': 5,
      'zero.snapshot.projected': 10,
      'zero.snapshot.inconsistency': 5,
      'zero.bridge.emission': 20,
      'zero.bridge.urgent': 10,
    },
  ) {
    this._windowMs = windowMs;
    this._limits = limits;
  }

  public allow(eventName: string, nowMs: number): boolean {
    const limit = this._limits[eventName] ?? 50;
    const bucket = this._buckets.get(eventName);
    if (!bucket || nowMs >= bucket.resetsAtMs) {
      this._buckets.set(eventName, { count: 1, resetsAtMs: nowMs + this._windowMs });
      return true;
    }
    if (bucket.count >= limit) return false;
    this._buckets.set(eventName, { count: bucket.count + 1, resetsAtMs: bucket.resetsAtMs });
    return true;
  }

  public getBuckets(): readonly ZeroEngineRateBucket[] {
    return [...this._buckets.entries()].map(([kind, b]) => Object.freeze({
      kind,
      count: b.count,
      limit: this._limits[kind] ?? 50,
      resetsAtMs: b.resetsAtMs,
    }));
  }

  public reset(): void {
    this._buckets.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ZeroEngineReplayBuffer
// ─────────────────────────────────────────────────────────────────────────────

export class ZeroEngineReplayBuffer {
  private readonly _capacity: number;
  private readonly _buffer: ZeroEngineSignalAdapterArtifact[] = [];

  public constructor(capacity = 64) {
    this._capacity = Math.max(1, capacity);
  }

  public push(artifact: ZeroEngineSignalAdapterArtifact): void {
    this._buffer.push(artifact);
    if (this._buffer.length > this._capacity) this._buffer.shift();
  }

  public getAll(): readonly ZeroEngineSignalAdapterArtifact[] {
    return Object.freeze([...this._buffer]);
  }

  public getBySignalKind(signalKind: string): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.signalKind === signalKind);
  }

  public getLifecycleEvents(): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isLifecycleEvent);
  }

  public getOutcomeEvents(): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isOutcomeEvent);
  }

  public getQuarantineEvents(): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isQuarantineEvent);
  }

  public getErrors(): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isError);
  }

  public getAnomalies(): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isAnomaly);
  }

  public getOverBudget(): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.isOverBudget);
  }

  public getBySeverity(severity: ZeroEngineSignalAdapterSeverity): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.severity === severity);
  }

  public getByRunId(runId: string): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.runId === runId);
  }

  public getByTickRange(startTick: number, endTick: number): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.tick >= startTick && a.tick <= endTick);
  }

  public getCritical(): readonly ZeroEngineSignalAdapterArtifact[] {
    return this._buffer.filter(a => a.severity === 'CRITICAL');
  }

  public clear(): void {
    this._buffer.length = 0;
  }

  public get size(): number { return this._buffer.length; }
  public get capacity(): number { return this._capacity; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ZeroEngineSignalAdapterSuite — composed suite
// ─────────────────────────────────────────────────────────────────────────────

export interface ZeroEngineSignalSuiteOptions extends ZeroEngineSignalAdapterOptions {
  readonly rateWindowMs?: number;
  readonly rateLimits?: Readonly<Record<string, number>>;
  readonly replayCapacity?: number;
}

export class ZeroEngineSignalAdapterSuite {
  public readonly adapter: ZeroEngineSignalAdapter;
  public readonly rateController: ZeroEngineSignalRateController;
  public readonly replayBuffer: ZeroEngineReplayBuffer;

  public constructor(options: ZeroEngineSignalSuiteOptions) {
    this.adapter = new ZeroEngineSignalAdapter(options);
    this.rateController = new ZeroEngineSignalRateController(
      options.rateWindowMs,
      options.rateLimits,
    );
    this.replayBuffer = new ZeroEngineReplayBuffer(options.replayCapacity);
  }

  public process(
    signal: ZeroEngineOrchestrationSignalCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped | null {
    const result = this.adapter.adaptSignal(signal, context);
    if (result === null) return null;

    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { signalKind: result.signalKind, tick: result.tick, runId: result.runId },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }

    return result;
  }

  public processBatch(
    signals: readonly ZeroEngineOrchestrationSignalCompat[],
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): readonly (ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped | null)[] {
    const results: (ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped | null)[] = [];
    for (const signal of signals) {
      results.push(this.process(signal, context, nowMs));
    }
    return Object.freeze(results);
  }

  public processLifecycle(
    signal: ZeroEngineLifecycleTransitionCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const result = this.adapter.adaptLifecycleTransition(signal, context);
    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { nextPhase: signal.nextPhase, tick: signal.tick, runId: signal.runId },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }
    return result;
  }

  public processTickCompletion(
    signal: ZeroEngineTickCompletionCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const result = this.adapter.adaptTickCompletion(signal, context);
    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { outcome: signal.outcome, tick: signal.tick, runId: signal.runId },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }
    return result;
  }

  public processOutcomeGate(
    signal: ZeroEngineOutcomeGateCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const result = this.adapter.adaptOutcomeGate(signal, context);
    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { gateKind: signal.gateKind, verdict: signal.verdict, tick: signal.tick },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }
    return result;
  }

  public processQuarantineEntry(
    signal: ZeroEngineQuarantineEntryCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const result = this.adapter.adaptQuarantineEntry(signal, context);
    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { reason: signal.reason, quarantineId: signal.quarantineId, tick: signal.tick },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }
    return result;
  }

  public processQuarantineExit(
    signal: ZeroEngineQuarantineExitCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const result = this.adapter.adaptQuarantineExit(signal, context);
    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { recoveryOutcome: signal.recoveryOutcome, quarantineId: signal.quarantineId, tick: signal.tick },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }
    return result;
  }

  public processMLVector(
    signal: ZeroEngineMLVectorCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection {
    const result = this.adapter.adaptMLVector(signal, context);
    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { modelName: signal.modelName, tick: signal.tick, runId: signal.runId },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }
    return result;
  }

  public processDLTensor(
    signal: ZeroEngineDLTensorCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection {
    const result = this.adapter.adaptDLTensor(signal, context);
    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { modelName: signal.modelName, tick: signal.tick, runId: signal.runId },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }
    return result;
  }

  public processHealthReport(
    signal: ZeroEngineHealthReportCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | null {
    const result = this.adapter.adaptHealthReport(signal, context);
    if (result === null) return null;
    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { overallGrade: signal.overallGrade, tick: signal.tick, runId: signal.runId },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }
    return result;
  }

  public processSnapshotProjection(
    signal: ZeroEngineSnapshotProjectionCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | null {
    const result = this.adapter.adaptSnapshotProjection(signal, context);
    if (result === null) return null;
    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { scope: signal.scope, tick: signal.tick, runId: signal.runId },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }
    return result;
  }

  public processChatBridgeEmission(
    signal: ZeroEngineChatBridgeEmissionCompat,
    context: ZeroEngineSignalAdapterContext = {},
    nowMs = Date.now(),
  ): ZeroEngineSignalAdapterArtifact | ZeroEngineSignalAdapterRejection | ZeroEngineSignalAdapterDeduped {
    const result = this.adapter.adaptChatBridgeEmission(signal, context);
    if ('envelope' in result) {
      if (!this.rateController.allow(result.eventName, nowMs)) {
        return {
          eventName: result.eventName,
          reason: 'Rate limit exceeded',
          details: { bridgeChannel: signal.bridgeChannel, tick: signal.tick, runId: signal.runId },
        } as ZeroEngineSignalAdapterRejection;
      }
      this.replayBuffer.push(result);
    }
    return result;
  }

  public state(): ZeroEngineSignalAdapterState { return this.adapter.state(); }
  public report(): ZeroEngineSignalAdapterReport { return this.adapter.report(); }
  public diagnostics(): ZeroEngineSignalAdapterDiagnostics { return this.adapter.diagnostics(); }
  public readiness(): ZeroEngineSignalAdapterReadiness { return this.adapter.readiness(); }

  public reset(): void {
    this.adapter.reset();
    this.rateController.reset();
    this.replayBuffer.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone utility functions
// ─────────────────────────────────────────────────────────────────────────────

function identifyTopFeatures(features: readonly number[], topN: number): number[] {
  const indexed = features.map((v, i) => ({ value: Math.abs(v), index: i }));
  indexed.sort((a, b) => b.value - a.value);
  return indexed.slice(0, topN).map(e => e.index);
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory functions
// ─────────────────────────────────────────────────────────────────────────────

export function createZeroEngineSignalAdapter(
  options: ZeroEngineSignalAdapterOptions,
): ZeroEngineSignalAdapter {
  return new ZeroEngineSignalAdapter(options);
}

export function createZeroEngineSignalAdapterSuite(
  options: ZeroEngineSignalSuiteOptions,
): ZeroEngineSignalAdapterSuite {
  return new ZeroEngineSignalAdapterSuite(options);
}

export function isZeroEngineSignalAdapterArtifact(
  value: unknown,
): value is ZeroEngineSignalAdapterArtifact {
  return (
    typeof value === 'object' &&
    value !== null &&
    'envelope' in value &&
    'signalKind' in value &&
    'orchestrationPhase' in value &&
    'isQuarantineEvent' in value
  );
}

export function isZeroEngineSignalAdapterRejection(
  value: unknown,
): value is ZeroEngineSignalAdapterRejection {
  return (
    typeof value === 'object' &&
    value !== null &&
    'eventName' in value &&
    'reason' in value &&
    !('envelope' in value) &&
    !('dedupeKey' in value)
  );
}

export function isZeroEngineSignalAdapterDeduped(
  value: unknown,
): value is ZeroEngineSignalAdapterDeduped {
  return (
    typeof value === 'object' &&
    value !== null &&
    'eventName' in value &&
    'dedupeKey' in value &&
    'reason' in value &&
    !('envelope' in value)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Score computation utilities for external consumers
// ─────────────────────────────────────────────────────────────────────────────

export function computeOrchestrationHealthScore(
  state: ZeroEngineSignalAdapterState,
): Score100 {
  const totalSignals = state.accepted + state.rejected + state.deduped;
  if (totalSignals === 0) return clamp100(100);

  const errorPenalty = Math.min(50, state.errorSignals * 5);
  const anomalyPenalty = Math.min(30, state.anomalySignals * 3);
  const overBudgetPenalty = Math.min(20, state.overBudgetSignals * 2);
  const quarantinePenalty = Math.min(40, (state.quarantineEntries - state.quarantineExits) * 20);
  const healthDegradationPenalty = Math.min(30, state.healthDegradations * 10);
  const healthRecoveryBonus = Math.min(20, state.healthRecoveries * 5);

  const raw = 100 - errorPenalty - anomalyPenalty - overBudgetPenalty - quarantinePenalty - healthDegradationPenalty + healthRecoveryBonus;
  return clamp100(raw);
}

export function computeOrchestrationThroughputScore(
  state: ZeroEngineSignalAdapterState,
  windowMs: number,
): Score01 {
  if (windowMs <= 0) return clamp01(0) as Score01;
  const signalsPerSecond = (state.accepted / windowMs) * 1000;
  return clamp01(Math.min(1, signalsPerSecond / 100)) as Score01;
}

export function computeOrchestrationReliabilityScore(
  state: ZeroEngineSignalAdapterState,
): Score01 {
  const total = state.accepted + state.rejected;
  if (total === 0) return clamp01(1.0) as Score01;
  const errorRatio = state.errorSignals / total;
  return clamp01(1.0 - errorRatio) as Score01;
}

export function computeOrchestrationStabilityScore(
  state: ZeroEngineSignalAdapterState,
): Score01 {
  const destabilizers =
    state.quarantineEntries * 3 +
    state.healthDegradations * 2 +
    state.errorSignals;
  const stabilizers =
    state.quarantineExits * 2 +
    state.healthRecoveries * 2 +
    state.tickCompletions * 0.1;
  const rawStability = stabilizers / Math.max(1, stabilizers + destabilizers);
  return clamp01(rawStability) as Score01;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module constants
// ─────────────────────────────────────────────────────────────────────────────

export const ZERO_ENGINE_SIGNAL_ADAPTER_MODULE_VERSION = '2026.03.27' as const;
export const ZERO_ENGINE_SIGNAL_ADAPTER_READY = true as const;

export const ZERO_ENGINE_SIGNAL_ADAPTER_MANIFEST = Object.freeze({
  domain: 'ZERO_ENGINE',
  className: 'ZeroEngineSignalAdapter',
  relativePath: 'backend/src/game/engine/chat/adapters/ZeroEngineSignalAdapter.ts',
  ownsTruth: false as const,
  description: 'Translates ZeroEngine orchestration signals into backend-chat ingress envelopes.',
  moduleVersion: ZERO_ENGINE_SIGNAL_ADAPTER_MODULE_VERSION,
  supportedSignals: Object.freeze([
    'LIFECYCLE_TRANSITION',
    'TICK_COMPLETION',
    'OUTCOME_GATE',
    'QUARANTINE_ENTRY',
    'QUARANTINE_EXIT',
    'ML_VECTOR',
    'DL_TENSOR',
    'HEALTH_REPORT',
    'SNAPSHOT_PROJECTION',
    'CHAT_BRIDGE_EMISSION',
  ] as const),
});

// Utility re-exports for consumers that need the score helpers
export { clamp01, clamp100, asUnixMs };
