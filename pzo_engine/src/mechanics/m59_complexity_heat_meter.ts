// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m59_complexity_heat_meter.ts
//
// Mechanic : M59 — Complexity Heat Meter
// Family   : portfolio_advanced   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m59a
// Deps     : M31, M34
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

export interface M59Input {
  // Optional context (if router provides it)
  runId?: string;
  tick?: number;
  phase?: RunPhase;
  pressureTier?: PressureTier;
  macroRegime?: MacroRegime;
  tickTier?: TickTier;
  solvencyStatus?: SolvencyStatus;

  // Primary state sources
  stateActiveSetBonuses?: SetBonus[];
  stateAssetMods?: AssetMod[];
}

export interface M59Output {
  complexityHeat: number;
  overloadWarning: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M59Event = 'COMPLEXITY_HEAT_UPDATED' | 'OVERLOAD_WARNING' | 'COMPLEXITY_CAP_HIT';

export interface M59TelemetryPayload extends MechanicTelemetryPayload {
  event: M59Event;
  mechanic_id: 'M59';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M59_BOUNDS = {
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

type _M59_AllTypeImportsUsed = {
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

function m59DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.33)) return 'EARLY';
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.66)) return 'MID';
  return 'LATE';
}

function m59DerivePressureTier(bonusCount: number, modCount: number, inChaos: boolean): PressureTier {
  const n = bonusCount + modCount + (inChaos ? 1 : 0);
  if (n <= 1) return 'LOW';
  if (n <= 3) return 'MEDIUM';
  if (n <= 5) return 'HIGH';
  return 'CRITICAL';
}

