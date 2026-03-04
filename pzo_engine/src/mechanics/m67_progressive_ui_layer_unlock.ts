// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m67_progressive_ui_layer_unlock.ts
//
// Mechanic : M67 — Progressive UI Layer Unlock
// Family   : onboarding_advanced   Layer: ui_component   Priority: 2   Batch: 2
// ML Pair  : m67a
// Deps     : M41
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

export interface M67Input {
  // Optional UI/runtime passthrough
  runId?: string;
  tick?: number;

  runCount?: number;
  uiUnlockThresholds?: unknown;
}

export interface M67Output {
  uiLayerUnlocked: boolean;
  complexityRevealed: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M67Event = 'UI_LAYER_UNLOCKED' | 'COMPLEXITY_REVEALED' | 'FULL_UI_ACTIVE';

export interface M67TelemetryPayload extends MechanicTelemetryPayload {
  event: M67Event;
  mechanic_id: 'M67';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M67_BOUNDS = {
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

type _M67_AllTypeImportsUsed = {
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

function m67PickKey(obj: Record<string, number>, seed: string, tick: number): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return 'NEUTRAL';
  return keys[seededIndex(seed, tick, keys.length)] ?? keys[0]!;
}

function m67ChaosContext(seed: string, tick: number): { inChaos: boolean; window: ChaosWindow | null } {
  const windows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);
  for (const w of windows as unknown as any[]) {
    const startTick = typeof w?.startTick === 'number' ? w.startTick : -1;
    const endTick = typeof w?.endTick === 'number' ? w.endTick : -1;
    if (tick >= startTick && tick <= endTick) return { inChaos: true, window: w as ChaosWindow };
  }
  return { inChaos: false, window: null };
}

function m67DerivePressureKey(runCount: number, inChaos: boolean): string {
  // UI onboarding pressure: early runs are LOW, later runs increase.
  const r = clamp(runCount, 0, 10_000);
  const idx =
    clamp(r / 3, 0, 1) * 0.55 +
    clamp(r / 8, 0, 1) * 0.35 +
    (inChaos ? 0.10 : 0.0);

  if (idx <= 0.25) return 'LOW';
  if (idx <= 0.50) return 'MEDIUM';
  if (idx <= 0.75) return 'HIGH';
  return 'CRITICAL';
}

function m67PickReferenceCard(seed: string, tick: number, phaseKey: string, regimeKey: string, pressureKey: string): GameCard {
  const phaseW = (PHASE_WEIGHTS as unknown as Record<string, number>)[phaseKey] ?? 1.0;
  const regimeW = (REGIME_WEIGHTS as unknown as Record<string, number>)[regimeKey] ?? 1.0;
  const pressureW = (PRESSURE_WEIGHTS as unknown as Record<string, number>)[pressureKey] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:m67:${tick}`, pressureW * phaseW, regimeW);
  const effectivePool = pool.length > 0 ? pool : OPPORTUNITY_POOL;

  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:m67:deck`);
  const pickedId = deck[seededIndex(seed, tick, deck.length)] ?? DEFAULT_CARD.id;

  const fromPool = effectivePool.find(c => c.id === pickedId);
  if (fromPool) return fromPool;

  const fromOpp = OPPORTUNITY_POOL.find(c => c.id === pickedId);
  if (fromOpp) return fromOpp;

