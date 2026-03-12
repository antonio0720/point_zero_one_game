// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/OrchestratorConfig.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OrchestratorConfig.ts
 *
 * Doctrine:
 * - Engine 0 owns orchestration policy, not simulation policy
 * - config must be deterministic, explicit, and step-addressable
 * - backend/core remains the primitive library; zero wraps it with control-tower policy
 * - defaults must mirror the live repo cadence/order instead of inventing a second runtime
 */

import type { EngineId } from '../core/EngineContracts';
import {
  TICK_SEQUENCE,
  TICK_STEP_DESCRIPTORS,
  type TickStep,
} from '../core/TickSequence';

export interface OrchestratorSafetyPolicy {
  readonly maxConsecutiveTickErrors: number;
  readonly failClosedOnRegistryGap: boolean;
  readonly abortRunOnFatalSealError: boolean;
  readonly allowAdvanceWhenOutcomeAlreadySet: boolean;
}

export interface OrchestratorEventPolicy {
  readonly emitRunStartedImmediately: boolean;
  readonly emitTickStartedBeforeStepExecution: boolean;
  readonly emitTickCompletedBeforeFlush: boolean;
  readonly flushAtFinalStepOnly: boolean;
  readonly sealEventsBeforeFlush: boolean;
  readonly retainLastEventSealSnapshots: number;
}

export interface OrchestratorDiagnosticsPolicy {
  readonly enableTracePublishing: boolean;
  readonly enableHealthSnapshots: boolean;
  readonly retainLastTickSummaries: number;
  readonly retainLastErrors: number;
}

export interface OrchestratorLifecyclePolicy {
  readonly allowPlayCardOnlyWhenActive: boolean;
  readonly autoFinalizeProofOnTerminalOutcome: boolean;
  readonly forceOutcomeOnConsecutiveErrorLimit: 'ABANDONED';
}

export interface OrchestratorStepPolicy {
  readonly enabled: boolean;
  readonly fatalOnError: boolean;
  readonly continueOnError: boolean;
}

export interface OrchestratorConfig {
  readonly requiredEngineIds: readonly EngineId[];
  readonly safety: OrchestratorSafetyPolicy;
  readonly events: OrchestratorEventPolicy;
  readonly diagnostics: OrchestratorDiagnosticsPolicy;
  readonly lifecycle: OrchestratorLifecyclePolicy;
  readonly stepConfig: Readonly<Record<TickStep, OrchestratorStepPolicy>>;
}

export interface OrchestratorConfigOverrides {
  readonly requiredEngineIds?: readonly EngineId[];
  readonly safety?: Partial<OrchestratorSafetyPolicy>;
  readonly events?: Partial<OrchestratorEventPolicy>;
  readonly diagnostics?: Partial<OrchestratorDiagnosticsPolicy>;
  readonly lifecycle?: Partial<OrchestratorLifecyclePolicy>;
  readonly stepConfig?: Partial<Record<TickStep, Partial<OrchestratorStepPolicy>>>;
}

const DEFAULT_REQUIRED_ENGINE_IDS: readonly EngineId[] = Object.freeze([
  'time',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
]);

const DEFAULT_SAFETY_POLICY: OrchestratorSafetyPolicy = Object.freeze({
  maxConsecutiveTickErrors: 5,
  failClosedOnRegistryGap: true,
  abortRunOnFatalSealError: true,
  allowAdvanceWhenOutcomeAlreadySet: false,
});

const DEFAULT_EVENT_POLICY: OrchestratorEventPolicy = Object.freeze({
  emitRunStartedImmediately: true,
  emitTickStartedBeforeStepExecution: true,
  emitTickCompletedBeforeFlush: true,
  flushAtFinalStepOnly: true,
  sealEventsBeforeFlush: true,
  retainLastEventSealSnapshots: 64,
});

const DEFAULT_DIAGNOSTICS_POLICY: OrchestratorDiagnosticsPolicy = Object.freeze({
  enableTracePublishing: true,
  enableHealthSnapshots: true,
  retainLastTickSummaries: 50,
  retainLastErrors: 100,
});

const DEFAULT_LIFECYCLE_POLICY: OrchestratorLifecyclePolicy = Object.freeze({
  allowPlayCardOnlyWhenActive: true,
  autoFinalizeProofOnTerminalOutcome: true,
  forceOutcomeOnConsecutiveErrorLimit: 'ABANDONED',
});

const DEFAULT_STEP_POLICY: OrchestratorStepPolicy = Object.freeze({
  enabled: true,
  fatalOnError: false,
  continueOnError: true,
});

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueEngineIds(engineIds: readonly EngineId[]): readonly EngineId[] {
  const seen = new Set<EngineId>();
  const ordered: EngineId[] = [];

  for (const engineId of engineIds) {
    if (seen.has(engineId)) {
      continue;
    }

    seen.add(engineId);
    ordered.push(engineId);
  }

  return freezeArray(ordered);
}

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.trunc(value));
}

function createDefaultStepConfig(): Readonly<Record<TickStep, OrchestratorStepPolicy>> {
  const record = {} as Record<TickStep, OrchestratorStepPolicy>;

  for (const step of TICK_SEQUENCE) {
    record[step] = DEFAULT_STEP_POLICY;
  }

  record.STEP_12_EVENT_SEAL = Object.freeze({
    enabled: true,
    fatalOnError: true,
    continueOnError: false,
  });

  record.STEP_13_FLUSH = Object.freeze({
    enabled: true,
    fatalOnError: false,
    continueOnError: true,
  });

  return Object.freeze(record);
}

