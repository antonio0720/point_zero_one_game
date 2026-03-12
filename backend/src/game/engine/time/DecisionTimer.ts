/* ============================================================================
 * FILE: backend/src/game/engine/time/DecisionTimer.ts
 * POINT ZERO ONE — BACKEND ENGINE TIME
 *
 * Doctrine:
 * - backend owns active decision-window expiry truth
 * - snapshot remains the persisted surface, but this class hardens runtime behavior
 * - local runtime mutations must survive until the next authoritative snapshot commit
 * - local removals must suppress stale snapshot rehydration until persistence catches up
 * - hold freezes extend deadlines immediately so timeout math stays deterministic
 * - no wall-clock polling; expiry is evaluated only during authoritative time steps
 * ========================================================================== */

import type { ModeCode, TimingClass } from '../core/GamePrimitives';
import type { RuntimeDecisionWindowSnapshot } from '../core/RunStateSnapshot';
import { DEFAULT_HOLD_DURATION_MS } from './types';

interface DecisionTimerSyncResult {
  readonly openedWindowIds: readonly string[];
  readonly removedWindowIds: readonly string[];
}

interface DecisionWindowSeedOptions {
  readonly timingClass?: TimingClass;
  readonly label?: string;
  readonly source?: string;
  readonly mode?: ModeCode;
  readonly openedAtTick?: number;
  readonly openedAtMs?: number;
  readonly closesAtTick?: number | null;
  readonly exclusive?: boolean;
  readonly actorId?: string | null;
  readonly targetActorId?: string | null;
  readonly cardInstanceId?: string | null;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

type SuppressedWindowReason = 'RESOLVED' | 'NULLIFIED' | 'EXPIRED';

interface MutableDecisionWindowState {
  readonly windowId: string;
  snapshot: RuntimeDecisionWindowSnapshot;
  frozenUntilMs: number | null;
  persistedInSnapshot: boolean;
}

function normalizeMs(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.trunc(value));
}

function cloneMetadata(
  metadata: Readonly<Record<string, string | number | boolean | null>> | undefined,
): Readonly<Record<string, string | number | boolean | null>> {
  return Object.freeze({ ...(metadata ?? {}) });
}

function toFrozenSnapshot(
  windowId: string,
  snapshot: RuntimeDecisionWindowSnapshot,
  frozen: boolean,
  closesAtMs?: number | null,
): RuntimeDecisionWindowSnapshot {
  return Object.freeze({
    ...snapshot,
    id: snapshot.id || windowId,
    closesAtMs: closesAtMs === undefined ? snapshot.closesAtMs : normalizeMs(closesAtMs),
    frozen,
    metadata: cloneMetadata(snapshot.metadata),
  });
}

function createSyntheticWindowSnapshot(
  windowId: string,
  closesAtMs: number,
  options: DecisionWindowSeedOptions = {},
): RuntimeDecisionWindowSnapshot {
  const normalizedCloseAtMs = Math.max(0, Math.trunc(closesAtMs));
  const openedAtMs = normalizeMs(options.openedAtMs) ?? Math.max(0, normalizedCloseAtMs - 1);

  return Object.freeze({
    id: windowId,
    timingClass: options.timingClass ?? 'FATE',
    label: options.label ?? windowId,
    source: options.source ?? 'time-engine',
    mode: options.mode ?? 'solo',
    openedAtTick: Math.max(0, Math.trunc(options.openedAtTick ?? 0)),
    openedAtMs,
    closesAtTick: options.closesAtTick ?? null,
    closesAtMs: normalizedCloseAtMs,
    exclusive: options.exclusive ?? false,
    frozen: false,
    consumed: false,
    actorId: options.actorId ?? null,
    targetActorId: options.targetActorId ?? null,
    cardInstanceId: options.cardInstanceId ?? null,
    metadata: cloneMetadata(options.metadata),
  });
}

export class DecisionTimer {
  private readonly windows = new Map<string, MutableDecisionWindowState>();
  private readonly suppressedWindowIds = new Map<string, SuppressedWindowReason>();

  public reset(): void {
    this.windows.clear();
    this.suppressedWindowIds.clear();
  }

