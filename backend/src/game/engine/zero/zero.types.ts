
/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/zero.types.ts
 *
 * Doctrine:
 * - zero owns orchestration contracts, not shared engine primitives
 * - additive expansion is preferred over breaking existing core contracts
 * - these types describe backend run control without duplicating core
 *   EventBus, TickSequence, EngineRegistry, or RunStateSnapshot ownership
 * - engine zero remains the control tower above backend/core
 * - all structures here are deterministic, serialization-safe, and replay-friendly
 *
 * Notes:
 * - this file intentionally binds to the live backend/core shape in the repo:
 *   - EngineId is lowercase ('time' | 'pressure' | ...)
 *   - ModeCode is ('solo' | 'pvp' | 'coop' | 'ghost')
 *   - EventEnvelope uses { sequence, event, payload, emittedAtTick?, tags? }
 *   - Tick law is the 13-step STEP_01_PREPARE → STEP_13_FLUSH chain
 * - zero.types.ts does not replace backend/core contracts; it composes them
 * - runtime helpers included here are orchestration-safe and side-effect free
 */

import type { EventEnvelope } from '../core/EventBus';
import type {
  EngineHealth,
  EngineId,
  EngineSignal,
  TickTrace,
} from '../core/EngineContracts';
import type {
  AttackCategory,
  AttackEvent,
  AttackTargetEntity,
  BotState,
  CardDefinition,
  CardInstance,
  CascadeChainInstance,
  EffectPayload,
  EngineEventMap,
  HaterBotId,
  IntegrityStatus,
  LegendMarker,
  ModeCode,
  PressureTier,
  RunOutcome,
  RunPhase,
  ShieldLayerId,
  ShieldLayerLabel,
  Targeting,
  ThreatEnvelope,
  TimingClass,
} from '../core/GamePrimitives';
import type {
  DecisionRecord,
  OutcomeReasonCode,
  RunStateSnapshot,
  RuntimeDecisionWindowSnapshot,
} from '../core/RunStateSnapshot';
import type {
  TickStep,
  TickStepDescriptor,
} from '../core/TickSequence';

// ────────────────────────────────────────────────────────────────────────────────
// lifecycle
// ────────────────────────────────────────────────────────────────────────────────

export type RunLifecycleState =
  | 'IDLE'
  | 'STARTING'
  | 'ACTIVE'
  | 'TICK_LOCKED'
  | 'ENDING'
  | 'ENDED';

export const ZERO_RUN_LIFECYCLE_STATES = Object.freeze([
  'IDLE',
  'STARTING',
  'ACTIVE',
  'TICK_LOCKED',
  'ENDING',
  'ENDED',
] as const satisfies readonly RunLifecycleState[]);

export type ActiveRunLifecycleState = Exclude<RunLifecycleState, 'IDLE' | 'ENDED'>;

export type TerminalLifecycleState = Extract<RunLifecycleState, 'ENDING' | 'ENDED'>;

export type NonTerminalLifecycleState = Exclude<RunLifecycleState, TerminalLifecycleState>;

export type RunLifecycleTransition =
  | 'BOOT'
  | 'START_REQUESTED'
  | 'START_COMPLETED'
  | 'LOCK_FOR_TICK'
  | 'UNLOCK_AFTER_TICK'
  | 'TERMINATION_REQUESTED'
  | 'TERMINATION_COMPLETED'
  | 'RESET';

export const ZERO_RUN_LIFECYCLE_TRANSITIONS = Object.freeze([
  'BOOT',
  'START_REQUESTED',
  'START_COMPLETED',
  'LOCK_FOR_TICK',
  'UNLOCK_AFTER_TICK',
  'TERMINATION_REQUESTED',
  'TERMINATION_COMPLETED',
  'RESET',
] as const satisfies readonly RunLifecycleTransition[]);

export interface RunLifecycleCheckpoint {
  readonly lifecycleState: RunLifecycleState;
  readonly changedAtMs: number;
  readonly tick: number | null;
  readonly note: string | null;
  readonly transition: RunLifecycleTransition;
}

export interface RunLifecycleHistory {
  readonly checkpoints: readonly RunLifecycleCheckpoint[];
  readonly lastTransitionAtMs: number | null;
  readonly transitionCount: number;
}

export interface RunLifecycleInvariant {
  readonly from: RunLifecycleState;
  readonly to: RunLifecycleState;
  readonly legal: boolean;
  readonly reason: string;
}

export const ZERO_LEGAL_LIFECYCLE_TRANSITIONS: Readonly<
  Record<RunLifecycleState, readonly RunLifecycleState[]>
> = Object.freeze({
  IDLE: Object.freeze(['STARTING'] as readonly RunLifecycleState[]),
  STARTING: Object.freeze(['ACTIVE', 'IDLE'] as readonly RunLifecycleState[]),
  ACTIVE: Object.freeze(['TICK_LOCKED', 'ENDING'] as readonly RunLifecycleState[]),
  TICK_LOCKED: Object.freeze(['ACTIVE', 'ENDING'] as readonly RunLifecycleState[]),
  ENDING: Object.freeze(['ENDED'] as readonly RunLifecycleState[]),
  ENDED: Object.freeze(['IDLE'] as readonly RunLifecycleState[]),
});

// ────────────────────────────────────────────────────────────────────────────────
// canonical step ownership + sequencing
// ────────────────────────────────────────────────────────────────────────────────

export type StepRuntimeOwner =
  | EngineId
  | 'system'
  | 'mode'
  | 'telemetry'
  | 'unknown';

export const ZERO_STEP_RUNTIME_OWNERS = Object.freeze([
  'time',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
  'system',
  'mode',
  'telemetry',
  'unknown',
] as const satisfies readonly StepRuntimeOwner[]);

export const ZERO_CANONICAL_TICK_SEQUENCE = Object.freeze([
  'STEP_01_PREPARE',
  'STEP_02_TIME',
  'STEP_03_PRESSURE',
  'STEP_04_TENSION',
  'STEP_05_BATTLE',
  'STEP_06_SHIELD',
  'STEP_07_CASCADE',
  'STEP_08_MODE_POST',
  'STEP_09_TELEMETRY',
  'STEP_10_SOVEREIGNTY_SNAPSHOT',
  'STEP_11_OUTCOME_GATE',
  'STEP_12_EVENT_SEAL',
  'STEP_13_FLUSH',
] as const satisfies readonly TickStep[]);

export const ZERO_TICK_STEP_DESCRIPTORS: Readonly<
  Record<TickStep, TickStepDescriptor>
> = Object.freeze({
  STEP_01_PREPARE: {
    step: 'STEP_01_PREPARE',
    ordinal: 1,
    phase: 'ORCHESTRATION',
    owner: 'system',
    mutatesState: true,
    description: 'Freeze inputs, normalize transient state, and establish trace context.',
  },
  STEP_02_TIME: {
    step: 'STEP_02_TIME',
    ordinal: 2,
    phase: 'ENGINE',
    owner: 'time',
    mutatesState: true,
    description: 'Advance authoritative time budget, cadence, and active decision windows.',
  },
  STEP_03_PRESSURE: {
    step: 'STEP_03_PRESSURE',
    ordinal: 3,
    phase: 'ENGINE',
    owner: 'pressure',
    mutatesState: true,
    description: 'Recompute pressure score, cadence tier, crossings, and escalation state.',
  },
  STEP_04_TENSION: {
    step: 'STEP_04_TENSION',
    ordinal: 4,
    phase: 'ENGINE',
    owner: 'tension',
    mutatesState: true,
    description: 'Refresh anticipation, visible threat envelopes, and pulse conditions.',
  },
  STEP_05_BATTLE: {
    step: 'STEP_05_BATTLE',
    ordinal: 5,
    phase: 'ENGINE',
    owner: 'battle',
    mutatesState: true,
    description: 'Resolve hostile bot posture, injected attacks, and extraction pressure.',
  },
  STEP_06_SHIELD: {
    step: 'STEP_06_SHIELD',
    ordinal: 6,
    phase: 'ENGINE',
    owner: 'shield',
    mutatesState: true,
    description: 'Apply damage, regen, breach accounting, and weakest-layer recomputation.',
  },
  STEP_07_CASCADE: {
    step: 'STEP_07_CASCADE',
    ordinal: 7,
    phase: 'ENGINE',
    owner: 'cascade',
    mutatesState: true,
    description: 'Progress positive and negative chains, spawn links, and mark breaks/completions.',
  },
  STEP_08_MODE_POST: {
    step: 'STEP_08_MODE_POST',
    ordinal: 8,
    phase: 'MODE',
    owner: 'mode',
    mutatesState: true,
    description: 'Apply mode-native reconciliation after core engine execution.',
  },
  STEP_09_TELEMETRY: {
    step: 'STEP_09_TELEMETRY',
    ordinal: 9,
    phase: 'OBSERVABILITY',
    owner: 'telemetry',
    mutatesState: true,
    description: 'Materialize decision telemetry, audit hints, and event-facing summaries.',
  },
  STEP_10_SOVEREIGNTY_SNAPSHOT: {
    step: 'STEP_10_SOVEREIGNTY_SNAPSHOT',
    ordinal: 10,
    phase: 'OBSERVABILITY',
    owner: 'sovereignty',
    mutatesState: true,
    description: 'Compute deterministic checksums, integrity status, and proof-facing snapshot data.',
  },
  STEP_11_OUTCOME_GATE: {
    step: 'STEP_11_OUTCOME_GATE',
    ordinal: 11,
    phase: 'FINALIZATION',
    owner: 'system',
    mutatesState: true,
    description: 'Evaluate terminal conditions, freedom targets, timeout, bankruptcy, and quarantine exits.',
  },
  STEP_12_EVENT_SEAL: {
    step: 'STEP_12_EVENT_SEAL',
    ordinal: 12,
    phase: 'FINALIZATION',
    owner: 'system',
    mutatesState: true,
    description: 'Seal tick outputs into canonical event order for proof and replay stability.',
  },
  STEP_13_FLUSH: {
    step: 'STEP_13_FLUSH',
    ordinal: 13,
    phase: 'FINALIZATION',
    owner: 'system',
    mutatesState: true,
    description: 'Flush pending buffers and finalize the tick boundary for the next cycle.',
  },
});

