// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m30_defection_sequence.ts
//
// Mechanic : M30 — Defection Sequence
// Family   : coop_contracts   Layer: api_endpoint   Priority: 1   Batch: 1
// ML Pair  : m30a
// Deps     : M26, M27
//
// Design Laws:
//   ✦ Deterministic-by-seed  ✦ Server-verified via ledger
//   ✦ Bounded chaos          ✦ No pay-to-win

import { clamp, computeHash, seededShuffle, seededIndex,
  buildMacroSchedule, buildChaosWindows,
  buildWeightedPool, OPPORTUNITY_POOL, DEFAULT_CARD, DEFAULT_CARD_IDS,
  computeDecayRate, EXIT_PULSE_MULTIPLIERS,
  MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS,
  PRESSURE_WEIGHTS, PHASE_WEIGHTS, REGIME_WEIGHTS,
  REGIME_MULTIPLIERS } from './mechanicsUtils';

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

// ── M30 domain types (local) ───────────────────────────────────────────────

export interface DefectionTrigger {
  participants?: string[];          // contract members (ids)
  reportedDefectorId?: string;      // optional: if caller already knows who defected
  breachCount?: number;             // number of betrayals / violations observed
  treasuryBalance?: number;         // current contract treasury (dollars)
  riskScore?: number;               // 0..1, external risk model / heuristics
  note?: string;                    // human-readable context (optional)
}

export interface DefectionEvent {
  contractId: string;
  tick: number;

  defectorId: string | null;
  flagged: boolean;

  runPhase: RunPhase;
  tickTier: TickTier;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  solvencyStatus: SolvencyStatus;

  severity: number;                // 0..1
  drainedAmount: number;           // dollars drained from treasury
  penaltyApplied: number;          // additional penalty (dollars)
  treasuryBalanceAfter: number;    // dollars after drain

  evidenceCard: GameCard;          // deterministic “evidence/opportunity” artifact
  auditHash: string;               // deterministic audit hash
}

// ── Type touchpad (keeps the full shared types import “used” under strict TS) ──
export interface M30TypeTouchpad {
  runPhase?: RunPhase;
  tickTier?: TickTier;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;

  asset?: Asset;
  ipaItem?: IPAItem;
  gameCard?: GameCard;
  gameEvent?: GameEvent;
  shieldLayer?: ShieldLayer;
  debt?: Debt;
  buff?: Buff;
  liability?: Liability;
  setBonus?: SetBonus;
  assetMod?: AssetMod;
  incomeItem?: IncomeItem;
  macroEvent?: MacroEvent;
  chaosWindow?: ChaosWindow;

  auctionResult?: AuctionResult;
  purchaseResult?: PurchaseResult;
  shieldResult?: ShieldResult;
  exitResult?: ExitResult;
  tickResult?: TickResult;

  deckComposition?: DeckComposition;
  tierProgress?: TierProgress;
  wipeEvent?: WipeEvent;
  regimeShiftEvent?: RegimeShiftEvent;
  phaseTransitionEvent?: PhaseTransitionEvent;
  timerExpiredEvent?: TimerExpiredEvent;
  streakEvent?: StreakEvent;
  fubarEvent?: FubarEvent;

  ledgerEntry?: LedgerEntry;
  proofCard?: ProofCard;
  completedRun?: CompletedRun;
  seasonState?: SeasonState;
  runState?: RunState;
  momentEvent?: MomentEvent;
  clipBoundary?: ClipBoundary;

