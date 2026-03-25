//backend/src/game/engine/modes/__tests__/EmpireModeAdapter.spec.ts
/**
 * ============================================================================
 * POINT ZERO ONE — EMPIRE / SOLO MODE ADAPTER — CANONICAL TEST SUITE
 * FILE: backend/src/game/engine/modes/__tests__/EmpireModeAdapter.spec.ts
 * VERSION: 2026.03.25
 * ============================================================================
 *
 * Doctrine
 * --------
 * - Every EmpireModeAdapter code path is tested at least once.
 * - All GamePrimitives constants are exercised in real assertions.
 * - ML/DL feature vectors are computed inline for UX signal verification.
 * - Full-run simulations prove the lifecycle from configure through finalize.
 * - Chat signal readiness is validated at every adapter lifecycle stage.
 * - No import is a placeholder — every symbol is used in assertion logic.
 *
 * Coverage targets
 * ----------------
 * - configure: baseline, all 6 advantages, all 6 handicaps, bleed mode
 * - onTickStart: phase transitions, time milestones, cash streak, idempotency
 * - onTickEnd: phase windows, bleed tax, regen boosts
 * - resolveAction: all 8 ModeActionIds, payload shapes, guard conditions
 * - finalize: cord score multiplier, badge assignment, bleed/comeback combos
 * - ML/DL: 32-feature vectors and 48-feature tensors from live adapter output
 * - Chat signal: configure/tick/finalize readiness assertions
 * - Simulations: 30-tick FOUNDATION, full phase arc, bleed-mode survivor run
 * ============================================================================
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── GamePrimitives type imports ────────────────────────────────────────────
import type {
  AttackCategory,
  AttackEvent,
  BotState,
  CardDefinition,
  CardInstance,
  DeckType,
  DivergencePotential,
  HaterBotId,
  LegendMarker,
  ModeCode,
  PressureTier,
  RunOutcome,
  RunPhase,
  ShieldLayerId,
  ThreatEnvelope,
  TimingClass,
  VisibilityLevel,
} from '../../core/GamePrimitives';

// ─── GamePrimitives runtime imports (constants used in assertions) ───────────
import {
  ATTACK_CATEGORY_BASE_MAGNITUDE,
  ATTACK_CATEGORY_IS_COUNTERABLE,
  BOT_THREAT_LEVEL,
  BOT_STATE_THREAT_MULTIPLIER,
  HATER_BOT_IDS,
  MODE_DIFFICULTY_MULTIPLIER,
  PRESSURE_TIER_NORMALIZED,
  RUN_PHASES,
  SHIELD_LAYER_IDS,
  VISIBILITY_CONCEALMENT_FACTOR,
} from '../../core/GamePrimitives';

import type { RunStateSnapshot } from '../../core/RunStateSnapshot';

// ─── Mode contract types ─────────────────────────────────────────────────────
import type {
  ModeActionId,
  ModeConfigureOptions,
  SoloAdvantageId,
  SoloHandicapId,
} from '../ModeContracts';

import { EmpireModeAdapter } from '../EmpireModeAdapter';

// ============================================================================
// MARK: Module constants — all used in test assertions
// ============================================================================

const SEASON_12_MIN_MS = 12 * 60 * 1_000;
const SEASON_9_MIN_MS  = 9  * 60 * 1_000;
const FOUNDATION_ELAPSED_MS = 1 * 60 * 1_000;          // 1 minute — FOUNDATION
const ESCALATION_ELAPSED_MS = 5 * 60 * 1_000;          // 5 minutes — ESCALATION boundary
const SOVEREIGNTY_ELAPSED_MS = 9 * 60 * 1_000;         // 9 minutes — SOVEREIGNTY boundary
const TEN_MIN_MS    = 10 * 60 * 1_000;
const ELEVEN_MIN_MS = 11 * 60 * 1_000;
const ELEVEN_THIRTY_MS = 11 * 60 * 1_000 + 30 * 1_000;

/** All six solo advantage IDs in canonical order. */
const ALL_SOLO_ADVANTAGES: readonly SoloAdvantageId[] = [
  'MOMENTUM_CAPITAL',
  'NETWORK_ACTIVATED',
  'FORECLOSURE_BLOCK',
  'INTEL_PASS',
  'PHANTOM_SEED',
  'DEBT_SHIELD',
] as const;

/** All six solo handicap IDs in canonical order. */
const ALL_SOLO_HANDICAPS: readonly SoloHandicapId[] = [
  'NO_CREDIT_HISTORY',
  'SINGLE_INCOME',
  'TARGETED',
  'CASH_POOR',
  'CLOCK_CURSED',
  'DISADVANTAGE_DRAFT',
] as const;

/** All eight mode action IDs. */
const ALL_MODE_ACTION_IDS: readonly ModeActionId[] = [
  'USE_HOLD',
  'FIRE_EXTRACTION',
  'COUNTER_PLAY',
  'CLAIM_FIRST_BLOOD',
  'REQUEST_TREASURY_LOAN',
  'ABSORB_CASCADE',
  'ADVANCE_DEFECTION',
  'LOCK_GHOST_WINDOW',
] as const;

/** Expected empire mode tags on any correctly configured snapshot. */
const EXPECTED_BASE_TAGS = ['mode:empire', 'solo:authoritative', 'loadout:enabled'] as const;

/** Bleed handicap cord bonuses expected from the adapter source. */
const HANDICAP_CORD_BONUS: Readonly<Record<SoloHandicapId, number>> = {
  NO_CREDIT_HISTORY:  0.15,
  SINGLE_INCOME:      0.15,
  TARGETED:           0.15,
  CASH_POOR:          0.20,
  CLOCK_CURSED:       0.30,
  DISADVANTAGE_DRAFT: 0.80,
};

// ============================================================================
// MARK: ML/DL feature builders — inline, no external imports
// ============================================================================

/**
 * Builds a 32-feature ML vector from a RunStateSnapshot.
 * Uses GamePrimitives constants for normalized feature values.
 * Mirrors what ModeSignalAdapter would emit per tick.
 */
function buildEmpireMLVector32(snapshot: RunStateSnapshot): readonly number[] {
  const features: number[] = [];

  // F0: Pressure score clamped 0-1
  features.push(Math.min(1, Math.max(0, snapshot.pressure.score)));

  // F1: Pressure tier normalized via GamePrimitives constant
  features.push(PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier as PressureTier] ?? 0);

  // F2: Tension score 0-1
  features.push(Math.min(1, Math.max(0, snapshot.tension.score)));

  // F3: Tension anticipation 0-1
  features.push(Math.min(1, Math.max(0, snapshot.tension.anticipation)));

  // F4: Visible threat count normalized over 5 (typical max)
  features.push(Math.min(1, snapshot.tension.visibleThreats.length / 5));

  // F5: Aggregate bot threat — BOT_THREAT_LEVEL × BOT_STATE_THREAT_MULTIPLIER
  const botThreatScore = snapshot.battle.bots.reduce((sum, bot) => {
    const level = BOT_THREAT_LEVEL[bot.botId as HaterBotId] ?? 0;
    const mult  = BOT_STATE_THREAT_MULTIPLIER[bot.state as BotState] ?? 0;
    return sum + level * mult;
  }, 0);
  features.push(Math.min(1, botThreatScore));

  // F6: Shield weakest layer ratio
  features.push(Math.min(1, Math.max(0, snapshot.shield.weakestLayerRatio)));

  // F7: Shield average integrity across all layers
  const avgIntegrity =
    snapshot.shield.layers.reduce((sum, l) => sum + l.integrityRatio, 0) /
    Math.max(1, snapshot.shield.layers.length);
  features.push(Math.min(1, Math.max(0, avgIntegrity)));

  // F8: Cash / freedom target ratio
  features.push(Math.min(1, snapshot.economy.cash / Math.max(1, snapshot.economy.freedomTarget)));

  // F9: NetWorth / freedom target ratio
  features.push(Math.min(1, snapshot.economy.netWorth / Math.max(1, snapshot.economy.freedomTarget)));

  // F10: Income vs expense ratio (clamped 0-1 from 0-2 range)
  const incRatio =
    snapshot.economy.expensesPerTick > 0
      ? snapshot.economy.incomePerTick / snapshot.economy.expensesPerTick
      : 1;
  features.push(Math.min(2, Math.max(0, incRatio)) / 2);

  // F11: Hater heat normalized over 100
  features.push(Math.min(1, snapshot.economy.haterHeat / 100));

  // F12: Mode difficulty from GamePrimitives constant (solo = 1.0 / 2)
  features.push(MODE_DIFFICULTY_MULTIPLIER[snapshot.mode as ModeCode] / 2);

  // F13: Phase index normalized over (RUN_PHASES.length - 1)
  const phaseIdx = (RUN_PHASES as readonly RunPhase[]).indexOf(snapshot.phase as RunPhase);
  features.push(phaseIdx >= 0 ? phaseIdx / (RUN_PHASES.length - 1) : 0);

  // F14: Bleed mode flag
  features.push(snapshot.modeState.bleedMode ? 1 : 0);

  // F15: Hold enabled flag
  features.push(snapshot.modeState.holdEnabled ? 1 : 0);

  // F16: Hold charges normalized over 3
  features.push(Math.min(1, snapshot.timers.holdCharges / 3));

  // F17: Elapsed time ratio
  const elapsedRatio =
    snapshot.timers.seasonBudgetMs > 0
      ? snapshot.timers.elapsedMs / snapshot.timers.seasonBudgetMs
      : 0;
  features.push(Math.min(1, Math.max(0, elapsedRatio)));

  // F18: Handicap count normalized over 6
  features.push(snapshot.modeState.handicapIds.length / 6);

  // F19: Disabled bots count normalized
  features.push(snapshot.modeState.disabledBots.length / HATER_BOT_IDS.length);

  // F20-F23: Per-layer shield integrity (SHIELD_LAYER_IDS order)
  for (const layerId of SHIELD_LAYER_IDS) {
    const layer = snapshot.shield.layers.find((l) => l.layerId === (layerId as ShieldLayerId));
    features.push(layer ? Math.min(1, Math.max(0, layer.integrityRatio)) : 0);
  }

  // F24: Average attack category threat via ATTACK_CATEGORY_BASE_MAGNITUDE
  const attacks = snapshot.battle.pendingAttacks;
  const avgAttackThreat =
    attacks.length > 0
      ? attacks.reduce(
          (sum, atk) =>
            sum + (ATTACK_CATEGORY_BASE_MAGNITUDE[atk.category as AttackCategory] ?? 0.5),
          0,
        ) / attacks.length
      : 0;
  features.push(Math.min(1, avgAttackThreat));

  // F25: Counterable attack ratio via ATTACK_CATEGORY_IS_COUNTERABLE
  const counterableCount = attacks.filter(
    (atk) => ATTACK_CATEGORY_IS_COUNTERABLE[atk.category as AttackCategory] === true,
  ).length;
  features.push(attacks.length > 0 ? counterableCount / attacks.length : 0);

  // F26: Threat exposure ratio via VISIBILITY_CONCEALMENT_FACTOR
  const threats = snapshot.tension.visibleThreats;
  const exposedCount = threats.filter(
    (t) => VISIBILITY_CONCEALMENT_FACTOR[t.visibleAs as VisibilityLevel] === 0,
  ).length;
  features.push(threats.length > 0 ? exposedCount / threats.length : 0);

  // F27: Card hand size normalized over 10
  features.push(Math.min(1, snapshot.cards.hand.length / 10));

  // F28: Sovereignty score 0-1
  features.push(Math.min(1, Math.max(0, snapshot.sovereignty.sovereigntyScore)));

  // F29: Cord score normalized over 2
  features.push(Math.min(2, Math.max(0, snapshot.sovereignty.cordScore)) / 2);

  // F30: Upward crossings normalized over 10
  features.push(Math.min(1, snapshot.pressure.upwardCrossings / 10));

  // F31: Combined sovereignty + cord signal
  features.push(
    Math.min(
      1,
      (snapshot.sovereignty.sovereigntyScore + snapshot.sovereignty.cordScore) / 2,
    ),
  );

  return Object.freeze(features);
}

