// backend/src/game/engine/time/__tests__/TimeEngine.determinism.test.ts
import { describe, expect, it } from 'vitest';

import { DeterministicClock } from '../../core/ClockSource';
import { EngineTickTransaction } from '../../core/EngineTickTransaction';
import type {
  EngineSignal,
  TickContext,
} from '../../core/EngineContracts';
import { EventBus, type EventEnvelope } from '../../core/EventBus';
import type { EngineEventMap } from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { createInitialRunState } from '../../core/RunStateFactory';
import { TimeEngine } from '../TimeEngine';

type EngineBusEventMap = EngineEventMap & Record<string, unknown>;

type DeepPartial<T> =
  T extends readonly (infer U)[]
    ? readonly DeepPartial<U>[]
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

interface TickRunRecord {
  readonly snapshot: RunStateSnapshot;
  readonly signals: readonly {
    readonly engineId: string;
    readonly severity: string;
    readonly code: string;
    readonly message: string;
    readonly tick: number;
    readonly tags?: readonly string[];
  }[];
  readonly events: readonly {
    readonly sequence: number;
    readonly event: string;
    readonly payload: unknown;
    readonly emittedAtTick?: number;
    readonly tags?: readonly string[];
  }[];
}

const PRESSURE_BAND_BY_TIER: Readonly<
  Record<RunStateSnapshot['pressure']['tier'], RunStateSnapshot['pressure']['band']>
> = Object.freeze({
  T0: 'CALM',
  T1: 'BUILDING',
  T2: 'ELEVATED',
  T3: 'HIGH',
  T4: 'CRITICAL',
});

const PRESSURE_SCORE_BY_TIER: Readonly<
  Record<RunStateSnapshot['pressure']['tier'], number>
