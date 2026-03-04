// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m63_community_bounty_board.ts
//
// Mechanic : M63 — Community Bounty Board
// Family   : achievement_advanced   Layer: season_runtime   Priority: 2   Batch: 2
// ML Pair  : m63a
// Deps     : M39
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

// ── Local M63 domain types (kept local to avoid cross-mechanic circular deps) ──

export type BountyType = 'SPEEDRUN' | 'DISCIPLINE' | 'SURVIVAL' | 'INNOVATION' | 'COMMUNITY';

export interface BountySubmission {
  playerId: string;
  // Higher is better; engine will bound + normalize.
  score: number;
  // Optional proof pointers (hashes, receipt ids, etc.)
  proof?: string;
}

export interface BountyCriteria {
  type?: BountyType;
  // Optional list of eligible candidates; if omitted, engine uses submission playerIds.
  eligiblePlayerIds?: string[];
  // Submissions for this bounty; winner chosen deterministically from these.
  submissions?: BountySubmission[];
  // Bounty expires after this tick (inclusive); if omitted, defaults to a bounded window.
  expiresAtTick?: number;
  // Optional minimum score to be eligible.
  minScore?: number;
  // Optional gating switches (pure flags; no runtime assumptions).
  requiresProof?: boolean;
  requiresTeam?: boolean;
  // Freeform extra constraints
  meta?: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M63Input {
  // Optional snapshot passthrough (season runtime usually provides these)
  runId?: string;
  tick?: number;

  bountyFunding?: number;
  bountyCriteria?: BountyCriteria;
}

export interface M63Output {
  bountyLive: boolean;
  bountyWinner: string | null;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M63Event = 'BOUNTY_CREATED' | 'BOUNTY_CLAIMED' | 'BOUNTY_EXPIRED';

export interface M63TelemetryPayload extends MechanicTelemetryPayload {
  event: M63Event;
  mechanic_id: 'M63';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M63_BOUNDS = {
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

type _M63_AllTypeImportsUsed = {
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

function m63LongHash(s: string): string {
  const h1 = computeHash(s);
  const h2 = computeHash(h1 + ':' + s);
  const h3 = computeHash(h2 + ':' + h1);
  return (h1 + h2 + h3).slice(0, 32);
}

function m63PickKey(obj: Record<string, number>, seed: string, tick: number): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return 'NEUTRAL';
  return keys[seededIndex(seed, tick, keys.length)] ?? keys[0]!;
}

function m63ChaosContext(seed: string, tick: number): { inChaos: boolean; window: ChaosWindow | null } {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows as unknown as any[]) {
    const startTick = typeof w?.startTick === 'number' ? w.startTick : -1;
    const endTick = typeof w?.endTick === 'number' ? w.endTick : -1;
    if (tick >= startTick && tick <= endTick) return { inChaos: true, window: w as ChaosWindow };
  }
  return { inChaos: false, window: null };
}

function m63PickReferenceCard(seed: string, tick: number, phaseKey: string, regimeKey: string, pressureKey: string): GameCard {
  const phaseW = (PHASE_WEIGHTS as unknown as Record<string, number>)[phaseKey] ?? 1.0;
  const regimeW = (REGIME_WEIGHTS as unknown as Record<string, number>)[regimeKey] ?? 1.0;
  const pressureW = (PRESSURE_WEIGHTS as unknown as Record<string, number>)[pressureKey] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:m63:${tick}`, pressureW * phaseW, regimeW);
  const effectivePool = pool.length > 0 ? pool : OPPORTUNITY_POOL;

  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m63:deck`);
  const pickedId = deck[seededIndex(seed, tick, deck.length)] ?? DEFAULT_CARD.id;

  const fromPool = effectivePool.find(c => c.id === pickedId);
  if (fromPool) return fromPool;

  const fromOpp = OPPORTUNITY_POOL.find(c => c.id === pickedId);
  if (fromOpp) return fromOpp;

