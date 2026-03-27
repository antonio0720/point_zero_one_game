/* ============================================================================
 * FILE: backend/src/game/engine/time/TickScheduler.ts
 * POINT ZERO ONE — BACKEND ENGINE TIME — v5.0.0
 *
 * Doctrine:
 *   - Backend scheduling is an edge concern; simulation truth lives in runtime + clock
 *   - Chained setTimeout is the cadence shell; callbacks must never overlap
 *   - Pause/resume preserves remaining time — no silent restart on resume
 *   - Deterministic clocks are injectable for tests and replay harnesses
 *   - All tick events flow through 12 sub-systems for ML/DL/UX/chat extraction
 *   - Mode and phase context are first-class scheduling inputs at every step
 *   - ALL tier transitions are audited for replay integrity and ML consumption
 *   - 28-dim ML vector (TimeContractMLVector) maintained per-instance via MLExtractor
 *   - 40×6 DL tensor rolling buffer maintained per-instance via DLBuilder
 *   - LIVEOPS_TICK chat signals emitted on significant cadence events via ChatEmitter
 *   - Resilience, trend, drift, and session analytics are co-equal to scheduling
 *   - Zero TypeScript errors; zero unused imports
 *
 * Sub-systems (v5.0.0):
 *   TickSchedulerAuditTrail     — full tick history ring buffer (capacity: 200)
 *   TickSchedulerDriftDetector  — real-time drift monitoring and alarm escalation
 *   TickSchedulerTierTracker    — tier transition history and escalation counters
 *   TickSchedulerResilienceScorer — cadence stability and recovery scoring (0–1)
 *   TickSchedulerNarrator       — UX narrative generation per tick / tier / phase
 *   TickSchedulerMLExtractor    — 28-dim TimeContractMLVector extraction
 *   TickSchedulerDLBuilder      — 40×6 rolling TimeContractDLTensor construction
 *   TickSchedulerChatEmitter    — LIVEOPS_TICK signal factory for chat lane
 *   TickSchedulerModeAdvisor    — mode-specific scheduling profiles and advice
 *   TickSchedulerPhaseAdvisor   — phase-specific scheduling reasoning and budget
 *   TickSchedulerSessionTracker — session-scoped tick statistics and residency
 *   TickSchedulerAnalytics      — composite analytical surface for all sub-systems
 *   TickScheduler               — main orchestrating scheduler class
 * ============================================================================ */

import type { ClockSource } from '../core/ClockSource';
import { SystemClock } from '../core/ClockSource';
import type { PressureTier, ModeCode, RunPhase } from '../core/GamePrimitives';
import {
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIER_URGENCY_LABEL,
  PRESSURE_TIER_MIN_HOLD_TICKS,
  MODE_NORMALIZED,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_TENSION_FLOOR,
  RUN_PHASE_NORMALIZED,
  RUN_PHASE_STAKES_MULTIPLIER,
  RUN_PHASE_TICK_BUDGET_FRACTION,
} from '../core/GamePrimitives';

import {
  TickTier,
  TICK_TIER_CONFIGS,
  TICK_TIER_BY_PRESSURE_TIER,
  PRESSURE_TIER_BY_TICK_TIER,
  TIER_DURATIONS_MS,
  DECISION_WINDOW_DURATIONS_MS,
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  PHASE_BOUNDARIES_MS,
  pressureTierToTickTier,
  tickTierToPressureTier,
  computeInterpolationTickCount,
  createInterpolationPlan,
  resolvePhaseFromElapsedMs,
  isPhaseBoundaryTransition,
  clampNonNegativeInteger,
  clampTickDurationMs,
  normalizeTickDurationMs,
  getTickTierConfig,
  getTickTierConfigByPressureTier,
  getDefaultTickDurationMs,
  getDecisionWindowDurationMs,
} from './types';
import type {
  TickTierConfig,
  TickInterpolationPlan,
  PressureReader,
} from './types';

import {
  TIME_CONTRACTS_VERSION,
  TIME_CONTRACT_ML_DIM,
  TIME_CONTRACT_DL_ROW_COUNT,
  TIME_CONTRACT_DL_COL_COUNT,
  TIME_CONTRACT_TIER_URGENCY,
  TIME_CONTRACT_MODE_TEMPO,
  TIME_CONTRACT_PHASE_SCORE,
  TIME_CONTRACT_BUDGET_THRESHOLDS,
  TIME_CONTRACT_TICK_DRIFT_THRESHOLDS,
  TIME_CONTRACT_MAX_BUDGET_MS,
  TIME_CONTRACT_MAX_TICK_DURATION_MS,
  TIME_CONTRACT_MAX_DECISION_WINDOW_MS,
  TIME_CONTRACT_DL_COL_LABELS,
  TIME_CONTRACT_ML_FEATURE_LABELS,
  TIME_CONTRACT_OUTCOME_IS_TERMINAL,
  TIME_CONTRACT_HOLD_RESULT_LABELS,
  TIME_CONTRACT_SEASON_LIFECYCLE_LABEL,
  TIME_CONTRACT_LATENCY_THRESHOLDS,
  scoreContractChatUrgency,
  describeTickDriftSeverity,
  isTickDrifted,
  scoreTickDrift,
  describeScheduledTickEvent,
  describeTickSchedulerHealth,
  isSchedulerHealthy,
  isSchedulerStopped,
  createPassthroughTickCallback,
  createTerminalTickCallback,
} from './contracts';
import type {
  TimeContractMLVector,
  TimeContractDLTensor,
  TimeContractChatSignal,
  TimeContractChatUrgency,
  TimeContractChatChannel,
  TimeContractMLFeatureLabel,
  TimeContractDLColLabel,
} from './contracts';

// ============================================================================
// SECTION 1 — MODULE METADATA
// ============================================================================

/** Scheduler version tag for audit payloads and diagnostics. */
const TICK_SCHEDULER_VERSION = '5.0.0' as const;

/** Ring buffer capacity for audit trail entries (200 ticks). */
const TICK_SCHEDULER_AUDIT_CAPACITY =
  DEFAULT_PHASE_TRANSITION_WINDOWS * 40;

/** Maximum DL tensor buffer rows (aligned with TIME_CONTRACT_DL_ROW_COUNT). */
const TICK_SCHEDULER_DL_CAPACITY = TIME_CONTRACT_DL_ROW_COUNT;

/** Drift alarm threshold above which a tick is classified as alarmed. */
const TICK_SCHEDULER_DRIFT_ALARM_MS =
  TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS;

/** Minimum budget ms before budget urgency is classified as warning. */
const TICK_SCHEDULER_BUDGET_WARNING_FLOOR =
  TIME_CONTRACT_BUDGET_THRESHOLDS.MIN_REMAINING_MS_FOR_CHAT;

/** Normalized mode tempo scalar for the default solo/Empire mode. */
const TICK_SCHEDULER_DEFAULT_MODE_TEMPO =
  TIME_CONTRACT_MODE_TEMPO['solo'];

/** Describes the contracts version this scheduler was built against. */
const TICK_SCHEDULER_CONTRACT_VERSION = TIME_CONTRACTS_VERSION.version;

// ============================================================================
// SECTION 2 — CORE PUBLIC INTERFACES (existing — must not change shape)
// ============================================================================

/** A request to arm the next tick at a specific duration and tier. */
export interface TickScheduleRequest {
  readonly durationMs: number;
  readonly tier: PressureTier;
  readonly reason?: string;
}

/**
 * The event emitted to the callback when a tick fires.
 * Contracts.ts type-imports this; keep shape stable.
 */
export interface ScheduledTickEvent {
  readonly tickNumber: number;
  readonly tier: PressureTier;
  readonly scheduledAtMs: number;
  readonly plannedDurationMs: number;
  readonly expectedFireAtMs: number;
  readonly firedAtMs: number;
  readonly driftMs: number;
  readonly reason?: string;
}

/**
 * Snapshot of the scheduler's observable state.
 * Contracts.ts type-imports this; keep shape stable.
 */
export interface TickSchedulerState {
  readonly tickNumber: number;
  readonly currentTier: PressureTier;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
  readonly isTickInFlight: boolean;
  readonly scheduledAtMs: number | null;
  readonly nextFireAtMs: number | null;
  readonly remainingMs: number | null;
  readonly lastPlannedDurationMs: number | null;
  readonly lastFiredAtMs: number | null;
}

/**
 * Callback type for the tick scheduler.
 * Return a new TickScheduleRequest to reschedule,
 * null to stop, or void/undefined to repeat with same request.
 */
export type TickSchedulerCallback = (
  event: ScheduledTickEvent,
) => TickScheduleRequest | null | void | Promise<TickScheduleRequest | null | void>;

// ============================================================================
// SECTION 3 — EXTENDED SUB-SYSTEM INTERFACES
// ============================================================================

/**
 * Optional run context the scheduler can hold for per-tick enrichment.
 * Consumers call TickScheduler.setRunContext() to inject these values.
 */
export interface TickSchedulerRunContext {
  readonly mode: ModeCode;
  readonly phase: RunPhase;
  readonly elapsedMs: number;
  readonly totalBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly seasonMultiplier?: number;
  readonly seasonLifecycle?: 'UNCONFIGURED' | 'UPCOMING' | 'ACTIVE' | 'ENDED';
  readonly holdPressure?: number;
  readonly holdExhausted?: boolean;
  readonly activeDecisionCount?: number;
  readonly decisionLatencyScore?: number;
}

/** A single entry in the audit ring buffer. */
export interface TickSchedulerAuditEntry {
  readonly seq: number;
  readonly tickNumber: number;
  readonly tier: PressureTier;
  readonly tickTier: TickTier;
  readonly plannedDurationMs: number;
  readonly actualDurationMs: number;
  readonly driftMs: number;
  readonly driftScore: number;
  readonly driftSeverityLabel: string;
  readonly isDrifted: boolean;
  readonly reason: string | undefined;
  readonly phase: RunPhase | null;
  readonly mode: ModeCode | null;
  readonly firingAtMs: number;
  readonly schedulerVersion: string;
}

/** A single drift measurement record. */
export interface TickSchedulerDriftRecord {
  readonly seq: number;
  readonly tickNumber: number;
  readonly driftMs: number;
  readonly driftScore: number;
  readonly isAlarmed: boolean;
  readonly severityLabel: string;
  readonly capturedAtMs: number;
}

/** Records a single tier transition event. */
export interface TickSchedulerTierTransition {
  readonly seq: number;
  readonly fromTier: PressureTier;
  readonly toTier: PressureTier;
  readonly fromTickTier: TickTier;
  readonly toTickTier: TickTier;
  readonly isEscalation: boolean;
  readonly interpolationTicks: number;
  readonly interpolationPlan: TickInterpolationPlan;
  readonly atTick: number;
  readonly atMs: number;
}

/** Resilience score snapshot produced by the ResilienceScorer. */
export interface TickSchedulerResilienceScore {
  readonly overall: number;
  readonly stabilityScore: number;
  readonly driftResilienceScore: number;
  readonly tierStabilityScore: number;
  readonly recoveryScore: number;
  readonly label: string;
  readonly recommendations: readonly string[];
  readonly computedAtTick: number;
}

/** Narrative output from the Narrator sub-system. */
export interface TickSchedulerNarration {
  readonly headline: string;
  readonly body: string;
  readonly urgencyLabel: string;
  readonly tierLabel: string;
  readonly phaseLabel: string;
  readonly modeLabel: string;
  readonly driftLabel: string;
  readonly tickLabel: string;
  readonly tags: readonly string[];
}

/** External ML context provided by the caller for full 28-dim extraction. */
export interface TickSchedulerMLContext {
  readonly phase: RunPhase;
  readonly mode: ModeCode;
  readonly tick: number;
  readonly elapsedMs: number;
  readonly totalBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly seasonMultiplier: number;
  readonly seasonActive: boolean;
  readonly seasonUtilization: number;
  readonly holdPressure: number;
  readonly holdExhausted: boolean;
  readonly activeDecisionCount: number;
  readonly expiredDecisionScore: number;
  readonly decisionLatencyScore: number;
  readonly projectionFinality: number;
  readonly budgetUrgency: number;
  readonly nowMs: number;
}

/** A DL tensor row built from scheduler state at one tick. */
export interface TickSchedulerDLRow {
  readonly tierUrgency: number;
  readonly budgetUtilization: number;
  readonly holdPressure: number;
  readonly driftScore: number;
  readonly sessionResidency: number;
  readonly compositePressure: number;
}

/** Chat emission produced by the ChatEmitter sub-system. */
export interface TickSchedulerChatEmission {
  readonly signalId: string;
  readonly channel: TimeContractChatChannel;
  readonly urgency: TimeContractChatUrgency;
  readonly headline: string;
  readonly body: string;
  readonly tier: PressureTier;
  readonly phase: RunPhase | null;
  readonly tick: number;
  readonly nowMs: number;
  readonly tags: readonly string[];
  readonly shouldInterruptChat: boolean;
  readonly shouldEscalate: boolean;
  readonly mlFeatures: Readonly<Float32Array> | null;
  readonly dlColLabels: typeof TIME_CONTRACT_DL_COL_LABELS;
}

/** Mode-specific scheduling profile used by ModeAdvisor. */
export interface TickSchedulerModeProfile {
  readonly mode: ModeCode;
  readonly modeNormalized: number;
  readonly difficultyMultiplier: number;
  readonly tensionFloor: number;
  readonly tempoMultiplier: number;
  readonly recommendedDurationsByTier: Readonly<Record<PressureTier, number>>;
  readonly recommendedDecisionWindowsByTier: Readonly<Record<PressureTier, number>>;
  readonly driftToleranceMs: number;
  readonly maxTickSkewMs: number;
  readonly schedulingLabel: string;
}

/** Phase-specific scheduling profile used by PhaseAdvisor. */
export interface TickSchedulerPhaseProfile {
  readonly phase: RunPhase;
  readonly phaseNormalized: number;
  readonly stakesMultiplier: number;
  readonly tickBudgetFraction: number;
  readonly phaseScore: number;
  readonly recommendedTighten: boolean;
  readonly advisedDurationMultiplier: number;
  readonly schedulingLabel: string;
}

/** Session-scoped tick statistics produced by SessionTracker. */
export interface TickSchedulerSessionState {
  readonly totalTicks: number;
  readonly averageDurationMs: number;
  readonly averageDriftMs: number;
  readonly tierTickCounts: Readonly<Record<PressureTier, number>>;
  readonly phaseTickCounts: Readonly<Record<RunPhase, number>>;
  readonly tierResidencyPct: Readonly<Record<PressureTier, number>>;
  readonly phaseResidencyPct: Readonly<Record<RunPhase, number>>;
  readonly peakTier: PressureTier;
  readonly dominantPhase: RunPhase;
  readonly driftAlarmCount: number;
  readonly tierEscalationCount: number;
  readonly tierDeEscalationCount: number;
  readonly startedAtMs: number | null;
  readonly lastTickAtMs: number | null;
}

/** Full analytics summary exposed by the Analytics sub-system. */
export interface TickSchedulerAnalyticsSummary {
  readonly version: string;
  readonly contractVersion: string;
  readonly sessionState: TickSchedulerSessionState;
  readonly resilience: TickSchedulerResilienceScore | null;
  readonly lastNarration: TickSchedulerNarration | null;
  readonly driftRecords: readonly TickSchedulerDriftRecord[];
  readonly tierTransitions: readonly TickSchedulerTierTransition[];
  readonly auditSize: number;
  readonly mlDim: number;
  readonly dlRows: number;
  readonly dlCols: number;
  readonly colLabels: typeof TIME_CONTRACT_DL_COL_LABELS;
  readonly mlFeatureLabels: typeof TIME_CONTRACT_ML_FEATURE_LABELS;
}

/** All sub-systems bundled together for external consumers. */
export interface TickSchedulerSubSystems {
  readonly auditTrail: TickSchedulerAuditTrail;
  readonly driftDetector: TickSchedulerDriftDetector;
  readonly tierTracker: TickSchedulerTierTracker;
  readonly resilienceScorer: TickSchedulerResilienceScorer;
  readonly narrator: TickSchedulerNarrator;
  readonly mlExtractor: TickSchedulerMLExtractor;
  readonly dlBuilder: TickSchedulerDLBuilder;
  readonly chatEmitter: TickSchedulerChatEmitter;
  readonly modeAdvisor: TickSchedulerModeAdvisor;
  readonly phaseAdvisor: TickSchedulerPhaseAdvisor;
  readonly sessionTracker: TickSchedulerSessionTracker;
  readonly analytics: TickSchedulerAnalytics;
}

