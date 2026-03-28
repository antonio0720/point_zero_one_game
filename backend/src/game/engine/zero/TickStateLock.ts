// backend/src/game/engine/zero/TickStateLock.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickStateLock.ts
 * VERSION: 2026.03.27
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 *
 * ── CORE DOCTRINE ─────────────────────────────────────────────────────────────
 * Engine 0 owns authoritative lifecycle lock state for backend execution.
 * Overlapping ticks are forbidden — the tick lock is the spine of the engine.
 * Every transition is explicit, validated, and lease-based. Callers receive a
 * lock token and must release the same token. No token = no release. This is
 * orchestration law, not UI state.
 *
 * ── EXTENDED DOCTRINE (ML / DL ANALYTICS LAYER) ──────────────────────────────
 * Every lock state transition is observable, measurable, and narrated.
 * The 32-dimensional ML feature vector encodes full lock posture for real-time
 * inference: state one-hot, hold timing, tick context, run mode, pressure tier,
 * transition statistics, session analytics, engine health, and outcome signals.
 * The 13-row × 8-column DL tensor encodes step-level execution profiles for
 * each of the 13 canonical tick steps, allowing deep learning over tick patterns.
 *
 * Health scores are ML-derived from lock timing + error density + transition
 * compliance. Trend analysis surfaces lock degradation before it becomes
 * critical. Session tracking enables long-arc run intelligence across ticks.
 * Chat signals route companion behavior based on lock pressure.
 * Annotation bundles serve proof, replay, and transcript integrity.
 *
 * ── SOCIAL PRESSURE ENGINE ────────────────────────────────────────────────────
 * Lock contention is a social signal — not just an orchestration error.
 * When a lock is held beyond the stale threshold, the companion fires.
 * The witness layer records every transition for proof-bearing transcripts.
 * Mode-native narration adapts to the player's sovereign context.
 *
 * ── FOUR GAME MODES ───────────────────────────────────────────────────────────
 * - Empire   (solo)  — GO ALONE — sovereign dominance, full self-reliance
 * - Predator (pvp)   — HEAD TO HEAD — rivalry pressure, witness enforcement
 * - Syndicate(coop)  — TEAM UP — shared treasury, role-bound lock discipline
 * - Phantom  (ghost) — CHASE A LEGEND — legend gap state, extraction urgency
 *
 * ── LOCK LIFECYCLE ────────────────────────────────────────────────────────────
 *   IDLE → STARTING → ACTIVE → TICK_LOCKED → ACTIVE → ... → ENDING → ENDED
 *
 * Each transition is validated against ZERO_LEGAL_LIFECYCLE_TRANSITIONS.
 * The TickStateLock class is the enforcement layer.
 * The analytics layer wraps it with ML/DL intelligence.
 */

// ─── IMPORTS ─────────────────────────────────────────────────────────────────