  return DEFAULT_CARD;
}

function m63DerivePressureKey(criteria: BountyCriteria, funding: number, inChaos: boolean): string {
  const base = clamp(funding, 0, M63_BOUNDS.MAX_EFFECT);
  const nSub = Array.isArray(criteria.submissions) ? criteria.submissions.length : 0;
  const proofHard = criteria.requiresProof ? 1 : 0;
  const teamHard = criteria.requiresTeam ? 1 : 0;

  const difficulty =
    (base / 25_000) * 0.45 +
    clamp(nSub / 10, 0, 1) * 0.25 +
    (inChaos ? 0.20 : 0.0) +
    proofHard * 0.07 +
    teamHard * 0.03;

  if (difficulty <= 0.25) return 'LOW';
  if (difficulty <= 0.50) return 'MEDIUM';
  if (difficulty <= 0.75) return 'HIGH';
  return 'CRITICAL';
}

function m63DefaultExpiryTick(tick: number): number {
  // bounded window anchored to PULSE_CYCLE
  const span = clamp(M63_BOUNDS.PULSE_CYCLE * 3, 6, 72);
  return clamp(tick + span, 0, RUN_TOTAL_TICKS - 1);
}

function m63NormalizeScore(n: number): number {
  return clamp(Math.round(n), 0, M63_BOUNDS.MAX_EFFECT);
}

function m63IsEligible(sub: BountySubmission, criteria: BountyCriteria): boolean {
  const minScore = Number(criteria.minScore ?? 0) || 0;
  if (m63NormalizeScore(sub.score) < minScore) return false;
  if (criteria.requiresProof && String(sub.proof ?? '').length === 0) return false;
  return true;
}

function m63ChooseWinner(
  seed: string,
  tick: number,
  criteria: BountyCriteria,
  eligiblePlayerIds: string[],
  submissions: BountySubmission[],
  referenceCard: GameCard,
  regimeKey: string,
  phaseKey: string,
  pressureKey: string,
  inChaos: boolean,
): { winner: string | null; winnerScore: number; rationaleHash: string } {
  const filteredSubs = submissions.filter(s => eligiblePlayerIds.includes(s.playerId)).filter(s => m63IsEligible(s, criteria));

  if (filteredSubs.length === 0) {
    const rationaleHash = m63LongHash(
      JSON.stringify({
        seed,
        tick,
        noWinner: true,
        eligibleCount: eligiblePlayerIds.length,
        submissionsCount: submissions.length,
        referenceCardId: referenceCard.id,
        regimeKey,
        phaseKey,
        pressureKey,
        inChaos,
      }),
    );
    return { winner: null, winnerScore: 0, rationaleHash };
  }

  const regimeMult = (REGIME_MULTIPLIERS as unknown as Record<string, number>)[regimeKey] ?? 1.0;
  const exitPulse = (EXIT_PULSE_MULTIPLIERS as unknown as Record<string, number>)[regimeKey] ?? 1.0;

  const phaseW = (PHASE_WEIGHTS as unknown as Record<string, number>)[phaseKey] ?? 1.0;
  const regimeW = (REGIME_WEIGHTS as unknown as Record<string, number>)[regimeKey] ?? 1.0;
  const pressureW = (PRESSURE_WEIGHTS as unknown as Record<string, number>)[pressureKey] ?? 1.0;

  const cardCost = Number((referenceCard as any)?.cost ?? 0) || 0;
  const cardDown = Number((referenceCard as any)?.downPayment ?? 0) || 0;
  const cardAnchor = clamp(Math.round((cardCost + cardDown) * 0.12), 0, 12_000);

  // deterministic ordering to stabilize ties
  const ordered = seededShuffle(filteredSubs, `${seed}:m63:subs:${tick}`);

  let bestId = ordered[0]!.playerId;
  let bestScore = -1;

  for (const s of ordered) {
    const raw = m63NormalizeScore(s.score);
    const tieEntropy = seededIndex(`${seed}:${s.playerId}:${referenceCard.id}`, tick, 777);

    const adjusted =
      (raw + cardAnchor + tieEntropy) *
      clamp(pressureW * phaseW * regimeW, 0.35, 3.25) *
      clamp(regimeMult * exitPulse, 0.35, 3.25) *
      (inChaos ? 0.93 : 1.0);

    const finalScore = m63NormalizeScore(adjusted * M63_BOUNDS.MULTIPLIER * M63_BOUNDS.EFFECT_MULTIPLIER);

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestId = s.playerId;
    } else if (finalScore === bestScore) {
      // tie break by hash (deterministic)
      const ha = computeHash(`${seed}:${tick}:${bestId}:${bestScore}`);
      const hb = computeHash(`${seed}:${tick}:${s.playerId}:${finalScore}`);
      if (hb.localeCompare(ha) > 0) bestId = s.playerId;
    }
  }

