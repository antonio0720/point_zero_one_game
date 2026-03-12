/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — TIME STORE HANDLERS
 * pzo-web/src/store/handlers/timeHandlers.ts
 *
 * Purpose:
 *   Normalize EventBus payloads for Engine 1 and apply them to the Zustand time
 *   slice with deterministic, mutation-safe writes.
 *
 * Design rules:
 *   - Store handlers are the only writers for the time slice.
 *   - Handlers accept both current repo payloads and the richer Engine 1 spec.
 *   - No component imports EventBus directly.
 *   - No handler assumes a single event envelope shape.
 *
 * Compatibility lanes supported:
 *   1. Current repo events emitted by frontend TimeEngine / Orchestrator.
 *   2. Expanded Time Engine spec payloads with DecisionWindow objects.
 *   3. Legacy compatibility payloads already consumed by engineStore.ts.
 *
 * Density6 LLC · Point Zero One · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { TickTier } from '../../engines/zero/types';

export interface TimeDecisionWindowView {
  windowId: string;
  cardId: string;
  durationMs: number;
  remainingMs: number;
  openedAtTick: number;
  openedAtMs: number | null;
  expiresAtMs: number | null;
  autoResolveChoice: string | number | null;
  isOnHold: boolean;
  holdExpiresAtMs: number | null;
  isExpired: boolean;
  isResolved: boolean;
}

export interface TimeSliceView {
  currentTier: TickTier | null;
  previousTier: TickTier | null;
  ticksElapsed: number;
  seasonTickBudget: number;
  ticksRemaining: number;
  holdsRemaining: number;
  activeDecisionWindows: TimeDecisionWindowView[];
  currentTickDurationMs: number;
  isTierTransitioning: boolean;
  seasonTimeoutImminent: boolean;
  ticksUntilTimeout: number;
  lastTickTimestamp: number | null;
  isRunActive: boolean;
}

export interface TimeStoreWriteShape {
  time: TimeSliceView;
  run?: {
    lastTickIndex?: number;
  };
}

export type TimeStoreSet<State extends TimeStoreWriteShape = TimeStoreWriteShape> = (
  updater: (state: State) => void,
) => void;

export interface TickTierChangedPayloadLike {
  from?: unknown;
  to?: unknown;
  previousTier?: unknown;
  newTier?: unknown;
  transitionTicks?: unknown;
  interpolationTicks?: unknown;
  tickIndex?: unknown;
  newDuration?: unknown;
  newDurationMs?: unknown;
  tickDurationMs?: unknown;
}

export interface TickCompletePayloadLike {
  tickIndex?: unknown;
  tickNumber?: unknown;
  tier?: unknown;
  tickTier?: unknown;
  previousTier?: unknown;
  tickDurationMs?: unknown;
  currentTickDurationMs?: unknown;
  ticksRemaining?: unknown;
  seasonBudget?: unknown;
  seasonTickBudget?: unknown;
  timeoutImminent?: unknown;
  timestamp?: unknown;
  isTierTransitioning?: unknown;
}

export interface DecisionWindowOpenedPayloadLike {
  window?: {
    windowId?: unknown;
    cardId?: unknown;
    durationMs?: unknown;
    remainingMs?: unknown;
    openedAtMs?: unknown;
    expiresAtMs?: unknown;
    holdExpiresAtMs?: unknown;
    worstOptionIndex?: unknown;
    isOnHold?: unknown;
    isExpired?: unknown;
    isResolved?: unknown;
  };
  windowId?: unknown;
  cardId?: unknown;
  durationMs?: unknown;
  remainingMs?: unknown;
  openedAtTick?: unknown;
  openedAtMs?: unknown;
  expiresAtMs?: unknown;
  holdExpiresAtMs?: unknown;
  autoResolveChoice?: unknown;
  autoResolvedToOptionIndex?: unknown;
  worstOptionIndex?: unknown;
  isOnHold?: unknown;
  isExpired?: unknown;
  isResolved?: unknown;
}

export interface DecisionWindowClosedPayloadLike {
  windowId?: unknown;
  cardId?: unknown;
}

