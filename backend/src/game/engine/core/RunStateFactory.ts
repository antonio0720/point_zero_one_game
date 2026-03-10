/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import type { HaterBotId, ModeCode } from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import { deepFrozenClone } from './Deterministic';

const layer = (layerId: 'L1' | 'L2' | 'L3' | 'L4', label: 'CASH_RESERVE' | 'CREDIT_LINE' | 'INCOME_BASE' | 'NETWORK_CORE', max: number, regenPerTick: number) => ({
  layerId,
  label,
  current: max,
  max,
  regenPerTick,
});

export interface RunFactoryInput {
  runId: string;
  userId: string;
  seed: string;
  mode: ModeCode;
  communityHeatModifier?: number;
}

export function createInitialRunState(input: RunFactoryInput): RunStateSnapshot {
  const disabledBots: HaterBotId[] = [];
  const snapshot: RunStateSnapshot = {
    runId: input.runId,
    userId: input.userId,
    seed: input.seed,
    mode: input.mode,
    tick: 0,
    phase: 'FOUNDATION',
    outcome: null,
    tags: [`mode:${input.mode}`],
    economy: {
      cash: input.mode === 'solo' ? 20000 : 15000,
      debt: 0,
      incomePerTick: 1200,
      expensesPerTick: 900,
      netWorth: 20000,
      freedomTarget: 250000,
      haterHeat: input.mode === 'ghost' ? 25 : 0,
      opportunitiesPurchased: 0,
      privilegePlays: 0,
    },
    pressure: {
      score: 15,
      tier: 'T1',
      previousTier: 'T1',
      upwardCrossings: 0,
      survivedHighPressureTicks: 0,
    },
    tension: {
      score: 0,
      anticipation: 0,
      visibleThreats: [],
      maxPulseTriggered: false,
    },
    shield: {
      layers: [
        layer('L1', 'CASH_RESERVE', 100, 2),
        layer('L2', 'CREDIT_LINE', 100, 2),
        layer('L3', 'INCOME_BASE', 100, 1),
        layer('L4', 'NETWORK_CORE', 100, 1),
      ],
      weakestLayerId: 'L1',
      blockedThisRun: 0,
      damagedThisRun: 0,
      breachesThisRun: 0,
      repairQueueDepth: 0,
    },
    battle: {
      bots: [],
      battleBudget: input.mode === 'pvp' ? 20 : 0,
      battleBudgetCap: 200,
      extractionCooldownTicks: 0,
      firstBloodClaimed: false,
      pendingAttacks: [],
      sharedOpportunityDeckCursor: 0,
      rivalryHeatCarry: 0,
    },
    cascade: {
      activeChains: [],
      positiveTrackers: [],
      brokenChains: 0,
      completedChains: 0,
      repeatedTriggerCounts: {},
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
    },
    cards: {
      hand: [],
      discard: [],
      exhaust: [],
      drawHistory: [],
      lastPlayed: [],
      ghostMarkers: [],
    },
    modeState: {
      holdEnabled: input.mode === 'solo',
      loadoutEnabled: input.mode === 'solo',
      sharedTreasury: input.mode === 'coop',
      sharedTreasuryBalance: input.mode === 'coop' ? 30000 : 0,
      trustScores: {},
      roleAssignments: {},
      defectionStepByPlayer: {},
      legendMarkersEnabled: input.mode === 'ghost',
      communityHeatModifier: input.communityHeatModifier ?? 0,
      sharedOpportunityDeck: input.mode === 'pvp',
      counterIntelTier: 1,
      spectatorLimit: input.mode === 'pvp' ? 50 : 0,
      phaseBoundaryWindowsRemaining: 0,
      bleedMode: false,
      handicapIds: [],
      advantageId: null,
      disabledBots,
    },
    timers: {
      seasonBudgetMs: 12 * 60 * 1000,
      extensionBudgetMs: 0,
      elapsedMs: 0,
      currentTickDurationMs: 4000,
      holdCharges: input.mode === 'solo' ? 1 : 0,
      activeDecisionWindows: {},
      frozenWindowIds: [],
    },
    telemetry: {
      decisions: [],
      outcomeReason: null,
      lastTickChecksum: null,
      forkHints: [],
    },
  };

  return deepFrozenClone(snapshot);
}
