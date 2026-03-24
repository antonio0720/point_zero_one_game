/**
 * POINT ZERO ONE — ORCHESTRATOR DIAGNOSTICS
 * File: pzo-web/src/engines/core/OrchestratorDiagnostics.ts
 *
 * Purpose:
 * - Provide deterministic, lightweight diagnostics for EngineOrchestrator
 * - Measure tick pacing, drift, step timings, queue flush cost, event volume,
 *   and time-engine instability (tier oscillation, countdown backlog, timeout pressure)
 * - Compute percentile statistics (P50 / P95 / P99) for every measured dimension
 * - Detect step bottlenecks and regression trends
 * - Produce operator-grade health reports and serializable exports
 * - Never mutate gameplay state
 */

import type {
  TickTier,
  StepPerformanceProfile,
  HealthReport,
  EngineSystemStatus,
  DiagnosticsExport,
  EngineHealthAlert,
  EngineHealthAlertCode,
} from './types';

// ── Re-export types for consumers that import only from this module ────────────
export type { StepPerformanceProfile, HealthReport, EngineSystemStatus, DiagnosticsExport };

// ── OrchestratorStepName ──────────────────────────────────────────────────────
// These exact string literals MUST match what EngineOrchestrator passes to runStep().
// Mismatch here means diagnostics never records step durations.

export type OrchestratorStepName =
  | 'STEP_01_TIME_ADVANCE'
  | 'STEP_02_PRESSURE_COMPUTE'
  | 'STEP_03_TENSION_UPDATE'
  | 'STEP_04_SHIELD_PASSIVE_DECAY'
  | 'STEP_05_BATTLE_EVALUATE'
  | 'STEP_06_BATTLE_ATTACKS'
  | 'STEP_07_SHIELD_APPLY_ATTACKS'
  | 'STEP_08_CASCADE_EXECUTE_LINKS'
  | 'STEP_09_CASCADE_RECOVERY'
  | 'STEP_10_PRESSURE_RECOMPUTE'
  | 'STEP_11_TIME_SET_TIER'
  | 'STEP_12_SOVEREIGNTY_SNAPSHOT'
  | 'STEP_13_OUTCOME_RESOLUTION';

export const ORCHESTRATOR_STEP_NAMES: readonly OrchestratorStepName[] = Object.freeze([
  'STEP_01_TIME_ADVANCE',
  'STEP_02_PRESSURE_COMPUTE',
  'STEP_03_TENSION_UPDATE',
  'STEP_04_SHIELD_PASSIVE_DECAY',
  'STEP_05_BATTLE_EVALUATE',
  'STEP_06_BATTLE_ATTACKS',
  'STEP_07_SHIELD_APPLY_ATTACKS',
  'STEP_08_CASCADE_EXECUTE_LINKS',
  'STEP_09_CASCADE_RECOVERY',
  'STEP_10_PRESSURE_RECOMPUTE',
  'STEP_11_TIME_SET_TIER',
  'STEP_12_SOVEREIGNTY_SNAPSHOT',
  'STEP_13_OUTCOME_RESOLUTION',
] as const);

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface TickWindowSample {
  readonly tickIndex:            number;
  readonly tier:                 TickTier | null;
  readonly scheduledDurationMs:  number;
  readonly actualDurationMs:     number;
  readonly driftMs:              number;
  readonly stepDurationsMs:      Partial<Record<OrchestratorStepName, number>>;
  readonly flushDurationMs:      number;
  readonly emittedEventCount:    number;
  readonly openDecisionWindowCount: number;
  readonly timestamp:            number;
  /** True if at least one step errored during this tick. */
  readonly hadStepError:         boolean;
}