export interface HoldActionUsedPayloadLike {
  windowId?: unknown;
  holdExpiresAtMs?: unknown;
  holdsRemaining?: unknown;
  holdsRemainingInRun?: unknown;
}

export interface RunStartedPayloadLike {
  tickBudget?: unknown;
  seasonTickBudget?: unknown;
  seasonBudget?: unknown;
}

export interface TimeoutPayloadLike {
  ticksRemaining?: unknown;
  seasonBudget?: unknown;
  seasonTickBudget?: unknown;
}

const TIER_NAME_MAP: Readonly<Record<string, TickTier>> = {
  T0: TickTier.SOVEREIGN,
  T1: TickTier.STABLE,
  T2: TickTier.COMPRESSED,
  T3: TickTier.CRISIS,
  T4: TickTier.COLLAPSE_IMMINENT,
  SOVEREIGN: TickTier.SOVEREIGN,
  STABLE: TickTier.STABLE,
  COMPRESSED: TickTier.COMPRESSED,
  CRISIS: TickTier.CRISIS,
  COLLAPSE_IMMINENT: TickTier.COLLAPSE_IMMINENT,
};

export function createDefaultTimeSlice(): TimeSliceView {
  return {
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
    lastTickTimestamp: null,
    isRunActive: false,
  };
}

function coerceNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function coerceNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function coerceBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function coerceTickTier(value: unknown, fallback: TickTier | null = null): TickTier | null {
  return typeof value === 'string' && value in TIER_NAME_MAP
    ? TIER_NAME_MAP[value]
    : fallback;
}

function coerceStringOrNumber(value: unknown): string | number | null {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}

function normalizeRunBudget(payload: RunStartedPayloadLike | number): number {
  if (typeof payload === 'number' && Number.isFinite(payload)) {
    return Math.max(0, Math.floor(payload));
  }

  return Math.max(
    0,
    Math.floor(
      coerceNumber(payload.tickBudget, coerceNumber(payload.seasonTickBudget, coerceNumber(payload.seasonBudget, 0))),
    ),
  );
}

function normalizeDecisionWindow(
  payload: DecisionWindowOpenedPayloadLike,
  openedAtTick: number,
): TimeDecisionWindowView {
  const source = payload.window ?? payload;
  const cardId = String(source.cardId ?? payload.cardId ?? 'UNKNOWN_CARD');
  const windowId = String(source.windowId ?? payload.windowId ?? `${cardId}::${openedAtTick}`);
  const durationMs = Math.max(0, coerceNumber(source.durationMs ?? payload.durationMs, 0));
  const remainingMs = Math.max(0, coerceNumber(source.remainingMs ?? payload.remainingMs, durationMs));

  return {
    windowId,
    cardId,
    durationMs,
    remainingMs,
    openedAtTick,
    openedAtMs: coerceNullableNumber(source.openedAtMs ?? payload.openedAtMs),
    expiresAtMs: coerceNullableNumber(source.expiresAtMs ?? payload.expiresAtMs),
    autoResolveChoice: coerceStringOrNumber(
      source.worstOptionIndex ??
      payload.worstOptionIndex ??
      payload.autoResolvedToOptionIndex ??
      payload.autoResolveChoice,
    ),
    isOnHold: coerceBoolean(source.isOnHold ?? payload.isOnHold, false),
    holdExpiresAtMs: coerceNullableNumber(source.holdExpiresAtMs ?? payload.holdExpiresAtMs),
    isExpired: coerceBoolean(source.isExpired ?? payload.isExpired, false),
    isResolved: coerceBoolean(source.isResolved ?? payload.isResolved, false),
  };
}

function upsertDecisionWindow(
  windows: TimeDecisionWindowView[],
  window: TimeDecisionWindowView,
): TimeDecisionWindowView[] {
  const next = windows.filter((entry) => entry.windowId !== window.windowId && entry.cardId !== window.cardId);
  next.push(window);
  return next.sort((a, b) => {
    if (a.remainingMs !== b.remainingMs) return a.remainingMs - b.remainingMs;
    if (a.openedAtTick !== b.openedAtTick) return a.openedAtTick - b.openedAtTick;
    return a.windowId.localeCompare(b.windowId);
  });
}

