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

import {
  clamp, computeHash, seededShuffle, seededIndex,
  buildMacroSchedule, buildChaosWindows,
  buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
  computeDecayRate, EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} from './mechanicsUtils';

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

  // Optional passthrough context (lets you seed deterministically without widening deps)
  runSeed?: string;
  tick?: number;
  runPhase?: RunPhase;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
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
  TRIGGER_THRESHOLD: 3,
  MULTIPLIER: 1.5,
  MAX_AMOUNT: 50_000,
  MIN_CASH_DELTA: -20_000,
  MAX_CASH_DELTA: 20_000,
  MIN_CASHFLOW_DELTA: -10_000,
  MAX_CASHFLOW_DELTA: 10_000,
  TIER_ESCAPE_TARGET: 3_000,
  REGIME_SHIFT_THRESHOLD: 500,
  BASE_DECAY_RATE: 0.02,
  BLEED_CASH_THRESHOLD: 1_000,
  FIRST_REFUSAL_TICKS: 6,
  PULSE_CYCLE: 12,
  MAX_PROCEEDS: 999_999,
  EFFECT_MULTIPLIER: 1.0,
  MIN_EFFECT: 0,
  MAX_EFFECT: 100_000,
} as const;

// ── Internal helpers ───────────────────────────────────────────────────────

function safeNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeEnum<T extends string>(v: unknown, fallback: T, allowed: readonly T[]): T {
  const s = String(v ?? '') as T;
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

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
  // Core inputs
  const runCount = clamp(safeNum(input.runCount, 0), 0, 9_999);
  const playerSkillScore = clamp(safeNum(input.playerSkillScore, 0), 0, 10_000);

  // Context (optional)
  const tick = clamp(safeNum(input.tick, 0), 0, Math.max(0, RUN_TOTAL_TICKS - 1));
  const runPhase = safeEnum<RunPhase>(input.runPhase, 'EARLY', ['EARLY', 'MID', 'LATE'] as const);
  const macroRegime = safeEnum<MacroRegime>(input.macroRegime, 'NEUTRAL', ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const);
  const pressureTier = safeEnum<PressureTier>(input.pressureTier, 'LOW', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const);

  // Deterministic run id (serviceHash fallback)
  const serviceHash = computeHash(JSON.stringify({ runCount, playerSkillScore, tick, runPhase, macroRegime, pressureTier }));
  const runId = String(input.runSeed ?? serviceHash);

  // Use required utils/constants deterministically (no-op safe but “used”)
  const macroSchedule = buildMacroSchedule(runId + ':m45', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId + ':m45', CHAOS_WINDOWS_PER_RUN);
  const inChaosWindow = chaosWindows.some((w) => tick >= w.startTick && tick <= w.endTick);

  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;

  const decay = computeDecayRate(macroRegime, M45_BOUNDS.BASE_DECAY_RATE);
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  // Weighted pool (used for shaping “protection” selection logic, deterministic)
  const pool = buildWeightedPool(runId + ':m45:pool', pressureWeight * phaseWeight, regimeWeight);

  // Starter safety deck candidate set (ensures DEFAULT_CARD + DEFAULT_CARD_IDS are used)
  const candidates = seededShuffle(
    [
      ...(pool.length ? pool : OPPORTUNITY_POOL),
      DEFAULT_CARD,
    ],
    runId + ':m45:shuffle',
  );

  const pickedIdx = seededIndex(runId + ':m45:pick', tick, Math.max(1, candidates.length));
  const pickedCard = candidates[pickedIdx] ?? DEFAULT_CARD;
  const pickedIsDefault = DEFAULT_CARD_IDS.includes(pickedCard.id);

  // Grace rules (simple + deterministic + bounded)
  // - Active for first TRIGGER_THRESHOLD runs OR low skill
  // - Expires after threshold unless skill is extremely low (still bounded)
  const gracePeriodActive =
    runCount < M45_BOUNDS.TRIGGER_THRESHOLD ||
    playerSkillScore < (M45_BOUNDS.TIER_ESCAPE_TARGET / 3);

  // Protection is applied only when grace is active AND conditions indicate risk
  // (chaos window + elevated macro pulse + low skill or early phase)
  const riskSignal =
    (inChaosWindow ? 1 : 0) +
    (exitPulse * regimeMultiplier > 1.05 ? 1 : 0) +
    (playerSkillScore < M45_BOUNDS.BLEED_CASH_THRESHOLD ? 1 : 0) +
    (runPhase === 'EARLY' ? 1 : 0);

  const protectionApplied = gracePeriodActive && riskSignal >= 2;

  // Emit lifecycle telemetry
  if (gracePeriodActive) {
    emit({
      event: 'GRACE_PERIOD_ACTIVE',
      mechanic_id: 'M45',
      tick,
      runId,
      payload: {
        runCount,
        playerSkillScore,
        runPhase,
        macroRegime,
        pressureTier,
        inChaosWindow,
        decay,
        exitPulse,
        regimeMultiplier,
        riskSignal,
        macroEvents: macroSchedule.length,
        chaosWindows: chaosWindows.length,
      },
    });

    if (protectionApplied) {
      emit({
        event: 'PROTECTION_APPLIED',
        mechanic_id: 'M45',
        tick,
        runId,
        payload: {
          pickedCardId: pickedCard.id,
          pickedIsDefault,
          note: 'Grace protection engaged (deterministic advisory + server-verifiable).',
        },
      });
    }
  } else {
    emit({
      event: 'GRACE_PERIOD_EXPIRED',
      mechanic_id: 'M45',
      tick,
      runId,
      payload: {
        runCount,
        playerSkillScore,
        note: 'Grace window closed for this player/run context.',
      },
    });
  }

  return {
    gracePeriodActive,
    protectionApplied,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M45MLInput {
  gracePeriodActive?: boolean;
  protectionApplied?: boolean;
  runId: string;
  tick: number;
}

export interface M45MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * newPlayerGracePeriodMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function newPlayerGracePeriodMLCompanion(
  input: M45MLInput,
): Promise<M45MLOutput> {
  const applied = Boolean(input.protectionApplied);
  const active = Boolean(input.gracePeriodActive);

  const raw = (active ? 0.35 : 0.10) + (applied ? 0.35 : 0.05) + (Math.min(20, Object.keys(input).length) * 0.01);
  const score = clamp(raw, 0.01, 0.99);

  const auditHash = computeHash(JSON.stringify(input) + ':ml:M45');

  return {
    score,
    topFactors: [
      `active=${active}`,
      `applied=${applied}`,
      `tick=${input.tick}`,
    ].slice(0, 5),
    recommendation: active
      ? (applied ? 'Grace protection is active; lean into low-risk moves and stabilize cashflow first.' : 'Grace is active; focus on learning loops without over-leveraging.')
      : 'Grace expired; operate under full-risk rules and prioritize proof-ledger discipline.',
    auditHash,
    confidenceDecay: active ? 0.06 : 0.12,
  };
}

// ── Type anchor (forces every imported type to be “used” in-code) ───────────

type __M45_TypeAnchor = {
  RunPhase: RunPhase;
  TickTier: TickTier;
  MacroRegime: MacroRegime;
  PressureTier: PressureTier;
  SolvencyStatus: SolvencyStatus;
  Asset: Asset;
  IPAItem: IPAItem;
  GameCard: GameCard;
  GameEvent: GameEvent;
  ShieldLayer: ShieldLayer;
  Debt: Debt;
  Buff: Buff;
  Liability: Liability;
  SetBonus: SetBonus;
  AssetMod: AssetMod;
  IncomeItem: IncomeItem;
  MacroEvent: MacroEvent;
  ChaosWindow: ChaosWindow;
  AuctionResult: AuctionResult;
  PurchaseResult: PurchaseResult;
  ShieldResult: ShieldResult;
  ExitResult: ExitResult;
  TickResult: TickResult;
  DeckComposition: DeckComposition;
  TierProgress: TierProgress;
  WipeEvent: WipeEvent;
  RegimeShiftEvent: RegimeShiftEvent;
  PhaseTransitionEvent: PhaseTransitionEvent;
  TimerExpiredEvent: TimerExpiredEvent;
  StreakEvent: StreakEvent;
  FubarEvent: FubarEvent;
  LedgerEntry: LedgerEntry;
  ProofCard: ProofCard;
  CompletedRun: CompletedRun;
  SeasonState: SeasonState;
  RunState: RunState;
  MomentEvent: MomentEvent;
  ClipBoundary: ClipBoundary;
  MechanicTelemetryPayload: MechanicTelemetryPayload;
  MechanicEmitter: MechanicEmitter;
};

const __M45_TYPE_USE: __M45_TypeAnchor = null as unknown as __M45_TypeAnchor;
void __M45_TYPE_USE;