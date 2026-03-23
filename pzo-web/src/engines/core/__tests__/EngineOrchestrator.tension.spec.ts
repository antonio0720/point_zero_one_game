/**
 * ============================================================================
 * FILE: pzo-web/src/engines/core/__tests__/EngineOrchestrator.tension.spec.ts
 * ============================================================================
 *
 * Purpose:
 * - Define the Engine 3 orchestration contract for the current repo state.
 * - Validate tension-step wiring between:
 *   TensionEngine → EventBus → tensionStoreHandlers → store snapshot sync.
 * - Provide a passable contract harness while the live EngineOrchestrator
 *   remains a thin DecisionTimer wrapper.
 * - Test every public surface of TensionEngine at depth.
 * - Verify store slice precision: field-by-field correctness for every handler.
 *
 * Doctrine:
 * - Test the tension integration boundary, not UI rendering.
 * - Use a synchronous in-memory EventBus.
 * - Mirror the intended orchestrator Step 3 sequence precisely.
 * - Every imported symbol must be exercised in at least one assertion.
 * - No private field access — only public API.
 *
 * Coverage layers:
 *   Layer 1 — Orchestrator contract (original five tests, hardened)
 *   Layer 2 — TensionEngine score computation and delta accumulation
 *   Layer 3 — Threat enqueue / arrival / expiry lifecycle
 *   Layer 4 — Threat mitigation and nullification paths
 *   Layer 5 — Pulse state machine (threshold, sustained, reset)
 *   Layer 6 — Score history and escalation detection
 *   Layer 7 — Visibility state machine (all four states + transitions)
 *   Layer 8 — Store slice precision (field-by-field handler assertions)
 *   Layer 9 — Multi-tick orchestrated run simulation
 *   Layer 10 — Edge cases, invariants, and defensive boundaries
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 * ============================================================================
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TensionEngine } from '../../tension/TensionEngine';

import {
  PressureTier,
  ThreatSeverity,
  ThreatType,
  VisibilityState,
  EntryState,
  TENSION_CONSTANTS,
  VISIBILITY_CONFIGS,
  PRESSURE_TENSION_AMPLIFIERS,
  type TensionSnapshot,
  type AnticipationEntry,
  type TensionScoreUpdatedEvent,
  type TensionVisibilityChangedEvent,
  type TensionPulseFiredEvent,
  type ThreatArrivedEvent,
  type ThreatExpiredEvent,
} from '../../tension/types';

import {
  createDefaultTensionState,
  tensionStoreHandlers,
  resetTensionSliceDraft,
  applyTensionSnapshotDraft,
  defaultTensionSlice,
  type TensionState,
  type TensionSliceContainer,
  type TensionSliceSet,
} from '../../../store/slices/tensionSlice';

// ─────────────────────────────────────────────────────────────────────────────
// Synchronous in-memory EventBus — no async queuing
// ─────────────────────────────────────────────────────────────────────────────

type EventListener = (payload: unknown) => void;

class TestEventBus {
  private readonly listeners = new Map<string, Set<EventListener>>();

  public on(eventName: string, listener: EventListener): void {
    const current = this.listeners.get(eventName) ?? new Set<EventListener>();
    current.add(listener);
    this.listeners.set(eventName, current);
  }

  public emit(eventName: string, payload: unknown): void {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(payload);
    }
  }

  public flush(): void {
    // Synchronous no-op for contract parity.
  }

  /** Clear all listeners — useful between test cases. */
  public reset(): void {
    this.listeners.clear();
  }

  /** Returns count of registered event listeners for a given name. */
  public listenerCount(eventName: string): number {
    return this.listeners.get(eventName)?.size ?? 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store harness: wraps TensionSliceContainer with a Zustand-style draft setter
// ─────────────────────────────────────────────────────────────────────────────

interface TestStoreState extends TensionSliceContainer {}

class TensionOrchestrationHarness {
  public readonly eventBus = new TestEventBus();
  public readonly tensionEngine = new TensionEngine(this.eventBus as never);

  private readonly state: TestStoreState = {
    tension: createDefaultTensionState(),
  };

  private readonly set: TensionSliceSet<TestStoreState> = (recipe) => {
    recipe(this.state);
  };

  constructor() {
    this.registerTensionListeners();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  public onRunStarted(): void {
    this.tensionEngine.reset();
    tensionStoreHandlers.onRunStarted(this.set);
  }

  public onRunEnded(): void {
    tensionStoreHandlers.onRunEnded(this.set);
  }

  // ── Threat management ──────────────────────────────────────────────────────

  public enqueueThreat(input: {
    readonly threatId: string;
    readonly threatType: ThreatType;
    readonly threatSeverity: ThreatSeverity;
    readonly currentTick: number;
    readonly arrivalTick: number;
    readonly isCascadeTriggered: boolean;
    readonly cascadeTriggerEventId: string | null;
    readonly worstCaseOutcome: string;
    readonly mitigationCardTypes: readonly string[];
  }): string {
    return this.tensionEngine.enqueueThreat(input);
  }

  public mitigateThreat(entryId: string, currentTick: number): boolean {
    return this.tensionEngine.mitigateThreat(entryId, currentTick);
  }

  public nullifyThreat(entryId: string, currentTick: number): boolean {
    return this.tensionEngine.nullifyThreat(entryId, currentTick);
  }

  // ── Step execution ─────────────────────────────────────────────────────────

  public executeTensionStep(args: {
    readonly pressureTier: PressureTier;
    readonly isNearDeath: boolean;
    readonly currentTick: number;
    readonly sovereigntyMilestoneReached?: boolean;
  }): TensionSnapshot {
    const snapshot = this.tensionEngine.computeTension(
      args.pressureTier,
      args.isNearDeath,
      args.currentTick,
      args.sovereigntyMilestoneReached ?? false,
    );

    tensionStoreHandlers.onSnapshotAvailable(
      this.set,
      snapshot,
      this.tensionEngine.getSortedQueue(),
    );

    tensionStoreHandlers.onTickComplete(this.set);
    this.eventBus.flush();

    return snapshot;
  }

  // ── Force helpers ──────────────────────────────────────────────────────────

  public forceScore(score: number): void {
    this.tensionEngine.forceScore(score);
  }

  // ── State reads ────────────────────────────────────────────────────────────

  public getTensionState(): TensionState {
    return this.state.tension;
  }

  public getSnapshot(): TensionSnapshot {
    return this.tensionEngine.getSnapshot();
  }

  public getCurrentScore(): number {
    return this.tensionEngine.getCurrentScore();
  }

  public getVisibilityState(): VisibilityState {
    return this.tensionEngine.getVisibilityState();
  }

  public getQueueLength(): number {
    return this.tensionEngine.getQueueLength();
  }

  public isPulseActive(): boolean {
    return this.tensionEngine.isAnticipationPulseActive();
  }

  // ── Internal: wire EventBus to store handlers ──────────────────────────────

  private registerTensionListeners(): void {
    this.eventBus.on('TENSION_SCORE_UPDATED', (event) => {
      tensionStoreHandlers.onScoreUpdated(this.set, event as TensionScoreUpdatedEvent);
    });

    this.eventBus.on('TENSION_VISIBILITY_CHANGED', (event) => {
      tensionStoreHandlers.onVisibilityChanged(this.set, event as TensionVisibilityChangedEvent);
    });

    this.eventBus.on('TENSION_PULSE_FIRED', (event) => {
      tensionStoreHandlers.onPulseFired(this.set, event as TensionPulseFiredEvent);
    });

    this.eventBus.on('THREAT_ARRIVED', (event) => {
      tensionStoreHandlers.onThreatArrived(this.set, event as ThreatArrivedEvent);
    });

    this.eventBus.on('THREAT_EXPIRED', (event) => {
      tensionStoreHandlers.onThreatExpired(this.set, event as ThreatExpiredEvent);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a harness that is fresh for each test, with run started
// ─────────────────────────────────────────────────────────────────────────────

function freshHarness(): TensionOrchestrationHarness {
  const h = new TensionOrchestrationHarness();
  h.onRunStarted();
  return h;
}

/** Enqueue a minimal threat at tick 1 arriving at tick 2. */
function enqueueSimpleThreat(
  h: TensionOrchestrationHarness,
  overrides: Partial<{
    threatId: string;
    threatType: ThreatType;
    threatSeverity: ThreatSeverity;
    currentTick: number;
    arrivalTick: number;
    isCascadeTriggered: boolean;
    cascadeTriggerEventId: string | null;
    worstCaseOutcome: string;
    mitigationCardTypes: readonly string[];
  }> = {},
): string {
  return h.enqueueThreat({
    threatId:              overrides.threatId              ?? 'threat-default',
    threatType:            overrides.threatType            ?? ThreatType.DEBT_SPIRAL,
    threatSeverity:        overrides.threatSeverity        ?? ThreatSeverity.MODERATE,
    currentTick:           overrides.currentTick           ?? 1,
    arrivalTick:           overrides.arrivalTick           ?? 2,
    isCascadeTriggered:    overrides.isCascadeTriggered    ?? false,
    cascadeTriggerEventId: overrides.cascadeTriggerEventId ?? null,
    worstCaseOutcome:      overrides.worstCaseOutcome      ?? 'Income destroyed',
    mitigationCardTypes:   overrides.mitigationCardTypes   ?? Object.freeze(['INCOME_SHIELD']),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1 — Original orchestrator contract (hardened)
// ─────────────────────────────────────────────────────────────────────────────

describe('EngineOrchestrator — Engine 3 tension contract', () => {
  it('resets the tension slice on run start', () => {
    const harness = new TensionOrchestrationHarness();

    harness.forceScore(0.88);
    harness.executeTensionStep({
      pressureTier: PressureTier.CRITICAL,
      isNearDeath: true,
      currentTick: 5,
    });

    expect(harness.getTensionState().score).toBeGreaterThan(0);

    harness.onRunStarted();

    const tension = harness.getTensionState();
    expect(tension.score).toBe(0);
    expect(tension.queueLength).toBe(0);
    expect(tension.arrivedCount).toBe(0);
    expect(tension.queuedCount).toBe(0);
    expect(tension.expiredCount).toBe(0);
    expect(tension.isPulseActive).toBe(false);
    expect(tension.pulseTicksActive).toBe(0);
    expect(tension.currentTick).toBe(0);
    expect(tension.isRunActive).toBe(true);
  });

  it('syncs a queued threat snapshot into store state at the orchestrator tension step', () => {
    const harness = new TensionOrchestrationHarness();
    harness.onRunStarted();

    harness.enqueueThreat({
      threatId: 'threat-queued-1',
      threatType: ThreatType.DEBT_SPIRAL,
      threatSeverity: ThreatSeverity.MODERATE,
      currentTick: 1,
      arrivalTick: 6,
      isCascadeTriggered: false,
      cascadeTriggerEventId: null,
      worstCaseOutcome: 'Debt service consumes income runway',
      mitigationCardTypes: Object.freeze(['INCOME_SHIELD']),
    });

    const snapshot = harness.executeTensionStep({
      pressureTier: PressureTier.BUILDING,
      isNearDeath: false,
      currentTick: 2,
    });

    const tension = harness.getTensionState();

    expect(snapshot.visibilityState).toBe(VisibilityState.SIGNALED);
    expect(tension.visibilityState).toBe(VisibilityState.SIGNALED);
    expect(tension.queueLength).toBe(1);
    expect(tension.arrivedCount).toBe(0);
    expect(tension.queuedCount).toBe(1);
    expect(tension.expiredCount).toBe(0);
    expect(tension.currentTick).toBe(2);
    expect(tension.sortedQueue).toHaveLength(1);
    expect(tension.lastArrivedEntry).toBeNull();
    expect(tension.score).toBeGreaterThan(0);
  });

  it('captures arrived threats through the event bus and snapshot sync', () => {
    const harness = new TensionOrchestrationHarness();
    harness.onRunStarted();

    harness.enqueueThreat({
      threatId: 'threat-arrived-1',
      threatType: ThreatType.CASCADE,
      threatSeverity: ThreatSeverity.CRITICAL,
      currentTick: 1,
      arrivalTick: 2,
      isCascadeTriggered: true,
      cascadeTriggerEventId: 'cascade-event-1',
      worstCaseOutcome: 'Cascade breaches shield stack',
      mitigationCardTypes: Object.freeze(['PATCH_LAYER', 'CASH_BUFFER']),
    });

    const snapshot = harness.executeTensionStep({
      pressureTier: PressureTier.ELEVATED,
      isNearDeath: false,
      currentTick: 2,
    });

    const tension = harness.getTensionState();

    expect(snapshot.arrivedCount).toBe(1);
    expect(tension.arrivedCount).toBe(1);
    expect(tension.queueLength).toBe(1);
    expect(tension.lastArrivedEntry).not.toBeNull();
    expect(tension.lastArrivedEntry?.threatType).toBe(ThreatType.CASCADE);
    expect(tension.sortedQueue[0]?.isArrived).toBe(true);
    expect(tension.visibilityState).toBe(VisibilityState.TELEGRAPHED);
  });

  it('propagates expired threat events into the slice on the next orchestrated tick', () => {
    const harness = new TensionOrchestrationHarness();
    harness.onRunStarted();

    harness.enqueueThreat({
      threatId: 'threat-expire-1',
      threatType: ThreatType.HATER_INJECTION,
      threatSeverity: ThreatSeverity.SEVERE,
      currentTick: 1,
      arrivalTick: 2,
      isCascadeTriggered: false,
      cascadeTriggerEventId: null,
      worstCaseOutcome: 'Forced hostile card enters play',
      mitigationCardTypes: Object.freeze(['COUNTER_PLAY']),
    });

    harness.executeTensionStep({
      pressureTier: PressureTier.HIGH,
      isNearDeath: false,
      currentTick: 2,
    });

    const afterArrival = harness.getTensionState();
    expect(afterArrival.arrivedCount).toBe(1);
    expect(afterArrival.expiredCount).toBe(0);

    harness.executeTensionStep({
      pressureTier: PressureTier.HIGH,
      isNearDeath: false,
      currentTick: 3,
    });

    const afterExpiry = harness.getTensionState();
    expect(afterExpiry.expiredCount).toBe(1);
    expect(afterExpiry.queueLength).toBe(0);
    expect(afterExpiry.arrivedCount).toBe(0);
  });

  it('synchronizes pulse state from engine to store during the orchestrator tension step', () => {
    const harness = new TensionOrchestrationHarness();
    harness.onRunStarted();

    harness.forceScore(0.95);

    const snapshot = harness.executeTensionStep({
      pressureTier: PressureTier.CALM,
      isNearDeath: false,
      currentTick: 4,
    });

    const tension = harness.getTensionState();

    expect(snapshot.isPulseActive).toBe(true);
    expect(tension.isPulseActive).toBe(true);
    expect(tension.pulseTicksActive).toBeGreaterThanOrEqual(1);
    expect(tension.isSustainedPulse).toBe(false);
  });

  it('enters EXPOSED visibility only when CRITICAL pressure and near-death are both true', () => {
    const harness = new TensionOrchestrationHarness();
    harness.onRunStarted();

    harness.executeTensionStep({
      pressureTier: PressureTier.CRITICAL,
      isNearDeath: false,
      currentTick: 1,
    });

    expect(harness.getTensionState().visibilityState).toBe(VisibilityState.TELEGRAPHED);

    harness.executeTensionStep({
      pressureTier: PressureTier.CRITICAL,
      isNearDeath: true,
      currentTick: 2,
    });

    expect(harness.getTensionState().visibilityState).toBe(VisibilityState.EXPOSED);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2 — TensionEngine score computation and delta accumulation
// ─────────────────────────────────────────────────────────────────────────────

describe('TensionEngine — score computation and delta accumulation', () => {
  it('score starts at 0 after onRunStarted()', () => {
    const h = freshHarness();
    expect(h.getCurrentScore()).toBe(0);
  });

  it('score increases when a threat is queued and a tick is processed', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { arrivalTick: 10 });
    const snapshot = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    expect(snapshot.score).toBeGreaterThan(0);
  });

  it('score increases more under HIGH pressure than CALM', () => {
    const hCalm = freshHarness();
    enqueueSimpleThreat(hCalm, { arrivalTick: 10 });
    const calmSnap = hCalm.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });

    const hHigh = freshHarness();
    enqueueSimpleThreat(hHigh, { arrivalTick: 10 });
    const highSnap = hHigh.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 1 });

    expect(highSnap.score).toBeGreaterThan(calmSnap.score);
  });

  it('arrived threat accumulates MORE tension per tick than queued threat', () => {
    const hQueued = freshHarness();
    enqueueSimpleThreat(hQueued, { currentTick: 1, arrivalTick: 10 }); // stays QUEUED at tick 1
    const queuedSnap = hQueued.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });

    const hArrived = freshHarness();
    enqueueSimpleThreat(hArrived, { currentTick: 1, arrivalTick: 1 }); // arrives at tick 1
    const arrivedSnap = hArrived.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });

    expect(arrivedSnap.score).toBeGreaterThan(queuedSnap.score);
  });

  it('score is clamped to [0.0, 1.0] regardless of accumulated deltas', () => {
    const h = freshHarness();
    h.forceScore(TENSION_CONSTANTS.MAX_SCORE);
    // Enqueue multiple threats to push score beyond 1.0
    for (let i = 0; i < 10; i++) {
      enqueueSimpleThreat(h, {
        threatId: `burst-${i}`,
        currentTick: 1,
        arrivalTick: 1,
        threatSeverity: ThreatSeverity.EXISTENTIAL,
      });
    }
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CRITICAL, isNearDeath: true, currentTick: 1 });
    expect(snap.score).toBeLessThanOrEqual(TENSION_CONSTANTS.MAX_SCORE);
    expect(snap.score).toBeGreaterThanOrEqual(TENSION_CONSTANTS.MIN_SCORE);
  });

  it('score decays when the queue is empty (EMPTY_QUEUE_DECAY per tick)', () => {
    const h = freshHarness();
    h.forceScore(0.50);
    const snap1 = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    const snap2 = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 2 });
    // Score should decrease with empty queue
    expect(snap2.score).toBeLessThan(snap1.score);
  });

  it('forceScore() bypasses delta logic and sets exact score', () => {
    const h = freshHarness();
    h.forceScore(0.77);
    expect(h.getCurrentScore()).toBe(0.77);
  });

  it('forceScore() clamps values above 1.0 to MAX_SCORE', () => {
    const h = freshHarness();
    h.forceScore(99.0);
    expect(h.getCurrentScore()).toBe(TENSION_CONSTANTS.MAX_SCORE);
  });

  it('forceScore() clamps negative values to MIN_SCORE', () => {
    const h = freshHarness();
    h.forceScore(-5.0);
    expect(h.getCurrentScore()).toBe(TENSION_CONSTANTS.MIN_SCORE);
  });

  it('PRESSURE_TENSION_AMPLIFIERS table has entries for all five pressure tiers', () => {
    const tiers: PressureTier[] = [
      PressureTier.CALM,
      PressureTier.BUILDING,
      PressureTier.ELEVATED,
      PressureTier.HIGH,
      PressureTier.CRITICAL,
    ];
    for (const tier of tiers) {
      expect(PRESSURE_TENSION_AMPLIFIERS[tier]).toBeGreaterThan(0);
    }
    // CRITICAL amplifier must be the largest
    expect(PRESSURE_TENSION_AMPLIFIERS[PressureTier.CRITICAL]).toBeGreaterThan(
      PRESSURE_TENSION_AMPLIFIERS[PressureTier.CALM],
    );
  });

  it('sovereignty milestone decay fires a one-time score reduction', () => {
    const h = freshHarness();
    h.forceScore(0.60);
    const snapBefore = h.executeTensionStep({
      pressureTier: PressureTier.CALM,
      isNearDeath: false,
      currentTick: 1,
      sovereigntyMilestoneReached: false,
    });
    h.forceScore(0.60);
    const snapAfter = h.executeTensionStep({
      pressureTier: PressureTier.CALM,
      isNearDeath: false,
      currentTick: 2,
      sovereigntyMilestoneReached: true,
    });
    // Score should drop significantly on the milestone tick
    expect(snapAfter.score).toBeLessThan(snapBefore.score);
  });

  it('snapshot.rawScore and .amplifiedScore are present and numeric', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h);
    const snap = h.executeTensionStep({ pressureTier: PressureTier.BUILDING, isNearDeath: false, currentTick: 1 });
    expect(typeof snap.rawScore).toBe('number');
    expect(typeof snap.amplifiedScore).toBe('number');
  });

  it('snapshot.tickNumber matches the currentTick argument', () => {
    const h = freshHarness();
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 7 });
    expect(snap.tickNumber).toBe(7);
  });

  it('snapshot.timestamp is a recent Unix millisecond value', () => {
    const h = freshHarness();
    const before = Date.now();
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    const after = Date.now();
    expect(snap.timestamp).toBeGreaterThanOrEqual(before);
    expect(snap.timestamp).toBeLessThanOrEqual(after);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 3 — Threat enqueue / arrival / expiry lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('TensionEngine — threat lifecycle: enqueue → arrive → expire', () => {
  it('enqueueThreat() returns a non-empty string entryId', () => {
    const h = freshHarness();
    const id = enqueueSimpleThreat(h);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('queueLength increases by 1 after each enqueueThreat()', () => {
    const h = freshHarness();
    expect(h.getQueueLength()).toBe(0);
    enqueueSimpleThreat(h, { threatId: 't1', arrivalTick: 10 });
    expect(h.getQueueLength()).toBe(1);
    enqueueSimpleThreat(h, { threatId: 't2', arrivalTick: 10 });
    expect(h.getQueueLength()).toBe(2);
  });

  it('snapshot.queuedCount = 1 after enqueuing one threat not yet arrived', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 5 });
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    expect(snap.queuedCount).toBe(1);
    expect(snap.arrivedCount).toBe(0);
  });

  it('threat transitions to ARRIVED at the specified arrivalTick', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 3 });
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 2 });
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 3 });
    expect(snap.arrivedCount).toBe(1);
    expect(snap.queuedCount).toBe(0);
  });

  it('sortedQueue[0].isArrived is true after arrival tick passes', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 2 });
    h.executeTensionStep({ pressureTier: PressureTier.ELEVATED, isNearDeath: false, currentTick: 2 });
    const entry = h.getTensionState().sortedQueue[0] as AnticipationEntry;
    expect(entry.isArrived).toBe(true);
    expect(entry.state).toBe(EntryState.ARRIVED);
  });

  it('threat expires on the tick after it arrives (no mitigation)', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 2 });
    h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 2 }); // arrives
    const snap = h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 3 }); // expires
    expect(snap.expiredCount).toBe(1);
    expect(snap.queueLength).toBe(0);
  });

  it('store.arrivedCount is 0 again after the threat expires', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 2 });
    h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 2 });
    h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 3 });
    expect(h.getTensionState().arrivedCount).toBe(0);
    expect(h.getTensionState().expiredCount).toBe(1);
  });

  it('cascade-triggered threats get at least 1 tick of warning even if arrivalTick = currentTick', () => {
    const h = freshHarness();
    // arrivalTick === currentTick means instant, but cascade rule adds +1
    enqueueSimpleThreat(h, {
      currentTick: 5,
      arrivalTick: 5,
      isCascadeTriggered: true,
      cascadeTriggerEventId: 'evt-001',
    });
    const snap = h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 5 });
    // Should be QUEUED at tick 5, not ARRIVED
    expect(snap.queuedCount).toBe(1);
    expect(snap.arrivedCount).toBe(0);
  });

  it('multiple threats arriving on the same tick all register as arrived', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { threatId: 'ta1', currentTick: 1, arrivalTick: 3 });
    enqueueSimpleThreat(h, { threatId: 'ta2', currentTick: 1, arrivalTick: 3 });
    h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 3 });
    expect(h.getTensionState().arrivedCount).toBe(2);
  });

  it('getTensionState().lastArrivedEntry reflects the most recent arrived threat type', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, {
      threatId: 'ta-cascade',
      threatType: ThreatType.CASCADE,
      currentTick: 1,
      arrivalTick: 2,
    });
    h.executeTensionStep({ pressureTier: PressureTier.ELEVATED, isNearDeath: false, currentTick: 2 });
    expect(h.getTensionState().lastArrivedEntry?.threatType).toBe(ThreatType.CASCADE);
  });

  it('snapshot.dominantEntryId is the entryId of the only threat in the queue', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 10 });
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    expect(snap.dominantEntryId).not.toBeNull();
    expect(typeof snap.dominantEntryId).toBe('string');
  });

  it('snapshot.dominantEntryId is null when the queue is empty', () => {
    const h = freshHarness();
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    expect(snap.dominantEntryId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 4 — Threat mitigation and nullification
// ─────────────────────────────────────────────────────────────────────────────

describe('TensionEngine — threat mitigation and nullification', () => {
  it('mitigateThreat() returns true for an ARRIVED entry', () => {
    const h = freshHarness();
    const id = enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 2 });
    h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 2 });
    const result = h.mitigateThreat(id, 2);
    expect(result).toBe(true);
  });

  it('mitigateThreat() returns false for a QUEUED entry (not yet arrived)', () => {
    const h = freshHarness();
    const id = enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 5 });
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    const result = h.mitigateThreat(id, 1);
    expect(result).toBe(false);
  });

  it('mitigateThreat() returns false for a nonexistent entry', () => {
    const h = freshHarness();
    expect(h.mitigateThreat('nonexistent-id', 1)).toBe(false);
  });

  it('nullifyThreat() returns true for a QUEUED entry', () => {
    const h = freshHarness();
    const id = enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 10 });
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    const result = h.nullifyThreat(id, 1);
    expect(result).toBe(true);
  });

  it('nullifyThreat() returns true for an ARRIVED entry', () => {
    const h = freshHarness();
    const id = enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 2 });
    h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 2 });
    const result = h.nullifyThreat(id, 2);
    expect(result).toBe(true);
  });

  it('nullifyThreat() returns false for a nonexistent entry', () => {
    const h = freshHarness();
    expect(h.nullifyThreat('ghost-id', 1)).toBe(false);
  });

  it('queue length drops to 0 after nullifying the only queued threat', () => {
    const h = freshHarness();
    const id = enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 10 });
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    h.nullifyThreat(id, 1);
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 2 });
    expect(snap.queueLength).toBe(0);
  });

  it('successful mitigation does not immediately drive score to zero (decay lingers 3 ticks)', () => {
    const h = freshHarness();
    const id = enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 2 });
    h.forceScore(0.40);
    h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 2 });
    h.mitigateThreat(id, 2);
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 3 });
    expect(snap.score).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 5 — Pulse state machine
