// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/features/run/hooks/useTickTierEffects.ts

/**
 * FILE: pzo-web/src/features/run/hooks/useTickTierEffects.ts
 * Engine 1 — Tick tier side-effect hook
 *
 * Purpose:
 * - translate current tick tier into DOM-safe visual / audio / telemetry effects
 * - avoid importing TimeEngine directly
 * - centralize tier-change reactions for RunScreen / HUD surfaces
 *
 * Behavior:
 * - writes a stable data attribute to <html> for CSS / telemetry inspection
 * - optionally toggles a screen-shake class on a target element when collapse tier fires
 * - emits a CustomEvent for audio / analytics systems to consume
 * - safe on SSR / test environments
 *
 * Important:
 * - this hook is wired to the live useTimeEngine() contract
 * - it derives previous-tier and effect metadata locally instead of assuming
 *   a richer TICK_TIER_CONFIGS export exists in the current repo
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { TickTier } from '../../../engines/zero/types';
import { useTimeEngine } from './useTimeEngine';

export interface UseTickTierEffectsOptions {
  targetRef?: RefObject<HTMLElement | null>;
  rootDataAttributePrefix?: string;
  screenShakeClassName?: string;
  screenShakeDurationMs?: number;
  enableDomAttributes?: boolean;
  enableAudioEvent?: boolean;
  enableScreenShake?: boolean;
  onTierChanged?: (payload: {
    previousTier: TickTier | null;
    currentTier: TickTier;
    audioSignal: string | null;
    screenShake: boolean;
  }) => void;
}

export interface UseTickTierEffectsResult {
  currentTier: TickTier;
  previousTier: TickTier | null;
  audioSignal: string | null;
  borderClassName: string;
  screenShakeActive: boolean;
  isCollapseTier: boolean;
  isTransitioning: boolean;
}

const DEFAULT_OPTIONS: Required<
  Pick<
    UseTickTierEffectsOptions,
    | 'rootDataAttributePrefix'
    | 'screenShakeClassName'
    | 'screenShakeDurationMs'
    | 'enableDomAttributes'
    | 'enableAudioEvent'
    | 'enableScreenShake'
  >
> = {
  rootDataAttributePrefix: 'pzoTime',
  screenShakeClassName: 'screen-shake',
  screenShakeDurationMs: 500,
  enableDomAttributes: true,
  enableAudioEvent: true,
  enableScreenShake: true,
};

const TIER_EFFECTS: Record<
  TickTier,
  { visualBorderClass: string; audioSignal: string | null; screenShake: boolean }
> = {
  [TickTier.SOVEREIGN]: {
    visualBorderClass: 'border-sovereign',
    audioSignal: 'tick_sovereign',
    screenShake: false,
  },
  [TickTier.STABLE]: {
    visualBorderClass: 'border-stable',
    audioSignal: 'tick_standard',
    screenShake: false,
  },
  [TickTier.COMPRESSED]: {
    visualBorderClass: 'border-compressed',
    audioSignal: 'tick_compressed',
    screenShake: false,
  },
  [TickTier.CRISIS]: {
    visualBorderClass: 'border-crisis',
    audioSignal: 'tick_crisis',
    screenShake: false,
  },
  [TickTier.COLLAPSE_IMMINENT]: {
    visualBorderClass: 'border-collapse',
    audioSignal: 'tick_collapse',
    screenShake: true,
  },
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getTargetElement(targetRef?: RefObject<HTMLElement | null>): HTMLElement | null {
  if (!isBrowser()) return null;
  return targetRef?.current ?? document.documentElement;
}

export function useTickTierEffects(
  options: UseTickTierEffectsOptions = {},
): UseTickTierEffectsResult {
  const {
    currentTier,
    tickDurationMs,
    isTierTransitioning,
    seasonTimeoutImminent,
    ticksUntilTimeout,
  } = useTimeEngine();

  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const config = useMemo(() => TIER_EFFECTS[currentTier], [currentTier]);

  const [previousTier, setPreviousTier] = useState<TickTier | null>(null);
  const [screenShakeActive, setScreenShakeActive] = useState<boolean>(false);

  const lastSeenTierRef = useRef<TickTier | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const lastSeenTier = lastSeenTierRef.current;

    if (lastSeenTier === null) {
      lastSeenTierRef.current = currentTier;
      return;
    }

    if (lastSeenTier !== currentTier) {
      setPreviousTier(lastSeenTier);
      lastSeenTierRef.current = currentTier;
      return;
    }

    lastSeenTierRef.current = currentTier;
  }, [currentTier]);

  useEffect(() => {
    if (!isBrowser() || !resolvedOptions.enableDomAttributes) return;

    const root = document.documentElement;
    const prefix = resolvedOptions.rootDataAttributePrefix;

    root.dataset[`${prefix}Tier`] = currentTier;
    root.dataset[`${prefix}TierTransitioning`] = String(Boolean(isTierTransitioning));
    root.dataset[`${prefix}BorderClass`] = config.visualBorderClass;
    root.dataset[`${prefix}Audio`] = config.audioSignal ?? '';
    root.dataset[`${prefix}Shake`] = String(Boolean(config.screenShake));
    root.dataset[`${prefix}TimeoutImminent`] = String(Boolean(seasonTimeoutImminent));
    root.dataset[`${prefix}TicksUntilTimeout`] = String(
      Number.isFinite(ticksUntilTimeout) ? ticksUntilTimeout : '',
    );
    root.dataset[`${prefix}TickDurationMs`] = String(
      Number.isFinite(tickDurationMs) ? tickDurationMs : '',
    );

    return () => {
      delete root.dataset[`${prefix}TierTransitioning`];
      delete root.dataset[`${prefix}TimeoutImminent`];
      delete root.dataset[`${prefix}TicksUntilTimeout`];
      delete root.dataset[`${prefix}TickDurationMs`];
    };
  }, [
    config.audioSignal,
    config.screenShake,
    config.visualBorderClass,
    currentTier,
    isTierTransitioning,
    resolvedOptions.enableDomAttributes,
    resolvedOptions.rootDataAttributePrefix,
    seasonTimeoutImminent,
    tickDurationMs,
    ticksUntilTimeout,
  ]);

  useEffect(() => {
    if (!isBrowser()) return;

    const previous = lastSeenTierRef.current;
    const tierActuallyChanged = previous !== null && previous !== currentTier;

    if (!tierActuallyChanged) {
      return;
    }

    const payload = {
      previousTier: previous,
      currentTier,
      audioSignal: config.audioSignal,
      screenShake: config.screenShake,
    };

    options.onTierChanged?.(payload);

    if (resolvedOptions.enableAudioEvent && config.audioSignal) {
      window.dispatchEvent(
        new CustomEvent('pzo:time:tier-audio', {
          detail: {
            tier: currentTier,
            audioSignal: config.audioSignal,
            timestamp: Date.now(),
          },
        }),
      );
    }

    window.dispatchEvent(
      new CustomEvent('pzo:time:tier-changed', {
        detail: {
          previousTier: previous,
          currentTier,
          borderClassName: config.visualBorderClass,
          audioSignal: config.audioSignal,
          screenShake: config.screenShake,
          isTierTransitioning,
          seasonTimeoutImminent,
          ticksUntilTimeout,
          tickDurationMs,
          timestamp: Date.now(),
        },
      }),
    );
  }, [
    config.audioSignal,
    config.screenShake,
    config.visualBorderClass,
    currentTier,
    isTierTransitioning,
    options,
    resolvedOptions.enableAudioEvent,
    seasonTimeoutImminent,
    tickDurationMs,
    ticksUntilTimeout,
  ]);

  useEffect(() => {
    if (!isBrowser()) return;
    if (!resolvedOptions.enableScreenShake) return;

    const lastSeenTier = lastSeenTierRef.current;
    const tierActuallyChanged = lastSeenTier !== null && lastSeenTier !== currentTier;
    if (!tierActuallyChanged) return;
    if (!config.screenShake) return;

    const target = getTargetElement(options.targetRef);
    if (!target) return;

    if (shakeTimeoutRef.current !== null) {
      window.clearTimeout(shakeTimeoutRef.current);
      shakeTimeoutRef.current = null;
    }

    setScreenShakeActive(true);
    target.classList.add(resolvedOptions.screenShakeClassName);

    shakeTimeoutRef.current = window.setTimeout(() => {
      target.classList.remove(resolvedOptions.screenShakeClassName);
      setScreenShakeActive(false);
      shakeTimeoutRef.current = null;
    }, resolvedOptions.screenShakeDurationMs);

    return () => {
      if (shakeTimeoutRef.current !== null) {
        window.clearTimeout(shakeTimeoutRef.current);
        shakeTimeoutRef.current = null;
      }
      target.classList.remove(resolvedOptions.screenShakeClassName);
      setScreenShakeActive(false);
    };
  }, [
    config.screenShake,
    currentTier,
    options.targetRef,
    resolvedOptions.enableScreenShake,
    resolvedOptions.screenShakeClassName,
    resolvedOptions.screenShakeDurationMs,
  ]);

  return {
    currentTier,
    previousTier,
    audioSignal: config.audioSignal,
    borderClassName: config.visualBorderClass,
    screenShakeActive,
    isCollapseTier: currentTier === TickTier.COLLAPSE_IMMINENT,
    isTransitioning: Boolean(isTierTransitioning),
  };
}

export default useTickTierEffects;