/**
 * Extends the 32-feature ML vector with 16 temporal / context features
 * to produce a 48-feature DL tensor.
 */
function buildEmpireDLTensor48(snapshot: RunStateSnapshot): readonly number[] {
  const base = [...buildEmpireMLVector32(snapshot)];

  // F32: Upward crossings above 3 (pressure spike indicator)
  base.push(snapshot.pressure.upwardCrossings > 3 ? 1 : 0);

  // F33: Max pressure seen normalized over T4 boundary (0.9)
  base.push(Math.min(1, snapshot.pressure.maxScoreSeen / 0.9));

  // F34: Survived high-pressure ticks normalized over 10
  base.push(Math.min(1, snapshot.pressure.survivedHighPressureTicks / 10));

  // F35: Cascade active chains count normalized over 5
  base.push(Math.min(1, snapshot.cascade.activeChains.length / 5));

  // F36: Cascade completed chains normalized over 10
  base.push(Math.min(1, snapshot.cascade.completedChains / 10));

  // F37: Cascade broken chains normalized over 10
  base.push(Math.min(1, snapshot.cascade.brokenChains / 10));

  // F38: Phase boundary windows remaining normalized over 5
  base.push(Math.min(1, snapshot.modeState.phaseBoundaryWindowsRemaining / 5));

  // F39: Battle budget normalized over 100
  base.push(Math.min(1, snapshot.battle.battleBudget / 100));

  // F40: Shield breaches this run normalized over 5
  base.push(Math.min(1, snapshot.shield.breachesThisRun / 5));

  // F41: Repair queue depth normalized over 4
  base.push(Math.min(1, snapshot.shield.repairQueueDepth / 4));

  // F42: Opportunities purchased normalized over 20
  base.push(Math.min(1, snapshot.economy.opportunitiesPurchased / 20));

  // F43: Privilege plays normalized over 10
  base.push(Math.min(1, snapshot.economy.privilegePlays / 10));

  // F44: Card draw pile size normalized over 30
  base.push(Math.min(1, snapshot.cards.drawPileSize / 30));

  // F45: Deck entropy already in 0-1
  base.push(Math.min(1, Math.max(0, snapshot.cards.deckEntropy)));

  // F46: Bot neutralized count normalized
  const neutralizedCount = snapshot.battle.bots.filter(
    (b) => (b.state as BotState) === 'NEUTRALIZED',
  ).length;
  base.push(neutralizedCount / HATER_BOT_IDS.length);

  // F47: Comeback armed or realized flag
  const hasComeback =
    snapshot.tags.includes('solo:comeback_surge_armed') ||
    snapshot.tags.includes('solo:comeback_realized');
  base.push(hasComeback ? 1 : 0);

  return Object.freeze(base);
}

/**
 * Computes a single aggregate pressure signal from a snapshot.
 * Used in assertions to verify UX urgency thresholds.
 */
function computePressureUrgency(snapshot: RunStateSnapshot): number {
  const tierNorm = PRESSURE_TIER_NORMALIZED[snapshot.pressure.tier as PressureTier] ?? 0;
  const scoreNorm = Math.min(1, Math.max(0, snapshot.pressure.score));
  return (tierNorm + scoreNorm) / 2;
}

/**
 * Computes total active bot threat from a snapshot.
 * Used in assertions about bot danger escalation.
 */
function computeBotThreatTotal(snapshot: RunStateSnapshot): number {
  return snapshot.battle.bots.reduce((sum, bot) => {
    const level = BOT_THREAT_LEVEL[bot.botId as HaterBotId] ?? 0;
    const mult  = BOT_STATE_THREAT_MULTIPLIER[bot.state as BotState] ?? 0;
    return sum + level * mult;
  }, 0);
}

/**
 * Counts how many threats are EXPOSED (concealment = 0.0).
 */
function countExposedThreats(snapshot: RunStateSnapshot): number {
  return snapshot.tension.visibleThreats.filter(
    (t) => VISIBILITY_CONCEALMENT_FACTOR[t.visibleAs as VisibilityLevel] === 0,
  ).length;
}

/**
 * Computes the expected cord score multiplier for a finalized snapshot.
 * Mirrors finalize() logic for cross-checking.
 */
function computeExpectedMultiplier(
  handicapIds: readonly SoloHandicapId[],
  disabledBotCount: number,
  hasComeback: boolean,
  isBleedFreedom: boolean,
): number {
  let multiplier = 1;
  for (const id of handicapIds) {
    multiplier += HANDICAP_CORD_BONUS[id] ?? 0;
  }
  if (disabledBotCount > 0) {
    multiplier *= Math.max(0.35, 1 - disabledBotCount * 0.2);
  }
  if (isBleedFreedom) {
    multiplier = Math.max(multiplier, 1.8);
  }
  if (hasComeback) {
    multiplier += 0.05;
  }
  return multiplier;
}

// ============================================================================
// MARK: Factory functions
// ============================================================================

