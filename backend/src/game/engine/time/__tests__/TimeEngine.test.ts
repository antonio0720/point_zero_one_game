// backend/src/game/engine/time/__tests__/TimeEngine.test.ts
import { beforeEach, describe, expect, it } from 'vitest';

import { DeterministicClock } from '../../core/ClockSource';
import { EventBus } from '../../core/EventBus';
import type { TickContext } from '../../core/EngineContracts';
import type { EngineEventMap } from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { TimeEngine } from '../TimeEngine';
import { DEFAULT_PHASE_TRANSITION_WINDOWS } from '../types';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly (infer U)[]
    ? readonly U[]
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};

function createSnapshot(overrides: DeepPartial<RunStateSnapshot> = {}): RunStateSnapshot {
  const base: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run_test_001',
    userId: 'user_test_001',
    seed: 'seed_alpha',
    mode: 'solo',
    tick: 0,
    phase: 'FOUNDATION',
    outcome: null,
    tags: [],
    economy: {
      cash: 1_000,
      debt: 100,
      incomePerTick: 200,
      expensesPerTick: 75,
      netWorth: 900,
      freedomTarget: 100_000,
      haterHeat: 10,
      opportunitiesPurchased: 0,
      privilegePlays: 0,
    },
    pressure: {
      score: 0.25,
      tier: 'T1',
      band: 'BUILDING',
      previousTier: 'T1',
      previousBand: 'BUILDING',
      upwardCrossings: 0,
      survivedHighPressureTicks: 0,
      lastEscalationTick: null,
      maxScoreSeen: 0.25,
    },
    tension: {
      score: 0.1,
      anticipation: 0.1,
      visibleThreats: [],
      maxPulseTriggered: false,
      lastSpikeTick: null,
    },
    shield: {
      layers: [],
      weakestLayerId: 'L1',
      weakestLayerRatio: 1,
      blockedThisRun: 0,
      damagedThisRun: 0,
      breachesThisRun: 0,
      repairQueueDepth: 0,
    },
    battle: {
      bots: [],
      battleBudget: 100,
      battleBudgetCap: 100,
      extractionCooldownTicks: 0,
      firstBloodClaimed: false,
      pendingAttacks: [],
      sharedOpportunityDeckCursor: 0,
      rivalryHeatCarry: 0,
      neutralizedBotIds: [],
    },
    cascade: {
      activeChains: [],
      positiveTrackers: [],
      brokenChains: 0,
      completedChains: 0,
      repeatedTriggerCounts: {},
      lastResolvedTick: null,
    },
    sovereignty: {
      integrityStatus: 'PENDING',
      tickChecksums: [],
      proofHash: null,
      sovereigntyScore: 0,
      verifiedGrade: null,
      proofBadges: [],
      gapVsLegend: 0,
      gapClosingRate: 0,
      cordScore: 0,
      auditFlags: [],
      lastVerifiedTick: null,
    },
    cards: {
      hand: [],
      discard: [],
      exhaust: [],
      drawHistory: [],
      lastPlayed: [],
      ghostMarkers: [],
      drawPileSize: 0,
      deckEntropy: 0,
    },
    modeState: {
      holdEnabled: true,
      loadoutEnabled: true,
      sharedTreasury: false,
      sharedTreasuryBalance: 0,
      trustScores: {},
      roleAssignments: {},
      defectionStepByPlayer: {},
      legendMarkersEnabled: false,
      communityHeatModifier: 0,
      sharedOpportunityDeck: false,
      counterIntelTier: 0,
      spectatorLimit: 0,
      phaseBoundaryWindowsRemaining: 0,
      bleedMode: false,
      handicapIds: [],
      advantageId: null,
      disabledBots: [],
      modePresentation: 'empire',
      roleLockEnabled: false,
      extractionActionsRemaining: 0,
      ghostBaselineRunId: null,
      legendOwnerUserId: null,
    },
    timers: {
      seasonBudgetMs: 60_000,
      extensionBudgetMs: 0,
      elapsedMs: 0,
      currentTickDurationMs: 13_000,
      nextTickAtMs: null,
      holdCharges: 1,
      activeDecisionWindows: {},
      frozenWindowIds: [],
    },
    telemetry: {
      decisions: [],
      outcomeReason: null,
      outcomeReasonCode: null,
      lastTickChecksum: null,
      forkHints: [],
      emittedEventCount: 0,
      warnings: [],
    },
  };

  return {
    ...base,
    ...overrides,
    economy: { ...base.economy, ...(overrides.economy ?? {}) },
    pressure: { ...base.pressure, ...(overrides.pressure ?? {}) },
    tension: { ...base.tension, ...(overrides.tension ?? {}) },
    shield: { ...base.shield, ...(overrides.shield ?? {}) },
    battle: { ...base.battle, ...(overrides.battle ?? {}) },
    cascade: { ...base.cascade, ...(overrides.cascade ?? {}) },
    sovereignty: { ...base.sovereignty, ...(overrides.sovereignty ?? {}) },
    cards: { ...base.cards, ...(overrides.cards ?? {}) },
    modeState: { ...base.modeState, ...(overrides.modeState ?? {}) },
    timers: { ...base.timers, ...(overrides.timers ?? {}) },
    telemetry: { ...base.telemetry, ...(overrides.telemetry ?? {}) },
  };
}

