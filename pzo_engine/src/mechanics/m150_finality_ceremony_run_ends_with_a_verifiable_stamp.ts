// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m150_finality_ceremony_run_ends_with_a_verifiable_stamp.ts
//
// Mechanic : M150 — Finality Ceremony: Run Ends with a Verifiable Stamp
// Family   : ops   Layer: season_runtime   Priority: 1   Batch: 3
// ML Pair  : m150a
// Deps     : M50, M46
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
export const M150_IMPORTED_SYMBOLS = {
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
export type M150_ImportedTypesAnchor = {
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

// ── Local M150 domain types (M150-only; intentionally not in ./types) ─────────

export type SovereigntyGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface FinalityStamp {
  runId: string;
  tick: number;
  cordScore: number;
  grade: SovereigntyGrade;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  opportunityCardId: string;
  opportunityCardName: string;

  decayRate: number;
  regimeMultiplier: number;
  exitPulse: number;

  stampHash: string;
  scheduleHash: string;
  chaosHash: string;

  proofCard: ProofCard;
  ledgerEntry: LedgerEntry;

  finalized: boolean;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M150Input {
  completedRun?: CompletedRun;
  cordScore?: number;
  sovereigntyGrade?: SovereigntyGrade;
}

export interface M150Output {
  finalityStamp: FinalityStamp;
  ceremonyDisplayed: boolean;
  stampHash: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M150Event =
  | 'FINALITY_CEREMONY_TRIGGERED'
  | 'SOVEREIGNTY_STAMP_ISSUED'
  | 'RUN_FINALIZED';

export interface M150TelemetryPayload extends MechanicTelemetryPayload {
  event: M150Event;
  mechanic_id: 'M150';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M150_BOUNDS = {
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

// ── Internal derivations (deterministic, no side effects) ────────────────────

function m150DerivePhase(tick: number): RunPhase {
  const third = RUN_TOTAL_TICKS / 3;
  if (tick < third) return 'EARLY';
  if (tick < third * 2) return 'MID';
  return 'LATE';
}

function m150DeriveRegime(seed: string, tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  const regimes: MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'];
  if (!Array.isArray(macroSchedule) || macroSchedule.length === 0) {
    return regimes[seededIndex(seed, tick + 999, regimes.length)];
  }

  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  let r: MacroRegime = 'NEUTRAL';

  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = ev.regimeChange;
  }

  if (r === 'NEUTRAL' && sorted[0]?.regimeChange) r = sorted[0].regimeChange;
  return r ?? regimes[seededIndex(seed, tick + 1001, regimes.length)];
}

function m150DerivePressure(tick: number, phase: RunPhase, chaosWindows: ChaosWindow[]): PressureTier {
  const inChaos =
    Array.isArray(chaosWindows) && chaosWindows.some(w => tick >= w.startTick && tick <= w.endTick);

  if (inChaos) return 'CRITICAL';

  switch (phase) {
    case 'EARLY':
      return 'LOW';
    case 'MID':
      return 'MEDIUM';
    case 'LATE':
      return 'HIGH';
    default:
      return 'MEDIUM';
  }
}

function m150DeriveTickTier(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m150GradeFromCord(cordScore: number): SovereigntyGrade {
  // Cord scores are not yet standardized across builds; keep mapping stable + deterministic.
  const s = clamp(cordScore, 0, 1_000);
  if (s >= 900) return 'S';
  if (s >= 750) return 'A';
  if (s >= 600) return 'B';
  if (s >= 450) return 'C';
  if (s >= 300) return 'D';
  return 'F';
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * finalityCeremonyStamper
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function finalityCeremonyStamper(input: M150Input, emit: MechanicEmitter): M150Output {
  const completedRun = input.completedRun;
  const runId = completedRun?.runId ?? computeHash(JSON.stringify(input));
  const tickRaw = typeof completedRun?.ticks === 'number' ? completedRun.ticks : RUN_TOTAL_TICKS;
  const tick = clamp(tickRaw, 0, RUN_TOTAL_TICKS);

  const cordScore = typeof input.cordScore === 'number' ? input.cordScore : (completedRun?.cordScore ?? 0);
  const derivedGrade = m150GradeFromCord(cordScore);
  const grade: SovereigntyGrade = input.sovereigntyGrade ?? derivedGrade;

  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  const runPhase = m150DerivePhase(tick);
  const macroRegime = m150DeriveRegime(runId, tick, macroSchedule);
  const pressureTier = m150DerivePressure(tick, runPhase, chaosWindows);
  const tickTier = m150DeriveTickTier(pressureTier);

  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const pool = buildWeightedPool(runId, pressureWeight * phaseWeight, regimeWeight);
  const poolPickIdx = seededIndex(runId, tick + 777, Math.max(1, pool.length));
  const poolPick = pool[poolPickIdx] ?? DEFAULT_CARD;

  const deckIds = seededShuffle(DEFAULT_CARD_IDS, runId);
  const opportunityIndex = seededIndex(runId, tick, Math.max(1, deckIds.length));
  const opportunityCardId = (deckIds[opportunityIndex] ?? poolPick.id) || DEFAULT_CARD.id;

  const opportunityCard =
    OPPORTUNITY_POOL.find(c => c.id === opportunityCardId) ??
    poolPick ??
    DEFAULT_CARD;

  const scheduleHash = computeHash(JSON.stringify(macroSchedule));
  const chaosHash = computeHash(JSON.stringify(chaosWindows));
  const stampHash = computeHash(
    [
      'M150',
      runId,
      String(tick),
      String(cordScore),
      grade,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      opportunityCard.id,
      scheduleHash,
      chaosHash,
    ].join(':'),
  );

  const decayRate = computeDecayRate(macroRegime, M150_BOUNDS.BASE_DECAY_RATE);
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = (EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0) * regimeMultiplier;

  const proofCard: ProofCard = {
    runId: runId,
    cordScore: cordScore,
    hash: stampHash,
    grade: grade,
  };

  const ledgerEntry: LedgerEntry = {
    gameAction: {
      type: 'FINALITY_STAMP',
      mechanic_id: 'M150',
      runId: runId,
      tick: tick,
      stampHash: stampHash,
      proofHash: proofCard.hash,
      opportunityCardId: opportunityCard.id,
    },
    tick: tick,
    hash: computeHash(stampHash + ':ledger'),
  };

  const ceremonyDisplayed = cordScore >= M150_BOUNDS.TRIGGER_THRESHOLD;

  emit({
    event: 'FINALITY_CEREMONY_TRIGGERED',
    mechanic_id: 'M150',
    tick: tick,
    runId: runId,
    payload: {
      cordScore,
      grade,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      opportunityCardId: opportunityCard.id,
      scheduleHash,
      chaosHash,
    },
  });

  const finalityStamp: FinalityStamp = {
    runId,
    tick,
    cordScore,
    grade,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    macroSchedule,
    chaosWindows,
    opportunityCardId: opportunityCard.id,
    opportunityCardName: opportunityCard.name ?? 'Unknown',
    decayRate,
    regimeMultiplier,
    exitPulse,
    stampHash,
    scheduleHash,
    chaosHash,
    proofCard,
    ledgerEntry,
    finalized: true,
  };

  emit({
    event: 'SOVEREIGNTY_STAMP_ISSUED',
    mechanic_id: 'M150',
    tick: tick,
    runId: runId,
    payload: {
      stampHash,
      proofHash: proofCard.hash,
      ledgerHash: ledgerEntry.hash,
      grade,
      exitPulse,
      decayRate,
      opportunityCardId: opportunityCard.id,
    },
  });

  emit({
    event: 'RUN_FINALIZED',
    mechanic_id: 'M150',
    tick: tick,
    runId: runId,
    payload: {
      finalized: true,
      ceremonyDisplayed,
      stampHash,
      proofHash: proofCard.hash,
    },
  });

  return {
    finalityStamp,
    ceremonyDisplayed,
    stampHash,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M150MLInput {
  finalityStamp?: FinalityStamp;
  ceremonyDisplayed?: boolean;
  stampHash?: string;
  runId: string;
  tick: number;
}

export interface M150MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * finalityCeremonyStamperMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function finalityCeremonyStamperMLCompanion(input: M150MLInput): Promise<M150MLOutput> {
  const runId = input.runId ?? computeHash(JSON.stringify(input));
  const tick = clamp(typeof input.tick === 'number' ? input.tick : 0, 0, RUN_TOTAL_TICKS);

  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  const runPhase = m150DerivePhase(tick);
  const macroRegime = m150DeriveRegime(runId, tick, macroSchedule);
  const pressureTier = m150DerivePressure(tick, runPhase, chaosWindows);
  const tickTier = m150DeriveTickTier(pressureTier);

  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const pool = buildWeightedPool(runId, pressureWeight * phaseWeight, regimeWeight);
  const poolPick = pool[seededIndex(runId, tick + 505, Math.max(1, pool.length))] ?? DEFAULT_CARD;

  const decayRate = computeDecayRate(macroRegime, M150_BOUNDS.BASE_DECAY_RATE);
  const exitPulse = (EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0) * (REGIME_MULTIPLIERS[macroRegime] ?? 1.0);

  const ceremonyBoost = input.ceremonyDisplayed ? 0.12 : 0.0;
  const base = 0.45 + ceremonyBoost + (pressureTier === 'CRITICAL' ? -0.08 : 0.04);
  const pulseAdj = clamp(exitPulse / 2.0, 0.0, 1.0) * 0.15;
  const poolAdj = poolPick?.id ? 0.03 : 0.0;

  const score = clamp(base + pulseAdj + poolAdj - decayRate, 0.01, 0.99);

  const topFactors: string[] = [
    `Regime: ${macroRegime}`,
    `Phase: ${runPhase}`,
    `Pressure: ${pressureTier}/${tickTier}`,
    input.ceremonyDisplayed ? 'Ceremony displayed' : 'Ceremony suppressed',
    `Opportunity: ${poolPick?.name ?? 'default'}`,
  ].slice(0, 5);

  const recommendation =
    input.ceremonyDisplayed
      ? 'Archive the stamp and surface the proof card prominently in the run recap.'
      : 'Suppress ceremony UI and log the stamp silently; prioritize verification cues over celebration.';

  const auditHash = computeHash(
    [
      'M150:ml',
      runId,
      String(tick),
      input.stampHash ?? '',
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      poolPick?.id ?? '',
      String(score),
      String(decayRate),
    ].join(':'),
  );

  return {
    score,
    topFactors,
    recommendation,
    auditHash,
    confidenceDecay: clamp(decayRate, 0.01, 0.99),
  };
}