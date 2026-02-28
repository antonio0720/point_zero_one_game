/**
 * FILE: pzo-web/src/store/engineStore.ts
 *
 * Zustand store for all engine state. Currently contains the Tension Engine slice.
 * Extend with additional engine slices as they are integrated.
 *
 * Exports:
 *   useEngineStore          — Zustand hook consumed by all React hooks
 *   TensionEngineStoreSlice — TypeScript shape of the tension slice
 *   defaultTensionSlice     — Initial/reset state
 *   tensionStoreHandlers    — EventBus → store write functions (called by EngineOrchestrator)
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  VisibilityState,
  TensionSnapshot,
  AnticipationEntry,
  TensionScoreUpdatedEvent,
  TensionVisibilityChangedEvent,
  TensionPulseFiredEvent,
  ThreatArrivedEvent,
  ThreatExpiredEvent,
} from '../engines/tension/types';

// ─────────────────────────────────────────────────────────────────────────────
// TENSION SLICE SHAPE
// ─────────────────────────────────────────────────────────────────────────────

export interface TensionEngineStoreSlice {
  tension: {
    // ── Score ──────────────────────────────────────────────────────
    score: number;                              // 0.0–1.0 current tension score
    scoreHistory: readonly number[];            // last 20 ticks

    // ── Visibility ─────────────────────────────────────────────────
    visibilityState: VisibilityState;
    previousVisibilityState: VisibilityState | null;

    // ── Queue counts ───────────────────────────────────────────────
    queueLength: number;                        // QUEUED + ARRIVED
    arrivedCount: number;                       // threats in ARRIVED state
    queuedCount: number;                        // threats in QUEUED state
    expiredCount: number;                       // total expired this run

    // ── Pulse ──────────────────────────────────────────────────────
    isPulseActive: boolean;                     // score >= 0.90
    pulseTicksActive: number;                   // consecutive ticks at pulse
    isSustainedPulse: boolean;                  // pulseTicksActive >= 3

    // ── Trend ──────────────────────────────────────────────────────
    isEscalating: boolean;                      // rising over last 3 ticks

    // ── Queue display ──────────────────────────────────────────────
    sortedQueue: AnticipationEntry[];           // sorted: ARRIVED first, then QUEUED by arrivalTick
    lastArrivedEntry: AnticipationEntry | null;
    lastExpiredEntry: AnticipationEntry | null;

    // ── Tick tracking (used by AnticipationQueuePanel countdown) ───
    currentTick: number;                        // most recent tick number from snapshot

    // ── Run lifecycle ──────────────────────────────────────────────
    isRunActive: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT STORE SHAPE
// Add other engine slices here as they are integrated.
// ─────────────────────────────────────────────────────────────────────────────

export type EngineStoreState = TensionEngineStoreSlice;

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT STATE
// ─────────────────────────────────────────────────────────────────────────────

export const defaultTensionSlice: TensionEngineStoreSlice = {
  tension: {
    score: 0.0,
    scoreHistory: [],
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
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ZUSTAND STORE
// immer middleware enables the mutation-style setters used in tensionStoreHandlers.
// ─────────────────────────────────────────────────────────────────────────────

export const useEngineStore = create<EngineStoreState>()(
  immer(
    (): EngineStoreState => ({
      ...defaultTensionSlice,
    })
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// EVENT HANDLERS
// Pure functions: (set, event) => void.
// Called by EngineOrchestrator when EventBus events fire.
// ONLY these functions write to the store — never write from components or hooks.
// ─────────────────────────────────────────────────────────────────────────────

type ZustandSet = ReturnType<typeof useEngineStore.getState> extends infer _
  ? (updater: (state: EngineStoreState) => void) => void
  : never;

export const tensionStoreHandlers = {

  /**
   * Fires every tick via TENSION_SCORE_UPDATED.
   * Lightweight per-tick update for live gauge rendering.
   */
  onScoreUpdated(set: ZustandSet, event: TensionScoreUpdatedEvent): void {
    set(state => {
      state.tension.score = event.score;
      state.tension.visibilityState = event.visibilityState;
    });
  },

  /**
   * Fires on visibility state transition.
   * Stores previous state for transition animations.
   */
  onVisibilityChanged(set: ZustandSet, event: TensionVisibilityChangedEvent): void {
    set(state => {
      state.tension.previousVisibilityState = event.from;
      state.tension.visibilityState = event.to;
    });
  },

  /**
   * Fires when score >= 0.90.
   * UI-only signal — no mechanical consequences.
   */
  onPulseFired(set: ZustandSet, event: TensionPulseFiredEvent): void {
    set(state => {
      state.tension.isPulseActive = true;
      state.tension.pulseTicksActive = event.pulseTicksActive;
      state.tension.isSustainedPulse = event.pulseTicksActive >= 3;
    });
  },

  /**
   * Fires when a QUEUED threat transitions to ARRIVED.
   * Increments live counter for badge display.
   */
  onThreatArrived(set: ZustandSet, _event: ThreatArrivedEvent): void {
    set(state => {
      state.tension.arrivedCount += 1;
    });
  },

  /**
   * Fires when a threat expires without mitigation.
   */
  onThreatExpired(set: ZustandSet, _event: ThreatExpiredEvent): void {
    set(state => {
      state.tension.expiredCount += 1;
    });
  },

  /**
   * Full snapshot sync — authoritative per-tick state update.
   * Called by EngineOrchestrator after tensionEngine.computeTension() each tick.
   * Individual event handlers above are incremental; this is the canonical sync.
   */
  onSnapshotAvailable(
    set: ZustandSet,
    snapshot: TensionSnapshot,
    sortedQueue: AnticipationEntry[]
  ): void {
    set(state => {
      state.tension.score             = snapshot.score;
      state.tension.visibilityState   = snapshot.visibilityState;
      state.tension.queueLength       = snapshot.queueLength;
      state.tension.arrivedCount      = snapshot.arrivedCount;
      state.tension.queuedCount       = snapshot.queuedCount;
      state.tension.expiredCount      = snapshot.expiredCount;
      state.tension.isPulseActive     = snapshot.isPulseActive;
      state.tension.pulseTicksActive  = snapshot.pulseTicksActive;
      state.tension.isSustainedPulse  = snapshot.pulseTicksActive >= 3;
      state.tension.isEscalating      = snapshot.isEscalating;
      state.tension.scoreHistory      = [...snapshot.scoreHistory];
      state.tension.sortedQueue       = [...sortedQueue];
      state.tension.currentTick       = snapshot.tickNumber;
      const firstArrived = sortedQueue.find(e => e.isArrived) ?? null;
      if (firstArrived !== null) {
        state.tension.lastArrivedEntry = firstArrived;
      }
    });
  },

  /** Called when a run begins. Full reset of tension slice, isRunActive → true. */
  onRunStarted(set: ZustandSet): void {
    set(state => {
      Object.assign(state.tension, {
        ...defaultTensionSlice.tension,
        isRunActive: true,
      });
    });
  },

  /** Called when a run ends (victory, defeat, or manual reset). */
  onRunEnded(set: ZustandSet): void {
    set(state => {
      state.tension.isRunActive = false;
    });
  },

  /** Called at END of each tick. Cleans up per-tick transient state. */
  onTickComplete(set: ZustandSet): void {
    set(state => {
      if (!state.tension.isPulseActive) {
        state.tension.pulseTicksActive = 0;
        state.tension.isSustainedPulse = false;
      }
    });
  },
};

