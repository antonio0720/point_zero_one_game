// backend/src/game/engine/time/__tests__/TimeEngine.determinism.test.ts
import { describe, expect, it } from 'vitest';

import { DeterministicClock } from '../../core/ClockSource';
import { EngineTickTransaction } from '../../core/EngineTickTransaction';
import type { TickContext } from '../../core/EngineContracts';
import { EventBus, type EventEnvelope } from '../../core/EventBus';
import type { EngineEventMap } from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { TimeEngine } from '../TimeEngine';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly (infer U)[]
    ? readonly U[]
    : T[K] extends Record<string, unknown>
      ? DeepPartial<T[K]>
      : T[K];
};

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
    readonly event: keyof EngineEventMap;
    readonly payload: EngineEventMap[keyof EngineEventMap];
    readonly emittedAtTick?: number;
    readonly tags?: readonly string[];
  }[];
}

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
      battleBudget: 10,
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
      seasonBudgetMs: 90_000,
      extensionBudgetMs: 0,
      elapsedMs: 0,
      currentTickDurationMs: 13_000,
      nextTickAtMs: null,
      holdCharges: 1,
      activeDecisionWindows: {
        window_alpha: 1_500,
      },
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
  bus: EventBus<EngineEventMap>,
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

function cloneSignals(signals: readonly any[] | undefined) {
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
  events: readonly EventEnvelope<keyof EngineEventMap, EngineEventMap[keyof EngineEventMap]>[],
): TickRunRecord['events'] {
  return events.map((event) => ({
    sequence: event.sequence,
    event: event.event,
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
      tier,
    },
  };
}

function runScenario(engine: TimeEngine): readonly TickRunRecord[] {
  const bus = new EventBus<EngineEventMap>();
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