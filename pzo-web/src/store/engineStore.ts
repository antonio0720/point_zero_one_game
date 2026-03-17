/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — UNIFIED ENGINE STORE
 * pzo-web/src/store/engineStore.ts
 *
 * Unified Zustand store for ALL engine state — Engines 0–7 + Card layer.
 * Bridges EventBus → React components via typed store slices.
 *
 * ARCHITECTURE:
 *   ✦ Only store handlers write to this store — never components or hooks.
 *   ✦ All writes are driven by EventBus events flushed at Step 13 of the tick.
 *   ✦ immer middleware enables mutation-style setters with structural immutability.
 *   ✦ Each engine slice has: interface · default · handlers · wire function.
 *   ✦ ZustandSet is the single typed setter shared by all handlers.
 *   ✦ wireAllEngineHandlers() is the canonical full-stack wiring entry point.
 *
 * CARD SLICE INTEGRATION:
 *   ✦ CardEngineStoreSlice is merged into EngineStoreState.
 *   ✦ defaultCardSlice() initializes the card sub-state.
 *   ✦ wireCardEngineHandlers() must be called separately via ModeRouter after
 *     CardEngine initialization, since card events use a separate EventBus instance.
 *
 * SLICES (8 + Card + Mechanics + Mirror):
 *   run          — Engine 0 orchestrator lifecycle
 *   time         — Engine 1 TimeEngine
 *   pressure     — Engine 2 PressureEngine
 *   tension      — Engine 3 TensionEngine
 *   shield       — Engine 4 ShieldEngine
 *   battle       — Engine 5 BattleEngine
 *   cascade      — Engine 6 CascadeEngine
 *   sovereignty  — Engine 7 SovereigntyEngine
 *   card         — CardEngine cross-mode state
 *   mechanics    — mechanics runtime activation/catalog state
 *   runtime      — mirror of runStore for shell/HUD selectors
 *
 * Density6 LLC · Point Zero One · Engines 0–7 + Cards · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ── Engine 0 core types ────────────────────────────────────────────────────────
import type {
  RunLifecycleState,
  RunOutcome,
  EngineId,
  EngineHealth,
  TickTier,
  PressureTier,
} from '../engines/zero/types';

// ── Engine 3 — Tension Engine types ───────────────────────────────────────────
import type {
  VisibilityState,
  TensionSnapshot,
  AnticipationEntry,
  TensionScoreUpdatedEvent,
  TensionVisibilityChangedEvent,
  TensionPulseFiredEvent,
  ThreatArrivedEvent,
  ThreatExpiredEvent,
} from '../engines/tension/types';

// ── Engine 4 — Shield Engine types ────────────────────────────────────────────
import type {
  ShieldSnapshot,
  ShieldLayerId,
  DamageResult,
  ShieldHitEvent,
  ShieldLayerBreachedEvent,
} from '../engines/shield/types';

// ── Engine 5 — Battle Engine types ────────────────────────────────────────────
import {
  BotState,
  type BattleSnapshot,
  type BattleBudgetState,
  type HaterBotRuntimeState,
  type InjectedCard,
  type BotStateChangedEvent,
  type BotAttackFiredEvent,
  type BattleSnapshotUpdatedEvent,
  type CardInjectedEvent,
  type InjectedCardExpiredEvent,
} from '../engines/battle/types';

// ── Engine 6 — Cascade Engine types ───────────────────────────────────────────
import type {
  CascadeSnapshot,
  CascadeChainInstance,
  ActivePositiveCascade,
  CascadeChainStartedEvent,
  CascadeLinkFiredEvent,
  CascadeChainBrokenEvent,
  CascadeChainCompletedEvent,
  CascadePositiveActivatedEvent,
  CascadePositiveDissolvedEvent,
  NemesisBrokenEvent,
  CascadeSnapshotUpdatedEvent,
} from '../engines/cascade/types';

// ── Engine 7 — Sovereignty Engine types ───────────────────────────────────────
import type {
  RunGrade,
  IntegrityStatus,
  GradeReward,
  SovereigntyScoreComponents,
  RunCompletedPayload,
  ProofVerificationFailedPayload,
} from '../engines/sovereignty/types';

// ── Card + mechanics slices ───────────────────────────────────────────────────
import {
  type CardEngineStoreSlice,
  defaultCardSlice,
} from './engineStore.card-slice';
import {
  type MechanicsRuntimeStoreSlice,
  defaultMechanicsSlice,
  wireMechanicsRuntimeHandlers,
} from './engineStore.mechanics-slice';
import {
  runStore,
  selectEngineStoreMirrorSnapshot,
  type EngineStoreMirrorSnapshot,
} from './runStore';

// ── EventBus ──────────────────────────────────────────────────────────────────
import type { EventBus } from '../engines/zero/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Engine 1 — Time Engine store-facing compatibility contracts
// ─────────────────────────────────────────────────────────────────────────────

type TimeDecisionCardType =
  | 'FORCED_FATE'
  | 'HATER_INJECTION'
  | 'CRISIS_EVENT';

interface TimeDecisionWindow {
  windowId: string;
  cardId: string;
  cardType: TimeDecisionCardType;
  durationMs: number;
  remainingMs: number;
  openedAtMs: number;
  expiresAtMs: number;
  isOnHold: boolean;
  holdExpiresAtMs: number | null;
  worstOptionIndex: number;
  isExpired: boolean;
  isResolved: boolean;
}

interface TickEvent {
  eventType: 'TICK_COMPLETE';
  tickNumber: number;
  tickDurationMs: number;
  tier: TickTier;
  tierChangedThisTick: boolean;
  previousTier: TickTier | null;
  timestamp: number;
  decisionsExpiredThisTick: string[];
  decisionsResolvedThisTick: string[];
  holdActionUsedThisTick: boolean;
}

interface TierChangeEvent {
  eventType: 'TICK_TIER_CHANGED';
  from: TickTier;
  to: TickTier;
  interpolationTicks: number;
  timestamp: number;
}

interface DecisionWindowOpenedEvent {
  eventType: 'DECISION_WINDOW_OPENED';
  window: TimeDecisionWindow;
}

interface DecisionWindowExpiredEvent {
  eventType: 'DECISION_WINDOW_EXPIRED';
  windowId: string;
  cardId: string;
  autoResolvedToOptionIndex: number;
  holdWasActive: boolean;
}

interface DecisionWindowResolvedEvent {
  eventType: 'DECISION_WINDOW_RESOLVED';
  windowId: string;
  cardId: string;
  chosenOptionIndex: number;
  msRemainingAtResolution: number;
}

interface HoldActionUsedEvent {
  eventType: 'HOLD_ACTION_USED';
  windowId: string;
  holdDurationMs: number;
  holdExpiresAtMs: number;
  holdsRemainingInRun: number;
}

interface RunTimeoutEvent {
  eventType: 'RUN_TIMEOUT';
  ticksElapsed: number;
  outcome: 'TIMEOUT';
}

type LegacyDecisionWindowOpenedPayload = {
  window?: TimeDecisionWindow;
  cardId?: string;
  durationMs?: number;
  autoResolveChoice?: string;
};

type LegacyHoldUsedPayload = {
  windowId?: string;
  holdsRemaining?: number;
  holdsRemainingInRun?: number;
  holdExpiresAtMs?: number;
};

// ── Engine 1 store-facing decision window shape ───────────────────────────────

