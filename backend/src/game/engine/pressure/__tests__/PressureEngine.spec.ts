//backend/src/game/engine/pressure/__tests__/PressureEngine.spec.ts

import { describe, expect, it } from 'vitest';

import type {
  AttackEvent,
  CascadeChainInstance,
  EngineEventMap,
  HaterBotId,
  ShieldLayerId,
} from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import type { TickContext } from '../../core/EngineContracts';
import { EventBus } from '../../core/EventBus';
import { PressureEngine } from '../PressureEngine';

type SnapshotOverrides = {
  runId?: RunStateSnapshot['runId'];
  userId?: RunStateSnapshot['userId'];
  seed?: RunStateSnapshot['seed'];
  mode?: RunStateSnapshot['mode'];
  phase?: RunStateSnapshot['phase'];
  outcome?: RunStateSnapshot['outcome'];
  tick?: number;
  economy?: Partial<RunStateSnapshot['economy']>;
  pressure?: Partial<RunStateSnapshot['pressure']>;
  tension?: Partial<RunStateSnapshot['tension']>;
  shield?: Partial<RunStateSnapshot['shield']>;
  battle?: Partial<RunStateSnapshot['battle']>;
  cascade?: Partial<RunStateSnapshot['cascade']>;
  sovereignty?: Partial<RunStateSnapshot['sovereignty']>;
  cards?: Partial<RunStateSnapshot['cards']>;
  modeState?: Partial<RunStateSnapshot['modeState']>;
  timers?: Partial<RunStateSnapshot['timers']>;
  telemetry?: Partial<RunStateSnapshot['telemetry']>;
};

function createAttack(overrides: Partial<AttackEvent> = {}): AttackEvent {
  return {
    attackId: overrides.attackId ?? 'attack-1',
    source: overrides.source ?? 'SYSTEM',
    targetEntity: overrides.targetEntity ?? 'SELF',
    targetLayer: overrides.targetLayer ?? 'L1',
    category: overrides.category ?? 'DRAIN',
    magnitude: overrides.magnitude ?? 10,
    createdAtTick: overrides.createdAtTick ?? 1,
    notes: overrides.notes ?? [],
  };
}

function createChain(overrides: Partial<CascadeChainInstance> = {}): CascadeChainInstance {
  return {
    chainId: overrides.chainId ?? 'chain-1',
    templateId: overrides.templateId ?? 'tpl-1',
    trigger: overrides.trigger ?? 'test-trigger',
    positive: overrides.positive ?? false,
    status: overrides.status ?? 'ACTIVE',
    createdAtTick: overrides.createdAtTick ?? 1,
    links: overrides.links ?? [],
    recoveryTags: overrides.recoveryTags ?? [],
  };
}

function createShieldLayers(
  integrityRatios: readonly number[] = [1, 1, 1, 1],
  breachedIds: readonly ShieldLayerId[] = [],
): RunStateSnapshot['shield']['layers'] {
  const ids: readonly ShieldLayerId[] = ['L1', 'L2', 'L3', 'L4'];
  const labels = ['CASH_RESERVE', 'CREDIT_LINE', 'INCOME_BASE', 'NETWORK_CORE'] as const;

  return ids.map((layerId, index) => {
    const integrityRatio = integrityRatios[index] ?? 1;
    return {
      layerId,
      label: labels[index],
      current: Math.round(100 * integrityRatio),
      max: 100,
      regenPerTick: 5,
      breached: breachedIds.includes(layerId),
      integrityRatio,
      lastDamagedTick: integrityRatio < 1 ? 1 : null,
      lastRecoveredTick: integrityRatio === 1 ? 0 : null,
    };
  });
}