export interface TickPlanEntry {
  readonly step: TickStep;
  readonly descriptor: TickStepDescriptor;
  readonly enabled: boolean;
}

export interface TickPlanSnapshot {
  readonly entries: readonly TickPlanEntry[];
  readonly size: number;
}

export interface TickExecutionWindow {
  readonly fromStep: TickStep;
  readonly toStep: TickStep;
  readonly inclusive: boolean;
}

export interface TickRuntimeFence {
  readonly locked: boolean;
  readonly lockOwner: TickStep | 'RUN_START' | 'RUN_END' | null;
  readonly lockedAtMs: number | null;
  readonly reason: string | null;
}

export interface StepRuntimeContext {
  readonly step: TickStep;
  readonly descriptor: TickStepDescriptor;
  readonly nowMs: number;
  readonly trace: TickTrace;
  readonly preStepSnapshot: RunStateSnapshot;
}

// ────────────────────────────────────────────────────────────────────────────────
// start / resume / end
// ────────────────────────────────────────────────────────────────────────────────

export interface StartRunInput {
  readonly userId: string;
  readonly mode: ModeCode;
  readonly seed?: string;
  readonly communityHeatModifier?: number;
  readonly tags?: readonly string[];
  readonly requestedAtMs?: number;
}

export interface StartRunResolvedInput extends StartRunInput {
  readonly runId: string;
  readonly seed: string;
  readonly requestedAtMs: number;
}

export interface RunResumeInput {
  readonly snapshot: RunStateSnapshot;
  readonly resumedAtMs: number;
  readonly reason:
    | 'SERVER_RESTART'
    | 'PROCESS_RECOVERY'
    | 'MATCH_REJOIN'
    | 'ADMIN_REPLAY'
    | 'TEST_HARNESS';
}

export interface StartRunResult {
  readonly snapshot: RunStateSnapshot;
  readonly resolved: StartRunResolvedInput;
  readonly lifecycleState: RunLifecycleState;
  readonly warnings: readonly string[];
}

export interface EndRunInput {
  readonly outcome: RunOutcome;
  readonly endedAtMs?: number;
  readonly reasonCode?: OutcomeReasonCode | null;
  readonly note?: string | null;
}

export interface RunTerminationRecord {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly endedAtMs: number;
  readonly finalSnapshot: RunStateSnapshot;
  readonly reasonCode: OutcomeReasonCode | null;
  readonly note: string | null;
}

export interface RunResetDirective {
  readonly hard: boolean;
  readonly clearHistory: boolean;
  readonly clearEventQueue: boolean;
  readonly clearEventHistory: boolean;
  readonly clearDiagnostics: boolean;
  readonly clearLifecycleHistory: boolean;
}

export const ZERO_DEFAULT_RESET_DIRECTIVE: Readonly<RunResetDirective> = Object.freeze({
  hard: true,
  clearHistory: true,
  clearEventQueue: true,
  clearEventHistory: true,
  clearDiagnostics: true,
  clearLifecycleHistory: true,
});

// ────────────────────────────────────────────────────────────────────────────────
// card / mode action surfaces
// ────────────────────────────────────────────────────────────────────────────────

export interface PlayCardInput {
  readonly definitionId: string;
  readonly actorId: string;
  readonly targeting?: Targeting;
  readonly requestedAtMs?: number;
  readonly source:
    | 'HUMAN'
    | 'AUTO_RESOLVE'
    | 'BOT'
    | 'MODE'
    | 'CASCADE'
    | 'SYSTEM';
  readonly note?: string | null;
}

export interface PlayCardResolution {
  readonly accepted: boolean;
  readonly runId: string;
  readonly tick: number;
  readonly actorId: string;
  readonly targeting: Targeting;
  readonly cardDefinitionId: string;
  readonly cardInstanceId: string | null;
  readonly requestedAtMs: number;
  readonly resolvedAtMs: number;
  readonly warnings: readonly string[];
  readonly reason: string | null;
  readonly snapshot: RunStateSnapshot;
}

export type ZeroModeActionId =
  | 'SYNC_RUNTIME'
  | 'OPEN_PHASE_WINDOW'
  | 'LOCK_ROLE'
  | 'APPLY_HANDICAP'
  | 'APPLY_ADVANTAGE'
  | 'ADVANCE_DEFECTION'
  | 'TRIM_SHARED_OPPORTUNITY'
  | 'RESOLVE_SHARED_TREASURY'
  | 'REGISTER_LEGEND_MARKER'
  | 'TRIGGER_EXTRACTION'
  | 'CUSTOM';

export const ZERO_MODE_ACTION_IDS = Object.freeze([
  'SYNC_RUNTIME',
  'OPEN_PHASE_WINDOW',
  'LOCK_ROLE',
  'APPLY_HANDICAP',
  'APPLY_ADVANTAGE',
  'ADVANCE_DEFECTION',
  'TRIM_SHARED_OPPORTUNITY',
  'RESOLVE_SHARED_TREASURY',
  'REGISTER_LEGEND_MARKER',
  'TRIGGER_EXTRACTION',
  'CUSTOM',
] as const satisfies readonly ZeroModeActionId[]);

export interface ModeActionInput {
  readonly actionId: ZeroModeActionId | string;
  readonly actorId: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly requestedAtMs?: number;
  readonly reason?: string | null;
}

export interface ModeActionResolution {
  readonly accepted: boolean;
  readonly actionId: string;
  readonly actorId: string;
  readonly runId: string;
  readonly tick: number;
  readonly requestedAtMs: number;
  readonly resolvedAtMs: number;
  readonly warnings: readonly string[];
  readonly reason: string | null;
  readonly snapshot: RunStateSnapshot;
}

export interface ModeRuntimeEnvelope {
  readonly mode: ModeCode;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly actionId: string;
  readonly actorId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly reason: string | null;
  readonly emittedAtMs: number;
}

export interface ModeBootstrapOverlay {
  readonly mode: ModeCode;
  readonly sharedTreasury: boolean;
  readonly sharedOpportunityDeck: boolean;
  readonly holdEnabled: boolean;
  readonly legendMarkersEnabled: boolean;
  readonly counterIntelTier: number;
  readonly disabledBots: readonly HaterBotId[];
  readonly defaultTags: readonly string[];
}

// ────────────────────────────────────────────────────────────────────────────────
// event envelopes / queue seal / replay
// ────────────────────────────────────────────────────────────────────────────────

export interface EngineEventEnvelope<
  K extends keyof EngineEventMap = keyof EngineEventMap,
> extends EventEnvelope<K, EngineEventMap[K]> {}

export interface EngineEventSealSnapshot {
  readonly events: readonly EngineEventEnvelope[];
  readonly count: number;
  readonly sequences: readonly number[];
}

export interface EventSealResult {
  readonly checksum: string;
  readonly emittedEventCount: number;
  readonly emittedSequences: readonly number[];
}

export interface EventHistoryWindow {
  readonly fromSequence: number | null;
  readonly toSequence: number | null;
  readonly count: number;
}

export interface EventReplaySlice {
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly window: EventHistoryWindow;
  readonly entries: readonly EngineEventEnvelope[];
}

export interface EventEnvelopeSummary<
  K extends keyof EngineEventMap = keyof EngineEventMap,
> {
  readonly sequence: number;
  readonly event: K;
  readonly emittedAtTick: number | null;
  readonly tags: readonly string[];
}

export interface EventFamilySummary {
  readonly event: keyof EngineEventMap;
  readonly count: number;
  readonly firstSequence: number | null;
  readonly lastSequence: number | null;
}

export interface EventSealAudit {
  readonly runId: string;
  readonly tick: number;
  readonly checksum: string;
  readonly eventCount: number;
  readonly families: readonly EventFamilySummary[];
}

export type ZeroEventFamily =
  | 'RUN'
  | 'TICK'
  | 'PRESSURE'
  | 'TENSION'
  | 'BATTLE'
  | 'SHIELD'
  | 'CASCADE'
  | 'CARD'
  | 'MODE'
  | 'DECISION'
  | 'INTEGRITY'
  | 'PROOF'
  | 'SOVEREIGNTY'
  | 'UNKNOWN';

export const ZERO_EVENT_FAMILY_BY_EVENT: Readonly<
  Record<keyof EngineEventMap, ZeroEventFamily>
> = Object.freeze({
  'run.started': 'RUN',
  'tick.started': 'TICK',
  'tick.completed': 'TICK',
  'pressure.changed': 'PRESSURE',
  'tension.updated': 'TENSION',
  'threat.routed': 'TENSION',
  'battle.attack.injected': 'BATTLE',
  'battle.bot.state_changed': 'BATTLE',
  'shield.breached': 'SHIELD',
  'cascade.chain.created': 'CASCADE',
  'cascade.chain.progressed': 'CASCADE',
  'card.played': 'CARD',
  'mode.defection.progressed': 'MODE',
  'mode.phase_window.opened': 'MODE',
  'decision.window.opened': 'DECISION',
  'decision.window.closed': 'DECISION',
  'integrity.quarantined': 'INTEGRITY',
  'proof.sealed': 'PROOF',
  'sovereignty.completed': 'SOVEREIGNTY',
});

