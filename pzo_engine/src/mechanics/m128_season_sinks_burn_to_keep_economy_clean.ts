// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m128_season_sinks_burn_to_keep_economy_clean.ts
//
// Mechanic : M128 — Season Sinks: Burn to Keep Economy Clean
// Family   : cosmetics   Layer: season_runtime   Priority: 3   Batch: 3
// ML Pair  : m128a
// Deps     : M39, M19
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
export const M128_IMPORTED_SYMBOLS = {
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
 * Prevents type-import drift and keeps the full surface area reachable.
 */
export type M128_ImportedTypesAnchor = {
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

// ── Local sink/burn domain types (M128-only; intentionally not in ./types) ───

export type SinkKind = 'COSMETIC_BURN' | 'SEASON_PURGE' | 'ANTI_INFLATION';

export interface SinkConfig {
  sinkId?: string;
  kind?: SinkKind;

  /** Hard cap per burn operation (safety). */
  maxBurnPerTx?: number;

  /** Soft target ratio of currency supply to keep (0..1); burn nudges toward it. */
  supplyTargetRatio?: number;

  /** Optional minimum remaining currency after burn. */
  minRemaining?: number;

  /** Optional seed salt for deterministic receipts. */
  salt?: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M128Input {
  trophyCurrency?: number;
  sinkConfig?: SinkConfig;
  burnAmount?: number;
}

export interface M128Output {
  currencyBurned: number;
  economyCleaned: boolean;
  burnReceipt: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M128Event = 'SEASON_SINK_EXECUTED' | 'CURRENCY_BURNED' | 'ECONOMY_ADJUSTED';

export interface M128TelemetryPayload extends MechanicTelemetryPayload {
  event: M128Event;
  mechanic_id: 'M128';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M128_BOUNDS = {
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

  // burn safety caps
  MAX_BURN_PER_TX: 1_000_000_000,
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

const M128_RULES_VERSION = 'M128:v1';

function asString(v: unknown): string {
  return String(v ?? '').trim();
}

function toFiniteInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function normalizeSinkConfig(v: unknown): Required<SinkConfig> {
  const cfg = (v && typeof v === 'object') ? (v as SinkConfig) : {};
  const kind: SinkKind = (asString(cfg.kind) as SinkKind) || 'ANTI_INFLATION';

  const maxBurnPerTx = clamp(
    toFiniteInt(cfg.maxBurnPerTx, M128_BOUNDS.MAX_BURN_PER_TX),
    1,
    M128_BOUNDS.MAX_BURN_PER_TX,
  );

  const supplyTargetRatio = clamp01(
    typeof cfg.supplyTargetRatio === 'number' ? cfg.supplyTargetRatio : 0.85,
  );

  const minRemaining = clamp(toFiniteInt(cfg.minRemaining, 0), 0, M128_BOUNDS.MAX_BURN_PER_TX);

  const sinkId = asString(cfg.sinkId) || computeHash(`M128:sink:${kind}:${M128_RULES_VERSION}`).slice(0, 16);
  const salt = asString(cfg.salt) || 'sink';

  return {
    sinkId,
    kind,
    maxBurnPerTx,
    supplyTargetRatio,
    minRemaining,
    salt,
  };
}

function deriveRunPhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < RUN_TOTAL_TICKS / 3) return 'EARLY';
  if (t < (RUN_TOTAL_TICKS * 2) / 3) return 'MID';
  return 'LATE';
}

function deriveMacroRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function inChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function derivePressureTier(runPhase: RunPhase, regime: MacroRegime, chaos: boolean): PressureTier {
  if (chaos) return 'CRITICAL';
  if (regime === 'CRISIS') return runPhase === 'EARLY' ? 'HIGH' : 'CRITICAL';
  if (regime === 'BEAR') return runPhase === 'LATE' ? 'HIGH' : 'MEDIUM';
  if (regime === 'BULL') return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
  return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
}

function deriveTickTier(pressureTier: PressureTier): TickTier {
  if (pressureTier === 'CRITICAL') return 'CRITICAL';
  if (pressureTier === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function computeSuggestedBurn(params: {
  currency: number;
  targetRatio: number;
  pressureTier: PressureTier;
  macroRegime: MacroRegime;
  runPhase: RunPhase;
}): number {
  // Suggested burn nudges supply toward targetRatio; harsher macro/pressure increases suggested burn slightly.
  const c = Math.max(0, Math.trunc(params.currency));
  const targetKeep = Math.round(c * clamp01(params.targetRatio));
  const suggested = Math.max(0, c - targetKeep);

  const pW = PRESSURE_WEIGHTS[params.pressureTier] ?? 1.0;
  const rW = REGIME_WEIGHTS[params.macroRegime] ?? 1.0;
  const phW = PHASE_WEIGHTS[params.runPhase] ?? 1.0;

  // In harsh conditions, allow a slightly larger burn suggestion for cleanup.
  const harsh = clamp((pW * 0.5 + rW * 0.3 + phW * 0.2) / 2, 0.6, 1.4);
  return Math.max(0, Math.round(suggested * harsh));
}

function computeBurnReceipt(seed: string, payload: Record<string, unknown>): string {
  return computeHash(JSON.stringify({ seed, payload, v: M128_RULES_VERSION })).slice(0, 32);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * seasonSinkBurner
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function seasonSinkBurner(input: M128Input, emit: MechanicEmitter): M128Output {
  const trophyCurrency = Math.max(0, toFiniteInt(input.trophyCurrency, 0));
  const burnRequested = Math.max(0, toFiniteInt(input.burnAmount, 0));
  const sinkCfg = normalizeSinkConfig(input.sinkConfig);

  // Deterministic seed for the sink op (server-verifiable).
  const seed = computeHash(
    JSON.stringify({
      mid: 'M128',
      v: M128_RULES_VERSION,
      sinkId: sinkCfg.sinkId,
      kind: sinkCfg.kind,
      salt: sinkCfg.salt,
      trophyCurrency,
      burnRequested,
    }),
  );

  // Macro fabric (keeps shared imports live + gives “season sink” context).
  const tick = 0;
  const macroSchedule = buildMacroSchedule(seed + ':macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':chaos', CHAOS_WINDOWS_PER_RUN);

  const runPhase = deriveRunPhase(tick);
  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const chaos = inChaosWindow(tick, chaosWindows);

  const pressureTier = derivePressureTier(runPhase, macroRegime, chaos);
  const tickTier = deriveTickTier(pressureTier);

  const decay = computeDecayRate(macroRegime, M128_BOUNDS.BASE_DECAY_RATE);
  const pulseMult = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  // Bind sink behavior to macro context via weights (keeps weights + pools live).
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(seed + ':pool', pressureW * phaseW, regimeW);
  const opportunityHint = OPPORTUNITY_POOL[seededIndex(seed + ':opp', tick, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const deckHintTop = deckOrder[0] ?? DEFAULT_CARD.id;

  // Suggested burn (if caller passes 0, we use suggested).
  const suggestedBurn = computeSuggestedBurn({
    currency: trophyCurrency,
    targetRatio: sinkCfg.supplyTargetRatio,
    pressureTier,
    macroRegime,
    runPhase,
  });

  // Decide burn amount deterministically:
  // - if burnRequested > 0 => honor within caps
  // - else => use suggested within caps
  const desired = burnRequested > 0 ? burnRequested : suggestedBurn;

  // Enforce caps: maxBurnPerTx, minRemaining, available currency.
  const maxByCfg = clamp(sinkCfg.maxBurnPerTx, 1, M128_BOUNDS.MAX_BURN_PER_TX);
  const maxByCurrency = Math.max(0, trophyCurrency - sinkCfg.minRemaining);

  const currencyBurned = clamp(desired, 0, Math.min(maxByCfg, maxByCurrency));

  // Economy considered “cleaned” if burn achieves at least 80% of suggested (or if suggested is 0).
  const economyCleaned =
    suggestedBurn <= 0 ? true : currencyBurned >= Math.round(suggestedBurn * 0.8);

  const burnReceipt = computeBurnReceipt(seed, {
    sinkId: sinkCfg.sinkId,
    kind: sinkCfg.kind,
    trophyCurrency,
    burnRequested,
    suggestedBurn,
    currencyBurned,
    minRemaining: sinkCfg.minRemaining,
    maxBurnPerTx: sinkCfg.maxBurnPerTx,
    economyCleaned,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    decay,
    pulseMult,
    regimeMult,
    deckHintTop,
    opportunityHintId: opportunityHint.id,
    weightedPoolSize: weightedPool.length,
  });

  // ── Telemetry (deterministic) ───────────────────────────────────────────

  const runId = computeHash(`M128:run:${sinkCfg.sinkId}:${burnReceipt}`);

  emit({
    event: 'SEASON_SINK_EXECUTED',
    mechanic_id: 'M128',
    tick,
    runId,
    payload: {
      sinkId: sinkCfg.sinkId,
      kind: sinkCfg.kind,
      trophyCurrency,
      burnRequested,
      suggestedBurn,
      currencyBurned,
      minRemaining: sinkCfg.minRemaining,
      maxBurnPerTx: sinkCfg.maxBurnPerTx,
      economyCleaned,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decay,
      pulseMult,
      regimeMult,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      weightedPoolPreviewCount: weightedPool.length,
      burnReceipt,
    },
  });

  emit({
    event: 'CURRENCY_BURNED',
    mechanic_id: 'M128',
    tick,
    runId,
    payload: {
      sinkId: sinkCfg.sinkId,
      currencyBurned,
      postCurrency: trophyCurrency - currencyBurned,
      burnReceipt,
    },
  });

  emit({
    event: 'ECONOMY_ADJUSTED',
    mechanic_id: 'M128',
    tick,
    runId,
    payload: {
      sinkId: sinkCfg.sinkId,
      economyCleaned,
      burnReceipt,
      targetRatio: sinkCfg.supplyTargetRatio,
      decay,
    },
  });

  return {
    currencyBurned,
    economyCleaned,
    burnReceipt,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M128MLInput {
  currencyBurned?: number;
  economyCleaned?: boolean;
  burnReceipt?: string;
  runId: string;
  tick: number;
}

export interface M128MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * seasonSinkBurnerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function seasonSinkBurnerMLCompanion(input: M128MLInput): Promise<M128MLOutput> {
  const tick = clamp(typeof input.tick === 'number' ? input.tick : Number(input.tick), 0, RUN_TOTAL_TICKS);

  const burned = Math.max(0, toFiniteInt(input.currencyBurned, 0));
  const cleaned = Boolean(input.economyCleaned);
  const receipt = asString(input.burnReceipt);

  const burnScore = clamp(burned / 50_000, 0, 1) * 0.35;
  const cleanedScore = cleaned ? 0.30 : 0.0;
  const receiptScore = receipt.length ? 0.20 : 0.0;

  const score = clamp(0.05 + burnScore + cleanedScore + receiptScore, 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(`Burned: ${burned}`);
  topFactors.push(cleaned ? 'Economy cleaned' : 'Economy not cleaned');
  topFactors.push(receipt.length ? 'Receipt present' : 'No receipt');
  topFactors.push(`Tick: ${tick}`);
  topFactors.push('Season sink executed');

  const recommendation =
    cleaned && receipt.length
      ? 'Persist burnReceipt + burned amount to the ledger and expose receipt in season audit UI.'
      : 'Do not finalize sink until receipt is present and burn amount is within policy caps.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + `:ml:M128:${tick}:${M128_RULES_VERSION}`),
    confidenceDecay: 0.05,
  };
}