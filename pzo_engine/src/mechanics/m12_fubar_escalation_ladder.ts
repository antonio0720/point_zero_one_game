// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m12_fubar_escalation_ladder.ts
//
// Mechanic : M12 — FUBAR Escalation Ladder
// Family   : chaos_engine   Layer: tick_engine   Priority: 1   Batch: 1
// ML Pair  : m12a
// Deps     : M02, M05
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
 * Runtime access to the canonical mechanicsUtils symbols imported by this mechanic.
 * (Keeps generator-wide imports live + makes them directly importable elsewhere.)
 */
export const M12_IMPORTED_SYMBOLS = {
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
export type M12_ImportedTypesAnchor = {
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

export interface M12Input {
  fateTick?: number;
  statePressureTier?: PressureTier;
  stateCash?: number;
}

export interface M12Output {
  fubarEvent: FubarEvent | null;
  counterplayWindow: Record<string, unknown>;
  escalationLevel: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M12Event =
  | 'FUBAR_TRIGGERED'
  | 'FUBAR_ESCALATED'
  | 'COUNTERPLAY_WINDOW_OPENED'
  | 'FUBAR_DEFUSED';

export interface M12TelemetryPayload extends MechanicTelemetryPayload {
  event: M12Event;
  mechanic_id: 'M12';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M12_BOUNDS = {
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

function m12DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m12DeriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const sorted = [...(schedule ?? [])].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m12InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m12ComputeEscalationLevel(
  fateTick: number,
  pressureTier: PressureTier,
  phase: RunPhase,
  regime: MacroRegime,
  inChaos: boolean,
): number {
  const excess = Math.max(0, fateTick - M12_BOUNDS.TRIGGER_THRESHOLD);

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  const base = M12_BOUNDS.BASE_AMOUNT * Math.pow(M12_BOUNDS.MULTIPLIER, excess);
  const weighted = base * pressureW * phaseW * regimeW * (inChaos ? 1.15 : 1.0);

  return Math.round(clamp(weighted, 0, M12_BOUNDS.MAX_EFFECT));
}

function m12OpenCounterplayWindow(
  seed: string,
  tick: number,
  pressureTier: PressureTier,
  stateCash: number,
  regime: MacroRegime,
): Record<string, unknown> {
  const deck = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const opp = OPPORTUNITY_POOL[seededIndex(seed, tick + 19, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;
  const pool = buildWeightedPool(seed + ':pool', PRESSURE_WEIGHTS[pressureTier] ?? 1.0, REGIME_WEIGHTS[regime] ?? 1.0);
  const pick = pool[seededIndex(seed, tick + 29, Math.max(1, pool.length))] ?? opp ?? DEFAULT_CARD;

  const cashStress = clamp((M12_BOUNDS.BLEED_CASH_THRESHOLD - stateCash) / Math.max(1, M12_BOUNDS.BLEED_CASH_THRESHOLD), 0, 1);
  const windowTicks = clamp(M12_BOUNDS.FIRST_REFUSAL_TICKS - Math.floor(cashStress * 3), 2, M12_BOUNDS.FIRST_REFUSAL_TICKS);

  return {
    openedAtTick: tick,
    expiresAtTick: tick + windowTicks,
    suggestedCardId: pick.id,
    suggestedCardName: pick.name,
    opportunityCardId: opp.id,
    deckHintTop: deck[0] ?? '',
    windowTicks,
    cashStress,
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * fubarEscalationLadder
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function fubarEscalationLadder(input: M12Input, emit: MechanicEmitter): M12Output {
  const fateTick = clamp(((input.fateTick as number) ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const statePressureTier = (input.statePressureTier as PressureTier) ?? 'LOW';
  const stateCash = (input.stateCash as number) ?? 0;

  const seed = computeHash(`M12:${fateTick}:${statePressureTier}:${stateCash}`);
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m12DerivePhase(fateTick);
  const regime = m12DeriveRegime(fateTick, macroSchedule);
  const inChaos = m12InChaosWindow(fateTick, chaosWindows);

  const triggered = fateTick >= M12_BOUNDS.TRIGGER_THRESHOLD;
  const escalationLevel = triggered
    ? m12ComputeEscalationLevel(fateTick, statePressureTier, phase, regime, inChaos)
    : 0;

  // Counterplay window opens only when triggered.
  const counterplayWindow = triggered
    ? m12OpenCounterplayWindow(seed, fateTick, statePressureTier, stateCash, regime)
    : {};

  // Defuse logic: if player has enough cash buffer and not in chaos, event can be null.
  const defused = triggered && !inChaos && stateCash >= M12_BOUNDS.TIER_ESCAPE_TARGET;

  const fubarEvent: FubarEvent | null = triggered && !defused
    ? {
        type: 'FUBAR',
        level: escalationLevel,
        damage: escalationLevel, // or compute damage as needed
      }
    : null;

  // keep shared imports “used”
  const decay = computeDecayRate(regime, M12_BOUNDS.BASE_DECAY_RATE);
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  if (triggered) {
    emit({
      event: 'FUBAR_TRIGGERED',
      mechanic_id: 'M12',
      tick: fateTick,
      runId: '',
      payload: {
        fateTick,
        triggered,
        phase,
        regime,
        inChaos,
        stateCash,
        pressureTier: statePressureTier,
        decay,
        exitPulse,
        regimeMult,
      },
    });

    emit({
      event: 'FUBAR_ESCALATED',
      mechanic_id: 'M12',
      tick: fateTick,
      runId: '',
      payload: {
        escalationLevel,
        bounds: {
          threshold: M12_BOUNDS.TRIGGER_THRESHOLD,
          maxEffect: M12_BOUNDS.MAX_EFFECT,
          maxAmount: M12_BOUNDS.MAX_AMOUNT,
        },
      },
    });

    emit({
      event: 'COUNTERPLAY_WINDOW_OPENED',
      mechanic_id: 'M12',
      tick: fateTick,
      runId: '',
      payload: {
        counterplayWindow,
      },
    });

    if (defused) {
      emit({
        event: 'FUBAR_DEFUSED',
        mechanic_id: 'M12',
        tick: fateTick,
        runId: '',
        payload: {
          reason: 'cash_buffer_met_and_not_in_chaos',
          stateCash,
          tierEscapeTarget: M12_BOUNDS.TIER_ESCAPE_TARGET,
        },
      });
    }
  }

  return {
    fubarEvent,
    counterplayWindow,
    escalationLevel,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M12MLInput {
  fubarEvent?: FubarEvent | null;
  counterplayWindow?: Record<string, unknown>;
  escalationLevel?: number;
  runId: string;
  tick: number;
}

export interface M12MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * fubarEscalationLadderMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function fubarEscalationLadderMLCompanion(input: M12MLInput): Promise<M12MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);

  const level = Number(input.escalationLevel ?? 0);
  const severity = clamp(level / Math.max(1, M12_BOUNDS.MAX_EFFECT), 0, 1);

  const score = clamp(1 - severity * 0.9, 0.01, 0.99);
  const confidenceDecay = computeDecayRate('NEUTRAL', M12_BOUNDS.BASE_DECAY_RATE);

  const hintIdx = seededIndex(computeHash(`M12ML:${tick}:${level}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintIdx] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `escalationLevel=${Math.round(level)} (max=${M12_BOUNDS.MAX_EFFECT})`,
    `severity=${severity.toFixed(2)}`,
    `counterplay=${input.counterplayWindow ? 'open' : 'none'}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation =
    severity >= 0.75
      ? 'FUBAR critical: take counterplay immediately; stop all optional actions.'
      : severity >= 0.45
        ? 'FUBAR rising: prioritize stabilizing cashflow and reducing pressure exposure.'
        : 'FUBAR manageable: keep momentum but avoid passes and low-EV detours.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M12'),
    confidenceDecay,
  };
}