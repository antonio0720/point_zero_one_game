// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m35_exposure_cap_enforcer.ts
//
// Mechanic : M35 — Exposure Cap Enforcer
// Family   : portfolio_engine   Layer: card_handler   Priority: 1   Batch: 2
// ML Pair  : m35a
// Deps     : M07, M31
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

// ── Type touchpad (ensures the full shared type surface is "used") ──────────

export interface M35TypeTouchpad {
  runPhase?: RunPhase;
  tickTier?: TickTier;
  macroRegime?: MacroRegime;
  pressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;

  asset?: Asset;
  ipaItem?: IPAItem;
  gameCard?: GameCard;
  gameEvent?: GameEvent;
  shieldLayer?: ShieldLayer;
  debt?: Debt;
  buff?: Buff;
  liability?: Liability;
  setBonus?: SetBonus;
  assetMod?: AssetMod;
  incomeItem?: IncomeItem;
  macroEvent?: MacroEvent;
  chaosWindow?: ChaosWindow;

  auctionResult?: AuctionResult;
  purchaseResult?: PurchaseResult;
  shieldResult?: ShieldResult;
  exitResult?: ExitResult;
  tickResult?: TickResult;

  deckComposition?: DeckComposition;
  tierProgress?: TierProgress;
  wipeEvent?: WipeEvent;
  regimeShiftEvent?: RegimeShiftEvent;
  phaseTransitionEvent?: PhaseTransitionEvent;
  timerExpiredEvent?: TimerExpiredEvent;
  streakEvent?: StreakEvent;
  fubarEvent?: FubarEvent;

  ledgerEntry?: LedgerEntry;
  proofCard?: ProofCard;
  completedRun?: CompletedRun;
  seasonState?: SeasonState;
  runState?: RunState;
  momentEvent?: MomentEvent;
  clipBoundary?: ClipBoundary;

  mechanicTelemetryPayload?: MechanicTelemetryPayload;
  mechanicEmitter?: MechanicEmitter;
}

// ── Domain types (local) ────────────────────────────────────────────────────

export type ExposureMetric = 'SINGLE_ASSET_PCT' | 'TOP3_PCT';

export interface ExposureThreshold {
  id: string;
  label: string;

  /** Maximum allowed % concentration for the largest single asset (0..1). */
  maxSingleAssetPct: number;

  /** Maximum allowed % concentration for the top 3 assets combined (0..1). */
  maxTop3Pct: number;

  /** If true, breach is treated as "hard cap" (EXPOSURE_CAPPED). */
  hardCap?: boolean;

  /** Optional per-regime overrides. */
  regimeOverrides?: Partial<
    Record<
      MacroRegime,
      {
        maxSingleAssetPct?: number;
        maxTop3Pct?: number;
        hardCap?: boolean;
      }
    >
  >;

