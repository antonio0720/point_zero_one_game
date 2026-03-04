// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m16_live_table_hot_seat_vote.ts
//
// Mechanic : M16 — Live Table Hot Seat Vote
// Family   : social_engine   Layer: api_endpoint   Priority: 1   Batch: 1
// ML Pair  : m16a
// Deps     : M15
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
 * Runtime access to canonical mechanicsUtils symbols imported by this mechanic.
 * Keeps shared imports “live” and directly reachable for debugging/tests.
 */
export const M16_IMPORTED_SYMBOLS = {
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
 * Type-only anchor so every imported domain type remains referenced in-module.
 */
export type M16_ImportedTypesAnchor = {
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

// ── Local domain types (M16-only; not provided in ./types import list) ───────

export type VoteChoice = string;

export interface TableVoteCast {
  voterUserId: string;
  choice: VoteChoice; // typically a targetUserId (hot seat candidate)
  weight?: number; // default 1
  castAtTick?: number;
}

export interface TableVoteRequest {
  tableId: string;
  sessionId: string;
  requestId: string;

  /**
   * Candidate set for hot seat assignment.
   * If empty, M16 resolves deterministically to NONE without applying an effect.
   */
  candidates: string[];

  /**
   * Snapshot votes included with this request; if omitted, M16 will resolve
   * deterministically using seed-based tie-break (still emits OPENED).
   */
  votes?: TableVoteCast[];

  /**
   * Optional: When provided, vote closes at this tick; otherwise computed.
   */
  closesAtTick?: number;

  /**
   * Safety gate: if explicitly false, do not apply effect.
   */
  consentGranted?: boolean;

  /**
   * Optional metadata passthrough for auditing.
   */
  meta?: Record<string, unknown>;
}

export interface VoteTally {
  choice: VoteChoice;
  totalWeight: number;
  voterCount: number;
}

export interface VoteResult {
  requestId: string;
  tableId: string;
  sessionId: string;

  openedAtTick: number;
  closesAtTick: number;
  resolvedAtTick: number;

  candidates: string[];

  totalVoters: number;
  tallies: VoteTally[];

  winningChoice: VoteChoice | null;
  tieBroken: boolean;

  auditHash: string;
}

export type HotSeatEffectType =
  | 'NONE'
  | 'TEMPO_LOCK'
  | 'COST_SPIKE'
  | 'PROOF_BURDEN'
  | 'SHIELD_THIN'
  | 'RISK_SPIKE';

export interface HotSeatEffect {
  id: string;
  requestId: string;

  tableId: string;
  sessionId: string;

  type: HotSeatEffectType;

  targetUserId: string | null;

  magnitude: number; // 0..MAX_EFFECT
  durationTicks: number; // 0..RUN_TOTAL_TICKS

  appliedAtTick: number;
  expiresAtTick: number;

  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  runPhase: RunPhase;

  cardHint: GameCard;
  deckHintTop: string;
  opportunityHint: GameCard;

  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M16Input {
  tableVoteRequest?: TableVoteRequest;
  stateTick?: number;
}

export interface M16Output {
  voteResult: VoteResult;
  hotSeatEffect: HotSeatEffect;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M16Event = 'HOT_SEAT_VOTE_OPENED' | 'VOTE_CAST' | 'VOTE_RESOLVED' | 'HOT_SEAT_EFFECT_APPLIED';

export interface M16TelemetryPayload extends MechanicTelemetryPayload {
  event: M16Event;
  mechanic_id: 'M16';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M16_BOUNDS = {
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

// ── Effect catalog (deterministic selection) ───────────────────────────────

type HotSeatCatalogEntry = {
  id: string;
  type: Exclude<HotSeatEffectType, 'NONE'>;
  baseMagnitude: number;
  baseDurationTicks: number;
};

export const M16_HOTSEAT_CATALOG: HotSeatCatalogEntry[] = [
  { id: 'hs-001', type: 'TEMPO_LOCK', baseMagnitude: 2_200, baseDurationTicks: 12 },
  { id: 'hs-002', type: 'COST_SPIKE', baseMagnitude: 2_800, baseDurationTicks: 12 },
  { id: 'hs-003', type: 'PROOF_BURDEN', baseMagnitude: 2_400, baseDurationTicks: 18 },
  { id: 'hs-004', type: 'SHIELD_THIN', baseMagnitude: 2_000, baseDurationTicks: 18 },
  { id: 'hs-005', type: 'RISK_SPIKE', baseMagnitude: 3_500, baseDurationTicks: 8 },
];

// ── Internal helpers (deterministic, no state mutation) ────────────────────

function m16PickKey<T extends string>(obj: Record<T, unknown>, seed: string, salt: number): T {
  const keys = Object.keys(obj) as T[];
  const idx = seededIndex(seed, salt, Math.max(1, keys.length));
  return (keys[idx] ?? keys[0]) as T;
}

function m16DerivePhase(tick: number, seed: string): RunPhase {
  // Avoid hardcoding union literals; choose from PHASE_WEIGHTS keys.
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  // Bias toward later phases as ticks increase, but keep deterministic fallback.
  const keys = Object.keys(PHASE_WEIGHTS) as RunPhase[];
  if (keys.length === 0) return (('' as unknown) as RunPhase);
  const bias = clamp(Math.floor((t / Math.max(1, RUN_TOTAL_TICKS - 1)) * keys.length), 0, keys.length - 1);
  const jitter = seededIndex(seed, t + 11, keys.length);
  const idx = clamp(bias + (jitter % 2 === 0 ? 0 : -1), 0, keys.length - 1);
  return (keys[idx] ?? keys[0]) as RunPhase;
}

function m16DeriveRegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m16InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m16DerivePressureTier(seed: string, tick: number, runPhase: RunPhase, inChaos: boolean, regime: MacroRegime): PressureTier {
  // Choose from PRESSURE_WEIGHTS keys; bias toward higher under chaos/crisis.
  const keys = Object.keys(PRESSURE_WEIGHTS) as PressureTier[];
  if (keys.length === 0) return (('' as unknown) as PressureTier);

  if (inChaos) return m16PickKey(PRESSURE_WEIGHTS as Record<PressureTier, unknown>, seed, tick + 123);
  if (String(regime) === 'CRISIS') return m16PickKey(PRESSURE_WEIGHTS as Record<PressureTier, unknown>, seed, tick + 321);

  // Otherwise: deterministic from phase.
  const phaseSalt = seededIndex(seed, tick + 77, 10_000);
  const idx = seededIndex(seed, phaseSalt + (PHASE_WEIGHTS[runPhase] ?? 1), keys.length);
  return (keys[idx] ?? keys[0]) as PressureTier;
}

function m16NoVoteResult(requestId: string, tick: number): VoteResult {
  const auditHash = computeHash(JSON.stringify({ requestId, tick, type: 'no_vote' }) + ':M16');
  return {
    requestId,
    tableId: '',
    sessionId: '',
    openedAtTick: tick,
    closesAtTick: tick,
    resolvedAtTick: tick,
    candidates: [],
    totalVoters: 0,
    tallies: [],
    winningChoice: null,
    tieBroken: false,
    auditHash,
  };
}

function m16NoHotSeatEffect(requestId: string, tick: number, seed: string): HotSeatEffect {
  const runPhase = m16DerivePhase(tick, seed);
  const macroRegime = m16PickKey(EXIT_PULSE_MULTIPLIERS as Record<MacroRegime, unknown>, seed, tick + 5);
  const pressureTier = m16PickKey(PRESSURE_WEIGHTS as Record<PressureTier, unknown>, seed, tick + 9);

  const deckHintTop = seededShuffle(DEFAULT_CARD_IDS, seed + ':no:deck')[0] ?? DEFAULT_CARD.id;
  const opportunityHint = OPPORTUNITY_POOL[seededIndex(seed, tick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const auditHash = computeHash(JSON.stringify({ requestId, tick, type: 'NONE' }) + ':M16');
  return {
    id: 'hs-none',
    requestId,
    tableId: '',
    sessionId: '',
    type: 'NONE',
    targetUserId: null,
    magnitude: 0,
    durationTicks: 0,
    appliedAtTick: tick,
    expiresAtTick: tick,
    macroRegime,
    pressureTier,
    runPhase,
    cardHint: DEFAULT_CARD,
    deckHintTop,
    opportunityHint,
    auditHash,
  };
}

function m16TallyVotes(candidates: string[], votes: TableVoteCast[]): { tallies: VoteTally[]; totalVoters: number } {
  const tallyMap = new Map<VoteChoice, { totalWeight: number; voters: Set<string> }>();

  for (const v of votes ?? []) {
    const choice = String(v.choice ?? '');
    if (!choice) continue;
    if (candidates.length > 0 && !candidates.includes(choice)) continue;

    const weight = Math.max(1, Math.floor(Number(v.weight ?? 1)));
    const voterId = String(v.voterUserId ?? '');
    if (!voterId) continue;

    const existing = tallyMap.get(choice) ?? { totalWeight: 0, voters: new Set<string>() };
    existing.totalWeight += weight;
    existing.voters.add(voterId);
    tallyMap.set(choice, existing);
  }

  const tallies: VoteTally[] = Array.from(tallyMap.entries())
    .map(([choice, data]) => ({
      choice,
      totalWeight: data.totalWeight,
      voterCount: data.voters.size,
    }))
    .sort((a, b) => (b.totalWeight - a.totalWeight) || (b.voterCount - a.voterCount) || a.choice.localeCompare(b.choice));

  const uniqueVoters = new Set<string>();
  for (const t of tallyMap.values()) for (const v of t.voters) uniqueVoters.add(v);

  return { tallies, totalVoters: uniqueVoters.size };
}

function m16ResolveWinner(candidates: string[], tallies: VoteTally[], seed: string, tick: number): { winningChoice: VoteChoice | null; tieBroken: boolean } {
  if (!candidates || candidates.length === 0) return { winningChoice: null, tieBroken: false };

  if (!tallies || tallies.length === 0) {
    // Deterministic fallback: pick candidate by seed.
    const idx = seededIndex(seed, tick + 101, candidates.length);
    return { winningChoice: candidates[idx] ?? candidates[0] ?? null, tieBroken: true };
  }

  const top = tallies[0];
  const topWeight = top.totalWeight;

  const tied = tallies.filter(t => t.totalWeight === topWeight);
  if (tied.length <= 1) return { winningChoice: top.choice, tieBroken: false };

  // Tie-break: seed shuffle the tied choices deterministically.
  const tiedChoices = tied.map(t => t.choice);
  const shuffled = seededShuffle(tiedChoices, seed + ':tiebreak');
  return { winningChoice: shuffled[0] ?? top.choice, tieBroken: true };
}

function m16SelectEffect(seed: string, tick: number): HotSeatCatalogEntry {
  const shuffled = seededShuffle(M16_HOTSEAT_CATALOG, seed + ':catalog');
  const idx = seededIndex(seed, tick + 41, Math.max(1, shuffled.length));
  return shuffled[idx] ?? M16_HOTSEAT_CATALOG[0];
}

function m16ComputeEffectMagnitude(
  entry: HotSeatCatalogEntry,
  pressureTier: PressureTier,
  runPhase: RunPhase,
  macroRegime: MacroRegime,
  inChaos: boolean,
): number {
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const macroFactor = clamp(exitPulse * regimeMult, 0.25, 2.5);
  const chaosFactor = inChaos ? 1.25 : 1.0;

  const decay = computeDecayRate(macroRegime, M16_BOUNDS.BASE_DECAY_RATE);
  const drift = 1 + clamp(decay - M16_BOUNDS.BASE_DECAY_RATE, -0.01, 0.15);

  const raw =
    entry.baseMagnitude *
    M16_BOUNDS.EFFECT_MULTIPLIER *
    pressureW *
    phaseW *
    regimeW *
    macroFactor *
    chaosFactor *
    drift;

  return clamp(Math.round(raw), M16_BOUNDS.MIN_EFFECT, M16_BOUNDS.MAX_EFFECT);
}

function m16ComputeEffectDuration(seed: string, tick: number, base: number, inChaos: boolean): number {
  // Align duration to pulse cycle; longer under chaos.
  const chaos = inChaos ? 1.15 : 1.0;
  const jitter = 1 + (seededIndex(seed, tick + 301, 25) / 100); // 1.00..1.24
  const raw = base * chaos * jitter;

  const snapped = Math.round(raw / Math.max(1, M16_BOUNDS.PULSE_CYCLE)) * M16_BOUNDS.PULSE_CYCLE;
  return clamp(snapped, 0, M16_BOUNDS.PULSE_CYCLE * 6);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * liveTableHotSeatVote
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function liveTableHotSeatVote(input: M16Input, emit: MechanicEmitter): M16Output {
  const stateTick = clamp(((input.stateTick as number) ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const tableVoteRequest = input.tableVoteRequest;
  const requestId = computeHash(JSON.stringify({ mid: 'M16', t: stateTick, req: tableVoteRequest ?? null }));

  // Fail-closed: no request => no effect.
  if (!tableVoteRequest) {
    const seed = computeHash(requestId + ':no_request');
    const voteResult = m16NoVoteResult(requestId, stateTick);
    const hotSeatEffect = m16NoHotSeatEffect(requestId, stateTick, seed);

    emit({
      event: 'HOT_SEAT_VOTE_OPENED',
      mechanic_id: 'M16',
      tick: stateTick,
      runId: requestId,
      payload: { ok: false, reason: 'missing_request' },
    });

    return { voteResult, hotSeatEffect };
  }

  // Consent gate: explicit false => no effect.
  if (tableVoteRequest.consentGranted === false) {
    const seed = computeHash(requestId + ':consent_denied');
    const voteResult = {
      ...m16NoVoteResult(requestId, stateTick),
      tableId: tableVoteRequest.tableId,
      sessionId: tableVoteRequest.sessionId,
      candidates: [...(tableVoteRequest.candidates ?? [])],
      auditHash: computeHash(JSON.stringify({ requestId, reason: 'consent_denied', t: stateTick }) + ':M16'),
    };
    const hotSeatEffect = {
      ...m16NoHotSeatEffect(requestId, stateTick, seed),
      tableId: tableVoteRequest.tableId,
      sessionId: tableVoteRequest.sessionId,
      auditHash: computeHash(JSON.stringify({ requestId, reason: 'consent_denied_effect', t: stateTick }) + ':M16'),
    };

    emit({
      event: 'HOT_SEAT_VOTE_OPENED',
      mechanic_id: 'M16',
      tick: stateTick,
      runId: requestId,
      payload: {
        ok: false,
        reason: 'consent_denied',
        tableId: tableVoteRequest.tableId,
        sessionId: tableVoteRequest.sessionId,
        requestId: tableVoteRequest.requestId,
      },
    });

    return { voteResult, hotSeatEffect };
  }

  const seed = computeHash(
    `${requestId}:${tableVoteRequest.tableId}:${tableVoteRequest.sessionId}:${tableVoteRequest.requestId}:${stateTick}`,
  );

  // Deterministic macro/chaos fabric
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const runPhase = m16DerivePhase(stateTick, seed);
  const macroRegime = m16DeriveRegimeFromSchedule(
    stateTick,
    macroSchedule,
    m16PickKey(EXIT_PULSE_MULTIPLIERS as Record<MacroRegime, unknown>, seed, stateTick + 1),
  );
  const inChaos = m16InChaosWindow(stateTick, chaosWindows);
  const pressureTier = m16DerivePressureTier(seed, stateTick, runPhase, inChaos, macroRegime);

  const closesAtTick =
    typeof tableVoteRequest.closesAtTick === 'number'
      ? clamp(tableVoteRequest.closesAtTick, stateTick, RUN_TOTAL_TICKS)
      : clamp(stateTick + Math.max(2, M16_BOUNDS.FIRST_REFUSAL_TICKS), stateTick, RUN_TOTAL_TICKS);

  emit({
    event: 'HOT_SEAT_VOTE_OPENED',
    mechanic_id: 'M16',
    tick: stateTick,
    runId: requestId,
    payload: {
      ok: true,
      tableId: tableVoteRequest.tableId,
      sessionId: tableVoteRequest.sessionId,
      requestId: tableVoteRequest.requestId,
      openedAtTick: stateTick,
      closesAtTick,
      macroRegime,
      pressureTier,
      runPhase,
      inChaos,
    },
  });

  // Emit vote casts if present
  const votes = tableVoteRequest.votes ?? [];
  for (const v of votes) {
    emit({
      event: 'VOTE_CAST',
      mechanic_id: 'M16',
      tick: stateTick,
      runId: requestId,
      payload: {
        voterUserId: v.voterUserId,
        choice: v.choice,
        weight: v.weight ?? 1,
        castAtTick: v.castAtTick ?? stateTick,
      },
    });
  }

  const candidates = [...(tableVoteRequest.candidates ?? [])].filter(x => typeof x === 'string' && x.length > 0);

  const { tallies, totalVoters } = m16TallyVotes(candidates, votes);
  const { winningChoice, tieBroken } = m16ResolveWinner(candidates, tallies, seed, stateTick);

  const resolvedAtTick = clamp(stateTick, 0, RUN_TOTAL_TICKS);

  const voteResultAuditHash = computeHash(
    JSON.stringify({
      requestId,
      tableId: tableVoteRequest.tableId,
      sessionId: tableVoteRequest.sessionId,
      req: tableVoteRequest.requestId,
      openedAtTick: stateTick,
      closesAtTick,
      resolvedAtTick,
      totalVoters,
      tallies,
      winningChoice,
      tieBroken,
      macroRegime,
      pressureTier,
      runPhase,
      inChaos,
    }) + ':M16:vote',
  );

  const voteResult: VoteResult = {
    requestId: tableVoteRequest.requestId,
    tableId: tableVoteRequest.tableId,
    sessionId: tableVoteRequest.sessionId,
    openedAtTick: stateTick,
    closesAtTick,
    resolvedAtTick,
    candidates,
    totalVoters,
    tallies,
    winningChoice,
    tieBroken,
    auditHash: voteResultAuditHash,
  };

  emit({
    event: 'VOTE_RESOLVED',
    mechanic_id: 'M16',
    tick: stateTick,
    runId: requestId,
    payload: {
      winningChoice,
      tieBroken,
      totalVoters,
      tallies,
      auditHash: voteResultAuditHash,
    },
  });

  // Build card/deck/opportunity hints via shared pools
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const weightedPool = buildWeightedPool(seed + ':pool', pressureW * phaseW, regimeW);
  const poolPick = weightedPool[seededIndex(seed, stateTick + 7, Math.max(1, weightedPool.length))] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const deckHintTop = deckOrder[0] ?? DEFAULT_CARD.id;

  const opportunityHint = OPPORTUNITY_POOL[seededIndex(seed, stateTick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  // Select and compute effect
  const entry = m16SelectEffect(seed, stateTick);
  const magnitude = winningChoice ? m16ComputeEffectMagnitude(entry, pressureTier, runPhase, macroRegime, inChaos) : 0;
  const durationTicks = winningChoice ? m16ComputeEffectDuration(seed, stateTick, entry.baseDurationTicks, inChaos) : 0;

  const appliedAtTick = stateTick;
  const expiresAtTick = clamp(appliedAtTick + durationTicks, 0, RUN_TOTAL_TICKS);

  const hotSeatEffectAuditHash = computeHash(
    JSON.stringify({
      requestId,
      tableId: tableVoteRequest.tableId,
      sessionId: tableVoteRequest.sessionId,
      req: tableVoteRequest.requestId,
      winningChoice,
      effect: entry,
      magnitude,
      durationTicks,
      appliedAtTick,
      expiresAtTick,
      macroRegime,
      pressureTier,
      runPhase,
      inChaos,
      hints: { poolPickId: poolPick.id, deckHintTop, opportunityHintId: opportunityHint.id },
    }) + ':M16:effect',
  );

  const hotSeatEffect: HotSeatEffect = winningChoice
    ? {
        id: entry.id,
        requestId: tableVoteRequest.requestId,
        tableId: tableVoteRequest.tableId,
        sessionId: tableVoteRequest.sessionId,
        type: entry.type,
        targetUserId: winningChoice,
        magnitude,
        durationTicks,
        appliedAtTick,
        expiresAtTick,
        macroRegime,
        pressureTier,
        runPhase,
        cardHint: poolPick,
        deckHintTop,
        opportunityHint,
        auditHash: hotSeatEffectAuditHash,
      }
    : {
        ...m16NoHotSeatEffect(tableVoteRequest.requestId, stateTick, seed),
        tableId: tableVoteRequest.tableId,
        sessionId: tableVoteRequest.sessionId,
        auditHash: hotSeatEffectAuditHash,
      };

  emit({
    event: 'HOT_SEAT_EFFECT_APPLIED',
    mechanic_id: 'M16',
    tick: stateTick,
    runId: requestId,
    payload: {
      targetUserId: hotSeatEffect.targetUserId,
      type: hotSeatEffect.type,
      magnitude: hotSeatEffect.magnitude,
      durationTicks: hotSeatEffect.durationTicks,
      appliedAtTick,
      expiresAtTick,
      macroRegime,
      pressureTier,
      runPhase,
      inChaos,
      cardHintId: poolPick.id,
      deckHintTop,
      opportunityHintId: opportunityHint.id,
      auditHash: hotSeatEffectAuditHash,
    },
  });

  return { voteResult, hotSeatEffect };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M16MLInput {
  voteResult?: VoteResult;
  hotSeatEffect?: HotSeatEffect;
  runId: string;
  tick: number;
}

export interface M16MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * liveTableHotSeatVoteMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function liveTableHotSeatVoteMLCompanion(input: M16MLInput): Promise<M16MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);

  const vote = input.voteResult;
  const effect = input.hotSeatEffect;

  const magnitude = Number(effect?.magnitude ?? 0);
  const duration = Number(effect?.durationTicks ?? 0);
  const voters = Number(vote?.totalVoters ?? 0);

  const magnitudePct = clamp(magnitude / Math.max(1, M16_BOUNDS.MAX_EFFECT), 0, 1);
  const durationPct = clamp(duration / Math.max(1, M16_BOUNDS.PULSE_CYCLE * 6), 0, 1);
  const voterPct = clamp(voters / 8, 0, 1); // heuristic normalization

  // Higher magnitude/duration/voter participation => higher confidence/impact score.
  const score = clamp(0.10 + magnitudePct * 0.55 + durationPct * 0.25 + voterPct * 0.10, 0.01, 0.99);

  const regime: MacroRegime = effect?.macroRegime ?? m16PickKey(EXIT_PULSE_MULTIPLIERS as Record<MacroRegime, unknown>, computeHash(input.runId), tick + 1);
  const confidenceDecay = computeDecayRate(regime, M16_BOUNDS.BASE_DECAY_RATE);

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `voters=${voters}`,
    `target=${effect?.targetUserId ?? 'none'}`,
    `magnitude=${Math.round(magnitude)} (cap=${M16_BOUNDS.MAX_EFFECT})`,
    `durationTicks=${Math.round(duration)} (max=${M16_BOUNDS.PULSE_CYCLE * 6})`,
  ].slice(0, 5);

  const recommendation =
    !effect || effect.type === 'NONE' || !effect.targetUserId
      ? 'No hot seat effect applied: keep session flow normal and preserve tempo.'
      : score >= 0.80
        ? 'Hot seat is high-impact: surface it prominently and provide immediate counterplay UI.'
        : score >= 0.55
          ? 'Hot seat is moderate: track decay, avoid stacking penalties, and keep votes auditable.'
          : 'Hot seat is low-impact: log for audit and keep UI minimal.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M16'),
    confidenceDecay,
  };
}