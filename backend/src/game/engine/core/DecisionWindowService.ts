/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/DecisionWindowService.ts
 *
 * Doctrine:
 * - backend owns timing legality
 * - the 12 timing classes are runtime windows, not UI hints
 * - windows are deterministic, replayable, and mode-native
 * - window state drives player agency: every open window is a real opportunity
 * - ML/DL layer extracts features from window state on every tick
 *
 * Surface summary:
 *   § 1  — Core interfaces: DecisionWindowState, WindowOpenRequest, etc.
 *   § 2  — Internal helpers: store access, normalization, timing utilities
 *   § 3  — DecisionWindowService — primary service class (all 12 timing classes)
 *   § 4  — WindowTimingPolicy — per-class configuration + overrides
 *   § 5  — WindowEventLog — audit log for window lifecycle events
 *   § 6  — WindowAnalytics — rolling analytics tracking across window lifecycle
 *   § 7  — WindowPrediction + WindowPredictor — next-window prediction engine
 *   § 8  — WindowMLVectorBuilder — 16-feature ML vector from window state
 *   § 9  — WindowDiagnosticsReport + buildWindowDiagnostics()
 *   § 10 — WindowMLContext — ML/DL enriched window snapshot for the routing layer
 *   § 11 — DecisionWindowServiceFacade — wired entry point used by the engine
 */

