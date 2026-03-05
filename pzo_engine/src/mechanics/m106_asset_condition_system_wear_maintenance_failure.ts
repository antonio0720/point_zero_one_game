// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m106_asset_condition_system_wear_maintenance_failure.ts
//
// Mechanic : M106 — Asset Condition System: Wear, Maintenance, Failure
// Family   : portfolio_experimental   Layer: card_handler   Priority: 2   Batch: 3
// ML Pair  : m106a
// Deps     : M07, M34
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

export interface M106Input {
  assetId?: string;
  conditionState?: Record<string, unknown>;
  maintenanceCost?: number;

  // (Optional) router snapshot extras; safe to read via `(input as any)`
  tick?: number;
  runId?: string;
  seed?: string;
  macroRegime?: MacroRegime;
  runPhase?: RunPhase;
  pressureTier?: PressureTier;
  cash?: number;
  netWorth?: number;
}

export interface M106Output {
  conditionUpdated: AssetCondition;
  failureEvent: AssetFailureEvent | null;
  maintenanceRequired: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M106Event = 'ASSET_WORN' | 'MAINTENANCE_PAID' | 'ASSET_FAILED';

export interface M106TelemetryPayload extends MechanicTelemetryPayload {
  event: M106Event;
  mechanic_id: 'M106';
}

// ── Local Types (kept JSON-safe for replay + ledger verification) ──────────

export type AssetConditionGrade = 'PRISTINE' | 'GOOD' | 'WORN' | 'CRITICAL' | 'FAILED';

export interface AssetCondition {
  assetId: string;
  runId: string;
  tick: number;
  seed: string;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;
  solvencyStatus: SolvencyStatus;

  durability: number; // 0..100
  wearIndex: number; // 0..1
  maintenanceDebt: number; // 0..1 (rises when you skip maintenance)
  lastMaintTick: number; // -1 if never
  grade: AssetConditionGrade;

  chaosActive: boolean;
  exitPulseMultiplier: number;

  recommendedCardId: string;
  auditHash: string;
}

export interface AssetFailureEvent {
  assetId: string;
  runId: string;
  tick: number;

  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  tickTier: TickTier;

