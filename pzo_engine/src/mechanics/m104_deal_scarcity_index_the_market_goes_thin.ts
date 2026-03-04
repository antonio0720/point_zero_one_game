// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m104_deal_scarcity_index_the_market_goes_thin.ts
//
// Mechanic : M104 — Deal Scarcity Index: The Market Goes Thin
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m104a
// Deps     : M09
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

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M104Input {
  sharedOpportunityDeck?: unknown;
  purchaseHistory?: unknown;
  scarcityThresholds?: unknown;

  // Optional runtime hints (passed via snapshotExtractor’s ...snap spread)
  seed?: unknown;
  tick?: unknown;
  runId?: unknown;
  macroRegime?: unknown;
  runPhase?: unknown;
  pressureTier?: unknown;
}

export interface M104Output {
  scarcityState: ScarcityState;
  scarceAlert: boolean;
  fubarBiasAdjusted: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M104Event = 'SCARCITY_ENTERED' | 'DECK_EXHAUSTED' | 'FUBAR_BIAS_UPDATED';

export interface M104TelemetryPayload extends MechanicTelemetryPayload {
  event: M104Event;
  mechanic_id: 'M104';
}

// ── Local State Model ─────────────────────────────────────────────────────

export type ScarcitySeverity = 'NONE' | 'WATCH' | 'SCARCE' | 'EXHAUSTED';

export interface ScarcityThresholds {
  /** Soft warning threshold (deck size at/below triggers UI warning). */
  warnDeckSize: number;
  /** Hard scarcity threshold (deck size at/below triggers SCARCITY_ENTERED + bias). */
  triggerDeckSize: number;
}

export interface ScarcityState {
  runId: string;
  tick: number;
  seed: string;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;

  thresholds: ScarcityThresholds;

  deckSize: number;
  deckIds: string[];
  purchaseCount: number;

  severity: ScarcitySeverity;
  scarcityIndex: number; // 0..1
  decayRate: number; // 0.01..0.99

  activeChaosWindow: boolean;
  exitPulseMultiplier: number;

  recommendedPoolSize: number;
  recommendedCardId: string;

