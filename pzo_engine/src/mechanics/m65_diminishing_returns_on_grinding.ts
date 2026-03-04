// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m65_diminishing_returns_on_grinding.ts
//
// Mechanic : M65 — Diminishing Returns on Grinding
// Family   : achievement_advanced   Layer: season_runtime   Priority: 1   Batch: 2
// ML Pair  : m65a
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

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M65Input {
  // Optional snapshot passthrough (season runtime may provide these)
  runId?: string;
  tick?: number;

  trophyEarnedCount?: number; // trophies earned within current grind window/session
  sessionRunCount?: number;   // runs completed within current grind window/session
}

export interface M65Output {
  decayedTrophyAmount: number;
  grindGuardApplied: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M65Event = 'DIMINISHING_RETURN_APPLIED' | 'GRIND_GUARD_TRIGGERED' | 'NORMAL_RATE_RESTORED';

export interface M65TelemetryPayload extends MechanicTelemetryPayload {
  event: M65Event;
  mechanic_id: 'M65';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M65_BOUNDS = {
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

// ── Internal helpers ───────────────────────────────────────────────────────

type _M65_AllTypeImportsUsed = {
  a: RunPhase;
  b: TickTier;
  c: MacroRegime;
  d: PressureTier;
  e: SolvencyStatus;
  f: Asset;
  g: IPAItem;
  h: GameCard;
  i: GameEvent;
  j: ShieldLayer;
  k: Debt;
  l: Buff;
  m: Liability;
  n: SetBonus;
  o: AssetMod;
  p: IncomeItem;
  q: MacroEvent;
  r: ChaosWindow;
  s: AuctionResult;
  t: PurchaseResult;
  u: ShieldResult;
  v: ExitResult;
  w: TickResult;
  x: DeckComposition;
  y: TierProgress;
  z: WipeEvent;
  aa: RegimeShiftEvent;
  ab: PhaseTransitionEvent;
  ac: TimerExpiredEvent;
  ad: StreakEvent;
  ae: FubarEvent;
  af: LedgerEntry;
  ag: ProofCard;
  ah: CompletedRun;
  ai: SeasonState;
  aj: RunState;
  ak: MomentEvent;
  al: ClipBoundary;
  am: MechanicTelemetryPayload;
  an: MechanicEmitter;
};

function m65LongHash(s: string): string {
  const h1 = computeHash(s);
  const h2 = computeHash(h1 + ':' + s);
  const h3 = computeHash(h2 + ':' + h1);
  return (h1 + h2 + h3).slice(0, 32);
}

function m65DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.33)) return 'EARLY';
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.66)) return 'MID';
  return 'LATE';
}

function m65ResolveRegime(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN).slice().sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of schedule) {
    if (ev.tick <= tick && ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m65InChaos(seed: string, tick: number): { inChaos: boolean; window: ChaosWindow | null } {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return { inChaos: true, window: w };
  }
  return { inChaos: false, window: null };
}

function m65PressureTierFromGrind(trophyEarnedCount: number, sessionRunCount: number, inChaos: boolean): PressureTier {
  const t = clamp(trophyEarnedCount, 0, 1_000);
  const r = clamp(sessionRunCount, 0, 1_000);

  const idx =
    clamp(t / 12, 0, 1) * 0.55 +
    clamp(r / 16, 0, 1) * 0.35 +
    (inChaos ? 0.10 : 0.0);

  if (idx <= 0.25) return 'LOW';
  if (idx <= 0.50) return 'MEDIUM';
  if (idx <= 0.75) return 'HIGH';
  return 'CRITICAL';
}

function m65PickReferenceCard(seed: string, tick: number, phase: RunPhase, regime: MacroRegime, pressureTier: PressureTier): GameCard {
  const pW = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const rW = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:m65:${tick}`, pW, rW);
  const effectivePool = pool.length > 0 ? pool : OPPORTUNITY_POOL;

  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m65:deck`);
  const pickedId = deck[seededIndex(seed, tick, deck.length)] ?? DEFAULT_CARD.id;

  const fromPool = effectivePool.find(c => c.id === pickedId);
  if (fromPool) return fromPool;

  const fromOpp = OPPORTUNITY_POOL.find(c => c.id === pickedId);
  if (fromOpp) return fromOpp;

  return DEFAULT_CARD;
}

