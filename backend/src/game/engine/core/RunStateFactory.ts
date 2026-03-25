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
 * - ML/DL feature extraction is a first-class output at the factory layer
 * - scenario presets encode user-experience intent, not just data defaults
 * - patch system enables safe incremental state evolution without mutation
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

// ============================================================================
// § 1 — Core types, constants, and normalizers (canonical factory layer)
// ============================================================================

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

// ============================================================================
// § 2 — RunStateValidator — pre-flight validation before factory creation
// ============================================================================

export interface RunFactoryValidationError {
  readonly field: string;
  readonly message: string;
  readonly value: unknown;
}

export interface RunFactoryValidationResult {
  readonly valid: boolean;
  readonly errors: readonly RunFactoryValidationError[];
  readonly warnings: readonly string[];
  readonly normalizedMode: ModeCode | null;
}

/**
 * Validates a RunFactoryInput before creation. Catches out-of-range values,
 * missing required fields, and mode alias conflicts before state is built.
 * Returns structured errors suitable for user-facing feedback.
 */
export class RunStateValidator {
  private static readonly MAX_CASH = 1_000_000_000;
  private static readonly MAX_FREEDOM_TARGET = 1_000_000_000;
  private static readonly MAX_HEAT = 100;
  private static readonly MAX_PRESSURE_SCORE = 1;
  private static readonly MAX_SEASON_BUDGET_MS = 24 * 60 * 60 * 1_000;
  private static readonly MIN_TICK_DURATION_MS = 50;

  public validate(input: RunFactoryInput): RunFactoryValidationResult {
    const errors: RunFactoryValidationError[] = [];
    const warnings: string[] = [];
    let normalizedMode: ModeCode | null = null;

    // Required fields
    if (!input.runId || String(input.runId).trim().length === 0) {
      errors.push({ field: 'runId', message: 'runId is required and must be non-empty', value: input.runId });
    }
    if (!input.userId || String(input.userId).trim().length === 0) {
      errors.push({ field: 'userId', message: 'userId is required and must be non-empty', value: input.userId });
    }
    if (!input.seed || String(input.seed).trim().length === 0) {
      errors.push({ field: 'seed', message: 'seed is required and must be non-empty', value: input.seed });
    }

    // Mode normalization
    try {
      normalizedMode = normalizeMode(input.mode);
    } catch (e) {
      errors.push({ field: 'mode', message: `Invalid mode: ${String(e)}`, value: input.mode });
    }

    // Cash range
    if (input.initialCash !== undefined) {
      if (!Number.isFinite(input.initialCash)) {
        errors.push({ field: 'initialCash', message: 'initialCash must be a finite number', value: input.initialCash });
      } else if (Math.abs(input.initialCash) > RunStateValidator.MAX_CASH) {
        warnings.push(`initialCash ${input.initialCash} will be clamped to ±${RunStateValidator.MAX_CASH}`);
      }
    }

    // Debt range
    if (input.initialDebt !== undefined) {
      if (!Number.isFinite(input.initialDebt)) {
        errors.push({ field: 'initialDebt', message: 'initialDebt must be a finite number', value: input.initialDebt });
      } else if (input.initialDebt < 0) {
        errors.push({ field: 'initialDebt', message: 'initialDebt cannot be negative', value: input.initialDebt });
      }
    }

    // Freedom target
    if (input.freedomTarget !== undefined) {
      if (!Number.isFinite(input.freedomTarget) || input.freedomTarget <= 0) {
        errors.push({ field: 'freedomTarget', message: 'freedomTarget must be a positive finite number', value: input.freedomTarget });
      } else if (input.freedomTarget > RunStateValidator.MAX_FREEDOM_TARGET) {
        warnings.push(`freedomTarget ${input.freedomTarget} will be clamped to ${RunStateValidator.MAX_FREEDOM_TARGET}`);
      }
    }

    // Heat range
    if (input.initialHeat !== undefined) {
      if (!Number.isFinite(input.initialHeat)) {
        errors.push({ field: 'initialHeat', message: 'initialHeat must be a finite number', value: input.initialHeat });
      } else if (input.initialHeat < 0 || input.initialHeat > RunStateValidator.MAX_HEAT) {
        warnings.push(`initialHeat ${input.initialHeat} will be clamped to [0, ${RunStateValidator.MAX_HEAT}]`);
      }
    }

    // Pressure score
    if (input.initialPressureScore !== undefined) {
      if (!Number.isFinite(input.initialPressureScore)) {
        errors.push({ field: 'initialPressureScore', message: 'initialPressureScore must be a finite number', value: input.initialPressureScore });
      } else if (input.initialPressureScore < 0 || input.initialPressureScore > RunStateValidator.MAX_PRESSURE_SCORE) {
        warnings.push(`initialPressureScore ${input.initialPressureScore} will be clamped to [0, 1]`);
      }
    }

    // Season budget
    if (input.seasonBudgetMs !== undefined) {
      if (!Number.isFinite(input.seasonBudgetMs) || input.seasonBudgetMs < 1_000) {
        errors.push({ field: 'seasonBudgetMs', message: 'seasonBudgetMs must be at least 1000ms', value: input.seasonBudgetMs });
      } else if (input.seasonBudgetMs > RunStateValidator.MAX_SEASON_BUDGET_MS) {
        warnings.push(`seasonBudgetMs ${input.seasonBudgetMs} will be clamped to ${RunStateValidator.MAX_SEASON_BUDGET_MS}`);
      }
    }

    // Tick duration
    if (input.currentTickDurationMs !== undefined) {
      if (!Number.isFinite(input.currentTickDurationMs) || input.currentTickDurationMs < RunStateValidator.MIN_TICK_DURATION_MS) {
        errors.push({
          field: 'currentTickDurationMs',
          message: `currentTickDurationMs must be at least ${RunStateValidator.MIN_TICK_DURATION_MS}ms`,
          value: input.currentTickDurationMs,
        });
      }
    }

    // Battle budget / cap consistency
    if (input.battleBudget !== undefined && input.battleBudgetCap !== undefined) {
      if (Number.isFinite(input.battleBudget) && Number.isFinite(input.battleBudgetCap)) {
        if (input.battleBudget > input.battleBudgetCap) {
          warnings.push(`battleBudget (${input.battleBudget}) exceeds battleBudgetCap (${input.battleBudgetCap}); cap will be enforced`);
        }
      }
    }

    // Trust score range validation
    if (input.trustScores) {
      for (const [playerId, score] of Object.entries(input.trustScores)) {
        if (!Number.isFinite(score)) {
          errors.push({ field: `trustScores.${playerId}`, message: 'Trust score must be a finite number', value: score });
        } else if (score < 0 || score > 100) {
          warnings.push(`trustScores.${playerId} = ${score} will be clamped to [0, 100]`);
        }
      }
    }

    // Disabled bots validation
    if (input.disabledBots) {
      const validBotIds = new Set<string>(ALL_BOTS);
      for (const botId of input.disabledBots) {
        if (!validBotIds.has(botId)) {
          errors.push({ field: 'disabledBots', message: `Unknown bot ID: ${botId}`, value: botId });
        }
      }
      if (input.disabledBots.length === ALL_BOTS.length) {
        warnings.push('All bots are disabled — no hater pressure will be applied during this run');
      }
    }

    // Community heat modifier
    if (input.communityHeatModifier !== undefined) {
      if (!Number.isFinite(input.communityHeatModifier)) {
        errors.push({ field: 'communityHeatModifier', message: 'communityHeatModifier must be finite', value: input.communityHeatModifier });
      } else if (Math.abs(input.communityHeatModifier) > 100) {
        warnings.push(`communityHeatModifier ${input.communityHeatModifier} will be clamped to [-100, 100]`);
      }
    }

    // Mode-specific warnings
    if (normalizedMode !== null) {
      if (normalizedMode !== 'coop' && input.sharedTreasuryBalance !== undefined && input.sharedTreasuryBalance > 0) {
        warnings.push(`sharedTreasuryBalance is only active in coop mode; will be ignored for mode: ${normalizedMode}`);
      }
      if (normalizedMode !== 'ghost' && input.legendRunId) {
        warnings.push(`legendRunId is set but mode is ${normalizedMode}; ghost baseline tracking only applies in ghost mode`);
      }
      if (normalizedMode !== 'pvp' && input.battleBudget !== undefined && input.battleBudget > 0) {
        warnings.push(`battleBudget is set but mode is ${normalizedMode}; battle budget mechanics are primary for pvp`);
      }
    }

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      normalizedMode,
    });
  }

  /**
   * Validate and throw if invalid. Used in strict server-side contexts.
   */
  public validateOrThrow(input: RunFactoryInput): void {
    const result = this.validate(input);
    if (!result.valid) {
      const summary = result.errors
        .map((e) => `[${e.field}] ${e.message}`)
        .join('; ');
      throw new Error(`RunFactoryInput validation failed: ${summary}`);
    }
  }
}

// ============================================================================
// § 3 — RunStateScenarioFactory — preset scenarios encoding UX intent
// ============================================================================

/**
 * Named scenario identifiers that encode user-experience intent.
 * Each scenario pre-configures the factory input for a specific
 * narrative or competitive situation.
 */
export type RunScenarioId =
  | 'TUTORIAL'
  | 'BLITZ'
  | 'LEGEND_CHASE'
  | 'SABOTAGE_GAUNTLET'
  | 'DEBT_SPIRAL'
  | 'TRUST_COLLAPSE'
  | 'BOT_SIEGE'
  | 'ENDGAME_PUSH'
  | 'UNDERDOG'
  | 'HIGH_ROLLER'
  | 'PHANTOM_RUNNER'
  | 'SYNDICATE_SURGE';

