//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/tension/TensionEngine.test.ts

/**
 * FILE: pzo-web/src/engines/tension/TensionEngine.test.ts
 * Complete unit test suite for Engine 3 — Tension Engine.
 * All 4 test groups must pass before the engine is considered complete.
 * No test may be skipped.
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import { AnticipationQueue, EnqueueInput } from './AnticipationQueue';
import { ThreatVisibilityManager } from './ThreatVisibilityManager';
import { TensionDecayController } from './TensionDecayController';
import { TensionEngine } from './TensionEngine';
import {
  ThreatType,
  ThreatSeverity,
  EntryState,
  VisibilityState,
  PressureTier,
  AnticipationEntry,
  TENSION_CONSTANTS,
} from './types';
import type { EventBus } from '../core/EventBus';

// ── Test Helpers ──────────────────────────────────────────────────────────

/** Creates a mock EventBus with jest spies on emit and on. */
function createMockEventBus(): jest.Mocked<EventBus> {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    flush: jest.fn(),
  } as unknown as jest.Mocked<EventBus>;
}

/** Base enqueue input — override individual fields per test. */
const baseEnqueueInput: EnqueueInput = {
  threatId: 'test-threat-id',
  threatType: ThreatType.DEBT_SPIRAL,
  threatSeverity: ThreatSeverity.MODERATE,
  currentTick: 1,
  arrivalTick: 5,
  isCascadeTriggered: false,
  cascadeTriggerEventId: null,
  worstCaseOutcome: 'Lose 500/month income',
  mitigationCardTypes: ['INCOME_SHIELD'],
};

/** Base decay compute input — all zero/empty baseline. */
const emptyDecayInput = {
  activeEntries: [] as AnticipationEntry[],
  expiredEntries: [] as AnticipationEntry[],
  mitigatingEntries: [] as AnticipationEntry[],
  pressureTier: PressureTier.CALM,
  visibilityAwarenessBonus: 0,
  queueIsEmpty: true,
  sovereigntyMilestoneReached: false,
};

/** Creates a mock AnticipationEntry in QUEUED state. */
function mockQueuedEntry(): AnticipationEntry {
  return {
    entryId: `mock-${Math.random()}`,
    threatId: 'mock-threat',
    threatType: ThreatType.DEBT_SPIRAL,
    threatSeverity: ThreatSeverity.MODERATE,
    enqueuedAtTick: 1,
    arrivalTick: 10,
    isCascadeTriggered: false,
    cascadeTriggerEventId: null,
    worstCaseOutcome: 'Test outcome',
    mitigationCardTypes: Object.freeze(['INCOME_SHIELD']),
    baseTensionPerTick: TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
    state: EntryState.QUEUED,
    isArrived: false,
    isMitigated: false,
    isExpired: false,
    isNullified: false,
    mitigatedAtTick: null,
    expiredAtTick: null,
    ticksOverdue: 0,
    decayTicksRemaining: 0,
  };
}

/** Creates a mock AnticipationEntry in ARRIVED state. */
function mockArrivedEntry(): AnticipationEntry {
  return {
    ...mockQueuedEntry(),
    entryId: `mock-arrived-${Math.random()}`,
    arrivalTick: 1,
    state: EntryState.ARRIVED,
    isArrived: true,
  };
}

/** Creates a mock AnticipationEntry in EXPIRED state. */
function mockExpiredEntry(): AnticipationEntry {
  return {
    ...mockQueuedEntry(),
    entryId: `mock-expired-${Math.random()}`,
    state: EntryState.EXPIRED,
    isExpired: true,
    expiredAtTick: 3,
    ticksOverdue: 5,
  };
}

// ══ TEST GROUP 1: AnticipationQueue ════════════════════════════════════════

