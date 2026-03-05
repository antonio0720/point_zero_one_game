// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m148_counterparty_freeze_market_doesnt_always_clear.ts
//
// Mechanic : M148 — Counterparty Freeze: Market Doesnt Always Clear
// Family   : ops   Layer: backend_service   Priority: 2   Batch: 3
// ML Pair  : m148a
// Deps     : M09, M73
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

// ── Import Anchors (keep every import accessible + used) ───────────────────

export const M148_IMPORTED_SYMBOLS = {
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

export type M148_ImportedTypesAnchor = {
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

// ── Local domain (not part of shared ./types.ts) ───────────────────────────

export type MarketSide = 'BUY' | 'SELL';
export type MarketTxStatus = 'PENDING' | 'HELD' | 'CLEARED' | 'CANCELLED';
export type FreezeTriggerKind =
  | 'LIQUIDITY_DROUGHT'
  | 'CREDIT_EVENT'
  | 'RISK_OFF'
  | 'COUNTERPARTY_FLAG'
  | 'MANUAL'
  | 'UNKNOWN';

export interface MarketTransaction {
  id: string;
  side: MarketSide;
  symbol: string;
  qty: number;
  priceLimit?: number;
  notional?: number;
  createdTick?: number;
  meta?: Record<string, unknown>;
}

export interface CounterpartyState {
  counterpartyId: string;
  /** 0..1 where 1 is highest trust */
  trustScore?: number;
  /** 0..1 where 1 is highest liquidity */
  liquidityScore?: number;
  /** 0..100 where 100 is stable */
  stabilityScore?: number;
  /** Optional outstanding exposure */
  exposure?: number;
  meta?: Record<string, unknown>;
}

export interface FreezeTrigger {
  kind: FreezeTriggerKind;
  /** 0..100 */
  severity?: number;
  /** Optional: free-text note (short) */
  note?: string;
  /** Optional metadata */
  meta?: Record<string, unknown>;
}

export interface FreezeDecision {
  id: string;
  runId: string;
  tick: number;

  transactionId: string;
  counterpartyId: string;

  trigger: FreezeTrigger;

  phase: RunPhase;
  pressure: PressureTier;
  regime: MacroRegime;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  featuredCardId: string;
  featuredCard: GameCard;

  transactionFrozen: boolean;
  freezeDurationTicks: number;
  holdUntilTick: number;

  status: MarketTxStatus;

  /** Deterministic unfreeze token + audit hash for server verification. */
  unfreezeCondition: string;
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M148Input {
  marketTransaction?: MarketTransaction;
  counterpartyState?: CounterpartyState;
  freezeTrigger?: FreezeTrigger;
}

export interface M148Output {
  transactionFrozen: boolean;
  freezeDuration: number; // ticks
  unfreezeCondition: string;
  decision?: FreezeDecision;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M148Event = 'COUNTERPARTY_FROZEN' | 'TRANSACTION_HELD' | 'FREEZE_LIFTED';

export interface M148TelemetryPayload extends MechanicTelemetryPayload {
  event: M148Event;
  mechanic_id: 'M148';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M148_BOUNDS = {
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

export const M148_FREEZE_BOUNDS = {
  MAX_FREEZE_TICKS: 36,
  MIN_FREEZE_TICKS: 1,
  /** Deterministic jitter range. */
  FREEZE_JITTER_TICKS: 2,
  MAX_NOTE_LEN: 180,
} as const;

// ── Internal helpers (pure) ───────────────────────────────────────────────

function m148SafeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    try {
      return String(v);
    } catch {
      return '[unstringifiable]';
    }
  }
}

function m148ToNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return fallback;
}

function m148NormalizeTrigger(t: FreezeTrigger | undefined): FreezeTrigger {
  const kind: FreezeTriggerKind = (t?.kind as FreezeTriggerKind) ?? 'UNKNOWN';
  const severity = clamp(Math.floor(m148ToNumber(t?.severity, 25)), 0, 100);
  const note = t?.note ? String(t.note).slice(0, M148_FREEZE_BOUNDS.MAX_NOTE_LEN) : undefined;
  const meta = t?.meta && typeof t.meta === 'object' ? (t.meta as Record<string, unknown>) : undefined;
  return { kind, severity, note, meta };
}

function m148DerivePhase(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m148InChaos(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m148DerivePressure(tick: number, phase: RunPhase, windows: ChaosWindow[]): PressureTier {
  if (m148InChaos(tick, windows)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m148DeriveRegime(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  let regime: MacroRegime = 'NEUTRAL';
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m148PickFeaturedCard(seed: string, tick: number, pressure: PressureTier, phase: RunPhase, regime: MacroRegime) {
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(seed, pressureWeight * phaseWeight, regimeWeight);
  const safePool = pool.length ? pool : [DEFAULT_CARD];

  const idx = seededIndex(seed, tick + 999, safePool.length);
  const oppIdx = seededIndex(seed, tick + 777, Math.max(1, OPPORTUNITY_POOL.length));
  const fallback = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const featuredCard = safePool[idx] ?? fallback ?? DEFAULT_CARD;

  const idIdx = seededIndex(seed, tick + 31337, Math.max(1, DEFAULT_CARD_IDS.length));
  const featuredCardId = featuredCard.id || (DEFAULT_CARD_IDS[idIdx] ?? DEFAULT_CARD.id);

  return { featuredCard, featuredCardId, poolSize: safePool.length };
}

function m148ClampTx(tx: MarketTransaction | undefined): MarketTransaction {
  const id = String(tx?.id ?? computeHash('tx:' + m148SafeStringify(tx ?? {})));
  const side: MarketSide = tx?.side === 'SELL' ? 'SELL' : 'BUY';
  const symbol = String(tx?.symbol ?? 'UNK').slice(0, 24);
  const qty = clamp(Math.floor(m148ToNumber(tx?.qty, 0)), 0, 1_000_000);
  const priceLimit = tx?.priceLimit != null ? Math.max(0, m148ToNumber(tx.priceLimit, 0)) : undefined;
  const notional = tx?.notional != null ? Math.max(0, m148ToNumber(tx.notional, 0)) : undefined;
  const createdTick = tx?.createdTick != null ? clamp(Math.floor(m148ToNumber(tx.createdTick, 0)), 0, RUN_TOTAL_TICKS - 1) : undefined;
  const meta = tx?.meta && typeof tx.meta === 'object' ? (tx.meta as Record<string, unknown>) : undefined;
  return { id, side, symbol, qty, priceLimit, notional, createdTick, meta };
}

function m148ClampCp(cp: CounterpartyState | undefined): CounterpartyState {
  const counterpartyId = String(cp?.counterpartyId ?? 'CP:UNKNOWN').slice(0, 48);
  const trustScore = clamp(m148ToNumber(cp?.trustScore, 0.6), 0, 1);
  const liquidityScore = clamp(m148ToNumber(cp?.liquidityScore, 0.6), 0, 1);
  const stabilityScore = clamp(Math.floor(m148ToNumber(cp?.stabilityScore, 70)), 0, 100);
  const exposure = Math.max(0, Math.floor(m148ToNumber(cp?.exposure, 0)));
  const meta = cp?.meta && typeof cp.meta === 'object' ? (cp.meta as Record<string, unknown>) : undefined;
  return { counterpartyId, trustScore, liquidityScore, stabilityScore, exposure, meta };
}

function m148ComputeFreezeScore(
  seed: string,
  tick: number,
  trigger: FreezeTrigger,
  cp: CounterpartyState,
  regime: MacroRegime,
  pressure: PressureTier,
  phase: RunPhase,
): { score: number; factors: string[] } {
  const severity = clamp(Math.floor(m148ToNumber(trigger.severity, 25)), 0, 100);

  const trustPenalty = (1 - cp.trustScore!) * 35;
  const liquidityPenalty = (1 - cp.liquidityScore!) * 35;
  const stabilityPenalty = (100 - cp.stabilityScore!) * 0.3;
  const exposurePenalty = clamp(cp.exposure! / 50_000, 0, 2) * 10;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;

  // Deterministic jitter in [-3..+3]
  const jitter = seededIndex(seed, tick + 148, 7) - 3;

  const raw =
    severity +
    trustPenalty +
    liquidityPenalty +
    stabilityPenalty +
    exposurePenalty +
    (regimeMultiplier - 1) * 20 +
    (pressureWeight - 1) * 10 +
    (phaseWeight - 1) * 8 +
    jitter;

  const score = clamp(raw, 0, 150);

  const factors = seededShuffle(
    [
      `kind=${trigger.kind}`,
      `sev=${severity}`,
      `trust=${cp.trustScore!.toFixed(2)}`,
      `liq=${cp.liquidityScore!.toFixed(2)}`,
      `stab=${cp.stabilityScore}`,
      `exp=${cp.exposure}`,
      `regime=${regime}`,
      `pressure=${pressure}`,
      `phase=${phase}`,
      `jitter=${jitter}`,
    ],
    computeHash(seed + ':factors'),
  ).slice(0, 5);

  return { score, factors };
}

function m148ComputeFreezeDurationTicks(
  seed: string,
  tick: number,
  freezeScore: number,
  regime: MacroRegime,
): number {
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decayRate = computeDecayRate(regime, M148_BOUNDS.BASE_DECAY_RATE);

  const base =
    freezeScore >= 120 ? 18 :
    freezeScore >= 95 ? 12 :
    freezeScore >= 70 ? 8 :
    freezeScore >= 45 ? 5 :
    2;

  const jitterSpan = 2 * M148_FREEZE_BOUNDS.FREEZE_JITTER_TICKS + 1;
  const jitter = seededIndex(seed, tick + 4242, jitterSpan) - M148_FREEZE_BOUNDS.FREEZE_JITTER_TICKS;

  // Market doesn't always clear: regime pulse + decay can extend duration deterministically.
  const scaled = Math.round(base * clamp(pulse, 0.6, 1.35) * clamp(1 + decayRate, 1, 1.25));

  return clamp(scaled + jitter, M148_FREEZE_BOUNDS.MIN_FREEZE_TICKS, M148_FREEZE_BOUNDS.MAX_FREEZE_TICKS);
}

function m148UnfreezeToken(seed: string, decisionId: string, holdUntilTick: number): string {
  return computeHash(`${seed}:unfreeze:${decisionId}:${holdUntilTick}`);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * counterpartyFreezeHandler
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function counterpartyFreezeHandler(input: M148Input, emit: MechanicEmitter): M148Output {
  const tx = m148ClampTx(input.marketTransaction);
  const cp = m148ClampCp(input.counterpartyState);
  const trigger = m148NormalizeTrigger(input.freezeTrigger);

  const serviceHash = computeHash(m148SafeStringify(input ?? {}));
  // Deterministic tick derived from tx + cp to avoid needing external tick input.
  const tick = clamp(seededIndex(serviceHash + ':' + tx.id + ':' + cp.counterpartyId, 148, RUN_TOTAL_TICKS), 0, RUN_TOTAL_TICKS - 1);

  const seed = computeHash(`M148:${serviceHash}:${tick}:${tx.id}:${cp.counterpartyId}:${trigger.kind}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m148DerivePhase(tick);
  const pressure = m148DerivePressure(tick, phase, chaosWindows);
  const regime = m148DeriveRegime(tick, macroSchedule);

  const { featuredCard, featuredCardId } = m148PickFeaturedCard(seed, tick, pressure, phase, regime);

  const { score: freezeScore, factors } = m148ComputeFreezeScore(seed, tick, trigger, cp, regime, pressure, phase);

  // Gate: freeze occurs when score crosses threshold and deterministic gate allows it.
  const gate = seededIndex(seed, tick + 1, 10); // 0..9
  const transactionFrozen = freezeScore >= 55 && gate < 9; // most of the time if score is high
  const freezeDurationTicks = transactionFrozen ? m148ComputeFreezeDurationTicks(seed, tick, freezeScore, regime) : 0;

  const holdUntilTick = clamp(tick + freezeDurationTicks, 0, RUN_TOTAL_TICKS - 1);

  const decisionId = computeHash(`${seed}:decision:${tx.id}:${cp.counterpartyId}:${tick}`);
  const unfreezeCondition = transactionFrozen ? m148UnfreezeToken(seed, decisionId, holdUntilTick) : computeHash(`${seed}:no-freeze`);

  const status: MarketTxStatus =
    transactionFrozen ? 'HELD' : 'CLEARED';

  const auditHash = computeHash(
    m148SafeStringify({
      v: 'M148/v1',
      decisionId,
      serviceHash,
      seed,
      tick,
      tx,
      cp,
      trigger,
      phase,
      pressure,
      regime,
      featuredCardId,
      freezeScore,
      factors,
      transactionFrozen,
      freezeDurationTicks,
      holdUntilTick,
      status,
      unfreezeCondition,
      macroEvents: macroSchedule.length,
      chaosWindows: chaosWindows.length,
      defaultCard: DEFAULT_CARD.id,
      defaultIdsLen: DEFAULT_CARD_IDS.length,
      opportunityPoolLen: OPPORTUNITY_POOL.length,
    }),
  );

  const decision: FreezeDecision = {
    id: decisionId,
    runId: serviceHash,
    tick,
    transactionId: tx.id,
    counterpartyId: cp.counterpartyId,
    trigger,
    phase,
    pressure,
    regime,
    macroSchedule,
    chaosWindows,
    featuredCardId,
    featuredCard,
    transactionFrozen,
    freezeDurationTicks,
    holdUntilTick,
    status,
    unfreezeCondition,
    auditHash,
  };

  if (transactionFrozen) {
    emit({
      event: 'COUNTERPARTY_FROZEN',
      mechanic_id: 'M148',
      tick,
      runId: serviceHash,
      payload: {
        decisionId,
        transactionId: tx.id,
        counterpartyId: cp.counterpartyId,
        kind: trigger.kind,
        freezeScore,
        freezeDurationTicks,
        holdUntilTick,
        phase,
        pressure,
        regime,
        featuredCardId,
        factors,
        auditHash,
      },
    });

    emit({
      event: 'TRANSACTION_HELD',
      mechanic_id: 'M148',
      tick,
      runId: serviceHash,
      payload: {
        decisionId,
        transactionId: tx.id,
        status,
        unfreezeCondition,
        auditHash,
      },
    });
  } else {
    emit({
      event: 'FREEZE_LIFTED',
      mechanic_id: 'M148',
      tick,
      runId: serviceHash,
      payload: {
        decisionId,
        transactionId: tx.id,
        status,
        reason: 'CLEARED',
        auditHash,
      },
    });
  }

  return {
    transactionFrozen,
    freezeDuration: freezeDurationTicks,
    unfreezeCondition,
    decision,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M148MLInput {
  transactionFrozen?: boolean;
  freezeDuration?: number;
  unfreezeCondition?: string;
  runId: string;
  tick: number;
}

export interface M148MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * counterpartyFreezeHandlerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function counterpartyFreezeHandlerMLCompanion(input: M148MLInput): Promise<M148MLOutput> {
  const frozen = !!input.transactionFrozen;
  const duration = clamp(Math.floor(m148ToNumber(input.freezeDuration, 0)), 0, M148_FREEZE_BOUNDS.MAX_FREEZE_TICKS);

  const base = frozen ? 0.65 : 0.15;
  const durScore = clamp(duration / M148_FREEZE_BOUNDS.MAX_FREEZE_TICKS, 0, 1) * (frozen ? 0.25 : 0.05);

  const score = clamp(base + durScore + 0.10, 0.01, 0.99);

  const topFactors: string[] = [];
  if (frozen) topFactors.push('Transaction frozen (held)');
  if (duration > 0) topFactors.push(`Freeze duration: ${duration} ticks`);
  if (input.unfreezeCondition) topFactors.push('Unfreeze token issued');
  topFactors.push('Market may not clear deterministically');
  topFactors.push('Advisory only (no state mutation)');

  const recommendation = frozen
    ? 'Reduce exposure and wait for hold window; add alternate counterparties to improve clearance probability.'
    : 'Cleared: proceed, but monitor counterparty scores for renewed freeze risk.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(m148SafeStringify(input) + ':ml:M148'),
    confidenceDecay: frozen ? 0.08 : 0.04,
  };
}