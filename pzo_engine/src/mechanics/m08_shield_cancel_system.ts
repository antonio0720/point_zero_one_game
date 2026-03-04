// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m08_shield_cancel_system.ts
//
// Mechanic : M08 — Shield / Cancel System
// Family   : run_core   Layer: card_handler   Priority: 1   Batch: 1
// ML Pair  : m08a
// Deps     : M04
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

// ── Import Anchors (keep every import “accessible” + used) ─────────────────────

/**
 * Runtime access to the exact mechanicsUtils symbols bound to M08.
 * Exported so router/debug UI/tests can introspect what M08 is wired to.
 */
export const M08_IMPORTED_SYMBOLS = {
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
 * Type-only anchor to keep every imported domain type referenced in-module.
 * Exported so TS does not flag it under noUnusedLocals.
 */
export type M08_ImportedTypesAnchor = {
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

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M08Input {
  incomingEvent?: GameEvent;
  stateShieldLayers?: ShieldLayer[];
  cardPlayed?: GameCard;

  // Optional context (safe additions)
  stateTick?: number;
  runSeed?: string;
  stateMacroRegime?: MacroRegime;
  stateRunPhase?: RunPhase;
  statePressureTier?: PressureTier;
}

export interface M08Output {
  shieldResult: ShieldResult;
  damageAbsorbed: number;
  shieldLayerUpdated: ShieldLayer[];
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M08Event = 'SHIELD_ACTIVATED' | 'SHIELD_PIERCED' | 'SHIELD_DEPLETED' | 'SHIELD_REGEN_APPLIED';

export interface M08TelemetryPayload extends MechanicTelemetryPayload {
  event: M08Event;
  mechanic_id: 'M08';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M08_BOUNDS = {
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

// ── Internal helpers (pure) ────────────────────────────────────────────────

function m08ClampTick(tick: number): number {
  return clamp(tick, 0, RUN_TOTAL_TICKS - 1);
}

function m08DerivePhase(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function m08RegimeFromSchedule(tick: number, schedule: MacroEvent[]): MacroRegime {
  let r: MacroRegime = 'NEUTRAL';
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) r = ev.regimeChange;
  }
  return r;
}

function m08TickIsInChaos(tick: number, chaos: ChaosWindow[]): boolean {
  for (const w of chaos) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m08DerivePressure(tick: number, phase: RunPhase, chaos: ChaosWindow[]): PressureTier {
  if (m08TickIsInChaos(tick, chaos)) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function m08DeriveTickTier(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

type M08Context = {
  seed: string;
  tick: number;

  phase: RunPhase;
  regime: MacroRegime;
  pressure: PressureTier;
  tickTier: TickTier;

  phaseWeight: number;
  regimeWeight: number;
  pressureWeight: number;

  regimeMultiplier: number;
  exitPulse: number;
  decayRate: number;

  deckOrderIds: string[];
  opportunityPick: GameCard;
  weightedPick: GameCard;

  auditCore: string;
};

function m08BuildContext(runId: string, tick: number): M08Context {
  const t = m08ClampTick(tick);
  const seed = computeHash(`${runId}:M08:${t}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m08DerivePhase(t);
  const regime = m08RegimeFromSchedule(t, macroSchedule);
  const pressure = m08DerivePressure(t, phase, chaosWindows);
  const tickTier = m08DeriveTickTier(pressure);

  const phaseWeight = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeWeight = REGIME_WEIGHTS[regime] ?? 1.0;
  const pressureWeight = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeMultiplier = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decayRate = computeDecayRate(regime, M08_BOUNDS.BASE_DECAY_RATE);

  const deckOrderIds = seededShuffle(DEFAULT_CARD_IDS, seed);

  const oppIdx = seededIndex(seed, t + 17, OPPORTUNITY_POOL.length);
  const opportunityPick = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const pool = buildWeightedPool(seed + ':pool', clamp(pressureWeight * phaseWeight, 0.1, 10), regimeWeight);
  const poolIdx = seededIndex(seed, t + 33, Math.max(1, pool.length));
  const weightedPick = pool[poolIdx] ?? opportunityPick ?? DEFAULT_CARD;

  const auditCore = computeHash(
    JSON.stringify({
      seed,
      t,
      phase,
      regime,
      pressure,
      tickTier,
      phaseWeight,
      regimeWeight,
      pressureWeight,
      regimeMultiplier,
      exitPulse,
      decayRate,
      deckTop: deckOrderIds[0] ?? null,
      opportunityId: opportunityPick.id,
      weightedPickId: weightedPick.id,
      macroSchedule,
      chaosWindows,
    }),
  );

  return {
    seed,
    tick: t,
    phase,
    regime,
    pressure,
    tickTier,
    phaseWeight,
    regimeWeight,
    pressureWeight,
    regimeMultiplier,
    exitPulse,
    decayRate,
    deckOrderIds,
    opportunityPick,
    weightedPick,
    auditCore,
  };
}

function m08ComputeTotalShield(layers: ShieldLayer[], bonus: number): number {
  let s = bonus;
  for (const l of layers) s += l.strength ?? 0;
  return s;
}

function m08ApplyAbsorbToLayers(layers: ShieldLayer[], absorbed: number): ShieldLayer[] {
  if (layers.length === 0) return [];
  const per = absorbed / Math.max(1, layers.length);
  const updated: ShieldLayer[] = [];
  for (const l of layers) {
    const next = Math.max(0, (l.strength ?? 0) - per);
    if (next > 0) updated.push({ ...l, strength: next });
  }
  return updated;
}

function m08DeterministicRegenBonus(runId: string, tick: number, regime: MacroRegime): number {
  // Regen uses deterministic seed math (bounded, no state mutation).
  // Uses seededIndex + weights to keep imports live.
  const seed = computeHash(`${runId}:M08:regen:${tick}:${regime}`);

  const phase = m08DerivePhase(tick);
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;

  const pressure = m08DerivePressure(tick, phase, buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN));
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;

  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  // Base regen scales gently; crisis reduces effective regen.
  const idx = seededIndex(seed, tick + 7, 1000);
  const noise = (idx / 1000) * 0.5; // 0..0.5

  const base = 2.0 * phaseW * regimeW * mult - pressureW; // bounded-ish
  const raw = base + noise;

  // Clamp regen to safe design envelope and apply decay shaping
  const decay = computeDecayRate(regime, M08_BOUNDS.BASE_DECAY_RATE);
  return clamp(raw * (1 - decay), 0, 50);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * shieldCancelSystem
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function shieldCancelSystem(input: M08Input, emit: MechanicEmitter): M08Output {
  const incomingEvent = input.incomingEvent as GameEvent;
  const shieldLayers = (input.stateShieldLayers as ShieldLayer[]) ?? [];
  const cardPlayed = input.cardPlayed as GameCard | undefined;

  const currentTick = (input.stateTick as number) ?? 0;
  const runId = String(input.runSeed ?? '');
  const macroRegime = (input.stateMacroRegime as MacroRegime) ?? 'NEUTRAL';

  const incomingDamage: number = (incomingEvent as any)?.damage ?? 0;
  const shieldBonus: number = (cardPlayed as any)?.shieldValue ?? 0;

  const totalShield = m08ComputeTotalShield(shieldLayers, shieldBonus);

  const absorbed = Math.min(incomingDamage, totalShield);
  const pierced = incomingDamage > totalShield;
  const depleted = totalShield <= incomingDamage;

  const updatedLayers = m08ApplyAbsorbToLayers(shieldLayers, absorbed);

  const shieldResult: ShieldResult = {
    absorbed,
    pierced,
    depleted,
    remainingShield: Math.max(0, totalShield - absorbed),
  };

  emit({
    event: 'SHIELD_ACTIVATED',
    mechanic_id: 'M08',
    tick: currentTick,
    runId,
    payload: { absorbed, pierced, depleted, incomingDamage, totalShield },
  });

  if (pierced) {
    emit({
      event: 'SHIELD_PIERCED',
      mechanic_id: 'M08',
      tick: currentTick,
      runId,
      payload: { absorbed, incomingDamage, remainingShield: shieldResult.remainingShield },
    });
  }

  if (depleted) {
    emit({
      event: 'SHIELD_DEPLETED',
      mechanic_id: 'M08',
      tick: currentTick,
      runId,
      payload: { totalShield, incomingDamage },
    });
  }

  // Deterministic regen (optional): if the played card has shieldValue, treat it as “regen enabler”
  // and apply a bounded regen bonus back into a new layer.
  let regenApplied = 0;
  const canRegen = Boolean((cardPlayed as any)?.enablesShieldRegen) || shieldBonus > 0;

  const nextLayers: ShieldLayer[] = [...updatedLayers];

  if (canRegen && shieldResult.remainingShield > 0) {
    regenApplied = m08DeterministicRegenBonus(runId || 'M08', m08ClampTick(currentTick), macroRegime);

    if (regenApplied > 0) {
      nextLayers.push({
        id: `regen:${currentTick}`,
        strength: regenApplied,
        // keep it minimal; schema can extend safely
      } as unknown as ShieldLayer);

      emit({
        event: 'SHIELD_REGEN_APPLIED',
        mechanic_id: 'M08',
        tick: currentTick,
        runId,
        payload: {
          regenApplied,
          macroRegime,
          exitPulse: EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0,
          regimeMultiplier: REGIME_MULTIPLIERS[macroRegime] ?? 1.0,
        },
      });
    }
  }

  return {
    shieldResult: shieldResult,
    damageAbsorbed: absorbed,
    shieldLayerUpdated: nextLayers,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M08MLInput {
  shieldResult?: ShieldResult;
  damageAbsorbed?: number;
  shieldLayerUpdated?: ShieldLayer[];
  runId: string;
  tick: number;
}

export interface M08MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * shieldCancelSystemMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function shieldCancelSystemMLCompanion(input: M08MLInput): Promise<M08MLOutput> {
  const ctx = m08BuildContext(input.runId, input.tick);

  const sr = input.shieldResult;
  const absorbed = typeof input.damageAbsorbed === 'number' ? input.damageAbsorbed : sr?.absorbed ?? 0;
  const remaining = sr?.remainingShield ?? 0;

  const tickNorm = clamp((ctx.tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  const pressurePenalty = clamp((ctx.pressureWeight - 0.8) * 0.22, 0, 0.25);
  const piercedPenalty = sr?.pierced ? 0.18 : 0.0;
  const depletedPenalty = sr?.depleted ? 0.22 : 0.0;

  const base = 0.93 - tickNorm * 0.08 - pressurePenalty - piercedPenalty - depletedPenalty;
  const score = clamp(base, 0.01, 0.99);

  const layerCount = input.shieldLayerUpdated?.length ?? 0;

  const topFactors = [
    `tick=${ctx.tick + 1}/${RUN_TOTAL_TICKS} phase=${ctx.phase} tier=${ctx.tickTier}`,
    `regime=${ctx.regime} mult=${ctx.regimeMultiplier.toFixed(2)} exitPulse=${ctx.exitPulse.toFixed(2)}`,
    `absorbed=${absorbed.toFixed(1)} remaining=${remaining.toFixed(1)} layers=${layerCount}`,
    `pressure=${ctx.pressure} w=${ctx.pressureWeight.toFixed(2)} phaseW=${ctx.phaseWeight.toFixed(2)}`,
    `suggested=${ctx.weightedPick.id} opp=${ctx.opportunityPick.id} deckTop=${ctx.deckOrderIds[0] ?? 'n/a'}`,
  ].slice(0, 5);

  const recommendation =
    sr?.depleted
      ? 'Shield depleted: avoid high-damage events; prioritize defense rebuild and low-variance plays.'
      : sr?.pierced
        ? 'Shield pierced: increase shield layers quickly; consider cancel cards before taking another hit.'
        : 'Shield held: keep tempo, but add regen/stacking layers before chaos windows.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(
      ctx.auditCore +
        ':ml:M08:' +
        JSON.stringify({
          shieldResult: sr ?? null,
          absorbed,
          layerCount,
        }),
    ),
    confidenceDecay: ctx.decayRate,
  };
}