  return DEFAULT_CARD;
}

function m67ParseThresholds(
  uiUnlockThresholds: unknown,
  seed: string,
  tick: number,
): { layerRuns: number; complexityRuns: number; fullRuns: number } {
  // Accept { layerRuns, complexityRuns, fullRuns } if present; otherwise deterministic defaults.
  const obj = (uiUnlockThresholds && typeof uiUnlockThresholds === 'object') ? (uiUnlockThresholds as Record<string, unknown>) : {};

  const layerRunsRaw = typeof obj.layerRuns === 'number' ? obj.layerRuns : undefined;
  const complexityRunsRaw = typeof obj.complexityRuns === 'number' ? obj.complexityRuns : undefined;
  const fullRunsRaw = typeof obj.fullRuns === 'number' ? obj.fullRuns : undefined;

  // deterministic defaults (bounded, monotonic)
  const dLayer = 1 + seededIndex(`${seed}:m67:layer`, tick, 3);       // 1..3
  const dComplex = dLayer + 2 + seededIndex(`${seed}:m67:complex`, tick, 4); // +2..+5
  const dFull = dComplex + 3 + seededIndex(`${seed}:m67:full`, tick, 6);     // +3..+8

  let layerRuns = clamp(Math.floor(layerRunsRaw ?? dLayer), 0, 10_000);
  let complexityRuns = clamp(Math.floor(complexityRunsRaw ?? dComplex), 0, 10_000);
  let fullRuns = clamp(Math.floor(fullRunsRaw ?? dFull), 0, 10_000);

  // enforce monotonic
  if (complexityRuns < layerRuns) complexityRuns = layerRuns;
  if (fullRuns < complexityRuns) fullRuns = complexityRuns;

  return { layerRuns, complexityRuns, fullRuns };
}

function m67AdjustThresholdsForContext(
  base: { layerRuns: number; complexityRuns: number; fullRuns: number },
  runCount: number,
  regimeKey: string,
  phaseKey: string,
  pressureKey: string,
  inChaos: boolean,
  decay: number,
  referenceCard: GameCard,
): { layerRuns: number; complexityRuns: number; fullRuns: number; factor: number } {
  const phaseW = (PHASE_WEIGHTS as unknown as Record<string, number>)[phaseKey] ?? 1.0;
  const regimeW = (REGIME_WEIGHTS as unknown as Record<string, number>)[regimeKey] ?? 1.0;
  const pressureW = (PRESSURE_WEIGHTS as unknown as Record<string, number>)[pressureKey] ?? 1.0;

  const regimeMult = (REGIME_MULTIPLIERS as unknown as Record<string, number>)[regimeKey] ?? 1.0;
  const exitPulse = (EXIT_PULSE_MULTIPLIERS as unknown as Record<string, number>)[regimeKey] ?? 1.0;

  const cardCost = Number((referenceCard as any)?.cost ?? 0) || 0;
  const cardDown = Number((referenceCard as any)?.downPayment ?? 0) || 0;

  // Higher economic "weight" => slower UI unlock (prevents front-loading complexity when economy spikes).
  const econAnchor = clamp((cardCost + cardDown) / 250_000, 0, 0.35); // 0..0.35

  const chaosPenalty = inChaos ? 1.15 : 1.0;
  const decayPenalty = 1 + clamp(decay * 2.0, 0, 0.75); // 1..1.75

  // If user is already deep (runCount high), slightly ease thresholds so unlock doesn't stall.
  const progressRelief = 1 - clamp(runCount / 120, 0, 0.18); // 1..0.82

  // Factor > 1 means harder (later unlock); factor < 1 means easier.
  const factor =
    chaosPenalty *
    decayPenalty *
    (1 + econAnchor) *
    clamp((pressureW * phaseW * regimeW) / clamp(regimeMult * exitPulse, 0.35, 3.25), 0.50, 2.25) *
    progressRelief;

  // Adjust and re-monotonic.
  let layerRuns = clamp(Math.round(base.layerRuns * factor), 0, 10_000);
  let complexityRuns = clamp(Math.round(base.complexityRuns * factor), 0, 10_000);
  let fullRuns = clamp(Math.round(base.fullRuns * factor), 0, 10_000);

  if (complexityRuns < layerRuns) complexityRuns = layerRuns;
  if (fullRuns < complexityRuns) fullRuns = complexityRuns;

  return { layerRuns, complexityRuns, fullRuns, factor };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * progressiveUIUnlockEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function progressiveUIUnlockEngine(
  input: M67Input,
  emit: MechanicEmitter,
): M67Output {
  // Keep all `import type { ... }` bindings actively referenced.
  const __typeSentinel: _M67_AllTypeImportsUsed | null = null;
  void __typeSentinel;

  const runCount = clamp(Number(input.runCount ?? 0) || 0, 0, 10_000);

  const seed =
    String(input.runId ?? '') ||
    computeHash(
      [
        'M67',
        String(runCount),
        JSON.stringify(input.uiUnlockThresholds ?? null),
        JSON.stringify(DEFAULT_CARD_IDS.slice(0, 16)),
      ].join(':'),
    );

  const tick = clamp(
    typeof input.tick === 'number' ? input.tick : seededIndex(seed, 67, RUN_TOTAL_TICKS),
    0,
    RUN_TOTAL_TICKS - 1,
  );

  // Force deterministic macro timeline + chaos windows into the proof chain.
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const macroHash = computeHash(JSON.stringify(macroSchedule)).slice(0, 16);

  const { inChaos, window } = m67ChaosContext(seed, tick);

  // Choose keys from actual weight objects (avoids guessing union literals).
  const phaseKey = m67PickKey(PHASE_WEIGHTS as unknown as Record<string, number>, `${seed}:phase`, tick);
  const regimeKey = m67PickKey(REGIME_WEIGHTS as unknown as Record<string, number>, `${seed}:regime`, tick);
  const pressureKey = m67DerivePressureKey(runCount, inChaos);

  const referenceCard = m67PickReferenceCard(seed, tick, phaseKey, regimeKey, pressureKey);

  // computeDecayRate requires MacroRegime; we cast the selected key deterministically.
  const decay = computeDecayRate(regimeKey as unknown as MacroRegime, M67_BOUNDS.BASE_DECAY_RATE);

  const baseThresholds = m67ParseThresholds(input.uiUnlockThresholds, seed, tick);
  const adjusted = m67AdjustThresholdsForContext(
    baseThresholds,
    runCount,
    regimeKey,
    phaseKey,
    pressureKey,
    inChaos,
    decay,
    referenceCard,
  );

  const uiLayerUnlocked = runCount >= adjusted.layerRuns;
  const complexityRevealed = runCount >= adjusted.complexityRuns;

  // Full UI state is derived but not returned (kept in telemetry to avoid breaking interface).
  const fullUIActive = uiLayerUnlocked && complexityRevealed && runCount >= adjusted.fullRuns;

  if (uiLayerUnlocked) {
    emit({
      event: 'UI_LAYER_UNLOCKED',
      mechanic_id: 'M67',
      tick,
      runId: seed,
      payload: {
        runCount,
        layerRuns: adjusted.layerRuns,
        complexityRuns: adjusted.complexityRuns,
        fullRuns: adjusted.fullRuns,
        factor: adjusted.factor,
        inChaos,
        chaosWindow: window,
        phaseKey,
        regimeKey,
        pressureKey,
        decay,
        macroHash,
        referenceCardId: referenceCard.id,
      },
    });
  }

  if (complexityRevealed) {
    emit({
      event: 'COMPLEXITY_REVEALED',
      mechanic_id: 'M67',
      tick,
      runId: seed,
      payload: {
        runCount,
        layerRuns: adjusted.layerRuns,
        complexityRuns: adjusted.complexityRuns,
        fullRuns: adjusted.fullRuns,
        factor: adjusted.factor,
        inChaos,
        chaosWindow: window,
        phaseKey,
        regimeKey,
        pressureKey,
        decay,
        macroHash,
        referenceCardId: referenceCard.id,
      },
    });
  }

  if (fullUIActive) {
    emit({
      event: 'FULL_UI_ACTIVE',
      mechanic_id: 'M67',
      tick,
      runId: seed,
      payload: {
        runCount,
        layerRuns: adjusted.layerRuns,
        complexityRuns: adjusted.complexityRuns,
        fullRuns: adjusted.fullRuns,
        factor: adjusted.factor,
        inChaos,
        chaosWindow: window,
        phaseKey,
        regimeKey,
        pressureKey,
        decay,
        macroHash,
        referenceCardId: referenceCard.id,
        proof: computeHash(
          [
            'M67',
            seed,
            String(tick),
            String(runCount),
            String(adjusted.layerRuns),
            String(adjusted.complexityRuns),
            String(adjusted.fullRuns),
            macroHash,
            referenceCard.id,
          ].join(':'),
        ),
      },
    });
  }

  return {
    uiLayerUnlocked,
    complexityRevealed,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M67MLInput {
  uiLayerUnlocked?: boolean;
  complexityRevealed?: boolean;
  runId: string;
  tick: number;
}

export interface M67MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * progressiveUIUnlockEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function progressiveUIUnlockEngineMLCompanion(
  input: M67MLInput,
): Promise<M67MLOutput> {
  const unlocked = Boolean(input.uiLayerUnlocked);
  const revealed = Boolean(input.complexityRevealed);

  const score = clamp((unlocked ? 0.52 : 0.18) + (revealed ? 0.35 : 0.0), 0.01, 0.99);

  const topFactors: string[] = [
    unlocked ? 'UI layer unlocked' : 'UI layer locked',
    revealed ? 'Complexity revealed' : 'Complexity hidden',
    `Tick=${input.tick}`,
  ].slice(0, 5);

  const recommendation =
    revealed
      ? 'Introduce advanced UI layers gradually; maintain clarity while expanding control surface.'
      : unlocked
        ? 'Reveal the next complexity layer after a few clean runs to avoid cognitive overload.'
        : 'Keep onboarding UI minimal until the player clears initial runs.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M67'),
    confidenceDecay: clamp(0.05 + (1 - score) * 0.12, 0.05, 0.22),
  };
}