export interface RunScenarioDescriptor {
  readonly id: RunScenarioId;
  readonly name: string;
  readonly description: string;
  readonly defaultMode: ModeCode;
  readonly difficultyRating: 1 | 2 | 3 | 4 | 5;
  readonly pressureProfile: 'LOW' | 'MEDIUM' | 'HIGH' | 'VARIABLE';
  readonly mlRiskWeight: number;
}

export const RUN_SCENARIO_DESCRIPTORS: Readonly<Record<RunScenarioId, RunScenarioDescriptor>> =
  Object.freeze({
    TUTORIAL: {
      id: 'TUTORIAL',
      name: 'Tutorial',
      description: 'Beginner-friendly solo run with all bots disabled and maximum time budget',
      defaultMode: 'solo',
      difficultyRating: 1,
      pressureProfile: 'LOW',
      mlRiskWeight: 0.1,
    },
    BLITZ: {
      id: 'BLITZ',
      name: 'Blitz Run',
      description: 'Fast-paced pvp with compressed tick duration and elevated starting heat',
      defaultMode: 'pvp',
      difficultyRating: 4,
      pressureProfile: 'HIGH',
      mlRiskWeight: 0.85,
    },
    LEGEND_CHASE: {
      id: 'LEGEND_CHASE',
      name: 'Legend Chase',
      description: 'Ghost mode run chasing an existing legend baseline with marker tracking enabled',
      defaultMode: 'ghost',
      difficultyRating: 3,
      pressureProfile: 'VARIABLE',
      mlRiskWeight: 0.65,
    },
    SABOTAGE_GAUNTLET: {
      id: 'SABOTAGE_GAUNTLET',
      name: 'Sabotage Gauntlet',
      description: 'Solo run with all bots active and maximum counter-intel tier',
      defaultMode: 'solo',
      difficultyRating: 5,
      pressureProfile: 'HIGH',
      mlRiskWeight: 0.95,
    },
    DEBT_SPIRAL: {
      id: 'DEBT_SPIRAL',
      name: 'Debt Spiral',
      description: 'Start deep in debt with bleed mode conditions; escape or collapse',
      defaultMode: 'solo',
      difficultyRating: 4,
      pressureProfile: 'HIGH',
      mlRiskWeight: 0.80,
    },
    TRUST_COLLAPSE: {
      id: 'TRUST_COLLAPSE',
      name: 'Trust Collapse',
      description: 'Coop mode with low trust scores pre-seeded and defection risk elevated',
      defaultMode: 'coop',
      difficultyRating: 4,
      pressureProfile: 'VARIABLE',
      mlRiskWeight: 0.75,
    },
    BOT_SIEGE: {
      id: 'BOT_SIEGE',
      name: 'Bot Siege',
      description: 'All hater bots active at maximum aggression in solo',
      defaultMode: 'solo',
      difficultyRating: 5,
      pressureProfile: 'HIGH',
      mlRiskWeight: 0.90,
    },
    ENDGAME_PUSH: {
      id: 'ENDGAME_PUSH',
      name: 'Endgame Push',
      description: 'Run starts near the season budget deadline; high tension, decision windows compressed',
      defaultMode: 'solo',
      difficultyRating: 3,
      pressureProfile: 'HIGH',
      mlRiskWeight: 0.70,
    },
    UNDERDOG: {
      id: 'UNDERDOG',
      name: 'Underdog',
      description: 'Low starting cash, high freedom target, no advantages — pure skill run',
      defaultMode: 'pvp',
      difficultyRating: 5,
      pressureProfile: 'HIGH',
      mlRiskWeight: 0.92,
    },
    HIGH_ROLLER: {
      id: 'HIGH_ROLLER',
      name: 'High Roller',
      description: 'Maximum starting cash and income with elevated freedom target',
      defaultMode: 'solo',
      difficultyRating: 2,
      pressureProfile: 'MEDIUM',
      mlRiskWeight: 0.35,
    },
    PHANTOM_RUNNER: {
      id: 'PHANTOM_RUNNER',
      name: 'Phantom Runner',
      description: 'Ghost mode at maximum heat with short tick budget and no safety nets',
      defaultMode: 'ghost',
      difficultyRating: 5,
      pressureProfile: 'HIGH',
      mlRiskWeight: 0.98,
    },
    SYNDICATE_SURGE: {
      id: 'SYNDICATE_SURGE',
      name: 'Syndicate Surge',
      description: 'Coop mode with maximum shared treasury and elevated income',
      defaultMode: 'coop',
      difficultyRating: 2,
      pressureProfile: 'MEDIUM',
      mlRiskWeight: 0.30,
    },
  });

/**
 * Builds a RunFactoryInput from a scenario preset. The caller provides
 * the required identity fields (runId, userId, seed) and the scenario
 * injects the experience-specific defaults.
 */
export class RunStateScenarioFactory {
  /**
   * Create a factory input for a named scenario.
   * All scenario-specific overrides are applied; caller-provided overrides win.
   */
  public static buildInput(
    scenario: RunScenarioId,
    identity: Pick<RunFactoryInput, 'runId' | 'userId' | 'seed'>,
    overrides: Partial<Omit<RunFactoryInput, 'runId' | 'userId' | 'seed'>> = {},
  ): RunFactoryInput {
    const descriptor = RUN_SCENARIO_DESCRIPTORS[scenario];
    const base = RunStateScenarioFactory.buildScenarioDefaults(scenario);
    return Object.freeze({ ...base, ...identity, ...overrides, mode: overrides.mode ?? descriptor.defaultMode });
  }

  /**
   * Create and freeze a RunStateSnapshot from a scenario preset.
   */
  public static createSnapshot(
    scenario: RunScenarioId,
    identity: Pick<RunFactoryInput, 'runId' | 'userId' | 'seed'>,
    overrides: Partial<Omit<RunFactoryInput, 'runId' | 'userId' | 'seed'>> = {},
  ): RunStateSnapshot {
    const input = RunStateScenarioFactory.buildInput(scenario, identity, overrides);
    return createInitialRunState(input);
  }

  /**
   * List all available scenarios with their descriptors.
   */
  public static listScenarios(): readonly RunScenarioDescriptor[] {
    return Object.values(RUN_SCENARIO_DESCRIPTORS);
  }

  /**
   * Get the descriptor for a scenario ID.
   */
  public static getDescriptor(scenario: RunScenarioId): RunScenarioDescriptor {
    return RUN_SCENARIO_DESCRIPTORS[scenario];
  }

  /**
   * Get all scenarios matching a mode.
   */
  public static getScenariosByMode(mode: ModeCode): readonly RunScenarioDescriptor[] {
    return Object.values(RUN_SCENARIO_DESCRIPTORS).filter(d => d.defaultMode === mode);
  }

  /**
   * Get scenarios above a difficulty rating.
   */
  public static getHardScenarios(minDifficulty: 1 | 2 | 3 | 4 | 5 = 4): readonly RunScenarioDescriptor[] {
    return Object.values(RUN_SCENARIO_DESCRIPTORS).filter(d => d.difficultyRating >= minDifficulty);
  }

  private static buildScenarioDefaults(
    scenario: RunScenarioId,
  ): Omit<RunFactoryInput, 'runId' | 'userId' | 'seed'> {
    switch (scenario) {
      case 'TUTORIAL':
        return {
          mode: 'solo',
          initialCash: 25_000,
          initialDebt: 0,
          initialHeat: 0,
          initialPressureScore: 0.05,
          freedomTarget: 150_000,
          seasonBudgetMs: 20 * 60 * 1_000,
          currentTickDurationMs: 5_000,
          disabledBots: ['BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05'],
          tags: ['scenario:tutorial', 'ux:beginner'],
        };
      case 'BLITZ':
        return {
          mode: 'pvp',
          initialCash: 12_000,
          initialHeat: 20,
          initialPressureScore: 0.55,
          seasonBudgetMs: 6 * 60 * 1_000,
          currentTickDurationMs: 2_000,
          battleBudget: 40,
          battleBudgetCap: 200,
          tags: ['scenario:blitz', 'ux:speed-run'],
        };
      case 'LEGEND_CHASE':
        return {
          mode: 'ghost',
          initialHeat: 30,
          initialPressureScore: 0.4,
          seasonBudgetMs: 10 * 60 * 1_000,
          tags: ['scenario:legend-chase', 'ux:competitive'],
        };
      case 'SABOTAGE_GAUNTLET':
        return {
          mode: 'solo',
          initialHeat: 15,
          initialPressureScore: 0.35,
          tags: ['scenario:sabotage-gauntlet', 'ux:hardcore'],
        };
      case 'DEBT_SPIRAL':
        return {
          mode: 'solo',
          initialCash: 5_000,
          initialDebt: 50_000,
          initialHeat: 40,
          initialPressureScore: 0.7,
          freedomTarget: 300_000,
          tags: ['scenario:debt-spiral', 'ux:comeback'],
        };
      case 'TRUST_COLLAPSE':
        return {
          mode: 'coop',
          initialHeat: 10,
          initialPressureScore: 0.45,
          sharedTreasuryBalance: 10_000,
          trustScores: { player_a: 20, player_b: 15, player_c: 10 },
          defectionStepByPlayer: { player_a: 2, player_b: 1 },
          tags: ['scenario:trust-collapse', 'ux:coop-tension'],
        };
      case 'BOT_SIEGE':
        return {
          mode: 'solo',
          initialHeat: 35,
          initialPressureScore: 0.6,
          tags: ['scenario:bot-siege', 'ux:survival'],
        };
      case 'ENDGAME_PUSH':
        return {
          mode: 'solo',
          initialPressureScore: 0.75,
          seasonBudgetMs: 3 * 60 * 1_000,
          currentTickDurationMs: 3_500,
          tags: ['scenario:endgame-push', 'ux:clutch'],
        };
      case 'UNDERDOG':
        return {
          mode: 'pvp',
          initialCash: 8_000,
          initialDebt: 5_000,
          initialHeat: 25,
          initialPressureScore: 0.5,
          freedomTarget: 275_000,
          battleBudget: 10,
          tags: ['scenario:underdog', 'ux:comeback'],
        };
      case 'HIGH_ROLLER':
        return {
          mode: 'solo',
          initialCash: 50_000,
          initialIncomePerTick: 2_500,
          initialHeat: 0,
          initialPressureScore: 0.1,
          freedomTarget: 500_000,
          seasonBudgetMs: 15 * 60 * 1_000,
          tags: ['scenario:high-roller', 'ux:power-fantasy'],
        };
      case 'PHANTOM_RUNNER':
        return {
          mode: 'ghost',
          initialCash: 12_000,
          initialHeat: 50,
          initialPressureScore: 0.8,
          seasonBudgetMs: 8 * 60 * 1_000,
          currentTickDurationMs: 3_000,
          tags: ['scenario:phantom-runner', 'ux:extreme'],
        };
      case 'SYNDICATE_SURGE':
        return {
          mode: 'coop',
          initialCash: 20_000,
          initialIncomePerTick: 1_800,
          sharedTreasuryBalance: 60_000,
          initialHeat: 0,
          initialPressureScore: 0.1,
          tags: ['scenario:syndicate-surge', 'ux:coop-power'],
        };
    }
  }
}

