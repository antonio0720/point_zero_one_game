// backend/src/game/engine/core/__tests__/EngineTickTransaction.spec.ts

import { describe, expect, it, vi } from 'vitest';

import type { EngineId, EngineTickResult, SimulationEngine, TickContext } from '../EngineContracts';
import type { RunStateSnapshot } from '../RunStateSnapshot';
import type { TickStep } from '../TickSequence';

import { DeterministicClock } from '../ClockSource';
import {
  createEngineHealth,
  createEngineSignal,
} from '../EngineContracts';
import { EngineTickTransaction } from '../EngineTickTransaction';
import { EventBus } from '../EventBus';
import { createInitialRunState } from '../RunStateFactory';

function baseSnapshot(): RunStateSnapshot {
  return createInitialRunState({
    runId: 'run_engine_tick_transaction_spec',
    userId: 'user_engine_tick_transaction_spec',
    seed: 'seed_engine_tick_transaction_spec',
    mode: 'solo',
    currentTickDurationMs: 4_000,
    seasonBudgetMs: 60_000,
  });
}

function baseContext(
  step: TickStep = 'STEP_03_PRESSURE',
  overrides: Partial<TickContext> & {
    readonly traceTick?: number;
  } = {},
): TickContext {
  const clock = overrides.clock ?? new DeterministicClock(4_000);
  const bus = overrides.bus ?? new EventBus<Record<string, unknown>>();
  const nowMs = overrides.nowMs ?? 4_000;
  const traceTick = overrides.traceTick ?? 0;

  return {
    step,
    nowMs,
    clock,
    bus,
    trace: {
      runId: 'run_engine_tick_transaction_spec',
      tick: traceTick,
      step,
      mode: 'solo',
      phase: 'FOUNDATION',
      traceId: 'trace_engine_tick_transaction_spec',
    },
  };
}

function createMockEngine(
  engineId: EngineId,
  options: {
    readonly canRun?: (snapshot: RunStateSnapshot, context: TickContext) => boolean;
    readonly tick?: (snapshot: RunStateSnapshot, context: TickContext) => RunStateSnapshot | EngineTickResult;
  } = {},
): {
  readonly engine: SimulationEngine;
  readonly canRunSpy: ReturnType<typeof vi.fn>;
  readonly tickSpy: ReturnType<typeof vi.fn>;
} {
  const canRunSpy = vi.fn(
    options.canRun ??
      (() => true),
  );

  const tickSpy = vi.fn(
    options.tick ??
      ((snapshot: RunStateSnapshot) => snapshot),
  );

  const engine: SimulationEngine = {
    engineId,
    reset: vi.fn(),
    canRun: canRunSpy,
    tick: tickSpy,
    getHealth: () => createEngineHealth(engineId, 'HEALTHY', 1_700_000_000_000, []),
  };

  return {
    engine,
    canRunSpy,
    tickSpy,
  };
}

