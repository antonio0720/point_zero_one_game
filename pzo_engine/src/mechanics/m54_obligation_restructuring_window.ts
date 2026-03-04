// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m54_obligation_restructuring_window.ts
//
// Mechanic : M54 — Obligation Restructuring Window
// Family   : coop_advanced   Layer: api_endpoint   Priority: 2   Batch: 2
// ML Pair  : m54a
// Deps     : M26, M27
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
// - Makes every imported symbol accessible outside this module (single export)
// - Ensures every value import is referenced (avoids dead-import lint/tsc flags)
// ─────────────────────────────────────────────────────────────────────────────

export const M54_VALUE_IMPORT_COVERAGE = {
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

export type M54_TYPE_IMPORT_COVERAGE = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Local domain contracts (M54)
// ─────────────────────────────────────────────────────────────────────────────

export type RestructureDecision = 'APPROVED' | 'DENIED';

export interface RestructureProposal {
  // Deterministic context
  seed: string;
  runId: string;
  tick: number;

  // Proposed modifications (bounded by engine)
  principalDelta?: number; // negative = principal reduction, positive = increase
  rateDeltaBps?: number; // interest rate delta in basis points
  termDeltaMonths?: number; // positive extends term
  paymentDeferralTicks?: number; // optional deferral window (ticks)

  // Player-reason / evidence (server-verifiable via hash)
  justification?: string;
  proofIds?: string[];
  meta?: Record<string, unknown>;
}

export interface ContractTerms {
  contractId: string;

  principal: number;
  rateBps: number;
  termMonths: number;

  paymentDeferralUntilTick: number;

  // Deterministic audit / policy context
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  runPhase: RunPhase;
  inChaosWindow: boolean;

  decayRate: number;
  exitPulseMultiplier: number;
  regimeMultiplier: number;

  auditHash: string;
}

export interface RestructureResult {
  contractId: string;
  decision: RestructureDecision;

  runId: string;
  tick: number;

  // Policy + scoring
  score: number; // 0..1 approval likelihood (deterministic rule score, not ML)
  reasons: string[]; // max ~6
  proposalHash: string;

  // Accounting impacts (bounded)
  principalDeltaApplied: number;
  rateDeltaBpsApplied: number;
  termDeltaMonthsApplied: number;
  paymentDeferralTicksApplied: number;

  // Collateral anchor (allowlisted card)
  policyCard: GameCard;

  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M54Input {
  contractId?: string;
  restructureProposal?: RestructureProposal;

  // Optional baseline terms snapshot (if caller has it)
  baselineTerms?: Partial<ContractTerms>;

  // Optional context hooks (safe if snapshotExtractor supplies later)
  tick?: number;
  runId?: string;
  seed?: string;
}

export interface M54Output {
  restructureResult: RestructureResult;
  newTerms: ContractTerms;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M54Event = 'RESTRUCTURE_PROPOSED' | 'TERMS_AMENDED' | 'RESTRUCTURE_DENIED';

export interface M54TelemetryPayload extends MechanicTelemetryPayload {
  event: M54Event;
  mechanic_id: 'M54';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M54_BOUNDS = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (pure + deterministic)
// ─────────────────────────────────────────────────────────────────────────────

function deriveRunPhase(tick: number): RunPhase {
  const t = clamp(tick, 0, Math.max(0, RUN_TOTAL_TICKS - 1));
  const p = RUN_TOTAL_TICKS <= 0 ? 0 : t / RUN_TOTAL_TICKS;
  if (p < 0.34) return 'EARLY';
  if (p < 0.67) return 'MID';
  return 'LATE';
}

function isTickInChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function deriveMacroRegime(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  const sorted = macroSchedule.slice().sort((a, b) => a.tick - b.tick);
  let r: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick <= tick && ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function derivePressureTierFromProposal(p?: RestructureProposal): PressureTier {
  const magnitude =
    Math.abs(p?.principalDelta ?? 0) +
    Math.abs(p?.rateDeltaBps ?? 0) * 10 +
    Math.abs(p?.termDeltaMonths ?? 0) * 50;

  const pct = M54_BOUNDS.MAX_EFFECT <= 0 ? 0 : magnitude / M54_BOUNDS.MAX_EFFECT;
  if (pct < 0.2) return 'LOW';
  if (pct < 0.55) return 'MEDIUM';
  if (pct < 0.85) return 'HIGH';
  return 'CRITICAL';
}

function pickPolicyCard(seed: string, tick: number, pressurePhaseWeight: number, regimeWeight: number): GameCard {
  const weighted = buildWeightedPool(seed + ':m54:pool', pressurePhaseWeight, regimeWeight);
  const pool = weighted.length > 0 ? weighted : OPPORTUNITY_POOL;

  const idx = seededIndex(seed + ':m54:pick', tick, pool.length);
  const picked = pool[idx] ?? DEFAULT_CARD;

  return DEFAULT_CARD_IDS.includes(picked.id) ? picked : DEFAULT_CARD;
}

function computeRuleScore(args: {
  inChaosWindow: boolean;
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  proposal: RestructureProposal;
  decayRate: number;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // Base score by phase/regime (deterministic tables exercised)
  const phaseWeight = PHASE_WEIGHTS[args.runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[args.macroRegime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[args.pressureTier] ?? 1.0;

  // Hard constraints
  if (args.inChaosWindow) reasons.push('Chaos window active');
  if (args.macroRegime === 'CRISIS') reasons.push('Crisis regime');
  if (args.macroRegime === 'BEAR') reasons.push('Bear regime');

  const pd = args.proposal.principalDelta ?? 0;
  const rd = args.proposal.rateDeltaBps ?? 0;
  const td = args.proposal.termDeltaMonths ?? 0;
  const def = args.proposal.paymentDeferralTicks ?? 0;

  const lenJust = typeof args.proposal.justification === 'string' ? args.proposal.justification.length : 0;
  const proofCount = Array.isArray(args.proposal.proofIds) ? args.proposal.proofIds.length : 0;

  // Positive signals
  if (lenJust >= 40) reasons.push('Justification present');
  if (proofCount >= 1) reasons.push('Proof attached');

  // Negative signals (aggressive requests)
  if (pd > 0) reasons.push('Principal increase requested');
  if (rd < 0) reasons.push('Rate reduction requested');
  if (td > 0) reasons.push('Term extension requested');
  if (def > 0) reasons.push('Deferral requested');

  // Deterministic scoring (bounded)
  let score = 0.55;

  // Regime: harder during crisis/bear
  if (args.macroRegime === 'CRISIS') score -= 0.18;
  else if (args.macroRegime === 'BEAR') score -= 0.10;
  else if (args.macroRegime === 'BULL') score += 0.06;

  // Chaos window reduces approvals
  if (args.inChaosWindow) score -= 0.12;

  // Evidence increases approval chance
  score += clamp(lenJust / 200, 0, 0.12);
  score += clamp(proofCount * 0.06, 0, 0.18);

  // Request size penalty: bigger changes reduce score
  const magnitude =
    Math.abs(pd) / Math.max(1, M54_BOUNDS.MAX_AMOUNT) +
    Math.abs(rd) / 2000 +
    Math.abs(td) / 120 +
    Math.abs(def) / Math.max(1, RUN_TOTAL_TICKS);

  score -= clamp(magnitude * 0.25, 0, 0.25);

  // Weight tables influence final outcome (forces usage + creates deterministic variance)
  score *= clamp(0.75 + 0.10 * phaseWeight, 0.6, 1.15);
  score *= clamp(0.75 + 0.10 * regimeWeight, 0.6, 1.15);
  score *= clamp(0.75 + 0.10 * pressureWeight, 0.6, 1.15);

  // Decay is a “staleness penalty”: older info reduces confidence a bit
  score -= clamp(args.decayRate * 0.5, 0, 0.08);

  return { score: clamp(score, 0.01, 0.99), reasons: reasons.slice(0, 6) };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * obligationRestructuringEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function obligationRestructuringEngine(input: M54Input, emit: MechanicEmitter): M54Output {
  const contractId = String(input.contractId ?? '');

  const runId =
    (typeof input.runId === 'string' && input.runId.length > 0 ? input.runId : computeHash(JSON.stringify(input))) ??
    computeHash('m54:fallback');

  const seed =
    (typeof input.seed === 'string' && input.seed.length > 0 ? input.seed : computeHash(runId + ':m54:seed')) ??
    computeHash('m54:seed:fallback');

  const tick = clamp((input.tick as number) ?? 0, 0, Math.max(0, RUN_TOTAL_TICKS - 1));

  const proposal: RestructureProposal = input.restructureProposal ?? {
    seed,
    runId,
    tick,
    principalDelta: 0,
    rateDeltaBps: 0,
    termDeltaMonths: 0,
    paymentDeferralTicks: 0,
    justification: '',
    proofIds: [],
    meta: {},
  };

  // Deterministic schedules / context
  const macroSchedule = buildMacroSchedule(seed + ':m54:macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':m54:chaos', CHAOS_WINDOWS_PER_RUN);

  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const inChaosWindow = isTickInChaosWindow(tick, chaosWindows);
  const runPhase = deriveRunPhase(tick);
  const pressureTier = derivePressureTierFromProposal(proposal);

  const decayRate = computeDecayRate(macroRegime, M54_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  // Weights for pool selection
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const policyCard = pickPolicyCard(seed, tick, pressureWeight * phaseWeight, regimeWeight);

  // Deterministic audit shuffle for reproducible “witness ordering” (server-verifiable primitive)
  const witnessOrdering = seededShuffle(
    [contractId, proposal.justification ?? '', ...(proposal.proofIds ?? [])].filter(s => typeof s === 'string'),
    seed + ':m54:witness',
  );

  const proposalHash = computeHash(JSON.stringify({ contractId, proposal, witnessOrdering }));

  // Score + decision (rules-only, deterministic)
  const scored = computeRuleScore({
    inChaosWindow,
    macroRegime,
    runPhase,
    pressureTier,
    proposal,
    decayRate,
  });

  const approved = scored.score >= 0.60 && !inChaosWindow;

  // Baseline terms (if not provided, create deterministic placeholder bounded values)
  const baselinePrincipal = clamp((input.baselineTerms?.principal as number) ?? 10_000, 0, M54_BOUNDS.MAX_PROCEEDS);
  const baselineRateBps = clamp((input.baselineTerms?.rateBps as number) ?? 1200, 0, 25_000);
  const baselineTermMonths = clamp((input.baselineTerms?.termMonths as number) ?? 36, 1, 600);
  const baselineDeferralUntil = clamp((input.baselineTerms?.paymentDeferralUntilTick as number) ?? 0, 0, RUN_TOTAL_TICKS);

  // Apply bounded deltas only when approved (otherwise no-op)
  const principalDeltaApplied = approved ? clamp(proposal.principalDelta ?? 0, -M54_BOUNDS.MAX_AMOUNT, M54_BOUNDS.MAX_AMOUNT) : 0;
  const rateDeltaBpsApplied = approved ? clamp(proposal.rateDeltaBps ?? 0, -2500, 2500) : 0;
  const termDeltaMonthsApplied = approved ? clamp(proposal.termDeltaMonths ?? 0, -24, 120) : 0;
  const paymentDeferralTicksApplied = approved ? clamp(proposal.paymentDeferralTicks ?? 0, 0, RUN_TOTAL_TICKS) : 0;

  const newPrincipal = clamp(baselinePrincipal + principalDeltaApplied, 0, M54_BOUNDS.MAX_PROCEEDS);
  const newRateBps = clamp(baselineRateBps + rateDeltaBpsApplied, 0, 25_000);
  const newTermMonths = clamp(baselineTermMonths + termDeltaMonthsApplied, 1, 600);
  const newDeferralUntil = clamp(Math.max(baselineDeferralUntil, tick + paymentDeferralTicksApplied), 0, RUN_TOTAL_TICKS);

  const newTermsAuditHash = computeHash(
    JSON.stringify({
      contractId,
      runId,
      tick,
      macroRegime,
      pressureTier,
      runPhase,
      inChaosWindow,
      decayRate,
      exitPulseMultiplier,
      regimeMultiplier,
      baseline: { principal: baselinePrincipal, rateBps: baselineRateBps, termMonths: baselineTermMonths, deferral: baselineDeferralUntil },
      applied: { principalDeltaApplied, rateDeltaBpsApplied, termDeltaMonthsApplied, paymentDeferralTicksApplied },
      new: { newPrincipal, newRateBps, newTermMonths, newDeferralUntil },
      policyCardId: policyCard.id,
      proposalHash,
      score: scored.score,
    }),
  );

  const newTerms: ContractTerms = {
    contractId,

    principal: newPrincipal,
    rateBps: newRateBps,
    termMonths: newTermMonths,

    paymentDeferralUntilTick: newDeferralUntil,

    macroRegime,
    pressureTier,
    runPhase,
    inChaosWindow,

    decayRate,
    exitPulseMultiplier,
    regimeMultiplier,

    auditHash: newTermsAuditHash,
  };

  const resultAuditHash = computeHash(
    JSON.stringify({
      contractId,
      runId,
      tick,
      decision: approved ? 'APPROVED' : 'DENIED',
      score: scored.score,
      reasons: scored.reasons,
      proposalHash,
      newTermsAuditHash,
    }),
  );

  const restructureResult: RestructureResult = {
    contractId,
    decision: approved ? 'APPROVED' : 'DENIED',
    runId,
    tick,
    score: scored.score,
    reasons: scored.reasons,
    proposalHash,
    principalDeltaApplied,
    rateDeltaBpsApplied,
    termDeltaMonthsApplied,
    paymentDeferralTicksApplied,
    policyCard,
    auditHash: resultAuditHash,
  };

  // Telemetry
  emit({
    event: 'RESTRUCTURE_PROPOSED',
    mechanic_id: 'M54',
    tick,
    runId,
    payload: {
      contractId,
      proposalHash,
      score: scored.score,
      reasons: scored.reasons,
      macroRegime,
      runPhase,
      pressureTier,
      inChaosWindow,
      policyCardId: policyCard.id,
      auditHash: resultAuditHash,
    },
  });

  if (approved) {
    emit({
      event: 'TERMS_AMENDED',
      mechanic_id: 'M54',
      tick,
      runId,
      payload: {
        contractId,
        proposalHash,
        newTermsAuditHash,
        applied: {
          principalDeltaApplied,
          rateDeltaBpsApplied,
          termDeltaMonthsApplied,
          paymentDeferralTicksApplied,
        },
        newTerms: {
          principal: newPrincipal,
          rateBps: newRateBps,
          termMonths: newTermMonths,
          paymentDeferralUntilTick: newDeferralUntil,
        },
      },
    });
  } else {
    emit({
      event: 'RESTRUCTURE_DENIED',
      mechanic_id: 'M54',
      tick,
      runId,
      payload: {
        contractId,
        proposalHash,
        score: scored.score,
        reasons: scored.reasons,
        inChaosWindow,
      },
    });
  }

  return {
    restructureResult,
    newTerms,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M54MLInput {
  restructureResult?: RestructureResult;
  newTerms?: ContractTerms;
  runId: string;
  tick: number;
}

export interface M54MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (here: computeHash deterministic)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * obligationRestructuringEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function obligationRestructuringEngineMLCompanion(input: M54MLInput): Promise<M54MLOutput> {
  const r = input.restructureResult;

  const factors: string[] = [];
  if (!r) {
    factors.push('No restructure payload present');
  } else {
    factors.push(`Decision: ${r.decision}`);
    factors.push(`Score: ${r.score.toFixed(2)}`);
    factors.push(`Reasons: ${r.reasons.slice(0, 2).join('; ') || 'None'}`);
    factors.push(`Audit: ${r.auditHash.slice(0, 10)}…`);
  }

  const base = r ? 0.25 : 0.1;
  const scoreBoost = r ? clamp(r.score * 0.55, 0, 0.55) : 0;
  const deniedPenalty = r?.decision === 'DENIED' ? 0.12 : 0;

  const score = clamp(base + scoreBoost - deniedPenalty, 0.01, 0.99);

  const recommendation =
    !r
      ? 'Provide restructureResult payload for evaluation.'
      : r.decision === 'APPROVED'
        ? 'Approved; propagate newTerms to ledger and notify dependent mechanics.'
        : 'Denied; reduce delta magnitude, attach proof, and retry outside chaos windows.';

  const auditHash = computeHash(
    JSON.stringify({
      runId: input.runId,
      tick: input.tick,
      restructureAuditHash: r?.auditHash ?? null,
      score,
      factors,
      recommendation,
    }) + ':ml:M54',
  );

  return {
    score,
    topFactors: factors.slice(0, 5),
    recommendation,
    auditHash,
    confidenceDecay: clamp(((input.newTerms?.decayRate as number) ?? 0.05) * 2, 0.01, 0.35),
  };
}