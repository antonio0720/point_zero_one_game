// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m124_speedrun_mode_timer_is_even_harsher.ts
//
// Mechanic : M124 — Speedrun Mode: Timer Is Even Harsher
// Family   : social_advanced   Layer: season_runtime   Priority: 2   Batch: 3
// ML Pair  : m124a
// Deps     : M02, M64
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
export const M124_IMPORTED_SYMBOLS = {
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
 * Prevents type-import drift and keeps the full surface area reachable.
 */
export type M124_ImportedTypesAnchor = {
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

// ── Local M124 domain types (intentionally NOT in ./types) ───────────────────

export interface SpeedrunConfig {
  /** Optional player identifier (used only for deterministic PB hashing when provided). */
  playerId?: string;

  /** Optional ruleset id for season variations. */
  rulesetId?: string;

  /**
   * Base tick budget before harshness (defaults to RUN_TOTAL_TICKS).
   * This is the “normal” timer baseline; speedrun applies harsher multipliers.
   */
  baseTickBudget?: number;

  /**
   * Speedrun harshness factor (<1 = less time).
   * Defaults to 0.75 (25% harsher than standard).
   */
  harsherFactor?: number;

  /** Number of splits to surface (1..8). Default 3. */
  splitCount?: number;

  /** Optional explicit split ticks (absolute ticks, 0..budget). */
  splitTicks?: number[];

  /** Optional existing personal best (in ticks). */
  personalBest?: number;

  /** Optional seed salt (used only to diversify speedrun variants without breaking determinism). */
  seedSalt?: string;
}

export interface SpeedrunState {
  mechanicId: 'M124';

  runId: string;
  runSeed: string;

  tick: number;
  tickBudget: number;
  tickRemaining: number;

  started: boolean;
  completed: boolean;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  decayRate: number;
  harshnessMultiplier: number;

  // Deterministic UI hints (no gameplay authority)
  deckHintTop: string;
  opportunityHintId: string;
  weightedPoolPreviewIds: string[];

  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M124Input {
  speedrunConfig?: SpeedrunConfig;
  runSeed?: string;
  timerConfig?: Record<string, unknown>;
}

export interface M124Output {
  speedrunState: SpeedrunState;
  splitTimes: number[];
  personalBest: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M124Event = 'SPEEDRUN_STARTED' | 'SPLIT_RECORDED' | 'PERSONAL_BEST_SET';

export interface M124TelemetryPayload extends MechanicTelemetryPayload {
  event: M124Event;
  mechanic_id: 'M124';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M124_BOUNDS = {
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

function toFiniteInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function deriveRunPhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < RUN_TOTAL_TICKS / 3) return 'EARLY';
  if (t < (RUN_TOTAL_TICKS * 2) / 3) return 'MID';
  return 'LATE';
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

function inChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function derivePressureTier(runPhase: RunPhase, regime: MacroRegime, chaos: boolean): PressureTier {
  // Bounded & deterministic; speedrun uses this only for timer harshness signals.
  if (chaos) return 'CRITICAL';
  if (regime === 'CRISIS') return runPhase === 'EARLY' ? 'HIGH' : 'CRITICAL';
  if (regime === 'BEAR') return runPhase === 'LATE' ? 'HIGH' : 'MEDIUM';
  if (regime === 'BULL') return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
  return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
}

function deriveTickTier(pressureTier: PressureTier): TickTier {
  if (pressureTier === 'CRITICAL') return 'CRITICAL';
  if (pressureTier === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function computeSpeedrunBudget(params: {
  baseBudget: number;
  harsherFactor: number;
  regime: MacroRegime;
  pressureTier: PressureTier;
  runPhase: RunPhase;
}): { budget: number; multiplier: number } {
  const baseBudget = clamp(Math.trunc(params.baseBudget), 24, RUN_TOTAL_TICKS);

  const regimeMult = REGIME_MULTIPLIERS[params.regime] ?? 1.0;
  const pulseMult = EXIT_PULSE_MULTIPLIERS[params.regime] ?? 1.0;

  const pressureW = PRESSURE_WEIGHTS[params.pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[params.runPhase] ?? 1.0;

  // Harshness: smaller is harsher (less time). This intentionally:
  // - shrinks in CRISIS/BEAR (regimeMult/pulseMult lower)
  // - shrinks under higher pressure and later phases (divide by weights)
  const multiplier = clamp(
    params.harsherFactor * regimeMult * pulseMult * (1 / pressureW) * (1 / phaseW),
    0.15,
    0.95,
  );

  const budget = clamp(Math.trunc(baseBudget * multiplier), 24, RUN_TOTAL_TICKS);
  return { budget, multiplier };
}

function computeSplitTimes(params: { tickBudget: number; seed: string; explicit?: number[]; splitCount: number }): number[] {
  const budget = clamp(Math.trunc(params.tickBudget), 24, RUN_TOTAL_TICKS);

  const explicit = Array.isArray(params.explicit) ? params.explicit.map(n => toFiniteInt(n, 0)) : [];
  const cleaned = explicit
    .map(t => clamp(t, 1, budget))
    .filter(t => Number.isFinite(t))
    .sort((a, b) => a - b);

  // If explicit splits provided, use them (dedupe).
  if (cleaned.length) {
    const out: number[] = [];
    let last = -1;
    for (const t of cleaned) {
      if (t === last) continue;
      last = t;
      out.push(t);
    }
    return out;
  }

  const count = clamp(Math.trunc(params.splitCount), 1, 8);
  const splits: number[] = [];

  for (let i = 1; i <= count; i++) {
    // deterministic micro-jitter to avoid perfectly uniform splits across variant seeds,
    // but still bounded and monotonic.
    const jitter = seededIndex(params.seed + ':split', i, 3) - 1; // -1..+1
    const raw = Math.round((i / count) * budget) + jitter;
    splits.push(clamp(raw, 1, budget));
  }

  splits.sort((a, b) => a - b);
  const out: number[] = [];
  let last = -1;
  for (const t of splits) {
    if (t === last) continue;
    last = t;
    out.push(t);
  }
  return out;
}

function getNumber(obj: Record<string, unknown> | undefined, key: string, fallback: number): number {
  if (!obj) return fallback;
  return toFiniteInt(obj[key], fallback);
}

function getBool(obj: Record<string, unknown> | undefined, key: string, fallback: boolean): boolean {
  if (!obj) return fallback;
  const v = obj[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return fallback;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * speedrunModeEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function speedrunModeEngine(input: M124Input, emit: MechanicEmitter): M124Output {
  const speedrunConfig: SpeedrunConfig = input.speedrunConfig ?? {};
  const timerConfig = input.timerConfig;

  // Tick comes from timerConfig (router-provided) with a deterministic fallback.
  const tick = clamp(getNumber(timerConfig, 'tick', 0), 0, RUN_TOTAL_TICKS);

  const seedSalt = asNonEmptyString(speedrunConfig.seedSalt) || 'speedrun';
  const runSeed =
    asNonEmptyString(input.runSeed) ||
    computeHash(`M124:${seedSalt}:${computeHash(JSON.stringify(speedrunConfig))}:${computeHash(JSON.stringify(timerConfig ?? {}))}`);

  // Macro fabric + chaos windows (deterministic by seed).
  const macroSchedule = buildMacroSchedule(runSeed + ':macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runSeed + ':chaos', CHAOS_WINDOWS_PER_RUN);

  const runPhase = deriveRunPhase(tick);
  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const chaos = inChaosWindow(tick, chaosWindows);

  const pressureTier = derivePressureTier(runPhase, macroRegime, chaos);
  const tickTier = deriveTickTier(pressureTier);

  const decayRate = computeDecayRate(macroRegime, M124_BOUNDS.BASE_DECAY_RATE);

  // Timer harshness calculation (harsher than standard).
  const baseBudget = clamp(
    toFiniteInt(speedrunConfig.baseTickBudget, getNumber(timerConfig, 'baseTickBudget', RUN_TOTAL_TICKS)),
    24,
    RUN_TOTAL_TICKS,
  );

  const harsherFactor = clamp(
    typeof speedrunConfig.harsherFactor === 'number' ? speedrunConfig.harsherFactor : 0.75,
    0.15,
    0.95,
  );

  const { budget: tickBudget, multiplier: harshnessMultiplier } = computeSpeedrunBudget({
    baseBudget,
    harsherFactor,
    regime: macroRegime,
    pressureTier,
    runPhase,
  });

  const completed = getBool(timerConfig, 'completed', tick >= tickBudget);
  const tickRemaining = clamp(tickBudget - tick, 0, tickBudget);

  // Deterministic deck + opportunity hints (UI-only, never authoritative).
  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, runSeed + ':deck');
  const deckHintTop = deckOrder[0] ?? DEFAULT_CARD.id;

  const opportunityHint =
    OPPORTUNITY_POOL[seededIndex(runSeed + ':opp', tick, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(runSeed + ':pool', pressureW * phaseW, regimeW);
  const weightedPoolPreviewIds = weightedPool.map(c => c.id);

  const runId =
    asNonEmptyString(getBool(timerConfig, 'useProvidedRunId', false) ? (timerConfig?.runId as unknown) : '') ||
    computeHash(`M124:run:${runSeed}:${asNonEmptyString(speedrunConfig.rulesetId) || 'default'}`);

  // Splits: either explicit or derived.
  const splitCount = clamp(toFiniteInt(speedrunConfig.splitCount, 3), 1, 8);
  const splitTimes = computeSplitTimes({
    tickBudget,
    seed: runSeed + ':' + seedSalt,
    explicit: speedrunConfig.splitTicks,
    splitCount,
  });

  // PB logic (bounded; no persistence here—caller stores PB).
  const configuredPB = toFiniteInt(speedrunConfig.personalBest, 0);
  const existingPB = clamp(getNumber(timerConfig, 'personalBest', configuredPB), 0, 10_000_000);
  const finalTime = clamp(getNumber(timerConfig, 'finalTime', tick), 0, 10_000_000);

  const pbImproved = completed && (existingPB === 0 || finalTime < existingPB);
  const personalBest = pbImproved ? finalTime : existingPB;

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M124',
      runId,
      runSeed,
      tick,
      tickBudget,
      tickRemaining,
      started: tick === 0,
      completed,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decayRate,
      harshnessMultiplier,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      weightedPoolPreviewIds,
      splitTimes,
      personalBest,
    }),
  );

  const speedrunState: SpeedrunState = {
    mechanicId: 'M124',
    runId,
    runSeed,
    tick,
    tickBudget,
    tickRemaining,
    started: tick === 0,
    completed,
    macroSchedule,
    chaosWindows,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    decayRate,
    harshnessMultiplier,
    deckHintTop,
    opportunityHintId: opportunityHint.id,
    weightedPoolPreviewIds,
    auditHash,
  };

  // ── Telemetry emission (bounded, deterministic) ─────────────────────────

  if (tick === 0) {
    emit({
      event: 'SPEEDRUN_STARTED',
      mechanic_id: 'M124',
      tick,
      runId,
      payload: {
        runSeed,
        rulesetId: asNonEmptyString(speedrunConfig.rulesetId) || 'default',
        tickBudget,
        harshnessMultiplier,
        macroRegime,
        runPhase,
        pressureTier,
        tickTier,
        decayRate,
        deckHintTop,
        opportunityHintId: opportunityHint.id,
        auditHash,
      },
    });
  }

  // Split recorded when tick exactly matches a split marker.
  const splitIndex = splitTimes.indexOf(tick);
  if (splitIndex >= 0) {
    emit({
      event: 'SPLIT_RECORDED',
      mechanic_id: 'M124',
      tick,
      runId,
      payload: {
        splitIndex,
        splitTick: tick,
        splitBudget: tickBudget,
        tickRemaining,
        macroRegime,
        pressureTier,
        auditHash,
      },
    });
  }

  if (pbImproved) {
    emit({
      event: 'PERSONAL_BEST_SET',
      mechanic_id: 'M124',
      tick,
      runId,
      payload: {
        personalBest,
        finalTime,
        priorBest: existingPB,
        macroRegime,
        pressureTier,
        auditHash,
      },
    });
  }

  return {
    speedrunState,
    splitTimes,
    personalBest,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M124MLInput {
  speedrunState?: SpeedrunState;
  splitTimes?: number[];
  personalBest?: number;
  runId: string;
  tick: number;
}

export interface M124MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * speedrunModeEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function speedrunModeEngineMLCompanion(input: M124MLInput): Promise<M124MLOutput> {
  const tick = clamp(toFiniteInt(input.tick, 0), 0, RUN_TOTAL_TICKS);

  const st = input.speedrunState;
  const macroRegime: MacroRegime = (st?.macroRegime ?? 'NEUTRAL') as MacroRegime;
  const pressureTier: PressureTier = (st?.pressureTier ?? 'MEDIUM') as PressureTier;

  const decay = computeDecayRate(macroRegime, M124_BOUNDS.BASE_DECAY_RATE);
  const pulseMult = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const pb = clamp(toFiniteInt(input.personalBest, 0), 0, 10_000_000);
  const budget = clamp(toFiniteInt(st?.tickBudget, RUN_TOTAL_TICKS), 24, RUN_TOTAL_TICKS);

  // Lower PB is better; normalize against budget.
  const pbNorm = pb > 0 ? clamp(1 - pb / Math.max(1, budget), 0, 1) : 0.05;

  // Pressure tiers increase “difficulty”; reward higher score for surviving harsher tiers.
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const difficultyBonus = clamp((pressureW - 0.8) / 0.8, 0, 1) * 0.15;

  const stability = clamp((pulseMult + regimeMult) / 2, 0.35, 1.25);
  const score = clamp((0.20 + pbNorm * 0.70 + difficultyBonus) * stability * (1 - decay * 0.25), 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(pb > 0 ? `PB vs budget: ${Math.round(pbNorm * 100)}%` : 'No PB provided');
  topFactors.push(`Regime: ${macroRegime}`);
  topFactors.push(`Pressure: ${pressureTier}`);
  topFactors.push(`Decay: ${decay.toFixed(2)}`);
  topFactors.push(`Stability: ${stability.toFixed(2)}`);

  const recommendation =
    score >= 0.85
      ? 'Maintain current route; focus on eliminating hesitation at split boundaries.'
      : score >= 0.55
        ? 'Improve split discipline: pre-plan actions for each segment and avoid chaos windows.'
        : 'Treat as a scouting run: learn schedule/chaos timing, then rerun for clean splits.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + `:ml:M124:${macroRegime}:${pressureTier}:${tick}`),
    confidenceDecay: clamp(0.05 + decay * 0.30, 0.01, 0.50),
  };
}