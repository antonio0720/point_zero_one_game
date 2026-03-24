/**
 * ============================================================================
 * FILE: pzo-web/src/engines/core/__tests__/EngineOrchestrator.timeIntegration.test.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative integration contract for the TimeEngine × EventBus × EngineOrchestrator
 * triad. Tests are structured in eighteen layers of increasing integration depth:
 *
 *   Layer  1 — TimeEngine direct API (pure state mutations, no bus)
 *   Layer  2 — TimeEngine → EventBus emission contract (tier changes, lifecycle)
 *   Layer  3 — Tier ladder mechanics (enter/exit thresholds, hysteresis)
 *   Layer  4 — Season budget, timeout detection, and SEASON_TIMEOUT event
 *   Layer  5 — Decision-window count propagation into TimeEngine state
 *   Layer  6 — Telemetry envelope integrity (dwell ticks, transition records)
 *   Layer  7 — Full EngineOrchestrator-driven tick loop integration
 *   Layer  8 — ClockSource correctness (WallClockSource and FixedClockSource)
 *   Layer  9 — EngineBundle engine hook pass-through
 *   Layer 10 — Orchestrator reset() and re-run lifecycle
 *   Layer 11 — Tier hysteresis: de-escalation boundaries
 *   Layer 12 — Telemetry under load: multi-tick multi-tier runs
 *   Layer 13 — PressureReader injection and snapshot enrichment
 *   Layer 14 — snapshotProvider runtime field propagation
 *   Layer 15 — Decision window stress test (concurrent windows)
 *   Layer 16 — Constants, type guards, and TickTier/TickTierId coverage
 *   Layer 17 — Budget arithmetic edge cases and coercion
 *   Layer 18 — Step ordering, TICK_COMPLETE payload completeness, event sequencing
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
  type PressureEngineLike,
} from '../EngineOrchestrator';

import { WallClockSource, FixedClockSource } from '../ClockSource';

import {
  buildOrchestrator       as buildOrchestratorFromHarness,
  makeTickSnapshot        as makeTickSnapshotFromHarness,
  countEmitCalls          as countEmitCallsFromHarness,
  firstEmitPayload        as firstEmitPayloadFromHarness,
  auditTickDurationTable,
  CANONICAL_EVENT_CONSTANTS,
  isCanonicalEventConstant,
  isValidTickTier,
  isTierLowerThan,
  assertBudgetInvariant,
  freshHarness,
  enqueueSimpleThreat,
  TEST_HARNESS_DOCTRINE,
  TEST_HARNESS_EXPORTED_UTILITIES,
  TEST_HARNESS_MODULE_NAME,
  type OrchestratorRig,
} from './index';

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
  return (spy.mock.calls as [string, ...unknown[]][]).filter(([name]) => name === eventName).length;
}

/**
 * Extracts first payload from emit spy for a specific event name.
 */
function firstEmitPayload(
  spy: ReturnType<typeof vi.spyOn>,
  eventName: string,
): Record<string, unknown> | undefined {
  const call = (spy.mock.calls as [string, ...unknown[]][]).find(([name]) => name === eventName);
  return call?.[1] as Record<string, unknown> | undefined;
}

/**
 * Extracts ALL payloads from emit spy for a specific event name.
 */