// ============================================================================
// § 4 — RunStatePatchSystem — safe incremental state evolution
// ============================================================================

/**
 * Recursively strips readonly modifiers so the patch system can mutate
 * a deep-cloned snapshot without TypeScript complaints.
 */
type DeepWriteable<T> = {
  -readonly [K in keyof T]: T[K] extends ReadonlyArray<infer U>
    ? DeepWriteable<U>[]
    : T[K] extends object
    ? DeepWriteable<T[K]>
    : T[K];
};

/**
 * Typed partial patch over specific economy sub-fields.
 */
export interface EconomyPatch {
  readonly cash?: number;
  readonly debt?: number;
  readonly incomePerTick?: number;
  readonly expensesPerTick?: number;
  readonly freedomTarget?: number;
  readonly haterHeat?: number;
  readonly opportunitiesPurchased?: number;
  readonly privilegePlays?: number;
}

/**
 * Typed partial patch over specific pressure sub-fields.
 */
export interface PressurePatch {
  readonly score?: number;
  readonly upwardCrossings?: number;
  readonly survivedHighPressureTicks?: number;
}

/**
 * Typed partial patch over specific mode-state sub-fields.
 */
export interface ModeStatePatch {
  readonly sharedTreasuryBalance?: number;
  readonly bleedMode?: boolean;
  readonly phaseBoundaryWindowsRemaining?: number;
  readonly counterIntelTier?: number;
  readonly spectatorLimit?: number;
  readonly extractionActionsRemaining?: number;
  readonly trustScores?: Readonly<Record<string, number>>;
  readonly defectionStepByPlayer?: Readonly<Record<string, number>>;
}

/**
 * Typed partial patch over specific timer sub-fields.
 */
export interface TimersPatch {
  readonly seasonBudgetMs?: number;
  readonly extensionBudgetMs?: number;
  readonly elapsedMs?: number;
  readonly currentTickDurationMs?: number;
  readonly holdCharges?: number;
}

/**
 * A structured diff patch that can be applied to an existing snapshot.
 * All changes are validated before application.
 */
export interface RunStatePatch {
  readonly tick?: number;
  readonly phase?: RunStateSnapshot['phase'];
  readonly economy?: EconomyPatch;
  readonly pressure?: PressurePatch;
  readonly modeState?: ModeStatePatch;
  readonly timers?: TimersPatch;
  readonly tags?: readonly string[];
  readonly reason?: string;
  readonly patchId?: string;
}

export interface RunStatePatchResult {
  readonly snapshot: RunStateSnapshot;
  readonly patchId: string;
  readonly appliedAt: number;
  readonly changeCount: number;
  readonly reason: string;
}

export interface RunStatePatchHistoryEntry {
  readonly patchId: string;
  readonly appliedAtMs: number;
  readonly reason: string;
  readonly changeCount: number;
  readonly snapshotRunId: string;
  readonly snapshotTick: number;
}

/**
 * Applies typed patches to immutable RunStateSnapshot objects.
 * Tracks patch history and validates each patch before application.
 *
 * Designed for:
 * - Test harnesses that need to evolve state
 * - Admin tools that apply corrections
 * - Replay systems that reconstruct state from event logs
 * - ML training data generation with controlled mutations
 */
export class RunStatePatchSystem {
  private readonly _history: RunStatePatchHistoryEntry[] = [];
  private readonly _maxHistory: number;
  private _patchCounter = 0;

  public constructor(maxHistory = 512) {
    this._maxHistory = Math.max(1, maxHistory);
  }

