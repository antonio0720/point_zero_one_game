/**
 * ============================================================================
 * FILE: pzo-web/src/store/slices/tensionSlice.ts
 * ============================================================================
 *
 * Purpose:
 * - extract Engine 3 tension defaults + handlers from engineStore.ts
 * - provide a hardened, reusable slice contract for future store composition
 * - preserve current repo semantics while improving isolation and immutability
 *
 * Doctrine:
 * - slice is store-only; no engine imports beyond tension types
 * - handlers accept generic Zustand-style draft setters
 * - snapshot arrays and queue entries are defensively cloned
 * - pulse / score / count values are normalized before persistence
 * ============================================================================
 */

import type {
  AnticipationEntry,
  TensionPulseFiredEvent,
  TensionScoreUpdatedEvent,
  TensionSnapshot,
  TensionVisibilityChangedEvent,
  ThreatArrivedEvent,
  ThreatExpiredEvent,
  VisibilityState,
} from '../../engines/tension/types';

export interface TensionState {
  score: number;
  scoreHistory: readonly number[];
  visibilityState: VisibilityState;
  previousVisibilityState: VisibilityState | null;
  queueLength: number;
  arrivedCount: number;
  queuedCount: number;
  expiredCount: number;
  isPulseActive: boolean;
  pulseTicksActive: number;
  isSustainedPulse: boolean;
  isEscalating: boolean;
  sortedQueue: AnticipationEntry[];
  lastArrivedEntry: AnticipationEntry | null;
  lastExpiredEntry: AnticipationEntry | null;
  currentTick: number;
  isRunActive: boolean;
}

export interface TensionEngineStoreSlice {
  tension: TensionState;
}

export interface TensionSliceContainer {
  tension: TensionState;
}