interface DecisionWindowEntry extends TimeDecisionWindow {
  /**
   * Legacy compatibility field used by older card/UI consumers that expect a
   * string-based auto-resolve descriptor instead of worstOptionIndex.
   */
  autoResolve: string;

  /**
   * Alias retained for legacy payload producers that still emit
   * `autoResolveChoice` instead of a computed worst-option index.
   */
  autoResolveChoice?: string;
}

type RunStartedEventPayload = {
  runId: string;
  userId: string;
  seed: string;
  tickBudget?: number;
  seasonTickBudget?: number;
};

type RunEndedEventPayload = {
  runId: string;
  outcome: RunOutcome;
  finalNetWorth?: number;
  netWorth?: number;
};

type Unsubscribe = () => void;

// =============================================================================
// SECTION 1 — SLICE SHAPES
// =============================================================================

export interface RunLifecycleStoreSlice {
  run: {
    lifecycleState: RunLifecycleState;
    runId: string | null;
    userId: string | null;
    seed: string | null;
    tickBudget: number;
    outcome: RunOutcome | null;
    healthReport: Partial<Record<EngineId, EngineHealth>> | null;
    lastTickIndex: number;
    lastTickDurationMs: number;
  };
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
    lastTickTimestamp: number | null;
    tierChangedThisTick: boolean;
    isRunActive: boolean;
  };
}

export interface PressureEngineStoreSlice {
  pressure: {
    score: number;
    tier: PressureTier | null;
    previousTier: PressureTier | null;
    isCritical: boolean;
    triggerSignals: string[];
    postActionScore: number;
    stagnationCount: number;
    tickIndex: number;
  };
}

export interface TensionEngineStoreSlice {
  tension: {
    score: number;
    scoreHistory: readonly number[];
    visibilityState: VisibilityState;
    previousVisibilityState: VisibilityState | null;
    queueLength: number;
    arrivedCount: number;
    queuedCount: number;
    expiredCount: number;
    isPulseActive: boolean;
    pulseTicksActive: number;
    isSustainedPulse: boolean;
    isEscalating: boolean;
    sortedQueue: AnticipationEntry[];
    lastArrivedEntry: AnticipationEntry | null;
    lastExpiredEntry: AnticipationEntry | null;
    currentTick: number;
    isRunActive: boolean;
  };
}

export interface ShieldEngineStoreSlice {
  shield: {
    snapshot: ShieldSnapshot | null;
    overallIntegrityPct: number;
    weakestLayerId: ShieldLayerId | null;
    isFortified: boolean;
    cascadeCount: number;
    isInBreachCascade: boolean;
    isRunActive: boolean;
    lastDamageResult: DamageResult | null;
    lastBreachedLayerId: ShieldLayerId | null;
  };
}

export interface BattleEngineStoreSlice {
  battle: {
    snapshot: BattleSnapshot | null;
    budget: BattleBudgetState | null;
    haterHeat: number;
    injectedCards: InjectedCard[];
    activeBots: HaterBotRuntimeState[];
    activeBotsCount: number;
    lastStateChange: BotStateChangedEvent | null;
    lastAttackFired: BotAttackFiredEvent | null;
    isRunActive: boolean;
    tickNumber: number;
  };
}

export interface CascadeEngineStoreSlice {
  cascade: {
    snapshot: CascadeSnapshot | null;
    activeNegativeChains: CascadeChainInstance[];
    activePositiveCascades: ActivePositiveCascade[];
    totalLinksDefeated: number;
    latestChainStarted: CascadeChainStartedEvent | null;
    latestLinkFired: CascadeLinkFiredEvent | null;
    latestChainBroken: CascadeChainBrokenEvent | null;
    latestChainCompleted: CascadeChainCompletedEvent | null;
    latestPositiveActivated: CascadePositiveActivatedEvent | null;
    latestPositiveDissolved: CascadePositiveDissolvedEvent | null;
    nemesisBrokenEvents: NemesisBrokenEvent[];
    isRunActive: boolean;
    tickNumber: number;
  };
}

export interface SovereigntyEngineStoreSlice {
  sovereignty: {
    proofHash: string | null;
    grade: RunGrade | null;
    sovereigntyScore: number | null;
    integrityStatus: IntegrityStatus | null;
    pipelineStatus: 'IDLE' | 'RUNNING' | 'COMPLETE' | 'FAILED';
    reward: GradeReward | null;
    components: SovereigntyScoreComponents | null;
    lastFailureReason: string | null;
    lastFailureStep: 1 | 2 | 3 | null;
    isRunActive: boolean;
  };
}

export interface RunMirrorStoreSlice {
  runtime: EngineStoreMirrorSnapshot;
}

// =============================================================================
// SECTION 2 — ROOT STORE SHAPE
// =============================================================================

export type EngineStoreState =
  & RunLifecycleStoreSlice
  & TimeEngineStoreSlice
  & PressureEngineStoreSlice
  & TensionEngineStoreSlice
  & ShieldEngineStoreSlice
  & BattleEngineStoreSlice
  & CascadeEngineStoreSlice
  & SovereigntyEngineStoreSlice
  & RunMirrorStoreSlice
  & { card: CardEngineStoreSlice }
  & { mechanics: MechanicsRuntimeStoreSlice }
  & {
    card_resetSlice: () => void;
    resetAllSlices: () => void;
    syncRunMirror: (snapshot: EngineStoreMirrorSnapshot) => void;
  };

/** Typed immer setter — shared by ALL store handler functions. */
export type ZustandSet = (updater: (state: EngineStoreState) => void) => void;

// =============================================================================
// SECTION 3 — DEFAULT STATE
// =============================================================================

export const defaultRunSlice: RunLifecycleStoreSlice = {
  run: {
    lifecycleState: 'IDLE',
    runId: null,
    userId: null,
    seed: null,
    tickBudget: 0,
    outcome: null,
    healthReport: null,
    lastTickIndex: 0,
    lastTickDurationMs: 0,
  },
};

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
    lastTickTimestamp: null,
    tierChangedThisTick: false,
    isRunActive: false,
  },
};

export const defaultPressureSlice: PressureEngineStoreSlice = {
  pressure: {
    score: 0,
    tier: null,
    previousTier: null,
    isCritical: false,
    triggerSignals: [],
    postActionScore: 0,
    stagnationCount: 0,
    tickIndex: 0,
  },
};

export const defaultTensionSlice: TensionEngineStoreSlice = {
  tension: {
    score: 0,
    scoreHistory: [],
    visibilityState: 'SHADOWED' as VisibilityState,
    previousVisibilityState: null,
    queueLength: 0,
    arrivedCount: 0,
    queuedCount: 0,
    expiredCount: 0,
    isPulseActive: false,
    pulseTicksActive: 0,
    isSustainedPulse: false,
    isEscalating: false,
    sortedQueue: [],
    lastArrivedEntry: null,
    lastExpiredEntry: null,
    currentTick: 0,
    isRunActive: false,
  },
};

export const defaultShieldSlice: ShieldEngineStoreSlice = {
  shield: {
    snapshot: null,
    overallIntegrityPct: 1,
    weakestLayerId: null,
    isFortified: false,
    cascadeCount: 0,
    isInBreachCascade: false,
    isRunActive: false,
    lastDamageResult: null,
    lastBreachedLayerId: null,
  },
};

