//backend/src/game/engine/modes/__tests__/EmpireModeAdapter.spec.ts

import { describe, expect, it } from 'vitest';

import type {
  AttackEvent,
  CardDefinition,
  CardInstance,
  LegendMarker,
  ThreatEnvelope,
} from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { EmpireModeAdapter } from '../EmpireModeAdapter';

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

function createSnapshot(): RunStateSnapshot {
  return {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-1',
    userId: 'user-1',
    seed: 'seed-1',
    mode: 'solo',
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
      visibleThreats: [createThreat('th-1'), createThreat('th-2')],
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

describe('EmpireModeAdapter', () => {
  const adapter = new EmpireModeAdapter();

  it('configures standard solo loadout state, applies advantages, and disables selected bots', () => {
    const configured = adapter.configure(createSnapshot(), {
      advantageId: 'MOMENTUM_CAPITAL',
      disabledBots: ['BOT_01'],
    });

    expect(configured.tags).toContain('mode:empire');
    expect(configured.tags).toContain('solo:authoritative');
    expect(configured.tags).toContain('bleed:disabled');

    expect(configured.modeState.holdEnabled).toBe(true);
    expect(configured.modeState.loadoutEnabled).toBe(true);
    expect(configured.modeState.disabledBots).toEqual(['BOT_01']);

    expect(configured.economy.cash).toBe(30_000);
    expect(configured.economy.netWorth).toBe(25_000);

    expect(configured.battle.battleBudget).toBe(0);
    expect(configured.battle.bots[0].state).toBe('DORMANT');
    expect(configured.battle.bots[0].heat).toBe(0);

    expect(configured.tags).toContain('solo:cord_cap:reduced:1');
  });

  it('configures bleed mode with all handicaps active and hold disabled', () => {
    const configured = adapter.configure(createSnapshot(), {
      bleedMode: true,
    });

    expect(configured.modeState.bleedMode).toBe(true);
    expect(configured.modeState.holdEnabled).toBe(false);
    expect(configured.modeState.handicapIds).toHaveLength(6);

    expect(configured.tags).toContain('bleed:enabled');
    expect(configured.tags).toContain('solo:bleed_mode:hard');

    expect(configured.timers.holdCharges).toBe(0);
    expect(configured.timers.frozenWindowIds).toContain('BLEED_MODE_LOCK');
  });

  it('opens escalation phase windows and wakes the first two bots at the phase boundary', () => {
    const base = createSnapshot();
    const started = adapter.onTickStart({
      ...base,
      timers: {
        ...base.timers,
        elapsedMs: 5 * 60 * 1000,
      },
    });

    expect(started.phase).toBe('ESCALATION');
    expect(started.modeState.phaseBoundaryWindowsRemaining).toBe(5);
    expect(started.tags).toContain('solo:phase_transition:FOUNDATION->ESCALATION');

    expect(started.battle.bots[0].state).toBe('WATCHING');
    expect(started.battle.bots[1].state).toBe('WATCHING');
    expect(started.battle.bots[0].heat).toBe(12);
    expect(started.battle.bots[1].heat).toBe(12);
  });

  it('activates the clock, applies the minute-11 heat spike, and surfaces the sovereignty decision window', () => {
    const base = createSnapshot();
    const started = adapter.onTickStart({
      ...base,
      phase: 'SOVEREIGNTY',
      timers: {
        ...base.timers,
        elapsedMs: 11 * 60 * 1000 + 30 * 1000,
      },
      battle: {
        ...base.battle,
        bots: base.battle.bots.map((bot) => ({
          ...bot,
          state: 'WATCHING',
          heat: 5,
        })),
      },
    });

    expect(started.tags).toContain('solo:clock_active');
    expect(started.tags).toContain('solo:minute_11_heat_spike_applied');
    expect(started.tags).toContain('solo:sovereignty_decision_ready');

    expect(
      started.tension.visibleThreats.every((threat) => threat.visibleAs === 'EXPOSED'),
    ).toBe(true);

    expect(started.battle.bots.every((bot) => bot.heat === 25)).toBe(true);
  });

  it('tracks the low-cash streak and arms comeback surge on recovery after fifteen ticks underwater', () => {
    const base = createSnapshot();

    const underwater = adapter.onTickStart({
      ...base,
      economy: {
        ...base.economy,
        cash: 1_500,
      },
    });

    expect(underwater.tags).toContain('solo:cash_low_streak:1');

    const recovered = adapter.onTickStart({
      ...base,
      tags: ['solo:cash_low_streak:15'],
      economy: {
        ...base.economy,
        cash: 3_000,
      },
    });

    expect(recovered.tags).toContain('solo:comeback_surge_armed');
    expect(recovered.sovereignty.sovereigntyScore).toBe(1.01);
  });

  it('spends a hold charge and freezes the supplied decision window', () => {
    const resolved = adapter.resolveAction(createSnapshot(), 'USE_HOLD', {
      windowId: 'decision-7',
    });

    expect(resolved.tags).toContain('solo:hold_used');
    expect(resolved.timers.holdCharges).toBe(0);
    expect(resolved.timers.frozenWindowIds).toContain('decision-7');
  });

  it('decrements phase windows and applies bleed-mode high-pressure tax on tick end', () => {
    const base = createSnapshot();
    const ended = adapter.onTickEnd({
      ...base,
      pressure: {
        ...base.pressure,
        tier: 'T4',
      },
      modeState: {
        ...base.modeState,
        bleedMode: true,
        phaseBoundaryWindowsRemaining: 2,
      },
    });

    expect(ended.modeState.phaseBoundaryWindowsRemaining).toBe(1);
    expect(ended.economy.haterHeat).toBe(1);
  });

  it('finalize applies handicap bonuses, bot-cap penalties, and comeback credit', () => {
    const base = createSnapshot();
    const finalized = adapter.finalize({
      ...base,
      tags: ['solo:comeback_realized'],
      modeState: {
        ...base.modeState,
        handicapIds: ['NO_CREDIT_HISTORY'],
        disabledBots: ['BOT_01'],
      },
      sovereignty: {
        ...base.sovereignty,
        cordScore: 1,
      },
    });

    expect(finalized.sovereignty.cordScore).toBe(0.97);
    expect(finalized.sovereignty.proofBadges).toContain('COMEBACK_SURGE');
    expect(finalized.sovereignty.proofBadges).not.toContain('FULL_BOT_GAUNTLET');
  });

  it('finalize grants bleed-mode S-grade eligibility and raises the freedom ceiling to 1.80', () => {
    const base = createSnapshot();
    const finalized = adapter.finalize({
      ...base,
      outcome: 'FREEDOM',
      modeState: {
        ...base.modeState,
        bleedMode: true,
        handicapIds: ['NO_CREDIT_HISTORY', 'SINGLE_INCOME'],
      },
      sovereignty: {
        ...base.sovereignty,
        cordScore: 1,
      },
    });

    expect(finalized.sovereignty.cordScore).toBe(1.8);
    expect(finalized.sovereignty.proofBadges).toContain('BLEED_S_GRADE_ELIGIBLE');
    expect(finalized.sovereignty.proofBadges).toContain('FULL_BOT_GAUNTLET');
  });
});