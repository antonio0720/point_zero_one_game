//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/cards/DecisionWindowManager.ts

// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — DECISION WINDOW MANAGER
// pzo-web/src/engines/cards/DecisionWindowManager.ts
//
// Manages per-card countdown timers. Opens a decision window when a card
// enters the player's hand. Tracks elapsed time. Fires auto-resolve on expiry
// using the pre-defined worst available option on the card definition.
//
// Feeds speedScore into the DecisionRecord consumed by CardScorer.
// Feeds decisionWindowId into CardInHand — the live link between card and timer.
//
// TIMING ARCHITECTURE:
//   - Windows are advanced every real-time tick via advanceTick(elapsedMs).
//   - elapsedMs is wall-clock elapsed, not game-tick duration.
//   - Cards with TimingClass.IMMEDIATE: no window opened — always playable.
//   - Cards with TimingClass.HOLD: window paused while isHeld === true.
//   - Forced cards: window opened immediately on injection.
//   - Auto-resolve fires the autoResolveChoice written at window open.
//
// RULES:
//   ✦ One window per card instance — windowId ↔ cardInstanceId 1:1.
//   ✦ DecisionWindowManager never emits EventBus events directly.
//     CardUXBridge consumes the ExpiredWindowRecord and emits events.
//   ✦ Pausing (hold) sets remainingMs frozen. Resuming restores it.
//   ✦ Windows for IMMEDIATE and LEGENDARY cards are never created.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  TimingClass,
  TIMING_CLASS_WINDOW_MS,
  type CardInHand,
  type DecisionWindow,
} from './types';
import { v4 as uuidv4 } from 'uuid';

// ── WINDOW OPEN RESULT ────────────────────────────────────────────────────────

export interface WindowOpenResult {
  readonly windowId:    string;
  readonly durationMs:  number;
  readonly skipped:     boolean;  // true for IMMEDIATE / LEGENDARY — no window needed
  readonly reason:      string;
}

// ── EXPIRED WINDOW RECORD ─────────────────────────────────────────────────────

export interface ExpiredWindowRecord {
  readonly windowId:       string;
  readonly cardInstanceId: string;
  readonly cardId:         string;
  readonly autoChoice:     string;
  readonly speedScore:     number;  // always 0.0 — expired = no speed credit
  readonly expiredAtTick:  number;
}

// ── RESOLVED WINDOW RECORD ────────────────────────────────────────────────────