describe('AnticipationQueue', () => {

  it('enqueue creates entry with correct lifecycle state', () => {
    const q = new AnticipationQueue();
    const entry = q.enqueue({
      threatId: 'threat-1',
      threatType: ThreatType.DEBT_SPIRAL,
      threatSeverity: ThreatSeverity.MODERATE,
      currentTick: 5,
      arrivalTick: 9,
      isCascadeTriggered: false,
      cascadeTriggerEventId: null,
      worstCaseOutcome: 'Lose 500/month income',
      mitigationCardTypes: ['INCOME_SHIELD'],
    });
    expect(entry.state).toBe(EntryState.QUEUED);
    expect(entry.isArrived).toBe(false);
    expect(entry.arrivalTick).toBe(9);
  });

  it('cascade threat always gets at least 1 tick of warning', () => {
    const q = new AnticipationQueue();
    // Cascade arrives 'immediately' (arrivalTick === currentTick — should be pushed forward)
    const entry = q.enqueue({
      ...baseEnqueueInput,
      currentTick: 10,
      arrivalTick: 10,
      isCascadeTriggered: true,
      cascadeTriggerEventId: 'event-abc',
    });
    // Must be pushed to currentTick + 1 = 11
    expect(entry.arrivalTick).toBe(11);
  });

  it('cascade threat arrivalTick respects max(currentTick+1, input.arrivalTick)', () => {
    const q = new AnticipationQueue();
    // arrivalTick already ahead of currentTick+1 — should be left as-is
    const entry = q.enqueue({
      ...baseEnqueueInput,
      currentTick: 5,
      arrivalTick: 9,
      isCascadeTriggered: true,
      cascadeTriggerEventId: 'event-xyz',
    });
    expect(entry.arrivalTick).toBe(9); // 9 > 5+1=6, so 9 wins
  });

  it('processArrivalTick transitions QUEUED to ARRIVED at correct tick', () => {
    const q = new AnticipationQueue();
    q.enqueue({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 4 });

    const result3 = q.processArrivalTick(3);
    expect(result3.newArrivals).toHaveLength(0); // not yet

    const result4 = q.processArrivalTick(4);
    expect(result4.newArrivals).toHaveLength(1); // now
    expect(result4.newArrivals[0].state).toBe(EntryState.ARRIVED);
    expect(result4.newArrivals[0].isArrived).toBe(true);
  });

  it('ARRIVED entry expires after its action window (DEBT_SPIRAL = 2 ticks)', () => {
    const q = new AnticipationQueue();
    q.enqueue({ ...baseEnqueueInput, threatType: ThreatType.DEBT_SPIRAL, currentTick: 1, arrivalTick: 3 });
    q.processArrivalTick(3); // arrives (ticksOverdue = 0)
    q.processArrivalTick(4); // ticksOverdue = 1 (within window of 2)
    q.processArrivalTick(5); // ticksOverdue = 2 (at window edge — still alive)
    const result = q.processArrivalTick(6); // ticksOverdue = 3 > window 2 — EXPIRED
    expect(result.newExpirations).toHaveLength(1);
    expect(result.newExpirations[0].state).toBe(EntryState.EXPIRED);
    expect(result.newExpirations[0].isExpired).toBe(true);
  });

  it('HATER_INJECTION expires the tick after it arrives (0 window)', () => {
    const q = new AnticipationQueue();
    q.enqueue({ ...baseEnqueueInput, threatType: ThreatType.HATER_INJECTION, currentTick: 1, arrivalTick: 3 });

    const result3 = q.processArrivalTick(3);
    expect(result3.newArrivals).toHaveLength(1); // arrives tick 3

    const result4 = q.processArrivalTick(4);
    // ticksOverdue = 1 > actionWindow 0 → EXPIRED
    expect(result4.newExpirations).toHaveLength(1);
    expect(result4.newExpirations[0].state).toBe(EntryState.EXPIRED);
  });

  it('mitigateEntry succeeds only on ARRIVED entries', () => {
    const q = new AnticipationQueue();
    const e = q.enqueue({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 5 });

    expect(q.mitigateEntry(e.entryId, 2)).toBe(false); // still QUEUED
    q.processArrivalTick(5);
    expect(q.mitigateEntry(e.entryId, 5)).toBe(true); // now ARRIVED
    expect(e.state).toBe(EntryState.MITIGATED);
    expect(e.isMitigated).toBe(true);
    expect(e.decayTicksRemaining).toBe(TENSION_CONSTANTS.MITIGATION_DECAY_TICKS);
  });

  it('mitigateEntry returns false for EXPIRED entry', () => {
    const q = new AnticipationQueue();
    const e = q.enqueue({ ...baseEnqueueInput, threatType: ThreatType.HATER_INJECTION, currentTick: 1, arrivalTick: 3 });
    q.processArrivalTick(3); // arrives
    q.processArrivalTick(4); // expires (0 window)
    expect(q.mitigateEntry(e.entryId, 5)).toBe(false); // cannot mitigate expired
  });

  it('nullifyEntry works for both QUEUED and ARRIVED entries', () => {
    const q = new AnticipationQueue();
    const e1 = q.enqueue({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 10 }); // QUEUED
    const e2 = q.enqueue({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 2 });
    q.processArrivalTick(2); // e2 arrives

    expect(q.nullifyEntry(e1.entryId, 1)).toBe(true);
    expect(e1.state).toBe(EntryState.NULLIFIED);

    expect(q.nullifyEntry(e2.entryId, 2)).toBe(true);
    expect(e2.state).toBe(EntryState.NULLIFIED);
  });

  it('getSortedActiveQueue puts ARRIVED before QUEUED', () => {
    const q = new AnticipationQueue();
    const eQueued  = q.enqueue({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 10 });
    const eArrived = q.enqueue({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 2 });
    q.processArrivalTick(2);

    const sorted = q.getSortedActiveQueue();
    expect(sorted[0].entryId).toBe(eArrived.entryId);
    expect(sorted[1].entryId).toBe(eQueued.entryId);
  });

  it('getQueueLength only counts QUEUED + ARRIVED entries', () => {
    const q = new AnticipationQueue();
    q.enqueue({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 5 });
    q.enqueue({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 6 });
    expect(q.getQueueLength()).toBe(2);

    // Mitigate one — should no longer count in active
    q.processArrivalTick(5);
    const id = q.getActiveEntries().find(e => e.state === EntryState.ARRIVED)!.entryId;
    q.mitigateEntry(id, 5);
    expect(q.getQueueLength()).toBe(1); // only the QUEUED one remains
  });

  it('reset clears all entries', () => {
    const q = new AnticipationQueue();
    q.enqueue({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 5 });
    q.enqueue({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 6 });
    q.reset();
    expect(q.getQueueLength()).toBe(0);
    expect(q.getTotalExpiredCount()).toBe(0);
  });
});

