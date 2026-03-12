// backend/src/game/engine/zero/StepTracePublisher.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/StepTracePublisher.ts
 *
 * Doctrine:
 * - zero owns orchestration-level step traces, core owns the recorder primitive
 * - a step trace must begin before a step mutates state and must seal on either
 *   success or failure
 * - traces are deterministic, bounded, and queryable by run/tick without leaking
 *   writable snapshot references
 * - this wrapper keeps hot-path orchestration simple while preserving deep
 *   forensic replay data
 */

import { createDeterministicId, deepFrozenClone } from '../core/Deterministic';
import type { EventEnvelope } from '../core/EventBus';
import type { EngineEventMap } from '../core/GamePrimitives';
import type { EngineSignal, TickTrace } from '../core/EngineContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  TickTraceRecorder,
  type TickTraceCommitInput,
  type TickTraceFailureInput,
  type TickTraceHandle,
  type TickTraceRecord,
  type TickTraceRecorderOptions,
} from '../core/TickTraceRecorder';
import type { TickStep } from '../core/TickSequence';

type RuntimeEventMap = EngineEventMap & Record<string, unknown>;

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export interface StepTracePublisherOptions extends TickTraceRecorderOptions {
  readonly maxIndexedPerRun?: number;
}

export interface StepTraceSession {
  readonly trace: TickTrace;
  readonly handle: TickTraceHandle;
  readonly startedAtMs: number;
  readonly tags: readonly string[];
}

export interface StepTraceSuccessInput {
  readonly afterSnapshot: RunStateSnapshot;
  readonly finishedAtMs: number;
  readonly events?: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
  readonly signals?: readonly EngineSignal[];
}

export interface StepTraceFailureCommitInput {
  readonly error: unknown;
  readonly finishedAtMs: number;
  readonly afterSnapshot?: RunStateSnapshot;
  readonly events?: readonly EventEnvelope<
    keyof RuntimeEventMap,
    RuntimeEventMap[keyof RuntimeEventMap]
  >[];
  readonly signals?: readonly EngineSignal[];
}

export interface StepTraceRunSummary {
  readonly runId: string;
  readonly totalIndexed: number;
  readonly okCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number;
  readonly latestTraceId: string | null;
  readonly latestTick: number | null;
  readonly stepsSeen: readonly TickStep[];
}

const DEFAULT_MAX_INDEXED_PER_RUN = 4_096;

export class StepTracePublisher {
  private readonly recorder: TickTraceRecorder;

  private readonly maxIndexedPerRun: number;

  private readonly openSessions = new Map<string, StepTraceSession>();

  private readonly traceIdsByRun = new Map<string, string[]>();

  private readonly traceIdsByRunTick = new Map<string, string[]>();

  public constructor(options: StepTracePublisherOptions = {}) {
    this.recorder = new TickTraceRecorder(options);
    this.maxIndexedPerRun = Math.max(
      1,
      options.maxIndexedPerRun ?? DEFAULT_MAX_INDEXED_PER_RUN,
    );
  }

