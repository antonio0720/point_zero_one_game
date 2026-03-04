// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m89_trust_weighted_cosmetic_multipliers_integrity_incentives.ts
//
// Mechanic : M89 — Trust-Weighted Cosmetic Multipliers: Integrity Incentives
// Family   : achievement_expert   Layer: season_runtime   Priority: 3   Batch: 2
// ML Pair  : m89a
// Deps     : M53, M39
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

// ── Import Anchors (keeps every symbol “accessible” + TS-used) ───────────────

export const M89_IMPORTED_SYMBOLS = {
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

export type M89_ImportedTypesAnchor = {
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

// ── Local domain (M89-specific) ──────────────────────────────────────────────

export interface CosmeticBase {
  /** Stable cosmetic id (ex: "banner:default", "aura:ember", "title:rook") */
  id: string;
  /** Cosmetic type (ex: "banner", "title", "frame", "aura") */
  type: string;
  /** Optional base intensity (0..1) */
  baseIntensity?: number;
  /** Optional display name */
  name?: string;
}

export type IntegrityTier = 'ASH' | 'IRON' | 'ONYX' | 'AURUM' | 'HALO';

export interface IntegrityMultiplierRow {
  minTrust: number; // 0..100
  tier: IntegrityTier;
  multiplier: number; // 1.0..?
  bonus: number; // additive cosmetic bonus points
}

export interface IntegrityMultiplierTable {
  rows: IntegrityMultiplierRow[];
  /** Optional table version for audit stability */
  version?: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M89Input {
  trustScore?: number; // 0..100
  cosmeticBase?: CosmeticBase;
  integrityMultiplierTable?: unknown;

  /**
   * Optional snapshot sources (router may spread additional fields).
   * If present, used for deterministic context and audit.
   */
  seasonId?: string;
  seasonState?: SeasonState;
  stateTick?: number;
  runId?: string;
}

export interface M89Output {
  cosmeticMultiplied: boolean;
  displayTier: string;
  integrityBonus: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M89Event = 'INTEGRITY_BONUS_APPLIED' | 'COSMETIC_TIER_UPGRADED' | 'TRUST_WEIGHT_COMPUTED';

export interface M89TelemetryPayload extends MechanicTelemetryPayload {
  event: M89Event;
  mechanic_id: 'M89';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M89_BOUNDS = {
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

function m89ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

function m89PhaseFromTick(tick: number): RunPhase {
  const t = m89ClampTick(tick);
  const third = RUN_TOTAL_TICKS / 3;
  return t < third ? 'EARLY' : t < third * 2 ? 'MID' : 'LATE';
}

function m89RegimeFromSchedule(tick: number, macro: MacroEvent[]): MacroRegime {
  if (!macro || macro.length === 0) return 'NEUTRAL';
  const sorted = [...macro].sort((a, b) => a.tick - b.tick);
  let r: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function m89ChaosHit(tick: number, chaos: ChaosWindow[]): ChaosWindow | null {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return w;
  }
  return null;
}

function m89PressureFrom(phase: RunPhase, chaosHit: ChaosWindow | null): PressureTier {
  if (chaosHit) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m89TickTierFrom(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m89Hash16(core: string): string {
  // computeHash() returns 8 hex chars; concatenate twice for stable 16-char ids.
  return computeHash(core + ':a') + computeHash(core + ':b');
}

function m89CoerceTable(x: unknown): IntegrityMultiplierTable {
  if (!x || typeof x !== 'object') return { rows: m89DefaultTable(), version: 'default' };
  const o = x as Record<string, unknown>;
  const rawRows = (o.rows as unknown) ?? (o.table as unknown) ?? (o.multipliers as unknown);

  const rows: IntegrityMultiplierRow[] = Array.isArray(rawRows)
    ? rawRows
        .map((r) => {
          const rr = r as Partial<IntegrityMultiplierRow>;
          const minTrust = typeof rr.minTrust === 'number' ? rr.minTrust : 0;
          const multiplier = typeof rr.multiplier === 'number' ? rr.multiplier : 1.0;
          const bonus = typeof rr.bonus === 'number' ? rr.bonus : 0;
          const tier = String(rr.tier ?? 'ASH') as IntegrityTier;
          const safeTier: IntegrityTier =
            tier === 'ASH' || tier === 'IRON' || tier === 'ONYX' || tier === 'AURUM' || tier === 'HALO' ? tier : 'ASH';
          return {
            minTrust: clamp(minTrust, 0, 100),
            tier: safeTier,
            multiplier: clamp(multiplier, 1.0, 5.0),
            bonus: clamp(bonus, 0, 10_000),
          };
        })
        .sort((a, b) => a.minTrust - b.minTrust)
    : m89DefaultTable();

  const version = typeof o.version === 'string' ? o.version : 'coerced';
  return { rows: rows.length ? rows : m89DefaultTable(), version };
}

function m89DefaultTable(): IntegrityMultiplierRow[] {
  return [
    { minTrust: 0, tier: 'ASH', multiplier: 1.0, bonus: 0 },
    { minTrust: 25, tier: 'IRON', multiplier: 1.05, bonus: 50 },
    { minTrust: 50, tier: 'ONYX', multiplier: 1.12, bonus: 125 },
    { minTrust: 75, tier: 'AURUM', multiplier: 1.22, bonus: 250 },
    { minTrust: 90, tier: 'HALO', multiplier: 1.35, bonus: 400 },
  ];
}

function m89PickRow(table: IntegrityMultiplierTable, trustScore: number): IntegrityMultiplierRow {
  const t = clamp(trustScore, 0, 100);
  let chosen = table.rows[0] ?? { minTrust: 0, tier: 'ASH', multiplier: 1.0, bonus: 0 };
  for (const r of table.rows) {
    if (t >= r.minTrust) chosen = r;
    else break;
  }
  return chosen;
}

function m89Deterministic01(seed: string, saltTick: number): number {
  const h = parseInt(computeHash(`${seed}:${saltTick}`), 16) >>> 0;
  return clamp(h / 0xffffffff, 0, 1);
}

type M89Ctx = {
  tick: number;
  seed: string;

  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tier: TickTier;

  decayRate: number;
  pulse: number;
  mult: number;

  phaseWeight: number;
  regimeWeight: number;
  pressureWeight: number;

  chaos: ChaosWindow | null;

  // Cosmetic sampling context
  cosmeticPool: GameCard[];
  cosmeticCard: GameCard;

  deckSig: string[];
};

function m89BuildCtx(seedRoot: string, tickRaw: number): M89Ctx {
  const tick = m89ClampTick(tickRaw);
  const seed = computeHash(`${seedRoot}:M89:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m89PhaseFromTick(tick);
  const regime = m89RegimeFromSchedule(tick, macroSchedule);
  const chaos = m89ChaosHit(tick, chaosWindows);

  const pressure = m89PressureFrom(phase, chaos);
  const tier = m89TickTierFrom(pressure);

  const decayRate = computeDecayRate(regime, M89_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  // Use buildWeightedPool + OPPORTUNITY_POOL + DEFAULT_CARD deterministically for “cosmetic hinting”.
  const cosmeticPool = buildWeightedPool(`${seed}:cosmeticPool`, pressureWeight * phaseWeight, regimeWeight);
  const cosmeticCard =
    cosmeticPool[seededIndex(seed, tick + 89, cosmeticPool.length)] ??
    OPPORTUNITY_POOL[seededIndex(seed, tick + 1089, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  // Use seededShuffle + DEFAULT_CARD_IDS to generate a deterministic “deck signature”.
  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  return {
    tick,
    seed,
    phase,
    regime,
    pressure,
    tier,
    decayRate,
    pulse,
    mult,
    phaseWeight,
    regimeWeight,
    pressureWeight,
    chaos,
    cosmeticPool,
    cosmeticCard,
    deckSig,
  };
}

function m89DisplayTierLabel(row: IntegrityMultiplierRow, ctx: M89Ctx): string {
  // Deterministic “tier label” with macro context + stable short tag.
  const tag = computeHash(`${row.tier}:${ctx.regime}:${ctx.phase}:${ctx.pressure}`).slice(0, 4).toUpperCase();
  return `${row.tier}·${tag}`;
}

function m89ComputeIntegrityBonus(
  trustScore: number,
  row: IntegrityMultiplierRow,
  ctx: M89Ctx,
  base: CosmeticBase,
): number {
  const t = clamp(trustScore, 0, 100);

  // Normalize trust to 0..1
  const trust01 = t / 100;

  // Macro “integrity pressure”: in crisis/chaos, bonus shrinks (integrity is tested, not rewarded with cosmetics).
  const chaosPenalty = ctx.chaos ? 0.70 : 1.0;
  const crisisPenalty = ctx.regime === 'CRISIS' ? 0.80 : 1.0;

  // Pressure influences bonus curve slightly.
  const pressureScalar = ctx.pressure === 'CRITICAL' ? 0.85 : ctx.pressure === 'HIGH' ? 0.92 : 1.0;

  // Base intensity modulates the bonus.
  const baseIntensity = clamp(base.baseIntensity ?? 1.0, 0.1, 2.0);

  // Bonus points are purely cosmetic “signal strength” for display; keep bounded.
  const raw =
    (row.bonus + 500 * trust01) *
    row.multiplier *
    (ctx.phaseWeight * 0.85 + 0.15) *
    (ctx.regimeWeight * 0.80 + 0.20) *
    chaosPenalty *
    crisisPenalty *
    pressureScalar *
    baseIntensity;

  return Math.round(clamp(raw, 0, 10_000));
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * trustWeightedCosmeticMultiplier
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function trustWeightedCosmeticMultiplier(input: M89Input, emit: MechanicEmitter): M89Output {
  const trustScore = clamp((input.trustScore as number) ?? 0, 0, 100);

  const cosmeticBase: CosmeticBase = (input.cosmeticBase as CosmeticBase | undefined) ?? {
    id: 'cosmetic:default',
    type: 'banner',
    baseIntensity: 1.0,
    name: 'Default Cosmetic',
  };

  const table = m89CoerceTable(input.integrityMultiplierTable);

  const seasonId = String(input.seasonId ?? (input.seasonState as unknown as { seasonId?: string } | undefined)?.seasonId ?? '').trim();
  const tickRaw =
    typeof input.stateTick === 'number'
      ? input.stateTick
      : (typeof (input.seasonState as unknown as { tick?: number } | undefined)?.tick === 'number'
          ? (input.seasonState as unknown as { tick?: number }).tick!
          : 0);

  const seedRoot =
    String(input.runId ?? '') ||
    computeHash(`${seasonId}:${cosmeticBase.id}:${cosmeticBase.type}`);

  const ctx = m89BuildCtx(seedRoot, tickRaw);

  const row = m89PickRow(table, trustScore);
  const displayTier = m89DisplayTierLabel(row, ctx);
  const integrityBonus = m89ComputeIntegrityBonus(trustScore, row, ctx, cosmeticBase);

  // Deterministic “apply” gate: require a minimum trust and a real cosmetic id.
  const minTrustGate = trustScore >= (table.rows[1]?.minTrust ?? 25);
  const hasCosmeticId = cosmeticBase.id.trim().length >= M89_BOUNDS.TRIGGER_THRESHOLD;
  const shouldApply = minTrustGate && hasCosmeticId;

  // Emit trust weight computation (always)
  emit({
    event: 'TRUST_WEIGHT_COMPUTED',
    mechanic_id: 'M89',
    tick: ctx.tick,
    runId: computeHash(`${seedRoot}:M89`),
    payload: {
      seasonId,
      trustScore,
      minTrustGate,
      hasCosmeticId,
      phase: ctx.phase,
      regime: ctx.regime,
      pressure: ctx.pressure,
      tickTier: ctx.tier,
      decayRate: Number(ctx.decayRate.toFixed(4)),
      pulse: Number(ctx.pulse.toFixed(4)),
      mult: Number(ctx.mult.toFixed(4)),
      row,
      displayTier,
      cosmeticHintCard: { id: ctx.cosmeticCard.id, name: ctx.cosmeticCard.name },
      deckSig: ctx.deckSig,
      audit: computeHash(JSON.stringify({ trustScore, row, ctxSeed: ctx.seed, cosmeticBase, tableVersion: table.version })),
    },
  });

  // Emit tier upgrade event (only if applying)
  if (shouldApply) {
    emit({
      event: 'COSMETIC_TIER_UPGRADED',
      mechanic_id: 'M89',
      tick: ctx.tick,
      runId: computeHash(`${seedRoot}:M89`),
      payload: {
        seasonId,
        cosmeticBase,
        displayTier,
        tier: row.tier,
        multiplier: row.multiplier,
        integrityBonus,
        audit: computeHash(`${displayTier}:${integrityBonus}:${ctx.seed}`),
      },
    });

    emit({
      event: 'INTEGRITY_BONUS_APPLIED',
      mechanic_id: 'M89',
      tick: ctx.tick,
      runId: computeHash(`${seedRoot}:M89`),
      payload: {
        seasonId,
        cosmeticId: cosmeticBase.id,
        cosmeticType: cosmeticBase.type,
        trustScore,
        displayTier,
        integrityBonus,
        // Use seededIndex + seededShuffle again for additional deterministic audit tags
        auditTag: seededShuffle(DEFAULT_CARD_IDS, `${ctx.seed}:auditTag`)[seededIndex(ctx.seed, ctx.tick + 289, Math.min(8, DEFAULT_CARD_IDS.length))] ?? DEFAULT_CARD.id,
        audit: computeHash(JSON.stringify({ seed: ctx.seed, trustScore, displayTier, integrityBonus, tableVersion: table.version })),
      },
    });
  }

  return {
    cosmeticMultiplied: shouldApply,
    displayTier,
    integrityBonus: shouldApply ? integrityBonus : 0,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M89MLInput {
  cosmeticMultiplied?: boolean;
  displayTier?: string;
  integrityBonus?: number;
  runId: string;
  tick: number;
}

export interface M89MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * trustWeightedCosmeticMultiplierMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function trustWeightedCosmeticMultiplierMLCompanion(input: M89MLInput): Promise<M89MLOutput> {
  const tick = m89ClampTick(input.tick ?? 0);

  // Deterministic macro context derived from runId+tick.
  const seed = computeHash(`${input.runId}:M89ML:${tick}`);
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m89PhaseFromTick(tick);
  const regime = m89RegimeFromSchedule(tick, macroSchedule);
  const chaosHit = m89ChaosHit(tick, chaosWindows);
  const pressure = m89PressureFrom(phase, chaosHit);

  const decay = computeDecayRate(regime, M89_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const applied = Boolean(input.cosmeticMultiplied);
  const bonus01 = clamp((input.integrityBonus ?? 0) / 10_000, 0, 1);
  const hasTier = Boolean(input.displayTier && input.displayTier.length >= 3);

  const base = applied ? 0.62 : 0.26;
  const tierBonus = hasTier ? 0.06 : 0.0;
  const bonusBoost = applied ? clamp(bonus01 * 0.22, 0, 0.22) : clamp(bonus01 * 0.08, 0, 0.08);

  const chaosPenalty = chaosHit ? 0.14 : 0.0;
  const pressurePenalty = pressure === 'CRITICAL' ? 0.10 : pressure === 'HIGH' ? 0.05 : 0.0;

  const macroSignal = clamp((pulse * mult) / 3.0, 0, 0.16);
  const stability = clamp((1 - decay) * 0.22, 0, 0.22);

  const score = clamp(base + tierBonus + bonusBoost + macroSignal + stability - chaosPenalty - pressurePenalty, 0.01, 0.99);

  const topFactors = [
    `applied=${applied} tier=${hasTier ? 'yes' : 'no'}`,
    `bonus=${(input.integrityBonus ?? 0).toFixed(0)}`,
    `tick=${tick}/${RUN_TOTAL_TICKS} phase=${phase}`,
    `regime=${regime} pulse*mult=${(pulse * mult).toFixed(2)}`,
    `pressure=${pressure} chaos=${Boolean(chaosHit)}`,
  ].slice(0, 5);

  const recommendation = applied
    ? 'Integrity cosmetic bonus applied: keep audits visible and preserve scarcity by not over-awarding.'
    : 'No integrity bonus: raise trust score through verified feats and maintain consistent proof receipts.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M89', ...input, seed, phase, regime, pressure, decay, pulse, mult }) + ':ml:M89'),
    confidenceDecay: decay,
  };
}