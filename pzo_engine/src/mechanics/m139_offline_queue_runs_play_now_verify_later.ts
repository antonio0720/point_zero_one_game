// AUTO-GENERATED, NOW MANUALLY EDITED BY ANTONIO by scripts/build_mechanics.py — DO NOT EDIT exec_hook body manually
// Density6 LLC · Point Zero One · Confidential
// pzo_engine/src/mechanics/m139_offline_queue_runs_play_now_verify_later.ts
//
// Mechanic : M139 — Offline Queue: Runs Play Now Verify Later
// Family   : ops   Layer: backend_service   Priority: 2   Batch: 3
// ML Pair  : m139a
// Deps     : M48, M46
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
// Import Anchors (types must be "used" in-module under strict builds)
// ─────────────────────────────────────────────────────────────────────────────

export type M139_ImportedTypesAnchor = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Offline Queue Contracts (local; backend_service layer evolves independently)
// ─────────────────────────────────────────────────────────────────────────────

export type OfflineEventKind =
  | 'TICK'
  | 'CARD_PLAYED'
  | 'PURCHASE'
  | 'SALE'
  | 'SHIELD'
  | 'EXIT'
  | 'PROOF'
  | 'TELEMETRY';

export interface OfflineRunEvent {
  /** Tick this event occurred on (0..RUN_TOTAL_TICKS-1) */
  tick: number;
  /** Human-readable kind */
  kind: OfflineEventKind;
  /** Opaque payload (never trusted for auth; used for deterministic verification replay) */
  payload?: Record<string, unknown>;
  /** Optional client-side hash for quicker dedupe (not trusted) */
  clientHash?: string;
}

export interface OfflineRunPayload {
  /** Client-assigned run id (may be empty; server can derive deterministically) */
  runId?: string;
  /** Deterministic seed used by the client run (required for verify-later replay) */
  seed: string;
  /** Client identity hints (audit only) */
  clientId?: string;
  deviceId?: string;
  /** Creation time (audit only) */
  createdAtMs?: number;
  /** Ordered event stream (must be replayable deterministically) */
  events: OfflineRunEvent[];
  /** Optional summary */
  summary?: Record<string, unknown>;
}

export interface OfflineSyncConfig {
  /** Whether offline play/queue is allowed at all (default true) */
  allowOffline?: boolean;
  /** Whether the client/server link is currently online (default false) */
  networkOnline?: boolean;
  /** Hard cap on queue items (default 250) */
  maxQueueSize?: number;
  /** Base retry delay seconds when offline (default 15) */
  baseRetrySeconds?: number;
  /** Max retry delay seconds (default 180) */
  maxRetrySeconds?: number;
  /** Max number of runs to attempt per sync batch (default 3) */
  maxBatchRuns?: number;
  /** If true, schedule sync immediately when networkOnline=true (default true) */
  eagerWhenOnline?: boolean;
}

// ── Input / Output contracts ──────────────────────────────────────────────

export interface M139Input {
  offlineRunPayload?: OfflineRunPayload;
  verificationQueue?: unknown[];
  syncConfig?: Record<string, unknown>;

  // Optional snapshot fields (many mechanics receive these via snapshotExtractor)
  stateTick?: number;
  stateRunPhase?: RunPhase;
  stateMacroRegime?: MacroRegime;
  statePressureTier?: PressureTier;
  stateSolvencyStatus?: SolvencyStatus;
  runId?: string;
  seedSalt?: string;

  // Optional echo-back from orchestrator persistence (if stored)
  prevVerificationPending?: boolean;
  prevLastScheduledAtMs?: number;
}

