import { beforeEach, describe, expect, it } from 'vitest';

import { DeterministicClock } from '../../core/ClockSource';
import { EngineTickTransaction } from '../../core/EngineTickTransaction';
import type { TickContext } from '../../core/EngineContracts';
import { EventBus } from '../../core/EventBus';
import type { EngineEventMap } from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { TimeEngine } from '../TimeEngine';

type EngineBusEventMap = EngineEventMap & Record<string, unknown>;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly (infer U)[]
    ? readonly U[]
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};

type ActiveDecisionWindows = RunStateSnapshot['timers']['activeDecisionWindows'];
type ActiveDecisionWindowValue = ActiveDecisionWindows[string];

function createActiveDecisionWindowValue(
  deadlineMs: number,
): ActiveDecisionWindowValue {
  /**
   * Public GitHub currently exposes the timer snapshot as Record<string, number>,
   * while the local workspace compiler is expecting RuntimeDecisionWindowSnapshot.
   *
   * This helper preserves the runtime deadline semantics used by the existing test
   * while allowing the file to compile against the richer local timer contract.
   */
  return deadlineMs as unknown as ActiveDecisionWindowValue;
}

function createSnapshot(
  overrides: DeepPartial<RunStateSnapshot> = {},
): RunStateSnapshot {
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
      activeDecisionWindows: {} as ActiveDecisionWindows,
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

function executeTimeTick(
  engine: TimeEngine,
  snapshot: RunStateSnapshot,
  bus: EventBus<EngineBusEventMap>,
  nowMs: number,
) {
  return EngineTickTransaction.execute(
    engine,
    snapshot,
    createContext(bus, snapshot, nowMs),
  );
}

describe('backend time/TimeEngine.integration', () => {
  let engine: TimeEngine;
  let bus: EventBus<EngineBusEventMap>;

  beforeEach(() => {
    engine = new TimeEngine();
    bus = new EventBus<EngineBusEventMap>();
  });

  it('executes hydrated-open -> expired -> timeout as a stable multi-tick transaction chain', () => {
    const initialSnapshot = createSnapshot({
      timers: {
        seasonBudgetMs: 39_000,
        extensionBudgetMs: 0,
        elapsedMs: 0,
        currentTickDurationMs: 13_000,
        nextTickAtMs: null,
        holdCharges: 1,
        activeDecisionWindows: {
          window_alpha: createActiveDecisionWindowValue(1_500),
        } as ActiveDecisionWindows,
        frozenWindowIds: [],
      },
    });

    const first = executeTimeTick(engine, initialSnapshot, bus, 1_000);
    const firstSnapshot = first.snapshot;
    const firstSignals = first.signals ?? [];
    const firstQueue = bus.flush();

    expect(firstSnapshot.tick).toBe(1);
    expect(firstSnapshot.outcome).toBeNull();
    expect(firstSnapshot.timers.elapsedMs).toBe(13_000);
    expect(firstSnapshot.timers.currentTickDurationMs).toBe(13_000);
    expect(firstSnapshot.timers.nextTickAtMs).toBe(14_000);
    expect(firstSnapshot.timers.activeDecisionWindows).toEqual({
      window_alpha: createActiveDecisionWindowValue(1_500),
    });
    expect(firstSignals).toEqual([]);
    expect(firstQueue.map((entry) => entry.event)).toEqual([
      'decision.window.opened',
    ]);
    expect(firstQueue[0]?.payload).toEqual({
      windowId: 'window_alpha',
      tick: 1,
      durationMs: 500,
    });

    const second = executeTimeTick(engine, firstSnapshot, bus, 14_000);
    const secondSnapshot = second.snapshot;
    const secondSignals = second.signals ?? [];
    const secondQueue = bus.flush();

    expect(secondSnapshot.tick).toBe(2);
    expect(secondSnapshot.outcome).toBeNull();
    expect(secondSnapshot.timers.elapsedMs).toBe(26_000);
    expect(secondSnapshot.timers.activeDecisionWindows).toEqual({});
    expect(secondSnapshot.tags).toContain('decision_window:expired');
    expect(secondSignals.map((signal) => signal.code)).toContain(
      'TIME_DECISION_WINDOW_EXPIRED',
    );
    expect(secondQueue.map((entry) => entry.event)).toEqual([
      'decision.window.closed',
    ]);
    expect(secondQueue[0]?.payload).toEqual({
      windowId: 'window_alpha',
      tick: 2,
      accepted: false,
    });

    const third = executeTimeTick(engine, secondSnapshot, bus, 27_000);
    const thirdSnapshot = third.snapshot;
    const thirdSignals = third.signals ?? [];
    const thirdQueue = bus.flush();

    expect(thirdSnapshot.tick).toBe(3);
    expect(thirdSnapshot.outcome).toBe('TIMEOUT');
    expect(thirdSnapshot.timers.elapsedMs).toBe(39_000);
    expect(thirdSnapshot.timers.nextTickAtMs).toBeNull();
    expect(thirdSnapshot.telemetry.outcomeReasonCode).toBe(
      'SEASON_BUDGET_EXHAUSTED',
    );
    expect(thirdSnapshot.telemetry.outcomeReason).toMatch(
      /season budget exhausted/i,
    );
    expect(thirdSnapshot.telemetry.warnings).toContain(
      'Season budget exhausted.',
    );
    expect(thirdSnapshot.tags).toContain('run:timeout');
    expect(thirdSignals.map((signal) => signal.code)).toContain(
      'TIME_SEASON_BUDGET_EXHAUSTED',
    );
    expect(thirdQueue).toEqual([]);
  });

  it('returns a transactional skip surface when the engine cannot legally run for the current step', () => {
    const snapshot = createSnapshot();

    const skipped = EngineTickTransaction.execute(
      engine,
      snapshot,
      createContext(bus, snapshot, 1_000, 'STEP_03_PRESSURE'),
    );

    expect(skipped.snapshot).toBe(snapshot);
    expect(skipped.signals?.map((signal) => signal.code)).toEqual([
      'ENGINE_SKIPPED',
    ]);
    expect(bus.flush()).toEqual([]);
  });
});