export interface OrchestratorDiagnosticThresholds {
  maxAllowedDriftMs:              number;
  maxAllowedFlushMs:              number;
  maxAllowedSingleStepMs:         number;
  maxAllowedOpenDecisionWindows:  number;
  tierOscillationWindow:          number;
  tierOscillationTripCount:       number;
  /** P95 drift threshold — alert fires when computed P95 exceeds this. */
  p95DriftAlertMs:                number;
  /** Minimum call count before percentile alerts are eligible to fire. */
  minSamplesForPercentileAlert:   number;
}

export interface OrchestratorAlert {
  readonly code:      EngineHealthAlertCode | 'SLOW_STEP' | 'SLOW_FLUSH' | 'HIGH_TICK_DRIFT' | 'WINDOW_BACKLOG' | 'RUNAWAY_EVENT_VOLUME';
  readonly message:   string;
  readonly tickIndex: number;
  readonly metadata?: Record<string, unknown>;
}

export interface OrchestratorDiagnosticsSnapshot {
  readonly generatedAt:            number;
  readonly totalTicksObserved:     number;
  readonly lastTickIndex:          number;
  readonly currentTier:            TickTier | null;
  readonly avgScheduledDurationMs: number;
  readonly avgActualDurationMs:    number;
  readonly avgDriftMs:             number;
  readonly maxDriftMs:             number;
  readonly p50DriftMs:             number;
  readonly p95DriftMs:             number;
  readonly p99DriftMs:             number;
  readonly avgFlushDurationMs:     number;
  readonly maxFlushDurationMs:     number;
  readonly p95FlushDurationMs:     number;
  readonly maxSingleStepMs:        number;
  readonly totalEventsObserved:    number;
  readonly avgEventsPerTick:       number;
  readonly maxOpenDecisionWindowCount: number;
  readonly tierTransitionCount:    number;
  readonly recentTierSequence:     TickTier[];
  readonly alerts:                 OrchestratorAlert[];
  readonly lastTick:               TickWindowSample | null;
  readonly stepBottlenecks:        ReadonlyArray<{ stepName: string; avgMs: number }>;
  readonly healthScore:            number; // 0–100
}

// ── Default thresholds ────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: OrchestratorDiagnosticThresholds = {
  maxAllowedDriftMs:              150,
  maxAllowedFlushMs:              32,
  maxAllowedSingleStepMs:         24,
  maxAllowedOpenDecisionWindows:  8,
  tierOscillationWindow:          8,
  tierOscillationTripCount:       4,
  p95DriftAlertMs:                200,
  minSamplesForPercentileAlert:   20,
};

// ── Math helpers ──────────────────────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Computes the p-th percentile of `values` using linear interpolation.
 * `p` must be in [0, 1]. Values do not need to be sorted in advance.
 */
function percentileOf(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0]!;

  const sorted = [...values].sort((a, b) => a - b);
  const rank   = p * (sorted.length - 1);
  const lower  = Math.floor(rank);
  const upper  = Math.ceil(rank);
  if (lower === upper) return sorted[lower]!;
  const frac = rank - lower;
  return sorted[lower]! + frac * (sorted[upper]! - sorted[lower]!);
}

// ── Per-step accumulator ──────────────────────────────────────────────────────

interface StepAccumulator {
  durations:  number[];
  errorCount: number;
}

// ── OrchestratorDiagnostics class ─────────────────────────────────────────────

export class OrchestratorDiagnostics {
  private readonly history: TickWindowSample[] = [];
  private readonly recentTiers: TickTier[] = [];
  private readonly alerts: OrchestratorAlert[] = [];
  private readonly maxHistory: number;

  private tickStartHrMs:       number | null = null;
  private flushStartHrMs:      number | null = null;
  private lastScheduledDurationMs = 0;
  private currentTickIndex     = 0;
  private currentTier:         TickTier | null = null;
  private currentStepDurations: Partial<Record<OrchestratorStepName, number>> = {};
  private currentEventCount    = 0;
  private currentOpenWindowCount = 0;
  private tierTransitionCount  = 0;
  private lastTickCompletedAtMs: number | null = null;
  private currentHadError      = false;

