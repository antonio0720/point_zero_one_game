// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m64_leaderboards.ts
//
// Mechanic : M64 — Leaderboards
// Family   : achievement_advanced   Layer: season_runtime   Priority: 1   Batch: 2
// ML Pair  : m64a
// Deps     : M50
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

// ── Local types (kept local to avoid circular deps) ─────────────────────────

export interface LeaderboardEntry {
  id: string;                 // deterministic submission id
  runId: string;              // CompletedRun.runId (or derived)
  userId: string;             // CompletedRun.userId (or derived)
  score: number;              // 0..M64_BOUNDS.MAX_EFFECT
  rankKey: string;            // deterministic ordering key (server-verifiable)
  proofHash: string;          // provided proof hash (server-side verification anchor)
  auditHash: string;          // internal audit (inputs+deriveds)
  submittedAtTick: number;    // season tick for submission
  regime: MacroRegime;        // regime context
  phase: RunPhase;            // phase context
  pressureTier: PressureTier; // derived difficulty tier (NOT player "pressure")
  tickTier: TickTier;         // derived tier for UI emphasis
  solvencyStatus: SolvencyStatus; // derived from outcome / score
  referenceCardId: string;    // deterministic deck anchor
  meta: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M64Input {
  completedRun?: CompletedRun;
  proofHash?: string;

  // Optional pass-through (season runtime may provide these; safe if absent)
  runId?: string;
  tick?: number;
}

export interface M64Output {
  leaderboardEntry: LeaderboardEntry;
  rankPosition: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M64Event = 'LEADERBOARD_SUBMIT' | 'RANK_UPDATED' | 'PERSONAL_BEST_SET';

export interface M64TelemetryPayload extends MechanicTelemetryPayload {
  event: M64Event;
  mechanic_id: 'M64';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M64_BOUNDS = {
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

type _M64_AllTypeImportsUsed = {
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

function m64LongHash(s: string): string {
  const h1 = computeHash(s);
  const h2 = computeHash(h1 + ':' + s);
  const h3 = computeHash(h2 + ':' + h1);
  const h4 = computeHash(h3 + ':' + s + ':' + h2);
  return (h1 + h2 + h3 + h4).slice(0, 32);
}

function m64DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.33)) return 'EARLY';
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.66)) return 'MID';
  return 'LATE';
}

function m64ResolveRegime(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN).slice().sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of schedule) {
    if (ev.tick <= tick && ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m64ChaosContext(seed: string, tick: number): { inChaos: boolean; window: ChaosWindow | null } {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return { inChaos: true, window: w };
  }
  return { inChaos: false, window: null };
}

function m64PressureTierFromContext(regime: MacroRegime, inChaos: boolean): PressureTier {
  let tier: PressureTier =
    regime === 'CRISIS' ? 'CRITICAL' :
    regime === 'BEAR' ? 'HIGH' :
    regime === 'NEUTRAL' ? 'MEDIUM' : 'LOW';

  if (inChaos) {
    tier =
      tier === 'LOW' ? 'MEDIUM' :
      tier === 'MEDIUM' ? 'HIGH' :
      'CRITICAL';
  }

  return tier;
}

function m64TickTierFromScore(score: number): TickTier {
  if (score >= 75_000) return 'CRITICAL';
  if (score >= 35_000) return 'ELEVATED';
  return 'STANDARD';
}

function m64SolvencyFromOutcome(outcome: string, score: number): SolvencyStatus {
  const o = String(outcome || '').toUpperCase();
  if (o.includes('WIPE') || o.includes('WIPED') || o.includes('BANKRUPT') || score <= 250) return 'WIPED';
  if (o.includes('BLEED') || score < M64_BOUNDS.BLEED_CASH_THRESHOLD) return 'BLEED';
  return 'SOLVENT';
}

function m64PickReferenceCard(seed: string, tick: number, phase: RunPhase, regime: MacroRegime, pressureTier: PressureTier): GameCard {
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:m64:${tick}`, pressurePhaseWeight, regimeWeight);
  const effectivePool = pool.length > 0 ? pool : OPPORTUNITY_POOL;

  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m64:deck`);
  const pickedId = deck[seededIndex(seed, tick, deck.length)] ?? DEFAULT_CARD.id;

  const fromPool = effectivePool.find(c => c.id === pickedId);
  if (fromPool) return fromPool;

  const fromOpp = OPPORTUNITY_POOL.find(c => c.id === pickedId);
  if (fromOpp) return fromOpp;

  return DEFAULT_CARD;
}

