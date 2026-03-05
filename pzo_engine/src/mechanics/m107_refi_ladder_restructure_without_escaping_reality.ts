// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m107_refi_ladder_restructure_without_escaping_reality.ts
//
// Mechanic : M107 — Refi Ladder: Restructure Without Escaping Reality
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m107a
// Deps     : M60, M32
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

export type M107TypeTouch = {
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

// ── Local Contract Model (types.ts does not define ContractTerms) ───────────

export type ContractKind = 'AMORTIZED' | 'INTEREST_ONLY';

export interface ContractTerms {
  liabilityId: string;

  principal: number; // remaining balance
  apr: number; // 0..1
  months: number; // remaining term
  kind: ContractKind;

  monthlyPayment: number; // computed
  closingFees: number; // rolled into principal when approved
  lenderLabel: string; // deterministic cosmetic label (no power)
  offerCardId: string; // deterministic anchor (id from DEFAULT_CARD_IDS)

  approved: boolean;
  reasonCode: string; // deterministic code for telemetry/audit

  auditHash: string; // hash of deterministic inputs+terms
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M107Input {
  liabilityId?: string;
  refiTerms?: number;
  stateCashflow?: number;
}

export interface M107Output {
  refiExecuted: boolean;
  newTerms: ContractTerms;
  cashflowAdjusted: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M107Event = 'REFI_INITIATED' | 'REFI_APPROVED' | 'REFI_DENIED' | 'TERMS_UPDATED';

export interface M107TelemetryPayload extends MechanicTelemetryPayload {
  event: M107Event;
  mechanic_id: 'M107';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M107_BOUNDS = {
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

function toSafeString(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function toSafeNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function resolveRunPhase(tick: number, hint: unknown): RunPhase {
  const s = typeof hint === 'string' ? hint : '';
  if (s === 'EARLY' || s === 'MID' || s === 'LATE') return s;
  const pct = RUN_TOTAL_TICKS > 0 ? clamp(tick / RUN_TOTAL_TICKS, 0, 0.9999) : 0;
  if (pct < 0.3333) return 'EARLY';
  if (pct < 0.6666) return 'MID';
  return 'LATE';
}

function resolvePressureTier(hint: unknown): PressureTier {
  const s = typeof hint === 'string' ? hint : '';
  if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH' || s === 'CRITICAL') return s;
  return 'MEDIUM';
}

function resolveTickTier(pressureTier: PressureTier, chaos: boolean, urgency: number): TickTier {
  if (pressureTier === 'CRITICAL' || chaos || urgency >= 1.25) return 'CRITICAL';
  if (pressureTier === 'HIGH' || urgency >= 0.90) return 'ELEVATED';
  return 'STANDARD';
}

function resolveSolvencyStatus(cashflow: number, cash: number, netWorth: number): SolvencyStatus {
  if (cash <= 0 && netWorth <= 0) return 'WIPED';
  if (cashflow <= 0 || cash <= M107_BOUNDS.BLEED_CASH_THRESHOLD) return 'BLEED';
  return 'SOLVENT';
}

function resolveMacroRegime(seed: string, tick: number, hint: unknown): MacroRegime {
  const base = ((): MacroRegime => {
    const s = typeof hint === 'string' ? hint : '';
    if (s === 'BULL' || s === 'NEUTRAL' || s === 'BEAR' || s === 'CRISIS') return s;
    return 'NEUTRAL';
  })();

  const schedule = buildMacroSchedule(seed + ':M107:macro', MACRO_EVENTS_PER_RUN)
    .slice()
    .sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));

  let regime: MacroRegime = base;
  for (const e of schedule) {
    const t = typeof e.tick === 'number' ? e.tick : 0;
    if (t <= tick && e.regimeChange) regime = e.regimeChange;
  }
  return regime;
}

function isChaosActive(seed: string, tick: number): boolean {
  const windows = buildChaosWindows(seed + ':M107:chaos', CHAOS_WINDOWS_PER_RUN);
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

function amortizedPayment(principal: number, apr: number, months: number): number {
  const P = Math.max(0, principal);
  const n = Math.max(1, Math.floor(months));
  const r = Math.max(0, apr) / 12;
  if (r <= 0) return P / n;
  const denom = 1 - Math.pow(1 + r, -n);
  if (denom <= 0) return P / n;
  return (P * r) / denom;
}

function pickOfferCardId(seed: string, tick: number, pressurePhaseWeight: number, regimeWeight: number): string {
  const pool = buildWeightedPool(seed + ':M107:pool', pressurePhaseWeight, regimeWeight);
  const basis = pool.length > 0 ? pool : OPPORTUNITY_POOL;

  const shuffled = seededShuffle(basis, seed + ':M107:poolShuffle:' + tick);
  const idx = seededIndex(seed + ':M107:poolPick', tick, shuffled.length);
  const picked = shuffled[idx] ?? DEFAULT_CARD;

  return normalizeCardId(picked.id);
}

function pickLenderLabel(seed: string, tick: number): string {
  const lenders = seededShuffle(
    [
      'LedgerBank',
      'Covenant Credit Union',
      'Anchor Finance',
      'Horizon Servicing',
      'Granite Capital',
      'Praxis Lending',
      'Ironclad Notes',
      'Orchid Funding',
    ],
    seed + ':M107:lenders',
  );
  return lenders[seededIndex(seed + ':M107:lenderPick', tick, lenders.length)] ?? 'LedgerBank';
}

function emitM107(
  emit: MechanicEmitter,
  tick: number,
  runId: string,
  event: M107Event,
  payload: Record<string, unknown>,
): void {
  const msg: M107TelemetryPayload = {
    event,
    mechanic_id: 'M107',
    tick,
    runId,
    payload,
  };
  emit(msg);
}

function resolveCurrentTerms(liabilityId: string, seed: string, tick: number, raw: unknown, offerCardId: string): ContractTerms {
  const dfltPrincipal = 18_000 + seededIndex(seed + ':M107:principal', tick, 12_000); // 18k..30k deterministic
  const dfltApr = 0.16; // baseline (not “market accurate”; deterministic gameplay model)
  const dfltMonths = 36 + seededIndex(seed + ':M107:months', tick, 25); // 36..60
  const dfltKind: ContractKind = 'AMORTIZED';

  if (!isRecord(raw)) {
    const pmt = amortizedPayment(dfltPrincipal, dfltApr, dfltMonths);
    const auditHash = computeHash(
      JSON.stringify({ liabilityId, principal: dfltPrincipal, apr: dfltApr, months: dfltMonths, kind: dfltKind, offerCardId }),
    );
    return {
      liabilityId,
      principal: dfltPrincipal,
      apr: dfltApr,
      months: dfltMonths,
      kind: dfltKind,
      monthlyPayment: pmt,
      closingFees: 0,
      lenderLabel: pickLenderLabel(seed, tick),
      offerCardId,
      approved: true,
      reasonCode: 'CURRENT_TERMS_DEFAULT',
      auditHash,
    };
  }

  const principal = clamp(toSafeNumber(raw.principal, dfltPrincipal), 0, M107_BOUNDS.MAX_PROCEEDS);
  const apr = clamp(toSafeNumber(raw.apr, dfltApr), 0.01, 0.45);
  const months = clamp(Math.floor(toSafeNumber(raw.months, dfltMonths)), 6, 180);
  const kind = (raw.kind === 'INTEREST_ONLY' ? 'INTEREST_ONLY' : 'AMORTIZED') as ContractKind;

  const monthlyPayment =
    kind === 'INTEREST_ONLY' ? (principal * (apr / 12)) : amortizedPayment(principal, apr, months);

  const auditHash = computeHash(JSON.stringify({ liabilityId, principal, apr, months, kind, offerCardId }));

  return {
    liabilityId,
    principal,
    apr,
    months,
    kind,
    monthlyPayment,
    closingFees: 0,
    lenderLabel: pickLenderLabel(seed, tick),
    offerCardId,
    approved: true,
    reasonCode: 'CURRENT_TERMS_IMPORTED',
    auditHash,
  };
}

function computeRefiDecision(args: {
  seed: string;
  tick: number;
  runId: string;

  liabilityId: string;
  ladderSteps: number; // player intent
  stateCashflow: number;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  solvencyStatus: SolvencyStatus;
  tickTier: TickTier;

  chaosActive: boolean;
  exitPulseMultiplier: number;

  currentTerms: ContractTerms;
  offerCardId: string;
}): { approved: boolean; newTerms: ContractTerms; cashflowAdjusted: number; reasonCode: string; auditHash: string } {
  const {
    seed,
    tick,
    runId,
    liabilityId,
    ladderSteps,
    stateCashflow,
    macroRegime,
    runPhase,
    pressureTier,
    solvencyStatus,
    tickTier,
    chaosActive,
    exitPulseMultiplier,
    currentTerms,
    offerCardId,
  } = args;

  // Weights (must use all provided tables)
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  // “Reality” constraint: ladder steps are bounded and do NOT erase the burden.
  // Positive steps => extend term (lower payment, higher total cost).
  // Negative steps => shorten term (higher payment, lower total cost).
  const steps = clamp(Math.floor(ladderSteps), -6, 12);
  const stepMonths = 6;
  const requestedMonths = clamp(currentTerms.months + steps * stepMonths, 6, 180);

  // APR shifts with macro conditions; chaos and severity penalize.
  // Refi can *slightly* improve APR in good regimes; otherwise worsens.
  const aprMacroPenalty = clamp((1 - regimeMult) * 0.10, 0, 0.08);
  const aprChaosPenalty = chaosActive ? 0.015 : 0;
  const aprPressurePenalty = clamp((pressureW - 1) * 0.02, 0, 0.02);
  const aprRelief = steps > 0 && macroRegime !== 'CRISIS' ? Math.min(0.012, steps * 0.0015) : 0;

  const apr = clamp(currentTerms.apr + aprMacroPenalty + aprChaosPenalty + aprPressurePenalty - aprRelief, 0.01, 0.45);

  // Closing fees: deterministic and bounded; worse regimes cost more.
  const baseFees = clamp(currentTerms.principal * 0.01, 0, 2_000);
  const feeMultiplier = clamp((2 - regimeMult) * (chaosActive ? 1.35 : 1.0) * (tickTier === 'CRITICAL' ? 1.15 : 1.0), 0.8, 2.25);
  const closingFees = clamp(baseFees * feeMultiplier, 0, M107_BOUNDS.MAX_AMOUNT);

  const principal = clamp(currentTerms.principal + closingFees, 0, M107_BOUNDS.MAX_PROCEEDS);

  const kind: ContractKind = steps >= 9 && (solvencyStatus === 'BLEED' || macroRegime === 'CRISIS') ? 'INTEREST_ONLY' : 'AMORTIZED';
  const monthlyPayment =
    kind === 'INTEREST_ONLY' ? (principal * (apr / 12)) : amortizedPayment(principal, apr, requestedMonths);

  // Payment relief / burden
  const currentPmt = Math.max(1, currentTerms.monthlyPayment);
  const newPmt = Math.max(1, monthlyPayment);
  const reliefRatio = clamp((currentPmt - newPmt) / currentPmt, -1, 1);

  // Coverage (cashflow vs payment)
  const coverage = clamp(stateCashflow / newPmt, -2, 3);

  // Urgency via exit pulse (forces decisions to be macro-sensitive)
  const urgency = clamp((tick / RUN_TOTAL_TICKS) * exitPulseMultiplier * (pressureW * phaseW), 0, 2);

  // Approval model (deterministic by seed): relief helps, but chaos/regime/bleed state hurt.
  const solvencyPenalty = solvencyStatus === 'WIPED' ? 0.80 : solvencyStatus === 'BLEED' ? 0.22 : 0.0;
  const chaosPenalty = chaosActive ? 0.15 : 0.0;
  const regimePenalty = clamp((1 - regimeMult) * 0.45, 0, 0.35);

  const reliefBoost = reliefRatio > 0 ? reliefRatio * 0.40 : reliefRatio * 0.15;
  const coverageBoost = clamp(coverage, -1, 1) * 0.25;

  const approvalScoreRaw =
    0.55 +
    reliefBoost +
    coverageBoost -
    solvencyPenalty -
    chaosPenalty -
    regimePenalty +
    clamp((1.0 - urgency) * 0.05, -0.05, 0.05); // higher urgency slightly worsens underwriting

  const approvalScore = clamp(approvalScoreRaw, 0.05, 0.95);

  const roll = seededIndex(seed + ':M107:approve', tick, 10_000) / 10_000;

  const approved = roll < approvalScore;

  const cashflowDelta = clamp(currentPmt - newPmt, M107_BOUNDS.MIN_CASHFLOW_DELTA, M107_BOUNDS.MAX_CASHFLOW_DELTA);
  const cashflowAdjusted = approved ? (stateCashflow + cashflowDelta) : stateCashflow;

  const boundedEffect = clamp(
    Math.abs(cashflowDelta) * M107_BOUNDS.PULSE_CYCLE * M107_BOUNDS.EFFECT_MULTIPLIER,
    M107_BOUNDS.MIN_EFFECT,
    M107_BOUNDS.MAX_EFFECT,
  );

  const reasonCode =
    solvencyStatus === 'WIPED'
      ? 'DENY_WIPED'
      : !approved
        ? (macroRegime === 'CRISIS' && chaosActive ? 'DENY_CRISIS_CHAOS' : macroRegime === 'CRISIS' ? 'DENY_CRISIS' : 'DENY_UNDERWRITE')
        : reliefRatio <= 0 && steps < 0
          ? 'APPROVE_SHORTEN_TERM'
          : kind === 'INTEREST_ONLY'
            ? 'APPROVE_INTEREST_ONLY'
            : 'APPROVE_AMORTIZED';

  const auditHash = computeHash(
    JSON.stringify({
      runId,
      tick,
      seed,
      liabilityId,
      offerCardId,
      macroRegime,
      runPhase,
      pressureTier,
      solvencyStatus,
      tickTier,
      chaosActive,
      exitPulseMultiplier,
      weights: { pressureW, phaseW, regimeW, regimeMult },
      input: { ladderSteps: steps, stateCashflow },
      current: { principal: currentTerms.principal, apr: currentTerms.apr, months: currentTerms.months, payment: currentTerms.monthlyPayment },
      proposed: { principal, apr, months: requestedMonths, kind, payment: monthlyPayment, closingFees },
      metrics: { reliefRatio, coverage, urgency, approvalScore, roll, cashflowDelta, boundedEffect },
      decision: { approved, reasonCode },
    }),
  );

  const newTerms: ContractTerms = {
    liabilityId,
    principal: approved ? principal : currentTerms.principal,
    apr: approved ? apr : currentTerms.apr,
    months: approved ? requestedMonths : currentTerms.months,
    kind: approved ? kind : currentTerms.kind,

    monthlyPayment: approved ? monthlyPayment : currentTerms.monthlyPayment,
    closingFees: approved ? closingFees : 0,
    lenderLabel: pickLenderLabel(seed, tick),
    offerCardId,

    approved,
    reasonCode,
    auditHash,
  };

  return { approved, newTerms, cashflowAdjusted, reasonCode, auditHash };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * refiLadderRestructurer
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function refiLadderRestructurer(input: M107Input, emit: MechanicEmitter): M107Output {
  const liabilityId = String(input.liabilityId ?? '');

  const tick = clamp(toSafeNumber((input as any).tick, 0), 0, RUN_TOTAL_TICKS);
  const runId = toSafeString((input as any).runId, '');

  const seed =
    toSafeString((input as any).seed, '') ||
    toSafeString((input as any).seedSalt, '') ||
    toSafeString((input as any).seed_salt, '') ||
    (liabilityId.length ? `seed:${liabilityId}` : 'seed:missing');

  const stateCashflow = toSafeNumber(input.stateCashflow, 0);

  const macroRegime = resolveMacroRegime(seed, tick, (input as any).macroRegime);
  const runPhase = resolveRunPhase(tick, (input as any).runPhase);
  const pressureTier = resolvePressureTier((input as any).pressureTier);

  const chaosActive = isChaosActive(seed, tick);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  const urgency = clamp((tick / RUN_TOTAL_TICKS) * exitPulseMultiplier, 0, 2);
  const tickTier = resolveTickTier(pressureTier, chaosActive, urgency);

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const offerCardId = pickOfferCardId(seed, tick, pressureW * phaseW, regimeW);

  const cash = toSafeNumber((input as any).cash, 0);
  const netWorth = toSafeNumber((input as any).netWorth, 0);
  const solvencyStatus = resolveSolvencyStatus(stateCashflow, cash, netWorth);

  // Ladder intent: refiTerms is interpreted as steps (not months).
  // If absent or 0, no refi attempt executes.
  const ladderSteps = Math.floor(toSafeNumber(input.refiTerms, 0));

  const currentTermsRaw = (input as any).currentTerms ?? (input as any).liabilityTerms ?? (input as any).terms;
  const currentTerms = resolveCurrentTerms(liabilityId, seed, tick, currentTermsRaw, offerCardId);

  emitM107(emit, tick, runId, 'REFI_INITIATED', {
    liabilityId,
    ladderSteps,
    stateCashflow,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    solvencyStatus,
    chaosActive,
    exitPulseMultiplier,
    offerCardId,
    currentTermsAudit: currentTerms.auditHash,
    audit: computeHash(`${seed}:${runId}:${tick}:M107:INIT:${liabilityId}:${offerCardId}`),
  });

  // No-op if player did not trigger enough “ladder intent”.
  if (Math.abs(ladderSteps) < 1 || Math.abs(ladderSteps) < M107_BOUNDS.TRIGGER_THRESHOLD) {
    const auditHash = computeHash(
      JSON.stringify({
        runId,
        tick,
        seed,
        liabilityId,
        ladderSteps,
        macroRegime,
        runPhase,
        pressureTier,
        tickTier,
        solvencyStatus,
        chaosActive,
        offerCardId,
        reason: 'NO_TRIGGER',
      }),
    );

    const newTerms: ContractTerms = {
      ...currentTerms,
      approved: false,
      reasonCode: 'NO_TRIGGER',
      auditHash,
    };

    emitM107(emit, tick, runId, 'REFI_DENIED', {
      liabilityId,
      ladderSteps,
      reasonCode: 'NO_TRIGGER',
      offerCardId,
      auditHash,
    });

    return {
      refiExecuted: false,
      newTerms,
      cashflowAdjusted: stateCashflow,
    };
  }

  const decision = computeRefiDecision({
    seed,
    tick,
    runId,
    liabilityId,
    ladderSteps,
    stateCashflow,
    macroRegime,
    runPhase,
    pressureTier,
    solvencyStatus,
    tickTier,
    chaosActive,
    exitPulseMultiplier,
    currentTerms,
    offerCardId,
  });

  if (decision.approved) {
    emitM107(emit, tick, runId, 'REFI_APPROVED', {
      liabilityId,
      ladderSteps,
      offerCardId,
      newTermsAudit: decision.newTerms.auditHash,
      reasonCode: decision.reasonCode,
      auditHash: decision.auditHash,
    });

    emitM107(emit, tick, runId, 'TERMS_UPDATED', {
      liabilityId,
      offerCardId,
      from: {
        principal: currentTerms.principal,
        apr: currentTerms.apr,
        months: currentTerms.months,
        kind: currentTerms.kind,
        monthlyPayment: currentTerms.monthlyPayment,
      },
      to: {
        principal: decision.newTerms.principal,
        apr: decision.newTerms.apr,
        months: decision.newTerms.months,
        kind: decision.newTerms.kind,
        monthlyPayment: decision.newTerms.monthlyPayment,
        closingFees: decision.newTerms.closingFees,
      },
      cashflow: {
        before: stateCashflow,
        after: decision.cashflowAdjusted,
        delta: clamp(decision.cashflowAdjusted - stateCashflow, M107_BOUNDS.MIN_CASHFLOW_DELTA, M107_BOUNDS.MAX_CASHFLOW_DELTA),
      },
      auditHash: decision.auditHash,
    });
  } else {
    emitM107(emit, tick, runId, 'REFI_DENIED', {
      liabilityId,
      ladderSteps,
      offerCardId,
      reasonCode: decision.reasonCode,
      solvencyStatus,
      macroRegime,
      chaosActive,
      auditHash: decision.auditHash,
    });
  }

  return {
    refiExecuted: decision.approved,
    newTerms: decision.newTerms,
    cashflowAdjusted: decision.cashflowAdjusted,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M107MLInput {
  refiExecuted?: boolean;
  newTerms?: ContractTerms;
  cashflowAdjusted?: number;
  runId: string;
  tick: number;
}

export interface M107MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * refiLadderRestructurerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function refiLadderRestructurerMLCompanion(input: M107MLInput): Promise<M107MLOutput> {
  const terms = input.newTerms;

  const approved = !!input.refiExecuted || !!terms?.approved;
  const payment = Math.max(1, toSafeNumber(terms?.monthlyPayment, 1));
  const apr = clamp(toSafeNumber(terms?.apr, 0.16), 0.01, 0.45);
  const months = clamp(Math.floor(toSafeNumber(terms?.months, 36)), 6, 180);
  const fees = clamp(toSafeNumber(terms?.closingFees, 0), 0, M107_BOUNDS.MAX_AMOUNT);

  // Use macro decay utilities deterministically even in ML layer (neutral placeholder regime)
  const pseudoRegime: MacroRegime = 'NEUTRAL';
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  // Signal: approved refi under high payment/fees indicates risk/pressure
  const burden = clamp((payment / 2500) + (fees / M107_BOUNDS.MAX_AMOUNT) + (apr / 0.35) + (months / 180), 0, 3);
  const score = clamp((approved ? 0.35 : 0.55) + burden * 0.12, 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(approved ? 'Refi executed' : 'Refi denied or not executed');
  topFactors.push(`Payment: ${Math.round(payment)}/mo`);
  topFactors.push(`APR: ${(apr * 100).toFixed(1)}%`);
  topFactors.push(`Term: ${months} months`);
  if (fees > 0) topFactors.push(`Fees: ${Math.round(fees)}`);
  while (topFactors.length > 5) topFactors.pop();

  const recommendation = approved
    ? 'Bank the relief but audit total cost; refi is not an escape hatch.'
    : 'If denied, reduce risk: improve cashflow coverage or wait for a better regime window.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M107:' + (terms?.auditHash ?? '')),
    confidenceDecay,
  };
}