  /** Per-step accumulated measurements for percentile computation. */
  private readonly stepAccumulators: Map<string, StepAccumulator> = new Map();

  /** Cached per-step profiles — rebuilt lazily when history changes. */
  private cachedStepProfiles: StepPerformanceProfile[] | null = null;

  public constructor(
    private readonly thresholds: OrchestratorDiagnosticThresholds = DEFAULT_THRESHOLDS,
    historySize = 256,
  ) {
    this.maxHistory = Math.max(32, historySize);
  }

  // ── Lifecycle hooks called by EngineOrchestrator ───────────────────────────

  public onTickScheduled(tickIndex: number, scheduledDurationMs: number, tier: TickTier | null): void {
    this.currentTickIndex         = tickIndex;
    this.currentTier              = tier;
    this.lastScheduledDurationMs  = scheduledDurationMs;
    this.currentHadError          = false;
  }

  public onTickStarted(): void {
    this.tickStartHrMs      = performance.now();
    this.currentStepDurations = {};
    this.currentEventCount  = 0;
    this.cachedStepProfiles = null; // invalidate cache
  }

  public onStepCompleted(step: OrchestratorStepName, durationMs: number): void {
    this.currentStepDurations[step] = durationMs;

    // Per-step accumulator
    let acc = this.stepAccumulators.get(step);
    if (!acc) { acc = { durations: [], errorCount: 0 }; this.stepAccumulators.set(step, acc); }
    acc.durations.push(durationMs);

    if (durationMs > this.thresholds.maxAllowedSingleStepMs) {
      this.pushAlert({
        code:      'SLOW_STEP',
        message:   `Step ${step} took ${durationMs.toFixed(1)}ms (limit ${this.thresholds.maxAllowedSingleStepMs}ms)`,
        tickIndex: this.currentTickIndex,
        metadata:  { step, durationMs },
      });
    }
  }

  public onStepErrored(step: OrchestratorStepName, durationMs: number, errorMessage: string): void {
    this.currentHadError = true;
    let acc = this.stepAccumulators.get(step);
    if (!acc) { acc = { durations: [], errorCount: 0 }; this.stepAccumulators.set(step, acc); }
    acc.durations.push(durationMs);
    acc.errorCount += 1;

    this.pushAlert({
      code:      'STEP_TIMEOUT',
      message:   `Step ${step} errored: ${errorMessage}`,
      tickIndex: this.currentTickIndex,
      metadata:  { step, durationMs, errorMessage },
    });
  }

  public onTierChanged(from: TickTier | null, to: TickTier): void {
    if (from === to) return;

    this.tierTransitionCount += 1;
    this.recentTiers.push(to);

    while (this.recentTiers.length > this.thresholds.tierOscillationWindow) {
      this.recentTiers.shift();
    }

    const changes = this.recentTiers.reduce((count, tier, index, arr) => {
      if (index === 0) return count;
      return count + Number(arr[index - 1] !== tier);
    }, 0);

    if (changes >= this.thresholds.tierOscillationTripCount) {
      this.pushAlert({
        code:      'TIER_OSCILLATION',
        message:   `Tick tier oscillating too frequently (${changes} changes in last ${this.recentTiers.length} ticks)`,
        tickIndex: this.currentTickIndex,
        metadata:  { recentTiers: [...this.recentTiers], changes },
      });
    }
  }

  public onEventEmitted(count = 1): void {
    this.currentEventCount += count;
    if (this.currentEventCount > 128) {
      this.pushAlert({
        code:      'RUNAWAY_EVENT_VOLUME',
        message:   `Per-tick event volume exceeded 128 (currently ${this.currentEventCount})`,
        tickIndex: this.currentTickIndex,
        metadata:  { currentEventCount: this.currentEventCount },
      });
    }
  }

