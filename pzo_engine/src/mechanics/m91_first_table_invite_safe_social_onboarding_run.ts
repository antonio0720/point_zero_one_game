// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m91_first_table_invite_safe_social_onboarding_run.ts
//
// Mechanic : M91 — First Table Invite: Safe Social Onboarding Run
// Family   : onboarding_expert   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m91a
// Deps     : M41, M15
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

export interface M91Input {
  inviterId?: string;
  newPlayerId?: string;
  safeRunConfig?: Record<string, unknown>;
}

export interface M91Output {
  safeRunStarted: boolean;
  guidedSocialMoment: SocialMomentDef;
  inviteBonus: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M91Event = 'FIRST_TABLE_INVITE_SENT' | 'SAFE_RUN_STARTED' | 'SOCIAL_MOMENT_CAPTURED';

export interface M91TelemetryPayload extends MechanicTelemetryPayload {
  event: M91Event;
  mechanic_id: 'M91';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M91_BOUNDS = {
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
 * firstTableInviteSafeRun
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function firstTableInviteSafeRun(
  input: M91Input,
  emit: MechanicEmitter,
): M91Output {
    const inviterId = String(input.inviterId ?? '');
    const newPlayerId = String(input.newPlayerId ?? '');
    const safeRunConfig = input.safeRunConfig;
  const serviceHash = computeHash(JSON.stringify(input));
    emit({ event: 'FIRST_TABLE_INVITE_SENT', mechanic_id: 'M91', tick: 0, runId: serviceHash, payload: { inviterId, newPlayerId } });
    return {{
    safeRunStarted: true,
    guidedSocialMoment: {} as SocialMomentDef,
    inviteBonus: 0,
  }};
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M91MLInput {
  safeRunStarted?: boolean, guidedSocialMoment?: SocialMomentDef, inviteBonus?: number;
  runId: string;
  tick:  number;
}

export interface M91MLOutput {
  score:          number;         // 0–1
  topFactors:     string[];       // max 5 plain-English factors
  recommendation: string;         // single sentence
  auditHash:      string;         // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;        // 0–1, how fast this signal should decay
}

/**
 * firstTableInviteSafeRunMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function firstTableInviteSafeRunMLCompanion(
  input: M91MLInput,
): Promise<M91MLOutput> {
  // Advisory signal — bounded [0,1], no state mutation
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors:     ['M91 signal computed', 'advisory only'],
    recommendation: 'Monitor M91 output and adjust strategy accordingly.',
    auditHash:      computeHash(JSON.stringify(input) + ':ml:M91'),
    confidenceDecay: 0.05,
  };
}
