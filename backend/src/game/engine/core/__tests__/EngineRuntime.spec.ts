// backend/src/game/engine/core/__tests__/EngineRuntime.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CardDefinition, EngineEventMap } from '../GamePrimitives';
import type { RunStateSnapshot } from '../RunStateSnapshot';
import type { RunFactoryInput } from '../RunStateFactory';
import type { EngineId, EngineTickResult, SimulationEngine, TickContext } from '../EngineContracts';

import { DeterministicClock } from '../ClockSource';
import { createEngineHealth, createEngineSignal } from '../EngineContracts';
import { EngineRegistry } from '../EngineRegistry';
import { EngineRuntime } from '../EngineRuntime';
import { EventBus } from '../EventBus';

type Mutable<T> = {
  -readonly [K in keyof T]: Mutable<T[K]>;
};

function cloneSnapshot(snapshot: RunStateSnapshot): Mutable<RunStateSnapshot> {
  return JSON.parse(JSON.stringify(snapshot)) as Mutable<RunStateSnapshot>;
}

function baseRunInput(overrides: Partial<RunFactoryInput> = {}): RunFactoryInput {
  return {
    runId: 'run_engine_runtime_spec',
    userId: 'user_engine_runtime_spec',
    seed: 'seed_engine_runtime_spec',
    mode: 'solo',
    currentTickDurationMs: 5_000,
    seasonBudgetMs: 60_000,
    ...overrides,
  };
}

function createLegalSoloCard(overrides: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id: 'card_solo_income_boost',
    name: 'Solo Income Boost',
    deckType: 'OPPORTUNITY',
    baseCost: 0,
    baseEffect: {
      cashDelta: 125,
      incomeDelta: 10,
    },
    tags: ['economy', 'income'],
    timingClass: ['ANY'],
    rarity: 'COMMON',
    autoResolve: false,
    counterability: 'NONE',
    targeting: 'SELF',
    decisionTimerOverrideMs: null,
    decayTicks: null,
    modeLegal: ['solo'],
    educationalTag: 'cashflow-fundamentals',
    ...overrides,
  };
}

function createMockEngine(
  engineId: EngineId,
  options: {
    readonly canRun?: (snapshot: RunStateSnapshot, context: TickContext) => boolean;
    readonly tick?: (snapshot: RunStateSnapshot, context: TickContext) => RunStateSnapshot | EngineTickResult;
    readonly status?: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  } = {},
): {
  readonly engine: SimulationEngine;
  readonly resetSpy: ReturnType<typeof vi.fn>;
  readonly canRunSpy: ReturnType<typeof vi.fn>;
  readonly tickSpy: ReturnType<typeof vi.fn>;
  readonly getHealthSpy: ReturnType<typeof vi.fn>;
} {
  const resetSpy = vi.fn();
  const canRunSpy = vi.fn(
    options.canRun ??
      (() => true),
  );
  const tickSpy = vi.fn(
    options.tick ??
      ((snapshot: RunStateSnapshot) => snapshot),
  );
  const getHealthSpy = vi.fn(() =>
    createEngineHealth(engineId, options.status ?? 'HEALTHY', 1_700_000_000_000, []),
  );

  const engine: SimulationEngine = {
    engineId,
    reset: resetSpy,
    canRun: canRunSpy,
    tick: tickSpy,
    getHealth: getHealthSpy,
  };

  return {
    engine,
    resetSpy,
    canRunSpy,
    tickSpy,
    getHealthSpy,
  };
}