export const defaultBattleSlice: BattleEngineStoreSlice = {
  battle: {
    snapshot: null,
    budget: null,
    haterHeat: 0,
    injectedCards: [],
    activeBots: [],
    activeBotsCount: 0,
    lastStateChange: null,
    lastAttackFired: null,
    isRunActive: false,
    tickNumber: 0,
  },
};

export const defaultCascadeSlice: CascadeEngineStoreSlice = {
  cascade: {
    snapshot: null,
    activeNegativeChains: [],
    activePositiveCascades: [],
    totalLinksDefeated: 0,
    latestChainStarted: null,
    latestLinkFired: null,
    latestChainBroken: null,
    latestChainCompleted: null,
    latestPositiveActivated: null,
    latestPositiveDissolved: null,
    nemesisBrokenEvents: [],
    isRunActive: false,
    tickNumber: 0,
  },
};

export const defaultRuntimeSlice: RunMirrorStoreSlice = {
  runtime: {
    isInitialized: false,
    netWorth: 0,
    cashBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    cashflow: 0,
    haterHeat: 0,
    activeThreatCardCount: 0,
    runId: null,
    userId: null,
    seed: null,
    lastUpdated: null,
  },
};

export const defaultSovereigntySlice: SovereigntyEngineStoreSlice = {
  sovereignty: {
    proofHash: null,
    grade: null,
    sovereigntyScore: null,
    integrityStatus: null,
    pipelineStatus: 'IDLE',
    reward: null,
    components: null,
    lastFailureReason: null,
    lastFailureStep: null,
    isRunActive: false,
  },
};

function resetAllSlicesDraft(state: EngineStoreState): void {
  Object.assign(state.run, defaultRunSlice.run);
  Object.assign(state.time, defaultTimeSlice.time);
  Object.assign(state.pressure, defaultPressureSlice.pressure);
  Object.assign(state.tension, defaultTensionSlice.tension);
  Object.assign(state.shield, defaultShieldSlice.shield);
  Object.assign(state.battle, defaultBattleSlice.battle);
  Object.assign(state.cascade, defaultCascadeSlice.cascade);
  Object.assign(state.sovereignty, defaultSovereigntySlice.sovereignty);
  state.runtime = { ...defaultRuntimeSlice.runtime };
  state.card = defaultCardSlice();
  state.mechanics = defaultMechanicsSlice();
}

function applyRunMirrorDraft(
  state: EngineStoreState,
  snapshot: EngineStoreMirrorSnapshot,
): void {
  state.runtime = { ...snapshot };
}

function normalizeRunStartedPayload(
  payload: RunStartedEventPayload,
): { runId: string; userId: string; seed: string; tickBudget: number } {
  return {
    runId: payload.runId,
    userId: payload.userId,
    seed: payload.seed,
    tickBudget: payload.tickBudget ?? payload.seasonTickBudget ?? 0,
  };
}

function normalizeRunEndedPayload(
  payload: RunEndedEventPayload,
): { runId: string; outcome: RunOutcome; finalNetWorth: number } {
  return {
    runId: payload.runId,
    outcome: payload.outcome,
    finalNetWorth: payload.finalNetWorth ?? payload.netWorth ?? 0,
  };
}

function applyRunStartedAtomic(
  state: EngineStoreState,
  payload: { runId: string; userId: string; seed: string; tickBudget: number },
): void {
  Object.assign(state.run, {
    ...defaultRunSlice.run,
    lifecycleState: 'ACTIVE' as RunLifecycleState,
    runId: payload.runId,
    userId: payload.userId,
    seed: payload.seed,
    tickBudget: payload.tickBudget,
    outcome: null,
  });

  Object.assign(state.time, {
    ...defaultTimeSlice.time,
    seasonTickBudget: payload.tickBudget,
    ticksRemaining: payload.tickBudget,
    ticksUntilTimeout: payload.tickBudget,
    isRunActive: true,
  });

  Object.assign(state.pressure, { ...defaultPressureSlice.pressure });
  Object.assign(state.tension, { ...defaultTensionSlice.tension, isRunActive: true });
  Object.assign(state.shield, { ...defaultShieldSlice.shield, isRunActive: true });
  Object.assign(state.battle, { ...defaultBattleSlice.battle, isRunActive: true });
  Object.assign(state.cascade, { ...defaultCascadeSlice.cascade, isRunActive: true });
  Object.assign(state.sovereignty, { ...defaultSovereigntySlice.sovereignty, isRunActive: true });

  state.card = defaultCardSlice();
  state.mechanics = defaultMechanicsSlice();
  state.runtime = {
    ...state.runtime,
    isInitialized: true,
    runId: payload.runId,
    userId: payload.userId,
    seed: payload.seed,
    lastUpdated: Date.now(),
  };
}

function applyRunEndedAtomic(
  state: EngineStoreState,
  payload: { runId: string; outcome: RunOutcome; finalNetWorth: number },
): void {
  state.run.lifecycleState = 'ENDED';
  state.run.outcome = payload.outcome;

  state.time.activeDecisionWindows = [];
  state.time.isRunActive = false;
  state.time.isTierTransitioning = false;
  state.time.seasonTimeoutImminent = payload.outcome === 'TIMEOUT';
  state.time.ticksUntilTimeout = 0;

  state.pressure.isCritical = false;
  state.tension.isRunActive = false;
  state.shield.isRunActive = false;
  state.battle.isRunActive = false;
  state.cascade.isRunActive = false;
  state.sovereignty.isRunActive = false;

  state.runtime.netWorth = payload.finalNetWorth;
  state.runtime.lastUpdated = Date.now();
}

function applyTickCompleteAtomic(
  state: EngineStoreState,
  payload: {
    tickIndex: number;
    tickDurationMs: number;
    outcome: RunOutcome | null;
    timestamp?: number;
  },
): void {
  state.run.lastTickIndex = payload.tickIndex;
  state.run.lastTickDurationMs = payload.tickDurationMs;
  if (payload.outcome) state.run.outcome = payload.outcome;

  state.time.ticksElapsed = payload.tickIndex;
  state.time.currentTickDurationMs = payload.tickDurationMs;
  state.time.lastTickTimestamp = payload.timestamp ?? Date.now();
  state.time.ticksRemaining = Math.max(0, state.time.seasonTickBudget - payload.tickIndex);
  state.time.ticksUntilTimeout = state.time.ticksRemaining;
  state.time.seasonTimeoutImminent = state.time.ticksRemaining <= 5;
  state.time.tierChangedThisTick = false;

  if (state.pressure.score < 0.81) state.pressure.isCritical = false;

  if (!state.tension.isPulseActive) {
    state.tension.pulseTicksActive = 0;
    state.tension.isSustainedPulse = false;
  }
}

function normalizeTickCompletePayload(
  payload: Partial<TickEvent> & { tickIndex?: number; outcome?: RunOutcome | null },
): { tickIndex: number; tickDurationMs: number; outcome: RunOutcome | null; timestamp?: number } {
  return {
    tickIndex: payload.tickIndex ?? payload.tickNumber ?? 0,
    tickDurationMs: payload.tickDurationMs ?? 0,
    outcome: payload.outcome ?? null,
    timestamp: payload.timestamp,
  };
}

function normalizeTierChangePayload(
  payload: Partial<TierChangeEvent> & { transitionTicks?: number },
): { from: TickTier; to: TickTier; transitionTicks: number } {
  return {
    from: payload.from as TickTier,
    to: payload.to as TickTier,
    transitionTicks: payload.transitionTicks ?? payload.interpolationTicks ?? 0,
  };
}

