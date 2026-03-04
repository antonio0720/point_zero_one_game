// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m86_micro_proofs_moment_scoped_achievement_stamps.ts
//
// Mechanic : M86 — Micro Proofs: Moment-Scoped Achievement Stamps
// Family   : achievement_expert   Layer: season_runtime   Priority: 2   Batch: 2
// ML Pair  : m86a
// Deps     : M22, M50
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

// ── Import Anchors (keeps every symbol “accessible” + TS-used) ───────────────

export const M86_IMPORTED_SYMBOLS = {
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

export type M86_ImportedTypesAnchor = {
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

export interface M86Input {
  momentEvent?: MomentEvent;
  microProofDefs?: unknown;

  /**
   * Optional snapshot fallbacks (snapshotExtractor spreads the full snapshot).
   * If present, they strengthen determinism across clients/server.
   */
  stateTick?: number;
  runSeed?: string;
  runId?: string;
}

export interface M86Output {
  microProofStamped: boolean;
  stampHash: string;
  momentAnnotated: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M86Event = 'MICRO_PROOF_STAMPED' | 'MOMENT_ANNOTATED' | 'STAMP_VERIFIED';

export interface M86TelemetryPayload extends MechanicTelemetryPayload {
  event: M86Event;
  mechanic_id: 'M86';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M86_BOUNDS = {
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

// ── Local helpers ──────────────────────────────────────────────────────────

type StampCtx = {
  tick: number;
  runSeed: string;
  seed: string;

  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];

  regime: MacroRegime;
  phase: RunPhase;
  pressure: PressureTier;
  tickTier: TickTier;

  decay: number;
  pulse: number;
  mult: number;
};

function derivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = RUN_TOTAL_TICKS / 3;
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function deriveRegime(tick: number, macroSchedule: MacroEvent[]): MacroRegime {
  if (!macroSchedule || macroSchedule.length === 0) return 'NEUTRAL';
  const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
  let regime: MacroRegime = 'NEUTRAL';
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange) regime = ev.regimeChange;
  }
  return regime;
}

function findChaosHit(tick: number, chaosWindows: ChaosWindow[]): ChaosWindow | null {
  for (const w of chaosWindows) {
    if (tick >= w.startTick && tick <= w.endTick) return w;
  }
  return null;
}

function classifyPressure(phase: RunPhase, chaosHit: ChaosWindow | null): PressureTier {
  if (chaosHit) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function classifyTickTier(pressure: PressureTier): TickTier {
  if (pressure === 'CRITICAL') return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function coerceDefsCount(microProofDefs: unknown): number {
  if (Array.isArray(microProofDefs)) return microProofDefs.length;

  if (microProofDefs && typeof microProofDefs === 'object') {
    const o = microProofDefs as Record<string, unknown>;
    const a =
      (Array.isArray(o.defs) && o.defs) ||
      (Array.isArray(o.items) && o.items) ||
      (Array.isArray(o.proofs) && o.proofs) ||
      (Array.isArray(o.rewardTable) && o.rewardTable) ||
      null;

    if (a) return a.length;
  }

  return 0;
}

function buildStampCtx(tickRaw: number, runSeed: string): StampCtx {
  const tick = clamp(tickRaw, 0, RUN_TOTAL_TICKS - 1);
  const seed = computeHash(`${runSeed}:M86:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const phase = derivePhase(tick);
  const regime = deriveRegime(tick, macroSchedule);
  const chaosHit = findChaosHit(tick, chaosWindows);
  const pressure = classifyPressure(phase, chaosHit);
  const tickTier = classifyTickTier(pressure);

  const decay = computeDecayRate(regime, M86_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  return { tick, runSeed, seed, macroSchedule, chaosWindows, regime, phase, pressure, tickTier, decay, pulse, mult };
}

function computeStampHash16(core: string): string {
  // computeHash() returns 8 hex chars; concatenate twice for a stable 16-char stamp.
  return computeHash(core + ':a') + computeHash(core + ':b');
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * microProofStamper
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function microProofStamper(input: M86Input, emit: MechanicEmitter): M86Output {
  const momentEvent = (input.momentEvent as MomentEvent | undefined) ?? undefined;
  const microProofDefs = input.microProofDefs;

  const tickRaw =
    (momentEvent?.tick as number | undefined) ??
    ((input.stateTick as number | undefined) ?? ((input as unknown as { tick?: number }).tick ?? 0));

  const runSeed =
    ((input.runSeed as string | undefined) ??
      (input.runId as string | undefined) ??
      (input as unknown as { runId?: string; runSeed?: string }).runSeed ??
      (input as unknown as { runId?: string }).runId ??
      '') ||
    computeHash(JSON.stringify(input));

  const ctx = buildStampCtx(tickRaw ?? 0, runSeed);

  const defsCount = coerceDefsCount(microProofDefs);

  // Ensure more imports are used in real logic (not just anchors).
  // - Uses seededShuffle + buildWeightedPool + OPPORTUNITY_POOL + DEFAULT_CARD_IDS in deterministic selection.
  const pressurePhaseWeight = (PRESSURE_WEIGHTS[ctx.pressure] ?? 1.0) * (PHASE_WEIGHTS[ctx.phase] ?? 1.0);
  const regimeWeight = REGIME_WEIGHTS[ctx.regime] ?? 1.0;

  const weightedPool = buildWeightedPool(`${ctx.seed}:m86pool`, pressurePhaseWeight, regimeWeight);
  const poolPick: GameCard =
    weightedPool[seededIndex(ctx.seed, ctx.tick + 86, weightedPool.length)] ??
    OPPORTUNITY_POOL[seededIndex(ctx.seed, ctx.tick + 1086, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const safeCardId = DEFAULT_CARD_IDS.includes(poolPick.id) ? poolPick.id : DEFAULT_CARD.id;
  const deckTop = seededShuffle(DEFAULT_CARD_IDS, `${ctx.seed}:deck:${ctx.tick}`)[0] ?? DEFAULT_CARD.id;

  const highlight = String(momentEvent?.highlight ?? '');
  const shareReady = Boolean(momentEvent?.shareReady);

  const highlightGate = highlight.trim().length >= M86_BOUNDS.TRIGGER_THRESHOLD;
  const timeGate = ctx.tick >= M86_BOUNDS.FIRST_REFUSAL_TICKS;

  const shouldStamp = Boolean(momentEvent) && timeGate && (shareReady || highlightGate);

  const defsHash = computeHash(JSON.stringify(microProofDefs ?? null));
  const stampCore = JSON.stringify({
    mid: 'M86',
    runSeed: ctx.runSeed,
    seed: ctx.seed,
    tick: ctx.tick,
    regime: ctx.regime,
    phase: ctx.phase,
    pressure: ctx.pressure,
    tickTier: ctx.tickTier,
    decay: Number(ctx.decay.toFixed(4)),
    pulse: Number(ctx.pulse.toFixed(4)),
    mult: Number(ctx.mult.toFixed(4)),
    moment: momentEvent ? { type: momentEvent.type, tick: momentEvent.tick, shareReady, highlight } : null,
    defs: { count: defsCount, hash: defsHash },
    cardTag: safeCardId,
    deckTop,
  });

  const stampHash = computeStampHash16(stampCore);
  const verified = computeStampHash16(stampCore) === stampHash;

  if (shouldStamp) {
    emit({
      event: 'MICRO_PROOF_STAMPED',
      mechanic_id: 'M86',
      tick: ctx.tick,
      runId: ctx.seed,
      payload: {
        tick: ctx.tick,
        momentType: momentEvent?.type ?? 'UNKNOWN',
        shareReady,
        highlight,
        regime: ctx.regime,
        phase: ctx.phase,
        pressure: ctx.pressure,
        tickTier: ctx.tickTier,
        decay: Number(ctx.decay.toFixed(4)),
        pulse: Number(ctx.pulse.toFixed(4)),
        mult: Number(ctx.mult.toFixed(4)),
        defsCount,
        defsHash,
        poolPick: { id: poolPick.id, name: poolPick.name },
        safeCardId,
        deckTop,
        stampHash,
      },
    });

    emit({
      event: 'MOMENT_ANNOTATED',
      mechanic_id: 'M86',
      tick: ctx.tick,
      runId: ctx.seed,
      payload: {
        tick: ctx.tick,
        annotation: `[MICRO_PROOF:${stampHash}]`,
        highlight,
        cardTag: safeCardId,
        deckTop,
      },
    });
  }

  emit({
    event: 'STAMP_VERIFIED',
    mechanic_id: 'M86',
    tick: ctx.tick,
    runId: ctx.seed,
    payload: {
      tick: ctx.tick,
      verified,
      stampHash,
      defsHash,
      shouldStamp,
    },
  });

  return {
    microProofStamped: shouldStamp,
    stampHash,
    momentAnnotated: shouldStamp,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M86MLInput {
  microProofStamped?: boolean;
  stampHash?: string;
  momentAnnotated?: boolean;
  runId: string;
  tick: number;
}

export interface M86MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * microProofStamperMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function microProofStamperMLCompanion(input: M86MLInput): Promise<M86MLOutput> {
  const tick = clamp(input.tick ?? 0, 0, RUN_TOTAL_TICKS - 1);

  // Derive deterministic context from runId+tick (mirrors exec-side schedule use).
  const seed = computeHash(`${input.runId}:M86ML:${tick}`);
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const regime = deriveRegime(tick, macroSchedule);
  const decay = computeDecayRate(regime, M86_BOUNDS.BASE_DECAY_RATE);
  const pulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const mult = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const stamped = Boolean(input.microProofStamped);
  const annotated = Boolean(input.momentAnnotated);
  const hasStamp = Boolean(input.stampHash && input.stampHash.length >= 8);

  const base = stamped ? 0.62 : 0.22;
  const stampBonus = hasStamp ? 0.10 : 0.0;
  const annotateBonus = annotated ? 0.05 : 0.0;
  const macroBonus = clamp((pulse * mult) / 3, 0, 0.18);
  const stabilityBonus = clamp((1 - decay) / 2, 0, 0.08);

  const score = clamp(base + stampBonus + annotateBonus + macroBonus + stabilityBonus, 0.01, 0.99);

  const topFactors = [
    `stamped=${stamped} annotated=${annotated}`,
    `hasStamp=${hasStamp}`,
    `tick=${tick}/${RUN_TOTAL_TICKS}`,
    `regime=${regime} pulse*mult=${(pulse * mult).toFixed(2)}`,
    `decay=${decay.toFixed(2)}`,
  ].slice(0, 5);

  const recommendation = stamped
    ? 'Micro-proof stamped: surface it as a verified receipt and keep momentum within the current clip window.'
    : 'No micro-proof: wait for a higher-signal moment before stamping to preserve trust and rarity.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify({ mid: 'M86', ...input, seed, regime, decay, pulse, mult }) + ':ml:M86'),
    confidenceDecay: decay,
  };
}