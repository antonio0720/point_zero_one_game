// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m48_deterministic_validator.ts
//
// Mechanic : M48 — Deterministic Validator
// Family   : integrity_core   Layer: backend_service   Priority: 1   Batch: 1
// ML Pair  : m48a
// Deps     : M01, M46
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

// ── Local Types (kept local so you don’t have to expand ./types unless desired) ──

export type VerificationVerdict = 'VERIFIED' | 'MISMATCH' | 'TAMPERED' | 'INCOMPLETE';

export interface ReplayMismatch {
  field: 'deckShuffle' | 'macroSchedule' | 'chaosWindows' | 'ledger';
  expectedHash: string;
  actualHash: string;
  details?: Record<string, unknown>;
}

export interface ReplayResult {
  runId: string;
  seed: string;

  expectedDeckShuffle: string[];
  expectedMacroSchedule: MacroEvent[];
  expectedChaosWindows: ChaosWindow[];

  providedDeckShuffle?: string[];
  providedMacroSchedule?: MacroEvent[];
  providedChaosWindows?: ChaosWindow[];

  weightedPool: GameCard[];
  saltCard: GameCard;

  ledgerHeadHash?: string;
  ledgerVerifiedEntries?: number;
  ledgerInvalidEntries?: number;

  mismatches: ReplayMismatch[];
  auditHash: string;
}

export interface VerificationStatus {
  verdict: VerificationVerdict;
  verified: boolean;
  mismatchCount: number;
  reasons: string[];
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M48Input {
  runId?: string;
  seed?: string;

  // Optional “client-provided” expectations to verify against the seed.
  clientDeckShuffle?: string[];
  clientMacroSchedule?: MacroEvent[];
  clientChaosWindows?: ChaosWindow[];

  // Optional ledger verification (M46 dependency)
  previousLedgerHash?: string;
  ledgerEntries?: LedgerEntry[];

  // Optional context (used for deterministic weighting / risk knobs)
  runPhase?: RunPhase;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
}

export interface M48Output {
  replayResult: ReplayResult;
  verificationStatus: VerificationStatus;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M48Event = 'REPLAY_STARTED' | 'REPLAY_VERIFIED' | 'REPLAY_MISMATCH' | 'REPLAY_TAMPERED';

export interface M48TelemetryPayload extends MechanicTelemetryPayload {
  event: M48Event;
  mechanic_id: 'M48';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M48_BOUNDS = {
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

  // Integrity / comparison knobs
  MAX_REASONS: 8,
} as const;

// ── Internal helpers ───────────────────────────────────────────────────────

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ __non_json__: String(value) });
  }
}

function digest(value: unknown): string {
  return computeHash(safeJson(value));
}

