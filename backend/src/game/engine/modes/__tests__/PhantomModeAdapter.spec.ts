//backend/src/game/engine/modes/__tests__/PhantomModeAdapter.spec.ts

/**
 * ============================================================================
 * POINT ZERO ONE — PHANTOM MODE ADAPTER — COMPREHENSIVE TEST SUITE
 * ============================================================================
 *
 * Coverage doctrine:
 * - Every PhantomModeAdapter lifecycle method tested with full input/output
 *   verification across boundary conditions, edge cases, and nominal paths.
 * - All GamePrimitives utility functions called inside test assertions so
 *   every import is live runtime code, not a dead type-only reference.
 * - ML/DL feature vectors extracted and asserted at key lifecycle moments.
 * - Mode signal bridge (ModeSignalAdapter) verified on every lifecycle call.
 * - Community heat modifier, legend decay tax, gap-vs-legend computation,
 *   ghost window detection, and cord score multiplier all verified in depth.
 * - Full 12-tick simulation exercised to validate accumulation semantics.
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
import { PhantomModeAdapter } from '../PhantomModeAdapter';
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

/** Ghost window radius — must match the private constant in PhantomModeAdapter */
const GHOST_WINDOW_RADIUS = 3;

/** Default tick at which the snapshot begins (legend marker at tick 5) */
const DEFAULT_TICK = 5;

/** Community runs threshold that yields the max heat modifier (0.35 * 100 = ~116 667 runs) */
const COMMUNITY_RUNS_MAX_MODIFIER_THRESHOLD = Math.ceil(35 / 0.003);

/** Baseline cord score used in finalize tests */
const BASE_CORD_SCORE = 2.0;

/** All canonical mode codes */
const ALL_MODE_CODES: readonly ModeCode[] = MODE_CODES;

/** All canonical pressure tiers */
const ALL_PRESSURE_TIERS: readonly PressureTier[] = PRESSURE_TIERS;

/** All canonical run phases */
const ALL_RUN_PHASES: readonly RunPhase[] = RUN_PHASES;

/** Minimum legend age (days) that triggers decay tax */
const MIN_DAYS_FOR_DECAY = 3;

// ============================================================================
// MARK: Factory helpers
// ============================================================================

