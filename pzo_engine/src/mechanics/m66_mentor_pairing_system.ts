// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m66_mentor_pairing_system.ts
//
// Mechanic : M66 — Mentor Pairing System
// Family   : onboarding_advanced   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m66a
// Deps     : M41
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

// ── Local M66 domain types (backend_service layer; keep local to avoid cycles) ──

export type MentorTier = 'CADET' | 'SENTINEL' | 'ARCHITECT' | 'ORACLE';

export interface MentorProfile {
  mentorId: string;
  tier: MentorTier;
  // 0..1 quality signals (can be fed by ML/intel later)
  reliabilityScore: number;
  coachingScore: number;
  // capacity controls
  capacity: number;        // max active mentees
  activeMentees: number;   // current active mentees
  // optional language / timezone etc
  meta?: Record<string, unknown>;
}

export interface PairingRequest {
  newPlayerId: string;
  requestedMentorId?: string;
  // optional difficulty or goal tags
  goalTags?: string[];
  // optional "trust contract" id
  contractId?: string;
}

export interface PairingDecision {
  mentorId: string;
  newPlayerId: string;
  mentorTier: MentorTier;
  matchScore: number; // 0..1
  pairingHash: string;
  guidedRunSeed: string;
  rewardUnitsQueued: number; // bounded int
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M66Input {
  // Optional service passthrough (useful for backend_service routing)
  runId?: string;
  tick?: number;

  newPlayerId?: string;
  mentorId?: string;

  // Optional fleet snapshot. If omitted, engine will still behave deterministically.
  mentorPool?: MentorProfile[];

  // Optional request metadata
  goalTags?: string[];
  contractId?: string;
}

export interface M66Output {
  mentorPaired: boolean;
  guidedRunStarted: boolean;

  // Optional: backend can persist these if desired
  decision?: PairingDecision;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M66Event = 'MENTOR_PAIRED' | 'GUIDED_RUN_STARTED' | 'MENTOR_REWARD_QUEUED';

export interface M66TelemetryPayload extends MechanicTelemetryPayload {
  event: M66Event;
  mechanic_id: 'M66';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M66_BOUNDS = {
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

type _M66_AllTypeImportsUsed = {
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

function m66LongHash(s: string): string {
  const h1 = computeHash(s);
  const h2 = computeHash(h1 + ':' + s);
  const h3 = computeHash(h2 + ':' + h1);
  const h4 = computeHash(h3 + ':' + s + ':' + h2);
  return (h1 + h2 + h3 + h4).slice(0, 32);
}

function m66ResolveRegime(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN).slice().sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of schedule) {
    if (ev.tick <= tick && ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m66DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.33)) return 'EARLY';
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.66)) return 'MID';
  return 'LATE';
}

function m66InChaos(seed: string, tick: number): { inChaos: boolean; window: ChaosWindow | null } {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return { inChaos: true, window: w };
  }
  return { inChaos: false, window: null };
}

function m66DerivePressureTier(poolSize: number, inChaos: boolean): PressureTier {
  // backend load proxy: fewer mentors => higher pressure
  const scarcity =
    poolSize <= 0 ? 1.0 :
    poolSize <= 3 ? 0.8 :
    poolSize <= 8 ? 0.55 :
    poolSize <= 20 ? 0.35 : 0.20;

  const idx = scarcity + (inChaos ? 0.15 : 0);
  if (idx <= 0.35) return 'LOW';
  if (idx <= 0.55) return 'MEDIUM';
  if (idx <= 0.80) return 'HIGH';
  return 'CRITICAL';
}

function m66TickTierFromMatch(matchScore: number): TickTier {
  if (matchScore >= 0.85) return 'CRITICAL';
  if (matchScore >= 0.60) return 'ELEVATED';
  return 'STANDARD';
}

function m66SolvencyFromMatch(matchScore: number): SolvencyStatus {
  if (matchScore < 0.25) return 'BLEED';
  if (matchScore < 0.10) return 'WIPED';
  return 'SOLVENT';
}

