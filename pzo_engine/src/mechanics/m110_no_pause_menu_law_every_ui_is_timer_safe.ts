// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m110_no_pause_menu_law_every_ui_is_timer_safe.ts
//
// Mechanic : M110 — No Pause Menu Law: Every UI Is Timer-Safe
// Family   : portfolio_experimental   Layer: tick_engine   Priority: 1   Batch: 3
// ML Pair  : m110a
// Deps     : M02
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {
  clamp,
  computeHash,
  seededShuffle,
  seededIndex,
  buildMacroSchedule,
  buildChaosWindows,
  buildWeightedPool,
  OPPORTUNITY_POOL,
  DEFAULT_CARD,
  DEFAULT_CARD_IDS,
  computeDecayRate,
  EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN,
  CHAOS_WINDOWS_PER_RUN,
  RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS,
  PHASE_WEIGHTS,
  REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} from './mechanicsUtils';

import type {
  RunPhase,
  TickTier,
  MacroRegime,
  PressureTier,
  SolvencyStatus,
  Asset,
  IPAItem,
  GameCard,
  GameEvent,
  ShieldLayer,
  Debt,
  Buff,
  Liability,
  SetBonus,
  AssetMod,
  IncomeItem,
  MacroEvent,
  ChaosWindow,
  AuctionResult,
  PurchaseResult,
  ShieldResult,
  ExitResult,
  TickResult,
  DeckComposition,
  TierProgress,
  WipeEvent,
  RegimeShiftEvent,
  PhaseTransitionEvent,
  TimerExpiredEvent,
  StreakEvent,
  FubarEvent,
  LedgerEntry,
  ProofCard,
  CompletedRun,
  SeasonState,
  RunState,
  MomentEvent,
  ClipBoundary,
  MechanicTelemetryPayload,
  MechanicEmitter,
} from './types';

// ── Import Anchors (keeps every symbol accessible + TS-used) ──────────────────

export const M110_IMPORTED_SYMBOLS = {
  clamp,
  computeHash,
  seededShuffle,
  seededIndex,
  buildMacroSchedule,
  buildChaosWindows,
  buildWeightedPool,
  OPPORTUNITY_POOL,
  DEFAULT_CARD,
  DEFAULT_CARD_IDS,
  computeDecayRate,
  EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN,
  CHAOS_WINDOWS_PER_RUN,
  RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS,
  PHASE_WEIGHTS,
  REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} as const;