function m65ComputeDecayFactor(
  trophyEarnedCount: number,
  sessionRunCount: number,
  decay: number,
  regime: MacroRegime,
  inChaos: boolean,
): { factor: number; guard: boolean } {
  // Base grind intensity: higher => more decay.
  const trophies = clamp(trophyEarnedCount, 0, 1_000);
  const runs = clamp(sessionRunCount, 0, 1_000);

  const intensity =
    clamp(trophies / 10, 0, 3) * 0.60 +
    clamp(runs / 14, 0, 3) * 0.40;

  // Regime effects: crises punish grinding harder; bull markets soften (bounded).
  const regimeMult =
    regime === 'CRISIS' ? 1.20 :
    regime === 'BEAR' ? 1.10 :
    regime === 'NEUTRAL' ? 1.00 : 0.92;

  const chaosMult = inChaos ? 1.08 : 1.00;

  // Combine with computeDecayRate output (already regime-aware in your lib).
  const combined = clamp((decay * 3.5 + intensity * 0.12) * regimeMult * chaosMult, 0, 0.92);

  // Decay factor applied to trophy payout: 1 means no decay, 0 means fully decayed.
  const factor = clamp(1 - combined, 0.05, 1.0);

  // Grind guard triggers when intensity breaches a threshold
  const guard = trophies >= 15 || runs >= 20 || combined >= 0.55;

  return { factor, guard };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * diminishingReturnEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function diminishingReturnEngine(
  input: M65Input,
  emit: MechanicEmitter,
): M65Output {
  const __typeSentinel: _M65_AllTypeImportsUsed | null = null;
  void __typeSentinel;

  const trophyEarnedCount = clamp(Number(input.trophyEarnedCount ?? 0) || 0, 0, 10_000);
  const sessionRunCount = clamp(Number(input.sessionRunCount ?? 0) || 0, 0, 10_000);

  const runId =
    String(input.runId ?? '') ||
    m65LongHash(['M65', String(trophyEarnedCount), String(sessionRunCount), JSON.stringify(DEFAULT_CARD_IDS.slice(0, 12))].join(':'));

  const tick = clamp(
    typeof input.tick === 'number' ? input.tick : seededIndex(runId, 65, RUN_TOTAL_TICKS),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  const phase = m65DerivePhase(tick);
  const regime = m65ResolveRegime(runId, tick);
  const { inChaos, window } = m65InChaos(runId, tick);

  const pressureTier = m65PressureTierFromGrind(trophyEarnedCount, sessionRunCount, inChaos);

  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decay = computeDecayRate(regime, M65_BOUNDS.BASE_DECAY_RATE);

  // deterministic deck/econ anchor so the grind guard can't be gamed via timing
  const referenceCard = m65PickReferenceCard(runId, tick, phase, regime, pressureTier);
  const cardCost = Number(referenceCard.cost ?? 0) || 0;
  const cardDown = Number(referenceCard.downPayment ?? 0) || 0;

  // baseline trophy amount (what would have been awarded without decay)
  const baselineTrophyAmount =
    clamp(Math.round((trophyEarnedCount * 125) + (sessionRunCount * 85)), 0, M65_BOUNDS.MAX_AMOUNT) +
    clamp(Math.round((cardCost + cardDown) * 0.08), 0, 8_000);

  const { factor, guard } = m65ComputeDecayFactor(trophyEarnedCount, sessionRunCount, decay, regime, inChaos);

  // Apply multipliers and decay factor, then cap.
  const decayedTrophyAmount = clamp(
    Math.round(baselineTrophyAmount * factor * clamp(regimeMult * exitPulse, 0.35, 3.25) * M65_BOUNDS.EFFECT_MULTIPLIER),
    0,
    M65_BOUNDS.MAX_AMOUNT,
  );

  const grindGuardApplied =
    guard ||
    trophyEarnedCount >= M65_BOUNDS.TRIGGER_THRESHOLD * 5 ||
    sessionRunCount >= M65_BOUNDS.TRIGGER_THRESHOLD * 7;

  emit({
    event: 'DIMINISHING_RETURN_APPLIED',
    mechanic_id: 'M65',
    tick,
    runId,
    payload: {
      trophyEarnedCount,
      sessionRunCount,
      baselineTrophyAmount,
      decayedTrophyAmount,
      decayFactor: factor,
      grindGuardApplied,
      regime,
      phase,
      pressureTier,
      inChaos,
      chaosWindow: window,
      referenceCardId: referenceCard.id,
      pressurePhaseWeight,
      regimeWeight,
      regimeMult,
      exitPulse,
      decay,
    },
  });

  if (grindGuardApplied) {
    emit({
      event: 'GRIND_GUARD_TRIGGERED',
      mechanic_id: 'M65',
      tick,
      runId,
      payload: {
        trophyEarnedCount,
        sessionRunCount,
        decayedTrophyAmount,
        decayFactor: factor,
        regime,
        inChaos,
      },
    });
  } else {
    emit({
      event: 'NORMAL_RATE_RESTORED',
      mechanic_id: 'M65',
      tick,
      runId,
      payload: {
        trophyEarnedCount,
        sessionRunCount,
        decayedTrophyAmount,
        decayFactor: factor,
      },
    });
  }

  return {
    decayedTrophyAmount,
    grindGuardApplied,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M65MLInput {
  decayedTrophyAmount?: number;
  grindGuardApplied?: boolean;
  runId: string;
  tick: number;
}

export interface M65MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * diminishingReturnEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function diminishingReturnEngineMLCompanion(
  input: M65MLInput,
): Promise<M65MLOutput> {
  const amount = clamp(Number(input.decayedTrophyAmount ?? 0) || 0, 0, M65_BOUNDS.MAX_AMOUNT);
  const guard = Boolean(input.grindGuardApplied);

  // Higher decay (lower amount) and guard=true => stronger "warning" signal
  const normalized = 1 - clamp(amount / M65_BOUNDS.MAX_AMOUNT, 0, 1);
  const score = clamp((normalized * 0.78) + (guard ? 0.18 : 0.05), 0.01, 0.99);

  const topFactors: string[] = [
    `Decayed=${Math.round(amount)}`,
    guard ? 'Grind guard active' : 'Grind guard inactive',
    `Tick=${input.tick}`,
  ].slice(0, 5);

  const recommendation =
    guard
      ? 'Throttle runs and diversify objectives to restore normal trophy rate.'
      : 'Maintain pacing; avoid spike-grinding to preserve trophy efficiency.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M65'),
    confidenceDecay: clamp(0.05 + score * 0.10, 0.05, 0.22),
  };
}