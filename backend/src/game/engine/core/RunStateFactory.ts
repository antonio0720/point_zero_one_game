/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/RunStateFactory.ts
 *
 * Doctrine:
 * - backend creates the authoritative initial state
 * - factories normalize external aliases into canonical backend mode codes
 * - semantic pressure and cadence tier are both seeded at run creation
 * - shield topology must match the stronger frontend doctrine
 * - returned state is deeply frozen and safe for deterministic hashing
 */

import type {
  HaterBotId,
  ModeCode,
  PressureTier,
  ShieldLayerId,
  ShieldLayerLabel,
} from './GamePrimitives';
import type {
  BotRuntimeState,
  ModePresentationCode,
  PressureBand,
  RunStateSnapshot,
  ShieldLayerState,
} from './RunStateSnapshot';
import { deepFrozenClone } from './Deterministic';

type ExternalModeCode =
  | ModeCode
  | 'empire'
  | 'predator'
  | 'syndicate'
  | 'phantom'
  | 'asymmetric-pvp'
  | 'co-op'
  | 'team-up'
  | 'chase-a-legend';

interface LayerBlueprint {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly max: number;
  readonly regenPerTick: number;
}

interface ModeDefaults {
  readonly modePresentation: ModePresentationCode;
  readonly cash: number;
  readonly incomePerTick: number;
  readonly expensesPerTick: number;
  readonly freedomTarget: number;
  readonly initialHeat: number;
  readonly sharedTreasury: boolean;
  readonly sharedTreasuryBalance: number;
  readonly sharedOpportunityDeck: boolean;
  readonly battleBudget: number;
  readonly holdEnabled: boolean;
  readonly holdCharges: number;
  readonly loadoutEnabled: boolean;
  readonly legendMarkersEnabled: boolean;
  readonly spectatorLimit: number;
  readonly counterIntelTier: number;
  readonly phaseBoundaryWindowsRemaining: number;
  readonly currentTickDurationMs: number;
  readonly seasonBudgetMs: number;
}

export interface RunFactoryInput {
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly mode: ExternalModeCode;

  readonly communityHeatModifier?: number;
  readonly legendRunId?: string | null;
  readonly legendOwnerUserId?: string | null;

  readonly disabledBots?: readonly HaterBotId[];
  readonly roleAssignments?: Readonly<Record<string, string>>;
  readonly trustScores?: Readonly<Record<string, number>>;
  readonly defectionStepByPlayer?: Readonly<Record<string, number>>;
  readonly handicapIds?: readonly string[];
  readonly advantageId?: string | null;

  readonly tags?: readonly string[];

  readonly initialCash?: number;
  readonly initialDebt?: number;
  readonly initialIncomePerTick?: number;
  readonly initialExpensesPerTick?: number;
  readonly freedomTarget?: number;
  readonly initialHeat?: number;
  readonly initialPressureScore?: number;

  readonly sharedTreasuryBalance?: number;
  readonly battleBudget?: number;
  readonly battleBudgetCap?: number;
  readonly spectatorLimit?: number;
  readonly holdCharges?: number;
  readonly seasonBudgetMs?: number;
  readonly currentTickDurationMs?: number;
}

const ALL_BOTS: readonly HaterBotId[] = [
  'BOT_01',
  'BOT_02',
  'BOT_03',
  'BOT_04',
  'BOT_05',
] as const;

const BOT_LABELS: Readonly<Record<HaterBotId, string>> = Object.freeze({
  BOT_01: 'Liquidator',
  BOT_02: 'Bureaucrat',
  BOT_03: 'Manipulator',
  BOT_04: 'Crash Prophet',
  BOT_05: 'Legacy Heir',
});

const LAYER_BLUEPRINTS: readonly LayerBlueprint[] = [
  { layerId: 'L1', label: 'CASH_RESERVE', max: 100, regenPerTick: 2 },
  { layerId: 'L2', label: 'CREDIT_LINE', max: 120, regenPerTick: 2 },
  { layerId: 'L3', label: 'INCOME_BASE', max: 150, regenPerTick: 1 },
  { layerId: 'L4', label: 'NETWORK_CORE', max: 200, regenPerTick: 1 },
] as const;

