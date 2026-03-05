// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m144_spectator_theater_watch_live_runs_with_delay.ts
//
// Mechanic : M144 — Spectator Theater: Watch Live Runs with Delay
// Family   : ops   Layer: ui_component   Priority: 2   Batch: 3
// ML Pair  : m144a
// Deps     : M22, M64
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

// ── Import Anchors ──────────────────────────────────────────────────────────
// Ensures the generator-wide import set is always "used" in-module (types + values)
// without mutating exec_hook behavior.

export type M144_ImportedTypesAnchor = {
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

export const M144_ImportedValuesAnchor = {
  clamp,
  computeHash,
  seededShuffle,
  seededIndex,
  buildMacroSchedule,
  buildChaosWindows,
  buildWeightedPool,
  OPPORTUNITY_POOL_LEN: OPPORTUNITY_POOL.length,
  DEFAULT_CARD_ID: DEFAULT_CARD.id,
  DEFAULT_CARD_IDS_LEN: DEFAULT_CARD_IDS.length,
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

// ── Local domain (not part of global types.ts) ─────────────────────────────

export interface SpectatorConfig {
  spectatorId?: string;
  /** Viewer-requested tick to render (0..RUN_TOTAL_TICKS-1). */
  viewerTick?: number;
  /** Optional: explicit macro regime override for debugging UI (never authoritative). */
  forceRegime?: MacroRegime;
  /** Optional: explicit phase override for debugging UI (never authoritative). */
  forcePhase?: RunPhase;
  /** Optional: explicit pressure override for debugging UI (never authoritative). */
  forcePressure?: PressureTier;
  /** Allow chat UI. */
  chatEnabled?: boolean;
  /** Optional chat message to emit in this call (UI-driven). */
  chatMessage?: string;
  /** Allow prediction bets UI. */
  predictionBetEnabled?: boolean;
  /** Optional bet payload to emit in this call (UI-driven). */
  predictionBet?: { amount: number; pick: string };
  /** Optional extra metadata (JSON-safe). */
  meta?: Record<string, unknown>;
}

export interface SpectatorView {
  runId: string;
  spectatorId: string;
  /** Requested delay in ms (clamped). */
  delayMs: number;
  /** Viewer requested tick (clamped). */
  viewerTick: number;
  /** Tick actually rendered after delay + bounded jitter (clamped). */
  displayTick: number;

  derivedPhase: RunPhase;
  derivedPressure: PressureTier;
  derivedRegime: MacroRegime;

  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
  regimeMultiplier: number;

  /** Macro “pulse” used for spectator pacing (regime-specific). */
  pulseMultiplier: number;
  /** Regime-tuned decay rate used for UI smoothing (bounded). */
  decayRate: number;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  /** Deterministic featured content for the spectator UI. */
  featuredCard: GameCard;
  featuredPool: GameCard[];
  featuredCardId: string;

  /** Stable hash for audit/debug (inputs + derived context). */
  auditHash: string;

  /** Non-authoritative echo of config knobs used (UI/debug). */
  configEcho: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M144Input {
  spectatorConfig?: SpectatorConfig;
  runId?: string;
  delayMs?: number;
}

export interface M144Output {
  spectatorFeedActive: boolean;
  spectatorView: SpectatorView;
  predictionBetEnabled: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M144Event = 'SPECTATOR_JOINED' | 'PREDICTION_BET_PLACED' | 'SPECTATOR_CHAT_MESSAGE';

export interface M144TelemetryPayload extends MechanicTelemetryPayload {
  event: M144Event;
  mechanic_id: 'M144';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M144_BOUNDS = {
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

export const M144_SPECTATOR_BOUNDS = {
  /** 5 seconds per tick (RUN_TOTAL_TICKS=144 @ 12 ticks/min). */
  MS_PER_TICK: 5_000,
  /** Hard cap spectator delay to prevent pathological UI payloads. */
  MAX_DELAY_MS: 2 * 60_000, // 2 minutes
  /** Jitter ticks for “bounded chaos” (keeps display from being perfectly gameable). */
  MAX_JITTER_TICKS: 1,
} as const;

// ── Deterministic helpers ─────────────────────────────────────────────────

function m144DerivePhase(seed: string): RunPhase {
  const phases: RunPhase[] = ['EARLY', 'MID', 'LATE'];
  return phases[seededIndex(seed, 11, phases.length)] ?? 'EARLY';
}

function m144DerivePressure(seed: string): PressureTier {
  const tiers: PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return tiers[seededIndex(seed, 29, tiers.length)] ?? 'LOW';
}

function m144DeriveRegimeFromSchedule(viewTick: number, macroSchedule: MacroEvent[]): MacroRegime {
  let regime: MacroRegime = 'NEUTRAL';
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > viewTick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m144ToNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return fallback;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * spectatorTheaterEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function spectatorTheaterEngine(input: M144Input, emit: MechanicEmitter): M144Output {
  const spectatorConfig = input.spectatorConfig;
  const spectatorId = String(spectatorConfig?.spectatorId ?? '');
  const runId = String(input.runId ?? computeHash(JSON.stringify(input ?? {})));

  const delayMsRaw = m144ToNumber(input.delayMs, 0);
  const delayMs = clamp(delayMsRaw, 0, M144_SPECTATOR_BOUNDS.MAX_DELAY_MS);

  const viewerTickRaw = m144ToNumber(spectatorConfig?.viewerTick, 0);
  const viewerTick = clamp(Math.floor(viewerTickRaw), 0, RUN_TOTAL_TICKS - 1);

  const delayTicks = clamp(
    Math.floor(delayMs / M144_SPECTATOR_BOUNDS.MS_PER_TICK),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  // Deterministic seed anchored to (runId + spectatorId + delay + viewerTick).
  const seed = computeHash(`${runId}:M144:${spectatorId}:${delayMs}:${viewerTick}`);

  // Bounded jitter: -1..+1 tick, deterministic (prevents perfect “sniping” timing).
  const jitterIndex = seededIndex(seed, viewerTick + 7, 2 * M144_SPECTATOR_BOUNDS.MAX_JITTER_TICKS + 1); // 0..2
  const jitter = jitterIndex - M144_SPECTATOR_BOUNDS.MAX_JITTER_TICKS;

  const displayTick = clamp(viewerTick - delayTicks + jitter, 0, RUN_TOTAL_TICKS - 1);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const derivedRegime =
    spectatorConfig?.forceRegime ??
    m144DeriveRegimeFromSchedule(displayTick, macroSchedule);

  const derivedPhase = spectatorConfig?.forcePhase ?? m144DerivePhase(seed);
  const derivedPressure = spectatorConfig?.forcePressure ?? m144DerivePressure(seed);

  const pressureWeight = PRESSURE_WEIGHTS[derivedPressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[derivedPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[derivedRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[derivedRegime] ?? 1.0;

  const pulseMultiplier = EXIT_PULSE_MULTIPLIERS[derivedRegime] ?? 1.0;
  const decayRate = computeDecayRate(derivedRegime, M144_BOUNDS.BASE_DECAY_RATE);

  const weightedPool = buildWeightedPool(seed, pressureWeight * phaseWeight, regimeWeight);
  const featuredPool = seededShuffle(weightedPool, seed);

  const featuredIdx = seededIndex(seed, displayTick + 999, featuredPool.length || 1);
  const featuredCard = featuredPool[featuredIdx] ?? DEFAULT_CARD;

  const defaultIdIdx = seededIndex(seed, displayTick + 31337, DEFAULT_CARD_IDS.length || 1);
  const featuredCardId = featuredCard.id || (DEFAULT_CARD_IDS[defaultIdIdx] ?? DEFAULT_CARD.id);

  const auditHash = computeHash(
    [
      runId,
      spectatorId,
      String(delayMs),
      String(viewerTick),
      String(displayTick),
      derivedPhase,
      derivedPressure,
      derivedRegime,
      String(pressureWeight),
      String(phaseWeight),
      String(regimeWeight),
      String(regimeMultiplier),
      String(pulseMultiplier),
      String(decayRate),
      String(OPPORTUNITY_POOL.length),
      featuredCardId,
    ].join('|'),
  );

  const spectatorView: SpectatorView = {
    runId,
    spectatorId,
    delayMs,
    viewerTick,
    displayTick,
    derivedPhase,
    derivedPressure,
    derivedRegime,
    pressureWeight,
    phaseWeight,
    regimeWeight,
    regimeMultiplier,
    pulseMultiplier,
    decayRate,
    macroSchedule,
    chaosWindows,
    featuredCard,
    featuredPool,
    featuredCardId,
    auditHash,
    configEcho: {
      chatEnabled: !!spectatorConfig?.chatEnabled,
      predictionBetEnabled: spectatorConfig?.predictionBetEnabled ?? true,
      delayTicks,
      jitter,
      poolSize: featuredPool.length,
      defaultIds: DEFAULT_CARD_IDS.slice(0, 4),
      hardcaps: {
        maxDelayMs: M144_SPECTATOR_BOUNDS.MAX_DELAY_MS,
        totalTicks: RUN_TOTAL_TICKS,
        macroEvents: MACRO_EVENTS_PER_RUN,
        chaosWindows: CHAOS_WINDOWS_PER_RUN,
      },
    },
  };

  emit({
    event: 'SPECTATOR_JOINED',
    mechanic_id: 'M144',
    tick: displayTick,
    runId,
    payload: {
      spectatorId,
      delayMs,
      viewerTick,
      displayTick,
      derivedPhase,
      derivedPressure,
      derivedRegime,
      featuredCardId,
      auditHash,
    },
  });

  const chatMessage = String(spectatorConfig?.chatMessage ?? '').trim();
  if (spectatorConfig?.chatEnabled && chatMessage) {
    emit({
      event: 'SPECTATOR_CHAT_MESSAGE',
      mechanic_id: 'M144',
      tick: displayTick,
      runId,
      payload: {
        spectatorId,
        messageHash: computeHash(chatMessage),
        messageLen: chatMessage.length,
        auditHash,
      },
    });
  }

  const predictionBetEnabled =
    (spectatorConfig?.predictionBetEnabled ?? true) &&
    derivedRegime !== 'CRISIS'; // spectator betting disabled in CRISIS by default

  const bet = spectatorConfig?.predictionBet;
  if (predictionBetEnabled && bet && Number.isFinite(bet.amount) && bet.amount > 0) {
    const betAmount = clamp(Math.floor(bet.amount), 1, M144_BOUNDS.MAX_AMOUNT);
    const betPick = String(bet.pick ?? '').slice(0, 64);

    emit({
      event: 'PREDICTION_BET_PLACED',
      mechanic_id: 'M144',
      tick: displayTick,
      runId,
      payload: {
        spectatorId,
        amount: betAmount,
        pick: betPick,
        // bounded-chaos: deterministic factor (non-authoritative) for UI odds display
        oddsScalar:
          clamp((pressureWeight * phaseWeight * regimeWeight * pulseMultiplier) / 2, 0.25, 3.0) *
          clamp(1 - decayRate, 0.01, 0.99) *
          (regimeMultiplier || 1.0),
        auditHash,
      },
    });
  }

  return {
    spectatorFeedActive: true,
    spectatorView,
    predictionBetEnabled,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M144MLInput {
  spectatorFeedActive?: boolean;
  spectatorView?: SpectatorView;
  predictionBetEnabled?: boolean;
  runId: string;
  tick: number;
}

export interface M144MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * spectatorTheaterEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function spectatorTheaterEngineMLCompanion(input: M144MLInput): Promise<M144MLOutput> {
  const view = input.spectatorView;

  const delayMs = clamp(m144ToNumber(view?.delayMs, 0), 0, M144_SPECTATOR_BOUNDS.MAX_DELAY_MS);
  const displayTick = clamp(m144ToNumber(view?.displayTick, input.tick), 0, RUN_TOTAL_TICKS - 1);

  const betEnabled = !!input.predictionBetEnabled;
  const feedActive = !!input.spectatorFeedActive;

  const score = clamp(
    (feedActive ? 0.4 : 0.1) +
      (betEnabled ? 0.25 : 0.0) +
      clamp(1 - delayMs / M144_SPECTATOR_BOUNDS.MAX_DELAY_MS, 0, 1) * 0.25 +
      clamp(displayTick / (RUN_TOTAL_TICKS - 1), 0, 1) * 0.1,
    0.01,
    0.99,
  );

  const topFactors: string[] = [];
  if (feedActive) topFactors.push('Spectator feed active');
  if (betEnabled) topFactors.push('Prediction bets enabled');
  if (delayMs > 0) topFactors.push(`Delay applied (${delayMs}ms)`);
  if (view?.derivedRegime) topFactors.push(`Regime: ${view.derivedRegime}`);
  topFactors.push('Advisory only (no state mutation)');

  const recommendation = betEnabled
    ? 'Keep spectator pacing tight; surface featured cards during stable regimes to drive engagement.'
    : 'Enable prediction bets outside CRISIS for higher spectator retention and cleaner pacing.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M144'),
    confidenceDecay: betEnabled ? 0.05 : 0.03,
  };
}