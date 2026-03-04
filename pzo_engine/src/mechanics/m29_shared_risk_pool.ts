// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m29_shared_risk_pool.ts
//
// Mechanic : M29 — Shared Risk Pool
// Family   : coop_contracts   Layer: api_endpoint   Priority: 2   Batch: 1
// ML Pair  : m29a
// Deps     : M26
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

// ── Local domain types (M29-specific) ──────────────────────────────────────────
// These are intentionally local so the shared mechanics/types barrel remains stable.

export interface PoolContribution {
  contributorId: string;
  amount: number; // positive dollars (server will verify)
  tick?: number; // optional — if present improves deterministic ordering
  meta?: Record<string, unknown>;
}

export interface RiskEvent {
  id: string;
  amount: number; // dollars impact
  severity?: number; // 0..1 advisory (optional)
  kind?: string; // e.g. "REPAIR", "LEGAL", "VACANCY"
  note?: string;
}

export interface PoolPayout {
  recipientId: string | null;
  amount: number; // dollars
  cashDelta: number; // bounded cash delta applied
  cashflowDeltaMonthly: number; // bounded cashflow delta applied
  poolBalanceAfter: number; // dollars
  awardedCard: GameCard; // deterministic opportunity artifact
  regime: MacroRegime;
  phase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;
  solvencyStatus: SolvencyStatus;
  tierEscape: boolean;
  pulseTick: boolean;
  auditHash: string;
}

// ── Type touchpad (keeps the full shared types import “used” under strict TS) ──
// Exported to avoid noUnusedLocals while remaining harmless to runtime.
export interface M29TypeTouchpad {
  runPhase?: RunPhase;
  tickTier?: TickTier;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;

  asset?: Asset;
  ipaItem?: IPAItem;
  gameCard?: GameCard;
  gameEvent?: GameEvent;
  shieldLayer?: ShieldLayer;
  debt?: Debt;
  buff?: Buff;
  liability?: Liability;
  setBonus?: SetBonus;
  assetMod?: AssetMod;
  incomeItem?: IncomeItem;
  macroEvent?: MacroEvent;
  chaosWindow?: ChaosWindow;

  auctionResult?: AuctionResult;
  purchaseResult?: PurchaseResult;
  shieldResult?: ShieldResult;
  exitResult?: ExitResult;
  tickResult?: TickResult;

  deckComposition?: DeckComposition;
  tierProgress?: TierProgress;
  wipeEvent?: WipeEvent;
  regimeShiftEvent?: RegimeShiftEvent;
  phaseTransitionEvent?: PhaseTransitionEvent;
  timerExpiredEvent?: TimerExpiredEvent;
  streakEvent?: StreakEvent;
  fubarEvent?: FubarEvent;

  ledgerEntry?: LedgerEntry;
  proofCard?: ProofCard;
  completedRun?: CompletedRun;
  seasonState?: SeasonState;
  runState?: RunState;
  momentEvent?: MomentEvent;
  clipBoundary?: ClipBoundary;

