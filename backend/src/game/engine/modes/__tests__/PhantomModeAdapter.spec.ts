//backend/src/game/engine/modes/__tests__/PhantomModeAdapter.spec.ts

import { describe, expect, it } from 'vitest';

import type {
  AttackEvent,
  CardDefinition,
  CardInstance,
  LegendMarker,
  ThreatEnvelope,
} from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { PhantomModeAdapter } from '../PhantomModeAdapter';

function createCardDefinition(id = 'card-1'): CardDefinition {
  return {
    id,
    name: `Card ${id}`,
    deckType: 'GHOST',
    baseCost: 0,
    baseEffect: {},
    tags: ['ghost'],
    timingClass: ['ANY'],
    rarity: 'COMMON',
    autoResolve: false,
    counterability: 'NONE',
    targeting: 'SELF',
    decisionTimerOverrideMs: null,
    decayTicks: null,
    modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
    educationalTag: 'pattern',
  };
}

function createCardInstance(id = 'ci-1', tags: string[] = ['ghost']): CardInstance {
  return {
    instanceId: id,
    definitionId: 'card-1',
    card: createCardDefinition('card-1'),
    cost: 0,
    targeting: 'SELF',
    timingClass: ['ANY'],
    tags,
    overlayAppliedForMode: 'ghost',
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

function createLegendMarker(
  id = 'lm-1',
  tick = 5,
  kind: 'GOLD' | 'RED' | 'PURPLE' | 'SILVER' | 'BLACK' = 'GOLD',
): LegendMarker {
  return {
    markerId: id,
    tick,
    kind,
    cardId: null,
    summary: `Legend marker ${id}`,
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
    mode: 'ghost',
    tick: 5,
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
      ghostMarkers: [createLegendMarker('lm-1', 5)],
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
      modePresentation: 'phantom',
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

describe('PhantomModeAdapter', () => {
  const adapter = new PhantomModeAdapter();

  it('configures legend heat, community modifier, decay tax, and gap versus legend', () => {
    const configured = adapter.configure(createSnapshot(), {
      legendRunId: 'legend-run-1',
      legendOwnerUserId: 'legend-user-1',
      legendMarkers: [createLegendMarker('lm-1', 5), createLegendMarker('lm-2', 10, 'SILVER')],
      legendOriginalHeat: 20,
      communityRunsSinceLegend: 50_000,
      legendDaysAlive: 6,
      legendCordScore: 1.5,
    });

    expect(configured.tags).toContain('mode:phantom');
    expect(configured.tags).toContain('legend_markers:enabled');
    expect(configured.tags).toContain('hold:disabled');
    expect(configured.tags).toContain('ghost:legend_cord:1.5');

    expect(configured.modeState.legendMarkersEnabled).toBe(true);
    expect(configured.modeState.ghostBaselineRunId).toBe('legend-run-1');
    expect(configured.modeState.legendOwnerUserId).toBe('legend-user-1');
    expect(configured.modeState.communityHeatModifier).toBe(150);

    expect(configured.economy.haterHeat).toBe(180);
    expect(configured.cards.ghostMarkers).toHaveLength(2);
    expect(configured.sovereignty.gapVsLegend).toBe(0.5);
  });

  it('opens a marker window and forces threat visibility when near a legend marker', () => {
    const started = adapter.onTickStart(createSnapshot());

    expect(started.tags).toContain('ghost:marker_window');
    expect(started.tension.visibleThreats.every((threat) => threat.visibleAs === 'EXPOSED')).toBe(true);
  });

  it('clears the marker-window tag when no legend marker is nearby', () => {
    const base = createSnapshot();
    const started = adapter.onTickStart({
      ...base,
      tick: 20,
      tags: ['ghost:marker_window'],
      cards: {
        ...base.cards,
        ghostMarkers: [createLegendMarker('lm-1', 5)],
      },
    });

    expect(started.tags).not.toContain('ghost:marker_window');
  });

  it('enforces the community heat floor and increases gap-closing rate near marker windows', () => {
    const base = createSnapshot();
    const ended = adapter.onTickEnd({
      ...base,
      economy: {
        ...base.economy,
        haterHeat: 5,
      },
      modeState: {
        ...base.modeState,
        communityHeatModifier: 15,
      },
      pressure: {
        ...base.pressure,
        tier: 'T1',
      },
      sovereignty: {
        ...base.sovereignty,
        gapClosingRate: 0.1,
        gapVsLegend: -0.2,
      },
    });

    expect(ended.economy.haterHeat).toBe(15);
    expect(ended.sovereignty.gapClosingRate).toBe(0.12);
    expect(ended.sovereignty.gapVsLegend).toBe(-0.18);
  });

  it('applies the smaller rate delta when not near a marker window', () => {
    const base = createSnapshot();
    const ended = adapter.onTickEnd({
      ...base,
      tick: 20,
      cards: {
        ...base.cards,
        ghostMarkers: [createLegendMarker('lm-1', 5)],
      },
      modeState: {
        ...base.modeState,
        communityHeatModifier: 0,
      },
      sovereignty: {
        ...base.sovereignty,
        gapClosingRate: 0.05,
        gapVsLegend: 0.1,
      },
    });

    expect(ended.sovereignty.gapClosingRate).toBe(0.045);
    expect(ended.sovereignty.gapVsLegend).toBe(0.095);
  });

  it('locks a ghost window only while inside a marker window', () => {
    const base = createSnapshot();
    const resolved = adapter.resolveAction(
      {
        ...base,
        economy: {
          ...base.economy,
          haterHeat: 20,
        },
        sovereignty: {
          ...base.sovereignty,
          gapClosingRate: 0.1,
        },
      },
      'LOCK_GHOST_WINDOW',
    );

    expect(resolved.tags).toContain('ghost:window_locked');
    expect(resolved.modeState.phaseBoundaryWindowsRemaining).toBe(1);
    expect(resolved.sovereignty.gapClosingRate).toBe(0.125);
    expect(resolved.economy.haterHeat).toBe(17);
  });

  it('ignores lock-ghost-window actions outside a marker window', () => {
    const base = createSnapshot();
    const resolved = adapter.resolveAction(
      {
        ...base,
        tick: 30,
        cards: {
          ...base.cards,
          ghostMarkers: [createLegendMarker('lm-1', 5)],
        },
      },
      'LOCK_GHOST_WINDOW',
    );

    expect(resolved).toBeDefined();
    expect(resolved.tags).not.toContain('ghost:window_locked');
    expect(resolved.modeState.phaseBoundaryWindowsRemaining).toBe(0);
  });

  it('finalize rewards breaking the legend under high historical difficulty', () => {
    const base = createSnapshot();
    const finalized = adapter.finalize({
      ...base,
      outcome: 'FREEDOM',
      modeState: {
        ...base.modeState,
        communityHeatModifier: 150,
      },
      cards: {
        ...base.cards,
        ghostMarkers: Array.from({ length: 20 }, (_, index) =>
          createLegendMarker(`lm-${index + 1}`, index + 1),
        ),
      },
      sovereignty: {
        ...base.sovereignty,
        gapVsLegend: 0.2,
        cordScore: 2,
      },
    });

    expect(finalized.sovereignty.cordScore).toBe(3.2);
    expect(finalized.sovereignty.proofBadges).toContain('LEGEND_BROKEN');
    expect(finalized.sovereignty.proofBadges).toContain('HISTORICAL_HUNTER');
  });

  it('finalize grants challenger status when the legend is not fully broken but nearly matched', () => {
    const base = createSnapshot();
    const finalized = adapter.finalize({
      ...base,
      outcome: null,
      modeState: {
        ...base.modeState,
        communityHeatModifier: 20,
      },
      sovereignty: {
        ...base.sovereignty,
        gapVsLegend: -0.04,
        cordScore: 2,
      },
    });

    expect(finalized.sovereignty.cordScore).toBe(2.6);
    expect(finalized.sovereignty.proofBadges).toContain('CHALLENGER');
    expect(finalized.sovereignty.proofBadges).not.toContain('LEGEND_BROKEN');
  });
});