// ============================================================================
// SECTION 4 — PRIVATE MODULE-LEVEL HELPERS
// ============================================================================

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function normalizeDurationMs(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Tick duration must be finite. Received: ${String(value)}`);
  }
  return Math.max(1, Math.trunc(value));
}

function isTickScheduleRequest(
  value: TickScheduleRequest | null | void,
): value is TickScheduleRequest {
  return value !== null && value !== undefined;
}

function tierToIndex(tier: PressureTier): number {
  const map: Record<PressureTier, number> = {
    T0: 0, T1: 1, T2: 2, T3: 3, T4: 4,
  };
  return map[tier];
}

function indexToTier(index: number): PressureTier {
  const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  return tiers[Math.max(0, Math.min(4, index))] ?? 'T1';
}

function isPressureTier(v: unknown): v is PressureTier {
  return v === 'T0' || v === 'T1' || v === 'T2' || v === 'T3' || v === 'T4';
}

function isModeCode(v: unknown): v is ModeCode {
  return v === 'solo' || v === 'pvp' || v === 'coop' || v === 'ghost';
}

function isRunPhase(v: unknown): v is RunPhase {
  return v === 'FOUNDATION' || v === 'ESCALATION' || v === 'SOVEREIGNTY';
}

// ============================================================================
// SECTION 5 — SUB-SYSTEM: TickSchedulerAuditTrail
// ============================================================================

/**
 * Ring-buffer audit log of every tick that has fired.
 * Capacity is capped at TICK_SCHEDULER_AUDIT_CAPACITY (200) entries.
 * Oldest entry is evicted when capacity is reached.
 *
 * Usage:
 *   const audit = new TickSchedulerAuditTrail();
 *   audit.record(entry);
 *   const last10 = audit.getLast(10);
 */
export class TickSchedulerAuditTrail {
  private readonly entries: TickSchedulerAuditEntry[] = [];
  private seq = 0;

  /** Maximum number of entries held in the ring buffer. */
  public readonly capacity: number = TICK_SCHEDULER_AUDIT_CAPACITY;

  /**
   * Records a new audit entry. If the buffer is at capacity the oldest
   * entry is removed before the new one is appended.
   */
  public record(entry: TickSchedulerAuditEntry): void {
    if (this.entries.length >= this.capacity) {
      this.entries.shift();
    }
    this.entries.push({ ...entry, seq: ++this.seq });
  }

  /**
   * Builds an audit entry from a ScheduledTickEvent plus optional run context.
   * Computes drift score and severity using contracts.ts utilities.
   */
  public buildEntry(
    event: ScheduledTickEvent,
    ctx: TickSchedulerRunContext | null,
  ): TickSchedulerAuditEntry {
    const driftScore = scoreTickDrift(event);
    const driftSeverityLabel = describeTickDriftSeverity(event);
    const isDrifted = isTickDrifted(event);
    const tickTierValue = pressureTierToTickTier(event.tier);
    const actualDurationMs = normalizeMs(
      event.firedAtMs - event.scheduledAtMs,
    );

    return {
      seq: this.seq + 1,
      tickNumber: event.tickNumber,
      tier: event.tier,
      tickTier: tickTierValue,
      plannedDurationMs: event.plannedDurationMs,
      actualDurationMs,
      driftMs: event.driftMs,
      driftScore,
      driftSeverityLabel,
      isDrifted,
      reason: event.reason,
      phase: ctx?.phase ?? null,
      mode: ctx?.mode ?? null,
      firingAtMs: event.firedAtMs,
      schedulerVersion: TICK_SCHEDULER_VERSION,
    };
  }

  /** Returns all entries in insertion order (oldest first). */
  public getAll(): readonly TickSchedulerAuditEntry[] {
    return Object.freeze([...this.entries]);
  }

  /** Returns the most recent `n` entries. */
  public getLast(n: number): readonly TickSchedulerAuditEntry[] {
    const safeN = clampNonNegativeInteger(n);
    return Object.freeze(this.entries.slice(-safeN));
  }

  /** Returns the number of entries currently held. */
  public getSize(): number {
    return this.entries.length;
  }

  /** Returns the average drift score (0–1) across all audit entries. */
  public getAverageDriftScore(): number {
    if (this.entries.length === 0) return 0;
    const sum = this.entries.reduce((acc, e) => acc + e.driftScore, 0);
    return clamp01(sum / this.entries.length);
  }

  /** Returns the entry with the highest drift score. */
  public getPeakDriftEntry(): TickSchedulerAuditEntry | null {
    if (this.entries.length === 0) return null;
    return this.entries.reduce(
      (peak, e) => (e.driftScore > peak.driftScore ? e : peak),
      this.entries[0]!,
    );
  }

  /** Returns all entries where drift was alarmed (severe+). */
  public getAlarmedEntries(): readonly TickSchedulerAuditEntry[] {
    return Object.freeze(
      this.entries.filter(
        (e) => Math.abs(e.driftMs) >= TICK_SCHEDULER_DRIFT_ALARM_MS,
      ),
    );
  }

  /**
   * Returns the count of ticks spent at each pressure tier.
   * Used by SessionTracker for residency analysis.
   */
  public getTierCounts(): Readonly<Record<PressureTier, number>> {
    const counts: Record<PressureTier, number> = {
      T0: 0, T1: 0, T2: 0, T3: 0, T4: 0,
    };
    for (const e of this.entries) {
      counts[e.tier]++;
    }
    return Object.freeze(counts);
  }

  /**
   * Returns the count of ticks spent in each run phase.
   * Phases without context are counted under 'FOUNDATION'.
   */
  public getPhaseCounts(): Readonly<Record<RunPhase, number>> {
    const counts: Record<RunPhase, number> = {
      FOUNDATION: 0, ESCALATION: 0, SOVEREIGNTY: 0,
    };
    for (const e of this.entries) {
      const phase: RunPhase = isRunPhase(e.phase) ? e.phase : 'FOUNDATION';
      counts[phase]++;
    }
    return Object.freeze(counts);
  }

  /** Clears all entries. Resets the sequence counter. */
  public clear(): void {
    this.entries.length = 0;
    this.seq = 0;
  }

  /**
   * Returns a brief text summary of the audit trail state.
   * Uses describeScheduledTickEvent for the last entry.
   */
  public describe(): string {
    if (this.entries.length === 0) return 'AuditTrail: empty';
    const last = this.entries[this.entries.length - 1]!;
    const synthetic: ScheduledTickEvent = {
      tickNumber: last.tickNumber,
      tier: last.tier,
      scheduledAtMs: last.firingAtMs - last.plannedDurationMs,
      plannedDurationMs: last.plannedDurationMs,
      expectedFireAtMs: last.firingAtMs - last.driftMs,
      firedAtMs: last.firingAtMs,
      driftMs: last.driftMs,
      reason: last.reason,
    };
    return `AuditTrail [${this.entries.length}/${this.capacity}]: ${describeScheduledTickEvent(synthetic)}`;
  }
}

// ============================================================================
// SECTION 6 — SUB-SYSTEM: TickSchedulerDriftDetector
// ============================================================================

/**
 * Real-time drift monitoring sub-system.
 * Tracks every tick's clock drift, scores severity, and escalates alarms
 * when drift breaches the SEVERE or CRITICAL thresholds.
 *
 * Drift alarm levels (from TIME_CONTRACT_TICK_DRIFT_THRESHOLDS):
 *   ACCEPTABLE ≤ 50ms    → on-time
 *   NOTABLE    ≤ 200ms   → notable drift
 *   SEVERE     ≤ 500ms   → severe drift (alarm threshold)
 *   CRITICAL   > 1000ms  → critical drift
 */
export class TickSchedulerDriftDetector {
  private readonly records: TickSchedulerDriftRecord[] = [];
  private seq = 0;
  private totalDriftMs = 0;
  private maxDriftMs = 0;
  private alarmCount = 0;
  private criticalCount = 0;

  /** Acceptable drift threshold in ms. */
  public readonly acceptableMs =
    TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.ACCEPTABLE_DRIFT_MS;

  /** Notable drift threshold in ms. */
  public readonly notableMs =
    TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS;

  /** Severe drift alarm threshold in ms. */
  public readonly severeMs =
    TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS;

  /** Critical drift threshold in ms. */
  public readonly criticalMs =
    TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.CRITICAL_DRIFT_MS;

  /**
   * Records a tick event's drift measurement.
   * Computes score and alarm state using contracts utilities.
   */
  public record(event: ScheduledTickEvent, nowMs: number): void {
    const absDrift = Math.abs(event.driftMs);
    const driftScore = scoreTickDrift(event);
    const isDrifted = isTickDrifted(event);
    const isAlarmed = absDrift >= this.severeMs;
    const isCritical = absDrift >= this.criticalMs;
    const severityLabel = describeTickDriftSeverity(event);

    if (isAlarmed) this.alarmCount++;
    if (isCritical) this.criticalCount++;

    this.totalDriftMs += absDrift;
    if (absDrift > this.maxDriftMs) this.maxDriftMs = absDrift;

    const record: TickSchedulerDriftRecord = {
      seq: ++this.seq,
      tickNumber: event.tickNumber,
      driftMs: event.driftMs,
      driftScore,
      isAlarmed,
      severityLabel,
      capturedAtMs: nowMs,
    };

    if (this.records.length >= 100) this.records.shift();
    this.records.push(record);

    // Unused flag intentionally surfaced for drift-aware tooling:
    void isDrifted;
  }

  /** Returns average drift in absolute milliseconds across all recorded ticks. */
  public getAverageDriftMs(): number {
    if (this.records.length === 0) return 0;
    return this.totalDriftMs / this.records.length;
  }

  /** Returns the maximum absolute drift observed this session. */
  public getMaxDriftMs(): number {
    return this.maxDriftMs;
  }

  /** Returns the normalized drift score (0–1) using average drift. */
  public getDriftScore(): number {
    const avgMs = this.getAverageDriftMs();
    return clamp01(avgMs / this.criticalMs);
  }

  /** Returns true if average drift is above the severe threshold. */
  public isDriftCritical(): boolean {
    return this.getAverageDriftMs() >= this.severeMs;
  }

  /** Returns the total number of drift alarm events recorded. */
  public getAlarmCount(): number {
    return this.alarmCount;
  }

  /** Returns the total number of critical drift events recorded. */
  public getCriticalCount(): number {
    return this.criticalCount;
  }

  /** Returns the most recent N drift records. */
  public getRecentRecords(n = 10): readonly TickSchedulerDriftRecord[] {
    return Object.freeze(
      this.records.slice(-Math.max(0, Math.trunc(n))),
    );
  }

  /**
   * Returns the drift trend over the last N records.
   * +1 = worsening, 0 = stable, -1 = improving.
   */
  public getDriftTrend(windowSize = 5): -1 | 0 | 1 {
    const window = this.getRecentRecords(windowSize);
    if (window.length < 2) return 0;
    const first = Math.abs(window[0]!.driftMs);
    const last = Math.abs(window[window.length - 1]!.driftMs);
    const delta = last - first;
    if (Math.abs(delta) < 20) return 0;
    return delta > 0 ? 1 : -1;
  }

  /**
   * Returns a human-readable health summary for UX consumers.
   * Incorporates TIME_CONTRACT_TICK_DRIFT_THRESHOLDS labels.
   */
  public describeDriftHealth(): string {
    const avg = this.getAverageDriftMs();
    const severity =
      avg <= this.acceptableMs
        ? 'on-time'
        : avg <= this.notableMs
          ? 'notable drift'
          : avg <= this.severeMs
            ? 'severe drift'
            : 'critical drift';

    const trend = this.getDriftTrend();
    const trendLabel =
      trend === 1 ? '↑ worsening' : trend === -1 ? '↓ improving' : '→ stable';

    return [
      `Drift: ${avg.toFixed(1)}ms avg (${severity})`,
      `max: ${this.maxDriftMs}ms`,
      `alarms: ${this.alarmCount}`,
      `trend: ${trendLabel}`,
    ].join(' | ');
  }

  /** Resets all drift state. */
  public reset(): void {
    this.records.length = 0;
    this.seq = 0;
    this.totalDriftMs = 0;
    this.maxDriftMs = 0;
    this.alarmCount = 0;
    this.criticalCount = 0;
  }
}

// ============================================================================
// SECTION 7 — SUB-SYSTEM: TickSchedulerTierTracker
// ============================================================================

/**
 * Tracks all tier transitions across the scheduler's lifetime.
 * Records escalation/de-escalation events with interpolation metadata.
 * Exposes residency counts for ML consumption.
 *
 * Tier ordering:  T0 (best) → T4 (worst)
 * Escalation:     tier index increases (T1 → T2)
 * De-escalation:  tier index decreases (T3 → T2)
 */
export class TickSchedulerTierTracker {
  private readonly transitions: TickSchedulerTierTransition[] = [];
  private seq = 0;
  private escalationCount = 0;
  private deEscalationCount = 0;
  private currentTierSince = 0;

  /**
   * Records a tier transition. Computes whether this is an escalation,
   * builds the interpolation plan, and counts the event.
   */
  public recordTransition(
    from: PressureTier,
    to: PressureTier,
    atTick: number,
    atMs: number,
  ): void {
    const fromTickTier = pressureTierToTickTier(from);
    const toTickTier = pressureTierToTickTier(to);
    const fromIdx = tierToIndex(from);
    const toIdx = tierToIndex(to);
    const isEscalation = toIdx > fromIdx;

    const fromDurationMs = TIER_DURATIONS_MS[from];
    const toDurationMs = TIER_DURATIONS_MS[to];
    const interpolationTicks = computeInterpolationTickCount(
      Math.abs(toDurationMs - fromDurationMs),
    );
    const plan = createInterpolationPlan(
      fromTickTier, toTickTier, fromDurationMs, toDurationMs,
    );

    if (isEscalation) {
      this.escalationCount++;
    } else {
      this.deEscalationCount++;
    }

    const transition: TickSchedulerTierTransition = {
      seq: ++this.seq,
      fromTier: from,
      toTier: to,
      fromTickTier,
      toTickTier,
      isEscalation,
      interpolationTicks,
      interpolationPlan: plan,
      atTick,
      atMs,
    };

    if (this.transitions.length >= 100) this.transitions.shift();
    this.transitions.push(transition);
    this.currentTierSince = atTick;
  }

  /**
   * Returns the number of ticks spent at the current tier
   * since the last transition.
   */
  public getTicksSinceLastTransition(currentTick: number): number {
    return clampNonNegativeInteger(currentTick - this.currentTierSince);
  }

  /**
   * Returns whether the current tier has been held long enough
   * to permit escalation, per PRESSURE_TIER_MIN_HOLD_TICKS.
   */
  public isHoldSatisfied(
    tier: PressureTier,
    currentTick: number,
  ): boolean {
    const ticksHeld = this.getTicksSinceLastTransition(currentTick);
    return ticksHeld >= PRESSURE_TIER_MIN_HOLD_TICKS[tier];
  }

  /** Returns all tier transitions recorded this session. */
  public getTransitions(): readonly TickSchedulerTierTransition[] {
    return Object.freeze([...this.transitions]);
  }

  /** Returns the most recent N transitions. */
  public getRecentTransitions(
    n: number,
  ): readonly TickSchedulerTierTransition[] {
    return Object.freeze(
      this.transitions.slice(-clampNonNegativeInteger(n)),
    );
  }

  /** Returns total number of escalation events. */
  public getEscalationCount(): number {
    return this.escalationCount;
  }

  /** Returns total number of de-escalation events. */
  public getDeEscalationCount(): number {
    return this.deEscalationCount;
  }

  /**
   * Returns the TickTierConfig for a given tier using TICK_TIER_CONFIGS.
   * Used by callers that need min/max/default durations for the tier.
   */
  public getTierConfig(tier: PressureTier): TickTierConfig {
    return getTickTierConfigByPressureTier(tier);
  }

  /**
   * Returns the TickTier enum value for a PressureTier.
   * Uses TICK_TIER_BY_PRESSURE_TIER lookup.
   */
  public toTickTier(tier: PressureTier): TickTier {
    return TICK_TIER_BY_PRESSURE_TIER[tier];
  }

  /**
   * Returns the PressureTier for a TickTier enum value.
   * Uses PRESSURE_TIER_BY_TICK_TIER lookup.
   */
  public toPressureTier(tier: TickTier): PressureTier {
    return PRESSURE_TIER_BY_TICK_TIER[tier];
  }

  /**
   * Returns the escalation ratio (escalations / total transitions).
   * Returns 0 if no transitions recorded.
   */
  public getEscalationRatio(): number {
    const total = this.escalationCount + this.deEscalationCount;
    if (total === 0) return 0;
    return clamp01(this.escalationCount / total);
  }

  /**
   * Returns a trend description for tier movement over last N transitions.
   * Uses createInterpolationPlan data to determine direction.
   */
  public describeTierTrend(windowSize = 5): string {
    const recent = this.getRecentTransitions(windowSize);
    if (recent.length === 0) return 'No tier transitions recorded';

    const escalations = recent.filter((t) => t.isEscalation).length;
    const deescalations = recent.filter((t) => !t.isEscalation).length;

    if (escalations > deescalations) {
      return `Pressure escalating (${escalations}↑ / ${deescalations}↓ in last ${recent.length} transitions)`;
    }
    if (deescalations > escalations) {
      return `Pressure recovering (${deescalations}↓ / ${escalations}↑ in last ${recent.length} transitions)`;
    }
    return `Tier stable (${recent.length} oscillations)`;
  }

  /** Resets all transition state. */
  public reset(): void {
    this.transitions.length = 0;
    this.seq = 0;
    this.escalationCount = 0;
    this.deEscalationCount = 0;
    this.currentTierSince = 0;
  }
}

// ============================================================================
// SECTION 8 — SUB-SYSTEM: TickSchedulerResilienceScorer
// ============================================================================

/**
 * Computes cadence stability and resilience scores (all 0–1).
 *
 * Scoring dimensions:
 *   stabilityScore      — how consistent the tick duration has been
 *   driftResilienceScore — inverse of drift severity (1 = zero drift)
 *   tierStabilityScore  — inverse of escalation ratio (1 = no escalations)
 *   recoveryScore       — measures de-escalation speed relative to hold ticks
 *   overall             — weighted composite of above four
 *
 * Weights:
 *   stability  × 0.30
 *   drift      × 0.25
 *   tier       × 0.25
 *   recovery   × 0.20
 */
export class TickSchedulerResilienceScorer {
  /**
   * Computes a full resilience score from audit and tier data.
   */
  public score(
    auditTrail: TickSchedulerAuditTrail,
    driftDetector: TickSchedulerDriftDetector,
    tierTracker: TickSchedulerTierTracker,
    currentTick: number,
  ): TickSchedulerResilienceScore {
    const stabilityScore = this.computeStabilityScore(auditTrail);
    const driftResilienceScore =
      this.computeDriftResilienceScore(driftDetector);
    const tierStabilityScore =
      this.computeTierStabilityScore(tierTracker);
    const recoveryScore = this.computeRecoveryScore(
      tierTracker,
      currentTick,
    );

    const overall = clamp01(
      stabilityScore * 0.3 +
        driftResilienceScore * 0.25 +
        tierStabilityScore * 0.25 +
        recoveryScore * 0.2,
    );

    const label =
      overall >= 0.85
        ? 'Excellent'
        : overall >= 0.7
          ? 'Good'
          : overall >= 0.5
            ? 'Fair'
            : overall >= 0.3
              ? 'Poor'
              : 'Critical';

    const recommendations = this.buildRecommendations(
      stabilityScore,
      driftResilienceScore,
      tierStabilityScore,
      recoveryScore,
    );

    return Object.freeze({
      overall,
      stabilityScore,
      driftResilienceScore,
      tierStabilityScore,
      recoveryScore,
      label,
      recommendations,
      computedAtTick: currentTick,
    });
  }

  /**
   * Stability score: measures variance in actual tick duration.
   * Uses TICK_TIER_CONFIGS min/max ranges as reference band.
   * Score of 1 = all ticks fired within their tier's min–max band.
   */
  public computeStabilityScore(
    auditTrail: TickSchedulerAuditTrail,
  ): number {
    const entries = auditTrail.getLast(20);
    if (entries.length === 0) return 1.0;

    let inBandCount = 0;
    for (const entry of entries) {
      const cfg = getTickTierConfig(entry.tickTier);
      const inBand =
        entry.actualDurationMs >= cfg.minDurationMs &&
        entry.actualDurationMs <= cfg.maxDurationMs;
      if (inBand) inBandCount++;
    }
    return clamp01(inBandCount / entries.length);
  }

  /**
   * Drift resilience score: 1 - normalized average drift.
   * References PRESSURE_TIER_NORMALIZED for tier weighting.
   */
  public computeDriftResilienceScore(
    driftDetector: TickSchedulerDriftDetector,
  ): number {
    const driftScore = driftDetector.getDriftScore();
    // Invert: high drift = low resilience
    return clamp01(1.0 - driftScore);
  }

  /**
   * Tier stability score: 1 - escalation ratio with PRESSURE_TIER_NORMALIZED weighting.
   * A T4 escalation costs more than a T2→T3 escalation.
   */
  public computeTierStabilityScore(
    tierTracker: TickSchedulerTierTracker,
  ): number {
    const escalationRatio = tierTracker.getEscalationRatio();
    const recentTransitions = tierTracker.getRecentTransitions(10);

    if (recentTransitions.length === 0) return 1.0;

    // Weight escalation cost by target tier severity
    let weightedCost = 0;
    let maxCost = 0;
    for (const t of recentTransitions) {
      const tierNorm = PRESSURE_TIER_NORMALIZED[t.toTier];
      weightedCost += t.isEscalation ? tierNorm : 0;
      maxCost += tierNorm;
    }

    const weightedEscalationScore =
      maxCost > 0 ? clamp01(weightedCost / maxCost) : escalationRatio;

    return clamp01(1.0 - weightedEscalationScore);
  }

  /**
   * Recovery score: measures whether de-escalations happen quickly.
   * Uses DEFAULT_HOLD_DURATION_MS as baseline recovery expectation.
   */
  public computeRecoveryScore(
    tierTracker: TickSchedulerTierTracker,
    currentTick: number,
  ): number {
    const recentTransitions = tierTracker.getRecentTransitions(10);
    if (recentTransitions.length === 0) return 1.0;

    const deEscalations = recentTransitions.filter((t) => !t.isEscalation);
    if (deEscalations.length === 0) return 0.3;

    // Higher recovery score = de-escalations that happen quickly
    // Use DEFAULT_HOLD_DURATION_MS / 1000ms as "fast recovery" reference
    const fastRecoveryTicks = Math.ceil(DEFAULT_HOLD_DURATION_MS / 1000);
    let fastCount = 0;
    for (let i = 0; i < deEscalations.length - 1; i++) {
      const gap = (deEscalations[i + 1]?.atTick ?? currentTick) - (deEscalations[i]?.atTick ?? 0);
      if (gap <= fastRecoveryTicks) fastCount++;
    }

    // Normalize: more fast recoveries = better score
    return clamp01(0.3 + 0.7 * (fastCount / Math.max(1, deEscalations.length - 1)));
  }

  private buildRecommendations(
    stability: number,
    driftResilience: number,
    tierStability: number,
    recovery: number,
  ): readonly string[] {
    const recs: string[] = [];
    if (stability < 0.5) {
      recs.push(
        'Tick duration variance too high — check event loop saturation',
      );
    }
    if (driftResilience < 0.5) {
      recs.push(
        'Clock drift exceeding acceptable range — investigate timer resolution',
      );
    }
    if (tierStability < 0.5) {
      recs.push(
        'Frequent tier escalations — pressure engine may need rebalancing',
      );
    }
    if (recovery < 0.4) {
      recs.push(
        'Slow tier recovery — de-escalation triggers may be miscalibrated',
      );
    }
    if (recs.length === 0) {
      recs.push('Cadence is healthy — no interventions recommended');
    }
    return Object.freeze(recs);
  }
}

// ============================================================================
// SECTION 9 — SUB-SYSTEM: TickSchedulerNarrator
// ============================================================================

/**
 * Generates human-readable UX narratives for tick events, tier transitions,
 * and scheduler health. Drives in-game chat lane LIVEOPS_TICK signals.
 *
 * All narrative output is derived from:
 *   - PRESSURE_TIER_URGENCY_LABEL (tier → human label)
 *   - TICK_TIER_CONFIGS (visual config, audio signals)
 *   - describeTickSchedulerHealth (health description)
 *   - describeScheduledTickEvent (tick event description)
 *   - TIME_CONTRACT_HOLD_RESULT_LABELS (hold state narration)
 *   - TIME_CONTRACT_SEASON_LIFECYCLE_LABEL (season context narration)
 */
export class TickSchedulerNarrator {

  /**
   * Narrates a single tick event with mode and phase context.
   * Produces the headline/body for the LIVEOPS_TICK signal.
   */
  public narrateTick(
    event: ScheduledTickEvent,
    phase: RunPhase,
    mode: ModeCode,
  ): TickSchedulerNarration {
    const tierLabel = PRESSURE_TIER_URGENCY_LABEL[event.tier];
    const tierConfig = getTickTierConfigByPressureTier(event.tier);
    const driftLabel = describeTickDriftSeverity(event);
    const modeLabel = this.describeModeLabel(mode);
    const phaseLabel = this.describePhaseLabel(phase);
    const tickLabel = describeScheduledTickEvent(event);

    const headline = this.buildTickHeadline(event, tierLabel, phaseLabel);
    const body = this.buildTickBody(
      event,
      tierConfig,
      driftLabel,
      modeLabel,
      phaseLabel,
    );

    const urgencyLabel = this.deriveUrgencyLabel(event.tier);
    const tags = this.buildTickTags(event, phase, mode);

    return Object.freeze({
      headline,
      body,
      urgencyLabel,
      tierLabel,
      phaseLabel,
      modeLabel,
      driftLabel,
      tickLabel,
      tags,
    });
  }

  /**
   * Narrates a tier transition event.
   * Incorporates mode difficulty multiplier for intensity framing.
   */
  public narrateTierTransition(
    from: PressureTier,
    to: PressureTier,
    mode: ModeCode,
    tick: number,
  ): string {
    const fromLabel = PRESSURE_TIER_URGENCY_LABEL[from];
    const toLabel = PRESSURE_TIER_URGENCY_LABEL[to];
    const fromIdx = tierToIndex(from);
    const toIdx = tierToIndex(to);
    const difficultyMult = MODE_DIFFICULTY_MULTIPLIER[mode];
    const isEscalation = toIdx > fromIdx;
    const direction = isEscalation ? 'escalating' : 'recovering';
    const toConfig = getTickTierConfigByPressureTier(to);
    const intensity =
      difficultyMult >= 1.4 ? 'sharply' : difficultyMult >= 1.1 ? 'steadily' : 'gently';

    const audioNote =
      toConfig.audioSignal !== null
        ? ` Audio cue: ${toConfig.audioSignal}.`
        : '';
    const shakeNote = toConfig.screenShake ? ' Screen shake active.' : '';

    return (
      `Tick ${tick}: Tier ${direction} ${intensity} from ${fromLabel} (${from}) to ${toLabel} (${to}).` +
      ` Mode: ${mode} (difficulty ×${difficultyMult.toFixed(2)}).` +
      ` New cadence: ${toConfig.defaultDurationMs}ms.` +
      audioNote +
      shakeNote
    );
  }

  /**
   * Narrates hold state for UI awareness.
   * Uses TIME_CONTRACT_HOLD_RESULT_LABELS for canonical text.
   */
  public narrateHoldState(
    holdResultCode: keyof typeof TIME_CONTRACT_HOLD_RESULT_LABELS,
    windowId: string,
  ): string {
    const label = TIME_CONTRACT_HOLD_RESULT_LABELS[holdResultCode];
    return `Hold (window ${windowId}): ${label}`;
  }

  /**
   * Narrates season lifecycle context for LIVEOPS signals.
   * Uses TIME_CONTRACT_SEASON_LIFECYCLE_LABEL for canonical text.
   */
  public narrateSeasonContext(
    lifecycle: keyof typeof TIME_CONTRACT_SEASON_LIFECYCLE_LABEL,
    pressureMultiplier: number,
  ): string {
    const label = TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[lifecycle];
    return pressureMultiplier > 1.0
      ? `${label} — pressure boost ×${pressureMultiplier.toFixed(2)}`
      : label;
  }

  /**
   * Generates a scheduler health narration from the state snapshot.
   * Wraps describeTickSchedulerHealth from contracts.ts.
   */
  public narrateSchedulerHealth(state: TickSchedulerState): string {
    return describeTickSchedulerHealth(state);
  }

  /**
   * Builds a full narration from current scheduler state, phase, and mode.
   * Used as the primary narration entry point from TickScheduler.tick().
   */
  public buildNarration(
    state: TickSchedulerState,
    lastEvent: ScheduledTickEvent | null,
    phase: RunPhase,
    mode: ModeCode,
  ): TickSchedulerNarration {
    if (lastEvent === null) {
      return Object.freeze({
        headline: `Scheduler ready — ${mode}/${phase}`,
        body: describeTickSchedulerHealth(state),
        urgencyLabel: 'AMBIENT',
        tierLabel: PRESSURE_TIER_URGENCY_LABEL[state.currentTier],
        phaseLabel: this.describePhaseLabel(phase),
        modeLabel: this.describeModeLabel(mode),
        driftLabel: 'no data',
        tickLabel: `Tick #${state.tickNumber} (${state.currentTier})`,
        tags: Object.freeze([`tier:${state.currentTier}`, `phase:${phase}`, `mode:${mode}`]),
      });
    }
    return this.narrateTick(lastEvent, phase, mode);
  }

  private buildTickHeadline(
    event: ScheduledTickEvent,
    tierLabel: string,
    phaseLabel: string,
  ): string {
    if (event.tier === 'T4') {
      return `COLLAPSE IMMINENT — Tick #${event.tickNumber} — ${tierLabel}`;
    }
    if (event.tier === 'T3') {
      return `Crisis tick #${event.tickNumber} — ${tierLabel} — ${phaseLabel}`;
    }
    return `Tick #${event.tickNumber} — ${tierLabel} — ${phaseLabel}`;
  }

  private buildTickBody(
    event: ScheduledTickEvent,
    config: TickTierConfig,
    driftLabel: string,
    modeLabel: string,
    phaseLabel: string,
  ): string {
    const lines: string[] = [
      `Duration: ${event.plannedDurationMs}ms (window: ${config.decisionWindowMs}ms)`,
      `Drift: ${event.driftMs}ms (${driftLabel})`,
      `Mode: ${modeLabel} | Phase: ${phaseLabel}`,
    ];
    if (config.screenShake) lines.push('⚠ Screen shake active');
    if (event.reason !== undefined) lines.push(`Reason: ${event.reason}`);
    return lines.join('\n');
  }

  private deriveUrgencyLabel(tier: PressureTier): string {
    if (tier === 'T4') return 'CRITICAL';
    if (tier === 'T3') return 'URGENT';
    if (tier === 'T2') return 'ELEVATED';
    if (tier === 'T1') return 'NOTEWORTHY';
    return 'AMBIENT';
  }

  private describeModeLabel(mode: ModeCode): string {
    const names: Record<ModeCode, string> = {
      solo: 'Empire (Solo)',
      pvp: 'Predator (Head to Head)',
      coop: 'Syndicate (Team Up)',
      ghost: 'Phantom (Chase a Legend)',
    };
    return names[mode];
  }

  private describePhaseLabel(phase: RunPhase): string {
    const labels: Record<RunPhase, string> = {
      FOUNDATION: 'Foundation',
      ESCALATION: 'Escalation',
      SOVEREIGNTY: 'Sovereignty',
    };
    return labels[phase];
  }

  private buildTickTags(
    event: ScheduledTickEvent,
    phase: RunPhase,
    mode: ModeCode,
  ): readonly string[] {
    const tags: string[] = [
      `tier:${event.tier}`,
      `phase:${phase}`,
      `mode:${mode}`,
      `tick:${event.tickNumber}`,
    ];
    if (isTickDrifted(event)) tags.push('drift:notable');
    if (event.tier === 'T4') tags.push('collapse:imminent');
    if (event.tier === 'T3' || event.tier === 'T4') tags.push('endgame:open');
    if (event.reason !== undefined) tags.push(`reason:${event.reason}`);
    return Object.freeze(tags);
  }
}

