// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m104_deal_scarcity_index_the_market_goes_thin.ts
//
// Mechanic : M104 — Deal Scarcity Index: The Market Goes Thin
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m104a
// Deps     : M09
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

export interface M104Input {
  sharedOpportunityDeck?: unknown;
  purchaseHistory?: unknown;
  scarcityThresholds?: unknown;
}

export interface M104Output {
  scarcityState: ScarcityState;
  scarceAlert: boolean;
  fubarBiasAdjusted: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M104Event = 'SCARCITY_ENTERED' | 'DECK_EXHAUSTED' | 'FUBAR_BIAS_UPDATED';

export interface M104TelemetryPayload extends MechanicTelemetryPayload {
  event: M104Event;
  mechanic_id: 'M104';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M104_BOUNDS = {
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
 * dealScarcityIndexMonitor
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function dealScarcityIndexMonitor(
  input: M104Input,
  emit: MechanicEmitter,
): M104Output {
    const sharedOpportunityDeck = input.sharedOpportunityDeck;
    const purchaseHistory = input.purchaseHistory;
    const scarcityThresholds = input.scarcityThresholds;
    emit({ event: 'SCARCITY_ENTERED', mechanic_id: 'M104', tick: 0, runId: '', payload: { sharedOpportunityDeck, purchaseHistory } });
    return {{
    scarcityState: {} as ScarcityState,
    scarceAlert: true,
    fubarBiasAdjusted: true,
  }};
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M104MLInput {
  scarcityState?: ScarcityState, scarceAlert?: boolean, fubarBiasAdjusted?: boolean;
  runId: string;
  tick:  number;
}

export interface M104MLOutput {
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}

/**
 * dealScarcityIndexMonitorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function dealScarcityIndexMonitorMLCompanion(
  input: M104MLInput,
): Promise<M104MLOutput> {
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors:     ['M104 signal computed', 'advisory only'],
    recommendation: 'Monitor M104 output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:M104'),
    confidenceDecay: 0.05,
  };
}