/**
 * ── EngineOrchestrator wiring (copy-paste) ────────────────────────────────────
 *
 *   import { useEngineStore, tensionStoreHandlers } from '../../store/engineStore';
 *   import { PZOEventChannel } from '../../engines/core/EventBus';
 *
 *   const set = useEngineStore.setState;
 *
 *   eventBus.on(PZOEventChannel.TENSION_SCORE_UPDATED,      evt => tensionStoreHandlers.onScoreUpdated(set, evt));
 *   eventBus.on(PZOEventChannel.TENSION_VISIBILITY_CHANGED, evt => tensionStoreHandlers.onVisibilityChanged(set, evt));
 *   eventBus.on(PZOEventChannel.TENSION_PULSE_FIRED,        evt => tensionStoreHandlers.onPulseFired(set, evt));
 *   eventBus.on(PZOEventChannel.THREAT_ARRIVED,             evt => tensionStoreHandlers.onThreatArrived(set, evt));
 *   eventBus.on(PZOEventChannel.THREAT_EXPIRED,             evt => tensionStoreHandlers.onThreatExpired(set, evt));
 *
 *   // After tensionEngine.computeTension():
 *   tensionStoreHandlers.onSnapshotAvailable(set, tensionSnapshot, tensionEngine.getSortedQueue());
 *   tensionStoreHandlers.onTickComplete(set);
 *
 *   // Run lifecycle:
 *   tensionStoreHandlers.onRunStarted(set);
 *   tensionStoreHandlers.onRunEnded(set);
 */