function m59ResolveRegime(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN).slice().sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of schedule) {
    if (ev.tick <= tick && ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m59IsInChaosWindow(seed: string, tick: number): { inChaos: boolean; window: ChaosWindow | null } {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return { inChaos: true, window: w };
  }
  return { inChaos: false, window: null };
}

function m59PickCard(seed: string, tick: number, pool: GameCard[]): GameCard {
  const deck = seededShuffle(DEFAULT_CARD_IDS, seed);
  const pickedId = deck[seededIndex(seed, tick, deck.length)] ?? DEFAULT_CARD.id;

  const fromPool = pool.find(c => c.id === pickedId);
  if (fromPool) return fromPool;

  const fromOpp = OPPORTUNITY_POOL.find(c => c.id === pickedId);
  if (fromOpp) return fromOpp;

  return DEFAULT_CARD;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * complexityHeatMeter
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function complexityHeatMeter(
  input: M59Input,
  emit: MechanicEmitter,
): M59Output {
  // Type-import sentinel: keeps every type import "used" without impacting runtime.
  const __typeSentinel: _M59_AllTypeImportsUsed | null = null;
  void __typeSentinel;

  const stateActiveSetBonuses = (input.stateActiveSetBonuses as SetBonus[]) ?? [];
  const stateAssetMods = (input.stateAssetMods as AssetMod[]) ?? [];

  const derivedSeed = computeHash(
    [
      'M59',
      input.runId ?? '',
      String(input.tick ?? ''),
      JSON.stringify(stateActiveSetBonuses.map(b => (b as any)?.id ?? '').slice(0, 16)),
      JSON.stringify(stateAssetMods.map(m => (m as any)?.id ?? '').slice(0, 16)),
    ].join(':'),
  );

  const runId = input.runId ?? derivedSeed;

  const tick = clamp(
    input.tick ?? seededIndex(runId, 59, RUN_TOTAL_TICKS),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  const { inChaos, window } = m59IsInChaosWindow(runId, tick);

  const regime: MacroRegime = input.macroRegime ?? m59ResolveRegime(runId, tick);

  const phase: RunPhase = input.phase ?? m59DerivePhase(tick);

  const pressureTier: PressureTier =
    input.pressureTier ?? m59DerivePressureTier(stateActiveSetBonuses.length, stateAssetMods.length, inChaos);

  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const weightedPool = buildWeightedPool(`${runId}:m59:${tick}`, pressurePhaseWeight, regimeWeight);

  // Ensure OPPORTUNITY_POOL is referenced even if weightedPool is empty (it shouldn't be).
  const pool = weightedPool.length > 0 ? weightedPool : OPPORTUNITY_POOL;

  const pickedCard = m59PickCard(runId, tick, pool);

  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulseMult = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decay = computeDecayRate(regime, M59_BOUNDS.BASE_DECAY_RATE);

  const bonusHeat = Math.min(M59_BOUNDS.MAX_AMOUNT, stateActiveSetBonuses.length * 2_500);
  const modHeat = Math.min(M59_BOUNDS.MAX_AMOUNT, stateAssetMods.length * 2_000);

  const cardCost = Number(pickedCard.cost ?? 0) || 0;
  const cardDown = Number(pickedCard.downPayment ?? 0) || 0;

  const cardHeat = Math.min(M59_BOUNDS.MAX_AMOUNT, Math.floor((cardCost + cardDown) * 0.15));

  const chaosHeat = inChaos ? Math.floor(M59_BOUNDS.REGIME_SHIFT_THRESHOLD * 0.35) : 0;

  const rawHeat =
    (bonusHeat + modHeat + cardHeat + chaosHeat) *
    M59_BOUNDS.MULTIPLIER *
    M59_BOUNDS.EFFECT_MULTIPLIER *
    regimeMult *
    exitPulseMult *
    (1 - decay);

  const complexityHeat = clamp(Math.round(rawHeat), M59_BOUNDS.MIN_EFFECT, M59_BOUNDS.MAX_EFFECT);

  const overloadWarning =
    (stateActiveSetBonuses.length + stateAssetMods.length) >= M59_BOUNDS.TRIGGER_THRESHOLD ||
    complexityHeat >= M59_BOUNDS.REGIME_SHIFT_THRESHOLD ||
    pressureTier === 'CRITICAL';

  emit({
    event: 'COMPLEXITY_HEAT_UPDATED',
    mechanic_id: 'M59',
    tick,
    runId,
    payload: {
      complexityHeat,
      overloadWarning,
      regime,
      phase,
      pressureTier,
      inChaos,
      chaosWindow: window,
      pressurePhaseWeight,
      regimeWeight,
      decay,
      pickedCardId: pickedCard.id,
      poolSize: pool.length,
    },
  });

  if (overloadWarning) {
    emit({
      event: 'OVERLOAD_WARNING',
      mechanic_id: 'M59',
      tick,
      runId,
      payload: {
        complexityHeat,
        regime,
        phase,
        pressureTier,
        activeSetBonuses: stateActiveSetBonuses.length,
        assetMods: stateAssetMods.length,
        inChaos,
        pickedCardId: pickedCard.id,
      },
    });
  }

  if (complexityHeat >= M59_BOUNDS.MAX_EFFECT) {
    emit({
      event: 'COMPLEXITY_CAP_HIT',
      mechanic_id: 'M59',
      tick,
      runId,
      payload: { complexityHeat },
    });
  }

  return {
    complexityHeat,
    overloadWarning,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M59MLInput {
  complexityHeat?: number;
  overloadWarning?: boolean;
  runId: string;
  tick: number;
}

export interface M59MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * complexityHeatMeterMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function complexityHeatMeterMLCompanion(
  input: M59MLInput,
): Promise<M59MLOutput> {
  const heat = Number(input.complexityHeat ?? 0) || 0;
  const overloaded = Boolean(input.overloadWarning);

  const score = clamp((heat / M59_BOUNDS.MAX_EFFECT) * (overloaded ? 1.15 : 0.95), 0.01, 0.99);

  const topFactors: string[] = [
    overloaded ? 'Overload warning active' : 'No overload warning',
    `Heat=${Math.round(heat)}`,
    `Tick=${input.tick}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: overloaded
      ? 'Reduce modifiers or consolidate bonuses before adding new complexity.'
      : 'Maintain current complexity; only add new layers if heat stays stable.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M59'),
    confidenceDecay: clamp(0.02 + score * 0.10, 0.02, 0.25),
  };
}