  /**
   * Apply a patch to a snapshot and return the new snapshot.
   * The original snapshot is never mutated — a new frozen clone is returned.
   */
  public applyPatch(
    snapshot: RunStateSnapshot,
    patch: RunStatePatch,
  ): RunStatePatchResult {
    this._patchCounter++;
    const patchId = patch.patchId ?? `patch-${this._patchCounter}-${Date.now()}`;
    let changeCount = 0;

    // Build a mutable copy
    const s = this.deepMutableCopy(snapshot);

    if (patch.tick !== undefined && Number.isFinite(patch.tick)) {
      s.tick = Math.max(0, Math.trunc(patch.tick));
      changeCount++;
    }

    if (patch.phase !== undefined) {
      s.phase = patch.phase;
      changeCount++;
    }

    if (patch.economy) {
      const e = patch.economy;
      if (e.cash !== undefined && Number.isFinite(e.cash)) {
        s.economy.cash = toMoney(e.cash);
        changeCount++;
      }
      if (e.debt !== undefined && Number.isFinite(e.debt)) {
        s.economy.debt = toMoney(Math.max(0, e.debt));
        changeCount++;
      }
      if (e.incomePerTick !== undefined && Number.isFinite(e.incomePerTick)) {
        s.economy.incomePerTick = toMoney(Math.max(0, e.incomePerTick));
        changeCount++;
      }
      if (e.expensesPerTick !== undefined && Number.isFinite(e.expensesPerTick)) {
        s.economy.expensesPerTick = toMoney(Math.max(0, e.expensesPerTick));
        changeCount++;
      }
      if (e.freedomTarget !== undefined && Number.isFinite(e.freedomTarget) && e.freedomTarget > 0) {
        s.economy.freedomTarget = toMoney(e.freedomTarget);
        changeCount++;
      }
      if (e.haterHeat !== undefined && Number.isFinite(e.haterHeat)) {
        s.economy.haterHeat = clamp(e.haterHeat, 0, 100);
        changeCount++;
      }
      if (e.opportunitiesPurchased !== undefined) {
        s.economy.opportunitiesPurchased = Math.max(0, Math.trunc(e.opportunitiesPurchased));
        changeCount++;
      }
      if (e.privilegePlays !== undefined) {
        s.economy.privilegePlays = Math.max(0, Math.trunc(e.privilegePlays));
        changeCount++;
      }
      s.economy.netWorth = toMoney(s.economy.cash - s.economy.debt);
    }

    if (patch.pressure) {
      const p = patch.pressure;
      if (p.score !== undefined && Number.isFinite(p.score)) {
        const score = clamp(p.score, 0, 1);
        const band = derivePressureBand(score);
        const tier = PRESSURE_BAND_TO_TIER[band];
        s.pressure.previousTier = s.pressure.tier;
        s.pressure.previousBand = s.pressure.band;
        s.pressure.score = score;
        s.pressure.band = band;
        s.pressure.tier = tier;
        s.pressure.maxScoreSeen = Math.max(s.pressure.maxScoreSeen, score);
        changeCount++;
      }
      if (p.upwardCrossings !== undefined) {
        s.pressure.upwardCrossings = Math.max(0, Math.trunc(p.upwardCrossings));
        changeCount++;
      }
      if (p.survivedHighPressureTicks !== undefined) {
        s.pressure.survivedHighPressureTicks = Math.max(0, Math.trunc(p.survivedHighPressureTicks));
        changeCount++;
      }
    }

    if (patch.modeState) {
      const m = patch.modeState;
      if (m.sharedTreasuryBalance !== undefined && Number.isFinite(m.sharedTreasuryBalance)) {
        s.modeState.sharedTreasuryBalance = toMoney(Math.max(0, m.sharedTreasuryBalance));
        changeCount++;
      }
      if (m.bleedMode !== undefined) {
        s.modeState.bleedMode = m.bleedMode;
        changeCount++;
      }
      if (m.phaseBoundaryWindowsRemaining !== undefined) {
        s.modeState.phaseBoundaryWindowsRemaining = Math.max(0, Math.trunc(m.phaseBoundaryWindowsRemaining));
        changeCount++;
      }
      if (m.counterIntelTier !== undefined) {
        s.modeState.counterIntelTier = clamp(Math.trunc(m.counterIntelTier), 1, 5);
        changeCount++;
      }
      if (m.spectatorLimit !== undefined) {
        s.modeState.spectatorLimit = Math.max(0, Math.trunc(m.spectatorLimit));
        changeCount++;
      }
      if (m.extractionActionsRemaining !== undefined) {
        s.modeState.extractionActionsRemaining = Math.max(0, Math.trunc(m.extractionActionsRemaining));
        changeCount++;
      }
      if (m.trustScores) {
        s.modeState.trustScores = {
          ...s.modeState.trustScores,
          ...normalizeNumberRecord(m.trustScores, 0, 100),
        };
        changeCount++;
      }
      if (m.defectionStepByPlayer) {
        s.modeState.defectionStepByPlayer = {
          ...s.modeState.defectionStepByPlayer,
          ...normalizeIntegerRecord(m.defectionStepByPlayer, 0),
        };
        changeCount++;
      }
    }

    if (patch.timers) {
      const t = patch.timers;
      if (t.seasonBudgetMs !== undefined && Number.isFinite(t.seasonBudgetMs) && t.seasonBudgetMs >= 1_000) {
        s.timers.seasonBudgetMs = Math.trunc(t.seasonBudgetMs);
        changeCount++;
      }
      if (t.extensionBudgetMs !== undefined && Number.isFinite(t.extensionBudgetMs)) {
        s.timers.extensionBudgetMs = Math.max(0, Math.trunc(t.extensionBudgetMs));
        changeCount++;
      }
      if (t.elapsedMs !== undefined && Number.isFinite(t.elapsedMs)) {
        s.timers.elapsedMs = Math.max(0, Math.trunc(t.elapsedMs));
        changeCount++;
      }
      if (t.currentTickDurationMs !== undefined && Number.isFinite(t.currentTickDurationMs) && t.currentTickDurationMs >= 50) {
        s.timers.currentTickDurationMs = Math.trunc(t.currentTickDurationMs);
        changeCount++;
      }
      if (t.holdCharges !== undefined) {
        s.timers.holdCharges = Math.max(0, Math.trunc(t.holdCharges));
        changeCount++;
      }
    }

    if (patch.tags) {
      const existingSet = new Set<string>(s.tags);
      for (const tag of patch.tags) {
        const normalized = String(tag).trim();
        if (normalized.length > 0) existingSet.add(normalized);
      }
      s.tags = Array.from(existingSet);
      changeCount++;
    }

    const result = deepFrozenClone(s as RunStateSnapshot);
    const reason = patch.reason ?? 'manual patch';

    const historyEntry: RunStatePatchHistoryEntry = Object.freeze({
      patchId,
      appliedAtMs: Date.now(),
      reason,
      changeCount,
      snapshotRunId: snapshot.runId,
      snapshotTick: s.tick,
    });

    this._history.push(historyEntry);
    while (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    return Object.freeze({
      snapshot: result,
      patchId,
      appliedAt: historyEntry.appliedAtMs,
      changeCount,
      reason,
    });
  }

  /**
   * Apply a sequence of patches in order.
   */
  public applyPatches(
    snapshot: RunStateSnapshot,
    patches: readonly RunStatePatch[],
  ): RunStatePatchResult {
    let current = snapshot;
    let totalChanges = 0;
    let lastResult: RunStatePatchResult | null = null;

    for (const patch of patches) {
      lastResult = this.applyPatch(current, patch);
      current = lastResult.snapshot;
      totalChanges += lastResult.changeCount;
    }

    if (lastResult === null) {
      return Object.freeze({
        snapshot,
        patchId: 'noop',
        appliedAt: Date.now(),
        changeCount: 0,
        reason: 'no patches',
      });
    }

    return Object.freeze({ ...lastResult, changeCount: totalChanges });
  }

  public get history(): readonly RunStatePatchHistoryEntry[] {
    return this._history;
  }

  public get patchCount(): number {
    return this._patchCounter;
  }

  public clearHistory(): void {
    this._history.length = 0;
  }

  private deepMutableCopy(snapshot: RunStateSnapshot): DeepWriteable<RunStateSnapshot> {
    return JSON.parse(JSON.stringify(snapshot)) as DeepWriteable<RunStateSnapshot>;
  }
}

// ============================================================================
// § 5 — RunStateDiffEngine — structural diffs between snapshots
// ============================================================================

export interface RunStateDiffField {
  readonly path: string;
  readonly previousValue: unknown;
  readonly currentValue: unknown;
  readonly delta: number | null;
}

export interface RunStateDiff {
  readonly runId: string;
  readonly fromTick: number;
  readonly toTick: number;
  readonly fields: readonly RunStateDiffField[];
  readonly fieldCount: number;
  readonly economyDelta: number;
  readonly pressureDelta: number;
  readonly shieldDelta: number;
  readonly tickDelta: number;
  readonly phaseChanged: boolean;
  readonly modeChanged: boolean;
  readonly outcomeChanged: boolean;
}

/**
 * Computes a structured diff between two RunStateSnapshot instances.
 * Used by replay systems, observability pipelines, and ML training
 * to detect significant state transitions.
 */
export class RunStateDiffEngine {
  /**
   * Compute a structural diff between two snapshots.
   * Only leaf-level scalar fields are tracked for delta.
   */
  public static diff(
    previous: RunStateSnapshot,
    current: RunStateSnapshot,
  ): RunStateDiff {
    const fields: RunStateDiffField[] = [];

    // Economy fields
    RunStateDiffEngine.diffNumeric(fields, 'economy.cash', previous.economy.cash, current.economy.cash);
    RunStateDiffEngine.diffNumeric(fields, 'economy.debt', previous.economy.debt, current.economy.debt);
    RunStateDiffEngine.diffNumeric(fields, 'economy.netWorth', previous.economy.netWorth, current.economy.netWorth);
    RunStateDiffEngine.diffNumeric(fields, 'economy.incomePerTick', previous.economy.incomePerTick, current.economy.incomePerTick);
    RunStateDiffEngine.diffNumeric(fields, 'economy.expensesPerTick', previous.economy.expensesPerTick, current.economy.expensesPerTick);
    RunStateDiffEngine.diffNumeric(fields, 'economy.haterHeat', previous.economy.haterHeat, current.economy.haterHeat);
    RunStateDiffEngine.diffNumeric(fields, 'economy.freedomTarget', previous.economy.freedomTarget, current.economy.freedomTarget);
    RunStateDiffEngine.diffNumeric(fields, 'economy.opportunitiesPurchased', previous.economy.opportunitiesPurchased, current.economy.opportunitiesPurchased);
    RunStateDiffEngine.diffNumeric(fields, 'economy.privilegePlays', previous.economy.privilegePlays, current.economy.privilegePlays);

    // Pressure fields
    RunStateDiffEngine.diffNumeric(fields, 'pressure.score', previous.pressure.score, current.pressure.score);
    RunStateDiffEngine.diffScalar(fields, 'pressure.tier', previous.pressure.tier, current.pressure.tier);
    RunStateDiffEngine.diffScalar(fields, 'pressure.band', previous.pressure.band, current.pressure.band);
    RunStateDiffEngine.diffNumeric(fields, 'pressure.upwardCrossings', previous.pressure.upwardCrossings, current.pressure.upwardCrossings);
    RunStateDiffEngine.diffNumeric(fields, 'pressure.survivedHighPressureTicks', previous.pressure.survivedHighPressureTicks, current.pressure.survivedHighPressureTicks);

    // Shield fields
    RunStateDiffEngine.diffNumeric(fields, 'shield.weakestLayerRatio', previous.shield.weakestLayerRatio, current.shield.weakestLayerRatio);
    RunStateDiffEngine.diffNumeric(fields, 'shield.blockedThisRun', previous.shield.blockedThisRun, current.shield.blockedThisRun);
    RunStateDiffEngine.diffNumeric(fields, 'shield.damagedThisRun', previous.shield.damagedThisRun, current.shield.damagedThisRun);
    RunStateDiffEngine.diffNumeric(fields, 'shield.breachesThisRun', previous.shield.breachesThisRun, current.shield.breachesThisRun);

    // Sovereignty fields
    RunStateDiffEngine.diffNumeric(fields, 'sovereignty.cordScore', previous.sovereignty.cordScore, current.sovereignty.cordScore);
    RunStateDiffEngine.diffNumeric(fields, 'sovereignty.sovereigntyScore', previous.sovereignty.sovereigntyScore, current.sovereignty.sovereigntyScore);
    RunStateDiffEngine.diffNumeric(fields, 'sovereignty.gapVsLegend', previous.sovereignty.gapVsLegend, current.sovereignty.gapVsLegend);
    RunStateDiffEngine.diffNumeric(fields, 'sovereignty.gapClosingRate', previous.sovereignty.gapClosingRate, current.sovereignty.gapClosingRate);
    RunStateDiffEngine.diffScalar(fields, 'sovereignty.integrityStatus', previous.sovereignty.integrityStatus, current.sovereignty.integrityStatus);
    RunStateDiffEngine.diffScalar(fields, 'sovereignty.verifiedGrade', previous.sovereignty.verifiedGrade, current.sovereignty.verifiedGrade);

    // Battle fields
    RunStateDiffEngine.diffNumeric(fields, 'battle.battleBudget', previous.battle.battleBudget, current.battle.battleBudget);
    RunStateDiffEngine.diffScalar(fields, 'battle.firstBloodClaimed', previous.battle.firstBloodClaimed, current.battle.firstBloodClaimed);

    // Cascade fields
    RunStateDiffEngine.diffNumeric(fields, 'cascade.brokenChains', previous.cascade.brokenChains, current.cascade.brokenChains);
    RunStateDiffEngine.diffNumeric(fields, 'cascade.completedChains', previous.cascade.completedChains, current.cascade.completedChains);

    // Timers fields
    RunStateDiffEngine.diffNumeric(fields, 'timers.elapsedMs', previous.timers.elapsedMs, current.timers.elapsedMs);
    RunStateDiffEngine.diffNumeric(fields, 'timers.holdCharges', previous.timers.holdCharges, current.timers.holdCharges);

    // Mode state
    RunStateDiffEngine.diffNumeric(fields, 'modeState.sharedTreasuryBalance', previous.modeState.sharedTreasuryBalance, current.modeState.sharedTreasuryBalance);
    RunStateDiffEngine.diffScalar(fields, 'modeState.bleedMode', previous.modeState.bleedMode, current.modeState.bleedMode);
    RunStateDiffEngine.diffNumeric(fields, 'modeState.phaseBoundaryWindowsRemaining', previous.modeState.phaseBoundaryWindowsRemaining, current.modeState.phaseBoundaryWindowsRemaining);

    // Top-level scalar
    RunStateDiffEngine.diffScalar(fields, 'phase', previous.phase, current.phase);
    RunStateDiffEngine.diffScalar(fields, 'mode', previous.mode, current.mode);
    RunStateDiffEngine.diffScalar(fields, 'outcome', previous.outcome, current.outcome);

    const economyDelta = current.economy.netWorth - previous.economy.netWorth;
    const pressureDelta = current.pressure.score - previous.pressure.score;
    const shieldDelta = current.shield.weakestLayerRatio - previous.shield.weakestLayerRatio;

    return Object.freeze({
      runId: current.runId,
      fromTick: previous.tick,
      toTick: current.tick,
      fields: Object.freeze(fields),
      fieldCount: fields.length,
      economyDelta,
      pressureDelta,
      shieldDelta,
      tickDelta: current.tick - previous.tick,
      phaseChanged: previous.phase !== current.phase,
      modeChanged: previous.mode !== current.mode,
      outcomeChanged: previous.outcome !== current.outcome,
    });
  }

