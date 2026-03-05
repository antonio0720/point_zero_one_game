// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m109_macro_news_bursts_headlines_that_move_ticks.ts
//
// Mechanic : M109 — Macro News Bursts: Headlines That Move Ticks
// Family   : portfolio_experimental   Layer: ui_component   Priority: 2   Batch: 3
// ML Pair  : m109a
// Deps     : M20, M05
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

// ── Import Anchors (keeps every symbol “accessible” + TS-used) ──────────────────
export const M109_IMPORTED_SYMBOLS = {
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

export type M109_ImportedTypesAnchor = {
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

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M109Input {
  macroEvent?: Record<string, unknown>;
  stateMacroRegime?: MacroRegime;
  newsBurstConfig?: Record<string, unknown>;
}

export interface M109Output {
  headlineDisplayed: boolean;
  regimeHint: string;
  playerAlerted: unknown;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M109Event = 'NEWS_BURST_DISPLAYED' | 'REGIME_HINT_SHOWN' | 'HEADLINE_DISMISSED';

export interface M109TelemetryPayload extends MechanicTelemetryPayload {
  event: M109Event;
  mechanic_id: 'M109';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M109_BOUNDS = {
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

type M109Ctx = {
  tick: number;
  runId: string;
  seed: string;
  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tier: TickTier;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  chaosHit: ChaosWindow | null;
  decayRate: number;
  regimeMultiplier: number;
  exitPulse: number;
  phaseWeight: number;
  regimeWeight: number;
  pressureWeight: number;
  themeCard: GameCard;
  deckSig: string[];
};

function m109ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

function m109NormalizeRegime(r: unknown): MacroRegime {
  switch (r) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return r;
    // deterministic mapping for non-canonical labels if upstream data leaks through
    case 'RECESSION':
    case 'DOWNTURN':
      return 'BEAR';
    case 'BOOM':
    case 'EXPANSION':
      return 'BULL';
    default:
      return 'NEUTRAL';
  }
}

function m109PhaseFromTick(tick: number): RunPhase {
  const t = m109ClampTick(tick);
  const third = RUN_TOTAL_TICKS / 3;
  return t < third ? 'EARLY' : t < third * 2 ? 'MID' : 'LATE';
}

function m109ChaosHit(tick: number, chaos: ChaosWindow[]): ChaosWindow | null {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return w;
  }
  return null;
}

function m109PressureFrom(phase: RunPhase, chaosHit: ChaosWindow | null): PressureTier {
  if (chaosHit) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m109TickTierFrom(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m109RegimeFromSchedule(tick: number, macro: MacroEvent[], fallback?: MacroRegime): MacroRegime {
  const base = fallback ? m109NormalizeRegime(fallback) : 'NEUTRAL';
  if (!macro || macro.length === 0) return base;

  const sorted = [...macro].sort((a, b) => a.tick - b.tick);
  let r: MacroRegime = base;

  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = m109NormalizeRegime(ev.regimeChange);
  }
  return r;
}

function m109StableTick(input: M109Input): number {
  const asAny = input as unknown as { stateTick?: unknown; tick?: unknown };
  const fromInput = typeof asAny.stateTick === 'number' ? asAny.stateTick : typeof asAny.tick === 'number' ? asAny.tick : undefined;

  const me = input.macroEvent as unknown as { tick?: unknown } | undefined;
  const fromMacro = typeof me?.tick === 'number' ? (me.tick as number) : undefined;

  const raw = fromInput ?? fromMacro ?? 0;
  return m109ClampTick(raw);
}

function m109StableRunId(input: M109Input, tick: number): string {
  const asAny = input as unknown as { runId?: unknown };
  const me = input.macroEvent as unknown as { runId?: unknown; id?: unknown } | undefined;

  const explicit =
    (typeof asAny.runId === 'string' ? asAny.runId : '') ||
    (typeof me?.runId === 'string' ? me.runId : '') ||
    (typeof me?.id === 'string' ? me.id : '');

  if (explicit.trim().length > 0) return explicit.trim();

  // deterministic fallback (server-safe; not an auth token)
  return computeHash(`M109:run:${tick}:${JSON.stringify(input.macroEvent ?? {})}:${JSON.stringify(input.newsBurstConfig ?? {})}`);
}

function m109PickHeadline(ctx: M109Ctx): { headline: string; source: 'MACRO' | 'CHAOS' | 'PULSE' } {
  const macroTicks = ctx.macroSchedule.map(m => m.tick);
  const chaosStarts = ctx.chaosWindows.map(w => w.startTick);

  const candidates = Array.from(new Set([...macroTicks, ...chaosStarts]))
    .map(t => m109ClampTick(t))
    .sort((a, b) => a - b);

  const picked = seededShuffle(candidates, `${ctx.seed}:headlineTicks`).slice(0, clamp(M109_BOUNDS.TRIGGER_THRESHOLD, 1, candidates.length));

  const isMacro = macroTicks.includes(ctx.tick);
  const isChaosStart = chaosStarts.includes(ctx.tick);
  const isPulse = ctx.tick % M109_BOUNDS.PULSE_CYCLE === 0;

  const active = picked.includes(ctx.tick) || isMacro || isChaosStart || isPulse;

  const source: 'MACRO' | 'CHAOS' | 'PULSE' = isMacro ? 'MACRO' : isChaosStart || ctx.chaosHit ? 'CHAOS' : 'PULSE';

  // deterministic headline templates
  const templatesByRegime: Record<MacroRegime, string[]> = {
    BULL: [
      `Liquidity surge: ${ctx.themeCard.name} bids tighten`,
      `Tailwind: deal flow accelerates — ${ctx.themeCard.name}`,
      `Risk-on tape: spreads compress`,
    ],
    NEUTRAL: [
      `Flat tape: selective entries only`,
      `Range-bound: patience beats speed`,
      `Mixed prints: prioritize proof`,
    ],
    BEAR: [
      `Risk-off: credit tightens — ${ctx.themeCard.name} reprices`,
      `Sell pressure: margins get tested`,
      `Downturn: cash discipline required`,
    ],
    CRISIS: [
      `Shock event: forced repricing across the board`,
      `Crisis tape: liquidity evaporates`,
      `Circuit-breaker mood: survival positioning`,
    ],
  };

  const pool = templatesByRegime[ctx.regime] ?? templatesByRegime.NEUTRAL;
  const idx = seededIndex(`${ctx.seed}:headline:${source}`, ctx.tick, pool.length);
  const headline = pool[idx] ?? `Market update: ${ctx.regime}`;

  return { headline: active ? headline : '', source };
}

function m109BuildCtx(input: M109Input): M109Ctx {
  const tick = m109StableTick(input);
  const runId = m109StableRunId(input, tick);

  const seed = computeHash(`M109:${runId}:${tick}:${JSON.stringify(input.macroEvent ?? {})}:${JSON.stringify(input.newsBurstConfig ?? {})}`);

  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const phase = m109PhaseFromTick(tick);
  const chaosHit = m109ChaosHit(tick, chaosWindows);
  const pressure = m109PressureFrom(phase, chaosHit);
  const tier = m109TickTierFrom(pressure);

  const scheduleRegime = m109RegimeFromSchedule(tick, macroSchedule, input.stateMacroRegime);
  const regime = m109NormalizeRegime(scheduleRegime);

  const decayRate = computeDecayRate(regime, M109_BOUNDS.BASE_DECAY_RATE);
  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  // cosmetic “theme” derived from weighted pool + fallback
  const weighted = buildWeightedPool(`${seed}:themePool`, pressureWeight * phaseWeight, regimeWeight);
  const themeCard =
    weighted[seededIndex(seed, tick + 9, weighted.length)] ??
    OPPORTUNITY_POOL[seededIndex(seed, tick + 19, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  return {
    tick,
    runId,
    seed,
    phase,
    regime,
    pressure,
    tier,
    macroSchedule,
    chaosWindows,
    chaosHit,
    decayRate,
    regimeMultiplier,
    exitPulse,
    phaseWeight,
    regimeWeight,
    pressureWeight,
    themeCard,
    deckSig,
  };
}

function m109RegimeHint(regime: MacroRegime): string {
  switch (regime) {
    case 'BULL':
      return 'Tailwind: favor expansion plays.';
    case 'BEAR':
      return 'Headwind: tighten entries, protect cash.';
    case 'CRISIS':
      return 'Crisis: prioritize survival and liquidity.';
    default:
      return '';
  }
}

function m109ComputeEffect(ctx: M109Ctx): { cashDelta: number; cashflowDelta: number; magnitude: number } {
  const tempo = clamp(ctx.phaseWeight * ctx.pressureWeight, 0.50, 2.50);
  const macro = clamp(ctx.regimeWeight * ctx.regimeMultiplier * ctx.exitPulse, 0.25, 2.25);
  const stability = clamp(1 - ctx.decayRate, 0.25, 1.0);

  const baseMag = M109_BOUNDS.MULTIPLIER * 10_000 * M109_BOUNDS.EFFECT_MULTIPLIER;
  const rawMag = baseMag * tempo * macro * stability;

  const magnitude = clamp(Math.round(rawMag), M109_BOUNDS.MIN_EFFECT, M109_BOUNDS.MAX_EFFECT);

  // deterministic split (bounded)
  const cashBias = seededIndex(`${ctx.seed}:cashBias`, ctx.tick, 101) / 100; // 0..1
  const cashDeltaRaw = Math.round((cashBias - 0.5) * 2 * 10_000 * macro);
  const cashflowDeltaRaw = Math.round(((1 - cashBias) - 0.5) * 2 * 2_500 * tempo);

  const cashDelta = clamp(cashDeltaRaw, M109_BOUNDS.MIN_CASH_DELTA, M109_BOUNDS.MAX_CASH_DELTA);
  const cashflowDelta = clamp(cashflowDeltaRaw, M109_BOUNDS.MIN_CASHFLOW_DELTA, M109_BOUNDS.MAX_CASHFLOW_DELTA);

  return { cashDelta, cashflowDelta, magnitude };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * macroNewsBurstDisplay
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function macroNewsBurstDisplay(input: M109Input, emit: MechanicEmitter): M109Output {
  const ctx = m109BuildCtx(input);
  const { headline, source } = m109PickHeadline(ctx);

  const headlineDisplayed = headline.length > 0;
  const regimeHint = headlineDisplayed ? m109RegimeHint(ctx.regime) : '';

  const effect = m109ComputeEffect(ctx);

  const playerAlerted: Record<string, unknown> = headlineDisplayed
    ? {
        headline,
        source,
        tick: ctx.tick,
        runId: ctx.runId,
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        tier: ctx.tier,
        effect,
        themeCardId: ctx.themeCard.id,
        deckSig: ctx.deckSig,
        audit: computeHash(
          JSON.stringify({
            mid: 'M109',
            runId: ctx.runId,
            tick: ctx.tick,
            regime: ctx.regime,
            phase: ctx.phase,
            pressure: ctx.pressure,
            tier: ctx.tier,
            headline,
            source,
            effect,
            themeCardId: ctx.themeCard.id,
            deckSig: ctx.deckSig,
          }),
        ),
      }
    : {
        tick: ctx.tick,
        runId: ctx.runId,
        regime: ctx.regime,
      };

  if (headlineDisplayed) {
    emit({
      event: 'NEWS_BURST_DISPLAYED',
      mechanic_id: 'M109',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: {
        headline,
        source,
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        tier: ctx.tier,
        effect,
        themeCardId: ctx.themeCard.id,
      },
    });

    if (regimeHint.length > 0) {
      emit({
        event: 'REGIME_HINT_SHOWN',
        mechanic_id: 'M109',
        tick: ctx.tick,
        runId: ctx.runId,
        payload: { regime: ctx.regime, hint: regimeHint },
      });
    }
  } else {
    emit({
      event: 'HEADLINE_DISMISSED',
      mechanic_id: 'M109',
      tick: ctx.tick,
      runId: ctx.runId,
      payload: { reason: 'no_trigger', regime: ctx.regime },
    });
  }

  return {
    headlineDisplayed,
    regimeHint,
    playerAlerted,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M109MLInput {
  headlineDisplayed?: boolean;
  regimeHint?: string;
  playerAlerted?: unknown;
  runId: string;
  tick: number;
}

export interface M109MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * macroNewsBurstDisplayMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function macroNewsBurstDisplayMLCompanion(input: M109MLInput): Promise<M109MLOutput> {
  const density = clamp(Object.keys(input).length * 0.05, 0.01, 0.99);
  const score = Math.min(0.99, Math.max(0.01, density));

  const topFactors: string[] = [];
  if (input.headlineDisplayed) topFactors.push('Headline fired');
  if ((input.regimeHint ?? '').length > 0) topFactors.push('Regime hint shown');
  topFactors.push('Advisory only');

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: input.headlineDisplayed ? 'React quickly; re-check liquidity and timing.' : 'Stay patient; watch next pulse window.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M109'),
    confidenceDecay: 0.05,
  };
}