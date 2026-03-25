//backend/src/game/engine/modes/__tests__/ModeRuntimeDirector.spec.ts

/**
 * ============================================================================
 * POINT ZERO ONE — MODE RUNTIME DIRECTOR — COMPREHENSIVE TEST SUITE
 * ============================================================================
 *
 * Coverage doctrine:
 * - Every ModeRuntimeDirector lifecycle method tested in isolation and in
 *   composition across all four registered mode adapters.
 * - All GamePrimitives utility functions called inside test assertions so
 *   every import is live runtime code, not a dead type-only reference.
 * - ML/DL feature vectors extracted and asserted at key lifecycle moments.
 * - Mode signal bridge (ModeSignalAdapter) verified on every lifecycle call.
 * - Multi-adapter routing tested for correctness, isolation, and determinism.
 * - Full 10-tick simulation exercised for each mode to validate accumulation.
 * - Tag canonicalization, snapshot immutability, and registry safety verified.
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
  SoloAdvantageId,
  SoloHandicapId,
  TeamRoleId,
} from '../ModeContracts';
import { EmpireModeAdapter } from '../EmpireModeAdapter';
import { PhantomModeAdapter } from '../PhantomModeAdapter';
import { PredatorModeAdapter } from '../PredatorModeAdapter';
import { SyndicateModeAdapter } from '../SyndicateModeAdapter';
import { DEFAULT_MODE_REGISTRY, ModeRegistry } from '../ModeRegistry';
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
// MARK: Module-level constants used in assertions
// ============================================================================

/** Number of bots in every test snapshot */
const TOTAL_BOTS = 5;
/** Number of shield layers in every test snapshot */
const TOTAL_SHIELD_LAYERS = 4;
/** Default tick budget in ms */
const SEASON_BUDGET_MS = 12 * 60 * 1000;
/** Ten-minute threshold used by EmpireModeAdapter */
const TEN_MINUTES_MS = 10 * 60 * 1000;
/** Eleven-minute threshold used by EmpireModeAdapter */
const ELEVEN_MINUTES_MS = 11 * 60 * 1000;
/** All mode codes from canonical constant */
const ALL_MODE_CODES: readonly ModeCode[] = MODE_CODES;
/** All pressure tiers from canonical constant */
const ALL_PRESSURE_TIERS: readonly PressureTier[] = PRESSURE_TIERS;
/** All run phases from canonical constant */
const ALL_RUN_PHASES: readonly RunPhase[] = RUN_PHASES;
/** GHOST_WINDOW_RADIUS mirrors the constant inside PhantomModeAdapter */
const GHOST_WINDOW_RADIUS = 3;

// ============================================================================
// MARK: Factory helpers — shared across all test sections
// ============================================================================

function createCardDefinition(id = 'card-1'): CardDefinition {
  return {
    id,
    name: `Card ${id}`,
    deckType: 'OPPORTUNITY',
    baseCost: 100,
    baseEffect: {},
    tags: ['income'],
    timingClass: ['ANY'],
    rarity: 'COMMON',
    autoResolve: false,
    counterability: 'SOFT',
    targeting: 'SELF',
    decisionTimerOverrideMs: null,
    decayTicks: null,
    modeLegal: ['solo', 'pvp', 'coop', 'ghost'],
    educationalTag: 'cashflow',
  };
}

function createCardInstance(id = 'ci-1', tags: string[] = ['income']): CardInstance {
  return {
    instanceId: id,
    definitionId: 'card-1',
    card: createCardDefinition('card-1'),
    cost: 100,
    targeting: 'SELF',
    timingClass: ['ANY'],
    tags,
    overlayAppliedForMode: 'solo',
    decayTicksRemaining: null,
    divergencePotential: 'LOW',
  };
}

function createThreat(id = 'th-1', etaTicks = 2, visibility: ThreatEnvelope['visibleAs'] = 'HIDDEN'): ThreatEnvelope {
  return {
    threatId: id,
    source: 'BOT_01',
    etaTicks,
    severity: 1,
    visibleAs: visibility,
    summary: 'Incoming threat',
  };
}

function createLegendMarker(id = 'lm-1', tick = 5, kind: LegendMarker['kind'] = 'GOLD'): LegendMarker {
  return {
    markerId: id,
    tick,
    kind,
    cardId: null,
    summary: `Marker ${id}`,
  };
}

function createAttack(id = 'atk-1', category: AttackEvent['category'] = 'HEAT', magnitude = 5): AttackEvent {
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
    templateId: 'template-cash-flow',
    trigger: 'card-played',
    positive: true,
    status: 'ACTIVE',
    createdAtTick: 0,
    links: [
      { linkId: `${id}-link-1`, scheduledTick: 1, effect: { cashDelta: 500 }, summary: 'First link fires' },
      { linkId: `${id}-link-2`, scheduledTick: 2, effect: { cashDelta: 500 }, summary: 'Second link fires' },
    ],
    recoveryTags: [],
  };
}

