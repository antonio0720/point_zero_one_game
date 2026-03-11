///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/modes/__tests__/chase_a_legend_mode.time.test.ts

import { describe, expect, it } from 'vitest';

import type { ModeCode, PressureTier, RunPhase, RunOutcome } from '../../engine/core/GamePrimitives';
import type { RunStateSnapshot } from '../../engine/core/RunStateSnapshot';
import { ChaseLegendTimePolicyAdapter } from '../adapters/ChaseLegendTimePolicyAdapter';

interface SnapshotOverrides {
  readonly tick?: number;
  readonly phase?: RunPhase;
  readonly outcome?: RunOutcome | null;
  readonly tags?: readonly string[];
  readonly pressure?: Partial<RunStateSnapshot['pressure']>;
  readonly modeState?: Partial<RunStateSnapshot['modeState']>;
  readonly timers?: Partial<RunStateSnapshot['timers']>;
  readonly telemetry?: Partial<RunStateSnapshot['telemetry']>;
}

const SHIELD_LAYERS: RunStateSnapshot['shield']['layers'] = [
  { layerId: 'L1', label: 'CASH_RESERVE', current: 100, max: 100, regenPerTick: 5, breached: false, integrityRatio: 1, lastDamagedTick: null, lastRecoveredTick: null },
  { layerId: 'L2', label: 'CREDIT_LINE', current: 100, max: 100, regenPerTick: 5, breached: false, integrityRatio: 1, lastDamagedTick: null, lastRecoveredTick: null },
  { layerId: 'L3', label: 'INCOME_BASE', current: 100, max: 100, regenPerTick: 5, breached: false, integrityRatio: 1, lastDamagedTick: null, lastRecoveredTick: null },
  { layerId: 'L4', label: 'NETWORK_CORE', current: 100, max: 100, regenPerTick: 5, breached: false, integrityRatio: 1, lastDamagedTick: null, lastRecoveredTick: null },
];

const BOTS: RunStateSnapshot['battle']['bots'] = [
  { botId: 'BOT_01', label: 'Watcher', state: 'WATCHING', heat: 0, lastAttackTick: null, attacksLanded: 0, attacksBlocked: 0, neutralized: false },
  { botId: 'BOT_02', label: 'Sniper', state: 'WATCHING', heat: 0, lastAttackTick: null, attacksLanded: 0, attacksBlocked: 0, neutralized: false },
  { botId: 'BOT_03', label: 'Saboteur', state: 'WATCHING', heat: 0, lastAttackTick: null, attacksLanded: 0, attacksBlocked: 0, neutralized: false },
  { botId: 'BOT_04', label: 'Debt Shark', state: 'WATCHING', heat: 0, lastAttackTick: null, attacksLanded: 0, attacksBlocked: 0, neutralized: false },
  { botId: 'BOT_05', label: 'Closer', state: 'WATCHING', heat: 0, lastAttackTick: null, attacksLanded: 0, attacksBlocked: 0, neutralized: false },
];

function buildModePresentation(mode: ModeCode): RunStateSnapshot['modeState']['modePresentation'] {
  switch (mode) {
    case 'solo':
      return 'empire';
    case 'pvp':
      return 'predator';
    case 'coop':
      return 'syndicate';
    case 'ghost':
      return 'phantom';
  }
}

function buildSnapshot(mode: ModeCode, tier: PressureTier, overrides: SnapshotOverrides = {}): RunStateSnapshot {
  const base: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: `${mode}-run-001`,
    userId: 'user-001',
    seed: 'seed-001',
    mode,
    tick: 31,
    phase: 'SOVEREIGNTY',
    outcome: null,
    tags: [],
    economy: {
      cash: 3_500,
      debt: 750,
      incomePerTick: 300,
      expensesPerTick: 210,
      netWorth: 2_750,
      freedomTarget: 150_000,
      haterHeat: 38,
      opportunitiesPurchased: 3,
      privilegePlays: 0,
    },
    pressure: {
      score: 0.7,
      tier,
      band: 'HIGH',
      previousTier: 'T2',
      previousBand: 'ELEVATED',
      upwardCrossings: 3,
      survivedHighPressureTicks: 2,
      lastEscalationTick: 28,
      maxScoreSeen: 0.75,
    },
    tension: {
      score: 0.4,
      anticipation: 0.55,
      visibleThreats: [],
      maxPulseTriggered: true,
      lastSpikeTick: 29,
    },
    shield: {
      layers: SHIELD_LAYERS,
      weakestLayerId: 'L1',
      weakestLayerRatio: 1,
      blockedThisRun: 0,
      damagedThisRun: 0,
      breachesThisRun: 0,
      repairQueueDepth: 0,
    },
    battle: {
      bots: BOTS,
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
      integrityStatus: 'VERIFIED',
      tickChecksums: [],
      proofHash: null,
      sovereigntyScore: 0,
      verifiedGrade: 'A',
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
      loadoutEnabled: false,
      sharedTreasury: true,
      sharedTreasuryBalance: 0,
      trustScores: {},
      roleAssignments: {},
      defectionStepByPlayer: {},
      legendMarkersEnabled: true,
      communityHeatModifier: 1,
      sharedOpportunityDeck: true,
      counterIntelTier: 1,
      spectatorLimit: 250,
      phaseBoundaryWindowsRemaining: 1,
      bleedMode: false,
      handicapIds: [],
      advantageId: null,
      disabledBots: [],
      modePresentation: buildModePresentation(mode),
      roleLockEnabled: true,
      extractionActionsRemaining: 0,
      ghostBaselineRunId: 'legend-run-001',
      legendOwnerUserId: 'legend-user-001',
    },
    timers: {
      seasonBudgetMs: 12 * 60 * 1_000,
      extensionBudgetMs: 0,
      elapsedMs: 80_000,
      currentTickDurationMs: 3_800,
      nextTickAtMs: null,
      holdCharges: 1,
      activeDecisionWindows: [],
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
    tick: overrides.tick ?? base.tick,
    phase: overrides.phase ?? base.phase,
    outcome: overrides.outcome ?? base.outcome,
    tags: overrides.tags ?? base.tags,
    pressure: { ...base.pressure, ...overrides.pressure, tier: overrides.pressure?.tier ?? tier },
    modeState: { ...base.modeState, ...overrides.modeState },
    timers: { ...base.timers, ...overrides.timers },
    telemetry: { ...base.telemetry, ...overrides.telemetry },
  };
}

