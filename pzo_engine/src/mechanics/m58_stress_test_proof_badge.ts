// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m58_stress_test_proof_badge.ts
//
// Mechanic : M58 — Stress-Test Proof Badge
// Family   : portfolio_advanced   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m58a
// Deps     : M35, M50
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

export const M58_VALUE_IMPORT_COVERAGE = {
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

export type M58_TYPE_IMPORT_COVERAGE = {
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
// Local domain contracts (M58)
// ─────────────────────────────────────────────────────────────────────────────

export interface StressScenario {
  id: string;
  name: string;

  // Shock parameters (percentages are -1..+1)
  assetValueShockPct: number; // applied to portfolio value
  cashflowShockPct: number; // applied to implied cashflow
  volatilityShockPct: number; // impacts pass threshold

  // Deterministic duration (ticks)
  durationTicks: number;

  weight?: number; // score weight
  meta?: Record<string, unknown>;
}

export interface StressTestConfig {
  seed: string;
  runId: string;
  tick: number;

  // If empty, engine will deterministically choose defaults
  scenarios?: StressScenario[];

  // Acceptance thresholds
  maxDrawdownPct?: number; // 0..1
  minPostShockNetWorth?: number; // currency units
  requiredPassScore?: number; // 0..1

  // Whether tests may run during chaos windows
  allowInChaos?: boolean;

  meta?: Record<string, unknown>;
}

export interface StressTestOutcome {
  scenarioId: string;
  drawdownPct: number; // 0..1
  postShockNetWorth: number;

  // Deterministic pass/fail
  passed: boolean;
  score: number; // 0..1
  note: string;

  auditHash: string;
}

export interface StressTestResult {
  runId: string;
  tick: number;

  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  inChaosWindow: boolean;

  decayRate: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;

  policyCard: GameCard;

  netWorth: number;
  assetCount: number;

  scenarioCount: number;
  passed: boolean;
  passScore: number; // 0..1

  outcomes: StressTestOutcome[];
  configHash: string;

  auditHash: string;
}

export interface ProofBadgeReceipt {
  badgeId: string;
  label: string;

  runId: string;
  tick: number;

  // Badge severity tier (uses TickTier to keep it consistent with HUD bars)
  tier: TickTier;

  // Deterministic evidence anchors
  configHash: string;
  resultHash: string;

  // Policy anchors
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  inChaosWindow: boolean;

  policyCardId: string;

  issuedAt: number; // timestamp
  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M58Input {
  stressTestConfig?: Record<string, unknown>;
  stateAssets?: Asset[];

  // Optional context hooks (safe if snapshotExtractor supplies later)
  runId?: string;
  tick?: number;
  seed?: string;
}

export interface M58Output {
  stressTestResult: Record<string, unknown>;
  proofBadge: string;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M58Event = 'STRESS_TEST_ENTERED' | 'STRESS_TEST_PASSED' | 'PROOF_BADGE_ISSUED';

export interface M58TelemetryPayload extends MechanicTelemetryPayload {
  event: M58Event;
  mechanic_id: 'M58';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M58_BOUNDS = {
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
  const nw = clamp(netWorth, -M58_BOUNDS.MAX_PROCEEDS, M58_BOUNDS.MAX_PROCEEDS);
  const count = clamp(assetCount, 0, 99);

  const stress = clamp(
    (count / 12) * 0.45 +
      (nw < 0 ? 0.35 : nw < M58_BOUNDS.BLEED_CASH_THRESHOLD ? 0.20 : 0.05),
    0,
    0.99,
  );

  if (stress < 0.20) return 'LOW';
  if (stress < 0.55) return 'MEDIUM';
  if (stress < 0.80) return 'HIGH';
  return 'CRITICAL';
}

function pickPolicyCard(seed: string, tick: number, pressurePhaseWeight: number, regimeWeight: number): GameCard {
  const weighted = buildWeightedPool(seed + ':m58:pool', pressurePhaseWeight, regimeWeight);
  const pool = weighted.length > 0 ? weighted : OPPORTUNITY_POOL;

  const idx = seededIndex(seed + ':m58:pick', tick, pool.length);
  const picked = pool[idx] ?? DEFAULT_CARD;

  return DEFAULT_CARD_IDS.includes(picked.id) ? picked : DEFAULT_CARD;
}

function defaultScenarios(seed: string): StressScenario[] {
  // Deterministic defaults; slight variation by seed
  const base = seededIndex(seed + ':m58:scenario', 0, 1000) / 1000;
  const mild = clamp(0.12 + base * 0.06, 0.10, 0.20);
  const med = clamp(0.22 + base * 0.08, 0.18, 0.35);
  const severe = clamp(0.40 + base * 0.10, 0.32, 0.55);

  return [
    {
      id: 'M58_SCN_MILD',
      name: 'Mild Shock',
      assetValueShockPct: -mild,
      cashflowShockPct: -mild * 0.6,
      volatilityShockPct: 0.10,
      durationTicks: clamp(Math.round(M58_BOUNDS.PULSE_CYCLE / 2), 2, 18),
      weight: 0.25,
    },
    {
      id: 'M58_SCN_MED',
      name: 'Medium Shock',
      assetValueShockPct: -med,
      cashflowShockPct: -med * 0.7,
      volatilityShockPct: 0.22,
      durationTicks: clamp(Math.round(M58_BOUNDS.PULSE_CYCLE), 4, 24),
      weight: 0.35,
    },
    {
      id: 'M58_SCN_SEV',
      name: 'Severe Shock',
      assetValueShockPct: -severe,
      cashflowShockPct: -severe * 0.85,
      volatilityShockPct: 0.35,
      durationTicks: clamp(Math.round(M58_BOUNDS.PULSE_CYCLE * 1.5), 6, 30),
      weight: 0.40,
    },
  ];
}

function normalizeScenarios(s: StressScenario[], seed: string): StressScenario[] {
  const cleaned = s
    .filter(x => !!x && typeof x.id === 'string' && x.id.length > 0)
    .map(x => ({
      id: x.id,
      name: typeof x.name === 'string' && x.name.length > 0 ? x.name : x.id,
      assetValueShockPct: clamp((x.assetValueShockPct as number) ?? 0, -1, 1),
      cashflowShockPct: clamp((x.cashflowShockPct as number) ?? 0, -1, 1),
      volatilityShockPct: clamp((x.volatilityShockPct as number) ?? 0, 0, 1),
      durationTicks: clamp((x.durationTicks as number) ?? M58_BOUNDS.PULSE_CYCLE, 1, 60),
      weight: clamp((x.weight as number) ?? 1, 0.01, 1),
      meta: (x.meta as Record<string, unknown>) ?? {},
    }));

  // Stable, deterministic ordering
  return seededShuffle(cleaned, seed + ':m58:scn_order');
}

function parseConfig(raw: Record<string, unknown> | undefined, seed: string, runId: string, tick: number): StressTestConfig {
  const r = raw ?? {};
  const allowInChaos = !!(r.allowInChaos as boolean);

  const scenariosRaw = Array.isArray(r.scenarios) ? (r.scenarios as StressScenario[]) : [];
  const scenarios =
    scenariosRaw.length > 0 ? normalizeScenarios(scenariosRaw, seed) : normalizeScenarios(defaultScenarios(seed), seed);

  const maxDrawdownPct = clamp((r.maxDrawdownPct as number) ?? 0.35, 0.05, 0.90);
  const minPostShockNetWorth = clamp((r.minPostShockNetWorth as number) ?? 0, -M58_BOUNDS.MAX_PROCEEDS, M58_BOUNDS.MAX_PROCEEDS);
  const requiredPassScore = clamp((r.requiredPassScore as number) ?? 0.70, 0.10, 0.99);

  return {
    seed: (typeof (r.seed as unknown) === 'string' && (r.seed as string).length > 0 ? (r.seed as string) : seed) as string,
    runId: (typeof (r.runId as unknown) === 'string' && (r.runId as string).length > 0 ? (r.runId as string) : runId) as string,
    tick: (typeof (r.tick as unknown) === 'number' ? clamp(r.tick as number, 0, RUN_TOTAL_TICKS) : tick) as number,
    scenarios,
    maxDrawdownPct,
    minPostShockNetWorth,
    requiredPassScore,
    allowInChaos,
    meta: (r.meta as Record<string, unknown>) ?? {},
  };
}

function computeNetWorth(assets: Asset[]): number {
  return assets.reduce((s, a) => s + (typeof (a as any).value === 'number' ? (a as any).value : 0), 0);
}

function computeOutcome(args: {
  scenario: StressScenario;
  netWorth: number;
  config: StressTestConfig;

  // Context controls pass threshold (weights + multipliers + volatility)
  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
  regimeMultiplier: number;
  exitPulseMultiplier: number;
  inChaosWindow: boolean;

  seed: string;
  tick: number;
}): StressTestOutcome {
  const nw = args.netWorth;

  const shock = clamp(args.scenario.assetValueShockPct, -1, 1);
  const drawdownPct = clamp(-shock, 0, 1);
  const postShockNetWorth = clamp(nw * (1 + shock), -M58_BOUNDS.MAX_PROCEEDS, M58_BOUNDS.MAX_PROCEEDS);

  // Thresholds: stricter during chaos + higher volatility
  const chaosPenalty = args.inChaosWindow ? 0.10 : 0.0;
  const volPenalty = clamp(args.scenario.volatilityShockPct * 0.25, 0, 0.25);

  // Capacity: weights + multipliers influence how tolerant system is
  const capacity = clamp(
    (args.pressureWeight * 0.30 + args.phaseWeight * 0.25 + args.regimeWeight * 0.25) *
      args.regimeMultiplier *
      args.exitPulseMultiplier,
    0.35,
    2.2,
  );

  const maxDrawdownPct = args.config.maxDrawdownPct ?? 0.35;
  const allowedDrawdown = clamp(maxDrawdownPct * clamp(0.85 + capacity * 0.08, 0.75, 1.20), 0.05, 0.95);
  const passDrawdown = drawdownPct <= clamp(allowedDrawdown - chaosPenalty - volPenalty, 0.01, 0.99);
  const minNetWorth = args.config.minPostShockNetWorth ?? 0;
  const passNetWorth = postShockNetWorth >= minNetWorth;

  // Score: weighted blend of the above
  let score = 0.0;
  score += passDrawdown ? 0.55 : clamp(1 - drawdownPct / Math.max(0.01, allowedDrawdown), 0, 0.55);
  score += passNetWorth ? 0.45 : clamp(postShockNetWorth / Math.max(1, Math.abs(args.config.minPostShockNetWorth ?? 0) + 1), 0, 0.45);

  // Small deterministic jitter to prevent ties without randomness
  const jitter = (seededIndex(args.seed + ':m58:j', args.tick + args.scenario.durationTicks, 200) - 100) / 10_000; // -0.01..0.01
  score = clamp(score + jitter, 0.01, 0.99);

  const requiredPassScore = args.config.requiredPassScore ?? 0.70;
  const passed = score >= requiredPassScore && passDrawdown && passNetWorth;

  const auditHash = computeHash(
    JSON.stringify({
      scenarioId: args.scenario.id,
      drawdownPct,
      postShockNetWorth,
      allowedDrawdown,
      chaosPenalty,
      volPenalty,
      capacity,
      score,
      passed,
    }),
  );

  return {
    scenarioId: args.scenario.id,
    drawdownPct,
    postShockNetWorth,
    passed,
    score,
    note: passed ? 'PASS' : 'FAIL',
    auditHash,
  };
}

function deriveBadgeTier(args: { passed: boolean; passScore: number; inChaosWindow: boolean; macroRegime: MacroRegime }): TickTier {
  if (!args.passed) return 'STANDARD';
  if (args.inChaosWindow) return 'ELEVATED';
  if (args.macroRegime === 'CRISIS') return 'CRITICAL';
  if (args.passScore >= 0.90) return 'CRITICAL';
  if (args.passScore >= 0.80) return 'ELEVATED';
  return 'STANDARD';
}

function buildBadge(args: {
  runId: string;
  tick: number;
  tier: TickTier;
  configHash: string;
  resultHash: string;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  inChaosWindow: boolean;

  policyCardId: string;
}): ProofBadgeReceipt {
  const label =
    args.tier === 'CRITICAL' ? 'Stress-Proof (CRITICAL)' : args.tier === 'ELEVATED' ? 'Stress-Proof (ELEVATED)' : 'Stress-Proof';

  const auditHash = computeHash(
    JSON.stringify({
      runId: args.runId,
      tick: args.tick,
      tier: args.tier,
      configHash: args.configHash,
      resultHash: args.resultHash,
      macroRegime: args.macroRegime,
      runPhase: args.runPhase,
      pressureTier: args.pressureTier,
      inChaosWindow: args.inChaosWindow,
      policyCardId: args.policyCardId,
    }),
  );

  return {
    badgeId: computeHash('M58:' + args.runId + ':' + args.tick + ':' + args.resultHash),
    label,
    runId: args.runId,
    tick: args.tick,
    tier: args.tier,
    configHash: args.configHash,
    resultHash: args.resultHash,
    macroRegime: args.macroRegime,
    runPhase: args.runPhase,
    pressureTier: args.pressureTier,
    inChaosWindow: args.inChaosWindow,
    policyCardId: args.policyCardId,
    issuedAt: Date.now(),
    auditHash,
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * stressTestProofEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function stressTestProofEngine(input: M58Input, emit: MechanicEmitter): M58Output {
  const runId =
    (typeof input.runId === 'string' && input.runId.length > 0 ? input.runId : computeHash(JSON.stringify(input))) ??
    computeHash('m58:fallback');

  const seed =
    (typeof input.seed === 'string' && input.seed.length > 0 ? input.seed : computeHash(runId + ':m58:seed')) ??
    computeHash('m58:seed:fallback');

  const tick = clamp(
    (input.tick as number) ?? seededIndex(seed + ':m58:tick', 0, RUN_TOTAL_TICKS),
    0,
    Math.max(0, RUN_TOTAL_TICKS - 1),
  );

  const assetsRaw = Array.isArray(input.stateAssets) ? input.stateAssets : [];
  const assets = assetsRaw.filter(a => !!a && typeof a.id === 'string');

  // Deterministic ordering audit (seededShuffle usage)
  const orderedAssetIds = seededShuffle(
    assets.map(a => a.id),
    seed + ':m58:assets',
  );

  const netWorth = clamp(computeNetWorth(assets), -M58_BOUNDS.MAX_PROCEEDS, M58_BOUNDS.MAX_PROCEEDS);

  const config = parseConfig(input.stressTestConfig as Record<string, unknown> | undefined, seed, runId, tick);

  // Deterministic schedules / context (forces usage)
  const macroSchedule = buildMacroSchedule(seed + ':m58:macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':m58:chaos', CHAOS_WINDOWS_PER_RUN);

  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const inChaosWindow = isTickInChaosWindow(tick, chaosWindows);
  const runPhase = deriveRunPhase(tick);
  const pressureTier = derivePressureTierFromPortfolio(netWorth, assets.length);

  const decayRate = computeDecayRate(macroRegime, M58_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  // Weights (forces usage)
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const policyCard = pickPolicyCard(seed, tick, pressureWeight * phaseWeight, regimeWeight);

  const configHash = computeHash(
    JSON.stringify({
      runId: config.runId,
      tick: config.tick,
      allowInChaos: config.allowInChaos,
      maxDrawdownPct: config.maxDrawdownPct,
      minPostShockNetWorth: config.minPostShockNetWorth,
      requiredPassScore: config.requiredPassScore,
      scenarios: config.scenarios,
    }),
  );

  emit({
    event: 'STRESS_TEST_ENTERED',
    mechanic_id: 'M58',
    tick,
    runId,
    payload: {
      assetCount: assets.length,
      netWorth,
      configHash,
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

  const canRun = assets.length > 0 && (config.allowInChaos || !inChaosWindow);

  const outcomes = canRun
    ? (config.scenarios ?? []).map(s =>
        computeOutcome({
          scenario: s,
          netWorth,
          config,
          pressureWeight,
          phaseWeight,
          regimeWeight,
          regimeMultiplier,
          exitPulseMultiplier,
          inChaosWindow,
          seed,
          tick,
        }),
      )
    : [];

  const weightSum = outcomes.length > 0
    ? (config.scenarios ?? []).reduce((s, scn) => s + clamp((scn.weight as number) ?? 1, 0.01, 1), 0)
    : 0;

  let passScore = 0;
  if (outcomes.length > 0 && weightSum > 0) {
    for (let i = 0; i < outcomes.length; i++) {
      const scenario = config.scenarios?.[i];
      const w = clamp((scenario?.weight as number) ?? 1, 0.01, 1);
      passScore += outcomes[i].score * w;
    }
    passScore = clamp(passScore / weightSum, 0.01, 0.99);
  }

  const passed = outcomes.length > 0 && passScore >= (config.requiredPassScore ?? 0.70) && outcomes.every(o => o.passed);

  const resultHash = computeHash(
    JSON.stringify({
      runId,
      tick,
      configHash,
      outcomes,
      passScore,
      passed,
      macroRegime,
      runPhase,
      pressureTier,
      inChaosWindow,
      decayRate,
      exitPulseMultiplier,
      regimeMultiplier,
      policyCardId: policyCard.id,
    }),
  );

  const result: StressTestResult = {
    runId,
    tick,
    runPhase,
    macroRegime,
    pressureTier,
    inChaosWindow,
    decayRate,
    regimeMultiplier,
    exitPulseMultiplier,
    policyCard,
    netWorth,
    assetCount: assets.length,
    scenarioCount: config.scenarios?.length ?? 0,
    passed,
    passScore,
    outcomes,
    configHash,
    auditHash: resultHash,
  };

  const badgeTier = deriveBadgeTier({ passed, passScore, inChaosWindow, macroRegime });
  const badge = passed
    ? buildBadge({
        runId,
        tick,
        tier: badgeTier,
        configHash,
        resultHash,
        macroRegime,
        runPhase,
        pressureTier,
        inChaosWindow,
        policyCardId: policyCard.id,
      })
    : null;

  if (passed) {
    emit({
      event: 'STRESS_TEST_PASSED',
      mechanic_id: 'M58',
      tick,
      runId,
      payload: {
        passScore,
        configHash,
        resultHash,
        badgeTier,
      },
    });
  }

  if (badge) {
    emit({
      event: 'PROOF_BADGE_ISSUED',
      mechanic_id: 'M58',
      tick,
      runId,
      payload: {
        badgeId: badge.badgeId,
        label: badge.label,
        tier: badge.tier,
        configHash: badge.configHash,
        resultHash: badge.resultHash,
        policyCardId: badge.policyCardId,
        auditHash: badge.auditHash,
      },
    });
  }

  // Output shape preserved: return plain records + string.
  // `stressTestResult` includes full typed result for downstream callers.
  return {
    stressTestResult: result as unknown as Record<string, unknown>,
    proofBadge: badge ? badge.badgeId : '',
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M58MLInput {
  stressTestResult?: Record<string, unknown>;
  proofBadge?: string;
  runId: string;
  tick: number;
}

export interface M58MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (here: computeHash deterministic)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * stressTestProofEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function stressTestProofEngineMLCompanion(input: M58MLInput): Promise<M58MLOutput> {
  const badge = typeof input.proofBadge === 'string' ? input.proofBadge : '';
  const hasBadge = badge.length > 0;

  const factors: string[] = [];
  factors.push(hasBadge ? 'Proof badge issued' : 'No proof badge');
  if (hasBadge) factors.push(`BadgeId: ${badge.slice(0, 10)}…`);

  const base = hasBadge ? 0.55 : 0.15;
  const score = clamp(base, 0.01, 0.99);

  const recommendation = hasBadge
    ? 'Proof badge present; surface it in HUD and attach to run recap artifacts.'
    : 'Run stress test outside chaos windows or adjust thresholds/scenarios to achieve a verified pass.';

  const auditHash = computeHash(
    JSON.stringify({
      runId: input.runId,
      tick: input.tick,
      proofBadge: hasBadge ? badge : null,
      score,
      factors,
      recommendation,
    }) + ':ml:M58',
  );

  const confidenceDecay = clamp(0.16 - score * 0.10, 0.03, 0.16);

  return {
    score,
    topFactors: factors.slice(0, 5),
    recommendation,
    auditHash,
    confidenceDecay,
  };
}