export type M110_ImportedTypesAnchor = {
  runPhase: RunPhase;
  tickTier: TickTier;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  solvencyStatus: SolvencyStatus;
  asset: Asset;
  ipaItem: IPAItem;
  gameCard: GameCard;
  gameEvent: GameEvent;
  shieldLayer: ShieldLayer;
  debt: Debt;
  buff: Buff;
  liability: Liability;
  setBonus: SetBonus;
  assetMod: AssetMod;
  incomeItem: IncomeItem;
  macroEvent: MacroEvent;
  chaosWindow: ChaosWindow;
  auctionResult: AuctionResult;
  purchaseResult: PurchaseResult;
  shieldResult: ShieldResult;
  exitResult: ExitResult;
  tickResult: TickResult;
  deckComposition: DeckComposition;
  tierProgress: TierProgress;
  wipeEvent: WipeEvent;
  regimeShiftEvent: RegimeShiftEvent;
  phaseTransitionEvent: PhaseTransitionEvent;
  timerExpiredEvent: TimerExpiredEvent;
  streakEvent: StreakEvent;
  fubarEvent: FubarEvent;
  ledgerEntry: LedgerEntry;
  proofCard: ProofCard;
  completedRun: CompletedRun;
  seasonState: SeasonState;
  runState: RunState;
  momentEvent: MomentEvent;
  clipBoundary: ClipBoundary;
  mechanicTelemetryPayload: MechanicTelemetryPayload;
  mechanicEmitter: MechanicEmitter;
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M110Input {
  uiAction?: unknown;
  stateTick?: number;
  pauseAttempt?: unknown;

  // Optional, backward-compatible additions (keeps existing callers intact)
  stateRunPhase?: RunPhase;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
  runId?: string;
}

export interface M110Output {
  pauseBlocked: boolean;
  timerContinues: boolean;
  uiSafetyConfirmed: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M110Event = 'PAUSE_BLOCKED' | 'TIMER_SAFE_UI_RENDERED' | 'UI_STALL_DETECTED';

export interface M110TelemetryPayload extends MechanicTelemetryPayload {
  event: M110Event;
  mechanic_id: 'M110';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M110_BOUNDS = {
  BASE_AMOUNT: 1_000,
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

// ── Internal helpers (pure, deterministic) ─────────────────────────────────

function m110ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS);
}

function m110PhaseFromProgress(p: number): RunPhase {
  const progress = clamp(p, 0, 1);
  return progress < 0.33 ? 'EARLY' : progress < 0.66 ? 'MID' : 'LATE';
}

function m110NormalizeRegime(r: unknown): MacroRegime {
  switch (r) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return r;
    // deterministic mappings for stray labels that may leak in
    case 'RECESSION':
    case 'DOWNTURN':
      return 'BEAR';
    case 'BOOM':
    case 'EXPANSION':
      return 'BULL';
    default:
      return 'NEUTRAL';
  }
}

function m110NormalizePressure(p: unknown): PressureTier {
  switch (p) {
    case 'LOW':
    case 'MEDIUM':
    case 'HIGH':
    case 'CRITICAL':
      return p;
    default:
      return 'LOW';
  }
}

function m110ChaosHit(tick: number, windows: ChaosWindow[]): ChaosWindow | null {
  for (const w of windows) {
    const startTick = (w as unknown as { startTick?: unknown }).startTick;
    const endTick = (w as unknown as { endTick?: unknown }).endTick;
    if (typeof startTick === 'number' && typeof endTick === 'number') {
      if (tick >= startTick && tick <= endTick) return w;
    }
  }
  return null;
}

function m110RegimeFromSchedule(tick: number, macroSchedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  let r: MacroRegime = fallback;
  for (const ev of macroSchedule) {
    const t = (ev as unknown as { tick?: unknown }).tick;
    if (typeof t !== 'number' || t > tick) continue;

    const rc = (ev as unknown as { regimeChange?: unknown }).regimeChange;
    if (rc != null) r = m110NormalizeRegime(rc);
  }
  return r;
}

function m110UiStallHeuristic(uiAction: unknown, pauseAttempt: unknown): number {
  const s = typeof uiAction === 'string' ? uiAction.toLowerCase() : '';
  const o = uiAction && typeof uiAction === 'object' ? JSON.stringify(uiAction) : '';
  const hint = `${s} ${o}`.toLowerCase();

  const explicit =
    (pauseAttempt != null ? 0.35 : 0) +
    (hint.includes('pause') ? 0.25 : 0) +
    (hint.includes('stall') ? 0.25 : 0) +
    (hint.includes('freeze') ? 0.20 : 0) +
    (hint.includes('modal') ? 0.10 : 0) +
    (hint.includes('confirm') ? 0.05 : 0);

  return clamp(explicit, 0, 1);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * noPauseMenuLawEnforcer
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function noPauseMenuLawEnforcer(input: M110Input, emit: MechanicEmitter): M110Output {
  const currentTick = typeof input.stateTick === 'number' ? input.stateTick : 0;
  const nextTick = m110ClampTick(currentTick + 1);
  const timerExpired = nextTick >= RUN_TOTAL_TICKS;

  const runId =
    (typeof input.runId === 'string' && input.runId.trim().length > 0
      ? input.runId.trim()
      : computeHash(`M110:run:${currentTick}:${JSON.stringify(input.uiAction ?? null)}:${JSON.stringify(input.pauseAttempt ?? null)}`));

  const seed = computeHash(`M110:${runId}:${nextTick}:${JSON.stringify(input.uiAction ?? null)}:${JSON.stringify(input.pauseAttempt ?? null)}`);

  // deterministically consume scheduling utilities (keeps them live in runtime graph)
  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const progress = clamp(nextTick / RUN_TOTAL_TICKS, 0, 1);
  const newPhase: RunPhase = m110PhaseFromProgress(progress);
  const prevPhase: RunPhase = input.stateRunPhase ?? 'EARLY';
  const phaseChanged = newPhase !== prevPhase;

  const baseRegime: MacroRegime = m110NormalizeRegime(input.stateMacroRegime ?? 'NEUTRAL');
  const regime: MacroRegime = m110RegimeFromSchedule(nextTick, macroSchedule, baseRegime);

  const chaosHit = m110ChaosHit(nextTick, chaosWindows);

  const basePressure: PressureTier = m110NormalizePressure(input.statePressureTier ?? 'LOW');
  const derivedPressure: PressureTier =
    chaosHit != null ? 'CRITICAL' : progress < 0.33 ? 'LOW' : progress < 0.66 ? 'MEDIUM' : 'HIGH';
  const pressure: PressureTier = derivedPressure ?? basePressure;

  const phaseWeight = PHASE_WEIGHTS[newPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decayRate = computeDecayRate(regime, M110_BOUNDS.BASE_DECAY_RATE);

  // deterministically pick a “UI guard card” (purely advisory metadata; does not change state)
  const weightedPool = buildWeightedPool(`${seed}:ui_guard_pool`, phaseWeight * pressureWeight, regimeWeight * regimeMultiplier);
  const fallbackCard =
    OPPORTUNITY_POOL[seededIndex(`${seed}:opp`, nextTick, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;
  const guardCard: GameCard =
    (weightedPool[seededIndex(`${seed}:guard`, nextTick + 7, Math.max(1, weightedPool.length))] as GameCard | undefined) ??
    fallbackCard;

  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deck_sig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  const uiStallHint = m110UiStallHeuristic(input.uiAction, input.pauseAttempt);
  const pulseFactor = nextTick % M110_BOUNDS.PULSE_CYCLE === 0 ? 0.15 : 0;
  const chaosFactor = chaosHit ? 0.25 : 0;

  const stallRisk = clamp(
    uiStallHint +
      pulseFactor +
      chaosFactor +
      clamp(decayRate * 2.0, 0, 0.25) +
      clamp((1 - exitPulse) * 0.15, 0, 0.15),
    0,
    1,
  );

  const pauseBlocked = true; // absolute law: no pause menu
  const timerContinues = true;

  // “Every UI is timer-safe”: safety confirmed unless a stall attempt is detected beyond hard bound
  const uiSafetyConfirmed = stallRisk < 0.90;

  if (input.pauseAttempt != null) {
    emit({
      event: 'PAUSE_BLOCKED',
      mechanic_id: 'M110',
      tick: nextTick,
      runId,
      payload: {
        nextTick,
        timerExpired,
        phase: newPhase,
        phaseChanged,
        regime,
        pressure,
        stallRisk,
        guardCardId: (guardCard as unknown as { id?: unknown }).id ?? null,
        deckSig,
        rulesSig: computeHash(`M110:${M110_BOUNDS.TRIGGER_THRESHOLD}:${M110_BOUNDS.PULSE_CYCLE}:${RUN_TOTAL_TICKS}`),
      },
    });
  }

  if (input.uiAction != null) {
    emit({
      event: 'TIMER_SAFE_UI_RENDERED',
      mechanic_id: 'M110',
      tick: nextTick,
      runId,
      payload: {
        nextTick,
        progress,
        phase: newPhase,
        regime,
        pressure,
        uiSafetyConfirmed,
        stallRisk,
        chaosActive: chaosHit != null,
        macroEventsPlanned: MACRO_EVENTS_PER_RUN,
        chaosWindowsPlanned: CHAOS_WINDOWS_PER_RUN,
        guardCardId: (guardCard as unknown as { id?: unknown }).id ?? null,
        deckSig,
      },
    });
  }

  if (!uiSafetyConfirmed) {
    emit({
      event: 'UI_STALL_DETECTED',
      mechanic_id: 'M110',
      tick: nextTick,
      runId,
      payload: {
        nextTick,
        reason: 'stall_risk_exceeded',
        stallRisk,
        phase: newPhase,
        regime,
        pressure,
        uiActionHash: computeHash(JSON.stringify(input.uiAction ?? null)),
        pauseAttemptPresent: input.pauseAttempt != null,
      },
    });
  }

  return {
    pauseBlocked,
    timerContinues,
    uiSafetyConfirmed,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M110MLInput {
  pauseBlocked?: boolean;
  timerContinues?: boolean;
  uiSafetyConfirmed?: boolean;
  runId: string;
  tick: number;
}

export interface M110MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * noPauseMenuLawEnforcerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function noPauseMenuLawEnforcerMLCompanion(input: M110MLInput): Promise<M110MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors: ['M110 signal computed', 'advisory only'],
    recommendation: input.uiSafetyConfirmed === false ? 'Avoid UI stall attempts; timer will not pause.' : 'Keep moving; timer-safe UI confirmed.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M110'),
    confidenceDecay: 0.05,
  };
}