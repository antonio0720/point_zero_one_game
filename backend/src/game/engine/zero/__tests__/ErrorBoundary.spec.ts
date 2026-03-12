// backend/src/game/engine/zero/__tests__/ErrorBoundary.spec.ts

import { describe, expect, it } from 'vitest';

import { EventBus } from '../../core/EventBus';
import { createInitialRunState } from '../../core/RunStateFactory';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import type { TickStep } from '../../core/TickSequence';
import { ErrorBoundary } from '../ErrorBoundary';

function createSnapshot(
  seed: string,
  patch: Partial<RunStateSnapshot> = {},
): RunStateSnapshot {
  const base = createInitialRunState({
    runId: `run-${seed}`,
    userId: 'user-error-boundary',
    seed,
    mode: 'solo',
  });

  return {
    ...base,
    ...patch,
    economy: patch.economy ? { ...base.economy, ...patch.economy } : base.economy,
    pressure: patch.pressure ? { ...base.pressure, ...patch.pressure } : base.pressure,
    tension: patch.tension ? { ...base.tension, ...patch.tension } : base.tension,
    shield: patch.shield ? { ...base.shield, ...patch.shield } : base.shield,
    battle: patch.battle ? { ...base.battle, ...patch.battle } : base.battle,
    cascade: patch.cascade ? { ...base.cascade, ...patch.cascade } : base.cascade,
    sovereignty: patch.sovereignty
      ? { ...base.sovereignty, ...patch.sovereignty }
      : base.sovereignty,
    cards: patch.cards ? { ...base.cards, ...patch.cards } : base.cards,
    modeState: patch.modeState
      ? { ...base.modeState, ...patch.modeState }
      : base.modeState,
    timers: patch.timers ? { ...base.timers, ...patch.timers } : base.timers,
    telemetry: patch.telemetry
      ? { ...base.telemetry, ...patch.telemetry }
      : base.telemetry,
    tags: patch.tags ? [...patch.tags] : [...base.tags],
  } as RunStateSnapshot;
}

describe('ErrorBoundary', () => {
  it('captures a step failure, appends deterministic warnings, and emits tick.step.error without mutating the caller snapshot', () => {
    const bus = new EventBus<any>();
    const base = createSnapshot('error-boundary-capture');

    const boundary = new (ErrorBoundary as any)({
      abortWarningThreshold: 5,
      now: () => 55_000,
    });

    const error = new Error('battle engine overload');

    const result = boundary.capture({
      step: 'STEP_05_BATTLE' as TickStep,
      engineId: 'battle',
      error,
      snapshot: base,
      bus,
    }) as RunStateSnapshot;

    expect(result).not.toBe(base);
    expect(base.telemetry.warnings).toEqual([]);

    expect(result.telemetry.warnings.length).toBe(1);
    expect(result.telemetry.warnings[0]).toMatch(
      /STEP_05_BATTLE|battle|battle engine overload/i,
    );

    const envelope = bus.last('tick.step.error');
    expect(envelope).not.toBeNull();
    expect(envelope?.payload).toMatchObject({
      step: 'STEP_05_BATTLE',
      engineId: 'battle',
      message: 'battle engine overload',
      tick: base.tick,
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.telemetry.warnings)).toBe(true);
  });

  it('handles non-Error throwables and still emits a stable error payload', () => {
    const bus = new EventBus<any>();
    const base = createSnapshot('error-boundary-throwable');

    const boundary = new (ErrorBoundary as any)({
      abortWarningThreshold: 5,
      now: () => 77_000,
    });

    const result = boundary.capture({
      step: 'STEP_03_PRESSURE' as TickStep,
      engineId: 'pressure',
      error: 'pressure exploded',
      snapshot: base,
      bus,
    }) as RunStateSnapshot;

    expect(result.telemetry.warnings[0]).toMatch(/pressure exploded/i);
    expect(bus.last('tick.step.error')?.payload).toMatchObject({
      step: 'STEP_03_PRESSURE',
      engineId: 'pressure',
      message: 'pressure exploded',
    });
  });

  it('marks the run for engine-abort when the warning threshold is reached', () => {
    const bus = new EventBus<any>();
    const base = createSnapshot('error-boundary-abort-threshold', {
      telemetry: {
        ...createSnapshot('error-boundary-abort-threshold-base').telemetry,
        warnings: ['w-1', 'w-2'],
      },
    });

    const boundary = new (ErrorBoundary as any)({
      abortWarningThreshold: 3,
      now: () => 88_000,
    });

    const result = boundary.capture({
      step: 'STEP_07_CASCADE' as TickStep,
      engineId: 'cascade',
      error: new Error('cascade invalid chain state'),
      snapshot: base,
      bus,
    }) as RunStateSnapshot;

    expect(result.telemetry.warnings).toHaveLength(3);
    expect(result.tags).toContain('run:engine-abort');
    expect(result.telemetry.outcomeReason).toBe('runtime.engine_abort');
    expect(result.telemetry.outcomeReasonCode).toBe('ENGINE_ABORT');

    expect(bus.last('tick.step.error')?.payload).toMatchObject({
      step: 'STEP_07_CASCADE',
      engineId: 'cascade',
    });
  });

  it('supports explicit fatal escalation even when the warning threshold has not been crossed', () => {
    const bus = new EventBus<any>();
    const base = createSnapshot('error-boundary-fatal');

    const boundary = new (ErrorBoundary as any)({
      abortWarningThreshold: 25,
      now: () => 99_000,
    });

    const result = boundary.capture({
      step: 'STEP_10_SOVEREIGNTY_SNAPSHOT' as TickStep,
      engineId: 'sovereignty',
      error: new Error('proof integrity hard-stop'),
      fatal: true,
      snapshot: base,
      bus,
    }) as RunStateSnapshot;

    expect(result.tags).toContain('run:engine-abort');
    expect(result.telemetry.outcomeReason).toBe('runtime.engine_abort');
    expect(result.telemetry.outcomeReasonCode).toBe('ENGINE_ABORT');
    expect(result.telemetry.warnings[0]).toMatch(/proof integrity hard-stop/i);
  });
});