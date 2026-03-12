// backend/src/game/engine/zero/RuntimeCheckpointCoordinator.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/RuntimeCheckpointCoordinator.ts
 *
 * Doctrine:
 * - zero owns checkpoint policy, core owns checkpoint storage
 * - checkpoints are capture decisions, not engine decisions
 * - retention must stay bounded and deterministic
 * - duplicate captures of the same state/step/reason should collapse instead of
 *   inflating rollback history
 * - restore/rollback operations remain read-only to callers until explicitly
 *   committed by higher orchestration layers
 */

import { checksumSnapshot, deepFrozenClone } from '../core/Deterministic';
import {
  RuntimeCheckpointStore,
  type RuntimeCheckpoint,
  type RuntimeCheckpointReason,
  type RuntimeCheckpointStoreOptions,
} from '../core/RuntimeCheckpointStore';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep } from '../core/TickSequence';

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export interface RuntimeCheckpointCoordinatorOptions
  extends RuntimeCheckpointStoreOptions {
  readonly maxRecentIndex?: number;
}

export interface RuntimeCheckpointCaptureOptions {
  readonly capturedAtMs: number;
  readonly step?: TickStep | null;
  readonly traceId?: string | null;
  readonly tags?: readonly string[];
  readonly dedupeAgainstLatest?: boolean;
}

export interface RuntimeCheckpointSummary {
  readonly runId: string;
  readonly count: number;
  readonly latestCheckpointId: string | null;
  readonly latestTick: number | null;
  readonly terminalCheckpointId: string | null;
  readonly reasons: Readonly<Record<RuntimeCheckpointReason, number>>;
}

const DEFAULT_MAX_RECENT_INDEX = 4_096;

export class RuntimeCheckpointCoordinator {
  private readonly store: RuntimeCheckpointStore;

  private readonly maxRecentIndex: number;

  private readonly recentCheckpointIds: string[] = [];

  public constructor(options: RuntimeCheckpointCoordinatorOptions = {}) {
    this.store = new RuntimeCheckpointStore(options);
    this.maxRecentIndex = Math.max(
      1,
      options.maxRecentIndex ?? DEFAULT_MAX_RECENT_INDEX,
    );
  }

  public capture(
    snapshot: RunStateSnapshot,
    reason: RuntimeCheckpointReason,
    options: RuntimeCheckpointCaptureOptions,
  ): RuntimeCheckpoint {
    const dedupe = options.dedupeAgainstLatest ?? true;
    if (dedupe) {
      const latest = this.store.latest(snapshot.runId);
      if (
        latest !== null &&
        latest.reason === reason &&
        latest.step === (options.step ?? null) &&
        latest.traceId === (options.traceId ?? null) &&
        latest.checksum === checksumSnapshot(snapshot)
      ) {
        return latest;
      }
    }

    const checkpoint = this.store.write({
      snapshot,
      capturedAtMs: options.capturedAtMs,
      step: options.step ?? null,
      reason,
      traceId: options.traceId ?? null,
      tags: options.tags,
    });

    this.indexRecent(checkpoint.checkpointId);
    return checkpoint;
  }

