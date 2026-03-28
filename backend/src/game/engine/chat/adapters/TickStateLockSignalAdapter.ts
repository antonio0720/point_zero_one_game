// backend/src/game/engine/chat/adapters/TickStateLockSignalAdapter.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE CHAT
 * /backend/src/game/engine/chat/adapters/TickStateLockSignalAdapter.ts
 * VERSION: 2026.03.27
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 *
 * ── PURPOSE ───────────────────────────────────────────────────────────────────
 * Translates TickStateLock signals from the Zero layer into backend chat lane
 * LIVEOPS_SIGNAL envelopes without creating a circular dependency.
 *
 * No direct imports from zero/ — all types are structural compat shapes.
 * This prevents the circular dependency: chat/ → zero/ → chat/.
 *
 * ── SIGNAL DOCTRINE ───────────────────────────────────────────────────────────
 * Tick state lock signals enter the chat lane whenever the engine lock
 * transitions, is acquired, released, stalled, or reaches a terminal state.
 * They carry:
 *   - operation kind (ACQUIRE / RELEASE / START / ACTIVATE / END / RESET / ASSERT / VALIDATE / NOOP)
 *   - severity (LOW / MEDIUM / HIGH / CRITICAL)
 *   - health score (ML-derived [0,1])
 *   - per-step DL tensor for 13-step tick profile
 *   - 32-dim ML feature vector for real-time inference
 *   - narration phrase and urgency label for companion routing
 *   - run/tick context for downstream routing
 *
 * ── CHAT DOCTRINE ─────────────────────────────────────────────────────────────
 *   LOW      → lock nominal, companion advisory optional
 *   MEDIUM   → elevated hold time or warning density, companion coaching fires
 *   HIGH     → stale lock or step errors, companion escalates
 *   CRITICAL → lock contention or illegal transition, rescue + max heat fires
 *
 * ── ADAPTER MODES ─────────────────────────────────────────────────────────────
 *   DEFAULT  — emits for MEDIUM/HIGH/CRITICAL only
 *   STRICT   — emits only for HIGH/CRITICAL
 *   VERBOSE  — emits for all lock operations including LOW; full ML vector
 *
 * ── FOUR GAME MODES ───────────────────────────────────────────────────────────
 *   - Empire   (solo)  — GO ALONE — sovereign narration
 *   - Predator (pvp)   — HEAD TO HEAD — rivalry witness
 *   - Syndicate(coop)  — TEAM UP — shared lock awareness
 *   - Phantom  (ghost) — CHASE A LEGEND — extraction urgency
 *
 * ── SINGLETONS ────────────────────────────────────────────────────────────────
 *   TICK_STATE_LOCK_DEFAULT_SIGNAL_ADAPTER
 *   TICK_STATE_LOCK_STRICT_SIGNAL_ADAPTER
 *   TICK_STATE_LOCK_VERBOSE_SIGNAL_ADAPTER
 *   TICK_STATE_LOCK_SIGNAL_ADAPTER_MANIFEST
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

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

/** Current unix timestamp in ms. */
function nowMs(): UnixMs {
  return Date.now() as UnixMs;
}

// ─── STRUCTURAL COMPAT TYPES ──────────────────────────────────────────────────
// These mirror the zero/ TickStateLock types without importing from zero/.
// Structural compatibility with zero/ types is enforced by shape, not import.

/** Structural compat for TickStateLockSeverity. */
export type TickStateLockSignalAdapterSeverityCompat =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

/** Structural compat for TickStateLockOperationKind. */
export type TickStateLockSignalAdapterOperationKindCompat =
  | 'ACQUIRE'
  | 'RELEASE'
  | 'START'
  | 'ACTIVATE'
  | 'END'
  | 'RESET'
  | 'ASSERT'
  | 'VALIDATE'
  | 'NOOP';

/** Structural compat for TickRuntimeState. */
export type TickStateLockRuntimeStateCompat =
  | 'IDLE'
  | 'STARTING'
  | 'ACTIVE'
  | 'TICK_LOCKED'
  | 'ENDING'
  | 'ENDED';

/** Structural compat for ModeCode. */
export type TickStateLockModeCodeCompat = 'solo' | 'pvp' | 'coop' | 'ghost';

/** Structural compat for RunPhase. */
export type TickStateLockRunPhaseCompat =
  | 'FOUNDATION'
  | 'ESCALATION'
  | 'SOVEREIGNTY';

/** Structural compat for PressureTier. */
export type TickStateLockPressureTierCompat = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

/** Structural compat for RunOutcome (nullable to represent ongoing runs). */
export type TickStateLockRunOutcomeCompat =
  | 'FREEDOM'
  | 'TIMEOUT'
  | 'BANKRUPT'
  | 'ABANDONED'
  | null;

/**
 * 32-dim ML feature vector compat — mirrors TickStateLockMLVector from zero/.
 * All fields normalized to [0,1].
 */
export interface TickStateLockMLVectorCompat {
  // Lifecycle state one-hot (6)
  readonly stateIdleEncoded: number;
  readonly stateStartingEncoded: number;
  readonly stateActiveEncoded: number;
  readonly stateTickLockedEncoded: number;
  readonly stateEndingEncoded: number;
  readonly stateEndedEncoded: number;
  // Lock behavior (2)
  readonly lockHoldNormalized: number;
  readonly lockContentionRatio: number;
  // Tick-level (5)
  readonly tickNormalized: number;
  readonly tickDeltaNormalized: number;
  readonly stepCountNormalized: number;
  readonly stepErrorRatio: number;
  readonly stepWarningRatio: number;
  // Run context (3)
  readonly modeNormalized: number;
  readonly pressureTierNormalized: number;
  readonly runPhaseNormalized: number;
  // Transition analytics (4)
  readonly transitionCountNormalized: number;
  readonly legalTransitionRatio: number;
  readonly illegalTransitionCount: number;
  readonly resetCountNormalized: number;
  // Session (6)
  readonly sessionDurationNormalized: number;
  readonly sessionEntryCountNormalized: number;
  readonly avgHoldDurationNormalized: number;
  readonly maxHoldDurationNormalized: number;
  readonly lockAttemptCountNormalized: number;
  readonly releaseAttemptCountNormalized: number;
  // Engine health (2)
  readonly criticalEngineHealthScore: number;
  readonly allEnginesHealthy: number;
  // Outcome (2)
  readonly terminalStateReached: number;
  readonly outcomePresent: number;
  // Overall (2)
  readonly healthScore: number;
  readonly severityEncoded: number;
}

/** Structural compat for TickStateLockDLTensorRow — 8 columns. */
export interface TickStateLockDLTensorRowCompat {
  readonly step: string;
  readonly ordinal: number;
  readonly ownerEncoded: number;
  readonly lockHeldDuringStep: number;
  readonly errorsDuringStep: number;
  readonly warningsDuringStep: number;
  readonly durationNormalized: number;
  readonly mutatesState: number;
}

/** Structural compat for TickStateLockDLTensor — 13 rows × 8 cols. */
export type TickStateLockDLTensorCompat =
  readonly TickStateLockDLTensorRowCompat[];

/** Structural compat for TickStateLockNarrationHint. */
export interface TickStateLockNarrationHintCompat {
  readonly phrase: string;
  readonly urgencyLabel: string;
  readonly heatMultiplier: number;
  readonly companionIntent: string;
  readonly audienceReaction: string;
}

/** Structural compat for TickStateLockAnnotation. */
export interface TickStateLockAnnotationCompat {
  readonly fingerprint: string;
  readonly severity: TickStateLockSignalAdapterSeverityCompat;
  readonly healthScore: number;
  readonly label: string;
  readonly description: string;
  readonly state: TickStateLockRuntimeStateCompat;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly lockHoldDurationMs: number | null;
  readonly transitionCount: number;
  readonly illegalTransitions: number;
  readonly operationKind: TickStateLockSignalAdapterOperationKindCompat;
  readonly criticalIssues: readonly string[];
  readonly warnings: readonly string[];
  readonly emittedAtMs: number;
}

/** Structural compat for TickStateLockHealthSnapshot. */
export interface TickStateLockHealthSnapshotCompat {
  readonly fingerprint: string;
  readonly healthScore: number;
  readonly severity: TickStateLockSignalAdapterSeverityCompat;
  readonly state: TickStateLockRuntimeStateCompat;
  readonly actionRecommendation: string;
  readonly narrationHint: TickStateLockNarrationHintCompat;
  readonly lockHoldDurationMs: number | null;
  readonly transitionCount: number;
  readonly isTerminal: boolean;
  readonly isStaleLock: boolean;
  readonly operationKind: TickStateLockSignalAdapterOperationKindCompat;
  readonly criticalIssues: readonly string[];
  readonly warnings: readonly string[];
}

/** Structural compat for TickStateLockRunSummary. */
export interface TickStateLockRunSummaryCompat {
  readonly runId: string;
  readonly tick: number;
  readonly fingerprint: string;
  readonly healthScore: number;
  readonly severity: TickStateLockSignalAdapterSeverityCompat;
  readonly state: TickStateLockRuntimeStateCompat;
  readonly lockHoldDurationMs: number | null;
  readonly transitionCount: number;
  readonly mode: TickStateLockModeCodeCompat | null;
  readonly phase: TickStateLockRunPhaseCompat | null;
  readonly pressureTier: TickStateLockPressureTierCompat | null;
  readonly outcome: TickStateLockRunOutcomeCompat;
  readonly narrationPhrase: string;
}