// ────────────────────────────────────────────────────────────────────────────────
// diagnostics
// ────────────────────────────────────────────────────────────────────────────────

export type TickStepErrorOwner =
  | EngineId
  | 'system'
  | 'mode'
  | 'telemetry'
  | 'unknown';

export interface TickStepErrorRecord {
  readonly step: TickStep;
  readonly engineId: TickStepErrorOwner;
  readonly message: string;
  readonly atMs: number;
  readonly fatal: boolean;
  readonly code?: string;
  readonly tags?: readonly string[];
}

export interface TickWarningRecord {
  readonly step: TickStep | 'RUN_START' | 'RUN_END' | 'RESET';
  readonly message: string;
  readonly atMs: number;
  readonly code?: string;
  readonly tags?: readonly string[];
}

export interface StepExecutionReport {
  readonly step: TickStep;
  readonly descriptor: TickStepDescriptor;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly emittedEventCount: number;
  readonly emittedSequences: readonly number[];
  readonly snapshotMutated: boolean;
  readonly outcomeAfterStep: RunOutcome | null;
  readonly errors: readonly TickStepErrorRecord[];
  readonly warnings: readonly TickWarningRecord[];
  readonly signals: readonly EngineSignal[];
}

export interface StepBoundarySnapshot {
  readonly step: TickStep;
  readonly beforeChecksum: string;
  readonly afterChecksum: string;
  readonly changed: boolean;
}

export interface TickExecutionSummary {
  readonly runId: string;
  readonly tick: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly stepCount: number;
  readonly steps: readonly StepExecutionReport[];
  readonly stepBoundaries: readonly StepBoundarySnapshot[];
  readonly preTickSnapshot: RunStateSnapshot;
  readonly postTickSnapshot: RunStateSnapshot;
  readonly outcome: RunOutcome | null;
  readonly outcomeReasonCode: OutcomeReasonCode | null;
  readonly eventCount: number;
  readonly eventSequences: readonly number[];
  readonly warnings: readonly string[];
  readonly signals: readonly EngineSignal[];
}

export interface TickHistoryWindow {
  readonly summaries: readonly TickExecutionSummary[];
  readonly retainedCount: number;
  readonly maxRetainedCount: number;
}