// ============================================================================
// SECTION 10 — SUB-SYSTEM: TickSchedulerMLExtractor
// ============================================================================

/**
 * Extracts a 28-dimensional TimeContractMLVector from scheduler state.
 * Feature layout is aligned with TIME_CONTRACT_ML_FEATURE_LABELS.
 *
 * Features the scheduler directly provides (from its own state):
 *   0:  tier_urgency              — TIME_CONTRACT_TIER_URGENCY[tier]
 *   1:  phase_score               — TIME_CONTRACT_PHASE_SCORE[phase]
 *   2:  cadence_duration_norm     — plannedDurationMs / MAX_TICK_DURATION_MS
 *   3:  decision_window_norm      — decisionWindowMs / MAX_DECISION_WINDOW_MS
 *   5:  mode_tempo                — TIME_CONTRACT_MODE_TEMPO[mode]
 *   13: tick_drift_score          — from DriftDetector
 *   14: scheduler_health          — isSchedulerHealthy() ? 1 : 0
 *   19: screen_shake_flag         — tier === T4
 *   20: endgame_window_flag       — tier === T3 || T4
 *   26: tick_drift_flag           — from DriftDetector.isDriftCritical()
 *
 * Features from caller-provided MLContext:
 *   4:  season_multiplier         — (seasonMultiplier - 1) / 3.0
 *   6:  budget_tempo              — from context
 *   7:  remaining_budget_norm     — remainingBudgetMs / MAX_BUDGET_MS
 *   8:  timeout_pressure          — elapsedMs / totalBudgetMs
 *   9:  budget_utilization        — (totalBudget - remaining) / total
 *   10: hold_pressure             — from context
 *   11: active_decision_count     — activeDecisionCount / 5.0
 *   12: expired_decision_score    — from context
 *   15: season_pressure           — clamp01((mult - 1.0) / 3.0)
 *   16: season_utilization        — from context
 *   17: decision_latency_score    — decisionLatencyScore / ALARM_MS
 *   18: projection_finality       — from context
 *   21: interpolation_flag        — from tier transition active
 *   22: season_active_flag        — seasonLifecycle === 'ACTIVE'
 *   23: hold_exhausted_flag       — holdExhausted flag
 *   24: budget_critical_flag      — utilization >= CRITICAL_PCT
 *   25: timeout_critical_flag     — timeoutPressure >= 0.9
 *   27: telemetry_event_density   — tick / 500
 */