export type TensionSliceSet<State extends TensionSliceContainer = TensionSliceContainer> = (
  recipe: (state: State) => void,
) => void;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeTick(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function cloneEntry(entry: AnticipationEntry): AnticipationEntry {
  return {
    ...entry,
    mitigationCardTypes: Object.freeze([...entry.mitigationCardTypes]),
  };
}

function cloneEntryArray(entries: readonly AnticipationEntry[]): AnticipationEntry[] {
  return entries.map(cloneEntry);
}

function cloneHistory(history: readonly number[]): readonly number[] {
  return Object.freeze(history.map((value) => clampScore(value)));
}

function deriveFirstArrivedEntry(entries: readonly AnticipationEntry[]): AnticipationEntry | null {
  for (const entry of entries) {
    if (entry.isArrived) return cloneEntry(entry);
  }
  return null;
}

function resolveSustainedPulse(pulseTicksActive: number): boolean {
  return normalizeCount(pulseTicksActive) >= 3;
}

export function createDefaultTensionState(): TensionState {
  return {
    score: 0.0,
    scoreHistory: Object.freeze([]),
    visibilityState: 'SHADOWED' as VisibilityState,
    previousVisibilityState: null,
    queueLength: 0,
    arrivedCount: 0,
    queuedCount: 0,
    expiredCount: 0,
    isPulseActive: false,
    pulseTicksActive: 0,
    isSustainedPulse: false,
    isEscalating: false,
    sortedQueue: [],
    lastArrivedEntry: null,
    lastExpiredEntry: null,
    currentTick: 0,
    isRunActive: false,
  };
}

export const defaultTensionSlice: TensionEngineStoreSlice = {
  tension: createDefaultTensionState(),
};

export function resetTensionSliceDraft<State extends TensionSliceContainer>(
  state: State,
  isRunActive: boolean,
): void {
  state.tension = {
    ...createDefaultTensionState(),
    isRunActive,
  };
}

export function applyTensionSnapshotDraft<State extends TensionSliceContainer>(
  state: State,
  snapshot: TensionSnapshot,
  sortedQueue: readonly AnticipationEntry[],
): void {
  const clonedQueue = cloneEntryArray(sortedQueue);
  const pulseTicksActive = normalizeCount(snapshot.pulseTicksActive);

  state.tension.score = clampScore(snapshot.score);
  state.tension.visibilityState = snapshot.visibilityState;
  state.tension.queueLength = normalizeCount(snapshot.queueLength);
  state.tension.arrivedCount = normalizeCount(snapshot.arrivedCount);
  state.tension.queuedCount = normalizeCount(snapshot.queuedCount);
  state.tension.expiredCount = normalizeCount(snapshot.expiredCount);
  state.tension.isPulseActive = Boolean(snapshot.isPulseActive);
  state.tension.pulseTicksActive = pulseTicksActive;
  state.tension.isSustainedPulse = resolveSustainedPulse(pulseTicksActive);
  state.tension.isEscalating = Boolean(snapshot.isEscalating);
  state.tension.scoreHistory = cloneHistory(snapshot.scoreHistory);
  state.tension.sortedQueue = clonedQueue;
  state.tension.currentTick = normalizeTick(snapshot.tickNumber);
  state.tension.lastArrivedEntry = deriveFirstArrivedEntry(clonedQueue);
}

export const tensionStoreHandlers = {
  onScoreUpdated<State extends TensionSliceContainer>(
    set: TensionSliceSet<State>,
    event: TensionScoreUpdatedEvent,
  ): void {
    set((state) => {
      state.tension.score = clampScore(event.score);
      state.tension.visibilityState = event.visibilityState;
    });
  },

  onVisibilityChanged<State extends TensionSliceContainer>(
    set: TensionSliceSet<State>,
    event: TensionVisibilityChangedEvent,
  ): void {
    set((state) => {
      state.tension.previousVisibilityState = event.from;
      state.tension.visibilityState = event.to;
    });
  },

  onPulseFired<State extends TensionSliceContainer>(
    set: TensionSliceSet<State>,
    event: TensionPulseFiredEvent,
  ): void {
    const pulseTicksActive = normalizeCount(event.pulseTicksActive);

    set((state) => {
      state.tension.isPulseActive = true;
      state.tension.pulseTicksActive = pulseTicksActive;
      state.tension.isSustainedPulse = resolveSustainedPulse(pulseTicksActive);
    });
  },

  onThreatArrived<State extends TensionSliceContainer>(
    set: TensionSliceSet<State>,
    _event: ThreatArrivedEvent,
  ): void {
    set((state) => {
      state.tension.arrivedCount = normalizeCount(state.tension.arrivedCount + 1);
    });
  },

  onThreatExpired<State extends TensionSliceContainer>(
    set: TensionSliceSet<State>,
    _event: ThreatExpiredEvent,
  ): void {
    set((state) => {
      state.tension.expiredCount = normalizeCount(state.tension.expiredCount + 1);
    });
  },

  onSnapshotAvailable<State extends TensionSliceContainer>(
    set: TensionSliceSet<State>,
    snapshot: TensionSnapshot,
    sortedQueue: readonly AnticipationEntry[],
  ): void {
    set((state) => {
      applyTensionSnapshotDraft(state, snapshot, sortedQueue);
    });
  },

  onRunStarted<State extends TensionSliceContainer>(
    set: TensionSliceSet<State>,
  ): void {
    set((state) => {
      resetTensionSliceDraft(state, true);
    });
  },

  onRunEnded<State extends TensionSliceContainer>(
    set: TensionSliceSet<State>,
  ): void {
    set((state) => {
      state.tension.isRunActive = false;
      state.tension.isPulseActive = false;
      state.tension.pulseTicksActive = 0;
      state.tension.isSustainedPulse = false;
    });
  },

  onTickComplete<State extends TensionSliceContainer>(
    set: TensionSliceSet<State>,
  ): void {
    set((state) => {
      if (!state.tension.isPulseActive) {
        state.tension.pulseTicksActive = 0;
        state.tension.isSustainedPulse = false;
      } else {
        state.tension.pulseTicksActive = normalizeCount(state.tension.pulseTicksActive);
        state.tension.isSustainedPulse = resolveSustainedPulse(state.tension.pulseTicksActive);
      }

      state.tension.score = clampScore(state.tension.score);
      state.tension.queueLength = normalizeCount(state.tension.queueLength);
      state.tension.arrivedCount = normalizeCount(state.tension.arrivedCount);
      state.tension.queuedCount = normalizeCount(state.tension.queuedCount);
      state.tension.expiredCount = normalizeCount(state.tension.expiredCount);
      state.tension.currentTick = normalizeTick(state.tension.currentTick);
    });
  },
};