// ══ TEST GROUP 2: ThreatVisibilityManager ══════════════════════════════════

describe('ThreatVisibilityManager', () => {

  it('starts at SHADOWED by default', () => {
    const mgr = new ThreatVisibilityManager();
    expect(mgr.getCurrentState()).toBe(VisibilityState.SHADOWED);
    expect(mgr.getPreviousState()).toBeNull();
  });

  it('upgrades immediately to SIGNALED when pressure = BUILDING', () => {
    const mgr = new ThreatVisibilityManager();
    const r = mgr.update(PressureTier.BUILDING, false);
    expect(r.state).toBe(VisibilityState.SIGNALED);
    expect(r.changed).toBe(true);
  });

  it('upgrades immediately to TELEGRAPHED when pressure = ELEVATED', () => {
    const mgr = new ThreatVisibilityManager();
    const r = mgr.update(PressureTier.ELEVATED, false);
    expect(r.state).toBe(VisibilityState.TELEGRAPHED);
    expect(r.changed).toBe(true);
  });

  it('upgrades immediately to TELEGRAPHED when pressure = HIGH', () => {
    const mgr = new ThreatVisibilityManager();
    const r = mgr.update(PressureTier.HIGH, false);
    expect(r.state).toBe(VisibilityState.TELEGRAPHED);
  });

  it('CRITICAL without isNearDeath yields TELEGRAPHED, not EXPOSED', () => {
    const mgr = new ThreatVisibilityManager();
    const r = mgr.update(PressureTier.CRITICAL, false);
    expect(r.state).toBe(VisibilityState.TELEGRAPHED);
  });

  it('EXPOSED requires CRITICAL pressure AND isNearDeath simultaneously', () => {
    const mgr = new ThreatVisibilityManager();
    mgr.update(PressureTier.CRITICAL, false); // TELEGRAPHED
    const r2 = mgr.update(PressureTier.CRITICAL, true); // EXPOSED
    expect(r2.state).toBe(VisibilityState.EXPOSED);
    expect(r2.changed).toBe(true);
  });

  it('downgrade is delayed 2 ticks before applying', () => {
    const mgr = new ThreatVisibilityManager();
    mgr.update(PressureTier.ELEVATED, false); // → TELEGRAPHED

    const r1 = mgr.update(PressureTier.BUILDING, false); // start countdown
    expect(r1.state).toBe(VisibilityState.TELEGRAPHED); // not yet downgraded

    const r2 = mgr.update(PressureTier.BUILDING, false); // countdown at 1
    expect(r2.state).toBe(VisibilityState.TELEGRAPHED); // still delayed

    const r3 = mgr.update(PressureTier.BUILDING, false); // countdown hits 0
    expect(r3.state).toBe(VisibilityState.SIGNALED); // now downgraded
    expect(r3.changed).toBe(true);
  });

  it('upgrade cancels a pending downgrade', () => {
    const mgr = new ThreatVisibilityManager();
    mgr.update(PressureTier.ELEVATED, false); // TELEGRAPHED
    mgr.update(PressureTier.BUILDING, false); // pending downgrade started

    // Pressure spikes back up — upgrade must cancel pending downgrade
    const r = mgr.update(PressureTier.CRITICAL, true); // → EXPOSED
    expect(r.state).toBe(VisibilityState.EXPOSED);
    expect(mgr.getPendingDowngrade()).toBeNull();
    expect(mgr.getDowngradeCountdown()).toBe(0);
  });

  it('returning to same state cancels pending downgrade', () => {
    const mgr = new ThreatVisibilityManager();
    mgr.update(PressureTier.ELEVATED, false); // TELEGRAPHED
    mgr.update(PressureTier.BUILDING, false); // pending downgrade started
    mgr.update(PressureTier.ELEVATED, false); // back to TELEGRAPHED target
    expect(mgr.getPendingDowngrade()).toBeNull();
    expect(mgr.getCurrentState()).toBe(VisibilityState.TELEGRAPHED);
  });

  it('reset returns all state to initial values', () => {
    const mgr = new ThreatVisibilityManager();
    mgr.update(PressureTier.CRITICAL, true); // EXPOSED
    mgr.reset();
    expect(mgr.getCurrentState()).toBe(VisibilityState.SHADOWED);
    expect(mgr.getPreviousState()).toBeNull();
    expect(mgr.getPendingDowngrade()).toBeNull();
    expect(mgr.getDowngradeCountdown()).toBe(0);
  });
});