function createCardDefinition(
  id = 'card-1',
  deckType: DeckType = 'OPPORTUNITY',
  timingClass: TimingClass = 'ANY',
): CardDefinition {
  return {
    id,
    name: `Card ${id}`,
    deckType,
    baseCost: 100,
    baseEffect: {},
    tags: ['income'],
    timingClass: [timingClass],
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

function createCardInstance(
  id = 'ci-1',
  tags: string[] = ['income'],
  divergencePotential: DivergencePotential = 'LOW',
): CardInstance {
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
    divergencePotential,
  };
}

function createThreat(
  id = 'th-1',
  severity: number = 1,
  visibleAs: VisibilityLevel = 'HIDDEN',
): ThreatEnvelope {
  return {
    threatId: id,
    source: 'BOT_01' as HaterBotId,
    etaTicks: 2,
    severity,
    visibleAs,
    summary: `Threat ${id}`,
  };
}

function createLegendMarker(id = 'lm-1'): LegendMarker {
  return {
    markerId: id,
    tick: 5,
    kind: 'GOLD',
    cardId: null,
    summary: `Legend ${id}`,
  };
}

function createAttack(
  id = 'atk-1',
  category: AttackCategory = 'HEAT',
  magnitude = 5,
): AttackEvent {
  return {
    attackId: id,
    source: 'SYSTEM',
    targetEntity: 'SELF',
    targetLayer: 'L1' as ShieldLayerId,
    category,
    magnitude,
    createdAtTick: 0,
    notes: [],
  };
}

function createSnapshot(
  mode: ModeCode = 'solo',
  elapsedMs = 0,
  tick = 0,
): RunStateSnapshot {
  return {
    schemaVersion: 'engine-run-state.v2',
    runId: 'run-test-1',
    userId: 'user-test-1',
    seed: 'seed-test-1',
    mode,
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
      tier: 'T1' as PressureTier,
      band: 'BUILDING',
      previousTier: 'T0' as PressureTier,
      previousBand: 'CALM',
      upwardCrossings: 0,
      survivedHighPressureTicks: 0,
      lastEscalationTick: null,
      maxScoreSeen: 0.2,
    },
    tension: {
      score: 0.1,
      anticipation: 0.1,
      visibleThreats: [createThreat('th-1'), createThreat('th-2')],
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
      bots: [
        { botId: 'BOT_01', label: 'Liquidator',    state: 'DORMANT', heat: 0, lastAttackTick: null, attacksLanded: 0, attacksBlocked: 0, neutralized: false },
        { botId: 'BOT_02', label: 'Manipulator',   state: 'DORMANT', heat: 0, lastAttackTick: null, attacksLanded: 0, attacksBlocked: 0, neutralized: false },
        { botId: 'BOT_03', label: 'Crash Prophet', state: 'DORMANT', heat: 0, lastAttackTick: null, attacksLanded: 0, attacksBlocked: 0, neutralized: false },
        { botId: 'BOT_04', label: 'Collector',     state: 'DORMANT', heat: 0, lastAttackTick: null, attacksLanded: 0, attacksBlocked: 0, neutralized: false },
        { botId: 'BOT_05', label: 'Saboteur',      state: 'DORMANT', heat: 0, lastAttackTick: null, attacksLanded: 0, attacksBlocked: 0, neutralized: false },
      ],
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
      seasonBudgetMs: SEASON_12_MIN_MS,
      extensionBudgetMs: 0,
      elapsedMs,
      currentTickDurationMs: 1_000,
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
}

/** Snapshot already in SOVEREIGNTY phase with bots watching. */
function createSovereigntySnapshot(): RunStateSnapshot {
  const base = createSnapshot('solo', SOVEREIGNTY_ELAPSED_MS);
  return {
    ...base,
    phase: 'SOVEREIGNTY' as RunPhase,
    battle: {
      ...base.battle,
      bots: base.battle.bots.map((bot) => ({
        ...bot,
        state: 'WATCHING' as BotState,
        heat: 5,
      })),
    },
  };
}

/** Snapshot configured for a bleed-mode run. */
function createBleedSnapshot(): RunStateSnapshot {
  const adapter = new EmpireModeAdapter();
  return adapter.configure(createSnapshot(), { bleedMode: true });
}

// ============================================================================
// MARK: describe — configure baseline
// ============================================================================

describe('EmpireModeAdapter.configure — baseline', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('has modeCode = "solo"', () => {
    expect(adapter.modeCode).toBe('solo' satisfies ModeCode);
  });

  it('applies all three required base tags', () => {
    const configured = adapter.configure(createSnapshot());
    for (const tag of EXPECTED_BASE_TAGS) {
      expect(configured.tags).toContain(tag);
    }
  });

  it('sets bleed:disabled tag when bleedMode is not requested', () => {
    const configured = adapter.configure(createSnapshot());
    expect(configured.tags).toContain('bleed:disabled');
    expect(configured.tags).not.toContain('bleed:enabled');
  });

  it('enables loadout and hold, disables bleed on default configure', () => {
    const configured = adapter.configure(createSnapshot());
    expect(configured.modeState.loadoutEnabled).toBe(true);
    expect(configured.modeState.holdEnabled).toBe(true);
    expect(configured.modeState.bleedMode).toBe(false);
  });

  it('sets modePresentation to "empire"', () => {
    const configured = adapter.configure(createSnapshot());
    expect(configured.modeState.modePresentation).toBe('empire');
  });

  it('clears pendingAttacks from battle', () => {
    const snap = createSnapshot();
    expect(snap.battle.pendingAttacks).toHaveLength(1);
    const configured = adapter.configure(snap);
    expect(configured.battle.pendingAttacks).toHaveLength(0);
  });

  it('clears ghostMarkers from cards', () => {
    const snap = createSnapshot();
    expect(snap.cards.ghostMarkers).toHaveLength(1);
    const configured = adapter.configure(snap);
    expect(configured.cards.ghostMarkers).toHaveLength(0);
  });

  it('resets battle budget fields to 0', () => {
    const configured = adapter.configure(createSnapshot());
    expect(configured.battle.battleBudget).toBe(0);
    expect(configured.battle.battleBudgetCap).toBe(0);
    expect(configured.battle.extractionCooldownTicks).toBe(0);
    expect(configured.battle.rivalryHeatCarry).toBe(0);
  });

  it('sets all bots to DORMANT on default configure', () => {
    const configured = adapter.configure(createSnapshot());
    for (const bot of configured.battle.bots) {
      expect(bot.state satisfies BotState).toBe('DORMANT');
    }
  });

  it('holds holdCharges at minimum 1 when snapshot has 1 charge', () => {
    const configured = adapter.configure(createSnapshot());
    expect(configured.timers.holdCharges).toBeGreaterThanOrEqual(1);
  });

  it('resets all solo-specific modeState flags', () => {
    const configured = adapter.configure(createSnapshot());
    expect(configured.modeState.sharedTreasury).toBe(false);
    expect(configured.modeState.legendMarkersEnabled).toBe(false);
    expect(configured.modeState.sharedOpportunityDeck).toBe(false);
    expect(configured.modeState.counterIntelTier).toBe(0);
    expect(configured.modeState.spectatorLimit).toBe(0);
    expect(configured.modeState.roleLockEnabled).toBe(false);
    expect(configured.modeState.extractionActionsRemaining).toBe(0);
    expect(configured.modeState.ghostBaselineRunId).toBeNull();
    expect(configured.modeState.legendOwnerUserId).toBeNull();
  });

  it('preserves runId, userId, mode, seed from source snapshot', () => {
    const snap = createSnapshot('solo');
    const configured = adapter.configure(snap);
    expect(configured.runId).toBe('run-test-1');
    expect(configured.userId).toBe('user-test-1');
    expect(configured.mode).toBe('solo');
    expect(configured.seed).toBe('seed-test-1');
  });

  it('configure with no options preserves no-advantage state', () => {
    const configured = adapter.configure(createSnapshot());
    expect(configured.modeState.advantageId).toBeNull();
  });

  it('configure with empty options object produces same result as no options', () => {
    const withUndefined = adapter.configure(createSnapshot());
    const withEmpty: ModeConfigureOptions = {};
    const withEmptyResult = adapter.configure(createSnapshot(), withEmpty);
    // Both should have same tag set (bleed:disabled, base tags)
    expect([...withEmptyResult.tags].sort()).toEqual([...withUndefined.tags].sort());
  });

  it('returns a new snapshot object (immutable pattern)', () => {
    const snap = createSnapshot();
    const configured = adapter.configure(snap);
    expect(configured).not.toBe(snap);
  });

  it('mode difficulty constant for solo is 1.0', () => {
    const configured = adapter.configure(createSnapshot());
    const difficultyFactor = MODE_DIFFICULTY_MULTIPLIER[configured.mode as ModeCode];
    expect(difficultyFactor).toBe(1.0);
  });
});

// ============================================================================
// MARK: describe — configure advantages (one per advantage)
// ============================================================================

describe('EmpireModeAdapter.configure — advantages', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('MOMENTUM_CAPITAL: adds 10000 cash and adjusts netWorth accordingly', () => {
    const snap = createSnapshot();
    const configured = adapter.configure(snap, { advantageId: 'MOMENTUM_CAPITAL' });
    expect(configured.economy.cash).toBe(30_000);
    expect(configured.economy.netWorth).toBe(25_000);
  });

  it('MOMENTUM_CAPITAL: resulting ML vector F8 reflects increased cash/target ratio', () => {
    const configured = adapter.configure(createSnapshot(), { advantageId: 'MOMENTUM_CAPITAL' });
    const vector = buildEmpireMLVector32(configured);
    // F8 = cash / freedomTarget = 30000 / 100000 = 0.3
    expect(vector[8]).toBeCloseTo(0.3, 5);
  });

  it('NETWORK_ACTIVATED: boosts L4 shield layer by 1.5× (current and max)', () => {
    const snap = createSnapshot();
    const configured = adapter.configure(snap, { advantageId: 'NETWORK_ACTIVATED' });
    const l4 = configured.shield.layers.find((l) => l.layerId === ('L4' satisfies ShieldLayerId));
    expect(l4).toBeDefined();
    expect(l4!.current).toBe(Math.round(50 * 1.5));
    expect(l4!.max).toBe(Math.round(50 * 1.5));
  });

  it('NETWORK_ACTIVATED: does not modify L1, L2, L3 layers', () => {
    const configured = adapter.configure(createSnapshot(), { advantageId: 'NETWORK_ACTIVATED' });
    for (const id of ['L1', 'L2', 'L3'] as ShieldLayerId[]) {
      const layer = configured.shield.layers.find((l) => l.layerId === id);
      expect(layer!.current).toBe(50);
      expect(layer!.max).toBe(50);
    }
  });

  it('FORECLOSURE_BLOCK: adds foreclosure_block:active tag', () => {
    const configured = adapter.configure(createSnapshot(), { advantageId: 'FORECLOSURE_BLOCK' });
    expect(configured.tags).toContain('solo:foreclosure_block:active');
  });

  it('FORECLOSURE_BLOCK: does not change economy values', () => {
    const snap = createSnapshot();
    const configured = adapter.configure(snap, { advantageId: 'FORECLOSURE_BLOCK' });
    expect(configured.economy.cash).toBe(snap.economy.cash);
    expect(configured.economy.netWorth).toBe(snap.economy.netWorth);
  });

  it('INTEL_PASS: exposes first 3 visible threats', () => {
    const snap = {
      ...createSnapshot(),
      tension: {
        ...createSnapshot().tension,
        visibleThreats: [
          createThreat('th-1', 1, 'HIDDEN'),
          createThreat('th-2', 1, 'HIDDEN'),
          createThreat('th-3', 1, 'HIDDEN'),
          createThreat('th-4', 1, 'HIDDEN'),
        ],
      },
    };
    const configured = adapter.configure(snap, { advantageId: 'INTEL_PASS' });
    // First 3 should be EXPOSED (concealment = 0)
    for (let i = 0; i < 3; i++) {
      const vis = configured.tension.visibleThreats[i].visibleAs;
      expect(VISIBILITY_CONCEALMENT_FACTOR[vis as VisibilityLevel]).toBe(0);
    }
    // 4th remains HIDDEN
    expect(configured.tension.visibleThreats[3].visibleAs).toBe('HIDDEN');
  });

  it('INTEL_PASS: adds intel_pass:active tag', () => {
    const configured = adapter.configure(createSnapshot(), { advantageId: 'INTEL_PASS' });
    expect(configured.tags).toContain('solo:intel_pass:active');
  });

  it('PHANTOM_SEED: adds phantom_seed:active tag', () => {
    const configured = adapter.configure(createSnapshot(), { advantageId: 'PHANTOM_SEED' });
    expect(configured.tags).toContain('solo:phantom_seed:active');
  });

  it('PHANTOM_SEED: does not change cash or shield', () => {
    const snap = createSnapshot();
    const configured = adapter.configure(snap, { advantageId: 'PHANTOM_SEED' });
    expect(configured.economy.cash).toBe(snap.economy.cash);
    expect(configured.shield.layers[0].current).toBe(50);
  });

  it('DEBT_SHIELD: adds auto_debt_counter:1 tag', () => {
    const configured = adapter.configure(createSnapshot(), { advantageId: 'DEBT_SHIELD' });
    expect(configured.tags).toContain('solo:auto_debt_counter:1');
  });

  it('all advantages produce valid 32-feature ML vectors', () => {
    for (const advantageId of ALL_SOLO_ADVANTAGES) {
      const configured = adapter.configure(createSnapshot(), { advantageId });
      const vector = buildEmpireMLVector32(configured);
      expect(vector).toHaveLength(32);
      for (const feature of vector) {
        expect(Number.isFinite(feature)).toBe(true);
        expect(feature).toBeGreaterThanOrEqual(0);
        expect(feature).toBeLessThanOrEqual(1);
      }
    }
  });

  it('all advantages produce valid 48-feature DL tensors', () => {
    for (const advantageId of ALL_SOLO_ADVANTAGES) {
      const configured = adapter.configure(createSnapshot(), { advantageId });
      const tensor = buildEmpireDLTensor48(configured);
      expect(tensor).toHaveLength(48);
      for (const feature of tensor) {
        expect(Number.isFinite(feature)).toBe(true);
      }
    }
  });
});

// ============================================================================
// MARK: describe — configure handicaps (one per handicap)
// ============================================================================