  /**
   * Rehydrates runtime window state from the persisted snapshot surface
   * at the start of the backend time step.
   *
   * Important:
   * - runtime-opened windows survive until they are persisted into snapshot
   * - runtime-removed windows suppress stale snapshot reappearance until
   *   the authoritative snapshot reflects the removal
   * - if a window already exists locally, active freeze timing is preserved
   * - if a window arrives from snapshot already frozen but without exact
   *   thaw timing, we reconstruct a bounded best-effort local freeze window
   */
  public syncFromSnapshot(
    activeDecisionWindows: Readonly<Record<string, RuntimeDecisionWindowSnapshot>>,
    frozenWindowIds: readonly string[],
    nowMs: number,
  ): DecisionTimerSyncResult {
    const openedWindowIds: string[] = [];
    const removedWindowIds: string[] = [];

    const authoritativeNowMs = Math.max(0, Math.trunc(nowMs));
    const frozenSet = new Set<string>(frozenWindowIds);
    const snapshotIds = new Set<string>(Object.keys(activeDecisionWindows));

    for (const [windowId] of this.suppressedWindowIds) {
      if (!snapshotIds.has(windowId)) {
        this.suppressedWindowIds.delete(windowId);
      }
    }

    for (const [windowId, incomingSnapshot] of Object.entries(activeDecisionWindows)) {
      if (this.suppressedWindowIds.has(windowId)) {
        continue;
      }

      const existing = this.windows.get(windowId);
      const incomingFrozen = incomingSnapshot.frozen || frozenSet.has(windowId);
      const localFreezeStillActive =
        existing?.frozenUntilMs !== null &&
        existing.frozenUntilMs !== undefined &&
        existing.frozenUntilMs > authoritativeNowMs;

      if (existing === undefined) {
        const inferredFrozenUntilMs = incomingFrozen
          ? (
              incomingSnapshot.closesAtMs === null
                ? authoritativeNowMs + DEFAULT_HOLD_DURATION_MS
                : Math.min(
                    Math.max(0, Math.trunc(incomingSnapshot.closesAtMs)),
                    authoritativeNowMs + DEFAULT_HOLD_DURATION_MS,
                  )
            )
          : null;

        this.windows.set(windowId, {
          windowId,
          snapshot: toFrozenSnapshot(
            windowId,
            incomingSnapshot,
            inferredFrozenUntilMs !== null && inferredFrozenUntilMs > authoritativeNowMs,
          ),
          frozenUntilMs:
            inferredFrozenUntilMs !== null && inferredFrozenUntilMs > authoritativeNowMs
              ? inferredFrozenUntilMs
              : null,
          persistedInSnapshot: true,
        });
        openedWindowIds.push(windowId);
        continue;
      }

      if (localFreezeStillActive) {
        const mergedClosesAtMs =
          existing.snapshot.closesAtMs === null
            ? incomingSnapshot.closesAtMs
            : incomingSnapshot.closesAtMs === null
              ? existing.snapshot.closesAtMs
              : Math.max(
                  Math.trunc(existing.snapshot.closesAtMs),
                  Math.trunc(incomingSnapshot.closesAtMs),
                );

        existing.snapshot = toFrozenSnapshot(
          windowId,
          incomingSnapshot,
          true,
          mergedClosesAtMs,
        );
        existing.persistedInSnapshot = true;
        continue;
      }

      const inferredFrozenUntilMs = incomingFrozen
        ? (
            incomingSnapshot.closesAtMs === null
              ? authoritativeNowMs + DEFAULT_HOLD_DURATION_MS
              : Math.min(
                  Math.max(0, Math.trunc(incomingSnapshot.closesAtMs)),
                  authoritativeNowMs + DEFAULT_HOLD_DURATION_MS,
                )
          )
        : null;

      existing.snapshot = toFrozenSnapshot(
        windowId,
        incomingSnapshot,
        inferredFrozenUntilMs !== null && inferredFrozenUntilMs > authoritativeNowMs,
      );
      existing.frozenUntilMs =
        inferredFrozenUntilMs !== null && inferredFrozenUntilMs > authoritativeNowMs
          ? inferredFrozenUntilMs
          : null;
      existing.persistedInSnapshot = true;
    }

    for (const [windowId, window] of [...this.windows.entries()]) {
      if (snapshotIds.has(windowId)) {
        continue;
      }

      if (!window.persistedInSnapshot) {
        continue;
      }

      this.windows.delete(windowId);
      removedWindowIds.push(windowId);
    }

    return {
      openedWindowIds,
      removedWindowIds,
    };
  }

