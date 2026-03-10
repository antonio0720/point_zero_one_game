//backend/src/game/engine/modes/__tests__/PredatorModeAdapter.spec.ts

import { describe, expect, it } from 'vitest';

import type {
  AttackEvent,
  CardDefinition,
  CardInstance,
  LegendMarker,
  ThreatEnvelope,
} from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { PredatorModeAdapter } from '../PredatorModeAdapter';

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

function createCardInstance(id = 'ci-1', tags: string[] = ['counter']): CardInstance {
  return {
    instanceId: id,
    definitionId: 'card-1',
    card: createCardDefinition('card-1'),
    cost: 100,
    targeting: 'SELF',
    timingClass: ['CTR'],
    tags,
    overlayAppliedForMode: 'pvp',
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
    source: 'OPPONENT',
    targetEntity: 'SELF',
    targetLayer: 'L2',
    category: 'EXTRACTION',
    magnitude: 15,
    createdAtTick: 3,
    notes: [],
  };
}

function createSnapshot(): RunStateSnapshot {
  return {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-1',
    userId: 'user-1',
    seed: 'seed-1',
    mode: 'pvp',
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
      sovereigntyScore: 1,
      verifiedGrade: null,
      proofBadges: [],
      gapVsLegend: 0,
      gapClosingRate: 0,
      cordScore: 2,
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
      modePresentation: 'predator',
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
}

describe('PredatorModeAdapter', () => {
  const adapter = new PredatorModeAdapter();

  it('configures battle budget, rivalry carry, spectator limits, and shared deck state', () => {
    const configured = adapter.configure(createSnapshot(), {
      battleBudgetStart: 500,
      rivalryHeatCarry: 40,
      spectatorLimit: 100,
    });

    expect(configured.tags).toContain('mode:predator');
    expect(configured.tags).toContain('battle_budget:enabled');
    expect(configured.tags).toContain('shared_opportunity_deck:enabled');

    expect(configured.battle.battleBudget).toBe(200);
    expect(configured.battle.battleBudgetCap).toBe(200);
    expect(configured.battle.rivalryHeatCarry).toBe(25);
    expect(configured.economy.haterHeat).toBe(25);

    expect(configured.modeState.sharedOpportunityDeck).toBe(true);
    expect(configured.modeState.spectatorLimit).toBe(50);
    expect(configured.modeState.extractionActionsRemaining).toBe(1);
  });

  it('refreshes the extraction action every third tick', () => {
    const base = createSnapshot();
    const started = adapter.onTickStart({
      ...base,
      tick: 3,
      modeState: {
        ...base.modeState,
        extractionActionsRemaining: 0,
      },
    });

    expect(started.modeState.extractionActionsRemaining).toBe(1);
  });

  it('grants passive battle-budget income and emits spectator projections on five-tick intervals', () => {
    const base = createSnapshot();
    const ended = adapter.onTickEnd({
      ...base,
      tick: 5,
      pressure: {
        ...base.pressure,
        tier: 'T2',
      },
      battle: {
        ...base.battle,
        battleBudget: 140,
        battleBudgetCap: 200,
        extractionCooldownTicks: 1,
      },
      modeState: {
        ...base.modeState,
        spectatorLimit: 50,
      },
    });

    expect(ended.battle.battleBudget).toBe(146);
    expect(ended.battle.extractionCooldownTicks).toBe(0);
    expect(ended.tags).toContain('predator:spectator_projection:5');
    expect(ended.tags).not.toContain('predator:hoarding_penalty');
  });

  it('punishes hoarding at or above 150 battle budget', () => {
    const base = createSnapshot();
    const ended = adapter.onTickEnd({
      ...base,
      pressure: {
        ...base.pressure,
        tier: 'T3',
      },
      battle: {
        ...base.battle,
        battleBudget: 150,
        battleBudgetCap: 200,
      },
    });

    expect(ended.battle.battleBudget).toBe(154);
    expect(ended.economy.haterHeat).toBe(2);
    expect(ended.tags).toContain('predator:hoarding_penalty');
  });

  it('fires extraction actions by spending battle budget and opening cooldown', () => {
    const base = createSnapshot();
    const resolved = adapter.resolveAction(
      {
        ...base,
        tick: 6,
        battle: {
          ...base.battle,
          battleBudget: 100,
        },
        modeState: {
          ...base.modeState,
          extractionActionsRemaining: 1,
        },
      },
      'FIRE_EXTRACTION',
      {
        extractionId: 'MARKET_DUMP',
      },
    );

    expect(resolved.battle.battleBudget).toBe(70);
    expect(resolved.battle.extractionCooldownTicks).toBe(3);
    expect(resolved.modeState.extractionActionsRemaining).toBe(0);
    expect(resolved.economy.haterHeat).toBe(2);
    expect(resolved.tags).toContain('predator:extraction_fired:MARKET_DUMP');
    expect(resolved.tags).toContain('predator:last_extraction_tick:6');
  });

  it('counter-plays pending attacks by clearing the head of the queue and paying battle budget', () => {
    const base = createSnapshot();
    const resolved = adapter.resolveAction(
      {
        ...base,
        battle: {
          ...base.battle,
          battleBudget: 50,
          pendingAttacks: [createAttack('atk-1')],
        },
      },
      'COUNTER_PLAY',
    );

    expect(resolved.battle.battleBudget).toBe(40);
    expect(resolved.battle.pendingAttacks).toHaveLength(0);
    expect(resolved.tags).toContain('predator:counter_play:successful');
  });

  it('claims first blood once and grants the battle-budget bonus', () => {
    const base = createSnapshot();
    const first = adapter.resolveAction(
      {
        ...base,
        battle: {
          ...base.battle,
          battleBudget: 50,
          battleBudgetCap: 200,
        },
      },
      'CLAIM_FIRST_BLOOD',
    );

    const second = adapter.resolveAction(first, 'CLAIM_FIRST_BLOOD');

    expect(first.battle.firstBloodClaimed).toBe(true);
    expect(first.battle.battleBudget).toBe(75);
    expect(first.tags).toContain('predator:first_blood');

    expect(second).toBe(first);
  });

  it('finalize stacks rivalry, arena-control, first-blood, and aggressor bonuses', () => {
    const base = createSnapshot();
    const finalized = adapter.finalize({
      ...base,
      outcome: 'FREEDOM',
      battle: {
        ...base.battle,
        firstBloodClaimed: true,
        rivalryHeatCarry: 25,
        neutralizedBotIds: ['BOT_01', 'BOT_02'],
        battleBudget: 10,
      },
      sovereignty: {
        ...base.sovereignty,
        cordScore: 2,
      },
    });

    expect(finalized.sovereignty.cordScore).toBe(2.7);
    expect(finalized.sovereignty.proofBadges).toContain('FIRST_BLOOD');
    expect(finalized.sovereignty.proofBadges).toContain('ARCH_RIVAL_PRESSURE');
    expect(finalized.sovereignty.proofBadges).toContain('ARENA_CONTROL');
    expect(finalized.sovereignty.proofBadges).toContain('AGGRESSOR');
  });
});