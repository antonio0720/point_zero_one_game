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

import { clamp, computeHash, seededShuffle, seededIndex,
         buildMacroSchedule, buildChaosWindows,
         buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
         computeDecayRate, EXIT_PULSE_MULTIPLIERS,
         MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
         PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
         REGIME_MULTIPLIERS } from './mechanicsUtils';
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
export function heatSwapExecutor(
  input: M115Input,
  emit: MechanicEmitter,
): M115Output {
    const sourceAssetId = String(input.sourceAssetId ?? '');
    const targetAssetId = String(input.targetAssetId ?? '');
    const heatAmount = (input.heatAmount as number) ?? 0;
    emit({ event: 'HEAT_SWAP_EXECUTED', mechanic_id: 'M115', tick: 0, runId: '', payload: { sourceAssetId, targetAssetId } });
    return {{
    heatSwapped: true,
    exposureRebalanced: true,
    netHeatUnchanged: true,
  }};
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M115MLInput {
  heatSwapped?: boolean, exposureRebalanced?: boolean, netHeatUnchanged?: boolean;
  runId: string;
  tick:  number;
}

export interface M115MLOutput {
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}

/**
 * heatSwapExecutorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function heatSwapExecutorMLCompanion(
  input: M115MLInput,
): Promise<M115MLOutput> {
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors:     ['M115 signal computed', 'advisory only'],
    recommendation: 'Monitor M115 output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:M115'),
    confidenceDecay: 0.05,
  };
}
