// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m112_precision_split_sell_part_keep_part.ts
//
// Mechanic : M112 — Precision Split: Sell Part Keep Part
// Family   : portfolio_experimental   Layer: ui_component   Priority: 2   Batch: 3
// ML Pair  : m112a
// Deps     : M10, M32
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

export const M112_IMPORTED_SYMBOLS = {
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

export type M112_ImportedTypesAnchor = {
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

// ── Local types (keeps mechanic standalone even if upstream type exports vary) ─

export type SplitResult = {
  assetId: string;
  splitAmount: number;       // units being split
  sellPercentage: number;    // 0..100
  soldUnits: number;
  keptUnits: number;
  unitPrice: number;         // deterministic synthetic quote
  priceImpact: number;       // 0..1 (bounded)
  grossProceeds: number;     // before clamps
  cashProceeds: number;      // bounded output
  regime: MacroRegime;
  phase: RunPhase;
  pressure: PressureTier;
  tickTier: TickTier;
  auditHash: string;
  deckSig: string[];
  themeCardId: string;
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M112Input {
  assetId?: string;
  splitAmount?: number;        // units to split
  sellPercentage?: number;     // 0..100

  // Optional, backward-compatible additions (keeps existing callers intact)
  runId?: string;
  tick?: number;
  stateMacroRegime?: MacroRegime;
}

export interface M112Output {
  splitResult: SplitResult;
  cashFromSplit: number;
  remainingHolding: Record<string, unknown>;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M112Event = 'PRECISION_SPLIT_EXECUTED' | 'SPLIT_AMOUNT_CONFIRMED' | 'HOLDING_UPDATED';

export interface M112TelemetryPayload extends MechanicTelemetryPayload {
  event: M112Event;
  mechanic_id: 'M112';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M112_BOUNDS = {
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

function m112ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

function m112NormalizeRegime(v: unknown): MacroRegime {
  switch (v) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return v;
    // deterministic mappings for stray labels that may leak in
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

function m112PhaseFromTick(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m112ChaosActive(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m112PressureFrom(phase: RunPhase, chaosActive: boolean): PressureTier {
  if (chaosActive) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m112TickTierFromPressure(p: PressureTier): TickTier {
  if (p === 'CRITICAL') return 'CRITICAL';
  if (p === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m112RegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  let r: MacroRegime = fallback;
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = m112NormalizeRegime(ev.regimeChange);
  }
  return r;
}

function m112StableRunId(input: M112Input, tick: number): string {
  const explicit = typeof input.runId === 'string' ? input.runId.trim() : '';
  if (explicit.length > 0) return explicit;
  return computeHash(`M112:run:${tick}:${String(input.assetId ?? '')}:${String(input.splitAmount ?? '')}:${String(input.sellPercentage ?? '')}`);
}

function m112SafeAmount(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return clamp(v, 0, M112_BOUNDS.MAX_AMOUNT);
}

function m112SafePct(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return clamp(v, 0, 100);
}

function m112DeterministicQuote(seed: string, tick: number, regime: MacroRegime, phase: RunPhase, pressure: PressureTier): {
  unitPrice: number;
  priceImpact: number;
  themeCard: GameCard;
  deckSig: string[];
} {
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M112_BOUNDS.BASE_DECAY_RATE);

  // deterministic theme selection (uses buildWeightedPool + opportunity fallback + default)
  const pool = buildWeightedPool(`${seed}:pool`, phaseW * pressureW, regimeW * regimeMul);
  const themeCard =
    (pool[seededIndex(`${seed}:theme`, tick + 11, Math.max(1, pool.length))] as GameCard | undefined) ??
    OPPORTUNITY_POOL[seededIndex(`${seed}:opp`, tick + 31, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deck`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  // base quote: 25..525, then modulated
  const base = 25 + seededIndex(`${seed}:basePx`, tick + 7, 501); // 25..525
  const macro = clamp(regimeMul * exitPulse, 0.25, 2.25);
  const tempo = clamp(phaseW * pressureW, 0.50, 2.50);
  const stability = clamp(1 - decay, 0.25, 1.0);

  const rawPx = base * macro * tempo * stability;

  // impact: bounded by decay + pressure + tick pulse; 0..1
  const pulse = tick % M112_BOUNDS.PULSE_CYCLE === 0 ? 0.05 : 0;
  const impactRaw = clamp(decay * 2.0 + (pressure === 'CRITICAL' ? 0.12 : pressure === 'HIGH' ? 0.07 : 0.03) + pulse, 0, 0.35);

  // final price (min 1)
  const unitPrice = Math.max(1, Math.round(rawPx * (1 - impactRaw)));

  return { unitPrice, priceImpact: impactRaw, themeCard, deckSig };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * precisionSplitExecutor
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function precisionSplitExecutor(input: M112Input, emit: MechanicEmitter): M112Output {
  const assetId = String(input.assetId ?? '').trim();
  const splitAmount = m112SafeAmount(input.splitAmount);
  const sellPercentage = m112SafePct(input.sellPercentage);

  const tick =
    typeof input.tick === 'number' && Number.isFinite(input.tick)
      ? m112ClampTick(input.tick)
      : m112ClampTick(seededIndex(computeHash(`M112:tick:${assetId}:${splitAmount}:${sellPercentage}`), 0, RUN_TOTAL_TICKS));

  const runId = m112StableRunId(input, tick);
  const seed = computeHash(`M112:${runId}:${tick}:${assetId}:${splitAmount}:${sellPercentage}`);

  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const phase = m112PhaseFromTick(tick);
  const chaosActive = m112ChaosActive(tick, chaosWindows);
  const pressure = m112PressureFrom(phase, chaosActive);
  const tickTier = m112TickTierFromPressure(pressure);

  const fallbackRegime = m112NormalizeRegime(input.stateMacroRegime ?? 'NEUTRAL');
  const regime = m112RegimeFromSchedule(tick, macroSchedule, fallbackRegime);

  const { unitPrice, priceImpact, themeCard, deckSig } = m112DeterministicQuote(seed, tick, regime, phase, pressure);

  const soldUnits = clamp(Math.round(splitAmount * (sellPercentage / 100) * 1_000_000) / 1_000_000, 0, splitAmount);
  const keptUnits = clamp(splitAmount - soldUnits, 0, splitAmount);

  const grossProceeds = soldUnits * unitPrice;

  // bounded cash proceeds (never negative, never above hard cap)
  const cashProceeds = clamp(Math.round(grossProceeds), 0, M112_BOUNDS.MAX_PROCEEDS);

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M112',
      runId,
      tick,
      assetId,
      splitAmount,
      sellPercentage,
      soldUnits,
      keptUnits,
      unitPrice,
      priceImpact,
      grossProceeds,
      cashProceeds,
      regime,
      phase,
      pressure,
      tickTier,
      themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
      deckSig,
    }),
  );

  // Telemetry: confirm amount, execute, then holding update
  emit({
    event: 'SPLIT_AMOUNT_CONFIRMED',
    mechanic_id: 'M112',
    tick,
    runId,
    payload: {
      assetId,
      splitAmount,
      sellPercentage,
      soldUnits,
      keptUnits,
      auditHash,
    },
  });

  emit({
    event: 'PRECISION_SPLIT_EXECUTED',
    mechanic_id: 'M112',
    tick,
    runId,
    payload: {
      assetId,
      unitPrice,
      priceImpact,
      grossProceeds,
      cashProceeds,
      regime,
      phase,
      pressure,
      tickTier,
      macroEventsPlanned: MACRO_EVENTS_PER_RUN,
      chaosWindowsPlanned: CHAOS_WINDOWS_PER_RUN,
      themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
      deckSig,
      auditHash,
    },
  });

  const remainingHolding: Record<string, unknown> = {
    assetId,
    remainingUnits: keptUnits,
    soldUnits,
    lastSplitTick: tick,
    regime,
    phase,
    pressure,
    tickTier,
    themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
    deckSig,
    auditHash,
  };

  emit({
    event: 'HOLDING_UPDATED',
    mechanic_id: 'M112',
    tick,
    runId,
    payload: {
      assetId,
      remainingUnits: keptUnits,
      cashAdded: cashProceeds,
      auditHash,
    },
  });

  const splitResult: SplitResult = {
    assetId,
    splitAmount,
    sellPercentage,
    soldUnits,
    keptUnits,
    unitPrice,
    priceImpact,
    grossProceeds,
    cashProceeds,
    regime,
    phase,
    pressure,
    tickTier,
    auditHash,
    deckSig,
    themeCardId: String((themeCard as unknown as { id?: unknown }).id ?? ''),
  };

  return {
    splitResult,
    cashFromSplit: cashProceeds,
    remainingHolding,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M112MLInput {
  splitResult?: SplitResult;
  cashFromSplit?: number;
  remainingHolding?: Record<string, unknown>;
  runId: string;
  tick: number;
}

export interface M112MLOutput {
  score: number;          // 0–1
  topFactors: string[];   // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string;      // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;// 0–1, how fast this signal should decay
}

/**
 * precisionSplitExecutorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function precisionSplitExecutorMLCompanion(input: M112MLInput): Promise<M112MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));

  const topFactors: string[] = [];
  if (input.splitResult) topFactors.push('Split computed');
  if ((input.cashFromSplit ?? 0) > 0) topFactors.push('Cash realized');
  if (input.remainingHolding) topFactors.push('Holding updated');
  topFactors.push('Advisory only');

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: (input.cashFromSplit ?? 0) > 0 ? 'Verify proceeds and rebalance risk.' : 'Consider adjusting sell percentage.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M112'),
    confidenceDecay: 0.05,
  };
}