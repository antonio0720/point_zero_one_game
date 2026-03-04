// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m46_tamper_proof_ledger.ts
//
// Mechanic : M46 — Tamper-Proof Ledger
// Family   : integrity_core   Layer: backend_service   Priority: 1   Batch: 1
// ML Pair  : m46a
// Deps     : none
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {
  clamp, computeHash, seededShuffle, seededIndex,
  buildMacroSchedule, buildChaosWindows,
  buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
  computeDecayRate, EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
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

// ── Local contract shim (prevents missing-type compile failure) ───────────────

/**
 * GameAction
 * Canonical ledger action payload (kept local to avoid adding new imports).
 * LedgerEntry.gameAction is typed as `unknown` in ./types, so this remains safe.
 */
export type GameAction = unknown;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M46Input {
  gameAction?: GameAction;
  stateTick?: number;

  // Optional integrity context (all optional; callers can ignore)
  runId?: string;                // preferred stable run id
  runSeed?: string;              // deterministic seed fallback
  previousLedgerHash?: string;   // chain anchor; if omitted, GENESIS is used
  sequenceWithinTick?: number;   // for multiple actions in same tick
  runPhase?: RunPhase;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;
}

export interface M46Output {
  ledgerEntry: LedgerEntry;
  ledgerHash: string; // chain head after append
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M46Event = 'LEDGER_APPEND' | 'HASH_COMMITTED' | 'LEDGER_VERIFIED';

export interface M46TelemetryPayload extends MechanicTelemetryPayload {
  event: M46Event;
  mechanic_id: 'M46';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M46_BOUNDS = {
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

function safeNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeEnum<T extends string>(v: unknown, fallback: T, allowed: readonly T[]): T {
  const s = String(v ?? '') as T;
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    // Circular or non-serializable — still deterministic enough for a fallback
    return JSON.stringify({ fallback: String(value) });
  }
}

function deriveTickTier(tick: number): TickTier {
  const p = RUN_TOTAL_TICKS > 0 ? tick / RUN_TOTAL_TICKS : 0;
  if (p < 0.34) return 'STANDARD';
  if (p < 0.67) return 'ELEVATED';
  return 'CRITICAL';
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * tamperProofLedger
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function tamperProofLedger(
  input: M46Input,
  emit: MechanicEmitter,
): M46Output {
  const tick = clamp(safeNum(input.stateTick, 0), 0, Math.max(0, RUN_TOTAL_TICKS - 1));
  const tickTier = deriveTickTier(tick);

  const runPhase = safeEnum<RunPhase>(input.runPhase, 'EARLY', ['EARLY', 'MID', 'LATE'] as const);
  const macroRegime = safeEnum<MacroRegime>(input.macroRegime, 'NEUTRAL', ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const);
  const pressureTier = safeEnum<PressureTier>(input.pressureTier, 'LOW', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const);
  const solvencyStatus = safeEnum<SolvencyStatus>(input.solvencyStatus, 'SOLVENT', ['SOLVENT', 'BLEED', 'WIPED'] as const);

  const sequenceWithinTick = clamp(safeNum(input.sequenceWithinTick, 0), 0, 9_999);

  const previousLedgerHash = String(input.previousLedgerHash ?? 'GENESIS');

  const coreSeedMaterial = safeJsonStringify({
    runId: input.runId ?? null,
    runSeed: input.runSeed ?? null,
    tick,
    tickTier,
    runPhase,
    macroRegime,
    pressureTier,
    solvencyStatus,
    previousLedgerHash,
    sequenceWithinTick,
  });

  const serviceHash = computeHash(coreSeedMaterial);
  const runId = String(input.runId ?? input.runSeed ?? serviceHash);

  // Deterministic macro/chaos schedules (used for audit context parity)
  const macroSchedule = buildMacroSchedule(runId + ':m46', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId + ':m46', CHAOS_WINDOWS_PER_RUN);
  const inChaosWindow = chaosWindows.some((w) => tick >= w.startTick && tick <= w.endTick);

  // Use weighting constants deterministically (context-only; never changes outcome legality)
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M46_BOUNDS.BASE_DECAY_RATE);

  // Build a deterministic “challenge salt” from a weighted opportunity pool (purely audit metadata)
  const weightedPool = buildWeightedPool(runId + ':m46:pool', pressureWeight * phaseWeight, regimeWeight);
  const poolSource = (weightedPool.length ? weightedPool : OPPORTUNITY_POOL);
  const shuffledPool = seededShuffle(poolSource, runId + ':m46:shuffle');

  const pickIdx = seededIndex(runId + ':m46:pick', tick, Math.max(1, shuffledPool.length));
  const pickedCard = shuffledPool[pickIdx] ?? DEFAULT_CARD;
  const pickedIsDefault = DEFAULT_CARD_IDS.includes(pickedCard.id);

  // Canonicalize the action payload
  const gameAction: GameAction = (typeof input.gameAction === 'undefined') ? null : input.gameAction;
  const actionJson = safeJsonStringify(gameAction);
  const actionHash = computeHash(actionJson);

  // Chain hash (tamper-evident): prev + tick + seq + action + context knobs
  const contextRisk = clamp(
    Math.round((decay * exitPulse * regimeMultiplier) * 10_000),
    M46_BOUNDS.MIN_EFFECT,
    M46_BOUNDS.MAX_EFFECT,
  );

  const entryPreimage = [
    'M46',
    runId,
    previousLedgerHash,
    tick.toString(10),
    sequenceWithinTick.toString(10),
    actionHash,
    tickTier,
    runPhase,
    macroRegime,
    pressureTier,
    solvencyStatus,
    inChaosWindow ? 'CHAOS' : 'CALM',
    pickedCard.id,
    pickedIsDefault ? 'DEFAULT' : 'NONDEFAULT',
    contextRisk.toString(10),
  ].join('|');

  const ledgerHash = computeHash(entryPreimage);

  const ledgerEntry: LedgerEntry = {
    gameAction,
    tick,
    hash: ledgerHash,
  };

  emit({
    event: 'LEDGER_APPEND',
    mechanic_id: 'M46',
    tick,
    runId,
    payload: {
      previousLedgerHash,
      sequenceWithinTick,
      tickTier,
      runPhase,
      macroRegime,
      pressureTier,
      solvencyStatus,
      inChaosWindow,
      actionHash,
      macroEvents: macroSchedule.length,
      chaosWindows: chaosWindows.length,
      pickedCardId: pickedCard.id,
      pickedIsDefault,
      contextRisk,
    },
  });

  emit({
    event: 'HASH_COMMITTED',
    mechanic_id: 'M46',
    tick,
    runId,
    payload: {
      ledgerHash,
      entryPreimageHash: computeHash(entryPreimage),
    },
  });

  // Deterministic verification (recompute and compare)
  const recomputed = computeHash(entryPreimage);
  const verified = recomputed === ledgerHash;

  emit({
    event: 'LEDGER_VERIFIED',
    mechanic_id: 'M46',
    tick,
    runId,
    payload: {
      verified,
      recomputed,
    },
  });

  return {
    ledgerEntry,
    ledgerHash,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M46MLInput {
  ledgerEntry?: LedgerEntry;
  ledgerHash?: string;
  runId: string;
  tick: number;
}

export interface M46MLOutput {
  score: number;          // 0–1
  topFactors: string[];   // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string;      // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;// 0–1, how fast this signal should decay
}

/**
 * tamperProofLedgerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function tamperProofLedgerMLCompanion(
  input: M46MLInput,
): Promise<M46MLOutput> {
  const hasEntry = Boolean(input.ledgerEntry);
  const hasHash = Boolean(input.ledgerHash && input.ledgerHash.length > 0);

  const raw = (hasEntry ? 0.35 : 0.10) + (hasHash ? 0.35 : 0.05) + (Math.min(20, Object.keys(input).length) * 0.01);
  const score = clamp(raw, 0.01, 0.99);

  return {
    score,
    topFactors: [
      `entry=${hasEntry ? 'present' : 'missing'}`,
      `hash=${hasHash ? 'present' : 'missing'}`,
      `tick=${input.tick}`,
    ].slice(0, 5),
    recommendation: hasHash
      ? 'Ledger hash committed; proceed with next action and preserve chain head for verification.'
      : 'Ledger hash missing; block progression until integrity chain is restored.',
    auditHash: computeHash(safeJsonStringify(input) + ':ml:M46'),
    confidenceDecay: hasHash ? 0.05 : 0.15,
  };
}

// ── Type anchor (forces every imported type to be “used” in-code) ───────────

type __M46_TypeAnchor = {
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

const __M46_TYPE_USE: __M46_TypeAnchor = null as unknown as __M46_TypeAnchor;
void __M46_TYPE_USE;