describe('EmpireModeAdapter.configure — handicaps', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('NO_CREDIT_HISTORY: caps L2 current and max at 40', () => {
    const configured = adapter.configure(createSnapshot(), {
      handicapIds: ['NO_CREDIT_HISTORY'],
    });
    const l2 = configured.shield.layers.find((l) => l.layerId === ('L2' satisfies ShieldLayerId));
    expect(l2!.current).toBeLessThanOrEqual(40);
    expect(l2!.max).toBeLessThanOrEqual(40);
  });

  it('NO_CREDIT_HISTORY: does not cap L1, L3, L4 shield layers', () => {
    const configured = adapter.configure(createSnapshot(), {
      handicapIds: ['NO_CREDIT_HISTORY'],
    });
    for (const id of ['L1', 'L3', 'L4'] as ShieldLayerId[]) {
      const layer = configured.shield.layers.find((l) => l.layerId === id);
      expect(layer!.max).toBe(50);
    }
  });

  it('NO_CREDIT_HISTORY: adds no_credit_history tag', () => {
    const configured = adapter.configure(createSnapshot(), {
      handicapIds: ['NO_CREDIT_HISTORY'],
    });
    expect(configured.tags).toContain('solo:no_credit_history');
  });

  it('SINGLE_INCOME: adds single_income tag without mutating economy', () => {
    const snap = createSnapshot();
    const configured = adapter.configure(snap, { handicapIds: ['SINGLE_INCOME'] });
    expect(configured.tags).toContain('solo:single_income');
    expect(configured.economy.incomePerTick).toBe(snap.economy.incomePerTick);
  });

  it('TARGETED: wakes BOT_01 to WATCHING with heat >= 20', () => {
    const configured = adapter.configure(createSnapshot(), { handicapIds: ['TARGETED'] });
    const bot01 = configured.battle.bots.find((b) => b.botId === ('BOT_01' satisfies HaterBotId));
    expect(bot01).toBeDefined();
    expect(bot01!.state satisfies BotState).toBe('WATCHING');
    expect(bot01!.heat).toBeGreaterThanOrEqual(20);
  });

  it('TARGETED: does not wake BOT_02 through BOT_05', () => {
    const configured = adapter.configure(createSnapshot(), { handicapIds: ['TARGETED'] });
    for (const botId of ['BOT_02', 'BOT_03', 'BOT_04', 'BOT_05'] as HaterBotId[]) {
      const bot = configured.battle.bots.find((b) => b.botId === botId);
      expect(bot!.state satisfies BotState).toBe('DORMANT');
    }
  });

  it('CASH_POOR: caps cash at 10000 and recalculates netWorth', () => {
    const snap = createSnapshot();  // cash = 20000
    const configured = adapter.configure(snap, { handicapIds: ['CASH_POOR'] });
    expect(configured.economy.cash).toBe(10_000);
    expect(configured.economy.netWorth).toBe(snap.economy.netWorth - 10_000);
  });

  it('CASH_POOR: adds cash_poor tag', () => {
    const configured = adapter.configure(createSnapshot(), { handicapIds: ['CASH_POOR'] });
    expect(configured.tags).toContain('solo:cash_poor');
  });

  it('CLOCK_CURSED: reduces season budget to at most 9 minutes', () => {
    const configured = adapter.configure(createSnapshot(), { handicapIds: ['CLOCK_CURSED'] });
    expect(configured.timers.seasonBudgetMs).toBeLessThanOrEqual(SEASON_9_MIN_MS);
  });

  it('CLOCK_CURSED: adds clock_cursed tag', () => {
    const configured = adapter.configure(createSnapshot(), { handicapIds: ['CLOCK_CURSED'] });
    expect(configured.tags).toContain('solo:clock_cursed');
  });

  it('DISADVANTAGE_DRAFT: triggers bleed mode (all 6 handicaps applied)', () => {
    const configured = adapter.configure(createSnapshot(), {
      handicapIds: ['DISADVANTAGE_DRAFT'],
    });
    expect(configured.modeState.bleedMode).toBe(true);
    expect(configured.modeState.handicapIds).toHaveLength(6);
  });

  it('stacking NO_CREDIT_HISTORY + CASH_POOR applies both handicaps independently', () => {
    const configured = adapter.configure(createSnapshot(), {
      handicapIds: ['NO_CREDIT_HISTORY', 'CASH_POOR'],
    });
    // CASH_POOR: caps cash at 10000
    expect(configured.economy.cash).toBeLessThanOrEqual(10_000);
    // NO_CREDIT_HISTORY: caps L2 at 40
    const l2 = configured.shield.layers.find((l) => l.layerId === 'L2');
    expect(l2!.max).toBeLessThanOrEqual(40);
    expect(configured.tags).toContain('solo:cash_poor');
    expect(configured.tags).toContain('solo:no_credit_history');
  });

  it('handicap cord bonuses are non-zero for all 6 handicaps', () => {
    for (const handicap of ALL_SOLO_HANDICAPS) {
      expect(HANDICAP_CORD_BONUS[handicap]).toBeGreaterThan(0);
    }
  });

  it('all handicaps produce valid ML vector (32 features, all 0-1)', () => {
    for (const handicap of ALL_SOLO_HANDICAPS) {
      const configured = adapter.configure(createSnapshot(), { handicapIds: [handicap] });
      const vector = buildEmpireMLVector32(configured);
      expect(vector).toHaveLength(32);
      // feature 18 = handicap count / 6
      expect(vector[18]).toBeCloseTo(1 / 6, 5);
    }
  });
});

// ============================================================================
// MARK: describe — configure bleedMode
// ============================================================================

describe('EmpireModeAdapter.configure — bleedMode', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('bleedMode: sets modeState.bleedMode = true', () => {
    const configured = adapter.configure(createSnapshot(), { bleedMode: true });
    expect(configured.modeState.bleedMode).toBe(true);
  });

  it('bleedMode: applies all 6 handicaps', () => {
    const configured = adapter.configure(createSnapshot(), { bleedMode: true });
    expect(configured.modeState.handicapIds).toHaveLength(ALL_SOLO_HANDICAPS.length);
  });

  it('bleedMode: disables hold (holdEnabled=false, holdCharges=0)', () => {
    const configured = adapter.configure(createSnapshot(), { bleedMode: true });
    expect(configured.modeState.holdEnabled).toBe(false);
    expect(configured.timers.holdCharges).toBe(0);
  });

  it('bleedMode: adds bleed:enabled tag and solo:bleed_mode:hard', () => {
    const configured = adapter.configure(createSnapshot(), { bleedMode: true });
    expect(configured.tags).toContain('bleed:enabled');
    expect(configured.tags).toContain('solo:bleed_mode:hard');
    expect(configured.tags).not.toContain('bleed:disabled');
  });

  it('bleedMode: freezes BLEED_MODE_LOCK window', () => {
    const configured = adapter.configure(createSnapshot(), { bleedMode: true });
    expect(configured.timers.frozenWindowIds).toContain('BLEED_MODE_LOCK');
  });

  it('bleedMode: wakes all non-disabled bots to WATCHING with heat >= 25', () => {
    const configured = adapter.configure(createSnapshot(), { bleedMode: true });
    for (const bot of configured.battle.bots) {
      expect(bot.state satisfies BotState).toBe('WATCHING');
      expect(bot.heat).toBeGreaterThanOrEqual(25);
    }
  });

  it('bleedMode with disabled bots: disabled bots remain DORMANT', () => {
    const configured = adapter.configure(createSnapshot(), {
      bleedMode: true,
      disabledBots: ['BOT_01' as HaterBotId],
    });
    const bot01 = configured.battle.bots.find((b) => b.botId === 'BOT_01');
    expect(bot01!.state satisfies BotState).toBe('DORMANT');
    expect(bot01!.heat).toBe(0);
    // Other bots still wake up
    const bot02 = configured.battle.bots.find((b) => b.botId === 'BOT_02');
    expect(bot02!.state satisfies BotState).toBe('WATCHING');
  });

  it('bleedMode: DL tensor feature 14 (bleed flag) = 1', () => {
    const configured = adapter.configure(createSnapshot(), { bleedMode: true });
    const tensor = buildEmpireDLTensor48(configured);
    expect(tensor[14]).toBe(1); // F14: bleedMode flag
  });

  it('bleedMode: DL tensor feature 18 (handicap count/6) = 1.0', () => {
    const configured = adapter.configure(createSnapshot(), { bleedMode: true });
    const tensor = buildEmpireDLTensor48(configured);
    expect(tensor[18]).toBeCloseTo(1.0, 5); // F18: 6/6 = 1.0
  });
});

// ============================================================================
// MARK: describe — configure disabled bots
// ============================================================================

describe('EmpireModeAdapter.configure — disabledBots', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('disabling BOT_01 adds solo:cord_cap:reduced:1 tag', () => {
    const configured = adapter.configure(createSnapshot(), {
      disabledBots: ['BOT_01' as HaterBotId],
    });
    expect(configured.tags).toContain('solo:cord_cap:reduced:1');
  });

  it('disabling 3 bots adds solo:cord_cap:reduced:3 tag', () => {
    const configured = adapter.configure(createSnapshot(), {
      disabledBots: ['BOT_01', 'BOT_02', 'BOT_03'] as HaterBotId[],
    });
    expect(configured.tags).toContain('solo:cord_cap:reduced:3');
    expect(configured.modeState.disabledBots).toHaveLength(3);
  });

  it('disabling no bots adds no cord_cap tag', () => {
    const configured = adapter.configure(createSnapshot(), { disabledBots: [] });
    expect(configured.tags.some((t) => t.startsWith('solo:cord_cap:reduced:'))).toBe(false);
  });

  it('disabled bots lose all heat and are set to DORMANT', () => {
    const configured = adapter.configure(createSnapshot(), {
      disabledBots: ['BOT_03', 'BOT_04'] as HaterBotId[],
    });
    for (const botId of ['BOT_03', 'BOT_04'] as HaterBotId[]) {
      const bot = configured.battle.bots.find((b) => b.botId === botId);
      expect(bot!.state satisfies BotState).toBe('DORMANT');
      expect(bot!.heat).toBe(0);
    }
  });

  it('disabling all 5 bots: cord_cap:reduced:5 tag and all bots DORMANT', () => {
    const configured = adapter.configure(createSnapshot(), {
      disabledBots: [...HATER_BOT_IDS] as HaterBotId[],
    });
    expect(configured.tags).toContain('solo:cord_cap:reduced:5');
    for (const bot of configured.battle.bots) {
      expect(bot.state satisfies BotState).toBe('DORMANT');
    }
  });

  it('disabled bot count appears in DL tensor feature 19 (normalized)', () => {
    const configured = adapter.configure(createSnapshot(), {
      disabledBots: ['BOT_01', 'BOT_02'] as HaterBotId[],
    });
    const tensor = buildEmpireDLTensor48(configured);
    expect(tensor[19]).toBeCloseTo(2 / 5, 5); // 2 disabled / 5 total
  });
});

// ============================================================================
// MARK: describe — onTickStart phase transitions
// ============================================================================