  /**
   * Summarize a diff into human-readable lines for chat/observability.
   */
  public static summarizeDiff(diff: RunStateDiff): readonly string[] {
    const lines: string[] = [];

    if (diff.phaseChanged) {
      const phase = diff.fields.find(f => f.path === 'phase');
      lines.push(`Phase transition: ${phase?.previousValue} → ${phase?.currentValue}`);
    }
    if (diff.outcomeChanged) {
      const outcome = diff.fields.find(f => f.path === 'outcome');
      lines.push(`Outcome changed: ${outcome?.previousValue ?? 'null'} → ${outcome?.currentValue ?? 'null'}`);
    }
    if (Math.abs(diff.economyDelta) > 100) {
      lines.push(`Net worth ${diff.economyDelta > 0 ? '+' : ''}${diff.economyDelta.toFixed(2)}`);
    }
    if (Math.abs(diff.pressureDelta) > 0.05) {
      lines.push(`Pressure ${diff.pressureDelta > 0 ? '↑' : '↓'} ${Math.abs(diff.pressureDelta * 100).toFixed(1)}%`);
    }
    if (diff.shieldDelta < -0.05) {
      lines.push(`Shield integrity fell ${(Math.abs(diff.shieldDelta) * 100).toFixed(1)}%`);
    }

    const statusChange = diff.fields.find(f => f.path === 'sovereignty.integrityStatus');
    if (statusChange && statusChange.previousValue !== statusChange.currentValue) {
      lines.push(`Integrity: ${statusChange.previousValue} → ${statusChange.currentValue}`);
    }

    if (lines.length === 0) {
      lines.push(`Tick ${diff.fromTick} → ${diff.toTick}: ${diff.fieldCount} field changes`);
    }

    return Object.freeze(lines);
  }

  private static diffNumeric(
    fields: RunStateDiffField[],
    path: string,
    prev: number,
    curr: number,
  ): void {
    if (prev !== curr) {
      fields.push(Object.freeze({ path, previousValue: prev, currentValue: curr, delta: curr - prev }));
    }
  }

  private static diffScalar(
    fields: RunStateDiffField[],
    path: string,
    prev: unknown,
    curr: unknown,
  ): void {
    if (prev !== curr) {
      fields.push(Object.freeze({ path, previousValue: prev, currentValue: curr, delta: null }));
    }
  }
}

// ============================================================================
// § 6 — RunStateMLFeatureExtractor — 44-feature ML/DL input vectors
// ============================================================================

export const RUN_STATE_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  // Mode (one-hot 4)
  'mode_solo', 'mode_pvp', 'mode_coop', 'mode_ghost',
  // Phase (one-hot 3)
  'phase_foundation', 'phase_escalation', 'phase_sovereignty',
  // Pressure tier (one-hot 5)
  'pressure_t0', 'pressure_t1', 'pressure_t2', 'pressure_t3', 'pressure_t4',
  // Economy (normalized)
  'economy_cash_norm',
  'economy_debt_norm',
  'economy_net_worth_norm',
  'economy_income_norm',
  'economy_expenses_norm',
  'economy_freedom_progress',
  'economy_heat_norm',
  // Shield
  'shield_weakest_ratio',
  'shield_blocked_norm',
  'shield_breaches_norm',
  // Pressure
  'pressure_score',
  'pressure_upward_crossings_norm',
  'pressure_survived_high_norm',
  // Cascade
  'cascade_active_norm',
  'cascade_broken_norm',
  'cascade_completed_norm',
  // Battle
  'battle_budget_norm',
  'battle_first_blood',
  // Sovereignty
  'sovereignty_cord_score',
  'sovereignty_gap_vs_legend',
  'sovereignty_gap_closing_rate',
  // Cards
  'cards_hand_size_norm',
  'cards_discard_norm',
  'cards_draw_pile_norm',
  'cards_deck_entropy',
  // Mode state
  'mode_bleed_mode',
  'mode_treasury_norm',
  'mode_hold_enabled',
  // Timers
  'timers_elapsed_ratio',
  'timers_hold_charges_norm',
  // Tension
  'tension_score',
  'tension_anticipation',
]);

export const RUN_STATE_ML_FEATURE_COUNT: number = RUN_STATE_ML_FEATURE_LABELS.length;

export interface RunStateMLVector {
  readonly runId: string;
  readonly tick: number;
  readonly mode: ModeCode;
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly featureCount: number;
  readonly extractedAtMs: number;
}

/**
 * Extracts a 44-feature ML vector from a RunStateSnapshot.
 * Suitable for model inference, feature importance analysis,
 * and cross-run comparison.
 */