  public begin(
    snapshot: RunStateSnapshot,
    step: TickStep,
    startedAtMs: number,
    traceId?: string,
    tags: readonly string[] = [],
  ): StepTraceSession {
    const trace: TickTrace = Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      step,
      mode: snapshot.mode,
      phase: snapshot.phase,
      traceId:
        traceId ??
        createDeterministicId(
          'tick-trace',
          snapshot.runId,
          snapshot.tick,
          step,
          startedAtMs,
        ),
    });

    const handle = this.recorder.begin(snapshot, trace, startedAtMs);
    const session: StepTraceSession = Object.freeze({
      trace,
      handle,
      startedAtMs,
      tags: freezeArray(tags),
    });

    this.openSessions.set(trace.traceId, session);
    return session;
  }

  public commitSuccess(
    session: StepTraceSession,
    input: StepTraceSuccessInput,
  ): TickTraceRecord {
    const record = this.recorder.commitSuccess(
      session.handle,
      this.toCommitInput(input),
    );

    this.finishSession(session.trace.traceId, record);
    return record;
  }

  public commitFailure(
    session: StepTraceSession,
    input: StepTraceFailureCommitInput,
  ): TickTraceRecord {
    const failureInput: TickTraceFailureInput = {
      error: input.error,
      finishedAtMs: input.finishedAtMs,
      afterSnapshot: input.afterSnapshot,
      events: input.events,
      signals: input.signals,
    };

    const record = this.recorder.commitFailure(session.handle, failureInput);

    this.finishSession(session.trace.traceId, record);
    return record;
  }

  public get(traceId: string): TickTraceRecord | null {
    const record = this.recorder.get(traceId);
    return record === null ? null : deepFrozenClone(record);
  }

  public listRecent(limit?: number): readonly TickTraceRecord[] {
    return freezeArray(this.recorder.listRecent(limit).map((record) => deepFrozenClone(record)));
  }

  public listForTick(runId: string, tick: number): readonly TickTraceRecord[] {
    return freezeArray(
      this.recorder.listForTick(runId, tick).map((record) => deepFrozenClone(record)),
    );
  }

  public latestForTick(runId: string, tick: number): TickTraceRecord | null {
    const traces = this.recorder.listForTick(runId, tick);
    if (traces.length === 0) {
      return null;
    }

    return deepFrozenClone(traces[traces.length - 1]);
  }

  public getOpenTraceIds(): readonly string[] {
    return freezeArray([...this.openSessions.keys()]);
  }

  public getOpenSessions(): readonly StepTraceSession[] {
    return freezeArray([...this.openSessions.values()].map((session) => deepFrozenClone(session)));
  }

  public summarizeRun(runId: string, limit = this.maxIndexedPerRun): StepTraceRunSummary {
    const indexed = this.traceIdsByRun.get(runId) ?? [];
    const ids = indexed.slice(Math.max(0, indexed.length - limit));
    const records = ids
      .map((traceId) => this.recorder.get(traceId))
      .filter((record): record is TickTraceRecord => record !== null);

    let okCount = 0;
    let errorCount = 0;
    let durationTotal = 0;
    const steps = new Set<TickStep>();

    for (const record of records) {
      steps.add(record.step);
      durationTotal += record.durationMs;
      if (record.status === 'OK') {
        okCount += 1;
      } else {
        errorCount += 1;
      }
    }

    const latest = records.length > 0 ? records[records.length - 1] : null;

    return Object.freeze({
      runId,
      totalIndexed: records.length,
      okCount,
      errorCount,
      avgDurationMs:
        records.length > 0 ? durationTotal / records.length : 0,
      latestTraceId: latest?.traceId ?? null,
      latestTick: latest?.tick ?? null,
      stepsSeen: freezeArray([...steps]),
    });
  }

  public clear(): void {
    this.openSessions.clear();
    this.traceIdsByRun.clear();
    this.traceIdsByRunTick.clear();
    this.recorder.clear();
  }

  private toCommitInput(input: StepTraceSuccessInput): TickTraceCommitInput {
    return {
      afterSnapshot: input.afterSnapshot,
      finishedAtMs: input.finishedAtMs,
      events: input.events,
      signals: input.signals,
    };
  }

  private finishSession(traceId: string, record: TickTraceRecord): void {
    this.openSessions.delete(traceId);
    this.indexRecord(record);
  }

  private indexRecord(record: TickTraceRecord): void {
    const byRun = this.traceIdsByRun.get(record.runId) ?? [];
    byRun.push(record.traceId);
    while (byRun.length > this.maxIndexedPerRun) {
      byRun.shift();
    }
    this.traceIdsByRun.set(record.runId, byRun);

    const runTickKey = this.keyForRunTick(record.runId, record.tick);
    const byRunTick = this.traceIdsByRunTick.get(runTickKey) ?? [];
    byRunTick.push(record.traceId);
    this.traceIdsByRunTick.set(runTickKey, byRunTick);
  }

  private keyForRunTick(runId: string, tick: number): string {
    return `${runId}::${String(tick)}`;
  }
}