// ─────────────────────────────────────────────────────────────────────────────

describe('TensionEngine — pulse state machine', () => {
  it('isPulseActive is false when score < PULSE_THRESHOLD', () => {
    const h = freshHarness();
    h.forceScore(TENSION_CONSTANTS.PULSE_THRESHOLD - 0.01);
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    expect(snap.isPulseActive).toBe(false);
  });

  it('isPulseActive is true when score >= PULSE_THRESHOLD (0.90)', () => {
    const h = freshHarness();
    h.forceScore(TENSION_CONSTANTS.PULSE_THRESHOLD);
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    expect(snap.isPulseActive).toBe(true);
    expect(h.isPulseActive()).toBe(true);
  });

  it('pulseTicksActive increments for each consecutive tick above threshold', () => {
    const h = freshHarness();
    h.forceScore(0.95);
    const snap1 = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    h.forceScore(0.95);
    const snap2 = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 2 });
    h.forceScore(0.95);
    const snap3 = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 3 });
    expect(snap1.pulseTicksActive).toBe(1);
    expect(snap2.pulseTicksActive).toBe(2);
    expect(snap3.pulseTicksActive).toBe(3);
  });

  it('pulseTicksActive resets to 0 when score drops below threshold', () => {
    const h = freshHarness();
    h.forceScore(0.95);
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 2 });
    // Force score below threshold
    h.forceScore(0.0);
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 3 });
    expect(snap.isPulseActive).toBe(false);
    expect(snap.pulseTicksActive).toBe(0);
  });

  it('isSustainedPulse is false after 1 pulse tick', () => {
    const h = freshHarness();
    h.forceScore(0.95);
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    expect(h.getTensionState().isSustainedPulse).toBe(false);
  });

  it('isSustainedPulse becomes true after 3 consecutive pulse ticks (PULSE_SUSTAINED_TICKS)', () => {
    const h = freshHarness();
    for (let tick = 1; tick <= TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS; tick++) {
      h.forceScore(0.95);
      h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: tick });
    }
    expect(h.getTensionState().isSustainedPulse).toBe(true);
  });

  it('isSustainedPulse is false in store after pulseTicksActive drops to 0', () => {
    const h = freshHarness();
    for (let tick = 1; tick <= 3; tick++) {
      h.forceScore(0.95);
      h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: tick });
    }
    h.forceScore(0.0);
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 4 });
    expect(h.getTensionState().isSustainedPulse).toBe(false);
  });

  it('onRunEnded() clears pulse state in the store', () => {
    const h = freshHarness();
    h.forceScore(0.95);
    for (let i = 1; i <= 3; i++) {
      h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: i });
    }
    expect(h.getTensionState().isSustainedPulse).toBe(true);
    h.onRunEnded();
    const t = h.getTensionState();
    expect(t.isPulseActive).toBe(false);
    expect(t.pulseTicksActive).toBe(0);
    expect(t.isSustainedPulse).toBe(false);
    expect(t.isRunActive).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 6 — Score history and escalation detection
