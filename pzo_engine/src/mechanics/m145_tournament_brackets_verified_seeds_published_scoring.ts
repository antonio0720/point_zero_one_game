// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m145_tournament_brackets_verified_seeds_published_scoring.ts
//
// Mechanic : M145 — Tournament Brackets: Verified Seeds Published Scoring
// Family   : ops   Layer: api_endpoint   Priority: 2   Batch: 3
// ML Pair  : m145a
// Deps     : M64, M01
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

export type M145_ImportedTypesAnchor = {
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

export const M145_ImportedValuesAnchor = {
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

export interface TournamentConfig {
  /** If omitted, derived from participant count. */
  rounds?: number;
  /** Best-of (odd numbers recommended). */
  bestOf?: number;
  /** Tick to start scheduling matches. */
  startTick?: number;
  /** Tick spacing between rounds (default derived). */
  roundSpacingTicks?: number;
  /** Allow BYE fills to next power of two. */
  allowByes?: boolean;
  /** Publish scoring signals with audit hash. */
  publishScoring?: boolean;
  /** Optional config metadata (JSON-safe). */
  meta?: Record<string, unknown>;
}

export interface TournamentMatch {
  matchId: string;
  round: number;
  slot: number;
  aId: string;
  bId: string;
  scheduledTick: number;
  /** Deterministic seed specific to this match. */
  seed: string;

  /** Deterministic featured content (spectator + fairness visibility). */
  featuredCardId: string;
  featuredCard: GameCard;

  /** Scoring scalar (bounded) for this match. */
  scoringScalar: number;
}

export interface TournamentScoringPublished {
  scoringVersion: 'M145/v1';
  bracketId: string;
  seed: string;

  regime: MacroRegime;
  phase: RunPhase;
  pressure: PressureTier;

  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
  regimeMultiplier: number;
  pulseMultiplier: number;
  decayRate: number;

  /** Stable audit hash for verification. */
  auditHash: string;
}

export interface TournamentBracket {
  bracketId: string;
  seed: string;
  participantIds: string[];
  rounds: number;
  matches: TournamentMatch[];

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  featuredPool: GameCard[];
  featuredDefaultIds: string[];

  scoringPublished?: TournamentScoringPublished;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M145Input {
  tournamentConfig?: TournamentConfig;
  participantIds?: string[];
  bracketSeed?: string;
}

export interface M145Output {
  bracketGenerated: boolean;
  matchScheduled: boolean;
  scoringPublished: boolean;
  /** Returned for convenience to downstream routers (pure output, no mutation). */
  bracket?: TournamentBracket;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M145Event = 'TOURNAMENT_STARTED' | 'MATCH_SCHEDULED' | 'BRACKET_UPDATED';

export interface M145TelemetryPayload extends MechanicTelemetryPayload {
  event: M145Event;
  mechanic_id: 'M145';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M145_BOUNDS = {
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

export const M145_TOURNAMENT_BOUNDS = {
  MIN_PARTICIPANTS: 2,
  MAX_PARTICIPANTS: 256,
  MIN_ROUNDS: 1,
  MAX_ROUNDS: 10,
  MIN_BEST_OF: 1,
  MAX_BEST_OF: 11,
  DEFAULT_ROUND_SPACING: 6,
  MAX_ROUND_SPACING: 24,
} as const;

// ── Deterministic helpers ─────────────────────────────────────────────────

function m145ToInt(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return fallback;
}

function m145NextPow2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function m145CeilLog2(n: number): number {
  const p2 = m145NextPow2(n);
  let r = 0;
  let p = 1;
  while (p < p2) {
    p <<= 1;
    r += 1;
  }
  return r;
}

function m145KeysAs<T extends string>(obj: Record<string, unknown>): T[] {
  return Object.keys(obj) as T[];
}

function m145PickFrom<T>(arr: T[], seed: string, salt: number): T {
  const idx = seededIndex(seed, salt, Math.max(1, arr.length));
  return arr[idx] ?? arr[0];
}

function m145NormalizeParticipantIds(ids: unknown, seed: string): string[] {
  const arr = Array.isArray(ids) ? (ids as unknown[]) : [];
  const out: string[] = [];
  for (const v of arr) {
    const s = String(v ?? '').trim();
    if (!s) continue;
    out.push(s);
  }
  const uniq = Array.from(new Set(out)).slice(0, M145_TOURNAMENT_BOUNDS.MAX_PARTICIPANTS);
  return seededShuffle(uniq, seed);
}

function m145DeriveContext(seed: string) {
  const phases = m145KeysAs<RunPhase>(PHASE_WEIGHTS as unknown as Record<string, unknown>);
  const pressures = m145KeysAs<PressureTier>(PRESSURE_WEIGHTS as unknown as Record<string, unknown>);
  const regimes = m145KeysAs<MacroRegime>(REGIME_WEIGHTS as unknown as Record<string, unknown>);

  const phase = m145PickFrom(phases, seed, 11);
  const pressure = m145PickFrom(pressures, seed, 29);
  const regime = m145PickFrom(regimes, seed, 47);

  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const pulseMultiplier = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M145_BOUNDS.BASE_DECAY_RATE);

  return {
    phase,
    pressure,
    regime,
    pressureWeight,
    phaseWeight,
    regimeWeight,
    regimeMultiplier,
    pulseMultiplier,
    decayRate,
  };
}

function m145BuildFeaturedPool(seed: string, weight: number, regimeWeight: number) {
  const pool = buildWeightedPool(seed, weight, regimeWeight);
  const shuffled = seededShuffle(pool, seed);
  const safe = shuffled.length ? shuffled : [DEFAULT_CARD];

  const idIdx = seededIndex(seed, 31337, Math.max(1, DEFAULT_CARD_IDS.length));
  const featuredDefaultIds = seededShuffle(DEFAULT_CARD_IDS, computeHash(seed + ':default-ids')).slice(0, 8);
  const featuredDefaultId = DEFAULT_CARD_IDS[idIdx] ?? DEFAULT_CARD.id;

  const oppIdx = seededIndex(seed, 777, Math.max(1, OPPORTUNITY_POOL.length));
  const opportunityCard = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  // guarantee we touched both DEFAULT_CARD and OPPORTUNITY_POOL deterministically
  const featuredCard = safe[seededIndex(seed, 999, safe.length)] ?? opportunityCard ?? DEFAULT_CARD;
  const featuredCardId = featuredCard.id || featuredDefaultId;

  return { featuredPool: safe, featuredCard, featuredCardId, featuredDefaultIds };
}

function m145ScheduleTick(startTick: number, round: number, slot: number, roundSpacing: number, seed: string): number {
  const base = startTick + (round - 1) * roundSpacing + slot;
  const jitter = seededIndex(seed, base + 17, 3) - 1; // -1..+1
  return clamp(base + jitter, 0, RUN_TOTAL_TICKS - 1);
}

function m145MakeMatchId(bracketId: string, round: number, slot: number, aId: string, bId: string): string {
  return computeHash(`${bracketId}:R${round}:S${slot}:${aId}:${bId}`);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * tournamentBracketEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function tournamentBracketEngine(input: M145Input, emit: MechanicEmitter): M145Output {
  const snapshotSeed = computeHash(JSON.stringify(input ?? {}));
  const bracketSeed = String(input.bracketSeed ?? '').trim();
  const seed = bracketSeed || snapshotSeed;

  const cfg = input.tournamentConfig;
  const bracketId = computeHash(`M145:${seed}`);

  const participantIds = m145NormalizeParticipantIds(input.participantIds, computeHash(seed + ':participants'));
  const n = clamp(participantIds.length, 0, M145_TOURNAMENT_BOUNDS.MAX_PARTICIPANTS);

  const allowByes = !!cfg?.allowByes;

  const startTick = clamp(m145ToInt(cfg?.startTick, 0), 0, RUN_TOTAL_TICKS - 1);
  const bestOf = clamp(
    m145ToInt(cfg?.bestOf, 1),
    M145_TOURNAMENT_BOUNDS.MIN_BEST_OF,
    M145_TOURNAMENT_BOUNDS.MAX_BEST_OF,
  );

  const derivedRounds = clamp(
    m145CeilLog2(Math.max(M145_TOURNAMENT_BOUNDS.MIN_PARTICIPANTS, n)),
    M145_TOURNAMENT_BOUNDS.MIN_ROUNDS,
    M145_TOURNAMENT_BOUNDS.MAX_ROUNDS,
  );

  const rounds = clamp(
    m145ToInt(cfg?.rounds, derivedRounds),
    M145_TOURNAMENT_BOUNDS.MIN_ROUNDS,
    M145_TOURNAMENT_BOUNDS.MAX_ROUNDS,
  );

  const roundSpacing = clamp(
    m145ToInt(cfg?.roundSpacingTicks, M145_TOURNAMENT_BOUNDS.DEFAULT_ROUND_SPACING),
    1,
    M145_TOURNAMENT_BOUNDS.MAX_ROUND_SPACING,
  );

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const ctx = m145DeriveContext(seed);

  const weight = clamp(ctx.pressureWeight * ctx.phaseWeight, 0.25, 10);
  const { featuredPool, featuredCard, featuredCardId, featuredDefaultIds } = m145BuildFeaturedPool(
    seed,
    weight,
    ctx.regimeWeight,
  );

  emit({
    event: 'TOURNAMENT_STARTED',
    mechanic_id: 'M145',
    tick: startTick,
    runId: bracketId,
    payload: {
      bracketId,
      seed,
      participants: n,
      rounds,
      bestOf,
      startTick,
      roundSpacing,
      allowByes,
      regime: ctx.regime,
      phase: ctx.phase,
      pressure: ctx.pressure,
      audit: computeHash(`${bracketId}:${seed}:${n}:${rounds}:${bestOf}`),
    },
  });

  const bracketGenerated = n >= M145_TOURNAMENT_BOUNDS.MIN_PARTICIPANTS;

  if (!bracketGenerated) {
    const emptyBracket: TournamentBracket = {
      bracketId,
      seed,
      participantIds,
      rounds,
      matches: [],
      macroSchedule,
      chaosWindows,
      featuredPool,
      featuredDefaultIds,
    };

    emit({
      event: 'BRACKET_UPDATED',
      mechanic_id: 'M145',
      tick: startTick,
      runId: bracketId,
      payload: {
        bracketId,
        reason: 'INSUFFICIENT_PARTICIPANTS',
        participants: n,
      },
    });

    return {
      bracketGenerated: false,
      matchScheduled: false,
      scoringPublished: false,
      bracket: emptyBracket,
    };
  }

  // Fill bracket to next power-of-two if allowed (BYE slots are deterministic).
  const target = allowByes ? m145NextPow2(n) : n;
  const filled: string[] = [...participantIds];
  while (filled.length < target) filled.push(`BYE:${computeHash(`${seed}:bye:${filled.length}`)}`);

  const ordered = seededShuffle(filled, computeHash(seed + ':bracket-order'));

  const matches: TournamentMatch[] = [];
  let currentRoundIds = ordered;

  for (let round = 1; round <= rounds; round += 1) {
    const nextRoundIds: string[] = [];

    const pairs = Math.floor(currentRoundIds.length / 2);
    for (let slot = 0; slot < pairs; slot += 1) {
      const aId = currentRoundIds[slot * 2] ?? '';
      const bId = currentRoundIds[slot * 2 + 1] ?? '';

      const matchSeed = computeHash(`${seed}:R${round}:S${slot}:${aId}:${bId}`);
      const scheduledTick = m145ScheduleTick(startTick, round, slot, roundSpacing, matchSeed);

      // Bounded chaos: match-specific scalar, deterministic, regime/decay aware.
      const jitterIdx = seededIndex(matchSeed, scheduledTick + 101, 11); // 0..10
      const jitter = 0.95 + jitterIdx * 0.01; // 0.95..1.05

      const scoringScalar = clamp(
        (ctx.regimeMultiplier * ctx.pulseMultiplier * (1 - ctx.decayRate)) *
          (ctx.pressureWeight + ctx.phaseWeight + ctx.regimeWeight) *
          jitter *
          M145_BOUNDS.EFFECT_MULTIPLIER,
        0.01,
        25,
      );

      // Deterministic featured card per match
      const cardIdx = seededIndex(matchSeed, scheduledTick + 202, featuredPool.length);
      const matchCard = featuredPool[cardIdx] ?? featuredCard ?? DEFAULT_CARD;

      const idIdx = seededIndex(matchSeed, scheduledTick + 303, Math.max(1, DEFAULT_CARD_IDS.length));
      const matchCardId = matchCard.id || (DEFAULT_CARD_IDS[idIdx] ?? featuredCardId ?? DEFAULT_CARD.id);

      const matchId = m145MakeMatchId(bracketId, round, slot, aId, bId);

      matches.push({
        matchId,
        round,
        slot,
        aId,
        bId,
        scheduledTick,
        seed: matchSeed,
        featuredCardId: matchCardId,
        featuredCard: matchCard,
        scoringScalar,
      });

      emit({
        event: 'MATCH_SCHEDULED',
        mechanic_id: 'M145',
        tick: scheduledTick,
        runId: bracketId,
        payload: {
          bracketId,
          matchId,
          round,
          slot,
          aId,
          bId,
          bestOf,
          featuredCardId: matchCardId,
          scoringScalar,
        },
      });

      // Winner placeholder for deterministic bracket shape (real winner resolved elsewhere).
      nextRoundIds.push(`WINNER:${matchId}`);
    }

    currentRoundIds = nextRoundIds;
    if (currentRoundIds.length < 2) break;
  }

  const publishScoring = cfg?.publishScoring ?? true;

  const scoringPublished: TournamentScoringPublished | undefined = publishScoring
    ? {
        scoringVersion: 'M145/v1',
        bracketId,
        seed,
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        pressureWeight: ctx.pressureWeight,
        phaseWeight: ctx.phaseWeight,
        regimeWeight: ctx.regimeWeight,
        regimeMultiplier: ctx.regimeMultiplier,
        pulseMultiplier: ctx.pulseMultiplier,
        decayRate: ctx.decayRate,
        auditHash: computeHash(
          JSON.stringify({
            bracketId,
            seed,
            rounds,
            bestOf,
            startTick,
            roundSpacing,
            regime: ctx.regime,
            phase: ctx.phase,
            pressure: ctx.pressure,
            weights: {
              pressure: ctx.pressureWeight,
              phase: ctx.phaseWeight,
              regime: ctx.regimeWeight,
              mult: ctx.regimeMultiplier,
              pulse: ctx.pulseMultiplier,
              decay: ctx.decayRate,
            },
            macroEvents: macroSchedule.length,
            chaosWindows: chaosWindows.length,
            featuredCardId,
            featuredDefaultIdsLen: featuredDefaultIds.length,
            defaultIdsLen: DEFAULT_CARD_IDS.length,
            opportunityPoolLen: OPPORTUNITY_POOL.length,
          }),
        ),
      }
    : undefined;

  const bracket: TournamentBracket = {
    bracketId,
    seed,
    participantIds: ordered,
    rounds,
    matches,
    macroSchedule,
    chaosWindows,
    featuredPool,
    featuredDefaultIds,
    scoringPublished,
  };

  emit({
    event: 'BRACKET_UPDATED',
    mechanic_id: 'M145',
    tick: startTick,
    runId: bracketId,
    payload: {
      bracketId,
      participants: ordered.length,
      rounds,
      matches: matches.length,
      scoringPublished: !!scoringPublished,
      featuredCardId,
      auditHash: scoringPublished?.auditHash ?? computeHash(`${bracketId}:no-score`),
    },
  });

  return {
    bracketGenerated: true,
    matchScheduled: matches.length > 0,
    scoringPublished: !!scoringPublished,
    bracket,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M145MLInput {
  bracketGenerated?: boolean;
  matchScheduled?: boolean;
  scoringPublished?: boolean;
  runId: string;
  tick: number;
}

export interface M145MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * tournamentBracketEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function tournamentBracketEngineMLCompanion(input: M145MLInput): Promise<M145MLOutput> {
  const generated = !!input.bracketGenerated;
  const scheduled = !!input.matchScheduled;
  const published = !!input.scoringPublished;

  const score = clamp(
    (generated ? 0.45 : 0.05) + (scheduled ? 0.35 : 0.0) + (published ? 0.15 : 0.0) + 0.05,
    0.01,
    0.99,
  );

  const topFactors: string[] = [];
  if (generated) topFactors.push('Bracket generated deterministically');
  if (scheduled) topFactors.push('Matches scheduled');
  if (published) topFactors.push('Scoring published with audit hash');
  topFactors.push('Server-verifiable by seed');
  topFactors.push('Advisory only (no state mutation)');

  const recommendation = generated
    ? 'Lock bracket seed and publish audit hash before play to prevent disputes and ensure fairness.'
    : 'Collect more participants or enable BYE fills to generate a valid bracket.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M145'),
    confidenceDecay: published ? 0.05 : 0.08,
  };
}