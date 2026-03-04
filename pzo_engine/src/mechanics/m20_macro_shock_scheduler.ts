// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m20_macro_shock_scheduler.ts
//
// Mechanic : M20 — Macro Shock Scheduler
// Family   : meta_system   Layer: tick_engine   Priority: 2   Batch: 1
// ML Pair  : m20a
// Deps     : M01, M05
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
  RunPhase, TickTier, MacroRegime, PressureTier, SolvencyStatus,
  Asset, IPAItem, GameCard, GameEvent, ShieldLayer, Debt, Buff,
  Liability, SetBonus, AssetMod, IncomeItem, MacroEvent, ChaosWindow,
  AuctionResult, PurchaseResult, ShieldResult, ExitResult, TickResult,
  DeckComposition, TierProgress, WipeEvent, RegimeShiftEvent,
  PhaseTransitionEvent, TimerExpiredEvent, StreakEvent, FubarEvent,
  LedgerEntry, ProofCard, CompletedRun, SeasonState, RunState,
  MomentEvent, ClipBoundary, MechanicTelemetryPayload, MechanicEmitter,
} from './types';

// ── Import Anchors (keep every import "accessible" + used) ────────────────────

export const M20_IMPORTED_SYMBOLS = {
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

export type M20_ImportedTypesAnchor = {
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

// ── Local domain contract ────────────────────────────────────────────────────

export type MacroShockSource = 'SCHEDULE' | 'CHAOS';

export interface MacroShockEvent {
  tick: number;
  value: number; // positive magnitude (caller decides sign)
  regime: MacroRegime;
  cashDelta: number; // typically negative
  cashflowDelta: number; // typically negative
  severity: number; // 0..1
  source: MacroShockSource;
  cardId: string; // deterministic "reason tag" (ties to decks for UI)
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M20Input {
  stateTick?: number;
  runSeed?: string;
}

export interface M20Output {
  macroShockEvent: MacroShockEvent | null;
  regimeUpdated: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M20Event =
  | 'MACRO_SHOCK_SCHEDULED'
  | 'MACRO_SHOCK_APPLIED'
  | 'REGIME_FORCED'
  | 'SHOCK_DEFERRED';

export interface M20TelemetryPayload extends MechanicTelemetryPayload {
  event: M20Event;
  mechanic_id: 'M20';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M20_BOUNDS = {
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

function m20DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m20InChaosWindow(tick: number, chaosWindows: ChaosWindow[]): ChaosWindow | null {
  for (const w of chaosWindows) {
    if (tick >= w.startTick && tick <= w.endTick) return w;
  }
  return null;
}

function m20DeriveRegimeFromSchedule(tick: number, macroSchedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!macroSchedule || macroSchedule.length === 0) return fallback;
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m20DerivePressureTier(tick: number, phase: RunPhase, chaosHit: ChaosWindow | null): PressureTier {
  if (chaosHit) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

type M20Context = {
  seed: string;
  tick: number;
  phase: RunPhase;
  pressure: PressureTier;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  chaosHit: ChaosWindow | null;
  regime: MacroRegime;

  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
  regimeMult: number;
  exitPulse: number;
  decay: number;

  poolPick: GameCard;
  oppPick: GameCard;
  deckTop: string;
};

function m20BuildContext(tick: number, runSeed: string): M20Context {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);

  const seed = computeHash(`${runSeed}:M20:${t}:${RUN_TOTAL_TICKS}`);
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m20DerivePhase(t);
  const chaosHit = m20InChaosWindow(t, chaosWindows);

  const regime = m20DeriveRegimeFromSchedule(t, macroSchedule, 'NEUTRAL');
  const pressure = m20DerivePressureTier(t, phase, chaosHit);

  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M20_BOUNDS.BASE_DECAY_RATE);

  const deck = seededShuffle(DEFAULT_CARD_IDS, seed);
  const deckTop = deck[0] ?? DEFAULT_CARD.id;

  const oppIdx = seededIndex(seed, t + 17, OPPORTUNITY_POOL.length);
  const oppPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const pool = buildWeightedPool(`${seed}:pool`, pressureWeight * phaseWeight, regimeWeight);
  const poolPick = pool[seededIndex(seed, t + 33, Math.max(1, pool.length))] ?? oppPick ?? DEFAULT_CARD;

  return {
    seed,
    tick: t,
    phase,
    pressure,
    macroSchedule,
    chaosWindows,
    chaosHit,
    regime,
    pressureWeight,
    phaseWeight,
    regimeWeight,
    regimeMult,
    exitPulse,
    decay,
    poolPick,
    oppPick,
    deckTop,
  };
}

function m20PickCardIdTag(ctx: M20Context): string {
  const preferred = ctx.poolPick?.id ?? ctx.oppPick?.id ?? DEFAULT_CARD.id;
  if (DEFAULT_CARD_IDS.includes(preferred)) return preferred;
  return DEFAULT_CARD.id;
}

function m20CountTriggersUpToTick(ctx: M20Context): number {
  const scheduledTicks = new Set<number>();
  for (const ev of ctx.macroSchedule) scheduledTicks.add(clamp(ev.tick, 0, RUN_TOTAL_TICKS - 1));

  const chaosStartTicks = new Set<number>();
  for (const w of ctx.chaosWindows) chaosStartTicks.add(clamp(w.startTick, 0, RUN_TOTAL_TICKS - 1));

  let count = 0;
  for (let t = 0; t <= ctx.tick; t++) {
    if (scheduledTicks.has(t) || chaosStartTicks.has(t)) count++;
  }
  return count;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

export function macroShockScheduler(input: M20Input, emit: MechanicEmitter): M20Output {
  const tick = (input.stateTick as number) ?? 0;
  const runSeed = (input.runSeed as string) ?? computeHash(JSON.stringify(input));

  const ctx = m20BuildContext(tick, runSeed);

  const scheduledNow = ctx.macroSchedule.some(ev => ev.tick === ctx.tick);
  const chaosStartNow = ctx.chaosHit ? ctx.tick === ctx.chaosHit.startTick : false;

  const shouldTrigger = scheduledNow || chaosStartNow;

  const triggerCount = m20CountTriggersUpToTick(ctx);
  const excessCount = Math.max(0, triggerCount - 1);

  const chaosBoost = ctx.chaosHit ? 1.25 : 1.0;
  const baseSeverity = clamp(ctx.decay * chaosBoost, 0.01, 1.0);

  const pulseFrac = (ctx.tick % M20_BOUNDS.PULSE_CYCLE) / M20_BOUNDS.PULSE_CYCLE;
  const pulseBias = clamp(0.75 + pulseFrac * 0.50, 0.75, 1.25);

  const regimeBias = clamp(ctx.exitPulse * ctx.regimeMult, 0.10, 2.50);

  const amountRaw =
    M20_BOUNDS.BASE_AMOUNT *
    Math.pow(M20_BOUNDS.MULTIPLIER, excessCount) *
    baseSeverity *
    pulseBias *
    regimeBias;

  const amount = clamp(amountRaw, 0, M20_BOUNDS.MAX_AMOUNT);

  const cashDelta = clamp(
    -amount * M20_BOUNDS.EFFECT_MULTIPLIER,
    M20_BOUNDS.MIN_CASH_DELTA,
    M20_BOUNDS.MAX_CASH_DELTA,
  );

  const cashflowDelta = clamp(
    -amount * 0.10,
    M20_BOUNDS.MIN_CASHFLOW_DELTA,
    M20_BOUNDS.MAX_CASHFLOW_DELTA,
  );

  const shockSeverity = clamp(amount / M20_BOUNDS.MAX_AMOUNT, 0, 1);

  const cardIdTag = m20PickCardIdTag(ctx);

  // Deterministic regime forcing: only when large shock or chaos start.
  const forcedRegime: MacroRegime =
    shockSeverity >= 0.80 || chaosStartNow ? 'CRISIS' :
    shockSeverity >= 0.55 ? 'BEAR' :
    ctx.regime;

  const regimeUpdated = forcedRegime !== ctx.regime;

  if (shouldTrigger) {
    emit({
      event: 'MACRO_SHOCK_SCHEDULED',
      mechanic_id: 'M20',
      tick: ctx.tick,
      runId: ctx.seed,
      payload: {
        seed: ctx.seed,
        triggerCount,
        excessCount,
        scheduledNow,
        chaosStartNow,
        phase: ctx.phase,
        pressure: ctx.pressure,
        regime: ctx.regime,
        forcedRegime,
        cardIdTag,
        deckTop: ctx.deckTop,
        oppPick: { id: ctx.oppPick.id, name: ctx.oppPick.name },
        poolPick: { id: ctx.poolPick.id, name: ctx.poolPick.name },
        weights: {
          pressure: ctx.pressureWeight,
          phase: ctx.phaseWeight,
          regime: ctx.regimeWeight,
          regimeMult: ctx.regimeMult,
          exitPulse: ctx.exitPulse,
          decay: ctx.decay,
        },
        amount: Math.round(amount),
        baseSeverity: Number(baseSeverity.toFixed(4)),
        pulseBias: Number(pulseBias.toFixed(4)),
        regimeBias: Number(regimeBias.toFixed(4)),
      },
    });

    const macroShockEvent: MacroShockEvent = {
      tick: ctx.tick,
      value: amount,
      regime: forcedRegime,
      cashDelta,
      cashflowDelta,
      severity: shockSeverity,
      source: chaosStartNow ? 'CHAOS' : 'SCHEDULE',
      cardId: cardIdTag,
    };

    emit({
      event: 'MACRO_SHOCK_APPLIED',
      mechanic_id: 'M20',
      tick: ctx.tick,
      runId: ctx.seed,
      payload: {
        tick: ctx.tick,
        amount: Math.round(amount),
        cashDelta,
        cashflowDelta,
        severity: Number(shockSeverity.toFixed(4)),
        source: macroShockEvent.source,
        cardId: macroShockEvent.cardId,
      },
    });

    if (regimeUpdated) {
      emit({
        event: 'REGIME_FORCED',
        mechanic_id: 'M20',
        tick: ctx.tick,
        runId: ctx.seed,
        payload: {
          previousRegime: ctx.regime,
          forcedRegime,
          reason: chaosStartNow ? 'CHAOS_START' : 'SEVERITY_THRESHOLD',
          severity: Number(shockSeverity.toFixed(4)),
          threshold: ctx.chaosHit ? 0.0 : 0.55,
        },
      });
    }

    return {
      macroShockEvent,
      regimeUpdated,
    };
  }

  emit({
    event: 'SHOCK_DEFERRED',
    mechanic_id: 'M20',
    tick: ctx.tick,
    runId: ctx.seed,
    payload: {
      tick: ctx.tick,
      phase: ctx.phase,
      pressure: ctx.pressure,
      regime: ctx.regime,
      chaosActive: Boolean(ctx.chaosHit),
      nextAmountPreview: Math.round(amount),
      nextSeverityPreview: Number(shockSeverity.toFixed(4)),
    },
  });

  return {
    macroShockEvent: null,
    regimeUpdated: false,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M20MLInput {
  macroShockEvent?: MacroShockEvent | null;
  regimeUpdated?: boolean;
  runId: string;
  tick: number;
}

export interface M20MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

export async function macroShockSchedulerMLCompanion(input: M20MLInput): Promise<M20MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);
  const evt = input.macroShockEvent ?? null;

  const regime: MacroRegime = evt?.regime ?? 'NEUTRAL';
  const severity = Number(evt?.severity ?? 0);
  const amount = Number(evt?.value ?? 0);

  const decay = computeDecayRate(regime, M20_BOUNDS.BASE_DECAY_RATE);

  const score = clamp(
    0.20 +
      severity * 0.60 +
      (input.regimeUpdated ? 0.10 : 0.0) +
      clamp(amount / M20_BOUNDS.MAX_AMOUNT, 0, 1) * 0.10,
    0.01,
    0.99,
  );

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS} regime=${regime}`,
    `severity=${severity.toFixed(2)} amount=${Math.round(amount)}`,
    `regimeUpdated=${Boolean(input.regimeUpdated)}`,
    `decay=${decay.toFixed(2)} pulseCycle=${M20_BOUNDS.PULSE_CYCLE}`,
    evt ? `source=${evt.source} cardId=${evt.cardId}` : 'no_shock',
  ].slice(0, 5);

  const recommendation =
    severity >= 0.80
      ? 'Immediate stabilization: reduce exposure, preserve cash, and avoid leverage expansions.'
      : severity >= 0.55
        ? 'Risk-off bias: prioritize liquidity and delay marginal buys until the regime clears.'
        : severity > 0.0
          ? 'Manageable shock: continue plan but tighten thresholds and monitor upcoming triggers.'
          : 'No shock: proceed with normal strategy and watch the next schedule boundary.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M20', ...input }) + ':ml:M20'),
    confidenceDecay: decay,
  };
}