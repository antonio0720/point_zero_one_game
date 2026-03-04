// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m02_12_minute_run_clock_turn_timer.ts
//
// Mechanic : M02 — 12-Minute Run Clock + Turn Timer
// Family   : run_core   Layer: tick_engine   Priority: 1   Batch: 1
// ML Pair  : m02a
// Deps     : M01
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

// ── Import Anchors (keep every import "accessible" + used) ────────────────────

/**
 * Runtime access to the canonical mechanicsUtils symbols imported by this mechanic.
 * (Useful for debugging, inspection, and keeping generator-wide imports “live”.)
 */
export const M02_IMPORTED_SYMBOLS = {
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
 * Type-only anchor to ensure every imported domain type remains referenced in-module.
 */
export type M02_ImportedTypesAnchor = {
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

export interface M02Input {
  stateTick?: number;
  stateRunPhase?: RunPhase;
  stateTickTier?: TickTier;
}

export interface M02Output {
  tickResult: TickResult;
  phaseTransitionEvent: PhaseTransitionEvent | null;
  timerExpiredEvent: TimerExpiredEvent | null;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M02Event =
  | 'TICK_COMPLETE'
  | 'PHASE_TRANSITION'
  | 'TIMER_EXPIRED'
  | 'CLOCK_ESCALATION';

export interface M02TelemetryPayload extends MechanicTelemetryPayload {
  event: M02Event;
  mechanic_id: 'M02';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M02_BOUNDS = {
  BASE_AMOUNT: 1_000,
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

// ── Internal helpers (no state mutation) ────────────────────────────────────

function m02DerivePhaseFromProgress(progress: number): RunPhase {
  return progress < 0.33 ? 'EARLY' : progress < 0.66 ? 'MID' : 'LATE';
}

function m02InChaosWindow(tick: number, chaosWindows: ChaosWindow[]): boolean {
  for (const w of chaosWindows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m02DerivePressureTier(tick: number, runPhase: RunPhase, chaosWindows: ChaosWindow[]): PressureTier {
  if (m02InChaosWindow(tick, chaosWindows)) return 'CRITICAL';
  if (runPhase === 'EARLY') return 'LOW';
  if (runPhase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m02DeriveTickTier(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m02DeriveRegimeFromSchedule(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  // Default regime is stable + explicit (matches mechanicsUtils regime universe)
  let regime: MacroRegime = 'NEUTRAL';

  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }

  return regime;
}

type M02ClockIntelContext = {
  seed: string;
  tick: number;
  progress: number;

  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tickTier: TickTier;

  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;

  regimeMultiplier: number;
  exitPulse: number;
  decayRate: number;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  deckShuffle: string[];
  opportunityPick: GameCard;
  weightedPoolPick: GameCard;

  auditCore: string;
};

function m02BuildClockIntelContext(runId: string, tick: number): M02ClockIntelContext {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);

  // Seed is deterministic and local to M02 while still anchored to the runId
  const seed = computeHash(`${runId}:M02:${t}`);

  // Use the canonical M01 schedule primitives here for deterministic advisory context
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const progress = clamp((t + 1) / RUN_TOTAL_TICKS, 0, 1);
  const phase = m02DerivePhaseFromProgress(progress);

  const regime = m02DeriveRegimeFromSchedule(t, macroSchedule);
  const pressure = m02DerivePressureTier(t, phase, chaosWindows);
  const tickTier = m02DeriveTickTier(pressure);

  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decayRate = computeDecayRate(regime, M02_BOUNDS.BASE_DECAY_RATE);

  // Explicitly use seededShuffle + DEFAULT_CARD_IDS (even though buildWeightedPool also uses shuffle internally)
  const deckShuffle = seededShuffle(DEFAULT_CARD_IDS, seed);

  // Use seededIndex + OPPORTUNITY_POOL + DEFAULT_CARD
  const oppIdx = seededIndex(seed, t + 17, OPPORTUNITY_POOL.length);
  const opportunityPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  // Use buildWeightedPool to compute a weighted slice based on current conditions
  const pool = buildWeightedPool(seed + ':pool', pressureWeight * phaseWeight, regimeWeight);
  const poolIdx = seededIndex(seed, t + 33, Math.max(1, pool.length));
  const weightedPoolPick = pool[poolIdx] ?? opportunityPick ?? DEFAULT_CARD;

  const auditCore = computeHash(
    JSON.stringify({
      seed,
      tick: t,
      progress,
      phase,
      regime,
      pressure,
      tickTier,
      pressureWeight,
      phaseWeight,
      regimeWeight,
      regimeMultiplier,
      exitPulse,
      decayRate,
      deckShuffle,
      opportunityId: opportunityPick.id,
      weightedPoolPickId: weightedPoolPick.id,
      macroSchedule,
      chaosWindows,
    }),
  );

  return {
    seed,
    tick: t,
    progress,
    phase,
    regime,
    pressure,
    tickTier,
    pressureWeight,
    phaseWeight,
    regimeWeight,
    regimeMultiplier,
    exitPulse,
    decayRate,
    macroSchedule,
    chaosWindows,
    deckShuffle,
    opportunityPick,
    weightedPoolPick,
    auditCore,
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * runClockTickEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function runClockTickEngine(
  input: M02Input,
  emit: MechanicEmitter,
): M02Output {
  const currentTick = (input.stateTick as number) ?? 0;
  const nextTick = currentTick + 1;

  const timerExpired = nextTick >= RUN_TOTAL_TICKS;

  const progress = clamp(nextTick / RUN_TOTAL_TICKS, 0, 1);
  const newPhase: RunPhase = m02DerivePhaseFromProgress(progress);

  const prevPhase: RunPhase = (input.stateRunPhase as RunPhase) ?? 'EARLY';
  const phaseChanged = newPhase !== prevPhase;

  // Make tick-tier “accessible” by driving it deterministically from clock progress,
  // without changing the TickResult contract.
  const macroSeed = computeHash(`M02:clock:${nextTick}`);
  const chaosWindows = buildChaosWindows(macroSeed, CHAOS_WINDOWS_PER_RUN);
  const pressureTier = m02DerivePressureTier(nextTick, newPhase, chaosWindows);
  const newTickTier: TickTier = m02DeriveTickTier(pressureTier);

  const prevTickTier: TickTier = (input.stateTickTier as TickTier) ?? 'STANDARD';
  const tickTierChanged = newTickTier !== prevTickTier;

  emit({
    event: 'TICK_COMPLETE',
    mechanic_id: 'M02',
    tick: nextTick,
    runId: '',
    payload: {
      nextTick,
      newPhase,
      timerExpired,
      progress,
      newTickTier,
      pressureTier,
    },
  });

  if (phaseChanged) {
    emit({
      event: 'PHASE_TRANSITION',
      mechanic_id: 'M02',
      tick: nextTick,
      runId: '',
      payload: { from: prevPhase, to: newPhase },
    });
  }

  if (tickTierChanged) {
    emit({
      event: 'CLOCK_ESCALATION',
      mechanic_id: 'M02',
      tick: nextTick,
      runId: '',
      payload: {
        from: prevTickTier,
        to: newTickTier,
        pressureTier,
      },
    });
  }

  if (timerExpired) {
    emit({
      event: 'TIMER_EXPIRED',
      mechanic_id: 'M02',
      tick: nextTick,
      runId: '',
      payload: { tick: nextTick },
    });
  }

  return {
    tickResult: { tick: nextTick, runPhase: newPhase, timerExpired },
    phaseTransitionEvent: phaseChanged ? { from: prevPhase, to: newPhase } : null,
    timerExpiredEvent: timerExpired ? { tick: nextTick } : null,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M02MLInput {
  tickResult?: TickResult;
  phaseTransitionEvent?: PhaseTransitionEvent | null;
  timerExpiredEvent?: TimerExpiredEvent | null;
  runId: string;
  tick: number;
}

export interface M02MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * runClockTickEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function runClockTickEngineMLCompanion(
  input: M02MLInput,
): Promise<M02MLOutput> {
  const ctx = m02BuildClockIntelContext(input.runId, input.tick);

  const ticksRemaining = Math.max(0, RUN_TOTAL_TICKS - (ctx.tick + 1));
  const urgency = clamp(1 - ticksRemaining / RUN_TOTAL_TICKS, 0, 1);

  // A clock mechanic’s advisory confidence decays faster under CRISIS + CRITICAL pressure.
  const pressureNorm = clamp((ctx.pressureWeight - 0.8) / (1.6 - 0.8), 0, 1);
  const regimeNorm = clamp((ctx.regimeWeight - 0.75) / (1.1 - 0.75), 0, 1);

  const score = clamp(
    0.95 - urgency * 0.25 - pressureNorm * 0.25 - (1 - regimeNorm) * 0.10,
    0.01,
    0.99,
  );

  const topFactors = [
    `tick=${ctx.tick + 1}/${RUN_TOTAL_TICKS} phase=${ctx.phase} tier=${ctx.tickTier}`,
    `regime=${ctx.regime} mult=${ctx.regimeMultiplier.toFixed(2)} exitPulse=${ctx.exitPulse.toFixed(2)}`,
    `pressure=${ctx.pressure} w=${ctx.pressureWeight.toFixed(2)} phaseW=${ctx.phaseWeight.toFixed(2)}`,
    `poolPick=${ctx.weightedPoolPick.id} (${ctx.weightedPoolPick.name})`,
    `deckTop=${ctx.deckShuffle[0] ?? 'n/a'} opp=${ctx.opportunityPick.id}`,
  ].slice(0, 5);

  const recommendation =
    ctx.tickTier === 'CRITICAL'
      ? 'Clock is critical: choose the fastest deterministic action; avoid complex auctions and reduce variance.'
      : ctx.tickTier === 'ELEVATED'
        ? 'Clock is elevated: prioritize short-cycle actions and protect downside during this phase.'
        : 'Clock is stable: take optimal-value actions and set up for the next phase transition.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(ctx.auditCore + ':ml:M02:' + JSON.stringify(input)),
    confidenceDecay: ctx.decayRate,
  };
}