// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/hooks/useDecisionWindow.ts

/**
 * FILE: pzo-web/src/features/run/hooks/useDecisionWindow.ts
 * POINT ZERO ONE — ENGINE 1 DECISION WINDOW HOOK
 *
 * This hook supports BOTH of the store shapes that have existed in the Time lane:
 *
 * 1) Minimal store entry shape currently present in older engineStore paths:
 *    {
 *      cardId: string;
 *      durationMs: number;
 *      openedAtTick: number;
 *      autoResolve: string;
 *    }
 *
 * 2) Rich countdown window shape expected by newer Time Engine handlers:
 *    {
 *      windowId: string;
 *      cardId: string;
 *      durationMs: number;
 *      remainingMs: number;
 *      isOnHold: boolean;
 *      isExpired: boolean;
 *      isResolved: boolean;
 *      ...
 *    }
 *
 * Strategy:
 * - If the rich shape exists, trust it.
 * - If only the minimal shape exists, synthesize a live countdown client-side.
 * - Keep animation smooth with requestAnimationFrame.
 * - Never mutate the store from this hook.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEngineStore } from '../../../store/engineStore';
import { formatTickCountdown } from './useTickCountdown';

type UnknownStoreWindow = Record<string, unknown>;

interface MinimalDecisionWindowEntry {
  cardId: string;
  durationMs: number;
  openedAtTick: number;
  autoResolve: string;
}

interface RichDecisionWindowEntry {
  windowId?: string | null;
  cardId: string;
  durationMs: number;
  remainingMs: number;
  openedAtTick?: number | null;
  openedAtMs?: number | null;
  expiresAtMs?: number | null;
  autoResolve?: string | null;
  isOnHold?: boolean;
  isExpired?: boolean;
  isResolved?: boolean;
}

export interface DecisionWindowView {
  windowId: string | null;
  cardId: string;
  durationMs: number;
  remainingMs: number;
  openedAtTick: number | null;
  openedAtMs: number | null;
  expiresAtMs: number | null;
  autoResolve: string | null;
  isOnHold: boolean;
  isExpired: boolean;
  isResolved: boolean;
}

export interface UseDecisionWindowResult {
  hasWindow: boolean;
  window: DecisionWindowView | null;
  progressPct: number;
  remainingMs: number;
  isOnHold: boolean;
  isUrgent: boolean;
  isCritical: boolean;
  isExpired: boolean;
  isResolved: boolean;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function coerceNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function coerceString(value: unknown, fallback: string | null = null): string | null {
  return typeof value === 'string' ? value : fallback;
}

function isRichWindowShape(
  value: UnknownStoreWindow | null,
): value is UnknownStoreWindow & RichDecisionWindowEntry {
  return (
    !!value &&
    typeof value.cardId === 'string' &&
    typeof value.durationMs === 'number' &&
    Number.isFinite(value.durationMs) &&
    typeof value.remainingMs === 'number' &&
    Number.isFinite(value.remainingMs)
  );
}

function isMinimalWindowShape(
  value: UnknownStoreWindow | null,
): value is UnknownStoreWindow & MinimalDecisionWindowEntry {
  return (
    !!value &&
    typeof value.cardId === 'string' &&
    typeof value.durationMs === 'number' &&
    Number.isFinite(value.durationMs) &&
    typeof value.openedAtTick === 'number' &&
    Number.isFinite(value.openedAtTick)
  );
}

export function formatCountdown(remainingMs: number): string {
  return formatTickCountdown(remainingMs);
}

export function useDecisionWindow(cardId: string): UseDecisionWindowResult {
  const storeWindow = useEngineStore(
    (state) =>
      ((state.time.activeDecisionWindows as unknown[]).find((value) => {
        if (!value || typeof value !== 'object') return false;
        const candidate = value as UnknownStoreWindow;
        return candidate.cardId === cardId;
      }) as UnknownStoreWindow | undefined) ?? null,
  );

  const lastTickIndex = useEngineStore((state) => state.run.lastTickIndex);
  const currentTickDurationMs = useEngineStore((state) => state.time.currentTickDurationMs);

  const [progressPct, setProgressPct] = useState<number>(1);
  const [derivedRemainingMs, setDerivedRemainingMs] = useState<number>(0);

  const rafRef = useRef<number | null>(null);
  const derivedAnchorStartedAtMsRef = useRef<number | null>(null);
  const lastWindowIdentityRef = useRef<string | null>(null);

  const richWindow = useMemo<DecisionWindowView | null>(() => {
    if (!isRichWindowShape(storeWindow)) return null;

    const rich = storeWindow;
    const durationMs = Math.max(1, coerceNumber(rich.durationMs, 1));
    const remainingMs = Math.max(0, coerceNumber(rich.remainingMs, durationMs));
    const isResolved = Boolean(rich.isResolved);
    const isExpired = Boolean(rich.isExpired) || (!isResolved && remainingMs <= 0);

    return {
      windowId: coerceString(rich.windowId),
      cardId: coerceString(rich.cardId, cardId) ?? cardId,
      durationMs,
      remainingMs,
      openedAtTick:
        typeof rich.openedAtTick === 'number' && Number.isFinite(rich.openedAtTick)
          ? rich.openedAtTick
          : null,
      openedAtMs:
        typeof rich.openedAtMs === 'number' && Number.isFinite(rich.openedAtMs)
          ? rich.openedAtMs
          : null,
      expiresAtMs:
        typeof rich.expiresAtMs === 'number' && Number.isFinite(rich.expiresAtMs)
          ? rich.expiresAtMs
          : null,
      autoResolve: coerceString(rich.autoResolve),
      isOnHold: Boolean(rich.isOnHold),
      isExpired,
      isResolved,
    };
  }, [cardId, storeWindow]);

  const minimalWindow = useMemo<MinimalDecisionWindowEntry | null>(() => {
    if (richWindow) return null;
    if (!isMinimalWindowShape(storeWindow)) return null;

    return {
      cardId: storeWindow.cardId,
      durationMs: Math.max(1, storeWindow.durationMs),
      openedAtTick: storeWindow.openedAtTick,
      autoResolve:
        typeof storeWindow.autoResolve === 'string' ? storeWindow.autoResolve : '-1',
    };
  }, [richWindow, storeWindow]);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (richWindow) {
      const nextProgressPct =
        richWindow.durationMs > 0
          ? clamp01(richWindow.remainingMs / richWindow.durationMs)
          : 0;

      derivedAnchorStartedAtMsRef.current = null;
      lastWindowIdentityRef.current = richWindow.windowId ?? `rich:${richWindow.cardId}`;
      setDerivedRemainingMs(richWindow.remainingMs);
      setProgressPct(nextProgressPct);
      return;
    }

    if (!minimalWindow) {
      derivedAnchorStartedAtMsRef.current = null;
      lastWindowIdentityRef.current = null;
      setDerivedRemainingMs(0);
      setProgressPct(0);
      return;
    }

    const identity = `${minimalWindow.cardId}:${minimalWindow.openedAtTick}:${minimalWindow.durationMs}`;

    if (lastWindowIdentityRef.current !== identity) {
      const safeTickDurationMs =
        Number.isFinite(currentTickDurationMs) && currentTickDurationMs > 0
          ? currentTickDurationMs
          : 3_000;

      const elapsedTicks = Math.max(0, lastTickIndex - minimalWindow.openedAtTick);
      const estimatedElapsedMs = elapsedTicks * safeTickDurationMs;
      const estimatedStartedAtMs = Date.now() - estimatedElapsedMs;
      const estimatedRemainingMs = Math.max(
        0,
        minimalWindow.durationMs - estimatedElapsedMs,
      );

      derivedAnchorStartedAtMsRef.current = estimatedStartedAtMs;
      lastWindowIdentityRef.current = identity;
      setDerivedRemainingMs(estimatedRemainingMs);
      setProgressPct(clamp01(estimatedRemainingMs / minimalWindow.durationMs));
    }
  }, [currentTickDurationMs, lastTickIndex, minimalWindow, richWindow]);

  useEffect(() => {
    if (!minimalWindow || richWindow) {
      return undefined;
    }

    let cancelled = false;

    const tick = (): void => {
      if (cancelled) return;

      const startedAtMs = derivedAnchorStartedAtMsRef.current;
      if (startedAtMs === null) {
        setDerivedRemainingMs(minimalWindow.durationMs);
        setProgressPct(1);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const elapsedMs = Math.max(0, Date.now() - startedAtMs);
      const remainingMs = Math.max(0, minimalWindow.durationMs - elapsedMs);
      const nextProgressPct = clamp01(remainingMs / minimalWindow.durationMs);

      setDerivedRemainingMs(remainingMs);
      setProgressPct(nextProgressPct);

      if (remainingMs > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [minimalWindow, richWindow]);

  const windowView = useMemo<DecisionWindowView | null>(() => {
    if (richWindow) {
      return richWindow;
    }

    if (!minimalWindow) {
      return null;
    }

    const startedAtMs = derivedAnchorStartedAtMsRef.current;
    const remainingMs = Math.max(0, derivedRemainingMs);

    return {
      windowId: null,
      cardId: minimalWindow.cardId,
      durationMs: minimalWindow.durationMs,
      remainingMs,
      openedAtTick: minimalWindow.openedAtTick,
      openedAtMs: startedAtMs,
      expiresAtMs:
        startedAtMs !== null ? startedAtMs + minimalWindow.durationMs : null,
      autoResolve: minimalWindow.autoResolve,
      isOnHold: false,
      isExpired: remainingMs <= 0,
      isResolved: false,
    };
  }, [derivedRemainingMs, minimalWindow, richWindow]);

  const safeProgressPct = clamp01(progressPct);
  const safeRemainingMs = Math.max(0, windowView?.remainingMs ?? 0);

  return {
    hasWindow: windowView !== null,
    window: windowView,
    progressPct: safeProgressPct,
    remainingMs: safeRemainingMs,
    isOnHold: windowView?.isOnHold ?? false,
    isUrgent: safeProgressPct < 0.25,
    isCritical: safeProgressPct < 0.1,
    isExpired: windowView?.isExpired ?? true,
    isResolved: windowView?.isResolved ?? false,
  };
}