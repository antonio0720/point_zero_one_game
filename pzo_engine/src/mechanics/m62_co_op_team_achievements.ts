// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m62_co_op_team_achievements.ts
//
// Mechanic : M62 — Co-op Team Achievements
// Family   : achievement_advanced   Layer: season_runtime   Priority: 2   Batch: 2
// ML Pair  : m62a
// Deps     : M26, M36
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

// ── Local M62 domain types (kept local to avoid circular deps across mechanics) ──

export type TeamBadgeTier = 'IRON' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'OBSIDIAN';

export interface TeamBadge {
  id: string;              // stable deterministic id (seed-derived)
  contractId: string;      // co-op contract binding id
  tier: TeamBadgeTier;     // cosmetic/season tier
  score: number;           // 0..100000 bounded scalar
  title: string;           // UI-ready label
  issuedAtTick: number;    // season tick when awarded
  regime: MacroRegime;     // regime context used in derivation
  phase: RunPhase;         // phase context used in derivation
  inChaos: boolean;        // chaos window context used in derivation
  referenceCardId: string; // deck anchor (deterministic + verifiable)
  proofHash: string;       // shared proof hash (server-verifiable)
}

export interface CoopRunResult {
  // Minimal, JSON-safe shape (no runtime assumptions about extra fields)
  runIds?: string[];
  memberIds?: string[];
  cordScoreAvg?: number;       // 0..1 typical
  trustScore?: number;         // 0..1 typical
  defectionAvoided?: boolean;
  fullSynergyAchieved?: boolean;
  outcome?: string;            // FREEDOM/TIMEOUT/etc (string to avoid imports)
  meta?: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M62Input {
  // Optional snapshot passthrough (router may supply these on season-runtime layer)
  runId?: string;
  tick?: number;

  coopRunResult?: CoopRunResult;
  contractId?: string;
}

export interface M62Output {
  teamBadge: TeamBadge;
  sharedProofHash: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M62Event = 'TEAM_BADGE_ISSUED' | 'SHARED_PROOF_STORED' | 'TEAM_ACHIEVEMENT_UNLOCKED';

export interface M62TelemetryPayload extends MechanicTelemetryPayload {
  event: M62Event;
  mechanic_id: 'M62';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M62_BOUNDS = {
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

type _M62_AllTypeImportsUsed = {
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

function m62LongHash(input: string): string {
  const h1 = computeHash(input);
  const h2 = computeHash(h1 + ':' + input);
  const h3 = computeHash(h2 + ':' + h1);
  const h4 = computeHash(h3 + ':' + input + ':' + h2);
  return (h1 + h2 + h3 + h4).slice(0, 32);
}

function m62DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.33)) return 'EARLY';
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.66)) return 'MID';
  return 'LATE';
}

