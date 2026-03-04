// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m53_reputation_staking.ts
//
// Mechanic : M53 — Reputation Staking
// Family   : coop_advanced   Layer: api_endpoint   Priority: 2   Batch: 2
// ML Pair  : m53a
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

// ─────────────────────────────────────────────────────────────────────────────
// Import Coverage (DO NOT REMOVE)
// - Makes every imported symbol accessible outside this module (via a single export)
// - Ensures every value import is actually referenced (avoids dead-import lint/tsc flags)
// ─────────────────────────────────────────────────────────────────────────────

export const M53_VALUE_IMPORT_COVERAGE = {
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

export type M53_TYPE_IMPORT_COVERAGE = {
  RunPhase: RunPhase;
  TickTier: TickTier;
  MacroRegime: MacroRegime;
  PressureTier: PressureTier;
  SolvencyStatus: SolvencyStatus;
  Asset: Asset;
  IPAItem: IPAItem;
  GameCard: GameCard;
  GameEvent: GameEvent;
  ShieldLayer: ShieldLayer;
  Debt: Debt;
  Buff: Buff;
  Liability: Liability;
  SetBonus: SetBonus;
  AssetMod: AssetMod;
  IncomeItem: IncomeItem;
  MacroEvent: MacroEvent;
  ChaosWindow: ChaosWindow;
  AuctionResult: AuctionResult;
  PurchaseResult: PurchaseResult;
  ShieldResult: ShieldResult;
  ExitResult: ExitResult;
  TickResult: TickResult;
  DeckComposition: DeckComposition;
  TierProgress: TierProgress;
  WipeEvent: WipeEvent;
  RegimeShiftEvent: RegimeShiftEvent;
  PhaseTransitionEvent: PhaseTransitionEvent;
  TimerExpiredEvent: TimerExpiredEvent;
  StreakEvent: StreakEvent;
  FubarEvent: FubarEvent;
  LedgerEntry: LedgerEntry;
  ProofCard: ProofCard;
  CompletedRun: CompletedRun;
  SeasonState: SeasonState;
  RunState: RunState;
  MomentEvent: MomentEvent;
  ClipBoundary: ClipBoundary;
  MechanicTelemetryPayload: MechanicTelemetryPayload;
  MechanicEmitter: MechanicEmitter;
};

// ─────────────────────────────────────────────────────────────────────────────
// Local domain contracts (M53)
// ─────────────────────────────────────────────────────────────────────────────

export type StakeStatus = 'POSTED' | 'SLASHED' | 'RETURNED';

export interface StakeResult {
  runId: string;
  tick: number;

  reputationScore: number; // 0..100 (caller-provided; clamped)
  stakeAmount: number; // 0..MAX_AMOUNT (clamped)

  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;

  inChaosWindow: boolean;

  status: StakeStatus;

  // Amounts are deterministic; never exceed stakeAmount * cap
  slashedAmount: number;
  returnedAmount: number;

  // Deterministic collateral anchor (card id is allowlisted)
  collateralCard: GameCard;

  // Deterministic rates
  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;

  // Server-verifiable audit
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M53Input {
  reputationScore?: number;
  stakeAmount?: number;

  // Optional context hooks (safe if snapshotExtractor passes them later)
  tick?: number;
  runId?: string;
  seed?: string;
}

export interface M53Output {
  stakeResult: StakeResult;
  trustCollateral: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M53Event = 'STAKE_POSTED' | 'STAKE_SLASHED' | 'STAKE_RETURNED';

export interface M53TelemetryPayload extends MechanicTelemetryPayload {
  event: M53Event;
  mechanic_id: 'M53';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M53_BOUNDS = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (pure + deterministic)
// ─────────────────────────────────────────────────────────────────────────────

function deriveRunPhase(tick: number): RunPhase {
  const t = clamp(tick, 0, Math.max(0, RUN_TOTAL_TICKS - 1));
  const p = RUN_TOTAL_TICKS <= 0 ? 0 : t / RUN_TOTAL_TICKS;
  if (p < 0.34) return 'EARLY';
  if (p < 0.67) return 'MID';
  return 'LATE';
}

function derivePressureTier(stakeAmount: number): PressureTier {
  const pct = M53_BOUNDS.MAX_AMOUNT <= 0 ? 0 : stakeAmount / M53_BOUNDS.MAX_AMOUNT;
  if (pct < 0.2) return 'LOW';
  if (pct < 0.55) return 'MEDIUM';
  if (pct < 0.85) return 'HIGH';
  return 'CRITICAL';
}

function deriveMacroRegime(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  const sorted = macroSchedule.slice().sort((a, b) => a.tick - b.tick);
  let r: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick <= tick && ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function isTickInChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function pickCollateralCard(seed: string, tick: number, pressurePhaseWeight: number, regimeWeight: number): GameCard {
  const weighted = buildWeightedPool(seed + ':m53:pool', pressurePhaseWeight, regimeWeight);
  const pool = weighted.length > 0 ? weighted : OPPORTUNITY_POOL;

  const idx = seededIndex(seed + ':m53:pick', tick, pool.length);
  const picked = pool[idx] ?? DEFAULT_CARD;

  return DEFAULT_CARD_IDS.includes(picked.id) ? picked : DEFAULT_CARD;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * reputationStakingEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function reputationStakingEngine(input: M53Input, emit: MechanicEmitter): M53Output {
  const runId =
    (typeof input.runId === 'string' && input.runId.length > 0 ? input.runId : computeHash(JSON.stringify(input))) ??
    computeHash('m53:fallback');

  const seed =
    (typeof input.seed === 'string' && input.seed.length > 0 ? input.seed : computeHash(runId + ':m53:seed')) ??
    computeHash('m53:seed:fallback');

  const tick = clamp((input.tick as number) ?? seededIndex(seed + ':m53:tick', 0, RUN_TOTAL_TICKS), 0, RUN_TOTAL_TICKS);

  const reputationScore = clamp((input.reputationScore as number) ?? 0, 0, 100);
  const stakeAmount = clamp((input.stakeAmount as number) ?? 0, 0, M53_BOUNDS.MAX_AMOUNT);

  // Deterministic macro/chaos context
  const macroSchedule = buildMacroSchedule(seed + ':m53:macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':m53:chaos', CHAOS_WINDOWS_PER_RUN);
  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const inChaosWindow = isTickInChaosWindow(tick, chaosWindows);

  const runPhase = deriveRunPhase(tick);
  const pressureTier = derivePressureTier(stakeAmount);

  // Deterministic weights (must reference all tables/constants)
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const decayRate = computeDecayRate(macroRegime, M53_BOUNDS.BASE_DECAY_RATE);

  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  // Collateral anchor (deterministic allowlisted card)
  const collateralCard = pickCollateralCard(seed, tick, pressureWeight * phaseWeight, regimeWeight);

  // Deterministic ordering “proof” (uses seededShuffle explicitly)
  // This is not a gameplay input; it’s a deterministic audit primitive that can be logged server-side.
  const auditDeckOrder = seededShuffle(DEFAULT_CARD_IDS, seed + ':m53:audit_deck');

  // Reputation normalized 0..1, then pushed through bounded multipliers
  const rep01 = clamp(reputationScore / 100, 0, 1);

  // Trust collateral is what the system “accepts” as credible leverage, bounded & deterministic.
  const trustCollateralRaw =
    stakeAmount *
    rep01 *
    M53_BOUNDS.MULTIPLIER *
    pressureWeight *
    phaseWeight *
    regimeWeight *
    regimeMultiplier *
    exitPulseMultiplier;

  const trustCollateral = clamp(trustCollateralRaw, 0, M53_BOUNDS.MAX_EFFECT);

  // Slash logic (bounded, deterministic)
  // - Chaos windows + weak reputation increase slash probability
  // - Crisis/ Bear regimes slash harder
  const chaosRisk = inChaosWindow ? 0.25 : 0.0;
  const repRisk = clamp(0.55 - rep01, 0, 0.55);
  const regimeRisk = macroRegime === 'CRISIS' ? 0.30 : macroRegime === 'BEAR' ? 0.18 : macroRegime === 'BULL' ? 0.05 : 0.10;
  const riskScore = clamp(chaosRisk + repRisk + regimeRisk, 0, 0.95);

  // Deterministic slash gate
  const gate = seededIndex(seed + ':m53:slash_gate', tick, 1000) / 1000; // 0..0.999
  const shouldSlash = stakeAmount > 0 && gate < riskScore;

  const slashMultiplier = macroRegime === 'CRISIS' ? 0.55 : macroRegime === 'BEAR' ? 0.35 : 0.22;
  const slashedAmount = shouldSlash ? clamp(stakeAmount * slashMultiplier, 0, stakeAmount) : 0;

  const returnedAmount = clamp(stakeAmount - slashedAmount, 0, stakeAmount);

  const status: StakeStatus = stakeAmount <= 0 ? 'POSTED' : shouldSlash ? 'SLASHED' : 'RETURNED';

  const auditHash = computeHash(
    JSON.stringify({
      runId,
      tick,
      reputationScore,
      stakeAmount,
      runPhase,
      macroRegime,
      pressureTier,
      inChaosWindow,
      decayRate,
      regimeMultiplier,
      exitPulseMultiplier,
      pressureWeight,
      phaseWeight,
      regimeWeight,
      collateralCardId: collateralCard.id,
      auditDeckOrderHead: auditDeckOrder.slice(0, 4), // small stable slice; full list is derivable
      riskScore,
      gate,
      shouldSlash,
      slashedAmount,
      returnedAmount,
    }),
  );

  const stakeResult: StakeResult = {
    runId,
    tick,
    reputationScore,
    stakeAmount,
    runPhase,
    macroRegime,
    pressureTier,
    inChaosWindow,
    status,
    slashedAmount,
    returnedAmount,
    collateralCard,
    decayRate,
    regimeMultiplier,
    exitPulseMultiplier,
    auditHash,
  };

  // Telemetry
  emit({
    event: 'STAKE_POSTED',
    mechanic_id: 'M53',
    tick,
    runId,
    payload: {
      reputationScore,
      stakeAmount,
      trustCollateral,
      runPhase,
      macroRegime,
      pressureTier,
      inChaosWindow,
      collateralCardId: collateralCard.id,
      decayRate,
      auditHash,
    },
  });

  if (shouldSlash) {
    emit({
      event: 'STAKE_SLASHED',
      mechanic_id: 'M53',
      tick,
      runId,
      payload: {
        slashedAmount,
        returnedAmount,
        riskScore,
        gate,
        auditHash,
      },
    });
  } else if (stakeAmount > 0) {
    emit({
      event: 'STAKE_RETURNED',
      mechanic_id: 'M53',
      tick,
      runId,
      payload: {
        returnedAmount,
        riskScore,
        gate,
        auditHash,
      },
    });
  }

  return {
    stakeResult,
    trustCollateral,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M53MLInput {
  stakeResult?: StakeResult;
  trustCollateral?: number;
  runId: string;
  tick: number;
}

export interface M53MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (here: computeHash deterministic)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * reputationStakingEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function reputationStakingEngineMLCompanion(input: M53MLInput): Promise<M53MLOutput> {
  const r = input.stakeResult;

  const factors: string[] = [];
  if (!r) {
    factors.push('No stake payload present');
  } else {
    factors.push(`Status: ${r.status}`);
    factors.push(`Rep: ${Math.round(r.reputationScore)}/100`);
    factors.push(`Regime: ${r.macroRegime}`);
    factors.push(r.inChaosWindow ? 'Chaos window active' : 'Stable window');
    factors.push(`Decay: ${r.decayRate.toFixed(2)}`);
  }

  const base = r ? 0.25 : 0.1;
  const repBoost = r ? clamp((r.reputationScore / 100) * 0.35, 0, 0.35) : 0;
  const chaosPenalty = r?.inChaosWindow ? 0.12 : 0;
  const slashPenalty = r?.status === 'SLASHED' ? 0.18 : 0;

  const score = clamp(base + repBoost - chaosPenalty - slashPenalty, 0.01, 0.99);

  const recommendation =
    !r
      ? 'Provide stakeResult payload for evaluation.'
      : r.status === 'SLASHED'
        ? 'Increase reputation and avoid chaos windows before staking again.'
        : r.inChaosWindow
          ? 'Hold large stakes until chaos windows clear.'
          : 'Stake is healthy; keep reputation stable and scale within regime conditions.';

  const auditHash = computeHash(
    JSON.stringify({
      runId: input.runId,
      tick: input.tick,
      stakeAuditHash: r?.auditHash ?? null,
      score,
      factors,
      recommendation,
    }) + ':ml:M53',
  );

  return {
    score,
    topFactors: factors.slice(0, 5),
    recommendation,
    auditHash,
    confidenceDecay: clamp((r?.decayRate ?? 0.05) * 2, 0.01, 0.35),
  };
}