function mergeStepConfig(
  overrides?: Partial<Record<TickStep, Partial<OrchestratorStepPolicy>>>,
): Readonly<Record<TickStep, OrchestratorStepPolicy>> {
  const merged = { ...createDefaultStepConfig() } as Record<
    TickStep,
    OrchestratorStepPolicy
  >;

  if (overrides === undefined) {
    return Object.freeze(merged);
  }

  for (const step of TICK_SEQUENCE) {
    const override = overrides[step];

    if (override === undefined) {
      continue;
    }

    merged[step] = Object.freeze({
      enabled: override.enabled ?? merged[step].enabled,
      fatalOnError: override.fatalOnError ?? merged[step].fatalOnError,
      continueOnError: override.continueOnError ?? merged[step].continueOnError,
    });
  }

  return Object.freeze(merged);
}

export function createDefaultOrchestratorConfig(): OrchestratorConfig {
  return Object.freeze({
    requiredEngineIds: DEFAULT_REQUIRED_ENGINE_IDS,
    safety: DEFAULT_SAFETY_POLICY,
    events: DEFAULT_EVENT_POLICY,
    diagnostics: DEFAULT_DIAGNOSTICS_POLICY,
    lifecycle: DEFAULT_LIFECYCLE_POLICY,
    stepConfig: createDefaultStepConfig(),
  });
}

export function mergeOrchestratorConfig(
  overrides: OrchestratorConfigOverrides = {},
): OrchestratorConfig {
  const defaults = createDefaultOrchestratorConfig();

  return Object.freeze({
    requiredEngineIds: uniqueEngineIds(
      overrides.requiredEngineIds ?? defaults.requiredEngineIds,
    ),
    safety: Object.freeze({
      maxConsecutiveTickErrors: normalizePositiveInteger(
        overrides.safety?.maxConsecutiveTickErrors ?? defaults.safety.maxConsecutiveTickErrors,
        defaults.safety.maxConsecutiveTickErrors,
      ),
      failClosedOnRegistryGap:
        overrides.safety?.failClosedOnRegistryGap ?? defaults.safety.failClosedOnRegistryGap,
      abortRunOnFatalSealError:
        overrides.safety?.abortRunOnFatalSealError ?? defaults.safety.abortRunOnFatalSealError,
      allowAdvanceWhenOutcomeAlreadySet:
        overrides.safety?.allowAdvanceWhenOutcomeAlreadySet
        ?? defaults.safety.allowAdvanceWhenOutcomeAlreadySet,
    }),
    events: Object.freeze({
      emitRunStartedImmediately:
        overrides.events?.emitRunStartedImmediately
        ?? defaults.events.emitRunStartedImmediately,
      emitTickStartedBeforeStepExecution:
        overrides.events?.emitTickStartedBeforeStepExecution
        ?? defaults.events.emitTickStartedBeforeStepExecution,
      emitTickCompletedBeforeFlush:
        overrides.events?.emitTickCompletedBeforeFlush
        ?? defaults.events.emitTickCompletedBeforeFlush,
      flushAtFinalStepOnly:
        overrides.events?.flushAtFinalStepOnly
        ?? defaults.events.flushAtFinalStepOnly,
      sealEventsBeforeFlush:
        overrides.events?.sealEventsBeforeFlush
        ?? defaults.events.sealEventsBeforeFlush,
      retainLastEventSealSnapshots: normalizePositiveInteger(
        overrides.events?.retainLastEventSealSnapshots
        ?? defaults.events.retainLastEventSealSnapshots,
        defaults.events.retainLastEventSealSnapshots,
      ),
    }),
    diagnostics: Object.freeze({
      enableTracePublishing:
        overrides.diagnostics?.enableTracePublishing
        ?? defaults.diagnostics.enableTracePublishing,
      enableHealthSnapshots:
        overrides.diagnostics?.enableHealthSnapshots
        ?? defaults.diagnostics.enableHealthSnapshots,
      retainLastTickSummaries: normalizePositiveInteger(
        overrides.diagnostics?.retainLastTickSummaries
        ?? defaults.diagnostics.retainLastTickSummaries,
        defaults.diagnostics.retainLastTickSummaries,
      ),
      retainLastErrors: normalizePositiveInteger(
        overrides.diagnostics?.retainLastErrors
        ?? defaults.diagnostics.retainLastErrors,
        defaults.diagnostics.retainLastErrors,
      ),
    }),
    lifecycle: Object.freeze({
      allowPlayCardOnlyWhenActive:
        overrides.lifecycle?.allowPlayCardOnlyWhenActive
        ?? defaults.lifecycle.allowPlayCardOnlyWhenActive,
      autoFinalizeProofOnTerminalOutcome:
        overrides.lifecycle?.autoFinalizeProofOnTerminalOutcome
        ?? defaults.lifecycle.autoFinalizeProofOnTerminalOutcome,
      forceOutcomeOnConsecutiveErrorLimit:
        overrides.lifecycle?.forceOutcomeOnConsecutiveErrorLimit
        ?? defaults.lifecycle.forceOutcomeOnConsecutiveErrorLimit,
    }),
    stepConfig: mergeStepConfig(overrides.stepConfig),
  });
}

export const ZERO_REQUIRED_ENGINE_IDS: readonly EngineId[] =
  DEFAULT_REQUIRED_ENGINE_IDS;

export const ZERO_CANONICAL_TICK_SEQUENCE: readonly TickStep[] =
  TICK_SEQUENCE;

export const ZERO_TICK_STEP_DESCRIPTOR_MAP = TICK_STEP_DESCRIPTORS;

export const ZERO_DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig =
  createDefaultOrchestratorConfig();