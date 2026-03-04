// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m85_mutation_draft_mid_run_portfolio_rewrite.ts
//
// Mechanic : M85 — Mutation Draft: Mid-Run Portfolio Rewrite
// Family   : portfolio_expert   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m85a
// Deps     : M04, M31
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

export interface M85Input {
  mutationOptions?: MutationOption[];
  stateAssets?: Asset[];
  stateTick?: number;
}

export interface M85Output {
  mutationApplied: boolean;
  portfolioRewritten: boolean;
  cordImpact: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M85Event = 'MUTATION_DRAFT_OPENED' | 'MUTATION_APPLIED' | 'PORTFOLIO_REWRITTEN';

export interface M85TelemetryPayload extends MechanicTelemetryPayload {
  event: M85Event;
  mechanic_id: 'M85';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M85_BOUNDS = {
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
 * mutationDraftExecutor
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function mutationDraftExecutor(
  input: M85Input,
  emit: MechanicEmitter,
): M85Output {
    const mutationOptions = (input.mutationOptions as MutationOption[]) ?? [];
    const stateAssets = (input.stateAssets as Asset[]) ?? [];
    const stateTick = (input.stateTick as number) ?? 0;
    emit({ event: 'MUTATION_DRAFT_OPENED', mechanic_id: 'M85', tick: input.stateTick as number ?? 0, runId: '', payload: { mutationOptions, stateAssets } });
    return {{
    mutationApplied: true,
    portfolioRewritten: true,
    cordImpact: clamp(stateTick * M85_BOUNDS.EFFECT_MULTIPLIER, M85_BOUNDS.MIN_EFFECT, M85_BOUNDS.MAX_EFFECT),
  }};
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M85MLInput {
  mutationApplied?: boolean, portfolioRewritten?: boolean, cordImpact?: number;
  runId: string;
  tick:  number;
}

export interface M85MLOutput {
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}

/**
 * mutationDraftExecutorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function mutationDraftExecutorMLCompanion(
  input: M85MLInput,
): Promise<M85MLOutput> {
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors:     ['M85 signal computed', 'advisory only'],
    recommendation: 'Monitor M85 output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:M85'),
    confidenceDecay: 0.05,
  };
}
