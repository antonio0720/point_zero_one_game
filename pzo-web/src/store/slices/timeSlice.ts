/**
 * POINT ZERO ONE — FRONTEND TIME SLICE
 * File: pzo-web/src/store/slices/timeSlice.ts
 *
 * Purpose:
 * - Extract the Time Engine slice out of the monolithic engineStore.ts
 * - Preserve the currently live store contract already present in the repo
 * - Add stronger payload normalization so multiple generations of engine events
 *   can be consumed without breaking the UI layer
 *
 * Notes:
 * - This file is intentionally store-framework-light. It exports pure state,
 *   pure draft mutators, and handler wrappers.
 * - It is designed to be imported by engineStore.ts OR by external event-binding
 *   modules that want to update the store through useEngineStore.setState(...)
 */

import type { TickTier } from '../../engines/core/types';

export interface DecisionWindowEntry {
  /** Stable per-window identifier when present. Falls back to cardId in older payloads. */
  windowId: string;
  /** Card identifier attached to the window. */
  cardId: string;
  /** Countdown duration at open time. */
  durationMs: number;
  /** Remaining milliseconds if known. */
  remainingMs: number;
  /** Tick index at which the window opened. */
  openedAtTick: number;
  /** Wall-clock timestamp when the window opened. */
  openedAtMs: number;
  /** Wall-clock timestamp when the window will expire if known. */
  expiresAtMs: number | null;
  /** Auto-resolve choice / sentinel / option label. */
  autoResolve: string;
  /** Tick tier active when the window opened. */
  tierAtOpen: TickTier | null;
  /** Whether a hold is active on this window. */
  isOnHold: boolean;
  /** Hold expiry timestamp, if any. */
  holdExpiresAtMs: number | null;
  /** Whether the window is already resolved. */
  isResolved: boolean;
  /** Whether the window expired by timeout. */
  isExpired: boolean;
}

export interface TimeEngineStoreSlice {
  time: {
    currentTier: TickTier | null;
    previousTier: TickTier | null;
    ticksElapsed: number;
    seasonTickBudget: number;
    ticksRemaining: number;
    holdsRemaining: number;
    activeDecisionWindows: DecisionWindowEntry[];
    currentTickDurationMs: number;
    isTierTransitioning: boolean;
    seasonTimeoutImminent: boolean;
    ticksUntilTimeout: number;
  };
}

/**
 * Minimal carrier shape so this file can mutate an engineStore draft without
 * importing the full EngineStoreState and introducing hard cycles.
 */
export interface TimeSliceStateCarrier {
  time: TimeEngineStoreSlice['time'];
  run?: {
    lastTickIndex?: number;
    lastTickDurationMs?: number;
  };
}

export type TimeTierChangedPayload =
  | {
      from: TickTier;
      to: TickTier;
      transitionTicks?: number;
      previousDuration?: number;
      newDuration?: number;
    }
  | {
      previousTier: TickTier;
      newTier: TickTier;
      transitionTicks?: number;
      previousDuration?: number;
      newDuration?: number;
      tickIndex?: number;
      pressureScore?: number;
      multiplier?: number;
    };

export interface TimeTickCompletePayload {
  tickIndex?: number;
  tickNumber?: number;
  tickDurationMs?: number;
  outcome?: 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED' | null;
  tickBudget?: number;
  seasonTickBudget?: number;
  ticksRemaining?: number;
}

export interface DecisionWindowOpenedPayload {
  windowId?: string;
  cardId: string;
  durationMs: number;
  remainingMs?: number;
  openedAtTick?: number;
  openedAtMs?: number;
  expiresAtMs?: number | null;
  autoResolveChoice?: string;
  autoResolve?: string;
  tierAtOpen?: TickTier | null;
  isOnHold?: boolean;
  holdExpiresAtMs?: number | null;
}

export interface DecisionWindowCountdownPayload {
  /**
   * Coalesced map emitted by the existing orchestrator patch pattern:
   * Record<windowId|cardId, remainingMs>
   */
  [windowIdOrCardId: string]: number;
}

export interface HoldUsedPayload {
  windowId?: string;
  cardId?: string;
  holdsRemaining?: number;
  holdExpiresAtMs?: number | null;
}

export interface SeasonTimeoutImminentPayload {
  ticksRemaining: number;
}

export const defaultTimeSlice: TimeEngineStoreSlice = {
  time: {
    currentTier: null,
    previousTier: null,
    ticksElapsed: 0,
    seasonTickBudget: 0,
    ticksRemaining: 0,
    holdsRemaining: 1,
    activeDecisionWindows: [],
    currentTickDurationMs: 3_000,
    isTierTransitioning: false,
    seasonTimeoutImminent: false,
    ticksUntilTimeout: 0,
  },
};

function ensureNonNegativeInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

function normalizeTierChangedPayload(payload: TimeTierChangedPayload): {
  from: TickTier;
  to: TickTier;
  transitionTicks: number;
  newDurationMs: number | null;
} {
  const from = 'from' in payload ? payload.from : payload.previousTier;
  const to = 'to' in payload ? payload.to : payload.newTier;
  const transitionTicks = ensureNonNegativeInt(payload.transitionTicks ?? 0, 0);
  const newDurationMs = typeof payload.newDuration === 'number'
    ? ensureNonNegativeInt(payload.newDuration, 0)
    : null;

  return { from, to, transitionTicks, newDurationMs };
}

