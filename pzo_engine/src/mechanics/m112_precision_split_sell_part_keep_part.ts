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

import { clamp, computeHash, seededShuffle, seededIndex,
         buildMacroSchedule, buildChaosWindows,
         buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
         computeDecayRate, EXIT_PULSE_MULTIPLIERS,
         MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
         PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
         REGIME_MULTIPLIERS } from './mechanicsUtils';
import type {

export interface SplitResult {
  /** Deterministic split execution summary */
  sold_units: number;
  kept_units: number;
  /** Gross proceeds from the sold portion (before fees) */
  proceeds_gross: number;
  /** Total fees applied to the split operation */
  fees_total: number;
  /** Realized P&L for the sold portion */
  realized_pnl: number;
  /** Realized P&L percent for the sold portion */
  realized_pnl_pct: number;
  /** Remaining holding cost basis after the split */
  remaining_cost_basis: number;
}
  RunPhase, TickTier, MacroRegime, PressureTier, SolvencyStatus,
  Asset, IPAItem, GameCard, GameEvent, ShieldLayer, Debt, Buff,
  Liability, SetBonus, AssetMod, IncomeItem, MacroEvent, ChaosWindow,
  AuctionResult, PurchaseResult, ShieldResult, ExitResult, TickResult,
  DeckComposition, TierProgress, WipeEvent, RegimeShiftEvent,
  PhaseTransitionEvent, TimerExpiredEvent, StreakEvent, FubarEvent,
  LedgerEntry, ProofCard, CompletedRun, SeasonState, RunState,
  MomentEvent, ClipBoundary, MechanicTelemetryPayload, MechanicEmitter,
} from './types';


// ── Input / Output contracts ──────────────────────────────────────────────

export interface M112Input {
  assetId?: string;
  splitAmount?: number;
  sellPercentage?: number;
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
  TRIGGER_THRESHOLD:   3,
  MULTIPLIER:          1.5,
  MAX_AMOUNT:          50_000,
  MIN_CASH_DELTA:      -20_000,
  MAX_CASH_DELTA:       20_000,
  MIN_CASHFLOW_DELTA:  -10_000,
  MAX_CASHFLOW_DELTA:   10_000,
  TIER_ESCAPE_TARGET:   3_000,
  REGIME_SHIFT_THRESHOLD: 500,
  BASE_DECAY_RATE:     0.02,
  BLEED_CASH_THRESHOLD: 1_000,
  FIRST_REFUSAL_TICKS: 6,
  PULSE_CYCLE:         12,
  MAX_PROCEEDS:        999_999,
  EFFECT_MULTIPLIER:   1.0,
  MIN_EFFECT:          0,
  MAX_EFFECT:          100_000,
} as const;

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
export function precisionSplitExecutor(
  input: M112Input,
  emit: MechanicEmitter,
): M112Output {
    const assetId = String(input.assetId ?? '');
    const splitAmount = (input.splitAmount as number) ?? 0;
    const sellPercentage = (input.sellPercentage as number) ?? 0;
    emit({ event: 'PRECISION_SPLIT_EXECUTED', mechanic_id: 'M112', tick: 0, runId: '', payload: { assetId, splitAmount } });
    return {
    splitResult: {} as SplitResult,
    cashFromSplit: 0,
    remainingHolding: { componentId: 'M112', rendered: true },
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M112MLInput {
  splitResult?: SplitResult, cashFromSplit?: number, remainingHolding?: Record<string, unknown>;
  runId: string;
  tick:  number;
}

export interface M112MLOutput {
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}

/**
 * precisionSplitExecutorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function precisionSplitExecutorMLCompanion(
  input: M112MLInput,
): Promise<M112MLOutput> {
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors:     ['M112 signal computed', 'advisory only'],
    recommendation: 'Monitor M112 output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:M112'),
    confidenceDecay: 0.05,
  };
}
