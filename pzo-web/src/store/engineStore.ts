// pzo-web/src/store/engineStore.ts
import { create } from 'zustand';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TimeEngineStoreState {
  /** windowId → remainingMs — updated at 10fps from DecisionTimer sync channel (T101) */
  decisionWindowRemainingMs: Record<string, number>;

  onDecisionWindowTick:  (ticks: Record<string, number>) => void;
  clearDecisionWindowTick: (windowId: string) => void;
  resetDecisionWindows:  () => void;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useTimeEngineStore = create<TimeEngineStoreState>((set) => ({
  decisionWindowRemainingMs: {},

  /**
   * T101 — Called by EngineOrchestrator on every 'decision:countdown_tick'.
   * Receives batched { windowId: remainingMs } — coalesced from all active windows.
   *
   * PERFORMANCE CONTRACT:
   *   - Only mutates state when at least one value changed (no identity churn)
   *   - Components should subscribe to a SINGLE window via selectWindowRemainingMs()
   *     so they rerender only when their window's ms changes
   */
  onDecisionWindowTick: (ticks: Record<string, number>) =>
    set((state) => {
      const current = state.decisionWindowRemainingMs;
      let changed   = false;
      for (const [id, ms] of Object.entries(ticks)) {
        if (current[id] !== ms) { changed = true; break; }
      }
      if (!changed) return state;
      return { decisionWindowRemainingMs: { ...current, ...ticks } };
    }),

  /** Remove a window from the map when resolved/nullified — prevents stale keys */
  clearDecisionWindowTick: (windowId: string) =>
    set((state) => {
      if (!(windowId in state.decisionWindowRemainingMs)) return state;
      const next = { ...state.decisionWindowRemainingMs };
      delete next[windowId];
      return { decisionWindowRemainingMs: next };
    }),

  resetDecisionWindows: () =>
    set({ decisionWindowRemainingMs: {} }),
}));

// ── Selectors ──────────────────────────────────────────────────────────────

/**
 * Fine-grained selector — component rerenders ONLY when this window's ms changes.
 *
 * Usage:
 *   const remainingMs = useTimeEngineStore(selectWindowRemainingMs(windowId));
 */
export const selectWindowRemainingMs =
  (windowId: string) =>
  (state: TimeEngineStoreState): number =>
    state.decisionWindowRemainingMs[windowId] ?? 0;

export default useTimeEngineStore;