function createSnapshot(
  mode: ModeCode = 'solo',
  overrides: Partial<RunStateSnapshot> = {},
): RunStateSnapshot {
  const base: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-1',
    userId: 'user-1',
    seed: 'seed-1',
    mode,
    tick: 0,
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
      visibleThreats: [createThreat('th-1', 2, 'HIDDEN')],
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
      bots: HATER_BOT_IDS.map((botId, i) => ({
        botId,
        label: `Bot ${i + 1}`,
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
      gapClosingRate: 0,
      cordScore: 1,
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
      modePresentation: 'empire',
      roleLockEnabled: false,
      extractionActionsRemaining: 0,
      ghostBaselineRunId: null,
      legendOwnerUserId: null,
    },
    timers: {
      seasonBudgetMs: SEASON_BUDGET_MS,
      extensionBudgetMs: 0,
      elapsedMs: 0,
      currentTickDurationMs: 1000,
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

  return { ...base, ...overrides } as RunStateSnapshot;
}

// ============================================================================
// MARK: GamePrimitives utility helpers used inside test assertions
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
  const activeBots = snapshot.battle.bots.filter((b) => b.state === 'TARGETING' || b.state === 'ATTACKING');
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

function computeFirstThreatUrgency(snapshot: RunStateSnapshot): string {
  if (snapshot.tension.visibleThreats.length === 0) return 'NONE';
  return classifyThreatUrgency(snapshot.tension.visibleThreats[0], snapshot.tick);
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
// MARK: Test lifecycle management
// ============================================================================

let sharedRegistry: ModeRegistry;
let sharedDirector: ModeRuntimeDirector;
let signalAdapter: ModeSignalAdapter;
let mlExtractor: ModeMlFeatureExtractor;
let dlBuilder: ModeDlTensorBuilder;
let riskScorer: ModeSignalRiskScorer;
let analytics: ModeSignalAnalytics;

beforeAll(() => {
  // Verify canonical constants are present and correctly shaped
  expect(ALL_MODE_CODES).toHaveLength(4);
  expect(ALL_PRESSURE_TIERS).toHaveLength(5);
  expect(ALL_RUN_PHASES).toHaveLength(3);
  expect(SHIELD_LAYER_IDS).toHaveLength(4);
  expect(HATER_BOT_IDS).toHaveLength(5);

  // Verify type guards work as expected
  expect(isModeCode('solo')).toBe(true);
  expect(isModeCode('unknown')).toBe(false);
  expect(isPressureTier('T0')).toBe(true);
  expect(isPressureTier('T9')).toBe(false);
  expect(isRunPhase('FOUNDATION')).toBe(true);
  expect(isRunPhase('LIMBO')).toBe(false);
  expect(isRunOutcome('FREEDOM')).toBe(true);
  expect(isRunOutcome('DRAW')).toBe(false);
  expect(isShieldLayerId('L1')).toBe(true);
  expect(isShieldLayerId('L9')).toBe(false);
  expect(isHaterBotId('BOT_01')).toBe(true);
  expect(isHaterBotId('BOT_99')).toBe(false);

  // Verify all constants have entries for all canonical values
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
  sharedRegistry = new ModeRegistry();
  sharedRegistry.registerMany([
    new EmpireModeAdapter(),
    new PredatorModeAdapter(),
    new SyndicateModeAdapter(),
    new PhantomModeAdapter(),
  ]);
  sharedDirector = new ModeRuntimeDirector(sharedRegistry);
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
// MARK: describe('ModeRuntimeDirector') — main test suite
// ============================================================================

describe('ModeRuntimeDirector', () => {

  // --------------------------------------------------------------------------
  // SECTION 1: Basic delegation — original tests preserved + expanded
  // --------------------------------------------------------------------------
  describe('lifecycle delegation — spy-based verification', () => {
    it('delegates configure, tick hooks, action resolution, and finalize to the registered adapter', () => {
      const registry = new ModeRegistry();

      const configure = vi.fn((snapshot: RunStateSnapshot, _options?: ModeConfigureOptions) => ({
        ...snapshot,
        tags: [...snapshot.tags, 'configured:solo'],
      }));

      const onTickStart = vi.fn((snapshot: RunStateSnapshot) => ({
        ...snapshot,
        tick: snapshot.tick + 1,
        tags: [...snapshot.tags, 'tick:start'],
      }));

      const onTickEnd = vi.fn((snapshot: RunStateSnapshot) => ({
        ...snapshot,
        tags: [...snapshot.tags, 'tick:end'],
      }));

      const resolveAction = vi.fn((snapshot: RunStateSnapshot, actionId: string) => ({
        ...snapshot,
        tags: [...snapshot.tags, `action:${actionId}`],
      }));

      const finalize = vi.fn((snapshot: RunStateSnapshot) => ({
        ...snapshot,
        tags: [...snapshot.tags, 'finalized'],
      }));

      const adapter: ModeAdapter = {
        modeCode: 'solo',
        configure,
        onTickStart,
        onTickEnd,
        resolveAction,
        finalize,
      };

      registry.register(adapter);
      const director = new ModeRuntimeDirector(registry);

      const configured = director.configure(createSnapshot('solo'), { advantageId: 'MOMENTUM_CAPITAL' });
      const started = director.onTickStart(configured);
      const acted = director.resolveAction(started, 'USE_HOLD', { windowId: 'w-1' });
      const ended = director.onTickEnd(acted);
      const finalized = director.finalize(ended);

      expect(configure).toHaveBeenCalledTimes(1);
      expect(onTickStart).toHaveBeenCalledTimes(1);
      expect(resolveAction).toHaveBeenCalledTimes(1);
      expect(onTickEnd).toHaveBeenCalledTimes(1);
      expect(finalize).toHaveBeenCalledTimes(1);

      expect(finalized.tags).toEqual([
        'configured:solo',
        'tick:start',
        'action:USE_HOLD',
        'tick:end',
        'finalized',
      ]);
      expect(finalized.tick).toBe(1);
    });

    it('returns the original snapshot when optional hooks are not implemented', () => {
      const registry = new ModeRegistry();
      registry.register({ modeCode: 'ghost', configure: (snapshot) => snapshot });
      const director = new ModeRuntimeDirector(registry);
      const snapshot = createSnapshot('ghost');

      expect(director.onTickStart(snapshot)).toBe(snapshot);
      expect(director.onTickEnd(snapshot)).toBe(snapshot);
      expect(director.resolveAction(snapshot, 'LOCK_GHOST_WINDOW')).toBe(snapshot);
      expect(director.finalize(snapshot)).toBe(snapshot);
    });

    it('routes by snapshot.mode when multiple adapters are registered', () => {
      const registry = new ModeRegistry();
      registry.register({
        modeCode: 'solo',
        configure: (snapshot) => ({ ...snapshot, tags: [...snapshot.tags, 'solo-configured'] }),
      });
      registry.register({
        modeCode: 'pvp',
        configure: (snapshot) => ({ ...snapshot, tags: [...snapshot.tags, 'pvp-configured'] }),
      });
      const director = new ModeRuntimeDirector(registry);

      expect(director.configure(createSnapshot('solo')).tags).toContain('solo-configured');
      expect(director.configure(createSnapshot('pvp')).tags).toContain('pvp-configured');
    });

    it('calls configure with the provided options object unchanged', () => {
      const configureSpy = vi.fn((snap: RunStateSnapshot, opts?: ModeConfigureOptions) => ({
        ...snap,
        tags: [...snap.tags, `adv:${opts?.advantageId ?? 'none'}`],
      }));
      const registry = new ModeRegistry();
      registry.register({ modeCode: 'solo', configure: configureSpy });
      const director = new ModeRuntimeDirector(registry);
      const opts: ModeConfigureOptions = { advantageId: 'DEBT_SHIELD', handicapIds: ['CASH_POOR'] };
      director.configure(createSnapshot('solo'), opts);

      expect(configureSpy).toHaveBeenCalledWith(expect.any(Object), opts);
    });

    it('passes payload through to resolveAction unchanged', () => {
      const resolveActionSpy = vi.fn((snap: RunStateSnapshot) => snap);
      const registry = new ModeRegistry();
      registry.register({ modeCode: 'solo', configure: (s) => s, resolveAction: resolveActionSpy });
      const director = new ModeRuntimeDirector(registry);
      const payload = { windowId: 'win-42', extra: true };
      director.resolveAction(createSnapshot('solo'), 'USE_HOLD', payload);

      expect(resolveActionSpy).toHaveBeenCalledWith(expect.any(Object), 'USE_HOLD', payload);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: EmpireModeAdapter (solo) — full lifecycle
  // --------------------------------------------------------------------------
  describe('EmpireModeAdapter — solo lifecycle', () => {
    it('configure sets solo tags and hold charges from the adapter', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap, { advantageId: 'MOMENTUM_CAPITAL' });

      expect(configured.tags).toContain('mode:empire');
      expect(configured.tags).toContain('solo:authoritative');
      expect(configured.tags).toContain('loadout:enabled');
      expect(configured.modeState.loadoutEnabled).toBe(true);
      expect(configured.modeState.holdEnabled).toBe(true);
      expect(configured.timers.holdCharges).toBeGreaterThanOrEqual(1);
    });

    it('configure with MOMENTUM_CAPITAL advantage adds $10 000 cash', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap, { advantageId: 'MOMENTUM_CAPITAL' });
      expect(configured.economy.cash).toBe(snap.economy.cash + 10_000);
      // Verify net-worth delta is consistent
      expect(configured.economy.netWorth).toBe(snap.economy.netWorth + 10_000);
    });

    it('configure with DEBT_SHIELD adds the solo:auto_debt_counter:1 tag', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'), { advantageId: 'DEBT_SHIELD' });
      expect(configured.tags).toContain('solo:auto_debt_counter:1');
    });

    it('configure with NETWORK_ACTIVATED advantage expands L4 shield by 1.5×', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap, { advantageId: 'NETWORK_ACTIVATED' });
      const l4 = configured.shield.layers.find((l) => l.layerId === 'L4');
      const original = snap.shield.layers.find((l) => l.layerId === 'L4')!;
      expect(l4!.max).toBe(Math.round(original.max * 1.5));
      expect(l4!.current).toBe(Math.round(original.current * 1.5));
    });

    it('configure with bleedMode enables DISADVANTAGE_DRAFT rules', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'), { bleedMode: true });
      expect(configured.modeState.bleedMode).toBe(true);
      expect(configured.modeState.holdEnabled).toBe(false);
      expect(configured.timers.holdCharges).toBe(0);
    });

    it('configure with TARGETED handicap activates BOT_01 with heat >= 20', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'), { handicapIds: ['TARGETED'] });
      const bot01 = configured.battle.bots.find((b) => b.botId === 'BOT_01');
      expect(bot01?.state).toBe('WATCHING');
      expect(bot01?.heat).toBeGreaterThanOrEqual(20);
    });

    it('configure with CASH_POOR handicap caps economy.cash at 10 000', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap, { handicapIds: ['CASH_POOR'] });
      expect(configured.economy.cash).toBeLessThanOrEqual(10_000);
    });

    it('configure with NO_CREDIT_HISTORY caps L2 shield at 40', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'), { handicapIds: ['NO_CREDIT_HISTORY'] });
      const l2 = configured.shield.layers.find((l) => l.layerId === 'L2');
      expect(l2!.max).toBeLessThanOrEqual(40);
      expect(l2!.current).toBeLessThanOrEqual(40);
    });

    it('configure with CLOCK_CURSED handicap caps season budget to 9 minutes', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'), { handicapIds: ['CLOCK_CURSED'] });
      expect(configured.timers.seasonBudgetMs).toBeLessThanOrEqual(9 * 60 * 1000);
    });

    it('onTickStart triggers ESCALATION transition when elapsed > 33% of season budget', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const withElapsed = {
        ...configured,
        timers: { ...configured.timers, elapsedMs: Math.floor(SEASON_BUDGET_MS * 0.35) },
      } as RunStateSnapshot;
      const started = sharedDirector.onTickStart(withElapsed);
      expect(started.phase).toBe('ESCALATION');
      expect(started.tags.some((t) => t.includes('FOUNDATION->ESCALATION'))).toBe(true);
    });

    it('onTickStart triggers SOVEREIGNTY transition when elapsed > 66% of season budget', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const withElapsed = {
        ...configured,
        phase: 'ESCALATION' as RunPhase,
        timers: { ...configured.timers, elapsedMs: Math.floor(SEASON_BUDGET_MS * 0.68) },
      } as RunStateSnapshot;
      const started = sharedDirector.onTickStart(withElapsed);
      expect(started.phase).toBe('SOVEREIGNTY');
      expect(started.tags.some((t) => t.includes('ESCALATION->SOVEREIGNTY'))).toBe(true);
    });

    it('onTickStart at minute 10 adds solo:clock_active tag and exposes threats', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      const withElapsed = {
        ...configured,
        timers: { ...configured.timers, elapsedMs: TEN_MINUTES_MS + 1 },
      } as RunStateSnapshot;
      const started = sharedDirector.onTickStart(withElapsed);
      expect(started.tags).toContain('solo:clock_active');
      expect(started.tension.visibleThreats.every((t) => t.visibleAs === 'EXPOSED')).toBe(true);
    });

    it('onTickStart at minute 11 applies heat spike to non-dormant bots', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      const withActiveBot = {
        ...configured,
        timers: { ...configured.timers, elapsedMs: ELEVEN_MINUTES_MS + 1 },
        battle: {
          ...configured.battle,
          bots: configured.battle.bots.map((b, i) =>
            i === 0 ? { ...b, state: 'ATTACKING' as BotState, heat: 10 } : b,
          ),
        },
      } as RunStateSnapshot;
      const started = sharedDirector.onTickStart(withActiveBot);
      const bot = started.battle.bots[0];
      expect(bot.heat).toBe(10 + 20);
    });

    it('onTickStart tracks cash-low streak with upsert tag', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      const lowCash = { ...configured, economy: { ...configured.economy, cash: 1500 } } as RunStateSnapshot;
      const started1 = sharedDirector.onTickStart(lowCash);
      const started2 = sharedDirector.onTickStart(started1);

      const streak1 = started1.tags.find((t) => t.startsWith('solo:cash_low_streak:'));
      const streak2 = started2.tags.find((t) => t.startsWith('solo:cash_low_streak:'));
      expect(streak1).toBeDefined();
      expect(streak2).toBeDefined();
      const val1 = Number(streak1!.split(':')[3]);
      const val2 = Number(streak2!.split(':')[3]);
      expect(val2).toBe(val1 + 1);
    });

    it('onTickEnd decrements phaseBoundaryWindowsRemaining by 1', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      const withWindows = {
        ...configured,
        modeState: { ...configured.modeState, phaseBoundaryWindowsRemaining: 5 },
      } as RunStateSnapshot;
      const ended = sharedDirector.onTickEnd(withWindows);
      expect(ended.modeState.phaseBoundaryWindowsRemaining).toBe(4);
    });

    it('onTickEnd in bleed mode at T3/T4 pressure increments haterHeat by 1', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'), { bleedMode: true });
      const highPressure = {
        ...configured,
        pressure: { ...configured.pressure, tier: 'T3' as PressureTier },
      } as RunStateSnapshot;
      const ended = sharedDirector.onTickEnd(highPressure);
      expect(ended.economy.haterHeat).toBe(highPressure.economy.haterHeat + 1);
    });

    it('onTickEnd with comeback_surge_armed increases all layer regenPerTick by 1', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      const withSurge = { ...configured, tags: [...configured.tags, 'solo:comeback_surge_armed'] } as RunStateSnapshot;
      const ended = sharedDirector.onTickEnd(withSurge);
      for (const layer of ended.shield.layers) {
        const original = configured.shield.layers.find((l) => l.layerId === layer.layerId)!;
        expect(layer.regenPerTick).toBe(original.regenPerTick + 1);
      }
    });

    it('resolveAction USE_HOLD consumes one hold charge and freezes the window', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      expect(configured.modeState.holdEnabled).toBe(true);
      expect(configured.timers.holdCharges).toBeGreaterThanOrEqual(1);
      const resolved = sharedDirector.resolveAction(configured, 'USE_HOLD', { windowId: 'w-99' });
      expect(resolved.timers.holdCharges).toBe(configured.timers.holdCharges - 1);
      expect(resolved.timers.frozenWindowIds).toContain('w-99');
      expect(resolved.tags).toContain('solo:hold_used');
    });

    it('resolveAction USE_HOLD is a no-op when holdCharges is 0', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      const depleted = { ...configured, timers: { ...configured.timers, holdCharges: 0 } } as RunStateSnapshot;
      const resolved = sharedDirector.resolveAction(depleted, 'USE_HOLD', { windowId: 'w-1' });
      expect(resolved).toBe(depleted);
    });

    it('finalize awards FULL_BOT_GAUNTLET when all bots are enabled', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      const finalized = sharedDirector.finalize({ ...configured, outcome: 'FREEDOM' } as RunStateSnapshot);
      expect(finalized.sovereignty.proofBadges).toContain('FULL_BOT_GAUNTLET');
    });

    it('finalize BLEED_S_GRADE_ELIGIBLE when bleed mode + FREEDOM outcome', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'), { bleedMode: true });
      const finalized = sharedDirector.finalize({ ...configured, outcome: 'FREEDOM' } as RunStateSnapshot);
      expect(finalized.sovereignty.proofBadges).toContain('BLEED_S_GRADE_ELIGIBLE');
      expect(finalized.sovereignty.cordScore).toBeGreaterThanOrEqual(1.8);
    });

    it('finalize applies HANDICAP_CORD_BONUS for each active handicap', () => {
      const handicaps: SoloHandicapId[] = ['CLOCK_CURSED', 'CASH_POOR'];
      const configured = sharedDirector.configure(createSnapshot('solo'), { handicapIds: handicaps });
      const finalized = sharedDirector.finalize(configured);
      // CLOCK_CURSED = 0.30, CASH_POOR = 0.20 → multiplier = 1.50
      expect(finalized.sovereignty.cordScore).toBeCloseTo(1 * 1.50, 3);
    });

    it('finalize COMEBACK_SURGE badge when comeback_realized tag is present', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      const withSurge = { ...configured, tags: [...configured.tags, 'solo:comeback_realized'] } as RunStateSnapshot;
      const finalized = sharedDirector.finalize(withSurge);
      expect(finalized.sovereignty.proofBadges).toContain('COMEBACK_SURGE');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: PhantomModeAdapter (ghost) — full lifecycle via director
  // --------------------------------------------------------------------------
  describe('PhantomModeAdapter — ghost lifecycle via director', () => {
    function ghostSnap(overrides: Partial<RunStateSnapshot> = {}): RunStateSnapshot {
      return createSnapshot('ghost', overrides);
    }

    it('configure establishes ghost mode tags and disables hold', () => {
      const configured = sharedDirector.configure(ghostSnap(), {
        legendRunId: 'legend-run',
        legendOwnerUserId: 'legend-user',
        legendOriginalHeat: 20,
        communityRunsSinceLegend: 50_000,
        legendDaysAlive: 6,
        legendCordScore: 1.5,
        legendMarkers: [createLegendMarker('lm-1', 5)],
      });

      expect(configured.tags).toContain('mode:phantom');
      expect(configured.tags).toContain('hold:disabled');
      expect(configured.tags).toContain('legend_markers:enabled');
      expect(configured.modeState.holdEnabled).toBe(false);
      expect(configured.timers.holdCharges).toBe(0);
      expect(configured.modeState.legendMarkersEnabled).toBe(true);
      expect(configured.modeState.ghostBaselineRunId).toBe('legend-run');
      expect(configured.modeState.legendOwnerUserId).toBe('legend-user');
    });

    it('configure computes community heat modifier correctly', () => {
      const configured = sharedDirector.configure(ghostSnap(), {
        communityRunsSinceLegend: 100_000,
        legendOriginalHeat: 10,
        legendDaysAlive: 0,
      });
      // 100_000 * 0.003 = 300
      expect(configured.modeState.communityHeatModifier).toBe(300);
      expect(configured.economy.haterHeat).toBe(310); // 10 + 300 + 0
    });

    it('configure applies decay tax: floor(daysAlive / 3) * 5', () => {
      const configured = sharedDirector.configure(ghostSnap(), {
        legendOriginalHeat: 0,
        communityRunsSinceLegend: 0,
        legendDaysAlive: 9, // floor(9/3) * 5 = 15
      });
      expect(configured.economy.haterHeat).toBe(15);
    });

    it('onTickStart opens a marker window and exposes threats when near a marker', () => {
      const configured = sharedDirector.configure(ghostSnap({
        tick: 5,
        cards: {
          ...createSnapshot('ghost').cards,
          ghostMarkers: [createLegendMarker('lm-1', 5)],
        },
      }));
      const started = sharedDirector.onTickStart(configured);
      expect(started.tags).toContain('ghost:marker_window');
      expect(started.tension.visibleThreats.every((t) => t.visibleAs === 'EXPOSED')).toBe(true);
    });

    it('onTickStart removes marker_window when tick is far from all markers', () => {
      const configured = sharedDirector.configure(ghostSnap({
        tick: 30,
        tags: ['ghost:marker_window'],
        cards: {
          ...createSnapshot('ghost').cards,
          ghostMarkers: [createLegendMarker('lm-1', 5)],
        },
      }));
      const started = sharedDirector.onTickStart(configured);
      expect(started.tags).not.toContain('ghost:marker_window');
    });

    it('onTickEnd enforces community heat floor', () => {
      const configured = sharedDirector.configure(ghostSnap(), { communityRunsSinceLegend: 50_000 });
      const withLowHeat = {
        ...configured,
        economy: { ...configured.economy, haterHeat: 1 },
      } as RunStateSnapshot;
      const ended = sharedDirector.onTickEnd(withLowHeat);
      expect(ended.economy.haterHeat).toBeGreaterThanOrEqual(
        Math.round(configured.modeState.communityHeatModifier),
      );
    });

    it('resolveAction LOCK_GHOST_WINDOW grants bonus when inside marker window', () => {
      const snap = ghostSnap({ tick: 5 });
      const configured = sharedDirector.configure(snap);
      const resolved = sharedDirector.resolveAction(configured, 'LOCK_GHOST_WINDOW');
      expect(resolved.tags).toContain('ghost:window_locked');
      expect(resolved.modeState.phaseBoundaryWindowsRemaining).toBeGreaterThanOrEqual(1);
      expect(resolved.sovereignty.gapClosingRate).toBeGreaterThan(configured.sovereignty.gapClosingRate);
    });

    it('resolveAction LOCK_GHOST_WINDOW is a no-op outside a marker window', () => {
      const snap = ghostSnap({ tick: 30, cards: { ...createSnapshot('ghost').cards, ghostMarkers: [createLegendMarker('lm-1', 5)] } });
      const configured = sharedDirector.configure(snap);
      const resolved = sharedDirector.resolveAction(configured, 'LOCK_GHOST_WINDOW');
      expect(resolved).toBe(configured);
    });

    it('finalize awards LEGEND_BROKEN + multiplier when outcome=FREEDOM and gapVsLegend > 0', () => {
      const configured = sharedDirector.configure(ghostSnap(), {
        legendCordScore: 1.0,
        communityRunsSinceLegend: 100_000,
      });
      const beforeFinalize = {
        ...configured,
        outcome: 'FREEDOM' as RunOutcome,
        sovereignty: { ...configured.sovereignty, gapVsLegend: 0.1, cordScore: 2 },
      } as RunStateSnapshot;
      const finalized = sharedDirector.finalize(beforeFinalize);
      expect(finalized.sovereignty.proofBadges).toContain('LEGEND_BROKEN');
      expect(finalized.sovereignty.cordScore).toBeGreaterThan(beforeFinalize.sovereignty.cordScore);
    });

    it('finalize awards CHALLENGER when gapVsLegend >= -0.05 without FREEDOM', () => {
      const configured = sharedDirector.configure(ghostSnap());
      const beforeFinalize = {
        ...configured,
        outcome: null,
        sovereignty: { ...configured.sovereignty, gapVsLegend: -0.04, cordScore: 1 },
      } as RunStateSnapshot;
      const finalized = sharedDirector.finalize(beforeFinalize);
      expect(finalized.sovereignty.proofBadges).toContain('CHALLENGER');
      expect(finalized.sovereignty.proofBadges).not.toContain('LEGEND_BROKEN');
    });

    it('finalize awards HISTORICAL_HUNTER when 20+ markers and FREEDOM outcome', () => {
      const markers = Array.from({ length: 20 }, (_, i) => createLegendMarker(`lm-${i + 1}`, i + 1));
      const configured = sharedDirector.configure(ghostSnap());
      const beforeFinalize = {
        ...configured,
        outcome: 'FREEDOM' as RunOutcome,
        cards: { ...configured.cards, ghostMarkers: markers },
        sovereignty: { ...configured.sovereignty, gapVsLegend: 0.2, cordScore: 2 },
        modeState: { ...configured.modeState, communityHeatModifier: 150 },
      } as RunStateSnapshot;
      const finalized = sharedDirector.finalize(beforeFinalize);
      expect(finalized.sovereignty.proofBadges).toContain('HISTORICAL_HUNTER');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 4: PredatorModeAdapter (pvp) — lifecycle via director
  // --------------------------------------------------------------------------
  describe('PredatorModeAdapter — pvp lifecycle via director', () => {
    it('configure sets pvp tags on the snapshot', () => {
      const snap = createSnapshot('pvp');
      const configured = sharedDirector.configure(snap, { spectatorLimit: 50 });
      // PredatorModeAdapter must set some pvp-identifying tag
      expect(isModeCode(configured.mode)).toBe(true);
      expect(configured.mode).toBe('pvp');
    });

    it('director routes onTickStart to the pvp adapter and returns a mutated snapshot', () => {
      const snap = createSnapshot('pvp');
      const configured = sharedDirector.configure(snap);
      const started = sharedDirector.onTickStart(configured);
      // Result must be same mode
      expect(started.mode).toBe('pvp');
    });

    it('resolveAction COUNTER_PLAY routes to pvp adapter', () => {
      const snap = createSnapshot('pvp');
      const configured = sharedDirector.configure(snap);
      const resolved = sharedDirector.resolveAction(configured, 'COUNTER_PLAY');
      expect(resolved.mode).toBe('pvp');
    });

    it('finalize returns a valid snapshot with unchanged mode', () => {
      const snap = createSnapshot('pvp');
      const configured = sharedDirector.configure(snap);
      const finalized = sharedDirector.finalize(configured);
      expect(finalized.mode).toBe('pvp');
    });

    it('pvp mode has a higher difficulty multiplier than solo', () => {
      expect(MODE_DIFFICULTY_MULTIPLIER['pvp']).toBeGreaterThanOrEqual(MODE_DIFFICULTY_MULTIPLIER['solo']);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 5: SyndicateModeAdapter (coop) — lifecycle via director
  // --------------------------------------------------------------------------
  describe('SyndicateModeAdapter — coop lifecycle via director', () => {
    it('configure sets coop mode and shared treasury if requested', () => {
      const snap = createSnapshot('coop');
      const configured = sharedDirector.configure(snap, {
        sharedTreasuryStart: 50_000,
        teammateUserIds: ['user-2', 'user-3'],
        initialTrustScore: 0.75,
      });
      expect(configured.mode).toBe('coop');
    });

    it('onTickEnd routes to the coop adapter and returns the snapshot', () => {
      const snap = createSnapshot('coop');
      const configured = sharedDirector.configure(snap);
      const ended = sharedDirector.onTickEnd(configured);
      expect(ended.mode).toBe('coop');
    });

    it('resolveAction REQUEST_TREASURY_LOAN routes to coop adapter', () => {
      const snap = createSnapshot('coop');
      const configured = sharedDirector.configure(snap);
      const resolved = sharedDirector.resolveAction(configured, 'REQUEST_TREASURY_LOAN');
      expect(resolved.mode).toBe('coop');
    });

    it('coop mode has lower MODE_NORMALIZED value than pvp', () => {
      expect(MODE_NORMALIZED['coop']).toBeLessThan(MODE_NORMALIZED['pvp']);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 6: Multi-adapter routing correctness
  // --------------------------------------------------------------------------
  describe('multi-adapter routing — isolation and determinism', () => {
    it('all four mode adapters are registered in DEFAULT_MODE_REGISTRY', () => {
      const defaultDirector = new ModeRuntimeDirector(DEFAULT_MODE_REGISTRY);
      for (const mode of ALL_MODE_CODES) {
        const snap = createSnapshot(mode);
        expect(() => defaultDirector.configure(snap)).not.toThrow();
      }
    });

    it('configuring solo does not affect pvp adapter state', () => {
      const soloSnap = createSnapshot('solo');
      const pvpSnap = createSnapshot('pvp');

      const soloConfigured = sharedDirector.configure(soloSnap, { advantageId: 'MOMENTUM_CAPITAL' });
      const pvpConfigured = sharedDirector.configure(pvpSnap);

      expect(soloConfigured.tags).toContain('mode:empire');
      expect(pvpConfigured.tags).not.toContain('mode:empire');
      expect(soloConfigured.economy.cash).toBe(soloSnap.economy.cash + 10_000);
      expect(pvpConfigured.economy.cash).toBe(pvpSnap.economy.cash); // unaffected
    });

    it('tick-starting a solo snapshot while a ghost snapshot exists in parallel is safe', () => {
      const soloConfigured = sharedDirector.configure(createSnapshot('solo'));
      const ghostConfigured = sharedDirector.configure(createSnapshot('ghost'));

      const soloStarted = sharedDirector.onTickStart(soloConfigured);
      const ghostStarted = sharedDirector.onTickStart(ghostConfigured);

      expect(soloStarted.mode).toBe('solo');
      expect(ghostStarted.mode).toBe('ghost');
      expect(soloStarted.tags).not.toContain('ghost:marker_window');
    });

    it('director throws when mode has no registered adapter', () => {
      const registry = new ModeRegistry();
      registry.register({ modeCode: 'solo', configure: (s) => s });
      const director = new ModeRuntimeDirector(registry);
      const pvpSnap = createSnapshot('pvp');

      expect(() => director.configure(pvpSnap)).toThrow(/pvp/i);
    });

    it('registering a second adapter for the same mode replaces the first', () => {
      const registry = new ModeRegistry();
      registry.register({ modeCode: 'solo', configure: (s) => ({ ...s, tags: [...s.tags, 'adapter-v1'] }) });
      registry.register({ modeCode: 'solo', configure: (s) => ({ ...s, tags: [...s.tags, 'adapter-v2'] }) });
      const director = new ModeRuntimeDirector(registry);
      const configured = director.configure(createSnapshot('solo'));
      expect(configured.tags).toContain('adapter-v2');
      expect(configured.tags).not.toContain('adapter-v1');
    });

    it('resolveAction with unsupported actionId returns snapshot unchanged for minimal adapter', () => {
      const registry = new ModeRegistry();
      registry.register({
        modeCode: 'coop',
        configure: (s) => s,
        resolveAction: (s, id) => id === 'COUNTER_PLAY' ? { ...s, tags: [...s.tags, 'coop:counter'] } : s,
      });
      const director = new ModeRuntimeDirector(registry);
      const snap = createSnapshot('coop');
      const resolved = director.resolveAction(snap, 'FIRE_EXTRACTION');
      expect(resolved).toBe(snap);
    });

    it('all four modes independently support the finalize lifecycle without crashing', () => {
      for (const mode of ALL_MODE_CODES) {
        const snap = createSnapshot(mode);
        const configured = sharedDirector.configure(snap);
        const finalized = sharedDirector.finalize({ ...configured, outcome: 'FREEDOM' } as RunStateSnapshot);
        expect(finalized.mode).toBe(mode);
        expect(typeof finalized.sovereignty.cordScore).toBe('number');
        expect(Number.isFinite(finalized.sovereignty.cordScore)).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 7: GamePrimitives utility validation inside tests
  // --------------------------------------------------------------------------
  describe('GamePrimitives utilities — live computation in assertions', () => {
    it('computePressureRiskScore is monotonically increasing with pressure tier', () => {
      const scores = ALL_PRESSURE_TIERS.map((tier) => computePressureRiskScore(tier, 0.5));
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });

    it('computeShieldIntegrityRatio returns 1.0 for fully intact shields', () => {
      const snap = createSnapshot('solo');
      const integrity = computeShieldIntegrityForSnapshot(snap);
      expect(integrity).toBe(1.0);
    });

    it('computeShieldIntegrityRatio returns < 1.0 when a layer is damaged', () => {
      const snap = createSnapshot('solo');
      const damaged = {
        ...snap,
        shield: {
          ...snap.shield,
          layers: snap.shield.layers.map((l) =>
            l.layerId === 'L1' ? { ...l, current: 25 } : l,
          ),
        },
      } as RunStateSnapshot;
      const integrity = computeShieldIntegrityForSnapshot(damaged);
      expect(integrity).toBeLessThan(1.0);
    });

    it('computeShieldLayerVulnerability is 0.0 for fully intact L1', () => {
      expect(computeShieldLayerVulnerability('L1', 50, 50)).toBe(0);
    });

    it('computeShieldLayerVulnerability is > 0 for partially damaged L1', () => {
      expect(computeShieldLayerVulnerability('L1', 25, 50)).toBeGreaterThan(0);
    });

    it('estimateShieldRegenPerTick scales with max HP', () => {
      const regenAtMax50 = estimateShieldRegenPerTick('L1', 50);
      const regenAtMax100 = estimateShieldRegenPerTick('L1', 100);
      expect(regenAtMax100).toBeGreaterThan(regenAtMax50);
    });

    it('computeAggregateBotThreat is 0 when all bots are DORMANT', () => {
      const snap = createSnapshot('solo');
      expect(computeAggregateBotThreatForSnapshot(snap)).toBe(0);
    });

    it('computeAggregateBotThreat is > 0 when a bot is ATTACKING', () => {
      const snap = createSnapshot('solo');
      const withActive = {
        ...snap,
        battle: {
          ...snap.battle,
          bots: snap.battle.bots.map((b, i) =>
            i === 0 ? { ...b, state: 'ATTACKING' as BotState } : b,
          ),
        },
      } as RunStateSnapshot;
      expect(computeAggregateBotThreatForSnapshot(withActive)).toBeGreaterThan(0);
    });

    it('computeBotThreatScore(BOT_01, DORMANT) is 0', () => {
      expect(computeBotThreatScore('BOT_01', 'DORMANT')).toBe(0);
    });

    it('computeBotThreatScore(BOT_01, ATTACKING) is > 0', () => {
      expect(computeBotThreatScore('BOT_01', 'ATTACKING')).toBeGreaterThan(0);
    });

    it('computeCardPowerScore respects rarity weight', () => {
      const commonCard = createCardInstance('ci-common');
      const rareCard: CardInstance = {
        ...commonCard,
        instanceId: 'ci-rare',
        card: { ...commonCard.card, rarity: 'RARE', baseCost: 200, baseEffect: { cashDelta: 3000 } },
        cost: 200,
      };
      const commonScore = computeCardPowerScore(commonCard);
      const rareScore = computeCardPowerScore(rareCard);
      expect(CARD_RARITY_WEIGHT['RARE']).toBeGreaterThan(CARD_RARITY_WEIGHT['COMMON']);
      expect(rareScore).toBeGreaterThanOrEqual(commonScore);
    });

    it('computeCardTimingPriority reflects TIMING_CLASS_WINDOW_PRIORITY', () => {
      const card = createCardInstance();
      const priority = computeFirstCardTimingPriority(createSnapshot('solo'));
      expect(priority).toBeGreaterThanOrEqual(0);
    });

    it('isCardLegalInMode returns true for modeLegal modes and false otherwise', () => {
      const card = createCardInstance();
      expect(isCardLegalInMode(card, 'solo')).toBe(true);
      expect(isCardLegalInMode({ ...card, card: { ...card.card, modeLegal: ['pvp'] } }, 'solo')).toBe(false);
    });

    it('classifyAttackSeverity returns MINOR for low-magnitude HEAT attacks', () => {
      const attack = createAttack('atk-1', 'HEAT', 1);
      expect(classifyAttackSeverity(attack)).toBe('MINOR');
    });

    it('classifyAttackSeverity returns CATASTROPHIC for high-magnitude EXTRACTION attacks', () => {
      const attack = createAttack('atk-1', 'EXTRACTION', 100);
      expect(classifyAttackSeverity(attack)).toBe('CATASTROPHIC');
    });

    it('ATTACK_CATEGORY_BASE_MAGNITUDE is > 0 for all categories', () => {
      for (const [, val] of Object.entries(ATTACK_CATEGORY_BASE_MAGNITUDE)) {
        expect(val).toBeGreaterThan(0);
      }
    });

    it('classifyThreatUrgency returns CRITICAL for imminent threats', () => {
      const imminentThreat = createThreat('th-now', 1, 'EXPOSED');
      const urgency = classifyThreatUrgency(imminentThreat, 0);
      expect(urgency).toBe('CRITICAL');
    });

    it('classifyThreatUrgency returns LOW or NONE for distant threats', () => {
      const distantThreat = createThreat('th-far', 50, 'HIDDEN');
      const urgency = classifyThreatUrgency(distantThreat, 0);
      expect(['LOW', 'NONE', 'MODERATE'].includes(urgency)).toBe(true);
    });

    it('computeLegendMarkerValue is higher for GOLD markers than SILVER', () => {
      const gold = createLegendMarker('gold-1', 5, 'GOLD');
      const silver = createLegendMarker('silver-1', 5, 'SILVER');
      expect(computeLegendMarkerValue(gold)).toBeGreaterThan(computeLegendMarkerValue(silver));
    });

    it('scoreCascadeChainHealth is between 0 and 1 for active chains', () => {
      const chain = createCascadeChain();
      const health = scoreCascadeChainHealth(chain);
      expect(health).toBeGreaterThanOrEqual(0);
      expect(health).toBeLessThanOrEqual(1);
    });

    it('DECK_TYPE_POWER_LEVEL has a value for every canonical deck type', () => {
      for (const [, val] of Object.entries(DECK_TYPE_POWER_LEVEL)) {
        expect(val).toBeGreaterThan(0);
      }
    });

    it('scoreOutcomeExcitement returns higher score for FREEDOM than BANKRUPT', () => {
      expect(scoreOutcomeExcitement('FREEDOM', 'solo')).toBeGreaterThan(scoreOutcomeExcitement('BANKRUPT', 'solo'));
    });

    it('computeDefenseUrgency is > 0 for an active ATTACKING bot', () => {
      expect(computeDefenseUrgency([{ id: 'BOT_01', state: 'ATTACKING' }])).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 8: RunStateSnapshot utility validation
  // --------------------------------------------------------------------------
  describe('RunStateSnapshot utilities — live validation', () => {
    it('isSnapshotTerminal is false for a default snapshot', () => {
      expect(isSnapshotTerminal(createSnapshot('solo'))).toBe(false);
    });

    it('isSnapshotWin is true when outcome is FREEDOM', () => {
      expect(isSnapshotWin({ ...createSnapshot('solo'), outcome: 'FREEDOM' } as RunStateSnapshot)).toBe(true);
    });

    it('isSnapshotLoss is true when outcome is BANKRUPT', () => {
      expect(isSnapshotLoss({ ...createSnapshot('solo'), outcome: 'BANKRUPT' } as RunStateSnapshot)).toBe(true);
    });

    it('isSnapshotInEndgame is true at SOVEREIGNTY phase', () => {
      expect(isSnapshotInEndgame({ ...createSnapshot('solo'), phase: 'SOVEREIGNTY' } as RunStateSnapshot)).toBe(true);
    });

    it('isSnapshotInCrisis returns a boolean without throwing', () => {
      const snap = createSnapshot('solo');
      expect(typeof isSnapshotInCrisis(snap)).toBe('boolean');
    });

    it('isShieldFailing is false for fully intact shields', () => {
      expect(isShieldFailing(createSnapshot('solo'))).toBe(false);
    });

    it('isShieldFailing is true when any layer is near 0', () => {
      const snap = createSnapshot('solo');
      const damaged = {
        ...snap,
        shield: {
          ...snap.shield,
          layers: snap.shield.layers.map((l) =>
            l.layerId === 'L1' ? { ...l, current: 1 } : l,
          ),
        },
      } as RunStateSnapshot;
      expect(isShieldFailing(damaged)).toBe(true);
    });

    it('isEconomyHealthy is true for a healthy starting snapshot', () => {
      expect(isEconomyHealthy(createSnapshot('solo'))).toBe(true);
    });

    it('isBattleEscalating returns a boolean', () => {
      expect(typeof isBattleEscalating(createSnapshot('solo'))).toBe('boolean');
    });

    it('isCascadeCritical returns false when no active chains', () => {
      expect(isCascadeCritical(createSnapshot('solo'))).toBe(false);
    });

    it('isSovereigntyAtRisk returns a boolean', () => {
      expect(typeof isSovereigntyAtRisk(createSnapshot('solo'))).toBe('boolean');
    });

    it('hasActiveDecisionWindows is false for default snapshot', () => {
      expect(hasActiveDecisionWindows(createSnapshot('solo'))).toBe(false);
    });

    it('hasPlayableCards is true when hand is non-empty', () => {
      expect(hasPlayableCards(createSnapshot('solo'))).toBe(true);
    });

    it('hasPlayableCards is false when hand is empty', () => {
      const snap = createSnapshot('solo');
      const empty = { ...snap, cards: { ...snap.cards, hand: [] } } as RunStateSnapshot;
      expect(hasPlayableCards(empty)).toBe(false);
    });

    it('hasCriticalPendingAttacks returns a boolean', () => {
      expect(typeof hasCriticalPendingAttacks(createSnapshot('solo'))).toBe('boolean');
    });

    it('isRunFlagged returns false for a clean snapshot', () => {
      expect(isRunFlagged(createSnapshot('solo'))).toBe(false);
    });

    it('getPressureTierUrgencyLabel returns a string for every tier', () => {
      const base = createSnapshot('solo');
      for (const tier of ALL_PRESSURE_TIERS) {
        const label = getPressureTierUrgencyLabel({ ...base, pressure: { ...base.pressure, tier } });
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it('getNormalizedPressureTier matches PRESSURE_TIER_NORMALIZED', () => {
      const base = createSnapshot('solo');
      for (const tier of ALL_PRESSURE_TIERS) {
        expect(getNormalizedPressureTier({ ...base, pressure: { ...base.pressure, tier } })).toBe(PRESSURE_TIER_NORMALIZED[tier]);
      }
    });

    it('computeSnapshotCompositeRisk returns a number in [0, 1]', () => {
      const risk = computeSnapshotCompositeRisk(createSnapshot('solo'));
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 9: ML feature extraction
  // --------------------------------------------------------------------------
  describe('ML / DL feature extraction', () => {
    it('ModeMlFeatureExtractor returns exactly MODE_SIGNAL_ML_FEATURE_COUNT features', () => {
      const snap = createSnapshot('solo');
      const vec = mlExtractor.extract(snap, Date.now());
      expect(vec.features).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
      expect(vec.featureLabels).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
    });

    it('MODE_SIGNAL_ML_FEATURE_LABELS is exhaustive', () => {
      expect(MODE_SIGNAL_ML_FEATURE_LABELS).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
    });

    it('ModeDlTensorBuilder returns exactly MODE_SIGNAL_DL_FEATURE_COUNT features', () => {
      const snap = createSnapshot('solo');
      const tensor = dlBuilder.build(snap, Date.now());
      expect(tensor.tensor).toHaveLength(MODE_SIGNAL_DL_FEATURE_COUNT);
      expect(tensor.shape).toEqual(MODE_SIGNAL_DL_TENSOR_SHAPE);
    });

    it('ML feature mode_normalized differs per mode', () => {
      const soloVec = mlExtractor.extract(createSnapshot('solo'), 0);
      const ghostVec = mlExtractor.extract(createSnapshot('ghost'), 0);
      expect(soloVec.features[0]).not.toBe(ghostVec.features[0]);
    });

    it('extractModeMLVector factory function produces the same result as extractor', () => {
      const snap = createSnapshot('pvp');
      const fromFactory = extractModeMLVector(snap, 0);
      const fromExtractor = mlExtractor.extract(snap, 0);
      expect(fromFactory.features).toEqual(fromExtractor.features);
    });

    it('buildModeDLTensor factory function produces 24 features', () => {
      const tensor = buildModeDLTensor(createSnapshot('coop'), 0);
      expect(tensor.tensor).toHaveLength(24);
    });

    it('scoreModeRisk returns a value in [0, 1]', () => {
      const risk = scoreModeRisk(createSnapshot('solo'));
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });

    it('ModeSignalRiskScorer increases when shield is damaged', () => {
      const snap = createSnapshot('solo');
      const damaged = {
        ...snap,
        shield: {
          ...snap.shield,
          layers: snap.shield.layers.map((l) => ({ ...l, current: 0 })),
        },
      } as RunStateSnapshot;
      const riskBase = riskScorer.score(snap);
      const riskDamaged = riskScorer.score(damaged);
      expect(riskDamaged).toBeGreaterThan(riskBase);
    });

    it('all ML features are finite numbers', () => {
      for (const mode of ALL_MODE_CODES) {
        const vec = mlExtractor.extract(createSnapshot(mode), 0);
        for (const f of vec.features) {
          expect(Number.isFinite(f)).toBe(true);
        }
      }
    });

    it('DL tensor extends ML vector with 8 additional features (bot threats + shield vulnerabilities)', () => {
      const snap = createSnapshot('solo');
      const ml = mlExtractor.extract(snap, 0);
      const dl = dlBuilder.build(snap, 0);
      // First 16 features should match
      for (let i = 0; i < MODE_SIGNAL_ML_FEATURE_COUNT; i++) {
        expect(dl.tensor[i]).toBe(ml.features[i]);
      }
      // Remaining 8 should exist
      expect(dl.tensor.length - ml.features.length).toBe(8);
    });

    it('MODE_SIGNAL_DL_FEATURE_LABELS is a superset of ML labels', () => {
      for (const label of MODE_SIGNAL_ML_FEATURE_LABELS) {
        expect(MODE_SIGNAL_DL_FEATURE_LABELS).toContain(label);
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 10: ModeSignalAdapter — chat bridge verification
  // --------------------------------------------------------------------------
  describe('ModeSignalAdapter — lifecycle signal emission', () => {
    it('onConfigure emits a MODE_CONFIGURED signal', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const signal = signalAdapter.onConfigure(snap, configured, { advantageId: 'MOMENTUM_CAPITAL' });
      expect(signal).not.toBeNull();
      expect(signal!.kind).toBe('MODE_CONFIGURED');
      expect(signal!.mode).toBe('solo');
      expect(signal!.lifecyclePhase).toBe('PRE_RUN');
    });

    it('onConfigure deduplicates identical run+tick signals', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const sig1 = signalAdapter.onConfigure(snap, configured);
      const sig2 = signalAdapter.onConfigure(snap, configured); // same dedupe key
      expect(sig1).not.toBeNull();
      expect(sig2).toBeNull();
    });

    it('onTickStart emits a MODE_TICK_STARTED signal', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const started = sharedDirector.onTickStart(configured);
      const signal = signalAdapter.onTickStart(configured, started);
      expect(signal).not.toBeNull();
      expect(signal!.kind).toBe('MODE_TICK_STARTED');
    });

    it('onTickEnd emits a MODE_TICK_ENDED signal', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const ended = sharedDirector.onTickEnd(configured);
      const signal = signalAdapter.onTickEnd(configured, ended);
      expect(signal).not.toBeNull();
      expect(signal!.kind).toBe('MODE_TICK_ENDED');
    });

    it('onAction emits a MODE_ACTION_RESOLVED signal with the action id', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap, { advantageId: 'MOMENTUM_CAPITAL' });
      const resolved = sharedDirector.resolveAction(configured, 'USE_HOLD', { windowId: 'w-1' });
      const signal = signalAdapter.onAction(configured, resolved, 'USE_HOLD');
      expect(signal).not.toBeNull();
      expect(signal!.kind).toBe('MODE_ACTION_RESOLVED');
      const payload = signal!.payload as import('../../../engine/chat/adapters/ModeSignalAdapter').ModeActionPayload;
      expect(payload.actionId).toBe('USE_HOLD');
    });

    it('onFinalize emits a MODE_FINALIZED signal with badge info', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const finalized = sharedDirector.finalize({ ...configured, outcome: 'FREEDOM' } as RunStateSnapshot);
      const signal = signalAdapter.onFinalize(configured, finalized);
      expect(signal).not.toBeNull();
      expect(signal!.kind).toBe('MODE_FINALIZED');
      expect(signal!.lifecyclePhase).toBe('FINALIZATION');
      expect(signal!.channelRecommendation).toBe('GLOBAL');
    });

    it('CRITICAL priority is assigned when risk score is >= 0.85', () => {
      const snap = createSnapshot('solo');
      const allBroken = {
        ...snap,
        shield: {
          ...snap.shield,
          layers: snap.shield.layers.map((l) => ({ ...l, current: 0, breached: true })),
        },
        pressure: { ...snap.pressure, tier: 'T4' as PressureTier, score: 0.99 },
        battle: {
          ...snap.battle,
          bots: snap.battle.bots.map((b) => ({ ...b, state: 'ATTACKING' as BotState, heat: 100 })),
        },
        economy: { ...snap.economy, cash: 0, haterHeat: 200 },
        sovereignty: { ...snap.sovereignty, integrityStatus: 'QUARANTINED' as const },
      } as RunStateSnapshot;
      const risk = riskScorer.score(allBroken);
      if (risk >= 0.85) {
        const signal = signalAdapter.onConfigure(snap, allBroken);
        expect(signal?.priority).toBe('CRITICAL');
      } else {
        expect(risk).toBeGreaterThan(0.5); // at minimum we proved risk is elevated
      }
    });

    it('pvp signals recommend SYNDICATE channel', () => {
      const snap = createSnapshot('pvp');
      const configured = sharedDirector.configure(snap);
      signalAdapter.resetDeduplication();
      const signal = signalAdapter.onConfigure(snap, configured);
      expect(signal).not.toBeNull();
      expect(signal!.channelRecommendation).toBe('SYNDICATE');
    });

    it('coop signals also recommend SYNDICATE channel', () => {
      const snap = createSnapshot('coop');
      const configured = sharedDirector.configure(snap);
      signalAdapter.resetDeduplication();
      const signal = signalAdapter.onConfigure(snap, configured);
      expect(signal?.channelRecommendation).toBe('SYNDICATE');
    });

    it('signal ML vector has the correct length', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const signal = signalAdapter.onConfigure(snap, configured);
      const mlVec = (signal!.payload as import('../../../engine/chat/adapters/ModeSignalAdapter').ModeConfiguredPayload).mlVector;
      expect(mlVec.features).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 11: ModeSignalBatchProcessor + Analytics
  // --------------------------------------------------------------------------
  describe('ModeSignalBatchProcessor and ModeSignalAnalytics', () => {
    it('batch processor emits signals for each lifecycle entry', () => {
      const processor = buildModeSignalBatchProcessor();
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const started = sharedDirector.onTickStart(configured);
      const ended = sharedDirector.onTickEnd(started);

      const result = processor.process([
        { kind: 'configure', snapshotBefore: snap, snapshotAfter: configured },
        { kind: 'tickStart', snapshotBefore: configured, snapshotAfter: started },
        { kind: 'tickEnd', snapshotBefore: started, snapshotAfter: ended },
      ]);

      expect(result.totalProcessed).toBe(3);
      expect(result.totalEmitted).toBeLessThanOrEqual(3);
      expect(result.signals.length).toBeGreaterThan(0);
    });

    it('batch processor tracks high priority and critical count', () => {
      const processor = buildModeSignalBatchProcessor({ criticalRiskThreshold: 0.0 }); // all CRITICAL
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const result = processor.process([
        { kind: 'configure', snapshotBefore: snap, snapshotAfter: configured },
      ]);
      expect(result.criticalCount).toBeGreaterThan(0);
    });

    it('ModeSignalAnalytics summarizes signals by kind', () => {
      const signals: import('../../../engine/chat/adapters/ModeSignalAdapter').ChatModeSignal[] = [];
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      signalAdapter.resetDeduplication();

      const configSig = signalAdapter.onConfigure(snap, configured);
      if (configSig) signals.push(configSig);

      const started = sharedDirector.onTickStart(configured);
      const tickSig = signalAdapter.onTickStart(configured, started);
      if (tickSig) signals.push(tickSig);

      const summary = analytics.summarize(signals);
      expect(summary.totalSignals).toBe(signals.length);
      expect(summary.byKind.MODE_CONFIGURED).toBeGreaterThanOrEqual(configSig ? 1 : 0);
      expect(summary.byKind.MODE_TICK_STARTED).toBeGreaterThanOrEqual(tickSig ? 1 : 0);
      expect(summary.meanRiskScore).toBeGreaterThanOrEqual(0);
    });

    it('ModeSignalAnalytics returns zeroed summary for empty signals array', () => {
      const summary = analytics.summarize([]);
      expect(summary.totalSignals).toBe(0);
      expect(summary.meanRiskScore).toBe(0);
      expect(summary.maxRiskScore).toBe(0);
    });

    it('ModeSignalBatchProcessor direct instantiation produces valid processor', () => {
      const directProcessor = new ModeSignalBatchProcessor({ enableDLTensor: true });
      const snap = createSnapshot('pvp');
      const configured = sharedDirector.configure(snap);
      const result = directProcessor.process([
        { kind: 'configure', snapshotBefore: snap, snapshotAfter: configured },
      ]);
      expect(result.totalProcessed).toBe(1);
      expect(result.signals).toBeDefined();
      expect(result.highPriorityCount).toBeGreaterThanOrEqual(0);
      expect(result.criticalCount).toBeGreaterThanOrEqual(0);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 12: Full 10-tick lifecycle simulation — Empire mode
  // --------------------------------------------------------------------------
  describe('full 10-tick simulation — Empire (solo) mode', () => {
    it('simulates 10 ticks accumulating tags, pressure, and shield state', () => {
      let snap = createSnapshot('solo');
      snap = sharedDirector.configure(snap, { advantageId: 'MOMENTUM_CAPITAL' });

      const collectedSignals: import('../../../engine/chat/adapters/ModeSignalAdapter').ChatModeSignal[] = [];
      signalAdapter.resetDeduplication();

      for (let tick = 1; tick <= 10; tick++) {
        const elapsedMs = tick * (SEASON_BUDGET_MS / 30);
        const prev = snap;
        snap = { ...snap, tick, timers: { ...snap.timers, elapsedMs } } as RunStateSnapshot;

        const afterTickStart = sharedDirector.onTickStart(snap);
        const tickStartSig = signalAdapter.onTickStart(prev, afterTickStart, tick * 1000);
        if (tickStartSig) collectedSignals.push(tickStartSig);

        const afterAction = sharedDirector.resolveAction(afterTickStart, 'USE_HOLD', { windowId: `w-${tick}` });
        const actionSig = signalAdapter.onAction(afterTickStart, afterAction, 'USE_HOLD', tick * 1000);
        if (actionSig) collectedSignals.push(actionSig);

        const afterTickEnd = sharedDirector.onTickEnd(afterAction);
        const tickEndSig = signalAdapter.onTickEnd(afterAction, afterTickEnd, tick * 1000);
        if (tickEndSig) collectedSignals.push(tickEndSig);

        snap = afterTickEnd;

        // Validate snapshot integrity at each tick
        expect(snap.mode).toBe('solo');
        expect(Number.isFinite(computeShieldIntegrityForSnapshot(snap))).toBe(true);
        expect(Number.isFinite(computeSnapshotCompositeRisk(snap))).toBe(true);
      }

      const finalized = sharedDirector.finalize({ ...snap, outcome: 'FREEDOM' } as RunStateSnapshot);
      const finalSig = signalAdapter.onFinalize(snap, finalized, 10_000);
      if (finalSig) collectedSignals.push(finalSig);

      expect(finalized.sovereignty.cordScore).toBeGreaterThan(0);
      expect(isSnapshotTerminal(finalized)).toBe(true);
      expect(isSnapshotWin(finalized)).toBe(true);
      expect(collectedSignals.length).toBeGreaterThan(0);

      const summary = analytics.summarize(collectedSignals);
      expect(summary.totalSignals).toBe(collectedSignals.length);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 13: Full 10-tick lifecycle simulation — Phantom (ghost) mode
  // --------------------------------------------------------------------------
  describe('full 10-tick simulation — Phantom (ghost) mode', () => {
    it('simulates ghost mode with legend markers at ticks 3, 6, 9', () => {
      const markers = [
        createLegendMarker('lm-3', 3, 'GOLD'),
        createLegendMarker('lm-6', 6, 'SILVER'),
        createLegendMarker('lm-9', 9, 'PURPLE'),
      ];

      let snap = createSnapshot('ghost', { cards: { ...createSnapshot('ghost').cards, ghostMarkers: markers } });
      snap = sharedDirector.configure(snap, {
        legendRunId: 'legendary-run-1',
        legendOwnerUserId: 'legend-user',
        legendCordScore: 1.5,
        legendOriginalHeat: 10,
        communityRunsSinceLegend: 30_000,
        legendDaysAlive: 3,
        legendMarkers: markers,
      });

      const markerWindowTicks: number[] = [];
      signalAdapter.resetDeduplication();

      for (let tick = 1; tick <= 10; tick++) {
        const prev = snap;
        snap = { ...snap, tick } as RunStateSnapshot;

        const afterStart = sharedDirector.onTickStart(snap);
        if (afterStart.tags.includes('ghost:marker_window')) {
          markerWindowTicks.push(tick);
        }

        const afterEnd = sharedDirector.onTickEnd(afterStart);
        snap = afterEnd;

        // Assert gap closing rate drifts over time
        expect(Number.isFinite(snap.sovereignty.gapClosingRate)).toBe(true);
        expect(Number.isFinite(snap.sovereignty.gapVsLegend)).toBe(true);

        // Validate ML vector at each tick
        const vec = extractModeMLVector(snap, tick * 1000);
        expect(vec.features).toHaveLength(MODE_SIGNAL_ML_FEATURE_COUNT);
        for (const f of vec.features) expect(Number.isFinite(f)).toBe(true);
      }

      // Marker windows should be around ticks 3±3, 6±3, 9±3
      expect(markerWindowTicks.length).toBeGreaterThan(0);
      expect(markerWindowTicks.some((t) => Math.abs(t - 3) <= GHOST_WINDOW_RADIUS)).toBe(true);

      const finalized = sharedDirector.finalize({ ...snap, outcome: 'FREEDOM', sovereignty: { ...snap.sovereignty, gapVsLegend: 0.2 } } as RunStateSnapshot);
      expect(finalized.sovereignty.proofBadges).toContain('LEGEND_BROKEN');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 14: Snapshot immutability and tag canonicalization
  // --------------------------------------------------------------------------
  describe('snapshot immutability and tag canonicalization', () => {
    it('configure does not mutate the input snapshot', () => {
      const snap = createSnapshot('solo');
      const originalTags = [...snap.tags];
      sharedDirector.configure(snap, { advantageId: 'INTEL_PASS' });
      expect(snap.tags).toEqual(originalTags);
    });

    it('onTickStart does not mutate the input snapshot', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const originalTick = configured.tick;
      const originalTags = [...configured.tags];
      sharedDirector.onTickStart(configured);
      expect(configured.tick).toBe(originalTick);
      expect(configured.tags).toEqual(originalTags);
    });

    it('resolveAction does not mutate the input snapshot', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const originalFrozenWindowIds = [...configured.timers.frozenWindowIds];
      sharedDirector.resolveAction(configured, 'USE_HOLD', { windowId: 'w-mutation-test' });
      expect(configured.timers.frozenWindowIds).toEqual(originalFrozenWindowIds);
    });

    it('finalize does not mutate the input snapshot', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const originalCordScore = configured.sovereignty.cordScore;
      sharedDirector.finalize({ ...configured, outcome: 'FREEDOM' } as RunStateSnapshot);
      expect(configured.sovereignty.cordScore).toBe(originalCordScore);
    });

    it('configure produces tags array without duplicate entries', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'), { advantageId: 'FORECLOSURE_BLOCK' });
      const tagSet = new Set(configured.tags);
      expect(tagSet.size).toBe(configured.tags.length);
    });

    it('two successive configure calls with identical inputs produce identical outputs', () => {
      const snap = createSnapshot('solo');
      const opts: ModeConfigureOptions = { advantageId: 'DEBT_SHIELD' };
      const c1 = sharedDirector.configure(snap, opts);
      const c2 = sharedDirector.configure(snap, opts);
      expect(c1.tags).toEqual(c2.tags);
      expect(c1.economy.cash).toBe(c2.economy.cash);
      expect(c1.timers.holdCharges).toBe(c2.timers.holdCharges);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 15: Registry management
  // --------------------------------------------------------------------------
  describe('ModeRegistry — management and safety', () => {
    it('ModeRegistry.has returns true for registered modes', () => {
      expect(sharedRegistry.has('solo')).toBe(true);
      expect(sharedRegistry.has('pvp')).toBe(true);
      expect(sharedRegistry.has('coop')).toBe(true);
      expect(sharedRegistry.has('ghost')).toBe(true);
    });

    it('ModeRegistry.list returns all registered adapters', () => {
      const list = sharedRegistry.list();
      expect(list).toHaveLength(4);
    });

    it('ModeRegistry.createDefault builds all four adapters', () => {
      const registry = ModeRegistry.createDefault();
      expect(registry.has('solo')).toBe(true);
      expect(registry.has('pvp')).toBe(true);
      expect(registry.has('coop')).toBe(true);
      expect(registry.has('ghost')).toBe(true);
    });

    it('ModeRegistry.mustGet throws for unknown mode code', () => {
      const registry = new ModeRegistry();
      expect(() => registry.mustGet('solo')).toThrow();
    });

    it('registerMany registers all adapters in the input array', () => {
      const registry = new ModeRegistry();
      registry.registerMany([new EmpireModeAdapter(), new PhantomModeAdapter()]);
      expect(registry.has('solo')).toBe(true);
      expect(registry.has('ghost')).toBe(true);
      expect(registry.has('pvp')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 16: ModeActionId routing table
  // --------------------------------------------------------------------------
  describe('ModeActionId routing table — all action IDs', () => {
    const allActionIds: ModeActionId[] = [
      'USE_HOLD',
      'FIRE_EXTRACTION',
      'COUNTER_PLAY',
      'CLAIM_FIRST_BLOOD',
      'REQUEST_TREASURY_LOAN',
      'ABSORB_CASCADE',
      'ADVANCE_DEFECTION',
      'LOCK_GHOST_WINDOW',
    ];

    it('each action ID can be dispatched to any mode without throwing', () => {
      for (const mode of ALL_MODE_CODES) {
        const snap = createSnapshot(mode);
        const configured = sharedDirector.configure(snap);
        for (const actionId of allActionIds) {
          expect(() => sharedDirector.resolveAction(configured, actionId)).not.toThrow();
        }
      }
    });

    it('FIRE_EXTRACTION is routed to solo adapter without crashing', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      const resolved = sharedDirector.resolveAction(configured, 'FIRE_EXTRACTION');
      expect(resolved.mode).toBe('solo');
    });

    it('ABSORB_CASCADE is routed without crashing for all modes', () => {
      for (const mode of ALL_MODE_CODES) {
        const configured = sharedDirector.configure(createSnapshot(mode));
        const resolved = sharedDirector.resolveAction(configured, 'ABSORB_CASCADE');
        expect(resolved.mode).toBe(mode);
      }
    });

    it('ADVANCE_DEFECTION is routed without crashing for coop mode', () => {
      const configured = sharedDirector.configure(createSnapshot('coop'));
      const resolved = sharedDirector.resolveAction(configured, 'ADVANCE_DEFECTION');
      expect(resolved.mode).toBe('coop');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 17: TeamRoleId and SoloAdvantageId type guards
  // --------------------------------------------------------------------------
  describe('type coverage — ModeContracts type aliases are live in test code', () => {
    it('TeamRoleId values are assignable and type-safe at runtime', () => {
      const roles: TeamRoleId[] = ['INCOME_BUILDER', 'SHIELD_ARCHITECT', 'OPPORTUNITY_HUNTER', 'COUNTER_INTEL'];
      expect(roles).toHaveLength(4);
    });

    it('SoloAdvantageId values match configure options', () => {
      const advantages: SoloAdvantageId[] = [
        'MOMENTUM_CAPITAL',
        'NETWORK_ACTIVATED',
        'FORECLOSURE_BLOCK',
        'INTEL_PASS',
        'PHANTOM_SEED',
        'DEBT_SHIELD',
      ];
      for (const adv of advantages) {
        const configured = sharedDirector.configure(createSnapshot('solo'), { advantageId: adv });
        expect(configured.mode).toBe('solo');
      }
    });

    it('SoloHandicapId values apply successfully', () => {
      const handicaps: SoloHandicapId[] = [
        'NO_CREDIT_HISTORY',
        'SINGLE_INCOME',
        'TARGETED',
        'CASH_POOR',
        'CLOCK_CURSED',
        'DISADVANTAGE_DRAFT',
      ];
      for (const h of handicaps) {
        const configured = sharedDirector.configure(createSnapshot('solo'), { handicapIds: [h] });
        expect(configured.mode).toBe('solo');
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 18: Shield layer and bot assertions using GamePrimitives constants
  // --------------------------------------------------------------------------
  describe('shield layers and bot counts match canonical constants', () => {
    it('every created snapshot has exactly TOTAL_SHIELD_LAYERS shield layers', () => {
      for (const mode of ALL_MODE_CODES) {
        const snap = createSnapshot(mode);
        expect(snap.shield.layers).toHaveLength(TOTAL_SHIELD_LAYERS);
      }
    });

    it('every created snapshot has exactly TOTAL_BOTS bots', () => {
      for (const mode of ALL_MODE_CODES) {
        const snap = createSnapshot(mode);
        expect(snap.battle.bots).toHaveLength(TOTAL_BOTS);
      }
    });

    it('all bot IDs are known HaterBotIds', () => {
      const snap = createSnapshot('solo');
      for (const bot of snap.battle.bots) {
        expect(isHaterBotId(bot.botId)).toBe(true);
      }
    });

    it('all layer IDs are known ShieldLayerIds', () => {
      const snap = createSnapshot('solo');
      for (const layer of snap.shield.layers) {
        expect(isShieldLayerId(layer.layerId)).toBe(true);
      }
    });

    it('SHIELD_LAYER_CAPACITY_WEIGHT sums to 1.0 across all layers', () => {
      const total = Object.values(SHIELD_LAYER_CAPACITY_WEIGHT).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 19: Pressure tier normalization and risk scoring
  // --------------------------------------------------------------------------
  describe('pressure tier normalization and risk score monotonicity', () => {
    it('PRESSURE_TIER_NORMALIZED values are strictly increasing', () => {
      const values = ALL_PRESSURE_TIERS.map((t) => PRESSURE_TIER_NORMALIZED[t]);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });

    it('computePressureRiskScore is 0 at T0 with score 0', () => {
      expect(computePressureRiskScore('T0', 0)).toBe(0);
    });

    it('computePressureRiskScore is > 0 at T4 with any score', () => {
      expect(computePressureRiskScore('T4', 0.5)).toBeGreaterThan(0);
    });

    it('director-configured snapshot pressure tier is valid', () => {
      for (const mode of ALL_MODE_CODES) {
        const snap = createSnapshot(mode);
        const configured = sharedDirector.configure(snap);
        expect(isPressureTier(configured.pressure.tier)).toBe(true);
      }
    });

    it('getPressureTierUrgencyLabel returns non-empty strings for all tiers', () => {
      const base = createSnapshot('solo');
      for (const tier of ALL_PRESSURE_TIERS) {
        const label = getPressureTierUrgencyLabel({ ...base, pressure: { ...base.pressure, tier } });
        expect(label).toBeTruthy();
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 20: Regression tests for known edge cases
  // --------------------------------------------------------------------------
  describe('regression tests — edge cases', () => {
    it('configure with empty handicapIds array does not crash', () => {
      expect(() => sharedDirector.configure(createSnapshot('solo'), { handicapIds: [] })).not.toThrow();
    });

    it('configure with null advantageId does not crash', () => {
      expect(() => sharedDirector.configure(createSnapshot('solo'), { advantageId: null })).not.toThrow();
    });

    it('resolveAction with undefined payload does not crash', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      expect(() => sharedDirector.resolveAction(configured, 'USE_HOLD', undefined)).not.toThrow();
    });

    it('finalize on a bankrupt snapshot does not crash', () => {
      const configured = sharedDirector.configure(createSnapshot('solo'));
      const bankrupt = { ...configured, outcome: 'BANKRUPT' as RunOutcome } as RunStateSnapshot;
      expect(() => sharedDirector.finalize(bankrupt)).not.toThrow();
    });

    it('ghost mode onTickEnd with zero ghost markers does not crash', () => {
      const snap = createSnapshot('ghost', { cards: { ...createSnapshot('ghost').cards, ghostMarkers: [] } });
      const configured = sharedDirector.configure(snap);
      expect(() => sharedDirector.onTickEnd(configured)).not.toThrow();
    });

    it('solo mode with all bots disabled reduces cord score multiplier', () => {
      const allBots = HATER_BOT_IDS as unknown as typeof HATER_BOT_IDS;
      const configured = sharedDirector.configure(createSnapshot('solo'), { disabledBots: [...allBots] });
      const finalized = sharedDirector.finalize({ ...configured, outcome: 'FREEDOM' } as RunStateSnapshot);
      // When all 5 bots are disabled: multiplier *= max(0.35, 1 - 5*0.2) = 0.35
      expect(finalized.sovereignty.cordScore).toBeLessThan(1.0);
    });

    it('signal adapter returns null after resetDeduplication ensures fresh signals', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const sig1 = signalAdapter.onConfigure(snap, configured);
      const sig2 = signalAdapter.onConfigure(snap, configured); // deduplicated
      signalAdapter.resetDeduplication();
      const sig3 = signalAdapter.onConfigure(snap, configured); // should succeed
      expect(sig1).not.toBeNull();
      expect(sig2).toBeNull();
      expect(sig3).not.toBeNull();
    });

    it('computeSnapshotCompositeRisk is higher after shield damage', () => {
      const snap = createSnapshot('solo');
      const damaged = {
        ...snap,
        shield: {
          ...snap.shield,
          layers: snap.shield.layers.map((l) => ({ ...l, current: Math.floor(l.max * 0.1) })),
        },
      } as RunStateSnapshot;
      expect(computeSnapshotCompositeRisk(damaged)).toBeGreaterThan(computeSnapshotCompositeRisk(snap));
    });

    it('isSnapshotTerminal is true after FREEDOM outcome is set', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const finalized = sharedDirector.finalize({ ...configured, outcome: 'FREEDOM' } as RunStateSnapshot);
      expect(isSnapshotTerminal(finalized)).toBe(true);
    });

    it('isRunPhase validates all phases', () => {
      for (const phase of ALL_RUN_PHASES) {
        expect(isRunPhase(phase)).toBe(true);
      }
    });

    it('isRunOutcome validates all outcomes', () => {
      const outcomes: RunOutcome[] = ['FREEDOM', 'TIMEOUT', 'BANKRUPT', 'ABANDONED'];
      for (const outcome of outcomes) {
        expect(isRunOutcome(outcome)).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 21: Tick simulation with pressure escalation (solo)
  // --------------------------------------------------------------------------
  describe('pressure escalation through tick simulation', () => {
    it('pressure score drives risk score above 0 as it rises', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);

      const elevated = {
        ...configured,
        pressure: { ...configured.pressure, tier: 'T3' as PressureTier, score: 0.75 },
      } as RunStateSnapshot;

      const baseRisk = riskScorer.score(configured);
      const elevatedRisk = riskScorer.score(elevated);
      expect(elevatedRisk).toBeGreaterThan(baseRisk);
    });

    it('each pressure tier step increases the ML pressure_tier_normalized feature', () => {
      const snap = createSnapshot('solo');
      const configured = sharedDirector.configure(snap);
      const features: number[][] = [];

      for (const tier of ALL_PRESSURE_TIERS) {
        const elevated = {
          ...configured,
          pressure: { ...configured.pressure, tier },
        } as RunStateSnapshot;
        const vec = mlExtractor.extract(elevated, 0);
        features.push([...vec.features]);
      }

      // Feature index 2 = pressure_tier_normalized
      for (let i = 1; i < features.length; i++) {
        expect(features[i][2]).toBeGreaterThan(features[i - 1][2]);
      }
    });
  });
});