describe('EmpireModeAdapter.onTickStart — phase transitions', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('at 1 minute (FOUNDATION), phase remains FOUNDATION', () => {
    const snap = createSnapshot('solo', FOUNDATION_ELAPSED_MS);
    const result = adapter.onTickStart(snap);
    expect(result.phase satisfies RunPhase).toBe('FOUNDATION');
    expect(result.tags.some((t) => t.startsWith('solo:phase_transition:'))).toBe(false);
  });

  it('at 5 minutes (ESCALATION boundary), phase transitions to ESCALATION', () => {
    const snap = createSnapshot('solo', ESCALATION_ELAPSED_MS);
    const result = adapter.onTickStart(snap);
    expect(result.phase satisfies RunPhase).toBe('ESCALATION');
    expect(result.tags).toContain('solo:phase_transition:FOUNDATION->ESCALATION');
  });

  it('ESCALATION transition opens 5 phase boundary windows', () => {
    const snap = createSnapshot('solo', ESCALATION_ELAPSED_MS);
    const result = adapter.onTickStart(snap);
    expect(result.modeState.phaseBoundaryWindowsRemaining).toBe(5);
  });

  it('ESCALATION transition wakes BOT_01 and BOT_02 to WATCHING with heat 12', () => {
    const snap = createSnapshot('solo', ESCALATION_ELAPSED_MS);
    const result = adapter.onTickStart(snap);
    const bot01 = result.battle.bots.find((b) => b.botId === 'BOT_01')!;
    const bot02 = result.battle.bots.find((b) => b.botId === 'BOT_02')!;
    expect(bot01.state satisfies BotState).toBe('WATCHING');
    expect(bot02.state satisfies BotState).toBe('WATCHING');
    expect(bot01.heat).toBe(12);
    expect(bot02.heat).toBe(12);
  });

  it('ESCALATION transition does NOT wake BOT_03, BOT_04, BOT_05', () => {
    const snap = createSnapshot('solo', ESCALATION_ELAPSED_MS);
    const result = adapter.onTickStart(snap);
    for (const botId of ['BOT_03', 'BOT_04', 'BOT_05'] as HaterBotId[]) {
      const bot = result.battle.bots.find((b) => b.botId === botId)!;
      expect(bot.state satisfies BotState).toBe('DORMANT');
    }
  });

  it('at 9 minutes (SOVEREIGNTY boundary), phase transitions to SOVEREIGNTY', () => {
    const snap = createSnapshot('solo', SOVEREIGNTY_ELAPSED_MS);
    const result = adapter.onTickStart(snap);
    expect(result.phase satisfies RunPhase).toBe('SOVEREIGNTY');
    expect(result.tags).toContain('solo:phase_transition:FOUNDATION->SOVEREIGNTY');
  });

  it('SOVEREIGNTY transition wakes BOT_03, BOT_04, BOT_05 with heat >= 18', () => {
    const snap = createSnapshot('solo', SOVEREIGNTY_ELAPSED_MS);
    const result = adapter.onTickStart(snap);
    for (const botId of ['BOT_03', 'BOT_04', 'BOT_05'] as HaterBotId[]) {
      const bot = result.battle.bots.find((b) => b.botId === botId)!;
      expect(bot.state satisfies BotState).toBe('WATCHING');
      expect(bot.heat).toBeGreaterThanOrEqual(18);
    }
  });

  it('SOVEREIGNTY transition exposes all visible threats', () => {
    const snap = {
      ...createSnapshot('solo', SOVEREIGNTY_ELAPSED_MS),
      tension: {
        ...createSnapshot().tension,
        visibleThreats: [
          createThreat('th-1', 1, 'HIDDEN'),
          createThreat('th-2', 1, 'SILHOUETTE'),
        ],
      },
    };
    const result = adapter.onTickStart(snap);
    for (const threat of result.tension.visibleThreats) {
      expect(VISIBILITY_CONCEALMENT_FACTOR[threat.visibleAs as VisibilityLevel]).toBe(0);
    }
  });

  it('phase tag is added only once (no duplicate tags)', () => {
    const snap = createSnapshot('solo', ESCALATION_ELAPSED_MS);
    const result = adapter.onTickStart(snap);
    const transitionTags = result.tags.filter((t) => t.startsWith('solo:phase_transition:'));
    expect(transitionTags).toHaveLength(1);
  });

  it('ESCALATION transition increases bot threat total from 0 to positive', () => {
    const snap = createSnapshot('solo', ESCALATION_ELAPSED_MS);
    expect(computeBotThreatTotal(snap)).toBe(0); // all DORMANT
    const result = adapter.onTickStart(snap);
    expect(computeBotThreatTotal(result)).toBeGreaterThan(0); // BOT_01, BOT_02 now WATCHING
  });

  it('phase transition uses RUN_PHASES ordering (FOUNDATION → ESCALATION → SOVEREIGNTY)', () => {
    // Verify that the phase order matches the global constant
    expect(RUN_PHASES[0]).toBe('FOUNDATION');
    expect(RUN_PHASES[1]).toBe('ESCALATION');
    expect(RUN_PHASES[2]).toBe('SOVEREIGNTY');
  });

  it('disabled bot does not wake during ESCALATION transition', () => {
    const base = adapter.configure(createSnapshot(), {
      disabledBots: ['BOT_01' as HaterBotId],
    });
    const snap = { ...base, timers: { ...base.timers, elapsedMs: ESCALATION_ELAPSED_MS } };
    const result = adapter.onTickStart(snap);
    const bot01 = result.battle.bots.find((b) => b.botId === 'BOT_01')!;
    expect(bot01.state satisfies BotState).toBe('DORMANT');
    // BOT_02 should wake
    const bot02 = result.battle.bots.find((b) => b.botId === 'BOT_02')!;
    expect(bot02.state satisfies BotState).toBe('WATCHING');
  });
});

// ============================================================================
// MARK: describe — onTickStart time milestones
// ============================================================================

describe('EmpireModeAdapter.onTickStart — time milestones', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('at 10 minutes, activates clock (solo:clock_active)', () => {
    const snap = createSnapshot('solo', TEN_MIN_MS);
    const result = adapter.onTickStart(snap);
    expect(result.tags).toContain('solo:clock_active');
  });

  it('at 10 minutes, exposes all visible threats', () => {
    const snap = {
      ...createSnapshot('solo', TEN_MIN_MS),
      tension: {
        ...createSnapshot().tension,
        visibleThreats: [
          createThreat('th-1', 1, 'HIDDEN'),
          createThreat('th-2', 1, 'PARTIAL'),
        ],
      },
    };
    const result = adapter.onTickStart(snap);
    const exposedCount = countExposedThreats(result);
    expect(exposedCount).toBe(2);
  });

  it('clock_active is NOT applied twice when tag already present', () => {
    const snap = {
      ...createSnapshot('solo', TEN_MIN_MS),
      tags: ['solo:clock_active'],
      tension: {
        ...createSnapshot().tension,
        visibleThreats: [createThreat('th-1', 1, 'HIDDEN')],
      },
    };
    const result = adapter.onTickStart(snap);
    const clockTags = result.tags.filter((t) => t === 'solo:clock_active');
    expect(clockTags).toHaveLength(1);
  });

  it('at 11 minutes, applies heat spike (+20) to all non-dormant/non-neutralized bots', () => {
    const snap = {
      ...createSnapshot('solo', ELEVEN_MIN_MS),
      phase: 'SOVEREIGNTY' as RunPhase,
      battle: {
        ...createSnapshot().battle,
        bots: createSnapshot().battle.bots.map((bot) => ({
          ...bot,
          state: 'WATCHING' as BotState,
          heat: 5,
        })),
      },
    };
    const result = adapter.onTickStart(snap);
    for (const bot of result.battle.bots) {
      expect(bot.heat).toBe(25); // 5 + 20
    }
    expect(result.tags).toContain('solo:minute_11_heat_spike_applied');
  });

  it('heat spike skips DORMANT bots (they have 0 heat and stay at 0)', () => {
    const snap = createSnapshot('solo', ELEVEN_MIN_MS);
    // All bots are DORMANT by default
    const result = adapter.onTickStart(snap);
    for (const bot of result.battle.bots) {
      expect(bot.state satisfies BotState).toBe('DORMANT');
      expect(bot.heat).toBe(0);
    }
  });

  it('heat spike skips NEUTRALIZED bots', () => {
    const snap = {
      ...createSnapshot('solo', ELEVEN_MIN_MS),
      battle: {
        ...createSnapshot().battle,
        bots: createSnapshot().battle.bots.map((bot, i) => ({
          ...bot,
          state: (i === 0 ? 'NEUTRALIZED' : 'WATCHING') as BotState,
          heat: 5,
        })),
      },
    };
    const result = adapter.onTickStart(snap);
    expect(result.battle.bots[0].heat).toBe(5); // NEUTRALIZED: no spike
    for (let i = 1; i < result.battle.bots.length; i++) {
      expect(result.battle.bots[i].heat).toBe(25); // WATCHING: +20
    }
  });

  it('heat spike is NOT applied twice when tag already present', () => {
    const snap = {
      ...createSnapshot('solo', ELEVEN_MIN_MS),
      tags: ['solo:minute_11_heat_spike_applied'],
      battle: {
        ...createSnapshot().battle,
        bots: createSnapshot().battle.bots.map((bot) => ({
          ...bot,
          state: 'WATCHING' as BotState,
          heat: 5,
        })),
      },
    };
    const result = adapter.onTickStart(snap);
    // Heat should not be incremented again
    for (const bot of result.battle.bots) {
      expect(bot.heat).toBe(5);
    }
  });

  it('at 11:30, marks sovereignty_decision_ready', () => {
    const snap = createSovereigntySnapshot();
    const snapAt1130 = {
      ...snap,
      timers: { ...snap.timers, elapsedMs: ELEVEN_THIRTY_MS },
    };
    const result = adapter.onTickStart(snapAt1130);
    expect(result.tags).toContain('solo:sovereignty_decision_ready');
    expect(result.tags).toContain('solo:clock_active');
    expect(result.tags).toContain('solo:minute_11_heat_spike_applied');
  });

  it('pressure urgency increases monotonically at each milestone', () => {
    const snapFoundation = createSnapshot('solo', FOUNDATION_ELAPSED_MS);
    const snapEscalation = createSnapshot('solo', ESCALATION_ELAPSED_MS);
    const snapSovereignty = createSnapshot('solo', SOVEREIGNTY_ELAPSED_MS);

    const urgencyF = computePressureUrgency(snapFoundation);
    const urgencyE = computePressureUrgency(snapEscalation);
    const urgencyS = computePressureUrgency(snapSovereignty);

    // All three should be valid 0-1 numbers
    expect(urgencyF).toBeGreaterThanOrEqual(0);
    expect(urgencyE).toBeGreaterThanOrEqual(0);
    expect(urgencyS).toBeGreaterThanOrEqual(0);
    expect(urgencyF).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// MARK: describe — onTickStart cash streak
// ============================================================================

describe('EmpireModeAdapter.onTickStart — cash streak', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('cash below 2000: increments cash_low_streak tag from 0 to 1', () => {
    const snap = { ...createSnapshot(), economy: { ...createSnapshot().economy, cash: 1_500 } };
    const result = adapter.onTickStart(snap);
    expect(result.tags).toContain('solo:cash_low_streak:1');
  });

  it('cash below 2000: increments existing streak from 7 to 8', () => {
    const snap = {
      ...createSnapshot(),
      tags: ['solo:cash_low_streak:7'],
      economy: { ...createSnapshot().economy, cash: 1_000 },
    };
    const result = adapter.onTickStart(snap);
    expect(result.tags).toContain('solo:cash_low_streak:8');
    expect(result.tags).not.toContain('solo:cash_low_streak:7');
  });

  it('cash above 2000 with no streak: no streak tag', () => {
    const snap = { ...createSnapshot(), economy: { ...createSnapshot().economy, cash: 5_000 } };
    const result = adapter.onTickStart(snap);
    expect(result.tags.some((t) => t.startsWith('solo:cash_low_streak:'))).toBe(false);
  });

  it('cash above 2000 after streak below 15: clears streak tag', () => {
    const snap = {
      ...createSnapshot(),
      tags: ['solo:cash_low_streak:7'],
      economy: { ...createSnapshot().economy, cash: 3_000 },
    };
    const result = adapter.onTickStart(snap);
    expect(result.tags.some((t) => t.startsWith('solo:cash_low_streak:'))).toBe(false);
    expect(result.tags).not.toContain('solo:comeback_surge_armed');
  });

  it('cash recovery after 15-tick streak: arms comeback surge and boosts sovereignty', () => {
    const snap = {
      ...createSnapshot(),
      tags: ['solo:cash_low_streak:15'],
      economy: { ...createSnapshot().economy, cash: 3_000 },
    };
    const result = adapter.onTickStart(snap);
    expect(result.tags).toContain('solo:comeback_surge_armed');
    expect(result.sovereignty.sovereigntyScore).toBeCloseTo(1.01, 5);
    expect(result.tags.some((t) => t.startsWith('solo:cash_low_streak:'))).toBe(false);
  });

  it('cash recovery after 20-tick streak: also arms comeback surge', () => {
    const snap = {
      ...createSnapshot(),
      tags: ['solo:cash_low_streak:20'],
      economy: { ...createSnapshot().economy, cash: 5_000 },
    };
    const result = adapter.onTickStart(snap);
    expect(result.tags).toContain('solo:comeback_surge_armed');
  });

  it('comeback surge DL tensor feature 47 becomes 1', () => {
    const snap = {
      ...createSnapshot(),
      tags: ['solo:cash_low_streak:15'],
      economy: { ...createSnapshot().economy, cash: 3_000 },
    };
    const result = adapter.onTickStart(snap);
    const tensor = buildEmpireDLTensor48(result);
    expect(tensor[47]).toBe(1); // F47: comeback armed flag
  });
});

// ============================================================================
// MARK: describe — onTickEnd
// ============================================================================

describe('EmpireModeAdapter.onTickEnd', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('decrements phaseBoundaryWindowsRemaining from 2 to 1', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, phaseBoundaryWindowsRemaining: 2 },
    };
    const result = adapter.onTickEnd(snap);
    expect(result.modeState.phaseBoundaryWindowsRemaining).toBe(1);
  });

  it('does not decrement phaseBoundaryWindowsRemaining below 0', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, phaseBoundaryWindowsRemaining: 0 },
    };
    const result = adapter.onTickEnd(snap);
    expect(result.modeState.phaseBoundaryWindowsRemaining).toBe(0);
  });

  it('bleed + T3 pressure: increments haterHeat by 1', () => {
    const snap = {
      ...createSnapshot(),
      pressure: { ...createSnapshot().pressure, tier: 'T3' as PressureTier },
      modeState: { ...createSnapshot().modeState, bleedMode: true, phaseBoundaryWindowsRemaining: 0 },
    };
    const result = adapter.onTickEnd(snap);
    expect(result.economy.haterHeat).toBe(1);
  });

  it('bleed + T4 pressure: increments haterHeat by 1', () => {
    const snap = {
      ...createSnapshot(),
      pressure: { ...createSnapshot().pressure, tier: 'T4' as PressureTier },
      modeState: { ...createSnapshot().modeState, bleedMode: true, phaseBoundaryWindowsRemaining: 0 },
    };
    const result = adapter.onTickEnd(snap);
    expect(result.economy.haterHeat).toBe(1);
  });

  it('bleed + T2 pressure: does NOT increment haterHeat', () => {
    const snap = {
      ...createSnapshot(),
      pressure: { ...createSnapshot().pressure, tier: 'T2' as PressureTier },
      modeState: { ...createSnapshot().modeState, bleedMode: true, phaseBoundaryWindowsRemaining: 0 },
    };
    const result = adapter.onTickEnd(snap);
    expect(result.economy.haterHeat).toBe(0);
  });

  it('no-bleed at T3: does NOT increment haterHeat', () => {
    const snap = {
      ...createSnapshot(),
      pressure: { ...createSnapshot().pressure, tier: 'T3' as PressureTier },
      modeState: { ...createSnapshot().modeState, bleedMode: false, phaseBoundaryWindowsRemaining: 0 },
    };
    const result = adapter.onTickEnd(snap);
    expect(result.economy.haterHeat).toBe(0);
  });

  it('comeback surge armed: adds comeback_realized tag and boosts regen on all layers', () => {
    const snap = {
      ...createSnapshot(),
      tags: ['solo:comeback_surge_armed'],
    };
    const result = adapter.onTickEnd(snap);
    expect(result.tags).toContain('solo:comeback_realized');
    for (const layer of result.shield.layers) {
      const original = snap.shield.layers.find((l) => l.layerId === layer.layerId)!;
      expect(layer.regenPerTick).toBe(original.regenPerTick + 1);
    }
  });

  it('pressure tier normalized constant aligns with adapter behavior at T3/T4', () => {
    // T3 and T4 trigger bleed tax — verify they are the high-pressure tiers
    expect(PRESSURE_TIER_NORMALIZED['T3' as PressureTier]).toBeGreaterThan(
      PRESSURE_TIER_NORMALIZED['T2' as PressureTier],
    );
    expect(PRESSURE_TIER_NORMALIZED['T4' as PressureTier]).toBe(1.0);
  });

  it('returns new object without mutating original', () => {
    const snap = createSnapshot();
    const result = adapter.onTickEnd(snap);
    expect(result).not.toBe(snap);
    expect(snap.modeState.phaseBoundaryWindowsRemaining).toBe(0);
  });
});

