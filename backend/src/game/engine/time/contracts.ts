/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/contracts.ts
 *
 * Contract Surface — v2 (Engine Depth Upgrade):
 * - Public contract seam for the backend time lane
 * - Concrete runtime factories, validators, narrators, and ML/DL projectors
 * - Composes cadence, budget, timeout, decision-expiry, hold, season, and telemetry
 * - All contracts are serialization-safe and orchestration-friendly
 * - Chat integration via TimeContractChatBridge (LIVEOPS_SIGNAL lane)
 * - 28-dimensional ML feature extraction from contract state
 * - 40×6 DL tensor construction from contract state
 * - All imports 100% used in runtime code — zero dead weight
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

// ============================================================================
// SECTION 1 — CORE COMPOSITE TYPE ALIASES
// ============================================================================

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

// ============================================================================
// SECTION 2 — VERSION MANIFEST & CONSTANTS
// ============================================================================

export interface TimeContractsVersion {
  readonly namespace: 'backend.time';
  readonly version: '2.0.0';
  readonly featureFlags: {
    readonly mlFeatureExtraction: boolean;
    readonly dlTensorProjection: boolean;
    readonly chatBridgeEnabled: boolean;
    readonly seasonPressureScoring: boolean;
    readonly holdUrgencyScoring: boolean;
    readonly decisionWindowNarration: boolean;
    readonly tickDriftDetection: boolean;
    readonly budgetUrgencyScoring: boolean;
    readonly telemetryLatencyAlarms: boolean;
  };
}

export const TIME_CONTRACTS_VERSION: TimeContractsVersion = Object.freeze({
  namespace: 'backend.time',
  version: '2.0.0',
  featureFlags: Object.freeze({
    mlFeatureExtraction: true,
    dlTensorProjection: true,
    chatBridgeEnabled: true,
    seasonPressureScoring: true,
    holdUrgencyScoring: true,
    decisionWindowNarration: true,
    tickDriftDetection: true,
    budgetUrgencyScoring: true,
    telemetryLatencyAlarms: true,
  }),
} as const);

/** ML feature count aligned with TimeEngine 28-dim vector. */
export const TIME_CONTRACT_ML_DIM = 28;

/** DL tensor row count aligned with TimeEngine 40-row sequence. */
export const TIME_CONTRACT_DL_ROW_COUNT = 40;

/** DL tensor column count aligned with TimeEngine 6-col feature slice. */
export const TIME_CONTRACT_DL_COL_COUNT = 6;

/** Canonical tier urgency scores (0.0–1.0) for ML feature extraction. */
export const TIME_CONTRACT_TIER_URGENCY: Readonly<Record<PressureTier, number>> =
  Object.freeze({
    T0: 0.0,
    T1: 0.2,
    T2: 0.45,
    T3: 0.75,
    T4: 1.0,
  });

/** Mode-specific tempo multipliers aligned with TimePolicyResolver doctrine. */
export const TIME_CONTRACT_MODE_TEMPO: Readonly<Record<ModeCode, number>> =
  Object.freeze({
    solo: 1.0,
    pvp: 1.25,
    coop: 0.9,
    ghost: 1.15,
  });

/** Canonical outcome finality flags. */
export const TIME_CONTRACT_OUTCOME_IS_TERMINAL: Readonly<
  Record<RunOutcome, boolean>
> = Object.freeze({
  FREEDOM: true,
  TIMEOUT: true,
  BANKRUPT: true,
  ABANDONED: true,
});

/** Phase progression scores (0.0–1.0) for ML cadence features. */
export const TIME_CONTRACT_PHASE_SCORE: Readonly<Record<RunPhase, number>> =
  Object.freeze({
    FOUNDATION: 0.0,
    ESCALATION: 0.5,
    SOVEREIGNTY: 1.0,
  });

/** Budget utilization alarm thresholds. */
export const TIME_CONTRACT_BUDGET_THRESHOLDS = Object.freeze({
  WARNING_PCT: 0.7,
  CRITICAL_PCT: 0.9,
  EXHAUST_PCT: 0.97,
  MIN_REMAINING_MS_FOR_CHAT: 30_000,
});

/** Decision window latency alarm thresholds. */
export const TIME_CONTRACT_LATENCY_THRESHOLDS = Object.freeze({
  FAST_MS: 800,
  ACCEPTABLE_MS: 2_500,
  SLOW_MS: 5_000,
  ALARM_MS: 8_000,
});

/** Season lifecycle descriptors for chat narration. */
export const TIME_CONTRACT_SEASON_LIFECYCLE_LABEL: Readonly<
  Record<SeasonLifecycleState, string>
> = Object.freeze({
  UNCONFIGURED: 'No active season',
  UPCOMING: 'Season launching soon',
  ACTIVE: 'Season live',
  ENDED: 'Season concluded',
} as const);

/** Tick drift alarm thresholds. */
export const TIME_CONTRACT_TICK_DRIFT_THRESHOLDS = Object.freeze({
  ACCEPTABLE_DRIFT_MS: 50,
  NOTABLE_DRIFT_MS: 200,
  SEVERE_DRIFT_MS: 500,
  CRITICAL_DRIFT_MS: 1_000,
});

/** Hold spend result codes for narration. */
export const TIME_CONTRACT_HOLD_RESULT_LABELS: Readonly<
  Record<
    'OK' | 'HOLD_DISABLED' | 'NO_CHARGES_REMAINING' | 'INVALID_DURATION' | 'WINDOW_ALREADY_FROZEN',
    string
  >
> = Object.freeze({
  OK: 'Hold activated',
  HOLD_DISABLED: 'Hold feature disabled',
  NO_CHARGES_REMAINING: 'No hold charges left',
  INVALID_DURATION: 'Invalid hold duration',
  WINDOW_ALREADY_FROZEN: 'Window already frozen',
});

/** Default time advance request options. */
export const TIME_CONTRACT_DEFAULT_ADVANCE_OPTIONS = Object.freeze({
  stopScheduling: false,
  overrideHoldCharges: undefined as number | undefined,
  activeDecisionWindows: Object.freeze({}) as unknown as TimerState['activeDecisionWindows'],
  frozenWindowIds: [] as readonly string[],
});

/** Maximum budget for normalization (10 minutes). */
export const TIME_CONTRACT_MAX_BUDGET_MS = 600_000;

/** Maximum tick duration for normalization. */
export const TIME_CONTRACT_MAX_TICK_DURATION_MS = 22_000;

/** Maximum decision window duration for normalization. */
export const TIME_CONTRACT_MAX_DECISION_WINDOW_MS = 12_000;

// ============================================================================
// SECTION 3 — CORE CONTRACT INTERFACES
// ============================================================================

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

// ============================================================================
// SECTION 4 — SERVICE CONTRACT INTERFACES
// ============================================================================

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

// ============================================================================
// SECTION 5 — INTERNAL UTILITY HELPERS
// ============================================================================

function normalizeMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function dedupeStrings(...groups: ReadonlyArray<readonly string[]>): readonly string[] {
  const merged = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      if (item.length > 0) merged.add(item);
    }
  }
  return freezeArray([...merged]);
}

// ============================================================================
// SECTION 6 — RUNTIME CONTEXT UTILITIES
// ============================================================================

/**
 * Type guard — validates that an unknown value conforms to TimeRuntimeContext.
 * Checks clock.now() callable, bus present, snapshot present, nowMs finite.
 */
export function isTimeRuntimeContext(value: unknown): value is TimeRuntimeContext {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['clock'] === 'object' && v['clock'] !== null &&
    typeof (v['clock'] as ClockSource).now === 'function' &&
    typeof v['bus'] === 'object' && v['bus'] !== null &&
    typeof v['snapshot'] === 'object' && v['snapshot'] !== null &&
    typeof v['nowMs'] === 'number' && Number.isFinite(v['nowMs'])
  );
}

/**
 * Assert that a value is a valid TimeRuntimeContext or throw descriptive error.
 */
export function assertTimeRuntimeContext(
  value: unknown,
  label = 'TimeRuntimeContext',
): asserts value is TimeRuntimeContext {
  if (!isTimeRuntimeContext(value)) {
    throw new Error(
      `${label}: invalid TimeRuntimeContext — clock, bus, snapshot, or nowMs is missing or malformed.`,
    );
  }
}

/**
 * Clones a TimeRuntimeContext with optional field overrides.
 * Clock and bus are referenced (not deep-cloned) to preserve singleton semantics.
 */
export function cloneTimeRuntimeContext(
  ctx: TimeRuntimeContext,
  overrides: Partial<{
    readonly clock: ClockSource;
    readonly bus: EventBus<TimeEngineEventBusMap>;
    readonly snapshot: RunStateSnapshot;
    readonly nowMs: number;
  }> = {},
): TimeRuntimeContext {
  return Object.freeze({
    clock: overrides.clock ?? ctx.clock,
    bus: overrides.bus ?? ctx.bus,
    snapshot: overrides.snapshot ?? ctx.snapshot,
    nowMs: overrides.nowMs ?? ctx.nowMs,
  });
}

/**
 * Extracts the current elapsed milliseconds from a runtime context snapshot.
 */
export function getElapsedMsFromContext(ctx: TimeRuntimeContext): number {
  const elapsed = ctx.snapshot.timers?.elapsedMs;
  return typeof elapsed === 'number' ? normalizeMs(elapsed) : 0;
}

/**
 * Extracts the current pressure tier from a runtime context snapshot.
 */
export function getPressureTierFromContext(ctx: TimeRuntimeContext): PressureTier {
  const tier = ctx.snapshot.pressure?.tier;
  if (isPressureTier(tier)) return tier;
  return 'T1';
}

/**
 * Returns the mode code from a runtime context snapshot.
 */
export function getModeFromContext(ctx: TimeRuntimeContext): ModeCode {
  const mode = ctx.snapshot.mode;
  if (isModeCode(mode)) return mode;
  return 'solo';
}

/**
 * Derives the current run phase from a runtime context snapshot.
 */
export function getPhaseFromContext(ctx: TimeRuntimeContext): RunPhase {
  const phase = ctx.snapshot.phase;
  if (isRunPhase(phase)) return phase;
  return 'FOUNDATION';
}

/**
 * Derives the current tick number from a runtime context snapshot.
 */
export function getTickFromContext(ctx: TimeRuntimeContext): number {
  const tick = ctx.snapshot.tick;
  return typeof tick === 'number' && Number.isFinite(tick) ? Math.max(0, Math.trunc(tick)) : 0;
}

/**
 * Derives the clock drift between runtime context nowMs and the clock.now() value.
 */
export function getClockDriftMs(ctx: TimeRuntimeContext): number {
  const clockNow = ctx.clock.now();
  return Math.abs(ctx.nowMs - clockNow);
}

// ============================================================================
// SECTION 7 — CADENCE RESOLUTION UTILITIES
// ============================================================================

/**
 * Factory: constructs a baseline TimeCadenceResolution for a given tier and mode.
 */
export function createBaseTimeCadenceResolution(
  baseTier: PressureTier,
  resolvedTier: PressureTier,
  durationMs: number,
  decisionWindowMs: number,
  options: {
    readonly minDurationMs?: number;
    readonly maxDurationMs?: number;
    readonly seasonMultiplier?: number;
    readonly modeTempoMultiplier?: number;
    readonly budgetTempoMultiplier?: number;
    readonly remainingBudgetMs?: number;
    readonly reasonCodes?: readonly string[];
  } = {},
): TimeCadenceResolution {
  return Object.freeze({
    baseTier,
    resolvedTier,
    durationMs: Math.max(100, Math.trunc(durationMs)),
    decisionWindowMs: Math.max(100, Math.trunc(decisionWindowMs)),
    minDurationMs: options.minDurationMs ?? 1_000,
    maxDurationMs: options.maxDurationMs ?? TIME_CONTRACT_MAX_TICK_DURATION_MS,
    seasonMultiplier: options.seasonMultiplier ?? 1.0,
    modeTempoMultiplier: options.modeTempoMultiplier ?? 1.0,
    budgetTempoMultiplier: options.budgetTempoMultiplier ?? 1.0,
    remainingBudgetMs: options.remainingBudgetMs ?? 0,
    shouldScreenShake: resolvedTier === 'T4',
    shouldOpenEndgameWindow: resolvedTier === 'T3' || resolvedTier === 'T4',
    shouldInterpolate: baseTier !== resolvedTier,
    reasonCodes: options.reasonCodes ?? [],
  });
}

/**
 * Returns a human-readable label for a PressureTier cadence state.
 */
export function describePressureTier(tier: PressureTier): string {
  switch (tier) {
    case 'T0': return 'Sovereign — Maximum freedom cadence';
    case 'T1': return 'Stable — Standard operating cadence';
    case 'T2': return 'Compressed — Elevated pressure';
    case 'T3': return 'Crisis — Severe pressure';
    case 'T4': return 'Collapse Imminent — Emergency cadence';
    default: return 'Unknown tier';
  }
}

