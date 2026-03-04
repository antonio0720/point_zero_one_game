// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m83_risk_parity_dial_optional_stability_lever_under_heat.ts
//
// Mechanic : M83 — Risk Parity Dial: Optional Stability Lever Under Heat
// Family   : portfolio_expert   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m83a
// Deps     : M35, M57
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
 * Keeps generator-wide imports “live” and provides inspection/debug handles.
 */
export const M83_IMPORTED_SYMBOLS = {
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
export type M83_ImportedTypesAnchor = {
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

// ── Local domain types (standalone; no forced edits to ./types.ts) ──────────

export interface RiskParityTarget {
  // 0..1 risk share weights for broad buckets (best-effort; optional)
  equity?: number;
  credit?: number;
  realAssets?: number;
  cash?: number;

  // Target portfolio volatility budget (0..1 proxy)
  volBudget?: number;

  // When heat exceeds this, dial prefers stability
  heatThreshold?: number;

  // Optional name
  label?: string;
}

export interface RiskParityDecision {
  parityAdjusted: boolean;
  stabilityBonus: number;
  dialSetting: number;

  // context
  tick: number;
  phase: RunPhase;
  regime: MacroRegime;
  pressureTier: PressureTier;
  inChaos: boolean;

  // input signals
  exposureHeat: number;
  target: RiskParityTarget;
  assetsCount: number;

  // deterministic audit
  seed: string;
  auditHash: string;

  effectScore: number;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M83Input {
  stateExposureHeat?: number;
  riskParityTarget?: unknown;
  stateAssets?: Asset[];

  // optional context
  tick?: number;
  runId?: string;
  pressureTier?: PressureTier;
}

export interface M83Output {
  parityAdjusted: boolean;
  stabilityBonus: number;
  dialSetting: number;
  decision?: RiskParityDecision;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M83Event = 'RISK_PARITY_ADJUSTED' | 'STABILITY_BONUS_APPLIED' | 'DIAL_CHANGED';

export interface M83TelemetryPayload extends MechanicTelemetryPayload {
  event: M83Event;
  mechanic_id: 'M83';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M83_BOUNDS = {
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

function m83DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m83DeriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const sorted = [...(schedule ?? [])].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m83InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m83DerivePressureTier(proxy: number, inChaos: boolean): PressureTier {
  if (inChaos) return proxy >= 6 ? 'CRITICAL' : 'HIGH';
  if (proxy <= 2) return 'LOW';
  if (proxy <= 5) return 'MEDIUM';
  if (proxy <= 8) return 'HIGH';
  return 'CRITICAL';
}

function m83NormalizeTarget(raw: unknown): RiskParityTarget {
  const r = (raw ?? {}) as Record<string, unknown>;

  const clamp01 = (v: unknown, d: number) => clamp(Number(v ?? d), 0, 1);

  const equity = clamp01(r.equity, 0.35);
  const credit = clamp01(r.credit, 0.25);
  const realAssets = clamp01(r.realAssets, 0.2);
  const cash = clamp01(r.cash, 0.2);

  const sum = equity + credit + realAssets + cash || 1;
  const norm = (x: number) => x / sum;

  const volBudget = clamp01(r.volBudget, 0.6);
  const heatThreshold = clamp(Number(r.heatThreshold ?? 60), 0, 100);

  const label = String(r.label ?? 'RISK_PARITY');

  return {
    equity: norm(equity),
    credit: norm(credit),
    realAssets: norm(realAssets),
    cash: norm(cash),
    volBudget,
    heatThreshold,
    label,
  };
}

function m83DeriveAssetMixSignature(seed: string, tick: number, assets: Asset[]): string {
  // Best-effort kind extraction without schema assumptions; uses DEFAULT_CARD_IDS as stable entropy anchor
  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:mixDeck:${tick}`);
  const deckTop = deck[0] ?? DEFAULT_CARD.id;

  const kinds: string[] = [];
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i] as unknown as Record<string, unknown>;
    const k = String(a.kind ?? a.type ?? a.category ?? a.assetType ?? 'UNKNOWN').toUpperCase();
    kinds.push(k);
  }

  return computeHash(`${deckTop}:${kinds.sort().join('|')}`).slice(0, 12);
}

function m83ComputeDial(
  exposureHeat: number,
  target: RiskParityTarget,
  phase: RunPhase,
  regime: MacroRegime,
  pressureTier: PressureTier,
  inChaos: boolean,
  assetsCount: number,
): { dial: number; bonus: number; adjusted: boolean } {
  const heat = clamp(Number(exposureHeat), 0, 100);

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const decay = computeDecayRate(regime, M83_BOUNDS.BASE_DECAY_RATE);
  const chaosAdj = inChaos ? (1 + clamp(decay, 0, 0.5)) : 1;

  // “Stability dial” 0..100 where higher = more stability preference (lower risk)
  // In higher heat/pressure/chaos, dial increases.
  const heatFactor = clamp(heat / 100, 0, 1);

  const weightsFactor =
    clamp((pressureW * phaseW * regimeW) / 3, 0, 2) * 0.25 +
    clamp((regimeMul * exitPulse) / 3, 0, 2) * 0.25;

  const portfolioComplexity = clamp(assetsCount / 10, 0, 1) * 0.2;

  const baseDial = 35 + heatFactor * 50 + weightsFactor * 25 + portfolioComplexity * 15;
  const chaosDial = baseDial * chaosAdj;

  const dial = clamp(Math.round(chaosDial), 0, 100);

  // Stability bonus: more bonus when dial is high AND target prefers stability (higher cash/realAssets & lower volBudget)
  const stabilityPref = clamp((Number(target.cash ?? 0) + Number(target.realAssets ?? 0)) / 2, 0, 1);
  const volPref = 1 - clamp(Number(target.volBudget ?? 0.6), 0, 1);

  const bonusRaw = (dial / 100) * (0.5 + stabilityPref * 0.35 + volPref * 0.35) * M83_BOUNDS.MAX_EFFECT * 0.02;
  const bonus = clamp(Math.round(bonusRaw), 0, 10_000);

  const adjusted = heat >= (target.heatThreshold ?? 60) || inChaos || pressureTier === 'HIGH' || pressureTier === 'CRITICAL';

  return { dial, bonus, adjusted };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * riskParityDialAdjuster
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function riskParityDialAdjuster(input: M83Input, emit: MechanicEmitter): M83Output {
  const exposureHeat = clamp(Number(input.stateExposureHeat ?? 0), 0, 100);
  const stateAssets = (Array.isArray(input.stateAssets) ? input.stateAssets : []) as Asset[];

  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? computeHash(JSON.stringify(input)));

  const target = m83NormalizeTarget(input.riskParityTarget);

  // Deterministic seed
  const seed = computeHash(
    JSON.stringify({
      m: 'M83',
      tick,
      runId,
      exposureHeat,
      target,
      assetsCount: stateAssets.length,
      mixSig: m83DeriveAssetMixSignature(runId, tick, stateAssets),
    }),
  );

  // Context (bounded chaos)
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m83DerivePhase(tick);
  const regime = m83DeriveRegime(tick, macroSchedule);
  const inChaos = m83InChaosWindow(tick, chaosWindows);

  const proxy = clamp(stateAssets.length, 1, 12);
  const pressureTier = (input.pressureTier as PressureTier) ?? m83DerivePressureTier(proxy, inChaos);

  const { dial, bonus, adjusted } = m83ComputeDial(exposureHeat, target, phase, regime, pressureTier, inChaos, stateAssets.length);

  emit({
    event: 'DIAL_CHANGED',
    mechanic_id: 'M83',
    tick,
    runId,
    payload: {
      exposureHeat,
      dialSetting: dial,
      target: { ...target, label: target.label },
      phase,
      regime,
      pressureTier,
      inChaos,
    },
  });

  emit({
    event: 'RISK_PARITY_ADJUSTED',
    mechanic_id: 'M83',
    tick,
    runId,
    payload: {
      parityAdjusted: adjusted,
      dialSetting: dial,
      note: adjusted ? 'heat_or_chaos_triggered' : 'no_adjustment_needed',
    },
  });

  emit({
    event: 'STABILITY_BONUS_APPLIED',
    mechanic_id: 'M83',
    tick,
    runId,
    payload: {
      stabilityBonus: bonus,
      dialSetting: dial,
      label: target.label,
    },
  });

  // Effect score (telemetry-only)
  const effectRaw = clamp((dial / 100) * (bonus / 10_000), 0, 1);
  const effectScore = clamp(effectRaw * M83_BOUNDS.MAX_EFFECT * M83_BOUNDS.EFFECT_MULTIPLIER, M83_BOUNDS.MIN_EFFECT, M83_BOUNDS.MAX_EFFECT);

  const auditHash = computeHash(
    JSON.stringify({
      m: 'M83',
      tick,
      runId,
      exposureHeat,
      target,
      assetsCount: stateAssets.length,
      dial,
      bonus,
      adjusted,
      phase,
      regime,
      pressureTier,
      inChaos,
      effectScore: Math.round(effectScore),
      seed,
    }),
  );

  const decision: RiskParityDecision = {
    parityAdjusted: adjusted,
    stabilityBonus: bonus,
    dialSetting: dial,

    tick,
    phase,
    regime,
    pressureTier,
    inChaos,

    exposureHeat,
    target,
    assetsCount: stateAssets.length,

    seed,
    auditHash,

    effectScore: Math.round(effectScore),
  };

  return {
    parityAdjusted: adjusted,
    stabilityBonus: bonus,
    dialSetting: dial,
    decision,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M83MLInput {
  parityAdjusted?: boolean;
  stabilityBonus?: number;
  dialSetting?: number;
  runId: string;
  tick: number;
}

export interface M83MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * riskParityDialAdjusterMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function riskParityDialAdjusterMLCompanion(input: M83MLInput): Promise<M83MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const adjusted = Boolean(input.parityAdjusted ?? false);
  const bonus = clamp(Number(input.stabilityBonus ?? 0), 0, 10_000);
  const dial = clamp(Number(input.dialSetting ?? 0), 0, 100);

  // Neutral decay baseline (regime unknown here)
  const confidenceDecay = computeDecayRate('NEUTRAL' as MacroRegime, M83_BOUNDS.BASE_DECAY_RATE);

  // Score: adjusted isn’t inherently good/bad; high dial + bonus => higher stability score.
  const score = clamp(0.35 + (dial / 100) * 0.35 + clamp(bonus / 10_000, 0, 1) * 0.25 - (adjusted ? 0.0 : 0.05), 0.01, 0.99);

  // Deterministic hint using DEFAULT_CARD_IDS (keeps import live)
  const hintPick = seededIndex(computeHash(`M83ML:${tick}:${input.runId}:${adjusted}:${dial}:${bonus}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintPick] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `dial=${dial}`,
    `bonus=${bonus}`,
    `adjusted=${adjusted ? 'yes' : 'no'}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation =
    dial >= 70
      ? 'Dial is high: prioritize stability assets, reduce leverage, and preserve liquidity.'
      : dial >= 40
        ? 'Dial moderate: keep balance; trim tail-risk exposures and maintain diversification.'
        : 'Dial low: risk budget available; selectively add upside exposures with defined stops.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M83'),
    confidenceDecay,
  };
}