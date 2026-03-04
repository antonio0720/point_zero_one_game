// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m51_syndicate_deal_architecture.ts
//
// Mechanic : M51 — Syndicate Deal Architecture
// Family   : coop_advanced   Layer: api_endpoint   Priority: 2   Batch: 2
// ML Pair  : m51a
// Deps     : M26
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

// ─────────────────────────────────────────────────────────────────────────────
// Import Coverage (DO NOT REMOVE)
// - Exported so it is never flagged as unused under strict/noUnusedLocals setups
// - Ensures every shared type/value import is reachable and indexable
// ─────────────────────────────────────────────────────────────────────────────

export const M51_VALUE_IMPORT_COVERAGE = {
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

export type M51_TYPE_IMPORT_COVERAGE = {
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

// ── Domain types (local to M51) ──────────────────────────────────────────────

export type DealProposalStatus = 'PROPOSED' | 'RATIFIED' | 'REJECTED';

export interface DealProposal {
  seed: string; // deterministic seed (run-level)
  runId: string; // engine run id
  tick: number; // current tick
  requestedAmount: number; // amount requested from syndicate
  phase?: RunPhase;
  regime?: MacroRegime;
  pressureTier?: PressureTier;
  minParticipants?: number; // ratification threshold
  note?: string;
  meta?: Record<string, unknown>;
}

export interface SyndicateDeal {
  dealId: string;
  proposalHash: string;
  termsHash: string;

  status: DealProposalStatus;

  runId: string;
  tick: number;

  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;

  participantIds: string[];

  amountRequested: number;
  proceedsCap: number;

  opportunityCard: GameCard;
  weightedPoolIds: string[];

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  inChaosWindow: boolean;

  decayRate: number;
  exitPulseMultiplier: number;
  regimeMultiplier: number;

  createdAt: number;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M51Input {
  dealProposal?: DealProposal;
  participantIds?: string[];
}

export interface M51Output {
  syndicateDeal: SyndicateDeal;
  splitTerms: Record<string, unknown>;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M51Event = 'SYNDICATE_DEAL_PROPOSED' | 'DEAL_RATIFIED' | 'SPLIT_LOCKED';

export interface M51TelemetryPayload extends MechanicTelemetryPayload {
  event: M51Event;
  mechanic_id: 'M51';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M51_BOUNDS = {
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

function deriveRunPhaseFromTick(tick: number): RunPhase {
  const t = clamp(tick, 0, Math.max(0, RUN_TOTAL_TICKS - 1));
  const p = RUN_TOTAL_TICKS <= 0 ? 0 : t / RUN_TOTAL_TICKS;
  if (p < 0.34) return 'EARLY';
  if (p < 0.67) return 'MID';
  return 'LATE';
}

function normalizeSplits(ids: string[], rawWeights: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (ids.length === 0) return out;

  const weights = rawWeights.map(w => Math.max(0, w));
  const sum = weights.reduce((a, b) => a + b, 0);

  if (sum <= 0) {
    const eq = 1 / ids.length;
    for (const id of ids) out[id] = eq;
    return out;
  }

  for (let i = 0; i < ids.length; i++) out[ids[i]] = weights[i] / sum;
  return out;
}

function isTickInChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * syndicateDealArchitecture
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function syndicateDealArchitecture(input: M51Input, emit: MechanicEmitter): M51Output {
  const participantsRaw = Array.isArray(input.participantIds) ? input.participantIds : [];
  const participantIds = participantsRaw.filter((v): v is string => typeof v === 'string' && v.length > 0);

  const proposal: DealProposal | undefined = input.dealProposal;
  const seed = proposal?.seed ?? computeHash(JSON.stringify(input));
  const tick = clamp(proposal?.tick ?? 0, 0, Math.max(0, RUN_TOTAL_TICKS - 1));
  const runId = proposal?.runId ?? computeHash(seed + ':run');
  const proposalHash = computeHash(JSON.stringify(proposal ?? input));

  const runPhase: RunPhase = proposal?.phase ?? deriveRunPhaseFromTick(tick);

  // Build schedules deterministically for this run
  const macroSchedule = buildMacroSchedule(seed + ':m51', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':m51', CHAOS_WINDOWS_PER_RUN);

  // Determine current macro regime (default to provided; else derive from schedule)
  const derivedRegimeFromSchedule: MacroRegime =
    (macroSchedule
      .slice()
      .sort((a, b) => a.tick - b.tick)
      .reduce<MacroRegime>((cur, ev) => (ev.tick <= tick && ev.regimeChange ? ev.regimeChange : cur), 'NEUTRAL') as MacroRegime) ??
    'NEUTRAL';

  const macroRegime: MacroRegime = proposal?.regime ?? derivedRegimeFromSchedule;
  const pressureTier: PressureTier = proposal?.pressureTier ?? 'MEDIUM';

  const inChaosWindow = isTickInChaosWindow(tick, chaosWindows);

  // Use all weight tables deterministically
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(seed + ':m51:pool', pressureWeight * phaseWeight, regimeWeight);
  const weightedPoolIds = weightedPool.map(c => c.id);

  // Select opportunity card deterministically
  const poolForPick = weightedPool.length > 0 ? weightedPool : OPPORTUNITY_POOL;
  const picked = poolForPick[seededIndex(seed + ':m51:pick', tick, poolForPick.length)] ?? DEFAULT_CARD;
  const opportunityCard = DEFAULT_CARD_IDS.includes(picked.id) ? picked : DEFAULT_CARD;

  // Compute deal amount + caps deterministically
  const amountRequested = clamp(proposal?.requestedAmount ?? 0, 0, M51_BOUNDS.MAX_AMOUNT);

  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const proceedsCap = clamp(
    Math.round(amountRequested * M51_BOUNDS.MULTIPLIER * exitPulseMultiplier),
    0,
    M51_BOUNDS.MAX_PROCEEDS,
  );

  const decayRate = computeDecayRate(macroRegime, M51_BOUNDS.BASE_DECAY_RATE);

  // Deterministic participant order + ratification rules
  const shuffledParticipants = seededShuffle(participantIds, seed + ':m51:participants');

  const minParticipants = clamp(
    proposal?.minParticipants ?? M51_BOUNDS.TRIGGER_THRESHOLD,
    1,
    Math.max(1, shuffledParticipants.length || 1),
  );

  const ratified = shuffledParticipants.length >= minParticipants && amountRequested > 0;

  // Deterministic splits (seeded weights) — locked only if ratified
  const splitWeights = shuffledParticipants.map((_, i) => {
    const w = seededIndex(seed + ':m51:split', tick + i, 10_000) + 1; // 1..10000
    // chaos slightly increases dispersion but remains bounded/deterministic
    return inChaosWindow ? w * 1.15 : w;
  });

  const splits = normalizeSplits(shuffledParticipants, splitWeights);

  const splitHash = computeHash(
    JSON.stringify({
      runId,
      tick,
      macroRegime,
      runPhase,
      pressureTier,
      minParticipants,
      shuffledParticipants,
      splits,
      opportunityCardId: opportunityCard.id,
      amountRequested,
      proceedsCap,
      decayRate,
    }),
  );

  // Emit telemetry
  emit({
    event: 'SYNDICATE_DEAL_PROPOSED',
    mechanic_id: 'M51',
    tick,
    runId,
    payload: {
      proposalHash,
      amountRequested,
      participantCount: shuffledParticipants.length,
      minParticipants,
      macroRegime,
      runPhase,
      pressureTier,
      inChaosWindow,
      opportunityCardId: opportunityCard.id,
      proceedsCap,
      decayRate,
      exitPulseMultiplier,
      regimeMultiplier,
    },
  });

  if (ratified) {
    emit({
      event: 'DEAL_RATIFIED',
      mechanic_id: 'M51',
      tick,
      runId,
      payload: {
        proposalHash,
        termsHash: splitHash,
        participantIds: shuffledParticipants,
        splits,
      },
    });

    emit({
      event: 'SPLIT_LOCKED',
      mechanic_id: 'M51',
      tick,
      runId,
      payload: {
        termsHash: splitHash,
        locked: true,
      },
    });
  }

  const syndicateDeal: SyndicateDeal = {
    dealId: computeHash('M51:' + runId + ':' + tick + ':' + proposalHash),
    proposalHash,
    termsHash: splitHash,

    status: ratified ? 'RATIFIED' : 'PROPOSED',

    runId,
    tick,

    runPhase,
    macroRegime,
    pressureTier,

    participantIds: shuffledParticipants,

    amountRequested,
    proceedsCap,

    opportunityCard,
    weightedPoolIds,

    macroSchedule,
    chaosWindows,
    inChaosWindow,

    decayRate,
    exitPulseMultiplier,
    regimeMultiplier,

    createdAt: Date.now(),
  };

  const splitTerms: Record<string, unknown> = {
    ratified,
    proposalHash,
    termsHash: splitHash,
    minParticipants,
    participantCount: shuffledParticipants.length,
    participantIds: shuffledParticipants,
    splits, // map: participantId -> share (0..1)
    weights: {
      pressureWeight,
      phaseWeight,
      regimeWeight,
    },
    selection: {
      poolSize: poolForPick.length,
      pickedCardId: opportunityCard.id,
      defaultCardId: DEFAULT_CARD.id,
      allowedCardIds: DEFAULT_CARD_IDS,
    },
    schedule: {
      macroEventsPerRun: MACRO_EVENTS_PER_RUN,
      chaosWindowsPerRun: CHAOS_WINDOWS_PER_RUN,
      runTotalTicks: RUN_TOTAL_TICKS,
    },
    macro: {
      macroRegime,
      exitPulseMultiplier,
      regimeMultiplier,
      decayRate,
    },
  };

  return {
    syndicateDeal,
    splitTerms,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M51MLInput {
  syndicateDeal?: SyndicateDeal;
  splitTerms?: Record<string, unknown>;
  runId: string;
  tick: number;
}

export interface M51MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * syndicateDealArchitectureMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function syndicateDealArchitectureMLCompanion(input: M51MLInput): Promise<M51MLOutput> {
  const deal = input.syndicateDeal;

  const factors: string[] = [];
  if (deal) {
    factors.push(deal.status === 'RATIFIED' ? 'Deal ratified' : 'Deal pending');
    factors.push(`Participants: ${deal.participantIds.length}`);
    factors.push(`Regime: ${deal.macroRegime}`);
    factors.push(`Pressure: ${deal.pressureTier}`);
    factors.push(deal.inChaosWindow ? 'Chaos window active' : 'Stable window');
  } else {
    factors.push('No deal payload present');
  }

  const base = deal ? 0.35 : 0.15;
  const ratifyBoost = deal?.status === 'RATIFIED' ? 0.25 : 0;
  const chaosPenalty = deal?.inChaosWindow ? -0.08 : 0;
  const participantBoost = deal ? clamp(deal.participantIds.length / 12, 0, 0.25) : 0;

  const score = clamp(base + ratifyBoost + participantBoost + chaosPenalty, 0.01, 0.99);

  const auditHash = computeHash(
    JSON.stringify({
      runId: input.runId,
      tick: input.tick,
      dealId: deal?.dealId ?? null,
      termsHash: deal?.termsHash ?? null,
      score,
      factors,
    }) + ':ml:M51',
  );

  return {
    score,
    topFactors: factors.slice(0, 5),
    recommendation:
      deal?.status === 'RATIFIED'
        ? 'Execute within bounds; monitor regime and chaos windows for slippage.'
        : 'Increase qualified participants or reduce ask to reach ratification threshold.',
    auditHash,
    confidenceDecay: clamp((deal?.decayRate ?? 0.05) * 2, 0.01, 0.35),
  };
}