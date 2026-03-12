// backend/src/game/engine/zero/RunQueryService.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RunQueryService.ts
 *
 * Doctrine:
 * - query service is read-only and side-effect free
 * - Engine 0 may expose runtime state, traces, checkpoints, and bus history,
 *   but it must never mutate the authoritative snapshot
 * - all returned state is cloned/frozen before leaving the boundary
 * - this file is the query seam for API handlers, devtools, tests, and admin
 *   forensics without forcing callers to know zero/core internals
 */

import { deepFrozenClone } from '../core/Deterministic';
import type { EventBus, EventEnvelope } from '../core/EventBus';
import { EngineRegistry } from '../core/EngineRegistry';
import type { EngineHealth } from '../core/EngineContracts';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';
import type {
  RuntimeCheckpointCoordinator,
  RuntimeCheckpointSummary,
} from './RuntimeCheckpointCoordinator';
import type {
  StepTracePublisher,
  StepTraceRunSummary,
} from './StepTracePublisher';

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export interface RunQueryServiceDependencies {
  readonly getCurrentSnapshot: () => RunStateSnapshot | null;
  readonly registry: EngineRegistry;
  readonly bus: EventBus<RuntimeEventMap>;
  readonly tracePublisher?: StepTracePublisher;
  readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;
}

export interface RunQuerySummary {
  readonly active: boolean;
  readonly runId: string | null;
  readonly tick: number | null;
  readonly phase: RunStateSnapshot['phase'] | null;
  readonly mode: RunStateSnapshot['mode'] | null;
  readonly outcome: RunStateSnapshot['outcome'] | null;
  readonly warningCount: number;
  readonly queuedEventCount: number;
  readonly eventHistoryCount: number;
  readonly engineHealth: readonly EngineHealth[];
  readonly openTraceIds: readonly string[];
  readonly recentTraceCount: number;
  readonly recentCheckpointCount: number;
}

export class RunQueryService {
  private readonly getCurrentSnapshotImpl: () => RunStateSnapshot | null;

  private readonly registry: EngineRegistry;

  private readonly bus: EventBus<RuntimeEventMap>;

  private readonly tracePublisher?: StepTracePublisher;

  private readonly checkpointCoordinator?: RuntimeCheckpointCoordinator;

  public constructor(dependencies: RunQueryServiceDependencies) {
    this.getCurrentSnapshotImpl = dependencies.getCurrentSnapshot;
    this.registry = dependencies.registry;
    this.bus = dependencies.bus;
    this.tracePublisher = dependencies.tracePublisher;
    this.checkpointCoordinator = dependencies.checkpointCoordinator;
  }

  public hasActiveRun(): boolean {
    return this.getCurrentSnapshotImpl() !== null;
  }

  public maybeGetSnapshot(): RunStateSnapshot | null {
    const snapshot = this.getCurrentSnapshotImpl();
    return snapshot === null ? null : deepFrozenClone(snapshot);
  }

  public getSnapshot(): RunStateSnapshot {
    const snapshot = this.getCurrentSnapshotImpl();
    if (snapshot === null) {
      throw new Error('No active run is available for querying.');
    }

    return deepFrozenClone(snapshot);
  }

  public getRunId(): string | null {
    return this.getCurrentSnapshotImpl()?.runId ?? null;
  }

  public getTick(): number | null {
    return this.getCurrentSnapshotImpl()?.tick ?? null;
  }

  public getOutcome(): RunStateSnapshot['outcome'] | null {
    const snapshot = this.getCurrentSnapshotImpl();
    return snapshot === null ? null : snapshot.outcome;
  }

  public getEngineHealth(): readonly EngineHealth[] {
    return freezeArray(this.registry.health());
  }

  public getEngineOrder(): readonly string[] {
    return freezeArray(this.registry.executionOrder());
  }

  public getQueuedEventCount(): number {
    return this.bus.queuedCount();
  }

  public getEventHistoryCount(): number {
    return this.bus.historyCount();
  }

  public getRecentEvents(
    limit?: number,
  ): readonly EventEnvelope<keyof RuntimeEventMap, RuntimeEventMap[keyof RuntimeEventMap]>[] {
    return freezeArray(this.bus.getHistory(limit));
  }