export interface M139Output {
  offlineRunQueued: boolean;
  syncScheduled: boolean;
  verificationPending: boolean;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export type M139Event = 'OFFLINE_RUN_QUEUED' | 'SYNC_SCHEDULED' | 'VERIFICATION_PENDING';

export interface M139TelemetryPayload extends MechanicTelemetryPayload {
  event: M139Event;
  mechanic_id: 'M139';
}

// ── Design bounds (never mutate at runtime) ────────────────────────────────

export const M139_BOUNDS = {
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
// Internal helpers (pure, deterministic, no throws)
// ─────────────────────────────────────────────────────────────────────────────

function m139NormalizeRegime(r: unknown): MacroRegime {
  return r === 'BULL' || r === 'NEUTRAL' || r === 'BEAR' || r === 'CRISIS' ? r : 'NEUTRAL';
}

function m139DerivePhaseFromTick(tick: number): RunPhase {
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const third = Math.max(1, Math.floor(RUN_TOTAL_TICKS / 3));
  if (t < third) return 'EARLY';
  if (t < third * 2) return 'MID';
  return 'LATE';
}

function m139RegimeAtTick(tick: number, schedule: MacroEvent[], fallback: MacroRegime): MacroRegime {
  if (!schedule || schedule.length === 0) return fallback;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  const sorted = [...schedule].sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
  let regime: MacroRegime = fallback;
  for (const ev of sorted) {
    if ((ev.tick ?? 0) > t) break;
    if (ev.regimeChange) regime = m139NormalizeRegime(ev.regimeChange);
  }
  return regime;
}

function m139InChaos(tick: number, windows: ChaosWindow[]): boolean {
  if (!windows || windows.length === 0) return false;
  const t = clamp(tick, 0, RUN_TOTAL_TICKS - 1);
  for (const w of windows) {
    if (t >= w.startTick && t <= w.endTick) return true;
  }
  return false;
}

function m139CoercePressure(p: unknown): PressureTier {
  return p === 'LOW' || p === 'MEDIUM' || p === 'HIGH' || p === 'CRITICAL' ? p : 'MEDIUM';
}

function m139CoerceSolvency(s: unknown): SolvencyStatus {
  return s === 'SOLVENT' || s === 'BLEED' || s === 'WIPED' ? s : 'SOLVENT';
}

function m139ExtractSyncConfig(cfg: Record<string, unknown> | undefined): OfflineSyncConfig {
  const c = cfg ?? {};
  return {
    allowOffline: typeof c.allowOffline === 'boolean' ? c.allowOffline : true,
    networkOnline: typeof c.networkOnline === 'boolean' ? c.networkOnline : false,
    maxQueueSize: typeof c.maxQueueSize === 'number' ? c.maxQueueSize : 250,
    baseRetrySeconds: typeof c.baseRetrySeconds === 'number' ? c.baseRetrySeconds : 15,
    maxRetrySeconds: typeof c.maxRetrySeconds === 'number' ? c.maxRetrySeconds : 180,
    maxBatchRuns: typeof c.maxBatchRuns === 'number' ? c.maxBatchRuns : 3,
    eagerWhenOnline: typeof c.eagerWhenOnline === 'boolean' ? c.eagerWhenOnline : true,
  };
}

function m139QueueHashes(queue: unknown[]): Set<string> {
  const out = new Set<string>();
  for (const item of queue) {
    if (typeof item === 'string' && item.trim()) {
      out.add(item.trim());
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const h =
        (typeof o.payloadHash === 'string' && o.payloadHash.trim())
          ? o.payloadHash.trim()
          : (typeof o.runHash === 'string' && o.runHash.trim())
            ? o.runHash.trim()
            : '';
      if (h) out.add(h);
      continue;
    }
  }
  return out;
}

function m139StablePayloadHash(payload: OfflineRunPayload, salt: string): string {
  const events = Array.isArray(payload.events) ? payload.events : [];
  // normalize minimal deterministic core; do NOT trust clientHash
  const normalized = {
    seed: payload.seed,
    runId: payload.runId ?? '',
    n: events.length,
    ticks: events.map(e => clamp(Number(e.tick ?? 0), 0, RUN_TOTAL_TICKS - 1)),
    kinds: events.map(e => String(e.kind ?? 'TICK')),
    // include coarse payload shape only (keys), to prevent huge hashes and keep deterministic
    payloadKeys: events.map(e => (e.payload && typeof e.payload === 'object') ? Object.keys(e.payload).sort() : []),
  };
  return computeHash(JSON.stringify(normalized) + ':' + salt);
}

function m139BackoffSeconds(base: number, max: number, severity: number, jitterSeed: string, tick: number): number {
  const b = clamp(base, 1, 3600);
  const m = clamp(max, b, 24 * 3600);
  // severity 0..1 expands delay; jitter adds bounded variability but deterministic-by-seed
  const exp = 1 + clamp(severity, 0, 1) * 5; // 1..6
  const raw = b * exp;
  const jitter = 1 + (seededIndex(jitterSeed, tick, 21) / 100); // +0..0.20
  return Math.floor(clamp(raw * jitter, b, m));
}

// ── Exec hook ─────────────────────────────────────────────────────────────

/**
 * offlineQueueRunManager
 *
 * Backend_service contract:
 * - Offline runs can be queued immediately (play now),
 * - Verification (ledger replay) occurs later when sync is available.
 * - This mechanic NEVER mutates external state; it emits telemetry + returns booleans.
 */
export function offlineQueueRunManager(
  input: M139Input,
  emit: MechanicEmitter,
): M139Output {
  const tick = clamp(Number(input.stateTick ?? 0), 0, RUN_TOTAL_TICKS - 1);

  const syncCfg = m139ExtractSyncConfig(input.syncConfig);
  const allowOffline = Boolean(syncCfg.allowOffline);

  const queue = Array.isArray(input.verificationQueue) ? input.verificationQueue : [];
  const queueLen = queue.length;
  const maxQueue = clamp(Number(syncCfg.maxQueueSize ?? 250), 0, 50_000);

  const payload = input.offlineRunPayload;

  // deterministic runId + seedSalt
  const seedSalt = String(input.seedSalt ?? '').trim() || 'm139';
  const runId =
    (payload?.runId && String(payload.runId).trim())
      ? String(payload.runId).trim()
      : (typeof input.runId === 'string' && input.runId.trim())
        ? input.runId.trim()
        : computeHash(JSON.stringify({ mid: 'M139', tick, q: queueLen, allowOffline }));

  const baseSeed =
    (payload?.seed && String(payload.seed).trim())
      ? String(payload.seed).trim()
      : computeHash(`${runId}:${seedSalt}:M139:${tick}`);

  // deterministic macro/chaos fabric (ensures shared imports are truly live)
  const macroSchedule = buildMacroSchedule(`${baseSeed}:macro`, MACRO_EVENTS_PER_RUN);
  const chaosWindows = buildChaosWindows(`${baseSeed}:chaos`, CHAOS_WINDOWS_PER_RUN);

  const phase: RunPhase = input.stateRunPhase ?? m139DerivePhaseFromTick(tick);
  const regimeFallback: MacroRegime = m139NormalizeRegime(input.stateMacroRegime ?? 'NEUTRAL');
  const macroRegime: MacroRegime = m139RegimeAtTick(tick, macroSchedule, regimeFallback);
  const inChaos = m139InChaos(tick, chaosWindows);

  const pressureTier: PressureTier = m139CoercePressure(input.statePressureTier);
  const solvencyStatus: SolvencyStatus = m139CoerceSolvency(input.stateSolvencyStatus);

  // weights + multipliers (explicitly used)
  const phaseW = PHASE_WEIGHTS[phase] ?? 1.0;
  const pressureW = PRESSURE_WEIGHTS[pressureTier] ?? 1.0;
  const regimeW = REGIME_WEIGHTS[macroRegime] ?? 1.0;
  const regimeMult = REGIME_MULTIPLIERS[macroRegime] ?? 1.0;
  const exitPulse = EXIT_PULSE_MULTIPLIERS[macroRegime] ?? 1.0;
  const decay = computeDecayRate(macroRegime, M139_BOUNDS.BASE_DECAY_RATE);

  // economy anchors (must touch pool + defaults + ids)
  const weightedPool = buildWeightedPool(`${baseSeed}:pool`, pressureW * phaseW, regimeW * regimeMult);
  const poolPick: GameCard =
    (weightedPool[seededIndex(`${baseSeed}:pick`, tick, Math.max(1, weightedPool.length))] as GameCard | undefined) ?? DEFAULT_CARD;

  const oppPick: GameCard =
    OPPORTUNITY_POOL[seededIndex(`${baseSeed}:opp`, tick + 17, OPPORTUNITY_POOL.length)] ?? DEFAULT_CARD;

  const deckOrder = seededShuffle(DEFAULT_CARD_IDS, `${baseSeed}:deck`);
  const deckTopId = deckOrder[0] ?? DEFAULT_CARD.id;

  // Offline payload sanity + hashing
  const hasPayload = !!payload && typeof payload === 'object' && typeof payload.seed === 'string' && payload.seed.trim().length > 0;
  const payloadHash = hasPayload ? m139StablePayloadHash(payload!, seedSalt) : '';

  const existingHashes = m139QueueHashes(queue);
  const isDuplicate = payloadHash ? existingHashes.has(payloadHash) : false;

  const queueHasCapacity = queueLen < maxQueue;
  const canQueue = allowOffline && hasPayload && queueHasCapacity && !isDuplicate;

  const verificationPending = (queueLen > 0) || canQueue;
  const networkOnline = Boolean(syncCfg.networkOnline);
  const eager = Boolean(syncCfg.eagerWhenOnline);

  // severity influences backoff (deterministic); chaos + crisis tighten scheduling pressure
  const weightFactor = clamp((phaseW * pressureW * regimeW * regimeMult * exitPulse) * (1 - decay) * (inChaos ? 1.12 : 1.0), 0.25, 3.5);
  const pendingPressure = clamp(
    (verificationPending ? 0.55 : 0) +
      (queueLen / Math.max(1, maxQueue)) * 0.35 +
      (macroRegime === 'CRISIS' ? 0.15 : 0) +
      clamp((weightFactor - 1.0) * 0.10, 0, 0.20),
    0,
    1,
  );

  const baseRetry = clamp(Number(syncCfg.baseRetrySeconds ?? 15), 1, 3600);
  const maxRetry = clamp(Number(syncCfg.maxRetrySeconds ?? 180), baseRetry, 24 * 3600);
  const backoffSec = m139BackoffSeconds(baseRetry, maxRetry, pendingPressure, `${baseSeed}:jitter`, tick);

  // schedule decision
  const syncScheduled =
    verificationPending &&
    ((networkOnline && eager) || (!networkOnline && (tick % M139_BOUNDS.PULSE_CYCLE === 0)));

  const maxBatchRuns = clamp(Number(syncCfg.maxBatchRuns ?? 3), 1, 100);
  const batchCount = clamp(Math.min(queueLen + (canQueue ? 1 : 0), maxBatchRuns), 0, maxBatchRuns);

  const signatureHash = computeHash(JSON.stringify({
    mid: 'M139',
    runId,
    tick,
    allowOffline,
    hasPayload,
    payloadHash: payloadHash || null,
    isDuplicate,
    queueLen,
    maxQueue,
    canQueue,
    verificationPending,
    syncScheduled,
    networkOnline,
    eager,
    backoffSec,
    batchCount,
    phase,
    pressureTier,
    solvencyStatus,
    macroRegime,
    inChaos,
    weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
    anchors: { poolPickId: poolPick.id, oppPickId: oppPick.id, deckTopId, deckSig: deckOrder.slice(0, 5) },
    params: { MACRO_EVENTS_PER_RUN, CHAOS_WINDOWS_PER_RUN, RUN_TOTAL_TICKS },
  }));

  // ── Telemetry ────────────────────────────────────────────────────────────

  if (canQueue) {
    emit({
      event: 'OFFLINE_RUN_QUEUED',
      mechanic_id: 'M139',
      tick,
      runId,
      payload: {
        signatureHash,
        payloadHash,
        queueLenBefore: queueLen,
        queueLenAfter: queueLen + 1,
        maxQueue,
        seed: payload!.seed,
        eventCount: Array.isArray(payload!.events) ? payload!.events.length : 0,
        phase,
        macroRegime,
        inChaos,
        poolPick: { id: poolPick.id, name: poolPick.name, type: poolPick.type },
        oppPick: { id: oppPick.id, name: oppPick.name, type: oppPick.type },
        deckTopId,
      },
    });
  }

  if (syncScheduled) {
    emit({
      event: 'SYNC_SCHEDULED',
      mechanic_id: 'M139',
      tick,
      runId,
      payload: {
        signatureHash,
        networkOnline,
        eagerWhenOnline: eager,
        backoffSec: networkOnline ? 0 : backoffSec,
        batchCount,
        maxBatchRuns,
        queueLen: queueLen + (canQueue ? 1 : 0),
        macroRegime,
        phase,
        inChaos,
        weights: { phaseW, pressureW, regimeW, regimeMult, exitPulse, decay },
        macroSchedule,
        chaosWindows,
      },
    });
  }

  if (verificationPending) {
    emit({
      event: 'VERIFICATION_PENDING',
      mechanic_id: 'M139',
      tick,
      runId,
      payload: {
        signatureHash,
        pending: true,
        queueLen: queueLen + (canQueue ? 1 : 0),
        duplicateReceived: isDuplicate,
        capacity: { maxQueue, queueHasCapacity },
        solvencyStatus,
        macroRegime,
        phase,
        pressureTier,
      },
    });
  }

  return {
    offlineRunQueued: canQueue,
    syncScheduled,
    verificationPending,
  };
}

// ── ML companion hook ─────────────────────────────────────────────────────

export interface M139MLInput {
  offlineRunQueued?: boolean;
  syncScheduled?: boolean;
  verificationPending?: boolean;
  runId: string;
  tick: number;
}

export interface M139MLOutput {
  score: number;            // 0–1
  topFactors: string[];     // max 5 plain-English factors
  recommendation: string;   // single sentence
  auditHash: string;        // SHA256(inputs+outputs+rulesVersion)
  confidenceDecay: number;  // 0–1, how fast this signal should decay
}

/**
 * offlineQueueRunManagerMLCompanion
 * Async advisory — fires AFTER exec_hook, reads output, returns signals only.
 * NEVER mutates state. Results feed Case File, Intel bars, and CORD scoring.
 */
export async function offlineQueueRunManagerMLCompanion(
  input: M139MLInput,
): Promise<M139MLOutput> {
  const t = clamp(Number(input.tick ?? 0), 0, RUN_TOTAL_TICKS - 1);
  const queued = Boolean(input.offlineRunQueued);
  const scheduled = Boolean(input.syncScheduled);
  const pending = Boolean(input.verificationPending);

  const score = clamp(
    (pending ? 0.70 : 0.25) +
      (queued ? 0.10 : 0) +
      (scheduled ? 0.08 : 0) -
      clamp(t / RUN_TOTAL_TICKS, 0, 1) * 0.05,
    0.01,
    0.99,
  );

  const topFactors = [
    pending ? 'Verification pending' : 'No verification backlog',
    queued ? 'Offline run queued' : 'No new offline run',
    scheduled ? 'Sync scheduled' : 'Sync not scheduled',
    `tick=${t}`,
  ].slice(0, 5);

  const recommendation =
    pending
      ? (scheduled ? 'Proceed with verify-later batch; keep replay deterministic.' : 'Schedule sync when network is available; do not block gameplay.')
      : 'No action required; keep offline queue ready for outages.';

  return {
    score,
    topFactors,
    recommendation,
    auditHash: computeHash(JSON.stringify(input) + ':ml:M139'),
    confidenceDecay: 0.05,
  };
}