// backend/src/game/engine/time/__tests__/RunTimeoutGuard.test.ts
import { describe, expect, it } from 'vitest';

import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { RunTimeoutGuard } from '../RunTimeoutGuard';

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
      seasonBudgetMs: 60_000,
      extensionBudgetMs: 15_000,
      elapsedMs: 0,
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

describe('backend time/RunTimeoutGuard', () => {
  it('computes total, consumed, and remaining authoritative budget deterministically', () => {
    const guard = new RunTimeoutGuard();
    const snapshot = createSnapshot({
      timers: {
        seasonBudgetMs: 60_000,
        extensionBudgetMs: 15_000,
        elapsedMs: 10_000,
      },
    });

    expect(guard.getTotalBudgetMs(snapshot)).toBe(75_000);
    expect(guard.getConsumedBudgetMs(12_345.99)).toBe(12_345);
    expect(guard.getRemainingBudgetMs(snapshot, 20_000)).toBe(55_000);
    expect(guard.hasReachedTimeout(snapshot, 74_999)).toBe(false);
  });

  it('preserves non-terminal state while the run is still within budget', () => {
    const guard = new RunTimeoutGuard();
    const snapshot = createSnapshot({
      tags: ['baseline'],
      telemetry: {
        warnings: ['existing-warning'],
        outcomeReason: null,
        outcomeReasonCode: null,
      },
    });

    const resolution = guard.resolve(snapshot, 20_000);

    expect(resolution.totalBudgetMs).toBe(75_000);
    expect(resolution.nextElapsedMs).toBe(20_000);
    expect(resolution.consumedBudgetMs).toBe(20_000);
    expect(resolution.remainingBudgetMs).toBe(55_000);
    expect(resolution.timeoutReached).toBe(false);
    expect(resolution.nextOutcome).toBeNull();
    expect(resolution.outcomeReason).toBeNull();
    expect(resolution.outcomeReasonCode).toBeNull();
    expect(resolution.warnings).toEqual(['existing-warning']);
    expect(resolution.tags).toEqual(['baseline']);
  });

  it('resolves TIMEOUT once season plus extension budget are exhausted and dedupes terminal metadata', () => {
    const guard = new RunTimeoutGuard();
    const snapshot = createSnapshot({
      tags: ['baseline', 'run:timeout'],
      telemetry: {
        warnings: ['existing-warning', 'Season budget exhausted.'],
        outcomeReason: null,
        outcomeReasonCode: null,
      },
      timers: {
        seasonBudgetMs: 30_000,
        extensionBudgetMs: 5_000,
        elapsedMs: 0,
      },
    });

    const resolution = guard.resolve(snapshot, 40_000);

    expect(resolution.totalBudgetMs).toBe(35_000);
    expect(resolution.nextElapsedMs).toBe(40_000);
    expect(resolution.consumedBudgetMs).toBe(40_000);
    expect(resolution.remainingBudgetMs).toBe(0);
    expect(resolution.timeoutReached).toBe(true);
    expect(resolution.nextOutcome).toBe('TIMEOUT');
    expect(resolution.outcomeReason).toBe(
      'Season budget exhausted before financial freedom was achieved.',
    );
    expect(resolution.outcomeReasonCode).toBe('SEASON_BUDGET_EXHAUSTED');
    expect(resolution.warnings).toEqual([
      'existing-warning',
      'Season budget exhausted.',
    ]);
    expect(resolution.tags).toEqual(['baseline', 'run:timeout']);
  });

  it('treats an already-terminal TIMEOUT snapshot as stable truth', () => {
    const guard = new RunTimeoutGuard();
    const snapshot = createSnapshot({
      outcome: 'TIMEOUT',
      telemetry: {
        outcomeReason: 'Already terminal.',
        outcomeReasonCode: 'SEASON_BUDGET_EXHAUSTED',
        warnings: ['Already terminal.'],
      },
    });

    expect(guard.hasReachedTimeout(snapshot, 1)).toBe(true);

    const resolution = guard.resolve(snapshot, 1);

    expect(resolution.timeoutReached).toBe(false);
    expect(resolution.nextOutcome).toBe('TIMEOUT');
    expect(resolution.outcomeReason).toBe('Already terminal.');
    expect(resolution.outcomeReasonCode).toBe('SEASON_BUDGET_EXHAUSTED');
    expect(resolution.warnings).toEqual(['Already terminal.']);
  });
});