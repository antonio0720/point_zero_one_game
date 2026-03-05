// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m121_daily_gauntlet_same_seed_for_everyone.ts
//
// Mechanic : M121 — Daily Gauntlet: Same Seed for Everyone
// Family   : social_advanced   Layer: season_runtime   Priority: 2   Batch: 3
// ML Pair  : m121a
// Deps     : M01, M64
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

// ── Import Anchors (keep every import “accessible” + used) ────────────────────

/**
 * Runtime access to canonical mechanicsUtils symbols imported by this mechanic.
 * Keeps all shared imports “live” + directly reachable for debugging/tests.
 */
export const M121_IMPORTED_SYMBOLS = {
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

/**
 * Type-only anchor so every imported domain type remains referenced in-module.
 * Prevents noUnusedLocals/noUnusedParameters warnings under strict builds.
 */
export type M121_ImportedTypesAnchor = {
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

// ── Local M121 domain types (intentionally not in ./types) ────────────────────

export type GauntletMode = 'DAILY' | 'WEEKLY' | 'EVENT';

export interface GauntletConfig {
  /**
   * Canonical day key used by the server to guarantee “same seed for everyone”.
   * Recommended: YYYY-MM-DD (UTC day boundary enforced server-side).
   */
  dayKey?: string;

  /** Optional ruleset identifier (allows multiple daily formats without power drift). */
  rulesetId?: string;

  /** Difficulty 1..10 (purely affects deterministic reward scaling + pool shaping). */
  difficulty?: number;

  /** Optional salt to differentiate decks across rulesets without breaking daily fairness. */
  deckSalt?: string;

  /** Optional salt to differentiate rewards across rulesets without breaking daily fairness. */
  rewardSalt?: string;

  /**
   * Approximate daily population used ONLY to convert a player performance signal into
   * a “ranking-like” integer without requiring the full leaderboard in this mechanic.
   */
  assumedPopulation?: number;

  /** Optional: if present, the server can pin tick window for the daily run. */
  totalTicksOverride?: number;

  /** Optional: mode tag (defaults to DAILY). */
  mode?: GauntletMode;
}

export interface GauntletRunState {
  mode: GauntletMode;
  dayKey: string;
  dailySeed: string;

  runId: string;
  tick: number;
  totalTicks: number;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  /** Deterministic deck order (IDs). */
  deckOrder: string[];

  /** Deterministic pool preview used for UI (subset of OPPORTUNITY_POOL). */
  poolPreview: GameCard[];

  /** Deterministic “opportunity of the day” (for UI + fairness proofs). */
  opportunityOfTheDay: GameCard;

  /** Deterministic audit hash binding the above to seed + config. */
  auditHash: string;
}

export type RewardBand = 'S' | 'A' | 'B' | 'C' | 'D';

export interface GauntletReward {
  rewardId: string;
  band: RewardBand;

  /** Deterministic currency reward (bounded). */
  cashBonus: number;

  /** Deterministic meta-currency reward (bounded). */
  trophyPoints: number;

  /** Optional featured card reward (non-P2W: card is from deterministic pool). */
  featuredCard?: GameCard;

  /** Optional proof reward hook (if your season system uses ProofCards). */
  proof?: ProofCard;

  meta: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M121Input {
  dailySeed?: string;
  gauntletConfig?: GauntletConfig;
  playerEntry?: Record<string, unknown>;

  /** Optional runtime context (router may pass these). */
  runId?: string;
  tick?: number;
}

export interface M121Output {
  gauntletRunState: GauntletRunState;
  dailyRanking: number;
  gauntletReward: GauntletReward;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M121Event = 'GAUNTLET_ENTERED' | 'GAUNTLET_COMPLETED' | 'DAILY_RANK_UPDATED';

export interface M121TelemetryPayload extends MechanicTelemetryPayload {
  event: M121Event;
  mechanic_id: 'M121';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M121_BOUNDS = {
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
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

function asNonEmptyString(v: unknown): string {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}

function toFiniteNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickFromKeys<T extends string>(keys: T[], seed: string, tick: number): T {
  if (keys.length === 0) return 'NEUTRAL' as T; // unreachable in practice (weights objects are non-empty)
  return keys[seededIndex(seed, tick, keys.length)];
}

function deriveRunPhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < RUN_TOTAL_TICKS / 3) return 'EARLY';
  if (t < (RUN_TOTAL_TICKS * 2) / 3) return 'MID';
  return 'LATE';
}

function deriveTickTier(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function inChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function deriveMacroRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));

  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function derivePressureTier(runPhase: RunPhase, chaos: boolean, regime: MacroRegime): PressureTier {
  // Deterministic + bounded: chaos and crisis elevate pressure; late phase elevates pressure.
  let score = 0;

  if (runPhase === 'MID') score += 1;
  if (runPhase === 'LATE') score += 2;

  if (chaos) score += 2;
  if (regime === 'BEAR') score += 1;
  if (regime === 'CRISIS') score += 2;

  if (score >= 5) return 'CRITICAL';
  if (score >= 3) return 'HIGH';
  if (score >= 1) return 'MEDIUM';
  return 'LOW';
}

function rankToBand(rank: number, assumedPopulation: number): RewardBand {
  const pop = Math.max(100, assumedPopulation);
  const r = clamp(rank, 1, pop);
  const p = r / pop;

  if (p <= 0.01) return 'S';
  if (p <= 0.05) return 'A';
  if (p <= 0.20) return 'B';
  if (p <= 0.50) return 'C';
  return 'D';
}

function bandMultipliers(band: RewardBand): { cash: number; trophy: number } {
  switch (band) {
    case 'S':
      return { cash: 1.00, trophy: 1.00 };
    case 'A':
      return { cash: 0.70, trophy: 0.70 };
    case 'B':
      return { cash: 0.45, trophy: 0.45 };
    case 'C':
      return { cash: 0.25, trophy: 0.25 };
    case 'D':
    default:
      return { cash: 0.10, trophy: 0.10 };
  }
}

function computeDailyRanking(params: {
  dailySeed: string;
  playerId: string;
  score: number;
  completed: boolean;
  finishTick: number;
  assumedPopulation: number;
}): number {
  const pop = Math.max(100, params.assumedPopulation);

  // Deterministic “skill” signal -> lower rank is better.
  // completed helps; faster finish helps; higher score helps.
  const scoreNorm = clamp(params.score / 100_000, 0, 1); // assumes score ~0..100k (safe clamp)
  const finishNorm = clamp(params.finishTick / RUN_TOTAL_TICKS, 0, 1);
  const completedBoost = params.completed ? 0.25 : 0.0;

  const performance = clamp(scoreNorm + completedBoost + (1 - finishNorm) * 0.15, 0, 1);

  // Convert performance into a rank-like position, with small deterministic jitter
  // to avoid ties without needing the whole leaderboard.
  const jitter = parseInt(computeHash(`${params.dailySeed}:rank:${params.playerId}`), 16) % 17;
  const base = Math.round((1 - performance) * (pop - 1)) + 1;

  return clamp(base + jitter, 1, pop);
}

function computeReward(params: {
  dailySeed: string;
  band: RewardBand;
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  difficulty: number;
  pool: GameCard[];
}): GauntletReward {
  const rewardSalt = computeHash(`${params.dailySeed}:reward:${params.band}:${params.macroRegime}:${params.runPhase}`);

  const regimeMult = REGIME_MULTIPLIERS[params.macroRegime] ?? 1.0;
  const pulseMult = EXIT_PULSE_MULTIPLIERS[params.macroRegime] ?? 1.0;

  const phaseW = PHASE_WEIGHTS[params.runPhase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[params.pressureTier] ?? 1.0;

  const diff = clamp(params.difficulty, 1, 10);
  const diffMult = 0.85 + diff * 0.05; // 0.90..1.35

  const bandMult = bandMultipliers(params.band);

  // Currency is bounded and deterministic. Higher difficulty and harsher regimes can pay more
  // without becoming pay-to-win (same seed, same opportunity set).
  const rawCash =
    12_000 *
    bandMult.cash *
    diffMult *
    (0.95 + (phaseW - 0.9)) *
    (0.90 + (pressureW - 0.8)) *
    (0.85 + (1.15 - regimeMult)) *
    (0.85 + (1.25 - pulseMult));

  const cashBonus = clamp(Math.round(rawCash), 250, M121_BOUNDS.MAX_AMOUNT);

  const rawTrophy =
    600 *
    bandMult.trophy *
    diffMult *
    (0.90 + (pressureW - 0.8)) *
    (0.90 + (1.10 - (REGIME_WEIGHTS[params.macroRegime] ?? 1.0)));

  const trophyPoints = clamp(Math.round(rawTrophy), 10, 5_000);

  const poolSafe = params.pool.length ? params.pool : [DEFAULT_CARD];
  const featuredCard = poolSafe[seededIndex(rewardSalt, 7, poolSafe.length)] ?? DEFAULT_CARD;

  return {
    rewardId: computeHash(`${params.dailySeed}:M121:reward:${params.band}:${featuredCard.id}`),
    band: params.band,
    cashBonus,
    trophyPoints,
    featuredCard,
    meta: {
      macroRegime: params.macroRegime,
      runPhase: params.runPhase,
      pressureTier: params.pressureTier,
      difficulty: diff,
      poolSize: poolSafe.length,
    },
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * dailyGauntletEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function dailyGauntletEngine(input: M121Input, emit: MechanicEmitter): M121Output {
  const gauntletConfig = input.gauntletConfig ?? {};
  const playerEntry = input.playerEntry ?? {};

  const tick = clamp(toFiniteNumber(input.tick ?? (playerEntry as any).tick, 0), 0, RUN_TOTAL_TICKS - 1);

  const dayKey = asNonEmptyString(gauntletConfig.dayKey) || 'UNSPECIFIED_DAY';
  const rulesetId = asNonEmptyString(gauntletConfig.rulesetId) || 'default';
  const mode: GauntletMode = (gauntletConfig.mode ?? 'DAILY') as GauntletMode;

  // Canonical “same seed for everyone”: prefer server-provided dailySeed; otherwise derive from dayKey + ruleset.
  const dailySeed =
    asNonEmptyString(input.dailySeed) ||
    computeHash(`M121:${mode}:${dayKey}:${rulesetId}:${computeHash(JSON.stringify(gauntletConfig))}`);

  const runId = asNonEmptyString(input.runId) || computeHash(`M121:${dailySeed}:run`);

  // Deterministic macro fabric.
  const macroSchedule = buildMacroSchedule(`${dailySeed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${dailySeed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const runPhase = deriveRunPhase(tick);
  const chaos = inChaosWindow(tick, chaosWindows);
  const pressureTier = derivePressureTier(runPhase, chaos, macroRegime);
  const tickTier = deriveTickTier(pressureTier);

  // Deterministic deck order (IDs) for the day.
  const deckSalt = asNonEmptyString(gauntletConfig.deckSalt) || 'deck';
  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, `${dailySeed}:${deckSalt}:${rulesetId}`);

  // Deterministic “opportunity of the day”.
  const opp = OPPORTUNITY_POOL[seededIndex(`${dailySeed}:opp:${rulesetId}`, 0, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  // Deterministic pool shaping for UI preview / featured card selection.
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const poolPreview = buildWeightedPool(`${dailySeed}:pool:${rulesetId}`, pressureW * phaseW, regimeW);

  // Player-derived ranking (local approximation; full leaderboard handled elsewhere).
  const playerId = asNonEmptyString((playerEntry as any).playerId) || computeHash(JSON.stringify(playerEntry));
  const score = toFiniteNumber((playerEntry as any).score, 0);
  const completed = Boolean((playerEntry as any).completed);
  const finishTick = clamp(toFiniteNumber((playerEntry as any).finishTick, tick), 0, RUN_TOTAL_TICKS - 1);

  const assumedPopulation = clamp(toFiniteNumber(gauntletConfig.assumedPopulation, 10_000), 100, 5_000_000);

  const dailyRanking = computeDailyRanking({
    dailySeed,
    playerId,
    score,
    completed,
    finishTick,
    assumedPopulation,
  });

  const band = rankToBand(dailyRanking, assumedPopulation);

  const difficulty = clamp(toFiniteNumber(gauntletConfig.difficulty, 5), 1, 10);

  const rewardSalt = asNonEmptyString(gauntletConfig.rewardSalt) || 'reward';
  const gauntletReward = computeReward({
    dailySeed: computeHash(`${dailySeed}:${rewardSalt}:${rulesetId}`),
    band,
    macroRegime,
    runPhase,
    pressureTier,
    difficulty,
    pool: poolPreview,
  });

  const decay = computeDecayRate(macroRegime, M121_BOUNDS.BASE_DECAY_RATE);
  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M121',
      mode,
      dayKey,
      rulesetId,
      dailySeed,
      runId,
      tick,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      chaos,
      decay,
      deckTop: deckOrder[0] ?? null,
      oppId: opp.id,
      poolSize: poolPreview.length,
      assumedPopulation,
      playerId,
      score,
      completed,
      finishTick,
      dailyRanking,
      rewardId: gauntletReward.rewardId,
    }),
  );

  const totalTicks =
    clamp(
      toFiniteNumber(gauntletConfig.totalTicksOverride, RUN_TOTAL_TICKS),
      12,
      RUN_TOTAL_TICKS,
    ) || RUN_TOTAL_TICKS;

  const gauntletRunState: GauntletRunState = {
    mode,
    dayKey,
    dailySeed,

    runId,
    tick,
    totalTicks,

    macroSchedule,
    chaosWindows,

    macroRegime,
    runPhase,
    pressureTier,
    tickTier,

    deckOrder,
    poolPreview,
    opportunityOfTheDay: opp,

    auditHash,
  };

  const event: M121Event =
    completed ? 'GAUNTLET_COMPLETED' : Object.keys(playerEntry).length ? 'DAILY_RANK_UPDATED' : 'GAUNTLET_ENTERED';

  emit({
    event,
    mechanic_id: 'M121',
    tick,
    runId,
    payload: {
      dayKey,
      mode,
      rulesetId,
      dailySeed,

      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      chaos,
      decay,

      deckTop: deckOrder[0] ?? null,
      oppId: opp.id,
      poolSize: poolPreview.length,

      playerId,
      score,
      completed,
      finishTick,
      dailyRanking,
      band,

      reward: {
        rewardId: gauntletReward.rewardId,
        band: gauntletReward.band,
        cashBonus: gauntletReward.cashBonus,
        trophyPoints: gauntletReward.trophyPoints,
        featuredCardId: gauntletReward.featuredCard?.id ?? null,
      },

      auditHash,
    },
  });

  return {
    gauntletRunState,
    dailyRanking,
    gauntletReward,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M121MLInput {
  gauntletRunState?: GauntletRunState;
  dailyRanking?: number;
  gauntletReward?: GauntletReward;
  runId: string;
  tick: number;
}

export interface M121MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * dailyGauntletEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function dailyGauntletEngineMLCompanion(input: M121MLInput): Promise<M121MLOutput> {
  const tick = clamp(toFiniteNumber(input.tick, 0), 0, RUN_TOTAL_TICKS - 1);

  const s = input.gauntletRunState;
  const rank = clamp(toFiniteNumber(input.dailyRanking, 0), 0, 5_000_000);

  const macroRegime: MacroRegime = (s?.macroRegime ?? 'NEUTRAL') as MacroRegime;
  const decay = computeDecayRate(macroRegime, M121_BOUNDS.BASE_DECAY_RATE);

  // Score is higher for better (lower) ranks; if rank missing, keep low.
  const assumedPop = clamp(toFiniteNumber((s as any)?.assumedPopulation, 10_000), 100, 5_000_000);
  const rankNorm = rank > 0 ? clamp(1 - rank / assumedPop, 0, 1) : 0.05;

  const completed = Boolean((s as any)?.tick >= (s?.totalTicks ?? RUN_TOTAL_TICKS) - 1);
  const completionBoost = completed ? 0.10 : 0.0;

  const score = clamp((0.15 + rankNorm * 0.80 + completionBoost) * (1 - decay * 0.20), 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(rank > 0 ? `Rank-derived performance: ${Math.round(rankNorm * 100)}%` : 'No rank provided');
  topFactors.push(`Regime: ${macroRegime}`);
  topFactors.push(`Decay: ${decay.toFixed(2)}`);
  if (input.gauntletReward?.band) topFactors.push(`Reward band: ${input.gauntletReward.band}`);
  if (s?.pressureTier) topFactors.push(`Pressure: ${s.pressureTier}`);

  const recommendation =
    score >= 0.85
      ? 'Push for S/A-tier consistency; replicate this run pattern.'
      : score >= 0.55
        ? 'Optimize finish speed and reduce chaos exposure; target A/B tiers.'
        : 'Treat today as a scouting run; learn the seed pattern and stabilize execution.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + `:ml:M121:${macroRegime}:${tick}`),
    confidenceDecay: clamp(0.05 + decay * 0.30, 0.01, 0.50),
  };
}