function createContext(
  bus: EventBus<EngineEventMap & Record<string, unknown>>,
  nowMs = 1_000,
  step: TickContext['step'] = 'STEP_02_TIME',
): TickContext {
  const clock = new DeterministicClock(nowMs);

  return {
    step,
    nowMs,
    clock,
    bus,
    trace: {
      runId: 'run_test_001',
      tick: 0,
      step,
      mode: 'solo',
      phase: 'FOUNDATION',
      traceId: 'trace_test_001',
    },
  };
}

describe('backend time/TimeEngine', () => {
  let engine: TimeEngine;
  let bus: EventBus<EngineEventMap & Record<string, unknown>>;

  beforeEach(() => {
    engine = new TimeEngine();
    bus = new EventBus<EngineEventMap & Record<string, unknown>>();
  });

  it('runs only on STEP_02_TIME while the run is non-terminal', () => {
    const snapshot = createSnapshot();
    const timeContext = createContext(bus, 1_000, 'STEP_02_TIME');
    const pressureContext = createContext(bus, 1_000, 'STEP_03_PRESSURE');

    expect(engine.canRun(snapshot, timeContext)).toBe(true);
    expect(engine.canRun(snapshot, pressureContext)).toBe(false);
    expect(engine.canRun(createSnapshot({ outcome: 'TIMEOUT' }), timeContext)).toBe(false);
  });

  it('advances tick, elapsed budget, next fire time, and cadence duration', () => {
    const snapshot = createSnapshot({
      timers: {
        seasonBudgetMs: 90_000,
        extensionBudgetMs: 0,
        elapsedMs: 5_000,
        currentTickDurationMs: 13_000,
        nextTickAtMs: null,
        holdCharges: 1,
        activeDecisionWindows: {},
        frozenWindowIds: [],
      },
      pressure: {
        tier: 'T1',
      },
    });

    const result = engine.tick(snapshot, createContext(bus, 2_500));
    const nextSnapshot = 'snapshot' in result ? result.snapshot : result;

    expect(nextSnapshot.tick).toBe(1);
    expect(nextSnapshot.timers.elapsedMs).toBe(18_000);
    expect(nextSnapshot.timers.currentTickDurationMs).toBe(13_000);
    expect(nextSnapshot.timers.nextTickAtMs).toBe(15_500);
    expect(nextSnapshot.outcome).toBeNull();
  });

  it('emits decision.window.opened for newly hydrated windows from snapshot state', () => {
    const snapshot = createSnapshot({
      timers: {
        seasonBudgetMs: 90_000,
        extensionBudgetMs: 0,
        elapsedMs: 0,
        currentTickDurationMs: 13_000,
        nextTickAtMs: null,
        holdCharges: 1,
        activeDecisionWindows: {
          window_alpha: 7_500,
        },
        frozenWindowIds: [],
      },
    });

    engine.tick(snapshot, createContext(bus, 2_500));

    const opened = bus.peek('decision.window.opened');

    expect(opened).toHaveLength(1);
    expect(opened[0]).toEqual({
      windowId: 'window_alpha',
      tick: 1,
      durationMs: 5_000,
    });
  });

  it('expires overdue windows, emits close events, and tags the snapshot', () => {
    const snapshot = createSnapshot({
      timers: {
        seasonBudgetMs: 90_000,
        extensionBudgetMs: 0,
        elapsedMs: 0,
        currentTickDurationMs: 13_000,
        nextTickAtMs: null,
        holdCharges: 1,
        activeDecisionWindows: {
          window_expired: 900,
        },
        frozenWindowIds: [],
      },
    });

    const result = engine.tick(snapshot, createContext(bus, 1_000));
    const nextSnapshot = 'snapshot' in result ? result.snapshot : result;
    const signals = 'signals' in result && result.signals !== undefined ? result.signals : [];

    expect(nextSnapshot.timers.activeDecisionWindows).toEqual({});
    expect(nextSnapshot.tags).toContain('decision_window:expired');
    expect(bus.peek('decision.window.closed')).toEqual([
      {
        windowId: 'window_expired',
        tick: 1,
        accepted: false,
      },
    ]);
    expect(signals.map((signal) => signal.code)).toContain('TIME_DECISION_WINDOW_EXPIRED');
  });

  it('advances phase and resets phase boundary windows when a boundary is crossed', () => {
    const snapshot = createSnapshot({
      phase: 'FOUNDATION',
      modeState: {
        phaseBoundaryWindowsRemaining: 1,
      },
      timers: {
        seasonBudgetMs: 600_000,
        extensionBudgetMs: 0,
        elapsedMs: (4 * 60 * 1_000) - 1_000,
        currentTickDurationMs: 13_000,
        nextTickAtMs: null,
        holdCharges: 1,
        activeDecisionWindows: {},
        frozenWindowIds: [],
      },
    });

    const result = engine.tick(snapshot, createContext(bus, 3_000));
    const nextSnapshot = 'snapshot' in result ? result.snapshot : result;

    expect(nextSnapshot.phase).toBe('ESCALATION');
    expect(nextSnapshot.modeState.phaseBoundaryWindowsRemaining).toBe(
      DEFAULT_PHASE_TRANSITION_WINDOWS,
    );
    expect(nextSnapshot.tags).toContain('phase:escalation:entered');
  });

  it('marks the run as TIMEOUT when the season budget is exhausted', () => {
    const snapshot = createSnapshot({
      timers: {
        seasonBudgetMs: 10_000,
        extensionBudgetMs: 0,
        elapsedMs: 0,
        currentTickDurationMs: 13_000,
        nextTickAtMs: null,
        holdCharges: 1,
        activeDecisionWindows: {},
        frozenWindowIds: [],
      },
    });

    const result = engine.tick(snapshot, createContext(bus, 4_000));
    const nextSnapshot = 'snapshot' in result ? result.snapshot : result;
    const signals = 'signals' in result && result.signals !== undefined ? result.signals : [];

    expect(nextSnapshot.outcome).toBe('TIMEOUT');
    expect(nextSnapshot.timers.nextTickAtMs).toBeNull();
    expect(nextSnapshot.telemetry.outcomeReasonCode).toBe('SEASON_BUDGET_EXHAUSTED');
    expect(nextSnapshot.telemetry.outcomeReason).toMatch(/season budget exhausted/i);
    expect(nextSnapshot.telemetry.warnings).toContain('Season budget exhausted.');
    expect(nextSnapshot.tags).toContain('run:timeout');
    expect(signals.map((signal) => signal.code)).toContain('TIME_SEASON_BUDGET_EXHAUSTED');
  });

  it('reports healthy runtime notes that reflect active local window state', () => {
    engine.openDecisionWindow('window_health', 12_000);

    const health = engine.getHealth();

    expect(health.engineId).toBe('time');
    expect(health.status).toBe('HEALTHY');
    expect(health.notes?.some((note) => note.includes('activeDecisionWindows=1'))).toBe(true);
  });
});