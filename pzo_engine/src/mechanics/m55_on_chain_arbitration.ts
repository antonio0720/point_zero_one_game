// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m55_on_chain_arbitration.ts
//
// Mechanic : M55 — On-Chain Arbitration
// Family   : coop_advanced   Layer: api_endpoint   Priority: 2   Batch: 2
// ML Pair  : m55a
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

export const M55_VALUE_IMPORT_COVERAGE = {
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

export type M55_TYPE_IMPORT_COVERAGE = {
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
// Local domain contracts (M55)
// ─────────────────────────────────────────────────────────────────────────────

export type DisputeType = 'NON_DELIVERY' | 'SCOPE_CREEP' | 'PAYMENT_DELAY' | 'QUALITY' | 'FRAUD' | 'OTHER';

export interface DisputePayload {
  seed: string;
  runId: string;
  tick: number;

  claimantId?: string;
  respondentId?: string;

  disputeType?: DisputeType;

  amountInDispute?: number; // currency units
  claimedDamages?: number; // optional additional claimed damages (bounded)

  claimantStatement?: string;
  respondentStatement?: string;

  // Server-verifiable evidence (hashes/ids only)
  evidenceHashes?: string[]; // already-hashed content refs
  proofIds?: string[];

  meta?: Record<string, unknown>;
}

export type ArbitrationVerdict = 'CLAIMANT' | 'RESPONDENT' | 'SPLIT' | 'DISMISS';
export type ArbitrationStatus = 'OPENED' | 'VERDICT_ISSUED';

export interface ArbitrationResult {
  arbitrationId: string;
  contractId: string;

  runId: string;
  tick: number;

  status: ArbitrationStatus;
  verdict: ArbitrationVerdict;

  // Deterministic payouts (bounded)
  payoutToClaimant: number;
  payoutToRespondent: number;
  slashedToTreasury: number;

  // Deterministic rule score (not ML)
  score: number; // 0..1
  reasons: string[]; // up to ~6
  disputeHash: string;

  // Context (deterministic)
  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  inChaosWindow: boolean;

  // Anchors
  policyCard: GameCard;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  decayRate: number;
  exitPulseMultiplier: number;
  regimeMultiplier: number;

  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M55Input {
  disputePayload?: DisputePayload;
  contractId?: string;

  // Optional context hooks (safe if snapshotExtractor supplies later)
  runId?: string;
  tick?: number;
  seed?: string;
}

export interface M55Output {
  arbitrationResult: ArbitrationResult;
  verdictApplied: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M55Event = 'DISPUTE_RAISED' | 'ARBITRATION_OPENED' | 'VERDICT_ISSUED';

export interface M55TelemetryPayload extends MechanicTelemetryPayload {
  event: M55Event;
  mechanic_id: 'M55';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M55_BOUNDS = {
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

function deriveMacroRegime(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  const sorted = macroSchedule.slice().sort((a, b) => a.tick - b.tick);
  let r: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick <= tick && ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function isTickInChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function derivePressureTierFromAmount(amount: number): PressureTier {
  const pct = M55_BOUNDS.MAX_AMOUNT <= 0 ? 0 : amount / M55_BOUNDS.MAX_AMOUNT;
  if (pct < 0.2) return 'LOW';
  if (pct < 0.55) return 'MEDIUM';
  if (pct < 0.85) return 'HIGH';
  return 'CRITICAL';
}

function pickPolicyCard(seed: string, tick: number, pressurePhaseWeight: number, regimeWeight: number): GameCard {
  const weighted = buildWeightedPool(seed + ':m55:pool', pressurePhaseWeight, regimeWeight);
  const pool = weighted.length > 0 ? weighted : OPPORTUNITY_POOL;

  const idx = seededIndex(seed + ':m55:pick', tick, pool.length);
  const picked = pool[idx] ?? DEFAULT_CARD;

  return DEFAULT_CARD_IDS.includes(picked.id) ? picked : DEFAULT_CARD;
}

function computeRuleScore(args: {
  disputeType: DisputeType;
  amountInDispute: number;
  claimedDamages: number;
  claimantLen: number;
  respondentLen: number;
  evidenceCount: number;
  proofCount: number;

  inChaosWindow: boolean;
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;

  decayRate: number;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  const phaseWeight = PHASE_WEIGHTS[args.runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[args.macroRegime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[args.pressureTier] ?? 1.0;

  if (args.inChaosWindow) reasons.push('Chaos window active');
  if (args.macroRegime === 'CRISIS') reasons.push('Crisis regime');
  if (args.macroRegime === 'BEAR') reasons.push('Bear regime');

  if (args.evidenceCount >= 2) reasons.push('Evidence present');
  if (args.proofCount >= 1) reasons.push('Proof attached');
  if (args.claimantLen >= 60) reasons.push('Claimant statement substantive');
  if (args.respondentLen >= 60) reasons.push('Respondent statement substantive');

  // Base score: how "legible" the case is to rules (evidence + clarity).
  let score = 0.5;

  // Clarity & evidence increase rule score
  score += clamp(args.evidenceCount * 0.06, 0, 0.24);
  score += clamp(args.proofCount * 0.05, 0, 0.20);
  score += clamp(args.claimantLen / 250, 0, 0.14);
  score -= clamp(args.respondentLen / 350, 0, 0.10); // respondent detail can reduce claimant certainty

  // Chaos & regime reduce confidence
  if (args.inChaosWindow) score -= 0.10;
  if (args.macroRegime === 'CRISIS') score -= 0.12;
  if (args.macroRegime === 'BEAR') score -= 0.06;
  if (args.macroRegime === 'BULL') score += 0.04;

  // Dispute type bias (bounded)
  if (args.disputeType === 'FRAUD') score += 0.08;
  if (args.disputeType === 'NON_DELIVERY') score += 0.05;
  if (args.disputeType === 'SCOPE_CREEP') score -= 0.03;

  // Amount magnitude can reduce rule confidence (bigger cases are harder to auto-resolve)
  const mag = (args.amountInDispute + args.claimedDamages) / Math.max(1, M55_BOUNDS.MAX_AMOUNT);
  score -= clamp(mag * 0.10, 0, 0.10);

  // Weight tables influence final outcome (forces usage + deterministic variance)
  score *= clamp(0.75 + 0.10 * phaseWeight, 0.6, 1.15);
  score *= clamp(0.75 + 0.10 * regimeWeight, 0.6, 1.15);
  score *= clamp(0.75 + 0.10 * pressureWeight, 0.6, 1.15);

  // Decay is a “staleness penalty”
  score -= clamp(args.decayRate * 0.5, 0, 0.08);

  return { score: clamp(score, 0.01, 0.99), reasons: reasons.slice(0, 6) };
}

function decideVerdict(score: number): ArbitrationVerdict {
  if (score >= 0.62) return 'CLAIMANT';
  if (score <= 0.38) return 'RESPONDENT';
  if (score >= 0.50) return 'SPLIT';
  return 'DISMISS';
}

function computePayouts(args: {
  verdict: ArbitrationVerdict;
  amountInDispute: number;
  claimedDamages: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;
  inChaosWindow: boolean;
  gate: number; // deterministic 0..1
}): { payoutToClaimant: number; payoutToRespondent: number; slashedToTreasury: number } {
  const base = clamp(args.amountInDispute, 0, M55_BOUNDS.MAX_AMOUNT);
  const damages = clamp(args.claimedDamages, 0, M55_BOUNDS.MAX_AMOUNT);

  // Treasury slash rate: higher in chaos and when gate is low (simulated congestion / fees)
  const feeBase = args.inChaosWindow ? 0.08 : 0.03;
  const feeRand = clamp((0.06 - args.gate * 0.06), 0, 0.06);
  const feeRate = clamp(feeBase + feeRand, 0.01, 0.12);

  const grossPool = clamp((base + damages) * args.regimeMultiplier * args.exitPulseMultiplier, 0, M55_BOUNDS.MAX_PROCEEDS);
  const slashedToTreasury = clamp(grossPool * feeRate, 0, grossPool);

  const net = clamp(grossPool - slashedToTreasury, 0, grossPool);

  switch (args.verdict) {
    case 'CLAIMANT':
      return { payoutToClaimant: net, payoutToRespondent: 0, slashedToTreasury };
    case 'RESPONDENT':
      return { payoutToClaimant: 0, payoutToRespondent: net, slashedToTreasury };
    case 'SPLIT': {
      const claimantShare = clamp(0.55 - args.gate * 0.10, 0.45, 0.60);
      const a = clamp(net * claimantShare, 0, net);
      return { payoutToClaimant: a, payoutToRespondent: clamp(net - a, 0, net), slashedToTreasury };
    }
    case 'DISMISS':
    default:
      return { payoutToClaimant: 0, payoutToRespondent: 0, slashedToTreasury };
  }
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * onChainArbitrationEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function onChainArbitrationEngine(input: M55Input, emit: MechanicEmitter): M55Output {
  const contractId = String(input.contractId ?? '');

  const runId =
    (typeof input.runId === 'string' && input.runId.length > 0 ? input.runId : computeHash(JSON.stringify(input))) ??
    computeHash('m55:fallback');

  const seed =
    (typeof input.seed === 'string' && input.seed.length > 0 ? input.seed : computeHash(runId + ':m55:seed')) ??
    computeHash('m55:seed:fallback');

  const tick = clamp((input.tick as number) ?? 0, 0, Math.max(0, RUN_TOTAL_TICKS - 1));

  const dispute: DisputePayload =
    input.disputePayload ??
    ({
      seed,
      runId,
      tick,
      claimantId: '',
      respondentId: '',
      disputeType: 'OTHER',
      amountInDispute: 0,
      claimedDamages: 0,
      claimantStatement: '',
      respondentStatement: '',
      evidenceHashes: [],
      proofIds: [],
      meta: {},
    } as DisputePayload);

  const disputeType: DisputeType = (dispute.disputeType ?? 'OTHER') as DisputeType;
  const amountInDispute = clamp(dispute.amountInDispute ?? 0, 0, M55_BOUNDS.MAX_AMOUNT);
  const claimedDamages = clamp(dispute.claimedDamages ?? 0, 0, M55_BOUNDS.MAX_AMOUNT);

  // Deterministic evidence ordering (server-verifiable, prevents reorder attacks)
  const evidenceHashes = seededShuffle(
    (Array.isArray(dispute.evidenceHashes) ? dispute.evidenceHashes : []).filter(x => typeof x === 'string' && x.length > 0),
    seed + ':m55:evidence',
  );
  const proofIds = seededShuffle(
    (Array.isArray(dispute.proofIds) ? dispute.proofIds : []).filter(x => typeof x === 'string' && x.length > 0),
    seed + ':m55:proofs',
  );

  const claimantLen = typeof dispute.claimantStatement === 'string' ? dispute.claimantStatement.length : 0;
  const respondentLen = typeof dispute.respondentStatement === 'string' ? dispute.respondentStatement.length : 0;

  // Deterministic schedules / context
  const macroSchedule = buildMacroSchedule(seed + ':m55:macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':m55:chaos', CHAOS_WINDOWS_PER_RUN);

  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const inChaosWindow = isTickInChaosWindow(tick, chaosWindows);
  const runPhase = deriveRunPhase(tick);
  const pressureTier = derivePressureTierFromAmount(amountInDispute + claimedDamages);

  const decayRate = computeDecayRate(macroRegime, M55_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  // Weights for pool selection (forces usage of weight tables/constants)
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const policyCard = pickPolicyCard(seed, tick, pressureWeight * phaseWeight, regimeWeight);

  // Dispute hash (ledger anchor)
  const disputeHash = computeHash(
    JSON.stringify({
      contractId,
      runId,
      tick,
      disputeType,
      amountInDispute,
      claimedDamages,
      claimantId: dispute.claimantId ?? '',
      respondentId: dispute.respondentId ?? '',
      claimantLen,
      respondentLen,
      evidenceHashes,
      proofIds,
      policyCardId: policyCard.id,
      macroRegime,
      inChaosWindow,
    }),
  );

  emit({
    event: 'DISPUTE_RAISED',
    mechanic_id: 'M55',
    tick,
    runId,
    payload: {
      contractId,
      disputeHash,
      disputeType,
      amountInDispute,
      claimedDamages,
      evidenceCount: evidenceHashes.length,
      proofCount: proofIds.length,
    },
  });

  emit({
    event: 'ARBITRATION_OPENED',
    mechanic_id: 'M55',
    tick,
    runId,
    payload: {
      contractId,
      disputeHash,
      macroRegime,
      runPhase,
      pressureTier,
      inChaosWindow,
      policyCardId: policyCard.id,
      decayRate,
      exitPulseMultiplier,
      regimeMultiplier,
    },
  });

  const scored = computeRuleScore({
    disputeType,
    amountInDispute,
    claimedDamages,
    claimantLen,
    respondentLen,
    evidenceCount: evidenceHashes.length,
    proofCount: proofIds.length,
    inChaosWindow,
    macroRegime,
    runPhase,
    pressureTier,
    decayRate,
  });

  const verdict = decideVerdict(scored.score);

  // Deterministic gate influences split bias + fee
  const gate = seededIndex(seed + ':m55:gate', tick, 1000) / 1000;

  const payouts = computePayouts({
    verdict,
    amountInDispute,
    claimedDamages,
    regimeMultiplier,
    exitPulseMultiplier,
    inChaosWindow,
    gate,
  });

  // Apply verdict only if contractId is present; otherwise keep it as issued but not applied.
  const verdictApplied = contractId.length > 0;

  const arbitrationId = computeHash('M55:' + runId + ':' + tick + ':' + disputeHash);

  const auditHash = computeHash(
    JSON.stringify({
      arbitrationId,
      contractId,
      runId,
      tick,
      verdict,
      verdictApplied,
      score: scored.score,
      reasons: scored.reasons,
      payouts,
      macroRegime,
      runPhase,
      pressureTier,
      inChaosWindow,
      decayRate,
      exitPulseMultiplier,
      regimeMultiplier,
      policyCardId: policyCard.id,
      disputeHash,
      evidenceHead: evidenceHashes.slice(0, 3),
      proofsHead: proofIds.slice(0, 2),
      gate,
    }),
  );

  const arbitrationResult: ArbitrationResult = {
    arbitrationId,
    contractId,
    runId,
    tick,
    status: 'VERDICT_ISSUED',
    verdict,
    payoutToClaimant: payouts.payoutToClaimant,
    payoutToRespondent: payouts.payoutToRespondent,
    slashedToTreasury: payouts.slashedToTreasury,
    score: scored.score,
    reasons: scored.reasons,
    disputeHash,
    runPhase,
    macroRegime,
    pressureTier,
    inChaosWindow,
    policyCard,
    macroSchedule,
    chaosWindows,
    decayRate,
    exitPulseMultiplier,
    regimeMultiplier,
    auditHash,
  };

  emit({
    event: 'VERDICT_ISSUED',
    mechanic_id: 'M55',
    tick,
    runId,
    payload: {
      arbitrationId,
      contractId,
      disputeHash,
      verdict,
      verdictApplied,
      score: scored.score,
      reasons: scored.reasons,
      payoutToClaimant: payouts.payoutToClaimant,
      payoutToRespondent: payouts.payoutToRespondent,
      slashedToTreasury: payouts.slashedToTreasury,
      auditHash,
    },
  });

  return {
    arbitrationResult,
    verdictApplied,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M55MLInput {
  arbitrationResult?: ArbitrationResult;
  verdictApplied?: boolean;
  runId: string;
  tick: number;
}

export interface M55MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (here: computeHash deterministic)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * onChainArbitrationEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function onChainArbitrationEngineMLCompanion(input: M55MLInput): Promise<M55MLOutput> {
  const r = input.arbitrationResult;

  const factors: string[] = [];
  if (!r) {
    factors.push('No arbitration payload present');
  } else {
    factors.push(`Verdict: ${r.verdict}`);
    factors.push(`Score: ${r.score.toFixed(2)}`);
    factors.push(`Regime: ${r.macroRegime}`);
    factors.push(r.inChaosWindow ? 'Chaos window active' : 'Stable window');
    factors.push(`Fees: ${Math.round(r.slashedToTreasury)}`);
  }

  const base = r ? 0.25 : 0.1;
  const scoreBoost = r ? clamp(r.score * 0.55, 0, 0.55) : 0;
  const chaosPenalty = r?.inChaosWindow ? 0.10 : 0;
  const dismissPenalty = r?.verdict === 'DISMISS' ? 0.08 : 0;

  const score = clamp(base + scoreBoost - chaosPenalty - dismissPenalty, 0.01, 0.99);

  const recommendation =
    !r
      ? 'Provide arbitrationResult payload for evaluation.'
      : r.verdict === 'DISMISS'
        ? 'Case dismissed; add stronger evidence/proof anchors and refile outside chaos windows.'
        : r.verdict === 'SPLIT'
          ? 'Split verdict; negotiate terms and seal a new contract amendment to prevent repeat disputes.'
          : r.verdict === 'CLAIMANT'
            ? 'Claimant favored; execute remediation and tighten delivery proofs.'
            : 'Respondent favored; enforce proof discipline and close the dispute cleanly.';

  const auditHash = computeHash(
    JSON.stringify({
      runId: input.runId,
      tick: input.tick,
      arbitrationAuditHash: r?.auditHash ?? null,
      score,
      factors,
      recommendation,
      verdictApplied: input.verdictApplied ?? null,
    }) + ':ml:M55',
  );

  return {
    score,
    topFactors: factors.slice(0, 5),
    recommendation,
    auditHash,
    confidenceDecay: clamp((r?.decayRate ?? 0.05) * 2, 0.01, 0.35),
  };
}