  public getQueuedEntries<K extends keyof RuntimeEventMap>(
    event: K,
  ): readonly EventEnvelope<K, RuntimeEventMap[K]>[] {
    return freezeArray(this.bus.peekEntries(event));
  }

  public getLastEvent<K extends keyof RuntimeEventMap>(
    event: K,
  ): EventEnvelope<K, RuntimeEventMap[K]> | null {
    return this.bus.last(event);
  }

  public getTrace(traceId: string) {
    return this.tracePublisher?.get(traceId) ?? null;
  }

  public getOpenTraceIds(): readonly string[] {
    return this.tracePublisher?.getOpenTraceIds() ?? freezeArray<string>([]);
  }

  public getOpenTraceCount(): number {
    return this.tracePublisher?.getOpenTraceIds().length ?? 0;
  }

  public getRecentTraces(limit?: number) {
    return this.tracePublisher?.listRecent(limit) ?? freezeArray([]);
  }

  public getTickTraces(
    runId: string,
    tick: number,
  ) {
    return this.tracePublisher?.listForTick(runId, tick) ?? freezeArray([]);
  }

  public summarizeTraces(
    runId: string,
    limit?: number,
  ): StepTraceRunSummary | null {
    return this.tracePublisher?.summarizeRun(runId, limit) ?? null;
  }

  public getCheckpoint(checkpointId: string) {
    return this.checkpointCoordinator?.get(checkpointId) ?? null;
  }

  public getLatestCheckpoint(runId?: string) {
    const resolvedRunId = runId ?? this.getRunId();
    if (resolvedRunId === null || this.checkpointCoordinator === undefined) {
      return null;
    }

    return this.checkpointCoordinator.latest(resolvedRunId);
  }

  public getLatestCheckpointForStep(
    step: TickStep,
    runId?: string,
  ) {
    const resolvedRunId = runId ?? this.getRunId();
    if (resolvedRunId === null || this.checkpointCoordinator === undefined) {
      return null;
    }

    return this.checkpointCoordinator.latestForStep(resolvedRunId, step);
  }

  public listRunCheckpoints(runId?: string) {
    const resolvedRunId = runId ?? this.getRunId();
    if (resolvedRunId === null || this.checkpointCoordinator === undefined) {
      return freezeArray([]);
    }

    return this.checkpointCoordinator.listRun(resolvedRunId);
  }

  public listTickCheckpoints(
    tick: number,
    runId?: string,
  ) {
    const resolvedRunId = runId ?? this.getRunId();
    if (resolvedRunId === null || this.checkpointCoordinator === undefined) {
      return freezeArray([]);
    }

    return this.checkpointCoordinator.listTick(resolvedRunId, tick);
  }

  public restoreCheckpoint(checkpointId: string): RunStateSnapshot | null {
    return this.checkpointCoordinator?.restore(checkpointId) ?? null;
  }

  public rollbackClone(checkpointId: string): RunStateSnapshot | null {
    return this.checkpointCoordinator?.rollbackClone(checkpointId) ?? null;
  }

  public summarizeCheckpoints(runId?: string): RuntimeCheckpointSummary | null {
    const resolvedRunId = runId ?? this.getRunId();
    if (resolvedRunId === null || this.checkpointCoordinator === undefined) {
      return null;
    }

    return this.checkpointCoordinator.summarizeRun(resolvedRunId);
  }

  public summary(): RunQuerySummary {
    const snapshot = this.getCurrentSnapshotImpl();
    const recentTraces = this.tracePublisher?.listRecent(32) ?? [];
    const recentCheckpoints =
      this.checkpointCoordinator?.getRecent(32) ?? [];

    return Object.freeze({
      active: snapshot !== null,
      runId: snapshot?.runId ?? null,
      tick: snapshot?.tick ?? null,
      phase: snapshot?.phase ?? null,
      mode: snapshot?.mode ?? null,
      outcome: snapshot?.outcome ?? null,
      warningCount: snapshot?.telemetry.warnings.length ?? 0,
      queuedEventCount: this.bus.queuedCount(),
      eventHistoryCount: this.bus.historyCount(),
      engineHealth: freezeArray(this.registry.health()),
      openTraceIds: this.getOpenTraceIds(),
      recentTraceCount: recentTraces.length,
      recentCheckpointCount: recentCheckpoints.length,
    });
  }
}