// ══ TEST GROUP 3: TensionDecayController ═══════════════════════════════════

describe('TensionDecayController', () => {

  it('computes positive delta when threats are queued', () => {
    const ctrl = new TensionDecayController();
    const result = ctrl.computeDelta({
      activeEntries: [mockQueuedEntry(), mockQueuedEntry()], // 2 queued
      expiredEntries: [],
      mitigatingEntries: [],
      pressureTier: PressureTier.CALM,
      visibilityAwarenessBonus: 0,
      queueIsEmpty: false,
      sovereigntyMilestoneReached: false,
    });
    // 2 * 0.12 = 0.24, amplifier 1.0x at CALM
    expect(result.amplifiedDelta).toBeCloseTo(0.24, 2);
    expect(result.contributionBreakdown.queuedThreats).toBeCloseTo(0.24, 2);
  });

  it('ARRIVED threats contribute more than QUEUED threats', () => {
    const ctrl = new TensionDecayController();
    const queuedResult = ctrl.computeDelta({
      ...emptyDecayInput,
      activeEntries: [mockQueuedEntry()],
      queueIsEmpty: false,
    });
    const arrivedResult = ctrl.computeDelta({
      ...emptyDecayInput,
      activeEntries: [mockArrivedEntry()],
      queueIsEmpty: false,
    });
    // 0.20 > 0.12
    expect(arrivedResult.amplifiedDelta).toBeGreaterThan(queuedResult.amplifiedDelta);
  });

  it('pressure amplifier scales ONLY positive contributions', () => {
    const ctrl = new TensionDecayController();
    // At CRITICAL (1.5x): 1 queued * 0.12 * 1.5 = 0.18
    const result = ctrl.computeDelta({
      ...emptyDecayInput,
      activeEntries: [mockQueuedEntry()],
      pressureTier: PressureTier.CRITICAL,
      queueIsEmpty: false,
    });
    expect(result.amplifiedDelta).toBeCloseTo(0.18, 2);
  });

  it('pressure amplifier does NOT slow down recovery (decay unchanged)', () => {
    const ctrl = new TensionDecayController();
    // Empty queue at CALM vs CRITICAL — empty queue bonus should be the same amount
    const calmResult = ctrl.computeDelta({ ...emptyDecayInput, queueIsEmpty: true, pressureTier: PressureTier.CALM });
    const criticalResult = ctrl.computeDelta({ ...emptyDecayInput, queueIsEmpty: true, pressureTier: PressureTier.CRITICAL });
    // Both should decay at same rate (negative part not amplified)
    expect(calmResult.amplifiedDelta).toBeCloseTo(criticalResult.amplifiedDelta, 2);
  });

  it('empty queue bonus produces negative delta', () => {
    const ctrl = new TensionDecayController();
    const result = ctrl.computeDelta({ ...emptyDecayInput, queueIsEmpty: true });
    expect(result.amplifiedDelta).toBeLessThan(0);
    expect(result.contributionBreakdown.emptyQueueBonus).toBeCloseTo(-0.05, 2);
  });

  it('sovereignty bonus fires exactly once per run', () => {
    const ctrl = new TensionDecayController();
    const r1 = ctrl.computeDelta({
      ...emptyDecayInput,
      sovereigntyMilestoneReached: true,
      queueIsEmpty: true,
    });
    const r2 = ctrl.computeDelta({
      ...emptyDecayInput,
      sovereigntyMilestoneReached: true,
      queueIsEmpty: true,
    });
    expect(r1.contributionBreakdown.sovereigntyBonus).toBeCloseTo(-0.15, 2);
    expect(r2.contributionBreakdown.sovereigntyBonus).toBe(0); // consumed — does not fire again
  });

  it('sovereignty bonus resets after reset()', () => {
    const ctrl = new TensionDecayController();
    ctrl.computeDelta({ ...emptyDecayInput, sovereigntyMilestoneReached: true, queueIsEmpty: true });
    ctrl.reset();
    const r = ctrl.computeDelta({ ...emptyDecayInput, sovereigntyMilestoneReached: true, queueIsEmpty: true });
    expect(r.contributionBreakdown.sovereigntyBonus).toBeCloseTo(-0.15, 2);
  });

  it('expired ghost penalty accumulates per expired threat', () => {
    const ctrl = new TensionDecayController();
    const result = ctrl.computeDelta({
      ...emptyDecayInput,
      expiredEntries: [mockExpiredEntry(), mockExpiredEntry(), mockExpiredEntry()],
      queueIsEmpty: true,
    });
    // 3 * 0.08 = 0.24 ghost penalty
    expect(result.contributionBreakdown.expiredGhosts).toBeCloseTo(0.24, 2);
  });

  it('empty queue bonus and mitigation decay apply simultaneously', () => {
    const ctrl = new TensionDecayController();
    const mitigatedEntry = { ...mockQueuedEntry(), state: EntryState.MITIGATED, isMitigated: true, decayTicksRemaining: 2 };
    const result = ctrl.computeDelta({
      ...emptyDecayInput,
      mitigatingEntries: [mitigatedEntry],
      queueIsEmpty: true, // both apply at same time
    });
    // emptyQueueBonus = -0.05, mitigationDecay = -0.08 → amplifiedDelta = -0.13
    expect(result.amplifiedDelta).toBeCloseTo(-0.13, 2);
  });

  it('visibility awareness bonus adds to positive contributions', () => {
    const ctrl = new TensionDecayController();
    const result = ctrl.computeDelta({
      ...emptyDecayInput,
      visibilityAwarenessBonus: 0.05,
      queueIsEmpty: true, // empty queue bonus = -0.05 cancels it out partially
    });
    // +0.05 visibility (amplified at 1.0x CALM) - 0.05 empty = 0
    expect(result.contributionBreakdown.visibilityBonus).toBeCloseTo(0.05, 2);
  });
});

