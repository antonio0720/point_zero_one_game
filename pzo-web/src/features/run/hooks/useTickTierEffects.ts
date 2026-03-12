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
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { TICK_TIER_CONFIGS, TickTier } from '../../../engines/time/types';
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

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getTargetElement(targetRef?: RefObject<HTMLElement | null>): HTMLElement | null {
  if (!isBrowser()) return null;
  return targetRef?.current ?? document.documentElement;
}

export function useTickTierEffects(options: UseTickTierEffectsOptions = {}): UseTickTierEffectsResult {
  const {
    currentTier,
    previousTier,
    tierChangedThisTick,
    visualBorderClass,
    screenShake,
    audioSignal,
  } = useTimeEngine();

  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const shakeTimeoutRef = useRef<number | null>(null);
  const lastEmittedTierRef = useRef<TickTier | null>(null);
  const [screenShakeActive, setScreenShakeActive] = useState<boolean>(false);

  const config = useMemo(() => TICK_TIER_CONFIGS[currentTier], [currentTier]);
  const isCollapseTier = currentTier === TickTier.COLLAPSE_IMMINENT;

  useEffect(() => {
    if (!isBrowser() || !resolvedOptions.enableDomAttributes) return;

    const root = document.documentElement;
    const prefix = resolvedOptions.rootDataAttributePrefix;

    root.dataset[`${prefix}Tier`] = currentTier;
    root.dataset[`${prefix}TierChanged`] = String(Boolean(tierChangedThisTick));
    root.dataset[`${prefix}Audio`] = audioSignal ?? '';
    root.dataset[`${prefix}Shake`] = String(Boolean(screenShake));

    return () => {
      if (!document.documentElement) return;
      delete document.documentElement.dataset[`${prefix}TierChanged`];
    };
  }, [
    currentTier,
    tierChangedThisTick,
    audioSignal,
    screenShake,
    resolvedOptions.enableDomAttributes,
    resolvedOptions.rootDataAttributePrefix,
  ]);

  useEffect(() => {
    if (!isBrowser()) return;
    if (!tierChangedThisTick && lastEmittedTierRef.current === currentTier) return;

    lastEmittedTierRef.current = currentTier;

    const payload = {
      previousTier,
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
          previousTier,
          currentTier,
          borderClassName: config.visualBorderClass,
          audioSignal: config.audioSignal,
          screenShake: config.screenShake,
          timestamp: Date.now(),
        },
      }),
    );
  }, [
    currentTier,
    previousTier,
    tierChangedThisTick,
    config.audioSignal,
    config.screenShake,
    config.visualBorderClass,
    options,
    resolvedOptions.enableAudioEvent,
  ]);

  useEffect(() => {
    if (!isBrowser()) return;
    if (!resolvedOptions.enableScreenShake) return;
    if (!config.screenShake) return;
    if (!tierChangedThisTick) return;

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
    currentTier,
    tierChangedThisTick,
    config.screenShake,
    options.targetRef,
    resolvedOptions.enableScreenShake,
    resolvedOptions.screenShakeClassName,
    resolvedOptions.screenShakeDurationMs,
  ]);

  return {
    currentTier,
    previousTier,
    audioSignal,
    borderClassName: visualBorderClass,
    screenShakeActive,
    isCollapseTier,
    isTransitioning: Boolean(tierChangedThisTick),
  };
}