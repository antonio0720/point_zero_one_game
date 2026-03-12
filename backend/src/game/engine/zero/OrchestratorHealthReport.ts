// backend/src/game/engine/zero/OrchestratorHealthReport.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OrchestratorHealthReport.ts
 *
 * Doctrine:
 * - health reporting is an orchestration concern, not an engine concern
 * - core engines own their self-reported health; Engine 0 aggregates, scores,
 *   classifies, and surfaces readiness without mutating engine state
 * - reports must stay deterministic, immutable, and safe for operator tooling
 * - no synthetic engine statuses are invented unless an engine fails to report
 */

import type {
  EngineHealth,
  EngineHealthStatus,
} from '../core/EngineContracts';
import { EngineRegistry } from '../core/EngineRegistry';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { RuntimeCheckpointCoordinator } from './RuntimeCheckpointCoordinator';
import type { StepTracePublisher } from './StepTracePublisher';

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export type OrchestratorReadiness =
  | 'READY'
  | 'DEGRADED'
  | 'FAILED'
  | 'IDLE';

export interface OrchestratorHealthReportDependencies {
  readonly registry: EngineRegistry;
  readonly getCurrentSnapshot: () => RunStateSnapshot | null;
  readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;
  readonly tracePublisher?: StepTracePublisher;
  readonly now?: () => number;
}

export interface EngineHealthBreakdown {
  readonly healthy: readonly EngineHealth[];
  readonly degraded: readonly EngineHealth[];
  readonly failed: readonly EngineHealth[];
}

export interface OrchestratorHealthMetrics {
  readonly totalEngines: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly queuedEventWarnings: number;
  readonly openTraceCount: number;
  readonly warningCount: number;
  readonly checkpointCount: number;
  readonly score: number;
}

export interface OrchestratorHealthReportSnapshot {
  readonly generatedAtMs: number;
  readonly readiness: OrchestratorReadiness;
  readonly activeRunId: string | null;
  readonly tick: number | null;
  readonly phase: RunStateSnapshot['phase'] | null;
  readonly outcome: RunStateSnapshot['outcome'] | null;
  readonly integrityStatus: RunStateSnapshot['sovereignty']['integrityStatus'] | null;
  readonly proofHashPresent: boolean;
  readonly health: readonly EngineHealth[];
  readonly breakdown: EngineHealthBreakdown;
  readonly metrics: OrchestratorHealthMetrics;
  readonly notes: readonly string[];
}

function splitHealth(entries: readonly EngineHealth[]): EngineHealthBreakdown {
  const healthy = entries.filter((entry) => entry.status === 'HEALTHY');
  const degraded = entries.filter((entry) => entry.status === 'DEGRADED');
  const failed = entries.filter((entry) => entry.status === 'FAILED');

  return Object.freeze({
    healthy: freezeArray(healthy),
    degraded: freezeArray(degraded),
    failed: freezeArray(failed),
  });
}

function deriveReadiness(
  snapshot: RunStateSnapshot | null,
  breakdown: EngineHealthBreakdown,
): OrchestratorReadiness {
  if (snapshot === null && breakdown.failed.length === 0 && breakdown.degraded.length === 0) {
    return 'IDLE';
  }

  if (breakdown.failed.length > 0) {
    return 'FAILED';
  }

  if (breakdown.degraded.length > 0) {
    return 'DEGRADED';
  }

  return 'READY';
}

export class OrchestratorHealthReport {
  private readonly registry: EngineRegistry;

  private readonly getCurrentSnapshotImpl: () => RunStateSnapshot | null;

  private readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;

  private readonly tracePublisher?: StepTracePublisher;

  private readonly now: () => number;

  public constructor(dependencies: OrchestratorHealthReportDependencies) {
    this.registry = dependencies.registry;
    this.getCurrentSnapshotImpl = dependencies.getCurrentSnapshot;
    this.checkpointCoordinator = dependencies.checkpointCoordinator;
    this.tracePublisher = dependencies.tracePublisher;
    this.now = dependencies.now ?? (() => Date.now());
  }

