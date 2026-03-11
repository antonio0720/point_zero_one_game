/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/RuntimeCheckpointStore.ts
 *
 * Doctrine:
 * - checkpoints are immutable rollback anchors, not live state
 * - retention must be bounded by run and by store-wide pressure
 * - checkpoint ids must be deterministic enough for audit/replay joins
 * - retrieval should remain O(1) for common latest/by-id access patterns
 */

import type { TickStep } from './TickSequence';
import type { RunStateSnapshot } from './RunStateSnapshot';
import {
  checksumSnapshot,
  cloneJson,
  createDeterministicId,
  deepFrozenClone,
} from './Deterministic';

export type RuntimeCheckpointReason =
  | 'RUN_START'
  | 'STEP_ENTRY'
  | 'STEP_EXIT'
  | 'TICK_FINAL'
  | 'TERMINAL'
  | 'MANUAL';

export interface RuntimeCheckpointStoreOptions {
  readonly maxRuns?: number;
  readonly maxCheckpointsPerRun?: number;
}

export interface RuntimeCheckpointWriteInput {
  readonly snapshot: RunStateSnapshot;
  readonly capturedAtMs: number;
  readonly step?: TickStep | null;
  readonly reason?: RuntimeCheckpointReason;
  readonly traceId?: string | null;
  readonly tags?: readonly string[];
}

export interface RuntimeCheckpoint {
  readonly checkpointId: string;
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunStateSnapshot['phase'];
  readonly mode: RunStateSnapshot['mode'];
  readonly outcome: RunStateSnapshot['outcome'];
  readonly step: TickStep | null;
  readonly reason: RuntimeCheckpointReason;
  readonly traceId: string | null;
  readonly capturedAtMs: number;
  readonly checksum: string;
  readonly ordinalInRun: number;
  readonly tags: readonly string[];
  readonly snapshot: RunStateSnapshot;
}

const DEFAULT_MAX_RUNS = 32;
const DEFAULT_MAX_CHECKPOINTS_PER_RUN = 512;

function freezeCheckpoint(checkpoint: RuntimeCheckpoint): RuntimeCheckpoint {
  return deepFrozenClone(checkpoint);
}

export class RuntimeCheckpointStore {
  private readonly maxRuns: number;
  private readonly maxCheckpointsPerRun: number;
  private readonly byCheckpointId = new Map<string, RuntimeCheckpoint>();
  private readonly byRunId = new Map<string, RuntimeCheckpoint[]>();
  private readonly runLru: string[] = [];

  public constructor(options: RuntimeCheckpointStoreOptions = {}) {
    this.maxRuns = Math.max(1, options.maxRuns ?? DEFAULT_MAX_RUNS);
    this.maxCheckpointsPerRun = Math.max(
      1,
      options.maxCheckpointsPerRun ?? DEFAULT_MAX_CHECKPOINTS_PER_RUN,
    );
  }

  public write(input: RuntimeCheckpointWriteInput): RuntimeCheckpoint {
    const reason = input.reason ?? 'MANUAL';
    const step = input.step ?? null;
    const checksum = checksumSnapshot(input.snapshot);
    const frozenSnapshot = deepFrozenClone(input.snapshot);
    const existingRun = this.byRunId.get(input.snapshot.runId) ?? [];
    const ordinalInRun = existingRun.length + 1;

    const checkpoint: RuntimeCheckpoint = freezeCheckpoint({
      checkpointId: createDeterministicId(
        'runtime-checkpoint',
        input.snapshot.runId,
        input.snapshot.tick,
        step ?? 'none',
        reason,
        ordinalInRun,
        checksum.slice(0, 16),
      ),
      runId: input.snapshot.runId,
      tick: input.snapshot.tick,
      phase: input.snapshot.phase,
      mode: input.snapshot.mode,
      outcome: input.snapshot.outcome,
      step,
      reason,
      traceId: input.traceId ?? null,
      capturedAtMs: Math.max(0, Math.trunc(input.capturedAtMs)),
      checksum,
      ordinalInRun,
      tags: Object.freeze([...(input.tags ?? [])]),
      snapshot: frozenSnapshot,
    });

    existingRun.push(checkpoint);
    this.byRunId.set(input.snapshot.runId, existingRun);
    this.byCheckpointId.set(checkpoint.checkpointId, checkpoint);
    this.touchRun(input.snapshot.runId);
    this.trimRun(input.snapshot.runId);
    this.trimStore();

    return checkpoint;
  }

  public get(checkpointId: string): RuntimeCheckpoint | null {
    return this.byCheckpointId.get(checkpointId) ?? null;
  }

  public latest(runId: string): RuntimeCheckpoint | null {
    const run = this.byRunId.get(runId);
    return run && run.length > 0 ? run[run.length - 1] : null;
  }

  public latestForStep(
    runId: string,
    step: TickStep,
  ): RuntimeCheckpoint | null {
    const run = this.byRunId.get(runId) ?? [];
    for (let index = run.length - 1; index >= 0; index -= 1) {
      const checkpoint = run[index];
      if (checkpoint.step === step) {
        return checkpoint;
      }
    }

    return null;
  }

  public listRun(runId: string): readonly RuntimeCheckpoint[] {
    return [...(this.byRunId.get(runId) ?? [])];
  }

  public listTick(runId: string, tick: number): readonly RuntimeCheckpoint[] {
    return (this.byRunId.get(runId) ?? []).filter(
      (checkpoint) => checkpoint.tick === tick,
    );
  }

  public getAtOrBefore(runId: string, tick: number): RuntimeCheckpoint | null {
    const run = this.byRunId.get(runId) ?? [];
    for (let index = run.length - 1; index >= 0; index -= 1) {
      const checkpoint = run[index];
      if (checkpoint.tick <= tick) {
        return checkpoint;
      }
    }

    return null;
  }

  public restore(checkpointId: string): RunStateSnapshot | null {
    const checkpoint = this.get(checkpointId);
    if (!checkpoint) {
      return null;
    }

    return deepFrozenClone(checkpoint.snapshot);
  }

  public rollbackClone(checkpointId: string): RunStateSnapshot | null {
    const checkpoint = this.get(checkpointId);
    if (!checkpoint) {
      return null;
    }

    return cloneJson(checkpoint.snapshot) as RunStateSnapshot;
  }

  public deleteRun(runId: string): void {
    const run = this.byRunId.get(runId);
    if (!run) {
      return;
    }

    for (const checkpoint of run) {
      this.byCheckpointId.delete(checkpoint.checkpointId);
    }

    this.byRunId.delete(runId);
    const nextLru = this.runLru.filter((value) => value !== runId);
    this.runLru.length = 0;
    this.runLru.push(...nextLru);
  }

  public clear(): void {
    this.byCheckpointId.clear();
    this.byRunId.clear();
    this.runLru.length = 0;
  }

  private trimRun(runId: string): void {
    const run = this.byRunId.get(runId);
    if (!run) {
      return;
    }

    while (run.length > this.maxCheckpointsPerRun) {
      const removed = run.shift();
      if (!removed) {
        return;
      }

      this.byCheckpointId.delete(removed.checkpointId);
    }

    if (run.length === 0) {
      this.byRunId.delete(runId);
    }
  }

  private trimStore(): void {
    while (this.byRunId.size > this.maxRuns) {
      const oldestRunId = this.runLru.shift();
      if (!oldestRunId) {
        return;
      }

      this.deleteRun(oldestRunId);
    }
  }

  private touchRun(runId: string): void {
    const filtered = this.runLru.filter((value) => value !== runId);
    this.runLru.length = 0;
    this.runLru.push(...filtered, runId);
  }
}
