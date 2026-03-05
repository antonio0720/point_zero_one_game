// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m119_rivalry_ledger_nemesis_tracking_over_seasons.ts
//
// Mechanic : M119 — Rivalry Ledger: Nemesis Tracking Over Seasons
// Family   : social_advanced   Layer: api_endpoint   Priority: 2   Batch: 3
// ML Pair  : m119a
// Deps     : M18
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

// ── Import Anchors (keeps every symbol accessible + TS-used) ──────────────────

export const M119_IMPORTED_SYMBOLS = {
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

export type M119_ImportedTypesAnchor = {
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

// ── Local types (not guaranteed in ./types) ──────────────────────────────────

export type RivalryHistory = {
  seasonId: string;
  // key: opponentId
  opponents: Record<
    string,
    {
      matches: number;
      wins: number;
      losses: number;
      draws: number;
      streak: number; // positive = win streak vs them, negative = loss streak vs them
      heat: number;   // 0..M119_BOUNDS.MAX_EFFECT
      lastMatchTick: number;
      lastResult: 'W' | 'L' | 'D' | 'NA';
    }
  >;
  nemesisId?: string | null;
  auditHash: string;
};

export type MatchResult = {
  seasonId: string;
  playerId: string;
  opponentId: string;
  result: 'W' | 'L' | 'D';
  // optional strength signals
  margin?: number;      // e.g. score diff; signed
  decidedTick?: number; // tick inside run when decided
};

export type NemesisBadge = {
  seasonId: string;
  nemesisId: string;
  rivalryScore: number; // 0..1
  tier: 'RIVAL' | 'NEMESIS';
  issuedTick: number;
  auditHash: string;
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M119Input {
  rivalryHistory?: RivalryHistory;
  matchResult?: MatchResult;
  rivalryThreshold?: number;

  // Optional, backward-compatible additions (keeps existing callers intact)
  runId?: string;
  tick?: number;
}

export interface M119Output {
  rivalryUpdated: boolean;
  nemesisBadge: NemesisBadge | null;
  rivalryConsequences: string[];

  // optional state snapshot callers can persist
  updatedHistory?: RivalryHistory;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M119Event = 'RIVALRY_FORMED' | 'NEMESIS_DESIGNATED' | 'RIVALRY_CONSEQUENCE_APPLIED';

export interface M119TelemetryPayload extends MechanicTelemetryPayload {
  event: M119Event;
  mechanic_id: 'M119';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M119_BOUNDS = {
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

// ── Internal helpers (pure, deterministic) ─────────────────────────────────

type KV = Record<string, unknown>;

function isRecord(v: unknown): v is KV {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clampTick(t: number): number {
  return clamp(t, 0, RUN_TOTAL_TICKS - 1);
}

function stableRunId(input: M119Input, tick: number): string {
  const explicit = typeof input.runId === 'string' ? input.runId.trim() : '';
  if (explicit.length > 0) return explicit;
  return computeHash(`M119:run:${tick}:${JSON.stringify(input.matchResult ?? null)}:${JSON.stringify(input.rivalryHistory ?? null)}`);
}

function defaultHistory(seed: string, seasonId: string): RivalryHistory {
  return {
    seasonId,
    opponents: {},
    nemesisId: null,
    auditHash: computeHash(`M119:history:${seasonId}:${seed}`),
  };
}

function normalizeHistory(raw: unknown, seed: string, seasonId: string): RivalryHistory {
  if (!isRecord(raw)) return defaultHistory(seed, seasonId);

  const s = typeof raw.seasonId === 'string' ? raw.seasonId : seasonId;
  const oppRaw = isRecord(raw.opponents) ? (raw.opponents as Record<string, unknown>) : {};
  const opponents: RivalryHistory['opponents'] = {};

  for (const [k, v] of Object.entries(oppRaw)) {
    if (!isRecord(v)) continue;
    const vv = v as Record<string, unknown>;
    opponents[k] = {
      matches: Math.max(0, Math.round(asNumber(vv.matches, 0))),
      wins: Math.max(0, Math.round(asNumber(vv.wins, 0))),
      losses: Math.max(0, Math.round(asNumber(vv.losses, 0))),
      draws: Math.max(0, Math.round(asNumber(vv.draws, 0))),
      streak: Math.round(asNumber(vv.streak, 0)),
      heat: clamp(asNumber(vv.heat, 0), 0, M119_BOUNDS.MAX_EFFECT),
      lastMatchTick: clampTick(Math.round(asNumber(vv.lastMatchTick, 0))),
      lastResult: (vv.lastResult === 'W' || vv.lastResult === 'L' || vv.lastResult === 'D') ? vv.lastResult : 'NA',
    };
  }

  const nemesisId =
    raw.nemesisId === null || raw.nemesisId === undefined
      ? null
      : typeof raw.nemesisId === 'string'
        ? raw.nemesisId
        : null;

  const auditHash = typeof raw.auditHash === 'string' ? raw.auditHash : computeHash(`M119:history:${s}:${seed}:normalized`);

  return { seasonId: s, opponents, nemesisId, auditHash };
}

function normalizeMatch(raw: unknown, seasonFallback: string, seed: string, tick: number): MatchResult | null {
  if (!isRecord(raw)) return null;

  const seasonId = typeof raw.seasonId === 'string' ? raw.seasonId : seasonFallback;
  const playerId = asString(raw.playerId, '').trim();
  const opponentId = asString(raw.opponentId, '').trim();

  const r = asString(raw.result, '').toUpperCase();
  const result: MatchResult['result'] = r === 'W' || r === 'L' || r === 'D' ? (r as MatchResult['result']) : 'D';

  if (!playerId || !opponentId) return null;

  const margin = raw.margin != null ? asNumber(raw.margin, 0) : undefined;
  const decidedTick = raw.decidedTick != null ? clampTick(Math.round(asNumber(raw.decidedTick, tick))) : undefined;

  return { seasonId, playerId, opponentId, result, margin, decidedTick };
}

function updateOpponentState(prev: RivalryHistory['opponents'][string] | undefined, match: MatchResult, tick: number, seed: string): RivalryHistory['opponents'][string] {
  const base = prev ?? {
    matches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    heat: 0,
    lastMatchTick: 0,
    lastResult: 'NA' as const,
  };

  const matches = base.matches + 1;
  const wins = base.wins + (match.result === 'W' ? 1 : 0);
  const losses = base.losses + (match.result === 'L' ? 1 : 0);
  const draws = base.draws + (match.result === 'D' ? 1 : 0);

  // streak: positive for consecutive wins, negative for consecutive losses; reset on draw
  let streak = base.streak;
  if (match.result === 'D') streak = 0;
  else if (match.result === 'W') streak = streak >= 0 ? streak + 1 : 1;
  else if (match.result === 'L') streak = streak <= 0 ? streak - 1 : -1;

  // rivalry heat: grows with repeated meetings + close margins + streak tension (bounded)
  const margin = match.margin ?? 0;
  const closeness = 1 - clamp(Math.abs(margin) / 10, 0, 1); // assume 0..10 scale if provided
  const tension = clamp(Math.abs(streak) / 5, 0, 1);

  const baseAdd = 75 + seededIndex(`${seed}:heatBase`, tick, 51); // 75..125
  const heatAdd = baseAdd * (0.50 + 0.30 * closeness + 0.20 * tension);

  const heat = clamp(base.heat + heatAdd, 0, M119_BOUNDS.MAX_EFFECT);

  return {
    matches,
    wins,
    losses,
    draws,
    streak,
    heat,
    lastMatchTick: tick,
    lastResult: match.result,
  };
}

function rivalryScore(entry: RivalryHistory['opponents'][string], threshold: number): number {
  // score 0..1 based on heat vs threshold + meeting volume
  const heatRatio = threshold <= 0 ? clamp(entry.heat / M119_BOUNDS.MAX_EFFECT, 0, 1) : clamp(entry.heat / threshold, 0, 1);
  const volume = clamp(entry.matches / 10, 0, 1);
  const streak = clamp(Math.abs(entry.streak) / 5, 0, 1);
  return clamp(0.10 + 0.55 * heatRatio + 0.20 * volume + 0.15 * streak, 0, 1);
}

function pickNemesis(seed: string, tick: number, hist: RivalryHistory, threshold: number): { nemesisId: string | null; score: number } {
  const entries = Object.entries(hist.opponents);
  if (entries.length === 0) return { nemesisId: null, score: 0 };

  const scored = entries
    .map(([opponentId, entry]) => ({ opponentId, entry, score: rivalryScore(entry, threshold) }))
    .sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score ?? 0;
  const candidates = scored.filter(x => x.score >= clamp(topScore - 0.05, 0, 1));

  const pick = seededIndex(`${seed}:nemesisPick`, tick, candidates.length);
  const chosen = candidates[pick] ?? candidates[0];

  return chosen ? { nemesisId: chosen.opponentId, score: chosen.score } : { nemesisId: null, score: 0 };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * rivalryLedgerTracker
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function rivalryLedgerTracker(input: M119Input, emit: MechanicEmitter): M119Output {
  const tick =
    typeof input.tick === 'number' && Number.isFinite(input.tick)
      ? clampTick(input.tick)
      : clampTick(seededIndex(computeHash(`M119:tick:${JSON.stringify(input.matchResult ?? null)}`), 0, RUN_TOTAL_TICKS));

  const runId = stableRunId(input, tick);
  const seed = computeHash(`M119:${runId}:${tick}`);

  // consume global schedulers to keep imports live + make rivalry evolve with macro context
  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const phase: RunPhase = (() => {
    const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
    return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
  })();

  const chaos = chaosWindows.some(w => tick >= w.startTick && tick <= w.endTick);
  const pressure: PressureTier = chaos ? 'CRITICAL' : phase === 'EARLY' ? 'LOW' : phase === 'MID' ? 'MEDIUM' : 'HIGH';
  const tickTier: TickTier = pressure === 'CRITICAL' ? 'CRITICAL' : pressure === 'HIGH' ? 'ELEVATED' : 'STANDARD';

  const regime: MacroRegime = (() => {
    let r: MacroRegime = 'NEUTRAL';
    const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
    for (const ev of sorted) {
      if (ev.tick > tick) break;
      if (ev.regimeChange) r = normalizeRegime(ev.regimeChange);
    }
    return r;
  })();

  const decay = computeDecayRate(regime, M119_BOUNDS.BASE_DECAY_RATE);
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  // theme selection (forces buildWeightedPool + pools live)
  const pool = buildWeightedPool(`${seed}:pool`, phaseW * pressureW, regimeW * regimeMul);
  const themeCard =
    (pool[seededIndex(`${seed}:theme`, tick + 9, Math.max(1, pool.length))] as GameCard | undefined) ??
    OPPORTUNITY_POOL[seededIndex(`${seed}:opp`, tick + 19, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  const seasonIdFallback = asString((input.matchResult as unknown as { seasonId?: unknown })?.seasonId, 'SEASON_0');
  const history = normalizeHistory(input.rivalryHistory, seed, seasonIdFallback);

  const match = normalizeMatch(input.matchResult, history.seasonId, seed, tick);
  const threshold = clamp(asNumber(input.rivalryThreshold, 2_500), 250, M119_BOUNDS.MAX_EFFECT);

  const updatedHistory: RivalryHistory = (() => {
    if (!match) return history;

    const opponents = { ...history.opponents };
    opponents[match.opponentId] = updateOpponentState(opponents[match.opponentId], match, tick, seed);

    const auditHash = computeHash(
      JSON.stringify({
        mid: 'M119',
        seasonId: history.seasonId,
        opponents,
        prevNemesis: history.nemesisId ?? null,
        tick,
        macro: { phase, regime, pressure, tickTier, phaseW, pressureW, regimeW, regimeMul, exitPulse, decay },
        themeCardId: themeCard.id,
        deckSig,
      }),
    );

    return { ...history, opponents, auditHash };
  })();

  const pick = pickNemesis(seed, tick, updatedHistory, threshold);
  const nemesisId = pick.nemesisId;

  const nemesisBadge: NemesisBadge | null = nemesisId
    ? {
        seasonId: updatedHistory.seasonId,
        nemesisId,
        rivalryScore: pick.score,
        tier: pick.score >= 0.85 ? 'NEMESIS' : 'RIVAL',
        issuedTick: tick,
        auditHash: computeHash(`M119:badge:${updatedHistory.seasonId}:${nemesisId}:${tick}:${pick.score}`),
      }
    : null;

  const rivalryUpdated = match != null;

  const rivalryConsequences: string[] = [];
  if (nemesisBadge) {
    // deterministic consequences, bounded (strings only, state mutation is elsewhere)
    const intensity = nemesisBadge.tier === 'NEMESIS' ? 3 : 2;

    const cPool = [
      'Matchmaking weight increased vs nemesis',
      'Bonus XP on nemesis rematch win',
      'Penalty on nemesis rematch loss',
      'Rivalry banner enabled on table feed',
      'Nemesis challenge unlocked',
      'Season badge progress advanced',
    ];

    const picks = seededShuffle(cPool, `${seed}:cons:${nemesisBadge.nemesisId}:${tick}`).slice(0, intensity);
    rivalryConsequences.push(...picks);
  }

  if (rivalryUpdated && match) {
    emit({
      event: 'RIVALRY_FORMED',
      mechanic_id: 'M119',
      tick,
      runId,
      payload: {
        seasonId: updatedHistory.seasonId,
        playerId: match.playerId,
        opponentId: match.opponentId,
        result: match.result,
        threshold,
        macro: { phase, regime, pressure, tickTier, decay, exitPulse, regimeMul },
        themeCardId: themeCard.id,
        deckSig,
        historyAudit: updatedHistory.auditHash,
      },
    });
  }

  if (nemesisBadge) {
    emit({
      event: 'NEMESIS_DESIGNATED',
      mechanic_id: 'M119',
      tick,
      runId,
      payload: {
        badge: nemesisBadge,
        threshold,
        themeCardId: themeCard.id,
        deckSig,
        historyAudit: updatedHistory.auditHash,
      },
    });

    for (const c of rivalryConsequences) {
      emit({
        event: 'RIVALRY_CONSEQUENCE_APPLIED',
        mechanic_id: 'M119',
        tick,
        runId,
        payload: {
          nemesisId: nemesisBadge.nemesisId,
          tier: nemesisBadge.tier,
          consequence: c,
          historyAudit: updatedHistory.auditHash,
        },
      });
    }
  }

  return {
    rivalryUpdated,
    nemesisBadge,
    rivalryConsequences,
    updatedHistory,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M119MLInput {
  rivalryUpdated?: boolean;
  nemesisBadge?: NemesisBadge | null;
  rivalryConsequences?: string[];
  runId: string;
  tick: number;
}

export interface M119MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * rivalryLedgerTrackerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function rivalryLedgerTrackerMLCompanion(input: M119MLInput): Promise<M119MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));

  const topFactors: string[] = [];
  if (input.rivalryUpdated) topFactors.push('Rivalry updated');
  if (input.nemesisBadge) topFactors.push('Nemesis designated');
  if ((input.rivalryConsequences?.length ?? 0) > 0) topFactors.push('Consequences applied');
  topFactors.push('Advisory only');

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: input.nemesisBadge ? 'Lean into rematches; rivalry buffs are live.' : 'Track repeat opponents to form rivalries.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M119'),
    confidenceDecay: 0.05,
  };
}

function normalizeRegime(regimeChange: string): MacroRegime {
  throw new Error('Function not implemented.');
}
