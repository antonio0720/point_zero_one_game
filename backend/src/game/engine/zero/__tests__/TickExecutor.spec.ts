// backend/src/game/engine/zero/__tests__/TickExecutor.spec.ts

import { describe, expect, it, vi } from 'vitest';

import { EventBus } from '../../core/EventBus';
import { createInitialRunState } from '../../core/RunStateFactory';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { TICK_SEQUENCE, type TickStep } from '../../core/TickSequence';
import { TickExecutor } from '../TickExecutor';

function createSnapshot(
  seed: string,
  patch: Partial<RunStateSnapshot> = {},
): RunStateSnapshot {
  const base = createInitialRunState({
    runId: `run-${seed}`,
    userId: 'user-tick-executor',
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
  } as RunStateSnapshot;
}

describe('TickExecutor', () => {
  it('runs the canonical non-flush steps in order, flushes once, checkpoints once, and builds the final tick result', () => {
    const base = createSnapshot('executor-order');
    const bus = new EventBus<any>();
    const seen: string[] = [];

    bus.emit('pre.existing', { ok: true });

    const stepRunner = {
      run: vi.fn(({ step, snapshot }: { step: TickStep; snapshot: RunStateSnapshot }) => {
        seen.push(step);
        return createSnapshot(`executor-order-${step}`, {
          ...snapshot,
          telemetry: {
            ...snapshot.telemetry,
            warnings: [...snapshot.telemetry.warnings, step],
          },
        });
      }),
    };

    const outcomeGate = {
      resolve: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    };

    const eventFlushCoordinator = {
      flush: vi.fn(({ bus: runtimeBus }: { bus: EventBus<any> }) => {
        seen.push('STEP_13_FLUSH');
        return runtimeBus.flush();
      }),
    };

    const stepTracePublisher = {
      openTrace: vi.fn(),
      recordStep: vi.fn(),
      closeTrace: vi.fn(() => []),
    };

    const runtimeCheckpointCoordinator = {
      capture: vi.fn(),
    };

    const tickResult = { kind: 'tick-result' };

    const tickResultBuilder = {
      build: vi.fn(() => tickResult),
    };

    const errorBoundary = {
      capture: vi.fn(({ snapshot }: { snapshot: RunStateSnapshot }) => snapshot),
    };

    const executor = new (TickExecutor as any)({
      stepRunner,
      outcomeGate,
      eventFlushCoordinator,
      stepTracePublisher,
      runtimeCheckpointCoordinator,
      tickResultBuilder,
      errorBoundary,
      now: () => 12_345,
    });

    const result = (executor as any).execute({
      snapshot: base,
      bus,
    });

    const nonFlushSteps = TICK_SEQUENCE.filter((step) => step !== 'STEP_13_FLUSH');

    expect(stepRunner.run).toHaveBeenCalledTimes(nonFlushSteps.length);
    expect(seen).toEqual([...nonFlushSteps, 'STEP_13_FLUSH']);
    expect(eventFlushCoordinator.flush).toHaveBeenCalledTimes(1);
    expect(runtimeCheckpointCoordinator.capture).toHaveBeenCalledTimes(1);
    expect(stepTracePublisher.openTrace).toHaveBeenCalledTimes(1);
    expect(stepTracePublisher.closeTrace).toHaveBeenCalledTimes(1);
    expect(tickResultBuilder.build).toHaveBeenCalledTimes(1);
    expect(result).toBe(tickResult);
  });

  it('routes step failures through ErrorBoundary and continues executing later steps', () => {
    const base = createSnapshot('executor-errors');
    const bus = new EventBus<any>();
    const executed: string[] = [];
    const battleFailure = new Error('battle engine hard failure');

    const stepRunner = {
      run: vi.fn(({ step, snapshot }: { step: TickStep; snapshot: RunStateSnapshot }) => {
        executed.push(step);

        if (step === 'STEP_05_BATTLE') {
          throw battleFailure;
        }

        return snapshot;
      }),
    };

    const errorBoundary = {
      capture: vi.fn(
        ({
          step,
          snapshot,
        }: {
          step: TickStep;
          snapshot: RunStateSnapshot;
        }) =>
          createSnapshot(`executor-error-${step}`, {
            ...snapshot,
            telemetry: {
              ...snapshot.telemetry,
              warnings: [...snapshot.telemetry.warnings, `captured:${step}`],
            },
          }),
      ),
    };

    const eventFlushCoordinator = {
      flush: vi.fn(({ bus: runtimeBus }: { bus: EventBus<any> }) => runtimeBus.flush()),
    };

    const outcomeGate = {
      resolve: vi.fn((snapshot: RunStateSnapshot) => snapshot),
    };

    const tickResultBuilder = {
      build: vi.fn(({ snapshot }: { snapshot: RunStateSnapshot }) => snapshot),
    };

    const executor = new (TickExecutor as any)({
      stepRunner,
      errorBoundary,
      outcomeGate,
      eventFlushCoordinator,
      tickResultBuilder,
      stepTracePublisher: {
        openTrace: vi.fn(),
        recordStep: vi.fn(),
        closeTrace: vi.fn(() => []),
      },
      runtimeCheckpointCoordinator: {
        capture: vi.fn(),
      },
      now: () => 22_222,
    });

    const result = (executor as any).execute({
      snapshot: base,
      bus,
    }) as RunStateSnapshot;

    expect(errorBoundary.capture).toHaveBeenCalledTimes(1);
    expect(errorBoundary.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'STEP_05_BATTLE',
        error: battleFailure,
      }),
    );

    expect(executed).toContain('STEP_07_CASCADE');
    expect(executed.at(-1)).toBe('STEP_12_EVENT_SEAL');
    expect(result.telemetry.warnings).toContain('captured:STEP_05_BATTLE');
  });

  it('invokes outcome resolution before flush and passes the resolved terminal snapshot into TickResultBuilder', () => {
    const base = createSnapshot('executor-outcome');
    const bus = new EventBus<any>();
    const seen: string[] = [];

    const stepRunner = {
      run: vi.fn(({ step, snapshot }: { step: TickStep; snapshot: RunStateSnapshot }) => {
        seen.push(step);
        return snapshot;
      }),
    };

    const resolvedSnapshot = createSnapshot('executor-outcome-resolved', {
      outcome: 'FREEDOM',
    });

    const outcomeGate = {
      resolve: vi.fn((snapshot: RunStateSnapshot) => {
        seen.push('OUTCOME_GATE');
        return {
          ...resolvedSnapshot,
          telemetry: {
            ...resolvedSnapshot.telemetry,
            warnings: [...snapshot.telemetry.warnings],
          },
        };
      }),
    };

    const eventFlushCoordinator = {
      flush: vi.fn(({ bus: runtimeBus }: { bus: EventBus<any> }) => {
        seen.push('STEP_13_FLUSH');
        return runtimeBus.flush();
      }),
    };

    const tickResultBuilder = {
      build: vi.fn(({ snapshot }: { snapshot: RunStateSnapshot }) => {
        seen.push('BUILD_RESULT');
        return snapshot;
      }),
    };

    const executor = new (TickExecutor as any)({
      stepRunner,
      outcomeGate,
      eventFlushCoordinator,
      tickResultBuilder,
      errorBoundary: {
        capture: vi.fn(({ snapshot }: { snapshot: RunStateSnapshot }) => snapshot),
      },
      stepTracePublisher: {
        openTrace: vi.fn(),
        recordStep: vi.fn(),
        closeTrace: vi.fn(() => []),
      },
      runtimeCheckpointCoordinator: {
        capture: vi.fn(),
      },
      now: () => 33_333,
    });

    const result = (executor as any).execute({
      snapshot: base,
      bus,
    }) as RunStateSnapshot;

    expect(outcomeGate.resolve).toHaveBeenCalledTimes(1);
    expect(eventFlushCoordinator.flush).toHaveBeenCalledTimes(1);
    expect(tickResultBuilder.build).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          outcome: 'FREEDOM',
        }),
      }),
    );

    expect(seen.indexOf('OUTCOME_GATE')).toBeGreaterThan(-1);
    expect(seen.indexOf('STEP_13_FLUSH')).toBeGreaterThan(seen.indexOf('OUTCOME_GATE'));
    expect(seen.indexOf('BUILD_RESULT')).toBeGreaterThan(seen.indexOf('STEP_13_FLUSH'));
    expect(result.outcome).toBe('FREEDOM');
  });
});