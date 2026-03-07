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
 * CARD SLICE INTEGRATION (added):
 *   ✦ CardEngineStoreSlice is merged into EngineStoreState.
 *   ✦ defaultCardSlice() initializes the card sub-state.
 *   ✦ wireCardEngineHandlers() must be called separately via ModeRouter after
 *     CardEngine initialization, since card events use a separate EventBus instance.
 *   ✦ card actions (card_queuePlay, card_holdCard, card_releaseHold, card_resetSlice)
 *     are exposed on the store for component dispatch.
 *
 * SLICES (8 + Card):
 *   run          — Engine 0 orchestrator lifecycle
 *   time         — Engine 1 TimeEngine
 *   pressure     — Engine 2 PressureEngine
 *   tension      — Engine 3 TensionEngine
 *   shield       — Engine 4 ShieldEngine
 *   battle       — Engine 5 BattleEngine
 *   cascade      — Engine 6 CascadeEngine
 *   sovereignty  — Engine 7 SovereigntyEngine
 *   card         — CardEngine cross-mode state
 *
 * Density6 LLC · Point Zero One · Engines 0–7 + Cards · Confidential
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import { immer }  from 'zustand/middleware/immer';

// ── Engine 0 core types ────────────────────────────────────────────────────────
import type {
  RunLifecycleState,
  RunOutcome,
  EngineId,
  EngineHealth,
  TickTier,
  PressureTier,
} from '../zero/types';

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
} from '../tension/types';

// ── Engine 4 — Shield Engine types ────────────────────────────────────────────
import type {
  ShieldSnapshot,
  ShieldLayerId,
  DamageResult,
  ShieldHitEvent,
  ShieldLayerBreachedEvent,
  ShieldSnapshotUpdatedEvent,
} from '../shield/types';

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
} from '../battle/types';

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
} from '../cascade/types';

// ── Engine 7 — Sovereignty Engine types ───────────────────────────────────────
import type {
  RunGrade,
  IntegrityStatus,
  GradeReward,
  SovereigntyScoreComponents,
  RunCompletedPayload,
  ProofVerificationFailedPayload,
} from '../sovereignty/types';

// ── Card Engine slice types ────────────────────────────────────────────────────
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
import type { EventBus } from '../zero/EventBus';

// ── Inline minimal type: DecisionWindowEntry ──────────────────────────────────
interface DecisionWindowEntry {
  cardId:       string;
  durationMs:   number;
  openedAtTick: number;
  autoResolve:  string;
}

// =============================================================================
// SECTION 1 — SLICE SHAPES
// =============================================================================

export interface RunLifecycleStoreSlice {
  run: {
    lifecycleState:     RunLifecycleState;
    runId:              string | null;
    userId:             string | null;
    seed:               string | null;
    tickBudget:         number;
    outcome:            RunOutcome | null;
    healthReport:       Partial<Record<EngineId, EngineHealth>> | null;
    lastTickIndex:      number;
    lastTickDurationMs: number;
  };
}

export interface TimeEngineStoreSlice {
  time: {
    currentTier:           TickTier | null;
    previousTier:          TickTier | null;
    ticksElapsed:          number;
    seasonTickBudget:      number;
    ticksRemaining:        number;
    holdsRemaining:        number;
    activeDecisionWindows: DecisionWindowEntry[];
    currentTickDurationMs: number;
    isTierTransitioning:   boolean;
    seasonTimeoutImminent: boolean;
    ticksUntilTimeout:     number;
  };
}

export interface PressureEngineStoreSlice {
  pressure: {
    score:           number;
    tier:            PressureTier | null;
    previousTier:    PressureTier | null;
    isCritical:      boolean;
    triggerSignals:  string[];
    postActionScore: number;
    stagnationCount: number;
    tickIndex:       number;
  };
}

export interface TensionEngineStoreSlice {
  tension: {
    score:                   number;
    scoreHistory:            readonly number[];
    visibilityState:         VisibilityState;
    previousVisibilityState: VisibilityState | null;
    queueLength:             number;
    arrivedCount:            number;
    queuedCount:             number;
    expiredCount:            number;
    isPulseActive:           boolean;
    pulseTicksActive:        number;
    isSustainedPulse:        boolean;
    isEscalating:            boolean;
    sortedQueue:             AnticipationEntry[];
    lastArrivedEntry:        AnticipationEntry | null;
    lastExpiredEntry:        AnticipationEntry | null;
    currentTick:             number;
    isRunActive:             boolean;
  };
}

export interface ShieldEngineStoreSlice {
  shield: {
    snapshot:            ShieldSnapshot | null;
    overallIntegrityPct: number;
    weakestLayerId:      ShieldLayerId | null;
    isFortified:         boolean;
    cascadeCount:        number;
    isInBreachCascade:   boolean;
    isRunActive:         boolean;
    lastDamageResult:    DamageResult | null;
    lastBreachedLayerId: ShieldLayerId | null;
  };
}

