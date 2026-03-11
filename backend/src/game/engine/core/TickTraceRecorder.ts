/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/TickTraceRecorder.ts
 *
 * Doctrine:
 * - tick traces are deterministic forensic records, not ad-hoc logs
 * - every step record must be bounded, hashable, and replay-safe
 * - mutation summaries should be cheap enough for hot-path runtime use
 * - stored traces must never expose writable snapshot references
 */

import type { EventEnvelope } from './EventBus';
import type { EngineSignal, TickTrace } from './EngineContracts';
import type { RunStateSnapshot } from './RunStateSnapshot';
import {
  checksumParts,
  checksumSnapshot,
  createDeterministicId,
  deepFrozenClone,
} from './Deterministic';

export type TickTraceStatus = 'OK' | 'ERROR';

export interface TickTraceRecorderOptions {
  readonly maxRecords?: number;
}

export interface TickTraceHandle {
  readonly trace: TickTrace;
  readonly startedAtMs: number;
  readonly beforeChecksum: string;
  readonly beforeSectionChecksums: Readonly<Record<string, string>>;
}

export interface TickTraceMutationSummary {
  readonly changedTopLevelKeys: readonly string[];
  readonly beforeSectionChecksums: Readonly<Record<string, string>>;
  readonly afterSectionChecksums: Readonly<Record<string, string>>;
}

export interface TickTraceRecord {
  readonly traceId: string;
  readonly runId: string;
  readonly tick: number;
  readonly step: TickTrace['step'];
  readonly mode: TickTrace['mode'];
  readonly phase: TickTrace['phase'];
  readonly status: TickTraceStatus;
  readonly startedAtMs: number;
  readonly finishedAtMs: number;
  readonly durationMs: number;
  readonly beforeChecksum: string;
  readonly afterChecksum: string | null;
  readonly eventCount: number;
  readonly eventSequences: readonly number[];
  readonly eventChecksums: readonly string[];
  readonly signalCount: number;
  readonly signalCodes: readonly string[];
  readonly mutation: TickTraceMutationSummary;
  readonly errorMessage: string | null;
  readonly seal: string;
}

export interface TickTraceCommitInput {
  readonly afterSnapshot: RunStateSnapshot;
  readonly finishedAtMs: number;
  readonly events?: readonly EventEnvelope<string, unknown>[];
  readonly signals?: readonly EngineSignal[];
}

export interface TickTraceFailureInput {
  readonly finishedAtMs: number;
  readonly error: unknown;
  readonly afterSnapshot?: RunStateSnapshot;
  readonly events?: readonly EventEnvelope<string, unknown>[];
  readonly signals?: readonly EngineSignal[];
}

const DEFAULT_MAX_RECORDS = 16_384;

const TRACE_SURFACE_KEYS = [
  'tick',
  'phase',
  'outcome',
  'economy',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
  'cards',
  'modeState',
  'timers',
  'telemetry',
  'tags',
] as const satisfies ReadonlyArray<keyof RunStateSnapshot>;

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }

  return 'Unknown runtime trace failure.';
}

function buildSectionChecksums(
  snapshot: RunStateSnapshot,
): Record<string, string> {
  const sections: Record<string, string> = {};

  for (const key of TRACE_SURFACE_KEYS) {
    sections[String(key)] = checksumSnapshot(snapshot[key]);
  }

  return sections;
}

function computeChangedKeys(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
): string[] {
  const keys = new Set<string>([
    ...Object.keys(before),
    ...Object.keys(after),
  ]);

  return [...keys]
    .filter((key) => before[key] !== after[key])
    .sort((left, right) => left.localeCompare(right));
}

function computeEventChecksums(
  events: readonly EventEnvelope<string, unknown>[],
): string[] {
  return events.map((event) =>
    checksumSnapshot({
      sequence: event.sequence,
      event: event.event,
      payload: event.payload,
      emittedAtTick: event.emittedAtTick,
      tags: event.tags ?? [],
    }),
  );
}

function toFrozenRecord(record: TickTraceRecord): TickTraceRecord {
  return deepFrozenClone(record);
}

export class TickTraceRecorder {
  private readonly maxRecords: number;
  private readonly records: TickTraceRecord[] = [];
  private readonly recordsByTraceId = new Map<string, TickTraceRecord>();
  private readonly recordsByRunTick = new Map<string, TickTraceRecord[]>();

  public constructor(options: TickTraceRecorderOptions = {}) {
    this.maxRecords = Math.max(1, options.maxRecords ?? DEFAULT_MAX_RECORDS);
  }

  public begin(
    snapshot: RunStateSnapshot,
    trace: TickTrace,
    startedAtMs: number,
  ): TickTraceHandle {
    return {
      trace,
      startedAtMs,
      beforeChecksum: checksumSnapshot(snapshot),
      beforeSectionChecksums: buildSectionChecksums(snapshot),
    };
  }

  public commitSuccess(
    handle: TickTraceHandle,
    input: TickTraceCommitInput,
  ): TickTraceRecord {
    return this.commit(handle, {
      status: 'OK',
      afterSnapshot: input.afterSnapshot,
      finishedAtMs: input.finishedAtMs,
      events: input.events ?? [],
      signals: input.signals ?? [],
      errorMessage: null,
    });
  }

