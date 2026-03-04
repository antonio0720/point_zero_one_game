// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m40_cosmetic_crafting.ts
//
// Mechanic : M40 — Cosmetic Crafting
// Family   : achievement_engine   Layer: season_runtime   Priority: 2   Batch: 2
// ML Pair  : m40a
// Deps     : M39
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {
  clamp,
  computeHash,
  seededShuffle,
  seededIndex,
  buildMacroSchedule,
  buildChaosWindows,
  buildWeightedPool,
  OPPORTUNITY_POOL,
  DEFAULT_CARD,
  DEFAULT_CARD_IDS,
  computeDecayRate,
  EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN,
  CHAOS_WINDOWS_PER_RUN,
  RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS,
  PHASE_WEIGHTS,
  REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} from './mechanicsUtils';

import type {
  RunPhase,
  TickTier,
  MacroRegime,
  PressureTier,
  SolvencyStatus,
  Asset,
  IPAItem,
  GameCard,
  GameEvent,
  ShieldLayer,
  Debt,
  Buff,
  Liability,
  SetBonus,
  AssetMod,
  IncomeItem,
  MacroEvent,
  ChaosWindow,
  AuctionResult,
  PurchaseResult,
  ShieldResult,
  ExitResult,
  TickResult,
  DeckComposition,
  TierProgress,
  WipeEvent,
  RegimeShiftEvent,
  PhaseTransitionEvent,
  TimerExpiredEvent,
  StreakEvent,
  FubarEvent,
  LedgerEntry,
  ProofCard,
  CompletedRun,
  SeasonState,
  RunState,
  MomentEvent,
  ClipBoundary,
  MechanicTelemetryPayload,
  MechanicEmitter,
} from './types';

// ── Import Anchors (keep every import “accessible” + used) ───────────────────

export const M40_IMPORTED_SYMBOLS = {
  clamp,
  computeHash,
  seededShuffle,
  seededIndex,
  buildMacroSchedule,
  buildChaosWindows,
  buildWeightedPool,
  OPPORTUNITY_POOL,
  DEFAULT_CARD,
  DEFAULT_CARD_IDS,
  computeDecayRate,
  EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN,
  CHAOS_WINDOWS_PER_RUN,
  RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS,
  PHASE_WEIGHTS,
  REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} as const;

export type M40_ImportedTypesAnchor = {
  runPhase: RunPhase;
  tickTier: TickTier;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  solvencyStatus: SolvencyStatus;
  asset: Asset;
  ipaItem: IPAItem;
  gameCard: GameCard;
  gameEvent: GameEvent;
  shieldLayer: ShieldLayer;
  debt: Debt;
  buff: Buff;
  liability: Liability;
  setBonus: SetBonus;
  assetMod: AssetMod;
  incomeItem: IncomeItem;
  macroEvent: MacroEvent;
  chaosWindow: ChaosWindow;
  auctionResult: AuctionResult;
  purchaseResult: PurchaseResult;
  shieldResult: ShieldResult;
  exitResult: ExitResult;
  tickResult: TickResult;
  deckComposition: DeckComposition;
  tierProgress: TierProgress;
  wipeEvent: WipeEvent;
  regimeShiftEvent: RegimeShiftEvent;
  phaseTransitionEvent: PhaseTransitionEvent;
  timerExpiredEvent: TimerExpiredEvent;
  streakEvent: StreakEvent;
  fubarEvent: FubarEvent;
  ledgerEntry: LedgerEntry;
  proofCard: ProofCard;
  completedRun: CompletedRun;
  seasonState: SeasonState;
  runState: RunState;
  momentEvent: MomentEvent;
  clipBoundary: ClipBoundary;
  mechanicTelemetryPayload: MechanicTelemetryPayload;
  mechanicEmitter: MechanicEmitter;
};

// ── Cosmetic contracts (mechanic-local; not in shared ./types) ───────────────

export type CosmeticRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type CosmeticSlot = 'TITLE' | 'FRAME' | 'SKIN' | 'BANNER' | 'EMOTE';

export interface CosmeticRecipe {
  id: string;
  name: string;
  slot: CosmeticSlot;
  rarityTarget: CosmeticRarity;

