// ─────────────────────────────────────────────────────────────────────────────
// T101 PATCH — DecisionTimer.ts
// Add throttled countdown-tick emission so store stays accurate without
// triggering rerender storms.
//
// WHERE TO MERGE: pzo-web/src/engines/time/DecisionTimer.ts
//
// WHAT CHANGES:
//   1. Add COUNTDOWN_TICK_INTERVAL_MS = 100 constant
//   2. In startWindow(): launch a private _syncInterval for each active window
//   3. In stopWindow() / resolveWindow() / nullifyWindow(): clear the interval
//   4. Emit EventBus event 'decision:countdown_tick' with throttled coalescing
//      so multiple simultaneous windows batch into ONE emission per 100ms
// ─────────────────────────────────────────────────────────────────────────────

// ── ADD to top of file (after existing imports) ───────────────────────────────

const COUNTDOWN_TICK_INTERVAL_MS = 100; // 10 fps — accurate enough for ring UI

// ── ADD inside DecisionTimer class ───────────────────────────────────────────

  /** Map of windowId → interval handle for countdown sync ticks */
  private _countdownIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  /** Coalescing buffer: windowId → remainingMs, flushed every COUNTDOWN_TICK_INTERVAL_MS */
  private _tickBuffer: Map<string, number> = new Map();
  private _flushHandle: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the shared flush loop if not already running.
   * All active windows coalesce into ONE EventBus emission per interval.
   */
  private _ensureFlushLoop(): void {
    if (this._flushHandle !== null) return;
    this._flushHandle = setInterval(() => {
      if (this._tickBuffer.size === 0) return;
      const snapshot = new Map(this._tickBuffer);
      this._tickBuffer.clear();
      // Single EventBus emit — one object, all windows
      this.eventBus.emit('decision:countdown_tick', {
        tick: this.currentTick ?? 0,
        payload: Object.fromEntries(snapshot) as Record<string, number>,
      });
    }, COUNTDOWN_TICK_INTERVAL_MS);
  }

  private _stopFlushLoop(): void {
    if (this._flushHandle !== null) {
      clearInterval(this._flushHandle);
      this._flushHandle = null;
    }
  }

  /**
   * Call this AFTER registering a window (inside startWindow / registerDecisionWindow).
   * Feeds remainingMs into the coalescing buffer every 100ms.
   */
  private _startCountdownSync(windowId: string): void {
    this._ensureFlushLoop();
    // Each window writes its remainingMs to the buffer; flush loop batches them
    const handle = setInterval(() => {
      const win = this._windows?.get(windowId);
      if (!win) {
        this._stopCountdownSync(windowId);
        return;
      }
      const remainingMs = Math.max(0, win.expiresAt - Date.now());
      this._tickBuffer.set(windowId, remainingMs);
    }, COUNTDOWN_TICK_INTERVAL_MS);
    this._countdownIntervals.set(windowId, handle);
  }

  private _stopCountdownSync(windowId: string): void {
    const h = this._countdownIntervals.get(windowId);
    if (h !== undefined) {
      clearInterval(h);
      this._countdownIntervals.delete(windowId);
    }
    this._tickBuffer.delete(windowId);
    // Stop flush loop when no windows remain
    if (this._countdownIntervals.size === 0) {
      this._stopFlushLoop();
    }
  }

// ── HOOK POINTS (add one line each) ──────────────────────────────────────────
//
//  In registerDecisionWindow() / startWindow() — after window is stored:
//    this._startCountdownSync(windowId);
//
//  In resolveDecisionWindow() — before/after emitting resolved event:
//    this._stopCountdownSync(windowId);
//
//  In nullifyWindow() — before/after nullify logic:
//    this._stopCountdownSync(windowId);
//
//  In reset() / destroy() — cleanup:
//    this._countdownIntervals.forEach((_, id) => this._stopCountdownSync(id));
//    this._stopFlushLoop();
// ─────────────────────────────────────────────────────────────────────────────
