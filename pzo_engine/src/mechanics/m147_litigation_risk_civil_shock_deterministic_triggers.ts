// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m147_litigation_risk_civil_shock_deterministic_triggers.ts
//
// Mechanic : M147 — Litigation Risk: Civil Shock Deterministic Triggers
// Family   : ops   Layer: backend_service   Priority: 2   Batch: 3
// ML Pair  : m147a
// Deps     : M12, M13
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

// ── Import Anchors (make every import accessible + used) ───────────────────

/**
 * Runtime access to the canonical mechanicsUtils symbols imported by this mechanic.
 * Use for debugging/inspection without hunting through module scope.
 */
export const M147_IMPORTED_SYMBOLS = {
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

/** Type-only anchor to ensure every imported type remains referenced in-module. */
export type M147_ImportedTypesAnchor = {
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

// ── Local domain (not part of shared ./types.ts) ───────────────────────────

export type LitigationTriggerKind =
  | 'CONTRACT_BREACH'
  | 'IP_DISPUTE'
  | 'FRAUD_ALLEGATION'
  | 'TENANT_DISPUTE'
  | 'INJURY_CLAIM'
  | 'REGULATORY_ACTION'
  | 'UNKNOWN';

export interface LitigationTrigger {
  kind: LitigationTriggerKind;
  /** 0..100 risk/severity */
  severity?: number;
  /** Optional claim amount request (not authoritative). */
  claimAmount?: number;
  /** Optional: evidence strength 0..1 (bounded). */
  evidenceStrength?: number;
  /** Optional human-readable note (keep short). */
  note?: string;
  /** Extensible metadata (JSON-safe). */
  meta?: Record<string, unknown>;
}

export type LegalHoldScope = 'NONE' | 'DOCS_ONLY' | 'TRANSACTIONS' | 'FULL_FREEZE';

export interface LitigationShock {
  id: string;
  runId: string;
  tick: number;

  trigger: LitigationTrigger;

  phase: RunPhase;
  pressure: PressureTier;
  regime: MacroRegime;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  /** Deterministic featured reference card (anchors audit visibility). */
  featuredCardId: string;
  featuredCard: GameCard;

  /** Core outcomes */
  cashBefore: number;
  cashDrained: number;
  cashAfter: number;

  legalHoldApplied: boolean;
  holdScope: LegalHoldScope;
  holdUntilTick: number;

  /** Deterministic verification hash */
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M147Input {
  litigationTrigger?: LitigationTrigger;
  stateCash?: number;
  runSeed?: string;
}

export interface M147Output {
  litigationShock: LitigationShock;
  cashDrained: number;
  legalHoldApplied: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M147Event = 'LITIGATION_TRIGGERED' | 'LEGAL_HOLD_APPLIED' | 'CIVIL_SHOCK_RESOLVED';

export interface M147TelemetryPayload extends MechanicTelemetryPayload {
  event: M147Event;
  mechanic_id: 'M147';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M147_BOUNDS = {
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

export const M147_LITIGATION_BOUNDS = {
  MAX_NOTE_LEN: 180,
  MAX_META_KEYS: 24,

  /** Maximum hold duration window (ticks) before scaling by regime pulse. */
  MAX_HOLD_TICKS: 24,

  /** Deterministic jitter range for hold duration (ticks). */
  HOLD_JITTER_TICKS: 2,

  /** Drain ratio caps */
  MIN_DRAIN_PCT: 0.01, // 1%
  MAX_DRAIN_PCT: 0.35, // 35%
} as const;

// ── Internal helpers (pure) ───────────────────────────────────────────────

function m147SafeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    try {
      return String(v);
    } catch {
      return '[unstringifiable]';
    }
  }
}

function m147ToNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  return fallback;
}

function m147NormalizeTrigger(t: LitigationTrigger | undefined): LitigationTrigger {
  const kind: LitigationTriggerKind = (t?.kind as LitigationTriggerKind) ?? 'UNKNOWN';
  const severity = clamp(Math.floor(m147ToNumber(t?.severity, 25)), 0, 100);
  const claimAmount = clamp(Math.floor(m147ToNumber(t?.claimAmount, 0)), 0, M147_BOUNDS.MAX_PROCEEDS);
  const evidenceStrength = clamp(m147ToNumber(t?.evidenceStrength, 0.5), 0, 1);

  const note = t?.note ? String(t.note).slice(0, M147_LITIGATION_BOUNDS.MAX_NOTE_LEN) : undefined;

  const meta =
    t?.meta && typeof t.meta === 'object'
      ? (t.meta as Record<string, unknown>)
      : undefined;

  return {
    kind,
    severity,
    claimAmount,
    evidenceStrength,
    note,
    meta,
  };
}

function m147DerivePhase(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m147InChaos(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m147DerivePressure(tick: number, phase: RunPhase, chaosWindows: ChaosWindow[]): PressureTier {
  if (m147InChaos(tick, chaosWindows)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m147DeriveRegime(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  let regime: MacroRegime = 'NEUTRAL';
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m147PickFeaturedCard(seed: string, tick: number, pressure: PressureTier, phase: RunPhase, regime: MacroRegime) {
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(seed, pressureWeight * phaseWeight, regimeWeight);
  const safePool = pool.length ? pool : [DEFAULT_CARD];

  const idx = seededIndex(seed, tick + 999, safePool.length);
  const oppIdx = seededIndex(seed, tick + 777, Math.max(1, OPPORTUNITY_POOL.length));
  const fallback = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const featuredCard = safePool[idx] ?? fallback ?? DEFAULT_CARD;

  const idIdx = seededIndex(seed, tick + 31337, Math.max(1, DEFAULT_CARD_IDS.length));
  const featuredCardId = featuredCard.id || (DEFAULT_CARD_IDS[idIdx] ?? DEFAULT_CARD.id);

  return { featuredCard, featuredCardId, poolSize: safePool.length };
}

function m147HoldScope(trigger: LitigationTrigger, severityScore: number): LegalHoldScope {
  if (severityScore >= 85) return 'FULL_FREEZE';
  if (severityScore >= 65) return trigger.kind === 'FRAUD_ALLEGATION' || trigger.kind === 'REGULATORY_ACTION' ? 'FULL_FREEZE' : 'TRANSACTIONS';
  if (severityScore >= 45) return 'DOCS_ONLY';
  return 'NONE';
}

function m147ComputeHoldUntil(seed: string, tick: number, regime: MacroRegime, scope: LegalHoldScope): number {
  if (scope === 'NONE') return tick;

  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const jitterSpan = 2 * M147_LITIGATION_BOUNDS.HOLD_JITTER_TICKS + 1;
  const jitter = seededIndex(seed, tick + 4242, jitterSpan) - M147_LITIGATION_BOUNDS.HOLD_JITTER_TICKS;

  // Base duration scales with scope.
  const base =
    scope === 'DOCS_ONLY' ? Math.floor(M147_BOUNDS.FIRST_REFUSAL_TICKS / 2) :
    scope === 'TRANSACTIONS' ? M147_BOUNDS.FIRST_REFUSAL_TICKS :
    Math.min(M147_LITIGATION_BOUNDS.MAX_HOLD_TICKS, M147_BOUNDS.FIRST_REFUSAL_TICKS * 2);

  // Regime pulse applies bounded chaos scaling.
  const scaled = Math.round(base * clamp(pulse, 0.55, 1.25));

  return clamp(tick + clamp(scaled + jitter, 1, M147_LITIGATION_BOUNDS.MAX_HOLD_TICKS), 0, RUN_TOTAL_TICKS - 1);
}

function m147ComputeDrain(
  seed: string,
  tick: number,
  cash: number,
  trigger: LitigationTrigger,
  regime: MacroRegime,
  pressure: PressureTier,
  phase: RunPhase,
): { drained: number; severityScore: number; factors: string[] } {
  const cashSafe = Math.max(0, Math.floor(cash));

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;

  const severity = clamp(Math.floor(m147ToNumber(trigger.severity, 25)), 0, 100);
  const claim = clamp(Math.floor(m147ToNumber(trigger.claimAmount, 0)), 0, M147_BOUNDS.MAX_PROCEEDS);
  const evidence = clamp(m147ToNumber(trigger.evidenceStrength, 0.5), 0, 1);

  // Deterministic jitter (0.95..1.05)
  const j = 0.95 + seededIndex(seed, tick + 17, 11) * 0.01;

  // Severity score: evidence makes it stick; low evidence reduces severity.
  const evidencePenalty = Math.round((1 - evidence) * 25);
  const severityScore = clamp(severity - evidencePenalty, 0, 100);

  // Drain percent increases with severityScore and worsens under pressure/regime.
  const basePct = clamp(0.02 + severityScore / 400, M147_LITIGATION_BOUNDS.MIN_DRAIN_PCT, M147_LITIGATION_BOUNDS.MAX_DRAIN_PCT);
  const scaledPct = clamp(basePct * (pressureWeight * phaseWeight) * clamp(regimeMultiplier, 0.6, 1.2) * j, 0, M147_LITIGATION_BOUNDS.MAX_DRAIN_PCT);

  // Claim anchor: smaller of (claim) and (cash*scaledPct), but allow a minimum “retainer hit” if claim exists.
  const pctDrain = Math.round(cashSafe * scaledPct);
  const retainerHit = claim > 0 ? clamp(Math.round(claim * 0.05), 0, M147_BOUNDS.MAX_AMOUNT) : 0;

  let drained = Math.max(pctDrain, retainerHit);

  // Bound + cannot drain more than cash.
  drained = clamp(drained, 0, Math.min(cashSafe, M147_BOUNDS.MAX_AMOUNT));

  // If severityScore is low, may resolve with no drain (deterministic gate).
  const gate = seededIndex(seed, tick + 147, 10); // 0..9
  if (severityScore < 35 && gate < 6) drained = 0;

  const factors = seededShuffle(
    [
      `kind=${trigger.kind}`,
      `severityScore=${severityScore}`,
      `evidence=${evidence.toFixed(2)}`,
      `regime=${regime}`,
      `pressure=${pressure}`,
      `phase=${phase}`,
      `scaledPct=${scaledPct.toFixed(3)}`,
    ],
    computeHash(seed + ':factors'),
  ).slice(0, 5);

  return { drained, severityScore, factors };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * litigationRiskShockEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function litigationRiskShockEngine(input: M147Input, emit: MechanicEmitter): M147Output {
  const cashBefore = Math.max(0, Math.floor(m147ToNumber(input.stateCash, 0)));

  const trigger = m147NormalizeTrigger(input.litigationTrigger);

  // Deterministic run seed: caller-provided or derived from input snapshot.
  const snapshotHash = computeHash(m147SafeStringify(input ?? {}));
  const runSeed = String(input.runSeed ?? '').trim();
  const seedRoot = runSeed || snapshotHash;

  // Deterministic tick: derived from seed (no runtime mutation input required).
  const tick = clamp(seededIndex(seedRoot, 147, RUN_TOTAL_TICKS), 0, RUN_TOTAL_TICKS - 1);

  const seed = computeHash(`M147:${seedRoot}:${tick}:${trigger.kind}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m147DerivePhase(tick);
  const pressure = m147DerivePressure(tick, phase, chaosWindows);
  const regime = m147DeriveRegime(tick, macroSchedule);

  const decayRate = computeDecayRate(regime, M147_BOUNDS.BASE_DECAY_RATE);

  const { featuredCard, featuredCardId } = m147PickFeaturedCard(seed, tick, pressure, phase, regime);

  const { drained, severityScore, factors } = m147ComputeDrain(seed, tick, cashBefore, trigger, regime, pressure, phase);

  const holdScope = m147HoldScope(trigger, severityScore);
  const legalHoldApplied = holdScope !== 'NONE';

  const holdUntilTick = m147ComputeHoldUntil(seed, tick, regime, holdScope);

  const cashAfter = clamp(cashBefore - drained, 0, M147_BOUNDS.MAX_PROCEEDS);

  const auditHash = computeHash(
    m147SafeStringify({
      v: 'M147/v1',
      seedRoot,
      seed,
      tick,
      trigger,
      severityScore,
      factors,
      phase,
      pressure,
      regime,
      decayRate,
      featuredCardId,
      cashBefore,
      drained,
      cashAfter,
      legalHoldApplied,
      holdScope,
      holdUntilTick,
      macroEvents: macroSchedule.length,
      chaosWindows: chaosWindows.length,
      defaultCard: DEFAULT_CARD.id,
      defaultIdsLen: DEFAULT_CARD_IDS.length,
      opportunityPoolLen: OPPORTUNITY_POOL.length,
    }),
  );

  const shockId = computeHash(`${seed}:shock:${tick}:${featuredCardId}`);

  const litigationShock: LitigationShock = {
    id: shockId,
    runId: snapshotHash,
    tick,

    trigger,

    phase,
    pressure,
    regime,

    macroSchedule,
    chaosWindows,

    featuredCardId,
    featuredCard,

    cashBefore,
    cashDrained: drained,
    cashAfter,

    legalHoldApplied,
    holdScope,
    holdUntilTick,

    auditHash,
  };

  emit({
    event: 'LITIGATION_TRIGGERED',
    mechanic_id: 'M147',
    tick,
    runId: snapshotHash,
    payload: {
      shockId,
      kind: trigger.kind,
      severity: trigger.severity ?? 0,
      severityScore,
      evidenceStrength: trigger.evidenceStrength ?? 0.5,
      claimAmount: trigger.claimAmount ?? 0,
      phase,
      pressure,
      regime,
      decayRate,
      featuredCardId,
      cashBefore,
      drained,
      cashAfter,
      factors,
      auditHash,
    },
  });

  if (legalHoldApplied) {
    emit({
      event: 'LEGAL_HOLD_APPLIED',
      mechanic_id: 'M147',
      tick,
      runId: snapshotHash,
      payload: {
        shockId,
        holdScope,
        holdUntilTick,
        regimePulse: EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0,
        featuredCardId,
        auditHash,
      },
    });
  }

  emit({
    event: 'CIVIL_SHOCK_RESOLVED',
    mechanic_id: 'M147',
    tick,
    runId: snapshotHash,
    payload: {
      shockId,
      resolvedWithDrain: drained > 0,
      drained,
      legalHoldApplied,
      holdScope,
      cashAfter,
      auditHash,
    },
  });

  return {
    litigationShock,
    cashDrained: drained,
    legalHoldApplied,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M147MLInput {
  litigationShock?: LitigationShock;
  cashDrained?: number;
  legalHoldApplied?: boolean;
  runId: string;
  tick: number;
}

export interface M147MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * litigationRiskShockEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function litigationRiskShockEngineMLCompanion(input: M147MLInput): Promise<M147MLOutput> {
  const shock = input.litigationShock;

  const drained = clamp(Math.floor(m147ToNumber(input.cashDrained, shock?.cashDrained ?? 0)), 0, M147_BOUNDS.MAX_AMOUNT);
  const hold = !!input.legalHoldApplied || !!shock?.legalHoldApplied;

  const sev = clamp(Math.floor(m147ToNumber(shock?.trigger?.severity, 25)), 0, 100);
  const ev = clamp(m147ToNumber(shock?.trigger?.evidenceStrength, 0.5), 0, 1);

  // Advisory score: combines drain magnitude, hold status, severity/evidence (bounded).
  const drainScore = clamp(drained / M147_BOUNDS.MAX_AMOUNT, 0, 1);
  const sevScore = clamp(sev / 100, 0, 1);
  const evidenceScore = clamp(ev, 0, 1);

  const score = clamp(0.10 + drainScore * 0.55 + (hold ? 0.20 : 0.0) + sevScore * 0.15 - (1 - evidenceScore) * 0.10, 0.01, 0.99);

  const topFactors: string[] = [];
  if (hold) topFactors.push('Legal hold active');
  if (drained > 0) topFactors.push(`Cash drained: ${drained}`);
  if (shock?.trigger?.kind) topFactors.push(`Trigger: ${shock.trigger.kind}`);
  topFactors.push(`Severity: ${sev}/100`);
  topFactors.push(`Evidence: ${evidenceScore.toFixed(2)}`);

  const recommendation =
    hold
      ? 'Reduce exposed actions, preserve documentation, and route every transaction through proof gates until hold clears.'
      : drained > 0
        ? 'Stabilize cashflow and avoid high-visibility moves; this shock is likely to recur under similar regimes.'
        : 'No drain triggered—monitor for repeated signals and pre-emptively strengthen proof artifacts.';

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation,
    auditHash: computeHash(m147SafeStringify(input) + ':ml:M147'),
    confidenceDecay: hold ? 0.08 : drained > 0 ? 0.06 : 0.04,
  };
}