// backend/src/game/engine/time/__tests__/DecisionExpiryResolver.test.ts
import { describe, expect, it } from 'vitest';

import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { DecisionExpiryResolver } from '../DecisionExpiryResolver';

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
    tick: 4,
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
      extensionBudgetMs: 0,
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

describe('backend time/DecisionExpiryResolver', () => {
  it('registers a decision window and preserves an explicitly flagged worst option', () => {
    const resolver = new DecisionExpiryResolver();
    const snapshot = createSnapshot();

    const registered = resolver.register(
      {
        windowId: 'window_alpha',
        cardId: 'card_alpha',
        actorId: 'actor_alpha',
        cardType: 'FORCED_FATE',
        openedAtTick: 2,
        openedAtMs: 1_500,
        durationMs: 8_000,
        options: [
          { index: 0, cashflowDelta: 10, netWorthDelta: 10 },
          { index: 1, isWorst: true, cashflowDelta: 100, netWorthDelta: 100 },
          { index: 2, cashflowDelta: -50, netWorthDelta: -50 },
        ],
        tags: ['custom:alpha'],
      },
      snapshot,
    );

    expect(registered.actorId).toBe('actor_alpha');
    expect(registered.worstOptionIndex).toBe(1);
    expect(registered.optionCount).toBe(3);
    expect(registered.tags).toContain('custom:alpha');
    expect(registered.tags).toContain('decision-window');
    expect(registered.tags).toContain('decision-window:registered');
    expect(registered.tags).toContain('decision-card-type:forced_fate');
    expect(resolver.has('window_alpha')).toBe(true);
  });

  it('falls back to snapshot.userId and resolves worst option from cashflow/net-worth ordering', () => {
    const resolver = new DecisionExpiryResolver();
    const snapshot = createSnapshot({
      userId: 'user_fallback_001',
    });

    const registered = resolver.register(
      {
        windowId: 'window_beta',
        cardId: 'card_beta',
        cardType: 'CRISIS_EVENT',
        openedAtTick: 3,
        openedAtMs: 2_000,
        durationMs: 5_000,
        options: [
          { index: 0, cashflowDelta: -10, netWorthDelta: 0 },
          { index: 1, cashflowDelta: -25, netWorthDelta: 100 },
          { index: 2, cashflowDelta: -25, netWorthDelta: -50 },
        ],
      },
      snapshot,
    );

    expect(registered.actorId).toBe('user_fallback_001');
    expect(registered.worstOptionIndex).toBe(2);
    expect(resolver.get('window_beta')?.worstOptionIndex).toBe(2);
  });

  it('syncs registry state against live snapshot windows and removes stale entries', () => {
    const resolver = new DecisionExpiryResolver();
    const snapshot = createSnapshot({
      timers: {
        activeDecisionWindows: {
          window_live: { expiresAtMs: 9_000 } as unknown as any,
        },
      } as unknown as any,
    });

    resolver.register(
      {
        windowId: 'window_live',
        cardId: 'card_live',
        cardType: 'HATER_INJECTION',
        openedAtTick: 1,
        openedAtMs: 1_000,
        durationMs: 9_000,
        options: [{ index: 0 }],
      },
      snapshot,
    );

    resolver.register(
      {
        windowId: 'window_stale',
        cardId: 'card_stale',
        cardType: 'FORCED_FATE',
        openedAtTick: 1,
        openedAtMs: 1_000,
        durationMs: 9_000,
        options: [{ index: 0 }],
      },
      snapshot,
    );

    resolver.syncWithSnapshot(snapshot);

    expect(resolver.has('window_live')).toBe(true);
    expect(resolver.has('window_stale')).toBe(false);
    expect(resolver.getAll().map((window) => window.windowId)).toEqual(['window_live']);
  });

  it('resolves expired windows into deterministic outcomes and reports unresolved ids separately', () => {
    const resolver = new DecisionExpiryResolver();
    const snapshot = createSnapshot({
      tick: 7,
    });

    resolver.register(
      {
        windowId: 'window_expired',
        cardId: 'card_expired',
        cardType: 'HATER_INJECTION',
        openedAtTick: 3,
        openedAtMs: 1_000,
        durationMs: 5_000,
        options: [
          { index: 0, cashflowDelta: 10, netWorthDelta: 0 },
          { index: 1, isWorst: true, cashflowDelta: -100, netWorthDelta: -100 },
        ],
        tags: ['custom:expired'],
      },
      snapshot,
    );

    const result = resolver.resolveExpired(
      snapshot,
      ['window_expired', 'window_unknown'],
      8_000,
    );

    expect(result.unresolvedWindowIds).toEqual(['window_unknown']);
    expect(result.generatedTags).toContain('decision-window:expired');
    expect(result.generatedTags).toContain('decision-window:worst-option-applied');
    expect(result.generatedTags).toContain('decision-window:expiry-unresolved');
    expect(result.outcomes).toHaveLength(1);

    const outcome = result.outcomes[0];
    expect(outcome.windowId).toBe('window_expired');
    expect(outcome.cardId).toBe('card_expired');
    expect(outcome.reason).toBe('EXPIRED');
    expect(outcome.selectedOptionIndex).toBe(1);
    expect(outcome.expiredAtTick).toBe(7);
    expect(outcome.openedAtTick).toBe(3);
    expect(outcome.latencyMs).toBe(7_000);
    expect(outcome.tags).toContain('custom:expired');
    expect(outcome.tags).toContain('decision-window:expired');
    expect(resolver.has('window_expired')).toBe(false);
  });

  it('returns the no-option fallback when a registered window had no options at open time', () => {
    const resolver = new DecisionExpiryResolver();
    const snapshot = createSnapshot();

    resolver.register(
      {
        windowId: 'window_empty',
        cardId: 'card_empty',
        cardType: 'CRISIS_EVENT',
        openedAtTick: 1,
        openedAtMs: 500,
        durationMs: 3_000,
        options: [],
      },
      snapshot,
    );

    const result = resolver.resolveExpired(snapshot, ['window_empty'], 5_000);

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.selectedOptionIndex).toBe(-1);
    expect(result.outcomes[0]?.tags).toContain('decision-window:no-option-fallback');
  });
});