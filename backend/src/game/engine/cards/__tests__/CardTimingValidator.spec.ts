/*
 * POINT ZERO ONE — BACKEND ENGINE TESTS
 * /backend/src/game/engine/cards/__tests__/CardTimingValidator.spec.ts
 *
 * Doctrine:
 * - timing legality is backend-authoritative
 * - tests must validate mode-native windows, not UI assumptions
 * - snapshot fixtures should stay deterministic and explicit
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createCardInstance,
  type AttackEvent,
  type AttackCategory,
  type CardDefinition,
  type CardInstance,
  type ModeCode,
  type TimingClass,
} from '../../core/GamePrimitives';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import { CardRegistry } from '../CardRegistry';
import { CardTimingValidator } from '../CardTimingValidator';

type SnapshotOverrides = Partial<
  Omit<
    RunStateSnapshot,
    | 'economy'
    | 'pressure'
    | 'tension'
    | 'shield'
    | 'battle'
    | 'cascade'
    | 'sovereignty'
    | 'cards'
    | 'modeState'
    | 'timers'
    | 'telemetry'
  >
> & {
  economy?: Partial<RunStateSnapshot['economy']>;
  pressure?: Partial<RunStateSnapshot['pressure']>;
  tension?: Partial<RunStateSnapshot['tension']>;
  shield?: Partial<RunStateSnapshot['shield']>;
  battle?: Partial<RunStateSnapshot['battle']>;
  cascade?: Partial<RunStateSnapshot['cascade']>;
  sovereignty?: Partial<RunStateSnapshot['sovereignty']>;
  cards?: Partial<RunStateSnapshot['cards']>;
  modeState?: Partial<RunStateSnapshot['modeState']>;
  timers?: Partial<RunStateSnapshot['timers']>;
  telemetry?: Partial<RunStateSnapshot['telemetry']>;
};

const registry = new CardRegistry();

function createAttack(category: AttackCategory): AttackEvent {
  return {
    attackId: `attack-${category}`,
    source: 'BOT_01',
    targetEntity: 'PLAYER',
    targetLayer: 'L1',
    category,
    magnitude: 10,
    createdAtTick: 1,
    notes: [],
  };
}

function createSnapshot(overrides: SnapshotOverrides = {}): RunStateSnapshot {
  const mode = overrides.mode ?? 'solo';

  const base: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run_001',
    userId: 'user_001',
    seed: 'seed_001',
    mode,
    tick: 0,
    phase: 'FOUNDATION',
    outcome: null,
    tags: [],
    economy: {
      cash: 10_000,
      debt: 0,
      incomePerTick: 500,
      expensesPerTick: 150,
      netWorth: 10_000,
      freedomTarget: 1_000_000,
      haterHeat: 0,
      opportunitiesPurchased: 0,
      privilegePlays: 0,
    },
    pressure: {
      score: 0.1,
      tier: 'T0',
      band: 'CALM',
      previousTier: 'T0',
      previousBand: 'CALM',
      upwardCrossings: 0,
      survivedHighPressureTicks: 0,
      lastEscalationTick: null,
      maxScoreSeen: 0.1,
    },
    tension: {
      score: 0,
      anticipation: 0,
      visibleThreats: [],
      maxPulseTriggered: false,
      lastSpikeTick: null,
    },
    shield: {
      layers: [
        {
          layerId: 'L1',
          label: 'CASH_RESERVE',
          current: 100,
          max: 100,
          regenPerTick: 1,
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
          regenPerTick: 1,
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
          regenPerTick: 1,
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
      bots: [],
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
      drawPileSize: 20,
      deckEntropy: 0.5,
    },
    modeState: {
      holdEnabled: false,
      loadoutEnabled: false,
      sharedTreasury: false,
      sharedTreasuryBalance: 0,
      trustScores: { user_001: 70 },
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
      seasonBudgetMs: 300_000,
      extensionBudgetMs: 0,
      elapsedMs: 0,
      currentTickDurationMs: 1_000,
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

function createTimingCard(
  mode: ModeCode,
  timingClass: readonly TimingClass[],
  definitionId = 'NETWORK_CALL',
): CardInstance {
  const definition = registry.require(definitionId);

  return createCardInstance(definition, {
    instanceId: `${definitionId}-${mode}-${timingClass.join('_')}`,
    mode,
    timingClass,
  });
}

describe('CardTimingValidator', () => {
  const validator = new CardTimingValidator();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects all timing windows once the run has already resolved', () => {
    const snapshot = createSnapshot({
      outcome: 'TIMEOUT',
    });
    const card = createTimingCard('solo', ['ANY']);

    expect(validator.isLegal(snapshot, card)).toBe(false);
    expect(validator.legalTimings(snapshot, card)).toEqual([]);
  });

  it('accepts ANY timing universally', () => {
    const snapshot = createSnapshot({
      mode: 'pvp',
      phase: 'ESCALATION',
      tick: 8,
    });
    const card = createTimingCard('pvp', ['ANY']);

    expect(validator.isLegal(snapshot, card)).toBe(true);
    expect(validator.legalTimings(snapshot, card)).toEqual(['ANY']);
  });

  it('accepts PRE during foundation windows', () => {
    const snapshot = createSnapshot({
      mode: 'solo',
      phase: 'FOUNDATION',
      tick: 0,
    });
    const card = createTimingCard('solo', ['PRE']);

    expect(validator.isLegal(snapshot, card)).toBe(true);
  });

  it('accepts POST only after the opening tick and in later phases', () => {
    const openingSnapshot = createSnapshot({
      mode: 'solo',
      tick: 0,
      phase: 'FOUNDATION',
    });
    const postSnapshot = createSnapshot({
      mode: 'solo',
      tick: 3,
      phase: 'ESCALATION',
    });
    const card = createTimingCard('solo', ['POST']);

    expect(validator.isLegal(openingSnapshot, card)).toBe(false);
    expect(validator.isLegal(postSnapshot, card)).toBe(true);
  });

  it('accepts FATE when recent history resolves to a FUBAR deck card', () => {
    const baseDefinition = registry.require('NETWORK_CALL');
    const syntheticFubar: CardDefinition = {
      ...baseDefinition,
      id: 'SCRIPTED_FUBAR',
      deckType: 'FUBAR',
    };

    const actualGet = CardRegistry.prototype.get;

    vi.spyOn(CardRegistry.prototype, 'get').mockImplementation(function (
      this: CardRegistry,
      id: string,
    ) {
      if (id === 'SCRIPTED_FUBAR') {
        return syntheticFubar;
      }

      return actualGet.call(this, id);
    });

    const snapshot = createSnapshot({
      cards: {
        lastPlayed: ['SCRIPTED_FUBAR'],
      },
    });
    const card = createTimingCard('solo', ['FATE']);

    expect(validator.isLegal(snapshot, card)).toBe(true);
  });

  it('accepts CTR in pvp when extraction-class hostility or counter-intel pressure exists', () => {
    const attacked = createSnapshot({
      mode: 'pvp',
      battle: {
        pendingAttacks: [createAttack('BREACH')],
      },
    });
    const intelRaised = createSnapshot({
      mode: 'pvp',
      modeState: {
        counterIntelTier: 1,
      },
    });
    const card = createTimingCard('pvp', ['CTR']);

    expect(validator.isLegal(attacked, card)).toBe(true);
    expect(validator.isLegal(intelRaised, card)).toBe(true);
  });

  it('accepts RES in coop when trust collapses or bleed mode engages', () => {
    const trustCollapse = createSnapshot({
      mode: 'coop',
      modeState: {
        trustScores: {
          user_001: 30,
          ally_002: 82,
        },
      },
    });
    const bleedMode = createSnapshot({
      mode: 'coop',
      modeState: {
        bleedMode: true,
      },
    });
    const card = createTimingCard('coop', ['RES']);

    expect(validator.isLegal(trustCollapse, card)).toBe(true);
    expect(validator.isLegal(bleedMode, card)).toBe(true);
  });

  it('accepts AID in coop when shared treasury or team roles are active', () => {
    const treasury = createSnapshot({
      mode: 'coop',
      modeState: {
        sharedTreasury: true,
        sharedTreasuryBalance: 1_500,
      },
    });
    const roles = createSnapshot({
      mode: 'coop',
      modeState: {
        roleAssignments: {
          user_001: 'anchor',
          ally_002: 'support',
        },
      },
    });
    const card = createTimingCard('coop', ['AID']);

    expect(validator.isLegal(treasury, card)).toBe(true);
    expect(validator.isLegal(roles, card)).toBe(true);
  });

  it('accepts GBM only in ghost mode when legend markers are active and near the current tick', () => {
    const snapshot = createSnapshot({
      mode: 'ghost',
      tick: 10,
      modeState: {
        legendMarkersEnabled: true,
        ghostBaselineRunId: 'legend-run-001',
      },
      cards: {
        ghostMarkers: [
          {
            markerId: 'marker_001',
            tick: 8,
            kind: 'GOLD',
            cardId: null,
            summary: 'Legend breakpoint',
          },
        ],
      },
    });
    const card = createTimingCard('ghost', ['GBM'], 'MARKER_EXPLOIT');

    expect(validator.isLegal(snapshot, card)).toBe(true);
  });

  it('accepts CAS only when cascade chains are active', () => {
    const inactive = createSnapshot();
    const active = createSnapshot({
      cascade: {
        activeChains: [
          {
            chainId: 'chain_001',
            templateId: 'template_001',
            trigger: 'trigger_001',
            positive: true,
            status: 'ACTIVE',
            createdAtTick: 1,
            links: [],
            recoveryTags: [],
          },
        ],
      },
    });
    const card = createTimingCard('solo', ['CAS'], 'CASCADE_BREAK');

    expect(validator.isLegal(inactive, card)).toBe(false);
    expect(validator.isLegal(active, card)).toBe(true);
  });

  it('accepts PHZ only when solo phase-boundary windows remain', () => {
    const closed = createSnapshot({
      mode: 'solo',
      modeState: {
        phaseBoundaryWindowsRemaining: 0,
      },
    });
    const open = createSnapshot({
      mode: 'solo',
      modeState: {
        phaseBoundaryWindowsRemaining: 2,
      },
    });
    const card = createTimingCard('solo', ['PHZ'], 'MOMENTUM_PIVOT');

    expect(validator.isLegal(closed, card)).toBe(false);
    expect(validator.isLegal(open, card)).toBe(true);
  });

  it('accepts PSK when pressure tier or band escalates upward', () => {
    const snapshot = createSnapshot({
      pressure: {
        previousTier: 'T1',
        tier: 'T2',
        previousBand: 'BUILDING',
        band: 'ELEVATED',
      },
    });
    const card = createTimingCard('solo', ['PSK']);

    expect(validator.isLegal(snapshot, card)).toBe(true);
  });

  it('accepts END when the remaining season clock is at or below the final window', () => {
    const snapshot = createSnapshot({
      timers: {
        seasonBudgetMs: 120_000,
        extensionBudgetMs: 10_000,
        elapsedMs: 100_500,
      },
    });
    const card = createTimingCard('solo', ['END'], 'TIME_DEBT_PAID');

    expect(validator.isLegal(snapshot, card)).toBe(true);
  });

  it('returns only the timing classes that are legal for the current snapshot', () => {
    const snapshot = createSnapshot({
      mode: 'solo',
      tick: 0,
      phase: 'FOUNDATION',
      modeState: {
        phaseBoundaryWindowsRemaining: 0,
      },
    });
    const card = createTimingCard('solo', ['POST', 'PRE', 'ANY', 'END']);

    expect(validator.legalTimings(snapshot, card)).toEqual(['PRE', 'ANY']);
  });
});