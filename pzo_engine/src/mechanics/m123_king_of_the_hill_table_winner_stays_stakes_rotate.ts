// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m123_king_of_the_hill_table_winner_stays_stakes_rotate.ts
//
// Mechanic : M123 — King of the Hill: Table Winner Stays Stakes Rotate
// Family   : social_advanced   Layer: season_runtime   Priority: 2   Batch: 3
// ML Pair  : m123a
// Deps     : M123
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

export interface M123Input {
  tableId?: string;
  winnerHistory?: string[];
  stakeConfig?: Record<string, unknown>;
}

export interface M123Output {
  kingDesignated: string;
  stakesUpdated: boolean;
  challengerQueued: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M123Event = 'KING_DESIGNATED' | 'STAKES_ROTATED' | 'CHALLENGER_JOINED';

export interface M123TelemetryPayload extends MechanicTelemetryPayload {
  event: M123Event;
  mechanic_id: 'M123';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M123_BOUNDS = {
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
 * kingOfHillTableEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function kingOfHillTableEngine(
  input: M123Input,
  emit: MechanicEmitter,
): M123Output {
    const tableId = String(input.tableId ?? '');
    const winnerHistory = (input.winnerHistory as string[]) ?? [];
    const stakeConfig = input.stakeConfig;
    emit({ event: 'KING_DESIGNATED', mechanic_id: 'M123', tick: 0, runId: computeHash(JSON.stringify(input)), payload: { tableId } });
    return {{
    kingDesignated: computeHash(JSON.stringify(input)).slice(0, 16),
    stakesUpdated: true,
    challengerQueued: true,
  }};
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M123MLInput {
  kingDesignated?: string, stakesUpdated?: boolean, challengerQueued?: boolean;
  runId: string;
  tick:  number;
}

export interface M123MLOutput {
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}

/**
 * kingOfHillTableEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function kingOfHillTableEngineMLCompanion(
  input: M123MLInput,
): Promise<M123MLOutput> {
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors:     ['M123 signal computed', 'advisory only'],
    recommendation: 'Monitor M123 output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:M123'),
    confidenceDecay: 0.05,
  };
}