  public onDecisionWindowCountUpdated(openDecisionWindowCount: number): void {
    this.currentOpenWindowCount = openDecisionWindowCount;

    if (openDecisionWindowCount > this.thresholds.maxAllowedOpenDecisionWindows) {
      this.pushAlert({
        code:      'WINDOW_BACKLOG',
        message:   `Open decision windows (${openDecisionWindowCount}) exceeded threshold (${this.thresholds.maxAllowedOpenDecisionWindows})`,
        tickIndex: this.currentTickIndex,
        metadata:  { openDecisionWindowCount, threshold: this.thresholds.maxAllowedOpenDecisionWindows },
      });
    }
  }

  public onFlushStarted(): void {
    this.flushStartHrMs = performance.now();
  }

  public onTickCompleted(): TickWindowSample {
    const completedAt     = performance.now();
    const startedAt       = this.tickStartHrMs ?? completedAt;
    const actualDurationMs = Math.max(0, completedAt - startedAt);
    const driftMs          = actualDurationMs - this.lastScheduledDurationMs;
    const flushDurationMs  = this.flushStartHrMs === null
      ? 0
      : Math.max(0, completedAt - this.flushStartHrMs);

    if (Math.abs(driftMs) > this.thresholds.maxAllowedDriftMs) {
      this.pushAlert({
        code:      'HIGH_TICK_DRIFT',
        message:   `Tick wall-time drifted ${driftMs.toFixed(1)}ms from scheduled ${this.lastScheduledDurationMs}ms`,
        tickIndex: this.currentTickIndex,
        metadata:  { scheduledDurationMs: this.lastScheduledDurationMs, actualDurationMs, driftMs },
      });
    }

    if (flushDurationMs > this.thresholds.maxAllowedFlushMs) {
      this.pushAlert({
        code:      'SLOW_FLUSH',
        message:   `EventBus flush took ${flushDurationMs.toFixed(1)}ms (limit ${this.thresholds.maxAllowedFlushMs}ms)`,
        tickIndex: this.currentTickIndex,
        metadata:  { flushDurationMs, threshold: this.thresholds.maxAllowedFlushMs },
      });
    }

    // Check P95 drift (only after enough samples)
    if (this.history.length >= this.thresholds.minSamplesForPercentileAlert) {
      const drifts = this.history.map((s) => Math.abs(s.driftMs));
      const p95    = percentileOf(drifts, 0.95);
      if (p95 > this.thresholds.p95DriftAlertMs) {
        this.pushAlert({
          code:      'HIGH_TICK_DRIFT',
          message:   `P95 tick drift (${p95.toFixed(1)}ms) exceeded threshold (${this.thresholds.p95DriftAlertMs}ms)`,
          tickIndex: this.currentTickIndex,
          metadata:  { p95DriftMs: p95, threshold: this.thresholds.p95DriftAlertMs },
        });
      }
    }

    const sample: TickWindowSample = {
      tickIndex:            this.currentTickIndex,
      tier:                 this.currentTier,
      scheduledDurationMs:  this.lastScheduledDurationMs,
      actualDurationMs,
      driftMs,
      stepDurationsMs:      { ...this.currentStepDurations },
      flushDurationMs,
      emittedEventCount:    this.currentEventCount,
      openDecisionWindowCount: this.currentOpenWindowCount,
      timestamp:            Date.now(),
      hadStepError:         this.currentHadError,
    };

    this.history.push(sample);
    while (this.history.length > this.maxHistory) this.history.shift();

    this.tickStartHrMs        = null;
    this.flushStartHrMs       = null;
    this.lastTickCompletedAtMs = sample.timestamp;

    return sample;
  }

  // ── Percentile computation ─────────────────────────────────────────────────