export class RunStateMLFeatureExtractor {
  private static readonly MODE_ORDER: ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];
  private static readonly PHASE_ORDER: RunStateSnapshot['phase'][] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
  private static readonly TIER_ORDER: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];

  private static readonly MAX_CASH = 1_000_000;
  private static readonly MAX_HEAT = 100;
  private static readonly MAX_CROSSINGS = 50;
  private static readonly MAX_SURVIVED = 200;
  private static readonly MAX_CASCADE = 20;
  private static readonly MAX_BATTLE_BUDGET = 500;
  private static readonly MAX_HAND = 8;
  private static readonly MAX_DISCARD = 40;
  private static readonly MAX_DRAW = 60;
  private static readonly MAX_TREASURY = 100_000;

  /**
   * Extract a full ML feature vector from a snapshot.
   */
  public extract(snapshot: RunStateSnapshot): RunStateMLVector {
    const features = RunStateMLFeatureExtractor.buildVector(snapshot);
    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      mode: snapshot.mode,
      features: Object.freeze(features),
      labels: RUN_STATE_ML_FEATURE_LABELS,
      featureCount: features.length,
      extractedAtMs: Date.now(),
    });
  }

  /**
   * Extract features from a factory input (pre-creation estimation).
   * Used by ML models to pre-screen inputs before state creation.
   */
  public extractFromInput(input: RunFactoryInput): RunStateMLVector {
    let mode: ModeCode;
    try {
      mode = normalizeMode(input.mode);
    } catch {
      mode = 'solo';
    }
    const defaults = MODE_DEFAULTS[mode];
    const pressureScore = clamp(input.initialPressureScore ?? 0.15, 0, 1);
    const cash = input.initialCash ?? defaults.cash;
    const debt = input.initialDebt ?? 0;
    const netWorth = cash - debt;
    const freedomTarget = input.freedomTarget ?? defaults.freedomTarget;
    const heat = input.initialHeat ?? defaults.initialHeat;
    const incomePerTick = input.initialIncomePerTick ?? defaults.incomePerTick;
    const expensesPerTick = input.initialExpensesPerTick ?? defaults.expensesPerTick;

    const pressureBand = derivePressureBand(pressureScore);
    const pressureTier = PRESSURE_BAND_TO_TIER[pressureBand];

    // Mode one-hot
    const modeOH = RunStateMLFeatureExtractor.oneHot(
      RunStateMLFeatureExtractor.MODE_ORDER.indexOf(mode),
      4,
    );
    // Phase one-hot (always FOUNDATION at creation)
    const phaseOH = RunStateMLFeatureExtractor.oneHot(0, 3);
    // Pressure tier one-hot
    const tierOH = RunStateMLFeatureExtractor.oneHot(
      RunStateMLFeatureExtractor.TIER_ORDER.indexOf(pressureTier),
      5,
    );

    const features: number[] = [
      ...modeOH,
      ...phaseOH,
      ...tierOH,
      clamp(cash / RunStateMLFeatureExtractor.MAX_CASH, 0, 1),
      clamp(debt / RunStateMLFeatureExtractor.MAX_CASH, 0, 1),
      clamp(netWorth / RunStateMLFeatureExtractor.MAX_CASH, 0, 1),
      clamp(incomePerTick / 5000, 0, 1),
      clamp(expensesPerTick / 5000, 0, 1),
      clamp(netWorth / Math.max(1, freedomTarget), 0, 1),
      clamp(heat / RunStateMLFeatureExtractor.MAX_HEAT, 0, 1),
      1.0, 0, 0, // shield (full at creation)
      pressureScore,
      0, 0,
      0, 0, 0, // cascade
      clamp((input.battleBudget ?? defaults.battleBudget) / RunStateMLFeatureExtractor.MAX_BATTLE_BUDGET, 0, 1),
      0, // first blood
      0, 0, 0, // sovereignty
      0, 0, clamp(0, 0, 1), 0, // cards
      0, // bleed mode
      clamp((input.sharedTreasuryBalance ?? defaults.sharedTreasuryBalance) / RunStateMLFeatureExtractor.MAX_TREASURY, 0, 1),
      defaults.holdEnabled ? 1 : 0,
      0, // elapsed ratio
      clamp((input.holdCharges ?? defaults.holdCharges) / 10, 0, 1),
      0, 0, // tension
    ];

    return Object.freeze({
      runId: 'factory-pre-creation',
      tick: -1,
      mode,
      features: Object.freeze(features),
      labels: RUN_STATE_ML_FEATURE_LABELS,
      featureCount: features.length,
      extractedAtMs: Date.now(),
    });
  }

  public static buildVector(snapshot: RunStateSnapshot): number[] {
    const e = snapshot.economy;
    const p = snapshot.pressure;
    const sh = snapshot.shield;
    const ca = snapshot.cascade;
    const ba = snapshot.battle;
    const so = snapshot.sovereignty;
    const cards = snapshot.cards;
    const ms = snapshot.modeState;
    const ti = snapshot.timers;
    const te = snapshot.tension;

    const modeIdx = RunStateMLFeatureExtractor.MODE_ORDER.indexOf(snapshot.mode);
    const phaseIdx = RunStateMLFeatureExtractor.PHASE_ORDER.indexOf(snapshot.phase);
    const tierIdx = RunStateMLFeatureExtractor.TIER_ORDER.indexOf(p.tier);

    const totalBudget = ti.seasonBudgetMs + ti.extensionBudgetMs;
    const elapsedRatio = totalBudget > 0 ? clamp(ti.elapsedMs / totalBudget, 0, 1) : 0;

    return [
      // Mode one-hot (4)
      ...RunStateMLFeatureExtractor.oneHot(modeIdx, 4),
      // Phase one-hot (3)
      ...RunStateMLFeatureExtractor.oneHot(phaseIdx, 3),
      // Pressure tier one-hot (5)
      ...RunStateMLFeatureExtractor.oneHot(tierIdx, 5),
      // Economy (7)
      clamp(e.cash / RunStateMLFeatureExtractor.MAX_CASH, 0, 1),
      clamp(e.debt / RunStateMLFeatureExtractor.MAX_CASH, 0, 1),
      clamp(e.netWorth / RunStateMLFeatureExtractor.MAX_CASH, 0, 1),
      clamp(e.incomePerTick / 5000, 0, 1),
      clamp(e.expensesPerTick / 5000, 0, 1),
      clamp(e.netWorth / Math.max(1, e.freedomTarget), 0, 1),
      clamp(e.haterHeat / RunStateMLFeatureExtractor.MAX_HEAT, 0, 1),
      // Shield (3)
      sh.weakestLayerRatio,
      clamp(sh.blockedThisRun / 50, 0, 1),
      clamp(sh.breachesThisRun / 20, 0, 1),
      // Pressure (3)
      p.score,
      clamp(p.upwardCrossings / RunStateMLFeatureExtractor.MAX_CROSSINGS, 0, 1),
      clamp(p.survivedHighPressureTicks / RunStateMLFeatureExtractor.MAX_SURVIVED, 0, 1),
      // Cascade (3)
      clamp(ca.activeChains.length / RunStateMLFeatureExtractor.MAX_CASCADE, 0, 1),
      clamp(ca.brokenChains / 20, 0, 1),
      clamp(ca.completedChains / 20, 0, 1),
      // Battle (2)
      clamp(ba.battleBudget / RunStateMLFeatureExtractor.MAX_BATTLE_BUDGET, 0, 1),
      ba.firstBloodClaimed ? 1 : 0,
      // Sovereignty (3)
      clamp(so.cordScore, 0, 1),
      clamp(so.gapVsLegend, 0, 1),
      clamp(so.gapClosingRate + 0.5, 0, 1),
      // Cards (4)
      clamp(cards.hand.length / RunStateMLFeatureExtractor.MAX_HAND, 0, 1),
      clamp(cards.discard.length / RunStateMLFeatureExtractor.MAX_DISCARD, 0, 1),
      clamp(cards.drawPileSize / RunStateMLFeatureExtractor.MAX_DRAW, 0, 1),
      clamp(cards.deckEntropy, 0, 1),
      // Mode state (3)
      ms.bleedMode ? 1 : 0,
      clamp(ms.sharedTreasuryBalance / RunStateMLFeatureExtractor.MAX_TREASURY, 0, 1),
      ms.holdEnabled ? 1 : 0,
      // Timers (2)
      elapsedRatio,
      clamp(ti.holdCharges / 10, 0, 1),
      // Tension (2)
      clamp(te.score, 0, 1),
      clamp(te.anticipation, 0, 1),
    ];
  }

  private static oneHot(index: number, size: number): number[] {
    return Array.from({ length: size }, (_, i) => (i === index ? 1 : 0));
  }
}

// ============================================================================
// § 7 — RunStateDLInputBuilder — DL tensor construction
// ============================================================================

export interface RunStateDLTensor {
  readonly runId: string;
  readonly tick: number;
  readonly inputShape: readonly number[];
  readonly inputData: readonly number[];
  readonly outputShape: readonly number[];
  readonly modelKey: string;
  readonly featureCount: number;
  readonly scenarioHint: string | null;
  readonly generatedAtMs: number;
}

/**
 * Builds DL input tensors from RunStateSnapshot instances.
 * Produces both:
 * 1. A flat feature vector (same as ML vector) for dense models
 * 2. A structured 2D input tensor with sub-group rows for attention models
 */
export class RunStateDLInputBuilder {
  /**
   * Build a flat DL input tensor from a snapshot.
   * Shape: [1, RUN_STATE_ML_FEATURE_COUNT]
   */
  public buildFlat(snapshot: RunStateSnapshot): RunStateDLTensor {
    const features = RunStateMLFeatureExtractor.buildVector(snapshot);
    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      inputShape: Object.freeze([1, features.length]),
      inputData: Object.freeze(features),
      outputShape: Object.freeze([1, 8]),
      modelKey: 'run-state-flat-v1',
      featureCount: features.length,
      scenarioHint: null,
      generatedAtMs: Date.now(),
    });
  }

  /**
   * Build a grouped 2D tensor with sub-group rows for attention/transformer models.
   * Groups:
   *   Row 0: mode + phase + tier (12 features, padded to 16)
   *   Row 1: economy sub-vector (7 features, padded to 16)
   *   Row 2: shield + pressure (6 features, padded to 16)
   *   Row 3: cascade + battle + sovereignty (8 features, padded to 16)
   *   Row 4: cards + mode-state + timers + tension (9 features, padded to 16)
   */
  public buildGrouped(snapshot: RunStateSnapshot): RunStateDLTensor {
    const v = RunStateMLFeatureExtractor.buildVector(snapshot);

    // Slice into sub-groups based on label structure
    const group0 = RunStateDLInputBuilder.padToWidth(v.slice(0, 12), 16); // mode+phase+tier
    const group1 = RunStateDLInputBuilder.padToWidth(v.slice(12, 19), 16); // economy
    const group2 = RunStateDLInputBuilder.padToWidth(v.slice(19, 25), 16); // shield+pressure
    const group3 = RunStateDLInputBuilder.padToWidth(v.slice(25, 33), 16); // cascade+battle+sovereignty
    const group4 = RunStateDLInputBuilder.padToWidth(v.slice(33), 16); // cards+state+timers+tension

    const inputData = [...group0, ...group1, ...group2, ...group3, ...group4];

    return Object.freeze({
      runId: snapshot.runId,
      tick: snapshot.tick,
      inputShape: Object.freeze([5, 16]),
      inputData: Object.freeze(inputData),
      outputShape: Object.freeze([5, 4]),
      modelKey: 'run-state-grouped-v1',
      featureCount: inputData.length,
      scenarioHint: null,
      generatedAtMs: Date.now(),
    });
  }

  /**
   * Build a temporal tensor from a sequence of snapshots.
   * Shape: [timesteps, RUN_STATE_ML_FEATURE_COUNT]
   * Suitable for LSTM/GRU sequence models.
   */
  public buildTemporal(
    snapshots: readonly RunStateSnapshot[],
    modelKey = 'run-state-temporal-v1',
  ): RunStateDLTensor {
    if (snapshots.length === 0) {
      throw new Error('buildTemporal: at least one snapshot is required');
    }

    const rows = snapshots.map(s => RunStateMLFeatureExtractor.buildVector(s));
    const inputData = rows.flat();
    const featureWidth = rows[0].length;

    return Object.freeze({
      runId: snapshots[snapshots.length - 1].runId,
      tick: snapshots[snapshots.length - 1].tick,
      inputShape: Object.freeze([snapshots.length, featureWidth]),
      inputData: Object.freeze(inputData),
      outputShape: Object.freeze([1, 8]),
      modelKey,
      featureCount: inputData.length,
      scenarioHint: null,
      generatedAtMs: Date.now(),
    });
  }

  private static padToWidth(v: number[], width: number): number[] {
    const padded = v.slice(0, width);
    while (padded.length < width) padded.push(0);
    return padded;
  }
}

