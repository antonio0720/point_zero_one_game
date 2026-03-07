// pzo-web/src/engines/time/DecisionTimer.ts
// T101: high-frequency countdown sync — throttled 100ms bridge to store

const COUNTDOWN_TICK_INTERVAL_MS = 100;

export interface DecisionWindow {
  windowId:    string;
  expiresAt:   number;          // Date.now() + durationMs
  durationMs:  number;
  optionCount: number;
  holdUsed:    boolean;
}

export interface EventBus {
  emit(event: string, payload: unknown): void;
  on(event: string, handler: (payload: unknown) => void): void;
}

export class DecisionTimer {
  private eventBus:             EventBus;
  private currentTick:          number = 0;
  private _windows:             Map<string, DecisionWindow> = new Map();

  // ── T101 countdown sync internals ─────────────────────────────────────────
  private _countdownIntervals:  Map<string, ReturnType<typeof setInterval>> = new Map();
  private _tickBuffer:          Map<string, number> = new Map();
  private _flushHandle:         ReturnType<typeof setInterval> | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  registerDecisionWindow(windowId: string, durationMs: number, optionCount: number): void {
    const win: DecisionWindow = {
      windowId,
      expiresAt:  Date.now() + durationMs,
      durationMs,
      optionCount,
      holdUsed:   false,
    };
    this._windows.set(windowId, win);
    this.eventBus.emit('decision:window_opened', { tick: this.currentTick, payload: win });
    this._startCountdownSync(windowId);
  }

  resolveDecisionWindow(windowId: string, optionIndex: number): void {
    const win = this._windows.get(windowId);
    if (!win) return;
    this._stopCountdownSync(windowId);
    this._windows.delete(windowId);
    this.eventBus.emit('decision:resolved', {
      tick:    this.currentTick,
      payload: { windowId, optionIndex, resolvedAt: Date.now() },
    });
  }

  applyHold(windowId: string): boolean {
    const win = this._windows.get(windowId);
    if (!win || win.holdUsed) {
      this.eventBus.emit('decision:hold_denied', { tick: this.currentTick, payload: { windowId } });
      return false;
    }
    win.holdUsed    = true;
    win.expiresAt  += 5000;
    this.eventBus.emit('decision:hold_applied', { tick: this.currentTick, payload: { windowId } });
    return true;
  }

  nullifyWindow(windowId: string): void {
    this._stopCountdownSync(windowId);
    this._windows.delete(windowId);
  }

  setTick(tick: number): void {
    this.currentTick = tick;
  }

  getActiveWindows(): DecisionWindow[] {
    return Array.from(this._windows.values());
  }

  reset(): void {
    this._windows.forEach((_, id) => this._stopCountdownSync(id));
    this._stopFlushLoop();
    this._windows.clear();
    this.currentTick = 0;
  }

  // ── T101: countdown sync private methods ──────────────────────────────────

  private _ensureFlushLoop(): void {
    if (this._flushHandle !== null) return;
    this._flushHandle = setInterval(() => {
      if (this._tickBuffer.size === 0) return;
      const snapshot = new Map(this._tickBuffer);
      this._tickBuffer.clear();
      this.eventBus.emit('decision:countdown_tick', {
        tick:    this.currentTick,
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

  private _startCountdownSync(windowId: string): void {
    this._ensureFlushLoop();
    const handle = setInterval(() => {
      const win = this._windows.get(windowId);
      if (!win) { this._stopCountdownSync(windowId); return; }
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
    if (this._countdownIntervals.size === 0) this._stopFlushLoop();
  }
}

export default DecisionTimer;
