// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m79_shared_objective_bonds_team_wide_incentive_locks.ts
//
// Mechanic : M79 — Shared Objective Bonds: Team-Wide Incentive Locks
// Family   : coop_governance   Layer: api_endpoint   Priority: 2   Batch: 2
// ML Pair  : m79a
// Deps     : M26, M39
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
export const M79_IMPORTED_SYMBOLS = {
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
export type M79_ImportedTypesAnchor = {
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

export type BondObjectiveType = 'PROFIT' | 'CASH' | 'SOLVENCY' | 'RISK' | 'STREAK' | 'CUSTOM';

export interface BondObjective {
  type?: BondObjectiveType;
  target?: number; // objective target value (e.g., profit >= target)
  minTicksLocked?: number; // minimum lock time before it can resolve
  deadlineTick?: number; // optional hard deadline
  description?: string;
}

export interface BondResolution {
  bondActive: boolean;
  objectiveProgress: number; // 0..1
  bondPayout: number | null;

  // context
  tick: number;
  phase: RunPhase;
  regime: MacroRegime;
  pressureTier: PressureTier;
  inChaos: boolean;

  // economics
  bondAmount: number;
  multiplier: number;
  payoutCap: number;

  // deterministic audit
  seed: string;
  auditHash: string;

  // derived signals
  satisfied: boolean;
  expired: boolean;
  effectScore: number;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M79Input {
  bondObjective?: BondObjective;
  participantIds?: string[];
  bondAmount?: number;

  // Optional execution context (safe to omit)
  tick?: number;
  runId?: string;
  pressureTier?: PressureTier;

  // Optional objective measurement snapshot (safe to omit; deterministic proxy will be used)
  // e.g. profit/cash delta, solvency points, risk delta, etc.
  objectiveValue?: number;
}

export interface M79Output {
  bondActive: boolean;
  objectiveProgress: number;
  bondPayout: number | null;
  resolution?: BondResolution;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M79Event = 'BOND_LOCKED' | 'OBJECTIVE_PROGRESS' | 'BOND_RESOLVED';

export interface M79TelemetryPayload extends MechanicTelemetryPayload {
  event: M79Event;
  mechanic_id: 'M79';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M79_BOUNDS = {
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

function m79DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m79DeriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const sorted = [...(schedule ?? [])].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m79InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m79DerivePressureTier(proxyParticipants: number, inChaos: boolean): PressureTier {
  if (inChaos) return proxyParticipants >= 6 ? 'CRITICAL' : 'HIGH';
  if (proxyParticipants <= 2) return 'LOW';
  if (proxyParticipants <= 5) return 'MEDIUM';
  if (proxyParticipants <= 8) return 'HIGH';
  return 'CRITICAL';
}

function m79NormalizeObjective(obj?: BondObjective): Required<Pick<BondObjective, 'type' | 'target' | 'minTicksLocked' | 'deadlineTick' | 'description'>> {
  const type: BondObjectiveType = obj?.type ?? 'CUSTOM';
  const target = Number(obj?.target ?? 1);
  const minTicksLocked = clamp(Math.floor(Number(obj?.minTicksLocked ?? 6)), 0, RUN_TOTAL_TICKS);
  const deadlineTick = clamp(Math.floor(Number(obj?.deadlineTick ?? RUN_TOTAL_TICKS)), 0, RUN_TOTAL_TICKS);
  const description = String(obj?.description ?? '');
  return { type, target, minTicksLocked, deadlineTick, description };
}

function m79BoundBondAmount(raw?: number): number {
  const v = Math.floor(Number(raw ?? 0));
  return clamp(v, 0, M79_BOUNDS.MAX_AMOUNT);
}

function m79DeterministicObjectiveValue(
  seed: string,
  tick: number,
  type: BondObjectiveType,
  participants: string[],
): number {
  // Use weighted pool + opportunity pool as deterministic “game-world” objective proxy.
  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deck:${tick}`);
  const deckTop = deck[0] ?? DEFAULT_CARD.id;

  const baseWeight = participants.length > 0 ? participants.length : 1;
  const pool = buildWeightedPool(`${seed}:objPool:${type}`, baseWeight, baseWeight * 1.3);
  const opp = OPPORTUNITY_POOL[seededIndex(seed, tick + 51, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;
  const pick = pool[seededIndex(computeHash(`${seed}:${deckTop}:${type}`), tick + 9, Math.max(1, pool.length))] ?? opp;

  const money = Number(pick.cost ?? pick.downPayment ?? 1_000);
  const modeNudge = seededIndex(computeHash(`${seed}:${type}:${pick.id ?? pick.name ?? 'x'}`), tick + 77, 100);

  // Shape per objective type (still deterministic)
  if (type === 'PROFIT') return Math.round((money * (0.8 + modeNudge * 0.01)) / 10) * 10;
  if (type === 'CASH') return Math.round((money * (0.6 + modeNudge * 0.008)) / 10) * 10;
  if (type === 'SOLVENCY') return clamp(Math.round(10 + modeNudge * 0.7), 0, 100);
  if (type === 'RISK') return clamp(Math.round(100 - modeNudge), 0, 100);
  if (type === 'STREAK') return clamp(Math.round(1 + (modeNudge % 12)), 0, 60);
  return Math.round((money * (0.5 + modeNudge * 0.006)) / 10) * 10;
}

function m79ComputeProgress(type: BondObjectiveType, value: number, target: number): number {
  // Progress is always [0,1]
  if (target <= 0) return 1;
  if (type === 'RISK') {
    // For risk, “lower is better”: progress = 1 when value <= target
    if (value <= target) return 1;
    const over = value - target;
    return clamp(1 - over / Math.max(1, target), 0, 1);
  }
  return clamp(value / target, 0, 1);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * sharedObjectiveBondManager
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function sharedObjectiveBondManager(input: M79Input, emit: MechanicEmitter): M79Output {
  const participantIds = (Array.isArray(input.participantIds) ? input.participantIds : []).map(String);
  const bondAmount = m79BoundBondAmount(input.bondAmount);
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? computeHash(JSON.stringify(input)));

  const obj = m79NormalizeObjective(input.bondObjective);

  // Deterministic seed (stable for server verification)
  const seed = computeHash(
    JSON.stringify({
      m: 'M79',
      tick,
      runId,
      participants: participantIds,
      obj,
      bondAmount,
    }),
  );

  // Context (bounded chaos)
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m79DerivePhase(tick);
  const regime = m79DeriveRegime(tick, macroSchedule);
  const inChaos = m79InChaosWindow(tick, chaosWindows);

  const proxyParticipants = participantIds.length > 0 ? participantIds.length : clamp(seededIndex(seed, tick + 11, 12) + 1, 1, 12);
  const pressureTier = (input.pressureTier as PressureTier) ?? m79DerivePressureTier(proxyParticipants, inChaos);

  // Economics scaling (uses imports intentionally)
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M79_BOUNDS.BASE_DECAY_RATE);

  // Determine objective value (input may supply real measurement; otherwise deterministic proxy)
  const measuredValue =
    typeof input.objectiveValue === 'number' && Number.isFinite(input.objectiveValue)
      ? Number(input.objectiveValue)
      : m79DeterministicObjectiveValue(seed, tick, obj.type, participantIds);

  const progress = m79ComputeProgress(obj.type, measuredValue, obj.target);

  // Bond lock + progress telemetry
  emit({
    event: 'BOND_LOCKED',
    mechanic_id: 'M79',
    tick,
    runId,
    payload: {
      participants: participantIds,
      bondAmount,
      objectiveType: obj.type,
      target: obj.target,
      minTicksLocked: obj.minTicksLocked,
      deadlineTick: obj.deadlineTick,
    },
  });

  emit({
    event: 'OBJECTIVE_PROGRESS',
    mechanic_id: 'M79',
    tick,
    runId,
    payload: {
      objectiveType: obj.type,
      value: measuredValue,
      target: obj.target,
      progress,
    },
  });

  const satisfied = progress >= 1;
  const expired = tick >= obj.deadlineTick;

  // Lock duration gate
  const lockedLongEnough = tick >= obj.minTicksLocked;

  // Multiplier & payout cap (bounded)
  const multiplierRaw =
    M79_BOUNDS.MULTIPLIER *
    clamp(pressureW * phaseW * regimeW, 0.75, 3.5) *
    clamp(regimeMul * exitPulse, 0.75, 4.0) *
    (inChaos ? (1 - clamp(decayRate, 0, 0.5)) : 1);

  const multiplier = clamp(multiplierRaw, 0.5, 8.0);

  const payoutCap = clamp(Math.round(bondAmount * multiplier), 0, M79_BOUNDS.MAX_PROCEEDS);

  // Resolve logic: payout only if satisfied AND lockedLongEnough AND before deadline (or at deadline)
  const canResolve = lockedLongEnough && (satisfied || expired);

  const bondActive = !canResolve;
  const bondPayout = canResolve && satisfied ? payoutCap : canResolve && expired ? 0 : null;

  // Effect score (telemetry-only)
  const effectRaw =
    (progress * (satisfied ? 1 : 0.65)) *
    (pressureW * phaseW * regimeW) *
    (regimeMul * exitPulse) *
    (inChaos ? (1 - clamp(decayRate, 0, 0.5)) : 1);

  const effectScore = clamp(effectRaw * M79_BOUNDS.MAX_EFFECT * M79_BOUNDS.EFFECT_MULTIPLIER, M79_BOUNDS.MIN_EFFECT, M79_BOUNDS.MAX_EFFECT);

  const auditHash = computeHash(
    JSON.stringify({
      m: 'M79',
      tick,
      runId,
      participants: participantIds,
      bondAmount,
      objectiveType: obj.type,
      target: obj.target,
      minTicksLocked: obj.minTicksLocked,
      deadlineTick: obj.deadlineTick,
      measuredValue,
      progress,
      satisfied,
      expired,
      lockedLongEnough,
      multiplier,
      payoutCap,
      bondActive,
      bondPayout,
      phase,
      regime,
      pressureTier,
      inChaos,
      effectScore: Math.round(effectScore),
      seed,
    }),
  );

  const resolution: BondResolution = {
    bondActive,
    objectiveProgress: progress,
    bondPayout,

    tick,
    phase,
    regime,
    pressureTier,
    inChaos,

    bondAmount,
    multiplier,
    payoutCap,

    seed,
    auditHash,

    satisfied,
    expired,
    effectScore: Math.round(effectScore),
  };

  emit({
    event: 'BOND_RESOLVED',
    mechanic_id: 'M79',
    tick,
    runId,
    payload: {
      bondActive,
      progress,
      satisfied,
      expired,
      payout: bondPayout,
      multiplier,
      payoutCap,
      auditHash,
      effectScore: Math.round(effectScore),
      // keep shared pools observable (debug only)
      defaultCardId: DEFAULT_CARD.id,
      deckTop: seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckTop`)[0] ?? DEFAULT_CARD.id,
    },
  });

  return {
    bondActive,
    objectiveProgress: progress,
    bondPayout,
    resolution,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M79MLInput {
  bondActive?: boolean;
  objectiveProgress?: number;
  bondPayout?: number | null;
  runId: string;
  tick: number;
}

export interface M79MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * sharedObjectiveBondManagerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function sharedObjectiveBondManagerMLCompanion(input: M79MLInput): Promise<M79MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const active = Boolean(input.bondActive ?? false);
  const progress = clamp(Number(input.objectiveProgress ?? 0), 0, 1);
  const payout = input.bondPayout ?? null;

  // Neutral decay baseline (regime unknown here)
  const confidenceDecay = computeDecayRate('NEUTRAL' as MacroRegime, M79_BOUNDS.BASE_DECAY_RATE);

  // Score: progress is primary, payout is strong positive, active without progress is mild negative.
  const payoutBoost = typeof payout === 'number' ? clamp(payout / Math.max(1, M79_BOUNDS.MAX_PROCEEDS), 0, 1) * 0.25 : 0;
  const activePenalty = active && progress < 0.25 ? 0.1 : 0.0;

  const score = clamp(0.4 + progress * 0.45 + payoutBoost - activePenalty, 0.01, 0.99);

  // Deterministic hint using DEFAULT_CARD_IDS (keeps import live)
  const hintPick = seededIndex(computeHash(`M79ML:${tick}:${input.runId}:${active}:${progress}:${String(payout)}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintPick] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `active=${active ? 'yes' : 'no'}`,
    `progress=${progress.toFixed(2)}`,
    `payout=${payout === null ? 'n/a' : String(payout)}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation =
    payout !== null
      ? payout > 0
        ? 'Bond resolved with payout: distribute rewards and roll the next objective bond.'
        : 'Bond resolved with no payout: run a postmortem and adjust targets or lock duration.'
      : active
        ? 'Bond active: focus team actions on the objective and track progress each tick.'
        : 'Bond inactive: consider locking a new shared objective to align incentives.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M79'),
    confidenceDecay,
  };
}