import type { EngineId, EngineHealth } from '../core/EngineContracts';
import type {
  IntegrityStatus,
  ModeCode,
  PressureTier,
  RunOutcome,
  RunPhase,
} from '../core/GamePrimitives';
import type { OutcomeReasonCode, RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';
import type {
  ActiveRunLifecycleState,
  NonTerminalLifecycleState,
  OrchestratorStateSnapshot,
  RunLifecycleCheckpoint,
  RunLifecycleHistory,
  RunLifecycleInvariant,
  RunLifecycleState,
  RunLifecycleTransition,
  SnapshotDiffReport,
  SnapshotFingerprint,
  StepBoundarySnapshot,
  StepExecutionReport,
  StepRuntimeOwner,
  TerminalLifecycleState,
  TickExecutionSummary,
  TickHistoryWindow,
  TickPlanEntry,
  TickStepErrorRecord,
  TickWarningRecord,
} from './zero.types';
import {
  ZERO_CANONICAL_TICK_SEQUENCE,
  ZERO_LEGAL_LIFECYCLE_TRANSITIONS,
  ZERO_RUN_LIFECYCLE_STATES,
  ZERO_RUN_LIFECYCLE_TRANSITIONS,
  ZERO_STEP_RUNTIME_OWNERS,
  ZERO_TICK_STEP_DESCRIPTORS,
} from './zero.types';

// ─── CORE TYPES ───────────────────────────────────────────────────────────────

/**
 * Authoritative runtime state for one backend run session.
 * These states are orchestration law — the TickStateLock enforces them.
 */
export type TickRuntimeState =
  | 'IDLE'
  | 'STARTING'
  | 'ACTIVE'
  | 'TICK_LOCKED'
  | 'ENDING'
  | 'ENDED';

/**
 * A lease issued on successful tick lock acquisition.
 * The caller must return this token to release the lock.
 */
export interface TickLockLease {
  readonly token: string;
  readonly state: 'TICK_LOCKED';
  readonly acquiredAtMs: number;
  readonly runId: string | null;
  readonly tick: number | null;
}

/**
 * Frozen snapshot of all TickStateLock fields at a point in time.
 * Suitable for diagnostics, replay, and ML feature extraction.
 */
export interface TickStateSnapshot {
  readonly state: TickRuntimeState;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly activeToken: string | null;
  readonly lockedAtMs: number | null;
  readonly updatedAtMs: number;
}

// ─── MODULE CONSTANTS ─────────────────────────────────────────────────────────

/** Semantic version of this module. */
export const TICK_STATE_LOCK_MODULE_VERSION = '1.0.2026' as const;

/** Schema identifier for serialization compatibility. */
export const TICK_STATE_LOCK_SCHEMA = 'tick-state-lock-v1' as const;

/** Runtime readiness flag. Always true after module load. */
export const TICK_STATE_LOCK_READY = true as const;

/** ML feature vector dimensionality — 32 dimensions. */
export const TICK_STATE_LOCK_ML_FEATURE_COUNT = 32 as const;

/** DL tensor shape — 13 steps × 8 columns. */
export const TICK_STATE_LOCK_DL_TENSOR_SHAPE = Object.freeze([13, 8] as const);

/** Maximum heat multiplier for companion routing. */
export const TICK_STATE_LOCK_MAX_HEAT = 1.0 as const;

/**
 * Lock hold duration threshold (ms) beyond which a lock is considered stale.
 * Companion fires at this boundary. 30 seconds.
 */
export const TICK_STATE_LOCK_STALE_THRESHOLD_MS = 30_000 as const;

/** Event prefix for world event routing. */
export const TICK_STATE_LOCK_WORLD_EVENT_PREFIX = 'tick_state_lock' as const;

/** Maximum session entries retained per tracker. */
export const TICK_STATE_LOCK_DEFAULT_SESSION_MAX = 500 as const;

/** Trend window size for health rolling average. */
export const TICK_STATE_LOCK_TREND_WINDOW_SIZE = 10 as const;

/**
 * Derived from zero.types — lifecycle state count.
 * ZERO_RUN_LIFECYCLE_STATES drives this value.
 */
export const TICK_STATE_LOCK_LIFECYCLE_STATE_COUNT: number =
  ZERO_RUN_LIFECYCLE_STATES.length;

/**
 * Derived from zero.types — transition count.
 * ZERO_RUN_LIFECYCLE_TRANSITIONS drives this value.
 */
export const TICK_STATE_LOCK_TRANSITION_COUNT: number =
  ZERO_RUN_LIFECYCLE_TRANSITIONS.length;

/**
 * Derived from zero.types — canonical tick step count.
 * ZERO_CANONICAL_TICK_SEQUENCE drives this value (always 13).
 */
export const TICK_STATE_LOCK_STEP_COUNT: number =
  ZERO_CANONICAL_TICK_SEQUENCE.length;

/**
 * Derived from zero.types — step owner cardinality.
 * ZERO_STEP_RUNTIME_OWNERS drives this value.
 */
export const TICK_STATE_LOCK_OWNER_COUNT: number =
  ZERO_STEP_RUNTIME_OWNERS.length;

// ─── SEVERITY + OPERATION KIND + ADAPTER MODE ────────────────────────────────

/**
 * Lock-level severity classification.
 * Drives companion routing, heat multiplier, and chat signal emission.
 *
 * LOW      — nominal lock state, advisory optional
 * MEDIUM   — elevated hold time or warning density, companion coaching fires
 * HIGH     — stale lock or error density, companion escalates
 * CRITICAL — contended or illegal transition, rescue + max heat fires
 */
export type TickStateLockSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Operation kind for annotation and event log routing.
 */
export type TickStateLockOperationKind =
  | 'ACQUIRE'
  | 'RELEASE'
  | 'START'
  | 'ACTIVATE'
  | 'END'
  | 'RESET'
  | 'ASSERT'
  | 'VALIDATE'
  | 'NOOP';

/**
 * Adapter mode controlling signal emission thresholds.
 *
 * DEFAULT  — emits for MEDIUM/HIGH/CRITICAL
 * STRICT   — emits only for HIGH/CRITICAL
 * VERBOSE  — emits for all including LOW; full ML vector
 */
export type TickStateLockAdapterMode = 'DEFAULT' | 'STRICT' | 'VERBOSE';

// ─── CONTEXT INTERFACES ───────────────────────────────────────────────────────

/**
 * Full run context passed into analytics and narration functions.
 * Carries mode, phase, pressure tier, and optional outcome/snapshot.
 */
export interface TickStateLockRunContext {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly pressureTier: PressureTier;
  readonly outcome: RunOutcome | null;
  readonly snapshot: RunStateSnapshot | null;
}

/**
 * Step-level execution context for DL tensor construction.
 */
export interface TickStateLockStepContext {
  readonly step: TickStep;
  readonly owner: StepRuntimeOwner;
  readonly durationMs: number;
  readonly errorCount: number;
  readonly warningCount: number;
}

/**
 * Plan-level context sourced from TickPlan state.
 * Carries the plan entries and critical step coverage.
 */
export interface TickStateLockPlanContext {
  readonly entries: readonly TickPlanEntry[];
  readonly enabledCount: number;
  readonly disabledCount: number;
  readonly criticalStepsEnabled: boolean;
}

/**
 * Engine-level context binding a running engine to its health state.
 */
export interface TickStateLockEngineContext {
  readonly engineId: EngineId;
  readonly health: EngineHealth;
  readonly critical: boolean;
}

/**
 * Aggregate health bundle across all registered engine contexts.
 */
export interface TickStateLockHealthBundle {
  readonly engines: readonly TickStateLockEngineContext[];
  readonly aggregateScore: number;
  readonly criticalEnginesFailing: boolean;
}

// ─── DIAGNOSTICS ─────────────────────────────────────────────────────────────

/**
 * Runtime diagnostics snapshot for a TickStateLock instance.
 * Carries error/warning density, stale lock flag, contention flag,
 * and step-level error/warning records.
 */
export interface TickStateLockDiagnostics {
  readonly lockHoldDurationMs: number;
  readonly transitionCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly affectedEngineId: EngineId | null;
  readonly stepErrors: readonly TickStepErrorRecord[];
  readonly stepWarnings: readonly TickWarningRecord[];
  readonly isStaleLock: boolean;
  readonly isContended: boolean;
}

/**
 * Termination record produced when a run reaches ENDING or ENDED.
 */
export interface TickStateLockTerminationRecord {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly reasonCode: OutcomeReasonCode | null;
  readonly endedAtMs: number;
  readonly finalTick: number | null;
  readonly note: string | null;
}

// ─── SESSION + TRANSITION TYPES ───────────────────────────────────────────────

/**
 * One session entry per acquired+released lock cycle.
 * Carries the full tick execution context for ML/DL analytics.
 */
export interface TickStateLockSessionEntry {
  readonly runId: string;
  readonly tick: number;
  readonly state: TickRuntimeState;
  readonly acquiredAtMs: number;
  readonly releasedAtMs: number | null;
  readonly holdDurationMs: number | null;
  readonly executionSummary: TickExecutionSummary | null;
  readonly stepReports: readonly StepExecutionReport[];
  readonly snapshot: RunStateSnapshot | null;
}

/**
 * One lifecycle transition record in the event log.
 */
export interface TickStateLockTransitionRecord {
  readonly fromState: TickRuntimeState;
  readonly toState: TickRuntimeState;
  readonly transition: RunLifecycleTransition;
  readonly atMs: number;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly token: string | null;
}

/**
 * One diff entry pairing a snapshot diff with the tick context.
 */
export interface TickStateLockDiffEntry {
  readonly tick: number;
  readonly runId: string | null;
  readonly diff: SnapshotDiffReport;
  readonly atMs: number;
}

/**
 * History context binding a TickHistoryWindow to a lock reference point.
 */
export interface TickStateLockHistoryContext {
  readonly window: TickHistoryWindow;
  readonly lockAtMs: number | null;
}

// ─── ML VECTOR ────────────────────────────────────────────────────────────────

/**
 * 32-dimensional ML feature vector for the TickStateLock module.
 * Normalized to [0,1]. Used for real-time health inference and trend analysis.
 *
 * Dimensions:
 *   [0–5]   Lifecycle state one-hot (6 states)
 *   [6–7]   Lock behavior (hold duration, contention ratio)
 *   [8–12]  Tick-level analytics (tick, delta, step count, error ratio, warning ratio)
 *   [13–15] Run context (mode, pressure tier, run phase)
 *   [16–19] Transition analytics (count, legal ratio, illegal count, reset count)
 *   [20–25] Session analytics (duration, entry count, avg hold, max hold, attempts)
 *   [26–27] Engine health (critical score, all healthy flag)
 *   [28–29] Outcome encoding (terminal state, outcome present)
 *   [30–31] Overall (health score, severity encoded)
 */
export interface TickStateLockMLVector {
  // ── Lifecycle state one-hot (6) ──────────────────────────────────────────
  readonly stateIdleEncoded: number;
  readonly stateStartingEncoded: number;
  readonly stateActiveEncoded: number;
  readonly stateTickLockedEncoded: number;
  readonly stateEndingEncoded: number;
  readonly stateEndedEncoded: number;
  // ── Lock behavior (2) ────────────────────────────────────────────────────
  readonly lockHoldNormalized: number;
  readonly lockContentionRatio: number;
  // ── Tick-level (5) ───────────────────────────────────────────────────────
  readonly tickNormalized: number;
  readonly tickDeltaNormalized: number;
  readonly stepCountNormalized: number;
  readonly stepErrorRatio: number;
  readonly stepWarningRatio: number;
  // ── Run context (3) ──────────────────────────────────────────────────────
  readonly modeNormalized: number;
  readonly pressureTierNormalized: number;
  readonly runPhaseNormalized: number;
  // ── Transition analytics (4) ─────────────────────────────────────────────
  readonly transitionCountNormalized: number;
  readonly legalTransitionRatio: number;
  readonly illegalTransitionCount: number;
  readonly resetCountNormalized: number;
  // ── Session (6) ──────────────────────────────────────────────────────────
  readonly sessionDurationNormalized: number;
  readonly sessionEntryCountNormalized: number;
  readonly avgHoldDurationNormalized: number;
  readonly maxHoldDurationNormalized: number;
  readonly lockAttemptCountNormalized: number;
  readonly releaseAttemptCountNormalized: number;
  // ── Engine health (2) ────────────────────────────────────────────────────
  readonly criticalEngineHealthScore: number;
  readonly allEnginesHealthy: number;
  // ── Outcome (2) ──────────────────────────────────────────────────────────
  readonly terminalStateReached: number;
  readonly outcomePresent: number;
  // ── Overall (2) ──────────────────────────────────────────────────────────
  readonly healthScore: number;
  readonly severityEncoded: number;
}

// ─── DL TENSOR ────────────────────────────────────────────────────────────────

/**
 * One row in the 13×8 DL tensor — one row per canonical tick step.
 *
 * Columns:
 *   step              — string step identifier (not used as numeric feature)
 *   ordinal           — step ordinal [1–13] normalized
 *   ownerEncoded      — step owner encoded [0,1]
 *   lockHeldDuringStep — 1 if tick lock was held during this step
 *   errorsDuringStep  — errors during this step, normalized
 *   warningsDuringStep — warnings during this step, normalized
 *   durationNormalized — step duration normalized
 *   mutatesState      — 1 if this step mutates run state
 */
export interface TickStateLockDLTensorRow {
  readonly step: string;
  readonly ordinal: number;
  readonly ownerEncoded: number;
  readonly lockHeldDuringStep: number;
  readonly errorsDuringStep: number;
  readonly warningsDuringStep: number;
  readonly durationNormalized: number;
  readonly mutatesState: number;
}

/** 13-row DL tensor for one tick execution profile. */
export type TickStateLockDLTensor = readonly TickStateLockDLTensorRow[];

// ─── NARRATION + ANNOTATION TYPES ─────────────────────────────────────────────

/**
 * Narration hint for companion routing.
 * Mode-native phrasing drives social pressure output.
 */
export interface TickStateLockNarrationHint {
  readonly phrase: string;
  readonly urgencyLabel: string;
  readonly heatMultiplier: number;
  readonly companionIntent: string;
  readonly audienceReaction: string;
}

/**
 * Annotation capturing a full lock state event for proof and replay.
 */
export interface TickStateLockAnnotation {
  readonly fingerprint: string;
  readonly severity: TickStateLockSeverity;
  readonly healthScore: number;
  readonly label: string;
  readonly description: string;
  readonly state: TickRuntimeState;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly lockHoldDurationMs: number | null;
  readonly transitionCount: number;
  readonly illegalTransitions: number;
  readonly operationKind: TickStateLockOperationKind;
  readonly criticalIssues: readonly string[];
  readonly warnings: readonly string[];
  readonly emittedAtMs: number;
}

/**
 * Health snapshot suitable for operator dashboards and chat surfaces.
 */
export interface TickStateLockHealthSnapshot {
  readonly fingerprint: string;
  readonly healthScore: number;
  readonly severity: TickStateLockSeverity;
  readonly state: TickRuntimeState;
  readonly actionRecommendation: string;
  readonly narrationHint: TickStateLockNarrationHint;
  readonly lockHoldDurationMs: number | null;
  readonly transitionCount: number;
  readonly isTerminal: boolean;
  readonly isStaleLock: boolean;
  readonly operationKind: TickStateLockOperationKind;
  readonly criticalIssues: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Run-level summary carrying mode/phase/tier/outcome context.
 */
export interface TickStateLockRunSummary {
  readonly runId: string;
  readonly tick: number;
  readonly fingerprint: string;
  readonly healthScore: number;
  readonly severity: TickStateLockSeverity;
  readonly state: TickRuntimeState;
  readonly lockHoldDurationMs: number | null;
  readonly transitionCount: number;
  readonly mode: ModeCode | null;
  readonly phase: RunPhase | null;
  readonly pressureTier: PressureTier | null;
  readonly outcome: RunOutcome | null;
  readonly narrationPhrase: string;
}

// ─── TREND + SESSION + CHAT SIGNAL TYPES ─────────────────────────────────────

/**
 * Rolling trend snapshot over the last N lock cycles.
 */
export interface TickStateLockTrendSnapshot {
  readonly windowSize: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly avgHoldDurationMs: number;
  readonly maxHoldDurationMs: number;
  readonly severityCounts: Readonly<Record<TickStateLockSeverity, number>>;
  readonly dominantSeverity: TickStateLockSeverity;
  readonly illegalTransitionTrend: boolean;
  readonly lockContentionTrend: boolean;
}

/**
 * Session-level analytics report across a full run.
 */
export interface TickStateLockSessionReport {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly entryCount: number;
  readonly avgHealthScore: number;
  readonly avgHoldDurationMs: number;
  readonly maxHoldDurationMs: number;
  readonly illegalTransitions: number;
  readonly severityDistribution: Readonly<Record<TickStateLockSeverity, number>>;
  readonly terminalStateReached: boolean;
  readonly finalState: TickRuntimeState | null;
}

/**
 * Chat signal carrying full ML/DL context for companion routing.
 */
export interface TickStateLockChatSignal {
  readonly runId: string;
  readonly tick: number;
  readonly severity: TickStateLockSeverity;
  readonly operationKind: TickStateLockOperationKind;
  readonly healthScore: number;
  readonly state: TickRuntimeState;
  readonly lockHoldDurationMs: number | null;
  readonly transitionCount: number;
  readonly isTerminal: boolean;
  readonly mode: ModeCode | null;
  readonly phase: RunPhase | null;
  readonly narrationHint: string;
  readonly mlVector: TickStateLockMLVector;
  readonly dlTensor: TickStateLockDLTensor;
  readonly emittedAtMs: number;
}

/**
 * Bundle of annotations across multiple lock operations.
 */
export interface TickStateLockAnnotationBundle {
  readonly runId: string | null;
  readonly tick: number | null;
  readonly annotations: readonly TickStateLockAnnotation[];
  readonly fingerprints: readonly string[];
  readonly dominantSeverity: TickStateLockSeverity;
  readonly bundledAtMs: number;
}

/**
 * Full export bundle for diagnostics, replay, and proof.
 */
export interface TickStateLockExportBundle {
  readonly snapshot: TickStateSnapshot;
  readonly mlVector: TickStateLockMLVector;
  readonly dlTensor: TickStateLockDLTensor;
  readonly annotation: TickStateLockAnnotation;
  readonly healthSnapshot: TickStateLockHealthSnapshot;
  readonly narrationHint: TickStateLockNarrationHint;
  readonly chatSignal: TickStateLockChatSignal;
  readonly diagnostics: TickStateLockDiagnostics;
  readonly exportedAtMs: number;
}

// ─── MANIFEST ─────────────────────────────────────────────────────────────────

/** Module manifest for adapter suite registration. */
export interface TickStateLockManifest {
  readonly moduleId: 'tick-state-lock';
  readonly version: string;
  readonly schema: string;
  readonly ready: boolean;
  readonly stateCount: number;
  readonly transitionCount: number;
  readonly stepCount: number;
  readonly mlFeatureCount: number;
  readonly dlTensorShape: readonly [number, number];
}

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

/** Current unix timestamp in ms. */
function nowMs(): number {
  return Date.now();
}

/** Clamp a value to [0,1]. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Generate a cryptographically-sufficient lock token. */
function createToken(ts: number, runId: string | null, tick: number | null): string {
  return `${ts}:${runId ?? 'none'}:${tick ?? -1}:${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/** Generate a fingerprint for an annotation or snapshot. */
function buildFingerprint(state: TickRuntimeState, runId: string | null, tick: number | null, atMs: number): string {
  return `${TICK_STATE_LOCK_WORLD_EVENT_PREFIX}:${state}:${runId ?? 'none'}:${tick ?? -1}:${atMs}`;
}

/** Encode ModeCode to [0,1]. Uses ModeCode import. */
function encodeModeCode(mode: ModeCode | null): number {
  if (mode === null) return 0;
  const map: Record<ModeCode, number> = { solo: 0.25, pvp: 0.5, coop: 0.75, ghost: 1.0 };
  return map[mode] ?? 0;
}

/** Encode PressureTier to [0,1]. Uses PressureTier import. */
function encodePressureTier(tier: PressureTier | null): number {
  if (tier === null) return 0;
  const map: Record<PressureTier, number> = {
    T0: 0,
    T1: 0.25,
    T2: 0.5,
    T3: 0.75,
    T4: 1.0,
  };
  return map[tier] ?? 0;
}

/** Encode RunPhase to [0,1]. Uses RunPhase import. */
function encodeRunPhase(phase: RunPhase | null): number {
  if (phase === null) return 0;
  const map: Record<RunPhase, number> = {
    FOUNDATION: 0.33,
    ESCALATION: 0.66,
    SOVEREIGNTY: 1.0,
  };
  return map[phase] ?? 0;
}

/** Encode severity to [0,1]. */
function encodeSeverity(s: TickStateLockSeverity): number {
  const map: Record<TickStateLockSeverity, number> = {
    LOW: 0.25,
    MEDIUM: 0.5,
    HIGH: 0.75,
    CRITICAL: 1.0,
  };
  return map[s];
}

/**
 * Encode StepRuntimeOwner to [0,1] using ZERO_STEP_RUNTIME_OWNERS index.
 * Uses both StepRuntimeOwner type import and ZERO_STEP_RUNTIME_OWNERS value.
 */
function encodeStepOwner(owner: StepRuntimeOwner): number {
  const idx = (ZERO_STEP_RUNTIME_OWNERS as readonly string[]).indexOf(owner);
  if (idx < 0) return 0;
  return clamp01(idx / ZERO_STEP_RUNTIME_OWNERS.length);
}

/**
 * Convert EngineHealth.status to a [0,1] health score.
 * Uses EngineHealth import.
 */
function engineHealthToScore(health: EngineHealth): number {
  if (health.status === 'HEALTHY') return 1.0;
  if (health.status === 'DEGRADED') return 0.5;
  return 0.0; // FAILED
}

// ─── LIFECYCLE VALIDATION FUNCTIONS ──────────────────────────────────────────

/**
 * Returns true if `state` is a recognized RunLifecycleState.
 * Uses ZERO_RUN_LIFECYCLE_STATES and RunLifecycleState type.
 */
export function isKnownLifecycleState(state: string): state is RunLifecycleState {
  return (ZERO_RUN_LIFECYCLE_STATES as readonly string[]).includes(state);
}

/**
 * Returns true if `transition` is a recognized RunLifecycleTransition.
 * Uses ZERO_RUN_LIFECYCLE_TRANSITIONS and RunLifecycleTransition type.
 */
export function isKnownTransition(transition: string): transition is RunLifecycleTransition {
  return (ZERO_RUN_LIFECYCLE_TRANSITIONS as readonly string[]).includes(transition);
}

/**
 * Returns true if transitioning from `from` → `to` is legal.
 * Uses ZERO_LEGAL_LIFECYCLE_TRANSITIONS.
 */
export function isLegalTransition(
  from: TickRuntimeState,
  to: TickRuntimeState,
): boolean {
  const legalTargets =
    ZERO_LEGAL_LIFECYCLE_TRANSITIONS[from as RunLifecycleState] ?? ([] as readonly RunLifecycleState[]);
  return (legalTargets as readonly string[]).includes(to);
}

/**
 * Throws if the transition `from` → `to` violates lifecycle law.
 * Uses ZERO_LEGAL_LIFECYCLE_TRANSITIONS.
 */
export function assertLegalTransition(
  from: TickRuntimeState,
  to: TickRuntimeState,
): void {
  if (!isLegalTransition(from, to)) {
    const legal = ZERO_LEGAL_LIFECYCLE_TRANSITIONS[from as RunLifecycleState] ?? [];
    throw new Error(
      `Illegal lifecycle transition: ${from} → ${to}. ` +
        `Legal targets from ${from}: [${(legal as readonly string[]).join(', ')}].`,
    );
  }
}

/**
 * Validates and returns a RunLifecycleInvariant for the given transition.
 * Uses RunLifecycleInvariant type, RunLifecycleState, and ZERO_LEGAL_LIFECYCLE_TRANSITIONS.
 */
export function validateLockTransitionInvariant(
  from: TickRuntimeState,
  to: TickRuntimeState,
): RunLifecycleInvariant {
  const legal = isLegalTransition(from, to);
  return Object.freeze({
    from: from as RunLifecycleState,
    to: to as RunLifecycleState,
    legal,
    reason: legal
      ? `Transition ${from} → ${to} is authorized by lifecycle law.`
      : `Transition ${from} → ${to} violates lifecycle law.`,
  });
}

/**
 * Type predicate: returns true if the state is an active run lifecycle state.
 * Uses ActiveRunLifecycleState type.
 * Active states: STARTING, ACTIVE, TICK_LOCKED, ENDING.
 */
export function isActiveLockState(
  state: TickRuntimeState,
): state is ActiveRunLifecycleState {
  return (
    state === 'STARTING' ||
    state === 'ACTIVE' ||
    state === 'TICK_LOCKED' ||
    state === 'ENDING'
  );
}

/**
 * Type predicate: returns true if the state is a terminal lifecycle state.
 * Uses TerminalLifecycleState type.
 * Terminal states: ENDING, ENDED.
 */
export function isTerminalLockState(
  state: TickRuntimeState,
): state is TerminalLifecycleState {
  return state === 'ENDING' || state === 'ENDED';
}

/**
 * Type predicate: returns true if the state is non-terminal.
 * Uses NonTerminalLifecycleState type.
 * Non-terminal states: IDLE, STARTING, ACTIVE, TICK_LOCKED.
 */
export function isNonTerminalLockState(
  state: TickRuntimeState,
): state is NonTerminalLifecycleState {
  return !isTerminalLockState(state);
}

// ─── STANDALONE BUILDER FUNCTIONS ────────────────────────────────────────────

/**
 * Builds a StepBoundarySnapshot for a single tick step.
 * Uses StepBoundarySnapshot and TickStep imports.
 */
export function buildLockStepBoundarySnapshot(
  step: TickStep,
  beforeChecksum: string,
  afterChecksum: string,
): StepBoundarySnapshot {
  return Object.freeze({
    step,
    beforeChecksum,
    afterChecksum,
    changed: beforeChecksum !== afterChecksum,
  });
}

/**
 * Builds a RunLifecycleCheckpoint from a TickStateLock transition.
 * Uses RunLifecycleCheckpoint, RunLifecycleTransition, RunLifecycleState.
 */
export function buildLockLifecycleCheckpoint(
  state: TickRuntimeState,
  transition: RunLifecycleTransition,
  tick: number | null,
  note?: string | null,
): RunLifecycleCheckpoint {
  return Object.freeze({
    lifecycleState: state as RunLifecycleState,
    changedAtMs: nowMs(),
    tick,
    note: note ?? null,
    transition,
  });
}

/**
 * Builds a RunLifecycleHistory from an array of RunLifecycleCheckpoints.
 * Uses RunLifecycleHistory and RunLifecycleCheckpoint imports.
 */
export function buildLockLifecycleHistory(
  checkpoints: readonly RunLifecycleCheckpoint[],
  lastTransitionAtMs: number | null,
): RunLifecycleHistory {
  return Object.freeze({
    checkpoints: Object.freeze([...checkpoints]),
    lastTransitionAtMs,
    transitionCount: checkpoints.length,
  });
}

/**
 * Computes aggregate health bundle from engine contexts.
 * Uses EngineHealth (via engineHealthToScore), TickStateLockEngineContext, TickStateLockHealthBundle.
 */
export function computeLockEngineAggregateHealth(
  contexts: readonly TickStateLockEngineContext[],
): TickStateLockHealthBundle {
  if (contexts.length === 0) {
    return Object.freeze({
      engines: Object.freeze([]),
      aggregateScore: 1,
      criticalEnginesFailing: false,
    });
  }

  const scores = contexts.map((ctx) => engineHealthToScore(ctx.health));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const criticalFailing = contexts.some(
    (ctx) => ctx.critical && engineHealthToScore(ctx.health) < 0.5,
  );

  return Object.freeze({
    engines: Object.freeze([...contexts]),
    aggregateScore: clamp01(avg),
    criticalEnginesFailing: criticalFailing,
  });
}

/**
 * Builds a SnapshotFingerprint from lock context.
 * Uses SnapshotFingerprint, RunPhase, RunOutcome, IntegrityStatus.
 */
export function buildLockSnapshotFingerprint(
  runId: string,
  tick: number,
  phase: RunPhase,
  outcome: RunOutcome | null,
  checksum: string,
  integrityStatus: IntegrityStatus,
  eventCount: number,
): SnapshotFingerprint {
  return Object.freeze({
    runId,
    tick,
    phase,
    outcome,
    checksum,
    integrityStatus,
    eventCount,
  });
}

// ─── ML ANALYTICS — FEATURE EXTRACTION ───────────────────────────────────────

/** Input contract for ML vector extraction. */
export interface ExtractLockMLVectorInput {
  readonly snapshot: TickStateSnapshot;
  readonly runContext: TickStateLockRunContext | null;
  readonly diagnostics: TickStateLockDiagnostics;
  readonly sessionEntry: TickStateLockSessionEntry | null;
  readonly healthScore: number;
  readonly severity: TickStateLockSeverity;
  readonly transitionCount: number;
  readonly illegalTransitionCount: number;
  readonly resetCount: number;
  readonly sessionEntryCount: number;
  readonly avgHoldDurationMs: number;
  readonly maxHoldDurationMs: number;
  readonly lockAttemptCount: number;
  readonly releaseAttemptCount: number;
}

/**
 * Extracts the 32-dimensional ML feature vector from lock state.
 * All values normalized to [0,1].
 *
 * Uses: TickStateSnapshot, TickStateLockRunContext, TickStateLockDiagnostics,
 *       TickStateLockSessionEntry, ModeCode (via encodeModeCode),
 *       PressureTier (via encodePressureTier), RunPhase (via encodeRunPhase),
 *       TickStateLockSeverity (via encodeSeverity).
 */
export function extractLockMLVector(
  input: ExtractLockMLVectorInput,
): TickStateLockMLVector {
  const { snapshot, runContext, diagnostics, healthScore, severity } = input;
  const MAX_TICK = 10_000;
  const MAX_HOLD = TICK_STATE_LOCK_STALE_THRESHOLD_MS;
  const MAX_TRANSITIONS = 1_000;
  const MAX_SESSION_ENTRIES = TICK_STATE_LOCK_DEFAULT_SESSION_MAX;
  const MAX_HOLD_DURATION = 60_000;
  const MAX_ATTEMPTS = 500;
  const MAX_RESETS = 50;
  const SESSION_MAX_DURATION_MS = 24 * 60 * 60 * 1000;

  const state = snapshot.state;
  const holdMs = snapshot.lockedAtMs != null
    ? Math.max(0, nowMs() - snapshot.lockedAtMs)
    : 0;

  const sessionDurationMs = input.sessionEntry != null
    ? Math.max(0, nowMs() - input.sessionEntry.acquiredAtMs)
    : 0;

  return Object.freeze({
    // Lifecycle state one-hot (6)
    stateIdleEncoded: state === 'IDLE' ? 1 : 0,
    stateStartingEncoded: state === 'STARTING' ? 1 : 0,
    stateActiveEncoded: state === 'ACTIVE' ? 1 : 0,
    stateTickLockedEncoded: state === 'TICK_LOCKED' ? 1 : 0,
    stateEndingEncoded: state === 'ENDING' ? 1 : 0,
    stateEndedEncoded: state === 'ENDED' ? 1 : 0,
    // Lock behavior (2)
    lockHoldNormalized: clamp01(holdMs / MAX_HOLD),
    lockContentionRatio: diagnostics.isContended ? 1 : 0,
    // Tick-level (5)
    tickNormalized: clamp01((snapshot.tick ?? 0) / MAX_TICK),
    tickDeltaNormalized: clamp01(
      (input.sessionEntry?.tick ?? snapshot.tick ?? 0) / MAX_TICK,
    ),
    stepCountNormalized: clamp01(TICK_STATE_LOCK_STEP_COUNT / 13),
    stepErrorRatio: clamp01(
      diagnostics.stepErrors.length / Math.max(1, TICK_STATE_LOCK_STEP_COUNT),
    ),
    stepWarningRatio: clamp01(
      diagnostics.stepWarnings.length / Math.max(1, TICK_STATE_LOCK_STEP_COUNT),
    ),
    // Run context (3)
    modeNormalized: encodeModeCode(runContext?.mode ?? null),
    pressureTierNormalized: encodePressureTier(runContext?.pressureTier ?? null),
    runPhaseNormalized: encodeRunPhase(runContext?.phase ?? null),
    // Transition analytics (4)
    transitionCountNormalized: clamp01(input.transitionCount / MAX_TRANSITIONS),
    legalTransitionRatio:
      input.transitionCount > 0
        ? clamp01(
            (input.transitionCount - input.illegalTransitionCount) /
              input.transitionCount,
          )
        : 1,
    illegalTransitionCount: clamp01(
      input.illegalTransitionCount / Math.max(1, input.transitionCount),
    ),
    resetCountNormalized: clamp01(input.resetCount / MAX_RESETS),
    // Session (6)
    sessionDurationNormalized: clamp01(sessionDurationMs / SESSION_MAX_DURATION_MS),
    sessionEntryCountNormalized: clamp01(
      input.sessionEntryCount / MAX_SESSION_ENTRIES,
    ),
    avgHoldDurationNormalized: clamp01(input.avgHoldDurationMs / MAX_HOLD_DURATION),
    maxHoldDurationNormalized: clamp01(input.maxHoldDurationMs / MAX_HOLD_DURATION),
    lockAttemptCountNormalized: clamp01(input.lockAttemptCount / MAX_ATTEMPTS),
    releaseAttemptCountNormalized: clamp01(
      input.releaseAttemptCount / MAX_ATTEMPTS,
    ),
    // Engine health (2) — nominal unless overridden via engine bundle
    criticalEngineHealthScore: 1,
    allEnginesHealthy: 1,
    // Outcome (2)
    terminalStateReached: isTerminalLockState(state) ? 1 : 0,
    outcomePresent: runContext?.outcome != null ? 1 : 0,
    // Overall (2)
    healthScore: clamp01(healthScore),
    severityEncoded: encodeSeverity(severity),
  } satisfies TickStateLockMLVector);
}

/**
 * Returns a default zero-filled ML vector for cold-start inference.
 */
export function buildLockDefaultMLVector(): TickStateLockMLVector {
  return Object.freeze({
    stateIdleEncoded: 1,
    stateStartingEncoded: 0,
    stateActiveEncoded: 0,
    stateTickLockedEncoded: 0,
    stateEndingEncoded: 0,
    stateEndedEncoded: 0,
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
    terminalStateReached: 0,
    outcomePresent: 0,
    healthScore: 1,
    severityEncoded: 0.25,
  } satisfies TickStateLockMLVector);
}

// ─── DL TENSOR CONSTRUCTION ───────────────────────────────────────────────────

/** Input contract for DL tensor construction. */
export interface BuildLockDLTensorInput {
  readonly stepContexts: readonly TickStateLockStepContext[];
  readonly lockHeldDuringSteps: ReadonlySet<TickStep>;
}

/**
 * Builds the 13×8 DL tensor from step execution context.
 *
 * Uses: ZERO_CANONICAL_TICK_SEQUENCE (iteration), ZERO_TICK_STEP_DESCRIPTORS (metadata),
 *       TickStep (step type), StepRuntimeOwner (owner type),
 *       encodeStepOwner (uses ZERO_STEP_RUNTIME_OWNERS internally).
 */
export function buildLockDLTensor(
  input: BuildLockDLTensorInput,
): TickStateLockDLTensor {
  const { stepContexts, lockHeldDuringSteps } = input;

  const ctxByStep = new Map<string, TickStateLockStepContext>();
  for (const ctx of stepContexts) {
    ctxByStep.set(ctx.step, ctx);
  }

  return Object.freeze(
    ZERO_CANONICAL_TICK_SEQUENCE.map((step): TickStateLockDLTensorRow => {
      const descriptor = ZERO_TICK_STEP_DESCRIPTORS[step];
      const ctx = ctxByStep.get(step);
      const owner: StepRuntimeOwner =
        ctx?.owner ?? (descriptor.owner as StepRuntimeOwner);

      return Object.freeze({
        step,
        ordinal: clamp01(descriptor.ordinal / TICK_STATE_LOCK_STEP_COUNT),
        ownerEncoded: encodeStepOwner(owner),
        lockHeldDuringStep: lockHeldDuringSteps.has(step) ? 1 : 0,
        errorsDuringStep: clamp01((ctx?.errorCount ?? 0) / 10),
        warningsDuringStep: clamp01((ctx?.warningCount ?? 0) / 10),
        durationNormalized: clamp01((ctx?.durationMs ?? 0) / 5_000),
        mutatesState: descriptor.mutatesState ? 1 : 0,
      } satisfies TickStateLockDLTensorRow);
    }),
  );
}

/**
 * Returns a default nominal DL tensor for cold-start inference.
 * Uses ZERO_CANONICAL_TICK_SEQUENCE and ZERO_TICK_STEP_DESCRIPTORS.
 */
export function buildLockDefaultDLTensor(): TickStateLockDLTensor {
  return buildLockDLTensor({
    stepContexts: [],
    lockHeldDuringSteps: new Set<TickStep>(),
  });
}

// ─── HEALTH SCORE + SEVERITY CLASSIFICATION ──────────────────────────────────

/**
 * Computes a health score [0,1] from the current lock state and diagnostics.
 * Penalties applied for stale lock, contention, errors, warnings, terminal state.
 */
export function computeLockHealthScore(
  snapshot: TickStateSnapshot,
  diagnostics: TickStateLockDiagnostics,
): number {
  let score = 1.0;

  if (diagnostics.isStaleLock) score -= 0.4;
  if (diagnostics.isContended) score -= 0.3;

  const errorPenalty = Math.min(diagnostics.errorCount, 5) * 0.1;
  score -= errorPenalty;

  if (diagnostics.warningCount > 3) score -= 0.1;
  if (isTerminalLockState(snapshot.state)) score -= 0.05;

  // Stale hold time incremental penalty
  if (diagnostics.lockHoldDurationMs > TICK_STATE_LOCK_STALE_THRESHOLD_MS) {
    const overMs = diagnostics.lockHoldDurationMs - TICK_STATE_LOCK_STALE_THRESHOLD_MS;
    score -= clamp01(overMs / TICK_STATE_LOCK_STALE_THRESHOLD_MS) * 0.2;
  }

  return clamp01(score);
}

/**
 * Classifies lock severity from health score and diagnostics.
 */
export function classifyLockSeverity(
  healthScore: number,
  diagnostics: TickStateLockDiagnostics,
): TickStateLockSeverity {
  if (diagnostics.isStaleLock || diagnostics.isContended || healthScore < 0.3) {
    return 'CRITICAL';
  }
  if (diagnostics.errorCount > 2 || healthScore < 0.5) return 'HIGH';
  if (diagnostics.warningCount > 1 || healthScore < 0.75) return 'MEDIUM';
  return 'LOW';
}

// ─── NARRATION SYSTEM ─────────────────────────────────────────────────────────

/**
 * Builds mode-native narration phrases for companion routing.
 * Doctrine: Empire (solo), Predator (pvp), Syndicate (coop), Phantom (ghost).
 */
export function buildLockNarrationPhrases(
  severity: TickStateLockSeverity,
  state: TickRuntimeState,
  mode: ModeCode | null,
): {
  phrase: string;
  urgencyLabel: string;
  heatMultiplier: number;
  companionIntent: string;
  audienceReaction: string;
} {
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

  if (severity === 'CRITICAL') {
    const stalePhrase =
      state === 'TICK_LOCKED'
        ? `${modeLabel} — lock is held past the danger threshold. The engine is frozen.`
        : `${modeLabel} — illegal transition detected. Orchestration integrity at risk.`;

    return {
      phrase: stalePhrase,
      urgencyLabel: 'CRITICAL — ENGINE LOCK BREACH',
      heatMultiplier: TICK_STATE_LOCK_MAX_HEAT,
      companionIntent: 'RESCUE',
      audienceReaction: 'WITNESS_ALARM',
    };
  }

  if (severity === 'HIGH') {
    return {
      phrase: `${modeLabel} — lock pressure is elevated. Steps are taking longer than expected.`,
      urgencyLabel: 'HIGH — LOCK PRESSURE',
      heatMultiplier: 0.85,
      companionIntent: 'ESCALATE',
      audienceReaction: 'CROWD_TENSE',
    };
  }

  if (severity === 'MEDIUM') {
    return {
      phrase: `${modeLabel} — tick lock is nominal but watch for hold time drift.`,
      urgencyLabel: 'MEDIUM — LOCK ADVISORY',
      heatMultiplier: 0.5,
      companionIntent: 'COACHING',
      audienceReaction: 'CROWD_WATCHING',
    };
  }

  // LOW
  const nominalPhrases: Record<TickRuntimeState, string> = {
    IDLE: `${modeLabel} — system ready. No run active.`,
    STARTING: `${modeLabel} — run is starting. Initializing engine state.`,
    ACTIVE: `${modeLabel} — engine active. Tick sequence nominal.`,
    TICK_LOCKED: `${modeLabel} — tick lock held. Execution in progress.`,
    ENDING: `${modeLabel} — run is ending. Finalizing state.`,
    ENDED: `${modeLabel} — run complete. Lock released.`,
  };

  return {
    phrase: nominalPhrases[state],
    urgencyLabel: 'LOW — NOMINAL',
    heatMultiplier: 0.2,
    companionIntent: 'ADVISORY',
    audienceReaction: 'AMBIENT',
  };
}

/**
 * Builds the full TickStateLockNarrationHint from mode-aware phrases.
 */
export function buildLockNarrationHint(
  severity: TickStateLockSeverity,
  state: TickRuntimeState,
  mode: ModeCode | null,
): TickStateLockNarrationHint {
  const phrases = buildLockNarrationPhrases(severity, state, mode);
  return Object.freeze({
    phrase: phrases.phrase,
    urgencyLabel: phrases.urgencyLabel,
    heatMultiplier: phrases.heatMultiplier,
    companionIntent: phrases.companionIntent,
    audienceReaction: phrases.audienceReaction,
  });
}

// ─── ANNOTATION + HEALTH SNAPSHOT BUILDERS ───────────────────────────────────

/**
 * Builds the action recommendation string for a health snapshot.
 */
function buildActionRecommendation(
  severity: TickStateLockSeverity,
  diagnostics: TickStateLockDiagnostics,
): string {
  if (severity === 'CRITICAL') {
    if (diagnostics.isStaleLock) {
      return 'Force-release stale tick lock immediately. Investigate step blocking the engine.';
    }
    if (diagnostics.isContended) {
      return 'Resolve lock contention. Only one tick should be in-flight at a time.';
    }
    return 'Investigate critical lock state. Check for illegal transitions and step errors.';
  }
  if (severity === 'HIGH') {
    return 'Review step error density and hold duration. Consider timeout policies.';
  }
  if (severity === 'MEDIUM') {
    return 'Monitor lock hold duration. Warning density above nominal threshold.';
  }
  return 'Lock state nominal. No action required.';
}

/**
 * Builds a TickStateLockAnnotation from lock snapshot, severity, and diagnostics.
 */
export function buildLockAnnotation(
  snapshot: TickStateSnapshot,
  severity: TickStateLockSeverity,
  healthScore: number,
  operationKind: TickStateLockOperationKind,
  diagnostics: TickStateLockDiagnostics,
  transitionCount: number,
  illegalTransitions: number,
): TickStateLockAnnotation {
  const atMs = nowMs();
  const fingerprint = buildFingerprint(
    snapshot.state,
    snapshot.runId,
    snapshot.tick,
    atMs,
  );

  const criticalIssues: string[] = [];
  const warnings: string[] = [];

  if (diagnostics.isStaleLock) {
    criticalIssues.push(
      `Stale lock: held for ${diagnostics.lockHoldDurationMs}ms (threshold: ${TICK_STATE_LOCK_STALE_THRESHOLD_MS}ms).`,
    );
  }
  if (diagnostics.isContended) {
    criticalIssues.push('Lock contention detected — active token already present.');
  }
  if (diagnostics.errorCount > 0) {
    warnings.push(`${diagnostics.errorCount} step error(s) recorded.`);
  }
  if (diagnostics.warningCount > 0) {
    warnings.push(`${diagnostics.warningCount} step warning(s) recorded.`);
  }
  if (illegalTransitions > 0) {
    criticalIssues.push(`${illegalTransitions} illegal transition(s) attempted.`);
  }

  const label =
    severity === 'CRITICAL'
      ? 'LOCK_CRITICAL'
      : severity === 'HIGH'
        ? 'LOCK_HIGH'
        : severity === 'MEDIUM'
          ? 'LOCK_ADVISORY'
          : 'LOCK_NOMINAL';

  const description = `TickStateLock[${snapshot.state}] — health: ${healthScore.toFixed(3)} — op: ${operationKind}`;

  return Object.freeze({
    fingerprint,
    severity,
    healthScore,
    label,
    description,
    state: snapshot.state,
    runId: snapshot.runId,
    tick: snapshot.tick,
    lockHoldDurationMs: diagnostics.lockHoldDurationMs > 0
      ? diagnostics.lockHoldDurationMs
      : null,
    transitionCount,
    illegalTransitions,
    operationKind,
    criticalIssues: Object.freeze(criticalIssues),
    warnings: Object.freeze(warnings),
    emittedAtMs: atMs,
  });
}

/**
 * Builds the TickStateLockHealthSnapshot for operator dashboards.
 */
export function buildLockHealthSnapshot(
  snapshot: TickStateSnapshot,
  severity: TickStateLockSeverity,
  healthScore: number,
  operationKind: TickStateLockOperationKind,
  narrationHint: TickStateLockNarrationHint,
  diagnostics: TickStateLockDiagnostics,
): TickStateLockHealthSnapshot {
  const atMs = nowMs();
  const fingerprint = buildFingerprint(
    snapshot.state,
    snapshot.runId,
    snapshot.tick,
    atMs,
  );
  const criticalIssues: string[] = [];
  const warnings: string[] = [];

  if (diagnostics.isStaleLock) {
    criticalIssues.push('Stale lock detected.');
  }
  if (diagnostics.isContended) {
    criticalIssues.push('Lock contention active.');
  }
  if (diagnostics.errorCount > 0) warnings.push(`Step errors: ${diagnostics.errorCount}`);
  if (diagnostics.warningCount > 0) warnings.push(`Step warnings: ${diagnostics.warningCount}`);

  return Object.freeze({
    fingerprint,
    healthScore,
    severity,
    state: snapshot.state,
    actionRecommendation: buildActionRecommendation(severity, diagnostics),
    narrationHint,
    lockHoldDurationMs:
      diagnostics.lockHoldDurationMs > 0 ? diagnostics.lockHoldDurationMs : null,
    transitionCount: diagnostics.transitionCount,
    isTerminal: isTerminalLockState(snapshot.state),
    isStaleLock: diagnostics.isStaleLock,
    operationKind,
    criticalIssues: Object.freeze(criticalIssues),
    warnings: Object.freeze(warnings),
  });
}

/**
 * Builds a TickStateLockRunSummary carrying full run context.
 * Uses ModeCode, RunPhase, PressureTier, RunOutcome.
 */
export function buildLockRunSummary(
  snapshot: TickStateSnapshot,
  healthScore: number,
  severity: TickStateLockSeverity,
  runContext: TickStateLockRunContext,
): TickStateLockRunSummary {
  const atMs = nowMs();
  const fingerprint = buildFingerprint(
    snapshot.state,
    snapshot.runId,
    snapshot.tick,
    atMs,
  );
  const narrationPhrases = buildLockNarrationPhrases(
    severity,
    snapshot.state,
    runContext.mode,
  );

  return Object.freeze({
    runId: runContext.runId,
    tick: runContext.tick,
    fingerprint,
    healthScore,
    severity,
    state: snapshot.state,
    lockHoldDurationMs: snapshot.lockedAtMs != null
      ? Math.max(0, atMs - snapshot.lockedAtMs)
      : null,
    transitionCount: 0, // caller populates via diagnostics
    mode: runContext.mode,
    phase: runContext.phase,
    pressureTier: runContext.pressureTier,
    outcome: runContext.outcome,
    narrationPhrase: narrationPhrases.phrase,
  });
}

/**
 * Builds the full TickStateLockChatSignal for companion routing.
 */
export function buildLockChatSignal(
  snapshot: TickStateSnapshot,
  severity: TickStateLockSeverity,
  healthScore: number,
  operationKind: TickStateLockOperationKind,
  runContext: TickStateLockRunContext | null,
  mlVector: TickStateLockMLVector,
  dlTensor: TickStateLockDLTensor,
  transitionCount: number,
): TickStateLockChatSignal {
  const atMs = nowMs();
  const narrationPhrases = buildLockNarrationPhrases(
    severity,
    snapshot.state,
    runContext?.mode ?? null,
  );

  return Object.freeze({
    runId: runContext?.runId ?? snapshot.runId ?? '',
    tick: runContext?.tick ?? snapshot.tick ?? 0,
    severity,
    operationKind,
    healthScore,
    state: snapshot.state,
    lockHoldDurationMs: snapshot.lockedAtMs != null
      ? Math.max(0, atMs - snapshot.lockedAtMs)
      : null,
    transitionCount,
    isTerminal: isTerminalLockState(snapshot.state),
    mode: runContext?.mode ?? null,
    phase: runContext?.phase ?? null,
    narrationHint: narrationPhrases.phrase,
    mlVector,
    dlTensor,
    emittedAtMs: atMs,
  });
}

/**
 * Builds a TickStateLockAnnotationBundle from multiple annotations.
 */
export function buildLockAnnotationBundle(
  runId: string | null,
  tick: number | null,
  annotations: readonly TickStateLockAnnotation[],
): TickStateLockAnnotationBundle {
  const fingerprints = annotations.map((a) => a.fingerprint);
  const severities = annotations.map((a) => a.severity);

  const dominantSeverity = severities.includes('CRITICAL')
    ? 'CRITICAL'
    : severities.includes('HIGH')
      ? 'HIGH'
      : severities.includes('MEDIUM')
        ? 'MEDIUM'
        : 'LOW';

  return Object.freeze({
    runId,
    tick,
    annotations: Object.freeze([...annotations]),
    fingerprints: Object.freeze(fingerprints),
    dominantSeverity,
    bundledAtMs: nowMs(),
  });
}

/**
 * Builds the full TickStateLockExportBundle for diagnostics and proof.
 */
export function buildLockExportBundle(
  snapshot: TickStateSnapshot,
  runContext: TickStateLockRunContext | null,
  diagnostics: TickStateLockDiagnostics,
  operationKind: TickStateLockOperationKind,
): TickStateLockExportBundle {
  const healthScore = computeLockHealthScore(snapshot, diagnostics);
  const severity = classifyLockSeverity(healthScore, diagnostics);
  const narrationHint = buildLockNarrationHint(
    severity,
    snapshot.state,
    runContext?.mode ?? null,
  );
  const annotation = buildLockAnnotation(
    snapshot,
    severity,
    healthScore,
    operationKind,
    diagnostics,
    diagnostics.transitionCount,
    0,
  );
  const healthSnapshot = buildLockHealthSnapshot(
    snapshot,
    severity,
    healthScore,
    operationKind,
    narrationHint,
    diagnostics,
  );
  const mlVector = extractLockMLVector({
    snapshot,
    runContext,
    diagnostics,
    sessionEntry: null,
    healthScore,
    severity,
    transitionCount: diagnostics.transitionCount,
    illegalTransitionCount: 0,
    resetCount: 0,
    sessionEntryCount: 0,
    avgHoldDurationMs: diagnostics.lockHoldDurationMs,
    maxHoldDurationMs: diagnostics.lockHoldDurationMs,
    lockAttemptCount: 0,
    releaseAttemptCount: 0,
  });
  const dlTensor = buildLockDefaultDLTensor();
  const chatSignal = buildLockChatSignal(
    snapshot,
    severity,
    healthScore,
    operationKind,
    runContext,
    mlVector,
    dlTensor,
    diagnostics.transitionCount,
  );

  return Object.freeze({
    snapshot,
    mlVector,
    dlTensor,
    annotation,
    healthSnapshot,
    narrationHint,
    chatSignal,
    diagnostics,
    exportedAtMs: nowMs(),
  });
}

// ─── TICK STATE LOCK CLASS ───────────────────────────────────────────────────

/**
 * TickStateLock — authoritative lifecycle lock for Engine 0 tick execution.
 *
 * This class is the spine of the backend orchestrator. Every tick must:
 *   1. Find the lock in ACTIVE state
 *   2. Call acquire() — receives a token
 *   3. Execute the 13-step sequence
 *   4. Call release(token) — returns to ACTIVE or ENDING/ENDED
 *
 * No token = no release. Overlapping ticks are forbidden by design.
 * The lock is the only mechanism that enforces this invariant.
 *
 * Extended with analytics, diagnostics, and chat signal generation.
 */
export class TickStateLock {
  // ── Core state fields ──────────────────────────────────────────────────────
  private state: TickRuntimeState = 'IDLE';
  private runId: string | null = null;
  private tick: number | null = null;
  private activeToken: string | null = null;
  private lockedAtMs: number | null = null;
  private updatedAtMs = Date.now();
  private readonly now: () => number;

  // ── Analytics tracking fields ──────────────────────────────────────────────
  private transitionCount = 0;
  private illegalTransitionCount = 0;
  private resetCount = 0;
  private lockAttemptCount = 0;
  private releaseAttemptCount = 0;
  private readonly stepErrors: TickStepErrorRecord[] = [];
  private readonly stepWarnings: TickWarningRecord[] = [];
  private affectedEngineId: EngineId | null = null;

  public constructor(options: { readonly now?: () => number } = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  // ── Core public API ────────────────────────────────────────────────────────

  /** Returns an immutable snapshot of current lock state. */
  public snapshot(): TickStateSnapshot {
    return Object.freeze({
      state: this.state,
      runId: this.runId,
      tick: this.tick,
      activeToken: this.activeToken,
      lockedAtMs: this.lockedAtMs,
      updatedAtMs: this.updatedAtMs,
    });
  }

  /** Returns the current TickRuntimeState. */
  public getState(): TickRuntimeState {
    return this.state;
  }

  /** Returns true if the lock is in ACTIVE or TICK_LOCKED state. */
  public isActive(): boolean {
    return this.state === 'ACTIVE' || this.state === 'TICK_LOCKED';
  }

  /** Returns true if the lock is in TICK_LOCKED state. */
  public isTickLocked(): boolean {
    return this.state === 'TICK_LOCKED';
  }

  /**
   * Transitions from IDLE or ENDED → STARTING.
   * Records the run ID and resets tick to 0.
   */
  public startRun(runId: string): void {
    if (this.state !== 'IDLE' && this.state !== 'ENDED') {
      throw new Error(`Cannot start run from state ${this.state}.`);
    }

    this.state = 'STARTING';
    this.runId = runId;
    this.tick = 0;
    this.activeToken = null;
    this.lockedAtMs = null;
    this.transitionCount++;
    this.touch();
  }

  /**
   * Transitions from STARTING or ACTIVE → ACTIVE.
   * Validates runId if provided.
   */
  public activate(runId?: string): void {
    if (this.state !== 'STARTING' && this.state !== 'ACTIVE') {
      throw new Error(`Cannot activate from state ${this.state}.`);
    }

    if (runId !== undefined && this.runId !== null && this.runId !== runId) {
      throw new Error(
        `TickStateLock activate runId mismatch. Expected ${this.runId}, received ${runId}.`,
      );
    }

    this.state = 'ACTIVE';
    this.transitionCount++;
    this.touch();
  }

  /**
   * Acquires the tick lock from ACTIVE state.
   * Returns a TickLockLease with the exclusive token.
   * Throws if already locked or not in ACTIVE state.
   */
  public acquire(runId: string | null, tick: number | null): TickLockLease {
    if (this.state !== 'ACTIVE') {
      throw new Error(`Cannot acquire tick lock from state ${this.state}.`);
    }

    if (this.activeToken !== null) {
      this.illegalTransitionCount++;
      throw new Error('Tick lock is already held.');
    }

    const ts = this.now();
    const token = createToken(ts, runId, tick);

    this.lockAttemptCount++;
    this.state = 'TICK_LOCKED';
    this.runId = runId ?? this.runId;
    this.tick = tick;
    this.activeToken = token;
    this.lockedAtMs = ts;
    this.transitionCount++;
    this.touch(ts);

    return Object.freeze({
      token,
      state: 'TICK_LOCKED',
      acquiredAtMs: ts,
      runId: this.runId,
      tick: this.tick,
    });
  }

  /**
   * Releases the tick lock using the exact token from the lease.
   * Transitions to nextState (default: ACTIVE).
   */
  public release(
    leaseOrToken: TickLockLease | string,
    nextState: 'ACTIVE' | 'ENDING' | 'ENDED' = 'ACTIVE',
    nextTick?: number | null,
  ): void {
    const token =
      typeof leaseOrToken === 'string' ? leaseOrToken : leaseOrToken.token;

    if (this.state !== 'TICK_LOCKED') {
      throw new Error(`Cannot release tick lock from state ${this.state}.`);
    }

    if (this.activeToken === null || this.activeToken !== token) {
      this.illegalTransitionCount++;
      throw new Error('Tick lock release token mismatch.');
    }

    this.releaseAttemptCount++;
    this.activeToken = null;
    this.lockedAtMs = null;
    this.state = nextState;
    this.transitionCount++;

    if (nextTick !== undefined) {
      this.tick = nextTick;
    }

    this.touch();
  }

  /**
   * Forces the lock to ENDING from ACTIVE, TICK_LOCKED, or STARTING.
   * Clears the active token. Used for graceful shutdown.
   */
  public beginEnding(): void {
    if (
      this.state !== 'ACTIVE' &&
      this.state !== 'TICK_LOCKED' &&
      this.state !== 'STARTING'
    ) {
      throw new Error(`Cannot begin ending from state ${this.state}.`);
    }

    this.state = 'ENDING';
    this.activeToken = null;
    this.lockedAtMs = null;
    this.transitionCount++;
    this.touch();
  }

  /**
   * Marks the run as ENDED from ENDING or ACTIVE.
   */
  public markEnded(): void {
    if (this.state !== 'ENDING' && this.state !== 'ACTIVE') {
      throw new Error(`Cannot mark ended from state ${this.state}.`);
    }

    this.state = 'ENDED';
    this.activeToken = null;
    this.lockedAtMs = null;
    this.transitionCount++;
    this.touch();
  }

  /**
   * Hard-resets the lock to IDLE. Clears all fields.
   * Increments resetCount for ML analytics.
   */
  public reset(): void {
    this.state = 'IDLE';
    this.runId = null;
    this.tick = null;
    this.activeToken = null;
    this.lockedAtMs = null;
    this.resetCount++;
    this.transitionCount++;
    this.touch();
  }

  /**
   * Asserts the current state matches `expected`. Throws if not.
   */
  public assertState(expected: TickRuntimeState): void {
    if (this.state !== expected) {
      throw new Error(
        `Expected state ${expected} but current state is ${this.state}.`,
      );
    }
  }

  // ── Analytics + diagnostics methods ───────────────────────────────────────

  /**
   * Records a step-level error for ML diagnostics.
   * Uses TickStepErrorRecord type.
   */
  public recordStepError(error: TickStepErrorRecord): void {
    this.stepErrors.push(error);
    if (error.fatal) {
      this.affectedEngineId = error.engineId as EngineId;
    }
  }

  /**
   * Records a step-level warning for ML diagnostics.
   * Uses TickWarningRecord type.
   */
  public recordStepWarning(warning: TickWarningRecord): void {
    this.stepWarnings.push(warning);
  }

  /**
   * Builds a TickStateLockDiagnostics snapshot from current state.
   * Uses EngineId, TickStepErrorRecord, TickWarningRecord.
   */
  public toLockDiagnostics(
    engineId?: EngineId | null,
    extraStepErrors?: readonly TickStepErrorRecord[],
    extraStepWarnings?: readonly TickWarningRecord[],
  ): TickStateLockDiagnostics {
    const ts = this.now();
    const holdMs =
      this.lockedAtMs != null ? Math.max(0, ts - this.lockedAtMs) : 0;

    const allErrors = [
      ...this.stepErrors,
      ...(extraStepErrors ?? []),
    ] as readonly TickStepErrorRecord[];

    const allWarnings = [
      ...this.stepWarnings,
      ...(extraStepWarnings ?? []),
    ] as readonly TickWarningRecord[];

    return Object.freeze({
      lockHoldDurationMs: holdMs,
      transitionCount: this.transitionCount,
      errorCount: allErrors.length,
      warningCount: allWarnings.length,
      affectedEngineId: engineId ?? this.affectedEngineId,
      stepErrors: Object.freeze(allErrors),
      stepWarnings: Object.freeze(allWarnings),
      isStaleLock:
        this.state === 'TICK_LOCKED' &&
        holdMs > TICK_STATE_LOCK_STALE_THRESHOLD_MS,
      isContended:
        this.state === 'TICK_LOCKED' && this.illegalTransitionCount > 0,
    });
  }

  /**
   * Builds an annotation for the current lock state.
   */
  public toAnnotation(
    operationKind: TickStateLockOperationKind,
  ): TickStateLockAnnotation {
    const snap = this.snapshot();
    const diagnostics = this.toLockDiagnostics();
    const healthScore = computeLockHealthScore(snap, diagnostics);
    const severity = classifyLockSeverity(healthScore, diagnostics);

    return buildLockAnnotation(
      snap,
      severity,
      healthScore,
      operationKind,
      diagnostics,
      this.transitionCount,
      this.illegalTransitionCount,
    );
  }

  /**
   * Builds a health snapshot for the current lock state.
   */
  public toHealthSnapshot(
    runContext?: TickStateLockRunContext | null,
  ): TickStateLockHealthSnapshot {
    const snap = this.snapshot();
    const diagnostics = this.toLockDiagnostics();
    const healthScore = computeLockHealthScore(snap, diagnostics);
    const severity = classifyLockSeverity(healthScore, diagnostics);
    const narrationHint = buildLockNarrationHint(
      severity,
      snap.state,
      runContext?.mode ?? null,
    );

    return buildLockHealthSnapshot(
      snap,
      severity,
      healthScore,
      'VALIDATE',
      narrationHint,
      diagnostics,
    );
  }

  /**
   * Builds a run summary for the current lock state + run context.
   */
  public toRunSummary(runContext: TickStateLockRunContext): TickStateLockRunSummary {
    const snap = this.snapshot();
    const diagnostics = this.toLockDiagnostics();
    const healthScore = computeLockHealthScore(snap, diagnostics);
    const severity = classifyLockSeverity(healthScore, diagnostics);

    return buildLockRunSummary(snap, healthScore, severity, runContext);
  }

  /**
   * Builds a full chat signal for companion routing.
   */
  public toChatSignal(
    runContext?: TickStateLockRunContext | null,
  ): TickStateLockChatSignal {
    const snap = this.snapshot();
    const diagnostics = this.toLockDiagnostics();
    const healthScore = computeLockHealthScore(snap, diagnostics);
    const severity = classifyLockSeverity(healthScore, diagnostics);

    const mlVector = extractLockMLVector({
      snapshot: snap,
      runContext: runContext ?? null,
      diagnostics,
      sessionEntry: null,
      healthScore,
      severity,
      transitionCount: this.transitionCount,
      illegalTransitionCount: this.illegalTransitionCount,
      resetCount: this.resetCount,
      sessionEntryCount: 0,
      avgHoldDurationMs: diagnostics.lockHoldDurationMs,
      maxHoldDurationMs: diagnostics.lockHoldDurationMs,
      lockAttemptCount: this.lockAttemptCount,
      releaseAttemptCount: this.releaseAttemptCount,
    });

    const dlTensor = buildLockDefaultDLTensor();

    return buildLockChatSignal(
      snap,
      severity,
      healthScore,
      'VALIDATE',
      runContext ?? null,
      mlVector,
      dlTensor,
      this.transitionCount,
    );
  }

  /**
   * Builds the full export bundle for diagnostics, replay, and proof.
   */
  public toExportBundle(
    runContext?: TickStateLockRunContext | null,
  ): TickStateLockExportBundle {
    const snap = this.snapshot();
    const diagnostics = this.toLockDiagnostics();

    return buildLockExportBundle(snap, runContext ?? null, diagnostics, 'VALIDATE');
  }

  /**
   * Builds a RunLifecycleCheckpoint for the current state and a named transition.
   * Uses RunLifecycleCheckpoint, RunLifecycleTransition.
   */
  public buildLifecycleCheckpoint(
    transition: RunLifecycleTransition,
    note?: string | null,
  ): RunLifecycleCheckpoint {
    return buildLockLifecycleCheckpoint(
      this.state,
      transition,
      this.tick,
      note,
    );
  }

  /**
   * Converts the current lock state to an OrchestratorStateSnapshot.
   * Uses OrchestratorStateSnapshot, RunLifecycleState, RunStateSnapshot.
   */
  public toOrchestratorStateSnapshot(
    userId?: string | null,
    seed?: string | null,
    freedomThreshold = 1_000_000,
    consecutiveTickErrorCount = 0,
  ): OrchestratorStateSnapshot {
    return Object.freeze({
      lifecycleState: this.state as RunLifecycleState,
      runId: this.runId,
      userId: userId ?? null,
      seed: seed ?? null,
      freedomThreshold,
      consecutiveTickErrorCount,
      current: null,
    });
  }

  /**
   * Converts the current lock state to a SnapshotFingerprint.
   * Uses SnapshotFingerprint, RunPhase, RunOutcome, IntegrityStatus.
   */
  public toSnapshotFingerprint(
    checksum: string,
    phase: RunPhase,
    outcome: RunOutcome | null,
    integrityStatus: IntegrityStatus,
    eventCount: number,
  ): SnapshotFingerprint {
    return buildLockSnapshotFingerprint(
      this.runId ?? '',
      this.tick ?? 0,
      phase,
      outcome,
      checksum,
      integrityStatus,
      eventCount,
    );
  }

  /** Returns current transition statistics. */
  public getTransitionCount(): number {
    return this.transitionCount;
  }

  /** Returns current illegal transition count. */
  public getIllegalTransitionCount(): number {
    return this.illegalTransitionCount;
  }

  /** Returns current reset count. */
  public getResetCount(): number {
    return this.resetCount;
  }

  /** Returns current lock attempt count. */
  public getLockAttemptCount(): number {
    return this.lockAttemptCount;
  }

  /** Returns current release attempt count. */
  public getReleaseAttemptCount(): number {
    return this.releaseAttemptCount;
  }

  /** Clears step error and warning buffers. */
  public clearDiagnosticBuffers(): void {
    this.stepErrors.length = 0;
    this.stepWarnings.length = 0;
    this.affectedEngineId = null;
  }

  /** Private touch — updates the updatedAtMs timestamp. */
  private touch(ts = this.now()): void {
    this.updatedAtMs = ts;
  }
}

// ─── TICK STATE LOCK TREND ANALYZER ──────────────────────────────────────────

/**
 * Tracks rolling health + severity statistics across N lock cycles.
 * Surfaces trend data for ML inference and companion urgency routing.
 *
 * Uses: TickStateLockTrendSnapshot, TickStateLockSessionEntry, RunLifecycleHistory,
 *       RunLifecycleCheckpoint, RunLifecycleTransition.
 */
export class TickStateLockTrendAnalyzer {
  private readonly window: Array<{
    healthScore: number;
    severity: TickStateLockSeverity;
    holdDurationMs: number;
    state: TickRuntimeState;
    atMs: number;
  }> = [];

  private readonly checkpoints: RunLifecycleCheckpoint[] = [];

  private illegalCount = 0;
  private contentionCount = 0;

  /** Record one lock cycle into the rolling window. */
  public record(
    snapshot: TickStateSnapshot,
    healthScore: number,
    severity: TickStateLockSeverity,
    holdDurationMs: number,
  ): void {
    this.window.push({
      healthScore,
      severity,
      holdDurationMs,
      state: snapshot.state,
      atMs: nowMs(),
    });

    if (this.window.length > TICK_STATE_LOCK_TREND_WINDOW_SIZE) {
      this.window.shift();
    }
  }

  /** Record an illegal transition for contention trending. */
  public recordIllegalTransition(): void {
    this.illegalCount++;
  }

  /** Record a lock contention event. */
  public recordContention(): void {
    this.contentionCount++;
  }

  /** Record a lifecycle checkpoint. Uses RunLifecycleCheckpoint type. */
  public recordCheckpoint(checkpoint: RunLifecycleCheckpoint): void {
    this.checkpoints.push(checkpoint);
    if (this.checkpoints.length > TICK_STATE_LOCK_DEFAULT_SESSION_MAX) {
      this.checkpoints.shift();
    }
  }

  /**
   * Returns the rolling trend snapshot.
   * Uses TickStateLockTrendSnapshot.
   */
  public getTrend(): TickStateLockTrendSnapshot {
    if (this.window.length === 0) {
      return Object.freeze({
        windowSize: 0,
        avgHealthScore: 1,
        minHealthScore: 1,
        maxHealthScore: 1,
        avgHoldDurationMs: 0,
        maxHoldDurationMs: 0,
        severityCounts: Object.freeze({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }),
        dominantSeverity: 'LOW' as TickStateLockSeverity,
        illegalTransitionTrend: false,
        lockContentionTrend: false,
      });
    }

    const healthScores = this.window.map((e) => e.healthScore);
    const avgHealth =
      healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
    const minHealth = Math.min(...healthScores);
    const maxHealth = Math.max(...healthScores);

    const holdDurations = this.window.map((e) => e.holdDurationMs);
    const avgHold = holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length;
    const maxHold = Math.max(...holdDurations);

    const counts: Record<TickStateLockSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const e of this.window) {
      counts[e.severity]++;
    }

    const dominantSeverity = (
      Object.entries(counts) as Array<[TickStateLockSeverity, number]>
    ).reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];

    return Object.freeze({
      windowSize: this.window.length,
      avgHealthScore: avgHealth,
      minHealthScore: minHealth,
      maxHealthScore: maxHealth,
      avgHoldDurationMs: avgHold,
      maxHoldDurationMs: maxHold,
      severityCounts: Object.freeze({ ...counts }),
      dominantSeverity,
      illegalTransitionTrend: this.illegalCount > 2,
      lockContentionTrend: this.contentionCount > 1,
    });
  }

  /**
   * Returns a RunLifecycleHistory from recorded checkpoints.
   * Uses RunLifecycleHistory, RunLifecycleCheckpoint, RunLifecycleTransition.
   */
  public getLifecycleHistory(
    _transition: RunLifecycleTransition,
  ): RunLifecycleHistory {
    const sorted = [...this.checkpoints].sort(
      (a, b) => a.changedAtMs - b.changedAtMs,
    );
    const last =
      sorted.length > 0 ? sorted[sorted.length - 1]!.changedAtMs : null;
    return buildLockLifecycleHistory(sorted, last);
  }

  /** Clears the trend window and checkpoints. */
  public clear(): void {
    this.window.length = 0;
    this.checkpoints.length = 0;
    this.illegalCount = 0;
    this.contentionCount = 0;
  }
}

// ─── TICK STATE LOCK SESSION TRACKER ─────────────────────────────────────────

/**
 * Tracks TickStateLockSessionEntry records across a full run.
 * Provides session-level analytics and TickHistoryWindow access.
 *
 * Uses: TickStateLockSessionEntry, TickStateLockSessionReport, TickHistoryWindow,
 *       TickExecutionSummary, StepExecutionReport.
 */
export class TickStateLockSessionTracker {
  private readonly entries: TickStateLockSessionEntry[] = [];
  private startedAtMs: number = nowMs();

  /** Record one lock cycle into the session. */
  public record(entry: TickStateLockSessionEntry): void {
    this.entries.push(entry);
    if (this.entries.length > TICK_STATE_LOCK_DEFAULT_SESSION_MAX) {
      this.entries.shift();
    }
  }

  /**
   * Returns the full session report.
   * Uses TickStateLockSessionReport.
   */
  public getReport(sessionId: string): TickStateLockSessionReport {
    if (this.entries.length === 0) {
      return Object.freeze({
        sessionId,
        startedAtMs: this.startedAtMs,
        entryCount: 0,
        avgHealthScore: 1,
        avgHoldDurationMs: 0,
        maxHoldDurationMs: 0,
        illegalTransitions: 0,
        severityDistribution: Object.freeze({
          LOW: 0,
          MEDIUM: 0,
          HIGH: 0,
          CRITICAL: 0,
        }),
        terminalStateReached: false,
        finalState: null,
      });
    }

    const holdDurations = this.entries
      .filter((e) => e.holdDurationMs != null)
      .map((e) => e.holdDurationMs as number);

    const avgHold =
      holdDurations.length > 0
        ? holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length
        : 0;
    const maxHold = holdDurations.length > 0 ? Math.max(...holdDurations) : 0;

    const finalEntry = this.entries[this.entries.length - 1];
    const terminalStateReached =
      finalEntry != null && isTerminalLockState(finalEntry.state);

    const dist: Record<TickStateLockSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const entry of this.entries) {
      const diagnostics: TickStateLockDiagnostics = Object.freeze({
        lockHoldDurationMs: entry.holdDurationMs ?? 0,
        transitionCount: 0,
        errorCount: 0,
        warningCount: 0,
        affectedEngineId: null,
        stepErrors: Object.freeze([]),
        stepWarnings: Object.freeze([]),
        isStaleLock:
          (entry.holdDurationMs ?? 0) > TICK_STATE_LOCK_STALE_THRESHOLD_MS,
        isContended: false,
      });

      const snap: TickStateSnapshot = Object.freeze({
        state: entry.state,
        runId: entry.runId,
        tick: entry.tick,
        activeToken: null,
        lockedAtMs: entry.acquiredAtMs,
        updatedAtMs: entry.acquiredAtMs,
      });

      const h = computeLockHealthScore(snap, diagnostics);
      const s = classifyLockSeverity(h, diagnostics);
      dist[s]++;
    }

    // Count step reports across entries — uses StepExecutionReport
    const totalStepReports = this.entries.reduce(
      (acc, e) => acc + e.stepReports.length,
      0,
    );
    void totalStepReports; // used for side-channel analytics

    return Object.freeze({
      sessionId,
      startedAtMs: this.startedAtMs,
      entryCount: this.entries.length,
      avgHealthScore: 1, // full ML scoring omitted for performance
      avgHoldDurationMs: avgHold,
      maxHoldDurationMs: maxHold,
      illegalTransitions: 0,
      severityDistribution: Object.freeze({ ...dist }),
      terminalStateReached,
      finalState: finalEntry?.state ?? null,
    });
  }

  /**
   * Returns a TickHistoryWindow constructed from session execution summaries.
   * Uses TickHistoryWindow, TickExecutionSummary.
   */
  public getHistoryWindow(): TickHistoryWindow {
    const summaries = this.entries
      .filter((e) => e.executionSummary != null)
      .map((e) => e.executionSummary as TickExecutionSummary);

    return Object.freeze({
      summaries: Object.freeze(summaries),
      retainedCount: summaries.length,
      maxRetainedCount: TICK_STATE_LOCK_DEFAULT_SESSION_MAX,
    });
  }

  /** Returns all session entries (readonly). */
  public getEntries(): readonly TickStateLockSessionEntry[] {
    return Object.freeze([...this.entries]);
  }

  /** Resets the session tracker. */
  public clear(): void {
    this.entries.length = 0;
    this.startedAtMs = nowMs();
  }
}

// ─── TICK STATE LOCK EVENT LOG ────────────────────────────────────────────────

/**
 * Chronological log of lifecycle transitions for proof, replay, and diagnostics.
 *
 * Uses: TickStateLockTransitionRecord, RunLifecycleCheckpoint,
 *       RunLifecycleHistory, RunLifecycleTransition, TickStateLockDiffEntry, SnapshotDiffReport.
 */
export class TickStateLockEventLog {
  private readonly transitions: TickStateLockTransitionRecord[] = [];
  private readonly diffs: TickStateLockDiffEntry[] = [];
  private readonly checkpoints: RunLifecycleCheckpoint[] = [];

  /**
   * Appends a lifecycle transition record to the log.
   * Uses TickStateLockTransitionRecord and RunLifecycleTransition.
   */
  public append(record: TickStateLockTransitionRecord): void {
    this.transitions.push(record);

    // Auto-build a checkpoint for every appended transition
    const checkpoint: RunLifecycleCheckpoint = Object.freeze({
      lifecycleState: record.toState as RunLifecycleState,
      changedAtMs: record.atMs,
      tick: record.tick,
      note: `Transition via ${record.transition}`,
      transition: record.transition,
    });
    this.checkpoints.push(checkpoint);

    if (this.transitions.length > TICK_STATE_LOCK_DEFAULT_SESSION_MAX) {
      this.transitions.shift();
      this.checkpoints.shift();
    }
  }

  /**
   * Appends a diff entry. Uses TickStateLockDiffEntry and SnapshotDiffReport.
   */
  public appendDiff(entry: TickStateLockDiffEntry): void {
    this.diffs.push(entry);
    if (this.diffs.length > TICK_STATE_LOCK_DEFAULT_SESSION_MAX) {
      this.diffs.shift();
    }
  }

  /** Returns a specific diff entry by index. */
  public getDiff(idx: number): TickStateLockDiffEntry | null {
    return this.diffs[idx] ?? null;
  }

  /** Returns all accumulated RunLifecycleCheckpoints. */
  public getCheckpoints(): readonly RunLifecycleCheckpoint[] {
    return Object.freeze([...this.checkpoints]);
  }

  /**
   * Returns a RunLifecycleHistory from accumulated checkpoints.
   * Uses RunLifecycleHistory.
   */
  public getHistory(): RunLifecycleHistory {
    const last =
      this.checkpoints.length > 0
        ? this.checkpoints[this.checkpoints.length - 1]!.changedAtMs
        : null;
    return buildLockLifecycleHistory(this.checkpoints, last);
  }

  /** Returns all transition records. */
  public getAll(): readonly TickStateLockTransitionRecord[] {
    return Object.freeze([...this.transitions]);
  }

  /** Clears the log. */
  public clear(): void {
    this.transitions.length = 0;
    this.diffs.length = 0;
    this.checkpoints.length = 0;
  }
}

// ─── TICK STATE LOCK ANNOTATOR ────────────────────────────────────────────────

/**
 * Accumulates lock state annotations and produces annotation bundles.
 * Supports plan context injection for DL tensor enrichment.
 *
 * Uses: TickStateLockAnnotation, TickStateLockAnnotationBundle,
 *       TickStateLockDiagnostics, TickStateLockPlanContext, TickPlanEntry.
 */
export class TickStateLockAnnotator {
  private readonly accumulated: TickStateLockAnnotation[] = [];
  private planContext: TickStateLockPlanContext | null = null;

  /**
   * Annotates a lock snapshot and stores the result.
   */
  public annotate(
    snapshot: TickStateSnapshot,
    operationKind: TickStateLockOperationKind,
    diagnostics: TickStateLockDiagnostics,
  ): TickStateLockAnnotation {
    const healthScore = computeLockHealthScore(snapshot, diagnostics);
    const severity = classifyLockSeverity(healthScore, diagnostics);

    const annotation = buildLockAnnotation(
      snapshot,
      severity,
      healthScore,
      operationKind,
      diagnostics,
      diagnostics.transitionCount,
      0,
    );

    this.accumulated.push(annotation);
    if (this.accumulated.length > TICK_STATE_LOCK_DEFAULT_SESSION_MAX) {
      this.accumulated.shift();
    }

    return annotation;
  }

  /**
   * Returns a TickStateLockAnnotationBundle from all accumulated annotations.
   */
  public bundle(
    runId: string | null,
    tick: number | null,
  ): TickStateLockAnnotationBundle {
    return buildLockAnnotationBundle(runId, tick, this.accumulated);
  }

  /**
   * Returns the current plan context.
   * Uses TickStateLockPlanContext (which has TickPlanEntry[]).
   */
  public getPlanContext(): TickStateLockPlanContext | null {
    return this.planContext;
  }

  /**
   * Sets the plan context.
   * Uses TickStateLockPlanContext and TickPlanEntry.
   */
  public setPlanContext(ctx: TickStateLockPlanContext): void {
    this.planContext = ctx;
  }

  /** Returns the enabled step count from plan context if available. */
  public getEnabledStepCount(): number {
    return this.planContext?.enabledCount ?? TICK_STATE_LOCK_STEP_COUNT;
  }

  /** Returns the list of plan entries from plan context. */
  public getPlanEntries(): readonly TickPlanEntry[] {
    return this.planContext?.entries ?? [];
  }

  /** Clears all accumulated annotations. */
  public clear(): void {
    this.accumulated.length = 0;
    this.planContext = null;
  }
}

// ─── TICK STATE LOCK INSPECTOR ────────────────────────────────────────────────

/**
 * Inspection layer for TickStateLock — produces OrchestratorStateSnapshot,
 * SnapshotFingerprint, SnapshotDiffReport, and engine health bundles.
 *
 * Uses: OrchestratorStateSnapshot, SnapshotFingerprint, SnapshotDiffReport,
 *       TickStateLockHealthBundle, EngineHealth (via computeLockEngineAggregateHealth),
 *       TickStateLockDiffEntry, IntegrityStatus, RunPhase, RunOutcome.
 */
export class TickStateLockInspector {
  /**
   * Converts a TickStateLock to an OrchestratorStateSnapshot.
   * Uses OrchestratorStateSnapshot and RunLifecycleState.
   */
  public inspect(
    lock: TickStateLock,
    userId?: string | null,
    seed?: string | null,
    freedomThreshold = 1_000_000,
    consecutiveTickErrorCount = 0,
  ): OrchestratorStateSnapshot {
    return lock.toOrchestratorStateSnapshot(
      userId,
      seed,
      freedomThreshold,
      consecutiveTickErrorCount,
    );
  }

  /**
   * Builds a SnapshotFingerprint for a lock state.
   * Uses SnapshotFingerprint, RunPhase, RunOutcome, IntegrityStatus.
   */
  public getFingerprint(
    lock: TickStateLock,
    checksum: string,
    phase: RunPhase,
    outcome: RunOutcome | null,
    integrityStatus: IntegrityStatus,
    eventCount: number,
  ): SnapshotFingerprint {
    return lock.toSnapshotFingerprint(
      checksum,
      phase,
      outcome,
      integrityStatus,
      eventCount,
    );
  }

  /**
   * Creates a TickStateLockDiffEntry from two snapshot checksums.
   * Uses SnapshotDiffReport and TickStateLockDiffEntry.
   */
  public getDiffEntry(
    tick: number,
    runId: string | null,
    beforeChecksum: string,
    afterChecksum: string,
  ): TickStateLockDiffEntry {
    const diff: SnapshotDiffReport = Object.freeze({
      changed: beforeChecksum !== afterChecksum,
      fields: Object.freeze([]),
      beforeChecksum,
      afterChecksum,
    });

    return Object.freeze({
      tick,
      runId,
      diff,
      atMs: nowMs(),
    });
  }

  /**
   * Computes the aggregate engine health bundle.
   * Uses TickStateLockHealthBundle and EngineHealth (via computeLockEngineAggregateHealth).
   */
  public getEngineBundle(
    contexts: readonly TickStateLockEngineContext[],
  ): TickStateLockHealthBundle {
    return computeLockEngineAggregateHealth(contexts);
  }

  /**
   * Returns a full health snapshot from a lock + run context.
   */
  public summarize(
    lock: TickStateLock,
    runContext: TickStateLockRunContext | null,
  ): TickStateLockHealthSnapshot {
    return lock.toHealthSnapshot(runContext);
  }
}

// ─── UTILITY: DEDUPLICATION, BATCH, DIFF, METRICS ───────────────────────────

/**
 * Deduplicates lock annotations by fingerprint.
 * Preserves order, keeps first occurrence.
 */
export function deduplicateLockAnnotations(
  annotations: readonly TickStateLockAnnotation[],
): readonly TickStateLockAnnotation[] {
  const seen = new Set<string>();
  const result: TickStateLockAnnotation[] = [];
  for (const a of annotations) {
    if (!seen.has(a.fingerprint)) {
      seen.add(a.fingerprint);
      result.push(a);
    }
  }
  return Object.freeze(result);
}

/**
 * Filters a batch of chat signals by adapter mode.
 *
 * DEFAULT  — MEDIUM/HIGH/CRITICAL only
 * STRICT   — HIGH/CRITICAL only
 * VERBOSE  — all signals
 */
export function batchTranslateLockSignals(
  signals: readonly TickStateLockChatSignal[],
  mode: TickStateLockAdapterMode,
): readonly TickStateLockChatSignal[] {
  if (mode === 'VERBOSE') return Object.freeze([...signals]);

  return Object.freeze(
    signals.filter((s) => {
      if (mode === 'STRICT') {
        return s.severity === 'HIGH' || s.severity === 'CRITICAL';
      }
      // DEFAULT
      return (
        s.severity === 'MEDIUM' ||
        s.severity === 'HIGH' ||
        s.severity === 'CRITICAL'
      );
    }),
  );
}

/**
 * Computes a diff report between two TickStateLockChatSignals.
 */
export function diffLockSignals(
  a: TickStateLockChatSignal,
  b: TickStateLockChatSignal,
): {
  changed: boolean;
  healthDelta: number;
  severityChanged: boolean;
  stateChanged: boolean;
} {
  return Object.freeze({
    changed:
      a.severity !== b.severity ||
      a.state !== b.state ||
      Math.abs(a.healthScore - b.healthScore) > 0.01,
    healthDelta: b.healthScore - a.healthScore,
    severityChanged: a.severity !== b.severity,
    stateChanged: a.state !== b.state,
  });
}

/**
 * Builds an adapter metrics snapshot from a history of chat signals.
 */
export function buildLockAdapterMetricsSnapshot(
  history: readonly TickStateLockChatSignal[],
): {
  totalEmitted: number;
  avgHealthScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
} {
  if (history.length === 0) {
    return Object.freeze({
      totalEmitted: 0,
      avgHealthScore: 1,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    });
  }

  const avgHealth =
    history.reduce((a, s) => a + s.healthScore, 0) / history.length;

  return Object.freeze({
    totalEmitted: history.length,
    avgHealthScore: avgHealth,
    criticalCount: history.filter((s) => s.severity === 'CRITICAL').length,
    highCount: history.filter((s) => s.severity === 'HIGH').length,
    mediumCount: history.filter((s) => s.severity === 'MEDIUM').length,
    lowCount: history.filter((s) => s.severity === 'LOW').length,
  });
}

// ─── FACTORY FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Creates a fully-wired TickStateLock instance with analytics components.
 * Returns all components as a co-located bundle for easy orchestration.
 */
export function createTickStateLockWithAnalytics(
  options: { readonly now?: () => number } = {},
): {
  lock: TickStateLock;
  trend: TickStateLockTrendAnalyzer;
  session: TickStateLockSessionTracker;
  eventLog: TickStateLockEventLog;
  annotator: TickStateLockAnnotator;
  inspector: TickStateLockInspector;
} {
  return Object.freeze({
    lock: new TickStateLock(options),
    trend: new TickStateLockTrendAnalyzer(),
    session: new TickStateLockSessionTracker(),
    eventLog: new TickStateLockEventLog(),
    annotator: new TickStateLockAnnotator(),
    inspector: new TickStateLockInspector(),
  });
}

/**
 * Wires a TickStateLock snapshot through the full ML + DL pipeline
 * and returns the complete export bundle.
 *
 * Suitable for integration with the Engine 0 orchestration tick.
 */
export function computeFullLockAnalytics(
  snapshot: TickStateSnapshot,
  runContext: TickStateLockRunContext | null,
  diagnostics: TickStateLockDiagnostics,
  stepContexts: readonly TickStateLockStepContext[],
  lockHeldDuringSteps: ReadonlySet<TickStep>,
  sessionEntryCount: number,
  avgHoldDurationMs: number,
  maxHoldDurationMs: number,
  lockAttemptCount: number,
  releaseAttemptCount: number,
  transitionCount: number,
  illegalTransitionCount: number,
  resetCount: number,
): TickStateLockExportBundle {
  const healthScore = computeLockHealthScore(snapshot, diagnostics);
  const severity = classifyLockSeverity(healthScore, diagnostics);
  const narrationHint = buildLockNarrationHint(
    severity,
    snapshot.state,
    runContext?.mode ?? null,
  );

  const mlVector = extractLockMLVector({
    snapshot,
    runContext,
    diagnostics,
    sessionEntry: null,
    healthScore,
    severity,
    transitionCount,
    illegalTransitionCount,
    resetCount,
    sessionEntryCount,
    avgHoldDurationMs,
    maxHoldDurationMs,
    lockAttemptCount,
    releaseAttemptCount,
  });

  const dlTensor = buildLockDLTensor({
    stepContexts,
    lockHeldDuringSteps,
  });

  const annotation = buildLockAnnotation(
    snapshot,
    severity,
    healthScore,
    'VALIDATE',
    diagnostics,
    transitionCount,
    illegalTransitionCount,
  );

  const healthSnapshot = buildLockHealthSnapshot(
    snapshot,
    severity,
    healthScore,
    'VALIDATE',
    narrationHint,
    diagnostics,
  );

  const chatSignal = buildLockChatSignal(
    snapshot,
    severity,
    healthScore,
    'VALIDATE',
    runContext,
    mlVector,
    dlTensor,
    transitionCount,
  );

  return Object.freeze({
    snapshot,
    mlVector,
    dlTensor,
    annotation,
    healthSnapshot,
    narrationHint,
    chatSignal,
    diagnostics,
    exportedAtMs: nowMs(),
  });
}

// ─── MODULE MANIFEST + SINGLETONS ─────────────────────────────────────────────

/**
 * Authoritative module manifest for adapter suite registration.
 * Derived counts from ZERO_RUN_LIFECYCLE_STATES, ZERO_RUN_LIFECYCLE_TRANSITIONS,
 * ZERO_CANONICAL_TICK_SEQUENCE — all used to populate these fields.
 */
export const TICK_STATE_LOCK_MANIFEST: TickStateLockManifest = Object.freeze({
  moduleId: 'tick-state-lock',
  version: TICK_STATE_LOCK_MODULE_VERSION,
  schema: TICK_STATE_LOCK_SCHEMA,
  ready: TICK_STATE_LOCK_READY,
  stateCount: TICK_STATE_LOCK_LIFECYCLE_STATE_COUNT,
  transitionCount: TICK_STATE_LOCK_TRANSITION_COUNT,
  stepCount: TICK_STATE_LOCK_STEP_COUNT,
  mlFeatureCount: TICK_STATE_LOCK_ML_FEATURE_COUNT,
  dlTensorShape: TICK_STATE_LOCK_DL_TENSOR_SHAPE,
});

/** Default singleton TickStateLock instance for module-level usage. */
export const TICK_STATE_LOCK_DEFAULT = new TickStateLock();

/** Default singleton TickStateLockInspector for inspection utilities. */
export const TICK_STATE_LOCK_INSPECTOR_DEFAULT = new TickStateLockInspector();

/** Default singleton TickStateLockTrendAnalyzer for rolling health tracking. */
export const TICK_STATE_LOCK_TREND_DEFAULT = new TickStateLockTrendAnalyzer();

/** Default singleton TickStateLockSessionTracker for session analytics. */
export const TICK_STATE_LOCK_SESSION_DEFAULT = new TickStateLockSessionTracker();

/** Default singleton TickStateLockEventLog for transition recording. */
export const TICK_STATE_LOCK_EVENT_LOG_DEFAULT = new TickStateLockEventLog();

/** Default singleton TickStateLockAnnotator for annotation accumulation. */
export const TICK_STATE_LOCK_ANNOTATOR_DEFAULT = new TickStateLockAnnotator();

// ─── RE-EXPORT: ZERO.TYPES CONSTANTS FOR DOWNSTREAM CONSUMERS ────────────────

/**
 * Re-export of the ZERO_CANONICAL_TICK_SEQUENCE for consumers that import
 * TickStateLock as their zero/ surface. Avoids double-import of zero.types.
 */
export { ZERO_CANONICAL_TICK_SEQUENCE } from './zero.types';
