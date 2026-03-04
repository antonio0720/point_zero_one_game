// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m60_net_exposure_liability_netting.ts
//
// Mechanic : M60 — Net Exposure + Liability Netting
// Family   : portfolio_advanced   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m60a
// Deps     : M35, M07
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

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M60Input {
  // Snapshot passthrough (snapshotExtractor spreads ...snap into every mechanic input)
  runId?: string;
  tick?: number;

  // Domain state
  stateLiabilities?: Liability[];
  stateAssets?: Asset[];
}

export interface M60Output {
  netExposure: number;
  nettingApplied: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M60Event = 'LIABILITY_NETTED' | 'NET_EXPOSURE_COMPUTED' | 'NETTING_APPLIED';

export interface M60TelemetryPayload extends MechanicTelemetryPayload {
  event: M60Event;
  mechanic_id: 'M60';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M60_BOUNDS = {
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

type _M60_AllTypeImportsUsed = {
  a: RunPhase;
  b: TickTier;
  c: MacroRegime;
  d: PressureTier;
  e: SolvencyStatus;
  f: Asset;
  g: IPAItem;
  h: GameCard;
  i: GameEvent;
  j: ShieldLayer;
  k: Debt;
  l: Buff;
  m: Liability;
  n: SetBonus;
  o: AssetMod;
  p: IncomeItem;
  q: MacroEvent;
  r: ChaosWindow;
  s: AuctionResult;
  t: PurchaseResult;
  u: ShieldResult;
  v: ExitResult;
  w: TickResult;
  x: DeckComposition;
  y: TierProgress;
  z: WipeEvent;
  aa: RegimeShiftEvent;
  ab: PhaseTransitionEvent;
  ac: TimerExpiredEvent;
  ad: StreakEvent;
  ae: FubarEvent;
  af: LedgerEntry;
  ag: ProofCard;
  ah: CompletedRun;
  ai: SeasonState;
  aj: RunState;
  ak: MomentEvent;
  al: ClipBoundary;
  am: MechanicTelemetryPayload;
  an: MechanicEmitter;
};

function m60DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.33)) return 'EARLY';
  if (t < Math.floor(RUN_TOTAL_TICKS * 0.66)) return 'MID';
  return 'LATE';
}

function m60ResolveRegime(seed: string, tick: number): MacroRegime {
  const schedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN).slice().sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of schedule) {
    if (ev.tick <= tick && ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m60IsInChaosWindow(seed: string, tick: number): { inChaos: boolean; window: ChaosWindow | null } {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return { inChaos: true, window: w };
  }
  return { inChaos: false, window: null };
}

function m60DerivePressureTier(totalLiability: number, totalAssetValue: number): PressureTier {
  const denom = Math.max(1, totalAssetValue);
  const ratio = totalLiability / denom;
  if (ratio <= 0.25) return 'LOW';
  if (ratio <= 0.75) return 'MEDIUM';
  if (ratio <= 1.25) return 'HIGH';
  return 'CRITICAL';
}

function m60DeriveTickTier(netExposure: number): TickTier {
  if (netExposure >= 25_000) return 'CRITICAL';
  if (netExposure >= 10_000) return 'ELEVATED';
  return 'STANDARD';
}

function m60PickReferenceCard(seed: string, tick: number, pool: GameCard[]): GameCard {
  const deck = seededShuffle(DEFAULT_CARD_IDS, seed);
  const pickedId = deck[seededIndex(seed, tick, deck.length)] ?? DEFAULT_CARD.id;

  const fromPool = pool.find(c => c.id === pickedId);
  if (fromPool) return fromPool;

  const fromOpp = OPPORTUNITY_POOL.find(c => c.id === pickedId);
  if (fromOpp) return fromOpp;

  return DEFAULT_CARD;
}

function m60StableDescByAmount<T extends { id: string; amount: number }>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => {
    const d = (b.amount ?? 0) - (a.amount ?? 0);
    if (d !== 0) return d;
    const ha = computeHash(String(a.id));
    const hb = computeHash(String(b.id));
    return hb.localeCompare(ha);
  });
}