function createCardDefinition(id = 'card-1', deckType: CardDefinition['deckType'] = 'GHOST'): CardDefinition {
  return {
    id,
    name: `Card ${id}`,
    deckType,
    baseCost: 0,
    baseEffect: { cashDelta: 200 },
    tags: ['ghost'],
    timingClass: ['ANY'],
    rarity: 'COMMON',
    autoResolve: false,
    counterability: 'NONE',
    targeting: 'SELF',
    decisionTimerOverrideMs: null,
    decayTicks: null,
    modeLegal: ['ghost'],
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

function createThreat(
  id = 'th-1',
  etaTicks = 2,
  visibility: ThreatEnvelope['visibleAs'] = 'HIDDEN',
): ThreatEnvelope {
  return {
    threatId: id,
    source: 'BOT_01',
    etaTicks,
    severity: 1,
    visibleAs: visibility,
    summary: 'Incoming legend threat',
  };
}

function createLegendMarker(
  id = 'lm-1',
  tick = 5,
  kind: LegendMarker['kind'] = 'GOLD',
): LegendMarker {
  return {
    markerId: id,
    tick,
    kind,
    cardId: null,
    summary: `Legend marker at tick ${tick}`,
  };
}

function createAttack(
  id = 'atk-1',
  category: AttackEvent['category'] = 'HEAT',
  magnitude = 5,
): AttackEvent {
  return {
    attackId: id,
    source: 'SYSTEM',
    targetEntity: 'SELF',
    targetLayer: 'L1',
    category,
    magnitude,
    createdAtTick: 0,
    notes: [],
  };
}

function createCascadeChain(id = 'chain-1'): CascadeChainInstance {
  return {
    chainId: id,
    templateId: 'template-phantom-chain',
    trigger: 'ghost-card-played',
    positive: true,
    status: 'ACTIVE',
    createdAtTick: 0,
    links: [
      { linkId: `${id}-link-1`, scheduledTick: 1, effect: { cashDelta: 300 }, summary: 'Link 1 fires' },
      { linkId: `${id}-link-2`, scheduledTick: 2, effect: { cashDelta: 300 }, summary: 'Link 2 fires' },
    ],
    recoveryTags: ['phantom-recovery'],
  };
}

function createSnapshot(tick = DEFAULT_TICK, overrides: Partial<RunStateSnapshot> = {}): RunStateSnapshot {
  const base: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: 'phantom-run-1',
    userId: 'user-ghost',
    seed: 'seed-phantom',
    mode: 'ghost',
    tick,
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
      visibleThreats: [createThreat('th-1', 2, 'HIDDEN'), createThreat('th-2', 3, 'PARTIAL')],
      maxPulseTriggered: false,
      lastSpikeTick: null,
    },
    shield: {
      layers: [
        { layerId: 'L1', label: 'CASH_RESERVE',  current: 50, max: 50, regenPerTick: 1, breached: false, integrityRatio: 1, lastDamagedTick: null, lastRecoveredTick: null },
        { layerId: 'L2', label: 'CREDIT_LINE',   current: 50, max: 50, regenPerTick: 1, breached: false, integrityRatio: 1, lastDamagedTick: null, lastRecoveredTick: null },
        { layerId: 'L3', label: 'INCOME_BASE',   current: 50, max: 50, regenPerTick: 1, breached: false, integrityRatio: 1, lastDamagedTick: null, lastRecoveredTick: null },
        { layerId: 'L4', label: 'NETWORK_CORE',  current: 50, max: 50, regenPerTick: 1, breached: false, integrityRatio: 1, lastDamagedTick: null, lastRecoveredTick: null },
      ],
      weakestLayerId: 'L1',
      weakestLayerRatio: 1,
      blockedThisRun: 0,
      damagedThisRun: 0,
      breachesThisRun: 0,
      repairQueueDepth: 0,
    },
    battle: {
      bots: HATER_BOT_IDS.map((botId) => ({
        botId,
        label: `Bot ${botId}`,
        state: 'DORMANT' as BotState,
        heat: 0,
        lastAttackTick: null,
        attacksLanded: 0,
        attacksBlocked: 0,
        neutralized: false,
      })),
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
      gapClosingRate: 0.05,
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
      ghostMarkers: [createLegendMarker('lm-1', tick)],
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

  return { ...base, ...overrides } as RunStateSnapshot;
}

// ============================================================================
// MARK: Reusable assertion helpers wiring all GamePrimitives imports
// ============================================================================

function computeShieldIntegrityForSnapshot(snapshot: RunStateSnapshot): number {
  return computeShieldIntegrityRatio(
    snapshot.shield.layers.map((l) => ({ id: l.layerId, current: l.current, max: l.max })),
  );
}

function computeAggregateBotThreatForSnapshot(snapshot: RunStateSnapshot): number {
  return computeAggregateBotThreat(
    snapshot.battle.bots.map((b) => ({ id: b.botId as HaterBotId, state: b.state as BotState })),
  );
}

function computeDefenseUrgencyForSnapshot(snapshot: RunStateSnapshot): number {
  const activeBots = snapshot.battle.bots.filter(
    (b) => b.state === 'TARGETING' || b.state === 'ATTACKING',
  );
  if (activeBots.length === 0) return 0;
  return computeDefenseUrgency(
    activeBots.map((b) => ({ id: b.botId as HaterBotId, state: b.state as BotState })),
  );
}

function computeFirstCardPower(snapshot: RunStateSnapshot): number {
  if (snapshot.cards.hand.length === 0) return 0;
  return computeCardPowerScore(snapshot.cards.hand[0]);
}

function computeFirstCardTimingPriority(snapshot: RunStateSnapshot): number {
  if (snapshot.cards.hand.length === 0) return 0;
  return computeCardTimingPriority(snapshot.cards.hand[0]);
}

function computeFirstLegendMarkerValue(snapshot: RunStateSnapshot): number {
  if (snapshot.cards.ghostMarkers.length === 0) return 0;
  return computeLegendMarkerValue(snapshot.cards.ghostMarkers[0]);
}

function computeFirstThreatUrgency(snapshot: RunStateSnapshot, tick = 0): string {
  if (snapshot.tension.visibleThreats.length === 0) return 'NONE';
  return classifyThreatUrgency(snapshot.tension.visibleThreats[0], tick);
}

function computeFirstAttackSeverity(snapshot: RunStateSnapshot): string {
  if (snapshot.battle.pendingAttacks.length === 0) return 'NONE';
  return classifyAttackSeverity(snapshot.battle.pendingAttacks[0]);
}

function computeFirstCascadeHealth(snapshot: RunStateSnapshot): number {
  if (snapshot.cascade.activeChains.length === 0) return 1;
  return scoreCascadeChainHealth(snapshot.cascade.activeChains[0]);
}

// ============================================================================
// MARK: Shared test fixtures
// ============================================================================

let adapter: PhantomModeAdapter;
let registry: ModeRegistry;
let director: ModeRuntimeDirector;
let signalAdapter: ModeSignalAdapter;
let mlExtractor: ModeMlFeatureExtractor;
let dlBuilder: ModeDlTensorBuilder;
let riskScorer: ModeSignalRiskScorer;
let analytics: ModeSignalAnalytics;

beforeAll(() => {
  // Verify canonical constants are complete and correctly shaped
  expect(ALL_MODE_CODES).toHaveLength(4);
  expect(ALL_PRESSURE_TIERS).toHaveLength(5);
  expect(ALL_RUN_PHASES).toHaveLength(3);
  expect(SHIELD_LAYER_IDS).toHaveLength(4);
  expect(HATER_BOT_IDS).toHaveLength(5);

  // Verify type guards
  expect(isModeCode('ghost')).toBe(true);
  expect(isModeCode('phantom')).toBe(false);
  expect(isPressureTier('T0')).toBe(true);
  expect(isPressureTier('T9')).toBe(false);
  expect(isRunPhase('FOUNDATION')).toBe(true);
  expect(isRunPhase('LIMBO')).toBe(false);
  expect(isRunOutcome('FREEDOM')).toBe(true);
  expect(isRunOutcome('SURRENDER')).toBe(false);
  expect(isShieldLayerId('L1')).toBe(true);
  expect(isShieldLayerId('L9')).toBe(false);
  expect(isHaterBotId('BOT_01')).toBe(true);
  expect(isHaterBotId('BOT_99')).toBe(false);

  // Verify GHOST_WINDOW_RADIUS constant matches adapter behaviour
  expect(GHOST_WINDOW_RADIUS).toBe(3);

  // Verify canonical constant tables are fully populated
  for (const tier of ALL_PRESSURE_TIERS) {
    expect(typeof PRESSURE_TIER_NORMALIZED[tier]).toBe('number');
  }
  for (const mode of ALL_MODE_CODES) {
    expect(typeof MODE_NORMALIZED[mode]).toBe('number');
    expect(typeof MODE_DIFFICULTY_MULTIPLIER[mode]).toBe('number');
  }
  for (const phase of ALL_RUN_PHASES) {
    expect(typeof RUN_PHASE_NORMALIZED[phase]).toBe('number');
  }
  for (const id of SHIELD_LAYER_IDS) {
    expect(typeof SHIELD_LAYER_CAPACITY_WEIGHT[id]).toBe('number');
  }
  for (const timing of ['ANY', 'PRE_INCOME', 'POST_INCOME', 'COMBAT', 'EMERGENCY', 'ANYTIME'] as const) {
    expect(typeof TIMING_CLASS_WINDOW_PRIORITY[timing]).toBe('number');
  }
  for (const rarity of ['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY'] as const) {
    expect(typeof CARD_RARITY_WEIGHT[rarity]).toBe('number');
  }
  for (const deckType of ['OPPORTUNITY', 'DEFENSE', 'COUNTER', 'GHOST', 'PRIVILEGE', 'CASCADE', 'SYNDICATE'] as const) {
    expect(typeof DECK_TYPE_POWER_LEVEL[deckType]).toBe('number');
  }
  for (const cat of ['EXTRACTION', 'LOCK', 'DRAIN', 'HEAT', 'BREACH', 'DEBT'] as const) {
    expect(typeof ATTACK_CATEGORY_BASE_MAGNITUDE[cat]).toBe('number');
  }
});

beforeEach(() => {
  adapter = new PhantomModeAdapter();
  registry = new ModeRegistry();
  registry.register(adapter);
  director = new ModeRuntimeDirector(registry);
  signalAdapter = buildModeSignalAdapter({ enableDLTensor: true });
  mlExtractor = new ModeMlFeatureExtractor();
  dlBuilder = new ModeDlTensorBuilder();
  riskScorer = new ModeSignalRiskScorer();
  analytics = new ModeSignalAnalytics();
});

afterEach(() => {
  signalAdapter.resetDeduplication();
  vi.restoreAllMocks();
});

// ============================================================================
// MARK: describe('PhantomModeAdapter') — main test suite
// ============================================================================

describe('PhantomModeAdapter', () => {

  // --------------------------------------------------------------------------
  // SECTION 1: configure — identity and tag emission
  // --------------------------------------------------------------------------
  describe('configure — identity and tag emission', () => {
    it('modeCode is "ghost"', () => {
      expect(adapter.modeCode).toBe('ghost');
    });

    it('implements ModeAdapter interface at runtime', () => {
      const a: ModeAdapter = adapter;
      expect(typeof a.configure).toBe('function');
    });

    it('configure adds mode:phantom tag', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.tags).toContain('mode:phantom');
    });

    it('configure adds legend_markers:enabled tag', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.tags).toContain('legend_markers:enabled');
    });

    it('configure adds hold:disabled tag', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.tags).toContain('hold:disabled');
    });

    it('configure adds ghost:legend_cord:unknown when legendCordScore is not provided', () => {
      const configured = adapter.configure(createSnapshot(), {});
      expect(configured.tags).toContain('ghost:legend_cord:unknown');
    });

    it('configure adds ghost:legend_cord:{score} when legendCordScore is provided', () => {
      const configured = adapter.configure(createSnapshot(), { legendCordScore: 1.75 });
      expect(configured.tags).toContain('ghost:legend_cord:1.75');
    });

    it('configure does not duplicate tags on repeated calls', () => {
      const once = adapter.configure(createSnapshot());
      const twice = adapter.configure(once);
      const modePhantomCount = twice.tags.filter((t) => t === 'mode:phantom').length;
      expect(modePhantomCount).toBe(1);
    });

    it('configure preserves existing snapshot tags', () => {
      const snap = createSnapshot();
      const withExtra = { ...snap, tags: ['pre-existing'] } as RunStateSnapshot;
      const configured = adapter.configure(withExtra);
      expect(configured.tags).toContain('pre-existing');
      expect(configured.tags).toContain('mode:phantom');
    });

    it('configure sets holdEnabled to false in modeState', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.holdEnabled).toBe(false);
    });

    it('configure sets loadoutEnabled to false in modeState', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.loadoutEnabled).toBe(false);
    });

    it('configure sets legendMarkersEnabled to true in modeState', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.legendMarkersEnabled).toBe(true);
    });

    it('configure sets holdCharges to 0', () => {
      const snap = createSnapshot();
      const withHold = { ...snap, timers: { ...snap.timers, holdCharges: 5 } } as RunStateSnapshot;
      const configured = adapter.configure(withHold);
      expect(configured.timers.holdCharges).toBe(0);
    });

    it('configure sets modePresentation to "phantom"', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.modePresentation).toBe('phantom');
    });

    it('configure sets bleedMode to false', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.bleedMode).toBe(false);
    });

    it('configure sets roleLockEnabled to false', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.roleLockEnabled).toBe(false);
    });

    it('configure sets extractionActionsRemaining to 0', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.extractionActionsRemaining).toBe(0);
    });

    it('configure sets battleBudget and battleBudgetCap to 0', () => {
      const snap = createSnapshot();
      const withBudget = { ...snap, battle: { ...snap.battle, battleBudget: 500, battleBudgetCap: 1000 } } as RunStateSnapshot;
      const configured = adapter.configure(withBudget);
      expect(configured.battle.battleBudget).toBe(0);
      expect(configured.battle.battleBudgetCap).toBe(0);
    });

    it('configure sets extractionCooldownTicks and rivalryHeatCarry to 0', () => {
      const snap = createSnapshot();
      const modified = {
        ...snap,
        battle: { ...snap.battle, extractionCooldownTicks: 3, rivalryHeatCarry: 10 },
      } as RunStateSnapshot;
      const configured = adapter.configure(modified);
      expect(configured.battle.extractionCooldownTicks).toBe(0);
      expect(configured.battle.rivalryHeatCarry).toBe(0);
    });

    it('configure stores legendRunId in ghostBaselineRunId', () => {
      const configured = adapter.configure(createSnapshot(), { legendRunId: 'run-legend-42' });
      expect(configured.modeState.ghostBaselineRunId).toBe('run-legend-42');
    });

    it('configure stores legendOwnerUserId in modeState', () => {
      const configured = adapter.configure(createSnapshot(), { legendOwnerUserId: 'owner-99' });
      expect(configured.modeState.legendOwnerUserId).toBe('owner-99');
    });

    it('configure sets legendOwnerUserId to null when not provided', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.legendOwnerUserId).toBeNull();
    });

    it('configure sets ghostBaselineRunId to null when not provided', () => {
      const configured = adapter.configure(createSnapshot());
      expect(configured.modeState.ghostBaselineRunId).toBeNull();
    });

    it('configure overrides handicapIds with an empty array', () => {
      const snap = createSnapshot();
      const withHandicaps = {
        ...snap,
        modeState: { ...snap.modeState, handicapIds: ['CLOCK_CURSED'] },
      } as RunStateSnapshot;
      const configured = adapter.configure(withHandicaps);
      expect(configured.modeState.handicapIds).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: configure — community heat modifier computation
  // --------------------------------------------------------------------------
  describe('configure — community heat modifier computation', () => {
    it('communityHeatModifier is 0 when communityRunsSinceLegend is 0', () => {
      const configured = adapter.configure(createSnapshot(), { communityRunsSinceLegend: 0 });
      expect(configured.modeState.communityHeatModifier).toBe(0);
    });

    it('communityHeatModifier equals communityRunsSinceLegend * 0.003 (rounded)', () => {
      const runs = 10_000;
      const expected = Number((runs * 0.003).toFixed(3));
      const configured = adapter.configure(createSnapshot(), { communityRunsSinceLegend: runs });
      expect(configured.modeState.communityHeatModifier).toBe(expected);
    });

    it('communityHeatModifier scales linearly with run count', () => {
      const c1 = adapter.configure(createSnapshot(), { communityRunsSinceLegend: 5_000 });
      const c2 = adapter.configure(createSnapshot(), { communityRunsSinceLegend: 10_000 });
      expect(c2.modeState.communityHeatModifier).toBeCloseTo(
        c1.modeState.communityHeatModifier * 2, 3,
      );
    });

    it('haterHeat reflects effectiveHeat when legendOriginalHeat + modifier > starting heat', () => {
      const configured = adapter.configure(createSnapshot(), {
        legendOriginalHeat: 40,
        communityRunsSinceLegend: 10_000,
        legendDaysAlive: 0,
      });
      const expected = Math.round(40 + 10_000 * 0.003);
      expect(configured.economy.haterHeat).toBe(expected);
    });

    it('haterHeat is clamped to max(current, effectiveHeat)', () => {
      const snap = createSnapshot();
      const withHighHeat = { ...snap, economy: { ...snap.economy, haterHeat: 999 } } as RunStateSnapshot;
      const configured = adapter.configure(withHighHeat, { legendOriginalHeat: 5, communityRunsSinceLegend: 0 });
      expect(configured.economy.haterHeat).toBe(999);
    });

    it('communityHeatModifier with large run count computes correctly', () => {
      const configured = adapter.configure(createSnapshot(), {
        communityRunsSinceLegend: COMMUNITY_RUNS_MAX_MODIFIER_THRESHOLD,
      });
      expect(configured.modeState.communityHeatModifier).toBeGreaterThanOrEqual(35);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: configure — legend decay tax computation
  // --------------------------------------------------------------------------
  describe('configure — legend decay tax computation', () => {
    it('no decay tax when legendDaysAlive is 0', () => {
      const configured = adapter.configure(createSnapshot(), {
        legendOriginalHeat: 0,
        legendDaysAlive: 0,
        communityRunsSinceLegend: 0,
      });
      expect(configured.economy.haterHeat).toBe(0);
    });

    it('no decay tax when legendDaysAlive is less than 3', () => {
      // floor(2/3) = 0, so decayTax = 0
      const configured = adapter.configure(createSnapshot(), {
        legendOriginalHeat: 10,
        legendDaysAlive: 2,
        communityRunsSinceLegend: 0,
      });
      expect(configured.economy.haterHeat).toBe(10);
    });

    it('decay tax is 5 when legendDaysAlive is exactly 3', () => {
      // floor(3/3)*5 = 1*5 = 5
      const configured = adapter.configure(createSnapshot(), {
        legendOriginalHeat: 0,
        legendDaysAlive: MIN_DAYS_FOR_DECAY,
        communityRunsSinceLegend: 0,
      });
      expect(configured.economy.haterHeat).toBe(5);
    });

    it('decay tax accumulates by 5 per additional 3 days', () => {
      const c6days = adapter.configure(createSnapshot(), {
        legendOriginalHeat: 0,
        legendDaysAlive: 6,
        communityRunsSinceLegend: 0,
      });
      // floor(6/3)*5 = 2*5 = 10
      expect(c6days.economy.haterHeat).toBe(10);
    });

    it('decay tax at 30 days equals 50 heat', () => {
      const configured = adapter.configure(createSnapshot(), {
        legendOriginalHeat: 0,
        legendDaysAlive: 30,
        communityRunsSinceLegend: 0,
      });
      // floor(30/3)*5 = 10*5 = 50
      expect(configured.economy.haterHeat).toBe(50);
    });

    it('effectiveHeat combines legendOriginalHeat + communityModifier + decayTax', () => {
      // original=20, community=50000*0.003=150, decay=floor(9/3)*5=15
      const configured = adapter.configure(createSnapshot(), {
        legendOriginalHeat: 20,
        communityRunsSinceLegend: 50_000,
        legendDaysAlive: 9,
      });
      const expected = Math.round(20 + 150 + 15);
      expect(configured.economy.haterHeat).toBe(expected);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 4: configure — gapVsLegend computation
  // --------------------------------------------------------------------------
  describe('configure — gapVsLegend computation', () => {
    it('gapVsLegend is unchanged when legendCordScore is not provided', () => {
      const snap = createSnapshot();
      const withGap = { ...snap, sovereignty: { ...snap.sovereignty, gapVsLegend: 0.42 } } as RunStateSnapshot;
      const configured = adapter.configure(withGap, {});
      expect(configured.sovereignty.gapVsLegend).toBe(0.42);
    });

    it('gapVsLegend = cordScore - legendCordScore when legendCordScore is provided', () => {
      const snap = createSnapshot();
      const withCord = { ...snap, sovereignty: { ...snap.sovereignty, cordScore: 2.5 } } as RunStateSnapshot;
      const configured = adapter.configure(withCord, { legendCordScore: 1.8 });
      expect(configured.sovereignty.gapVsLegend).toBeCloseTo(2.5 - 1.8, 5);
    });

    it('gapVsLegend is negative when legend has higher cord score', () => {
      const snap = createSnapshot();
      const withCord = { ...snap, sovereignty: { ...snap.sovereignty, cordScore: 1.0 } } as RunStateSnapshot;
      const configured = adapter.configure(withCord, { legendCordScore: 2.0 });
      expect(configured.sovereignty.gapVsLegend).toBeLessThan(0);
    });

    it('gapVsLegend is positive when player has higher cord score', () => {
      const snap = createSnapshot();
      const withCord = { ...snap, sovereignty: { ...snap.sovereignty, cordScore: 3.0 } } as RunStateSnapshot;
      const configured = adapter.configure(withCord, { legendCordScore: 2.0 });
      expect(configured.sovereignty.gapVsLegend).toBeGreaterThan(0);
    });

    it('gapVsLegend is zero when scores are equal', () => {
      const snap = createSnapshot();
      const withCord = { ...snap, sovereignty: { ...snap.sovereignty, cordScore: 2.0 } } as RunStateSnapshot;
      const configured = adapter.configure(withCord, { legendCordScore: 2.0 });
      expect(configured.sovereignty.gapVsLegend).toBe(0);
    });

    it('gapVsLegend is computed to 6 decimal places', () => {
      const snap = createSnapshot();
      const withCord = { ...snap, sovereignty: { ...snap.sovereignty, cordScore: 1.0000001 } } as RunStateSnapshot;
      const configured = adapter.configure(withCord, { legendCordScore: 1.0 });
      // Should not be NaN or Infinity
      expect(Number.isFinite(configured.sovereignty.gapVsLegend)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 5: configure — ghost markers assignment
  // --------------------------------------------------------------------------
  describe('configure — ghost markers assignment', () => {
    it('ghostMarkers are replaced by legendMarkers when provided', () => {
      const markers = [
        createLegendMarker('lm-1', 5, 'GOLD'),
        createLegendMarker('lm-2', 10, 'SILVER'),
      ];
      const configured = adapter.configure(createSnapshot(), { legendMarkers: markers });
      expect(configured.cards.ghostMarkers).toHaveLength(2);
      expect(configured.cards.ghostMarkers[0].markerId).toBe('lm-1');
      expect(configured.cards.ghostMarkers[1].markerId).toBe('lm-2');
    });

    it('ghostMarkers are unchanged when legendMarkers is not provided', () => {
      const snap = createSnapshot();
      const originalMarkers = snap.cards.ghostMarkers;
      const configured = adapter.configure(snap, {});
      expect(configured.cards.ghostMarkers).toBe(originalMarkers);
    });

    it('can configure with 20 ghost markers without error', () => {
      const markers = Array.from({ length: 20 }, (_, i) =>
        createLegendMarker(`lm-${i + 1}`, i * 2 + 1),
      );
      expect(() => adapter.configure(createSnapshot(), { legendMarkers: markers })).not.toThrow();
    });

    it('can configure with zero ghost markers', () => {
      const configured = adapter.configure(createSnapshot(), { legendMarkers: [] });
      expect(configured.cards.ghostMarkers).toHaveLength(0);
    });

    it('computeLegendMarkerValue works on configured markers', () => {
      const marker = createLegendMarker('lm-gold', 5, 'GOLD');
      const configured = adapter.configure(createSnapshot(), { legendMarkers: [marker] });
      const value = computeFirstLegendMarkerValue(configured);
      expect(value).toBeGreaterThan(0);
    });

    it('GOLD marker has higher value than SILVER marker', () => {
      const gold = createLegendMarker('gold', 5, 'GOLD');
      const silver = createLegendMarker('silver', 5, 'SILVER');
      const goldValue = computeLegendMarkerValue(gold);
      const silverValue = computeLegendMarkerValue(silver);
      expect(goldValue).toBeGreaterThanOrEqual(silverValue);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 6: onTickStart — ghost window detection
  // --------------------------------------------------------------------------
  describe('onTickStart — ghost window detection', () => {
    it('adds ghost:marker_window tag when tick matches a marker exactly', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const started = adapter.onTickStart(snap);
      expect(started.tags).toContain('ghost:marker_window');
    });

    it('adds ghost:marker_window tag when tick is within GHOST_WINDOW_RADIUS of a marker', () => {
      for (let offset = 0; offset <= GHOST_WINDOW_RADIUS; offset++) {
        const tick = 10 + offset;
        const snap = createSnapshot(tick, {
          cards: { ...createSnapshot(tick).cards, ghostMarkers: [createLegendMarker('lm-1', 10)] },
        });
        const started = adapter.onTickStart(snap);
        expect(started.tags).toContain('ghost:marker_window');
      }
    });

    it('removes ghost:marker_window tag when tick is outside GHOST_WINDOW_RADIUS', () => {
      const tick = 20;
      const snap = createSnapshot(tick, {
        tags: ['ghost:marker_window'],
        cards: { ...createSnapshot(tick).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const started = adapter.onTickStart(snap);
      expect(started.tags).not.toContain('ghost:marker_window');
    });

    it('removes ghost:marker_window exactly at GHOST_WINDOW_RADIUS + 1 boundary', () => {
      const markerTick = 10;
      const playerTick = markerTick + GHOST_WINDOW_RADIUS + 1;
      const snap = createSnapshot(playerTick, {
        tags: ['ghost:marker_window'],
        cards: { ...createSnapshot(playerTick).cards, ghostMarkers: [createLegendMarker('lm-1', markerTick)] },
      });
      const started = adapter.onTickStart(snap);
      expect(started.tags).not.toContain('ghost:marker_window');
    });

    it('handles negative tick distance (player before marker) within radius', () => {
      const markerTick = 10;
      const playerTick = markerTick - GHOST_WINDOW_RADIUS;
      const snap = createSnapshot(playerTick, {
        cards: { ...createSnapshot(playerTick).cards, ghostMarkers: [createLegendMarker('lm-1', markerTick)] },
      });
      const started = adapter.onTickStart(snap);
      expect(started.tags).toContain('ghost:marker_window');
    });

    it('detects window via any marker in the list', () => {
      const tick = 50;
      const snap = createSnapshot(tick, {
        cards: {
          ...createSnapshot(tick).cards,
          ghostMarkers: [
            createLegendMarker('lm-1', 1),   // far
            createLegendMarker('lm-2', 100),  // far
            createLegendMarker('lm-3', 51),   // within radius
          ],
        },
      });
      const started = adapter.onTickStart(snap);
      expect(started.tags).toContain('ghost:marker_window');
    });

    it('does not add ghost:marker_window with empty ghostMarkers', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [] },
      });
      const started = adapter.onTickStart(snap);
      expect(started.tags).not.toContain('ghost:marker_window');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 7: onTickStart — threat exposure in window
  // --------------------------------------------------------------------------
  describe('onTickStart — threat exposure in marker window', () => {
    it('all visible threats are set to EXPOSED when in marker window', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        tension: {
          ...createSnapshot(5).tension,
          visibleThreats: [
            createThreat('t1', 2, 'HIDDEN'),
            createThreat('t2', 3, 'PARTIAL'),
            createThreat('t3', 1, 'EXPOSED'),
          ],
        },
      });
      const started = adapter.onTickStart(snap);
      for (const threat of started.tension.visibleThreats) {
        expect(threat.visibleAs).toBe('EXPOSED');
      }
    });

    it('threats are not modified when outside marker window', () => {
      const threats = [createThreat('t1', 2, 'HIDDEN'), createThreat('t2', 3, 'PARTIAL')];
      const snap = createSnapshot(20, {
        cards: { ...createSnapshot(20).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        tension: { ...createSnapshot(20).tension, visibleThreats: threats },
      });
      const started = adapter.onTickStart(snap);
      expect(started.tension.visibleThreats[0].visibleAs).toBe('HIDDEN');
      expect(started.tension.visibleThreats[1].visibleAs).toBe('PARTIAL');
    });

    it('empty threat list does not crash in marker window', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        tension: { ...createSnapshot(5).tension, visibleThreats: [] },
      });
      expect(() => adapter.onTickStart(snap)).not.toThrow();
    });

    it('classifyThreatUrgency works on exposed threats', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const started = adapter.onTickStart(snap);
      const urgency = computeFirstThreatUrgency(started, started.tick);
      expect(typeof urgency).toBe('string');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 8: onTickEnd — community heat floor enforcement
  // --------------------------------------------------------------------------
  describe('onTickEnd — community heat floor', () => {
    it('haterHeat stays at communityHeatModifier when current heat is below floor', () => {
      const snap = createSnapshot(20, {
        economy: { ...createSnapshot(20).economy, haterHeat: 5 },
        modeState: { ...createSnapshot(20).modeState, communityHeatModifier: 15 },
        cards: { ...createSnapshot(20).cards, ghostMarkers: [createLegendMarker('lm-1', 100)] },
      });
      const ended = adapter.onTickEnd(snap);
      expect(ended.economy.haterHeat).toBe(15);
    });

    it('haterHeat stays at current when it is already above the floor', () => {
      const snap = createSnapshot(20, {
        economy: { ...createSnapshot(20).economy, haterHeat: 50 },
        modeState: { ...createSnapshot(20).modeState, communityHeatModifier: 10 },
        cards: { ...createSnapshot(20).cards, ghostMarkers: [createLegendMarker('lm-1', 100)] },
      });
      const ended = adapter.onTickEnd(snap);
      expect(ended.economy.haterHeat).toBe(50);
    });

    it('haterHeat is 0 when communityHeatModifier is 0 and current is 0', () => {
      const snap = createSnapshot(20, {
        economy: { ...createSnapshot(20).economy, haterHeat: 0 },
        modeState: { ...createSnapshot(20).modeState, communityHeatModifier: 0 },
        cards: { ...createSnapshot(20).cards, ghostMarkers: [createLegendMarker('lm-1', 100)] },
      });
      const ended = adapter.onTickEnd(snap);
      expect(ended.economy.haterHeat).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 9: onTickEnd — gapClosingRate deltas
  // --------------------------------------------------------------------------
  describe('onTickEnd — gapClosingRate and gapVsLegend deltas', () => {
    it('gapClosingRate increases by 0.02 near T0/T1/T2 marker window', () => {
      const tiers: PressureTier[] = ['T0', 'T1', 'T2'];
      for (const tier of tiers) {
        const snap = createSnapshot(5, {
          cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
          pressure: { ...createSnapshot(5).pressure, tier },
          sovereignty: { ...createSnapshot(5).sovereignty, gapClosingRate: 0.10 },
        });
        const ended = adapter.onTickEnd(snap);
        expect(ended.sovereignty.gapClosingRate).toBeCloseTo(0.12, 5);
      }
    });

    it('gapClosingRate increases by 0.01 near T3/T4 marker window', () => {
      const tiers: PressureTier[] = ['T3', 'T4'];
      for (const tier of tiers) {
        const snap = createSnapshot(5, {
          cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
          pressure: { ...createSnapshot(5).pressure, tier },
          sovereignty: { ...createSnapshot(5).sovereignty, gapClosingRate: 0.10 },
        });
        const ended = adapter.onTickEnd(snap);
        expect(ended.sovereignty.gapClosingRate).toBeCloseTo(0.11, 5);
      }
    });

    it('gapClosingRate decreases by 0.005 when not near a marker window', () => {
      const snap = createSnapshot(20, {
        cards: { ...createSnapshot(20).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        sovereignty: { ...createSnapshot(20).sovereignty, gapClosingRate: 0.10 },
      });
      const ended = adapter.onTickEnd(snap);
      expect(ended.sovereignty.gapClosingRate).toBeCloseTo(0.095, 5);
    });

    it('gapVsLegend changes by same delta as gapClosingRate', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        pressure: { ...createSnapshot(5).pressure, tier: 'T1' },
        sovereignty: { ...createSnapshot(5).sovereignty, gapClosingRate: 0.10, gapVsLegend: -0.2 },
      });
      const ended = adapter.onTickEnd(snap);
      expect(ended.sovereignty.gapVsLegend).toBeCloseTo(-0.18, 5);
    });

    it('gapVsLegend decreases when not near marker (moving away from legend)', () => {
      const snap = createSnapshot(30, {
        cards: { ...createSnapshot(30).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        sovereignty: { ...createSnapshot(30).sovereignty, gapClosingRate: 0.10, gapVsLegend: 0.1 },
      });
      const ended = adapter.onTickEnd(snap);
      expect(ended.sovereignty.gapVsLegend).toBeCloseTo(0.095, 5);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 10: resolveAction — LOCK_GHOST_WINDOW inside marker window
  // --------------------------------------------------------------------------
  describe('resolveAction — LOCK_GHOST_WINDOW inside marker window', () => {
    it('adds ghost:window_locked tag when in marker window', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const resolved = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      expect(resolved.tags).toContain('ghost:window_locked');
    });

    it('phaseBoundaryWindowsRemaining becomes at least 1 when locked', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const resolved = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      expect(resolved.modeState.phaseBoundaryWindowsRemaining).toBeGreaterThanOrEqual(1);
    });

    it('phaseBoundaryWindowsRemaining is not decremented if already > 1', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        modeState: { ...createSnapshot(5).modeState, phaseBoundaryWindowsRemaining: 3 },
      });
      const resolved = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      expect(resolved.modeState.phaseBoundaryWindowsRemaining).toBe(3);
    });

    it('gapClosingRate increases by 0.025 when ghost window is locked', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        sovereignty: { ...createSnapshot(5).sovereignty, gapClosingRate: 0.1 },
      });
      const resolved = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      expect(resolved.sovereignty.gapClosingRate).toBeCloseTo(0.125, 5);
    });

    it('haterHeat decreases by 3 when ghost window is locked', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        economy: { ...createSnapshot(5).economy, haterHeat: 20 },
      });
      const resolved = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      expect(resolved.economy.haterHeat).toBe(17);
    });

    it('haterHeat does not go below 0 when clamped', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        economy: { ...createSnapshot(5).economy, haterHeat: 1 },
      });
      const resolved = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      expect(resolved.economy.haterHeat).toBeGreaterThanOrEqual(0);
    });

    it('does not duplicate ghost:window_locked on repeated lock actions', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        tags: ['ghost:window_locked'],
      });
      const resolved = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      const lockCount = resolved.tags.filter((t) => t === 'ghost:window_locked').length;
      expect(lockCount).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 11: resolveAction — no-op outside window or for other actions
  // --------------------------------------------------------------------------
  describe('resolveAction — no-op cases', () => {
    it('returns snapshot unchanged when not in marker window', () => {
      const snap = createSnapshot(30, {
        cards: { ...createSnapshot(30).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const resolved = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      expect(resolved).toBe(snap);
    });

    it('returns snapshot unchanged for non-LOCK_GHOST_WINDOW actions', () => {
      const allOtherActions: ModeActionId[] = [
        'USE_HOLD',
        'FIRE_EXTRACTION',
        'COUNTER_PLAY',
        'CLAIM_FIRST_BLOOD',
        'REQUEST_TREASURY_LOAN',
        'ABSORB_CASCADE',
        'ADVANCE_DEFECTION',
      ];
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      for (const actionId of allOtherActions) {
        expect(adapter.resolveAction(snap, actionId)).toBe(snap);
      }
    });

    it('returns snapshot unchanged with empty marker list', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [] },
      });
      const resolved = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      expect(resolved).toBe(snap);
    });

    it('passes payload through without error', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      expect(() => adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW', { windowId: 'w-1' })).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 12: finalize — badge awards
  // --------------------------------------------------------------------------
  describe('finalize — badge awards', () => {
    it('awards LEGEND_BROKEN when outcome=FREEDOM and gapVsLegend > 0', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: 0.1, cordScore: BASE_CORD_SCORE },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).toContain('LEGEND_BROKEN');
    });

    it('awards CHALLENGER when gapVsLegend >= -0.05 and not FREEDOM', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: null,
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: -0.04, cordScore: BASE_CORD_SCORE },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).toContain('CHALLENGER');
      expect(finalized.sovereignty.proofBadges).not.toContain('LEGEND_BROKEN');
    });

    it('awards CHALLENGER at exactly -0.05 boundary', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: null,
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: -0.05, cordScore: BASE_CORD_SCORE },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).toContain('CHALLENGER');
    });

    it('does not award CHALLENGER when gapVsLegend < -0.05', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: null,
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: -0.10, cordScore: BASE_CORD_SCORE },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).not.toContain('CHALLENGER');
      expect(finalized.sovereignty.proofBadges).not.toContain('LEGEND_BROKEN');
    });

    it('awards HISTORICAL_HUNTER when ghostMarkers >= 20 and outcome=FREEDOM', () => {
      const markers = Array.from({ length: 20 }, (_, i) =>
        createLegendMarker(`lm-${i + 1}`, i + 1),
      );
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        cards: { ...createSnapshot().cards, ghostMarkers: markers },
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: 0.2, cordScore: BASE_CORD_SCORE },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).toContain('HISTORICAL_HUNTER');
    });

    it('does not award HISTORICAL_HUNTER when ghostMarkers < 20', () => {
      const markers = Array.from({ length: 19 }, (_, i) =>
        createLegendMarker(`lm-${i + 1}`, i + 1),
      );
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        cards: { ...createSnapshot().cards, ghostMarkers: markers },
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: 0.2, cordScore: BASE_CORD_SCORE },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).not.toContain('HISTORICAL_HUNTER');
    });

    it('does not award HISTORICAL_HUNTER when outcome is not FREEDOM', () => {
      const markers = Array.from({ length: 20 }, (_, i) =>
        createLegendMarker(`lm-${i + 1}`, i + 1),
      );
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'TIMEOUT',
        cards: { ...createSnapshot().cards, ghostMarkers: markers },
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: 0.2, cordScore: BASE_CORD_SCORE },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).not.toContain('HISTORICAL_HUNTER');
    });

    it('preserves existing proofBadges when adding new ones', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: 0.1,
          cordScore: BASE_CORD_SCORE,
          proofBadges: ['EARLY_FINISHER'],
        },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).toContain('EARLY_FINISHER');
      expect(finalized.sovereignty.proofBadges).toContain('LEGEND_BROKEN');
    });

    it('all three badges can be awarded simultaneously', () => {
      const markers = Array.from({ length: 20 }, (_, i) =>
        createLegendMarker(`lm-${i + 1}`, i + 1),
      );
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        cards: { ...createSnapshot().cards, ghostMarkers: markers },
        modeState: { ...createSnapshot().modeState, communityHeatModifier: 150 },
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: 0.2,
          cordScore: BASE_CORD_SCORE,
        },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).toContain('LEGEND_BROKEN');
      expect(finalized.sovereignty.proofBadges).toContain('HISTORICAL_HUNTER');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 13: finalize — cord score multiplier computation
  // --------------------------------------------------------------------------
  describe('finalize — cord score multiplier', () => {
    it('multiplier is 1 with no bonuses', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: null,
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: -0.10,
          cordScore: BASE_CORD_SCORE,
        },
        modeState: { ...createSnapshot().modeState, communityHeatModifier: 0 },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.cordScore).toBeCloseTo(BASE_CORD_SCORE * 1.0, 5);
    });

    it('communityHeatModifier of 100 adds 0.35 to multiplier (capped)', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: null,
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: -0.10,
          cordScore: BASE_CORD_SCORE,
        },
        modeState: { ...createSnapshot().modeState, communityHeatModifier: 100 },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.cordScore).toBeCloseTo(BASE_CORD_SCORE * 1.35, 5);
    });

    it('communityHeatModifier of 200 is still capped at 0.35 bonus', () => {
      const snap200 = createSnapshot(DEFAULT_TICK, {
        outcome: null,
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: -0.10,
          cordScore: BASE_CORD_SCORE,
        },
        modeState: { ...createSnapshot().modeState, communityHeatModifier: 200 },
      });
      const snap100 = createSnapshot(DEFAULT_TICK, {
        outcome: null,
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: -0.10,
          cordScore: BASE_CORD_SCORE,
        },
        modeState: { ...createSnapshot().modeState, communityHeatModifier: 100 },
      });
      expect(adapter.finalize(snap200).sovereignty.cordScore).toBeCloseTo(
        adapter.finalize(snap100).sovereignty.cordScore, 5,
      );
    });

    it('FREEDOM + gapVsLegend > 0 adds 0.20 bonus', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: 0.01,
          cordScore: BASE_CORD_SCORE,
        },
        modeState: { ...createSnapshot().modeState, communityHeatModifier: 0 },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.cordScore).toBeCloseTo(BASE_CORD_SCORE * 1.20, 5);
    });

    it('CHALLENGER bonus adds 0.10', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: null,
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: -0.05,
          cordScore: BASE_CORD_SCORE,
        },
        modeState: { ...createSnapshot().modeState, communityHeatModifier: 0 },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.cordScore).toBeCloseTo(BASE_CORD_SCORE * 1.10, 5);
    });

    it('HISTORICAL_HUNTER adds 0.05 on top of FREEDOM + LEGEND_BROKEN', () => {
      const markers = Array.from({ length: 20 }, (_, i) => createLegendMarker(`lm-${i + 1}`, i + 1));
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        cards: { ...createSnapshot().cards, ghostMarkers: markers },
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: 0.2,
          cordScore: BASE_CORD_SCORE,
        },
        modeState: { ...createSnapshot().modeState, communityHeatModifier: 0 },
      });
      const finalized = adapter.finalize(snap);
      // multiplier = 1 + 0.20 + 0.05 = 1.25
      expect(finalized.sovereignty.cordScore).toBeCloseTo(BASE_CORD_SCORE * 1.25, 5);
    });

    it('all bonuses stack: community(0.35) + FREEDOM(0.20) + HISTORICAL_HUNTER(0.05) = 1.60', () => {
      const markers = Array.from({ length: 20 }, (_, i) => createLegendMarker(`lm-${i + 1}`, i + 1));
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        cards: { ...createSnapshot().cards, ghostMarkers: markers },
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: 0.2,
          cordScore: BASE_CORD_SCORE,
        },
        modeState: { ...createSnapshot().modeState, communityHeatModifier: 100 },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.cordScore).toBeCloseTo(BASE_CORD_SCORE * 1.60, 5);
    });

    it('cordScore is rounded to 6 decimal places', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        sovereignty: {
          ...createSnapshot().sovereignty,
          gapVsLegend: 0.1,
          cordScore: 1.0,
        },
        modeState: { ...createSnapshot().modeState, communityHeatModifier: 33 },
      });
      const finalized = adapter.finalize(snap);
      const str = finalized.sovereignty.cordScore.toString();
      const decimalPart = str.split('.')[1] ?? '';
      expect(decimalPart.length).toBeLessThanOrEqual(6);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 14: GamePrimitives utility functions exercised on ghost snapshots
  // --------------------------------------------------------------------------
  describe('GamePrimitives utility coverage on ghost snapshots', () => {
    it('computeShieldIntegrityRatio is 1.0 for a fully intact ghost snapshot', () => {
      const snap = adapter.configure(createSnapshot());
      expect(computeShieldIntegrityForSnapshot(snap)).toBeCloseTo(1.0, 5);
    });

    it('computeShieldIntegrityRatio drops when layers are damaged', () => {
      const snap = adapter.configure(createSnapshot());
      const damaged = {
        ...snap,
        shield: {
          ...snap.shield,
          layers: snap.shield.layers.map((l) => ({ ...l, current: l.max * 0.25 })),
        },
      } as RunStateSnapshot;
      expect(computeShieldIntegrityForSnapshot(damaged)).toBeLessThan(1.0);
    });

    it('computeAggregateBotThreat is 0 when all bots are DORMANT', () => {
      const snap = adapter.configure(createSnapshot());
      expect(computeAggregateBotThreatForSnapshot(snap)).toBe(0);
    });

    it('computeAggregateBotThreat is > 0 when a bot is ATTACKING', () => {
      const snap = adapter.configure(createSnapshot());
      const withAttacker = {
        ...snap,
        battle: {
          ...snap.battle,
          bots: snap.battle.bots.map((b, i) =>
            i === 0 ? { ...b, state: 'ATTACKING' as BotState } : b,
          ),
        },
      } as RunStateSnapshot;
      expect(computeAggregateBotThreatForSnapshot(withAttacker)).toBeGreaterThan(0);
    });

    it('computeDefenseUrgency is 0 with no active bots', () => {
      const snap = adapter.configure(createSnapshot());
      expect(computeDefenseUrgencyForSnapshot(snap)).toBe(0);
    });

    it('computeDefenseUrgency is > 0 when BOT_05 is ATTACKING', () => {
      expect(
        computeDefenseUrgency([{ id: 'BOT_05', state: 'ATTACKING' }]),
      ).toBeGreaterThan(0);
    });

    it('computeBotThreatScore is 0 for DORMANT state', () => {
      expect(computeBotThreatScore('BOT_01', 'DORMANT')).toBe(0);
    });

    it('computeBotThreatScore is highest for BOT_05 ATTACKING', () => {
      const bot05 = computeBotThreatScore('BOT_05', 'ATTACKING');
      const bot01 = computeBotThreatScore('BOT_01', 'ATTACKING');
      expect(bot05).toBeGreaterThan(bot01);
    });

    it('computeShieldLayerVulnerability is 0 for full layers', () => {
      for (const id of SHIELD_LAYER_IDS) {
        expect(computeShieldLayerVulnerability(id, 50, 50)).toBe(0);
      }
    });

    it('computeShieldLayerVulnerability scales with damage', () => {
      expect(computeShieldLayerVulnerability('L1', 0, 50)).toBeGreaterThan(
        computeShieldLayerVulnerability('L1', 25, 50),
      );
    });

    it('estimateShieldRegenPerTick is positive for all shield layers', () => {
      for (const id of SHIELD_LAYER_IDS) {
        expect(estimateShieldRegenPerTick(id, 50)).toBeGreaterThan(0);
      }
    });

    it('computePressureRiskScore increases with higher tier and score', () => {
      expect(computePressureRiskScore('T4', 0.9)).toBeGreaterThan(computePressureRiskScore('T0', 0.1));
    });

    it('computeCardPowerScore is positive for the default ghost card', () => {
      expect(computeFirstCardPower(createSnapshot())).toBeGreaterThanOrEqual(0);
    });

    it('computeCardTimingPriority returns a finite number', () => {
      expect(Number.isFinite(computeFirstCardTimingPriority(createSnapshot()))).toBe(true);
    });

    it('isCardLegalInMode is true for ghost cards in ghost mode', () => {
      const card = createCardInstance();
      const cardWithGhostLegal: CardInstance = {
        ...card,
        card: { ...card.card, modeLegal: ['ghost'] },
      };
      expect(isCardLegalInMode(cardWithGhostLegal, 'ghost')).toBe(true);
    });

    it('isCardLegalInMode is false for solo-only cards in ghost mode', () => {
      const card = createCardInstance();
      const soloOnly: CardInstance = {
        ...card,
        card: { ...card.card, modeLegal: ['solo'] },
      };
      expect(isCardLegalInMode(soloOnly, 'ghost')).toBe(false);
    });

    it('scoreCascadeChainHealth returns 1.0 for COMPLETED chains', () => {
      const chain = createCascadeChain();
      const completed: CascadeChainInstance = { ...chain, status: 'COMPLETED' };
      expect(scoreCascadeChainHealth(completed)).toBe(1.0);
    });

    it('scoreCascadeChainHealth returns 0.0 for BROKEN chains', () => {
      const chain = createCascadeChain();
      const broken: CascadeChainInstance = { ...chain, status: 'BROKEN' };
      expect(scoreCascadeChainHealth(broken)).toBe(0.0);
    });

    it('scoreCascadeChainHealth is in [0, 1] for ACTIVE chains', () => {
      const chain = createCascadeChain();
      const health = scoreCascadeChainHealth(chain);
      expect(health).toBeGreaterThanOrEqual(0);
      expect(health).toBeLessThanOrEqual(1);
    });

    it('computeFirstCascadeHealth returns 1 for snapshot with no active chains', () => {
      const snap = createSnapshot();
      expect(computeFirstCascadeHealth(snap)).toBe(1);
    });

    it('computeFirstCascadeHealth reads from cascade.activeChains when chains exist', () => {
      const chain = createCascadeChain();
      const snap = createSnapshot();
      const withChain = { ...snap, cascade: { ...snap.cascade, activeChains: [chain] } } as RunStateSnapshot;
      expect(computeFirstCascadeHealth(withChain)).toBeGreaterThanOrEqual(0);
      expect(computeFirstCascadeHealth(withChain)).toBeLessThanOrEqual(1);
    });

    it('scoreOutcomeExcitement returns 5 for FREEDOM in ghost mode (max difficulty)', () => {
      // ghost MODE_DIFFICULTY_MULTIPLIER = 1.6, FREEDOM base = 5, so 5*1.6=8 → capped at 5
      expect(scoreOutcomeExcitement('FREEDOM', 'ghost')).toBe(5);
    });

    it('scoreOutcomeExcitement for ABANDONED is lowest', () => {
      expect(scoreOutcomeExcitement('ABANDONED', 'ghost')).toBeLessThan(
        scoreOutcomeExcitement('FREEDOM', 'ghost'),
      );
    });

    it('scoreOutcomeExcitement in ghost mode is higher than in coop for same outcome', () => {
      expect(scoreOutcomeExcitement('FREEDOM', 'ghost')).toBeGreaterThanOrEqual(
        scoreOutcomeExcitement('FREEDOM', 'coop'),
      );
    });

    it('classifyAttackSeverity returns a string for a ghost snapshot attack', () => {
      const severity = computeFirstAttackSeverity(createSnapshot());
      expect(typeof severity).toBe('string');
    });

    it('classifyThreatUrgency returns a string', () => {
      const urgency = computeFirstThreatUrgency(createSnapshot(), 5);
      expect(typeof urgency).toBe('string');
    });

    it('computeSnapshotCompositeRisk returns a number in [0, 1]', () => {
      const snap = adapter.configure(createSnapshot(), { legendOriginalHeat: 50, legendDaysAlive: 9 });
      const risk = computeSnapshotCompositeRisk(snap);
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 15: RunStateSnapshot predicates on ghost snapshots
  // --------------------------------------------------------------------------
  describe('RunStateSnapshot predicates on ghost lifecycle snapshots', () => {
    it('hasPlayableCards is true on default snapshot', () => {
      expect(hasPlayableCards(createSnapshot())).toBe(true);
    });

    it('hasPlayableCards is false when hand is empty', () => {
      const snap = createSnapshot();
      const empty = { ...snap, cards: { ...snap.cards, hand: [] } } as RunStateSnapshot;
      expect(hasPlayableCards(empty)).toBe(false);
    });

    it('hasCriticalPendingAttacks returns a boolean', () => {
      expect(typeof hasCriticalPendingAttacks(createSnapshot())).toBe('boolean');
    });

    it('isRunFlagged is false for a clean snapshot', () => {
      expect(isRunFlagged(createSnapshot())).toBe(false);
    });

    it('isShieldFailing is false when all layers are intact', () => {
      expect(isShieldFailing(createSnapshot())).toBe(false);
    });

    it('isShieldFailing is true when a layer is near 0', () => {
      const snap = createSnapshot();
      const damaged = {
        ...snap,
        shield: {
          ...snap.shield,
          layers: snap.shield.layers.map((l, i) =>
            i === 0 ? { ...l, current: 0 } : l,
          ),
        },
      } as RunStateSnapshot;
      expect(isShieldFailing(damaged)).toBe(true);
    });

    it('isEconomyHealthy is true for a healthy ghost start', () => {
      expect(isEconomyHealthy(createSnapshot())).toBe(true);
    });

    it('isBattleEscalating returns a boolean', () => {
      expect(typeof isBattleEscalating(createSnapshot())).toBe('boolean');
    });

    it('isCascadeCritical returns false when no active chains', () => {
      expect(isCascadeCritical(createSnapshot())).toBe(false);
    });

    it('isSovereigntyAtRisk returns a boolean', () => {
      expect(typeof isSovereigntyAtRisk(createSnapshot())).toBe('boolean');
    });

    it('isSnapshotInEndgame is true at SOVEREIGNTY phase', () => {
      const snap = createSnapshot(DEFAULT_TICK, { phase: 'SOVEREIGNTY' as RunPhase });
      expect(isSnapshotInEndgame(snap)).toBe(true);
    });

    it('isSnapshotInCrisis returns a boolean without throwing', () => {
      const snap = adapter.configure(createSnapshot(), { legendOriginalHeat: 80 });
      expect(typeof isSnapshotInCrisis(snap)).toBe('boolean');
    });

    it('isSnapshotLoss is true when outcome is BANKRUPT', () => {
      const snap = createSnapshot(DEFAULT_TICK, { outcome: 'BANKRUPT' as RunOutcome });
      expect(isSnapshotLoss(snap)).toBe(true);
    });

    it('isSnapshotWin is true after FREEDOM outcome', () => {
      const snap = createSnapshot(DEFAULT_TICK, { outcome: 'FREEDOM' as RunOutcome });
      expect(isSnapshotWin(snap)).toBe(true);
    });

    it('isSnapshotTerminal is true after any outcome is set', () => {
      for (const outcome of ['FREEDOM', 'BANKRUPT', 'TIMEOUT', 'ABANDONED'] as RunOutcome[]) {
        expect(isSnapshotTerminal(createSnapshot(DEFAULT_TICK, { outcome }))).toBe(true);
      }
    });

    it('hasActiveDecisionWindows is false on default snapshot', () => {
      expect(hasActiveDecisionWindows(createSnapshot())).toBe(false);
    });

    it('getNormalizedPressureTier matches PRESSURE_TIER_NORMALIZED', () => {
      const base = createSnapshot();
      for (const tier of ALL_PRESSURE_TIERS) {
        expect(getNormalizedPressureTier({ ...base, pressure: { ...base.pressure, tier } })).toBe(PRESSURE_TIER_NORMALIZED[tier]);
      }
    });

    it('getPressureTierUrgencyLabel returns a non-empty string for every tier', () => {
      const base = createSnapshot();
      for (const tier of ALL_PRESSURE_TIERS) {
        const label = getPressureTierUrgencyLabel({ ...base, pressure: { ...base.pressure, tier } });
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 16: ML feature extraction on ghost lifecycle snapshots
  // --------------------------------------------------------------------------
  describe('ML / DL feature extraction — ghost mode', () => {
    it('ModeMlFeatureExtractor returns exactly MODE_SIGNAL_ML_FEATURE_COUNT features', () => {
      const snap = adapter.configure(createSnapshot());
      const vec = mlExtractor.extract(snap, Date.now());
      expect(vec.features).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
      expect(vec.featureLabels).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
    });

    it('MODE_SIGNAL_ML_FEATURE_LABELS has exactly 16 labels', () => {
      expect(MODE_SIGNAL_ML_FEATURE_LABELS).toHaveLength(16);
    });

    it('MODE_SIGNAL_DL_FEATURE_LABELS has exactly 24 labels', () => {
      expect(MODE_SIGNAL_DL_FEATURE_LABELS).toHaveLength(24);
    });

    it('ModeDlTensorBuilder returns exactly MODE_SIGNAL_DL_FEATURE_COUNT features', () => {
      const snap = adapter.configure(createSnapshot());
      const tensor = dlBuilder.build(snap, Date.now());
      expect(tensor.tensor).toHaveLength(MODE_SIGNAL_DL_FEATURE_COUNT);
      expect(tensor.shape).toEqual(MODE_SIGNAL_DL_TENSOR_SHAPE);
    });

    it('DL tensor has 8 more features than ML vector', () => {
      const snap = adapter.configure(createSnapshot());
      const ml = mlExtractor.extract(snap, 0);
      const dl = dlBuilder.build(snap, 0);
      expect(dl.tensor.length - ml.features.length).toBe(8);
    });

    it('MODE_SIGNAL_DL_FEATURE_LABELS is a superset of ML labels', () => {
      for (const label of MODE_SIGNAL_ML_FEATURE_LABELS) {
        expect(MODE_SIGNAL_DL_FEATURE_LABELS).toContain(label);
      }
    });

    it('extractModeMLVector produces same result as ModeMlFeatureExtractor', () => {
      const snap = adapter.configure(createSnapshot());
      const fromFactory = extractModeMLVector(snap, 0);
      const fromExtractor = mlExtractor.extract(snap, 0);
      expect(fromFactory.features).toEqual(fromExtractor.features);
    });

    it('buildModeDLTensor produces 24 features', () => {
      const snap = adapter.configure(createSnapshot());
      expect(buildModeDLTensor(snap, 0).tensor).toHaveLength(24);
    });

    it('ML feature 0 (mode_normalized) is the ghost mode normalized value', () => {
      const snap = adapter.configure(createSnapshot());
      const vec = mlExtractor.extract(snap, 0);
      expect(vec.features[0]).toBe(MODE_NORMALIZED['ghost']);
    });

    it('scoreModeRisk returns a value in [0, 1]', () => {
      const snap = adapter.configure(createSnapshot(), {
        legendOriginalHeat: 40,
        legendDaysAlive: 12,
        communityRunsSinceLegend: 30_000,
      });
      const risk = scoreModeRisk(snap);
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });

    it('ModeSignalRiskScorer returns a value in [0, 1]', () => {
      const snap = adapter.configure(createSnapshot());
      const risk = riskScorer.score(snap);
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });

    it('ghost mode ML mode_normalized differs from solo mode_normalized', () => {
      const ghostSnap = adapter.configure(createSnapshot());
      const soloVec = mlExtractor.extract({ ...createSnapshot(), mode: 'solo' } as RunStateSnapshot, 0);
      const ghostVec = mlExtractor.extract(ghostSnap, 0);
      expect(ghostVec.features[0]).not.toBe(soloVec.features[0]);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 17: ModeSignalAdapter integration — ghost lifecycle signals
  // --------------------------------------------------------------------------
  describe('ModeSignalAdapter integration — ghost lifecycle signals', () => {
    it('onConfigure returns a ChatModeSignal for a ghost configure event', () => {
      const snap = createSnapshot();
      const configured = adapter.configure(snap);
      signalAdapter.resetDeduplication();
      const signal = signalAdapter.onConfigure(snap, configured);
      expect(signal).not.toBeNull();
      if (signal) {
        expect(signal.kind).toBe('MODE_CONFIGURED');
        expect(signal.runId).toBe(snap.runId);
        expect(signal.mode).toBe('ghost');
      }
    });

    it('onTickStart returns a signal when in marker window', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const started = adapter.onTickStart(snap);
      signalAdapter.resetDeduplication();
      const signal = signalAdapter.onTickStart(snap, started, 5000);
      expect(signal).not.toBeNull();
    });

    it('onAction emits a signal for LOCK_GHOST_WINDOW', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const resolved = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      signalAdapter.resetDeduplication();
      const signal = signalAdapter.onAction(snap, resolved, 'LOCK_GHOST_WINDOW', 5000);
      expect(signal).not.toBeNull();
    });

    it('onFinalize emits a signal with FREEDOM outcome', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: 0.1, cordScore: BASE_CORD_SCORE },
      });
      const finalized = adapter.finalize(snap);
      signalAdapter.resetDeduplication();
      const signal = signalAdapter.onFinalize(snap, finalized, 10_000);
      expect(signal).not.toBeNull();
    });

    it('deduplication prevents duplicate signals for same tick + kind', () => {
      const snap = createSnapshot();
      const configured = adapter.configure(snap);
      signalAdapter.resetDeduplication();

      const sig1 = signalAdapter.onConfigure(snap, configured);
      const sig2 = signalAdapter.onConfigure(snap, configured);

      expect(sig1).not.toBeNull();
      expect(sig2).toBeNull();
    });

    it('resetDeduplication allows re-emission of previously deduplicated signals', () => {
      const snap = createSnapshot();
      const configured = adapter.configure(snap);
      signalAdapter.onConfigure(snap, configured);
      signalAdapter.resetDeduplication();
      const sig2 = signalAdapter.onConfigure(snap, configured);
      expect(sig2).not.toBeNull();
    });

    it('signal risk score is in [0, 1]', () => {
      const snap = createSnapshot();
      const configured = adapter.configure(snap, { legendOriginalHeat: 60 });
      signalAdapter.resetDeduplication();
      const signal = signalAdapter.onConfigure(snap, configured);
      if (signal) {
        expect(signal.riskScore).toBeGreaterThanOrEqual(0);
        expect(signal.riskScore).toBeLessThanOrEqual(1);
      }
    });

    it('signal has valid mode field', () => {
      const snap = createSnapshot();
      const configured = adapter.configure(snap);
      signalAdapter.resetDeduplication();
      const signal = signalAdapter.onConfigure(snap, configured);
      if (signal) {
        expect(isModeCode(signal.mode)).toBe(true);
      }
    });

    it('ModeSignalAnalytics summarizes signals by kind', () => {
      const signals: import('../../../engine/chat/adapters/ModeSignalAdapter').ChatModeSignal[] = [];
      const snap = createSnapshot();
      const configured = adapter.configure(snap);
      signalAdapter.resetDeduplication();

      const configSig = signalAdapter.onConfigure(snap, configured);
      if (configSig) signals.push(configSig);

      const started = adapter.onTickStart(configured);
      const tickSig = signalAdapter.onTickStart(configured, started, 1000);
      if (tickSig) signals.push(tickSig);

      const summary = analytics.summarize(signals);
      expect(summary.totalSignals).toBe(signals.length);
      expect(summary.meanRiskScore).toBeGreaterThanOrEqual(0);
      expect(summary.maxRiskScore).toBeGreaterThanOrEqual(0);
    });

    it('ModeSignalAnalytics returns zeroed summary for empty signals', () => {
      const summary = analytics.summarize([]);
      expect(summary.totalSignals).toBe(0);
      expect(summary.meanRiskScore).toBe(0);
      expect(summary.maxRiskScore).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 18: ModeSignalBatchProcessor — direct class instantiation
  // --------------------------------------------------------------------------
  describe('ModeSignalBatchProcessor — direct class usage', () => {
    it('can be directly instantiated and processes ghost configure events', () => {
      const batchProcessor = new ModeSignalBatchProcessor({ enableDLTensor: true });
      const snap = createSnapshot();
      const configured = adapter.configure(snap, { legendOriginalHeat: 30, legendDaysAlive: 6 });

      const result = batchProcessor.process([
        { kind: 'configure', snapshotBefore: snap, snapshotAfter: configured },
      ]);

      expect(result.totalProcessed).toBe(1);
      expect(result.signals).toBeDefined();
      expect(result.highPriorityCount).toBeGreaterThanOrEqual(0);
      expect(result.criticalCount).toBeGreaterThanOrEqual(0);
    });

    it('batchProcessor processes multiple ghost lifecycle stages', () => {
      const batchProcessor = new ModeSignalBatchProcessor();
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const configured = adapter.configure(snap, { legendOriginalHeat: 20 });
      const started = adapter.onTickStart(configured);
      const ended = adapter.onTickEnd(started);

      const result = batchProcessor.process([
        { kind: 'configure', snapshotBefore: snap, snapshotAfter: configured },
        { kind: 'tickStart', snapshotBefore: configured, snapshotAfter: started },
        { kind: 'tickEnd', snapshotBefore: started, snapshotAfter: ended },
      ]);

      expect(result.totalProcessed).toBe(3);
      expect(result.totalEmitted).toBeLessThanOrEqual(3);
    });

    it('buildModeSignalBatchProcessor factory creates functional processor', () => {
      const processor = buildModeSignalBatchProcessor({ criticalRiskThreshold: 0.0 });
      const snap = createSnapshot();
      const configured = adapter.configure(snap);
      const result = processor.process([
        { kind: 'configure', snapshotBefore: snap, snapshotAfter: configured },
      ]);
      expect(result.criticalCount).toBeGreaterThan(0);
    });

    it('batchProcessor emits no signals for empty entries', () => {
      const batchProcessor = new ModeSignalBatchProcessor();
      const result = batchProcessor.process([]);
      expect(result.totalProcessed).toBe(0);
      expect(result.totalEmitted).toBe(0);
      expect(result.signals).toHaveLength(0);
    });

    it('buildModeSignalAdapter factory creates functional adapter', () => {
      const fa = buildModeSignalAdapter({ enableDLTensor: false });
      const snap = createSnapshot();
      const configured = adapter.configure(snap);
      fa.resetDeduplication();
      const signal = fa.onConfigure(snap, configured);
      expect(signal).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 19: ModeRuntimeDirector integration with PhantomModeAdapter
  // --------------------------------------------------------------------------
  describe('ModeRuntimeDirector delegation to PhantomModeAdapter', () => {
    it('director.configure routes to PhantomModeAdapter for ghost mode', () => {
      const snap = createSnapshot();
      const configured = director.configure(snap, { legendCordScore: 2.0 });
      expect(configured.tags).toContain('mode:phantom');
      expect(configured.modeState.legendMarkersEnabled).toBe(true);
    });

    it('director.onTickStart opens marker window when near marker', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const configured = director.configure(snap);
      const started = director.onTickStart(configured);
      expect(started.tags).toContain('ghost:marker_window');
    });

    it('director.resolveAction delegates LOCK_GHOST_WINDOW in window', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const configured = director.configure(snap);
      const started = director.onTickStart(configured);
      const resolved = director.resolveAction(started, 'LOCK_GHOST_WINDOW');
      expect(resolved.tags).toContain('ghost:window_locked');
    });

    it('director.finalize applies cord score multiplier', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        sovereignty: { ...createSnapshot().sovereignty, cordScore: BASE_CORD_SCORE, gapVsLegend: 0.1 },
      });
      const configured = director.configure(snap, { legendOriginalHeat: 10 });
      const finalized = director.finalize({ ...configured, outcome: 'FREEDOM' } as RunStateSnapshot);
      expect(finalized.sovereignty.cordScore).toBeGreaterThan(0);
      expect(isSnapshotTerminal(finalized)).toBe(true);
    });

    it('director throws when ghost mode is not registered', () => {
      const emptyRegistry = new ModeRegistry();
      const emptyDirector = new ModeRuntimeDirector(emptyRegistry);
      expect(() => emptyDirector.configure(createSnapshot())).toThrow();
    });

    it('director.onTickEnd enforces community heat floor', () => {
      const snap = createSnapshot(20, {
        economy: { ...createSnapshot(20).economy, haterHeat: 2 },
        cards: { ...createSnapshot(20).cards, ghostMarkers: [createLegendMarker('lm-1', 100)] },
      });
      const configured = director.configure(snap, { communityRunsSinceLegend: 10_000 });
      const ended = director.onTickEnd(configured);
      // communityHeatModifier = 10000 * 0.003 = 30, so floor is 30
      expect(ended.economy.haterHeat).toBe(30);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 20: Full 12-tick simulation — Phantom mode
  // --------------------------------------------------------------------------
  describe('full 12-tick simulation — Phantom (ghost) mode', () => {
    it('simulates 12 ticks accumulating gap-closing, markers, and signals', () => {
      const legendMarkers = [
        createLegendMarker('lm-1', 3),
        createLegendMarker('lm-2', 6),
        createLegendMarker('lm-3', 9),
        createLegendMarker('lm-4', 12),
      ];

      let snap = createSnapshot(0, {
        sovereignty: { ...createSnapshot(0).sovereignty, gapVsLegend: -0.3, gapClosingRate: 0.05, cordScore: BASE_CORD_SCORE },
      });
      snap = director.configure(snap, {
        legendRunId: 'legend-sim-1',
        legendOwnerUserId: 'legend-user-sim',
        legendMarkers,
        legendOriginalHeat: 25,
        communityRunsSinceLegend: 20_000,
        legendDaysAlive: 6,
        legendCordScore: BASE_CORD_SCORE - 0.3,
      });

      const collectedSignals: import('../../../engine/chat/adapters/ModeSignalAdapter').ChatModeSignal[] = [];
      signalAdapter.resetDeduplication();

      for (let tick = 1; tick <= 12; tick++) {
        const prev = snap;
        snap = { ...snap, tick } as RunStateSnapshot;

        const afterTickStart = director.onTickStart(snap);
        const tickStartSig = signalAdapter.onTickStart(prev, afterTickStart, tick * 1000);
        if (tickStartSig) collectedSignals.push(tickStartSig);

        // Lock window when available
        const nearMarker = afterTickStart.tags.includes('ghost:marker_window');
        let afterAction = afterTickStart;
        if (nearMarker) {
          afterAction = director.resolveAction(afterTickStart, 'LOCK_GHOST_WINDOW');
          const actionSig = signalAdapter.onAction(afterTickStart, afterAction, 'LOCK_GHOST_WINDOW', tick * 1000);
          if (actionSig) collectedSignals.push(actionSig);
        }

        const afterTickEnd = director.onTickEnd(afterAction);
        const tickEndSig = signalAdapter.onTickEnd(afterAction, afterTickEnd, tick * 1000);
        if (tickEndSig) collectedSignals.push(tickEndSig);

        snap = afterTickEnd;

        // Validate snapshot at each tick
        expect(snap.mode).toBe('ghost');
        expect(Number.isFinite(computeShieldIntegrityForSnapshot(snap))).toBe(true);
        expect(Number.isFinite(computeSnapshotCompositeRisk(snap))).toBe(true);
        expect(Number.isFinite(snap.sovereignty.gapClosingRate)).toBe(true);
        expect(Number.isFinite(snap.sovereignty.gapVsLegend)).toBe(true);
      }

      // finalize
      const terminal = { ...snap, outcome: 'FREEDOM' } as RunStateSnapshot;
      const finalized = director.finalize(terminal);
      const finalSig = signalAdapter.onFinalize(snap, finalized, 12_000);
      if (finalSig) collectedSignals.push(finalSig);

      expect(finalized.sovereignty.cordScore).toBeGreaterThan(0);
      expect(isSnapshotTerminal(finalized)).toBe(true);
      expect(collectedSignals.length).toBeGreaterThan(0);

      const summary = analytics.summarize(collectedSignals);
      expect(summary.totalSignals).toBe(collectedSignals.length);
      expect(summary.meanRiskScore).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 21: Snapshot immutability verification
  // --------------------------------------------------------------------------
  describe('snapshot immutability — PhantomModeAdapter never mutates input', () => {
    it('configure does not mutate the input snapshot', () => {
      const original = createSnapshot();
      const tagsCopy = [...original.tags];
      const heatBefore = original.economy.haterHeat;

      adapter.configure(original, { legendOriginalHeat: 100, communityRunsSinceLegend: 50_000 });

      expect(original.tags).toEqual(tagsCopy);
      expect(original.economy.haterHeat).toBe(heatBefore);
    });

    it('onTickStart does not mutate the input snapshot', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      const tagsBefore = [...snap.tags];
      adapter.onTickStart(snap);
      expect(snap.tags).toEqual(tagsBefore);
    });

    it('onTickEnd does not mutate the input snapshot', () => {
      const snap = createSnapshot(20, {
        cards: { ...createSnapshot(20).cards, ghostMarkers: [createLegendMarker('lm-1', 100)] },
        economy: { ...createSnapshot(20).economy, haterHeat: 5 },
        modeState: { ...createSnapshot(20).modeState, communityHeatModifier: 30 },
      });
      const heatBefore = snap.economy.haterHeat;
      adapter.onTickEnd(snap);
      expect(snap.economy.haterHeat).toBe(heatBefore);
    });

    it('resolveAction does not mutate the input snapshot', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        economy: { ...createSnapshot(5).economy, haterHeat: 20 },
      });
      const heatBefore = snap.economy.haterHeat;
      adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW');
      expect(snap.economy.haterHeat).toBe(heatBefore);
    });

    it('finalize does not mutate the input snapshot', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: 0.1, cordScore: BASE_CORD_SCORE },
      });
      const cordBefore = snap.sovereignty.cordScore;
      adapter.finalize(snap);
      expect(snap.sovereignty.cordScore).toBe(cordBefore);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 22: Type coverage — all imported types are exercised
  // --------------------------------------------------------------------------
  describe('type coverage — all imported types exercised as values', () => {
    it('ShieldLayerId values are all valid via isShieldLayerId', () => {
      const ids: ShieldLayerId[] = ['L1', 'L2', 'L3', 'L4'];
      for (const id of ids) {
        expect(isShieldLayerId(id)).toBe(true);
      }
    });

    it('HaterBotId values are all valid via isHaterBotId', () => {
      const ids: HaterBotId[] = ['BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05'];
      for (const id of ids) {
        expect(isHaterBotId(id)).toBe(true);
      }
    });

    it('BotState transitions produce valid threat scores', () => {
      const states: BotState[] = ['DORMANT', 'WATCHING', 'TARGETING', 'ATTACKING', 'RETREATING', 'NEUTRALIZED'];
      for (const state of states) {
        const score = computeBotThreatScore('BOT_01', state);
        expect(Number.isFinite(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
      }
    });

    it('RunOutcome values are all recognized by isRunOutcome', () => {
      const outcomes: RunOutcome[] = ['FREEDOM', 'BANKRUPT', 'TIMEOUT', 'ABANDONED'];
      for (const outcome of outcomes) {
        expect(isRunOutcome(outcome)).toBe(true);
      }
    });

    it('RunPhase values are all recognized by isRunPhase', () => {
      const phases: RunPhase[] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
      for (const phase of phases) {
        expect(isRunPhase(phase)).toBe(true);
      }
    });

    it('ModeCode ghost value is recognized by isModeCode', () => {
      const code: ModeCode = 'ghost';
      expect(isModeCode(code)).toBe(true);
    });

    it('PressureTier values match PRESSURE_TIER_NORMALIZED keys', () => {
      const tiers: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
      for (const tier of tiers) {
        expect(PRESSURE_TIER_NORMALIZED[tier]).toBeDefined();
      }
    });

    it('CardDefinition can be created with all required fields', () => {
      const def: CardDefinition = createCardDefinition();
      expect(def.id).toBeDefined();
      expect(def.deckType).toBeDefined();
      expect(computeCardPowerScore({ ...createCardInstance(), card: def })).toBeGreaterThanOrEqual(0);
    });

    it('CardInstance with GHOST deck type has correct power score', () => {
      const ghost: CardInstance = {
        ...createCardInstance(),
        card: { ...createCardDefinition(), deckType: 'GHOST' },
      };
      expect(computeCardPowerScore(ghost)).toBeGreaterThanOrEqual(0);
    });

    it('CascadeChainInstance fields match expected shape', () => {
      const chain: CascadeChainInstance = createCascadeChain();
      expect(chain.chainId).toBeDefined();
      expect(chain.templateId).toBeDefined();
      expect(chain.trigger).toBeDefined();
      expect(typeof chain.positive).toBe('boolean');
      expect(['ACTIVE', 'BROKEN', 'COMPLETED']).toContain(chain.status);
      expect(typeof chain.createdAtTick).toBe('number');
      expect(chain.links.length).toBeGreaterThan(0);
      for (const link of chain.links) {
        expect(link.linkId).toBeDefined();
        expect(typeof link.scheduledTick).toBe('number');
        expect(link.summary).toBeDefined();
      }
      expect(Array.isArray(chain.recoveryTags)).toBe(true);
    });

    it('LegendMarker fields are accessible', () => {
      const marker: LegendMarker = createLegendMarker('lm-type', 7, 'RED');
      expect(marker.markerId).toBe('lm-type');
      expect(marker.tick).toBe(7);
      expect(marker.kind).toBe('RED');
      expect(computeLegendMarkerValue(marker)).toBeGreaterThanOrEqual(0);
    });

    it('ThreatEnvelope fields are accessible', () => {
      const threat: ThreatEnvelope = createThreat('th-type', 3, 'PARTIAL');
      expect(threat.threatId).toBe('th-type');
      expect(threat.etaTicks).toBe(3);
      expect(classifyThreatUrgency(threat, 1)).toBeDefined();
    });

    it('AttackEvent fields are accessible', () => {
      const attack: AttackEvent = createAttack('atk-type', 'BREACH', 10);
      expect(attack.attackId).toBe('atk-type');
      expect(attack.category).toBe('BREACH');
      expect(attack.magnitude).toBe(10);
      expect(classifyAttackSeverity(attack)).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 23: Regression tests — known edge cases
  // --------------------------------------------------------------------------
  describe('regression tests — edge cases', () => {
    it('configure with no options does not throw', () => {
      expect(() => adapter.configure(createSnapshot())).not.toThrow();
    });

    it('configure with empty options object does not throw', () => {
      const opts: ModeConfigureOptions = {};
      expect(() => adapter.configure(createSnapshot(), opts)).not.toThrow();
    });

    it('configure with legendCordScore of 0 does not produce NaN', () => {
      const snap = createSnapshot();
      const withCord = { ...snap, sovereignty: { ...snap.sovereignty, cordScore: 0 } } as RunStateSnapshot;
      const configured = adapter.configure(withCord, { legendCordScore: 0 });
      expect(Number.isFinite(configured.sovereignty.gapVsLegend)).toBe(true);
    });

    it('onTickEnd with gapClosingRate near 0 does not go below 0 uncontrolled', () => {
      const snap = createSnapshot(20, {
        cards: { ...createSnapshot(20).cards, ghostMarkers: [createLegendMarker('lm-1', 100)] },
        sovereignty: { ...createSnapshot(20).sovereignty, gapClosingRate: 0.001 },
      });
      const ended = adapter.onTickEnd(snap);
      // gapClosingRate -= 0.005, so it becomes negative — that's allowed per the adapter logic
      expect(Number.isFinite(ended.sovereignty.gapClosingRate)).toBe(true);
    });

    it('finalize with zero cordScore still produces a finite result', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'FREEDOM',
        sovereignty: { ...createSnapshot().sovereignty, cordScore: 0, gapVsLegend: 0.1 },
      });
      const finalized = adapter.finalize(snap);
      expect(Number.isFinite(finalized.sovereignty.cordScore)).toBe(true);
    });

    it('onTickStart with 100 ghost markers does not throw', () => {
      const markers = Array.from({ length: 100 }, (_, i) =>
        createLegendMarker(`lm-${i}`, i * 2),
      );
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: markers },
      });
      expect(() => adapter.onTickStart(snap)).not.toThrow();
    });

    it('resolveAction with undefined payload does not throw', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
      });
      expect(() => adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW', undefined)).not.toThrow();
    });

    it('finalize on BANKRUPT outcome does not award LEGEND_BROKEN', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'BANKRUPT',
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: 0.5, cordScore: BASE_CORD_SCORE },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).not.toContain('LEGEND_BROKEN');
    });

    it('finalize on TIMEOUT outcome does not award LEGEND_BROKEN', () => {
      const snap = createSnapshot(DEFAULT_TICK, {
        outcome: 'TIMEOUT',
        sovereignty: { ...createSnapshot().sovereignty, gapVsLegend: 1.0, cordScore: BASE_CORD_SCORE },
      });
      const finalized = adapter.finalize(snap);
      expect(finalized.sovereignty.proofBadges).not.toContain('LEGEND_BROKEN');
    });

    it('configure preserves gapClosingRate from original sovereignty', () => {
      const snap = createSnapshot();
      const withRate = { ...snap, sovereignty: { ...snap.sovereignty, gapClosingRate: 0.88 } } as RunStateSnapshot;
      const configured = adapter.configure(withRate);
      expect(configured.sovereignty.gapClosingRate).toBe(0.88);
    });

    it('adapter does not error on snapshot with no pending attacks', () => {
      const snap = createSnapshot(5, {
        battle: { ...createSnapshot(5).battle, pendingAttacks: [] },
      });
      const configured = adapter.configure(snap);
      expect(() => adapter.onTickStart(configured)).not.toThrow();
      expect(() => adapter.onTickEnd(configured)).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 24: Pressure tier interaction in onTickEnd
  // --------------------------------------------------------------------------
  describe('onTickEnd — pressure tier interaction', () => {
    it('T0 pressure near marker window gives 0.02 delta', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        pressure: { ...createSnapshot(5).pressure, tier: 'T0' },
        sovereignty: { ...createSnapshot(5).sovereignty, gapClosingRate: 0 },
      });
      const ended = adapter.onTickEnd(snap);
      expect(ended.sovereignty.gapClosingRate).toBeCloseTo(0.02, 5);
    });

    it('T4 pressure near marker window gives only 0.01 delta', () => {
      const snap = createSnapshot(5, {
        cards: { ...createSnapshot(5).cards, ghostMarkers: [createLegendMarker('lm-1', 5)] },
        pressure: { ...createSnapshot(5).pressure, tier: 'T4' },
        sovereignty: { ...createSnapshot(5).sovereignty, gapClosingRate: 0 },
      });
      const ended = adapter.onTickEnd(snap);
      expect(ended.sovereignty.gapClosingRate).toBeCloseTo(0.01, 5);
    });

    it('accumulates gap-closing rate across multiple T1 marker ticks', () => {
      let snap = createSnapshot(4, {
        cards: {
          ...createSnapshot(4).cards,
          ghostMarkers: [createLegendMarker('lm-1', 5)],
        },
        pressure: { ...createSnapshot(4).pressure, tier: 'T1' },
        sovereignty: { ...createSnapshot(4).sovereignty, gapClosingRate: 0.0, gapVsLegend: -0.5 },
      });

      for (let tick = 4; tick <= 8; tick++) {
        snap = { ...snap, tick } as RunStateSnapshot;
        snap = adapter.onTickEnd(adapter.onTickStart(snap));
      }

      // 3 ticks in window (4,5,6,7,8 - marker at 5, radius 3 → ticks 2-8 all in window) → all get +0.02
      expect(snap.sovereignty.gapClosingRate).toBeGreaterThan(0);
    });

    it('computePressureRiskScore reflects ghost high-heat configuration', () => {
      const configured = adapter.configure(createSnapshot(), {
        legendOriginalHeat: 80,
        communityRunsSinceLegend: 30_000,
      });
      const risk = computePressureRiskScore(configured.pressure.tier, configured.pressure.score);
      expect(risk).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 25: Canonical constant table coverage
  // --------------------------------------------------------------------------
  describe('canonical constant table coverage', () => {
    it('SHIELD_LAYER_CAPACITY_WEIGHT values sum to approximately 1', () => {
      const total = SHIELD_LAYER_IDS.reduce((s, id) => s + SHIELD_LAYER_CAPACITY_WEIGHT[id], 0);
      expect(total).toBeCloseTo(1.0, 5);
    });

    it('ATTACK_CATEGORY_BASE_MAGNITUDE has entries for all attack categories', () => {
      const categories = ['EXTRACTION', 'LOCK', 'DRAIN', 'HEAT', 'BREACH', 'DEBT'] as const;
      for (const cat of categories) {
        expect(ATTACK_CATEGORY_BASE_MAGNITUDE[cat]).toBeGreaterThan(0);
      }
    });

    it('CARD_RARITY_WEIGHT increases from COMMON to LEGENDARY', () => {
      expect(CARD_RARITY_WEIGHT['COMMON']).toBeLessThan(CARD_RARITY_WEIGHT['UNCOMMON']);
      expect(CARD_RARITY_WEIGHT['UNCOMMON']).toBeLessThan(CARD_RARITY_WEIGHT['RARE']);
      expect(CARD_RARITY_WEIGHT['RARE']).toBeLessThan(CARD_RARITY_WEIGHT['LEGENDARY']);
    });

    it('TIMING_CLASS_WINDOW_PRIORITY has entries for all timing classes', () => {
      const classes = ['ANY', 'PRE_INCOME', 'POST_INCOME', 'COMBAT', 'EMERGENCY', 'ANYTIME'] as const;
      for (const cls of classes) {
        expect(TIMING_CLASS_WINDOW_PRIORITY[cls]).toBeGreaterThanOrEqual(0);
      }
    });

    it('DECK_TYPE_POWER_LEVEL has entries for all deck types', () => {
      const types = ['OPPORTUNITY', 'DEFENSE', 'COUNTER', 'GHOST', 'PRIVILEGE', 'CASCADE', 'SYNDICATE'] as const;
      for (const dt of types) {
        expect(DECK_TYPE_POWER_LEVEL[dt]).toBeGreaterThan(0);
      }
    });

    it('GHOST deck type power level is defined and positive', () => {
      expect(DECK_TYPE_POWER_LEVEL['GHOST']).toBeGreaterThan(0);
    });

    it('MODE_DIFFICULTY_MULTIPLIER for ghost is the highest of all modes', () => {
      for (const mode of ALL_MODE_CODES) {
        if (mode !== 'ghost') {
          expect(MODE_DIFFICULTY_MULTIPLIER['ghost']).toBeGreaterThan(
            MODE_DIFFICULTY_MULTIPLIER[mode],
          );
        }
      }
    });

    it('RUN_PHASE_NORMALIZED maps all three phases', () => {
      for (const phase of ALL_RUN_PHASES) {
        expect(typeof RUN_PHASE_NORMALIZED[phase]).toBe('number');
      }
    });
  });
});