  /**
   * If omitted, M40 derives a deterministic base cost (bounded) using macro context.
   */
  baseCost?: number;

  /**
   * Optional crafting “difficulty” scalar (0.5..2.0 recommended).
   */
  difficulty?: number;

  /**
   * Optional proof binding requirement.
   * If true and proofCard missing, the recipe fails deterministically.
   */
  requiresProof?: boolean;

  /**
   * Optional components list (string ids). Used deterministically to influence item hash.
   */
  components?: string[];
}

export interface CosmeticItem {
  id: string;
  name: string;
  slot: CosmeticSlot;
  rarity: CosmeticRarity;

  /**
   * Deterministic “style seed” you can use in rendering (palette selection, shader seed, etc.).
   */
  styleSeed: string;

  /**
   * Server-verifiable token for audit linking reward to the recipe + run context.
   */
  craftToken: string;

  meta: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M40Input {
  trophyCurrency?: number;
  cosmeticRecipe?: CosmeticRecipe;

  /**
   * Optional run context (safe to omit).
   */
  runId?: string;
  tick?: number;

  /**
   * Optional proof artifact (safe to omit).
   */
  proofCard?: ProofCard | null;

  /**
   * Optional macro hints (safe to omit; otherwise derived deterministically).
   */
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  runPhase?: RunPhase;
}

export interface M40Output {
  cosmeticCrafted: CosmeticItem | null;
  currencySpent: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M40Event = 'COSMETIC_CRAFTED' | 'CURRENCY_SPENT' | 'RECIPE_FAILED';

export interface M40TelemetryPayload extends MechanicTelemetryPayload {
  event: M40Event;
  mechanic_id: 'M40';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M40_BOUNDS = {
  TRIGGER_THRESHOLD: 3,
  MULTIPLIER: 1.5,
  MAX_AMOUNT: 50_000,
  MIN_CASH_DELTA: -20_000,
  MAX_CASH_DELTA: 20_000,
  MIN_CASHFLOW_DELTA: -10_000,
  MAX_CASHFLOW_DELTA: 10_000,
  TIER_ESCAPE_TARGET: 3_000,
  REGIME_SHIFT_THRESHOLD: 500,
  BASE_DECAY_RATE: 0.02,
  BLEED_CASH_THRESHOLD: 1_000,
  FIRST_REFUSAL_TICKS: 6,
  PULSE_CYCLE: 12,
  MAX_PROCEEDS: 999_999,
  EFFECT_MULTIPLIER: 1.0,
  MIN_EFFECT: 0,
  MAX_EFFECT: 100_000,

  // M40-specific caps
  MIN_BASE_COST: 250,
  MAX_BASE_COST: 50_000,
  MAX_SPEND: 99_999,
  FAIL_BURN_FRAC: 0.25, // spend fraction on failure (bounded)
} as const;

// ── Internal helpers (deterministic, bounded) ───────────────────────────────

function m40DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m40InChaosWindow(tick: number, chaosWindows: ChaosWindow[]): boolean {
  for (const w of chaosWindows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m40RegimeAtTick(tick: number, schedule: MacroEvent[]): MacroRegime {
  if (!schedule || schedule.length === 0) return 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);

  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m40DerivePressureTier(tick: number, phase: RunPhase, chaos: ChaosWindow[]): PressureTier {
  if (m40InChaosWindow(tick, chaos)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m40PulseFrac(tick: number): number {
  return clamp((tick % M40_BOUNDS.PULSE_CYCLE) / M40_BOUNDS.PULSE_CYCLE, 0, 1);
}

function m40RarityWeight(r: CosmeticRarity): number {
  switch (r) {
    case 'COMMON':
      return 1.0;
    case 'RARE':
      return 1.25;
    case 'EPIC':
      return 1.6;
    case 'LEGENDARY':
      return 2.1;
    default:
      return 1.0;
  }
}

type M40Context = {
  seed: string;
  runId: string;
  tick: number;

  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  inChaos: boolean;

  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
  regimeMultiplier: number;
  exitPulse: number;
  decayRate: number;

  pulseFrac: number;
  bonusWindow: boolean;

  deckIds: string[];
  oppPick: GameCard;
  craftPoolPick: GameCard;
};

function m40BuildContext(input: M40Input): M40Context {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? computeHash(JSON.stringify({ ...input, tick })));
  const seed = computeHash(`${runId}:M40:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = (input.runPhase as RunPhase) ?? m40DerivePhase(tick);
  const derivedRegime = m40RegimeAtTick(tick, macroSchedule);
  const regime = (input.macroRegime as MacroRegime) ?? derivedRegime;

  const pressure = (input.pressureTier as PressureTier) ?? m40DerivePressureTier(tick, phase, chaosWindows);
  const inChaos = m40InChaosWindow(tick, chaosWindows);

  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M40_BOUNDS.BASE_DECAY_RATE);

  const pulseFrac = m40PulseFrac(tick);
  const bonusWindow = !inChaos && pulseFrac <= 0.25;

  const deckIds = seededShuffle(DEFAULT_CARD_IDS, seed);
  const oppIdx = seededIndex(seed, tick + 17, OPPORTUNITY_POOL.length);
  const oppPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const pool = buildWeightedPool(seed + ':craft', pressureWeight * phaseWeight, regimeWeight);
  const poolIdx = seededIndex(seed, tick + 33, Math.max(1, pool.length));
  const craftPoolPick = pool[poolIdx] ?? oppPick ?? DEFAULT_CARD;

  return {
    seed,
    runId,
    tick,
    phase,
    regime,
    pressure,
    macroSchedule,
    chaosWindows,
    inChaos,
    pressureWeight,
    phaseWeight,
    regimeWeight,
    regimeMultiplier,
    exitPulse,
    decayRate,
    pulseFrac,
    bonusWindow,
    deckIds,
    oppPick,
    craftPoolPick,
  };
}

function m40DeriveBaseCost(ctx: M40Context, recipe: CosmeticRecipe): number {
  const rarityW = m40RarityWeight(recipe.rarityTarget);

  // Environment shaping
  const env = clamp(ctx.regimeMultiplier * ctx.exitPulse, 0.25, 2.25);

  // “Difficulty” shaping (pressure/phase/regime weights)
  const diff = clamp(ctx.pressureWeight * ctx.phaseWeight * ctx.regimeWeight, 0.45, 2.75);

  // Card seasoning from craft pool pick (bounded, uses DEFAULT_CARD fallback implicitly)
  const cost = Number(ctx.craftPoolPick.cost ?? 0);
  const cardSeason = clamp(cost / 50_000, 0, 1) * 0.20; // 0..0.20

  const base = Number.isFinite(recipe.baseCost ?? NaN)
    ? Number(recipe.baseCost)
    : M40_BOUNDS.MIN_BASE_COST + Math.round(M40_BOUNDS.MAX_BASE_COST * 0.12 * env * diff * rarityW * (0.85 + cardSeason));

  return clamp(Math.round(base), M40_BOUNDS.MIN_BASE_COST, M40_BOUNDS.MAX_BASE_COST);
}

function m40ComputeSuccessChance(ctx: M40Context, recipe: CosmeticRecipe, baseCost: number): number {
  const difficulty = clamp(Number(recipe.difficulty ?? 1.0), 0.5, 2.0);

  // More expensive crafts are slightly harder, bounded
  const costNorm = clamp(baseCost / M40_BOUNDS.MAX_BASE_COST, 0, 1); // 0..1

  // Chaos penalizes, bonus window boosts
  const chaosPenalty = ctx.inChaos ? 0.18 : 0.0;
  const windowBoost = ctx.bonusWindow ? 0.10 : 0.0;

  // Macro shaping: crisis should be harder to craft reliably
  const regimeHardness = clamp(1.25 - (REGIME_MULTIPLIERS[ctx.regime] ?? 1.0), 0.05, 0.85); // higher => harder

  const rarityW = m40RarityWeight(recipe.rarityTarget);
  const rarityHardness = clamp((rarityW - 1.0) * 0.22, 0, 0.25);

  const base = 0.80 - costNorm * 0.18 - regimeHardness * 0.10 - rarityHardness;
  const shaped = base + windowBoost - chaosPenalty;

  // Apply recipe difficulty
  const final = shaped / difficulty;

  return clamp(final, 0.10, 0.95);
}

function m40CraftOutcomeRoll(ctx: M40Context, recipe: CosmeticRecipe, chance: number): boolean {
  const roll = seededIndex(ctx.seed + ':roll', ctx.tick + 101, 10_000) / 10_000; // 0..0.9999
  const recipeSalt = seededIndex(ctx.seed + ':rs', recipe.id.length + ctx.tick, 10_000) / 10_000; // 0..0.9999
  const combined = clamp((roll * 0.70 + recipeSalt * 0.30), 0, 1);
  return combined <= chance;
}

function m40RarityOnSuccess(ctx: M40Context, target: CosmeticRarity): CosmeticRarity {
  // Deterministic “upgrade” chance (bounded, never downgrades below target)
  const upgradeRoll = seededIndex(ctx.seed + ':rar', ctx.tick + 303, 1000) / 1000; // 0..0.999
  const boost = (ctx.bonusWindow ? 0.12 : 0) + (ctx.phase === 'LATE' ? 0.05 : 0) - (ctx.inChaos ? 0.10 : 0);

  const effective = clamp(upgradeRoll - boost, 0, 1);

  if (target === 'LEGENDARY') return 'LEGENDARY';
  if (target === 'EPIC') return effective < 0.06 ? 'LEGENDARY' : 'EPIC';
  if (target === 'RARE') return effective < 0.05 ? 'EPIC' : effective < 0.11 ? 'LEGENDARY' : 'RARE';
  return effective < 0.03 ? 'RARE' : effective < 0.06 ? 'EPIC' : effective < 0.08 ? 'LEGENDARY' : 'COMMON';
}

function m40BuildCosmeticName(recipe: CosmeticRecipe, pick: GameCard, rarity: CosmeticRarity): string {
  const core = pick?.name ?? DEFAULT_CARD.name;
  return `${recipe.name} — ${core} (${rarity})`;
}

function m40BuildCosmeticItem(ctx: M40Context, recipe: CosmeticRecipe, rarity: CosmeticRarity): CosmeticItem {
  const components = recipe.components ?? [];
  const mixed = seededShuffle(
    [
      recipe.id,
      recipe.slot,
      recipe.rarityTarget,
      ...components,
      ctx.deckIds[0] ?? '',
      ctx.craftPoolPick.id ?? '',
      ctx.oppPick.id ?? '',
      ctx.regime,
      ctx.phase,
      ctx.pressure,
    ],
    ctx.seed + ':cmp',
  );

  const styleSeed = computeHash(mixed.join('|') + ':style');

  const craftToken = computeHash(
    JSON.stringify({
      mid: 'M40',
      runId: ctx.runId,
      tick: ctx.tick,
      recipeId: recipe.id,
      rarity,
      slot: recipe.slot,
      regime: ctx.regime,
      phase: ctx.phase,
      pressure: ctx.pressure,
      poolPick: ctx.craftPoolPick.id,
      deckTop: ctx.deckIds[0] ?? '',
      proofHash: ctx.seed, // seed already derives from runId+tick; binds the craft deterministically
    }),
  );

  const id = computeHash(`${ctx.runId}:${ctx.tick}:${recipe.id}:${rarity}:${styleSeed}:${craftToken}`);

  return {
    id,
    name: m40BuildCosmeticName(recipe, ctx.craftPoolPick, rarity),
    slot: recipe.slot,
    rarity,
    styleSeed,
    craftToken,
    meta: {
      recipeId: recipe.id,
      recipeName: recipe.name,
      targetRarity: recipe.rarityTarget,
      componentsCount: components.length,
      regime: ctx.regime,
      phase: ctx.phase,
      pressure: ctx.pressure,
      inChaos: ctx.inChaos,
      bonusWindow: ctx.bonusWindow,
      oppPick: { id: ctx.oppPick.id, name: ctx.oppPick.name },
      poolPick: { id: ctx.craftPoolPick.id, name: ctx.craftPoolPick.name },
      deckTop: ctx.deckIds[0] ?? '',
    },
  };
}

function m40ComputeSpend(trophyCurrency: number, baseCost: number, success: boolean, ctx: M40Context): number {
  const available = clamp(Math.floor(trophyCurrency), 0, M40_BOUNDS.MAX_PROCEEDS);

  // Apply a tiny “craft friction” using decayRate (bounded, deterministic)
  const friction = clamp(Math.floor(baseCost * clamp(ctx.decayRate * 0.10, 0.001, 0.09)), 0, Math.floor(baseCost * 0.09));

  const cost = baseCost + friction;

  if (success) {
    return clamp(cost, 0, Math.min(M40_BOUNDS.MAX_SPEND, available));
  }

  // Failure burns a fraction + friction, bounded.
  const burn = Math.floor(cost * clamp(M40_BOUNDS.FAIL_BURN_FRAC + (ctx.inChaos ? 0.10 : 0.0), 0.10, 0.50));
  return clamp(burn, 0, Math.min(M40_BOUNDS.MAX_SPEND, available));
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * cosmeticCraftingEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function cosmeticCraftingEngine(input: M40Input, emit: MechanicEmitter): M40Output {
  const recipe = input.cosmeticRecipe;
  const trophyCurrency = clamp(Math.floor(Number(input.trophyCurrency ?? 0)), 0, M40_BOUNDS.MAX_PROCEEDS);

  const ctx = m40BuildContext(input);

  if (!recipe) {
    emit({
      event: 'RECIPE_FAILED',
      mechanic_id: 'M40',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        reason: 'NO_RECIPE',
        trophyCurrency,
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
      },
    } as M40TelemetryPayload);

    return { cosmeticCrafted: null, currencySpent: 0 };
  }

  if (recipe.requiresProof && !input.proofCard) {
    emit({
      event: 'RECIPE_FAILED',
      mechanic_id: 'M40',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        reason: 'PROOF_REQUIRED',
        recipeId: recipe.id,
        recipeName: recipe.name,
        trophyCurrency,
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
      },
    } as M40TelemetryPayload);

    return { cosmeticCrafted: null, currencySpent: 0 };
  }

  const baseCost = m40DeriveBaseCost(ctx, recipe);
  const successChance = m40ComputeSuccessChance(ctx, recipe, baseCost);

  // Fail deterministically if insufficient funds for even minimum burn (safety bound)
  const minBurn = Math.floor(baseCost * 0.10);
  if (trophyCurrency < minBurn) {
    emit({
      event: 'RECIPE_FAILED',
      mechanic_id: 'M40',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        reason: 'INSUFFICIENT_FUNDS',
        recipeId: recipe.id,
        baseCost,
        trophyCurrency,
        minBurn,
      },
    } as M40TelemetryPayload);

    return { cosmeticCrafted: null, currencySpent: 0 };
  }

  // Deterministic roll
  const success = m40CraftOutcomeRoll(ctx, recipe, successChance);

  const spend = m40ComputeSpend(trophyCurrency, baseCost, success, ctx);

  emit({
    event: 'CURRENCY_SPENT',
    mechanic_id: 'M40',
    tick: ctx.tick,
    runId: ctx.runId,
    payload: {
      recipeId: recipe.id,
      recipeName: recipe.name,
      baseCost,
      spent: spend,
      balanceBefore: trophyCurrency,
      balanceAfter: clamp(trophyCurrency - spend, 0, M40_BOUNDS.MAX_PROCEEDS),
      env: {
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        inChaos: ctx.inChaos,
        bonusWindow: ctx.bonusWindow,
        pulseFrac: Number(ctx.pulseFrac.toFixed(4)),
        decayRate: Number(ctx.decayRate.toFixed(6)),
        regimeMultiplier: Number(ctx.regimeMultiplier.toFixed(4)),
        exitPulse: Number(ctx.exitPulse.toFixed(4)),
      },
      picks: {
        opp: { id: ctx.oppPick.id, name: ctx.oppPick.name },
        pool: { id: ctx.craftPoolPick.id, name: ctx.craftPoolPick.name },
        deckTop: ctx.deckIds[0] ?? '',
      },
      proof: {
        proofHash: input.proofCard?.hash ?? '',
        proofGrade: input.proofCard?.grade ?? '',
      },
    },
  } as M40TelemetryPayload);

  if (!success) {
    emit({
      event: 'RECIPE_FAILED',
      mechanic_id: 'M40',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        reason: 'ROLL_FAILED',
        recipeId: recipe.id,
        recipeName: recipe.name,
        baseCost,
        successChance: Number(successChance.toFixed(4)),
        spent: spend,
        balanceBefore: trophyCurrency,
        balanceAfter: clamp(trophyCurrency - spend, 0, M40_BOUNDS.MAX_PROCEEDS),
      },
    } as M40TelemetryPayload);

    return { cosmeticCrafted: null, currencySpent: spend };
  }

  const rarity = m40RarityOnSuccess(ctx, recipe.rarityTarget);
  const crafted = m40BuildCosmeticItem(ctx, recipe, rarity);

  emit({
    event: 'COSMETIC_CRAFTED',
    mechanic_id: 'M40',
    tick: ctx.tick,
    runId: ctx.runId,
    payload: {
      recipeId: recipe.id,
      recipeName: recipe.name,
      slot: recipe.slot,
      targetRarity: recipe.rarityTarget,
      rarity,
      baseCost,
      spent: spend,
      successChance: Number(successChance.toFixed(4)),
      crafted: {
        id: crafted.id,
        name: crafted.name,
        slot: crafted.slot,
        rarity: crafted.rarity,
        styleSeed: crafted.styleSeed,
        craftToken: crafted.craftToken,
      },
    },
  } as M40TelemetryPayload);

  return { cosmeticCrafted: crafted, currencySpent: spend };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M40MLInput {
  cosmeticCrafted?: CosmeticItem | null;
  currencySpent?: number;
  runId: string;
  tick: number;
}

export interface M40MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (djb2 here)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * cosmeticCraftingEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function cosmeticCraftingEngineMLCompanion(input: M40MLInput): Promise<M40MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? '');
  const seed = computeHash(`${runId}:M40:ml:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m40DerivePhase(tick);
  const regime = m40RegimeAtTick(tick, macroSchedule);
  const pressure = m40DerivePressureTier(tick, phase, chaosWindows);
  const inChaos = m40InChaosWindow(tick, chaosWindows);

  const decay = computeDecayRate(regime, M40_BOUNDS.BASE_DECAY_RATE);

  const spent = Math.max(0, Math.floor(Number(input.currencySpent ?? 0)));
  const spentNorm = clamp(spent / M40_BOUNDS.MAX_SPEND, 0, 1);

  const crafted = input.cosmeticCrafted ?? null;
  const craftedBoost = crafted ? (crafted.rarity === 'LEGENDARY' ? 0.25 : crafted.rarity === 'EPIC' ? 0.18 : crafted.rarity === 'RARE' ? 0.12 : 0.08) : 0;

  const chaosPenalty = inChaos ? 0.10 : 0.0;
  const score = clamp(0.20 + craftedBoost + spentNorm * 0.35 - chaosPenalty, 0.01, 0.99);

  const envMult = (REGIME_MULTIPLIERS[regime] ?? 1.0) * (EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0);

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS} phase=${phase}`,
    `regime=${regime} pressure=${pressure} chaos=${inChaos ? 'Y' : 'N'}`,
    `spent=${spent} (${spentNorm.toFixed(2)}) decay=${decay.toFixed(3)}`,
    crafted ? `crafted=${crafted.rarity}:${crafted.slot}` : 'crafted=NONE',
    `envMult=${envMult.toFixed(2)} weights p=${(PRESSURE_WEIGHTS[pressure] ?? 1.0).toFixed(2)} ph=${(PHASE_WEIGHTS[phase] ?? 1.0).toFixed(2)} r=${(REGIME_WEIGHTS[regime] ?? 1.0).toFixed(2)}`,
  ].slice(0, 5);

  const recommendation = crafted
    ? crafted.rarity === 'LEGENDARY'
      ? 'Legendary craft secured: lock it into loadout and capture proof-grade moment for social amplification.'
      : 'Craft completed: route cosmetic into loadout and conserve trophy currency for higher rarity recipes.'
    : spent > 0
      ? 'Craft failed: avoid chaos windows and attempt again during a clean pulse window to improve success odds.'
      : 'No craft executed: queue a recipe and ensure sufficient trophy currency before attempting.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M40', ...input }) + ':ml:M40'),
    confidenceDecay: decay,
  };
}