  /**
   * Computes the P50 / P95 / P99 values for the given history field.
   * `field` can be 'driftMs', 'flushDurationMs', 'actualDurationMs'.
   */
  public computeFieldPercentiles(
    field: 'driftMs' | 'flushDurationMs' | 'actualDurationMs',
  ): { p50: number; p95: number; p99: number } {
    const values = this.history.map((s) => Math.abs(s[field]));
    return {
      p50: percentileOf(values, 0.50),
      p95: percentileOf(values, 0.95),
      p99: percentileOf(values, 0.99),
    };
  }

  // ── Step profiling ─────────────────────────────────────────────────────────

  /**
   * Returns a complete StepPerformanceProfile for every step that has been
   * recorded at least once. Sorted by avgDurationMs descending (slowest first).
   */
  public getStepProfiles(): StepPerformanceProfile[] {
    if (this.cachedStepProfiles !== null) return this.cachedStepProfiles;

    const profiles: StepPerformanceProfile[] = [];

    for (const [stepName, acc] of this.stepAccumulators.entries()) {
      if (acc.durations.length === 0) continue;

      const durations = acc.durations;
      const total     = durations.reduce((s, v) => s + v, 0);
      const calls     = durations.length;

      profiles.push({
        stepName,
        callCount:       calls,
        totalDurationMs: total,
        avgDurationMs:   total / calls,
        minDurationMs:   Math.min(...durations),
        maxDurationMs:   Math.max(...durations),
        p50DurationMs:   percentileOf(durations, 0.50),
        p95DurationMs:   percentileOf(durations, 0.95),
        p99DurationMs:   percentileOf(durations, 0.99),
        errorCount:      acc.errorCount,
        errorRate:       calls > 0 ? acc.errorCount / calls : 0,
      });
    }

    profiles.sort((a, b) => b.avgDurationMs - a.avgDurationMs);
    this.cachedStepProfiles = profiles;
    return profiles;
  }

  // ── Bottleneck detection ───────────────────────────────────────────────────

  /**
   * Returns the top N slowest steps by average duration.
   * A step is considered a bottleneck if its avgDurationMs > threshold.
   */
  public detectBottlenecks(
    topN = 3,
    thresholdMs = this.thresholds.maxAllowedSingleStepMs,
  ): StepPerformanceProfile[] {
    return this.getStepProfiles()
      .filter((p) => p.avgDurationMs > thresholdMs)
      .slice(0, topN);
  }

  /**
   * Returns steps that are showing regression — their most recent `windowSize`
   * average is worse than their overall average by more than `regressionPct`.
   */
  public detectRegressions(windowSize = 10, regressionPct = 0.20): StepPerformanceProfile[] {
    const regressions: StepPerformanceProfile[] = [];

    for (const [stepName, acc] of this.stepAccumulators.entries()) {
      if (acc.durations.length < windowSize * 2) continue;
      const recent  = acc.durations.slice(-windowSize);
      const overall = acc.durations.slice(0, -windowSize);
      const recentAvg  = avg(recent);
      const overallAvg = avg(overall);
      if (overallAvg > 0 && (recentAvg - overallAvg) / overallAvg > regressionPct) {
        // Step is regressing — re-compute a profile for just the recent window
        regressions.push({
          stepName,
          callCount:       recent.length,
          totalDurationMs: recent.reduce((s, v) => s + v, 0),
          avgDurationMs:   recentAvg,
          minDurationMs:   Math.min(...recent),
          maxDurationMs:   Math.max(...recent),
          p50DurationMs:   percentileOf(recent, 0.50),
          p95DurationMs:   percentileOf(recent, 0.95),
          p99DurationMs:   percentileOf(recent, 0.99),
          errorCount:      acc.errorCount,
          errorRate:       acc.durations.length > 0 ? acc.errorCount / acc.durations.length : 0,
        });
      }
    }

    return regressions;
  }

  // ── Health score ───────────────────────────────────────────────────────────