describe('EngineTickTransaction', () => {
  it('constructor normalizes negative tick values and truncates startedAtMs', () => {
    const snapshot = baseSnapshot();

    const transaction = new EngineTickTransaction(
      {
        engineId: 'pressure',
        tick: -9,
        step: 'STEP_03_PRESSURE',
        startedAtMs: 1_234.99,
        traceId: 'trace_ctor_001',
      },
      snapshot,
    );

    expect(transaction.getState()).toEqual({
      meta: {
        engineId: 'pressure',
        tick: 0,
        step: 'STEP_03_PRESSURE',
        startedAtMs: 1_234,
        traceId: 'trace_ctor_001',
      },
      inputSnapshot: snapshot,
      outputSnapshot: snapshot,
      signals: [],
      committed: false,
      rolledBack: false,
    });
  });

  it('fromContext() uses the larger of snapshot.tick + 1 and context.trace.tick', () => {
    const snapshot = baseSnapshot();

    const transaction = EngineTickTransaction.fromContext(
      'battle',
      snapshot,
      baseContext('STEP_05_BATTLE', {
        nowMs: 9_999,
        traceTick: 7,
      }),
    );

    expect(transaction.getState().meta).toEqual({
      engineId: 'battle',
      tick: 7,
      step: 'STEP_05_BATTLE',
      startedAtMs: 9_999,
      traceId: 'trace_engine_tick_transaction_spec',
    });
  });

  it('applyResult(snapshot).commit() normalizes raw snapshots into ENGINE_TICK_OK signals', () => {
    const input = baseSnapshot();
    const output = baseSnapshot();

    const transaction = new EngineTickTransaction(
      {
        engineId: 'time',
        tick: 1,
        step: 'STEP_02_TIME',
        startedAtMs: 5_000,
      },
      input,
    );

    const result = transaction.applyResult(output).commit();

    expect(result.snapshot).toBe(output);
    expect(result.signals).toEqual([
      createEngineSignal(
        'time',
        'INFO',
        'ENGINE_TICK_OK',
        'time tick completed',
        1,
      ),
    ]);
  });

  it('applyResult(EngineTickResult) preserves explicit signal payloads instead of replacing them', () => {
    const input = baseSnapshot();
    const output = baseSnapshot();

    const transaction = new EngineTickTransaction(
      {
        engineId: 'tension',
        tick: 3,
        step: 'STEP_04_TENSION',
        startedAtMs: 7_500,
      },
      input,
    );

    const explicitSignal = createEngineSignal(
      'tension',
      'WARN',
      'QUEUE_SPIKE',
      'tension queue expanded unexpectedly',
      3,
      ['tension', 'warn'],
    );

    const result = transaction
      .applyResult({
        snapshot: output,
        signals: [explicitSignal],
      })
      .commit();

    expect(result.snapshot).toBe(output);
    expect(result.signals).toEqual([explicitSignal]);
  });

  it('skip() finalizes the transaction and returns the input snapshot with ENGINE_SKIPPED metadata', () => {
    const input = baseSnapshot();

    const transaction = new EngineTickTransaction(
      {
        engineId: 'shield',
        tick: 4,
        step: 'STEP_06_SHIELD',
        startedAtMs: 8_000,
      },
      input,
    );

    const result = transaction.skip();

    expect(result).toEqual({
      snapshot: input,
      signals: [
        createEngineSignal(
          'shield',
          'INFO',
          'ENGINE_SKIPPED',
          'shield skipped STEP_06_SHIELD.',
          4,
          ['engine-transaction', 'skipped', 'step:step_06_shield'],
        ),
      ],
    });

    expect(transaction.getState().committed).toBe(true);
    expect(transaction.getState().rolledBack).toBe(false);
  });

  it('rollback() preserves buffered signals and appends a deterministic rollback error signal', () => {
    const input = baseSnapshot();

    const transaction = new EngineTickTransaction(
      {
        engineId: 'cascade',
        tick: 5,
        step: 'STEP_07_CASCADE',
        startedAtMs: 10_000,
      },
      input,
    );

    const preRollbackWarn = createEngineSignal(
      'cascade',
      'WARN',
      'CHAIN_DELAYED',
      'chain resolution lagged one frame',
      5,
      ['cascade'],
    );

    const result = transaction
      .appendSignals([preRollbackWarn])
      .rollback({
        error: new Error('cascade queue corruption'),
        tags: ['engine:cascade'],
      });

    expect(result.snapshot).toBe(input);
    expect(result.signals).toEqual([
      preRollbackWarn,
      createEngineSignal(
        'cascade',
        'ERROR',
        'ENGINE_TRANSACTION_ROLLBACK',
        '[cascade] STEP_07_CASCADE failed: cascade queue corruption',
        5,
        ['engine-transaction', 'rollback', 'engine:cascade'],
      ),
    ]);

    expect(transaction.getState().committed).toBe(true);
    expect(transaction.getState().rolledBack).toBe(true);
  });

  it('static execute() returns skip() when canRun() explicitly gates the engine off', () => {
    const snapshot = baseSnapshot();
    const context = baseContext('STEP_04_TENSION', {
      traceTick: 1,
    });

    const tension = createMockEngine('tension', {
      canRun: () => false,
      tick: () => {
        throw new Error('tick() must not be called for skipped engines');
      },
    });

    const result = EngineTickTransaction.execute(
      tension.engine,
      snapshot,
      context,
    );

    expect(tension.canRunSpy).toHaveBeenCalledTimes(1);
    expect(tension.tickSpy).not.toHaveBeenCalled();
    expect(result.snapshot).toBe(snapshot);
    expect(result.signals).toEqual([
      createEngineSignal(
        'tension',
        'INFO',
        'ENGINE_SKIPPED',
        'tension skipped STEP_04_TENSION.',
        1,
        ['engine-transaction', 'skipped', 'step:step_04_tension'],
      ),
    ]);
  });

  it('static execute() rolls back to the input snapshot when engine.tick() throws', () => {
    const snapshot = baseSnapshot();
    const context = baseContext('STEP_05_BATTLE', {
      traceTick: 6,
    });

    const battle = createMockEngine('battle', {
      tick: () => {
        throw new Error('battle runtime panic');
      },
    });

    const result = EngineTickTransaction.execute(
      battle.engine,
      snapshot,
      context,
    );

    expect(battle.canRunSpy).toHaveBeenCalledTimes(1);
    expect(battle.tickSpy).toHaveBeenCalledTimes(1);
    expect(result.snapshot).toBe(snapshot);
    expect(result.signals).toEqual([
      createEngineSignal(
        'battle',
        'ERROR',
        'ENGINE_TRANSACTION_ROLLBACK',
        '[battle] STEP_05_BATTLE failed: battle runtime panic',
        6,
        ['engine-transaction', 'rollback', 'engine:battle'],
      ),
    ]);
  });

  it('static execute() commits transformed snapshots produced by the engine', () => {
    const snapshot = baseSnapshot();
    const context = baseContext('STEP_03_PRESSURE', {
      traceTick: 2,
    });

    const pressure = createMockEngine('pressure', {
      tick: (inputSnapshot) => {
        const next = JSON.parse(JSON.stringify(inputSnapshot)) as RunStateSnapshot & {
          pressure: RunStateSnapshot['pressure'];
          economy: RunStateSnapshot['economy'];
        };

        (next.pressure as any).score = 0.92;
        (next.pressure as any).tier = 'T4';
        (next.pressure as any).band = 'CRITICAL';

        return {
          snapshot: next,
          signals: [
            createEngineSignal(
              'pressure',
              'WARN',
              'PRESSURE_CRITICAL',
              'pressure crossed critical threshold',
              2,
              ['pressure', 'critical'],
            ),
          ],
        };
      },
    });

    const result = EngineTickTransaction.execute(
      pressure.engine,
      snapshot,
      context,
    );

    expect(result.snapshot.pressure.score).toBe(0.92);
    expect(result.snapshot.pressure.tier).toBe('T4');
    expect(result.signals).toEqual([
      createEngineSignal(
        'pressure',
        'WARN',
        'PRESSURE_CRITICAL',
        'pressure crossed critical threshold',
        2,
        ['pressure', 'critical'],
      ),
    ]);
  });

  it('rejects mutation attempts after the transaction has already been finalized', () => {
    const snapshot = baseSnapshot();

    const transaction = new EngineTickTransaction(
      {
        engineId: 'sovereignty',
        tick: 11,
        step: 'STEP_10_SOVEREIGNTY_SNAPSHOT',
        startedAtMs: 15_000,
      },
      snapshot,
    );

    transaction.commit();

    expect(() => transaction.replaceSnapshot(snapshot)).toThrowError(
      'EngineTickTransaction for sovereignty at STEP_10_SOVEREIGNTY_SNAPSHOT is already finalized.',
    );
    expect(() =>
      transaction.appendSignals([
        createEngineSignal(
          'sovereignty',
          'INFO',
          'NOOP',
          'no-op after commit',
          11,
        ),
      ]),
    ).toThrowError(
      'EngineTickTransaction for sovereignty at STEP_10_SOVEREIGNTY_SNAPSHOT is already finalized.',
    );
  });
});