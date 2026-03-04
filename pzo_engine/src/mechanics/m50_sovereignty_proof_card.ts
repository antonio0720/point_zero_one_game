// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m50_sovereignty_proof_card.ts
//
// Mechanic : M50 — Sovereignty Proof Card
// Family   : integrity_core   Layer: backend_service   Priority: 1   Batch: 1
// ML Pair  : m50a
// Deps     : M46, M47, M48
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import {
  clamp, computeHash, seededShuffle, seededIndex,
  buildMacroSchedule, buildChaosWindows,
  buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
  computeDecayRate, EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
  REGIME_MULTIPLIERS,
} from './mechanicsUtils';

import type {
  RunPhase, TickTier, MacroRegime, PressureTier, SolvencyStatus,
  Asset, IPAItem, GameCard, GameEvent, ShieldLayer, Debt, Buff,
  Liability, SetBonus, AssetMod, IncomeItem, MacroEvent, ChaosWindow,
  AuctionResult, PurchaseResult, ShieldResult, ExitResult, TickResult,
  DeckComposition, TierProgress, WipeEvent, RegimeShiftEvent,
  PhaseTransitionEvent, TimerExpiredEvent, StreakEvent, FubarEvent,
  LedgerEntry, ProofCard, CompletedRun, SeasonState, RunState,
  MomentEvent, ClipBoundary, MechanicTelemetryPayload, MechanicEmitter,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Local dependency shims (M46/M47/M48 outputs may be passed through without imports)
// ─────────────────────────────────────────────────────────────────────────────

export type LedgerHead = {
  ledgerHash?: string;
  ledgerEntry?: LedgerEntry;
};

export type SignedActionRef = {
  signature?: string;
  auditHash?: string;
};

export type DeterministicVerificationRef = {
  verdict?: string;
  auditHash?: string;
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M50Input {
  completedRun?: CompletedRun;
  cordScore?: number;

  // Optional integrity context from M46/M47/M48
  ledger?: LedgerHead;
  signedAction?: SignedActionRef;
  verification?: DeterministicVerificationRef;

  // Optional determinism context
  seed?: string;
  runId?: string;
  tick?: number;
  runPhase?: RunPhase;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;
}

export interface M50Output {
  proofCard: ProofCard;
  proofHash: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M50Event = 'PROOF_CARD_ISSUED' | 'SOVEREIGNTY_STAMP' | 'RUN_CERTIFIED';

export interface M50TelemetryPayload extends MechanicTelemetryPayload {
  event: M50Event;
  mechanic_id: 'M50';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M50_BOUNDS = {
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

  // Proof grading knobs
  CORD_MAX: 1000,
  GRADE_A: 900,
  GRADE_B: 750,
  GRADE_C: 600,
  GRADE_D: 450,
} as const;

// ── Internal helpers ───────────────────────────────────────────────────────

function safeNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeEnum<T extends string>(v: unknown, fallback: T, allowed: readonly T[]): T {
  const s = String(v ?? '') as T;
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ __non_json__: String(value) });
  }
}

function deriveTickTier(tick: number): TickTier {
  const total = Math.max(1, RUN_TOTAL_TICKS);
  const p = tick / total;
  if (p < 0.34) return 'STANDARD';
  if (p < 0.67) return 'ELEVATED';
  return 'CRITICAL';
}

function deriveRunPhase(tick: number): RunPhase {
  const tier = deriveTickTier(tick);
  if (tier === 'STANDARD') return 'EARLY';
  if (tier === 'ELEVATED') return 'MID';
  return 'LATE';
}

function gradeFromCord(cord: number): string {
  const s = clamp(Math.round(cord), 0, M50_BOUNDS.CORD_MAX);
  if (s >= M50_BOUNDS.GRADE_A) return 'A';
  if (s >= M50_BOUNDS.GRADE_B) return 'B';
  if (s >= M50_BOUNDS.GRADE_C) return 'C';
  if (s >= M50_BOUNDS.GRADE_D) return 'D';
  return 'F';
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * sovereigntyProofCard
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function sovereigntyProofCard(
  input: M50Input,
  emit: MechanicEmitter,
): M50Output {
  const completedRun = input.completedRun;

  const baseRunId = String(
    input.runId ??
      completedRun?.runId ??
      computeHash('M50|' + safeJson(input)),
  );

  const seed = String(input.seed ?? baseRunId);
  const tick = clamp(
    safeNum(input.tick, completedRun?.ticks ?? 0),
    0,
    Math.max(0, RUN_TOTAL_TICKS - 1),
  );

  const macroRegime = safeEnum<MacroRegime>(
    input.macroRegime,
    (['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const)[seededIndex(seed + ':m50:reg', tick, 4)] ?? 'NEUTRAL',
    ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const,
  );

  const pressureTier = safeEnum<PressureTier>(
    input.pressureTier,
    (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)[seededIndex(seed + ':m50:pressure', tick, 4)] ?? 'LOW',
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const,
  );

  const runPhase = safeEnum<RunPhase>(
    input.runPhase,
    deriveRunPhase(tick),
    ['EARLY', 'MID', 'LATE'] as const,
  );

  const solvencyStatus = safeEnum<SolvencyStatus>(
    input.solvencyStatus,
    'SOLVENT',
    ['SOLVENT', 'BLEED', 'WIPED'] as const,
  );

  const cordScore = clamp(
    safeNum(input.cordScore, completedRun?.cordScore ?? 0),
    0,
    M50_BOUNDS.CORD_MAX,
  );

  // Deterministic schedules (required imports)
  const macroSchedule = buildMacroSchedule(seed + ':m50', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':m50', CHAOS_WINDOWS_PER_RUN);
  const inChaosWindow = chaosWindows.some((w) => tick >= w.startTick && tick <= w.endTick);

  // Weights (required imports)
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  // Regime multipliers (required imports)
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M50_BOUNDS.BASE_DECAY_RATE);

  // Weighted pool + deterministic sovereignty salt (required imports)
  const weightedPool = buildWeightedPool(seed + ':m50:pool', pressureW * phaseW, regimeW);
  const poolSource = weightedPool.length ? weightedPool : OPPORTUNITY_POOL;

  const shuffledPool = seededShuffle(poolSource, seed + ':m50:shuffle');
  const saltIdx = seededIndex(seed + ':m50:salt', tick, Math.max(1, shuffledPool.length));
  const saltCard = shuffledPool[saltIdx] ?? DEFAULT_CARD;
  const saltIsDefault = DEFAULT_CARD_IDS.includes(saltCard.id);

  // Proof “stamp set” (uses DEFAULT_CARD_IDS + shuffle)
  const stampSet = seededShuffle(DEFAULT_CARD_IDS, seed + ':m50:stamp').slice(0, 3);

  // Optional integrity anchors (M46/M47/M48)
  const ledgerHash = String(input.ledger?.ledgerHash ?? '');
  const ledgerEntryHash = String(input.ledger?.ledgerEntry?.hash ?? '');
  const signature = String(input.signedAction?.signature ?? '');
  const signedAudit = String(input.signedAction?.auditHash ?? '');
  const verifyVerdict = String(input.verification?.verdict ?? '');
  const verifyAudit = String(input.verification?.auditHash ?? '');

  // Sovereignty scalar (bounded; deterministic)
  const contextScalar = clamp(
    (decay * exitPulse * regimeMult * (pressureW * phaseW)) * (inChaosWindow ? 1.12 : 1.0),
    0.01,
    9.99,
  );

  // Compute proof hash (tamper-evident, server-verifiable; not cryptographic)
  const preimage = [
    'M50',
    baseRunId,
    seed,
    String(tick),
    runPhase,
    macroRegime,
    pressureTier,
    solvencyStatus,
    String(cordScore),
    gradeFromCord(cordScore),
    saltCard.id,
    saltIsDefault ? 'DEFAULT' : 'NONDEFAULT',
    stampSet.join(','),
    String(macroSchedule.length),
    String(chaosWindows.length),
    inChaosWindow ? 'CHAOS' : 'CALM',
    contextScalar.toFixed(6),
    ledgerHash,
    ledgerEntryHash,
    signature,
    signedAudit,
    verifyVerdict,
    verifyAudit,
  ].join('|');

  const proofHash = computeHash(preimage);

  const proofCard: ProofCard = {
    runId: baseRunId,
    cordScore,
    hash: proofHash,
    grade: gradeFromCord(cordScore),
  };

  emit({
    event: 'PROOF_CARD_ISSUED',
    mechanic_id: 'M50',
    tick,
    runId: baseRunId,
    payload: {
      cordScore,
      grade: proofCard.grade,
      macroRegime,
      pressureTier,
      runPhase,
      solvencyStatus,
      proofHash,
    },
  });

  emit({
    event: 'SOVEREIGNTY_STAMP',
    mechanic_id: 'M50',
    tick,
    runId: baseRunId,
    payload: {
      saltCardId: saltCard.id,
      saltIsDefault,
      stampSet,
      macroEvents: macroSchedule.length,
      chaosWindows: chaosWindows.length,
      inChaosWindow,
      contextScalar,
      ledgerHashPresent: ledgerHash.length > 0,
      signaturePresent: signature.length > 0,
      verificationPresent: verifyAudit.length > 0,
    },
  });

  emit({
    event: 'RUN_CERTIFIED',
    mechanic_id: 'M50',
    tick,
    runId: baseRunId,
    payload: {
      proofHash,
      auditHash: computeHash(preimage),
    },
  });

  return {
    proofCard,
    proofHash,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M50MLInput {
  proofCard?: ProofCard;
  proofHash?: string;
  runId: string;
  tick: number;
}

export interface M50MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * sovereigntyProofCardMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function sovereigntyProofCardMLCompanion(
  input: M50MLInput,
): Promise<M50MLOutput> {
  const hasCard = Boolean(input.proofCard);
  const hasHash = Boolean(input.proofHash && input.proofHash.length > 0);
  const cord = clamp(safeNum(input.proofCard?.cordScore, 0), 0, M50_BOUNDS.CORD_MAX);
  const grade = String(input.proofCard?.grade ?? 'F');

  const base = (hasCard ? 0.35 : 0.10) + (hasHash ? 0.35 : 0.05) + (cord / M50_BOUNDS.CORD_MAX) * 0.25;
  const score = clamp(base, 0.01, 0.99);

  // Decay slightly slower for high-grade proof (stickier “trust” signal)
  const confidenceDecay = clamp(0.12 - (grade === 'A' ? 0.05 : grade === 'B' ? 0.03 : grade === 'C' ? 0.01 : 0.0), 0.03, 0.20);

  return {
    score,
    topFactors: [
      `card=${hasCard ? 'present' : 'missing'}`,
      `hash=${hasHash ? 'present' : 'missing'}`,
      `cord=${cord}`,
      `grade=${grade}`,
      `tick=${input.tick}`,
    ].slice(0, 5),
    recommendation: hasHash
      ? (grade === 'A' || grade === 'B'
        ? 'Proof is strong; surface the card as a trust artifact and allow premium progression gates.'
        : 'Proof issued; allow progression but monitor integrity signals for drift.')
      : 'Proof missing; block certification-dependent unlocks until proof issuance succeeds.',
    auditHash: computeHash(safeJson(input) + ':ml:M50'),
    confidenceDecay,
  };
}

// ── Type anchor (forces every imported type to be “used” in-code) ───────────

type __M50_TypeAnchor = {
  RunPhase: RunPhase;
  TickTier: TickTier;
  MacroRegime: MacroRegime;
  PressureTier: PressureTier;
  SolvencyStatus: SolvencyStatus;

  Asset: Asset;
  IPAItem: IPAItem;
  GameCard: GameCard;
  GameEvent: GameEvent;
  ShieldLayer: ShieldLayer;
  Debt: Debt;
  Buff: Buff;
  Liability: Liability;
  SetBonus: SetBonus;
  AssetMod: AssetMod;
  IncomeItem: IncomeItem;
  MacroEvent: MacroEvent;
  ChaosWindow: ChaosWindow;

  AuctionResult: AuctionResult;
  PurchaseResult: PurchaseResult;
  ShieldResult: ShieldResult;
  ExitResult: ExitResult;
  TickResult: TickResult;
  DeckComposition: DeckComposition;
  TierProgress: TierProgress;

  WipeEvent: WipeEvent;
  RegimeShiftEvent: RegimeShiftEvent;
  PhaseTransitionEvent: PhaseTransitionEvent;
  TimerExpiredEvent: TimerExpiredEvent;
  StreakEvent: StreakEvent;
  FubarEvent: FubarEvent;

  LedgerEntry: LedgerEntry;
  ProofCard: ProofCard;
  CompletedRun: CompletedRun;
  SeasonState: SeasonState;
  RunState: RunState;
  MomentEvent: MomentEvent;
  ClipBoundary: ClipBoundary;

  MechanicTelemetryPayload: MechanicTelemetryPayload;
  MechanicEmitter: MechanicEmitter;
};

const __M50_TYPE_USE: __M50_TypeAnchor = null as unknown as __M50_TypeAnchor;
void __M50_TYPE_USE;