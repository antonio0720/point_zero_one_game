// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m133_seasonal_story_beats_headlines_court_dates_deadlines.ts
//
// Mechanic : M133 — Seasonal Story Beats: Headlines Court Dates Deadlines
// Family   : narrative   Layer: ui_component   Priority: 2   Batch: 3
// ML Pair  : m133a
// Deps     : M19, M20
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
  SeasonConfig,
  MomentEvent,
  ClipBoundary,
  MechanicTelemetryPayload,
  MechanicEmitter,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Export anchors (keeps every imported runtime symbol accessible from this module)
// ─────────────────────────────────────────────────────────────────────────────

export const M133_EXPORT_ANCHORS = {
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

/** Forces all imported types to be “used” within this module (type-only, no runtime). */
export type M133_ALL_IMPORTED_TYPES =
  | RunPhase
  | TickTier
  | MacroRegime
  | PressureTier
  | SolvencyStatus
  | Asset
  | IPAItem
  | GameCard
  | GameEvent
  | ShieldLayer
  | Debt
  | Buff
  | Liability
  | SetBonus
  | AssetMod
  | IncomeItem
  | MacroEvent
  | ChaosWindow
  | AuctionResult
  | PurchaseResult
  | ShieldResult
  | ExitResult
  | TickResult
  | DeckComposition
  | TierProgress
  | WipeEvent
  | RegimeShiftEvent
  | PhaseTransitionEvent
  | TimerExpiredEvent
  | StreakEvent
  | FubarEvent
  | LedgerEntry
  | ProofCard
  | CompletedRun
  | SeasonState
  | RunState
  | SeasonConfig
  | MomentEvent
  | ClipBoundary
  | MechanicTelemetryPayload
  | MechanicEmitter;

// ─────────────────────────────────────────────────────────────────────────────
// Local narrative types (kept local; avoids bloating shared ./types)
// ─────────────────────────────────────────────────────────────────────────────

export type StoryBeatKind = 'HEADLINE' | 'COURT_DATE' | 'DEADLINE' | 'REGULATORY' | 'TABLOID';

export interface StoryBeat {
  id: string;
  tick: number;
  kind: StoryBeatKind;
  headline: string;

  // Optional “deadline” semantics
  dueTick?: number;
  windowStartTick?: number;
  windowEndTick?: number;

  severity?: number; // 0..1 (narrative urgency; cosmetic only)
  tags?: string[];
}

export interface DeadlineWarning {
  kind: 'SEASON_END' | 'BEAT_DUE';
  label: string;
  dueTick: number;
  remainingTicks: number;
  urgency: number; // 0..1
  isDue: boolean;
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M133Input {
  seasonConfig?: SeasonConfig;
  storyBeatSchedule?: StoryBeat[];
  stateTick?: number;
}

export interface M133Output {
  storyBeatDisplayed: boolean;
  narrativeHeadline: string;
  deadlineWarning: unknown;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M133Event = 'STORY_BEAT_FIRED' | 'HEADLINE_DISPLAYED' | 'DEADLINE_APPROACHING';

export interface M133TelemetryPayload extends MechanicTelemetryPayload {
  event: M133Event;
  mechanic_id: 'M133';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M133_BOUNDS = {
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
// Internal helpers (no throws; deterministic; JSON-safe)
// ─────────────────────────────────────────────────────────────────────────────

const REGIMES: readonly MacroRegime[] = ['BULL', 'NEUTRAL', 'BEAR', 'CRISIS'] as const;
const PHASES: readonly RunPhase[] = ['EARLY', 'MID', 'LATE'] as const;
const PRESSURES: readonly PressureTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return '"[UNSERIALIZABLE]"';
  }
}

function safeCardFromPool(card: GameCard | undefined | null): GameCard {
  const c = card ?? DEFAULT_CARD;
  if (DEFAULT_CARD_IDS.includes(c.id)) return c;
  if (OPPORTUNITY_POOL.some(x => x.id === c.id)) return c;
  return DEFAULT_CARD;
}

function deriveRunPhaseFromTick(t: number): RunPhase {
  const tick = clamp(Math.floor(t), 0, RUN_TOTAL_TICKS);
  if (tick <= RUN_TOTAL_TICKS / 3) return 'EARLY';
  if (tick <= (RUN_TOTAL_TICKS * 2) / 3) return 'MID';
  return 'LATE';
}

function derivePressureTier(seed: string, tick: number, beatCount: number): PressureTier {
  const density = clamp(beatCount / Math.max(1, RUN_TOTAL_TICKS), 0, 1);
  const jitter = seededIndex(seed, tick + 77, 1000) / 1000; // 0..0.999
  const score = clamp(density * 0.75 + jitter * 0.25, 0, 1);
  if (score >= 0.78) return 'CRITICAL';
  if (score >= 0.55) return 'HIGH';
  if (score >= 0.28) return 'MEDIUM';
  return 'LOW';
}

function deriveTickTier(intensity01: number): TickTier {
  if (intensity01 >= 0.75) return 'CRITICAL';
  if (intensity01 >= 0.45) return 'ELEVATED';
  return 'STANDARD';
}

function buildDefaultBeats(seed: string, season: SeasonConfig): StoryBeat[] {
  const macro = buildMacroSchedule(`${seed}:M133:macro`, MACRO_EVENTS_PER_RUN);
  const chaos = buildChaosWindows(`${seed}:M133:chaos`, CHAOS_WINDOWS_PER_RUN);

  const templates: Array<{ kind: StoryBeatKind; fmt: (p: { tick: number; regime: MacroRegime }) => string }> = [
    {
      kind: 'HEADLINE',
      fmt: ({ tick, regime }) => `MARKET BULLETIN // ${regime} // Tick ${tick}: “Liquidity thins. Nobody admits it.”`,
    },
    {
      kind: 'REGULATORY',
      fmt: ({ tick, regime }) => `NOTICE OF COMPLIANCE // ${regime} // Tick ${tick}: “Document it or lose it.”`,
    },
    {
      kind: 'COURT_DATE',
      fmt: ({ tick, regime }) => `COURT CALENDAR // ${regime} // Tick ${tick}: “One hearing. One outcome.”`,
    },
    {
      kind: 'TABLOID',
      fmt: ({ tick, regime }) => `TABLOID FLASH // ${regime} // Tick ${tick}: “A rumor moves faster than money.”`,
    },
    {
      kind: 'DEADLINE',
      fmt: ({ tick, regime }) => `DEADLINE ALERT // ${regime} // Tick ${tick}: “You can delay pain. You can’t delete it.”`,
    },
  ];

  const shuffledTemplates = seededShuffle(templates, `${seed}:M133:tpl`);

  const beatsFromMacro: StoryBeat[] = macro.map((e, i) => {
    const regime = (e.regimeChange ?? REGIMES[seededIndex(seed, i, REGIMES.length)]) as MacroRegime;
    const t = clamp(e.tick, season.startTick, season.endTick);
    const tpl = shuffledTemplates[i % shuffledTemplates.length];
    return {
      id: computeHash(`${seed}:beat:macro:${i}:${t}:${tpl.kind}`),
      tick: t,
      kind: tpl.kind,
      headline: tpl.fmt({ tick: t, regime }),
      severity: clamp(((REGIME_MULTIPLIERS[regime] ?? 1.0) - 0.5) / 1.0, 0, 1),
      tags: ['AUTO', 'MACRO'],
    };
  });

  const beatsFromChaos: StoryBeat[] = chaos.map((w, i) => {
    const start = clamp(w.startTick, season.startTick, season.endTick);
    const end = clamp(w.endTick, season.startTick, season.endTick);
    const due = clamp(end, season.startTick, season.endTick);
    const regime = REGIMES[seededIndex(seed, i + 999, REGIMES.length)];
    return {
      id: computeHash(`${seed}:beat:chaos:${i}:${start}:${end}`),
      tick: start,
      kind: 'DEADLINE',
      headline: `FUBAR WINDOW // ${regime} // Tick ${start}-${end}: “Keep moving or get priced out.”`,
      dueTick: due,
      windowStartTick: start,
      windowEndTick: end,
      severity: clamp(((EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0) - 0.4) / 1.0, 0, 1),
      tags: ['AUTO', 'CHAOS'],
    };
  });

  // Season end “hard deadline” beat (narrative only)
  const seasonEndBeat: StoryBeat = {
    id: computeHash(`${seed}:beat:season_end:${season.endTick}`),
    tick: clamp(season.endTick, season.startTick, season.endTick),
    kind: 'DEADLINE',
    headline: `SEASON CLOSES // Tick ${season.endTick}: “No appeals after final stamp.”`,
    dueTick: clamp(season.endTick, season.startTick, season.endTick),
    severity: 1.0,
    tags: ['AUTO', 'SEASON_END'],
  };

  return seededShuffle([...beatsFromMacro, ...beatsFromChaos, seasonEndBeat], `${seed}:M133:beats`).sort(
    (a, b) => a.tick - b.tick || a.id.localeCompare(b.id),
  );
}

function selectBeatAtTick(beats: StoryBeat[], tick: number, seed: string): StoryBeat | null {
  const t = clamp(Math.floor(tick), 0, RUN_TOTAL_TICKS);

  const exact = beats.filter(b => Math.floor(b.tick) === t);
  if (exact.length > 0) return exact[seededIndex(seed, t, exact.length)];

  // “Approach beat” within next 2 ticks (UI warning; still deterministic)
  const near = beats.filter(b => b.tick > t && b.tick <= t + 2);
  if (near.length > 0) return near[seededIndex(seed, t + 1_000, near.length)];

  return null;
}

function computeDeadlineWarning(season: SeasonConfig, beats: StoryBeat[], tick: number, seed: string): DeadlineWarning | null {
  const t = clamp(Math.floor(tick), season.startTick, season.endTick);

  const seasonRemaining = Math.max(0, season.endTick - t);
  const seasonUrgency = clamp(1 - seasonRemaining / Math.max(1, season.endTick - season.startTick), 0, 1);

  const dueBeats = beats
    .filter(b => typeof b.dueTick === 'number')
    .map(b => ({ b, due: clamp(Math.floor(b.dueTick as number), season.startTick, season.endTick) }))
    .filter(x => x.due >= t)
    .sort((x, y) => x.due - y.due || x.b.id.localeCompare(y.b.id));

  const nextDue = dueBeats[0] ?? null;

  // Determine whether we show a warning at all:
  // - always warn inside last 12 ticks of season
  // - or inside last 6 ticks before next due beat
  const showSeason = seasonRemaining <= 12;
  const showBeat = nextDue ? nextDue.due - t <= 6 : false;

  if (!showSeason && !showBeat) return null;

  if (showBeat && nextDue) {
    const remaining = Math.max(0, nextDue.due - t);
    const urgency = clamp(1 - remaining / 6, 0, 1);
    const auditHash = computeHash(`${seed}:warn:beat:${nextDue.b.id}:${t}:${remaining}:${urgency.toFixed(4)}`);
    return {
      kind: 'BEAT_DUE',
      label: `${nextDue.b.kind} due`,
      dueTick: nextDue.due,
      remainingTicks: remaining,
      urgency,
      isDue: remaining === 0,
      auditHash,
    };
  }

  const urgency = clamp(seasonUrgency, 0, 1);
  const auditHash = computeHash(`${seed}:warn:season_end:${t}:${seasonRemaining}:${urgency.toFixed(4)}`);
  return {
    kind: 'SEASON_END',
    label: 'Season closing',
    dueTick: season.endTick,
    remainingTicks: seasonRemaining,
    urgency,
    isDue: seasonRemaining === 0,
    auditHash,
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * seasonalStoryBeatEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function seasonalStoryBeatEngine(input: M133Input, emit: MechanicEmitter): M133Output {
  const seasonConfig: SeasonConfig =
    input.seasonConfig ??
    ({
      seasonId: 'UNKNOWN',
      startTick: 0,
      endTick: RUN_TOTAL_TICKS,
      rewardTable: [],
      seedSalt: 'DEFAULT',
    } as SeasonConfig);

  const stateTick = clamp(Math.floor(Number(input.stateTick ?? 0)), 0, RUN_TOTAL_TICKS);

  const seed = computeHash(
    safeJson({
      mechanic: 'M133',
      seasonId: seasonConfig.seasonId,
      start: seasonConfig.startTick,
      end: seasonConfig.endTick,
      tick: stateTick,
      salt: seasonConfig.seedSalt ?? '',
    }),
  );

  // Prefer provided schedule; otherwise deterministic default schedule derived from season config.
  const provided = Array.isArray(input.storyBeatSchedule) ? (input.storyBeatSchedule as StoryBeat[]) : [];
  const beats = provided.length > 0 ? provided : buildDefaultBeats(seed, seasonConfig);

  const runPhase = deriveRunPhaseFromTick(stateTick);
  const pressureTier = derivePressureTier(seed, stateTick, beats.length);

  // Derive a “regime” deterministically from macro schedule (or stable fallback).
  const macroSchedule = buildMacroSchedule(`${seed}:M133:macro_schedule`, MACRO_EVENTS_PER_RUN);
  const macroRegime: MacroRegime =
    (macroSchedule[seededIndex(seed, stateTick + 10, Math.max(1, macroSchedule.length))]?.regimeChange as MacroRegime) ??
    REGIMES[seededIndex(seed, stateTick + 11, REGIMES.length)];

  const decayRate = computeDecayRate(macroRegime, M133_BOUNDS.BASE_DECAY_RATE);
  const pulse = stateTick > 0 && stateTick % M133_BOUNDS.PULSE_CYCLE === 0 ? (EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0) : 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const intensity01 = clamp(decayRate * pulse * regimeMult, 0.01, 0.99);
  const tickTier = deriveTickTier(intensity01);

  // Use weighted pool to inject “economic nouns” into narrative without affecting mechanics.
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[runPhase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:M133:pool`, pressurePhaseWeight, regimeWeight);
  const picked = safeCardFromPool(pool[seededIndex(seed, stateTick, Math.max(1, pool.length))]);

  // Select beat at/near tick.
  const beat = selectBeatAtTick(beats, stateTick, seed);
  const storyBeatDisplayed = Boolean(beat);

  // Narrative headline shaping (deterministic templates; no economy mutation).
  const baseTemplates = [
    `// ${macroRegime} // ${runPhase} // ${tickTier} //`,
    `// PRESSURE ${pressureTier} // INT ${(intensity01 * 100).toFixed(1)}% //`,
    `// OPPORTUNITY ${picked.name} //`,
  ];

  const header = seededShuffle(baseTemplates, `${seed}:M133:hdr:${stateTick}`).join(' ');

  const beatText = beat?.headline ?? `STATUS UPDATE // Tick ${stateTick}: “The clock doesn’t negotiate.”`;
  const narrativeHeadline = `${header} ${beatText}`.slice(0, 220);

  const deadline = computeDeadlineWarning(seasonConfig, beats, stateTick, seed);

  // ── Telemetry ────────────────────────────────────────────────────────────
  const runId = computeHash(`${seasonConfig.seasonId}:${seed}`);

  if (beat) {
    emit({
      event: 'STORY_BEAT_FIRED',
      mechanic_id: 'M133',
      tick: stateTick,
      runId,
      payload: {
        beatId: beat.id,
        kind: beat.kind,
        beatTick: beat.tick,
        dueTick: typeof beat.dueTick === 'number' ? beat.dueTick : null,
        macroRegime,
        runPhase,
        pressureTier,
        tickTier,
      },
    });
  }

  emit({
    event: 'HEADLINE_DISPLAYED',
    mechanic_id: 'M133',
    tick: stateTick,
    runId,
    payload: {
      storyBeatDisplayed,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      pickedCardId: picked.id,
      headlineHash: computeHash(narrativeHeadline),
    },
  });

  if (deadline) {
    emit({
      event: 'DEADLINE_APPROACHING',
      mechanic_id: 'M133',
      tick: stateTick,
      runId,
      payload: {
        kind: deadline.kind,
        dueTick: deadline.dueTick,
        remainingTicks: deadline.remainingTicks,
        urgency: Number(deadline.urgency.toFixed(4)),
        isDue: deadline.isDue,
        auditHash: deadline.auditHash,
      },
    });
  }

  return {
    storyBeatDisplayed,
    narrativeHeadline,
    deadlineWarning: (deadline ?? {}) as unknown,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M133MLInput {
  storyBeatDisplayed?: boolean;
  narrativeHeadline?: string;
  deadlineWarning?: unknown;
  runId: string;
  tick: number;
}

export interface M133MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // deterministic hash (non-crypto)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * seasonalStoryBeatEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function seasonalStoryBeatEngineMLCompanion(input: M133MLInput): Promise<M133MLOutput> {
  const runId = String(input.runId ?? '');
  const tick = Math.max(0, Math.floor(Number(input.tick ?? 0)));

  const headline = String(input.narrativeHeadline ?? '');
  const hasBeat = Boolean(input.storyBeatDisplayed);

  // Deterministic “context regime” (does not need external state)
  const regime: MacroRegime = REGIMES[seededIndex(runId, tick + 3, REGIMES.length)];
  const decay = computeDecayRate(regime, M133_BOUNDS.BASE_DECAY_RATE);
  const pulse = tick > 0 && tick % M133_BOUNDS.PULSE_CYCLE === 0 ? (EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0) : 1.0;

  const headlineSignal = clamp(headline.length / 220, 0, 1);
  const beatSignal = hasBeat ? 1 : 0.35;
  const pulseSignal = clamp((pulse - 1.0) * 0.8 + 0.5, 0, 1);

  const score = clamp(0.10 + headlineSignal * 0.35 + beatSignal * 0.45 + pulseSignal * 0.10, 0.01, 0.99);

  const factors = seededShuffle(
    [
      hasBeat ? 'Story beat present' : 'No story beat at tick',
      `Regime context: ${regime}`,
      `Headline density: ${(headlineSignal * 100).toFixed(0)}%`,
      tick % M133_BOUNDS.PULSE_CYCLE === 0 ? 'Pulse tick: urgency elevated' : 'Normal tick: steady cadence',
      `Decay shaping: ${decay.toFixed(3)}`,
    ],
    `${runId}:M133:ml:factors:${tick}`,
  ).slice(0, 5);

  const recommendation =
    score >= 0.70
      ? 'Show headline prominently; prompt player to acknowledge the beat before proceeding.'
      : 'Keep headline subtle; escalate only when deadline warning enters the window.';

  return {
    score,
    topFactors: factors,
    recommendation,
    auditHash: computeHash(safeJson(input) + ':ml:M133:v1'),
    confidenceDecay: clamp(decay, 0.01, 0.25),
  };
}