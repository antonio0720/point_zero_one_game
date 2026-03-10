//backend/src/game/engine/modes/__tests__/ModeRuntimeDirector.spec.ts

import { describe, expect, it, vi } from 'vitest';

import type {
  AttackEvent,
  CardDefinition,
  CardInstance,
  LegendMarker,
  ThreatEnvelope,
} from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import type { ModeAdapter, ModeConfigureOptions } from '../ModeContracts';
import { ModeRegistry } from '../ModeRegistry';
import { ModeRuntimeDirector } from '../ModeRuntimeDirector';

function createCardDefinition(id = 'card-1'): CardDefinition {
  return {
    id,
    name: `Card ${id}`,
    deckType: 'OPPORTUNITY',
    baseCost: 100,
    baseEffect: {},
    tags: ['income'],
    timingClass: ['ANY'],
    rarity: 'COMMON',
    autoResolve: false,
    counterability: 'SOFT',
    targeting: 'SELF',
    decisionTimerOverrideMs: null,
    decayTicks: null,
    modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
    educationalTag: 'cashflow',
  };
}

function createCardInstance(id = 'ci-1'): CardInstance {
  return {
    instanceId: id,
    definitionId: 'card-1',
    card: createCardDefinition('card-1'),
    cost: 100,
    targeting: 'SELF',
    timingClass: ['ANY'],
    tags: ['income'],
    overlayAppliedForMode: 'solo',
    decayTicksRemaining: null,
    divergencePotential: 'LOW',
  };
}

function createThreat(id = 'th-1'): ThreatEnvelope {
  return {
    threatId: id,
    source: 'BOT_01',
    etaTicks: 2,
    severity: 1,
    visibleAs: 'HIDDEN',
    summary: 'Incoming threat',
  };
}

function createLegendMarker(id = 'lm-1'): LegendMarker {
  return {
    markerId: id,
    tick: 5,
    kind: 'GOLD',
    cardId: null,
    summary: 'Legend moved here',
  };
}

function createAttack(id = 'atk-1'): AttackEvent {
  return {
    attackId: id,
    source: 'SYSTEM',
    targetEntity: 'SELF',
    targetLayer: 'L1',
    category: 'HEAT',
    magnitude: 5,
    createdAtTick: 0,
    notes: [],
  };
}

