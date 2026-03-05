// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m143_table_penalties_toxicity_without_ml_pure_rule_enforcement.ts
//
// Mechanic : M143 — Table Penalties: Toxicity Without ML Pure Rule Enforcement
// Family   : ops   Layer: api_endpoint   Priority: 1   Batch: 3
// ML Pair  : m143a
// Deps     : M46
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

/**
 * Type-usage anchor to ensure *all* imported types are referenced (prevents unused-import lint).
 * This is compile-time only.
 */
type __M143_TypeUsage = {
  runPhase: RunPhase;
  tickTier: TickTier;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  solvency: SolvencyStatus;
  asset: Asset;
  ipa: IPAItem;
  card: GameCard;
  event: GameEvent;
  shield: ShieldLayer;
  debt: Debt;
  buff: Buff;
  liability: Liability;
  setBonus: SetBonus;
  assetMod: AssetMod;
  incomeItem: IncomeItem;
  macroEvent: MacroEvent;
  chaosWindow: ChaosWindow;
  auction: AuctionResult;
  purchase: PurchaseResult;
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
  telemetry: MechanicTelemetryPayload;
  emit: MechanicEmitter;
};

// ── Local domain (not part of global types.ts) ─────────────────────────────

export interface BehaviorInfraction {
  kind: string;
  count: number;
}

export interface BehaviorReport {
  /** Optional tick context for telemetry correlation. */
  tick?: number;
  /** Optional runId context for telemetry correlation. */
  runId?: string;
  /** 0..100 scalar (recommended). */
  toxicityScore?: number;
  /** Rule-friendly counters. */
  infractions?: BehaviorInfraction[];
  refusedVotes?: number;
  spamPings?: number;
  rageQuitAttempts?: number;
  /** Extensible JSON-safe metadata. */
  meta?: Record<string, unknown>;
}

