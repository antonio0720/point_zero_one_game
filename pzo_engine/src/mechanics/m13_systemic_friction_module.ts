// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m13_systemic_friction_module.ts
//
// Mechanic : M13 — Systemic Friction Module
// Family   : chaos_engine   Layer: tick_engine   Priority: 1   Batch: 1
// ML Pair  : m13a
// Deps     : M05
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

export const M13_IMPORTED_SYMBOLS = {
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

export type M13_ImportedTypesAnchor = {
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

export interface M13Input {
  fateTick?: number;
  stateCash?: number;
  stateMacroRegime?: MacroRegime;
}

export interface M13Output {
  frictionExpenseEvent: Record<string, unknown>;
  cashDrained: number;
  frictionClass: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M13Event = 'SO_FRICTION_APPLIED' | 'CASH_DRAINED' | 'FRICTION_CLASS_ASSIGNED' | 'SO_DOUBLED';

export interface M13TelemetryPayload extends MechanicTelemetryPayload {
  event: M13Event;
  mechanic_id: 'M13';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M13_BOUNDS = {
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

// ── Internal helpers (deterministic, no state mutation) ────────────────────

function m13DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m13DeriveRegimeFromSchedule(
  tick: number,
  schedule: MacroEvent[],
  fallback: MacroRegime,
): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m13InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m13DerivePressureTierFromCash(cash: number): PressureTier {
  if (cash <= 0) return 'CRITICAL';
  if (cash < M13_BOUNDS.BLEED_CASH_THRESHOLD) return 'HIGH';
  if (cash < M13_BOUNDS.TIER_ESCAPE_TARGET) return 'MEDIUM';
  return 'LOW';
}

function m13ClassifyFriction(amount: number): string {
  const pct = amount / Math.max(1, M13_BOUNDS.MAX_AMOUNT);
  if (pct >= 0.85) return 'SYSTEMIC';
  if (pct >= 0.55) return 'HEAVY';
  if (pct >= 0.25) return 'MODERATE';
  return 'LIGHT';
}

function m13PickFrictionDriver(seed: string, tick: number, pressure: PressureTier, phase: RunPhase, regime: MacroRegime): GameCard {
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(seed + ':friction_pool', pressureW * phaseW, regimeW);
  if (!pool || pool.length === 0) return DEFAULT_CARD;

  const idx = seededIndex(seed, tick + 777, pool.length);
  return pool[idx] ?? DEFAULT_CARD;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * systemicFrictionModule
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function systemicFrictionModule(input: M13Input, emit: MechanicEmitter): M13Output {
  const fateTick = clamp(((input.fateTick as number) ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const stateCash = (input.stateCash as number) ?? 0;
  const stateMacroRegime = (input.stateMacroRegime as MacroRegime) ?? 'NEUTRAL';

  const seed = computeHash(`M13:${fateTick}:${stateCash}:${stateMacroRegime}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m13DerivePhase(fateTick);
  const regime = m13DeriveRegimeFromSchedule(fateTick, macroSchedule, stateMacroRegime);
  const inChaos = m13InChaosWindow(fateTick, chaosWindows);

  const pressureTier = m13DerivePressureTierFromCash(stateCash);

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decayRate = computeDecayRate(regime, M13_BOUNDS.BASE_DECAY_RATE);

  const driverCard = m13PickFrictionDriver(seed, fateTick, pressureTier, phase, regime);
  const deckHint = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck')[0] ?? DEFAULT_CARD.id;
  const oppHint = OPPORTUNITY_POOL[seededIndex(seed, fateTick + 19, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const triggered = fateTick >= M13_BOUNDS.TRIGGER_THRESHOLD;

  // Systemic friction: grows with time + pressure + regime stress; worsens under chaos.
  const timeFrac = clamp(fateTick / RUN_TOTAL_TICKS, 0, 1);
  const macroStress = clamp((1 / Math.max(0.01, exitPulse)) * (1.25 - (regimeMult - 1) * 0.5), 0.25, 2.5);

  const raw =
    M13_BOUNDS.BASE_AMOUNT *
    (1 + timeFrac * 0.85) *
    pressureW *
    phaseW *
    regimeW *
    macroStress;

  const baseAmount = triggered ? clamp(raw, 0, M13_BOUNDS.MAX_AMOUNT) : 0;

  const doubled = triggered && inChaos && (regime === 'CRISIS' || pressureTier === 'CRITICAL');
  const finalAmount = doubled ? clamp(baseAmount * 2, 0, M13_BOUNDS.MAX_AMOUNT) : baseAmount;

  const frictionClass = triggered ? m13ClassifyFriction(finalAmount) : 'NONE';

  const frictionExpenseEvent: Record<string, unknown> = triggered
    ? {
        tick: fateTick,
        regime,
        phase,
        pressureTier,
        inChaos,
        frictionClass,
        amount: finalAmount,
        driverCard: { id: driverCard.id, name: driverCard.name, type: driverCard.type },
        oppHint: { id: oppHint.id, name: oppHint.name },
        deckHintTop: deckHint,
        decayRate,
      }
    : {};

  if (triggered) {
    emit({
      event: 'SO_FRICTION_APPLIED',
      mechanic_id: 'M13',
      tick: fateTick,
      runId: '',
      payload: {
        amount: finalAmount,
        baseAmount,
        doubled,
        regime,
        phase,
        pressureTier,
        inChaos,
        stateCash,
        weights: { pressureW, phaseW, regimeW },
        macroStress,
        regimeMult,
        exitPulse,
        decayRate,
        driverCardId: driverCard.id,
        oppHintId: oppHint.id,
        deckHintTop: deckHint,
      },
    });

    emit({
      event: 'FRICTION_CLASS_ASSIGNED',
      mechanic_id: 'M13',
      tick: fateTick,
      runId: '',
      payload: {
        frictionClass,
        amount: finalAmount,
        pctOfCap: clamp(finalAmount / Math.max(1, M13_BOUNDS.MAX_AMOUNT), 0, 1),
      },
    });

    if (doubled) {
      emit({
        event: 'SO_DOUBLED',
        mechanic_id: 'M13',
        tick: fateTick,
        runId: '',
        payload: {
          reason: 'chaos_and_crisis_or_critical_pressure',
          baseAmount,
          finalAmount,
          regime,
          pressureTier,
        },
      });
    }

    emit({
      event: 'CASH_DRAINED',
      mechanic_id: 'M13',
      tick: fateTick,
      runId: '',
      payload: {
        cashDrained: finalAmount,
        stateCashBefore: stateCash,
        frictionClass,
      },
    });
  }

  return {
    frictionExpenseEvent,
    cashDrained: finalAmount,
    frictionClass,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M13MLInput {
  frictionExpenseEvent?: Record<string, unknown>;
  cashDrained?: number;
  frictionClass?: string;
  runId: string;
  tick: number;
}

export interface M13MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * systemicFrictionModuleMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function systemicFrictionModuleMLCompanion(input: M13MLInput): Promise<M13MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);

  const drained = Number(input.cashDrained ?? 0);
  const classKey = String(input.frictionClass ?? 'NONE');

  const severity = clamp(drained / Math.max(1, M13_BOUNDS.MAX_AMOUNT), 0, 1);
  const score = clamp(1 - severity * 0.9, 0.01, 0.99);

  const hintIdx = seededIndex(computeHash(`M13ML:${tick}:${drained}:${classKey}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintIdx] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `cashDrained=${Math.round(drained)} (cap=${M13_BOUNDS.MAX_AMOUNT})`,
    `frictionClass=${classKey}`,
    `severity=${severity.toFixed(2)}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation =
    severity >= 0.75
      ? 'Systemic friction is crushing you: cut scope, stabilize cash, and avoid optional actions.'
      : severity >= 0.45
        ? 'Friction is rising: tighten execution, reduce waste, and prioritize high-EV moves.'
        : 'Friction is manageable: keep momentum and protect cash buffer.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M13'),
    confidenceDecay: computeDecayRate('NEUTRAL', M13_BOUNDS.BASE_DECAY_RATE),
  };
}