/** Structural compat for TickStateLockTrendSnapshot. */
export interface TickStateLockTrendSnapshotCompat {
  readonly windowSize: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly avgHoldDurationMs: number;
  readonly maxHoldDurationMs: number;
  readonly severityCounts: Readonly<
    Record<TickStateLockSignalAdapterSeverityCompat, number>
  >;
  readonly dominantSeverity: TickStateLockSignalAdapterSeverityCompat;
  readonly illegalTransitionTrend: boolean;
  readonly lockContentionTrend: boolean;
}

/** Structural compat for TickStateLockSessionReport. */
export interface TickStateLockSessionReportCompat {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly entryCount: number;
  readonly avgHealthScore: number;
  readonly avgHoldDurationMs: number;
  readonly maxHoldDurationMs: number;
  readonly illegalTransitions: number;
  readonly severityDistribution: Readonly<
    Record<TickStateLockSignalAdapterSeverityCompat, number>
  >;
  readonly terminalStateReached: boolean;
  readonly finalState: TickStateLockRuntimeStateCompat | null;
}

/**
 * Main structural compat for TickStateLockChatSignal.
 * This is the primary ingress shape for the adapter.
 */
export interface TickStateLockSignalCompat {
  readonly runId: string;
  readonly tick: number;
  readonly severity: TickStateLockSignalAdapterSeverityCompat;
  readonly operationKind: TickStateLockSignalAdapterOperationKindCompat;
  readonly healthScore: number;
  readonly state: TickStateLockRuntimeStateCompat;
  readonly lockHoldDurationMs: Nullable<number>;
  readonly transitionCount: number;
  readonly isTerminal: boolean;
  readonly mode: TickStateLockModeCodeCompat | null;
  readonly phase: TickStateLockRunPhaseCompat | null;
  readonly narrationHint: string;
  readonly mlVector: TickStateLockMLVectorCompat;
  readonly dlTensor: TickStateLockDLTensorCompat;
  readonly emittedAtMs: number;
}

// ─── MODULE CONSTANTS ─────────────────────────────────────────────────────────

/** Adapter version. */
export const TICK_STATE_LOCK_SIGNAL_ADAPTER_VERSION = '1.0.2026' as const;

/** Readiness flag. */
export const TICK_STATE_LOCK_SIGNAL_ADAPTER_READY = true as const;

/** Schema identifier. */
export const TICK_STATE_LOCK_SIGNAL_ADAPTER_SCHEMA =
  'tick-state-lock-signal-adapter-v1' as const;

/** ML feature count — 32 dimensions. */
export const TICK_STATE_LOCK_SIGNAL_ADAPTER_ML_FEATURE_COUNT = 32 as const;

/** DL tensor shape — 13 steps × 8 columns. */
export const TICK_STATE_LOCK_SIGNAL_ADAPTER_DL_TENSOR_SHAPE = Object.freeze(
  [13, 8] as const,
);

/** Maximum heat multiplier. */
export const TICK_STATE_LOCK_SIGNAL_ADAPTER_MAX_HEAT = 1.0 as const;

/** World event name prefix for routing. */
export const TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX =
  'tick_state_lock' as const;

// ─── ADAPTER MODE TYPE ────────────────────────────────────────────────────────

/** Emission threshold mode for the adapter. */
export type TickStateLockAdapterModeCompat = 'DEFAULT' | 'STRICT' | 'VERBOSE';

// ─── MANIFEST INTERFACE ───────────────────────────────────────────────────────

/** Module manifest for adapter suite registration. */
export interface TickStateLockSignalAdapterManifest {
  readonly adapterId: string;
  readonly adapterName: string;
  readonly version: string;
  readonly schema: string;
  readonly mode: TickStateLockAdapterModeCompat;
  readonly mlFeatureCount: number;
  readonly dlTensorShape: readonly [number, number];
  readonly emitsOnLow: boolean;
  readonly emitsOnMedium: boolean;
  readonly emitsOnHigh: boolean;
  readonly emitsOnCritical: boolean;
}

// ─── TRANSLATION RESULT ───────────────────────────────────────────────────────

/** Result of translating one TickStateLockSignalCompat. */
export interface TickStateLockTranslationResult {
  readonly accepted: boolean;
  readonly envelope: ChatInputEnvelope | null;
  readonly reason: string;
  readonly signal: TickStateLockSignalCompat;
}

// ─── DIFF REPORT TYPE ────────────────────────────────────────────────────────

/** Diff between two TickStateLockSignalCompat values. */
export interface TickStateLockSignalDiffReport {
  readonly changed: boolean;
  readonly healthDelta: number;
  readonly severityChanged: boolean;
  readonly stateChanged: boolean;
  readonly operationKindChanged: boolean;
  readonly terminalityChanged: boolean;
}

// ─── ANNOTATION BUNDLE ────────────────────────────────────────────────────────

/** Bundle of multiple annotations from one run segment. */
export interface TickStateLockSignalAnnotationBundle {
  readonly runId: string | null;
  readonly tick: number | null;
  readonly annotations: readonly TickStateLockAnnotationCompat[];
  readonly fingerprints: readonly string[];
  readonly dominantSeverity: TickStateLockSignalAdapterSeverityCompat;
  readonly bundledAtMs: number;
}

// ─── METRICS SNAPSHOT ────────────────────────────────────────────────────────

/** Adapter-level metrics for operator dashboards. */
export interface TickStateLockAdapterMetricsSnapshot {
  readonly totalEmitted: number;
  readonly totalRejected: number;
  readonly avgHealthScore: number;
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly lastSignalAtMs: number | null;
}

// ─── EXPORT BUNDLE ────────────────────────────────────────────────────────────

/** Full export bundle for diagnostics and proof. */
export interface TickStateLockSignalExportBundle {
  readonly signal: TickStateLockSignalCompat;
  readonly annotation: TickStateLockAnnotationCompat;
  readonly healthSnapshot: TickStateLockHealthSnapshotCompat;
  readonly runSummary: TickStateLockRunSummaryCompat;
  readonly trendSnapshot: TickStateLockTrendSnapshotCompat;
  readonly sessionReport: TickStateLockSessionReportCompat;
  readonly exportedAtMs: number;
}

// ─── WORLD EVENT KEY BUILDERS ─────────────────────────────────────────────────

function buildLockSignalWorldEvent(
  op: TickStateLockSignalAdapterOperationKindCompat,
  sev: TickStateLockSignalAdapterSeverityCompat,
): string {
  return `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:${op.toLowerCase()}:${sev.toLowerCase()}`;
}

function buildLockAnnotationWorldEvent(
  op: TickStateLockSignalAdapterOperationKindCompat,
): string {
  return `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:annotation:${op.toLowerCase()}`;
}

function buildLockNarrationWorldEvent(
  op: TickStateLockSignalAdapterOperationKindCompat,
): string {
  return `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:narration:${op.toLowerCase()}`;
}

function buildLockHealthWorldEvent(
  sev: TickStateLockSignalAdapterSeverityCompat,
): string {
  return `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:health:${sev.toLowerCase()}`;
}

function buildLockRunSummaryWorldEvent(runId: string): string {
  return `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:run_summary:${runId.slice(0, 8)}`;
}

function buildLockTrendWorldEvent(
  dominant: TickStateLockSignalAdapterSeverityCompat,
): string {
  return `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:trend:${dominant.toLowerCase()}`;
}

function buildLockSessionWorldEvent(sessionId: string): string {
  return `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:session:${sessionId.slice(0, 8)}`;
}

function buildLockDLTensorWorldEvent(step: string): string {
  return `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:dl_tensor:${step.toLowerCase()}`;
}

// ─── HEAT / SEVERITY HELPERS ──────────────────────────────────────────────────

/**
 * Converts a TickStateLock severity to a normalized chat heat multiplier.
 * Uses Score01 branded type from chat/types.
 */
export function translateTickStateLockSeverityToHeat(
  severity: TickStateLockSignalAdapterSeverityCompat,
): Score01 {
  switch (severity) {
    case 'LOW':
      return 0.05 as Score01;
    case 'MEDIUM':
      return 0.38 as Score01;
    case 'HIGH':
      return 0.72 as Score01;
    case 'CRITICAL':
      return 1.0 as Score01;
    default:
      return 0.05 as Score01;
  }
}

/** Returns true if the adapter should emit for the given severity + mode. */
function shouldEmitLockSignal(
  severity: TickStateLockSignalAdapterSeverityCompat,
  mode: TickStateLockAdapterModeCompat,
): boolean {
  if (mode === 'VERBOSE') return true;
  if (mode === 'STRICT') {
    return severity === 'HIGH' || severity === 'CRITICAL';
  }
  // DEFAULT — emit for MEDIUM and above
  return severity !== 'LOW';
}

/** Maps operation kind to chat lane identifier. */
function operationKindToChatLane(
  op: TickStateLockSignalAdapterOperationKindCompat,
): string {
  switch (op) {
    case 'ACQUIRE':
      return 'LIVEOPS_ACQUIRE';
    case 'RELEASE':
      return 'LIVEOPS_RELEASE';
    case 'START':
      return 'LIVEOPS_START';
    case 'ACTIVATE':
      return 'LIVEOPS_ACTIVATE';
    case 'END':
      return 'LIVEOPS_END';
    case 'RESET':
      return 'LIVEOPS_RESET';
    case 'ASSERT':
      return 'LIVEOPS_ASSERT';
    case 'VALIDATE':
      return 'LIVEOPS_VALIDATE';
    case 'NOOP':
      return 'LIVEOPS_NOOP';
    default:
      return 'LIVEOPS_SIGNAL';
  }
}

