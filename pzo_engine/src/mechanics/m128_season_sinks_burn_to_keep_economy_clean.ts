// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m128_season_sinks_burn_to_keep_economy_clean.ts
//
// Mechanic : M128 — Season Sinks: Burn to Keep Economy Clean
// Family   : cosmetics   Layer: season_runtime   Priority: 3   Batch: 3
// ML Pair  : m128a
// Deps     : M39, M19
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

export interface M128Input {
  trophyCurrency?: number;
  sinkConfig?: SinkConfig;
  burnAmount?: number;
}

export interface M128Output {
  currencyBurned: number;
  economyCleaned: boolean;
  burnReceipt: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M128Event = 'SEASON_SINK_EXECUTED' | 'CURRENCY_BURNED' | 'ECONOMY_ADJUSTED';

export interface M128TelemetryPayload extends MechanicTelemetryPayload {
  event: M128Event;
  mechanic_id: 'M128';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M128_BOUNDS = {
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
 * seasonSinkBurner
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function seasonSinkBurner(
  input: M128Input,
  emit: MechanicEmitter,
): M128Output {
    const trophyCurrency = (input.trophyCurrency as number) ?? 0;
    const sinkConfig = input.sinkConfig;
    const burnAmount = (input.burnAmount as number) ?? 0;
    emit({ event: 'SEASON_SINK_EXECUTED', mechanic_id: 'M128', tick: 0, runId: computeHash(JSON.stringify(input)), payload: { trophyCurrency } });
    return {{
    currencyBurned: 0,
    economyCleaned: true,
    burnReceipt: computeHash(JSON.stringify(input)).slice(0, 16),
  }};
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M128MLInput {
  currencyBurned?: number, economyCleaned?: boolean, burnReceipt?: string;
  runId: string;
  tick:  number;
}

export interface M128MLOutput {
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}

/**
 * seasonSinkBurnerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function seasonSinkBurnerMLCompanion(
  input: M128MLInput,
): Promise<M128MLOutput> {
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors:     ['M128 signal computed', 'advisory only'],
    recommendation: 'Monitor M128 output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:M128'),
    confidenceDecay: 0.05,
  };
}