  public snapshot(): OrchestratorHealthReportSnapshot {
    const current = this.getCurrentSnapshotImpl();
    const health = freezeArray(this.registry.health());
    const breakdown = splitHealth(health);

    const checkpointCount =
      current === null || this.checkpointCoordinator === undefined
        ? 0
        : this.checkpointCoordinator.listRun(current.runId).length;

    const openTraceCount =
      this.tracePublisher?.getOpenTraceIds().length ?? 0;

    const queuedEventWarnings = current?.telemetry.forkHints.length ?? 0;
    const warningCount = current?.telemetry.warnings.length ?? 0;

    const score = this.computeScore({
      healthyCount: breakdown.healthy.length,
      degradedCount: breakdown.degraded.length,
      failedCount: breakdown.failed.length,
      warningCount,
      queuedEventWarnings,
      openTraceCount,
    });

    const notes = this.buildNotes(current, breakdown, {
      checkpointCount,
      openTraceCount,
      queuedEventWarnings,
      warningCount,
      score,
    });

    return Object.freeze({
      generatedAtMs: this.now(),
      readiness: deriveReadiness(current, breakdown),
      activeRunId: current?.runId ?? null,
      tick: current?.tick ?? null,
      phase: current?.phase ?? null,
      outcome: current?.outcome ?? null,
      integrityStatus: current?.sovereignty.integrityStatus ?? null,
      proofHashPresent: current?.sovereignty.proofHash !== null,
      health,
      breakdown,
      metrics: Object.freeze({
        totalEngines: health.length,
        healthyCount: breakdown.healthy.length,
        degradedCount: breakdown.degraded.length,
        failedCount: breakdown.failed.length,
        queuedEventWarnings,
        openTraceCount,
        warningCount,
        checkpointCount,
        score,
      }),
      notes,
    });
  }

  public isReady(): boolean {
    const report = this.snapshot();
    return report.readiness === 'READY';
  }

  public assertReady(): void {
    const report = this.snapshot();
    if (report.readiness === 'FAILED') {
      throw new Error(
        `Engine 0 readiness failed. Failed engines: ${report.breakdown.failed
          .map((entry) => entry.engineId)
          .join(', ')}`,
      );
    }
  }

  private computeScore(input: {
    readonly healthyCount: number;
    readonly degradedCount: number;
    readonly failedCount: number;
    readonly warningCount: number;
    readonly queuedEventWarnings: number;
    readonly openTraceCount: number;
  }): number {
    let score = 100;

    score -= input.failedCount * 40;
    score -= input.degradedCount * 12;
    score -= Math.min(20, input.warningCount * 2);
    score -= Math.min(10, input.queuedEventWarnings * 2);
    score -= Math.min(8, input.openTraceCount);

    return Math.max(0, score);
  }

  private buildNotes(
    snapshot: RunStateSnapshot | null,
    breakdown: EngineHealthBreakdown,
    metrics: {
      readonly checkpointCount: number;
      readonly openTraceCount: number;
      readonly queuedEventWarnings: number;
      readonly warningCount: number;
      readonly score: number;
    },
  ): readonly string[] {
    const notes: string[] = [];

    if (snapshot === null) {
      notes.push('No active run is loaded.');
    } else {
      notes.push(`Run ${snapshot.runId} at tick ${snapshot.tick} is in phase ${snapshot.phase}.`);

      if (snapshot.outcome !== null) {
        notes.push(`Run is terminal with outcome ${snapshot.outcome}.`);
      }

      if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
        notes.push('Sovereignty integrity is quarantined.');
      }

      if (snapshot.sovereignty.proofHash !== null) {
        notes.push('Proof hash is present.');
      }
    }

    if (breakdown.failed.length > 0) {
      notes.push(
        `Failed engines: ${breakdown.failed.map((entry) => entry.engineId).join(', ')}`,
      );
    }

    if (breakdown.degraded.length > 0) {
      notes.push(
        `Degraded engines: ${breakdown.degraded.map((entry) => entry.engineId).join(', ')}`,
      );
    }

    if (metrics.warningCount > 0) {
      notes.push(`Runtime warnings present: ${metrics.warningCount}.`);
    }

    if (metrics.queuedEventWarnings > 0) {
      notes.push(`Fork hints present: ${metrics.queuedEventWarnings}.`);
    }

    if (metrics.openTraceCount > 0) {
      notes.push(`Open traces detected: ${metrics.openTraceCount}.`);
    }

    if (metrics.checkpointCount > 0) {
      notes.push(`Checkpoints indexed for active run: ${metrics.checkpointCount}.`);
    }

    notes.push(`Orchestrator health score: ${metrics.score}.`);

    return freezeArray(notes);
  }
}