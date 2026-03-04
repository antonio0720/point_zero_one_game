// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m10_market_pulse_exit_engine.ts
//
// Mechanic : M10 — Market Pulse Exit Engine
// Family   : run_core   Layer: card_handler   Priority: 1   Batch: 1
// ML Pair  : m10a
// Deps     : M05, M09
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
export const M10_IMPORTED_SYMBOLS = {
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
export type M10_ImportedTypesAnchor = {
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

export interface M10Input {
  stateAssets?: Asset[];
  stateMacroRegime?: MacroRegime;
  exitCard?: GameCard;
  stateTick?: number;
}

export interface M10Output {
  exitResult: ExitResult;
  saleProceeds: number;
  capitalGain: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M10Event =
  | 'ASSET_EXITED'
  | 'EXIT_TIMING_SCORED'
  | 'MARKET_PULSE_READ'
  | 'CAPITAL_GAIN_REALIZED';

export interface M10TelemetryPayload extends MechanicTelemetryPayload {
  event: M10Event;
  mechanic_id: 'M10';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M10_BOUNDS = {
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

function m10DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m10InChaosWindow(tick: number, chaosWindows: ChaosWindow[]): boolean {
  for (const w of chaosWindows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m10DeriveRegimeFromSchedule(
  tick: number,
  macroSchedule: MacroEvent[],
  fallback: MacroRegime,
): MacroRegime {
  if (!macroSchedule || macroSchedule.length === 0) return fallback;
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m10DerivePressureTier(tick: number, phase: RunPhase, chaosWindows: ChaosWindow[]): PressureTier {
  if (m10InChaosWindow(tick, chaosWindows)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

type M10PulseContext = {
  seed: string;
  tick: number;
  phase: RunPhase;
  pressure: PressureTier;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  regime: MacroRegime;
  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
  regimeMultiplier: number;
  exitPulse: number;
  decayRate: number;
  deckShuffle: string[];
  opportunityPick: GameCard;
  weightedPoolPick: GameCard;
  inChaos: boolean;
};

function m10BuildPulseContext(
  tick: number,
  macroRegime: MacroRegime,
  exitCard: GameCard,
  assets: Asset[],
): M10PulseContext {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);

  const seedCore = computeHash(`${exitCard.id}:M10:${macroRegime}:${t}:${assets.length}`);
  const macroSchedule = buildMacroSchedule(seedCore, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seedCore, CHAOS_WINDOWS_PER_RUN);

  const phase = m10DerivePhase(t);
  const regime = m10DeriveRegimeFromSchedule(t, macroSchedule, macroRegime);

  const pressure = m10DerivePressureTier(t, phase, chaosWindows);
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decayRate = computeDecayRate(regime, M10_BOUNDS.BASE_DECAY_RATE);

  const deckShuffle = seededShuffle(DEFAULT_CARD_IDS, seedCore);

  const oppIdx = seededIndex(seedCore, t + 17, OPPORTUNITY_POOL.length);
  const opportunityPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const pool = buildWeightedPool(seedCore + ':pool', pressureWeight * phaseWeight, regimeWeight);
  const poolIdx = seededIndex(seedCore, t + 33, Math.max(1, pool.length));
  const weightedPoolPick = pool[poolIdx] ?? opportunityPick ?? DEFAULT_CARD;

  const inChaos = m10InChaosWindow(t, chaosWindows);

  return {
    seed: seedCore,
    tick: t,
    phase,
    pressure,
    macroSchedule,
    chaosWindows,
    regime,
    pressureWeight,
    phaseWeight,
    regimeWeight,
    regimeMultiplier,
    exitPulse,
    decayRate,
    deckShuffle,
    opportunityPick,
    weightedPoolPick,
    inChaos,
  };
}

function m10PickTargetAsset(assets: Asset[], exitCard: GameCard, seed: string, tick: number): Asset | null {
  if (!assets || assets.length === 0) return null;

  const targetId = exitCard.targetAssetId;
  if (targetId) {
    const found = assets.find(a => a.id === targetId);
    if (found) return found;
  }

  const idx = seededIndex(seed, tick + 101, assets.length);
  return assets[idx] ?? assets[0] ?? null;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * marketPulseExit
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function marketPulseExit(input: M10Input, emit: MechanicEmitter): M10Output {
  const assets = (input.stateAssets as Asset[]) ?? [];
  const macroRegime = (input.stateMacroRegime as MacroRegime) ?? 'NEUTRAL';
  const exitCard = (input.exitCard as GameCard) ?? DEFAULT_CARD;
  const currentTick = (input.stateTick as number) ?? 0;

  const ctx = m10BuildPulseContext(currentTick, macroRegime, exitCard, assets);
  const targetAsset = m10PickTargetAsset(assets, exitCard, ctx.seed, ctx.tick);

  const baseValue = targetAsset?.value ?? 0;
  const purchasePrice = targetAsset?.purchasePrice ?? 0;

  const pulseCycleFrac = clamp((ctx.tick % M10_BOUNDS.PULSE_CYCLE) / M10_BOUNDS.PULSE_CYCLE, 0, 1);

  // Deterministic timing score: cycle position + small deterministic bias from weights, penalized under chaos.
  const weightBias = clamp((ctx.phaseWeight * ctx.regimeWeight * ctx.pressureWeight) / (1.2 * 1.1 * 1.6), 0, 1);
  const timingScore = clamp(pulseCycleFrac * 0.8 + weightBias * 0.2 - (ctx.inChaos ? 0.15 : 0.0), 0, 1);

  // Deterministic proceeds: baseValue × exitPulse × regimeMultiplier × bounded multiplier
  const grossMultiplier = clamp(ctx.exitPulse * ctx.regimeMultiplier * M10_BOUNDS.MULTIPLIER, 0.01, 10);
  const saleProceeds = clamp(baseValue * grossMultiplier, 0, M10_BOUNDS.MAX_PROCEEDS);

  const capitalGain = Math.max(0, saleProceeds - purchasePrice);

  const exitResult: ExitResult = {
    assetId: targetAsset?.id ?? '',
    saleProceeds,
    capitalGain,
    timingScore,
    macroRegime: ctx.regime,
  };

  emit({
    event: 'MARKET_PULSE_READ',
    mechanic_id: 'M10',
    tick: ctx.tick,
    runId: '',
    payload: {
      seed: ctx.seed,
      regime: ctx.regime,
      phase: ctx.phase,
      pressure: ctx.pressure,
      inChaos: ctx.inChaos,
      exitPulse: ctx.exitPulse,
      regimeMultiplier: ctx.regimeMultiplier,
      grossMultiplier,
      opportunityPick: { id: ctx.opportunityPick.id, name: ctx.opportunityPick.name },
      weightedPoolPick: { id: ctx.weightedPoolPick.id, name: ctx.weightedPoolPick.name },
      deckTop: ctx.deckShuffle[0] ?? '',
    },
  });

  emit({
    event: 'EXIT_TIMING_SCORED',
    mechanic_id: 'M10',
    tick: ctx.tick,
    runId: '',
    payload: {
      pulseCycle: M10_BOUNDS.PULSE_CYCLE,
      pulseCycleFrac,
      timingScore,
      weightBias,
    },
  });

  emit({
    event: 'ASSET_EXITED',
    mechanic_id: 'M10',
    tick: ctx.tick,
    runId: '',
    payload: {
      assetId: exitResult.assetId,
      saleProceeds,
      baseValue,
      purchasePrice,
      grossMultiplier,
    },
  });

  emit({
    event: 'CAPITAL_GAIN_REALIZED',
    mechanic_id: 'M10',
    tick: ctx.tick,
    runId: '',
    payload: {
      assetId: exitResult.assetId,
      capitalGain,
      saleProceeds,
      purchasePrice,
    },
  });

  return {
    exitResult,
    saleProceeds,
    capitalGain,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M10MLInput {
  exitResult?: ExitResult;
  saleProceeds?: number;
  capitalGain?: number;
  runId: string;
  tick: number;
}

export interface M10MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * marketPulseExitMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function marketPulseExitMLCompanion(input: M10MLInput): Promise<M10MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);
  const regime = input.exitResult?.macroRegime ?? 'NEUTRAL';

  const sale = Number(input.saleProceeds ?? input.exitResult?.saleProceeds ?? 0);
  const gain = Number(input.capitalGain ?? input.exitResult?.capitalGain ?? 0);
  const timing = Number(input.exitResult?.timingScore ?? 0);

  const gainRatio = sale > 0 ? clamp(gain / sale, 0, 1) : 0;
  const score = clamp(0.35 + timing * 0.45 + gainRatio * 0.20, 0.01, 0.99);

  const decay = computeDecayRate(regime, M10_BOUNDS.BASE_DECAY_RATE);

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS} regime=${regime}`,
    `timingScore=${timing.toFixed(2)} cycle=${M10_BOUNDS.PULSE_CYCLE}`,
    `saleProceeds=${Math.round(sale)} capGain=${Math.round(gain)}`,
    `gainRatio=${gainRatio.toFixed(2)} decay=${decay.toFixed(2)}`,
    `pulseMult=${(EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0).toFixed(2)} regimeMult=${(REGIME_MULTIPLIERS[regime] ?? 1.0).toFixed(2)}`,
  ].slice(0, 5);

  const recommendation =
    score >= 0.80
      ? 'Exit looks favorable: lock the gain and redeploy into the next highest expected-value window.'
      : score >= 0.55
        ? 'Exit is acceptable: proceed if you need liquidity, otherwise wait for a cleaner pulse.'
        : 'Exit is weak: avoid forced sells; stabilize and wait for a stronger pulse or safer regime.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M10', ...input }) + ':ml:M10'),
    confidenceDecay: decay,
  };
}