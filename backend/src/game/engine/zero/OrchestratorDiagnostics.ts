// backend/src/game/engine/zero/OrchestratorDiagnostics.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OrchestratorDiagnostics.ts
 *
 * Doctrine:
 * - diagnostics observe orchestration; they never drive it
 * - every surfaced metric must be derivable from live runtime state, traces,
 *   checkpoints, or event history
 * - zero diagnostics are for operators, tests, and replay tooling, not UI state
 * - snapshots returned here must be immutable and safe for concurrent inspection
 */

import { deepFrozenClone } from '../core/Deterministic';
import type { EventBus, EventEnvelope } from '../core/EventBus';
import { EngineRegistry } from '../core/EngineRegistry';
import type { EngineHealth } from '../core/EngineContracts';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { RuntimeCheckpoint } from '../core/RuntimeCheckpointStore';
import type { TickTraceRecord } from '../core/TickTraceRecorder';
import type { RuntimeCheckpointCoordinator } from './RuntimeCheckpointCoordinator';
import type { StepTracePublisher } from './StepTracePublisher';

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export interface OrchestratorDiagnosticsDependencies {
  readonly getCurrentSnapshot: () => RunStateSnapshot | null;
  readonly registry: EngineRegistry;
  readonly bus: EventBus<RuntimeEventMap>;
  readonly tracePublisher?: StepTracePublisher;
  readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;
  readonly now?: () => number;
}

export interface OrchestratorEventBusDiagnostics {
  readonly queuedCount: number;
  readonly historyCount: number;
  readonly recentEvents: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
}

export interface OrchestratorRunDiagnostics {
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly mode: RunStateSnapshot['mode'];
  readonly outcome: RunStateSnapshot['outcome'];
  readonly lastTickChecksum: string | null;
  readonly emittedEventCount: number;
  readonly warningCount: number;
  readonly warnings: readonly string[];
  readonly integrityStatus: RunStateSnapshot['sovereignty']['integrityStatus'];
  readonly proofHash: string | null;
  readonly sovereigntyScore: number;
  readonly verifiedGrade: string | null;
  readonly cordScore: number;
  readonly netWorth: number;
  readonly cash: number;
  readonly cashflow: number;
  readonly pressureTier: RunStateSnapshot['pressure']['tier'];
  readonly pressureScore: number;
  readonly tensionScore: number;
  readonly activeCascadeChains: number;
  readonly activeThreats: number;
  readonly pendingAttackCount: number;
}

export interface OrchestratorDiagnosticsSnapshot {
  readonly generatedAtMs: number;
  readonly active: boolean;
  readonly currentRun: OrchestratorRunDiagnostics | null;
  readonly engineOrder: readonly string[];
  readonly engineHealth: readonly EngineHealth[];
  readonly eventBus: OrchestratorEventBusDiagnostics;
  readonly openTraceIds: readonly string[];
  readonly recentTraces: readonly TickTraceRecord[];
  readonly recentCheckpoints: readonly RuntimeCheckpoint[];
  readonly latestCheckpointId: string | null;
  readonly latestTraceId: string | null;
}

export interface OrchestratorReadinessReport {
  readonly ready: boolean;
  readonly healthy: readonly EngineHealth[];
  readonly degraded: readonly EngineHealth[];
  readonly failed: readonly EngineHealth[];
}

export class OrchestratorDiagnostics {
  private readonly getCurrentSnapshotImpl: () => RunStateSnapshot | null;

  private readonly registry: EngineRegistry;

  private readonly bus: EventBus<RuntimeEventMap>;

  private readonly tracePublisher?: StepTracePublisher;

  private readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;

  private readonly now: () => number;

  public constructor(dependencies: OrchestratorDiagnosticsDependencies) {
    this.getCurrentSnapshotImpl = dependencies.getCurrentSnapshot;
    this.registry = dependencies.registry;
    this.bus = dependencies.bus;
    this.tracePublisher = dependencies.tracePublisher;
    this.checkpointCoordinator = dependencies.checkpointCoordinator;
    this.now = dependencies.now ?? (() => Date.now());
  }

