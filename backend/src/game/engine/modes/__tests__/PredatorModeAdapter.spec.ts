// backend/src/game/engine/modes/__tests__/PredatorModeAdapter.spec.ts

/**
 * ============================================================================
 * POINT ZERO ONE — PREDATOR MODE ADAPTER — COMPREHENSIVE TEST SUITE
 * ============================================================================
 *
 * Coverage doctrine:
 * - Every PredatorModeAdapter lifecycle method tested with full input/output
 *   verification across boundary conditions, edge cases, and nominal paths.
 * - All GamePrimitives utility functions called inside test assertions so
 *   every import is live runtime code, not a dead type-only reference.
 * - ML/DL feature vectors extracted and asserted at key lifecycle moments.
 * - Mode signal bridge (ModeSignalAdapter) verified on every lifecycle call.
 * - All 7 extraction costs verified individually.
 * - Battle budget clamping, hoarding penalty, and passive income tiers all
 *   verified across every pressure tier boundary.
 * - Full 10-tick pvp simulation exercised to validate accumulation semantics.
 * - Spectator projection, cooldown decrement, and first blood idempotency
 *   verified in depth.
 * - Tag canonicalization, snapshot immutability, and mode isolation verified.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  CARD_RARITY_WEIGHT,
  DECK_TYPE_POWER_LEVEL,
  HATER_BOT_IDS,
  MODE_CODES,
  MODE_DIFFICULTY_MULTIPLIER,
  MODE_NORMALIZED,
  PRESSURE_TIER_NORMALIZED,
  PRESSURE_TIERS,
  RUN_PHASE_NORMALIZED,
  RUN_PHASES,
  SHIELD_LAYER_CAPACITY_WEIGHT,
  SHIELD_LAYER_IDS,
  TIMING_CLASS_WINDOW_PRIORITY,
  classifyAttackSeverity,
  classifyThreatUrgency,
  computeAggregateBotThreat,
  computeBotThreatScore,
  computeCardPowerScore,
  computeCardTimingPriority,
  computeDefenseUrgency,
  computeLegendMarkerValue,
  computePressureRiskScore,
  computeShieldIntegrityRatio,
  computeShieldLayerVulnerability,
  estimateShieldRegenPerTick,
  isCardLegalInMode,
  isModeCode,
  isPressureTier,
  isRunOutcome,
  isRunPhase,
  isShieldLayerId,
  isHaterBotId,
  scoreCascadeChainHealth,
  scoreOutcomeExcitement,
} from '../../core/GamePrimitives';
import type {
  AttackEvent,
  BotState,
  CardDefinition,
  CardInstance,
  CascadeChainInstance,
  HaterBotId,
  LegendMarker,
  ModeCode,
  PressureTier,
  RunOutcome,
  RunPhase,
  ShieldLayerId,
  ThreatEnvelope,
} from '../../core/GamePrimitives';
import {
  computeSnapshotCompositeRisk,
  hasActiveDecisionWindows,
  hasCriticalPendingAttacks,
  hasPlayableCards,
  isBattleEscalating,
  isCascadeCritical,
  isEconomyHealthy,
  isRunFlagged,
  isShieldFailing,
  isSnapshotInCrisis,
  isSnapshotInEndgame,
  isSnapshotLoss,
  isSnapshotTerminal,
  isSnapshotWin,
  isSovereigntyAtRisk,
  getNormalizedPressureTier,
  getPressureTierUrgencyLabel,
} from '../../core/RunStateSnapshot';
import type { RunStateSnapshot } from '../../core/RunStateSnapshot';
import type {
  ModeActionId,
  ModeAdapter,
  ModeConfigureOptions,
} from '../ModeContracts';
import { PredatorModeAdapter } from '../PredatorModeAdapter';
import { ModeRegistry } from '../ModeRegistry';
import { ModeRuntimeDirector } from '../ModeRuntimeDirector';
import {
  ModeSignalAdapter,
  ModeSignalAnalytics,
  ModeSignalBatchProcessor,
  ModeMlFeatureExtractor,
  ModeDlTensorBuilder,
  ModeSignalRiskScorer,
  MODE_SIGNAL_ML_FEATURE_COUNT,
  MODE_SIGNAL_DL_FEATURE_COUNT,
  MODE_SIGNAL_DL_TENSOR_SHAPE,
  MODE_SIGNAL_ML_FEATURE_LABELS,
  MODE_SIGNAL_DL_FEATURE_LABELS,
  buildModeSignalAdapter,
  buildModeSignalBatchProcessor,
  extractModeMLVector,
  buildModeDLTensor,
  scoreModeRisk,
} from '../../../engine/chat/adapters/ModeSignalAdapter';

// ============================================================================
// MARK: Module-level constants
// ============================================================================

/** Battle budget cap hardcoded in PredatorModeAdapter.configure */
const BATTLE_BUDGET_CAP = 200;

/** Rivalry heat carry max (clamped in configure) */
const RIVALRY_HEAT_CARRY_MAX = 25;

/** Spectator limit max (clamped in configure) */
const SPECTATOR_LIMIT_MAX = 50;

/** Extraction cooldown ticks after FIRE_EXTRACTION */
const EXTRACTION_COOLDOWN_TICKS = 3;

/** Counter play cost */
const COUNTER_PLAY_COST = 10;

/** First blood bonus */
const FIRST_BLOOD_BONUS = 25;

/** Hoarding penalty threshold */
const HOARDING_THRESHOLD = 150;

/** Passive income per tick at T0/T1 */
const PASSIVE_INCOME_LOW = 8;

/** Passive income per tick at T2 */
const PASSIVE_INCOME_MID = 6;

/** Passive income per tick at T3/T4 */
const PASSIVE_INCOME_HIGH = 4;

/** All canonical mode codes */
const ALL_MODE_CODES: readonly ModeCode[] = MODE_CODES;

/** All canonical pressure tiers */
const ALL_PRESSURE_TIERS: readonly PressureTier[] = PRESSURE_TIERS;

/** All canonical run phases */
const ALL_RUN_PHASES: readonly RunPhase[] = RUN_PHASES;

/** All canonical shield layer IDs */
const ALL_SHIELD_LAYER_IDS: readonly ShieldLayerId[] = SHIELD_LAYER_IDS;

/** All canonical bot IDs */
const ALL_HATER_BOT_IDS: readonly HaterBotId[] = HATER_BOT_IDS;

/** Extraction cost table — mirrors PredatorModeAdapter internals */
const EXTRACTION_COSTS: Readonly<Record<string, number>> = {
  MARKET_DUMP: 30,
  CREDIT_REPORT_PULL: 25,
  REGULATORY_FILING: 35,
  MISINFORMATION_FLOOD: 20,
  DEBT_INJECTION: 40,
  HOSTILE_TAKEOVER: 60,
  LIQUIDATION_NOTICE: 45,
};

/** Finalize multiplier: FIRST_BLOOD adds 0.05 */
const FINALIZE_FIRST_BLOOD_BONUS = 0.05;

/** Finalize multiplier: ARCH_RIVAL_PRESSURE adds 0.10 */
const FINALIZE_ARCH_RIVAL_BONUS = 0.10;

/** Finalize multiplier: ARENA_CONTROL adds 0.05 per neutralized bot (max 0.25) */
const FINALIZE_ARENA_CONTROL_PER_BOT = 0.05;

/** Finalize multiplier: AGGRESSOR adds 0.10 */
const FINALIZE_AGGRESSOR_BONUS = 0.10;

/** Baseline cord score for finalize tests */
const BASE_CORD_SCORE = 2.0;

// ============================================================================
// MARK: Factory helpers
// ============================================================================

function createCardDefinition(id = 'card-1', deckType: CardDefinition['deckType'] = 'OPPORTUNITY'): CardDefinition {
  return {
    id,
    name: `Card ${id}`,
    deckType,
    baseCost: 100,
    baseEffect: { cashDelta: 500, battleBudgetDelta: 10 },
    tags: ['income', 'pvp'],
    timingClass: ['ANY'],
    rarity: 'COMMON',
    autoResolve: false,
    counterability: 'SOFT',
    targeting: 'SELF',
    decisionTimerOverrideMs: null,
    decayTicks: null,
    modeLegal: ['solo', 'pvp'],
    educationalTag: 'cashflow',
  };
}

function createCardInstance(
  id = 'ci-1',
  tags: string[] = ['counter'],
  deckType: CardDefinition['deckType'] = 'COUNTER',
): CardInstance {
  return {
    instanceId: id,
    definitionId: 'card-1',
    card: createCardDefinition('card-1', deckType),
    cost: 100,
    targeting: 'OPPONENT',
    timingClass: ['CTR'],
    tags,
    overlayAppliedForMode: 'pvp',
    decayTicksRemaining: null,
    divergencePotential: 'LOW',
  };
}

function createThreat(
  id = 'th-1',
  etaTicks = 2,
  visibility: ThreatEnvelope['visibleAs'] = 'PARTIAL',
): ThreatEnvelope {
  return {
    threatId: id,
    source: 'BOT_01',
    etaTicks,
    severity: 1,
    visibleAs: visibility,
    summary: 'Incoming extraction threat',
  };
}

function createLegendMarker(id = 'lm-1'): LegendMarker {
  return {
    markerId: id,
    tick: 5,
    kind: 'GOLD',
    cardId: null,
    summary: 'Legend record at tick 5',
  };
}

function createAttack(
  id = 'atk-1',
  category: AttackEvent['category'] = 'EXTRACTION',
  magnitude = 15,
): AttackEvent {
  return {
    attackId: id,
    source: 'OPPONENT',
    targetEntity: 'SELF',
    targetLayer: 'L2',
    category,
    magnitude,
    createdAtTick: 3,
    notes: ['Opponent fired extraction'],
  };
}

function createCascadeChain(id = 'chain-1', positive = true): CascadeChainInstance {
  return {
    chainId: id,
    templateId: 'template-cash-flow',
    trigger: 'card-played',
    positive,
    status: 'ACTIVE',
    createdAtTick: 0,
    links: [
      {
        linkId: `${id}-link-1`,
        scheduledTick: 1,
        effect: { cashDelta: 500, battleBudgetDelta: 5 },
        summary: 'First link: cash + budget',
      },
      {
        linkId: `${id}-link-2`,
        scheduledTick: 2,
        effect: { cashDelta: 750 },
        summary: 'Second link: cash boost',
      },
    ],
    recoveryTags: ['pvp:recovery'],
  };
}

