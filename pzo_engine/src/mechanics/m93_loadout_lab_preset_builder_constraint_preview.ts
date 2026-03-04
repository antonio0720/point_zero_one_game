// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m93_loadout_lab_preset_builder_constraint_preview.ts
//
// Mechanic : M93 — Loadout Lab: Preset Builder + Constraint Preview
// Family   : onboarding_expert   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m93a
// Deps     : M14, M44
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

export const M93_MECHANICS_UTILS = Object.freeze({
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

export type M93TypeArtifacts = {
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
// Local contracts (these were referenced but not defined in the auto-gen file)
// ─────────────────────────────────────────────────────────────────────────────

export interface HandicapOption {
  id: string;
  label: string;
  severity: 1 | 2 | 3; // 1=light, 2=medium, 3=hard
  cashPenalty?: number;           // absolute dollars
  cashflowPenalty?: number;       // monthly dollars
  timerPenaltyTicks?: number;     // ticks removed from the run clock
  tags?: string[];
}

export interface SavedPreset {
  presetId: string;
  seed: string;
  createdTick: number;

  runPhase: RunPhase;
  tickTier: TickTier;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;

  selectedAdvantages: unknown[];
  selectedHandicaps: HandicapOption[];

  deck: GameCard[];
  deckComposition: DeckComposition;

  ledger: LedgerEntry;
  proof: ProofCard;

  // Optional: provides typed anchors for any downstream systems that want them.
  artifacts?: M93TypeArtifacts;
}

export interface ConstraintPreview {
  runId: string;

  cashDelta: number;
  cashflowDelta: number;
  timerTicks: number;

  leverageCap: number;
  shieldCap: number;
  wipeRisk: number; // 0..1

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  regimeShift: RegimeShiftEvent;
  phaseTransition: PhaseTransitionEvent;

  clip: ClipBoundary;
  moment: MomentEvent;

  // deterministic “example outcomes” (preview only)
  auction: AuctionResult;
  purchase: PurchaseResult;
  shield: ShieldResult;
  exit: ExitResult;
  tick: TickResult;
  streak: StreakEvent;
  fubar: FubarEvent;
  timerExpired: TimerExpiredEvent | null;
  wipe: WipeEvent | null;

  artifacts?: M93TypeArtifacts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface M93Input {
  presetConfig?: Record<string, unknown>;
  advantageOptions?: unknown[];
  handicapOptions?: HandicapOption[];
}

export interface M93Output {
  savedPreset: SavedPreset;
  constraintPreview: ConstraintPreview;
  cordPremiumEstimate: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry
// ─────────────────────────────────────────────────────────────────────────────

export type M93Event = 'PRESET_SAVED' | 'CONSTRAINT_PREVIEWED' | 'LOADOUT_APPLIED';

export interface M93TelemetryPayload extends MechanicTelemetryPayload {
  event: M93Event;
  mechanic_id: 'M93';
}

// ─────────────────────────────────────────────────────────────────────────────
// Design bounds (never mutate at runtime)
// ─────────────────────────────────────────────────────────────────────────────

export const M93_BOUNDS = {
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

function makeClip(runId: string): ClipBoundary {
  const start = seededIndex(runId, 930, Math.max(1, RUN_TOTAL_TICKS - 12));
  const end = clamp(start + 12, start + 1, RUN_TOTAL_TICKS);
  return { startTick: start, endTick: end, triggerEvent: 'PRESET_SAVED' };
}

function makeMoment(tick: number, highlight: string): MomentEvent {
  return { type: 'LOADOUT_LAB_PRESET', tick, highlight, shareReady: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exec hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * loadoutLabPresetBuilder
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function loadoutLabPresetBuilder(
  input: M93Input,
  emit: MechanicEmitter,
): M93Output {
  const presetConfig = input.presetConfig ?? {};
  const advantageOptions = (input.advantageOptions as unknown[]) ?? [];
  const handicapOptions = (input.handicapOptions as HandicapOption[]) ?? [];

  // Deterministic identity for this preset build
  const runId = computeHash(`M93:${JSON.stringify({ presetConfig, advLen: advantageOptions.length, hcapLen: handicapOptions.length })}`);
  const presetSeed = computeHash(`${runId}:preset`);
  const tick = 0;

  // Derive macro + chaos timelines (preview scaffolding)
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  const schedulePick = seededIndex(runId, 93, Math.max(1, macroSchedule.length));
  const derivedRegime = (macroSchedule[schedulePick]?.regimeChange ?? 'NEUTRAL') as MacroRegime;

  const macroRegime: MacroRegime =
    asEnum(presetConfig['macroRegime'], MACRO_REGIMES) ??
    derivedRegime;

  const runPhase: RunPhase =
    asEnum(presetConfig['runPhase'], RUN_PHASES) ??
    RUN_PHASES[seededIndex(runId, 931, RUN_PHASES.length)];

  const pressureTier: PressureTier =
    asEnum(presetConfig['pressureTier'], PRESSURE_TIERS) ??
    PRESSURE_TIERS[seededIndex(runId, 932, PRESSURE_TIERS.length)];

  const tickTier: TickTier =
    asEnum(presetConfig['tickTier'], TICK_TIERS) ??
    (pressureTier === 'CRITICAL' ? 'CRITICAL' : pressureTier === 'HIGH' ? 'ELEVATED' : 'STANDARD');

  // Deterministic selection counts (bounded)
  const maxAdv = clamp(seededIndex(presetSeed, 1, 4) + 1, 0, 4);
  const maxHcap = clamp(seededIndex(presetSeed, 2, 3) + 1, 0, 3);

  const selectedAdvantages = seededShuffle(advantageOptions, `${presetSeed}:adv`).slice(0, Math.min(maxAdv, advantageOptions.length));
  const selectedHandicaps = seededShuffle(handicapOptions, `${presetSeed}:hcap`).slice(0, Math.min(maxHcap, handicapOptions.length));

  const handicapSeveritySum = selectedHandicaps.reduce((s, h) => s + (h?.severity ?? 1), 0);
  const cashPenalty = selectedHandicaps.reduce((s, h) => s + safeNumber(h?.cashPenalty, 0), 0);
  const cashflowPenalty = selectedHandicaps.reduce((s, h) => s + safeNumber(h?.cashflowPenalty, 0), 0);
  const timerPenaltyTicks = selectedHandicaps.reduce((s, h) => s + safeNumber(h?.timerPenaltyTicks, 0), 0);

  // Weights influence the pool and the preview economics
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decayRate = computeDecayRate(macroRegime, M93_BOUNDS.BASE_DECAY_RATE);

  // Build a deterministic deck from weighted pool + fallback opportunity pool
  const weightedPool = buildWeightedPool(`${runId}:m93:pool`, pressureWeight * phaseWeight, regimeWeight);
  const combinedPool = [...weightedPool, ...OPPORTUNITY_POOL];
  const deckSize = clamp(6 + selectedAdvantages.length - handicapSeveritySum, 3, 10);
  const deck = seededShuffle(combinedPool, `${runId}:m93:deck`).slice(0, Math.min(deckSize, combinedPool.length));
  const normalizedDeck = deck.map(normalizeDefaultCard);
  const deckComposition = buildDeckComposition(normalizedDeck);

  const pickIdx = seededIndex(runId, 933, Math.max(1, normalizedDeck.length));
  const anchorCard = normalizeDefaultCard(normalizedDeck[pickIdx] ?? DEFAULT_CARD);

  // Constraint preview numbers (bounded)
  const advCount = selectedAdvantages.length;

  const cashDelta = clamp(
    Math.round((advCount * 1250) - cashPenalty),
    M93_BOUNDS.MIN_CASH_DELTA,
    M93_BOUNDS.MAX_CASH_DELTA,
  );

  const cashflowDelta = clamp(
    Math.round((advCount * 400) - cashflowPenalty),
    M93_BOUNDS.MIN_CASHFLOW_DELTA,
    M93_BOUNDS.MAX_CASHFLOW_DELTA,
  );

  const timerTicks = clamp(
    RUN_TOTAL_TICKS - timerPenaltyTicks - (handicapSeveritySum * 2),
    24,
    RUN_TOTAL_TICKS,
  );

  const leverageCap = clamp(
    Math.round(M93_BOUNDS.MAX_AMOUNT * (1 - decayRate) * regimeMultiplier),
    5_000,
    M93_BOUNDS.MAX_AMOUNT,
  );

  const shieldCap = clamp(
    Math.round(M93_BOUNDS.MAX_AMOUNT * 0.2 * phaseWeight),
    0,
    M93_BOUNDS.MAX_AMOUNT,
  );

  const wipeRisk = clamp(
    (pressureTier === 'CRITICAL' ? 0.65 : pressureTier === 'HIGH' ? 0.45 : pressureTier === 'MEDIUM' ? 0.30 : 0.18)
      + (handicapSeveritySum * 0.06)
      - (advCount * 0.04),
    0,
    0.95,
  );

  // Premium estimate: “what you pay” in CORD terms for power/comfort
  const basePremium = Math.max(0, (advCount * 900) - (handicapSeveritySum * 650));
  const cordPremiumEstimate = clamp(
    Math.round(basePremium * M93_BOUNDS.MULTIPLIER * (1 - decayRate) * regimeMultiplier * exitPulseMultiplier),
    0,
    M93_BOUNDS.MAX_AMOUNT,
  );

  // Deterministic events for preview (typed anchors)
  const regimeShift: RegimeShiftEvent = { previousRegime: 'NEUTRAL', newRegime: macroRegime };
  const phaseTransition: PhaseTransitionEvent = {
    from: runPhase === 'LATE' ? 'MID' : 'EARLY',
    to: runPhase,
  };

  const clip = makeClip(runId);
  const moment = makeMoment(tick, `Preset built: ${macroRegime}/${runPhase}/${pressureTier} · deck=${normalizedDeck.length}`);

  const auction: AuctionResult = {
    winnerId: `preset:${presetSeed}`,
    winnerBid: clamp(Math.round(2_000 * exitPulseMultiplier), 0, M93_BOUNDS.MAX_AMOUNT),
    expired: false,
  };

  const purchase: PurchaseResult = {
    success: true,
    assetId: `preset-asset:${anchorCard.id}`,
    cashSpent: clamp(Math.round(safeNumber(anchorCard.downPayment ?? anchorCard.cost ?? 0, 0)), 0, M93_BOUNDS.MAX_AMOUNT),
    leverageAdded: clamp(Math.round(safeNumber(anchorCard.cost ?? 0, 0) * 0.25), 0, leverageCap),
    reason: 'LOADOUT_PRESET_ANCHOR',
  };

  const shield: ShieldResult = {
    absorbed: clamp(Math.round(shieldCap * 0.35), 0, shieldCap),
    pierced: shieldCap < 5_000,
    depleted: shieldCap === 0,
    remainingShield: clamp(shieldCap - Math.round(shieldCap * 0.35), 0, shieldCap),
  };

  const exit: ExitResult = {
    assetId: purchase.assetId,
    saleProceeds: clamp(Math.round(purchase.cashSpent * 1.12 * exitPulseMultiplier), 0, M93_BOUNDS.MAX_PROCEEDS),
    capitalGain: clamp(Math.round(purchase.cashSpent * 0.12), 0, M93_BOUNDS.MAX_PROCEEDS),
    timingScore: clamp(Math.round(50 * (1 - decayRate) * regimeMultiplier), 0, 100),
    macroRegime,
  };

  const timerExpired: TimerExpiredEvent | null =
    timerTicks <= M93_BOUNDS.FIRST_REFUSAL_TICKS ? { tick } : null;

  const tickResult: TickResult = {
    tick,
    runPhase,
    timerExpired: Boolean(timerExpired),
  };

  const streak: StreakEvent = {
    streakLength: clamp(advCount + 1, 1, 10),
    taxApplied: pressureTier === 'HIGH' || pressureTier === 'CRITICAL',
  };

  const fubar: FubarEvent = {
    level: clamp(handicapSeveritySum, 0, 10),
    type: 'LOADOUT_CONSTRAINT_FRICTION',
    damage: clamp(Math.round(750 * handicapSeveritySum * (1 - regimeMultiplier)), 0, M93_BOUNDS.MAX_AMOUNT),
  };

  const wipe: WipeEvent | null =
    wipeRisk > 0.8
      ? { reason: 'PREVIEW_HIGH_RISK', tick, cash: cashDelta, netWorth: cashDelta + (cashflowDelta * 12) }
      : null;

  // Proof + ledger artifacts (server-verifiable envelope)
  const ledger: LedgerEntry = {
    gameAction: {
      type: 'M93_PRESET_SAVE',
      presetId: `M93:${presetSeed}`,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      deckIds: normalizedDeck.map(c => c.id),
    },
    tick,
    hash: computeHash(`${runId}:ledger:${tick}:${presetSeed}`),
  };

  const proof: ProofCard = {
    runId,
    cordScore: clamp(Math.round((1 - decayRate) * 100) - Math.round(wipeRisk * 25) + (advCount * 3), 0, 100),
    hash: computeHash(`${runId}:proof:${presetSeed}:${ledger.hash}`),
    grade: macroRegime === 'BULL' ? 'A' : macroRegime === 'NEUTRAL' ? 'B' : macroRegime === 'BEAR' ? 'C' : 'D',
  };

  // Typed artifact pack (touches every imported type; stays optional downstream)
  const artifactPack: M93TypeArtifacts = {
    runPhase,
    tickTier,
    macroRegime,
    pressureTier,
    solvencyStatus: (wipe ? 'WIPED' : cashDelta < -M93_BOUNDS.BLEED_CASH_THRESHOLD ? 'BLEED' : 'SOLVENT') as SolvencyStatus,

    asset: { id: `asset:${anchorCard.id}`, value: purchase.cashSpent, cashflowMonthly: cashflowDelta, purchasePrice: purchase.cashSpent },
    ipaItem: { id: `ipa:${presetSeed}`, cashflowMonthly: cashflowDelta },

    gameCard: anchorCard,
    gameEvent: { type: 'LOADOUT_PREVIEW', damage: Math.max(0, -cashDelta), payload: { wipeRisk } },

    shieldLayer: { id: `shield:${presetSeed}`, strength: shieldCap, type: 'PRESET_SHIELD_CAP' },
    debt: { id: `debt:${presetSeed}`, amount: purchase.leverageAdded, interestRate: 0.08 },
    buff: { id: `buff:${presetSeed}`, type: 'ADVANTAGE_STACK', magnitude: advCount, expiresAt: timerTicks },
    liability: { id: `liab:${presetSeed}`, amount: Math.max(0, cashPenalty) },

    setBonus: { setId: `set:${macroRegime}`, bonus: advCount, description: 'Macro-aligned starter kit synergy (preview).' },
    assetMod: { modId: `mod:${presetSeed}`, assetId: `asset:${anchorCard.id}`, statKey: 'timerTicks', delta: -timerPenaltyTicks },
    incomeItem: { source: 'presetPreview', amount: cashflowDelta },

    macroEvent: macroSchedule[schedulePick],
    chaosWindow: chaosWindows[0],

    auctionResult: auction,
    purchaseResult: purchase,
    shieldResult: shield,
    exitResult: exit,
    tickResult,

    deckComposition,
    tierProgress: {
      currentTier: pressureTier,
      progressPct: clamp(0.25 + (advCount * 0.05) - (handicapSeveritySum * 0.03), 0, 1),
    },

    wipeEvent: wipe ?? undefined,
    regimeShiftEvent: regimeShift,
    phaseTransitionEvent: phaseTransition,
    timerExpiredEvent: timerExpired ?? undefined,
    streakEvent: streak,
    fubarEvent: fubar,

    ledgerEntry: ledger,
    proofCard: proof,

    completedRun: { runId, userId: 'preview', cordScore: proof.cordScore, outcome: 'PRESET_PREVIEW', ticks: timerTicks },
    seasonState: { seasonId: 'season-preview', tick, rewardsClaimed: [] },
    runState: { cash: cashDelta, netWorth: cashDelta + (cashflowDelta * 12), tick, runPhase },

    momentEvent: moment,
    clipBoundary: clip,

    telemetryPayload: { event: 'PRESET_SAVED', mechanic_id: 'M93', tick, runId, payload: { presetSeed } },
    mechanicEmitter: emit,
  };

  const savedPreset: SavedPreset = {
    presetId: `M93:${presetSeed}`,
    seed: presetSeed,
    createdTick: tick,

    runPhase,
    tickTier,
    macroRegime,
    pressureTier,

    selectedAdvantages,
    selectedHandicaps,

    deck: normalizedDeck,
    deckComposition,

    ledger,
    proof,

    artifacts: artifactPack,
  };

  const constraintPreview: ConstraintPreview = {
    runId,

    cashDelta,
    cashflowDelta,
    timerTicks,

    leverageCap,
    shieldCap,
    wipeRisk,

    macroSchedule,
    chaosWindows,

    regimeShift,
    phaseTransition,

    clip,
    moment,

    auction,
    purchase,
    shield,
    exit,
    tick: tickResult,
    streak,
    fubar,
    timerExpired,
    wipe,

    artifacts: artifactPack,
  };

  emit({
    event: 'PRESET_SAVED',
    mechanic_id: 'M93',
    tick,
    runId,
    payload: {
      presetId: savedPreset.presetId,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      advantages: selectedAdvantages.length,
      handicaps: selectedHandicaps.length,
      deckSize: normalizedDeck.length,
      cordPremiumEstimate,
      proof: { cordScore: proof.cordScore, grade: proof.grade },
    },
  });

  emit({
    event: 'CONSTRAINT_PREVIEWED',
    mechanic_id: 'M93',
    tick,
    runId,
    payload: {
      cashDelta,
      cashflowDelta,
      timerTicks,
      leverageCap,
      shieldCap,
      wipeRisk,
      regimeShift,
      phaseTransition,
      anchorCardId: anchorCard.id,
      exitPulseMultiplier,
      regimeMultiplier,
      decayRate,
    },
  });

  emit({
    event: 'LOADOUT_APPLIED',
    mechanic_id: 'M93',
    tick,
    runId,
    payload: {
      presetId: savedPreset.presetId,
      appliedDeckIds: normalizedDeck.map(c => c.id),
      purchase,
      shield,
      exit,
      clip,
      moment,
      ledgerHash: ledger.hash,
      proofHash: proof.hash,
    },
  });

  return {
    savedPreset,
    constraintPreview,
    cordPremiumEstimate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ML companion hook
// ─────────────────────────────────────────────────────────────────────────────

export interface M93MLInput {
  savedPreset?: SavedPreset;
  constraintPreview?: ConstraintPreview;
  cordPremiumEstimate?: number;
  runId: string;
  tick: number;
}

export interface M93MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // inputs+outputs+rulesVersion hash
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * loadoutLabPresetBuilderMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function loadoutLabPresetBuilderMLCompanion(
  input: M93MLInput,
): Promise<M93MLOutput> {
  const premium = safeNumber(input.cordPremiumEstimate, 0);
  const score = clamp(premium / Math.max(1, M93_BOUNDS.MAX_AMOUNT), 0.01, 0.99);

  // Derive deterministic “confidence decay” from runId + tick (no state mutation)
  const pseudoRegime: MacroRegime = MACRO_REGIMES[seededIndex(input.runId, input.tick, MACRO_REGIMES.length)];
  const confidenceDecay = computeDecayRate(pseudoRegime, 0.05);

  const preset = input.savedPreset;
  const preview = input.constraintPreview;

  const topFactors = [
    `premium=${Math.round(premium)}`,
    `regime=${preset?.macroRegime ?? pseudoRegime}`,
    `phase=${preset?.runPhase ?? 'EARLY'}`,
    `pressure=${preset?.pressureTier ?? 'LOW'}`,
    `wipeRisk=${preview ? preview.wipeRisk.toFixed(2) : 'n/a'}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: score > 0.66 ? 'Apply this preset and play fast.' : 'Tighten constraints; reduce wipe risk before committing.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M93'),
    confidenceDecay,
  };
}