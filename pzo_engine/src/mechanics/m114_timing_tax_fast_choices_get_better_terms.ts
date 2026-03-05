// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m114_timing_tax_fast_choices_get_better_terms.ts
//
// Mechanic : M114 — Timing Tax: Fast Choices Get Better Terms
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m114a
// Deps     : M02, M09
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

export const M114_IMPORTED_SYMBOLS = {
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

export type M114_ImportedTypesAnchor = {
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

// ── Local types (mechanic-standalone) ──────────────────────────────────────

export type TimingTaxBand = {
  // ratio = decisionTime / windowDuration
  maxRatio: number;          // inclusive upper bound (0..1+)
  bonusMult: number;         // >= 0, applied to base bonus
  termImprovementChance: number; // 0..1, deterministic roll
  taxMult: number;           // >= 0, applied to base tax
};

export type TimingTaxTable = {
  version: string;
  baseBonus: number; // baseline “better terms” benefit
  baseTax: number;   // baseline “timing tax” penalty when slow
  bands: TimingTaxBand[];
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M114Input {
  decisionTime?: number;     // ms or seconds (caller-defined)
  windowDuration?: number;   // same unit as decisionTime
  timingTaxTable?: unknown;

  // Optional, backward-compatible additions (keeps existing callers intact)
  runId?: string;
  tick?: number;
  stateMacroRegime?: MacroRegime;
  stateRunPhase?: RunPhase;
  statePressureTier?: PressureTier;
}

export interface M114Output {
  timingBonus: number;
  termImproved: boolean;
  taxApplied: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M114Event = 'TIMING_TAX_APPLIED' | 'TIMING_BONUS_AWARDED' | 'FAST_DECISION_RECORDED';

export interface M114TelemetryPayload extends MechanicTelemetryPayload {
  event: M114Event;
  mechanic_id: 'M114';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M114_BOUNDS = {
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

function m114ClampTick(t: number): number {
  return clamp(t, 0, RUN_TOTAL_TICKS - 1);
}

function m114NormalizeRegime(v: unknown): MacroRegime {
  switch (v) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return v;
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

function m114NormalizePhase(v: unknown, tick: number): RunPhase {
  if (v === 'EARLY' || v === 'MID' || v === 'LATE') return v;
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m114NormalizePressure(v: unknown, phase: RunPhase, chaos: boolean): PressureTier {
  if (v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL') return v;
  if (chaos) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m114TickTierFromPressure(p: PressureTier): TickTier {
  return p === 'CRITICAL' ? 'CRITICAL' : p === 'HIGH' ? 'ELEVATED' : 'STANDARD';
}

function m114StableRunId(input: M114Input, tick: number): string {
  const explicit = typeof input.runId === 'string' ? input.runId.trim() : '';
  if (explicit.length > 0) return explicit;
  return computeHash(
    `M114:run:${tick}:${String(input.decisionTime ?? '')}:${String(input.windowDuration ?? '')}:${JSON.stringify(input.timingTaxTable ?? null)}`,
  );
}

function m114DefaultTable(): TimingTaxTable {
  return {
    version: 'M114:v1',
    baseBonus: 250,
    baseTax: 250,
    bands: [
      { maxRatio: 0.15, bonusMult: 2.0, termImprovementChance: 0.85, taxMult: 0.0 }, // very fast
      { maxRatio: 0.33, bonusMult: 1.35, termImprovementChance: 0.55, taxMult: 0.10 }, // fast
      { maxRatio: 0.66, bonusMult: 0.90, termImprovementChance: 0.25, taxMult: 0.35 }, // normal
      { maxRatio: 1.0, bonusMult: 0.50, termImprovementChance: 0.10, taxMult: 0.70 }, // slow
      { maxRatio: 9e9, bonusMult: 0.25, termImprovementChance: 0.02, taxMult: 1.10 }, // timeout
    ],
  };
}

function m114ParseTable(raw: unknown): TimingTaxTable {
  // Accept TimingTaxTable, JSON string, or partial object.
  const fallback = m114DefaultTable();

  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { obj = raw; }
  }

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return fallback;

  const rec = obj as Record<string, unknown>;
  const version = typeof rec.version === 'string' ? rec.version : fallback.version;
  const baseBonus = typeof rec.baseBonus === 'number' && Number.isFinite(rec.baseBonus) ? rec.baseBonus : fallback.baseBonus;
  const baseTax = typeof rec.baseTax === 'number' && Number.isFinite(rec.baseTax) ? rec.baseTax : fallback.baseTax;

  const bandsRaw = Array.isArray(rec.bands) ? rec.bands : fallback.bands;
  const bands: TimingTaxBand[] = bandsRaw
    .map((b: unknown): TimingTaxBand | null => {
      if (typeof b !== 'object' || b === null || Array.isArray(b)) return null;
      const br = b as Record<string, unknown>;

      const maxRatio = typeof br.maxRatio === 'number' && Number.isFinite(br.maxRatio) ? br.maxRatio : 1.0;
      const bonusMult = typeof br.bonusMult === 'number' && Number.isFinite(br.bonusMult) ? br.bonusMult : 1.0;
      const termImprovementChance =
        typeof br.termImprovementChance === 'number' && Number.isFinite(br.termImprovementChance)
          ? br.termImprovementChance
          : 0.0;
      const taxMult = typeof br.taxMult === 'number' && Number.isFinite(br.taxMult) ? br.taxMult : 0.0;

      return {
        maxRatio: Math.max(0, maxRatio),
        bonusMult: Math.max(0, bonusMult),
        termImprovementChance: clamp(termImprovementChance, 0, 1),
        taxMult: Math.max(0, taxMult),
      };
    })
    .filter((x): x is TimingTaxBand => x !== null)
    .sort((a, b) => a.maxRatio - b.maxRatio);

  return { version, baseBonus, baseTax, bands: bands.length ? bands : fallback.bands };
}

function m114SelectBand(table: TimingTaxTable, ratio: number): TimingTaxBand {
  for (const b of table.bands) {
    if (ratio <= b.maxRatio) return b;
  }
  return table.bands[table.bands.length - 1];
}

function m114ChaosActive(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m114RegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  let r: MacroRegime = fallback;
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = m114NormalizeRegime(ev.regimeChange);
  }
  return r;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * timingTaxResolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function timingTaxResolver(input: M114Input, emit: MechanicEmitter): M114Output {
  const decisionTimeRaw = typeof input.decisionTime === 'number' && Number.isFinite(input.decisionTime) ? input.decisionTime : 0;
  const windowDurationRaw =
    typeof input.windowDuration === 'number' && Number.isFinite(input.windowDuration) ? input.windowDuration : 0;

  const decisionTime = Math.max(0, decisionTimeRaw);
  const windowDuration = Math.max(0, windowDurationRaw);

  const tick =
    typeof input.tick === 'number' && Number.isFinite(input.tick)
      ? m114ClampTick(input.tick)
      : m114ClampTick(seededIndex(computeHash(`M114:tick:${decisionTime}:${windowDuration}`), 0, RUN_TOTAL_TICKS));

  const runId = m114StableRunId(input, tick);
  const seed = computeHash(`M114:${runId}:${tick}:${decisionTime}:${windowDuration}`);

  // consume schedule utilities (keeps imports live + deterministic “fast windows”)
  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const chaos = m114ChaosActive(tick, chaosWindows);

  const fallbackRegime = m114NormalizeRegime(input.stateMacroRegime ?? 'NEUTRAL');
  const regime = m114RegimeFromSchedule(tick, macroSchedule, fallbackRegime);

  const phase = m114NormalizePhase(input.stateRunPhase, tick);
  const pressure = m114NormalizePressure(input.statePressureTier, phase, chaos);
  const tickTier = m114TickTierFromPressure(pressure);

  // deterministic “theme card” used for term-improvement context (also keeps pool imports hot)
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M114_BOUNDS.BASE_DECAY_RATE);

  const pool = buildWeightedPool(`${seed}:pool`, phaseW * pressureW, regimeW * regimeMul);
  const themeCard =
    (pool[seededIndex(`${seed}:theme`, tick + 17, Math.max(1, pool.length))] as GameCard | undefined) ??
    OPPORTUNITY_POOL[seededIndex(`${seed}:opp`, tick + 27, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deck`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  // ratio; if windowDuration is 0, force timeout band deterministically
  const ratio =
    windowDuration <= 0
      ? 9e9
      : clamp(decisionTime / windowDuration, 0, 9e9);

  const table = m114ParseTable(input.timingTaxTable);
  const band = m114SelectBand(table, ratio);

  // Base terms scale with macro conditions (bounded)
  const macroScale = clamp(phaseW * pressureW * regimeW * regimeMul * exitPulse * (1 - decay), 0.25, 3.0);

  // bonus magnitude: fast => higher; slow => lower
  const rawBonus = table.baseBonus * band.bonusMult * macroScale * M114_BOUNDS.EFFECT_MULTIPLIER;

  // tax magnitude: slow => higher; fast => lower
  const rawTax = table.baseTax * band.taxMult * clamp((1 + decay), 0.75, 1.75);

  const timingBonus = clamp(Math.round(rawBonus), M114_BOUNDS.MIN_EFFECT, M114_BOUNDS.MAX_EFFECT);

  const tax = clamp(Math.round(rawTax), 0, M114_BOUNDS.MAX_EFFECT);

  const taxApplied = tax > 0;

  // deterministic roll for term improvement
  const roll = seededIndex(`${seed}:termRoll:${table.version}`, tick, 10_000) / 10_000;
  const termImproved =
    roll <= band.termImprovementChance &&
    // hard cap: no “improvement” when totally timed-out and in CRISIS
    !(ratio > 1.0 && regime === 'CRISIS' && pressure === 'CRITICAL');

  const audit = computeHash(
    JSON.stringify({
      mid: 'M114',
      runId,
      tick,
      decisionTime,
      windowDuration,
      ratio,
      tableVersion: table.version,
      band,
      macro: { phase, regime, pressure, tickTier, phaseW, pressureW, regimeW, regimeMul, exitPulse, decay },
      amounts: { timingBonus, tax },
      termImproved,
      themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
      deckSig,
    }),
  );

  // Telemetry: fast decision, bonus, tax
  if (ratio <= 0.33) {
    emit({
      event: 'FAST_DECISION_RECORDED',
      mechanic_id: 'M114',
      tick,
      runId,
      payload: {
        audit,
        decisionTime,
        windowDuration,
        ratio,
        bandMaxRatio: band.maxRatio,
        bonusMult: band.bonusMult,
        chance: band.termImprovementChance,
        phase,
        regime,
        pressure,
        tickTier,
      },
    });
  }

  emit({
    event: 'TIMING_BONUS_AWARDED',
    mechanic_id: 'M114',
    tick,
    runId,
    payload: {
      audit,
      timingBonus,
      termImproved,
      tableVersion: table.version,
      band,
      macroScale,
      themeCardId: (themeCard as unknown as { id?: unknown }).id ?? null,
      deckSig,
    },
  });

  if (taxApplied) {
    emit({
      event: 'TIMING_TAX_APPLIED',
      mechanic_id: 'M114',
      tick,
      runId,
      payload: {
        audit,
        tax,
        decisionTime,
        windowDuration,
        ratio,
        tableVersion: table.version,
        band,
        phase,
        regime,
        pressure,
        tickTier,
      },
    });
  }

  // Note: M114Output only exposes bonus + flags. Tax magnitude is in telemetry (ledger-verifiable).
  return {
    timingBonus,
    termImproved,
    taxApplied,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M114MLInput {
  timingBonus?: number;
  termImproved?: boolean;
  taxApplied?: boolean;
  runId: string;
  tick: number;
}

export interface M114MLOutput {
  score: number;          // 0–1
  topFactors: string[];   // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string;      // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;// 0–1, how fast this signal should decay
}

/**
 * timingTaxResolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function timingTaxResolverMLCompanion(input: M114MLInput): Promise<M114MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));

  const topFactors: string[] = [];
  if ((input.timingBonus ?? 0) > 0) topFactors.push('Timing bonus computed');
  if (input.termImproved) topFactors.push('Terms improved');
  if (input.taxApplied) topFactors.push('Timing tax applied');
  topFactors.push('Advisory only');

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: input.taxApplied ? 'Speed up decisions to reduce timing tax.' : 'Maintain fast decision cadence for better terms.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M114'),
    confidenceDecay: 0.05,
  };
}