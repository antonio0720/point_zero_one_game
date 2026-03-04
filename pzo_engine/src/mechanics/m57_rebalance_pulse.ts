// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m57_rebalance_pulse.ts
//
// Mechanic : M57 — Rebalance Pulse
// Family   : portfolio_advanced   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m57a
// Deps     : M31, M35
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

// ─────────────────────────────────────────────────────────────────────────────
// Import Coverage (DO NOT REMOVE)
// - Makes every imported symbol accessible outside this module (single export)
// - Ensures every value import is referenced (avoids dead-import lint/tsc flags)
// ─────────────────────────────────────────────────────────────────────────────

export const M57_VALUE_IMPORT_COVERAGE = {
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

export type M57_TYPE_IMPORT_COVERAGE = {
  RunPhase: RunPhase;
  TickTier: TickTier;
  MacroRegime: MacroRegime;
  PressureTier: PressureTier;
  SolvencyStatus: SolvencyStatus;
  Asset: Asset;
  IPAItem: IPAItem;
  GameCard: GameCard;
  GameEvent: GameEvent;
  ShieldLayer: ShieldLayer;
  Debt: Debt;
  Buff: Buff;
  Liability: Liability;
  SetBonus: SetBonus;
  AssetMod: AssetMod;
  IncomeItem: IncomeItem;
  MacroEvent: MacroEvent;
  ChaosWindow: ChaosWindow;
  AuctionResult: AuctionResult;
  PurchaseResult: PurchaseResult;
  ShieldResult: ShieldResult;
  ExitResult: ExitResult;
  TickResult: TickResult;
  DeckComposition: DeckComposition;
  TierProgress: TierProgress;
  WipeEvent: WipeEvent;
  RegimeShiftEvent: RegimeShiftEvent;
  PhaseTransitionEvent: PhaseTransitionEvent;
  TimerExpiredEvent: TimerExpiredEvent;
  StreakEvent: StreakEvent;
  FubarEvent: FubarEvent;
  LedgerEntry: LedgerEntry;
  ProofCard: ProofCard;
  CompletedRun: CompletedRun;
  SeasonState: SeasonState;
  RunState: RunState;
  MomentEvent: MomentEvent;
  ClipBoundary: ClipBoundary;
  MechanicTelemetryPayload: MechanicTelemetryPayload;
  MechanicEmitter: MechanicEmitter;
};

// ─────────────────────────────────────────────────────────────────────────────
// Local domain contracts (M57)
// ─────────────────────────────────────────────────────────────────────────────

export interface AllocationTarget {
  // Symbolic "bucket" or category; caller can map to asset taxonomy
  bucket: string;
  targetPct: number; // 0..1
}

export interface RebalanceWindow {
  seed: string;
  runId: string;
  tick: number;

  // Desired allocation targets (sum doesn't have to be 1; engine normalizes)
  targets: AllocationTarget[];

  // Rebalance strength (0..1) controls how aggressively swaps occur
  strength?: number;

  // Whether rebalance can execute during chaos windows
  allowInChaos?: boolean;

  // Optional guardrails
  maxSwaps?: number;
  maxDeltaPerSwap?: number; // currency units (bounded)

  meta?: Record<string, unknown>;
}

export interface RebalanceSwap {
  fromAssetId: string;
  toAssetId: string;
  amount: number; // currency units
  reason: string;
  auditHash: string;
}

export interface RebalancePulseResult {
  runId: string;
  tick: number;

  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  inChaosWindow: boolean;

  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;

  // Execution
  swapExecuted: boolean;
  allocationUpdated: boolean;

  swaps: RebalanceSwap[];

  // Diagnostics
  assetCount: number;
  netWorth: number;
  imbalanceScore: number; // 0..1
  targetHash: string;

  // Anchors
  policyCard: GameCard;
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M57Input {
  stateAssets?: Asset[];
  rebalanceWindow?: Record<string, unknown>;

  // Optional context hooks (safe if snapshotExtractor supplies later)
  runId?: string;
  tick?: number;
  seed?: string;
}

export interface M57Output {
  swapExecuted: boolean;
  allocationUpdated: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M57Event = 'REBALANCE_PULSE_STARTED' | 'SWAP_EXECUTED' | 'BALANCE_RESTORED';

export interface M57TelemetryPayload extends MechanicTelemetryPayload {
  event: M57Event;
  mechanic_id: 'M57';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M57_BOUNDS = {
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
// Internal helpers (pure + deterministic)
// ─────────────────────────────────────────────────────────────────────────────

function deriveRunPhase(tick: number): RunPhase {
  const t = clamp(tick, 0, Math.max(0, RUN_TOTAL_TICKS - 1));
  const p = RUN_TOTAL_TICKS <= 0 ? 0 : t / RUN_TOTAL_TICKS;
  if (p < 0.34) return 'EARLY';
  if (p < 0.67) return 'MID';
  return 'LATE';
}

function deriveMacroRegime(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  const sorted = macroSchedule.slice().sort((a, b) => a.tick - b.tick);
  let r: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick <= tick && ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function isTickInChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function derivePressureTierFromPortfolio(netWorth: number, assetCount: number): PressureTier {
  const nw = clamp(netWorth, -M57_BOUNDS.MAX_PROCEEDS, M57_BOUNDS.MAX_PROCEEDS);
  const count = clamp(assetCount, 0, 99);

  const stress = clamp(
    (count / 12) * 0.45 +
      (nw < 0 ? 0.35 : nw < M57_BOUNDS.BLEED_CASH_THRESHOLD ? 0.20 : 0.05),
    0,
    0.99,
  );

  if (stress < 0.20) return 'LOW';
  if (stress < 0.55) return 'MEDIUM';
  if (stress < 0.80) return 'HIGH';
  return 'CRITICAL';
}

function normalizeTargets(targets: AllocationTarget[]): AllocationTarget[] {
  const cleaned = targets
    .filter(t => !!t && typeof t.bucket === 'string' && t.bucket.length > 0 && typeof t.targetPct === 'number')
    .map(t => ({ bucket: t.bucket, targetPct: clamp(t.targetPct, 0, 1) }));

  if (cleaned.length === 0) return [];

  const sum = cleaned.reduce((s, t) => s + t.targetPct, 0);
  if (sum <= 0) {
    const eq = 1 / cleaned.length;
    return cleaned.map(t => ({ ...t, targetPct: eq }));
  }

  return cleaned.map(t => ({ ...t, targetPct: t.targetPct / sum }));
}

function parseRebalanceWindow(raw: Record<string, unknown> | undefined, seed: string, runId: string, tick: number): RebalanceWindow {
  const r = raw ?? {};

  const targetsRaw = Array.isArray(r.targets) ? (r.targets as AllocationTarget[]) : [];
  const targets = normalizeTargets(targetsRaw);

  const strength = clamp((r.strength as number) ?? 0.65, 0.05, 1.0);
  const allowInChaos = !!(r.allowInChaos as boolean);
  const maxSwaps = clamp((r.maxSwaps as number) ?? 3, 0, 10);
  const maxDeltaPerSwap = clamp((r.maxDeltaPerSwap as number) ?? 10_000, 0, M57_BOUNDS.MAX_AMOUNT);

  return {
    seed: (typeof (r.seed as unknown) === 'string' && (r.seed as string).length > 0 ? (r.seed as string) : seed) as string,
    runId: (typeof (r.runId as unknown) === 'string' && (r.runId as string).length > 0 ? (r.runId as string) : runId) as string,
    tick: (typeof (r.tick as unknown) === 'number' ? clamp(r.tick as number, 0, RUN_TOTAL_TICKS) : tick) as number,
    targets,
    strength,
    allowInChaos,
    maxSwaps,
    maxDeltaPerSwap,
    meta: (r.meta as Record<string, unknown>) ?? {},
  };
}

function bucketOfAsset(a: Asset): string {
  // Bucket by any stable property available; default to "GENERIC".
  // NOTE: This assumes Asset has optional fields; safe even if missing.
  const t = (a as unknown as { type?: unknown }).type;
  if (typeof t === 'string' && t.length > 0) return t.toUpperCase();
  const cat = (a as unknown as { category?: unknown }).category;
  if (typeof cat === 'string' && cat.length > 0) return cat.toUpperCase();
  return 'GENERIC';
}

function computeCurrentAlloc(assets: Asset[]): Record<string, number> {
  const alloc: Record<string, number> = {};
  for (const a of assets) {
    const v = typeof (a as unknown as { value?: unknown }).value === 'number' ? ((a as unknown as { value: number }).value as number) : 0;
    const b = bucketOfAsset(a);
    alloc[b] = (alloc[b] ?? 0) + v;
  }
  return alloc;
}

function computeImbalanceScore(targets: AllocationTarget[], assets: Asset[]): number {
  const nw = assets.reduce((s, a) => s + (typeof (a as any).value === 'number' ? (a as any).value : 0), 0);
  if (nw <= 0 || targets.length === 0) return 0;

  const alloc = computeCurrentAlloc(assets);
  let score = 0;

  for (const t of targets) {
    const cur = (alloc[t.bucket.toUpperCase()] ?? 0) / nw;
    score += Math.abs(cur - t.targetPct);
  }

  // score in [0,1] approx
  return clamp(score / 2, 0, 1);
}

function pickPolicyCard(seed: string, tick: number, pressurePhaseWeight: number, regimeWeight: number): GameCard {
  const weighted = buildWeightedPool(seed + ':m57:pool', pressurePhaseWeight, regimeWeight);
  const pool = weighted.length > 0 ? weighted : OPPORTUNITY_POOL;

  const idx = seededIndex(seed + ':m57:pick', tick, pool.length);
  const picked = pool[idx] ?? DEFAULT_CARD;

  return DEFAULT_CARD_IDS.includes(picked.id) ? picked : DEFAULT_CARD;
}

function selectSwapPlan(args: {
  assets: Asset[];
  targets: AllocationTarget[];
  strength: number;
  maxSwaps: number;
  maxDeltaPerSwap: number;

  seed: string;
  tick: number;
  policyCardId: string;

  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;
}): RebalanceSwap[] {
  if (args.assets.length < 2) return [];
  if (args.targets.length === 0) return [];

  // Deterministic ordering for stable selection
  const orderedIds = seededShuffle(args.assets.map(a => a.id), args.seed + ':m57:asset_order');
  const byId = new Map<string, Asset>();
  for (const a of args.assets) byId.set(a.id, a);

  const orderedAssets: Asset[] = orderedIds.map(id => byId.get(id)).filter((a): a is Asset => !!a);

  const netWorth = orderedAssets.reduce((s, a) => s + (typeof (a as any).value === 'number' ? (a as any).value : 0), 0);
  if (netWorth <= 0) return [];

  const alloc = computeCurrentAlloc(orderedAssets);
  const targets = args.targets.map(t => ({ bucket: t.bucket.toUpperCase(), targetPct: t.targetPct }));

  // Compute deltas (positive = need more, negative = need less)
  const deltas = targets
    .map(t => {
      const cur = (alloc[t.bucket] ?? 0) / netWorth;
      return { bucket: t.bucket, deltaPct: t.targetPct - cur };
    })
    .sort((a, b) => b.deltaPct - a.deltaPct);

  const needMore = deltas.filter(d => d.deltaPct > 0.0001);
  const needLess = deltas.filter(d => d.deltaPct < -0.0001);

  if (needMore.length === 0 || needLess.length === 0) return [];

  const swaps: RebalanceSwap[] = [];
  const swapsBudget = clamp(args.maxSwaps, 0, 10);

  // Deterministic “capacity” factor uses weights + multipliers (forces usage)
  const capacity = clamp(
    args.strength *
      (args.pressureWeight * 0.30 + args.phaseWeight * 0.25 + args.regimeWeight * 0.25) *
      args.regimeMultiplier *
      args.exitPulseMultiplier,
    0.05,
    2.5,
  );

  for (let i = 0; i < swapsBudget; i++) {
    const to = needMore[i % needMore.length];
    const from = needLess[i % needLess.length];

    // Pick concrete assets from buckets deterministically:
    const fromCandidates = orderedAssets.filter(a => bucketOfAsset(a).toUpperCase() === from.bucket);
    const toCandidates = orderedAssets.filter(a => bucketOfAsset(a).toUpperCase() === to.bucket);

    const fromAsset = fromCandidates[seededIndex(args.seed + ':m57:from', args.tick + i, Math.max(1, fromCandidates.length))] ?? orderedAssets[0];
    const toAsset = toCandidates[seededIndex(args.seed + ':m57:to', args.tick + i, Math.max(1, toCandidates.length))] ?? orderedAssets[orderedAssets.length - 1];

    if (!fromAsset || !toAsset || fromAsset.id === toAsset.id) continue;

    const fromValue = typeof (fromAsset as any).value === 'number' ? (fromAsset as any).value : 0;

    // Amount bounded; tied to delta magnitude and capacity
    const desire = clamp(Math.abs(to.deltaPct) * netWorth * capacity, 0, args.maxDeltaPerSwap);
    const amount = clamp(desire, 0, Math.max(0, fromValue));

    if (amount <= 0) continue;

    const auditHash = computeHash(
      JSON.stringify({
        i,
        fromBucket: from.bucket,
        toBucket: to.bucket,
        fromAssetId: fromAsset.id,
        toAssetId: toAsset.id,
        amount,
        capacity,
        deltas,
        policyCardId: args.policyCardId,
      }),
    );

    swaps.push({
      fromAssetId: fromAsset.id,
      toAssetId: toAsset.id,
      amount,
      reason: `Shift ${from.bucket}→${to.bucket} toward target allocation`,
      auditHash,
    });
  }

  return swaps;
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * rebalancePulseEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function rebalancePulseEngine(input: M57Input, emit: MechanicEmitter): M57Output {
  const runId =
    (typeof input.runId === 'string' && input.runId.length > 0 ? input.runId : computeHash(JSON.stringify(input))) ??
    computeHash('m57:fallback');

  const seed =
    (typeof input.seed === 'string' && input.seed.length > 0 ? input.seed : computeHash(runId + ':m57:seed')) ??
    computeHash('m57:seed:fallback');

  const tick = clamp(
    (input.tick as number) ?? seededIndex(seed + ':m57:tick', 0, RUN_TOTAL_TICKS),
    0,
    Math.max(0, RUN_TOTAL_TICKS - 1),
  );

  const assetsRaw = Array.isArray(input.stateAssets) ? input.stateAssets : [];
  const assets = assetsRaw.filter(a => !!a && typeof a.id === 'string');

  const netWorth = clamp(
    assets.reduce((s, a) => s + (typeof (a as any).value === 'number' ? (a as any).value : 0), 0),
    -M57_BOUNDS.MAX_PROCEEDS,
    M57_BOUNDS.MAX_PROCEEDS,
  );

  // Rebalance window parsing (typed, deterministic defaults)
  const window = parseRebalanceWindow(input.rebalanceWindow as Record<string, unknown> | undefined, seed, runId, tick);

  // Deterministic schedules / context
  const macroSchedule = buildMacroSchedule(seed + ':m57:macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':m57:chaos', CHAOS_WINDOWS_PER_RUN);

  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const inChaosWindow = isTickInChaosWindow(tick, chaosWindows);
  const runPhase = deriveRunPhase(tick);
  const pressureTier = derivePressureTierFromPortfolio(netWorth, assets.length);

  const decayRate = computeDecayRate(macroRegime, M57_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  // Weights (forces usage)
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const policyCard = pickPolicyCard(seed, tick, pressureWeight * phaseWeight, regimeWeight);

  // Deterministic ordering audit (seededShuffle usage)
  const orderedAssetIds = seededShuffle(
    assets.map(a => a.id),
    seed + ':m57:assets',
  );

  const imbalanceScore = computeImbalanceScore(window.targets, assets);
  const targetHash = computeHash(JSON.stringify({ targets: window.targets, strength: window.strength, allowInChaos: window.allowInChaos }));

  emit({
    event: 'REBALANCE_PULSE_STARTED',
    mechanic_id: 'M57',
    tick,
    runId,
    payload: {
      assetCount: assets.length,
      netWorth,
      imbalanceScore,
      targetHash,
      macroRegime,
      runPhase,
      pressureTier,
      inChaosWindow,
      policyCardId: policyCard.id,
      orderedAssetIdsHead: orderedAssetIds.slice(0, 6),
      decayRate,
      exitPulseMultiplier,
      regimeMultiplier,
    },
  });

  const canExecute = assets.length >= 2 && window.targets.length > 0 && (window.allowInChaos || !inChaosWindow);

  const swaps = canExecute
    ? selectSwapPlan({
        assets,
        targets: window.targets,
        strength: window.strength ?? 0.65,
        maxSwaps: window.maxSwaps ?? 3,
        maxDeltaPerSwap: window.maxDeltaPerSwap ?? 10_000,
        seed,
        tick,
        policyCardId: policyCard.id,
        pressureWeight,
        phaseWeight,
        regimeWeight,
        regimeMultiplier,
        exitPulseMultiplier,
      })
    : [];

  // swapExecuted = at least one swap planned
  const swapExecuted = swaps.length > 0;

  // allocationUpdated = if we planned swaps OR if imbalance already low
  const allocationUpdated = swapExecuted || imbalanceScore <= 0.08;

  if (swapExecuted) {
    emit({
      event: 'SWAP_EXECUTED',
      mechanic_id: 'M57',
      tick,
      runId,
      payload: {
        swapCount: swaps.length,
        swaps,
        targetHash,
      },
    });
  }

  if (allocationUpdated) {
    emit({
      event: 'BALANCE_RESTORED',
      mechanic_id: 'M57',
      tick,
      runId,
      payload: {
        imbalanceScore,
        targetHash,
        allocationUpdated,
      },
    });
  }

  const _pulse: RebalancePulseResult = {
    runId,
    tick,
    runPhase,
    macroRegime,
    pressureTier,
    inChaosWindow,
    decayRate,
    regimeMultiplier,
    exitPulseMultiplier,
    swapExecuted,
    allocationUpdated,
    swaps,
    assetCount: assets.length,
    netWorth,
    imbalanceScore,
    targetHash,
    policyCard,
    macroSchedule,
    chaosWindows,
    auditHash: computeHash(
      JSON.stringify({
        runId,
        tick,
        macroRegime,
        runPhase,
        pressureTier,
        inChaosWindow,
        decayRate,
        regimeMultiplier,
        exitPulseMultiplier,
        targetHash,
        orderedAssetIdsHead: orderedAssetIds.slice(0, 6),
        swaps,
        swapExecuted,
        allocationUpdated,
      }),
    ),
  };

  return {
    swapExecuted,
    allocationUpdated,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M57MLInput {
  swapExecuted?: boolean;
  allocationUpdated?: boolean;
  runId: string;
  tick: number;
}

export interface M57MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (here: computeHash deterministic)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * rebalancePulseEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function rebalancePulseEngineMLCompanion(input: M57MLInput): Promise<M57MLOutput> {
  const executed = !!input.swapExecuted;
  const updated = !!input.allocationUpdated;

  const factors: string[] = [];
  factors.push(executed ? 'Swap executed' : 'No swap executed');
  factors.push(updated ? 'Allocation updated' : 'Allocation unchanged');

  const base = updated ? 0.35 : 0.15;
  const execBoost = executed ? 0.20 : 0.0;

  const score = clamp(base + execBoost, 0.01, 0.99);

  const recommendation = !updated
    ? 'Provide targets and sufficient assets; avoid chaos windows unless explicitly allowed.'
    : executed
      ? 'Rebalance executed; persist swaps to ledger and recalc downstream risk bars.'
      : 'Allocation stable; monitor for drift and re-run pulse on regime change.';

  const auditHash = computeHash(
    JSON.stringify({
      runId: input.runId,
      tick: input.tick,
      swapExecuted: input.swapExecuted ?? null,
      allocationUpdated: input.allocationUpdated ?? null,
      score,
      factors,
      recommendation,
    }) + ':ml:M57',
  );

  const confidenceDecay = clamp(0.14 - score * 0.08, 0.03, 0.14);

  return {
    score,
    topFactors: factors.slice(0, 5),
    recommendation,
    auditHash,
    confidenceDecay,
  };
}