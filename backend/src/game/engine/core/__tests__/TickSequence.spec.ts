// backend/src/game/engine/core/__tests__/TickSequence.spec.ts

import { describe, expect, it } from 'vitest';

import {
  ENGINE_EXECUTION_STEPS,
  TICK_SEQUENCE,
  TICK_STEP_DESCRIPTORS,
  assertValidTickSequence,
  getNextTickStep,
  getPreviousTickStep,
  getTickStepDescriptor,
  getTickStepIndex,
  isEngineExecutionStep,
  isTickStep,
  type TickStep,
} from '../TickSequence';

describe('TickSequence', () => {
  it('preserves the canonical 13-step authoritative order with aligned descriptors', () => {
    expect(TICK_SEQUENCE).toHaveLength(13);
    expect(TICK_SEQUENCE).toEqual([
      'STEP_01_PREPARE',
      'STEP_02_TIME',
      'STEP_03_PRESSURE',
      'STEP_04_TENSION',
      'STEP_05_BATTLE',
      'STEP_06_SHIELD',
      'STEP_07_CASCADE',
      'STEP_08_MODE_POST',
      'STEP_09_TELEMETRY',
      'STEP_10_SOVEREIGNTY_SNAPSHOT',
      'STEP_11_OUTCOME_GATE',
      'STEP_12_EVENT_SEAL',
      'STEP_13_FLUSH',
    ]);

    expect(ENGINE_EXECUTION_STEPS).toEqual([
      'STEP_02_TIME',
      'STEP_03_PRESSURE',
      'STEP_04_TENSION',
      'STEP_05_BATTLE',
      'STEP_06_SHIELD',
      'STEP_07_CASCADE',
    ]);

    for (const [index, step] of TICK_SEQUENCE.entries()) {
      const descriptor = getTickStepDescriptor(step);

      expect(getTickStepIndex(step)).toBe(index);
      expect(descriptor.step).toBe(step);
      expect(descriptor.ordinal).toBe(index + 1);
      expect(descriptor.mutatesState).toBe(true);
      expect(descriptor.description.length).toBeGreaterThan(10);

      if (ENGINE_EXECUTION_STEPS.includes(step)) {
        expect(descriptor.phase).toBe('ENGINE');
        expect(isEngineExecutionStep(step)).toBe(true);
      } else {
        expect(isEngineExecutionStep(step)).toBe(false);
      }
    }

    expect(getTickStepDescriptor('STEP_01_PREPARE')).toEqual({
      step: 'STEP_01_PREPARE',
      ordinal: 1,
      phase: 'ORCHESTRATION',
      owner: 'system',
      mutatesState: true,
      description:
        'Freeze inputs, normalize transient state, and establish trace context.',
    });

    expect(getTickStepDescriptor('STEP_08_MODE_POST')).toEqual({
      step: 'STEP_08_MODE_POST',
      ordinal: 8,
      phase: 'MODE',
      owner: 'mode',
      mutatesState: true,
      description:
        'Apply mode-native reconciliation after core engine execution.',
    });

    expect(getTickStepDescriptor('STEP_09_TELEMETRY')).toEqual({
      step: 'STEP_09_TELEMETRY',
      ordinal: 9,
      phase: 'OBSERVABILITY',
      owner: 'telemetry',
      mutatesState: true,
      description:
        'Materialize decision telemetry, audit hints, and event-facing summaries.',
    });

    expect(getTickStepDescriptor('STEP_10_SOVEREIGNTY_SNAPSHOT')).toEqual({
      step: 'STEP_10_SOVEREIGNTY_SNAPSHOT',
      ordinal: 10,
      phase: 'OBSERVABILITY',
      owner: 'sovereignty',
      mutatesState: true,
      description:
        'Compute deterministic checksums, integrity status, and proof-facing snapshot data.',
    });

    expect(getTickStepDescriptor('STEP_13_FLUSH')).toEqual({
      step: 'STEP_13_FLUSH',
      ordinal: 13,
      phase: 'FINALIZATION',
      owner: 'system',
      mutatesState: true,
      description:
        'Flush pending buffers and finalize the tick boundary for the next cycle.',
    });

    expect(Object.keys(TICK_STEP_DESCRIPTORS).sort()).toEqual([...TICK_SEQUENCE].sort());
  });

  it('supports navigation and type guards without leaking illegal values across boundaries', () => {
    expect(isTickStep('STEP_01_PREPARE')).toBe(true);
    expect(isTickStep('STEP_07_CASCADE')).toBe(true);
    expect(isTickStep('STEP_13_FLUSH')).toBe(true);

    expect(isTickStep('STEP_14_NOT_REAL')).toBe(false);
    expect(isTickStep('prepare')).toBe(false);
    expect(isTickStep('')).toBe(false);

    expect(getPreviousTickStep('STEP_01_PREPARE')).toBeNull();
    expect(getNextTickStep('STEP_01_PREPARE')).toBe('STEP_02_TIME');

    expect(getPreviousTickStep('STEP_02_TIME')).toBe('STEP_01_PREPARE');
    expect(getNextTickStep('STEP_02_TIME')).toBe('STEP_03_PRESSURE');

    expect(getPreviousTickStep('STEP_08_MODE_POST')).toBe('STEP_07_CASCADE');
    expect(getNextTickStep('STEP_08_MODE_POST')).toBe('STEP_09_TELEMETRY');

    expect(getPreviousTickStep('STEP_13_FLUSH')).toBe('STEP_12_EVENT_SEAL');
    expect(getNextTickStep('STEP_13_FLUSH')).toBeNull();
  });

  it('assertValidTickSequence() accepts the canonical sequence and rejects drift loudly', () => {
    expect(() => assertValidTickSequence()).not.toThrow();
    expect(() => assertValidTickSequence(TICK_SEQUENCE)).not.toThrow();

    expect(() =>
      assertValidTickSequence(TICK_SEQUENCE.slice(0, -1)),
    ).toThrowError(
      'Invalid tick sequence length. Expected 13, received 12.',
    );

    const reordered = [...TICK_SEQUENCE];
    [reordered[1], reordered[2]] = [reordered[2]!, reordered[1]!];

    expect(() =>
      assertValidTickSequence(reordered as readonly TickStep[]),
    ).toThrowError(
      'Tick sequence mismatch at index 1. Expected STEP_02_TIME, received STEP_03_PRESSURE.',
    );

    const duplicated = [...TICK_SEQUENCE];
    duplicated[12] = 'STEP_12_EVENT_SEAL';

    expect(() =>
      assertValidTickSequence(duplicated as readonly TickStep[]),
    ).toThrowError(
      'Tick sequence mismatch at index 12. Expected STEP_13_FLUSH, received STEP_12_EVENT_SEAL.',
    );

    const wrongStart = [...TICK_SEQUENCE];
    wrongStart[0] = 'STEP_02_TIME';

    expect(() =>
      assertValidTickSequence(wrongStart as readonly TickStep[]),
    ).toThrowError(
      'Tick sequence mismatch at index 0. Expected STEP_01_PREPARE, received STEP_02_TIME.',
    );

    const wrongEnd = [...TICK_SEQUENCE];
    wrongEnd[12] = 'STEP_12_EVENT_SEAL';

    expect(() =>
      assertValidTickSequence(wrongEnd as readonly TickStep[]),
    ).toThrowError(
      'Tick sequence mismatch at index 12. Expected STEP_13_FLUSH, received STEP_12_EVENT_SEAL.',
    );
  });

  it('exposes a deterministic step index lattice that remains contiguous from 0..12', () => {
    const indexes = TICK_SEQUENCE.map((step) => getTickStepIndex(step));

    expect(indexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    for (let index = 0; index < TICK_SEQUENCE.length; index += 1) {
      const step = TICK_SEQUENCE[index]!;
      expect(getTickStepIndex(step)).toBe(index);
      expect(TICK_SEQUENCE[getTickStepIndex(step)]).toBe(step);
    }
  });
});