// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m37_streak_bounties.ts
//
// Mechanic : M37 — Streak Bounties
// Family   : achievement_engine   Layer: season_runtime   Priority: 2   Batch: 2
// ML Pair  : m37a
// Deps     : M36
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
export const M37_IMPORTED_SYMBOLS = {
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
export type M37_ImportedTypesAnchor = {
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

// ── Local type alias (fixes generator reference while staying within ./types) ──
type RunResult = CompletedRun;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M37Input {
  /**
   * Optional stable run identifier. If omitted, derived deterministically from input snapshot.
   */
  runId?: string;

  /**
   * Current tick within run (0..RUN_TOTAL_TICKS-1). If omitted, assumed 0.
   */
  tick?: number;

  /**
   * Current streak count (authoritative input from upstream streak tracker).
   */
  streakCount?: number;

  /**
   * Optional previous streak count; enables precise EXTENDED/BROKEN telemetry.
   */
  previousStreakCount?: number;

  /**
   * Optional last run results (e.g., completed runs within current season).
   * Used only as deterministic seasoning for multiplier shaping (bounded).
   */
  runResults?: RunResult[];

  /**
   * Optional explicit macro/phase/pressure hints. If omitted, derived deterministically.
   */
  macroRegime?: MacroRegime;
  runPhase?: RunPhase;
  pressureTier?: PressureTier;

  /**
   * Optional proof artifact pointer to bind telemetry to a verifiable token.
   */
  proofCard?: ProofCard | null;
}

export interface M37Output {
  bountyActivated: boolean;
  streakMultiplier: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M37Event = 'STREAK_BOUNTY_ACTIVATED' | 'STREAK_EXTENDED' | 'STREAK_BROKEN';

export interface M37TelemetryPayload extends MechanicTelemetryPayload {
  event: M37Event;
  mechanic_id: 'M37';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M37_BOUNDS = {
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

function m37DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m37InChaosWindow(tick: number, chaosWindows: ChaosWindow[]): boolean {
  for (const w of chaosWindows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m37DeriveRegimeFromSchedule(
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

function m37DerivePressureTier(tick: number, phase: RunPhase, chaosWindows: ChaosWindow[]): PressureTier {
  if (m37InChaosWindow(tick, chaosWindows)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

type M37Context = {
  seed: string;
  runId: string;
  tick: number;
  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  inChaos: boolean;

  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
  regimeMultiplier: number;
  exitPulse: number;
  decayRate: number;

  deckShuffle: string[];
  opportunityPick: GameCard;
  weightedPoolPick: GameCard;

  pulseFrac: number;
  bonusWindow: boolean;

  resultsFactor: number; // 0..1, bounded seasoning from runResults
};

function m37ResultsFactor(runResults: RunResult[], seed: string, tick: number): number {
  if (!runResults || runResults.length === 0) return 0.5;

  // Deterministic sample: pick up to 3 runs, blend cordScore in a bounded way.
  const sampled = seededShuffle(runResults, seed + ':runs').slice(0, 3);
  const avgCord = sampled.reduce((s, r) => s + Number(r.cordScore ?? 0), 0) / Math.max(1, sampled.length);

  // Normalize: assume cordScore typical range ~[0..100]; clamp hard to be safe.
  const normalized = clamp(avgCord / 100, 0, 1);

  // Add tiny deterministic dither to avoid ties without expanding variance.
  const dither = clamp((seededIndex(seed + ':dither', tick + 7, 1000) / 1000) * 0.04, 0, 0.04);

  return clamp(normalized * 0.96 + dither, 0, 1);
}

function m37BuildContext(input: M37Input): M37Context {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? computeHash(JSON.stringify(input)));
  const seedCore = computeHash(`${runId}:M37:${tick}`);

  const macroSchedule = buildMacroSchedule(seedCore, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seedCore, CHAOS_WINDOWS_PER_RUN);

  const phase = (input.runPhase as RunPhase) ?? m37DerivePhase(tick);
  const fallbackRegime = (input.macroRegime as MacroRegime) ?? 'NEUTRAL';
  const regime = m37DeriveRegimeFromSchedule(tick, macroSchedule, fallbackRegime);

  const pressure = (input.pressureTier as PressureTier) ?? m37DerivePressureTier(tick, phase, chaosWindows);
  const inChaos = m37InChaosWindow(tick, chaosWindows);

  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M37_BOUNDS.BASE_DECAY_RATE);

  const deckShuffle = seededShuffle(DEFAULT_CARD_IDS, seedCore);
  const oppIdx = seededIndex(seedCore, tick + 17, OPPORTUNITY_POOL.length);
  const opportunityPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const pool = buildWeightedPool(seedCore + ':pool', pressureWeight * phaseWeight, regimeWeight);
  const poolIdx = seededIndex(seedCore, tick + 33, Math.max(1, pool.length));
  const weightedPoolPick = pool[poolIdx] ?? opportunityPick ?? DEFAULT_CARD;

  const pulseFrac = clamp((tick % M37_BOUNDS.PULSE_CYCLE) / M37_BOUNDS.PULSE_CYCLE, 0, 1);
  const bonusWindow = !inChaos && pulseFrac <= 0.25;

  const runResults = (input.runResults as RunResult[]) ?? [];
  const resultsFactor = m37ResultsFactor(runResults, seedCore, tick);

  return {
    seed: seedCore,
    runId,
    tick,
    phase,
    regime,
    pressure,
    macroSchedule,
    chaosWindows,
    inChaos,
    pressureWeight,
    phaseWeight,
    regimeWeight,
    regimeMultiplier,
    exitPulse,
    decayRate,
    deckShuffle,
    opportunityPick,
    weightedPoolPick,
    pulseFrac,
    bonusWindow,
    resultsFactor,
  };
}

function m37ComputeMultiplier(ctx: M37Context, streakCount: number): number {
  if (streakCount < M37_BOUNDS.TRIGGER_THRESHOLD) return 0;

  const streakExcess = Math.max(0, streakCount - M37_BOUNDS.TRIGGER_THRESHOLD);
  const streakRamp = clamp(1 + streakExcess * 0.06, 1, 1.36);

  // Base multiplier shaped by macro regime + exit pulse, bounded and decay-dampened.
  const base = M37_BOUNDS.MULTIPLIER * ctx.regimeMultiplier * ctx.exitPulse;

  // Decay dampener: higher decay => lower multiplier (bounded).
  const decayDampen = clamp(1 - ctx.decayRate, 0.15, 0.99);

  // Bonus window provides a small boost; chaos removes it (already in bonusWindow bool).
  const windowBoost = ctx.bonusWindow ? 1.10 : 1.0;

  // Results seasoning: bounded 0..1 -> 0.92..1.08
  const resultsSeason = clamp(0.92 + ctx.resultsFactor * 0.16, 0.92, 1.08);

  // Final bounded multiplier (keep it reasonable; no unbounded growth).
  const raw = base * streakRamp * decayDampen * windowBoost * resultsSeason;
  return clamp(raw, 0, 4.0);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * streakBountyEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function streakBountyEngine(input: M37Input, emit: MechanicEmitter): M37Output {
  const ctx = m37BuildContext(input);

  const streakCount = Math.max(0, Number(input.streakCount ?? 0));
  const prev = input.previousStreakCount == null ? null : Math.max(0, Number(input.previousStreakCount));

  const bountyActivated = streakCount >= M37_BOUNDS.TRIGGER_THRESHOLD;
  const streakMultiplier = m37ComputeMultiplier(ctx, streakCount);

  // Deterministic “bounty token” (not persisted here; emitted for audit / UI hooks).
  const bountyToken = computeHash(
    JSON.stringify({
      mid: 'M37',
      runId: ctx.runId,
      tick: ctx.tick,
      streakCount,
      regime: ctx.regime,
      phase: ctx.phase,
      pressure: ctx.pressure,
      bountyPick: ctx.weightedPoolPick.id,
      deckTop: ctx.deckShuffle[0] ?? '',
      proofHash: input.proofCard?.hash ?? '',
    }),
  );

  // Emit activation/extension/break only when we have enough info to be precise.
  // If previousStreakCount is not provided, we still emit ACTIVATED when active.
  if (bountyActivated) {
    emit({
      event: 'STREAK_BOUNTY_ACTIVATED',
      mechanic_id: 'M37',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        seed: ctx.seed,
        streakCount,
        multiplier: streakMultiplier,
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        inChaos: ctx.inChaos,
        bonusWindow: ctx.bonusWindow,
        resultsFactor: Number(ctx.resultsFactor.toFixed(4)),
        bountyCard: { id: ctx.weightedPoolPick.id, name: ctx.weightedPoolPick.name },
        bountyToken,
      },
    } as M37TelemetryPayload);
  }

  if (prev != null) {
    if (streakCount > prev && bountyActivated) {
      emit({
        event: 'STREAK_EXTENDED',
        mechanic_id: 'M37',
        tick: ctx.tick,
        runId: ctx.runId,
        payload: {
          prev,
          now: streakCount,
          multiplier: streakMultiplier,
          bountyToken,
        },
      } as M37TelemetryPayload);
    }

    if (streakCount === 0 && prev > 0) {
      emit({
        event: 'STREAK_BROKEN',
        mechanic_id: 'M37',
        tick: ctx.tick,
        runId: ctx.runId,
        payload: {
          prev,
          now: streakCount,
          bountyToken,
        },
      } as M37TelemetryPayload);
    }
  }

  return {
    bountyActivated,
    streakMultiplier,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M37MLInput {
  bountyActivated?: boolean;
  streakMultiplier?: number;
  runId: string;
  tick: number;
}

export interface M37MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (djb2 here)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * streakBountyEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function streakBountyEngineMLCompanion(input: M37MLInput): Promise<M37MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? '');
  const seed = computeHash(`${runId}:M37:ml:${tick}`);

  // Use deterministic schedules to incorporate macro/chaos context into decay + advice.
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m37DerivePhase(tick);
  const regime = m37DeriveRegimeFromSchedule(tick, macroSchedule, 'NEUTRAL');
  const pressure = m37DerivePressureTier(tick, phase, chaosWindows);
  const inChaos = m37InChaosWindow(tick, chaosWindows);

  const decay = computeDecayRate(regime, M37_BOUNDS.BASE_DECAY_RATE);

  const activated = Boolean(input.bountyActivated);
  const mult = Number(input.streakMultiplier ?? 0);
  const multNorm = clamp(mult / 4.0, 0, 1);

  // Advisory score: activation + multiplier strength, penalize under chaos.
  const score = clamp((activated ? 0.55 : 0.25) + multNorm * 0.45 - (inChaos ? 0.10 : 0.0), 0.01, 0.99);

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS} phase=${phase}`,
    `regime=${regime} pressure=${pressure} chaos=${inChaos ? 'Y' : 'N'}`,
    `bountyActivated=${activated ? 'Y' : 'N'} multiplier=${mult.toFixed(2)}`,
    `decay=${decay.toFixed(2)} pulseMult=${(EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0).toFixed(2)}`,
    `regimeMult=${(REGIME_MULTIPLIERS[regime] ?? 1.0).toFixed(2)}`,
  ].slice(0, 5);

  const recommendation = !activated
    ? 'No bounty yet: protect streak continuity and avoid chaos-window decisions that break momentum.'
    : mult >= 2.5
      ? 'Bounty is strong: press advantage, take highest expected-value plays, and lock proof-worthy outcomes.'
      : 'Bounty is active but modest: play tight, avoid unnecessary risk, and extend streak into a clean pulse window.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M37', ...input }) + ':ml:M37'),
    confidenceDecay: decay,
  };
}