function m60StableDescByValue<T extends { id: string; value: number }>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => {
    const d = (b.value ?? 0) - (a.value ?? 0);
    if (d !== 0) return d;
    const ha = computeHash(String(a.id));
    const hb = computeHash(String(b.id));
    return hb.localeCompare(ha);
  });
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * liabilityNettingEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function liabilityNettingEngine(
  input: M60Input,
  emit: MechanicEmitter,
): M60Output {
  // Keep all `import type { ... }` bindings actively referenced.
  const __typeSentinel: _M60_AllTypeImportsUsed | null = null;
  void __typeSentinel;

  const stateLiabilities = (input.stateLiabilities as Liability[]) ?? [];
  const stateAssets = (input.stateAssets as Asset[]) ?? [];

  const runId =
    String(input.runId ?? '') ||
    computeHash(
      [
        'M60',
        JSON.stringify(stateLiabilities.map(l => l.id).slice(0, 32)),
        JSON.stringify(stateAssets.map(a => a.id).slice(0, 32)),
      ].join(':'),
    );

  const tick = clamp(
    typeof input.tick === 'number' ? input.tick : seededIndex(runId, 60, RUN_TOTAL_TICKS),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  const totalLiability = stateLiabilities.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const totalAssetValue = stateAssets.reduce((s, a) => s + (Number(a.value) || 0), 0);

  const phase = m60DerivePhase(tick);
  const regime = m60ResolveRegime(runId, tick);
  const { inChaos, window } = m60IsInChaosWindow(runId, tick);

  const pressureTier = m60DerivePressureTier(totalLiability, totalAssetValue);

  const pressurePhaseWeight = (PRESSURE_WEIGHTS[pressureTier] ?? 1.0) * (PHASE_WEIGHTS[phase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(`${runId}:m60:${tick}`, pressurePhaseWeight, regimeWeight);
  const referenceCard = m60PickReferenceCard(runId, tick, pool);

  const decay = computeDecayRate(regime, M60_BOUNDS.BASE_DECAY_RATE);
  const regimeMult = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulseMult = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;

  // Card-driven haircut (ties M60 to the deck/auction ecosystem deterministically)
  const cardCost = Number(referenceCard.cost ?? 0) || 0;
  const cardDown = Number(referenceCard.downPayment ?? 0) || 0;
  const cardHaircut = clamp((cardCost + cardDown) / 250_000, 0, 0.15); // 0..15%

  // Netting efficiency: bounded + deterministic + regime/phase/pressure aware
  let nettingEfficiency =
    0.35 +
    clamp(pressurePhaseWeight * regimeWeight, 0.25, 2.5) *
      0.18 *
      clamp((1 - decay) * regimeMult * exitPulseMult, 0.25, 1.5);

  nettingEfficiency *= inChaos ? 0.85 : 1.0;
  nettingEfficiency *= 1 - cardHaircut;

  nettingEfficiency = clamp(nettingEfficiency, 0.15, 0.95);

  const shouldApplyNetting = stateLiabilities.length >= M60_BOUNDS.TRIGGER_THRESHOLD && stateAssets.length > 0;

  // Baseline exposure (no netting)
  const baselineNetExposureRaw = totalLiability - totalAssetValue;

  // Netting simulation (no mutation)
  let nettedDebt = 0;
  let assetUsedValue = 0;

  if (shouldApplyNetting) {
    const liabilitiesOrdered = m60StableDescByAmount(
      seededShuffle(
        stateLiabilities.map(l => ({ id: l.id, amount: Number(l.amount) || 0 })),
        `${runId}:m60:liabs:${tick}`,
      ),
    );

    const assetsOrdered = m60StableDescByValue(
      seededShuffle(
        stateAssets.map(a => ({ id: a.id, value: Number(a.value) || 0 })),
        `${runId}:m60:assets:${tick}`,
      ),
    );

    let ai = 0;
    let remainingCollateralOnAsset = 0;
    let currentAssetValue = 0;

    const advanceAsset = (): void => {
      if (ai >= assetsOrdered.length) {
        remainingCollateralOnAsset = 0;
        currentAssetValue = 0;
        return;
      }
      const a = assetsOrdered[ai++];
      currentAssetValue = a.value;
      remainingCollateralOnAsset = a.value * nettingEfficiency;
    };

    advanceAsset();

    for (const liab of liabilitiesOrdered) {
      let remainingDebt = clamp(liab.amount, 0, Number.MAX_SAFE_INTEGER);

      while (remainingDebt > 0 && remainingCollateralOnAsset > 0) {
        const offset = clamp(
          Math.min(remainingDebt, remainingCollateralOnAsset),
          0,
          M60_BOUNDS.MAX_AMOUNT,
        );

        if (offset <= 0) break;

        remainingDebt -= offset;
        remainingCollateralOnAsset -= offset;

        nettedDebt += offset;
        assetUsedValue += offset / Math.max(0.0001, nettingEfficiency);

        emit({
          event: 'LIABILITY_NETTED',
          mechanic_id: 'M60',
          tick,
          runId,
          payload: {
            liabilityId: liab.id,
            offset,
            nettingEfficiency,
            inChaos,
          },
        });

        if (remainingCollateralOnAsset <= 0) advanceAsset();
        if (assetUsedValue >= totalAssetValue) break;
      }

      if (assetUsedValue >= totalAssetValue) break;
      if (ai >= assetsOrdered.length && remainingCollateralOnAsset <= 0) break;
    }

    assetUsedValue = clamp(assetUsedValue, 0, totalAssetValue);
  }

  const netLiabilityAfter = Math.max(0, totalLiability - nettedDebt);
  const netAssetsAfter = Math.max(0, totalAssetValue - assetUsedValue);

  const netExposureRaw = netLiabilityAfter - netAssetsAfter;

  // Output is "exposure" (risk above coverage) => floor at 0 and cap.
  const netExposure = clamp(
    Math.round(Math.max(0, netExposureRaw) * M60_BOUNDS.MULTIPLIER * M60_BOUNDS.EFFECT_MULTIPLIER),
    M60_BOUNDS.MIN_EFFECT,
    M60_BOUNDS.MAX_EFFECT,
  );

  const nettingApplied = shouldApplyNetting && nettedDebt > 0;

  const tickTier = m60DeriveTickTier(netExposure);
  const solvencyStatus: SolvencyStatus =
    netExposure >= 50_000 ? 'WIPED' : netExposure >= M60_BOUNDS.BLEED_CASH_THRESHOLD ? 'BLEED' : 'SOLVENT';

  emit({
    event: 'NET_EXPOSURE_COMPUTED',
    mechanic_id: 'M60',
    tick,
    runId,
    payload: {
      baselineNetExposureRaw,
      netExposureRaw,
      netExposure,
      tickTier,
      solvencyStatus,
      regime,
      phase,
      pressureTier,
      inChaos,
      chaosWindow: window,
      totalLiability,
      totalAssetValue,
      nettedDebt,
      assetUsedValue,
      netAssetsAfter,
      netLiabilityAfter,
      nettingEfficiency,
      decay,
      referenceCardId: referenceCard.id,
      poolSize: pool.length,
    },
  });

  if (nettingApplied) {
    emit({
      event: 'NETTING_APPLIED',
      mechanic_id: 'M60',
      tick,
      runId,
      payload: {
        netExposure,
        nettedDebt,
        assetUsedValue,
        nettingEfficiency,
        referenceCardId: referenceCard.id,
      },
    });
  }

  return {
    netExposure,
    nettingApplied,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M60MLInput {
  netExposure?: number;
  nettingApplied?: boolean;
  runId: string;
  tick: number;
}

export interface M60MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * liabilityNettingEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function liabilityNettingEngineMLCompanion(
  input: M60MLInput,
): Promise<M60MLOutput> {
  const exposure = Number(input.netExposure ?? 0) || 0;
  const applied = Boolean(input.nettingApplied);

  const score = clamp((exposure / M60_BOUNDS.MAX_EFFECT) * (applied ? 0.92 : 1.05), 0.01, 0.99);

  const topFactors: string[] = [
    `Exposure=${Math.round(exposure)}`,
    applied ? 'Netting applied' : 'No netting applied',
    `Tick=${input.tick}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: exposure >= M60_BOUNDS.REGIME_SHIFT_THRESHOLD
      ? 'Reduce leverage exposure immediately; prioritize liability reduction or higher-coverage assets.'
      : 'Maintain coverage discipline; keep liabilities nettable and avoid over-stacking obligations.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M60'),
    confidenceDecay: clamp(0.03 + score * 0.12, 0.03, 0.25),
  };
}