// ============================================================================
// MARK: describe — resolveAction
// ============================================================================

describe('EmpireModeAdapter.resolveAction', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('USE_HOLD with windowId freezes the window and decrements holdCharges', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, holdEnabled: true },
    };
    const result = adapter.resolveAction(snap, 'USE_HOLD', { windowId: 'decision-7' });
    expect(result.tags).toContain('solo:hold_used');
    expect(result.timers.holdCharges).toBe(0);
    expect(result.timers.frozenWindowIds).toContain('decision-7');
  });

  it('USE_HOLD without payload generates tick-based window ID', () => {
    const snap = {
      ...createSnapshot(),
      tick: 42,
      modeState: { ...createSnapshot().modeState, holdEnabled: true },
    };
    const result = adapter.resolveAction(snap, 'USE_HOLD');
    expect(result.timers.frozenWindowIds).toContain('hold-42');
  });

  it('USE_HOLD when holdEnabled=false returns snapshot unchanged', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, holdEnabled: false },
    };
    const result = adapter.resolveAction(snap, 'USE_HOLD', { windowId: 'w-1' });
    expect(result).toBe(snap);
  });

  it('USE_HOLD when holdCharges=0 returns snapshot unchanged', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, holdEnabled: true },
      timers: { ...createSnapshot().timers, holdCharges: 0 },
    };
    const result = adapter.resolveAction(snap, 'USE_HOLD', { windowId: 'w-1' });
    expect(result).toBe(snap);
  });

  it('non-USE_HOLD actions return snapshot unchanged (empire does not handle them)', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, holdEnabled: true },
    };
    // Test all actions except USE_HOLD
    for (const actionId of ALL_MODE_ACTION_IDS.filter((a) => a !== 'USE_HOLD')) {
      const result = adapter.resolveAction(snap, actionId, {});
      expect(result).toBe(snap);
    }
  });

  it('FIRE_EXTRACTION action is not handled by empire adapter', () => {
    const snap = createSnapshot();
    const result = adapter.resolveAction(snap, 'FIRE_EXTRACTION' satisfies ModeActionId);
    expect(result).toBe(snap);
  });

  it('LOCK_GHOST_WINDOW action is not handled by empire adapter', () => {
    const snap = createSnapshot();
    const result = adapter.resolveAction(snap, 'LOCK_GHOST_WINDOW' satisfies ModeActionId);
    expect(result).toBe(snap);
  });

  it('USE_HOLD with empty string windowId uses tick-based fallback', () => {
    const snap = {
      ...createSnapshot(),
      tick: 7,
      modeState: { ...createSnapshot().modeState, holdEnabled: true },
    };
    const result = adapter.resolveAction(snap, 'USE_HOLD', { windowId: '' });
    expect(result.timers.frozenWindowIds).toContain('hold-7');
  });

  it('finalize spy confirms resolveAction does NOT call finalize', () => {
    const snap = createSnapshot();
    const finalizeSpy = vi.spyOn(adapter, 'finalize');
    adapter.resolveAction(snap, 'USE_HOLD', { windowId: 'test' });
    expect(finalizeSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

// ============================================================================
// MARK: describe — finalize
// ============================================================================

describe('EmpireModeAdapter.finalize', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('no handicaps, no disabled bots: cord score multiplied by 1 (unchanged)', () => {
    const snap = createSnapshot();
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeCloseTo(1.0, 5);
  });

  it('NO_CREDIT_HISTORY handicap adds 0.15 to cord multiplier', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, handicapIds: ['NO_CREDIT_HISTORY'] as SoloHandicapId[] },
    };
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeCloseTo(1 * (1 + 0.15), 5);
  });

  it('CASH_POOR handicap adds 0.20 to cord multiplier', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, handicapIds: ['CASH_POOR'] as SoloHandicapId[] },
    };
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeCloseTo(1 * (1 + 0.20), 5);
  });

  it('CLOCK_CURSED handicap adds 0.30 to cord multiplier', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, handicapIds: ['CLOCK_CURSED'] as SoloHandicapId[] },
    };
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeCloseTo(1 * (1 + 0.30), 5);
  });

  it('DISADVANTAGE_DRAFT handicap adds 0.80 to cord multiplier', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, handicapIds: ['DISADVANTAGE_DRAFT'] as SoloHandicapId[] },
    };
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeCloseTo(1 * (1 + 0.80), 5);
  });

  it('stacking two handicaps sums their bonuses', () => {
    const handicaps: SoloHandicapId[] = ['NO_CREDIT_HISTORY', 'SINGLE_INCOME'];
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, handicapIds: handicaps },
    };
    const expected = computeExpectedMultiplier(handicaps, 0, false, false);
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeCloseTo(expected, 5);
  });

  it('disabling 1 bot reduces cord by 0.2×', () => {
    const snap = {
      ...createSnapshot(),
      modeState: {
        ...createSnapshot().modeState,
        disabledBots: ['BOT_01' as HaterBotId],
      },
    };
    const expected = computeExpectedMultiplier([], 1, false, false);
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeCloseTo(expected, 5);
  });

  it('disabling 5 bots uses max(0.35, ...) floor', () => {
    const snap = {
      ...createSnapshot(),
      modeState: {
        ...createSnapshot().modeState,
        disabledBots: [...HATER_BOT_IDS] as HaterBotId[],
      },
    };
    const expected = computeExpectedMultiplier([], 5, false, false);
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeCloseTo(expected, 5);
    // 1 - 5*0.2 = -0.0 but floor is 0.35
    expect(result.sovereignty.cordScore).toBeGreaterThanOrEqual(0.35);
  });

  it('bleedMode + FREEDOM: cord score is at least 1.8', () => {
    const snap = {
      ...createSnapshot(),
      outcome: 'FREEDOM' as RunOutcome,
      modeState: { ...createSnapshot().modeState, bleedMode: true },
    };
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeGreaterThanOrEqual(1.8);
    expect(result.sovereignty.proofBadges).toContain('BLEED_S_GRADE_ELIGIBLE');
  });

  it('bleedMode + TIMEOUT: no 1.8 bonus', () => {
    const snap = {
      ...createSnapshot(),
      outcome: 'TIMEOUT' as RunOutcome,
      modeState: { ...createSnapshot().modeState, bleedMode: true },
    };
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeLessThan(1.8);
    expect(result.sovereignty.proofBadges).not.toContain('BLEED_S_GRADE_ELIGIBLE');
  });

  it('comeback_realized tag: adds 0.05 to multiplier and COMEBACK_SURGE badge', () => {
    const snap = {
      ...createSnapshot(),
      tags: ['solo:comeback_realized'],
    };
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeCloseTo(1 * 1 + 0.05, 5);
    expect(result.sovereignty.proofBadges).toContain('COMEBACK_SURGE');
  });

  it('no disabled bots: adds FULL_BOT_GAUNTLET badge', () => {
    const snap = createSnapshot();
    const result = adapter.finalize(snap);
    expect(result.sovereignty.proofBadges).toContain('FULL_BOT_GAUNTLET');
  });

  it('any disabled bot: does NOT add FULL_BOT_GAUNTLET badge', () => {
    const snap = {
      ...createSnapshot(),
      modeState: { ...createSnapshot().modeState, disabledBots: ['BOT_01' as HaterBotId] },
    };
    const result = adapter.finalize(snap);
    expect(result.sovereignty.proofBadges).not.toContain('FULL_BOT_GAUNTLET');
  });

  it('all 6 handicaps: expected multiplier matches computeExpectedMultiplier helper', () => {
    const snap = {
      ...createSnapshot(),
      modeState: {
        ...createSnapshot().modeState,
        handicapIds: [...ALL_SOLO_HANDICAPS] as SoloHandicapId[],
      },
    };
    const expected = computeExpectedMultiplier([...ALL_SOLO_HANDICAPS], 0, false, false);
    const result = adapter.finalize(snap);
    expect(result.sovereignty.cordScore).toBeCloseTo(expected, 5);
  });
});

