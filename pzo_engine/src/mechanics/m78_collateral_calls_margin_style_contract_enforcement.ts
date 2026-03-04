// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m78_collateral_calls_margin_style_contract_enforcement.ts
//
// Mechanic : M78 — Collateral Calls: Margin-Style Contract Enforcement
// Family   : coop_governance   Layer: api_endpoint   Priority: 2   Batch: 2
// ML Pair  : m78a
// Deps     : M26, M29
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
 * Runtime access to the canonical mechanicsUtils symbols imported by this mechanic.
 * Keeps generator-wide imports “live” and provides inspection/debug handles.
 */
export const M78_IMPORTED_SYMBOLS = {
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
 * Type-only anchor to ensure every imported domain type remains referenced in-module.
 */
export type M78_ImportedTypesAnchor = {
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

// ── Local domain types (standalone; no forced edits to ./types.ts) ──────────

export type CollateralMode = 'INITIAL_MARGIN' | 'MAINTENANCE_MARGIN' | 'VARIATION_MARGIN';

export interface CollateralRequirement {
  mode?: CollateralMode;
  requiredPct?: number; // of notional, 0..1
  requiredMin?: number; // absolute floor
  graceTicks?: number; // ticks before default can trigger
  penaltyPct?: number; // applied to requirement if in chaos/high pressure
  notional?: number; // contract notional (optional; deterministically derived if omitted)
  lastMarkedPnL?: number; // variation margin driver (optional)
}

export interface CollateralDecision {
  contractId: string;

  // Context
  tick: number;
  phase: RunPhase;
  regime: MacroRegime;
  pressureTier: PressureTier;
  inChaos: boolean;

  // Requirement
  mode: CollateralMode;
  notional: number;
  baseRequirement: number;
  adjustedRequirement: number;
  graceTicks: number;
  deadlineTick: number;

  // Treasury + outcome
  stateTreasury: number;
  marginMet: boolean;
  defaultTriggered: boolean;

  // Deterministic audit
  seed: string;
  auditHash: string;

  // Effect score (telemetry-only)
  effectScore: number;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M78Input {
  contractId?: string;
  collateralRequirement?: CollateralRequirement;
  stateTreasury?: number;

  // Optional execution context (safe to omit)
  tick?: number;
  runId?: string;
  pressureTier?: PressureTier;
}

export interface M78Output {
  collateralCallIssued: boolean;
  marginMet: boolean;
  defaultTriggered: boolean;
  decision?: CollateralDecision;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M78Event = 'COLLATERAL_CALL_ISSUED' | 'MARGIN_MET' | 'MARGIN_DEFAULT';

export interface M78TelemetryPayload extends MechanicTelemetryPayload {
  event: M78Event;
  mechanic_id: 'M78';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M78_BOUNDS = {
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

// ── Internal helpers (deterministic, no state mutation) ────────────────────

function m78DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m78DeriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const sorted = [...(schedule ?? [])].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m78InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m78DerivePressureTier(proxyParticipants: number, inChaos: boolean): PressureTier {
  if (inChaos) return proxyParticipants >= 6 ? 'CRITICAL' : 'HIGH';
  if (proxyParticipants <= 2) return 'LOW';
  if (proxyParticipants <= 5) return 'MEDIUM';
  if (proxyParticipants <= 8) return 'HIGH';
  return 'CRITICAL';
}

function m78NormalizeReq(req?: CollateralRequirement): Required<
  Pick<CollateralRequirement, 'mode' | 'requiredPct' | 'requiredMin' | 'graceTicks' | 'penaltyPct' | 'notional' | 'lastMarkedPnL'>
> {
  const mode: CollateralMode = req?.mode ?? 'MAINTENANCE_MARGIN';
  const requiredPct = clamp(Number(req?.requiredPct ?? 0.15), 0, 1);
  const requiredMin = Math.max(0, Math.floor(Number(req?.requiredMin ?? 0)));
  const graceTicks = clamp(Math.floor(Number(req?.graceTicks ?? 6)), 0, RUN_TOTAL_TICKS);
  const penaltyPct = clamp(Number(req?.penaltyPct ?? 0.1), 0, 2); // up to +200%
  const notional = Math.max(0, Math.floor(Number(req?.notional ?? 0)));
  const lastMarkedPnL = Math.floor(Number(req?.lastMarkedPnL ?? 0));
  return { mode, requiredPct, requiredMin, graceTicks, penaltyPct, notional, lastMarkedPnL };
}

function m78DeriveNotional(seed: string, tick: number): number {
  // Derive notional from deterministic pools (keeps pool imports live)
  const scheduleCard = OPPORTUNITY_POOL[seededIndex(seed, tick + 33, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;
  const base = Number(scheduleCard.cost ?? scheduleCard.downPayment ?? 25_000);
  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:notionalDeck:${tick}`);
  const top = deck[0] ?? DEFAULT_CARD.id;
  const nudge = seededIndex(computeHash(`${seed}:${top}`), tick + 7, 20); // 0..19
  const out = Math.round((Math.max(1_000, base) * (1 + nudge * 0.03)) / 100) * 100;
  return clamp(out, 1_000, 5_000_000);
}

function m78ComputeRequirement(
  mode: CollateralMode,
  notional: number,
  requiredPct: number,
  requiredMin: number,
  lastMarkedPnL: number,
): number {
  const basePct = Math.round(notional * requiredPct);

  // Variation margin can incorporate marked PnL (loss increases requirement, gain reduces but never below min)
  if (mode === 'VARIATION_MARGIN') {
    const adj = basePct + Math.max(0, -lastMarkedPnL);
    return Math.max(requiredMin, adj);
  }

  return Math.max(requiredMin, basePct);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * collateralCallEnforcer
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function collateralCallEnforcer(input: M78Input, emit: MechanicEmitter): M78Output {
  const contractId = String(input.contractId ?? '');
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? computeHash(JSON.stringify(input)));

  const req = m78NormalizeReq(input.collateralRequirement);
  const stateTreasury = Math.floor(Number(input.stateTreasury ?? 0));

  // Deterministic seed (stable for server verification)
  const seed = computeHash(
    JSON.stringify({
      m: 'M78',
      contractId,
      tick,
      runId,
      req: {
        mode: req.mode,
        requiredPct: req.requiredPct,
        requiredMin: req.requiredMin,
        graceTicks: req.graceTicks,
        penaltyPct: req.penaltyPct,
        notional: req.notional,
        lastMarkedPnL: req.lastMarkedPnL,
      },
    }),
  );

  // Context (bounded chaos)
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m78DerivePhase(tick);
  const regime = m78DeriveRegime(tick, macroSchedule);
  const inChaos = m78InChaosWindow(tick, chaosWindows);

  const proxyParticipants = clamp(seededIndex(seed, tick + 11, 12) + 1, 1, 12);
  const pressureTier = (input.pressureTier as PressureTier) ?? m78DerivePressureTier(proxyParticipants, inChaos);

  // Economics scaling (uses imports intentionally)
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M78_BOUNDS.BASE_DECAY_RATE);

  const notional = req.notional > 0 ? req.notional : m78DeriveNotional(seed, tick);

  const baseRequirement = m78ComputeRequirement(req.mode, notional, req.requiredPct, req.requiredMin, req.lastMarkedPnL);

  const penaltyFactor =
    (inChaos || pressureTier === 'HIGH' || pressureTier === 'CRITICAL')
      ? 1 + req.penaltyPct * clamp(pressureW * regimeW, 0.5, 3.0)
      : 1;

  const adjustedRequirement = Math.round(
    baseRequirement *
      penaltyFactor *
      clamp(phaseW * regimeMul * exitPulse, 0.5, 6.0) *
      (inChaos ? (1 + decayRate) : 1),
  );

  const graceTicks = clamp(req.graceTicks, 0, RUN_TOTAL_TICKS);
  const deadlineTick = clamp(tick + graceTicks, tick, RUN_TOTAL_TICKS);

  // Decision (no state mutation beyond output)
  const marginMet = stateTreasury >= adjustedRequirement;

  // If margin is not met, default triggers after grace window; this mechanic only issues call now.
  // We can conservatively mark defaultTriggered=false at issuance-time; but keep deterministic by using tick vs deadline
  const defaultTriggered = !marginMet && tick >= deadlineTick;

  // Emit collateral call
  emit({
    event: 'COLLATERAL_CALL_ISSUED',
    mechanic_id: 'M78',
    tick,
    runId,
    payload: {
      contractId,
      mode: req.mode,
      notional,
      baseRequirement,
      adjustedRequirement,
      graceTicks,
      deadlineTick,
      stateTreasury,
      phase,
      regime,
      pressureTier,
      inChaos,
    },
  });

  if (marginMet) {
    emit({
      event: 'MARGIN_MET',
      mechanic_id: 'M78',
      tick,
      runId,
      payload: {
        contractId,
        adjustedRequirement,
        stateTreasury,
      },
    });
  } else if (defaultTriggered) {
    emit({
      event: 'MARGIN_DEFAULT',
      mechanic_id: 'M78',
      tick,
      runId,
      payload: {
        contractId,
        adjustedRequirement,
        stateTreasury,
        deadlineTick,
        note: 'deadline_reached',
      },
    });
  }

  // Bounded effect score (telemetry-only)
  const effectRaw =
    (marginMet ? 0.25 : 0.85) *
    (pressureW * phaseW * regimeW) *
    (regimeMul * exitPulse) *
    (inChaos ? (1 - clamp(decayRate, 0, 0.5)) : 1);

  const effectScore = clamp(effectRaw * M78_BOUNDS.MAX_EFFECT * M78_BOUNDS.EFFECT_MULTIPLIER, M78_BOUNDS.MIN_EFFECT, M78_BOUNDS.MAX_EFFECT);

  const auditHash = computeHash(
    JSON.stringify({
      contractId,
      tick,
      mode: req.mode,
      notional,
      baseRequirement,
      adjustedRequirement,
      graceTicks,
      deadlineTick,
      stateTreasury,
      marginMet,
      defaultTriggered,
      phase,
      regime,
      pressureTier,
      inChaos,
      effectScore: Math.round(effectScore),
      seed,
    }),
  );

  const decision: CollateralDecision = {
    contractId,

    tick,
    phase,
    regime,
    pressureTier,
    inChaos,

    mode: req.mode,
    notional,
    baseRequirement,
    adjustedRequirement,
    graceTicks,
    deadlineTick,

    stateTreasury,
    marginMet,
    defaultTriggered,

    seed,
    auditHash,

    effectScore: Math.round(effectScore),
  };

  return {
    collateralCallIssued: true,
    marginMet,
    defaultTriggered,
    decision,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M78MLInput {
  collateralCallIssued?: boolean;
  marginMet?: boolean;
  defaultTriggered?: boolean;
  runId: string;
  tick: number;
}

export interface M78MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * collateralCallEnforcerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function collateralCallEnforcerMLCompanion(input: M78MLInput): Promise<M78MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const issued = Boolean(input.collateralCallIssued ?? false);
  const met = Boolean(input.marginMet ?? false);
  const def = Boolean(input.defaultTriggered ?? false);

  // Neutral decay baseline (regime unknown here)
  const confidenceDecay = computeDecayRate('NEUTRAL' as MacroRegime, M78_BOUNDS.BASE_DECAY_RATE);

  // Score: issuing call is neutral; meeting margin is positive; default is negative.
  const score = clamp(0.5 + (issued ? 0.05 : -0.1) + (met ? 0.35 : -0.15) + (def ? -0.35 : 0.0), 0.01, 0.99);

  // Deterministic hint using DEFAULT_CARD_IDS (keeps import live)
  const hintPick = seededIndex(computeHash(`M78ML:${tick}:${input.runId}:${issued}:${met}:${def}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintPick] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `callIssued=${issued ? 'yes' : 'no'}`,
    `marginMet=${met ? 'yes' : 'no'}`,
    `default=${def ? 'yes' : 'no'}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation = def
    ? 'Default triggered: enforce contract penalties and require a remediation plan before reinstatement.'
    : met
      ? 'Margin satisfied: clear the collateral call and continue contract execution.'
      : issued
        ? 'Collateral call active: notify counterparty and monitor treasury until deadline.'
        : 'No collateral action: keep monitoring mark-to-market and required margin.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M78'),
    confidenceDecay,
  };
}