function m62ResolveRegime(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN).slice().sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of schedule) {
    if (ev.tick <= tick && ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m62ChaosContext(seed: string, tick: number): { inChaos: boolean; window: ChaosWindow | null } {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return { inChaos: true, window: w };
  }
  return { inChaos: false, window: null };
}

function m62PressureTierFromCoop(coop: CoopRunResult, inChaos: boolean): PressureTier {
  const members = Array.isArray(coop.memberIds) ? coop.memberIds.length : 0;
  const trust = clamp(Number(coop.trustScore ?? 0), 0, 1);
  const cord = clamp(Number(coop.cordScoreAvg ?? 0), 0, 1);
  const synergy = coop.fullSynergyAchieved ? 1 : 0;
  const defectionPenalty = coop.defectionAvoided === false ? 1 : 0;

  // Higher = more pressure (harder), used only as a deterministic weight driver.
  const pressureIndex =
    (members >= 4 ? 0.25 : members >= 2 ? 0.15 : 0.05) +
    (inChaos ? 0.20 : 0.0) +
    (1 - trust) * 0.25 +
    (1 - cord) * 0.20 +
    defectionPenalty * 0.15 -
    synergy * 0.10;

  if (pressureIndex <= 0.20) return 'LOW';
  if (pressureIndex <= 0.45) return 'MEDIUM';
  if (pressureIndex <= 0.70) return 'HIGH';
  return 'CRITICAL';
}

function m62PickReferenceCard(seed: string, tick: number, phase: RunPhase, regime: MacroRegime, pressure: PressureTier): GameCard {
  const pW = (PRESSURE_WEIGHTS[pressure] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const rW = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:m62:${tick}`, pW, rW);
  const effectivePool = pool.length > 0 ? pool : OPPORTUNITY_POOL;

  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m62:deck`);
  const pickedId = deck[seededIndex(seed, tick, deck.length)] ?? DEFAULT_CARD.id;

  const fromPool = effectivePool.find(c => c.id === pickedId);
  if (fromPool) return fromPool;

  const fromOpp = OPPORTUNITY_POOL.find(c => c.id === pickedId);
  if (fromOpp) return fromOpp;

  return DEFAULT_CARD;
}

function m62TierForScore(score: number): TeamBadgeTier {
  if (score >= 85_000) return 'OBSIDIAN';
  if (score >= 70_000) return 'PLATINUM';
  if (score >= 50_000) return 'GOLD';
  if (score >= 30_000) return 'SILVER';
  if (score >= 15_000) return 'BRONZE';
  return 'IRON';
}

function m62TitleForTier(tier: TeamBadgeTier): string {
  switch (tier) {
    case 'OBSIDIAN': return 'COVENANT: OBSIDIAN';
    case 'PLATINUM': return 'COVENANT: PLATINUM';
    case 'GOLD': return 'COVENANT: GOLD';
    case 'SILVER': return 'COVENANT: SILVER';
    case 'BRONZE': return 'COVENANT: BRONZE';
    default: return 'COVENANT: IRON';
  }
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * coopTeamAchievementEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function coopTeamAchievementEngine(
  input: M62Input,
  emit: MechanicEmitter,
): M62Output {
  // Keep every `import type { ... }` symbol "used" (compile-time only, zero runtime cost).
  const __typeSentinel: _M62_AllTypeImportsUsed | null = null;
  void __typeSentinel;

  const coopRunResult: CoopRunResult = (input.coopRunResult ?? {}) as CoopRunResult;
  const contractId = String(input.contractId ?? '');

  const runId =
    String(input.runId ?? '') ||
    m62LongHash(
      [
        'M62',
        contractId,
        JSON.stringify({
          runIds: coopRunResult.runIds ?? [],
          memberIds: coopRunResult.memberIds ?? [],
          cordScoreAvg: coopRunResult.cordScoreAvg ?? 0,
          trustScore: coopRunResult.trustScore ?? 0,
          defectionAvoided: coopRunResult.defectionAvoided ?? null,
          fullSynergyAchieved: coopRunResult.fullSynergyAchieved ?? null,
          outcome: coopRunResult.outcome ?? '',
          meta: coopRunResult.meta ?? {},
        }),
      ].join(':'),
    );

  const tick = clamp(
    typeof input.tick === 'number' ? input.tick : seededIndex(runId, 62, RUN_TOTAL_TICKS),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  const phase = m62DerivePhase(tick);
  const regime = m62ResolveRegime(runId, tick);
  const { inChaos, window } = m62ChaosContext(runId, tick);

  const pressureTier = m62PressureTierFromCoop(coopRunResult, inChaos);

  // Deterministic anchors (ensures ALL requested imports are actually used).
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M62_BOUNDS.BASE_DECAY_RATE);

  const referenceCard = m62PickReferenceCard(runId, tick, phase, regime, pressureTier);

  // Additional deterministic entropy + proof binding to macro/chaos timelines.
  const macroSchedule = buildMacroSchedule(runId, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId, CHAOS_WINDOWS_PER_RUN);
  const macroHash = m62LongHash(JSON.stringify(macroSchedule));
  const chaosHash = m62LongHash(JSON.stringify(chaosWindows));

  // Seeded shuffle usage (team identity stable per contract+season).
  const members = Array.isArray(coopRunResult.memberIds) ? coopRunResult.memberIds.filter(Boolean) : [];
  const shuffledMembers = seededShuffle(members, `${runId}:m62:members`);
  const memberCount = shuffledMembers.length;

  // Score construction: bounded, deterministic, verifiable.
  const trust = clamp(Number(coopRunResult.trustScore ?? 0), 0, 1);
  const cord = clamp(Number(coopRunResult.cordScoreAvg ?? 0), 0, 1);
  const synergy = coopRunResult.fullSynergyAchieved ? 1 : 0;
  const defectionAvoided = coopRunResult.defectionAvoided !== false ? 1 : 0;

  const cardCost = Number(referenceCard.cost ?? 0) || 0;
  const cardDown = Number(referenceCard.downPayment ?? 0) || 0;

  const baseScore =
    // team cohesion & quality
    (trust * 25_000) +
    (cord * 30_000) +
    (synergy * 12_500) +
    (defectionAvoided * 7_500) +
    // team size bonus (bounded)
    clamp(memberCount, 0, 8) * 1_250 +
    // economic anchor (bounded)
    clamp(Math.round((cardCost + cardDown) * 0.35), 0, 15_000) +
    // deterministic tiebreaker (bounded)
    seededIndex(`${runId}:${macroHash}:${chaosHash}:${contractId}`, tick, 7_500);

  const chaosPenalty = inChaos ? 0.92 : 1.0;

  const scoreRaw =
    baseScore *
    chaosPenalty *
    clamp(pressurePhaseWeight * regimeWeight, 0.35, 3.25) *
    clamp(regimeMult * exitPulse, 0.35, 3.25) *
    clamp(1 - decay, 0.50, 1.0) *
    M62_BOUNDS.EFFECT_MULTIPLIER *
    M62_BOUNDS.MULTIPLIER;

  const score = clamp(Math.round(scoreRaw), M62_BOUNDS.MIN_EFFECT, M62_BOUNDS.MAX_EFFECT);

  const tier = m62TierForScore(score);
  const title = m62TitleForTier(tier);

  const sharedProofHash = m62LongHash(
    [
      'M62',
      runId,
      String(tick),
      contractId,
      tier,
      String(score),
      referenceCard.id,
      macroHash,
      chaosHash,
      JSON.stringify({
        memberCount,
        firstMember: shuffledMembers[0] ?? '',
        trust,
        cord,
        synergy,
        defectionAvoided,
        inChaos,
        chaosWindow: window ?? null,
      }),
    ].join(':'),
  );

  const badgeId = m62LongHash(['M62:badge', contractId, tier, referenceCard.id, macroHash, chaosHash].join(':'));

  const teamBadge: TeamBadge = {
    id: badgeId,
    contractId,
    tier,
    score,
    title,
    issuedAtTick: tick,
    regime,
    phase,
    inChaos,
    referenceCardId: referenceCard.id,
    proofHash: sharedProofHash,
  };

  emit({
    event: 'TEAM_BADGE_ISSUED',
    mechanic_id: 'M62',
    tick,
    runId,
    payload: {
      contractId,
      badgeId,
      tier,
      score,
      title,
      regime,
      phase,
      pressureTier,
      inChaos,
      chaosWindow: window,
      referenceCardId: referenceCard.id,
      memberCount,
      membersPreview: shuffledMembers.slice(0, 4),
      trust,
      cord,
      synergy,
      defectionAvoided,
      macroHash,
      chaosHash,
      decay,
      pressurePhaseWeight,
      regimeWeight,
      regimeMult,
      exitPulse,
    },
  });

  emit({
    event: 'SHARED_PROOF_STORED',
    mechanic_id: 'M62',
    tick,
    runId,
    payload: {
      contractId,
      sharedProofHash,
      badgeId,
      tier,
      referenceCardId: referenceCard.id,
    },
  });

  const unlocked =
    tier === 'SILVER' || tier === 'GOLD' || tier === 'PLATINUM' || tier === 'OBSIDIAN';

  if (unlocked) {
    emit({
      event: 'TEAM_ACHIEVEMENT_UNLOCKED',
      mechanic_id: 'M62',
      tick,
      runId,
      payload: {
        contractId,
        badgeId,
        tier,
        score,
        title,
        sharedProofHash,
      },
    });
  }

  return {
    teamBadge,
    sharedProofHash,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M62MLInput {
  teamBadge?: TeamBadge;
  sharedProofHash?: string;
  runId: string;
  tick: number;
}

export interface M62MLOutput {
  score: number;            // 0–1
  topFactors: string[];     // max 5 plain-English factors
  recommendation: string;   // single sentence
  auditHash: string;        // SHA256(inputs+outputs+rulesVersion) (djb2 surrogate here)
  confidenceDecay: number;  // 0–1, how fast this signal should decay
}

/**
 * coopTeamAchievementEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function coopTeamAchievementEngineMLCompanion(
  input: M62MLInput,
): Promise<M62MLOutput> {
  const badge = input.teamBadge;
  const tier = String(badge?.tier ?? 'IRON');

  const tierScore =
    tier === 'OBSIDIAN' ? 0.95 :
    tier === 'PLATINUM' ? 0.85 :
    tier === 'GOLD' ? 0.70 :
    tier === 'SILVER' ? 0.55 :
    tier === 'BRONZE' ? 0.35 : 0.15;

  const score = clamp(tierScore, 0.01, 0.99);

  const topFactors: string[] = [
    `Tier=${tier}`,
    badge ? `TeamScore=${Math.round(badge.score)}` : 'TeamScore=missing',
    badge ? `Regime=${badge.regime}` : 'Regime=missing',
    `Tick=${input.tick}`,
    input.sharedProofHash ? `Proof=${String(input.sharedProofHash).slice(0, 10)}…` : 'Proof=missing',
  ].slice(0, 5);

  const recommendation =
    tier === 'OBSIDIAN' || tier === 'PLATINUM'
      ? 'Preserve trust and synergy; avoid chaos windows and protect the contract proof chain.'
      : tier === 'GOLD' || tier === 'SILVER'
        ? 'Push for full synergy and maintain trust discipline to upgrade the team badge tier.'
        : 'Stabilize cooperation: avoid defection triggers and increase trust score before chasing higher tiers.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: m62LongHash(JSON.stringify(input) + ':ml:M62'),
    confidenceDecay: clamp(0.04 + (1 - score) * 0.10, 0.04, 0.22),
  };
}