export class TickSchedulerMLExtractor {

  /**
   * Extracts a full 28-dim TimeContractMLVector from scheduler + external context.
   * The returned features array is normalized to [0.0, 1.0] for all dimensions.
   */
  public extract(
    state: TickSchedulerState,
    lastEvent: ScheduledTickEvent | null,
    driftDetector: TickSchedulerDriftDetector,
    tierTracker: TickSchedulerTierTracker,
    ctx: TickSchedulerMLContext,
  ): TimeContractMLVector {
    const features = new Float32Array(TIME_CONTRACT_ML_DIM);

    // Feature 0: tier_urgency
    features[0] = TIME_CONTRACT_TIER_URGENCY[state.currentTier];

    // Feature 1: phase_score
    features[1] = TIME_CONTRACT_PHASE_SCORE[ctx.phase];

    // Feature 2: cadence_duration_normalized
    const plannedDuration = lastEvent?.plannedDurationMs ??
      getDefaultTickDurationMs(state.currentTier);
    features[2] = clamp01(plannedDuration / TIME_CONTRACT_MAX_TICK_DURATION_MS);

    // Feature 3: decision_window_normalized
    features[3] = clamp01(
      getDecisionWindowDurationMs(state.currentTier) /
        TIME_CONTRACT_MAX_DECISION_WINDOW_MS,
    );

    // Feature 4: season_multiplier (normalized)
    features[4] = clamp01((ctx.seasonMultiplier - 1.0) / 3.0);

    // Feature 5: mode_tempo
    features[5] = clamp01(TIME_CONTRACT_MODE_TEMPO[ctx.mode] / 1.5);

    // Feature 6: budget_tempo (approx from remaining budget ratio)
    const budgetRatio =
      ctx.totalBudgetMs > 0
        ? ctx.remainingBudgetMs / ctx.totalBudgetMs
        : 1.0;
    features[6] = clamp01(1.0 + (1.0 - budgetRatio) * 0.5); // 1.0 to 1.5 range normalized

    // Feature 7: remaining_budget_normalized
    features[7] = clamp01(ctx.remainingBudgetMs / TIME_CONTRACT_MAX_BUDGET_MS);

    // Feature 8: timeout_pressure
    const timeoutPressure =
      ctx.totalBudgetMs > 0
        ? clamp01(ctx.elapsedMs / ctx.totalBudgetMs)
        : 0;
    features[8] = timeoutPressure;

    // Feature 9: budget_utilization
    const budgetUtil =
      ctx.totalBudgetMs > 0
        ? clamp01(
            (ctx.totalBudgetMs - ctx.remainingBudgetMs) / ctx.totalBudgetMs,
          )
        : 0;
    features[9] = budgetUtil;

    // Feature 10: hold_pressure
    features[10] = clamp01(ctx.holdPressure);

    // Feature 11: active_decision_count (normalized to max 5)
    features[11] = clamp01(ctx.activeDecisionCount / 5.0);

    // Feature 12: expired_decision_score
    features[12] = clamp01(ctx.expiredDecisionScore);

    // Feature 13: tick_drift_score
    features[13] = driftDetector.getDriftScore();

    // Feature 14: scheduler_health
    features[14] = isSchedulerHealthy(state) ? 1.0 : 0.0;

    // Feature 15: season_pressure
    features[15] = clamp01((ctx.seasonMultiplier - 1.0) / 3.0);

    // Feature 16: season_utilization
    features[16] = clamp01(ctx.seasonUtilization);

    // Feature 17: decision_latency_score
    features[17] = clamp01(
      ctx.decisionLatencyScore /
        TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS,
    );

    // Feature 18: projection_finality
    features[18] = clamp01(ctx.projectionFinality);

    // Feature 19: screen_shake_flag
    features[19] = state.currentTier === 'T4' ? 1.0 : 0.0;

    // Feature 20: endgame_window_flag
    features[20] =
      state.currentTier === 'T3' || state.currentTier === 'T4' ? 1.0 : 0.0;

    // Feature 21: interpolation_flag — active if a transition happened recently
    const recentTransitions = tierTracker.getRecentTransitions(1);
    features[21] =
      recentTransitions.length > 0 &&
      recentTransitions[0]!.interpolationTicks > 0
        ? 1.0
        : 0.0;

    // Feature 22: season_active_flag
    features[22] = ctx.seasonActive ? 1.0 : 0.0;

    // Feature 23: hold_exhausted_flag
    features[23] = ctx.holdExhausted ? 1.0 : 0.0;

    // Feature 24: budget_critical_flag
    features[24] =
      budgetUtil >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT ? 1.0 : 0.0;

    // Feature 25: timeout_critical_flag
    features[25] = timeoutPressure >= 0.9 ? 1.0 : 0.0;

    // Feature 26: tick_drift_flag
    features[26] = driftDetector.isDriftCritical() ? 1.0 : 0.0;

    // Feature 27: telemetry_event_density (tick count / 500)
    features[27] = clamp01(ctx.tick / 500);

    return Object.freeze({
      features: Object.freeze(features) as Readonly<Float32Array>,
      labels: TIME_CONTRACT_ML_FEATURE_LABELS,
      tier: state.currentTier,
      phase: ctx.phase,
      tick: ctx.tick,
      extractedAtMs: ctx.nowMs,
    });
  }

  /**
   * Returns the feature label at a given index.
   * Type-safe accessor for TIME_CONTRACT_ML_FEATURE_LABELS.
   */
  public getFeatureLabel(index: number): TimeContractMLFeatureLabel | null {
    const label = TIME_CONTRACT_ML_FEATURE_LABELS[index];
    return label ?? null;
  }

  /**
   * Describes the ML vector for debug/chat output.
   */
  public describeVector(vector: TimeContractMLVector): string {
    const topFeatures: string[] = [];
    for (let i = 0; i < Math.min(5, vector.features.length); i++) {
      const label = TIME_CONTRACT_ML_FEATURE_LABELS[i] ?? `feat_${i}`;
      topFeatures.push(`${label}: ${(vector.features[i] ?? 0).toFixed(3)}`);
    }
    return [
      `ML[28] tier:${vector.tier} phase:${vector.phase} tick:${vector.tick}`,
      topFeatures.join(', '),
    ].join(' | ');
  }
}

// ============================================================================
// SECTION 11 — SUB-SYSTEM: TickSchedulerDLBuilder
// ============================================================================

/**
 * Maintains a 40×6 rolling DL tensor aligned with TIME_CONTRACT_DL_COL_LABELS.
 *
 * Column layout (6 columns):
 *   0: tier_urgency       — TIME_CONTRACT_TIER_URGENCY[tier]
 *   1: budget_utilization — (total - remaining) / total
 *   2: hold_pressure      — from context
 *   3: season_pressure    — (seasonMultiplier - 1.0) / 3.0
 *   4: decision_urgency   — active decision pressure
 *   5: composite_pressure — weighted composite of cols 0–4
 *
 * The oldest row is evicted when the buffer reaches TICK_SCHEDULER_DL_CAPACITY (40).
 */
export class TickSchedulerDLBuilder {
  private data: Float32Array = new Float32Array(
    TICK_SCHEDULER_DL_CAPACITY * TIME_CONTRACT_DL_COL_COUNT,
  );
  private filledRows = 0;
  private headTick = 0;
  private lastTier: PressureTier = 'T1';
  private lastPhase: RunPhase = 'FOUNDATION';
  private lastMs = 0;

  /** Returns the number of rows currently filled (0 to 40). */
  public getFilledRows(): number {
    return this.filledRows;
  }

  /**
   * Appends a new row to the DL tensor.
   * Shifts existing rows up (evicts oldest) when at capacity.
   */
  public appendRow(
    state: TickSchedulerState,
    ctx: {
      readonly phase: RunPhase;
      readonly totalBudgetMs: number;
      readonly remainingBudgetMs: number;
      readonly seasonMultiplier: number;
      readonly holdPressure: number;
      readonly activeDecisionScore: number;
      readonly nowMs: number;
    },
  ): void {
    const rows = TICK_SCHEDULER_DL_CAPACITY;
    const cols = TIME_CONTRACT_DL_COL_COUNT;

    // Shift all existing rows up by one (evict oldest)
    if (this.filledRows >= rows) {
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          this.data[r * cols + c] = this.data[(r + 1) * cols + c]!;
        }
      }
    } else {
      this.filledRows++;
    }

    // Build the new row (at last position)
    const tierUrgency = TIME_CONTRACT_TIER_URGENCY[state.currentTier];
    const budgetUtil =
      ctx.totalBudgetMs > 0
        ? clamp01(
            (ctx.totalBudgetMs - ctx.remainingBudgetMs) / ctx.totalBudgetMs,
          )
        : 0;
    const holdPressure = clamp01(ctx.holdPressure);
    const seasonPressure = clamp01((ctx.seasonMultiplier - 1.0) / 3.0);
    const decisionUrgency = clamp01(ctx.activeDecisionScore);
    const composite = clamp01(
      tierUrgency * 0.3 +
        budgetUtil * 0.25 +
        holdPressure * 0.15 +
        seasonPressure * 0.15 +
        decisionUrgency * 0.15,
    );

    const rowOffset = (rows - 1) * cols;
    this.data[rowOffset + 0] = tierUrgency;
    this.data[rowOffset + 1] = budgetUtil;
    this.data[rowOffset + 2] = holdPressure;
    this.data[rowOffset + 3] = seasonPressure;
    this.data[rowOffset + 4] = decisionUrgency;
    this.data[rowOffset + 5] = composite;

    this.headTick = state.tickNumber;
    this.lastTier = state.currentTier;
    this.lastPhase = ctx.phase;
    this.lastMs = ctx.nowMs;
  }

  /**
   * Builds and returns a frozen TimeContractDLTensor from the current buffer.
   */
  public buildTensor(): TimeContractDLTensor {
    const snapshot = new Float32Array(this.data);
    return Object.freeze({
      data: Object.freeze(snapshot) as Readonly<Float32Array>,
      rows: TICK_SCHEDULER_DL_CAPACITY,
      cols: TIME_CONTRACT_DL_COL_COUNT,
      colLabels: TIME_CONTRACT_DL_COL_LABELS,
      tier: this.lastTier,
      phase: this.lastPhase,
      headTick: this.headTick,
      extractedAtMs: this.lastMs,
    });
  }

  /**
   * Returns the column label at a given index.
   * Type-safe accessor for TIME_CONTRACT_DL_COL_LABELS.
   */
  public getColLabel(index: number): TimeContractDLColLabel | null {
    const label = TIME_CONTRACT_DL_COL_LABELS[index];
    return label ?? null;
  }

  /**
   * Returns the average value of a column across all filled rows.
   */
  public getColumnAverage(colIndex: number): number {
    if (colIndex < 0 || colIndex >= TIME_CONTRACT_DL_COL_COUNT) return 0;
    const cols = TIME_CONTRACT_DL_COL_COUNT;
    let sum = 0;
    for (let r = 0; r < this.filledRows; r++) {
      sum += this.data[r * cols + colIndex] ?? 0;
    }
    return this.filledRows > 0 ? sum / this.filledRows : 0;
  }

  /**
   * Returns the composite pressure trend over last N rows.
   * Column 5 = composite_pressure.
   */
  public getCompositeTrend(windowSize = 5): -1 | 0 | 1 {
    if (this.filledRows < 2) return 0;
    const cols = TIME_CONTRACT_DL_COL_COUNT;
    const compositeCol = 5;
    const safeWindow = Math.min(windowSize, this.filledRows);
    const rows = TICK_SCHEDULER_DL_CAPACITY;
    const startRow = rows - safeWindow;
    const endRow = rows - 1;
    const first = this.data[startRow * cols + compositeCol] ?? 0;
    const last = this.data[endRow * cols + compositeCol] ?? 0;
    const delta = last - first;
    if (Math.abs(delta) < 0.05) return 0;
    return delta > 0 ? 1 : -1;
  }

  /** Resets the tensor buffer. */
  public reset(): void {
    this.data = new Float32Array(
      TICK_SCHEDULER_DL_CAPACITY * TIME_CONTRACT_DL_COL_COUNT,
    );
    this.filledRows = 0;
    this.headTick = 0;
    this.lastTier = 'T1';
    this.lastPhase = 'FOUNDATION';
    this.lastMs = 0;
  }
}

// ============================================================================
// SECTION 12 — SUB-SYSTEM: TickSchedulerChatEmitter
// ============================================================================

/**
 * Emits LIVEOPS_TICK chat signals from scheduler state.
 * Routes to the correct TimeContractChatChannel based on urgency and tier.
 * Uses scoreContractChatUrgency to derive urgency band from the ML vector.
 *
 * Signal routing logic:
 *   T4 tier          → LIVEOPS_PRESSURE (always)
 *   CRITICAL urgency → LIVEOPS_PRESSURE
 *   URGENT urgency   → LIVEOPS_MAIN or LIVEOPS_TICK
 *   T3 + ELEVATED    → LIVEOPS_MAIN
 *   otherwise        → LIVEOPS_TICK
 */
export class TickSchedulerChatEmitter {
  private emissionCount = 0;
  private lastEmittedUrgency: TimeContractChatUrgency = 'AMBIENT';
  private lastEmittedChannel: TimeContractChatChannel = 'LIVEOPS_TICK';