  /**
   * Computes a 0–100 health score based on:
   *   - Drift score      (35 pts)
   *   - Flush score      (20 pts)
   *   - Step score       (25 pts)
   *   - Window score     (10 pts)
   *   - Alert penalty    (up to -10 pts per critical alert)
   */
  public computeHealthScore(): number {
    if (this.history.length === 0) return 100;

    const driftPercentiles = this.computeFieldPercentiles('driftMs');
    const flushPercentiles = this.computeFieldPercentiles('flushDurationMs');

    // Drift score: 35 pts — full when P95 drift < maxAllowedDrift
    const driftRatio    = Math.min(1, driftPercentiles.p95 / Math.max(1, this.thresholds.maxAllowedDriftMs));
    const driftScore    = 35 * (1 - driftRatio);

    // Flush score: 20 pts
    const flushRatio    = Math.min(1, flushPercentiles.p95 / Math.max(1, this.thresholds.maxAllowedFlushMs));
    const flushScore    = 20 * (1 - flushRatio);

    // Step score: 25 pts — based on max avg step vs threshold
    const profiles      = this.getStepProfiles();
    const maxStepAvg    = profiles.length > 0 ? Math.max(...profiles.map((p) => p.avgDurationMs)) : 0;
    const stepRatio     = Math.min(1, maxStepAvg / Math.max(1, this.thresholds.maxAllowedSingleStepMs));
    const stepScore     = 25 * (1 - stepRatio);

    // Window score: 10 pts
    const windowMax     = this.history.length > 0
      ? Math.max(...this.history.map((s) => s.openDecisionWindowCount))
      : 0;
    const windowRatio   = Math.min(1, windowMax / Math.max(1, this.thresholds.maxAllowedOpenDecisionWindows));
    const windowScore   = 10 * (1 - windowRatio);

    // Alert penalty: critical alerts penalise up to 10pts each, max 30pts total
    const criticalCount = this.alerts.filter((a) => {
      // Treat any alert as critical if in this set
      return a.code === 'TIER_OSCILLATION' || a.code === 'RUNAWAY_EVENT_VOLUME';
    }).length;
    const alertPenalty  = Math.min(30, criticalCount * 10);

    return Math.max(0, Math.round(driftScore + flushScore + stepScore + windowScore - alertPenalty));
  }

  // ── Health report ──────────────────────────────────────────────────────────

  /**
   * Builds a complete HealthReport. Calls computeHealthScore() internally.
   * Recommendations are generated based on thresholds.
   */
  public getHealthReport(): HealthReport {
    const score          = this.computeHealthScore();
    const driftP95       = this.computeFieldPercentiles('driftMs').p95;
    const flushP95       = this.computeFieldPercentiles('flushDurationMs').p95;
    const bottlenecks    = this.detectBottlenecks(5);
    const regressions    = this.detectRegressions();

    const status: EngineSystemStatus =
      score >= 80 ? 'HEALTHY'  :
      score >= 50 ? 'DEGRADED' :
      score >   0 ? 'CRITICAL' :
      'UNKNOWN';

    const recommendations: string[] = [];
    if (driftP95 > this.thresholds.maxAllowedDriftMs) {
      recommendations.push(`Reduce tick scheduler contention — P95 drift is ${driftP95.toFixed(0)}ms.`);
    }
    if (flushP95 > this.thresholds.maxAllowedFlushMs) {
      recommendations.push(`EventBus flush P95 is ${flushP95.toFixed(0)}ms — audit subscriber count or complexity.`);
    }
    for (const b of bottlenecks) {
      recommendations.push(`Step ${b.stepName} avg ${b.avgDurationMs.toFixed(1)}ms — investigate engine load.`);
    }
    for (const r of regressions) {
      recommendations.push(`Step ${r.stepName} is regressing — recent avg ${r.avgDurationMs.toFixed(1)}ms.`);
    }
    if (this.tierTransitionCount > this.history.length * 0.3 && this.history.length > 10) {
      recommendations.push('Tier oscillation detected — pressure score may be noisy. Check signal weights.');
    }

    const criticalAlertCount = this.alerts.filter(
      (a) => a.code === 'TIER_OSCILLATION' || a.code === 'RUNAWAY_EVENT_VOLUME',
    ).length;

    return {
      generatedAtMs:         Date.now(),
      overallScore:          score,
      status,
      tickPaceHealth:        Math.round(Math.max(0, 100 - (driftP95 / Math.max(1, this.thresholds.maxAllowedDriftMs)) * 100)),
      eventBusHealth:        Math.round(Math.max(0, 100 - (flushP95 / Math.max(1, this.thresholds.maxAllowedFlushMs)) * 100)),
      decisionWindowHealth:  this.computeWindowHealth(),
      tierStabilityHealth:   this.computeTierStabilityHealth(),
      stepPerformanceHealth: bottlenecks.length === 0 ? 100 : Math.max(0, 100 - bottlenecks.length * 20),
      activeAlertCount:      this.alerts.length,
      criticalAlertCount,
      recommendations:       Object.freeze(recommendations),
    };
  }