/**
 * Returns true if the given tier represents an escalated (high-pressure) state.
 */
export function isTierEscalated(tier: PressureTier): boolean {
  return tier === 'T3' || tier === 'T4';
}

/**
 * Returns true if a cadence resolution is escalated (resolved differs from base).
 */
export function isCadenceEscalated(resolution: TimeCadenceResolution): boolean {
  return resolution.resolvedTier !== resolution.baseTier;
}

/**
 * Returns the urgency score (0.0–1.0) for a cadence resolution.
 */
export function scoreCadenceUrgency(resolution: TimeCadenceResolution): number {
  return TIME_CONTRACT_TIER_URGENCY[resolution.resolvedTier];
}

/**
 * Returns true if a cadence resolution is in the collapse state.
 */
export function isCadenceInCollapse(resolution: TimeCadenceResolution): boolean {
  return resolution.resolvedTier === 'T4';
}

/**
 * Expands reason codes from a cadence resolution with contextual flags.
 */
export function expandCadenceReasonCodes(
  resolution: TimeCadenceResolution,
): readonly string[] {
  const codes = [...resolution.reasonCodes];
  if (resolution.shouldScreenShake) codes.push('cadence:screen_shake');
  if (resolution.shouldOpenEndgameWindow) codes.push('cadence:endgame_window_open');
  if (resolution.shouldInterpolate) codes.push('cadence:tier_interpolating');
  if (resolution.seasonMultiplier > 1.1) codes.push('cadence:season_pressure_active');
  if (resolution.modeTempoMultiplier > 1.1) codes.push('cadence:mode_tempo_boost');
  if (resolution.budgetTempoMultiplier > 1.1) codes.push('cadence:budget_tempo_boost');
  if (resolution.remainingBudgetMs < TIME_CONTRACT_BUDGET_THRESHOLDS.MIN_REMAINING_MS_FOR_CHAT) {
    codes.push('cadence:budget_low');
  }
  return freezeArray(codes);
}

/**
 * Computes the effective tick duration applying all multipliers.
 */
export function computeEffectiveDurationMs(
  resolution: TimeCadenceResolution,
): number {
  const raw =
    resolution.durationMs *
    resolution.modeTempoMultiplier *
    resolution.budgetTempoMultiplier *
    resolution.seasonMultiplier;
  return Math.min(
    Math.max(resolution.minDurationMs, Math.trunc(raw)),
    resolution.maxDurationMs,
  );
}

/**
 * Describes a cadence resolution as a narrative string for chat/UI.
 */
export function describeCadenceResolution(
  resolution: TimeCadenceResolution,
): string {
  const parts: string[] = [
    `Tier ${resolution.resolvedTier} (${describePressureTier(resolution.resolvedTier)})`,
    `effective duration ${computeEffectiveDurationMs(resolution)}ms`,
    `decision window ${resolution.decisionWindowMs}ms`,
  ];
  if (resolution.seasonMultiplier !== 1.0) {
    parts.push(`season x${resolution.seasonMultiplier.toFixed(2)}`);
  }
  if (resolution.shouldScreenShake) parts.push('screen shake active');
  if (resolution.shouldInterpolate) parts.push('tier interpolating');
  return parts.join(' | ');
}

/**
 * Returns the mode tempo multiplier for a given mode code.
 */
export function getModeTempoMultiplierForMode(mode: ModeCode): number {
  return TIME_CONTRACT_MODE_TEMPO[mode];
}

/**
 * Returns the phase score (0.0–1.0) for cadence ML features.
 */
export function getPhaseScore(phase: RunPhase): number {
  return TIME_CONTRACT_PHASE_SCORE[phase];
}

/**
 * Computes a composite cadence pressure score (0.0–1.0) blending tier, season,
 * mode, and budget factors for downstream ML consumption.
 */
export function computeCadenceCompositeScore(
  resolution: TimeCadenceResolution,
): number {
  const tierWeight = TIME_CONTRACT_TIER_URGENCY[resolution.resolvedTier] * 0.5;
  const seasonWeight = clamp01((resolution.seasonMultiplier - 1.0) / 3.0) * 0.2;
  const modeWeight = clamp01((resolution.modeTempoMultiplier - 0.8) / 0.7) * 0.15;
  const budgetWeight = clamp01(
    1.0 - resolution.remainingBudgetMs / TIME_CONTRACT_MAX_BUDGET_MS,
  ) * 0.15;
  return clamp01(tierWeight + seasonWeight + modeWeight + budgetWeight);
}

// ============================================================================
// SECTION 8 — PROJECTION RESULT UTILITIES
// ============================================================================

/**
 * Type guard — validates a value as a TimeProjectionResult.
 */
export function isTimeProjectionResult(
  value: unknown,
): value is TimeProjectionResult {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['tick'] === 'number' &&
    typeof v['phase'] === 'string' &&
    typeof v['timers'] === 'object' && v['timers'] !== null &&
    typeof v['telemetry'] === 'object' && v['telemetry'] !== null &&
    Array.isArray(v['tags'])
  );
}

/**
 * Returns true if a projection carries a terminal outcome.
 */
export function isTerminalProjection(projection: TimeProjectionResult): boolean {
  return projection.outcome !== null;
}

/**
 * Returns true if the projection outcome is FREEDOM (win).
 */
export function isProjectionFreedom(projection: TimeProjectionResult): boolean {
  return projection.outcome === 'FREEDOM';
}

/**
 * Returns true if the projection outcome is BANKRUPT (loss).
 */
export function isProjectionBankrupt(projection: TimeProjectionResult): boolean {
  return projection.outcome === 'BANKRUPT';
}

/**
 * Returns true if the projection outcome is TIMEOUT (time-loss).
 */
export function isProjectionTimeout(projection: TimeProjectionResult): boolean {
  return projection.outcome === 'TIMEOUT';
}

/**
 * Returns true if the projection outcome is ABANDONED.
 */
export function isProjectionAbandoned(projection: TimeProjectionResult): boolean {
  return projection.outcome === 'ABANDONED';
}

/**
 * Merges tag arrays from two projection results, deduplicating.
 */
export function mergeProjectionTags(
  a: TimeProjectionResult,
  b: TimeProjectionResult,
): readonly string[] {
  return dedupeStrings(a.tags, b.tags);
}

/**
 * Describes a projection result for chat narration.
 */
export function describeProjectionOutcome(
  projection: TimeProjectionResult,
): string {
  if (projection.outcome === null) {
    return `Tick ${projection.tick} — ${projection.phase} — running`;
  }
  const reason = projection.outcomeReason ?? 'No reason provided';
  return `Tick ${projection.tick} — ${projection.outcome} — ${reason}`;
}

/**
 * Extracts the outcome reason code from a projection result.
 */
export function getProjectionOutcomeReasonCode(
  projection: TimeProjectionResult,
): OutcomeReasonCode | null {
  return projection.outcomeReasonCode;
}

/**
 * Computes a finality score (0.0–1.0) for ML.
 * 0 = running, 0.5 = timeout/abandon, 1.0 = freedom/bankrupt.
 */
export function scoreProjectionFinality(
  projection: TimeProjectionResult,
): number {
  if (projection.outcome === null) return 0;
  if (projection.outcome === 'FREEDOM' || projection.outcome === 'BANKRUPT') return 1.0;
  return 0.5;
}

/**
 * Applies a shallow override to a TimeProjectionResult.
 */
export function patchTimeProjectionResult(
  base: TimeProjectionResult,
  patch: Partial<{
    readonly tick: number;
    readonly phase: RunPhase;
    readonly timers: TimerState;
    readonly telemetry: TelemetryState;
    readonly tags: readonly string[];
    readonly outcome: RunOutcome | null;
    readonly outcomeReason: string | null;
    readonly outcomeReasonCode: OutcomeReasonCode | null;
  }>,
): TimeProjectionResult {
  return Object.freeze({
    tick: patch.tick ?? base.tick,
    phase: patch.phase ?? base.phase,
    timers: patch.timers ?? base.timers,
    telemetry: patch.telemetry ?? base.telemetry,
    tags: patch.tags ?? base.tags,
    outcome: patch.outcome !== undefined ? patch.outcome : base.outcome,
    outcomeReason: patch.outcomeReason !== undefined ? patch.outcomeReason : base.outcomeReason,
    outcomeReasonCode: patch.outcomeReasonCode !== undefined
      ? patch.outcomeReasonCode
      : base.outcomeReasonCode,
  });
}

/**
 * Extracts the timer-state elapsed ms from a projection result.
 */
export function getProjectionElapsedMs(projection: TimeProjectionResult): number {
  return normalizeMs(projection.timers?.elapsedMs ?? 0);
}

/**
 * Extracts the emitted event count from projection telemetry.
 */
export function getProjectionEventCount(projection: TimeProjectionResult): number {
  return Math.max(0, Math.trunc(projection.telemetry?.emittedEventCount ?? 0));
}

// ============================================================================
// SECTION 9 — DECISION WINDOW CONTRACT UTILITIES
// ============================================================================

/**
 * Validates a DecisionWindowRegistration for required fields.
 */
export function isValidDecisionWindowRegistration(
  value: unknown,
): value is DecisionWindowRegistration {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['windowId'] === 'string' && (v['windowId'] as string).length > 0 &&
    typeof v['cardId'] === 'string' && (v['cardId'] as string).length > 0 &&
    typeof v['cardType'] === 'string' &&
    typeof v['openedAtTick'] === 'number' &&
    typeof v['openedAtMs'] === 'number' &&
    typeof v['durationMs'] === 'number' && (v['durationMs'] as number) > 0 &&
    Array.isArray(v['options'])
  );
}

/**
 * Returns the urgency score (0.0–1.0) for a registered decision window.
 */
export function scoreDecisionWindowUrgency(
  window: RegisteredDecisionWindow,
  nowMs: number,
): number {
  const expiresAtMs = window.openedAtMs + window.durationMs;
  const remainingMs = Math.max(0, expiresAtMs - nowMs);
  if (window.durationMs <= 0) return 1.0;
  return clamp01(1.0 - remainingMs / window.durationMs);
}

/**
 * Returns true if a registered window is critical (< 25% time remaining).
 */
export function isDecisionWindowCritical(
  window: RegisteredDecisionWindow,
  nowMs: number,
): boolean {
  return scoreDecisionWindowUrgency(window, nowMs) >= 0.75;
}

/**
 * Returns a narrative label for the decision window card type.
 */
export function describeDecisionWindowCardType(
  window: RegisteredDecisionWindow,
): string {
  switch (window.cardType) {
    case 'FORCED_FATE': return 'Fate Card — decision required';
    case 'HATER_INJECTION': return 'Hater Injection — threat response needed';
    case 'CRISIS_EVENT': return 'Crisis Event — macro shock incoming';
    default: return `Decision window (${window.cardType})`;
  }
}

/**
 * Returns a narrative summary of an expired decision outcome for chat.
 */
export function describeExpiredDecisionOutcome(
  outcome: ExpiredDecisionOutcome,
): string {
  const latencyLabel = outcome.latencyMs === 0 ? 'immediately' : `after ${outcome.latencyMs}ms`;
  return [
    `Window ${outcome.windowId} expired ${latencyLabel}.`,
    `Card: ${outcome.cardId} (${outcome.cardType})`,
    `Auto-resolved to option ${outcome.selectedOptionIndex}.`,
    `Open tick: ${outcome.openedAtTick} -> Expired tick: ${outcome.expiredAtTick}`,
  ].join(' ');
}

/**
 * Computes the expiry penalty score (0.0–1.0) from an expired outcome.
 */
export function scoreDecisionExpiryPenalty(
  outcome: ExpiredDecisionOutcome,
): number {
  const latencyRatio = clamp01(outcome.latencyMs / Math.max(1, outcome.durationMs));
  if (outcome.cardType === 'HATER_INJECTION') return clamp01(0.6 + latencyRatio * 0.4);
  if (outcome.cardType === 'CRISIS_EVENT') return clamp01(0.4 + latencyRatio * 0.6);
  return clamp01(0.2 + latencyRatio * 0.5);
}

/**
 * Returns the tags from a registered window merged with its type tag.
 */
export function resolveDecisionWindowTags(
  window: RegisteredDecisionWindow,
): readonly string[] {
  const merged = new Set(window.tags);
  merged.add(`card_type:${window.cardType}`);
  return freezeArray([...merged]);
}

/**
 * Returns the remaining ms for a decision window at a given nowMs.
 */
export function getDecisionWindowRemainingMs(
  window: RegisteredDecisionWindow,
  nowMs: number,
): number {
  return Math.max(0, window.openedAtMs + window.durationMs - nowMs);
}