function createSnapshot(mode: RunStateSnapshot['mode'] = 'solo'): RunStateSnapshot {
  return {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-1',
    userId: 'user-1',
    seed: 'seed-1',
    mode,
    tick: 0,
    phase: 'FOUNDATION',
    outcome: null,
    tags: [],
    economy: {
      cash: 20_000,
      debt: 5_000,
      incomePerTick: 100,
      expensesPerTick: 50,
      netWorth: 15_000,
      freedomTarget: 100_000,
      haterHeat: 0,
      opportunitiesPurchased: 0,
      privilegePlays: 0,
    },
    pressure: {
      score: 0.2,
      tier: 'T1',
      band: 'BUILDING',
      previousTier: 'T0',
      previousBand: 'CALM',
      upwardCrossings: 0,
      survivedHighPressureTicks: 0,
      lastEscalationTick: null,
      maxScoreSeen: 0.2,
    },
    tension: {
      score: 0.1,
      anticipation: 0.1,
      visibleThreats: [createThreat()],
      maxPulseTriggered: false,
      lastSpikeTick: null,
    },
    shield: {
      layers: [
        {
          layerId: 'L1',
          label: 'CASH_RESERVE',
          current: 50,
          max: 50,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 1,
          lastDamagedTick: null,
          lastRecoveredTick: null,
        },
        {
          layerId: 'L2',
          label: 'CREDIT_LINE',
          current: 50,
          max: 50,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 1,
          lastDamagedTick: null,
          lastRecoveredTick: null,
        },
        {
          layerId: 'L3',
          label: 'INCOME_BASE',
          current: 50,
          max: 50,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 1,
          lastDamagedTick: null,
          lastRecoveredTick: null,
        },
        {
          layerId: 'L4',
          label: 'NETWORK_CORE',
          current: 50,
          max: 50,
          regenPerTick: 1,
          breached: false,
          integrityRatio: 1,
          lastDamagedTick: null,
          lastRecoveredTick: null,
        },
      ],
      weakestLayerId: 'L1',
      weakestLayerRatio: 1,
      blockedThisRun: 0,
      damagedThisRun: 0,
      breachesThisRun: 0,
      repairQueueDepth: 0,
    },
    battle: {
      bots: [
        {
          botId: 'BOT_01',
          label: 'Liquidator',
          state: 'DORMANT',
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: false,
        },
        {
          botId: 'BOT_02',
          label: 'Manipulator',
          state: 'DORMANT',
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: false,
        },
        {
          botId: 'BOT_03',
          label: 'Crash Prophet',
          state: 'DORMANT',
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: false,
        },
        {
          botId: 'BOT_04',
          label: 'Collector',
          state: 'DORMANT',
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: false,
        },
        {
          botId: 'BOT_05',
          label: 'Saboteur',
          state: 'DORMANT',
          heat: 0,
          lastAttackTick: null,
          attacksLanded: 0,
          attacksBlocked: 0,
          neutralized: false,
        },
      ],
      battleBudget: 0,
      battleBudgetCap: 0,
      extractionCooldownTicks: 0,
      firstBloodClaimed: false,
      pendingAttacks: [createAttack()],
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
      sovereigntyScore: 1,
      verifiedGrade: null,
      proofBadges: [],
      gapVsLegend: 0,
      gapClosingRate: 0,
      cordScore: 1,
      auditFlags: [],
      lastVerifiedTick: null,
    },
    cards: {
      hand: [createCardInstance()],
      discard: [],
      exhaust: [],
      drawHistory: [],
      lastPlayed: [],
      ghostMarkers: [createLegendMarker()],
      drawPileSize: 30,
      deckEntropy: 0.5,
    },
    modeState: {
      holdEnabled: false,
      loadoutEnabled: false,
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
      seasonBudgetMs: 12 * 60 * 1000,
      extensionBudgetMs: 0,
      elapsedMs: 0,
      currentTickDurationMs: 1000,
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
}

describe('ModeRuntimeDirector', () => {
  it('delegates configure, tick hooks, action resolution, and finalize to the registered adapter', () => {
    const registry = new ModeRegistry();

    const configure = vi.fn((snapshot: RunStateSnapshot, _options?: ModeConfigureOptions) => ({
      ...snapshot,
      tags: [...snapshot.tags, 'configured:solo'],
    }));

    const onTickStart = vi.fn((snapshot: RunStateSnapshot) => ({
      ...snapshot,
      tick: snapshot.tick + 1,
      tags: [...snapshot.tags, 'tick:start'],
    }));

    const onTickEnd = vi.fn((snapshot: RunStateSnapshot) => ({
      ...snapshot,
      tags: [...snapshot.tags, 'tick:end'],
    }));

    const resolveAction = vi.fn((snapshot: RunStateSnapshot, actionId: string) => ({
      ...snapshot,
      tags: [...snapshot.tags, `action:${actionId}`],
    }));

    const finalize = vi.fn((snapshot: RunStateSnapshot) => ({
      ...snapshot,
      tags: [...snapshot.tags, 'finalized'],
    }));

    const adapter: ModeAdapter = {
      modeCode: 'solo',
      configure,
      onTickStart,
      onTickEnd,
      resolveAction,
      finalize,
    };

    registry.register(adapter);
    const director = new ModeRuntimeDirector(registry);

    const configured = director.configure(createSnapshot('solo'), {
      advantageId: 'MOMENTUM_CAPITAL',
    });
    const started = director.onTickStart(configured);
    const acted = director.resolveAction(started, 'USE_HOLD', { windowId: 'w-1' });
    const ended = director.onTickEnd(acted);
    const finalized = director.finalize(ended);

    expect(configure).toHaveBeenCalledTimes(1);
    expect(onTickStart).toHaveBeenCalledTimes(1);
    expect(resolveAction).toHaveBeenCalledTimes(1);
    expect(onTickEnd).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);

    expect(finalized.tags).toEqual([
      'configured:solo',
      'tick:start',
      'action:USE_HOLD',
      'tick:end',
      'finalized',
    ]);
    expect(finalized.tick).toBe(1);
  });

  it('returns the original snapshot when optional hooks are not implemented', () => {
    const registry = new ModeRegistry();
    registry.register({
      modeCode: 'ghost',
      configure: (snapshot) => snapshot,
    });

    const director = new ModeRuntimeDirector(registry);
    const snapshot = createSnapshot('ghost');

    expect(director.onTickStart(snapshot)).toBe(snapshot);
    expect(director.onTickEnd(snapshot)).toBe(snapshot);
    expect(director.resolveAction(snapshot, 'LOCK_GHOST_WINDOW')).toBe(snapshot);
    expect(director.finalize(snapshot)).toBe(snapshot);
  });

  it('routes by snapshot.mode when multiple adapters are registered', () => {
    const registry = new ModeRegistry();

    registry.register({
      modeCode: 'solo',
      configure: (snapshot) => ({
        ...snapshot,
        tags: [...snapshot.tags, 'solo-configured'],
      }),
    });

    registry.register({
      modeCode: 'pvp',
      configure: (snapshot) => ({
        ...snapshot,
        tags: [...snapshot.tags, 'pvp-configured'],
      }),
    });

    const director = new ModeRuntimeDirector(registry);

    expect(director.configure(createSnapshot('solo')).tags).toContain('solo-configured');
    expect(director.configure(createSnapshot('pvp')).tags).toContain('pvp-configured');
  });
});