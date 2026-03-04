// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m45_new_player_grace_period.ts
//
// Mechanic : M45 — New-Player Grace Period
// Family   : onboarding   Layer: backend_service   Priority: 1   Batch: 2
// ML Pair  : m45a
// Deps     : none
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

export interface M45Input {
  runCount?: number;
  playerSkillScore?: number;
}

export interface M45Output {
  gracePeriodActive: boolean;
  protectionApplied: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M45Event = 'GRACE_PERIOD_ACTIVE' | 'PROTECTION_APPLIED' | 'GRACE_PERIOD_EXPIRED';

export interface M45TelemetryPayload extends MechanicTelemetryPayload {
  event: M45Event;
  mechanic_id: 'M45';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M45_BOUNDS = {
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
 * newPlayerGracePeriod
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function newPlayerGracePeriod(
  input: M45Input,
  emit: MechanicEmitter,
): M45Output {
    const runCount = (input.runCount as number) ?? 0;
    const playerSkillScore = (input.playerSkillScore as number) ?? 0;
  const serviceHash = computeHash(JSON.stringify(input));
    emit({ event: 'GRACE_PERIOD_ACTIVE', mechanic_id: 'M45', tick: 0, runId: serviceHash, payload: { runCount, playerSkillScore } });
    return {{
    gracePeriodActive: true,
    protectionApplied: true,
  }};
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M45MLInput {
  gracePeriodActive?: boolean, protectionApplied?: boolean;
  runId: string;
  tick:  number;
}

export interface M45MLOutput {
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}

/**
 * newPlayerGracePeriodMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function newPlayerGracePeriodMLCompanion(
  input: M45MLInput,
): Promise<M45MLOutput> {
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors:     ['M45 signal computed', 'advisory only'],
    recommendation: 'Monitor M45 output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:M45'),
    confidenceDecay: 0.05,
  };
}