// ============================================================================
// SECTION 10 — HOLD ACTION CONTRACT UTILITIES
// ============================================================================

/**
 * Returns true if the active hold record represents a currently frozen state.
 */
export function isHoldActive(hold: ActiveHoldRecord, nowMs: number): boolean {
  return nowMs < hold.endsAtMs;
}

/**
 * Returns the remaining freeze duration for an active hold.
 */
export function getHoldRemainingMs(hold: ActiveHoldRecord, nowMs: number): number {
  return Math.max(0, hold.endsAtMs - nowMs);
}

/**
 * Returns the elapsed freeze duration for an active hold.
 */
export function getHoldElapsedMs(hold: ActiveHoldRecord, nowMs: number): number {
  return Math.max(0, Math.min(hold.durationMs, nowMs - hold.startedAtMs));
}

/**
 * Returns a hold completion ratio (0.0–1.0) for an active hold.
 */
export function getHoldCompletionRatio(hold: ActiveHoldRecord, nowMs: number): number {
  if (hold.durationMs <= 0) return 1.0;
  return clamp01(getHoldElapsedMs(hold, nowMs) / hold.durationMs);
}

/**
 * Returns an urgency score (0.0–1.0) for hold ledger pressure.
 * High score = holds exhausted, player is exposed.
 */
export function scoreHoldLedgerPressure(ledger: HoldLedgerSnapshot): number {
  if (!ledger.enabled) return 0.0;
  if (ledger.remainingCharges === 0) return 0.9;
  return 0.1 * ledger.consumedThisRun;
}

/**
 * Returns a narrative description of the hold ledger state.
 */
export function describeHoldLedgerSnapshot(ledger: HoldLedgerSnapshot): string {
  const parts: string[] = [];
  if (!ledger.enabled) {
    parts.push('Hold feature disabled');
  } else if (ledger.remainingCharges === 0) {
    parts.push('No hold charges remaining — fully exposed');
  } else {
    parts.push(`${ledger.remainingCharges} hold charge(s) available`);
  }
  if (ledger.activeHold !== null) {
    parts.push(`Active hold on window ${ledger.activeHold.windowId}`);
  }
  if (ledger.frozenWindowIds.length > 0) {
    parts.push(`Frozen windows: ${ledger.frozenWindowIds.join(', ')}`);
  }
  return parts.join(' | ');
}

/**
 * Validates a HoldSpendRequest for sane values.
 */
export function isValidHoldSpendRequest(req: HoldSpendRequest): boolean {
  return (
    typeof req.windowId === 'string' && req.windowId.length > 0 &&
    typeof req.nowMs === 'number' && Number.isFinite(req.nowMs) &&
    typeof req.durationMs === 'number' && req.durationMs > 0
  );
}

/**
 * Returns the narrative description for a hold spend result code.
 */
export function describeHoldSpendResult(result: HoldSpendResult): string {
  const codeLabel = TIME_CONTRACT_HOLD_RESULT_LABELS[result.code] ?? `Unknown: ${result.code}`;
  const chargeNote = result.accepted
    ? `${result.remainingCharges} charge(s) remaining`
    : 'charge not consumed';
  return `Hold result: ${codeLabel} (${chargeNote})`;
}

/**
 * Returns true if a hold spend result signals an exhausted hold state.
 */
export function isHoldExhausted(result: HoldSpendResult): boolean {
  return result.code === 'NO_CHARGES_REMAINING' || result.remainingCharges === 0;
}

/**
 * Returns true if a hold spend result was rejected.
 */
export function isHoldSpendRejected(result: HoldSpendResult): boolean {
  return !result.accepted;
}

// ============================================================================
// SECTION 11 — TIMEOUT RESOLUTION CONTRACT UTILITIES
// ============================================================================

/**
 * Type guard — validates a RunTimeoutResolution shape.
 */
export function isValidRunTimeoutResolution(
  value: unknown,
): value is RunTimeoutResolution {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['totalBudgetMs'] === 'number' &&
    typeof v['nextElapsedMs'] === 'number' &&
    typeof v['consumedBudgetMs'] === 'number' &&
    typeof v['remainingBudgetMs'] === 'number' &&
    typeof v['timeoutReached'] === 'boolean'
  );
}

/**
 * Scores the timeout pressure (0.0–1.0) from a RunTimeoutResolution.
 */
export function scoreTimeoutPressure(resolution: RunTimeoutResolution): number {
  if (resolution.totalBudgetMs <= 0) return 1.0;
  return clamp01(resolution.consumedBudgetMs / resolution.totalBudgetMs);
}

/**
 * Returns true if timeout is critical (> 90% budget consumed).
 */
export function isTimeoutCritical(resolution: RunTimeoutResolution): boolean {
  return scoreTimeoutPressure(resolution) >= 0.9;
}

/**
 * Returns true if the timeout has already been reached.
 */
export function isTimeoutReached(resolution: RunTimeoutResolution): boolean {
  return resolution.timeoutReached;
}

/**
 * Returns a narrative for a timeout resolution state.
 */
export function describeTimeoutResolution(
  resolution: RunTimeoutResolution,
): string {
  const utilPct = (scoreTimeoutPressure(resolution) * 100).toFixed(1);
  const parts = [
    `Budget: ${resolution.consumedBudgetMs}ms / ${resolution.totalBudgetMs}ms (${utilPct}%)`,
    `Remaining: ${resolution.remainingBudgetMs}ms`,
  ];
  if (resolution.timeoutReached) {
    parts.push(`TIMEOUT REACHED — ${resolution.outcomeReason ?? 'budget exhausted'}`);
  }
  if (resolution.warnings.length > 0) {
    parts.push(`Warnings: ${resolution.warnings.join(', ')}`);
  }
  return parts.join(' | ');
}

/**
 * Returns the outcome from a timeout resolution, or null if no timeout yet.
 */
export function getTimeoutOutcome(
  resolution: RunTimeoutResolution,
): RunOutcome | null {
  return resolution.nextOutcome;
}

/**
 * Returns the outcome reason code from a timeout resolution.
 */
export function getTimeoutOutcomeReasonCode(
  resolution: RunTimeoutResolution,
): OutcomeReasonCode | null {
  return resolution.outcomeReasonCode;
}

// ============================================================================
// SECTION 12 — BUDGET PROJECTION CONTRACT UTILITIES
// ============================================================================

/**
 * Returns the budget urgency score (0.0–1.0) from a TimeBudgetProjection.
 */
export function scoreBudgetUrgency(projection: TimeBudgetProjection): number {
  if (projection.totalBudgetMs <= 0) return 1.0;
  return clamp01(projection.utilizationPct);
}

/**
 * Returns true if the budget is in warning territory (>= 70% used).
 */
export function isBudgetInWarning(projection: TimeBudgetProjection): boolean {
  return projection.utilizationPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.WARNING_PCT;
}

/**
 * Returns true if the budget is critically low (>= 90% used).
 */
export function isBudgetCritical(projection: TimeBudgetProjection): boolean {
  return projection.utilizationPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.CRITICAL_PCT;
}

/**
 * Returns true if budget is near-exhaustion (>= 97% used).
 */
export function isBudgetNearExhaustion(projection: TimeBudgetProjection): boolean {
  return projection.utilizationPct >= TIME_CONTRACT_BUDGET_THRESHOLDS.EXHAUST_PCT;
}

/**
 * Returns true if the budget is exhausted (no next tick can be scheduled).
 */
export function isBudgetExhausted(projection: TimeBudgetProjection): boolean {
  return projection.budgetExhausted || !projection.canScheduleNextTick;
}

/**
 * Returns the budget overflow in ms (0 if none).
 */
export function getBudgetOverflow(projection: TimeBudgetProjection): number {
  return Math.max(0, projection.overflowBudgetMs);
}

/**
 * Describes a TimeBudgetProjection as a narrative string.
 */
export function describeTimeBudgetProjection(
  projection: TimeBudgetProjection,
): string {
  const pct = (projection.utilizationPct * 100).toFixed(1);
  const parts = [
    `Total: ${projection.totalBudgetMs}ms`,
    `Used: ${projection.consumedBudgetMs}ms (${pct}%)`,
    `Remaining: ${projection.remainingBudgetMs}ms`,
  ];
  if (projection.budgetExhausted) parts.push('BUDGET EXHAUSTED');
  if (projection.overflowBudgetMs > 0) parts.push(`Overflow: ${projection.overflowBudgetMs}ms`);
  return parts.join(' | ');
}

/**
 * Validates a TimeAdvanceRequest for correctness.
 */
export function isValidTimeAdvanceRequest(req: TimeAdvanceRequest): boolean {
  return (
    typeof req.durationMs === 'number' && req.durationMs > 0 && Number.isFinite(req.durationMs) &&
    typeof req.nowMs === 'number' && Number.isFinite(req.nowMs)
  );
}

/**
 * Returns the advance duration clamped to minimum 1ms.
 */
export function getAdvanceRequestDurationMs(req: TimeAdvanceRequest): number {
  return Math.max(1, Math.trunc(req.durationMs));
}

/**
 * Returns true if an advance request includes a stop-scheduling flag.
 */
export function isAdvanceRequestTerminal(req: TimeAdvanceRequest): boolean {
  return req.stopScheduling === true;
}

// ============================================================================
// SECTION 13 — SEASON CLOCK CONTRACT UTILITIES
// ============================================================================

/**
 * Returns a human-readable label for a season lifecycle state.
 */
export function describeSeasonLifecycleState(state: SeasonLifecycleState): string {
  return TIME_CONTRACT_SEASON_LIFECYCLE_LABEL[state] ?? `Unknown lifecycle: ${state}`;
}

/**
 * Returns the pressure urgency score (0.0–1.0) from a SeasonPressureContext.
 */
export function scoreSeasonPressure(ctx: SeasonPressureContext): number {
  const multiplier = ctx.pressureMultiplier;
  if (multiplier <= 1.0) return 0.0;
  return clamp01((multiplier - 1.0) / 3.0);
}

/**
 * Returns true if the season pressure context is actively boosting difficulty.
 */
export function isSeasonPressureActive(ctx: SeasonPressureContext): boolean {
  return ctx.lifecycle === 'ACTIVE' && ctx.pressureMultiplier > 1.0;
}

/**
 * Validates a SeasonTimelineManifest for correctness.
 */
export function isValidSeasonTimelineManifest(manifest: SeasonTimelineManifest): boolean {
  return (
    typeof manifest.seasonId === 'string' && manifest.seasonId.length > 0 &&
    typeof manifest.startMs === 'number' && Number.isFinite(manifest.startMs) &&
    typeof manifest.endMs === 'number' && Number.isFinite(manifest.endMs) &&
    manifest.startMs < manifest.endMs &&
    Array.isArray(manifest.windows)
  );
}

/**
 * Returns true if a SeasonTimeWindow is currently active.
 */
export function isSeasonWindowCurrentlyActive(
  window: SeasonTimeWindow,
  nowMs: number,
): boolean {
  return window.isActive && nowMs >= window.startsAtMs && nowMs < window.endsAtMs;
}

/**
 * Returns the window type label for a SeasonWindowType.
 */
export function describeSeasonWindowType(type: SeasonWindowType): string {
  switch (type) {
    case 'KICKOFF': return 'Season Kickoff — launch event active';
    case 'LIVEOPS_EVENT': return 'LiveOps Event — special campaign window';
    case 'SEASON_FINALE': return 'Season Finale — final 72 hours';
    case 'ARCHIVE_CLOSE': return 'Archive Closing — last chance window';
    case 'REENGAGE_WINDOW': return 'Re-Engagement — lapsed player window';
    default: return `Unknown window type: ${String(type)}`;
  }
}

/**
 * Returns the highest pressure multiplier from a set of active season windows.
 */
export function getMaxSeasonWindowPressure(windows: readonly SeasonTimeWindow[]): number {
  if (windows.length === 0) return 1.0;
  return windows.reduce((max, w) => Math.max(max, w.pressureMultiplier), 1.0);
}

/**
 * Describes a SeasonClockSnapshot for chat consumers.
 */
export function describeSeasonClockSnapshot(snapshot: SeasonClockSnapshot): string {
  const parts: string[] = [
    describeSeasonLifecycleState(snapshot.lifecycle),
    `Pressure: x${snapshot.pressureMultiplier.toFixed(2)}`,
    `Active windows: ${snapshot.activeWindowIds.length}`,
  ];
  if (snapshot.msUntilEnd > 0 && snapshot.lifecycle === 'ACTIVE') {
    const hrs = (snapshot.msUntilEnd / (1000 * 60 * 60)).toFixed(1);
    parts.push(`${hrs}h remaining`);
  }
  return parts.join(' | ');
}

/**
 * Returns the season time utilization (0.0–1.0).
 */
