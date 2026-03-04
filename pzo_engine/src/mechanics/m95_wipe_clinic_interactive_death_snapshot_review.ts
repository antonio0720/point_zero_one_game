// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m95_wipe_clinic_interactive_death_snapshot_review.ts
//
// Mechanic : M95 — Wipe Clinic: Interactive Death-Snapshot Review
// Family   : onboarding_expert   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m95a
// Deps     : M03, M74
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

export const M95_MECHANICS_UTILS = Object.freeze({
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

export type M95TypeArtifacts = {
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
// Local models (M95-specific, JSON-safe, deterministic)
// ─────────────────────────────────────────────────────────────────────────────

export type RootCauseKey =
  | 'CASH_BLEED'
  | 'OVERLEVERAGE'
  | 'MISSED_EXIT'
  | 'FUBAR_CHAIN'
  | 'SHIELD_FAILURE'
  | 'TIMER_PANIC'
  | 'STREAK_TAX_SPIRAL'
  | 'UNKNOWN';

export interface FailureSnapshot {
  runState: RunState;
  wipe: WipeEvent;

  // Optional context artifacts (all deterministic snapshots)
  recentEvents?: GameEvent[];
  ledgerTail?: LedgerEntry[];

  lastPurchase?: PurchaseResult;
  lastExitAttempt?: ExitResult;
  shield?: ShieldResult;

  fubar?: FubarEvent;
  streak?: StreakEvent;
  timerExpired?: TimerExpiredEvent;

  regimeShift?: RegimeShiftEvent;
  phaseTransition?: PhaseTransitionEvent;

  deck?: GameCard[];
  clip?: ClipBoundary;
  moment?: MomentEvent;
}

export interface WipeClinicReport {
  runId: string;
  wipedRunId: string;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;

  rootCause: RootCauseKey;
  severity: number; // 0..100
  recommendedCard: GameCard;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  clip: ClipBoundary;
  moment: MomentEvent;

  proof: ProofCard;
  ledger: LedgerEntry;

  artifacts: M95TypeArtifacts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M95Input {
  wipedRunId?: string;
  failureSnapshot?: FailureSnapshot;
  clinicConfig?: Record<string, unknown>;
}

export interface M95Output {
  deathReviewLoaded: boolean;
  rootCauseAnnotated: boolean;
  clinicLesson: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M95Event = 'WIPE_CLINIC_STARTED' | 'ROOT_CAUSE_REVIEWED' | 'CLINIC_COMPLETED';

export interface M95TelemetryPayload extends MechanicTelemetryPayload {
  event: M95Event;
  mechanic_id: 'M95';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M95_BOUNDS = {
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

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildDeckComposition(cards: GameCard[]): DeckComposition {
  const byType: Record<string, number> = {};
  for (const c of cards) byType[c.type] = (byType[c.type] ?? 0) + 1;
  return { totalCards: cards.length, byType };
}

function normalizeDefaultCard(card: GameCard): GameCard {
  return DEFAULT_CARD_IDS.includes(card.id) ? card : DEFAULT_CARD;
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

  const schedulePick = seededIndex(seed, 95, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;

  const chaosPick = seededIndex(seed, 96, Math.max(1, chaosWindows.length));
  const chaosBias = clamp((chaosWindows[chaosPick]?.startTick ?? 0) / Math.max(1, RUN_TOTAL_TICKS), 0, 1);

  const macroRegime: MacroRegime = MACRO_REGIMES.includes(derivedRegime) ? derivedRegime : 'NEUTRAL';
  const runPhase: RunPhase = RUN_PHASES[seededIndex(seed, 97, RUN_PHASES.length)];
  const pressureTier: PressureTier = PRESSURE_TIERS[seededIndex(seed, 98, PRESSURE_TIERS.length)];

  const tickTier: TickTier =
    chaosBias > 0.75 ? 'CRITICAL' :
    chaosBias > 0.45 ? 'ELEVATED' :
    (pressureTier === 'CRITICAL' ? 'CRITICAL' : pressureTier === 'HIGH' ? 'ELEVATED' : 'STANDARD');

  const decayRate = computeDecayRate(macroRegime, M95_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  return { macroRegime, runPhase, pressureTier, tickTier, macroSchedule, chaosWindows, decayRate, exitPulseMultiplier, regimeMultiplier };
}

function computeRootCause(snapshot: FailureSnapshot | undefined, seed: string, ctx: ReturnType<typeof deriveContext>): RootCauseKey {
  const cash = snapshot?.runState?.cash ?? 0;
  const netWorth = snapshot?.runState?.netWorth ?? cash;
  const timerExpired = Boolean(snapshot?.timerExpired);
  const shieldDepleted = Boolean(snapshot?.shield?.depleted);
  const fubarDamage = snapshot?.fubar?.damage ?? 0;
  const taxApplied = Boolean(snapshot?.streak?.taxApplied);
  const lastExitTiming = snapshot?.lastExitAttempt?.timingScore ?? 50;
  const lastLeverage = snapshot?.lastPurchase?.leverageAdded ?? 0;

  const candidates: RootCauseKey[] = [];

  if (cash <= -M95_BOUNDS.BLEED_CASH_THRESHOLD || netWorth <= 0) candidates.push('CASH_BLEED');
  if (lastLeverage >= M95_BOUNDS.REGIME_SHIFT_THRESHOLD * 2) candidates.push('OVERLEVERAGE');
  if (lastExitTiming < 35) candidates.push('MISSED_EXIT');
  if (fubarDamage > 0) candidates.push('FUBAR_CHAIN');
  if (shieldDepleted) candidates.push('SHIELD_FAILURE');
  if (timerExpired) candidates.push('TIMER_PANIC');
  if (taxApplied) candidates.push('STREAK_TAX_SPIRAL');

  if (!candidates.length) return 'UNKNOWN';

  // deterministic tie-break by regime + chaos + snapshot tick
  const salt = seededIndex(seed, (snapshot?.runState?.tick ?? 0) + Math.round(ctx.decayRate * 100), candidates.length);
  return candidates[salt] ?? candidates[0] ?? 'UNKNOWN';
}

function severityScore(rootCause: RootCauseKey, snapshot: FailureSnapshot | undefined, ctx: ReturnType<typeof deriveContext>, seed: string): number {
  const cash = snapshot?.runState?.cash ?? 0;
  const netWorth = snapshot?.runState?.netWorth ?? cash;
  const base =
    rootCause === 'UNKNOWN' ? 20 :
    rootCause === 'CASH_BLEED' ? 85 :
    rootCause === 'OVERLEVERAGE' ? 78 :
    rootCause === 'MISSED_EXIT' ? 70 :
    rootCause === 'FUBAR_CHAIN' ? 74 :
    rootCause === 'SHIELD_FAILURE' ? 66 :
    rootCause === 'TIMER_PANIC' ? 62 :
    58;

  const worthPenalty = netWorth <= 0 ? 12 : netWorth < M95_BOUNDS.TIER_ESCAPE_TARGET ? 6 : 0;
  const cashPenalty = cash < -M95_BOUNDS.BLEED_CASH_THRESHOLD ? 8 : cash < 0 ? 3 : 0;
  const regimePenalty =
    ctx.macroRegime === 'CRISIS' ? 10 :
    ctx.macroRegime === 'BEAR' ? 6 :
    ctx.macroRegime === 'NEUTRAL' ? 3 :
    0;

  const noise = seededIndex(seed, base + worthPenalty + cashPenalty + regimePenalty, 9); // 0..8

  return clamp(Math.round(base + worthPenalty + cashPenalty + regimePenalty + noise), 0, 100);
}

function recommendedCounterMoveCard(seed: string, ctx: ReturnType<typeof deriveContext>): GameCard {
  const pressureWeight = PRESSURE_WEIGHTS[ctx.pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[ctx.runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[ctx.macroRegime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:m95:pool`, pressureWeight * phaseWeight, regimeWeight);
  const deck = seededShuffle((pool.length ? pool : OPPORTUNITY_POOL), `${seed}:m95:deck`);
  const picked = deck[seededIndex(seed, 955, Math.max(1, deck.length))] ?? DEFAULT_CARD;
  return normalizeDefaultCard(picked);
}

function makeClip(runId: string): ClipBoundary {
  const start = seededIndex(runId, 950, Math.max(1, RUN_TOTAL_TICKS - 12));
  const end = clamp(start + 12, start + 1, RUN_TOTAL_TICKS);
  return { startTick: start, endTick: end, triggerEvent: 'WIPE_CLINIC_STARTED' };
}

function makeMoment(highlight: string): MomentEvent {
  return { type: 'WIPE_CLINIC', tick: 0, highlight, shareReady: true };
}

function lessonText(rootCause: RootCauseKey, severity: number, card: GameCard, ctx: ReturnType<typeof deriveContext>, snapshot: FailureSnapshot | undefined): string {
  const cash = snapshot?.runState?.cash ?? 0;
  const netWorth = snapshot?.runState?.netWorth ?? cash;

  const rule =
    rootCause === 'CASH_BLEED' ? 'Stop the bleed: cut burn, protect cash, take only low-friction moves until solvent.' :
    rootCause === 'OVERLEVERAGE' ? 'De-lever: cap leverage, prioritize cashflow stability, avoid stacking debt into thin regimes.' :
    rootCause === 'MISSED_EXIT' ? 'Exit discipline: plan exits before entry; take profits when pulse favors you.' :
    rootCause === 'FUBAR_CHAIN' ? 'Chaos hygiene: treat FUBAR windows as defense ticks; reduce exposure and keep shield ready.' :
    rootCause === 'SHIELD_FAILURE' ? 'Shield first: keep a buffer; avoid consuming shield on low-value actions.' :
    rootCause === 'TIMER_PANIC' ? 'Timer control: pre-commit a playbook; never buy under panic ticks.' :
    rootCause === 'STREAK_TAX_SPIRAL' ? 'Streak discipline: break the tax spiral; reset tempo and avoid forced repetition.' :
    'Unknown cause: review ledger tail and last 3 decisions; find the first irreversible mistake.';

  const line1 = `M95 WIPE CLINIC — cause=${rootCause} severity=${severity}/100`;
  const line2 = `Context: regime=${ctx.macroRegime} phase=${ctx.runPhase} pressure=${ctx.pressureTier} tickTier=${ctx.tickTier}`;
  const line3 = `Snapshot: cash=${Math.round(cash)} netWorth=${Math.round(netWorth)}`;
  const line4 = `Counter-move: play=${card.name} (${card.id})`;
  const line5 = rule;

  return [line1, line2, line3, line4, line5].join(' | ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * wipeClinicReviewer
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function wipeClinicReviewer(
  input: M95Input,
  emit: MechanicEmitter,
): M95Output {
  const wipedRunId = safeString(input.wipedRunId);
  const snapshot = input.failureSnapshot;
  const clinicConfig = input.clinicConfig ?? {};

  const runId = computeHash(`M95:${JSON.stringify({
    wipedRunId,
    cfgKeys: Object.keys(clinicConfig),
    snapTick: snapshot?.runState?.tick ?? 0,
    snapHash: snapshot ? computeHash(JSON.stringify({
      cash: snapshot.runState.cash,
      netWorth: snapshot.runState.netWorth,
      wipeReason: snapshot.wipe.reason,
      wipeTick: snapshot.wipe.tick,
      ledgerLen: snapshot.ledgerTail?.length ?? 0,
    })) : 'none',
  })}`);

  const ctx = deriveContext(runId);
  const rootCause = computeRootCause(snapshot, runId, ctx);
  const severity = severityScore(rootCause, snapshot, ctx, runId);
  const card = recommendedCounterMoveCard(runId, ctx);

  const clip = snapshot?.clip ?? makeClip(runId);
  const moment = snapshot?.moment ?? makeMoment(`Wipe reviewed: ${rootCause} (${severity}/100)`);

  const clinicLesson = lessonText(rootCause, severity, card, ctx, snapshot);
  const clinicLessonHash = computeHash(`${runId}:${clinicLesson}`);

  // Deterministic artifacts (touches all imported types; optional downstream)
  const deck = seededShuffle(OPPORTUNITY_POOL, `${runId}:m95:deckSeed`);
  const deckComposition = buildDeckComposition(deck);

  const auction: AuctionResult = {
    winnerId: `clinic:${runId}`,
    winnerBid: clamp(Math.round(2_000 * (ctx.exitPulseMultiplier ?? 1.0)), 0, M95_BOUNDS.MAX_AMOUNT),
    expired: false,
  };

  const purchase: PurchaseResult = snapshot?.lastPurchase ?? {
    success: true,
    assetId: `asset:${card.id}`,
    cashSpent: clamp(Math.round(safeNumber(card.downPayment ?? card.cost ?? 0, 0)), 0, M95_BOUNDS.MAX_AMOUNT),
    leverageAdded: clamp(Math.round(safeNumber(card.cost ?? 0, 0) * 0.25), 0, M95_BOUNDS.MAX_AMOUNT),
    reason: 'M95_CLINIC_COUNTER_MOVE',
  };

  const shield: ShieldResult = snapshot?.shield ?? {
    absorbed: clamp(Math.round(M95_BOUNDS.MAX_AMOUNT * 0.02), 0, M95_BOUNDS.MAX_AMOUNT),
    pierced: false,
    depleted: false,
    remainingShield: clamp(Math.round(M95_BOUNDS.MAX_AMOUNT * 0.08), 0, M95_BOUNDS.MAX_AMOUNT),
  };

  const exit: ExitResult = snapshot?.lastExitAttempt ?? {
    assetId: purchase.assetId,
    saleProceeds: clamp(Math.round(purchase.cashSpent * 1.1 * (ctx.exitPulseMultiplier ?? 1.0)), 0, M95_BOUNDS.MAX_PROCEEDS),
    capitalGain: clamp(Math.round(purchase.cashSpent * 0.1), 0, M95_BOUNDS.MAX_PROCEEDS),
    timingScore: clamp(Math.round(50 * (1 - ctx.decayRate) * (ctx.regimeMultiplier ?? 1.0)), 0, 100),
    macroRegime: ctx.macroRegime,
  };

  const tickResult: TickResult = {
    tick: snapshot?.runState?.tick ?? 0,
    runPhase: snapshot?.runState?.runPhase ?? ctx.runPhase,
    timerExpired: Boolean(snapshot?.timerExpired),
  };

  const wipeEvent: WipeEvent = snapshot?.wipe ?? {
    reason: 'M95_NO_SNAPSHOT',
    tick: 0,
    cash: 0,
    netWorth: 0,
  };

  const regimeShift: RegimeShiftEvent = snapshot?.regimeShift ?? {
    previousRegime: 'NEUTRAL',
    newRegime: ctx.macroRegime,
  };

  const phaseTransition: PhaseTransitionEvent = snapshot?.phaseTransition ?? {
    from: ctx.runPhase === 'LATE' ? 'MID' : 'EARLY',
    to: ctx.runPhase,
  };

  const timerExpired: TimerExpiredEvent | undefined = snapshot?.timerExpired ?? (severity > 80 ? { tick: tickResult.tick } : undefined);
  const streak: StreakEvent | undefined = snapshot?.streak ?? (severity > 70 ? { streakLength: 3, taxApplied: true } : undefined);
  const fubar: FubarEvent | undefined = snapshot?.fubar ?? (severity > 75 ? { level: 4, type: 'WIPE_CHAIN', damage: clamp(severity * 100, 0, M95_BOUNDS.MAX_AMOUNT) } : undefined);

  const solvencyStatus: SolvencyStatus =
    wipeEvent.reason ? 'WIPED' :
    (snapshot?.runState?.cash ?? 0) < -M95_BOUNDS.BLEED_CASH_THRESHOLD ? 'BLEED' :
    'SOLVENT';

  const tierProgress: TierProgress = {
    currentTier: ctx.pressureTier,
    progressPct: clamp((100 - severity) / 100, 0, 1),
  };

  const asset: Asset = { id: purchase.assetId, value: purchase.cashSpent, cashflowMonthly: 0, purchasePrice: purchase.cashSpent };
  const ipaItem: IPAItem = { id: `ipa:${runId}`, cashflowMonthly: 0 };
  const debt: Debt = { id: `debt:${runId}`, amount: purchase.leverageAdded, interestRate: 0.08 };
  const buff: Buff = { id: `buff:${runId}`, type: 'CLINIC_LESSON', magnitude: Math.round((100 - severity) / 10), expiresAt: clamp((snapshot?.runState?.tick ?? 0) + 24, 0, RUN_TOTAL_TICKS) };
  const liability: Liability = { id: `liab:${runId}`, amount: clamp(Math.max(0, -safeNumber(snapshot?.runState?.cash ?? 0, 0)), 0, M95_BOUNDS.MAX_AMOUNT) };
  const shieldLayer: ShieldLayer = { id: `shield:${runId}`, strength: shield.remainingShield, type: 'CLINIC_BUFFER' };
  const setBonus: SetBonus = { setId: `set:${ctx.macroRegime}`, bonus: Math.round((1 - ctx.decayRate) * 10), description: 'Macro-aware discipline bonus (clinic-only).' };
  const assetMod: AssetMod = { modId: `mod:${runId}`, assetId: asset.id, statKey: 'risk', delta: -Math.round(severity / 2) };
  const incomeItem: IncomeItem = { source: 'clinic', amount: clamp(Math.round((100 - severity) * 10 * (ctx.regimeMultiplier ?? 1.0)), 0, M95_BOUNDS.MAX_AMOUNT) };

  const macroEvent: MacroEvent = ctx.macroSchedule[seededIndex(runId, 959, Math.max(1, ctx.macroSchedule.length))] ?? { tick: 0, type: 'REGIME_SHIFT', regimeChange: ctx.macroRegime };
  const chaosWindow: ChaosWindow = ctx.chaosWindows[seededIndex(runId, 960, Math.max(1, ctx.chaosWindows.length))] ?? { startTick: 0, endTick: 6, type: 'FUBAR_WINDOW' };

  const gameEvent: GameEvent = {
    type: 'WIPE_CLINIC_DIAGNOSIS',
    damage: clamp(severity * 100, 0, M95_BOUNDS.MAX_AMOUNT),
    payload: { rootCause, clinicLessonHash },
  };

  const ledger: LedgerEntry = {
    gameAction: {
      type: 'M95_WIPE_CLINIC',
      wipedRunId,
      rootCause,
      severity,
      recommendedCardId: card.id,
      regime: ctx.macroRegime,
      phase: ctx.runPhase,
      pressure: ctx.pressureTier,
      lessonHash: clinicLessonHash,
    },
    tick: tickResult.tick,
    hash: computeHash(`${runId}:ledger:${tickResult.tick}:${clinicLessonHash}`),
  };

  const proof: ProofCard = {
    runId,
    cordScore: clamp(100 - severity, 0, 100),
    hash: computeHash(`${runId}:proof:${ledger.hash}`),
    grade: (severity <= 25 ? 'A' : severity <= 45 ? 'B' : severity <= 65 ? 'C' : 'D'),
  };

  const completedRun: CompletedRun = {
    runId: wipedRunId || runId,
    userId: 'unknown',
    cordScore: proof.cordScore,
    outcome: 'WIPE_REVIEWED',
    ticks: clamp(tickResult.tick, 0, RUN_TOTAL_TICKS),
  };

  const seasonState: SeasonState = { seasonId: 'season-unknown', tick: tickResult.tick, rewardsClaimed: [] };
  const runState: RunState = snapshot?.runState ?? { cash: 0, netWorth: 0, tick: 0, runPhase: ctx.runPhase };

  const telemetryPayload: MechanicTelemetryPayload = {
    event: 'CLINIC_COMPLETED',
    mechanic_id: 'M95',
    tick: 0,
    runId,
    payload: { clinicLessonHash },
  };

  const artifacts: M95TypeArtifacts = {
    runPhase: ctx.runPhase,
    tickTier: ctx.tickTier,
    macroRegime: ctx.macroRegime,
    pressureTier: ctx.pressureTier,
    solvencyStatus,

    asset,
    ipaItem,
    gameCard: card,
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
    regimeShiftEvent: regimeShift,
    phaseTransitionEvent: phaseTransition,
    timerExpiredEvent: timerExpired,
    streakEvent: streak,
    fubarEvent: fubar,

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

  const report: WipeClinicReport = {
    runId,
    wipedRunId,

    macroRegime: ctx.macroRegime,
    runPhase: ctx.runPhase,
    pressureTier: ctx.pressureTier,
    tickTier: ctx.tickTier,

    decayRate: ctx.decayRate,
    regimeMultiplier: ctx.regimeMultiplier,
    exitPulseMultiplier: ctx.exitPulseMultiplier,

    rootCause,
    severity,
    recommendedCard: card,

    macroSchedule: ctx.macroSchedule,
    chaosWindows: ctx.chaosWindows,

    clip,
    moment,

    proof,
    ledger,

    artifacts,
  };

  emit({
    event: 'WIPE_CLINIC_STARTED',
    mechanic_id: 'M95',
    tick: 0,
    runId,
    payload: {
      wipedRunId,
      hasSnapshot: Boolean(snapshot),
      macroRegime: ctx.macroRegime,
      runPhase: ctx.runPhase,
      pressureTier: ctx.pressureTier,
      tickTier: ctx.tickTier,
      decayRate: ctx.decayRate,
      regimeMultiplier: ctx.regimeMultiplier,
      exitPulseMultiplier: ctx.exitPulseMultiplier,
      reportPreview: {
        rootCause,
        severity,
        recommendedCardId: card.id,
        lessonHash: clinicLessonHash,
      },
    },
  });

  emit({
    event: 'ROOT_CAUSE_REVIEWED',
    mechanic_id: 'M95',
    tick: 0,
    runId,
    payload: {
      rootCause,
      severity,
      solvencyStatus,
      wipeReason: wipeEvent.reason,
      wipeTick: wipeEvent.tick,
      recommendedCard: { id: card.id, name: card.name, type: card.type },
      report,
    },
  });

  emit({
    event: 'CLINIC_COMPLETED',
    mechanic_id: 'M95',
    tick: 0,
    runId,
    payload: {
      clinicLesson,
      clinicLessonHash,
      proof: { cordScore: proof.cordScore, grade: proof.grade, hash: proof.hash },
      ledgerHash: ledger.hash,
      clip,
      moment,
    },
  });

  return {
    deathReviewLoaded: true,
    rootCauseAnnotated: true,
    clinicLesson,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M95MLInput {
  deathReviewLoaded?: boolean;
  rootCauseAnnotated?: boolean;
  clinicLesson?: string;
  runId: string;
  tick: number;
}

export interface M95MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * wipeClinicReviewerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function wipeClinicReviewerMLCompanion(
  input: M95MLInput,
): Promise<M95MLOutput> {
  const base =
    (input.deathReviewLoaded ? 0.40 : 0.05) +
    (input.rootCauseAnnotated ? 0.40 : 0.05) +
    (typeof input.clinicLesson === 'string' && input.clinicLesson.length > 0 ? 0.15 : 0.02);

  const score = clamp(base, 0.01, 0.99);

  const pseudoRegime: MacroRegime = MACRO_REGIMES[seededIndex(input.runId, input.tick, MACRO_REGIMES.length)];
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  const topFactors = [
    input.deathReviewLoaded ? 'review loaded' : 'no review',
    input.rootCauseAnnotated ? 'root cause annotated' : 'no annotation',
    (input.clinicLesson?.length ?? 0) > 0 ? `lessonLen=${input.clinicLesson!.length}` : 'no lesson',
    `regime=${pseudoRegime}`,
    `pulse=${EXIT_PULSE_MULTIPLIERS[pseudoRegime] ?? 1.0}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: score > 0.66 ? 'Convert lesson into a pre-commit rule for the next run.' : 'Increase clinic fidelity; capture the first irreversible mistake.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M95'),
    confidenceDecay,
  };
}