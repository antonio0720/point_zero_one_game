// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m90_salvage_and_reroll_recycling_achievements_into_challenges.ts
//
// Mechanic : M90 — Salvage and Reroll: Recycling Achievements into Challenges
// Family   : achievement_expert   Layer: season_runtime   Priority: 3   Batch: 2
// ML Pair  : m90a
// Deps     : M36, M40
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

// ── Import Anchors (keeps every symbol “accessible” + TS-used) ──────────────────

export const M90_IMPORTED_SYMBOLS = {
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

export type M90_ImportedTypesAnchor = {
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

// ── Local domain (M90-specific) ──────────────────────────────────────────────

export type ChallengeDifficulty = 'TRIVIAL' | 'STANDARD' | 'HARD' | 'ELITE';

export interface ChallengeRef {
  /** Stable challenge id (deterministic) */
  id: string;

  /** Challenge display title (cosmetic; deterministic) */
  title: string;

  /** Difficulty tier (deterministic) */
  difficulty: ChallengeDifficulty;

  /** Source achievement id that got salvaged */
  sourceAchievementId: string;

  /** Salvage credit issued for this salvage (for audit) */
  salvageCredit: number;

  /** Challenge expires at this tick (deterministic) */
  expiresAtTick: number;

  /** Cosmetic theme tag derived from GameCard pool (no gameplay power) */
  themeCardId: string;

  /** Deterministic audit core */
  audit: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M90Input {
  achievementId?: string;
  salvageValue?: number;
  rerollPool?: unknown[];

  /**
   * Optional snapshot sources (router may spread additional fields).
   * If present, improves determinism across client/server.
   */
  seasonId?: string;
  seasonState?: SeasonState;
  stateTick?: number;
  runId?: string;
}

export interface M90Output {
  salvageCredit: number;
  newChallenge: ChallengeRef;
  rerollResult: Record<string, unknown>;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M90Event = 'ACHIEVEMENT_SALVAGED' | 'REROLL_EXECUTED' | 'NEW_CHALLENGE_ISSUED';

export interface M90TelemetryPayload extends MechanicTelemetryPayload {
  event: M90Event;
  mechanic_id: 'M90';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M90_BOUNDS = {
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

  // M90-specific hardening:
  MIN_SALVAGE: 0,
  MAX_SALVAGE: 250_000,
  MAX_CREDIT: 250_000,
  CHALLENGE_TTL_TICKS: 24,
  MIN_POOL_SIZE_FOR_REROLL: 1,
} as const;

// ── Internal helpers (pure) ────────────────────────────────────────────────

function m90ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

/**
 * Normalize regimes to the canonical union in ./types.
 * If upstream data ever includes non-canonical regimes (e.g. "RECESSION"),
 * we deterministically map them into the closest canonical bucket.
 */
function m90NormalizeRegime(r: unknown): MacroRegime {
  switch (r) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return r;
    // Deterministic mapping for any non-canonical downturn labels:
    // treat them as BEAR (not CRISIS) unless explicitly CRISIS.
    default:
      return 'NEUTRAL';
  }
}

function m90PhaseFromTick(tick: number): RunPhase {
  const t = m90ClampTick(tick);
  const third = RUN_TOTAL_TICKS / 3;
  return t < third ? 'EARLY' : t < third * 2 ? 'MID' : 'LATE';
}

function m90RegimeFromSchedule(tick: number, macro: MacroEvent[]): MacroRegime {
  if (!macro || macro.length === 0) return 'NEUTRAL';
  const sorted = [...macro].sort((a, b) => a.tick - b.tick);
  let r: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = m90NormalizeRegime(ev.regimeChange as unknown);
  }
  return r;
}

function m90ChaosHit(tick: number, chaos: ChaosWindow[]): ChaosWindow | null {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return w;
  }
  return null;
}

function m90PressureFrom(phase: RunPhase, chaosHit: ChaosWindow | null): PressureTier {
  if (chaosHit) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m90TickTierFrom(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m90Hash16(core: string): string {
  // computeHash() returns 8 hex chars; concatenate twice for stable 16-char ids.
  return computeHash(core + ':a') + computeHash(core + ':b');
}

function m90StableTick(input: M90Input): number {
  const fromSeason = (input.seasonState as unknown as { tick?: number } | undefined)?.tick;
  const fromInput = (input as unknown as { tick?: number } | undefined)?.tick;
  const raw =
    (typeof input.stateTick === 'number' ? input.stateTick : undefined) ??
    (typeof fromSeason === 'number' ? fromSeason : undefined) ??
    (typeof fromInput === 'number' ? fromInput : undefined) ??
    0;

  return m90ClampTick(raw);
}

function m90StableRunId(input: M90Input, seasonId: string, achievementId: string, tick: number): string {
  const explicit = String(input.runId ?? '').trim();
  if (explicit.length > 0) return explicit;
  return computeHash(`M90:run:${seasonId}:${achievementId}:${tick}:${JSON.stringify(input.rerollPool ?? [])}`);
}

type M90Ctx = {
  seasonId: string;
  runId: string;
  tick: number;
  seed: string;

  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tier: TickTier;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  chaosHit: ChaosWindow | null;

  decayRate: number;
  regimeMultiplier: number;
  exitPulse: number;

  phaseWeight: number;
  regimeWeight: number;
  pressureWeight: number;

  themeCard: GameCard;
  deckSig: string[];
};

function m90BuildCtx(seasonId: string, runId: string, achievementId: string, tick: number): M90Ctx {
  const t = m90ClampTick(tick);
  const seed = computeHash(`M90:${seasonId}:${runId}:${achievementId}:${t}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m90PhaseFromTick(t);
  const regime = m90RegimeFromSchedule(t, macroSchedule);
  const chaosHit = m90ChaosHit(t, chaosWindows);

  const pressure = m90PressureFrom(phase, chaosHit);
  const tier = m90TickTierFrom(pressure);

  // ✅ regime is guaranteed canonical MacroRegime here
  const decayRate = computeDecayRate(regime, M90_BOUNDS.BASE_DECAY_RATE);
  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  // Cosmetic theme: derived from weighted pool + fallback to opportunity pool + default card.
  const w = buildWeightedPool(`${seed}:themePool`, pressureWeight * phaseWeight, regimeWeight);
  const themeCard =
    w[seededIndex(seed, t + 90, w.length)] ??
    OPPORTUNITY_POOL[seededIndex(seed, t + 1090, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  // Deterministic deck signature for audits.
  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  return {
    seasonId,
    runId,
    tick: t,
    seed,
    phase,
    regime,
    pressure,
    tier,
    macroSchedule,
    chaosWindows,
    chaosHit,
    decayRate,
    regimeMultiplier,
    exitPulse,
    phaseWeight,
    regimeWeight,
    pressureWeight,
    themeCard,
    deckSig,
  };
}

function m90CoercePool(rerollPool: unknown[] | undefined): unknown[] {
  const p = Array.isArray(rerollPool) ? rerollPool : [];
  if (p.length >= M90_BOUNDS.MIN_POOL_SIZE_FOR_REROLL) return p;

  // Fallback pool is deterministic + audit-friendly: DEFAULT_CARD_IDS.
  return DEFAULT_CARD_IDS.slice(0, Math.min(12, DEFAULT_CARD_IDS.length));
}

function m90StringifyPoolItem(x: unknown): string {
  if (x == null) return 'null';
  if (typeof x === 'string') return x;
  if (typeof x === 'number' || typeof x === 'boolean') return String(x);
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function m90PickDifficulty(ctx: M90Ctx, salvageValue: number): ChallengeDifficulty {
  const s = clamp(salvageValue, 0, M90_BOUNDS.MAX_SALVAGE);

  const pressureBoost = ctx.pressure === 'CRITICAL' ? 2 : ctx.pressure === 'HIGH' ? 1 : 0;
  // ✅ Canonical regimes only (no "RECESSION" anywhere):
  const macroBoost = ctx.regime === 'CRISIS' ? 2 : ctx.regime === 'BEAR' ? 1 : 0;

  const score = s / 50_000 + pressureBoost * 0.5 + macroBoost * 0.5 + (ctx.phase === 'LATE' ? 0.4 : 0);

  if (score >= 3.0) return 'ELITE';
  if (score >= 2.0) return 'HARD';
  if (score >= 1.0) return 'STANDARD';
  return 'TRIVIAL';
}

function m90ComputeSalvageCredit(ctx: M90Ctx, salvageValueRaw: number): number {
  const salvageValue = clamp(salvageValueRaw, M90_BOUNDS.MIN_SALVAGE, M90_BOUNDS.MAX_SALVAGE);

  // Salvage credit is a seasonal cosmetic currency / challenge credit:
  // - grows with salvageValue
  // - slightly boosted in “growth” macro
  // - slightly tightened in crisis + chaos
  // - decays under unstable regimes
  const base = salvageValue * (M90_BOUNDS.MULTIPLIER * 0.75);

  const macro = clamp(ctx.regimeWeight * ctx.regimeMultiplier * ctx.exitPulse, 0.25, 2.25);
  const tempo = clamp(ctx.phaseWeight * ctx.pressureWeight, 0.50, 2.50);

  const chaosPenalty = ctx.chaosHit ? 0.82 : 1.0;
  const crisisPenalty = ctx.regime === 'CRISIS' ? 0.88 : 1.0;

  const stability = clamp(1 - ctx.decayRate, 0.25, 1.0);

  const raw = base * macro * tempo * chaosPenalty * crisisPenalty * stability;

  return Math.round(clamp(raw, 0, M90_BOUNDS.MAX_CREDIT));
}

function m90BuildChallengeRef(
  ctx: M90Ctx,
  achievementId: string,
  salvageCredit: number,
  difficulty: ChallengeDifficulty,
  rerollPickLabel: string,
): ChallengeRef {
  const expiresAtTick = m90ClampTick(ctx.tick + M90_BOUNDS.CHALLENGE_TTL_TICKS);

  const themeCardId = DEFAULT_CARD_IDS.includes(ctx.themeCard.id) ? ctx.themeCard.id : DEFAULT_CARD.id;

  const titleCore = `${difficulty} · ${rerollPickLabel}`.trim();
  const title = titleCore.length > 0 ? titleCore : `${difficulty} · Challenge`;

  const idCore = JSON.stringify({
    mid: 'M90',
    seasonId: ctx.seasonId,
    runId: ctx.runId,
    tick: ctx.tick,
    achievementId,
    difficulty,
    themeCardId,
    deckSig: ctx.deckSig,
    salvageCredit,
    rerollPickLabel,
  });

  const id = `challenge:${ctx.seasonId}:${m90Hash16(idCore)}`;

  const audit = computeHash(
    JSON.stringify({
      id,
      seasonId: ctx.seasonId,
      runId: ctx.runId,
      tick: ctx.tick,
      phase: ctx.phase,
      regime: ctx.regime,
      pressure: ctx.pressure,
      tier: ctx.tier,
      themeCardId,
      salvageCredit,
      expiresAtTick,
      deckSig: ctx.deckSig,
    }),
  );

  return {
    id,
    title,
    difficulty,
    sourceAchievementId: achievementId,
    salvageCredit,
    expiresAtTick,
    themeCardId,
    audit,
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * salvageAndRerollExecutor
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function salvageAndRerollExecutor(input: M90Input, emit: MechanicEmitter): M90Output {
  const achievementId = String(input.achievementId ?? '').trim();
  const salvageValue = clamp((input.salvageValue as number) ?? 0, M90_BOUNDS.MIN_SALVAGE, M90_BOUNDS.MAX_SALVAGE);

  const seasonId = String(input.seasonId ?? (input.seasonState as unknown as { seasonId?: string } | undefined)?.seasonId ?? '').trim();
  const tick = m90StableTick(input);

  const runId = m90StableRunId(input, seasonId, achievementId, tick);
  const ctx = m90BuildCtx(seasonId, runId, achievementId, tick);

  const pool = m90CoercePool(input.rerollPool as unknown[] | undefined);

  emit({
    event: 'ACHIEVEMENT_SALVAGED',
    mechanic_id: 'M90',
    tick: ctx.tick,
    runId: ctx.runId,
    payload: {
      seasonId: ctx.seasonId,
      achievementId,
      salvageValue,
      phase: ctx.phase,
      regime: ctx.regime,
      pressure: ctx.pressure,
      tickTier: ctx.tier,
      decayRate: Number(ctx.decayRate.toFixed(4)),
      pulse: Number(ctx.exitPulse.toFixed(4)),
      mult: Number(ctx.regimeMultiplier.toFixed(4)),
      deckSig: ctx.deckSig,
      audit: computeHash(JSON.stringify({ seasonId: ctx.seasonId, runId: ctx.runId, tick: ctx.tick, achievementId, salvageValue })),
    },
  });

  const salvageCredit = m90ComputeSalvageCredit(ctx, salvageValue);

  // Deterministic reroll choice from pool:
  const pickIndex = seededIndex(ctx.seed, ctx.tick + 90, pool.length);
  const pick = pool[pickIndex];

  // Additional deterministic shuffle tag (uses seededShuffle again materially).
  const poolFingerprint = seededShuffle(
    pool.map(m90StringifyPoolItem),
    `${ctx.seed}:poolShuffle:${ctx.tick}`,
  );

  const pickLabel = m90StringifyPoolItem(pick);

  const rerollAuditCore = JSON.stringify({
    seasonId: ctx.seasonId,
    runId: ctx.runId,
    tick: ctx.tick,
    poolSize: pool.length,
    pickIndex,
    pickLabel,
    poolHead: poolFingerprint.slice(0, 5),
    themeCardId: ctx.themeCard.id,
  });

  emit({
    event: 'REROLL_EXECUTED',
    mechanic_id: 'M90',
    tick: ctx.tick,
    runId: ctx.runId,
    payload: {
      seasonId: ctx.seasonId,
      achievementId,
      salvageCredit,
      poolSize: pool.length,
      pickIndex,
      pickLabel,
      poolHead: poolFingerprint.slice(0, 5),
      themeCard: { id: ctx.themeCard.id, name: ctx.themeCard.name },
      audit: computeHash(rerollAuditCore),
    },
  });

  const difficulty = m90PickDifficulty(ctx, salvageValue);
  const newChallenge = m90BuildChallengeRef(ctx, achievementId, salvageCredit, difficulty, pickLabel);

  emit({
    event: 'NEW_CHALLENGE_ISSUED',
    mechanic_id: 'M90',
    tick: ctx.tick,
    runId: ctx.runId,
    payload: {
      seasonId: ctx.seasonId,
      achievementId,
      salvageCredit,
      challenge: {
        id: newChallenge.id,
        title: newChallenge.title,
        difficulty: newChallenge.difficulty,
        expiresAtTick: newChallenge.expiresAtTick,
        themeCardId: newChallenge.themeCardId,
      },
      audit: newChallenge.audit,
    },
  });

  const rerollResult: Record<string, unknown> = {
    seasonId: ctx.seasonId,
    runId: ctx.runId,
    tick: ctx.tick,
    pickIndex,
    pickLabel,
    poolSize: pool.length,
    poolHead: poolFingerprint.slice(0, 8),
    phase: ctx.phase,
    regime: ctx.regime,
    pressure: ctx.pressure,
    tickTier: ctx.tier,
    decayRate: ctx.decayRate,
    themeCardId: ctx.themeCard.id,
    themeCardName: ctx.themeCard.name,
    deckSig: ctx.deckSig,
    audit: computeHash(rerollAuditCore),
  };

  return {
    salvageCredit,
    newChallenge,
    rerollResult,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M90MLInput {
  salvageCredit?: number;
  newChallenge?: ChallengeRef;
  rerollResult?: Record<string, unknown>;
  runId: string;
  tick: number;
}

export interface M90MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * salvageAndRerollExecutorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function salvageAndRerollExecutorMLCompanion(input: M90MLInput): Promise<M90MLOutput> {
  const tick = m90ClampTick(input.tick ?? 0);

  // Deterministic macro context derived from runId+tick (mirrors exec-style schedule use).
  const seed = computeHash(`${input.runId}:M90ML:${tick}`);
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m90PhaseFromTick(tick);
  const regime = m90RegimeFromSchedule(tick, macroSchedule);
  const chaosHit = m90ChaosHit(tick, chaosWindows);
  const pressure = m90PressureFrom(phase, chaosHit);

  // ✅ regime is canonical MacroRegime (no "RECESSION")
  const decay = computeDecayRate(regime, M90_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const salvageCredit = clamp((input.salvageCredit ?? 0) as number, 0, M90_BOUNDS.MAX_CREDIT);
  const credit01 = clamp(salvageCredit / M90_BOUNDS.MAX_CREDIT, 0, 1);

  const hasChallenge = Boolean(input.newChallenge && (input.newChallenge as ChallengeRef).id);
  const hasReroll = Boolean(input.rerollResult && Object.keys(input.rerollResult).length > 0);

  const base = hasChallenge ? 0.62 : 0.28;
  const creditBoost = clamp(credit01 * 0.22, 0, 0.22);
  const rerollBoost = hasReroll ? 0.06 : 0.0;

  const chaosPenalty = chaosHit ? 0.14 : 0.0;
  const pressurePenalty = pressure === 'CRITICAL' ? 0.10 : pressure === 'HIGH' ? 0.05 : 0.0;

  const macroSignal = clamp((pulse * mult) / 3.0, 0, 0.16);
  const stability = clamp((1 - decay) * 0.22, 0, 0.22);

  const score = clamp(base + creditBoost + rerollBoost + macroSignal + stability - chaosPenalty - pressurePenalty, 0.01, 0.99);

  const topFactors = [
    `challenge=${hasChallenge} reroll=${hasReroll}`,
    `salvageCredit=${salvageCredit}`,
    `tick=${tick}/${RUN_TOTAL_TICKS} phase=${phase}`,
    `regime=${regime} pulse*mult=${(pulse * mult).toFixed(2)}`,
    `pressure=${pressure} chaos=${Boolean(chaosHit)}`,
  ].slice(0, 5);

  const recommendation = hasChallenge
    ? 'Salvage->challenge pipeline active: keep proofs tight and rotate difficulty with macro pressure.'
    : 'No challenge issued: ensure achievementId and reroll pool are present, then re-run salvage under stable ticks.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M90', ...input, seed, phase, regime, pressure, decay, pulse, mult }) + ':ml:M90'),
    confidenceDecay: decay,
  };
}