const MODE_DEFAULTS: Readonly<Record<ModeCode, ModeDefaults>> = Object.freeze({
  solo: {
    modePresentation: 'empire',
    cash: 20_000,
    incomePerTick: 1_200,
    expensesPerTick: 900,
    freedomTarget: 250_000,
    initialHeat: 0,
    sharedTreasury: false,
    sharedTreasuryBalance: 0,
    sharedOpportunityDeck: false,
    battleBudget: 0,
    holdEnabled: true,
    holdCharges: 1,
    loadoutEnabled: true,
    legendMarkersEnabled: false,
    spectatorLimit: 0,
    counterIntelTier: 1,
    phaseBoundaryWindowsRemaining: 1,
    currentTickDurationMs: 4_000,
    seasonBudgetMs: 12 * 60 * 1_000,
  },
  pvp: {
    modePresentation: 'predator',
    cash: 15_000,
    incomePerTick: 1_100,
    expensesPerTick: 950,
    freedomTarget: 225_000,
    initialHeat: 10,
    sharedTreasury: false,
    sharedTreasuryBalance: 0,
    sharedOpportunityDeck: true,
    battleBudget: 20,
    holdEnabled: false,
    holdCharges: 0,
    loadoutEnabled: false,
    legendMarkersEnabled: false,
    spectatorLimit: 50,
    counterIntelTier: 2,
    phaseBoundaryWindowsRemaining: 2,
    currentTickDurationMs: 3_500,
    seasonBudgetMs: 12 * 60 * 1_000,
  },
  coop: {
    modePresentation: 'syndicate',
    cash: 15_000,
    incomePerTick: 1_150,
    expensesPerTick: 925,
    freedomTarget: 300_000,
    initialHeat: 5,
    sharedTreasury: true,
    sharedTreasuryBalance: 30_000,
    sharedOpportunityDeck: false,
    battleBudget: 0,
    holdEnabled: false,
    holdCharges: 0,
    loadoutEnabled: false,
    legendMarkersEnabled: false,
    spectatorLimit: 8,
    counterIntelTier: 1,
    phaseBoundaryWindowsRemaining: 2,
    currentTickDurationMs: 4_000,
    seasonBudgetMs: 14 * 60 * 1_000,
  },
  ghost: {
    modePresentation: 'phantom',
    cash: 15_000,
    incomePerTick: 1_200,
    expensesPerTick: 900,
    freedomTarget: 250_000,
    initialHeat: 25,
    sharedTreasury: false,
    sharedTreasuryBalance: 0,
    sharedOpportunityDeck: false,
    battleBudget: 0,
    holdEnabled: false,
    holdCharges: 0,
    loadoutEnabled: false,
    legendMarkersEnabled: true,
    spectatorLimit: 0,
    counterIntelTier: 1,
    phaseBoundaryWindowsRemaining: 3,
    currentTickDurationMs: 3_800,
    seasonBudgetMs: 12 * 60 * 1_000,
  },
});

const PRESSURE_BAND_TO_TIER: Readonly<Record<PressureBand, PressureTier>> =
  Object.freeze({
    CALM: 'T1',
    BUILDING: 'T1',
    ELEVATED: 'T2',
    HIGH: 'T3',
    CRITICAL: 'T4',
  });

