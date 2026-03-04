// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m92_ghost_mentor_theater_watch_copy_decision_ghosts.ts
//
// Mechanic : M92 — Ghost Mentor Theater: Watch + Copy Decision Ghosts
// Family   : onboarding_expert   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m92a
// Deps     : M24, M48
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

export const M92_MECHANICS_UTILS = Object.freeze({
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

export type M92TypeArtifacts = {
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

export const M92_DEFAULTS: Readonly<{
  runPhase: RunPhase;
  tickTier: TickTier;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  solvencyStatus: SolvencyStatus;
}> = Object.freeze({
  runPhase: 'EARLY',
  tickTier: 'STANDARD',
  macroRegime: 'NEUTRAL',
  pressureTier: 'LOW',
  solvencyStatus: 'SOLVENT',
});

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface GhostPayload {
  mentorUserId?: string;
  mentorRun?: CompletedRun;
  mentorProof?: ProofCard;
  mentorSeason?: SeasonState;
  mentorSnapshot?: RunState;

  // Optional deterministic “replay” artifacts
  ledger?: LedgerEntry[];

  // Optional editorial hints (still deterministic when present)
  macroRegimeHint?: MacroRegime;
  runPhaseHint?: RunPhase;
  pressureTierHint?: PressureTier;
  tickTierHint?: TickTier;

  // Optional media hooks
  moment?: MomentEvent;
  clip?: ClipBoundary;
}

export interface GhostTheaterView {
  runId: string;
  mentorRunId: string;
  watcherPlayerId: string;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  recommendedCard: GameCard;
  altCards: GameCard[];
  deckComposition: DeckComposition;

  regimeShift: RegimeShiftEvent;
  phaseTransition: PhaseTransitionEvent | null;

  copyPurchase: PurchaseResult;
  copyLedgerEntry: LedgerEntry;

  moment: MomentEvent;
  clip: ClipBoundary;

  proof: ProofCard;
}

export interface M92Input {
  mentorRunId?: string;
  ghostPayload?: GhostPayload;
  watcherPlayerId?: string;
}

export interface M92Output {
  ghostTheaterLoaded: boolean;
  decisionAnnotated: boolean;
  replayViewed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M92Event = 'GHOST_THEATER_STARTED' | 'DECISION_COPIED' | 'GHOST_REPLAY_ENDED';

export interface M92TelemetryPayload extends MechanicTelemetryPayload {
  event: M92Event;
  mechanic_id: 'M92';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M92_BOUNDS = {
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

function asEnum<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

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

function normalizeToDefaultPool(card: GameCard): GameCard {
  // Keeps runtime invariants stable for server verification (default pool IDs only).
  return DEFAULT_CARD_IDS.includes(card.id) ? card : DEFAULT_CARD;
}

function makeClip(runId: string): ClipBoundary {
  const start = seededIndex(runId, 920, Math.max(1, RUN_TOTAL_TICKS - 12));
  const end = clamp(start + 12, start + 1, RUN_TOTAL_TICKS);
  return { startTick: start, endTick: end, triggerEvent: 'GHOST_THEATER_STARTED' };
}

function makeMoment(runId: string, highlight: string): MomentEvent {
  return { type: 'GHOST_MENTOR_THEATER', tick: 0, highlight, shareReady: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ghostMentorTheaterLoader
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function ghostMentorTheaterLoader(
  input: M92Input,
  emit: MechanicEmitter,
): M92Output {
  const mentorRunId = safeString(input.mentorRunId);
  const watcherPlayerId = safeString(input.watcherPlayerId);
  const ghostPayload = input.ghostPayload;

  const seedMaterial = JSON.stringify({
    mentorRunId,
    watcherPlayerId,
    ghostPayload: ghostPayload ? {
      mentorUserId: ghostPayload.mentorUserId ?? '',
      macroRegimeHint: ghostPayload.macroRegimeHint ?? '',
      runPhaseHint: ghostPayload.runPhaseHint ?? '',
      pressureTierHint: ghostPayload.pressureTierHint ?? '',
      tickTierHint: ghostPayload.tickTierHint ?? '',
      ledgerLen: ghostPayload.ledger?.length ?? 0,
    } : null,
  });

  const runId = computeHash(`M92:${seedMaterial}`);

  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  const schedulePick = seededIndex(runId, 92, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;

  const macroRegime: MacroRegime =
    asEnum(ghostPayload?.macroRegimeHint, MACRO_REGIMES) ??
    derivedRegime;

  const runPhase: RunPhase =
    asEnum(ghostPayload?.runPhaseHint, RUN_PHASES) ??
    RUN_PHASES[seededIndex(runId, 93, RUN_PHASES.length)];

  const pressureTier: PressureTier =
    asEnum(ghostPayload?.pressureTierHint, PRESSURE_TIERS) ??
    PRESSURE_TIERS[seededIndex(runId, 94, PRESSURE_TIERS.length)];

  const tickTier: TickTier =
    asEnum(ghostPayload?.tickTierHint, TICK_TIERS) ??
    (pressureTier === 'CRITICAL' ? 'CRITICAL' : pressureTier === 'HIGH' ? 'ELEVATED' : 'STANDARD');

  const decayRate = computeDecayRate(macroRegime, M92_BOUNDS.BASE_DECAY_RATE);
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(
    `${runId}:m92:pool`,
    pressureWeight * phaseWeight,
    regimeWeight,
  );

  const deck = seededShuffle((weightedPool.length ? weightedPool : OPPORTUNITY_POOL), `${runId}:m92:deck`);
  const deckComp = buildDeckComposition(deck);

  const pickIdx = seededIndex(runId, 95, Math.max(1, deck.length));
  const recommendedCard = normalizeToDefaultPool(deck[pickIdx] ?? DEFAULT_CARD);

  const altCards = seededShuffle(deck, `${runId}:m92:alts`).slice(0, clamp(3, 0, deck.length));
  const copyCost = safeNumber(recommendedCard.downPayment ?? recommendedCard.cost ?? 0, 0);

  const copyPurchase: PurchaseResult = {
    success: true,
    assetId: `ghost-asset:${recommendedCard.id}`,
    cashSpent: clamp(Math.round(copyCost), 0, M92_BOUNDS.MAX_AMOUNT),
    leverageAdded: clamp(Math.round(copyCost * 0.25), 0, M92_BOUNDS.MAX_AMOUNT),
    reason: 'GHOST_COPY_RECOMMENDATION',
  };

  const copyLedgerEntry: LedgerEntry = {
    gameAction: { type: 'GHOST_COPY', cardId: recommendedCard.id, watcherPlayerId, mentorRunId },
    tick: 0,
    hash: computeHash(`${runId}:ledger:0:${recommendedCard.id}`),
  };

  const clip = ghostPayload?.clip ?? makeClip(runId);
  const moment = ghostPayload?.moment ?? makeMoment(
    runId,
    `Copy this decision: ${recommendedCard.name} (${macroRegime}/${runPhase}/${pressureTier})`,
  );

  const proof: ProofCard = {
    runId,
    cordScore: clamp(Math.round((1 - decayRate) * 100), 0, 100),
    hash: computeHash(`${runId}:proof:${recommendedCard.id}`),
    grade: (macroRegime === 'BULL' ? 'A' : macroRegime === 'NEUTRAL' ? 'B' : macroRegime === 'BEAR' ? 'C' : 'D'),
  };

  const regimeShift: RegimeShiftEvent = {
    previousRegime: 'NEUTRAL',
    newRegime: macroRegime,
  };

  const phaseTransition: PhaseTransitionEvent | null =
    runPhase === 'MID' ? { from: 'EARLY', to: 'MID' } :
    runPhase === 'LATE' ? { from: 'MID', to: 'LATE' } :
    null;

  const view: GhostTheaterView = {
    runId,
    mentorRunId,
    watcherPlayerId,

    macroRegime,
    runPhase,
    pressureTier,
    tickTier,

    decayRate,
    regimeMultiplier,
    exitPulseMultiplier,

    macroSchedule,
    chaosWindows,

    recommendedCard,
    altCards,
    deckComposition: deckComp,

    regimeShift,
    phaseTransition,

    copyPurchase,
    copyLedgerEntry,

    moment,
    clip,

    proof,
  };

  emit({
    event: 'GHOST_THEATER_STARTED',
    mechanic_id: 'M92',
    tick: 0,
    runId,
    payload: {
      mentorRunId,
      watcherPlayerId,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decayRate,
      regimeMultiplier,
      exitPulseMultiplier,
      defaultCardIdsCount: DEFAULT_CARD_IDS.length,
      view,
    },
  });

  emit({
    event: 'DECISION_COPIED',
    mechanic_id: 'M92',
    tick: 0,
    runId,
    payload: {
      cardId: recommendedCard.id,
      cardName: recommendedCard.name,
      purchase: copyPurchase,
      ledger: copyLedgerEntry,
      clip,
      moment,
      proof,
    },
  });

  emit({
    event: 'GHOST_REPLAY_ENDED',
    mechanic_id: 'M92',
    tick: 0,
    runId,
    payload: {
      replayViewed: Boolean(ghostPayload?.ledger && ghostPayload.ledger.length > 0),
      ledgerLen: ghostPayload?.ledger?.length ?? 0,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
    },
  });

  return {
    ghostTheaterLoaded: true,
    decisionAnnotated: true,
    replayViewed: Boolean(ghostPayload?.ledger && ghostPayload.ledger.length > 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M92MLInput {
  ghostTheaterLoaded?: boolean;
  decisionAnnotated?: boolean;
  replayViewed?: boolean;
  runId: string;
  tick: number;
}

export interface M92MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * ghostMentorTheaterLoaderMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function ghostMentorTheaterLoaderMLCompanion(
  input: M92MLInput,
): Promise<M92MLOutput> {
  const base = (input.ghostTheaterLoaded ? 0.35 : 0.05)
    + (input.decisionAnnotated ? 0.35 : 0.05)
    + (input.replayViewed ? 0.20 : 0.05);

  const score = clamp(base, 0.01, 0.99);

  // Deterministic decay tied to a derived regime from the runId so identical runs decay identically.
  const pseudoRegime: MacroRegime = MACRO_REGIMES[seededIndex(input.runId, input.tick, MACRO_REGIMES.length)];
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  const topFactors = [
    input.ghostTheaterLoaded ? 'theater loaded' : 'theater not loaded',
    input.decisionAnnotated ? 'decision annotated' : 'no annotation',
    input.replayViewed ? 'replay viewed' : 'replay not viewed',
    `regime=${pseudoRegime}`,
    `pulse=${EXIT_PULSE_MULTIPLIERS[pseudoRegime] ?? 1.0}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: score > 0.66 ? 'Copy the ghost decision and keep tempo.' : 'Rewatch the ghost and validate the choice.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M92'),
    confidenceDecay,
  };
}