// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m47_action_signing.ts
//
// Mechanic : M47 — Action Signing
// Family   : integrity_core   Layer: backend_service   Priority: 1   Batch: 1
// ML Pair  : m47a
// Deps     : none
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
// Local Types (kept local to avoid widening shared types unless you want it)
// ─────────────────────────────────────────────────────────────────────────────

export type ActionSignatureAlgo = 'PZO_HASH_V1';

export interface SignedAction {
  algo: ActionSignatureAlgo;

  runId: string;
  tick: number;

  // canonical action
  action: unknown;
  actionHash: string;

  // signature (tamper-evident, NOT cryptographic)
  signature: string;

  // redacted session material
  sessionTokenHash: string;

  // deterministic salts
  nonce: number;
  saltCardId: string;
  saltIsDefault: boolean;

  // context included in preimage (stabilizes verification)
  tickTier: TickTier;
  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  solvencyStatus: SolvencyStatus;

  // audit helpers
  inChaosWindow: boolean;
  macroEvents: number;
  chaosWindows: number;

  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M47Input {
  clientAction?: unknown;
  sessionToken?: string;

  // Optional context (safe defaults if omitted)
  runId?: string;         // preferred stable run id
  runSeed?: string;       // deterministic fallback if runId not supplied
  tick?: number;
  runPhase?: RunPhase;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;

  // Optional chain anchors (kept for compatibility with M46)
  previousLedgerHash?: string;
  sequenceWithinTick?: number;
}

export interface M47Output {
  signedAction: SignedAction;
  integrityVerified: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M47Event = 'ACTION_SIGNED' | 'INTEGRITY_VERIFIED' | 'SIGNATURE_INVALID';

export interface M47TelemetryPayload extends MechanicTelemetryPayload {
  event: M47Event;
  mechanic_id: 'M47';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M47_BOUNDS = {
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

  // Signing-specific (bounded)
  MIN_SESSION_TOKEN_LEN: 8,
  NONCE_MODULUS: 10_000,
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

function safeJsonStringify(value: unknown): string {
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

function computeSignature(preimage: string, sessionTokenHash: string): string {
  // Deterministic, tamper-evident; NOT cryptographic.
  return computeHash(preimage + '|' + sessionTokenHash);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * actionSigningEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function actionSigningEngine(
  input: M47Input,
  emit: MechanicEmitter,
): M47Output {
  const tick = clamp(safeNum(input.tick, 0), 0, Math.max(0, RUN_TOTAL_TICKS - 1));
  const tickTier = deriveTickTier(tick);

  const runPhase = safeEnum<RunPhase>(input.runPhase, 'EARLY', ['EARLY', 'MID', 'LATE'] as const);
  const macroRegime = safeEnum<MacroRegime>(input.macroRegime, 'NEUTRAL', ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const);
  const pressureTier = safeEnum<PressureTier>(input.pressureTier, 'LOW', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const);
  const solvencyStatus = safeEnum<SolvencyStatus>(input.solvencyStatus, 'SOLVENT', ['SOLVENT', 'BLEED', 'WIPED'] as const);

  const clientAction = (typeof input.clientAction === 'undefined') ? null : input.clientAction;
  const actionJson = safeJsonStringify(clientAction);
  const actionHash = computeHash(actionJson);

  const sessionToken = String(input.sessionToken ?? '');
  const sessionTokenHash = computeHash(sessionToken);

  const previousLedgerHash = String(input.previousLedgerHash ?? 'GENESIS');
  const sequenceWithinTick = clamp(safeNum(input.sequenceWithinTick, 0), 0, 9_999);

  // Stable run id derivation
  const serviceHash = computeHash(
    safeJsonStringify({
      tick, tickTier, runPhase, macroRegime, pressureTier, solvencyStatus,
      actionHash,
      previousLedgerHash,
      sequenceWithinTick,
    }),
  );
  const runId = String(input.runId ?? input.runSeed ?? serviceHash);

  // Deterministic macro/chaos schedules
  const macroSchedule = buildMacroSchedule(runId + ':m47', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(runId + ':m47', CHAOS_WINDOWS_PER_RUN);
  const inChaosWindow = chaosWindows.some((w) => tick >= w.startTick && tick <= w.endTick);

  // Use weights/constants deterministically (required imports)
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M47_BOUNDS.BASE_DECAY_RATE);

  // Weighted pool + deterministic card salt
  const weightedPool = buildWeightedPool(runId + ':m47:pool', pressureWeight * phaseWeight, regimeWeight);
  const poolSource = (weightedPool.length ? weightedPool : OPPORTUNITY_POOL);
  const shuffled = seededShuffle(poolSource, runId + ':m47:shuffle');

  const pickIdx = seededIndex(runId + ':m47:pick', tick, Math.max(1, shuffled.length));
  const saltCard = shuffled[pickIdx] ?? DEFAULT_CARD;
  const saltIsDefault = DEFAULT_CARD_IDS.includes(saltCard.id);

  // Deterministic nonce
  const nonceSeed = [
    runId,
    sessionTokenHash,
    actionHash,
    tick.toString(10),
    previousLedgerHash,
    sequenceWithinTick.toString(10),
    saltCard.id,
  ].join('|');
  const nonce = seededIndex(nonceSeed, tick, M47_BOUNDS.NONCE_MODULUS);

  // Preimage for signature (includes macro knobs for stable verification)
  const contextRisk = clamp(
    Math.round((decay * exitPulse * regimeMultiplier) * 10_000),
    M47_BOUNDS.MIN_EFFECT,
    M47_BOUNDS.MAX_EFFECT,
  );

  const preimage = [
    'M47',
    'PZO_HASH_V1',
    runId,
    previousLedgerHash,
    tick.toString(10),
    sequenceWithinTick.toString(10),
    tickTier,
    runPhase,
    macroRegime,
    pressureTier,
    solvencyStatus,
    inChaosWindow ? 'CHAOS' : 'CALM',
    saltCard.id,
    saltIsDefault ? 'DEFAULT' : 'NONDEFAULT',
    nonce.toString(10),
    contextRisk.toString(10),
    actionHash,
  ].join('|');

  const signature = computeSignature(preimage, sessionTokenHash);

  const tokenSane = sessionToken.length >= M47_BOUNDS.MIN_SESSION_TOKEN_LEN;
  const integrityVerified = tokenSane && (computeSignature(preimage, sessionTokenHash) === signature);

  const signedAction: SignedAction = {
    algo: 'PZO_HASH_V1',
    runId,
    tick,

    action: clientAction,
    actionHash,

    signature,
    sessionTokenHash,

    nonce,
    saltCardId: saltCard.id,
    saltIsDefault,

    tickTier,
    runPhase,
    macroRegime,
    pressureTier,
    solvencyStatus,

    inChaosWindow,
    macroEvents: macroSchedule.length,
    chaosWindows: chaosWindows.length,

    auditHash: computeHash(preimage),
  };

  emit({
    event: 'ACTION_SIGNED',
    mechanic_id: 'M47',
    tick,
    runId,
    payload: {
      actionHash,
      sessionTokenHash,
      nonce,
      previousLedgerHash,
      sequenceWithinTick,
      saltCardId: saltCard.id,
      saltIsDefault,
      tickTier,
      runPhase,
      macroRegime,
      pressureTier,
      solvencyStatus,
      inChaosWindow,
      macroEvents: macroSchedule.length,
      chaosWindows: chaosWindows.length,
      decay,
      exitPulse,
      regimeMultiplier,
    },
  });

  emit({
    event: integrityVerified ? 'INTEGRITY_VERIFIED' : 'SIGNATURE_INVALID',
    mechanic_id: 'M47',
    tick,
    runId,
    payload: {
      integrityVerified,
      tokenSane,
      signature,
      auditHash: signedAction.auditHash,
    },
  });

  return {
    signedAction,
    integrityVerified,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M47MLInput {
  signedAction?: SignedAction;
  integrityVerified?: boolean;
  runId: string;
  tick: number;
}

export interface M47MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * actionSigningEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function actionSigningEngineMLCompanion(
  input: M47MLInput,
): Promise<M47MLOutput> {
  const verified = Boolean(input.integrityVerified);
  const hasSigned = Boolean(input.signedAction);

  const raw = (hasSigned ? 0.35 : 0.10) + (verified ? 0.45 : 0.05) + (Math.min(20, Object.keys(input).length) * 0.01);
  const score = clamp(raw, 0.01, 0.99);

  // Use macro-sensitive decay if present (keeps import usage aligned with system knobs)
  const regime = safeEnum<MacroRegime>(
    (input.signedAction?.macroRegime ?? 'NEUTRAL'),
    'NEUTRAL',
    ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const,
  );
  const confidenceDecay = computeDecayRate(regime, 0.08);

  return {
    score,
    topFactors: [
      `signed=${hasSigned}`,
      `verified=${verified}`,
      `tick=${input.tick}`,
      `regime=${regime}`,
    ].slice(0, 5),
    recommendation: verified
      ? 'Action signature verified; proceed to ledger append and enforce server-side replay determinism.'
      : 'Signature invalid; reject action and require session re-auth before accepting any state mutation.',
    auditHash: computeHash(safeJsonStringify(input) + ':ml:M47'),
    confidenceDecay,
  };
}

// ── Type anchor (forces every imported type to be “used” in-code) ───────────

type __M47_TypeAnchor = {
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

const __M47_TYPE_USE: __M47_TypeAnchor = null as unknown as __M47_TypeAnchor;
void __M47_TYPE_USE;