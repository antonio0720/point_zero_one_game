//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/hooks/useDecisionWindow.ts

// pzo-web/src/features/run/hooks/useDecisionWindow.ts
//
// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — useDecisionWindow (CANONICAL)
//
// rAF-driven 60fps countdown hook for DecisionTimerRing.
// Reads from unified engineStore (state.card.openDecisionWindows).
// Single-card and multi-card (hand-level) variants.
//
// ARCHITECTURE:
//   • Single rAF loop per hook instance — cancelAnimationFrame on unmount.
//   • progress derived from (Date.now() - openedAtMs) / durationMs for
//     true wall-clock precision independent of store update cadence.
//   • Resolves / expires state still gate-kept from store flags so the ring
//     responds instantly to engine events regardless of rAF timing.
//   • useAllDecisionWindows drives a SINGLE shared rAF for the whole hand.
//
// RULES:
//   ✦ Zero engine imports. All data from useEngineStore.
//   ✦ No setInterval — requestAnimationFrame only.
//   ✦ autoResolveImminent fires at progress >= 0.90 (not 0.80).
//   ✦ Speed score formula mirrors DecisionWindowManager exactly.
//
// Density6 LLC · Point Zero One · Cards Engine · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useEngineStore } from '../../../store/engineStore';
import type { LiveDecisionWindow } from '../../../store/engineStore';

// ── RETURN SHAPE ──────────────────────────────────────────────────────────────

