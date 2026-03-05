// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m108_partial_fills_you_dont_get_the_whole_deal.ts
//
// Mechanic : M108 — Partial Fills: You Dont Get the Whole Deal
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m108a
// Deps     : M09, M104
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

// ── Type Touch Anchor (ensures every imported type is referenced in-code) ───

export type M108TypeTouch = {
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

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M108Input {
  dealRequest?: unknown;
  availableCapacity?: unknown;
  fillRules?: unknown[];

  // Optional snapshot extras (safe to read via `(input as any)`)
  tick?: number;
  runId?: string;
  seed?: string;
  macroRegime?: MacroRegime;
  runPhase?: RunPhase;
  pressureTier?: PressureTier;
  cash?: number;
  netWorth?: number;
}

export interface M108Output {
  fillAmount: number;
  partialFillResult: PartialFillResult;
  remainingCapacity: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M108Event = 'PARTIAL_FILL_EXECUTED' | 'FILL_PROBABILITY_APPLIED' | 'PARTIAL_FILL_MISSED';

export interface M108TelemetryPayload extends MechanicTelemetryPayload {
  event: M108Event;
  mechanic_id: 'M108';
}

// ── Local Types (PartialFillResult not guaranteed in ./types) ──────────────

export type FillOutcome = 'FULL' | 'PARTIAL' | 'MISSED' | 'REJECTED';

export interface PartialFillRule {
  id: string;
  minFillRatio: number; // 0..1
  maxFillRatio: number; // 0..1
  probabilityMultiplier: number; // 0.1..3
  capacityMultiplier: number; // 0.1..3
  applyWhen?: {
    macroRegime?: MacroRegime;
    runPhase?: RunPhase;
    pressureTier?: PressureTier;
  };
}

export interface PartialFillResult {
  runId: string;
  tick: number;
  seed: string;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;
  solvencyStatus: SolvencyStatus;

  requestedAmount: number;
  availableCapacity: number;

  probability: number; // 0..1
  fillRatio: number; // 0..1
  filledAmount: number;
  remainingCapacity: number;

  outcome: FillOutcome;
  appliedRuleId: string | null;

  offerCardId: string;
  exitPulseMultiplier: number;
  confidenceDecay: number;

  reasonCode: string;
  auditHash: string;
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M108_BOUNDS = {
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

// ── Internal helpers ──────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function toSafeString(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function toSafeNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function coerceRunPhase(v: unknown, tick: number): RunPhase {
  const s = typeof v === 'string' ? v : '';
  if (s === 'EARLY' || s === 'MID' || s === 'LATE') return s;
  const pct = RUN_TOTAL_TICKS > 0 ? clamp(tick / RUN_TOTAL_TICKS, 0, 0.9999) : 0;
  if (pct < 0.3333) return 'EARLY';
  if (pct < 0.6666) return 'MID';
  return 'LATE';
}

function coercePressureTier(v: unknown): PressureTier {
  const s = typeof v === 'string' ? v : '';
  if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH' || s === 'CRITICAL') return s;
  return 'MEDIUM';
}

function coerceMacroRegime(v: unknown): MacroRegime {
  const s = typeof v === 'string' ? v : '';
  if (s === 'BULL' || s === 'NEUTRAL' || s === 'BEAR' || s === 'CRISIS') return s;
  return 'NEUTRAL';
}

function coerceTickTier(pressureTier: PressureTier, chaos: boolean, scarcityLike: number): TickTier {
  if (pressureTier === 'CRITICAL' || chaos || scarcityLike >= 0.85) return 'CRITICAL';
  if (pressureTier === 'HIGH' || scarcityLike >= 0.55) return 'ELEVATED';
  return 'STANDARD';
}

function coerceSolvencyStatus(cash: number, netWorth: number): SolvencyStatus {
  if (cash <= 0 && netWorth <= 0) return 'WIPED';
  if (cash <= M108_BOUNDS.BLEED_CASH_THRESHOLD) return 'BLEED';
  return 'SOLVENT';
}

function resolveMacroRegimeBySchedule(seed: string, tick: number, base: MacroRegime): MacroRegime {
  const schedule = buildMacroSchedule(seed + ':M108:macro', MACRO_EVENTS_PER_RUN)
    .slice()
    .sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));

  let regime = base;
  for (const e of schedule) {
    const t = typeof e.tick === 'number' ? e.tick : 0;
    if (t <= tick && e.regimeChange) regime = e.regimeChange;
  }
  return regime;
}

function isChaosActive(seed: string, tick: number): boolean {
  const windows = buildChaosWindows(seed + ':M108:chaos', CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    const s = typeof w.startTick === 'number' ? w.startTick : 0;
    const e = typeof w.endTick === 'number' ? w.endTick : 0;
    if (tick >= s && tick <= e) return true;
  }
  return false;
}

function normalizeCardId(id: string): string {
  return DEFAULT_CARD_IDS.includes(id) ? id : DEFAULT_CARD.id;
}

function pickOfferCardId(seed: string, tick: number, weightA: number, weightB: number): string {
  const pool = buildWeightedPool(seed + ':M108:pool', weightA, weightB);
  const basis = pool.length > 0 ? pool : OPPORTUNITY_POOL;
  const shuffled = seededShuffle(basis, seed + ':M108:poolShuffle:' + tick);
  const idx = seededIndex(seed + ':M108:poolPick', tick, shuffled.length);
  const picked = shuffled[idx] ?? DEFAULT_CARD;
  return normalizeCardId(picked.id);
}

function parseRequestedAmount(dealRequest: unknown): number {
  if (typeof dealRequest === 'number') return dealRequest;
  if (typeof dealRequest === 'string') return Number.isFinite(Number(dealRequest)) ? Number(dealRequest) : 0;
  if (isRecord(dealRequest)) {
    const amount =
      toSafeNumber(dealRequest.amount, NaN) ??
      toSafeNumber(dealRequest.requestedAmount, NaN) ??
      toSafeNumber(dealRequest.size, NaN);
    return Number.isFinite(amount) ? amount : 0;
  }
  return 0;
}

function parseCapacity(availableCapacity: unknown): number {
  if (typeof availableCapacity === 'number') return availableCapacity;
  if (typeof availableCapacity === 'string') return Number.isFinite(Number(availableCapacity)) ? Number(availableCapacity) : 0;
  if (isRecord(availableCapacity)) {
    const c = toSafeNumber(availableCapacity.capacity, NaN) ?? toSafeNumber(availableCapacity.available, NaN);
    return Number.isFinite(c) ? c : 0;
  }
  return 0;
}

function parseRules(rawRules: unknown[] | undefined): PartialFillRule[] {
  const rules = Array.isArray(rawRules) ? rawRules : [];
  const out: PartialFillRule[] = [];

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (!isRecord(r)) continue;

    const id = toSafeString(r.id, `rule_${i}`);
    const minFillRatio = clamp(toSafeNumber(r.minFillRatio, toSafeNumber(r.min, 0.15)), 0, 1);
    const maxFillRatio = clamp(toSafeNumber(r.maxFillRatio, toSafeNumber(r.max, 0.85)), 0, 1);
    const probabilityMultiplier = clamp(toSafeNumber(r.probabilityMultiplier, toSafeNumber(r.pMult, 1.0)), 0.1, 3.0);
    const capacityMultiplier = clamp(toSafeNumber(r.capacityMultiplier, toSafeNumber(r.cMult, 1.0)), 0.1, 3.0);

    const applyWhen: PartialFillRule['applyWhen'] = {};
    if (typeof r.macroRegime === 'string') applyWhen.macroRegime = coerceMacroRegime(r.macroRegime);
    if (typeof r.runPhase === 'string') applyWhen.runPhase = coerceRunPhase(r.runPhase, 0);
    if (typeof r.pressureTier === 'string') applyWhen.pressureTier = coercePressureTier(r.pressureTier);

    out.push({
      id,
      minFillRatio: Math.min(minFillRatio, maxFillRatio),
      maxFillRatio: Math.max(minFillRatio, maxFillRatio),
      probabilityMultiplier,
      capacityMultiplier,
      applyWhen: Object.keys(applyWhen).length ? applyWhen : undefined,
    });
  }

  // Deterministic ordering: highest multiplier first (stable sort by id).
  out.sort((a, b) => {
    const d = (b.probabilityMultiplier * b.capacityMultiplier) - (a.probabilityMultiplier * a.capacityMultiplier);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });

  return out;
}