export interface BattleEngineStoreSlice {
  battle: {
    snapshot:        BattleSnapshot | null;
    budget:          BattleBudgetState | null;
    haterHeat:       number;
    injectedCards:   InjectedCard[];
    activeBots:      HaterBotRuntimeState[];
    activeBotsCount: number;
    lastStateChange: BotStateChangedEvent | null;
    lastAttackFired: BotAttackFiredEvent | null;
    isRunActive:     boolean;
    tickNumber:      number;
  };
}

export interface CascadeEngineStoreSlice {
  cascade: {
    snapshot:                CascadeSnapshot | null;
    activeNegativeChains:    CascadeChainInstance[];
    activePositiveCascades:  ActivePositiveCascade[];
    totalLinksDefeated:      number;
    latestChainStarted:      CascadeChainStartedEvent | null;
    latestLinkFired:         CascadeLinkFiredEvent | null;
    latestChainBroken:       CascadeChainBrokenEvent | null;
    latestChainCompleted:    CascadeChainCompletedEvent | null;
    latestPositiveActivated: CascadePositiveActivatedEvent | null;
    latestPositiveDissolved: CascadePositiveDissolvedEvent | null;
    nemesisBrokenEvents:     NemesisBrokenEvent[];
    isRunActive:             boolean;
    tickNumber:              number;
  };
}

export interface SovereigntyEngineStoreSlice {
  sovereignty: {
    proofHash:         string | null;
    grade:             RunGrade | null;
    sovereigntyScore:  number | null;
    integrityStatus:   IntegrityStatus | null;
    pipelineStatus:    'IDLE' | 'RUNNING' | 'COMPLETE' | 'FAILED';
    reward:            GradeReward | null;
    components:        SovereigntyScoreComponents | null;
    lastFailureReason: string | null;
    lastFailureStep:   1 | 2 | 3 | null;
    isRunActive:       boolean;
  };
}

export interface RunMirrorStoreSlice {
  runtime: EngineStoreMirrorSnapshot;
}

// =============================================================================
// SECTION 2 — ROOT STORE SHAPE (includes card slice)
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
    // ── Card action dispatchers exposed on the store ──────────────────────────
    card_resetSlice: () => void;
    resetAllSlices:  () => void;
    syncRunMirror:   (snapshot: EngineStoreMirrorSnapshot) => void;
  };

/** Typed immer setter — shared by ALL store handler functions. */
export type ZustandSet = (updater: (state: EngineStoreState) => void) => void;

// =============================================================================
// SECTION 3 — DEFAULT STATE
// =============================================================================

export const defaultRunSlice: RunLifecycleStoreSlice = {
  run: {
    lifecycleState:     'IDLE',
    runId:              null,
    userId:             null,
    seed:               null,
    tickBudget:         0,
    outcome:            null,
    healthReport:       null,
    lastTickIndex:      0,
    lastTickDurationMs: 0,
  },
};

export const defaultTimeSlice: TimeEngineStoreSlice = {
  time: {
    currentTier:           null,
    previousTier:          null,
    ticksElapsed:          0,
    seasonTickBudget:      0,
    ticksRemaining:        0,
    holdsRemaining:        1,
    activeDecisionWindows: [],
    currentTickDurationMs: 3_000,
    isTierTransitioning:   false,
    seasonTimeoutImminent: false,
    ticksUntilTimeout:     0,
  },
};

export const defaultPressureSlice: PressureEngineStoreSlice = {
  pressure: {
    score:           0.0,
    tier:            null,
    previousTier:    null,
    isCritical:      false,
    triggerSignals:  [],
    postActionScore: 0.0,
    stagnationCount: 0,
    tickIndex:       0,
  },
};

export const defaultTensionSlice: TensionEngineStoreSlice = {
  tension: {
    score:                   0.0,
    scoreHistory:            [],
    visibilityState:         'SHADOWED' as VisibilityState,
    previousVisibilityState: null,
    queueLength:             0,
    arrivedCount:            0,
    queuedCount:             0,
    expiredCount:            0,
    isPulseActive:           false,
    pulseTicksActive:        0,
    isSustainedPulse:        false,
    isEscalating:            false,
    sortedQueue:             [],
    lastArrivedEntry:        null,
    lastExpiredEntry:        null,
    currentTick:             0,
    isRunActive:             false,
  },
};

export const defaultShieldSlice: ShieldEngineStoreSlice = {
  shield: {
    snapshot:            null,
    overallIntegrityPct: 1.0,
    weakestLayerId:      null,
    isFortified:         false,
    cascadeCount:        0,
    isInBreachCascade:   false,
    isRunActive:         false,
    lastDamageResult:    null,
    lastBreachedLayerId: null,
  },
};