export interface DecisionWindowInfo {
  /** 0.0 = just opened → 1.0 = expired. Drives ring arc offset. */
  progress:            number;
  /** 1.0 − progress, expressed as a fraction. Useful for ring fill direction. */
  fraction:            number;
  /** Live remaining milliseconds. */
  remainingMs:         number;
  /** Total window duration (constant after open). */
  durationMs:          number;
  /** Real-time speed score preview — mirrors DecisionWindowManager formula. */
  speedScorePreview:   number;
  /** progress >= 0.90 — ring turns solid red, pulse intensifies. */
  autoResolveImminent: boolean;
  /** 0.50 – 0.80 remaining — yellow zone. */
  isYellowZone:        boolean;
  /** < 0.20 remaining — red zone, pulse kicks in. */
  isRedZone:           boolean;
  /** Window is paused (Empire hold). */
  isPaused:            boolean;
  /** Card resolved (played). Ring disappears. */
  isResolved:          boolean;
  /** Window expired (auto-resolved). Triggers strobe flash. */
  isExpired:           boolean;
  /** IMMEDIATE / LEGENDARY cards never get a window. */
  hasWindow:           boolean;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const NULL_INFO: DecisionWindowInfo = {
  progress:            0,
  fraction:            1.0,
  remainingMs:         0,
  durationMs:          0,
  speedScorePreview:   1.0,
  autoResolveImminent: false,
  isYellowZone:        false,
  isRedZone:           false,
  isPaused:            false,
  isResolved:          false,
  isExpired:           false,
  hasWindow:           false,
};

// ── SPEED SCORE — mirrors DecisionWindowManager.computeSpeedScore() exactly ──

function computeSpeedScore(progress: number): number {
  if (progress <= 0.20) return 1.0;
  if (progress <= 0.50) return 1.0 - ((progress - 0.20) / 0.30) * 0.30;       // 1.0 → 0.70
  if (progress <= 0.80) return 0.70 - ((progress - 0.50) / 0.30) * 0.40;      // 0.70 → 0.30
  return Math.max(0, 0.30 - ((progress - 0.80) / 0.20) * 0.30);               // 0.30 → 0.0
}

function buildInfo(entry: LiveDecisionWindow, progress: number): DecisionWindowInfo {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const fraction        = 1 - clampedProgress;
  const remainingMs     = Math.max(0, entry.durationMs * fraction);

  return {
    progress:            clampedProgress,
    fraction,
    remainingMs,
    durationMs:          entry.durationMs,
    speedScorePreview:   computeSpeedScore(clampedProgress),
    autoResolveImminent: clampedProgress >= 0.90 && !entry.isResolved,
    isYellowZone:        clampedProgress >= 0.50 && clampedProgress < 0.80,
    isRedZone:           clampedProgress >= 0.80,
    isPaused:            entry.isPaused ?? false,
    isResolved:          entry.isResolved,
    isExpired:           entry.isExpired,
    hasWindow:           true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// useDecisionWindow — single card
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns real-time window info for a single card instance.
 * Mounts one rAF loop. Auto-cancels on unmount or resolution.
 */
export function useDecisionWindow(cardInstanceId: string): DecisionWindowInfo {
  const entry = useEngineStore(
    state => state.card?.openDecisionWindows?.[cardInstanceId] ?? null,
  );

  const [progress, setProgress] = useState(0);
  const rafRef                  = useRef<number | null>(null);
  const entryRef                = useRef(entry);
  entryRef.current              = entry;

  useEffect(() => {
    if (!entry) {
      setProgress(0);
      return;
    }

    // Terminal states — no rAF needed
    if (entry.isResolved || entry.isExpired) {
      setProgress(1.0);
      return;
    }

    // Paused (Empire hold) — freeze progress
    if (entry.isPaused) {
      const p = Math.max(0, Math.min(1,
        (entry.durationMs - entry.remainingMs) / entry.durationMs,
      ));
      setProgress(p);
      return;
    }

    const startMs   = entry.openedAtMs;
    const durationMs = entry.durationMs;

    const tick = () => {
      const elapsed = Date.now() - startMs;
      const p       = Math.min(1.0, elapsed / durationMs);
      setProgress(p);

      // Keep running until expired (engine will flip isExpired next tick)
      if (p < 1.0 && !entryRef.current?.isResolved) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    entry?.windowId,         // re-mount when a new window opens for same card
    entry?.isResolved,
    entry?.isExpired,
    entry?.isPaused,
  ]);

  if (!entry) return NULL_INFO;
  return buildInfo(entry, progress);
}

// ═══════════════════════════════════════════════════════════════════════════════
// useAllDecisionWindows — hand-level (single shared rAF loop)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns a map of instanceId → DecisionWindowInfo for every card in the hand.
 * One rAF loop for the entire hand — zero per-card loop overhead.
 *
 * Pass the instanceId array from useCardHand().hand.map(c => c.instanceId).
 */
export function useAllDecisionWindows(
  instanceIds: readonly string[],
): Record<string, DecisionWindowInfo> {
  const allWindows = useEngineStore(
    state => state.card?.openDecisionWindows ?? {},
  );

  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const rafRef                        = useRef<number | null>(null);

  // Stable string key for dep-array (avoids object identity churn)
  const idsKey = instanceIds.join(',');

  useEffect(() => {
    if (instanceIds.length === 0) {
      setProgressMap({});
      return;
    }

    const tick = () => {
      const now     = Date.now();
      const updates: Record<string, number> = {};
      let   anyActive = false;

      for (const id of instanceIds) {
        const e = allWindows[id];
        if (!e || e.isResolved || e.isExpired || e.isPaused) continue;

        const p = Math.min(1.0, (now - e.openedAtMs) / e.durationMs);
        updates[id] = p;
        if (p < 1.0) anyActive = true;
      }

      if (Object.keys(updates).length > 0) {
        setProgressMap(prev => ({ ...prev, ...updates }));
      }

      if (anyActive) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [idsKey, allWindows]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    const result: Record<string, DecisionWindowInfo> = {};

    for (const id of instanceIds) {
      const entry = allWindows[id];
      if (!entry) {
        result[id] = { ...NULL_INFO };
        continue;
      }

      const progress = entry.isResolved || entry.isExpired
        ? 1.0
        : entry.isPaused
        ? (entry.durationMs - entry.remainingMs) / entry.durationMs
        : progressMap[id] ?? 0;

      result[id] = buildInfo(entry, progress);
    }

    return result;
  }, [allWindows, progressMap, idsKey]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── COUNTDOWN FORMAT UTIL ─────────────────────────────────────────────────────

/** Human-readable countdown: "12s", "3.1s", "<1s", "0s" */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0)    return '0s';
  if (remainingMs < 1_000) return '<1s';
  const secs = remainingMs / 1_000;
  if (secs < 5)  return `${secs.toFixed(1)}s`;
  return `${Math.ceil(secs)}s`;
}