  public open(
    windowId: string,
    closesAtMs: number,
    options: DecisionWindowSeedOptions = {},
  ): void {
    this.suppressedWindowIds.delete(windowId);

    this.windows.set(windowId, {
      windowId,
      snapshot: createSyntheticWindowSnapshot(windowId, closesAtMs, options),
      frozenUntilMs: null,
      persistedInSnapshot: false,
    });
  }

  public resolve(windowId: string): boolean {
    return this.removeLocally(windowId, 'RESOLVED');
  }

  public nullify(windowId: string): boolean {
    return this.removeLocally(windowId, 'NULLIFIED');
  }

  /**
   * Freezing is implemented by immediately extending closesAtMs and
   * recording a temporary frozen-until marker.
   *
   * This keeps post-freeze expiry math deterministic and avoids
   * "expire instantly on thaw" behavior.
   */
  public freeze(
    windowId: string,
    nowMs: number,
    holdDurationMs = DEFAULT_HOLD_DURATION_MS,
  ): boolean {
    const window = this.windows.get(windowId);
    const normalizedNowMs = Math.max(0, Math.trunc(nowMs));
    const normalizedHoldDurationMs = Math.max(0, Math.trunc(holdDurationMs));

    if (window === undefined || normalizedHoldDurationMs <= 0) {
      return false;
    }

    if (
      window.snapshot.closesAtMs !== null &&
      Math.trunc(window.snapshot.closesAtMs) <= normalizedNowMs
    ) {
      return false;
    }

    if (window.frozenUntilMs !== null && window.frozenUntilMs > normalizedNowMs) {
      return false;
    }

    const nextClosesAtMs =
      window.snapshot.closesAtMs === null
        ? null
        : Math.trunc(window.snapshot.closesAtMs) + normalizedHoldDurationMs;

    window.snapshot = toFrozenSnapshot(
      windowId,
      window.snapshot,
      true,
      nextClosesAtMs,
    );
    window.frozenUntilMs = normalizedNowMs + normalizedHoldDurationMs;

    return true;
  }

  public unfreeze(windowId: string): boolean {
    const window = this.windows.get(windowId);

    if (window === undefined) {
      return false;
    }

    window.snapshot = toFrozenSnapshot(windowId, window.snapshot, false);
    window.frozenUntilMs = null;
    return true;
  }

  /**
   * Closes all windows that have expired by the provided authoritative time.
   * `nowMs` should be the effective end-of-step time, not the pre-step time.
   */
  public closeExpired(nowMs: number): string[] {
    const authoritativeNowMs = Math.max(0, Math.trunc(nowMs));
    const expired: string[] = [];

    for (const [windowId, window] of this.windows.entries()) {
      if (window.frozenUntilMs !== null) {
        if (window.frozenUntilMs > authoritativeNowMs) {
          continue;
        }

        window.frozenUntilMs = null;
        window.snapshot = toFrozenSnapshot(windowId, window.snapshot, false);
      }

      if (
        window.snapshot.closesAtMs !== null &&
        Math.trunc(window.snapshot.closesAtMs) <= authoritativeNowMs
      ) {
        expired.push(windowId);
        this.windows.delete(windowId);
        this.suppressedWindowIds.set(windowId, 'EXPIRED');
      }
    }

    return expired;
  }

  public snapshot(): Readonly<Record<string, RuntimeDecisionWindowSnapshot>> {
    return Object.freeze(
      Object.fromEntries(
        [...this.windows.entries()].map(([windowId, window]) => [
          windowId,
          window.snapshot,
        ]),
      ),
    );
  }

  public frozenIds(nowMs: number): readonly string[] {
    const authoritativeNowMs = Math.max(0, Math.trunc(nowMs));

    return [...this.windows.values()]
      .filter(
        (window) =>
          window.frozenUntilMs !== null && window.frozenUntilMs > authoritativeNowMs,
      )
      .map((window) => window.windowId);
  }

  public activeCount(): number {
    return this.windows.size;
  }

  public has(windowId: string): boolean {
    return this.windows.has(windowId);
  }

  public getWindow(
    windowId: string,
  ): Readonly<MutableDecisionWindowState> | null {
    return this.windows.get(windowId) ?? null;
  }

  private removeLocally(
    windowId: string,
    reason: SuppressedWindowReason,
  ): boolean {
    const removed = this.windows.delete(windowId);

    if (removed) {
      this.suppressedWindowIds.set(windowId, reason);
    }

    return removed;
  }
}