import type {
  ModeCode,
  PressureTier,
  RunPhase,
  TimingClass,
} from './GamePrimitives';
import type { RunStateSnapshot } from './RunStateSnapshot';
import type { TickStep } from './TickSequence';
import { cloneJson, createDeterministicId, deepFreeze } from './Deterministic';

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — Core interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionWindowState {
  id: string;
  timingClass: TimingClass;
  label: string;
  source: string;
  mode: ModeCode;
  openedAtTick: number;
  openedAtMs: number;
  closesAtTick: number | null;
  closesAtMs: number | null;
  exclusive: boolean;
  frozen: boolean;
  consumed: boolean;
  actorId: string | null;
  targetActorId: string | null;
  cardInstanceId: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface WindowOpenRequest {
  timingClass: TimingClass;
  nowMs: number;
  label: string;
  source: string;
  exclusive?: boolean;
  actorId?: string | null;
  targetActorId?: string | null;
  cardInstanceId?: string | null;
  closesAtTick?: number | null;
  closesAtMs?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface WindowReconcileInput {
  step: TickStep;
  nowMs: number;
  previousPhase?: RunPhase;
  nextPhase?: RunPhase;
  previousTier?: PressureTier;
  nextTier?: PressureTier;
}

export interface WindowAvailabilityQuery {
  actorId?: string;
  includeImplicit?: boolean;
}

/** Compact snapshot of a window for external consumption (analytics, ML, chat). */
export interface WindowSnapshot {
  readonly id: string;
  readonly timingClass: TimingClass;
  readonly label: string;
  readonly openedAtTick: number;
  readonly openedAtMs: number;
  readonly closesAtTick: number | null;
  readonly closesAtMs: number | null;
  readonly actorId: string | null;
  readonly exclusive: boolean;
  readonly consumed: boolean;
  readonly frozen: boolean;
}

/** Options for configuring the DecisionWindowService. */
export interface DecisionWindowServiceOptions {
  readonly maxWindowsPerStore?: number;
  readonly enableEventLog?: boolean;
  readonly enableAnalytics?: boolean;
  readonly enableMLVector?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

const OPEN_FOR_ALL_ACTORS = '__ALL__';

/** All 12 valid timing classes and their human labels. */
export const TIMING_CLASS_LABELS: Record<TimingClass, string> = {
  PRE:  'Pre-Play Window',
  POST: 'Post-Play Window',
  FATE: 'Fate Event Window',
  CTR:  'Counter Window',
  RES:  'Rescue Window',
  AID:  'Aid Window',
  GBM:  'Ghost Benchmark Window',
  CAS:  'Cascade Intercept Window',
  PHZ:  'Phase Boundary Window',
  PSK:  'Pressure Spike Window',
  END:  'Endgame Window',
  ANY:  'Open Window',
};

/** Ordered pressure tier values for comparison. */
const PRESSURE_TIER_ORDER: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function roundDown(value: number): number {
  return Math.trunc(value);
}

function uniqueTimingClasses(values: readonly TimingClass[]): TimingClass[] {
  return Array.from(new Set(values));
}

function isUpwardPressureTransition(
  previousTier: PressureTier | undefined,
  nextTier: PressureTier | undefined,
): boolean {
  if (!previousTier || !nextTier) return false;
  return PRESSURE_TIER_ORDER.indexOf(nextTier) > PRESSURE_TIER_ORDER.indexOf(previousTier);
}

function isEndgame(snapshot: RunStateSnapshot): boolean {
  const totalBudgetMs =
    snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
  const remainingMs = totalBudgetMs - snapshot.timers.elapsedMs;
  return remainingMs <= 30_000;
}

function getWindowStore(
  snapshot: RunStateSnapshot,
): Record<string, DecisionWindowState> {
  const raw = snapshot.timers.activeDecisionWindows;

  if (!isRecord(raw)) return {};

  const parsed: Record<string, DecisionWindowState> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;

    const timingClass = value.timingClass;
    if (typeof timingClass !== 'string') continue;

    parsed[key] = {
      id: typeof value.id === 'string' ? value.id : key,
      timingClass: timingClass as TimingClass,
      label: typeof value.label === 'string' ? value.label : key,
      source: typeof value.source === 'string' ? value.source : 'unknown',
      mode:
        typeof value.mode === 'string'
          ? (value.mode as ModeCode)
          : snapshot.mode,
      openedAtTick:
        typeof value.openedAtTick === 'number' ? value.openedAtTick : snapshot.tick,
      openedAtMs:
        typeof value.openedAtMs === 'number' ? value.openedAtMs : snapshot.timers.elapsedMs,
      closesAtTick:
        typeof value.closesAtTick === 'number' ? value.closesAtTick : null,
      closesAtMs:
        typeof value.closesAtMs === 'number' ? value.closesAtMs : null,
      exclusive: value.exclusive === true,
      frozen: value.frozen === true,
      consumed: value.consumed === true,
      actorId: typeof value.actorId === 'string' ? value.actorId : null,
      targetActorId:
        typeof value.targetActorId === 'string' ? value.targetActorId : null,
      cardInstanceId:
        typeof value.cardInstanceId === 'string' ? value.cardInstanceId : null,
      metadata: isRecord(value.metadata)
        ? (value.metadata as Record<string, string | number | boolean | null>)
        : {},
    };
  }

  return parsed;
}

function snapshotWithWindowStore(
  snapshot: RunStateSnapshot,
  store: Record<string, DecisionWindowState>,
): RunStateSnapshot {
  const next = cloneJson(snapshot);
  // Cast timers to any/unknown to satisfy type system while preserving runtime shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (next.timers as unknown as any).activeDecisionWindows = store;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (next.timers as unknown as any).frozenWindowIds = Object.values(store)
    .filter((window) => window.frozen)
    .map((window) => window.id);
  return deepFreeze(next);
}

function defaultDurationMs(
  timingClass: TimingClass,
  snapshot: RunStateSnapshot,
): number | null {
  switch (timingClass) {
    case 'PRE':
    case 'POST':
      return snapshot.timers.currentTickDurationMs;
    case 'FATE':
      return 4_000;
    case 'CTR':
      return 5_000;
    case 'RES':
    case 'AID':
      return null;
    case 'GBM':
      return snapshot.timers.currentTickDurationMs * 3;
    case 'CAS':
      return snapshot.timers.currentTickDurationMs;
    case 'PHZ':
      return snapshot.timers.currentTickDurationMs * 5;
    case 'PSK':
      return Math.min(snapshot.timers.currentTickDurationMs, 3_500);
    case 'END': {
      const totalBudgetMs =
        snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
      return Math.max(0, totalBudgetMs - snapshot.timers.elapsedMs);
    }
    case 'ANY':
      return null;
    default:
      return null;
  }
}

function implicitTimingClassesForStep(
  snapshot: RunStateSnapshot,
  step: TickStep,
): TimingClass[] {
  const values: TimingClass[] = ['ANY'];

  if (step === 'STEP_01_PREPARE') {
    values.push('PRE');
  }

  if (step === 'STEP_08_MODE_POST' as TickStep) {
    values.push('POST');
  }

  if (isEndgame(snapshot)) {
    values.push('END');
  }

  return uniqueTimingClasses(values);
}

/** Convert a DecisionWindowState to a compact WindowSnapshot. */
function toWindowSnapshot(w: DecisionWindowState): WindowSnapshot {
  return {
    id: w.id,
    timingClass: w.timingClass,
    label: w.label,
    openedAtTick: w.openedAtTick,
    openedAtMs: w.openedAtMs,
    closesAtTick: w.closesAtTick,
    closesAtMs: w.closesAtMs,
    actorId: w.actorId,
    exclusive: w.exclusive,
    consumed: w.consumed,
    frozen: w.frozen,
  };
}

/** Compute remaining window time in milliseconds (null if no deadline). */
function remainingWindowMs(w: DecisionWindowState, nowMs: number): number | null {
  if (w.closesAtMs === null) return null;
  return Math.max(0, w.closesAtMs - nowMs);
}

/** Compute pressure tier index (0–4) for normalization. */
function tierIndex(tier: PressureTier): number {
  return PRESSURE_TIER_ORDER.indexOf(tier);
}

/** Compute phase index for normalization. */
function phaseIndex(phase: RunPhase): number {
  const phases: RunPhase[] = ['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'];
  return phases.indexOf(phase);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — DecisionWindowService
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DecisionWindowService — authoritative backend service for timing window
 * management across all 12 timing classes.
 *
 * Every window open/close/consume operation is deterministic and replayable.
 * The service is stateless: all state lives in the RunStateSnapshot.
 *
 * User experience impact:
 * - Windows are the player's agency surface: each open window is a real play opportunity
 * - Exclusive windows (CTR, PSK) cannot be pre-empted by other plays
 * - The endgame window (END) marks the final 30 seconds — highest urgency UI state
 */
export class DecisionWindowService {
  private readonly _options: Required<DecisionWindowServiceOptions>;

  constructor(opts: DecisionWindowServiceOptions = {}) {
    this._options = {
      maxWindowsPerStore: opts.maxWindowsPerStore ?? 64,
      enableEventLog: opts.enableEventLog ?? false,
      enableAnalytics: opts.enableAnalytics ?? false,
      enableMLVector: opts.enableMLVector ?? false,
    };
  }

  public getOpenWindows(
    snapshot: RunStateSnapshot,
    query: WindowAvailabilityQuery = {},
  ): DecisionWindowState[] {
    const actorId = query.actorId ?? OPEN_FOR_ALL_ACTORS;
    const windows = Object.values(getWindowStore(snapshot));

    return windows.filter((window) => {
      if (window.consumed) return false;
      if (window.actorId === null) return true;
      return window.actorId === actorId;
    });
  }

  public getAvailableTimingClasses(
    snapshot: RunStateSnapshot,
    step: TickStep,
    query: WindowAvailabilityQuery = {},
  ): TimingClass[] {
    const explicit = this.getOpenWindows(snapshot, query).map(
      (window) => window.timingClass,
    );

    const implicit =
      query.includeImplicit === false
        ? []
        : implicitTimingClassesForStep(snapshot, step);

    return uniqueTimingClasses([...implicit, ...explicit]);
  }

  public isTimingClassOpen(
    snapshot: RunStateSnapshot,
    step: TickStep,
    timingClass: TimingClass,
    actorId?: string,
  ): boolean {
    return this.getAvailableTimingClasses(snapshot, step, { actorId }).includes(
      timingClass,
    );
  }

  public openWindow(
    snapshot: RunStateSnapshot,
    request: WindowOpenRequest,
  ): RunStateSnapshot {
    if (request.timingClass === 'ANY') return snapshot;

    const store = getWindowStore(snapshot);

    // Enforce max windows cap
    if (Object.keys(store).length >= this._options.maxWindowsPerStore) {
      // Evict the oldest consumed window to make room
      const oldest = Object.values(store)
        .filter((w) => w.consumed)
        .sort((a, b) => a.openedAtTick - b.openedAtTick)[0];
      if (oldest) delete store[oldest.id];
    }

    const durationMs = defaultDurationMs(request.timingClass, snapshot);

    const id = createDeterministicId(
      'decision-window',
      snapshot.runId,
      snapshot.tick,
      request.timingClass,
      request.source,
      request.actorId ?? OPEN_FOR_ALL_ACTORS,
      request.cardInstanceId ?? 'none',
    );

    const alreadyOpen = store[id];
    if (alreadyOpen && !alreadyOpen.consumed) return snapshot;

    const closesAtMs =
      request.closesAtMs === undefined
        ? durationMs === null
          ? null
          : roundDown(request.nowMs + durationMs)
        : request.closesAtMs;

    const closesAtTick =
      request.closesAtTick === undefined
        ? request.timingClass === 'PHZ'
          ? snapshot.tick + 5
          : request.timingClass === 'GBM'
            ? snapshot.tick + 3
            : request.timingClass === 'CAS'
              ? snapshot.tick + 1
              : null
        : request.closesAtTick;

    store[id] = {
      id,
      timingClass: request.timingClass,
      label: request.label,
      source: request.source,
      mode: snapshot.mode,
      openedAtTick: snapshot.tick,
      openedAtMs: request.nowMs,
      closesAtTick,
      closesAtMs,
      exclusive: request.exclusive ?? false,
      frozen: false,
      consumed: false,
      actorId: request.actorId ?? null,
      targetActorId: request.targetActorId ?? null,
      cardInstanceId: request.cardInstanceId ?? null,
      metadata: request.metadata ?? {},
    };

    return snapshotWithWindowStore(snapshot, store);
  }

  public openFateWindow(
    snapshot: RunStateSnapshot,
    nowMs: number,
    source = 'fate.event',
  ): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'FATE',
      nowMs,
      label: 'Fate Window',
      source,
      exclusive: false,
    });
  }

  public openCounterWindow(
    snapshot: RunStateSnapshot,
    nowMs: number,
    attackId: string,
    actorId?: string,
    targetActorId?: string,
  ): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'CTR',
      nowMs,
      label: 'Counter Window',
      source: `counter:${attackId}`,
      exclusive: true,
      actorId,
      targetActorId,
      metadata: { attackId },
    });
  }

  public openRescueWindow(
    snapshot: RunStateSnapshot,
    nowMs: number,
    actorId?: string,
    targetActorId?: string,
  ): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'RES',
      nowMs,
      label: 'Rescue Window',
      source: 'team.critical',
      actorId,
      targetActorId,
      exclusive: false,
    });
  }

  public openAidWindow(
    snapshot: RunStateSnapshot,
    nowMs: number,
    actorId?: string,
    targetActorId?: string,
  ): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'AID',
      nowMs,
      label: 'Aid Window',
      source: 'team.aid-request',
      actorId,
      targetActorId,
      exclusive: false,
    });
  }

  public openCascadeInterceptWindow(
    snapshot: RunStateSnapshot,
    nowMs: number,
    chainId: string,
  ): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'CAS',
      nowMs,
      label: 'Cascade Intercept Window',
      source: `cascade:${chainId}`,
      exclusive: false,
      metadata: { chainId },
    });
  }

  public openGhostBenchmarkWindow(
    snapshot: RunStateSnapshot,
    nowMs: number,
    markerId: string,
  ): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'GBM',
      nowMs,
      label: 'Ghost Benchmark Window',
      source: `legend-marker:${markerId}`,
      exclusive: false,
      metadata: { markerId },
    });
  }

  /** Open a Phase Boundary Window manually (e.g., from mode hooks). */
  public openPhaseBoundaryWindow(
    snapshot: RunStateSnapshot,
    nowMs: number,
    fromPhase: RunPhase,
    toPhase: RunPhase,
  ): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'PHZ',
      nowMs,
      label: `Phase: ${fromPhase} → ${toPhase}`,
      source: `phase:${fromPhase}->${toPhase}`,
      exclusive: false,
      closesAtTick: snapshot.tick + 5,
      metadata: {
        previousPhase: fromPhase,
        nextPhase: toPhase,
        phaseIndexFrom: phaseIndex(fromPhase),
        phaseIndexTo: phaseIndex(toPhase),
      },
    });
  }

  /** Open a Pressure Spike Window manually. */
  public openPressureSpikeWindow(
    snapshot: RunStateSnapshot,
    nowMs: number,
    fromTier: PressureTier,
    toTier: PressureTier,
  ): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'PSK',
      nowMs,
      label: `Pressure: ${fromTier} → ${toTier}`,
      source: `pressure:${fromTier}->${toTier}`,
      exclusive: false,
      closesAtMs: nowMs + Math.min(snapshot.timers.currentTickDurationMs, 3_500),
      metadata: {
        previousTier: fromTier,
        nextTier: toTier,
        tierIndexFrom: tierIndex(fromTier),
        tierIndexTo: tierIndex(toTier),
      },
    });
  }

  /** Open a Sovereignty Bid Window (SOVEREIGNTY phase only). */
  public openSovereigntyBidWindow(
    snapshot: RunStateSnapshot,
    nowMs: number,
    bidId: string,
    actorId?: string,
  ): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'ANY',
      nowMs,
      label: 'Sovereignty Bid Window',
      source: `sovereignty-bid:${bidId}`,
      actorId,
      exclusive: false,
      metadata: { bidId, phase: 'SOVEREIGNTY' },
    });
  }

  /** Open a pre-play window for the current tick. */
  public openPrePlayWindow(snapshot: RunStateSnapshot, nowMs: number, source = 'engine.tick'): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'PRE',
      nowMs,
      label: 'Pre-Play Window',
      source,
    });
  }

  /** Open a post-play window for the current tick. */
  public openPostPlayWindow(snapshot: RunStateSnapshot, nowMs: number, source = 'engine.tick'): RunStateSnapshot {
    return this.openWindow(snapshot, {
      timingClass: 'POST',
      nowMs,
      label: 'Post-Play Window',
      source,
    });
  }

  public freezeWindow(
    snapshot: RunStateSnapshot,
    windowId: string,
  ): RunStateSnapshot {
    const store = getWindowStore(snapshot);
    const existing = store[windowId];
    if (!existing) return snapshot;
    store[windowId] = { ...existing, frozen: true };
    return snapshotWithWindowStore(snapshot, store);
  }

  public unfreezeWindow(
    snapshot: RunStateSnapshot,
    windowId: string,
  ): RunStateSnapshot {
    const store = getWindowStore(snapshot);
    const existing = store[windowId];
    if (!existing) return snapshot;
    store[windowId] = { ...existing, frozen: false };
    return snapshotWithWindowStore(snapshot, store);
  }

  public consumeFirstWindowForTimingClass(
    snapshot: RunStateSnapshot,
    timingClass: TimingClass,
    actorId?: string,
  ): RunStateSnapshot {
    const store = getWindowStore(snapshot);
    const candidate = Object.values(store)
      .filter((window) => window.timingClass === timingClass && !window.consumed)
      .filter((window) => window.actorId === null || window.actorId === actorId)
      .sort((a, b) => a.openedAtTick - b.openedAtTick)[0];

    if (!candidate) return snapshot;

    store[candidate.id] = { ...candidate, consumed: true };
    return snapshotWithWindowStore(snapshot, store);
  }

  /** Consume a window by its explicit ID. */
  public consumeWindowById(
    snapshot: RunStateSnapshot,
    windowId: string,
  ): RunStateSnapshot {
    const store = getWindowStore(snapshot);
    const existing = store[windowId];
    if (!existing || existing.consumed) return snapshot;
    store[windowId] = { ...existing, consumed: true };
    return snapshotWithWindowStore(snapshot, store);
  }

  /** Bulk-close all windows of a given timing class (non-frozen, non-consumed). */
  public bulkCloseByTimingClass(
    snapshot: RunStateSnapshot,
    timingClass: TimingClass,
  ): RunStateSnapshot {
    const store = getWindowStore(snapshot);
    let changed = false;
    for (const [id, window] of Object.entries(store)) {
      if (window.timingClass === timingClass && !window.frozen && !window.consumed) {
        delete store[id];
        changed = true;
      }
    }
    if (!changed) return snapshot;
    return snapshotWithWindowStore(snapshot, store);
  }

  /** Get a single window by its ID. */
  public getWindowById(
    snapshot: RunStateSnapshot,
    windowId: string,
  ): DecisionWindowState | undefined {
    return getWindowStore(snapshot)[windowId];
  }

  /** Count all open (non-consumed) windows. */
  public countOpenWindows(snapshot: RunStateSnapshot): number {
    return Object.values(getWindowStore(snapshot)).filter((w) => !w.consumed).length;
  }

  /** Count open windows by timing class. */
  public countByTimingClass(snapshot: RunStateSnapshot): Record<TimingClass, number> {
    const counts = {} as Record<TimingClass, number>;
    for (const w of Object.values(getWindowStore(snapshot))) {
      if (!w.consumed) {
        counts[w.timingClass] = (counts[w.timingClass] ?? 0) + 1;
      }
    }
    return counts;
  }

  /** Get compact snapshots of all open windows. */
  public getWindowSnapshots(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): Array<WindowSnapshot & { remainingMs: number | null }> {
    return this.getOpenWindows(snapshot).map((w) => ({
      ...toWindowSnapshot(w),
      remainingMs: remainingWindowMs(w, nowMs),
    }));
  }

  /** Return the most urgently expiring window (shortest remainingMs, not yet expired). */
  public getMostUrgentWindow(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): DecisionWindowState | undefined {
    const open = this.getOpenWindows(snapshot).filter(
      (w) => w.closesAtMs !== null && w.closesAtMs > nowMs,
    );
    if (open.length === 0) return undefined;
    return open.reduce((min, w) =>
      (w.closesAtMs! < min.closesAtMs!) ? w : min,
    );
  }

  public closeExpiredWindows(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): RunStateSnapshot {
    const store = getWindowStore(snapshot);
    let changed = false;

    for (const [id, window] of Object.entries(store)) {
      if (window.frozen || window.consumed) continue;

      const expiredByMs =
        window.closesAtMs !== null && nowMs >= roundDown(window.closesAtMs);
      const expiredByTick =
        window.closesAtTick !== null && snapshot.tick >= window.closesAtTick;

      if (expiredByMs || expiredByTick) {
        delete store[id];
        changed = true;
      }
    }

    if (!changed) return snapshot;
    return snapshotWithWindowStore(snapshot, store);
  }

  public reconcile(
    snapshot: RunStateSnapshot,
    input: WindowReconcileInput,
  ): RunStateSnapshot {
    let next = this.closeExpiredWindows(snapshot, input.nowMs);

    if (
      snapshot.mode === 'solo' &&
      input.previousPhase &&
      input.nextPhase &&
      input.previousPhase !== input.nextPhase
    ) {
      next = this.openWindow(next, {
        timingClass: 'PHZ',
        nowMs: input.nowMs,
        label: 'Phase Boundary Window',
        source: `phase:${input.previousPhase}->${input.nextPhase}`,
        exclusive: false,
        closesAtTick: next.tick + 5,
        metadata: {
          previousPhase: input.previousPhase,
          nextPhase: input.nextPhase,
        },
      });
    }

    if (isUpwardPressureTransition(input.previousTier, input.nextTier)) {
      next = this.openWindow(next, {
        timingClass: 'PSK',
        nowMs: input.nowMs,
        label: 'Pressure Spike Window',
        source: `pressure:${String(input.previousTier)}->${String(input.nextTier)}`,
        exclusive: false,
        closesAtMs: input.nowMs + Math.min(next.timers.currentTickDurationMs, 3_500),
        metadata: {
          previousTier: input.previousTier ?? null,
          nextTier: input.nextTier ?? null,
        },
      });
    }

    if (next.mode === 'pvp' && next.battle.pendingAttacks.length > 0) {
      const newestAttack =
        next.battle.pendingAttacks[next.battle.pendingAttacks.length - 1];

      next = this.openCounterWindow(
        next,
        input.nowMs,
        newestAttack.attackId,
        null,
        'PLAYER',
      );
    }

    if (next.cascade.activeChains.length > 0) {
      const imminentChain = next.cascade.activeChains
        .filter((chain) => chain.status === 'ACTIVE')
        .sort((a, b) => a.createdAtTick - b.createdAtTick)[0];

      if (imminentChain) {
        next = this.openCascadeInterceptWindow(
          next,
          input.nowMs,
          imminentChain.chainId,
        );
      }
    }

    if (next.mode === 'ghost' && next.cards.ghostMarkers.length > 0) {
      const nearbyMarker = next.cards.ghostMarkers.find(
        (marker) => Math.abs(marker.tick - next.tick) <= 3,
      );

      if (nearbyMarker) {
        next = this.openGhostBenchmarkWindow(
          next,
          input.nowMs,
          nearbyMarker.markerId,
        );
      }
    }

    if (next.mode === 'coop') {
      const weakestLayer = next.shield.layers.find(
        (layer) => layer.layerId === next.shield.weakestLayerId,
      );

      const criticalPressure = next.pressure.tier === 'T4';
      const criticalLayer = weakestLayer ? weakestLayer.current <= 20 : false;
      const treasuryStress = next.modeState.sharedTreasuryBalance <= 5_000;

      if (criticalPressure || criticalLayer) {
        next = this.openRescueWindow(next, input.nowMs);
      }

      if (treasuryStress || next.economy.cash <= 3_000) {
        next = this.openAidWindow(next, input.nowMs);
      }
    }

    if (isEndgame(next)) {
      next = this.openWindow(next, {
        timingClass: 'END',
        nowMs: input.nowMs,
        label: 'Endgame Window',
        source: 'runtime.endgame',
        exclusive: false,
      });
    }

    next = this.closeStateResolvedWindows(next);
    return next;
  }

  private closeStateResolvedWindows(snapshot: RunStateSnapshot): RunStateSnapshot {
    const store = getWindowStore(snapshot);
    let changed = false;

    for (const [id, window] of Object.entries(store)) {
      if (window.frozen || window.consumed) continue;

      if (
        window.timingClass === 'RES' &&
        snapshot.pressure.tier !== 'T4' &&
        snapshot.shield.layers.every((layer) => layer.current > 20)
      ) {
        delete store[id];
        changed = true;
      }

      if (
        window.timingClass === 'AID' &&
        snapshot.modeState.sharedTreasuryBalance > 5_000 &&
        snapshot.economy.cash > 3_000
      ) {
        delete store[id];
        changed = true;
      }
    }

    if (!changed) return snapshot;
    return snapshotWithWindowStore(snapshot, store);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — WindowTimingPolicy
// ─────────────────────────────────────────────────────────────────────────────

/** Per-timing-class policy configuration. */
export interface WindowTimingPolicyEntry {
  readonly timingClass: TimingClass;
  readonly defaultDurationMs: number | null;
  readonly maxOpenSimultaneous: number;
  readonly exclusive: boolean;
  readonly autoCloseOnPhaseChange: boolean;
  readonly autoCloseOnTierChange: boolean;
  readonly modeRestriction: readonly ModeCode[] | 'all';
  readonly urgencyWeight: number;
}

/** Full timing policy registry. */
export const WINDOW_TIMING_POLICY: Record<TimingClass, WindowTimingPolicyEntry> = {
  PRE:  { timingClass: 'PRE',  defaultDurationMs: null,    maxOpenSimultaneous: 1,  exclusive: false, autoCloseOnPhaseChange: false, autoCloseOnTierChange: false, modeRestriction: 'all',                 urgencyWeight: 0.3  },
  POST: { timingClass: 'POST', defaultDurationMs: null,    maxOpenSimultaneous: 1,  exclusive: false, autoCloseOnPhaseChange: false, autoCloseOnTierChange: false, modeRestriction: 'all',                 urgencyWeight: 0.2  },
  FATE: { timingClass: 'FATE', defaultDurationMs: 4_000,   maxOpenSimultaneous: 3,  exclusive: false, autoCloseOnPhaseChange: false, autoCloseOnTierChange: false, modeRestriction: 'all',                 urgencyWeight: 0.6  },
  CTR:  { timingClass: 'CTR',  defaultDurationMs: 5_000,   maxOpenSimultaneous: 1,  exclusive: true,  autoCloseOnPhaseChange: false, autoCloseOnTierChange: false, modeRestriction: ['pvp'],               urgencyWeight: 0.95 },
  RES:  { timingClass: 'RES',  defaultDurationMs: null,    maxOpenSimultaneous: 1,  exclusive: false, autoCloseOnPhaseChange: false, autoCloseOnTierChange: false, modeRestriction: ['coop'],              urgencyWeight: 0.9  },
  AID:  { timingClass: 'AID',  defaultDurationMs: null,    maxOpenSimultaneous: 1,  exclusive: false, autoCloseOnPhaseChange: false, autoCloseOnTierChange: false, modeRestriction: ['coop'],              urgencyWeight: 0.7  },
  GBM:  { timingClass: 'GBM',  defaultDurationMs: null,    maxOpenSimultaneous: 2,  exclusive: false, autoCloseOnPhaseChange: true,  autoCloseOnTierChange: false, modeRestriction: ['ghost'],             urgencyWeight: 0.65 },
  CAS:  { timingClass: 'CAS',  defaultDurationMs: null,    maxOpenSimultaneous: 5,  exclusive: false, autoCloseOnPhaseChange: false, autoCloseOnTierChange: false, modeRestriction: 'all',                 urgencyWeight: 0.8  },
  PHZ:  { timingClass: 'PHZ',  defaultDurationMs: null,    maxOpenSimultaneous: 1,  exclusive: false, autoCloseOnPhaseChange: false, autoCloseOnTierChange: false, modeRestriction: ['solo'],              urgencyWeight: 0.75 },
  PSK:  { timingClass: 'PSK',  defaultDurationMs: 3_500,   maxOpenSimultaneous: 1,  exclusive: false, autoCloseOnPhaseChange: false, autoCloseOnTierChange: true,  modeRestriction: 'all',                 urgencyWeight: 0.85 },
  END:  { timingClass: 'END',  defaultDurationMs: null,    maxOpenSimultaneous: 1,  exclusive: false, autoCloseOnPhaseChange: false, autoCloseOnTierChange: false, modeRestriction: 'all',                 urgencyWeight: 1.0  },
  ANY:  { timingClass: 'ANY',  defaultDurationMs: null,    maxOpenSimultaneous: 10, exclusive: false, autoCloseOnPhaseChange: false, autoCloseOnTierChange: false, modeRestriction: 'all',                 urgencyWeight: 0.1  },
};

/** Compute the aggregate urgency score from all open windows. */
export function computeWindowUrgency(openWindows: readonly DecisionWindowState[]): number {
  if (openWindows.length === 0) return 0;
  const scores = openWindows.map((w) => WINDOW_TIMING_POLICY[w.timingClass]?.urgencyWeight ?? 0.1);
  return Math.min(1, Math.max(...scores));
}

/** Check if a mode restriction is compatible with the current mode. */
export function isModeEligibleForTimingClass(
  timingClass: TimingClass,
  mode: ModeCode,
): boolean {
  const policy = WINDOW_TIMING_POLICY[timingClass];
  if (!policy) return true;
  if (policy.modeRestriction === 'all') return true;
  return policy.modeRestriction.includes(mode);
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — WindowEventLog
// ─────────────────────────────────────────────────────────────────────────────

/** The kind of window lifecycle event. */
export type WindowEventKind =
  | 'opened'
  | 'closed_expired'
  | 'closed_consumed'
  | 'closed_bulk'
  | 'frozen'
  | 'unfrozen'
  | 'reconciled';

/** A single window lifecycle event. */
export interface WindowEvent {
  readonly eventId: string;
  readonly kind: WindowEventKind;
  readonly windowId: string;
  readonly timingClass: TimingClass;
  readonly tick: number;
  readonly nowMs: number;
  readonly actorId: string | null;
  readonly metadata: Record<string, string | number | boolean | null>;
}

/**
 * WindowEventLog — append-only audit trail for all window lifecycle events.
 *
 * Used to:
 * - Reconstruct window history for replay verification
 * - Drive post-run analytics (how many windows went unconsumed?)
 * - Feed the ML feature extraction layer
 */
export class WindowEventLog {
  private _events: WindowEvent[] = [];
  private readonly _maxEvents: number;

  constructor(maxEvents = 10000) {
    this._maxEvents = maxEvents;
  }

  private _append(event: WindowEvent): void {
    if (this._events.length >= this._maxEvents) this._events.shift();
    this._events.push(event);
  }

  recordOpen(
    window: DecisionWindowState,
    tick: number,
    nowMs: number,
  ): void {
    const eventId = createDeterministicId('window-event', window.id, String(tick), 'opened');
    this._append({
      eventId,
      kind: 'opened',
      windowId: window.id,
      timingClass: window.timingClass,
      tick,
      nowMs,
      actorId: window.actorId,
      metadata: {},
    });
  }

  recordExpiredClose(windowId: string, timingClass: TimingClass, tick: number, nowMs: number): void {
    const eventId = createDeterministicId('window-event', windowId, String(tick), 'closed_expired');
    this._append({
      eventId,
      kind: 'closed_expired',
      windowId,
      timingClass,
      tick,
      nowMs,
      actorId: null,
      metadata: {},
    });
  }

  recordConsumed(windowId: string, timingClass: TimingClass, tick: number, nowMs: number, actorId: string | null): void {
    const eventId = createDeterministicId('window-event', windowId, String(tick), 'closed_consumed');
    this._append({
      eventId,
      kind: 'closed_consumed',
      windowId,
      timingClass,
      tick,
      nowMs,
      actorId,
      metadata: {},
    });
  }

  recordReconcile(tick: number, nowMs: number, windowsOpened: number, windowsClosed: number): void {
    const eventId = createDeterministicId('window-event', 'reconcile', String(tick));
    this._append({
      eventId,
      kind: 'reconciled',
      windowId: 'reconcile',
      timingClass: 'ANY',
      tick,
      nowMs,
      actorId: null,
      metadata: { windowsOpened, windowsClosed },
    });
  }

  getByKind(kind: WindowEventKind): WindowEvent[] {
    return this._events.filter((e) => e.kind === kind);
  }

  getByTimingClass(timingClass: TimingClass): WindowEvent[] {
    return this._events.filter((e) => e.timingClass === timingClass);
  }

  getSince(tick: number): WindowEvent[] {
    return this._events.filter((e) => e.tick >= tick);
  }

  getLatest(n = 20): WindowEvent[] {
    return this._events.slice(-n);
  }

  computeLogHash(): string {
    // Simple non-crypto hash for event log integrity
    const encoded = this._events.map((e) => `${e.eventId}:${e.kind}:${e.windowId}`).join('|');
    let h = 0;
    for (let i = 0; i < encoded.length; i++) {
      h = Math.imul(31, h) + encoded.charCodeAt(i) | 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  get eventCount(): number { return this._events.length; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — WindowAnalytics
// ─────────────────────────────────────────────────────────────────────────────

/** Per-timing-class analytics bucket. */
export interface WindowClassAnalytics {
  readonly timingClass: TimingClass;
  readonly totalOpened: number;
  readonly totalConsumed: number;
  readonly totalExpired: number;
  readonly consumptionRate: number;
  readonly avgOpenDurationMs: number;
}

/** Full window analytics snapshot for a run. */
export interface WindowAnalytics {
  readonly tick: number;
  readonly totalWindowsOpened: number;
  readonly totalWindowsConsumed: number;
  readonly totalWindowsExpired: number;
  readonly overallConsumptionRate: number;
  readonly byClass: readonly WindowClassAnalytics[];
  readonly exclusiveWindowsUsed: number;
  readonly urgencyPeaks: number;
}

/**
 * WindowAnalyticsTracker — rolling analytics tracker for window lifecycle.
 *
 * The consumption rate is a key UX metric: low consumption means the player
 * is missing opportunities. High consumption means the player is engaged.
 */
export class WindowAnalyticsTracker {
  private _openedByClass = new Map<TimingClass, number>();
  private _consumedByClass = new Map<TimingClass, number>();
  private _expiredByClass = new Map<TimingClass, number>();
  private _openDurationSumByClass = new Map<TimingClass, number>();
  private _exclusiveWindowsUsed = 0;
  private _urgencyPeaks = 0;

  recordOpen(timingClass: TimingClass): void {
    this._openedByClass.set(timingClass, (this._openedByClass.get(timingClass) ?? 0) + 1);
  }

  recordConsumed(timingClass: TimingClass, durationMs: number): void {
    this._consumedByClass.set(timingClass, (this._consumedByClass.get(timingClass) ?? 0) + 1);
    this._openDurationSumByClass.set(
      timingClass,
      (this._openDurationSumByClass.get(timingClass) ?? 0) + durationMs,
    );
    const policy = WINDOW_TIMING_POLICY[timingClass];
    if (policy?.exclusive) this._exclusiveWindowsUsed++;
  }

  recordExpired(timingClass: TimingClass): void {
    this._expiredByClass.set(timingClass, (this._expiredByClass.get(timingClass) ?? 0) + 1);
  }

  recordUrgencyPeak(): void {
    this._urgencyPeaks++;
  }

  buildAnalytics(tick: number): WindowAnalytics {
    const allClasses = new Set([
      ...this._openedByClass.keys(),
      ...this._consumedByClass.keys(),
      ...this._expiredByClass.keys(),
    ]);

    const byClass: WindowClassAnalytics[] = Array.from(allClasses).map((tc) => {
      const opened = this._openedByClass.get(tc) ?? 0;
      const consumed = this._consumedByClass.get(tc) ?? 0;
      const expired = this._expiredByClass.get(tc) ?? 0;
      const durationSum = this._openDurationSumByClass.get(tc) ?? 0;
      return {
        timingClass: tc,
        totalOpened: opened,
        totalConsumed: consumed,
        totalExpired: expired,
        consumptionRate: opened > 0 ? consumed / opened : 0,
        avgOpenDurationMs: consumed > 0 ? durationSum / consumed : 0,
      };
    });

    const totalOpened = byClass.reduce((s, c) => s + c.totalOpened, 0);
    const totalConsumed = byClass.reduce((s, c) => s + c.totalConsumed, 0);
    const totalExpired = byClass.reduce((s, c) => s + c.totalExpired, 0);

    return {
      tick,
      totalWindowsOpened: totalOpened,
      totalWindowsConsumed: totalConsumed,
      totalWindowsExpired: totalExpired,
      overallConsumptionRate: totalOpened > 0 ? totalConsumed / totalOpened : 0,
      byClass,
      exclusiveWindowsUsed: this._exclusiveWindowsUsed,
      urgencyPeaks: this._urgencyPeaks,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — WindowPrediction + WindowPredictor
// ─────────────────────────────────────────────────────────────────────────────

/** Prediction confidence level. */
export type PredictionConfidence = 'high' | 'medium' | 'low';

/** A predicted upcoming window opening. */
export interface WindowPrediction {
  readonly timingClass: TimingClass;
  readonly estimatedTick: number;
  readonly confidence: PredictionConfidence;
  readonly reason: string;
  readonly urgencyIfOpened: number;
}

/**
 * WindowPredictor — predicts upcoming window openings based on current game state.
 *
 * Predictions are non-binding signals used by:
 * - The ML routing layer (as features in the DL input vector)
 * - The chat system (generating anticipatory AI commentary)
 * - The UX layer (pre-rendering window UI elements)
 */
export class WindowPredictor {
  /**
   * Predict windows likely to open in the next N ticks based on snapshot.
   */
  static predict(
    snapshot: RunStateSnapshot,
    nowMs: number,
    lookaheadTicks = 5,
  ): WindowPrediction[] {
    const predictions: WindowPrediction[] = [];
    const tier = snapshot.pressure.tier;
    const phase = snapshot.phase as RunPhase;

    // Endgame prediction
    const totalBudgetMs = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const remainingMs = totalBudgetMs - snapshot.timers.elapsedMs - nowMs;
    if (remainingMs > 0 && remainingMs <= 60_000) {
      predictions.push({
        timingClass: 'END',
        estimatedTick: snapshot.tick + Math.floor(remainingMs / snapshot.timers.currentTickDurationMs),
        confidence: 'high',
        reason: 'Endgame approaching — less than 60s remaining',
        urgencyIfOpened: 1.0,
      });
    }

    // Phase transition prediction (ESCALATION approaching)
    if (phase === 'FOUNDATION') {
      // Safely handle optional targetNetWorth (may not exist on EconomyState)
      const rawTarget = (snapshot.economy as any).targetNetWorth;
      const targetNetWorth =
        typeof rawTarget === 'number' ? rawTarget : Math.max(snapshot.economy.cash ?? 1, 1);
      const econHealth = snapshot.economy.netWorth / Math.max(targetNetWorth, 1);
      if (econHealth > 0.5) {
        predictions.push({
          timingClass: 'PHZ',
          estimatedTick: snapshot.tick + 10,
          confidence: 'medium',
          reason: 'Economy progressing — ESCALATION phase approaching',
          urgencyIfOpened: 0.75,
        });
      }
    }

    // Pressure spike prediction
    if (tier === 'T2' || tier === 'T3') {
      predictions.push({
        timingClass: 'PSK',
        estimatedTick: snapshot.tick + lookaheadTicks,
        confidence: 'medium',
        reason: `Pressure at ${tier} — spike window likely at tier crossing`,
        urgencyIfOpened: 0.85,
      });
    }

    // Cascade intercept prediction
    const cascadeRiskScore = (snapshot.cascade as any).riskScore ?? 0;
    if (cascadeRiskScore > 0.6) {
      predictions.push({
        timingClass: 'CAS',
        estimatedTick: snapshot.tick + 2,
        confidence: cascadeRiskScore > 0.8 ? 'high' : 'medium',
        reason: `High cascade risk (${cascadeRiskScore.toFixed(2)})`,
        urgencyIfOpened: 0.8,
      });
    }

    // Counter window prediction (PvP)
    if (snapshot.mode === 'pvp' && snapshot.battle.pendingAttacks.length > 0) {
      predictions.push({
        timingClass: 'CTR',
        estimatedTick: snapshot.tick + 1,
        confidence: 'high',
        reason: 'Pending attacks in PvP battle queue',
        urgencyIfOpened: 0.95,
      });
    }

    // Rescue window prediction (Coop)
    if (snapshot.mode === 'coop' && (tier === 'T3' || tier === 'T4')) {
      predictions.push({
        timingClass: 'RES',
        estimatedTick: snapshot.tick + 1,
        confidence: 'high',
        reason: 'Critical pressure in coop mode',
        urgencyIfOpened: 0.9,
      });
    }

    // Ghost benchmark prediction
    if (snapshot.mode === 'ghost' && snapshot.cards.ghostMarkers.length > 0) {
      const nearbyMarker = snapshot.cards.ghostMarkers.find(
        (m) => m.tick > snapshot.tick && m.tick <= snapshot.tick + lookaheadTicks,
      );
      if (nearbyMarker) {
        predictions.push({
          timingClass: 'GBM',
          estimatedTick: nearbyMarker.tick,
          confidence: 'high',
          reason: `Legend marker at tick ${nearbyMarker.tick}`,
          urgencyIfOpened: 0.65,
        });
      }
    }

    return predictions.sort((a, b) => a.estimatedTick - b.estimatedTick);
  }

  /** Predict whether an urgent window is coming in the next 3 ticks. */
  static isHighUrgencyImminent(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): boolean {
    const predictions = WindowPredictor.predict(snapshot, nowMs, 3);
    return predictions.some(
      (p) => p.urgencyIfOpened >= 0.85 && p.confidence !== 'low',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — WindowMLVectorBuilder
// ─────────────────────────────────────────────────────────────────────────────

/** Feature labels for the decision window ML vector. */
export const WINDOW_ML_FEATURE_LABELS: readonly string[] = [
  'open_window_count_norm',      // 0: open windows / 10
  'consumed_window_ratio',       // 1: consumed / total this tick
  'exclusive_window_active',     // 2: 1 if any exclusive window open
  'urgency_score',               // 3: peak urgency of all open windows
  'endgame_window_active',       // 4: 1 if END window is open
  'cascade_window_active',       // 5: 1 if CAS window is open
  'counter_window_active',       // 6: 1 if CTR window is open
  'rescue_window_active',        // 7: 1 if RES window is open
  'phase_window_active',         // 8: 1 if PHZ window is open
  'pressure_spike_active',       // 9: 1 if PSK window is open
  'fate_window_active',          // 10: 1 if FATE window is open
  'mode_eligible_windows_norm',  // 11: mode-eligible open windows / 5
  'high_urgency_imminent',       // 12: 1 if urgent window predicted in 3 ticks
  'window_prediction_count_norm',// 13: predicted windows / 5
  'avg_remaining_ms_norm',       // 14: avg remaining window time / 10000ms
  'expired_window_rate_norm',    // 15: expired windows this tick / 5
] as const;

/** The decision window ML feature vector. */
export interface WindowMLVector {
  readonly features: readonly number[];
  readonly labels: readonly string[];
  readonly tick: number;
  readonly urgencyScore: number;
  readonly hasExclusiveWindow: boolean;
}

/**
 * WindowMLVectorBuilder — produces the 16-feature ML vector from current
 * window state and predictions.
 */
export class WindowMLVectorBuilder {
  static readonly FEATURE_COUNT = WINDOW_ML_FEATURE_LABELS.length;

  static build(
    snapshot: RunStateSnapshot,
    nowMs: number,
    analytics: WindowAnalytics,
    predictions: readonly WindowPrediction[],
  ): WindowMLVector {
    const open = Object.values(getWindowStore(snapshot)).filter((w) => !w.consumed);
    const countByClass: Partial<Record<TimingClass, number>> = {};
    for (const w of open) {
      countByClass[w.timingClass] = (countByClass[w.timingClass] ?? 0) + 1;
    }

    const hasExclusive = open.some((w) => w.exclusive);
    const urgency = computeWindowUrgency(open);

    const remainingMsList = open
      .map((w) => remainingWindowMs(w, nowMs))
      .filter((r): r is number => r !== null);
    const avgRemainingMs = remainingMsList.length > 0
      ? remainingMsList.reduce((s, r) => s + r, 0) / remainingMsList.length
      : 0;

    const modeEligible = open.filter((w) =>
      isModeEligibleForTimingClass(w.timingClass, snapshot.mode),
    ).length;

    const features: number[] = [
      Math.min(open.length / 10, 1),
      analytics.overallConsumptionRate,
      hasExclusive ? 1 : 0,
      urgency,
      countByClass['END'] ? 1 : 0,
      countByClass['CAS'] ? 1 : 0,
      countByClass['CTR'] ? 1 : 0,
      countByClass['RES'] ? 1 : 0,
      countByClass['PHZ'] ? 1 : 0,
      countByClass['PSK'] ? 1 : 0,
      countByClass['FATE'] ? 1 : 0,
      Math.min(modeEligible / 5, 1),
      WindowPredictor.isHighUrgencyImminent(snapshot, nowMs) ? 1 : 0,
      Math.min(predictions.length / 5, 1),
      Math.min(avgRemainingMs / 10000, 1),
      Math.min(analytics.totalWindowsExpired / 5, 1),
    ];

    return {
      features,
      labels: WINDOW_ML_FEATURE_LABELS,
      tick: snapshot.tick,
      urgencyScore: urgency,
      hasExclusiveWindow: hasExclusive,
    };
  }

  static zero(tick: number): WindowMLVector {
    return {
      features: new Array<number>(WindowMLVectorBuilder.FEATURE_COUNT).fill(0),
      labels: WINDOW_ML_FEATURE_LABELS,
      tick,
      urgencyScore: 0,
      hasExclusiveWindow: false,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — WindowDiagnosticsReport
// ─────────────────────────────────────────────────────────────────────────────

/** Health status of the window system. */
export type WindowSystemHealth = 'HEALTHY' | 'DEGRADED' | 'OVERLOADED';

/** Diagnostics report for the decision window subsystem. */
export interface WindowDiagnosticsReport {
  readonly tick: number;
  readonly health: WindowSystemHealth;
  readonly openWindowCount: number;
  readonly maxWindowsCap: number;
  readonly capUsageRatio: number;
  readonly exclusiveWindowCount: number;
  readonly frozenWindowCount: number;
  readonly consumedWindowCount: number;
  readonly expiredThisTick: number;
  readonly urgencyScore: number;
  readonly hasEndgameWindow: boolean;
  readonly hasCriticalWindow: boolean;
  readonly warnings: readonly string[];
  readonly analytics: WindowAnalytics;
}

/** Build a diagnostics report for the window subsystem. */
export function buildWindowDiagnosticsReport(
  snapshot: RunStateSnapshot,
  nowMs: number,
  analytics: WindowAnalytics,
  maxWindowsCap: number,
  expiredThisTick: number,
): WindowDiagnosticsReport {
  const store = getWindowStore(snapshot);
  const all = Object.values(store);
  const open = all.filter((w) => !w.consumed);
  const frozen = all.filter((w) => w.frozen);
  const consumed = all.filter((w) => w.consumed);
  const exclusive = open.filter((w) => w.exclusive);
  const urgency = computeWindowUrgency(open);
  const hasEndgame = open.some((w) => w.timingClass === 'END');
  const hasCritical = urgency >= 0.85;

  const capUsage = all.length / maxWindowsCap;
  const warnings: string[] = [];

  const imminentExpiry = open.filter(
    (w) => w.closesAtMs !== null && w.closesAtMs - nowMs < 1_000 && w.closesAtMs > nowMs,
  );
  if (capUsage > 0.8) warnings.push(`Window store at ${(capUsage * 100).toFixed(0)}% capacity`);
  if (expiredThisTick > 5) warnings.push(`${expiredThisTick} windows expired this tick`);
  if (exclusive.length > 1) warnings.push('Multiple exclusive windows open simultaneously');
  if (analytics.overallConsumptionRate < 0.2) warnings.push('Low window consumption rate — player may be missing opportunities');
  if (imminentExpiry.length > 0) warnings.push(`${imminentExpiry.length} window(s) expiring within 1 second`);

  let health: WindowSystemHealth = 'HEALTHY';
  if (capUsage > 0.9 || exclusive.length > 1) health = 'OVERLOADED';
  else if (capUsage > 0.7 || warnings.length > 0) health = 'DEGRADED';

  return {
    tick: snapshot.tick,
    health,
    openWindowCount: open.length,
    maxWindowsCap,
    capUsageRatio: capUsage,
    exclusiveWindowCount: exclusive.length,
    frozenWindowCount: frozen.length,
    consumedWindowCount: consumed.length,
    expiredThisTick,
    urgencyScore: urgency,
    hasEndgameWindow: hasEndgame,
    hasCriticalWindow: hasCritical,
    warnings,
    analytics,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — WindowMLContext
// ─────────────────────────────────────────────────────────────────────────────

/** Full ML/DL context from the decision window subsystem. */
export interface WindowMLContext {
  readonly tick: number;
  readonly vector: WindowMLVector;
  readonly predictions: readonly WindowPrediction[];
  readonly urgencyScore: number;
  readonly hasExclusiveWindow: boolean;
  readonly hasEndgameWindow: boolean;
  readonly openWindowCount: number;
  readonly consumptionRate: number;
  readonly diagnostics: WindowDiagnosticsReport;
  readonly phaseName: RunPhase;
  readonly tierName: PressureTier;
}

/**
 * Build the full WindowMLContext for a tick.
 * This is the primary entry point for the ML routing layer's consumption of
 * decision window state.
 */
export function buildWindowMLContext(
  snapshot: RunStateSnapshot,
  nowMs: number,
  analytics: WindowAnalytics,
  maxWindowsCap: number,
  expiredThisTick: number,
): WindowMLContext {
  const predictions = WindowPredictor.predict(snapshot, nowMs);
  const vector = WindowMLVectorBuilder.build(snapshot, nowMs, analytics, predictions);
  const diagnostics = buildWindowDiagnosticsReport(
    snapshot, nowMs, analytics, maxWindowsCap, expiredThisTick,
  );
  const open = Object.values(getWindowStore(snapshot)).filter((w) => !w.consumed);
  const hasEndgame = open.some((w) => w.timingClass === 'END');

  return {
    tick: snapshot.tick,
    vector,
    predictions,
    urgencyScore: vector.urgencyScore,
    hasExclusiveWindow: vector.hasExclusiveWindow,
    hasEndgameWindow: hasEndgame,
    openWindowCount: open.length,
    consumptionRate: analytics.overallConsumptionRate,
    diagnostics,
    phaseName: snapshot.phase as RunPhase,
    tierName: snapshot.pressure.tier as PressureTier,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — DecisionWindowServiceFacade
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DecisionWindowServiceFacade — wired entry point that combines the core
 * DecisionWindowService with the analytics tracker, event log, and ML
 * context builder.
 *
 * This is the recommended integration point for the engine orchestrator.
 * It exposes all service methods plus:
 * - `reconcileWithML()` — reconcile + build ML context in one call
 * - `getMLContext()` — build WindowMLContext from current snapshot
 * - `getPredictions()` — get window predictions from current snapshot
 * - `getDiagnostics()` — get diagnostics report
 * - `exportWindowState()` — serialize window state for persistence
 *
 * Usage in the engine:
 *   const facade = new DecisionWindowServiceFacade({ enableAnalytics: true });
 *   const { nextSnapshot, mlContext } = facade.reconcileWithML(snapshot, input, nowMs);
 */
export class DecisionWindowServiceFacade {
  public readonly service: DecisionWindowService;
  public readonly eventLog: WindowEventLog;
  public readonly analyticsTracker: WindowAnalyticsTracker;

  private readonly _maxWindowsCap: number;

  constructor(opts: DecisionWindowServiceOptions = {}) {
    this.service = new DecisionWindowService(opts);
    this.eventLog = new WindowEventLog();
    this.analyticsTracker = new WindowAnalyticsTracker();
    this._maxWindowsCap = opts.maxWindowsPerStore ?? 64;
  }

  /**
   * Reconcile the snapshot and return both the next snapshot and the
   * full ML context for this tick.
   */
  reconcileWithML(
    snapshot: RunStateSnapshot,
    input: WindowReconcileInput,
    nowMs: number,
  ): { nextSnapshot: RunStateSnapshot; mlContext: WindowMLContext } {
    const before = Object.values(getWindowStore(snapshot));
    const nextSnapshot = this.service.reconcile(snapshot, input);
    const after = Object.values(getWindowStore(nextSnapshot));

    // Track opened windows
    const beforeIds = new Set(before.map((w) => w.id));
    const openedCount = after.filter((w) => !beforeIds.has(w.id)).length;
    for (const w of after.filter((w) => !beforeIds.has(w.id))) {
      this.analyticsTracker.recordOpen(w.timingClass);
    }

    // Track expired (present before, absent after, not consumed)
    const afterIds = new Set(after.map((w) => w.id));
    const expiredThisTick = before.filter(
      (w) => !afterIds.has(w.id) && !w.consumed,
    );
    for (const w of expiredThisTick) {
      this.analyticsTracker.recordExpired(w.timingClass);
    }

    // Log reconcile event
    this.eventLog.recordReconcile(snapshot.tick, nowMs, openedCount, expiredThisTick.length);

    // Check urgency peaks
    const urgency = computeWindowUrgency(after.filter((w) => !w.consumed));
    if (urgency >= 0.85) this.analyticsTracker.recordUrgencyPeak();

    const analytics = this.analyticsTracker.buildAnalytics(nextSnapshot.tick);
    const mlContext = buildWindowMLContext(
      nextSnapshot, nowMs, analytics, this._maxWindowsCap, expiredThisTick.length,
    );

    return { nextSnapshot, mlContext };
  }

  /** Get the ML context for the current snapshot without mutating it. */
  getMLContext(snapshot: RunStateSnapshot, nowMs: number): WindowMLContext {
    const analytics = this.analyticsTracker.buildAnalytics(snapshot.tick);
    return buildWindowMLContext(snapshot, nowMs, analytics, this._maxWindowsCap, 0);
  }

  /** Get window predictions for the current snapshot. */
  getPredictions(snapshot: RunStateSnapshot, nowMs: number): WindowPrediction[] {
    return WindowPredictor.predict(snapshot, nowMs);
  }

  /** Get diagnostics for the window subsystem. */
  getDiagnostics(snapshot: RunStateSnapshot, nowMs: number): WindowDiagnosticsReport {
    const analytics = this.analyticsTracker.buildAnalytics(snapshot.tick);
    return buildWindowDiagnosticsReport(snapshot, nowMs, analytics, this._maxWindowsCap, 0);
  }

  /**
   * Consume a window by timing class and record the event in the log.
   */
  consumeWindowWithTracking(
    snapshot: RunStateSnapshot,
    timingClass: TimingClass,
    nowMs: number,
    actorId?: string,
  ): RunStateSnapshot {
    const before = this.service.getOpenWindows(snapshot, { actorId })
      .find((w) => w.timingClass === timingClass);

    const next = this.service.consumeFirstWindowForTimingClass(snapshot, timingClass, actorId);

    if (before) {
      const durationMs = before.openedAtMs > 0 ? nowMs - before.openedAtMs : 0;
      this.analyticsTracker.recordConsumed(timingClass, durationMs);
      this.eventLog.recordConsumed(before.id, timingClass, snapshot.tick, nowMs, actorId ?? null);
    }

    return next;
  }

  /**
   * Export the current window state and analytics as a serializable object
   * for persistence or transmission.
   */
  exportWindowState(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): {
    windows: readonly WindowSnapshot[];
    analytics: WindowAnalytics;
    eventLogHash: string;
    predictions: readonly WindowPrediction[];
  } {
    const windows = this.service.getWindowSnapshots(snapshot, nowMs);
    const analytics = this.analyticsTracker.buildAnalytics(snapshot.tick);
    const predictions = this.getPredictions(snapshot, nowMs);
    return {
      windows,
      analytics,
      eventLogHash: this.eventLog.computeLogHash(),
      predictions,
    };
  }

  // Delegate core service methods
  get openWindow() { return this.service.openWindow.bind(this.service); }
  get closeExpiredWindows() { return this.service.closeExpiredWindows.bind(this.service); }
  get getOpenWindows() { return this.service.getOpenWindows.bind(this.service); }
  get isTimingClassOpen() { return this.service.isTimingClassOpen.bind(this.service); }
  get getAvailableTimingClasses() { return this.service.getAvailableTimingClasses.bind(this.service); }
  get countOpenWindows() { return this.service.countOpenWindows.bind(this.service); }
  get countByTimingClass() { return this.service.countByTimingClass.bind(this.service); }
  get getWindowById() { return this.service.getWindowById.bind(this.service); }
  get getMostUrgentWindow() { return this.service.getMostUrgentWindow.bind(this.service); }
  get bulkCloseByTimingClass() { return this.service.bulkCloseByTimingClass.bind(this.service); }
  get freezeWindow() { return this.service.freezeWindow.bind(this.service); }
  get unfreezeWindow() { return this.service.unfreezeWindow.bind(this.service); }
  get reconcile() { return this.service.reconcile.bind(this.service); }
}

/** Factory function for the DecisionWindowServiceFacade. */
export function createDecisionWindowFacade(
  opts: DecisionWindowServiceOptions = {},
): DecisionWindowServiceFacade {
  return new DecisionWindowServiceFacade(opts);
}

// ---------------------------------------------------------------------------
// DecisionWindowRollingStats — 60-tick rolling window of window activity
// ---------------------------------------------------------------------------

export interface DecisionWindowTickSnapshot {
  readonly tick: number;
  readonly openCount: number;
  readonly closedCount: number;
  readonly expiredCount: number;
  readonly urgencySum: number;
  readonly hasCritical: boolean;
}

export type DecisionWindowTrend = 'ESCALATING' | 'CLEARING' | 'STABLE';

export class DecisionWindowRollingStats {
  private readonly capacity: number;
  private readonly snapshots: DecisionWindowTickSnapshot[] = [];

  public constructor(capacity = 60) { this.capacity = capacity; }

  public record(snap: DecisionWindowTickSnapshot): void {
    if (this.snapshots.length >= this.capacity) this.snapshots.shift();
    this.snapshots.push(Object.freeze(snap));
  }

  public avgOpenCount(): number {
    if (this.snapshots.length === 0) return 0;
    return this.snapshots.reduce((s, r) => s + r.openCount, 0) / this.snapshots.length;
  }

  public avgUrgency(): number {
    if (this.snapshots.length === 0) return 0;
    const totalOpen = this.snapshots.reduce((s, r) => s + r.openCount, 0);
    const totalUrgency = this.snapshots.reduce((s, r) => s + r.urgencySum, 0);
    return totalOpen > 0 ? totalUrgency / totalOpen : 0;
  }

  public criticalRate(): number {
    if (this.snapshots.length === 0) return 0;
    return this.snapshots.filter(s => s.hasCritical).length / this.snapshots.length;
  }

  public expiryRate(): number {
    if (this.snapshots.length === 0) return 0;
    const totalClosed = this.snapshots.reduce((s, r) => s + r.closedCount, 0);
    const totalExpired = this.snapshots.reduce((s, r) => s + r.expiredCount, 0);
    return totalClosed > 0 ? totalExpired / totalClosed : 0;
  }

  public trend(): DecisionWindowTrend {
    if (this.snapshots.length < 10) return 'STABLE';
    const half = Math.floor(this.snapshots.length / 2);
    const recentAvg = this.snapshots.slice(-half).reduce((s, r) => s + r.openCount, 0) / half;
    const olderAvg = this.snapshots.slice(0, half).reduce((s, r) => s + r.openCount, 0) / half;
    const delta = recentAvg - olderAvg;
    if (delta > 1) return 'ESCALATING';
    if (delta < -1) return 'CLEARING';
    return 'STABLE';
  }

  public peakOpenCount(): number {
    if (this.snapshots.length === 0) return 0;
    return Math.max(...this.snapshots.map(s => s.openCount));
  }

  public clear(): void { this.snapshots.length = 0; }
  public size(): number { return this.snapshots.length; }
}

// ---------------------------------------------------------------------------
// DecisionWindowHealthTracker — health grade for decision window service
// ---------------------------------------------------------------------------

export type DecisionWindowHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface DecisionWindowHealthReport {
  readonly grade: DecisionWindowHealthGrade;
  readonly avgOpenCount: number;
  readonly avgUrgency: number;
  readonly criticalRate: number;
  readonly expiryRate: number;
  readonly trend: DecisionWindowTrend;
  readonly isHealthy: boolean;
  readonly isCritical: boolean;
}

export class DecisionWindowHealthTracker {
  private readonly rollingStats: DecisionWindowRollingStats;

  public constructor(rollingStats: DecisionWindowRollingStats) {
    this.rollingStats = rollingStats;
  }

  public computeGrade(): DecisionWindowHealthGrade {
    const avgOpen = this.rollingStats.avgOpenCount();
    const expiryRate = this.rollingStats.expiryRate();
    const criticalRate = this.rollingStats.criticalRate();
    const composite = (1 - Math.min(avgOpen / 20, 1)) * 0.4 + (1 - expiryRate) * 0.4 + (1 - criticalRate) * 0.2;
    if (composite >= 0.90) return 'S';
    if (composite >= 0.78) return 'A';
    if (composite >= 0.62) return 'B';
    if (composite >= 0.46) return 'C';
    if (composite >= 0.30) return 'D';
    return 'F';
  }

  public buildReport(): DecisionWindowHealthReport {
    const grade = this.computeGrade();
    return Object.freeze({
      grade,
      avgOpenCount: this.rollingStats.avgOpenCount(),
      avgUrgency: this.rollingStats.avgUrgency(),
      criticalRate: this.rollingStats.criticalRate(),
      expiryRate: this.rollingStats.expiryRate(),
      trend: this.rollingStats.trend(),
      isHealthy: grade === 'S' || grade === 'A' || grade === 'B',
      isCritical: grade === 'F' || grade === 'D',
    });
  }
}

// ---------------------------------------------------------------------------
// DecisionWindowMLExtractor — 8-feature DL vector from window history
// ---------------------------------------------------------------------------

export const DECISION_WINDOW_DL_FEATURE_LABELS: readonly string[] = Object.freeze([
  'avgOpenCount',
  'avgUrgency',
  'criticalRate',
  'expiryRate',
  'trendScore',
  'peakOpenNorm',
  'windowPressureNorm',
  'healthGradeNorm',
]);

export interface DecisionWindowDLVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly labels: readonly string[];
}

export class DecisionWindowMLExtractor {
  private readonly stats: DecisionWindowRollingStats;
  private readonly healthTracker: DecisionWindowHealthTracker;

  public constructor(stats: DecisionWindowRollingStats, healthTracker: DecisionWindowHealthTracker) {
    this.stats = stats;
    this.healthTracker = healthTracker;
  }

  public extract(tick: number): DecisionWindowDLVector {
    const avgOpen = Math.min(this.stats.avgOpenCount() / 20, 1);
    const avgUrgency = Math.min(this.stats.avgUrgency(), 1);
    const criticalRate = this.stats.criticalRate();
    const expiryRate = this.stats.expiryRate();
    const trend = this.stats.trend();
    const trendScore = trend === 'ESCALATING' ? 1 : trend === 'CLEARING' ? 0 : 0.5;
    const peakNorm = Math.min(this.stats.peakOpenCount() / 20, 1);
    const pressure = Math.min(avgOpen + criticalRate * 0.5, 1);
    const gradeToNum: Record<DecisionWindowHealthGrade, number> = { S: 1, A: 0.85, B: 0.7, C: 0.5, D: 0.3, F: 0 };
    const gradeNorm = gradeToNum[this.healthTracker.computeGrade()];

    return Object.freeze({
      tick,
      features: Object.freeze([avgOpen, avgUrgency, criticalRate, expiryRate, trendScore, peakNorm, pressure, gradeNorm]),
      labels: DECISION_WINDOW_DL_FEATURE_LABELS,
    });
  }
}

// ---------------------------------------------------------------------------
// DecisionWindowDiagnosticsService
// ---------------------------------------------------------------------------

export class DecisionWindowDiagnosticsService {
  public readonly rollingStats: DecisionWindowRollingStats;
  public readonly healthTracker: DecisionWindowHealthTracker;
  public readonly mlExtractor: DecisionWindowMLExtractor;

  public constructor() {
    this.rollingStats = new DecisionWindowRollingStats(60);
    this.healthTracker = new DecisionWindowHealthTracker(this.rollingStats);
    this.mlExtractor = new DecisionWindowMLExtractor(this.rollingStats, this.healthTracker);
  }

  public recordTick(snap: DecisionWindowTickSnapshot): void {
    this.rollingStats.record(snap);
  }

  public healthReport(): DecisionWindowHealthReport {
    return this.healthTracker.buildReport();
  }

  public mlVector(tick: number): DecisionWindowDLVector {
    return this.mlExtractor.extract(tick);
  }

  public reset(): void { this.rollingStats.clear(); }
}

// ---------------------------------------------------------------------------
// Module constants
// ---------------------------------------------------------------------------

export const DECISION_WINDOW_MODULE_VERSION = '2.0.0' as const;
export const DECISION_WINDOW_MODULE_READY = true;
export const DECISION_WINDOW_ROLLING_CAPACITY = 60 as const;
export const DECISION_WINDOW_DL_FEATURE_COUNT = DECISION_WINDOW_DL_FEATURE_LABELS.length;

// ---------------------------------------------------------------------------
// DecisionWindowEventClassifier — classifies window events for analytics
// ---------------------------------------------------------------------------

export type DecisionWindowEventKind =
  | 'OPENED'
  | 'CLOSED_RESOLVED'
  | 'CLOSED_EXPIRED'
  | 'FROZEN'
  | 'UNFROZEN'
  | 'RECONCILED';

export interface DecisionWindowEvent {
  readonly kind: DecisionWindowEventKind;
  readonly windowId: string;
  readonly tick: number;
  readonly urgency?: number;
  readonly timingClass?: string;
}

export class DecisionWindowEventLog {
  private readonly events: DecisionWindowEvent[] = [];
  private readonly maxEvents = 500;

  public record(event: DecisionWindowEvent): void {
    if (this.events.length >= this.maxEvents) this.events.shift();
    this.events.push(Object.freeze(event));
  }

  public recentEvents(limit = 20): ReadonlyArray<DecisionWindowEvent> {
    return this.events.slice(-limit);
  }

  public countByKind(kind: DecisionWindowEventKind): number {
    return this.events.filter(e => e.kind === kind).length;
  }

  public openRate(): number {
    const opens = this.countByKind('OPENED');
    const total = this.events.length;
    return total > 0 ? opens / total : 0;
  }

  public expiryRate(): number {
    const expired = this.countByKind('CLOSED_EXPIRED');
    const resolved = this.countByKind('CLOSED_RESOLVED');
    const totalClosed = expired + resolved;
    return totalClosed > 0 ? expired / totalClosed : 0;
  }

  public clear(): void { this.events.length = 0; }
}

export const DECISION_WINDOW_COMPLETE = true;
