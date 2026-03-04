// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m87_season_relics_limited_cosmetic_mints_from_verified_feats.ts
//
// Mechanic : M87 — Season Relics: Limited Cosmetic Mints from Verified Feats
// Family   : achievement_expert   Layer: season_runtime   Priority: 3   Batch: 2
// ML Pair  : m87a
// Deps     : M50, M19
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

// ── Import Anchors (keep every import “accessible” + used) ───────────────────

/**
 * Runtime access to the exact mechanicsUtils symbols bound to M87.
 * Exported so downstream systems (router, debug UI, test harness) can introspect.
 */
export const M87_IMPORTED_SYMBOLS = {
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

/**
 * Type-only anchor to keep every imported domain type referenced in-module.
 * Exported so TS does not flag it under noUnusedLocals (and so IDEs can jump-to-type).
 */
export type M87_ImportedTypesAnchor = {
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

// ── Local domain (M87-specific) ──────────────────────────────────────────────

/**
 * VerifiedFeat
 * Minimal, deterministic “feat proof” envelope. This is NOT an auth token.
 * Authorization must happen server-side (M50/M19 pipeline), this is for routing + mint derivation only.
 */
export interface VerifiedFeat {
  /** Stable feat id (e.g., "feat-10-win-streak" or "feat-elite-exit") */
  id: string;

  /** Human-readable label (safe to log) */
  label: string;

  /** Stable proof hash produced by verification pipeline (e.g., proof ledger hash) */
  proofHash: string;

  /** Which run produced the feat (if known) */
  runId?: string;

  /** Absolute season tick when the feat was verified (if known) */
  tick?: number;

  /**
   * Confidence 0..1 from verification pipeline (server-derived).
   * Do NOT trust for authorization; used only for governor gating.
   */
  confidence?: number;

  /**
   * Rarity weight 0..1. Higher => rarer => higher scarcity score (lower mint chance).
   * If omitted, derived deterministically.
   */
  rarityWeight?: number;

  /** Optional tags (safe to log) */
  tags?: string[];
}

/**
 * MintGovernorConfig
 * Deterministic policy knobs for how scarce relic mints are within a season.
 */
export interface MintGovernorConfig {
  /** Maximum cosmetic relic mints allowed per season (hard cap). */
  maxRelicsPerSeason?: number;

  /** Already minted relic count (tracked by server/season state). */
  mintedRelicsSoFar?: number;

  /** Minimum confidence required to mint. Default: 0.90 */
  minConfidence?: number;

  /** If false, mints are blocked inside chaos windows. Default: false */
  allowChaosMints?: boolean;

  /**
   * Extra scarcity scalar (0.5..2.0 typical). Higher => more scarce.
   * Default: 1.0
   */
  scarcityScalar?: number;

  /**
   * If present, this salt is mixed into mint hashes for season rotation without changing feat ids.
   * Server-controlled only.
   */
  rulesVersion?: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M87Input {
  seasonId?: string;
  verifiedFeat?: VerifiedFeat;
  mintGovernorConfig?: MintGovernorConfig;

  /**
   * Optional snapshot sources (router may spread a larger snapshot).
   * Using these improves determinism across client/server for the same season state.
   */
  seasonState?: SeasonState;
  stateTick?: number;
}

export interface M87Output {
  relicMinted: boolean;
  scarcityScore: number;
  mintHash: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M87Event = 'RELIC_MINTED' | 'RELIC_SCARCITY_UPDATED' | 'MINT_GOVERNOR_DECISION';

export interface M87TelemetryPayload extends MechanicTelemetryPayload {
  event: M87Event;
  mechanic_id: 'M87';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M87_BOUNDS = {
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

// ── Internal helpers (pure) ────────────────────────────────────────────────

function m87ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

function m87DerivePhase(tick: number): RunPhase {
  const t = m87ClampTick(tick);
  const third = RUN_TOTAL_TICKS / 3;
  return t < third ? 'EARLY' : t < third * 2 ? 'MID' : 'LATE';
}

function m87DeriveRegime(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  if (!macroSchedule || macroSchedule.length === 0) return 'NEUTRAL';
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m87FindChaosHit(tick: number, chaos: ChaosWindow[]): ChaosWindow | null {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return w;
  }
  return null;
}

function m87DerivePressure(phase: RunPhase, chaosHit: ChaosWindow | null): PressureTier {
  if (chaosHit) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m87DeriveTickTier(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m87Hash16(core: string): string {
  // computeHash() returns 8 hex chars; concatenate twice for a stable 16-char mint hash.
  return computeHash(core + ':a') + computeHash(core + ':b');
}

function m87Deterministic01(seed: string, saltTick: number): number {
  // 0..1 deterministic “coin flip” derived from djb2 hash.
  const h = parseInt(computeHash(`${seed}:${saltTick}`), 16) >>> 0;
  return clamp(h / 0xffffffff, 0, 1);
}

type M87Context = {
  seasonId: string;
  tick: number;
  seed: string;

  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tickTier: TickTier;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  chaosHit: ChaosWindow | null;

  decayRate: number;
  regimeMultiplier: number;
  exitPulse: number;

  phaseWeight: number;
  regimeWeight: number;
  pressureWeight: number;

  relicPool: GameCard[];
  relicTemplate: GameCard;

  deckSignature: string[];
};

function m87BuildContext(seasonId: string, feat: VerifiedFeat | undefined, tick: number, rulesVersion: string): M87Context {
  const t = m87ClampTick(tick);
  const featId = String(feat?.id ?? 'none');
  const featProof = String(feat?.proofHash ?? 'no-proof');

  const seed = computeHash(`M87:${rulesVersion}:${seasonId}:${featId}:${featProof}:${t}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m87DerivePhase(t);
  const regime = m87DeriveRegime(t, macroSchedule);
  const chaosHit = m87FindChaosHit(t, chaosWindows);

  const pressure = m87DerivePressure(phase, chaosHit);
  const tickTier = m87DeriveTickTier(pressure);

  const decayRate = computeDecayRate(regime, M87_BOUNDS.BASE_DECAY_RATE);
  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  // Cosmetic template derivation uses existing opportunity pool (no new power objects introduced).
  const relicPool = buildWeightedPool(`${seed}:relicPool`, pressureWeight * phaseWeight, regimeWeight);
  const relicTemplate = relicPool[seededIndex(seed, t + 87, relicPool.length)] ?? relicPool[0] ?? DEFAULT_CARD;

  // Use seededShuffle/DEFAULT_CARD_IDS to produce a deterministic “deck signature” for audits.
  const deckSignature = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  return {
    seasonId,
    tick: t,
    seed,
    phase,
    regime,
    pressure,
    tickTier,
    macroSchedule,
    chaosWindows,
    chaosHit,
    decayRate,
    regimeMultiplier,
    exitPulse,
    phaseWeight,
    regimeWeight,
    pressureWeight,
    relicPool,
    relicTemplate,
    deckSignature,
  };
}

function m87DeriveFeatRarityWeight(seed: string, feat: VerifiedFeat): number {
  if (typeof feat.rarityWeight === 'number') return clamp(feat.rarityWeight, 0, 1);
  // Deterministic default: treat unknown feats as “medium rare”, modulated by hash.
  const n = m87Deterministic01(`${seed}:rarity:${feat.id}`, feat.tick ?? 0);
  return clamp(0.45 + (n - 0.5) * 0.30, 0.10, 0.90);
}

function m87ComputeScarcityScore(
  ctx: M87Context,
  feat: VerifiedFeat,
  cfg: MintGovernorConfig,
  seasonState?: SeasonState,
): number {
  const rarity = m87DeriveFeatRarityWeight(ctx.seed, feat);
  const scalar = clamp(cfg.scarcityScalar ?? 1.0, 0.25, 4.0);

  const cap = Math.max(1, cfg.maxRelicsPerSeason ?? 12);
  const mintedSoFar =
    Math.max(0, cfg.mintedRelicsSoFar ?? 0) +
    Math.max(0, (seasonState?.rewardsClaimed?.filter((id) => id.startsWith('relic:')).length ?? 0));

  const fill = clamp(mintedSoFar / cap, 0, 1);

  // Macro conditions affect scarcity (crisis => fewer mints; bull => slightly more).
  const macroTightness = clamp(1.2 - (ctx.regimeWeight * ctx.regimeMultiplier * ctx.exitPulse) / 2.0, 0.35, 1.35);

  // Pressure tightness makes mints rarer in high pressure (protects integrity).
  const pressureTightness = clamp((ctx.pressureWeight - 0.8) * 0.55 + 1.0, 0.9, 1.9);

  // Final scarcity 0..100; higher => rarer.
  const scarcity =
    100 *
    clamp(
      (0.55 * rarity + 0.25 * fill + 0.20 * (macroTightness - 0.35) / (1.35 - 0.35)) *
        macroTightness *
        pressureTightness *
        scalar,
      0,
      1,
    );

  return Math.round(clamp(scarcity, 0, 100));
}

function m87ComputeMintChance01(ctx: M87Context, scarcityScore: number): number {
  // Base chance decreases with scarcity, but never hits 0 to avoid dead systems.
  const scarcity01 = clamp(scarcityScore / 100, 0, 1);

  // Macro + phase slightly modulate chance (still deterministic).
  const macroBoost = clamp((ctx.regimeWeight * ctx.regimeMultiplier) / 1.25, 0.35, 1.35);
  const phaseBoost = clamp(ctx.phaseWeight / 1.1, 0.75, 1.25);

  const chance = (0.35 * (1 - scarcity01) + 0.03) * macroBoost * phaseBoost;

  // Crisis + critical pressure tighten the faucet.
  const crisisPenalty = ctx.regime === 'CRISIS' ? 0.65 : 1.0;
  const pressurePenalty = ctx.pressure === 'CRITICAL' ? 0.70 : ctx.pressure === 'HIGH' ? 0.85 : 1.0;

  return clamp(chance * crisisPenalty * pressurePenalty, 0.01, 0.80);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * seasonRelicMintGovernor
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function seasonRelicMintGovernor(input: M87Input, emit: MechanicEmitter): M87Output {
  const seasonId = String(input.seasonId ?? '');
  const verifiedFeat = input.verifiedFeat;
  const cfg: MintGovernorConfig = input.mintGovernorConfig ?? {};
  const seasonState = input.seasonState;

  const tickRaw =
    (typeof verifiedFeat?.tick === 'number' ? verifiedFeat.tick : undefined) ??
    (typeof seasonState?.tick === 'number' ? seasonState.tick : undefined) ??
    (typeof input.stateTick === 'number' ? input.stateTick : 0);

  const rulesVersion = String(cfg.rulesVersion ?? 'v1');
  const ctx = m87BuildContext(seasonId, verifiedFeat, tickRaw, rulesVersion);

  const minConfidence = clamp(cfg.minConfidence ?? 0.9, 0, 1);
  const allowChaosMints = Boolean(cfg.allowChaosMints ?? false);

  // If no feat, mint is blocked but we still output deterministic scarcity + audit mintHash.
  const hasFeat = Boolean(verifiedFeat?.id && verifiedFeat?.proofHash);
  const featConfidence = clamp(verifiedFeat?.confidence ?? 0, 0, 1);

  const scarcityScore = hasFeat
    ? m87ComputeScarcityScore(ctx, verifiedFeat as VerifiedFeat, cfg, seasonState)
    : 100;

  const cap = Math.max(1, cfg.maxRelicsPerSeason ?? 12);
  const mintedSoFar =
    Math.max(0, cfg.mintedRelicsSoFar ?? 0) +
    Math.max(0, (seasonState?.rewardsClaimed?.filter((id) => id.startsWith('relic:')).length ?? 0));

  const capReached = mintedSoFar >= cap;
  const timeGate = ctx.tick >= M87_BOUNDS.FIRST_REFUSAL_TICKS;
  const confidenceGate = featConfidence >= minConfidence;
  const chaosGate = allowChaosMints ? true : ctx.chaosHit === null;

  const mintChance01 = hasFeat ? m87ComputeMintChance01(ctx, scarcityScore) : 0.0;
  const roll01 = m87Deterministic01(`${ctx.seed}:mintRoll`, ctx.tick + 870);

  // Deterministic “cosmetic id” derived from existing pool (no new power objects).
  const pressurePhaseWeight = ctx.pressureWeight * ctx.phaseWeight;
  const relicPool = buildWeightedPool(`${ctx.seed}:relicPool2`, pressurePhaseWeight, ctx.regimeWeight);
  const poolPick =
    relicPool[seededIndex(ctx.seed, ctx.tick + 887, relicPool.length)] ??
    OPPORTUNITY_POOL[seededIndex(ctx.seed, ctx.tick + 1887, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  // Ensure any minted relic references a stable id from DEFAULT_CARD_IDS (audit-friendly).
  const relicTemplateId = DEFAULT_CARD_IDS.includes(poolPick.id) ? poolPick.id : DEFAULT_CARD.id;

  // Deterministic “serial slot” (cosmetic only)
  const serialDeck = seededShuffle(DEFAULT_CARD_IDS, `${ctx.seed}:serialDeck:${ctx.tick}`);
  const serialTag = serialDeck[0] ?? DEFAULT_CARD.id;

  const relicId = hasFeat
    ? `relic:${rulesVersion}:${seasonId}:${(verifiedFeat as VerifiedFeat).id}:${relicTemplateId}:${serialTag}`
    : `relic:${rulesVersion}:${seasonId}:none:${relicTemplateId}:${serialTag}`;

  const mintCore = JSON.stringify({
    mid: 'M87',
    rulesVersion,
    seasonId,
    tick: ctx.tick,
    phase: ctx.phase,
    regime: ctx.regime,
    pressure: ctx.pressure,
    tickTier: ctx.tickTier,
    decay: Number(ctx.decayRate.toFixed(4)),
    mult: Number(ctx.regimeMultiplier.toFixed(4)),
    pulse: Number(ctx.exitPulse.toFixed(4)),
    deckSig: ctx.deckSignature,
    relicTemplateId,
    serialTag,
    relicId,
    scarcityScore,
    cap,
    mintedSoFar,
    hasFeat,
    feat: hasFeat
      ? {
          id: (verifiedFeat as VerifiedFeat).id,
          label: (verifiedFeat as VerifiedFeat).label,
          proofHash: (verifiedFeat as VerifiedFeat).proofHash,
          runId: (verifiedFeat as VerifiedFeat).runId ?? '',
          confidence: featConfidence,
          rarityWeight: m87DeriveFeatRarityWeight(ctx.seed, verifiedFeat as VerifiedFeat),
          tags: (verifiedFeat as VerifiedFeat).tags ?? [],
        }
      : null,
    policy: { minConfidence, allowChaosMints },
    gates: { timeGate, confidenceGate, chaosGate, capReached },
    mintChance01: Number(mintChance01.toFixed(6)),
    roll01: Number(roll01.toFixed(6)),
  });

  const mintHash = m87Hash16(mintCore);

  const relicMinted =
    hasFeat &&
    timeGate &&
    confidenceGate &&
    chaosGate &&
    !capReached &&
    roll01 <= mintChance01 &&
    scarcityScore >= M87_BOUNDS.TRIGGER_THRESHOLD; // ensures “real feats” drive mints

  emit({
    event: 'MINT_GOVERNOR_DECISION',
    mechanic_id: 'M87',
    tick: ctx.tick,
    runId: computeHash(`${seasonId}:${rulesVersion}`),
    payload: {
      seasonId,
      rulesVersion,
      relicMinted,
      relicId,
      relicTemplateId,
      serialTag,
      phase: ctx.phase,
      regime: ctx.regime,
      pressure: ctx.pressure,
      tickTier: ctx.tickTier,
      scarcityScore,
      cap,
      mintedSoFar,
      hasFeat,
      featConfidence,
      minConfidence,
      allowChaosMints,
      chaosHit: ctx.chaosHit ? { startTick: ctx.chaosHit.startTick, endTick: ctx.chaosHit.endTick, type: ctx.chaosHit.type } : null,
      timeGate,
      confidenceGate,
      chaosGate,
      capReached,
      mintChance01,
      roll01,
      audit: computeHash(mintCore),
      mintHash,
    },
  });

  emit({
    event: 'RELIC_SCARCITY_UPDATED',
    mechanic_id: 'M87',
    tick: ctx.tick,
    runId: computeHash(`${seasonId}:${rulesVersion}`),
    payload: {
      seasonId,
      rulesVersion,
      scarcityScore,
      cap,
      mintedSoFar,
      regime: ctx.regime,
      phase: ctx.phase,
      pressure: ctx.pressure,
      decayRate: ctx.decayRate,
      audit: computeHash(`${mintCore}:scarcity`),
    },
  });

  if (relicMinted) {
    emit({
      event: 'RELIC_MINTED',
      mechanic_id: 'M87',
      tick: ctx.tick,
      runId: computeHash(`${seasonId}:${rulesVersion}`),
      payload: {
        seasonId,
        rulesVersion,
        relicId,
        relicTemplateId,
        serialTag,
        scarcityScore,
        mintHash,
        proofHash: (verifiedFeat as VerifiedFeat).proofHash,
        featId: (verifiedFeat as VerifiedFeat).id,
        featLabel: (verifiedFeat as VerifiedFeat).label,
        audit: computeHash(`${mintCore}:minted`),
      },
    });
  }

  return {
    relicMinted,
    scarcityScore,
    mintHash,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M87MLInput {
  relicMinted?: boolean;
  scarcityScore?: number;
  mintHash?: string;
  runId: string;
  tick: number;
}

export interface M87MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * seasonRelicMintGovernorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function seasonRelicMintGovernorMLCompanion(input: M87MLInput): Promise<M87MLOutput> {
  const tick = m87ClampTick(input.tick ?? 0);

  // Deterministic macro context derived from runId+tick (mirrors exec-style schedule use).
  const seed = computeHash(`${input.runId}:M87ML:${tick}`);
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m87DerivePhase(tick);
  const regime = m87DeriveRegime(tick, macroSchedule);
  const chaosHit = m87FindChaosHit(tick, chaosWindows);
  const pressure = m87DerivePressure(phase, chaosHit);

  const decay = computeDecayRate(regime, M87_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const stamped = Boolean(input.relicMinted);
  const scarcity = clamp((input.scarcityScore ?? 0) / 100, 0, 1);
  const hasHash = Boolean(input.mintHash && input.mintHash.length >= 8);

  // Advisory score: mints under stable conditions get higher confidence, crisis/chaos lowers it.
  const base = stamped ? 0.65 : 0.28;
  const hashBonus = hasHash ? 0.06 : 0.0;

  const stability = clamp((1 - decay) * 0.25, 0, 0.25);
  const macroSignal = clamp((pulse * mult) / 3.0, 0, 0.20);
  const scarcitySignal = stamped ? clamp((1 - scarcity) * 0.18, 0, 0.18) : clamp(scarcity * 0.10, 0, 0.10);

  const chaosPenalty = chaosHit ? 0.18 : 0.0;
  const pressurePenalty = pressure === 'CRITICAL' ? 0.14 : pressure === 'HIGH' ? 0.08 : 0.0;

  const score = clamp(base + hashBonus + stability + macroSignal + scarcitySignal - chaosPenalty - pressurePenalty, 0.01, 0.99);

  const topFactors = [
    `minted=${stamped} hasHash=${hasHash}`,
    `tick=${tick}/${RUN_TOTAL_TICKS} phase=${phase}`,
    `regime=${regime} pulse*mult=${(pulse * mult).toFixed(2)}`,
    `pressure=${pressure} chaos=${Boolean(chaosHit)}`,
    `scarcity=${Math.round(scarcity * 100)}`,
  ].slice(0, 5);

  const recommendation = stamped
    ? chaosHit
      ? 'Relic minted under chaos: treat as a prestige artifact; tighten verification and publish the mint hash.'
      : 'Relic minted: surface it as a season-proof cosmetic and bind it to the verified feat hash.'
    : scarcity > 0.75
      ? 'High scarcity: do not force mints; let feats accumulate to preserve season integrity.'
      : 'No mint: keep chasing verified feats; mint chance improves outside chaos windows and away from crisis regimes.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M87', ...input, seed, phase, regime, pressure, decay, pulse, mult }) + ':ml:M87'),
    confidenceDecay: decay,
  };
}