function assertNonEmptyText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  return normalized;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toMoney(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeFinite(
  value: number | undefined,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  if (!Number.isFinite(value)) {
    return clamp(fallback, min, max);
  }
  return clamp(value as number, min, max);
}

function normalizeInteger(
  value: number | undefined,
  fallback: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const normalized = normalizeFinite(value, fallback, min, max);
  return Math.trunc(normalized);
}

function normalizeMode(mode: ExternalModeCode): ModeCode {
  const normalized = String(mode).trim().toLowerCase();

  switch (normalized) {
    case 'solo':
    case 'empire':
      return 'solo';

    case 'pvp':
    case 'predator':
    case 'asymmetric-pvp':
      return 'pvp';

    case 'coop':
    case 'co-op':
    case 'syndicate':
    case 'team-up':
      return 'coop';

    case 'ghost':
    case 'phantom':
    case 'chase-a-legend':
      return 'ghost';

    default:
      throw new Error(`Unsupported mode alias: ${String(mode)}`);
  }
}

function derivePressureBand(score: number): PressureBand {
  if (score >= 0.85) return 'CRITICAL';
  if (score >= 0.65) return 'HIGH';
  if (score >= 0.45) return 'ELEVATED';
  if (score >= 0.20) return 'BUILDING';
  return 'CALM';
}

function createLayerState(blueprint: LayerBlueprint): ShieldLayerState {
  return {
    layerId: blueprint.layerId,
    label: blueprint.label,
    current: blueprint.max,
    max: blueprint.max,
    regenPerTick: blueprint.regenPerTick,
    breached: false,
    integrityRatio: 1,
    lastDamagedTick: null,
    lastRecoveredTick: null,
  };
}

function computeWeakestLayer(
  layers: readonly ShieldLayerState[],
): Pick<RunStateSnapshot['shield'], 'weakestLayerId' | 'weakestLayerRatio'> {
  if (layers.length === 0) {
    return {
      weakestLayerId: 'L1',
      weakestLayerRatio: 0,
    };
  }

  let weakest = layers[0];

  for (const layer of layers) {
    if (layer.integrityRatio < weakest.integrityRatio) {
      weakest = layer;
      continue;
    }

    if (
      layer.integrityRatio === weakest.integrityRatio &&
      layer.current < weakest.current
    ) {
      weakest = layer;
    }
  }

  return {
    weakestLayerId: weakest.layerId,
    weakestLayerRatio: weakest.integrityRatio,
  };
}

function normalizeDisabledBots(
  input: readonly HaterBotId[] | undefined,
): readonly HaterBotId[] {
  if (!input || input.length === 0) {
    return [];
  }

  const set = new Set<HaterBotId>(input);
  const ordered: HaterBotId[] = [];

  for (const botId of ALL_BOTS) {
    if (set.has(botId)) {
      ordered.push(botId);
    }
  }

  return ordered;
}

function createInitialBots(
  disabledBots: readonly HaterBotId[],
): readonly BotRuntimeState[] {
  const disabled = new Set<HaterBotId>(disabledBots);

  return ALL_BOTS.map((botId) => {
    const neutralized = disabled.has(botId);

    return {
      botId,
      label: BOT_LABELS[botId],
      state: neutralized ? 'NEUTRALIZED' : 'DORMANT',
      heat: 0,
      lastAttackTick: null,
      attacksLanded: 0,
      attacksBlocked: 0,
      neutralized,
    };
  });
}

function normalizeNumberRecord(
  source: Readonly<Record<string, number>> | undefined,
  min = 0,
  max = 100,
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const [key, value] of Object.entries(source ?? {})) {
    if (!Number.isFinite(value)) {
      continue;
    }

    result[key] = clamp(value, min, max);
  }

  return result;
}

function normalizeIntegerRecord(
  source: Readonly<Record<string, number>> | undefined,
  min = 0,
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const [key, value] of Object.entries(source ?? {})) {
    if (!Number.isFinite(value)) {
      continue;
    }

    result[key] = Math.max(min, Math.trunc(value));
  }

  return result;
}

function normalizeStringRecord(
  source: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(source ?? {})) {
    const normalized = String(value).trim();
    if (normalized.length > 0) {
      result[key] = normalized;
    }
  }

  return result;
}

function normalizeTags(
  customTags: readonly string[] | undefined,
  mode: ModeCode,
  modePresentation: ModePresentationCode,
): readonly string[] {
  const set = new Set<string>([
    'schema:engine-run-state.v2',
    `mode:${mode}`,
    `presentation:${modePresentation}`,
  ]);

  for (const tag of customTags ?? []) {
    const normalized = String(tag).trim();
    if (normalized.length > 0) {
      set.add(normalized);
    }
  }

  return Array.from(set.values());
}