function closeDecisionWindow(
  windows: TimeDecisionWindowView[],
  payload: DecisionWindowClosedPayloadLike | string,
): TimeDecisionWindowView[] {
  const targetWindowId = typeof payload === 'string' ? payload : (typeof payload.windowId === 'string' ? payload.windowId : null);
  const targetCardId = typeof payload === 'string' ? null : (typeof payload.cardId === 'string' ? payload.cardId : null);

  return windows.filter((entry) => {
    if (targetWindowId && entry.windowId === targetWindowId) return false;
    if (targetCardId && entry.cardId === targetCardId) return false;
    return true;
  });
}

export const timeStoreHandlers = {
  onRunStarted<State extends TimeStoreWriteShape>(set: TimeStoreSet<State>, payload: RunStartedPayloadLike | number): void {
    const tickBudget = normalizeRunBudget(payload);

    set((state) => {
      state.time = {
        ...createDefaultTimeSlice(),
        seasonTickBudget: tickBudget,
        ticksRemaining: tickBudget,
        isRunActive: true,
      } as State['time'];
    });
  },

  onRunEnded<State extends TimeStoreWriteShape>(set: TimeStoreSet<State>): void {
    set((state) => {
      state.time.activeDecisionWindows = [];
      state.time.isRunActive = false;
      state.time.isTierTransitioning = false;
      state.time.seasonTimeoutImminent = false;
    });
  },

  onTickComplete<State extends TimeStoreWriteShape>(set: TimeStoreSet<State>, payload: TickCompletePayloadLike): void {
    set((state) => {
      const tickIndex = Math.max(0, Math.floor(coerceNumber(payload.tickIndex, coerceNumber(payload.tickNumber, state.time.ticksElapsed))));
      const currentTier = coerceTickTier(payload.tier, coerceTickTier(payload.tickTier, state.time.currentTier));
      const seasonTickBudget = Math.max(
        0,
        Math.floor(
          coerceNumber(payload.seasonTickBudget, coerceNumber(payload.seasonBudget, state.time.seasonTickBudget)),
        ),
      );
      const ticksRemaining = Math.max(
        0,
        Math.floor(
          coerceNumber(payload.ticksRemaining, Math.max(0, seasonTickBudget - tickIndex)),
        ),
      );

      state.time.ticksElapsed = tickIndex;
      state.time.currentTier = currentTier;
      state.time.previousTier = coerceTickTier(payload.previousTier, state.time.previousTier);
      state.time.currentTickDurationMs = Math.max(
        0,
        Math.floor(coerceNumber(payload.tickDurationMs, coerceNumber(payload.currentTickDurationMs, state.time.currentTickDurationMs))),
      );
      state.time.seasonTickBudget = seasonTickBudget;
      state.time.ticksRemaining = ticksRemaining;
      state.time.seasonTimeoutImminent = coerceBoolean(payload.timeoutImminent, ticksRemaining <= 20 && seasonTickBudget > 0);
      state.time.ticksUntilTimeout = ticksRemaining;
      state.time.lastTickTimestamp = coerceNullableNumber(payload.timestamp) ?? Date.now();
      state.time.isRunActive = true;

      if (typeof payload.isTierTransitioning === 'boolean') {
        state.time.isTierTransitioning = payload.isTierTransitioning;
      }
    });
  },

  onTickTierChanged<State extends TimeStoreWriteShape>(set: TimeStoreSet<State>, payload: TickTierChangedPayloadLike): void {
    set((state) => {
      const from = coerceTickTier(payload.from, coerceTickTier(payload.previousTier, state.time.currentTier));
      const to = coerceTickTier(payload.to, coerceTickTier(payload.newTier, state.time.currentTier));

      state.time.previousTier = from;
      state.time.currentTier = to;
      state.time.isTierTransitioning = Math.max(
        0,
        Math.floor(coerceNumber(payload.transitionTicks, coerceNumber(payload.interpolationTicks, 0))),
      ) > 0;

      const nextDuration = Math.max(
        0,
        Math.floor(coerceNumber(payload.newDurationMs, coerceNumber(payload.newDuration, coerceNumber(payload.tickDurationMs, state.time.currentTickDurationMs)))),
      );

      if (nextDuration > 0) {
        state.time.currentTickDurationMs = nextDuration;
      }
    });
  },

  onTickTierForced<State extends TimeStoreWriteShape>(set: TimeStoreSet<State>, payload: { tier?: unknown }): void {
    set((state) => {
      state.time.previousTier = state.time.currentTier;
      state.time.currentTier = coerceTickTier(payload.tier, state.time.currentTier);
      state.time.isTierTransitioning = false;
    });
  },

  onDecisionWindowOpened<State extends TimeStoreWriteShape>(set: TimeStoreSet<State>, payload: DecisionWindowOpenedPayloadLike): void {
    set((state) => {
      const openedAtTick = Math.max(
        0,
        Math.floor(coerceNumber(payload.openedAtTick, state.run?.lastTickIndex ?? state.time.ticksElapsed)),
      );
      const window = normalizeDecisionWindow(payload, openedAtTick);
      state.time.activeDecisionWindows = upsertDecisionWindow(state.time.activeDecisionWindows, window);
    });
  },

  onDecisionWindowClosed<State extends TimeStoreWriteShape>(
    set: TimeStoreSet<State>,
    payload: DecisionWindowClosedPayloadLike | string,
  ): void {
    set((state) => {
      state.time.activeDecisionWindows = closeDecisionWindow(state.time.activeDecisionWindows, payload);
    });
  },

  onDecisionWindowTick<State extends TimeStoreWriteShape>(
    set: TimeStoreSet<State>,
    payload: { windowId?: unknown; cardId?: unknown; remainingMs?: unknown },
  ): void {
    set((state) => {
      const windowId = typeof payload.windowId === 'string' ? payload.windowId : null;
      const cardId = typeof payload.cardId === 'string' ? payload.cardId : null;
      const remainingMs = Math.max(0, Math.floor(coerceNumber(payload.remainingMs, 0)));

      state.time.activeDecisionWindows = state.time.activeDecisionWindows.map((entry) => {
        if ((windowId && entry.windowId === windowId) || (cardId && entry.cardId === cardId)) {
          return { ...entry, remainingMs };
        }
        return entry;
      });
    });
  },

  onHoldUsed<State extends TimeStoreWriteShape>(set: TimeStoreSet<State>, payload: HoldActionUsedPayloadLike): void {
    set((state) => {
      const windowId = typeof payload.windowId === 'string' ? payload.windowId : null;
      state.time.holdsRemaining = Math.max(
        0,
        Math.floor(coerceNumber(payload.holdsRemaining, coerceNumber(payload.holdsRemainingInRun, state.time.holdsRemaining))),
      );

      state.time.activeDecisionWindows = state.time.activeDecisionWindows.map((entry) => {
        if (windowId && entry.windowId === windowId) {
          return {
            ...entry,
            isOnHold: true,
            holdExpiresAtMs: coerceNullableNumber(payload.holdExpiresAtMs),
          };
        }
        return entry;
      });
    });
  },

  onSeasonTimeoutImminent<State extends TimeStoreWriteShape>(set: TimeStoreSet<State>, payload: TimeoutPayloadLike): void {
    set((state) => {
      const budget = Math.max(
        state.time.seasonTickBudget,
        Math.floor(coerceNumber(payload.seasonTickBudget, coerceNumber(payload.seasonBudget, state.time.seasonTickBudget))),
      );
      const ticksRemaining = Math.max(
        0,
        Math.floor(coerceNumber(payload.ticksRemaining, state.time.ticksRemaining)),
      );

      state.time.seasonTickBudget = budget;
      state.time.seasonTimeoutImminent = true;
      state.time.ticksUntilTimeout = ticksRemaining;
      state.time.ticksRemaining = ticksRemaining;
    });
  },
};

export type TimeStoreHandlers = typeof timeStoreHandlers;