export const defaultBattleSlice: BattleEngineStoreSlice = {
  battle: {
    snapshot:        null,
    budget:          null,
    haterHeat:       0,
    injectedCards:   [],
    activeBots:      [],
    activeBotsCount: 0,
    lastStateChange: null,
    lastAttackFired: null,
    isRunActive:     false,
    tickNumber:      0,
  },
};

export const defaultCascadeSlice: CascadeEngineStoreSlice = {
  cascade: {
    snapshot:                null,
    activeNegativeChains:    [],
    activePositiveCascades:  [],
    totalLinksDefeated:      0,
    latestChainStarted:      null,
    latestLinkFired:         null,
    latestChainBroken:       null,
    latestChainCompleted:    null,
    latestPositiveActivated: null,
    latestPositiveDissolved: null,
    nemesisBrokenEvents:     [],
    isRunActive:             false,
    tickNumber:              0,
  },
};

export const defaultRuntimeSlice: RunMirrorStoreSlice = {
  runtime: {
    isInitialized:         false,
    netWorth:              0,
    cashBalance:           0,
    monthlyIncome:         0,
    monthlyExpenses:       0,
    cashflow:              0,
    haterHeat:             0,
    activeThreatCardCount: 0,
    runId:                 null,
    userId:                null,
    seed:                  null,
    lastUpdated:           null,
  },
};

export const defaultSovereigntySlice: SovereigntyEngineStoreSlice = {
  sovereignty: {
    proofHash:         null,
    grade:             null,
    sovereigntyScore:  null,
    integrityStatus:   null,
    pipelineStatus:    'IDLE',
    reward:            null,
    components:        null,
    lastFailureReason: null,
    lastFailureStep:   null,
    isRunActive:       false,
  },
};

function resetAllSlicesDraft(state: EngineStoreState): void {
  Object.assign(state.run,         defaultRunSlice.run);
  Object.assign(state.time,        defaultTimeSlice.time);
  Object.assign(state.pressure,    defaultPressureSlice.pressure);
  Object.assign(state.tension,     defaultTensionSlice.tension);
  Object.assign(state.shield,      defaultShieldSlice.shield);
  Object.assign(state.battle,      defaultBattleSlice.battle);
  Object.assign(state.cascade,     defaultCascadeSlice.cascade);
  Object.assign(state.sovereignty, defaultSovereigntySlice.sovereignty);
  state.runtime   = { ...defaultRuntimeSlice.runtime };
  state.card      = defaultCardSlice();
  state.mechanics = defaultMechanicsSlice();
}

function applyRunMirrorDraft(
  state: EngineStoreState,
  snapshot: EngineStoreMirrorSnapshot,
): void {
  state.runtime = { ...snapshot };
}

function applyRunStartedAtomic(
  state: EngineStoreState,
  payload: { runId: string; userId: string; seed: string; tickBudget: number },
): void {
  Object.assign(state.run, {
    ...defaultRunSlice.run,
    lifecycleState: 'ACTIVE' as RunLifecycleState,
    runId:          payload.runId,
    userId:         payload.userId,
    seed:           payload.seed,
    tickBudget:     payload.tickBudget,
    outcome:        null,
  });

  Object.assign(state.time, {
    ...defaultTimeSlice.time,
    seasonTickBudget: payload.tickBudget,
    ticksRemaining:   payload.tickBudget,
  });

  Object.assign(state.pressure,    { ...defaultPressureSlice.pressure });
  Object.assign(state.tension,     { ...defaultTensionSlice.tension, isRunActive: true });
  Object.assign(state.shield,      { ...defaultShieldSlice.shield, isRunActive: true });
  Object.assign(state.battle,      { ...defaultBattleSlice.battle, isRunActive: true });
  Object.assign(state.cascade,     { ...defaultCascadeSlice.cascade, isRunActive: true });
  Object.assign(state.sovereignty, { ...defaultSovereigntySlice.sovereignty, isRunActive: true });

  state.card      = defaultCardSlice();
  state.mechanics = defaultMechanicsSlice();
  state.runtime   = {
    ...state.runtime,
    isInitialized: true,
    runId:         payload.runId,
    userId:        payload.userId,
    seed:          payload.seed,
    lastUpdated:   Date.now(),
  };
}

function applyRunEndedAtomic(
  state: EngineStoreState,
  payload: { runId: string; outcome: RunOutcome; finalNetWorth: number },
): void {
  state.run.lifecycleState = 'ENDED';
  state.run.outcome        = payload.outcome;
  state.time.activeDecisionWindows = [];
  state.pressure.isCritical = false;
  state.tension.isRunActive = false;
  state.shield.isRunActive  = false;
  state.battle.isRunActive  = false;
  state.cascade.isRunActive = false;
  state.sovereignty.isRunActive = false;
  state.runtime.netWorth    = payload.finalNetWorth;
  state.runtime.lastUpdated = Date.now();
}

