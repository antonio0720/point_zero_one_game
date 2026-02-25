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

interface DecisionOptionLike {
  penaltyWeight?: number | null;
  isWorst?: boolean;
  cashflowDelta?: number;
  [key: string]: unknown;
}

export interface DecisionCardType {
  options?: DecisionOptionLike[];
  [key: string]: unknown;
}

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

interface ActiveWindow {
  id: string;
  card: DecisionCardType;
  windowDurationMs: number;
  deadlineAt: number;
  worstOptionIndex: number;
  resolved: boolean;
  onHold: boolean;
  holdAppliedAt: number | null;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

export class DecisionTimer {
  private readonly eventBus: EventBus;
  private readonly activeWindows: Map<string, ActiveWindow>;
  private holdsRemaining: number;
  private currentTick = 0;

  private static readonly TICK_INTERVAL_MS = 100;

  constructor(eventBus: EventBus, initialHolds = 1) {
    this.eventBus = eventBus;
    this.activeWindows = new Map();
    this.holdsRemaining = initialHolds;
  }

  public setTick(tick: number): void {
    this.currentTick = tick;
  }

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

    entry.intervalHandle = setInterval(() => this.internalTick(id), DecisionTimer.TICK_INTERVAL_MS);

    this.activeWindows.set(id, entry);

    this.eventBus.emit('decision:window_opened', this.currentTick, {
      windowId: id,
      card,
      windowDurationMs,
      worstOptionIndex,
      timestamp: now,
    });

    return id;
  }

  public resolveWindow(windowId: string, chosenOptionIndex: number): boolean {
    const entry = this.activeWindows.get(windowId);

    if (!entry || entry.resolved) {
      this.eventBus.emit('decision:resolve_failed', this.currentTick, {
        windowId,
        reason: entry ? 'ALREADY_RESOLVED' : 'WINDOW_NOT_FOUND',
        timestamp: Date.now(),
      });
      return false;
    }

    this.settleWindow(entry, chosenOptionIndex, 'PLAYER');
    return true;
  }

  public applyHold(windowId: string): boolean {
    const entry = this.activeWindows.get(windowId);

    if (!entry) {
      this.eventBus.emit('decision:hold_denied', this.currentTick, {
        windowId,
        reason: 'WINDOW_NOT_FOUND',
        holdsRemaining: this.holdsRemaining,
        timestamp: Date.now(),
      });
      return false;
    }

    if (entry.resolved) {
      this.eventBus.emit('decision:hold_denied', this.currentTick, {
        windowId,
        reason: 'WINDOW_RESOLVED',
        holdsRemaining: this.holdsRemaining,
        timestamp: Date.now(),
      });
      return false;
    }

    if (entry.onHold) return false;

    if (this.holdsRemaining <= 0) {
      this.eventBus.emit('decision:hold_denied', this.currentTick, {
        windowId,
        reason: 'NO_HOLDS_REMAINING',
        holdsRemaining: 0,
        timestamp: Date.now(),
      });
      return false;
    }

    this.holdsRemaining -= 1;
    entry.onHold = true;
    entry.holdAppliedAt = Date.now();

    if (entry.intervalHandle !== null) {
      clearInterval(entry.intervalHandle);
      entry.intervalHandle = null;
    }

    this.eventBus.emit('decision:hold_applied', this.currentTick, {
      windowId,
      holdsRemaining: this.holdsRemaining,
      timestamp: Date.now(),
    });

    return true;
  }

  public releaseHold(windowId: string): boolean {
    const entry = this.activeWindows.get(windowId);
    if (!entry || !entry.onHold) return false;

    entry.onHold = false;

    const frozenDurationMs = entry.holdAppliedAt !== null
      ? Date.now() - entry.holdAppliedAt
      : 0;
    entry.deadlineAt += frozenDurationMs;
    entry.holdAppliedAt = null;

    entry.intervalHandle = setInterval(() => this.internalTick(entry.id), DecisionTimer.TICK_INTERVAL_MS);

    this.eventBus.emit('decision:hold_released', this.currentTick, {
      windowId,
      holdsRemaining: this.holdsRemaining,
      deadlineAt: entry.deadlineAt,
      timestamp: Date.now(),
    });

    return true;
  }

  public stopIfEmpty(): void {
    for (const [id, entry] of this.activeWindows.entries()) {
      if (entry.resolved) {
        this.activeWindows.delete(id);
      }
    }
  }

  public getActiveWindows(): string[] {
    return Array.from(this.activeWindows.entries())
      .filter(([, e]) => !e.resolved)
      .map(([id]) => id);
  }

  public getHoldsRemaining(): number {
    return this.holdsRemaining;
  }

  public getMsRemaining(windowId: string): number {
    const entry = this.activeWindows.get(windowId);
    if (!entry || entry.resolved) return 0;
    if (entry.onHold) return Math.max(0, entry.deadlineAt - (entry.holdAppliedAt ?? Date.now()));
    return Math.max(0, entry.deadlineAt - Date.now());
  }

  public isWindowActive(windowId: string): boolean {
    const entry = this.activeWindows.get(windowId);
    return !!entry && !entry.resolved;
  }

  public destroy(): void {
    for (const entry of this.activeWindows.values()) {
      if (entry.intervalHandle !== null) {
        clearInterval(entry.intervalHandle);
      }
    }
    this.activeWindows.clear();
  }

  private internalTick(windowId: string): void {
    const entry = this.activeWindows.get(windowId);
    if (!entry || entry.resolved || entry.onHold) return;

    if (Date.now() >= entry.deadlineAt) {
      this.settleWindow(entry, entry.worstOptionIndex, 'TIMEOUT');
    }
  }

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

    this.eventBus.emit('decision:resolved', this.currentTick, {
      windowId: entry.id,
      card: entry.card,
      chosenOptionIndex,
      worstOptionIndex: entry.worstOptionIndex,
      msRemainingAtResolution,
      trigger,
      timestamp: Date.now(),
    });
  }

  public computeWorstOptionIndex(card: DecisionCardType): number {
    if (!card.options || card.options.length === 0) return 0;

    // isWorst flag takes absolute priority
    const flaggedIndex = card.options.reduce((worst, opt, i) =>
      opt.isWorst ? i : worst, -1);
    if (flaggedIndex !== -1) return flaggedIndex;

    // Fallback: highest penaltyWeight, tie-break highest index
    let worstIndex = 0;
    let worstWeight = -Infinity;
    for (let i = 0; i < card.options.length; i++) {
      const weight = card.options[i]?.penaltyWeight ?? card.options[i]?.cashflowDelta ?? 0;
      if (weight >= worstWeight) {
        worstWeight = weight;
        worstIndex = i;
      }
    }
    return worstIndex;
  }
}
