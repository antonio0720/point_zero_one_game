// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m68_failure_rehab_mode.ts
//
// Mechanic : M68 — Failure Rehab Mode
// Family   : onboarding_advanced   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m68a
// Deps     : M03, M45
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

// ── Local M68 domain types (backend_service; keep local to avoid cyclic deps) ──

export type RehabScenario =
  | 'SOLVENCY_TRIAGE'
  | 'DEBT_SPIKE_CONTROL'
  | 'PORTFOLIO_SIMPLIFY'
  | 'CHAOS_WINDOW_SURVIVAL'
  | 'EXIT_DISCIPLINE'
  | 'CORD_REBUILD';

export interface FailureSnapshot {
  userId?: string;
  runId?: string;
  // best-effort, JSON-safe signals; engine never assumes more.
  tickAtFailure?: number;
  reason?: string; // "WIPED", "BLEED", etc (freeform)
  cordScore?: number; // 0..1
  cash?: number;
  cashflow?: number;
  totalDebt?: number;
  totalLiability?: number;
  totalAssets?: number;
  inChaos?: boolean;
  // optional telemetry traces / event ids
  lastEvents?: string[];
  meta?: Record<string, unknown>;
}

export interface RehabRunState {
  rehabRunId: string;
  sourceWipedRunId: string;
  userId: string;
  startedAtTick: number;
  targetedScenario: RehabScenario;
  // deterministic bounded parameters for the rehab run
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  seed: string;
  rules: {
    maxDebt: number;
    maxLiability: number;
    minCash: number;
    minCashflow: number;
    forcedTutorialLayer: boolean;
    chaosExposureAllowed: boolean;
    // deterministic timebox for rehab
    targetTicks: number;
  };
  // proof chain anchor for server verification
  proofHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M68Input {
  // Optional service passthrough
  runId?: string;
  tick?: number;

  wipedRunId?: string;
  failureSnapshot?: FailureSnapshot;
}

export interface M68Output {
  rehabRunState: RehabRunState;
  targetedScenario: string; // stable scenario hash/token for UI + analytics
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M68Event = 'FAILURE_REHAB_STARTED' | 'SCENARIO_TARGETED' | 'REHAB_COMPLETE';

export interface M68TelemetryPayload extends MechanicTelemetryPayload {
  event: M68Event;
  mechanic_id: 'M68';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M68_BOUNDS = {
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

type _M68_AllTypeImportsUsed = {
  a: RunPhase;
  b: TickTier;
  c: MacroRegime;
  d: PressureTier;
  e: SolvencyStatus;
  f: Asset;
  g: IPAItem;
  h: GameCard;
  i: GameEvent;
  j: ShieldLayer;
  k: Debt;
  l: Buff;
  m: Liability;
  n: SetBonus;
  o: AssetMod;
  p: IncomeItem;
  q: MacroEvent;
  r: ChaosWindow;
  s: AuctionResult;
  t: PurchaseResult;
  u: ShieldResult;
  v: ExitResult;
  w: TickResult;
  x: DeckComposition;
  y: TierProgress;
  z: WipeEvent;
  aa: RegimeShiftEvent;
  ab: PhaseTransitionEvent;
  ac: TimerExpiredEvent;
  ad: StreakEvent;
  ae: FubarEvent;
  af: LedgerEntry;
  ag: ProofCard;
  ah: CompletedRun;
  ai: SeasonState;
  aj: RunState;
  ak: MomentEvent;
  al: ClipBoundary;
  am: MechanicTelemetryPayload;
  an: MechanicEmitter;
};

function m68LongHash(s: string): string {
  const h1 = computeHash(s);
  const h2 = computeHash(h1 + ':' + s);
  const h3 = computeHash(h2 + ':' + h1);
  const h4 = computeHash(h3 + ':' + s + ':' + h2);
  return (h1 + h2 + h3 + h4).slice(0, 32);
}

function m68ResolveRegime(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN).slice().sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of schedule) {
    if (ev.tick <= tick && ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m68DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.33)) return 'EARLY';
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.66)) return 'MID';
  return 'LATE';
}

function m68ChaosContext(seed: string, tick: number): { inChaos: boolean; window: ChaosWindow | null } {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return { inChaos: true, window: w };
  }
  return { inChaos: false, window: null };
}