// ============================================================================
// § 8 — RunStateBatchFactory — multi-snapshot batch creation
// ============================================================================

export interface BatchFactoryResult {
  readonly snapshots: readonly RunStateSnapshot[];
  readonly errors: readonly { readonly index: number; readonly error: string }[];
  readonly successCount: number;
  readonly failureCount: number;
  readonly totalInputs: number;
  readonly createdAtMs: number;
}

export interface BatchMLResult {
  readonly vectors: readonly RunStateMLVector[];
  readonly tensors: readonly RunStateDLTensor[];
  readonly snapshotCount: number;
}

/**
 * Batch-creates multiple RunStateSnapshot instances from an array of inputs.
 * Provides structured error reporting per-input rather than failing the entire batch.
 * Used by:
 * - Test harnesses generating training data
 * - Tournament systems initializing many simultaneous runs
 * - ML pipelines generating synthetic run distributions
 */
export class RunStateBatchFactory {
  private readonly _validator: RunStateValidator;
  private readonly _mlExtractor: RunStateMLFeatureExtractor;
  private readonly _dlBuilder: RunStateDLInputBuilder;
  private _batchesProcessed = 0;
  private _totalCreated = 0;
  private _totalFailed = 0;

  public constructor() {
    this._validator = new RunStateValidator();
    this._mlExtractor = new RunStateMLFeatureExtractor();
    this._dlBuilder = new RunStateDLInputBuilder();
  }

  /**
   * Create multiple snapshots from a batch of inputs.
   * Failures are isolated — one bad input does not block others.
   */
  public createBatch(inputs: readonly RunFactoryInput[]): BatchFactoryResult {
    this._batchesProcessed++;
    const snapshots: RunStateSnapshot[] = [];
    const errors: Array<{ readonly index: number; readonly error: string }> = [];

    for (let i = 0; i < inputs.length; i++) {
      try {
        const snapshot = createInitialRunState(inputs[i]);
        snapshots.push(snapshot);
      } catch (e) {
        errors.push(Object.freeze({ index: i, error: String(e) }));
        this._totalFailed++;
      }
    }

    this._totalCreated += snapshots.length;

    return Object.freeze({
      snapshots: Object.freeze(snapshots),
      errors: Object.freeze(errors),
      successCount: snapshots.length,
      failureCount: errors.length,
      totalInputs: inputs.length,
      createdAtMs: Date.now(),
    });
  }

  /**
   * Create snapshots from scenario presets in batch.
   */
  public createScenarioBatch(
    scenarios: readonly RunScenarioId[],
    identityFn: (scenario: RunScenarioId, index: number) => Pick<RunFactoryInput, 'runId' | 'userId' | 'seed'>,
    overridesFn?: (scenario: RunScenarioId, index: number) => Partial<Omit<RunFactoryInput, 'runId' | 'userId' | 'seed'>>,
  ): BatchFactoryResult {
    const inputs = scenarios.map((scenario, i) => {
      const identity = identityFn(scenario, i);
      const overrides = overridesFn ? overridesFn(scenario, i) : {};
      return RunStateScenarioFactory.buildInput(scenario, identity, overrides);
    });
    return this.createBatch(inputs);
  }

  /**
   * Extract ML vectors from a batch of snapshots.
   */
  public extractMLBatch(snapshots: readonly RunStateSnapshot[]): BatchMLResult {
    const vectors = snapshots.map(s => this._mlExtractor.extract(s));
    const tensors = snapshots.map(s => this._dlBuilder.buildFlat(s));
    return Object.freeze({
      vectors: Object.freeze(vectors),
      tensors: Object.freeze(tensors),
      snapshotCount: snapshots.length,
    });
  }

  /**
   * Validate all inputs before batch creation.
   */
  public validateBatch(inputs: readonly RunFactoryInput[]): readonly RunFactoryValidationResult[] {
    return inputs.map(i => this._validator.validate(i));
  }

  public get batchesProcessed(): number { return this._batchesProcessed; }
  public get totalCreated(): number { return this._totalCreated; }
  public get totalFailed(): number { return this._totalFailed; }
  public get successRate(): number {
    const total = this._totalCreated + this._totalFailed;
    return total === 0 ? 1 : this._totalCreated / total;
  }
}

// ============================================================================
// § 9 — RunStateRollingStats — rolling analytics for factory usage
// ============================================================================

export interface RunStateFactoryTickStats {
  readonly createdAt: number;
  readonly mode: ModeCode;
  readonly scenario: RunScenarioId | null;
  readonly pressureScore: number;
  readonly initialCash: number;
  readonly freedomTarget: number;
  readonly hasLegendRunId: boolean;
  readonly disabledBotCount: number;
}

export const RUN_STATE_FACTORY_ROLLING_CAPACITY: number = 256;

/**
 * Rolling window analytics for factory creation patterns.
 * Feeds ML signals about which modes/scenarios are being created
 * most frequently and with what economic parameters.
 */
export class RunStateFactoryRollingStats {
  private readonly _capacity: number;
  private readonly _entries: RunStateFactoryTickStats[] = [];
  private _totalCreated = 0;
  private readonly _modeHistogram: Record<ModeCode, number> = { solo: 0, pvp: 0, coop: 0, ghost: 0 };
  private readonly _scenarioHistogram: Partial<Record<RunScenarioId, number>> = {};

  public constructor(capacity = RUN_STATE_FACTORY_ROLLING_CAPACITY) {
    this._capacity = Math.max(1, capacity);
  }

  public record(snapshot: RunStateSnapshot, scenario: RunScenarioId | null = null): void {
    this._totalCreated++;
    this._modeHistogram[snapshot.mode] = (this._modeHistogram[snapshot.mode] ?? 0) + 1;
    if (scenario) {
      this._scenarioHistogram[scenario] = (this._scenarioHistogram[scenario] ?? 0) + 1;
    }

    const entry: RunStateFactoryTickStats = Object.freeze({
      createdAt: Date.now(),
      mode: snapshot.mode,
      scenario,
      pressureScore: snapshot.pressure.score,
      initialCash: snapshot.economy.cash,
      freedomTarget: snapshot.economy.freedomTarget,
      hasLegendRunId: snapshot.modeState.ghostBaselineRunId !== null,
      disabledBotCount: snapshot.modeState.disabledBots.length,
    });

    this._entries.push(entry);
    while (this._entries.length > this._capacity) {
      this._entries.shift();
    }
  }

  public getModeDistribution(): Readonly<Record<ModeCode, number>> {
    return Object.freeze({ ...this._modeHistogram });
  }

  public getScenarioDistribution(): Readonly<Partial<Record<RunScenarioId, number>>> {
    return Object.freeze({ ...this._scenarioHistogram });
  }

  public getAveragePressureScore(): number {
    if (this._entries.length === 0) return 0;
    return this._entries.reduce((s, e) => s + e.pressureScore, 0) / this._entries.length;
  }

  public getAverageInitialCash(): number {
    if (this._entries.length === 0) return 0;
    return this._entries.reduce((s, e) => s + e.initialCash, 0) / this._entries.length;
  }

  public getMostCommonMode(): ModeCode {
    let maxCount = -1;
    let maxMode: ModeCode = 'solo';
    for (const [mode, count] of Object.entries(this._modeHistogram) as [ModeCode, number][]) {
      if (count > maxCount) {
        maxCount = count;
        maxMode = mode;
      }
    }
    return maxMode;
  }

  public getLegendRunRatio(): number {
    if (this._entries.length === 0) return 0;
    return this._entries.filter(e => e.hasLegendRunId).length / this._entries.length;
  }

  public get totalCreated(): number { return this._totalCreated; }
  public get entries(): readonly RunStateFactoryTickStats[] { return this._entries; }
  public get windowSize(): number { return this._entries.length; }
}

// ============================================================================
// § 10 — Health grader + module version constants
// ============================================================================

export type RunStateFactoryHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface RunStateFactoryHealthSummary {
  readonly grade: RunStateFactoryHealthGrade;
  readonly totalCreated: number;
  readonly batchSuccessRate: number;
  readonly mostCommonMode: ModeCode;
  readonly averagePressureScore: number;
  readonly averageInitialCash: number;
  readonly legendRunRatio: number;
  readonly rollingWindowSize: number;
}

/**
 * Grade the RunStateFactory health based on batch success rate and usage patterns.
 */
export function gradeRunStateFactoryHealth(
  batchSuccessRate: number,
  totalCreated: number,
): RunStateFactoryHealthGrade {
  if (totalCreated === 0) return 'A';
  if (batchSuccessRate >= 0.99) return 'S';
  if (batchSuccessRate >= 0.95) return 'A';
  if (batchSuccessRate >= 0.90) return 'B';
  if (batchSuccessRate >= 0.80) return 'C';
  if (batchSuccessRate >= 0.60) return 'D';
  return 'F';
}

