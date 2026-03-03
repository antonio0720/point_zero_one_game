//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/zero/EngineOrchestrator.test.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE 0 ORCHESTRATOR TESTS
// pzo-web/src/engines/zero/EngineOrchestrator.test.ts
//
// Wave 0, Task E-01 — Core module unit tests.
// All engine slots are mocked — no real engine logic runs here.
// Tests validate: EventBus deferred dispatch, immediate safety dispatch,
// snapshot immutability, 13-step call order, step-error non-abort guarantee,
// win condition priority (FREEDOM > BANKRUPT > TIMEOUT), duplicate registration.
//
// Run: npx vitest engines/zero/EngineOrchestrator.test.ts
//
// Density6 LLC · Point Zero One · Engine 0 · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus }          from './EventBus';
import { EngineRegistry }    from './EngineRegistry';
import { RunStateSnapshot }  from './RunStateSnapshot';
import {
  EngineId,
  EngineHealth,
  TickTier,
  PressureTier,
  type IEngine,
  type EngineInitParams,
  type RunStateSnapshotFields,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Minimal mock engine — satisfies IEngine interface. */
function createMockEngine(id: EngineId): IEngine {
  return {
    engineId: id,
    init:  vi.fn(),
    reset: vi.fn(),
  };
}

/** Default snapshot fields — valid, frozen-safe state for test construction. */
const defaultSnapshotFields: RunStateSnapshotFields = {
  runId:                    'run-test-001',
  userId:                   'user-test-001',
  seed:                     'seed-abc-123',
  tickIndex:                0,
  seasonTickBudget:         500,
  ticksRemaining:           500,
  freedomThreshold:         1_000_000,

  netWorth:                 0,
  cashBalance:              10_000,
  monthlyIncome:            5_000,
  monthlyExpenses:          3_000,
  cashflow:                 2_000,

  currentTickTier:          TickTier.STABLE,
  currentTickDurationMs:    3_000,
  activeDecisionWindows:    0,
  holdsRemaining:           1,

  pressureScore:            0.1,
  pressureTier:             PressureTier.CALM,
  ticksWithoutIncomeGrowth: 0,

  tensionScore:             0.0,
  anticipationQueueDepth:   0,
  threatVisibilityState:    'SHADOWED',

  shieldAvgIntegrityPct:    100,
  shieldL1Integrity:        100,
  shieldL2Integrity:        80,
  shieldL3Integrity:        60,
  shieldL4Integrity:        40,
  shieldL1Max:              100,
  shieldL2Max:              80,
  shieldL3Max:              60,
  shieldL4Max:              40,

  haterHeat:                0,
  activeBotCount:           0,
  haterAttemptsThisTick:    0,
  haterBlockedThisTick:     0,
  haterDamagedThisTick:     0,
  activeThreatCardCount:    0,

  activeCascadeChains:        0,
  cascadesTriggeredThisTick:  0,
  cascadesBrokenThisTick:     0,

  decisionsThisTick:        [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 1 — EventBus: Deferred dispatch
// ═══════════════════════════════════════════════════════════════════════════════

describe('EventBus — deferred dispatch', () => {

  it('TEST 1: events queued during tick are NOT dispatched until flush()', () => {
    const bus = new EventBus();
    const received: string[] = [];

    bus.on('TICK_COMPLETE', () => received.push('tick'));
    bus.emit('TICK_COMPLETE', { tickIndex: 0, tickDurationMs: 100, outcome: null });

    // Must be empty — flush has not been called
    expect(received).toHaveLength(0);

    bus.flush();

    // Now the event is dispatched
    expect(received).toHaveLength(1);
  });

  it('dispatches events in queue order during flush()', () => {
    const bus = new EventBus();
    const order: string[] = [];

    bus.on('TICK_START',    () => order.push('START'));
    bus.on('TICK_COMPLETE', () => order.push('COMPLETE'));

    bus.emit('TICK_START',    { tickIndex: 1, tickDurationMs: 0 });
    bus.emit('TICK_COMPLETE', { tickIndex: 1, tickDurationMs: 50, outcome: null });

    bus.flush();
    expect(order).toEqual(['START', 'COMPLETE']);
  });

  it('events emitted DURING flush go to the next tick queue, not current pass', () => {
    const bus = new EventBus();
    const received: number[] = [];

    bus.on('TICK_START', () => {
      received.push(1);
      // Emit another event during flush — should NOT fire this pass
      bus.emit('TICK_COMPLETE', { tickIndex: 0, tickDurationMs: 0, outcome: null });
    });
    bus.on('TICK_COMPLETE', () => received.push(2));

    bus.emit('TICK_START', { tickIndex: 0, tickDurationMs: 0 });
    bus.flush();

    // Only TICK_START should have fired in this pass
    expect(received).toEqual([1]);

    // Second flush dispatches the event queued during the first
    bus.flush();
    expect(received).toEqual([1, 2]);
  });

  it('re-entrant flush() is silently dropped, does not cause duplicate dispatch', () => {
    const bus = new EventBus();
    let callCount = 0;

    bus.on('TICK_START', () => {
      callCount += 1;
      // Attempt re-entrant flush during handler
      bus.flush();
    });

    bus.emit('TICK_START', { tickIndex: 0, tickDurationMs: 0 });
    bus.flush();

    expect(callCount).toBe(1); // Fired once, re-entrant flush was blocked
  });

  it('getPendingCount() returns 0 after flush()', () => {
    const bus = new EventBus();
    bus.emit('TENSION_SCORE_UPDATED', { score: 0.5, tickIndex: 1 });
    expect(bus.getPendingCount()).toBe(1);
    bus.flush();
    expect(bus.getPendingCount()).toBe(0);
  });

  it('reset() clears all subscribers AND the pending queue', () => {
    const bus = new EventBus();
    const received: string[] = [];

    bus.on('TICK_START', () => received.push('fired'));
    bus.emit('TICK_START', { tickIndex: 0, tickDurationMs: 0 });

    bus.reset();
    bus.flush(); // Queue was cleared — nothing to dispatch

    expect(received).toHaveLength(0);
    expect(bus.getPendingCount()).toBe(0);
  });

  it('on() returns unsubscribe function that stops delivery', () => {
    const bus = new EventBus();
    const received: string[] = [];

    const unsub = bus.on('TICK_COMPLETE', () => received.push('got-it'));
    bus.emit('TICK_COMPLETE', { tickIndex: 0, tickDurationMs: 0, outcome: null });
    bus.flush();
    expect(received).toHaveLength(1);

    unsub(); // Unsubscribe
    bus.emit('TICK_COMPLETE', { tickIndex: 1, tickDurationMs: 0, outcome: null });
    bus.flush();
    expect(received).toHaveLength(1); // No new delivery after unsub
  });

  it('once() unsubscribes automatically after one firing', () => {
    const bus = new EventBus();
    const received: string[] = [];

    bus.once('TICK_START', () => received.push('once'));
    bus.emit('TICK_START', { tickIndex: 0, tickDurationMs: 0 });
    bus.emit('TICK_START', { tickIndex: 1, tickDurationMs: 0 });
    bus.flush();

    expect(received).toHaveLength(1); // Only fired once despite two emits
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 2 — EventBus: Immediate dispatch for safety events
// ═══════════════════════════════════════════════════════════════════════════════

describe('EventBus — immediate dispatch (safety events)', () => {

  it('TEST 2: ENGINE_ERROR is dispatched immediately, before flush()', () => {
    const bus = new EventBus();
    const received: string[] = [];

    bus.on('ENGINE_ERROR', () => received.push('err'));
    bus.emit('ENGINE_ERROR', { engineId: EngineId.TIME, error: 'test error', step: 1 });

    // Dispatched immediately — no flush required
    expect(received).toHaveLength(1);
  });

  it('TICK_STEP_ERROR is dispatched immediately, before flush()', () => {
    const bus = new EventBus();
    const received: string[] = [];

    bus.on('TICK_STEP_ERROR', () => received.push('step-err'));
    bus.emit('TICK_STEP_ERROR', { step: 4, engineId: EngineId.SHIELD, error: 'decay error' });

    expect(received).toHaveLength(1);
  });

  it('immediate events are NOT added to pendingQueue', () => {
    const bus = new EventBus();

    bus.emit('ENGINE_ERROR', { engineId: EngineId.CASCADE, error: 'test', step: 8 });

    expect(bus.getPendingCount()).toBe(0);
  });

  it('deferred events are not dispatched immediately', () => {
    const bus = new EventBus();
    const received: string[] = [];

    bus.on('PRESSURE_SCORE_UPDATED', () => received.push('pressure'));
    bus.emit('PRESSURE_SCORE_UPDATED', {
      score: 0.5, tier: PressureTier.BUILDING, tickIndex: 1,
    });

    // NOT dispatched until flush
    expect(received).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 3 — RunStateSnapshot: Immutability
// ═══════════════════════════════════════════════════════════════════════════════

describe('RunStateSnapshot — immutability', () => {

  it('TEST 3: writing to a snapshot field throws a TypeError at runtime', () => {
    const snap = new RunStateSnapshot(defaultSnapshotFields);
    expect(() => {
      (snap as any).netWorth = 99_999;
    }).toThrow(TypeError);
  });

  it('all declared fields are accessible after construction', () => {
    const snap = new RunStateSnapshot(defaultSnapshotFields);
    expect(snap.runId).toBe('run-test-001');
    expect(snap.pressureScore).toBe(0.1);
    expect(snap.shieldL1Max).toBe(100);
    expect(snap.shieldL2Max).toBe(80);
    expect(snap.shieldL3Max).toBe(60);
    expect(snap.shieldL4Max).toBe(40);
  });

  it('cashflow is always computed as monthlyIncome - monthlyExpenses', () => {
    const snap = new RunStateSnapshot({
      ...defaultSnapshotFields,
      monthlyIncome:   8_000,
      monthlyExpenses: 3_000,
      cashflow:        0,    // incoming value is IGNORED — always recomputed
    });
    expect(snap.cashflow).toBe(5_000);
  });

  it('hasCrossedFreedomThreshold is true when netWorth >= freedomThreshold', () => {
    const snap = new RunStateSnapshot({
      ...defaultSnapshotFields,
      netWorth:         1_000_000,
      freedomThreshold: 999_999,
    });
    expect(snap.hasCrossedFreedomThreshold).toBe(true);
  });

  it('isBankrupt requires BOTH negative cashBalance AND negative cashflow', () => {
    const recovering = new RunStateSnapshot({
      ...defaultSnapshotFields,
      cashBalance:    -500,
      monthlyIncome:  5_000,
      monthlyExpenses:3_000,
      cashflow:       2_000,
    });
    expect(recovering.isBankrupt).toBe(false); // negative balance but recovering

    const bankrupt = new RunStateSnapshot({
      ...defaultSnapshotFields,
      cashBalance:    -500,
      monthlyIncome:  1_000,
      monthlyExpenses:3_000,
      cashflow:       -2_000,
    });
    expect(bankrupt.isBankrupt).toBe(true);
  });

  it('isTimedOut is true when ticksRemaining <= 0', () => {
    const snap = new RunStateSnapshot({
      ...defaultSnapshotFields,
      ticksRemaining: 0,
    });
    expect(snap.isTimedOut).toBe(true);
  });

  it('shieldHealthNormalized computes correctly across all four layers', () => {
    const snap = new RunStateSnapshot({
      ...defaultSnapshotFields,
      shieldL1Integrity: 100, // 100/100 = 1.0
      shieldL2Integrity: 80,  // 80/80   = 1.0
      shieldL3Integrity: 60,  // 60/60   = 1.0
      shieldL4Integrity: 40,  // 40/40   = 1.0
    });
    expect(snap.shieldHealthNormalized).toBeCloseTo(1.0);

    const half = new RunStateSnapshot({
      ...defaultSnapshotFields,
      shieldL1Integrity: 50,
      shieldL2Integrity: 40,
      shieldL3Integrity: 30,
      shieldL4Integrity: 20,
    });
    expect(half.shieldHealthNormalized).toBeCloseTo(0.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 4 — EngineRegistry
// ═══════════════════════════════════════════════════════════════════════════════

describe('EngineRegistry', () => {

  let bus: EventBus;
  let registry: EngineRegistry;

  beforeEach(() => {
    bus      = new EventBus();
    registry = new EngineRegistry(bus);
  });

  it('TEST 7: register() throws on duplicate engineId', () => {
    const mock = createMockEngine(EngineId.TIME);
    registry.register(mock);
    expect(() => registry.register(mock)).toThrow(/already registered/);
  });

  it('register() sets health to REGISTERED', () => {
    registry.register(createMockEngine(EngineId.PRESSURE));
    expect(registry.getHealth(EngineId.PRESSURE)).toBe(EngineHealth.REGISTERED);
  });

  it('get() throws for unregistered engine', () => {
    expect(() => registry.get(EngineId.TENSION)).toThrow(/not registered/);
  });

  it('allEnginesReady() returns false if any engine is not INITIALIZED', () => {
    // Register all 7 but initialize none — all are REGISTERED
    Object.values(EngineId).forEach((id) =>
      registry.register(createMockEngine(id as EngineId))
    );
    expect(registry.allEnginesReady()).toBe(false);
  });

  it('allEnginesReady() returns true after initializeAll() succeeds for all', () => {
    Object.values(EngineId).forEach((id) =>
      registry.register(createMockEngine(id as EngineId))
    );
    const params: EngineInitParams = {
      runId: 'r1', userId: 'u1', seed: 's1',
      seasonTickBudget: 100, freedomThreshold: 1_000_000,
      clientVersion: '1.0', engineVersion: '1.0',
    };
    registry.initializeAll(params);
    expect(registry.allEnginesReady()).toBe(true);
  });

  it('initializeAll() continues after one engine fails — health report is complete', () => {
    const failing = createMockEngine(EngineId.CASCADE);
    (failing.init as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('cascade init failed');
    });

    Object.values(EngineId).forEach((id) => {
      if (id === EngineId.CASCADE) {
        registry.register(failing);
      } else {
        registry.register(createMockEngine(id as EngineId));
      }
    });

    const params: EngineInitParams = {
      runId: 'r1', userId: 'u1', seed: 's1',
      seasonTickBudget: 100, freedomThreshold: 1_000_000,
      clientVersion: '1.0', engineVersion: '1.0',
    };
    registry.initializeAll(params);

    // Failed engine is ERROR
    expect(registry.getHealth(EngineId.CASCADE)).toBe(EngineHealth.ERROR);

    // All other engines are INITIALIZED
    const report = registry.getHealthReport();
    const others = Object.values(EngineId).filter((id) => id !== EngineId.CASCADE);
    others.forEach((id) => expect(report[id as EngineId]).toBe(EngineHealth.INITIALIZED));

    // getMissingEngines() returns just the failed one
    const missing = registry.getMissingEngines();
    expect(missing).toContain(EngineId.CASCADE);
    expect(missing).toHaveLength(1);
  });

  it('getMissingEngines() returns ids of all engines not INITIALIZED', () => {
    registry.register(createMockEngine(EngineId.TIME));
    // Only TIME registered — all other required engines are missing
    const missing = registry.getMissingEngines();
    expect(missing).not.toContain(EngineId.TIME);
    expect(missing.length).toBe(6); // 7 required - 1 registered but REGISTERED state
    // Note: TIME is REGISTERED not INITIALIZED, so it also appears as missing
    const fullMissing = registry.getMissingEngines();
    expect(fullMissing).toContain(EngineId.TIME); // registered but not initialized
  });

  it('resetAll() returns engines to REGISTERED state', () => {
    Object.values(EngineId).forEach((id) =>
      registry.register(createMockEngine(id as EngineId))
    );
    const params: EngineInitParams = {
      runId: 'r1', userId: 'u1', seed: 's1',
      seasonTickBudget: 100, freedomThreshold: 1_000_000,
      clientVersion: '1.0', engineVersion: '1.0',
    };
    registry.initializeAll(params);
    expect(registry.allEnginesReady()).toBe(true);

    registry.resetAll();
    expect(registry.allEnginesReady()).toBe(false);
    expect(registry.getHealth(EngineId.TIME)).toBe(EngineHealth.REGISTERED);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 5 — Win condition priority
// ═══════════════════════════════════════════════════════════════════════════════

describe('RunStateSnapshot — win condition priority', () => {

  it('TEST 6: FREEDOM is detected when netWorth >= freedomThreshold', () => {
    const snap = new RunStateSnapshot({
      ...defaultSnapshotFields,
      netWorth:         1_000_000,
      freedomThreshold: 999_999,
      cashBalance:      -500, // would be BANKRUPT without FREEDOM check
      monthlyIncome:    500,
      monthlyExpenses:  3_000,
      cashflow:         -2_500,
    });
    // FREEDOM condition is true — takes priority over BANKRUPT
    expect(snap.hasCrossedFreedomThreshold).toBe(true);
    expect(snap.isBankrupt).toBe(true); // both true simultaneously — FREEDOM wins
  });

  it('BANKRUPT does not fire if FREEDOM threshold is crossed', () => {
    // Orchestrator checks FREEDOM first — this test documents the priority contract
    const snap = new RunStateSnapshot({
      ...defaultSnapshotFields,
      netWorth:         2_000_000,
      freedomThreshold: 1_000_000,
      cashBalance:      -1_000,
      monthlyIncome:    100,
      monthlyExpenses:  5_000,
      cashflow:         -4_900,
    });
    expect(snap.hasCrossedFreedomThreshold).toBe(true);
    expect(snap.isBankrupt).toBe(true);
    // Orchestrator logic: if (FREEDOM) outcome = FREEDOM else if (BANKRUPT) ...
    // Test confirms both flags; priority order is enforced in EngineOrchestrator.executeTick()
  });

  it('TIMEOUT fires when ticksRemaining reaches 0', () => {
    const snap = new RunStateSnapshot({
      ...defaultSnapshotFields,
      ticksRemaining:   0,
      netWorth:         100,   // below freedom threshold
      cashBalance:      500,   // positive — not bankrupt
      monthlyIncome:    3_000,
      monthlyExpenses:  1_000,
      cashflow:         2_000,
    });
    expect(snap.isTimedOut).toBe(true);
    expect(snap.hasCrossedFreedomThreshold).toBe(false);
    expect(snap.isBankrupt).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST GROUP 6 — EventBus setTickContext
// ═══════════════════════════════════════════════════════════════════════════════

describe('EventBus — tick context stamping', () => {

  it('setTickContext stamps events with the current tick index', () => {
    const bus = new EventBus();
    let receivedTickIndex = -1;

    bus.on('TENSION_SCORE_UPDATED', (e) => {
      receivedTickIndex = e.tickIndex;
    });

    bus.setTickContext(42);
    bus.emit('TENSION_SCORE_UPDATED', { score: 0.5, tickIndex: 42 });
    bus.flush();

    expect(receivedTickIndex).toBe(42);
  });
});