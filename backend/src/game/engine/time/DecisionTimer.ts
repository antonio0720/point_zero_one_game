/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/DecisionTimer.ts
 *
 * Doctrine:
 * - backend owns active decision-window expiry truth
 * - snapshot remains the persisted surface, but this class hardens runtime behavior
 * - hold freezes extend deadlines immediately so timeout math stays deterministic
 * - local runtime state must be fully resettable for replay and hot test isolation
 */

import type { DecisionTimerSyncResult } from './types';
import { DEFAULT_HOLD_DURATION_MS } from './types';

interface MutableDecisionWindowState {
  windowId: string;
  deadlineMs: number;
  frozenUntilMs: number | null;
}

export class DecisionTimer {
  private readonly windows = new Map<string, MutableDecisionWindowState>();

  public reset(): void {
    this.windows.clear();
  }

  /**
   * Rehydrates runtime window state from the snapshot surface at the start
   * of each time step. This lets the engine remain deterministic while still
   * supporting external mutation paths that write into snapshot timers.
   */
  public syncFromSnapshot(
    activeDecisionWindows: Readonly<Record<string, number>>,
    frozenWindowIds: readonly string[],
    nowMs: number,
  ): DecisionTimerSyncResult {
    const openedWindowIds: string[] = [];
    const removedWindowIds: string[] = [];
    const frozenSet = new Set(frozenWindowIds);
    const snapshotIds = new Set(Object.keys(activeDecisionWindows));

    for (const [windowId, deadlineMs] of Object.entries(activeDecisionWindows)) {
      const existing = this.windows.get(windowId);

      if (existing === undefined) {
        this.windows.set(windowId, {
          windowId,
          deadlineMs,
          frozenUntilMs: frozenSet.has(windowId) ? nowMs : null,
        });
        openedWindowIds.push(windowId);
        continue;
      }

      existing.deadlineMs = deadlineMs;

      if (frozenSet.has(windowId)) {
        existing.frozenUntilMs ??= nowMs;
      } else if (existing.frozenUntilMs !== null && existing.frozenUntilMs <= nowMs) {
        existing.frozenUntilMs = null;
      }
    }

    for (const windowId of [...this.windows.keys()]) {
      if (!snapshotIds.has(windowId)) {
        this.windows.delete(windowId);
        removedWindowIds.push(windowId);
      }
    }

    return {
      openedWindowIds,
      removedWindowIds,
    };
  }

  public open(windowId: string, deadlineMs: number): void {
    this.windows.set(windowId, {
      windowId,
      deadlineMs,
      frozenUntilMs: null,
    });
  }

  public resolve(windowId: string): boolean {
    return this.windows.delete(windowId);
  }

  public nullify(windowId: string): boolean {
    return this.windows.delete(windowId);
  }

  /**
   * Freezing is implemented by immediately extending the deadline and
   * recording a temporary frozen-until marker.
   *
   * This keeps post-freeze expiry math deterministic and avoids "expire
   * instantly on thaw" behavior.
   */
  public freeze(
    windowId: string,
    nowMs: number,
    holdDurationMs = DEFAULT_HOLD_DURATION_MS,
  ): boolean {
    const window = this.windows.get(windowId);

    if (window === undefined || holdDurationMs <= 0) {
      return false;
    }

    if (window.frozenUntilMs !== null && window.frozenUntilMs > nowMs) {
      return false;
    }

    window.deadlineMs += holdDurationMs;
    window.frozenUntilMs = nowMs + holdDurationMs;
    return true;
  }

  public unfreeze(windowId: string): boolean {
    const window = this.windows.get(windowId);

    if (window === undefined) {
      return false;
    }

    window.frozenUntilMs = null;
    return true;
  }

  public closeExpired(nowMs: number): string[] {
    const expired: string[] = [];

    for (const [windowId, window] of this.windows.entries()) {
      if (window.frozenUntilMs !== null) {
        if (window.frozenUntilMs > nowMs) {
          continue;
        }
        window.frozenUntilMs = null;
      }

      if (window.deadlineMs <= nowMs) {
        expired.push(windowId);
        this.windows.delete(windowId);
      }
    }

    return expired;
  }

  public snapshot(): Readonly<Record<string, number>> {
    return Object.freeze(
      Object.fromEntries(
        [...this.windows.entries()].map(([windowId, window]) => [
          windowId,
          Math.trunc(window.deadlineMs),
        ]),
      ),
    );
  }

  public frozenIds(nowMs: number): readonly string[] {
    return [...this.windows.values()]
      .filter((window) => window.frozenUntilMs !== null && window.frozenUntilMs > nowMs)
      .map((window) => window.windowId);
  }

  public activeCount(): number {
    return this.windows.size;
  }
}