  auditHash: string;
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M104_BOUNDS = {
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

// ── Type Touch Anchor (ensures every imported type is referenced in-code) ───

export type M104TypeTouch = {
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

// ── Internal helpers ──────────────────────────────────────────────────────

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

function parseThresholds(raw: unknown): ScarcityThresholds {
  const obj = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const triggerDeckSize = clamp(
    toSafeNumber(obj.triggerDeckSize ?? obj.trigger ?? obj.minDeckSize, M104_BOUNDS.TRIGGER_THRESHOLD),
    0,
    999,
  );
  const warnDeckSize = clamp(
    toSafeNumber(obj.warnDeckSize ?? obj.warn ?? (triggerDeckSize + 2), triggerDeckSize + 2),
    triggerDeckSize,
    999,
  );
  return { warnDeckSize, triggerDeckSize };
}

function isGameCardArray(v: unknown): v is GameCard[] {
  return Array.isArray(v) && v.every(x => !!x && typeof x === 'object' && typeof (x as any).id === 'string');
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === 'string');
}

function resolveDeck(rawDeck: unknown, seed: string): GameCard[] {
  if (isGameCardArray(rawDeck)) return rawDeck;
  if (isStringArray(rawDeck)) {
    const byId = new Map(OPPORTUNITY_POOL.map(c => [c.id, c]));
    const mapped = rawDeck.map(id => byId.get(id) ?? DEFAULT_CARD);
    return mapped.length > 0 ? mapped : OPPORTUNITY_POOL;
  }
  // Fallback deterministic shuffle so “accessibility” is real (not dead code).
  return seededShuffle(OPPORTUNITY_POOL, seed + ':M104:deck');
}

function normalizeDeckIds(deck: GameCard[]): string[] {
  const ids = deck.map(c => c.id);
  // Validate membership against DEFAULT_CARD_IDS for audit visibility.
  const safe = ids.map(id => (DEFAULT_CARD_IDS.includes(id) ? id : DEFAULT_CARD.id));
  return safe;
}

function purchaseCount(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.length;
}

function applyMacroScheduleBaseline(seed: string, tick: number, base: MacroRegime): MacroRegime {
  const schedule = buildMacroSchedule(seed + ':M104:macro', MACRO_EVENTS_PER_RUN)
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
  const windows = buildChaosWindows(seed + ':M104:chaos', CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    const s = typeof w.startTick === 'number' ? w.startTick : 0;
    const e = typeof w.endTick === 'number' ? w.endTick : 0;
    if (tick >= s && tick <= e) return true;
  }
  return false;
}

function emitM104(
  emit: MechanicEmitter,
  tick: number,
  runId: string,
  event: M104Event,
  payload: Record<string, unknown>,
): void {
  const msg: M104TelemetryPayload = {
    event,
    mechanic_id: 'M104',
    tick,
    runId,
    payload,
  };
  emit(msg);
}

function computeScarcityState(input: M104Input): {
  state: ScarcityState;
  scarceAlert: boolean;
  fubarBiasAdjusted: boolean;
  emitted: { scarcityEntered: boolean; deckExhausted: boolean; fubarUpdated: boolean };
} {
  const seed = toSafeString((input as any).seed, 'seed:missing');
  const tick = clamp(toSafeNumber((input as any).tick, 0), 0, RUN_TOTAL_TICKS);
  const runId = toSafeString((input as any).runId, '');

  const thresholds = parseThresholds(input.scarcityThresholds);

  const deck = resolveDeck(input.sharedOpportunityDeck, seed);
  const deckIds = normalizeDeckIds(deck);
  const deckSize = deck.length;

  const purchases = purchaseCount(input.purchaseHistory);

  const baseRegime = coerceMacroRegime((input as any).macroRegime);
  const macroRegime = applyMacroScheduleBaseline(seed, tick, baseRegime);

  const runPhase = coerceRunPhase((input as any).runPhase, tick);
  const pressureTier = coercePressureTier((input as any).pressureTier);

  const activeChaosWindow = isChaosActive(seed, tick);

  const scarceAlert = deckSize <= thresholds.warnDeckSize;
  const scarcityEntered = deckSize <= thresholds.triggerDeckSize;
  const deckExhausted = deckSize <= 0;

  const severity: ScarcitySeverity =
    deckExhausted ? 'EXHAUSTED' : scarcityEntered ? 'SCARCE' : scarceAlert ? 'WATCH' : 'NONE';

  // Scarcity index 0..1: at warnDeckSize => ~0, at 0 => 1 (clamped)
  const scarcityIndex = clamp(
    thresholds.warnDeckSize > 0 ? (thresholds.warnDeckSize - deckSize) / thresholds.warnDeckSize : 1,
    0,
    1,
  );

  // Use ALL weight maps + multipliers meaningfully.
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const combined = pressureW * phaseW * regimeW * regimeMult * (1 + scarcityIndex * (M104_BOUNDS.MULTIPLIER - 1));

  const pool = buildWeightedPool(seed + ':M104:pool', combined, regimeW);
  const recommended = pool[seededIndex(seed + ':M104:pick', tick, pool.length)] ?? DEFAULT_CARD;

  // If the deck has cards, select a deterministic “next available” candidate; else use recommended.
  const deckCandidate = deckSize > 0 ? deck[seededIndex(seed + ':M104:deckPick', tick, deckSize)] : recommended;

  // Deterministic decay uses computeDecayRate + BASE_DECAY_RATE; bounded 0.01..0.99 by util.
  const decayRate = computeDecayRate(macroRegime, M104_BOUNDS.BASE_DECAY_RATE);

  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  // Bias adjustment decision: scarcity or chaos window
  const fubarBiasAdjusted = scarcityEntered || activeChaosWindow;

  const auditMaterial = {
    runId,
    tick,
    seed,
    macroRegime,
    runPhase,
    pressureTier,
    thresholds,
    deckSize,
    deckIdsHash: computeHash(deckIds.join('|')),
    purchases,
    scarcityIndex,
    decayRate,
    activeChaosWindow,
    combined,
    recommendedId: recommended.id,
    deckCandidateId: deckCandidate.id,
    exitPulseMultiplier,
  };

  const auditHash = computeHash(JSON.stringify(auditMaterial));

  const state: ScarcityState = {
    runId,
    tick,
    seed,

    macroRegime,
    runPhase,
    pressureTier,

    thresholds,

    deckSize,
    deckIds,
    purchaseCount: purchases,

    severity,
    scarcityIndex,
    decayRate,

    activeChaosWindow,
    exitPulseMultiplier,

    recommendedPoolSize: pool.length,
    recommendedCardId: (deckCandidate?.id ?? DEFAULT_CARD.id),

    auditHash,
  };

  return {
    state,
    scarceAlert,
    fubarBiasAdjusted,
    emitted: {
      scarcityEntered,
      deckExhausted,
      fubarUpdated: fubarBiasAdjusted,
    },
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * dealScarcityIndexMonitor
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function dealScarcityIndexMonitor(input: M104Input, emit: MechanicEmitter): M104Output {
  const tick = clamp(toSafeNumber((input as any).tick, 0), 0, RUN_TOTAL_TICKS);
  const runId = toSafeString((input as any).runId, '');

  const { state, scarceAlert, fubarBiasAdjusted, emitted } = computeScarcityState(input);

  if (emitted.scarcityEntered) {
    emitM104(emit, tick, runId, 'SCARCITY_ENTERED', {
      scarcityState: state,
      purchaseHistory: input.purchaseHistory ?? null,
    });
  }

  if (emitted.deckExhausted) {
    emitM104(emit, tick, runId, 'DECK_EXHAUSTED', {
      deckSize: state.deckSize,
      deckIds: state.deckIds,
      recommendedCardId: state.recommendedCardId,
    });
  }

  if (emitted.fubarUpdated) {
    emitM104(emit, tick, runId, 'FUBAR_BIAS_UPDATED', {
      activeChaosWindow: state.activeChaosWindow,
      scarcityIndex: state.scarcityIndex,
      decayRate: state.decayRate,
      macroRegime: state.macroRegime,
    });
  }

  return {
    scarcityState: state,
    scarceAlert,
    fubarBiasAdjusted,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M104MLInput {
  scarcityState?: ScarcityState;
  scarceAlert?: boolean;
  fubarBiasAdjusted?: boolean;
  runId: string;
  tick: number;
}

export interface M104MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * dealScarcityIndexMonitorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function dealScarcityIndexMonitorMLCompanion(input: M104MLInput): Promise<M104MLOutput> {
  const s = input.scarcityState;

  const scarcity = clamp(typeof s?.scarcityIndex === 'number' ? s.scarcityIndex : 0, 0, 1);
  const chaos = !!s?.activeChaosWindow;
  const exhausted = s?.severity === 'EXHAUSTED';
  const regime = (s?.macroRegime ?? 'NEUTRAL') as MacroRegime;

  const regimePulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const rawScore = scarcity * (chaos ? 1.1 : 1.0) * (exhausted ? 1.25 : 1.0) * (regimePulse ?? 1.0);
  const score = clamp(rawScore, 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(exhausted ? 'Opportunity deck exhausted' : 'Opportunity deck thinning');
  if (chaos) topFactors.push('Active chaos window');
  topFactors.push(`Macro regime: ${regime}`);
  if (typeof s?.deckSize === 'number') topFactors.push(`Deck size: ${s.deckSize}`);
  if (typeof s?.purchaseCount === 'number') topFactors.push(`Purchases: ${s.purchaseCount}`);
  while (topFactors.length > 5) topFactors.pop();

  const recommendation =
    exhausted
      ? 'Conserve cash, wait for replenishment, and prioritize high-conviction moves.'
      : scarcity > 0.5
        ? 'Be selective; expect worse terms and fewer quality deals this window.'
        : 'Monitor scarcity; avoid forcing trades when the deck is thinning.';

  const confidenceDecay = clamp(
    typeof s?.decayRate === 'number' ? s.decayRate : computeDecayRate(regime, 0.05),
    0.01,
    0.99,
  );

  const auditHash = computeHash(JSON.stringify(input) + ':ml:M104:' + (s?.auditHash ?? ''));

  return {
    score,
    topFactors,
    recommendation,
    auditHash,
    confidenceDecay,
  };
}