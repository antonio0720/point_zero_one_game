///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/modes/__tests__/solo_mode.time.test.ts

import { describe, expect, it } from 'vitest';

import type { ModeCode, PressureTier, RunPhase, RunOutcome } from '../../engine/core/GamePrimitives';
import type { RunStateSnapshot } from '../../engine/core/RunStateSnapshot';
import { SoloTimePolicyAdapter } from '../adapters/SoloTimePolicyAdapter';

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
  {
    layerId: 'L1',
    label: 'CASH_RESERVE',
    current: 100,
    max: 100,
    regenPerTick: 5,
    breached: false,
    integrityRatio: 1,
    lastDamagedTick: null,
    lastRecoveredTick: null,
  },
  {
    layerId: 'L2',
    label: 'CREDIT_LINE',
    current: 100,
    max: 100,
    regenPerTick: 5,
    breached: false,
    integrityRatio: 1,
    lastDamagedTick: null,
    lastRecoveredTick: null,
  },
  {
    layerId: 'L3',
    label: 'INCOME_BASE',
    current: 100,
    max: 100,
    regenPerTick: 5,
    breached: false,
    integrityRatio: 1,
    lastDamagedTick: null,
    lastRecoveredTick: null,
  },
  {
    layerId: 'L4',
    label: 'NETWORK_CORE',
    current: 100,
    max: 100,
    regenPerTick: 5,
    breached: false,
    integrityRatio: 1,
    lastDamagedTick: null,
    lastRecoveredTick: null,
  },
];