  public commitFailure(
    handle: TickTraceHandle,
    input: TickTraceFailureInput,
  ): TickTraceRecord {
    return this.commit(handle, {
      status: 'ERROR',
      afterSnapshot: input.afterSnapshot ?? null,
      finishedAtMs: input.finishedAtMs,
      events: input.events ?? [],
      signals: input.signals ?? [],
      errorMessage: normalizeErrorMessage(input.error),
    });
  }

  public get(traceId: string): TickTraceRecord | null {
    return this.recordsByTraceId.get(traceId) ?? null;
  }

  public listRecent(limit?: number): readonly TickTraceRecord[] {
    if (limit === undefined || limit >= this.records.length) {
      return [...this.records];
    }

    if (limit <= 0) {
      return [];
    }

    return this.records.slice(this.records.length - limit);
  }

  public listForTick(runId: string, tick: number): readonly TickTraceRecord[] {
    const key = this.keyForRunTick(runId, tick);
    return [...(this.recordsByRunTick.get(key) ?? [])];
  }

  public clear(): void {
    this.records.length = 0;
    this.recordsByTraceId.clear();
    this.recordsByRunTick.clear();
  }

  private commit(
    handle: TickTraceHandle,
    input: {
      readonly status: TickTraceStatus;
      readonly afterSnapshot: RunStateSnapshot | null;
      readonly finishedAtMs: number;
      readonly events: readonly EventEnvelope<string, unknown>[];
      readonly signals: readonly EngineSignal[];
      readonly errorMessage: string | null;
    },
  ): TickTraceRecord {
    const finishedAtMs = Math.max(handle.startedAtMs, Math.trunc(input.finishedAtMs));
    const durationMs = finishedAtMs - handle.startedAtMs;
    const afterSectionChecksums =
      input.afterSnapshot === null
        ? Object.freeze({ ...handle.beforeSectionChecksums })
        : buildSectionChecksums(input.afterSnapshot);
    const afterChecksum =
      input.afterSnapshot === null ? null : checksumSnapshot(input.afterSnapshot);
    const eventChecksums = computeEventChecksums(input.events);
    const eventSequences = input.events.map((event) => event.sequence);
    const signalCodes = input.signals.map((signal) => signal.code);
    const changedTopLevelKeys =
      input.afterSnapshot === null
        ? []
        : computeChangedKeys(handle.beforeSectionChecksums, afterSectionChecksums);

    const record: TickTraceRecord = {
      traceId:
        handle.trace.traceId ||
        createDeterministicId(
          'tick-trace-record',
          handle.trace.runId,
          handle.trace.tick,
          handle.trace.step,
          handle.startedAtMs,
        ),
      runId: handle.trace.runId,
      tick: handle.trace.tick,
      step: handle.trace.step,
      mode: handle.trace.mode,
      phase: handle.trace.phase,
      status: input.status,
      startedAtMs: handle.startedAtMs,
      finishedAtMs,
      durationMs,
      beforeChecksum: handle.beforeChecksum,
      afterChecksum,
      eventCount: input.events.length,
      eventSequences,
      eventChecksums,
      signalCount: input.signals.length,
      signalCodes,
      mutation: {
        changedTopLevelKeys,
        beforeSectionChecksums: handle.beforeSectionChecksums,
        afterSectionChecksums,
      },
      errorMessage: input.errorMessage,
      seal: checksumParts(
        handle.trace.runId,
        handle.trace.tick,
        handle.trace.step,
        input.status,
        handle.beforeChecksum,
        afterChecksum ?? 'no-after-snapshot',
        finishedAtMs,
        ...eventChecksums,
        ...signalCodes,
        input.errorMessage ?? 'ok',
      ),
    };

    return this.storeRecord(record);
  }

  private storeRecord(record: TickTraceRecord): TickTraceRecord {
    const frozen = toFrozenRecord(record);
    this.records.push(frozen);
    this.recordsByTraceId.set(frozen.traceId, frozen);

    const key = this.keyForRunTick(frozen.runId, frozen.tick);
    const bucket = this.recordsByRunTick.get(key) ?? [];
    bucket.push(frozen);
    this.recordsByRunTick.set(key, bucket);

    this.trimIfNeeded();
    return frozen;
  }

  private trimIfNeeded(): void {
    while (this.records.length > this.maxRecords) {
      const removed = this.records.shift();
      if (!removed) {
        return;
      }

      this.recordsByTraceId.delete(removed.traceId);

      const key = this.keyForRunTick(removed.runId, removed.tick);
      const bucket = this.recordsByRunTick.get(key);
      if (!bucket) {
        continue;
      }

      const nextBucket = bucket.filter((entry) => entry.traceId !== removed.traceId);
      if (nextBucket.length === 0) {
        this.recordsByRunTick.delete(key);
      } else {
        this.recordsByRunTick.set(key, nextBucket);
      }
    }
  }

  private keyForRunTick(runId: string, tick: number): string {
    return `${runId}::${String(tick)}`;
  }
}
