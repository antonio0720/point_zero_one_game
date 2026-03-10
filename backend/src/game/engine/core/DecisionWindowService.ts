/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/DecisionWindowService.ts
 *
 * Doctrine:
 * - backend owns timing legality
 * - the 12 timing classes are runtime windows, not UI hints
 * - windows are deterministic, replayable, and mode-native
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

const OPEN_FOR_ALL_ACTORS = '__ALL__';

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
  if (!previousTier || !nextTier) {
    return false;
  }

  const order: PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
  return order.indexOf(nextTier) > order.indexOf(previousTier);
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

  if (!isRecord(raw)) {
    return {};
  }

  const parsed: Record<string, DecisionWindowState> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) {
      continue;
    }

    const timingClass = value.timingClass;
    if (typeof timingClass !== 'string') {
      continue;
    }

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
  (next.timers as unknown as any).activeDecisionWindows = store;
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

  if (step === 'STEP_08_MODE_POST') {
    values.push('POST');
  }

  if (isEndgame(snapshot)) {
    values.push('END');
  }

  return uniqueTimingClasses(values);
}

export class DecisionWindowService {
  public getOpenWindows(
    snapshot: RunStateSnapshot,
    query: WindowAvailabilityQuery = {},
  ): DecisionWindowState[] {
    const actorId = query.actorId ?? OPEN_FOR_ALL_ACTORS;
    const windows = Object.values(getWindowStore(snapshot));

    return windows.filter((window) => {
      if (window.consumed) {
        return false;
      }

      if (window.actorId === null) {
        return true;
      }

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
    if (request.timingClass === 'ANY') {
      return snapshot;
    }

    const store = getWindowStore(snapshot);
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
    if (alreadyOpen && !alreadyOpen.consumed) {
      return snapshot;
    }

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
      metadata: {
        attackId,
      },
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

  public freezeWindow(
    snapshot: RunStateSnapshot,
    windowId: string,
  ): RunStateSnapshot {
    const store = getWindowStore(snapshot);
    const existing = store[windowId];

    if (!existing) {
      return snapshot;
    }

    store[windowId] = {
      ...existing,
      frozen: true,
    };

    return snapshotWithWindowStore(snapshot, store);
  }

  public unfreezeWindow(
    snapshot: RunStateSnapshot,
    windowId: string,
  ): RunStateSnapshot {
    const store = getWindowStore(snapshot);
    const existing = store[windowId];

    if (!existing) {
      return snapshot;
    }

    store[windowId] = {
      ...existing,
      frozen: false,
    };

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

    if (!candidate) {
      return snapshot;
    }

    store[candidate.id] = {
      ...candidate,
      consumed: true,
    };

    return snapshotWithWindowStore(snapshot, store);
  }

  public closeExpiredWindows(
    snapshot: RunStateSnapshot,
    nowMs: number,
  ): RunStateSnapshot {
    const store = getWindowStore(snapshot);
    let changed = false;

    for (const [id, window] of Object.entries(store)) {
      if (window.frozen || window.consumed) {
        continue;
      }

      const expiredByMs =
        window.closesAtMs !== null && nowMs >= roundDown(window.closesAtMs);
      const expiredByTick =
        window.closesAtTick !== null && snapshot.tick >= window.closesAtTick;

      if (expiredByMs || expiredByTick) {
        delete store[id];
        changed = true;
      }
    }

    if (!changed) {
      return snapshot;
    }

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
      if (window.frozen || window.consumed) {
        continue;
      }

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

    if (!changed) {
      return snapshot;
    }

    return snapshotWithWindowStore(snapshot, store);
  }
}