export interface SnapshotDiffField {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface SnapshotDiffReport {
  readonly changed: boolean;
  readonly fields: readonly SnapshotDiffField[];
  readonly beforeChecksum: string;
  readonly afterChecksum: string;
}

export interface SnapshotFingerprint {
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly outcome: RunOutcome | null;
  readonly checksum: string;
  readonly integrityStatus: IntegrityStatus;
  readonly eventCount: number;
}

export interface DecisionTelemetryProjection {
  readonly tick: number;
  readonly totalCount: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly averageLatencyMs: number;
  readonly cardIds: readonly string[];
  readonly timingClasses: readonly string[];
}

export interface BotRuntimeProjection {
  readonly activeBotIds: readonly HaterBotId[];
  readonly neutralizedBotIds: readonly HaterBotId[];
  readonly attackingBotIds: readonly HaterBotId[];
  readonly breachedTargetLayers: readonly ShieldLayerId[];
}

export interface ThreatProjection {
  readonly totalVisible: number;
  readonly bySource: Readonly<Record<string, number>>;
  readonly byTargetLayer: Readonly<Record<ShieldLayerId | 'DIRECT', number>>;
}

export interface CascadeProjection {
  readonly activeChainCount: number;
  readonly activePositiveChainCount: number;
  readonly activeNegativeChainCount: number;
  readonly brokenChains: number;
  readonly completedChains: number;
}

export interface IntegrityProjection {
  readonly status: IntegrityStatus;
  readonly proofHashPresent: boolean;
  readonly auditFlagCount: number;
  readonly proofBadgeCount: number;
  readonly tickChecksumCount: number;
}

// ────────────────────────────────────────────────────────────────────────────────
// health / state snapshots
// ────────────────────────────────────────────────────────────────────────────────

export interface OrchestratorStateSnapshot {
  readonly lifecycleState: RunLifecycleState;
  readonly runId: string | null;
  readonly userId: string | null;
  readonly seed: string | null;
  readonly freedomThreshold: number;
  readonly consecutiveTickErrorCount: number;
  readonly current: RunStateSnapshot | null;
}

export interface ZeroRequiredEngineDescriptor {
  readonly engineId: EngineId;
  readonly critical: boolean;
  readonly reason: string;
}

export const ZERO_REQUIRED_ENGINES = Object.freeze([
  {
    engineId: 'time',
    critical: true,
    reason: 'Owns authoritative season cadence, decision windows, and tick budget.',
  },
  {
    engineId: 'pressure',
    critical: true,
    reason: 'Owns semantic pressure score, band, and tier transitions.',
  },
  {
    engineId: 'tension',
    critical: true,
    reason: 'Owns threat anticipation, visibility envelopes, and pulse state.',
  },
  {
    engineId: 'shield',
    critical: true,
    reason: 'Owns layer integrity, breach accounting, and repair posture.',
  },
  {
    engineId: 'battle',
    critical: true,
    reason: 'Owns hostile bot posture, attack injection, and rivalry pressure.',
  },
  {
    engineId: 'cascade',
    critical: true,
    reason: 'Owns positive/negative chain progression and recovery breaks.',
  },
  {
    engineId: 'sovereignty',
    critical: true,
    reason: 'Owns proof-facing checksums, integrity status, CORD, and verified grade.',
  },
] as const satisfies readonly ZeroRequiredEngineDescriptor[]);

export interface ZeroDependencyBindingReport {
  readonly pressureReaderBound: boolean;
  readonly shieldReaderBound: boolean;
  readonly tensionReaderBound: boolean;
  readonly cascadeReaderBound: boolean;
  readonly notes: readonly string[];
}

export interface OrchestratorHealthReport {
  readonly lifecycleState: RunLifecycleState;
  readonly runId: string | null;
  readonly userId: string | null;
  readonly seed: string | null;
  readonly currentTick: number | null;
  readonly consecutiveTickErrorCount: number;
  readonly engines: readonly EngineHealth[];
  readonly lastTickSummary: TickExecutionSummary | null;
  readonly lastErrors: readonly TickStepErrorRecord[];
  readonly dependencyBindings: ZeroDependencyBindingReport;
  readonly lifecycleHistory: RunLifecycleHistory;
}

export interface OrchestratorTelemetryRecord {
  readonly runId: string;
  readonly tick: number;
  readonly lifecycleState: RunLifecycleState;
  readonly step: TickStep | 'RUN_START' | 'RUN_END';
  readonly emittedEventCount: number;
  readonly durationMs: number;
  readonly warnings: readonly TickWarningRecord[];
  readonly errors: readonly TickStepErrorRecord[];
}

export interface OrchestratorTelemetryWindow {
  readonly records: readonly OrchestratorTelemetryRecord[];
  readonly retainedCount: number;
}

export interface OrchestratorQuarantineState {
  readonly active: boolean;
  readonly sinceTick: number | null;
  readonly reasons: readonly string[];
  readonly triggeredBy: TickStep | 'RUN_START' | 'RUN_END' | null;
}

// ────────────────────────────────────────────────────────────────────────────────
// outcome gate
// ────────────────────────────────────────────────────────────────────────────────

export type OutcomeGateReason =
  | 'TARGET_REACHED'
  | 'NET_WORTH_COLLAPSE'
  | 'SEASON_TIMEOUT'
  | 'USER_ABANDON'
  | 'ENGINE_ABORT'
  | 'INTEGRITY_QUARANTINE'
  | 'UNCHANGED';

export interface OutcomeGateResolution {
  readonly nextOutcome: RunOutcome | null;
  readonly reason: OutcomeGateReason;
}

export interface TerminalPriorityRule {
  readonly outcome: RunOutcome;
  readonly ordinal: number;
  readonly description: string;
}

export const ZERO_TERMINAL_PRIORITY = Object.freeze([
  {
    outcome: 'FREEDOM',
    ordinal: 1,
    description: 'Freedom target wins over every negative terminal condition in the same tick.',
  },
  {
    outcome: 'BANKRUPT',
    ordinal: 2,
    description: 'Bankruptcy defeats timeout when freedom was not reached.',
  },
  {
    outcome: 'TIMEOUT',
    ordinal: 3,
    description: 'Timeout resolves only when freedom and bankruptcy are absent.',
  },
  {
    outcome: 'ABANDONED',
    ordinal: 4,
    description: 'Abandon is an explicit forced terminal state, not a normal outcome gate race.',
  },
] as const satisfies readonly TerminalPriorityRule[]);

export type OutcomeGateCondition =
  | 'HAS_REACHED_TARGET'
  | 'HAS_COLLAPSED_NET_WORTH'
  | 'HAS_EXHAUSTED_SEASON_BUDGET'
  | 'HAS_USER_ABANDONED'
  | 'HAS_ENGINE_ABORTED'
  | 'HAS_ENTERED_INTEGRITY_QUARANTINE';

export interface OutcomeGateEvaluation {
  readonly condition: OutcomeGateCondition;
  readonly satisfied: boolean;
  readonly note: string;
}

export interface OutcomeGateAudit {
  readonly runId: string;
  readonly tick: number;
  readonly evaluations: readonly OutcomeGateEvaluation[];
  readonly resolution: OutcomeGateResolution;
}

// ────────────────────────────────────────────────────────────────────────────────
// snapshot-focused orchestration projections
// ────────────────────────────────────────────────────────────────────────────────

export interface ZeroDecisionWindowProjection {
  readonly ids: readonly string[];
  readonly activeCount: number;
  readonly frozenCount: number;
  readonly consumedCount: number;
  readonly actorIds: readonly string[];
  readonly sourceLabels: readonly string[];
}

export interface ZeroShieldProjection {
  readonly weakestLayerId: ShieldLayerId;
  readonly weakestLayerLabel: ShieldLayerLabel;
  readonly weakestLayerRatio: number;
  readonly breachedLayerIds: readonly ShieldLayerId[];
  readonly totalCurrent: number;
  readonly totalMax: number;
  readonly normalizedIntegrity: number;
}

export interface ZeroPressureProjection {
  readonly score: number;
  readonly tier: PressureTier;
  readonly upwardCrossings: number;
  readonly survivedHighPressureTicks: number;
  readonly maxScoreSeen: number;
  readonly trend:
    | 'RELIEVING'
    | 'FLAT'
    | 'RISING'
    | 'SPIKING';
}

export interface ZeroCardProjection {
  readonly handSize: number;
  readonly discardSize: number;
  readonly exhaustSize: number;
  readonly drawPileSize: number;
  readonly lastPlayedCardIds: readonly string[];
  readonly ghostMarkerCount: number;
}

export interface ZeroModeProjection {
  readonly mode: ModeCode;
  readonly holdEnabled: boolean;
  readonly sharedTreasury: boolean;
  readonly sharedTreasuryBalance: number;
  readonly sharedOpportunityDeck: boolean;
  readonly disabledBots: readonly HaterBotId[];
  readonly spectatorLimit: number;
  readonly counterIntelTier: number;
  readonly modePresentation: string;
}

export interface ZeroEconomyProjection {
  readonly cash: number;
  readonly debt: number;
  readonly incomePerTick: number;
  readonly expensesPerTick: number;
  readonly netWorth: number;
  readonly freedomTarget: number;
  readonly haterHeat: number;
  readonly netCashflowPerTick: number;
}

export interface ZeroSnapshotProjection {
  readonly fingerprint: SnapshotFingerprint;
  readonly economy: ZeroEconomyProjection;
  readonly pressure: ZeroPressureProjection;
  readonly shield: ZeroShieldProjection;
  readonly battle: BotRuntimeProjection;
  readonly tension: ThreatProjection;
  readonly cascade: CascadeProjection;
  readonly decisionWindows: ZeroDecisionWindowProjection;
  readonly cards: ZeroCardProjection;
  readonly mode: ZeroModeProjection;
  readonly integrity: IntegrityProjection;
}

// ────────────────────────────────────────────────────────────────────────────────
// runtime-friendly snapshots of core subgraphs
// ────────────────────────────────────────────────────────────────────────────────

export interface ZeroActiveThreatSummary {
  readonly threatId: string;
  readonly source: string;
  readonly etaTicks: number;
  readonly severity: number;
  readonly visibleAs: ThreatEnvelope['visibleAs'];
  readonly summary: string;
}

export interface ZeroBotSummary {
  readonly botId: HaterBotId;
  readonly state: BotState;
  readonly heat: number;
  readonly neutralized: boolean;
  readonly lastAttackTick: number | null;
}

export interface ZeroChainSummary {
  readonly chainId: string;
  readonly templateId: string;
  readonly positive: boolean;
  readonly status: CascadeChainInstance['status'];
  readonly createdAtTick: number;
  readonly linkCount: number;
}

export interface ZeroLegendSummary {
  readonly markerCount: number;
  readonly latestMarkerKind: LegendMarker['kind'] | null;
  readonly latestMarkerCardId: string | null;
}

export interface ZeroDecisionRecordSummary {
  readonly tick: number;
  readonly actorId: string;
  readonly cardId: string;
  readonly latencyMs: number;
  readonly accepted: boolean;
  readonly timingClass: readonly string[];
}

export interface ZeroRuntimeDigest {
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly outcome: RunOutcome | null;
  readonly activeThreats: readonly ZeroActiveThreatSummary[];
  readonly bots: readonly ZeroBotSummary[];
  readonly chains: readonly ZeroChainSummary[];
  readonly decisions: readonly ZeroDecisionRecordSummary[];
  readonly legend: ZeroLegendSummary;
}

// ────────────────────────────────────────────────────────────────────────────────
// queue-safe metadata bags
// ────────────────────────────────────────────────────────────────────────────────

export type ZeroScalarMetadataValue =
  | string
  | number
  | boolean
  | null;

export type ZeroStructuredMetadataValue =
  | ZeroScalarMetadataValue
  | readonly ZeroScalarMetadataValue[]
  | Readonly<Record<string, ZeroScalarMetadataValue>>;

export type ZeroMetadataBag = Readonly<Record<string, ZeroStructuredMetadataValue>>;

export interface ZeroTaggedEnvelope {
  readonly tags: readonly string[];
  readonly metadata: ZeroMetadataBag;
}

export interface ZeroNamedCheckpoint {
  readonly name: string;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly atMs: number;
  readonly checksum: string;
  readonly tags: readonly string[];
}

// ────────────────────────────────────────────────────────────────────────────────
// zero-compatible configuration packets
// ────────────────────────────────────────────────────────────────────────────────

export interface ZeroRuntimeLimits {
  readonly maxTickHistory: number;
  readonly maxWarningRetain: number;
  readonly maxErrorRetain: number;
  readonly maxTelemetryRetain: number;
  readonly maxLifecycleRetain: number;
  readonly maxEventSealFamilies: number;
}

export const ZERO_DEFAULT_RUNTIME_LIMITS: Readonly<ZeroRuntimeLimits> = Object.freeze({
  maxTickHistory: 64,
  maxWarningRetain: 256,
  maxErrorRetain: 256,
  maxTelemetryRetain: 512,
  maxLifecycleRetain: 128,
  maxEventSealFamilies: 64,
});

export interface ZeroRuntimeToggles {
  readonly strictTerminalPriority: boolean;
  readonly strictLifecycleValidation: boolean;
  readonly strictEventSealValidation: boolean;
  readonly strictRequiredEngineValidation: boolean;
  readonly allowResumeFromSnapshot: boolean;
  readonly allowCustomModeActionIds: boolean;
}

export const ZERO_DEFAULT_RUNTIME_TOGGLES: Readonly<ZeroRuntimeToggles> = Object.freeze({
  strictTerminalPriority: true,
  strictLifecycleValidation: true,
  strictEventSealValidation: true,
  strictRequiredEngineValidation: true,
  allowResumeFromSnapshot: true,
  allowCustomModeActionIds: true,
});

export interface ZeroRuntimeConfiguration {
  readonly limits: ZeroRuntimeLimits;
  readonly toggles: ZeroRuntimeToggles;
  readonly dependencyBindings: ZeroDependencyBindingReport;
}

// ────────────────────────────────────────────────────────────────────────────────
// factory helpers
// ────────────────────────────────────────────────────────────────────────────────

export function isRunLifecycleState(value: unknown): value is RunLifecycleState {
  return (
    typeof value === 'string'
    && (ZERO_RUN_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export function isRunLifecycleTransition(value: unknown): value is RunLifecycleTransition {
  return (
    typeof value === 'string'
    && (ZERO_RUN_LIFECYCLE_TRANSITIONS as readonly string[]).includes(value)
  );
}

export function isStepRuntimeOwner(value: unknown): value is StepRuntimeOwner {
  return (
    typeof value === 'string'
    && (ZERO_STEP_RUNTIME_OWNERS as readonly string[]).includes(value)
  );
}

export function isZeroModeActionId(value: unknown): value is ZeroModeActionId {
  return (
    typeof value === 'string'
    && (ZERO_MODE_ACTION_IDS as readonly string[]).includes(value)
  );
}

export function isCanonicalTickStep(value: unknown): value is TickStep {
  return (
    typeof value === 'string'
    && (ZERO_CANONICAL_TICK_SEQUENCE as readonly string[]).includes(value)
  );
}

export function isTerminalLifecycleState(
  value: RunLifecycleState,
): value is TerminalLifecycleState {
  return value === 'ENDING' || value === 'ENDED';
}

export function isNonTerminalLifecycleState(
  value: RunLifecycleState,
): value is NonTerminalLifecycleState {
  return !isTerminalLifecycleState(value);
}

export function isLifecycleTransitionLegal(
  from: RunLifecycleState,
  to: RunLifecycleState,
): boolean {
  return ZERO_LEGAL_LIFECYCLE_TRANSITIONS[from].includes(to);
}

export function describeLifecycleTransition(
  from: RunLifecycleState,
  to: RunLifecycleState,
): RunLifecycleInvariant {
  const legal = isLifecycleTransitionLegal(from, to);
  return {
    from,
    to,
    legal,
    reason: legal
      ? `Lifecycle transition ${from} -> ${to} is legal.`
      : `Lifecycle transition ${from} -> ${to} is not allowed.`,
  };
}

export function createRunLifecycleCheckpoint(
  lifecycleState: RunLifecycleState,
  changedAtMs: number,
  tick: number | null,
  transition: RunLifecycleTransition,
  note: string | null = null,
): RunLifecycleCheckpoint {
  return {
    lifecycleState,
    changedAtMs,
    tick,
    transition,
    note,
  };
}

export function createEmptyRunLifecycleHistory(): RunLifecycleHistory {
  return {
    checkpoints: Object.freeze([]),
    lastTransitionAtMs: null,
    transitionCount: 0,
  };
}

export function appendLifecycleCheckpoint(
  history: RunLifecycleHistory,
  checkpoint: RunLifecycleCheckpoint,
  maxRetained = ZERO_DEFAULT_RUNTIME_LIMITS.maxLifecycleRetain,
): RunLifecycleHistory {
  const next = [...history.checkpoints, checkpoint];
  const retained =
    next.length > maxRetained ? next.slice(next.length - maxRetained) : next;

  return {
    checkpoints: Object.freeze(retained),
    lastTransitionAtMs: checkpoint.changedAtMs,
    transitionCount: history.transitionCount + 1,
  };
}

export function createStartRunResolvedInput(
  input: StartRunInput,
  runId: string,
  seed: string,
  requestedAtMs: number,
): StartRunResolvedInput {
  return {
    ...input,
    runId,
    seed,
    requestedAtMs,
  };
}

export function createTickPlanSnapshot(
  enabledSteps: readonly TickStep[] = ZERO_CANONICAL_TICK_SEQUENCE,
): TickPlanSnapshot {
  const enabledSet = new Set<TickStep>(enabledSteps);
  const entries: TickPlanEntry[] = ZERO_CANONICAL_TICK_SEQUENCE.map((step) => ({
    step,
    descriptor: ZERO_TICK_STEP_DESCRIPTORS[step],
    enabled: enabledSet.has(step),
  }));

  return {
    entries: Object.freeze(entries),
    size: entries.length,
  };
}

export function createTickExecutionWindow(
  fromStep: TickStep,
  toStep: TickStep,
  inclusive = true,
): TickExecutionWindow {
  return {
    fromStep,
    toStep,
    inclusive,
  };
}

export function createUnlockedRuntimeFence(): TickRuntimeFence {
  return {
    locked: false,
    lockOwner: null,
    lockedAtMs: null,
    reason: null,
  };
}

export function createLockedRuntimeFence(
  owner: TickStep | 'RUN_START' | 'RUN_END',
  lockedAtMs: number,
  reason: string,
): TickRuntimeFence {
  return {
    locked: true,
    lockOwner: owner,
    lockedAtMs,
    reason,
  };
}

export function createTickStepErrorRecord(
  step: TickStep,
  engineId: TickStepErrorOwner,
  message: string,
  atMs: number,
  fatal: boolean,
  code?: string,
  tags?: readonly string[],
): TickStepErrorRecord {
  return {
    step,
    engineId,
    message,
    atMs,
    fatal,
    code,
    tags,
  };
}

export function createTickWarningRecord(
  step: TickWarningRecord['step'],
  message: string,
  atMs: number,
  code?: string,
  tags?: readonly string[],
): TickWarningRecord {
  return {
    step,
    message,
    atMs,
    code,
    tags,
  };
}

export function createStepExecutionReport(input: {
  readonly step: TickStep;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly emittedSequences?: readonly number[];
  readonly snapshotMutated: boolean;
  readonly outcomeAfterStep: RunOutcome | null;
  readonly errors?: readonly TickStepErrorRecord[];
  readonly warnings?: readonly TickWarningRecord[];
  readonly signals?: readonly EngineSignal[];
}): StepExecutionReport {
  const emittedSequences = [...(input.emittedSequences ?? [])];
  return {
    step: input.step,
    descriptor: ZERO_TICK_STEP_DESCRIPTORS[input.step],
    startedAtMs: input.startedAtMs,
    endedAtMs: input.endedAtMs,
    durationMs: Math.max(0, input.endedAtMs - input.startedAtMs),
    emittedEventCount: emittedSequences.length,
    emittedSequences: Object.freeze(emittedSequences),
    snapshotMutated: input.snapshotMutated,
    outcomeAfterStep: input.outcomeAfterStep,
    errors: Object.freeze([...(input.errors ?? [])]),
    warnings: Object.freeze([...(input.warnings ?? [])]),
    signals: Object.freeze([...(input.signals ?? [])]),
  };
}

export function createStepBoundarySnapshot(
  step: TickStep,
  beforeChecksum: string,
  afterChecksum: string,
): StepBoundarySnapshot {
  return {
    step,
    beforeChecksum,
    afterChecksum,
    changed: beforeChecksum !== afterChecksum,
  };
}

export function createEngineEventSealSnapshot(
  events: readonly EngineEventEnvelope[],
): EngineEventSealSnapshot {
  const sequences = events.map((event) => event.sequence);
  return {
    events: Object.freeze([...events]),
    count: events.length,
    sequences: Object.freeze(sequences),
  };
}

export function createEventSealResult(
  checksum: string,
  emittedSequences: readonly number[],
): EventSealResult {
  return {
    checksum,
    emittedEventCount: emittedSequences.length,
    emittedSequences: Object.freeze([...emittedSequences]),
  };
}

export function createDependencyBindingReport(
  partial: Partial<ZeroDependencyBindingReport> = {},
): ZeroDependencyBindingReport {
  return {
    pressureReaderBound: partial.pressureReaderBound ?? false,
    shieldReaderBound: partial.shieldReaderBound ?? false,
    tensionReaderBound: partial.tensionReaderBound ?? false,
    cascadeReaderBound: partial.cascadeReaderBound ?? false,
    notes: Object.freeze([...(partial.notes ?? [])]),
  };
}

export function createOutcomeGateResolution(
  nextOutcome: RunOutcome | null,
  reason: OutcomeGateReason,
): OutcomeGateResolution {
  return {
    nextOutcome,
    reason,
  };
}

export function createRunTerminationRecord(
  runId: string,
  outcome: RunOutcome,
  endedAtMs: number,
  finalSnapshot: RunStateSnapshot,
  reasonCode: OutcomeReasonCode | null = null,
  note: string | null = null,
): RunTerminationRecord {
  return {
    runId,
    outcome,
    endedAtMs,
    finalSnapshot,
    reasonCode,
    note,
  };
}

export function createOrchestratorStateSnapshot(input: {
  readonly lifecycleState: RunLifecycleState;
  readonly runId: string | null;
  readonly userId: string | null;
  readonly seed: string | null;
  readonly freedomThreshold: number;
  readonly consecutiveTickErrorCount: number;
  readonly current: RunStateSnapshot | null;
}): OrchestratorStateSnapshot {
  return {
    lifecycleState: input.lifecycleState,
    runId: input.runId,
    userId: input.userId,
    seed: input.seed,
    freedomThreshold: input.freedomThreshold,
    consecutiveTickErrorCount: input.consecutiveTickErrorCount,
    current: input.current,
  };
}

export function createOrchestratorTelemetryRecord(input: {
  readonly runId: string;
  readonly tick: number;
  readonly lifecycleState: RunLifecycleState;
  readonly step: TickStep | 'RUN_START' | 'RUN_END';
  readonly emittedEventCount: number;
  readonly durationMs: number;
  readonly warnings?: readonly TickWarningRecord[];
  readonly errors?: readonly TickStepErrorRecord[];
}): OrchestratorTelemetryRecord {
  return {
    runId: input.runId,
    tick: input.tick,
    lifecycleState: input.lifecycleState,
    step: input.step,
    emittedEventCount: input.emittedEventCount,
    durationMs: input.durationMs,
    warnings: Object.freeze([...(input.warnings ?? [])]),
    errors: Object.freeze([...(input.errors ?? [])]),
  };
}

export function createEventHistoryWindow(
  sequences: readonly number[],
): EventHistoryWindow {
  if (sequences.length === 0) {
    return {
      fromSequence: null,
      toSequence: null,
      count: 0,
    };
  }

  return {
    fromSequence: sequences[0] ?? null,
    toSequence: sequences[sequences.length - 1] ?? null,
    count: sequences.length,
  };
}

export function summarizeEventEnvelope<
  K extends keyof EngineEventMap,
>(
  envelope: EngineEventEnvelope<K>,
): EventEnvelopeSummary<K> {
  return {
    sequence: envelope.sequence,
    event: envelope.event,
    emittedAtTick: envelope.emittedAtTick ?? null,
    tags: Object.freeze([...(envelope.tags ?? [])]),
  };
}

export function groupEventsByFamily(
  events: readonly EngineEventEnvelope[],
): readonly EventFamilySummary[] {
  const accumulator = new Map<keyof EngineEventMap, EventFamilySummary>();

  for (const entry of events) {
    const previous = accumulator.get(entry.event);
    if (previous === undefined) {
      accumulator.set(entry.event, {
        event: entry.event,
        count: 1,
        firstSequence: entry.sequence,
        lastSequence: entry.sequence,
      });
      continue;
    }

    accumulator.set(entry.event, {
      event: entry.event,
      count: previous.count + 1,
      firstSequence: previous.firstSequence,
      lastSequence: entry.sequence,
    });
  }

  return Object.freeze([...accumulator.values()]);
}

export function createEventSealAudit(
  runId: string,
  tick: number,
  checksum: string,
  events: readonly EngineEventEnvelope[],
): EventSealAudit {
  return {
    runId,
    tick,
    checksum,
    eventCount: events.length,
    families: groupEventsByFamily(events),
  };
}

export function createRequiredEngineDescriptorMap(): Readonly<
  Record<EngineId, ZeroRequiredEngineDescriptor>
> {
  return Object.freeze(
    ZERO_REQUIRED_ENGINES.reduce<Record<EngineId, ZeroRequiredEngineDescriptor>>(
      (accumulator, entry) => {
        accumulator[entry.engineId] = entry;
        return accumulator;
      },
      {
        time: ZERO_REQUIRED_ENGINES[0],
        pressure: ZERO_REQUIRED_ENGINES[1],
        tension: ZERO_REQUIRED_ENGINES[2],
        shield: ZERO_REQUIRED_ENGINES[3],
        battle: ZERO_REQUIRED_ENGINES[4],
        cascade: ZERO_REQUIRED_ENGINES[5],
        sovereignty: ZERO_REQUIRED_ENGINES[6],
      },
    ),
  );
}

export function createOutcomeGateAudit(
  runId: string,
  tick: number,
  evaluations: readonly OutcomeGateEvaluation[],
  resolution: OutcomeGateResolution,
): OutcomeGateAudit {
  return {
    runId,
    tick,
    evaluations: Object.freeze([...(evaluations ?? [])]),
    resolution,
  };
}

export function createSnapshotFingerprint(input: {
  readonly runId: string;
  readonly tick: number;
  readonly phase: RunPhase;
  readonly outcome: RunOutcome | null;
  readonly checksum: string;
  readonly integrityStatus: IntegrityStatus;
  readonly eventCount: number;
}): SnapshotFingerprint {
  return {
    runId: input.runId,
    tick: input.tick,
    phase: input.phase,
    outcome: input.outcome,
    checksum: input.checksum,
    integrityStatus: input.integrityStatus,
    eventCount: input.eventCount,
  };
}

export function createDecisionTelemetryProjection(
  decisions: readonly DecisionRecord[],
): DecisionTelemetryProjection {
  const accepted = decisions.filter((decision) => decision.accepted);
  const rejected = decisions.filter((decision) => !decision.accepted);
  const averageLatencyMs =
    decisions.length === 0
      ? 0
      : decisions.reduce((sum, decision) => sum + decision.latencyMs, 0) / decisions.length;

  return {
    tick: decisions[decisions.length - 1]?.tick ?? 0,
    totalCount: decisions.length,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    averageLatencyMs,
    cardIds: Object.freeze([...new Set(decisions.map((decision) => decision.cardId))]),
    timingClasses: Object.freeze([
      ...new Set(
        decisions.flatMap((decision) => decision.timingClass),
      ),
    ]),
  };
}

export function createBotRuntimeProjection(snapshot: RunStateSnapshot): BotRuntimeProjection {
  const activeBotIds = snapshot.battle.bots
    .filter((bot) => bot.state !== 'DORMANT' && bot.state !== 'NEUTRALIZED')
    .map((bot) => bot.botId);

  const neutralizedBotIds = snapshot.battle.neutralizedBotIds;
  const attackingBotIds = snapshot.battle.bots
    .filter((bot) => bot.state === 'ATTACKING')
    .map((bot) => bot.botId);

  const breachedTargetLayers = snapshot.shield.layers
    .filter((layer) => layer.breached)
    .map((layer) => layer.layerId);

  return {
    activeBotIds: Object.freeze(activeBotIds),
    neutralizedBotIds: Object.freeze([...neutralizedBotIds]),
    attackingBotIds: Object.freeze(attackingBotIds),
    breachedTargetLayers: Object.freeze(breachedTargetLayers),
  };
}

export function createThreatProjection(
  threats: readonly ThreatEnvelope[],
  routedAttacks: readonly AttackEvent[] = [],
): ThreatProjection {
  const bySource: Record<string, number> = {};
  const byTargetLayer: Record<ShieldLayerId | 'DIRECT', number> = {
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
    DIRECT: 0,
  };

  for (const threat of threats) {
    bySource[threat.source] = (bySource[threat.source] ?? 0) + 1;
  }

  for (const attack of routedAttacks) {
    byTargetLayer[attack.targetLayer] += 1;
  }

  return {
    totalVisible: threats.length,
    bySource: Object.freeze({ ...bySource }),
    byTargetLayer: Object.freeze({ ...byTargetLayer }),
  };
}

export function createCascadeProjection(
  snapshot: RunStateSnapshot,
): CascadeProjection {
  const positive = snapshot.cascade.activeChains.filter((chain) => chain.positive);
  const negative = snapshot.cascade.activeChains.filter((chain) => !chain.positive);

  return {
    activeChainCount: snapshot.cascade.activeChains.length,
    activePositiveChainCount: positive.length,
    activeNegativeChainCount: negative.length,
    brokenChains: snapshot.cascade.brokenChains,
    completedChains: snapshot.cascade.completedChains,
  };
}

export function createIntegrityProjection(
  snapshot: RunStateSnapshot,
): IntegrityProjection {
  return {
    status: snapshot.sovereignty.integrityStatus,
    proofHashPresent: snapshot.sovereignty.proofHash !== null,
    auditFlagCount: snapshot.sovereignty.auditFlags.length,
    proofBadgeCount: snapshot.sovereignty.proofBadges.length,
    tickChecksumCount: snapshot.sovereignty.tickChecksums.length,
  };
}

export function createDecisionWindowProjection(
  activeDecisionWindows: Readonly<Record<string, RuntimeDecisionWindowSnapshot>>,
): ZeroDecisionWindowProjection {
  const windows = Object.values(activeDecisionWindows);
  return {
    ids: Object.freeze(windows.map((window) => window.id)),
    activeCount: windows.length,
    frozenCount: windows.filter((window) => window.frozen).length,
    consumedCount: windows.filter((window) => window.consumed).length,
    actorIds: Object.freeze([
      ...new Set(windows.map((window) => window.actorId).filter(Boolean) as string[]),
    ]),
    sourceLabels: Object.freeze([
      ...new Set(windows.map((window) => window.source)),
    ]),
  };
}

export function createShieldProjection(
  snapshot: RunStateSnapshot,
): ZeroShieldProjection {
  const totalCurrent = snapshot.shield.layers.reduce((sum, layer) => sum + layer.current, 0);
  const totalMax = snapshot.shield.layers.reduce((sum, layer) => sum + layer.max, 0);
  const weakest = snapshot.shield.layers.find(
    (layer) => layer.layerId === snapshot.shield.weakestLayerId,
  );

  return {
    weakestLayerId: snapshot.shield.weakestLayerId,
    weakestLayerLabel: weakest?.label ?? 'NETWORK_CORE',
    weakestLayerRatio: snapshot.shield.weakestLayerRatio,
    breachedLayerIds: Object.freeze(
      snapshot.shield.layers.filter((layer) => layer.breached).map((layer) => layer.layerId),
    ),
    totalCurrent,
    totalMax,
    normalizedIntegrity: totalMax <= 0 ? 0 : totalCurrent / totalMax,
  };
}

function getPressureTierRank(tier: PressureTier): number {
  switch (tier) {
    case 'T0':
      return 0;
    case 'T1':
      return 1;
    case 'T2':
      return 2;
    case 'T3':
      return 3;
    case 'T4':
      return 4;
    default:
      return 0;
  }
}

export function createPressureProjection(
  snapshot: RunStateSnapshot,
): ZeroPressureProjection {
  const score = snapshot.pressure.score;
  const previousMax = snapshot.pressure.maxScoreSeen;
  const currentTierRank = getPressureTierRank(snapshot.pressure.tier);
  const previousTierRank = getPressureTierRank(snapshot.pressure.previousTier);

  const trend: ZeroPressureProjection['trend'] =
    score >= previousMax && score > 0
      ? 'SPIKING'
      : currentTierRank > previousTierRank
        ? 'RISING'
        : currentTierRank === previousTierRank
          ? 'FLAT'
          : 'RELIEVING';

  return {
    score,
    tier: snapshot.pressure.tier,
    upwardCrossings: snapshot.pressure.upwardCrossings,
    survivedHighPressureTicks: snapshot.pressure.survivedHighPressureTicks,
    maxScoreSeen: previousMax,
    trend,
  };
}

export function createCardProjection(
  snapshot: RunStateSnapshot,
): ZeroCardProjection {
  return {
    handSize: snapshot.cards.hand.length,
    discardSize: snapshot.cards.discard.length,
    exhaustSize: snapshot.cards.exhaust.length,
    drawPileSize: snapshot.cards.drawPileSize,
    lastPlayedCardIds: Object.freeze([...snapshot.cards.lastPlayed]),
    ghostMarkerCount: snapshot.cards.ghostMarkers.length,
  };
}

export function createModeProjection(
  snapshot: RunStateSnapshot,
): ZeroModeProjection {
  return {
    mode: snapshot.mode,
    holdEnabled: snapshot.modeState.holdEnabled,
    sharedTreasury: snapshot.modeState.sharedTreasury,
    sharedTreasuryBalance: snapshot.modeState.sharedTreasuryBalance,
    sharedOpportunityDeck: snapshot.modeState.sharedOpportunityDeck,
    disabledBots: Object.freeze([...snapshot.modeState.disabledBots]),
    spectatorLimit: snapshot.modeState.spectatorLimit,
    counterIntelTier: snapshot.modeState.counterIntelTier,
    modePresentation: snapshot.modeState.modePresentation,
  };
}

export function createEconomyProjection(
  snapshot: RunStateSnapshot,
): ZeroEconomyProjection {
  return {
    cash: snapshot.economy.cash,
    debt: snapshot.economy.debt,
    incomePerTick: snapshot.economy.incomePerTick,
    expensesPerTick: snapshot.economy.expensesPerTick,
    netWorth: snapshot.economy.netWorth,
    freedomTarget: snapshot.economy.freedomTarget,
    haterHeat: snapshot.economy.haterHeat,
    netCashflowPerTick: snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick,
  };
}

export function createSnapshotProjection(
  snapshot: RunStateSnapshot,
  checksum: string,
  eventCount: number,
): ZeroSnapshotProjection {
  return {
    fingerprint: createSnapshotFingerprint({
      runId: snapshot.runId,
      tick: snapshot.tick,
      phase: snapshot.phase,
      outcome: snapshot.outcome,
      checksum,
      integrityStatus: snapshot.sovereignty.integrityStatus,
      eventCount,
    }),
    economy: createEconomyProjection(snapshot),
    pressure: createPressureProjection(snapshot),
    shield: createShieldProjection(snapshot),
    battle: createBotRuntimeProjection(snapshot),
    tension: createThreatProjection(snapshot.tension.visibleThreats, snapshot.battle.pendingAttacks),
    cascade: createCascadeProjection(snapshot),
    decisionWindows: createDecisionWindowProjection(snapshot.timers.activeDecisionWindows),
    cards: createCardProjection(snapshot),
    mode: createModeProjection(snapshot),
    integrity: createIntegrityProjection(snapshot),
  };
}

export function createZeroRuntimeDigest(
  snapshot: RunStateSnapshot,
): ZeroRuntimeDigest {
  return {
    runId: snapshot.runId,
    tick: snapshot.tick,
    phase: snapshot.phase,
    outcome: snapshot.outcome,
    activeThreats: Object.freeze(
      snapshot.tension.visibleThreats.map((threat) => ({
        threatId: threat.threatId,
        source: threat.source,
        etaTicks: threat.etaTicks,
        severity: threat.severity,
        visibleAs: threat.visibleAs,
        summary: threat.summary,
      })),
    ),
    bots: Object.freeze(
      snapshot.battle.bots.map((bot) => ({
        botId: bot.botId,
        state: bot.state,
        heat: bot.heat,
        neutralized: bot.neutralized,
        lastAttackTick: bot.lastAttackTick,
      })),
    ),
    chains: Object.freeze(
      snapshot.cascade.activeChains.map((chain) => ({
        chainId: chain.chainId,
        templateId: chain.templateId,
        positive: chain.positive,
        status: chain.status,
        createdAtTick: chain.createdAtTick,
        linkCount: chain.links.length,
      })),
    ),
    decisions: Object.freeze(
      snapshot.telemetry.decisions.map((decision) => ({
        tick: decision.tick,
        actorId: decision.actorId,
        cardId: decision.cardId,
        latencyMs: decision.latencyMs,
        accepted: decision.accepted,
        timingClass: Object.freeze([...decision.timingClass]),
      })),
    ),
    legend: {
      markerCount: snapshot.cards.ghostMarkers.length,
      latestMarkerKind: snapshot.cards.ghostMarkers[snapshot.cards.ghostMarkers.length - 1]?.kind ?? null,
      latestMarkerCardId: snapshot.cards.ghostMarkers[snapshot.cards.ghostMarkers.length - 1]?.cardId ?? null,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// semantic helpers
// ────────────────────────────────────────────────────────────────────────────────

export function getEventFamily(
  event: keyof EngineEventMap,
): ZeroEventFamily {
  return ZERO_EVENT_FAMILY_BY_EVENT[event] ?? 'UNKNOWN';
}

export function getTickPlanEntry(
  step: TickStep,
): TickPlanEntry {
  return {
    step,
    descriptor: ZERO_TICK_STEP_DESCRIPTORS[step],
    enabled: true,
  };
}

export function getTerminalPriorityOrdinal(
  outcome: RunOutcome,
): number {
  return ZERO_TERMINAL_PRIORITY.find((entry) => entry.outcome === outcome)?.ordinal ?? Number.MAX_SAFE_INTEGER;
}

export function compareTerminalPriority(
  left: RunOutcome,
  right: RunOutcome,
): number {
  return getTerminalPriorityOrdinal(left) - getTerminalPriorityOrdinal(right);
}

export function selectHigherPriorityOutcome(
  outcomes: readonly RunOutcome[],
): RunOutcome | null {
  if (outcomes.length === 0) {
    return null;
  }

  return [...outcomes].sort(compareTerminalPriority)[0] ?? null;
}

export function createDefaultOutcomeGateEvaluations(
  snapshot: RunStateSnapshot,
): readonly OutcomeGateEvaluation[] {
  return Object.freeze([
    {
      condition: 'HAS_REACHED_TARGET',
      satisfied: snapshot.economy.netWorth >= snapshot.economy.freedomTarget,
      note: 'netWorth >= freedomTarget',
    },
    {
      condition: 'HAS_COLLAPSED_NET_WORTH',
      satisfied: snapshot.economy.netWorth < 0 || snapshot.economy.cash < 0,
      note: 'netWorth < 0 or cash < 0',
    },
    {
      condition: 'HAS_EXHAUSTED_SEASON_BUDGET',
      satisfied:
        snapshot.timers.elapsedMs >=
        snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs,
      note: 'elapsedMs >= seasonBudgetMs + extensionBudgetMs',
    },
    {
      condition: 'HAS_USER_ABANDONED',
      satisfied: snapshot.telemetry.outcomeReasonCode === 'USER_ABANDON',
      note: 'telemetry.outcomeReasonCode === USER_ABANDON',
    },
    {
      condition: 'HAS_ENGINE_ABORTED',
      satisfied: snapshot.telemetry.outcomeReasonCode === 'ENGINE_ABORT',
      note: 'telemetry.outcomeReasonCode === ENGINE_ABORT',
    },
    {
      condition: 'HAS_ENTERED_INTEGRITY_QUARANTINE',
      satisfied: snapshot.sovereignty.integrityStatus === 'QUARANTINED',
      note: 'sovereignty.integrityStatus === QUARANTINED',
    },
  ]);
}

export function inferOutcomeGateResolution(
  snapshot: RunStateSnapshot,
): OutcomeGateResolution {
  if (snapshot.economy.netWorth >= snapshot.economy.freedomTarget) {
    return createOutcomeGateResolution('FREEDOM', 'TARGET_REACHED');
  }

  if (snapshot.telemetry.outcomeReasonCode === 'USER_ABANDON') {
    return createOutcomeGateResolution('ABANDONED', 'USER_ABANDON');
  }

  if (snapshot.telemetry.outcomeReasonCode === 'ENGINE_ABORT') {
    return createOutcomeGateResolution('ABANDONED', 'ENGINE_ABORT');
  }

  if (snapshot.sovereignty.integrityStatus === 'QUARANTINED') {
    return createOutcomeGateResolution('ABANDONED', 'INTEGRITY_QUARANTINE');
  }

  if (snapshot.economy.netWorth < 0 || snapshot.economy.cash < 0) {
    return createOutcomeGateResolution('BANKRUPT', 'NET_WORTH_COLLAPSE');
  }

  if (
    snapshot.timers.elapsedMs >=
    snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs
  ) {
    return createOutcomeGateResolution('TIMEOUT', 'SEASON_TIMEOUT');
  }

  return createOutcomeGateResolution(null, 'UNCHANGED');
}

export function summarizeDecisionWindows(
  activeDecisionWindows: Readonly<Record<string, RuntimeDecisionWindowSnapshot>>,
): readonly RuntimeDecisionWindowSnapshot[] {
  return Object.freeze(
    Object.values(activeDecisionWindows).sort((left, right) => {
      const leftTick = left.openedAtTick;
      const rightTick = right.openedAtTick;
      return leftTick === rightTick
        ? left.id.localeCompare(right.id)
        : leftTick - rightTick;
    }),
  );
}

export function summarizeCardsForPlay(
  hand: readonly CardInstance[],
): readonly {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly targeting: Targeting;
  readonly timingClass: readonly TimingClass[];
  readonly cost: number;
  readonly divergencePotential: CardInstance['divergencePotential'];
}[] {
  return Object.freeze(
    hand.map((card) => ({
      instanceId: card.instanceId,
      definitionId: card.definitionId,
      targeting: card.targeting,
      timingClass: Object.freeze([...card.timingClass]),
      cost: card.cost,
      divergencePotential: card.divergencePotential,
    })),
  );
}

export function summarizeCardDefinition(
  definition: CardDefinition,
): Readonly<{
  id: string;
  deckType: CardDefinition['deckType'];
  baseCost: number;
  targeting: Targeting;
  timingClass: readonly TimingClass[];
  modeLegal: readonly ModeCode[];
  tags: readonly string[];
}> {
  return Object.freeze({
    id: definition.id,
    deckType: definition.deckType,
    baseCost: definition.baseCost,
    targeting: definition.targeting,
    timingClass: Object.freeze([...definition.timingClass]),
    modeLegal: Object.freeze([...definition.modeLegal]),
    tags: Object.freeze([...definition.tags]),
  });
}

export function summarizeEffectPayload(
  payload: EffectPayload,
): Readonly<EffectPayload> {
  return Object.freeze({
    cashDelta: payload.cashDelta,
    debtDelta: payload.debtDelta,
    incomeDelta: payload.incomeDelta,
    expenseDelta: payload.expenseDelta,
    shieldDelta: payload.shieldDelta,
    heatDelta: payload.heatDelta,
    trustDelta: payload.trustDelta,
    treasuryDelta: payload.treasuryDelta,
    battleBudgetDelta: payload.battleBudgetDelta,
    holdChargeDelta: payload.holdChargeDelta,
    counterIntelDelta: payload.counterIntelDelta,
    timeDeltaMs: payload.timeDeltaMs,
    divergenceDelta: payload.divergenceDelta,
    cascadeTag: payload.cascadeTag,
    injectCards:
      payload.injectCards === undefined
        ? undefined
        : (Object.freeze([...payload.injectCards]) as unknown as string[]),
    exhaustCards:
      payload.exhaustCards === undefined
        ? undefined
        : (Object.freeze([...payload.exhaustCards]) as unknown as string[]),
    grantBadges:
      payload.grantBadges === undefined
        ? undefined
        : (Object.freeze([...payload.grantBadges]) as unknown as string[]),
    namedActionId: payload.namedActionId,
  });
}

export function summarizeAttackEvent(
  attack: AttackEvent,
): Readonly<{
  attackId: string;
  source: HaterBotId | 'OPPONENT' | 'SYSTEM';
  category: AttackCategory;
  targetEntity: AttackTargetEntity;
  targetLayer: ShieldLayerId | 'DIRECT';
  magnitude: number;
  createdAtTick: number;
  notes: readonly string[];
}> {
  return Object.freeze({
    attackId: attack.attackId,
    source: attack.source,
    category: attack.category,
    targetEntity: attack.targetEntity,
    targetLayer: attack.targetLayer,
    magnitude: attack.magnitude,
    createdAtTick: attack.createdAtTick,
    notes: Object.freeze([...attack.notes]),
  });
}

export function summarizeChain(
  chain: CascadeChainInstance,
): ZeroChainSummary {
  return {
    chainId: chain.chainId,
    templateId: chain.templateId,
    positive: chain.positive,
    status: chain.status,
    createdAtTick: chain.createdAtTick,
    linkCount: chain.links.length,
  };
}

export function summarizeLegendMarkers(
  markers: readonly LegendMarker[],
): ZeroLegendSummary {
  return {
    markerCount: markers.length,
    latestMarkerKind: markers[markers.length - 1]?.kind ?? null,
    latestMarkerCardId: markers[markers.length - 1]?.cardId ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// runtime validation helpers
// ────────────────────────────────────────────────────────────────────────────────

export function assertCanonicalTickPlan(
  plan: TickPlanSnapshot,
): void {
  if (plan.size !== ZERO_CANONICAL_TICK_SEQUENCE.length) {
    throw new Error(
      `Invalid tick plan size. Expected ${ZERO_CANONICAL_TICK_SEQUENCE.length}, received ${plan.size}.`,
    );
  }

  for (let index = 0; index < ZERO_CANONICAL_TICK_SEQUENCE.length; index += 1) {
    const expected = ZERO_CANONICAL_TICK_SEQUENCE[index];
    const actual = plan.entries[index]?.step;
    if (expected !== actual) {
      throw new Error(`Tick plan mismatch at index ${index}. Expected ${expected}, received ${actual}.`);
    }
  }
}

export function assertLifecycleTransitionLegal(
  from: RunLifecycleState,
  to: RunLifecycleState,
): void {
  if (!isLifecycleTransitionLegal(from, to)) {
    throw new Error(`Illegal lifecycle transition: ${from} -> ${to}.`);
  }
}

export function assertRequiredEngineHealthPresent(
  health: readonly EngineHealth[],
): void {
  const seen = new Set<EngineId>(health.map((entry) => entry.engineId));

  for (const descriptor of ZERO_REQUIRED_ENGINES) {
    if (!seen.has(descriptor.engineId)) {
      throw new Error(`Missing required engine health entry: ${descriptor.engineId}.`);
    }
  }
}

export function assertEventSealMonotonic(
  snapshot: EngineEventSealSnapshot,
): void {
  let previous = 0;
  for (const sequence of snapshot.sequences) {
    if (sequence <= previous) {
      throw new Error(
        `Event seal sequence order violation. Previous=${previous}, current=${sequence}.`,
      );
    }
    previous = sequence;
  }
}

export function assertTelemetryWindowMonotonic(
  records: readonly OrchestratorTelemetryRecord[],
): void {
  let lastTick = -1;
  for (const record of records) {
    if (record.tick < lastTick) {
      throw new Error(
        `Telemetry record ordering violation. Previous tick=${lastTick}, current tick=${record.tick}.`,
      );
    }
    lastTick = record.tick;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// strongly typed zero snapshots
// ────────────────────────────────────────────────────────────────────────────────

export interface ZeroStartBoundarySnapshot {
  readonly resolved: StartRunResolvedInput;
  readonly lifecycleCheckpoint: RunLifecycleCheckpoint;
  readonly dependencyBindings: ZeroDependencyBindingReport;
  readonly requiredEngines: readonly ZeroRequiredEngineDescriptor[];
}

export interface ZeroTickBoundarySnapshot {
  readonly trace: TickTrace;
  readonly tickPlan: TickPlanSnapshot;
  readonly preTick: SnapshotFingerprint;
  readonly postTick: SnapshotFingerprint | null;
  readonly eventSeal: EventSealResult | null;
}

export interface ZeroEndBoundarySnapshot {
  readonly record: RunTerminationRecord;
  readonly lifecycleCheckpoint: RunLifecycleCheckpoint;
  readonly finalProjection: ZeroSnapshotProjection;
}

// ────────────────────────────────────────────────────────────────────────────────
// bundled views for tests / observability / replay
// ────────────────────────────────────────────────────────────────────────────────

export interface ZeroReplayFrame {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly snapshot: RunStateSnapshot;
  readonly projection: ZeroSnapshotProjection;
  readonly events: readonly EngineEventEnvelope[];
  readonly telemetry: OrchestratorTelemetryRecord | null;
}

export interface ZeroReplayTape {
  readonly runId: string;
  readonly frames: readonly ZeroReplayFrame[];
  readonly finalOutcome: RunOutcome | null;
  readonly totalEvents: number;
}

export interface ZeroObservabilityPacket {
  readonly runId: string;
  readonly lifecycle: RunLifecycleHistory;
  readonly state: OrchestratorStateSnapshot;
  readonly health: OrchestratorHealthReport;
  readonly latestProjection: ZeroSnapshotProjection | null;
  readonly latestTick: TickExecutionSummary | null;
}

// ────────────────────────────────────────────────────────────────────────────────
// thin predicates
// ────────────────────────────────────────────────────────────────────────────────

export function isEngineEventEnvelope(
  value: unknown,
): value is EngineEventEnvelope {
  return (
    typeof value === 'object'
    && value !== null
    && 'sequence' in value
    && 'event' in value
    && 'payload' in value
  );
}

export function isTickStepErrorRecord(
  value: unknown,
): value is TickStepErrorRecord {
  return (
    typeof value === 'object'
    && value !== null
    && 'step' in value
    && 'engineId' in value
    && 'message' in value
    && 'atMs' in value
    && 'fatal' in value
  );
}

export function isStepExecutionReport(
  value: unknown,
): value is StepExecutionReport {
  return (
    typeof value === 'object'
    && value !== null
    && 'step' in value
    && 'descriptor' in value
    && 'startedAtMs' in value
    && 'endedAtMs' in value
    && 'durationMs' in value
  );
}

export function isTickExecutionSummary(
  value: unknown,
): value is TickExecutionSummary {
  return (
    typeof value === 'object'
    && value !== null
    && 'runId' in value
    && 'tick' in value
    && 'steps' in value
    && 'preTickSnapshot' in value
    && 'postTickSnapshot' in value
  );
}

export function isOutcomeGateResolution(
  value: unknown,
): value is OutcomeGateResolution {
  return (
    typeof value === 'object'
    && value !== null
    && 'nextOutcome' in value
    && 'reason' in value
  );
}

export function isRunTerminationRecord(
  value: unknown,
): value is RunTerminationRecord {
  return (
    typeof value === 'object'
    && value !== null
    && 'runId' in value
    && 'outcome' in value
    && 'endedAtMs' in value
    && 'finalSnapshot' in value
  );
}

export function isZeroSnapshotProjection(
  value: unknown,
): value is ZeroSnapshotProjection {
  return (
    typeof value === 'object'
    && value !== null
    && 'fingerprint' in value
    && 'economy' in value
    && 'pressure' in value
    && 'integrity' in value
  );
}

export function isZeroRuntimeDigest(
  value: unknown,
): value is ZeroRuntimeDigest {
  return (
    typeof value === 'object'
    && value !== null
    && 'runId' in value
    && 'tick' in value
    && 'phase' in value
    && 'bots' in value
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// default empty structures for tests and controlled bootstraps
// ────────────────────────────────────────────────────────────────────────────────

export const ZERO_EMPTY_EVENT_SEAL_SNAPSHOT: Readonly<EngineEventSealSnapshot> = Object.freeze({
  events: Object.freeze([]),
  count: 0,
  sequences: Object.freeze([]),
});

export const ZERO_EMPTY_DEPENDENCY_BINDING_REPORT: Readonly<ZeroDependencyBindingReport> =
  Object.freeze({
    pressureReaderBound: false,
    shieldReaderBound: false,
    tensionReaderBound: false,
    cascadeReaderBound: false,
    notes: Object.freeze([]),
  });

export const ZERO_EMPTY_RUNTIME_LIMITS: Readonly<ZeroRuntimeLimits> =
  ZERO_DEFAULT_RUNTIME_LIMITS;

export const ZERO_EMPTY_RUNTIME_TOGGLES: Readonly<ZeroRuntimeToggles> =
  ZERO_DEFAULT_RUNTIME_TOGGLES;

export const ZERO_EMPTY_QUARANTINE_STATE: Readonly<OrchestratorQuarantineState> =
  Object.freeze({
    active: false,
    sinceTick: null,
    reasons: Object.freeze([]),
    triggeredBy: null,
  });

export const ZERO_EMPTY_OBSERVABILITY_PACKET: Readonly<{
  lifecycle: RunLifecycleHistory;
  dependencyBindings: ZeroDependencyBindingReport;
  quarantine: OrchestratorQuarantineState;
}> = Object.freeze({
  lifecycle: createEmptyRunLifecycleHistory(),
  dependencyBindings: ZERO_EMPTY_DEPENDENCY_BINDING_REPORT,
  quarantine: ZERO_EMPTY_QUARANTINE_STATE,
});

// ────────────────────────────────────────────────────────────────────────────────
// compile-time exhaustiveness helpers
// ────────────────────────────────────────────────────────────────────────────────

export function assertNeverLifecycle(value: never): never {
  throw new Error(`Unexpected lifecycle value: ${String(value)}`);
}

export function assertNeverStep(value: never): never {
  throw new Error(`Unexpected tick step value: ${String(value)}`);
}

export function assertNeverOutcome(value: never): never {
  throw new Error(`Unexpected outcome value: ${String(value)}`);
}

export function assertNeverMode(value: never): never {
  throw new Error(`Unexpected mode value: ${String(value)}`);
}

// ────────────────────────────────────────────────────────────────────────────────
// end of file
// ────────────────────────────────────────────────────────────────────────────────
