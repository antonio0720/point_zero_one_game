//backend/src/game/engine/modes/__tests__/SyndicateModeAdapter.spec.ts

import { describe, expect, it } from 'vitest';

import type {
  AttackEvent,
  CardDefinition,
  CardInstance,
  CascadeChainInstance,
  LegendMarker,
  ThreatEnvelope,
} from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { SyndicateModeAdapter } from '../SyndicateModeAdapter';

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

function createCardInstance(id = 'ci-1', tags: string[] = ['income']): CardInstance {
  return {
    instanceId: id,
    definitionId: 'card-1',
    card: createCardDefinition('card-1'),
    cost: 100,
    targeting: 'SELF',
    timingClass: ['ANY'],
    tags,
    overlayAppliedForMode: 'coop',
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
    targetEntity: 'TEAM',
    targetLayer: 'L1',
    category: 'HEAT',
    magnitude: 5,
    createdAtTick: 0,
    notes: [],
  };
}

function createCascadeChain(id = 'chain-1'): CascadeChainInstance {
  return {
    chainId: id,
    templateId: 'LIQUIDITY_SPIRAL',
    trigger: 'shield:L1',
    positive: false,
    status: 'ACTIVE',
    createdAtTick: 1,
    recoveryTags: ['income'],
    links: [
      {
        linkId: 'link-1',
        scheduledTick: 2,
        effect: {
          cashDelta: -500,
          heatDelta: 1,
        },
        summary: 'Chain step 1',
      },
    ],
  };
}