  /**
   * Emits a LIVEOPS_TICK signal from scheduler state and ML vector.
   * Uses scoreContractChatUrgency to derive the urgency band.
   */
  public emit(
    state: TickSchedulerState,
    lastEvent: ScheduledTickEvent | null,
    narration: TickSchedulerNarration,
    mlVector: TimeContractMLVector,
    dlTensor: TimeContractDLTensor | null,
    nowMs: number,
  ): TickSchedulerChatEmission {
    const urgency = scoreContractChatUrgency(mlVector);
    const channel = this.routeChannel(state.currentTier, urgency);
    const shouldInterruptChat =
      urgency === 'CRITICAL' || urgency === 'URGENT';
    const shouldEscalate = urgency === 'CRITICAL';

    this.emissionCount++;
    this.lastEmittedUrgency = urgency;
    this.lastEmittedChannel = channel;

    const tags: string[] = [
      ...narration.tags,
      `channel:${channel}`,
      `urgency:${urgency}`,
      `emission:${this.emissionCount}`,
    ];

    if (shouldInterruptChat) tags.push('chat:interrupt');
    if (shouldEscalate) tags.push('chat:escalate');
    if (lastEvent !== null && isTickDrifted(lastEvent)) {
      tags.push('drift:alarm');
    }

    // Include season lifecycle label tag if applicable
    const seasonTags = this.buildSeasonTags(mlVector);
    tags.push(...seasonTags);

    // Reference dlTensor for DL-informed channel routing metadata
    const dlCompositeTrend = dlTensor !== null ? this.deriveDLTrend(dlTensor) : 0;
    if (dlCompositeTrend > 0) tags.push('dl:pressure-rising');
    if (dlCompositeTrend < 0) tags.push('dl:pressure-easing');

    const signalId = `tick_scheduler_${state.tickNumber}_${nowMs}`;

    return Object.freeze({
      signalId,
      channel,
      urgency,
      headline: narration.headline,
      body: narration.body,
      tier: state.currentTier,
      phase: narration.phaseLabel.length > 0 ? (this.phaseFromLabel(narration.phaseLabel)) : null,
      tick: state.tickNumber,
      nowMs,
      tags: Object.freeze(tags),
      shouldInterruptChat,
      shouldEscalate,
      mlFeatures: mlVector.features,
      dlColLabels: TIME_CONTRACT_DL_COL_LABELS,
    });
  }

  /** Returns the total number of signals emitted this session. */
  public getEmissionCount(): number {
    return this.emissionCount;
  }

  /** Returns the last emitted urgency band. */
  public getLastUrgency(): TimeContractChatUrgency {
    return this.lastEmittedUrgency;
  }

  /** Returns the last emitted channel. */
  public getLastChannel(): TimeContractChatChannel {
    return this.lastEmittedChannel;
  }

  /**
   * Returns true if the given urgency level should interrupt the chat flow.
   */
  public shouldInterrupt(urgency: TimeContractChatUrgency): boolean {
    return urgency === 'CRITICAL' || urgency === 'URGENT';
  }

  /**
   * Determines the correct channel for a given tier and urgency.
   * T4 always routes to LIVEOPS_PRESSURE for maximum visibility.
   */
  public routeChannel(
    tier: PressureTier,
    urgency: TimeContractChatUrgency,
  ): TimeContractChatChannel {
    if (tier === 'T4') return 'LIVEOPS_PRESSURE';
    if (urgency === 'CRITICAL') return 'LIVEOPS_PRESSURE';
    if (tier === 'T3' && urgency === 'URGENT') return 'LIVEOPS_MAIN';
    if (urgency === 'ELEVATED' || urgency === 'NOTEWORTHY') return 'LIVEOPS_TICK';
    return 'LIVEOPS_MAIN';
  }

  /** Resets emission counters. */
  public reset(): void {
    this.emissionCount = 0;
    this.lastEmittedUrgency = 'AMBIENT';
    this.lastEmittedChannel = 'LIVEOPS_TICK';
  }

  private buildSeasonTags(mlVector: TimeContractMLVector): string[] {
    const tags: string[] = [];
    // Feature 22 = season_active_flag
    if ((mlVector.features[22] ?? 0) >= 1.0) {
      // Use TIME_CONTRACT_SEASON_LIFECYCLE_LABEL for contextual tag
      const lifecycleLabel = TIME_CONTRACT_SEASON_LIFECYCLE_LABEL['ACTIVE'];
      tags.push(`season:${lifecycleLabel.toLowerCase().replace(/\s/g, '_')}`);
    }
    return tags;
  }

  private deriveDLTrend(dlTensor: TimeContractDLTensor): -1 | 0 | 1 {
    // Use the composite_pressure column (index 5) to derive trend from last vs first row
    const cols = dlTensor.cols;
    const compositeCol = 5;
    if (dlTensor.rows < 2) return 0;
    const firstVal = dlTensor.data[0 * cols + compositeCol] ?? 0;
    const lastVal = dlTensor.data[(dlTensor.rows - 1) * cols + compositeCol] ?? 0;
    const delta = lastVal - firstVal;
    if (Math.abs(delta) < 0.05) return 0;
    return delta > 0 ? 1 : -1;
  }

  private phaseFromLabel(label: string): RunPhase | null {
    if (label === 'Foundation') return 'FOUNDATION';
    if (label === 'Escalation') return 'ESCALATION';
    if (label === 'Sovereignty') return 'SOVEREIGNTY';
    return null;
  }
}

// ============================================================================
// SECTION 13 — SUB-SYSTEM: TickSchedulerModeAdvisor
// ============================================================================

/**
 * Provides mode-specific scheduling profiles and recommendations.
 *
 * The four modes map to different scheduling personalities:
 *   Empire (solo)    — moderate pressure, standard cadence
 *   Predator (pvp)   — high pressure, accelerated cadence
 *   Syndicate (coop) — relaxed pressure, cooperative timing
 *   Phantom (ghost)  — maximum difficulty, precision timing
 *
 * All advice is derived from:
 *   MODE_DIFFICULTY_MULTIPLIER, MODE_TENSION_FLOOR, MODE_NORMALIZED,
 *   TIME_CONTRACT_MODE_TEMPO, TIER_DURATIONS_MS, DECISION_WINDOW_DURATIONS_MS
 */
export class TickSchedulerModeAdvisor {
  private readonly profileCache = new Map<ModeCode, TickSchedulerModeProfile>();

  /**
   * Returns the scheduling profile for a given mode.
   * Profiles are cached after first computation.
   */
  public getProfile(mode: ModeCode): TickSchedulerModeProfile {
    const cached = this.profileCache.get(mode);
    if (cached !== undefined) return cached;

    const profile = this.buildProfile(mode);
    this.profileCache.set(mode, profile);
    return profile;
  }

  /**
   * Recommends the tick duration for a given mode and pressure tier.
   * Applies mode tempo multiplier to the base tier duration.
   */
  public recommendDurationMs(mode: ModeCode, tier: PressureTier): number {
    const base = TIER_DURATIONS_MS[tier];
    const tempo = TIME_CONTRACT_MODE_TEMPO[mode];
    // Higher tempo = shorter ticks (more pressure)
    const adjusted = Math.trunc(base / tempo);
    return clampTickDurationMs(tier, adjusted);
  }

  /**
   * Recommends the decision window duration for a given mode and tier.
   * PvP and ghost modes apply compression to decision windows.
   */
  public recommendDecisionWindowMs(mode: ModeCode, tier: PressureTier): number {
    const base = DECISION_WINDOW_DURATIONS_MS[tier];
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    // Higher difficulty = shorter decision windows
    const adjusted = Math.trunc(base / difficulty);
    return Math.max(500, adjusted);
  }

  /**
   * Returns the drift tolerance for a mode in milliseconds.
   * Ghost mode has the tightest tolerance (precision run).
   */
  public adviseDriftTolerance(mode: ModeCode): number {
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    // Higher tension floor = tighter drift tolerance
    const factor = 1.0 - tensionFloor;
    return normalizeMs(
      TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS * factor * 2.5,
    );
  }

  /**
   * Returns the maximum tick scheduling skew in milliseconds.
   * Coop mode has the most tolerance (team coordination overhead).
   */
  public adviseMaxTickSkew(mode: ModeCode): number {
    const difficulty = MODE_DIFFICULTY_MULTIPLIER[mode];
    if (difficulty >= 1.5) return 50;   // ghost: very tight
    if (difficulty >= 1.3) return 100;  // pvp: tight
    if (difficulty >= 1.0) return 200;  // solo: standard
    return 300;                          // coop: relaxed
  }

  /**
   * Returns whether a mode benefits from schedule tightening at a given tier.
   * Ghost mode always tightens; coop never tightens below T3.
   */
  public shouldTightenSchedule(mode: ModeCode, tier: PressureTier): boolean {
    if (mode === 'ghost') return true;
    if (mode === 'coop') return tier === 'T3' || tier === 'T4';
    return tier === 'T3' || tier === 'T4';
  }

  /**
   * Returns the normalized mode value (0–1) for ML feature use.
   * Uses MODE_NORMALIZED from GamePrimitives.
   */
  public getModeNormalized(mode: ModeCode): number {
    return MODE_NORMALIZED[mode];
  }

  private buildProfile(mode: ModeCode): TickSchedulerModeProfile {
    const modeNormalized = MODE_NORMALIZED[mode];
    const difficultyMultiplier = MODE_DIFFICULTY_MULTIPLIER[mode];
    const tensionFloor = MODE_TENSION_FLOOR[mode];
    const tempoMultiplier = TIME_CONTRACT_MODE_TEMPO[mode];

    const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    const durations: Record<PressureTier, number> = {} as Record<PressureTier, number>;
    const decisionWindows: Record<PressureTier, number> = {} as Record<PressureTier, number>;

    for (const tier of tiers) {
      durations[tier] = this.recommendDurationMs(mode, tier);
      decisionWindows[tier] = this.recommendDecisionWindowMs(mode, tier);
    }

    const labels: Record<ModeCode, string> = {
      solo: 'Empire Mode — standard cadence, single-player discipline',
      pvp: 'Predator Mode — accelerated cadence, opponent pressure active',
      coop: 'Syndicate Mode — cooperative cadence, team coordination window',
      ghost: 'Phantom Mode — precision cadence, maximum challenge timeline',
    };

    return Object.freeze({
      mode,
      modeNormalized,
      difficultyMultiplier,
      tensionFloor,
      tempoMultiplier,
      recommendedDurationsByTier: Object.freeze(durations),
      recommendedDecisionWindowsByTier: Object.freeze(decisionWindows),
      driftToleranceMs: this.adviseDriftTolerance(mode),
      maxTickSkewMs: this.adviseMaxTickSkew(mode),
      schedulingLabel: labels[mode],
    });
  }
}

// ============================================================================
// SECTION 14 — SUB-SYSTEM: TickSchedulerPhaseAdvisor
// ============================================================================

/**
 * Provides phase-specific scheduling profiles and reasoning.
 *
 * Three run phases map to distinct scheduling pressures:
 *   FOUNDATION   — 35% of total tick budget, stakes × 0.6
 *   ESCALATION   — 40% of total tick budget, stakes × 0.85
 *   SOVEREIGNTY  — 25% of total tick budget, stakes × 1.0
 *
 * Sources:
 *   RUN_PHASE_NORMALIZED, RUN_PHASE_STAKES_MULTIPLIER,
 *   RUN_PHASE_TICK_BUDGET_FRACTION, TIME_CONTRACT_PHASE_SCORE,
 *   PHASE_BOUNDARIES_MS, resolvePhaseFromElapsedMs, isPhaseBoundaryTransition
 */
export class TickSchedulerPhaseAdvisor {

  /**
   * Returns the scheduling profile for a run phase.
   */
  public getProfile(phase: RunPhase): TickSchedulerPhaseProfile {
    const phaseNormalized = RUN_PHASE_NORMALIZED[phase];
    const stakesMultiplier = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const tickBudgetFraction = RUN_PHASE_TICK_BUDGET_FRACTION[phase];
    const phaseScore = TIME_CONTRACT_PHASE_SCORE[phase];
    const advisedDurationMultiplier = this.computeDurationMultiplier(phase);
    const recommendTighten = this.shouldTightenSchedule(phase, 'T2');

    const labels: Record<RunPhase, string> = {
      FOUNDATION: 'Foundation — building financial foundations, moderate pressure',
      ESCALATION: 'Escalation — hater heat rising, decision windows compressing',
      SOVEREIGNTY: 'Sovereignty — final push, every tick counts',
    };

    return Object.freeze({
      phase,
      phaseNormalized,
      stakesMultiplier,
      tickBudgetFraction,
      phaseScore,
      recommendedTighten: recommendTighten,
      advisedDurationMultiplier,
      schedulingLabel: labels[phase],
    });
  }

  /**
   * Returns the advised duration multiplier for a phase.
   * Sovereignty tightens the schedule; Foundation relaxes it.
   */
  public computeDurationMultiplier(phase: RunPhase): number {
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    // Inverted: higher stakes → shorter advised duration
    return clamp01(1.0 / Math.max(0.1, stakes));
  }

  /**
   * Returns whether the schedule should tighten for a phase + tier combo.
   * Sovereignty always tightens. Escalation tightens at T2+.
   */
  public shouldTightenSchedule(phase: RunPhase, tier: PressureTier): boolean {
    if (phase === 'SOVEREIGNTY') return true;
    if (phase === 'ESCALATION') {
      return tier === 'T2' || tier === 'T3' || tier === 'T4';
    }
    return tier === 'T4';
  }

  /**
   * Returns the tick budget allocated for a phase given total budget.
   * Uses RUN_PHASE_TICK_BUDGET_FRACTION for proportional allocation.
   */
  public getPhaseTickBudget(phase: RunPhase, totalBudgetMs: number): number {
    return normalizeMs(totalBudgetMs * RUN_PHASE_TICK_BUDGET_FRACTION[phase]);
  }

  /**
   * Resolves the current run phase from elapsed time.
   * Delegates to resolvePhaseFromElapsedMs from types.ts.
   */
  public resolvePhase(elapsedMs: number): RunPhase {
    return resolvePhaseFromElapsedMs(elapsedMs);
  }

  /**
   * Returns true if the transition from previousElapsed → nextElapsed
   * crosses a phase boundary. Uses isPhaseBoundaryTransition.
   */
  public isBoundaryTransition(
    previousElapsedMs: number,
    nextElapsedMs: number,
  ): boolean {
    return isPhaseBoundaryTransition(previousElapsedMs, nextElapsedMs);
  }

  /**
   * Returns all phase boundary definitions for diagnostic/debug use.
   * Exposes PHASE_BOUNDARIES_MS from types.ts.
   */
  public getPhaseBoundaries(): typeof PHASE_BOUNDARIES_MS {
    return PHASE_BOUNDARIES_MS;
  }

  /**
   * Recommends the next tick duration for a phase + tier combo.
   * Applies phase stakes multiplier as a tightening factor.
   */
  public recommendDurationMs(phase: RunPhase, tier: PressureTier): number {
    const base = getDefaultTickDurationMs(tier);
    const tighten = this.shouldTightenSchedule(phase, tier);
    const stakes = RUN_PHASE_STAKES_MULTIPLIER[phase];
    const adjusted = tighten ? Math.trunc(base / (1.0 + stakes * 0.2)) : base;
    return Math.max(500, normalizeTickDurationMs(tier, adjusted));
  }

  /**
   * Returns the phase score (0–1) for ML features.
   * Exposes TIME_CONTRACT_PHASE_SCORE lookup.
   */
  public getPhaseScore(phase: RunPhase): number {
    return TIME_CONTRACT_PHASE_SCORE[phase];
  }

  /**
   * Describes the phase transition context for narration.
   */
  public describePhaseTransition(
    previousElapsedMs: number,
    nextElapsedMs: number,
  ): string {
    const from = resolvePhaseFromElapsedMs(previousElapsedMs);
    const to = resolvePhaseFromElapsedMs(nextElapsedMs);
    if (from === to) return `Continuing ${from} phase`;
    return `Phase transition: ${from} → ${to} at ${nextElapsedMs}ms elapsed`;
  }
}

// ============================================================================
// SECTION 15 — SUB-SYSTEM: TickSchedulerSessionTracker
// ============================================================================

/**
 * Session-scoped tick statistics.
 * Tracks residency, counts, and summary metrics across the lifetime
 * of a single TickScheduler run.
 *
 * Uses TIME_CONTRACT_OUTCOME_IS_TERMINAL to identify when a run has ended,
 * and RUN_PHASE_TICK_BUDGET_FRACTION for expected distribution comparison.
 */
export class TickSchedulerSessionTracker {
  private totalTicks = 0;
  private totalDurationMs = 0;
  private totalDriftMs = 0;
  private driftAlarmCount = 0;
  private tierEscalationCount = 0;
  private tierDeEscalationCount = 0;
  private startedAtMs: number | null = null;
  private lastTickAtMs: number | null = null;

  private readonly tierTickCounts: Record<PressureTier, number> = {
    T0: 0, T1: 0, T2: 0, T3: 0, T4: 0,
  };

  private readonly phaseTickCounts: Record<RunPhase, number> = {
    FOUNDATION: 0, ESCALATION: 0, SOVEREIGNTY: 0,
  };

  /**
   * Records a single tick event for session statistics.
   */
  public recordTick(
    event: ScheduledTickEvent,
    phase: RunPhase,
    nowMs: number,
  ): void {
    if (this.startedAtMs === null) this.startedAtMs = nowMs;
    this.lastTickAtMs = nowMs;

    this.totalTicks++;
    this.totalDurationMs += event.plannedDurationMs;
    this.totalDriftMs += Math.abs(event.driftMs);

    if (Math.abs(event.driftMs) >= TICK_SCHEDULER_DRIFT_ALARM_MS) {
      this.driftAlarmCount++;
    }

    this.tierTickCounts[event.tier]++;
    this.phaseTickCounts[phase]++;
  }

