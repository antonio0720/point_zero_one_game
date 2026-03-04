// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m43_sandbox_rewind_mode.ts
//
// Mechanic : M43 — Sandbox Rewind Mode
// Family   : onboarding   Layer: backend_service   Priority: 2   Batch: 2
// ML Pair  : m43a
// Deps     : M01
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

// ── Import Anchors (keep every import accessible + used) ─────────────────────

export const M43_IMPORTED_SYMBOLS = {
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

export type M43_ImportedTypesAnchor = {
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

// ── Mechanic-local sandbox domain (not in shared ./types.ts) ─────────────────

export type SandboxMode = 'SAFE' | 'FULL';

export interface SandboxState {
  runId: string;
  seed: string;
  mode: SandboxMode;

  /**
   * For backend service usage: immutable snapshot of replay-like turns.
   * Keep it generic to avoid coupling. Deterministic hash verifies integrity.
   */
  timeline: Array<Record<string, unknown>>;

  /**
   * Optional user-selected "bookmark" indices (turn/tick).
   */
  bookmarks?: number[];

  /**
   * Optional last rewind metadata for UI display.
   */
  lastRewind?: {
    targetHash: string;
    rewindTick: number;
    deltaTurns: number;
  };
}

export type RewindTargetKind = 'TICK' | 'TURN_INDEX' | 'BOOKMARK' | 'HASH';

export interface RewindTarget {
  kind: RewindTargetKind;
  /**
   * tick or index depending on kind; bookmark index if kind=BOOKMARK.
   */
  value: number;
  /**
   * Optional expected hash for server verification.
   */
  expectedHash?: string;
}

export type RewindStatus = 'OK' | 'NO_STATE' | 'INVALID_TARGET' | 'OUT_OF_RANGE' | 'HASH_MISMATCH';

export interface RewindResult {
  status: RewindStatus;
  runId: string;
  rewindTick: number;
  rewindIndex: number;
  truncatedTimeline: Array<Record<string, unknown>>;
  auditHash: string;
}

export interface AlternateTimeline {
  runId: string;
  seed: string;
  baseRewindIndex: number;

  /**
   * Deterministically simulated “alternate” set of steps.
   */
  simulated: Array<Record<string, unknown>>;

  /**
   * Short verifiable token linking alt timeline to base.
   */
  altHash: string;

  meta: Record<string, unknown>;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M43Input {
  sandboxState?: SandboxState;
  rewindTarget?: unknown; // accepts RewindTarget or raw payloads; normalized inside
}

export interface M43Output {
  rewindResult: RewindResult;
  alternateTimeline: AlternateTimeline;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M43Event = 'SANDBOX_ENTERED' | 'REWIND_EXECUTED' | 'ALTERNATE_SIMULATED';

export interface M43TelemetryPayload extends MechanicTelemetryPayload {
  event: M43Event;
  mechanic_id: 'M43';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M43_BOUNDS = {
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

  // M43-specific
  MAX_TIMELINE_LEN: 5_000,
  MAX_ALT_LEN: 64,
  MIN_ALT_LEN: 8,
} as const;

// ── Internal helpers (deterministic, bounded) ───────────────────────────────

function m43ToRewindTarget(raw: unknown): RewindTarget | null {
  if (!raw || typeof raw !== 'object') return null;

  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  const value = o.value;

  const expectedHash = typeof o.expectedHash === 'string' && o.expectedHash.length > 0 ? o.expectedHash : undefined;

  if (kind === 'TICK' || kind === 'TURN_INDEX' || kind === 'BOOKMARK' || kind === 'HASH') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { kind: kind as RewindTargetKind, value: Math.floor(value), expectedHash };
    }
    // HASH can accept value as NaN; we treat it invalid unless numeric provided (hash rewinds handled via expectedHash)
    if (kind === 'HASH' && expectedHash) {
      return { kind: 'HASH', value: 0, expectedHash };
    }
  }

  // Allow shorthand forms:
  // { tick: 12 } => TICK
  if (typeof o.tick === 'number' && Number.isFinite(o.tick)) return { kind: 'TICK', value: Math.floor(o.tick), expectedHash };
  if (typeof o.turnIndex === 'number' && Number.isFinite(o.turnIndex)) return { kind: 'TURN_INDEX', value: Math.floor(o.turnIndex), expectedHash };
  if (typeof o.bookmark === 'number' && Number.isFinite(o.bookmark)) return { kind: 'BOOKMARK', value: Math.floor(o.bookmark), expectedHash };
  if (typeof o.hash === 'string' && o.hash.length > 0) return { kind: 'HASH', value: 0, expectedHash: o.hash };

  return null;
}

function m43BoundTimeline(tl: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const safe = Array.isArray(tl) ? tl : [];
  if (safe.length <= M43_BOUNDS.MAX_TIMELINE_LEN) return safe;
  return safe.slice(0, M43_BOUNDS.MAX_TIMELINE_LEN);
}

/**
 * FIX: previously referenced in ML companion as `m43InChaosWindow(...)` but not defined.
 * This helper is used both by core exec helpers and ML companion.
 */
function m43InChaosWindow(tick: number, chaosWindows: ChaosWindow[]): boolean {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of chaosWindows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function m43FindIndexByHash(timeline: Array<Record<string, unknown>>, expectedHash: string): number {
  // Deterministic scan: computeHash for each turn payload.
  for (let i = 0; i < timeline.length; i++) {
    const h = computeHash(JSON.stringify(timeline[i]));
    if (h === expectedHash) return i;
  }
  return -1;
}

function m43ComputeRewindIndex(
  state: SandboxState,
  target: RewindTarget,
): { status: RewindStatus; index: number; tick: number } {
  const timeline = m43BoundTimeline(state.timeline);

  if (timeline.length === 0) return { status: 'OUT_OF_RANGE', index: 0, tick: 0 };

  if (target.kind === 'TURN_INDEX') {
    const idx = clamp(target.value, 0, timeline.length - 1);
    return { status: 'OK', index: idx, tick: idx };
  }

  if (target.kind === 'TICK') {
    // In sandbox, tick maps 1:1 to index by default; callers can encode tick in payload if needed.
    const idx = clamp(target.value, 0, timeline.length - 1);
    return { status: 'OK', index: idx, tick: target.value };
  }

  if (target.kind === 'BOOKMARK') {
    const b = state.bookmarks ?? [];
    if (!Array.isArray(b) || b.length === 0) return { status: 'INVALID_TARGET', index: 0, tick: 0 };
    const bi = clamp(target.value, 0, b.length - 1);
    const idx = clamp(Math.floor(b[bi] ?? 0), 0, timeline.length - 1);
    return { status: 'OK', index: idx, tick: idx };
  }

  if (target.kind === 'HASH') {
    const eh = target.expectedHash ?? '';
    if (!eh) return { status: 'INVALID_TARGET', index: 0, tick: 0 };
    const idx = m43FindIndexByHash(timeline, eh);
    if (idx < 0) return { status: 'HASH_MISMATCH', index: 0, tick: 0 };
    return { status: 'OK', index: idx, tick: idx };
  }

  return { status: 'INVALID_TARGET', index: 0, tick: 0 };
}

function m43DeriveMacroContext(seed: string, tick: number): {
  macroSchedule: MacroEvent[];
  chaosWindows: ChaosWindow[];
  macroRegime: MacroRegime;
  runPhase: RunPhase;
  pressureTier: PressureTier;
  inChaos: boolean;
  decayRate: number;
  envMult: number;
} {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const inChaos = m43InChaosWindow(t, chaosWindows);

  const runPhase = (() => {
    const third = RUN_TOTAL_TICKS / 3;
    if (t < third) return 'EARLY';
    if (t < third * 2) return 'MID';
    return 'LATE';
  })();

  const macroRegime = (() => {
    if (!macroSchedule || macroSchedule.length === 0) return 'NEUTRAL';
    const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
    let r: MacroRegime = 'NEUTRAL';
    for (const ev of sorted) {
      if (ev.tick > t) break;
      if (ev.regimeChange) r = ev.regimeChange;
    }
    return r;
  })();

  const pressureTier = (() => {
    if (inChaos) return 'CRITICAL';
    if (runPhase === 'EARLY') return 'LOW';
    if (runPhase === 'MID') return 'MEDIUM';
    return 'HIGH';
  })();

  const decayRate = computeDecayRate(macroRegime, M43_BOUNDS.BASE_DECAY_RATE);
  const envMult = (REGIME_MULTIPLIERS[macroRegime] ?? 1.0) * (EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0);

  return {
    macroSchedule,
    chaosWindows,
    macroRegime,
    runPhase,
    pressureTier,
    inChaos,
    decayRate,
    envMult,
  };
}

function m43SimulateAlternateTimeline(
  seed: string,
  baseTimeline: Array<Record<string, unknown>>,
  baseIndex: number,
  pressureTier: PressureTier,
  runPhase: RunPhase,
  macroRegime: MacroRegime,
): AlternateTimeline {
  const bounded = m43BoundTimeline(baseTimeline);
  const head = bounded.slice(0, baseIndex + 1);

  // Deterministic alt length depends on weights + phase; bounded
  const pW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const phW = PHASE_WEIGHTS[runPhase] ?? 1.0;
  const rW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const intensity = clamp(pW * phW * rW, 0.5, 3.0);
  const len = clamp(
    Math.round(M43_BOUNDS.MIN_ALT_LEN + intensity * 10),
    M43_BOUNDS.MIN_ALT_LEN,
    M43_BOUNDS.MAX_ALT_LEN,
  );

  // Deterministic cards as “decision injectors”
  const deckIds = seededShuffle(DEFAULT_CARD_IDS, seed + ':deck');
  const oppIdx = seededIndex(seed + ':opp', baseIndex + 17, OPPORTUNITY_POOL.length);
  const featured = OPPORTUNITY_POOL[oppIdx] ?? DEFAULT_CARD;

  const pool = buildWeightedPool(seed + ':pool', pW * phW, rW);
  const poolPick =
    pool[seededIndex(seed + ':pick', baseIndex + 33, Math.max(1, pool.length))] ?? featured ?? DEFAULT_CARD;

  // Build alt steps as generic “turn patches”
  const simulated: Array<Record<string, unknown>> = [];
  for (let i = 0; i < len; i++) {
    const salt = seededIndex(seed + ':alt', baseIndex + i, 10_000);
    const pick = i % 2 === 0 ? featured : poolPick;

    simulated.push({
      kind: 'ALT_STEP',
      i,
      salt,
      suggestedCardId: pick.id,
      suggestedCardName: pick.name,
      deckTop: deckIds[(i + 1) % Math.max(1, deckIds.length)] ?? '',
      macroRegime,
      runPhase,
      pressureTier,
      note: i === 0 ? 'Fork point. Alternate begins.' : 'Alternate continuation.',
    });
  }

  const altHash = computeHash(
    JSON.stringify({ mid: 'M43', seed, baseIndex, featured: featured.id, poolPick: poolPick.id, simulated }),
  );

  return {
    runId: computeHash(seed + ':altRun'),
    seed,
    baseRewindIndex: baseIndex,
    simulated,
    altHash,
    meta: {
      featured: { id: featured.id, name: featured.name },
      poolPick: { id: poolPick.id, name: poolPick.name },
      headLen: head.length,
      altLen: simulated.length,
      deckTop: deckIds[0] ?? '',
    },
  };
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * sandboxRewindEngine
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function sandboxRewindEngine(input: M43Input, emit: MechanicEmitter): M43Output {
  const sandboxState = input.sandboxState;

  const serviceHash = computeHash(JSON.stringify({ mid: 'M43', input }));
  emit({
    event: 'SANDBOX_ENTERED',
    mechanic_id: 'M43',
    tick: 0,
    runId: serviceHash,
    payload: {
      hasState: Boolean(sandboxState),
      serviceHash,
    },
  } as M43TelemetryPayload);

  if (!sandboxState) {
    const rewindResult: RewindResult = {
      status: 'NO_STATE',
      runId: serviceHash,
      rewindTick: 0,
      rewindIndex: 0,
      truncatedTimeline: [],
      auditHash: computeHash(serviceHash + ':no_state'),
    };

    const alternateTimeline: AlternateTimeline = {
      runId: computeHash(serviceHash + ':alt'),
      seed: computeHash(serviceHash + ':seed'),
      baseRewindIndex: 0,
      simulated: [],
      altHash: computeHash(serviceHash + ':alt_hash'),
      meta: { reason: 'NO_STATE' },
    };

    return { rewindResult, alternateTimeline };
  }

  const normalizedTarget = m43ToRewindTarget(input.rewindTarget) ?? { kind: 'TURN_INDEX' as const, value: 0 };
  const timeline = m43BoundTimeline(sandboxState.timeline);

  const { status, index, tick } = m43ComputeRewindIndex(sandboxState, normalizedTarget);

  if (status !== 'OK') {
    const rewindResult: RewindResult = {
      status,
      runId: sandboxState.runId ?? serviceHash,
      rewindTick: 0,
      rewindIndex: 0,
      truncatedTimeline: timeline.slice(0, 1),
      auditHash: computeHash(JSON.stringify({ mid: 'M43', status, target: normalizedTarget })),
    };

    const alternateTimeline: AlternateTimeline = {
      runId: computeHash(serviceHash + ':alt_bad'),
      seed: computeHash(serviceHash + ':seed_bad'),
      baseRewindIndex: 0,
      simulated: [],
      altHash: computeHash(serviceHash + ':alt_hash_bad'),
      meta: { reason: status, target: normalizedTarget },
    };

    return { rewindResult, alternateTimeline };
  }

  const seed = sandboxState.seed ?? computeHash(`${sandboxState.runId}:seed`);
  const ctx = m43DeriveMacroContext(seed, tick);

  const truncatedTimeline = timeline.slice(0, index + 1);

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M43',
      runId: sandboxState.runId,
      seed,
      rewind: { target: normalizedTarget, index, tick },
      ctx,
      truncatedHash: computeHash(JSON.stringify(truncatedTimeline)),
    }),
  );

  const rewindResult: RewindResult = {
    status: 'OK',
    runId: sandboxState.runId,
    rewindTick: tick,
    rewindIndex: index,
    truncatedTimeline,
    auditHash,
  };

  emit({
    event: 'REWIND_EXECUTED',
    mechanic_id: 'M43',
    tick,
    runId: sandboxState.runId,
    payload: {
      status: 'OK',
      target: normalizedTarget,
      rewindIndex: index,
      rewindTick: tick,
      truncatedLen: truncatedTimeline.length,
      macroRegime: ctx.macroRegime,
      runPhase: ctx.runPhase,
      pressureTier: ctx.pressureTier,
      inChaos: ctx.inChaos,
      envMult: Number(ctx.envMult.toFixed(4)),
      decayRate: Number(ctx.decayRate.toFixed(6)),
      auditHash,
    },
  } as M43TelemetryPayload);

  const alternateTimeline = m43SimulateAlternateTimeline(seed, timeline, index, ctx.pressureTier, ctx.runPhase, ctx.macroRegime);

  emit({
    event: 'ALTERNATE_SIMULATED',
    mechanic_id: 'M43',
    tick,
    runId: sandboxState.runId,
    payload: {
      baseRewindIndex: index,
      altLen: alternateTimeline.simulated.length,
      altHash: alternateTimeline.altHash,
      meta: alternateTimeline.meta,
    },
  } as M43TelemetryPayload);

  return { rewindResult, alternateTimeline };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M43MLInput {
  rewindResult?: RewindResult;
  alternateTimeline?: AlternateTimeline;
  runId: string;
  tick: number;
}

export interface M43MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * sandboxRewindEngineMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function sandboxRewindEngineMLCompanion(input: M43MLInput): Promise<M43MLOutput> {
  const tick = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const runId = String(input.runId ?? '');
  const seed = computeHash(`${runId}:M43:ml:${tick}`);

  const macroSchedule = buildMacroSchedule(seed, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(seed, CHAOS_WINDOWS_PER_RUN);

  const macroRegime = (() => {
    if (!macroSchedule || macroSchedule.length === 0) return 'NEUTRAL';
    const sorted = [...macroSchedule].sort((a, b) => a.tick - b.tick);
    let r: MacroRegime = 'NEUTRAL';
    for (const ev of sorted) {
      if (ev.tick > tick) break;
      if (ev.regimeChange) r = ev.regimeChange;
    }
    return r;
  })();

  const decay = computeDecayRate(macroRegime, M43_BOUNDS.BASE_DECAY_RATE);
  const envMult = (REGIME_MULTIPLIERS[macroRegime] ?? 1.0) * (EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0);

  const ok = input.rewindResult?.status === 'OK';
  const altLen = input.alternateTimeline?.simulated?.length ?? 0;

  // FIX: use defined helper
  const chaosEarly = m43InChaosWindow(tick, chaosWindows);
  const chaosPenalty = chaosEarly ? 0.10 : 0.0;

  const score = clamp(
    0.20 +
      (ok ? 0.45 : 0.05) +
      clamp(altLen / M43_BOUNDS.MAX_ALT_LEN, 0, 1) * 0.30 +
      clamp(envMult / 4, 0, 0.20) -
      chaosPenalty,
    0.01,
    0.99,
  );

  return {
    score,
    topFactors: [
      `tick=${tick}/${RUN_TOTAL_TICKS}`,
      `rewind=${ok ? 'OK' : 'NO'} altLen=${altLen}`,
      `regime=${macroRegime} envMult=${envMult.toFixed(2)}`,
      `decay=${decay.toFixed(3)} chaos=${chaosEarly ? 'Y' : 'N'}`,
      `weights r=${(REGIME_WEIGHTS[macroRegime] ?? 1.0).toFixed(2)}`,
    ].slice(0, 5),
    recommendation: ok
      ? altLen > 0
        ? 'Rewind + alternate simulation available: present side-by-side deltas and highlight the first divergent decision.'
        : 'Rewind succeeded but no alternate simulated: ensure pool builders and alt length bounds are configured.'
      : 'Rewind failed: validate sandboxState timeline, target normalization, and hash/bookmark integrity.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M43'),
    confidenceDecay: decay,
  };
}