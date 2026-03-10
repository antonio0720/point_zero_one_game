//backend/src/game/engine/shield/__tests__/ShieldEngine.spec.ts

import { describe, expect, it } from 'vitest';

import { DeterministicClock } from '../../core/ClockSource';
import {
  normalizeEngineTickResult,
  type TickContext,
} from '../../core/EngineContracts';
import { EventBus } from '../../core/EventBus';
import type {
  AttackCategory,
  AttackEvent,
  EngineEventMap,
  ShieldLayerId,
} from '../../core/GamePrimitives';
import type {
  RunStateSnapshot,
  ShieldLayerState,
} from '../../core/RunStateSnapshot';
import { ShieldEngine } from '../ShieldEngine';
import { buildShieldLayerState } from '../types';

function createAttack(
  attackId: string,
  options: {
    readonly category?: AttackCategory;
    readonly targetLayer?: ShieldLayerId | 'DIRECT';
    readonly magnitude?: number;
    readonly createdAtTick?: number;
    readonly notes?: readonly string[];
  } = {},
): AttackEvent {
  return {
    attackId,
    source: 'SYSTEM',
    targetEntity: 'SELF',
    targetLayer: options.targetLayer ?? 'DIRECT',
    category: options.category ?? 'DRAIN',
    magnitude: options.magnitude ?? 10,
    createdAtTick: options.createdAtTick ?? 1,
    notes: [...(options.notes ?? [])],
  };
}

function createLayers(
  overrides: Partial<
    Record<
      ShieldLayerId,
      {
        readonly current: number;
        readonly lastDamagedTick?: number | null;
        readonly lastRecoveredTick?: number | null;
      }
    >
  > = {},
): readonly ShieldLayerState[] {
  return [
    buildShieldLayerState(
      'L1',
      overrides.L1?.current ?? 100,
      overrides.L1?.lastDamagedTick ?? null,
      overrides.L1?.lastRecoveredTick ?? null,
    ),
    buildShieldLayerState(
      'L2',
      overrides.L2?.current ?? 80,
      overrides.L2?.lastDamagedTick ?? null,
      overrides.L2?.lastRecoveredTick ?? null,
    ),
    buildShieldLayerState(
      'L3',
      overrides.L3?.current ?? 60,
      overrides.L3?.lastDamagedTick ?? null,
      overrides.L3?.lastRecoveredTick ?? null,
    ),
    buildShieldLayerState(
      'L4',
      overrides.L4?.current ?? 40,
      overrides.L4?.lastDamagedTick ?? null,
      overrides.L4?.lastRecoveredTick ?? null,
    ),
  ];
}

function computeWeakestLayer(
  layers: readonly ShieldLayerState[],
): { readonly layerId: ShieldLayerId; readonly ratio: number } {
  const ordered = [...layers].sort((left, right) => {
    if (left.integrityRatio !== right.integrityRatio) {
      return left.integrityRatio - right.integrityRatio;
    }

    const order: readonly ShieldLayerId[] = ['L1', 'L2', 'L3', 'L4'];
    return order.indexOf(right.layerId) - order.indexOf(left.layerId);
  });

  return {
    layerId: ordered[0]?.layerId ?? 'L4',
    ratio: ordered[0]?.integrityRatio ?? 0,
  };
}

type SnapshotOverrides = {
  readonly tick?: number;
  readonly outcome?: RunStateSnapshot['outcome'];
  readonly mode?: RunStateSnapshot['mode'];
  readonly phase?: RunStateSnapshot['phase'];
  readonly economy?: Partial<RunStateSnapshot['economy']>;
  readonly pressure?: Partial<RunStateSnapshot['pressure']>;
  readonly tension?: Partial<RunStateSnapshot['tension']>;
  readonly shield?: Partial<RunStateSnapshot['shield']> & {
    readonly layers?: readonly ShieldLayerState[];
  };
  readonly battle?: Partial<RunStateSnapshot['battle']>;
  readonly cascade?: Partial<RunStateSnapshot['cascade']>;
  readonly sovereignty?: Partial<RunStateSnapshot['sovereignty']>;
  readonly cards?: Partial<RunStateSnapshot['cards']>;
  readonly modeState?: Partial<RunStateSnapshot['modeState']>;
  readonly timers?: Partial<RunStateSnapshot['timers']>;
  readonly telemetry?: Partial<RunStateSnapshot['telemetry']>;
};