function m66TierScore(tier: MentorTier): number {
  switch (tier) {
    case 'ORACLE': return 1.0;
    case 'ARCHITECT': return 0.82;
    case 'SENTINEL': return 0.62;
    default: return 0.45;
  }
}

function m66CapacityScore(p: MentorProfile): number {
  const cap = clamp(Number(p.capacity ?? 0) || 0, 0, 1_000);
  const active = clamp(Number(p.activeMentees ?? 0) || 0, 0, 1_000);
  if (cap <= 0) return 0;
  const remaining = clamp((cap - active) / cap, 0, 1);
  return remaining;
}

function m66ScoreMentor(
  p: MentorProfile,
  req: PairingRequest,
  seed: string,
  tick: number,
  regime: MacroRegime,
  phase: RunPhase,
  pressureTier: PressureTier,
  inChaos: boolean,
  referenceCard: GameCard,
  decay: number,
): number {
  const reliability = clamp(Number(p.reliabilityScore ?? 0) || 0, 0, 1);
  const coaching = clamp(Number(p.coachingScore ?? 0) || 0, 0, 1);
  const tier = m66TierScore(p.tier);
  const capacity = m66CapacityScore(p);

  // mild affinity: shared goal tags (no assumptions, simple string overlap)
  const reqTags = Array.isArray(req.goalTags) ? req.goalTags.filter(Boolean).map(String) : [];
  const mentorTags = Array.isArray((p.meta as any)?.goalTags) ? ((p.meta as any).goalTags as any[]).map(String) : [];
  const overlap = reqTags.length === 0 ? 0 : reqTags.filter(t => mentorTags.includes(t)).length / reqTags.length;

  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const cardCost = Number(referenceCard.cost ?? 0) || 0;
  const cardDown = Number(referenceCard.downPayment ?? 0) || 0;
  const cardAnchor = clamp((cardCost + cardDown) / 250_000, 0, 0.25); // 0..0.25

  const base =
    (reliability * 0.34) +
    (coaching * 0.30) +
    (tier * 0.18) +
    (capacity * 0.14) +
    (overlap * 0.04);

  const chaosPenalty = inChaos ? 0.96 : 1.0;

  const scored =
    base *
    chaosPenalty *
    clamp(pressureW * phaseW * regimeW, 0.35, 3.25) *
    clamp(regimeMult * exitPulse, 0.35, 3.25) *
    clamp(1 - decay, 0.50, 1.0) *
    (1 - cardAnchor); // tie mentor pairing to economy anchor deterministically

  // deterministic tie-breaker (stable across nodes)
  const tie = seededIndex(`${seed}:m66:mentor:${p.mentorId}`, tick, 10_000) / 10_000;

  return clamp(scored + tie * 0.0005, 0, 1);
}

function m66PickReferenceCard(seed: string, tick: number, pressureTier: PressureTier, phase: RunPhase, regime: MacroRegime): GameCard {
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:m66:${tick}`, pressurePhaseWeight, regimeWeight);
  const effectivePool = pool.length > 0 ? pool : OPPORTUNITY_POOL;

  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m66:deck`);
  const pickedId = deck[seededIndex(seed, tick, deck.length)] ?? DEFAULT_CARD.id;

  const fromPool = effectivePool.find(c => c.id === pickedId);
  if (fromPool) return fromPool;

  const fromOpp = OPPORTUNITY_POOL.find(c => c.id === pickedId);
  if (fromOpp) return fromOpp;

  return DEFAULT_CARD;
}

