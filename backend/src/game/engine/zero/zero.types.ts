// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/zero.types.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/zero.types.ts
 *
 * Doctrine:
 * - zero owns orchestration contracts, not shared engine primitives
 * - additive expansion is preferred over breaking existing core contracts
 * - these types must describe backend run control without duplicating core EventBus,
 *   TickSequence, EngineRegistry, or RunStateSnapshot primitives
 * - Engine 0 remains the control tower above backend/core
 */

import type { EventEnvelope } from '../core/EventBus';
import type {
  EngineHealth,
  EngineId,
  EngineSignal,
  TickTrace,
} from '../core/EngineContracts';
import type { EngineEventMap, ModeCode, RunOutcome } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { TickStep, TickStepDescriptor } from '../core/TickSequence';

export type RunLifecycleState =
  | 'IDLE'
  | 'STARTING'
  | 'ACTIVE'
  | 'TICK_LOCKED'
  | 'ENDING'
  | 'ENDED';

export interface StartRunInput {
  readonly userId: string;
  readonly mode: ModeCode;
  readonly seed?: string;
  readonly communityHeatModifier?: number;
}

export interface StartRunResolvedInput extends StartRunInput {
  readonly runId: string;
  readonly seed: string;
}

export interface TickStepErrorRecord {
  readonly step: TickStep;
  readonly engineId: EngineId | 'system' | 'mode' | 'telemetry' | 'unknown';
  readonly message: string;
  readonly atMs: number;
  readonly fatal: boolean;
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
}

export interface TickExecutionSummary {
  readonly runId: string;
  readonly tick: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly stepCount: number;
  readonly steps: readonly StepExecutionReport[];
  readonly preTickSnapshot: RunStateSnapshot;
  readonly postTickSnapshot: RunStateSnapshot;
  readonly outcome: RunOutcome | null;
  readonly eventCount: number;
  readonly eventSequences: readonly number[];
  readonly warnings: readonly string[];
  readonly signals: readonly EngineSignal[];
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
}

export interface OrchestratorStateSnapshot {
  readonly lifecycleState: RunLifecycleState;
  readonly runId: string | null;
  readonly userId: string | null;
  readonly seed: string | null;
  readonly freedomThreshold: number;
  readonly consecutiveTickErrorCount: number;
  readonly current: RunStateSnapshot | null;
}

export interface StepRuntimeContext {
  readonly step: TickStep;
  readonly descriptor: TickStepDescriptor;
  readonly nowMs: number;
  readonly trace: TickTrace;
  readonly preStepSnapshot: RunStateSnapshot;
}

export interface EventSealResult {
  readonly checksum: string;
  readonly emittedEventCount: number;
  readonly emittedSequences: readonly number[];
}

export interface OutcomeGateResolution {
  readonly nextOutcome: RunOutcome | null;
  readonly reason:
    | 'TARGET_REACHED'
    | 'NET_WORTH_COLLAPSE'
    | 'SEASON_TIMEOUT'
    | 'UNCHANGED';
}

export interface EngineEventEnvelope<
  K extends keyof EngineEventMap = keyof EngineEventMap,
> extends EventEnvelope<K, EngineEventMap[K]> {}

export interface EngineEventSealSnapshot {
  readonly events: readonly EngineEventEnvelope[];
  readonly count: number;
  readonly sequences: readonly number[];
}

export interface ZeroDependencyBindingReport {
  readonly pressureReaderBound: boolean;
  readonly shieldReaderBound: boolean;
  readonly tensionReaderBound: boolean;
  readonly cascadeReaderBound: boolean;
  readonly notes: readonly string[];
}

export interface OrchestratorTelemetryRecord {
  readonly runId: string;
  readonly tick: number;
  readonly lifecycleState: RunLifecycleState;
  readonly step: TickStep | 'RUN_START' | 'RUN_END';
  readonly emittedEventCount: number;
  readonly durationMs: number;
  readonly warnings: readonly string[];
  readonly errors: readonly TickStepErrorRecord[];
}

export interface RunTerminationRecord {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly endedAtMs: number;
  readonly finalSnapshot: RunStateSnapshot;
}

export interface ZeroRequiredEngineDescriptor {
  readonly engineId: EngineId;
  readonly critical: boolean;
  readonly reason: string;
}

export interface TickPlanEntry {
  readonly step: TickStep;
  readonly descriptor: TickStepDescriptor;
  readonly enabled: boolean;
}

export interface TickPlanSnapshot {
  readonly entries: readonly TickPlanEntry[];
  readonly size: number;
}

export interface RunLifecycleCheckpoint {
  readonly lifecycleState: RunLifecycleState;
  readonly changedAtMs: number;
  readonly tick: number | null;
  readonly note: string | null;
}