function createSnapshot(overrides: SnapshotOverrides = {}): RunStateSnapshot {
  const layers = overrides.shield?.layers ?? createLayers();
  const weakest = computeWeakestLayer(layers);

  const base: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-shield-spec',
    userId: 'user-001',
    seed: 'seed-001',
    mode: 'solo',
    tick: 9,
    phase: 'ESCALATION',
    outcome: null,
    tags: [],
    economy: {
      cash: 12_000,
      debt: 500,
      incomePerTick: 1_200,
      expensesPerTick: 400,
      netWorth: 25_000,
      freedomTarget: 100_000,
      haterHeat: 15,
      opportunitiesPurchased: 2,
      privilegePlays: 0,
    },
    pressure: {
      score: 0.15,
      tier: 'T1',
      band: 'BUILDING',
      previousTier: 'T0',
      previousBand: 'CALM',
      upwardCrossings: 1,
      survivedHighPressureTicks: 0,
      lastEscalationTick: 8,
      maxScoreSeen: 0.15,
    },
    tension: {
      score: 0.12,
      anticipation: 0.1,
      visibleThreats: [],
      maxPulseTriggered: false,
      lastSpikeTick: null,
    },
    shield: {
      layers,
      weakestLayerId: weakest.layerId,
      weakestLayerRatio: weakest.ratio,
      blockedThisRun: 0,
      damagedThisRun: 0,
      breachesThisRun: 0,
      repairQueueDepth: 0,
    },
    battle: {
      bots: [],
      battleBudget: 0,
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
      seasonBudgetMs: 120_000,
      extensionBudgetMs: 0,
      elapsedMs: 40_000,
      currentTickDurationMs: 1_000,
      nextTickAtMs: 41_000,
      holdCharges: 0,
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

  const mergedLayers = overrides.shield?.layers ?? base.shield.layers;
  const mergedWeakest = computeWeakestLayer(mergedLayers);

  return {
    ...base,
    tick: overrides.tick ?? base.tick,
    outcome: overrides.outcome ?? base.outcome,
    mode: overrides.mode ?? base.mode,
    phase: overrides.phase ?? base.phase,
    economy: {
      ...base.economy,
      ...overrides.economy,
    },
    pressure: {
      ...base.pressure,
      ...overrides.pressure,
    },
    tension: {
      ...base.tension,
      ...overrides.tension,
    },
    shield: {
      ...base.shield,
      ...overrides.shield,
      layers: mergedLayers,
      weakestLayerId:
        overrides.shield?.weakestLayerId ?? mergedWeakest.layerId,
      weakestLayerRatio:
        overrides.shield?.weakestLayerRatio ?? mergedWeakest.ratio,
    },
    battle: {
      ...base.battle,
      ...overrides.battle,
      bots: overrides.battle?.bots ?? base.battle.bots,
      pendingAttacks:
        overrides.battle?.pendingAttacks ?? base.battle.pendingAttacks,
      neutralizedBotIds:
        overrides.battle?.neutralizedBotIds ?? base.battle.neutralizedBotIds,
    },
    cascade: {
      ...base.cascade,
      ...overrides.cascade,
      activeChains:
        overrides.cascade?.activeChains ?? base.cascade.activeChains,
      positiveTrackers:
        overrides.cascade?.positiveTrackers ?? base.cascade.positiveTrackers,
      repeatedTriggerCounts:
        overrides.cascade?.repeatedTriggerCounts ??
        base.cascade.repeatedTriggerCounts,
    },
    sovereignty: {
      ...base.sovereignty,
      ...overrides.sovereignty,
      tickChecksums:
        overrides.sovereignty?.tickChecksums ?? base.sovereignty.tickChecksums,
      proofBadges:
        overrides.sovereignty?.proofBadges ?? base.sovereignty.proofBadges,
      auditFlags:
        overrides.sovereignty?.auditFlags ?? base.sovereignty.auditFlags,
    },
    cards: {
      ...base.cards,
      ...overrides.cards,
      hand: overrides.cards?.hand ?? base.cards.hand,
      discard: overrides.cards?.discard ?? base.cards.discard,
      exhaust: overrides.cards?.exhaust ?? base.cards.exhaust,
      drawHistory: overrides.cards?.drawHistory ?? base.cards.drawHistory,
      lastPlayed: overrides.cards?.lastPlayed ?? base.cards.lastPlayed,
      ghostMarkers:
        overrides.cards?.ghostMarkers ?? base.cards.ghostMarkers,
    },
    modeState: {
      ...base.modeState,
      ...overrides.modeState,
      trustScores:
        overrides.modeState?.trustScores ?? base.modeState.trustScores,
      roleAssignments:
        overrides.modeState?.roleAssignments ?? base.modeState.roleAssignments,
      defectionStepByPlayer:
        overrides.modeState?.defectionStepByPlayer ??
        base.modeState.defectionStepByPlayer,
      handicapIds:
        overrides.modeState?.handicapIds ?? base.modeState.handicapIds,
      disabledBots:
        overrides.modeState?.disabledBots ?? base.modeState.disabledBots,
    },
    timers: {
      ...base.timers,
      ...overrides.timers,
      activeDecisionWindows:
        overrides.timers?.activeDecisionWindows ??
        base.timers.activeDecisionWindows,
      frozenWindowIds:
        overrides.timers?.frozenWindowIds ?? base.timers.frozenWindowIds,
    },
    telemetry: {
      ...base.telemetry,
      ...overrides.telemetry,
      decisions: overrides.telemetry?.decisions ?? base.telemetry.decisions,
      forkHints: overrides.telemetry?.forkHints ?? base.telemetry.forkHints,
      warnings: overrides.telemetry?.warnings ?? base.telemetry.warnings,
    },
  };
}

function createContext(
  snapshot: RunStateSnapshot,
  bus: EventBus<EngineEventMap & Record<string, unknown>>,
): TickContext {
  const clock = new DeterministicClock(snapshot.tick * 1_000);

  return {
    step: 'STEP_06_SHIELD',
    nowMs: clock.now(),
    clock,
    bus,
    trace: {
      runId: snapshot.runId,
      tick: snapshot.tick,
      step: 'STEP_06_SHIELD',
      mode: snapshot.mode,
      phase: snapshot.phase,
      traceId: `trace-${snapshot.tick}`,
    },
  };
}

function signalCodes(result: ReturnType<typeof normalizeEngineTickResult>): string[] {
  return (result.signals ?? []).map((signal) => signal.code);
}

describe('ShieldEngine', () => {
  it('skips terminal outcomes without mutating the snapshot or emitting bus events', () => {
    const engine = new ShieldEngine();
    const snapshot = createSnapshot({ outcome: 'BANKRUPT' });
    const bus = new EventBus<EngineEventMap & Record<string, unknown>>();

    const result = normalizeEngineTickResult(
      engine.engineId,
      snapshot.tick,
      engine.tick(snapshot, createContext(snapshot, bus)),
    );

    expect(result.snapshot).toBe(snapshot);
    expect(signalCodes(result)).toContain('SHIELD_SKIPPED_TERMINAL_OUTCOME');
    expect(bus.historyCount()).toBe(0);
  });

  it('reinterprets DIRECT attacks through shield doctrine and never mutates economy cash directly', () => {
    const engine = new ShieldEngine();
    const snapshot = createSnapshot({
      battle: {
        pendingAttacks: [
          createAttack('direct-extraction', {
            category: 'EXTRACTION',
            targetLayer: 'DIRECT',
            magnitude: 30,
            notes: ['financial-sabotage'],
          }),
        ],
      },
    });
    const bus = new EventBus<EngineEventMap & Record<string, unknown>>();

    const result = normalizeEngineTickResult(
      engine.engineId,
      snapshot.tick,
      engine.tick(snapshot, createContext(snapshot, bus)),
    );

    expect(result.snapshot.economy.cash).toBe(snapshot.economy.cash);
    expect(result.snapshot.battle.pendingAttacks).toEqual([]);
    expect(
      result.snapshot.shield.layers.find((layer) => layer.layerId === 'L1')?.current,
    ).toBe(73);
    expect(signalCodes(result)).toContain('SHIELD_DIRECT_ATTACK_REINTERPRETED');
  });

  it('critical hits bypass deflection and never overflow from L1 into L2', () => {
    const engine = new ShieldEngine();
    const snapshot = createSnapshot({
      battle: {
        pendingAttacks: [
          createAttack('critical-liquidity-break', {
            category: 'EXTRACTION',
            targetLayer: 'L1',
            magnitude: 150,
            notes: ['critical', 'financial-sabotage'],
          }),
        ],
      },
    });
    const bus = new EventBus<EngineEventMap & Record<string, unknown>>();

    const result = normalizeEngineTickResult(
      engine.engineId,
      snapshot.tick,
      engine.tick(snapshot, createContext(snapshot, bus)),
    );

    expect(
      result.snapshot.shield.layers.find((layer) => layer.layerId === 'L1')?.current,
    ).toBe(0);
    expect(
      result.snapshot.shield.layers.find((layer) => layer.layerId === 'L2')?.current,
    ).toBe(80);
    expect(result.snapshot.shield.breachesThisRun).toBe(1);
    expect(signalCodes(result)).toContain('SHIELD_LAYER_BREACHED');
    expect(engine.getHealth().status).toBe('DEGRADED');
  });

  it('triggers cascade on L4 breach, emits bus events, and cracks outer layers to doctrine values', () => {
    const engine = new ShieldEngine();
    const snapshot = createSnapshot({
      battle: {
        pendingAttacks: [
          createAttack('network-core-breach', {
            category: 'BREACH',
            targetLayer: 'L4',
            magnitude: 40,
            notes: ['critical', 'reputation-attack'],
          }),
        ],
      },
    });
    const bus = new EventBus<EngineEventMap & Record<string, unknown>>();

    const result = normalizeEngineTickResult(
      engine.engineId,
      snapshot.tick,
      engine.tick(snapshot, createContext(snapshot, bus)),
    );

    expect(
      result.snapshot.shield.layers.find((layer) => layer.layerId === 'L1')?.current,
    ).toBe(20);
    expect(
      result.snapshot.shield.layers.find((layer) => layer.layerId === 'L2')?.current,
    ).toBe(16);
    expect(
      result.snapshot.shield.layers.find((layer) => layer.layerId === 'L3')?.current,
    ).toBe(12);
    expect(
      result.snapshot.shield.layers.find((layer) => layer.layerId === 'L4')?.current,
    ).toBe(0);

    expect(bus.last('shield.breached')?.payload).toEqual({
      attackId: 'network-core-breach',
      layerId: 'L4',
      tick: snapshot.tick,
      cascadesTriggered: 1,
    });
    expect(bus.last('cascade.chain.created')?.payload).toEqual(
      expect.objectContaining({
        templateId: 'NETWORK_LOCKDOWN',
        positive: false,
      }),
    );
    expect(signalCodes(result)).toEqual(
      expect.arrayContaining([
        'SHIELD_LAYER_BREACHED',
        'SHIELD_CASCADE_TRIGGERED',
      ]),
    );
    expect(engine.getCascadeCount()).toBe(1);
  });

  it('applies queued repairs before passive regen in the same shield tick', () => {
    const engine = new ShieldEngine();
    const snapshot = createSnapshot({
      tick: 14,
      shield: {
        layers: createLayers({
          L1: { current: 50, lastDamagedTick: 13 },
        }),
      },
    });
    const bus = new EventBus<EngineEventMap & Record<string, unknown>>();

    expect(engine.queueRepair(snapshot.tick, 'L1', 20, 2)).toBe(true);

    const result = normalizeEngineTickResult(
      engine.engineId,
      snapshot.tick,
      engine.tick(snapshot, createContext(snapshot, bus)),
    );

    expect(
      result.snapshot.shield.layers.find((layer) => layer.layerId === 'L1')?.current,
    ).toBe(62);
    expect(result.snapshot.shield.repairQueueDepth).toBe(1);
  });

  it('emits queue-full diagnostics when a fourth repair is rejected', () => {
    const engine = new ShieldEngine();
    const snapshot = createSnapshot({ tick: 16 });
    const bus = new EventBus<EngineEventMap & Record<string, unknown>>();

    expect(engine.queueRepair(snapshot.tick, 'L2', 10, 2)).toBe(true);
    expect(engine.queueRepair(snapshot.tick, 'L2', 10, 2)).toBe(true);
    expect(engine.queueRepair(snapshot.tick, 'L2', 10, 2)).toBe(true);
    expect(engine.queueRepair(snapshot.tick, 'L2', 10, 2)).toBe(false);

    const result = normalizeEngineTickResult(
      engine.engineId,
      snapshot.tick,
      engine.tick(snapshot, createContext(snapshot, bus)),
    );

    expect(signalCodes(result)).toContain('SHIELD_REPAIR_QUEUE_FULL');
    expect(engine.getHealth().status).toBe('DEGRADED');
  });

  it('emits restoration diagnostics when a breached layer is brought back above zero', () => {
    const engine = new ShieldEngine();
    const snapshot = createSnapshot({
      tick: 18,
      shield: {
        layers: createLayers({
          L1: {
            current: 0,
            lastDamagedTick: 17,
          },
        }),
      },
    });
    const bus = new EventBus<EngineEventMap & Record<string, unknown>>();

    expect(engine.queueRepair(snapshot.tick, 'L1', 1, 1)).toBe(true);

    const result = normalizeEngineTickResult(
      engine.engineId,
      snapshot.tick,
      engine.tick(snapshot, createContext(snapshot, bus)),
    );

    expect(
      result.snapshot.shield.layers.find((layer) => layer.layerId === 'L1')?.breached,
    ).toBe(false);
    expect(signalCodes(result)).toContain('SHIELD_LAYER_RESTORED');
  });

  it('reset clears volatile runtime history and cascade counters', () => {
    const engine = new ShieldEngine();
    const snapshot = createSnapshot({
      battle: {
        pendingAttacks: [
          createAttack('reset-breach', {
            category: 'BREACH',
            targetLayer: 'L4',
            magnitude: 40,
            notes: ['critical', 'reputation-attack'],
          }),
        ],
      },
    });

    normalizeEngineTickResult(
      engine.engineId,
      snapshot.tick,
      engine.tick(snapshot, createContext(snapshot, new EventBus<EngineEventMap & Record<string, unknown>>())),
    );

    expect(engine.getCascadeCount()).toBe(1);
    expect(engine.getBreachHistory().length).toBeGreaterThan(0);
    expect(engine.getCascadeHistory().length).toBeGreaterThan(0);

    engine.reset();

    expect(engine.getCascadeCount()).toBe(0);
    expect(engine.getBreachHistory()).toEqual([]);
    expect(engine.getCascadeHistory()).toEqual([]);
    expect(engine.getActiveRepairJobs()).toEqual([]);
    expect(engine.getHealth().status).toBe('HEALTHY');
  });
});