/** Returns numeric rank for severity comparison. */
function severityRank(sev: TickStateLockSignalAdapterSeverityCompat): number {
  switch (sev) {
    case 'LOW':
      return 0;
    case 'MEDIUM':
      return 1;
    case 'HIGH':
      return 2;
    case 'CRITICAL':
      return 3;
  }
}

// ─── LIVEOPS PAYLOAD BUILDER ──────────────────────────────────────────────────

/**
 * Builds a structured LIVEOPS payload object for a TickStateLockSignalCompat.
 * Used externally for manual payload construction.
 */
export function buildTickStateLockLiveOpsPayload(
  signal: TickStateLockSignalCompat,
  roomId: ChatRoomId,
  ts: UnixMs,
  mode: TickStateLockAdapterModeCompat,
): {
  readonly worldEventName: string;
  readonly heatMultiplier01: Score01;
  readonly helperBlackout: boolean;
  readonly haterRaidActive: boolean;
} {
  const worldEvent = buildLockSignalWorldEvent(
    signal.operationKind,
    signal.severity,
  );
  const heat = translateTickStateLockSeverityToHeat(signal.severity);

  void mode;
  void roomId;
  void ts;

  return Object.freeze({
    worldEventName: worldEvent,
    heatMultiplier01: clamp01(heat) as Score01,
    helperBlackout: signal.severity === 'CRITICAL',
    haterRaidActive:
      signal.severity === 'HIGH' || signal.severity === 'CRITICAL',
  });
}

// ─── METADATA BUILDER ────────────────────────────────────────────────────────

function buildLockSignalMetadata(
  signal: TickStateLockSignalCompat,
  verbose: boolean,
): Record<string, JsonValue> {
  const base: Record<string, JsonValue> = {
    operationKind: signal.operationKind,
    severity: signal.severity,
    healthScore: signal.healthScore,
    tick: signal.tick,
    runId: signal.runId,
    state: signal.state,
    mode: signal.mode ?? 'null',
    phase: signal.phase ?? 'null',
    isTerminal: signal.isTerminal,
    transitionCount: signal.transitionCount,
    lockHoldDurationMs: signal.lockHoldDurationMs ?? 0,
    adapterVersion: TICK_STATE_LOCK_SIGNAL_ADAPTER_VERSION,
    schema: TICK_STATE_LOCK_SIGNAL_ADAPTER_SCHEMA,
    narrationHint: signal.narrationHint,
  };

  if (verbose) {
    base['mlVector'] = JSON.stringify(signal.mlVector) as JsonValue;
    base['dlTensorRowCount'] = signal.dlTensor.length;
  }

  return base;
}

// ─── CHAT ENVELOPE BUILDER ────────────────────────────────────────────────────

/**
 * Builds a ChatInputEnvelope from a TickStateLockSignalCompat.
 * Produces a LIVEOPS_SIGNAL envelope carrying lock state context.
 */
function buildLockChatInputEnvelope(
  signal: TickStateLockSignalCompat,
  roomId: ChatRoomId,
  ts: UnixMs,
  verbose: boolean,
): ChatInputEnvelope {
  const heat = translateTickStateLockSeverityToHeat(signal.severity);
  const metadata = buildLockSignalMetadata(signal, verbose);

  const signalPayload: ChatSignalEnvelope = {
    type: 'LIVEOPS' as const,
    emittedAt: ts,
    roomId,
    liveops: {
      worldEventName: buildLockSignalWorldEvent(
        signal.operationKind,
        signal.severity,
      ),
      heatMultiplier01: clamp01(heat) as Score01,
      helperBlackout: signal.severity === 'CRITICAL',
      haterRaidActive:
        signal.severity === 'HIGH' || signal.severity === 'CRITICAL',
    },
    metadata,
  };

  return {
    kind: 'LIVEOPS_SIGNAL',
    emittedAt: ts,
    payload: signalPayload,
  } satisfies ChatInputEnvelope;
}

// ─── TYPE GUARDS ──────────────────────────────────────────────────────────────

/** Returns true if `v` is a valid TickStateLockSignalAdapterSeverityCompat. */
export function isTickStateLockSeverityCompat(
  v: unknown,
): v is TickStateLockSignalAdapterSeverityCompat {
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL';
}

/** Returns true if `v` is a valid TickStateLockSignalAdapterOperationKindCompat. */
export function isTickStateLockOperationKindCompat(
  v: unknown,
): v is TickStateLockSignalAdapterOperationKindCompat {
  return (
    v === 'ACQUIRE' ||
    v === 'RELEASE' ||
    v === 'START' ||
    v === 'ACTIVATE' ||
    v === 'END' ||
    v === 'RESET' ||
    v === 'ASSERT' ||
    v === 'VALIDATE' ||
    v === 'NOOP'
  );
}

/** Returns true if `v` is a valid TickStateLockRuntimeStateCompat. */
export function isTickStateLockRuntimeStateCompat(
  v: unknown,
): v is TickStateLockRuntimeStateCompat {
  return (
    v === 'IDLE' ||
    v === 'STARTING' ||
    v === 'ACTIVE' ||
    v === 'TICK_LOCKED' ||
    v === 'ENDING' ||
    v === 'ENDED'
  );
}

/** Returns true if `v` is a valid TickStateLockModeCodeCompat. */
export function isTickStateLockModeCodeCompat(
  v: unknown,
): v is TickStateLockModeCodeCompat {
  return v === 'solo' || v === 'pvp' || v === 'coop' || v === 'ghost';
}

// ─── ML FEATURE EXTRACTION ────────────────────────────────────────────────────

/**
 * Extracts a 32-dim ML feature vector compat from a TickStateLockSignalCompat.
 * Reuses the embedded mlVector where present.
 */
export function extractTickStateLockSignalMLVector(
  signal: TickStateLockSignalCompat,
): TickStateLockMLVectorCompat {
  const base = signal.mlVector;

  return Object.freeze({
    stateIdleEncoded: base.stateIdleEncoded,
    stateStartingEncoded: base.stateStartingEncoded,
    stateActiveEncoded: base.stateActiveEncoded,
    stateTickLockedEncoded: base.stateTickLockedEncoded,
    stateEndingEncoded: base.stateEndingEncoded,
    stateEndedEncoded: base.stateEndedEncoded,
    lockHoldNormalized: base.lockHoldNormalized,
    lockContentionRatio: base.lockContentionRatio,
    tickNormalized: clamp01(signal.tick / 10_000),
    tickDeltaNormalized: base.tickDeltaNormalized,
    stepCountNormalized: base.stepCountNormalized,
    stepErrorRatio: base.stepErrorRatio,
    stepWarningRatio: base.stepWarningRatio,
    modeNormalized: signal.mode === 'solo'
      ? 0.25
      : signal.mode === 'pvp'
        ? 0.5
        : signal.mode === 'coop'
          ? 0.75
          : signal.mode === 'ghost'
            ? 1.0
            : 0,
    pressureTierNormalized: base.pressureTierNormalized,
    runPhaseNormalized: signal.phase === 'FOUNDATION'
      ? 0.33
      : signal.phase === 'ESCALATION'
        ? 0.66
        : signal.phase === 'SOVEREIGNTY'
          ? 1.0
          : 0,
    transitionCountNormalized: clamp01(signal.transitionCount / 1_000),
    legalTransitionRatio: base.legalTransitionRatio,
    illegalTransitionCount: base.illegalTransitionCount,
    resetCountNormalized: base.resetCountNormalized,
    sessionDurationNormalized: base.sessionDurationNormalized,
    sessionEntryCountNormalized: base.sessionEntryCountNormalized,
    avgHoldDurationNormalized: clamp01((signal.lockHoldDurationMs ?? 0) / 60_000),
    maxHoldDurationNormalized: base.maxHoldDurationNormalized,
    lockAttemptCountNormalized: base.lockAttemptCountNormalized,
    releaseAttemptCountNormalized: base.releaseAttemptCountNormalized,
    criticalEngineHealthScore: base.criticalEngineHealthScore,
    allEnginesHealthy: base.allEnginesHealthy,
    terminalStateReached: signal.isTerminal ? 1 : 0,
    outcomePresent: base.outcomePresent,
    healthScore: clamp01(signal.healthScore),
    severityEncoded:
      signal.severity === 'LOW'
        ? 0.25
        : signal.severity === 'MEDIUM'
          ? 0.5
          : signal.severity === 'HIGH'
            ? 0.75
            : 1.0,
  });
}

// ─── DL TENSOR CONSTRUCTION ───────────────────────────────────────────────────

const CANONICAL_STEPS_COMPAT = [
  'STEP_01_PREPARE',
  'STEP_02_TIME',
  'STEP_03_PRESSURE',
  'STEP_04_TENSION',
  'STEP_05_BATTLE',
  'STEP_06_SHIELD',
  'STEP_07_CASCADE',
  'STEP_08_MODE_POST',
  'STEP_09_TELEMETRY',
  'STEP_10_SOVEREIGNTY_SNAPSHOT',
  'STEP_11_OUTCOME_GATE',
  'STEP_12_EVENT_SEAL',
  'STEP_13_FLUSH',
] as const;