  reason: string;
  estimatedDamage: number;
  repairQuote: number; // suggested maintenance spend next tick to recover
  auditHash: string;
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M106_BOUNDS = {
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

// ── Type Touch Anchor (ensures every imported type is referenced in-code) ───

export type M106TypeTouch = {
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

// ── Internal helpers ──────────────────────────────────────────────────────

function toSafeString(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function toSafeNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function resolveRunPhase(tick: number, hint?: unknown): RunPhase {
  const s = typeof hint === 'string' ? hint : '';
  if (s === 'EARLY' || s === 'MID' || s === 'LATE') return s;

  const pct = RUN_TOTAL_TICKS > 0 ? clamp(tick / RUN_TOTAL_TICKS, 0, 0.9999) : 0;
  if (pct < 0.3333) return 'EARLY';
  if (pct < 0.6666) return 'MID';
  return 'LATE';
}

function resolvePressureTier(hint?: unknown): PressureTier {
  const s = typeof hint === 'string' ? hint : '';
  if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH' || s === 'CRITICAL') return s;
  return 'MEDIUM';
}

function resolveMacroRegime(seed: string, tick: number, hint?: unknown): MacroRegime {
  const s = typeof hint === 'string' ? hint : '';
  let regime: MacroRegime = (s === 'BULL' || s === 'NEUTRAL' || s === 'BEAR' || s === 'CRISIS') ? (s as MacroRegime) : 'NEUTRAL';

  const schedule = buildMacroSchedule(seed + ':M106:macro', MACRO_EVENTS_PER_RUN)
    .slice()
    .sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));

  for (const e of schedule) {
    const t = typeof e.tick === 'number' ? e.tick : 0;
    if (t <= tick && e.regimeChange) regime = e.regimeChange;
  }
  return regime;
}

function chaosActive(seed: string, tick: number): boolean {
  const windows = buildChaosWindows(seed + ':M106:chaos', CHAOS_WINDOWS_PER_RUN);
  for (const w of windows) {
    const s = typeof w.startTick === 'number' ? w.startTick : 0;
    const e = typeof w.endTick === 'number' ? w.endTick : 0;
    if (tick >= s && tick <= e) return true;
  }
  return false;
}

function resolveTickTier(pressureTier: PressureTier, chaos: boolean, wearIndex: number): TickTier {
  if (pressureTier === 'CRITICAL' || chaos || wearIndex >= 0.85) return 'CRITICAL';
  if (pressureTier === 'HIGH' || wearIndex >= 0.60) return 'ELEVATED';
  return 'STANDARD';
}

function resolveSolvencyStatus(cash: number, netWorth: number): SolvencyStatus {
  if (cash <= 0 && netWorth <= 0) return 'WIPED';
  if (cash <= M106_BOUNDS.BLEED_CASH_THRESHOLD) return 'BLEED';
  return 'SOLVENT';
}

function normalizeCardId(id: string): string {
  return DEFAULT_CARD_IDS.includes(id) ? id : DEFAULT_CARD.id;
}

function recommendMaintenanceCard(seed: string, tick: number, phaseW: number, pressureW: number, regimeW: number): string {
  const pool = buildWeightedPool(seed + ':M106:pool', pressureW * phaseW, regimeW);
  const basis = pool.length > 0 ? pool : OPPORTUNITY_POOL;
  const shuffled = seededShuffle(basis, seed + ':M106:poolShuffle:' + tick);
  const idx = seededIndex(seed + ':M106:poolPick', tick, shuffled.length);
  const picked = shuffled[idx] ?? DEFAULT_CARD;
  return normalizeCardId(picked.id);
}

function readCondition(inputState: unknown, assetId: string): {
  durability: number;
  wearIndex: number;
  maintenanceDebt: number;
  lastMaintTick: number;
} {
  const base = { durability: 100, wearIndex: 0, maintenanceDebt: 0, lastMaintTick: -1 };

  if (!isRecord(inputState)) return base;

  // Accept either:
  //  A) direct condition object with durability fields
  //  B) map keyed by assetId -> condition object
  const direct = inputState;
  const mapped = isRecord(inputState[assetId]) ? (inputState[assetId] as Record<string, unknown>) : null;

  const src = mapped ?? direct;

  const durability = clamp(toSafeNumber(src.durability, base.durability), 0, 100);
  const wearIndex = clamp(toSafeNumber(src.wearIndex, base.wearIndex), 0, 1);
  const maintenanceDebt = clamp(toSafeNumber(src.maintenanceDebt, base.maintenanceDebt), 0, 1);
  const lastMaintTick = Math.floor(toSafeNumber(src.lastMaintTick, base.lastMaintTick));

  return { durability, wearIndex, maintenanceDebt, lastMaintTick };
}

function gradeFromDurability(d: number): AssetConditionGrade {
  if (d <= 0) return 'FAILED';
  if (d <= 20) return 'CRITICAL';
  if (d <= 50) return 'WORN';
  if (d <= 85) return 'GOOD';
  return 'PRISTINE';
}

function emitM106(
  emit: MechanicEmitter,
  tick: number,
  runId: string,
  event: M106Event,
  payload: Record<string, unknown>,
): void {
  const msg: M106TelemetryPayload = {
    event,
    mechanic_id: 'M106',
    tick,
    runId,
    payload,
  };
  emit(msg);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * assetConditionSystem
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function assetConditionSystem(input: M106Input, emit: MechanicEmitter): M106Output {
  const assetId = String(input.assetId ?? '');
  const tick = clamp(toSafeNumber((input as any).tick, 0), 0, RUN_TOTAL_TICKS);
  const runId = toSafeString((input as any).runId, '');
  const seed = toSafeString((input as any).seed, assetId.length ? `seed:${assetId}` : 'seed:missing');

  const maintenanceCost = clamp(toSafeNumber(input.maintenanceCost, 0), 0, M106_BOUNDS.MAX_AMOUNT);

  const macroRegime = resolveMacroRegime(seed, tick, (input as any).macroRegime);
  const runPhase = resolveRunPhase(tick, (input as any).runPhase);
  const pressureTier = resolvePressureTier((input as any).pressureTier);

  const chaos = chaosActive(seed, tick);
  const exitPulseMultiplier = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;

  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;

  const prev = readCondition(input.conditionState, assetId);

  // Wear increases as you skip maintenance (maintenanceDebt), and under chaos.
  const decay = computeDecayRate(macroRegime, M106_BOUNDS.BASE_DECAY_RATE);
  const baseWear =
    (0.55 + (pressureW - 1) * 0.35 + (phaseW - 1) * 0.20 + (regimeW - 1) * 0.25) *
    (1 + prev.maintenanceDebt * 0.75) *
    (chaos ? 1.35 : 1.0) *
    (1 + decay);

  const wear = clamp(baseWear * (2 - regimeMult) * (exitPulseMultiplier * 0.85), 0.05, 6.5);

  let durabilityAfterWear = clamp(prev.durability - wear, 0, 100);

  // Maintenance effect: spend converts to durability restoration, amplified when regime is worse.
  const repairBase = maintenanceCost > 0 ? clamp((maintenanceCost / M106_BOUNDS.MAX_AMOUNT) * 100, 0, 55) : 0;
  const repair = clamp(repairBase * M106_BOUNDS.EFFECT_MULTIPLIER * (2 - regimeMult), 0, 65);

  const maintPaid = maintenanceCost > 0 && repair > 0;

  let durability = maintPaid ? clamp(durabilityAfterWear + repair, 0, 100) : durabilityAfterWear;

  // Wear index trends upward with wear, downward with maintenance; strictly bounded.
  const wearIndexDelta = clamp((wear / 10) - (maintPaid ? repair / 120 : 0), -0.50, 0.50);
  const wearIndex = clamp(prev.wearIndex + wearIndexDelta, 0, 1);

  // Maintenance debt rises when you skip and wear is meaningful; drops when you pay.
  const debtDelta = clamp((maintPaid ? -0.35 : 0.08) + (wearIndex >= 0.7 ? 0.05 : 0), -0.50, 0.25);
  const maintenanceDebt = clamp(prev.maintenanceDebt + debtDelta, 0, 1);

  const lastMaintTick = maintPaid ? tick : prev.lastMaintTick;

  const tickTier = resolveTickTier(pressureTier, chaos, wearIndex);

  const cash = toSafeNumber((input as any).cash, 0);
  const netWorth = toSafeNumber((input as any).netWorth, 0);
  const solvencyStatus = resolveSolvencyStatus(cash, netWorth);

  const recommendedCardId = recommendMaintenanceCard(seed, tick, phaseW, pressureW, regimeW);

  // Maintenance required threshold tightens under worse regimes / higher wear.
  const maintThreshold = clamp(62 - (1 - regimeMult) * 20 - wearIndex * 18, 15, 80);
  const maintenanceRequired = durability <= maintThreshold || maintenanceDebt >= 0.70 || tickTier === 'CRITICAL';

  // Failure logic: deterministic and bounded.
  const failureTriggered =
    durability <= 0 ||
    (durability <= 5 && (tickTier === 'CRITICAL' || chaos) && maintenanceDebt >= 0.60) ||
    (wearIndex >= 0.98 && !maintPaid && tickTier !== 'STANDARD');

  const auditHash = computeHash(
    JSON.stringify({
      assetId,
      runId,
      tick,
      seed,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      chaos,
      exitPulseMultiplier,
      prev,
      wear,
      repair,
      durabilityAfterWear,
      durability,
      wearIndex,
      maintenanceDebt,
      lastMaintTick,
      maintenanceRequired,
      failureTriggered,
      recommendedCardId,
      decay,
      regimeMult,
      pressureW,
      phaseW,
      regimeW,
    }),
  );

  // Build failure event if needed (bounded amounts).
  const estimatedDamage = clamp(
    (1 - durability / 100) * M106_BOUNDS.MAX_EFFECT * (2 - regimeMult) * (chaos ? 1.15 : 1.0),
    M106_BOUNDS.MIN_EFFECT,
    M106_BOUNDS.MAX_EFFECT,
  );

  const repairQuote = clamp(
    Math.round((maintenanceRequired ? (M106_BOUNDS.MAX_AMOUNT * (1 - durability / 100) * 0.45) : 0) * (2 - regimeMult)),
    0,
    M106_BOUNDS.MAX_AMOUNT,
  );

  const failureEvent: AssetFailureEvent | null = failureTriggered
    ? {
        assetId,
        runId,
        tick,
        macroRegime,
        runPhase,
        pressureTier,
        tickTier,
        reason:
          durability <= 0
            ? 'DURABILITY_ZERO'
            : wearIndex >= 0.98
              ? 'WEAR_INDEX_MAXED'
              : 'CRITICAL_DEGRADATION',
        estimatedDamage,
        repairQuote,
        auditHash: computeHash(auditHash + ':FAIL'),
      }
    : null;

  const conditionUpdated: AssetCondition = {
    assetId,
    runId,
    tick,
    seed,

    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    solvencyStatus,

    durability,
    wearIndex,
    maintenanceDebt,
    lastMaintTick,
    grade: gradeFromDurability(durability),

    chaosActive: chaos,
    exitPulseMultiplier,

    recommendedCardId,
    auditHash,
  };

  // ── Telemetry emission ───────────────────────────────────────────────────

  emitM106(emit, tick, runId, 'ASSET_WORN', {
    assetId,
    wear,
    durabilityBefore: prev.durability,
    durabilityAfter: durabilityAfterWear,
    wearIndexBefore: prev.wearIndex,
    wearIndexAfter: wearIndex,
    maintenanceDebtBefore: prev.maintenanceDebt,
    maintenanceDebtAfter: maintenanceDebt,
    macroRegime,
    runPhase,
    pressureTier,
    tickTier,
    chaosActive: chaos,
    exitPulseMultiplier,
    recommendedCardId,
    auditHash: computeHash(auditHash + ':WORN'),
  });

  if (maintPaid) {
    emitM106(emit, tick, runId, 'MAINTENANCE_PAID', {
      assetId,
      maintenanceCost,
      repair,
      durabilityAfterWear,
      durabilityAfterRepair: durability,
      lastMaintTick,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      recommendedCardId,
      auditHash: computeHash(auditHash + ':MAINT'),
    });
  }

  if (failureEvent) {
    emitM106(emit, tick, runId, 'ASSET_FAILED', {
      assetId,
      reason: failureEvent.reason,
      estimatedDamage: failureEvent.estimatedDamage,
      repairQuote: failureEvent.repairQuote,
      macroRegime,
      runPhase,
      pressureTier,
      tickTier,
      chaosActive: chaos,
      recommendedCardId,
      auditHash: failureEvent.auditHash,
    });

    // Once failed, snap durability to 0 (no partial undead assets).
    conditionUpdated.durability = 0;
    conditionUpdated.grade = 'FAILED';
  }

  return {
    conditionUpdated,
    failureEvent,
    maintenanceRequired,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M106MLInput {
  conditionUpdated?: AssetCondition;
  failureEvent?: AssetFailureEvent | null;
  maintenanceRequired?: boolean;
  runId: string;
  tick: number;
}

export interface M106MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * assetConditionSystemMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function assetConditionSystemMLCompanion(input: M106MLInput): Promise<M106MLOutput> {
  const c = input.conditionUpdated;

  const durability = clamp(toSafeNumber(c?.durability, 100), 0, 100);
  const wearIndex = clamp(toSafeNumber(c?.wearIndex, 0), 0, 1);
  const debt = clamp(toSafeNumber(c?.maintenanceDebt, 0), 0, 1);

  const failed = !!input.failureEvent || c?.grade === 'FAILED' || durability <= 0;
  const required = !!input.maintenanceRequired || debt >= 0.7 || wearIndex >= 0.85;

  const macroRegime: MacroRegime = (c?.macroRegime ?? 'NEUTRAL') as MacroRegime;
  const decay = computeDecayRate(macroRegime, 0.05);

  const riskRaw =
    (1 - durability / 100) * 0.55 +
    wearIndex * 0.25 +
    debt * 0.20 +
    (required ? 0.10 : 0) +
    (failed ? 0.25 : 0);

  const score = clamp(riskRaw, 0.01, 0.99);

  const topFactors: string[] = [];
  if (failed) topFactors.push('Asset failure triggered');
  if (durability <= 20) topFactors.push(`Durability critical (${Math.round(durability)}%)`);
  else if (durability <= 50) topFactors.push(`Durability worn (${Math.round(durability)}%)`);
  if (wearIndex >= 0.7) topFactors.push(`Wear index high (${Math.round(wearIndex * 100)}%)`);
  if (debt >= 0.5) topFactors.push(`Maintenance debt elevated (${Math.round(debt * 100)}%)`);
  if (required && !failed) topFactors.push('Maintenance required flag raised');
  while (topFactors.length > 5) topFactors.pop();

  const recommendation = failed
    ? 'Treat as a forced setback: stabilize cashflow, document the loss, and replace the asset path.'
    : required
      ? 'Pay maintenance now; skipping increases failure risk under current conditions.'
      : 'Condition stable; keep maintenance cadence to avoid debt compounding.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M106:' + (c?.auditHash ?? '')),
    confidenceDecay: decay,
  };
}