// ══ TEST GROUP 4: TensionEngine Integration ════════════════════════════════

describe('TensionEngine', () => {

  it('enqueueThreat increases queue length', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.enqueueThreat({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 5 });
    expect(engine.getQueueLength()).toBe(1);
  });

  it('enqueueThreat returns a non-empty entryId string', () => {
    const engine = new TensionEngine(createMockEventBus());
    const id = engine.enqueueThreat({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 5 });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('computeTension returns snapshot with correct visibility state', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.enqueueThreat({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 10 });
    const snap = engine.computeTension(PressureTier.BUILDING, false, 2);
    expect(snap.visibilityState).toBe(VisibilityState.SIGNALED);
    expect(snap.queueLength).toBe(1);
  });

  it('isPulseActive becomes true when score reaches 0.90', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.forceScore(0.91);
    const snap = engine.computeTension(PressureTier.CALM, false, 5);
    expect(snap.isPulseActive).toBe(true);
    expect(snap.pulseTicksActive).toBe(1);
  });

  it('isPulseActive is false when score is exactly below threshold (0.8999)', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.forceScore(0.8999);
    const snap = engine.computeTension(PressureTier.CALM, false, 5);
    expect(snap.isPulseActive).toBe(false);
  });

  it('isPulseActive is true when score is exactly at threshold (0.90)', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.forceScore(0.90);
    const snap = engine.computeTension(PressureTier.CALM, false, 5);
    expect(snap.isPulseActive).toBe(true);
  });

  it('emits TENSION_PULSE_FIRED when pulse is active', () => {
    const bus = createMockEventBus();
    const engine = new TensionEngine(bus);
    engine.forceScore(0.95);
    engine.computeTension(PressureTier.CALM, false, 5);
    expect(bus.emit).toHaveBeenCalledWith(
      'TENSION_PULSE_FIRED',
      expect.objectContaining({ eventType: 'TENSION_PULSE_FIRED' })
    );
  });

  it('does NOT emit TENSION_PULSE_FIRED when score is below threshold', () => {
    const bus = createMockEventBus();
    const engine = new TensionEngine(bus);
    engine.forceScore(0.50);
    engine.computeTension(PressureTier.CALM, false, 5);
    expect(bus.emit).not.toHaveBeenCalledWith(
      'TENSION_PULSE_FIRED',
      expect.anything()
    );
  });

  it('pulseTicksActive increments each consecutive tick at threshold', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.forceScore(0.95);
    const s1 = engine.computeTension(PressureTier.CALM, false, 1);
    engine.forceScore(0.95);
    const s2 = engine.computeTension(PressureTier.CALM, false, 2);
    engine.forceScore(0.95);
    const s3 = engine.computeTension(PressureTier.CALM, false, 3);
    expect(s1.pulseTicksActive).toBe(1);
    expect(s2.pulseTicksActive).toBe(2);
    expect(s3.pulseTicksActive).toBe(3);
  });

  it('pulseTicksActive resets to 0 when score drops below threshold', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.forceScore(0.95);
    engine.computeTension(PressureTier.CALM, false, 1); // active
    engine.forceScore(0.50);
    const snap = engine.computeTension(PressureTier.CALM, false, 2); // inactive
    expect(snap.isPulseActive).toBe(false);
    expect(snap.pulseTicksActive).toBe(0);
  });

  it('mitigateThreat returns false for QUEUED entry', () => {
    const engine = new TensionEngine(createMockEventBus());
    const id = engine.enqueueThreat({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 10 });
    expect(engine.mitigateThreat(id, 2)).toBe(false); // not arrived yet
  });

  it('score stays in [0.0, 1.0] always — even with 20 threats at CRITICAL', () => {
    const engine = new TensionEngine(createMockEventBus());
    for (let i = 0; i < 20; i++) {
      engine.enqueueThreat({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 2 });
    }
    for (let tick = 1; tick <= 10; tick++) {
      const snap = engine.computeTension(PressureTier.CRITICAL, true, tick);
      expect(snap.score).toBeGreaterThanOrEqual(0.0);
      expect(snap.score).toBeLessThanOrEqual(1.0);
    }
  });

  it('score does not go negative — even with heavy decay', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.forceScore(0.0);
    for (let tick = 1; tick <= 20; tick++) {
      const snap = engine.computeTension(PressureTier.CALM, false, tick);
      expect(snap.score).toBeGreaterThanOrEqual(0.0);
    }
  });

  it('reset clears queue and resets score to 0', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.enqueueThreat({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 5 });
    engine.forceScore(0.75);
    engine.reset();
    expect(engine.getQueueLength()).toBe(0);
    expect(engine.getCurrentScore()).toBe(0.0);
    expect(engine.isAnticipationPulseActive()).toBe(false);
  });

  it('reset also clears scoreHistory and pulseTicksActive', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.forceScore(0.95);
    engine.computeTension(PressureTier.CALM, false, 1);
    engine.reset();
    const snap = engine.getSnapshot();
    expect(snap.scoreHistory).toHaveLength(0);
    expect(snap.pulseTicksActive).toBe(0);
  });

  it('EXPOSED visibility requires isNearDeath AND CRITICAL pressure', () => {
    const engine = new TensionEngine(createMockEventBus());
    const snap1 = engine.computeTension(PressureTier.CRITICAL, false, 1);
    expect(snap1.visibilityState).not.toBe(VisibilityState.EXPOSED);

    const snap2 = engine.computeTension(PressureTier.CRITICAL, true, 2);
    expect(snap2.visibilityState).toBe(VisibilityState.EXPOSED);
  });

  it('getSnapshot returns empty snapshot before first computeTension call', () => {
    const engine = new TensionEngine(createMockEventBus());
    const snap = engine.getSnapshot();
    expect(snap.score).toBe(0);
    expect(snap.queueLength).toBe(0);
    expect(snap.isPulseActive).toBe(false);
  });

  it('emits TENSION_SCORE_UPDATED every tick', () => {
    const bus = createMockEventBus();
    const engine = new TensionEngine(bus);
    engine.computeTension(PressureTier.CALM, false, 1);
    engine.computeTension(PressureTier.CALM, false, 2);
    const scoreCalls = (bus.emit as jest.Mock).mock.calls.filter(
      call => call[0] === 'TENSION_SCORE_UPDATED'
    );
    expect(scoreCalls.length).toBe(2);
  });

  it('isEscalating is true when score rises 3 consecutive ticks', () => {
    const engine = new TensionEngine(createMockEventBus());
    engine.enqueueThreat({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 2 });
    engine.enqueueThreat({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 2 });
    engine.enqueueThreat({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 2 });
    const s1 = engine.computeTension(PressureTier.CALM, false, 2);
    const s2 = engine.computeTension(PressureTier.CALM, false, 3);
    const s3 = engine.computeTension(PressureTier.CALM, false, 4);
    // Score must be rising each tick for isEscalating to be true
    if (s1.score < s2.score && s2.score < s3.score) {
      expect(s3.isEscalating).toBe(true);
    }
  });

  it('nullifyThreat returns true for QUEUED entry', () => {
    const engine = new TensionEngine(createMockEventBus());
    const id = engine.enqueueThreat({ ...baseEnqueueInput, currentTick: 1, arrivalTick: 10 });
    expect(engine.nullifyThreat(id, 1)).toBe(true);
    expect(engine.getQueueLength()).toBe(0); // nullified not counted as active
  });
});
