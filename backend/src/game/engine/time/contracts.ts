/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/contracts.ts
 *
 * Doctrine:
 * - this file is the public contract seam for the backend time lane
 * - concrete implementations may evolve, but these contracts should stay stable
 * - contracts compose cadence, budget, timeout, decision-expiry, hold, season, and telemetry surfaces
 * - all contracts are serialization-safe and orchestration-friendly
 */

import type { ClockSource } from '../core/ClockSource';
import type { EventBus } from '../core/EventBus';
import type {
  EngineEventMap,
  ModeCode,
  PressureTier,
  RunOutcome,
  RunPhase,
} from '../core/GamePrimitives';
import type {
  OutcomeReasonCode,
  RunStateSnapshot,
  TelemetryState,
  TimerState,
} from '../core/RunStateSnapshot';

import type {
  DecisionWindowRegistration,
  ExpiredDecisionOutcome,
  RegisteredDecisionWindow,
} from './DecisionExpiryResolver';
import type {
  ActiveHoldRecord,
  HoldLedgerSnapshot,
  HoldSpendRequest,
  HoldSpendResult,
} from './HoldActionLedger';
import type { RunTimeoutResolution } from './RunTimeoutGuard';
import type {
  SeasonClockSnapshot,
  SeasonLifecycleState,
  SeasonPressureContext,
  SeasonTimelineManifest,
  SeasonTimeWindow,
  SeasonWindowType,
} from './SeasonClock';
import type {
  TickScheduleRequest,
  ScheduledTickEvent,
  TickSchedulerCallback,
  TickSchedulerState,
} from './TickScheduler';
import type {
  TimeAdvanceRequest,
  TimeBudgetProjection,
} from './TimeBudgetService';
import type {
  TimeDecisionTelemetryInput,
  TimeTelemetryProjectionRequest,
} from './TimeTelemetryProjector';

export type TimeEngineEventBusMap = EngineEventMap & Record<string, unknown>;

export interface TimeDecisionWindowState extends RegisteredDecisionWindow {}
export interface TimeRegisteredDecisionWindow extends RegisteredDecisionWindow {}
export interface TimeExpiredDecisionOutcome extends ExpiredDecisionOutcome {}
export interface TimeActiveHoldRecord extends ActiveHoldRecord {}
export interface TimeRunTimeoutResolution extends RunTimeoutResolution {}
export interface TimeBudgetStateProjection extends TimeBudgetProjection {}
export interface TimeSeasonWindow extends SeasonTimeWindow {}
export interface TimeSeasonManifest extends SeasonTimelineManifest {}
export interface TimeSeasonPressureContext extends SeasonPressureContext {}
export interface TimeSeasonClockSnapshot extends SeasonClockSnapshot {}
export interface TimeHoldLedgerSnapshot extends HoldLedgerSnapshot {}
export interface TimeScheduledTickEvent extends ScheduledTickEvent {}
export interface TimeTickSchedulerState extends TickSchedulerState {}
export interface TimeTelemetryRequest extends TimeTelemetryProjectionRequest {}
export interface TimeDecisionTelemetry extends TimeDecisionTelemetryInput {}

export interface TimeContractsVersion {
  readonly namespace: 'backend.time';
  readonly version: '1.0.0';
}

export interface TimeRuntimeContext {
  readonly clock: ClockSource;
  readonly bus: EventBus<TimeEngineEventBusMap>;
  readonly snapshot: RunStateSnapshot;
  readonly nowMs: number;
}

export interface TimeCadenceResolution {
  readonly baseTier: PressureTier;
  readonly resolvedTier: PressureTier;
  readonly durationMs: number;
  readonly decisionWindowMs: number;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly seasonMultiplier: number;
  readonly modeTempoMultiplier: number;
  readonly budgetTempoMultiplier: number;
  readonly remainingBudgetMs: number;
  readonly shouldScreenShake: boolean;
  readonly shouldOpenEndgameWindow: boolean;
  readonly shouldInterpolate: boolean;
  readonly reasonCodes: readonly string[];
}

export interface TimeProjectionResult {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly timers: TimerState;
  readonly telemetry: TelemetryState;
  readonly tags: readonly string[];
  readonly outcome: RunOutcome | null;
  readonly outcomeReason: string | null;
  readonly outcomeReasonCode: OutcomeReasonCode | null;
}

