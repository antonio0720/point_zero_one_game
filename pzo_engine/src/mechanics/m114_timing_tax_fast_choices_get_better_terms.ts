// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m114_timing_tax_fast_choices_get_better_terms.ts
//
// Mechanic : M114 — Timing Tax: Fast Choices Get Better Terms
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m114a
// Deps     : M02, M09
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

export interface M114Input {
  decisionTime?: number;
  windowDuration?: number;
  timingTaxTable?: unknown;
}

export interface M114Output {
  timingBonus: number;
  termImproved: boolean;
  taxApplied: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M114Event = 'TIMING_TAX_APPLIED' | 'TIMING_BONUS_AWARDED' | 'FAST_DECISION_RECORDED';

export interface M114TelemetryPayload extends MechanicTelemetryPayload {
  event: M114Event;
  mechanic_id: 'M114';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M114_BOUNDS = {
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
 * timingTaxResolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function timingTaxResolver(
  input: M114Input,
  emit: MechanicEmitter,
): M114Output {
    const decisionTime = (input.decisionTime as number) ?? 0;
    const windowDuration = (input.windowDuration as number) ?? 0;
    const timingTaxTable = input.timingTaxTable;
    emit({ event: 'TIMING_TAX_APPLIED', mechanic_id: 'M114', tick: 0, runId: '', payload: { decisionTime, windowDuration } });
    return {{
    timingBonus: clamp(decisionTime * M114_BOUNDS.EFFECT_MULTIPLIER, M114_BOUNDS.MIN_EFFECT, M114_BOUNDS.MAX_EFFECT),
    termImproved: true,
    taxApplied: true,
  }};
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M114MLInput {
  timingBonus?: number, termImproved?: boolean, taxApplied?: boolean;
  runId: string;
  tick:  number;
}

export interface M114MLOutput {
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}

/**
 * timingTaxResolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function timingTaxResolverMLCompanion(
  input: M114MLInput,
): Promise<M114MLOutput> {
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors:     ['M114 signal computed', 'advisory only'],
    recommendation: 'Monitor M114 output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:M114'),
    confidenceDecay: 0.05,
  };
}
