// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m09_opportunity_window_open_table_auction.ts
//
// Mechanic : M09 — Opportunity Window + Open-Table Auction
// Family   : run_core   Layer: card_handler   Priority: 1   Batch: 1
// ML Pair  : m09a
// Deps     : M01, M04
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
 * Runtime access to the exact mechanicsUtils symbols bound to M09.
 * Exported so router/debug UI/tests can introspect what M09 is wired to.
 */
export const M09_IMPORTED_SYMBOLS = {
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
export type M09_ImportedTypesAnchor = {
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

// ── Local types (must exist because generator referenced AuctionWindow) ───────
//
// If your repo already defines AuctionWindow in ./types, remove this and import it.
// This local type is minimal and safe; it won’t interfere unless you also export it.
export type AuctionWindow = {
  windowId: string;
  openedAtTick: number;
  expiresAtTick: number;
  minBid: number;
  buyNow?: number;
  isOpen: boolean;
  // Optional book-keeping
  lastBidderId?: string;
  lastBid?: number;
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M09Input {
  stateTick?: number;
  runSeed?: string;
  stateMacroRegime?: MacroRegime;
  auctionWindow?: AuctionWindow;
}

export interface M09Output {
  opportunityCard: GameCard;
  auctionResult: AuctionResult;
  firstRefusalExpiry: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M09Event =
  | 'OPPORTUNITY_OPENED'
  | 'FIRST_REFUSAL_EXPIRED'
  | 'OPPORTUNITY_PURCHASED'
  | 'OPPORTUNITY_DISCARDED';

export interface M09TelemetryPayload extends MechanicTelemetryPayload {
  event: M09Event;
  mechanic_id: 'M09';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M09_BOUNDS = {
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

// ── Internal helpers (pure) ────────────────────────────────────────────────

function m09ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

function m09DerivePhase(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m09RegimeFromSchedule(tick: number, schedule: MacroEvent[]): MacroRegime {
  let r: MacroRegime = 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function m09TickIsInChaos(tick: number, chaos: ChaosWindow[]): boolean {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m09DerivePressure(tick: number, phase: RunPhase, chaos: ChaosWindow[]): PressureTier {
  if (m09TickIsInChaos(tick, chaos)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m09DeriveTickTier(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m09DefaultAuctionWindow(seed: string, tick: number, regime: MacroRegime): AuctionWindow {
  const windowId = computeHash(`${seed}:auction:${tick}`).slice(0, 12);

  // Deterministic minBid + buyNow derived from regime + tick noise.
  const baseMin = 100;
  const baseBuy = 600;

  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const n = seededIndex(seed, tick + 77, 1000) / 1000; // 0..0.999
  const minBid = Math.floor((baseMin * mult) * (1 + n * 0.25));
  const buyNow = Math.floor((baseBuy * pulse) * (1 + n * 0.25));

  const openedAtTick = tick;
  const expiresAtTick = tick + M09_BOUNDS.PULSE_CYCLE;

  return {
    windowId,
    openedAtTick,
    expiresAtTick,
    minBid,
    buyNow,
    isOpen: true,
  };
}

function m09PickOpportunity(seed: string, tick: number): GameCard {
  const idx = seededIndex(seed, tick, OPPORTUNITY_POOL.length);
  const c = OPPORTUNITY_POOL[idx] ?? DEFAULT_CARD;
  return { ...c };
}

type M09Context = {
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
  weightedPick: GameCard;

  auditCore: string;
};

function m09BuildContext(runId: string, tick: number): M09Context {
  const t = m09ClampTick(tick);
  const seed = computeHash(`${runId}:M09:${t}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m09DerivePhase(t);
  const regime = m09RegimeFromSchedule(t, macroSchedule);
  const pressure = m09DerivePressure(t, phase, chaosWindows);
  const tickTier = m09DeriveTickTier(pressure);

  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decayRate = computeDecayRate(regime, M09_BOUNDS.BASE_DECAY_RATE);

  const deckOrderIds = seededShuffle(DEFAULT_CARD_IDS, seed);

  const pool = buildWeightedPool(seed + ':pool', clamp(pressureWeight * phaseWeight, 0.1, 10), regimeWeight);
  const poolIdx = seededIndex(seed, t + 33, Math.max(1, pool.length));
  const weightedPick = pool[poolIdx] ?? DEFAULT_CARD;

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
    weightedPick,
    auditCore,
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * opportunityWindowAuction
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function opportunityWindowAuction(input: M09Input, emit: MechanicEmitter): M09Output {
  const runSeed = String(input.runSeed ?? '');
  const currentTick = (input.stateTick as number) ?? 0;
  const tick = m09ClampTick(currentTick);

  const macroRegime = (input.stateMacroRegime as MacroRegime) ?? 'NEUTRAL';

  // Opportunity card is deterministic-by-seed.
  const opportunityCard = m09PickOpportunity(runSeed, tick);

  // First refusal is deterministic window length.
  const firstRefusalExpiry = tick + M09_BOUNDS.FIRST_REFUSAL_TICKS;

  // Auction window either comes from state or deterministic default.
  const auctionWindow =
    input.auctionWindow ??
    m09DefaultAuctionWindow(runSeed || computeHash('M09'), tick, macroRegime);

  const expired = tick > auctionWindow.expiresAtTick;

  // Minimal “open table” result placeholder (actual bidding lives elsewhere).
  const auctionResult: AuctionResult = {
    winnerId: '',
    winnerBid: 0,
    expired,
  };

  emit({
    event: 'OPPORTUNITY_OPENED',
    mechanic_id: 'M09',
    tick,
    runId: runSeed,
    payload: {
      opportunityCard: opportunityCard.id,
      firstRefusalExpiry,
      auctionWindow: {
        windowId: auctionWindow.windowId,
        openedAtTick: auctionWindow.openedAtTick,
        expiresAtTick: auctionWindow.expiresAtTick,
        minBid: auctionWindow.minBid,
        buyNow: auctionWindow.buyNow ?? null,
      },
      macroRegime,
      regimeMultiplier: REGIME_MULTIPLIERS[macroRegime] ?? 1.0,
      exitPulse: EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0,
    },
  });

  if (tick >= firstRefusalExpiry) {
    emit({
      event: 'FIRST_REFUSAL_EXPIRED',
      mechanic_id: 'M09',
      tick,
      runId: runSeed,
      payload: { firstRefusalExpiry, opportunityCard: opportunityCard.id },
    });
  }

  return {
    opportunityCard,
    auctionResult,
    firstRefusalExpiry,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M09MLInput {
  opportunityCard?: GameCard;
  auctionResult?: AuctionResult;
  firstRefusalExpiry?: number;
  runId: string;
  tick: number;
}

export interface M09MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * opportunityWindowAuctionMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function opportunityWindowAuctionMLCompanion(input: M09MLInput): Promise<M09MLOutput> {
  const ctx = m09BuildContext(input.runId, input.tick);

  const oc = input.opportunityCard ?? DEFAULT_CARD;
  const expiry = typeof input.firstRefusalExpiry === 'number' ? input.firstRefusalExpiry : ctx.tick + M09_BOUNDS.FIRST_REFUSAL_TICKS;

  const untilExpiry = Math.max(0, expiry - ctx.tick);
  const urgency = clamp(1 - untilExpiry / Math.max(1, M09_BOUNDS.FIRST_REFUSAL_TICKS), 0, 1);

  const pressurePenalty = clamp((ctx.pressureWeight - 0.8) * 0.22, 0, 0.25);
  const urgencyPenalty = urgency * 0.10;

  const base = 0.93 - pressurePenalty - urgencyPenalty;
  const score = clamp(base, 0.01, 0.99);

  const topFactors = [
    `tick=${ctx.tick + 1}/${RUN_TOTAL_TICKS} phase=${ctx.phase} tier=${ctx.tickTier}`,
    `regime=${ctx.regime} mult=${ctx.regimeMultiplier.toFixed(2)} exitPulse=${ctx.exitPulse.toFixed(2)}`,
    `opportunity=${oc.id} expiryIn=${untilExpiry} ticks`,
    `suggested=${ctx.weightedPick.id} deckTop=${ctx.deckOrderIds[0] ?? 'n/a'}`,
    `weights: p=${ctx.pressureWeight.toFixed(2)} ph=${ctx.phaseWeight.toFixed(2)} r=${ctx.regimeWeight.toFixed(2)}`,
  ].slice(0, 5);

  const recommendation =
    untilExpiry === 0
      ? 'First refusal is expired: treat the opportunity as contested; either buy now or discard and move on.'
      : untilExpiry <= 2
        ? `Window is closing: if "${oc.name}" fits your cashflow thesis, commit now; otherwise pivot to "${ctx.weightedPick.name}".`
        : `Opportunity open: evaluate "${oc.name}" against "${ctx.weightedPick.name}" and bid only if ROI beats baseline.`;

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(
      ctx.auditCore +
        ':ml:M09:' +
        JSON.stringify({
          opportunityId: input.opportunityCard?.id ?? null,
          auctionExpired: input.auctionResult?.expired ?? null,
          firstRefusalExpiry: input.firstRefusalExpiry ?? null,
        }),
    ),
    confidenceDecay: ctx.decayRate,
  };
}