/**
 * Builds the 13×8 DL tensor compat from a TickStateLockSignalCompat.
 * Extracts or reconstructs each step row.
 */
export function buildTickStateLockSignalDLTensor(
  signal: TickStateLockSignalCompat,
): TickStateLockDLTensorCompat {
  if (signal.dlTensor.length === CANONICAL_STEPS_COMPAT.length) {
    return signal.dlTensor;
  }

  // Reconstruct from canonical step list
  return Object.freeze(
    CANONICAL_STEPS_COMPAT.map((step, idx): TickStateLockDLTensorRowCompat => {
      const existing = signal.dlTensor[idx];
      return Object.freeze({
        step,
        ordinal: clamp01((idx + 1) / 13),
        ownerEncoded: existing?.ownerEncoded ?? 0,
        lockHeldDuringStep: signal.state === 'TICK_LOCKED' ? 1 : 0,
        errorsDuringStep: existing?.errorsDuringStep ?? 0,
        warningsDuringStep: existing?.warningsDuringStep ?? 0,
        durationNormalized: existing?.durationNormalized ?? 0,
        mutatesState: existing?.mutatesState ?? 1,
      });
    }),
  );
}

// ─── HEALTH SCORE + SEVERITY CLASSIFICATION ───────────────────────────────────

/**
 * Computes a health score [0,1] from a TickStateLockSignalCompat.
 * Reflects state quality, hold time, terminal status, and transition compliance.
 */
export function computeTickStateLockSignalHealthScore(
  signal: TickStateLockSignalCompat,
): number {
  let score = signal.healthScore;

  // Re-penalize based on observable signal fields
  if (signal.isTerminal && signal.state !== 'ENDED') score -= 0.05;
  if ((signal.lockHoldDurationMs ?? 0) > 30_000) score -= 0.3;
  if (signal.mlVector.lockContentionRatio > 0) score -= 0.3;
  if (signal.mlVector.illegalTransitionCount > 0) score -= 0.2;

  return clamp01(score);
}

/**
 * Classifies severity from a recomputed health score.
 */
export function classifyTickStateLockSignalSeverity(
  signal: TickStateLockSignalCompat,
): TickStateLockSignalAdapterSeverityCompat {
  const h = computeTickStateLockSignalHealthScore(signal);
  if (h < 0.3) return 'CRITICAL';
  if (h < 0.5) return 'HIGH';
  if (h < 0.75) return 'MEDIUM';
  return 'LOW';
}

// ─── NARRATION BUILDER ────────────────────────────────────────────────────────

/**
 * Builds a mode-native narration hint for companion routing.
 * Four doctrines: Empire (solo), Predator (pvp), Syndicate (coop), Phantom (ghost).
 */
export function buildTickStateLockSignalNarrationHint(
  signal: TickStateLockSignalCompat,
): TickStateLockNarrationHintCompat {
  const mode = signal.mode;
  const modeLabel =
    mode === 'solo'
      ? 'Empire'
      : mode === 'pvp'
        ? 'Predator'
        : mode === 'coop'
          ? 'Syndicate'
          : mode === 'ghost'
            ? 'Phantom'
            : 'Sovereign';

  const sev = signal.severity;

  if (sev === 'CRITICAL') {
    const isStaleLock =
      signal.state === 'TICK_LOCKED' &&
      (signal.lockHoldDurationMs ?? 0) > 30_000;
    return Object.freeze({
      phrase: isStaleLock
        ? `${modeLabel} — tick lock is frozen. Engine execution stalled.`
        : `${modeLabel} — critical lock event. Illegal transition or contention detected.`,
      urgencyLabel: 'CRITICAL — ENGINE LOCK BREACH',
      heatMultiplier: TICK_STATE_LOCK_SIGNAL_ADAPTER_MAX_HEAT,
      companionIntent: 'RESCUE',
      audienceReaction: 'WITNESS_ALARM',
    });
  }

  if (sev === 'HIGH') {
    return Object.freeze({
      phrase: `${modeLabel} — lock pressure elevated. Step execution taking longer than expected.`,
      urgencyLabel: 'HIGH — LOCK PRESSURE',
      heatMultiplier: 0.85,
      companionIntent: 'ESCALATE',
      audienceReaction: 'CROWD_TENSE',
    });
  }

  if (sev === 'MEDIUM') {
    return Object.freeze({
      phrase: `${modeLabel} — tick lock advisory. Monitor hold duration and step density.`,
      urgencyLabel: 'MEDIUM — LOCK ADVISORY',
      heatMultiplier: 0.5,
      companionIntent: 'COACHING',
      audienceReaction: 'CROWD_WATCHING',
    });
  }

  // LOW — nominal narration by state
  const stateNarrations: Record<TickStateLockRuntimeStateCompat, string> = {
    IDLE: `${modeLabel} — system ready. Awaiting run start.`,
    STARTING: `${modeLabel} — run starting. Engine initializing.`,
    ACTIVE: `${modeLabel} — engine active. Tick sequence nominal.`,
    TICK_LOCKED: `${modeLabel} — tick lock held. Execution in progress.`,
    ENDING: `${modeLabel} — run ending. Finalizing state.`,
    ENDED: `${modeLabel} — run complete. Lock released cleanly.`,
  };

  return Object.freeze({
    phrase: stateNarrations[signal.state],
    urgencyLabel: 'LOW — NOMINAL',
    heatMultiplier: 0.2,
    companionIntent: 'ADVISORY',
    audienceReaction: 'AMBIENT',
  });
}

// ─── ANNOTATION BUILDER ───────────────────────────────────────────────────────

/**
 * Builds a TickStateLockAnnotationCompat from a signal.
 */
export function buildTickStateLockSignalAnnotation(
  signal: TickStateLockSignalCompat,
): TickStateLockAnnotationCompat {
  const atMs = nowMs();
  const fingerprint = `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:${signal.state}:${signal.runId ?? 'none'}:${signal.tick}:${atMs}`;

  const criticalIssues: string[] = [];
  const warnings: string[] = [];

  if (
    signal.state === 'TICK_LOCKED' &&
    (signal.lockHoldDurationMs ?? 0) > 30_000
  ) {
    criticalIssues.push(
      `Stale lock: held ${signal.lockHoldDurationMs}ms (threshold: 30000ms).`,
    );
  }

  if (signal.mlVector.lockContentionRatio > 0) {
    criticalIssues.push('Lock contention detected.');
  }

  if (signal.mlVector.illegalTransitionCount > 0) {
    criticalIssues.push(
      `Illegal transitions: ${signal.mlVector.illegalTransitionCount.toFixed(3)}.`,
    );
  }

  if (signal.mlVector.stepErrorRatio > 0) {
    warnings.push(
      `Step error density: ${signal.mlVector.stepErrorRatio.toFixed(3)}.`,
    );
  }

  if (signal.mlVector.stepWarningRatio > 0) {
    warnings.push(
      `Step warning density: ${signal.mlVector.stepWarningRatio.toFixed(3)}.`,
    );
  }

  const label =
    signal.severity === 'CRITICAL'
      ? 'LOCK_CRITICAL'
      : signal.severity === 'HIGH'
        ? 'LOCK_HIGH'
        : signal.severity === 'MEDIUM'
          ? 'LOCK_ADVISORY'
          : 'LOCK_NOMINAL';

  return Object.freeze({
    fingerprint,
    severity: signal.severity,
    healthScore: signal.healthScore,
    label,
    description: `TickStateLock[${signal.state}] — health: ${signal.healthScore.toFixed(3)} — op: ${signal.operationKind}`,
    state: signal.state,
    runId: signal.runId,
    tick: signal.tick,
    lockHoldDurationMs: signal.lockHoldDurationMs,
    transitionCount: signal.transitionCount,
    illegalTransitions: Math.round(
      signal.mlVector.illegalTransitionCount * Math.max(1, signal.transitionCount),
    ),
    operationKind: signal.operationKind,
    criticalIssues: Object.freeze(criticalIssues),
    warnings: Object.freeze(warnings),
    emittedAtMs: atMs,
  });
}

// ─── HEALTH SNAPSHOT BUILDER ──────────────────────────────────────────────────

/**
 * Builds a TickStateLockHealthSnapshotCompat for operator dashboards.
 */
