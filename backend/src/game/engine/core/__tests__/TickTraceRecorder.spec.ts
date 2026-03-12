// backend/src/game/engine/core/__tests__/TickTraceRecorder.spec.ts

import { describe, expect, it } from 'vitest';

import type { EventEnvelope } from '../EventBus';
import type { EngineSignal, TickTrace } from '../EngineContracts';
import type { RunStateSnapshot } from '../RunStateSnapshot';
import type { RunFactoryInput } from '../RunStateFactory';

import { checksumParts, checksumSnapshot, createDeterministicId } from '../Deterministic';
import { createEngineSignal } from '../EngineContracts';
import { EventBus } from '../EventBus';
import { createInitialRunState } from '../RunStateFactory';
import { TickTraceRecorder } from '../TickTraceRecorder';

type Mutable<T> = {
  -readonly [K in keyof T]: Mutable<T[K]>;
};

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

interface TraceEventMap extends Record<string, unknown> {
  'tick.started': { tick: number; phase: string };
  'pressure.changed': { score: number; band: string };
  'trace.sealed': { traceId: string };
}

function baseRunInput(overrides: Partial<RunFactoryInput> = {}): RunFactoryInput {
  return {
    runId: 'run_tick_trace_spec',
    userId: 'user_tick_trace_spec',
    seed: 'seed_tick_trace_spec',
    mode: 'solo',
    seasonBudgetMs: 60_000,
    currentTickDurationMs: 5_000,
    freedomTarget: 100_000,
    initialCash: 10_000,
    initialDebt: 500,
    ...overrides,
  };
}

function createSnapshot(overrides: Partial<RunFactoryInput> = {}): RunStateSnapshot {
  return createInitialRunState(baseRunInput(overrides));
}

function cloneSnapshot(snapshot: RunStateSnapshot): Mutable<RunStateSnapshot> {
  return JSON.parse(JSON.stringify(snapshot)) as Mutable<RunStateSnapshot>;
}

function createTrace(
  snapshot: RunStateSnapshot,
  overrides: Partial<TickTrace> = {},
): TickTrace {
  return {
    runId: snapshot.runId,
    tick: snapshot.tick,
    step: 'STEP_03_PRESSURE',
    mode: snapshot.mode,
    phase: snapshot.phase,
    traceId: 'trace_tick_trace_recorder_spec',
    ...overrides,
  };
}