  mechanicTelemetryPayload?: MechanicTelemetryPayload;
  mechanicEmitter?: MechanicEmitter;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M29Input {
  poolContributions?: PoolContribution[];
  riskEvent?: RiskEvent;

  // Optional context (if router provides it). If absent, we stay deterministic via hash.
  runId?: string;
  tick?: number;
  runPhase?: RunPhase;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;

  // Optional type touchpad (never read by runtime logic; exists for strict TS configs)
  __typeTouchpad?: M29TypeTouchpad;
}

export interface M29Output {
  poolPayout: PoolPayout;
  riskDistributed: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M29Event = 'RISK_POOL_FUNDED' | 'PAYOUT_TRIGGERED' | 'POOL_EMPTY';

export interface M29TelemetryPayload extends MechanicTelemetryPayload {
  event: M29Event;
  mechanic_id: 'M29';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M29_BOUNDS = {
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

// ── Internal helpers ─────────────────────────────────────────────────────────

function sumContributions(contribs: PoolContribution[]): number {
  let total = 0;
  for (const c of contribs) {
    const amt = Number.isFinite(c.amount) ? c.amount : 0;
    total += clamp(amt, 0, M29_BOUNDS.MAX_PROCEEDS);
  }
  return total;
}

function resolvePhaseFromTick(tick: number): RunPhase {
  const t = clamp(Math.floor(tick), 0, RUN_TOTAL_TICKS);
  const third = Math.floor(RUN_TOTAL_TICKS / 3);
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function resolveRegimeAtTick(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const e of sorted) {
    if (e.tick <= tick && e.regimeChange) regime = e.regimeChange;
  }
  return regime;
}

function isInChaosWindow(seed: string, tick: number): boolean {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function derivePressureTier(
  poolTotal: number,
  riskAmount: number,
  chaos: boolean,
  severity?: number,
): PressureTier {
  const sev = typeof severity === 'number' ? clamp(severity, 0, 1) : 0.5;
  const ratio = poolTotal <= 0 ? 1 : clamp(riskAmount / poolTotal, 0, 10);

  // deterministic + bounded: chaos and severity can escalate tier
  if (chaos || ratio >= 1.25 || sev >= 0.85) return 'CRITICAL';
  if (ratio >= 0.75 || sev >= 0.65) return 'HIGH';
  if (ratio >= 0.35 || sev >= 0.45) return 'MEDIUM';
  return 'LOW';
}

function deriveTickTier(pressure: PressureTier, pulseTick: boolean): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH' || pulseTick) return 'ELEVATED';
  return 'STANDARD';
}

function pickRecipientDeterministic(
  seed: string,
  tick: number,
  contribs: PoolContribution[],
  totalPool: number,
): string | null {
  if (contribs.length === 0 || totalPool <= 0) return null;

  // stable ordering first (tick then id), then seeded shuffle
  const stable = [...contribs].sort((a, b) => {
    const at = a.tick ?? 0;
    const bt = b.tick ?? 0;
    if (at !== bt) return at - bt;
    return a.contributorId.localeCompare(b.contributorId);
  });

  const shuffled = seededShuffle(stable, seed + ':m29:contributors:' + tick);
  const r = parseInt(computeHash(seed + ':m29:recipient:' + tick), 16) >>> 0;
  const target = r % Math.max(1, Math.floor(totalPool));

  let running = 0;
  for (const c of shuffled) {
    running += clamp(c.amount, 0, M29_BOUNDS.MAX_PROCEEDS);
    if (running >= target) return c.contributorId;
  }

  // fallback: deterministic index
  const idx = seededIndex(seed, tick, shuffled.length);
  return shuffled[idx]?.contributorId ?? null;
}

function pickAwardCard(seed: string, tick: number, phase: RunPhase, pressure: PressureTier, regime: MacroRegime): GameCard {
  const pw = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phw = PHASE_WEIGHTS[phase] ?? 1.0;
  const rw = REGIME_WEIGHTS[regime] ?? 1.0;

  // buildWeightedPool uses OPPORTUNITY_POOL under the hood; we still reference OPPORTUNITY_POOL directly below.
  const drawPool = buildWeightedPool(seed + ':m29:pool:' + tick, pw * phw, rw);

  const pick = drawPool[seededIndex(seed, tick, drawPool.length)] ?? DEFAULT_CARD;
  const valid = DEFAULT_CARD_IDS.includes(pick.id); // direct use of DEFAULT_CARD_IDS
  return valid ? pick : DEFAULT_CARD;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * sharedRiskPool
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function sharedRiskPool(input: M29Input, emit: MechanicEmitter): M29Output {
  const tick = clamp(Math.floor(input.tick ?? 0), 0, RUN_TOTAL_TICKS);
  const seed = input.runId ?? computeHash(JSON.stringify(input));

  const poolContributions = (input.poolContributions ?? []).map((c) => ({
    contributorId: String(c.contributorId ?? ''),
    amount: Number.isFinite(c.amount) ? c.amount : 0,
    tick: typeof c.tick === 'number' ? Math.floor(c.tick) : undefined,
    meta: c.meta,
  }));

  const totalPool = sumContributions(poolContributions);

  const riskEvent = input.riskEvent;
  const rawRiskAmount = Number.isFinite(riskEvent?.amount) ? (riskEvent?.amount ?? 0) : 0;
  const riskAmount = clamp(rawRiskAmount, 0, M29_BOUNDS.MAX_AMOUNT);

  const phase: RunPhase = input.runPhase ?? resolvePhaseFromTick(tick);
  const regime: MacroRegime = input.macroRegime ?? resolveRegimeAtTick(seed, tick);
  const chaos = isInChaosWindow(seed, tick);

  const pulseTick = tick % M29_BOUNDS.PULSE_CYCLE === 0;
  const pressureTier: PressureTier =
    input.pressureTier ?? derivePressureTier(totalPool, riskAmount, chaos, riskEvent?.severity);

  const tickTier: TickTier = deriveTickTier(pressureTier, pulseTick);

  const thresholdMet = poolContributions.length >= M29_BOUNDS.TRIGGER_THRESHOLD;
  const poolStarved = totalPool < M29_BOUNDS.BLEED_CASH_THRESHOLD;
  const hasRisk = !!riskEvent && riskAmount > 0;

  // Solvency signal (bounded + deterministic)
  const solvencyStatus: SolvencyStatus = !hasRisk
    ? 'SOLVENT'
    : totalPool <= 0
      ? 'WIPED'
      : totalPool >= riskAmount
        ? 'SOLVENT'
        : 'BLEED';

  // Award card always computed (keeps UI deterministic; also references DEFAULT_CARD/IDs)
  const awardedCard = pickAwardCard(seed, tick, phase, pressureTier, regime);

  // weights + multipliers (directly reference all imported constants)
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulseMult = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M29_BOUNDS.BASE_DECAY_RATE);
  const ageFactor = RUN_TOTAL_TICKS <= 0 ? 0 : tick / RUN_TOTAL_TICKS;

  const chaosPenalty = chaos ? 0.85 : 1.0;
  const pulseBonus = pulseTick ? 1.05 : 1.0;

  // If within early refusal window and threshold isn’t met, we “fund” but don’t pay.
  const refusalWindow = tick <= M29_BOUNDS.FIRST_REFUSAL_TICKS && !thresholdMet;

  const canPay = hasRisk && thresholdMet && !refusalWindow && totalPool > 0;

  // Compute a bounded, deterministic payout.
  // NOTE: cashDelta is bounded by MIN/MAX_CASH_DELTA; amount follows cashDelta when positive.
  const baseCovered = Math.min(totalPool, riskAmount);
  const weighted = baseCovered * M29_BOUNDS.MULTIPLIER * M29_BOUNDS.EFFECT_MULTIPLIER * pressureW * phaseW * regimeW;
  const decayed = weighted * (1 - clamp(decayRate * ageFactor, 0, 0.95));
  const pulsed = decayed * exitPulseMult * regimeMult * chaosPenalty * pulseBonus;

  const boundedEffect = clamp(pulsed, M29_BOUNDS.MIN_EFFECT, M29_BOUNDS.MAX_EFFECT);
  const boundedProceeds = clamp(boundedEffect, 0, Math.min(M29_BOUNDS.MAX_PROCEEDS, totalPool));

  const cashDelta = canPay ? clamp(boundedProceeds, M29_BOUNDS.MIN_CASH_DELTA, M29_BOUNDS.MAX_CASH_DELTA) : 0;
  const cashflowDeltaMonthly = canPay ? clamp(boundedProceeds * 0.01, M29_BOUNDS.MIN_CASHFLOW_DELTA, M29_BOUNDS.MAX_CASHFLOW_DELTA) : 0;

  const amount = canPay ? Math.max(0, Math.round(cashDelta)) : 0;
  const recipientId = canPay ? pickRecipientDeterministic(seed, tick, poolContributions, totalPool) : null;

  const poolBalanceAfter = clamp(totalPool - amount, 0, M29_BOUNDS.MAX_PROCEEDS);

  const tierEscape = amount >= M29_BOUNDS.TIER_ESCAPE_TARGET;
  const regimeShiftSuggested = hasRisk && riskAmount >= M29_BOUNDS.REGIME_SHIFT_THRESHOLD;

  // Touch OPPORTUNITY_POOL directly (ensures import is used even if buildWeightedPool internal changes)
  const opportunityPoolSize = OPPORTUNITY_POOL.length;
  const defaultCardId = DEFAULT_CARD.id;

  const auditHash = computeHash(
    JSON.stringify({
      seed,
      tick,
      hasRisk,
      thresholdMet,
      poolStarved,
      refusalWindow,
      regime,
      phase,
      pressureTier,
      tickTier,
      solvencyStatus,
      amount,
      recipientId,
      poolBalanceAfter,
      awardedCardId: awardedCard.id,
      opportunityPoolSize,
      defaultCardId,
      regimeShiftSuggested,
    }) + ':M29:v1',
  );

  // Telemetry — always emit funding; conditionally emit payout / empty.
  emit({
    event: 'RISK_POOL_FUNDED',
    mechanic_id: 'M29',
    tick,
    runId: seed,
    payload: {
      totalPool,
      contributions: poolContributions.length,
      thresholdMet,
      poolStarved,
      phase,
      regime,
      pressureTier,
      tickTier,
      solvencyStatus,
      awardedCardId: awardedCard.id,
      opportunityPoolSize,
      defaultCardId,
    },
  });

  if (hasRisk && (totalPool <= 0 || poolStarved)) {
    emit({
      event: 'POOL_EMPTY',
      mechanic_id: 'M29',
      tick,
      runId: seed,
      payload: {
        riskEventId: riskEvent?.id ?? 'unknown',
        riskAmount,
        totalPool,
        poolStarved,
        solvencyStatus,
      },
    });
  } else if (canPay && amount > 0) {
    emit({
      event: 'PAYOUT_TRIGGERED',
      mechanic_id: 'M29',
      tick,
      runId: seed,
      payload: {
        recipientId,
        amount,
        cashDelta,
        cashflowDeltaMonthly,
        poolBalanceAfter,
        tierEscape,
        pulseTick,
        decayRate,
        regimeMult,
        exitPulseMult,
        regimeShiftSuggested,
        awardedCardId: awardedCard.id,
        auditHash,
      },
    });
  }

  const poolPayout: PoolPayout = {
    recipientId,
    amount,
    cashDelta,
    cashflowDeltaMonthly,
    poolBalanceAfter,
    awardedCard,
    regime,
    phase,
    pressureTier,
    tickTier,
    solvencyStatus,
    tierEscape,
    pulseTick,
    auditHash,
  };

  return {
    poolPayout,
    riskDistributed: canPay && amount > 0 && recipientId !== null,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M29MLInput {
  poolPayout?: PoolPayout;
  riskDistributed?: boolean;
  runId: string;
  tick: number;
}

export interface M29MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * sharedRiskPoolMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function sharedRiskPoolMLCompanion(input: M29MLInput): Promise<M29MLOutput> {
  const tick = clamp(Math.floor(input.tick ?? 0), 0, RUN_TOTAL_TICKS);
  const seed = input.runId ?? computeHash(JSON.stringify(input));

  // Use the same deterministic regime inference to keep advisory stable.
  const regime = resolveRegimeAtTick(seed, tick);
  const decay = computeDecayRate(regime, M29_BOUNDS.BASE_DECAY_RATE);

  const payout = input.poolPayout?.amount ?? 0;
  const distributed = !!input.riskDistributed;

  const normalized = clamp(payout / Math.max(1, M29_BOUNDS.MAX_CASH_DELTA), 0, 1);
  const score = clamp((distributed ? 0.55 : 0.25) + normalized * 0.4, 0.01, 0.99);

  const factors: string[] = [];
  factors.push(distributed ? 'Payout executed' : 'No payout executed');
  factors.push(`Regime=${regime}`);
  factors.push(`Tick=${tick}/${RUN_TOTAL_TICKS}`);
  if ((input.poolPayout?.pulseTick ?? false) === true) factors.push('Pulse tick bonus');
  if ((input.poolPayout?.tierEscape ?? false) === true) factors.push('Tier escape achieved');

  const topFactors = factors.slice(0, 5);

  const recommendation =
    distributed && payout > 0
      ? 'Keep the pool funded above threshold and maintain contribution diversity.'
      : 'Increase contributions to meet threshold before the next risk event hits.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ ...input, regime, decay }) + ':ml:M29'),
    confidenceDecay: clamp(decay, 0.01, 0.99),
  };
}