// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m18_rival_sabotage.ts
//
// Mechanic : M18 — Rival Sabotage
// Family   : social_engine   Layer: api_endpoint   Priority: 1   Batch: 1
// ML Pair  : m18a
// Deps     : M08, M15
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

export const M18_IMPORTED_SYMBOLS = {
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

export type M18_ImportedTypesAnchor = {
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

// ── Local domain types (M18-only; not in ./types list) ───────────────────────

export type SabotageKind =
  | 'CASH_DRAIN'
  | 'CASHFLOW_DRAIN'
  | 'PRESSURE_SPIKE'
  | 'TIMER_TAX'
  | 'MARKET_SMEAR'
  | 'NONE';

export interface SabotageEvent {
  id: string; // deterministic event id
  requestId: string;

  rivalId: string;
  targetUserId: string;

  sabotageCardId: string;
  sabotageKind: SabotageKind;

  appliedAtTick: number;
  expiresAtTick: number;

  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  runPhase: RunPhase;
  inChaos: boolean;

  blocked: boolean;
  blockReason: string;

  magnitude: number; // 0..MAX_EFFECT
  decayRate: number; // 0..1

  // audit + diegetic hints for UI/replay
  cardHint: GameCard;
  deckHintTop: string;
  opportunityHint: GameCard;

  auditHash: string;
}

export interface TargetImpact {
  cashDelta: number; // bounded by MIN/MAX_CASH_DELTA
  cashflowDelta: number; // bounded by MIN/MAX_CASHFLOW_DELTA
  pressurePointsDelta: number; // 0..MAX_EFFECT (engine decides how to interpret)
  timerTaxTicks: number; // 0..FIRST_REFUSAL_TICKS
  durationTicks: number; // 0..(PULSE_CYCLE*6)
  notes: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M18Input {
  rivalId?: string;
  targetUserId?: string;

  sabotageCard?: GameCard;

  // optional context for API endpoint callers (kept optional to avoid breaking callers)
  stateTick?: number;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
}

export interface M18Output {
  sabotageEvent: SabotageEvent;
  targetImpact: TargetImpact;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M18Event = 'SABOTAGE_LAUNCHED' | 'SABOTAGE_RESOLVED' | 'TARGET_IMPACTED' | 'SABOTAGE_BLOCKED';

export interface M18TelemetryPayload extends MechanicTelemetryPayload {
  event: M18Event;
  mechanic_id: 'M18';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M18_BOUNDS = {
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

function m18PickKey<T extends string>(obj: Record<T, unknown>, seed: string, salt: number): T {
  const keys = Object.keys(obj) as T[];
  const idx = seededIndex(seed, salt, Math.max(1, keys.length));
  return (keys[idx] ?? keys[0]) as T;
}

function m18DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m18DeriveRegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m18InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m18NormalizeKindFromCard(card?: GameCard): SabotageKind {
  const t = String(card?.type ?? '').toUpperCase();
  if (t.includes('CASHFLOW')) return 'CASHFLOW_DRAIN';
  if (t.includes('CASH')) return 'CASH_DRAIN';
  if (t.includes('PRESSURE')) return 'PRESSURE_SPIKE';
  if (t.includes('TIMER')) return 'TIMER_TAX';
  if (t.includes('SMEAR') || t.includes('SOCIAL')) return 'MARKET_SMEAR';
  return 'NONE';
}

function m18PickHints(seed: string, tick: number, pressureTier: PressureTier, runPhase: RunPhase, macroRegime: MacroRegime): {
  cardHint: GameCard;
  deckHintTop: string;
  opportunityHint: GameCard;
} {
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const pool = buildWeightedPool(seed + ':pool', pressureW * phaseW, regimeW);
  const cardHint = pool[seededIndex(seed, tick + 19, Math.max(1, pool.length))] ?? DEFAULT_CARD;

  const deckHintTop = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck')[0] ?? DEFAULT_CARD.id;
  const opportunityHint = OPPORTUNITY_POOL[seededIndex(seed, tick + 29, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  return { cardHint, deckHintTop, opportunityHint };
}

function m18SelectKind(seed: string, tick: number, preferred: SabotageKind): SabotageKind {
  if (preferred !== 'NONE') return preferred;

  const kinds: SabotageKind[] = ['CASH_DRAIN', 'CASHFLOW_DRAIN', 'PRESSURE_SPIKE', 'TIMER_TAX', 'MARKET_SMEAR'];
  const idx = seededIndex(seed, tick + 501, kinds.length);
  return kinds[idx] ?? 'CASH_DRAIN';
}

function m18ComputeMagnitude(
  seed: string,
  tick: number,
  macroRegime: MacroRegime,
  pressureTier: PressureTier,
  runPhase: RunPhase,
  inChaos: boolean,
  sabotageCard: GameCard,
): { magnitude: number; decayRate: number; breakdown: Record<string, unknown> } {
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const decayRate = computeDecayRate(macroRegime, M18_BOUNDS.BASE_DECAY_RATE);

  const cardCostLike = Number(sabotageCard.cost ?? sabotageCard.downPayment ?? sabotageCard.shieldValue ?? 1000);
  const cardScale = clamp(cardCostLike / 25_000, 0.15, 2.25);

  const macroRisk = clamp((1 / Math.max(0.01, exitPulse)) * (1 / Math.max(0.01, regimeMult)), 0.6, 3.0);
  const chaosFactor = inChaos ? 1.25 : 1.0;

  const jitter = 1 + (seededIndex(seed, tick + 777, 25) / 100); // 1.00..1.24

  const raw =
    6_000 *
    cardScale *
    M18_BOUNDS.EFFECT_MULTIPLIER *
    clamp(pressureW * phaseW * regimeW, 0.6, 2.4) *
    macroRisk *
    chaosFactor *
    clamp(1 - decayRate, 0.25, 1.0) *
    jitter;

  const magnitude = clamp(Math.round(raw), M18_BOUNDS.MIN_EFFECT, M18_BOUNDS.MAX_EFFECT);

  return {
    magnitude,
    decayRate,
    breakdown: {
      seed,
      tick,
      macroRegime,
      pressureTier,
      runPhase,
      inChaos,
      pressureW,
      phaseW,
      regimeW,
      exitPulse,
      regimeMult,
      decayRate,
      cardCostLike,
      cardScale,
      macroRisk,
      chaosFactor,
      jitter,
      raw,
      magnitude,
    },
  };
}

function m18ComputeDuration(seed: string, tick: number, inChaos: boolean): number {
  const base = M18_BOUNDS.PULSE_CYCLE * (inChaos ? 2 : 1); // 12 or 24
  const jitter = 1 + (seededIndex(seed, tick + 901, 35) / 100); // 1.00..1.34
  const raw = base * jitter;

  const snapped = Math.round(raw / Math.max(1, M18_BOUNDS.PULSE_CYCLE)) * M18_BOUNDS.PULSE_CYCLE;
  return clamp(snapped, 0, M18_BOUNDS.PULSE_CYCLE * 6);
}

function m18ComputeBlock(
  seed: string,
  tick: number,
  macroRegime: MacroRegime,
  pressureTier: PressureTier,
  inChaos: boolean,
  rivalId: string,
  targetUserId: string,
): { blocked: boolean; reason: string; chance: number; roll: number } {
  if (!rivalId) return { blocked: true, reason: 'missing_rival_id', chance: 1, roll: 0 };
  if (!targetUserId) return { blocked: true, reason: 'missing_target_user_id', chance: 1, roll: 0 };

  const base =
    0.18 +
    (macroRegime === 'BULL' ? 0.12 : 0) +
    (macroRegime === 'NEUTRAL' ? 0.06 : 0) +
    (pressureTier === 'LOW' ? 0.10 : 0) -
    (pressureTier === 'CRITICAL' ? 0.08 : 0) -
    (inChaos ? 0.10 : 0);

  const chance = clamp(base, 0.05, 0.55);
  const roll = seededIndex(seed, tick + 999, 10_000) / 10_000;

  return {
    blocked: roll < chance,
    reason: roll < chance ? 'blocked_by_shield_cancel_or_table_rule' : '',
    chance,
    roll,
  };
}

function m18ImpactFromKind(kind: SabotageKind, magnitude: number, durationTicks: number): TargetImpact {
  const mag = clamp(magnitude, 0, M18_BOUNDS.MAX_EFFECT);

  // Convert magnitude into bounded economic deltas
  const cashDeltaRaw = Math.round(-mag * 0.65);
  const cashflowDeltaRaw = Math.round(-mag * 0.18);

  let cashDelta = 0;
  let cashflowDelta = 0;
  let pressurePointsDelta = 0;
  let timerTaxTicks = 0;

  switch (kind) {
    case 'CASH_DRAIN':
      cashDelta = clamp(cashDeltaRaw, M18_BOUNDS.MIN_CASH_DELTA, M18_BOUNDS.MAX_CASH_DELTA);
      break;

    case 'CASHFLOW_DRAIN':
      cashflowDelta = clamp(cashflowDeltaRaw, M18_BOUNDS.MIN_CASHFLOW_DELTA, M18_BOUNDS.MAX_CASHFLOW_DELTA);
      break;

    case 'PRESSURE_SPIKE':
      pressurePointsDelta = clamp(Math.round(mag * 0.75), 0, M18_BOUNDS.MAX_EFFECT);
      break;

    case 'TIMER_TAX':
      timerTaxTicks = clamp(Math.round((mag / 10_000) * M18_BOUNDS.FIRST_REFUSAL_TICKS), 0, M18_BOUNDS.FIRST_REFUSAL_TICKS);
      break;

    case 'MARKET_SMEAR':
      // mild across multiple channels
      cashDelta = clamp(Math.round(cashDeltaRaw * 0.35), M18_BOUNDS.MIN_CASH_DELTA, M18_BOUNDS.MAX_CASH_DELTA);
      cashflowDelta = clamp(Math.round(cashflowDeltaRaw * 0.35), M18_BOUNDS.MIN_CASHFLOW_DELTA, M18_BOUNDS.MAX_CASHFLOW_DELTA);
      pressurePointsDelta = clamp(Math.round(mag * 0.30), 0, M18_BOUNDS.MAX_EFFECT);
      break;

    case 'NONE':
    default:
      break;
  }

  return {
    cashDelta,
    cashflowDelta,
    pressurePointsDelta,
    timerTaxTicks,
    durationTicks,
    notes: kind === 'NONE' ? 'no_effect' : 'bounded_social_sabotage',
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * rivalSabotageDispatch
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function rivalSabotageDispatch(input: M18Input, emit: MechanicEmitter): M18Output {
  const rivalId = String(input.rivalId ?? '');
  const targetUserId = String(input.targetUserId ?? '');
  const stateTick = clamp(((input.stateTick as number) ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const sabotageCard: GameCard = (input.sabotageCard as GameCard) ?? DEFAULT_CARD;
  const sabotageCardId = String(sabotageCard?.id ?? DEFAULT_CARD.id);

  const requestId = computeHash(
    JSON.stringify({
      mid: 'M18',
      t: stateTick,
      rivalId,
      targetUserId,
      sabotageCardId,
    }),
  );

  // Deterministic macro/chaos context (aligned with mechanicsUtils)
  const seed = computeHash(`${requestId}:${stateTick}:${rivalId}:${targetUserId}:${sabotageCardId}`);
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const runPhase = m18DerivePhase(stateTick);

  const fallbackRegime = (input.stateMacroRegime as MacroRegime) ?? m18PickKey(EXIT_PULSE_MULTIPLIERS as Record<MacroRegime, unknown>, seed, stateTick + 1);
  const macroRegime = m18DeriveRegimeFromSchedule(stateTick, macroSchedule, fallbackRegime);

  const inChaos = m18InChaosWindow(stateTick, chaosWindows);

  const fallbackPressure = (input.statePressureTier as PressureTier) ?? m18PickKey(PRESSURE_WEIGHTS as Record<PressureTier, unknown>, seed, stateTick + 7);
  const pressureTier = fallbackPressure;

  const durationTicks = m18ComputeDuration(seed, stateTick, inChaos);

  const preferredKind = m18NormalizeKindFromCard(sabotageCard);
  const sabotageKind = m18SelectKind(seed, stateTick, preferredKind);

  const hints = m18PickHints(seed, stateTick, pressureTier, runPhase, macroRegime);

  emit({
    event: 'SABOTAGE_LAUNCHED',
    mechanic_id: 'M18',
    tick: stateTick,
    runId: requestId,
    payload: {
      rivalId,
      targetUserId,
      sabotageCardId,
      sabotageKind,
      macroRegime,
      pressureTier,
      runPhase,
      inChaos,
      durationTicks,
      cardHintId: hints.cardHint.id,
      deckHintTop: hints.deckHintTop,
      opportunityHintId: hints.opportunityHint.id,
    },
  });

  const mag = m18ComputeMagnitude(seed, stateTick, macroRegime, pressureTier, runPhase, inChaos, sabotageCard);

  const block = m18ComputeBlock(seed, stateTick, macroRegime, pressureTier, inChaos, rivalId, targetUserId);

  if (block.blocked) {
    const sabotageEvent: SabotageEvent = {
      id: `sab-${computeHash(`${requestId}:blocked:${stateTick}`)}`,
      requestId,
      rivalId,
      targetUserId,
      sabotageCardId,
      sabotageKind: 'NONE',
      appliedAtTick: stateTick,
      expiresAtTick: stateTick,
      macroRegime,
      pressureTier,
      runPhase,
      inChaos,
      blocked: true,
      blockReason: block.reason || 'blocked',
      magnitude: 0,
      decayRate: mag.decayRate,
      cardHint: hints.cardHint,
      deckHintTop: hints.deckHintTop,
      opportunityHint: hints.opportunityHint,
      auditHash: computeHash(
        JSON.stringify({
          requestId,
          blocked: true,
          reason: block.reason,
          chance: block.chance,
          roll: block.roll,
          ctx: { macroRegime, pressureTier, runPhase, inChaos },
          sabotageCardId,
        }) + ':M18',
      ),
    };

    const targetImpact: TargetImpact = {
      cashDelta: 0,
      cashflowDelta: 0,
      pressurePointsDelta: 0,
      timerTaxTicks: 0,
      durationTicks: 0,
      notes: sabotageEvent.blockReason,
    };

    emit({
      event: 'SABOTAGE_BLOCKED',
      mechanic_id: 'M18',
      tick: stateTick,
      runId: requestId,
      payload: {
        rivalId,
        targetUserId,
        sabotageCardId,
        attemptedKind: sabotageKind,
        chance: block.chance,
        roll: block.roll,
        reason: sabotageEvent.blockReason,
      },
    });

    emit({
      event: 'SABOTAGE_RESOLVED',
      mechanic_id: 'M18',
      tick: stateTick,
      runId: requestId,
      payload: {
        blocked: true,
        sabotageEventId: sabotageEvent.id,
        auditHash: sabotageEvent.auditHash,
      },
    });

    emit({
      event: 'TARGET_IMPACTED',
      mechanic_id: 'M18',
      tick: stateTick,
      runId: requestId,
      payload: {
        cashDelta: 0,
        cashflowDelta: 0,
        pressurePointsDelta: 0,
        timerTaxTicks: 0,
        durationTicks: 0,
      },
    });

    return { sabotageEvent, targetImpact };
  }

  const appliedAtTick = stateTick;
  const expiresAtTick = clamp(appliedAtTick + durationTicks, 0, RUN_TOTAL_TICKS);

  const impact = m18ImpactFromKind(sabotageKind, mag.magnitude, durationTicks);

  const sabotageEvent: SabotageEvent = {
    id: `sab-${computeHash(`${requestId}:${sabotageKind}:${stateTick}:${mag.magnitude}`)}`,
    requestId,
    rivalId,
    targetUserId,
    sabotageCardId,
    sabotageKind,
    appliedAtTick,
    expiresAtTick,
    macroRegime,
    pressureTier,
    runPhase,
    inChaos,
    blocked: false,
    blockReason: '',
    magnitude: mag.magnitude,
    decayRate: mag.decayRate,
    cardHint: hints.cardHint,
    deckHintTop: hints.deckHintTop,
    opportunityHint: hints.opportunityHint,
    auditHash: computeHash(
      JSON.stringify({
        requestId,
        rivalId,
        targetUserId,
        sabotageCardId,
        sabotageKind,
        appliedAtTick,
        expiresAtTick,
        ctx: { macroRegime, pressureTier, runPhase, inChaos },
        magnitude: mag.magnitude,
        decayRate: mag.decayRate,
        impact,
        hints: { cardHintId: hints.cardHint.id, deckHintTop: hints.deckHintTop, opportunityHintId: hints.opportunityHint.id },
        breakdown: mag.breakdown,
      }) + ':M18',
    ),
  };

  emit({
    event: 'SABOTAGE_RESOLVED',
    mechanic_id: 'M18',
    tick: stateTick,
    runId: requestId,
    payload: {
      sabotageEventId: sabotageEvent.id,
      sabotageKind,
      magnitude: sabotageEvent.magnitude,
      decayRate: sabotageEvent.decayRate,
      appliedAtTick,
      expiresAtTick,
      auditHash: sabotageEvent.auditHash,
    },
  });

  emit({
    event: 'TARGET_IMPACTED',
    mechanic_id: 'M18',
    tick: stateTick,
    runId: requestId,
    payload: {
      rivalId,
      targetUserId,
      sabotageKind,
      cashDelta: impact.cashDelta,
      cashflowDelta: impact.cashflowDelta,
      pressurePointsDelta: impact.pressurePointsDelta,
      timerTaxTicks: impact.timerTaxTicks,
      durationTicks: impact.durationTicks,
    },
  });

  return {
    sabotageEvent,
    targetImpact: impact,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M18MLInput {
  sabotageEvent?: SabotageEvent;
  targetImpact?: TargetImpact;
  runId: string;
  tick: number;
}

export interface M18MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * rivalSabotageDispatchMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function rivalSabotageDispatchMLCompanion(input: M18MLInput): Promise<M18MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);

  const ev = input.sabotageEvent;
  const imp = input.targetImpact;

  const blocked = Boolean(ev?.blocked ?? false);
  const magnitude = Number(ev?.magnitude ?? 0);

  const cash = Math.abs(Number(imp?.cashDelta ?? 0));
  const cashflow = Math.abs(Number(imp?.cashflowDelta ?? 0));
  const pressure = Math.abs(Number(imp?.pressurePointsDelta ?? 0));
  const timer = Math.abs(Number(imp?.timerTaxTicks ?? 0));
  const duration = Math.abs(Number(imp?.durationTicks ?? 0));

  const magPct = clamp(magnitude / Math.max(1, M18_BOUNDS.MAX_EFFECT), 0, 1);
  const cashPct = clamp(cash / Math.max(1, Math.abs(M18_BOUNDS.MIN_CASH_DELTA)), 0, 1);
  const cashflowPct = clamp(cashflow / Math.max(1, Math.abs(M18_BOUNDS.MIN_CASHFLOW_DELTA)), 0, 1);
  const timerPct = clamp(timer / Math.max(1, M18_BOUNDS.FIRST_REFUSAL_TICKS), 0, 1);
  const durationPct = clamp(duration / Math.max(1, M18_BOUNDS.PULSE_CYCLE * 6), 0, 1);
  const pressurePct = clamp(pressure / Math.max(1, M18_BOUNDS.MAX_EFFECT), 0, 1);

  const impactScore = clamp(
    magPct * 0.35 + cashPct * 0.20 + cashflowPct * 0.10 + pressurePct * 0.20 + timerPct * 0.05 + durationPct * 0.10,
    0,
    1,
  );

  const score = clamp(blocked ? 0.15 : 0.20 + impactScore * 0.79, 0.01, 0.99);

  const regime: MacroRegime = (ev?.macroRegime as MacroRegime) ?? m18PickKey(EXIT_PULSE_MULTIPLIERS as Record<MacroRegime, unknown>, computeHash(input.runId), tick + 1);
  const confidenceDecay = computeDecayRate(regime, M18_BOUNDS.BASE_DECAY_RATE);

  const hintIdx = seededIndex(computeHash(`M18ML:${input.runId}:${tick}:${blocked}:${magnitude}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintIdx] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `blocked=${blocked ? 'yes' : 'no'}`,
    `kind=${ev?.sabotageKind ?? 'NONE'}`,
    `impactScore=${impactScore.toFixed(2)}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation =
    blocked
      ? 'Sabotage was blocked: pivot to tempo and clean execution instead of forcing risk.'
      : impactScore >= 0.75
        ? 'High-impact sabotage: prioritize counterplay, stabilize cash, and avoid optional actions until it expires.'
        : impactScore >= 0.45
          ? 'Moderate sabotage: tighten decisions and protect buffer while tracking decay.'
          : 'Low sabotage impact: log it for audit and maintain tempo.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M18'),
    confidenceDecay,
  };
}