export function buildTickStateLockSignalHealthSnapshot(
  signal: TickStateLockSignalCompat,
): TickStateLockHealthSnapshotCompat {
  const atMs = nowMs();
  const fingerprint = `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:health:${signal.state}:${atMs}`;
  const narrationHint = buildTickStateLockSignalNarrationHint(signal);

  const criticalIssues: string[] = [];
  const warnings: string[] = [];

  if (signal.mlVector.lockContentionRatio > 0) {
    criticalIssues.push('Lock contention active.');
  }
  if (
    signal.state === 'TICK_LOCKED' &&
    (signal.lockHoldDurationMs ?? 0) > 30_000
  ) {
    criticalIssues.push('Stale lock detected.');
  }
  if (signal.mlVector.stepErrorRatio > 0) {
    warnings.push(`Step errors: ${signal.mlVector.stepErrorRatio.toFixed(3)}`);
  }
  if (signal.mlVector.stepWarningRatio > 0) {
    warnings.push(
      `Step warnings: ${signal.mlVector.stepWarningRatio.toFixed(3)}`,
    );
  }

  const actionRecommendation =
    signal.severity === 'CRITICAL'
      ? 'Force-release stale lock immediately. Investigate step blocking the engine.'
      : signal.severity === 'HIGH'
        ? 'Review step error density and hold duration.'
        : signal.severity === 'MEDIUM'
          ? 'Monitor lock hold duration. Warning density above threshold.'
          : 'Lock state nominal. No action required.';

  return Object.freeze({
    fingerprint,
    healthScore: signal.healthScore,
    severity: signal.severity,
    state: signal.state,
    actionRecommendation,
    narrationHint,
    lockHoldDurationMs: signal.lockHoldDurationMs,
    transitionCount: signal.transitionCount,
    isTerminal: signal.isTerminal,
    isStaleLock:
      signal.state === 'TICK_LOCKED' &&
      (signal.lockHoldDurationMs ?? 0) > 30_000,
    operationKind: signal.operationKind,
    criticalIssues: Object.freeze(criticalIssues),
    warnings: Object.freeze(warnings),
  });
}

// ─── RUN SUMMARY BUILDER ─────────────────────────────────────────────────────

/**
 * Builds a TickStateLockRunSummaryCompat from a signal.
 */
export function buildTickStateLockSignalRunSummary(
  signal: TickStateLockSignalCompat,
): TickStateLockRunSummaryCompat {
  const atMs = nowMs();
  const fingerprint = `${TICK_STATE_LOCK_SIGNAL_WORLD_EVENT_PREFIX}:run:${signal.runId}:${signal.tick}:${atMs}`;
  const narrationHint = buildTickStateLockSignalNarrationHint(signal);

  return Object.freeze({
    runId: signal.runId,
    tick: signal.tick,
    fingerprint,
    healthScore: signal.healthScore,
    severity: signal.severity,
    state: signal.state,
    lockHoldDurationMs: signal.lockHoldDurationMs,
    transitionCount: signal.transitionCount,
    mode: signal.mode,
    phase: signal.phase,
    pressureTier: null, // not embedded in signal — caller enriches
    outcome: null,
    narrationPhrase: narrationHint.phrase,
  });
}

// ─── TREND SNAPSHOT BUILDER ───────────────────────────────────────────────────

/**
 * Builds a TickStateLockTrendSnapshotCompat from a history of signals.
 */
export function buildTickStateLockAdapterTrendSnapshot(
  history: readonly TickStateLockSignalCompat[],
): TickStateLockTrendSnapshotCompat {
  if (history.length === 0) {
    return Object.freeze({
      windowSize: 0,
      avgHealthScore: 1,
      minHealthScore: 1,
      maxHealthScore: 1,
      avgHoldDurationMs: 0,
      maxHoldDurationMs: 0,
      severityCounts: Object.freeze({
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      }),
      dominantSeverity: 'LOW' as TickStateLockSignalAdapterSeverityCompat,
      illegalTransitionTrend: false,
      lockContentionTrend: false,
    });
  }

  const healthScores = history.map((s) => s.healthScore);
  const avg = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
  const min = Math.min(...healthScores);
  const max = Math.max(...healthScores);

  const holds = history.map((s) => s.lockHoldDurationMs ?? 0);
  const avgHold = holds.reduce((a, b) => a + b, 0) / holds.length;
  const maxHold = Math.max(...holds);

  const counts: Record<TickStateLockSignalAdapterSeverityCompat, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  for (const s of history) counts[s.severity]++;

  const dominant = (
    Object.entries(counts) as Array<
      [TickStateLockSignalAdapterSeverityCompat, number]
    >
  ).reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];

  const illegalTrend = history.some(
    (s) => s.mlVector.illegalTransitionCount > 0,
  );
  const contentionTrend = history.some(
    (s) => s.mlVector.lockContentionRatio > 0,
  );

  return Object.freeze({
    windowSize: history.length,
    avgHealthScore: avg,
    minHealthScore: min,
    maxHealthScore: max,
    avgHoldDurationMs: avgHold,
    maxHoldDurationMs: maxHold,
    severityCounts: Object.freeze({ ...counts }),
    dominantSeverity: dominant,
    illegalTransitionTrend: illegalTrend,
    lockContentionTrend: contentionTrend,
  });
}

// ─── SESSION REPORT BUILDER ───────────────────────────────────────────────────

/**
 * Builds a TickStateLockSessionReportCompat from a session of signals.
 */
export function buildTickStateLockSignalSessionReport(
  sessionId: string,
  startedAtMs: number,
  signals: readonly TickStateLockSignalCompat[],
): TickStateLockSessionReportCompat {
  const holds = signals.map((s) => s.lockHoldDurationMs ?? 0);
  const avgHold = holds.length > 0
    ? holds.reduce((a, b) => a + b, 0) / holds.length
    : 0;
  const maxHold = holds.length > 0 ? Math.max(...holds) : 0;

  const dist: Record<TickStateLockSignalAdapterSeverityCompat, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  for (const s of signals) dist[s.severity]++;

  const illegalCount = signals.reduce(
    (a, s) => a + Math.round(s.mlVector.illegalTransitionCount),
    0,
  );
  const lastSignal = signals[signals.length - 1] ?? null;
  const terminalReached = lastSignal != null && lastSignal.isTerminal;

  return Object.freeze({
    sessionId,
    startedAtMs,
    entryCount: signals.length,
    avgHealthScore:
      signals.length > 0
        ? signals.reduce((a, s) => a + s.healthScore, 0) / signals.length
        : 1,
    avgHoldDurationMs: avgHold,
    maxHoldDurationMs: maxHold,
    illegalTransitions: illegalCount,
    severityDistribution: Object.freeze({ ...dist }),
    terminalStateReached: terminalReached,
    finalState: lastSignal?.state ?? null,
  });
}

// ─── EXPORT BUNDLE BUILDER ────────────────────────────────────────────────────

/**
 * Builds a full TickStateLockSignalExportBundle from one signal
 * plus a history window for trend analysis.
 */
export function buildTickStateLockSignalExportBundle(
  signal: TickStateLockSignalCompat,
  sessionId: string,
  sessionStartedAtMs: number,
  history: readonly TickStateLockSignalCompat[],
): TickStateLockSignalExportBundle {
  return Object.freeze({
    signal,
    annotation: buildTickStateLockSignalAnnotation(signal),
    healthSnapshot: buildTickStateLockSignalHealthSnapshot(signal),
    runSummary: buildTickStateLockSignalRunSummary(signal),
    trendSnapshot: buildTickStateLockAdapterTrendSnapshot(history),
    sessionReport: buildTickStateLockSignalSessionReport(
      sessionId,
      sessionStartedAtMs,
      history,
    ),
    exportedAtMs: nowMs(),
  });
}

// ─── ANNOTATION BUNDLE BUILDER ────────────────────────────────────────────────

/**
 * Builds a TickStateLockSignalAnnotationBundle from multiple signals.
 */
export function buildTickStateLockSignalAnnotationBundle(
  runId: string | null,
  tick: number | null,
  signals: readonly TickStateLockSignalCompat[],
): TickStateLockSignalAnnotationBundle {
  const annotations = signals.map((s) => buildTickStateLockSignalAnnotation(s));
  const fingerprints = annotations.map((a) => a.fingerprint);
  const severities = signals.map((s) => s.severity);

  const dominant = severities.includes('CRITICAL')
    ? 'CRITICAL'
    : severities.includes('HIGH')
      ? 'HIGH'
      : severities.includes('MEDIUM')
        ? 'MEDIUM'
        : 'LOW';

  return Object.freeze({
    runId,
    tick,
    annotations: Object.freeze(annotations),
    fingerprints: Object.freeze(fingerprints),
    dominantSeverity: dominant as TickStateLockSignalAdapterSeverityCompat,
    bundledAtMs: nowMs(),
  });
}

// ─── METRICS SNAPSHOT BUILDER ────────────────────────────────────────────────

/**
 * Builds adapter-level metrics snapshot from signal history.
 */
export function buildTickStateLockAdapterMetricsSnapshot(
  history: readonly TickStateLockSignalCompat[],
): TickStateLockAdapterMetricsSnapshot {
  if (history.length === 0) {
    return Object.freeze({
      totalEmitted: 0,
      totalRejected: 0,
      avgHealthScore: 1,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      lastSignalAtMs: null,
    });
  }

  const avgHealth =
    history.reduce((a, s) => a + s.healthScore, 0) / history.length;

  return Object.freeze({
    totalEmitted: history.length,
    totalRejected: 0, // tracked by adapter instance
    avgHealthScore: avgHealth,
    criticalCount: history.filter((s) => s.severity === 'CRITICAL').length,
    highCount: history.filter((s) => s.severity === 'HIGH').length,
    mediumCount: history.filter((s) => s.severity === 'MEDIUM').length,
    lowCount: history.filter((s) => s.severity === 'LOW').length,
    lastSignalAtMs: history[history.length - 1]?.emittedAtMs ?? null,
  });
}

// ─── DOMAIN-SPECIFIC TRANSLATORS ─────────────────────────────────────────────

/**
 * Translates a ACQUIRE-domain lock signal.
 * Fires for all severity levels — lock acquisition is always chat-worthy.
 */
