// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m84_catalyst_slots_cross_set_bridges_without_degeneracy.ts
//
// Mechanic : M84 — Catalyst Slots: Cross-Set Bridges Without Degeneracy
// Family   : portfolio_expert   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m84a
// Deps     : M31, M59
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
export const M84_IMPORTED_SYMBOLS = {
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
export type M84_ImportedTypesAnchor = {
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

export type CatalystEffectKind =
  | 'SET_BRIDGE'
  | 'SYNERGY_AMPLIFY'
  | 'CHAIN_REPAIR'
  | 'RISK_SMOOTH'
  | 'PROOF_MULTIPLY'
  | 'CUSTOM';

export interface CatalystEffect {
  kind: CatalystEffectKind;
  magnitude: number; // bounded numeric effect
  description: string;
  auditHash: string;
}

export interface DegeneracyGuardConfig {
  maxUsesPerRun?: number;
  minUniqueSetCount?: number;
  minUniqueCardKinds?: number;
  cooldownTicks?: number;
  chaosPenaltyPct?: number; // 0..1
  strictMode?: boolean;
}

export interface CatalystResolution {
  catalystEffect: CatalystEffect;
  bridgeActivated: boolean;
  degeneracyGuardPassed: boolean;

  // context
  tick: number;
  phase: RunPhase;
  regime: MacroRegime;
  pressureTier: PressureTier;
  inChaos: boolean;

  // deterministic audit
  seed: string;
  auditHash: string;

  // guard diagnostics
  usesBudget: number;
  cooldownOk: boolean;
  diversityOk: boolean;
  effectScore: number;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M84Input {
  catalystCard?: GameCard;
  activeSynergySets?: boolean;
  degeneracyGuardConfig?: Record<string, unknown>;

  // optional context
  tick?: number;
  runId?: string;
  pressureTier?: PressureTier;

  // optional anti-degeneracy signals from upstream
  catalystUsesThisRun?: number; // how many catalyst slots already used this run
  lastCatalystTick?: number; // last time catalyst was used
  uniqueSynergySetCount?: number; // number of distinct synergy sets active
  uniqueCardKindCount?: number; // number of distinct card kinds in the current combo state
}

export interface M84Output {
  catalystEffect: CatalystEffect;
  bridgeActivated: boolean;
  degeneracyGuardPassed: boolean;
  resolution?: CatalystResolution;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M84Event = 'CATALYST_SLOTTED' | 'BRIDGE_ACTIVATED' | 'DEGENERACY_BLOCKED';

export interface M84TelemetryPayload extends MechanicTelemetryPayload {
  event: M84Event;
  mechanic_id: 'M84';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M84_BOUNDS = {
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

function m84DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m84DeriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const sorted = [...(schedule ?? [])].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m84InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m84DerivePressureTier(proxy: number, inChaos: boolean): PressureTier {
  if (inChaos) return proxy >= 6 ? 'CRITICAL' : 'HIGH';
  if (proxy <= 2) return 'LOW';
  if (proxy <= 5) return 'MEDIUM';
  if (proxy <= 8) return 'HIGH';
  return 'CRITICAL';
}

function m84CardKind(card?: GameCard): string {
  const c = (card ?? {}) as unknown as Record<string, unknown>;
  const kind = (c.kind ?? c.type ?? c.category ?? c.cardType) as unknown;
  return String(kind ?? 'UNKNOWN').toUpperCase();
}

function m84NormalizeGuard(raw?: Record<string, unknown>): Required<DegeneracyGuardConfig> {
  const r = raw ?? {};

  const maxUsesPerRun = clamp(Math.floor(Number(r.maxUsesPerRun ?? 2)), 0, 10);
  const minUniqueSetCount = clamp(Math.floor(Number(r.minUniqueSetCount ?? 2)), 0, 10);
  const minUniqueCardKinds = clamp(Math.floor(Number(r.minUniqueCardKinds ?? 2)), 0, 10);
  const cooldownTicks = clamp(Math.floor(Number(r.cooldownTicks ?? 6)), 0, RUN_TOTAL_TICKS);
  const chaosPenaltyPct = clamp(Number(r.chaosPenaltyPct ?? 0.25), 0, 0.9);
  const strictMode = Boolean(r.strictMode ?? false);

  return {
    maxUsesPerRun,
    minUniqueSetCount,
    minUniqueCardKinds,
    cooldownTicks,
    chaosPenaltyPct,
    strictMode,
  };
}

function m84ComputeGuardPass(
  cfg: Required<DegeneracyGuardConfig>,
  tick: number,
  inChaos: boolean,
  usesThisRun: number,
  lastTick: number,
  uniqueSetCount: number,
  uniqueKindCount: number,
): { passed: boolean; usesBudget: number; cooldownOk: boolean; diversityOk: boolean } {
  const usesBudget = Math.max(0, cfg.maxUsesPerRun - usesThisRun);

  const cooldownOk = cfg.cooldownTicks <= 0 ? true : (tick - lastTick) >= cfg.cooldownTicks;

  const diversityOk =
    uniqueSetCount >= cfg.minUniqueSetCount &&
    uniqueKindCount >= cfg.minUniqueCardKinds;

  // In chaos: tighten policy (penalize degeneracy attempts)
  const chaosOk = !inChaos || (usesThisRun === 0 ? true : (usesThisRun / Math.max(1, cfg.maxUsesPerRun)) < (1 - cfg.chaosPenaltyPct));

  const passed = cfg.strictMode
    ? usesBudget > 0 && cooldownOk && diversityOk && chaosOk
    : usesBudget > 0 && cooldownOk && (diversityOk || chaosOk);

  return { passed, usesBudget, cooldownOk, diversityOk };
}

function m84PickEffectKind(seed: string, tick: number, cardKind: string, activeSynergySets: boolean): CatalystEffectKind {
  // Use DEFAULT_CARD_IDS + opportunity pool as stable entropy anchors
  const deck = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deck:${tick}`);
  const deckTop = deck[0] ?? DEFAULT_CARD.id;
  const opp = OPPORTUNITY_POOL[seededIndex(seed, tick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const h = computeHash(`${seed}:${tick}:${deckTop}:${opp.id ?? opp.name ?? 'opp'}:${cardKind}:${activeSynergySets}`);
  const idx = seededIndex(h, tick + 3, 5); // 0..4 maps to 5 kinds + CUSTOM fallback
  const map: CatalystEffectKind[] = ['SET_BRIDGE', 'SYNERGY_AMPLIFY', 'CHAIN_REPAIR', 'RISK_SMOOTH', 'PROOF_MULTIPLY'];
  return map[idx] ?? 'CUSTOM';
}

function m84ComputeMagnitude(
  kind: CatalystEffectKind,
  seed: string,
  tick: number,
  phase: RunPhase,
  pressureTier: PressureTier,
  regime: MacroRegime,
  inChaos: boolean,
  activeSynergySets: boolean,
): number {
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M84_BOUNDS.BASE_DECAY_RATE);

  const base = {
    SET_BRIDGE: 1.2,
    SYNERGY_AMPLIFY: 1.6,
    CHAIN_REPAIR: 1.35,
    RISK_SMOOTH: 1.25,
    PROOF_MULTIPLY: 1.45,
    CUSTOM: 1.0,
  }[kind];

  const chaosAdj = inChaos ? (1 - clamp(decay, 0, 0.5)) : 1;
  const synergyAdj = activeSynergySets ? 1.15 : 1.0;

  // deterministic small jitter from seed
  const jitter = 0.9 + seededIndex(seed, tick + 99, 21) * 0.01; // 0.90..1.10

  const raw =
    base *
    synergyAdj *
    chaosAdj *
    clamp(pressureW * phaseW * regimeW, 0.75, 4.0) *
    clamp(regimeMul * exitPulse, 0.75, 5.0) *
    jitter;

  // magnitude is bounded to keep balance (1..10)
  return clamp(Number(raw.toFixed(4)), 1, 10);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * catalystSlotBridge
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function catalystSlotBridge(input: M84Input, emit: MechanicEmitter): M84Output {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? computeHash(JSON.stringify(input)));

  const activeSynergySets = Boolean(input.activeSynergySets ?? false);
  const catalystCard = input.catalystCard;
  const cardKind = m84CardKind(catalystCard);

  const cfg = m84NormalizeGuard(input.degeneracyGuardConfig);

  const usesThisRun = clamp(Math.floor(Number(input.catalystUsesThisRun ?? 0)), 0, 999);
  const lastCatalystTick = clamp(Math.floor(Number(input.lastCatalystTick ?? -999_999)), -999_999, RUN_TOTAL_TICKS);
  const uniqueSetCount = clamp(Math.floor(Number(input.uniqueSynergySetCount ?? (activeSynergySets ? 2 : 0))), 0, 99);
  const uniqueKindCount = clamp(Math.floor(Number(input.uniqueCardKindCount ?? (cardKind === 'UNKNOWN' ? 1 : 2))), 0, 99);

  // Deterministic seed
  const seed = computeHash(
    JSON.stringify({
      m: 'M84',
      tick,
      runId,
      activeSynergySets,
      cardKind,
      usesThisRun,
      lastCatalystTick,
      uniqueSetCount,
      uniqueKindCount,
      cfg,
      // include coarse catalyst signature
      cardSig: catalystCard ? computeHash(String((catalystCard as any)?.id ?? (catalystCard as any)?.name ?? 'CARD')).slice(0, 12) : 'NONE',
    }),
  );

  // Context (bounded chaos)
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m84DerivePhase(tick);
  const regime = m84DeriveRegime(tick, macroSchedule);
  const inChaos = m84InChaosWindow(tick, chaosWindows);

  const proxy = clamp(uniqueSetCount + uniqueKindCount, 1, 12);
  const pressureTier = (input.pressureTier as PressureTier) ?? m84DerivePressureTier(proxy, inChaos);

  // Degeneracy guard
  const guard = m84ComputeGuardPass(cfg, tick, inChaos, usesThisRun, lastCatalystTick, uniqueSetCount, uniqueKindCount);
  const degeneracyGuardPassed = guard.passed;

  emit({
    event: 'CATALYST_SLOTTED',
    mechanic_id: 'M84',
    tick,
    runId,
    payload: {
      activeSynergySets,
      cardKind,
      usesThisRun,
      uniqueSetCount,
      uniqueKindCount,
      cfg,
      guard,
    },
  });

  if (!degeneracyGuardPassed) {
    const blockedEffect: CatalystEffect = {
      kind: 'CUSTOM',
      magnitude: 0,
      description: 'Degeneracy guard blocked catalyst activation.',
      auditHash: computeHash(`${seed}:blocked`),
    };

    emit({
      event: 'DEGENERACY_BLOCKED',
      mechanic_id: 'M84',
      tick,
      runId,
      payload: {
        reason: 'GUARD_FAILED',
        guard,
        cardKind,
      },
    });

    const auditHash = computeHash(
      JSON.stringify({
        m: 'M84',
        tick,
        runId,
        activeSynergySets,
        cardKind,
        degeneracyGuardPassed,
        guard,
        seed,
      }),
    );

    const resolution: CatalystResolution = {
      catalystEffect: blockedEffect,
      bridgeActivated: false,
      degeneracyGuardPassed: false,
      tick,
      phase,
      regime,
      pressureTier,
      inChaos,
      seed,
      auditHash,
      usesBudget: guard.usesBudget,
      cooldownOk: guard.cooldownOk,
      diversityOk: guard.diversityOk,
      effectScore: 0,
    };

    return {
      catalystEffect: blockedEffect,
      bridgeActivated: false,
      degeneracyGuardPassed: false,
      resolution,
    };
  }

  // Effect computation
  const effectKind = m84PickEffectKind(seed, tick, cardKind, activeSynergySets);
  const magnitude = m84ComputeMagnitude(effectKind, seed, tick, phase, pressureTier, regime, inChaos, activeSynergySets);

  const effectDesc =
    effectKind === 'SET_BRIDGE'
      ? 'Catalyst created a bridge between synergy sets (cross-set activation).'
      : effectKind === 'SYNERGY_AMPLIFY'
        ? 'Catalyst amplified current synergy set effects without degeneracy.'
        : effectKind === 'CHAIN_REPAIR'
          ? 'Catalyst repaired timing chain integrity to preserve combo potential.'
          : effectKind === 'RISK_SMOOTH'
            ? 'Catalyst smoothed portfolio risk spikes under heat.'
            : effectKind === 'PROOF_MULTIPLY'
              ? 'Catalyst increased proof yield and portability across sets.'
              : 'Catalyst applied a custom bridge effect.';

  const catalystEffect: CatalystEffect = {
    kind: effectKind,
    magnitude,
    description: effectDesc,
    auditHash: computeHash(`${seed}:${effectKind}:${magnitude}`),
  };

  const bridgeActivated = activeSynergySets && magnitude >= 2;

  emit({
    event: 'BRIDGE_ACTIVATED',
    mechanic_id: 'M84',
    tick,
    runId,
    payload: {
      bridgeActivated,
      effectKind,
      magnitude,
      cardKind,
      note: 'cross_set_bridge_without_degeneracy',
    },
  });

  // Effect score (telemetry-only)
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M84_BOUNDS.BASE_DECAY_RATE);

  const effectRaw =
    clamp(magnitude / 10, 0, 1) *
    (pressureW * phaseW * regimeW) *
    clamp(regimeMul * exitPulse, 0.75, 5.0) *
    (inChaos ? (1 - clamp(decay, 0, 0.5)) : 1);

  const effectScore = clamp(effectRaw * M84_BOUNDS.MAX_EFFECT * M84_BOUNDS.EFFECT_MULTIPLIER, M84_BOUNDS.MIN_EFFECT, M84_BOUNDS.MAX_EFFECT);

  const auditHash = computeHash(
    JSON.stringify({
      m: 'M84',
      tick,
      runId,
      activeSynergySets,
      cardKind,
      degeneracyGuardPassed,
      guard,
      catalystEffect,
      bridgeActivated,
      phase,
      regime,
      pressureTier,
      inChaos,
      effectScore: Math.round(effectScore),
      seed,
    }),
  );

  const resolution: CatalystResolution = {
    catalystEffect,
    bridgeActivated,
    degeneracyGuardPassed,
    tick,
    phase,
    regime,
    pressureTier,
    inChaos,
    seed,
    auditHash,
    usesBudget: guard.usesBudget,
    cooldownOk: guard.cooldownOk,
    diversityOk: guard.diversityOk,
    effectScore: Math.round(effectScore),
  };

  return {
    catalystEffect,
    bridgeActivated,
    degeneracyGuardPassed,
    resolution,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M84MLInput {
  catalystEffect?: CatalystEffect;
  bridgeActivated?: boolean;
  degeneracyGuardPassed?: boolean;
  runId: string;
  tick: number;
}

export interface M84MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * catalystSlotBridgeMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function catalystSlotBridgeMLCompanion(input: M84MLInput): Promise<M84MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const passed = Boolean(input.degeneracyGuardPassed ?? false);
  const bridge = Boolean(input.bridgeActivated ?? false);
  const mag = clamp(Number(input.catalystEffect?.magnitude ?? 0), 0, 10);

  // Neutral decay baseline (regime unknown here)
  const confidenceDecay = computeDecayRate('NEUTRAL' as MacroRegime, M84_BOUNDS.BASE_DECAY_RATE);

  // Score: passing guard is required; bridge+mag increase.
  const score = clamp(
    (passed ? 0.35 : 0.05) +
      (bridge ? 0.25 : 0) +
      clamp(mag / 10, 0, 1) * (passed ? 0.35 : 0.1),
    0.01,
    0.99,
  );

  // Deterministic hint using DEFAULT_CARD_IDS (keeps import live)
  const hintPick = seededIndex(computeHash(`M84ML:${tick}:${input.runId}:${passed}:${bridge}:${mag}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintPick] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `guard=${passed ? 'pass' : 'fail'}`,
    `bridge=${bridge ? 'yes' : 'no'}`,
    `mag=${mag.toFixed(2)}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation = !passed
    ? 'Guard failed: increase diversity (sets/kinds) or wait out cooldown before slotting catalyst again.'
    : bridge
      ? 'Bridge active: pivot into cross-set combos; avoid repeating identical loops to keep guard green.'
      : 'Catalyst active: amplify current set; add a second set or new kind to unlock bridging.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M84'),
    confidenceDecay,
  };
}