> = Object.freeze({
  T0: 0.1,
  T1: 0.25,
  T2: 0.5,
  T3: 0.75,
  T4: 0.95,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, overrides?: DeepPartial<T>): T {
  if (overrides === undefined) {
    return base;
  }

  if (Array.isArray(base)) {
    return overrides as T;
  }

  if (isPlainObject(base) && isPlainObject(overrides)) {
    const result: Record<string, unknown> = {
      ...(base as Record<string, unknown>),
    };

    for (const key of Object.keys(overrides)) {
      const overrideValue = overrides[key];

      if (overrideValue === undefined) {
        continue;
      }

      const baseValue = (base as Record<string, unknown>)[key];

      result[key] =
        isPlainObject(baseValue) && isPlainObject(overrideValue)
          ? deepMerge(baseValue, overrideValue as never)
          : overrideValue;
    }

    return result as T;
  }

  return overrides as T;
}

type ActiveDecisionWindows = RunStateSnapshot['timers']['activeDecisionWindows'];
type ActiveDecisionWindowValue = ActiveDecisionWindows[string];

function createDecisionWindowValue(
  deadlineMs: number,
  windowId = 'window_alpha',
): ActiveDecisionWindowValue {
  /**
   * Public GitHub currently shows the timer snapshot as Record<string, number>,
   * while your local compiler error shows RuntimeDecisionWindowSnapshot.
   * This helper keeps the test aligned to the local timer-value contract without
   * forcing the rest of the file to drift with every timer-surface change.
   */
  const candidate = {
    id: windowId,
    timingClass: 'FATE',
    closesAtTick: 1,
    closesAtMs: deadlineMs,
    consumed: false,
    frozen: false,
  };

  return candidate as unknown as ActiveDecisionWindowValue;
}

function createSnapshot(
  overrides: DeepPartial<RunStateSnapshot> = {},
): RunStateSnapshot {
  const base = createInitialRunState({
    runId: 'run_test_001',
    userId: 'user_test_001',
    seed: 'seed_alpha',
    mode: 'solo',
    initialCash: 1_000,
    initialDebt: 100,
    initialIncomePerTick: 200,
    initialExpensesPerTick: 75,
    initialHeat: 10,
    initialPressureScore: 0.25,
    freedomTarget: 100_000,
    seasonBudgetMs: 30_000,
    currentTickDurationMs: 13_000,
    holdCharges: 1,
    tags: [],
  });

  const seeded: RunStateSnapshot = {
    ...base,
    timers: {
      ...base.timers,
      activeDecisionWindows: {
        ...(base.timers.activeDecisionWindows as ActiveDecisionWindows),
        window_alpha: createDecisionWindowValue(1_500, 'window_alpha'),
      } as ActiveDecisionWindows,
      frozenWindowIds: [],
    },
  };

  return deepMerge(seeded, overrides);
}

function createContext(
  bus: EventBus<EngineBusEventMap>,
  snapshot: RunStateSnapshot,
  nowMs: number,
  step: TickContext['step'] = 'STEP_02_TIME',
): TickContext {
  const clock = new DeterministicClock(nowMs);

  return {
    step,
    nowMs,
    clock,
    bus,
    trace: {
      runId: snapshot.runId,
      tick: snapshot.tick,
      step,
      mode: snapshot.mode,
      phase: snapshot.phase,
      traceId: `trace_${snapshot.tick}_${nowMs}`,
    },
  };
}

function cloneSignals(signals: readonly EngineSignal[] | undefined) {
  return (signals ?? []).map((signal) => ({
    engineId: signal.engineId,
    severity: signal.severity,
    code: signal.code,
    message: signal.message,
    tick: signal.tick,
    tags: signal.tags === undefined ? undefined : [...signal.tags],
  }));
}

function cloneEvents(
  events: readonly EventEnvelope<
    keyof EngineBusEventMap,
    EngineBusEventMap[keyof EngineBusEventMap]
  >[],
): TickRunRecord['events'] {
  return events.map((event) => ({
    sequence: event.sequence,
    event: String(event.event),
    payload: event.payload,
    emittedAtTick: event.emittedAtTick,
    tags: event.tags === undefined ? undefined : [...event.tags],
  }));
}

function withPressure(
  snapshot: RunStateSnapshot,
  tier: RunStateSnapshot['pressure']['tier'],
): RunStateSnapshot {
  return {
    ...snapshot,
    pressure: {
      ...snapshot.pressure,
      previousTier: snapshot.pressure.tier,
      previousBand: snapshot.pressure.band,
      tier,
      band: PRESSURE_BAND_BY_TIER[tier],
      score: PRESSURE_SCORE_BY_TIER[tier],
      maxScoreSeen: Math.max(snapshot.pressure.maxScoreSeen, PRESSURE_SCORE_BY_TIER[tier]),
    },
  };
}

function runScenario(engine: TimeEngine): readonly TickRunRecord[] {
  const bus = new EventBus<EngineBusEventMap>();
  const records: TickRunRecord[] = [];
  const inputs = [
    { nowMs: 1_000, tier: 'T1' as const },
    { nowMs: 14_000, tier: 'T3' as const },
    { nowMs: 24_750, tier: 'T3' as const },
    { nowMs: 33_250, tier: 'T4' as const },
  ];

  let snapshot = createSnapshot();

  for (const input of inputs) {
    snapshot = withPressure(snapshot, input.tier);

    const result = EngineTickTransaction.execute(
      engine,
      snapshot,
      createContext(bus, snapshot, input.nowMs),
    );

    const flushed = bus.flush();

    records.push({
      snapshot: result.snapshot,
      signals: cloneSignals(result.signals),
      events: cloneEvents(flushed),
    });

    snapshot = result.snapshot;
  }

  return records;
}

describe('backend time/TimeEngine.determinism', () => {
  it('produces byte-stable outputs across two isolated runs with identical inputs', () => {
    const runA = runScenario(new TimeEngine());
    const runB = runScenario(new TimeEngine());

    expect(runA).toEqual(runB);
  });

  it('replays identically after reset on the same engine instance', () => {
    const engine = new TimeEngine();

    const first = runScenario(engine);
    engine.reset();
    const second = runScenario(engine);

    expect(second).toEqual(first);
  });

  it('keeps interpolation, expiry, and terminal truth deterministic inside the scenario', () => {
    const [tickOne, tickTwo, tickThree, tickFour] = runScenario(new TimeEngine());

    expect(tickOne.snapshot.timers.currentTickDurationMs).toBe(13_000);
    expect(tickTwo.snapshot.timers.currentTickDurationMs).toBe(10_750);
    expect(tickThree.snapshot.timers.currentTickDurationMs).toBe(8_500);
    expect(tickFour.snapshot.timers.currentTickDurationMs).toBe(6_750);

    expect(tickOne.events.map((event) => event.event)).toEqual([
      'decision.window.opened',
    ]);
    expect(tickTwo.events.map((event) => event.event)).toEqual([
      'decision.window.closed',
    ]);

    expect(tickTwo.snapshot.tags).toContain('decision_window:expired');
    expect(tickFour.snapshot.outcome).toBe('TIMEOUT');
    expect(tickFour.snapshot.tags).toContain('run:timeout');
    expect(tickFour.snapshot.telemetry.outcomeReasonCode).toBe(
      'SEASON_BUDGET_EXHAUSTED',
    );
  });
});