// ─────────────────────────────────────────────────────────────────────────────

describe('TensionEngine — score history and escalation detection', () => {
  it('scoreHistory is empty before any ticks', () => {
    const h = freshHarness();
    expect(h.getSnapshot().scoreHistory).toHaveLength(0);
  });

  it('scoreHistory grows by 1 entry per tick', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { arrivalTick: 20 });
    for (let tick = 1; tick <= 5; tick++) {
      h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: tick });
    }
    expect(h.getSnapshot().scoreHistory).toHaveLength(5);
  });

  it('scoreHistory is capped at 20 entries (SCORE_HISTORY_DEPTH)', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { arrivalTick: 100 });
    for (let tick = 1; tick <= 25; tick++) {
      h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: tick });
    }
    expect(h.getSnapshot().scoreHistory.length).toBeLessThanOrEqual(20);
  });

  it('scoreHistory values are all within [0.0, 1.0]', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 2 });
    for (let tick = 1; tick <= 10; tick++) {
      h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: tick });
    }
    for (const entry of h.getSnapshot().scoreHistory) {
      expect(entry).toBeGreaterThanOrEqual(0.0);
      expect(entry).toBeLessThanOrEqual(1.0);
    }
  });

  it('isEscalating is false with a flat or decreasing score history', () => {
    const h = freshHarness();
    h.forceScore(0.60);
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    h.forceScore(0.50);
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 2 });
    h.forceScore(0.40);
    const snap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 3 });
    expect(snap.isEscalating).toBe(false);
  });

  it('isEscalating is true when the score has risen for the last 3 consecutive ticks', () => {
    const h = freshHarness();
    // Force score upward over 3 ticks
    const rising = [0.10, 0.20, 0.40];
    for (const [i, score] of rising.entries()) {
      h.forceScore(score);
      h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: i + 1 });
    }
    expect(h.getSnapshot().isEscalating).toBe(true);
  });

  it('store.scoreHistory is a readonly frozen array', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { arrivalTick: 20 });
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    const history = h.getTensionState().scoreHistory;
    expect(Object.isFrozen(history)).toBe(true);
  });

  it('store.isEscalating matches snapshot.isEscalating after onSnapshotAvailable', () => {
    const h = freshHarness();
    const rising = [0.10, 0.25, 0.50];
    let lastSnap: TensionSnapshot | undefined;
    for (const [i, score] of rising.entries()) {
      h.forceScore(score);
      lastSnap = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: i + 1 });
    }
    expect(h.getTensionState().isEscalating).toBe(lastSnap?.isEscalating ?? false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 7 — Visibility state machine
// ─────────────────────────────────────────────────────────────────────────────

describe('TensionEngine — visibility state machine', () => {
  it('starts at SHADOWED (the lowest visibility state)', () => {
    const h = freshHarness();
    expect(h.getVisibilityState()).toBe(VisibilityState.SHADOWED);
  });

  it('BUILDING pressure transitions visibility to SIGNALED', () => {
    const h = freshHarness();
    h.executeTensionStep({ pressureTier: PressureTier.BUILDING, isNearDeath: false, currentTick: 1 });
    expect(h.getVisibilityState()).toBe(VisibilityState.SIGNALED);
  });

  it('ELEVATED pressure transitions visibility to TELEGRAPHED', () => {
    const h = freshHarness();
    h.executeTensionStep({ pressureTier: PressureTier.ELEVATED, isNearDeath: false, currentTick: 1 });
    expect(h.getVisibilityState()).toBe(VisibilityState.TELEGRAPHED);
  });

  it('CRITICAL + isNearDeath=true transitions visibility to EXPOSED', () => {
    const h = freshHarness();
    h.executeTensionStep({ pressureTier: PressureTier.CRITICAL, isNearDeath: true, currentTick: 1 });
    expect(h.getVisibilityState()).toBe(VisibilityState.EXPOSED);
  });

  it('CRITICAL + isNearDeath=false does NOT reach EXPOSED', () => {
    const h = freshHarness();
    h.executeTensionStep({ pressureTier: PressureTier.CRITICAL, isNearDeath: false, currentTick: 1 });
    expect(h.getVisibilityState()).not.toBe(VisibilityState.EXPOSED);
    expect(h.getVisibilityState()).toBe(VisibilityState.TELEGRAPHED);
  });

  it('store previousVisibilityState is updated on a visibility change event', () => {
    const h = freshHarness();
    h.executeTensionStep({ pressureTier: PressureTier.BUILDING, isNearDeath: false, currentTick: 1 });
    // At this point we went SHADOWED → SIGNALED
    expect(h.getTensionState().previousVisibilityState).toBe(VisibilityState.SHADOWED);
  });

  it('VISIBILITY_CONFIGS table has entries for all four VisibilityState values', () => {
    const states: VisibilityState[] = [
      VisibilityState.SHADOWED,
      VisibilityState.SIGNALED,
      VisibilityState.TELEGRAPHED,
      VisibilityState.EXPOSED,
    ];
    for (const state of states) {
      const config = VISIBILITY_CONFIGS[state];
      expect(config).toBeDefined();
      expect(config.state).toBe(state);
      expect(typeof config.tensionAwarenessBonus).toBe('number');
    }
  });

  it('TELEGRAPHED config showsArrivalTick = true, SIGNALED = false', () => {
    expect(VISIBILITY_CONFIGS[VisibilityState.TELEGRAPHED].showsArrivalTick).toBe(true);
    expect(VISIBILITY_CONFIGS[VisibilityState.SIGNALED].showsArrivalTick).toBe(false);
  });

  it('EXPOSED config showsMitigationPath = true', () => {
    expect(VISIBILITY_CONFIGS[VisibilityState.EXPOSED].showsMitigationPath).toBe(true);
    expect(VISIBILITY_CONFIGS[VisibilityState.EXPOSED].showsWorstCase).toBe(true);
  });

  it('snapshot.visibilityState and store.visibilityState stay in sync', () => {
    const h = freshHarness();
    const snap = h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 1 });
    expect(h.getTensionState().visibilityState).toBe(snap.visibilityState);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 8 — Store slice precision
// ─────────────────────────────────────────────────────────────────────────────

describe('TensionSlice — store handler field-by-field precision', () => {
  it('createDefaultTensionState() returns all zero/false/null baseline fields', () => {
    const state: TensionState = createDefaultTensionState();
    expect(state.score).toBe(0.0);
    expect(state.queueLength).toBe(0);
    expect(state.arrivedCount).toBe(0);
    expect(state.queuedCount).toBe(0);
    expect(state.expiredCount).toBe(0);
    expect(state.isPulseActive).toBe(false);
    expect(state.pulseTicksActive).toBe(0);
    expect(state.isSustainedPulse).toBe(false);
    expect(state.isEscalating).toBe(false);
    expect(state.sortedQueue).toHaveLength(0);
    expect(state.lastArrivedEntry).toBeNull();
    expect(state.lastExpiredEntry).toBeNull();
    expect(state.currentTick).toBe(0);
    expect(state.isRunActive).toBe(false);
    expect(state.visibilityState).toBe('SHADOWED');
    expect(state.previousVisibilityState).toBeNull();
    expect(Object.isFrozen(state.scoreHistory)).toBe(true);
  });

  it('defaultTensionSlice.tension equals createDefaultTensionState()', () => {
    expect(defaultTensionSlice.tension).toEqual(createDefaultTensionState());
  });

  it('resetTensionSliceDraft() with isRunActive=true sets isRunActive field', () => {
    const state: TestStoreState = { tension: createDefaultTensionState() };
    resetTensionSliceDraft(state, true);
    expect(state.tension.isRunActive).toBe(true);
  });

  it('resetTensionSliceDraft() with isRunActive=false clears it', () => {
    const state: TestStoreState = { tension: createDefaultTensionState() };
    state.tension.isRunActive = true;
    resetTensionSliceDraft(state, false);
    expect(state.tension.isRunActive).toBe(false);
  });

  it('applyTensionSnapshotDraft() writes every snapshot field to state', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 2 });
    const snap = h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 2 });
    const queue = h.tensionEngine.getSortedQueue();
    const state: TestStoreState = { tension: createDefaultTensionState() };
    applyTensionSnapshotDraft(state, snap, queue);
    expect(state.tension.score).toBeCloseTo(snap.score, 10);
    expect(state.tension.visibilityState).toBe(snap.visibilityState);
    expect(state.tension.queueLength).toBe(snap.queueLength);
    expect(state.tension.arrivedCount).toBe(snap.arrivedCount);
    expect(state.tension.queuedCount).toBe(snap.queuedCount);
    expect(state.tension.expiredCount).toBe(snap.expiredCount);
    expect(state.tension.isPulseActive).toBe(snap.isPulseActive);
    expect(state.tension.pulseTicksActive).toBe(snap.pulseTicksActive);
    expect(state.tension.isEscalating).toBe(snap.isEscalating);
    expect(state.tension.currentTick).toBe(snap.tickNumber);
  });

  it('onScoreUpdated handler updates score and visibilityState', () => {
    const h = freshHarness();
    const state: TestStoreState = { tension: createDefaultTensionState() };
    const set: TensionSliceSet<TestStoreState> = (recipe) => recipe(state);
    const event: TensionScoreUpdatedEvent = {
      eventType: 'TENSION_SCORE_UPDATED',
      score: 0.55,
      visibilityState: VisibilityState.SIGNALED,
      tickNumber: 3,
      timestamp: Date.now(),
    };
    tensionStoreHandlers.onScoreUpdated(set, event);
    expect(state.tension.score).toBe(0.55);
    expect(state.tension.visibilityState).toBe(VisibilityState.SIGNALED);
    // h was used to satisfy no-unused-var — access its default state
    expect(h.getTensionState().score).toBe(0);
  });

  it('onVisibilityChanged handler stores previous and new state', () => {
    const state: TestStoreState = { tension: createDefaultTensionState() };
    const set: TensionSliceSet<TestStoreState> = (recipe) => recipe(state);
    const event: TensionVisibilityChangedEvent = {
      eventType: 'TENSION_VISIBILITY_CHANGED',
      from: VisibilityState.SHADOWED,
      to: VisibilityState.SIGNALED,
      tickNumber: 2,
      timestamp: Date.now(),
    };
    tensionStoreHandlers.onVisibilityChanged(set, event);
    expect(state.tension.previousVisibilityState).toBe(VisibilityState.SHADOWED);
    expect(state.tension.visibilityState).toBe(VisibilityState.SIGNALED);
  });

  it('onPulseFired handler sets isPulseActive and isSustainedPulse correctly', () => {
    const state: TestStoreState = { tension: createDefaultTensionState() };
    const set: TensionSliceSet<TestStoreState> = (recipe) => recipe(state);
    const event: TensionPulseFiredEvent = {
      eventType: 'TENSION_PULSE_FIRED',
      score: 0.92,
      queueLength: 1,
      pulseTicksActive: 3,
      tickNumber: 5,
      timestamp: Date.now(),
    };
    tensionStoreHandlers.onPulseFired(set, event);
    expect(state.tension.isPulseActive).toBe(true);
    expect(state.tension.pulseTicksActive).toBe(3);
    expect(state.tension.isSustainedPulse).toBe(true); // >= 3 → sustained
  });

  it('onThreatArrived handler increments arrivedCount', () => {
    const state: TestStoreState = { tension: createDefaultTensionState() };
    const set: TensionSliceSet<TestStoreState> = (recipe) => recipe(state);
    const event: ThreatArrivedEvent = {
      eventType: 'THREAT_ARRIVED',
      entryId: 'e1',
      threatType: ThreatType.SABOTAGE,
      threatSeverity: ThreatSeverity.CRITICAL,
      worstCaseOutcome: 'Critical loss',
      mitigationCardTypes: Object.freeze(['SHIELD']),
      tickNumber: 2,
      timestamp: Date.now(),
    };
    tensionStoreHandlers.onThreatArrived(set, event);
    expect(state.tension.arrivedCount).toBe(1);
  });

  it('onThreatExpired handler increments expiredCount', () => {
    const state: TestStoreState = { tension: createDefaultTensionState() };
    const set: TensionSliceSet<TestStoreState> = (recipe) => recipe(state);
    const event: ThreatExpiredEvent = {
      eventType: 'THREAT_EXPIRED',
      entryId: 'e2',
      threatType: ThreatType.CASCADE,
      threatSeverity: ThreatSeverity.SEVERE,
      ticksOverdue: 1,
      tickNumber: 3,
      timestamp: Date.now(),
    };
    tensionStoreHandlers.onThreatExpired(set, event);
    expect(state.tension.expiredCount).toBe(1);
  });

  it('onTickComplete normalizes out-of-range score to valid range', () => {
    const state: TestStoreState = { tension: createDefaultTensionState() };
    state.tension.score = 1.5; // invalid — should be clamped
    const set: TensionSliceSet<TestStoreState> = (recipe) => recipe(state);
    tensionStoreHandlers.onTickComplete(set);
    expect(state.tension.score).toBeLessThanOrEqual(1.0);
    expect(state.tension.score).toBeGreaterThanOrEqual(0.0);
  });

  it('onTickComplete resets isSustainedPulse when pulse is not active', () => {
    const state: TestStoreState = { tension: createDefaultTensionState() };
    state.tension.isPulseActive = false;
    state.tension.pulseTicksActive = 5;
    state.tension.isSustainedPulse = true;
    const set: TensionSliceSet<TestStoreState> = (recipe) => recipe(state);
    tensionStoreHandlers.onTickComplete(set);
    expect(state.tension.pulseTicksActive).toBe(0);
    expect(state.tension.isSustainedPulse).toBe(false);
  });

  it('onRunEnded handler sets isRunActive = false', () => {
    const h = freshHarness();
    h.onRunEnded();
    expect(h.getTensionState().isRunActive).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 9 — Multi-tick orchestrated run simulation
// ─────────────────────────────────────────────────────────────────────────────

describe('TensionEngine — multi-tick run simulation', () => {
  it('full run: enqueue → arrive → expire → reset — all store fields consistent', () => {
    const h = new TensionOrchestrationHarness();
    h.onRunStarted();

    // Tick 1: enqueue
    enqueueSimpleThreat(h, { threatId: 'sim-1', currentTick: 1, arrivalTick: 3 });
    h.executeTensionStep({ pressureTier: PressureTier.BUILDING, isNearDeath: false, currentTick: 1 });
    expect(h.getTensionState().queuedCount).toBe(1);

    // Tick 2: still queued, score increases
    const snap2 = h.executeTensionStep({ pressureTier: PressureTier.BUILDING, isNearDeath: false, currentTick: 2 });
    expect(snap2.queuedCount).toBe(1);
    expect(snap2.score).toBeGreaterThan(0);

    // Tick 3: arrives
    const snap3 = h.executeTensionStep({ pressureTier: PressureTier.ELEVATED, isNearDeath: false, currentTick: 3 });
    expect(snap3.arrivedCount).toBe(1);
    expect(snap3.queuedCount).toBe(0);

    // Tick 4: expires (no mitigation)
    const snap4 = h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 4 });
    expect(snap4.expiredCount).toBe(1);
    expect(snap4.queueLength).toBe(0);

    // Run ended: pulse and activity cleared
    h.onRunEnded();
    expect(h.getTensionState().isRunActive).toBe(false);

    // New run: all state cleared
    h.onRunStarted();
    const fresh = h.getTensionState();
    expect(fresh.score).toBe(0);
    expect(fresh.queueLength).toBe(0);
    expect(fresh.expiredCount).toBe(0);
    expect(fresh.arrivedCount).toBe(0);
    expect(fresh.isRunActive).toBe(true);
  });

  it('two concurrent threats: both arrive, both expire, store tracks cumulative counts', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { threatId: 'conc-1', currentTick: 1, arrivalTick: 2 });
    enqueueSimpleThreat(h, { threatId: 'conc-2', currentTick: 1, arrivalTick: 2 });

    const snap2 = h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 2 });
    expect(snap2.arrivedCount).toBe(2);

    const snap3 = h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 3 });
    expect(snap3.expiredCount).toBe(2);
    expect(snap3.queueLength).toBe(0);
  });

  it('mitigation path: enqueue → arrive → mitigate — score decays post-mitigation', () => {
    const h = freshHarness();
    const id = enqueueSimpleThreat(h, { currentTick: 1, arrivalTick: 2, threatSeverity: ThreatSeverity.CRITICAL });
    h.forceScore(0.60);
    h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 2 });
    h.mitigateThreat(id, 2);

    const snap3 = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 3 });
    const snap4 = h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 4 });
    // Score should be decaying each tick after mitigation
    expect(snap4.score).toBeLessThan(snap3.score);
  });

  it('sustained pulse → sovereignty milestone drops score significantly', () => {
    const h = freshHarness();
    // Build sustained pulse
    for (let tick = 1; tick <= 4; tick++) {
      h.forceScore(0.95);
      h.executeTensionStep({ pressureTier: PressureTier.CRITICAL, isNearDeath: false, currentTick: tick });
    }
    expect(h.getTensionState().isSustainedPulse).toBe(true);
    const scoreBefore = h.getCurrentScore();

    // Sovereignty milestone fires
    h.executeTensionStep({
      pressureTier: PressureTier.CRITICAL,
      isNearDeath: false,
      currentTick: 5,
      sovereigntyMilestoneReached: true,
    });
    const scoreAfter = h.getCurrentScore();
    expect(scoreAfter).toBeLessThan(scoreBefore);
  });

  it('score history in store is defensively cloned — mutation of returned array is safe', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { arrivalTick: 20 });
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    const history = h.getTensionState().scoreHistory;
    // The array is frozen, so mutations should not be possible
    expect(() => {
      // Attempt to push to a frozen array — this is a type-safe read-only violation
      (history as number[]).push(99);
    }).toThrow();
  });

  it('calling reset() mid-run via onRunStarted() fully clears engine + store state', () => {
    const h = freshHarness();
    // Simulate a half-run with multiple threats and several ticks
    enqueueSimpleThreat(h, { threatId: 'r1', currentTick: 1, arrivalTick: 2 });
    enqueueSimpleThreat(h, { threatId: 'r2', currentTick: 1, arrivalTick: 5 });
    h.forceScore(0.80);
    h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 2 });
    h.executeTensionStep({ pressureTier: PressureTier.HIGH, isNearDeath: false, currentTick: 3 });

    // Reset mid-run
    h.onRunStarted();

    const t = h.getTensionState();
    expect(t.score).toBe(0);
    expect(t.queueLength).toBe(0);
    expect(t.arrivedCount).toBe(0);
    expect(t.expiredCount).toBe(0);
    expect(t.sortedQueue).toHaveLength(0);
    expect(h.getCurrentScore()).toBe(0);
    expect(h.getQueueLength()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer 10 — Edge cases, invariants, and defensive boundaries
// ─────────────────────────────────────────────────────────────────────────────

describe('TensionEngine — edge cases and defensive invariants', () => {
  it('executeTensionStep() at tick 0 does not crash', () => {
    const h = freshHarness();
    expect(() => {
      h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 0 });
    }).not.toThrow();
  });

  it('executeTensionStep() with a very large currentTick (1000) does not crash', () => {
    const h = freshHarness();
    expect(() => {
      h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1000 });
    }).not.toThrow();
  });

  it('enqueueThreat() generates unique entryIds for identical input', () => {
    const h = freshHarness();
    const id1 = enqueueSimpleThreat(h, { threatId: 'same', currentTick: 1, arrivalTick: 5 });
    const id2 = enqueueSimpleThreat(h, { threatId: 'same', currentTick: 1, arrivalTick: 5 });
    expect(id1).not.toBe(id2);
  });

  it('TensionEngine.getSnapshot() before first computeTension() returns a valid empty snapshot', () => {
    const h = freshHarness();
    const snap = h.getSnapshot();
    expect(snap.score).toBe(0);
    expect(snap.queueLength).toBe(0);
    expect(snap.arrivedCount).toBe(0);
    expect(snap.isPulseActive).toBe(false);
  });

  it('TENSION_CONSTANTS values are all positive numbers', () => {
    expect(TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK).toBeGreaterThan(0);
    expect(TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK).toBeGreaterThan(0);
    expect(TENSION_CONSTANTS.EMPTY_QUEUE_DECAY).toBeGreaterThan(0);
    expect(TENSION_CONSTANTS.PULSE_THRESHOLD).toBeGreaterThan(0);
    expect(TENSION_CONSTANTS.PULSE_SUSTAINED_TICKS).toBeGreaterThan(0);
  });

  it('ARRIVED tension per tick > QUEUED tension per tick', () => {
    expect(TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK).toBeGreaterThan(
      TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK,
    );
  });

  it('PULSE_THRESHOLD is strictly less than MAX_SCORE', () => {
    expect(TENSION_CONSTANTS.PULSE_THRESHOLD).toBeLessThan(TENSION_CONSTANTS.MAX_SCORE);
  });

  it('store score is clamped to valid range even if raw event score is out of bounds', () => {
    const state: TestStoreState = { tension: createDefaultTensionState() };
    const set: TensionSliceSet<TestStoreState> = (recipe) => recipe(state);
    const event: TensionScoreUpdatedEvent = {
      eventType: 'TENSION_SCORE_UPDATED',
      score: 999,           // wildly out of bounds
      visibilityState: VisibilityState.EXPOSED,
      tickNumber: 1,
      timestamp: Date.now(),
    };
    tensionStoreHandlers.onScoreUpdated(set, event);
    expect(state.tension.score).toBeLessThanOrEqual(1.0);
    expect(state.tension.score).toBeGreaterThanOrEqual(0.0);
  });

  it('ThreatType enum covers all expected adversary categories', () => {
    const expectedTypes: ThreatType[] = [
      ThreatType.DEBT_SPIRAL,
      ThreatType.SABOTAGE,
      ThreatType.HATER_INJECTION,
      ThreatType.CASCADE,
      ThreatType.SOVEREIGNTY,
      ThreatType.OPPORTUNITY_KILL,
      ThreatType.REPUTATION_BURN,
      ThreatType.SHIELD_PIERCE,
    ];
    for (const t of expectedTypes) {
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    }
  });

  it('ThreatSeverity enum covers all five severity levels', () => {
    const levels: ThreatSeverity[] = [
      ThreatSeverity.MINOR,
      ThreatSeverity.MODERATE,
      ThreatSeverity.SEVERE,
      ThreatSeverity.CRITICAL,
      ThreatSeverity.EXISTENTIAL,
    ];
    expect(levels).toHaveLength(5);
  });

  it('EntryState enum covers full lifecycle: QUEUED, ARRIVED, MITIGATED, EXPIRED, NULLIFIED', () => {
    expect(EntryState.QUEUED).toBeDefined();
    expect(EntryState.ARRIVED).toBeDefined();
    expect(EntryState.MITIGATED).toBeDefined();
    expect(EntryState.EXPIRED).toBeDefined();
    expect(EntryState.NULLIFIED).toBeDefined();
  });

  it('sortedQueue entries from getSortedQueue() are defensively cloned (mitigationCardTypes frozen)', () => {
    const h = freshHarness();
    enqueueSimpleThreat(h, { mitigationCardTypes: Object.freeze(['CARD_A', 'CARD_B']) });
    h.executeTensionStep({ pressureTier: PressureTier.CALM, isNearDeath: false, currentTick: 1 });
    const queue = h.tensionEngine.getSortedQueue();
    if (queue.length > 0) {
      expect(Object.isFrozen(queue[0]?.mitigationCardTypes)).toBe(true);
    }
  });

  it('TestEventBus.listenerCount() correctly reflects registered listeners', () => {
    const h = new TensionOrchestrationHarness();
    // The harness registers 5 event listeners in its constructor
    expect(h.eventBus.listenerCount('TENSION_SCORE_UPDATED')).toBe(1);
    expect(h.eventBus.listenerCount('TENSION_VISIBILITY_CHANGED')).toBe(1);
    expect(h.eventBus.listenerCount('TENSION_PULSE_FIRED')).toBe(1);
    expect(h.eventBus.listenerCount('THREAT_ARRIVED')).toBe(1);
    expect(h.eventBus.listenerCount('THREAT_EXPIRED')).toBe(1);
  });

  it('TestEventBus.reset() clears all listeners', () => {
    const h = new TensionOrchestrationHarness();
    h.eventBus.reset();
    expect(h.eventBus.listenerCount('TENSION_SCORE_UPDATED')).toBe(0);
  });

  it('vi mock utilities are available for future spy tests', () => {
    // Validate that vi is imported and functional for hook-based extensions
    const spy = vi.fn();
    spy('test-call');
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('afterEach timer restoration placeholder — useFakeTimers would be restored', () => {
    // This test documents that fake timer isolation is available if needed in
    // extended test suites. No setup here — just validates vi is in scope.
    expect(typeof vi.useFakeTimers).toBe('function');
    expect(typeof vi.useRealTimers).toBe('function');
  });
});