function createSnapshot(): RunStateSnapshot {
  return {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-1',
    userId: 'user-1',
    seed: 'seed-1',
    mode: 'coop',
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
      modePresentation: 'syndicate',
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

describe('SyndicateModeAdapter', () => {
  const adapter = new SyndicateModeAdapter();

  it('configures shared treasury, trust, roles, and full-synergy bonuses', () => {
    const configured = adapter.configure(createSnapshot(), {
      teammateUserIds: ['user-2', 'user-3', 'user-4'],
      roleAssignments: {
        'user-1': 'INCOME_BUILDER',
        'user-2': 'SHIELD_ARCHITECT',
        'user-3': 'OPPORTUNITY_HUNTER',
        'user-4': 'COUNTER_INTEL',
      },
      initialTrustScore: 72,
      sharedTreasuryStart: 30_000,
    });

    expect(configured.tags).toContain('mode:syndicate');
    expect(configured.tags).toContain('shared_treasury:enabled');
    expect(configured.tags).toContain('role_lock:enabled');
    expect(configured.tags).toContain('coop:full_synergy');
    expect(configured.tags).toContain('coop:first_cascade_absorb_available');

    expect(configured.modeState.sharedTreasury).toBe(true);
    expect(configured.modeState.roleLockEnabled).toBe(true);
    expect(configured.modeState.counterIntelTier).toBe(1);

    expect(configured.modeState.trustScores).toEqual({
      'user-1': 72,
      'user-2': 72,
      'user-3': 72,
      'user-4': 72,
    });

    expect(configured.modeState.sharedTreasuryBalance).toBe(38_000);
    expect(configured.economy.cash).toBe(38_000);
    expect(configured.economy.netWorth).toBe(33_000);

    expect(configured.shield.layers.every((layer) => layer.current === 55)).toBe(true);
    expect(configured.shield.layers.every((layer) => layer.max === 55)).toBe(true);
    expect(configured.shield.weakestLayerRatio).toBe(1);
  });

  it('normalizes missing teammate roles without leaving the team unassigned', () => {
    const configured = adapter.configure(createSnapshot(), {
      teammateUserIds: ['user-2', 'user-3'],
      roleAssignments: {
        'user-1': 'INCOME_BUILDER',
      },
      sharedTreasuryStart: 32_000,
    });

    expect(Object.keys(configured.modeState.roleAssignments)).toEqual([
      'user-1',
      'user-2',
      'user-3',
    ]);
    expect(configured.tags).toContain('coop:roles_normalized');
    expect(configured.tags).toContain('coop:counter_intel_tier:0');
  });

  it('syncs economy cash from the shared treasury on tick start', () => {
    const base = createSnapshot();
    const started = adapter.onTickStart({
      ...base,
      economy: {
        ...base.economy,
        cash: 12_000,
      },
      modeState: {
        ...base.modeState,
        sharedTreasury: true,
        sharedTreasuryBalance: 27_500,
      },
    });

    expect(started.economy.cash).toBe(27_500);
  });

  it('degrades trust and raises heat when the team is broke under high pressure', () => {
    const base = createSnapshot();
    const ended = adapter.onTickEnd({
      ...base,
      pressure: {
        ...base.pressure,
        tier: 'T4',
      },
      economy: {
        ...base.economy,
        expensesPerTick: 2_000,
      },
      modeState: {
        ...base.modeState,
        sharedTreasury: true,
        sharedTreasuryBalance: 5_000,
        trustScores: {
          'user-1': 40,
          'user-2': 42,
        },
      },
    });

    expect(ended.modeState.trustScores).toEqual({
      'user-1': 39,
      'user-2': 41,
    });
    expect(ended.economy.haterHeat).toBe(1);
    expect(ended.tags).toContain('coop:trust_fracture');
  });

  it('improves trust when the team is stabilizing cascades successfully', () => {
    const base = createSnapshot();
    const ended = adapter.onTickEnd({
      ...base,
      shield: {
        ...base.shield,
        weakestLayerRatio: 0.65,
      },
      cascade: {
        ...base.cascade,
        completedChains: 3,
        brokenChains: 1,
      },
      modeState: {
        ...base.modeState,
        trustScores: {
          'user-1': 70,
          'user-2': 74,
        },
      },
    });

    expect(ended.modeState.trustScores).toEqual({
      'user-1': 71,
      'user-2': 75,
    });
    expect(ended.tags).not.toContain('coop:trust_fracture');
  });

  it('approves treasury loans up to 25 percent of the shared treasury', () => {
    const base = createSnapshot();
    const resolved = adapter.resolveAction(
      {
        ...base,
        modeState: {
          ...base.modeState,
          sharedTreasury: true,
          sharedTreasuryBalance: 20_000,
        },
        economy: {
          ...base.economy,
          cash: 20_000,
        },
      },
      'REQUEST_TREASURY_LOAN',
      {
        amount: 10_000,
      },
    );

    expect(resolved.modeState.sharedTreasuryBalance).toBe(15_000);
    expect(resolved.economy.cash).toBe(15_000);
    expect(resolved.tags).toContain('coop:loan_outstanding');
    expect(resolved.tags).toContain('coop:loan_outstanding_amount:5000');
  });

  it('absorbs the head cascade and grants sovereignty credit', () => {
    const base = createSnapshot();
    const resolved = adapter.resolveAction(
      {
        ...base,
        cascade: {
          ...base.cascade,
          activeChains: [createCascadeChain('chain-1')],
        },
      },
      'ABSORB_CASCADE',
    );

    expect(resolved.cascade.activeChains).toHaveLength(0);
    expect(resolved.cascade.brokenChains).toBe(1);
    expect(resolved.sovereignty.sovereigntyScore).toBe(1.05);
    expect(resolved.tags).toContain('coop:cascade_absorbed');
    expect(resolved.tags).toContain('coop:absorptions:1');
  });

  it('advances defection and commits it on the third step', () => {
    const base = createSnapshot();

    const step1 = adapter.resolveAction(
      {
        ...base,
        modeState: {
          ...base.modeState,
          sharedTreasury: true,
          sharedTreasuryBalance: 20_000,
          defectionStepByPlayer: {
            'user-1': 0,
          },
        },
        economy: {
          ...base.economy,
          cash: 20_000,
        },
      },
      'ADVANCE_DEFECTION',
    );

    const step2 = adapter.resolveAction(step1, 'ADVANCE_DEFECTION');
    const step3 = adapter.resolveAction(step2, 'ADVANCE_DEFECTION');

    expect(step1.modeState.defectionStepByPlayer['user-1']).toBe(1);
    expect(step2.modeState.defectionStepByPlayer['user-1']).toBe(2);
    expect(step3.modeState.defectionStepByPlayer['user-1']).toBe(3);

    expect(step3.tags).toContain('coop:defection_committed');
    expect(step3.modeState.sharedTreasuryBalance).toBe(13_000);
    expect(step3.economy.cash).toBe(13_000);
  });

  it('finalize stacks synergy, absorption, betrayal survival, and trust bonuses', () => {
    const base = createSnapshot();
    const finalized = adapter.finalize({
      ...base,
      outcome: 'FREEDOM',
      tags: [
        'coop:full_synergy',
        'coop:defection_committed',
        'coop:absorptions:3',
      ],
      modeState: {
        ...base.modeState,
        trustScores: {
          'user-1': 90,
          'user-2': 88,
          'user-3': 85,
          'user-4': 87,
        },
        roleAssignments: {
          'user-1': 'INCOME_BUILDER',
          'user-2': 'SHIELD_ARCHITECT',
          'user-3': 'OPPORTUNITY_HUNTER',
          'user-4': 'COUNTER_INTEL',
        },
      },
      sovereignty: {
        ...base.sovereignty,
        cordScore: 2,
      },
    });

    expect(finalized.sovereignty.cordScore).toBe(3.6);
    expect(finalized.sovereignty.proofBadges).toContain('FULL_SYNERGY');
    expect(finalized.sovereignty.proofBadges).toContain('CASCADE_ABSORBER');
    expect(finalized.sovereignty.proofBadges).toContain('BETRAYAL_SURVIVOR');
    expect(finalized.sovereignty.proofBadges).toContain('TRUST_ARCHITECT');
  });
});
