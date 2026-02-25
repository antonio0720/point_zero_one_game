/**
 * @file DecisionTimer.ts
 * @module pzo-web/src/engines/time
 * @description Engine-1 Time Engine — Decision Window lifecycle manager.
 *              Handles registration, resolution, hold/freeze logic, and
 *              worst-option auto-resolution via EventBus.
 *
 * ARCHITECTURE NOTE:
 *   This is a pure engine class — NOT a React component.
 *   React hooks (useEffect, useState) have NO place here.
 *   UI layers consume EventBus events; they do not own timer state.
 */

import type { EventBus } from '../core/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Local Minimal Types (removes broken dependency on ./types exports)
// ─────────────────────────────────────────────────────────────────────────────

interface DecisionOptionLike {
  penaltyWeight?: number | null;
  [key: string]: unknown;
}

export interface DecisionCardType {
  options?: DecisionOptionLike[];
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal ID Generation (removes uuid dependency)
// ─────────────────────────────────────────────────────────────────────────────

let decisionWindowIdSeq = 0;

function createDecisionWindowId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  decisionWindowIdSeq += 1;
  const rand = Math.random().toString(36).slice(2, 10);
  return `dw_${Date.now().toString(36)}_${decisionWindowIdSeq.toString(36)}_${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal State Interface
// ─────────────────────────────────────────────────────────────────────────────

interface ActiveWindow {
  id: string;
  card: DecisionCardType;
  windowDurationMs: number;
  deadlineAt: number;           // absolute timestamp: Date.now() + windowDurationMs
  worstOptionIndex: number;     // pre-computed at registration — never changes
  resolved: boolean;
  onHold: boolean;
  holdAppliedAt: number | null;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DecisionTimer Class
// ─────────────────────────────────────────────────────────────────────────────

export class DecisionTimer {
  private readonly eventBus: EventBus;
  private readonly activeWindows: Map<string, ActiveWindow>;
  private holdsRemaining: number;

  /** Tick resolution for deadline polling (ms). Lower = tighter deadlines. */
  private static readonly TICK_INTERVAL_MS = 100;

  constructor(eventBus: EventBus, initialHolds = 1) {
    this.eventBus = eventBus;
    this.activeWindows = new Map();
    this.holdsRemaining = initialHolds;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC — Window Registration
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * registerWindow
   * Creates a new timed decision window with a deterministic worst-option index.
   * Immediately begins countdown. Emits `decision:window_opened`.
   *
   * @param card             - The decision card driving this window.
   * @param windowDurationMs - How long the player has to decide (ms).
   * @returns windowId       - Stable ID for this window's lifetime.
   */
  public registerWindow(card: DecisionCardType, windowDurationMs: number): string {
    const id = createDecisionWindowId();
    const now = Date.now();

    const worstOptionIndex = this.computeWorstOptionIndex(card);

    const entry: ActiveWindow = {
      id,
      card,
      windowDurationMs,
      deadlineAt: now + windowDurationMs,
      worstOptionIndex,
      resolved: false,
      onHold: false,
      holdAppliedAt: null,
      intervalHandle: null,
    };

    // Wire up the deadline poller
    entry.intervalHandle = setInterval(
      () => this.internalTick(id),
      DecisionTimer.TICK_INTERVAL_MS,
    );

    this.activeWindows.set(id, entry);

    this.eventBus.emit('decision:window_opened', {
      windowId: id,
      card,
      windowDurationMs,
      worstOptionIndex,
      timestamp: now,
    });

    return id;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC — Manual Resolution
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * resolveWindow
   * Player-driven resolution. Accepts any valid option index.
   * Emits `decision:resolved`. Clears the deadline poller.
   *
   * @returns true on success, false if window not found or already resolved.
   */
  public resolveWindow(windowId: string, chosenOptionIndex: number): boolean {
    const entry = this.activeWindows.get(windowId);

    if (!entry || entry.resolved) {
      this.eventBus.emit('decision:resolve_failed', {
        windowId,
        reason: entry ? 'ALREADY_RESOLVED' : 'WINDOW_NOT_FOUND',
        timestamp: Date.now(),
      });
      return false;
    }

    this.settleWindow(entry, chosenOptionIndex, 'PLAYER');
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC — Hold / Freeze Logic
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * applyHold
   * ONE hold per run. Freezes the decision window's countdown timer.
   *
   * Denial rules (in priority order):
   *   1. Window not found           → emit HOLD_DENIED(WINDOW_NOT_FOUND)
   *   2. Window already resolved    → emit HOLD_DENIED(WINDOW_RESOLVED)
   *   3. Window already on hold     → silent no-op (idempotent), return false
   *   4. holdsRemaining === 0       → emit HOLD_DENIED(NO_HOLDS_REMAINING)
   *
   * On success: decrements holdsRemaining, sets onHold=true, clears interval.
   * Emits `decision:hold_applied`.
   */
  public applyHold(windowId: string): boolean {
    const entry = this.activeWindows.get(windowId);

    if (!entry) {
      this.eventBus.emit('decision:hold_denied', {
        windowId,
        reason: 'WINDOW_NOT_FOUND',
        holdsRemaining: this.holdsRemaining,
        timestamp: Date.now(),
      });
      return false;
    }

    if (entry.resolved) {
      this.eventBus.emit('decision:hold_denied', {
        windowId,
        reason: 'WINDOW_RESOLVED',
        holdsRemaining: this.holdsRemaining,
        timestamp: Date.now(),
      });
      return false;
    }

    if (entry.onHold) {
      return false; // silent no-op — idempotent
    }

    if (this.holdsRemaining <= 0) {
      this.eventBus.emit('decision:hold_denied', {
        windowId,
        reason: 'NO_HOLDS_REMAINING',
        holdsRemaining: 0,
        timestamp: Date.now(),
      });
      return false;
    }

    // ── Freeze ───────────────────────────────────────────────────────────────
    this.holdsRemaining -= 1;
    entry.onHold = true;
    entry.holdAppliedAt = Date.now();

    // Pause the deadline poller — clock is frozen
    if (entry.intervalHandle !== null) {
      clearInterval(entry.intervalHandle);
      entry.intervalHandle = null;
    }

    this.eventBus.emit('decision:hold_applied', {
      windowId,
      holdsRemaining: this.holdsRemaining,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * releaseHold
   * Unfreezes the window and resumes countdown from current deadlineAt.
   * Hold is CONSUMED — holdsRemaining does NOT restore.
   * Emits `decision:hold_released`.
   *
   * @returns true on success, false if window not found or not on hold.
   */
  public releaseHold(windowId: string): boolean {
    const entry = this.activeWindows.get(windowId);

    if (!entry || !entry.onHold) return false;

    entry.onHold = false;

    // Extend deadline by however long it was frozen
    const frozenDurationMs = entry.holdAppliedAt !== null
      ? Date.now() - entry.holdAppliedAt
      : 0;
    entry.deadlineAt += frozenDurationMs;
    entry.holdAppliedAt = null;

    // Resume poller
    entry.intervalHandle = setInterval(
      () => this.internalTick(entry.id),
      DecisionTimer.TICK_INTERVAL_MS,
    );

    this.eventBus.emit('decision:hold_released', {
      windowId,
      holdsRemaining: this.holdsRemaining,
      deadlineAt: entry.deadlineAt,
      timestamp: Date.now(),
    });

    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC — Introspection
  // ───────────────────────────────────────────────────────────────────────────

  public getMsRemaining(windowId: string): number {
    const entry = this.activeWindows.get(windowId);
    if (!entry || entry.resolved) return 0;
    if (entry.onHold) return Math.max(0, entry.deadlineAt - (entry.holdAppliedAt ?? Date.now()));
    return Math.max(0, entry.deadlineAt - Date.now());
  }

  public getHoldsRemaining(): number {
    return this.holdsRemaining;
  }

  public isWindowActive(windowId: string): boolean {
    const entry = this.activeWindows.get(windowId);
    return !!entry && !entry.resolved;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC — Teardown
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * destroy
   * Clears all active intervals. Call on game over / scene teardown.
   * Does NOT emit events — assumes caller owns cleanup context.
   */
  public destroy(): void {
    for (const entry of this.activeWindows.values()) {
      if (entry.intervalHandle !== null) {
        clearInterval(entry.intervalHandle);
      }
    }
    this.activeWindows.clear();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — Internal Tick (deadline poller)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * internalTick
   * Fires every TICK_INTERVAL_MS per active window.
   * On hold: skipped (interval should be cleared, but guard included for safety).
   * On deadline breach: auto-resolves to worstOptionIndex.
   */
  private internalTick(windowId: string): void {
    const entry = this.activeWindows.get(windowId);
    if (!entry || entry.resolved || entry.onHold) return;

    if (Date.now() >= entry.deadlineAt) {
      this.settleWindow(entry, entry.worstOptionIndex, 'TIMEOUT');
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — Settlement (shared resolution path)
  // ───────────────────────────────────────────────────────────────────────────

  private settleWindow(
    entry: ActiveWindow,
    chosenOptionIndex: number,
    trigger: 'PLAYER' | 'TIMEOUT',
  ): void {
    entry.resolved = true;

    if (entry.intervalHandle !== null) {
      clearInterval(entry.intervalHandle);
      entry.intervalHandle = null;
    }

    const msRemainingAtResolution = Math.max(0, entry.deadlineAt - Date.now());

    this.eventBus.emit('decision:resolved', {
      windowId: entry.id,
      card: entry.card,
      chosenOptionIndex,
      worstOptionIndex: entry.worstOptionIndex,
      msRemainingAtResolution,
      trigger,
      timestamp: Date.now(),
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE — Worst Option Computation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * computeWorstOptionIndex
   * Deterministic: always returns the option with the highest penalty weight.
   * Tie-break: highest index wins (stable across serialization).
   *
   * NOTE: Assumes card.options is ordered and each option has a `penaltyWeight`
   *       field. Adapt to your actual DecisionCardType shape.
   */
  private computeWorstOptionIndex(card: DecisionCardType): number {
    if (!card.options || card.options.length === 0) return 0;

    let worstIndex = 0;
    let worstWeight = -Infinity;

    for (let i = 0; i < card.options.length; i++) {
      const weight = card.options[i]?.penaltyWeight ?? 0;
      if (weight >= worstWeight) {
        worstWeight = weight;
        worstIndex = i;
      }
    }

    return worstIndex;
  }
}