function computeExpectedEventChecksums(
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

describe('TickTraceRecorder', () => {
  it('begin() captures a deterministic before-checksum surface for the full trace boundary', () => {
    const recorder = new TickTraceRecorder();
    const snapshot = createSnapshot();
    const trace = createTrace(snapshot, {
      step: 'STEP_02_TIME',
      traceId: 'trace_begin_surface_spec',
    });

    const handle = recorder.begin(snapshot, trace, 5_000);

    expect(handle.trace).toEqual(trace);
    expect(handle.startedAtMs).toBe(5_000);
    expect(handle.beforeChecksum).toBe(checksumSnapshot(snapshot));
    expect(Object.keys(handle.beforeSectionChecksums)).toEqual(TRACE_SURFACE_KEYS);

    for (const key of TRACE_SURFACE_KEYS) {
      expect(handle.beforeSectionChecksums[key]).toBe(checksumSnapshot(snapshot[key]));
    }
  });

  it('commitSuccess() stores a frozen forensic record with mutation summary, checksums, and seal', () => {
    const recorder = new TickTraceRecorder();
    const snapshot = createSnapshot();
    const trace = createTrace(snapshot, {
      tick: 7,
      step: 'STEP_03_PRESSURE',
      traceId: 'trace_success_spec',
    });

    const handle = recorder.begin(snapshot, trace, 10_000);

    const afterDraft = cloneSnapshot(snapshot);
    afterDraft.pressure.score = 0.92;
    afterDraft.pressure.band = 'CRITICAL';
    afterDraft.telemetry.warnings = ['pressure threshold crossed'];
    afterDraft.telemetry.emittedEventCount = 2;

    const afterSnapshot = afterDraft as RunStateSnapshot;

    const bus = new EventBus<TraceEventMap>();
    const eventA = bus.emit(
      'tick.started',
      { tick: 7, phase: afterSnapshot.phase },
      { emittedAtTick: 7, tags: ['trace', 'bootstrap'] },
    );
    const eventB = bus.emit(
      'pressure.changed',
      { score: 0.92, band: 'CRITICAL' },
      { emittedAtTick: 7, tags: ['pressure', 'critical'] },
    );

    const signals: readonly EngineSignal[] = [
      createEngineSignal(
        'pressure',
        'WARN',
        'PRESSURE_CRITICAL',
        'pressure crossed critical threshold',
        7,
        ['pressure', 'critical'],
      ),
      createEngineSignal(
        'pressure',
        'INFO',
        'PRESSURE_RECOMPUTE_DONE',
        'pressure recompute completed',
        7,
        ['pressure', 'done'],
      ),
    ];

    const record = recorder.commitSuccess(handle, {
      afterSnapshot,
      finishedAtMs: 10_125,
      events: [eventA, eventB],
      signals,
    });

    const expectedEventChecksums = computeExpectedEventChecksums([eventA, eventB]);

    expect(record.traceId).toBe('trace_success_spec');
    expect(record.runId).toBe(snapshot.runId);
    expect(record.tick).toBe(7);
    expect(record.step).toBe('STEP_03_PRESSURE');
    expect(record.mode).toBe(snapshot.mode);
    expect(record.phase).toBe(snapshot.phase);
    expect(record.status).toBe('OK');
    expect(record.startedAtMs).toBe(10_000);
    expect(record.finishedAtMs).toBe(10_125);
    expect(record.durationMs).toBe(125);
    expect(record.beforeChecksum).toBe(checksumSnapshot(snapshot));
    expect(record.afterChecksum).toBe(checksumSnapshot(afterSnapshot));
    expect(record.eventCount).toBe(2);
    expect(record.eventSequences).toEqual([eventA.sequence, eventB.sequence]);
    expect(record.eventChecksums).toEqual(expectedEventChecksums);
    expect(record.signalCount).toBe(2);
    expect(record.signalCodes).toEqual(['PRESSURE_CRITICAL', 'PRESSURE_RECOMPUTE_DONE']);
    expect(record.mutation.changedTopLevelKeys).toEqual(['pressure', 'telemetry']);
    expect(record.mutation.beforeSectionChecksums.pressure).toBe(
      checksumSnapshot(snapshot.pressure),
    );
    expect(record.mutation.afterSectionChecksums.pressure).toBe(
      checksumSnapshot(afterSnapshot.pressure),
    );
    expect(record.mutation.beforeSectionChecksums.telemetry).toBe(
      checksumSnapshot(snapshot.telemetry),
    );
    expect(record.mutation.afterSectionChecksums.telemetry).toBe(
      checksumSnapshot(afterSnapshot.telemetry),
    );
    expect(record.errorMessage).toBeNull();

    expect(record.seal).toBe(
      checksumParts(
        trace.runId,
        trace.tick,
        trace.step,
        'OK',
        handle.beforeChecksum,
        checksumSnapshot(afterSnapshot),
        10_125,
        ...expectedEventChecksums,
        'PRESSURE_CRITICAL',
        'PRESSURE_RECOMPUTE_DONE',
        'ok',
      ),
    );

    expect(recorder.get('trace_success_spec')).toEqual(record);
    expect(recorder.listForTick(snapshot.runId, 7)).toEqual([record]);
    expect(recorder.listRecent()).toEqual([record]);

    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(record.eventSequences)).toBe(true);
    expect(Object.isFrozen(record.eventChecksums)).toBe(true);
    expect(Object.isFrozen(record.signalCodes)).toBe(true);
    expect(Object.isFrozen(record.mutation)).toBe(true);
    expect(Object.isFrozen(record.mutation.changedTopLevelKeys)).toBe(true);
    expect(Object.isFrozen(record.mutation.beforeSectionChecksums)).toBe(true);
    expect(Object.isFrozen(record.mutation.afterSectionChecksums)).toBe(true);
  });

  it('commitFailure() records error traces, preserves before checksums when no after snapshot exists, and falls back to deterministic ids', () => {
    const recorder = new TickTraceRecorder();
    const snapshot = createSnapshot();
    const trace = createTrace(snapshot, {
      tick: 11,
      step: 'STEP_05_BATTLE',
      traceId: '',
    });

    const handle = recorder.begin(snapshot, trace, 22_000);

    const signal = createEngineSignal(
      'battle',
      'ERROR',
      'BATTLE_RUNTIME_FAILURE',
      'battle execution aborted',
      11,
      ['battle', 'error'],
    );

    const record = recorder.commitFailure(handle, {
      finishedAtMs: 22_333,
      error: { unexpected: true },
      signals: [signal],
    });

    expect(record.traceId).toBe(
      createDeterministicId(
        'tick-trace-record',
        trace.runId,
        trace.tick,
        trace.step,
        handle.startedAtMs,
      ),
    );
    expect(record.status).toBe('ERROR');
    expect(record.afterChecksum).toBeNull();
    expect(record.durationMs).toBe(333);
    expect(record.errorMessage).toBe('Unknown runtime trace failure.');
    expect(record.eventCount).toBe(0);
    expect(record.eventSequences).toEqual([]);
    expect(record.eventChecksums).toEqual([]);
    expect(record.signalCount).toBe(1);
    expect(record.signalCodes).toEqual(['BATTLE_RUNTIME_FAILURE']);
    expect(record.mutation.changedTopLevelKeys).toEqual([]);
    expect(record.mutation.beforeSectionChecksums).toEqual(handle.beforeSectionChecksums);
    expect(record.mutation.afterSectionChecksums).toEqual(handle.beforeSectionChecksums);

    expect(record.seal).toBe(
      checksumParts(
        trace.runId,
        trace.tick,
        trace.step,
        'ERROR',
        handle.beforeChecksum,
        'no-after-snapshot',
        22_333,
        'BATTLE_RUNTIME_FAILURE',
        'Unknown runtime trace failure.',
      ),
    );

    expect(recorder.get(record.traceId)).toEqual(record);
  });

  it('commitFailure() normalizes Error instances and string errors to clean error messages', () => {
    const recorder = new TickTraceRecorder();
    const snapshot = createSnapshot();

    const traceA = createTrace(snapshot, {
      tick: 2,
      step: 'STEP_04_TENSION',
      traceId: 'trace_failure_error_instance',
    });
    const handleA = recorder.begin(snapshot, traceA, 3_000);
    const recordA = recorder.commitFailure(handleA, {
      finishedAtMs: 3_111,
      error: new Error('tension exploded'),
    });

    const traceB = createTrace(snapshot, {
      tick: 3,
      step: 'STEP_06_SHIELD',
      traceId: 'trace_failure_string_error',
    });
    const handleB = recorder.begin(snapshot, traceB, 4_000);
    const recordB = recorder.commitFailure(handleB, {
      finishedAtMs: 4_111,
      error: '   shield panic   ',
    });

    expect(recordA.errorMessage).toBe('tension exploded');
    expect(recordB.errorMessage).toBe('shield panic');
  });

  it('listRecent(limit) and trimIfNeeded() preserve newest records while evicting old traceId/tick indexes', () => {
    const recorder = new TickTraceRecorder({ maxRecords: 2 });
    const snapshot = createSnapshot();

    const traceA = createTrace(snapshot, {
      tick: 1,
      step: 'STEP_02_TIME',
      traceId: 'trace_trim_a',
    });
    const traceB = createTrace(snapshot, {
      tick: 2,
      step: 'STEP_03_PRESSURE',
      traceId: 'trace_trim_b',
    });
    const traceC = createTrace(snapshot, {
      tick: 3,
      step: 'STEP_04_TENSION',
      traceId: 'trace_trim_c',
    });

    const recordA = recorder.commitSuccess(
      recorder.begin(snapshot, traceA, 1_000),
      {
        afterSnapshot: snapshot,
        finishedAtMs: 1_010,
      },
    );

    const recordB = recorder.commitSuccess(
      recorder.begin(snapshot, traceB, 2_000),
      {
        afterSnapshot: snapshot,
        finishedAtMs: 2_010,
      },
    );

    const recordC = recorder.commitSuccess(
      recorder.begin(snapshot, traceC, 3_000),
      {
        afterSnapshot: snapshot,
        finishedAtMs: 3_010,
      },
    );

    expect(recorder.get('trace_trim_a')).toBeNull();
    expect(recorder.get('trace_trim_b')).toEqual(recordB);
    expect(recorder.get('trace_trim_c')).toEqual(recordC);

    expect(recorder.listRecent()).toEqual([recordB, recordC]);
    expect(recorder.listRecent(1)).toEqual([recordC]);
    expect(recorder.listRecent(0)).toEqual([]);

    expect(recorder.listForTick(snapshot.runId, 1)).toEqual([]);
    expect(recorder.listForTick(snapshot.runId, 2)).toEqual([recordB]);
    expect(recorder.listForTick(snapshot.runId, 3)).toEqual([recordC]);

    expect(recordA.traceId).toBe('trace_trim_a');
  });

  it('clear() removes all stored records and secondary indexes', () => {
    const recorder = new TickTraceRecorder();
    const snapshot = createSnapshot();
    const trace = createTrace(snapshot, {
      tick: 5,
      step: 'STEP_09_TELEMETRY',
      traceId: 'trace_clear_spec',
    });

    const record = recorder.commitSuccess(
      recorder.begin(snapshot, trace, 9_000),
      {
        afterSnapshot: snapshot,
        finishedAtMs: 9_050,
      },
    );

    expect(recorder.get(record.traceId)).toEqual(record);
    expect(recorder.listRecent()).toEqual([record]);
    expect(recorder.listForTick(snapshot.runId, 5)).toEqual([record]);

    recorder.clear();

    expect(recorder.get(record.traceId)).toBeNull();
    expect(recorder.listRecent()).toEqual([]);
    expect(recorder.listRecent(5)).toEqual([]);
    expect(recorder.listForTick(snapshot.runId, 5)).toEqual([]);
  });
});