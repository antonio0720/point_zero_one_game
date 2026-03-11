/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/types.ts
 *
 * Doctrine:
 * - backend time is authoritative for cadence, elapsed budget, and decision expiry
 * - cadence tiers preserve frontend semantic intent but remain backend-safe
 * - timing math must be deterministic, serializable, and step-02 owned
 * - helpers here are pure and side-effect free
 */

import type { PressureTier, RunPhase } from '../core/GamePrimitives';

export interface TickTierTiming {
  readonly tier: PressureTier;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly defaultDurationMs: number;
  readonly decisionWindowMs: number;
}

export const TICK_TIER_CONFIGS: Readonly<Record<PressureTier, TickTierTiming>> = Object.freeze({
  T0: Object.freeze({
    tier: 'T0',
    minDurationMs: 18_000,
    maxDurationMs: 22_000,
    defaultDurationMs: 20_000,
    decisionWindowMs: 12_000,
  }),
  T1: Object.freeze({
    tier: 'T1',
    minDurationMs: 12_000,
    maxDurationMs: 14_000,
    defaultDurationMs: 13_000,
    decisionWindowMs: 8_000,
  }),
  T2: Object.freeze({
    tier: 'T2',
    minDurationMs: 7_000,
    maxDurationMs: 9_000,
    defaultDurationMs: 8_000,
    decisionWindowMs: 5_000,
  }),
  T3: Object.freeze({
    tier: 'T3',
    minDurationMs: 3_000,
    maxDurationMs: 5_000,
    defaultDurationMs: 4_000,
    decisionWindowMs: 3_000,
  }),
  T4: Object.freeze({
    tier: 'T4',
    minDurationMs: 1_000,
    maxDurationMs: 2_000,
    defaultDurationMs: 1_500,
    decisionWindowMs: 1_500,
  }),
});

export const TIER_DURATIONS_MS: Readonly<Record<PressureTier, number>> = Object.freeze({
  T0: TICK_TIER_CONFIGS.T0.defaultDurationMs,
  T1: TICK_TIER_CONFIGS.T1.defaultDurationMs,
  T2: TICK_TIER_CONFIGS.T2.defaultDurationMs,
  T3: TICK_TIER_CONFIGS.T3.defaultDurationMs,
  T4: TICK_TIER_CONFIGS.T4.defaultDurationMs,
});

export const DECISION_WINDOW_DURATIONS_MS: Readonly<Record<PressureTier, number>> = Object.freeze({
  T0: TICK_TIER_CONFIGS.T0.decisionWindowMs,
  T1: TICK_TIER_CONFIGS.T1.decisionWindowMs,
  T2: TICK_TIER_CONFIGS.T2.decisionWindowMs,
  T3: TICK_TIER_CONFIGS.T3.decisionWindowMs,
  T4: TICK_TIER_CONFIGS.T4.decisionWindowMs,
});

export const DEFAULT_HOLD_DURATION_MS = 5_000;
export const DEFAULT_PHASE_TRANSITION_WINDOWS = 5;

export const PHASE_BOUNDARIES_MS: ReadonlyArray<Readonly<{ phase: RunPhase; startsAtMs: number }>> =
  Object.freeze([
    Object.freeze({ phase: 'FOUNDATION', startsAtMs: 0 }),
    Object.freeze({ phase: 'ESCALATION', startsAtMs: 4 * 60 * 1_000 }),
    Object.freeze({ phase: 'SOVEREIGNTY', startsAtMs: 8 * 60 * 1_000 }),
  ]);

export interface InterpolationState {
  readonly fromTier: PressureTier;
  readonly toTier: PressureTier;
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

export function computeInterpolationTickCount(deltaMs: number): number {
  if (deltaMs > 8_000) {
    return 4;
  }
  if (deltaMs > 4_000) {
    return 3;
  }
  return 2;
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

export function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

export function dedupeTags(
  tags: readonly string[],
  ...nextTags: Array<string | null | undefined | false>
): readonly string[] {
  const merged = new Set(tags);

  for (const tag of nextTags) {
    if (typeof tag === 'string' && tag.length > 0) {
      merged.add(tag);
    }
  }

  return [...merged];
}