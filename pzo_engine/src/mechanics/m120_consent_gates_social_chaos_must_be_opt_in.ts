// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m120_consent_gates_social_chaos_must_be_opt_in.ts
//
// Mechanic : M120 — Consent Gates: Social Chaos Must Be Opt-In
// Family   : social_advanced   Layer: ui_component   Priority: 1   Batch: 3
// ML Pair  : m120a
// Deps     : M15
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

// ── Import Anchors (keep every import “accessible” + used) ────────────────────

/**
 * Runtime access to canonical mechanicsUtils symbols imported by this mechanic.
 * Keeps all shared imports “live” + directly reachable for debugging/tests.
 */
export const M120_IMPORTED_SYMBOLS = {
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

/**
 * Type-only anchor so every imported domain type remains referenced in-module.
 * Prevents noUnusedLocals/noUnusedParameters warnings under strict builds.
 */
export type M120_ImportedTypesAnchor = {
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

// ── Local domain types (M120-only; not provided in ./types) ───────────────────

export type SocialActionKind =
  | 'INVITE'
  | 'DUET'
  | 'STITCH'
  | 'TRADE'
  | 'SABOTAGE'
  | 'MESSAGE'
  | 'UNKNOWN';

export interface SocialAction {
  kind: SocialActionKind;
  actionId?: string; // deterministic id; if absent, derived
  sourcePlayerId?: string;
  payload?: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M120Input {
  // The social action being attempted (if any). Consent is required for “chaos-class” actions.
  socialAction?: SocialAction;

  // Target for the attempted action (if any).
  targetPlayerId?: string;

  /**
   * Consent status:
   * - true  => explicit opt-in granted
   * - false => explicit denied
   * - undefined => not yet collected (request must be issued)
   */
  consentStatus?: boolean;

  // Deterministic tick context for gating/telemetry.
  stateTick?: number;

  // Optional upstream run id and seed (if absent, derived deterministically).
  runId?: string;
  seed?: string;
}

export interface M120Output {
  consentVerified: boolean;
  actionPermitted: boolean;
  consentDenied: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M120Event = 'CONSENT_REQUESTED' | 'CONSENT_GRANTED' | 'CONSENT_DENIED';

export interface M120TelemetryPayload extends MechanicTelemetryPayload {
  event: M120Event;
  mechanic_id: 'M120';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M120_BOUNDS = {
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

// ── Helpers ───────────────────────────────────────────────────────────────

function m120DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m120DeriveRegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));

  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m120InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  if (!windows || windows.length === 0) return false;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function m120DerivePressureTier(runPhase: RunPhase, inChaos: boolean, macroRegime: MacroRegime): PressureTier {
  // Deterministic + simple: chaos bumps tier; crisis regime bumps tier; late phase bumps tier.
  let score = 0;
  if (runPhase === 'MID') score += 1;
  if (runPhase === 'LATE') score += 2;
  if (inChaos) score += 2;
  if (macroRegime === 'BEAR') score += 1;
  if (macroRegime === 'CRISIS') score += 2;

  if (score >= 5) return 'CRITICAL';
  if (score >= 3) return 'HIGH';
  if (score >= 1) return 'MEDIUM';
  return 'LOW';
}

function m120DeriveTickTier(pressureTier: PressureTier): TickTier {
  if (pressureTier === 'CRITICAL') return 'CRITICAL';
  if (pressureTier === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m120ComputeCooldownTicks(macroRegime: MacroRegime, pressureTier: PressureTier): number {
  const decay = computeDecayRate(macroRegime, M120_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;

  const raw =
    M120_BOUNDS.FIRST_REFUSAL_TICKS *
    (1 + (1.6 - regimeMult)) *
    (1 + clamp(decay, 0.01, 0.99)) *
    (0.9 + (pressureW - 0.8)) *
    (1.0 + (1.25 - pulse));

  return clamp(Math.round(raw), 1, RUN_TOTAL_TICKS);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * consentGateVerifier
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function consentGateVerifier(input: M120Input, emit: MechanicEmitter): M120Output {
  const stateTick = clamp(((input.stateTick as number) ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const socialAction: SocialAction | undefined = input.socialAction;
  const socialKind: SocialActionKind = socialAction?.kind ?? 'UNKNOWN';
  const targetPlayerId = String(input.targetPlayerId ?? '');
  const consentStatus = input.consentStatus;

  // Deterministic ids (server-verifiable; no RNG).
  const baseRunId =
    (input.runId && String(input.runId).trim()) ||
    computeHash(JSON.stringify({ mid: 'M120', t: stateTick, tgt: targetPlayerId, k: socialKind }));

  const actionId =
    (socialAction?.actionId && String(socialAction.actionId).trim()) ||
    computeHash(JSON.stringify({ mid: 'M120', run: baseRunId, t: stateTick, tgt: targetPlayerId, k: socialKind }));

  const seed =
    (input.seed && String(input.seed).trim()) ||
    computeHash(`${baseRunId}:${actionId}:${targetPlayerId}:${stateTick}:M120`);

  // Deterministic macro fabric (keeps shared imports “truly live”).
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const runPhase = m120DerivePhase(stateTick);
  const macroRegime = m120DeriveRegimeFromSchedule(stateTick, macroSchedule, 'NEUTRAL');
  const inChaos = m120InChaosWindow(stateTick, chaosWindows);

  const pressureTier = m120DerivePressureTier(runPhase, inChaos, macroRegime);
  const tickTier = m120DeriveTickTier(pressureTier);

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  // Pool & deck hints (ties consent gating into card economy for UI/debug/audit).
  const weightedPool = buildWeightedPool(seed + ':pool', pressureW * phaseW, regimeW);
  const poolPick =
    weightedPool[seededIndex(seed, stateTick + 7, Math.max(1, weightedPool.length))] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const deckHintTop = deckOrder[0] ?? DEFAULT_CARD.id;

  const opportunityHint =
    OPPORTUNITY_POOL[seededIndex(seed, stateTick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const cooldownTicks = m120ComputeCooldownTicks(macroRegime, pressureTier);

  // Consent rule: Social chaos MUST be opt-in.
  // If consentStatus is not explicitly true, the action is not permitted.
  const consentVerified = consentStatus === true;
  const consentDenied = consentStatus === false;
  const actionPermitted = consentVerified;

  // Deterministic audit hash: binds decision to the exact inputs + derived context.
  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M120',
      baseRunId,
      actionId,
      seed,
      tick: stateTick,
      targetPlayerId,
      socialKind,
      consentStatus: consentStatus ?? null,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      inChaos,
      cooldownTicks,
      poolPickId: poolPick.id,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
    }),
  );

  // Emit exactly one canonical event per call (fail-closed).
  const event: M120Event =
    consentStatus === true ? 'CONSENT_GRANTED' : consentStatus === false ? 'CONSENT_DENIED' : 'CONSENT_REQUESTED';

  emit({
    event,
    mechanic_id: 'M120',
    tick: stateTick,
    runId: baseRunId,
    payload: {
      actionId,
      targetPlayerId,
      socialKind,
      consentStatus: consentStatus ?? null,

      // Derived risk context
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      inChaos,

      // Deterministic UI hints / audit hooks
      poolPickId: poolPick.id,
      poolPickName: poolPick.name,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      opportunityHintName: opportunityHint.name,

      // Cooldown guidance (UI can display “try again in X ticks”)
      cooldownTicks,

      // Audit binding
      auditHash,
    },
  });

  return {
    consentVerified,
    actionPermitted,
    consentDenied,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M120MLInput {
  consentVerified?: boolean;
  actionPermitted?: boolean;
  consentDenied?: boolean;
  runId: string;
  tick: number;
}

export interface M120MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * consentGateVerifierMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function consentGateVerifierMLCompanion(input: M120MLInput): Promise<M120MLOutput> {
  const t = clamp(((input.tick as number) ?? 0), 0, RUN_TOTAL_TICKS - 1);

  // Conservative scoring: permission without verified consent should never score high.
  const base =
    input.consentVerified === true
      ? 0.85
      : input.consentDenied === true
        ? 0.20
        : input.actionPermitted === true
          ? 0.45
          : 0.10;

  const runPhase = m120DerivePhase(t);
  const macroSchedule = buildMacroSchedule(computeHash(input.runId + ':M120:ml'), MACRO_EVENTS_PER_RUN);
  const macroRegime = m120DeriveRegimeFromSchedule(t, macroSchedule, 'NEUTRAL');
  const decay = computeDecayRate(macroRegime, M120_BOUNDS.BASE_DECAY_RATE);

  const score = clamp(base * (1 - decay * 0.25) * (runPhase === 'LATE' ? 0.95 : 1.0), 0.01, 0.99);

  const topFactors: string[] = [];
  if (input.consentVerified === true) topFactors.push('Explicit opt-in present');
  if (input.consentDenied === true) topFactors.push('Explicit opt-in denied');
  if (input.consentVerified !== true && input.consentDenied !== true) topFactors.push('Consent not yet collected');
  topFactors.push(`Regime: ${macroRegime}`);
  topFactors.push(`Phase: ${runPhase}`);

  const recommendation =
    input.consentVerified === true
      ? 'Proceed: consent is verified.'
      : input.consentDenied === true
        ? 'Block: consent denied.'
        : 'Request consent before permitting social chaos actions.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + `:ml:M120:${macroRegime}:${runPhase}:${t}`),
    confidenceDecay: clamp(0.05 + decay * 0.25, 0.01, 0.50),
  };
}