  /**
   * Records a tier transition event for escalation counting.
   */
  public recordTierTransition(isEscalation: boolean): void {
    if (isEscalation) {
      this.tierEscalationCount++;
    } else {
      this.tierDeEscalationCount++;
    }
  }

  /**
   * Returns the average tick duration in milliseconds.
   */
  public getAverageDurationMs(): number {
    if (this.totalTicks === 0) return 0;
    return this.totalDurationMs / this.totalTicks;
  }

  /**
   * Returns the average absolute drift in milliseconds.
   */
  public getAverageDriftMs(): number {
    if (this.totalTicks === 0) return 0;
    return this.totalDriftMs / this.totalTicks;
  }

  /**
   * Returns the tier residency percentage for a given tier.
   * Uses tier tick counts / total tick counts.
   */
  public getTierResidencyPct(tier: PressureTier): number {
    if (this.totalTicks === 0) return 0;
    return clamp01(this.tierTickCounts[tier] / this.totalTicks);
  }

  /**
   * Returns the phase residency percentage for a given phase.
   */
  public getPhaseResidencyPct(phase: RunPhase): number {
    if (this.totalTicks === 0) return 0;
    return clamp01(this.phaseTickCounts[phase] / this.totalTicks);
  }

  /**
   * Returns the tier that has been active for the most ticks.
   */
  public getPeakTier(): PressureTier {
    let peak: PressureTier = 'T1';
    let peakCount = 0;
    const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    for (const tier of tiers) {
      if (this.tierTickCounts[tier] > peakCount) {
        peakCount = this.tierTickCounts[tier];
        peak = tier;
      }
    }
    return peak;
  }

  /**
   * Returns the phase that has been active for the most ticks.
   */
  public getDominantPhase(): RunPhase {
    let dominant: RunPhase = 'FOUNDATION';
    let dominantCount = 0;
    const phases: RunPhase[] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
    for (const phase of phases) {
      if (this.phaseTickCounts[phase] > dominantCount) {
        dominantCount = this.phaseTickCounts[phase];
        dominant = phase;
      }
    }
    return dominant;
  }

  /**
   * Returns the expected phase residency from RUN_PHASE_TICK_BUDGET_FRACTION.
   * Used to compare actual vs expected distribution for anomaly detection.
   */
  public getExpectedPhaseResidency(phase: RunPhase): number {
    return RUN_PHASE_TICK_BUDGET_FRACTION[phase];
  }

  /**
   * Returns whether a terminal outcome code is recognized.
   * Uses TIME_CONTRACT_OUTCOME_IS_TERMINAL for lookup.
   */
  public isTerminalOutcome(outcomeCode: string): boolean {
    const outcomes = TIME_CONTRACT_OUTCOME_IS_TERMINAL as Record<string, boolean>;
    return outcomes[outcomeCode] === true;
  }

  /**
   * Returns the complete session state snapshot.
   */
  public getSnapshot(): TickSchedulerSessionState {
    const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
    const phases: RunPhase[] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];

    const tierResidencyPct: Record<PressureTier, number> = {} as Record<PressureTier, number>;
    const phaseResidencyPct: Record<RunPhase, number> = {} as Record<RunPhase, number>;

    for (const tier of tiers) {
      tierResidencyPct[tier] = this.getTierResidencyPct(tier);
    }
    for (const phase of phases) {
      phaseResidencyPct[phase] = this.getPhaseResidencyPct(phase);
    }

    return Object.freeze({
      totalTicks: this.totalTicks,
      averageDurationMs: this.getAverageDurationMs(),
      averageDriftMs: this.getAverageDriftMs(),
      tierTickCounts: Object.freeze({ ...this.tierTickCounts }),
      phaseTickCounts: Object.freeze({ ...this.phaseTickCounts }),
      tierResidencyPct: Object.freeze(tierResidencyPct),
      phaseResidencyPct: Object.freeze(phaseResidencyPct),
      peakTier: this.getPeakTier(),
      dominantPhase: this.getDominantPhase(),
      driftAlarmCount: this.driftAlarmCount,
      tierEscalationCount: this.tierEscalationCount,
      tierDeEscalationCount: this.tierDeEscalationCount,
      startedAtMs: this.startedAtMs,
      lastTickAtMs: this.lastTickAtMs,
    });
  }

  /**
   * Returns a narrative description of session health using budget floor constants.
   */
  public describeSessionHealth(): string {
    const avgDuration = this.getAverageDurationMs();
    const avgDrift = this.getAverageDriftMs();
    const isHealthy =
      avgDrift < TICK_SCHEDULER_BUDGET_WARNING_FLOOR / 100;

    return [
      `Session: ${this.totalTicks} ticks`,
      `avg duration: ${avgDuration.toFixed(0)}ms`,
      `avg drift: ${avgDrift.toFixed(1)}ms`,
      `drift alarms: ${this.driftAlarmCount}`,
      `tier escalations: ${this.tierEscalationCount}`,
      `health: ${isHealthy ? 'OK' : 'degraded'}`,
    ].join(' | ');
  }

  /** Resets all session state. */
  public reset(): void {
    this.totalTicks = 0;
    this.totalDurationMs = 0;
    this.totalDriftMs = 0;
    this.driftAlarmCount = 0;
    this.tierEscalationCount = 0;
    this.tierDeEscalationCount = 0;
    this.startedAtMs = null;
    this.lastTickAtMs = null;
    this.tierTickCounts.T0 = 0;
    this.tierTickCounts.T1 = 0;
    this.tierTickCounts.T2 = 0;
    this.tierTickCounts.T3 = 0;
    this.tierTickCounts.T4 = 0;
    this.phaseTickCounts.FOUNDATION = 0;
    this.phaseTickCounts.ESCALATION = 0;
    this.phaseTickCounts.SOVEREIGNTY = 0;
  }
}

// ============================================================================
// SECTION 16 — SUB-SYSTEM: TickSchedulerAnalytics
// ============================================================================

/**
 * Composite analytical surface that aggregates all sub-systems.
 * Primary entry point for external consumers that need a snapshot
 * of the full scheduler intelligence surface.
 *
 * References:
 *   - TIME_CONTRACTS_VERSION for versioning metadata
 *   - TIME_CONTRACT_ML_DIM, DL_ROW_COUNT, DL_COL_COUNT for dimension labels
 *   - TIME_CONTRACT_DL_COL_LABELS, ML_FEATURE_LABELS for column/feature naming
 *   - isSchedulerStopped for running state checks
 *   - scoreContractChatUrgency for urgency derivation
 */
export class TickSchedulerAnalytics {
  private lastComputedResilience: TickSchedulerResilienceScore | null = null;
  private lastNarration: TickSchedulerNarration | null = null;
  private lastMLVector: TimeContractMLVector | null = null;
  private computedAtTick = 0;

  /**
   * Updates internal analytics state after each tick.
   * Called by TickScheduler.executeCurrentSchedule().
   */
  public update(
    state: TickSchedulerState,
    lastEvent: ScheduledTickEvent | null,
    auditTrail: TickSchedulerAuditTrail,
    driftDetector: TickSchedulerDriftDetector,
    tierTracker: TickSchedulerTierTracker,
    resilienceScorer: TickSchedulerResilienceScorer,
    narrator: TickSchedulerNarrator,
    phase: RunPhase,
    mode: ModeCode,
  ): void {
    const stopped = isSchedulerStopped(state);
    if (!stopped) {
      this.lastComputedResilience = resilienceScorer.score(
        auditTrail,
        driftDetector,
        tierTracker,
        state.tickNumber,
      );
      this.lastNarration = narrator.buildNarration(state, lastEvent, phase, mode);
      this.computedAtTick = state.tickNumber;
    }
  }

  /**
   * Stores the most recently extracted ML vector for external access.
   */
  public setLastMLVector(vector: TimeContractMLVector): void {
    this.lastMLVector = vector;
  }

  /**
   * Returns the full analytics summary.
   */
  public getSummary(
    sessionTracker: TickSchedulerSessionTracker,
    auditTrail: TickSchedulerAuditTrail,
    driftDetector: TickSchedulerDriftDetector,
    tierTracker: TickSchedulerTierTracker,
  ): TickSchedulerAnalyticsSummary {
    return Object.freeze({
      version: TICK_SCHEDULER_VERSION,
      contractVersion: TICK_SCHEDULER_CONTRACT_VERSION,
      sessionState: sessionTracker.getSnapshot(),
      resilience: this.lastComputedResilience,
      lastNarration: this.lastNarration,
      driftRecords: driftDetector.getRecentRecords(10),
      tierTransitions: tierTracker.getRecentTransitions(10),
      auditSize: auditTrail.getSize(),
      mlDim: TIME_CONTRACT_ML_DIM,
      dlRows: TIME_CONTRACT_DL_ROW_COUNT,
      dlCols: TIME_CONTRACT_DL_COL_COUNT,
      colLabels: TIME_CONTRACT_DL_COL_LABELS,
      mlFeatureLabels: TIME_CONTRACT_ML_FEATURE_LABELS,
    });
  }

  /**
   * Returns the most recently computed resilience score.
   */
  public getLastResilience(): TickSchedulerResilienceScore | null {
    return this.lastComputedResilience;
  }

  /**
   * Returns the most recently computed ML vector.
   */
  public getLastMLVector(): TimeContractMLVector | null {
    return this.lastMLVector;
  }

  /**
   * Returns the most recently generated narration.
   */
  public getLastNarration(): TickSchedulerNarration | null {
    return this.lastNarration;
  }

  /**
   * Returns the tick number when analytics were last computed.
   */
  public getComputedAtTick(): number {
    return this.computedAtTick;
  }

  /**
   * Returns a chat-ready urgency label from the last ML vector.
   * Returns 'AMBIENT' if no ML vector is available.
   */
  public deriveUrgency(): TimeContractChatUrgency {
    if (this.lastMLVector === null) return 'AMBIENT';
    return scoreContractChatUrgency(this.lastMLVector);
  }

  /** Resets analytics state. */
  public reset(): void {
    this.lastComputedResilience = null;
    this.lastNarration = null;
    this.lastMLVector = null;
    this.computedAtTick = 0;
  }
}

// ============================================================================
// SECTION 17 — MAIN CLASS: TickScheduler
// ============================================================================

/**
 * TickScheduler — authoritative backend cadence shell for Point Zero One.
 *
 * Responsibilities:
 * - Arms a chained setTimeout for each tick at the correct duration + tier
 * - Ensures no tick callback overlap (isTickInFlight guard)
 * - Preserves remaining time across pause/resume (no silent restart)
 * - Dispatches fired tick events to 12 sub-systems for full intelligence extraction
 * - Exposes getSubSystems() for external analytics consumers
 * - Accepts optional run context (mode, phase, budgets) for enriched ML output
 * - Accepts optional PressureReader for dynamic tier resolution
 *
 * Sub-systems are wired in this execution order per tick:
 *   1. AuditTrail.record()       — log the event
 *   2. DriftDetector.record()    — measure drift
 *   3. TierTracker (on change)   — track escalation
 *   4. SessionTracker.record()   — accumulate session stats
 *   5. Narrator.buildNarration() — generate UX narrative
 *   6. MLExtractor.extract()     — compute 28-dim vector
 *   7. DLBuilder.appendRow()     — update rolling tensor
 *   8. ChatEmitter.emit()        — build LIVEOPS_TICK signal
 *   9. Analytics.update()        — refresh composite surface
 *
 * @example
 * ```ts
 * const scheduler = new TickScheduler('solo', 'FOUNDATION');
 * scheduler.setOnTick(async (event) => {
 *   const next = await engine.tick(event);
 *   return next ? { durationMs: next.durationMs, tier: next.tier } : null;
 * });
 * scheduler.start({ durationMs: 13_000, tier: 'T1' });
 * ```
 */
export class TickScheduler {
  // ── Core scheduling state ──────────────────────────────────────────────────
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private onTickCallback: TickSchedulerCallback | null = null;

  private generation = 0;
  private tickNumber = 0;
  private currentTier: PressureTier = 'T1';

  private isRunning = false;
  private isPaused = false;
  private isTickInFlight = false;

  private scheduledAtMs: number | null = null;
  private nextFireAtMs: number | null = null;
  private remainingMs: number | null = null;

  private lastPlannedDurationMs: number | null = null;
  private lastFiredAtMs: number | null = null;
  private lastReason: string | undefined;
  private lastFiredEvent: ScheduledTickEvent | null = null;

  // ── Run context ────────────────────────────────────────────────────────────
  private runContext: TickSchedulerRunContext | null = null;
  private externalPressureReader: PressureReader | null = null;

  // ── Sub-systems ────────────────────────────────────────────────────────────
  private readonly _auditTrail: TickSchedulerAuditTrail;
  private readonly _driftDetector: TickSchedulerDriftDetector;
  private readonly _tierTracker: TickSchedulerTierTracker;
  private readonly _resilienceScorer: TickSchedulerResilienceScorer;
  private readonly _narrator: TickSchedulerNarrator;
  private readonly _mlExtractor: TickSchedulerMLExtractor;
  private readonly _dlBuilder: TickSchedulerDLBuilder;
  private readonly _chatEmitter: TickSchedulerChatEmitter;
  private readonly _modeAdvisor: TickSchedulerModeAdvisor;
  private readonly _phaseAdvisor: TickSchedulerPhaseAdvisor;
  private readonly _sessionTracker: TickSchedulerSessionTracker;
  private readonly _analytics: TickSchedulerAnalytics;

  /**
   * Constructs a TickScheduler with optional mode/phase context and clock.
   *
   * @param mode - Initial mode code for scheduling profile (default: 'solo')
   * @param phase - Initial run phase for phase advisor (default: 'FOUNDATION')
   * @param clock - Deterministic or real clock source (default: SystemClock)
   */
  public constructor(
    private defaultMode: ModeCode = 'solo',
    private defaultPhase: RunPhase = 'FOUNDATION',
    private readonly clock: ClockSource = new SystemClock(),
  ) {
    // Validate that this mode/phase combination is recognized
    if (!isModeCode(defaultMode)) {
      throw new Error(`TickScheduler: unknown mode '${String(defaultMode)}'`);
    }
    if (!isRunPhase(defaultPhase)) {
      throw new Error(`TickScheduler: unknown phase '${String(defaultPhase)}'`);
    }

    // Initialize sub-systems
    this._auditTrail = new TickSchedulerAuditTrail();
    this._driftDetector = new TickSchedulerDriftDetector();
    this._tierTracker = new TickSchedulerTierTracker();
    this._resilienceScorer = new TickSchedulerResilienceScorer();
    this._narrator = new TickSchedulerNarrator();
    this._mlExtractor = new TickSchedulerMLExtractor();
    this._dlBuilder = new TickSchedulerDLBuilder();
    this._chatEmitter = new TickSchedulerChatEmitter();
    this._modeAdvisor = new TickSchedulerModeAdvisor();
    this._phaseAdvisor = new TickSchedulerPhaseAdvisor();
    this._sessionTracker = new TickSchedulerSessionTracker();
    this._analytics = new TickSchedulerAnalytics();
  }

  // ── PUBLIC CORE API ────────────────────────────────────────────────────────

  /**
   * Sets the tick callback. The callback is invoked for every tick that fires.
   * Return a TickScheduleRequest to reschedule, null to stop, undefined to repeat.
   */
  public setOnTick(callback: TickSchedulerCallback): void {
    this.onTickCallback = callback;
  }