function safeEnum<T extends string>(v: unknown, fallback: T, allowed: readonly T[]): T {
  const s = String(v ?? '') as T;
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function deriveTickTier(tick: number): TickTier {
  const total = Math.max(1, RUN_TOTAL_TICKS);
  const p = tick / total;
  if (p < 0.34) return 'STANDARD';
  if (p < 0.67) return 'ELEVATED';
  return 'CRITICAL';
}

function verifyLedgerChain(
  seed: string,
  previousLedgerHash: string,
  entries: LedgerEntry[],
): { headHash: string; verified: number; invalid: number } {
  let prev = previousLedgerHash;
  let verified = 0;
  let invalid = 0;

  // deterministic “salt” included in chain to keep the chain bound to run seed
  const saltTick = seededIndex(seed + ':m48:ledger', 0, Math.max(1, RUN_TOTAL_TICKS));
  const saltTier = deriveTickTier(saltTick);
  const salt = computeHash(seed + '|' + saltTick + '|' + saltTier);

  prev = computeHash(prev + '|SALT|' + salt);

  for (const e of entries) {
    const actionHash = computeHash(safeJson(e.gameAction));
    const expectedEntryHash = computeHash(prev + '|' + String(e.tick) + '|' + actionHash);

    if (e.hash !== expectedEntryHash) invalid += 1;
    else verified += 1;

    prev = expectedEntryHash;
  }

  return { headHash: prev, verified, invalid };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * deterministicValidator
 *
 * Called by backend_service layer to verify deterministic replay artifacts.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function deterministicValidator(
  input: M48Input,
  emit: MechanicEmitter,
): M48Output {
  const seed = String(input.seed ?? '');
  const serviceHash = computeHash(safeJson(input));
  const runId = String(input.runId ?? (seed ? computeHash(seed + ':m48') : serviceHash));

  // Required imports MUST be used (deterministic knobs)
  const runPhase = safeEnum<RunPhase>(input.runPhase, 'EARLY', ['EARLY', 'MID', 'LATE'] as const);
  const macroRegime = safeEnum<MacroRegime>(input.macroRegime, 'NEUTRAL', ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const);
  const pressureTier = safeEnum<PressureTier>(input.pressureTier, 'LOW', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const);

  const tick0 = clamp(seededIndex(runId + ':m48:tick', 0, Math.max(1, RUN_TOTAL_TICKS)), 0, Math.max(0, RUN_TOTAL_TICKS - 1));
  const tickTier0 = deriveTickTier(tick0);

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(runId + ':m48:pool', pressureW * phaseW, regimeW);
  const poolSource = weightedPool.length ? weightedPool : OPPORTUNITY_POOL;

  const shuffledPool = seededShuffle(poolSource, runId + ':m48:shuffle');
  const saltIdx = seededIndex(runId + ':m48:salt', tick0, Math.max(1, shuffledPool.length));
  const saltCard = shuffledPool[saltIdx] ?? DEFAULT_CARD;

  const expectedDeckShuffle = seededShuffle(DEFAULT_CARD_IDS, seed || runId);
  const expectedMacroSchedule = buildMacroSchedule(seed || runId, MACRO_EVENTS_PER_RUN);
  const expectedChaosWindows = buildChaosWindows(seed || runId, CHAOS_WINDOWS_PER_RUN);

  // Deterministic risk knobs (uses REGIME_MULTIPLIERS + EXIT_PULSE_MULTIPLIERS + computeDecayRate)
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M48_BOUNDS.BASE_DECAY_RATE);
  const riskScalar = clamp(decay * regimeMult * exitPulse * (pressureW * phaseW), 0.01, 9.99);

  emit({
    event: 'REPLAY_STARTED',
    mechanic_id: 'M48',
    tick: tick0,
    runId,
    payload: {
      seed,
      runPhase,
      macroRegime,
      pressureTier,
      tickTier0,
      saltCardId: saltCard.id,
      riskScalar,
      deckCount: expectedDeckShuffle.length,
      macroEvents: expectedMacroSchedule.length,
      chaosWindows: expectedChaosWindows.length,
    },
  });

  const mismatches: ReplayMismatch[] = [];

  const expectedDeckHash = digest(expectedDeckShuffle);
  const expectedMacroHash = digest(expectedMacroSchedule);
  const expectedChaosHash = digest(expectedChaosWindows);

  const providedDeckShuffle = input.clientDeckShuffle;
  const providedMacroSchedule = input.clientMacroSchedule;
  const providedChaosWindows = input.clientChaosWindows;

  if (providedDeckShuffle) {
    const actual = digest(providedDeckShuffle);
    if (actual !== expectedDeckHash) {
      mismatches.push({
        field: 'deckShuffle',
        expectedHash: expectedDeckHash,
        actualHash: actual,
        details: { expectedLen: expectedDeckShuffle.length, actualLen: providedDeckShuffle.length },
      });
    }
  }

  if (providedMacroSchedule) {
    const actual = digest(providedMacroSchedule);
    if (actual !== expectedMacroHash) {
      mismatches.push({
        field: 'macroSchedule',
        expectedHash: expectedMacroHash,
        actualHash: actual,
        details: { expectedLen: expectedMacroSchedule.length, actualLen: providedMacroSchedule.length },
      });
    }
  }

  if (providedChaosWindows) {
    const actual = digest(providedChaosWindows);
    if (actual !== expectedChaosHash) {
      mismatches.push({
        field: 'chaosWindows',
        expectedHash: expectedChaosHash,
        actualHash: actual,
        details: { expectedLen: expectedChaosWindows.length, actualLen: providedChaosWindows.length },
      });
    }
  }

  const prevLedger = String(input.previousLedgerHash ?? 'GENESIS');
  const ledgerEntries = input.ledgerEntries ?? [];
  const ledgerCheck = ledgerEntries.length
    ? verifyLedgerChain(seed || runId, prevLedger, ledgerEntries)
    : null;

  if (ledgerCheck && ledgerCheck.invalid > 0) {
    mismatches.push({
      field: 'ledger',
      expectedHash: '0'.repeat(8),
      actualHash: computeHash(String(ledgerCheck.invalid)),
      details: { invalid: ledgerCheck.invalid, verified: ledgerCheck.verified },
    });
  }

  const reasons: string[] = [];
  if (!seed && !input.runId) reasons.push('Missing seed/runId: cannot bind verification to a deterministic identity.');
  if (mismatches.some(m => m.field === 'deckShuffle')) reasons.push('Deck shuffle mismatch vs seed.');
  if (mismatches.some(m => m.field === 'macroSchedule')) reasons.push('Macro schedule mismatch vs seed.');
  if (mismatches.some(m => m.field === 'chaosWindows')) reasons.push('Chaos windows mismatch vs seed.');
  if (ledgerCheck && ledgerCheck.invalid > 0) reasons.push('Ledger entry hash mismatch (tamper suspected).');

  const cappedReasons = reasons.slice(0, M48_BOUNDS.MAX_REASONS);

  let verdict: VerificationVerdict = 'VERIFIED';
  if (!seed && !input.runId) verdict = 'INCOMPLETE';
  else if (ledgerCheck && ledgerCheck.invalid > 0) verdict = 'TAMPERED';
  else if (mismatches.length > 0) verdict = 'MISMATCH';

  const verified = verdict === 'VERIFIED';

  const replayResult: ReplayResult = {
    runId,
    seed,

    expectedDeckShuffle,
    expectedMacroSchedule,
    expectedChaosWindows,

    providedDeckShuffle,
    providedMacroSchedule,
    providedChaosWindows,

    weightedPool: poolSource,
    saltCard,

    ledgerHeadHash: ledgerCheck?.headHash,
    ledgerVerifiedEntries: ledgerCheck?.verified,
    ledgerInvalidEntries: ledgerCheck?.invalid,

    mismatches,

    auditHash: computeHash(
      [
        'M48',
        runId,
        seed,
        expectedDeckHash,
        expectedMacroHash,
        expectedChaosHash,
        digest(poolSource.map(c => c.id)),
        saltCard.id,
        String(tick0),
        tickTier0,
        runPhase,
        macroRegime,
        pressureTier,
        String(riskScalar),
        String(ledgerCheck?.headHash ?? ''),
        String(ledgerCheck?.invalid ?? 0),
      ].join('|'),
    ),
  };

  const verificationStatus: VerificationStatus = {
    verdict,
    verified,
    mismatchCount: mismatches.length,
    reasons: cappedReasons,
    auditHash: replayResult.auditHash,
  };

  emit({
    event: verified ? 'REPLAY_VERIFIED' : (verdict === 'TAMPERED' ? 'REPLAY_TAMPERED' : 'REPLAY_MISMATCH'),
    mechanic_id: 'M48',
    tick: tick0,
    runId,
    payload: {
      verdict,
      verified,
      mismatchCount: mismatches.length,
      reasons: cappedReasons,
      auditHash: replayResult.auditHash,
      saltCardId: saltCard.id,
      ledgerInvalid: ledgerCheck?.invalid ?? 0,
      ledgerVerified: ledgerCheck?.verified ?? 0,
    },
  });

  return { replayResult, verificationStatus };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M48MLInput {
  replayResult?: ReplayResult;
  verificationStatus?: VerificationStatus;
  runId: string;
  tick: number;
}

export interface M48MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * deterministicValidatorMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function deterministicValidatorMLCompanion(
  input: M48MLInput,
): Promise<M48MLOutput> {
  const verdict = input.verificationStatus?.verdict ?? 'INCOMPLETE';
  const mismatchCount = input.verificationStatus?.mismatchCount ?? 0;

  const base =
    verdict === 'VERIFIED' ? 0.92 :
    verdict === 'MISMATCH' ? 0.55 :
    verdict === 'TAMPERED' ? 0.15 :
    0.25;

  const score = clamp(base - Math.min(0.40, mismatchCount * 0.05), 0.01, 0.99);

  // Regime-aware decay keeps signal responsive in CRISIS conditions
  const regime = safeEnum<MacroRegime>(
    (input.replayResult?.expectedMacroSchedule?.[0]?.regimeChange ?? 'NEUTRAL'),
    'NEUTRAL',
    ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const,
  );
  const confidenceDecay = computeDecayRate(regime, 0.08);

  return {
    score,
    topFactors: [
      `verdict=${verdict}`,
      `mismatches=${mismatchCount}`,
      `tick=${input.tick}`,
      `regime=${regime}`,
    ].slice(0, 5),
    recommendation:
      verdict === 'VERIFIED'
        ? 'Replay verified; accept run artifacts and continue settlement.'
        : verdict === 'TAMPERED'
          ? 'Tamper suspected; quarantine run and require server-side re-sim + enforcement.'
          : verdict === 'MISMATCH'
            ? 'Replay mismatch; re-simulate server-side and reconcile client artifacts.'
            : 'Insufficient identity inputs; require seed/runId to validate determinism.',
    auditHash: computeHash(safeJson(input) + ':ml:M48'),
    confidenceDecay,
  };
}

// ── Type anchor (forces every imported type to be “used” in-code) ───────────

type __M48_TypeAnchor = {
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

const __M48_TYPE_USE: __M48_TypeAnchor = null as unknown as __M48_TypeAnchor;
void __M48_TYPE_USE;