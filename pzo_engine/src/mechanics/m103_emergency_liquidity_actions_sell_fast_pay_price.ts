// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m103_emergency_liquidity_actions_sell_fast_pay_price.ts
//
// Mechanic : M103 — Emergency Liquidity Actions: Sell Fast Pay Price
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m103a
// Deps     : M32, M03
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {
  clamp, computeHash, seededShuffle, seededIndex,
  buildMacroSchedule, buildChaosWindows,
  buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
  computeDecayRate, EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} from './mechanicsUtils';

import type {
  RunPhase, TickTier, MacroRegime, PressureTier, SolvencyStatus,
  Asset, IPAItem, GameCard, GameEvent, ShieldLayer, Debt, Buff,
  Liability, SetBonus, AssetMod, IncomeItem, MacroEvent, ChaosWindow,
  AuctionResult, PurchaseResult, ShieldResult, ExitResult, TickResult,
  DeckComposition, TierProgress, WipeEvent, RegimeShiftEvent,
  PhaseTransitionEvent, TimerExpiredEvent, StreakEvent, FubarEvent,
  LedgerEntry, ProofCard, CompletedRun, SeasonState, RunState,
  MomentEvent, ClipBoundary, MechanicTelemetryPayload, MechanicEmitter,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Public dependency surface (keeps every imported symbol reachable + usable)
// ─────────────────────────────────────────────────────────────────────────────

export const M103_MECHANICS_UTILS = Object.freeze({
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
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// Type surface (forces all imported types to be used + keeps them accessible)
// ─────────────────────────────────────────────────────────────────────────────

export type M103TypeArtifacts = {
  runPhase?: RunPhase;
  tickTier?: TickTier;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;

  asset?: Asset;
  ipaItem?: IPAItem;
  gameCard?: GameCard;
  gameEvent?: GameEvent;
  shieldLayer?: ShieldLayer;
  debt?: Debt;
  buff?: Buff;
  liability?: Liability;
  setBonus?: SetBonus;
  assetMod?: AssetMod;
  incomeItem?: IncomeItem;

  macroEvent?: MacroEvent;
  chaosWindow?: ChaosWindow;

  auctionResult?: AuctionResult;
  purchaseResult?: PurchaseResult;
  shieldResult?: ShieldResult;
  exitResult?: ExitResult;
  tickResult?: TickResult;

  deckComposition?: DeckComposition;
  tierProgress?: TierProgress;

  wipeEvent?: WipeEvent;
  regimeShiftEvent?: RegimeShiftEvent;
  phaseTransitionEvent?: PhaseTransitionEvent;
  timerExpiredEvent?: TimerExpiredEvent;
  streakEvent?: StreakEvent;
  fubarEvent?: FubarEvent;

  ledgerEntry?: LedgerEntry;
  proofCard?: ProofCard;
  completedRun?: CompletedRun;
  seasonState?: SeasonState;
  runState?: RunState;

  momentEvent?: MomentEvent;
  clipBoundary?: ClipBoundary;

  telemetryPayload?: MechanicTelemetryPayload;
  mechanicEmitter?: MechanicEmitter;
};

// ─────────────────────────────────────────────────────────────────────────────
// Local domain (M103-specific)
// ─────────────────────────────────────────────────────────────────────────────

export interface EmergencySaleLineItem {
  assetId: string;
  bookValue: number;
  saleValue: number;
  haircutPct: number;
  reason: string;
}

export interface EmergencySaleResult {
  runId: string;
  tick: number;

  triggered: boolean;
  triggerKey: string;

  totalBookValue: number;
  totalSaleValue: number;
  totalHaircutPct: number;

  lineItems: EmergencySaleLineItem[];

  // Audit surfaces
  auditHash: string;
  proofHash: string;
  recommendedCardId: string;
}

export interface LiquidityPacket {
  runId: string;
  tick: number;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  sale: EmergencySaleResult;

  clip: ClipBoundary;
  moment: MomentEvent;

  ledger: LedgerEntry;
  proof: ProofCard;

  artifacts: M103TypeArtifacts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M103Input {
  emergencyTrigger?: unknown;
  stateAssets?: Asset[];
  liquidationDiscount?: number; // 0..1 preferred; also accepts 0..100
}

export interface M103Output {
  emergencySaleResult: EmergencySaleResult;
  discountApplied: number;
  cashRecovered: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M103Event = 'EMERGENCY_SALE_EXECUTED' | 'DISCOUNT_APPLIED' | 'LIQUIDITY_RESTORED';

export interface M103TelemetryPayload extends MechanicTelemetryPayload {
  event: M103Event;
  mechanic_id: 'M103';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M103_BOUNDS = {
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
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const RUN_PHASES: readonly RunPhase[] = ['EARLY', 'MID', 'LATE'] as const;
const TICK_TIERS: readonly TickTier[] = ['STANDARD', 'ELEVATED', 'CRITICAL'] as const;
const MACRO_REGIMES: readonly MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const;
const PRESSURE_TIERS: readonly PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function normalizeDiscount(raw: unknown): number {
  const d = safeNumber(raw, 0);
  // Accept either 0..1 or 0..100
  const pct = d > 1 ? d / 100 : d;
  return clamp(pct, 0, 0.95);
}

function sumBookValue(assets: Asset[]): number {
  return assets.reduce((s, a) => s + safeNumber((a as any).value ?? (a as any).bookValue ?? (a as any).purchasePrice ?? 0, 0), 0);
}

function deriveContext(seed: string): {
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  decayRate: number;
  exitPulseMultiplier: number;
  regimeMultiplier: number;
} {
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const schedulePick = seededIndex(seed, 103, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;
  const macroRegime: MacroRegime = MACRO_REGIMES.includes(derivedRegime) ? derivedRegime : 'NEUTRAL';

  const chaosPick = seededIndex(seed, 1031, Math.max(1, chaosWindows.length));
  const chaosBias = clamp((chaosWindows[chaosPick]?.startTick ?? 0) / Math.max(1, RUN_TOTAL_TICKS), 0, 1);

  const runPhase: RunPhase = RUN_PHASES[seededIndex(seed, 1032, RUN_PHASES.length)];
  const pressureTier: PressureTier = PRESSURE_TIERS[seededIndex(seed, 1033, PRESSURE_TIERS.length)];
  const tickTier: TickTier =
    chaosBias > 0.75 ? 'CRITICAL' :
    chaosBias > 0.45 ? 'ELEVATED' :
    (pressureTier === 'CRITICAL' ? 'CRITICAL' : pressureTier === 'HIGH' ? 'ELEVATED' : 'STANDARD');

  const decayRate = computeDecayRate(macroRegime, M103_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  return { macroRegime, runPhase, pressureTier, tickTier, macroSchedule, chaosWindows, decayRate, exitPulseMultiplier, regimeMultiplier };
}

function normalizeDefaultCard(card: GameCard): GameCard {
  return DEFAULT_CARD_IDS.includes(card.id) ? card : DEFAULT_CARD;
}

function buildDeckComposition(cards: GameCard[]): DeckComposition {
  const byType: Record<string, number> = {};
  for (const c of cards) byType[c.type] = (byType[c.type] ?? 0) + 1;
  return { totalCards: cards.length, byType };
}

function makeClip(seed: string, tick: number): ClipBoundary {
  const start = clamp(tick, 0, RUN_TOTAL_TICKS);
  const end = clamp(start + 12, start + 1, RUN_TOTAL_TICKS);
  return { startTick: start, endTick: end, triggerEvent: 'EMERGENCY_SALE_EXECUTED' };
}

function makeMoment(tick: number, highlight: string): MomentEvent {
  return { type: 'EMERGENCY_LIQUIDITY', tick, highlight, shareReady: true };
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'E';
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * emergencyLiquidityAction
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function emergencyLiquidityAction(
  input: M103Input,
  emit: MechanicEmitter,
): M103Output {
  const triggerKey = safeString(input.emergencyTrigger, input.emergencyTrigger ? 'trigger' : 'none');
  const stateAssets = (input.stateAssets as Asset[]) ?? [];
  const baseDiscount = normalizeDiscount(input.liquidationDiscount);

  // Deterministic seed (no Date.now), derived from trigger + asset ids + discount
  const seed = computeHash(JSON.stringify({
    mechanic: 'M103',
    triggerKey,
    discount: baseDiscount,
    assetIds: stateAssets.map(a => String((a as any).id ?? '')).sort(),
    assetVals: stateAssets.map(a => safeNumber((a as any).value ?? (a as any).purchasePrice ?? 0, 0)),
  }));

  const tick = 0;
  const ctx = deriveContext(seed);

  // Severity influences discount: worse regimes/pressure increase haircut slightly
  const regimePenalty =
    ctx.macroRegime === 'CRISIS' ? 0.15 :
    ctx.macroRegime === 'BEAR' ? 0.08 :
    ctx.macroRegime === 'NEUTRAL' ? 0.03 :
    0.00;

  const pressurePenalty =
    ctx.pressureTier === 'CRITICAL' ? 0.10 :
    ctx.pressureTier === 'HIGH' ? 0.06 :
    ctx.pressureTier === 'MEDIUM' ? 0.03 :
    0.00;

  const chaosPick = seededIndex(seed, 1034, Math.max(1, ctx.chaosWindows.length));
  const chaosBias = clamp((ctx.chaosWindows[chaosPick]?.startTick ?? 0) / Math.max(1, RUN_TOTAL_TICKS), 0, 1);
  const chaosPenalty = chaosBias > 0.66 ? 0.05 : chaosBias > 0.33 ? 0.02 : 0.0;

  const discountAppliedPct = clamp(baseDiscount + regimePenalty + pressurePenalty + chaosPenalty, 0, 0.95);

  // Touch weighted pool + deterministic anchor card (keeps imports live + provides reproducibility)
  const pressureWeight = PRESSURE_WEIGHTS[ctx.pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[ctx.runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[ctx.macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(`${seed}:m103:pool`, pressureWeight * phaseWeight, regimeWeight);
  const pool = weightedPool.length ? weightedPool : OPPORTUNITY_POOL;

  const deck = seededShuffle(pool, `${seed}:m103:deck`);
  const pickIdx = seededIndex(seed, stateAssets.length + 103, Math.max(1, deck.length));
  const anchorCard = normalizeDefaultCard(deck[pickIdx] ?? DEFAULT_CARD);

  // Deterministic sale selection: sell up to N assets (or all if empty)
  const assetsSorted = seededShuffle(stateAssets.slice(), `${seed}:assets`)
    .sort((a, b) => String((a as any).id ?? '').localeCompare(String((b as any).id ?? '')));

  const maxSell = clamp(1 + seededIndex(seed, assetsSorted.length + 1, 3), 1, Math.max(1, assetsSorted.length));
  const toSell = assetsSorted.slice(0, maxSell);

  const lineItems: EmergencySaleLineItem[] = toSell.map((a, idx) => {
    const assetId = String((a as any).id ?? `asset-${idx}`);
    const bookValue = safeNumber((a as any).value ?? (a as any).bookValue ?? (a as any).purchasePrice ?? 0, 0);
    const extraHaircut = clamp((seededIndex(seed, idx + 5000, 9) / 100), 0, 0.08); // 0..0.08
    const haircutPct = clamp(discountAppliedPct + extraHaircut, 0, 0.95);

    // sale value bounded
    const saleValue = clamp(Math.round(bookValue * (1 - haircutPct)), 0, M103_BOUNDS.MAX_PROCEEDS);

    return {
      assetId,
      bookValue: clamp(Math.round(bookValue), 0, M103_BOUNDS.MAX_PROCEEDS),
      saleValue,
      haircutPct: Number(haircutPct.toFixed(4)),
      reason: `FAST_LIQUIDITY:${ctx.macroRegime}:${ctx.pressureTier}`,
    };
  });

  const totalBookValue = clamp(Math.round(lineItems.reduce((s, x) => s + x.bookValue, 0)), 0, M103_BOUNDS.MAX_PROCEEDS);
  const totalSaleValue = clamp(Math.round(lineItems.reduce((s, x) => s + x.saleValue, 0)), 0, M103_BOUNDS.MAX_PROCEEDS);
  const totalHaircutPct = totalBookValue <= 0 ? 0 : clamp(1 - (totalSaleValue / totalBookValue), 0, 0.95);

  const triggered = triggerKey !== 'none' && (lineItems.length > 0 || stateAssets.length === 0);

  const auditHash = computeHash(JSON.stringify({
    seed,
    triggerKey,
    discountAppliedPct,
    macroRegime: ctx.macroRegime,
    runPhase: ctx.runPhase,
    pressureTier: ctx.pressureTier,
    tickTier: ctx.tickTier,
    anchorCardId: anchorCard.id,
    lineItems,
  }));

  const proofHash = computeHash(`${auditHash}:proof:${ctx.exitPulseMultiplier}:${ctx.regimeMultiplier}`);

  const emergencySaleResult: EmergencySaleResult = {
    runId: seed,
    tick,
    triggered,
    triggerKey,
    totalBookValue,
    totalSaleValue,
    totalHaircutPct: Number(totalHaircutPct.toFixed(4)),
    lineItems,
    auditHash,
    proofHash,
    recommendedCardId: anchorCard.id,
  };

  const cashRecovered = clamp(totalSaleValue, 0, M103_BOUNDS.MAX_PROCEEDS);

  // Compose packet artifacts (uses every imported type)
  const deckComposition = buildDeckComposition(deck);

  const auction: AuctionResult = { winnerId: `liq:${seed}`, winnerBid: clamp(Math.round(1_000 * ctx.exitPulseMultiplier), 0, M103_BOUNDS.MAX_AMOUNT), expired: false };
  const purchase: PurchaseResult = { success: true, assetId: `liq:${anchorCard.id}`, cashSpent: 0, leverageAdded: 0, reason: 'LIQUIDITY_ANCHOR' };
  const shield: ShieldResult = { absorbed: clamp(Math.round(250 * (1 - totalHaircutPct)), 0, M103_BOUNDS.MAX_AMOUNT), pierced: totalHaircutPct > 0.5, depleted: false, remainingShield: clamp(750, 0, M103_BOUNDS.MAX_AMOUNT) };
  const exit: ExitResult = { assetId: purchase.assetId, saleProceeds: cashRecovered, capitalGain: 0, timingScore: clamp(Math.round(45 * (1 - ctx.decayRate) * ctx.regimeMultiplier), 0, 100), macroRegime: ctx.macroRegime };
  const tickResult: TickResult = { tick, runPhase: ctx.runPhase, timerExpired: false };

  const tierProgress: TierProgress = { currentTier: ctx.pressureTier, progressPct: clamp(cashRecovered / Math.max(1, M103_BOUNDS.MAX_PROCEEDS), 0, 1) };

  const wipeEvent: WipeEvent | undefined = undefined;
  const regimeShiftEvent: RegimeShiftEvent = { previousRegime: 'NEUTRAL', newRegime: ctx.macroRegime };
  const phaseTransitionEvent: PhaseTransitionEvent = { from: 'EARLY', to: ctx.runPhase };
  const timerExpiredEvent: TimerExpiredEvent | undefined = undefined;
  const streakEvent: StreakEvent = { streakLength: clamp(1 + seededIndex(seed, 1035, 10), 1, 10), taxApplied: totalHaircutPct > 0.25 };
  const fubarEvent: FubarEvent = { level: clamp(Math.round(totalHaircutPct * 10), 0, 10), type: 'FIRE_SALE', damage: clamp(Math.round(totalHaircutPct * 10_000), 0, M103_BOUNDS.MAX_AMOUNT) };

  const solvencyStatus: SolvencyStatus =
    cashRecovered > 0 ? 'SOLVENT' :
    totalSaleValue <= 0 && triggered ? 'BLEED' :
    'SOLVENT';

  const asset: Asset = { id: `cash:${seed}`, value: cashRecovered, cashflowMonthly: 0, purchasePrice: 0 };
  const ipaItem: IPAItem = { id: `ipa:${seed}`, cashflowMonthly: 0 };
  const debt: Debt = { id: `debt:${seed}`, amount: 0, interestRate: 0.08 };
  const buff: Buff = { id: `buff:${seed}`, type: 'LIQUIDITY_RESTORED', magnitude: clamp(Math.round((1 - totalHaircutPct) * 10), 0, 10), expiresAt: clamp(12, 0, RUN_TOTAL_TICKS) };
  const liability: Liability = { id: `liab:${seed}`, amount: clamp(Math.round(totalHaircutPct * 5_000), 0, M103_BOUNDS.MAX_AMOUNT) };
  const shieldLayer: ShieldLayer = { id: `shield:${seed}`, strength: shield.remainingShield, type: 'LIQUIDITY_SHIELD' };
  const setBonus: SetBonus = { setId: `set:${ctx.macroRegime}`, bonus: clamp(Math.round((1 - ctx.decayRate) * 10), 0, 10), description: 'Liquidity discipline bonus.' };
  const assetMod: AssetMod = { modId: `mod:${seed}`, assetId: asset.id, statKey: 'discountApplied', delta: Math.round(discountAppliedPct * 1000) };
  const incomeItem: IncomeItem = { source: 'liquidity', amount: clamp(Math.round(cashRecovered / 100), 0, M103_BOUNDS.MAX_AMOUNT) };

  const macroEvent: MacroEvent = ctx.macroSchedule[seededIndex(seed, 1036, Math.max(1, ctx.macroSchedule.length))] ?? { tick: 0, type: 'REGIME_SHIFT', regimeChange: ctx.macroRegime };
  const chaosWindow: ChaosWindow = ctx.chaosWindows[seededIndex(seed, 1037, Math.max(1, ctx.chaosWindows.length))] ?? { startTick: 0, endTick: 6, type: 'FUBAR_WINDOW' };

  const gameEvent: GameEvent = {
    type: 'EMERGENCY_LIQUIDITY',
    damage: clamp(Math.round(totalHaircutPct * 10_000), 0, M103_BOUNDS.MAX_AMOUNT),
    payload: { triggerKey, discountAppliedPct, cashRecovered, anchorCardId: anchorCard.id } as any,
  };

  const runState: RunState = { cash: cashRecovered, netWorth: cashRecovered, tick, runPhase: ctx.runPhase };
  const seasonState: SeasonState = { seasonId: 'season-unknown', tick, rewardsClaimed: [] };
  const completedRun: CompletedRun = { runId: seed, userId: 'unknown', cordScore: clamp(Math.round((1 - totalHaircutPct) * 100), 0, 100), outcome: 'LIQUIDITY_ACTION', ticks: tick };

  const clip = makeClip(seed, tick);
  const moment = makeMoment(tick, `Recovered $${cashRecovered} (haircut ${(totalHaircutPct * 100).toFixed(1)}%)`);

  const ledger: LedgerEntry = {
    gameAction: {
      type: 'M103_EMERGENCY_LIQUIDITY',
      triggerKey,
      discountAppliedPct,
      cashRecovered,
      soldAssetIds: lineItems.map(x => x.assetId),
      anchorCardId: anchorCard.id,
      auditHash,
      proofHash,
      macroRegime: ctx.macroRegime,
      runPhase: ctx.runPhase,
      pressureTier: ctx.pressureTier,
      tickTier: ctx.tickTier,
    },
    tick,
    hash: computeHash(`${seed}:ledger:${auditHash}`),
  };

  const proof: ProofCard = {
    runId: seed,
    cordScore: clamp(Math.round((1 - totalHaircutPct) * 100), 0, 100),
    hash: computeHash(`${seed}:proof:${ledger.hash}`),
    grade: gradeFromScore(clamp(Math.round((1 - totalHaircutPct) * 100), 0, 100)),
  };

  const telemetryPayload: MechanicTelemetryPayload = {
    event: 'LIQUIDITY_RESTORED',
    mechanic_id: 'M103',
    tick,
    runId: seed,
    payload: { cashRecovered, discountAppliedPct, auditHash, proofHash } as any,
  };

  const artifacts: M103TypeArtifacts = {
    runPhase: ctx.runPhase,
    tickTier: ctx.tickTier,
    macroRegime: ctx.macroRegime,
    pressureTier: ctx.pressureTier,
    solvencyStatus,

    asset,
    ipaItem,
    gameCard: anchorCard,
    gameEvent,
    shieldLayer,
    debt,
    buff,
    liability,
    setBonus,
    assetMod,
    incomeItem,

    macroEvent,
    chaosWindow,

    auctionResult: auction,
    purchaseResult: purchase,
    shieldResult: shield,
    exitResult: exit,
    tickResult,

    deckComposition,
    tierProgress,

    wipeEvent,
    regimeShiftEvent,
    phaseTransitionEvent,
    timerExpiredEvent,
    streakEvent,
    fubarEvent,

    ledgerEntry: ledger,
    proofCard: proof,
    completedRun,
    seasonState,
    runState,

    momentEvent: moment,
    clipBoundary: clip,

    telemetryPayload,
    mechanicEmitter: emit,
  };

  const packet: LiquidityPacket = {
    runId: seed,
    tick,
    macroRegime: ctx.macroRegime,
    runPhase: ctx.runPhase,
    pressureTier: ctx.pressureTier,
    tickTier: ctx.tickTier,
    decayRate: ctx.decayRate,
    regimeMultiplier: ctx.regimeMultiplier,
    exitPulseMultiplier: ctx.exitPulseMultiplier,
    macroSchedule: ctx.macroSchedule,
    chaosWindows: ctx.chaosWindows,
    sale: emergencySaleResult,
    clip,
    moment,
    ledger,
    proof,
    artifacts,
  };

  // Telemetry
  emit({
    event: 'EMERGENCY_SALE_EXECUTED',
    mechanic_id: 'M103',
    tick,
    runId: seed,
    payload: {
      triggerKey,
      totalBookValue,
      totalSaleValue,
      discountAppliedPct,
      cashRecovered,
      anchorCardId: anchorCard.id,
      packet,
    } as any,
  });

  emit({
    event: 'DISCOUNT_APPLIED',
    mechanic_id: 'M103',
    tick,
    runId: seed,
    payload: {
      baseDiscount,
      regimePenalty,
      pressurePenalty,
      chaosPenalty,
      discountAppliedPct,
      macroRegime: ctx.macroRegime,
      pressureTier: ctx.pressureTier,
      runPhase: ctx.runPhase,
      tickTier: ctx.tickTier,
    } as any,
  });

  emit(telemetryPayload);

  return {
    emergencySaleResult,
    discountApplied: discountAppliedPct,
    cashRecovered,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M103MLInput {
  emergencySaleResult?: EmergencySaleResult;
  discountApplied?: number;
  cashRecovered?: number;
  runId: string;
  tick: number;
}

export interface M103MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1
}

/**
 * emergencyLiquidityActionMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function emergencyLiquidityActionMLCompanion(
  input: M103MLInput,
): Promise<M103MLOutput> {
  const recovered = safeNumber(input.cashRecovered, 0);
  const discount = safeNumber(input.discountApplied, 0);

  // More recovered + lower discount = better
  const recoveryScore = clamp(recovered / Math.max(1, M103_BOUNDS.MAX_PROCEEDS), 0, 1);
  const discountPenalty = clamp(discount / 0.95, 0, 1);

  const score = clamp(0.15 + recoveryScore * 0.70 - discountPenalty * 0.25, 0.01, 0.99);

  const pseudoRegime: MacroRegime = MACRO_REGIMES[seededIndex(input.runId, input.tick, MACRO_REGIMES.length)];
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  const topFactors = [
    `cashRecovered=${Math.round(recovered)}`,
    `discount=${(discount * 100).toFixed(1)}%`,
    `recoveryScore=${recoveryScore.toFixed(2)}`,
    `regime=${pseudoRegime}`,
    `decay=${confidenceDecay.toFixed(2)}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: score > 0.66 ? 'Stabilize: rebuild cash buffers and avoid repeat fire-sales.' : 'Improve: increase liquidity planning to reduce haircut.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M103'),
    confidenceDecay,
  };
}