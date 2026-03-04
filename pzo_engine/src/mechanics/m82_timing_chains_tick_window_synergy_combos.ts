// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m82_timing_chains_tick_window_synergy_combos.ts
//
// Mechanic : M82 — Timing Chains: Tick-Window Synergy Combos
// Family   : portfolio_expert   Layer: card_handler   Priority: 2   Batch: 2
// ML Pair  : m82a
// Deps     : M31, M82
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
export const M82_IMPORTED_SYMBOLS = {
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
export type M82_ImportedTypesAnchor = {
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

export interface TimingWindowDef {
  // base window in ticks (e.g., you must play next card within N ticks)
  windowTicks?: number;

  // required minimum chain length to be considered “completed”
  minChainLength?: number;

  // optional max chain length cap (safety)
  maxChainLength?: number;

  // per-step shrink (harder as chain continues)
  shrinkPerStep?: number;

  // whether chaos windows tighten the window
  chaosTightenPct?: number; // 0..1

  // optional tag-like sequence requirement (best-effort; no schema assumptions)
  // e.g. ['ASSET', 'ASSET', 'PROOF'] or ['INCOME', 'BUFF']
  requiredKinds?: string[];
}

export interface TimingChainResolution {
  comboActivated: boolean;
  timingMultiplier: number;
  windowMissed: boolean;

  // context
  tick: number;
  phase: RunPhase;
  regime: MacroRegime;
  pressureTier: PressureTier;
  inChaos: boolean;

  // chain state
  chainLength: number;
  requiredMin: number;
  allowedWindow: number;
  missedByTicks: number;

  // deterministic audit
  seed: string;
  auditHash: string;

  effectScore: number;
}

function m82NormalizeWindowDef(def?: unknown): Required<Pick<TimingWindowDef, 'windowTicks' | 'minChainLength' | 'maxChainLength' | 'shrinkPerStep' | 'chaosTightenPct' | 'requiredKinds'>> {
  const d = (def ?? {}) as Partial<TimingWindowDef>;
  const windowTicks = clamp(Math.floor(Number(d.windowTicks ?? 6)), 1, 60);
  const minChainLength = clamp(Math.floor(Number(d.minChainLength ?? 3)), 1, 12);
  const maxChainLength = clamp(Math.floor(Number(d.maxChainLength ?? 8)), minChainLength, 20);
  const shrinkPerStep = clamp(Number(d.shrinkPerStep ?? 0.5), 0, 3);
  const chaosTightenPct = clamp(Number(d.chaosTightenPct ?? 0.15), 0, 0.75);
  const requiredKinds = Array.isArray(d.requiredKinds) ? d.requiredKinds.map(String) : [];
  return { windowTicks, minChainLength, maxChainLength, shrinkPerStep, chaosTightenPct, requiredKinds };
}

function m82DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m82DeriveRegime(tick: number, schedule: MacroEvent[]): MacroRegime {
  const sorted = [...(schedule ?? [])].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function m82InChaosWindow(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows ?? []) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function m82DerivePressureTier(proxy: number, inChaos: boolean): PressureTier {
  if (inChaos) return proxy >= 6 ? 'CRITICAL' : 'HIGH';
  if (proxy <= 2) return 'LOW';
  if (proxy <= 5) return 'MEDIUM';
  if (proxy <= 8) return 'HIGH';
  return 'CRITICAL';
}

function m82CardKind(card: GameCard): string {
  const c = card as unknown as Record<string, unknown>;
  const kind = (c.kind ?? c.type ?? c.category ?? c.cardType) as unknown;
  return String(kind ?? 'UNKNOWN').toUpperCase();
}

function m82ComputeAllowedWindow(
  baseWindow: number,
  chainLen: number,
  shrinkPerStep: number,
  inChaos: boolean,
  chaosTightenPct: number,
  phase: RunPhase,
  pressureTier: PressureTier,
  regime: MacroRegime,
): number {
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  // More pressure => smaller window (faster required execution)
  const pressureTighten = clamp(pressureW / 3, 0, 1) * 0.35; // 0..0.35
  const phaseTighten = clamp(phaseW / 3, 0, 1) * 0.15; // 0..0.15
  const regimeTighten = clamp(regimeW / 3, 0, 1) * 0.15; // 0..0.15

  const chainShrink = shrinkPerStep * Math.max(0, chainLen - 1);

  const chaosTighten = inChaos ? chaosTightenPct : 0;

  const tightened = baseWindow * (1 - pressureTighten - phaseTighten - regimeTighten - chaosTighten);
  const allowed = Math.floor(tightened - chainShrink);

  return clamp(allowed, 1, 60);
}

function m82ComputeMultiplier(
  seed: string,
  tick: number,
  chainLen: number,
  allowedWindow: number,
  baseWindow: number,
  phase: RunPhase,
  pressureTier: PressureTier,
  regime: MacroRegime,
  inChaos: boolean,
): number {
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M82_BOUNDS.BASE_DECAY_RATE);

  // Deterministic pool-based spice (keeps pool imports live)
  const pool = buildWeightedPool(`${seed}:m82pool:${tick}`, pressureW * phaseW, regimeW);
  const opp = OPPORTUNITY_POOL[seededIndex(seed, tick + 23, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;
  const pick = pool[seededIndex(computeHash(`${seed}:${chainLen}:${allowedWindow}`), tick + 5, Math.max(1, pool.length))] ?? opp;

  const money = Number(pick.cost ?? pick.downPayment ?? 1_000);
  const moneyN = clamp(money / 50_000, 0, 2);

  const difficulty = clamp(1 - allowedWindow / Math.max(1, baseWindow), 0, 1);
  const chainPower = clamp(chainLen / 10, 0, 1);

  const chaosAdj = inChaos ? (1 - clamp(decay, 0, 0.5)) : 1;

  const raw =
    1 +
    chainPower * 1.1 +
    difficulty * 0.9 +
    moneyN * 0.35 +
    clamp(pressureW * phaseW * regimeW, 0.75, 4.0) * 0.15;

  const scaled = raw * clamp(regimeMul * exitPulse, 0.75, 5.0) * chaosAdj;

  // Hard bound multiplier
  return clamp(Number(scaled.toFixed(4)), 1, 9.99);
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M82Input {
  stateTick?: number;
  cardSequence?: GameCard[];
  timingWindowDef?: unknown;

  // Optional context
  runId?: string;
  pressureTier?: PressureTier;

  // Optional chain metadata (if you track last action tick upstream)
  lastActionTick?: number;
}

export interface M82Output {
  comboActivated: boolean;
  timingMultiplier: number;
  windowMissed: boolean;
  resolution?: TimingChainResolution;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M82Event = 'TIMING_CHAIN_STARTED' | 'CHAIN_COMPLETED' | 'CHAIN_BROKEN';

export interface M82TelemetryPayload extends MechanicTelemetryPayload {
  event: M82Event;
  mechanic_id: 'M82';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M82_BOUNDS = {
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

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * timingChainComboResolver
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function timingChainComboResolver(input: M82Input, emit: MechanicEmitter): M82Output {
  const tick = clamp(Number(input.stateTick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? computeHash(JSON.stringify(input)));
  const cards = (Array.isArray(input.cardSequence) ? input.cardSequence : []) as GameCard[];

  const def = m82NormalizeWindowDef(input.timingWindowDef);

  // Deterministic seed
  const seed = computeHash(
    JSON.stringify({
      m: 'M82',
      tick,
      runId,
      cardCount: cards.length,
      def,
      // include coarse sequence signature (stable, not huge)
      seqSig: computeHash(cards.map(c => (c as any)?.id ?? (c as any)?.name ?? 'x').join('|')).slice(0, 16),
    }),
  );

  // Context (bounded chaos)
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = m82DerivePhase(tick);
  const regime = m82DeriveRegime(tick, macroSchedule);
  const inChaos = m82InChaosWindow(tick, chaosWindows);

  const proxy = clamp(cards.length, 1, 12);
  const pressureTier = (input.pressureTier as PressureTier) ?? m82DerivePressureTier(proxy, inChaos);

  // Chain evaluation
  const chainLen = clamp(cards.length, 0, def.maxChainLength);

  const allowedWindow = m82ComputeAllowedWindow(
    def.windowTicks,
    chainLen,
    def.shrinkPerStep,
    inChaos,
    def.chaosTightenPct,
    phase,
    pressureTier,
    regime,
  );

  const lastActionTick = clamp(Number(input.lastActionTick ?? tick), 0, RUN_TOTAL_TICKS - 1);
  const elapsed = clamp(tick - lastActionTick, 0, RUN_TOTAL_TICKS);
  const windowMissed = elapsed > allowedWindow;

  // Required kinds check (best-effort)
  let kindsOk = true;
  if (def.requiredKinds.length) {
    const kinds = cards.map(m82CardKind);
    for (let i = 0; i < def.requiredKinds.length; i++) {
      const req = String(def.requiredKinds[i]).toUpperCase();
      const got = kinds[i] ?? 'UNKNOWN';
      if (got !== req) {
        kindsOk = false;
        break;
      }
    }
  }

  emit({
    event: 'TIMING_CHAIN_STARTED',
    mechanic_id: 'M82',
    tick,
    runId,
    payload: {
      tick,
      cardCount: cards.length,
      chainLen,
      baseWindow: def.windowTicks,
      allowedWindow,
      elapsed,
      inChaos,
      phase,
      regime,
      pressureTier,
    },
  });

  const completed = !windowMissed && kindsOk && chainLen >= def.minChainLength;
  const comboActivated = completed;

  const timingMultiplier = comboActivated
    ? m82ComputeMultiplier(seed, tick, chainLen, allowedWindow, def.windowTicks, phase, pressureTier, regime, inChaos)
    : 1;

  const missedBy = windowMissed ? Math.max(1, elapsed - allowedWindow) : 0;

  if (completed) {
    emit({
      event: 'CHAIN_COMPLETED',
      mechanic_id: 'M82',
      tick,
      runId,
      payload: {
        chainLen,
        minChain: def.minChainLength,
        multiplier: timingMultiplier,
        allowedWindow,
        elapsed,
      },
    });
  } else {
    emit({
      event: 'CHAIN_BROKEN',
      mechanic_id: 'M82',
      tick,
      runId,
      payload: {
        reason: windowMissed ? 'WINDOW_MISSED' : kindsOk ? 'CHAIN_TOO_SHORT' : 'KIND_MISMATCH',
        chainLen,
        minChain: def.minChainLength,
        allowedWindow,
        elapsed,
        missedBy,
      },
    });
  }

  // Effect score (telemetry-only)
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const decay = computeDecayRate(regime, M82_BOUNDS.BASE_DECAY_RATE);

  const effectRaw =
    (comboActivated ? 1 : 0.35) *
    clamp(timingMultiplier / 10, 0, 1) *
    (pressureW * phaseW * regimeW) *
    (regimeMul * exitPulse) *
    (inChaos ? (1 - clamp(decay, 0, 0.5)) : 1);

  const effectScore = clamp(effectRaw * M82_BOUNDS.MAX_EFFECT * M82_BOUNDS.EFFECT_MULTIPLIER, M82_BOUNDS.MIN_EFFECT, M82_BOUNDS.MAX_EFFECT);

  const auditHash = computeHash(
    JSON.stringify({
      m: 'M82',
      tick,
      runId,
      chainLen,
      allowedWindow,
      elapsed,
      windowMissed,
      kindsOk,
      comboActivated,
      timingMultiplier,
      effectScore: Math.round(effectScore),
      phase,
      regime,
      pressureTier,
      inChaos,
      seed,
    }),
  );

  const resolution: TimingChainResolution = {
    comboActivated,
    timingMultiplier,
    windowMissed,
    tick,
    phase,
    regime,
    pressureTier,
    inChaos,
    chainLength: chainLen,
    requiredMin: def.minChainLength,
    allowedWindow,
    missedByTicks: missedBy,
    seed,
    auditHash,
    effectScore: Math.round(effectScore),
  };

  return {
    comboActivated,
    timingMultiplier,
    windowMissed,
    resolution,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M82MLInput {
  comboActivated?: boolean;
  timingMultiplier?: number;
  windowMissed?: boolean;
  runId: string;
  tick: number;
}

export interface M82MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * timingChainComboResolverMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function timingChainComboResolverMLCompanion(input: M82MLInput): Promise<M82MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const activated = Boolean(input.comboActivated ?? false);
  const mult = clamp(Number(input.timingMultiplier ?? 1), 1, 9.99);
  const missed = Boolean(input.windowMissed ?? false);

  // Neutral decay baseline (regime unknown here)
  const confidenceDecay = computeDecayRate('NEUTRAL' as MacroRegime, M82_BOUNDS.BASE_DECAY_RATE);

  // Score: activation and multiplier are positive; missed window is negative.
  const score = clamp(0.35 + (activated ? 0.35 : 0) + clamp((mult - 1) / 9, 0, 1) * 0.25 - (missed ? 0.2 : 0), 0.01, 0.99);

  // Deterministic hint using DEFAULT_CARD_IDS (keeps import live)
  const hintPick = seededIndex(computeHash(`M82ML:${tick}:${input.runId}:${activated}:${mult}:${missed}`), tick, DEFAULT_CARD_IDS.length);
  const hintCardId = DEFAULT_CARD_IDS[hintPick] ?? DEFAULT_CARD.id;

  const topFactors = [
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `activated=${activated ? 'yes' : 'no'}`,
    `mult=${mult.toFixed(2)}`,
    `windowMissed=${missed ? 'yes' : 'no'}`,
    `hintCardId=${hintCardId}`,
  ].slice(0, 5);

  const recommendation = activated
    ? 'Combo active: exploit the multiplier by chaining aligned cards within the next windows.'
    : missed
      ? 'Window missed: slow down, reset chain, and watch tick timing before committing cards.'
      : 'Chain incomplete: extend the sequence to meet minimum length and required kinds.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M82'),
    confidenceDecay,
  };
}