function m66DefaultMentorPool(seed: string): MentorProfile[] {
  // deterministic fallback pool (so service works even before DB wiring)
  const baseIds = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m66:fallbackMentors`).slice(0, 12);
  return baseIds.map((id, i) => {
    const tier: MentorTier = i < 1 ? 'ORACLE' : i < 3 ? 'ARCHITECT' : i < 7 ? 'SENTINEL' : 'CADET';
    return {
      mentorId: `mentor_${id}`,
      tier,
      reliabilityScore: clamp(0.55 + (i % 5) * 0.08, 0, 1),
      coachingScore: clamp(0.50 + ((i + 2) % 6) * 0.07, 0, 1),
      capacity: i < 3 ? 4 : i < 7 ? 3 : 2,
      activeMentees: 0,
      meta: { goalTags: i % 2 === 0 ? ['discipline', 'survival'] : ['speedrun', 'strategy'] },
    };
  });
}

function m66RewardUnits(matchScore: number, tier: MentorTier, decay: number): number {
  // bounded mentor reward units queue (backend can map units -> XP/coins)
  const base = 40 + Math.round(matchScore * 120);
  const tierBoost = tier === 'ORACLE' ? 35 : tier === 'ARCHITECT' ? 22 : tier === 'SENTINEL' ? 12 : 6;
  const dec = clamp(1 - decay, 0.50, 1.0);
  return clamp(Math.round((base + tierBoost) * dec), 10, 250);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * mentorPairingEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function mentorPairingEngine(
  input: M66Input,
  emit: MechanicEmitter,
): M66Output {
  const __typeSentinel: _M66_AllTypeImportsUsed | null = null;
  void __typeSentinel;

  const newPlayerId = String(input.newPlayerId ?? '');
  const requestedMentorId = String(input.mentorId ?? '');

  const req: PairingRequest = {
    newPlayerId,
    requestedMentorId: requestedMentorId.length > 0 ? requestedMentorId : undefined,
    goalTags: Array.isArray(input.goalTags) ? input.goalTags.map(String) : undefined,
    contractId: String(input.contractId ?? '') || undefined,
  };

  const serviceSeed =
    String(input.runId ?? '') ||
    m66LongHash(
      [
        'M66',
        req.newPlayerId,
        req.requestedMentorId ?? '',
        JSON.stringify(req.goalTags ?? []),
        req.contractId ?? '',
        JSON.stringify(DEFAULT_CARD_IDS.slice(0, 12)),
      ].join(':'),
    );

  const tick = clamp(
    typeof input.tick === 'number' ? input.tick : seededIndex(serviceSeed, 66, RUN_TOTAL_TICKS),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  const phase = m66DerivePhase(tick);
  const regime = m66ResolveRegime(serviceSeed, tick);
  const { inChaos, window } = m66InChaos(serviceSeed, tick);

  const mentorPool = (Array.isArray(input.mentorPool) ? input.mentorPool : null) ?? m66DefaultMentorPool(serviceSeed);
  const pressureTier = m66DerivePressureTier(mentorPool.length, inChaos);

  const referenceCard = m66PickReferenceCard(serviceSeed, tick, pressureTier, phase, regime);
  const decay = computeDecayRate(regime, M66_BOUNDS.BASE_DECAY_RATE);

  // Deterministic candidate ordering.
  const candidates = seededShuffle(mentorPool, `${serviceSeed}:m66:candidates:${tick}`);

  let chosen: MentorProfile | null = null;
  let bestScore = -1;

  // If a specific mentor was requested, score only that mentor if present.
  if (req.requestedMentorId) {
    const found = candidates.find(m => m.mentorId === req.requestedMentorId) ?? null;
    if (found) {
      chosen = found;
      bestScore = m66ScoreMentor(found, req, serviceSeed, tick, regime, phase, pressureTier, inChaos, referenceCard, decay);
    }
  }

  // Otherwise select best mentor by score.
  if (!chosen) {
    for (const m of candidates) {
      const cap = m66CapacityScore(m);
      if (cap <= 0) continue; // no capacity => skip (still deterministic)
      const s = m66ScoreMentor(m, req, serviceSeed, tick, regime, phase, pressureTier, inChaos, referenceCard, decay);
      if (s > bestScore) {
        bestScore = s;
        chosen = m;
      }
    }
  }

  const mentorPaired = Boolean(chosen && newPlayerId.length > 0);
  const guidedRunStarted = mentorPaired; // backend will actually create the guided run; engine emits deterministic intent

  const pairingHash = m66LongHash(
    JSON.stringify({
      mechanic: 'M66',
      serviceSeed,
      tick,
      newPlayerId,
      chosenMentorId: chosen?.mentorId ?? '',
      mentorTier: chosen?.tier ?? '',
      bestScore,
      regime,
      phase,
      pressureTier,
      inChaos,
      chaosWindow: window,
      referenceCardId: referenceCard.id,
      decay,
    }),
  );

  const guidedRunSeed = m66LongHash(`M66:guided:${pairingHash}:${newPlayerId}:${chosen?.mentorId ?? ''}`);

  const rewardUnitsQueued = mentorPaired
    ? m66RewardUnits(bestScore, chosen!.tier, decay)
    : 0;

  const decision: PairingDecision | undefined = mentorPaired
    ? {
        mentorId: chosen!.mentorId,
        newPlayerId,
        mentorTier: chosen!.tier,
        matchScore: clamp(bestScore, 0, 1),
        pairingHash,
        guidedRunSeed,
        rewardUnitsQueued,
      }
    : undefined;

  emit({
    event: 'MENTOR_PAIRED',
    mechanic_id: 'M66',
    tick,
    runId: serviceSeed,
    payload: {
      newPlayerId,
      requestedMentorId: req.requestedMentorId ?? null,
      mentorPaired,
      chosenMentorId: chosen?.mentorId ?? null,
      mentorTier: chosen?.tier ?? null,
      matchScore: clamp(bestScore, 0, 1),
      pairingHash,
      regime,
      phase,
      pressureTier,
      inChaos,
      chaosWindow: window,
      referenceCardId: referenceCard.id,
      decay,
      candidateCount: candidates.length,
    },
  });

  if (guidedRunStarted && decision) {
    emit({
      event: 'GUIDED_RUN_STARTED',
      mechanic_id: 'M66',
      tick,
      runId: serviceSeed,
      payload: {
        newPlayerId,
        mentorId: decision.mentorId,
        guidedRunSeed: decision.guidedRunSeed,
        pairingHash: decision.pairingHash,
        matchScore: decision.matchScore,
      },
    });

    emit({
      event: 'MENTOR_REWARD_QUEUED',
      mechanic_id: 'M66',
      tick,
      runId: serviceSeed,
      payload: {
        mentorId: decision.mentorId,
        newPlayerId,
        rewardUnitsQueued: decision.rewardUnitsQueued,
        pairingHash: decision.pairingHash,
        proof: computeHash(`${decision.pairingHash}:${decision.rewardUnitsQueued}`),
      },
    });
  }

  return {
    mentorPaired,
    guidedRunStarted,
    decision,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M66MLInput {
  mentorPaired?: boolean;
  guidedRunStarted?: boolean;
  runId: string;
  tick: number;
}

export interface M66MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * mentorPairingEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function mentorPairingEngineMLCompanion(
  input: M66MLInput,
): Promise<M66MLOutput> {
  const paired = Boolean(input.mentorPaired);
  const started = Boolean(input.guidedRunStarted);

  const score = clamp((paired ? 0.55 : 0.18) + (started ? 0.30 : 0.0), 0.01, 0.99);

  const topFactors: string[] = [
    paired ? 'Mentor paired' : 'Mentor not paired',
    started ? 'Guided run started' : 'Guided run not started',
    `Tick=${input.tick}`,
  ].slice(0, 5);

  const recommendation =
    paired
      ? 'Track the guided run outcome and upgrade mentor routing using reliability and coaching signals.'
      : 'Increase mentor pool capacity or relax constraints to enable pairing.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M66'),
    confidenceDecay: clamp(0.05 + (1 - score) * 0.12, 0.05, 0.22),
  };
}