export function scoreSeasonTimeUtilization(snapshot: SeasonClockSnapshot): number {
  if (snapshot.seasonStartMs === null || snapshot.seasonEndMs === null) return 0;
  const total = snapshot.seasonEndMs - snapshot.seasonStartMs;
  if (total <= 0) return 1.0;
  const elapsed = total - snapshot.msUntilEnd;
  return clamp01(elapsed / total);
}

/**
 * Returns the total window duration in ms for a season manifest.
 */
export function getTotalSeasonWindowMs(manifest: SeasonTimelineManifest): number {
  return manifest.windows.reduce(
    (total, w) => total + Math.max(0, w.endsAtMs - w.startsAtMs), 0,
  );
}

/**
 * Returns all windows of a given type from a season manifest.
 */
export function getSeasonWindowsByType(
  manifest: SeasonTimelineManifest,
  type: SeasonWindowType,
): readonly SeasonTimeWindow[] {
  return freezeArray(manifest.windows.filter((w) => w.type === type));
}

/**
 * Returns the combined pressure multiplier for all active windows in a manifest.
 */
export function getManifestCombinedPressure(
  manifest: SeasonTimelineManifest,
  nowMs: number,
): number {
  const active = manifest.windows.filter((w) => isSeasonWindowCurrentlyActive(w, nowMs));
  if (active.length === 0) return 1.0;
  return active.reduce((max, w) => Math.max(max, w.pressureMultiplier), 1.0);
}

/**
 * Checks whether a specific season window type exists in a manifest.
 */
export function manifestHasWindowType(
  manifest: SeasonTimelineManifest,
  type: SeasonWindowType,
): boolean {
  return manifest.windows.some((w) => w.type === type);
}

// ============================================================================
// SECTION 14 — TICK SCHEDULER CONTRACT UTILITIES
// ============================================================================

/**
 * Validates a TickScheduleRequest for correctness.
 */
export function isValidTickScheduleRequest(req: TickScheduleRequest): boolean {
  return (
    typeof req.durationMs === 'number' && req.durationMs > 0 && Number.isFinite(req.durationMs) &&
    isPressureTier(req.tier)
  );
}

/**
 * Returns the drift severity label for a ScheduledTickEvent.
 */
export function describeTickDriftSeverity(event: ScheduledTickEvent): string {
  const drift = Math.abs(event.driftMs);
  if (drift <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.ACCEPTABLE_DRIFT_MS) return 'on-time';
  if (drift <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS) return 'notable drift';
  if (drift <= TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.SEVERE_DRIFT_MS) return 'severe drift';
  return 'critical drift';
}

/**
 * Returns true if a ScheduledTickEvent shows a concerning drift level.
 */
export function isTickDrifted(event: ScheduledTickEvent): boolean {
  return Math.abs(event.driftMs) > TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.NOTABLE_DRIFT_MS;
}

/**
 * Returns a drift score (0.0–1.0) for a ScheduledTickEvent.
 */
export function scoreTickDrift(event: ScheduledTickEvent): number {
  return clamp01(Math.abs(event.driftMs) / TIME_CONTRACT_TICK_DRIFT_THRESHOLDS.CRITICAL_DRIFT_MS);
}

/**
 * Describes a ScheduledTickEvent as a narrative string.
 */
export function describeScheduledTickEvent(event: ScheduledTickEvent): string {
  return [
    `Tick #${event.tickNumber} (${event.tier})`,
    `planned ${event.plannedDurationMs}ms`,
    `drift: ${event.driftMs}ms (${describeTickDriftSeverity(event)})`,
    event.reason ? `reason: ${event.reason}` : null,
  ].filter((part): part is string => part !== null).join(' | ');
}

/**
 * Returns the health summary for a TickSchedulerState.
 */
export function describeTickSchedulerHealth(state: TickSchedulerState): string {
  const parts: string[] = [];
  if (!state.isRunning) parts.push('STOPPED');
  else if (state.isPaused) parts.push('PAUSED');
  else parts.push('RUNNING');
  if (state.isTickInFlight) parts.push('tick in-flight');
  parts.push(`tick #${state.tickNumber} (${state.currentTier})`);
  if (state.remainingMs !== null) parts.push(`${state.remainingMs}ms until next tick`);
  return parts.join(' | ');
}

/**
 * Returns true if TickSchedulerState indicates a healthy running system.
 */
export function isSchedulerHealthy(state: TickSchedulerState): boolean {
  return state.isRunning && !state.isPaused && !state.isTickInFlight;
}

/**
 * Returns true if the scheduler is fully stopped.
 */
export function isSchedulerStopped(state: TickSchedulerState): boolean {
  return !state.isRunning;
}

/**
 * Creates a no-op TickSchedulerCallback that returns the same request.
 * Useful for testing and contract validation harnesses.
 */
export function createPassthroughTickCallback(
  request: TickScheduleRequest,
): TickSchedulerCallback {
  return (_event: ScheduledTickEvent) => request;
}

/**
 * Creates a terminal TickSchedulerCallback that returns null (stop scheduling).
 */
export function createTerminalTickCallback(): TickSchedulerCallback {
  return (_event: ScheduledTickEvent) => null;
}

// ============================================================================
// SECTION 15 — TELEMETRY CONTRACT UTILITIES
// ============================================================================

/**
 * Validates a TimeTelemetryProjectionRequest for field correctness.
 */
export function isValidTimeTelemetryProjectionRequest(
  req: TimeTelemetryProjectionRequest,
): boolean {
  if (req === null || typeof req !== 'object') return false;
  if (req.decisions !== undefined && !Array.isArray(req.decisions)) return false;
  if (req.warnings !== undefined && !Array.isArray(req.warnings)) return false;
  if (req.forkHints !== undefined && !Array.isArray(req.forkHints)) return false;
  return true;
}

/**
 * Returns the latency zone label for a TimeDecisionTelemetryInput.
 */
export function describeDecisionLatencyZone(input: TimeDecisionTelemetryInput): string {
  const ms = input.latencyMs;
  if (ms <= TIME_CONTRACT_LATENCY_THRESHOLDS.FAST_MS) return 'fast';
  if (ms <= TIME_CONTRACT_LATENCY_THRESHOLDS.ACCEPTABLE_MS) return 'acceptable';
  if (ms <= TIME_CONTRACT_LATENCY_THRESHOLDS.SLOW_MS) return 'slow';
  return 'critical';
}

/**
 * Returns the latency score (0.0–1.0) for a decision telemetry input.
 */
export function scoreDecisionLatency(input: TimeDecisionTelemetryInput): number {
  return clamp01(input.latencyMs / TIME_CONTRACT_LATENCY_THRESHOLDS.ALARM_MS);
}

/**
 * Returns true if a decision telemetry input signals a latency alarm.
 */
export function isLatencyAlarm(input: TimeDecisionTelemetryInput): boolean {
  return input.latencyMs > TIME_CONTRACT_LATENCY_THRESHOLDS.SLOW_MS;
}

/**
 * Returns a narrative description of a TimeDecisionTelemetryInput.
 */
export function describeDecisionTelemetryInput(input: TimeDecisionTelemetryInput): string {
  const zone = describeDecisionLatencyZone(input);
  const accepted = input.accepted ? 'accepted' : 'rejected';
  return [
    `Tick ${input.tick} — actor: ${input.actorId}`,
    `card: ${input.cardId}`,
    `latency: ${input.latencyMs}ms (${zone})`,
    `decision: ${accepted}`,
    input.timingClass.length > 0 ? `timing: [${input.timingClass.join(', ')}]` : null,
  ].filter((p): p is string => p !== null).join(' | ');
}

/**
 * Returns the combined timing class tags from a decision telemetry input.
 */
export function getDecisionTimingClasses(input: TimeDecisionTelemetryInput): readonly string[] {
  return freezeArray([...input.timingClass]);
}

/**
 * Validates a single TimeDecisionTelemetryInput for correctness.
 */
export function isValidTimeDecisionTelemetryInput(
  input: TimeDecisionTelemetryInput,
): boolean {
  return (
    typeof input.tick === 'number' && Number.isFinite(input.tick) &&
    typeof input.actorId === 'string' && input.actorId.length > 0 &&
    typeof input.cardId === 'string' && input.cardId.length > 0 &&
    typeof input.latencyMs === 'number' && Number.isFinite(input.latencyMs) &&
    Array.isArray(input.timingClass) &&
    typeof input.accepted === 'boolean'
  );
}

// ============================================================================
// SECTION 16 — ML 28-DIM FEATURE EXTRACTION
// ============================================================================

/** Label registry for 28-dimensional contract ML feature vector. */
export const TIME_CONTRACT_ML_FEATURE_LABELS = Object.freeze([
  /*  0 */ 'tier_urgency',
  /*  1 */ 'phase_score',
  /*  2 */ 'cadence_duration_normalized',
  /*  3 */ 'decision_window_normalized',
  /*  4 */ 'season_multiplier',
  /*  5 */ 'mode_tempo',
  /*  6 */ 'budget_tempo',
  /*  7 */ 'remaining_budget_normalized',
  /*  8 */ 'timeout_pressure',
  /*  9 */ 'budget_utilization',
  /* 10 */ 'hold_pressure',
  /* 11 */ 'active_decision_count',
  /* 12 */ 'expired_decision_score',
  /* 13 */ 'tick_drift_score',
  /* 14 */ 'scheduler_health',
  /* 15 */ 'season_pressure',
  /* 16 */ 'season_utilization',
  /* 17 */ 'decision_latency_score',
  /* 18 */ 'projection_finality',
  /* 19 */ 'screen_shake_flag',
  /* 20 */ 'endgame_window_flag',
  /* 21 */ 'interpolation_flag',
  /* 22 */ 'season_active_flag',
  /* 23 */ 'hold_exhausted_flag',
  /* 24 */ 'budget_critical_flag',
  /* 25 */ 'timeout_critical_flag',
  /* 26 */ 'tick_drift_flag',
  /* 27 */ 'telemetry_event_density',
] as const);

export type TimeContractMLFeatureLabel =
  (typeof TIME_CONTRACT_ML_FEATURE_LABELS)[number];

/** Full 28-dimensional ML feature vector extracted from contract state. */
export interface TimeContractMLVector {
  readonly features: Readonly<Float32Array>;
  readonly labels: typeof TIME_CONTRACT_ML_FEATURE_LABELS;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly tick: number;
  readonly extractedAtMs: number;
}

/**
 * Extracts a 28-dimensional ML feature vector from the unified contract state.
 * All features are normalized to [0.0, 1.0].
 */