/**
 * Build a health summary for the RunStateFactory subsystem.
 */
export function buildRunStateFactoryHealthSummary(
  batchFactory: RunStateBatchFactory,
  rollingStats: RunStateFactoryRollingStats,
): RunStateFactoryHealthSummary {
  const grade = gradeRunStateFactoryHealth(batchFactory.successRate, batchFactory.totalCreated);
  return Object.freeze({
    grade,
    totalCreated: batchFactory.totalCreated,
    batchSuccessRate: batchFactory.successRate,
    mostCommonMode: rollingStats.getMostCommonMode(),
    averagePressureScore: rollingStats.getAveragePressureScore(),
    averageInitialCash: rollingStats.getAverageInitialCash(),
    legendRunRatio: rollingStats.getLegendRunRatio(),
    rollingWindowSize: rollingStats.windowSize,
  });
}

export const RUN_STATE_FACTORY_MODULE_VERSION = '3.1.0' as const;
export const RUN_STATE_FACTORY_MODULE_READY = true as const;
export const RUN_STATE_FACTORY_COMPLETE = true as const;

// ============================================================================
// § 11 — RunStateFactoryFacade — wires all surfaces, the authoritative entry point
// ============================================================================

export interface RunStateFactoryFacadeOptions {
  readonly rollingCapacity?: number;
  readonly batchMaxHistory?: number;
  readonly validateBeforeCreate?: boolean;
}

/**
 * Facade that wires all RunStateFactory subsystems together.
 * The canonical entry point for the full factory surface.
 *
 * Usage:
 *   const facade = createRunStateFactoryFacade();
 *   const { snapshot, mlVector, dlTensor } = facade.create(input);
 *   const { snapshot: scenario } = facade.createScenario('BLITZ', identity);
 */
export class RunStateFactoryFacade {
  public readonly validator: RunStateValidator;
  public readonly scenarioFactory: typeof RunStateScenarioFactory;
  public readonly patchSystem: RunStatePatchSystem;
  public readonly diffEngine: typeof RunStateDiffEngine;
  public readonly mlExtractor: RunStateMLFeatureExtractor;
  public readonly dlBuilder: RunStateDLInputBuilder;
  public readonly batchFactory: RunStateBatchFactory;
  public readonly rollingStats: RunStateFactoryRollingStats;
  private readonly _validateBeforeCreate: boolean;

  public constructor(options: RunStateFactoryFacadeOptions = {}) {
    this.validator = new RunStateValidator();
    this.scenarioFactory = RunStateScenarioFactory;
    this.patchSystem = new RunStatePatchSystem(options.batchMaxHistory ?? 512);
    this.diffEngine = RunStateDiffEngine;
    this.mlExtractor = new RunStateMLFeatureExtractor();
    this.dlBuilder = new RunStateDLInputBuilder();
    this.batchFactory = new RunStateBatchFactory();
    this.rollingStats = new RunStateFactoryRollingStats(options.rollingCapacity ?? RUN_STATE_FACTORY_ROLLING_CAPACITY);
    this._validateBeforeCreate = options.validateBeforeCreate ?? false;
  }

  /**
   * Create a snapshot with full ML/DL enrichment.
   * Optionally validates input before creation.
   */
  public create(input: RunFactoryInput): {
    readonly snapshot: RunStateSnapshot;
    readonly mlVector: RunStateMLVector;
    readonly dlTensor: RunStateDLTensor;
    readonly validation: RunFactoryValidationResult | null;
  } {
    let validation: RunFactoryValidationResult | null = null;

    if (this._validateBeforeCreate) {
      validation = this.validator.validate(input);
      if (!validation.valid) {
        throw new Error(
          `RunStateFactoryFacade.create: validation failed — ${validation.errors
            .map(e => `[${e.field}] ${e.message}`)
            .join('; ')}`,
        );
      }
    }

    const snapshot = createInitialRunState(input);
    const mlVector = this.mlExtractor.extract(snapshot);
    const dlTensor = this.dlBuilder.buildFlat(snapshot);

    this.rollingStats.record(snapshot, null);

    return Object.freeze({ snapshot, mlVector, dlTensor, validation });
  }

  /**
   * Create from a named scenario with full ML/DL enrichment.
   */
  public createScenario(
    scenario: RunScenarioId,
    identity: Pick<RunFactoryInput, 'runId' | 'userId' | 'seed'>,
    overrides: Partial<Omit<RunFactoryInput, 'runId' | 'userId' | 'seed'>> = {},
  ): {
    readonly snapshot: RunStateSnapshot;
    readonly mlVector: RunStateMLVector;
    readonly dlTensor: RunStateDLTensor;
    readonly descriptor: RunScenarioDescriptor;
  } {
    const input = RunStateScenarioFactory.buildInput(scenario, identity, overrides);
    const snapshot = createInitialRunState(input);
    const mlVector = this.mlExtractor.extract(snapshot);
    const dlTensor = this.dlBuilder.buildFlat(snapshot);
    const descriptor = RunStateScenarioFactory.getDescriptor(scenario);

    this.rollingStats.record(snapshot, scenario);

    return Object.freeze({ snapshot, mlVector, dlTensor, descriptor });
  }

  /**
   * Apply a patch and return the evolved snapshot with ML enrichment.
   */
  public patch(
    snapshot: RunStateSnapshot,
    patch: RunStatePatch,
  ): {
    readonly result: RunStatePatchResult;
    readonly mlVector: RunStateMLVector;
    readonly dlTensor: RunStateDLTensor;
    readonly diff: RunStateDiff;
  } {
    const result = this.patchSystem.applyPatch(snapshot, patch);
    const mlVector = this.mlExtractor.extract(result.snapshot);
    const dlTensor = this.dlBuilder.buildFlat(result.snapshot);
    const diff = RunStateDiffEngine.diff(snapshot, result.snapshot);

    return Object.freeze({ result, mlVector, dlTensor, diff });
  }

  /**
   * Compute a diff between two snapshots.
   */
  public diff(previous: RunStateSnapshot, current: RunStateSnapshot): RunStateDiff {
    return RunStateDiffEngine.diff(previous, current);
  }

  /**
   * Validate a factory input.
   */
  public validate(input: RunFactoryInput): RunFactoryValidationResult {
    return this.validator.validate(input);
  }

  /**
   * Extract ML features from a factory input before creation.
   */
  public previewMLFeatures(input: RunFactoryInput): RunStateMLVector {
    return this.mlExtractor.extractFromInput(input);
  }

  /**
   * Build a temporal DL tensor from a sequence of snapshots.
   */
  public buildTemporalTensor(snapshots: readonly RunStateSnapshot[]): RunStateDLTensor {
    return this.dlBuilder.buildTemporal(snapshots);
  }

  /**
   * Get a health summary for the full factory subsystem.
   */
  public getHealthSummary(): RunStateFactoryHealthSummary {
    return buildRunStateFactoryHealthSummary(this.batchFactory, this.rollingStats);
  }

  /**
   * List all available scenario descriptors.
   */
  public listScenarios(): readonly RunScenarioDescriptor[] {
    return RunStateScenarioFactory.listScenarios();
  }
}

/**
 * Create a fully-wired RunStateFactoryFacade instance.
 */
export function createRunStateFactoryFacade(
  options: RunStateFactoryFacadeOptions = {},
): RunStateFactoryFacade {
  return new RunStateFactoryFacade(options);
}

// ============================================================================
// § 12 — Module-level constants for observability
// ============================================================================

export const RUN_STATE_ALL_BOT_IDS: readonly HaterBotId[] = ALL_BOTS;
export const RUN_STATE_ALL_MODES: readonly ModeCode[] = Object.freeze(['solo', 'pvp', 'coop', 'ghost']);
export const RUN_STATE_ALL_SCENARIO_IDS: readonly RunScenarioId[] = Object.freeze(
  Object.keys(RUN_SCENARIO_DESCRIPTORS) as RunScenarioId[],
);
export const RUN_STATE_LAYER_COUNT: number = LAYER_BLUEPRINTS.length;
export const RUN_STATE_BOT_COUNT: number = ALL_BOTS.length;
export const RUN_STATE_SCHEMA_VERSION = 'engine-run-state.v2' as const;

/**
 * Canonical mode label map: external alias → canonical code.
 * Exposed for chat adapters and observability pipelines.
 */
export const EXTERNAL_MODE_ALIAS_MAP: Readonly<Record<string, ModeCode>> = Object.freeze({
  solo: 'solo', empire: 'solo',
  pvp: 'pvp', predator: 'pvp', 'asymmetric-pvp': 'pvp',
  coop: 'coop', 'co-op': 'coop', syndicate: 'coop', 'team-up': 'coop',
  ghost: 'ghost', phantom: 'ghost', 'chase-a-legend': 'ghost',
});

/**
 * Pressure band → tier map exposed for external consumers.
 */
export const PRESSURE_BAND_TO_TIER_MAP: Readonly<Record<PressureBand, PressureTier>> = Object.freeze({
  CALM: 'T1',
  BUILDING: 'T1',
  ELEVATED: 'T2',
  HIGH: 'T3',
  CRITICAL: 'T4',
});

/**
 * Mode defaults table exposed for consumers that need to inspect
 * baseline economics without creating a snapshot.
 */
export const MODE_DEFAULTS_TABLE: Readonly<Record<ModeCode, ModeDefaults>> = MODE_DEFAULTS;

export {
  derivePressureBand as computePressureBandFromScore,
  normalizeMode as resolveExternalModeCode,
};
