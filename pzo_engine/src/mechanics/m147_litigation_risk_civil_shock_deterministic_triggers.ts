// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m147_litigation_risk_civil_shock_deterministic_triggers.ts
//
// Mechanic : M147 — Litigation Risk: Civil Shock Deterministic Triggers
// Family   : ops   Layer: backend_service   Priority: 2   Batch: 3
// ML Pair  : m147a
// Deps     : M12, M13
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

export interface M147Input {
  litigationTrigger?: LitigationTrigger;
  stateCash?: number;
  runSeed?: string;
}

export interface M147Output {
  litigationShock: LitigationShock;
  cashDrained: number;
  legalHoldApplied: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M147Event = 'LITIGATION_TRIGGERED' | 'LEGAL_HOLD_APPLIED' | 'CIVIL_SHOCK_RESOLVED';

export interface M147TelemetryPayload extends MechanicTelemetryPayload {
  event: M147Event;
  mechanic_id: 'M147';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M147_BOUNDS = {
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
 * litigationRiskShockEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function litigationRiskShockEngine(
  input: M147Input,
  emit: MechanicEmitter,
): M147Output {
    const litigationTrigger = input.litigationTrigger;
    const stateCash = (input.stateCash as number) ?? 0;
    const runSeed = String(input.runSeed ?? '');
  const serviceHash = computeHash(JSON.stringify(input));
    emit({ event: 'LITIGATION_TRIGGERED', mechanic_id: 'M147', tick: 0, runId: serviceHash, payload: { stateCash } });
    return {{
    litigationShock: {} as LitigationShock,
    cashDrained: 0,
    legalHoldApplied: true,
  }};
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M147MLInput {
  litigationShock?: LitigationShock, cashDrained?: number, legalHoldApplied?: boolean;
  runId: string;
  tick:  number;
}

export interface M147MLOutput {
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}

/**
 * litigationRiskShockEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function litigationRiskShockEngineMLCompanion(
  input: M147MLInput,
): Promise<M147MLOutput> {
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors:     ['M147 signal computed', 'advisory only'],
    recommendation: 'Monitor M147 output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:M147'),
    confidenceDecay: 0.05,
  };
}