describe('chase_a_legend_mode.time', () => {
  it('keeps ghost benchmark runs unforgiving with no hold authority and the canonical tier law intact', () => {
    const adapter = new ChaseLegendTimePolicyAdapter();
    const policy = adapter.getPolicy();
    const patch = adapter.resolveFactoryPatch();

    expect(policy.mode).toBe('ghost');
    expect(policy.holdEnabled).toBe(false);
    expect(policy.baseHoldCharges).toBe(0);
    expect(policy.tiers.T0.defaultDurationMs).toBeGreaterThan(policy.tiers.T4.defaultDurationMs);
    expect(patch.holdCharges).toBe(0);
    expect(patch.currentTickDurationMs).toBe(policy.tiers.T1.defaultDurationMs);
  });

  it('builds benchmark pursuit windows where benchmark and phase-lock outrun the raw tick while spike windows stay capped', () => {
    const adapter = new ChaseLegendTimePolicyAdapter();
    const snapshot = buildSnapshot('ghost', 'T3');

    const resolved = adapter.resolveSnapshot(snapshot);
    const named = adapter.resolveNamedWindows(snapshot);

    expect(resolved.holdEnabled).toBe(false);
    expect(resolved.holdChargesCap).toBe(0);
    expect(named.legendBenchmarkMs).toBeGreaterThanOrEqual(named.ghostSplitMs);
    expect(named.phaseBoundaryMs).toBeGreaterThanOrEqual(named.legendBenchmarkMs);
    expect(named.scoreLockMs).toBeGreaterThanOrEqual(resolved.currentTickDurationMs);
    expect(named.pressureSpikeMs).toBeLessThanOrEqual(named.legendBenchmarkMs);
    expect(named.ghostSplitMs).toBeGreaterThanOrEqual(resolved.tierConfig.decisionWindowMs);
  });

  it('writes phantom timing state, disables coop artefacts, and emits legend-chase telemetry hints', () => {
    const adapter = new ChaseLegendTimePolicyAdapter();
    const snapshot = buildSnapshot('ghost', 'T3', {
      modeState: {
        holdEnabled: true,
        loadoutEnabled: false,
        sharedTreasury: true,
        sharedOpportunityDeck: true,
        roleLockEnabled: true,
        phaseBoundaryWindowsRemaining: 2,
      },
      timers: {
        holdCharges: 4,
      },
    });

    const applied = adapter.applySnapshot(snapshot, 80_000);

    expect(applied.timers.currentTickDurationMs).toBe(3_800);
    expect(applied.timers.nextTickAtMs).toBe(83_800);
    expect(applied.timers.holdCharges).toBe(0);
    expect(applied.modeState.holdEnabled).toBe(false);
    expect(applied.modeState.sharedTreasury).toBe(false);
    expect(applied.modeState.sharedOpportunityDeck).toBe(false);
    expect(applied.modeState.roleLockEnabled).toBe(false);
    expect(applied.modeState.loadoutEnabled).toBe(true);
    expect(applied.modeState.phaseBoundaryWindowsRemaining).toBeGreaterThanOrEqual(5);
    expect(applied.telemetry.warnings).toContain('CHASE_LEGEND_TIME_POLICY_PHANTOM_ACTIVE');
    expect(applied.telemetry.forkHints.some((hint) => hint.startsWith('chaselegend.time.legend_benchmark_ms='))).toBe(true);
  });
});