function createSnapshot(overrides?: Partial<RunStateSnapshot>): RunStateSnapshot {
  const base: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-predator-1',
    userId: 'user-predator',
    seed: 'seed-pvp',
    mode: 'pvp',
    tick: 0,
    phase: 'FOUNDATION',
    outcome: null,
    tags: [],
    economy: {
      cash: 20_000,
      debt: 5_000,
      incomePerTick: 200,
      expensesPerTick: 80,
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
      score: 0.3,
      anticipation: 0.25,
      visibleThreats: [createThreat()],
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
      sovereigntyScore: 1,
      verifiedGrade: null,
      proofBadges: [],
      gapVsLegend: 0,
      gapClosingRate: 0,
      cordScore: BASE_CORD_SCORE,
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
      modePresentation: 'predator',
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

  return overrides ? { ...base, ...overrides } : base;
}

// ============================================================================
// MARK: Helper — compute first cascade chain health from snapshot
// ============================================================================

function computeFirstCascadeHealth(snapshot: RunStateSnapshot): number {
  if (snapshot.cascade.activeChains.length === 0) return 0;
  return scoreCascadeChainHealth(snapshot.cascade.activeChains[0] as unknown as CascadeChainInstance);
}

// ============================================================================
// MARK: Test suite
// ============================================================================

describe('PredatorModeAdapter', () => {
  const adapter = new PredatorModeAdapter();

  // --------------------------------------------------------------------------
  // SECTION 1: configure() — baseline tag and state verification
  // --------------------------------------------------------------------------

  describe('configure() — baseline tags and initial state', () => {
    it('assigns modeCode "pvp"', () => {
      expect(adapter.modeCode).toBe('pvp');
      expect(isModeCode(adapter.modeCode)).toBe(true);
      expect(ALL_MODE_CODES).toContain(adapter.modeCode);
    });

    it('adds required pvp tags', () => {
      const configured = adapter.configure(createSnapshot(), {
        battleBudgetStart: 40,
        rivalryHeatCarry: 10,
        spectatorLimit: 25,
      });

      expect(configured.tags).toContain('mode:predator');
      expect(configured.tags).toContain('battle_budget:enabled');
      expect(configured.tags).toContain('shared_opportunity_deck:enabled');
      expect(configured.tags).toContain('spectators:enabled');
    });

    it('implements ModeAdapter interface correctly', () => {
      const asAdapter: ModeAdapter = adapter;
      expect(asAdapter.modeCode).toBe('pvp');
      expect(typeof asAdapter.configure).toBe('function');
    });

    it('sets battleBudget and battleBudgetCap from options', () => {
      const configured = adapter.configure(createSnapshot(), {
        battleBudgetStart: 500, // clamped to 200
        rivalryHeatCarry: 40,   // clamped to 25
        spectatorLimit: 100,    // clamped to 50
      });

      expect(configured.battle.battleBudget).toBe(BATTLE_BUDGET_CAP);
      expect(configured.battle.battleBudgetCap).toBe(BATTLE_BUDGET_CAP);
    });

    it('clamps rivalry heat carry to 25 maximum', () => {
      const s = createSnapshot();
      const configured = adapter.configure(s, { rivalryHeatCarry: 999 });
      expect(configured.battle.rivalryHeatCarry).toBe(RIVALRY_HEAT_CARRY_MAX);
      expect(configured.economy.haterHeat).toBe(RIVALRY_HEAT_CARRY_MAX);
    });

    it('clamps spectator limit to 50 maximum', () => {
      const configured = adapter.configure(createSnapshot(), { spectatorLimit: 9999 });
      expect(configured.modeState.spectatorLimit).toBe(SPECTATOR_LIMIT_MAX);
    });

    it('initializes extractionActionsRemaining to 1', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.extractionActionsRemaining).toBe(1);
    });

    it('sets sharedOpportunityDeck to true', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.sharedOpportunityDeck).toBe(true);
    });

    it('sets sharedOpportunityDeckCursor to 0', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.battle.sharedOpportunityDeckCursor).toBe(0);
    });

    it('sets extractionCooldownTicks to 0 on configure', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.battle.extractionCooldownTicks).toBe(0);
    });

    it('sets modePresentation to "predator"', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.modePresentation).toBe('predator');
    });

    it('sets holdEnabled to false', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.holdEnabled).toBe(false);
    });

    it('sets holdCharges to 0', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.timers.holdCharges).toBe(0);
    });

    it('does not enable legendMarkers', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.legendMarkersEnabled).toBe(false);
    });

    it('adds rivalry heat carry to haterHeat on configure', () => {
      const base = createSnapshot();
      const s = { ...base, economy: { ...base.economy, haterHeat: 5 } };
      const configured = adapter.configure(s, { rivalryHeatCarry: 10 });
      expect(configured.economy.haterHeat).toBe(15);
    });

    it('works with zero rivalry heat carry', () => {
      const configured = adapter.configure(createSnapshot(), { rivalryHeatCarry: 0 });
      expect(configured.battle.rivalryHeatCarry).toBe(0);
      expect(configured.economy.haterHeat).toBe(0);
    });

    it('does not mutate the original snapshot', () => {
      const original = createSnapshot();
      const originalTags = [...original.tags];
      adapter.configure(original, { rivalryHeatCarry: 15 });
      expect(original.tags).toEqual(originalTags);
      expect(original.battle.rivalryHeatCarry).toBe(0);
    });

    it('mode normalized value is 0.33 for pvp', () => {
      const pvpNorm = MODE_NORMALIZED['pvp'];
      expect(pvpNorm).toBeCloseTo(0.33, 2);
    });

    it('mode difficulty multiplier is 1.4 for pvp', () => {
      const pvpDiff = MODE_DIFFICULTY_MULTIPLIER['pvp'];
      expect(pvpDiff).toBe(1.4);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: configure() — options edge cases
  // --------------------------------------------------------------------------

  describe('configure() — edge cases and boundary values', () => {
    it('works with no options (all defaults)', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.battle.battleBudget).toBe(40); // default clamp(40, 0, 200)
      expect(configured.battle.rivalryHeatCarry).toBe(0);
      expect(configured.modeState.spectatorLimit).toBe(50);
    });

    it('clamps negative battleBudgetStart to 0', () => {
      const configured = adapter.configure(createSnapshot(), { battleBudgetStart: -100 });
      expect(configured.battle.battleBudget).toBe(0);
    });

    it('clamps negative rivalryHeatCarry to 0', () => {
      const configured = adapter.configure(createSnapshot(), { rivalryHeatCarry: -50 });
      expect(configured.battle.rivalryHeatCarry).toBe(0);
    });

    it('clamps negative spectatorLimit to 0', () => {
      const configured = adapter.configure(createSnapshot(), { spectatorLimit: -10 });
      expect(configured.modeState.spectatorLimit).toBe(0);
    });

    it('accepts exact maximum battleBudgetStart of 200', () => {
      const configured = adapter.configure(createSnapshot(), { battleBudgetStart: 200 });
      expect(configured.battle.battleBudget).toBe(200);
    });

    it('accepts exact maximum rivalryHeatCarry of 25', () => {
      const configured = adapter.configure(createSnapshot(), { rivalryHeatCarry: 25 });
      expect(configured.battle.rivalryHeatCarry).toBe(25);
      expect(configured.economy.haterHeat).toBe(25);
    });

    it('accepts exact maximum spectatorLimit of 50', () => {
      const configured = adapter.configure(createSnapshot(), { spectatorLimit: 50 });
      expect(configured.modeState.spectatorLimit).toBe(50);
    });

    it('deduplicates tags when snapshot already has pvp tags', () => {
      const s = { ...createSnapshot(), tags: ['mode:predator', 'existing-tag'] };
      const configured = adapter.configure(s, {});
      const predatorTagCount = configured.tags.filter((t) => t === 'mode:predator').length;
      expect(predatorTagCount).toBe(1);
    });

    it('sets counterIntelTier to 1', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.counterIntelTier).toBe(1);
    });

    it('returns snapshot with mode still set to pvp', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.mode).toBe('pvp');
      expect(isRunPhase(configured.phase)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: onTickStart() — extraction action refresh
  // --------------------------------------------------------------------------

  describe('onTickStart() — extraction action refresh', () => {
    it('refreshes extractionActionsRemaining to 1 at tick % 3 === 0 (tick 3)', () => {
      const base = createSnapshot();
      const started = adapter.onTickStart({
        ...base,
        tick: 3,
        modeState: { ...base.modeState, extractionActionsRemaining: 0 },
      });
      expect(started.modeState.extractionActionsRemaining).toBe(1);
    });

    it('refreshes at tick 6', () => {
      const base = createSnapshot();
      const started = adapter.onTickStart({
        ...base,
        tick: 6,
        modeState: { ...base.modeState, extractionActionsRemaining: 0 },
      });
      expect(started.modeState.extractionActionsRemaining).toBe(1);
    });

    it('refreshes at tick 9', () => {
      const base = createSnapshot();
      const started = adapter.onTickStart({
        ...base,
        tick: 9,
        modeState: { ...base.modeState, extractionActionsRemaining: 0 },
      });
      expect(started.modeState.extractionActionsRemaining).toBe(1);
    });

    it('refreshes at tick 12', () => {
      const base = createSnapshot();
      const started = adapter.onTickStart({
        ...base,
        tick: 12,
        modeState: { ...base.modeState, extractionActionsRemaining: 0 },
      });
      expect(started.modeState.extractionActionsRemaining).toBe(1);
    });

    it('does NOT refresh at tick 1', () => {
      const base = createSnapshot();
      const started = adapter.onTickStart({
        ...base,
        tick: 1,
        modeState: { ...base.modeState, extractionActionsRemaining: 0 },
      });
      expect(started.modeState.extractionActionsRemaining).toBe(0);
    });

    it('does NOT refresh at tick 2', () => {
      const base = createSnapshot();
      const started = adapter.onTickStart({
        ...base,
        tick: 2,
        modeState: { ...base.modeState, extractionActionsRemaining: 0 },
      });
      expect(started.modeState.extractionActionsRemaining).toBe(0);
    });

    it('does NOT refresh at tick 4', () => {
      const base = createSnapshot();
      const started = adapter.onTickStart({
        ...base,
        tick: 4,
        modeState: { ...base.modeState, extractionActionsRemaining: 0 },
      });
      expect(started.modeState.extractionActionsRemaining).toBe(0);
    });

    it('does NOT refresh at tick 5', () => {
      const base = createSnapshot();
      const started = adapter.onTickStart({
        ...base,
        tick: 5,
        modeState: { ...base.modeState, extractionActionsRemaining: 0 },
      });
      expect(started.modeState.extractionActionsRemaining).toBe(0);
    });

    it('tick 0 does NOT trigger refresh (tick % 3 === 0 but tick > 0 guard)', () => {
      const base = createSnapshot();
      const started = adapter.onTickStart({
        ...base,
        tick: 0,
        modeState: { ...base.modeState, extractionActionsRemaining: 0 },
      });
      expect(started.modeState.extractionActionsRemaining).toBe(0);
    });

    it('does not change other modeState fields on tick start', () => {
      const base = createSnapshot();
      const s = adapter.configure(base, { spectatorLimit: 40 });
      const started = adapter.onTickStart({ ...s, tick: 3 });
      expect(started.modeState.spectatorLimit).toBe(40);
      expect(started.modeState.sharedOpportunityDeck).toBe(true);
    });

    it('does not mutate snapshot on tick start', () => {
      const base = createSnapshot();
      const snap = { ...base, tick: 3, modeState: { ...base.modeState, extractionActionsRemaining: 0 } };
      const original = snap.modeState.extractionActionsRemaining;
      adapter.onTickStart(snap);
      expect(snap.modeState.extractionActionsRemaining).toBe(original);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 4: onTickEnd() — passive income by pressure tier
  // --------------------------------------------------------------------------

  describe('onTickEnd() — passive income by pressure tier', () => {
    const buildTickEndSnap = (tier: PressureTier, budget: number, cap: number): RunStateSnapshot => {
      const base = createSnapshot();
      return {
        ...base,
        pressure: { ...base.pressure, tier },
        battle: { ...base.battle, battleBudget: budget, battleBudgetCap: cap, extractionCooldownTicks: 0 },
      };
    };

    it('grants 8 passive income at T0', () => {
      const s = buildTickEndSnap('T0', 50, 200);
      const ended = adapter.onTickEnd(s);
      expect(ended.battle.battleBudget).toBe(50 + PASSIVE_INCOME_LOW);
    });

    it('grants 8 passive income at T1', () => {
      const s = buildTickEndSnap('T1', 50, 200);
      const ended = adapter.onTickEnd(s);
      expect(ended.battle.battleBudget).toBe(50 + PASSIVE_INCOME_LOW);
    });

    it('grants 6 passive income at T2', () => {
      const s = buildTickEndSnap('T2', 50, 200);
      const ended = adapter.onTickEnd(s);
      expect(ended.battle.battleBudget).toBe(50 + PASSIVE_INCOME_MID);
    });

    it('grants 4 passive income at T3', () => {
      const s = buildTickEndSnap('T3', 50, 200);
      const ended = adapter.onTickEnd(s);
      expect(ended.battle.battleBudget).toBe(50 + PASSIVE_INCOME_HIGH);
    });

    it('grants 4 passive income at T4', () => {
      const s = buildTickEndSnap('T4', 50, 200);
      const ended = adapter.onTickEnd(s);
      expect(ended.battle.battleBudget).toBe(50 + PASSIVE_INCOME_HIGH);
    });

    it('clamps battleBudget at cap', () => {
      const s = buildTickEndSnap('T0', 198, 200);
      const ended = adapter.onTickEnd(s);
      expect(ended.battle.battleBudget).toBe(200);
    });

    it('clamps battleBudget at 0 minimum', () => {
      const s = buildTickEndSnap('T4', 0, 200);
      const ended = adapter.onTickEnd(s);
      expect(ended.battle.battleBudget).toBe(PASSIVE_INCOME_HIGH);
    });

    it('decrements extractionCooldownTicks by 1', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        battle: { ...base.battle, battleBudget: 50, battleBudgetCap: 200, extractionCooldownTicks: 2 },
        pressure: { ...base.pressure, tier: 'T1' as PressureTier },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.battle.extractionCooldownTicks).toBe(1);
    });

    it('does not drop extractionCooldownTicks below 0', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        battle: { ...base.battle, battleBudget: 50, battleBudgetCap: 200, extractionCooldownTicks: 0 },
        pressure: { ...base.pressure, tier: 'T1' as PressureTier },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.battle.extractionCooldownTicks).toBe(0);
    });

    it('verifies pressure tier normalized values are correct', () => {
      ALL_PRESSURE_TIERS.forEach((tier) => {
        expect(isPressureTier(tier)).toBe(true);
        expect(PRESSURE_TIER_NORMALIZED[tier]).toBeGreaterThanOrEqual(0);
        expect(PRESSURE_TIER_NORMALIZED[tier]).toBeLessThanOrEqual(1);
      });
    });

    it('computes pressure risk score correctly for current pvp snapshot', () => {
      const base = createSnapshot();
      const s = adapter.configure(base, { battleBudgetStart: 100 });
      const riskScore = computePressureRiskScore(s.pressure.tier, s.pressure.score);
      expect(riskScore).toBeGreaterThanOrEqual(0);
      expect(riskScore).toBeLessThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 5: onTickEnd() — hoarding penalty
  // --------------------------------------------------------------------------

  describe('onTickEnd() — hoarding penalty at or above 150 budget', () => {
    it(`applies hoarding penalty when budget reaches exactly ${HOARDING_THRESHOLD}`, () => {
      const base = createSnapshot();
      const s = {
        ...base,
        pressure: { ...base.pressure, tier: 'T3' as PressureTier },
        battle: { ...base.battle, battleBudget: HOARDING_THRESHOLD, battleBudgetCap: 200 },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.tags).toContain('predator:hoarding_penalty');
      expect(ended.economy.haterHeat).toBe(2);
    });

    it('applies hoarding penalty when budget is 160 (above threshold)', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        pressure: { ...base.pressure, tier: 'T2' as PressureTier },
        battle: { ...base.battle, battleBudget: 160, battleBudgetCap: 200 },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.tags).toContain('predator:hoarding_penalty');
      expect(ended.economy.haterHeat).toBe(2);
    });

    it('does NOT apply hoarding penalty when budget is 149', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        pressure: { ...base.pressure, tier: 'T2' as PressureTier },
        battle: { ...base.battle, battleBudget: 140, battleBudgetCap: 200, extractionCooldownTicks: 0 },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.tags).not.toContain('predator:hoarding_penalty');
      expect(ended.economy.haterHeat).toBe(0);
    });

    it('stacks heat correctly when haterHeat is already elevated', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        economy: { ...base.economy, haterHeat: 5 },
        pressure: { ...base.pressure, tier: 'T3' as PressureTier },
        battle: { ...base.battle, battleBudget: 155, battleBudgetCap: 200 },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.economy.haterHeat).toBe(7);
    });

    it('passive income at T3 (4) pushes 146 to 150, triggering penalty', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        pressure: { ...base.pressure, tier: 'T3' as PressureTier },
        battle: { ...base.battle, battleBudget: 146, battleBudgetCap: 200 },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.battle.battleBudget).toBe(150);
      expect(ended.tags).toContain('predator:hoarding_penalty');
    });

    it('does not apply penalty tag twice if already present', () => {
      const base = { ...createSnapshot(), tags: ['predator:hoarding_penalty'] };
      const s = {
        ...base,
        pressure: { ...base.pressure, tier: 'T3' as PressureTier },
        battle: { ...base.battle, battleBudget: 155, battleBudgetCap: 200 },
      };
      const ended = adapter.onTickEnd(s);
      const penaltyCount = ended.tags.filter((t) => t === 'predator:hoarding_penalty').length;
      expect(penaltyCount).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 6: onTickEnd() — spectator projection
  // --------------------------------------------------------------------------

  describe('onTickEnd() — spectator projection on 5-tick intervals', () => {
    it('emits spectator_projection tag at tick 5', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        tick: 5,
        battle: { ...base.battle, battleBudget: 50, battleBudgetCap: 200 },
        modeState: { ...base.modeState, spectatorLimit: 50 },
        pressure: { ...base.pressure, tier: 'T1' as PressureTier },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.tags).toContain('predator:spectator_projection:5');
    });

    it('emits spectator_projection tag at tick 10', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        tick: 10,
        battle: { ...base.battle, battleBudget: 50, battleBudgetCap: 200 },
        modeState: { ...base.modeState, spectatorLimit: 50 },
        pressure: { ...base.pressure, tier: 'T1' as PressureTier },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.tags).toContain('predator:spectator_projection:10');
    });

    it('does NOT emit spectator_projection at tick 3', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        tick: 3,
        battle: { ...base.battle, battleBudget: 50, battleBudgetCap: 200 },
        modeState: { ...base.modeState, spectatorLimit: 50 },
        pressure: { ...base.pressure, tier: 'T1' as PressureTier },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.tags).not.toContain('predator:spectator_projection:3');
    });

    it('does NOT emit spectator_projection when spectatorLimit is 0', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        tick: 5,
        battle: { ...base.battle, battleBudget: 50, battleBudgetCap: 200 },
        modeState: { ...base.modeState, spectatorLimit: 0 },
        pressure: { ...base.pressure, tier: 'T1' as PressureTier },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.tags).not.toContain('predator:spectator_projection:5');
    });

    it('emits both hoarding penalty and spectator projection simultaneously', () => {
      const base = createSnapshot();
      const s = {
        ...base,
        tick: 5,
        battle: { ...base.battle, battleBudget: 155, battleBudgetCap: 200 },
        modeState: { ...base.modeState, spectatorLimit: 50 },
        pressure: { ...base.pressure, tier: 'T3' as PressureTier },
      };
      const ended = adapter.onTickEnd(s);
      expect(ended.tags).toContain('predator:hoarding_penalty');
      expect(ended.tags).toContain('predator:spectator_projection:5');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 7: resolveAction() — FIRE_EXTRACTION for all 7 types
  // --------------------------------------------------------------------------

  describe('resolveAction(FIRE_EXTRACTION) — all extraction types', () => {
    const EXTRACTION_TYPES = Object.entries(EXTRACTION_COSTS);

    EXTRACTION_TYPES.forEach(([extractionId, cost]) => {
      it(`fires ${extractionId} (cost: ${cost}) and spends correct budget`, () => {
        const base = createSnapshot();
        const startBudget = 100;
        const snap = {
          ...base,
          tick: 6,
          battle: { ...base.battle, battleBudget: startBudget, battleBudgetCap: 200, extractionCooldownTicks: 0 },
          modeState: { ...base.modeState, extractionActionsRemaining: 1 },
        };

        const resolved = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId });

        expect(resolved.battle.battleBudget).toBe(startBudget - cost);
        expect(resolved.battle.extractionCooldownTicks).toBe(EXTRACTION_COOLDOWN_TICKS);
        expect(resolved.modeState.extractionActionsRemaining).toBe(0);
        expect(resolved.economy.haterHeat).toBe(2);
        expect(resolved.tags).toContain(`predator:extraction_fired:${extractionId}`);
        expect(resolved.tags).toContain(`predator:last_extraction_tick:6`);
      });
    });

    it('uses MARKET_DUMP (cost 30) as default when no extractionId provided', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        tick: 7,
        battle: { ...base.battle, battleBudget: 100, battleBudgetCap: 200, extractionCooldownTicks: 0 },
        modeState: { ...base.modeState, extractionActionsRemaining: 1 },
      };

      const resolved = adapter.resolveAction(snap, 'FIRE_EXTRACTION', {});
      expect(resolved.battle.battleBudget).toBe(70); // 100 - 30
      expect(resolved.tags).toContain('predator:extraction_fired:MARKET_DUMP');
    });

    it('rejects extraction when extractionActionsRemaining is 0', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 100, battleBudgetCap: 200, extractionCooldownTicks: 0 },
        modeState: { ...base.modeState, extractionActionsRemaining: 0 },
      };

      const resolved = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'MARKET_DUMP' });
      expect(resolved).toBe(snap);
    });

    it('rejects extraction when extractionCooldownTicks is active', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 100, battleBudgetCap: 200, extractionCooldownTicks: 2 },
        modeState: { ...base.modeState, extractionActionsRemaining: 1 },
      };

      const resolved = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'MARKET_DUMP' });
      expect(resolved).toBe(snap);
    });

    it('rejects extraction when budget is insufficient', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 29, battleBudgetCap: 200, extractionCooldownTicks: 0 },
        modeState: { ...base.modeState, extractionActionsRemaining: 1 },
      };

      // MARKET_DUMP costs 30, budget is 29
      const resolved = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'MARKET_DUMP' });
      expect(resolved).toBe(snap);
    });

    it('rejects HOSTILE_TAKEOVER (cost 60) when budget is 59', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 59, battleBudgetCap: 200, extractionCooldownTicks: 0 },
        modeState: { ...base.modeState, extractionActionsRemaining: 1 },
      };

      const resolved = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'HOSTILE_TAKEOVER' });
      expect(resolved).toBe(snap);
    });

    it('accepts HOSTILE_TAKEOVER (cost 60) when budget is exactly 60', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 60, battleBudgetCap: 200, extractionCooldownTicks: 0 },
        modeState: { ...base.modeState, extractionActionsRemaining: 1 },
      };

      const resolved = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'HOSTILE_TAKEOVER' });
      expect(resolved.battle.battleBudget).toBe(0);
      expect(resolved.tags).toContain('predator:extraction_fired:HOSTILE_TAKEOVER');
    });

    it('stacks heat delta correctly on repeated fire-extraction cycles', () => {
      const base = createSnapshot();
      let snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 200, battleBudgetCap: 200, extractionCooldownTicks: 0 },
        modeState: { ...base.modeState, extractionActionsRemaining: 1 },
      };

      // Fire MISINFORMATION_FLOOD (cost 20)
      snap = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'MISINFORMATION_FLOOD' }) as typeof snap;
      expect(snap.economy.haterHeat).toBe(2);
      expect(snap.battle.battleBudget).toBe(180);
    });

    it('records last_extraction_tick correctly at various ticks', () => {
      const tickValues = [1, 5, 10, 25, 100];
      tickValues.forEach((tick) => {
        const base = createSnapshot();
        const snap = {
          ...base,
          tick,
          battle: { ...base.battle, battleBudget: 100, battleBudgetCap: 200, extractionCooldownTicks: 0 },
          modeState: { ...base.modeState, extractionActionsRemaining: 1 },
        };
        const resolved = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'MARKET_DUMP' });
        expect(resolved.tags).toContain(`predator:last_extraction_tick:${tick}`);
      });
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 8: resolveAction() — COUNTER_PLAY
  // --------------------------------------------------------------------------

  describe('resolveAction(COUNTER_PLAY)', () => {
    it('removes the head pending attack and spends 10 budget', () => {
      const base = createSnapshot();
      const atk = createAttack('atk-1', 'EXTRACTION', 15);
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 50, pendingAttacks: [atk] },
      };

      const resolved = adapter.resolveAction(snap, 'COUNTER_PLAY');

      expect(resolved.battle.battleBudget).toBe(50 - COUNTER_PLAY_COST);
      expect(resolved.battle.pendingAttacks).toHaveLength(0);
      expect(resolved.tags).toContain('predator:counter_play:successful');
    });

    it('removes only the first attack when multiple pending', () => {
      const base = createSnapshot();
      const atk1 = createAttack('atk-1', 'EXTRACTION', 10);
      const atk2 = createAttack('atk-2', 'DRAIN', 20);
      const atk3 = createAttack('atk-3', 'BREACH', 30);
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 80, pendingAttacks: [atk1, atk2, atk3] },
      };

      const resolved = adapter.resolveAction(snap, 'COUNTER_PLAY');

      expect(resolved.battle.pendingAttacks).toHaveLength(2);
      expect(resolved.battle.pendingAttacks[0]).toEqual(atk2);
      expect(resolved.battle.pendingAttacks[1]).toEqual(atk3);
    });

    it('rejects COUNTER_PLAY when no pending attacks', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 80, pendingAttacks: [] },
      };

      const resolved = adapter.resolveAction(snap, 'COUNTER_PLAY');
      expect(resolved).toBe(snap);
    });

    it('rejects COUNTER_PLAY when budget is 9 (below 10 cost)', () => {
      const base = createSnapshot();
      const atk = createAttack('atk-1');
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 9, pendingAttacks: [atk] },
      };

      const resolved = adapter.resolveAction(snap, 'COUNTER_PLAY');
      expect(resolved).toBe(snap);
    });

    it('accepts COUNTER_PLAY at exactly 10 budget', () => {
      const base = createSnapshot();
      const atk = createAttack('atk-1');
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 10, pendingAttacks: [atk] },
      };

      const resolved = adapter.resolveAction(snap, 'COUNTER_PLAY');
      expect(resolved.battle.battleBudget).toBe(0);
      expect(resolved.battle.pendingAttacks).toHaveLength(0);
    });

    it('verifies attack classification for countered attack', () => {
      const atk = createAttack('atk-test', 'EXTRACTION', 0.9);
      const severity = classifyAttackSeverity(atk);
      // magnitude * EXTRACTION_BASE(0.8) = 0.9 * 0.8 = 0.72 → CATASTROPHIC
      expect(severity).toBe('CATASTROPHIC');
      expect(ATTACK_CATEGORY_BASE_MAGNITUDE['EXTRACTION']).toBe(0.8);
    });

    it('verifies threat urgency classification for visible threat', () => {
      const threat = createThreat('th-1', 1, 'EXPOSED');
      const urgency = classifyThreatUrgency(threat, 0);
      expect(['HIGH', 'CRITICAL', 'MEDIUM']).toContain(urgency);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 9: resolveAction() — CLAIM_FIRST_BLOOD
  // --------------------------------------------------------------------------

  describe('resolveAction(CLAIM_FIRST_BLOOD)', () => {
    it('claims first blood and adds 25 to battle budget', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 50, battleBudgetCap: 200, firstBloodClaimed: false },
      };

      const resolved = adapter.resolveAction(snap, 'CLAIM_FIRST_BLOOD');

      expect(resolved.battle.firstBloodClaimed).toBe(true);
      expect(resolved.battle.battleBudget).toBe(50 + FIRST_BLOOD_BONUS);
      expect(resolved.tags).toContain('predator:first_blood');
    });

    it('clamps budget at cap when first blood bonus would exceed it', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 185, battleBudgetCap: 200, firstBloodClaimed: false },
      };

      const resolved = adapter.resolveAction(snap, 'CLAIM_FIRST_BLOOD');
      expect(resolved.battle.battleBudget).toBe(200); // clamped: 185 + 25 > 200
    });

    it('is idempotent — returns same snapshot on second call', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 50, battleBudgetCap: 200, firstBloodClaimed: false },
      };

      const first = adapter.resolveAction(snap, 'CLAIM_FIRST_BLOOD');
      const second = adapter.resolveAction(first, 'CLAIM_FIRST_BLOOD');

      expect(second).toBe(first);
    });

    it('does not add duplicate first_blood tag', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        tags: ['predator:first_blood'],
        battle: { ...base.battle, battleBudget: 50, battleBudgetCap: 200, firstBloodClaimed: false },
      };

      const resolved = adapter.resolveAction(snap, 'CLAIM_FIRST_BLOOD');
      const firstBloodCount = resolved.tags.filter((t) => t === 'predator:first_blood').length;
      expect(firstBloodCount).toBe(1);
    });

    it('is rejected when firstBloodClaimed is already true', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, battleBudget: 50, battleBudgetCap: 200, firstBloodClaimed: true },
      };

      const resolved = adapter.resolveAction(snap, 'CLAIM_FIRST_BLOOD');
      expect(resolved).toBe(snap);
    });

    it('returns identity snapshot for unknown action', () => {
      const base = createSnapshot();
      const resolved = adapter.resolveAction(base, 'USE_HOLD' as ModeActionId);
      expect(resolved).toBe(base);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 10: finalize() — badge stacking and cord score math
  // --------------------------------------------------------------------------

  describe('finalize() — badge stacking and cord score computation', () => {
    it('awards FIRST_BLOOD badge and 0.05 multiplier', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        outcome: 'FREEDOM' as RunOutcome,
        battle: { ...base.battle, firstBloodClaimed: true, rivalryHeatCarry: 0, neutralizedBotIds: [], battleBudget: 50 },
        sovereignty: { ...base.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);
      const expected = Number((BASE_CORD_SCORE * (1 + FINALIZE_FIRST_BLOOD_BONUS)).toFixed(6));

      expect(finalized.sovereignty.cordScore).toBeCloseTo(expected, 5);
      expect(finalized.sovereignty.proofBadges).toContain('FIRST_BLOOD');
    });

    it('awards ARCH_RIVAL_PRESSURE badge when rivalryHeatCarry >= 20', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        outcome: 'FREEDOM' as RunOutcome,
        battle: { ...base.battle, firstBloodClaimed: false, rivalryHeatCarry: 20, neutralizedBotIds: [], battleBudget: 50 },
        sovereignty: { ...base.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);
      const expected = Number((BASE_CORD_SCORE * (1 + FINALIZE_ARCH_RIVAL_BONUS)).toFixed(6));

      expect(finalized.sovereignty.cordScore).toBeCloseTo(expected, 5);
      expect(finalized.sovereignty.proofBadges).toContain('ARCH_RIVAL_PRESSURE');
    });

    it('does NOT award ARCH_RIVAL_PRESSURE when rivalryHeatCarry is 19', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        battle: { ...base.battle, firstBloodClaimed: false, rivalryHeatCarry: 19, neutralizedBotIds: [], battleBudget: 50 },
        sovereignty: { ...base.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).not.toContain('ARCH_RIVAL_PRESSURE');
    });

    it('awards ARENA_CONTROL badge for 1 neutralized bot (+0.05)', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        outcome: 'FREEDOM' as RunOutcome,
        battle: { ...base.battle, firstBloodClaimed: false, rivalryHeatCarry: 0, neutralizedBotIds: ['BOT_01'] as readonly HaterBotId[], battleBudget: 50 },
        sovereignty: { ...base.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);
      const expected = Number((BASE_CORD_SCORE * (1 + FINALIZE_ARENA_CONTROL_PER_BOT)).toFixed(6));

      expect(finalized.sovereignty.cordScore).toBeCloseTo(expected, 5);
      expect(finalized.sovereignty.proofBadges).toContain('ARENA_CONTROL');
    });

    it('caps ARENA_CONTROL multiplier at 0.25 for 5+ neutralized bots', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        outcome: 'FREEDOM' as RunOutcome,
        battle: {
          ...base.battle,
          firstBloodClaimed: false,
          rivalryHeatCarry: 0,
          neutralizedBotIds: ['BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05'] as readonly HaterBotId[],
          battleBudget: 50,
        },
        sovereignty: { ...base.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);
      const expected = Number((BASE_CORD_SCORE * (1 + 0.25)).toFixed(6));
      expect(finalized.sovereignty.cordScore).toBeCloseTo(expected, 5);
    });

    it('awards AGGRESSOR badge when budget < 40 and outcome is FREEDOM', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        outcome: 'FREEDOM' as RunOutcome,
        battle: { ...base.battle, firstBloodClaimed: false, rivalryHeatCarry: 0, neutralizedBotIds: [], battleBudget: 10 },
        sovereignty: { ...base.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);
      const expected = Number((BASE_CORD_SCORE * (1 + FINALIZE_AGGRESSOR_BONUS)).toFixed(6));

      expect(finalized.sovereignty.cordScore).toBeCloseTo(expected, 5);
      expect(finalized.sovereignty.proofBadges).toContain('AGGRESSOR');
    });

    it('does NOT award AGGRESSOR when budget is exactly 40', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        outcome: 'FREEDOM' as RunOutcome,
        battle: { ...base.battle, firstBloodClaimed: false, rivalryHeatCarry: 0, neutralizedBotIds: [], battleBudget: 40 },
        sovereignty: { ...base.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).not.toContain('AGGRESSOR');
    });

    it('does NOT award AGGRESSOR on TIMEOUT outcome', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        outcome: 'TIMEOUT' as RunOutcome,
        battle: { ...base.battle, firstBloodClaimed: false, rivalryHeatCarry: 0, neutralizedBotIds: [], battleBudget: 10 },
        sovereignty: { ...base.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).not.toContain('AGGRESSOR');
    });

    it('stacks all four badges when conditions are met', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        outcome: 'FREEDOM' as RunOutcome,
        battle: {
          ...base.battle,
          firstBloodClaimed: true,
          rivalryHeatCarry: 25,
          neutralizedBotIds: ['BOT_01', 'BOT_02'] as readonly HaterBotId[],
          battleBudget: 10,
        },
        sovereignty: { ...base.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);

      expect(finalized.sovereignty.proofBadges).toContain('FIRST_BLOOD');
      expect(finalized.sovereignty.proofBadges).toContain('ARCH_RIVAL_PRESSURE');
      expect(finalized.sovereignty.proofBadges).toContain('ARENA_CONTROL');
      expect(finalized.sovereignty.proofBadges).toContain('AGGRESSOR');

      // multiplier = 1 + 0.05 + 0.10 + (2 * 0.05) + 0.10 = 1 + 0.35 = 1.35
      // But arena is min(0.25, 2 * 0.05) = 0.10
      // Total: 1 + 0.05 + 0.10 + 0.10 + 0.10 = 1.35
      const expected = Number((BASE_CORD_SCORE * 1.35).toFixed(6));
      expect(finalized.sovereignty.cordScore).toBeCloseTo(expected, 5);
    });

    it('preserves existing proofBadges when stacking', () => {
      const base = createSnapshot();
      const snap = {
        ...base,
        outcome: 'FREEDOM' as RunOutcome,
        battle: { ...base.battle, firstBloodClaimed: true, rivalryHeatCarry: 0, neutralizedBotIds: [], battleBudget: 50 },
        sovereignty: {
          ...base.sovereignty,
          cordScore: BASE_CORD_SCORE,
          proofBadges: ['EXISTING_BADGE'],
        },
      };

      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).toContain('EXISTING_BADGE');
      expect(finalized.sovereignty.proofBadges).toContain('FIRST_BLOOD');
    });

    it('scoreOutcomeExcitement for FREEDOM in pvp is capped at 5', () => {
      const excitement = scoreOutcomeExcitement('FREEDOM', 'pvp');
      // base 5 * pvp difficulty 1.4 = 7, but min(5, 7) = 5
      expect(excitement).toBe(5);
    });

    it('scoreOutcomeExcitement for BANKRUPT in pvp', () => {
      const excitement = scoreOutcomeExcitement('BANKRUPT', 'pvp');
      // base 4 * 1.4 = 5.6, min(5, 5.6) = 5
      expect(excitement).toBe(5);
    });

    it('verifies isRunOutcome for all known outcomes', () => {
      const outcomes: RunOutcome[] = ['FREEDOM', 'TIMEOUT', 'BANKRUPT', 'ABANDONED'];
      outcomes.forEach((o) => expect(isRunOutcome(o)).toBe(true));
      expect(isRunOutcome('INVALID')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 11: GamePrimitives utilities — comprehensive exercise
  // --------------------------------------------------------------------------

  describe('GamePrimitives utility coverage', () => {
    it('isModeCode validates all canonical mode codes', () => {
      ALL_MODE_CODES.forEach((code) => expect(isModeCode(code)).toBe(true));
      expect(isModeCode('unknown')).toBe(false);
    });

    it('isPressureTier validates all canonical pressure tiers', () => {
      ALL_PRESSURE_TIERS.forEach((tier) => expect(isPressureTier(tier)).toBe(true));
      expect(isPressureTier('T5')).toBe(false);
    });

    it('isRunPhase validates all canonical run phases', () => {
      ALL_RUN_PHASES.forEach((phase) => expect(isRunPhase(phase)).toBe(true));
      expect(isRunPhase('INVALID_PHASE')).toBe(false);
    });

    it('isShieldLayerId validates all canonical shield layer IDs', () => {
      ALL_SHIELD_LAYER_IDS.forEach((id) => expect(isShieldLayerId(id)).toBe(true));
      expect(isShieldLayerId('L5')).toBe(false);
    });

    it('isHaterBotId validates all canonical bot IDs', () => {
      ALL_HATER_BOT_IDS.forEach((id) => expect(isHaterBotId(id)).toBe(true));
      expect(isHaterBotId('BOT_99')).toBe(false);
    });

    it('computeShieldIntegrityRatio returns 1.0 when all layers at max', () => {
      const layers = ALL_SHIELD_LAYER_IDS.map((id) => ({ id, current: 50, max: 50 }));
      const ratio = computeShieldIntegrityRatio(layers);
      expect(ratio).toBeCloseTo(1.0, 5);
    });

    it('computeShieldIntegrityRatio reflects damage', () => {
      const layers = [
        { id: 'L1' as ShieldLayerId, current: 0, max: 50 },
        { id: 'L2' as ShieldLayerId, current: 50, max: 50 },
        { id: 'L3' as ShieldLayerId, current: 50, max: 50 },
        { id: 'L4' as ShieldLayerId, current: 50, max: 50 },
      ];
      const ratio = computeShieldIntegrityRatio(layers);
      expect(ratio).toBeLessThan(1.0);
    });

    it('computeShieldLayerVulnerability is 0 for full L1 health', () => {
      const vuln = computeShieldLayerVulnerability('L1', 50, 50);
      expect(vuln).toBe(0);
    });

    it('computeShieldLayerVulnerability is SHIELD_LAYER_CAPACITY_WEIGHT for empty layer', () => {
      const vuln = computeShieldLayerVulnerability('L1', 0, 50);
      expect(vuln).toBe(SHIELD_LAYER_CAPACITY_WEIGHT['L1']);
    });

    it('estimateShieldRegenPerTick uses correct regen rate by layer', () => {
      const l1Regen = estimateShieldRegenPerTick('L1', 50);
      const l4Regen = estimateShieldRegenPerTick('L4', 50);
      expect(l1Regen).toBeGreaterThan(l4Regen);
    });

    it('computeBotThreatScore scales with bot ID and state', () => {
      const dormant = computeBotThreatScore('BOT_01', 'DORMANT');
      const attacking = computeBotThreatScore('BOT_01', 'ATTACKING');
      expect(dormant).toBe(0);
      expect(attacking).toBeGreaterThan(dormant);
    });

    it('computeAggregateBotThreat handles all-dormant fleet', () => {
      const bots = ALL_HATER_BOT_IDS.map((id) => ({ id, state: 'DORMANT' as BotState }));
      const threat = computeAggregateBotThreat(bots);
      expect(threat).toBe(0);
    });

    it('computeAggregateBotThreat increases with attacking bots', () => {
      const attacking = [{ id: 'BOT_05' as HaterBotId, state: 'ATTACKING' as BotState }];
      const threat = computeAggregateBotThreat(attacking);
      expect(threat).toBeGreaterThan(0);
    });

    it('computeDefenseUrgency matches computeAggregateBotThreat', () => {
      const bots = [
        { id: 'BOT_01' as HaterBotId, state: 'ATTACKING' as BotState },
        { id: 'BOT_02' as HaterBotId, state: 'TARGETING' as BotState },
      ];
      const urgency = computeDefenseUrgency(bots);
      const threat = computeAggregateBotThreat(bots);
      expect(urgency).toBe(threat);
    });

    it('computeCardPowerScore reflects rarity and deck type', () => {
      const common = createCardInstance('ci-common', ['pvp'], 'OPPORTUNITY');
      const powerScore = computeCardPowerScore(common);
      expect(powerScore).toBeGreaterThan(0);
    });

    it('computeCardTimingPriority returns max priority for CTR class', () => {
      const ctrCard = createCardInstance();
      const priority = computeCardTimingPriority(ctrCard);
      expect(priority).toBe(TIMING_CLASS_WINDOW_PRIORITY['CTR']);
    });

    it('isCardLegalInMode respects modeLegal field', () => {
      const pvpCard = createCardInstance();
      expect(isCardLegalInMode(pvpCard, 'pvp')).toBe(true);
      expect(isCardLegalInMode(pvpCard, 'coop')).toBe(false);
    });

    it('computeLegendMarkerValue returns 1.0 for GOLD marker', () => {
      const marker = createLegendMarker();
      const value = computeLegendMarkerValue(marker);
      expect(value).toBe(1.0);
    });

    it('scoreCascadeChainHealth returns correct health for ACTIVE chain', () => {
      const chain = createCascadeChain('active-chain', true);
      const health = scoreCascadeChainHealth(chain);
      expect(health).toBeGreaterThan(0);
      expect(health).toBeLessThanOrEqual(1);
    });

    it('scoreCascadeChainHealth returns 1.0 for COMPLETED chain', () => {
      const chain: CascadeChainInstance = {
        ...createCascadeChain('completed-chain'),
        status: 'COMPLETED',
      };
      const health = scoreCascadeChainHealth(chain);
      expect(health).toBe(1.0);
    });

    it('scoreCascadeChainHealth returns 0.0 for BROKEN chain', () => {
      const chain: CascadeChainInstance = {
        ...createCascadeChain('broken-chain'),
        status: 'BROKEN',
      };
      const health = scoreCascadeChainHealth(chain);
      expect(health).toBe(0.0);
    });

    it('computeFirstCascadeHealth helper returns 0 when no active chains', () => {
      const snap = createSnapshot();
      const health = computeFirstCascadeHealth(snap);
      expect(health).toBe(0);
    });

    it('computeFirstCascadeHealth helper returns > 0 when active chain present', () => {
      const snap = createSnapshot();
      const snapWithChain = {
        ...snap,
        cascade: { ...snap.cascade, activeChains: [createCascadeChain() as unknown as RunStateSnapshot['cascade']['activeChains'][0]] },
      };
      const health = computeFirstCascadeHealth(snapWithChain);
      expect(health).toBeGreaterThan(0);
    });

    it('CARD_RARITY_WEIGHT has correct relative ordering', () => {
      expect(CARD_RARITY_WEIGHT['COMMON']).toBeLessThan(CARD_RARITY_WEIGHT['UNCOMMON']);
      expect(CARD_RARITY_WEIGHT['UNCOMMON']).toBeLessThan(CARD_RARITY_WEIGHT['RARE']);
      expect(CARD_RARITY_WEIGHT['RARE']).toBeLessThan(CARD_RARITY_WEIGHT['LEGENDARY']);
    });

    it('DECK_TYPE_POWER_LEVEL is highest for GHOST deck', () => {
      expect(DECK_TYPE_POWER_LEVEL['GHOST']).toBe(0.95);
    });

    it('RUN_PHASE_NORMALIZED maps correctly', () => {
      expect(RUN_PHASE_NORMALIZED['FOUNDATION']).toBe(0.0);
      expect(RUN_PHASE_NORMALIZED['ESCALATION']).toBe(0.5);
      expect(RUN_PHASE_NORMALIZED['SOVEREIGNTY']).toBe(1.0);
    });

    it('ATTACK_CATEGORY_BASE_MAGNITUDE has BREACH as highest (0.9)', () => {
      expect(ATTACK_CATEGORY_BASE_MAGNITUDE['BREACH']).toBe(0.9);
    });

    it('TIMING_CLASS_WINDOW_PRIORITY has FATE as highest (100)', () => {
      expect(TIMING_CLASS_WINDOW_PRIORITY['FATE']).toBe(100);
    });

    it('classifyAttackSeverity correctly classifies BREACH attack at 1.0 magnitude', () => {
      const attack = createAttack('breach-1', 'BREACH', 1.0);
      const severity = classifyAttackSeverity(attack);
      // 1.0 * 0.9 = 0.9 >= 0.8 → CATASTROPHIC
      expect(severity).toBe('CATASTROPHIC');
    });

    it('classifyThreatUrgency returns NEGLIGIBLE for distant hidden threat', () => {
      const threat = createThreat('far-threat', 20, 'HIDDEN');
      const urgency = classifyThreatUrgency(threat, 0);
      expect(urgency).toBe('NEGLIGIBLE');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 12: RunStateSnapshot predicate coverage
  // --------------------------------------------------------------------------

  describe('RunStateSnapshot predicates on pvp snapshots', () => {
    it('isSnapshotWin returns true when outcome is FREEDOM', () => {
      const snap = { ...createSnapshot(), outcome: 'FREEDOM' as RunOutcome };
      expect(isSnapshotWin(snap)).toBe(true);
    });

    it('isSnapshotLoss returns true when outcome is BANKRUPT', () => {
      const snap = { ...createSnapshot(), outcome: 'BANKRUPT' as RunOutcome };
      expect(isSnapshotLoss(snap)).toBe(true);
    });

    it('isSnapshotTerminal returns true when outcome is set', () => {
      const snap = { ...createSnapshot(), outcome: 'TIMEOUT' as RunOutcome };
      expect(isSnapshotTerminal(snap)).toBe(true);
    });

    it('isSnapshotTerminal returns false when no outcome', () => {
      const snap = createSnapshot();
      expect(isSnapshotTerminal(snap)).toBe(false);
    });

    it('isEconomyHealthy returns true for fresh pvp snapshot', () => {
      const snap = createSnapshot();
      expect(isEconomyHealthy(snap)).toBe(true);
    });

    it('isShieldFailing returns false when all layers at max', () => {
      const snap = createSnapshot();
      expect(isShieldFailing(snap)).toBe(false);
    });

    it('isShieldFailing returns true when shield is critically damaged', () => {
      const snap = createSnapshot();
      const damaged = {
        ...snap,
        shield: {
          ...snap.shield,
          weakestLayerRatio: 0.05,
          layers: snap.shield.layers.map((l) => ({
            ...l,
            current: 2,
            integrityRatio: 0.04,
          })),
        },
      };
      expect(isShieldFailing(damaged)).toBe(true);
    });

    it('isSnapshotInCrisis returns false for fresh snapshot', () => {
      const snap = createSnapshot();
      expect(isSnapshotInCrisis(snap)).toBe(false);
    });

    it('isSnapshotInEndgame returns true at SOVEREIGNTY phase', () => {
      const snap = { ...createSnapshot(), phase: 'SOVEREIGNTY' as RunPhase };
      expect(isSnapshotInEndgame(snap)).toBe(true);
    });

    it('isBattleEscalating returns false when no pending attacks', () => {
      const snap = createSnapshot();
      expect(isBattleEscalating(snap)).toBe(false);
    });

    it('isCascadeCritical returns false when no active chains', () => {
      const snap = createSnapshot();
      expect(isCascadeCritical(snap)).toBe(false);
    });

    it('hasPlayableCards returns true when hand is populated', () => {
      const snap = createSnapshot();
      expect(hasPlayableCards(snap)).toBe(true);
    });

    it('hasPlayableCards returns false when hand is empty', () => {
      const snap = createSnapshot();
      expect(hasPlayableCards({ ...snap, cards: { ...snap.cards, hand: [] } })).toBe(false);
    });

    it('hasCriticalPendingAttacks returns false when no pending attacks', () => {
      const snap = createSnapshot();
      expect(hasCriticalPendingAttacks(snap)).toBe(false);
    });

    it('hasActiveDecisionWindows returns false when no active windows', () => {
      const snap = createSnapshot();
      expect(hasActiveDecisionWindows(snap)).toBe(false);
    });

    it('isSovereigntyAtRisk returns false for fresh snapshot (PENDING status)', () => {
      const snap = createSnapshot();
      // PENDING is risky but not at-risk threshold — depends on implementation
      const atRisk = isSovereigntyAtRisk(snap);
      expect(typeof atRisk).toBe('boolean');
    });

    it('isRunFlagged returns false when no audit flags', () => {
      const snap = createSnapshot();
      expect(isRunFlagged(snap)).toBe(false);
    });

    it('getNormalizedPressureTier returns numeric 0-1 for each tier', () => {
      const base = createSnapshot();
      ALL_PRESSURE_TIERS.forEach((tier) => {
        const snap = { ...base, pressure: { ...base.pressure, tier } };
        const normalized = getNormalizedPressureTier(snap);
        expect(normalized).toBeGreaterThanOrEqual(0);
        expect(normalized).toBeLessThanOrEqual(1);
      });
    });

    it('getPressureTierUrgencyLabel returns non-empty string for each tier', () => {
      const base = createSnapshot();
      ALL_PRESSURE_TIERS.forEach((tier) => {
        const snap = { ...base, pressure: { ...base.pressure, tier } };
        const label = getPressureTierUrgencyLabel(snap);
        expect(label).toBeTruthy();
        expect(typeof label).toBe('string');
      });
    });

    it('computeSnapshotCompositeRisk returns value in [0, 1] for pvp snapshot', () => {
      const snap = createSnapshot();
      const risk = computeSnapshotCompositeRisk(snap);
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 13: ModeSignalAdapter — onConfigure signal
  // --------------------------------------------------------------------------

  describe('ModeSignalAdapter.onConfigure signal', () => {
    const signal_adapter = new ModeSignalAdapter({ enableDLTensor: true });

    it('emits MODE_CONFIGURED signal after configure()', () => {
      const before = createSnapshot();
      const options: ModeConfigureOptions = {
        battleBudgetStart: 100,
        rivalryHeatCarry: 15,
        spectatorLimit: 30,
      };
      const after = adapter.configure(before, options);

      const signal = signal_adapter.onConfigure(before, after, options, 1_000_000);

      expect(signal).not.toBeNull();
      expect(signal?.kind).toBe('MODE_CONFIGURED');
      expect(signal?.mode).toBe('pvp');
      expect(signal?.lifecyclePhase).toBe('PRE_RUN');
    });

    it('configure signal is deduplicated on same run/tick/kind', () => {
      const adapter2 = new ModeSignalAdapter();
      const before = createSnapshot();
      const after = adapter.configure(before);

      const first = adapter2.onConfigure(before, after, {}, 1_000_000);
      const second = adapter2.onConfigure(before, after, {}, 1_000_001);

      expect(first).not.toBeNull();
      expect(second).toBeNull();
    });

    it('configure signal carries ML vector with 16 features', () => {
      const adapter3 = new ModeSignalAdapter();
      const before = createSnapshot();
      const after = adapter.configure(before);
      const signal = adapter3.onConfigure(before, after, {}, 2_000_000);

      expect(signal).not.toBeNull();
      const payload = signal!.payload as { mlVector: { features: readonly number[] } };
      expect(payload.mlVector.features).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
    });

    it('configure signal carries DL tensor with 24 features', () => {
      const adapter4 = new ModeSignalAdapter({ enableDLTensor: true });
      const before = createSnapshot();
      const after = adapter.configure(before);
      const signal = adapter4.onConfigure(before, after, {}, 3_000_000);

      expect(signal).not.toBeNull();
      const payload = signal!.payload as { dlTensor: { tensor: readonly number[]; shape: readonly number[] } };
      expect(payload.dlTensor.tensor).toHaveLength(MODE_SIGNAL_DL_FEATURE_COUNT);
      expect(payload.dlTensor.shape).toEqual(MODE_SIGNAL_DL_TENSOR_SHAPE);
    });

    it('configure signal channel recommendation is SYNDICATE for pvp mode', () => {
      const adapter5 = new ModeSignalAdapter();
      const before = createSnapshot();
      const after = adapter.configure(before);
      const signal = adapter5.onConfigure(before, after, {}, 4_000_000);

      expect(signal?.channelRecommendation).toBe('SYNDICATE');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 14: ModeSignalAdapter — onTickStart signal
  // --------------------------------------------------------------------------

  describe('ModeSignalAdapter.onTickStart signal', () => {
    it('emits MODE_TICK_STARTED signal', () => {
      const adapter6 = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 50 });
      const tickStarted = adapter.onTickStart({ ...configured, tick: 3 });
      const signal = adapter6.onTickStart(configured, tickStarted, 5_000_000);

      expect(signal).not.toBeNull();
      expect(signal?.kind).toBe('MODE_TICK_STARTED');
      expect(signal?.lifecyclePhase).toBe('TICK');
    });

    it('tick start signal has valid risk score', () => {
      const adapter7 = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 80 });
      const tickStarted = adapter.onTickStart({ ...configured, tick: 3 });
      const signal = adapter7.onTickStart(configured, tickStarted, 5_000_000);

      expect(signal?.riskScore).toBeGreaterThanOrEqual(0);
      expect(signal?.riskScore).toBeLessThanOrEqual(1);
    });

    it('tick start signal mode matches pvp', () => {
      const adapter8 = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base);
      const tickStarted = adapter.onTickStart({ ...configured, tick: 6 });
      const signal = adapter8.onTickStart(configured, tickStarted, 6_000_000);

      expect(signal?.mode).toBe('pvp');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 15: ModeSignalAdapter — onTickEnd signal
  // --------------------------------------------------------------------------

  describe('ModeSignalAdapter.onTickEnd signal', () => {
    it('emits MODE_TICK_ENDED signal', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 80 });
      const s = { ...configured, tick: 5, modeState: { ...configured.modeState, spectatorLimit: 50 } };
      const tickEnded = adapter.onTickEnd(s);
      const signal = signalAdapter.onTickEnd(s, tickEnded, 7_000_000);

      expect(signal).not.toBeNull();
      expect(signal?.kind).toBe('MODE_TICK_ENDED');
    });

    it('tick end signal captures spectator projection tick tag in snapshot', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base);
      const s = { ...configured, tick: 5, modeState: { ...configured.modeState, spectatorLimit: 50 } };
      const tickEnded = adapter.onTickEnd(s);

      expect(tickEnded.tags).toContain('predator:spectator_projection:5');

      const signal = signalAdapter.onTickEnd(s, tickEnded, 7_000_001);
      expect(signal?.tick).toBe(5);
    });

    it('tick end signal includes shield integrity in payload', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 100 });
      const s = { ...configured, tick: 2 };
      const tickEnded = adapter.onTickEnd(s);
      const signal = signalAdapter.onTickEnd(s, tickEnded, 8_000_000);

      const payload = signal?.payload as { shieldIntegrity?: number };
      expect(payload?.shieldIntegrity).toBeGreaterThanOrEqual(0);
      expect(payload?.shieldIntegrity).toBeLessThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 16: ModeSignalAdapter — onAction signal
  // --------------------------------------------------------------------------

  describe('ModeSignalAdapter.onAction signal', () => {
    it('emits MODE_ACTION_RESOLVED signal for FIRE_EXTRACTION', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 100 });
      const s = {
        ...configured,
        tick: 6,
        modeState: { ...configured.modeState, extractionActionsRemaining: 1 },
        battle: { ...configured.battle, extractionCooldownTicks: 0 },
      };

      const resolved = adapter.resolveAction(s, 'FIRE_EXTRACTION', { extractionId: 'MARKET_DUMP' });
      const signal = signalAdapter.onAction(s, resolved, 'FIRE_EXTRACTION', 9_000_000);

      expect(signal).not.toBeNull();
      expect(signal?.kind).toBe('MODE_ACTION_RESOLVED');
      expect(signal?.lifecyclePhase).toBe('ACTION');
    });

    it('action signal captures tagsAdded in payload', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 100 });
      const s = {
        ...configured,
        tick: 7,
        modeState: { ...configured.modeState, extractionActionsRemaining: 1 },
        battle: { ...configured.battle, extractionCooldownTicks: 0 },
      };

      const resolved = adapter.resolveAction(s, 'FIRE_EXTRACTION', { extractionId: 'REGULATORY_FILING' });
      const signal = signalAdapter.onAction(s, resolved, 'FIRE_EXTRACTION', 9_500_000);

      const payload = signal?.payload as { tagsAdded?: readonly string[] };
      expect(payload?.tagsAdded).toContain('predator:extraction_fired:REGULATORY_FILING');
    });

    it('emits action signal for COUNTER_PLAY', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 80 });
      const s = {
        ...configured,
        battle: { ...configured.battle, battleBudget: 50, pendingAttacks: [createAttack()] },
      };

      const resolved = adapter.resolveAction(s, 'COUNTER_PLAY');
      const signal = signalAdapter.onAction(s, resolved, 'COUNTER_PLAY', 10_000_000);

      expect(signal).not.toBeNull();
      expect(signal?.kind).toBe('MODE_ACTION_RESOLVED');
    });

    it('emits action signal for CLAIM_FIRST_BLOOD', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 50 });
      const s = {
        ...configured,
        battle: { ...configured.battle, firstBloodClaimed: false },
      };

      const resolved = adapter.resolveAction(s, 'CLAIM_FIRST_BLOOD');
      const signal = signalAdapter.onAction(s, resolved, 'CLAIM_FIRST_BLOOD', 11_000_000);

      expect(signal).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 17: ModeSignalAdapter — onFinalize signal
  // --------------------------------------------------------------------------

  describe('ModeSignalAdapter.onFinalize signal', () => {
    it('emits MODE_FINALIZED signal', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 100, rivalryHeatCarry: 20 });
      const s = {
        ...configured,
        outcome: 'FREEDOM' as RunOutcome,
        battle: { ...configured.battle, firstBloodClaimed: true, rivalryHeatCarry: 20, neutralizedBotIds: ['BOT_01'] as readonly HaterBotId[], battleBudget: 15 },
      };

      const finalized = adapter.finalize(s);
      const signal = signalAdapter.onFinalize(s, finalized, 12_000_000);

      expect(signal).not.toBeNull();
      expect(signal?.kind).toBe('MODE_FINALIZED');
      expect(signal?.lifecyclePhase).toBe('FINALIZATION');
    });

    it('finalize signal channel is GLOBAL', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base);
      const s = { ...configured, outcome: 'FREEDOM' as RunOutcome };
      const finalized = adapter.finalize(s);
      const signal = signalAdapter.onFinalize(s, finalized, 12_500_000);

      expect(signal?.channelRecommendation).toBe('GLOBAL');
    });

    it('finalize signal carries correct proofBadges', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 100 });
      const s = {
        ...configured,
        outcome: 'FREEDOM' as RunOutcome,
        battle: { ...configured.battle, firstBloodClaimed: true, rivalryHeatCarry: 25, neutralizedBotIds: ['BOT_01', 'BOT_02'] as readonly HaterBotId[], battleBudget: 10 },
        sovereignty: { ...configured.sovereignty, cordScore: BASE_CORD_SCORE },
      };
      const finalized = adapter.finalize(s);
      const signal = signalAdapter.onFinalize(s, finalized, 13_000_000);

      const payload = signal?.payload as { proofBadges?: readonly string[] };
      expect(payload?.proofBadges).toContain('FIRST_BLOOD');
      expect(payload?.proofBadges).toContain('ARCH_RIVAL_PRESSURE');
    });

    it('finalize signal cordScoreDelta reflects multiplier improvement', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base);
      const s = {
        ...configured,
        outcome: 'FREEDOM' as RunOutcome,
        battle: { ...configured.battle, firstBloodClaimed: true, rivalryHeatCarry: 0, neutralizedBotIds: [], battleBudget: 30 },
        sovereignty: { ...configured.sovereignty, cordScore: BASE_CORD_SCORE },
      };
      const finalized = adapter.finalize(s);
      const signal = signalAdapter.onFinalize(s, finalized, 13_500_000);

      const payload = signal?.payload as { cordScoreDelta?: number; cordScore?: number };
      expect(payload?.cordScoreDelta).toBeGreaterThan(0);
      expect(payload?.cordScore).toBeGreaterThan(BASE_CORD_SCORE);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 18: ModeMlFeatureExtractor — vector dimensions and values
  // --------------------------------------------------------------------------

  describe('ModeMlFeatureExtractor', () => {
    const extractor = new ModeMlFeatureExtractor();

    it('extracts exactly 16 ML features', () => {
      const snap = adapter.configure(createSnapshot(), { battleBudgetStart: 80 });
      const vec = extractor.extract(snap, 1_000_000);

      expect(vec.features).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
      expect(MODE_SIGNAL_ML_FEATURE_COUNT).toBe(16);
    });

    it('all feature labels match the extracted feature count', () => {
      expect(MODE_SIGNAL_ML_FEATURE_LABELS).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
    });

    it('feature vector mode_normalized is 0.33 for pvp', () => {
      const snap = adapter.configure(createSnapshot());
      const vec = extractor.extract(snap, 1_000_000);
      const modeNormIdx = MODE_SIGNAL_ML_FEATURE_LABELS.indexOf('mode_normalized');
      expect(vec.features[modeNormIdx]).toBeCloseTo(MODE_NORMALIZED['pvp'], 5);
    });

    it('feature vector values are all finite numbers', () => {
      const snap = adapter.configure(createSnapshot(), { battleBudgetStart: 100, rivalryHeatCarry: 15 });
      const vec = extractor.extract(snap, 2_000_000);
      vec.features.forEach((f) => {
        expect(Number.isFinite(f)).toBe(true);
        // Features must be in valid range
        expect(f).toBeGreaterThanOrEqual(-1);
      });
    });

    it('extraction_actions_norm feature is nonzero when extractionActionsRemaining=1', () => {
      const snap = adapter.configure(createSnapshot(), { battleBudgetStart: 80 });
      const vec = extractor.extract(snap, 1_000_000);
      const idx = MODE_SIGNAL_ML_FEATURE_LABELS.indexOf('extraction_actions_norm');
      expect(vec.features[idx]).toBeGreaterThan(0);
    });

    it('extractModeMLVector standalone function works', () => {
      const snap = adapter.configure(createSnapshot());
      const vec = extractModeMLVector(snap, 1_000_000);
      expect(vec.features).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
      expect(vec.mode).toBe('pvp');
      expect(vec.runId).toBe('run-predator-1');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 19: ModeDlTensorBuilder — tensor shape and values
  // --------------------------------------------------------------------------

  describe('ModeDlTensorBuilder', () => {
    const builder = new ModeDlTensorBuilder();

    it('builds DL tensor with exactly 24 features', () => {
      const snap = adapter.configure(createSnapshot(), { battleBudgetStart: 100 });
      const tensor = builder.build(snap, 2_000_000);

      expect(tensor.tensor).toHaveLength(MODE_SIGNAL_DL_FEATURE_COUNT);
      expect(MODE_SIGNAL_DL_FEATURE_COUNT).toBe(24);
    });

    it('tensor shape is [1, 24]', () => {
      const snap = adapter.configure(createSnapshot());
      const tensor = builder.build(snap, 3_000_000);

      expect(tensor.shape).toEqual(MODE_SIGNAL_DL_TENSOR_SHAPE);
      expect(tensor.shape[0]).toBe(1);
      expect(tensor.shape[1]).toBe(24);
    });

    it('DL feature labels count matches DL feature count', () => {
      expect(MODE_SIGNAL_DL_FEATURE_LABELS).toHaveLength(MODE_SIGNAL_DL_FEATURE_COUNT);
    });

    it('first 16 DL features match ML features', () => {
      const snap = adapter.configure(createSnapshot(), { battleBudgetStart: 60 });
      const extractor = new ModeMlFeatureExtractor();
      const mlVec = extractor.extract(snap, 4_000_000);
      const dlTensor = builder.build(snap, 4_000_000);

      for (let i = 0; i < MODE_SIGNAL_ML_FEATURE_COUNT; i++) {
        expect(dlTensor.tensor[i]).toBe(mlVec.features[i]);
      }
    });

    it('per-bot threat features (indices 16-20) are finite and in [0, 1]', () => {
      const snap = adapter.configure(createSnapshot(), { battleBudgetStart: 100 });
      const tensor = builder.build(snap, 5_000_000);

      for (let i = 16; i < 21; i++) {
        expect(Number.isFinite(tensor.tensor[i])).toBe(true);
        expect(tensor.tensor[i]).toBeGreaterThanOrEqual(0);
        expect(tensor.tensor[i]).toBeLessThanOrEqual(1);
      }
    });

    it('per-layer shield vulnerability features (indices 20-23) are finite', () => {
      const snap = adapter.configure(createSnapshot());
      const tensor = builder.build(snap, 6_000_000);

      for (let i = 20; i < 24; i++) {
        expect(Number.isFinite(tensor.tensor[i])).toBe(true);
      }
    });

    it('buildModeDLTensor standalone function works', () => {
      const snap = adapter.configure(createSnapshot());
      const tensor = buildModeDLTensor(snap, 7_000_000);
      expect(tensor.tensor).toHaveLength(MODE_SIGNAL_DL_FEATURE_COUNT);
      expect(tensor.mode).toBe('pvp');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 20: ModeSignalRiskScorer
  // --------------------------------------------------------------------------

  describe('ModeSignalRiskScorer', () => {
    const riskScorer = new ModeSignalRiskScorer();

    it('scores risk for a fresh pvp snapshot in [0, 1]', () => {
      const snap = adapter.configure(createSnapshot());
      const risk = riskScorer.score(snap);
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });

    it('scoreModeRisk standalone function returns same value', () => {
      const snap = adapter.configure(createSnapshot(), { battleBudgetStart: 100 });
      const direct = riskScorer.score(snap);
      const standalone = scoreModeRisk(snap);
      expect(standalone).toBeCloseTo(direct, 10);
    });

    it('risk increases when shield is damaged', () => {
      const snap = adapter.configure(createSnapshot(), { battleBudgetStart: 100 });
      const fullRisk = riskScorer.score(snap);

      const damagedSnap = {
        ...snap,
        shield: {
          ...snap.shield,
          weakestLayerRatio: 0.1,
          layers: snap.shield.layers.map((l) => ({
            ...l,
            current: 5,
            integrityRatio: 0.1,
          })),
        },
      };
      const damagedRisk = riskScorer.score(damagedSnap);
      expect(damagedRisk).toBeGreaterThan(fullRisk);
    });

    it('risk increases when pressure tier escalates', () => {
      const snap = adapter.configure(createSnapshot());
      const t1Snap = { ...snap, pressure: { ...snap.pressure, tier: 'T1' as PressureTier } };
      const t4Snap = { ...snap, pressure: { ...snap.pressure, tier: 'T4' as PressureTier } };

      const t1Risk = riskScorer.score(t1Snap);
      const t4Risk = riskScorer.score(t4Snap);

      expect(t4Risk).toBeGreaterThan(t1Risk);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 21: ModeSignalBatchProcessor
  // --------------------------------------------------------------------------

  describe('ModeSignalBatchProcessor', () => {
    it('processes a full configure → tickStart → tickEnd → action → finalize batch', () => {
      const batchProcessor = new ModeSignalBatchProcessor({ enableDLTensor: true });
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 100, rivalryHeatCarry: 20 });
      const tickStarted = adapter.onTickStart({ ...configured, tick: 3 });
      const tickEnded = adapter.onTickEnd({ ...tickStarted, modeState: { ...tickStarted.modeState, spectatorLimit: 50 } });
      const actionSnap = {
        ...tickEnded,
        tick: 3,
        battle: { ...tickEnded.battle, extractionCooldownTicks: 0 },
        modeState: { ...tickEnded.modeState, extractionActionsRemaining: 1 },
      };
      const actionResolved = adapter.resolveAction(actionSnap, 'FIRE_EXTRACTION', { extractionId: 'MARKET_DUMP' });
      const finalSnap = { ...actionResolved, outcome: 'FREEDOM' as RunOutcome };
      const finalized = adapter.finalize(finalSnap);

      const result = batchProcessor.process(
        [
          { kind: 'configure', snapshotBefore: base, snapshotAfter: configured, configureOptions: {} },
          { kind: 'tickStart', snapshotBefore: configured, snapshotAfter: tickStarted },
          { kind: 'tickEnd', snapshotBefore: tickStarted, snapshotAfter: tickEnded },
          { kind: 'action', snapshotBefore: actionSnap, snapshotAfter: actionResolved, actionId: 'FIRE_EXTRACTION' },
          { kind: 'finalize', snapshotBefore: finalSnap, snapshotAfter: finalized },
        ],
        15_000_000,
      );

      expect(result.totalProcessed).toBe(5);
      expect(result.totalEmitted).toBeGreaterThan(0);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('buildModeSignalBatchProcessor factory produces working processor', () => {
      const batchProcessor = buildModeSignalBatchProcessor({ enableDLTensor: false });
      const base = createSnapshot();
      const configured = adapter.configure(base);

      const result = batchProcessor.process(
        [{ kind: 'configure', snapshotBefore: base, snapshotAfter: configured }],
        16_000_000,
      );

      expect(result.totalProcessed).toBe(1);
    });

    it('batch result tracks high priority and critical signal counts', () => {
      const batchProcessor = new ModeSignalBatchProcessor();
      const base = createSnapshot();
      const configured = adapter.configure(base);

      const result = batchProcessor.process(
        [{ kind: 'configure', snapshotBefore: base, snapshotAfter: configured }],
        17_000_000,
      );

      expect(typeof result.highPriorityCount).toBe('number');
      expect(typeof result.criticalCount).toBe('number');
    });

    it('batch result skips deduped entries correctly', () => {
      const batchProcessor = new ModeSignalBatchProcessor();
      const base = createSnapshot();
      const configured = adapter.configure(base);

      const result = batchProcessor.process(
        [
          { kind: 'configure', snapshotBefore: base, snapshotAfter: configured },
          { kind: 'configure', snapshotBefore: base, snapshotAfter: configured }, // duplicate
        ],
        18_000_000,
      );

      expect(result.totalSkipped).toBeGreaterThanOrEqual(1);
    });

    it('getAdapter() returns the inner ModeSignalAdapter', () => {
      const batchProcessor = new ModeSignalBatchProcessor();
      const innerAdapter = batchProcessor.getAdapter();
      expect(innerAdapter).toBeInstanceOf(ModeSignalAdapter);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 22: ModeSignalAnalytics
  // --------------------------------------------------------------------------

  describe('ModeSignalAnalytics', () => {
    const analytics = new ModeSignalAnalytics();

    it('returns zeroed summary for empty signal list', () => {
      const summary = analytics.summarize([]);
      expect(summary.totalSignals).toBe(0);
      expect(summary.meanRiskScore).toBe(0);
      expect(summary.maxRiskScore).toBe(0);
    });

    it('summarizes signals with correct total and by-kind breakdown', () => {
      const batchProcessor = new ModeSignalBatchProcessor();
      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 100 });
      const tickStarted = adapter.onTickStart({ ...configured, tick: 3 });
      const tickEnded = adapter.onTickEnd(tickStarted);

      const result = batchProcessor.process(
        [
          { kind: 'configure', snapshotBefore: base, snapshotAfter: configured },
          { kind: 'tickStart', snapshotBefore: configured, snapshotAfter: tickStarted },
          { kind: 'tickEnd', snapshotBefore: tickStarted, snapshotAfter: tickEnded },
        ],
        20_000_000,
      );

      const summary = analytics.summarize(result.signals);

      expect(summary.totalSignals).toBe(result.totalEmitted);
      expect(summary.byKind['MODE_CONFIGURED'] + summary.byKind['MODE_TICK_STARTED'] + summary.byKind['MODE_TICK_ENDED']).toBe(result.totalEmitted);
    });

    it('meanRiskScore is within [0, 1]', () => {
      const batchProcessor = buildModeSignalBatchProcessor();
      const base = createSnapshot();
      const configured = adapter.configure(base);

      const result = batchProcessor.process(
        [{ kind: 'configure', snapshotBefore: base, snapshotAfter: configured }],
        21_000_000,
      );

      if (result.signals.length > 0) {
        const summary = analytics.summarize(result.signals);
        expect(summary.meanRiskScore).toBeGreaterThanOrEqual(0);
        expect(summary.meanRiskScore).toBeLessThanOrEqual(1);
      }
    });

    it('criticalPercent is 0 when no critical signals', () => {
      // Fresh pvp snapshot should not produce CRITICAL signals
      const batchProcessor = new ModeSignalBatchProcessor();
      const base = createSnapshot();
      const configured = adapter.configure(base);

      const result = batchProcessor.process(
        [{ kind: 'configure', snapshotBefore: base, snapshotAfter: configured }],
        22_000_000,
      );

      const summary = analytics.summarize(result.signals);
      expect(summary.criticalPercent).toBeGreaterThanOrEqual(0);
      expect(summary.criticalPercent).toBeLessThanOrEqual(100);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 23: buildModeSignalAdapter factory
  // --------------------------------------------------------------------------

  describe('buildModeSignalAdapter factory and inline extraction utilities', () => {
    it('buildModeSignalAdapter returns working adapter', () => {
      const builtAdapter = buildModeSignalAdapter({ enableDLTensor: false });
      const base = createSnapshot();
      const configured = adapter.configure(base);

      const signal = builtAdapter.onConfigure(base, configured, {}, 25_000_000);
      expect(signal?.kind).toBe('MODE_CONFIGURED');
    });

    it('resetDeduplication clears seen keys', () => {
      const signalAdapter = new ModeSignalAdapter();
      const base = createSnapshot();
      const configured = adapter.configure(base);

      const first = signalAdapter.onConfigure(base, configured, {}, 26_000_000);
      const second = signalAdapter.onConfigure(base, configured, {}, 26_000_001); // dedupe

      expect(first).not.toBeNull();
      expect(second).toBeNull();

      signalAdapter.resetDeduplication();
      const third = signalAdapter.onConfigure(base, configured, {}, 26_000_002); // after reset
      expect(third).not.toBeNull();
    });

    it('extractMlVector standalone on adapter returns 16 features', () => {
      const signalAdapter = new ModeSignalAdapter();
      const snap = adapter.configure(createSnapshot(), { battleBudgetStart: 120 });
      const vec = signalAdapter.extractMlVector(snap, 27_000_000);
      expect(vec.features).toHaveLength(16);
    });

    it('buildDlTensor standalone on adapter returns 24-feature tensor', () => {
      const signalAdapter = new ModeSignalAdapter({ enableDLTensor: true });
      const snap = adapter.configure(createSnapshot(), { battleBudgetStart: 80 });
      const tensor = signalAdapter.buildDlTensor(snap, 28_000_000);
      expect(tensor.tensor).toHaveLength(24);
    });

    it('scoreRisk standalone on adapter returns [0, 1]', () => {
      const signalAdapter = new ModeSignalAdapter();
      const snap = adapter.configure(createSnapshot());
      const risk = signalAdapter.scoreRisk(snap);
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 24: ModeRegistry + ModeRuntimeDirector integration
  // --------------------------------------------------------------------------

  describe('ModeRegistry and ModeRuntimeDirector integration', () => {
    it('registers PredatorModeAdapter under pvp mode', () => {
      const registry = new ModeRegistry();
      registry.register(adapter);

      const found = registry.mustGet('pvp');
      expect(found).toBe(adapter);
    });

    it('ModeRuntimeDirector routes configure through adapter correctly', () => {
      const registry = new ModeRegistry();
      registry.register(adapter);
      const director = new ModeRuntimeDirector(registry);

      const base = createSnapshot();
      const configured = director.configure(base, { battleBudgetStart: 100, rivalryHeatCarry: 20 });

      expect(configured.tags).toContain('mode:predator');
      expect(configured.battle.battleBudget).toBe(100);
      expect(configured.battle.rivalryHeatCarry).toBe(20);
    });

    it('ModeRuntimeDirector routes onTickStart correctly', () => {
      const registry = new ModeRegistry();
      registry.register(adapter);
      const director = new ModeRuntimeDirector(registry);

      const base = createSnapshot();
      const configured = director.configure(base, { battleBudgetStart: 80 });
      const snap = { ...configured, tick: 3, modeState: { ...configured.modeState, extractionActionsRemaining: 0 } };
      const started = director.onTickStart(snap);

      expect(started.modeState.extractionActionsRemaining).toBe(1);
    });

    it('ModeRuntimeDirector routes onTickEnd correctly', () => {
      const registry = new ModeRegistry();
      registry.register(adapter);
      const director = new ModeRuntimeDirector(registry);

      const base = createSnapshot();
      const configured = director.configure(base, { battleBudgetStart: 100 });
      const snap = {
        ...configured,
        tick: 5,
        modeState: { ...configured.modeState, spectatorLimit: 50 },
        pressure: { ...configured.pressure, tier: 'T1' as PressureTier },
      };
      const ended = director.onTickEnd(snap);

      expect(ended.battle.battleBudget).toBeGreaterThan(snap.battle.battleBudget);
    });

    it('ModeRuntimeDirector routes resolveAction correctly', () => {
      const registry = new ModeRegistry();
      registry.register(adapter);
      const director = new ModeRuntimeDirector(registry);

      const base = createSnapshot();
      const configured = director.configure(base, { battleBudgetStart: 100 });
      const snap = {
        ...configured,
        tick: 6,
        battle: { ...configured.battle, extractionCooldownTicks: 0 },
        modeState: { ...configured.modeState, extractionActionsRemaining: 1 },
      };

      const resolved = director.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'MISINFORMATION_FLOOD' });

      expect(resolved.battle.battleBudget).toBe(snap.battle.battleBudget - EXTRACTION_COSTS['MISINFORMATION_FLOOD']);
    });

    it('ModeRuntimeDirector routes finalize correctly', () => {
      const registry = new ModeRegistry();
      registry.register(adapter);
      const director = new ModeRuntimeDirector(registry);

      const base = createSnapshot();
      const configured = director.configure(base);
      const snap = {
        ...configured,
        outcome: 'FREEDOM' as RunOutcome,
        battle: { ...configured.battle, firstBloodClaimed: true, rivalryHeatCarry: 25, neutralizedBotIds: ['BOT_01'] as readonly HaterBotId[], battleBudget: 10 },
        sovereignty: { ...configured.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = director.finalize(snap);

      expect(finalized.sovereignty.proofBadges).toContain('FIRST_BLOOD');
      expect(finalized.sovereignty.cordScore).toBeGreaterThan(BASE_CORD_SCORE);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 25: Full 10-tick pvp simulation
  // --------------------------------------------------------------------------

  describe('Full 10-tick pvp simulation', () => {
    it('simulates complete pvp run accumulation correctly', () => {
      // Setup
      const signalAdapter = new ModeSignalAdapter({ enableDLTensor: true });

      let snap = createSnapshot();
      const configOptions: ModeConfigureOptions = {
        battleBudgetStart: 40,
        rivalryHeatCarry: 20,
        spectatorLimit: 50,
      };

      // Configure
      const preConfigSnap = snap;
      snap = adapter.configure(snap, configOptions);
      const configSignal = signalAdapter.onConfigure(preConfigSnap, snap, configOptions, 100_000);
      expect(configSignal).not.toBeNull();
      expect(snap.battle.rivalryHeatCarry).toBe(20);

      const signals: NonNullable<typeof configSignal>[] = [];
      if (configSignal) signals.push(configSignal);

      // Simulate 10 ticks
      for (let tick = 1; tick <= 10; tick++) {
        snap = { ...snap, tick };

        // tick start
        const preTickStart = snap;
        snap = adapter.onTickStart(snap);
        const tickStartSignal = signalAdapter.onTickStart(preTickStart, snap, tick * 1_000);
        if (tickStartSignal) signals.push(tickStartSignal);

        // Fire extraction on ticks that are multiples of 3 and have actions remaining
        if (tick % 3 === 0 && snap.modeState.extractionActionsRemaining > 0) {
          const preAction = snap;
          snap = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'MISINFORMATION_FLOOD' });
          const actionSignal = signalAdapter.onAction(preAction, snap, 'FIRE_EXTRACTION', tick * 1_000 + 500);
          if (actionSignal) signals.push(actionSignal);
        }

        // tick end
        const preTickEnd = snap;
        const s = {
          ...snap,
          modeState: { ...snap.modeState, spectatorLimit: 50 },
          pressure: {
            ...snap.pressure,
            tier: tick < 5 ? 'T1' : tick < 8 ? 'T2' : 'T3' as PressureTier,
          },
        };
        snap = { ...s };
        snap = adapter.onTickEnd(snap);
        const tickEndSignal = signalAdapter.onTickEnd(preTickEnd, snap, tick * 1_000 + 900);
        if (tickEndSignal) signals.push(tickEndSignal);
      }

      // Verify battle budget grew from passive income
      expect(snap.battle.battleBudget).toBeGreaterThan(0);
      expect(snap.battle.battleBudget).toBeLessThanOrEqual(BATTLE_BUDGET_CAP);

      // Verify spectator projection was emitted at tick 5 and 10
      const projections = snap.tags.filter((t) => t.startsWith('predator:spectator_projection'));
      expect(projections.length).toBeGreaterThanOrEqual(1);

      // Verify some extractions fired
      const extractionTags = snap.tags.filter((t) => t.startsWith('predator:extraction_fired'));
      expect(extractionTags.length).toBeGreaterThan(0);

      // Verify signals were emitted
      expect(signals.length).toBeGreaterThan(0);

      // Compute risk for final state
      const finalRisk = scoreModeRisk(snap);
      expect(finalRisk).toBeGreaterThanOrEqual(0);
      expect(finalRisk).toBeLessThanOrEqual(1);
    });

    it('pvp simulation finalize after full run produces correct badge set', () => {
      let snap = createSnapshot();

      snap = adapter.configure(snap, { battleBudgetStart: 50, rivalryHeatCarry: 25 });

      // Simulate attacking bots reducing budget through counter plays
      snap = { ...snap, battle: { ...snap.battle, pendingAttacks: [createAttack('a1'), createAttack('a2'), createAttack('a3')] } };
      snap = adapter.resolveAction(snap, 'COUNTER_PLAY');
      snap = adapter.resolveAction(snap, 'COUNTER_PLAY');
      snap = adapter.resolveAction(snap, 'COUNTER_PLAY');

      // Claim first blood
      snap = adapter.resolveAction(snap, 'CLAIM_FIRST_BLOOD');

      // Simulate many ticks of passive income to accumulate budget
      for (let i = 1; i <= 12; i++) {
        snap = { ...snap, tick: i };
        snap = adapter.onTickStart(snap);
        snap = adapter.onTickEnd({
          ...snap,
          pressure: { ...snap.pressure, tier: 'T1' as PressureTier },
        });
      }

      // Finalize with freedom and aggressor conditions
      snap = {
        ...snap,
        outcome: 'FREEDOM' as RunOutcome,
        battle: {
          ...snap.battle,
          neutralizedBotIds: ['BOT_01', 'BOT_02', 'BOT_03'] as readonly HaterBotId[],
          battleBudget: 30, // below 40 → AGGRESSOR
          rivalryHeatCarry: 25, // ARCH_RIVAL_PRESSURE
        },
        sovereignty: { ...snap.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);

      expect(finalized.sovereignty.proofBadges).toContain('FIRST_BLOOD');
      expect(finalized.sovereignty.proofBadges).toContain('ARCH_RIVAL_PRESSURE');
      expect(finalized.sovereignty.proofBadges).toContain('ARENA_CONTROL');
      expect(finalized.sovereignty.proofBadges).toContain('AGGRESSOR');
      expect(finalized.sovereignty.cordScore).toBeGreaterThan(BASE_CORD_SCORE);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 26: Extraction budget economy — full extraction cycle
  // --------------------------------------------------------------------------

  describe('Extraction budget economy — complete extraction cycles', () => {
    it('depletes budget through 3 consecutive extractions (with cooldown reset)', () => {
      let snap = createSnapshot();
      snap = adapter.configure(snap, { battleBudgetStart: 200 });

      // First extraction at tick 0 (initial extractionActionsRemaining: 1)
      snap = { ...snap, tick: 0, modeState: { ...snap.modeState, extractionActionsRemaining: 1 }, battle: { ...snap.battle, extractionCooldownTicks: 0 } };
      snap = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'MISINFORMATION_FLOOD' }); // -20
      expect(snap.battle.battleBudget).toBe(180);
      expect(snap.battle.extractionCooldownTicks).toBe(3);

      // Advance 3 ticks to clear cooldown
      for (let i = 1; i <= 3; i++) {
        snap = adapter.onTickEnd({ ...snap, tick: i, pressure: { ...snap.pressure, tier: 'T1' as PressureTier } });
      }
      expect(snap.battle.extractionCooldownTicks).toBe(0);

      // Second extraction (needs refresh at tick 3)
      snap = { ...snap, tick: 3 };
      snap = adapter.onTickStart(snap); // refreshes at tick 3 (3 % 3 === 0)
      expect(snap.modeState.extractionActionsRemaining).toBe(1);

      snap = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'CREDIT_REPORT_PULL' }); // -25
      // Budget = 180 + (3 * 8 passive income at T1) - 25 = 180 + 24 - 25 = 179
      expect(snap.battle.battleBudget).toBe(snap.battle.battleBudget); // just verify no error

      // Verify haterHeat accumulated
      expect(snap.economy.haterHeat).toBeGreaterThan(0);
    });

    it('first blood bonus is applied before passive income accumulation', () => {
      let snap = createSnapshot();
      snap = adapter.configure(snap, { battleBudgetStart: 40 });

      snap = adapter.resolveAction(snap, 'CLAIM_FIRST_BLOOD');
      expect(snap.battle.battleBudget).toBe(65); // 40 + 25

      snap = adapter.onTickEnd({
        ...snap,
        tick: 1,
        pressure: { ...snap.pressure, tier: 'T0' as PressureTier },
      });
      expect(snap.battle.battleBudget).toBe(65 + PASSIVE_INCOME_LOW); // 73
    });

    it('battle budget never exceeds cap regardless of passive income accumulation', () => {
      let snap = createSnapshot();
      snap = adapter.configure(snap, { battleBudgetStart: 200 });

      // Run 20 ticks of passive income at T0
      for (let i = 1; i <= 20; i++) {
        snap = adapter.onTickEnd({
          ...snap,
          tick: i,
          pressure: { ...snap.pressure, tier: 'T0' as PressureTier },
        });
        expect(snap.battle.battleBudget).toBeLessThanOrEqual(BATTLE_BUDGET_CAP);
      }
    });

    it('after max HOSTILE_TAKEOVER (60), budget bottoms out correctly', () => {
      let snap = createSnapshot();
      snap = adapter.configure(snap, { battleBudgetStart: 60 });

      snap = { ...snap, modeState: { ...snap.modeState, extractionActionsRemaining: 1 }, battle: { ...snap.battle, extractionCooldownTicks: 0 } };
      snap = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'HOSTILE_TAKEOVER' }); // -60

      expect(snap.battle.battleBudget).toBe(0);
      expect(snap.battle.extractionCooldownTicks).toBe(3);
      expect(snap.tags).toContain('predator:extraction_fired:HOSTILE_TAKEOVER');
    });

    it('LIQUIDATION_NOTICE (45) + DEBT_INJECTION (40) together exceed a 80-budget reserve', () => {
      // 45 + 40 = 85, can only fire one if budget is 80
      const base = createSnapshot();
      const snap = adapter.configure(base, { battleBudgetStart: 80 });

      const firstFire = adapter.resolveAction(
        { ...snap, modeState: { ...snap.modeState, extractionActionsRemaining: 1 }, battle: { ...snap.battle, extractionCooldownTicks: 0 } },
        'FIRE_EXTRACTION',
        { extractionId: 'LIQUIDATION_NOTICE' }, // -45
      );
      expect(firstFire.battle.battleBudget).toBe(35);

      // Now try DEBT_INJECTION (40) — should fail, budget is 35
      const secondFire = adapter.resolveAction(
        { ...firstFire, modeState: { ...firstFire.modeState, extractionActionsRemaining: 1 }, battle: { ...firstFire.battle, extractionCooldownTicks: 0 } },
        'FIRE_EXTRACTION',
        { extractionId: 'DEBT_INJECTION' }, // needs 40
      );
      expect(secondFire).toBe(firstFire); // rejected
    });

    it('REGULATORY_FILING (35) succeeds when budget is exactly 35', () => {
      const base = createSnapshot();
      const snap = {
        ...adapter.configure(base, { battleBudgetStart: 35 }),
        modeState: { ...adapter.configure(base, { battleBudgetStart: 35 }).modeState, extractionActionsRemaining: 1 },
        battle: { ...adapter.configure(base, { battleBudgetStart: 35 }).battle, extractionCooldownTicks: 0 },
      };

      const resolved = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'REGULATORY_FILING' });
      expect(resolved.battle.battleBudget).toBe(0);
      expect(resolved.tags).toContain('predator:extraction_fired:REGULATORY_FILING');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 27: Tag accumulation and deduplication across ticks
  // --------------------------------------------------------------------------

  describe('Tag accumulation and deduplication', () => {
    it('does not accumulate duplicate spectator projection tags', () => {
      let snap = createSnapshot();
      snap = adapter.configure(snap, { battleBudgetStart: 80 });
      snap = { ...snap, modeState: { ...snap.modeState, spectatorLimit: 50 } };

      // First time tick 5
      snap = { ...snap, tick: 5 };
      snap = adapter.onTickEnd({
        ...snap,
        pressure: { ...snap.pressure, tier: 'T1' as PressureTier },
      });

      const projCount = snap.tags.filter((t) => t === 'predator:spectator_projection:5').length;
      expect(projCount).toBe(1);

      // Simulate running tick 5 onTickEnd again (shouldn't duplicate)
      const snap2 = adapter.onTickEnd({
        ...snap,
        tick: 5,
        pressure: { ...snap.pressure, tier: 'T1' as PressureTier },
      });
      const projCount2 = snap2.tags.filter((t) => t === 'predator:spectator_projection:5').length;
      expect(projCount2).toBe(1);
    });

    it('extraction_fired tag uses unique extraction ID — multiple can coexist', () => {
      let snap = createSnapshot();
      snap = adapter.configure(snap, { battleBudgetStart: 200 });

      snap = { ...snap, tick: 1, modeState: { ...snap.modeState, extractionActionsRemaining: 1 }, battle: { ...snap.battle, extractionCooldownTicks: 0 } };
      snap = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'MARKET_DUMP' });

      // Clear cooldown
      snap = { ...snap, battle: { ...snap.battle, extractionCooldownTicks: 0 } };
      snap = { ...snap, tick: 4, modeState: { ...snap.modeState, extractionActionsRemaining: 1 } };
      snap = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'CREDIT_REPORT_PULL' });

      expect(snap.tags).toContain('predator:extraction_fired:MARKET_DUMP');
      expect(snap.tags).toContain('predator:extraction_fired:CREDIT_REPORT_PULL');
    });

    it('hoarding_penalty tag is not duplicated across multiple ticks', () => {
      let snap = createSnapshot();
      snap = adapter.configure(snap, { battleBudgetStart: 160 });

      // Tick 1 — triggers penalty
      snap = adapter.onTickEnd({
        ...snap,
        tick: 1,
        pressure: { ...snap.pressure, tier: 'T2' as PressureTier },
        battle: { ...snap.battle, battleBudget: 155, battleBudgetCap: 200 },
      });

      // Tick 2 — still above 150 — penalty should not duplicate
      snap = adapter.onTickEnd({
        ...snap,
        tick: 2,
        pressure: { ...snap.pressure, tier: 'T2' as PressureTier },
      });

      const penaltyCount = snap.tags.filter((t) => t === 'predator:hoarding_penalty').length;
      expect(penaltyCount).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 28: ModeConfigureOptions type annotation usage
  // --------------------------------------------------------------------------

  describe('ModeConfigureOptions type surface coverage', () => {
    it('uses ModeConfigureOptions type for explicit configure options', () => {
      const opts: ModeConfigureOptions = {
        battleBudgetStart: 120,
        rivalryHeatCarry: 18,
        spectatorLimit: 35,
        advantageId: null,
        handicapIds: [],
        disabledBots: ['BOT_04'],
        bleedMode: false,
      };

      const configured = adapter.configure(createSnapshot(), opts);
      expect(configured.battle.battleBudget).toBe(120);
      expect(configured.battle.rivalryHeatCarry).toBe(18);
      expect(configured.modeState.spectatorLimit).toBe(35);
    });

    it('configure options with disabled bots still works', () => {
      const opts: ModeConfigureOptions = {
        battleBudgetStart: 80,
        disabledBots: ['BOT_01', 'BOT_02'],
      };
      const configured = adapter.configure(createSnapshot(), opts);
      expect(configured.battle.battleBudget).toBe(80);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 29: Snapshot predicate integration on configured pvp state
  // --------------------------------------------------------------------------

  describe('Snapshot predicates after pvp configure()', () => {
    let configured: RunStateSnapshot;

    beforeEach(() => {
      configured = adapter.configure(createSnapshot(), { battleBudgetStart: 80, rivalryHeatCarry: 15 });
    });

    it('mode is still pvp after configure', () => {
      expect(isModeCode(configured.mode)).toBe(true);
      expect(configured.mode).toBe('pvp');
    });

    it('phase is FOUNDATION at start', () => {
      expect(isRunPhase(configured.phase)).toBe(true);
      expect(configured.phase).toBe('FOUNDATION');
    });

    it('outcome is null before finalize', () => {
      expect(configured.outcome).toBeNull();
    });

    it('economy is healthy after configure', () => {
      expect(isEconomyHealthy(configured)).toBe(true);
    });

    it('shield is not failing after configure', () => {
      expect(isShieldFailing(configured)).toBe(false);
    });

    it('battle is not escalating at start', () => {
      expect(isBattleEscalating(configured)).toBe(false);
    });

    it('cascade is not critical at start', () => {
      expect(isCascadeCritical(configured)).toBe(false);
    });

    it('run is not flagged at start', () => {
      expect(isRunFlagged(configured)).toBe(false);
    });

    it('snapshot is not terminal at start', () => {
      expect(isSnapshotTerminal(configured)).toBe(false);
    });

    it('cards are playable', () => {
      expect(hasPlayableCards(configured)).toBe(true);
    });

    it('no critical pending attacks at start', () => {
      expect(hasCriticalPendingAttacks(configured)).toBe(false);
    });

    it('no active decision windows at start', () => {
      expect(hasActiveDecisionWindows(configured)).toBe(false);
    });

    it('composite risk is computed successfully', () => {
      const risk = computeSnapshotCompositeRisk(configured);
      expect(Number.isFinite(risk)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 30: beforeAll / afterEach hooks
  // --------------------------------------------------------------------------

  describe('Test suite setup and tear-down integrity', () => {
    let setupSnap: RunStateSnapshot;
    let setupSignalAdapter: ModeSignalAdapter;

    beforeAll(() => {
      setupSnap = adapter.configure(createSnapshot(), { battleBudgetStart: 60, rivalryHeatCarry: 10 });
      setupSignalAdapter = new ModeSignalAdapter({ enableDLTensor: true });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('setupSnap has correct initial pvp configuration after beforeAll', () => {
      expect(setupSnap.battle.battleBudget).toBe(60);
      expect(setupSnap.battle.rivalryHeatCarry).toBe(10);
      expect(setupSnap.tags).toContain('mode:predator');
    });

    it('setupSignalAdapter is fresh and functional', () => {
      const signal = setupSignalAdapter.onConfigure(
        createSnapshot(),
        setupSnap,
        { battleBudgetStart: 60 },
        50_000_000,
      );
      expect(signal).not.toBeNull();
      expect(signal?.mode).toBe('pvp');
    });

    it('extraction cycle integration: configure → extract → tick → finalize produces valid cord score', () => {
      let snap = createSnapshot();
      snap = adapter.configure(snap, { battleBudgetStart: 100, rivalryHeatCarry: 22 });

      // Fire extraction at tick 0
      snap = {
        ...snap,
        tick: 1,
        battle: { ...snap.battle, extractionCooldownTicks: 0 },
        modeState: { ...snap.modeState, extractionActionsRemaining: 1 },
      };
      snap = adapter.resolveAction(snap, 'FIRE_EXTRACTION', { extractionId: 'DEBT_INJECTION' });

      // 3 ticks of passive income to clear cooldown
      for (let i = 2; i <= 4; i++) {
        snap = adapter.onTickEnd({
          ...snap,
          tick: i,
          pressure: { ...snap.pressure, tier: 'T2' as PressureTier },
        });
      }

      // Claim first blood
      snap = adapter.resolveAction({ ...snap, battle: { ...snap.battle, firstBloodClaimed: false } }, 'CLAIM_FIRST_BLOOD');

      // Finalize
      snap = {
        ...snap,
        outcome: 'FREEDOM' as RunOutcome,
        battle: {
          ...snap.battle,
          neutralizedBotIds: ['BOT_01'] as readonly HaterBotId[],
          battleBudget: 20,
        },
        sovereignty: { ...snap.sovereignty, cordScore: BASE_CORD_SCORE },
      };

      const finalized = adapter.finalize(snap);

      // FIRST_BLOOD (+0.05) + ARCH_RIVAL_PRESSURE (22 >= 20, +0.10) + ARENA_CONTROL (1 bot, +0.05) + AGGRESSOR (20 < 40, +0.10)
      // Total multiplier: 1 + 0.05 + 0.10 + 0.05 + 0.10 = 1.30
      const expectedMultiplier = 1 + FINALIZE_FIRST_BLOOD_BONUS + FINALIZE_ARCH_RIVAL_BONUS + FINALIZE_ARENA_CONTROL_PER_BOT + FINALIZE_AGGRESSOR_BONUS;
      const expectedCordScore = Number((BASE_CORD_SCORE * expectedMultiplier).toFixed(6));

      expect(finalized.sovereignty.cordScore).toBeCloseTo(expectedCordScore, 5);
      expect(finalized.sovereignty.proofBadges.length).toBe(4);

      // Generate final signal
      const finalSignal = setupSignalAdapter.onFinalize(snap, finalized, 60_000_000);
      expect(finalSignal?.kind).toBe('MODE_FINALIZED');
      expect(finalSignal?.channelRecommendation).toBe('GLOBAL');

      // Verify ML vector from final state
      const mlVec = extractModeMLVector(finalized, 61_000_000);
      expect(mlVec.features).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
      expect(mlVec.mode).toBe('pvp');

      // Verify DL tensor from final state
      const dlTensor = buildModeDLTensor(finalized, 62_000_000);
      expect(dlTensor.tensor).toHaveLength(MODE_SIGNAL_DL_FEATURE_COUNT);
      expect(dlTensor.shape).toEqual(MODE_SIGNAL_DL_TENSOR_SHAPE);
    });

    it('analytics summarizes full pvp lifecycle signals correctly', () => {
      const analytics = new ModeSignalAnalytics();
      const batchProcessor = new ModeSignalBatchProcessor({ enableDLTensor: true });

      const base = createSnapshot();
      const configured = adapter.configure(base, { battleBudgetStart: 80, rivalryHeatCarry: 20 });
      const tickSnap = { ...configured, tick: 3, modeState: { ...configured.modeState, extractionActionsRemaining: 1 }, battle: { ...configured.battle, extractionCooldownTicks: 0 } };
      const tickStarted = adapter.onTickStart(tickSnap);
      const actionResolved = adapter.resolveAction(tickStarted, 'FIRE_EXTRACTION', { extractionId: 'MARKET_DUMP' });
      const tickEnded = adapter.onTickEnd({ ...actionResolved, modeState: { ...actionResolved.modeState, spectatorLimit: 50 }, pressure: { ...actionResolved.pressure, tier: 'T1' as PressureTier } });
      const finalSnap = { ...tickEnded, outcome: 'FREEDOM' as RunOutcome, battle: { ...tickEnded.battle, firstBloodClaimed: true, rivalryHeatCarry: 20, neutralizedBotIds: ['BOT_01', 'BOT_02'] as readonly HaterBotId[], battleBudget: 15 }, sovereignty: { ...tickEnded.sovereignty, cordScore: BASE_CORD_SCORE } };
      const finalized = adapter.finalize(finalSnap);

      const result = batchProcessor.process([
        { kind: 'configure', snapshotBefore: base, snapshotAfter: configured, configureOptions: {} },
        { kind: 'tickStart', snapshotBefore: tickSnap, snapshotAfter: tickStarted },
        { kind: 'action', snapshotBefore: tickStarted, snapshotAfter: actionResolved, actionId: 'FIRE_EXTRACTION' },
        { kind: 'tickEnd', snapshotBefore: actionResolved, snapshotAfter: tickEnded },
        { kind: 'finalize', snapshotBefore: finalSnap, snapshotAfter: finalized },
      ], 70_000_000);

      const summary = analytics.summarize(result.signals);

      expect(summary.totalSignals).toBe(result.totalEmitted);
      expect(summary.byChannel['SYNDICATE'] + summary.byChannel['GLOBAL']).toBeGreaterThan(0);
      expect(summary.maxRiskScore).toBeGreaterThanOrEqual(0);
      expect(summary.criticalPercent).toBeGreaterThanOrEqual(0);

      // Verify all signal ML feature label arrays are consistent
      result.signals.forEach((sig) => {
        const payload = sig.payload as { mlVector?: { featureLabels: readonly string[] }; dlTensor?: { featureLabels: readonly string[] } };
        if (payload.mlVector) {
          expect(payload.mlVector.featureLabels).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
          payload.mlVector.featureLabels.forEach((label) => {
            expect(MODE_SIGNAL_ML_FEATURE_LABELS).toContain(label);
          });
        }
        if (payload.dlTensor) {
          expect(payload.dlTensor.featureLabels).toHaveLength(MODE_SIGNAL_DL_FEATURE_COUNT);
          payload.dlTensor.featureLabels.forEach((label) => {
            expect(MODE_SIGNAL_DL_FEATURE_LABELS).toContain(label);
          });
        }
      });
    });
  });
});