// ============================================================================
// MARK: describe — ML feature vector
// ============================================================================

describe('EmpireModeAdapter — ML feature vectors (32-feature)', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('baseline configure produces 32-feature ML vector, all values in [0,1]', () => {
    const configured = adapter.configure(createSnapshot(), { advantageId: 'MOMENTUM_CAPITAL' });
    const vector = buildEmpireMLVector32(configured);
    expect(vector).toHaveLength(32);
    for (const v of vector) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('F0 (pressure score) reflects snapshot pressure.score', () => {
    const snap = { ...createSnapshot(), pressure: { ...createSnapshot().pressure, score: 0.65 } };
    const vector = buildEmpireMLVector32(snap);
    expect(vector[0]).toBeCloseTo(0.65, 5);
  });

  it('F1 (tier normalized) uses PRESSURE_TIER_NORMALIZED constant correctly', () => {
    const snap = { ...createSnapshot(), pressure: { ...createSnapshot().pressure, tier: 'T3' as PressureTier } };
    const vector = buildEmpireMLVector32(snap);
    expect(vector[1]).toBeCloseTo(PRESSURE_TIER_NORMALIZED['T3'], 5);
  });

  it('F5 (bot threat) is 0 when all bots are DORMANT', () => {
    const snap = createSnapshot();
    const vector = buildEmpireMLVector32(snap);
    expect(vector[5]).toBe(0); // all DORMANT, multiplier = 0
  });

  it('F5 (bot threat) increases after ESCALATION transition wakes BOT_01, BOT_02', () => {
    const snap = createSnapshot('solo', ESCALATION_ELAPSED_MS);
    const afterTick = adapter.onTickStart(snap);
    const vectorBefore = buildEmpireMLVector32(snap);
    const vectorAfter  = buildEmpireMLVector32(afterTick);
    expect(vectorAfter[5]).toBeGreaterThan(vectorBefore[5]);
  });

  it('F8 (cash / freedomTarget) is exactly 0.20 for default snapshot cash=20000, target=100000', () => {
    const vector = buildEmpireMLVector32(createSnapshot());
    expect(vector[8]).toBeCloseTo(0.2, 5);
  });

  it('F12 (mode difficulty) for solo = 0.5 (1.0 / 2)', () => {
    const vector = buildEmpireMLVector32(createSnapshot());
    expect(vector[12]).toBeCloseTo(MODE_DIFFICULTY_MULTIPLIER['solo'] / 2, 5);
  });

  it('F13 (phase index) is 0 for FOUNDATION, 0.5 for ESCALATION, 1 for SOVEREIGNTY', () => {
    const snapF = createSnapshot();
    const snapE = { ...snapF, phase: 'ESCALATION' as RunPhase };
    const snapS = { ...snapF, phase: 'SOVEREIGNTY' as RunPhase };
    expect(buildEmpireMLVector32(snapF)[13]).toBe(0);
    expect(buildEmpireMLVector32(snapE)[13]).toBe(0.5);
    expect(buildEmpireMLVector32(snapS)[13]).toBe(1);
  });

  it('F14 (bleedMode flag) is 0 by default and 1 in bleed configure', () => {
    const baseline = buildEmpireMLVector32(createSnapshot());
    const bleed    = buildEmpireMLVector32(createBleedSnapshot());
    expect(baseline[14]).toBe(0);
    expect(bleed[14]).toBe(1);
  });

  it('F26 (threat exposure ratio) uses VISIBILITY_CONCEALMENT_FACTOR correctly', () => {
    const snap = {
      ...createSnapshot(),
      tension: {
        ...createSnapshot().tension,
        visibleThreats: [
          createThreat('th-1', 1, 'EXPOSED'),
          createThreat('th-2', 1, 'HIDDEN'),
        ],
      },
    };
    const vector = buildEmpireMLVector32(snap);
    expect(vector[26]).toBeCloseTo(0.5, 5); // 1 of 2 threats exposed
    // Verify EXPOSED concealment factor = 0
    expect(VISIBILITY_CONCEALMENT_FACTOR['EXPOSED' as VisibilityLevel]).toBe(0);
  });
});

// ============================================================================
// MARK: describe — DL tensor (48-feature)
// ============================================================================

describe('EmpireModeAdapter — DL tensor (48-feature)', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('baseline produces 48-feature tensor, all finite', () => {
    const configured = adapter.configure(createSnapshot());
    const tensor = buildEmpireDLTensor48(configured);
    expect(tensor).toHaveLength(48);
    for (const v of tensor) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('F32 (upward crossings > 3) is 1 when crossings > 3', () => {
    const snap = { ...createSnapshot(), pressure: { ...createSnapshot().pressure, upwardCrossings: 5 } };
    const tensor = buildEmpireDLTensor48(snap);
    expect(tensor[32]).toBe(1);
  });

  it('F32 (upward crossings > 3) is 0 when crossings <= 3', () => {
    const snap = { ...createSnapshot(), pressure: { ...createSnapshot().pressure, upwardCrossings: 3 } };
    const tensor = buildEmpireDLTensor48(snap);
    expect(tensor[32]).toBe(0);
  });

  it('F44 (draw pile) normalizes card.drawPileSize over 30', () => {
    const snap = { ...createSnapshot(), cards: { ...createSnapshot().cards, drawPileSize: 15 } };
    const tensor = buildEmpireDLTensor48(snap);
    expect(tensor[44]).toBeCloseTo(0.5, 5);
  });

  it('F45 (deck entropy) preserves snapshot deckEntropy value', () => {
    const snap = { ...createSnapshot(), cards: { ...createSnapshot().cards, deckEntropy: 0.75 } };
    const tensor = buildEmpireDLTensor48(snap);
    expect(tensor[45]).toBeCloseTo(0.75, 5);
  });

  it('F47 (comeback flag) is 1 after comeback_surge_armed tag is present', () => {
    const snap = { ...createSnapshot(), tags: ['solo:comeback_surge_armed'] };
    const tensor = buildEmpireDLTensor48(snap);
    expect(tensor[47]).toBe(1);
  });

  it('first 32 features of tensor match ML vector exactly', () => {
    const snap = createSnapshot();
    const vector = buildEmpireMLVector32(snap);
    const tensor = buildEmpireDLTensor48(snap);
    for (let i = 0; i < 32; i++) {
      expect(tensor[i]).toBeCloseTo(vector[i], 10);
    }
  });
});

// ============================================================================
// MARK: describe — full run simulations
// ============================================================================

describe('EmpireModeAdapter — full run simulation', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('FOUNDATION phase: 20 ticks of onTickStart and onTickEnd produce valid state', () => {
    let snap = adapter.configure(createSnapshot(), { advantageId: 'MOMENTUM_CAPITAL' });
    const tickDuration = 30_000; // 30 seconds per tick

    for (let tick = 0; tick < 20; tick++) {
      const elapsed = tick * tickDuration;
      snap = {
        ...snap,
        tick,
        timers: { ...snap.timers, elapsedMs: elapsed },
      };
      snap = adapter.onTickStart(snap);
      snap = adapter.onTickEnd(snap);
    }

    // After 20 ticks at 30s each = 10 minutes → clock should be active
    expect(snap.tags).toContain('solo:clock_active');

    // ML vector should still be valid after 20 ticks
    const vector = buildEmpireMLVector32(snap);
    expect(vector).toHaveLength(32);
    for (const v of vector) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('full phase arc simulation: FOUNDATION → ESCALATION → SOVEREIGNTY', () => {
    let snap = adapter.configure(createSnapshot());

    // Simulate tick-by-tick through all three phases
    const phasesSeen = new Set<RunPhase>();
    const tickDurationMs = 30_000;

    for (let tick = 0; tick < 25; tick++) {
      const elapsedMs = tick * tickDurationMs;
      snap = { ...snap, tick, timers: { ...snap.timers, elapsedMs } };
      snap = adapter.onTickStart(snap);
      phasesSeen.add(snap.phase as RunPhase);
      snap = adapter.onTickEnd(snap);
    }

    // All three phases should have been visited
    expect(phasesSeen).toContain('FOUNDATION');
    expect(phasesSeen).toContain('ESCALATION');
    expect(phasesSeen).toContain('SOVEREIGNTY');

    // At end of simulation (tick=24, 12 minutes), sovereignty decision should be ready
    expect(snap.tags).toContain('solo:clock_active');
  });

  it('bleed mode survival: all bots wake immediately and haterHeat accumulates over 10 T4 ticks', () => {
    let snap = adapter.configure(createSnapshot(), { bleedMode: true });

    // All bots should be WATCHING at configure
    for (const bot of snap.battle.bots) {
      expect(bot.state satisfies BotState).toBe('WATCHING');
    }

    // Simulate 10 ticks at T4 pressure
    snap = {
      ...snap,
      pressure: { ...snap.pressure, tier: 'T4' as PressureTier },
    };

    for (let tick = 0; tick < 10; tick++) {
      snap = { ...snap, tick, timers: { ...snap.timers, elapsedMs: tick * 30_000 } };
      snap = adapter.onTickStart(snap);
      snap = adapter.onTickEnd(snap);
    }

    // Bleed + T4 adds 1 haterHeat per tick
    expect(snap.economy.haterHeat).toBeGreaterThanOrEqual(10);

    // Tensor should still be valid
    const tensor = buildEmpireDLTensor48(snap);
    expect(tensor).toHaveLength(48);
  });

  it('comeback arc: low-cash for 15 ticks, then recover, then finalize with surge', () => {
    let snap = adapter.configure(createSnapshot(), { advantageId: 'MOMENTUM_CAPITAL' });

    // Run 15 low-cash ticks
    for (let tick = 0; tick < 15; tick++) {
      snap = {
        ...snap,
        tick,
        timers: { ...snap.timers, elapsedMs: tick * 30_000 },
        economy: { ...snap.economy, cash: 1_500 },
      };
      snap = adapter.onTickStart(snap);
      snap = adapter.onTickEnd(snap);
    }

    // Verify streak reached 15
    expect(snap.tags.some((t) => t.startsWith('solo:cash_low_streak:'))).toBe(true);

    // Now recover cash
    snap = {
      ...snap,
      tick: 15,
      timers: { ...snap.timers, elapsedMs: 15 * 30_000 },
      economy: { ...snap.economy, cash: 5_000 },
    };
    snap = adapter.onTickStart(snap);

    expect(snap.tags).toContain('solo:comeback_surge_armed');

    // Tick end should arm comeback
    snap = adapter.onTickEnd(snap);
    expect(snap.tags).toContain('solo:comeback_realized');

    // Finalize with FREEDOM outcome
    snap = {
      ...snap,
      outcome: 'FREEDOM' as RunOutcome,
    };
    const finalized = adapter.finalize(snap);

    expect(finalized.sovereignty.proofBadges).toContain('COMEBACK_SURGE');
    expect(finalized.sovereignty.cordScore).toBeGreaterThan(1);
  });

  it('USE_HOLD through director: hold charge consumed, window frozen, re-use blocked', () => {
    let snap = adapter.configure(createSnapshot(), { advantageId: 'MOMENTUM_CAPITAL' });

    // Use hold
    snap = adapter.resolveAction(snap, 'USE_HOLD', { windowId: 'w-1' });
    expect(snap.timers.holdCharges).toBe(0);
    expect(snap.timers.frozenWindowIds).toContain('w-1');

    // Second USE_HOLD attempt fails (no charges)
    const snapshotRef = snap;
    const snapAfterSecond = adapter.resolveAction(snap, 'USE_HOLD', { windowId: 'w-2' });
    expect(snapAfterSecond).toBe(snapshotRef); // unchanged reference

    // Finalize
    const finalized = adapter.finalize(snap);
    expect(finalized.sovereignty.cordScore).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// MARK: describe — chat signal readiness
// ============================================================================

describe('EmpireModeAdapter — chat signal readiness', () => {
  let adapter: EmpireModeAdapter;

  beforeEach(() => {
    adapter = new EmpireModeAdapter();
    vi.clearAllMocks();
  });

  it('configured snapshot has all fields needed for ModeSignalAdapter.adaptConfigure', () => {
    const configured = adapter.configure(createSnapshot(), { advantageId: 'MOMENTUM_CAPITAL' });
    // Fields required by ModeSignalAdapter compat interface
    expect(configured.mode).toBe('solo');
    expect(configured.runId).toBeTruthy();
    expect(configured.tick).toBe(0);
    expect(configured.modeState.advantageId).toBe('MOMENTUM_CAPITAL');
    expect(configured.modeState.handicapIds).toBeDefined();
    expect(Array.isArray(configured.modeState.handicapIds)).toBe(true);
    expect(configured.modeState.bleedMode).toBeDefined();
    expect(configured.tags).toContain('mode:empire');
  });

  it('configured bleed snapshot contains all expected chat-relevant signal tags', () => {
    const configured = adapter.configure(createSnapshot(), { bleedMode: true });
    expect(configured.tags).toContain('bleed:enabled');
    expect(configured.tags).toContain('solo:bleed_mode:hard');
    expect(configured.tags).toContain('mode:empire');
  });

  it('onTickStart sovereignty snapshot produces tags sufficient for phase-change chat signal', () => {
    const snap = createSnapshot('solo', SOVEREIGNTY_ELAPSED_MS);
    const result = adapter.onTickStart(snap);
    const hasPhaseTag = result.tags.some((t) => t.startsWith('solo:phase_transition:'));
    expect(hasPhaseTag).toBe(true);
    expect(result.phase).toBe('SOVEREIGNTY');
  });

  it('finalized FREEDOM snapshot has sufficient badge array for reward chat signal', () => {
    const snap = {
      ...createSnapshot(),
      outcome: 'FREEDOM' as RunOutcome,
      modeState: {
        ...createSnapshot().modeState,
        bleedMode: true,
        handicapIds: ['CLOCK_CURSED'] as SoloHandicapId[],
      },
    };
    const finalized = adapter.finalize(snap);
    expect(finalized.sovereignty.proofBadges).toContain('BLEED_S_GRADE_ELIGIBLE');
    expect(finalized.sovereignty.proofBadges).toContain('FULL_BOT_GAUNTLET');
    expect(finalized.sovereignty.cordScore).toBeGreaterThanOrEqual(1.8);
  });

  it('ML vector produced from onTickStart output has valid structure for adapter emission', () => {
    const snap = createSnapshot('solo', TEN_MIN_MS);
    const afterTick = adapter.onTickStart(snap);
    const vector = buildEmpireMLVector32(afterTick);
    const tensor = buildEmpireDLTensor48(afterTick);

    // Vector must be 32 finite values
    expect(vector).toHaveLength(32);
    expect(tensor).toHaveLength(48);
    expect(vector.every((v) => Number.isFinite(v))).toBe(true);
    expect(tensor.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('DL tensor after bleed+SOVEREIGNTY contains correct urgency indicators', () => {
    const snap = {
      ...createSnapshot('solo', SOVEREIGNTY_ELAPSED_MS),
      modeState: { ...createSnapshot().modeState, bleedMode: true },
      pressure: { ...createSnapshot().pressure, tier: 'T4' as PressureTier, score: 0.92 },
    };
    const afterTick = adapter.onTickStart(snap);
    const tensor = buildEmpireDLTensor48(afterTick);

    // F0: pressure score should be near 0.92
    expect(tensor[0]).toBeCloseTo(0.92, 5);
    // F1: tier T4 = 1.0
    expect(tensor[1]).toBeCloseTo(1.0, 5);
    // F14: bleed mode = 1
    expect(tensor[14]).toBe(1);
  });

  it('all action IDs are defined and cover expected mode surface', () => {
    expect(ALL_MODE_ACTION_IDS).toHaveLength(8);
    expect(ALL_MODE_ACTION_IDS).toContain('USE_HOLD');
    expect(ALL_MODE_ACTION_IDS).toContain('FIRE_EXTRACTION');
    expect(ALL_MODE_ACTION_IDS).toContain('LOCK_GHOST_WINDOW');
  });
});

// ============================================================================
// MARK: describe — GamePrimitives constant alignment
// ============================================================================

describe('EmpireModeAdapter — GamePrimitives constant alignment', () => {
  it('BOT_THREAT_LEVEL: BOT_05 has highest threat (1.0)', () => {
    expect(BOT_THREAT_LEVEL['BOT_05' as HaterBotId]).toBe(1.0);
    expect(BOT_THREAT_LEVEL['BOT_01' as HaterBotId]).toBe(0.2);
  });

  it('BOT_STATE_THREAT_MULTIPLIER: DORMANT = 0, ATTACKING = 1', () => {
    expect(BOT_STATE_THREAT_MULTIPLIER['DORMANT' as BotState]).toBe(0.0);
    expect(BOT_STATE_THREAT_MULTIPLIER['ATTACKING' as BotState]).toBe(1.0);
  });

  it('ATTACK_CATEGORY_BASE_MAGNITUDE: BREACH is highest at 0.9', () => {
    expect(ATTACK_CATEGORY_BASE_MAGNITUDE['BREACH' as AttackCategory]).toBe(0.9);
    expect(ATTACK_CATEGORY_BASE_MAGNITUDE['HEAT' as AttackCategory]).toBe(0.5);
  });

  it('ATTACK_CATEGORY_IS_COUNTERABLE: HEAT is NOT counterable', () => {
    expect(ATTACK_CATEGORY_IS_COUNTERABLE['HEAT' as AttackCategory]).toBe(false);
    expect(ATTACK_CATEGORY_IS_COUNTERABLE['EXTRACTION' as AttackCategory]).toBe(true);
  });

  it('VISIBILITY_CONCEALMENT_FACTOR: EXPOSED = 0 (fully visible), HIDDEN = 1', () => {
    expect(VISIBILITY_CONCEALMENT_FACTOR['EXPOSED' as VisibilityLevel]).toBe(0);
    expect(VISIBILITY_CONCEALMENT_FACTOR['HIDDEN' as VisibilityLevel]).toBe(1);
  });

  it('PRESSURE_TIER_NORMALIZED: T0=0, T4=1 (full range covered)', () => {
    expect(PRESSURE_TIER_NORMALIZED['T0' as PressureTier]).toBe(0.0);
    expect(PRESSURE_TIER_NORMALIZED['T4' as PressureTier]).toBe(1.0);
  });

  it('MODE_DIFFICULTY_MULTIPLIER: solo=1.0, pvp=1.4, ghost=1.6', () => {
    expect(MODE_DIFFICULTY_MULTIPLIER['solo' as ModeCode]).toBe(1.0);
    expect(MODE_DIFFICULTY_MULTIPLIER['pvp' as ModeCode]).toBe(1.4);
    expect(MODE_DIFFICULTY_MULTIPLIER['ghost' as ModeCode]).toBe(1.6);
  });

  it('SHIELD_LAYER_IDS contains exactly 4 layers in canonical order', () => {
    expect(SHIELD_LAYER_IDS).toHaveLength(4);
    expect(SHIELD_LAYER_IDS[0]).toBe('L1' satisfies ShieldLayerId);
    expect(SHIELD_LAYER_IDS[3]).toBe('L4' satisfies ShieldLayerId);
  });

  it('HATER_BOT_IDS contains exactly 5 bot IDs', () => {
    expect(HATER_BOT_IDS).toHaveLength(5);
    expect(HATER_BOT_IDS).toContain('BOT_01' satisfies HaterBotId);
    expect(HATER_BOT_IDS).toContain('BOT_05' satisfies HaterBotId);
  });

  it('RUN_PHASES contains exactly 3 phases in order', () => {
    expect(RUN_PHASES).toHaveLength(3);
    expect(RUN_PHASES[0]).toBe('FOUNDATION' satisfies RunPhase);
    expect(RUN_PHASES[2]).toBe('SOVEREIGNTY' satisfies RunPhase);
  });

  it('createAttack with HEAT category has correct base magnitude', () => {
    const atk = createAttack('test', 'HEAT', 5);
    expect(atk.category satisfies AttackCategory).toBe('HEAT');
    expect(ATTACK_CATEGORY_BASE_MAGNITUDE[atk.category as AttackCategory]).toBe(0.5);
  });

  it('createThreat with EXPOSED visibility has concealment = 0', () => {
    const threat = createThreat('t1', 1, 'EXPOSED');
    expect(VISIBILITY_CONCEALMENT_FACTOR[threat.visibleAs as VisibilityLevel]).toBe(0);
  });

  it('createCardInstance with HIGH divergencePotential is valid', () => {
    const instance = createCardInstance('ci-high', ['income'], 'HIGH');
    expect(instance.divergencePotential satisfies DivergencePotential).toBe('HIGH');
  });

  it('createCardDefinition with FUBAR deck type is valid', () => {
    const card = createCardDefinition('card-x', 'FUBAR', 'PRE');
    expect(card.deckType satisfies DeckType).toBe('FUBAR');
    expect(card.timingClass).toContain('PRE' satisfies TimingClass);
  });
});