  public currentRun(): OrchestratorRunDiagnostics | null {
    const snapshot = this.getCurrentSnapshotImpl();
    if (snapshot === null) {
      return null;
    }

    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      mode: snapshot.mode,
      outcome: snapshot.outcome,
      lastTickChecksum: snapshot.telemetry.lastTickChecksum,
      emittedEventCount: snapshot.telemetry.emittedEventCount,
      warningCount: snapshot.telemetry.warnings.length,
      warnings: freezeArray(snapshot.telemetry.warnings),
      integrityStatus: snapshot.sovereignty.integrityStatus,
      proofHash: snapshot.sovereignty.proofHash,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      verifiedGrade: snapshot.sovereignty.verifiedGrade,
      cordScore: snapshot.sovereignty.cordScore,
      netWorth: snapshot.economy.netWorth,
      cash: snapshot.economy.cash,
      cashflow: snapshot.economy.cashflow,
      pressureTier: snapshot.pressure.tier,
      pressureScore: snapshot.pressure.score,
      tensionScore: snapshot.tension.score,
      activeCascadeChains: snapshot.cascade.activeChains.length,
      activeThreats: snapshot.tension.queue.length,
      pendingAttackCount: snapshot.battle.pendingAttacks.length,
    });
  }

  public eventBus(limit = 64): OrchestratorEventBusDiagnostics {
    return Object.freeze({
      queuedCount: this.bus.queuedCount(),
      historyCount: this.bus.historyCount(),
      recentEvents: freezeArray(this.bus.getHistory(limit)),
    });
  }

  public readiness(): OrchestratorReadinessReport {
    const healthy = this.registry.health();
    const degraded = healthy.filter((entry) => entry.status === 'DEGRADED');
    const failed = healthy.filter((entry) => entry.status === 'FAILED');

    return Object.freeze({
      ready: failed.length === 0,
      healthy: freezeArray(healthy),
      degraded: freezeArray(degraded),
      failed: freezeArray(failed),
    });
  }

  public latestCheckpoint(): RuntimeCheckpoint | null {
    const snapshot = this.getCurrentSnapshotImpl();
    if (snapshot === null || this.checkpointCoordinator === undefined) {
      return null;
    }

    return this.checkpointCoordinator.latest(snapshot.runId);
  }

  public latestTrace(): TickTraceRecord | null {
    const snapshot = this.getCurrentSnapshotImpl();
    if (snapshot === null || this.tracePublisher === undefined) {
      return null;
    }

    return this.tracePublisher.latestForTick(snapshot.runId, snapshot.tick);
  }

  public snapshot(
    options: {
      readonly recentEventsLimit?: number;
      readonly recentTracesLimit?: number;
      readonly recentCheckpointsLimit?: number;
    } = {},
  ): OrchestratorDiagnosticsSnapshot {
    const recentEventsLimit = options.recentEventsLimit ?? 64;
    const recentTracesLimit = options.recentTracesLimit ?? 64;
    const recentCheckpointsLimit = options.recentCheckpointsLimit ?? 64;

    const currentRun = this.currentRun();
    const latestCheckpoint = this.latestCheckpoint();
    const latestTrace = this.latestTrace();

    return Object.freeze({
      generatedAtMs: this.now(),
      active: currentRun !== null,
      currentRun,
      engineOrder: freezeArray(this.registry.executionOrder()),
      engineHealth: freezeArray(this.registry.health()),
      eventBus: this.eventBus(recentEventsLimit),
      openTraceIds:
        this.tracePublisher?.getOpenTraceIds() ?? freezeArray<string>([]),
      recentTraces:
        this.tracePublisher?.listRecent(recentTracesLimit) ?? freezeArray([]),
      recentCheckpoints:
        this.checkpointCoordinator?.getRecent(recentCheckpointsLimit) ??
        freezeArray([]),
      latestCheckpointId: latestCheckpoint?.checkpointId ?? null,
      latestTraceId: latestTrace?.traceId ?? null,
    });
  }

  public cloneCurrentSnapshot(): RunStateSnapshot | null {
    const snapshot = this.getCurrentSnapshotImpl();
    return snapshot === null ? null : deepFrozenClone(snapshot);
  }
}