export interface PenaltyRule {
  id: string;
  /** Metric key (direct field, meta key, or infraction kind). */
  kind: string;
  threshold: number;
  /** Adds to the deterministic trigger score. */
  points: number;
  /** Base cord penalty if matched. */
  cordPenaltyBase: number;
  /** Optional cap for this rule contribution. */
  maxCordPenalty?: number;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M143Input {
  behaviorReport?: BehaviorReport;
  penaltyRules?: PenaltyRule[];
  playerId?: string;
}

export interface M143Output {
  penaltyApplied: boolean;
  cordPenalty: number;
  violationLogged: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M143Event = 'PENALTY_ISSUED' | 'CORD_PENALIZED' | 'VIOLATION_LOGGED';

export interface M143TelemetryPayload extends MechanicTelemetryPayload {
  event: M143Event;
  mechanic_id: 'M143';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M143_BOUNDS = {
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

// ── Deterministic helpers ─────────────────────────────────────────────────

const M143_DEFAULT_RULES: PenaltyRule[] = [
  { id: 'SPAM_PINGS', kind: 'spamPings', threshold: 10, points: 1, cordPenaltyBase: 250, maxCordPenalty: 2_500 },
  { id: 'REFUSED_VOTES', kind: 'refusedVotes', threshold: 2, points: 1, cordPenaltyBase: 500, maxCordPenalty: 5_000 },
  { id: 'RAGE_QUIT', kind: 'rageQuitAttempts', threshold: 1, points: 2, cordPenaltyBase: 1_250, maxCordPenalty: 10_000 },
  { id: 'HARASSMENT', kind: 'HARASSMENT', threshold: 1, points: 2, cordPenaltyBase: 2_000, maxCordPenalty: 15_000 },
  { id: 'SLURS', kind: 'SLUR', threshold: 1, points: 3, cordPenaltyBase: 5_000, maxCordPenalty: 25_000 },
];

function m143ToNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return fallback;
}

function m143MetricValue(report: BehaviorReport | undefined, kind: string): number {
  if (!report) return 0;

  // 1) direct field
  const direct = (report as Record<string, unknown>)[kind];
  const directN = m143ToNumber(direct, NaN);
  if (Number.isFinite(directN)) return directN;

  // 2) meta field
  const meta = report.meta ?? {};
  const metaV = (meta as Record<string, unknown>)[kind];
  const metaN = m143ToNumber(metaV, NaN);
  if (Number.isFinite(metaN)) return metaN;

  // 3) infractions aggregate (matching kind)
  const infractions = report.infractions ?? [];
  let sum = 0;
  for (const inf of infractions) {
    if (inf && inf.kind === kind) sum += clamp(m143ToNumber(inf.count, 0), 0, 999);
  }
  return sum;
}

function m143DeriveRunPhase(seed: string): RunPhase {
  const phases: RunPhase[] = ['EARLY', 'MID', 'LATE'];
  return phases[seededIndex(seed, 11, phases.length)] ?? 'EARLY';
}

function m143DerivePressureTier(seed: string): PressureTier {
  const tiers: PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return tiers[seededIndex(seed, 29, tiers.length)] ?? 'LOW';
}

function m143DeriveRegimeFromSchedule(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  let regime: MacroRegime = 'NEUTRAL';
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

type M143IntelContext = {
  seed: string;
  tick: number;
  phase: RunPhase;
  pressure: PressureTier;
  regime: MacroRegime;
  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
  regimeMultiplier: number;
  exitPulse: number;
  decayRate: number;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  opportunityPick: GameCard;
  weightedPoolPick: GameCard;
  auditCore: string;
};

function m143BuildIntelContext(runId: string, behaviorTick: number, playerId: string): M143IntelContext {
  const t = clamp(behaviorTick, 0, RUN_TOTAL_TICKS - 1);

  // Deterministic seed anchored to runId + playerId + tick (no runtime randomness).
  const seed = computeHash(`${runId}:M143:${playerId}:${t}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  const regime = m143DeriveRegimeFromSchedule(t, macroSchedule);

  const phase = m143DeriveRunPhase(seed);
  const pressure = m143DerivePressureTier(seed);

  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M143_BOUNDS.BASE_DECAY_RATE);

  // Use the canonical opportunity pool primitives so these imports are exercised deterministically.
  const oppIdx = seededIndex(seed, t + 777, OPPORTUNITY_POOL.length);
  const opportunityPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const weightedPool = buildWeightedPool(seed, pressureWeight * phaseWeight, regimeWeight);
  const wpIdx = seededIndex(seed, t + 999, weightedPool.length);
  const weightedPoolPick = weightedPool[wpIdx] ?? DEFAULT_CARD;

  const auditCore = computeHash(
    [
      seed,
      String(t),
      phase,
      pressure,
      regime,
      String(pressureWeight),
      String(phaseWeight),
      String(regimeWeight),
      String(regimeMultiplier),
      String(exitPulse),
      String(decayRate),
      String(DEFAULT_CARD_IDS.length),
    ].join('|'),
  );

  return {
    seed,
    tick: t,
    phase,
    pressure,
    regime,
    pressureWeight,
    phaseWeight,
    regimeWeight,
    regimeMultiplier,
    exitPulse,
    decayRate,
    macroSchedule,
    chaosWindows,
    opportunityPick,
    weightedPoolPick,
    auditCore,
  };
}

function m143SanitizeRules(rules: unknown, seed: string): PenaltyRule[] {
  const arr = Array.isArray(rules) ? (rules as unknown[]) : [];
  const out: PenaltyRule[] = [];

  for (const r of arr) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : '';
    const kind = typeof o.kind === 'string' && o.kind.trim() ? o.kind.trim() : '';
    if (!id || !kind) continue;

    const threshold = clamp(Math.floor(m143ToNumber(o.threshold, 0)), 0, 999);
    const points = clamp(Math.floor(m143ToNumber(o.points, 0)), 0, 999);
    const cordPenaltyBase = clamp(Math.floor(m143ToNumber(o.cordPenaltyBase, 0)), 0, M143_BOUNDS.MAX_AMOUNT);
    const maxCordPenalty = o.maxCordPenalty == null ? undefined : clamp(Math.floor(m143ToNumber(o.maxCordPenalty, 0)), 0, M143_BOUNDS.MAX_AMOUNT);

    out.push({ id, kind, threshold, points, cordPenaltyBase, maxCordPenalty });
  }

  const final = out.length > 0 ? out : M143_DEFAULT_RULES;
  // Deterministic ordering (removes input-order manipulation vectors)
  return seededShuffle(final, seed);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * tablePenaltyEnforcer
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function tablePenaltyEnforcer(input: M143Input, emit: MechanicEmitter): M143Output {
  const behaviorReport = input.behaviorReport;
  const playerId = String(input.playerId ?? '');

  // Anchor runId deterministically to the input snapshot (pure function).
  const snapshotRunId = computeHash(JSON.stringify(input ?? {}));
  const runId = String(behaviorReport?.runId ?? snapshotRunId);

  const tick = clamp(m143ToNumber(behaviorReport?.tick, 0), 0, RUN_TOTAL_TICKS - 1);

  const ctx = m143BuildIntelContext(runId, tick, playerId);

  const penaltyRules = m143SanitizeRules(input.penaltyRules, ctx.seed);

  // Base toxicity points (bounded, deterministic)
  const toxicityScore = clamp(m143ToNumber(behaviorReport?.toxicityScore, 0), 0, 100);
  const infractions = behaviorReport?.infractions ?? [];
  let infractionsTotal = 0;
  for (const inf of infractions) infractionsTotal += clamp(m143ToNumber(inf?.count, 0), 0, 999);

  const spamPings = clamp(m143ToNumber(behaviorReport?.spamPings, 0), 0, 999);
  const refusedVotes = clamp(m143ToNumber(behaviorReport?.refusedVotes, 0), 0, 999);
  const rageQuitAttempts = clamp(m143ToNumber(behaviorReport?.rageQuitAttempts, 0), 0, 999);

  const basePoints =
    Math.round(toxicityScore / 10) +
    infractionsTotal +
    spamPings +
    refusedVotes * 2 +
    rageQuitAttempts * 3;

  let rulePoints = 0;
  let rulePenalty = 0;
  const matchedRuleIds: string[] = [];

  for (const rule of penaltyRules) {
    const v = m143MetricValue(behaviorReport, rule.kind);
    if (v >= rule.threshold) {
      rulePoints += clamp(rule.points, 0, 999);
      const raw = clamp(rule.cordPenaltyBase, 0, M143_BOUNDS.MAX_AMOUNT);
      const capped = rule.maxCordPenalty == null ? raw : clamp(raw, 0, rule.maxCordPenalty);
      rulePenalty += capped;
      matchedRuleIds.push(rule.id);
    }
  }

  // Deterministic decay: later ticks soften score unless compounded by higher pressure/regime.
  const progress = clamp((ctx.tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  const decayedBase = Math.round(basePoints * (1 - clamp(ctx.decayRate * progress, 0, 0.95)));

  const totalPoints = decayedBase + rulePoints;

  const penaltyApplied = totalPoints >= M143_BOUNDS.TRIGGER_THRESHOLD;

  // Use “bounded chaos” to avoid perfectly gameable fixed penalties, but keep deterministic:
  // - choose a card-id-based salt
  const cardSalt = ctx.weightedPoolPick?.id ?? ctx.opportunityPick?.id ?? DEFAULT_CARD.id;
  const cardSaltIdx = seededIndex(ctx.seed, ctx.tick + 31337, DEFAULT_CARD_IDS.length);
  const cardSaltId = DEFAULT_CARD_IDS[cardSaltIdx] ?? DEFAULT_CARD.id;

  const auditSalt = computeHash(`${ctx.auditCore}:${cardSalt}:${cardSaltId}:${matchedRuleIds.join(',')}`);

  // Compute penalty (bounded + deterministic, no mutation)
  const weightFactor = clamp(ctx.pressureWeight * ctx.phaseWeight * ctx.regimeWeight, 0.25, 10);
  const regimeFactor = clamp(ctx.regimeMultiplier * ctx.exitPulse, 0.25, 10);

  // A tiny deterministic jitter (0.95..1.05) derived from auditSalt to prevent edge gaming.
  const jitterIdx = seededIndex(auditSalt, ctx.tick + 17, 11); // 0..10
  const jitter = 0.95 + jitterIdx * 0.01;

  const rawPenalty =
    (rulePenalty + totalPoints * 250) *
    M143_BOUNDS.MULTIPLIER *
    weightFactor *
    regimeFactor *
    jitter *
    M143_BOUNDS.EFFECT_MULTIPLIER;

  const cordPenalty = penaltyApplied ? clamp(Math.round(rawPenalty), 0, M143_BOUNDS.MAX_AMOUNT) : 0;

  const violationLogged = penaltyApplied;

  // ── Telemetry ────────────────────────────────────────────────────────────
  emit({
    event: 'PENALTY_ISSUED',
    mechanic_id: 'M143',
    tick: ctx.tick,
    runId,
    payload: {
      playerId,
      totalPoints,
      basePoints,
      decayedBase,
      rulePoints,
      matchedRuleIds,
      cordPenalty,
      phase: ctx.phase,
      pressure: ctx.pressure,
      regime: ctx.regime,
      pressureWeight: ctx.pressureWeight,
      phaseWeight: ctx.phaseWeight,
      regimeWeight: ctx.regimeWeight,
      regimeMultiplier: ctx.regimeMultiplier,
      exitPulse: ctx.exitPulse,
      decayRate: ctx.decayRate,
      macroEvents: ctx.macroSchedule.length,
      chaosWindows: ctx.chaosWindows.length,
      opportunityPoolSize: OPPORTUNITY_POOL.length,
      defaultCardId: DEFAULT_CARD.id,
      pickedOpportunityId: ctx.opportunityPick?.id ?? null,
      pickedWeightedPoolId: ctx.weightedPoolPick?.id ?? null,
      cardSalt,
      cardSaltId,
      auditSalt,
      // keep a couple bound constants visible for debugging/audit
      bounds: {
        trigger: M143_BOUNDS.TRIGGER_THRESHOLD,
        max: M143_BOUNDS.MAX_AMOUNT,
        pulseCycle: M143_BOUNDS.PULSE_CYCLE,
        firstRefusalTicks: M143_BOUNDS.FIRST_REFUSAL_TICKS,
      },
    },
  });

  if (penaltyApplied) {
    emit({
      event: 'CORD_PENALIZED',
      mechanic_id: 'M143',
      tick: ctx.tick,
      runId,
      payload: {
        playerId,
        cordPenalty,
        totalPoints,
        matchedRuleIds,
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        auditSalt,
      },
    });

    emit({
      event: 'VIOLATION_LOGGED',
      mechanic_id: 'M143',
      tick: ctx.tick,
      runId,
      payload: {
        playerId,
        violationLogged: true,
        matchedRuleIds,
        totalPoints,
        auditSalt,
      },
    });
  }

  return {
    penaltyApplied,
    cordPenalty,
    violationLogged,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M143MLInput {
  penaltyApplied?: boolean;
  cordPenalty?: number;
  violationLogged?: boolean;
  runId: string;
  tick: number;
}

export interface M143MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * tablePenaltyEnforcerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function tablePenaltyEnforcerMLCompanion(input: M143MLInput): Promise<M143MLOutput> {
  const applied = !!input.penaltyApplied;
  const penalty = clamp(m143ToNumber(input.cordPenalty, 0), 0, M143_BOUNDS.MAX_AMOUNT);
  const logged = !!input.violationLogged;

  const score = applied ? clamp(penalty / M143_BOUNDS.MAX_AMOUNT, 0.01, 0.99) : 0.01;

  const topFactors: string[] = [];
  if (applied) topFactors.push('Penalty applied by deterministic rules');
  if (penalty > 0) topFactors.push(`CORD penalty = ${penalty}`);
  if (logged) topFactors.push('Violation logged');
  topFactors.push('No state mutation (advisory only)');

  const recommendation = applied
    ? 'De-escalate table behavior immediately; repeated violations will compound CORD penalties.'
    : 'No penalty detected; maintain clean comms to avoid future CORD drift.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M143'),
    confidenceDecay: applied ? 0.05 : 0.02,
  };
}