  /**
   * Starts the scheduler with an initial request.
   * No-op if already running.
   */
  public start(initialRequest: TickScheduleRequest): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.tickNumber = 0;
    this.arm(initialRequest);
  }

  /**
   * Pauses the scheduler. Preserves remaining time for exact resume.
   * No-op if not running or already paused.
   */
  public pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    if (this.nextFireAtMs !== null) {
      this.remainingMs = Math.max(0, this.nextFireAtMs - this.clock.now());
    } else {
      this.remainingMs = this.lastPlannedDurationMs;
    }
    this.clearTimer();
  }

  /**
   * Resumes a paused scheduler. Fires within the remaining ms from the pause.
   * No-op if not paused.
   */
  public resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    const durationMs = this.remainingMs ?? this.lastPlannedDurationMs ?? 1;
    this.arm({
      durationMs,
      tier: this.currentTier,
      reason: this.lastReason ?? 'resume',
    });
  }

  /**
   * Stops the scheduler. Optionally resets the tick counter.
   * Clears all pending timers and resets flight state.
   * Also resets all sub-systems when resetTickCounter is true.
   */
  public stop(resetTickCounter = false): void {
    this.clearTimer();
    this.isRunning = false;
    this.isPaused = false;
    this.isTickInFlight = false;
    this.scheduledAtMs = null;
    this.nextFireAtMs = null;
    this.remainingMs = null;
    this.lastPlannedDurationMs = null;
    this.lastFiredAtMs = null;
    this.lastReason = undefined;
    this.lastFiredEvent = null;
    this.generation += 1;

    if (resetTickCounter) {
      this.tickNumber = 0;
      this.resetAllSubSystems();
    }
  }

  /**
   * Forces a tick to fire immediately, bypassing the current timer.
   * No-op if not running or paused.
   */
  public async forceFire(): Promise<void> {
    if (!this.isRunning || this.isPaused) return;
    this.clearTimer();
    await this.executeCurrentSchedule();
  }

  /**
   * Re-arms the scheduler with a new request.
   * No-op if not running or paused.
   */
  public rearm(request: TickScheduleRequest): void {
    if (!this.isRunning || this.isPaused) return;
    this.arm(request);
  }

  // ── PUBLIC CONTEXT API ─────────────────────────────────────────────────────

  /**
   * Sets the run context for ML/DL extraction and narration enrichment.
   * Should be called after every tick by the consuming engine.
   */
  public setRunContext(ctx: TickSchedulerRunContext): void {
    this.runContext = ctx;
    if (isModeCode(ctx.mode)) this.defaultMode = ctx.mode;
    if (isRunPhase(ctx.phase)) this.defaultPhase = ctx.phase;
  }

  /**
   * Injects an external pressure reader for dynamic tier resolution.
   * When set, the scheduler uses the reader's tier for next-tick requests.
   */
  public setExternalPressureReader(reader: PressureReader): void {
    this.externalPressureReader = reader;
  }

  /**
   * Removes the external pressure reader.
   */
  public clearExternalPressureReader(): void {
    this.externalPressureReader = null;
  }

  /**
   * Resolves the current pressure tier from context or external reader.
   * Falls back to the scheduler's internally tracked tier.
   */
  public resolveCurrentTier(): PressureTier {
    if (this.externalPressureReader !== null) {
      const readerTier = this.externalPressureReader.tier;
      if (isPressureTier(readerTier)) return readerTier;
    }
    if (this.runContext !== null) {
      // Derive tier from the run context budget state if needed
      return this.currentTier;
    }
    return this.currentTier;
  }

  /**
   * Returns the recommended duration for the next tick based on mode + phase + tier.
   * Incorporates ModeAdvisor and PhaseAdvisor recommendations.
   */
  public getRecommendedNextDurationMs(): number {
    const tier = this.resolveCurrentTier();
    const mode = this.runContext?.mode ?? this.defaultMode;
    const phase = this.runContext?.phase ?? this.defaultPhase;
    const modeRec = this._modeAdvisor.recommendDurationMs(mode, tier);
    const phaseRec = this._phaseAdvisor.recommendDurationMs(phase, tier);
    // Take the shorter recommendation (more conservative)
    return Math.min(modeRec, phaseRec);
  }

  // ── PUBLIC STATE ACCESSORS ─────────────────────────────────────────────────

  /** Returns a frozen snapshot of current scheduler state. */
  public getState(): TickSchedulerState {
    return Object.freeze({
      tickNumber: this.tickNumber,
      currentTier: this.currentTier,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isTickInFlight: this.isTickInFlight,
      scheduledAtMs: this.scheduledAtMs,
      nextFireAtMs: this.nextFireAtMs,
      remainingMs: this.remainingMs,
      lastPlannedDurationMs: this.lastPlannedDurationMs,
      lastFiredAtMs: this.lastFiredAtMs,
    });
  }

  /**
   * Returns true if the scheduler is due to fire at the given reference time.
   */
  public isDue(referenceMs = this.clock.now()): boolean {
    if (!this.isRunning || this.isPaused || this.nextFireAtMs === null) {
      return false;
    }
    return Math.trunc(referenceMs) >= this.nextFireAtMs;
  }

  /** Returns the current tick number (1-indexed). */
  public getTickNumber(): number {
    return this.tickNumber;
  }

  /** Returns the current pressure tier. */
  public getCurrentTier(): PressureTier {
    return this.currentTier;
  }

  /** Returns the epoch ms when the next tick will fire, or null. */
  public getNextFireAtMs(): number | null {
    return this.nextFireAtMs;
  }

  /**
   * Returns the remaining ms until the next tick fires.
   * Accounts for pause state (returns frozen remaining ms when paused).
   */
  public getRemainingMs(referenceMs = this.clock.now()): number | null {
    if (this.isPaused) return this.remainingMs;
    if (this.nextFireAtMs === null) return null;
    return Math.max(0, this.nextFireAtMs - Math.trunc(referenceMs));
  }

  /** Returns the last fired ScheduledTickEvent, or null if no tick has fired. */
  public getLastFiredEvent(): ScheduledTickEvent | null {
    return this.lastFiredEvent;
  }

  /**
   * Returns the current run context, or null if none has been set.
   */
  public getRunContext(): TickSchedulerRunContext | null {
    return this.runContext;
  }

  /**
   * Returns true if the scheduler's state is healthy (running, not paused, not in-flight).
   * Delegates to contracts.ts isSchedulerHealthy.
   */
  public isHealthy(): boolean {
    return isSchedulerHealthy(this.getState());
  }

  /**
   * Returns true if the scheduler is fully stopped.
   * Delegates to contracts.ts isSchedulerStopped.
   */
  public isStopped(): boolean {
    return isSchedulerStopped(this.getState());
  }

  /**
   * Returns the normalized drift score (0–1) from the DriftDetector.
   */
  public getDriftScore(): number {
    return this._driftDetector.getDriftScore();
  }

  /**
   * Returns the TickTier enum value for the current PressureTier.
   * Uses TICK_TIER_BY_PRESSURE_TIER lookup.
   */
  public getCurrentTickTier(): TickTier {
    return TICK_TIER_BY_PRESSURE_TIER[this.currentTier];
  }

  /**
   * Returns the TickTierConfig for the current tier.
   * Exposes min/max/default/decisionWindow/visual/audio config.
   */
  public getCurrentTierConfig(): TickTierConfig {
    return getTickTierConfigByPressureTier(this.currentTier);
  }

  /**
   * Returns the default tick duration for the current tier.
   * Uses TIER_DURATIONS_MS lookup.
   */
  public getDefaultDurationMs(): number {
    return getDefaultTickDurationMs(this.currentTier);
  }

  /**
   * Returns the default decision window duration for the current tier.
   * Uses DECISION_WINDOW_DURATIONS_MS lookup.
   */
  public getDecisionWindowMs(): number {
    return getDecisionWindowDurationMs(this.currentTier);
  }

  // ── PUBLIC SUB-SYSTEM ACCESS ───────────────────────────────────────────────

  /** Returns all sub-systems bundled for external consumers. */
  public getSubSystems(): TickSchedulerSubSystems {
    return Object.freeze({
      auditTrail: this._auditTrail,
      driftDetector: this._driftDetector,
      tierTracker: this._tierTracker,
      resilienceScorer: this._resilienceScorer,
      narrator: this._narrator,
      mlExtractor: this._mlExtractor,
      dlBuilder: this._dlBuilder,
      chatEmitter: this._chatEmitter,
      modeAdvisor: this._modeAdvisor,
      phaseAdvisor: this._phaseAdvisor,
      sessionTracker: this._sessionTracker,
      analytics: this._analytics,
    });
  }

  /** Direct accessor for the AuditTrail sub-system. */
  public get auditTrail(): TickSchedulerAuditTrail {
    return this._auditTrail;
  }

  /** Direct accessor for the DriftDetector sub-system. */
  public get driftDetector(): TickSchedulerDriftDetector {
    return this._driftDetector;
  }

  /** Direct accessor for the TierTracker sub-system. */
  public get tierTracker(): TickSchedulerTierTracker {
    return this._tierTracker;
  }

  /** Direct accessor for the ResilienceScorer sub-system. */
  public get resilienceScorer(): TickSchedulerResilienceScorer {
    return this._resilienceScorer;
  }

  /** Direct accessor for the Narrator sub-system. */
  public get narrator(): TickSchedulerNarrator {
    return this._narrator;
  }

  /** Direct accessor for the MLExtractor sub-system. */
  public get mlExtractor(): TickSchedulerMLExtractor {
    return this._mlExtractor;
  }

  /** Direct accessor for the DLBuilder sub-system. */
  public get dlBuilder(): TickSchedulerDLBuilder {
    return this._dlBuilder;
  }

  /** Direct accessor for the ChatEmitter sub-system. */
  public get chatEmitter(): TickSchedulerChatEmitter {
    return this._chatEmitter;
  }

  /** Direct accessor for the ModeAdvisor sub-system. */
  public get modeAdvisor(): TickSchedulerModeAdvisor {
    return this._modeAdvisor;
  }

  /** Direct accessor for the PhaseAdvisor sub-system. */
  public get phaseAdvisor(): TickSchedulerPhaseAdvisor {
    return this._phaseAdvisor;
  }

  /** Direct accessor for the SessionTracker sub-system. */
  public get sessionTracker(): TickSchedulerSessionTracker {
    return this._sessionTracker;
  }

  /** Direct accessor for the Analytics sub-system. */
  public get analytics(): TickSchedulerAnalytics {
    return this._analytics;
  }

  /**
   * Extracts the current ML feature vector from scheduler state + run context.
   * Returns null if insufficient context is available.
   */
  public extractMLVector(): TimeContractMLVector | null {
    const ctx = this.buildMLContext();
    if (ctx === null) return null;
    const state = this.getState();
    const vector = this._mlExtractor.extract(
      state,
      this.lastFiredEvent,
      this._driftDetector,
      this._tierTracker,
      ctx,
    );
    this._analytics.setLastMLVector(vector);
    return vector;
  }

  /**
   * Builds the current DL tensor from the rolling buffer.
   * Returns the tensor snapshot regardless of fill level.
   */
  public buildDLTensor(): TimeContractDLTensor {
    return this._dlBuilder.buildTensor();
  }

  /**
   * Returns the analytics summary from the Analytics sub-system.
   */
  public getAnalyticsSummary(): TickSchedulerAnalyticsSummary {
    return this._analytics.getSummary(
      this._sessionTracker,
      this._auditTrail,
      this._driftDetector,
      this._tierTracker,
    );
  }

  /**
   * Returns a human-readable description of the scheduler's health.
   * Wraps describeTickSchedulerHealth from contracts.ts.
   */
  public describeHealth(): string {
    return describeTickSchedulerHealth(this.getState());
  }

  /**
   * Returns the mode profile for the current mode.
   */
  public getModeProfile(): TickSchedulerModeProfile {
    return this._modeAdvisor.getProfile(
      this.runContext?.mode ?? this.defaultMode,
    );
  }

  /**
   * Returns the phase profile for the current phase.
   */
  public getPhaseProfile(): TickSchedulerPhaseProfile {
    return this._phaseAdvisor.getProfile(
      this.runContext?.phase ?? this.defaultPhase,
    );
  }

  /**
   * Returns the default mode tempo multiplier for the current mode.
   * Uses TICK_SCHEDULER_DEFAULT_MODE_TEMPO as fallback.
   */
  public getModeTempoMultiplier(): number {
    const mode = this.runContext?.mode ?? this.defaultMode;
    return TIME_CONTRACT_MODE_TEMPO[mode] ?? TICK_SCHEDULER_DEFAULT_MODE_TEMPO;
  }

  // ── PRIVATE CORE ───────────────────────────────────────────────────────────

  private arm(request: TickScheduleRequest): void {
    const durationMs = normalizeDurationMs(request.durationMs);
    this.clearTimer();

    const prevTier = this.currentTier;
    this.currentTier = request.tier;
    this.lastPlannedDurationMs = durationMs;
    this.lastReason = request.reason;
    this.remainingMs = durationMs;
    this.scheduledAtMs = Math.trunc(this.clock.now());
    this.nextFireAtMs = this.scheduledAtMs + durationMs;

    // Track tier changes
    if (prevTier !== request.tier && this.tickNumber > 0) {
      this._tierTracker.recordTransition(
        prevTier,
        request.tier,
        this.tickNumber,
        this.scheduledAtMs,
      );
      this._sessionTracker.recordTierTransition(
        tierToIndex(request.tier) > tierToIndex(prevTier),
      );
    }

    const token = ++this.generation;
    this.timeoutHandle = setTimeout(() => {
      void this.handleTimeout(token);
    }, durationMs);
  }

  private async handleTimeout(token: number): Promise<void> {
    if (token !== this.generation) return;
    await this.executeCurrentSchedule();
  }

  private async executeCurrentSchedule(): Promise<void> {
    if (
      !this.isRunning ||
      this.isPaused ||
      this.isTickInFlight ||
      this.nextFireAtMs === null
    ) {
      return;
    }

    this.isTickInFlight = true;

    const firedAtMs = Math.trunc(this.clock.now());
    const scheduledAtMs = this.scheduledAtMs ?? firedAtMs;
    const plannedDurationMs = this.lastPlannedDurationMs ?? 1;
    const expectedFireAtMs = this.nextFireAtMs;
    const driftMs = firedAtMs - expectedFireAtMs;

    this.tickNumber += 1;
    this.lastFiredAtMs = firedAtMs;
    this.remainingMs = 0;

    try {
      const event: ScheduledTickEvent = Object.freeze({
        tickNumber: this.tickNumber,
        tier: this.currentTier,
        scheduledAtMs,
        plannedDurationMs,
        expectedFireAtMs,
        firedAtMs,
        driftMs,
        reason: this.lastReason,
      });

      this.lastFiredEvent = event;

      // ── Sub-system pipeline ──────────────────────────────────────────────

      // 1. Audit trail
      const auditEntry = this._auditTrail.buildEntry(event, this.runContext);
      this._auditTrail.record(auditEntry);

      // 2. Drift detection
      this._driftDetector.record(event, firedAtMs);

      // 3. Session tracking
      const phase = this.runContext?.phase ?? this.defaultPhase;
      const mode = this.runContext?.mode ?? this.defaultMode;
      this._sessionTracker.recordTick(event, phase, firedAtMs);

      // 4. DL tensor append (using available context)
      this._dlBuilder.appendRow(this.getState(), {
        phase,
        totalBudgetMs: this.runContext?.totalBudgetMs ?? TIME_CONTRACT_MAX_BUDGET_MS,
        remainingBudgetMs: this.runContext?.remainingBudgetMs ?? TIME_CONTRACT_MAX_BUDGET_MS,
        seasonMultiplier: this.runContext?.seasonMultiplier ?? 1.0,
        holdPressure: this.runContext?.holdPressure ?? 0,
        activeDecisionScore: this.runContext?.activeDecisionCount !== undefined
          ? clamp01(this.runContext.activeDecisionCount / 5.0)
          : 0,
        nowMs: firedAtMs,
      });

      // 5. ML extraction
      const mlCtx = this.buildMLContext(event, firedAtMs);
      let mlVector: TimeContractMLVector | null = null;
      if (mlCtx !== null) {
        mlVector = this._mlExtractor.extract(
          this.getState(),
          event,
          this._driftDetector,
          this._tierTracker,
          mlCtx,
        );
        this._analytics.setLastMLVector(mlVector);
      }

      // 6. Narration
      const narration = this._narrator.buildNarration(
        this.getState(), event, phase, mode,
      );

      // 7. Chat emission (only if ML vector available)
      if (mlVector !== null) {
        const dlTensor = this._dlBuilder.buildTensor();
        const _chatEmission = this._chatEmitter.emit(
          this.getState(),
          event,
          narration,
          mlVector,
          dlTensor,
          firedAtMs,
        );
        // Emission is available to consumers via chatEmitter.getLastChannel() etc.
        void _chatEmission;
      }

      // 8. Analytics update
      this._analytics.update(
        this.getState(),
        event,
        this._auditTrail,
        this._driftDetector,
        this._tierTracker,
        this._resilienceScorer,
        this._narrator,
        phase,
        mode,
      );

      // ── Callback dispatch ────────────────────────────────────────────────

      const callbackResult: TickScheduleRequest | null | void =
        this.onTickCallback !== null
          ? await this.onTickCallback(event)
          : undefined;

      if (!this.isRunning || this.isPaused) return;

      if (callbackResult === null) {
        this.stop(false);
        return;
      }

      if (callbackResult === undefined || !isTickScheduleRequest(callbackResult)) {
        this.arm({
          durationMs: plannedDurationMs,
          tier: this.currentTier,
          reason: this.lastReason ?? 'repeat',
        });
        return;
      }

      this.arm({
        durationMs: callbackResult.durationMs,
        tier: callbackResult.tier,
        reason: callbackResult.reason,
      });
    } finally {
      this.isTickInFlight = false;
    }
  }

  /**
   * Builds a TickSchedulerMLContext from the current run context.
   * Returns null if no run context has been set (partial context gracefully handled).
   */
  private buildMLContext(
    event?: ScheduledTickEvent,
    nowMs?: number,
  ): TickSchedulerMLContext | null {
    const ctx = this.runContext;
    const phase = ctx?.phase ?? this.defaultPhase;
    const mode = ctx?.mode ?? this.defaultMode;
    const tick = this.tickNumber;
    const elapsedMs = ctx?.elapsedMs ?? 0;
    const totalBudgetMs = ctx?.totalBudgetMs ?? TIME_CONTRACT_MAX_BUDGET_MS;
    const remainingBudgetMs = ctx?.remainingBudgetMs ?? totalBudgetMs;
    const seasonMultiplier = ctx?.seasonMultiplier ?? 1.0;
    const seasonActive = ctx?.seasonLifecycle === 'ACTIVE';
    const holdPressure = ctx?.holdPressure ?? 0;
    const holdExhausted = ctx?.holdExhausted ?? false;
    const activeDecisionCount = ctx?.activeDecisionCount ?? 0;
    const decisionLatencyScore = ctx?.decisionLatencyScore ?? 0;
    const resolvedNowMs = nowMs ?? Math.trunc(this.clock.now());

    // Compute derived values
    const seasonUtilization =
      ctx !== null && ctx.elapsedMs > 0 && totalBudgetMs > 0
        ? clamp01(elapsedMs / totalBudgetMs)
        : 0;

    const budgetUtilization =
      totalBudgetMs > 0
        ? clamp01((totalBudgetMs - remainingBudgetMs) / totalBudgetMs)
        : 0;

    // Suppress unused variable warning for event — used by callers that
    // supply it to associate the ML context with a specific tick event.
    void event;

    return {
      phase,
      mode,
      tick,
      elapsedMs,
      totalBudgetMs,
      remainingBudgetMs,
      seasonMultiplier,
      seasonActive,
      seasonUtilization,
      holdPressure,
      holdExhausted,
      activeDecisionCount,
      expiredDecisionScore: 0, // not tracked at this level
      decisionLatencyScore,
      projectionFinality: 0,  // not known at this level
      budgetUrgency: budgetUtilization,
      nowMs: resolvedNowMs,
    };
  }

  private clearTimer(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  private resetAllSubSystems(): void {
    this._auditTrail.clear();
    this._driftDetector.reset();
    this._tierTracker.reset();
    this._dlBuilder.reset();
    this._chatEmitter.reset();
    this._sessionTracker.reset();
    this._analytics.reset();
  }
}