  public captureRunStart(
    snapshot: RunStateSnapshot,
    capturedAtMs: number,
    tags: readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'RUN_START', {
      capturedAtMs,
      tags: freezeArray(['engine-zero', 'run-start', ...tags]),
    });
  }

  public captureStepEntry(
    snapshot: RunStateSnapshot,
    step: TickStep,
    capturedAtMs: number,
    traceId?: string | null,
    tags: readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'STEP_ENTRY', {
      capturedAtMs,
      step,
      traceId,
      tags: freezeArray(['engine-zero', 'step-entry', `step:${step.toLowerCase()}`, ...tags]),
    });
  }

  public captureStepExit(
    snapshot: RunStateSnapshot,
    step: TickStep,
    capturedAtMs: number,
    traceId?: string | null,
    tags: readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'STEP_EXIT', {
      capturedAtMs,
      step,
      traceId,
      tags: freezeArray(['engine-zero', 'step-exit', `step:${step.toLowerCase()}`, ...tags]),
    });
  }

  public captureTickFinal(
    snapshot: RunStateSnapshot,
    capturedAtMs: number,
    tags: readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'TICK_FINAL', {
      capturedAtMs,
      tags: freezeArray(['engine-zero', 'tick-final', ...tags]),
    });
  }

  public captureTerminal(
    snapshot: RunStateSnapshot,
    capturedAtMs: number,
    traceId?: string | null,
    tags: readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'TERMINAL', {
      capturedAtMs,
      traceId,
      tags: freezeArray(['engine-zero', 'terminal', ...tags]),
    });
  }

  public captureManual(
    snapshot: RunStateSnapshot,
    capturedAtMs: number,
    step?: TickStep | null,
    traceId?: string | null,
    tags: readonly string[] = [],
  ): RuntimeCheckpoint {
    return this.capture(snapshot, 'MANUAL', {
      capturedAtMs,
      step,
      traceId,
      tags: freezeArray(['engine-zero', 'manual', ...tags]),
      dedupeAgainstLatest: false,
    });
  }

  public get(checkpointId: string): RuntimeCheckpoint | null {
    const checkpoint = this.store.get(checkpointId);
    return checkpoint === null ? null : deepFrozenClone(checkpoint);
  }

  public latest(runId: string): RuntimeCheckpoint | null {
    const checkpoint = this.store.latest(runId);
    return checkpoint === null ? null : deepFrozenClone(checkpoint);
  }

  public latestForStep(runId: string, step: TickStep): RuntimeCheckpoint | null {
    const checkpoint = this.store.latestForStep(runId, step);
    return checkpoint === null ? null : deepFrozenClone(checkpoint);
  }

  public listRun(runId: string): readonly RuntimeCheckpoint[] {
    return freezeArray(this.store.listRun(runId).map((checkpoint) => deepFrozenClone(checkpoint)));
  }

  public listTick(runId: string, tick: number): readonly RuntimeCheckpoint[] {
    return freezeArray(this.store.listTick(runId, tick).map((checkpoint) => deepFrozenClone(checkpoint)));
  }

  public getAtOrBefore(runId: string, tick: number): RuntimeCheckpoint | null {
    const checkpoint = this.store.getAtOrBefore(runId, tick);
    return checkpoint === null ? null : deepFrozenClone(checkpoint);
  }

  public restore(checkpointId: string): RunStateSnapshot | null {
    const snapshot = this.store.restore(checkpointId);
    return snapshot === null ? null : deepFrozenClone(snapshot);
  }

  public rollbackClone(checkpointId: string): RunStateSnapshot | null {
    const snapshot = this.store.rollbackClone(checkpointId);
    return snapshot === null ? null : snapshot;
  }

  public getRecent(limit?: number): readonly RuntimeCheckpoint[] {
    const ids =
      limit === undefined || limit >= this.recentCheckpointIds.length
        ? this.recentCheckpointIds
        : this.recentCheckpointIds.slice(
            Math.max(0, this.recentCheckpointIds.length - limit),
          );

    return freezeArray(
      ids
        .map((checkpointId) => this.store.get(checkpointId))
        .filter((checkpoint): checkpoint is RuntimeCheckpoint => checkpoint !== null)
        .map((checkpoint) => deepFrozenClone(checkpoint)),
    );
  }

  public summarizeRun(runId: string): RuntimeCheckpointSummary {
    const checkpoints = this.store.listRun(runId);
    const latest = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
    const terminal =
      [...checkpoints].reverse().find((checkpoint) => checkpoint.reason === 'TERMINAL') ?? null;

    const reasons: Record<RuntimeCheckpointReason, number> = {
      RUN_START: 0,
      STEP_ENTRY: 0,
      STEP_EXIT: 0,
      TICK_FINAL: 0,
      TERMINAL: 0,
      MANUAL: 0,
    };

    for (const checkpoint of checkpoints) {
      reasons[checkpoint.reason] += 1;
    }

    return Object.freeze({
      runId,
      count: checkpoints.length,
      latestCheckpointId: latest?.checkpointId ?? null,
      latestTick: latest?.tick ?? null,
      terminalCheckpointId: terminal?.checkpointId ?? null,
      reasons,
    });
  }

  public deleteRun(runId: string): void {
    this.store.deleteRun(runId);
    const live = new Set(this.store.listRun(runId).map((checkpoint) => checkpoint.checkpointId));
    this.recentCheckpointIds.splice(
      0,
      this.recentCheckpointIds.length,
      ...this.recentCheckpointIds.filter((checkpointId) => live.has(checkpointId)),
    );
  }

  public clear(): void {
    this.store.clear();
    this.recentCheckpointIds.length = 0;
  }

  private indexRecent(checkpointId: string): void {
    this.recentCheckpointIds.push(checkpointId);
    while (this.recentCheckpointIds.length > this.maxRecentIndex) {
      this.recentCheckpointIds.shift();
    }
  }
}