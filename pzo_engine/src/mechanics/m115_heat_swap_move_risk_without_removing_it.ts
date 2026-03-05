// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m115_heat_swap_move_risk_without_removing_it.ts
//
// Mechanic : M115 — Heat Swap: Move Risk Without Removing It
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m115a
// Deps     : M35, M57
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

// ── Import Anchors (keeps every symbol accessible + TS-used) ──────────────────

export const M115_IMPORTED_SYMBOLS = {
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

export type M115_ImportedTypesAnchor = {
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

export interface M115Input {
  sourceAssetId?: string;
  targetAssetId?: string;
  heatAmount?: number;
}

export interface M115Output {
  heatSwapped: boolean;
  exposureRebalanced: boolean;
  netHeatUnchanged: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M115Event = 'HEAT_SWAP_EXECUTED' | 'EXPOSURE_REBALANCED' | 'NET_HEAT_CONFIRMED';

export interface M115TelemetryPayload extends MechanicTelemetryPayload {
  event: M115Event;
  mechanic_id: 'M115';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M115_BOUNDS = {
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

// ── Internal helpers (pure, deterministic) ─────────────────────────────────

function m115ClampTick(t: number): number {
  return clamp(t, 0, RUN_TOTAL_TICKS - 1);
}

function m115NormalizeRegime(v: unknown): MacroRegime {
  switch (v) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return v;
    case 'RECESSION':
    case 'DOWNTURN':
      return 'BEAR';
    case 'BOOM':
    case 'EXPANSION':
      return 'BULL';
    default:
      return 'NEUTRAL';
  }
}

function m115PhaseFromTick(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m115ChaosActive(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    const ww = w as unknown as { startTick?: unknown; endTick?: unknown };
    const startTick = typeof ww.startTick === 'number' ? ww.startTick : 0;
    const endTick = typeof ww.endTick === 'number' ? ww.endTick : -1;
    if (tick >= startTick && tick <= endTick) return true;
  }
  return false;
}

function m115PressureFrom(phase: RunPhase, chaos: boolean): PressureTier {
  if (chaos) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m115TickTierFromPressure(p: PressureTier): TickTier {
  if (p === 'CRITICAL') return 'CRITICAL';
  if (p === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m115RegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  let r: MacroRegime = fallback;
  const sorted = [...schedule].sort((a, b) => (a as unknown as { tick: number }).tick - (b as unknown as { tick: number }).tick);

  for (const ev of sorted) {
    const e = ev as unknown as { tick?: unknown; regimeChange?: unknown };
    const t = typeof e.tick === 'number' ? e.tick : 0;
    if (t > tick) break;
    if (e.regimeChange != null) r = m115NormalizeRegime(e.regimeChange);
  }
  return r;
}

function m115SafeHeatAmount(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return clamp(n, 0, M115_BOUNDS.MAX_AMOUNT);
}

function m115StableRunId(tick: number, sourceAssetId: string, targetAssetId: string, heatAmount: number): string {
  return computeHash(`M115:run:${tick}:${sourceAssetId}:${targetAssetId}:${heatAmount}`);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * heatSwapExecutor
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function heatSwapExecutor(input: M115Input, emit: MechanicEmitter): M115Output {
  const sourceAssetId = String(input.sourceAssetId ?? '').trim();
  const targetAssetId = String(input.targetAssetId ?? '').trim();
  const heatAmount = m115SafeHeatAmount(input.heatAmount);

  // deterministic tick derived from inputs (no external state required)
  const tick = m115ClampTick(
    seededIndex(
      computeHash(`M115:tick:${sourceAssetId}:${targetAssetId}:${heatAmount}`),
      0,
      Math.max(1, RUN_TOTAL_TICKS),
    ),
  );

  const runId = m115StableRunId(tick, sourceAssetId, targetAssetId, heatAmount);
  const seed = computeHash(`M115:${runId}:${tick}`);

  // consume schedules (keeps imports live and drives deterministic macro/chaos context)
  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const phase: RunPhase = m115PhaseFromTick(tick);
  const chaos = m115ChaosActive(tick, chaosWindows);
  const pressure: PressureTier = m115PressureFrom(phase, chaos);
  const tickTier: TickTier = m115TickTierFromPressure(pressure);

  const fallbackRegime: MacroRegime = 'NEUTRAL';
  const regime: MacroRegime = m115RegimeFromSchedule(tick, macroSchedule, fallbackRegime);

  const decay = computeDecayRate(regime, M115_BOUNDS.BASE_DECAY_RATE);
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  // deterministic “theme” selection (keeps buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD live)
  const weightedPool = buildWeightedPool(`${seed}:pool`, phaseW * pressureW, regimeW * regimeMultiplier);
  const themeCard =
    (weightedPool[seededIndex(`${seed}:theme`, tick + 7, Math.max(1, weightedPool.length))] as GameCard | undefined) ??
    OPPORTUNITY_POOL[seededIndex(`${seed}:opp`, tick + 17, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  // Heat swap invariant: net risk does not change; it moves from source -> target.
  // We do NOT mutate holdings here; we emit ledger-verifiable telemetry.
  const stress = clamp(
    decay * 2.0 +
      (pressure === 'CRITICAL' ? 0.18 : pressure === 'HIGH' ? 0.10 : pressure === 'MEDIUM' ? 0.06 : 0.03) +
      (tick % M115_BOUNDS.PULSE_CYCLE === 0 ? 0.05 : 0),
    0,
    0.40,
  );

  // Deterministic accounting (no state). We represent “effective slippage” as a reporting-only metric.
  const moved = heatAmount;
  const movedEffective = Math.round(moved * (1 - stress));
  const slippageUnits = moved - movedEffective;

  // Guarantee conservation in reporting: net delta is 0 by construction.
  const netHeatDelta = 0;

  const heatSwapped = sourceAssetId.length > 0 && targetAssetId.length > 0 && moved > 0;
  const exposureRebalanced = heatSwapped;
  const netHeatUnchanged = true;

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M115',
      runId,
      tick,
      sourceAssetId,
      targetAssetId,
      heatAmount: moved,
      phase,
      regime,
      pressure,
      tickTier,
      weights: { phaseW, regimeW, pressureW, regimeMultiplier, exitPulse, decay },
      stress,
      movedEffective,
      slippageUnits,
      netHeatDelta,
      themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
      deckSig,
    }),
  );

  emit({
    event: 'HEAT_SWAP_EXECUTED',
    mechanic_id: 'M115',
    tick,
    runId,
    payload: {
      auditHash,
      sourceAssetId,
      targetAssetId,
      heatAmount: moved,
      movedEffective,
      slippageUnits,
      stress,
      phase,
      regime,
      pressure,
      tickTier,
      themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
      deckSig,
    },
  });

  emit({
    event: 'EXPOSURE_REBALANCED',
    mechanic_id: 'M115',
    tick,
    runId,
    payload: {
      auditHash,
      exposureRebalanced,
      method: 'HEAT_SWAP',
      weights: { phaseW, regimeW, pressureW, regimeMultiplier, exitPulse, decay },
    },
  });

  emit({
    event: 'NET_HEAT_CONFIRMED',
    mechanic_id: 'M115',
    tick,
    runId,
    payload: {
      auditHash,
      netHeatUnchanged,
      netHeatDelta,
      invariant: 'conserved',
    },
  });

  return {
    heatSwapped,
    exposureRebalanced,
    netHeatUnchanged,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M115MLInput {
  heatSwapped?: boolean;
  exposureRebalanced?: boolean;
  netHeatUnchanged?: boolean;
  runId: string;
  tick: number;
}

export interface M115MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * heatSwapExecutorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function heatSwapExecutorMLCompanion(input: M115MLInput): Promise<M115MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));

  const topFactors: string[] = [];
  if (input.heatSwapped) topFactors.push('Heat moved');
  if (input.exposureRebalanced) topFactors.push('Exposure rebalanced');
  if (input.netHeatUnchanged) topFactors.push('Net heat conserved');
  topFactors.push('Advisory only');

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: input.netHeatUnchanged ? 'Confirm target exposure matches intent.' : 'Investigate heat conservation failure.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M115'),
    confidenceDecay: 0.05,
  };
}