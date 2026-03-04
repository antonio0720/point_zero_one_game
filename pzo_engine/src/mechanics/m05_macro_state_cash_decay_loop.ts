// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m05_macro_state_cash_decay_loop.ts
//
// Mechanic : M05 — Macro State + Cash Decay Loop
// Family   : run_core   Layer: tick_engine   Priority: 1   Batch: 1
// ML Pair  : m05a
// Deps     : M02
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

// ── Import Anchors (keep every import “accessible” + used) ─────────────────────

/**
 * Runtime access to the exact mechanicsUtils symbols bound to M05.
 * Exported so router/debug UI/tests can introspect what M05 is wired to.
 */
export const M05_IMPORTED_SYMBOLS = {
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
 * Type-only anchor to keep every imported domain type referenced in-module.
 * Exported so TS does not flag it under noUnusedLocals.
 */
export type M05_ImportedTypesAnchor = {
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

export interface M05Input {
  stateMacroRegime?: MacroRegime;
  stateCash?: number;

  // Either provide explicit cashflow, or provide income/expenses to derive deterministically.
  stateCashflow?: number;
  stateIncome?: number;
  stateExpenses?: number;

  // Used for deterministic bounds/telemetry.
  stateTick?: number;
}

export interface M05Output {
  cashDelta: number;
  regimeShiftEvent: RegimeShiftEvent | null;
  decayRate: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M05Event =
  | 'MACRO_REGIME_SHIFT'
  | 'CASH_DECAY_APPLIED'
  | 'SETTLEMENT_TICK'
  | 'CASHFLOW_UPDATED';

export interface M05TelemetryPayload extends MechanicTelemetryPayload {
  event: M05Event;
  mechanic_id: 'M05';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M05_BOUNDS = {
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

// ── Internal helpers (pure) ────────────────────────────────────────────────

function m05ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

function m05DeriveCashflow(input: M05Input): { cashflow: number; derived: boolean } {
  if (typeof input.stateCashflow === 'number') return { cashflow: input.stateCashflow, derived: false };

  const income = (input.stateIncome as number) ?? 0;
  const expenses = (input.stateExpenses as number) ?? 0;
  const cf = income - expenses;

  return { cashflow: cf, derived: true };
}

function m05ProposedRegime(current: MacroRegime, cashDelta: number): MacroRegime {
  const thr = M05_BOUNDS.REGIME_SHIFT_THRESHOLD;

  if (cashDelta <= -2 * thr) return 'CRISIS';
  if (cashDelta <= -thr) return 'BEAR';
  if (cashDelta >= thr) return 'BULL';

  // Mean-revert toward NEUTRAL when no strong impulse
  return current === 'CRISIS' || current === 'BEAR' || current === 'BULL' ? 'NEUTRAL' : 'NEUTRAL';
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * macroStateCashDecay
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function macroStateCashDecay(input: M05Input, emit: MechanicEmitter): M05Output {
  const cash = (input.stateCash as number) ?? 0;
  const macroRegime = (input.stateMacroRegime as MacroRegime) ?? 'NEUTRAL';
  const currentTick = (input.stateTick as number) ?? 0;

  const { cashflow, derived } = m05DeriveCashflow(input);

  if (derived) {
    emit({
      event: 'CASHFLOW_UPDATED',
      mechanic_id: 'M05',
      tick: currentTick,
      runId: '',
      payload: {
        derived: true,
        income: (input.stateIncome as number) ?? 0,
        expenses: (input.stateExpenses as number) ?? 0,
        cashflow,
      },
    });
  } else {
    emit({
      event: 'CASHFLOW_UPDATED',
      mechanic_id: 'M05',
      tick: currentTick,
      runId: '',
      payload: {
        derived: false,
        cashflow,
      },
    });
  }

  const decayRate = computeDecayRate(macroRegime, M05_BOUNDS.BASE_DECAY_RATE);

  // Cash delta is bounded (design-law: bounded chaos)
  const rawDelta = cashflow * decayRate;
  const cashDelta = clamp(rawDelta, M05_BOUNDS.MIN_CASH_DELTA, M05_BOUNDS.MAX_CASH_DELTA);

  const nextCash = cash + cashDelta;

  emit({
    event: 'SETTLEMENT_TICK',
    mechanic_id: 'M05',
    tick: currentTick,
    runId: '',
    payload: {
      macroRegime,
      cash,
      cashflow,
      decayRate,
      rawDelta,
      cashDelta,
      nextCash,
    },
  });

  emit({
    event: 'CASH_DECAY_APPLIED',
    mechanic_id: 'M05',
    tick: currentTick,
    runId: '',
    payload: {
      macroRegime,
      decayRate,
      cashDelta,
      exitPulse: EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0,
      regimeMultiplier: REGIME_MULTIPLIERS[macroRegime] ?? 1.0,
    },
  });

  const proposed = m05ProposedRegime(macroRegime, cashDelta);
  const regimeShiftEvent: RegimeShiftEvent | null =
    proposed !== macroRegime ? { previousRegime: macroRegime, newRegime: proposed } : null;

  if (regimeShiftEvent) {
    emit({
      event: 'MACRO_REGIME_SHIFT',
      mechanic_id: 'M05',
      tick: currentTick,
      runId: '',
      payload: {
        previousRegime: regimeShiftEvent.previousRegime,
        newRegime: regimeShiftEvent.newRegime,
        cashDelta,
        threshold: M05_BOUNDS.REGIME_SHIFT_THRESHOLD,
      },
    });
  }

  return {
    cashDelta,
    regimeShiftEvent,
    decayRate,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M05MLInput {
  cashDelta?: number;
  regimeShiftEvent?: RegimeShiftEvent | null;
  decayRate?: number;
  runId: string;
  tick: number;
}

export interface M05MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

type M05MacroContext = {
  seed: string;
  tick: number;

  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tickTier: TickTier;

  phaseWeight: number;
  regimeWeight: number;
  pressureWeight: number;

  regimeMultiplier: number;
  exitPulse: number;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  // Demonstrates deterministic deck/pool access for advisory only
  deckOrder: string[];
  opportunityPick: GameCard;
  weightedPick: GameCard;

  decayRate: number;
  auditCore: string;
};

function m05DerivePhase(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m05RegimeFromSchedule(tick: number, schedule: MacroEvent[]): MacroRegime {
  let r: MacroRegime = 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function m05TickIsInChaos(tick: number, chaos: ChaosWindow[]): boolean {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m05DerivePressure(tick: number, phase: RunPhase, chaos: ChaosWindow[]): PressureTier {
  if (m05TickIsInChaos(tick, chaos)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m05DeriveTickTier(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m05BuildMacroContext(runId: string, tick: number, decayRateHint?: number): M05MacroContext {
  const t = m05ClampTick(tick);
  const seed = computeHash(`${runId}:M05:${t}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m05DerivePhase(t);
  const regime = m05RegimeFromSchedule(t, macroSchedule);
  const pressure = m05DerivePressure(t, phase, chaosWindows);
  const tickTier = m05DeriveTickTier(pressure);

  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = typeof decayRateHint === 'number' ? decayRateHint : computeDecayRate(regime, M05_BOUNDS.BASE_DECAY_RATE);

  // Demonstrate deterministic deck order + pool selection (advisory only)
  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, seed);
  const oppIdx = seededIndex(seed, t + 17, OPPORTUNITY_POOL.length);
  const opportunityPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const pressurePhase = clamp(pressureWeight * phaseWeight, 0.1, 10);
  const pool = buildWeightedPool(seed + ':pool', pressurePhase, regimeWeight);
  const poolIdx = seededIndex(seed, t + 33, Math.max(1, pool.length));
  const weightedPick = pool[poolIdx] ?? opportunityPick ?? DEFAULT_CARD;

  const auditCore = computeHash(
    JSON.stringify({
      seed,
      t,
      phase,
      regime,
      pressure,
      tickTier,
      phaseWeight,
      regimeWeight,
      pressureWeight,
      regimeMultiplier,
      exitPulse,
      decayRate,
      macroSchedule,
      chaosWindows,
      deckOrderTop: deckOrder[0] ?? null,
      opportunityId: opportunityPick.id,
      weightedPickId: weightedPick.id,
    }),
  );

  return {
    seed,
    tick: t,
    phase,
    regime,
    pressure,
    tickTier,
    phaseWeight,
    regimeWeight,
    pressureWeight,
    regimeMultiplier,
    exitPulse,
    macroSchedule,
    chaosWindows,
    deckOrder,
    opportunityPick,
    weightedPick,
    decayRate,
    auditCore,
  };
}

/**
 * macroStateCashDecayMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function macroStateCashDecayMLCompanion(input: M05MLInput): Promise<M05MLOutput> {
  const ctx = m05BuildMacroContext(input.runId, input.tick, input.decayRate);

  const cashDelta = typeof input.cashDelta === 'number' ? input.cashDelta : 0;
  const deltaNorm = clamp(Math.abs(cashDelta) / Math.max(1, M05_BOUNDS.MAX_CASH_DELTA), 0, 1);

  // Regime instability lowers advisory confidence.
  const regimeShifted = Boolean(input.regimeShiftEvent);
  const shiftPenalty = regimeShifted ? 0.18 : 0.0;

  // Pressure & chaos penalize confidence.
  const pressurePenalty = clamp((ctx.pressureWeight - 0.8) * 0.22, 0, 0.25);
  const deltaPenalty = deltaNorm * 0.22;

  const base = 0.94 - shiftPenalty - pressurePenalty - deltaPenalty;
  const score = clamp(base, 0.01, 0.99);

  const topFactors = [
    `tick=${ctx.tick + 1}/${RUN_TOTAL_TICKS} phase=${ctx.phase} tier=${ctx.tickTier}`,
    `regime=${ctx.regime} mult=${ctx.regimeMultiplier.toFixed(2)} exitPulse=${ctx.exitPulse.toFixed(2)}`,
    `decayRate=${ctx.decayRate.toFixed(4)} cashDelta=${cashDelta.toFixed(2)} shift=${String(regimeShifted)}`,
    `pick=${ctx.weightedPick.id} opp=${ctx.opportunityPick.id} deckTop=${ctx.deckOrder[0] ?? 'n/a'}`,
    `weights: p=${ctx.pressureWeight.toFixed(2)} ph=${ctx.phaseWeight.toFixed(2)} r=${ctx.regimeWeight.toFixed(2)}`,
  ].slice(0, 5);

  const recommendation = regimeShifted
    ? `Macro shift detected: treat "${ctx.weightedPick.name}" as stabilization; reduce variance until the new regime settles.`
    : ctx.pressure === 'CRITICAL'
      ? `Macro stress: keep moves liquid; prefer "${ctx.weightedPick.name}" and avoid commitments that increase burn.`
      : `Macro stable: optimize runway—compare "${ctx.weightedPick.name}" vs "${ctx.opportunityPick.name}" and execute best cashflow delta.`;

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(
      ctx.auditCore +
        ':ml:M05:' +
        JSON.stringify({
          cashDelta: input.cashDelta ?? null,
          regimeShiftEvent: input.regimeShiftEvent ?? null,
          decayRate: input.decayRate ?? null,
        }),
    ),
    confidenceDecay: ctx.decayRate,
  };
}