// FILE: backend/src/game/engine/core/__tests__/TickSequence.tension.spec.ts

import { describe, expect, it } from 'vitest';

import {
  assertValidTickSequence,
  ENGINE_EXECUTION_STEPS,
  getNextTickStep,
  getPreviousTickStep,
  getTickStepDescriptor,
  getTickStepIndex,
  isEngineExecutionStep,
  TICK_SEQUENCE,
} from '../TickSequence';

describe('TickSequence — tension placement', () => {
  it('pins STEP_04_TENSION directly after pressure and directly before battle', () => {
    const tensionIndex = getTickStepIndex('STEP_04_TENSION');
    const pressureIndex = getTickStepIndex('STEP_03_PRESSURE');
    const battleIndex = getTickStepIndex('STEP_05_BATTLE');

    expect(tensionIndex).toBe(3);
    expect(pressureIndex).toBe(2);
    expect(battleIndex).toBe(4);

    expect(tensionIndex).toBe(pressureIndex + 1);
    expect(battleIndex).toBe(tensionIndex + 1);
    expect(getPreviousTickStep('STEP_04_TENSION')).toBe('STEP_03_PRESSURE');
    expect(getNextTickStep('STEP_04_TENSION')).toBe('STEP_05_BATTLE');
  });

  it('marks the tension step as an engine-owned mutating step with ordinal 4', () => {
    const descriptor = getTickStepDescriptor('STEP_04_TENSION');

    expect(descriptor.step).toBe('STEP_04_TENSION');
    expect(descriptor.ordinal).toBe(4);
    expect(descriptor.phase).toBe('ENGINE');
    expect(descriptor.owner).toBe('tension');
    expect(descriptor.mutatesState).toBe(true);
    expect(descriptor.description).toContain('anticipation');
  });

  it('includes the tension step in the executable engine phase surface', () => {
    expect(TICK_SEQUENCE).toContain('STEP_04_TENSION');
    expect(ENGINE_EXECUTION_STEPS).toContain('STEP_04_TENSION');
    expect(isEngineExecutionStep('STEP_04_TENSION')).toBe(true);
  });

  it('fails loudly if tension is reordered ahead of pressure', () => {
    const invalid = [...TICK_SEQUENCE];
    const pressureIndex = invalid.indexOf('STEP_03_PRESSURE');
    const tensionIndex = invalid.indexOf('STEP_04_TENSION');

    [invalid[pressureIndex], invalid[tensionIndex]] = [
      invalid[tensionIndex],
      invalid[pressureIndex],
    ];

    expect(() => assertValidTickSequence(invalid)).toThrowError(
      /Tick sequence mismatch/,
    );
  });

  it('fails loudly if tension is reordered behind battle', () => {
    const invalid = [...TICK_SEQUENCE];
    const tensionIndex = invalid.indexOf('STEP_04_TENSION');
    const battleIndex = invalid.indexOf('STEP_05_BATTLE');

    [invalid[tensionIndex], invalid[battleIndex]] = [
      invalid[battleIndex],
      invalid[tensionIndex],
    ];

    expect(() => assertValidTickSequence(invalid)).toThrowError(
      /Tick sequence mismatch/,
    );
  });
});