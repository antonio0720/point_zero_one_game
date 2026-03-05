// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m125_no_ghost_hardcore_you_own_every_mistake.ts
//
// Mechanic : M125 — No Ghost Hardcore: You Own Every Mistake
// Family   : social_advanced   Layer: season_runtime   Priority: 2   Batch: 3
// ML Pair  : m125a
// Deps     : M14, M03
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
export const M125_IMPORTED_SYMBOLS = {
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
export type M125_ImportedTypesAnchor = {
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

// ── Local M125 domain types (intentionally NOT in ./types) ───────────────────

export interface HardcoreRunState {
  mechanicId: 'M125';
  runId: string;
  runSeed: string;

  hardcoreEnabled: boolean;
  ghostDisabled: boolean;

  tick: number;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  decayRate: number;
  cordCeiling: number;

  // Deterministic UI hints (never authoritative)
  deckHintTop: string;
  opportunityHintId: string;

  // Deterministic “mistake budget” (hardcore: you own it)
  maxMistakesAllowed: number;
  mistakesSoFar: number;

  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M125Input {
  hardcoreFlag?: boolean;
  runSeed?: string;
  hardcoreConfig?: boolean;
}

export interface M125Output {
  hardcoreRunState: HardcoreRunState;
  cordCeiling: number;
  ghostDisabled: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M125Event = 'HARDCORE_STARTED' | 'GHOST_DISABLED' | 'HARDCORE_FAILED' | 'HARDCORE_COMPLETED';

export interface M125TelemetryPayload extends MechanicTelemetryPayload {
  event: M125Event;
  mechanic_id: 'M125';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M125_BOUNDS = {
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

// ── Helpers ───────────────────────────────────────────────────────────────

function asNonEmptyString(v: unknown): string {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}

function deriveRunPhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < RUN_TOTAL_TICKS / 3) return 'EARLY';
  if (t < (RUN_TOTAL_TICKS * 2) / 3) return 'MID';
  return 'LATE';
}

function deriveMacroRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function inChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function derivePressureTier(runPhase: RunPhase, regime: MacroRegime, chaos: boolean): PressureTier {
  // Hardcore intensity rises with chaos + harsher macro regimes.
  if (chaos) return 'CRITICAL';
  if (regime === 'CRISIS') return runPhase === 'EARLY' ? 'HIGH' : 'CRITICAL';
  if (regime === 'BEAR') return runPhase === 'LATE' ? 'HIGH' : 'MEDIUM';
  if (regime === 'BULL') return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
  return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
}

function deriveTickTier(pressureTier: PressureTier): TickTier {
  if (pressureTier === 'CRITICAL') return 'CRITICAL';
  if (pressureTier === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function computeCordCeiling(params: { macroRegime: MacroRegime; pressureTier: PressureTier; runPhase: RunPhase }): number {
  // Deterministic ceiling: hardcore shrinks ceiling in CRISIS/CRITICAL, expands slightly in calmer regimes.
  const regimeMult = REGIME_MULTIPLIERS[params.macroRegime] ?? 1.0;
  const pulseMult = EXIT_PULSE_MULTIPLIERS[params.macroRegime] ?? 1.0;

  const phaseW = PHASE_WEIGHTS[params.runPhase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[params.pressureTier] ?? 1.0;

  // Lower regimeMult/pulseMult => harsher => lower ceiling.
  const raw = 1000 * regimeMult * pulseMult * (1 / pressureW) * (1 / phaseW);
  return clamp(Math.round(raw), 50, 2_500);
}

function computeMistakeAllowance(params: { macroRegime: MacroRegime; pressureTier: PressureTier; runPhase: RunPhase }): number {
  // Hardcore: mistakes allowed are minimal and shrink under chaos/harsher contexts.
  const base = 3;

  let penalty = 0;
  if (params.runPhase === 'MID') penalty += 1;
  if (params.runPhase === 'LATE') penalty += 2;

  if (params.macroRegime === 'BEAR') penalty += 1;
  if (params.macroRegime === 'CRISIS') penalty += 2;

  if (params.pressureTier === 'HIGH') penalty += 1;
  if (params.pressureTier === 'CRITICAL') penalty += 2;

  return clamp(base - Math.floor(penalty / 2), 0, 3);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * noGhostHardcoreEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function noGhostHardcoreEngine(input: M125Input, emit: MechanicEmitter): M125Output {
  const hardcoreFlag = Boolean(input.hardcoreFlag);
  const hardcoreConfig = Boolean(input.hardcoreConfig);

  // Hardcore is enabled if either flag is true.
  const hardcoreEnabled = hardcoreFlag || hardcoreConfig;

  // Deterministic seed for this hardcore run.
  const runSeed =
    asNonEmptyString(input.runSeed) ||
    computeHash(`M125:${hardcoreEnabled ? 'HC' : 'SOFT'}:${computeHash(JSON.stringify(input))}`);

  const runId = computeHash(`M125:run:${runSeed}`);

  // Derive macro context (keeps shared imports live).
  const tick = 0;
  const macroSchedule = buildMacroSchedule(runSeed + ':macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runSeed + ':chaos', CHAOS_WINDOWS_PER_RUN);

  const runPhase = deriveRunPhase(tick);
  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const chaos = inChaosWindow(tick, chaosWindows);

  const pressureTier = derivePressureTier(runPhase, macroRegime, chaos);
  const tickTier = deriveTickTier(pressureTier);

  const decayRate = computeDecayRate(macroRegime, M125_BOUNDS.BASE_DECAY_RATE);

  // Deterministic UI hints (never authoritative).
  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, runSeed + ':deck');
  const deckHintTop = deckOrder[0] ?? DEFAULT_CARD.id;

  const opportunityHint =
    OPPORTUNITY_POOL[seededIndex(runSeed + ':opp', tick, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  // Weighted pool used as an audit surface for “hardcore context”.
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const weightedPool = buildWeightedPool(runSeed + ':pool', pressureW * phaseW, regimeW);

  // Hardcore invariants.
  const ghostDisabled = true;

  // CORD ceiling for hardcore runs (caller enforces).
  const cordCeiling = computeCordCeiling({ macroRegime, pressureTier, runPhase });

  // Mistake allowance (caller increments mistakesSoFar; this mechanic declares max).
  const maxMistakesAllowed = computeMistakeAllowance({ macroRegime, pressureTier, runPhase });
  const mistakesSoFar = 0;

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M125',
      runId,
      runSeed,
      hardcoreEnabled,
      ghostDisabled,
      tick,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decayRate,
      cordCeiling,
      maxMistakesAllowed,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      weightedPoolSize: weightedPool.length,
    }),
  );

  const hardcoreRunState: HardcoreRunState = {
    mechanicId: 'M125',
    runId,
    runSeed,
    hardcoreEnabled,
    ghostDisabled,
    tick,
    macroSchedule,
    chaosWindows,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    decayRate,
    cordCeiling,
    deckHintTop,
    opportunityHintId: opportunityHint.id,
    maxMistakesAllowed,
    mistakesSoFar,
    auditHash,
  };

  // Telemetry: always announce start; always assert ghost disabled when hardcore enabled.
  emit({
    event: 'HARDCORE_STARTED',
    mechanic_id: 'M125',
    tick,
    runId,
    payload: {
      runSeed,
      hardcoreEnabled,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      decayRate,
      cordCeiling,
      maxMistakesAllowed,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      auditHash,
    },
  });

  emit({
    event: 'GHOST_DISABLED',
    mechanic_id: 'M125',
    tick,
    runId,
    payload: {
      ghostDisabled: true,
      hardcoreEnabled,
      auditHash,
    },
  });

  // This mechanic does NOT determine failure/completion by itself; it declares constraints.
  // Router/engine can emit HARDCORE_FAILED / HARDCORE_COMPLETED when enforcing these constraints.

  return {
    hardcoreRunState,
    cordCeiling,
    ghostDisabled,
  };
}

// ── Utility: toFiniteInt ─────────────────────────────────────────────────

function toFiniteInt(val: unknown, fallback: number = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M125MLInput {
  hardcoreRunState?: HardcoreRunState;
  cordCeiling?: number;
  ghostDisabled?: boolean;
  runId: string;
  tick: number;
}

export interface M125MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * noGhostHardcoreEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function noGhostHardcoreEngineMLCompanion(input: M125MLInput): Promise<M125MLOutput> {
  const tick = clamp(toFiniteInt(input.tick, 0), 0, RUN_TOTAL_TICKS);

  const st = input.hardcoreRunState;
  const macroRegime: MacroRegime = (st?.macroRegime ?? 'NEUTRAL') as MacroRegime;
  const pressureTier: PressureTier = (st?.pressureTier ?? 'MEDIUM') as PressureTier;

  const decay = computeDecayRate(macroRegime, M125_BOUNDS.BASE_DECAY_RATE);
  const pulseMult = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const ceiling = clamp(toFiniteInt(input.cordCeiling, st?.cordCeiling ?? 0), 0, 10_000);
  const ghostDisabled = Boolean(input.ghostDisabled ?? st?.ghostDisabled ?? true);

  // Higher score means “hardcore posture is active & consistent”.
  const posture =
    (ghostDisabled ? 0.35 : 0.0) +
    (ceiling > 0 ? 0.25 : 0.0) +
    ((PRESSURE_WEIGHTS[pressureTier] ?? 1.0) >= 1.2 ? 0.10 : 0.0);

  const stability = clamp((pulseMult + regimeMult) / 2, 0.35, 1.25);
  const score = clamp((0.15 + posture) * stability * (1 - decay * 0.25), 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(ghostDisabled ? 'Ghost disabled' : 'Ghost enabled');
  topFactors.push(ceiling > 0 ? `CORD ceiling: ${ceiling}` : 'No CORD ceiling');
  topFactors.push(`Regime: ${macroRegime}`);
  topFactors.push(`Pressure: ${pressureTier}`);
  topFactors.push(`Decay: ${decay.toFixed(2)}`);

  const recommendation =
    score >= 0.75
      ? 'Maintain hardcore constraints; publish audit hash for dispute-proof enforcement.'
      : 'Tighten enforcement: persist mistakes and fail the run on limit breach.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + `:ml:M125:${macroRegime}:${pressureTier}:${tick}`),
    confidenceDecay: clamp(0.05 + decay * 0.30, 0.01, 0.50),
  };
}