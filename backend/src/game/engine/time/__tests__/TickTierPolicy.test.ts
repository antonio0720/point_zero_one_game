// backend/src/game/engine/time/__tests__/TickTierPolicy.test.ts
import { describe, expect, it } from 'vitest';

import { DeterministicClock } from '../../core/ClockSource';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { SeasonClock, SeasonWindowType } from '../SeasonClock';
import { TickTierPolicy } from '../TickTierPolicy';

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
      layers: [
        {
          layerId: 'L1',
          label: 'CASH_BUFFER',
          current: 100,
          max: 100,
          regenPerTick: 0,
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
      seasonBudgetMs: 120_000,
      extensionBudgetMs: 0,
      elapsedMs: 10_000,
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

describe('backend time/TickTierPolicy', () => {
  it('keeps the baseline tier and canonical durations when no escalation conditions are present', () => {
    const policy = new TickTierPolicy();
    const snapshot = createSnapshot();

    const result = policy.resolve(snapshot, {
      nowMs: 5_000,
      previousTier: 'T1',
    });

    expect(result.baseTier).toBe('T1');
    expect(result.resolvedTier).toBe('T1');
    expect(result.durationMs).toBe(13_000);
    expect(result.decisionWindowMs).toBe(8_000);
    expect(result.shouldScreenShake).toBe(false);
    expect(result.shouldOpenEndgameWindow).toBe(false);
    expect(result.shouldInterpolate).toBe(false);
    expect(result.reasonCodes).toContain('BASE_TIER_T1');
    expect(result.reasonCodes).toContain('PRESSURE_BAND_BUILDING');
  });

  it('escalates to T4 when hard-danger signals are present', () => {
    const policy = new TickTierPolicy();
    const snapshot = createSnapshot({
      economy: {
        cash: -25,
        incomePerTick: 50,
        expensesPerTick: 200,
        haterHeat: 90,
      },
      tension: {
        visibleThreats: [
          { sourceBotId: 'envy', score: 0.8, visibility: 'VISIBLE', tags: ['a'] },
          { sourceBotId: 'spite', score: 0.7, visibility: 'VISIBLE', tags: ['b'] },
          { sourceBotId: 'doubt', score: 0.7, visibility: 'VISIBLE', tags: ['c'] },
          { sourceBotId: 'panic', score: 0.7, visibility: 'VISIBLE', tags: ['d'] },
        ],
      } as DeepPartial<RunStateSnapshot['tension']>,
      battle: {
        pendingAttacks: [
          {
            attackId: 'atk_1',
            botId: 'envy',
            attackType: 'LIQUIDITY_DRAIN',
            scheduledTick: 1,
            pressureDelta: 0.1,
            damageBudget: 5,
            tags: [],
          },
          {
            attackId: 'atk_2',
            botId: 'spite',
            attackType: 'LIQUIDITY_DRAIN',
            scheduledTick: 1,
            pressureDelta: 0.1,
            damageBudget: 5,
            tags: [],
          },
          {
            attackId: 'atk_3',
            botId: 'panic',
            attackType: 'LIQUIDITY_DRAIN',
            scheduledTick: 1,
            pressureDelta: 0.1,
            damageBudget: 5,
            tags: [],
          },
        ],
      } as DeepPartial<RunStateSnapshot['battle']>,
      shield: {
        layers: [
          {
            layerId: 'L1',
            label: 'CASH_BUFFER',
            current: 5,
            max: 100,
            regenPerTick: 0,
            breached: true,
            integrityRatio: 0.05,
            lastDamagedTick: 0,
            lastRecoveredTick: null,
          },
        ],
        weakestLayerId: 'L1',
        weakestLayerRatio: 0.05,
      },
      sovereignty: {
        integrityStatus: 'QUARANTINED',
      },
      timers: {
        seasonBudgetMs: 30_000,
        extensionBudgetMs: 0,
        elapsedMs: 20_000,
      },
    });

    const result = policy.resolve(snapshot, {
      nowMs: 20_000,
      previousTier: 'T1',
    });

    expect(result.resolvedTier).toBe('T4');
    expect(result.shouldScreenShake).toBe(true);
    expect(result.shouldOpenEndgameWindow).toBe(true);
    expect(result.shouldInterpolate).toBe(true);
    expect(result.reasonCodes).toContain('NEGATIVE_CASH');
    expect(result.reasonCodes).toContain('NEGATIVE_CASHFLOW');
    expect(result.reasonCodes).toContain('HATER_HEAT_85_PLUS');
    expect(result.reasonCodes).toContain('SHIELD_CRITICAL');
    expect(result.reasonCodes).toContain('VISIBLE_THREATS_4_PLUS');
    expect(result.reasonCodes).toContain('PENDING_ATTACKS_3_PLUS');
    expect(result.reasonCodes).toContain('FINAL_15S');
    expect(result.reasonCodes).toContain('INTEGRITY_QUARANTINED');
  });

  it('applies season and mode tempo multipliers without mutating the resolved tier truth', () => {
    const clock = new DeterministicClock(2_500);
    const seasonClock = new SeasonClock(clock);

    seasonClock.loadSeasonManifest({
      seasonId: 'season_001',
      startMs: 0,
      endMs: 100_000,
      windows: [
        {
          windowId: 'kickoff_01',
          type: SeasonWindowType.KICKOFF,
          startsAtMs: 0,
          endsAtMs: 10_000,
          isActive: true,
          pressureMultiplier: 1.1,
        },
      ],
    });

    const policy = new TickTierPolicy(seasonClock);
    const snapshot = createSnapshot({
      mode: 'coop',
      pressure: {
        tier: 'T0',
        previousTier: 'T0',
        band: 'CALM',
      },
    });

    const result = policy.resolve(snapshot, {
      nowMs: 2_500,
      forcedTier: 'T0',
      previousTier: 'T0',
    });

    expect(result.baseTier).toBe('T0');
    expect(result.resolvedTier).toBe('T0');
    expect(result.seasonMultiplier).toBe(1.1);
    expect(result.modeTempoMultiplier).toBe(1.08);
    expect(result.budgetTempoMultiplier).toBe(1.0);
    expect(result.durationMs).toBe(19_636);
    expect(result.decisionWindowMs).toBe(11_781);
    expect(result.reasonCodes).toContain('SEASON_PRESSURE_ACTIVE');
    expect(result.shouldInterpolate).toBe(false);
  });

  it('raises pvp cadence by one step when battle budget is elevated and marks the endgame window', () => {
    const policy = new TickTierPolicy();
    const snapshot = createSnapshot({
      mode: 'pvp',
      pressure: {
        tier: 'T1',
        previousTier: 'T1',
        band: 'BUILDING',
      },
      battle: {
        battleBudget: 80,
        battleBudgetCap: 100,
      },
      timers: {
        seasonBudgetMs: 30_000,
        extensionBudgetMs: 0,
        elapsedMs: 0,
      },
    });

    const result = policy.resolve(snapshot, {
      nowMs: 1_000,
      previousTier: 'T1',
    });

    expect(result.resolvedTier).toBe('T2');
    expect(result.modeTempoMultiplier).toBe(0.92);
    expect(result.budgetTempoMultiplier).toBe(0.78);
    expect(result.reasonCodes).toContain('PVP_BATTLE_BUDGET_HIGH');
    expect(result.shouldOpenEndgameWindow).toBe(true);
    expect(result.shouldInterpolate).toBe(true);
  });
});