function m64ComputeLeaderboardScore(
  run: CompletedRun,
  tick: number,
  phase: RunPhase,
  regime: MacroRegime,
  pressureTier: PressureTier,
  inChaos: boolean,
  referenceCard: GameCard,
): { score: number; components: Record<string, number>; decay: number; mults: Record<string, number> } {
  const cord = clamp(Number(run.cordScore ?? 0) || 0, 0, 1);
  const ticks = clamp(Number(run.ticks ?? 0) || 0, 0, RUN_TOTAL_TICKS);

  const outcome = String(run.outcome ?? '');
  const solvencyHint =
    outcome.toUpperCase().includes('WIPE') ? 0.0 :
    outcome.toUpperCase().includes('BLEED') ? 0.35 :
    1.0;

  const cardCost = Number(referenceCard.cost ?? 0) || 0;
  const cardDown = Number(referenceCard.downPayment ?? 0) || 0;
  const cardAnchor = clamp(Math.round((cardCost + cardDown) * 0.22), 0, 25_000);

  const macroMult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  const decay = computeDecayRate(regime, M64_BOUNDS.BASE_DECAY_RATE);

  const base =
    (cord * 62_000) +
    ((ticks / RUN_TOTAL_TICKS) * 18_000) +
    (solvencyHint * 8_000) +
    cardAnchor;

  const chaosPenalty = inChaos ? 0.94 : 1.0;

  const scoreRaw =
    base *
    chaosPenalty *
    clamp(pressureW * phaseW * regimeW, 0.35, 3.25) *
    clamp(macroMult * exitPulse, 0.35, 3.25) *
    clamp(1 - decay, 0.50, 1.0) *
    M64_BOUNDS.EFFECT_MULTIPLIER *
    M64_BOUNDS.MULTIPLIER;

  const score = clamp(Math.round(scoreRaw), M64_BOUNDS.MIN_EFFECT, M64_BOUNDS.MAX_EFFECT);

  return {
    score,
    decay,
    components: { base, cardAnchor, cord, ticks, chaosPenalty },
    mults: { macroMult, exitPulse, pressureW, phaseW, regimeW },
  };
}

