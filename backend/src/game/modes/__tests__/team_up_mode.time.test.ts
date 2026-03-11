///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/modes/__tests__/team_up_mode.time.test.ts

import { describe, expect, it } from 'vitest';

import type { ModeCode, PressureTier, RunPhase, RunOutcome } from '../../engine/core/GamePrimitives';
import type { RunStateSnapshot } from '../../engine/core/RunStateSnapshot';
import { TeamUpTimePolicyAdapter } from '../adapters/TeamUpTimePolicyAdapter';

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
    tick: 18,
    phase: 'ESCALATION',
    outcome: null,
    tags: [],
    economy: {
      cash: 2_000,
      debt: 500,
      incomePerTick: 220,
      expensesPerTick: 150,
      netWorth: 1_500,
      freedomTarget: 120_000,
      haterHeat: 25,
      opportunitiesPurchased: 2,
      privilegePlays: 0,
    },
    pressure: {
      score: 0.55,
      tier,
      band: 'ELEVATED',
      previousTier: 'T1',
      previousBand: 'BUILDING',
      upwardCrossings: 2,
      survivedHighPressureTicks: 1,
      lastEscalationTick: 14,
      maxScoreSeen: 0.6,
    },
    tension: {
      score: 0.25,
      anticipation: 0.35,
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
      sharedTreasury: true,
      sharedTreasuryBalance: 750,
      trustScores: {},
      roleAssignments: {},
      defectionStepByPlayer: {},
      legendMarkersEnabled: false,
      communityHeatModifier: 1,
      sharedOpportunityDeck: false,
      counterIntelTier: 1,
      spectatorLimit: 4,
      phaseBoundaryWindowsRemaining: 1,
      bleedMode: false,
      handicapIds: [],
      advantageId: null,
      disabledBots: [],
      modePresentation: buildModePresentation(mode),
      roleLockEnabled: true,
      extractionActionsRemaining: 1,
      ghostBaselineRunId: null,
      legendOwnerUserId: null,
    },
    timers: {
      seasonBudgetMs: 14 * 60 * 1_000,
      extensionBudgetMs: 0,
      elapsedMs: 75_000,
      currentTickDurationMs: 14_040,
      nextTickAtMs: null,
      holdCharges: 0,
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

describe('team_up_mode.time', () => {
  it('uses the coop trust-architecture baseline with no holds and a widened season budget', () => {
    const adapter = new TeamUpTimePolicyAdapter();
    const policy = adapter.getPolicy();
    const patch = adapter.resolveFactoryPatch();

    expect(policy.mode).toBe('coop');
    expect(policy.holdEnabled).toBe(false);
    expect(policy.seasonBudgetMs).toBe(14 * 60 * 1_000);
    expect(policy.tiers.T0.defaultDurationMs).toBeGreaterThan(policy.tiers.T4.defaultDurationMs);
    expect(patch.holdCharges).toBe(0);
    expect(patch.currentTickDurationMs).toBe(policy.tiers.T1.defaultDurationMs);
  });

  it('widens relay, assist, and regroup timing windows for partner coordination without violating cadence law', () => {
    const adapter = new TeamUpTimePolicyAdapter();
    const snapshot = buildSnapshot('coop', 'T2');

    const resolved = adapter.resolveSnapshot(snapshot);
    const named = adapter.resolveNamedWindows(snapshot);

    expect(resolved.holdEnabled).toBe(false);
    expect(resolved.holdChargesCap).toBe(0);
    expect(named.relayDecisionMs).toBeGreaterThanOrEqual(resolved.tierConfig.decisionWindowMs);
    expect(named.assistWindowMs).toBeGreaterThanOrEqual(named.relayDecisionMs);
    expect(named.regroupWindowMs).toBeGreaterThanOrEqual(named.assistWindowMs);
    expect(named.syncWindowMs).toBeGreaterThanOrEqual(resolved.currentTickDurationMs);
    expect(named.threatBroadcastMs).toBeLessThanOrEqual(named.regroupWindowMs);
  });

  it('writes authoritative cooperative timer state and trust telemetry back onto the snapshot', () => {
    const adapter = new TeamUpTimePolicyAdapter();
    const snapshot = buildSnapshot('coop', 'T1', {
      modeState: {
        holdEnabled: true,
        sharedTreasury: true,
        sharedOpportunityDeck: false,
        phaseBoundaryWindowsRemaining: 2,
      },
      timers: {
        holdCharges: 2,
      },
    });

    const applied = adapter.applySnapshot(snapshot, 100_000);

    expect(applied.timers.nextTickAtMs).toBe(114_040);
    expect(applied.timers.holdCharges).toBe(0);
    expect(applied.modeState.holdEnabled).toBe(false);
    expect(applied.modeState.sharedTreasury).toBe(false);
    expect(applied.modeState.sharedOpportunityDeck).toBe(true);
    expect(applied.modeState.roleLockEnabled).toBe(false);
    expect(applied.modeState.phaseBoundaryWindowsRemaining).toBeGreaterThanOrEqual(5);
    expect(applied.telemetry.warnings).toContain('TEAM_UP_TIME_POLICY_TRUST_ACTIVE');
    expect(applied.telemetry.forkHints.some((hint) => hint.startsWith('teamup.time.assist_window_ms='))).toBe(true);
  });
});