export function translateTickStateLockAcquireSignal(
  signal: TickStateLockSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickStateLockTranslationResult {
  const ts = atMs ?? nowMs();

  if (signal.operationKind !== 'ACQUIRE') {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: `operation kind ${signal.operationKind} is not ACQUIRE`,
      signal,
    });
  }

  const envelope = buildLockChatInputEnvelope(signal, roomId, ts, false);
  return Object.freeze({
    accepted: true,
    envelope,
    reason: 'tick lock acquired',
    signal,
  });
}

/**
 * Translates a RELEASE-domain lock signal.
 * Fires for MEDIUM and above — lock releases are companion cues.
 */
export function translateTickStateLockReleaseSignal(
  signal: TickStateLockSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickStateLockTranslationResult {
  const ts = atMs ?? nowMs();

  if (signal.operationKind !== 'RELEASE') {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: `operation kind ${signal.operationKind} is not RELEASE`,
      signal,
    });
  }

  const isElevated =
    signal.severity === 'MEDIUM' ||
    signal.severity === 'HIGH' ||
    signal.severity === 'CRITICAL';

  if (!isElevated && (signal.lockHoldDurationMs ?? 0) < 5_000) {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: 'release nominal — below emission threshold',
      signal,
    });
  }

  const releaseSeverity: TickStateLockSignalAdapterSeverityCompat =
    (signal.lockHoldDurationMs ?? 0) > 30_000
      ? 'CRITICAL'
      : (signal.lockHoldDurationMs ?? 0) > 10_000
        ? 'HIGH'
        : signal.severity;

  const releaseSignal: TickStateLockSignalCompat = Object.freeze({
    ...signal,
    severity: releaseSeverity,
    narrationHint: `Lock released after ${signal.lockHoldDurationMs ?? 0}ms hold.`,
  });

  const envelope = buildLockChatInputEnvelope(releaseSignal, roomId, ts, false);
  return Object.freeze({
    accepted: true,
    envelope,
    reason: 'tick lock released with notable hold time',
    signal: releaseSignal,
  });
}

/**
 * Translates a stale lock signal.
 * Fires when the lock has been held past the stale threshold.
 */
export function translateTickStateLockStaleSignal(
  signal: TickStateLockSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickStateLockTranslationResult {
  const ts = atMs ?? nowMs();
  const isStale =
    signal.state === 'TICK_LOCKED' &&
    (signal.lockHoldDurationMs ?? 0) > 30_000;

  if (!isStale) {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: 'lock not stale',
      signal,
    });
  }

  const staleSignal: TickStateLockSignalCompat = Object.freeze({
    ...signal,
    severity: 'CRITICAL' as TickStateLockSignalAdapterSeverityCompat,
    operationKind: 'VALIDATE' as TickStateLockSignalAdapterOperationKindCompat,
    narrationHint: `STALE LOCK — held for ${signal.lockHoldDurationMs ?? 0}ms. Engine execution may be blocked.`,
  });

  const envelope = buildLockChatInputEnvelope(staleSignal, roomId, ts, false);
  return Object.freeze({
    accepted: true,
    envelope,
    reason: 'stale lock detected',
    signal: staleSignal,
  });
}

/**
 * Translates a terminal state signal (ENDING or ENDED).
 * Fires for all modes when the run reaches a terminal lifecycle state.
 */
export function translateTickStateLockTerminalSignal(
  signal: TickStateLockSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickStateLockTranslationResult {
  const ts = atMs ?? nowMs();

  if (!signal.isTerminal) {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: 'state is not terminal',
      signal,
    });
  }

  const terminalSeverity: TickStateLockSignalAdapterSeverityCompat =
    signal.state === 'ENDING' ? 'MEDIUM' : 'LOW';

  const terminalSignal: TickStateLockSignalCompat = Object.freeze({
    ...signal,
    severity: terminalSeverity,
    operationKind: signal.state === 'ENDING'
      ? ('END' as TickStateLockSignalAdapterOperationKindCompat)
      : ('NOOP' as TickStateLockSignalAdapterOperationKindCompat),
    narrationHint: signal.state === 'ENDING'
      ? 'Run ending — engine shutting down.'
      : 'Run complete — engine idle.',
  });

  const envelope = buildLockChatInputEnvelope(terminalSignal, roomId, ts, false);
  return Object.freeze({
    accepted: true,
    envelope,
    reason: `terminal state reached: ${signal.state}`,
    signal: terminalSignal,
  });
}

/**
 * Translates a RESET operation signal.
 * RESET is always emitted regardless of adapter mode — it's a doctrine event.
 */
export function translateTickStateLockResetSignal(
  signal: TickStateLockSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickStateLockTranslationResult {
  const ts = atMs ?? nowMs();

  if (signal.operationKind !== 'RESET') {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: `operation kind ${signal.operationKind} is not RESET`,
      signal,
    });
  }

  const resetSeverity: TickStateLockSignalAdapterSeverityCompat =
    signal.mlVector.resetCountNormalized > 0.1 ? 'HIGH' : 'MEDIUM';

  const resetSignal: TickStateLockSignalCompat = Object.freeze({
    ...signal,
    severity: resetSeverity,
    narrationHint: 'Engine reset — lock cleared. Run state returned to IDLE.',
  });

  const envelope = buildLockChatInputEnvelope(resetSignal, roomId, ts, false);
  return Object.freeze({
    accepted: true,
    envelope,
    reason: 'lock reset event',
    signal: resetSignal,
  });
}

/**
 * Translates an illegal transition signal.
 * Always emitted as CRITICAL regardless of adapter mode.
 */
export function translateTickStateLockIllegalTransitionSignal(
  signal: TickStateLockSignalCompat,
  roomId: ChatRoomId,
  atMs?: UnixMs,
): TickStateLockTranslationResult {
  const ts = atMs ?? nowMs();

  const hasIllegalTransition = signal.mlVector.illegalTransitionCount > 0;
  if (!hasIllegalTransition) {
    return Object.freeze({
      accepted: false,
      envelope: null,
      reason: 'no illegal transitions detected',
      signal,
    });
  }

  const illegalSignal: TickStateLockSignalCompat = Object.freeze({
    ...signal,
    severity: 'CRITICAL' as TickStateLockSignalAdapterSeverityCompat,
    narrationHint: `ILLEGAL TRANSITION — ${signal.mlVector.illegalTransitionCount.toFixed(3)} proportion illegal. Orchestration law violated.`,
  });

  const envelope = buildLockChatInputEnvelope(illegalSignal, roomId, ts, false);
  return Object.freeze({
    accepted: true,
    envelope,
    reason: 'illegal transition detected',
    signal: illegalSignal,
  });
}

// ─── DEDUPLICATION + BATCH ────────────────────────────────────────────────────

/**
 * Deduplicates lock signals by runId+tick+severity+state.
 */