const BOTS: RunStateSnapshot['battle']['bots'] = [
  {
    botId: 'BOT_01',
    label: 'Watcher',
    state: 'WATCHING',
    heat: 0,
    lastAttackTick: null,
    attacksLanded: 0,
    attacksBlocked: 0,
    neutralized: false,
  },
  {
    botId: 'BOT_02',
    label: 'Sniper',
    state: 'WATCHING',
    heat: 0,
    lastAttackTick: null,
    attacksLanded: 0,
    attacksBlocked: 0,
    neutralized: false,
  },
  {
    botId: 'BOT_03',
    label: 'Saboteur',
    state: 'WATCHING',
    heat: 0,
    lastAttackTick: null,
    attacksLanded: 0,
    attacksBlocked: 0,
    neutralized: false,
  },
  {
    botId: 'BOT_04',
    label: 'Debt Shark',
    state: 'WATCHING',
    heat: 0,
    lastAttackTick: null,
    attacksLanded: 0,
    attacksBlocked: 0,
    neutralized: false,
  },
  {
    botId: 'BOT_05',
    label: 'Closer',
    state: 'WATCHING',
    heat: 0,
    lastAttackTick: null,
    attacksLanded: 0,
    attacksBlocked: 0,
    neutralized: false,
  },
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

function buildSnapshot(
  mode: ModeCode,
  tier: PressureTier,
  overrides: SnapshotOverrides = {},
): RunStateSnapshot {
  const base: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: `${mode}-run-001`,
    userId: 'user-001',
    seed: 'seed-001',
    mode,
    tick: 24,
    phase: 'FOUNDATION',
    outcome: null,
    tags: [],
    economy: {
      cash: 1_250,
      debt: 200,
      incomePerTick: 180,
      expensesPerTick: 90,
      netWorth: 1_050,
      freedomTarget: 100_000,
      haterHeat: 14,
      opportunitiesPurchased: 1,
      privilegePlays: 0,
    },
    pressure: {
      score: 0.28,
      tier,
      band: 'BUILDING',
      previousTier: 'T0',
      previousBand: 'CALM',
      upwardCrossings: 1,
      survivedHighPressureTicks: 0,
      lastEscalationTick: 12,
      maxScoreSeen: 0.35,
    },
    tension: {
      score: 0.12,
      anticipation: 0.2,
      visibleThreats: [],
      maxPulseTriggered: false,
      lastSpikeTick: null,
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
      loadoutEnabled: true,
      sharedTreasury: false,
      sharedTreasuryBalance: 0,
      trustScores: {},
      roleAssignments: {},
      defectionStepByPlayer: {},
      legendMarkersEnabled: true,
      communityHeatModifier: 1,
      sharedOpportunityDeck: false,
      counterIntelTier: 0,
      spectatorLimit: 0,
      phaseBoundaryWindowsRemaining: 0,
      bleedMode: false,
      handicapIds: [],
      advantageId: null,
      disabledBots: [],
      modePresentation: buildModePresentation(mode),
      roleLockEnabled: false,
      extractionActionsRemaining: 0,
      ghostBaselineRunId: null,
      legendOwnerUserId: null,
    },
    timers: {
      seasonBudgetMs: 12 * 60 * 1_000,
      extensionBudgetMs: 0,
      elapsedMs: 60_000,
      currentTickDurationMs: 13_000,
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
    pressure: {
      ...base.pressure,
      ...overrides.pressure,
      tier: overrides.pressure?.tier ?? tier,
    },
    modeState: {
      ...base.modeState,
      ...overrides.modeState,
    },
    timers: {
      ...base.timers,
      ...overrides.timers,
    },
    telemetry: {
      ...base.telemetry,
      ...overrides.telemetry,
    },
  };
}

describe('solo_mode.time', () => {
  it('preserves the canonical T0 slowest -> T4 fastest law and grants the single sovereign hold by default', () => {
    const adapter = new SoloTimePolicyAdapter();
    const policy = adapter.getPolicy();
    const patch = adapter.resolveFactoryPatch();

    expect(policy.mode).toBe('solo');
    expect(policy.holdEnabled).toBe(true);
    expect(policy.baseHoldCharges).toBe(1);
    expect(policy.tiers.T0.defaultDurationMs).toBeGreaterThan(policy.tiers.T1.defaultDurationMs);
    expect(policy.tiers.T1.defaultDurationMs).toBeGreaterThan(policy.tiers.T2.defaultDurationMs);
    expect(policy.tiers.T2.defaultDurationMs).toBeGreaterThan(policy.tiers.T3.defaultDurationMs);
    expect(policy.tiers.T3.defaultDurationMs).toBeGreaterThan(policy.tiers.T4.defaultDurationMs);
    expect(patch.holdCharges).toBe(1);
    expect(patch.currentTickDurationMs).toBe(policy.tiers.T1.defaultDurationMs);
  });

  it('disables hold authority and compresses decision windows during bleed-mode clock-cursed runs', () => {
    const adapter = new SoloTimePolicyAdapter();
    const snapshot = buildSnapshot('solo', 'T2', {
      modeState: {
        bleedMode: true,
        handicapIds: ['CLOCK_CURSED', 'DISADVANTAGE_DRAFT'],
      },
      timers: {
        holdCharges: 1,
      },
    });

    const resolved = adapter.resolveSnapshot(snapshot);
    const named = adapter.resolveNamedWindows(snapshot);
    const canonicalT2 = adapter.getPolicy().tiers.T2;

    expect(resolved.holdEnabled).toBe(false);
    expect(resolved.holdChargesCap).toBe(0);
    expect(resolved.seasonBudgetMs).toBe(9 * 60 * 1_000);
    expect(resolved.tierConfig.decisionWindowMs).toBeLessThan(canonicalT2.decisionWindowMs);
    expect(named.forcedFateMs).toBe(resolved.tierConfig.decisionWindowMs);
    expect(named.phaseBoundaryMs).toBeGreaterThanOrEqual(resolved.currentTickDurationMs);
    expect(named.pressureSpikeMs).toBeLessThanOrEqual(resolved.currentTickDurationMs);
  });

  it('applies authoritative timer state, boundary windows, and telemetry hints back onto the snapshot', () => {
    const adapter = new SoloTimePolicyAdapter();
    const snapshot = buildSnapshot('solo', 'T1', {
      modeState: {
        holdEnabled: true,
        phaseBoundaryWindowsRemaining: 1,
      },
      timers: {
        holdCharges: 3,
      },
    });

    const applied = adapter.applySnapshot(snapshot, 90_000);

    expect(applied.timers.currentTickDurationMs).toBe(13_000);
    expect(applied.timers.nextTickAtMs).toBe(103_000);
    expect(applied.timers.holdCharges).toBe(1);
    expect(applied.modeState.phaseBoundaryWindowsRemaining).toBeGreaterThanOrEqual(5);
    expect(applied.modeState.sharedTreasury).toBe(false);
    expect(applied.modeState.sharedOpportunityDeck).toBe(false);
    expect(applied.telemetry.warnings).toContain('SOLO_TIME_POLICY_CANONICAL_ACTIVE');
    expect(applied.telemetry.forkHints).toContain('solo.time.hold_enabled=true');
  });
});
