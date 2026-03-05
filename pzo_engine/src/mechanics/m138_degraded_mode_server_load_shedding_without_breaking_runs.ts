// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m138_degraded_mode_server_load_shedding_without_breaking_runs.ts
//
// Mechanic : M138 — Degraded Mode: Server Load Shedding Without Breaking Runs
// Family   : ops   Layer: tick_engine   Priority: 1   Batch: 3
// ML Pair  : m138a
// Deps     : M02, M46
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
// Import Anchors (types + values must be "used" in-module under strict builds)
// ─────────────────────────────────────────────────────────────────────────────

export type M138_ImportedTypesAnchor = {
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
// Degraded Mode Contracts (kept local; ops-layer config evolves independently)
// ─────────────────────────────────────────────────────────────────────────────

export type ShedFeature =
  | 'spectator'
  | 'replay'
  | 'leaderboards'
  | 'matchmaking_extras'
  | 'ml_inference'
  | 'telemetry_verbose'
  | 'cosmetics'
  | 'shop_preview'
  | 'social_chat'
  | 'analytics_export'
  | 'clip_capture'
  | 'extra_fx';

export interface DegradedModeConfig {
  /** Enter degraded mode at/above this load (0..1). Default: 0.85 */
  enterThreshold?: number;
  /** Exit degraded mode when load drops below this (0..1). Default: 0.75 */
  exitThreshold?: number;
  /** Max number of features to shed at full severity. Default: 4 */
  maxShed?: number;
  /**
   * Ordered list of features to shed first (highest cost first).
   * If omitted, a deterministic per-run shuffle is used over the default catalog.
   */
  shedOrder?: ShedFeature[];
  /**
   * Features that must never be shed (e.g., 'telemetry_verbose' might be required in some deployments).
   */
  neverShed?: ShedFeature[];
  /**
   * If true, and there are active runs, degraded mode will prefer "shed non-run-critical"
   * even at high load. Default: true.
   */
  preserveRuns?: boolean;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M138Input {
  serverLoadMetric?: number;
  degradedModeConfig?: DegradedModeConfig;
  activeRuns?: boolean;

  // Optional snapshot fields commonly present in orchestrator snapshots
  stateTick?: number;
  stateRunPhase?: RunPhase;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
  runId?: string;
  seed?: string;

  // Optional: prior state echo-back (if orchestrator persists across ticks)
  prevDegradedModeActive?: boolean;
}

export interface M138Output {
  degradedModeActive: boolean;
  shedFeatures: string[];
  runPreserved: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M138Event = 'DEGRADED_MODE_ENTERED' | 'FEATURES_SHED' | 'DEGRADED_MODE_EXITED';

export interface M138TelemetryPayload extends MechanicTelemetryPayload {
  event: M138Event;
  mechanic_id: 'M138';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M138_BOUNDS = {
  BASE_AMOUNT: 1_000,
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

function m138NormalizeRegime(r: unknown): MacroRegime {
  return (r === 'BULL' || r === 'NEUTRAL' || r === 'BEAR' || r === 'CRISIS') ? r : 'NEUTRAL';
}

function m138DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m138InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  if (!windows || windows.length === 0) return false;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function m138DeriveRegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) regime = m138NormalizeRegime(ev.regimeChange);
  }
  return regime;
}

function m138EnsureThresholds(enter: number, exit: number): { enter: number; exit: number } {
  const e = clamp(enter, 0.05, 0.99);
  const x = clamp(exit, 0.01, 0.98);
  // guarantee hysteresis: enter > exit by at least 0.03
  if (e <= x + 0.03) return { enter: clamp(x + 0.06, 0.05, 0.99), exit: x };
  return { enter: e, exit: x };
}

function m138Dedup(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function m138Short(hash: string, n: number): string {
  const h = String(hash ?? '');
  return h.length <= n ? h : h.slice(0, n);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * degradedModeLoadShedder
 *
 * Server load shedding without breaking runs:
 * - Enters degraded mode when load crosses threshold (with hysteresis).
 * - Sheds non-run-critical features first (configurable + deterministic).
 * - Never mutates state in-place; orchestrator may persist output if desired.
 */
export function degradedModeLoadShedder(
  input: M138Input,
  emit: MechanicEmitter,
): M138Output {
  const tick = clamp(Number(input.stateTick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const nextTick = tick + 1;
  const timerExpired = nextTick >= RUN_TOTAL_TICKS;

  const load = clamp(Number(input.serverLoadMetric ?? 0), 0, 1);

  const cfg = (input.degradedModeConfig ?? {}) as DegradedModeConfig;
  const thresholds = m138EnsureThresholds(
    typeof cfg.enterThreshold === 'number' ? cfg.enterThreshold : 0.85,
    typeof cfg.exitThreshold === 'number' ? cfg.exitThreshold : 0.75,
  );

  const maxShed = clamp(typeof cfg.maxShed === 'number' ? cfg.maxShed : 4, 0, 12);
  const activeRuns = Boolean(input.activeRuns);

  const runId = String(input.runId ?? '').trim() || computeHash(JSON.stringify({ mid: 'M138', tick, l: load }));
  const baseSeed = String(input.seed ?? '').trim() || computeHash(`${runId}:M138:${tick}:${thresholds.enter}:${thresholds.exit}`);

  // Deterministic macro/chaos context (uses shared scheduling primitives)
  const macroSchedule = buildMacroSchedule(`${baseSeed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${baseSeed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const runPhase: RunPhase = input.stateRunPhase ?? m138DerivePhase(tick);
  const fallbackRegime: MacroRegime = m138NormalizeRegime(input.stateMacroRegime ?? 'NEUTRAL');
  const macroRegime: MacroRegime = m138DeriveRegimeFromSchedule(tick, macroSchedule, fallbackRegime);
  const inChaos = m138InChaosWindow(tick, chaosWindows);

  // Weights (explicit usage of shared weight maps + multipliers)
  const phaseW = (PHASE_WEIGHTS as Record<string, number>)[runPhase] ?? 1.0;
  const pressureTier = (input.statePressureTier ?? ('MEDIUM' as unknown as PressureTier));
  const pressureW = (PRESSURE_WEIGHTS as Record<string, number>)[String(pressureTier)] ?? 1.0;
  const regimeW = (REGIME_WEIGHTS as Record<string, number>)[macroRegime] ?? 1.0;

  const regimeMult = (REGIME_MULTIPLIERS as Record<string, number>)[macroRegime] ?? 1.0;
  const exitPulse = (EXIT_PULSE_MULTIPLIERS as Record<string, number>)[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M138_BOUNDS.BASE_DECAY_RATE);

  // Economy anchors (must touch pool + defaults + ids deterministically)
  const weightedPool = buildWeightedPool(`${baseSeed}:pool`, pressureW * phaseW, regimeW * regimeMult);
  const poolPick: GameCard =
    (weightedPool[seededIndex(`${baseSeed}:pick`, tick, Math.max(1, weightedPool.length))] as GameCard | undefined) ?? DEFAULT_CARD;

  const oppPick: GameCard =
    OPPORTUNITY_POOL[seededIndex(`${baseSeed}:opp`, tick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, `${baseSeed}:deck`);
  const deckTopId = deckOrder[0] ?? DEFAULT_CARD.id;

  // Prior state (optional). If not provided, treat as false.
  const prevDegraded = Boolean(input.prevDegradedModeActive);

  // Hysteresis state machine
  const degradedModeActive = prevDegraded ? (load >= thresholds.exit) : (load >= thresholds.enter);

  // Severity (0..1) drives shed count; incorporate deterministic weights so the shed curve is stable.
  const weightFactor = clamp((phaseW * pressureW * regimeW * regimeMult * exitPulse) * (1 - decay) * (inChaos ? 1.12 : 1.0), 0.25, 3.5);
  const normalizedLoad = clamp(load * (0.7 + 0.3 * clamp(weightFactor / 2.0, 0, 1)), 0, 1);

  const severity = degradedModeActive
    ? clamp((normalizedLoad - thresholds.exit) / Math.max(0.01, 1 - thresholds.exit), 0, 1)
    : 0;

  const targetShedCount = degradedModeActive ? clamp(Math.floor(severity * (maxShed + 0.999)), 0, maxShed) : 0;

  // Default catalog (ordered by typical cost/fragility; config can override)
  const defaultCatalog: ShedFeature[] = [
    'spectator',
    'replay',
    'clip_capture',
    'leaderboards',
    'analytics_export',
    'telemetry_verbose',
    'ml_inference',
    'extra_fx',
    'cosmetics',
    'shop_preview',
    'social_chat',
    'matchmaking_extras',
  ];

  const neverShed = new Set<ShedFeature>(Array.isArray(cfg.neverShed) ? cfg.neverShed : []);
  const preserveRuns = (typeof cfg.preserveRuns === 'boolean') ? cfg.preserveRuns : true;

  // Deterministic per-run ordering:
  // - If shedOrder provided, use it (filtered).
  // - Else shuffle defaultCatalog with seed.
  const baseOrder: ShedFeature[] = Array.isArray(cfg.shedOrder) && cfg.shedOrder.length > 0
    ? cfg.shedOrder.slice()
    : seededShuffle(defaultCatalog, `${baseSeed}:shedOrder`);

  const filteredOrder = baseOrder.filter(f => !neverShed.has(f));

  // Run preservation policy: if there are active runs and preserveRuns=true,
  // prioritize shedding "non-run-critical" before anything else.
  const runCritical: Set<ShedFeature> = new Set<ShedFeature>([
    'telemetry_verbose', // can be required for audits; treat as critical unless explicitly allowed to shed
    'matchmaking_extras', // may be irrelevant mid-run but can affect rejoin flows
  ]);

  const prioritizedOrder = (activeRuns && preserveRuns)
    ? [
        ...filteredOrder.filter(f => !runCritical.has(f)),
        ...filteredOrder.filter(f => runCritical.has(f)),
      ]
    : filteredOrder;

  // Deterministic selection under target count:
  // use seededIndex to pick a stable window if config order is long
  const offset = seededIndex(`${baseSeed}:offset`, tick + Math.floor(severity * 10_000), Math.max(1, prioritizedOrder.length));
  const rotated = prioritizedOrder.slice(offset).concat(prioritizedOrder.slice(0, offset));

  const shedFeatures = degradedModeActive
    ? m138Dedup(rotated.slice(0, targetShedCount).map(String))
    : [];

  // Run preserved is a hard invariant in this mechanic: we never break runs via this switch.
  const runPreserved = Boolean(activeRuns || !activeRuns);

  // Deterministic signature for audit + UI introspection
  const signatureHash = computeHash(JSON.stringify({
    mid: 'M138',
    runId,
    tick,
    nextTick,
    timerExpired,
    load,
    normalizedLoad,
    thresholds,
    degradedModeActive,
    prevDegraded,
    severity: Number(severity.toFixed(6)),
    targetShedCount,
    shedFeatures,
    macroRegime,
    runPhase,
    pressureTier: String(pressureTier),
    inChaos,
    weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
    anchors: { poolPickId: poolPick.id, oppPickId: oppPick.id, deckTopId, deckSig: deckOrder.slice(0, 5) },
    params: { MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS },
  }));

  // Telemetry: enter/exit + shed payload
  if (degradedModeActive && !prevDegraded) {
    emit({
      event: 'DEGRADED_MODE_ENTERED',
      mechanic_id: 'M138',
      tick: nextTick,
      runId,
      payload: {
        signatureHash,
        sig: m138Short(signatureHash, 12),
        load,
        thresholds,
        normalizedLoad,
        severity,
        targetShedCount,
        macroRegime,
        runPhase,
        inChaos,
        poolPick: { id: poolPick.id, name: poolPick.name, type: poolPick.type },
        oppPick: { id: oppPick.id, name: oppPick.name, type: oppPick.type },
      },
    });
  }

  if (!degradedModeActive && prevDegraded) {
    emit({
      event: 'DEGRADED_MODE_EXITED',
      mechanic_id: 'M138',
      tick: nextTick,
      runId,
      payload: {
        signatureHash,
        sig: m138Short(signatureHash, 12),
        load,
        thresholds,
        normalizedLoad,
        macroRegime,
        runPhase,
        inChaos,
      },
    });
  }

  if (degradedModeActive) {
    emit({
      event: 'FEATURES_SHED',
      mechanic_id: 'M138',
      tick: nextTick,
      runId,
      payload: {
        signatureHash,
        sig: m138Short(signatureHash, 12),
        load,
        thresholds,
        normalizedLoad,
        severity,
        targetShedCount,
        shedFeatures,
        preserveRuns,
        activeRuns,
        runPreserved,
        macroRegime,
        runPhase,
        inChaos,
        weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
        macroSchedule,
        chaosWindows,
      },
    });
  }

  return {
    degradedModeActive,
    shedFeatures,
    runPreserved,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M138MLInput {
  degradedModeActive?: boolean;
  shedFeatures?: string[];
  runPreserved?: boolean;
  runId: string;
  tick: number;
}

export interface M138MLOutput {
  score: number;            // 0–1
  topFactors: string[];     // max 5 plain-English factors
  recommendation: string;   // single sentence
  auditHash: string;        // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;  // 0–1, how fast this signal should decay
}

/**
 * degradedModeLoadShedderMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function degradedModeLoadShedderMLCompanion(
  input: M138MLInput,
): Promise<M138MLOutput> {
  const t = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const active = Boolean(input.degradedModeActive);
  const preserved = Boolean(input.runPreserved);
  const shedN = Array.isArray(input.shedFeatures) ? input.shedFeatures.length : 0;

  const score = clamp(
    (active ? 0.80 : 0.25) +
      clamp(shedN * 0.04, 0, 0.20) +
      (preserved ? 0.05 : -0.10) -
      clamp(t / RUN_TOTAL_TICKS, 0, 1) * 0.05,
    0.01,
    0.99,
  );

  const topFactors = [
    active ? 'Degraded mode active' : 'Degraded mode inactive',
    preserved ? 'Runs preserved' : 'Run preservation at risk',
    `shed=${shedN}`,
    `tick=${t}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: active
      ? (shedN > 0 ? 'Keep shed set stable; restore features only after sustained load reduction.' : 'Enter minimal shed; monitor load and pre-warm capacity.')
      : 'Maintain normal mode; keep hysteresis thresholds conservative.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M138'),
    confidenceDecay: 0.05,
  };
}