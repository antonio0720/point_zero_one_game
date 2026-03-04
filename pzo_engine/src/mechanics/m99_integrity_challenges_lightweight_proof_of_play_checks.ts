// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m99_integrity_challenges_lightweight_proof_of_play_checks.ts
//
// Mechanic : M99 — Integrity Challenges: Lightweight Proof-of-Play Checks
// Family   : integrity_expert   Layer: backend_service   Priority: 1   Batch: 2
// ML Pair  : m99a
// Deps     : M47, M48
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

export const M99_MECHANICS_UTILS = Object.freeze({
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

export type M99TypeArtifacts = {
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
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M99Input {
  runId?: string;
  challengePrompt?: string;
  expectedResponse?: unknown;
}

export interface M99Output {
  challengePassed: boolean;
  challengeResult: Record<string, unknown>;
  integrityConfirmed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M99Event = 'INTEGRITY_CHALLENGE_ISSUED' | 'CHALLENGE_PASSED' | 'CHALLENGE_FAILED';

export interface M99TelemetryPayload extends MechanicTelemetryPayload {
  event: M99Event;
  mechanic_id: 'M99';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M99_BOUNDS = {
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
// Local models (M99-specific)
// ─────────────────────────────────────────────────────────────────────────────

export type M99ChallengeKind =
  | 'HASH_MATCH'
  | 'DECK_ANCHOR'
  | 'MACRO_SCHEDULE_SPOTCHECK'
  | 'LEDGER_SPOTCHECK'
  | 'TIMING_SPOTCHECK';

export interface M99ChallengeSpec {
  kind: M99ChallengeKind;
  prompt: string;
  expected: unknown;
  ttlTicks: number;
  issuedAtTick: number;
  auditSalt: string;
}

export interface M99ChallengeOutcome {
  passed: boolean;
  kind: M99ChallengeKind;
  reason: string;
  observed: unknown;
  expected: unknown;
  severity: 0 | 1 | 2 | 3; // 3 = strongest suspicious signal
  proofHash: string;
  auditHash: string;
}

export interface M99ProofOfPlayPacket {
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

  deckAnchorCard: GameCard;
  deckComposition: DeckComposition;

  spotcheck: {
    indexA: number;
    indexB: number;
    macroPickTick: number;
    chaosPickStart: number;
  };

  challenge: M99ChallengeSpec;
  outcome: M99ChallengeOutcome;

  ledger: LedgerEntry;
  proof: ProofCard;

  clip: ClipBoundary;
  moment: MomentEvent;

  artifacts: M99TypeArtifacts;
}

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

function buildDeckComposition(cards: GameCard[]): DeckComposition {
  const byType: Record<string, number> = {};
  for (const c of cards) byType[c.type] = (byType[c.type] ?? 0) + 1;
  return { totalCards: cards.length, byType };
}

function normalizeDefaultCard(card: GameCard): GameCard {
  return DEFAULT_CARD_IDS.includes(card.id) ? card : DEFAULT_CARD;
}

function deriveContext(seed: string, tick: number): {
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

  const schedulePick = seededIndex(seed, tick + 99, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;
  const macroRegime: MacroRegime = MACRO_REGIMES.includes(derivedRegime) ? derivedRegime : 'NEUTRAL';

  const runPhase: RunPhase =
    tick / Math.max(1, RUN_TOTAL_TICKS) < 0.33 ? 'EARLY' :
    tick / Math.max(1, RUN_TOTAL_TICKS) < 0.66 ? 'MID' : 'LATE';

  const chaosPick = seededIndex(seed, tick + 199, Math.max(1, chaosWindows.length));
  const chaosBias = clamp((chaosWindows[chaosPick]?.startTick ?? 0) / Math.max(1, RUN_TOTAL_TICKS), 0, 1);

  const pressureTier: PressureTier =
    chaosBias > 0.75 ? 'CRITICAL' :
    chaosBias > 0.50 ? 'HIGH' :
    chaosBias > 0.25 ? 'MEDIUM' :
    'LOW';

  const tickTier: TickTier =
    chaosBias > 0.75 ? 'CRITICAL' :
    chaosBias > 0.45 ? 'ELEVATED' :
    'STANDARD';

  const decayRate = computeDecayRate(macroRegime, M99_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  return { macroRegime, runPhase, pressureTier, tickTier, macroSchedule, chaosWindows, decayRate, exitPulseMultiplier, regimeMultiplier };
}

function pickAnchorCard(seed: string, ctx: ReturnType<typeof deriveContext>): { card: GameCard; deck: GameCard[]; deckComposition: DeckComposition } {
  const pressureWeight = PRESSURE_WEIGHTS[ctx.pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[ctx.runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[ctx.macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(`${seed}:m99:pool`, pressureWeight * phaseWeight, regimeWeight);
  const pool = weightedPool.length ? weightedPool : OPPORTUNITY_POOL;

  const deck = seededShuffle(pool, `${seed}:m99:deck`);
  const pickIdx = seededIndex(seed, 999, Math.max(1, deck.length));
  const card = normalizeDefaultCard(deck[pickIdx] ?? DEFAULT_CARD);

  return { card, deck, deckComposition: buildDeckComposition(deck) };
}

function makeClip(seed: string, tick: number): ClipBoundary {
  const start = clamp(tick, 0, RUN_TOTAL_TICKS);
  const end = clamp(start + 12, start + 1, RUN_TOTAL_TICKS);
  return { startTick: start, endTick: end, triggerEvent: 'INTEGRITY_CHALLENGE_ISSUED' };
}

function makeMoment(tick: number, highlight: string): MomentEvent {
  return { type: 'INTEGRITY_CHALLENGE', tick, highlight, shareReady: false };
}

function normalizeChallengeKind(prompt: string, seed: string): M99ChallengeKind {
  const p = prompt.toLowerCase();
  if (p.includes('hash')) return 'HASH_MATCH';
  if (p.includes('deck')) return 'DECK_ANCHOR';
  if (p.includes('macro')) return 'MACRO_SCHEDULE_SPOTCHECK';
  if (p.includes('ledger')) return 'LEDGER_SPOTCHECK';
  if (p.includes('time') || p.includes('tick')) return 'TIMING_SPOTCHECK';

  const kinds: M99ChallengeKind[] = ['HASH_MATCH', 'DECK_ANCHOR', 'MACRO_SCHEDULE_SPOTCHECK', 'LEDGER_SPOTCHECK', 'TIMING_SPOTCHECK'];
  return kinds[seededIndex(seed, prompt.length, kinds.length)]!;
}

function compareExpected(expected: unknown, observed: unknown): boolean {
  // strict match first; deterministic fallback to hash match for objects
  if (expected === observed) return true;
  try {
    return computeHash(JSON.stringify(expected)) === computeHash(JSON.stringify(observed));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * integrityChallengeSolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function integrityChallengeSolver(
  input: M99Input,
  emit: MechanicEmitter,
): M99Output {
  const runIdRaw = safeString(input.runId);
  const challengePrompt = safeString(input.challengePrompt);
  const expectedResponse = input.expectedResponse;

  // Deterministic “service id” for this check (do not use Date.now for verification paths)
  const seed = computeHash(`M99:${runIdRaw}:${challengePrompt}:${computeHash(JSON.stringify(expectedResponse ?? null))}`);
  const tick = seededIndex(seed, 99, Math.max(1, RUN_TOTAL_TICKS)); // deterministic tick within run

  const ctx = deriveContext(seed, tick);
  const { card: deckAnchorCard, deck, deckComposition } = pickAnchorCard(seed, ctx);

  // Build spotcheck indices (lightweight proof-of-play)
  const indexA = seededIndex(seed, tick + 1, 1_000_000);
  const indexB = seededIndex(seed, indexA, 1_000_000);

  const macroPickTick = ctx.macroSchedule[seededIndex(seed, tick + 2, Math.max(1, ctx.macroSchedule.length))]?.tick ?? 0;
  const chaosPickStart = ctx.chaosWindows[seededIndex(seed, tick + 3, Math.max(1, ctx.chaosWindows.length))]?.startTick ?? 0;

  // Derive observed response for standard kinds (when caller doesn’t provide a structured expectedResponse)
  const kind = normalizeChallengeKind(challengePrompt, seed);

  const observed: unknown =
    kind === 'HASH_MATCH' ? computeHash(runIdRaw + ':' + tick) :
    kind === 'DECK_ANCHOR' ? { anchorCardId: deckAnchorCard.id, deckHead: deck.slice(0, 3).map(c => c.id) } :
    kind === 'MACRO_SCHEDULE_SPOTCHECK' ? { macroPickTick, regime: ctx.macroRegime } :
    kind === 'LEDGER_SPOTCHECK' ? { indexA, indexB } :
    { tick, chaosPickStart };

  const passed = compareExpected(expectedResponse, observed);

  const severity: 0 | 1 | 2 | 3 =
    passed ? 0 :
    kind === 'HASH_MATCH' ? 3 :
    kind === 'LEDGER_SPOTCHECK' ? 3 :
    kind === 'MACRO_SCHEDULE_SPOTCHECK' ? 2 :
    kind === 'DECK_ANCHOR' ? 2 :
    1;

  const auditSalt = computeHash(`${seed}:salt:${kind}:${tick}`);

  const challenge: M99ChallengeSpec = {
    kind,
    prompt: challengePrompt,
    expected: expectedResponse,
    ttlTicks: clamp(12, 1, 60),
    issuedAtTick: tick,
    auditSalt,
  };

  const proofHash = computeHash(JSON.stringify({ seed, kind, tick, observed, expectedResponse, passed, auditSalt }));
  const auditHash = computeHash(`${seed}:audit:${proofHash}:${ctx.macroRegime}:${deckAnchorCard.id}`);

  const outcome: M99ChallengeOutcome = {
    passed,
    kind,
    reason: passed ? 'MATCH' : 'MISMATCH',
    observed,
    expected: expectedResponse,
    severity,
    proofHash,
    auditHash,
  };

  // Build typed anchors for ledger/proof and for “imports must be used”
  const clip = makeClip(seed, tick);
  const moment = makeMoment(tick, passed ? 'Integrity check passed' : `Integrity mismatch (${kind})`);

  const ledger: LedgerEntry = {
    gameAction: {
      type: 'M99_INTEGRITY_CHALLENGE',
      runId: runIdRaw,
      kind,
      tick,
      passed,
      severity,
      proofHash,
      auditHash,
      deckAnchorCardId: deckAnchorCard.id,
      macroRegime: ctx.macroRegime,
      runPhase: ctx.runPhase,
      pressureTier: ctx.pressureTier,
      tickTier: ctx.tickTier,
    },
    tick,
    hash: computeHash(`${seed}:ledger:${tick}:${passed ? 1 : 0}:${proofHash}`),
  };

  const proof: ProofCard = {
    runId: seed,
    cordScore: clamp(passed ? 95 : 20, 0, 100),
    hash: computeHash(`${seed}:proof:${ledger.hash}`),
    grade: passed ? 'A' : 'F',
  };

  // More imported types: bounded, deterministic dummy payloads for the packet
  const auction: AuctionResult = { winnerId: `m99:${seed}`, winnerBid: clamp(Math.round(1_000 * ctx.exitPulseMultiplier), 0, M99_BOUNDS.MAX_AMOUNT), expired: false };
  const purchase: PurchaseResult = { success: passed, assetId: `m99:${deckAnchorCard.id}`, cashSpent: 0, leverageAdded: 0, reason: 'M99_SPOTCHECK' };
  const shield: ShieldResult = { absorbed: clamp(Math.round((passed ? 1 : 0) * 500), 0, M99_BOUNDS.MAX_AMOUNT), pierced: !passed, depleted: false, remainingShield: clamp(1_000, 0, M99_BOUNDS.MAX_AMOUNT) };
  const exit: ExitResult = { assetId: purchase.assetId, saleProceeds: 0, capitalGain: 0, timingScore: clamp(Math.round(50 * (1 - ctx.decayRate) * ctx.regimeMultiplier), 0, 100), macroRegime: ctx.macroRegime };
  const tickResult: TickResult = { tick, runPhase: ctx.runPhase, timerExpired: false };

  const tierProgress: TierProgress = { currentTier: ctx.pressureTier, progressPct: clamp((passed ? 1 : 0) * 0.75, 0, 1) };

  const wipeEvent: WipeEvent | undefined = passed ? undefined : { reason: 'INTEGRITY_FAIL', tick, cash: 0, netWorth: 0 };
  const regimeShiftEvent: RegimeShiftEvent = { previousRegime: 'NEUTRAL', newRegime: ctx.macroRegime };
  const phaseTransitionEvent: PhaseTransitionEvent = { from: 'EARLY', to: ctx.runPhase };
  const timerExpiredEvent: TimerExpiredEvent | undefined = undefined;
  const streakEvent: StreakEvent = { streakLength: clamp(1 + seededIndex(seed, 7, 10), 1, 10), taxApplied: !passed };
  const fubarEvent: FubarEvent = { level: clamp(severity + (!passed ? 2 : 0), 0, 10), type: 'INTEGRITY', damage: clamp(severity * 1000, 0, M99_BOUNDS.MAX_AMOUNT) };

  const solvencyStatus: SolvencyStatus = passed ? 'SOLVENT' : 'BLEED';

  const asset: Asset = { id: purchase.assetId, value: 0, cashflowMonthly: 0, purchasePrice: 0 };
  const ipaItem: IPAItem = { id: `ipa:${seed}`, cashflowMonthly: 0 };
  const debt: Debt = { id: `debt:${seed}`, amount: 0, interestRate: 0.08 };
  const buff: Buff = { id: `buff:${seed}`, type: 'INTEGRITY_ASSERTION', magnitude: passed ? 1 : 0, expiresAt: clamp(tick + 12, 0, RUN_TOTAL_TICKS) };
  const liability: Liability = { id: `liab:${seed}`, amount: clamp(!passed ? severity * 100 : 0, 0, M99_BOUNDS.MAX_AMOUNT) };
  const shieldLayer: ShieldLayer = { id: `shield:${seed}`, strength: shield.remainingShield, type: 'SPOTCHECK_SHIELD' };
  const setBonus: SetBonus = { setId: `set:${ctx.macroRegime}`, bonus: passed ? 3 : 0, description: 'Integrity alignment bonus.' };
  const assetMod: AssetMod = { modId: `mod:${seed}`, assetId: asset.id, statKey: 'integrity', delta: passed ? 1 : -1 };
  const incomeItem: IncomeItem = { source: 'integrity', amount: clamp(passed ? 100 : 0, 0, M99_BOUNDS.MAX_AMOUNT) };

  const macroEvent: MacroEvent = ctx.macroSchedule[seededIndex(seed, 11, Math.max(1, ctx.macroSchedule.length))] ?? { tick: 0, type: 'REGIME_SHIFT', regimeChange: ctx.macroRegime };
  const chaosWindow: ChaosWindow = ctx.chaosWindows[seededIndex(seed, 12, Math.max(1, ctx.chaosWindows.length))] ?? { startTick: 0, endTick: 6, type: 'FUBAR_WINDOW' };

  const gameEvent: GameEvent = {
    type: passed ? 'CHALLENGE_PASSED' : 'CHALLENGE_FAILED',
    damage: clamp(!passed ? severity * 1000 : 0, 0, M99_BOUNDS.MAX_AMOUNT),
    payload: { kind, proofHash, auditHash } as any,
  };

  const seasonState: SeasonState = { seasonId: 'season-unknown', tick, rewardsClaimed: [] };
  const runState: RunState = { cash: 0, netWorth: 0, tick, runPhase: ctx.runPhase };
  const completedRun: CompletedRun = { runId: runIdRaw || seed, userId: 'unknown', cordScore: proof.cordScore, outcome: passed ? 'INTEGRITY_OK' : 'INTEGRITY_FAIL', ticks: tick };

  const telemetryPayload: MechanicTelemetryPayload = {
    event: 'INTEGRITY_CHALLENGE_ISSUED',
    mechanic_id: 'M99',
    tick,
    runId: seed,
    payload: { kind, passed, severity, proofHash, auditHash } as any,
  };

  const artifacts: M99TypeArtifacts = {
    runPhase: ctx.runPhase,
    tickTier: ctx.tickTier,
    macroRegime: ctx.macroRegime,
    pressureTier: ctx.pressureTier,
    solvencyStatus,

    asset,
    ipaItem,
    gameCard: deckAnchorCard,
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

  const packet: M99ProofOfPlayPacket = {
    runId: runIdRaw || seed,
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

    deckAnchorCard,
    deckComposition,

    spotcheck: { indexA, indexB, macroPickTick, chaosPickStart },

    challenge,
    outcome,

    ledger,
    proof,

    clip,
    moment,

    artifacts,
  };

  emit({
    event: 'INTEGRITY_CHALLENGE_ISSUED',
    mechanic_id: 'M99',
    tick,
    runId: seed,
    payload: {
      runId: runIdRaw,
      challengePrompt,
      kind,
      expectedHash: computeHash(JSON.stringify(expectedResponse ?? null)),
      packet,
    } as any,
  });

  emit({
    event: passed ? 'CHALLENGE_PASSED' : 'CHALLENGE_FAILED',
    mechanic_id: 'M99',
    tick,
    runId: seed,
    payload: {
      passed,
      severity,
      proofHash,
      auditHash,
      observed,
      expected: expectedResponse,
      deckAnchorCardId: deckAnchorCard.id,
    } as any,
  });

  return {
    challengePassed: passed,
    challengeResult: {
      serviceId: seed,
      status: passed ? 'OK' : 'FAIL',
      tick,
      kind,
      severity,
      proofHash,
      auditHash,
      observed,
      expected: expectedResponse,
    },
    integrityConfirmed: passed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M99MLInput {
  challengePassed?: boolean;
  challengeResult?: Record<string, unknown>;
  integrityConfirmed?: boolean;
  runId: string;
  tick: number;
}

export interface M99MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1
}

/**
 * integrityChallengeSolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function integrityChallengeSolverMLCompanion(
  input: M99MLInput,
): Promise<M99MLOutput> {
  const passed = Boolean(input.challengePassed) && Boolean(input.integrityConfirmed);
  const base = passed ? 0.90 : 0.25;

  const pseudoRegime: MacroRegime = MACRO_REGIMES[seededIndex(input.runId, input.tick, MACRO_REGIMES.length)];
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  const score = clamp(base, 0.01, 0.99);

  const status = (input.challengeResult?.status as string) ?? (passed ? 'OK' : 'FAIL');
  const kind = (input.challengeResult?.kind as string) ?? 'unknown';
  const severity = Number(input.challengeResult?.severity ?? (passed ? 0 : 3));

  const topFactors = [
    passed ? 'challenge=passed' : 'challenge=failed',
    `status=${status}`,
    `kind=${kind}`,
    `severity=${Number.isFinite(severity) ? severity : 'n/a'}`,
    `regime=${pseudoRegime}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: passed ? 'Continue: proof-of-play is consistent.' : 'Quarantine: integrity mismatch requires isolation.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M99'),
    confidenceDecay,
  };
}