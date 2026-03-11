/**
 * ============================================================================
 * FILE: pzo-web/src/engines/core/__tests__/EngineOrchestrator.tension.spec.ts
 * ============================================================================
 *
 * Purpose:
 * - define the Engine 3 orchestration contract for the current repo state
 * - validate tension-step wiring between:
 *   TensionEngine -> EventBus -> tensionStoreHandlers -> store snapshot sync
 * - provide a passable contract harness while the live EngineOrchestrator
 *   remains a thin DecisionTimer wrapper
 *
 * Doctrine:
 * - test the tension integration boundary, not UI rendering
 * - use a synchronous in-memory EventBus
 * - mirror the intended orchestrator Step 3 sequence precisely
 * ============================================================================
 */

import { describe, expect, it } from 'vitest';

import { TensionEngine } from '../../tension/TensionEngine';
import {
  PressureTier,
  ThreatSeverity,
  ThreatType,
  VisibilityState,
} from '../../tension/types';
import {
  createDefaultTensionState,
  tensionStoreHandlers,
  type TensionSliceContainer,
  type TensionSliceSet,
} from '../../../store/slices/tensionSlice';

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
    // Synchronous no-op for contract parity with the intended orchestrator.
  }
}

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

  public onRunStarted(): void {
    this.tensionEngine.reset();
    tensionStoreHandlers.onRunStarted(this.set);
  }

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

  public executeTensionStep(args: {
    readonly pressureTier: PressureTier;
    readonly isNearDeath: boolean;
    readonly currentTick: number;
    readonly sovereigntyMilestoneReached?: boolean;
  }) {
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

  public forceScore(score: number): void {
    this.tensionEngine.forceScore(score);
  }

  public getTensionState() {
    return this.state.tension;
  }

  private registerTensionListeners(): void {
    this.eventBus.on('TENSION_SCORE_UPDATED', (event) => {
      tensionStoreHandlers.onScoreUpdated(this.set, event as never);
    });

    this.eventBus.on('TENSION_VISIBILITY_CHANGED', (event) => {
      tensionStoreHandlers.onVisibilityChanged(this.set, event as never);
    });

    this.eventBus.on('TENSION_PULSE_FIRED', (event) => {
      tensionStoreHandlers.onPulseFired(this.set, event as never);
    });

    this.eventBus.on('THREAT_ARRIVED', (event) => {
      tensionStoreHandlers.onThreatArrived(this.set, event as never);
    });

    this.eventBus.on('THREAT_EXPIRED', (event) => {
      tensionStoreHandlers.onThreatExpired(this.set, event as never);
    });
  }
}

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