function m68PressureTierFromFailure(fs: FailureSnapshot, inChaos: boolean, regime: MacroRegime): PressureTier {
  const cord = clamp(Number(fs.cordScore ?? 0) || 0, 0, 1);
  const debt = clamp(Number(fs.totalDebt ?? fs.totalLiability ?? 0) || 0, 0, 10_000_000);
  const cash = Number(fs.cash ?? 0) || 0;
  const cashflow = Number(fs.cashflow ?? 0) || 0;

  const debtIdx = clamp(debt / 100_000, 0, 1);
  const cashIdx = cash < 0 ? 1 : cash < 500 ? 0.75 : cash < 2_000 ? 0.40 : 0.15;
  const flowIdx = cashflow < 0 ? 0.85 : cashflow < 250 ? 0.50 : 0.20;
  const regimeIdx = regime === 'CRISIS' ? 0.30 : regime === 'BEAR' ? 0.20 : 0.10;

  const idx =
    debtIdx * 0.35 +
    cashIdx * 0.25 +
    flowIdx * 0.20 +
    (1 - cord) * 0.15 +
    regimeIdx +
    (inChaos ? 0.10 : 0.0);

  if (idx <= 0.25) return 'LOW';
  if (idx <= 0.50) return 'MEDIUM';
  if (idx <= 0.75) return 'HIGH';
  return 'CRITICAL';
}

function m68PickReferenceCard(seed: string, tick: number, pressureTier: PressureTier, phase: RunPhase, regime: MacroRegime): GameCard {
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:m68:${tick}`, pressurePhaseWeight, regimeWeight);
  const effectivePool = pool.length > 0 ? pool : OPPORTUNITY_POOL;

  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m68:deck`);
  const pickedId = deck[seededIndex(seed, tick, deck.length)] ?? DEFAULT_CARD.id;

  const fromPool = effectivePool.find(c => c.id === pickedId);
  if (fromPool) return fromPool;

  const fromOpp = OPPORTUNITY_POOL.find(c => c.id === pickedId);
  if (fromOpp) return fromOpp;

  return DEFAULT_CARD;
}

function m68ScenarioFromFailure(
  fs: FailureSnapshot,
  inChaos: boolean,
  regime: MacroRegime,
  phase: RunPhase,
  referenceCard: GameCard,
  decay: number,
): RehabScenario {
  const reason = String(fs.reason ?? '').toUpperCase();
  const cord = clamp(Number(fs.cordScore ?? 0) || 0, 0, 1);
  const debt = clamp(Number(fs.totalDebt ?? fs.totalLiability ?? 0) || 0, 0, 10_000_000);
  const cash = Number(fs.cash ?? 0) || 0;
  const cashflow = Number(fs.cashflow ?? 0) || 0;

  const cardCost = Number(referenceCard.cost ?? 0) || 0;
  const cardDown = Number(referenceCard.downPayment ?? 0) || 0;
  const cardAnchor = clamp((cardCost + cardDown) / 250_000, 0, 0.40);

  if (inChaos || reason.includes('CHAOS')) return 'CHAOS_WINDOW_SURVIVAL';
  if (reason.includes('EXIT')) return 'EXIT_DISCIPLINE';
  if (debt >= 50_000 || cardAnchor >= 0.25) return 'DEBT_SPIKE_CONTROL';
  if (cash < 0 || reason.includes('WIPE') || reason.includes('BANKRUPT')) return 'SOLVENCY_TRIAGE';
  if (cord < 0.35 || decay >= 0.05) return 'CORD_REBUILD';
  if (phase === 'LATE' || regime === 'CRISIS') return 'PORTFOLIO_SIMPLIFY';
  if (cashflow < 0) return 'SOLVENCY_TRIAGE';
  return 'PORTFOLIO_SIMPLIFY';
}

function m68DifficultyFromPressure(p: PressureTier): RehabRunState['difficulty'] {
  switch (p) {
    case 'CRITICAL': return 'CRITICAL';
    case 'HIGH': return 'HIGH';
    case 'MEDIUM': return 'MEDIUM';
    default: return 'LOW';
  }
}