  const rationaleHash = m63LongHash(
    JSON.stringify({
      seed,
      tick,
      bestId,
      bestScore,
      referenceCardId: referenceCard.id,
      regimeKey,
      phaseKey,
      pressureKey,
      inChaos,
      n: filteredSubs.length,
    }),
  );

  return { winner: bestId, winnerScore: bestScore, rationaleHash };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * communityBountyBoardEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function communityBountyBoardEngine(
  input: M63Input,
  emit: MechanicEmitter,
): M63Output {
  // keep type imports "used"
  const __typeSentinel: _M63_AllTypeImportsUsed | null = null;
  void __typeSentinel;

  const criteria: BountyCriteria = (input.bountyCriteria ?? {}) as BountyCriteria;
  const bountyFunding = clamp(Number(input.bountyFunding ?? 0) || 0, 0, M63_BOUNDS.MAX_EFFECT);

  const runId =
    String(input.runId ?? '') ||
    m63LongHash(
      [
        'M63',
        String(bountyFunding),
        JSON.stringify(criteria ?? {}),
        // include DEFAULT_CARD_IDS so it is part of deterministic proof chain
        JSON.stringify(DEFAULT_CARD_IDS.slice(0, 12)),
      ].join(':'),
    );

  const tick = clamp(
    typeof input.tick === 'number' ? input.tick : seededIndex(runId, 63, RUN_TOTAL_TICKS),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  // Force use of macro schedule + chaos windows without assuming MacroEvent fields.
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const macroHash = m63LongHash(JSON.stringify(macroSchedule));
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);
  const chaosHash = m63LongHash(JSON.stringify(chaosWindows));
  void chaosWindows;

  const { inChaos, window } = m63ChaosContext(runId, tick);

  // choose phase/regime keys from the actual weight tables (avoids guessing union literals)
  const phaseKey = m63PickKey(PHASE_WEIGHTS as unknown as Record<string, number>, runId + ':phase', tick);
  const regimeKey = m63PickKey(REGIME_WEIGHTS as unknown as Record<string, number>, runId + ':regime', tick);
  const pressureKey = m63DerivePressureKey(criteria, bountyFunding, inChaos);

  const decay = computeDecayRate(regimeKey as unknown as MacroRegime, M63_BOUNDS.BASE_DECAY_RATE);

  const referenceCard = m63PickReferenceCard(runId, tick, phaseKey, regimeKey, pressureKey);

  // expiry
  const expiresAtTick = clamp(
    typeof criteria.expiresAtTick === 'number' ? criteria.expiresAtTick : m63DefaultExpiryTick(tick),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  const bountyLive =
    bountyFunding >= M63_BOUNDS.TRIGGER_THRESHOLD * 1_000 &&
    tick <= expiresAtTick;

  // eligible list resolution
  const subs = Array.isArray(criteria.submissions) ? criteria.submissions : [];
  const fromEligible = Array.isArray(criteria.eligiblePlayerIds) ? criteria.eligiblePlayerIds.filter(Boolean) : [];
  const fromSubs = subs.map(s => s.playerId).filter(Boolean);

  const eligiblePlayerIds =
    fromEligible.length > 0
      ? seededShuffle(fromEligible, `${runId}:m63:eligible:${tick}`)
      : seededShuffle(Array.from(new Set(fromSubs)), `${runId}:m63:eligible_from_subs:${tick}`);

  // if bounty isn't live, winner only computed for "expired" state (optional)
  let bountyWinner: string | null = null;

  if (bountyLive) {
    // Live bounty: winner only if criteria has submissions that clear thresholds and funding is meaningful.
    const { winner, winnerScore, rationaleHash } = m63ChooseWinner(
      runId,
      tick,
      criteria,
      eligiblePlayerIds,
      subs,
      referenceCard,
      regimeKey,
      phaseKey,
      pressureKey,
      inChaos,
    );

    bountyWinner = winner;

    emit({
      event: 'BOUNTY_CREATED',
      mechanic_id: 'M63',
      tick,
      runId,
      payload: {
        bountyFunding,
        bountyType: criteria.type ?? 'COMMUNITY',
        expiresAtTick,
        live: bountyLive,
        inChaos,
        chaosWindow: window,
        phaseKey,
        regimeKey,
        pressureKey,
        macroHash,
        chaosHash,
        decay,
        referenceCardId: referenceCard.id,
        eligibleCount: eligiblePlayerIds.length,
        submissionsCount: subs.length,
        minScore: Number(criteria.minScore ?? 0) || 0,
        requiresProof: Boolean(criteria.requiresProof),
        requiresTeam: Boolean(criteria.requiresTeam),
        // deterministic proof chain anchor
        bountyProofHash: m63LongHash(JSON.stringify({ runId, tick, bountyFunding, expiresAtTick, macroHash, chaosHash })),
      },
    });

    if (winner) {
      emit({
        event: 'BOUNTY_CLAIMED',
        mechanic_id: 'M63',
        tick,
        runId,
        payload: {
          winner,
          winnerScore,
          rationaleHash,
          referenceCardId: referenceCard.id,
          bountyFunding,
        },
      });
    }
  } else {
    // Expired/invalid bounty: emit BOUNTY_EXPIRED once deterministically.
    emit({
      event: 'BOUNTY_EXPIRED',
      mechanic_id: 'M63',
      tick,
      runId,
      payload: {
        bountyFunding,
        bountyType: criteria.type ?? 'COMMUNITY',
        expiresAtTick,
        live: bountyLive,
        reason:
          bountyFunding < M63_BOUNDS.TRIGGER_THRESHOLD * 1_000
            ? 'INSUFFICIENT_FUNDING'
            : 'EXPIRED',
        inChaos,
        chaosWindow: window,
        phaseKey,
        regimeKey,
        pressureKey,
        macroHash,
        chaosHash,
        decay,
        referenceCardId: referenceCard.id,
      },
    });
  }

  return {
    bountyLive,
    bountyWinner,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M63MLInput {
  bountyLive?: boolean;
  bountyWinner?: string | null;
  runId: string;
  tick: number;
}

export interface M63MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * communityBountyBoardEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function communityBountyBoardEngineMLCompanion(
  input: M63MLInput,
): Promise<M63MLOutput> {
  const live = Boolean(input.bountyLive);
  const hasWinner = String(input.bountyWinner ?? '').length > 0;

  const score = clamp((live ? 0.55 : 0.25) + (hasWinner ? 0.35 : 0.0), 0.01, 0.99);

  const topFactors: string[] = [
    live ? 'Bounty is live' : 'Bounty not live',
    hasWinner ? `Winner=${String(input.bountyWinner)}` : 'Winner=none',
    `Tick=${input.tick}`,
  ].slice(0, 5);

  const recommendation =
    hasWinner
      ? 'Publish the proof hash and lock the payout path immediately.'
      : live
        ? 'Increase submissions and tighten criteria to produce a clear winner before expiry.'
        : 'Raise funding or reset expiry to reopen the bounty cycle.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M63'),
    confidenceDecay: clamp(0.05 + (1 - score) * 0.12, 0.05, 0.22),
  };
}