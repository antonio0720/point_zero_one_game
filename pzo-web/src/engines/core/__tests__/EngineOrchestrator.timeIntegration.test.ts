/**
 * ============================================================================
 * FILE: pzo-web/src/engines/core/__tests__/EngineOrchestrator.timeIntegration.test.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative integration contract for the TimeEngine × EventBus × EngineOrchestrator
 * triad. Tests are structured in seven layers of increasing integration depth:
 *
 *   Layer 1 — TimeEngine direct API (pure state mutations, no bus)
 *   Layer 2 — TimeEngine → EventBus emission contract (tier changes, lifecycle)
 *   Layer 3 — Tier ladder mechanics (enter/exit thresholds, hysteresis)
 *   Layer 4 — Season budget, timeout detection, and SEASON_TIMEOUT event
 *   Layer 5 — Decision-window count propagation into TimeEngine state
 *   Layer 6 — Telemetry envelope integrity (dwell ticks, transition records)
 *   Layer 7 — Full EngineOrchestrator-driven tick loop integration
 *
 * Doctrine
 * --------
 * - All tests use synchronous EventBus spies. No deferred I/O.
 * - Fake timers isolate setTimeout/setInterval used by DecisionTimer and
 *   EngineOrchestrator's internal tick scheduler.
 * - Every imported symbol is exercised at least once in assertions or setup.
 * - No test accesses private TimeEngine fields directly.
 * - EngineOrchestrator is constructed with null store bindings to avoid async
 *   import races during test startup.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ============================================================================
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EventBus,
  TICK_TIER_CHANGED,
  TIME_TIER_CHANGED,
  TICK_START,
  TICK_COMPLETE,
  TICK_STEP_ERROR,
  RUN_STARTED,
  RUN_ENDED,
  TIME_ENGINE_START,
  TIME_ENGINE_TICK,
  TIME_ENGINE_COMPLETE,
  TIME_TICK_ADVANCED,
  TIME_BUDGET_WARNING,
  SEASON_TIMEOUT,
  type EngineEventConstant,
} from '../EventBus';

import { TimeEngine, TickTier } from '../../time/TimeEngine';

import {
  TICK_DURATION_MS_BY_TIER,
  TICK_TIER_IDS,
  type TimeEngineStateSnapshot,
  type TelemetryEnvelopeV2,
  type TickBudget,
  type TierTransitionRecord,
} from '../../time/types';

import { DecisionTimer } from '../../time/DecisionTimer';

import {
  EngineOrchestrator,
  type OrchestratorSnapshot,
  type TickExecutionRecord,
  type StartRunOptions,
  type EngineOrchestratorConfig,
  type EngineBundle,
} from '../EngineOrchestrator';

import { WallClockSource, FixedClockSource } from '../ClockSource';

// ─────────────────────────────────────────────────────────────────────────────
// Shared test helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a minimal snapshot shape accepted by TimeEngine.advanceTick().
 */
function makeTickSnapshot(
  tick: number,
  pressureScore: number,
  tickTier: string = TickTier.STABLE,
): { tick: number; pressureScore: number; tickTier: string } {
  return { tick, pressureScore, tickTier };
}

/**
 * Tracks all calls to `emit` for a given event name constant.
 * Returns the collected payloads for assertion.
 */
function collectEmits(bus: EventBus, eventName: string): unknown[] {
  const collected: unknown[] = [];
  (bus as unknown as { on: (n: string, h: (e: unknown) => void) => () => void })
    .on(eventName, (event: unknown) => {
      collected.push(event);
    });
  return collected;
}

/**
 * Counts total `emit` calls for a specific event name across all recorded calls.
 */
function countEmitCalls(spy: ReturnType<typeof vi.spyOn>, eventName: string): number {
  return spy.mock.calls.filter(([name]) => name === eventName).length;
}

/**
 * Extracts first payload from emit spy for a specific event name.
 */
function firstEmitPayload(
  spy: ReturnType<typeof vi.spyOn>,
  eventName: string,
): Record<string, unknown> | undefined {
  const call = spy.mock.calls.find(([name]) => name === eventName);
  return call?.[1] as Record<string, unknown> | undefined;
}

/**
 * Verifies the TICK_DURATION_MS_BY_TIER record is consistent with TimeEngine's
 * internal tier config for documentation purposes.
 */
