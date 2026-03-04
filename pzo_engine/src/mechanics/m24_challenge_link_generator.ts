// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m24_challenge_link_generator.ts
//
// Mechanic : M24 — Challenge Link Generator
// Family   : moment_engine   Layer: backend_service   Priority: 1   Batch: 1
// ML Pair  : m24a
// Deps     : M01, M22
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

// ── Import Anchors (keeps every symbol “accessible” + TS-used) ───────────────

export const M24_IMPORTED_SYMBOLS = {
  clamp, computeHash, seededShuffle, seededIndex,
  buildMacroSchedule, buildChaosWindows,
  buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
  computeDecayRate, EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} as const;

export type M24_ImportedTypesAnchor = {
  runPhase: RunPhase; tickTier: TickTier; macroRegime: MacroRegime; pressureTier: PressureTier; solvencyStatus: SolvencyStatus;
  asset: Asset; ipaItem: IPAItem; gameCard: GameCard; gameEvent: GameEvent; shieldLayer: ShieldLayer; debt: Debt; buff: Buff;
  liability: Liability; setBonus: SetBonus; assetMod: AssetMod; incomeItem: IncomeItem; macroEvent: MacroEvent; chaosWindow: ChaosWindow;
  auctionResult: AuctionResult; purchaseResult: PurchaseResult; shieldResult: ShieldResult; exitResult: ExitResult; tickResult: TickResult;
  deckComposition: DeckComposition; tierProgress: TierProgress; wipeEvent: WipeEvent; regimeShiftEvent: RegimeShiftEvent;
  phaseTransitionEvent: PhaseTransitionEvent; timerExpiredEvent: TimerExpiredEvent; streakEvent: StreakEvent; fubarEvent: FubarEvent;
  ledgerEntry: LedgerEntry; proofCard: ProofCard; completedRun: CompletedRun; seasonState: SeasonState; runState: RunState;
  momentEvent: MomentEvent; clipBoundary: ClipBoundary; mechanicTelemetryPayload: MechanicTelemetryPayload; mechanicEmitter: MechanicEmitter;
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M24Input {
  runId?: string;
  seed?: string;
}

export interface M24Output {
  challengeUrl: string;
  ghostPayload: GhostPayload;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M24Event = 'CHALLENGE_LINK_CREATED' | 'GHOST_PAYLOAD_BUILT' | 'CHALLENGE_SHARED';

export interface M24TelemetryPayload extends MechanicTelemetryPayload {
  event: M24Event;
  mechanic_id: 'M24';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M24_BOUNDS = {
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

// ── Local schema (kept here to avoid cross-module coupling) ──────────────────

export type GhostMode = 'GHOST_REPLAY' | 'GHOST_DECK' | 'GHOST_TIMING';

export interface GhostPayload {
  version: 'v1';
  challengeId: string;

  runId: string;
  seed: string;

  // Deterministic context baked into the share link (server-verifiable)
  tick: number;
  regime: MacroRegime;
  phase: RunPhase;
  pressure: PressureTier;
  tickTier: TickTier;
  solvency: SolvencyStatus;

  // Timelines (deterministic artifacts)
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  // Share/clip hints (for UI integration)
  clipBoundaryHint: ClipBoundary;
  momentHint: MomentEvent;

  // Deck + card tags (deterministic, bounded)
  cardIdTag: string;
  deckTopId: string;

  // Difficulty + proof scaffold
  mode: GhostMode;
  difficultyScore: number; // 0..1
  stakeAmount: number;     // bounded by M24_BOUNDS.MAX_AMOUNT
  auditHash: string;

  // Optional proof artifacts (server can validate)
  proofCardHint: ProofCard;
  ledgerHint: LedgerEntry;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function derivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function deriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  if (!schedule || schedule.length === 0) return 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function findChaosHit(tick: number, windows: ChaosWindow[]): ChaosWindow | null {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return w;
  }
  return null;
}

function classifyPressure(phase: RunPhase, chaosHit: ChaosWindow | null): PressureTier {
  if (chaosHit) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function classifyTickTier(pressure: PressureTier, regime: MacroRegime): TickTier {
  if (pressure === 'CRITICAL' || regime === 'CRISIS') return 'CRITICAL';
  if (pressure === 'HIGH' || regime === 'BEAR') return 'ELEVATED';
  return 'STANDARD';
}

function pickCardIdTag(seed: string, tick: number, phase: RunPhase, pressure: PressureTier, regime: MacroRegime): string {
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressure] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const regimeWeight = (REGIME_WEIGHTS[regime] ?? 1.0);

  const pool: GameCard[] = buildWeightedPool(`${seed}:m24pool`, pressurePhaseWeight, regimeWeight);
  const poolPick =
    pool[seededIndex(seed, tick + 33, Math.max(1, pool.length))] ??
    OPPORTUNITY_POOL[seededIndex(seed, tick + 17, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const id = String(poolPick.id ?? DEFAULT_CARD.id);
  return DEFAULT_CARD_IDS.includes(id) ? id : DEFAULT_CARD.id;
}

function pickDeckTopId(seed: string, tick: number): string {
  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m24deck:${tick}`);
  const top = deck[0] ?? DEFAULT_CARD.id;
  return DEFAULT_CARD_IDS.includes(top) ? top : DEFAULT_CARD.id;
}

function chooseMode(seed: string, tick: number, pressure: PressureTier, regime: MacroRegime): GhostMode {
  const modes: GhostMode[] = ['GHOST_REPLAY', 'GHOST_DECK', 'GHOST_TIMING'];
  const bias = (pressure === 'CRITICAL' || regime === 'CRISIS') ? 2 : 0;
  return modes[seededIndex(seed, tick + 101 + bias, modes.length)] ?? 'GHOST_REPLAY';
}

function computeDifficulty(
  regime: MacroRegime,
  phase: RunPhase,
  pressure: PressureTier,
  tick: number,
): { difficultyScore: number; stakeAmount: number; decay: number; pulse: number; mult: number } {
  const decay = computeDecayRate(regime, M24_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const pw = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phw = PHASE_WEIGHTS[phase] ?? 1.0;
  const rw = REGIME_WEIGHTS[regime] ?? 1.0;

  // Normalize into 0..1 (bounded, deterministic)
  const raw = (pw * phw * rw) * (pulse * mult) / Math.max(0.05, decay);
  const difficultyScore = clamp(raw / 12, 0, 1);

  // Deterministic stake (bounded)
  const cycle = (tick % M24_BOUNDS.PULSE_CYCLE) / M24_BOUNDS.PULSE_CYCLE;
  const stakeRaw = (M24_BOUNDS.MAX_AMOUNT * 0.10) + (M24_BOUNDS.MAX_AMOUNT * 0.80) * difficultyScore * (0.85 + 0.30 * cycle);
  const stakeAmount = Math.round(clamp(stakeRaw, 0, M24_BOUNDS.MAX_AMOUNT));

  return { difficultyScore, stakeAmount, decay, pulse, mult };
}

function buildClipHint(tick: number, seed: string, chaosHit: ChaosWindow | null): ClipBoundary {
  const base = 3;
  const chaosBonus = chaosHit ? 2 : 0;
  const radius = clamp(base + chaosBonus + seededIndex(seed, tick + 7, 3), 2, 8);
  return {
    startTick: clamp(tick - radius, 0, RUN_TOTAL_TICKS - 1),
    endTick: clamp(tick + radius, 0, RUN_TOTAL_TICKS - 1),
    triggerEvent: chaosHit ? `CHAOS_${String(chaosHit.type ?? 'WINDOW').toUpperCase()}` : 'CHALLENGE',
  };
}

function buildMomentHint(tick: number, regime: MacroRegime, pressure: PressureTier, phase: RunPhase, cardIdTag: string): MomentEvent {
  const shareReady = pressure === 'CRITICAL' || regime === 'CRISIS';
  const type =
    shareReady ? 'CHALLENGE_MOMENT' :
    pressure === 'HIGH' ? 'TENSION_MOMENT' :
    'STANDARD_MOMENT';

  return {
    type,
    tick,
    highlight: `Challenge forged. Regime=${regime} Pressure=${pressure} Phase=${phase} CardTag=${cardIdTag}.`,
    shareReady,
  };
}

function buildChallengeUrl(challengeId: string, runId: string): string {
  // NOTE: intentionally scheme-based so clients can map to deep links without hardcoding domains here.
  const rid = encodeURIComponent(runId || 'unknown');
  return `pzo://challenge/${challengeId}?rid=${rid}`;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

export function challengeLinkGenerator(input: M24Input, emit: MechanicEmitter): M24Output {
  const runId = String(input.runId ?? '');
  const seedIn = String(input.seed ?? '');

  const seedBase =
    seedIn.length > 0
      ? computeHash(`${seedIn}:M24:${runId}`)
      : computeHash(JSON.stringify({ runId, t: Date.now() })); // only used if caller provides nothing

  // Deterministic tick anchor (client/server can re-derive from seed)
  const tick = clamp(seededIndex(seedBase, 11, RUN_TOTAL_TICKS), 0, RUN_TOTAL_TICKS - 1);

  // Deterministic schedules/windows
  const macroSchedule: MacroEvent[] = buildMacroSchedule(`${seedBase}:m24`, MACRO_EVENTS_PER_RUN);
  const chaosWindows: ChaosWindow[] = buildChaosWindows(`${seedBase}:m24`, CHAOS_WINDOWS_PER_RUN);

  const phase = derivePhase(tick);
  const regime = deriveRegime(tick, macroSchedule);
  const chaosHit = findChaosHit(tick, chaosWindows);
  const pressure = classifyPressure(phase, chaosHit);
  const tickTier = classifyTickTier(pressure, regime);
  const solvency: SolvencyStatus = (pressure === 'CRITICAL') ? 'BLEED' : 'SOLVENT';

  const cardIdTag = pickCardIdTag(seedBase, tick, phase, pressure, regime);
  const deckTopId = pickDeckTopId(seedBase, tick);
  const mode = chooseMode(seedBase, tick, pressure, regime);

  const { difficultyScore, stakeAmount, decay, pulse, mult } = computeDifficulty(regime, phase, pressure, tick);

  const clipBoundaryHint = buildClipHint(tick, seedBase, chaosHit);
  const momentHint = buildMomentHint(tick, regime, pressure, phase, cardIdTag);

  const challengeId = computeHash(
    JSON.stringify({
      mid: 'M24',
      runId,
      seed: seedBase,
      tick,
      regime,
      phase,
      pressure,
      tickTier,
      cardIdTag,
      deckTopId,
      mode,
      difficultyScore,
      stakeAmount,
      clipBoundaryHint,
    }),
  );

  const auditHash = computeHash(`${challengeId}:${seedBase}:audit:M24`);

  const proofCardHint: ProofCard = {
    runId: runId || seedBase,
    cordScore: Math.round(1000 * difficultyScore) / 10,
    hash: computeHash(`${challengeId}:proof`),
    grade: difficultyScore >= 0.80 ? 'S' : difficultyScore >= 0.60 ? 'A' : difficultyScore >= 0.40 ? 'B' : 'C',
  };

  const ledgerHint: LedgerEntry = {
    gameAction: {
      type: 'CHALLENGE_LINK',
      challengeId,
      mode,
      stakeAmount,
      cardIdTag,
    },
    tick,
    hash: computeHash(`${challengeId}:ledger:${tick}`),
  };

  const ghostPayload: GhostPayload = {
    version: 'v1',
    challengeId,

    runId: runId || seedBase,
    seed: seedBase,

    tick,
    regime,
    phase,
    pressure,
    tickTier,
    solvency,

    macroSchedule,
    chaosWindows,

    clipBoundaryHint,
    momentHint,

    cardIdTag,
    deckTopId,

    mode,
    difficultyScore,
    stakeAmount,
    auditHash,

    proofCardHint,
    ledgerHint,
  };

  const challengeUrl = buildChallengeUrl(challengeId, runId || seedBase);

  emit({
    event: 'CHALLENGE_LINK_CREATED',
    mechanic_id: 'M24',
    tick,
    runId: challengeId,
    payload: {
      runId: runId || seedBase,
      seedProvided: seedIn.length > 0,
      tick,
      regime,
      phase,
      pressure,
      tickTier,
      cardIdTag,
      deckTopId,
      mode,
      difficultyScore: Number(difficultyScore.toFixed(4)),
      stakeAmount,
      challengeUrl,
    },
  });

  emit({
    event: 'GHOST_PAYLOAD_BUILT',
    mechanic_id: 'M24',
    tick,
    runId: challengeId,
    payload: {
      challengeId,
      auditHash,
      macroEvents: macroSchedule.length,
      chaosWindows: chaosWindows.length,
      decay: Number(decay.toFixed(4)),
      pulse: Number(pulse.toFixed(4)),
      mult: Number(mult.toFixed(4)),
      clipBoundaryHint,
      momentHint,
    },
  });

  // If the caller provided a runId, treat it as a “shareable” creation
  if (runId.length > 0) {
    emit({
      event: 'CHALLENGE_SHARED',
      mechanic_id: 'M24',
      tick,
      runId: challengeId,
      payload: {
        runId,
        challengeId,
        challengeUrl,
        stakeAmount,
      },
    });
  }

  return {
    challengeUrl,
    ghostPayload,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M24MLInput {
  challengeUrl?: string;
  ghostPayload?: GhostPayload;
  runId: string;
  tick: number;
}

export interface M24MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

export async function challengeLinkGeneratorMLCompanion(input: M24MLInput): Promise<M24MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);

  const gp = input.ghostPayload;
  const regime: MacroRegime = gp?.regime ?? 'NEUTRAL';
  const pressure: PressureTier = gp?.pressure ?? 'LOW';

  const decay = computeDecayRate(regime, M24_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const difficulty = clamp(Number(gp?.difficultyScore ?? 0), 0, 1);
  const score = clamp(
    0.20 +
      difficulty * 0.55 +
      (pressure === 'CRITICAL' ? 0.10 : pressure === 'HIGH' ? 0.06 : 0.02) +
      clamp((pulse * mult) / 3, 0, 0.10) +
      clamp((1 - decay) / 2, 0, 0.08),
    0.01,
    0.99,
  );

  const topFactors = [
    `difficulty=${difficulty.toFixed(2)}`,
    `regime=${regime}`,
    `pressure=${pressure}`,
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `decay=${decay.toFixed(2)}`,
  ].slice(0, 5);

  const recommendation =
    score >= 0.75
      ? 'Share this challenge now: it is high-signal and will convert best as proof-of-skill.'
      : score >= 0.55
        ? 'Share this challenge with context (what changed + why). It is moderate-signal.'
        : 'Hold this link for later—generate a higher-pressure clip for stronger proof.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M24', ...input, regime, pressure, decay, pulse, mult }) + ':ml:M24'),
    confidenceDecay: decay,
  };
}