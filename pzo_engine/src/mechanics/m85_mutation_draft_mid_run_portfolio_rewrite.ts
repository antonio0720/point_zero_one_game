// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m85_mutation_draft_mid_run_portfolio_rewrite.ts
//
// Mechanic : M85 — Mutation Draft: Mid-Run Portfolio Rewrite
// Family   : portfolio_expert   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m85a
// Deps     : M04, M31
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
 * Runtime access to the exact mechanicsUtils symbols bound to M85.
 * Exported so downstream systems (router, debug UI, test harness) can introspect.
 */
export const M85_IMPORTED_SYMBOLS = {
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
 * Exported so TS does not flag it under noUnusedLocals (and so IDEs can jump-to-type).
 */
export type M85_ImportedTypesAnchor = {
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

// ── Local domain (M85-specific) ───────────────────────────────────────────────

/**
 * MutationOption
 * Local, M85-scoped option shape (shared types.ts does not currently define it).
 * Keep this JSON-safe: deterministic + server-verifiable.
 */
export interface MutationOption {
  id: string;
  label: string;

  /**
   * Proposed cash delta applied by the rewrite (bounded by M85_BOUNDS).
   * Positive = cash gained, negative = cash spent.
   */
  cashDelta?: number;

  /**
   * Proposed monthly cashflow delta applied by the rewrite (bounded by M85_BOUNDS).
   * Positive = more cashflow, negative = less cashflow.
   */
  cashflowDelta?: number;

  /**
   * Optional “portfolio rewrite” hint: remove one asset and/or add one.
   * (Exec hook remains non-mutating; downstream applies the diff deterministically.)
   */
  removeAssetId?: string;
  addAsset?: Asset;

  /**
   * Optional risk delta, -1..+1 for advisory/telemetry only.
   */
  riskDelta?: number;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M85Input {
  mutationOptions?: MutationOption[];
  stateAssets?: Asset[];
  stateTick?: number;

  /**
   * Optional: available via snapshot spread fallback (see snapshotExtractor).
   * We do not require it, but use it when present for stronger determinism.
   */
  runId?: string;
  runSeed?: string;
}

export interface M85Output {
  mutationApplied: boolean;
  portfolioRewritten: boolean;
  cordImpact: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M85Event = 'MUTATION_DRAFT_OPENED' | 'MUTATION_APPLIED' | 'PORTFOLIO_REWRITTEN';

export interface M85TelemetryPayload extends MechanicTelemetryPayload {
  event: M85Event;
  mechanic_id: 'M85';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M85_BOUNDS = {
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

function m85ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

function m85TickIsInChaos(tick: number, chaos: ChaosWindow[]): boolean {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m85DerivePhaseFromTick(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m85DeriveRegimeFromSchedule(tick: number, schedule: MacroEvent[]): MacroRegime {
  let r: MacroRegime = 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function m85DerivePressureTier(tick: number, phase: RunPhase, chaos: ChaosWindow[]): PressureTier {
  if (m85TickIsInChaos(tick, chaos)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m85DeriveTickTier(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m85ClampMutationOption(opt: MutationOption): MutationOption {
  const cashDelta = opt.cashDelta ?? 0;
  const cashflowDelta = opt.cashflowDelta ?? 0;

  return {
    ...opt,
    cashDelta: clamp(cashDelta, M85_BOUNDS.MIN_CASH_DELTA, M85_BOUNDS.MAX_CASH_DELTA),
    cashflowDelta: clamp(cashflowDelta, M85_BOUNDS.MIN_CASHFLOW_DELTA, M85_BOUNDS.MAX_CASHFLOW_DELTA),
    riskDelta: opt.riskDelta != null ? clamp(opt.riskDelta, -1, 1) : opt.riskDelta,
  };
}

type M85Context = {
  runId: string;
  tick: number;

  seed: string;

  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tickTier: TickTier;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  phaseWeight: number;
  regimeWeight: number;
  pressureWeight: number;

  regimeMultiplier: number;
  exitPulse: number;

  decayRate: number;

  deckOrderIds: string[];
  deckOrderCards: GameCard[];

  drawPool: GameCard[];
  draftCard: GameCard;

  auditCore: string;
};

function m85BuildContext(runId: string, tick: number): M85Context {
  const t = m85ClampTick(tick);

  // Deterministic seed per run+tick+mechanic.
  const seed = computeHash(`${runId}:M85:${t}`);

  // Macro/chaos determinism (global utilities).
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m85DerivePhaseFromTick(t);
  const regime = m85DeriveRegimeFromSchedule(t, macroSchedule);
  const pressure = m85DerivePressureTier(t, phase, chaosWindows);
  const tickTier = m85DeriveTickTier(pressure);

  // Weights + multipliers (imported tables must be used).
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M85_BOUNDS.BASE_DECAY_RATE);

  // Use DEFAULT_CARD_IDS/OPPORTUNITY_POOL/DEFAULT_CARD deterministically.
  const deckOrderIds = seededShuffle(DEFAULT_CARD_IDS, seed);
  const byId = new Map<string, GameCard>(OPPORTUNITY_POOL.map((c) => [c.id, c]));
  const deckOrderCards = deckOrderIds.map((id) => byId.get(id) ?? DEFAULT_CARD);

  // Weighted pool builds a deterministic “draft context card” (non-power cosmetic cue if desired).
  const drawPool = buildWeightedPool(seed + ':pool', pressureWeight * phaseWeight, regimeWeight);
  const draftCard = drawPool[seededIndex(seed, t + 17, drawPool.length)] ?? drawPool[0] ?? DEFAULT_CARD;

  const auditCore = computeHash(
    JSON.stringify({
      runId,
      tick: t,
      seed,
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
      macroSchedule,
      chaosWindows,
      deckOrderIds,
      draftCardId: draftCard.id,
      poolIds: drawPool.map((c) => c.id),
    }),
  );

  return {
    runId,
    tick: t,
    seed,
    phase,
    regime,
    pressure,
    tickTier,
    macroSchedule,
    chaosWindows,
    phaseWeight,
    regimeWeight,
    pressureWeight,
    regimeMultiplier,
    exitPulse,
    decayRate,
    deckOrderIds,
    deckOrderCards,
    drawPool,
    draftCard,
    auditCore,
  };
}

function m85StableRunIdFromInput(input: M85Input, assets: Asset[], tick: number): string {
  const explicit = String(input.runId ?? input.runSeed ?? '').trim();
  if (explicit.length > 0) return explicit;

  // Fallback: stable hash derived from asset ids + tick (still deterministic).
  const ids = assets.map((a) => a.id).sort();
  return computeHash(`M85:fallback:${tick}:${ids.join('|')}`);
}

function m85ComputeCordImpact(
  ctx: M85Context,
  assets: Asset[],
  appliedOpt: MutationOption | null,
): number {
  const totalValue = assets.reduce((s, a) => s + (a.value ?? 0), 0);
  const totalCashflow = assets.reduce((s, a) => s + (a.cashflowMonthly ?? 0), 0);

  const cashDelta = appliedOpt?.cashDelta ?? 0;
  const cashflowDelta = appliedOpt?.cashflowDelta ?? 0;

  // Deterministic, bounded effect score:
  // - More impact when pressure is high + regime multiplier is strong
  // - Slightly more impact if in chaos (pressureTier CRITICAL)
  // - Anchored to actual portfolio stats so it’s not arbitrary
  const portfolioMass = clamp(Math.abs(totalValue) / 100_000, 0, 1);
  const cashflowMass = clamp(Math.abs(totalCashflow) / 10_000, 0, 1);

  const optionMass =
    clamp(Math.abs(cashDelta) / Math.max(1, M85_BOUNDS.MAX_CASH_DELTA), 0, 1) * 0.6 +
    clamp(Math.abs(cashflowDelta) / Math.max(1, M85_BOUNDS.MAX_CASHFLOW_DELTA), 0, 1) * 0.4;

  const tempo = clamp(ctx.pressureWeight * ctx.phaseWeight, 0.1, 10);
  const macro = clamp(ctx.regimeWeight * ctx.regimeMultiplier * ctx.exitPulse, 0.1, 10);

  const applied = appliedOpt ? 1 : 0;
  const raw =
    applied *
    (M85_BOUNDS.MULTIPLIER * tempo * macro) *
    (10_000 * portfolioMass + 8_000 * cashflowMass + 12_000 * optionMass);

  return clamp(raw * M85_BOUNDS.EFFECT_MULTIPLIER, M85_BOUNDS.MIN_EFFECT, M85_BOUNDS.MAX_EFFECT);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * mutationDraftExecutor
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function mutationDraftExecutor(input: M85Input, emit: MechanicEmitter): M85Output {
  const mutationOptions = (input.mutationOptions ?? []) as MutationOption[];
  const stateAssets = (input.stateAssets ?? []) as Asset[];
  const stateTick = (input.stateTick ?? 0) as number;

  const runId = m85StableRunIdFromInput(input, stateAssets, stateTick);
  const ctx = m85BuildContext(runId, stateTick);

  // Telemetry: draft opened (always)
  emit({
    event: 'MUTATION_DRAFT_OPENED',
    mechanic_id: 'M85',
    tick: ctx.tick,
    runId: ctx.runId,
    payload: {
      tickTier: ctx.tickTier,
      phase: ctx.phase,
      regime: ctx.regime,
      pressure: ctx.pressure,
      draftCardId: ctx.draftCard.id,
      mutationOptionsCount: mutationOptions.length,
      assetsCount: stateAssets.length,
      audit: ctx.auditCore,
    },
  });

  // Trigger logic: mid-run, enough portfolio complexity, options available.
  const midRunGate = ctx.tick >= M85_BOUNDS.FIRST_REFUSAL_TICKS;
  const complexityGate = stateAssets.length >= M85_BOUNDS.TRIGGER_THRESHOLD;
  const optionsGate = mutationOptions.length > 0;

  const shouldApply = midRunGate && complexityGate && optionsGate;

  let chosen: MutationOption | null = null;

  if (shouldApply) {
    const cleaned = mutationOptions.map(m85ClampMutationOption);

    // Deterministic selection keyed by seed+tick.
    const idx = seededIndex(ctx.seed + ':mut', ctx.tick + 33, cleaned.length);
    chosen = cleaned[idx] ?? cleaned[0] ?? null;

    emit({
      event: 'MUTATION_APPLIED',
      mechanic_id: 'M85',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        chosenId: chosen?.id ?? null,
        chosenLabel: chosen?.label ?? null,
        cashDelta: chosen?.cashDelta ?? 0,
        cashflowDelta: chosen?.cashflowDelta ?? 0,
        riskDelta: chosen?.riskDelta ?? null,
        removeAssetId: chosen?.removeAssetId ?? null,
        addAssetId: chosen?.addAsset?.id ?? null,
        audit: computeHash(ctx.auditCore + ':applied:' + JSON.stringify(chosen ?? {})),
      },
    });

    emit({
      event: 'PORTFOLIO_REWRITTEN',
      mechanic_id: 'M85',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        // Exec hook remains non-mutating; this payload is the deterministic rewrite instruction.
        rewrite: {
          removeAssetId: chosen?.removeAssetId ?? null,
          addAsset: chosen?.addAsset ?? null,
          cashDelta: chosen?.cashDelta ?? 0,
          cashflowDelta: chosen?.cashflowDelta ?? 0,
        },
        audit: computeHash(ctx.auditCore + ':rewrite:' + JSON.stringify(chosen ?? {})),
      },
    });
  }

  const cordImpact = m85ComputeCordImpact(ctx, stateAssets, chosen);

  return {
    mutationApplied: Boolean(chosen),
    portfolioRewritten: Boolean(chosen),
    cordImpact,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M85MLInput {
  mutationApplied?: boolean;
  portfolioRewritten?: boolean;
  cordImpact?: number;
  runId: string;
  tick: number;
}

export interface M85MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * mutationDraftExecutorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function mutationDraftExecutorMLCompanion(input: M85MLInput): Promise<M85MLOutput> {
  const ctx = m85BuildContext(input.runId, input.tick);

  const applied = Boolean(input.mutationApplied || input.portfolioRewritten);
  const impact = clamp((input.cordImpact ?? 0) / Math.max(1, M85_BOUNDS.MAX_EFFECT), 0, 1);

  // Higher volatility environments reduce confidence.
  const chaosNow = m85TickIsInChaos(ctx.tick, ctx.chaosWindows);
  const chaosPenalty = chaosNow ? 0.22 : 0.0;
  const pressurePenalty = clamp((ctx.pressureWeight - 0.8) * 0.25, 0, 0.35);
  const regimePenalty = clamp((1.15 - (REGIME_WEIGHTS[ctx.regime] ?? 1.0)) * 0.20, 0, 0.25);

  const base = applied ? 0.70 + impact * 0.25 : 0.45 + impact * 0.15;
  const score = clamp(base - chaosPenalty - pressurePenalty - regimePenalty, 0.01, 0.99);

  const topFactors = [
    `tick=${ctx.tick + 1}/${RUN_TOTAL_TICKS} phase=${ctx.phase} tier=${ctx.tickTier}`,
    `regime=${ctx.regime} mult=${ctx.regimeMultiplier.toFixed(2)} exitPulse=${ctx.exitPulse.toFixed(2)}`,
    `pressure=${ctx.pressure} w=${ctx.pressureWeight.toFixed(2)} phaseW=${ctx.phaseWeight.toFixed(2)}`,
    `draftCard=${ctx.draftCard.id} poolSize=${ctx.drawPool.length}`,
    `applied=${applied ? 'yes' : 'no'} cordImpact=${(input.cordImpact ?? 0).toFixed(0)}`,
  ].slice(0, 5);

  const recommendation = applied
    ? ctx.tickTier === 'CRITICAL'
      ? 'Rewrite executed under chaos pressure: lock in cashflow gains and avoid new leverage for 1–2 cycles.'
      : 'Rewrite executed: verify the new portfolio still satisfies your cash buffer and exit timing plan.'
    : ctx.tickTier === 'CRITICAL'
      ? 'Chaos pressure: do not rewrite unless it meaningfully reduces burn or increases immediate cash.'
      : 'No rewrite: wait for a clearer regime/pressure window before reshaping the portfolio.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(ctx.auditCore + ':ml:M85:' + JSON.stringify(input)),
    confidenceDecay: ctx.decayRate,
  };
}