function createLegacyDecisionWindowEntry(
  cardId: string,
  durationMs: number,
  openedAtTick: number,
  autoResolveChoice: string,
): DecisionWindowEntry {
  const now = Date.now();

  return {
    windowId: `${cardId}:${openedAtTick}:${now}`,
    cardId,
    cardType: 'FORCED_FATE',
    durationMs,
    remainingMs: durationMs,
    openedAtMs: now,
    expiresAtMs: now + durationMs,
    isOnHold: false,
    holdExpiresAtMs: null,
    worstOptionIndex: Number.isFinite(Number(autoResolveChoice))
      ? Number(autoResolveChoice)
      : -1,
    isExpired: false,
    isResolved: false,
    autoResolve: autoResolveChoice,
    autoResolveChoice,
  };
}

function normalizeDecisionWindowOpenedPayload(
  payload: DecisionWindowOpenedEvent | LegacyDecisionWindowOpenedPayload,
  openedAtTick: number,
): DecisionWindowEntry {
  if (
    'eventType' in payload &&
    payload.eventType === 'DECISION_WINDOW_OPENED' &&
    payload.window
  ) {
    return {
      ...payload.window,
      autoResolve: String(payload.window.worstOptionIndex),
    };
  }

  const legacy = payload as LegacyDecisionWindowOpenedPayload;

  return createLegacyDecisionWindowEntry(
    legacy.cardId ?? 'unknown-card',
    legacy.durationMs ?? 0,
    openedAtTick,
    legacy.autoResolveChoice ?? '-1',
  );
}

function normalizeDecisionWindowClosePayload(
  payload:
    | DecisionWindowExpiredEvent
    | DecisionWindowResolvedEvent
    | { windowId?: string; cardId?: string },
): { windowId?: string; cardId?: string } {
  return {
    windowId: 'windowId' in payload ? payload.windowId : undefined,
    cardId: 'cardId' in payload ? payload.cardId : undefined,
  };
}

function normalizeHoldUsedPayload(
  payload: HoldActionUsedEvent | LegacyHoldUsedPayload,
): { windowId: string | null; holdsRemaining: number; holdExpiresAtMs: number | null } {
  const legacy = payload as LegacyHoldUsedPayload;

  return {
    windowId: payload.windowId ?? null,
    holdsRemaining:
      legacy.holdsRemainingInRun ??
      legacy.holdsRemaining ??
      0,
    holdExpiresAtMs: legacy.holdExpiresAtMs ?? null,
  };
}

function normalizeRunTimeoutPayload(
  payload: RunTimeoutEvent | { ticksElapsed?: number; outcome?: 'TIMEOUT' },
): { ticksElapsed: number; outcome: 'TIMEOUT' } {
  return {
    ticksElapsed: payload.ticksElapsed ?? 0,
    outcome: 'TIMEOUT',
  };
}

// =============================================================================
// SECTION 4 — ZUSTAND STORE
// =============================================================================

export const useEngineStore = create<EngineStoreState>()(
  immer(
    (set): EngineStoreState => ({
      ...defaultRunSlice,
      ...defaultTimeSlice,
      ...defaultPressureSlice,
      ...defaultTensionSlice,
      ...defaultShieldSlice,
      ...defaultBattleSlice,
      ...defaultCascadeSlice,
      ...defaultRuntimeSlice,
      ...defaultSovereigntySlice,

      card: defaultCardSlice(),
      mechanics: defaultMechanicsSlice(),

      card_resetSlice: () =>
        set((state) => {
          state.card = defaultCardSlice();
        }),

      resetAllSlices: () =>
        set((state) => {
          resetAllSlicesDraft(state);
        }),

      syncRunMirror: (snapshot) =>
        set((state) => {
          applyRunMirrorDraft(state, snapshot);
        }),
    }),
  ),
);

export const engineStoreSet: ZustandSet = (updater) => {
  (useEngineStore as any).setState((draft: EngineStoreState) => {
    updater(draft);
  });
};

export function getEngineStoreState(): EngineStoreState {
  return useEngineStore.getState();
}

// =============================================================================
// SECTION 5 — ENGINE 0 — RUN LIFECYCLE HANDLERS
// =============================================================================

export const runLifecycleStoreHandlers = {
  onRunStarted(
    set: ZustandSet,
    payload: { runId: string; userId: string; seed: string; tickBudget: number },
  ): void {
    set((state) => {
      Object.assign(state.run, {
        ...defaultRunSlice.run,
        lifecycleState: 'ACTIVE' as RunLifecycleState,
        runId: payload.runId,
        userId: payload.userId,
        seed: payload.seed,
        tickBudget: payload.tickBudget,
        outcome: null,
      });
      state.card = defaultCardSlice();
    });
  },

  onRunEnded(
    set: ZustandSet,
    payload: { runId: string; outcome: RunOutcome; finalNetWorth: number },
  ): void {
    set((state) => {
      state.run.lifecycleState = 'ENDED';
      state.run.outcome = payload.outcome;
    });
  },

  onTickComplete(
    set: ZustandSet,
    payload: {
      tickIndex?: number;
      tickNumber?: number;
      tickDurationMs: number;
      outcome: RunOutcome | null;
      timestamp?: number;
    },
  ): void {
    const normalized = normalizeTickCompletePayload(payload);

    set((state) => {
      state.run.lastTickIndex = normalized.tickIndex;
      state.run.lastTickDurationMs = normalized.tickDurationMs;
      if (normalized.outcome) state.run.outcome = normalized.outcome;
    });
  },

  onEngineError(
    set: ZustandSet,
    payload: { engineId: EngineId; error: string; step: number },
  ): void {
    set((state) => {
      if (!state.run.healthReport) {
        state.run.healthReport = {};
      }
      (state.run.healthReport as Partial<Record<EngineId, EngineHealth>>)[payload.engineId] = 'ERROR' as EngineHealth;
    });
  },
};

// =============================================================================
// SECTION 6 — ENGINE 1 — TIME ENGINE HANDLERS
// =============================================================================

