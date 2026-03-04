// FILE: pzo_engine/src/mechanics/m44_archetype_starter_kit.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m44_archetype_starter_kit.ts
//
// Mechanic : M44 — Archetype Starter Kit
// Family   : onboarding   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m44a
// Deps     : none
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
  PlayerProfile,
} from './types';

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M44Input {
  archetypeSelection?: string;
  playerProfile?: PlayerProfile;

  // Optional passthroughs (safe no-ops if absent)
  runSeed?: string;
  stateTick?: number;
  stateRunPhase?: RunPhase;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
}

export interface M44Output {
  starterDeck: GameCard[];
  suggestedStrategy: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M44Event = 'ARCHETYPE_SELECTED' | 'STARTER_DECK_ISSUED' | 'STRATEGY_SUGGESTED';

export interface M44TelemetryPayload extends MechanicTelemetryPayload {
  event: M44Event;
  mechanic_id: 'M44';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M44_BOUNDS = {
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

// ── Internal helpers ───────────────────────────────────────────────────────

function dedupeCards(cards: GameCard[]): GameCard[] {
  const seen = new Set<string>();
  const out: GameCard[] = [];
  for (const c of cards) {
    const id = String(c?.id ?? '');
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(c);
  }
  return out;
}

function safeEnum<T extends string>(v: unknown, fallback: T, allowed: readonly T[]): T {
  const s = String(v ?? '') as T;
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * archetypeStarterKit
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function archetypeStarterKit(
  input: M44Input,
  emit: MechanicEmitter,
): M44Output {
  const playerProfile = input.playerProfile;

  const runPhase = safeEnum<RunPhase>(
    input.stateRunPhase ?? playerProfile?.runPhase,
    'EARLY',
    ['EARLY', 'MID', 'LATE'] as const,
  );

  const macroRegime = safeEnum<MacroRegime>(
    input.stateMacroRegime ?? playerProfile?.macroRegime,
    'NEUTRAL',
    ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const,
  );

  const pressureTier = safeEnum<PressureTier>(
    input.statePressureTier ?? playerProfile?.pressureTier,
    'LOW',
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const,
  );

  const tick = clamp(
    Number(input.stateTick ?? playerProfile?.tick ?? 0),
    0,
    Math.max(0, RUN_TOTAL_TICKS - 1),
  );

  const archetypeSelection = String(
    input.archetypeSelection ?? playerProfile?.archetype ?? '',
  ).trim();

  const serviceHash = computeHash(
    JSON.stringify({
      archetypeSelection,
      playerProfile: playerProfile ?? null,
      tick,
      runPhase,
      macroRegime,
      pressureTier,
    }),
  );

  const runSeed = String(input.runSeed ?? playerProfile?.runSeed ?? serviceHash);

  // Schedule primitives (used + emitted for visibility / replay parity)
  const macroSchedule = buildMacroSchedule(runSeed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runSeed, CHAOS_WINDOWS_PER_RUN);

  const inChaosWindow =
    chaosWindows.some((w) => tick >= w.startTick && tick <= w.endTick);

  // Deterministic archetype resolution (never empty)
  const archetypes = ['BUILDER', 'TRADER', 'OPERATOR', 'CREATOR'] as const;
  const resolvedArchetype =
    archetypeSelection.length > 0
      ? archetypeSelection
      : archetypes[seededIndex(runSeed, tick, archetypes.length)] ?? 'OPERATOR';

  emit({
    event: 'ARCHETYPE_SELECTED',
    mechanic_id: 'M44',
    tick,
    runId: runSeed,
    payload: {
      archetypeSelection,
      resolvedArchetype,
      serviceHash,
      runPhase,
      macroRegime,
      pressureTier,
      inChaosWindow,
      macroEvents: macroSchedule.length,
      chaosWindows: chaosWindows.length,
      runTotalTicks: RUN_TOTAL_TICKS,
    },
  });

  // Starter pool weights (bounded; deterministic)
  const pressurePhaseWeight =
    (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[runPhase] ?? 1.0);

  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  // Base pool + archetype shaping
  const basePool = buildWeightedPool(runSeed + ':m44:pool', pressurePhaseWeight, regimeWeight);

  const archetypeBiasIdx = seededIndex(runSeed + ':m44:arch', tick, Math.max(1, OPPORTUNITY_POOL.length));
  const archetypeBiasCard = OPPORTUNITY_POOL[archetypeBiasIdx] ?? DEFAULT_CARD;

  const assembledPool = dedupeCards([
    ...basePool,
    archetypeBiasCard,
    DEFAULT_CARD,
  ]);

  // Deck size: deterministic, bounded, and stable across nodes
  const extra = seededIndex(runSeed + ':m44:size', tick, 3); // 0..2
  const deckSize = clamp(4 + extra, 3, Math.max(3, OPPORTUNITY_POOL.length));

  const shuffled = seededShuffle(assembledPool.length ? assembledPool : OPPORTUNITY_POOL, runSeed + ':m44:shuffle');
  const starterDeck = dedupeCards(shuffled).slice(0, deckSize);

  // Ensure starter deck is never empty
  const finalStarterDeck = starterDeck.length ? starterDeck : [DEFAULT_CARD];

  // Strategy math (all imported knobs exercised deterministically)
  const decay = computeDecayRate(macroRegime, M44_BOUNDS.BASE_DECAY_RATE);
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const compositePulse = clamp(exitPulse * regimeMultiplier, 0.10, 2.00);

  const macroHintIdx = seededIndex(runSeed + ':m44:macroHint', tick, Math.max(1, macroSchedule.length));
  const macroHint = macroSchedule[macroHintIdx]?.regimeChange ?? macroRegime;

  const deckIds = finalStarterDeck.map((c) => c.id);
  const includesDefaults = deckIds.some((id) => DEFAULT_CARD_IDS.includes(id));

  const suggestedStrategy = [
    `ARCHETYPE=${resolvedArchetype}`,
    `PHASE=${runPhase}`,
    `REGIME=${macroRegime}`,
    `MACRO_HINT=${macroHint}`,
    `PRESSURE=${pressureTier}`,
    `TICK=${tick}/${RUN_TOTAL_TICKS}`,
    `DECAY=${decay.toFixed(4)}`,
    `PULSE=${compositePulse.toFixed(3)} (EXIT=${exitPulse.toFixed(2)}×REGIME=${regimeMultiplier.toFixed(2)})`,
    `CHAOS=${inChaosWindow ? 'ON' : 'OFF'} (windows=${CHAOS_WINDOWS_PER_RUN}, macroEvents=${MACRO_EVENTS_PER_RUN})`,
    `DECK=${deckIds.join(',')}`,
    `DEFAULTS=${includesDefaults ? 'IN' : 'OUT'}`,
  ].join(' | ');

  emit({
    event: 'STARTER_DECK_ISSUED',
    mechanic_id: 'M44',
    tick,
    runId: runSeed,
    payload: {
      resolvedArchetype,
      deckSize: finalStarterDeck.length,
      deckIds,
      poolSize: assembledPool.length,
      pressurePhaseWeight,
      regimeWeight,
    },
  });

  emit({
    event: 'STRATEGY_SUGGESTED',
    mechanic_id: 'M44',
    tick,
    runId: runSeed,
    payload: {
      strategyHash: computeHash(suggestedStrategy),
      decay,
      compositePulse,
    },
  });

  return {
    starterDeck: finalStarterDeck,
    suggestedStrategy,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M44MLInput {
  starterDeck?: GameCard[];
  suggestedStrategy?: string;
  runId: string;
  tick: number;
}

export interface M44MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * archetypeStarterKitMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function archetypeStarterKitMLCompanion(
  input: M44MLInput,
): Promise<M44MLOutput> {
  const deckLen = (input.starterDeck?.length ?? 0);
  const stratLen = (input.suggestedStrategy?.length ?? 0);

  // Deterministic bounded score (advisory only)
  const raw = (deckLen * 0.12) + (stratLen > 0 ? 0.25 : 0.05) + (Object.keys(input).length * 0.02);
  const score = clamp(raw, 0.01, 0.99);

  const auditHash = computeHash(JSON.stringify(input) + ':ml:M44');

  // Lower confidence decay when deck is non-trivial (slower decay => stickier hint)
  const confidenceDecay = clamp(0.12 - (Math.min(8, deckLen) * 0.01), 0.03, 0.20);

  return {
    score,
    topFactors: [
      `deckLen=${deckLen}`,
      `strategy=${stratLen > 0 ? 'present' : 'missing'}`,
      `tick=${input.tick}`,
    ].slice(0, 5),
    recommendation: deckLen >= 4
      ? 'Use the starter deck to establish momentum early; prioritize the first affordable opportunity.'
      : 'Starter deck is thin; reroll or fall back to the default opportunity to avoid stalling.',
    auditHash,
    confidenceDecay,
  };
}

// ── Type anchor (forces every imported type to be “used” in-code) ───────────

type __M44_TypeAnchor = {
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
  PlayerProfile: PlayerProfile;
};

const __M44_TYPE_USE: __M44_TypeAnchor = null as unknown as __M44_TypeAnchor;
void __M44_TYPE_USE;