describe('EngineRuntime', () => {
  let registry: EngineRegistry;
  let bus: EventBus<EngineEventMap & Record<string, unknown>>;
  let clock: DeterministicClock;
  let runtime: EngineRuntime;

  beforeEach(() => {
    registry = new EngineRegistry();
    bus = new EventBus<EngineEventMap & Record<string, unknown>>();
    clock = new DeterministicClock(0);
    runtime = new EngineRuntime({
      registry,
      bus,
      clock,
    });
  });

  it('throws when current() is called before startRun()', () => {
    expect(() => runtime.current()).toThrowError(
      'EngineRuntime has no active run. Call startRun() first.',
    );
  });

  it('startRun() resets the registry, clears stale bus state, resets the clock, and queues run.started', () => {
    const time = createMockEngine('time');

    runtime.registerEngine(time.engine);

    const resetSpy = vi.spyOn(registry, 'reset');
    const clearSpy = vi.spyOn(bus, 'clear');
    const setSpy = vi.spyOn(clock, 'set');

    bus.emit('tick.started', {
      runId: 'stale',
      tick: 999,
      phase: 'FOUNDATION',
    });

    expect(bus.queuedCount()).toBe(1);

    const snapshot = runtime.startRun(
      baseRunInput({
        runId: 'run_start_001',
        userId: 'user_start_001',
        seed: 'seed_start_001',
      }),
    );

    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(0);
    expect(time.resetSpy).toHaveBeenCalledTimes(1);

    expect(snapshot.runId).toBe('run_start_001');
    expect(snapshot.userId).toBe('user_start_001');
    expect(snapshot.seed).toBe('seed_start_001');
    expect(snapshot.tick).toBe(0);
    expect(clock.now()).toBe(0);

    const events = runtime.flushEvents();
    expect(events).toEqual([
      {
        event: 'run.started',
        payload: {
          runId: 'run_start_001',
          mode: 'solo',
          seed: 'seed_start_001',
        },
      },
    ]);

    expect(runtime.flushEvents()).toEqual([]);
  });

  it('drawCardToHand() accepts a mode-legal card and appends it to hand + draw history', () => {
    runtime.startRun(
      baseRunInput({
        runId: 'run_draw_accept_001',
      }),
    );
    runtime.flushEvents();

    const result = runtime.drawCardToHand(createLegalSoloCard());

    expect(result.accepted).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.instance).not.toBeNull();
    expect(result.instance?.definitionId).toBe('card_solo_income_boost');
    expect(result.snapshot.cards.hand).toHaveLength(1);
    expect(result.snapshot.cards.hand[0]?.definitionId).toBe('card_solo_income_boost');
    expect(result.snapshot.cards.drawHistory).toHaveLength(1);
    expect(result.snapshot.cards.drawHistory[0]).toBe(result.instance?.instanceId);
  });

  it('drawCardToHand() rejects a card that is not legal for the active mode', () => {
    runtime.startRun(
      baseRunInput({
        runId: 'run_draw_reject_001',
        mode: 'solo',
      }),
    );
    runtime.flushEvents();

    const result = runtime.drawCardToHand(
      createLegalSoloCard({
        id: 'card_pvp_only_counter',
        name: 'PvP Counter Window',
        modeLegal: ['pvp'],
        timingClass: ['CTR'],
      }),
    );

    expect(result.accepted).toBe(false);
    expect(result.instance).toBeNull();
    expect(result.snapshot.cards.hand).toHaveLength(0);
    expect(result.reasons).toEqual([
      'Card card_pvp_only_counter is not currently legal for draw in mode solo.',
    ]);
  });

  it('playCard() rejects missing hand instances without mutating authoritative state', () => {
    runtime.startRun(
      baseRunInput({
        runId: 'run_play_missing_001',
      }),
    );
    runtime.flushEvents();

    const before = runtime.current();

    const result = runtime.playCard({
      actorId: 'user_engine_runtime_spec',
      cardInstanceId: 'missing_card_instance',
    });

    expect(result.accepted).toBe(false);
    expect(result.playedCard).toBeNull();
    expect(result.chosenTimingClass).toBeNull();
    expect(result.reasons).toEqual([
      'Card instance missing_card_instance not found in hand.',
    ]);
    expect(result.snapshot).toBe(before);
    expect(runtime.current()).toBe(before);
  });

  it('tick() forces authoritative time advancement even when the time engine forgets to advance the clock', () => {
    const time = createMockEngine('time', {
      tick: (snapshot) => snapshot,
    });

    runtime.registerEngine(time.engine);

    runtime.startRun(
      baseRunInput({
        runId: 'run_force_time_001',
        currentTickDurationMs: 5_000,
      }),
    );
    runtime.flushEvents();

    const result = runtime.tick();

    expect(time.tickSpy).toHaveBeenCalledTimes(1);
    expect(result.snapshot.tick).toBe(1);
    expect(result.snapshot.timers.elapsedMs).toBe(5_000);
    expect(result.snapshot.timers.currentTickDurationMs).toBe(5_000);
    expect(result.snapshot.timers.nextTickAtMs).toBe(10_000);
    expect(clock.now()).toBe(5_000);

    expect(result.checksum).toBe(result.snapshot.telemetry.lastTickChecksum);
    expect(result.snapshot.telemetry.emittedEventCount).toBe(1);
    expect(result.events).toEqual([
      {
        event: 'tick.completed',
        payload: {
          runId: 'run_force_time_001',
          tick: 1,
          phase: result.snapshot.phase,
          checksum: result.checksum,
        },
      },
    ]);
  });

  it('tick() merges WARN / ERROR engine signals into telemetry warnings', () => {
    const time = createMockEngine('time', {
      tick: (snapshot) => snapshot,
    });

    const pressure = createMockEngine('pressure', {
      tick: (snapshot) => ({
        snapshot,
        signals: [
          createEngineSignal(
            'pressure',
            'WARN',
            'PRESSURE_SPIKE',
            'pressure surged during recompute',
            snapshot.tick,
            ['pressure', 'warning'],
          ),
        ],
      }),
    });

    runtime.registerEngine(time.engine);
    runtime.registerEngine(pressure.engine);

    runtime.startRun(
      baseRunInput({
        runId: 'run_warn_merge_001',
      }),
    );
    runtime.flushEvents();

    const result = runtime.tick();

    expect(pressure.tickSpy).toHaveBeenCalledTimes(1);
    expect(result.snapshot.telemetry.warnings).toContain(
      '[pressure] PRESSURE_SPIKE: pressure surged during recompute',
    );
  });

  it('tickMany() stops after the first terminal tick and emits sovereignty.completed', () => {
    const time = createMockEngine('time', {
      tick: (snapshot) => snapshot,
    });

    const pressure = createMockEngine('pressure', {
      tick: (snapshot) => {
        const next = cloneSnapshot(snapshot);
        next.economy.netWorth = snapshot.economy.freedomTarget;
        next.economy.cash = Math.max(next.economy.cash, 1);
        return next as RunStateSnapshot;
      },
    });

    runtime.registerEngine(time.engine);
    runtime.registerEngine(pressure.engine);

    runtime.startRun(
      baseRunInput({
        runId: 'run_terminal_freedom_001',
      }),
    );
    runtime.flushEvents();

    const results = runtime.tickMany(5);

    expect(results).toHaveLength(1);
    expect(results[0]?.snapshot.outcome).toBe('FREEDOM');
    expect(results[0]?.snapshot.sovereignty.proofHash).not.toBeNull();
    expect(results[0]?.snapshot.sovereignty.verifiedGrade).not.toBeNull();

    expect(results[0]?.events).toEqual([
      {
        event: 'tick.completed',
        payload: {
          runId: 'run_terminal_freedom_001',
          tick: 1,
          phase: results[0]!.snapshot.phase,
          checksum: results[0]!.checksum,
        },
      },
      {
        event: 'sovereignty.completed',
        payload: {
          runId: 'run_terminal_freedom_001',
          score: results[0]!.snapshot.sovereignty.sovereigntyScore,
          grade: results[0]!.snapshot.sovereignty.verifiedGrade!,
          proofHash: results[0]!.snapshot.sovereignty.proofHash!,
          outcome: 'FREEDOM',
        },
      },
    ]);
  });

  it('tick() returns the sealed terminal snapshot unchanged once the run has already ended', () => {
    const time = createMockEngine('time', {
      tick: (snapshot) => snapshot,
    });

    const pressure = createMockEngine('pressure', {
      tick: (snapshot) => {
        const next = cloneSnapshot(snapshot);
        next.economy.netWorth = snapshot.economy.freedomTarget;
        return next as RunStateSnapshot;
      },
    });

    runtime.registerEngine(time.engine);
    runtime.registerEngine(pressure.engine);

    runtime.startRun(
      baseRunInput({
        runId: 'run_terminal_repeat_001',
      }),
    );
    runtime.flushEvents();

    const first = runtime.tick();
    const second = runtime.tick();

    expect(first.snapshot.outcome).toBe('FREEDOM');
    expect(second.snapshot).toBe(first.snapshot);
    expect(second.checksum).toBe(first.checksum);
    expect(second.events).toEqual([]);
  });

  it('tickUntilTerminal() throws when the limit is exhausted without reaching a terminal outcome', () => {
    const time = createMockEngine('time', {
      tick: (snapshot) => snapshot,
    });

    runtime.registerEngine(time.engine);

    runtime.startRun(
      baseRunInput({
        runId: 'run_limit_throw_001',
        freedomTarget: 999_999_999,
        seasonBudgetMs: 60_000,
        currentTickDurationMs: 5_000,
      }),
    );
    runtime.flushEvents();

    expect(() => runtime.tickUntilTerminal(2)).toThrowError(
      'tickUntilTerminal exceeded limit 2 without terminal outcome.',
    );
  });
});