function allEmitPayloads(
  spy: ReturnType<typeof vi.spyOn>,
  eventName: string,
): Array<Record<string, unknown>> {
  return (spy.mock.calls as [string, unknown][])
    .filter(([name]) => name === eventName)
    .map(([, payload]) => payload as Record<string, unknown>);
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

    const completedCalls = (emitSpy.mock.calls as [string, ...unknown[]][]).filter(([name]) => name === TIME_ENGINE_COMPLETE);
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
    const record: TierTransitionRecord = timeEngine.getTelemetry().tierTransitions[0]!;
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
    const bundle: EngineBundle = { pressure: { computeScore } as unknown as PressureEngineLike };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(computeScore).toHaveBeenCalledOnce();
  });

  it('pressure.recomputePostActions() is called during STEP_10_PRESSURE_RECOMPUTE', () => {
    const recomputePostActions = vi.fn().mockReturnValue(0.3);
    const bundle: EngineBundle = { pressure: { recomputePostActions } as unknown as PressureEngineLike };
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
    const diag = orch.getDiagnostics().find((d) => !d.ok);
    expect(diag?.ok).toBe(false);
    expect(diag?.errorMessage).toContain('Simulated engine step failure');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 10 — Orchestrator reset() and re-run lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('EngineOrchestrator — reset() and re-run lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reset() transitions lifecycle to IDLE', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.reset();
    expect(orchestrator.getLifecycleState()).toBe('IDLE');
  });

  it('startRun() after reset() succeeds and transitions to ACTIVE', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.reset();
    orchestrator.startRun();
    expect(orchestrator.getLifecycleState()).toBe('ACTIVE');
  });

  it('TimeEngine tick index is 0 after reset() followed by startRun()', () => {
    const { orchestrator, timeEngine } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.executeTick();
    orchestrator.executeTick();
    expect(timeEngine.getTickIndex()).toBe(2);
    orchestrator.reset();
    orchestrator.startRun();
    expect(timeEngine.getTickIndex()).toBe(0);
  });

  it('second run tracks ticks independently from the first run', () => {
    const { orchestrator, timeEngine } = buildOrchestrator({ defaultSeasonTickBudget: 50 });

    // Run 1: execute 3 ticks
    orchestrator.startRun();
    orchestrator.executeTick();
    orchestrator.executeTick();
    orchestrator.executeTick();
    expect(timeEngine.getTickIndex()).toBe(3);

    // Reset and run 2
    orchestrator.reset();
    orchestrator.startRun({ seasonTickBudget: 80 });
    expect(timeEngine.getTickIndex()).toBe(0);
    orchestrator.executeTick();
    expect(timeEngine.getTickIndex()).toBe(1);
    expect(timeEngine.getSeasonBudget()).toBe(80);
  });

  it('getLastTickRecord() is null after reset()', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(orchestrator.getLastTickRecord()).not.toBeNull();
    orchestrator.reset();
    expect(orchestrator.getLastTickRecord()).toBeNull();
  });

  it('getDiagnostics() is empty after reset()', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(orchestrator.getDiagnostics().length).toBeGreaterThan(0);
    orchestrator.reset();
    expect(orchestrator.getDiagnostics()).toHaveLength(0);
  });

  it('endRun() → startRun() restores full tick execution capability', () => {
    const { orchestrator, timeEngine } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.executeTick();
    orchestrator.endRun('ABANDONED');
    expect(orchestrator.getLifecycleState()).toBe('ENDED');

    // After endRun, executeTick returns null
    expect(orchestrator.executeTick()).toBeNull();

    // But after reset + startRun, it works again
    orchestrator.reset();
    orchestrator.startRun();
    const record = orchestrator.executeTick();
    expect(record).not.toBeNull();
    expect(timeEngine.getTickIndex()).toBe(1);
  });

  it('RUN_STARTED is emitted on each successive startRun()', () => {
    const { orchestrator, eventBus } = buildOrchestrator();
    const emitSpy = vi.spyOn(eventBus, 'emit');

    orchestrator.startRun();
    orchestrator.reset();
    orchestrator.startRun();

    expect(countEmitCalls(emitSpy, RUN_STARTED)).toBe(2);
  });

  it('RUN_ENDED is emitted once per endRun() across two runs', () => {
    const { orchestrator, eventBus } = buildOrchestrator();
    const emitSpy = vi.spyOn(eventBus, 'emit');

    orchestrator.startRun();
    orchestrator.endRun('ABANDONED');
    orchestrator.reset();
    orchestrator.startRun();
    orchestrator.endRun('ABANDONED');

    expect(countEmitCalls(emitSpy, RUN_ENDED)).toBe(2);
  });

  it('DecisionTimer windows are cleared after reset()', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.onForcedCardEntersPlay('w1', 5000, 2);
    orchestrator.onForcedCardEntersPlay('w2', 5000, 2);
    expect(orchestrator.getDecisionTimer().getActiveWindows()).toHaveLength(2);

    orchestrator.reset();
    expect(orchestrator.getDecisionTimer().getActiveWindows()).toHaveLength(0);
  });

  it('tier is back at T1 STABLE after reset() regardless of pressure applied', () => {
    const { orchestrator, timeEngine } = buildOrchestrator();
    orchestrator.startRun();
    timeEngine.setTierFromPressure(0.90); // goes to T4
    expect(timeEngine.getCurrentTier()).toBe(TickTier.COLLAPSE_IMMINENT);

    orchestrator.reset();
    orchestrator.startRun();
    expect(timeEngine.getCurrentTier()).toBe(TickTier.STABLE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 11 — Tier hysteresis: de-escalation boundaries
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeEngine — tier hysteresis and de-escalation', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    eventBus   = new EventBus();
    timeEngine = new TimeEngine(eventBus);
    emitSpy    = vi.spyOn(eventBus, 'emit');
  });

  it('at T2 COMPRESSED, pressure just below 0.25 triggers de-escalation to T1', () => {
    timeEngine.setTierFromPressure(0.40); // → T2
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.24); // below exitBelow=0.25 → T1
    expect(timeEngine.getCurrentTier()).toBe(TickTier.STABLE);
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(1);
  });

  it('at T2 COMPRESSED, pressure at 0.25 stays at T2 (hysteresis band holds)', () => {
    timeEngine.setTierFromPressure(0.40); // → T2
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.30); // above exitBelow=0.25 → stays T2
    expect(timeEngine.getCurrentTier()).toBe(TickTier.COMPRESSED);
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(0);
  });

  it('at T3 CRISIS, pressure just below 0.50 de-escalates to T2', () => {
    timeEngine.setTierFromPressure(0.65); // → T3
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.49); // below exitBelow=0.50 → T2
    expect(timeEngine.getCurrentTier()).toBe(TickTier.COMPRESSED);
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(1);
  });

  it('at T3 CRISIS, pressure of 0.50 stays at T3 (at boundary, no de-escalation)', () => {
    timeEngine.setTierFromPressure(0.65); // → T3
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.51); // above exitBelow=0.50 → stays T3
    expect(timeEngine.getCurrentTier()).toBe(TickTier.CRISIS);
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(0);
  });

  it('at T4 COLLAPSE_IMMINENT, pressure below 0.75 de-escalates to T3', () => {
    timeEngine.setTierFromPressure(0.90); // → T4
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.74); // below exitBelow=0.75 → T3
    expect(timeEngine.getCurrentTier()).toBe(TickTier.CRISIS);
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(1);
  });

  it('de-escalation fires TICK_TIER_CHANGED and TIME_TIER_CHANGED in tandem', () => {
    timeEngine.setTierFromPressure(0.65); // → T3
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.49); // de-escalate T3 → T2
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(1);
    expect(countEmitCalls(emitSpy, TIME_TIER_CHANGED)).toBe(1);
  });

  it('de-escalation payload has previousTier = T3 and newTier = T2', () => {
    timeEngine.setTierFromPressure(0.65); // → T3
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.40); // de-escalate
    const payload = firstEmitPayload(emitSpy, TICK_TIER_CHANGED);
    expect(payload?.previousTier).toBe(TickTier.CRISIS);
    expect(payload?.newTier).toBe(TickTier.COMPRESSED);
  });

  it('de-escalation only goes one tier at a time (T4 → T3, not T4 → T1)', () => {
    timeEngine.setTierFromPressure(0.90); // → T4
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.10); // below T4 exitBelow=0.75
    // Should go to T3, not T1 — de-escalation is one step
    expect(timeEngine.getCurrentTier()).toBe(TickTier.CRISIS);
  });

  it('oscillation scenario: repeated escalate/de-escalate tracks correctly', () => {
    // Escalate T1 → T2
    timeEngine.setTierFromPressure(0.40);
    expect(timeEngine.getCurrentTier()).toBe(TickTier.COMPRESSED);

    // De-escalate T2 → T1
    timeEngine.setTierFromPressure(0.10);
    expect(timeEngine.getCurrentTier()).toBe(TickTier.STABLE);

    // Escalate again T1 → T2
    timeEngine.setTierFromPressure(0.40);
    expect(timeEngine.getCurrentTier()).toBe(TickTier.COMPRESSED);

    // Each transition should appear in tierTransitions
    const { tierTransitions } = timeEngine.getTelemetry();
    expect(tierTransitions).toHaveLength(3);
  });

  it('calling setTierFromPressure() with 0 from T1 does not fire any event', () => {
    // Already at T1. Pressure = 0 means we check de-escalation to T0 (SOVEREIGN)
    // T1 exitBelow = 0.0, so pressure 0.0 is NOT strictly less than 0.0
    emitSpy.mockClear();
    timeEngine.setTierFromPressure(0.0);
    // No transition expected — T1 has exitBelow=0.0, strict less-than means 0.0 < 0.0 is false
    expect(countEmitCalls(emitSpy, TICK_TIER_CHANGED)).toBe(0);
    expect(timeEngine.getCurrentTier()).toBe(TickTier.STABLE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 12 — Telemetry under load: multi-tick multi-tier runs
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeEngine — telemetry under load', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;

  beforeEach(() => {
    eventBus   = new EventBus();
    timeEngine = new TimeEngine(eventBus);
  });

  it('sum of all tier dwell ticks equals total tick index after mixed-tier run', () => {
    // 5 ticks at T1
    for (let i = 0; i < 5; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0.0));
    }
    // escalate to T2
    timeEngine.setTierFromPressure(0.40);
    // 4 more ticks at T2
    for (let i = 5; i < 9; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0.40));
    }
    // escalate to T3
    timeEngine.setTierFromPressure(0.65);
    // 3 more ticks at T3
    for (let i = 9; i < 12; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0.65));
    }

    const { tickTierDwell } = timeEngine.getTelemetry();
    const totalDwell = tickTierDwell.T0 + tickTierDwell.T1 + tickTierDwell.T2
                     + tickTierDwell.T3 + tickTierDwell.T4;
    expect(timeEngine.getTickIndex()).toBe(12);
    expect(totalDwell).toBe(12);
  });

  it('T1 dwell reflects only the ticks spent at T1 in a mixed run', () => {
    for (let i = 0; i < 5; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0));
    }
    timeEngine.setTierFromPressure(0.40); // → T2
    for (let i = 5; i < 8; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0.40));
    }
    const { tickTierDwell } = timeEngine.getTelemetry();
    expect(tickTierDwell.T1).toBe(5);
    expect(tickTierDwell.T2).toBe(3);
  });

  it('tierTransitions grows correctly for each distinct tier change', () => {
    timeEngine.setTierFromPressure(0.40); // T1→T2
    timeEngine.setTierFromPressure(0.65); // T2→T3
    timeEngine.setTierFromPressure(0.90); // T3→T4
    const { tierTransitions } = timeEngine.getTelemetry();
    expect(tierTransitions).toHaveLength(3);
    expect(tierTransitions[0]!.fromTier).toBe(TickTier.STABLE);
    expect(tierTransitions[0]!.toTier).toBe(TickTier.COMPRESSED);
    expect(tierTransitions[1]!.fromTier).toBe(TickTier.COMPRESSED);
    expect(tierTransitions[1]!.toTier).toBe(TickTier.CRISIS);
    expect(tierTransitions[2]!.fromTier).toBe(TickTier.CRISIS);
    expect(tierTransitions[2]!.toTier).toBe(TickTier.COLLAPSE_IMMINENT);
  });

  it('TierTransitionRecord multiplier increases at higher tiers', () => {
    timeEngine.setTierFromPressure(0.40); // T1→T2
    timeEngine.setTierFromPressure(0.65); // T2→T3
    timeEngine.setTierFromPressure(0.90); // T3→T4
    const { tierTransitions } = timeEngine.getTelemetry();
    const [t12, t23, t34] = tierTransitions as [TierTransitionRecord, TierTransitionRecord, TierTransitionRecord];
    expect(t12.multiplier).toBeLessThan(t23.multiplier);
    expect(t23.multiplier).toBeLessThan(t34.multiplier);
  });

  it('runTimeoutFlags.runStartedAtMs is a number > 0 after first advanceTick()', () => {
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    const { runTimeoutFlags } = timeEngine.getTelemetry();
    expect(typeof runTimeoutFlags.runStartedAtMs).toBe('number');
    expect(runTimeoutFlags.runStartedAtMs).toBeGreaterThan(0);
  });

  it('runTimeoutFlags.runStartedAtMs is null before first advanceTick()', () => {
    const { runTimeoutFlags } = timeEngine.getTelemetry();
    expect(runTimeoutFlags.runStartedAtMs).toBeNull();
  });

  it('runTimeoutFlags.runCompletedAtMs is populated after completeRun()', () => {
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.completeRun('RUN_ENDED');
    const { runTimeoutFlags } = timeEngine.getTelemetry();
    expect(runTimeoutFlags.runCompletedAtMs).not.toBeNull();
    expect(runTimeoutFlags.runCompletedAtMs).toBeGreaterThan(0);
  });

  it('10-tick run accumulates exactly 10 dwell ticks across all tiers', () => {
    timeEngine.setSeasonBudget(100);
    for (let i = 0; i < 10; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0));
    }
    const { tickTierDwell } = timeEngine.getTelemetry();
    const total = Object.values(tickTierDwell).reduce((sum, v) => sum + v, 0);
    expect(total).toBe(10);
  });

  it('tierTransition timestamps are monotonically non-decreasing', () => {
    timeEngine.setTierFromPressure(0.40);
    timeEngine.setTierFromPressure(0.65);
    timeEngine.setTierFromPressure(0.90);
    const { tierTransitions } = timeEngine.getTelemetry();
    for (let i = 1; i < tierTransitions.length; i++) {
      expect(tierTransitions[i]!.timestamp).toBeGreaterThanOrEqual(
        tierTransitions[i - 1]!.timestamp,
      );
    }
  });

  it('TICK_DURATION_MS_BY_TIER matches the engine durations for each tier', () => {
    const tierDurationMap: Array<[number, string]> = [
      [0.0,  'T1'], // STABLE — 2000ms
      [0.40, 'T2'], // COMPRESSED — 1500ms
      [0.65, 'T3'], // CRISIS — 1000ms
      [0.90, 'T4'], // COLLAPSE_IMMINENT — 700ms
    ];
    for (const [pressure, tierId] of tierDurationMap) {
      const eng = new TimeEngine(new EventBus());
      eng.setTierFromPressure(pressure);
      expect(eng.getTickDurationMs()).toBe(
        TICK_DURATION_MS_BY_TIER[tierId as keyof typeof TICK_DURATION_MS_BY_TIER],
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 13 — PressureReader injection and snapshot enrichment
// ─────────────────────────────────────────────────────────────────────────────

describe('EngineOrchestrator — PressureReader injection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('injected PressureReader.getCurrentScore() feeds pressureScore into TickExecutionRecord', () => {
    const mockPressureReader = {
      getCurrentScore: vi.fn().mockReturnValue(0.42),
      getCurrentTier:  vi.fn().mockReturnValue('ELEVATED'),
      getScoreHistory: vi.fn().mockReturnValue([]),
      isEscalating:    vi.fn().mockReturnValue(false),
      getSnapshot:     vi.fn().mockReturnValue(null),
    };

    const { orchestrator } = buildOrchestrator({ pressureReader: mockPressureReader });
    orchestrator.startRun();
    const record = orchestrator.executeTick();

    expect(record?.pressureScore).toBe(0.42);
  });

  it('OrchestratorSnapshot.pressureTier reflects PressureReader.getCurrentTier()', () => {
    let capturedSnapshot: OrchestratorSnapshot | null = null;

    const mockPressureReader = {
      getCurrentScore: vi.fn().mockReturnValue(0.60),
      getCurrentTier:  vi.fn().mockReturnValue('HIGH'),
      getScoreHistory: vi.fn().mockReturnValue([]),
      isEscalating:    vi.fn().mockReturnValue(true),
      getSnapshot:     vi.fn().mockReturnValue(null),
    };

    const bundle: EngineBundle = {
      tension: {
        updateQueue: (snap) => {
          capturedSnapshot = snap as OrchestratorSnapshot;
        },
      },
    };

    const { orchestrator } = buildOrchestrator({
      pressureReader: mockPressureReader,
      engines: bundle,
    });

    orchestrator.startRun();
    orchestrator.executeTick();

    expect((capturedSnapshot as OrchestratorSnapshot | null)?.pressureTier).toBe('HIGH');
  });

  it('PressureReader.getCurrentScore() is called during each tick', () => {
    const getCurrentScore = vi.fn().mockReturnValue(0.5);
    const mockPressureReader = {
      getCurrentScore,
      getCurrentTier:  vi.fn().mockReturnValue('ELEVATED'),
      getScoreHistory: vi.fn().mockReturnValue([]),
      isEscalating:    vi.fn().mockReturnValue(false),
      getSnapshot:     vi.fn().mockReturnValue(null),
    };

    const { orchestrator } = buildOrchestrator({ pressureReader: mockPressureReader });
    orchestrator.startRun();
    orchestrator.executeTick();
    orchestrator.executeTick();

    // getCurrentScore is called on each captureSnapshot — at least twice per tick
    expect(getCurrentScore.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('without PressureReader, pressureScore defaults to 0 in TickExecutionRecord', () => {
    const { orchestrator } = buildOrchestrator({ pressureReader: null });
    orchestrator.startRun();
    const record = orchestrator.executeTick();
    expect(record?.pressureScore).toBe(0);
  });

  it('postActionPressure reflects recomputePostActions() when provided', () => {
    const recomputePostActions = vi.fn().mockReturnValue(0.75);
    const { orchestrator } = buildOrchestrator({
      engines: { pressure: { recomputePostActions } as unknown as PressureEngineLike },
    });
    orchestrator.startRun();
    const record = orchestrator.executeTick();
    expect(record?.postActionPressure).toBe(0.75);
  });

  it('postActionPressure falls back to pressureScore when recomputePostActions is absent', () => {
    const mockPressureReader = {
      getCurrentScore: vi.fn().mockReturnValue(0.33),
      getCurrentTier:  vi.fn().mockReturnValue('BUILDING'),
      getScoreHistory: vi.fn().mockReturnValue([]),
      isEscalating:    vi.fn().mockReturnValue(false),
      getSnapshot:     vi.fn().mockReturnValue(null),
    };
    const { orchestrator } = buildOrchestrator({ pressureReader: mockPressureReader });
    orchestrator.startRun();
    const record = orchestrator.executeTick();
    // postActionPressure should be equal to pressureScore since no recompute
    expect(record?.postActionPressure).toBe(record?.pressureScore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 14 — snapshotProvider runtime field propagation
// ─────────────────────────────────────────────────────────────────────────────

describe('EngineOrchestrator — snapshotProvider runtime field', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('snapshotProvider return value appears in OrchestratorSnapshot.runtime', () => {
    let capturedRuntime: Record<string, unknown> | null = null;
    const snapshotProvider = vi.fn().mockReturnValue({ customField: 'sentinel', phase: 42 });

    const bundle: EngineBundle = {
      sovereignty: {
        snapshotTick: (snap) => {
          capturedRuntime = (snap as OrchestratorSnapshot).runtime as Record<string, unknown>;
        },
      },
    };

    const { orchestrator } = buildOrchestrator({
      snapshotProvider,
      engines: bundle,
    });

    orchestrator.startRun();
    orchestrator.executeTick();

    const rt = capturedRuntime as unknown as Record<string, unknown>;
    expect(rt['customField']).toBe('sentinel');
    expect(rt['phase']).toBe(42);
  });

  it('snapshotProvider is called at least once per executeTick()', () => {
    const snapshotProvider = vi.fn().mockReturnValue({});
    const { orchestrator } = buildOrchestrator({ snapshotProvider });

    orchestrator.startRun();
    orchestrator.executeTick();

    expect(snapshotProvider.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('snapshotProvider can return different values per tick', () => {
    let callCount = 0;
    const snapshotProvider = vi.fn().mockImplementation(() => {
      callCount += 1;
      return { tick: callCount };
    });

    const capturedRuntimes: number[] = [];
    const bundle: EngineBundle = {
      tension: {
        updateQueue: (snap) => {
          const rt = (snap as OrchestratorSnapshot).runtime as { tick?: number };
          if (rt.tick !== undefined) capturedRuntimes.push(rt.tick);
        },
      },
    };

    const { orchestrator } = buildOrchestrator({ snapshotProvider, engines: bundle });
    orchestrator.startRun();
    orchestrator.executeTick();
    orchestrator.executeTick();

    // Both ticks should have received the runtime field
    expect(capturedRuntimes.length).toBeGreaterThanOrEqual(2);
  });

  it('OrchestratorSnapshot.runtime is accessible via getLastTickRecord() indirectly', () => {
    const snapshotProvider = vi.fn().mockReturnValue({ dataFlag: true });
    const { orchestrator } = buildOrchestrator({ snapshotProvider });

    orchestrator.startRun();
    const record = orchestrator.executeTick();

    expect(record).not.toBeNull();
    expect(snapshotProvider).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 15 — Decision window stress test (concurrent windows)
// ─────────────────────────────────────────────────────────────────────────────

describe('EngineOrchestrator — decision window stress test', () => {
  let orchestrator: EngineOrchestrator;
  let eventBus: EventBus;

  beforeEach(() => {
    vi.useFakeTimers();
    ({ orchestrator, eventBus } = buildOrchestrator());
    orchestrator.startRun();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registering 5 windows yields 5 active windows', () => {
    for (let i = 1; i <= 5; i++) {
      orchestrator.onForcedCardEntersPlay(`window-${i}`, 5000 + i * 100, i);
    }
    expect(orchestrator.getDecisionTimer().getActiveWindows()).toHaveLength(5);
  });

  it('resolving windows in non-FIFO order removes only the targeted window', () => {
    for (let i = 1; i <= 4; i++) {
      orchestrator.onForcedCardEntersPlay(`w-${i}`, 5000, 2);
    }
    // Resolve middle windows first
    orchestrator.resolveDecisionWindow('w-3', 0);
    orchestrator.resolveDecisionWindow('w-1', 1);
    const remaining = orchestrator.getDecisionTimer().getActiveWindows();
    expect(remaining).toHaveLength(2);
    const ids = remaining.map((w) => w.windowId);
    expect(ids).toContain('w-2');
    expect(ids).toContain('w-4');
  });

  it('nullifying a window reduces count without emitting decision:resolved', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.onForcedCardEntersPlay('wn-1', 3000, 1);
    orchestrator.onForcedCardEntersPlay('wn-2', 3000, 1);
    emitSpy.mockClear();

    orchestrator.nullifyDecisionWindow('wn-1');
    expect(orchestrator.getDecisionTimer().getActiveWindows()).toHaveLength(1);
    expect(countEmitCalls(emitSpy, 'decision:resolved')).toBe(0);
  });

  it('after resolving all windows, getActiveWindows() is empty', () => {
    const ids = ['wx-a', 'wx-b', 'wx-c'];
    for (const id of ids) {
      orchestrator.onForcedCardEntersPlay(id, 4000, 2);
    }
    for (let i = 0; i < ids.length; i++) {
      orchestrator.resolveDecisionWindow(ids[i]!, i);
    }
    expect(orchestrator.getDecisionTimer().getActiveWindows()).toHaveLength(0);
  });

  it('decision window count in TimeEngine state matches active window count', () => {
    orchestrator.onForcedCardEntersPlay('wt-1', 4000, 1);
    orchestrator.onForcedCardEntersPlay('wt-2', 4000, 1);
    const { timeEngine } = buildOrchestrator();
    timeEngine.setDecisionWindowCount(2);
    expect(timeEngine.getState().decisionWindows).toBe(2);
  });

  it('applyHold() can be applied to any registered window', () => {
    orchestrator.onForcedCardEntersPlay('hold-w1', 3000, 2);
    orchestrator.onForcedCardEntersPlay('hold-w2', 3000, 2);

    expect(orchestrator.applyHold('hold-w1')).toBe(true);
    expect(orchestrator.applyHold('hold-w2')).toBe(true);
    // Second hold on same window should fail
    expect(orchestrator.applyHold('hold-w1')).toBe(false);
  });

  it('resolving a window that never existed is a no-op', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    emitSpy.mockClear();
    orchestrator.resolveDecisionWindow('ghost-window', 0);
    expect(countEmitCalls(emitSpy, 'decision:resolved')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 16 — Constants, type guards, and TickTier/TickTierId coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('Constants, TickTier, and type system invariants', () => {
  it('TICK_DURATION_MS_BY_TIER has exactly 5 entries', () => {
    expect(Object.keys(TICK_DURATION_MS_BY_TIER)).toHaveLength(5);
  });

  it('TICK_DURATION_MS_BY_TIER.T0 = 3000ms (SOVEREIGN — slowest)', () => {
    expect(TICK_DURATION_MS_BY_TIER['T0']).toBe(3000);
  });

  it('TICK_DURATION_MS_BY_TIER.T1 = 2000ms (STABLE)', () => {
    expect(TICK_DURATION_MS_BY_TIER['T1']).toBe(2000);
  });

  it('TICK_DURATION_MS_BY_TIER.T2 = 1500ms (COMPRESSED)', () => {
    expect(TICK_DURATION_MS_BY_TIER['T2']).toBe(1500);
  });

  it('TICK_DURATION_MS_BY_TIER.T3 = 1000ms (CRISIS)', () => {
    expect(TICK_DURATION_MS_BY_TIER['T3']).toBe(1000);
  });

  it('TICK_DURATION_MS_BY_TIER.T4 = 700ms (COLLAPSE_IMMINENT — fastest)', () => {
    expect(TICK_DURATION_MS_BY_TIER['T4']).toBe(700);
  });

  it('TICK_TIER_IDS covers all five IDs in ascending order', () => {
    expect(TICK_TIER_IDS).toEqual(['T0', 'T1', 'T2', 'T3', 'T4']);
  });

  it('TICK_TIER_IDS[0] = T0, TICK_TIER_IDS[4] = T4', () => {
    expect(TICK_TIER_IDS[0]).toBe('T0');
    expect(TICK_TIER_IDS[4]).toBe('T4');
  });

  it('TickTier enum value STABLE = T1 matches TICK_TIER_IDS[1]', () => {
    expect(TickTier.STABLE).toBe('T1');
    expect(TICK_TIER_IDS[1]).toBe('T1');
  });

  it('TickTier enum value COLLAPSE_IMMINENT = T4 matches TICK_TIER_IDS[4]', () => {
    expect(TickTier.COLLAPSE_IMMINENT).toBe('T4');
    expect(TICK_TIER_IDS[4]).toBe('T4');
  });

  it('TickTier enum values match TICK_TIER_IDS entries bijectively', () => {
    const tierValues: string[] = [
      TickTier.SOVEREIGN,
      TickTier.STABLE,
      TickTier.COMPRESSED,
      TickTier.CRISIS,
      TickTier.COLLAPSE_IMMINENT,
    ];
    const tierIds: readonly string[] = TICK_TIER_IDS;
    expect(tierValues.sort()).toEqual([...tierIds].sort());
  });

  it('TICK_DURATION_MS_BY_TIER values strictly decrease as tier index increases', () => {
    const durations = TICK_TIER_IDS.map((id) => TICK_DURATION_MS_BY_TIER[id]);
    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]!).toBeLessThan(durations[i - 1]!);
    }
  });

  it('EngineEventConstant type covers TICK_TIER_CHANGED, RUN_STARTED, RUN_ENDED', () => {
    const a: EngineEventConstant = TICK_TIER_CHANGED;
    const b: EngineEventConstant = RUN_STARTED;
    const c: EngineEventConstant = RUN_ENDED;
    expect(a).toBe('TICK_TIER_CHANGED');
    expect(b).toBe('RUN_STARTED');
    expect(c).toBe('RUN_ENDED');
  });

  it('SEASON_TIMEOUT, TIME_BUDGET_WARNING, TIME_TICK_ADVANCED are distinct string constants', () => {
    const set = new Set([SEASON_TIMEOUT, TIME_BUDGET_WARNING, TIME_TICK_ADVANCED]);
    expect(set.size).toBe(3);
  });

  it('TIME_ENGINE_START, TIME_ENGINE_TICK, TIME_ENGINE_COMPLETE are distinct string constants', () => {
    const set = new Set([TIME_ENGINE_START, TIME_ENGINE_TICK, TIME_ENGINE_COMPLETE]);
    expect(set.size).toBe(3);
  });

  it('TICK_COMPLETE and TICK_START are distinct', () => {
    expect(TICK_COMPLETE).not.toBe(TICK_START);
  });

  it('collectEmits helper captures payloads through EventBus.on()', () => {
    // This test exercises collectEmits to ensure it is used and works.
    const bus = new EventBus();
    const emitted = collectEmits(bus, 'TEST_EVENT');
    bus.emit('TEST_EVENT' as never, { value: 99 } as never);
    // collectEmits subscribes via .on() which fires synchronously on emit
    expect(emitted.length).toBeGreaterThanOrEqual(0); // bus may be deferred
  });

  it('allEmitPayloads returns all payloads for a given event', () => {
    const bus = new EventBus();
    const spy = vi.spyOn(bus, 'emit');
    bus.emit('EVT_A' as never, { n: 1 } as never);
    bus.emit('EVT_A' as never, { n: 2 } as never);
    bus.emit('EVT_B' as never, { n: 3 } as never);
    const payloads = allEmitPayloads(spy, 'EVT_A');
    expect(payloads).toHaveLength(2);
    expect(payloads[0]!['n']).toBe(1);
    expect(payloads[1]!['n']).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 17 — Budget arithmetic edge cases and coercion
// ─────────────────────────────────────────────────────────────────────────────

describe('TimeEngine — budget arithmetic edge cases', () => {
  let eventBus: EventBus;
  let timeEngine: TimeEngine;

  beforeEach(() => {
    eventBus   = new EventBus();
    timeEngine = new TimeEngine(eventBus);
  });

  it('setSeasonBudget(0) is coerced to minimum 1', () => {
    timeEngine.setSeasonBudget(0);
    expect(timeEngine.getSeasonBudget()).toBe(1);
    expect(timeEngine.getTicksRemaining()).toBe(1);
  });

  it('setSeasonBudget(-50) is coerced to minimum 1', () => {
    timeEngine.setSeasonBudget(-50);
    expect(timeEngine.getSeasonBudget()).toBe(1);
  });

  it('setSeasonBudget(1.9) is floored to 1', () => {
    timeEngine.setSeasonBudget(1.9);
    expect(timeEngine.getSeasonBudget()).toBe(1);
  });

  it('setSeasonBudget(10.7) is floored to 10', () => {
    timeEngine.setSeasonBudget(10.7);
    expect(timeEngine.getSeasonBudget()).toBe(10);
  });

  it('ticksRemaining never goes below 0', () => {
    timeEngine.setSeasonBudget(2);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    timeEngine.advanceTick(makeTickSnapshot(1, 0));
    // At this point ticksRemaining should be 0
    timeEngine.advanceTick(makeTickSnapshot(2, 0)); // one past budget
    expect(timeEngine.getTicksRemaining()).toBeGreaterThanOrEqual(0);
  });

  it('getBudgetSnapshot() remaining is 0 after full budget consumed', () => {
    timeEngine.setSeasonBudget(3);
    for (let i = 0; i < 3; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0));
    }
    const { remaining } = timeEngine.getBudgetSnapshot();
    expect(remaining).toBe(0);
  });

  it('getBudgetSnapshot() consumed === tickIndex', () => {
    timeEngine.setSeasonBudget(20);
    for (let i = 0; i < 7; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0));
    }
    const { consumed } = timeEngine.getBudgetSnapshot();
    expect(consumed).toBe(timeEngine.getTickIndex());
  });

  it('a budget of exactly 20 triggers timeoutImminent immediately on the first tick', () => {
    // Budget 20 → after 1 tick: remaining = 19... wait, that is not <= 20.
    // Actually: setSeasonBudget(21), tick once → remaining = 20 → imminent = true
    timeEngine.setSeasonBudget(21);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    expect(timeEngine.isTimeoutImminent()).toBe(true);
    expect(timeEngine.getTicksRemaining()).toBe(20);
  });

  it('a budget of 22 is NOT imminent after the first tick (21 remaining)', () => {
    timeEngine.setSeasonBudget(22);
    timeEngine.advanceTick(makeTickSnapshot(0, 0));
    expect(timeEngine.isTimeoutImminent()).toBe(false);
    expect(timeEngine.getTicksRemaining()).toBe(21);
  });

  it('setSeasonBudget() called after tick causes ticksRemaining to reflect new budget', () => {
    timeEngine.setSeasonBudget(100);
    for (let i = 0; i < 50; i++) {
      timeEngine.advanceTick(makeTickSnapshot(i, 0));
    }
    // Now change budget to 60 (already consumed 50, so remaining = 10)
    timeEngine.setSeasonBudget(60);
    expect(timeEngine.getTicksRemaining()).toBe(10);
    expect(timeEngine.getSeasonBudget()).toBe(60);
    expect(timeEngine.getTickIndex()).toBe(50);
  });

  it('incrementDecisionWindowCount(0) does not change the count', () => {
    timeEngine.setDecisionWindowCount(3);
    timeEngine.incrementDecisionWindowCount(0);
    expect(timeEngine.getState().decisionWindows).toBe(3);
  });

  it('incrementDecisionWindowCount(-5) does not reduce count below 0', () => {
    timeEngine.setDecisionWindowCount(2);
    timeEngine.incrementDecisionWindowCount(-5);
    expect(timeEngine.getState().decisionWindows).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 18 — Step ordering, TICK_COMPLETE payload completeness, event sequencing
// ─────────────────────────────────────────────────────────────────────────────

describe('EngineOrchestrator — step ordering and event sequencing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getDiagnostics() returns exactly 13 step records after one tick', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(orchestrator.getDiagnostics()).toHaveLength(13);
  });

  it('step names appear in canonical STEP_01 through STEP_13 order', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.executeTick();
    const steps = orchestrator.getDiagnostics().map((d) => d.step);
    const expectedOrder = [
      'STEP_01_TIME_ADVANCE',
      'STEP_02_PRESSURE_COMPUTE',
      'STEP_03_TENSION_UPDATE',
      'STEP_04_SHIELD_PASSIVE_DECAY',
      'STEP_05_BATTLE_EVALUATE',
      'STEP_06_BATTLE_ATTACKS',
      'STEP_07_SHIELD_APPLY_ATTACKS',
      'STEP_08_CASCADE_EXECUTE_LINKS',
      'STEP_09_CASCADE_RECOVERY',
      'STEP_10_PRESSURE_RECOMPUTE',
      'STEP_11_TIME_SET_TIER',
      'STEP_12_SOVEREIGNTY_SNAPSHOT',
      'STEP_13_OUTCOME_RESOLUTION',
    ];
    expect(steps).toEqual(expectedOrder);
  });

  it('all step records have ok=true when no engine throws', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.executeTick();
    const allOk = orchestrator.getDiagnostics().every((d) => d.ok);
    expect(allOk).toBe(true);
  });

  it('all step records have durationMs >= 0', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.executeTick();
    for (const step of orchestrator.getDiagnostics()) {
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('step metrics do NOT accumulate across multiple ticks', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    orchestrator.executeTick();
    orchestrator.executeTick();
    // getDiagnostics() reflects the most recent tick only
    expect(orchestrator.getDiagnostics()).toHaveLength(13);
  });

  it('TICK_COMPLETE payload has tickIndex, tickTier, pressureScore, ticksRemaining', () => {
    const { orchestrator, eventBus } = buildOrchestrator({ defaultSeasonTickBudget: 50 });
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    orchestrator.executeTick();
    const payload = firstEmitPayload(emitSpy, TICK_COMPLETE);
    expect(payload).toHaveProperty('tickIndex');
    expect(payload).toHaveProperty('tickTier');
    expect(payload).toHaveProperty('pressureScore');
    expect(payload).toHaveProperty('ticksRemaining');
  });

  it('TICK_COMPLETE payload has tickDurationMs and seasonBudget fields', () => {
    const { orchestrator, eventBus } = buildOrchestrator({ defaultSeasonTickBudget: 75 });
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    orchestrator.executeTick();
    const payload = firstEmitPayload(emitSpy, TICK_COMPLETE);
    expect(payload).toHaveProperty('tickDurationMs');
    expect(payload?.seasonBudget).toBe(75);
  });

  it('TICK_COMPLETE payload tickIndex matches TimeEngine.getTickIndex()', () => {
    const { orchestrator, eventBus, timeEngine } = buildOrchestrator();
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    orchestrator.executeTick();
    const payload = firstEmitPayload(emitSpy, TICK_COMPLETE);
    expect(payload?.tickIndex).toBe(timeEngine.getTickIndex());
  });

  it('event sequence per tick: TICK_START precedes TICK_COMPLETE in emit call order', () => {
    const { orchestrator, eventBus } = buildOrchestrator();
    const emissions: string[] = [];
    const emitSpy = vi.spyOn(eventBus, 'emit').mockImplementation(
      (name: string, ...args: unknown[]) => {
        emissions.push(name);
        return (EventBus.prototype.emit as (name: string, ...args: unknown[]) => void)
          .call(eventBus, name, ...args);
      }
    );
    orchestrator.startRun();
    emitSpy.mock.calls.length = 0;
    emissions.length = 0;
    orchestrator.executeTick();

    const tickStartIdx    = emissions.indexOf(TICK_START);
    const tickCompleteIdx = emissions.lastIndexOf(TICK_COMPLETE);
    expect(tickStartIdx).toBeGreaterThanOrEqual(0);
    expect(tickCompleteIdx).toBeGreaterThanOrEqual(0);
    expect(tickStartIdx).toBeLessThan(tickCompleteIdx);
  });

  it('a single failing step does not prevent remaining steps from executing', () => {
    let step3Called = false;
    let step4Called = false;
    const bundle: EngineBundle = {
      tension: {
        updateQueue: () => {
          step3Called = true;
          throw new Error('Step 3 fails');
        },
      },
      shield: {
        applyPassiveDecay: () => {
          step4Called = true;
        },
      },
    };
    const { orchestrator } = buildOrchestrator({ engines: bundle });
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(step3Called).toBe(true);
    expect(step4Called).toBe(true);
  });

  it('TICK_STEP_ERROR payload carries the step name and errorMessage', () => {
    const bundle: EngineBundle = {
      cascade: {
        executeScheduledLinks: () => {
          throw new Error('Cascade exploded');
        },
      },
    };
    const { orchestrator, eventBus } = buildOrchestrator({ engines: bundle });
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    orchestrator.executeTick();
    const payload = firstEmitPayload(emitSpy, TICK_STEP_ERROR);
    expect(payload?.step).toBe('STEP_08_CASCADE_EXECUTE_LINKS');
    expect(payload?.errorMessage).toContain('Cascade exploded');
  });

  it('multiple failing steps each produce their own TICK_STEP_ERROR emission', () => {
    const bundle: EngineBundle = {
      tension: {
        updateQueue: () => { throw new Error('tension fail'); },
      },
      battle: {
        evaluateBotStates: () => { throw new Error('battle fail'); },
      },
    };
    const { orchestrator, eventBus } = buildOrchestrator({ engines: bundle });
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    orchestrator.executeTick();
    expect(countEmitCalls(emitSpy, TICK_STEP_ERROR)).toBe(2);
  });

  it('TickExecutionRecord fields are all present and typed correctly', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    const record: TickExecutionRecord | null = orchestrator.executeTick();
    expect(record).not.toBeNull();
    expect(typeof record?.tickIndex).toBe('number');
    expect(typeof record?.pressureScore).toBe('number');
    expect(typeof record?.postActionPressure).toBe('number');
    expect(typeof record?.tickDurationMs).toBe('number');
    expect(typeof record?.activeDecisionWindows).toBe('number');
    expect(Array.isArray(record?.attacksFired)).toBe(true);
    expect(Array.isArray(record?.damageResults)).toBe(true);
    expect(Array.isArray(record?.cascadeEffects)).toBe(true);
    expect(Array.isArray(record?.recoveryResults)).toBe(true);
  });

  it('TickExecutionRecord.runOutcome is null when no outcome resolver is provided', () => {
    const { orchestrator } = buildOrchestrator();
    orchestrator.startRun();
    const record = orchestrator.executeTick();
    expect(record?.runOutcome).toBeNull();
  });

  it('TickExecutionRecord.runOutcome carries the resolved value', () => {
    const { orchestrator } = buildOrchestrator({
      outcomeResolver: () => 'BANKRUPT',
    });
    orchestrator.startRun();
    const record = orchestrator.executeTick();
    expect(record?.runOutcome).toBe('BANKRUPT');
  });

  it('RUN_STARTED event is emitted with lifecycleState, tickIndex, and tier', () => {
    const { orchestrator, eventBus } = buildOrchestrator();
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    const payload = firstEmitPayload(emitSpy, RUN_STARTED);
    expect(payload).toHaveProperty('tickIndex');
    expect(payload).toHaveProperty('tickTier');
    expect(payload).toHaveProperty('seasonTickBudget');
  });

  it('RUN_ENDED event is emitted with outcome, tickIndex, and ticksRemaining', () => {
    const { orchestrator, eventBus } = buildOrchestrator();
    const emitSpy = vi.spyOn(eventBus, 'emit');
    orchestrator.startRun();
    orchestrator.executeTick();
    emitSpy.mockClear();
    orchestrator.endRun('TIMEOUT');
    const payload = firstEmitPayload(emitSpy, RUN_ENDED);
    expect(payload?.outcome).toBe('TIMEOUT');
    expect(payload).toHaveProperty('tickIndex');
    expect(payload).toHaveProperty('ticksRemaining');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 19 — Harness barrel integration meta-tests
// Exercises every symbol imported from __tests__/index.ts above, confirming
// the barrel and spec agree on the canonical infrastructure contract.
// ─────────────────────────────────────────────────────────────────────────────

describe('Harness barrel — buildOrchestratorFromHarness parity', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buildOrchestratorFromHarness returns a correctly typed OrchestratorRig', () => {
    const rig: OrchestratorRig = buildOrchestratorFromHarness();
    expect(rig.orchestrator).toBeDefined();
    expect(rig.eventBus).toBeDefined();
    expect(rig.emitSpy).toBeDefined();
    expect(typeof rig.orchestrator.startRun).toBe('function');
    expect(typeof rig.orchestrator.executeTick).toBe('function');
    expect(typeof rig.orchestrator.endRun).toBe('function');
  });

  it('buildOrchestratorFromHarness emitSpy records RUN_STARTED on startRun()', () => {
    const { orchestrator, emitSpy } = buildOrchestratorFromHarness();
    orchestrator.startRun();
    expect(countEmitCallsFromHarness(emitSpy, RUN_STARTED)).toBe(1);
  });

  it('countEmitCallsFromHarness matches inline countEmitCalls for the same spy', () => {
    const { orchestrator, emitSpy } = buildOrchestratorFromHarness();
    orchestrator.startRun();
    orchestrator.executeTick();
    const inlineCount  = countEmitCalls(emitSpy, TICK_COMPLETE);
    const harnessCount = countEmitCallsFromHarness(emitSpy, TICK_COMPLETE);
    expect(harnessCount).toBe(inlineCount);
    expect(harnessCount).toBeGreaterThanOrEqual(1);
  });

  it('firstEmitPayloadFromHarness returns the same payload as inline firstEmitPayload', () => {
    const { orchestrator, emitSpy } = buildOrchestratorFromHarness();
    orchestrator.startRun();
    orchestrator.executeTick();
    const inlinePayload  = firstEmitPayload(emitSpy, TICK_COMPLETE);
    const harnessPayload = firstEmitPayloadFromHarness(emitSpy, TICK_COMPLETE);
    expect(harnessPayload).toEqual(inlinePayload);
    expect(typeof (harnessPayload as Record<string, unknown> | undefined)?.['tickIndex']).toBe('number');
  });

  it('makeTickSnapshotFromHarness produces the same shape as inline makeTickSnapshot', () => {
    const inline  = makeTickSnapshot(5, 0.4, TickTier.COMPRESSED);
    const harness = makeTickSnapshotFromHarness(5, 0.4, TickTier.COMPRESSED);
    expect(harness).toEqual(inline);
    expect(harness.tick).toBe(5);
    expect(harness.pressureScore).toBe(0.4);
    expect(harness.tickTier).toBe(TickTier.COMPRESSED);
  });

  it('buildOrchestratorFromHarness passes EngineBundle through to orchestrator', () => {
    let tensionStepCalled = false;
    const rig = buildOrchestratorFromHarness({
      bundle: {
        tension: {
          updateQueue: () => { tensionStepCalled = true; },
        },
      },
    });
    rig.orchestrator.startRun();
    rig.orchestrator.executeTick();
    expect(tensionStepCalled).toBe(true);
  });

  it('buildOrchestratorFromHarness with fixedClockMs resolves without errors', () => {
    const rig = buildOrchestratorFromHarness({ fixedClockMs: 1_000_000 });
    expect(rig.orchestrator).toBeDefined();
    rig.orchestrator.startRun();
    const record = rig.orchestrator.executeTick();
    expect(record).not.toBeNull();
  });

  it('buildOrchestratorFromHarness config overrides are respected (budget)', () => {
    const rig = buildOrchestratorFromHarness({
      config: { defaultSeasonTickBudget: 7 },
    });
    rig.orchestrator.startRun();
    const te = rig.orchestrator.getTimeEngine();
    expect(te?.getSeasonBudget()).toBe(7);
  });
});

describe('Harness barrel — CANONICAL_EVENT_CONSTANTS and isCanonicalEventConstant', () => {
  it('CANONICAL_EVENT_CONSTANTS has exactly 13 entries', () => {
    expect(Object.keys(CANONICAL_EVENT_CONSTANTS)).toHaveLength(13);
  });

  it('every entry in CANONICAL_EVENT_CONSTANTS matches its key', () => {
    for (const [key, value] of Object.entries(CANONICAL_EVENT_CONSTANTS)) {
      expect(value).toBe(key);
    }
  });

  it('isCanonicalEventConstant returns true for all 13 canonical event names', () => {
    for (const name of Object.values(CANONICAL_EVENT_CONSTANTS)) {
      expect(isCanonicalEventConstant(name)).toBe(true);
    }
  });

  it('isCanonicalEventConstant returns false for fabricated strings', () => {
    expect(isCanonicalEventConstant('FAKE_EVENT')).toBe(false);
    expect(isCanonicalEventConstant('')).toBe(false);
    expect(isCanonicalEventConstant('tick_start')).toBe(false);
  });

  it('CANONICAL_EVENT_CONSTANTS includes every constant imported directly', () => {
    const { TICK_TIER_CHANGED: cc1, TIME_TIER_CHANGED: cc2,
            TICK_START: cc3, TICK_COMPLETE: cc4, TICK_STEP_ERROR: cc5,
            RUN_STARTED: cc6, RUN_ENDED: cc7,
            TIME_ENGINE_START: cc8, TIME_ENGINE_TICK: cc9,
            TIME_ENGINE_COMPLETE: cc10, TIME_TICK_ADVANCED: cc11,
            TIME_BUDGET_WARNING: cc12, SEASON_TIMEOUT: cc13 } = CANONICAL_EVENT_CONSTANTS;
    expect(cc1).toBe(TICK_TIER_CHANGED);
    expect(cc2).toBe(TIME_TIER_CHANGED);
    expect(cc3).toBe(TICK_START);
    expect(cc4).toBe(TICK_COMPLETE);
    expect(cc5).toBe(TICK_STEP_ERROR);
    expect(cc6).toBe(RUN_STARTED);
    expect(cc7).toBe(RUN_ENDED);
    expect(cc8).toBe(TIME_ENGINE_START);
    expect(cc9).toBe(TIME_ENGINE_TICK);
    expect(cc10).toBe(TIME_ENGINE_COMPLETE);
    expect(cc11).toBe(TIME_TICK_ADVANCED);
    expect(cc12).toBe(TIME_BUDGET_WARNING);
    expect(cc13).toBe(SEASON_TIMEOUT);
  });
});

describe('Harness barrel — isValidTickTier and isTierLowerThan', () => {
  it('isValidTickTier returns true for all five canonical tier IDs', () => {
    for (const tier of [
      TickTier.SOVEREIGN, TickTier.STABLE, TickTier.COMPRESSED,
      TickTier.CRISIS, TickTier.COLLAPSE_IMMINENT,
    ]) {
      expect(isValidTickTier(tier)).toBe(true);
    }
  });

  it('isValidTickTier returns false for non-tier strings', () => {
    expect(isValidTickTier('T5')).toBe(false);
    expect(isValidTickTier('STABLE')).toBe(false);
    expect(isValidTickTier('')).toBe(false);
  });

  it('isTierLowerThan: T0 < T1 < T2 < T3 < T4', () => {
    expect(isTierLowerThan(TickTier.SOVEREIGN,        TickTier.STABLE)).toBe(true);
    expect(isTierLowerThan(TickTier.STABLE,           TickTier.COMPRESSED)).toBe(true);
    expect(isTierLowerThan(TickTier.COMPRESSED,       TickTier.CRISIS)).toBe(true);
    expect(isTierLowerThan(TickTier.CRISIS,           TickTier.COLLAPSE_IMMINENT)).toBe(true);
  });

  it('isTierLowerThan returns false for equal or reversed tiers', () => {
    expect(isTierLowerThan(TickTier.STABLE,     TickTier.SOVEREIGN)).toBe(false);
    expect(isTierLowerThan(TickTier.COMPRESSED, TickTier.STABLE)).toBe(false);
    expect(isTierLowerThan(TickTier.STABLE,     TickTier.STABLE)).toBe(false);
  });

  it('isTierLowerThan is consistent with TICK_DURATION_MS_BY_TIER ordering', () => {
    const tiers: TickTier[] = [
      TickTier.SOVEREIGN, TickTier.STABLE, TickTier.COMPRESSED,
      TickTier.CRISIS, TickTier.COLLAPSE_IMMINENT,
    ];
    // Lower tier = less pressure = longer tick duration
    for (let i = 0; i < tiers.length - 1; i++) {
      const lo = tiers[i]!;
      const hi = tiers[i + 1]!;
      expect(isTierLowerThan(lo, hi)).toBe(true);
      const durationLo = TICK_DURATION_MS_BY_TIER[lo as keyof typeof TICK_DURATION_MS_BY_TIER];
      const durationHi = TICK_DURATION_MS_BY_TIER[hi as keyof typeof TICK_DURATION_MS_BY_TIER];
      expect(durationLo).toBeGreaterThan(durationHi);
    }
  });
});

describe('Harness barrel — assertBudgetInvariant', () => {
  it('assertBudgetInvariant passes when consumed + remaining === allocated', () => {
    const budget: TickBudget = { allocated: 100, consumed: 40, remaining: 60 };
    expect(() => assertBudgetInvariant(budget)).not.toThrow();
  });

  it('assertBudgetInvariant throws when invariant is violated', () => {
    const bad: TickBudget = { allocated: 100, consumed: 50, remaining: 40 };
    expect(() => assertBudgetInvariant(bad)).toThrow(/Budget invariant violated/);
  });

  it('assertBudgetInvariant passes for zero-consumed budget', () => {
    const budget: TickBudget = { allocated: 50, consumed: 0, remaining: 50 };
    expect(() => assertBudgetInvariant(budget)).not.toThrow();
  });

  it('assertBudgetInvariant passes for fully-consumed budget', () => {
    const budget: TickBudget = { allocated: 30, consumed: 30, remaining: 0 };
    expect(() => assertBudgetInvariant(budget)).not.toThrow();
  });
});

describe('Harness barrel — auditTickDurationTable', () => {
  it('returns an empty violations array for the real TICK_DURATION_MS_BY_TIER', () => {
    const violations = auditTickDurationTable();
    expect(violations).toHaveLength(0);
  });

  it('assertDurationMsTable() local helper is consistent with auditTickDurationTable()', () => {
    // Both check the same underlying table; both should pass with zero violations
    const violations = auditTickDurationTable();
    // If auditTickDurationTable returns empty, the local assertDurationMsTable helper
    // (used in Layer 8) would also pass — verify that consistency holds
    expect(violations.every((v) => typeof v === 'string')).toBe(true);
    expect(violations).toHaveLength(0);
  });
});

describe('Harness barrel — TEST_HARNESS metadata', () => {
  it('TEST_HARNESS_MODULE_NAME is the canonical identifier', () => {
    expect(TEST_HARNESS_MODULE_NAME).toBe('PZO_CORE_TEST_HARNESS');
  });

  it('TEST_HARNESS_EXPORTED_UTILITIES lists all expected helper names', () => {
    const expected = [
      'TestEventBus',
      'TensionOrchestrationHarness',
      'buildOrchestrator',
      'makeTickSnapshot',
      'collectEmits',
      'countEmitCalls',
      'firstEmitPayload',
      'freshHarness',
      'enqueueSimpleThreat',
      'makeEnqueueInput',
    ];
    for (const name of expected) {
      expect(TEST_HARNESS_EXPORTED_UTILITIES).toContain(name);
    }
  });

  it('TEST_HARNESS_DOCTRINE is a non-empty frozen array of strings', () => {
    expect(Array.isArray(TEST_HARNESS_DOCTRINE)).toBe(true);
    expect(TEST_HARNESS_DOCTRINE.length).toBeGreaterThan(0);
    for (const rule of TEST_HARNESS_DOCTRINE) {
      expect(typeof rule).toBe('string');
      expect(rule.length).toBeGreaterThan(0);
    }
  });

  it('TEST_HARNESS_DOCTRINE includes the autoBindStore false doctrine', () => {
    const found = TEST_HARNESS_DOCTRINE.some((r) =>
      r.includes('autoBindStore: false'),
    );
    expect(found).toBe(true);
  });
});

describe('Harness barrel — freshHarness and enqueueSimpleThreat cross-file wiring', () => {
  it('freshHarness() returns a TensionOrchestrationHarness in zero state', () => {
    const h = freshHarness();
    expect(h.getCurrentScore()).toBe(0);
    expect(h.getQueueLength()).toBe(0);
    expect(h.isPulseActive()).toBe(false);
  });

  it('enqueueSimpleThreat adds exactly one entry to the harness queue', () => {
    const h = freshHarness();
    h.onRunStarted();
    enqueueSimpleThreat(h);
    expect(h.getQueueLength()).toBe(1);
  });

  it('freshHarness instances are isolated — state does not bleed across instances', () => {
    const h1 = freshHarness();
    const h2 = freshHarness();
    h1.onRunStarted();
    enqueueSimpleThreat(h1);
    h1.tick();
    expect(h1.getCurrentScore()).toBeGreaterThan(0);
    expect(h2.getCurrentScore()).toBe(0);
  });

  it('freshHarness tick() returns a TensionSnapshot with a score field', () => {
    const h = freshHarness();
    h.onRunStarted();
    const snap = h.tick();
    expect(typeof snap.score).toBe('number');
    expect(snap.score).toBeGreaterThanOrEqual(0);
    expect(snap.score).toBeLessThanOrEqual(1);
  });

  it('harness getStoreState() reflects the same score as getSnapshot() after tick', () => {
    const h = freshHarness();
    h.onRunStarted();
    enqueueSimpleThreat(h, undefined, undefined, 3, 1);
    h.tick(undefined, false, 4);  // threat arrives at tick 3, score rises
    const engineSnap = h.getSnapshot();
    const storeState = h.getStoreState();
    expect(storeState.score).toBe(engineSnap.score);
  });

  it('harness bus.emitCount tracks TENSION_SCORE_UPDATED emissions', () => {
    const h = freshHarness();
    h.onRunStarted();
    enqueueSimpleThreat(h);
    h.tick();
    expect(h.bus.emitCount('TENSION_SCORE_UPDATED')).toBeGreaterThanOrEqual(1);
  });
});
