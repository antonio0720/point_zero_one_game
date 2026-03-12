// pzo-web/src/engines/core/__tests__/OrchestratorDiagnostics.spec.ts

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  OrchestratorDiagnostics,
  type OrchestratorDiagnosticThresholds,
} from '../OrchestratorDiagnostics';

function makeThresholds(
  overrides: Partial<OrchestratorDiagnosticThresholds> = {},
): OrchestratorDiagnosticThresholds {
  return {
    maxAllowedDriftMs: 150,
    maxAllowedFlushMs: 32,
    maxAllowedSingleStepMs: 24,
    maxAllowedOpenDecisionWindows: 8,
    tierOscillationWindow: 8,
    tierOscillationTripCount: 4,
    ...overrides,
  };
}

function mockClocks(perfValues: number[], dateValues: number[]) {
  const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => {
    const next = perfValues.shift();
    if (next === undefined) {
      throw new Error('performance.now() was called more times than this test provisioned');
    }
    return next;
  });

  const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
    const next = dateValues.shift();
    if (next === undefined) {
      throw new Error('Date.now() was called more times than this test provisioned');
    }
    return next;
  });

  return { perfSpy, dateSpy };
}

describe('OrchestratorDiagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records a nominal tick lifecycle and aggregates a deterministic diagnostics snapshot', () => {
    mockClocks([100, 135, 150], [1_000, 1_010]);

    const diagnostics = new OrchestratorDiagnostics(
      makeThresholds({
        maxAllowedDriftMs: 999,
        maxAllowedFlushMs: 999,
        maxAllowedSingleStepMs: 999,
        maxAllowedOpenDecisionWindows: 999,
      }),
      256,
    );

    diagnostics.onTickScheduled(7, 50, 'T2');
    diagnostics.onTickStarted();
    diagnostics.onStepCompleted('STEP_02_PRESSURE_COMPUTE', 12);
    diagnostics.onStepCompleted('STEP_11_TIME_TIER_UPDATE', 5);
    diagnostics.onEventEmitted(5);
    diagnostics.onDecisionWindowCountUpdated(2);
    diagnostics.onFlushStarted();

    const sample = diagnostics.onTickCompleted();
    const snapshot = diagnostics.getSnapshot();

    expect(sample).toEqual({
      tickIndex: 7,
      tier: 'T2',
      scheduledDurationMs: 50,
      actualDurationMs: 50,
      driftMs: 0,
      stepDurationsMs: {
        STEP_02_PRESSURE_COMPUTE: 12,
        STEP_11_TIME_TIER_UPDATE: 5,
      },
      flushDurationMs: 15,
      emittedEventCount: 5,
      openDecisionWindowCount: 2,
      timestamp: 1_000,
    });

    expect(diagnostics.getLastTickCompletedAtMs()).toBe(1_000);

    expect(snapshot).toEqual({
      generatedAt: 1_010,
      totalTicksObserved: 1,
      lastTickIndex: 7,
      currentTier: 'T2',
      avgScheduledDurationMs: 50,
      avgActualDurationMs: 50,
      avgDriftMs: 0,
      maxDriftMs: 0,
      avgFlushDurationMs: 15,
      maxFlushDurationMs: 15,
      maxSingleStepMs: 12,
      totalEventsObserved: 5,
      avgEventsPerTick: 5,
      maxOpenDecisionWindowCount: 2,
      tierTransitionCount: 0,
      recentTierSequence: [],
      alerts: [],
      lastTick: sample,
    });
  });

  it('emits alerts for slow steps, runaway event volume, backlog, drift, and slow flush', () => {
    mockClocks([100, 115, 140], [2_000, 2_010]);

    const diagnostics = new OrchestratorDiagnostics(
      makeThresholds({
        maxAllowedDriftMs: 10,
        maxAllowedFlushMs: 5,
        maxAllowedSingleStepMs: 4,
        maxAllowedOpenDecisionWindows: 1,
      }),
      256,
    );

    diagnostics.onTickScheduled(8, 20, 'T1');
    diagnostics.onTickStarted();
    diagnostics.onStepCompleted('STEP_03_TENSION_UPDATE', 10);
    diagnostics.onEventEmitted(129);
    diagnostics.onDecisionWindowCountUpdated(3);
    diagnostics.onFlushStarted();

    const sample = diagnostics.onTickCompleted();
    const snapshot = diagnostics.getSnapshot();

    expect(sample.actualDurationMs).toBe(40);
    expect(sample.driftMs).toBe(20);
    expect(sample.flushDurationMs).toBe(25);

    expect(snapshot.alerts.map((alert) => alert.code)).toEqual([
      'SLOW_STEP',
      'RUNAWAY_EVENT_VOLUME',
      'WINDOW_BACKLOG',
      'HIGH_TICK_DRIFT',
      'SLOW_FLUSH',
    ]);

    expect(snapshot.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SLOW_STEP',
          tickIndex: 8,
          metadata: { step: 'STEP_03_TENSION_UPDATE', durationMs: 10 },
        }),
        expect.objectContaining({
          code: 'RUNAWAY_EVENT_VOLUME',
          tickIndex: 8,
          metadata: { currentEventCount: 129 },
        }),
        expect.objectContaining({
          code: 'WINDOW_BACKLOG',
          tickIndex: 8,
          metadata: { openDecisionWindowCount: 3, threshold: 1 },
        }),
        expect.objectContaining({
          code: 'HIGH_TICK_DRIFT',
          tickIndex: 8,
          metadata: { scheduledDurationMs: 20, actualDurationMs: 40, driftMs: 20 },
        }),
        expect.objectContaining({
          code: 'SLOW_FLUSH',
          tickIndex: 8,
          metadata: { flushDurationMs: 25, threshold: 5 },
        }),
      ]),
    );
  });

  it('tracks tier transitions and raises a tier oscillation alert when recent changes thrash', () => {
    mockClocks([], [3_000]);

    const diagnostics = new OrchestratorDiagnostics(
      makeThresholds({
        tierOscillationWindow: 4,
        tierOscillationTripCount: 3,
      }),
      256,
    );

    diagnostics.onTickScheduled(12, 600, 'T1');

    diagnostics.onTierChanged(null, 'T0');
    diagnostics.onTierChanged('T0', 'T1');
    diagnostics.onTierChanged('T1', 'T0');
    diagnostics.onTierChanged('T0', 'T1');

    const snapshot = diagnostics.getSnapshot();

    expect(snapshot.tierTransitionCount).toBe(4);
    expect(snapshot.recentTierSequence).toEqual(['T0', 'T1', 'T0', 'T1']);

    expect(snapshot.alerts).toEqual([
      expect.objectContaining({
        code: 'TIER_OSCILLATION',
        tickIndex: 12,
        metadata: {
          recentTiers: ['T0', 'T1', 'T0', 'T1'],
          changes: 3,
        },
      }),
    ]);
  });

  it('enforces the repo minimum history floor of 32 samples even when a smaller size is requested', () => {
    let perfNow = 0;
    let wallNow = 10_000;

    vi.spyOn(performance, 'now').mockImplementation(() => {
      perfNow += 10;
      return perfNow;
    });

    vi.spyOn(Date, 'now').mockImplementation(() => {
      wallNow += 1;
      return wallNow;
    });

    const diagnostics = new OrchestratorDiagnostics(
      makeThresholds({
        maxAllowedDriftMs: 999,
        maxAllowedFlushMs: 999,
        maxAllowedSingleStepMs: 999,
        maxAllowedOpenDecisionWindows: 999,
      }),
      2,
    );

    for (let tick = 0; tick < 40; tick += 1) {
      diagnostics.onTickScheduled(tick, 10, 'T1');
      diagnostics.onTickStarted();
      diagnostics.onTickCompleted();
    }

    const snapshot = diagnostics.getSnapshot();

    expect(snapshot.totalTicksObserved).toBe(32);
    expect(snapshot.lastTickIndex).toBe(39);
    expect(snapshot.currentTier).toBe('T1');
    expect(snapshot.lastTick?.tickIndex).toBe(39);
  });

  it('reset() clears history, transient counters, alerts, and last-completed timestamp', () => {
    mockClocks([100, 110], [20_000, 20_010]);

    const diagnostics = new OrchestratorDiagnostics();

    diagnostics.onTickScheduled(3, 10, 'T3');
    diagnostics.onTickStarted();
    diagnostics.onEventEmitted(7);
    diagnostics.onDecisionWindowCountUpdated(4);
    diagnostics.onTickCompleted();

    expect(diagnostics.getSnapshot().totalTicksObserved).toBe(1);
    expect(diagnostics.getLastTickCompletedAtMs()).toBe(20_000);

    diagnostics.reset();

    expect(diagnostics.getLastTickCompletedAtMs()).toBeNull();
    expect(diagnostics.getSnapshot()).toEqual({
      generatedAt: 20_010,
      totalTicksObserved: 0,
      lastTickIndex: 0,
      currentTier: null,
      avgScheduledDurationMs: 0,
      avgActualDurationMs: 0,
      avgDriftMs: 0,
      maxDriftMs: 0,
      avgFlushDurationMs: 0,
      maxFlushDurationMs: 0,
      maxSingleStepMs: 0,
      totalEventsObserved: 0,
      avgEventsPerTick: 0,
      maxOpenDecisionWindowCount: 0,
      tierTransitionCount: 0,
      recentTierSequence: [],
      alerts: [],
      lastTick: null,
    });
  });
});