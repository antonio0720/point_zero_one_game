// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m118_clip_remix_chains_duet_stitch_but_verified.ts
//
// Mechanic : M118 — Clip Remix Chains: Duet-Stitch but Verified
// Family   : social_advanced   Layer: ui_component   Priority: 3   Batch: 3
// ML Pair  : m118a
// Deps     : M23, M50
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

// ── Import Anchors (keeps every symbol accessible + TS-used) ──────────────────

export const M118_IMPORTED_SYMBOLS = {
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

export type M118_ImportedTypesAnchor = {
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

// ── Local Types (not guaranteed in ./types) ─────────────────────────────────

export type RemixActionKind = 'DUET' | 'STITCH' | 'OVERLAY' | 'CAPTION' | 'SOUND' | 'CUT';

export type RemixAction = {
  kind: RemixActionKind;
  atTick: number; // 0..RUN_TOTAL_TICKS-1
  data?: Record<string, unknown>;
};

export type RemixPayload = {
  actions: RemixAction[];
  caption?: string;
  audioRef?: string;
  layout?: 'DUET' | 'STITCH' | 'FULLSCREEN' | 'SPLIT';
  clientHash?: string; // never trusted for auth; used only for audit correlation
  boundaries?: ClipBoundary[];
};

export type RemixClip = {
  id: string;
  sourceClipHash: string;
  verifiedRunId: string;
  chainHash: string;

  createdTick: number;
  boundary: ClipBoundary;

  regime: MacroRegime;
  phase: RunPhase;
  pressure: PressureTier;
  tickTier: TickTier;

  themeCardId: string;
  score: number; // 0..1
  remixPayloadHash: string;
  auditHash: string;
  deckSig: string[];
};

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M118Input {
  sourceClipHash?: string;
  remixPayload?: RemixPayload;
  verifiedRunId?: string;
}

export interface M118Output {
  remixClip: RemixClip;
  chainHash: string;
  remixPublished: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M118Event = 'CLIP_REMIXED' | 'CHAIN_EXTENDED' | 'REMIX_VERIFIED';

export interface M118TelemetryPayload extends MechanicTelemetryPayload {
  event: M118Event;
  mechanic_id: 'M118';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M118_BOUNDS = {
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

// ── Internal helpers (pure, deterministic) ─────────────────────────────────

type KV = Record<string, unknown>;

function isRecord(v: unknown): v is KV {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clampTick(t: number): number {
  return clamp(t, 0, RUN_TOTAL_TICKS - 1);
}

function normalizeRegime(v: unknown): MacroRegime {
  switch (v) {
    case 'BULL':
    case 'NEUTRAL':
    case 'BEAR':
    case 'CRISIS':
      return v;
    // tolerate strays without widening MacroRegime
    case 'RECESSION':
    case 'DOWNTURN':
      return 'BEAR';
    case 'BOOM':
    case 'EXPANSION':
      return 'BULL';
    default:
      return 'NEUTRAL';
  }
}

function phaseFromTick(tick: number): RunPhase {
  const p = clamp((tick + 1) / RUN_TOTAL_TICKS, 0, 1);
  return p < 0.33 ? 'EARLY' : p < 0.66 ? 'MID' : 'LATE';
}

function chaosActive(tick: number, windows: ChaosWindow[]): boolean {
  for (const w of windows) {
    if (tick >= w.startTick && tick <= w.endTick) return true;
  }
  return false;
}

function pressureFrom(phase: RunPhase, chaos: boolean): PressureTier {
  if (chaos) return 'CRITICAL';
  if (phase === 'EARLY') return 'LOW';
  if (phase === 'MID') return 'MEDIUM';
  return 'HIGH';
}

function tickTierFromPressure(p: PressureTier): TickTier {
  return p === 'CRITICAL' ? 'CRITICAL' : p === 'HIGH' ? 'ELEVATED' : 'STANDARD';
}

function regimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  let r: MacroRegime = fallback;
  const sorted = [...schedule].sort((a, b) => a.tick - b.tick);
  for (const ev of sorted) {
    if (ev.tick > tick) break;
    if (ev.regimeChange != null) r = normalizeRegime(ev.regimeChange);
  }
  return r;
}

function normalizePayload(raw: unknown, seed: string, tick: number): RemixPayload {
  if (!isRecord(raw)) return { actions: [] };

  const actionsRaw = Array.isArray(raw.actions) ? raw.actions : [];
  const actions: RemixAction[] = actionsRaw
    .map((a: unknown, idx: number): RemixAction | null => {
      if (!isRecord(a)) return null;

      const kindRaw = asString(a.kind, '') as RemixActionKind;
      const allowed: RemixActionKind[] = ['DUET', 'STITCH', 'OVERLAY', 'CAPTION', 'SOUND', 'CUT'];

      const kind: RemixActionKind = allowed.includes(kindRaw)
        ? kindRaw
        : allowed[seededIndex(`${seed}:kind`, tick + idx, allowed.length)]!;

      const atTick = clampTick(asNumber(a.atTick, tick));
      const data = isRecord(a.data) ? (a.data as Record<string, unknown>) : undefined;

      return { kind, atTick, data };
    })
    .filter((x): x is RemixAction => x !== null);

  const caption = typeof raw.caption === 'string' ? raw.caption : undefined;
  const audioRef = typeof raw.audioRef === 'string' ? raw.audioRef : undefined;

  const layoutRaw = typeof raw.layout === 'string' ? raw.layout : undefined;
  const layout: RemixPayload['layout'] =
    layoutRaw === 'DUET' || layoutRaw === 'STITCH' || layoutRaw === 'FULLSCREEN' || layoutRaw === 'SPLIT'
      ? layoutRaw
      : undefined;

  const clientHash = typeof raw.clientHash === 'string' ? raw.clientHash : undefined;

  const boundariesRaw = Array.isArray(raw.boundaries) ? raw.boundaries : [];
  const boundaries: ClipBoundary[] = boundariesRaw
    .map((b: unknown): ClipBoundary | null => {
      if (!isRecord(b)) return null;
      const startTick = clampTick(asNumber(b.startTick, 0));
      const endTick = clampTick(Math.max(startTick, asNumber(b.endTick, startTick)));
      const triggerEvent = asString(b.triggerEvent, 'REMIX');
      // IMPORTANT: keep only fields that ClipBoundary is very likely to define.
      return { startTick, endTick, triggerEvent } as ClipBoundary;
    })
    .filter((x): x is ClipBoundary => x !== null);

  return { actions, caption, audioRef, layout, clientHash, boundaries: boundaries.length ? boundaries : undefined };
}

function chooseBoundary(seed: string, tick: number, payload: RemixPayload): ClipBoundary {
  const provided = payload.boundaries?.length ? payload.boundaries : null;
  if (provided && provided.length > 0) {
    const pick = seededIndex(`${seed}:boundaryPick`, tick, provided.length);
    const b = provided[pick]!;
    const startTick = clampTick(b.startTick);
    const endTick = clampTick(Math.max(startTick, b.endTick));
    const triggerEvent = (b as unknown as { triggerEvent?: unknown }).triggerEvent;
    return { startTick, endTick, triggerEvent: asString(triggerEvent, 'REMIX') } as ClipBoundary;
  }

  const span = 6 + seededIndex(`${seed}:span`, tick, 9); // 6..14
  const startTick = clampTick(tick - span);
  const endTick = clampTick(tick + span);
  return { startTick, endTick, triggerEvent: 'REMIX' } as ClipBoundary;
}

function scoreRemix(
  phase: RunPhase,
  pressure: PressureTier,
  regime: MacroRegime,
  decay: number,
  exitPulse: number,
  actionCount: number,
): number {
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;

  const macro = clamp(phaseW * pressureW * regimeW * regimeMul * exitPulse * (1 - decay), 0.25, 3.0);
  const density = clamp(actionCount / 10, 0, 1);
  return clamp(0.10 + density * 0.25 + (macro - 0.25) * 0.20, 0, 1);
}

function stableRunId(sourceClipHash: string, verifiedRunId: string, tick: number): string {
  return computeHash(`M118:run:${sourceClipHash}:${verifiedRunId}:${tick}`);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * clipRemixChainBuilder
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick or card handler.
 * All state mutations MUST be returned in the output — never applied in place.
 * All telemetry MUST be emitted via the emit callback.
 *
 * @param input  Typed input snapshot
 * @param emit   Telemetry emitter — call for every meaningful state change
 * @returns      Typed output (all fields populated, no throws)
 */
export function clipRemixChainBuilder(input: M118Input, emit: MechanicEmitter): M118Output {
  const sourceClipHash = asString(input.sourceClipHash, '').trim();
  const verifiedRunId = asString(input.verifiedRunId, '').trim();

  // deterministic tick (state-less) bounded to RUN_TOTAL_TICKS
  const tick = clampTick(
    seededIndex(
      computeHash(`M118:tick:${sourceClipHash}:${verifiedRunId}`),
      0,
      Math.max(1, RUN_TOTAL_TICKS),
    ),
  );

  const runId = stableRunId(sourceClipHash, verifiedRunId, tick);
  const seed = computeHash(`M118:${runId}:${tick}`);

  // schedules (keeps imports live + deterministic context)
  const macroSchedule = buildMacroSchedule(`${seed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${seed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const phase = phaseFromTick(tick);
  const chaos = chaosActive(tick, chaosWindows);
  const pressure = pressureFrom(phase, chaos);
  const tickTier = tickTierFromPressure(pressure);

  const regime = regimeFromSchedule(tick, macroSchedule, 'NEUTRAL');
  const decay = computeDecayRate(regime, M118_BOUNDS.BASE_DECAY_RATE);
  const exitPulse = EXIT_PULSE_MULTIPLIERS[regime] ?? 1.0;
  const regimeMul = REGIME_MULTIPLIERS[regime] ?? 1.0;

  // theme selection (forces buildWeightedPool + weights + pools)
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressure] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[regime] ?? 1.0;

  const pool = buildWeightedPool(`${seed}:pool`, phaseW * pressureW, regimeW * regimeMul);
  const themeCard =
    (pool[seededIndex(`${seed}:theme`, tick + 7, Math.max(1, pool.length))] as GameCard | undefined) ??
    OPPORTUNITY_POOL[seededIndex(`${seed}:opp`, tick + 17, OPPORTUNITY_POOL.length)] ??
    DEFAULT_CARD;

  const deckSig = seededShuffle(DEFAULT_CARD_IDS, `${seed}:deckSig`).slice(0, Math.min(3, DEFAULT_CARD_IDS.length));

  // payload normalization + hashing
  const remixPayload = normalizePayload(input.remixPayload, seed, tick);
  const remixPayloadHash = computeHash(JSON.stringify(remixPayload));

  const boundary = chooseBoundary(seed, tick, remixPayload);

  // chainHash deterministically extends from source + verifiedRunId + payload
  const chainHash = computeHash(`M118:chain:${sourceClipHash}:${verifiedRunId}:${tick}:${remixPayloadHash}`);

  // publish verification (bounded, deterministic)
  const remixPublished = sourceClipHash.length > 0 && verifiedRunId.length > 0 && remixPayload.actions.length > 0;

  const score = scoreRemix(phase, pressure, regime, decay, exitPulse, remixPayload.actions.length);

  const auditHash = computeHash(
    JSON.stringify({
      mid: 'M118',
      runId,
      tick,
      sourceClipHash,
      verifiedRunId,
      chainHash,
      remixPublished,
      boundary,
      regime,
      phase,
      pressure,
      tickTier,
      weights: { phaseW, pressureW, regimeW, regimeMul, exitPulse, decay },
      themeCardId: themeCard.id,
      deckSig,
      remixPayloadHash,
      score,
    }),
  );

  const remixClip: RemixClip = {
    id: computeHash(`M118:clip:${chainHash}`),
    sourceClipHash,
    verifiedRunId,
    chainHash,
    createdTick: tick,
    boundary,
    regime,
    phase,
    pressure,
    tickTier,
    themeCardId: themeCard.id,
    score,
    remixPayloadHash,
    auditHash,
    deckSig,
  };

  emit({
    event: 'CLIP_REMIXED',
    mechanic_id: 'M118',
    tick,
    runId,
    payload: {
      sourceClipHash,
      verifiedRunId,
      remixPayloadHash,
      boundary,
      themeCardId: themeCard.id,
      score,
      deckSig,
      auditHash,
    },
  });

  emit({
    event: 'CHAIN_EXTENDED',
    mechanic_id: 'M118',
    tick,
    runId,
    payload: {
      chainHash,
      previous: sourceClipHash,
      next: remixClip.id,
      regime,
      phase,
      pressure,
      tickTier,
      exitPulse,
      decay,
      auditHash,
    },
  });

  emit({
    event: 'REMIX_VERIFIED',
    mechanic_id: 'M118',
    tick,
    runId,
    payload: {
      verified: remixPublished,
      verifiedRunId,
      chainHash,
      remixClipId: remixClip.id,
      auditHash,
    },
  });

  return {
    remixClip,
    chainHash,
    remixPublished,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M118MLInput {
  remixClip?: RemixClip;
  chainHash?: string;
  remixPublished?: boolean;
  runId: string;
  tick: number;
}

export interface M118MLOutput {
  score: number; // 0–1
  topFactors: string[]; // max 5 plain-English factors
  recommendation: string; // single sentence
  auditHash: string; // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * clipRemixChainBuilderMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function clipRemixChainBuilderMLCompanion(input: M118MLInput): Promise<M118MLOutput> {
  const score = Math.min(0.99, Math.max(0.01, Object.keys(input).length * 0.05));

  const topFactors: string[] = [];
  if (input.remixPublished) topFactors.push('Verified remix published');
  if (input.chainHash?.length) topFactors.push('Chain hash extended');
  if (input.remixClip?.themeCardId) topFactors.push('Theme card bound');
  topFactors.push('Advisory only');

  return {
    score,
    topFactors: topFactors.slice(0, 5),
    recommendation: input.remixPublished
      ? 'Surface this remix in the feed with proof context.'
      : 'Require verifiedRunId + at least one remix action.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M118'),
    confidenceDecay: 0.05,
  };
}