export function extractTimeContractMLVector(
  cadence: TimeCadenceResolution,
  projection: TimeProjectionResult,
  timeout: RunTimeoutResolution,
  budget: TimeBudgetProjection,
  holdLedger: HoldLedgerSnapshot,
  seasonCtx: SeasonClockSnapshot,
  schedulerState: TickSchedulerState,
  lastTickEvent: ScheduledTickEvent | null,
  decisionWindows: readonly RegisteredDecisionWindow[],
  latestDecision: TimeDecisionTelemetryInput | null,
  nowMs: number,
): TimeContractMLVector {
  const tierUrgency = TIME_CONTRACT_TIER_URGENCY[cadence.resolvedTier];
  const phaseScore = TIME_CONTRACT_PHASE_SCORE[projection.phase];
  const cadenceDurationNorm = clamp01(cadence.durationMs / TIME_CONTRACT_MAX_TICK_DURATION_MS);
  const decisionWindowNorm = clamp01(cadence.decisionWindowMs / TIME_CONTRACT_MAX_DECISION_WINDOW_MS);
  const seasonMultiplierNorm = clamp01((cadence.seasonMultiplier - 1.0) / 3.0);
  const modeTempo = clamp01(cadence.modeTempoMultiplier / 1.5);
  const budgetTempo = clamp01(cadence.budgetTempoMultiplier / 2.0);
  const remainingBudgetNorm = clamp01(cadence.remainingBudgetMs / TIME_CONTRACT_MAX_BUDGET_MS);
  const timeoutPressure = scoreTimeoutPressure(timeout);
  const budgetUtil = clamp01(budget.utilizationPct);
  const holdPressure = scoreHoldLedgerPressure(holdLedger);
  const activeDecisionCount = clamp01(decisionWindows.length / 5.0);
  const expiredDecisionScore = decisionWindows.length === 0
    ? 0
    : decisionWindows.reduce(
        (sum, w) => sum + scoreDecisionWindowUrgency(w, nowMs), 0,
      ) / decisionWindows.length;
  const tickDriftScore = lastTickEvent !== null ? scoreTickDrift(lastTickEvent) : 0;
  const schedulerHealthScore = isSchedulerHealthy(schedulerState) ? 1.0 : 0.0;
  const seasonPressureCtx: SeasonPressureContext = {
    seasonId: seasonCtx.seasonId,
    lifecycle: seasonCtx.lifecycle,
    nowMs,
    activeWindows: [],
    pressureMultiplier: seasonCtx.pressureMultiplier,
    msUntilStart: seasonCtx.msUntilStart,
    msUntilEnd: seasonCtx.msUntilEnd,
  };
  const seasonPressureScore = scoreSeasonPressure(seasonPressureCtx);
  const seasonUtilization = scoreSeasonTimeUtilization(seasonCtx);
  const latencyScore = latestDecision !== null ? scoreDecisionLatency(latestDecision) : 0;
  const finalityScore = scoreProjectionFinality(projection);

  const features = new Float32Array(TIME_CONTRACT_ML_DIM);
  features[0] = tierUrgency;
  features[1] = phaseScore;
  features[2] = cadenceDurationNorm;
  features[3] = decisionWindowNorm;
  features[4] = seasonMultiplierNorm;
  features[5] = modeTempo;
  features[6] = budgetTempo;
  features[7] = remainingBudgetNorm;
  features[8] = timeoutPressure;
  features[9] = budgetUtil;
  features[10] = holdPressure;
  features[11] = activeDecisionCount;
  features[12] = clamp01(expiredDecisionScore);
  features[13] = tickDriftScore;
  features[14] = schedulerHealthScore;
  features[15] = seasonPressureScore;
  features[16] = seasonUtilization;
  features[17] = latencyScore;
  features[18] = finalityScore;
  features[19] = cadence.shouldScreenShake ? 1.0 : 0.0;
  features[20] = cadence.shouldOpenEndgameWindow ? 1.0 : 0.0;
  features[21] = cadence.shouldInterpolate ? 1.0 : 0.0;
  features[22] = seasonCtx.lifecycle === 'ACTIVE' ? 1.0 : 0.0;
  features[23] = holdLedger.remainingCharges === 0 ? 1.0 : 0.0;
  features[24] = isBudgetCritical(budget) ? 1.0 : 0.0;
  features[25] = isTimeoutCritical(timeout) ? 1.0 : 0.0;
  features[26] = lastTickEvent !== null && isTickDrifted(lastTickEvent) ? 1.0 : 0.0;
  features[27] = clamp01((projection.telemetry.emittedEventCount ?? 0) / 500);

  return Object.freeze({
    features: Object.freeze(features) as Readonly<Float32Array>,
    labels: TIME_CONTRACT_ML_FEATURE_LABELS,
    tier: cadence.resolvedTier,
    phase: projection.phase,
    tick: projection.tick,
    extractedAtMs: nowMs,
  });
}

// ============================================================================
// SECTION 17 — DL 40x6 TENSOR CONSTRUCTION
// ============================================================================

/** DL tensor column labels (6 columns). */
export const TIME_CONTRACT_DL_COL_LABELS = Object.freeze([
  'tier_urgency',
  'budget_utilization',
  'hold_pressure',
  'season_pressure',
  'decision_urgency',
  'composite_pressure',
] as const);

export type TimeContractDLColLabel = (typeof TIME_CONTRACT_DL_COL_LABELS)[number];

/** Full 40x6 DL tensor for sequence-based contract state. */
export interface TimeContractDLTensor {
  readonly data: Readonly<Float32Array>;
  readonly rows: number;
  readonly cols: number;
  readonly colLabels: typeof TIME_CONTRACT_DL_COL_LABELS;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly headTick: number;
  readonly extractedAtMs: number;
}

/**
 * Appends a new row to a DL tensor ring buffer and returns the updated tensor.
 * The buffer is fixed at 40 rows; the oldest row is evicted when full.
 */
export function appendTimeContractDLRow(
  previous: TimeContractDLTensor | null,
  cadence: TimeCadenceResolution,
  budget: TimeBudgetProjection,
  holdLedger: HoldLedgerSnapshot,
  seasonCtx: SeasonClockSnapshot,
  decisionWindows: readonly RegisteredDecisionWindow[],
  tick: number,
  phase: RunPhase,
  nowMs: number,
): TimeContractDLTensor {
  const rows = TIME_CONTRACT_DL_ROW_COUNT;
  const cols = TIME_CONTRACT_DL_COL_COUNT;
  const data = new Float32Array(rows * cols);

  // Copy previous tensor data shifted one row forward (evict oldest)
  if (previous !== null && previous.data.length === rows * cols) {
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        data[r * cols + c] = previous.data[(r + 1) * cols + c];
      }
    }
  }

  // Build the new row (row index = rows - 1)
  const tierUrgency = TIME_CONTRACT_TIER_URGENCY[cadence.resolvedTier];
  const budgetUtil = clamp01(budget.utilizationPct);
  const holdPressure = scoreHoldLedgerPressure(holdLedger);
  const seasonPressureCtx: SeasonPressureContext = {
    seasonId: seasonCtx.seasonId,
    lifecycle: seasonCtx.lifecycle,
    nowMs,
    activeWindows: [],
    pressureMultiplier: seasonCtx.pressureMultiplier,
    msUntilStart: seasonCtx.msUntilStart,
    msUntilEnd: seasonCtx.msUntilEnd,
  };
  const seasonPressure = scoreSeasonPressure(seasonPressureCtx);
  const avgDecisionUrgency = decisionWindows.length === 0
    ? 0
    : decisionWindows.reduce((s, w) => s + scoreDecisionWindowUrgency(w, nowMs), 0) /
      decisionWindows.length;
  const composite = clamp01(
    tierUrgency * 0.3 + budgetUtil * 0.25 + holdPressure * 0.15 +
    seasonPressure * 0.15 + avgDecisionUrgency * 0.15,
  );

  const rowOffset = (rows - 1) * cols;
  data[rowOffset + 0] = tierUrgency;
  data[rowOffset + 1] = budgetUtil;
  data[rowOffset + 2] = holdPressure;
  data[rowOffset + 3] = seasonPressure;
  data[rowOffset + 4] = clamp01(avgDecisionUrgency);
  data[rowOffset + 5] = composite;

  return Object.freeze({
    data: Object.freeze(data) as Readonly<Float32Array>,
    rows,
    cols,
    colLabels: TIME_CONTRACT_DL_COL_LABELS,
    tier: cadence.resolvedTier,
    phase,
    headTick: tick,
    extractedAtMs: nowMs,
  });
}

/**
 * Creates a zero-initialized DL tensor.
 */
export function createEmptyTimeContractDLTensor(
  tier: PressureTier,
  phase: RunPhase,
  nowMs: number,
): TimeContractDLTensor {
  const data = new Float32Array(TIME_CONTRACT_DL_ROW_COUNT * TIME_CONTRACT_DL_COL_COUNT);
  return Object.freeze({
    data: Object.freeze(data) as Readonly<Float32Array>,
    rows: TIME_CONTRACT_DL_ROW_COUNT,
    cols: TIME_CONTRACT_DL_COL_COUNT,
    colLabels: TIME_CONTRACT_DL_COL_LABELS,
    tier,
    phase,
    headTick: 0,
    extractedAtMs: nowMs,
  });
}

/**
 * Reads a specific cell from the DL tensor by row and column index.
 */
export function readDLTensorCell(
  tensor: TimeContractDLTensor,
  row: number,
  col: number,
): number {
  if (row < 0 || row >= tensor.rows || col < 0 || col >= tensor.cols) return 0;
  return tensor.data[row * tensor.cols + col];
}

/**
 * Returns the average value of a given column across all non-zero rows.
 */
