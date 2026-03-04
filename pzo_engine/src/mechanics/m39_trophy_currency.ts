// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m39_trophy_currency.ts
//
// Mechanic : M39 — Trophy Currency
// Family   : achievement_engine   Layer: season_runtime   Priority: 2   Batch: 2
// ML Pair  : m39a
// Deps     : M36, M50
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

export const M39_IMPORTED_SYMBOLS = {
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

export type M39_ImportedTypesAnchor = {
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

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M39Input {
  /**
   * Completed run snapshot (authoritative).
   */
  completedRun?: CompletedRun;

  /**
   * Optional cord score override (if upstream already extracted/validated it).
   * If omitted, uses completedRun.cordScore.
   */
  cordScore?: number;

  /**
   * Optional tick override for where trophy is calculated (defaults to completedRun.ticks-1).
   */
  tick?: number;

  /**
   * Optional previous trophy balance (authoritative from season wallet).
   * If omitted, assumed 0 for pure stateless callers.
   */
  trophyBalanceBefore?: number;

  /**
   * Optional proof artifact to bind issuance to a verifiable token.
   */
  proofCard?: ProofCard | null;
}

export interface M39Output {
  trophyCurrencyEarned: number;
  trophyBalance: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M39Event = 'TROPHY_EARNED' | 'TROPHY_BALANCE_UPDATED' | 'TROPHY_DECAY_APPLIED';

export interface M39TelemetryPayload extends MechanicTelemetryPayload {
  event: M39Event;
  mechanic_id: 'M39';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M39_BOUNDS = {
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

// ── Internal helpers (deterministic, bounded) ───────────────────────────────

function m39DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m39InChaosWindow(tick: number, chaosWindows: ChaosWindow[]): boolean {
  for (const w of chaosWindows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m39RegimeAtTick(tick: number, schedule: MacroEvent[]): MacroRegime {
  if (!schedule || schedule.length === 0) return 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);

  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m39PressureTier(tick: number, phase: RunPhase, chaos: ChaosWindow[]): PressureTier {
  if (m39InChaosWindow(tick, chaos)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m39NormalizeCordScore(raw: number): number {
  const v = Math.max(0, Number.isFinite(raw) ? raw : 0);

  // Robust normalization across unknown scoring ranges.
  // 0..100   => /100
  // 0..1000  => /1000
  // 0..10000 => /10000
  let denom = 100;
  if (v > 100) denom = 1000;
  if (v > 1000) denom = 10000;

  return clamp(v / denom, 0, 1);
}

type M39Context = {
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

  deckIds: string[];
  oppPick: GameCard;
  poolPick: GameCard;

  pulseFrac: number;
  bonusWindow: boolean;

  trophyToken: string;
};

function m39BuildContext(input: M39Input): M39Context {
  const runId = String(input.completedRun?.runId ?? computeHash(JSON.stringify(input)));

  const tickIn =
    input.tick ??
    (typeof input.completedRun?.ticks === 'number' && Number.isFinite(input.completedRun.ticks)
      ? input.completedRun.ticks - 1
      : RUN_TOTAL_TICKS - 1);

  const tick = clamp(Number(tickIn), 0, RUN_TOTAL_TICKS - 1);
  const seed = computeHash(`${runId}:M39:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m39DerivePhase(tick);
  const regime = m39RegimeAtTick(tick, macroSchedule);
  const pressure = m39PressureTier(tick, phase, chaosWindows);
  const inChaos = m39InChaosWindow(tick, chaosWindows);

  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M39_BOUNDS.BASE_DECAY_RATE);

  const deckIds = seededShuffle(DEFAULT_CARD_IDS, seed);

  const oppIdx = seededIndex(seed, tick + 17, OPPORTUNITY_POOL.length);
  const oppPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const pool = buildWeightedPool(seed + ':trophy', pressureWeight * phaseWeight, regimeWeight);
  const poolIdx = seededIndex(seed, tick + 33, Math.max(1, pool.length));
  const poolPick = pool[poolIdx] ?? oppPick ?? DEFAULT_CARD;

  const pulseFrac = clamp((tick % M39_BOUNDS.PULSE_CYCLE) / M39_BOUNDS.PULSE_CYCLE, 0, 1);
  const bonusWindow = !inChaos && pulseFrac <= 0.25;

  const trophyToken = computeHash(
    JSON.stringify({
      mid: 'M39',
      runId,
      tick,
      regime,
      phase,
      pressure,
      poolPick: poolPick.id,
      deckTop: deckIds[0] ?? '',
      proofHash: input.proofCard?.hash ?? '',
    }),
  );

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
    deckIds,
    oppPick,
    poolPick,
    pulseFrac,
    bonusWindow,
    trophyToken,
  };
}

function m39ComputeEarned(ctx: M39Context, cordScoreRaw: number, outcome: string): number {
  const cordNorm = m39NormalizeCordScore(cordScoreRaw);

  // Environment shaping
  const envMult = clamp(ctx.regimeMultiplier * ctx.exitPulse, 0.25, 2.25);

  // Difficulty shaping (pressure/phase/regime weights)
  const diff = clamp(ctx.pressureWeight * ctx.phaseWeight * ctx.regimeWeight, 0.45, 2.75);

  // Decay dampener: higher decay => slightly reduced mint (keeps economy stable)
  const decayDampen = clamp(1 - ctx.decayRate, 0.15, 0.99);

  // Outcome seasoning (deterministic)
  const outcomeSalt = parseInt(computeHash(outcome || 'UNKNOWN'), 16) % 1000; // 0..999
  const outcomeBoost = clamp(outcomeSalt / 999, 0, 1) * 0.08; // 0..0.08

  // Bonus window boost (clean pulse, non-chaos)
  const windowBoost = ctx.bonusWindow ? 0.10 : 0.0;

  // Card-based micro-boost (bounded)
  const cost = Number(ctx.poolPick.cost ?? 0);
  const costNorm = clamp(cost / 50_000, 0, 1); // 0..1
  const cardBoost = costNorm * 0.06; // 0..0.06

  // Deterministic dither to avoid tie clusters (bounded)
  const dither = (seededIndex(ctx.seed + ':dither', ctx.tick + 7, 500) / 500) * 0.02; // 0..0.02

  const strength = clamp(0.62 + outcomeBoost + windowBoost + cardBoost + dither, 0.5, 0.85);

  const raw = cordNorm * M39_BOUNDS.MAX_AMOUNT * strength * envMult * diff * decayDampen;

  return Math.round(clamp(raw, 0, M39_BOUNDS.MAX_AMOUNT));
}

function m39ComputeDecay(ctx: M39Context, balanceBefore: number): number {
  const before = clamp(Math.floor(balanceBefore), 0, M39_BOUNDS.MAX_PROCEEDS);

  // Apply a bounded, economy-safe decay on stored trophy currency.
  // Uses computeDecayRate(regime) but scaled down to avoid punishing normal holders.
  const scaledRate = clamp(ctx.decayRate * 0.35, 0.0025, 0.20);
  const raw = Math.floor(before * scaledRate);

  // Never decay below 0; never decay more than 15% at once
  return clamp(raw, 0, Math.floor(before * 0.15));
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * trophyCurrencyEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function trophyCurrencyEngine(input: M39Input, emit: MechanicEmitter): M39Output {
  const completedRun = input.completedRun;

  const ctx = m39BuildContext(input);

  const cordScore =
    (typeof input.cordScore === 'number' && Number.isFinite(input.cordScore) ? input.cordScore : undefined) ??
    (typeof completedRun?.cordScore === 'number' && Number.isFinite(completedRun.cordScore) ? completedRun.cordScore : 0);

  const outcome = String(completedRun?.outcome ?? 'UNKNOWN');

  const balanceBefore =
    typeof input.trophyBalanceBefore === 'number' && Number.isFinite(input.trophyBalanceBefore)
      ? input.trophyBalanceBefore
      : 0;

  const decayApplied = m39ComputeDecay(ctx, balanceBefore);
  const earned = m39ComputeEarned(ctx, cordScore, outcome);

  const after = clamp(Math.floor(balanceBefore) - decayApplied + earned, 0, M39_BOUNDS.MAX_PROCEEDS);

  if (decayApplied > 0) {
    emit({
      event: 'TROPHY_DECAY_APPLIED',
      mechanic_id: 'M39',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        trophyToken: ctx.trophyToken,
        before: Math.floor(balanceBefore),
        decayApplied,
        decayRate: Number(ctx.decayRate.toFixed(6)),
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        inChaos: ctx.inChaos,
      },
    } as M39TelemetryPayload);
  }

  emit({
    event: 'TROPHY_EARNED',
    mechanic_id: 'M39',
    tick: ctx.tick,
    runId: ctx.runId,
    payload: {
      trophyToken: ctx.trophyToken,
      earned,
      cordScore,
      outcome,
      env: {
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        inChaos: ctx.inChaos,
        bonusWindow: ctx.bonusWindow,
        pulseFrac: Number(ctx.pulseFrac.toFixed(4)),
        regimeMultiplier: Number(ctx.regimeMultiplier.toFixed(4)),
        exitPulse: Number(ctx.exitPulse.toFixed(4)),
        decayRate: Number(ctx.decayRate.toFixed(6)),
      },
      picks: {
        opp: { id: ctx.oppPick.id, name: ctx.oppPick.name },
        pool: { id: ctx.poolPick.id, name: ctx.poolPick.name },
        deckTop: ctx.deckIds[0] ?? '',
      },
      proof: {
        proofHash: input.proofCard?.hash ?? '',
        proofGrade: input.proofCard?.grade ?? '',
      },
    },
  } as M39TelemetryPayload);

  emit({
    event: 'TROPHY_BALANCE_UPDATED',
    mechanic_id: 'M39',
    tick: ctx.tick,
    runId: ctx.runId,
    payload: {
      trophyToken: ctx.trophyToken,
      before: Math.floor(balanceBefore),
      decayApplied,
      earned,
      after,
    },
  } as M39TelemetryPayload);

  return {
    trophyCurrencyEarned: earned,
    trophyBalance: after,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M39MLInput {
  trophyCurrencyEarned?: number;
  trophyBalance?: number;
  runId: string;
  tick: number;
}

export interface M39MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (djb2 here)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * trophyCurrencyEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function trophyCurrencyEngineMLCompanion(input: M39MLInput): Promise<M39MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? '');
  const seed = computeHash(`${runId}:M39:ml:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m39DerivePhase(tick);
  const regime = m39RegimeAtTick(tick, macroSchedule);
  const pressure = m39PressureTier(tick, phase, chaosWindows);
  const inChaos = m39InChaosWindow(tick, chaosWindows);

  const decay = computeDecayRate(regime, M39_BOUNDS.BASE_DECAY_RATE);

  const earned = Math.max(0, Math.floor(Number(input.trophyCurrencyEarned ?? 0)));
  const balance = Math.max(0, Math.floor(Number(input.trophyBalance ?? 0)));

  const earnedNorm = clamp(earned / M39_BOUNDS.MAX_AMOUNT, 0, 1);
  const balNorm = clamp(balance / M39_BOUNDS.MAX_PROCEEDS, 0, 1);

  const chaosPenalty = inChaos ? 0.10 : 0.0;
  const envBoost = clamp((REGIME_MULTIPLIERS[regime] ?? 1.0) * (EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0), 0.3, 2.0) / 2.0;

  const score = clamp(0.20 + earnedNorm * 0.55 + balNorm * 0.25 + envBoost * 0.15 - chaosPenalty, 0.01, 0.99);

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS} phase=${phase}`,
    `regime=${regime} pressure=${pressure} chaos=${inChaos ? 'Y' : 'N'}`,
    `earned=${earned} (${earnedNorm.toFixed(2)}) balance=${balance} (${balNorm.toFixed(2)})`,
    `decay=${decay.toFixed(3)} envMult=${((REGIME_MULTIPLIERS[regime] ?? 1.0) * (EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0)).toFixed(2)}`,
    `weights p=${(PRESSURE_WEIGHTS[pressure] ?? 1.0).toFixed(2)} ph=${(PHASE_WEIGHTS[phase] ?? 1.0).toFixed(2)} r=${(REGIME_WEIGHTS[regime] ?? 1.0).toFixed(2)}`,
  ].slice(0, 5);

  const recommendation =
    earned <= 0
      ? 'No trophy earned: push CORD score and finish runs outside chaos windows to raise trophy yield.'
      : earnedNorm >= 0.70
        ? 'Strong trophy yield: bank it or route into cosmetic progression without risking streak disruption.'
        : 'Moderate trophy yield: improve end-of-run execution timing and aim for clean pulse windows to increase payout.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M39', ...input }) + ':ml:M39'),
    confidenceDecay: decay,
  };
}