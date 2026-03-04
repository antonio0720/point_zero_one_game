// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m76_contract_voting_modes_unanimous_majority_weighted.ts
//
// Mechanic : M76 — Contract Voting Modes: Unanimous, Majority, Weighted
// Family   : coop_governance   Layer: api_endpoint   Priority: 2   Batch: 2
// ML Pair  : m76a
// Deps     : M26, M28
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

// ── Import Anchors (keep every import “accessible” + used) ────────────────────

/**
 * Runtime access to the canonical mechanicsUtils symbols imported by this mechanic.
 * (Useful for debugging, inspection, and keeping generator-wide imports “live”.)
 */
export const M76_IMPORTED_SYMBOLS = {
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

/**
 * Type-only anchor to ensure every imported domain type remains referenced in-module.
 */
export type M76_ImportedTypesAnchor = {
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

// ── Voting types (local to M76; avoids forcing changes into ./types.ts) ───────

export type VotingMode = 'UNANIMOUS' | 'MAJORITY' | 'WEIGHTED';
export type VoteChoice = 'YES' | 'NO' | 'ABSTAIN';

export interface VoteConfig {
  mode?: VotingMode;
  quorumPct?: number; // 0..1 of eligible
  quorumMin?: number; // absolute minimum voters (non-abstain)
  majorityThresholdPct?: number; // default 0.50; clamped [0.50..0.99]
  weights?: Record<string, number>; // voterId -> weight (only meaningful for WEIGHTED; still allowed for others)
  weightSeedSalt?: string; // extra salt for server-side rotation without breaking determinism
  allowAbstain?: boolean; // default true
}

export interface VoteCast {
  voterId: string;
  choice: VoteChoice;
  weight: number;
}

export interface VoteResult {
  contractId: string;
  mode: VotingMode;

  eligibleVoters: number;
  participatingVoters: number;
  requiredQuorum: number;
  quorumReached: boolean;

  yes: number;
  no: number;
  abstain: number;

  yesWeight: number;
  noWeight: number;
  abstainWeight: number;

  passed: boolean;
  tieBrokenBy?: string;

  // Deterministic audit artifacts
  seed: string;
  auditHash: string;

  // Inputs echoed for verification/debug (never authoritative for auth)
  weights: Record<string, number>;
  votes: VoteCast[];

  // Context used for bounded chaos (telemetry only)
  tick: number;
  phase: RunPhase;
  regime: MacroRegime;
  pressureTier: PressureTier;
  inChaos: boolean;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M76Input {
  contractId?: string;
  voteConfig?: VoteConfig;
  participantIds?: string[];

  // Optional execution context (safe to omit)
  tick?: number;
  pressureTier?: PressureTier;

  // Optional vote payloads (safe to omit; will deterministically simulate)
  votes?: Record<string, VoteChoice> | Array<{ voterId: string; choice: VoteChoice }>;
}

export interface M76Output {
  voteResult: VoteResult;
  votingMode: string;
  quorumReached: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M76Event = 'VOTE_OPENED' | 'VOTE_CAST' | 'VOTE_RESOLVED' | 'QUORUM_REACHED';

export interface M76TelemetryPayload extends MechanicTelemetryPayload {
  event: M76Event;
  mechanic_id: 'M76';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M76_BOUNDS = {
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

// ── Internal helpers (deterministic, no state mutation) ────────────────────

function m76DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m76DeriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const sorted = [...(schedule ?? [])].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m76InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m76DerivePressureTier(participants: number, inChaos: boolean): PressureTier {
  // Deterministic heuristic (input may override)
  if (inChaos) return participants >= 6 ? 'CRITICAL' : 'HIGH';
  if (participants <= 2) return 'LOW';
  if (participants <= 5) return 'MEDIUM';
  if (participants <= 8) return 'HIGH';
  return 'CRITICAL';
}

function m76NormalizeConfig(cfg?: VoteConfig): Required<
  Pick<VoteConfig, 'mode' | 'quorumPct' | 'quorumMin' | 'majorityThresholdPct' | 'allowAbstain'>
> &
  Pick<VoteConfig, 'weights' | 'weightSeedSalt'> {
  const mode: VotingMode = cfg?.mode ?? 'MAJORITY';
  const quorumPct = clamp(Number(cfg?.quorumPct ?? 0.5), 0, 1);
  const quorumMin = Math.max(0, Math.floor(Number(cfg?.quorumMin ?? 0)));
  const majorityThresholdPct = clamp(Number(cfg?.majorityThresholdPct ?? 0.5), 0.5, 0.99);
  const allowAbstain = cfg?.allowAbstain ?? true;
  return { mode, quorumPct, quorumMin, majorityThresholdPct, allowAbstain, weights: cfg?.weights, weightSeedSalt: cfg?.weightSeedSalt };
}

function m76CoerceVotes(
  seed: string,
  tick: number,
  participants: string[],
  allowAbstain: boolean,
  raw?: M76Input['votes'],
): Record<string, VoteChoice> {
  const out: Record<string, VoteChoice> = {};

  // 1) Apply provided votes
  if (raw && Array.isArray(raw)) {
    for (const v of raw) out[String(v.voterId)] = v.choice;
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) out[String(k)] = v as VoteChoice;
  }

  // 2) Deterministically fill missing voters
  for (let i = 0; i < participants.length; i++) {
    const voterId = participants[i];
    if (out[voterId]) continue;

    const r = seededIndex(seed, tick + 900 + i, 100); // 0..99
    if (allowAbstain && r >= 92) out[voterId] = 'ABSTAIN';
    else if (r < 56) out[voterId] = 'YES';
    else out[voterId] = 'NO';
  }

  return out;
}

function m76DeriveWeights(
  seed: string,
  tick: number,
  participants: string[],
  pressureTier: PressureTier,
  phase: RunPhase,
  regime: MacroRegime,
  inChaos: boolean,
  cfgWeights?: Record<string, number>,
  weightSeedSalt?: string,
): Record<string, number> {
  const weights: Record<string, number> = {};
  const salt = String(weightSeedSalt ?? '');
  const seed2 = computeHash(`${seed}:weights:${salt}`);

  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(`${seed2}:pool`, pressureWeight * phaseWeight, regimeWeight);
  const fallbackOpp = OPPORTUNITY_POOL[seededIndex(seed2, tick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = inChaos ? computeDecayRate(regime, M76_BOUNDS.BASE_DECAY_RATE) : 0;

  // Deterministic "deck id" influence (keeps DEFAULT_CARD_IDS live and observable)
  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed2}:deck`);
  const deckTopId = deck[0] ?? DEFAULT_CARD.id;

  for (let i = 0; i < participants.length; i++) {
    const id = participants[i];

    // If explicitly supplied, respect it (still bounded).
    const explicit = cfgWeights?.[id];
    if (typeof explicit === 'number' && Number.isFinite(explicit)) {
      weights[id] = clamp(Math.round(explicit), 1, 100_000);
      continue;
    }

    // Else derive a weight from deterministic economic signals:
    const pick = pool[seededIndex(seed2, tick + 300 + i, Math.max(1, pool.length))] ?? fallbackOpp;
    const basisMoney = Number(pick.cost ?? pick.downPayment ?? fallbackOpp.cost ?? fallbackOpp.downPayment ?? 1_000);
    const basis = Math.max(1, Math.round(basisMoney / 1_000));

    // DeckTopId nudges weight in a bounded way (string hash -> 0..7)
    const deckNudge = seededIndex(computeHash(`${seed2}:${deckTopId}:${id}`), tick + i, 8);

    // Regime & pulse scaling, then chaos decay
    const scaled = basis * regimeMul * exitPulse * (1 + deckNudge * 0.02);
    const decayed = inChaos ? scaled * (1 - decay) : scaled;

    weights[id] = clamp(Math.round(decayed), 1, 100_000);
  }

  return weights;
}

function m76Tally(
  participants: string[],
  choices: Record<string, VoteChoice>,
  weights: Record<string, number>,
): {
  votes: VoteCast[];
  yes: number;
  no: number;
  abstain: number;
  yesWeight: number;
  noWeight: number;
  abstainWeight: number;
  participatingVoters: number;
} {
  const votes: VoteCast[] = [];

  let yes = 0;
  let no = 0;
  let abstain = 0;

  let yesWeight = 0;
  let noWeight = 0;
  let abstainWeight = 0;

  let participatingVoters = 0;

  for (const voterId of participants) {
    const choice = choices[voterId] ?? 'ABSTAIN';
    const weight = clamp(Math.round(Number(weights[voterId] ?? 1)), 1, 100_000);

    votes.push({ voterId, choice, weight });

    if (choice === 'YES') {
      yes++;
      yesWeight += weight;
      participatingVoters++;
    } else if (choice === 'NO') {
      no++;
      noWeight += weight;
      participatingVoters++;
    } else {
      abstain++;
      abstainWeight += weight;
    }
  }

  return { votes, yes, no, abstain, yesWeight, noWeight, abstainWeight, participatingVoters };
}

function m76ResolvePass(
  mode: VotingMode,
  quorumReached: boolean,
  majorityThresholdPct: number,
  yes: number,
  no: number,
  yesWeight: number,
  noWeight: number,
  tieBreakOrder: string[],
  choices: Record<string, VoteChoice>,
): { passed: boolean; tieBrokenBy?: string } {
  if (!quorumReached) return { passed: false };

  const denomCount = yes + no;
  const denomWeight = yesWeight + noWeight;

  if (mode === 'UNANIMOUS') {
    return { passed: denomCount > 0 && no === 0 && yes === denomCount };
  }

  if (mode === 'MAJORITY') {
    if (denomCount === 0) return { passed: false };
    const ratio = yes / denomCount;

    if (yes === no) {
      const tb = tieBreakOrder[0] ?? '';
      const c = choices[tb] ?? 'ABSTAIN';
      return { passed: c === 'YES', tieBrokenBy: tb || undefined };
    }

    return { passed: ratio >= majorityThresholdPct };
  }

  // WEIGHTED
  if (denomWeight === 0) return { passed: false };
  const ratioW = yesWeight / denomWeight;

  if (yesWeight === noWeight) {
    const tb = tieBreakOrder[0] ?? '';
    const c = choices[tb] ?? 'ABSTAIN';
    return { passed: c === 'YES', tieBrokenBy: tb || undefined };
  }

  return { passed: ratioW >= majorityThresholdPct };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * contractVotingResolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function contractVotingResolver(input: M76Input, emit: MechanicEmitter): M76Output {
  const contractId = String(input.contractId ?? '');
  const participantIds = (Array.isArray(input.participantIds) ? input.participantIds : []).map(String);
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const cfg = m76NormalizeConfig(input.voteConfig);
  const eligibleVoters = participantIds.length;

  // Deterministic seed (no throws; stable for server verification)
  const seed = computeHash(
    JSON.stringify({
      m: 'M76',
      contractId,
      participantIds,
      tick,
      cfg: {
        mode: cfg.mode,
        quorumPct: cfg.quorumPct,
        quorumMin: cfg.quorumMin,
        majorityThresholdPct: cfg.majorityThresholdPct,
        allowAbstain: cfg.allowAbstain,
        weightSeedSalt: cfg.weightSeedSalt ?? '',
        // weights intentionally excluded from seed unless provided:
        weightsHash: cfg.weights ? computeHash(JSON.stringify(Object.keys(cfg.weights).sort().map(k => [k, cfg.weights?.[k]]))) : '',
      },
    }),
  );

  // Deterministic context (bounded chaos)
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  const phase = m76DerivePhase(tick);
  const regime = m76DeriveRegime(tick, macroSchedule);
  const inChaos = m76InChaosWindow(tick, chaosWindows);

  const pressureTier = (input.pressureTier as PressureTier) ?? m76DerivePressureTier(eligibleVoters, inChaos);

  const requestId = computeHash(JSON.stringify(input));

  emit({
    event: 'VOTE_OPENED',
    mechanic_id: 'M76',
    tick,
    runId: requestId,
    payload: {
      contractId,
      eligibleVoters,
      mode: cfg.mode,
      tick,
      phase,
      regime,
      inChaos,
    },
  });

  // Votes + weights
  const choices = m76CoerceVotes(seed, tick, participantIds, cfg.allowAbstain, input.votes);
  const weights = m76DeriveWeights(
    seed,
    tick,
    participantIds,
    pressureTier,
    phase,
    regime,
    inChaos,
    cfg.weights,
    cfg.weightSeedSalt,
  );

  // Emit VOTE_CAST per voter (deterministic order for ledger verification)
  const castOrder = seededShuffle(participantIds, `${seed}:castOrder`);
  for (let i = 0; i < castOrder.length; i++) {
    const voterId = castOrder[i];
    emit({
      event: 'VOTE_CAST',
      mechanic_id: 'M76',
      tick,
      runId: requestId,
      payload: {
        contractId,
        voterId,
        choice: choices[voterId] ?? 'ABSTAIN',
        weight: weights[voterId] ?? 1,
        idx: i,
      },
    });
  }

  const tally = m76Tally(participantIds, choices, weights);

  // Quorum computation (non-abstain voters)
  const requiredQuorum = Math.max(
    cfg.quorumMin,
    Math.ceil(clamp(cfg.quorumPct, 0, 1) * eligibleVoters),
  );

  const quorumReached = eligibleVoters === 0 ? false : tally.participatingVoters >= requiredQuorum;

  if (quorumReached) {
    emit({
      event: 'QUORUM_REACHED',
      mechanic_id: 'M76',
      tick,
      runId: requestId,
      payload: {
        contractId,
        eligibleVoters,
        participatingVoters: tally.participatingVoters,
        requiredQuorum,
      },
    });
  }

  const tieBreakOrder = seededShuffle(participantIds, `${seed}:tiebreak`);
  const decision = m76ResolvePass(
    cfg.mode,
    quorumReached,
    cfg.majorityThresholdPct,
    tally.yes,
    tally.no,
    tally.yesWeight,
    tally.noWeight,
    tieBreakOrder,
    choices,
  );

  // Bounded effect score (kept for downstream systems; uses imports intentionally)
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decayRate = computeDecayRate(regime, M76_BOUNDS.BASE_DECAY_RATE);

  const effectRaw =
    (tally.participatingVoters / Math.max(1, eligibleVoters)) *
    (decision.passed ? 1.0 : 0.6) *
    (pressureW * phaseW * regimeW) *
    (regimeMul * exitPulse) *
    (inChaos ? (1 - decayRate) : 1);

  const effectScore = clamp(effectRaw * M76_BOUNDS.MAX_EFFECT * M76_BOUNDS.EFFECT_MULTIPLIER, M76_BOUNDS.MIN_EFFECT, M76_BOUNDS.MAX_EFFECT);

  const auditHash = computeHash(
    JSON.stringify({
      contractId,
      mode: cfg.mode,
      tick,
      eligibleVoters,
      participatingVoters: tally.participatingVoters,
      requiredQuorum,
      quorumReached,
      yes: tally.yes,
      no: tally.no,
      abstain: tally.abstain,
      yesWeight: tally.yesWeight,
      noWeight: tally.noWeight,
      abstainWeight: tally.abstainWeight,
      passed: decision.passed,
      tieBrokenBy: decision.tieBrokenBy ?? '',
      effectScore: Math.round(effectScore),
      seed,
    }),
  );

  const voteResult: VoteResult = {
    contractId,
    mode: cfg.mode,

    eligibleVoters,
    participatingVoters: tally.participatingVoters,
    requiredQuorum,
    quorumReached,

    yes: tally.yes,
    no: tally.no,
    abstain: tally.abstain,

    yesWeight: tally.yesWeight,
    noWeight: tally.noWeight,
    abstainWeight: tally.abstainWeight,

    passed: decision.passed,
    tieBrokenBy: decision.tieBrokenBy,

    seed,
    auditHash,

    weights,
    votes: tally.votes,

    tick,
    phase,
    regime,
    pressureTier,
    inChaos,
  };

  emit({
    event: 'VOTE_RESOLVED',
    mechanic_id: 'M76',
    tick,
    runId: requestId,
    payload: {
      contractId,
      mode: cfg.mode,
      quorumReached,
      requiredQuorum,
      participatingVoters: tally.participatingVoters,
      yes: tally.yes,
      no: tally.no,
      abstain: tally.abstain,
      yesWeight: tally.yesWeight,
      noWeight: tally.noWeight,
      passed: decision.passed,
      tieBrokenBy: decision.tieBrokenBy ?? null,
      auditHash,
      effectScore: Math.round(effectScore),
      // keep shared pools observable (debug only)
      defaultCardId: DEFAULT_CARD.id,
      defaultDeckTop: seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckTop`)[0] ?? DEFAULT_CARD.id,
    },
  });

  return {
    voteResult,
    votingMode: cfg.mode,
    quorumReached,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M76MLInput {
  voteResult?: VoteResult;
  votingMode?: string;
  quorumReached?: boolean;
  runId: string;
  tick: number;
}

export interface M76MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (uses computeHash here)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * contractVotingResolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function contractVotingResolverMLCompanion(input: M76MLInput): Promise<M76MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const vr = input.voteResult;

  const quorum = Boolean(input.quorumReached ?? vr?.quorumReached ?? false);
  const passed = Boolean(vr?.passed ?? false);

  // Severity: quorum failure is a hard penalty; tie-breaks reduce confidence.
  const tiePenalty = vr?.tieBrokenBy ? 0.15 : 0.0;
  const quorumPenalty = quorum ? 0.0 : 0.45;
  const failPenalty = passed ? 0.0 : 0.25;

  const participation = vr?.eligibleVoters ? (vr.participatingVoters / Math.max(1, vr.eligibleVoters)) : 0;
  const participationBonus = clamp(participation, 0, 1) * 0.15;

  const score = clamp(0.75 + participationBonus - quorumPenalty - failPenalty - tiePenalty, 0.01, 0.99);

  // Confidence decay: if we know regime, use it; else neutral.
  const regime: MacroRegime = (vr?.regime as MacroRegime) ?? 'NEUTRAL';
  const confidenceDecay = computeDecayRate(regime, M76_BOUNDS.BASE_DECAY_RATE);

  const hintPick = seededIndex(computeHash(`M76ML:${tick}:${vr?.auditHash ?? ''}:${score}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintPick] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `mode=${vr?.mode ?? (input.votingMode ?? 'MAJORITY')}`,
    `quorum=${quorum ? 'yes' : 'no'} (${vr?.participatingVoters ?? 0}/${vr?.requiredQuorum ?? 0})`,
    `result=${passed ? 'PASS' : 'FAIL'}${vr?.tieBrokenBy ? ` (tieBreak=${vr.tieBrokenBy})` : ''}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation = !quorum
    ? 'Quorum failed: re-open the vote with a higher participation plan or adjust quorum bounds.'
    : passed
      ? 'Vote passed: lock the decision to ledger and execute the contract state transition.'
      : 'Vote failed: pause execution, surface dissent reasons, and propose a revised motion.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M76'),
    confidenceDecay,
  };
}