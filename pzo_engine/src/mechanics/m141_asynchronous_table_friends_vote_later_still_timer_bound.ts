// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m141_asynchronous_table_friends_vote_later_still_timer_bound.ts
//
// Mechanic : M141 — Asynchronous Table: Friends Vote Later Still Timer-Bound
// Family   : ops   Layer: api_endpoint   Priority: 2   Batch: 3
// ML Pair  : m141a
// Deps     : M16, M76
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

// ── Import Anchors (keep every import accessible + used) ─────────────────────

export const M141_IMPORTED_SYMBOLS = {
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

export type M141_ImportedTypesAnchor = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Local contracts (api_endpoint layer; intentionally isolated from ./types)
// ─────────────────────────────────────────────────────────────────────────────

export type VoteTieBreaker = 'SEED' | 'NONE';

export interface AsyncVoteConfig {
  /** If false, async voting is disabled (default true). */
  enabled?: boolean;

  /** Options that can be voted on (default ['YES','NO']). */
  options?: string[];

  /** Quorum votes needed to resolve (default ceil(n/2)). */
  quorum?: number;

  /** If true, resolves early as soon as quorum is met (default true). */
  resolveEarlyOnQuorum?: boolean;

  /** If true, enforce run timer bound by clamping closesAtTick to RUN_TOTAL_TICKS-1 (default true). */
  enforceRunTimerBound?: boolean;

  /** Vote window length in ticks, if voteWindow does not provide it (default 24 ticks = 2 minutes). */
  defaultWindowTicks?: number;

  /** Tie breaker policy (default 'SEED'). */
  tieBreaker?: VoteTieBreaker;

  /** If true, include abstain as a valid vote choice (default false). */
  allowAbstain?: boolean;

  /** Optional context tags (audit only). */
  tags?: Record<string, unknown>;
}

export interface VoteWindow {
  /** Logical open tick for timer-bound enforcement. */
  openTick?: number;

  /** Logical close tick for timer-bound enforcement. */
  closeTick?: number;

  /** Time representation (optional). If absent, derived from ticks at 5s per tick. */
  nowMs?: number;
  opensAtMs?: number;
  closesAtMs?: number;

  /** Votes: participantId -> option */
  votes?: Record<string, string>;

  /** Optional options (overrides config options if present). */
  options?: string[];

  /** Optional quorum override. */
  requiredQuorum?: number;

  /** Optional cast hint (single vote payload for this request). */
  cast?: { voterId: string; choice: string };

  /** Optional previous digest for delta detection (not trusted). */
  prevVotesHash?: string;
}

export interface VoteResult {
  status: 'DISABLED' | 'OPEN' | 'RESOLVED' | 'EXPIRED';
  requestId: string;

  openedAtTick: number;
  closesAtTick: number;

  openedAtMs: number;
  closesAtMs: number;
  nowMs: number;

  participants: string[];
  options: string[];

  quorum: number;
  votesCast: number;

  counts: Record<string, number>;
  winner: string | null;
  tie: boolean;

  tieBreaker: VoteTieBreaker;
  timerBound: boolean;

  votesHash: string;
  auditHash: string;

  context: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M141Input {
  asyncVoteConfig?: AsyncVoteConfig;
  participantIds?: string[];
  voteWindow?: Record<string, unknown>;

  // Optional snapshot fields (commonly present via snapshotExtractor)
  stateTick?: number;
  stateRunPhase?: RunPhase;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
  stateSolvencyStatus?: SolvencyStatus;
  runId?: string;
  seed?: string;
}

export interface M141Output {
  asyncVoteActive: boolean;
  voteResult: VoteResult;
  timerBoundEnforced: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M141Event = 'ASYNC_VOTE_OPENED' | 'ASYNC_VOTE_CAST' | 'ASYNC_VOTE_RESOLVED';

export interface M141TelemetryPayload extends MechanicTelemetryPayload {
  event: M141Event;
  mechanic_id: 'M141';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M141_BOUNDS = {
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
// Internal helpers (pure, deterministic, no throws)
// ─────────────────────────────────────────────────────────────────────────────

const M141_MS_PER_TICK = 5_000; // 12 ticks/min

function m141NormalizeRegime(r: unknown): MacroRegime {
  return (r === 'BULL' || r === 'NEUTRAL' || r === 'BEAR' || r === 'CRISIS') ? r : 'NEUTRAL';
}

function m141NormalizePhase(p: unknown): RunPhase {
  return (p === 'EARLY' || p === 'MID' || p === 'LATE') ? p : 'MID';
}

function m141NormalizePressure(p: unknown): PressureTier {
  return (p === 'LOW' || p === 'MEDIUM' || p === 'HIGH' || p === 'CRITICAL') ? p : 'MEDIUM';
}

function m141NormalizeSolvency(s: unknown): SolvencyStatus {
  return (s === 'SOLVENT' || s === 'BLEED' || s === 'WIPED') ? s : 'SOLVENT';
}

function m141DerivePhaseFromTick(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m141RegimeAtTick(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    const et = typeof ev.tick === 'number' ? ev.tick : 0;
    if (et > t) break;
    if (ev.regimeChange) regime = m141NormalizeRegime(ev.regimeChange);
  }
  return regime;
}

function m141InChaos(tick: number, windows: ChaosWindow[]): boolean {
  if (!windows || windows.length === 0) return false;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function m141DerivePressureTier(phase: RunPhase, inChaos: boolean, regime: MacroRegime): PressureTier {
  let score = 0;
  if (phase === 'MID') score += 1;
  if (phase === 'LATE') score += 2;
  if (inChaos) score += 2;
  if (regime === 'BEAR') score += 1;
  if (regime === 'CRISIS') score += 2;

  if (score >= 5) return 'CRITICAL';
  if (score >= 3) return 'HIGH';
  if (score >= 1) return 'MEDIUM';
  return 'LOW';
}

function m141DeriveTickTier(pressure: PressureTier, inChaos: boolean): TickTier {
  if (pressure === 'CRITICAL' || inChaos) return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m141IsPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function m141ExtractVoteWindow(v: unknown): VoteWindow {
  if (!m141IsPlainObject(v)) return {};
  const o = v as Record<string, unknown>;
  const votes = (m141IsPlainObject(o.votes) ? (o.votes as Record<string, unknown>) : null);

  const cast = (m141IsPlainObject(o.cast) ? (o.cast as Record<string, unknown>) : null);

  return {
    openTick: typeof o.openTick === 'number' ? o.openTick : undefined,
    closeTick: typeof o.closeTick === 'number' ? o.closeTick : undefined,

    nowMs: typeof o.nowMs === 'number' ? o.nowMs : undefined,
    opensAtMs: typeof o.opensAtMs === 'number' ? o.opensAtMs : undefined,
    closesAtMs: typeof o.closesAtMs === 'number' ? o.closesAtMs : undefined,

    options: Array.isArray(o.options) ? (o.options.map(String) as string[]) : undefined,
    requiredQuorum: typeof o.requiredQuorum === 'number' ? o.requiredQuorum : undefined,

    votes: votes
      ? Object.fromEntries(Object.entries(votes).map(([k, val]) => [String(k), String(val)]))
      : undefined,

    cast: cast && typeof cast.voterId === 'string' && typeof cast.choice === 'string'
      ? { voterId: String(cast.voterId), choice: String(cast.choice) }
      : undefined,

    prevVotesHash: typeof o.prevVotesHash === 'string' ? o.prevVotesHash : undefined,
  };
}

function m141DedupStrings(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const s = String(x ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function m141ComputeVotesHash(votes: Record<string, string>, participants: string[]): string {
  const normalized = participants
    .slice()
    .sort()
    .map((pid) => [pid, votes[pid] ?? ''] as const);
  return computeHash(JSON.stringify(normalized));
}

function m141CountVotes(
  votes: Record<string, string>,
  participants: string[],
  options: string[],
  allowAbstain: boolean,
): { counts: Record<string, number>; votesCast: number; invalidVotes: number } {
  const counts: Record<string, number> = Object.fromEntries(options.map((o) => [o, 0]));
  if (allowAbstain && counts.ABSTAIN === undefined) counts.ABSTAIN = 0;

  const optSet = new Set<string>(options);
  if (allowAbstain) optSet.add('ABSTAIN');

  let cast = 0;
  let invalid = 0;

  for (const pid of participants) {
    const v = String(votes[pid] ?? '').trim();
    if (!v) continue;

    cast += 1;
    if (!optSet.has(v)) {
      invalid += 1;
      continue;
    }
    counts[v] = (counts[v] ?? 0) + 1;
  }

  return { counts, votesCast: cast, invalidVotes: invalid };
}

function m141ResolveWinner(
  counts: Record<string, number>,
  options: string[],
  tieBreaker: VoteTieBreaker,
  seed: string,
  tick: number,
): { winner: string | null; tie: boolean } {
  let max = -1;
  for (const o of options) max = Math.max(max, counts[o] ?? 0);

  if (max <= 0) return { winner: null, tie: false };

  const tied = options.filter((o) => (counts[o] ?? 0) === max);
  if (tied.length === 1) return { winner: tied[0], tie: false };

  if (tieBreaker === 'NONE') return { winner: null, tie: true };

  const idx = seededIndex(seed + ':m141:tiebreak', tick, tied.length);
  return { winner: tied[idx] ?? null, tie: true };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * asyncTableVoteEngine
 *
 * api_endpoint contract:
 * - Voting can happen asynchronously (friends vote later),
 * - BUT resolution remains timer-bound (clamped to run clock).
 * - This mechanic returns computed state only; persistence is orchestrator responsibility.
 */
export function asyncTableVoteEngine(
  input: M141Input,
  emit: MechanicEmitter,
): M141Output {
  const snap = input as unknown as Record<string, unknown>;

  const tick = clamp(Number(input.stateTick ?? snap.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const nextTick = tick + 1;
  const timerExpired = nextTick >= RUN_TOTAL_TICKS;

  const participants = m141DedupStrings(Array.isArray(input.participantIds) ? input.participantIds : []);
  const n = participants.length;

  const cfg: AsyncVoteConfig = input.asyncVoteConfig ?? {};
  const enabled = (typeof cfg.enabled === 'boolean') ? cfg.enabled : true;

  const runId =
    (typeof input.runId === 'string' && input.runId.trim())
      ? input.runId.trim()
      : (typeof snap.runId === 'string' && String(snap.runId).trim())
        ? String(snap.runId).trim()
        : computeHash(JSON.stringify({ mid: 'M141', tick, n, enabled }));

  const seed =
    (typeof input.seed === 'string' && input.seed.trim())
      ? input.seed.trim()
      : computeHash(`${runId}:M141:${tick}`);

  // Macro/chaos fabric (keeps shared imports truly used)
  const macroSchedule = buildMacroSchedule(seed + ':m141:macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':m141:chaos', CHAOS_WINDOWS_PER_RUN);

  const phase: RunPhase = m141NormalizePhase(input.stateRunPhase ?? snap.stateRunPhase ?? m141DerivePhaseFromTick(tick));
  const fallbackRegime: MacroRegime = m141NormalizeRegime(input.stateMacroRegime ?? snap.stateMacroRegime ?? 'NEUTRAL');
  const macroRegime: MacroRegime = m141RegimeAtTick(tick, macroSchedule, fallbackRegime);
  const inChaos = m141InChaos(tick, chaosWindows);

  const pressureTier: PressureTier = m141NormalizePressure(
    input.statePressureTier ?? snap.statePressureTier ?? m141DerivePressureTier(phase, inChaos, macroRegime),
  );
  const tickTier: TickTier = m141DeriveTickTier(pressureTier, inChaos);
  const solvencyStatus: SolvencyStatus = m141NormalizeSolvency(input.stateSolvencyStatus ?? snap.stateSolvencyStatus ?? 'SOLVENT');

  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M141_BOUNDS.BASE_DECAY_RATE);

  // Economy anchors (must touch pool + defaults + ids)
  const weightedPool = buildWeightedPool(seed + ':m141:pool', pressureW * phaseW, regimeW * regimeMult);
  const poolPick: GameCard =
    (weightedPool[seededIndex(seed + ':m141:pick', tick, Math.max(1, weightedPool.length))] as GameCard | undefined) ?? DEFAULT_CARD;

  const oppPick: GameCard =
    OPPORTUNITY_POOL[seededIndex(seed + ':m141:opp', tick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, seed + ':m141:deck');
  const deckTopId = deckOrder[0] ?? DEFAULT_CARD.id;

  const vw = m141ExtractVoteWindow(input.voteWindow);

  const allowAbstain = (typeof cfg.allowAbstain === 'boolean') ? cfg.allowAbstain : false;

  const optionsBase =
    (Array.isArray(vw.options) && vw.options.length > 0)
      ? vw.options
      : (Array.isArray(cfg.options) && cfg.options.length > 0)
        ? cfg.options
        : ['YES', 'NO'];

  const options = m141DedupStrings(optionsBase).slice(0, 12);

  const tieBreaker: VoteTieBreaker = (cfg.tieBreaker === 'NONE') ? 'NONE' : 'SEED';

  const enforceRunTimerBound = (typeof cfg.enforceRunTimerBound === 'boolean') ? cfg.enforceRunTimerBound : true;

  const defaultWindowTicks = clamp(
    typeof cfg.defaultWindowTicks === 'number' ? cfg.defaultWindowTicks : 24,
    1,
    RUN_TOTAL_TICKS,
  );

  const openTick = clamp(typeof vw.openTick === 'number' ? vw.openTick : tick, 0, RUN_TOTAL_TICKS - 1);

  const closeTickFromVW = (typeof vw.closeTick === 'number')
    ? clamp(vw.closeTick, openTick, RUN_TOTAL_TICKS - 1)
    : clamp(openTick + defaultWindowTicks, openTick, RUN_TOTAL_TICKS - 1);

  const closesAtTick = enforceRunTimerBound ? Math.min(closeTickFromVW, RUN_TOTAL_TICKS - 1) : closeTickFromVW;
  const openedAtTick = openTick;

  const opensAtMs = typeof vw.opensAtMs === 'number' ? vw.opensAtMs : openedAtTick * M141_MS_PER_TICK;
  const closesAtMs = typeof vw.closesAtMs === 'number' ? vw.closesAtMs : closesAtTick * M141_MS_PER_TICK;
  const nowMs = typeof vw.nowMs === 'number' ? vw.nowMs : tick * M141_MS_PER_TICK;

  const rawVotes = m141IsPlainObject(vw.votes) ? (vw.votes as Record<string, string>) : {};

  // Apply optional cast hint (stateless: caller can persist in voteWindow.votes)
  const votes: Record<string, string> = { ...rawVotes };
  if (vw.cast && participants.includes(vw.cast.voterId)) {
    votes[vw.cast.voterId] = String(vw.cast.choice ?? '').trim();
  }

  const votesHash = m141ComputeVotesHash(votes, participants);

  const quorumDefault = Math.max(1, Math.ceil(n * 0.5));
  const quorum = clamp(
    typeof vw.requiredQuorum === 'number'
      ? vw.requiredQuorum
      : (typeof cfg.quorum === 'number' ? cfg.quorum : quorumDefault),
    1,
    Math.max(1, n),
  );

  const resolveEarlyOnQuorum = (typeof cfg.resolveEarlyOnQuorum === 'boolean') ? cfg.resolveEarlyOnQuorum : true;

  const { counts, votesCast } = m141CountVotes(votes, participants, options, allowAbstain);

  const withinWindow = nowMs >= opensAtMs && nowMs <= closesAtMs;
  const pastClose = nowMs > closesAtMs || tick >= closesAtTick || timerExpired;

  const quorumMet = votesCast >= quorum;
  const allVoted = n > 0 ? votesCast >= n : false;

  const shouldResolve =
    enabled &&
    (pastClose || allVoted || (resolveEarlyOnQuorum && quorumMet));

  const { winner, tie } = shouldResolve
    ? m141ResolveWinner(counts, options, tieBreaker, seed, tick)
    : { winner: null, tie: false };

  const status: VoteResult['status'] =
    !enabled
      ? 'DISABLED'
      : shouldResolve
        ? (pastClose ? 'EXPIRED' : 'RESOLVED')
        : (withinWindow ? 'OPEN' : 'OPEN');

  const requestId = computeHash(JSON.stringify({
    mid: 'M141',
    runId,
    tick,
    openedAtTick,
    closesAtTick,
    participants,
    options,
    quorum,
  }));

  const auditHash = computeHash(JSON.stringify({
    requestId,
    runId,
    seedHash: computeHash(seed),
    tick,
    status,
    votesHash,
    counts,
    winner,
    tie,
    phase,
    macroRegime,
    pressureTier,
    tickTier,
    solvencyStatus,
    inChaos,
    weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
    anchors: {
      poolPickId: poolPick.id,
      oppPickId: oppPick.id,
      deckTopId,
    },
  }));

  const voteResult: VoteResult = {
    status,
    requestId,

    openedAtTick,
    closesAtTick,

    openedAtMs: opensAtMs,
    closesAtMs,
    nowMs,

    participants,
    options,

    quorum,
    votesCast,

    counts,
    winner,
    tie,

    tieBreaker,
    timerBound: true,

    votesHash,
    auditHash,

    context: {
      runId,
      tick,
      timerExpired,
      enforceRunTimerBound,
      macroRegime,
      runPhase: phase,
      pressureTier,
      tickTier,
      solvencyStatus,
      inChaos,
      weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
      econHints: {
        poolPick: { id: poolPick.id, name: poolPick.name, type: poolPick.type },
        oppPick: { id: oppPick.id, name: oppPick.name, type: oppPick.type },
        deckTopId,
        deckSig: deckOrder.slice(0, Math.min(5, deckOrder.length)),
      },
      macroSchedule,
      chaosWindows,
      cfgTags: cfg.tags ?? {},
    },
  };

  // ── Telemetry ────────────────────────────────────────────────────────────

  if (enabled && tick === openedAtTick) {
    emit({
      event: 'ASYNC_VOTE_OPENED',
      mechanic_id: 'M141',
      tick,
      runId,
      payload: {
        requestId,
        openedAtTick,
        closesAtTick,
        opensAtMs,
        closesAtMs,
        participants: n,
        quorum,
        options,
        tieBreaker,
        enforceRunTimerBound,
        macroRegime,
        phase,
        pressureTier,
        inChaos,
      },
    });
  }

  const shouldPulseCast = enabled && votesCast > 0 && ((tick % M141_BOUNDS.PULSE_CYCLE) === 0 || shouldResolve);
  if (shouldPulseCast) {
    emit({
      event: 'ASYNC_VOTE_CAST',
      mechanic_id: 'M141',
      tick,
      runId,
      payload: {
        requestId,
        votesCast,
        participants: n,
        quorum,
        quorumMet,
        allVoted,
        votesHash,
        prevVotesHash: vw.prevVotesHash ?? null,
        options,
        counts,
        hint: {
          poolPickId: poolPick.id,
          oppPickId: oppPick.id,
          deckTopId,
        },
      },
    });
  }

  if (enabled && shouldResolve) {
    emit({
      event: 'ASYNC_VOTE_RESOLVED',
      mechanic_id: 'M141',
      tick,
      runId,
      payload: {
        requestId,
        status,
        resolved: true,
        pastClose,
        timerExpired,
        votesCast,
        participants: n,
        quorum,
        counts,
        winner,
        tie,
        tieBreaker,
        auditHash,
        contextSig: auditHash.slice(0, 12),
      },
    });
  }

  return {
    asyncVoteActive: enabled && !shouldResolve,
    voteResult,
    timerBoundEnforced: true,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M141MLInput {
  asyncVoteActive?: boolean;
  voteResult?: VoteResult;
  timerBoundEnforced?: boolean;
  runId: string;
  tick: number;
}

export interface M141MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * asyncTableVoteEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function asyncTableVoteEngineMLCompanion(
  input: M141MLInput,
): Promise<M141MLOutput> {
  const t = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const active = Boolean(input.asyncVoteActive);
  const enforced = Boolean(input.timerBoundEnforced);

  const vr = input.voteResult;
  const votesCast = vr ? vr.votesCast : 0;
  const quorum = vr ? vr.quorum : 1;
  const quorumMet = vr ? votesCast >= quorum : false;

  const score = clamp(
    (active ? 0.70 : 0.25) +
      (enforced ? 0.08 : -0.12) +
      (quorumMet ? 0.08 : 0) +
      clamp(votesCast * 0.02, 0, 0.18) -
      clamp(t / RUN_TOTAL_TICKS, 0, 1) * 0.05,
    0.01,
    0.99,
  );

  const topFactors = [
    active ? 'Async vote active' : 'Async vote inactive',
    enforced ? 'Timer bound enforced' : 'Timer bound not enforced',
    quorumMet ? 'Quorum met' : 'Quorum not met',
    `votesCast=${votesCast}`,
    `tick=${t}`,
  ].slice(0, 5);

  const recommendation = active
    ? (quorumMet ? 'Resolve early if policy allows; otherwise wait for window close.' : 'Continue collecting votes until quorum or close.')
    : 'No action required; vote has resolved or is disabled.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M141'),
    confidenceDecay: 0.05,
  };
}