function normalizeDecisionWindowOpenedPayload(
  state: TimeSliceStateCarrier,
  payload: DecisionWindowOpenedPayload,
): DecisionWindowEntry {
  const openedAtTick = ensureNonNegativeInt(
    payload.openedAtTick ?? state.run?.lastTickIndex ?? state.time.ticksElapsed,
    0,
  );
  const openedAtMs = payload.openedAtMs ?? Date.now();
  const remainingMs = ensureNonNegativeInt(payload.remainingMs ?? payload.durationMs, payload.durationMs);
  const windowId = payload.windowId ?? payload.cardId;

  return {
    windowId,
    cardId: payload.cardId,
    durationMs: ensureNonNegativeInt(payload.durationMs, 0),
    remainingMs,
    openedAtTick,
    openedAtMs,
    expiresAtMs:
      payload.expiresAtMs ??
      (remainingMs > 0 ? openedAtMs + remainingMs : null),
    autoResolve: payload.autoResolveChoice ?? payload.autoResolve ?? 'WORST_OPTION',
    tierAtOpen: payload.tierAtOpen ?? state.time.currentTier,
    isOnHold: Boolean(payload.isOnHold),
    holdExpiresAtMs: payload.holdExpiresAtMs ?? null,
    isResolved: false,
    isExpired: false,
  };
}

function matchWindowIndex(
  windows: DecisionWindowEntry[],
  identifier: string,
): number {
  return windows.findIndex(
    (window) => window.windowId === identifier || window.cardId === identifier,
  );
}

export function resetTimeSliceDraft(state: TimeSliceStateCarrier): void {
  Object.assign(state.time, defaultTimeSlice.time);
}

export function applyTimeRunStartedDraft(
  state: TimeSliceStateCarrier,
  tickBudget: number,
): void {
  Object.assign(state.time, {
    ...defaultTimeSlice.time,
    seasonTickBudget: ensureNonNegativeInt(tickBudget, 0),
    ticksRemaining: ensureNonNegativeInt(tickBudget, 0),
  });
}

export function applyTimeRunEndedDraft(state: TimeSliceStateCarrier): void {
  state.time.activeDecisionWindows = [];
  state.time.isTierTransitioning = false;
  state.time.seasonTimeoutImminent = false;
  state.time.ticksUntilTimeout = 0;
}

export function applyTimeTickCompleteDraft(
  state: TimeSliceStateCarrier,
  payload: TimeTickCompletePayload,
): void {
  const tickIndex = ensureNonNegativeInt(
    payload.tickIndex ?? payload.tickNumber ?? state.time.ticksElapsed + 1,
    state.time.ticksElapsed,
  );
  const budget = ensureNonNegativeInt(
    payload.seasonTickBudget ?? payload.tickBudget ?? state.time.seasonTickBudget,
    state.time.seasonTickBudget,
  );

  state.time.ticksElapsed = tickIndex;
  state.time.seasonTickBudget = budget;
  state.time.ticksRemaining =
    typeof payload.ticksRemaining === 'number'
      ? ensureNonNegativeInt(payload.ticksRemaining, 0)
      : Math.max(0, budget - tickIndex);

  if (typeof payload.tickDurationMs === 'number' && Number.isFinite(payload.tickDurationMs)) {
    state.time.currentTickDurationMs = ensureNonNegativeInt(payload.tickDurationMs, 0);
  }

  if (state.run) {
    state.run.lastTickIndex = tickIndex;
    if (typeof payload.tickDurationMs === 'number') {
      state.run.lastTickDurationMs = ensureNonNegativeInt(payload.tickDurationMs, 0);
    }
  }

  state.time.seasonTimeoutImminent = state.time.ticksRemaining > 0 && state.time.ticksRemaining <= 3;
  state.time.ticksUntilTimeout = state.time.ticksRemaining;

  if (payload.outcome === 'TIMEOUT') {
    state.time.seasonTimeoutImminent = false;
    state.time.ticksUntilTimeout = 0;
  }
}

export function applyDecisionWindowCountdownDraft(
  state: TimeSliceStateCarrier,
  payload: DecisionWindowCountdownPayload,
): void {
  for (const [identifier, remainingMsRaw] of Object.entries(payload)) {
    const idx = matchWindowIndex(state.time.activeDecisionWindows, identifier);
    if (idx < 0) continue;

    const remainingMs = ensureNonNegativeInt(remainingMsRaw, 0);
    const window = state.time.activeDecisionWindows[idx];
    window.remainingMs = remainingMs;

    if (window.expiresAtMs !== null) {
      window.expiresAtMs = Date.now() + remainingMs;
    }

    if (remainingMs <= 0) {
      window.isExpired = true;
      window.isResolved = false;
    }
  }

  state.time.activeDecisionWindows = state.time.activeDecisionWindows.filter(
    (window) => !window.isExpired || window.remainingMs > 0,
  );
}