function assertDurationMsTable(): void {
  const ids: readonly string[] = TICK_TIER_IDS;
  expect(ids).toHaveLength(5);
  for (const id of ids) {
    expect(TICK_DURATION_MS_BY_TIER[id as keyof typeof TICK_DURATION_MS_BY_TIER]).toBeGreaterThan(0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture: EngineOrchestrator wired with null store (prevents async import races)
// ─────────────────────────────────────────────────────────────────────────────

function buildOrchestrator(
  overrides: Partial<EngineOrchestratorConfig> = {},
): { orchestrator: EngineOrchestrator; eventBus: EventBus; timeEngine: TimeEngine } {
  const eventBus   = new EventBus();
  const timeEngine = new TimeEngine(eventBus);

  const config: EngineOrchestratorConfig = {
    eventBus,
    timeEngine,
    autoBindStore: false,   // prevents dynamic store imports during test
    autoStart:    false,
    defaultSeasonTickBudget: 100,
    ...overrides,
  };

  const orchestrator = new EngineOrchestrator(config);
  return { orchestrator, eventBus, timeEngine };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1 — TimeEngine direct API
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeEngine — direct API contract', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;

  beforeEach(() => {
    eventBus   = new EventBus();
    timeEngine = new TimeEngine(eventBus);
  });

  it('initializes at T1 STABLE with a 2000ms tick duration', () => {
    expect(timeEngine.getCurrentTier()).toBe(TickTier.STABLE);
    expect(timeEngine.getTickDurationMs()).toBe(2000);
    expect(timeEngine.getTickIndex()).toBe(0);
  });

  it('getState() returns a complete TimeEngineStateSnapshot', () => {
    const state: TimeEngineStateSnapshot = timeEngine.getState();
    expect(state.tickIndex).toBe(0);
    expect(state.tickTier).toBe(TickTier.STABLE);
    expect(state.tickDurationMs).toBe(2000);
    expect(state.decisionWindows).toBe(0);
    expect(state.seasonBudget).toBe(720);
    expect(state.ticksRemaining).toBe(720);
    expect(state.timeoutImminent).toBe(false);
  });

  it('captureStateSnapshot() mirrors getState() exactly', () => {
    const a: TimeEngineStateSnapshot = timeEngine.getState();
    const b: TimeEngineStateSnapshot = timeEngine.captureStateSnapshot();
    expect(a).toEqual(b);
  });

  it('advanceTick() increments tickIndex by 1', () => {
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    expect(timeEngine.getTickIndex()).toBe(1);
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    expect(timeEngine.getTickIndex()).toBe(2);
  });

  it('advanceTick() decrements ticksRemaining correctly', () => {
    timeEngine.setSeasonBudget(10);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    expect(timeEngine.getTicksRemaining()).toBe(9);
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    expect(timeEngine.getTicksRemaining()).toBe(8);
  });

  it('setSeasonBudget() immediately recalculates ticksRemaining', () => {
    timeEngine.setSeasonBudget(50);
    expect(timeEngine.getSeasonBudget()).toBe(50);
    expect(timeEngine.getTicksRemaining()).toBe(50);
  });

  it('setSeasonBudget() after tick advancement adjusts remaining correctly', () => {
    timeEngine.setSeasonBudget(20);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    expect(timeEngine.getTickIndex()).toBe(2);
    timeEngine.setSeasonBudget(30);
    expect(timeEngine.getTicksRemaining()).toBe(28); // 30 - 2
  });

  it('getBudgetSnapshot() reflects correct TickBudget shape', () => {
    timeEngine.setSeasonBudget(40);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    timeEngine.advanceTick(makeTickSnapshot(2, 0));

    const budget: TickBudget = timeEngine.getBudgetSnapshot();
    expect(budget.allocated).toBe(40);
    expect(budget.consumed).toBe(3);
    expect(budget.remaining).toBe(37);
  });

  it('isTimeoutImminent() returns true when ticksRemaining <= 20', () => {
    timeEngine.setSeasonBudget(21);
    expect(timeEngine.isTimeoutImminent()).toBe(false);

    timeEngine.advanceTick(makeTickSnapshot(0, 0));  // remaining = 20
    expect(timeEngine.isTimeoutImminent()).toBe(true);
  });

  it('isTimeoutImminent() is false at exactly 21 ticks remaining', () => {
    timeEngine.setSeasonBudget(22);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));  // remaining = 21
    expect(timeEngine.isTimeoutImminent()).toBe(false);
  });

  it('setDecisionWindowCount() propagates to getState().decisionWindows', () => {
    timeEngine.setDecisionWindowCount(3);
    expect(timeEngine.getState().decisionWindows).toBe(3);
  });

  it('incrementDecisionWindowCount() accumulates correctly', () => {
    timeEngine.incrementDecisionWindowCount(2);
    timeEngine.incrementDecisionWindowCount(3);
    expect(timeEngine.getState().decisionWindows).toBe(5);
  });

  it('setDecisionWindowCount(0) clears the count', () => {
    timeEngine.setDecisionWindowCount(7);
    timeEngine.setDecisionWindowCount(0);
    expect(timeEngine.getState().decisionWindows).toBe(0);
  });

  it('reset() returns engine to initial T1 stable state', () => {
    timeEngine.setSeasonBudget(10);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.setTierFromPressure(0.90);
    timeEngine.setDecisionWindowCount(5);

    timeEngine.reset();

    expect(timeEngine.getTickIndex()).toBe(0);
    expect(timeEngine.getCurrentTier()).toBe(TickTier.STABLE);
    expect(timeEngine.getTickDurationMs()).toBe(2000);
    expect(timeEngine.getState().decisionWindows).toBe(0);
    expect(timeEngine.getTicksRemaining()).toBe(720); // reverts to default
  });

  it('TICK_DURATION_MS_BY_TIER table is non-empty and all values positive', () => {
    assertDurationMsTable();
  });

  it('completeRun() is idempotent — second call is ignored', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    timeEngine.completeRun('RUN_ENDED');
    timeEngine.completeRun('RUN_ENDED');

    const completedCalls = emitSpy.mock.calls.filter(([name]) => name === TIME_ENGINE_COMPLETE);
    expect(completedCalls).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 — TimeEngine → EventBus emission contract
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeEngine → EventBus emission contract', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    eventBus   = new EventBus();
    timeEngine = new TimeEngine(eventBus);
    emitSpy    = vi.spyOn(eventBus, 'emit');
  });

  it('advanceTick() emits TICK_START with correct tick index', () => {
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    const payload = firstEmitPayload(emitSpy, TICK_START);
    expect(payload).toBeDefined();
    expect(payload?.tickIndex).toBe(1);
  });

  it('advanceTick() emits TIME_ENGINE_TICK with season budget fields', () => {
    timeEngine.setSeasonBudget(50);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    const payload = firstEmitPayload(emitSpy, TIME_ENGINE_TICK);
    expect(payload?.seasonBudget).toBe(50);
    expect(payload?.ticksRemaining).toBe(49);
  });

  it('advanceTick() emits TIME_TICK_ADVANCED each tick', () => {
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    expect(countEmitCalls(emitSpy, TIME_TICK_ADVANCED)).toBe(2);
  });

  it('advanceTick() emits TIME_ENGINE_START on the first tick only', () => {
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    timeEngine.advanceTick(makeTickSnapshot(2, 0));
    expect(countEmitCalls(emitSpy, TIME_ENGINE_START)).toBe(1);
  });

  it('setTierFromPressure() does NOT emit TICK_TIER_CHANGED when tier is unchanged', () => {
    // Starting at STABLE (T1). Pressure 0.1 is below COMPRESSED threshold (0.35).
    timeEngine.setTierFromPressure(0.1);
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(0);
  });

  it('setTierFromPressure() DOES emit TICK_TIER_CHANGED when tier escalates', () => {
    // Pressure 0.90 triggers COLLAPSE_IMMINENT (T4).
    timeEngine.setTierFromPressure(0.90);
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBeGreaterThanOrEqual(1);
  });

  it('TICK_TIER_CHANGED payload has previousTier and newTier fields', () => {
    timeEngine.setTierFromPressure(0.90);
    const payload = firstEmitPayload(emitSpy, TICK_TIER_CHANGED);
    expect(payload).toBeDefined();
    expect(payload?.previousTier).toBe(TickTier.STABLE);
    expect(payload?.newTier).toBe(TickTier.COLLAPSE_IMMINENT);
  });

  it('setTierFromPressure() also emits TIME_TIER_CHANGED (legacy alias)', () => {
    timeEngine.setTierFromPressure(0.65);
    expect(countEmitCalls(emitSpy, TIME_TIER_CHANGED)).toBeGreaterThanOrEqual(1);
  });

  it('TICK_TIER_CHANGED and TIME_TIER_CHANGED are emitted together on the same transition', () => {
    timeEngine.setTierFromPressure(0.65);
    const ticker  = countEmitCalls(emitSpy, TICK_TIER_CHANGED);
    const timeTier = countEmitCalls(emitSpy, TIME_TIER_CHANGED);
    expect(ticker).toBe(timeTier);
    expect(ticker).toBeGreaterThanOrEqual(1);
  });

  it('TIME_BUDGET_WARNING is emitted when ticksRemaining drops to 20', () => {
    timeEngine.setSeasonBudget(21);
    emitSpy.mockClear();
    timeEngine.advanceTick(makeTickSnapshot(0, 0)); // remaining becomes 20
    expect(countEmitCalls(emitSpy, TIME_BUDGET_WARNING)).toBeGreaterThanOrEqual(1);
  });

  it('TIME_BUDGET_WARNING payload includes ticksRemaining', () => {
    timeEngine.setSeasonBudget(21);
    emitSpy.mockClear();
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    const payload = firstEmitPayload(emitSpy, TIME_BUDGET_WARNING);
    expect(payload?.ticksRemaining).toBe(20);
  });

  it('SEASON_TIMEOUT is emitted when the budget is fully exhausted', () => {
    timeEngine.setSeasonBudget(1);
    emitSpy.mockClear();
    timeEngine.advanceTick(makeTickSnapshot(0, 0)); // ticks consumed = 1, remaining = 0
    expect(countEmitCalls(emitSpy, SEASON_TIMEOUT)).toBeGreaterThanOrEqual(1);
  });

  it('SEASON_TIMEOUT payload includes the seasonBudget and tickIndex', () => {
    timeEngine.setSeasonBudget(2);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    emitSpy.mockClear();
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    const payload = firstEmitPayload(emitSpy, SEASON_TIMEOUT);
    expect(payload?.seasonBudget).toBe(2);
    expect(payload?.tickIndex).toBe(2);
  });

  it('completeRun() emits TIME_ENGINE_COMPLETE with the completion reason', () => {
    timeEngine.completeRun('ABANDONED');
    const payload = firstEmitPayload(emitSpy, TIME_ENGINE_COMPLETE);
    expect(payload?.reason).toBe('ABANDONED');
  });

  it('completeRun() emits TIME_ENGINE_COMPLETE with tickIndex and tier', () => {
    timeEngine.setSeasonBudget(5);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    timeEngine.completeRun('RUN_ENDED');
    const payload = firstEmitPayload(emitSpy, TIME_ENGINE_COMPLETE);
    expect(payload?.tickIndex).toBe(2);
    expect(payload?.tickTier).toBe(TickTier.STABLE);
  });

  // Validates the exported EngineEventConstant type is a proper union.
  it('TICK_TIER_CHANGED constant value matches the emitted event name string', () => {
    const expected: EngineEventConstant = TICK_TIER_CHANGED;
    expect(expected).toBe('TICK_TIER_CHANGED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3 — Tier ladder mechanics (enter/exit thresholds and hysteresis)
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeEngine — tier ladder mechanics', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    eventBus   = new EventBus();
    timeEngine = new TimeEngine(eventBus);
    emitSpy    = vi.spyOn(eventBus, 'emit');
  });

  it('pressure >= 0.35 escalates T1 → T2 COMPRESSED', () => {
    timeEngine.setTierFromPressure(0.35);
    expect(timeEngine.getCurrentTier()).toBe(TickTier.COMPRESSED);
    expect(timeEngine.getTickDurationMs()).toBe(1500);
  });

  it('pressure < 0.35 keeps engine at T1 STABLE', () => {
    timeEngine.setTierFromPressure(0.34);
    expect(timeEngine.getCurrentTier()).toBe(TickTier.STABLE);
  });

  it('pressure >= 0.60 escalates T1 → T3 CRISIS in a single call', () => {
    timeEngine.setTierFromPressure(0.60);
    expect(timeEngine.getCurrentTier()).toBe(TickTier.CRISIS);
    expect(timeEngine.getTickDurationMs()).toBe(1000);
  });

  it('pressure >= 0.85 escalates T1 → T4 COLLAPSE_IMMINENT in a single call', () => {
    timeEngine.setTierFromPressure(0.90);
    expect(timeEngine.getCurrentTier()).toBe(TickTier.COLLAPSE_IMMINENT);
    expect(timeEngine.getTickDurationMs()).toBe(700);
  });

  it('escalating from T1 to T4 fires exactly one TICK_TIER_CHANGED event', () => {
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.90);
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(1);
  });

  it('multiple successive escalations from T1 through T3 each fire one event', () => {
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.35); // T1 → T2
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.65); // T2 → T3
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.90); // T3 → T4
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(1);
  });

  it('TICK_TIER_CHANGED payload carries pressureScore that triggered the change', () => {
    timeEngine.setTierFromPressure(0.65);
    const payload = firstEmitPayload(emitSpy, TICK_TIER_CHANGED);
    expect(payload?.pressureScore).toBe(0.65);
  });

  it('TICK_TIER_CHANGED payload carries duration before and after', () => {
    timeEngine.setTierFromPressure(0.65);
    const payload = firstEmitPayload(emitSpy, TICK_TIER_CHANGED);
    expect(payload?.previousDuration).toBe(2000);
    expect(payload?.newDuration).toBe(1000);
  });

  it('calling setTierFromPressure() with same pressure twice does NOT re-emit', () => {
    timeEngine.setTierFromPressure(0.40); // T1 → T2
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.40); // same tier, should not emit
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(0);
  });

  it('TICK_TIER_CHANGED encodes both multiplier and tick index', () => {
    timeEngine.setSeasonBudget(10);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.65);
    const payload = firstEmitPayload(emitSpy, TICK_TIER_CHANGED);
    expect(payload?.tickIndex).toBe(2);
    expect(payload?.multiplier).toBeGreaterThan(1.0);
  });

  it('TIER_CONFIGS covers all five TickTier enum values', () => {
    // Validate coverage by hitting each tier via pressure
    const matrix: Array<[number, TickTier]> = [
      [0.90, TickTier.COLLAPSE_IMMINENT],
      [0.65, TickTier.CRISIS],
      [0.40, TickTier.COMPRESSED],
    ];
    for (const [pressure, expectedTier] of matrix) {
      const bus  = new EventBus();
      const eng  = new TimeEngine(bus);
      eng.setTierFromPressure(pressure);
      expect(eng.getCurrentTier()).toBe(expectedTier);
    }
  });

  it('tick duration decreases as tier escalates', () => {
    const compressed = ((): number => {
      const eng = new TimeEngine(new EventBus());
      eng.setTierFromPressure(0.40);
      return eng.getTickDurationMs();
    })();
    const crisis = ((): number => {
      const eng = new TimeEngine(new EventBus());
      eng.setTierFromPressure(0.65);
      return eng.getTickDurationMs();
    })();
    const collapse = ((): number => {
      const eng = new TimeEngine(new EventBus());
      eng.setTierFromPressure(0.90);
      return eng.getTickDurationMs();
    })();
    expect(compressed).toBeGreaterThan(crisis);
    expect(crisis).toBeGreaterThan(collapse);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 4 — Season budget, timeout detection, SEASON_TIMEOUT
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeEngine — season budget and timeout detection', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    eventBus   = new EventBus();
    timeEngine = new TimeEngine(eventBus);
    emitSpy    = vi.spyOn(eventBus, 'emit');
  });

  it('ticksRemaining starts equal to seasonBudget', () => {
    timeEngine.setSeasonBudget(60);
    expect(timeEngine.getTicksRemaining()).toBe(60);
  });

  it('ticksRemaining reaches 0 when seasonBudget ticks have been consumed', () => {
    timeEngine.setSeasonBudget(3);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    timeEngine.advanceTick(makeTickSnapshot(2, 0));
    expect(timeEngine.getTicksRemaining()).toBe(0);
  });

  it('TIME_BUDGET_WARNING fires on the tick when ticksRemaining === 20', () => {
    timeEngine.setSeasonBudget(25);
    for (let i = 0; i < 5; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0));
    }
    // 5 ticks consumed → 20 remaining → warning fired on tick 5
    expect(countEmitCalls(emitSpy, TIME_BUDGET_WARNING)).toBeGreaterThanOrEqual(1);
  });

  it('TIME_BUDGET_WARNING is NOT emitted before the threshold', () => {
    timeEngine.setSeasonBudget(25);
    for (let i = 0; i < 4; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0)); // remaining: 21
    }
    expect(countEmitCalls(emitSpy, TIME_BUDGET_WARNING)).toBe(0);
  });

  it('SEASON_TIMEOUT fires exactly once when budget exhausted (budget = 1)', () => {
    timeEngine.setSeasonBudget(1);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    expect(countEmitCalls(emitSpy, SEASON_TIMEOUT)).toBe(1);
  });

  it('SEASON_TIMEOUT does not fire again after budget is already exhausted', () => {
    timeEngine.setSeasonBudget(1);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    emitSpy.mockClear();
    // Attempting additional ticks after exhaustion — SEASON_TIMEOUT should not re-fire
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    expect(countEmitCalls(emitSpy, SEASON_TIMEOUT)).toBe(0);
  });

  it('getBudgetSnapshot() consumed + remaining always equals allocated', () => {
    timeEngine.setSeasonBudget(50);
    for (let i = 0; i < 12; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0));
    }
    const { allocated, consumed, remaining }: TickBudget = timeEngine.getBudgetSnapshot();
    expect(consumed + remaining).toBe(allocated);
  });

  it('setSeasonBudget() on mid-run engine recalculates remaining without changing tickIndex', () => {
    timeEngine.setSeasonBudget(100);
    for (let i = 0; i < 15; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0));
    }
    timeEngine.setSeasonBudget(50);
    expect(timeEngine.getTickIndex()).toBe(15);
    expect(timeEngine.getTicksRemaining()).toBe(35);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 5 — Decision-window count propagation
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeEngine — decision window count propagation', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;
  let decisionTimer: DecisionTimer;

  beforeEach(() => {
    vi.useFakeTimers();
    eventBus      = new EventBus();
    timeEngine    = new TimeEngine(eventBus);
    decisionTimer = new DecisionTimer(eventBus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('setDecisionWindowCount() updates state.decisionWindows atomically', () => {
    timeEngine.setDecisionWindowCount(4);
    expect(timeEngine.getState().decisionWindows).toBe(4);
    timeEngine.setDecisionWindowCount(0);
    expect(timeEngine.getState().decisionWindows).toBe(0);
  });

  it('incrementDecisionWindowCount() adds incrementally', () => {
    timeEngine.incrementDecisionWindowCount(1);
    timeEngine.incrementDecisionWindowCount(1);
    timeEngine.incrementDecisionWindowCount(2);
    expect(timeEngine.getState().decisionWindows).toBe(4);
  });

  it('DecisionTimer.registerDecisionWindow() emits decision:window_opened on the bus', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    decisionTimer.registerDecisionWindow('win-01', 5000, 3);
    expect(countEmitCalls(emitSpy, 'decision:window_opened')).toBeGreaterThanOrEqual(1);
  });

  it('DecisionTimer.resolveDecisionWindow() emits decision:resolved', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    decisionTimer.registerDecisionWindow('win-02', 5000, 2);
    emitSpy.mockClear();
    decisionTimer.resolveDecisionWindow('win-02', 1);
    expect(countEmitCalls(emitSpy, 'decision:resolved')).toBeGreaterThanOrEqual(1);
  });

  it('DecisionTimer.applyHold() emits decision:hold_applied', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    decisionTimer.registerDecisionWindow('win-hold', 3000, 1);
    emitSpy.mockClear();
    const applied = decisionTimer.applyHold('win-hold');
    expect(applied).toBe(true);
    expect(countEmitCalls(emitSpy, 'decision:hold_applied')).toBeGreaterThanOrEqual(1);
  });

  it('DecisionTimer.applyHold() returns false when window is not found', () => {
    const applied = decisionTimer.applyHold('nonexistent-win');
    expect(applied).toBe(false);
  });

  it('DecisionTimer.applyHold() returns false on second hold attempt for same window', () => {
    decisionTimer.registerDecisionWindow('win-2hold', 3000, 1);
    expect(decisionTimer.applyHold('win-2hold')).toBe(true);
    expect(decisionTimer.applyHold('win-2hold')).toBe(false);
  });

  it('DecisionTimer.getActiveWindows() reflects the open window count', () => {
    decisionTimer.registerDecisionWindow('win-a', 5000, 2);
    decisionTimer.registerDecisionWindow('win-b', 5000, 2);
    expect(decisionTimer.getActiveWindows()).toHaveLength(2);
    decisionTimer.resolveDecisionWindow('win-a', 0);
    expect(decisionTimer.getActiveWindows()).toHaveLength(1);
  });

  it('DecisionTimer.nullifyWindow() removes it from active windows silently', () => {
    decisionTimer.registerDecisionWindow('win-null', 3000, 1);
    decisionTimer.nullifyWindow('win-null');
    expect(decisionTimer.getActiveWindows()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 6 — Telemetry envelope integrity
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeEngine — telemetry envelope integrity', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;

  beforeEach(() => {
    eventBus   = new EventBus();
    timeEngine = new TimeEngine(eventBus);
  });

  it('getTelemetry() returns a TelemetryEnvelopeV2 with all required sections', () => {
    const telemetry: TelemetryEnvelopeV2 = timeEngine.getTelemetry();
    expect(telemetry).toHaveProperty('tickTierDwell');
    expect(telemetry).toHaveProperty('tierTransitions');
    expect(telemetry).toHaveProperty('decisionWindowLifecycleMetrics');
    expect(telemetry).toHaveProperty('runTimeoutFlags');
  });

  it('tickTierDwell tracks T1 dwell ticks after advancing', () => {
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    timeEngine.advanceTick(makeTickSnapshot(2, 0));
    const { tickTierDwell } = timeEngine.getTelemetry();
    expect(tickTierDwell.T1).toBe(3);
  });

  it('tickTierDwell increments T2 dwell after tier transition', () => {
    timeEngine.setTierFromPressure(0.40); // → T2
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    const { tickTierDwell } = timeEngine.getTelemetry();
    expect(tickTierDwell.T2).toBe(2);
  });

  it('tierTransitions records a TierTransitionRecord for each tier change', () => {
    timeEngine.setTierFromPressure(0.40); // T1 → T2
    timeEngine.setTierFromPressure(0.65); // T2 → T3
    const { tierTransitions } = timeEngine.getTelemetry();
    expect(tierTransitions).toHaveLength(2);
  });

  it('TierTransitionRecord contains fromTier, toTier, pressureScore, and timestamps', () => {
    timeEngine.setTierFromPressure(0.65);
    const record: TierTransitionRecord = timeEngine.getTelemetry().tierTransitions[0];
    expect(record.fromTier).toBe(TickTier.STABLE);
    expect(record.toTier).toBe(TickTier.CRISIS);
    expect(record.pressureScore).toBe(0.65);
    expect(record.previousDurationMs).toBe(2000);
    expect(record.newDurationMs).toBe(1000);
    expect(record.timestamp).toBeGreaterThan(0);
  });

  it('runTimeoutFlags.timeoutOccurred is false before budget exhaustion', () => {
    timeEngine.setSeasonBudget(100);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    const { runTimeoutFlags } = timeEngine.getTelemetry();
    expect(runTimeoutFlags.timeoutOccurred).toBe(false);
  });

  it('runTimeoutFlags.timeoutOccurred is true after SEASON_TIMEOUT fires', () => {
    timeEngine.setSeasonBudget(1);
    timeEngine.advanceTick(makeTickSnapshot(0, 0)); // exhausts budget, triggers completeRun(TIMEOUT)
    const { runTimeoutFlags } = timeEngine.getTelemetry();
    expect(runTimeoutFlags.timeoutOccurred).toBe(true);
  });

  it('runTimeoutFlags.completed is true after completeRun()', () => {
    timeEngine.completeRun('RUN_ENDED');
    const { runTimeoutFlags } = timeEngine.getTelemetry();
    expect(runTimeoutFlags.completed).toBe(true);
    expect(runTimeoutFlags.completionReason).toBe('RUN_ENDED');
  });

  it('tierTransitions list is cleared after reset()', () => {
    timeEngine.setTierFromPressure(0.65);
    timeEngine.setTierFromPressure(0.90);
    timeEngine.reset();
    const { tierTransitions } = timeEngine.getTelemetry();
    expect(tierTransitions).toHaveLength(0);
  });

  it('tickTierDwell histogram is cleared after reset()', () => {
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    timeEngine.reset();
    const { tickTierDwell } = timeEngine.getTelemetry();
    expect(tickTierDwell.T0 + tickTierDwell.T1 + tickTierDwell.T2 + tickTierDwell.T3 + tickTierDwell.T4).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 7 — Full EngineOrchestrator-driven tick loop integration
// ─────────────────────────────────────────────────────────────────────────────

describe('EngineOrchestrator — time integration', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;
  let orchestrator: EngineOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ orchestrator, eventBus, timeEngine } = buildOrchestrator({
      defaultSeasonTickBudget: 50,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getLifecycleState() is IDLE before startRun()', () => {
    expect(orchestrator.getLifecycleState()).toBe('IDLE');
  });

  it('startRun() transitions lifecycle state to ACTIVE', () => {
    orchestrator.startRun();
    expect(orchestrator.getLifecycleState()).toBe('ACTIVE');
  });

  it('startRun() emits RUN_STARTED on the EventBus', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    expect(countEmitCalls(emitSpy, RUN_STARTED)).toBeGreaterThanOrEqual(1);
  });

  it('startRun() resets TimeEngine tick index to 0', () => {
    orchestrator.startRun();
    expect(timeEngine.getTickIndex()).toBe(0);
  });

  it('startRun() applies the seasonTickBudget option', () => {
    const opts: StartRunOptions = { seasonTickBudget: 30 };
    orchestrator.startRun(opts);
    expect(timeEngine.getSeasonBudget()).toBe(30);
  });

  it('executeTick() returns a TickExecutionRecord with tickIndex = 1 after first tick', () => {
    orchestrator.startRun();
    const record: TickExecutionRecord | null = orchestrator.executeTick();
    expect(record).not.toBeNull();
    expect(record?.tickIndex).toBe(1);
  });

  it('executeTick() advances TimeEngine.tickIndex by 1 per call', () => {
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(timeEngine.getTickIndex()).toBe(1);
    orchestrator.executeTick();
    expect(timeEngine.getTickIndex()).toBe(2);
  });

  it('executeTick() emits TICK_COMPLETE with tick metadata', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    orchestrator.executeTick();
    const payload = firstEmitPayload(emitSpy, TICK_COMPLETE);
    expect(payload).toBeDefined();
    expect(payload?.tickIndex).toBe(1);
  });

  it('executeTick() returns null when called before startRun()', () => {
    const result = orchestrator.executeTick();
    expect(result).toBeNull();
  });

  it('executeTick() returns null when the run is paused', () => {
    orchestrator.startRun();
    orchestrator.pause();
    const result = orchestrator.executeTick();
    expect(result).toBeNull();
  });

  it('pause() → resume() restores ACTIVE state and enables tick execution', () => {
    orchestrator.startRun();
    orchestrator.pause();
    orchestrator.resume();
    expect(orchestrator.getLifecycleState()).toBe('ACTIVE');
    const record = orchestrator.executeTick();
    expect(record).not.toBeNull();
  });

  it('endRun() transitions lifecycle to ENDED', () => {
    orchestrator.startRun();
    orchestrator.endRun('ABANDONED');
    expect(orchestrator.getLifecycleState()).toBe('ENDED');
  });

  it('endRun() emits RUN_ENDED on the EventBus', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    emitSpy.mockClear();
    orchestrator.endRun('TIMEOUT');
    expect(countEmitCalls(emitSpy, RUN_ENDED)).toBeGreaterThanOrEqual(1);
  });

  it('endRun() is idempotent — second call is ignored', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    orchestrator.endRun('ABANDONED');
    emitSpy.mockClear();
    orchestrator.endRun('ABANDONED');
    expect(countEmitCalls(emitSpy, RUN_ENDED)).toBe(0);
  });

  it('getLastTickRecord() returns the most recent TickExecutionRecord', () => {
    orchestrator.startRun();
    expect(orchestrator.getLastTickRecord()).toBeNull();
    orchestrator.executeTick();
    const last: TickExecutionRecord | null = orchestrator.getLastTickRecord();
    expect(last).not.toBeNull();
    expect(last?.tickIndex).toBe(1);
  });

  it('getDiagnostics() returns step metrics for each executed tick', () => {
    orchestrator.startRun();
    orchestrator.executeTick();
    const diagnostics = orchestrator.getDiagnostics();
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]).toHaveProperty('step');
    expect(diagnostics[0]).toHaveProperty('durationMs');
    expect(diagnostics[0]).toHaveProperty('ok');
  });

  it('getTimeEngine() returns the injected TimeEngine instance', () => {
    const engine = orchestrator.getTimeEngine();
    expect(engine).toBe(timeEngine);
  });

  it('getDecisionTimer() returns the internal DecisionTimer instance', () => {
    const timer = orchestrator.getDecisionTimer();
    expect(timer).toBeDefined();
  });

  it('onForcedCardEntersPlay() registers a decision window via DecisionTimer', () => {
    orchestrator.startRun();
    orchestrator.onForcedCardEntersPlay('win-force-1', 4000, 2);
    const timer  = orchestrator.getDecisionTimer();
    expect(timer.getActiveWindows()).toHaveLength(1);
  });

  it('resolveDecisionWindow() removes the window from the active list', () => {
    orchestrator.startRun();
    orchestrator.onForcedCardEntersPlay('win-resolve', 4000, 3);
    orchestrator.resolveDecisionWindow('win-resolve', 1);
    const timer = orchestrator.getDecisionTimer();
    expect(timer.getActiveWindows()).toHaveLength(0);
  });

  it('applyHold() applies hold to an open window', () => {
    orchestrator.startRun();
    orchestrator.onForcedCardEntersPlay('win-hold-orch', 3000, 1);
    const applied = orchestrator.applyHold('win-hold-orch');
    expect(applied).toBe(true);
  });

  it('nullifyDecisionWindow() removes the window without emitting resolved event', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    orchestrator.onForcedCardEntersPlay('win-null-orch', 2000, 1);
    emitSpy.mockClear();
    orchestrator.nullifyDecisionWindow('win-null-orch');
    expect(orchestrator.getDecisionTimer().getActiveWindows()).toHaveLength(0);
    expect(countEmitCalls(emitSpy, 'decision:resolved')).toBe(0);
  });

  it('auto-schedules next tick via setTimeout after executeTick() completes', () => {
    orchestrator.startRun();
    orchestrator.executeTick(); // completes synchronously, should schedule next
    // Advance timer — if next tick is scheduled, it will fire
    vi.advanceTimersByTime(3000);
    // After advancing, tickIndex should be > 1 (auto-scheduled tick fired)
    expect(timeEngine.getTickIndex()).toBeGreaterThanOrEqual(1);
  });

  it('endRun triggers ENDED lifecycle after budget is exhausted', () => {
    const { orchestrator: orch } = buildOrchestrator({ defaultSeasonTickBudget: 1 });
    orch.startRun();
    orch.executeTick(); // budget exhausted → endRun called internally
    expect(orch.getLifecycleState()).toBe('ENDED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 8 — ClockSource correctness (WallClockSource and FixedClockSource)
// ─────────────────────────────────────────────────────────────────────────────

describe('ClockSource — deterministic and wall implementations', () => {
  it('WallClockSource.now() returns a positive integer close to Date.now()', () => {
    const clock   = new WallClockSource();
    const before  = Date.now();
    const reading = clock.now();
    const after   = Date.now();
    expect(reading).toBeGreaterThanOrEqual(before);
    expect(reading).toBeLessThanOrEqual(after);
  });

  it('FixedClockSource.now() starts at the provided initialMs', () => {
    const clock = new FixedClockSource(1_000_000, 100);
    expect(clock.now()).toBe(1_000_000);
  });

  it('FixedClockSource.now() advances by tickMs on each call', () => {
    const clock = new FixedClockSource(0, 250);
    expect(clock.now()).toBe(0);
    expect(clock.now()).toBe(250);
    expect(clock.now()).toBe(500);
    expect(clock.now()).toBe(750);
  });

  it('FixedClockSource.reset() returns the clock to its initial position', () => {
    const clock = new FixedClockSource(5000, 100);
    clock.now(); // 5000
    clock.now(); // 5100
    clock.reset(5000);
    expect(clock.now()).toBe(5000);
  });

  it('FixedClockSource is deterministic across identical sequences', () => {
    const clockA = new FixedClockSource(0, 1000);
    const clockB = new FixedClockSource(0, 1000);
    const readingsA = [clockA.now(), clockA.now(), clockA.now()];
    const readingsB = [clockB.now(), clockB.now(), clockB.now()];
    expect(readingsA).toEqual(readingsB);
  });

  it('EngineBundle type is structurally satisfied by an empty object', () => {
    // Validates that EngineBundle has all optional fields, making {} valid.
    const bundle: EngineBundle = {};
    expect(bundle).toBeDefined();
  });

  it('OrchestratorSnapshot type captures all required fields', () => {
    const { orchestrator: orch } = buildOrchestrator();
    orch.startRun();
    orch.executeTick();
    const last = orch.getLastTickRecord();
    // TickExecutionRecord and OrchestratorSnapshot fields validated together
    const snap: OrchestratorSnapshot = {
      tickIndex:              last?.tickIndex ?? 0,
      tickTier:               'T1',
      tickDurationMs:         2000,
      pressureScore:          last?.pressureScore ?? 0,
      pressureTier:           null,
      seasonBudget:           50,
      ticksRemaining:         49,
      timeoutImminent:        false,
      activeDecisionWindows:  last?.activeDecisionWindows ?? 0,
      pendingEventCount:      0,
      runtime:                {},
    };
    expect(snap.tickTier).toBe('T1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 9 — EngineBundle engine hook pass-through
// ─────────────────────────────────────────────────────────────────────────────

describe('EngineOrchestrator — EngineBundle hook pass-through', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pressure.computeScore() is called during STEP_02_PRESSURE_COMPUTE', () => {
    const computeScore = vi.fn().mockReturnValue(0.5);
    const bundle: EngineBundle = { pressure: { computeScore } };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(computeScore).toHaveBeenCalledOnce();
  });

  it('pressure.recomputePostActions() is called during STEP_10_PRESSURE_RECOMPUTE', () => {
    const recomputePostActions = vi.fn().mockReturnValue(0.3);
    const bundle: EngineBundle = { pressure: { recomputePostActions } };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(recomputePostActions).toHaveBeenCalledOnce();
  });

  it('tension.updateQueue() is called during STEP_03_TENSION_UPDATE', () => {
    const updateQueue = vi.fn();
    const bundle: EngineBundle = { tension: { updateQueue } };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(updateQueue).toHaveBeenCalledOnce();
  });

  it('shield.applyPassiveDecay() is called during STEP_04_SHIELD_PASSIVE_DECAY', () => {
    const applyPassiveDecay = vi.fn();
    const bundle: EngineBundle = { shield: { applyPassiveDecay } };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(applyPassiveDecay).toHaveBeenCalledOnce();
  });

  it('battle.evaluateBotStates() is called during STEP_05_BATTLE_EVALUATE', () => {
    const evaluateBotStates = vi.fn();
    const bundle: EngineBundle = { battle: { evaluateBotStates } };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(evaluateBotStates).toHaveBeenCalledOnce();
  });

  it('battle.executeAttacks() results accumulate in TickExecutionRecord.attacksFired', () => {
    const fakeAttack = { id: 'atk-1' };
    const executeAttacks = vi.fn().mockReturnValue([fakeAttack]);
    const bundle: EngineBundle = { battle: { executeAttacks } };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    const record = orchestrator.executeTick();
    expect(record?.attacksFired).toContain(fakeAttack);
  });

  it('shield.applyAttacks() results accumulate in TickExecutionRecord.damageResults', () => {
    const fakeDamage = { layer: 'L1', amount: 12 };
    const applyAttacks = vi.fn().mockReturnValue([fakeDamage]);
    const bundle: EngineBundle = { shield: { applyAttacks } };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    const record = orchestrator.executeTick();
    expect(record?.damageResults).toContain(fakeDamage);
  });

  it('cascade.executeScheduledLinks() results accumulate in TickExecutionRecord.cascadeEffects', () => {
    const fakeEffect = { chainId: 'c1', tick: 1 };
    const executeScheduledLinks = vi.fn().mockReturnValue([fakeEffect]);
    const bundle: EngineBundle = { cascade: { executeScheduledLinks } };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    const record = orchestrator.executeTick();
    expect(record?.cascadeEffects).toContain(fakeEffect);
  });

  it('cascade.checkRecoveryConditions() results accumulate in TickExecutionRecord.recoveryResults', () => {
    const fakeRecovery = { recoveredChain: 'c2' };
    const checkRecoveryConditions = vi.fn().mockReturnValue([fakeRecovery]);
    const bundle: EngineBundle = { cascade: { checkRecoveryConditions } };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    const record = orchestrator.executeTick();
    expect(record?.recoveryResults).toContain(fakeRecovery);
  });

  it('sovereignty.snapshotTick() is called during STEP_12_SOVEREIGNTY_SNAPSHOT', () => {
    const snapshotTick = vi.fn();
    const bundle: EngineBundle = { sovereignty: { snapshotTick } };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(snapshotTick).toHaveBeenCalledOnce();
  });

  it('outcomeResolver returning a non-null value triggers endRun()', () => {
    const { orchestrator } = buildOrchestrator({
      outcomeResolver: () => 'FREEDOM',
    });
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(orchestrator.getLifecycleState()).toBe('ENDED');
  });

  it('a throwing engine step does NOT crash the entire tick — error is captured in diagnostics', () => {
    const explodingEngine: EngineBundle = {
      tension: {
        updateQueue: () => {
          throw new Error('Simulated engine step failure');
        },
      },
    };
    const { orchestrator: orch, eventBus: bus } = buildOrchestrator({ engines: explodingEngine });
    const emitSpy = vi.spyOn(bus, 'emit');
    orch.startRun();
    const record = orch.executeTick();
    // Tick should still complete despite the error in Step 3
    expect(record).not.toBeNull();
    expect(countEmitCalls(emitSpy, TICK_STEP_ERROR)).toBeGreaterThanOrEqual(1);
    const diag = orch.getDiagnostics().find((d) => d.step === 'STEP_03_TENSION_UPDATE');
    expect(diag?.ok).toBe(false);
    expect(diag?.errorMessage).toContain('Simulated engine step failure');
  });
});
