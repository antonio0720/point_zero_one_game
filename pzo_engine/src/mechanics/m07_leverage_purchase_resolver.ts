// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m07_leverage_purchase_resolver.ts
//
// Mechanic : M07 — Leverage Purchase Resolver
// Family   : run_core   Layer: card_handler   Priority: 1   Batch: 1
// ML Pair  : m07a
// Deps     : M04, M06
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

// ── Import Anchors (keep every import “accessible” + used) ─────────────────────

/**
 * Runtime access to the exact mechanicsUtils symbols bound to M07.
 * Exported so router/debug UI/tests can introspect what M07 is wired to.
 */
export const M07_IMPORTED_SYMBOLS = {
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
 * Type-only anchor to keep every imported domain type referenced in-module.
 * Exported so TS does not flag it under noUnusedLocals.
 */
export type M07_ImportedTypesAnchor = {
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

export interface M07Input {
  cardPlayed?: GameCard;
  stateCash?: number;
  stateLeverage?: number;
  stateMacroRegime?: MacroRegime;

  // Optional context (safe additions; keeps backward compatibility)
  stateTick?: number;
  runSeed?: string;
  stateRunPhase?: RunPhase;
  statePressureTier?: PressureTier;
}

export interface M07Output {
  purchaseResult: PurchaseResult;
  buffStack: Buff[];
  leverageUpdated: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M07Event =
  | 'LEVERAGE_PURCHASED'
  | 'BUFF_APPLIED'
  | 'PURCHASE_DENIED'
  | 'AFFORDABILITY_CHECKED';

export interface M07TelemetryPayload extends MechanicTelemetryPayload {
  event: M07Event;
  mechanic_id: 'M07';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M07_BOUNDS = {
  TRIGGER_THRESHOLD: 3,
  MULTIPLIER: 1.5,
  MAX_AMOUNT: 50_000,
  MAX_LEVERAGE: 500_000,
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

// ── Internal helpers (pure) ────────────────────────────────────────────────

function m07ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

function m07DerivePhase(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m07RegimeFromSchedule(tick: number, schedule: MacroEvent[]): MacroRegime {
  let r: MacroRegime = 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function m07TickIsInChaos(tick: number, chaos: ChaosWindow[]): boolean {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m07DerivePressure(tick: number, phase: RunPhase, chaos: ChaosWindow[]): PressureTier {
  if (m07TickIsInChaos(tick, chaos)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m07DeriveTickTier(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

type M07Context = {
  seed: string;
  tick: number;

  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tickTier: TickTier;

  phaseWeight: number;
  regimeWeight: number;
  pressureWeight: number;

  regimeMultiplier: number;
  exitPulse: number;
  decayRate: number;

  deckOrderIds: string[];
  opportunityPick: GameCard;
  weightedPick: GameCard;

  auditCore: string;
};

function m07BuildContext(runId: string, tick: number): M07Context {
  const t = m07ClampTick(tick);
  const seed = computeHash(`${runId}:M07:${t}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m07DerivePhase(t);
  const regime = m07RegimeFromSchedule(t, macroSchedule);
  const pressure = m07DerivePressure(t, phase, chaosWindows);
  const tickTier = m07DeriveTickTier(pressure);

  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decayRate = computeDecayRate(regime, M07_BOUNDS.BASE_DECAY_RATE);

  const deckOrderIds = seededShuffle(DEFAULT_CARD_IDS, seed);

  const oppIdx = seededIndex(seed, t + 17, OPPORTUNITY_POOL.length);
  const opportunityPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const pool = buildWeightedPool(seed + ':pool', clamp(pressureWeight * phaseWeight, 0.1, 10), regimeWeight);
  const poolIdx = seededIndex(seed, t + 33, Math.max(1, pool.length));
  const weightedPick = pool[poolIdx] ?? opportunityPick ?? DEFAULT_CARD;

  const auditCore = computeHash(
    JSON.stringify({
      seed,
      t,
      phase,
      regime,
      pressure,
      tickTier,
      phaseWeight,
      regimeWeight,
      pressureWeight,
      regimeMultiplier,
      exitPulse,
      decayRate,
      deckTop: deckOrderIds[0] ?? null,
      opportunityId: opportunityPick.id,
      weightedPickId: weightedPick.id,
      macroSchedule,
      chaosWindows,
    }),
  );

  return {
    seed,
    tick: t,
    phase,
    regime,
    pressure,
    tickTier,
    phaseWeight,
    regimeWeight,
    pressureWeight,
    regimeMultiplier,
    exitPulse,
    decayRate,
    deckOrderIds,
    opportunityPick,
    weightedPick,
    auditCore,
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * leveragePurchaseResolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function leveragePurchaseResolver(input: M07Input, emit: MechanicEmitter): M07Output {
  const cardPlayed = input.cardPlayed as GameCard;
  const cash = (input.stateCash as number) ?? 0;
  const leverage = (input.stateLeverage as number) ?? 0;
  const macroRegime = (input.stateMacroRegime as MacroRegime) ?? 'NEUTRAL';

  const currentTick = (input.stateTick as number) ?? 0;
  const runId = String(input.runSeed ?? '');

  const cardCost = cardPlayed?.cost ?? 0;
  const downPayment = cardPlayed?.downPayment ?? cardCost;

  const leverageHeadroom = Math.max(0, M07_BOUNDS.MAX_LEVERAGE - leverage);
  const wouldExceedCap = leverage + cardCost > M07_BOUNDS.MAX_LEVERAGE;
  const hasCash = cash >= downPayment;

  emit({
    event: 'AFFORDABILITY_CHECKED',
    mechanic_id: 'M07',
    tick: currentTick,
    runId,
    payload: {
      macroRegime,
      macroMultiplier: REGIME_MULTIPLIERS[macroRegime] ?? 1.0,
      cash,
      leverage,
      leverageHeadroom,
      cardId: cardPlayed?.id ?? '',
      cardCost,
      downPayment,
      hasCash,
      wouldExceedCap,
    },
  });

  const afforded = hasCash && !wouldExceedCap;

  const purchaseResult: PurchaseResult = {
    success: afforded,
    assetId: cardPlayed?.id ?? '',
    cashSpent: afforded ? downPayment : 0,
    leverageAdded: afforded ? cardCost : 0,
    reason: afforded ? 'APPROVED' : !hasCash ? 'INSUFFICIENT_CASH' : 'LEVERAGE_CAP',
  };

  if (afforded) {
    emit({
      event: 'LEVERAGE_PURCHASED',
      mechanic_id: 'M07',
      tick: currentTick,
      runId,
      payload: {
        macroRegime,
        exitPulse: EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0,
        afforded,
        cardCost,
        downPayment,
        leverageBefore: leverage,
        leverageAfter: clamp(leverage + cardCost, 0, M07_BOUNDS.MAX_LEVERAGE),
      },
    });
  } else {
    emit({
      event: 'PURCHASE_DENIED',
      mechanic_id: 'M07',
      tick: currentTick,
      runId,
      payload: {
        macroRegime,
        reason: purchaseResult.reason,
        cash,
        leverage,
        leverageHeadroom,
        cardId: cardPlayed?.id ?? '',
        cardCost,
        downPayment,
      },
    });
  }

  const buffStack: Buff[] = afforded
    ? [{ id: cardPlayed?.id ?? '', type: 'LEVERAGE', magnitude: cardCost, expiresAt: -1 }]
    : [];

  if (buffStack.length > 0) {
    emit({
      event: 'BUFF_APPLIED',
      mechanic_id: 'M07',
      tick: currentTick,
      runId,
      payload: {
        buffCount: buffStack.length,
        buffType: buffStack[0]?.type ?? '',
        magnitude: buffStack[0]?.magnitude ?? 0,
      },
    });
  }

  return {
    purchaseResult: purchaseResult,
    buffStack: buffStack,
    leverageUpdated: afforded ? clamp(leverage + cardCost, 0, M07_BOUNDS.MAX_LEVERAGE) : leverage,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M07MLInput {
  purchaseResult?: PurchaseResult;
  buffStack?: Buff[];
  leverageUpdated?: number;
  runId: string;
  tick: number;
}

export interface M07MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * leveragePurchaseResolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function leveragePurchaseResolverMLCompanion(input: M07MLInput): Promise<M07MLOutput> {
  const ctx = m07BuildContext(input.runId, input.tick);

  const leverageUpdated = typeof input.leverageUpdated === 'number' ? input.leverageUpdated : 0;
  const pr = input.purchaseResult;

  const approved = Boolean(pr?.success);
  const reason = String(pr?.reason ?? 'UNKNOWN');

  const tickNorm = clamp((ctx.tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  const pressurePenalty = clamp((ctx.pressureWeight - 0.8) * 0.22, 0, 0.25);
  const regimePenalty = clamp((1.0 - (REGIME_WEIGHTS[ctx.regime] ?? 1.0)) * 0.25, 0, 0.25);

  const approvalBoost = approved ? 0.08 : -0.06;
  const base = 0.90 - tickNorm * 0.08 - pressurePenalty - regimePenalty + approvalBoost;

  const score = clamp(base, 0.01, 0.99);

  const topFactors = [
    `tick=${ctx.tick + 1}/${RUN_TOTAL_TICKS} phase=${ctx.phase} tier=${ctx.tickTier}`,
    `regime=${ctx.regime} mult=${ctx.regimeMultiplier.toFixed(2)} exitPulse=${ctx.exitPulse.toFixed(2)}`,
    `purchase=${approved ? 'APPROVED' : 'DENIED'} reason=${reason}`,
    `leverage=${leverageUpdated.toFixed(0)} cap=${M07_BOUNDS.MAX_LEVERAGE}`,
    `suggestedCard=${ctx.weightedPick.id} opp=${ctx.opportunityPick.id} deckTop=${ctx.deckOrderIds[0] ?? 'n/a'}`,
  ].slice(0, 5);

  const recommendation = approved
    ? `Approved: lock leverage discipline—prioritize cashflow to service debt; next consider "${ctx.weightedPick.name}".`
    : reason === 'INSUFFICIENT_CASH'
      ? `Denied (cash): raise down payment via liquidity actions; avoid new leverage until cash recovers; consider "${ctx.opportunityPick.name}".`
      : `Denied (cap): delever or refinance; cap pressure detected—switch to lower-cost plays like "${ctx.weightedPick.name}".`;

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(
      ctx.auditCore +
        ':ml:M07:' +
        JSON.stringify({
          purchase: pr ?? null,
          leverageUpdated: input.leverageUpdated ?? null,
          buffCount: input.buffStack?.length ?? null,
        }),
    ),
    confidenceDecay: ctx.decayRate,
  };
}