  // ── EngineHealthAlert array (typed for upstream consumers) ─────────────────

  /**
   * Returns the alert history as a readonly array of EngineHealthAlert,
   * suitable for EngineHealthStatus.activeAlerts.
   */
  public getTypedAlerts(): ReadonlyArray<EngineHealthAlert> {
    return this.alerts.map((a) => ({
      code:        a.code as EngineHealthAlertCode,
      message:     a.message,
      severity:    this.alertSeverity(a.code),
      tickIndex:   a.tickIndex,
      timestampMs: Date.now(),
      ...(a.metadata !== undefined ? { metadata: a.metadata as Readonly<Record<string, unknown>> } : {}),
    }));
  }

  // ── Serialization ──────────────────────────────────────────────────────────

  /**
   * Serializes the complete diagnostics state to a JSON-safe DiagnosticsExport.
   * Use for logging, remote telemetry, or cross-session comparison.
   */
  public toExport(runId: string | null = null): DiagnosticsExport {
    const driftP = this.computeFieldPercentiles('driftMs');
    const flushP = this.computeFieldPercentiles('flushDurationMs');

    return {
      exportedAtMs:       Date.now(),
      runId,
      totalTicksObserved: this.history.length,
      avgDriftMs:         avg(this.history.map((s) => Math.abs(s.driftMs))),
      maxDriftMs:         this.history.length ? Math.max(...this.history.map((s) => Math.abs(s.driftMs))) : 0,
      p95DriftMs:         driftP.p95,
      avgFlushMs:         avg(this.history.map((s) => s.flushDurationMs)),
      maxFlushMs:         this.history.length ? Math.max(...this.history.map((s) => s.flushDurationMs)) : 0,
      stepProfiles:       this.getStepProfiles(),
      healthReport:       this.getHealthReport(),
      alerts:             this.getTypedAlerts(),
      tierSequence:       [...this.recentTiers],
    };
  }

  // ── Primary snapshot ───────────────────────────────────────────────────────