  mechanicTelemetryPayload?: MechanicTelemetryPayload;
  mechanicEmitter?: MechanicEmitter;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M30Input {
  contractId?: string;
  defectionTrigger?: DefectionTrigger;

  // Optional runtime context (usually available via snapshot spread).
  stateTick?: number;
  stateRunPhase?: RunPhase;
  stateTickTier?: TickTier;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
  stateSolvencyStatus?: SolvencyStatus;

  runSeed?: string; // deterministic seed if present
  __typeTouchpad?: M30TypeTouchpad;
}

export interface M30Output {
  defectionEvent: DefectionEvent;
  treasuryExtraction: number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M30Event = 'DEFECTION_INITIATED' | 'TREASURY_DRAINED' | 'PENALTY_APPLIED' | 'DEFECTOR_FLAGGED';

export interface M30TelemetryPayload extends MechanicTelemetryPayload {
  event: M30Event;
  mechanic_id: 'M30';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M30_BOUNDS = {
  TRIGGER_THRESHOLD:   3,
  MULTIPLIER:          1.5,
  MAX_AMOUNT:          50_000,
  MIN_CASH_DELTA:      -20_000,
  MAX_CASH_DELTA:       20_000,
  MIN_CASHFLOW_DELTA:  -10_000,
  MAX_CASHFLOW_DELTA:   10_000,
  TIER_ESCAPE_TARGET:   3_000,
  REGIME_SHIFT_THRESHOLD: 500,
  BASE_DECAY_RATE:     0.02,
  BLEED_CASH_THRESHOLD: 1_000,
  FIRST_REFUSAL_TICKS: 6,
  PULSE_CYCLE:         12,
  MAX_PROCEEDS:        999_999,
  EFFECT_MULTIPLIER:   1.0,
  MIN_EFFECT:          0,
  MAX_EFFECT:          100_000,
} as const;

// ── Internal helpers ───────────────────────────────────────────────────────

function resolvePhaseFromTick(tick: number): RunPhase {
  const t = clamp(Math.floor(tick), 0, RUN_TOTAL_TICKS);
  const third = Math.floor(RUN_TOTAL_TICKS / 3);
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function resolveRegimeAtTick(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  let best = -1;
  let regime: MacroRegime = 'NEUTRAL';
  for (const e of schedule) {
    if (typeof e.tick !== 'number') continue;
    if (e.tick <= tick && e.tick > best && e.regimeChange) {
      best = e.tick;
      regime = e.regimeChange;
    }
  }
  return regime;
}

function isInChaosWindow(seed: string, tick: number): boolean {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function derivePressureTier(breachCount: number, riskScore: number, chaos: boolean): PressureTier {
  const b = clamp(Math.floor(breachCount), 0, 999);
  const r = clamp(riskScore, 0, 1);

  if (r >= 0.85 || b >= 6 || (chaos && b >= M30_BOUNDS.TRIGGER_THRESHOLD)) return 'CRITICAL';
  if (r >= 0.65 || b >= 4) return 'HIGH';
  if (r >= 0.35 || b >= 3) return 'MEDIUM';
  return 'LOW';
}

function deriveTickTier(pressure: PressureTier, pulseTick: boolean, chaos: boolean): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH' || pulseTick || chaos) return 'ELEVATED';
  return 'STANDARD';
}

function pickDefectorId(seed: string, tick: number, participants: string[], reported?: string): string | null {
  const cleaned = (participants ?? []).map(x => String(x ?? '')).filter(Boolean);
  const rep = String(reported ?? '').trim();
  if (rep) return rep;
  if (cleaned.length === 0) return null;

  // stable shuffle then deterministic index
  const shuffled = seededShuffle(cleaned, seed + ':m30:defectors:' + tick);
  const idx = seededIndex(seed, tick, shuffled.length);
  return shuffled[idx] ?? null;
}

function pickEvidenceCard(seed: string, tick: number, phase: RunPhase, pressure: PressureTier, regime: MacroRegime): GameCard {
  const pw = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phw = PHASE_WEIGHTS[phase] ?? 1.0;
  const rw = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(seed + ':m30:evidence:' + tick, pw * phw, rw);
  const pick = pool[seededIndex(seed, tick, pool.length)] ?? DEFAULT_CARD;

  // reference DEFAULT_CARD_IDS explicitly; fallback if mismatch (future-proof)
  return DEFAULT_CARD_IDS.includes(pick.id) ? pick : DEFAULT_CARD;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * defectionSequenceEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function defectionSequenceEngine(
  input: M30Input,
  emit: MechanicEmitter,
): M30Output {
  const contractId = String(input.contractId ?? '');
  const trig = input.defectionTrigger;

  const tick = clamp(Math.floor((input.stateTick as number) ?? 0), 0, RUN_TOTAL_TICKS);
  const runSeed = String((input.runSeed as string) ?? '');
  const requestId = runSeed || computeHash(JSON.stringify({ contractId, tick, trig }));

  const runPhase: RunPhase = (input.stateRunPhase as RunPhase) ?? resolvePhaseFromTick(tick);
  const macroRegime: MacroRegime = (input.stateMacroRegime as MacroRegime) ?? resolveRegimeAtTick(requestId, tick);
  const chaos = isInChaosWindow(requestId, tick);
  const pulseTick = (tick % M30_BOUNDS.PULSE_CYCLE) === 0;

  const participants = (trig?.participants ?? []).map(x => String(x ?? '')).filter(Boolean);
  const breachCount = clamp(Math.floor((trig?.breachCount as number) ?? 0), 0, 999);
  const riskScore = clamp((trig?.riskScore as number) ?? 0, 0, 1);

  const pressureTier: PressureTier =
    (input.statePressureTier as PressureTier) ?? derivePressureTier(breachCount, riskScore, chaos);

  const tickTier: TickTier =
    (input.stateTickTier as TickTier) ?? deriveTickTier(pressureTier, pulseTick, chaos);

  const treasuryBalance = clamp((trig?.treasuryBalance as number) ?? 0, 0, M30_BOUNDS.MAX_PROCEEDS);

  const triggerMet =
    breachCount >= M30_BOUNDS.TRIGGER_THRESHOLD || riskScore >= 0.70;

  const refusalWindow = tick <= M30_BOUNDS.FIRST_REFUSAL_TICKS;

  const defectorId = pickDefectorId(requestId, tick, participants, trig?.reportedDefectorId);
  const evidenceCard = pickEvidenceCard(requestId, tick, runPhase, pressureTier, macroRegime);

  // Direct references to OPPORTUNITY_POOL/DEFAULT_CARD for “every import used”
  const opportunityPoolSize = OPPORTUNITY_POOL.length;
  const defaultCardId = DEFAULT_CARD.id;

  // Severity: bounded, deterministic, regime-aware
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  const decay = computeDecayRate(macroRegime, M30_BOUNDS.BASE_DECAY_RATE);
  const ageFactor = RUN_TOTAL_TICKS <= 0 ? 0 : (tick / RUN_TOTAL_TICKS);

  const baseSeverity = clamp((breachCount / 6) * 0.55 + riskScore * 0.55, 0, 1);
  const chaosBump = chaos ? 0.12 : 0.0;
  const pulseBump = pulseTick ? 0.06 : 0.0;

  const severity = clamp(
    (baseSeverity + chaosBump + pulseBump) * (pressureW * phaseW * regimeW) / 1.25,
    0,
    1,
  );

  // Drain model: bounded, deterministic, decayed-by-age, regime-weighted
  const drainBase = treasuryBalance * clamp(0.05 + severity * 0.15, 0.05, 0.20);
  const preDecay = drainBase * M30_BOUNDS.MULTIPLIER * M30_BOUNDS.EFFECT_MULTIPLIER * regimeMult * exitPulse;
  const decayed = preDecay * (1 - clamp(decay * ageFactor, 0, 0.95));
  const chaosPenalty = chaos ? 1.08 : 1.0;

  const proposedDrain = decayed * chaosPenalty;

  const drainedAmount =
    (triggerMet && !refusalWindow && treasuryBalance > 0)
      ? clamp(proposedDrain, 0, Math.min(M30_BOUNDS.MAX_AMOUNT, treasuryBalance))
      : 0;

  const penaltyApplied =
    (triggerMet && drainedAmount > 0)
      ? clamp(drainedAmount * 0.25, 0, M30_BOUNDS.MAX_CASH_DELTA)
      : 0;

  const treasuryBalanceAfter = clamp(treasuryBalance - drainedAmount, 0, M30_BOUNDS.MAX_PROCEEDS);

  const solvencyStatus: SolvencyStatus =
    (input.stateSolvencyStatus as SolvencyStatus) ??
    (treasuryBalanceAfter <= 0 ? 'WIPED' :
      treasuryBalanceAfter < M30_BOUNDS.BLEED_CASH_THRESHOLD ? 'BLEED' : 'SOLVENT');

  const flagged = triggerMet && !!defectorId;

  const auditHash = computeHash(JSON.stringify({
    contractId,
    tick,
    requestId,
    triggerMet,
    refusalWindow,
    runPhase,
    macroRegime,
    pressureTier,
    tickTier,
    chaos,
    pulseTick,
    breachCount,
    riskScore,
    participantsCount: participants.length,
    defectorId,
    treasuryBalance,
    drainedAmount,
    penaltyApplied,
    treasuryBalanceAfter,
    solvencyStatus,
    evidenceCardId: evidenceCard.id,
    opportunityPoolSize,
    defaultCardId,
  }) + ':M30:v1');

  // ── Telemetry ────────────────────────────────────────────────────────────
  emit({
    event: 'DEFECTION_INITIATED',
    mechanic_id: 'M30',
    tick,
    runId: requestId,
    payload: {
      contractId,
      triggerMet,
      refusalWindow,
      breachCount,
      riskScore,
      participantsCount: participants.length,
      defectorId,
      runPhase,
      macroRegime,
      pressureTier,
      tickTier,
      solvencyStatus,
      chaos,
      pulseTick,
      evidenceCardId: evidenceCard.id,
      opportunityPoolSize,
      defaultCardId,
      auditHash,
      note: String(trig?.note ?? ''),
    },
  });

  if (drainedAmount > 0) {
    emit({
      event: 'TREASURY_DRAINED',
      mechanic_id: 'M30',
      tick,
      runId: requestId,
      payload: {
        contractId,
        defectorId,
        drainedAmount,
        treasuryBalance,
        treasuryBalanceAfter,
        macroRegime,
        runPhase,
        pressureTier,
        tickTier,
        decay,
        regimeMult,
        exitPulse,
        auditHash,
      },
    });
  }

  if (penaltyApplied > 0) {
    emit({
      event: 'PENALTY_APPLIED',
      mechanic_id: 'M30',
      tick,
      runId: requestId,
      payload: {
        contractId,
        defectorId,
        penaltyApplied,
        cappedBy: M30_BOUNDS.MAX_CASH_DELTA,
        auditHash,
      },
    });
  }

  if (flagged) {
    emit({
      event: 'DEFECTOR_FLAGGED',
      mechanic_id: 'M30',
      tick,
      runId: requestId,
      payload: {
        contractId,
        defectorId,
        flagged,
        breachCount,
        riskScore,
        auditHash,
      },
    });
  }

  const defectionEvent: DefectionEvent = {
    contractId,
    tick,

    defectorId,
    flagged,

    runPhase,
    tickTier,
    macroRegime,
    pressureTier,
    solvencyStatus,

    severity,
    drainedAmount,
    penaltyApplied,
    treasuryBalanceAfter,

    evidenceCard,
    auditHash,
  };

  return {
    defectionEvent,
    treasuryExtraction: drainedAmount,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M30MLInput {
  defectionEvent?: DefectionEvent;
  treasuryExtraction?: number;
  runId: string;
  tick: number;
}

export interface M30MLOutput {
  score: number;         // 0–1
  topFactors: string[];  // max 5 plain-English factors
  recommendation: string;// single sentence
  auditHash: string;     // djb2 hash (computeHash) over inputs+outputs+rulesVersion
  confidenceDecay: number;// 0–1, how fast this signal should decay
}

/**
 * defectionSequenceEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function defectionSequenceEngineMLCompanion(
  input: M30MLInput,
): Promise<M30MLOutput> {
  const tick = clamp(Math.floor(input.tick ?? 0), 0, RUN_TOTAL_TICKS);
  const runId = String(input.runId ?? '');

  const macroRegime = resolveRegimeAtTick(runId || computeHash(JSON.stringify(input)), tick);
  const decay = computeDecayRate(macroRegime, M30_BOUNDS.BASE_DECAY_RATE);

  const extraction = clamp((input.treasuryExtraction as number) ?? 0, 0, M30_BOUNDS.MAX_AMOUNT);
  const e = input.defectionEvent;

  const severity = clamp((e?.severity as number) ?? 0, 0, 1);
  const flagged = !!e?.flagged;

  const score = clamp(
    0.10 + (flagged ? 0.35 : 0.0) + severity * 0.35 + (extraction > 0 ? 0.20 : 0.0),
    0.01,
    0.99,
  );

  const topFactors: string[] = [
    flagged ? 'Defector flagged' : 'No defector flagged',
    `Severity=${severity.toFixed(2)}`,
    `Extraction=$${Math.round(extraction)}`,
    `Regime=${macroRegime}`,
    `Tick=${tick}/${RUN_TOTAL_TICKS}`,
  ].slice(0, 5);

  const recommendation =
    score >= 0.70
      ? 'Freeze payouts and require proof-backed reconciliation before continuing the contract.'
      : 'Monitor trust signals and keep the treasury capped until breach risk stabilizes.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ ...input, macroRegime, decay }) + ':ml:M30'),
    confidenceDecay: clamp(decay, 0.01, 0.99),
  };
}