function applyTickCompleteAtomic(
  state: EngineStoreState,
  payload: { tickIndex: number; tickDurationMs: number; outcome: RunOutcome | null },
): void {
  state.run.lastTickIndex      = payload.tickIndex;
  state.run.lastTickDurationMs = payload.tickDurationMs;
  if (payload.outcome) state.run.outcome = payload.outcome;

  if (state.pressure.score < 0.81) state.pressure.isCritical = false;

  if (!state.tension.isPulseActive) {
    state.tension.pulseTicksActive = 0;
    state.tension.isSustainedPulse = false;
  }
}

// =============================================================================
// SECTION 4 — ZUSTAND STORE (card slice merged in)
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

      // ── Card + mechanics slices ───────────────────────────────────────────
      card:      defaultCardSlice(),
      mechanics: defaultMechanicsSlice(),

      // ── Store actions ──────────────────────────────────────────────────────
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
    })
  )
);

// =============================================================================
// SECTION 5 — ENGINE 0 — RUN LIFECYCLE HANDLERS
// =============================================================================

export const runLifecycleStoreHandlers = {

  onRunStarted(
    set: ZustandSet,
    payload: { runId: string; userId: string; seed: string; tickBudget: number }
  ): void {
    set(state => {
      Object.assign(state.run, {
        ...defaultRunSlice.run,
        lifecycleState: 'ACTIVE' as RunLifecycleState,
        runId:          payload.runId,
        userId:         payload.userId,
        seed:           payload.seed,
        tickBudget:     payload.tickBudget,
        outcome:        null,
      });
      // Reset card slice on every new run
      state.card = defaultCardSlice();
    });
  },

  onRunEnded(
    set: ZustandSet,
    payload: { runId: string; outcome: RunOutcome; finalNetWorth: number }
  ): void {
    set(state => {
      state.run.lifecycleState = 'ENDED';
      state.run.outcome        = payload.outcome;
    });
  },

  onTickComplete(
    set: ZustandSet,
    payload: { tickIndex: number; tickDurationMs: number; outcome: RunOutcome | null }
  ): void {
    set(state => {
      state.run.lastTickIndex      = payload.tickIndex;
      state.run.lastTickDurationMs = payload.tickDurationMs;
      if (payload.outcome) state.run.outcome = payload.outcome;
    });
  },

  onEngineError(
    set: ZustandSet,
    payload: { engineId: EngineId; error: string; step: number }
  ): void {
    set(state => {
      if (state.run.healthReport) {
        (state.run.healthReport as any)[payload.engineId] = 'ERROR';
      }
    });
  },
};

// =============================================================================
// SECTION 6 — ENGINE 1 — TIME ENGINE HANDLERS
// =============================================================================