  public getSnapshot(): OrchestratorDiagnosticsSnapshot {
    const scheduled = this.history.map((s) => s.scheduledDurationMs);
    const actual    = this.history.map((s) => s.actualDurationMs);
    const drift     = this.history.map((s) => s.driftMs);
    const flush     = this.history.map((s) => s.flushDurationMs);
    const events    = this.history.map((s) => s.emittedEventCount);
    const absDrift  = drift.map((d) => Math.abs(d));

    const maxSingleStepMs = this.history.reduce((max, sample) => {
      const localMax = Math.max(0, ...Object.values(sample.stepDurationsMs).filter((v): v is number => v !== undefined));
      return Math.max(max, localMax);
    }, 0);

    const bottlenecks = this.detectBottlenecks(3).map((b) => ({
      stepName: b.stepName,
      avgMs:    b.avgDurationMs,
    }));

    return {
      generatedAt:            Date.now(),
      totalTicksObserved:     this.history.length,
      lastTickIndex:          this.currentTickIndex,
      currentTier:            this.currentTier,
      avgScheduledDurationMs: avg(scheduled),
      avgActualDurationMs:    avg(actual),
      avgDriftMs:             avg(absDrift),
      maxDriftMs:             absDrift.length ? Math.max(...absDrift) : 0,
      p50DriftMs:             percentileOf(absDrift, 0.50),
      p95DriftMs:             percentileOf(absDrift, 0.95),
      p99DriftMs:             percentileOf(absDrift, 0.99),
      avgFlushDurationMs:     avg(flush),
      maxFlushDurationMs:     flush.length ? Math.max(...flush) : 0,
      p95FlushDurationMs:     percentileOf(flush, 0.95),
      maxSingleStepMs,
      totalEventsObserved:    events.reduce((s, v) => s + v, 0),
      avgEventsPerTick:       avg(events),
      maxOpenDecisionWindowCount: this.history.length
        ? Math.max(...this.history.map((s) => s.openDecisionWindowCount))
        : 0,
      tierTransitionCount:    this.tierTransitionCount,
      recentTierSequence:     [...this.recentTiers],
      alerts:                 [...this.alerts],
      lastTick:               this.history[this.history.length - 1] ?? null,
      stepBottlenecks:        bottlenecks,
      healthScore:            this.computeHealthScore(),
    };
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  public reset(): void {
    this.history.length        = 0;
    this.recentTiers.length    = 0;
    this.alerts.length         = 0;
    this.tickStartHrMs         = null;
    this.flushStartHrMs        = null;
    this.lastScheduledDurationMs = 0;
    this.currentTickIndex      = 0;
    this.currentTier           = null;
    this.currentStepDurations  = {};
    this.currentEventCount     = 0;
    this.currentOpenWindowCount = 0;
    this.tierTransitionCount   = 0;
    this.lastTickCompletedAtMs = null;
    this.currentHadError       = false;
    this.stepAccumulators.clear();
    this.cachedStepProfiles    = null;
  }

  public getLastTickCompletedAtMs(): number | null {
    return this.lastTickCompletedAtMs;
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private pushAlert(alert: OrchestratorAlert): void {
    // Deduplicate: skip if last alert has same code for same tick
    const last = this.alerts[this.alerts.length - 1];
    if (last && last.code === alert.code && last.tickIndex === alert.tickIndex) return;

    this.alerts.push(alert);
    if (this.alerts.length > 64) this.alerts.shift();
  }

  private computeWindowHealth(): number {
    if (this.history.length === 0) return 100;
    const maxSeen = Math.max(...this.history.map((s) => s.openDecisionWindowCount));
    const ratio   = Math.min(1, maxSeen / Math.max(1, this.thresholds.maxAllowedOpenDecisionWindows));
    return Math.round(100 * (1 - ratio));
  }

  private computeTierStabilityHealth(): number {
    if (this.history.length < 2) return 100;
    const changeRate = this.tierTransitionCount / this.history.length;
    // Full health if change rate ≤ 5%; zero if ≥ 40%
    const penalty = Math.min(1, Math.max(0, (changeRate - 0.05) / 0.35));
    return Math.round(100 * (1 - penalty));
  }

  private alertSeverity(code: string): 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' {
    if (code === 'TIER_OSCILLATION' || code === 'RUNAWAY_EVENT_VOLUME') return 'CRITICAL';
    if (code === 'SLOW_FLUSH' || code === 'WINDOW_BACKLOG')             return 'ERROR';
    if (code === 'HIGH_TICK_DRIFT' || code === 'SLOW_STEP')             return 'WARN';
    return 'INFO';
  }
}

export default OrchestratorDiagnostics;