export const timeStoreHandlers = {
  onTickTierChangedDraft(
    state: TimeSliceStateCarrier,
    payload: TimeTierChangedPayload,
  ): void {
    const normalized = normalizeTierChangedPayload(payload);
    state.time.previousTier = normalized.from;
    state.time.currentTier = normalized.to;
    state.time.isTierTransitioning = normalized.transitionTicks > 0;

    if (normalized.newDurationMs !== null) {
      state.time.currentTickDurationMs = normalized.newDurationMs;
    }
  },

  onTickTierForcedDraft(
    state: TimeSliceStateCarrier,
    payload: { tier: TickTier; durationTicks?: number; newDurationMs?: number },
  ): void {
    state.time.previousTier = state.time.currentTier;
    state.time.currentTier = payload.tier;
    state.time.isTierTransitioning = false;

    if (typeof payload.newDurationMs === 'number') {
      state.time.currentTickDurationMs = ensureNonNegativeInt(payload.newDurationMs, 0);
    }
  },

  onDecisionWindowOpenedDraft(
    state: TimeSliceStateCarrier,
    payload: DecisionWindowOpenedPayload,
  ): void {
    const entry = normalizeDecisionWindowOpenedPayload(state, payload);
    const existingIdx = matchWindowIndex(state.time.activeDecisionWindows, entry.windowId);

    if (existingIdx >= 0) {
      state.time.activeDecisionWindows[existingIdx] = entry;
      return;
    }

    state.time.activeDecisionWindows = [...state.time.activeDecisionWindows, entry];
  },

  onDecisionWindowClosedDraft(
    state: TimeSliceStateCarrier,
    identifier: string,
  ): void {
    state.time.activeDecisionWindows = state.time.activeDecisionWindows.filter(
      (window) => window.windowId !== identifier && window.cardId !== identifier,
    );
  },

  onDecisionWindowExpiredDraft(
    state: TimeSliceStateCarrier,
    identifier: string,
  ): void {
    const idx = matchWindowIndex(state.time.activeDecisionWindows, identifier);
    if (idx < 0) return;

    state.time.activeDecisionWindows[idx].isExpired = true;
    state.time.activeDecisionWindows[idx].remainingMs = 0;
    state.time.activeDecisionWindows = state.time.activeDecisionWindows.filter(
      (window) => !(window.windowId === identifier || window.cardId === identifier),
    );
  },

  onDecisionWindowResolvedDraft(
    state: TimeSliceStateCarrier,
    identifier: string,
  ): void {
    const idx = matchWindowIndex(state.time.activeDecisionWindows, identifier);
    if (idx < 0) return;

    state.time.activeDecisionWindows[idx].isResolved = true;
    state.time.activeDecisionWindows = state.time.activeDecisionWindows.filter(
      (window) => !(window.windowId === identifier || window.cardId === identifier),
    );
  },

  onDecisionWindowTickDraft(
    state: TimeSliceStateCarrier,
    payload: DecisionWindowCountdownPayload,
  ): void {
    applyDecisionWindowCountdownDraft(state, payload);
  },

  onHoldUsedDraft(
    state: TimeSliceStateCarrier,
    payload: HoldUsedPayload,
  ): void {
    if (typeof payload.holdsRemaining === 'number') {
      state.time.holdsRemaining = ensureNonNegativeInt(payload.holdsRemaining, state.time.holdsRemaining);
    } else {
      state.time.holdsRemaining = Math.max(0, state.time.holdsRemaining - 1);
    }

    const identifier = payload.windowId ?? payload.cardId;
    if (!identifier) return;

    const idx = matchWindowIndex(state.time.activeDecisionWindows, identifier);
    if (idx < 0) return;

    state.time.activeDecisionWindows[idx].isOnHold = true;
    state.time.activeDecisionWindows[idx].holdExpiresAtMs = payload.holdExpiresAtMs ?? null;
  },

  onHoldReleasedDraft(
    state: TimeSliceStateCarrier,
    identifier: string,
  ): void {
    const idx = matchWindowIndex(state.time.activeDecisionWindows, identifier);
    if (idx < 0) return;

    state.time.activeDecisionWindows[idx].isOnHold = false;
    state.time.activeDecisionWindows[idx].holdExpiresAtMs = null;
  },

  onSeasonTimeoutImminentDraft(
    state: TimeSliceStateCarrier,
    payload: SeasonTimeoutImminentPayload,
  ): void {
    state.time.seasonTimeoutImminent = true;
    state.time.ticksUntilTimeout = ensureNonNegativeInt(payload.ticksRemaining, 0);
  },

  onRunStartedDraft(
    state: TimeSliceStateCarrier,
    tickBudget: number,
  ): void {
    applyTimeRunStartedDraft(state, tickBudget);
  },

  onRunEndedDraft(state: TimeSliceStateCarrier): void {
    applyTimeRunEndedDraft(state);
  },

  onTickCompleteDraft(
    state: TimeSliceStateCarrier,
    payload: TimeTickCompletePayload,
  ): void {
    applyTimeTickCompleteDraft(state, payload);
  },
};

export default timeStoreHandlers;
