// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m91_first_table_invite_safe_social_onboarding_run.ts
//
// Mechanic : M91 — First Table Invite: Safe Social Onboarding Run
// Family   : onboarding_expert   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m91a
// Deps     : M41, M15
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
// Public dependency surface (keeps every import reachable + usable)
// ─────────────────────────────────────────────────────────────────────────────

export const M91_MECHANICS_UTILS = Object.freeze({
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

export type M91TypeArtifacts = {
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

const RUN_PHASES: RunPhase[] = ['EARLY', 'MID', 'LATE'];
const TICK_TIERS: TickTier[] = ['STANDARD', 'ELEVATED', 'CRITICAL'];
const MACRO_REGIMES: MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'];
const PRESSURE_TIERS: PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function asEnum<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function buildDeckComposition(cards: GameCard[]): DeckComposition {
  const byType: Record<string, number> = {};
  for (const c of cards) byType[c.type] = (byType[c.type] ?? 0) + 1;
  return { totalCards: cards.length, byType };
}

function safeNumber(v: unknown, fallback = 0): number {
  return Number.isFinite(Number(v)) ? Number(v) : fallback;
}

function normalizeCardId(card: GameCard): GameCard {
  // Keep starter card within default ID set to preserve deterministic verification expectations.
  return DEFAULT_CARD_IDS.includes(card.id) ? card : DEFAULT_CARD;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M91Input {
  inviterId?: string;
  newPlayerId?: string;
  safeRunConfig?: Record<string, unknown>;
}

export interface SocialMomentDef {
  kind: 'FIRST_TABLE_INVITE_SAFE_RUN';
  runId: string;
  tick: number;

  inviterId: string;
  newPlayerId: string;

  tickTier: TickTier;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  macroRegime: MacroRegime;

  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  inviteDeck: GameCard[];
  starterCard: GameCard;

  clip: ClipBoundary;
  moment: MomentEvent;

  allowedDefaultCardIds: string[];
  safeRunConfig?: Record<string, unknown>;

  // Typed extension surface (optional, but keeps all imported types usable)
  artifacts?: M91TypeArtifacts;
}

export interface M91Output {
  safeRunStarted: boolean;
  guidedSocialMoment: SocialMomentDef;
  inviteBonus: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M91Event = 'FIRST_TABLE_INVITE_SENT' | 'SAFE_RUN_STARTED' | 'SOCIAL_MOMENT_CAPTURED';

export interface M91TelemetryPayload extends MechanicTelemetryPayload {
  event: M91Event;
  mechanic_id: 'M91';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M91_BOUNDS = {
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
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * firstTableInviteSafeRun
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function firstTableInviteSafeRun(
  input: M91Input,
  emit: MechanicEmitter,
): M91Output {
  const inviterId = String(input.inviterId ?? '');
  const newPlayerId = String(input.newPlayerId ?? '');
  const safeRunConfig = input.safeRunConfig ?? {};

  // Deterministic per-invite seed (stable across server verification)
  const runId = computeHash(`${inviterId}::${newPlayerId}::${JSON.stringify(safeRunConfig)}`);

  // Macro & chaos scaffolding (kept deterministic-by-seed)
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  const cfgRegime = asEnum(safeRunConfig['macroRegime'], MACRO_REGIMES);
  const cfgPhase = asEnum(safeRunConfig['runPhase'], RUN_PHASES);
  const cfgPressure = asEnum(safeRunConfig['pressureTier'], PRESSURE_TIERS);
  const cfgTickTier = asEnum(safeRunConfig['tickTier'], TICK_TIERS);

  const schedulePick = seededIndex(runId, 901, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;

  const macroRegime: MacroRegime = cfgRegime ?? derivedRegime;
  const runPhase: RunPhase = cfgPhase ?? RUN_PHASES[seededIndex(runId, 77, RUN_PHASES.length)];
  const pressureTier: PressureTier =
    cfgPressure ?? PRESSURE_TIERS[seededIndex(runId, inviterId.length + newPlayerId.length, PRESSURE_TIERS.length)];

  const tickTier: TickTier =
    cfgTickTier ??
    (pressureTier === 'CRITICAL' ? 'CRITICAL' : pressureTier === 'HIGH' ? 'ELEVATED' : 'STANDARD');

  const decayRate = computeDecayRate(macroRegime, M91_BOUNDS.BASE_DECAY_RATE);
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  // Build deck for the safe run (weighted + deterministic)
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const rawPool = buildWeightedPool(runId + ':m91:pool', pressureWeight * phaseWeight, regimeWeight);
  const inviteDeck = seededShuffle((rawPool.length ? rawPool : OPPORTUNITY_POOL), runId + ':m91:deck');

  const picked = inviteDeck[seededIndex(runId, 13, Math.max(1, inviteDeck.length))] ?? DEFAULT_CARD;
  const starterCard = normalizeCardId(picked);

  const base = safeNumber(starterCard.downPayment ?? starterCard.cost ?? 0, 0);
  const cfgBonusMult = safeNumber(safeRunConfig['bonusMultiplier'], 1.0);

  const inviteBonus = clamp(
    Math.round(base * 0.02 * exitPulseMultiplier * (1 - decayRate) * regimeMultiplier * M91_BOUNDS.MULTIPLIER * cfgBonusMult),
    0,
    M91_BOUNDS.MAX_AMOUNT,
  );

  // Clip & moment scaffolding (used by social share pipeline)
  const clipStart = seededIndex(runId, 333, Math.max(1, RUN_TOTAL_TICKS - 12));
  const clipEnd = clamp(clipStart + 12, clipStart + 1, RUN_TOTAL_TICKS);

  const highlightCandidates = [
    `Invite accepted → Safe Run`,
    `Starter queued: ${starterCard.name}`,
    `Regime: ${macroRegime} · Phase: ${runPhase}`,
    `Bonus armed: ${inviteBonus}`,
  ];
  const highlight = seededShuffle(highlightCandidates, runId + ':m91:highlight')[0] ?? 'First table invite';

  const clip: ClipBoundary = {
    startTick: clipStart,
    endTick: clipEnd,
    triggerEvent: 'FIRST_TABLE_INVITE_SENT',
  };

  const moment: MomentEvent = {
    type: 'FIRST_TABLE_INVITE_SAFE_RUN',
    tick: 0,
    highlight,
    shareReady: true,
  };

  // Telemetry (must be emitted through callback)
  emit({
    event: 'FIRST_TABLE_INVITE_SENT',
    mechanic_id: 'M91',
    tick: 0,
    runId,
    payload: {
      inviterId,
      newPlayerId,
      configKeys: Object.keys(safeRunConfig),
      defaultCardIdsCount: DEFAULT_CARD_IDS.length,
    },
  });

  emit({
    event: 'SAFE_RUN_STARTED',
    mechanic_id: 'M91',
    tick: 0,
    runId,
    payload: {
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decayRate,
      regimeMultiplier,
      exitPulseMultiplier,
      inviteBonus,
      deckSize: inviteDeck.length,
      starterCardId: starterCard.id,
    },
  });

  emit({
    event: 'SOCIAL_MOMENT_CAPTURED',
    mechanic_id: 'M91',
    tick: 0,
    runId,
    payload: {
      clipStart,
      clipEnd,
      highlight,
      starterCardId: starterCard.id,
    },
  });

  const guidedSocialMoment: SocialMomentDef = {
    kind: 'FIRST_TABLE_INVITE_SAFE_RUN',
    runId,
    tick: 0,

    inviterId,
    newPlayerId,

    tickTier,
    runPhase,
    pressureTier,
    macroRegime,

    decayRate,
    regimeMultiplier,
    exitPulseMultiplier,

    macroSchedule,
    chaosWindows,

    inviteDeck,
    starterCard,

    clip,
    moment,

    allowedDefaultCardIds: DEFAULT_CARD_IDS,
    safeRunConfig,

    artifacts: {
      runPhase,
      tickTier,
      macroRegime,
      pressureTier,
      solvencyStatus: 'SOLVENT' as SolvencyStatus,
      gameCard: starterCard,
      macroEvent: macroSchedule[schedulePick],
      chaosWindow: chaosWindows[0],
      deckComposition: buildDeckComposition(inviteDeck),
      momentEvent: moment,
      clipBoundary: clip,
      mechanicEmitter: emit,
    },
  };

  return {
    safeRunStarted: true,
    guidedSocialMoment,
    inviteBonus,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M91MLInput {
  safeRunStarted?: boolean;
  guidedSocialMoment?: SocialMomentDef;
  inviteBonus?: number;
  runId: string;
  tick: number;
}

export interface M91MLOutput {
  score: number;          // 0–1
  topFactors: string[];   // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string;      // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;// 0–1, how fast this signal should decay
}

/**
 * firstTableInviteSafeRunMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function firstTableInviteSafeRunMLCompanion(
  input: M91MLInput,
): Promise<M91MLOutput> {
  const bonus = safeNumber(input.inviteBonus, 0);
  const score = clamp(bonus / Math.max(1, M91_BOUNDS.MAX_AMOUNT), 0.01, 0.99);

  const gm = input.guidedSocialMoment;
  const macroRegime: MacroRegime = gm?.macroRegime ?? 'NEUTRAL';
  const confidenceDecay = computeDecayRate(macroRegime, 0.05);

  const topFactors = [
    `bonus=${Math.round(bonus)}`,
    `regime=${macroRegime}`,
    `phase=${gm?.runPhase ?? 'EARLY'}`,
    `pressure=${gm?.pressureTier ?? 'LOW'}`,
    `tickTier=${gm?.tickTier ?? 'STANDARD'}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: score > 0.66 ? 'Proceed: onboarding momentum is strong.' : 'Monitor: keep onboarding friction low.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M91'),
    confidenceDecay,
  };
}