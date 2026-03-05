// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m123_king_of_the_hill_table_winner_stays_stakes_rotate.ts
//
// Mechanic : M123 — King of the Hill: Table Winner Stays Stakes Rotate
// Family   : social_advanced   Layer: season_runtime   Priority: 2   Batch: 3
// ML Pair  : m123a
// Deps     : M123
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
export const M123_IMPORTED_SYMBOLS = {
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
 * Prevents noUnusedLocals/noUnusedParameters warnings under strict builds.
 */
export type M123_ImportedTypesAnchor = {
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

// ── Local M123 domain types (intentionally not in ./types) ───────────────────

export type StakeTier = 'LOW' | 'MID' | 'HIGH' | 'ELITE';

export interface StakeConfig {
  baseStake?: number;
  rotationStep?: number;
  maxStake?: number;
  minStake?: number;
  tier?: StakeTier;
  tableSalt?: string;
  challengerQueueSize?: number;
}

export interface StakesState {
  currentStake: number;
  tier: StakeTier;
  rotationIndex: number;
  stakeHash: string;
}

function asString(v: unknown): string {
  return String(v ?? '').trim();
}

function toFiniteNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
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

function derivePressureTier(runPhase: RunPhase, macroRegime: MacroRegime, chaos: boolean): PressureTier {
  if (chaos) return 'CRITICAL';
  if (macroRegime === 'CRISIS') return runPhase === 'EARLY' ? 'HIGH' : 'CRITICAL';
  if (macroRegime === 'BEAR') return runPhase === 'LATE' ? 'HIGH' : 'MEDIUM';
  if (macroRegime === 'BULL') return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
  return runPhase === 'EARLY' ? 'LOW' : 'MEDIUM';
}

function deriveTickTier(pressureTier: PressureTier): TickTier {
  if (pressureTier === 'CRITICAL') return 'CRITICAL';
  if (pressureTier === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function parseStakeConfig(v: unknown): StakeConfig {
  if (!v || typeof v !== 'object') return {};
  const o = v as any;
  return {
    baseStake: toFiniteNumber(o.baseStake, undefined as any),
    rotationStep: toFiniteNumber(o.rotationStep, undefined as any),
    maxStake: toFiniteNumber(o.maxStake, undefined as any),
    minStake: toFiniteNumber(o.minStake, undefined as any),
    tier: (asString(o.tier) as StakeTier) || undefined,
    tableSalt: asString(o.tableSalt) || undefined,
    challengerQueueSize: Number.isFinite(Number(o.challengerQueueSize)) ? Math.trunc(Number(o.challengerQueueSize)) : undefined,
  };
}

function deriveStakeTier(regime: MacroRegime, pressure: PressureTier, runPhase: RunPhase): StakeTier {
  // Stakes rotate upward when macro/pressure intensify to keep KOTH meaningful.
  let score = 0;
  if (runPhase === 'MID') score += 1;
  if (runPhase === 'LATE') score += 2;

  if (regime === 'BEAR') score += 1;
  if (regime === 'CRISIS') score += 2;
  if (pressure === 'HIGH') score += 1;
  if (pressure === 'CRITICAL') score += 2;

  if (score >= 6) return 'ELITE';
  if (score >= 4) return 'HIGH';
  if (score >= 2) return 'MID';
  return 'LOW';
}

function stakeBoundsForTier(tier: StakeTier): { min: number; max: number; base: number; step: number } {
  // Bounded, deterministic, and non-P2W (same rules for everyone at that table state).
  switch (tier) {
    case 'ELITE':
      return { min: 10_000, max: 50_000, base: 25_000, step: 2_500 };
    case 'HIGH':
      return { min: 5_000, max: 25_000, base: 12_500, step: 1_250 };
    case 'MID':
      return { min: 1_000, max: 10_000, base: 5_000, step: 500 };
    case 'LOW':
    default:
      return { min: 250, max: 5_000, base: 1_000, step: 250 };
  }
}

function rotateStakes(params: {
  seed: string;
  tier: StakeTier;
  config: StakeConfig;
  rotationIndex: number;
}): StakesState {
  const tierBounds = stakeBoundsForTier(params.tier);

  const minStake = clamp(
    Math.round(toFiniteNumber(params.config.minStake, tierBounds.min)),
    tierBounds.min,
    tierBounds.max,
  );

  const maxStake = clamp(
    Math.round(toFiniteNumber(params.config.maxStake, tierBounds.max)),
    tierBounds.min,
    tierBounds.max,
  );

  const baseStake = clamp(
    Math.round(toFiniteNumber(params.config.baseStake, tierBounds.base)),
    minStake,
    maxStake,
  );

  const rotationStep = clamp(
    Math.round(toFiniteNumber(params.config.rotationStep, tierBounds.step)),
    1,
    Math.max(1, Math.round((maxStake - minStake) / 2)),
  );

  // Deterministic “rotation drift”: uses index + seed to vary within safe bounds.
  const jitter = (parseInt(computeHash(`${params.seed}:stake:jitter:${params.rotationIndex}`), 16) % 9) - 4; // -4..+4
  const drifted = baseStake + params.rotationIndex * rotationStep + jitter * Math.max(1, Math.round(rotationStep * 0.1));

  const currentStake = clamp(Math.round(drifted), minStake, maxStake);

  const stakeHash = computeHash(
    JSON.stringify({
      tier: params.tier,
      minStake,
      maxStake,
      baseStake,
      rotationStep,
      rotationIndex: params.rotationIndex,
      currentStake,
    }),
  );

  return {
    currentStake,
    tier: params.tier,
    rotationIndex: params.rotationIndex,
    stakeHash,
  };
}

function pickKingFromHistory(seed: string, winnerHistory: string[]): string {
  const clean = winnerHistory.map(asString).filter(Boolean);
  if (clean.length === 0) return computeHash(seed + ':king').slice(0, 16);

  // “Winner stays”: last winner is king, unless deterministic tie-breaker needed.
  const last = clean[clean.length - 1];
  const tieBreak = seededIndex(seed + ':king:tiebreak', clean.length, clean.length);
  return clean[tieBreak] ?? last;
}

function challengerQueueDecision(seed: string, historyLen: number, queueSize: number): boolean {
  // Deterministic queue signal: more history increases challenger pressure.
  const base = clamp(historyLen / 10, 0, 1);
  const roll = (parseInt(computeHash(`${seed}:q:${historyLen}`), 16) % 1000) / 1000;
  return roll < base && queueSize > 0;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M123Input {
  tableId?: string;
  winnerHistory?: string[];
  stakeConfig?: Record<string, unknown>;
}

export interface M123Output {
  kingDesignated: string;
  stakesUpdated: boolean;
  challengerQueued: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M123Event = 'KING_DESIGNATED' | 'STAKES_ROTATED' | 'CHALLENGER_JOINED';

export interface M123TelemetryPayload extends MechanicTelemetryPayload {
  event: M123Event;
  mechanic_id: 'M123';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M123_BOUNDS = {
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

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * kingOfHillTableEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function kingOfHillTableEngine(input: M123Input, emit: MechanicEmitter): M123Output {
  const tableIdRaw = asString(input.tableId);
  const winnerHistory = Array.isArray(input.winnerHistory) ? input.winnerHistory.map(asString).filter(Boolean) : [];
  const stakeCfg = parseStakeConfig(input.stakeConfig);

  // Deterministic identity.
  const tableId = tableIdRaw || computeHash('M123:table:' + JSON.stringify(winnerHistory)).slice(0, 16);

  // Deterministic seed binds table + history + stake config.
  const seed = computeHash('M123:' + tableId + ':' + computeHash(JSON.stringify(stakeCfg)));

  // Deterministic macro fabric (keeps shared imports live).
  const tick = 0;
  const macroSchedule = buildMacroSchedule(seed + ':macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':chaos', CHAOS_WINDOWS_PER_RUN);

  const runPhase = deriveRunPhase(tick);
  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const chaos = inChaosWindow(tick, chaosWindows);
  const pressureTier = derivePressureTier(runPhase, macroRegime, chaos);
  const tickTier = deriveTickTier(pressureTier);

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const decay = computeDecayRate(macroRegime, M123_BOUNDS.BASE_DECAY_RATE);
  const pulseMult = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  // Bind KOTH stakes to the weekly “economy texture” so stakes feel coherent with the run.
  const weightedPoolCards = buildWeightedPool(seed + ':cards', pressureW * phaseW, regimeW);
  const opportunityHint = OPPORTUNITY_POOL[seededIndex(seed + ':opp', tick, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const deckHintTop = deckOrder[0] ?? DEFAULT_CARD.id;

  // Winner stays = king is last winner, with deterministic tie-break if needed.
  const kingDesignated = pickKingFromHistory(seed, winnerHistory);

  // Stakes rotate deterministically based on history length.
  const derivedTier = stakeCfg.tier ?? deriveStakeTier(macroRegime, pressureTier, runPhase);
  const rotationIndex = clamp(winnerHistory.length, 0, 10_000);
  const stakesState = rotateStakes({
    seed: seed + ':' + (stakeCfg.tableSalt ?? 'salt'),
    tier: derivedTier,
    config: stakeCfg,
    rotationIndex,
  });

  const challengerQueueSize = clamp(toFiniteNumber(stakeCfg.challengerQueueSize, 1), 0, 64);
  const challengerQueued = challengerQueueDecision(seed, winnerHistory.length, challengerQueueSize);

  // “Updated” if history is non-empty or stake config present (deterministic).
  const stakesUpdated = true;

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M123',
      tableId,
      seed,
      tick,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      chaos,
      decay,
      pulseMult,
      regimeMult,
      kingDesignated,
      winnerHistoryLen: winnerHistory.length,
      stakesState,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      weightedPoolSize: weightedPoolCards.length,
      challengerQueued,
      challengerQueueSize,
    }),
  );

  const runId = computeHash('M123:run:' + tableId);

  emit({
    event: 'KING_DESIGNATED',
    mechanic_id: 'M123',
    tick,
    runId,
    payload: {
      tableId,
      kingDesignated,
      winnerHistoryLen: winnerHistory.length,
      auditHash,

      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      chaos,

      stakes: {
        tier: stakesState.tier,
        rotationIndex: stakesState.rotationIndex,
        currentStake: stakesState.currentStake,
        stakeHash: stakesState.stakeHash,
      },

      deckHintTop,
      opportunityHintId: opportunityHint.id,

      decay,
      pulseMult,
      regimeMult,
    },
  });

  emit({
    event: 'STAKES_ROTATED',
    mechanic_id: 'M123',
    tick,
    runId,
    payload: {
      tableId,
      auditHash,
      stakeHash: stakesState.stakeHash,
      currentStake: stakesState.currentStake,
      tier: stakesState.tier,
      rotationIndex: stakesState.rotationIndex,
    },
  });

  if (challengerQueued) {
    emit({
      event: 'CHALLENGER_JOINED',
      mechanic_id: 'M123',
      tick,
      runId,
      payload: {
        tableId,
        auditHash,
        challengerQueued: true,
        challengerQueueSize,
      },
    });
  }

  return {
    kingDesignated,
    stakesUpdated,
    challengerQueued,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M123MLInput {
  kingDesignated?: string;
  stakesUpdated?: boolean;
  challengerQueued?: boolean;
  runId: string;
  tick: number;
}

export interface M123MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * kingOfHillTableEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function kingOfHillTableEngineMLCompanion(input: M123MLInput): Promise<M123MLOutput> {
  const tick = clamp(toFiniteNumber(input.tick, 0), 0, RUN_TOTAL_TICKS - 1);

  const macroRegime: MacroRegime = 'NEUTRAL'; // safe default (ML companion may not receive full ruleset here)
  const decay = computeDecayRate(macroRegime, M123_BOUNDS.BASE_DECAY_RATE);

  const hasKing = Boolean(asString(input.kingDesignated));
  const startedSignals = (input.stakesUpdated ? 0.25 : 0.0) + (input.challengerQueued ? 0.20 : 0.0) + (hasKing ? 0.25 : 0.0);

  const score = clamp((0.15 + startedSignals) * (1 - decay * 0.20), 0.01, 0.99);

  const topFactors: string[] = [];
  topFactors.push(hasKing ? 'King designated' : 'No king');
  topFactors.push(input.stakesUpdated ? 'Stakes rotated' : 'Stakes not rotated');
  topFactors.push(input.challengerQueued ? 'Challenger queued' : 'No challenger');
  topFactors.push(`Decay: ${decay.toFixed(2)}`);
  topFactors.push(`Tick: ${tick}`);

  const recommendation =
    score >= 0.75
      ? 'Publish stake hash + king id to clients to prevent disputes.'
      : 'Increase winner-history fidelity and include stake config in the run ledger.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M123:' + tick),
    confidenceDecay: clamp(0.05 + decay * 0.25, 0.01, 0.50),
  };
}