export interface TimePolicyResolver {
  resolve(
    snapshot: RunStateSnapshot,
    options?: {
      readonly nowMs?: number;
      readonly forcedTier?: PressureTier | null;
      readonly previousTier?: PressureTier | null;
    },
  ): TimeCadenceResolution;

  resolveTier(
    snapshot: RunStateSnapshot,
    options?: {
      readonly nowMs?: number;
      readonly forcedTier?: PressureTier | null;
      readonly previousTier?: PressureTier | null;
    },
  ): PressureTier;

  resolveDurationMs(
    snapshot: RunStateSnapshot,
    options?: {
      readonly nowMs?: number;
      readonly forcedTier?: PressureTier | null;
      readonly previousTier?: PressureTier | null;
    },
  ): number;

  resolveDecisionWindowMs(
    snapshot: RunStateSnapshot,
    options?: {
      readonly nowMs?: number;
      readonly forcedTier?: PressureTier | null;
      readonly previousTier?: PressureTier | null;
    },
  ): number;

  getModeTempoMultiplier(mode: ModeCode): number;
  getBudgetTempoMultiplier(remainingBudgetMs: number): number;
}

export interface TimeBudgetManager {
  getSeasonBudgetMs(snapshot: RunStateSnapshot): number;
  getExtensionBudgetMs(snapshot: RunStateSnapshot): number;
  getTotalBudgetMs(snapshot: RunStateSnapshot): number;
  getElapsedMs(snapshot: RunStateSnapshot): number;
  getRemainingBudgetMs(snapshot: RunStateSnapshot): number;
  getConsumedBudgetMs(snapshot: RunStateSnapshot): number;
  getUtilizationPct(snapshot: RunStateSnapshot): number;
  projectAdvance(
    snapshot: RunStateSnapshot,
    request: TimeAdvanceRequest,
  ): TimeBudgetProjection;
  projectTimers(
    snapshot: RunStateSnapshot,
    request: TimeAdvanceRequest,
  ): TimerState;
  grantExtension(snapshot: RunStateSnapshot, extensionMs: number): TimerState;
  replaceSeasonBudget(
    snapshot: RunStateSnapshot,
    seasonBudgetMs: number,
  ): TimerState;
}

export interface TimeTimeoutGuard {
  getTotalBudgetMs(snapshot: RunStateSnapshot): number;
  getConsumedBudgetMs(nextElapsedMs: number): number;
  getRemainingBudgetMs(snapshot: RunStateSnapshot, nextElapsedMs: number): number;
  hasReachedTimeout(snapshot: RunStateSnapshot, nextElapsedMs: number): boolean;
  resolve(snapshot: RunStateSnapshot, nextElapsedMs: number): RunTimeoutResolution;
}

export interface TimeDecisionResolver {
  reset(): void;
  register(
    definition: DecisionWindowRegistration,
    snapshot: RunStateSnapshot,
  ): RegisteredDecisionWindow;
  unregister(windowId: string): boolean;
  has(windowId: string): boolean;
  get(windowId: string): RegisteredDecisionWindow | null;
  getAll(): readonly RegisteredDecisionWindow[];
  syncWithSnapshot(snapshot: RunStateSnapshot): void;
  resolveExpired(
    snapshot: RunStateSnapshot,
    expiredWindowIds: readonly string[],
    nowMs: number,
  ): {
    readonly outcomes: readonly ExpiredDecisionOutcome[];
    readonly unresolvedWindowIds: readonly string[];
    readonly generatedTags: readonly string[];
  };
  resolveNullified(windowId: string): boolean;
  resolveAccepted(windowId: string): boolean;
}

export interface TimeHoldLedger {
  reset(remainingCharges?: number, enabled?: boolean): void;
  rehydrateFromSnapshot(
    snapshot: RunStateSnapshot,
    holdEndsAtMsByWindowId?: Readonly<Record<string, number>>,
  ): void;
  isEnabled(): boolean;
  getRemainingCharges(): number;
  getConsumedThisRun(): number;
  getActiveHold(nowMs: number): ActiveHoldRecord | null;
  isWindowFrozen(windowId: string, nowMs: number): boolean;
  canSpend(nowMs: number): boolean;
  spend(request: HoldSpendRequest): HoldSpendResult;
  release(windowId: string, nowMs: number): boolean;
  snapshot(nowMs: number): HoldLedgerSnapshot;
}

