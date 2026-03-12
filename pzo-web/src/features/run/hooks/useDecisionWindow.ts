/**
 * FILE: pzo-web/src/features/run/hooks/useDecisionWindow.ts
 * POINT ZERO ONE — ENGINE 1 DECISION WINDOW HOOK
 *
 * This hook supports BOTH of the store shapes that have existed in the Time lane:
 *
 * 1) Minimal store entry shape currently present in engineStore:
 *    {
 *      cardId: string;
 *      durationMs: number;
 *      openedAtTick: number;
 *      autoResolve: string;
 *    }
 *
 * 2) Rich countdown window shape expected by the Time Engine spec:
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEngineStore } from '../../../store/engineStore';

type UnknownStoreWindow = Record<string, unknown>;

interface MinimalDecisionWindowEntry {
  cardId: string;
  durationMs: number;
  openedAtTick: number;
  autoResolve: string;
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

function isRichWindowShape(value: UnknownStoreWindow | null): boolean {
  return !!value && typeof value.remainingMs === 'number';
}

function isMinimalWindowShape(value: UnknownStoreWindow | null): value is UnknownStoreWindow & MinimalDecisionWindowEntry {
  return !!value
    && typeof value.cardId === 'string'
    && typeof value.durationMs === 'number'
    && typeof value.openedAtTick === 'number';
}

function coerceNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function coerceString(value: unknown, fallback: string | null = null): string | null {
  return typeof value === 'string' ? value : fallback;
}

export function useDecisionWindow(cardId: string): UseDecisionWindowResult {
  const storeWindow = useEngineStore(
    (s) =>
      ((s.time.activeDecisionWindows as unknown[]).find((w) => {
        const candidate = w as UnknownStoreWindow;
        return candidate?.cardId === cardId;
      }) as UnknownStoreWindow | undefined) ?? null,
  );

  const lastTickIndex = useEngineStore((s) => s.run.lastTickIndex);
  const currentTickDurationMs = useEngineStore((s) => s.time.currentTickDurationMs);

  const [progressPct, setProgressPct] = useState<number>(1);
  const [derivedRemainingMs, setDerivedRemainingMs] = useState<number>(0);

  const rafRef = useRef<number | null>(null);
  const derivedAnchorStartedAtMsRef = useRef<number | null>(null);
  const derivedInitialRemainingMsRef = useRef<number>(0);
  const lastWindowIdentityRef = useRef<string | null>(null);

  const richWindow = useMemo<DecisionWindowView | null>(() => {
    if (!isRichWindowShape(storeWindow)) return null;

    const durationMs = Math.max(1, coerceNumber(storeWindow.durationMs, 1));
    const remainingMs = Math.max(0, coerceNumber(storeWindow.remainingMs, durationMs));
    const isOnHold = Boolean(storeWindow.isOnHold);
    const isExpired = Boolean(storeWindow.isExpired) || remainingMs <= 0;
    const isResolved = Boolean(storeWindow.isResolved);

    return {
      windowId: coerceString(storeWindow.windowId),
      cardId: coerceString(storeWindow.cardId, cardId) ?? cardId,
      durationMs,
      remainingMs,
      openedAtTick:
        typeof storeWindow.openedAtTick === 'number' ? storeWindow.openedAtTick : null,
      openedAtMs:
        typeof storeWindow.openedAtMs === 'number' ? storeWindow.openedAtMs : null,
      expiresAtMs:
        typeof storeWindow.expiresAtMs === 'number' ? storeWindow.expiresAtMs : null,
      autoResolve: coerceString(storeWindow.autoResolve),
      isOnHold,
      isExpired,
      isResolved,
    };
  }, [cardId, storeWindow]);

  const minimalWindow = useMemo<MinimalDecisionWindowEntry | null>(() => {
    if (!isMinimalWindowShape(storeWindow)) return null;
    return {
      cardId: storeWindow.cardId,
      durationMs: Math.max(1, storeWindow.durationMs),
      openedAtTick: storeWindow.openedAtTick,
      autoResolve: storeWindow.autoResolve,
    };
  }, [storeWindow]);

  /**
   * Re-anchor the client-side countdown whenever a new minimal window instance appears.
   * Since the minimal store entry does not carry remainingMs/openedAtMs, we estimate
   * elapsed time from tick distance first, then animate locally from there.
   */
  useEffect(() => {
    if (richWindow) {
      derivedAnchorStartedAtMsRef.current = null;
      derivedInitialRemainingMsRef.current = 0;
      lastWindowIdentityRef.current = richWindow.windowId ?? `rich:${richWindow.cardId}`;
      return;
    }

    if (!minimalWindow) {
      derivedAnchorStartedAtMsRef.current = null;
      derivedInitialRemainingMsRef.current = 0;
      lastWindowIdentityRef.current = null;
      setDerivedRemainingMs(0);
      setProgressPct(0);
      return;
    }

    const identity = `${minimalWindow.cardId}:${minimalWindow.openedAtTick}:${minimalWindow.durationMs}`;
    if (lastWindowIdentityRef.current === identity) return;

    lastWindowIdentityRef.current = identity;

    const safeTickDurationMs =
      Number.isFinite(currentTickDurationMs) && currentTickDurationMs > 0
        ? currentTickDurationMs
        : 3000;

    const elapsedTicks = Math.max(0, lastTickIndex - minimalWindow.openedAtTick);
    const elapsedByTickEstimateMs = elapsedTicks * safeTickDurationMs;
    const initialRemainingMs = Math.max(
      0,
      minimalWindow.durationMs - elapsedByTickEstimateMs,
    );

    derivedAnchorStartedAtMsRef.current = Date.now();
    derivedInitialRemainingMsRef.current = initialRemainingMs;
    setDerivedRemainingMs(initialRemainingMs);
    setProgressPct(initialRemainingMs / minimalWindow.durationMs);
  }, [currentTickDurationMs, lastTickIndex, minimalWindow, richWindow]);

  const animate = useCallback((): void => {
    if (richWindow) {
      const pct = richWindow.durationMs > 0
        ? Math.max(0, Math.min(1, richWindow.remainingMs / richWindow.durationMs))
        : 0;

      setDerivedRemainingMs(richWindow.remainingMs);
      setProgressPct(pct);

      if (!richWindow.isExpired && !richWindow.isResolved && !richWindow.isOnHold && pct > 0) {
        rafRef.current = requestAnimationFrame(animate);
      }
      return;
    }

    if (!minimalWindow) {
      setDerivedRemainingMs(0);
      setProgressPct(0);
      return;
    }

    const startedAtMs = derivedAnchorStartedAtMsRef.current;
    const initialRemainingMs = derivedInitialRemainingMsRef.current;

    if (startedAtMs === null) {
      const fallbackRemaining = minimalWindow.durationMs;
      setDerivedRemainingMs(fallbackRemaining);
      setProgressPct(1);
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const elapsedMs = Math.max(0, Date.now() - startedAtMs);
    const remainingMs = Math.max(0, initialRemainingMs - elapsedMs);
    const pct = minimalWindow.durationMs > 0
      ? Math.max(0, Math.min(1, remainingMs / minimalWindow.durationMs))
      : 0;

    setDerivedRemainingMs(remainingMs);
    setProgressPct(pct);

    if (remainingMs > 0) {
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [minimalWindow, richWindow]);

  useEffect(() => {
    if (!storeWindow) return undefined;

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [animate, storeWindow]);

  const windowView = useMemo<DecisionWindowView | null>(() => {
    if (richWindow) {
      return {
        ...richWindow,
        remainingMs: derivedRemainingMs || richWindow.remainingMs,
        isExpired: richWindow.isExpired || (derivedRemainingMs <= 0 && !richWindow.isResolved),
      };
    }

    if (!minimalWindow) return null;

    const remainingMs = Math.max(0, derivedRemainingMs);
    return {
      windowId: null,
      cardId: minimalWindow.cardId,
      durationMs: minimalWindow.durationMs,
      remainingMs,
      openedAtTick: minimalWindow.openedAtTick,
      openedAtMs: derivedAnchorStartedAtMsRef.current,
      expiresAtMs:
        derivedAnchorStartedAtMsRef.current !== null
          ? derivedAnchorStartedAtMsRef.current + derivedInitialRemainingMsRef.current
          : null,
      autoResolve: minimalWindow.autoResolve,
      isOnHold: false,
      isExpired: remainingMs <= 0,
      isResolved: false,
    };
  }, [derivedRemainingMs, minimalWindow, richWindow]);

  const safeRemainingMs = windowView?.remainingMs ?? 0;
  const safeProgressPct = Math.max(0, Math.min(1, progressPct));

  return {
    hasWindow: !!windowView,
    window: windowView,
    progressPct: safeProgressPct,
    remainingMs: safeRemainingMs,
    isOnHold: windowView?.isOnHold ?? false,
    isUrgent: safeProgressPct < 0.25,
    isCritical: safeProgressPct < 0.10,
    isExpired: windowView?.isExpired ?? true,
    isResolved: windowView?.isResolved ?? false,
  };
}