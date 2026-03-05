// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m137_mid_run_hotfix_lock_no_surprise_changes_inside_a_run.ts
//
// Mechanic : M137 — Mid-Run Hotfix Lock: No Surprise Changes Inside a Run
// Family   : ops   Layer: tick_engine   Priority: 1   Batch: 3
// ML Pair  : m137a
// Deps     : M02
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

// ── Import Anchors ──────────────────────────────────────────────────────────
// Ensures the generator-wide import set is always "used" in-module (types + values).

export type M137_ImportedTypesAnchor = {
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

// ── Local Hotfix Contract (intentionally isolated; not in ./types) ──────────

export type HotfixScope = 'BALANCE' | 'BUGFIX' | 'SECURITY' | 'ECONOMY' | 'UI' | 'OPS';

export interface HotfixPayload {
  id: string;                 // stable identifier, e.g. "hf_2026_03_05_001"
  scope: HotfixScope;         // what class of changes this represents
  issuedAtISO?: string;       // audit only
  reason?: string;            // audit only
  patchHash?: string;         // deterministic hash of patch content (server-side)
  data?: Record<string, unknown>; // opaque patch details (never trusted for auth here)
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M137Input {
  activeRunId?: string;
  hotfixPayload?: HotfixPayload;
  runLockStatus?: unknown;

  // Tick context (snapshotExtractor spreads snapshot into input at runtime)
  stateTick?: number;
  stateRunPhase?: RunPhase;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
  solvencyStatus?: SolvencyStatus;
  seed?: string;

  // Optional: queued hotfix echo-backs (engine may persist + re-inject)
  queuedHotfixHash?: string;
  queuedHotfixId?: string;
}

export interface M137Output {
  hotfixQueued: boolean;
  lockEnforced: boolean;
  hotfixAppliedPostRun: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M137Event = 'HOTFIX_QUEUED' | 'RUN_LOCK_ENFORCED' | 'HOTFIX_APPLIED';

export interface M137TelemetryPayload extends MechanicTelemetryPayload {
  event: M137Event;
  mechanic_id: 'M137';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M137_BOUNDS = {
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

// ── Internal helpers (pure, deterministic) ─────────────────────────────────

function m137NormalizeRegime(r: unknown): MacroRegime {
  return (r === 'BULL' || r === 'NEUTRAL' || r === 'BEAR' || r === 'CRISIS') ? r : 'NEUTRAL';
}

function m137DerivePhase(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m137DeriveRegimeFromSchedule(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) regime = m137NormalizeRegime(ev.regimeChange);
  }
  return regime;
}

function m137InChaos(tick: number, windows: ChaosWindow[]): boolean {
  if (!windows || windows.length === 0) return false;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function m137DerivePressureTier(phase: RunPhase, inChaos: boolean, regime: MacroRegime): PressureTier {
  let score = 0;
  if (phase === 'MID') score += 1;
  if (phase === 'LATE') score += 2;
  if (inChaos) score += 2;
  if (regime === 'BEAR') score += 1;
  if (regime === 'CRISIS') score += 2;

  if (score >= 5) return 'CRITICAL';
  if (score >= 3) return 'HIGH';
  if (score >= 1) return 'MEDIUM';
  return 'LOW';
}

function m137DeriveTickTier(pressure: PressureTier, inChaos: boolean): TickTier {
  if (pressure === 'CRITICAL' || inChaos) return 'CRITICAL';
  if (pressure === 'HIGH') return 'ELEVATED';
  return 'STANDARD';
}

function m137CoerceSolvency(s: unknown): SolvencyStatus {
  return (s === 'SOLVENT' || s === 'BLEED' || s === 'WIPED') ? s : 'SOLVENT';
}

function m137Short(hash: string, n: number): string {
  const h = String(hash ?? '');
  return h.length <= n ? h : h.slice(0, n);
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * midRunHotfixLockEnforcer
 *
 * Called by MechanicsRouter inside the EngineOrchestrator tick handler.
 * No surprise changes inside a run: if a hotfix is received mid-run, it is queued
 * (audited) and must not be applied until after timer expiration.
 *
 * NOTE: This mechanic emits enforcement + queue/apply telemetry. It does not mutate
 * global state directly; downstream orchestrators should persist queue tokens if desired.
 */
export function midRunHotfixLockEnforcer(
  input: M137Input,
  emit: MechanicEmitter,
): M137Output {
  const tick = clamp(Number(input.stateTick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const nextTick = tick + 1;
  const timerExpired = nextTick >= RUN_TOTAL_TICKS;

  const runId = String(input.activeRunId ?? '').trim() || computeHash(JSON.stringify({ mid: 'M137', tick, x: input.activeRunId ?? null }));
  const baseSeed = String(input.seed ?? '').trim() || computeHash(`${runId}:M137:${tick}`);

  // Deterministic macro fabric (also ensures imports are truly used).
  const macroSchedule = buildMacroSchedule(`${baseSeed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${baseSeed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const phase: RunPhase = input.stateRunPhase ?? m137DerivePhase(tick);
  const fallbackRegime: MacroRegime = m137NormalizeRegime(input.stateMacroRegime ?? 'NEUTRAL');
  const macroRegime: MacroRegime = m137DeriveRegimeFromSchedule(tick, macroSchedule, fallbackRegime);
  const inChaos = m137InChaos(tick, chaosWindows);

  const pressureTier: PressureTier = input.statePressureTier ?? m137DerivePressureTier(phase, inChaos, macroRegime);
  const tickTier: TickTier = m137DeriveTickTier(pressureTier, inChaos);
  const solvencyStatus: SolvencyStatus = m137CoerceSolvency(input.solvencyStatus ?? 'SOLVENT');

  // Weights (must use shared weights/constants)
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;

  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M137_BOUNDS.BASE_DECAY_RATE);

  // Economy anchors (must touch pool + defaults)
  const weightedPool = buildWeightedPool(`${baseSeed}:pool`, pressureW * phaseW, regimeW * regimeMult);
  const poolPick: GameCard =
    (weightedPool[seededIndex(`${baseSeed}:pick`, tick, Math.max(1, weightedPool.length))] as GameCard | undefined) ?? DEFAULT_CARD;

  const oppPick: GameCard =
    OPPORTUNITY_POOL[seededIndex(`${baseSeed}:opp`, tick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, `${baseSeed}:deck`);
  const deckTopId = deckOrder[0] ?? DEFAULT_CARD.id;

  // Lock logic (core)
  const hasHotfix = !!input.hotfixPayload && typeof input.hotfixPayload === 'object';
  const lockEnforced = !timerExpired; // inside run, always enforce
  const applyNow = hasHotfix && timerExpired;
  const queueNow = hasHotfix && lockEnforced;

  // Deterministic queue/apply tokens (auditable; downstream can persist)
  const hotfixId = hasHotfix ? String(input.hotfixPayload!.id ?? '') : '';
  const patchHash = hasHotfix ? String(input.hotfixPayload!.patchHash ?? '') : '';
  const hotfixScope = hasHotfix ? String(input.hotfixPayload!.scope ?? 'OPS') : 'OPS';

  const hotfixEnvelopeHash = hasHotfix
    ? computeHash(JSON.stringify({ hotfixId, hotfixScope, patchHash, issuedAtISO: input.hotfixPayload!.issuedAtISO ?? null }))
    : '';

  const lockHash = computeHash(JSON.stringify({
    runId,
    tick,
    phase,
    macroRegime,
    pressureTier,
    tickTier,
    solvencyStatus,
    inChaos,
    weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
    anchors: { poolPickId: poolPick.id, oppPickId: oppPick.id, deckTopId },
    bounds: { RUN_TOTAL_TICKS, pulse: M137_BOUNDS.PULSE_CYCLE },
  }));

  const queueToken = hasHotfix ? computeHash(`${lockHash}:queue:${hotfixEnvelopeHash}:${tick}`) : '';
  const applyToken = hasHotfix ? computeHash(`${lockHash}:apply:${hotfixEnvelopeHash}:${nextTick}`) : '';

  // Severity score (audit only)
  const severity = clamp(
    (phaseW * pressureW * regimeW * regimeMult * exitPulse) * (1 - decay) * (inChaos ? 1.15 : 1.0),
    0,
    5,
  );

  const onPulse = (tick % M137_BOUNDS.PULSE_CYCLE) === 0;

  // Emit enforcement heartbeat (pulsed to reduce spam)
  if (onPulse || queueNow || applyNow) {
    emit({
      event: 'RUN_LOCK_ENFORCED',
      mechanic_id: 'M137',
      tick: nextTick,
      runId,
      payload: {
        lockEnforced,
        lockHash,
        timerExpired,
        phase,
        macroRegime,
        pressureTier,
        tickTier,
        solvencyStatus,
        inChaos,
        severity,
        decay,
        weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse },
        anchors: {
          poolPick: { id: poolPick.id, name: poolPick.name, type: poolPick.type },
          oppPick: { id: oppPick.id, name: oppPick.name, type: oppPick.type },
          deckTopId,
          deckSig: deckOrder.slice(0, Math.min(5, deckOrder.length)),
        },
        macroSchedule,
        chaosWindows,
      },
    });
  }

  // Hotfix received mid-run => queue + audit
  if (queueNow) {
    emit({
      event: 'HOTFIX_QUEUED',
      mechanic_id: 'M137',
      tick: nextTick,
      runId,
      payload: {
        hotfixId,
        scope: hotfixScope,
        patchHash: patchHash || null,
        hotfixEnvelopeHash,
        lockHash,
        queueToken,
        reason: 'Mid-run lock enforced; hotfix must be applied post-run.',
        nextTick,
        phase,
        macroRegime,
        pressureTier,
        tickTier,
        solvencyStatus,
        inChaos,
        severity,
      },
    });
  }

  // Hotfix at/after run end => apply (audit only; downstream performs actual apply)
  if (applyNow) {
    emit({
      event: 'HOTFIX_APPLIED',
      mechanic_id: 'M137',
      tick: nextTick,
      runId,
      payload: {
        hotfixId,
        scope: hotfixScope,
        patchHash: patchHash || null,
        hotfixEnvelopeHash,
        lockHash,
        applyToken,
        timerExpired,
        reason: 'Run ended; queued hotfix may now be applied safely.',
        phase,
        macroRegime,
        pressureTier,
        tickTier,
        solvencyStatus,
        inChaos,
        severity,
      },
    });
  }

  return {
    hotfixQueued: queueNow,
    lockEnforced,
    hotfixAppliedPostRun: applyNow,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M137MLInput {
  hotfixQueued?: boolean;
  lockEnforced?: boolean;
  hotfixAppliedPostRun?: boolean;
  runId: string;
  tick: number;
}

export interface M137MLOutput {
  score: number;           // 0–1
  topFactors: string[];    // max 5 plain-English factors
  recommendation: string;  // single sentence
  auditHash: string;       // SHA256(inputs+outputs+rulesVersion) (here: deterministic computeHash)
  confidenceDecay: number; // 0–1, how fast this signal should decay
}

/**
 * midRunHotfixLockEnforcerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function midRunHotfixLockEnforcerMLCompanion(
  input: M137MLInput,
): Promise<M137MLOutput> {
  const t = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const locked = Boolean(input.lockEnforced);
  const queued = Boolean(input.hotfixQueued);
  const applied = Boolean(input.hotfixAppliedPostRun);

  const base = locked ? 0.65 : 0.25;
  const delta = (queued ? 0.20 : 0) + (applied ? 0.10 : 0) - clamp(t / RUN_TOTAL_TICKS, 0, 1) * 0.05;
  const score = clamp(base + delta, 0.01, 0.99);

  const topFactors = [
    locked ? 'Run lock enforced' : 'Run lock not enforced',
    queued ? 'Hotfix queued (mid-run)' : 'No hotfix queued',
    applied ? 'Hotfix eligible post-run' : 'Hotfix not eligible post-run',
    `tick=${t}`,
  ].slice(0, 5);

  return {
    score,
    topFactors,
    recommendation: queued
      ? 'Persist the queue token and apply only after run end.'
      : locked
        ? 'Reject mid-run changes; audit any incoming hotfix payloads.'
        : 'If no active run, hotfix may be applied safely with audit.',
    auditHash: computeHash(JSON.stringify(input) + ':ml:M137'),
    confidenceDecay: 0.05,
  };
}