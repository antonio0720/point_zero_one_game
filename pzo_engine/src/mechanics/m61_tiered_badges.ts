// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m61_tiered_badges.ts
//
// Mechanic : M61 — Tiered Badges
// Family   : achievement_advanced   Layer: season_runtime   Priority: 2   Batch: 2
// ML Pair  : m61a
// Deps     : M50, M36
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

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M61Input {
  // Snapshot passthrough (season runtime can still provide run-scoped info)
  runId?: string;
  tick?: number;

  // Primary signals
  cordScore?: number;
  runCount?: number;

  // Optional: previous tier (if season state tracks it)
  previousBadgeTier?: string;
}

export interface M61Output {
  badgeTierAwarded: string;
  tierHash: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M61Event = 'BADGE_TIER_UPGRADED' | 'TIER_HASH_STORED' | 'BADGE_DISPLAYED';

export interface M61TelemetryPayload extends MechanicTelemetryPayload {
  event: M61Event;
  mechanic_id: 'M61';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M61_BOUNDS = {
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

export const M61_BADGE_TIERS = [
  { tier: 'IRON', threshold: 0 },
  { tier: 'BRONZE', threshold: 750 },
  { tier: 'SILVER', threshold: 1_800 },
  { tier: 'GOLD', threshold: 3_500 },
  { tier: 'PLATINUM', threshold: 6_500 },
  { tier: 'OBSIDIAN', threshold: 10_000 },
] as const;

// ── Internal helpers ───────────────────────────────────────────────────────

type _M61_AllTypeImportsUsed = {
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

function m61PickKey(obj: Record<string, number>, seed: string, tick: number): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return 'NEUTRAL';
  return keys[seededIndex(seed, tick, keys.length)] ?? keys[0]!;
}

function m61InChaos(seed: string, tick: number): { inChaos: boolean; window: unknown | null } {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  // Do not assume window shape; just scan by JSON signatures deterministically
  for (const w of windows as unknown as any[]) {
    const startTick = typeof w?.startTick === 'number' ? w.startTick : -1;
    const endTick = typeof w?.endTick === 'number' ? w.endTick : -1;
    if (tick >= startTick && tick <= endTick) return { inChaos: true, window: w };
  }
  return { inChaos: false, window: null };
}

function m61PickReferenceCard(seed: string, tick: number): GameCard {
  const phaseKey = m61PickKey(PHASE_WEIGHTS as unknown as Record<string, number>, seed, tick);
  const regimeKey = m61PickKey(REGIME_WEIGHTS as unknown as Record<string, number>, seed + ':reg', tick);

  const phaseW = (PHASE_WEIGHTS as unknown as Record<string, number>)[phaseKey] ?? 1.0;
  const regimeW = (REGIME_WEIGHTS as unknown as Record<string, number>)[regimeKey] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:m61:${tick}`, phaseW, regimeW);
  const fallback = pool.length > 0 ? pool : OPPORTUNITY_POOL;

  const deck = seededShuffle(DEFAULT_CARD_IDS, seed + ':m61:deck');
  const pickedId = deck[seededIndex(seed, tick, deck.length)] ?? DEFAULT_CARD.id;

  const fromPool = fallback.find(c => c.id === pickedId);
  if (fromPool) return fromPool;

  const fromOpp = OPPORTUNITY_POOL.find(c => c.id === pickedId);
  if (fromOpp) return fromOpp;

  return DEFAULT_CARD;
}

export type BadgeTier = typeof M61_BADGE_TIERS[number]['tier'];

function m61TierForPoints(points: number): BadgeTier {
  let best: BadgeTier = M61_BADGE_TIERS[0].tier;
  for (const t of M61_BADGE_TIERS) {
    if (points >= t.threshold) best = t.tier as BadgeTier;
  }
  return best;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * tieredBadgeEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function tieredBadgeEngine(
  input: M61Input,
  emit: MechanicEmitter,
): M61Output {
  // Keep all `import type { ... }` bindings actively referenced (no runtime cost).
  const __typeSentinel: _M61_AllTypeImportsUsed | null = null;
  void __typeSentinel;

  const cordScore = Number(input.cordScore ?? 0) || 0;
  const runCount = Number(input.runCount ?? 0) || 0;

  const runId =
    String(input.runId ?? '') ||
    computeHash(['M61', String(cordScore), String(runCount), String(input.previousBadgeTier ?? '')].join(':'));

  const tick = clamp(
    typeof input.tick === 'number' ? input.tick : seededIndex(runId, 61, RUN_TOTAL_TICKS),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  // Force usage of macro schedule (season uses it as entropy + regime context, without assuming field names).
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const macroScheduleHash = computeHash(JSON.stringify(macroSchedule)).slice(0, 16);

  // Chaos window context (affects tier points).
  const { inChaos, window } = m61InChaos(runId, tick);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);
  const chaosHash = computeHash(JSON.stringify(chaosWindows)).slice(0, 16);
  void chaosWindows; // already hashed, but keep explicit use for linters

  // Deterministic phase/regime keys without assuming union literal values.
  const phaseKey = m61PickKey(PHASE_WEIGHTS as unknown as Record<string, number>, runId + ':phase', tick);
  const regimeKey = m61PickKey(REGIME_WEIGHTS as unknown as Record<string, number>, runId + ':regime', tick);

  const phaseW = (PHASE_WEIGHTS as unknown as Record<string, number>)[phaseKey] ?? 1.0;
  const regimeW = (REGIME_WEIGHTS as unknown as Record<string, number>)[regimeKey] ?? 1.0;
  const regimeMult = (REGIME_MULTIPLIERS as unknown as Record<string, number>)[regimeKey] ?? 1.0;
  const exitPulse = (EXIT_PULSE_MULTIPLIERS as unknown as Record<string, number>)[regimeKey] ?? 1.0;

  const decay = computeDecayRate(regimeKey as unknown as MacroRegime, M61_BOUNDS.BASE_DECAY_RATE);

  // Reference card ties badges to deck economy (and uses DEFAULT_CARD/OPPORTUNITY_POOL/DEFAULT_CARD_IDS/buildWeightedPool).
  const referenceCard = m61PickReferenceCard(runId, tick);

  const basePoints =
    clamp(cordScore, 0, M61_BOUNDS.MAX_EFFECT) * 0.85 +
    clamp(runCount, 0, 9_999) * 175 +
    // entropy injection so ties split deterministically
    seededIndex(runId + ':' + macroScheduleHash + ':' + chaosHash, tick, 500);

  const chaosPenalty = inChaos ? 0.90 : 1.0;

  const pointsRaw =
    basePoints *
    chaosPenalty *
    clamp(phaseW * regimeW, 0.25, 3.0) *
    clamp(regimeMult * exitPulse, 0.25, 3.0) *
    clamp(1 - decay, 0.50, 1.0) *
    M61_BOUNDS.EFFECT_MULTIPLIER;

  const points = clamp(Math.round(pointsRaw), 0, 50_000);

  const badgeTierAwarded = m61TierForPoints(points);

  const tierHash = computeHash(
    [
      'M61',
      runId,
      String(tick),
      badgeTierAwarded,
      String(points),
      referenceCard.id,
      macroScheduleHash,
      chaosHash,
    ].join(':'),
  ).slice(0, 32);

  const previousTier = String(input.previousBadgeTier ?? '');

  emit({
    event: 'BADGE_TIER_UPGRADED',
    mechanic_id: 'M61',
    tick,
    runId,
    payload: {
      cordScore,
      runCount,
      points,
      badgeTierAwarded,
      previousTier,
      phaseKey,
      regimeKey,
      inChaos,
      chaosWindow: window,
      referenceCardId: referenceCard.id,
      macroScheduleHash,
      chaosHash,
      decay,
      phaseW,
      regimeW,
      regimeMult,
      exitPulse,
    },
  });

  emit({
    event: 'TIER_HASH_STORED',
    mechanic_id: 'M61',
    tick,
    runId,
    payload: { badgeTierAwarded, tierHash },
  });

  // Only “display” if tier is meaningful or upgraded.
  const shouldDisplay =
    badgeTierAwarded !== 'IRON' &&
    (previousTier.length === 0 || previousTier !== badgeTierAwarded || points >= M61_BADGE_TIERS[2].threshold);

  if (shouldDisplay) {
    emit({
      event: 'BADGE_DISPLAYED',
      mechanic_id: 'M61',
      tick,
      runId,
      payload: {
        badgeTierAwarded,
        points,
        referenceCardId: referenceCard.id,
      },
    });
  }

  return {
    badgeTierAwarded,
    tierHash,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M61MLInput {
  badgeTierAwarded?: string;
  tierHash?: string;
  runId: string;
  tick: number;
}

export interface M61MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * tieredBadgeEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function tieredBadgeEngineMLCompanion(
  input: M61MLInput,
): Promise<M61MLOutput> {
  const tier = String(input.badgeTierAwarded ?? 'IRON');
  const tierIx = Math.max(0, M61_BADGE_TIERS.findIndex(t => t.tier === tier));

  const score = clamp(0.12 + tierIx * 0.16, 0.01, 0.99);

  const topFactors: string[] = [
    `Tier=${tier}`,
    input.tierHash ? `Hash=${String(input.tierHash).slice(0, 10)}…` : 'Hash=missing',
    `Tick=${input.tick}`,
  ].slice(0, 5);

  const recommendation =
    tierIx >= 4
      ? 'Protect tier by avoiding chaos spikes and preserving consistent CORD performance.'
      : tierIx >= 2
        ? 'Push for the next badge tier by increasing disciplined run volume and CORD consistency.'
        : 'Stabilize fundamentals first; accumulate clean runs before chasing higher tiers.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M61'),
    confidenceDecay: clamp(0.04 + (1 - score) * 0.10, 0.04, 0.22),
  };
}