export interface TimeSeasonCalendar {
  reset(): void;
  loadSeasonManifest(manifest: SeasonTimelineManifest): void;
  hasManifest(): boolean;
  getSeasonId(): string | null;
  getSeasonMetadata(): Readonly<Record<string, string | number | boolean | null>> | null;
  getLifecycle(referenceMs?: number): SeasonLifecycleState;
  isSeasonActive(referenceMs?: number): boolean;
  getActiveWindows(referenceMs?: number): readonly SeasonTimeWindow[];
  getAllWindows(): readonly SeasonTimeWindow[];
  hasWindowType(type: SeasonWindowType, referenceMs?: number): boolean;
  getNextWindow(referenceMs?: number, type?: SeasonWindowType): SeasonTimeWindow | null;
  getPressureMultiplier(referenceMs?: number): number;
  getMsUntilSeasonStart(referenceMs?: number): number;
  getMsUntilSeasonEnd(referenceMs?: number): number;
  getPressureContext(referenceMs?: number): SeasonPressureContext;
  snapshot(referenceMs?: number): SeasonClockSnapshot;
}

export interface TimeEventPublisher {
  emitTickStarted(
    snapshot: RunStateSnapshot,
    tick?: number,
    phase?: RunPhase,
    options?: {
      readonly emittedAtTick?: number;
      readonly tags?: readonly string[];
    },
  ): void;

  emitTickCompleted(
    snapshot: RunStateSnapshot,
    checksum: string,
    tick?: number,
    phase?: RunPhase,
    options?: {
      readonly emittedAtTick?: number;
      readonly tags?: readonly string[];
    },
  ): void;

  emitRunStarted(
    snapshot: RunStateSnapshot,
    options?: {
      readonly emittedAtTick?: number;
      readonly tags?: readonly string[];
    },
  ): void;

  emitPressureChanged(
    from: PressureTier,
    to: PressureTier,
    score: number,
    tick: number,
    options?: {
      readonly emittedAtTick?: number;
      readonly tags?: readonly string[];
    },
  ): void;
}

export interface TimeScheduler {
  setOnTick(callback: TickSchedulerCallback): void;
  start(initialRequest: TickScheduleRequest): void;
  pause(): void;
  resume(): void;
  stop(resetTickCounter?: boolean): void;
  rearm(request: TickScheduleRequest): void;
  getState(): TickSchedulerState;
  isDue(referenceMs?: number): boolean;
  getTickNumber(): number;
  getCurrentTier(): PressureTier;
  getNextFireAtMs(): number | null;
  getRemainingMs(referenceMs?: number): number | null;
  forceFire(): Promise<void>;
}

export interface TimeTelemetryProjectorContract {
  project(
    previous: TelemetryState,
    request?: TimeTelemetryProjectionRequest,
  ): TelemetryState;
  projectForSnapshot(
    snapshot: RunStateSnapshot,
    request?: TimeTelemetryProjectionRequest,
  ): TelemetryState;
  appendDecision(
    previous: TelemetryState,
    decision: TimeDecisionTelemetryInput,
  ): TelemetryState;
  appendWarning(previous: TelemetryState, warning: string): TelemetryState;
  appendForkHint(previous: TelemetryState, forkHint: string): TelemetryState;
  incrementEventCount(previous: TelemetryState, delta?: number): TelemetryState;
  setChecksum(previous: TelemetryState, checksum: string | null): TelemetryState;
  setOutcomeReason(
    previous: TelemetryState,
    outcomeReason: string | null,
    outcomeReasonCode: OutcomeReasonCode | null,
  ): TelemetryState;
}

export interface TimeSnapshotProjectorContract {
  project(
    snapshot: RunStateSnapshot,
    request: {
      readonly tick: number;
      readonly phase: RunPhase;
      readonly timers: TimerState;
      readonly tags?: readonly string[];
      readonly warnings?: readonly string[];
      readonly outcome?: RunOutcome | null;
      readonly outcomeReason?: string | null;
      readonly outcomeReasonCode?: OutcomeReasonCode | null;
      readonly decisionWindowExpired?: boolean;
    },
  ): RunStateSnapshot;

  projectTimeAdvance(
    snapshot: RunStateSnapshot,
    tick: number,
    phase: RunPhase,
    timers: TimerState,
    extra?: {
      readonly tags?: readonly string[];
      readonly warnings?: readonly string[];
      readonly outcome?: RunOutcome | null;
      readonly outcomeReason?: string | null;
      readonly outcomeReasonCode?: OutcomeReasonCode | null;
      readonly decisionWindowExpired?: boolean;
    },
  ): RunStateSnapshot;
}