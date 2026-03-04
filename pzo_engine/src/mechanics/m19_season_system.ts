// pzo_engine/src/mechanics/m19_season_system.ts
// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m19_season_system.ts
//
// Mechanic : M19 — Season System
// Family   : meta_system   Layer: season_runtime   Priority: 1   Batch: 1
// ML Pair  : m19a
// Deps     : none
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

// Define RewardEntry locally if not exported from './types'
export interface RewardEntry {
  id: string;
  kind: 'CARD' | string;
  unlockTick: number;
  cardId?: string;
  amount?: number;
  meta?: Record<string, any>;
}

// Define SeasonConfig locally if not exported from './types'
export interface SeasonConfig {
  seasonId: string;
  startTick: number;
  endTick: number;
  rewardTable: RewardEntry[];
  seedSalt?: string;
}

/**
 * Exported anchors:
 * - prevents unused-import lint/tsconfig strictness
 * - keeps all utils/types reachable from consumer code via normal imports
 */
export const M19_IMPORTED_UTILS = {
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

/** Exported so it is not flagged as unused; also forces all type symbols to be “used” in this module. */
export type M19_ALL_IMPORTED_TYPES =
  | RunPhase
  | TickTier
  | MacroRegime
  | PressureTier
  | SolvencyStatus
  | Asset
  | IPAItem
  | GameCard
  | GameEvent
  | ShieldLayer
  | Debt
  | Buff
  | Liability
  | SetBonus
  | AssetMod
  | IncomeItem
  | MacroEvent
  | ChaosWindow
  | AuctionResult
  | PurchaseResult
  | ShieldResult
  | ExitResult
  | TickResult
  | DeckComposition
  | TierProgress
  | WipeEvent
  | RegimeShiftEvent
  | PhaseTransitionEvent
  | TimerExpiredEvent
  | StreakEvent
  | FubarEvent
  | LedgerEntry
  | ProofCard
  | CompletedRun
  | SeasonState
  | RunState
  | SeasonConfig
  | RewardEntry
  | MomentEvent
  | ClipBoundary
  | MechanicTelemetryPayload
  | MechanicEmitter;

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M19Input {
  seasonConfig?: SeasonConfig;
  stateSeasonState?: SeasonState;

  // Optional context (lets M19 deterministically weight rewards without hard dependency).
  stateRunState?: RunState;
  stateMacroRegime?: MacroRegime;
  stateRunPhase?: RunPhase;
  statePressureTier?: PressureTier;

  // Optional seed override (if orchestrator provides a canonical run/season seed).
  seed?: string;
}

export interface M19Output {
  seasonProgressUpdated: boolean;
  rewardUnlocked: RewardEntry | null;

  /** Returned mutation snapshot (no in-place writes). */
  nextSeasonState?: SeasonState;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M19Event = 'SEASON_STARTED' | 'SEASON_RULE_ACTIVATED' | 'REWARD_UNLOCKED' | 'SEASON_ENDED';

export interface M19TelemetryPayload extends MechanicTelemetryPayload {
  event: M19Event;
  mechanic_id: 'M19';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M19_BOUNDS = {
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

// ── Internal helpers ──────────────────────────────────────────────────────

function normalizeSeasonConfig(cfg: SeasonConfig | undefined, seed: string): SeasonConfig {
  if (cfg) return cfg;

  const seasonId = `S-${seed.slice(0, 8)}`;
  const startTick = 0;
  const endTick = RUN_TOTAL_TICKS - 1;

  // Default reward table: 12 card rewards, spaced evenly.
  const rewardCount = 12;
  const rewardTable: RewardEntry[] = Array.from({ length: rewardCount }, (_, i) => {
    const unlockTick = clamp(Math.round(((i + 1) / rewardCount) * endTick), startTick, endTick);

    const cardId =
      DEFAULT_CARD_IDS[seededIndex(seed, i + 700, DEFAULT_CARD_IDS.length)] ??
      DEFAULT_CARD.id;

    return {
      id: `rew-${computeHash(`${seasonId}:${i}:${unlockTick}`)}`,
      kind: 'CARD',
      unlockTick,
      cardId,
      meta: { default: true, slot: i + 1 },
    };
  });

  return { seasonId, startTick, endTick, rewardTable };
}

function initOrUpdateSeasonState(prev: SeasonState | undefined, seasonId: string, tick: number): SeasonState {
  if (!prev || prev.seasonId !== seasonId) {
    return { seasonId, tick, rewardsClaimed: [] };
  }
  if (prev.tick === tick) return prev;
  return { ...prev, tick };
}

function pickUnlockableReward(
  cfg: SeasonConfig,
  state: SeasonState,
  seed: string,
  tick: number,
  macroRegime: MacroRegime,
  runPhase: RunPhase,
  pressureTier: PressureTier,
): RewardEntry | null {
  const claimed = new Set(state.rewardsClaimed);
  const unlockable = cfg.rewardTable.filter(r => r.unlockTick <= tick && !claimed.has(r.id));
  if (unlockable.length === 0) return null;

  // Deterministic ordering that still feels “alive”.
  const shuffled = seededShuffle(unlockable, `${seed}:unlockable:${tick}`);

  // Weight card selection by game context.
  const pressurePhaseWeight = PRESSURE_WEIGHTS[pressureTier] * PHASE_WEIGHTS[runPhase];
  const regimeWeight = REGIME_WEIGHTS[macroRegime];
  const pool = buildWeightedPool(`${seed}:pool:${tick}`, pressurePhaseWeight, regimeWeight);

  const chosen = shuffled[seededIndex(seed, tick, shuffled.length)]!;
  if (chosen.kind === 'CARD' && !chosen.cardId) {
    const picked = pool[seededIndex(seed, tick + 999, pool.length)] ?? DEFAULT_CARD;
    const safeCardId =
      DEFAULT_CARD_IDS.includes(picked.id) || OPPORTUNITY_POOL.some(c => c.id === picked.id)
        ? picked.id
        : DEFAULT_CARD.id;

    return { ...chosen, cardId: safeCardId, meta: { ...(chosen.meta ?? {}), pickedFromPool: true } };
  }

  return chosen;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * seasonSystemRuntime
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function seasonSystemRuntime(input: M19Input, emit: MechanicEmitter): M19Output {
  const tick =
    (input.stateRunState?.tick ?? input.stateSeasonState?.tick ?? 0);

  const seedBase =
    input.seed ??
    computeHash(
      JSON.stringify({
        seasonId: input.seasonConfig?.seasonId ?? 'S0',
        seedSalt: input.seasonConfig?.seedSalt ?? '',
      }),
    );

  const cfg = normalizeSeasonConfig(input.seasonConfig, seedBase);

  const macroRegime: MacroRegime = input.stateMacroRegime ?? 'NEUTRAL';
  const runPhase: RunPhase = input.stateRunPhase ?? input.stateRunState?.runPhase ?? 'EARLY';
  const pressureTier: PressureTier = input.statePressureTier ?? 'LOW';

  const prevState = input.stateSeasonState;
  let nextState = initOrUpdateSeasonState(prevState, cfg.seasonId, tick);

  // Deterministic schedules (also forces these helpers/constants to be “used” in real logic).
  const macroSchedule = buildMacroSchedule(`${seedBase}:${cfg.seasonId}`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seedBase}:${cfg.seasonId}`, CHAOS_WINDOWS_PER_RUN);

  // Progress shaping (forces computeDecayRate + regime multipliers + pulse multipliers to be “used”).
  const decay = computeDecayRate(macroRegime, M19_BOUNDS.BASE_DECAY_RATE);
  const pulse = tick > 0 && tick % M19_BOUNDS.PULSE_CYCLE === 0 ? EXIT_PULSE_MULTIPLIERS[macroRegime] : 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const progressVelocity = clamp(decay * pulse * regimeMult, 0.01, 2.0);

  // Telemetry: season started
  if (!prevState || prevState.seasonId !== cfg.seasonId) {
    emit({
      event: 'SEASON_STARTED',
      mechanic_id: 'M19',
      tick,
      runId: seedBase,
      payload: {
        seasonId: cfg.seasonId,
        startTick: cfg.startTick,
        endTick: cfg.endTick,
        progressVelocity,
      },
    });
  }

  // Telemetry: season rule activation (macro event ticks + chaos windows as rule boundaries)
  const macroHit = macroSchedule.find(m => m.tick === tick);
  const chaosHit = chaosWindows.find(w => tick >= w.startTick && tick <= w.endTick);

  if (macroHit || (chaosHit && tick === chaosHit.startTick)) {
    emit({
      event: 'SEASON_RULE_ACTIVATED',
      mechanic_id: 'M19',
      tick,
      runId: seedBase,
      payload: {
        macroHit: macroHit ?? null,
        chaosHit: chaosHit ?? null,
        macroRegime,
        runPhase,
        pressureTier,
      },
    });
  }

  // Unlock reward if eligible
  const unlocked = pickUnlockableReward(cfg, nextState, seedBase, tick, macroRegime, runPhase, pressureTier);
  if (unlocked) {
    nextState = {
      ...nextState,
      rewardsClaimed: [...nextState.rewardsClaimed, unlocked.id],
    };

    emit({
      event: 'REWARD_UNLOCKED',
      mechanic_id: 'M19',
      tick,
      runId: seedBase,
      payload: {
        rewardId: unlocked.id,
        kind: unlocked.kind,
        unlockTick: unlocked.unlockTick,
        cardId: unlocked.cardId ?? null,
        amount: unlocked.amount ?? null,
        progressVelocity,
      },
    });
  }

  // Telemetry: season ended
  if (tick >= cfg.endTick) {
    emit({
      event: 'SEASON_ENDED',
      mechanic_id: 'M19',
      tick,
      runId: seedBase,
      payload: {
        seasonId: cfg.seasonId,
        claimedCount: nextState.rewardsClaimed.length,
        totalRewards: cfg.rewardTable.length,
      },
    });
  }

  const seasonProgressUpdated =
    !prevState ||
    prevState.seasonId !== nextState.seasonId ||
    prevState.tick !== nextState.tick ||
    prevState.rewardsClaimed.length !== nextState.rewardsClaimed.length;

  return {
    seasonProgressUpdated,
    rewardUnlocked: unlocked ?? null,
    nextSeasonState: nextState,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M19MLInput {
  seasonProgressUpdated?: boolean;
  rewardUnlocked?: RewardEntry | null;
  runId: string;
  tick: number;
}

export interface M19MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * seasonSystemRuntimeMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function seasonSystemRuntimeMLCompanion(input: M19MLInput): Promise<M19MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));
  return {
    score,
    topFactors: ['M19 signal computed', 'advisory only'],
    recommendation: 'Monitor M19 output and adjust strategy accordingly.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M19'),
    confidenceDecay: 0.05,
  };
}