export function deduplicateTickStateLockSignals(
  signals: readonly TickStateLockSignalCompat[],
): readonly TickStateLockSignalCompat[] {
  const seen = new Set<string>();
  const result: TickStateLockSignalCompat[] = [];
  for (const s of signals) {
    const key = `${s.runId}:${s.tick}:${s.severity}:${s.state}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(s);
    }
  }
  return Object.freeze(result);
}

/**
 * Batch-translates lock signals through the adapter.
 */
export function batchTranslateTickStateLockSignals(
  signals: readonly TickStateLockSignalCompat[],
  roomId: ChatRoomId,
  mode: TickStateLockAdapterModeCompat,
): readonly TickStateLockTranslationResult[] {
  const filtered = signals.filter((s) =>
    shouldEmitLockSignal(s.severity, mode),
  );
  return Object.freeze(
    filtered.map((s) => {
      const ts = nowMs();
      const verbose = mode === 'VERBOSE';
      const envelope = buildLockChatInputEnvelope(s, roomId, ts, verbose);
      return Object.freeze({
        accepted: true,
        envelope,
        reason: 'batch accepted',
        signal: s,
      } satisfies TickStateLockTranslationResult);
    }),
  );
}

/**
 * Computes a diff between two TickStateLockSignalCompat values.
 */
export function diffTickStateLockSignals(
  a: TickStateLockSignalCompat,
  b: TickStateLockSignalCompat,
): TickStateLockSignalDiffReport {
  return Object.freeze({
    changed:
      a.severity !== b.severity ||
      a.state !== b.state ||
      a.operationKind !== b.operationKind ||
      Math.abs(a.healthScore - b.healthScore) > 0.01,
    healthDelta: b.healthScore - a.healthScore,
    severityChanged: a.severity !== b.severity,
    stateChanged: a.state !== b.state,
    operationKindChanged: a.operationKind !== b.operationKind,
    terminalityChanged: a.isTerminal !== b.isTerminal,
  });
}

// ─── ADAPTER OPTIONS ──────────────────────────────────────────────────────────

/** Options for TickStateLockSignalAdapter construction. */
export interface TickStateLockSignalAdapterOptions {
  /** Adapter mode. Defaults to DEFAULT. */
  mode?: TickStateLockAdapterModeCompat;
  /** Minimum severity to emit. */
  minSeverity?: TickStateLockSignalAdapterSeverityCompat;
  /** Optional logger for diagnostic output. */
  logger?: (msg: string) => void;
}

// ─── MAIN ADAPTER CLASS ───────────────────────────────────────────────────────

/**
 * TickStateLockSignalAdapter
 *
 * Translates TickStateLockSignalCompat objects emitted by the Zero layer into
 * ChatInputEnvelope objects for the backend chat LIVEOPS lane.
 *
 * This adapter imports ONLY from '../types' — no zero/ dependency.
 * All type compat is structural, not nominal.
 *
 * Mode behavior:
 *   DEFAULT  — accepts MEDIUM / HIGH / CRITICAL signals
 *   STRICT   — accepts HIGH / CRITICAL only
 *   VERBOSE  — accepts all signals including LOW
 */
export class TickStateLockSignalAdapter {
  private readonly mode: TickStateLockAdapterModeCompat;
  private readonly minSeverity: TickStateLockSignalAdapterSeverityCompat;
  private readonly logger: ((msg: string) => void) | undefined;
  private acceptedCount = 0;
  private rejectedCount = 0;
  private lastSignalAtMs: number | null = null;
  private readonly history: TickStateLockSignalCompat[] = [];

  constructor(options: TickStateLockSignalAdapterOptions = {}) {
    this.mode = options.mode ?? 'DEFAULT';
    this.minSeverity = options.minSeverity ?? this.defaultMinSeverity(this.mode);
    this.logger = options.logger;
  }

  private defaultMinSeverity(
    mode: TickStateLockAdapterModeCompat,
  ): TickStateLockSignalAdapterSeverityCompat {
    switch (mode) {
      case 'STRICT':
        return 'HIGH';
      case 'VERBOSE':
        return 'LOW';
      case 'DEFAULT':
        return 'MEDIUM';
    }
  }

  private shouldAccept(signal: TickStateLockSignalCompat): boolean {
    return severityRank(signal.severity) >= severityRank(this.minSeverity);
  }

  /**
   * Translates a single TickStateLockSignalCompat into a ChatInputEnvelope.
   * Returns a TickStateLockTranslationResult indicating acceptance status.
   */
  public translate(
    signal: TickStateLockSignalCompat,
    roomId: ChatRoomId,
    atMs?: UnixMs,
  ): TickStateLockTranslationResult {
    const ts = atMs ?? nowMs();

    if (!this.shouldAccept(signal)) {
      this.rejectedCount++;
      this.logger?.(
        `[TickStateLockAdapter] rejected tick=${signal.tick} state=${signal.state} sev=${signal.severity}`,
      );
      return Object.freeze({
        accepted: false,
        envelope: null,
        reason: `severity ${signal.severity} below minSeverity ${this.minSeverity}`,
        signal,
      });
    }

    const verbose = this.mode === 'VERBOSE';
    const envelope = buildLockChatInputEnvelope(signal, roomId, ts, verbose);

    this.acceptedCount++;
    this.lastSignalAtMs = ts;
    this.history.push(signal);
    if (this.history.length > 100) this.history.shift();

    this.logger?.(
      `[TickStateLockAdapter] accepted tick=${signal.tick} state=${signal.state} sev=${signal.severity}`,
    );

    return Object.freeze({
      accepted: true,
      envelope,
      reason: 'accepted',
      signal,
    });
  }

  /**
   * Translates a batch of TickStateLockSignalCompat objects.
   */
  public translateBatch(
    signals: readonly TickStateLockSignalCompat[],
    roomId: ChatRoomId,
  ): readonly TickStateLockTranslationResult[] {
    return Object.freeze(signals.map((s) => this.translate(s, roomId)));
  }

  /**
   * Convenience method for translating an ACQUIRE operation signal.
   */
  public translateAcquireSignal(
    runId: string,
    tick: number,
    healthScore: number,
    mode: TickStateLockModeCodeCompat,
    roomId: ChatRoomId,
  ): TickStateLockTranslationResult {
    const signal = buildMinimalTickStateLockSignal(
      runId,
      tick,
      healthScore,
      mode,
      'ACQUIRE',
      'TICK_LOCKED',
    );
    return this.translate(signal, roomId);
  }

  /**
   * Convenience method for translating a RELEASE operation signal.
   */
  public translateReleaseSignal(
    runId: string,
    tick: number,
    healthScore: number,
    holdDurationMs: number,
    mode: TickStateLockModeCodeCompat,
    roomId: ChatRoomId,
  ): TickStateLockTranslationResult {
    const signal: TickStateLockSignalCompat = Object.freeze({
      ...buildMinimalTickStateLockSignal(
        runId,
        tick,
        healthScore,
        mode,
        'RELEASE',
        'ACTIVE',
      ),
      lockHoldDurationMs: holdDurationMs,
    });
    return this.translate(signal, roomId);
  }

  /**
   * Convenience method for translating a VALIDATE operation signal.
   */
  public translateValidateSignal(
    runId: string,
    tick: number,
    healthScore: number,
    state: TickStateLockRuntimeStateCompat,
    roomId: ChatRoomId,
  ): TickStateLockTranslationResult {
    const signal = buildMinimalTickStateLockSignal(
      runId,
      tick,
      healthScore,
      'solo',
      'VALIDATE',
      state,
    );
    return this.translate(signal, roomId);
  }

  /**
   * Translates a RESET event — always emitted regardless of mode.
   */
  public translateResetSignal(
    runId: string,
    tick: number,
    mode: TickStateLockModeCodeCompat,
    roomId: ChatRoomId,
  ): TickStateLockTranslationResult {
    const signal = buildMinimalTickStateLockSignal(
      runId,
      tick,
      0.9,
      mode,
      'RESET',
      'IDLE',
    );
    const ts = nowMs();
    const envelope = buildLockChatInputEnvelope(signal, roomId, ts, false);
    this.acceptedCount++;
    this.lastSignalAtMs = ts;
    return Object.freeze({
      accepted: true,
      envelope,
      reason: 'reset always emitted',
      signal,
    });
  }

  /**
   * Translates an END lifecycle signal — always emitted.
   */
  public translateEndSignal(
    runId: string,
    tick: number,
    mode: TickStateLockModeCodeCompat,
    roomId: ChatRoomId,
  ): TickStateLockTranslationResult {
    const signal = buildMinimalTickStateLockSignal(
      runId,
      tick,
      0.85,
      mode,
      'END',
      'ENDED',
    );
    const ts = nowMs();
    const envelope = buildLockChatInputEnvelope(signal, roomId, ts, false);
    this.acceptedCount++;
    this.lastSignalAtMs = ts;
    return Object.freeze({
      accepted: true,
      envelope,
      reason: 'end always emitted',
      signal,
    });
  }

  /**
   * Translates a START lifecycle signal.
   */
  public translateStartSignal(
    runId: string,
    mode: TickStateLockModeCodeCompat,
    roomId: ChatRoomId,
  ): TickStateLockTranslationResult {
    const signal = buildMinimalTickStateLockSignal(
      runId,
      0,
      1.0,
      mode,
      'START',
      'STARTING',
    );
    return this.translate(signal, roomId);
  }

  /**
   * Translates an ACTIVATE lifecycle signal.
   */
  public translateActivateSignal(
    runId: string,
    mode: TickStateLockModeCodeCompat,
    roomId: ChatRoomId,
  ): TickStateLockTranslationResult {
    const signal = buildMinimalTickStateLockSignal(
      runId,
      0,
      1.0,
      mode,
      'ACTIVATE',
      'ACTIVE',
    );
    return this.translate(signal, roomId);
  }

  /**
   * Translates a forced stale-lock emergency signal.
   * Always emitted as CRITICAL regardless of adapter mode.
   */
  public translateStaleLockAlert(
    runId: string,
    tick: number,
    holdDurationMs: number,
    mode: TickStateLockModeCodeCompat,
    roomId: ChatRoomId,
  ): TickStateLockTranslationResult {
    const signal: TickStateLockSignalCompat = Object.freeze({
      ...buildMinimalTickStateLockSignal(
        runId,
        tick,
        0.1,
        mode,
        'VALIDATE',
        'TICK_LOCKED',
      ),
      severity: 'CRITICAL' as TickStateLockSignalAdapterSeverityCompat,
      lockHoldDurationMs: holdDurationMs,
      narrationHint: `STALE LOCK ALERT — held ${holdDurationMs}ms. Engine may be frozen.`,
    });

    const ts = nowMs();
    const envelope = buildLockChatInputEnvelope(signal, roomId, ts, false);
    this.acceptedCount++;
    this.lastSignalAtMs = ts;
    return Object.freeze({
      accepted: true,
      envelope,
      reason: 'stale lock emergency',
      signal,
    });
  }

  /**
   * Returns diagnostic information about the adapter's current state.
   */
  public diagnostics(): {
    version: string;
    mode: TickStateLockAdapterModeCompat;
    acceptedCount: number;
    rejectedCount: number;
    lastSignalAtMs: number | null;
    trendSnapshot: TickStateLockTrendSnapshotCompat;
    metricsSnapshot: TickStateLockAdapterMetricsSnapshot;
  } {
    const trend = buildTickStateLockAdapterTrendSnapshot(this.history);
    const metrics = buildTickStateLockAdapterMetricsSnapshot(this.history);

    return Object.freeze({
      version: TICK_STATE_LOCK_SIGNAL_ADAPTER_VERSION,
      mode: this.mode,
      acceptedCount: this.acceptedCount,
      rejectedCount: this.rejectedCount,
      lastSignalAtMs: this.lastSignalAtMs,
      trendSnapshot: trend,
      metricsSnapshot: metrics,
    });
  }

  /** Returns the manifest for this adapter instance. */
  public getManifest(): TickStateLockSignalAdapterManifest {
    return buildTickStateLockSignalAdapterManifest(this.mode);
  }

  /** Resets adapter counters and history. */
  public reset(): void {
    this.acceptedCount = 0;
    this.rejectedCount = 0;
    this.lastSignalAtMs = null;
    this.history.length = 0;
  }
}

// ─── INTERNAL SIGNAL FACTORY ─────────────────────────────────────────────────

/** Builds a minimal TickStateLockSignalCompat for convenience methods. */
function buildMinimalTickStateLockSignal(
  runId: string,
  tick: number,
  healthScore: number,
  mode: TickStateLockModeCodeCompat,
  operationKind: TickStateLockSignalAdapterOperationKindCompat,
  state: TickStateLockRuntimeStateCompat,
): TickStateLockSignalCompat {
  const clamped = Math.max(0, Math.min(1, healthScore));
  let severity: TickStateLockSignalAdapterSeverityCompat;
  if (clamped >= 0.75) severity = 'LOW';
  else if (clamped >= 0.5) severity = 'MEDIUM';
  else if (clamped >= 0.25) severity = 'HIGH';
  else severity = 'CRITICAL';

  const phaseMap: Record<TickStateLockModeCodeCompat, TickStateLockRunPhaseCompat> = {
    solo: 'FOUNDATION',
    pvp: 'ESCALATION',
    coop: 'FOUNDATION',
    ghost: 'SOVEREIGNTY',
  };

  const modeLabel =
    mode === 'solo'
      ? 'Empire'
      : mode === 'pvp'
        ? 'Predator'
        : mode === 'coop'
          ? 'Syndicate'
          : 'Phantom';

  return Object.freeze({
    runId,
    tick,
    severity,
    operationKind,
    healthScore: clamped,
    state,
    lockHoldDurationMs: null,
    transitionCount: 0,
    isTerminal: state === 'ENDING' || state === 'ENDED',
    mode,
    phase: phaseMap[mode],
    narrationHint: `${modeLabel} — ${operationKind} ${state}`,
    mlVector: buildDefaultTickStateLockMLVectorCompat(clamped, severity, state),
    dlTensor: buildDefaultTickStateLockDLTensorCompat(),
    emittedAtMs: nowMs(),
  });
}

/** Builds a default zero-value ML vector compat. */
function buildDefaultTickStateLockMLVectorCompat(
  healthScore: number,
  severity: TickStateLockSignalAdapterSeverityCompat,
  state: TickStateLockRuntimeStateCompat,
): TickStateLockMLVectorCompat {
  const sev =
    severity === 'LOW'
      ? 0.25
      : severity === 'MEDIUM'
        ? 0.5
        : severity === 'HIGH'
          ? 0.75
          : 1.0;

  return Object.freeze({
    stateIdleEncoded: state === 'IDLE' ? 1 : 0,
    stateStartingEncoded: state === 'STARTING' ? 1 : 0,
    stateActiveEncoded: state === 'ACTIVE' ? 1 : 0,
    stateTickLockedEncoded: state === 'TICK_LOCKED' ? 1 : 0,
    stateEndingEncoded: state === 'ENDING' ? 1 : 0,
    stateEndedEncoded: state === 'ENDED' ? 1 : 0,
    lockHoldNormalized: 0,
    lockContentionRatio: 0,
    tickNormalized: 0,
    tickDeltaNormalized: 0,
    stepCountNormalized: 1,
    stepErrorRatio: 0,
    stepWarningRatio: 0,
    modeNormalized: 0,
    pressureTierNormalized: 0,
    runPhaseNormalized: 0,
    transitionCountNormalized: 0,
    legalTransitionRatio: 1,
    illegalTransitionCount: 0,
    resetCountNormalized: 0,
    sessionDurationNormalized: 0,
    sessionEntryCountNormalized: 0,
    avgHoldDurationNormalized: 0,
    maxHoldDurationNormalized: 0,
    lockAttemptCountNormalized: 0,
    releaseAttemptCountNormalized: 0,
    criticalEngineHealthScore: 1,
    allEnginesHealthy: 1,
    terminalStateReached:
      state === 'ENDING' || state === 'ENDED' ? 1 : 0,
    outcomePresent: 0,
    healthScore: clamp01(healthScore),
    severityEncoded: sev,
  });
}

/** Builds a default zero DL tensor compat (13 rows × 8 cols). */
function buildDefaultTickStateLockDLTensorCompat(): TickStateLockDLTensorCompat {
  return Object.freeze(
    CANONICAL_STEPS_COMPAT.map((step, idx): TickStateLockDLTensorRowCompat =>
      Object.freeze({
        step,
        ordinal: clamp01((idx + 1) / 13),
        ownerEncoded: 0,
        lockHeldDuringStep: 0,
        errorsDuringStep: 0,
        warningsDuringStep: 0,
        durationNormalized: 0,
        mutatesState: 1,
      }),
    ),
  );
}

// ─── MANIFEST BUILDER ────────────────────────────────────────────────────────

/** Builds a TickStateLockSignalAdapterManifest for a given mode. */
export function buildTickStateLockSignalAdapterManifest(
  mode: TickStateLockAdapterModeCompat,
): TickStateLockSignalAdapterManifest {
  return Object.freeze({
    adapterId: `tick-state-lock-signal-adapter-${mode.toLowerCase()}`,
    adapterName: `TickStateLockSignalAdapter[${mode}]`,
    version: TICK_STATE_LOCK_SIGNAL_ADAPTER_VERSION,
    schema: TICK_STATE_LOCK_SIGNAL_ADAPTER_SCHEMA,
    mode,
    mlFeatureCount: TICK_STATE_LOCK_SIGNAL_ADAPTER_ML_FEATURE_COUNT,
    dlTensorShape: TICK_STATE_LOCK_SIGNAL_ADAPTER_DL_TENSOR_SHAPE,
    emitsOnLow: mode === 'VERBOSE',
    emitsOnMedium: mode === 'VERBOSE' || mode === 'DEFAULT',
    emitsOnHigh: true,
    emitsOnCritical: true,
  });
}

// ─── WIRING HELPERS ───────────────────────────────────────────────────────────

/**
 * Wires the adapter to use world event key builders for routing.
 * Returns the world event name for a given operation + severity.
 * Exposes all private world event builders publicly.
 */
export function getTickStateLockWorldEventName(
  op: TickStateLockSignalAdapterOperationKindCompat,
  sev: TickStateLockSignalAdapterSeverityCompat,
): string {
  return buildLockSignalWorldEvent(op, sev);
}

/** Returns the annotation world event name for an operation. */
export function getTickStateLockAnnotationWorldEvent(
  op: TickStateLockSignalAdapterOperationKindCompat,
): string {
  return buildLockAnnotationWorldEvent(op);
}

/** Returns the narration world event name for an operation. */
export function getTickStateLockNarrationWorldEvent(
  op: TickStateLockSignalAdapterOperationKindCompat,
): string {
  return buildLockNarrationWorldEvent(op);
}

/** Returns the health world event name for a severity. */
export function getTickStateLockHealthWorldEvent(
  sev: TickStateLockSignalAdapterSeverityCompat,
): string {
  return buildLockHealthWorldEvent(sev);
}

/** Returns the run summary world event name. */
export function getTickStateLockRunSummaryWorldEvent(runId: string): string {
  return buildLockRunSummaryWorldEvent(runId);
}

/** Returns the trend world event name. */
export function getTickStateLockTrendWorldEvent(
  dominant: TickStateLockSignalAdapterSeverityCompat,
): string {
  return buildLockTrendWorldEvent(dominant);
}

/** Returns the session world event name. */
export function getTickStateLockSessionWorldEvent(sessionId: string): string {
  return buildLockSessionWorldEvent(sessionId);
}

/** Returns the DL tensor world event name for a step. */
export function getTickStateLockDLTensorWorldEvent(step: string): string {
  return buildLockDLTensorWorldEvent(step);
}

/** Returns the chat lane identifier for an operation kind. */
export function getTickStateLockChatLane(
  op: TickStateLockSignalAdapterOperationKindCompat,
): string {
  return operationKindToChatLane(op);
}

// ─── SINGLETONS ───────────────────────────────────────────────────────────────

/**
 * Default singleton adapter — emits for MEDIUM/HIGH/CRITICAL.
 * Use for standard backend chat routing.
 */
export const TICK_STATE_LOCK_DEFAULT_SIGNAL_ADAPTER =
  new TickStateLockSignalAdapter({ mode: 'DEFAULT' });

/**
 * Strict singleton adapter — emits for HIGH/CRITICAL only.
 * Use for high-signal-to-noise companion routing.
 */
export const TICK_STATE_LOCK_STRICT_SIGNAL_ADAPTER =
  new TickStateLockSignalAdapter({ mode: 'STRICT' });

/**
 * Verbose singleton adapter — emits for all lock operations including LOW.
 * Use for operator debug lanes and proof-bearing transcript capture.
 */
export const TICK_STATE_LOCK_VERBOSE_SIGNAL_ADAPTER =
  new TickStateLockSignalAdapter({ mode: 'VERBOSE' });

/**
 * Authoritative module manifest for the DEFAULT singleton adapter.
 */
export const TICK_STATE_LOCK_SIGNAL_ADAPTER_MANIFEST: TickStateLockSignalAdapterManifest =
  buildTickStateLockSignalAdapterManifest('DEFAULT');
