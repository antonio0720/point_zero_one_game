// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m102_forked_timeline_choice_two_branches_one_final.ts
//
// Mechanic : M102 — Forked Timeline: Choice Two Branches One Final
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m102a
// Deps     : M01, M43
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

export const M102_MECHANICS_UTILS = Object.freeze({
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

export type M102TypeArtifacts = {
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
// Local domain (M102-specific)
// ─────────────────────────────────────────────────────────────────────────────

export type ForkBranchId = 'A' | 'B';

export interface ForkDecision {
  // What the player chose (card, button, or decision key)
  decisionKey: string;

  // Optional: explicit branch selection, else deterministic selection occurs
  preferredBranch?: ForkBranchId;

  // Optional: weights (deterministic) to bias branch selection if no preferredBranch
  weightA?: number;
  weightB?: number;
}

export interface ForkBranchState {
  label: string;
  state: Record<string, unknown>;
  // Optional: numeric score for merge preference
  score?: number;
}

export interface ForkMergeOutcome {
  branchSelected: ForkBranchId;
  merged: Record<string, unknown>;
  auditHash: string;
  proofHash: string;
  deckAnchorCardId: string;
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;
  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;
}

export interface ForkPacket {
  runId: string;
  tick: number;

  forkDecision: ForkDecision;
  branchA: ForkBranchState;
  branchB: ForkBranchState;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  merge: ForkMergeOutcome;

  clip: ClipBoundary;
  moment: MomentEvent;

  ledger: LedgerEntry;
  proof: ProofCard;

  artifacts: M102TypeArtifacts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M102Input {
  forkDecision?: unknown;
  branchAState?: Record<string, unknown>;
  branchBState?: Record<string, unknown>;
}

export interface M102Output {
  forkActivated: boolean;
  branchSelected: string;
  mergedOutcome: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M102Event = 'FORK_CREATED' | 'BRANCH_SELECTED' | 'BRANCHES_MERGED';

export interface M102TelemetryPayload extends MechanicTelemetryPayload {
  event: M102Event;
  mechanic_id: 'M102';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M102_BOUNDS = {
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

const MACRO_REGIMES: readonly MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const;
const RUN_PHASES: readonly RunPhase[] = ['EARLY', 'MID', 'LATE'] as const;
const PRESSURE_TIERS: readonly PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const TICK_TIERS: readonly TickTier[] = ['STANDARD', 'ELEVATED', 'CRITICAL'] as const;

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeForkDecision(raw: unknown): ForkDecision {
  if (!raw || typeof raw !== 'object') {
    return { decisionKey: 'unknown', weightA: 1, weightB: 1 };
  }
  const o = raw as Record<string, unknown>;
  const decisionKey = safeString(o.decisionKey, safeString(o.key, 'unknown')).trim() || 'unknown';
  const preferred = safeString(o.preferredBranch, '').toUpperCase();
  const preferredBranch: ForkBranchId | undefined = preferred === 'A' || preferred === 'B' ? (preferred as ForkBranchId) : undefined;

  const weightA = safeNumber(o.weightA, 1);
  const weightB = safeNumber(o.weightB, 1);

  return {
    decisionKey,
    preferredBranch,
    weightA: clamp(weightA, 0, 1000),
    weightB: clamp(weightB, 0, 1000),
  };
}

function normalizeBranchState(label: string, raw: Record<string, unknown> | undefined): ForkBranchState {
  const state = (raw && typeof raw === 'object') ? raw : {};
  const score = typeof state.score === 'number' ? state.score : undefined;
  return { label, state, score };
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

  const schedulePick = seededIndex(seed, 102, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;
  const macroRegime: MacroRegime = MACRO_REGIMES.includes(derivedRegime) ? derivedRegime : 'NEUTRAL';

  const chaosPick = seededIndex(seed, 1021, Math.max(1, chaosWindows.length));
  const chaosBias = clamp((chaosWindows[chaosPick]?.startTick ?? 0) / Math.max(1, RUN_TOTAL_TICKS), 0, 1);

  const runPhase: RunPhase = RUN_PHASES[seededIndex(seed, 1022, RUN_PHASES.length)];
  const pressureTier: PressureTier = PRESSURE_TIERS[seededIndex(seed, 1023, PRESSURE_TIERS.length)];
  const tickTier: TickTier =
    chaosBias > 0.75 ? 'CRITICAL' :
    chaosBias > 0.45 ? 'ELEVATED' :
    (pressureTier === 'CRITICAL' ? 'CRITICAL' : pressureTier === 'HIGH' ? 'ELEVATED' : 'STANDARD');

  const decayRate = computeDecayRate(macroRegime, M102_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  return { macroRegime, runPhase, pressureTier, tickTier, macroSchedule, chaosWindows, decayRate, exitPulseMultiplier, regimeMultiplier };
}

function selectBranch(decision: ForkDecision, seed: string, a: ForkBranchState, b: ForkBranchState): ForkBranchId {
  if (decision.preferredBranch) return decision.preferredBranch;

  const scoreA = safeNumber(a.score, 0);
  const scoreB = safeNumber(b.score, 0);

  // Combine explicit weights and branch scores (all deterministic)
  const wA = clamp((decision.weightA ?? 1) + Math.max(0, scoreA), 0, 10_000);
  const wB = clamp((decision.weightB ?? 1) + Math.max(0, scoreB), 0, 10_000);

  const total = wA + wB;
  if (total <= 0) {
    // deterministic fallback
    return seededIndex(seed, decision.decisionKey.length, 2) === 0 ? 'A' : 'B';
  }

  // deterministic roll in [0,total)
  const roll = seededIndex(seed, Math.round(total), Math.max(1, Math.round(total)));
  return roll < wA ? 'A' : 'B';
}

function mergeStates(seed: string, chosen: ForkBranchId, a: ForkBranchState, b: ForkBranchState): Record<string, unknown> {
  // Deterministic merge policy:
  //  - Always keep chosen branch values on conflicts
  //  - Merge non-conflicting keys from the other branch
  //  - Attach meta: fork audit, hashes, and chosen id
  const primary = (chosen === 'A' ? a.state : b.state) ?? {};
  const secondary = (chosen === 'A' ? b.state : a.state) ?? {};

  const merged: Record<string, unknown> = { ...secondary, ...primary };

  // Deterministic “tie-break list” for conflict keys (auditable)
  const keysPrimary = Object.keys(primary).sort();
  const keysSecondary = Object.keys(secondary).sort();
  const conflicts = keysPrimary.filter(k => k in secondary).sort();

  merged.__fork = {
    chosen,
    conflicts,
    primaryKeysHead: keysPrimary.slice(0, 12),
    secondaryKeysHead: keysSecondary.slice(0, 12),
    salt: computeHash(`${seed}:merge:${chosen}:${conflicts.join(',')}`),
  };

  return merged;
}

function normalizeDefaultCard(card: GameCard): GameCard {
  return DEFAULT_CARD_IDS.includes(card.id) ? card : DEFAULT_CARD;
}

function buildDeckComposition(cards: GameCard[]): DeckComposition {
  const byType: Record<string, number> = {};
  for (const c of cards) byType[c.type] = (byType[c.type] ?? 0) + 1;
  return { totalCards: cards.length, byType };
}

function makeClip(seed: string): ClipBoundary {
  const start = seededIndex(seed, 1024, Math.max(1, RUN_TOTAL_TICKS - 12));
  const end = clamp(start + 12, start + 1, RUN_TOTAL_TICKS);
  return { startTick: start, endTick: end, triggerEvent: 'FORK_CREATED' };
}

function makeMoment(highlight: string): MomentEvent {
  return { type: 'FORKED_TIMELINE', tick: 0, highlight, shareReady: true };
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
 * forkedTimelineResolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function forkedTimelineResolver(
  input: M102Input,
  emit: MechanicEmitter,
): M102Output {
  const forkDecision = normalizeForkDecision(input.forkDecision);
  const branchA = normalizeBranchState('Branch A', input.branchAState);
  const branchB = normalizeBranchState('Branch B', input.branchBState);

  // Stable, auditable seed for this fork (no Date.now, no randomness)
  const seed = computeHash(JSON.stringify({
    mechanic: 'M102',
    forkDecision,
    aKeys: Object.keys(branchA.state ?? {}).sort(),
    bKeys: Object.keys(branchB.state ?? {}).sort(),
    aScore: branchA.score ?? null,
    bScore: branchB.score ?? null,
  }));

  const tick = 0;
  const ctx = deriveContext(seed);

  // Touch weighted pool + deterministic card anchor (keeps imports live + provides reproducibility)
  const pressureWeight = PRESSURE_WEIGHTS[ctx.pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[ctx.runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[ctx.macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(`${seed}:m102:pool`, pressureWeight * phaseWeight, regimeWeight);
  const pool = weightedPool.length ? weightedPool : OPPORTUNITY_POOL;
  const deck = seededShuffle(pool, `${seed}:m102:deck`);
  const pickIdx = seededIndex(seed, forkDecision.decisionKey.length + 102, Math.max(1, deck.length));
  const anchorCard = normalizeDefaultCard(deck[pickIdx] ?? DEFAULT_CARD);
  const deckComposition = buildDeckComposition(deck);

  // Branch selection
  const branchSelected = selectBranch(forkDecision, seed, branchA, branchB);

  // Merge outcome (deterministic, auditable)
  const mergedOutcome = mergeStates(seed, branchSelected, branchA, branchB);

  const auditHash = computeHash(JSON.stringify({
    seed,
    forkDecision,
    branchSelected,
    mergedKeys: Object.keys(mergedOutcome).sort(),
    anchorCardId: anchorCard.id,
    ctx: { macroRegime: ctx.macroRegime, runPhase: ctx.runPhase, pressureTier: ctx.pressureTier, tickTier: ctx.tickTier },
  }));

  const proofHash = computeHash(`${auditHash}:proof:${anchorCard.id}`);

  const merge: ForkMergeOutcome = {
    branchSelected,
    merged: mergedOutcome,
    auditHash,
    proofHash,
    deckAnchorCardId: anchorCard.id,
    macroRegime: ctx.macroRegime,
    runPhase: ctx.runPhase,
    pressureTier: ctx.pressureTier,
    tickTier: ctx.tickTier,
    decayRate: ctx.decayRate,
    regimeMultiplier: ctx.regimeMultiplier,
    exitPulseMultiplier: ctx.exitPulseMultiplier,
  };

  const clip = makeClip(seed);
  const moment = makeMoment(`Fork resolved: ${branchSelected} · anchor=${anchorCard.id}`);

  // Build full imported-type artifact pack (bounded, deterministic)
  const auction: AuctionResult = { winnerId: `fork:${seed}`, winnerBid: clamp(Math.round(1_000 * ctx.exitPulseMultiplier), 0, M102_BOUNDS.MAX_AMOUNT), expired: false };
  const purchase: PurchaseResult = { success: true, assetId: `fork:${anchorCard.id}`, cashSpent: 0, leverageAdded: 0, reason: 'FORK_ANCHOR' };
  const shield: ShieldResult = { absorbed: 250, pierced: false, depleted: false, remainingShield: 750 };
  const exit: ExitResult = { assetId: purchase.assetId, saleProceeds: 0, capitalGain: 0, timingScore: clamp(Math.round(50 * (1 - ctx.decayRate) * ctx.regimeMultiplier), 0, 100), macroRegime: ctx.macroRegime };
  const tickResult: TickResult = { tick, runPhase: ctx.runPhase, timerExpired: false };

  const tierProgress: TierProgress = { currentTier: ctx.pressureTier, progressPct: clamp(branchSelected === 'A' ? 0.55 : 0.50, 0, 1) };

  const wipeEvent: WipeEvent | undefined = undefined;
  const regimeShiftEvent: RegimeShiftEvent = { previousRegime: 'NEUTRAL', newRegime: ctx.macroRegime };
  const phaseTransitionEvent: PhaseTransitionEvent = { from: 'EARLY', to: ctx.runPhase };
  const timerExpiredEvent: TimerExpiredEvent | undefined = undefined;
  const streakEvent: StreakEvent = { streakLength: clamp(1 + seededIndex(seed, 1025, 10), 1, 10), taxApplied: false };
  const fubarEvent: FubarEvent = { level: clamp(seededIndex(seed, 1026, 6), 0, 10), type: 'FORK_PRESSURE', damage: clamp(500, 0, M102_BOUNDS.MAX_AMOUNT) };

  const solvencyStatus: SolvencyStatus = 'SOLVENT';

  const asset: Asset = { id: purchase.assetId, value: 0, cashflowMonthly: 0, purchasePrice: 0 };
  const ipaItem: IPAItem = { id: `ipa:${seed}`, cashflowMonthly: 0 };
  const debt: Debt = { id: `debt:${seed}`, amount: 0, interestRate: 0.08 };
  const buff: Buff = { id: `buff:${seed}`, type: 'FORK_RESOLVED', magnitude: 1, expiresAt: clamp(12, 0, RUN_TOTAL_TICKS) };
  const liability: Liability = { id: `liab:${seed}`, amount: 0 };
  const shieldLayer: ShieldLayer = { id: `shield:${seed}`, strength: shield.remainingShield, type: 'FORK_SHIELD' };
  const setBonus: SetBonus = { setId: `set:${ctx.macroRegime}`, bonus: clamp(Math.round((1 - ctx.decayRate) * 10), 0, 10), description: 'Fork stability bonus.' };
  const assetMod: AssetMod = { modId: `mod:${seed}`, assetId: asset.id, statKey: 'branch', delta: branchSelected === 'A' ? 1 : 2 };
  const incomeItem: IncomeItem = { source: 'fork', amount: clamp(Math.round((1 - ctx.decayRate) * 100), 0, M102_BOUNDS.MAX_AMOUNT) };

  const macroEvent: MacroEvent = ctx.macroSchedule[seededIndex(seed, 1027, Math.max(1, ctx.macroSchedule.length))] ?? { tick: 0, type: 'REGIME_SHIFT', regimeChange: ctx.macroRegime };
  const chaosWindow: ChaosWindow = ctx.chaosWindows[seededIndex(seed, 1028, Math.max(1, ctx.chaosWindows.length))] ?? { startTick: 0, endTick: 6, type: 'FUBAR_WINDOW' };

  const gameEvent: GameEvent = {
    type: 'FORK_RESOLVED',
    damage: 0,
    payload: { branchSelected, auditHash, proofHash, anchorCardId: anchorCard.id } as any,
  };

  const runState: RunState = { cash: 0, netWorth: 0, tick, runPhase: ctx.runPhase };
  const seasonState: SeasonState = { seasonId: 'season-unknown', tick, rewardsClaimed: [] };
  const completedRun: CompletedRun = { runId: seed, userId: 'unknown', cordScore: 80, outcome: 'FORK_RESOLVED', ticks: tick };

  const ledger: LedgerEntry = {
    gameAction: {
      type: 'M102_FORK',
      decisionKey: forkDecision.decisionKey,
      branchSelected,
      auditHash,
      proofHash,
      anchorCardId: anchorCard.id,
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
    cordScore: clamp(Math.round(80 - ctx.decayRate * 10), 0, 100),
    hash: computeHash(`${seed}:proof:${ledger.hash}`),
    grade: gradeFromScore(clamp(Math.round(80 - ctx.decayRate * 10), 0, 100)),
  };

  const telemetryPayload: MechanicTelemetryPayload = {
    event: 'BRANCHES_MERGED',
    mechanic_id: 'M102',
    tick,
    runId: seed,
    payload: { branchSelected, auditHash, proofHash } as any,
  };

  const artifacts: M102TypeArtifacts = {
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

  const packet: ForkPacket = {
    runId: seed,
    tick,
    forkDecision,
    branchA,
    branchB,
    macroSchedule: ctx.macroSchedule,
    chaosWindows: ctx.chaosWindows,
    merge,
    clip,
    moment,
    ledger,
    proof,
    artifacts,
  };

  // Telemetry events
  emit({
    event: 'FORK_CREATED',
    mechanic_id: 'M102',
    tick,
    runId: seed,
    payload: {
      forkDecision,
      branchAKeys: Object.keys(branchA.state).length,
      branchBKeys: Object.keys(branchB.state).length,
      ctx: { macroRegime: ctx.macroRegime, runPhase: ctx.runPhase, pressureTier: ctx.pressureTier, tickTier: ctx.tickTier },
      anchorCardId: anchorCard.id,
      packet,
    } as any,
  });

  emit({
    event: 'BRANCH_SELECTED',
    mechanic_id: 'M102',
    tick,
    runId: seed,
    payload: {
      branchSelected,
      auditHash,
      proofHash,
      decisionKey: forkDecision.decisionKey,
      packet,
    } as any,
  });

  emit(telemetryPayload);

  return {
    forkActivated: true,
    branchSelected,
    mergedOutcome,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M102MLInput {
  forkActivated?: boolean;
  branchSelected?: string;
  mergedOutcome?: Record<string, unknown>;
  runId: string;
  tick: number;
}

export interface M102MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1
}

/**
 * forkedTimelineResolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function forkedTimelineResolverMLCompanion(
  input: M102MLInput,
): Promise<M102MLOutput> {
  const activated = Boolean(input.forkActivated);
  const branch = safeString(input.branchSelected, 'unknown');

  const pseudoRegime: MacroRegime = MACRO_REGIMES[seededIndex(input.runId, input.tick, MACRO_REGIMES.length)];
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  const base = activated ? 0.70 : 0.15;
  const score = clamp(base + (branch === 'A' || branch === 'B' ? 0.10 : 0.0), 0.01, 0.99);

  const mergedKeys = input.mergedOutcome ? Object.keys(input.mergedOutcome).length : 0;

  const topFactors = [
    activated ? 'fork=active' : 'fork=inactive',
    `branch=${branch}`,
    `mergedKeys=${mergedKeys}`,
    `regime=${pseudoRegime}`,
    `decay=${confidenceDecay.toFixed(2)}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: score > 0.66 ? 'Commit the merged branch and record audit hashes.' : 'Reduce branch divergence before committing.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M102'),
    confidenceDecay,
  };
}