export function createInitialRunState(
  input: RunFactoryInput,
): RunStateSnapshot {
  const runId = assertNonEmptyText(input.runId, 'runId');
  const userId = assertNonEmptyText(input.userId, 'userId');
  const seed = assertNonEmptyText(input.seed, 'seed');

  const mode = normalizeMode(input.mode);
  const defaults = MODE_DEFAULTS[mode];

  const pressureScore = normalizeFinite(
    input.initialPressureScore,
    0.15,
    0,
    1,
  );
  const pressureBand = derivePressureBand(pressureScore);
  const pressureTier = PRESSURE_BAND_TO_TIER[pressureBand];

  const cash = toMoney(
    normalizeFinite(input.initialCash, defaults.cash, -1_000_000_000, 1_000_000_000),
  );
  const debt = toMoney(
    normalizeFinite(input.initialDebt, 0, 0, 1_000_000_000),
  );
  const incomePerTick = toMoney(
    normalizeFinite(input.initialIncomePerTick, defaults.incomePerTick, 0, 1_000_000_000),
  );
  const expensesPerTick = toMoney(
    normalizeFinite(input.initialExpensesPerTick, defaults.expensesPerTick, 0, 1_000_000_000),
  );
  const netWorth = toMoney(cash - debt);

  const disabledBots = normalizeDisabledBots(input.disabledBots);
  const layers = LAYER_BLUEPRINTS.map(createLayerState);
  const weakestLayer = computeWeakestLayer(layers);

  const sharedTreasuryBalance =
    mode === 'coop'
      ? toMoney(
          normalizeFinite(
            input.sharedTreasuryBalance,
            defaults.sharedTreasuryBalance,
            0,
            1_000_000_000,
          ),
        )
      : 0;

  const battleBudget = toMoney(
    normalizeFinite(input.battleBudget, defaults.battleBudget, 0, 1_000_000_000),
  );

  const snapshot: RunStateSnapshot = {
    schemaVersion: 'engine-run-state.v2',
    runId,
    userId,
    seed,
    mode,
    tick: 0,
    phase: 'FOUNDATION',
    outcome: null,
    tags: normalizeTags(input.tags, mode, defaults.modePresentation),

    economy: {
      cash,
      debt,
      incomePerTick,
      expensesPerTick,
      netWorth,
      freedomTarget: toMoney(
        normalizeFinite(input.freedomTarget, defaults.freedomTarget, 1, 1_000_000_000),
      ),
      haterHeat: normalizeFinite(input.initialHeat, defaults.initialHeat, 0, 100),
      opportunitiesPurchased: 0,
      privilegePlays: 0,
    },

    pressure: {
      score: pressureScore,
      tier: pressureTier,
      band: pressureBand,
      previousTier: pressureTier,
      previousBand: pressureBand,
      upwardCrossings: 0,
      survivedHighPressureTicks: 0,
      lastEscalationTick: null,
      maxScoreSeen: pressureScore,
    },

    tension: {
      score: 0,
      anticipation: 0,
      visibleThreats: [],
      maxPulseTriggered: false,
      lastSpikeTick: null,
    },

    shield: {
      layers,
      weakestLayerId: weakestLayer.weakestLayerId,
      weakestLayerRatio: weakestLayer.weakestLayerRatio,
      blockedThisRun: 0,
      damagedThisRun: 0,
      breachesThisRun: 0,
      repairQueueDepth: 0,
    },

    battle: {
      bots: createInitialBots(disabledBots),
      battleBudget,
      battleBudgetCap: toMoney(
        normalizeFinite(input.battleBudgetCap, 200, 0, 1_000_000_000),
      ),
      extractionCooldownTicks: 0,
      firstBloodClaimed: false,
      pendingAttacks: [],
      sharedOpportunityDeckCursor: 0,
      rivalryHeatCarry: 0,
      neutralizedBotIds: disabledBots,
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
      holdEnabled: defaults.holdEnabled,
      loadoutEnabled: defaults.loadoutEnabled,
      sharedTreasury: defaults.sharedTreasury,
      sharedTreasuryBalance,
      trustScores: normalizeNumberRecord(input.trustScores, 0, 100),
      roleAssignments: normalizeStringRecord(input.roleAssignments),
      defectionStepByPlayer: normalizeIntegerRecord(input.defectionStepByPlayer, 0),
      legendMarkersEnabled: defaults.legendMarkersEnabled,
      communityHeatModifier: normalizeFinite(
        input.communityHeatModifier,
        0,
        -100,
        100,
      ),
      sharedOpportunityDeck: defaults.sharedOpportunityDeck,
      counterIntelTier: defaults.counterIntelTier,
      spectatorLimit: normalizeInteger(
        input.spectatorLimit,
        defaults.spectatorLimit,
        0,
        1_000_000,
      ),
      phaseBoundaryWindowsRemaining: defaults.phaseBoundaryWindowsRemaining,
      bleedMode: false,
      handicapIds: (input.handicapIds ?? []).filter(
        (value) => String(value).trim().length > 0,
      ),
      advantageId:
        input.advantageId && input.advantageId.trim().length > 0
          ? input.advantageId.trim()
          : null,
      disabledBots,
      modePresentation: defaults.modePresentation,
      roleLockEnabled: mode === 'coop' || mode === 'pvp',
      extractionActionsRemaining: mode === 'pvp' ? 1 : 0,
      ghostBaselineRunId:
        input.legendRunId && input.legendRunId.trim().length > 0
          ? input.legendRunId.trim()
          : null,
      legendOwnerUserId:
        input.legendOwnerUserId && input.legendOwnerUserId.trim().length > 0
          ? input.legendOwnerUserId.trim()
          : null,
    },

    timers: {
      seasonBudgetMs: normalizeInteger(
        input.seasonBudgetMs,
        defaults.seasonBudgetMs,
        1_000,
        24 * 60 * 60 * 1_000,
      ),
      extensionBudgetMs: 0,
      elapsedMs: 0,
      currentTickDurationMs: normalizeInteger(
        input.currentTickDurationMs,
        defaults.currentTickDurationMs,
        50,
        60 * 60 * 1_000,
      ),
      nextTickAtMs: null,
      holdCharges: normalizeInteger(
        input.holdCharges,
        defaults.holdCharges,
        0,
        100,
      ),
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

  return deepFrozenClone(snapshot);
}