function m68RulesForScenario(
  scenario: RehabScenario,
  fs: FailureSnapshot,
  difficulty: RehabRunState['difficulty'],
  inChaos: boolean,
  decay: number,
): RehabRunState['rules'] {
  const baseDebt =
    scenario === 'DEBT_SPIKE_CONTROL' ? 35_000 :
    scenario === 'PORTFOLIO_SIMPLIFY' ? 28_000 :
    scenario === 'EXIT_DISCIPLINE' ? 25_000 :
    22_000;

  const baseLiability =
    scenario === 'SOLVENCY_TRIAGE' ? 30_000 :
    scenario === 'DEBT_SPIKE_CONTROL' ? 45_000 :
    32_000;

  const baseMinCash =
    scenario === 'SOLVENCY_TRIAGE' ? 1_250 :
    scenario === 'CHAOS_WINDOW_SURVIVAL' ? 900 :
    700;

  const baseMinFlow =
    scenario === 'CORD_REBUILD' ? 250 :
    scenario === 'SOLVENCY_TRIAGE' ? 200 :
    125;

  const diffMult =
    difficulty === 'CRITICAL' ? 0.85 :
    difficulty === 'HIGH' ? 0.92 :
    difficulty === 'MEDIUM' ? 1.0 : 1.08;

  const chaosPenalty = inChaos ? 0.92 : 1.0;
  const decayPenalty = 1 - clamp(decay * 0.75, 0, 0.25);

  // targetTicks bounded by PULSE_CYCLE
  const targetTicksBase =
    scenario === 'CHAOS_WINDOW_SURVIVAL' ? M68_BOUNDS.PULSE_CYCLE * 4 :
    scenario === 'CORD_REBUILD' ? M68_BOUNDS.PULSE_CYCLE * 3 :
    M68_BOUNDS.PULSE_CYCLE * 2;

  return {
    maxDebt: clamp(Math.round(baseDebt * diffMult * chaosPenalty * decayPenalty), 5_000, 100_000),
    maxLiability: clamp(Math.round(baseLiability * diffMult * chaosPenalty * decayPenalty), 5_000, 120_000),
    minCash: clamp(Math.round(baseMinCash * diffMult), 0, 25_000),
    minCashflow: clamp(Math.round(baseMinFlow * diffMult), 0, 10_000),
    forcedTutorialLayer: scenario === 'SOLVENCY_TRIAGE' || scenario === 'CORD_REBUILD' || difficulty === 'CRITICAL',
    chaosExposureAllowed: scenario === 'CHAOS_WINDOW_SURVIVAL' || (!inChaos && difficulty !== 'CRITICAL'),
    targetTicks: clamp(Math.round(targetTicksBase * (difficulty === 'CRITICAL' ? 1.25 : 1.0)), 12, RUN_TOTAL_TICKS),
  };
}