  /** Optional: only enforce from this pressure tier and above. */
  minPressureTier?: PressureTier;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M35Input {
  stateAssets?: Asset[];
  exposureThresholds?: ExposureThreshold[];

  // snapshotExtractor passes ...snap through; these may exist even if not declared
  // (kept optional and read via safe casts).
  __typeTouchpad?: M35TypeTouchpad;
}

export interface M35Output {
  exposureHeat: number; // 0..M35_BOUNDS.MAX_EFFECT
  cappedWarning: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M35Event = 'EXPOSURE_THRESHOLD_BREACHED' | 'EXPOSURE_CAPPED' | 'OVEREXPOSURE_WARNING';

export interface M35TelemetryPayload extends MechanicTelemetryPayload {
  event: M35Event;
  mechanic_id: 'M35';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M35_BOUNDS = {
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

// ── Internal helpers ───────────────────────────────────────────────────────

function pressureRank(p: PressureTier): number {
  switch (p) {
    case 'LOW':
      return 0;
    case 'MEDIUM':
      return 1;
    case 'HIGH':
      return 2;
    case 'CRITICAL':
      return 3;
    default:
      return 0;
  }
}

function phaseFromTick(tick: number): RunPhase {
  const t = clamp(Math.floor(tick), 0, RUN_TOTAL_TICKS);
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function regimeAtTick(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const e of sorted) {
    if (e.tick <= tick && e.regimeChange) regime = e.regimeChange;
  }
  return regime;
}

function chaosAtTick(seed: string, tick: number): boolean {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function derivePressureTier(regime: MacroRegime, chaos: boolean, maxSinglePct: number, top1Pct: number): PressureTier {
  if (chaos) return 'CRITICAL';
  if (regime === 'CRISIS') return top1Pct > maxSinglePct ? 'CRITICAL' : 'HIGH';
  if (regime === 'BEAR') return top1Pct > maxSinglePct ? 'HIGH' : 'MEDIUM';
  if (regime === 'BULL') return top1Pct > maxSinglePct ? 'MEDIUM' : 'LOW';
  return top1Pct > maxSinglePct ? 'HIGH' : 'MEDIUM';
}

function deriveTickTier(pressure: PressureTier, pulseTick: boolean, chaos: boolean): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH' || pulseTick || chaos) return 'ELEVATED';
  return 'STANDARD';
}

function applyRegimeOverride(t: ExposureThreshold, regime: MacroRegime): ExposureThreshold {
  const o = t.regimeOverrides?.[regime];
  if (!o) return t;
  return {
    ...t,
    maxSingleAssetPct: o.maxSingleAssetPct ?? t.maxSingleAssetPct,
    maxTop3Pct: o.maxTop3Pct ?? t.maxTop3Pct,
    hardCap: o.hardCap ?? t.hardCap,
  };
}

function defaultThreshold(): ExposureThreshold {
  return {
    id: 'default',
    label: 'Default cap',
    maxSingleAssetPct: 0.45,
    maxTop3Pct: 0.75,
    hardCap: false,
  };
}

function pickThreshold(seed: string, tick: number, thresholds: ExposureThreshold[]): ExposureThreshold {
  const list = thresholds.length > 0 ? thresholds : [defaultThreshold()];
  const stable = [...list].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const shuffled = seededShuffle(stable, seed + ':m35:thresholds:' + tick);
  return shuffled[seededIndex(seed, tick + 350, shuffled.length)] ?? defaultThreshold();
}

function pickMitigationCard(seed: string, tick: number, phase: RunPhase, pressure: PressureTier, regime: MacroRegime): GameCard {
  const pw = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phw = PHASE_WEIGHTS[phase] ?? 1.0;
  const rw = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(seed + ':m35:mitigation:' + tick, pw * phw, rw);
  const pick = pool[seededIndex(seed, tick + 901, pool.length)] ?? DEFAULT_CARD;

  return DEFAULT_CARD_IDS.includes(pick.id) ? pick : DEFAULT_CARD;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * exposureCapEnforcer
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function exposureCapEnforcer(input: M35Input, emit: MechanicEmitter): M35Output {
  const anyInput = input as any;

  const stateAssets = (input.stateAssets as Asset[]) ?? [];
  const thresholdsRaw = (input.exposureThresholds as ExposureThreshold[]) ?? [];

  const seed =
    String(anyInput.runSeed ?? anyInput.seed ?? anyInput.runId ?? '') ||
    computeHash(JSON.stringify(input) + ':M35');

  const tick = clamp(Math.floor(Number(anyInput.stateTick ?? anyInput.tick ?? 0)), 0, RUN_TOTAL_TICKS);
  const phase = phaseFromTick(tick);

  const regimeFromSnap = (anyInput.stateMacroRegime ?? anyInput.macroRegime) as MacroRegime | undefined;
  const regime: MacroRegime = regimeFromSnap ?? regimeAtTick(seed, tick);

  const chaos = chaosAtTick(seed, tick);
  const pulseTick = tick % M35_BOUNDS.PULSE_CYCLE === 0;

  // ensure direct usage of these shared constants even if thresholds are empty
  const opportunityPoolSize = OPPORTUNITY_POOL.length;
  const defaultCardId = DEFAULT_CARD.id;

  // portfolio concentration
  const totalValue = stateAssets.reduce((s, a) => s + clamp(Number(a.value ?? 0), 0, M35_BOUNDS.MAX_PROCEEDS), 0);
  const sorted = [...stateAssets].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
  const top1 = sorted[0];
  const top3 = sorted.slice(0, 3);

  const top1Value = clamp(Number(top1?.value ?? 0), 0, M35_BOUNDS.MAX_PROCEEDS);
  const top3Value = top3.reduce((s, a) => s + clamp(Number(a.value ?? 0), 0, M35_BOUNDS.MAX_PROCEEDS), 0);

  const top1Pct = totalValue > 0 ? clamp(top1Value / totalValue, 0, 1) : 0;
  const top3Pct = totalValue > 0 ? clamp(top3Value / totalValue, 0, 1) : 0;

  // choose threshold deterministically, then apply regime override
  const chosen = applyRegimeOverride(pickThreshold(seed, tick, thresholdsRaw), regime);

  const maxSingle = clamp(chosen.maxSingleAssetPct, 0.05, 0.99);
  const maxTop3 = clamp(chosen.maxTop3Pct, 0.10, 0.99);

  // only enforce at/above minPressureTier (if set); pressure itself depends on the breach signal
  const provisionalPressure = derivePressureTier(regime, chaos, maxSingle, top1Pct);
  const minP = chosen.minPressureTier ? pressureRank(chosen.minPressureTier) : 0;
  const enforce = pressureRank(provisionalPressure) >= minP;

  const breachSingle = enforce && top1Pct > maxSingle;
  const breachTop3 = enforce && top3Pct > maxTop3;

  const nearSingle = enforce && !breachSingle && top1Pct > maxSingle * 0.90;
  const nearTop3 = enforce && !breachTop3 && top3Pct > maxTop3 * 0.90;

  const pressure: PressureTier = provisionalPressure;
  const tickTier: TickTier = deriveTickTier(pressure, pulseTick, chaos);

  // solvency proxy (true solvency is handled elsewhere)
  const solvencyStatus: SolvencyStatus =
    totalValue <= 0 ? 'BLEED' : stateAssets.length >= M35_BOUNDS.TRIGGER_THRESHOLD ? 'SOLVENT' : 'BLEED';

  // Heat computation (0..1)
  const singleOver = breachSingle ? (top1Pct / maxSingle - 1) : nearSingle ? (top1Pct / maxSingle - 1) * 0.5 : 0;
  const top3Over = breachTop3 ? (top3Pct / maxTop3 - 1) : nearTop3 ? (top3Pct / maxTop3 - 1) * 0.5 : 0;

  // Regime tightening: crisis should amplify heat; bull should slightly relax it.
  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulseMult = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  const pw = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const phw = PHASE_WEIGHTS[phase] ?? 1.0;
  const rw = REGIME_WEIGHTS[regime] ?? 1.0;

  const decayRate = computeDecayRate(regime, M35_BOUNDS.BASE_DECAY_RATE);
  const ageFactor = RUN_TOTAL_TICKS > 0 ? tick / RUN_TOTAL_TICKS : 0;

  const chaosMult = chaos ? 1.10 : 1.0;
  const pulseMult = pulseTick ? 1.03 : 1.0;

  // Note: REGIME_MULTIPLIERS > 1 in BULL; for risk heat we want inverse behavior.
  const riskRegimeTighten = clamp(1.0 / Math.max(0.25, regimeMult), 0.50, 1.80);
  const riskExitTighten = clamp(1.0 / Math.max(0.25, exitPulseMult), 0.50, 2.25);

  const rawHeat =
    clamp(Math.max(singleOver, top3Over), 0, 3) *
    M35_BOUNDS.MULTIPLIER *
    M35_BOUNDS.EFFECT_MULTIPLIER *
    pw *
    phw *
    rw *
    riskRegimeTighten *
    riskExitTighten *
    chaosMult *
    pulseMult *
    (1 - clamp(decayRate * ageFactor, 0, 0.90));

  const heat01 = clamp(rawHeat / 2.0, 0, 1); // normalize
  const exposureHeat = clamp(heat01 * M35_BOUNDS.MAX_EFFECT, M35_BOUNDS.MIN_EFFECT, M35_BOUNDS.MAX_EFFECT);

  // Recommend an action (card) for telemetry (no state mutation here)
  const mitigationCard = pickMitigationCard(seed, tick, phase, pressure, regime);

  const hard = !!chosen.hardCap;
  const hardBreach = hard && (breachSingle || breachTop3);
  const warning = hardBreach || breachSingle || breachTop3 || nearSingle || nearTop3;

  // compute suggested trim (dollar value to reduce from top asset to satisfy maxSingle)
  const targetSingleValue = totalValue > 0 ? clamp(maxSingle * totalValue, 0, totalValue) : 0;
  const suggestedTrim = clamp(top1Value - targetSingleValue, 0, M35_BOUNDS.MAX_AMOUNT);

  const auditHash = computeHash(
    JSON.stringify({
      seed,
      tick,
      phase,
      regime,
      pressure,
      tickTier,
      solvencyStatus,
      chaos,
      pulseTick,
      totalValue,
      top1Pct,
      top3Pct,
      chosen: { id: chosen.id, maxSingle, maxTop3, hardCap: hard, minPressureTier: chosen.minPressureTier ?? null },
      breachSingle,
      breachTop3,
      nearSingle,
      nearTop3,
      exposureHeat,
      mitigationCardId: mitigationCard.id,
      suggestedTrim,
      opportunityPoolSize,
      defaultCardId,
    }) + ':M35:v1',
  );

  if (breachSingle || breachTop3) {
    emit({
      event: 'EXPOSURE_THRESHOLD_BREACHED',
      mechanic_id: 'M35',
      tick,
      runId: seed,
      payload: {
        auditHash,
        thresholdId: chosen.id,
        thresholdLabel: chosen.label,
        enforce,
        metrics: {
          totalValue,
          top1AssetId: String(top1?.id ?? ''),
          top1Value,
          top1Pct,
          top3Pct,
        },
        limits: { maxSingle, maxTop3 },
        regime,
        phase,
        pressure,
        tickTier,
        chaos,
        pulseTick,
        mitigationCardId: mitigationCard.id,
        suggestedTrim,
      },
    });

    if (hardBreach) {
      emit({
        event: 'EXPOSURE_CAPPED',
        mechanic_id: 'M35',
        tick,
        runId: seed,
        payload: {
          auditHash,
          capMode: 'HARD',
          thresholdId: chosen.id,
          capReason: breachSingle ? 'SINGLE_ASSET_PCT' : 'TOP3_PCT',
          recommendedAction: {
            type: 'TRIM_TOP_ASSET',
            assetId: String(top1?.id ?? ''),
            suggestedTrim,
            mitigationCardId: mitigationCard.id,
          },
          opportunityPoolSize,
          defaultCardId,
        },
      });
    }
  } else if (nearSingle || nearTop3) {
    emit({
      event: 'OVEREXPOSURE_WARNING',
      mechanic_id: 'M35',
      tick,
      runId: seed,
      payload: {
        auditHash,
        thresholdId: chosen.id,
        thresholdLabel: chosen.label,
        enforce,
        metrics: {
          totalValue,
          top1AssetId: String(top1?.id ?? ''),
          top1Value,
          top1Pct,
          top3Pct,
        },
        limits: { maxSingle, maxTop3 },
        regime,
        phase,
        pressure,
        tickTier,
        chaos,
        pulseTick,
        mitigationCardId: mitigationCard.id,
      },
    });
  }

  return {
    exposureHeat,
    cappedWarning: warning,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M35MLInput {
  exposureHeat?: number;
  cappedWarning?: boolean;
  runId: string;
  tick: number;
}

export interface M35MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * exposureCapEnforcerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function exposureCapEnforcerMLCompanion(input: M35MLInput): Promise<M35MLOutput> {
  const tick = clamp(Math.floor(input.tick ?? 0), 0, RUN_TOTAL_TICKS);
  const runId = String(input.runId ?? '');

  const regime = regimeAtTick(runId || computeHash(JSON.stringify(input)), tick);
  const decay = computeDecayRate(regime, M35_BOUNDS.BASE_DECAY_RATE);

  const heat = clamp(Number(input.exposureHeat ?? 0), 0, M35_BOUNDS.MAX_EFFECT);
  const warned = !!input.cappedWarning;

  const heat01 = clamp(heat / Math.max(1, M35_BOUNDS.MAX_EFFECT), 0, 1);
  const score = clamp(0.10 + heat01 * 0.75 + (warned ? 0.10 : 0), 0.01, 0.99);

  const topFactors: string[] = [
    warned ? 'Cap warning active' : 'No cap warning',
    `Heat=${Math.round(heat)}/${M35_BOUNDS.MAX_EFFECT}`,
    `Regime=${regime}`,
    `Tick=${tick}/${RUN_TOTAL_TICKS}`,
    `Decay=${decay.toFixed(2)}`,
  ].slice(0, 5);

  const recommendation = warned
    ? 'Reduce concentration by trimming the largest position and adding a second cashflow leg.'
    : 'Keep position sizing balanced; avoid letting a single asset dominate total value.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ ...input, regime, decay }) + ':ml:M35'),
    confidenceDecay: clamp(decay, 0.01, 0.99),
  };
}