export const timeStoreHandlers = {

  onTickTierChanged(
    set: ZustandSet,
    payload: { from: TickTier; to: TickTier; transitionTicks: number }
  ): void {
    set(state => {
      state.time.previousTier        = payload.from;
      state.time.currentTier         = payload.to;
      state.time.isTierTransitioning = payload.transitionTicks > 0;
    });
  },

  onTickTierForced(
    set: ZustandSet,
    payload: { tier: TickTier; durationTicks: number }
  ): void {
    set(state => {
      state.time.previousTier = state.time.currentTier;
      state.time.currentTier  = payload.tier;
    });
  },

  onDecisionWindowOpened(
    set: ZustandSet,
    payload: { cardId: string; durationMs: number; autoResolveChoice: string }
  ): void {
    set(state => {
      const entry: DecisionWindowEntry = {
        cardId:       payload.cardId,
        durationMs:   payload.durationMs,
        openedAtTick: state.run.lastTickIndex,
        autoResolve:  payload.autoResolveChoice,
      };
      state.time.activeDecisionWindows = [...state.time.activeDecisionWindows, entry];
    });
  },

  onDecisionWindowClosed(set: ZustandSet, cardId: string): void {
    set(state => {
      state.time.activeDecisionWindows = state.time.activeDecisionWindows.filter(
        w => w.cardId !== cardId
      );
    });
  },

  onSeasonTimeoutImminent(
    set: ZustandSet,
    payload: { ticksRemaining: number }
  ): void {
    set(state => {
      state.time.seasonTimeoutImminent = true;
      state.time.ticksUntilTimeout     = payload.ticksRemaining;
    });
  },

  onRunStarted(set: ZustandSet, tickBudget: number): void {
    set(state => {
      Object.assign(state.time, {
        ...defaultTimeSlice.time,
        seasonTickBudget: tickBudget,
        ticksRemaining:   tickBudget,
      });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set(state => { state.time.activeDecisionWindows = []; });
  },
};

// =============================================================================
// SECTION 7 — ENGINE 2 — PRESSURE ENGINE HANDLERS
// =============================================================================

export const pressureStoreHandlers = {

  onScoreUpdated(
    set: ZustandSet,
    payload: { score: number; tier: PressureTier; tickIndex: number }
  ): void {
    set(state => {
      state.pressure.score     = payload.score;
      state.pressure.tier      = payload.tier;
      state.pressure.tickIndex = payload.tickIndex;
    });
  },

  onTierChanged(
    set: ZustandSet,
    payload: { from: PressureTier; to: PressureTier; score: number }
  ): void {
    set(state => {
      state.pressure.previousTier = payload.from;
      state.pressure.tier         = payload.to;
      state.pressure.score        = payload.score;
    });
  },

  onCritical(
    set: ZustandSet,
    payload: { score: number; triggerSignals: string[] }
  ): void {
    set(state => {
      state.pressure.isCritical     = true;
      state.pressure.triggerSignals = payload.triggerSignals;
      state.pressure.score          = payload.score;
    });
  },

  onRunStarted(set: ZustandSet): void {
    set(state => { Object.assign(state.pressure, { ...defaultPressureSlice.pressure }); });
  },

  onRunEnded(set: ZustandSet): void {
    set(state => { state.pressure.isCritical = false; });
  },

  onTickComplete(set: ZustandSet): void {
    set(state => {
      if (state.pressure.score < 0.81) state.pressure.isCritical = false;
    });
  },
};

// =============================================================================
// SECTION 8 — ENGINE 3 — TENSION ENGINE HANDLERS
// =============================================================================

export const tensionStoreHandlers = {

  onScoreUpdated(set: ZustandSet, event: TensionScoreUpdatedEvent): void {
    set(state => {
      state.tension.score           = event.score;
      state.tension.visibilityState = event.visibilityState;
    });
  },

  onVisibilityChanged(set: ZustandSet, event: TensionVisibilityChangedEvent): void {
    set(state => {
      state.tension.previousVisibilityState = event.from;
      state.tension.visibilityState         = event.to;
    });
  },

  onPulseFired(set: ZustandSet, event: TensionPulseFiredEvent): void {
    set(state => {
      state.tension.isPulseActive    = true;
      state.tension.pulseTicksActive = event.pulseTicksActive;
      state.tension.isSustainedPulse = event.pulseTicksActive >= 3;
    });
  },

  onThreatArrived(set: ZustandSet, _event: ThreatArrivedEvent): void {
    set(state => { state.tension.arrivedCount += 1; });
  },

  onThreatExpired(set: ZustandSet, _event: ThreatExpiredEvent): void {
    set(state => { state.tension.expiredCount += 1; });
  },

  onSnapshotAvailable(
    set: ZustandSet,
    snapshot: TensionSnapshot,
    sortedQueue: AnticipationEntry[],
  ): void {
    set(state => {
      state.tension.score            = snapshot.score;
      state.tension.visibilityState  = snapshot.visibilityState;
      state.tension.queueLength      = snapshot.queueLength;
      state.tension.arrivedCount     = snapshot.arrivedCount;
      state.tension.queuedCount      = snapshot.queuedCount;
      state.tension.expiredCount     = snapshot.expiredCount;
      state.tension.isPulseActive    = snapshot.isPulseActive;
      state.tension.pulseTicksActive = snapshot.pulseTicksActive;
      state.tension.isSustainedPulse = snapshot.pulseTicksActive >= 3;
      state.tension.isEscalating     = snapshot.isEscalating;
      state.tension.scoreHistory     = [...snapshot.scoreHistory];
      state.tension.sortedQueue      = [...sortedQueue];
      state.tension.currentTick      = snapshot.tickNumber;

      const firstArrived = sortedQueue.find(e => e.isArrived) ?? null;
      if (firstArrived !== null) state.tension.lastArrivedEntry = firstArrived;
    });
  },

  onRunStarted(set: ZustandSet): void {
    set(state => {
      Object.assign(state.tension, { ...defaultTensionSlice.tension, isRunActive: true });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set(state => { state.tension.isRunActive = false; });
  },

  onTickComplete(set: ZustandSet): void {
    set(state => {
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
    set(state => {
      state.shield.snapshot            = snapshot;
      state.shield.overallIntegrityPct = snapshot.overallIntegrityPct;
      state.shield.weakestLayerId      = snapshot.weakestLayerId;
      state.shield.isFortified         = snapshot.isFortified;
      state.shield.cascadeCount        = snapshot.cascadeCount;
      state.shield.isInBreachCascade   = snapshot.isInBreachCascade;
    });
  },

  onShieldHit(set: ZustandSet, e: ShieldHitEvent): void {
    set(state => { state.shield.lastDamageResult = e.damageResult; });
  },

  onLayerBreached(set: ZustandSet, e: ShieldLayerBreachedEvent): void {
    set(state => {
      state.shield.lastBreachedLayerId = e.layerId;
      if (e.cascadeTriggered) {
        state.shield.isInBreachCascade = true;
        state.shield.cascadeCount     += 1;
      }
    });
  },

  onRunStarted(set: ZustandSet): void {
    set(state => {
      Object.assign(state.shield, { ...defaultShieldSlice.shield, isRunActive: true });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set(state => { state.shield.isRunActive = false; });
  },
};

// =============================================================================
// SECTION 10 — ENGINE 5 — BATTLE ENGINE HANDLERS
// =============================================================================

export const battleStoreHandlers = {

  onSnapshotUpdated(set: ZustandSet, e: BattleSnapshotUpdatedEvent): void {
    set(state => {
      const snap                   = e.snapshot;
      state.battle.snapshot        = snap;
      state.battle.budget          = snap.budget;
      state.battle.haterHeat       = snap.haterHeat;
      state.battle.injectedCards   = snap.injectedCards;
      state.battle.activeBotsCount = snap.activeBotsCount;
      state.battle.tickNumber      = snap.tickNumber;

      state.battle.activeBots = (Object.values(snap.bots) as HaterBotRuntimeState[])
        .filter(b =>
          b.state === BotState.TARGETING ||
          b.state === BotState.ATTACKING  ||
          b.state === BotState.WATCHING
        );
    });
  },

  onBotStateChanged(set: ZustandSet, e: BotStateChangedEvent): void {
    set(state => { state.battle.lastStateChange = e; });
  },

  onBotAttackFired(set: ZustandSet, e: BotAttackFiredEvent): void {
    set(state => { state.battle.lastAttackFired = e; });
  },

  onCardInjected(set: ZustandSet, e: CardInjectedEvent): void {
    set(state => {
      const exists = state.battle.injectedCards.some(
        c => c.injectionId === e.injectedCard.injectionId
      );
      if (!exists) {
        state.battle.injectedCards = [...state.battle.injectedCards, e.injectedCard];
      }
    });
  },

  onCardExpired(set: ZustandSet, e: InjectedCardExpiredEvent): void {
    set(state => {
      state.battle.injectedCards = state.battle.injectedCards.filter(
        c => c.injectionId !== e.injectionId
      );
    });
  },

  onRunStarted(set: ZustandSet): void {
    set(state => {
      Object.assign(state.battle, { ...defaultBattleSlice.battle, isRunActive: true });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set(state => { state.battle.isRunActive = false; });
  },
};

// =============================================================================
// SECTION 11 — ENGINE 6 — CASCADE ENGINE HANDLERS
// =============================================================================

export const cascadeStoreHandlers = {

  onSnapshotUpdated(set: ZustandSet, e: CascadeSnapshotUpdatedEvent): void {
    set(state => {
      const snap                           = e.snapshot;
      state.cascade.snapshot               = snap;
      state.cascade.activeNegativeChains   = snap.activeNegativeChains;
      state.cascade.activePositiveCascades = snap.activePositiveCascades;
      state.cascade.totalLinksDefeated     = snap.totalLinksDefeated;
      state.cascade.tickNumber             = snap.tickNumber;
    });
  },

  onChainStarted(set: ZustandSet, e: CascadeChainStartedEvent): void {
    set(state => { state.cascade.latestChainStarted = e; });
  },

  onLinkFired(set: ZustandSet, e: CascadeLinkFiredEvent): void {
    set(state => { state.cascade.latestLinkFired = e; });
  },

  onChainBroken(set: ZustandSet, e: CascadeChainBrokenEvent): void {
    set(state => { state.cascade.latestChainBroken = e; });
  },

  onChainCompleted(set: ZustandSet, e: CascadeChainCompletedEvent): void {
    set(state => { state.cascade.latestChainCompleted = e; });
  },

  onPositiveActivated(set: ZustandSet, e: CascadePositiveActivatedEvent): void {
    set(state => { state.cascade.latestPositiveActivated = e; });
  },

  onPositiveDissolved(set: ZustandSet, e: CascadePositiveDissolvedEvent): void {
    set(state => { state.cascade.latestPositiveDissolved = e; });
  },

  onNemesisBroken(set: ZustandSet, e: NemesisBrokenEvent): void {
    set(state => {
      state.cascade.nemesisBrokenEvents = [...state.cascade.nemesisBrokenEvents, e];
    });
  },

  onRunStarted(set: ZustandSet): void {
    set(state => {
      Object.assign(state.cascade, { ...defaultCascadeSlice.cascade, isRunActive: true });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set(state => { state.cascade.isRunActive = false; });
  },
};

// =============================================================================
// SECTION 12 — ENGINE 7 — SOVEREIGNTY ENGINE HANDLERS
// =============================================================================

export const sovereigntyStoreHandlers = {

  onRunCompleted(set: ZustandSet, e: RunCompletedPayload): void {
    set(state => {
      state.sovereignty.proofHash        = e.proofHash;
      state.sovereignty.grade            = e.grade;
      state.sovereignty.sovereigntyScore = e.sovereigntyScore;
      state.sovereignty.integrityStatus  = e.integrityStatus;
      state.sovereignty.reward           = e.reward;
      state.sovereignty.pipelineStatus   = 'COMPLETE';
    });
  },

  onVerificationFailed(set: ZustandSet, e: ProofVerificationFailedPayload): void {
    set(state => {
      state.sovereignty.lastFailureReason = e.reason;
      state.sovereignty.lastFailureStep   = e.step;
      if (e.step === 2 || e.step === 3) {
        state.sovereignty.pipelineStatus = 'FAILED';
      }
    });
  },

  onPipelineStarted(set: ZustandSet): void {
    set(state => { state.sovereignty.pipelineStatus = 'RUNNING'; });
  },

  onRunStarted(set: ZustandSet): void {
    set(state => {
      Object.assign(state.sovereignty, {
        ...defaultSovereigntySlice.sovereignty,
        isRunActive: true,
      });
    });
  },

  onRunEnded(set: ZustandSet): void {
    set(state => { state.sovereignty.isRunActive = false; });
  },
};

// =============================================================================
// SECTION 13 — INDIVIDUAL WIRE FUNCTIONS
// =============================================================================

export function wireTimeEngineHandlers(eventBus: EventBus, set: ZustandSet): void {
  eventBus.on('TICK_TIER_CHANGED',        (e: any) => timeStoreHandlers.onTickTierChanged(set, e.payload));
  eventBus.on('TICK_TIER_FORCED',         (e: any) => timeStoreHandlers.onTickTierForced(set, e.payload));
  eventBus.on('DECISION_WINDOW_OPENED',   (e: any) => timeStoreHandlers.onDecisionWindowOpened(set, e.payload));
  eventBus.on('DECISION_WINDOW_EXPIRED',  (e: any) => timeStoreHandlers.onDecisionWindowClosed(set, e.payload.cardId));
  eventBus.on('DECISION_WINDOW_RESOLVED', (e: any) => timeStoreHandlers.onDecisionWindowClosed(set, e.payload.cardId));
  eventBus.on('SEASON_TIMEOUT_IMMINENT',  (e: any) => timeStoreHandlers.onSeasonTimeoutImminent(set, e.payload));
}

export function wirePressureEngineHandlers(eventBus: EventBus, set: ZustandSet): void {
  eventBus.on('PRESSURE_SCORE_UPDATED', (e: any) => pressureStoreHandlers.onScoreUpdated(set, e.payload));
  eventBus.on('PRESSURE_TIER_CHANGED',  (e: any) => pressureStoreHandlers.onTierChanged(set, e.payload));
  eventBus.on('PRESSURE_CRITICAL',      (e: any) => pressureStoreHandlers.onCritical(set, e.payload));
}

export function wireTensionEngineHandlers(eventBus: EventBus, set: ZustandSet): void {
  eventBus.on('TENSION_SCORE_UPDATED'       as any, (e: any) => tensionStoreHandlers.onScoreUpdated(set, e.payload ?? e));
  eventBus.on('TENSION_VISIBILITY_CHANGED'  as any, (e: any) => tensionStoreHandlers.onVisibilityChanged(set, e.payload ?? e));
  eventBus.on('TENSION_PULSE_FIRED'         as any, (e: any) => tensionStoreHandlers.onPulseFired(set, e.payload ?? e));
  eventBus.on('THREAT_ARRIVED'              as any, (e: any) => tensionStoreHandlers.onThreatArrived(set, e.payload ?? e));
  eventBus.on('THREAT_EXPIRED'              as any, (e: any) => tensionStoreHandlers.onThreatExpired(set, e.payload ?? e));
}

export function wireShieldEngineHandlers(eventBus: EventBus, set: ZustandSet): void {
  eventBus.on('SHIELD_HIT'               as any, (e: any) => shieldStoreHandlers.onShieldHit(set, e.payload ?? e));
  eventBus.on('SHIELD_LAYER_BREACHED'    as any, (e: any) => shieldStoreHandlers.onLayerBreached(set, e.payload ?? e));
  eventBus.on('SHIELD_SNAPSHOT_UPDATED'  as any, (e: any) => {
    const snap: ShieldSnapshot = (e.payload ?? e).snapshot ?? (e.payload ?? e);
    shieldStoreHandlers.onSnapshotUpdated(set, snap);
  });
}

export function wireBattleEngineHandlers(eventBus: EventBus, set: ZustandSet): void {
  eventBus.on('BATTLE_SNAPSHOT_UPDATED' as any, (e: any) => battleStoreHandlers.onSnapshotUpdated(set, e.payload ?? e));
  eventBus.on('BOT_STATE_CHANGED'       as any, (e: any) => battleStoreHandlers.onBotStateChanged(set, e.payload ?? e));
  eventBus.on('BOT_ATTACK_FIRED'        as any, (e: any) => battleStoreHandlers.onBotAttackFired(set, e.payload ?? e));
  eventBus.on('CARD_INJECTED'           as any, (e: any) => battleStoreHandlers.onCardInjected(set, e.payload ?? e));
  eventBus.on('INJECTED_CARD_EXPIRED'   as any, (e: any) => battleStoreHandlers.onCardExpired(set, e.payload ?? e));
}

export function wireCascadeEngineHandlers(eventBus: EventBus, set: ZustandSet): void {
  eventBus.on('CASCADE_CHAIN_STARTED'       as any, (e: any) => cascadeStoreHandlers.onChainStarted(set, e.payload ?? e));
  eventBus.on('CASCADE_LINK_FIRED'          as any, (e: any) => cascadeStoreHandlers.onLinkFired(set, e.payload ?? e));
  eventBus.on('CASCADE_CHAIN_BROKEN'        as any, (e: any) => cascadeStoreHandlers.onChainBroken(set, e.payload ?? e));
  eventBus.on('CASCADE_CHAIN_COMPLETED'     as any, (e: any) => cascadeStoreHandlers.onChainCompleted(set, e.payload ?? e));
  eventBus.on('CASCADE_POSITIVE_ACTIVATED'  as any, (e: any) => cascadeStoreHandlers.onPositiveActivated(set, e.payload ?? e));
  eventBus.on('CASCADE_POSITIVE_DISSOLVED'  as any, (e: any) => cascadeStoreHandlers.onPositiveDissolved(set, e.payload ?? e));
  eventBus.on('NEMESIS_BROKEN'              as any, (e: any) => cascadeStoreHandlers.onNemesisBroken(set, e.payload ?? e));
  eventBus.on('CASCADE_SNAPSHOT_UPDATED'    as any, (e: any) => cascadeStoreHandlers.onSnapshotUpdated(set, e.payload ?? e));
}

export function wireSovereigntyEngineHandlers(eventBus: EventBus, set: ZustandSet): void {
  eventBus.on('RUN_COMPLETED'              as any, (e: any) => sovereigntyStoreHandlers.onRunCompleted(set, e.payload));
  eventBus.on('PROOF_VERIFICATION_FAILED'  as any, (e: any) => sovereigntyStoreHandlers.onVerificationFailed(set, e.payload));
}

// =============================================================================
// SECTION 14 — MASTER WIRING FUNCTION
// =============================================================================

/**
 * Wire ALL engine EventBus subscriptions in a single call.
 * Call after eventBus.reset() so subscriptions are fresh for each run.
 * Card engine wiring is handled separately by ModeRouter via wireCardEngineHandlers().
 *
 * Usage:
 *   wireAllEngineHandlers(sharedEventBus, useEngineStore.setState);
 */
export function wireAllEngineHandlers(eventBus: EventBus, set: ZustandSet): void {
  const s = set;

  wireTimeEngineHandlers(eventBus, s);
  wirePressureEngineHandlers(eventBus, s);
  wireTensionEngineHandlers(eventBus, s);
  wireShieldEngineHandlers(eventBus, s);
  wireBattleEngineHandlers(eventBus, s);
  wireCascadeEngineHandlers(eventBus, s);
  wireSovereigntyEngineHandlers(eventBus, s);
  wireMechanicsRuntimeHandlers(eventBus, s as any);

  // ── Engine 0: Run Lifecycle — wired LAST so all slices reset atomically ──────
  eventBus.on('RUN_STARTED', (e: any) => {
    const p = e.payload;
    s((state) => {
      applyRunStartedAtomic(state, p);
    });
  });

  eventBus.on('RUN_ENDED', (e: any) => {
    const p = e.payload;
    s((state) => {
      applyRunEndedAtomic(state, p);
    });
  });

  eventBus.on('TICK_COMPLETE', (e: any) => {
    s((state) => {
      applyTickCompleteAtomic(state, e.payload);
    });
  });

  // ENGINE_ERROR is IMMEDIATE — bypasses flush queue
  eventBus.on('ENGINE_ERROR', (e: any) => runLifecycleStoreHandlers.onEngineError(s, e.payload));
}

// Canonical alias — prevents the historical typo where wireTimeEngineHandlers
// was accidentally called with (s, s) instead of (eventBus, s).
export { wireTimeEngineHandlers as wireTimeEngine };

export function wireRunStoreMirror(): () => void {
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

  return typeof unsub === 'function' ? unsub : () => undefined;
}