function m68TargetedScenarioToken(scenario: RehabScenario, seed: string, tick: number): string {
  // stable short token for UI routing + analytics grouping
  return computeHash(`M68:${scenario}:${seed}:${tick}`).slice(0, 16);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * failureRehabEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function failureRehabEngine(
  input: M68Input,
  emit: MechanicEmitter,
): M68Output {
  const __typeSentinel: _M68_AllTypeImportsUsed | null = null;
  void __typeSentinel;

  const wipedRunId = String(input.wipedRunId ?? '');
  const fs: FailureSnapshot = (input.failureSnapshot ?? {}) as FailureSnapshot;

  const serviceSeed =
    String(input.runId ?? '') ||
    m68LongHash(
      [
        'M68',
        wipedRunId,
        JSON.stringify(fs ?? {}),
        JSON.stringify(DEFAULT_CARD_IDS.slice(0, 16)),
      ].join(':'),
    );

  const tick = clamp(
    typeof input.tick === 'number' ? input.tick : seededIndex(serviceSeed, 68, RUN_TOTAL_TICKS),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  // Force timeline use into the proof chain.
  const macroSchedule = buildMacroSchedule(serviceSeed, MACRO_EVENTS_PER_RUN);
  const macroHash = m68LongHash(JSON.stringify(macroSchedule));

  const phase = m68DerivePhase(tick);
  const regime = m68ResolveRegime(serviceSeed, tick);
  const { inChaos, window } = m68ChaosContext(serviceSeed, tick);

  const decay = computeDecayRate(regime, M68_BOUNDS.BASE_DECAY_RATE);

  const pressureTier = m68PressureTierFromFailure(fs, inChaos, regime);

  const referenceCard = m68PickReferenceCard(serviceSeed, tick, pressureTier, phase, regime);

  const scenario = m68ScenarioFromFailure(fs, inChaos, regime, phase, referenceCard, decay);
  const difficulty = m68DifficultyFromPressure(pressureTier);

  const rules = m68RulesForScenario(scenario, fs, difficulty, inChaos, decay);

  const userId = String(fs.userId ?? '').length > 0
    ? String(fs.userId)
    : computeHash(`M68:user:${serviceSeed}:${wipedRunId}`).slice(0, 12);

  const rehabRunId = m68LongHash(`M68:rehab:${userId}:${wipedRunId}:${scenario}:${macroHash}:${tick}`);

  const targetedScenario = m68TargetedScenarioToken(scenario, serviceSeed, tick);

  const proofHash = m68LongHash(
    JSON.stringify({
      mechanic: 'M68',
      serviceSeed,
      tick,
      userId,
      wipedRunId,
      rehabRunId,
      scenario,
      targetedScenario,
      difficulty,
      rules,
      regime,
      phase,
      pressureTier,
      inChaos,
      chaosWindow: window,
      macroHash,
      referenceCardId: referenceCard.id,
      decay,
    }),
  );

  const rehabRunState: RehabRunState = {
    rehabRunId,
    sourceWipedRunId: wipedRunId,
    userId,
    startedAtTick: tick,
    targetedScenario: scenario,
    difficulty,
    seed: serviceSeed,
    rules,
    proofHash,
  };

  emit({
    event: 'FAILURE_REHAB_STARTED',
    mechanic_id: 'M68',
    tick,
    runId: serviceSeed,
    payload: {
      wipedRunId,
      userId,
      rehabRunId,
      difficulty,
      scenario,
      targetedScenario,
      rules,
      regime,
      phase,
      pressureTier,
      inChaos,
      chaosWindow: window,
      referenceCardId: referenceCard.id,
      decay,
      macroHash,
      proofHash,
    },
  });

  emit({
    event: 'SCENARIO_TARGETED',
    mechanic_id: 'M68',
    tick,
    runId: serviceSeed,
    payload: {
      wipedRunId,
      rehabRunId,
      scenario,
      targetedScenario,
      difficulty,
      // include a deterministic "scenario routing key" for backend orchestration
      routeKey: computeHash(`rehab:${scenario}:${difficulty}:${regime}:${phase}:${pressureTier}`).slice(0, 16),
    },
  });

  // Completion is emitted only if the snapshot implies "rehab already finished" (optional).
  const alreadyComplete = Boolean((fs.meta as any)?.rehabComplete === true);
  if (alreadyComplete) {
    emit({
      event: 'REHAB_COMPLETE',
      mechanic_id: 'M68',
      tick,
      runId: serviceSeed,
      payload: {
        rehabRunId,
        scenario,
        targetedScenario,
        proofHash,
      },
    });
  }

  return {
    rehabRunState,
    targetedScenario,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M68MLInput {
  rehabRunState?: RehabRunState;
  targetedScenario?: string;
  runId: string;
  tick: number;
}

export interface M68MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * failureRehabEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function failureRehabEngineMLCompanion(
  input: M68MLInput,
): Promise<M68MLOutput> {
  const state = input.rehabRunState;

  const difficulty = String(state?.difficulty ?? 'LOW');
  const scenario = String(state?.targetedScenario ?? 'SOLVENCY_TRIAGE');
  const hasProof = String(state?.proofHash ?? '').length > 0;

  const diffScore =
    difficulty === 'CRITICAL' ? 0.85 :
    difficulty === 'HIGH' ? 0.70 :
    difficulty === 'MEDIUM' ? 0.55 : 0.35;

  const scenarioBoost =
    scenario === 'CHAOS_WINDOW_SURVIVAL' ? 0.10 :
    scenario === 'DEBT_SPIKE_CONTROL' ? 0.08 :
    scenario === 'SOLVENCY_TRIAGE' ? 0.06 :
    scenario === 'CORD_REBUILD' ? 0.07 :
    0.04;

  const score = clamp(diffScore + scenarioBoost + (hasProof ? 0.06 : 0.0), 0.01, 0.99);

  const topFactors: string[] = [
    `Scenario=${scenario}`,
    `Difficulty=${difficulty}`,
    hasProof ? 'Proof hash present' : 'Proof hash missing',
    `Tick=${input.tick}`,
  ].slice(0, 5);

  const recommendation =
    scenario === 'DEBT_SPIKE_CONTROL'
      ? 'Focus on liability containment and controlled exposure; avoid stacking debt vectors.'
      : scenario === 'CHAOS_WINDOW_SURVIVAL'
        ? 'Train chaos discipline: maintain buffers and obey timeboxing under volatility.'
        : scenario === 'CORD_REBUILD'
          ? 'Rebuild decision integrity: prioritize consistent CORD outcomes over speed.'
          : scenario === 'EXIT_DISCIPLINE'
            ? 'Practice exits: lock thresholds and execute on schedule without hesitation.'
            : 'Stabilize solvency: maintain minimum cash/cashflow and avoid cascade triggers.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M68'),
    confidenceDecay: clamp(0.05 + (1 - score) * 0.12, 0.05, 0.22),
  };
}