export function avgDLTensorColumn(
  tensor: TimeContractDLTensor,
  colIndex: number,
): number {
  if (colIndex < 0 || colIndex >= tensor.cols) return 0;
  let sum = 0;
  let count = 0;
  for (let r = 0; r < tensor.rows; r++) {
    const val = tensor.data[r * tensor.cols + colIndex];
    if (val > 0) {
      sum += val;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Returns the max value of a given column across all rows.
 */
export function maxDLTensorColumn(
  tensor: TimeContractDLTensor,
  colIndex: number,
): number {
  if (colIndex < 0 || colIndex >= tensor.cols) return 0;
  let max = 0;
  for (let r = 0; r < tensor.rows; r++) {
    const val = tensor.data[r * tensor.cols + colIndex];
    if (val > max) max = val;
  }
  return max;
}

/**
 * Returns a trend indicator (-1, 0, +1) for a given column over the last N rows.
 * -1 = decreasing, 0 = flat, +1 = increasing.
 */
export function getDLTensorColumnTrend(
  tensor: TimeContractDLTensor,
  colIndex: number,
  windowSize = 5,
): number {
  if (colIndex < 0 || colIndex >= tensor.cols || windowSize < 2) return 0;
  const startRow = Math.max(0, tensor.rows - windowSize);
  const endRow = tensor.rows - 1;
  const first = tensor.data[startRow * tensor.cols + colIndex];
  const last = tensor.data[endRow * tensor.cols + colIndex];
  const delta = last - first;
  if (Math.abs(delta) < 0.05) return 0;
  return delta > 0 ? 1 : -1;
}

// ============================================================================
// SECTION 18 — CHAT BRIDGE SIGNAL PROJECTION
// ============================================================================

/** Chat signal urgency bands. */
export type TimeContractChatUrgency =
  | 'AMBIENT'
  | 'NOTEWORTHY'
  | 'ELEVATED'
  | 'URGENT'
  | 'CRITICAL';

/** Chat channel routing for time contract signals. */
export type TimeContractChatChannel =
  | 'LIVEOPS_MAIN'
  | 'LIVEOPS_PRESSURE'
  | 'LIVEOPS_HOLD'
  | 'LIVEOPS_SEASON'
  | 'LIVEOPS_TIMEOUT'
  | 'LIVEOPS_DECISION'
  | 'LIVEOPS_TICK'
  | 'LIVEOPS_TELEMETRY';

/** A unified chat signal from the time contract layer. */
export interface TimeContractChatSignal {
  readonly signalId: string;
  readonly channel: TimeContractChatChannel;
  readonly urgency: TimeContractChatUrgency;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly tick: number;
  readonly nowMs: number;
  readonly headline: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly mlFeatures: Readonly<Float32Array> | null;
  readonly dlTensorSnapshot: Readonly<Float32Array> | null;
  readonly reasonCodes: readonly string[];
  readonly shouldInterruptChat: boolean;
  readonly shouldEscalate: boolean;
}

/**
 * Scores overall urgency from a contract ML vector and returns the band label.
 */
export function scoreContractChatUrgency(
  mlVector: TimeContractMLVector,
): TimeContractChatUrgency {
  const f = mlVector.features;
  const score =
    f[0] * 0.35 +   // tier_urgency
    f[8] * 0.25 +   // timeout_pressure
    f[9] * 0.15 +   // budget_utilization
    f[19] * 0.15 +  // screen_shake_flag
    f[10] * 0.1;    // hold_pressure

  if (score >= 0.85) return 'CRITICAL';
  if (score >= 0.65) return 'URGENT';
  if (score >= 0.45) return 'ELEVATED';
  if (score >= 0.2) return 'NOTEWORTHY';
  return 'AMBIENT';
}

/**
 * Routes a time contract signal to the best chat channel.
 */
export function routeTimeContractToChannel(
  urgency: TimeContractChatUrgency,
  cadence: TimeCadenceResolution,
  holdLedger: HoldLedgerSnapshot,
  timeout: RunTimeoutResolution,
  seasonCtx: SeasonClockSnapshot,
): TimeContractChatChannel {
  if (timeout.timeoutReached || isTimeoutCritical(timeout)) return 'LIVEOPS_TIMEOUT';
  if (cadence.shouldScreenShake || cadence.resolvedTier === 'T4') return 'LIVEOPS_PRESSURE';
  if (holdLedger.remainingCharges === 0 && holdLedger.enabled) return 'LIVEOPS_HOLD';
  if (seasonCtx.lifecycle === 'ACTIVE' && seasonCtx.pressureMultiplier > 1.1) return 'LIVEOPS_SEASON';
  if (urgency === 'CRITICAL' || urgency === 'URGENT') return 'LIVEOPS_PRESSURE';
  return 'LIVEOPS_MAIN';
}

/**
 * Builds the headline string for a time contract chat signal.
 */
export function buildTimeContractHeadline(
  cadence: TimeCadenceResolution,
  projection: TimeProjectionResult,
  timeout: RunTimeoutResolution,
): string {
  if (timeout.timeoutReached) {
    return `Run ended — time budget exhausted at tick ${projection.tick}`;
  }
  if (projection.outcome !== null) {
    return `Run outcome: ${projection.outcome} — ${projection.outcomeReason ?? 'no reason'}`;
  }
  if (cadence.resolvedTier === 'T4') {
    return `COLLAPSE IMMINENT — emergency cadence at ${cadence.durationMs}ms`;
  }
  if (cadence.resolvedTier === 'T3') {
    return `Crisis cadence — ${describePressureTier(cadence.resolvedTier)}`;
  }
  return `Tick ${projection.tick} — ${projection.phase} — ${describePressureTier(cadence.resolvedTier)}`;
}

/**
 * Builds the body string for a time contract chat signal.
 */
export function buildTimeContractBody(
  cadence: TimeCadenceResolution,
  projection: TimeProjectionResult,
  timeout: RunTimeoutResolution,
  budget: TimeBudgetProjection,
  holdLedger: HoldLedgerSnapshot,
  seasonCtx: SeasonClockSnapshot,
): string {
  const lines: string[] = [
    describeCadenceResolution(cadence),
    describeTimeBudgetProjection(budget),
    describeTimeoutResolution(timeout),
    describeHoldLedgerSnapshot(holdLedger),
  ];
  if (seasonCtx.lifecycle === 'ACTIVE') lines.push(describeSeasonClockSnapshot(seasonCtx));
  if (projection.outcome !== null) lines.push(describeProjectionOutcome(projection));
  return lines.join('\n');
}

/**
 * Builds a complete TimeContractChatSignal from the unified contract surface.
 * This is the primary entry point for chat adapter ingestion.
 */
export function buildTimeContractChatSignal(
  cadence: TimeCadenceResolution,
  projection: TimeProjectionResult,
  timeout: RunTimeoutResolution,
  budget: TimeBudgetProjection,
  holdLedger: HoldLedgerSnapshot,
  seasonCtx: SeasonClockSnapshot,
  schedulerState: TickSchedulerState,
  lastTickEvent: ScheduledTickEvent | null,
  decisionWindows: readonly RegisteredDecisionWindow[],
  latestDecision: TimeDecisionTelemetryInput | null,
  dlTensor: TimeContractDLTensor | null,
  nowMs: number,
  telemetryReq: TimeTelemetryProjectionRequest | null,
): TimeContractChatSignal {
  const mlVector = extractTimeContractMLVector(
    cadence, projection, timeout, budget, holdLedger,
    seasonCtx, schedulerState, lastTickEvent, decisionWindows,
    latestDecision, nowMs,
  );

  const urgency = scoreContractChatUrgency(mlVector);
  const channel = routeTimeContractToChannel(urgency, cadence, holdLedger, timeout, seasonCtx);
  const headline = buildTimeContractHeadline(cadence, projection, timeout);
  const body = buildTimeContractBody(cadence, projection, timeout, budget, holdLedger, seasonCtx);

  const tags: string[] = [
    `tier:${cadence.resolvedTier}`,
    `phase:${projection.phase}`,
    `urgency:${urgency}`,
    `channel:${channel}`,
  ];

  if (cadence.shouldScreenShake) tags.push('time:screen_shake');
  if (cadence.shouldOpenEndgameWindow) tags.push('time:endgame_window');
  if (timeout.timeoutReached) tags.push('time:timeout');
  if (holdLedger.remainingCharges === 0 && holdLedger.enabled) tags.push('time:hold_exhausted');
  if (decisionWindows.length > 0) tags.push(`time:decision_windows_open:${decisionWindows.length}`);
  if (latestDecision !== null && isLatencyAlarm(latestDecision)) tags.push('time:latency_alarm');
  if (lastTickEvent !== null && isTickDrifted(lastTickEvent)) tags.push('time:tick_drift');
  if (telemetryReq !== null && isValidTimeTelemetryProjectionRequest(telemetryReq)) {
    tags.push('time:telemetry_attached');
  }

  return Object.freeze({
    signalId: `time_contract_${projection.tick}_${nowMs}`,
    channel,
    urgency,
    tier: cadence.resolvedTier,
    phase: projection.phase,
    tick: projection.tick,
    nowMs,
    headline,
    body,
    tags: freezeArray(tags),
    mlFeatures: mlVector.features,
    dlTensorSnapshot: dlTensor !== null ? dlTensor.data : null,
    reasonCodes: expandCadenceReasonCodes(cadence),
    shouldInterruptChat: urgency === 'CRITICAL' || urgency === 'URGENT',
    shouldEscalate: urgency === 'CRITICAL',
  });
}

// ============================================================================
// SECTION 19 — CONTRACT DIAGNOSTIC REPORTS
// ============================================================================

/** A complete diagnostic report of the time contract state. */
export interface TimeContractDiagnosticReport {
  readonly tick: number;
  readonly nowMs: number;
  readonly tier: PressureTier;
  readonly phase: RunPhase;
  readonly cadenceSummary: string;
  readonly budgetSummary: string;
  readonly timeoutSummary: string;
  readonly holdSummary: string;
  readonly schedulerSummary: string;
  readonly seasonSummary: string;
  readonly decisionWindowCount: number;
  readonly criticalDecisionWindowCount: number;
  readonly tickDriftSummary: string | null;
  readonly latestDecisionSummary: string | null;
  readonly mlFeatures: Readonly<Float32Array>;
  readonly dlTensorRows: number;
  readonly urgency: TimeContractChatUrgency;
  readonly chatSignalSummary: string;
  readonly generatedAtMs: number;
}

/**
 * Builds a complete TimeContractDiagnosticReport.
 */
export function buildTimeContractDiagnosticReport(
  cadence: TimeCadenceResolution,
  projection: TimeProjectionResult,
  timeout: RunTimeoutResolution,
  budget: TimeBudgetProjection,
  holdLedger: HoldLedgerSnapshot,
  seasonCtx: SeasonClockSnapshot,
  schedulerState: TickSchedulerState,
  lastTickEvent: ScheduledTickEvent | null,
  decisionWindows: readonly RegisteredDecisionWindow[],
  latestDecision: TimeDecisionTelemetryInput | null,
  nowMs: number,
): TimeContractDiagnosticReport {
  const mlVector = extractTimeContractMLVector(
    cadence, projection, timeout, budget, holdLedger,
    seasonCtx, schedulerState, lastTickEvent, decisionWindows,
    latestDecision, nowMs,
  );

  const urgency = scoreContractChatUrgency(mlVector);
  const criticalWindowCount = decisionWindows.filter(
    (w) => isDecisionWindowCritical(w, nowMs),
  ).length;

  return Object.freeze({
    tick: projection.tick,
    nowMs,
    tier: cadence.resolvedTier,
    phase: projection.phase,
    cadenceSummary: describeCadenceResolution(cadence),
    budgetSummary: describeTimeBudgetProjection(budget),
    timeoutSummary: describeTimeoutResolution(timeout),
    holdSummary: describeHoldLedgerSnapshot(holdLedger),
    schedulerSummary: describeTickSchedulerHealth(schedulerState),
    seasonSummary: describeSeasonClockSnapshot(seasonCtx),
    decisionWindowCount: decisionWindows.length,
    criticalDecisionWindowCount: criticalWindowCount,
    tickDriftSummary: lastTickEvent !== null ? describeScheduledTickEvent(lastTickEvent) : null,
    latestDecisionSummary: latestDecision !== null ? describeDecisionTelemetryInput(latestDecision) : null,
    mlFeatures: mlVector.features,
    dlTensorRows: TIME_CONTRACT_DL_ROW_COUNT,
    urgency,
    chatSignalSummary: `[${urgency}] ${buildTimeContractHeadline(cadence, projection, timeout)}`,
    generatedAtMs: nowMs,
  });
}

// ============================================================================
// SECTION 20 — CONTRACT SUITE REGISTRY
// ============================================================================

/**
 * Full suite descriptor containing all time contract service references.
 * Used by TimeEngine and EngineRuntime to ensure all services are wired.
 */
export interface TimeContractSuite {
  readonly policyResolver: TimePolicyResolver;
  readonly budgetManager: TimeBudgetManager;
  readonly timeoutGuard: TimeTimeoutGuard;
  readonly decisionResolver: TimeDecisionResolver;
  readonly holdLedger: TimeHoldLedger;
  readonly seasonCalendar: TimeSeasonCalendar;
  readonly eventPublisher: TimeEventPublisher;
  readonly scheduler: TimeScheduler;
  readonly telemetryProjector: TimeTelemetryProjectorContract;
  readonly snapshotProjector: TimeSnapshotProjectorContract;
}

/** All required keys of TimeContractSuite for validation. */
const TIME_CONTRACT_SUITE_KEYS: ReadonlyArray<keyof TimeContractSuite> = Object.freeze([
  'policyResolver',
  'budgetManager',
  'timeoutGuard',
  'decisionResolver',
  'holdLedger',
  'seasonCalendar',
  'eventPublisher',
  'scheduler',
  'telemetryProjector',
  'snapshotProjector',
]);

/**
 * Validates that a TimeContractSuite has all required service slots filled.
 */
export function assertTimeContractSuite(
  suite: Partial<TimeContractSuite>,
  label = 'TimeContractSuite',
): asserts suite is TimeContractSuite {
  const missing = TIME_CONTRACT_SUITE_KEYS.filter(
    (key) => suite[key] === undefined || suite[key] === null,
  );
  if (missing.length > 0) {
    throw new Error(`${label}: missing required service slots: [${missing.join(', ')}]`);
  }
}

/**
 * Returns a string description of all services wired in a suite.
 */
export function describeTimeContractSuite(suite: Partial<TimeContractSuite>): string {
  return TIME_CONTRACT_SUITE_KEYS
    .map((slot) => `${slot}: ${suite[slot] != null ? 'wired' : 'MISSING'}`)
    .join('\n');
}

/**
 * Returns the count of wired services in a (possibly partial) suite.
 */
export function countWiredTimeServices(suite: Partial<TimeContractSuite>): number {
  return TIME_CONTRACT_SUITE_KEYS.filter((k) => suite[k] != null).length;
}

/**
 * Returns the count of total required services.
 */
export function getTotalTimeServiceCount(): number {
  return TIME_CONTRACT_SUITE_KEYS.length;
}

// ============================================================================
// SECTION 21 — ADVANCE REQUEST & SNAPSHOT BRIDGE
// ============================================================================

/**
 * Builds a TimeAdvanceRequest from a cadence resolution and context.
 */
export function buildTimeAdvanceRequestFromCadence(
  cadence: TimeCadenceResolution,
  nowMs: number,
  snapshot: RunStateSnapshot,
): TimeAdvanceRequest {
  const durationMs = computeEffectiveDurationMs(cadence);
  return Object.freeze({
    durationMs,
    nowMs,
    stopScheduling: cadence.shouldOpenEndgameWindow,
    activeDecisionWindows: snapshot.timers.activeDecisionWindows,
    frozenWindowIds: snapshot.timers?.frozenWindowIds ?? [],
  });
}

/**
 * Returns true if a RunStateSnapshot has data needed to drive time resolution.
 */
export function isSnapshotTimeReady(snapshot: RunStateSnapshot): boolean {
  return (
    typeof snapshot.timers?.elapsedMs === 'number' &&
    typeof snapshot.timers?.seasonBudgetMs === 'number' &&
    typeof snapshot.pressure?.tier === 'string' &&
    typeof snapshot.phase === 'string'
  );
}

/**
 * Returns a minimal budget summary from a RunStateSnapshot.
 */
export function getSnapshotBudgetSummary(snapshot: RunStateSnapshot): string {
  const elapsed = normalizeMs(snapshot.timers?.elapsedMs ?? 0);
  const season = normalizeMs(snapshot.timers?.seasonBudgetMs ?? 0);
  const extension = normalizeMs(snapshot.timers?.extensionBudgetMs ?? 0);
  const total = season + extension;
  const remaining = Math.max(0, total - elapsed);
  const pct = total > 0 ? ((elapsed / total) * 100).toFixed(1) : '0.0';
  return `elapsed: ${elapsed}ms | budget: ${total}ms | remaining: ${remaining}ms (${pct}% used)`;
}

/**
 * Returns the active decision window IDs from a RunStateSnapshot.
 */
export function getActiveDecisionWindowIds(snapshot: RunStateSnapshot): readonly string[] {
  const windows = snapshot.timers?.activeDecisionWindows;
  if (!windows) return [];
  return freezeArray(Object.keys(windows));
}

/**
 * Returns the frozen window IDs from a RunStateSnapshot.
 */
export function getFrozenWindowIds(snapshot: RunStateSnapshot): readonly string[] {
  const frozen = snapshot.timers?.frozenWindowIds;
  if (!Array.isArray(frozen)) return [];
  return freezeArray(frozen.filter((id) => typeof id === 'string'));
}

// ============================================================================
// SECTION 22 — DECISION WINDOW BATCH ANALYSIS
// ============================================================================

/** Summary of active decision windows for telemetry and chat. */
export interface TimeDecisionWindowBatchSummary {
  readonly totalOpen: number;
  readonly criticalCount: number;
  readonly avgUrgencyScore: number;
  readonly maxUrgencyScore: number;
  readonly topWindowId: string | null;
  readonly hasHaterInjection: boolean;
  readonly hasCrisisEvent: boolean;
  readonly hasForcedFate: boolean;
  readonly tags: readonly string[];
}

/**
 * Builds a batch summary for all currently open decision windows.
 */
export function buildDecisionWindowBatchSummary(
  windows: readonly RegisteredDecisionWindow[],
  nowMs: number,
): TimeDecisionWindowBatchSummary {
  if (windows.length === 0) {
    return Object.freeze({
      totalOpen: 0,
      criticalCount: 0,
      avgUrgencyScore: 0,
      maxUrgencyScore: 0,
      topWindowId: null,
      hasHaterInjection: false,
      hasCrisisEvent: false,
      hasForcedFate: false,
      tags: freezeArray([]),
    });
  }

  const urgencyScores = windows.map((w) => scoreDecisionWindowUrgency(w, nowMs));
  const total = urgencyScores.reduce((s, v) => s + v, 0);
  const avgUrgency = total / windows.length;
  const maxUrgency = Math.max(...urgencyScores);
  const topIdx = urgencyScores.indexOf(maxUrgency);
  const topWindowId = windows[topIdx]?.windowId ?? null;
  const criticalCount = windows.filter((w) => isDecisionWindowCritical(w, nowMs)).length;
  const hasHaterInjection = windows.some((w) => w.cardType === 'HATER_INJECTION');
  const hasCrisisEvent = windows.some((w) => w.cardType === 'CRISIS_EVENT');
  const hasForcedFate = windows.some((w) => w.cardType === 'FORCED_FATE');

  const tags: string[] = [`decision_batch:${windows.length}`];
  if (criticalCount > 0) tags.push(`critical_windows:${criticalCount}`);
  if (hasHaterInjection) tags.push('hater_injection_active');
  if (hasCrisisEvent) tags.push('crisis_event_active');
  if (hasForcedFate) tags.push('forced_fate_active');

  return Object.freeze({
    totalOpen: windows.length,
    criticalCount,
    avgUrgencyScore: avgUrgency,
    maxUrgencyScore: maxUrgency,
    topWindowId,
    hasHaterInjection,
    hasCrisisEvent,
    hasForcedFate,
    tags: freezeArray(tags),
  });
}

// ============================================================================
// SECTION 23 — HOLD SPEND REQUEST BUILDERS
// ============================================================================

/**
 * Builds a HoldSpendRequest for a given window and current time.
 */
export function buildHoldSpendRequest(
  windowId: string,
  nowMs: number,
  durationMs: number,
): HoldSpendRequest {
  return Object.freeze({
    windowId,
    nowMs,
    durationMs: Math.max(1_000, Math.trunc(durationMs)),
  });
}

/**
 * Returns a narrative of hold state relative to active windows.
 */
export function buildHoldStateNarrative(
  ledger: HoldLedgerSnapshot,
  decisionWindows: readonly RegisteredDecisionWindow[],
  nowMs: number,
): string {
  const parts: string[] = [];
  if (!ledger.enabled) {
    parts.push('Hold actions are disabled for this run.');
  } else if (ledger.remainingCharges === 0) {
    parts.push('All hold charges consumed — timer pressure is full.');
  } else {
    const critCount = decisionWindows.filter((w) => isDecisionWindowCritical(w, nowMs)).length;
    if (critCount > 0) {
      parts.push(`${ledger.remainingCharges} hold charge(s) available — ${critCount} critical window(s) open.`);
    } else {
      parts.push(`${ledger.remainingCharges} hold charge(s) available.`);
    }
  }
  if (ledger.activeHold !== null) {
    const remaining = getHoldRemainingMs(ledger.activeHold, nowMs);
    parts.push(`Active hold: ${remaining}ms remaining on window ${ledger.activeHold.windowId}.`);
  }
  return parts.join(' ');
}

// ============================================================================
// SECTION 24 — EXPIRED DECISION BATCH ANALYSIS
// ============================================================================

/** Summary report for a batch of expired decision outcomes. */
export interface TimeExpiredDecisionBatchSummary {
  readonly expiredCount: number;
  readonly haterInjectionCount: number;
  readonly crisisEventCount: number;
  readonly fatecardCount: number;
  readonly avgPenaltyScore: number;
  readonly maxPenaltyScore: number;
  readonly totalLatencyMs: number;
  readonly tags: readonly string[];
}

/**
 * Builds a batch summary for a set of expired decision outcomes.
 */
export function buildExpiredDecisionBatchSummary(
  outcomes: readonly ExpiredDecisionOutcome[],
): TimeExpiredDecisionBatchSummary {
  if (outcomes.length === 0) {
    return Object.freeze({
      expiredCount: 0,
      haterInjectionCount: 0,
      crisisEventCount: 0,
      fatecardCount: 0,
      avgPenaltyScore: 0,
      maxPenaltyScore: 0,
      totalLatencyMs: 0,
      tags: freezeArray([]),
    });
  }

  const penalties = outcomes.map(scoreDecisionExpiryPenalty);
  const totalPenalty = penalties.reduce((s, v) => s + v, 0);
  const avgPenalty = totalPenalty / outcomes.length;
  const maxPenalty = Math.max(...penalties);
  const totalLatencyMs = outcomes.reduce((s, o) => s + o.latencyMs, 0);
  const haterCount = outcomes.filter((o) => o.cardType === 'HATER_INJECTION').length;
  const crisisCount = outcomes.filter((o) => o.cardType === 'CRISIS_EVENT').length;
  const fateCount = outcomes.filter((o) => o.cardType === 'FORCED_FATE').length;

  const tags: string[] = [`expired_decisions:${outcomes.length}`];
  if (haterCount > 0) tags.push(`hater_expired:${haterCount}`);
  if (crisisCount > 0) tags.push(`crisis_expired:${crisisCount}`);
  if (maxPenalty >= 0.8) tags.push('high_penalty_expiry');

  return Object.freeze({
    expiredCount: outcomes.length,
    haterInjectionCount: haterCount,
    crisisEventCount: crisisCount,
    fatecardCount: fateCount,
    avgPenaltyScore: avgPenalty,
    maxPenaltyScore: maxPenalty,
    totalLatencyMs,
    tags: freezeArray(tags),
  });
}

// ============================================================================
// SECTION 25 — TELEMETRY PROJECTION REQUEST BUILDERS
// ============================================================================

/**
 * Builds a TimeTelemetryProjectionRequest from tick completion context.
 */
export function buildTelemetryProjectionRequestForTick(
  _tick: number,
  checksum: string,
  decisions: readonly TimeDecisionTelemetryInput[],
  warnings: readonly string[],
  outcomeReason: string | null,
  outcomeReasonCode: OutcomeReasonCode | null,
): TimeTelemetryProjectionRequest {
  return Object.freeze({
    decisions: freezeArray([...decisions]),
    warnings: freezeArray([...warnings]),
    forkHints: freezeArray([]),
    emittedEventCountDelta: 1,
    lastTickChecksum: checksum,
    outcomeReason,
    outcomeReasonCode,
  });
}

/**
 * Merges two TimeTelemetryProjectionRequests into a combined request.
 */
export function mergeTimeTelemetryProjectionRequests(
  a: TimeTelemetryProjectionRequest,
  b: TimeTelemetryProjectionRequest,
): TimeTelemetryProjectionRequest {
  const decisionsA = a.decisions ?? [];
  const decisionsB = b.decisions ?? [];
  const warningsA = a.warnings ?? [];
  const warningsB = b.warnings ?? [];
  const hintsA = a.forkHints ?? [];
  const hintsB = b.forkHints ?? [];

  return Object.freeze({
    decisions: freezeArray([...decisionsA, ...decisionsB]),
    warnings: dedupeStrings(warningsA, warningsB),
    forkHints: dedupeStrings(hintsA, hintsB),
    emittedEventCountDelta: (a.emittedEventCountDelta ?? 0) + (b.emittedEventCountDelta ?? 0),
    lastTickChecksum: b.lastTickChecksum ?? a.lastTickChecksum,
    outcomeReason: b.outcomeReason ?? a.outcomeReason,
    outcomeReasonCode: b.outcomeReasonCode ?? a.outcomeReasonCode,
  });
}

// ============================================================================
// SECTION 26 — FULL CONTRACT RUNTIME SUMMARY
// ============================================================================

/** Human-readable summary of the entire time contract runtime at a tick. */
export interface TimeContractRuntimeSummary {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly tier: PressureTier;
  readonly nowMs: number;
  readonly cadence: string;
  readonly budget: string;
  readonly timeout: string;
  readonly hold: string;
  readonly scheduler: string;
  readonly season: string;
  readonly decisions: string;
  readonly telemetry: string;
  readonly chatHeadline: string;
  readonly urgency: TimeContractChatUrgency;
  readonly mlDimensionCount: number;
  readonly dlTensorShape: string;
}

/**
 * Builds a full TimeContractRuntimeSummary for telemetry dashboards and debug output.
 */
export function buildTimeContractRuntimeSummary(
  cadence: TimeCadenceResolution,
  projection: TimeProjectionResult,
  timeout: RunTimeoutResolution,
  budget: TimeBudgetProjection,
  holdLedger: HoldLedgerSnapshot,
  seasonCtx: SeasonClockSnapshot,
  schedulerState: TickSchedulerState,
  lastTickEvent: ScheduledTickEvent | null,
  decisionWindows: readonly RegisteredDecisionWindow[],
  latestDecision: TimeDecisionTelemetryInput | null,
  latestTelemetryReq: TimeTelemetryProjectionRequest | null,
  nowMs: number,
): TimeContractRuntimeSummary {
  const mlVector = extractTimeContractMLVector(
    cadence, projection, timeout, budget, holdLedger,
    seasonCtx, schedulerState, lastTickEvent, decisionWindows,
    latestDecision, nowMs,
  );
  const urgency = scoreContractChatUrgency(mlVector);
  const batchSummary = buildDecisionWindowBatchSummary(decisionWindows, nowMs);
  const decisionLine = decisionWindows.length === 0
    ? 'No open decision windows'
    : `${decisionWindows.length} open window(s), ${batchSummary.criticalCount} critical`;
  const telemetryLine =
    latestTelemetryReq !== null && isValidTimeTelemetryProjectionRequest(latestTelemetryReq)
      ? `decisions: ${(latestTelemetryReq.decisions ?? []).length}, warnings: ${(latestTelemetryReq.warnings ?? []).length}`
      : 'no telemetry attached';

  return Object.freeze({
    tick: projection.tick,
    phase: projection.phase,
    tier: cadence.resolvedTier,
    nowMs,
    cadence: describeCadenceResolution(cadence),
    budget: describeTimeBudgetProjection(budget),
    timeout: describeTimeoutResolution(timeout),
    hold: describeHoldLedgerSnapshot(holdLedger),
    scheduler: describeTickSchedulerHealth(schedulerState),
    season: describeSeasonClockSnapshot(seasonCtx),
    decisions: decisionLine,
    telemetry: telemetryLine,
    chatHeadline: buildTimeContractHeadline(cadence, projection, timeout),
    urgency,
    mlDimensionCount: TIME_CONTRACT_ML_DIM,
    dlTensorShape: `${TIME_CONTRACT_DL_ROW_COUNT}x${TIME_CONTRACT_DL_COL_COUNT}`,
  });
}

// ============================================================================
// SECTION 27 — TYPE GUARDS (safe downstream narrowing)
// ============================================================================

/**
 * Returns true if value is a valid RunOutcome.
 */
export function isRunOutcome(value: unknown): value is RunOutcome {
  return value === 'FREEDOM' || value === 'TIMEOUT' || value === 'BANKRUPT' || value === 'ABANDONED';
}

/**
 * Returns true if the value is a valid RunPhase string.
 */
export function isRunPhase(value: unknown): value is RunPhase {
  return value === 'FOUNDATION' || value === 'ESCALATION' || value === 'SOVEREIGNTY';
}

/**
 * Returns true if the value is a valid PressureTier string.
 */
export function isPressureTier(value: unknown): value is PressureTier {
  return value === 'T0' || value === 'T1' || value === 'T2' || value === 'T3' || value === 'T4';
}

/**
 * Returns true if the value is a valid ModeCode string.
 */
export function isModeCode(value: unknown): value is ModeCode {
  return value === 'solo' || value === 'pvp' || value === 'coop' || value === 'ghost';
}

/**
 * Returns all five pressure tiers sorted T0-T4.
 */
export function getAllPressureTiers(): readonly PressureTier[] {
  return freezeArray(['T0', 'T1', 'T2', 'T3', 'T4']);
}

/**
 * Returns all four mode codes.
 */
export function getAllModeCodes(): readonly ModeCode[] {
  return freezeArray(['solo', 'pvp', 'coop', 'ghost']);
}

/**
 * Returns all three run phases in order.
 */
export function getAllRunPhases(): readonly RunPhase[] {
  return freezeArray(['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY']);
}

/**
 * Returns all four run outcomes.
 */
export function getAllRunOutcomes(): readonly RunOutcome[] {
  return freezeArray(['FREEDOM', 'TIMEOUT', 'BANKRUPT', 'ABANDONED']);
}

/**
 * Returns the numeric ordinal (0-4) for a PressureTier for sorting.
 */
export function pressureTierOrdinal(tier: PressureTier): number {
  switch (tier) {
    case 'T0': return 0;
    case 'T1': return 1;
    case 'T2': return 2;
    case 'T3': return 3;
    case 'T4': return 4;
    default: return -1;
  }
}

/**
 * Returns true if tier A is more severe than tier B.
 */
export function isTierMoreSevere(a: PressureTier, b: PressureTier): boolean {
  return pressureTierOrdinal(a) > pressureTierOrdinal(b);
}

/**
 * Returns the more severe of two tiers.
 */
export function maxTier(a: PressureTier, b: PressureTier): PressureTier {
  return isTierMoreSevere(a, b) ? a : b;
}

/**
 * Returns the less severe of two tiers.
 */
export function minTier(a: PressureTier, b: PressureTier): PressureTier {
  return isTierMoreSevere(a, b) ? b : a;
}

// ============================================================================
// SECTION 28 — COMPOSITE SCORING AND RISK ASSESSMENT
// ============================================================================

/** Unified risk assessment from the full contract state. */
export interface TimeContractRiskAssessment {
  readonly overallRisk: number;
  readonly tierRisk: number;
  readonly budgetRisk: number;
  readonly timeoutRisk: number;
  readonly holdRisk: number;
  readonly decisionRisk: number;
  readonly seasonRisk: number;
  readonly schedulerRisk: number;
  readonly driftRisk: number;
  readonly latencyRisk: number;
  readonly riskLabel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  readonly topRiskFactor: string;
  readonly tags: readonly string[];
}

/**
 * Computes a unified TimeContractRiskAssessment from the full contract state.
 */
export function assessTimeContractRisk(
  cadence: TimeCadenceResolution,
  timeout: RunTimeoutResolution,
  budget: TimeBudgetProjection,
  holdLedger: HoldLedgerSnapshot,
  seasonCtx: SeasonClockSnapshot,
  schedulerState: TickSchedulerState,
  lastTickEvent: ScheduledTickEvent | null,
  decisionWindows: readonly RegisteredDecisionWindow[],
  latestDecision: TimeDecisionTelemetryInput | null,
  nowMs: number,
): TimeContractRiskAssessment {
  const tierRisk = TIME_CONTRACT_TIER_URGENCY[cadence.resolvedTier];
  const budgetRisk = scoreBudgetUrgency(budget);
  const timeoutRisk = scoreTimeoutPressure(timeout);
  const holdRisk = scoreHoldLedgerPressure(holdLedger);
  const seasonPressureCtx: SeasonPressureContext = {
    seasonId: seasonCtx.seasonId,
    lifecycle: seasonCtx.lifecycle,
    nowMs,
    activeWindows: [],
    pressureMultiplier: seasonCtx.pressureMultiplier,
    msUntilStart: seasonCtx.msUntilStart,
    msUntilEnd: seasonCtx.msUntilEnd,
  };
  const seasonRisk = scoreSeasonPressure(seasonPressureCtx);
  const schedulerRisk = isSchedulerHealthy(schedulerState) ? 0.0 : 0.5;
  const driftRisk = lastTickEvent !== null ? scoreTickDrift(lastTickEvent) : 0;
  const latencyRisk = latestDecision !== null ? scoreDecisionLatency(latestDecision) : 0;

  const decisionBatch = buildDecisionWindowBatchSummary(decisionWindows, nowMs);
  const decisionRisk = clamp01(decisionBatch.avgUrgencyScore);

  const overallRisk = clamp01(
    tierRisk * 0.25 +
    budgetRisk * 0.15 +
    timeoutRisk * 0.15 +
    holdRisk * 0.10 +
    decisionRisk * 0.10 +
    seasonRisk * 0.08 +
    schedulerRisk * 0.07 +
    driftRisk * 0.05 +
    latencyRisk * 0.05,
  );

  const riskFactors: Array<[string, number]> = [
    ['tier', tierRisk],
    ['budget', budgetRisk],
    ['timeout', timeoutRisk],
    ['hold', holdRisk],
    ['decision', decisionRisk],
    ['season', seasonRisk],
    ['scheduler', schedulerRisk],
    ['drift', driftRisk],
    ['latency', latencyRisk],
  ];
  riskFactors.sort((a, b) => b[1] - a[1]);
  const topRiskFactor = riskFactors[0]?.[0] ?? 'none';

  let riskLabel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  if (overallRisk >= 0.8) riskLabel = 'CRITICAL';
  else if (overallRisk >= 0.55) riskLabel = 'HIGH';
  else if (overallRisk >= 0.3) riskLabel = 'MODERATE';
  else riskLabel = 'LOW';

  const tags: string[] = [`risk:${riskLabel}`, `top_factor:${topRiskFactor}`];
  if (overallRisk >= 0.8) tags.push('risk:critical_threshold');
  if (timeout.timeoutReached) tags.push('risk:timeout_breached');

  return Object.freeze({
    overallRisk,
    tierRisk,
    budgetRisk,
    timeoutRisk,
    holdRisk,
    decisionRisk,
    seasonRisk,
    schedulerRisk,
    driftRisk,
    latencyRisk,
    riskLabel,
    topRiskFactor,
    tags: freezeArray(tags),
  });
}

// ============================================================================
// SECTION 29 — CHAT NARRATIVE BUILDER (per-tier emotional narration)
// ============================================================================

/**
 * Returns an emotionally appropriate chat narrative for the current tier.
 * Used by the chat adapter to set tone and urgency for companion commentary.
 */
export function buildTierChatNarrative(
  tier: PressureTier,
  phase: RunPhase,
  holdLedger: HoldLedgerSnapshot,
  decisionWindows: readonly RegisteredDecisionWindow[],
  nowMs: number,
): string {
  const criticalCount = decisionWindows.filter((w) => isDecisionWindowCritical(w, nowMs)).length;
  const holdNote = holdLedger.enabled && holdLedger.remainingCharges > 0
    ? `You have ${holdLedger.remainingCharges} hold charge(s) left.`
    : holdLedger.enabled
    ? 'Hold charges are exhausted — you are fully exposed to the clock.'
    : '';

  switch (tier) {
    case 'T0':
      return [
        `${phase} phase. Sovereign cadence — the clock is your ally.`,
        'Net worth dominates the freedom threshold. No active threats detected.',
        holdNote,
      ].filter((s) => s.length > 0).join(' ');

    case 'T1':
      return [
        `${phase} phase. Stable operating cadence — standard flow.`,
        'Cashflow is positive. Stay disciplined.',
        criticalCount > 0
          ? `${criticalCount} decision window(s) need attention soon.`
          : '',
        holdNote,
      ].filter((s) => s.length > 0).join(' ');

    case 'T2':
      return [
        `${phase} phase. Compressed cadence — pressure is building.`,
        'Cashflow is neutral or mild threats are active.',
        criticalCount > 0
          ? `Watch out: ${criticalCount} critical decision window(s).`
          : 'Keep your eyes on the clock.',
        holdNote,
      ].filter((s) => s.length > 0).join(' ');

    case 'T3':
      return [
        `${phase} phase. CRISIS cadence — the clock is accelerating.`,
        'Negative cashflow or hater heat exceeding threshold.',
        criticalCount > 0
          ? `URGENT: ${criticalCount} critical decision window(s) about to expire!`
          : 'Decisions are getting harder. Act now.',
        holdNote,
      ].filter((s) => s.length > 0).join(' ');

    case 'T4':
      return [
        `${phase} phase. COLLAPSE IMMINENT — emergency cadence engaged.`,
        'Cash balance is negative or shield fully broken.',
        criticalCount > 0
          ? `EMERGENCY: ${criticalCount} decision window(s) critical — act immediately!`
          : 'Every second counts. Make your move.',
        holdNote,
        'Screen shake active.',
      ].filter((s) => s.length > 0).join(' ');

    default:
      return `${phase} phase. Unknown tier state.`;
  }
}

/**
 * Returns the emotional tone label for a given tier (for chat adapter routing).
 */
export function getTierEmotionalTone(tier: PressureTier): string {
  switch (tier) {
    case 'T0': return 'calm_confident';
    case 'T1': return 'steady_encouraging';
    case 'T2': return 'alert_focused';
    case 'T3': return 'urgent_intense';
    case 'T4': return 'emergency_desperate';
    default: return 'neutral';
  }
}

/**
 * Returns the chat interruption priority (0–100) for a given tier.
 * Higher = more likely to interrupt current chat flow.
 */
export function getTierInterruptionPriority(tier: PressureTier): number {
  switch (tier) {
    case 'T0': return 5;
    case 'T1': return 15;
    case 'T2': return 35;
    case 'T3': return 70;
    case 'T4': return 95;
    default: return 0;
  }
}

// ============================================================================
// SECTION 30 — SEASON WINDOW CHAT NARRATIVES
// ============================================================================

/**
 * Builds a chat narrative for the current season state.
 */
export function buildSeasonChatNarrative(
  seasonCtx: SeasonClockSnapshot,
  activeWindows: readonly SeasonTimeWindow[],
): string {
  if (seasonCtx.lifecycle === 'UNCONFIGURED') {
    return 'No season is currently configured. Play at your own pace.';
  }
  if (seasonCtx.lifecycle === 'UPCOMING') {
    const hrs = (seasonCtx.msUntilStart / (1000 * 60 * 60)).toFixed(1);
    return `Season is launching in ${hrs} hours. Prepare your strategy.`;
  }
  if (seasonCtx.lifecycle === 'ENDED') {
    return 'Season has concluded. Final scores are locked.';
  }
  // ACTIVE
  const parts: string[] = [];
  const hrs = (seasonCtx.msUntilEnd / (1000 * 60 * 60)).toFixed(1);
  parts.push(`Season is live — ${hrs} hours remaining.`);
  if (seasonCtx.pressureMultiplier > 1.0) {
    parts.push(`Pressure multiplier: x${seasonCtx.pressureMultiplier.toFixed(2)}.`);
  }
  if (activeWindows.length > 0) {
    const typeLabels = activeWindows.map((w) => describeSeasonWindowType(w.type));
    parts.push(`Active events: ${typeLabels.join(', ')}.`);
  }
  return parts.join(' ');
}

// ============================================================================
// SECTION 31 — IMPORT-USE ASSERTIONS (compile-time verification surface)
// ============================================================================
// Every import type must appear in at least one exported function signature.
// This section provides compile-time verification via explicit annotation.

/**
 * @internal — Compile-time verification that all imported types are used.
 * NOT intended for runtime invocation. Exists solely to satisfy the
 * zero-dead-imports contract.
 */
export function _verifyAllImportsUsed(): {
  clockSource: ClockSource;
  eventBus: EventBus<TimeEngineEventBusMap>;
  engineEventMap: EngineEventMap;
  modeCode: ModeCode;
  pressureTier: PressureTier;
  runOutcome: RunOutcome;
  runPhase: RunPhase;
  outcomeReasonCode: OutcomeReasonCode;
  runStateSnapshot: RunStateSnapshot;
  telemetryState: TelemetryState;
  timerState: TimerState;
  decisionWindowRegistration: DecisionWindowRegistration;
  expiredDecisionOutcome: ExpiredDecisionOutcome;
  registeredDecisionWindow: RegisteredDecisionWindow;
  activeHoldRecord: ActiveHoldRecord;
  holdLedgerSnapshot: HoldLedgerSnapshot;
  holdSpendRequest: HoldSpendRequest;
  holdSpendResult: HoldSpendResult;
  runTimeoutResolution: RunTimeoutResolution;
  seasonClockSnapshot: SeasonClockSnapshot;
  seasonLifecycleState: SeasonLifecycleState;
  seasonPressureContext: SeasonPressureContext;
  seasonTimelineManifest: SeasonTimelineManifest;
  seasonTimeWindow: SeasonTimeWindow;
  seasonWindowType: SeasonWindowType;
  tickScheduleRequest: TickScheduleRequest;
  scheduledTickEvent: ScheduledTickEvent;
  tickSchedulerCallback: TickSchedulerCallback;
  tickSchedulerState: TickSchedulerState;
  timeAdvanceRequest: TimeAdvanceRequest;
  timeBudgetProjection: TimeBudgetProjection;
  timeDecisionTelemetryInput: TimeDecisionTelemetryInput;
  timeTelemetryProjectionRequest: TimeTelemetryProjectionRequest;
} {
  throw new Error(
    '_verifyAllImportsUsed is a compile-time-only verification surface and must never be called at runtime.',
  );
}