function m64ComputeRankPosition(seed: string, tick: number, score: number): number {
  // Deterministic pseudo-ranking (requires external aggregator for true global rank).
  // Lower number is better.
  const max = 10_000;
  const normalized = clamp(score / M64_BOUNDS.MAX_EFFECT, 0, 1);

  // Base rank by score (1 is best).
  const baseRank = 1 + Math.floor((1 - normalized) * (max - 1));

  // Tie-breaker nudges within a small band (keeps deterministic stability).
  const jitter = seededIndex(`${seed}:m64:rankjitter:${score}`, tick, 17) - 8; // -8..+8

  return clamp(baseRank + jitter, 1, max);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * leaderboardRankingEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function leaderboardRankingEngine(
  input: M64Input,
  emit: MechanicEmitter,
): M64Output {
  const __typeSentinel: _M64_AllTypeImportsUsed | null = null;
  void __typeSentinel;

  const completedRun: CompletedRun = (input.completedRun ?? {
    runId: '',
    userId: '',
    cordScore: 0,
    outcome: 'UNKNOWN',
    ticks: 0,
  }) as CompletedRun;

  const providedProofHash = String(input.proofHash ?? '');

  const runId =
    String(input.runId ?? '') ||
    String(completedRun.runId ?? '') ||
    m64LongHash('M64:' + JSON.stringify(completedRun));

  const tick = clamp(
    typeof input.tick === 'number' ? input.tick : seededIndex(runId, 64, RUN_TOTAL_TICKS),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  // Force timeline usage into deterministic proof chain.
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);

  const macroHash = m64LongHash(JSON.stringify(macroSchedule));
  const chaosHash = m64LongHash(JSON.stringify(chaosWindows));
  void chaosWindows;

  const phase = m64DerivePhase(tick);
  const regime = m64ResolveRegime(runId, tick);
  const { inChaos, window } = m64ChaosContext(runId, tick);

  const pressureTier = m64PressureTierFromContext(regime, inChaos);
  const referenceCard = m64PickReferenceCard(runId, tick, phase, regime, pressureTier);

  const { score, components, decay, mults } = m64ComputeLeaderboardScore(
    completedRun,
    tick,
    phase,
    regime,
    pressureTier,
    inChaos,
    referenceCard,
  );

  const tickTier = m64TickTierFromScore(score);
  const solvencyStatus = m64SolvencyFromOutcome(String(completedRun.outcome ?? ''), score);

  // Build deterministic ordering key: score desc, then stable hash asc (server can reproduce).
  const scoreKey = String(M64_BOUNDS.MAX_EFFECT - score).padStart(6, '0');
  const tieKey = computeHash(`${runId}:${tick}:${completedRun.userId}:${referenceCard.id}:${macroHash}:${chaosHash}`);
  const rankKey = `${scoreKey}:${tieKey}`;

  // Ensure seededShuffle is used for deterministic "neighbors preview" without revealing power.
  const neighborSeed = `${runId}:m64:neighbors:${tick}:${score}`;
  const neighborPool = seededShuffle(
    Array.from(new Set([completedRun.userId, ...DEFAULT_CARD_IDS, referenceCard.id])).slice(0, 8),
    neighborSeed,
  );

  // Deterministic submission id / audit hash.
  const auditHash = m64LongHash(
    JSON.stringify({
      mechanic: 'M64',
      runId,
      tick,
      completedRun,
      providedProofHash,
      regime,
      phase,
      pressureTier,
      inChaos,
      chaosWindow: window,
      referenceCardId: referenceCard.id,
      macroHash,
      chaosHash,
      components,
      mults,
      decay,
      score,
      rankKey,
    }),
  );

  const entryId = m64LongHash(`M64:entry:${runId}:${completedRun.userId}:${tick}:${auditHash}`);

  const leaderboardEntry: LeaderboardEntry = {
    id: entryId,
    runId: String(completedRun.runId ?? runId),
    userId: String(completedRun.userId ?? ''),
    score,
    rankKey,
    proofHash: providedProofHash,
    auditHash,
    submittedAtTick: tick,
    regime,
    phase,
    pressureTier,
    tickTier,
    solvencyStatus,
    referenceCardId: referenceCard.id,
    meta: {
      outcome: String(completedRun.outcome ?? ''),
      ticks: Number(completedRun.ticks ?? 0) || 0,
      cordScore: clamp(Number(completedRun.cordScore ?? 0) || 0, 0, 1),
      macroHash,
      chaosHash,
      inChaos,
      chaosWindow: window,
      decay,
      multipliers: mults,
      components,
      neighborsPreview: neighborPool.slice(0, 4),
    },
  };

  const rankPosition = m64ComputeRankPosition(runId, tick, score);

  emit({
    event: 'LEADERBOARD_SUBMIT',
    mechanic_id: 'M64',
    tick,
    runId,
    payload: {
      leaderboardEntry,
      proofHash: providedProofHash,
      entryId,
      referenceCardId: referenceCard.id,
      macroHash,
      chaosHash,
    },
  });

  emit({
    event: 'RANK_UPDATED',
    mechanic_id: 'M64',
    tick,
    runId,
    payload: {
      entryId,
      rankPosition,
      score,
      rankKey,
      tickTier,
      solvencyStatus,
    },
  });

  // Personal best heuristic: only triggers if caller provides prior best in completedRun.meta (optional).
  const priorBestScore = Number((completedRun as any)?.personalBestScore ?? (completedRun as any)?.priorBestScore ?? NaN);
  const priorBestRank = Number((completedRun as any)?.personalBestRank ?? (completedRun as any)?.priorBestPosition ?? NaN);

  const isScorePB = Number.isFinite(priorBestScore) ? score > priorBestScore : false;
  const isRankPB = Number.isFinite(priorBestRank) ? rankPosition < priorBestRank : false;

  if (isScorePB || isRankPB) {
    emit({
      event: 'PERSONAL_BEST_SET',
      mechanic_id: 'M64',
      tick,
      runId,
      payload: {
        entryId,
        score,
        rankPosition,
        priorBestScore: Number.isFinite(priorBestScore) ? priorBestScore : null,
        priorBestRank: Number.isFinite(priorBestRank) ? priorBestRank : null,
        improved: { score: isScorePB, rank: isRankPB },
      },
    });
  }

  return {
    leaderboardEntry,
    rankPosition,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M64MLInput {
  leaderboardEntry?: LeaderboardEntry;
  rankPosition?: number;
  runId: string;
  tick: number;
}

export interface M64MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * leaderboardRankingEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function leaderboardRankingEngineMLCompanion(
  input: M64MLInput,
): Promise<M64MLOutput> {
  const entry = input.leaderboardEntry;

  const s = clamp(Number(entry?.score ?? 0) || 0, 0, M64_BOUNDS.MAX_EFFECT);
  const r = clamp(Number(input.rankPosition ?? 10_000) || 10_000, 1, 10_000);

  // higher score + better rank => higher ML score
  const scoreComponent = s / M64_BOUNDS.MAX_EFFECT;
  const rankComponent = 1 - ((r - 1) / 9_999);

  const composite = clamp((scoreComponent * 0.72) + (rankComponent * 0.28), 0.01, 0.99);

  const topFactors: string[] = [
    entry ? `Score=${Math.round(entry.score)}` : 'Score=missing',
    `Rank=${r}`,
    entry ? `Regime=${entry.regime}` : 'Regime=missing',
    entry ? `Tier=${entry.tickTier}` : 'Tier=missing',
    `Tick=${input.tick}`,
  ].slice(0, 5);

  const recommendation =
    composite >= 0.85
      ? 'Lock the proof, publish the run, and avoid variance spikes on the next attempt.'
      : composite >= 0.55
        ? 'Improve CORD consistency and target higher-score finishes before resubmitting.'
        : 'Stabilize fundamentals: reduce wipes, extend ticks survived, and rebuild CORD signal quality.';

  return {
    score: composite,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M64'),
    confidenceDecay: clamp(0.04 + (1 - composite) * 0.12, 0.04, 0.22),
  };
}