export interface ResolvedWindowRecord {
  readonly windowId:       string;
  readonly cardInstanceId: string;
  readonly cardId:         string;
  readonly choiceId:       string;
  readonly openedAtMs:     number;
  readonly resolvedAtMs:   number;
  readonly resolvedInMs:   number;
  readonly durationMs:     number;
  readonly speedScore:     number;   // 0.0–1.0
  readonly resolvedAtTick: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION WINDOW MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class DecisionWindowManager {
  private windows:      Map<string, DecisionWindow> = new Map(); // windowId → window
  private cardToWindow: Map<string, string>         = new Map(); // cardInstanceId → windowId
  private pausedWindows: Set<string>                = new Set(); // windowIds paused

  private pendingExpired:  ExpiredWindowRecord[]  = [];
  private pendingResolved: ResolvedWindowRecord[] = [];

  private readonly baseWindowMs: number;

  constructor(baseWindowMs: number) {
    this.baseWindowMs = baseWindowMs;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OPEN
  // ═══════════════════════════════════════════════════════════════════════════

  public openWindow(
    card:               CardInHand,
    tickIndex:          number,
    autoResolveChoice:  string,
    durationOverrideMs?: number,
  ): WindowOpenResult {
    const tc = card.definition.timingClass;

    if (tc === TimingClass.IMMEDIATE || tc === TimingClass.LEGENDARY) {
      return { windowId: '', durationMs: 0, skipped: true, reason: `TimingClass.${tc} — always playable.` };
    }

    const durationMs = durationOverrideMs ?? TIMING_CLASS_WINDOW_MS[tc] ?? this.baseWindowMs;
    const windowId   = uuidv4();
    const now        = Date.now();

    const window: DecisionWindow = {
      windowId,
      cardInstanceId:    card.instanceId,
      cardId:            card.definition.cardId,
      openedAtTick:      tickIndex,
      openedAtMs:        now,
      durationMs,
      autoResolveChoice,
      remainingMs:       durationMs,
      isResolved:        false,
      isExpired:         false,
    };

    this.windows.set(windowId, window);
    this.cardToWindow.set(card.instanceId, windowId);

    // HOLD cards start paused immediately — timer activates on release
    if (tc === TimingClass.HOLD) {
      this.pausedWindows.add(windowId);
    }

    return { windowId, durationMs, skipped: false, reason: `Window opened for ${card.definition.cardId} — ${durationMs}ms.` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADVANCE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Advance all active windows by real wall-clock elapsed ms.
   * Paused windows are skipped. Expired windows are queued for CardEngine.
   */
  public advanceTick(elapsedMs: number, tickIndex: number): void {
    for (const [windowId, window] of this.windows) {
      if (window.isResolved || window.isExpired) continue;
      if (this.pausedWindows.has(windowId))      continue;

      window.remainingMs = Math.max(0, window.remainingMs - elapsedMs);

      if (window.remainingMs <= 0) {
        window.isExpired = true;
        this.pendingExpired.push({
          windowId,
          cardInstanceId: window.cardInstanceId,
          cardId:         window.cardId,
          autoChoice:     window.autoResolveChoice,
          speedScore:     0.0,
          expiredAtTick:  tickIndex,
        });
        this.cardToWindow.delete(window.cardInstanceId);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESOLVE
  // ═══════════════════════════════════════════════════════════════════════════

  public resolveWindow(
    cardInstanceId: string,
    choiceId:       string,
    tickIndex:      number,
  ): ResolvedWindowRecord | null {
    const windowId = this.cardToWindow.get(cardInstanceId);
    if (!windowId) return null;

    const window = this.windows.get(windowId);
    if (!window || window.isResolved || window.isExpired) return null;

    const now          = Date.now();
    const resolvedInMs = now - window.openedAtMs;
    const speedScore   = this.computeSpeedScore(resolvedInMs, window.durationMs);

    window.isResolved = true;

    const record: ResolvedWindowRecord = {
      windowId,
      cardInstanceId: window.cardInstanceId,
      cardId:         window.cardId,
      choiceId,
      openedAtMs:     window.openedAtMs,
      resolvedAtMs:   now,
      resolvedInMs,
      durationMs:     window.durationMs,
      speedScore,
      resolvedAtTick: tickIndex,
    };

    this.pendingResolved.push(record);
    this.cardToWindow.delete(cardInstanceId);
    return record;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAUSE / RESUME (Empire Hold System)
  // ═══════════════════════════════════════════════════════════════════════════

  public pauseWindow(cardInstanceId: string): boolean {
    const windowId = this.cardToWindow.get(cardInstanceId);
    if (!windowId) return false;
    this.pausedWindows.add(windowId);
    return true;
  }

  public resumeWindow(cardInstanceId: string): number {
    const windowId = this.cardToWindow.get(cardInstanceId);
    if (!windowId) return 0;
    this.pausedWindows.delete(windowId);
    return this.windows.get(windowId)?.remainingMs ?? 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUSH (called each tick by CardEngine)
  // ═══════════════════════════════════════════════════════════════════════════

  public flushExpired(): ExpiredWindowRecord[] {
    const records = [...this.pendingExpired];
    this.pendingExpired = [];
    return records;
  }

  public flushResolved(): ResolvedWindowRecord[] {
    const records = [...this.pendingResolved];
    this.pendingResolved = [];
    return records;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOSE (force-close on discard / run end)
  // ═══════════════════════════════════════════════════════════════════════════

  public closeWindow(cardInstanceId: string): void {
    const windowId = this.cardToWindow.get(cardInstanceId);
    if (!windowId) return;
    const window = this.windows.get(windowId);
    if (window) window.isExpired = true;
    this.pausedWindows.delete(windowId);
    this.cardToWindow.delete(cardInstanceId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSORS
  // ═══════════════════════════════════════════════════════════════════════════

  public getWindow(cardInstanceId: string): DecisionWindow | null {
    const windowId = this.cardToWindow.get(cardInstanceId);
    return windowId ? (this.windows.get(windowId) ?? null) : null;
  }

  public getWindowById(windowId: string): DecisionWindow | null {
    return this.windows.get(windowId) ?? null;
  }

  public hasOpenWindow(cardInstanceId: string): boolean {
    const w = this.getWindow(cardInstanceId);
    return !!w && !w.isResolved && !w.isExpired;
  }

  public getRemainingMs(cardInstanceId: string): number {
    const w = this.getWindow(cardInstanceId);
    if (!w || w.isResolved || w.isExpired) return 0;
    return w.remainingMs;
  }

  public getWindowProgress(cardInstanceId: string): number {
    const w = this.getWindow(cardInstanceId);
    if (!w || w.durationMs === 0) return 0;
    return Math.max(0, Math.min(1, w.remainingMs / w.durationMs));
  }

  public isPaused(cardInstanceId: string): boolean {
    const windowId = this.cardToWindow.get(cardInstanceId);
    return windowId ? this.pausedWindows.has(windowId) : false;
  }

  public getActiveWindowCount(): number {
    let count = 0;
    for (const w of this.windows.values()) {
      if (!w.isResolved && !w.isExpired) count++;
    }
    return count;
  }

  public reset(): void {
    this.windows.clear();
    this.cardToWindow.clear();
    this.pausedWindows.clear();
    this.pendingExpired  = [];
    this.pendingResolved = [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPEED SCORE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Score curve (rewards decisive play without punishing deliberate thought):
   *   ≤20% window used  → 1.0  (elite)
   *   20%–50% used      → 1.0 → 0.7 (linear)
   *   50%–80% used      → 0.7 → 0.3 (linear)
   *   80%–100% used     → 0.3 → 0.0 (linear)
   */
  private computeSpeedScore(resolvedInMs: number, durationMs: number): number {
    if (durationMs <= 0) return 1.0;
    const ratio = Math.min(1, resolvedInMs / durationMs);
    if (ratio <= 0.20) return 1.0;
    if (ratio <= 0.50) return 1.0 - ((ratio - 0.20) / 0.30) * 0.30;
    if (ratio <= 0.80) return 0.7 - ((ratio - 0.50) / 0.30) * 0.40;
    return Math.max(0, 0.30 - ((ratio - 0.80) / 0.20) * 0.30);
  }
}