// ============================================================================
// SECTION 18 — FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a TickScheduler configured for Empire mode (solo/GO ALONE).
 * Uses passthrough callback that repeats the initial request indefinitely.
 * Empire mode: standard cadence, moderate pressure (×1.0 tempo).
 *
 * @example
 * ```ts
 * const scheduler = createEmpireModeScheduler(
 *   { durationMs: 13_000, tier: 'T1' }
 * );
 * scheduler.start({ durationMs: 13_000, tier: 'T1' });
 * ```
 */
export function createEmpireModeScheduler(
  initialRequest: TickScheduleRequest,
  clock?: ClockSource,
): TickScheduler {
  const scheduler = new TickScheduler('solo', 'FOUNDATION', clock);
  scheduler.setOnTick(createPassthroughTickCallback(initialRequest));
  return scheduler;
}

/**
 * Creates a TickScheduler configured for Predator mode (pvp/HEAD TO HEAD).
 * Uses passthrough callback. Predator mode: accelerated cadence (×1.25 tempo).
 *
 * The accelerated tempo means tick durations should be ~20% shorter than solo.
 * ModeAdvisor.recommendDurationMs('pvp', tier) provides the advised duration.
 *
 * @example
 * ```ts
 * const scheduler = createPredatorModeScheduler(
 *   { durationMs: 10_400, tier: 'T1' }  // 13_000 / 1.25
 * );
 * ```
 */
export function createPredatorModeScheduler(
  initialRequest: TickScheduleRequest,
  clock?: ClockSource,
): TickScheduler {
  const scheduler = new TickScheduler('pvp', 'FOUNDATION', clock);
  scheduler.setOnTick(createPassthroughTickCallback(initialRequest));
  return scheduler;
}

/**
 * Creates a TickScheduler configured for Syndicate mode (coop/TEAM UP).
 * Uses passthrough callback. Syndicate mode: relaxed cadence (×0.9 tempo).
 *
 * Slightly longer tick windows to accommodate team coordination overhead.
 *
 * @example
 * ```ts
 * const scheduler = createSyndicateModeScheduler(
 *   { durationMs: 14_444, tier: 'T1' }  // 13_000 / 0.9
 * );
 * ```
 */
export function createSyndicateModeScheduler(
  initialRequest: TickScheduleRequest,
  clock?: ClockSource,
): TickScheduler {
  const scheduler = new TickScheduler('coop', 'FOUNDATION', clock);
  scheduler.setOnTick(createPassthroughTickCallback(initialRequest));
  return scheduler;
}

/**
 * Creates a TickScheduler configured for Phantom mode (ghost/CHASE A LEGEND).
 * Uses passthrough callback. Phantom mode: precision cadence (×1.15 tempo).
 *
 * Ghost mode has the tightest drift tolerance and highest difficulty multiplier.
 * Every tick is scored against the ghost player's reference timeline.
 *
 * @example
 * ```ts
 * const scheduler = createPhantomModeScheduler(
 *   { durationMs: 11_304, tier: 'T1' }  // 13_000 / 1.15
 * );
 * ```
 */
export function createPhantomModeScheduler(
  initialRequest: TickScheduleRequest,
  clock?: ClockSource,
): TickScheduler {
  const scheduler = new TickScheduler('ghost', 'FOUNDATION', clock);
  scheduler.setOnTick(createPassthroughTickCallback(initialRequest));
  return scheduler;
}

/**
 * Creates a one-shot terminal TickScheduler that fires once then stops.
 * Uses createTerminalTickCallback which returns null to halt scheduling.
 *
 * Useful for single-event simulation, replay checkpoints, or test harnesses.
 */
export function createTerminalScheduler(clock?: ClockSource): TickScheduler {
  const scheduler = new TickScheduler('solo', 'FOUNDATION', clock);
  scheduler.setOnTick(createTerminalTickCallback());
  return scheduler;
}

/**
 * Creates a debug/test TickScheduler with a recording callback.
 * Each tick is recorded in the provided array for test assertions.
 *
 * @example
 * ```ts
 * const events: ScheduledTickEvent[] = [];
 * const scheduler = createDebugScheduler(events);
 * scheduler.start({ durationMs: 100, tier: 'T1' });
 * await sleep(500);
 * scheduler.stop();
 * // events contains all fired tick events
 * ```
 */
export function createDebugScheduler(
  events: ScheduledTickEvent[],
  maxTicks = 100,
  clock?: ClockSource,
): TickScheduler {
  let count = 0;
  const scheduler = new TickScheduler('solo', 'FOUNDATION', clock);
  scheduler.setOnTick((event: ScheduledTickEvent) => {
    events.push(event);
    count++;
    if (count >= maxTicks) return null; // stop after maxTicks
    return undefined; // continue with same request
  });
  return scheduler;
}

/**
 * Creates a TickScheduler seeded with a run context and optimal duration.
 * The scheduler uses ModeAdvisor and PhaseAdvisor to auto-configure duration.
 *
 * This is the recommended factory for engine integration — consumers call:
 * ```ts
 * const scheduler = createSchedulerForRun({ mode: 'solo', phase: 'FOUNDATION', ... });
 * scheduler.setOnTick(myCallback);
 * scheduler.start({ durationMs: scheduler.getRecommendedNextDurationMs(), tier: 'T1' });
 * ```
 */
export function createSchedulerForRun(
  ctx: TickSchedulerRunContext,
  clock?: ClockSource,
): TickScheduler {
  const scheduler = new TickScheduler(ctx.mode, ctx.phase, clock);
  scheduler.setRunContext(ctx);
  return scheduler;
}

/**
 * Returns the normalized tempo multiplier for a mode.
 * Convenience function exposing TIME_CONTRACT_MODE_TEMPO directly.
 */
export function getModeTempoForScheduler(mode: ModeCode): number {
  return TIME_CONTRACT_MODE_TEMPO[mode];
}

/**
 * Returns the index-to-tier mapping for serialization/deserialization.
 * Exposes indexToTier helper for external consumers.
 */
export function schedulerTierFromIndex(index: number): PressureTier {
  return indexToTier(index);
}

/**
 * Returns the tier-to-index mapping for ML feature ordering.
 * Exposes tierToIndex helper for external consumers.
 */
export function schedulerIndexFromTier(tier: PressureTier): number {
  return tierToIndex(tier);
}

/**
 * Returns the TickTier config for a given PressureTier.
 * Convenience re-export of getTickTierConfigByPressureTier using the
 * full TICK_TIER_CONFIGS surface.
 */
export function getSchedulerTierConfig(tier: PressureTier): TickTierConfig {
  return getTickTierConfig(
    TICK_TIER_BY_PRESSURE_TIER[tier],
  );
}

/**
 * Returns the TickTier enum for a PressureTier.
 * Exposes tickTierToPressureTier for the reverse mapping.
 *
 * @example
 * ```ts
 * const tickTier = schedulerTickTierFor('T3'); // TickTier.CRISIS
 * const backTier = schedulerPressureTierFor(tickTier); // 'T3'
 * ```
 */
export function schedulerTickTierFor(tier: PressureTier): TickTier {
  return pressureTierToTickTier(tier);
}

export function schedulerPressureTierFor(tier: TickTier): PressureTier {
  return tickTierToPressureTier(tier);
}

// ============================================================================
// SECTION 19 — TYPE GUARD EXPORTS AND UTILITY RE-EXPORTS
// ============================================================================

/**
 * Type guard: returns true if v is a valid PressureTier string.
 * Re-exported for consumer convenience (avoids re-implementing in dependents).
 */
export function isValidPressureTier(v: unknown): v is PressureTier {
  return isPressureTier(v);
}

/**
 * Type guard: returns true if v is a valid ModeCode string.
 * Re-exported for consumer convenience.
 */
export function isValidModeCode(v: unknown): v is ModeCode {
  return isModeCode(v);
}

/**
 * Type guard: returns true if v is a valid RunPhase string.
 * Re-exported for consumer convenience.
 */
export function isValidRunPhase(v: unknown): v is RunPhase {
  return isRunPhase(v);
}

/**
 * Returns the TICK_TIER_CONFIGS surface for external consumers that need
 * the full tier configuration table (not just a single tier lookup).
 *
 * Useful for build-time config validation and test harnesses.
 * Named with `Scheduler` prefix to avoid collision with RunTimeoutGuard exports.
 */
export function getSchedulerAllTickTierConfigs(): typeof TICK_TIER_CONFIGS {
  return TICK_TIER_CONFIGS;
}

/**
 * Returns the full TIER_DURATIONS_MS map for consumers that need
 * all default durations at once (e.g., timeline visualization).
 */
export function getAllTierDurationsMs(): typeof TIER_DURATIONS_MS {
  return TIER_DURATIONS_MS;
}

/**
 * Returns the full DECISION_WINDOW_DURATIONS_MS map.
 * Useful for building UI decision-timer components.
 * Named with `Scheduler` prefix to avoid collision with RunTimeoutGuard exports.
 */
export function getSchedulerAllDecisionWindowDurationsMs(): typeof DECISION_WINDOW_DURATIONS_MS {
  return DECISION_WINDOW_DURATIONS_MS;
}

/**
 * Returns a plain-object representation of the TickSchedulerState
 * suitable for JSON serialization (all values are primitive or null).
 */
export function serializeSchedulerState(
  state: TickSchedulerState,
): Record<string, unknown> {
  return {
    tickNumber: state.tickNumber,
    currentTier: state.currentTier,
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    isTickInFlight: state.isTickInFlight,
    scheduledAtMs: state.scheduledAtMs,
    nextFireAtMs: state.nextFireAtMs,
    remainingMs: state.remainingMs,
    lastPlannedDurationMs: state.lastPlannedDurationMs,
    lastFiredAtMs: state.lastFiredAtMs,
  };
}

/**
 * Returns a plain-object representation of a ScheduledTickEvent
 * suitable for JSON serialization / replay audit logging.
 */
export function serializeTickEvent(
  event: ScheduledTickEvent,
): Record<string, unknown> {
  return {
    tickNumber: event.tickNumber,
    tier: event.tier,
    scheduledAtMs: event.scheduledAtMs,
    plannedDurationMs: event.plannedDurationMs,
    expectedFireAtMs: event.expectedFireAtMs,
    firedAtMs: event.firedAtMs,
    driftMs: event.driftMs,
    reason: event.reason ?? null,
  };
}

/**
 * Returns a compact string key for a scheduler state snapshot.
 * Useful as a cache key or dedup token in replay pipelines.
 *
 * Format: `{tickNumber}:{tier}:{isRunning ? 'R' : 'S'}:{nextFireAtMs ?? 0}`
 */
export function schedulerStateKey(state: TickSchedulerState): string {
  const runFlag = state.isRunning ? 'R' : 'S';
  const fireAt = state.nextFireAtMs ?? 0;
  return `${state.tickNumber}:${state.currentTier}:${runFlag}:${fireAt}`;
}

/**
 * Returns a compact string key for a ScheduledTickEvent.
 * Useful for deduplication in event buses.
 *
 * Format: `{tickNumber}:{tier}:{firedAtMs}`
 */
export function tickEventKey(event: ScheduledTickEvent): string {
  return `${event.tickNumber}:${event.tier}:${event.firedAtMs}`;
}

/**
 * Computes the budget utilization ratio from a run context.
 * Returns 0 if totalBudgetMs is 0 or context is null.
 */
export function computeBudgetUtilization(
  ctx: TickSchedulerRunContext | null,
): number {
  if (ctx === null || ctx.totalBudgetMs <= 0) return 0;
  return clamp01(
    (ctx.totalBudgetMs - ctx.remainingBudgetMs) / ctx.totalBudgetMs,
  );
}

/**
 * Returns true if the given run context indicates a budget-critical state.
 * Uses TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT for the threshold.
 *
 * Named `isSchedulerBudgetCritical` to avoid collision with the
 * contracts.ts `isBudgetCritical(TimeBudgetProjection)` overload.
 */
export function isSchedulerBudgetCritical(ctx: TickSchedulerRunContext | null): boolean {
  return (
    computeBudgetUtilization(ctx) >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT
  );
}

/**
 * Returns true if the given run context has entered the SOVEREIGNTY phase.
 * Checks both the explicit phase field and elapsed vs PHASE_BOUNDARIES_MS.
 */
export function isInSovereigntyPhase(
  ctx: TickSchedulerRunContext | null,
): boolean {
  if (ctx === null) return false;
  if (ctx.phase === 'SOVEREIGNTY') return true;
  // Double-check via elapsed time if available
  const resolved = resolvePhaseFromElapsedMs(ctx.elapsedMs);
  return resolved === 'SOVEREIGNTY';
}

/**
 * Returns the season pressure multiplier delta above baseline (1.0).
 * Used for ML feature extraction in external consumers.
 *
 * Returns 0 if ctx is null or multiplier is at baseline.
 */
export function getSeasonPressureDelta(
  ctx: TickSchedulerRunContext | null,
): number {
  if (ctx === null) return 0;
  const mult = ctx.seasonMultiplier ?? 1.0;
  return Math.max(0, mult - 1.0);
}

/**
 * Returns the TimeContractChatSignal type alias for documentation purposes.
 * This is a type-only re-export to confirm the type is recognized by the module.
 */
export type { TimeContractChatSignal };
