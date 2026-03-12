/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/types.ts
 *
 * Doctrine:
 * - backend time is authoritative for cadence, elapsed budget, and decision expiry
 * - cadence tiers preserve frontend semantic intent while remaining backend-safe
 * - timing math must be deterministic, serializable, and STEP_02_TIME-owned
 * - helpers here are pure, side-effect free, and safe for runtime + tests
 * - additive growth is preferred over breaking renames
 */

import type { PressureTier, RunPhase } from '../core/GamePrimitives';

export type TickTier = PressureTier;

export interface TickTierTiming {
  readonly tier: TickTier;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly defaultDurationMs: number;
  readonly decisionWindowMs: number;
  readonly visualBorderClass: string;
  readonly audioSignal: string | null;
  readonly screenShake: boolean;
}

export interface PhaseBoundary {
  readonly phase: RunPhase;
  readonly startsAtMs: number;
}

export interface InterpolationState {
  readonly fromTier: TickTier;
  readonly toTier: TickTier;
  readonly fromDurationMs: number;
  readonly toDurationMs: number;
  readonly totalTicks: number;
  readonly ticksRemaining: number;
}

export interface DecisionWindowState {
  readonly windowId: string;
  readonly deadlineMs: number;
  readonly frozenUntilMs: number | null;
}

export interface DecisionWindowClosed {
  readonly windowId: string;
  readonly accepted: boolean;
  readonly reason: 'EXPIRED' | 'RESOLVED' | 'NULLIFIED';
}

export interface DecisionTimerSyncResult {
  readonly openedWindowIds: readonly string[];
  readonly removedWindowIds: readonly string[];
}

export const BACKEND_TIME_SCHEMA_VERSION = 'backend-time.v2' as const;
export const DEFAULT_HOLD_DURATION_MS = 5_000;
export const DEFAULT_PHASE_TRANSITION_WINDOWS = 5;
export const MAX_DECISION_WINDOWS_PER_RUN = 256;

export const TICK_TIER_CONFIGS: Readonly<Record<TickTier, TickTierTiming>> =
  Object.freeze({
    T0: Object.freeze({
      tier: 'T0',
      minDurationMs: 18_000,
      maxDurationMs: 22_000,
      defaultDurationMs: 20_000,
      decisionWindowMs: 12_000,
      visualBorderClass: 'border-sovereign',
      audioSignal: 'tick_sovereign',
      screenShake: false,
    }),
    T1: Object.freeze({
      tier: 'T1',
      minDurationMs: 12_000,
      maxDurationMs: 14_000,
      defaultDurationMs: 13_000,
      decisionWindowMs: 8_000,
      visualBorderClass: 'border-stable',
      audioSignal: 'tick_standard',
      screenShake: false,
    }),
    T2: Object.freeze({
      tier: 'T2',
      minDurationMs: 7_000,
      maxDurationMs: 9_000,
      defaultDurationMs: 8_000,
      decisionWindowMs: 5_000,
      visualBorderClass: 'border-compressed',
      audioSignal: 'tick_compressed',
      screenShake: false,
    }),
    T3: Object.freeze({
      tier: 'T3',
      minDurationMs: 3_000,
      maxDurationMs: 5_000,
      defaultDurationMs: 4_000,
      decisionWindowMs: 3_000,
      visualBorderClass: 'border-crisis',
      audioSignal: 'tick_crisis',
      screenShake: false,
    }),
    T4: Object.freeze({
      tier: 'T4',
      minDurationMs: 1_000,
      maxDurationMs: 2_000,
      defaultDurationMs: 1_500,
      decisionWindowMs: 1_500,
      visualBorderClass: 'border-collapse',
      audioSignal: 'tick_collapse',
      screenShake: true,
    }),
  });

export const TIER_DURATIONS_MS: Readonly<Record<TickTier, number>> =
  Object.freeze({
    T0: TICK_TIER_CONFIGS.T0.defaultDurationMs,
    T1: TICK_TIER_CONFIGS.T1.defaultDurationMs,
    T2: TICK_TIER_CONFIGS.T2.defaultDurationMs,
    T3: TICK_TIER_CONFIGS.T3.defaultDurationMs,
    T4: TICK_TIER_CONFIGS.T4.defaultDurationMs,
  });

export const DECISION_WINDOW_DURATIONS_MS: Readonly<Record<TickTier, number>> =
  Object.freeze({
    T0: TICK_TIER_CONFIGS.T0.decisionWindowMs,
    T1: TICK_TIER_CONFIGS.T1.decisionWindowMs,
    T2: TICK_TIER_CONFIGS.T2.decisionWindowMs,
    T3: TICK_TIER_CONFIGS.T3.decisionWindowMs,
    T4: TICK_TIER_CONFIGS.T4.decisionWindowMs,
  });

export const PHASE_BOUNDARIES_MS: readonly PhaseBoundary[] = Object.freeze([
  Object.freeze({ phase: 'FOUNDATION', startsAtMs: 0 }),
  Object.freeze({ phase: 'ESCALATION', startsAtMs: 4 * 60 * 1_000 }),
  Object.freeze({ phase: 'SOVEREIGNTY', startsAtMs: 8 * 60 * 1_000 }),
]);

export function isTickTier(value: string): value is TickTier {
  return (
    value === 'T0' ||
    value === 'T1' ||
    value === 'T2' ||
    value === 'T3' ||
    value === 'T4'
  );
}

export function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export function clampTickDurationMs(
  tier: TickTier,
  durationMs: number,
): number {
  const config = TICK_TIER_CONFIGS[tier];
  const normalized = clampNonNegativeInteger(durationMs);

  if (normalized <= 0) {
    return config.defaultDurationMs;
  }

  return Math.min(
    config.maxDurationMs,
    Math.max(config.minDurationMs, normalized),
  );
}

export function computeInterpolationTickCount(deltaMs: number): number {
  if (deltaMs > 8_000) {
    return 4;
  }

  if (deltaMs > 4_000) {
    return 3;
  }

  return 2;
}

export function resolveTickDurationMs(
  tier: TickTier,
  durationMs?: number,
): number {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return TICK_TIER_CONFIGS[tier].defaultDurationMs;
  }

  return clampTickDurationMs(tier, durationMs);
}

export function resolveDecisionWindowDurationMs(
  tier: TickTier,
  durationMs?: number,
): number {
  const fallback = TICK_TIER_CONFIGS[tier].decisionWindowMs;

  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return fallback;
  }

  return Math.max(100, Math.trunc(durationMs));
}

export function resolvePhaseFromElapsedMs(elapsedMs: number): RunPhase {
  let current: RunPhase = PHASE_BOUNDARIES_MS[0]?.phase ?? 'FOUNDATION';

  for (const boundary of PHASE_BOUNDARIES_MS) {
    if (elapsedMs >= boundary.startsAtMs) {
      current = boundary.phase;
    }
  }

  return current;
}

export function dedupeTags(
  tags: readonly string[],
  ...nextTags: Array<string | null | undefined | false>
): readonly string[] {
  const merged = new Set<string>(tags);

  for (const tag of nextTags) {
    if (typeof tag === 'string' && tag.length > 0) {
      merged.add(tag);
    }
  }

  return [...merged];
}