export const timeStoreHandlers = {
  onTickTierChanged(
    set: ZustandSet,
    payload: Partial<TierChangeEvent> & { transitionTicks?: number },
  ): void {
    const normalized = normalizeTierChangePayload(payload);

    set((state) => {
      state.time.previousTier = normalized.from;
      state.time.currentTier = normalized.to;
      state.time.isTierTransitioning = normalized.transitionTicks > 0;
      state.time.tierChangedThisTick = true;
    });
  },

  onTickTierForced(
    set: ZustandSet,
    payload: { tier: TickTier; durationTicks: number },
  ): void {
    set((state) => {
      state.time.previousTier = state.time.currentTier;
      state.time.currentTier = payload.tier;
      state.time.isTierTransitioning = false;
      state.time.tierChangedThisTick = true;
    });
  },

  onTickComplete(
    set: ZustandSet,
    payload: Partial<TickEvent> & { tickIndex?: number; outcome?: RunOutcome | null },
  ): void {
    const normalized = normalizeTickCompletePayload(payload);

    set((state) => {
      state.time.ticksElapsed = normalized.tickIndex;
      state.time.currentTickDurationMs = normalized.tickDurationMs;
      state.time.lastTickTimestamp = normalized.timestamp ?? Date.now();
      state.time.ticksRemaining = Math.max(0, state.time.seasonTickBudget - normalized.tickIndex);
      state.time.ticksUntilTimeout = state.time.ticksRemaining;
      state.time.seasonTimeoutImminent = state.time.ticksRemaining <= 5;
      state.time.isTierTransitioning = false;
      if (normalized.outcome === 'TIMEOUT') {
        state.time.isRunActive = false;
      }
    });
  },

  onDecisionWindowOpened(
    set: ZustandSet,
    payload: DecisionWindowOpenedEvent | LegacyDecisionWindowOpenedPayload,
  ): void {
    set((state) => {
      const entry = normalizeDecisionWindowOpenedPayload(payload, state.run.lastTickIndex);

      const existingIndex = state.time.activeDecisionWindows.findIndex(
        (window) => window.windowId === entry.windowId || window.cardId === entry.cardId,
      );

      if (existingIndex >= 0) {
        state.time.activeDecisionWindows[existingIndex] = entry;
      } else {
        state.time.activeDecisionWindows = [...state.time.activeDecisionWindows, entry];
      }
    });
  },

  onDecisionWindowClosed(
    set: ZustandSet,
    payload: DecisionWindowExpiredEvent | DecisionWindowResolvedEvent | { windowId?: string; cardId?: string },
  ): void {
    const normalized = normalizeDecisionWindowClosePayload(payload);

    set((state) => {
      state.time.activeDecisionWindows = state.time.activeDecisionWindows.filter(
        (window) =>
          (normalized.windowId ? window.windowId !== normalized.windowId : true) &&
          (normalized.cardId ? window.cardId !== normalized.cardId : true),
      );
    });
  },

  onDecisionWindowTick(set: ZustandSet, windowId: string, remainingMs: number): void {
    set((state) => {
      const window = state.time.activeDecisionWindows.find((entry) => entry.windowId === windowId);
      if (window) {
        window.remainingMs = Math.max(0, remainingMs);
        window.expiresAtMs = Date.now() + Math.max(0, remainingMs);
      }
    });
  },

  onHoldUsed(
    set: ZustandSet,
    payload: HoldActionUsedEvent | LegacyHoldUsedPayload,
  ): void {
    const normalized = normalizeHoldUsedPayload(payload);

    set((state) => {
      state.time.holdsRemaining = normalized.holdsRemaining;
      if (normalized.windowId) {
        const window = state.time.activeDecisionWindows.find((entry) => entry.windowId === normalized.windowId);
        if (window) {
          window.isOnHold = true;
          window.holdExpiresAtMs = normalized.holdExpiresAtMs;
        }
      }
    });
  },

  onSeasonTimeoutImminent(
    set: ZustandSet,
    payload: { ticksRemaining: number },
  ): void {
    set((state) => {
      state.time.seasonTimeoutImminent = true;
      state.time.ticksUntilTimeout = payload.ticksRemaining;
      state.time.ticksRemaining = Math.min(state.time.ticksRemaining, payload.ticksRemaining);
    });
  },

  onRunTimeout(
    set: ZustandSet,
    payload: RunTimeoutEvent | { ticksElapsed?: number; outcome?: 'TIMEOUT' },
  ): void {
    const normalized = normalizeRunTimeoutPayload(payload);

    set((state) => {
      state.time.ticksElapsed = normalized.ticksElapsed;
      state.time.ticksRemaining = 0;
      state.time.ticksUntilTimeout = 0;
      state.time.seasonTimeoutImminent = true;
      state.time.isRunActive = false;
      state.time.activeDecisionWindows = [];
    });
  },

  onRunStarted(set: ZustandSet, tickBudget: number): void {
    set((state) => {
      Object.assign(state.time, {
        ...defaultTimeSlice.time,
        seasonTickBudget: tickBudget,
        ticksRemaining: tickBudget,
        ticksUntilTimeout: tickBudget,
        isRunActive: true,
      });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set((state) => {
      state.time.activeDecisionWindows = [];
      state.time.isRunActive = false;
      state.time.isTierTransitioning = false;
    });
  },
};

// =============================================================================
// SECTION 7 — ENGINE 2 — PRESSURE ENGINE HANDLERS
// =============================================================================

export const pressureStoreHandlers = {
  onScoreUpdated(
    set: ZustandSet,
    payload: { score: number; tier: PressureTier; tickIndex: number },
  ): void {
    set((state) => {
      state.pressure.score = payload.score;
      state.pressure.tier = payload.tier;
      state.pressure.tickIndex = payload.tickIndex;
    });
  },

  onTierChanged(
    set: ZustandSet,
    payload: { from: PressureTier; to: PressureTier; score: number },
  ): void {
    set((state) => {
      state.pressure.previousTier = payload.from;
      state.pressure.tier = payload.to;
      state.pressure.score = payload.score;
    });
  },

  onCritical(
    set: ZustandSet,
    payload: { score: number; triggerSignals: string[] },
  ): void {
    set((state) => {
      state.pressure.isCritical = true;
      state.pressure.triggerSignals = payload.triggerSignals;
      state.pressure.score = payload.score;
    });
  },

  onRunStarted(set: ZustandSet): void {
    set((state) => {
      Object.assign(state.pressure, { ...defaultPressureSlice.pressure });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set((state) => {
      state.pressure.isCritical = false;
    });
  },

  onTickComplete(set: ZustandSet): void {
    set((state) => {
      if (state.pressure.score < 0.81) state.pressure.isCritical = false;
    });
  },
};

// =============================================================================
// SECTION 8 — ENGINE 3 — TENSION ENGINE HANDLERS
// =============================================================================

export const tensionStoreHandlers = {
  onScoreUpdated(set: ZustandSet, event: TensionScoreUpdatedEvent): void {
    set((state) => {
      state.tension.score = event.score;
      state.tension.visibilityState = event.visibilityState;
    });
  },

  onVisibilityChanged(set: ZustandSet, event: TensionVisibilityChangedEvent): void {
    set((state) => {
      state.tension.previousVisibilityState = event.from;
      state.tension.visibilityState = event.to;
    });
  },

  onPulseFired(set: ZustandSet, event: TensionPulseFiredEvent): void {
    set((state) => {
      state.tension.isPulseActive = true;
      state.tension.pulseTicksActive = event.pulseTicksActive;
      state.tension.isSustainedPulse = event.pulseTicksActive >= 3;
    });
  },

  onThreatArrived(set: ZustandSet, _event: ThreatArrivedEvent): void {
    set((state) => {
      state.tension.arrivedCount += 1;
    });
  },

  onThreatExpired(set: ZustandSet, _event: ThreatExpiredEvent): void {
    set((state) => {
      state.tension.expiredCount += 1;
    });
  },

  onThreatQueued(
    set: ZustandSet,
    payload: { entry?: AnticipationEntry; queueDepth?: number; tickIndex?: number },
  ): void {
    set((state) => {
      state.tension.queuedCount += 1;
      state.tension.queueLength = payload.queueDepth ?? Math.max(state.tension.queueLength + 1, state.tension.queuedCount);
      if (payload.entry) {
        state.tension.sortedQueue = [...state.tension.sortedQueue, payload.entry];
      }
      if (payload.tickIndex !== undefined) {
        state.tension.currentTick = payload.tickIndex;
      }
    });
  },

  onThreatMitigated(
    set: ZustandSet,
    payload: { queueDepth?: number; cardUsed?: string },
  ): void {
    set((state) => {
      state.tension.queueLength = payload.queueDepth ?? Math.max(0, state.tension.queueLength - 1);
      if (!payload.cardUsed && state.tension.sortedQueue.length > 0) {
        state.tension.sortedQueue = state.tension.sortedQueue.slice(1);
      }
    });
  },

  onSnapshotAvailable(
    set: ZustandSet,
    snapshot: TensionSnapshot,
    sortedQueue: AnticipationEntry[],
  ): void {
    set((state) => {
      state.tension.score = snapshot.score;
      state.tension.visibilityState = snapshot.visibilityState;
      state.tension.queueLength = snapshot.queueLength;
      state.tension.arrivedCount = snapshot.arrivedCount;
      state.tension.queuedCount = snapshot.queuedCount;
      state.tension.expiredCount = snapshot.expiredCount;
      state.tension.isPulseActive = snapshot.isPulseActive;
      state.tension.pulseTicksActive = snapshot.pulseTicksActive;
      state.tension.isSustainedPulse = snapshot.pulseTicksActive >= 3;
      state.tension.isEscalating = snapshot.isEscalating;
      state.tension.scoreHistory = [...snapshot.scoreHistory];
      state.tension.sortedQueue = [...sortedQueue];
      state.tension.currentTick = snapshot.tickNumber;

      const firstArrived = sortedQueue.find((entry) => entry.isArrived) ?? null;
      if (firstArrived !== null) state.tension.lastArrivedEntry = firstArrived;
    });
  },

  onRunStarted(set: ZustandSet): void {
    set((state) => {
      Object.assign(state.tension, { ...defaultTensionSlice.tension, isRunActive: true });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set((state) => {
      state.tension.isRunActive = false;
      state.tension.isPulseActive = false;
    });
  },

  onTickComplete(set: ZustandSet): void {
    set((state) => {
      if (!state.tension.isPulseActive) {
        state.tension.pulseTicksActive = 0;
        state.tension.isSustainedPulse = false;
      }
    });
  },
};

// =============================================================================
// SECTION 9 — ENGINE 4 — SHIELD ENGINE HANDLERS
// =============================================================================

export const shieldStoreHandlers = {
  onSnapshotUpdated(set: ZustandSet, snapshot: ShieldSnapshot): void {
    set((state) => {
      state.shield.snapshot = snapshot;
      state.shield.overallIntegrityPct = snapshot.overallIntegrityPct;
      state.shield.weakestLayerId = snapshot.weakestLayerId;
      state.shield.isFortified = snapshot.isFortified;
      state.shield.cascadeCount = snapshot.cascadeCount;
      state.shield.isInBreachCascade = snapshot.isInBreachCascade;
    });
  },

  onShieldHit(set: ZustandSet, event: ShieldHitEvent): void {
    set((state) => {
      state.shield.lastDamageResult = event.damageResult;
    });
  },

  onLayerBreached(set: ZustandSet, event: ShieldLayerBreachedEvent): void {
    set((state) => {
      state.shield.lastBreachedLayerId = event.layerId;
      if (event.cascadeTriggered) {
        state.shield.isInBreachCascade = true;
        state.shield.cascadeCount += 1;
      }
    });
  },

  onRunStarted(set: ZustandSet): void {
    set((state) => {
      Object.assign(state.shield, { ...defaultShieldSlice.shield, isRunActive: true });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set((state) => {
      state.shield.isRunActive = false;
    });
  },
};

// =============================================================================
// SECTION 10 — ENGINE 5 — BATTLE ENGINE HANDLERS
// =============================================================================

export const battleStoreHandlers = {
  onSnapshotUpdated(set: ZustandSet, event: BattleSnapshotUpdatedEvent): void {
    set((state) => {
      const snapshot = event.snapshot;
      state.battle.snapshot = snapshot;
      state.battle.budget = snapshot.budget;
      state.battle.haterHeat = snapshot.haterHeat;
      state.battle.injectedCards = snapshot.injectedCards;
      state.battle.activeBotsCount = snapshot.activeBotsCount;
      state.battle.tickNumber = snapshot.tickNumber;

      state.battle.activeBots = (Object.values(snapshot.bots) as HaterBotRuntimeState[])
        .filter(
          (bot) =>
            bot.state === BotState.TARGETING ||
            bot.state === BotState.ATTACKING ||
            bot.state === BotState.WATCHING,
        );
    });
  },

  onBotStateChanged(set: ZustandSet, event: BotStateChangedEvent): void {
    set((state) => {
      state.battle.lastStateChange = event;
    });
  },

  onBotAttackFired(set: ZustandSet, event: BotAttackFiredEvent): void {
    set((state) => {
      state.battle.lastAttackFired = event;
    });
  },

  onCardInjected(set: ZustandSet, event: CardInjectedEvent): void {
    set((state) => {
      const exists = state.battle.injectedCards.some(
        (card) => card.injectionId === event.injectedCard.injectionId,
      );
      if (!exists) {
        state.battle.injectedCards = [...state.battle.injectedCards, event.injectedCard];
      }
    });
  },

  onCardExpired(set: ZustandSet, event: InjectedCardExpiredEvent): void {
    set((state) => {
      state.battle.injectedCards = state.battle.injectedCards.filter(
        (card) => card.injectionId !== event.injectionId,
      );
    });
  },

  onRunStarted(set: ZustandSet): void {
    set((state) => {
      Object.assign(state.battle, { ...defaultBattleSlice.battle, isRunActive: true });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set((state) => {
      state.battle.isRunActive = false;
    });
  },
};

// =============================================================================
// SECTION 11 — ENGINE 6 — CASCADE ENGINE HANDLERS
// =============================================================================

export const cascadeStoreHandlers = {
  onSnapshotUpdated(set: ZustandSet, event: CascadeSnapshotUpdatedEvent): void {
    set((state) => {
      const snapshot = event.snapshot;
      state.cascade.snapshot = snapshot;
      state.cascade.activeNegativeChains = snapshot.activeNegativeChains;
      state.cascade.activePositiveCascades = snapshot.activePositiveCascades;
      state.cascade.totalLinksDefeated = snapshot.totalLinksDefeated;
      state.cascade.tickNumber = snapshot.tickNumber;
    });
  },

  onChainStarted(set: ZustandSet, event: CascadeChainStartedEvent): void {
    set((state) => {
      state.cascade.latestChainStarted = event;
    });
  },

  onLinkFired(set: ZustandSet, event: CascadeLinkFiredEvent): void {
    set((state) => {
      state.cascade.latestLinkFired = event;
    });
  },

  onChainBroken(set: ZustandSet, event: CascadeChainBrokenEvent): void {
    set((state) => {
      state.cascade.latestChainBroken = event;
    });
  },

  onChainCompleted(set: ZustandSet, event: CascadeChainCompletedEvent): void {
    set((state) => {
      state.cascade.latestChainCompleted = event;
    });
  },

  onPositiveActivated(set: ZustandSet, event: CascadePositiveActivatedEvent): void {
    set((state) => {
      state.cascade.latestPositiveActivated = event;
    });
  },

  onPositiveDissolved(set: ZustandSet, event: CascadePositiveDissolvedEvent): void {
    set((state) => {
      state.cascade.latestPositiveDissolved = event;
    });
  },

  onNemesisBroken(set: ZustandSet, event: NemesisBrokenEvent): void {
    set((state) => {
      state.cascade.nemesisBrokenEvents = [...state.cascade.nemesisBrokenEvents, event];
    });
  },

  onRunStarted(set: ZustandSet): void {
    set((state) => {
      Object.assign(state.cascade, { ...defaultCascadeSlice.cascade, isRunActive: true });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set((state) => {
      state.cascade.isRunActive = false;
    });
  },
};

// =============================================================================
// SECTION 12 — ENGINE 7 — SOVEREIGNTY ENGINE HANDLERS
// =============================================================================

export const sovereigntyStoreHandlers = {
  onRunCompleted(set: ZustandSet, event: RunCompletedPayload): void {
    set((state) => {
      state.sovereignty.proofHash = event.proofHash;
      state.sovereignty.grade = event.grade;
      state.sovereignty.sovereigntyScore = event.sovereigntyScore;
      state.sovereignty.integrityStatus = event.integrityStatus;
      state.sovereignty.reward = event.reward;
      state.sovereignty.pipelineStatus = 'COMPLETE';
    });
  },

  onVerificationFailed(set: ZustandSet, event: ProofVerificationFailedPayload): void {
    set((state) => {
      state.sovereignty.lastFailureReason = event.reason;
      state.sovereignty.lastFailureStep = event.step;
      if (event.step === 2 || event.step === 3) {
        state.sovereignty.pipelineStatus = 'FAILED';
      }
    });
  },

  onPipelineStarted(set: ZustandSet): void {
    set((state) => {
      state.sovereignty.pipelineStatus = 'RUNNING';
    });
  },

  onRunStarted(set: ZustandSet): void {
    set((state) => {
      Object.assign(state.sovereignty, {
        ...defaultSovereigntySlice.sovereignty,
        isRunActive: true,
      });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set((state) => {
      state.sovereignty.isRunActive = false;
    });
  },
};

// =============================================================================
// SECTION 13 — WIRING HELPERS
// =============================================================================

const wiredBusRegistry = new WeakMap<EventBus, Unsubscribe>();
let runMirrorUnsubscribe: Unsubscribe | null = null;

function composeUnsubs(unsubs: Array<Unsubscribe | undefined | null>): Unsubscribe {
  return () => {
    for (const unsub of unsubs) {
      try {
        unsub?.();
      } catch {
        // Intentionally swallow cleanup failures to keep teardown deterministic.
      }
    }
  };
}

function subscribeAny(
  eventBus: EventBus,
  eventName: string,
  handler: (payload: any) => void,
  unsubs: Unsubscribe[],
): void {
  const unsub = (eventBus as any).on(eventName as any, (event: any) => {
    handler(event?.payload ?? event);
  });

  if (typeof unsub === 'function') {
    unsubs.push(unsub);
  }
}

function registerAliasPair(
  eventBus: EventBus,
  primary: string,
  legacy: string,
  handler: (payload: any) => void,
  unsubs: Unsubscribe[],
): void {
  subscribeAny(eventBus, primary, handler, unsubs);
  if (legacy !== primary) {
    subscribeAny(eventBus, legacy, handler, unsubs);
  }
}

// =============================================================================
// SECTION 14 — INDIVIDUAL WIRE FUNCTIONS
// =============================================================================

export function wireTimeEngineHandlers(eventBus: EventBus, set: ZustandSet): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  subscribeAny(eventBus, 'TICK_TIER_CHANGED', (payload) => timeStoreHandlers.onTickTierChanged(set, payload), unsubs);
  subscribeAny(eventBus, 'TICK_TIER_FORCED', (payload) => timeStoreHandlers.onTickTierForced(set, payload), unsubs);
  subscribeAny(eventBus, 'TICK_COMPLETE', (payload) => timeStoreHandlers.onTickComplete(set, payload), unsubs);
  subscribeAny(eventBus, 'DECISION_WINDOW_OPENED', (payload) => timeStoreHandlers.onDecisionWindowOpened(set, payload), unsubs);
  subscribeAny(eventBus, 'DECISION_WINDOW_EXPIRED', (payload) => timeStoreHandlers.onDecisionWindowClosed(set, payload), unsubs);
  subscribeAny(eventBus, 'DECISION_WINDOW_RESOLVED', (payload) => timeStoreHandlers.onDecisionWindowClosed(set, payload), unsubs);
  subscribeAny(eventBus, 'HOLD_ACTION_USED', (payload) => timeStoreHandlers.onHoldUsed(set, payload), unsubs);
  subscribeAny(eventBus, 'RUN_TIMEOUT', (payload) => timeStoreHandlers.onRunTimeout(set, payload), unsubs);
  subscribeAny(eventBus, 'SEASON_TIMEOUT_IMMINENT', (payload) => timeStoreHandlers.onSeasonTimeoutImminent(set, payload), unsubs);

  return composeUnsubs(unsubs);
}

export function wirePressureEngineHandlers(eventBus: EventBus, set: ZustandSet): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  subscribeAny(eventBus, 'PRESSURE_SCORE_UPDATED', (payload) => pressureStoreHandlers.onScoreUpdated(set, payload), unsubs);
  subscribeAny(eventBus, 'PRESSURE_TIER_CHANGED', (payload) => pressureStoreHandlers.onTierChanged(set, payload), unsubs);
  subscribeAny(eventBus, 'PRESSURE_CRITICAL', (payload) => pressureStoreHandlers.onCritical(set, payload), unsubs);

  return composeUnsubs(unsubs);
}

export function wireTensionEngineHandlers(eventBus: EventBus, set: ZustandSet): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  registerAliasPair(eventBus, 'TENSION_SCORE_UPDATED', 'TENSION_SCORE_UPDATED', (payload) => {
    tensionStoreHandlers.onScoreUpdated(set, payload);
  }, unsubs);

  registerAliasPair(eventBus, 'TENSION_VISIBILITY_CHANGED', 'THREAT_VISIBILITY_CHANGED', (payload) => {
    tensionStoreHandlers.onVisibilityChanged(set, payload);
  }, unsubs);

  registerAliasPair(eventBus, 'TENSION_PULSE_FIRED', 'ANTICIPATION_PULSE', (payload) => {
    const normalized = {
      pulseTicksActive: payload?.pulseTicksActive ?? 1,
      ...payload,
    };
    tensionStoreHandlers.onPulseFired(set, normalized);
  }, unsubs);

  subscribeAny(eventBus, 'THREAT_QUEUED', (payload) => tensionStoreHandlers.onThreatQueued(set, payload), unsubs);
  subscribeAny(eventBus, 'THREAT_ARRIVED', (payload) => tensionStoreHandlers.onThreatArrived(set, payload), unsubs);
  subscribeAny(eventBus, 'THREAT_EXPIRED', (payload) => tensionStoreHandlers.onThreatExpired(set, payload), unsubs);
  subscribeAny(eventBus, 'THREAT_MITIGATED', (payload) => tensionStoreHandlers.onThreatMitigated(set, payload), unsubs);

  subscribeAny(eventBus, 'TENSION_SNAPSHOT_UPDATED', (payload) => {
    const snapshot = payload?.snapshot ?? payload;
    const queue = payload?.sortedQueue ?? payload?.queue ?? [];
    tensionStoreHandlers.onSnapshotAvailable(set, snapshot, queue);
  }, unsubs);

  return composeUnsubs(unsubs);
}

export function wireShieldEngineHandlers(eventBus: EventBus, set: ZustandSet): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  subscribeAny(eventBus, 'SHIELD_HIT', (payload) => shieldStoreHandlers.onShieldHit(set, payload), unsubs);
  subscribeAny(eventBus, 'SHIELD_LAYER_BREACHED', (payload) => shieldStoreHandlers.onLayerBreached(set, payload), unsubs);
  subscribeAny(eventBus, 'SHIELD_SNAPSHOT_UPDATED', (payload) => {
    const snapshot: ShieldSnapshot = payload?.snapshot ?? payload;
    shieldStoreHandlers.onSnapshotUpdated(set, snapshot);
  }, unsubs);

  return composeUnsubs(unsubs);
}

export function wireBattleEngineHandlers(eventBus: EventBus, set: ZustandSet): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  subscribeAny(eventBus, 'BATTLE_SNAPSHOT_UPDATED', (payload) => battleStoreHandlers.onSnapshotUpdated(set, payload), unsubs);
  subscribeAny(eventBus, 'BOT_STATE_CHANGED', (payload) => battleStoreHandlers.onBotStateChanged(set, payload), unsubs);
  subscribeAny(eventBus, 'BOT_ATTACK_FIRED', (payload) => battleStoreHandlers.onBotAttackFired(set, payload), unsubs);
  subscribeAny(eventBus, 'CARD_INJECTED', (payload) => battleStoreHandlers.onCardInjected(set, payload), unsubs);
  subscribeAny(eventBus, 'INJECTED_CARD_EXPIRED', (payload) => battleStoreHandlers.onCardExpired(set, payload), unsubs);

  return composeUnsubs(unsubs);
}

export function wireCascadeEngineHandlers(eventBus: EventBus, set: ZustandSet): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  registerAliasPair(eventBus, 'CASCADE_CHAIN_STARTED', 'CASCADE_CHAIN_TRIGGERED', (payload) => {
    cascadeStoreHandlers.onChainStarted(set, payload);
  }, unsubs);

  subscribeAny(eventBus, 'CASCADE_LINK_FIRED', (payload) => cascadeStoreHandlers.onLinkFired(set, payload), unsubs);
  subscribeAny(eventBus, 'CASCADE_CHAIN_BROKEN', (payload) => cascadeStoreHandlers.onChainBroken(set, payload), unsubs);
  subscribeAny(eventBus, 'CASCADE_CHAIN_COMPLETED', (payload) => cascadeStoreHandlers.onChainCompleted(set, payload), unsubs);
  subscribeAny(eventBus, 'CASCADE_POSITIVE_ACTIVATED', (payload) => cascadeStoreHandlers.onPositiveActivated(set, payload), unsubs);
  subscribeAny(eventBus, 'CASCADE_POSITIVE_DISSOLVED', (payload) => cascadeStoreHandlers.onPositiveDissolved(set, payload), unsubs);
  subscribeAny(eventBus, 'NEMESIS_BROKEN', (payload) => cascadeStoreHandlers.onNemesisBroken(set, payload), unsubs);
  subscribeAny(eventBus, 'CASCADE_SNAPSHOT_UPDATED', (payload) => cascadeStoreHandlers.onSnapshotUpdated(set, payload), unsubs);

  return composeUnsubs(unsubs);
}

export function wireSovereigntyEngineHandlers(eventBus: EventBus, set: ZustandSet): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  subscribeAny(eventBus, 'RUN_COMPLETED', (payload) => sovereigntyStoreHandlers.onRunCompleted(set, payload), unsubs);
  subscribeAny(eventBus, 'PROOF_VERIFICATION_FAILED', (payload) => sovereigntyStoreHandlers.onVerificationFailed(set, payload), unsubs);
  subscribeAny(eventBus, 'SOVEREIGNTY_PIPELINE_STARTED', () => sovereigntyStoreHandlers.onPipelineStarted(set), unsubs);
  subscribeAny(eventBus, 'RUN_GRADING_STARTED', () => sovereigntyStoreHandlers.onPipelineStarted(set), unsubs);

  return composeUnsubs(unsubs);
}

// =============================================================================
// SECTION 15 — MASTER WIRING FUNCTION
// =============================================================================

/**
 * Wire ALL engine EventBus subscriptions in a single call.
 * Call after eventBus.reset() so subscriptions are fresh for each run.
 * Card engine wiring is handled separately by ModeRouter via wireCardEngineHandlers().
 *
 * Usage:
 *   const cleanup = wireAllEngineHandlers(sharedEventBus);
 *   // later: cleanup();
 */
export function wireAllEngineHandlers(
  eventBus: EventBus,
  set: ZustandSet = engineStoreSet,
): Unsubscribe {
  const existing = wiredBusRegistry.get(eventBus);
  if (existing) {
    existing();
    wiredBusRegistry.delete(eventBus);
  }

  const unsubs: Unsubscribe[] = [];
  const stateSet = set;

  unsubs.push(wireTimeEngineHandlers(eventBus, stateSet));
  unsubs.push(wirePressureEngineHandlers(eventBus, stateSet));
  unsubs.push(wireTensionEngineHandlers(eventBus, stateSet));
  unsubs.push(wireShieldEngineHandlers(eventBus, stateSet));
  unsubs.push(wireBattleEngineHandlers(eventBus, stateSet));
  unsubs.push(wireCascadeEngineHandlers(eventBus, stateSet));
  unsubs.push(wireSovereigntyEngineHandlers(eventBus, stateSet));

  // Mechanics runtime wiring already knows how to subscribe to the shared EventBus.
  wireMechanicsRuntimeHandlers(eventBus, stateSet as any);

  subscribeAny(eventBus, 'RUN_STARTED', (payload) => {
    const normalized = normalizeRunStartedPayload(payload);
    stateSet((state) => {
      applyRunStartedAtomic(state, normalized);
    });
  }, unsubs);

  subscribeAny(eventBus, 'RUN_ENDED', (payload) => {
    const normalized = normalizeRunEndedPayload(payload);
    stateSet((state) => {
      applyRunEndedAtomic(state, normalized);
    });
  }, unsubs);

  subscribeAny(eventBus, 'TICK_COMPLETE', (payload) => {
    stateSet((state) => {
      applyTickCompleteAtomic(state, normalizeTickCompletePayload(payload));
    });
  }, unsubs);

  subscribeAny(eventBus, 'ENGINE_ERROR', (payload) => {
    runLifecycleStoreHandlers.onEngineError(stateSet, payload);
  }, unsubs);

  const cleanup = composeUnsubs(unsubs);
  wiredBusRegistry.set(eventBus, cleanup);

  return () => {
    cleanup();
    if (wiredBusRegistry.get(eventBus) === cleanup) {
      wiredBusRegistry.delete(eventBus);
    }
  };
}

export { wireTimeEngineHandlers as wireTimeEngine };

export function wireRunStoreMirror(): Unsubscribe {
  if (runMirrorUnsubscribe) {
    runMirrorUnsubscribe();
    runMirrorUnsubscribe = null;
  }

  const applyMirror = (snapshot: EngineStoreMirrorSnapshot): void => {
    useEngineStore.getState().syncRunMirror(snapshot);
  };

  applyMirror(selectEngineStoreMirrorSnapshot(runStore.getState()));

  const unsub = (runStore as any).subscribe(
    selectEngineStoreMirrorSnapshot,
    (snapshot: EngineStoreMirrorSnapshot) => {
      applyMirror(snapshot);
    },
    { fireImmediately: false },
  );

  runMirrorUnsubscribe =
    typeof unsub === 'function'
      ? unsub
      : () => undefined;

  return () => {
    runMirrorUnsubscribe?.();
    runMirrorUnsubscribe = null;
  };
}
