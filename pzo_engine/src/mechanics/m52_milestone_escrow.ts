// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m52_milestone_escrow.ts
//
// Mechanic : M52 — Milestone Escrow
// Family   : coop_advanced   Layer: api_endpoint   Priority: 2   Batch: 2
// ML Pair  : m52a
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

// ── Import Anchors (keep every import "accessible" + used) ────────────────────

/**
 * Runtime access to the canonical mechanicsUtils symbols imported by this mechanic.
 * (Useful for debugging, inspection, and keeping generator-wide imports “live”.)
 */
export const M52_IMPORTED_SYMBOLS = {
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
export type M52_ImportedTypesAnchor = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Local domain contracts (M52)
// ─────────────────────────────────────────────────────────────────────────────

export type MilestoneComparator = 'GTE' | 'LTE' | 'EQ' | 'NEQ';
export type MilestoneMetric =
  | 'CASH'
  | 'NET_WORTH'
  | 'TICK'
  | 'CORD_SCORE'
  | 'ASSET_COUNT'
  | 'DEBT_RATIO'
  | 'CUSTOM';

export interface MilestoneCondition {
  id: string;
  metric: MilestoneMetric;
  comparator: MilestoneComparator;
  target: number;
  current?: number;
  weight?: number; // default 1.0 (used for progress score only)
  meta?: Record<string, unknown>;
}

export type EscrowStatus = 'VOID' | 'LOCKED' | 'RELEASED';

export interface EscrowResult {
  escrowId: string;
  runId: string;
  tick: number;

  amountLocked: number;
  amountReleased: number;

  status: EscrowStatus;
  lockedUntilTick: number;

  milestoneMet: boolean;
  progressScore: number; // 0..1

  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;

  collateralCard: GameCard;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  inChaosWindow: boolean;

  decayRate: number;
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M52Input {
  escrowAmount?: number;
  milestoneConditions?: MilestoneCondition[];

  // Optional context (safe if snapshotExtractor supplies more fields)
  stateTick?: number;
  stateRunId?: string;
  stateRunPhase?: RunPhase;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
  seed?: string;
}

export interface M52Output {
  escrowCreated: EscrowResult;
  milestoneResult: Record<string, unknown>;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M52Event = 'ESCROW_CREATED' | 'MILESTONE_MET' | 'ESCROW_RELEASED';

export interface M52TelemetryPayload extends MechanicTelemetryPayload {
  event: M52Event;
  mechanic_id: 'M52';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M52_BOUNDS = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (pure + deterministic)
// ─────────────────────────────────────────────────────────────────────────────

function m52DeriveRunPhase(tick: number): RunPhase {
  const t = clamp(tick, 0, Math.max(0, RUN_TOTAL_TICKS - 1));
  const p = RUN_TOTAL_TICKS <= 0 ? 0 : t / RUN_TOTAL_TICKS;
  if (p < 0.34) return 'EARLY';
  if (p < 0.67) return 'MID';
  return 'LATE';
}

function m52DerivePressureTier(escrowAmount: number): PressureTier {
  const pct = M52_BOUNDS.MAX_AMOUNT <= 0 ? 0 : escrowAmount / M52_BOUNDS.MAX_AMOUNT;
  if (pct < 0.2) return 'LOW';
  if (pct < 0.55) return 'MEDIUM';
  if (pct < 0.85) return 'HIGH';
  return 'CRITICAL';
}

function m52DeriveMacroRegime(seed: string, tick: number): { macroRegime: MacroRegime; macroSchedule: MacroEvent[] } {
  const macroSchedule = buildMacroSchedule(seed + ':m52:macro', MACRO_EVENTS_PER_RUN)
    .slice()
    .sort((a, b) => a.tick - b.tick);

  let macroRegime: MacroRegime = 'NEUTRAL';
  for (const ev of macroSchedule) {
    if (ev.tick <= tick && ev.regimeChange) macroRegime = ev.regimeChange;
  }
  return { macroRegime, macroSchedule };
}

function m52IsTickInChaos(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m52EvalComparator(comparator: MilestoneComparator, current: number, target: number): boolean {
  switch (comparator) {
    case 'GTE':
      return current >= target;
    case 'LTE':
      return current <= target;
    case 'EQ':
      return current === target;
    case 'NEQ':
      return current !== target;
    default:
      return false;
  }
}

function m52ScoreCondition(cond: MilestoneCondition): { met: boolean; score: number } {
  const current = typeof cond.current === 'number' ? cond.current : 0;
  const target = typeof cond.target === 'number' ? cond.target : 0;
  const met = m52EvalComparator(cond.comparator, current, target);

  // Progress score: bounded 0..1 (direction-aware for GTE/LTE; strict for EQ/NEQ)
  let score = met ? 1 : 0;
  if (!met) {
    if (cond.comparator === 'GTE') score = target === 0 ? 0 : clamp(current / target, 0, 0.99);
    if (cond.comparator === 'LTE') score = current === 0 ? 1 : clamp(target / current, 0, 0.99);
    if (cond.comparator === 'EQ') score = 0;
    if (cond.comparator === 'NEQ') score = 0;
  }
  return { met, score };
}

function m52AggregateProgress(conditions: MilestoneCondition[]): { milestoneMet: boolean; progressScore: number } {
  if (conditions.length === 0) return { milestoneMet: false, progressScore: 0 };

  let weightSum = 0;
  let weightedScore = 0;
  let allMet = true;

  for (const c of conditions) {
    const w = typeof c.weight === 'number' && c.weight > 0 ? c.weight : 1;
    const r = m52ScoreCondition(c);
    allMet = allMet && r.met;
    weightSum += w;
    weightedScore += r.score * w;
  }

  const progressScore = weightSum <= 0 ? 0 : clamp(weightedScore / weightSum, 0, 1);
  return { milestoneMet: allMet, progressScore };
}

function m52PickCollateralCard(seed: string, tick: number, pressurePhaseWeight: number, regimeWeight: number): GameCard {
  const weighted = buildWeightedPool(seed + ':m52:pool', pressurePhaseWeight, regimeWeight);
  const pool = weighted.length > 0 ? weighted : OPPORTUNITY_POOL;

  const idx = seededIndex(seed + ':m52:pick', tick, pool.length);
  const picked = pool[idx] ?? DEFAULT_CARD;

  // Enforce allowlist/fallback (prevents unknown card IDs from leaking into escrow receipts)
  return DEFAULT_CARD_IDS.includes(picked.id) ? picked : DEFAULT_CARD;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * milestoneEscrowEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function milestoneEscrowEngine(input: M52Input, emit: MechanicEmitter): M52Output {
  const tick = clamp((input.stateTick as number) ?? 0, 0, Math.max(0, RUN_TOTAL_TICKS - 1));

  const runId =
    (typeof input.stateRunId === 'string' && input.stateRunId.length > 0
      ? input.stateRunId
      : computeHash(JSON.stringify(input) + ':m52:run')) ?? computeHash('m52:fallback');

  const seed =
    (typeof input.seed === 'string' && input.seed.length > 0 ? input.seed : computeHash(runId + ':m52:seed')) ??
    computeHash('m52:seed:fallback');

  const escrowAmountRaw = (input.escrowAmount as number) ?? 0;
  const escrowAmount = clamp(escrowAmountRaw, 0, M52_BOUNDS.MAX_AMOUNT);

  const conditionsRaw = (input.milestoneConditions as MilestoneCondition[]) ?? [];
  const normalizedConditions = conditionsRaw
    .filter(c => !!c && typeof c.id === 'string' && c.id.length > 0)
    .map(c => ({
      id: c.id,
      metric: c.metric ?? 'CUSTOM',
      comparator: c.comparator ?? 'GTE',
      target: typeof c.target === 'number' ? c.target : 0,
      current: typeof c.current === 'number' ? c.current : 0,
      weight: typeof c.weight === 'number' ? c.weight : 1,
      meta: (c.meta as Record<string, unknown>) ?? {},
    }));

  // Deterministic ordering (prevents client-side reordering from affecting hashes)
  const conditions = seededShuffle(normalizedConditions, seed + ':m52:conds');

  const runPhase: RunPhase = (input.stateRunPhase as RunPhase) ?? m52DeriveRunPhase(tick);

  const { macroRegime: derivedRegime, macroSchedule } = m52DeriveMacroRegime(seed, tick);
  const macroRegime: MacroRegime = (input.stateMacroRegime as MacroRegime) ?? derivedRegime;

  const pressureTier: PressureTier = (input.statePressureTier as PressureTier) ?? m52DerivePressureTier(escrowAmount);

  const chaosWindows = buildChaosWindows(seed + ':m52:chaos', CHAOS_WINDOWS_PER_RUN);
  const inChaosWindow = m52IsTickInChaos(tick, chaosWindows);

  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const collateralCard = m52PickCollateralCard(seed, tick, pressureWeight * phaseWeight, regimeWeight);

  const decayRate = computeDecayRate(macroRegime, M52_BOUNDS.BASE_DECAY_RATE);
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  const { milestoneMet, progressScore } = m52AggregateProgress(conditions);

  // Lock horizon: deterministic delay (even if met, release may be suppressed during chaos)
  const extraLock = seededIndex(seed + ':m52:lock', tick, M52_BOUNDS.PULSE_CYCLE + 1); // 0..PULSE_CYCLE
  const lockedUntilTick = clamp(
    tick + (milestoneMet ? 0 : M52_BOUNDS.FIRST_REFUSAL_TICKS) + extraLock,
    tick,
    RUN_TOTAL_TICKS,
  );

  const canRelease = escrowAmount > 0 && milestoneMet && !inChaosWindow;

  // Deterministic release math (bounded, no timestamps)
  const releaseMultiplier = clamp(M52_BOUNDS.MULTIPLIER * regimeMultiplier * exitPulse, 0.01, 10);
  const amountReleased = canRelease ? clamp(escrowAmount * releaseMultiplier, 0, M52_BOUNDS.MAX_PROCEEDS) : 0;

  const status: EscrowStatus = escrowAmount <= 0 ? 'VOID' : canRelease ? 'RELEASED' : 'LOCKED';

  const auditHash = computeHash(
    JSON.stringify({
      runId,
      tick,
      escrowAmount,
      macroRegime,
      runPhase,
      pressureTier,
      inChaosWindow,
      decayRate,
      releaseMultiplier,
      amountReleased,
      collateralCardId: collateralCard.id,
      conditions,
    }),
  );

  const escrowId = computeHash('M52:' + runId + ':' + tick + ':' + auditHash);

  // Telemetry: always emit ESCROW_CREATED (even if VOID) for audit traceability
  emit({
    event: 'ESCROW_CREATED',
    mechanic_id: 'M52',
    tick,
    runId,
    payload: {
      escrowId,
      status,
      escrowAmount,
      macroRegime,
      runPhase,
      pressureTier,
      inChaosWindow,
      lockedUntilTick,
      progressScore,
      milestoneMet,
      collateralCardId: collateralCard.id,
      decayRate,
      auditHash,
    },
  });

  if (milestoneMet) {
    emit({
      event: 'MILESTONE_MET',
      mechanic_id: 'M52',
      tick,
      runId,
      payload: {
        escrowId,
        progressScore,
        conditionCount: conditions.length,
        inChaosWindow,
        auditHash,
      },
    });
  }

  if (canRelease) {
    emit({
      event: 'ESCROW_RELEASED',
      mechanic_id: 'M52',
      tick,
      runId,
      payload: {
        escrowId,
        amountReleased,
        releaseMultiplier,
        auditHash,
      },
    });
  }

  const escrowCreated: EscrowResult = {
    escrowId,
    runId,
    tick,

    amountLocked: escrowAmount,
    amountReleased,

    status,
    lockedUntilTick,

    milestoneMet,
    progressScore,

    runPhase,
    macroRegime,
    pressureTier,

    collateralCard,
    macroSchedule,
    chaosWindows,
    inChaosWindow,

    decayRate,
    auditHash,
  };

  const milestoneResult: Record<string, unknown> = {
    escrowId,
    status,
    runId,
    tick,
    auditHash,

    escrowAmount,
    amountReleased,
    lockedUntilTick,

    milestoneMet,
    progressScore,
    conditionCount: conditions.length,
    conditions,

    macro: {
      macroRegime,
      decayRate,
      regimeMultiplier,
      exitPulse,
      macroEventsPerRun: MACRO_EVENTS_PER_RUN,
      chaosWindowsPerRun: CHAOS_WINDOWS_PER_RUN,
      runTotalTicks: RUN_TOTAL_TICKS,
    },

    weights: {
      pressureTier,
      runPhase,
      pressureWeight,
      phaseWeight,
      regimeWeight,
    },

    collateral: {
      cardId: collateralCard.id,
      allowedCardIds: DEFAULT_CARD_IDS,
      usedDefault: collateralCard.id === DEFAULT_CARD.id,
    },

    timelines: {
      macroSchedule,
      chaosWindows,
      inChaosWindow,
    },
  };

  return {
    escrowCreated,
    milestoneResult,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M52MLInput {
  escrowCreated?: EscrowResult;
  milestoneResult?: Record<string, unknown>;
  runId: string;
  tick: number;
}

export interface M52MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (here: computeHash deterministic)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * milestoneEscrowEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function milestoneEscrowEngineMLCompanion(input: M52MLInput): Promise<M52MLOutput> {
  const escrow = input.escrowCreated;

  const factors: string[] = [];
  if (!escrow) {
    factors.push('No escrow payload present');
  } else {
    factors.push(`Status: ${escrow.status}`);
    factors.push(`Progress: ${Math.round(escrow.progressScore * 100)}%`);
    factors.push(`Regime: ${escrow.macroRegime}`);
    factors.push(escrow.inChaosWindow ? 'Chaos window active' : 'Stable window');
    factors.push(escrow.milestoneMet ? 'Milestone met' : 'Milestone not met');
  }

  const base = escrow ? 0.25 : 0.1;
  const progressBoost = escrow ? clamp(escrow.progressScore * 0.55, 0, 0.55) : 0;
  const chaosPenalty = escrow?.inChaosWindow ? 0.12 : 0.0;
  const releasedBoost = escrow?.status === 'RELEASED' ? 0.12 : 0.0;

  const score = clamp(base + progressBoost + releasedBoost - chaosPenalty, 0.01, 0.99);

  const recommendation =
    !escrow
      ? 'Provide escrowCreated payload for evaluation.'
      : escrow.status === 'RELEASED'
        ? 'Escrow released; record proof artifacts and propagate to season/meta systems.'
        : escrow.inChaosWindow
          ? 'Hold release during chaos; stabilize conditions and retry after window ends.'
          : escrow.milestoneMet
            ? 'Milestone met; proceed to release path once chaos constraints clear.'
            : 'Increase milestone progress; tighten targets or improve current metric inputs.';

  const auditHash = computeHash(
    JSON.stringify({
      runId: input.runId,
      tick: input.tick,
      escrowId: escrow?.escrowId ?? null,
      escrowAuditHash: escrow?.auditHash ?? null,
      score,
      factors,
      recommendation,
    }) + ':ml:M52',
  );

  return {
    score,
    topFactors: factors.slice(0, 5),
    recommendation,
    auditHash,
    confidenceDecay: clamp((escrow?.decayRate ?? 0.05) * 2, 0.01, 0.35),
  };
}