// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m56_doctrine_lock.ts
//
// Mechanic : M56 — Doctrine Lock
// Family   : portfolio_advanced   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m56a
// Deps     : M31
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

export const M56_VALUE_IMPORT_COVERAGE = {
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

export type M56_TYPE_IMPORT_COVERAGE = {
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
// Local domain contracts (M56)
// ─────────────────────────────────────────────────────────────────────────────

export type DoctrineId =
  | 'DOCTRINE_CONSERVATIVE'
  | 'DOCTRINE_BALANCED'
  | 'DOCTRINE_AGGRESSIVE'
  | 'DOCTRINE_SPEEDRUN'
  | 'DOCTRINE_DEBTLESS'
  | 'DOCTRINE_HARDCORE';

export type ConstraintKind = 'CAP' | 'FLOOR' | 'BLOCK' | 'REQUIRE' | 'BAND';

export interface PlaystyleConstraint {
  id: string;
  doctrineId: DoctrineId;
  kind: ConstraintKind;
  key: string;
  value: number | boolean | string;

  severity: TickTier; // STANDARD/ELEVATED/CRITICAL
  untilTick: number; // deterministic horizon

  note: string;
  auditHash: string;
}

export interface DoctrineLockState {
  doctrineId: DoctrineId;
  active: boolean;
  selectedAtTick: number;

  runId: string;
  tick: number;

  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  inChaosWindow: boolean;

  policyCard: GameCard;

  decayRate: number;
  exitPulseMultiplier: number;
  regimeMultiplier: number;

  constraints: PlaystyleConstraint[];
  violationCount: number;

  auditHash: string;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M56Input {
  doctrineSelection?: unknown;
  stateAssets?: Asset[];

  // Optional context (safe if snapshotExtractor supplies later)
  tick?: number;
  runId?: string;
  seed?: string;
}

export interface M56Output {
  doctrineActive: boolean;
  playstyleConstraints: PlaystyleConstraint[];
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M56Event = 'DOCTRINE_SELECTED' | 'CONSTRAINTS_APPLIED' | 'DOCTRINE_VIOLATED';

export interface M56TelemetryPayload extends MechanicTelemetryPayload {
  event: M56Event;
  mechanic_id: 'M56';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M56_BOUNDS = {
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
  const nw = clamp(netWorth, -M56_BOUNDS.MAX_PROCEEDS, M56_BOUNDS.MAX_PROCEEDS);
  const count = clamp(assetCount, 0, 99);

  const stress = clamp(
    (count / 12) * 0.45 +
      (nw < 0 ? 0.35 : nw < M56_BOUNDS.BLEED_CASH_THRESHOLD ? 0.20 : 0.05),
    0,
    0.99,
  );

  if (stress < 0.20) return 'LOW';
  if (stress < 0.55) return 'MEDIUM';
  if (stress < 0.80) return 'HIGH';
  return 'CRITICAL';
}

function normalizeDoctrineSelection(sel: unknown, seed: string): DoctrineId {
  const presets: DoctrineId[] = [
    'DOCTRINE_CONSERVATIVE',
    'DOCTRINE_BALANCED',
    'DOCTRINE_AGGRESSIVE',
    'DOCTRINE_SPEEDRUN',
    'DOCTRINE_DEBTLESS',
    'DOCTRINE_HARDCORE',
  ];

  // If string matches preset, accept it
  if (typeof sel === 'string') {
    const s = sel.trim().toUpperCase();
    for (const p of presets) if (p === s) return p;

    // Soft-mapping for common shorthand
    if (s === 'CONSERVATIVE') return 'DOCTRINE_CONSERVATIVE';
    if (s === 'BALANCED') return 'DOCTRINE_BALANCED';
    if (s === 'AGGRESSIVE') return 'DOCTRINE_AGGRESSIVE';
    if (s === 'SPEEDRUN') return 'DOCTRINE_SPEEDRUN';
    if (s === 'DEBTLESS') return 'DOCTRINE_DEBTLESS';
    if (s === 'HARDCORE') return 'DOCTRINE_HARDCORE';
  }

  // If object with id, accept known id
  if (sel && typeof sel === 'object') {
    const id = (sel as { id?: unknown }).id;
    if (typeof id === 'string') return normalizeDoctrineSelection(id, seed);
  }

  // Deterministic fallback: pick from presets by seed
  return presets[seededIndex(seed + ':m56:doctrine', 0, presets.length)] ?? 'DOCTRINE_BALANCED';
}

function deriveSeverity(inChaosWindow: boolean, macroRegime: MacroRegime, pressureTier: PressureTier): TickTier {
  if (inChaosWindow) return 'CRITICAL';
  if (macroRegime === 'CRISIS') return 'CRITICAL';
  if (pressureTier === 'CRITICAL') return 'CRITICAL';
  if (macroRegime === 'BEAR' || pressureTier === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function pickPolicyCard(seed: string, tick: number, pressurePhaseWeight: number, regimeWeight: number): GameCard {
  const weighted = buildWeightedPool(seed + ':m56:pool', pressurePhaseWeight, regimeWeight);
  const pool = weighted.length > 0 ? weighted : OPPORTUNITY_POOL;

  const idx = seededIndex(seed + ':m56:pick', tick, pool.length);
  const picked = pool[idx] ?? DEFAULT_CARD;

  return DEFAULT_CARD_IDS.includes(picked.id) ? picked : DEFAULT_CARD;
}

function buildDoctrineConstraints(args: {
  doctrineId: DoctrineId;
  runId: string;
  tick: number;
  runPhase: RunPhase;
  macroRegime: MacroRegime;
  pressureTier: PressureTier;
  inChaosWindow: boolean;
  netWorth: number;
  assetCount: number;
  policyCardId: string;
  seed: string;

  decayRate: number;
  exitPulseMultiplier: number;
  regimeMultiplier: number;

  pressureWeight: number;
  phaseWeight: number;
  regimeWeight: number;
}): PlaystyleConstraint[] {
  const severity = deriveSeverity(args.inChaosWindow, args.macroRegime, args.pressureTier);

  const strictness =
    (PRESSURE_WEIGHTS[args.pressureTier] ?? 1.0) *
    (PHASE_WEIGHTS[args.runPhase] ?? 1.0) *
    (REGIME_WEIGHTS[args.macroRegime] ?? 1.0) *
    args.regimeMultiplier *
    args.exitPulseMultiplier;

  const strict = clamp(strictness, 0.55, 2.25);

  const horizonBase = clamp(
    args.tick + M56_BOUNDS.PULSE_CYCLE + seededIndex(args.seed + ':m56:h', args.tick, M56_BOUNDS.PULSE_CYCLE + 1),
    args.tick,
    RUN_TOTAL_TICKS,
  );

  const mk = (key: string, kind: ConstraintKind, value: number | boolean | string, note: string, untilTick = horizonBase): PlaystyleConstraint => {
    const auditHash = computeHash(
      JSON.stringify({
        doctrineId: args.doctrineId,
        runId: args.runId,
        tick: args.tick,
        key,
        kind,
        value,
        untilTick,
        severity,
        macroRegime: args.macroRegime,
        runPhase: args.runPhase,
        pressureTier: args.pressureTier,
        inChaosWindow: args.inChaosWindow,
        decayRate: args.decayRate,
        exitPulseMultiplier: args.exitPulseMultiplier,
        regimeMultiplier: args.regimeMultiplier,
        policyCardId: args.policyCardId,
      }),
    );

    return {
      id: computeHash('M56:' + args.runId + ':' + args.tick + ':' + args.doctrineId + ':' + key + ':' + auditHash),
      doctrineId: args.doctrineId,
      kind,
      key,
      value,
      severity,
      untilTick,
      note,
      auditHash,
    };
  };

  // Deterministic caps/floors derived from strictness + current portfolio snapshot
  const baseMaxAssets = clamp(Math.round(12 / strict), 2, 12);
  const baseMinCashflow = clamp(Math.round((M56_BOUNDS.TIER_ESCAPE_TARGET / 3) * strict), 500, 12_000);
  const baseMaxPurchase = clamp(Math.round(M56_BOUNDS.MAX_AMOUNT / strict), 2_000, M56_BOUNDS.MAX_AMOUNT);

  const netWorthFloor = clamp(Math.round(Math.max(0, args.netWorth) * 0.02), 0, 25_000);

  // Doctrine-specific shaping
  switch (args.doctrineId) {
    case 'DOCTRINE_CONSERVATIVE':
      return [
        mk('MAX_ASSET_COUNT', 'CAP', clamp(baseMaxAssets - 2, 2, 10), 'Cap asset count; reduce variance.'),
        mk('MIN_PORTFOLIO_NET_WORTH', 'FLOOR', netWorthFloor, 'Maintain minimum net worth floor.'),
        mk('MAX_SINGLE_PURCHASE', 'CAP', clamp(baseMaxPurchase - 5_000, 1_000, M56_BOUNDS.MAX_AMOUNT), 'Limit purchase size; avoid overreach.'),
        mk('BLOCK_CHAOS_BUYS', 'BLOCK', true, 'No new buys during chaos windows.'),
      ];

    case 'DOCTRINE_BALANCED':
      return [
        mk('MAX_ASSET_COUNT', 'CAP', baseMaxAssets, 'Moderate asset count cap.'),
        mk('MIN_MONTHLY_CASHFLOW', 'FLOOR', baseMinCashflow, 'Maintain a baseline cashflow floor.'),
        mk('MAX_SINGLE_PURCHASE', 'CAP', baseMaxPurchase, 'Cap single purchase size; keep optionality.'),
      ];

    case 'DOCTRINE_AGGRESSIVE':
      return [
        mk('MAX_ASSET_COUNT', 'CAP', clamp(baseMaxAssets + 3, 4, 16), 'Higher asset cap; expansion doctrine.'),
        mk('MIN_MONTHLY_CASHFLOW', 'FLOOR', clamp(Math.round(baseMinCashflow * 0.75), 250, 10_000), 'Lower cashflow floor; accept volatility.'),
        mk('MAX_SINGLE_PURCHASE', 'CAP', clamp(Math.round(baseMaxPurchase * 1.25), 5_000, M56_BOUNDS.MAX_AMOUNT), 'Higher purchase cap; seize timing.'),
      ];

    case 'DOCTRINE_SPEEDRUN': {
      const until = clamp(args.tick + Math.round(M56_BOUNDS.PULSE_CYCLE / 2), args.tick, RUN_TOTAL_TICKS);
      return [
        mk('REQUIRE_FAST_ACTIONS', 'REQUIRE', true, 'Timer discipline: prioritize speed.'),
        mk('MAX_ASSET_COUNT', 'CAP', clamp(baseMaxAssets + 1, 3, 14), 'Cap sprawl; keep execution fast.', until),
        mk('MAX_SINGLE_PURCHASE', 'CAP', clamp(baseMaxPurchase + 2_000, 2_000, M56_BOUNDS.MAX_AMOUNT), 'Keep buys decisive, not bloated.', until),
      ];
    }

    case 'DOCTRINE_DEBTLESS':
      return [
        mk('BLOCK_NEW_DEBT', 'BLOCK', true, 'No new debt actions while doctrine is active.'),
        mk('MAX_SINGLE_PURCHASE', 'CAP', clamp(baseMaxPurchase - 2_000, 1_000, M56_BOUNDS.MAX_AMOUNT), 'Constrain purchase size under debtless constraint.'),
        mk('MIN_MONTHLY_CASHFLOW', 'FLOOR', clamp(baseMinCashflow + 750, 750, 15_000), 'Cashflow floor required without leverage.'),
      ];

    case 'DOCTRINE_HARDCORE':
      return [
        mk('MAX_ASSET_COUNT', 'CAP', clamp(baseMaxAssets - 1, 2, 10), 'Tight cap; mistakes amplify.'),
        mk('MIN_MONTHLY_CASHFLOW', 'FLOOR', clamp(baseMinCashflow + 2_000, 1_000, 20_000), 'Higher cashflow floor; discipline enforced.'),
        mk('BLOCK_CHAOS_BUYS', 'BLOCK', true, 'No buys during chaos windows.'),
        mk('REQUIRE_PROOF_LOG', 'REQUIRE', true, 'Every major action requires proof logging (server-verified).'),
      ];

    default:
      return [
        mk('MAX_ASSET_COUNT', 'CAP', baseMaxAssets, 'Default cap.'),
        mk('MAX_SINGLE_PURCHASE', 'CAP', baseMaxPurchase, 'Default purchase cap.'),
      ];
  }
}

function evaluateViolations(constraints: PlaystyleConstraint[], assets: Asset[], tick: number): { violations: string[]; count: number } {
  const violations: string[] = [];
  const active = constraints.filter(c => tick <= c.untilTick);

  const assetCount = assets.length;

  for (const c of active) {
    if (c.kind === 'CAP' && c.key === 'MAX_ASSET_COUNT' && typeof c.value === 'number') {
      if (assetCount > c.value) violations.push(`ASSET_COUNT>${c.value}`);
    }
  }

  return { violations, count: violations.length };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * doctrineSelectEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function doctrineSelectEngine(input: M56Input, emit: MechanicEmitter): M56Output {
  const runId =
    (typeof input.runId === 'string' && input.runId.length > 0 ? input.runId : computeHash(JSON.stringify(input))) ??
    computeHash('m56:fallback');

  const seed =
    (typeof input.seed === 'string' && input.seed.length > 0 ? input.seed : computeHash(runId + ':m56:seed')) ??
    computeHash('m56:seed:fallback');

  const tick = clamp(
    (input.tick as number) ?? seededIndex(seed + ':m56:tick', 0, RUN_TOTAL_TICKS),
    0,
    Math.max(0, RUN_TOTAL_TICKS - 1),
  );

  const doctrineId = normalizeDoctrineSelection(input.doctrineSelection, seed);
  const doctrineActive = !!doctrineId;

  const assetsRaw = Array.isArray(input.stateAssets) ? input.stateAssets : [];
  const stateAssets = assetsRaw.filter(a => !!a && typeof a.id === 'string');

  const netWorth = clamp(
    stateAssets.reduce((sum, a) => sum + (typeof a.value === 'number' ? a.value : 0), 0),
    -M56_BOUNDS.MAX_PROCEEDS,
    M56_BOUNDS.MAX_PROCEEDS,
  );

  // Deterministic schedules / context (forces usage of macro/chaos builders)
  const macroSchedule = buildMacroSchedule(seed + ':m56:macro', MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed + ':m56:chaos', CHAOS_WINDOWS_PER_RUN);

  const macroRegime = deriveMacroRegime(tick, macroSchedule);
  const inChaosWindow = isTickInChaosWindow(tick, chaosWindows);
  const runPhase = deriveRunPhase(tick);
  const pressureTier = derivePressureTierFromPortfolio(netWorth, stateAssets.length);

  const decayRate = computeDecayRate(macroRegime, M56_BOUNDS.BASE_DECAY_RATE);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const regimeMultiplier = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  // Weights for pool selection (forces usage of weight tables/constants)
  const pressureWeight = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseWeight = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const policyCard = pickPolicyCard(seed, tick, pressureWeight * phaseWeight, regimeWeight);

  // Deterministic ordering of assets for audit trace (seededShuffle usage)
  const orderedAssetIds = seededShuffle(
    stateAssets.map(a => a.id),
    seed + ':m56:assets',
  );

  const constraints = doctrineActive
    ? buildDoctrineConstraints({
        doctrineId,
        runId,
        tick,
        runPhase,
        macroRegime,
        pressureTier,
        inChaosWindow,
        netWorth,
        assetCount: stateAssets.length,
        policyCardId: policyCard.id,
        seed,
        decayRate,
        exitPulseMultiplier,
        regimeMultiplier,
        pressureWeight,
        phaseWeight,
        regimeWeight,
      })
    : [];

  const violations = evaluateViolations(constraints, stateAssets, tick);

  const auditHash = computeHash(
    JSON.stringify({
      doctrineId,
      doctrineActive,
      runId,
      tick,
      runPhase,
      macroRegime,
      pressureTier,
      inChaosWindow,
      netWorth,
      assetCount: stateAssets.length,
      orderedAssetIdsHead: orderedAssetIds.slice(0, 6),
      policyCardId: policyCard.id,
      decayRate,
      exitPulseMultiplier,
      regimeMultiplier,
      constraints,
      violations,
    }),
  );

  // Telemetry
  emit({
    event: 'DOCTRINE_SELECTED',
    mechanic_id: 'M56',
    tick,
    runId,
    payload: {
      doctrineId,
      doctrineActive,
      macroRegime,
      runPhase,
      pressureTier,
      inChaosWindow,
      netWorth,
      assetCount: stateAssets.length,
      policyCardId: policyCard.id,
      auditHash,
    },
  });

  emit({
    event: 'CONSTRAINTS_APPLIED',
    mechanic_id: 'M56',
    tick,
    runId,
    payload: {
      doctrineId,
      constraintCount: constraints.length,
      constraints,
      decayRate,
      exitPulseMultiplier,
      regimeMultiplier,
      auditHash,
    },
  });

  if (violations.count > 0) {
    emit({
      event: 'DOCTRINE_VIOLATED',
      mechanic_id: 'M56',
      tick,
      runId,
      payload: {
        doctrineId,
        violationCount: violations.count,
        violations: violations.violations,
        auditHash,
      },
    });
  }

  // (DoctrineLockState exists for downstream integration if you want to persist it;
  //  keeping it computed-but-unused here avoids mutation and preserves determinism.)
  const _doctrineLockState: DoctrineLockState = {
    doctrineId,
    active: doctrineActive,
    selectedAtTick: tick,
    runId,
    tick,
    runPhase,
    macroRegime,
    pressureTier,
    inChaosWindow,
    policyCard,
    decayRate,
    exitPulseMultiplier,
    regimeMultiplier,
    constraints,
    violationCount: violations.count,
    auditHash,
  };

  return {
    doctrineActive,
    playstyleConstraints: constraints,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M56MLInput {
  doctrineActive?: boolean;
  playstyleConstraints?: PlaystyleConstraint[];
  runId: string;
  tick: number;
}

export interface M56MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion) (here: computeHash deterministic)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * doctrineSelectEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function doctrineSelectEngineMLCompanion(input: M56MLInput): Promise<M56MLOutput> {
  const active = !!input.doctrineActive;
  const c = Array.isArray(input.playstyleConstraints) ? input.playstyleConstraints : [];

  const factors: string[] = [];
  factors.push(active ? 'Doctrine active' : 'No doctrine selected');
  factors.push(`Constraints: ${c.length}`);
  if (c.some(x => x.severity === 'CRITICAL')) factors.push('Critical constraints present');
  if (c.some(x => x.kind === 'BLOCK')) factors.push('Block constraints present');

  const base = active ? 0.35 : 0.10;
  const constraintBoost = clamp(c.length * 0.06, 0, 0.30);
  const criticalPenalty = c.some(x => x.severity === 'CRITICAL') ? 0.10 : 0.0;

  const score = clamp(base + constraintBoost - criticalPenalty, 0.01, 0.99);

  const recommendation =
    !active
      ? 'Select a doctrine to lock playstyle constraints and stabilize decision-making.'
      : c.some(x => x.kind === 'BLOCK')
        ? 'Doctrine includes blocks; align upcoming actions to constraints to avoid violations.'
        : 'Doctrine active; enforce caps/floors consistently and log proof for major actions.';

  const auditHash = computeHash(
    JSON.stringify({
      runId: input.runId,
      tick: input.tick,
      doctrineActive: input.doctrineActive ?? null,
      constraintCount: c.length,
      score,
      factors,
      recommendation,
    }) + ':ml:M56',
  );

  // Use score as decay proxy: higher confidence => slower decay (bounded)
  const confidenceDecay = clamp(0.18 - score * 0.12, 0.03, 0.18);

  return {
    score,
    topFactors: factors.slice(0, 5),
    recommendation,
    auditHash,
    confidenceDecay,
  };
}