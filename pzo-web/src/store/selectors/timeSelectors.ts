/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — TIME STORE SELECTORS
 * pzo-web/src/store/selectors/timeSelectors.ts
 *
 * Pure read helpers for Engine 1 state. These selectors are intentionally thin,
 * deterministic, and UI-safe. No selector mutates state or touches EventBus.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import type { TickTier } from '../../engines/zero/types';
import type { TimeDecisionWindowView, TimeSliceView } from '../handlers/timeHandlers';

export interface TimeSelectorRootState {
  time: TimeSliceView;
}

export interface TimeHudSnapshot {
  currentTier: TickTier | null;
  previousTier: TickTier | null;
  ticksElapsed: number;
  seasonTickBudget: number;
  ticksRemaining: number;
  tickProgressPct: number;
  currentTickDurationMs: number;
  secondsPerTick: number;
  holdsRemaining: number;
  activeDecisionWindowCount: number;
  hasActiveDecisionWindow: boolean;
  isTierTransitioning: boolean;
  seasonTimeoutImminent: boolean;
  ticksUntilTimeout: number;
  isRunActive: boolean;
}

export const selectTimeSlice = <State extends TimeSelectorRootState>(state: State): TimeSliceView => state.time;

export const selectCurrentTier = <State extends TimeSelectorRootState>(state: State): TickTier | null =>
  state.time.currentTier;

export const selectPreviousTier = <State extends TimeSelectorRootState>(state: State): TickTier | null =>
  state.time.previousTier;

export const selectTicksElapsed = <State extends TimeSelectorRootState>(state: State): number =>
  state.time.ticksElapsed;

export const selectSeasonTickBudget = <State extends TimeSelectorRootState>(state: State): number =>
  state.time.seasonTickBudget;

export const selectTicksRemaining = <State extends TimeSelectorRootState>(state: State): number =>
  state.time.ticksRemaining;

export const selectTickProgressPct = <State extends TimeSelectorRootState>(state: State): number => {
  const budget = state.time.seasonTickBudget;
  return budget <= 0 ? 0 : Math.min(1, state.time.ticksElapsed / budget);
};

export const selectCurrentTickDurationMs = <State extends TimeSelectorRootState>(state: State): number =>
  state.time.currentTickDurationMs;

export const selectSecondsPerTick = <State extends TimeSelectorRootState>(state: State): number =>
  Math.max(0, Math.round(state.time.currentTickDurationMs / 1000));

export const selectHoldsRemaining = <State extends TimeSelectorRootState>(state: State): number =>
  state.time.holdsRemaining;

export const selectActiveDecisionWindows = <State extends TimeSelectorRootState>(state: State): TimeDecisionWindowView[] =>
  state.time.activeDecisionWindows;

export const selectActiveDecisionWindowCount = <State extends TimeSelectorRootState>(state: State): number =>
  state.time.activeDecisionWindows.length;

export const selectHasActiveDecisionWindow = <State extends TimeSelectorRootState>(state: State): boolean =>
  state.time.activeDecisionWindows.length > 0;

export const selectIsTierTransitioning = <State extends TimeSelectorRootState>(state: State): boolean =>
  state.time.isTierTransitioning;

export const selectSeasonTimeoutImminent = <State extends TimeSelectorRootState>(state: State): boolean =>
  state.time.seasonTimeoutImminent;

export const selectTicksUntilTimeout = <State extends TimeSelectorRootState>(state: State): number =>
  state.time.ticksUntilTimeout;

export const selectLastTickTimestamp = <State extends TimeSelectorRootState>(state: State): number | null =>
  state.time.lastTickTimestamp;

export const selectIsRunActive = <State extends TimeSelectorRootState>(state: State): boolean =>
  state.time.isRunActive;

export const selectDecisionWindowByCardId =
  (cardId: string) =>
  <State extends TimeSelectorRootState>(state: State): TimeDecisionWindowView | null =>
    state.time.activeDecisionWindows.find((window) => window.cardId === cardId) ?? null;

export const selectDecisionWindowByWindowId =
  (windowId: string) =>
  <State extends TimeSelectorRootState>(state: State): TimeDecisionWindowView | null =>
    state.time.activeDecisionWindows.find((window) => window.windowId === windowId) ?? null;

export const selectDecisionWindowsSortedByUrgency = <State extends TimeSelectorRootState>(
  state: State,
): TimeDecisionWindowView[] =>
  [...state.time.activeDecisionWindows].sort((a, b) => {
    if (a.remainingMs !== b.remainingMs) return a.remainingMs - b.remainingMs;
    if (a.openedAtTick !== b.openedAtTick) return a.openedAtTick - b.openedAtTick;
    return a.windowId.localeCompare(b.windowId);
  });

export const selectMostUrgentDecisionWindow = <State extends TimeSelectorRootState>(
  state: State,
): TimeDecisionWindowView | null =>
  selectDecisionWindowsSortedByUrgency(state)[0] ?? null;

export const selectTimeHudSnapshot = <State extends TimeSelectorRootState>(state: State): TimeHudSnapshot => ({
  currentTier: state.time.currentTier,
  previousTier: state.time.previousTier,
  ticksElapsed: state.time.ticksElapsed,
  seasonTickBudget: state.time.seasonTickBudget,
  ticksRemaining: state.time.ticksRemaining,
  tickProgressPct: selectTickProgressPct(state),
  currentTickDurationMs: state.time.currentTickDurationMs,
  secondsPerTick: selectSecondsPerTick(state),
  holdsRemaining: state.time.holdsRemaining,
  activeDecisionWindowCount: state.time.activeDecisionWindows.length,
  hasActiveDecisionWindow: state.time.activeDecisionWindows.length > 0,
  isTierTransitioning: state.time.isTierTransitioning,
  seasonTimeoutImminent: state.time.seasonTimeoutImminent,
  ticksUntilTimeout: state.time.ticksUntilTimeout,
  isRunActive: state.time.isRunActive,
});