function ruleApplies(rule: PartialFillRule, ctx: { macroRegime: MacroRegime; runPhase: RunPhase; pressureTier: PressureTier }): boolean {
  const w = rule.applyWhen;
  if (!w) return true;
  if (w.macroRegime && w.macroRegime !== ctx.macroRegime) return false;
  if (w.runPhase && w.runPhase !== ctx.runPhase) return false;
  if (w.pressureTier && w.pressureTier !== ctx.pressureTier) return false;
  return true;
}

function emitM108(
  emit: MechanicEmitter,
  tick: number,
  runId: string,
  event: M108Event,
  payload: Record<string, unknown>,
): void {
  const msg: M108TelemetryPayload = {
    event,
    mechanic_id: 'M108',
    tick,
    runId,
    payload,
  };
  emit(msg);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * partialFillResolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function partialFillResolver(input: M108Input, emit: MechanicEmitter): M108Output {
  const tick = clamp(toSafeNumber((input as any).tick, 0), 0, RUN_TOTAL_TICKS);
  const runId = toSafeString((input as any).runId, '');

  const seed =
    toSafeString((input as any).seed, '') ||
    toSafeString((input as any).seedSalt, '') ||
    toSafeString((input as any).seed_salt, '') ||
    `seed:M108:${runId || 'run'}:${tick}`;

  const requestedRaw = parseRequestedAmount(input.dealRequest);
  const requestedAmount = clamp(requestedRaw, 0, M108_BOUNDS.MAX_PROCEEDS);

  const capacityRaw = parseCapacity(input.availableCapacity);
  const availableCapacity = clamp(capacityRaw, 0, M108_BOUNDS.MAX_PROCEEDS);

  const baseRegime = coerceMacroRegime((input as any).macroRegime);
  const macroRegime = resolveMacroRegimeBySchedule(seed, tick, baseRegime);
  const runPhase = coerceRunPhase((input as any).runPhase, tick);
  const pressureTier = coercePressureTier((input as any).pressureTier);

  const chaosActive = isChaosActive(seed, tick);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  // Scarcity-like proxy (M104 dependency) without direct state: lower capacity vs request => higher scarcityLike
  const scarcityLike =
    requestedAmount <= 0 ? 0 : clamp(1 - (availableCapacity / Math.max(1, requestedAmount)), 0, 1);

  const tickTier = coerceTickTier(pressureTier, chaosActive, scarcityLike);

  const cash = toSafeNumber((input as any).cash, 0);
  const netWorth = toSafeNumber((input as any).netWorth, 0);
  const solvencyStatus = coerceSolvencyStatus(cash, netWorth);

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const confidenceDecay = computeDecayRate(macroRegime, M108_BOUNDS.BASE_DECAY_RATE);

  // Offer card id gives deterministic “slot” identity (telemetry / UI / proof)
  const offerCardId = pickOfferCardId(seed, tick, pressureW * phaseW, regimeW);

  // Rules (optional): applied at most one (first that applies after ordering)
  const rules = parseRules((input.fillRules as unknown[]) ?? []);
  const ctx = { macroRegime, runPhase, pressureTier };
  const applied = rules.find(r => ruleApplies(r, ctx)) ?? null;

  const probabilityMultiplier = applied ? applied.probabilityMultiplier : 1.0;
  const capacityMultiplier = applied ? applied.capacityMultiplier : 1.0;

  // Base probability is worse under chaos, high scarcity, and harsh regimes.
  // Better under BULL/NEUTRAL relative regimes (via regimeMult).
  const baseProbability =
    0.72 *
    clamp(regimeMult, 0.65, 1.25) *
    clamp(1 - scarcityLike * 0.55, 0.15, 1.0) *
    clamp(1 - (pressureW - 1) * 0.25, 0.35, 1.0) *
    (chaosActive ? 0.82 : 1.0) *
    clamp(1 / Math.max(0.75, exitPulseMultiplier), 0.60, 1.15);

  const probability = clamp(baseProbability * probabilityMultiplier, 0.05, 0.95);

  emitM108(emit, tick, runId, 'FILL_PROBABILITY_APPLIED', {
    requestedAmount,
    availableCapacity,
    scarcityLike,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    solvencyStatus,
    chaosActive,
    regimeMult,
    weights: { pressureW, phaseW, regimeW },
    appliedRuleId: applied?.id ?? null,
    probability,
    exitPulseMultiplier,
    confidenceDecay,
    offerCardId,
    audit: computeHash(`${seed}:${runId}:${tick}:M108:PROB:${probability.toFixed(6)}:${offerCardId}`),
  });

  // No capacity or no request => reject deterministically
  if (requestedAmount <= 0 || availableCapacity <= 0) {
    const remainingCapacity = availableCapacity;

    const auditHash = computeHash(
      JSON.stringify({
        runId,
        tick,
        seed,
        requestedAmount,
        availableCapacity,
        macroRegime,
        runPhase,
        pressureTier,
        tickTier,
        chaosActive,
        appliedRuleId: applied?.id ?? null,
        probability,
        reasonCode: requestedAmount <= 0 ? 'REJECT_NO_REQUEST' : 'REJECT_NO_CAPACITY',
        offerCardId,
      }),
    );

    const partialFillResult: PartialFillResult = {
      runId,
      tick,
      seed,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      solvencyStatus,
      requestedAmount,
      availableCapacity,
      probability,
      fillRatio: 0,
      filledAmount: 0,
      remainingCapacity,
      outcome: 'REJECTED',
      appliedRuleId: applied?.id ?? null,
      offerCardId,
      exitPulseMultiplier,
      confidenceDecay,
      reasonCode: requestedAmount <= 0 ? 'REJECT_NO_REQUEST' : 'REJECT_NO_CAPACITY',
      auditHash,
    };

    emitM108(emit, tick, runId, 'PARTIAL_FILL_MISSED', {
      requestedAmount,
      availableCapacity,
      outcome: partialFillResult.outcome,
      reasonCode: partialFillResult.reasonCode,
      offerCardId,
      auditHash,
    });

    return {
      fillAmount: 0,
      partialFillResult,
      remainingCapacity,
    };
  }

  // Deterministic roll
  const roll = seededIndex(seed + ':M108:roll', tick, 10_000) / 10_000;
  const hit = roll < probability;

  // Fill ratio: anchored by capacity ratio and bounded by rule / regime / weights.
  const capacityRatio = clamp(availableCapacity / Math.max(1, requestedAmount), 0, 1);

  const minFill = applied ? applied.minFillRatio : 0.12;
  const maxFill = applied ? applied.maxFillRatio : 0.92;

  // Choose a deterministic “slice” ratio from weighted pool.
  // Pool gives stable variety; index chooses a ratio band.
  const ratioPool = seededShuffle(
    [
      0.10, 0.15, 0.20, 0.25, 0.33, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00,
    ],
    seed + ':M108:ratioPool',
  );

  const poolIdx = seededIndex(seed + ':M108:ratioPick', tick, ratioPool.length);
  const poolRatio = ratioPool[poolIdx] ?? 0.33;

  const weightedBias =
    clamp(0.55 + (regimeW - 1) * 0.20 - scarcityLike * 0.25 + (phaseW - 1) * 0.10, 0.20, 0.85) *
    (chaosActive ? 0.92 : 1.0) *
    clamp(1 - (pressureW - 1) * 0.15, 0.65, 1.0);

  // Capacity sets the ceiling; poolRatio + weights chooses the fraction of request.
  const desiredRatio = clamp(poolRatio * weightedBias, 0, 1);
  const fillRatio = hit ? clamp(Math.min(desiredRatio, capacityRatio) * capacityMultiplier, minFill, Math.min(maxFill, capacityRatio)) : 0;

  const rawFillAmount = requestedAmount * fillRatio;
  const fillAmount = hit
    ? clamp(rawFillAmount * M108_BOUNDS.EFFECT_MULTIPLIER, M108_BOUNDS.MIN_EFFECT, M108_BOUNDS.MAX_EFFECT)
    : 0;

  const remainingCapacity = clamp(availableCapacity - fillAmount, 0, M108_BOUNDS.MAX_PROCEEDS);

  const outcome: FillOutcome =
    !hit ? 'MISSED' : fillAmount >= requestedAmount * 0.999 ? 'FULL' : 'PARTIAL';

  const reasonCode =
    !hit
      ? 'MISS_PROBABILITY'
      : outcome === 'FULL'
        ? 'FILL_FULL'
        : capacityRatio < 1
          ? 'FILL_CAPACITY_BOUND'
          : 'FILL_MARKET_THIN';

  const auditHash = computeHash(
    JSON.stringify({
      runId,
      tick,
      seed,
      requestedAmount,
      availableCapacity,
      capacityRatio,
      scarcityLike,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      solvencyStatus,
      chaosActive,
      exitPulseMultiplier,
      confidenceDecay,
      weights: { pressureW, phaseW, regimeW, regimeMult },
      appliedRuleId: applied?.id ?? null,
      multipliers: { probabilityMultiplier, capacityMultiplier },
      probability,
      roll,
      hit,
      poolRatio,
      weightedBias,
      minFill,
      maxFill,
      fillRatio,
      fillAmount,
      remainingCapacity,
      outcome,
      reasonCode,
      offerCardId,
    }),
  );

  const partialFillResult: PartialFillResult = {
    runId,
    tick,
    seed,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    solvencyStatus,
    requestedAmount,
    availableCapacity,
    probability,
    fillRatio,
    filledAmount: fillAmount,
    remainingCapacity,
    outcome,
    appliedRuleId: applied?.id ?? null,
    offerCardId,
    exitPulseMultiplier,
    confidenceDecay,
    reasonCode,
    auditHash,
  };

  if (!hit) {
    emitM108(emit, tick, runId, 'PARTIAL_FILL_MISSED', {
      requestedAmount,
      availableCapacity,
      probability,
      roll,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      appliedRuleId: applied?.id ?? null,
      offerCardId,
      reasonCode,
      auditHash,
    });
  } else {
    emitM108(emit, tick, runId, 'PARTIAL_FILL_EXECUTED', {
      requestedAmount,
      availableCapacity,
      fillAmount,
      fillRatio,
      remainingCapacity,
      outcome,
      probability,
      roll,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      appliedRuleId: applied?.id ?? null,
      offerCardId,
      reasonCode,
      auditHash,
    });
  }

  return {
    fillAmount,
    partialFillResult,
    remainingCapacity,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M108MLInput {
  fillAmount?: number;
  partialFillResult?: PartialFillResult;
  remainingCapacity?: number;
  runId: string;
  tick: number;
}

export interface M108MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * partialFillResolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function partialFillResolverMLCompanion(input: M108MLInput): Promise<M108MLOutput> {
  const r = input.partialFillResult;

  const filled = clamp(toSafeNumber(input.fillAmount, toSafeNumber(r?.filledAmount, 0)), 0, M108_BOUNDS.MAX_EFFECT);
  const requested = clamp(toSafeNumber(r?.requestedAmount, 0), 0, M108_BOUNDS.MAX_PROCEEDS);
  const prob = clamp(toSafeNumber(r?.probability, 0.5), 0.01, 0.99);

  const fillRatio = requested > 0 ? clamp(filled / requested, 0, 1) : 0;
  const missed = r?.outcome === 'MISSED' || r?.outcome === 'REJECTED';

  const macroRegime: MacroRegime = (r?.macroRegime ?? 'NEUTRAL') as MacroRegime;
  const confidenceDecay = computeDecayRate(macroRegime, 0.05);

  // Higher score = more “market thin / execution risk”
  const scoreRaw =
    (missed ? 0.65 : 0.25) +
    (1 - fillRatio) * 0.35 +
    (1 - prob) * 0.25;

  const score = clamp(scoreRaw, 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(missed ? 'Partial fill missed/rejected' : 'Partial fill executed');
  topFactors.push(`Fill ratio: ${(fillRatio * 100).toFixed(0)}%`);
  topFactors.push(`Probability: ${(prob * 100).toFixed(0)}%`);
  if (typeof r?.pressureTier === 'string') topFactors.push(`Pressure: ${r.pressureTier}`);
  if (typeof r?.macroRegime === 'string') topFactors.push(`Regime: ${r.macroRegime}`);
  while (topFactors.length > 5) topFactors.pop();

  const recommendation =
    missed
      ? 'Reduce request size or wait for a cleaner window; execution is thin right now.'
      : fillRatio < 0.7
        ? 'Treat as market thin: rebalance plan and avoid overcommitting to a single fill.'
        : 'Execution acceptable; continue but monitor capacity and regime shifts.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M108:' + (r?.auditHash ?? '')),
    confidenceDecay,
  };
}