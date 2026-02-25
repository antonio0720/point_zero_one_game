// ─────────────────────────────────────────────────────────────────────────────
// T101 PATCH — engineStore.ts  (Zustand slice)
// Add onDecisionWindowTick reducer — updates ONLY the windows that changed,
// preventing whole-store re-subscription triggers.
//
// WHERE TO MERGE: pzo-web/src/store/engineStore.ts
// ─────────────────────────────────────────────────────────────────────────────

// ── ADD to your store state interface ────────────────────────────────────────

  /** windowId → remainingMs — updated at 10fps from DecisionTimer sync channel */
  decisionWindowRemainingMs: Record<string, number>;

// ── ADD to initial state ──────────────────────────────────────────────────────

  decisionWindowRemainingMs: {},

// ── ADD to store actions ──────────────────────────────────────────────────────

  /**
   * Called by EngineOrchestrator on every 'decision:countdown_tick' event.
   * Receives a batch of { windowId: remainingMs } pairs.
   *
   * PERFORMANCE CONTRACT:
   *   - Only updates keys that actually changed (avoids identity mutation)
   *   - Zustand shallow equality means components subscribed to a SINGLE
   *     window's remainingMs will NOT rerender if other windows changed
   *   - Use selector: useTimeEngineStore(s => s.decisionWindowRemainingMs[windowId])
   */
  onDecisionWindowTick: (ticks: Record<string, number>) =>
    set((state) => {
      const current = state.decisionWindowRemainingMs;
      // Only produce a new object if at least one value actually changed
      let changed = false;
      for (const [id, ms] of Object.entries(ticks)) {
        if (current[id] !== ms) { changed = true; break; }
      }
      if (!changed) return state;
      return {
        decisionWindowRemainingMs: { ...current, ...ticks },
      };
    }),

  /**
   * Call when a window is resolved/nullified to remove it from the map.
   * Prevents stale keys accumulating across runs.
   */
  clearDecisionWindowTick: (windowId: string) =>
    set((state) => {
      if (!(windowId in state.decisionWindowRemainingMs)) return state;
      const next = { ...state.decisionWindowRemainingMs };
      delete next[windowId];
      return { decisionWindowRemainingMs: next };
    }),

// ── SELECTOR (put in timeEngineSelectors.ts or inline in hook) ───────────────

  /**
   * Fine-grained selector — component only rerenders when THIS window's ms changes.
   * Usage: const remainingMs = useTimeEngineStore(selectWindowRemainingMs(windowId));
   */
  export const selectWindowRemainingMs =
    (windowId: string) =>
    (state: TimeEngineStoreState): number =>
      state.decisionWindowRemainingMs[windowId] ?? 0;

// ─────────────────────────────────────────────────────────────────────────────