function createSnapshot(overrides: SnapshotOverrides = {}): RunStateSnapshot {
  const shieldLayers = overrides.shield?.layers ?? createShieldLayers();
  const weakestLayer = shieldLayers.reduce((lowest, layer) =>
    layer.integrityRatio < lowest.integrityRatio ? layer : lowest,
  );

  const base: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-pressure-engine-spec',
    userId: 'user-1',
    seed: 'seed-1',
    mode: 'solo',
    tick: 12,
    phase: 'FOUNDATION',
    outcome: null,
    tags: [],
    economy: {
      cash: 12_000,
      debt: 0,
      incomePerTick: 1_500,
      expensesPerTick: 500,
      netWorth: 50_000,
      freedomTarget: 100_000,
      haterHeat: 10,
      opportunitiesPurchased: 1,
      privilegePlays: 0,
    },
    pressure: {
      score: 0,
      tier: 'T0',
      band: 'CALM',
      previousTier: 'T0',
      previousBand: 'CALM',
      upwardCrossings: 0,
      survivedHighPressureTicks: 0,
      lastEscalationTick: null,
      maxScoreSeen: 0,
    },
    tension: {
      score: 0,
      anticipation: 0,
      visibleThreats: [],
      maxPulseTriggered: false,
      lastSpikeTick: null,
    },
    shield: {
      layers: shieldLayers,
      weakestLayerId: weakestLayer.layerId,
      weakestLayerRatio: weakestLayer.integrityRatio,
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
      neutralizedBotIds: [] as readonly HaterBotId[],
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
      seasonBudgetMs: 100_000,
      extensionBudgetMs: 0,
      elapsedMs: 20_000,
      currentTickDurationMs: 1_000,
      nextTickAtMs: null,
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

  return {
    ...base,
    runId: overrides.runId ?? base.runId,
    userId: overrides.userId ?? base.userId,
    seed: overrides.seed ?? base.seed,
    mode: overrides.mode ?? base.mode,
    phase: overrides.phase ?? base.phase,
    outcome: overrides.outcome ?? base.outcome,
    tick: overrides.tick ?? base.tick,
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
      layers: overrides.shield?.layers ?? base.shield.layers,
      weakestLayerId:
        overrides.shield?.weakestLayerId ??
        (overrides.shield?.layers ?? base.shield.layers).reduce((lowest, layer) =>
          layer.integrityRatio < lowest.integrityRatio ? layer : lowest,
        ).layerId,
      weakestLayerRatio:
        overrides.shield?.weakestLayerRatio ??
        (overrides.shield?.layers ?? base.shield.layers).reduce((lowest, layer) =>
          layer.integrityRatio < lowest.integrityRatio ? layer : lowest,
        ).integrityRatio,
    },
    battle: {
      ...base.battle,
      ...overrides.battle,
      bots: overrides.battle?.bots ?? base.battle.bots,
      pendingAttacks: overrides.battle?.pendingAttacks ?? base.battle.pendingAttacks,
      neutralizedBotIds:
        overrides.battle?.neutralizedBotIds ?? base.battle.neutralizedBotIds,
    },
    cascade: {
      ...base.cascade,
      ...overrides.cascade,
      activeChains: overrides.cascade?.activeChains ?? base.cascade.activeChains,
      positiveTrackers:
        overrides.cascade?.positiveTrackers ?? base.cascade.positiveTrackers,
      repeatedTriggerCounts:
        overrides.cascade?.repeatedTriggerCounts ?? base.cascade.repeatedTriggerCounts,
    },
    sovereignty: {
      ...base.sovereignty,
      ...overrides.sovereignty,
      tickChecksums:
        overrides.sovereignty?.tickChecksums ?? base.sovereignty.tickChecksums,
      proofBadges:
        overrides.sovereignty?.proofBadges ?? base.sovereignty.proofBadges,
      auditFlags: overrides.sovereignty?.auditFlags ?? base.sovereignty.auditFlags,
    },
    cards: {
      ...base.cards,
      ...overrides.cards,
      hand: overrides.cards?.hand ?? base.cards.hand,
      discard: overrides.cards?.discard ?? base.cards.discard,
      exhaust: overrides.cards?.exhaust ?? base.cards.exhaust,
      drawHistory: overrides.cards?.drawHistory ?? base.cards.drawHistory,
      lastPlayed: overrides.cards?.lastPlayed ?? base.cards.lastPlayed,
      ghostMarkers: overrides.cards?.ghostMarkers ?? base.cards.ghostMarkers,
    },
    modeState: {
      ...base.modeState,
      ...overrides.modeState,
      trustScores: overrides.modeState?.trustScores ?? base.modeState.trustScores,
      roleAssignments:
        overrides.modeState?.roleAssignments ?? base.modeState.roleAssignments,
      defectionStepByPlayer:
        overrides.modeState?.defectionStepByPlayer ??
        base.modeState.defectionStepByPlayer,
      handicapIds: overrides.modeState?.handicapIds ?? base.modeState.handicapIds,
      disabledBots: overrides.modeState?.disabledBots ?? base.modeState.disabledBots,
    },
    timers: {
      ...base.timers,
      ...overrides.timers,
      activeDecisionWindows:
        overrides.timers?.activeDecisionWindows ?? base.timers.activeDecisionWindows,
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
  bus: EventBus<EngineEventMap & Record<string, unknown>> = new EventBus<
    EngineEventMap & Record<string, unknown>
  >(),
): TickContext {
  return {
    step: 'STEP_03_PRESSURE',
    nowMs: 1_000 + snapshot.tick,
    clock: {
      now: () => 1_000 + snapshot.tick,
    },
    bus,
    trace: {
      runId: snapshot.runId,
      tick: snapshot.tick,
      step: 'STEP_03_PRESSURE',
      mode: snapshot.mode,
      phase: snapshot.phase,
      traceId: `trace-${snapshot.tick}`,
    },
  };
}

describe('PressureEngine', () => {
  it('skips terminal runs without mutating the snapshot or publishing events', () => {
    const engine = new PressureEngine();
    const snapshot = createSnapshot({
      outcome: 'BANKRUPT',
      pressure: {
        score: 0.42,
        tier: 'T2',
        band: 'ELEVATED',
        maxScoreSeen: 0.42,
      },
    });
    const bus = new EventBus<EngineEventMap & Record<string, unknown>>();

    const result = engine.tick(snapshot, createContext(snapshot, bus));

    expect(result.snapshot).toBe(snapshot);
    expect(result.signals?.map((signal) => signal.code)).toContain(
      'PRESSURE_SKIPPED_TERMINAL_OUTCOME',
    );
    expect(bus.historyCount()).toBe(0);
    expect(engine.getScoreHistory()).toHaveLength(0);
  });

  it('escalates to critical, emits the compatibility bus event, and records diagnostic history', () => {
    const engine = new PressureEngine();
    const snapshot = createSnapshot({
      tick: 14,
      phase: 'SOVEREIGNTY',
      economy: {
        cash: 0,
        incomePerTick: 200,
        expensesPerTick: 2_400,
        netWorth: -1_200,
        haterHeat: 98,
        opportunitiesPurchased: 0,
      },
      shield: {
        layers: createShieldLayers([0.05, 0.18, 0.22, 0.30], ['L1', 'L2']),
      },
      battle: {
        pendingAttacks: [
          createAttack({ attackId: 'attack-1', magnitude: 40 }),
          createAttack({ attackId: 'attack-2', magnitude: 55, category: 'BREACH' }),
        ],
      },
      cascade: {
        activeChains: [
          createChain({ chainId: 'chain-neg-1', positive: false }),
          createChain({ chainId: 'chain-neg-2', positive: false }),
        ],
      },
      modeState: {
        bleedMode: true,
      },
      timers: {
        elapsedMs: 95_000,
      },
    });
    const bus = new EventBus<EngineEventMap & Record<string, unknown>>();

    const result = engine.tick(snapshot, createContext(snapshot, bus));
    const signalCodes = result.signals?.map((signal) => signal.code) ?? [];

    expect(result.snapshot.pressure.score).toBe(1);
    expect(result.snapshot.pressure.tier).toBe('T4');
    expect(result.snapshot.pressure.band).toBe('CRITICAL');
    expect(result.snapshot.pressure.upwardCrossings).toBe(1);
    expect(result.snapshot.pressure.lastEscalationTick).toBe(snapshot.tick);
    expect(bus.last('pressure.changed')?.payload).toEqual({
      from: 'T0',
      to: 'T4',
      score: 1,
    });
    expect(signalCodes).toEqual(
      expect.arrayContaining([
        'PRESSURE_TIER_ESCALATED',
        'PRESSURE_BAND_ESCALATED',
        'PRESSURE_CRITICAL_ENTERED',
        'PRESSURE_NEW_HIGH_WATERMARK',
        'PRESSURE_DOMINANT_DRIVER',
      ]),
    );
    expect(engine.getScoreHistory()).toEqual([1]);
    expect(engine.getRawScoreHistory()[0]).toBeGreaterThan(1);
    expect(engine.getDominantSignalHistory()).toEqual(['cash_crisis']);
    expect(engine.getLastSignalCollection()?.dominantPressureKey).toBe('cash_crisis');
    expect(engine.getHealth().status).toBe('DEGRADED');
  });

  it('applies sticky decay and preserves critical tier under active threat substrate', () => {
    const engine = new PressureEngine();
    const snapshot = createSnapshot({
      pressure: {
        score: 0.8,
        tier: 'T4',
        band: 'CRITICAL',
        previousTier: 'T4',
        previousBand: 'CRITICAL',
        survivedHighPressureTicks: 4,
        maxScoreSeen: 0.85,
      },
      economy: {
        cash: 100_000,
        incomePerTick: 8_000,
        expensesPerTick: 1_000,
        netWorth: 200_000,
        freedomTarget: 100_000,
      },
      battle: {
        pendingAttacks: [createAttack({ attackId: 'attack-sticky', magnitude: 10 })],
      },
    });
    const bus = new EventBus<EngineEventMap & Record<string, unknown>>();

    const result = engine.tick(snapshot, createContext(snapshot, bus));
    const signalCodes = result.signals?.map((signal) => signal.code) ?? [];

    expect(result.snapshot.pressure.score).toBe(0.77);
    expect(result.snapshot.pressure.tier).toBe('T4');
    expect(result.snapshot.pressure.band).toBe('CRITICAL');
    expect(result.snapshot.pressure.survivedHighPressureTicks).toBe(5);
    expect(signalCodes).toContain('PRESSURE_HIGH_PERSISTENCE');
    expect(signalCodes).not.toContain('PRESSURE_CRITICAL_ENTERED');
    expect(bus.last('pressure.changed')).toBeNull();
    expect(engine.getHealth().status).toBe('HEALTHY');
  });

  it('reset clears history and re-arms the one-shot critical entry signal', () => {
    const engine = new PressureEngine();

    const firstSnapshot = createSnapshot({
      tick: 15,
      phase: 'SOVEREIGNTY',
      economy: {
        cash: 0,
        incomePerTick: 200,
        expensesPerTick: 2_400,
        netWorth: -1_200,
        haterHeat: 98,
        opportunitiesPurchased: 0,
      },
      shield: {
        layers: createShieldLayers([0.05, 0.18, 0.22, 0.30], ['L1', 'L2']),
      },
      battle: {
        pendingAttacks: [
          createAttack({ attackId: 'attack-1', magnitude: 40 }),
          createAttack({ attackId: 'attack-2', magnitude: 55, category: 'BREACH' }),
        ],
      },
      cascade: {
        activeChains: [createChain({ chainId: 'chain-neg-1', positive: false })],
      },
      modeState: {
        bleedMode: true,
      },
      timers: {
        elapsedMs: 95_000,
      },
    });

    const firstResult = engine.tick(firstSnapshot, createContext(firstSnapshot));
    expect(firstResult.signals?.map((signal) => signal.code)).toContain(
      'PRESSURE_CRITICAL_ENTERED',
    );

    engine.reset();

    expect(engine.getScoreHistory()).toHaveLength(0);
    expect(engine.getRawScoreHistory()).toHaveLength(0);
    expect(engine.getDominantSignalHistory()).toHaveLength(0);
    expect(engine.getLastSignalCollection()).toBeNull();

    const secondSnapshot = createSnapshot({
      runId: 'run-pressure-engine-spec-2',
      tick: 16,
      phase: 'SOVEREIGNTY',
      economy: {
        cash: 0,
        incomePerTick: 200,
        expensesPerTick: 2_400,
        netWorth: -1_200,
        haterHeat: 98,
        opportunitiesPurchased: 0,
      },
      shield: {
        layers: createShieldLayers([0.05, 0.18, 0.22, 0.30], ['L1', 'L2']),
      },
      battle: {
        pendingAttacks: [
          createAttack({ attackId: 'attack-3', magnitude: 40 }),
          createAttack({ attackId: 'attack-4', magnitude: 55, category: 'BREACH' }),
        ],
      },
      cascade: {
        activeChains: [createChain({ chainId: 'chain-neg-2', positive: false })],
      },
      modeState: {
        bleedMode: true,
      },
      timers: {
        elapsedMs: 95_000,
      },
    });

    const secondResult = engine.tick(secondSnapshot, createContext(secondSnapshot));

    expect(secondResult.signals?.map((signal) => signal.code)).toContain(
      'PRESSURE_CRITICAL_ENTERED',
    );
    expect(engine.getScoreHistory()).toEqual([1]);
  });
});