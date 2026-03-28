/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OrchestratorConfig.ts
 *
 * Doctrine:
 * - Engine 0 owns orchestration policy, not simulation policy
 * - config is deterministic, explicit, step-addressable, and replay-safe
 * - backend/core remains the primitive library; zero wraps it with control-tower policy
 * - defaults mirror the live backend cadence/order instead of inventing a second runtime
 * - mode and lifecycle specialization stay additive over canonical backend contracts
 */

import type { EngineId } from '../core/EngineContracts';
import type { ModeCode, RunOutcome } from '../core/GamePrimitives';
import {
  TICK_SEQUENCE,
  TICK_STEP_DESCRIPTORS,
  type TickStep,
  type TickStepDescriptor,
} from '../core/TickSequence';
import type {
  RunLifecycleState,
  StepRuntimeOwner,
  TickPlanEntry,
  TickPlanSnapshot,
  ZeroRequiredEngineDescriptor,
} from './zero.types';

// ────────────────────────────────────────────────────────────────────────────────
// foundational config surfaces
// ────────────────────────────────────────────────────────────────────────────────

export type OrchestratorConfigSeverity = 'INFO' | 'WARN' | 'ERROR';

export type OrchestratorProfileId =
  | 'default'
  | 'production'
  | 'debug'
  | 'replay'
  | 'load-test'
  | 'tournament'
  | 'integration-test';

export const ZERO_ORCHESTRATOR_PROFILE_IDS = Object.freeze([
  'default',
  'production',
  'debug',
  'replay',
  'load-test',
  'tournament',
  'integration-test',
] as const satisfies readonly OrchestratorProfileId[]);

export interface OrchestratorSafetyPolicy {
  readonly maxConsecutiveTickErrors: number;
  readonly failClosedOnRegistryGap: boolean;
  readonly abortRunOnFatalSealError: boolean;
  readonly allowAdvanceWhenOutcomeAlreadySet: boolean;
  readonly failClosedOnInvalidProfile: boolean;
  readonly failClosedOnInvalidModeOverride: boolean;
  readonly quarantineOnFlushError: boolean;
  readonly quarantineOnSealMismatch: boolean;
  readonly preserveTerminalSnapshotOnAbort: boolean;
  readonly maxAllowedSkippedStepsPerTick: number;
}

export interface OrchestratorEventPolicy {
  readonly emitRunStartedImmediately: boolean;
  readonly emitTickStartedBeforeStepExecution: boolean;
  readonly emitTickCompletedBeforeFlush: boolean;
  readonly flushAtFinalStepOnly: boolean;
  readonly sealEventsBeforeFlush: boolean;
  readonly retainLastEventSealSnapshots: number;
  readonly emitLifecycleCheckpointEvents: boolean;
  readonly emitConfigurationResolvedOnStart: boolean;
  readonly emitDiagnosticsWhenStepDisabled: boolean;
  readonly emitTerminalOutcomeBeforeFinalize: boolean;
  readonly retainLastFlushedEventBatches: number;
}

export interface OrchestratorDiagnosticsPolicy {
  readonly enableTracePublishing: boolean;
  readonly enableHealthSnapshots: boolean;
  readonly retainLastTickSummaries: number;
  readonly retainLastErrors: number;
  readonly retainLifecycleCheckpoints: number;
  readonly retainResolvedConfigs: number;
  readonly includeConfigFingerprint: boolean;
  readonly includeStepOwnerMap: boolean;
  readonly includeValidationWarnings: boolean;
  readonly includeProfileResolutionTrail: boolean;
}

export interface OrchestratorLifecyclePolicy {
  readonly allowPlayCardOnlyWhenActive: boolean;
  readonly autoFinalizeProofOnTerminalOutcome: boolean;
  readonly forceOutcomeOnConsecutiveErrorLimit: 'ABANDONED';
  readonly allowModeActionOnlyWhenActive: boolean;
  readonly allowResetFromEnded: boolean;
  readonly autoResetEventBusOnStart: boolean;
  readonly retainTickHistoryAcrossRuns: boolean;
  readonly terminalOutcomePriority: readonly RunOutcome[];
}

export interface OrchestratorStepPolicy {
  readonly enabled: boolean;
  readonly fatalOnError: boolean;
  readonly continueOnError: boolean;
  readonly owner: StepRuntimeOwner;
  readonly sealEligible: boolean;
  readonly collectSignals: boolean;
  readonly collectDiagnostics: boolean;
  readonly snapshotMutationExpected: boolean;
  readonly runModeHooksBefore: boolean;
  readonly runModeHooksAfter: boolean;
}

export interface OrchestratorModePolicy {
  readonly mode: ModeCode;
  readonly safety?: Partial<OrchestratorSafetyPolicy>;
  readonly events?: Partial<OrchestratorEventPolicy>;
  readonly diagnostics?: Partial<OrchestratorDiagnosticsPolicy>;
  readonly lifecycle?: Partial<OrchestratorLifecyclePolicy>;
  readonly stepConfig?: Partial<Record<TickStep, Partial<OrchestratorStepPolicy>>>;
  readonly notes?: readonly string[];
}

export interface OrchestratorLifecycleStatePolicy {
  readonly lifecycleState: RunLifecycleState;
  readonly safety?: Partial<OrchestratorSafetyPolicy>;
  readonly events?: Partial<OrchestratorEventPolicy>;
  readonly diagnostics?: Partial<OrchestratorDiagnosticsPolicy>;
  readonly lifecycle?: Partial<OrchestratorLifecyclePolicy>;
  readonly stepConfig?: Partial<Record<TickStep, Partial<OrchestratorStepPolicy>>>;
  readonly notes?: readonly string[];
}

export interface OrchestratorProfile {
  readonly id: OrchestratorProfileId;
  readonly label: string;
  readonly notes: readonly string[];
  readonly requiredEngineIds?: readonly EngineId[];
  readonly safety?: Partial<OrchestratorSafetyPolicy>;
  readonly events?: Partial<OrchestratorEventPolicy>;
  readonly diagnostics?: Partial<OrchestratorDiagnosticsPolicy>;
  readonly lifecycle?: Partial<OrchestratorLifecyclePolicy>;
  readonly stepConfig?: Partial<Record<TickStep, Partial<OrchestratorStepPolicy>>>;
  readonly modeOverrides?: Partial<Record<ModeCode, Partial<OrchestratorModePolicy>>>;
}

export interface OrchestratorConfigMetadata {
  readonly namespace: 'engine-zero';
  readonly version: string;
  readonly generatedFrom: 'backend/core';
  readonly canonicalTickSequenceLength: number;
  readonly supportedModes: readonly ModeCode[];
  readonly supportedProfiles: readonly OrchestratorProfileId[];
}

export interface OrchestratorStepEventExpectation {
  readonly step: TickStep;
  readonly emitsDeferredEvents: boolean;
  readonly emitsImmediateEvents: boolean;
  readonly expectedEventFamilies: readonly string[];
}

export interface OrchestratorConfig {
  readonly metadata: OrchestratorConfigMetadata;
  readonly requiredEngineIds: readonly EngineId[];
  readonly requiredEngines: readonly ZeroRequiredEngineDescriptor[];
  readonly safety: OrchestratorSafetyPolicy;
  readonly events: OrchestratorEventPolicy;
  readonly diagnostics: OrchestratorDiagnosticsPolicy;
  readonly lifecycle: OrchestratorLifecyclePolicy;
  readonly stepConfig: Readonly<Record<TickStep, OrchestratorStepPolicy>>;
  readonly modePolicies: Readonly<Record<ModeCode, OrchestratorModePolicy>>;
  readonly lifecycleStatePolicies: Readonly<Record<RunLifecycleState, OrchestratorLifecycleStatePolicy>>;
  readonly profiles: Readonly<Record<OrchestratorProfileId, OrchestratorProfile>>;
  readonly defaultProfileId: OrchestratorProfileId;
  readonly stepEventExpectations: Readonly<Record<TickStep, OrchestratorStepEventExpectation>>;
  readonly notes: readonly string[];
}

export interface OrchestratorConfigOverrides {
  readonly metadata?: Partial<OrchestratorConfigMetadata>;
  readonly requiredEngineIds?: readonly EngineId[];
  readonly requiredEngines?: readonly ZeroRequiredEngineDescriptor[];
  readonly safety?: Partial<OrchestratorSafetyPolicy>;
  readonly events?: Partial<OrchestratorEventPolicy>;
  readonly diagnostics?: Partial<OrchestratorDiagnosticsPolicy>;
  readonly lifecycle?: Partial<OrchestratorLifecyclePolicy>;
  readonly stepConfig?: Partial<Record<TickStep, Partial<OrchestratorStepPolicy>>>;
  readonly modePolicies?: Partial<Record<ModeCode, Partial<OrchestratorModePolicy>>>;
  readonly lifecycleStatePolicies?: Partial<
    Record<RunLifecycleState, Partial<OrchestratorLifecycleStatePolicy>>
  >;
  readonly profiles?: Partial<Record<OrchestratorProfileId, Partial<OrchestratorProfile>>>;
  readonly defaultProfileId?: OrchestratorProfileId;
  readonly stepEventExpectations?: Partial<
    Record<TickStep, Partial<OrchestratorStepEventExpectation>>
  >;
  readonly notes?: readonly string[];
}

export interface ResolveOrchestratorConfigInput {
  readonly config?: OrchestratorConfig;
  readonly overrides?: OrchestratorConfigOverrides;
  readonly profileId?: OrchestratorProfileId;
  readonly mode?: ModeCode;
  readonly lifecycleState?: RunLifecycleState;
  readonly outcome?: RunOutcome | null;
}

export interface OrchestratorConfigResolutionTrailEntry {
  readonly source:
    | 'default-config'
    | 'override'
    | 'profile'
    | 'mode-policy'
    | 'lifecycle-policy'
    | 'terminal-outcome';
  readonly detail: string;
}

export interface ResolvedOrchestratorStepPolicy extends OrchestratorStepPolicy {
  readonly step: TickStep;
  readonly descriptor: TickStepDescriptor;
}

export interface ResolvedOrchestratorConfig {
  readonly config: OrchestratorConfig;
  readonly resolvedProfileId: OrchestratorProfileId;
  readonly resolvedMode: ModeCode | null;
  readonly resolvedLifecycleState: RunLifecycleState | null;
  readonly safety: OrchestratorSafetyPolicy;
  readonly events: OrchestratorEventPolicy;
  readonly diagnostics: OrchestratorDiagnosticsPolicy;
  readonly lifecycle: OrchestratorLifecyclePolicy;
  readonly stepConfig: Readonly<Record<TickStep, ResolvedOrchestratorStepPolicy>>;
  readonly tickPlan: TickPlanSnapshot;
  readonly fingerprint: string;
  readonly trail: readonly OrchestratorConfigResolutionTrailEntry[];
}

export interface OrchestratorConfigIssue {
  readonly severity: OrchestratorConfigSeverity;
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface OrchestratorConfigValidationReport {
  readonly valid: boolean;
  readonly errors: readonly OrchestratorConfigIssue[];
  readonly warnings: readonly OrchestratorConfigIssue[];
  readonly fingerprint: string;
}

// ────────────────────────────────────────────────────────────────────────────────
// canonical constants from live backend shape
// ────────────────────────────────────────────────────────────────────────────────

export const ZERO_SUPPORTED_MODES = Object.freeze([
  'solo',
  'pvp',
  'coop',
  'ghost',
] as const satisfies readonly ModeCode[]);

export const ZERO_REQUIRED_ENGINE_IDS: readonly EngineId[] = Object.freeze([
  'time',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
] as const satisfies readonly EngineId[]);

export const ZERO_REQUIRED_ENGINE_DESCRIPTORS: readonly ZeroRequiredEngineDescriptor[] = Object.freeze([
  Object.freeze({
    engineId: 'time',
    critical: true,
    reason: 'Authoritative cadence, tick budgets, and decision-window expiry are owned by time.',
  }),
  Object.freeze({
    engineId: 'pressure',
    critical: true,
    reason: 'Cadence steering and downstream escalation depend on pressure being computed on every run.',
  }),
  Object.freeze({
    engineId: 'tension',
    critical: true,
    reason: 'Threat visibility and anticipation queue state must remain deterministic and backend-owned.',
  }),
  Object.freeze({
    engineId: 'shield',
    critical: true,
    reason: 'Integrity routing, passive restoration, and breach handling remain authoritative on the backend.',
  }),
  Object.freeze({
    engineId: 'battle',
    critical: true,
    reason: 'Hater bot state transitions and attack emission are sequenced through Engine 0.',
  }),
  Object.freeze({
    engineId: 'cascade',
    critical: true,
    reason: 'Chain links, recovery windows, and downstream consequence timing are backend-owned.',
  }),
  Object.freeze({
    engineId: 'sovereignty',
    critical: true,
    reason: 'Tick sealing, proof ownership, and terminal artifact authority remain backend-owned.',
  }),
]);

/**
 * ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE
 *
 * The canonical 13-step tick sequence as seen from the OrchestratorConfig layer.
 * Named distinctly from ZERO_CANONICAL_TICK_SEQUENCE (zero.types) to avoid
 * TS2308 barrel collision — both carry identical values but separate ownership.
 * Consumers that only need the sequence should import from zero.types.
 */
export const ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE: readonly TickStep[] = TICK_SEQUENCE;

export const ZERO_TICK_STEP_DESCRIPTOR_MAP: Readonly<Record<TickStep, TickStepDescriptor>> =
  TICK_STEP_DESCRIPTORS;

export const ZERO_STEP_OWNER_MAP: Readonly<Record<TickStep, StepRuntimeOwner>> = Object.freeze({
  STEP_01_PREPARE: 'system',
  STEP_02_TIME: 'time',
  STEP_03_PRESSURE: 'pressure',
  STEP_04_TENSION: 'tension',
  STEP_05_BATTLE: 'battle',
  STEP_06_SHIELD: 'shield',
  STEP_07_CASCADE: 'cascade',
  STEP_08_MODE_POST: 'mode',
  STEP_09_TELEMETRY: 'telemetry',
  STEP_10_SOVEREIGNTY_SNAPSHOT: 'sovereignty',
  STEP_11_OUTCOME_GATE: 'system',
  STEP_12_EVENT_SEAL: 'system',
  STEP_13_FLUSH: 'system',
});

export const ZERO_ENGINE_STEP_OWNERSHIP: Readonly<Record<EngineId, readonly TickStep[]>> = Object.freeze({
  time: Object.freeze(['STEP_02_TIME'] as readonly TickStep[]),
  pressure: Object.freeze(['STEP_03_PRESSURE'] as readonly TickStep[]),
  tension: Object.freeze(['STEP_04_TENSION'] as readonly TickStep[]),
  shield: Object.freeze(['STEP_06_SHIELD'] as readonly TickStep[]),
  battle: Object.freeze(['STEP_05_BATTLE'] as readonly TickStep[]),
  cascade: Object.freeze(['STEP_07_CASCADE'] as readonly TickStep[]),
  sovereignty: Object.freeze(['STEP_10_SOVEREIGNTY_SNAPSHOT'] as readonly TickStep[]),
});

export const ZERO_TERMINAL_OUTCOME_PRIORITY: readonly RunOutcome[] = Object.freeze([
  'FREEDOM',
  'BANKRUPT',
  'TIMEOUT',
  'ABANDONED',
] as const satisfies readonly RunOutcome[]);

export const ZERO_STEP_EVENT_EXPECTATIONS: Readonly<
  Record<TickStep, OrchestratorStepEventExpectation>
> = Object.freeze({
  STEP_01_PREPARE: Object.freeze({
    step: 'STEP_01_PREPARE',
    emitsDeferredEvents: false,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['trace', 'run-context']),
  }),
  STEP_02_TIME: Object.freeze({
    step: 'STEP_02_TIME',
    emitsDeferredEvents: true,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['tick', 'decision-window', 'timeout-warning']),
  }),
  STEP_03_PRESSURE: Object.freeze({
    step: 'STEP_03_PRESSURE',
    emitsDeferredEvents: true,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['pressure', 'tier-shift', 'critical-crossing']),
  }),
  STEP_04_TENSION: Object.freeze({
    step: 'STEP_04_TENSION',
    emitsDeferredEvents: true,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['tension', 'threat-queue', 'visibility']),
  }),
  STEP_05_BATTLE: Object.freeze({
    step: 'STEP_05_BATTLE',
    emitsDeferredEvents: true,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['bot-state', 'counter-intel', 'budget']),
  }),
  STEP_06_SHIELD: Object.freeze({
    step: 'STEP_06_SHIELD',
    emitsDeferredEvents: true,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['shield', 'breach', 'damage']),
  }),
  STEP_07_CASCADE: Object.freeze({
    step: 'STEP_07_CASCADE',
    emitsDeferredEvents: true,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['cascade', 'recovery', 'link-fire']),
  }),
  STEP_08_MODE_POST: Object.freeze({
    step: 'STEP_08_MODE_POST',
    emitsDeferredEvents: true,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['mode-post', 'mode-reconcile']),
  }),
  STEP_09_TELEMETRY: Object.freeze({
    step: 'STEP_09_TELEMETRY',
    emitsDeferredEvents: false,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['telemetry', 'trace-publish']),
  }),
  STEP_10_SOVEREIGNTY_SNAPSHOT: Object.freeze({
    step: 'STEP_10_SOVEREIGNTY_SNAPSHOT',
    emitsDeferredEvents: true,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['sovereignty', 'tick-proof']),
  }),
  STEP_11_OUTCOME_GATE: Object.freeze({
    step: 'STEP_11_OUTCOME_GATE',
    emitsDeferredEvents: true,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['terminal-check', 'outcome-gate']),
  }),
  STEP_12_EVENT_SEAL: Object.freeze({
    step: 'STEP_12_EVENT_SEAL',
    emitsDeferredEvents: false,
    emitsImmediateEvents: true,
    expectedEventFamilies: Object.freeze(['seal', 'checksum', 'integrity-warning']),
  }),
  STEP_13_FLUSH: Object.freeze({
    step: 'STEP_13_FLUSH',
    emitsDeferredEvents: false,
    emitsImmediateEvents: false,
    expectedEventFamilies: Object.freeze(['flush', 'delivery', 'subscriber-update']),
  }),
});

// ────────────────────────────────────────────────────────────────────────────────
// defaults
// ────────────────────────────────────────────────────────────────────────────────

const DEFAULT_METADATA: OrchestratorConfigMetadata = Object.freeze({
  namespace: 'engine-zero',
  version: '2.0.0',
  generatedFrom: 'backend/core',
  canonicalTickSequenceLength: TICK_SEQUENCE.length,
  supportedModes: ZERO_SUPPORTED_MODES,
  supportedProfiles: ZERO_ORCHESTRATOR_PROFILE_IDS,
});

const DEFAULT_SAFETY_POLICY: OrchestratorSafetyPolicy = Object.freeze({
  maxConsecutiveTickErrors: 5,
  failClosedOnRegistryGap: true,
  abortRunOnFatalSealError: true,
  allowAdvanceWhenOutcomeAlreadySet: false,
  failClosedOnInvalidProfile: true,
  failClosedOnInvalidModeOverride: true,
  quarantineOnFlushError: true,
  quarantineOnSealMismatch: true,
  preserveTerminalSnapshotOnAbort: true,
  maxAllowedSkippedStepsPerTick: 1,
});

const DEFAULT_EVENT_POLICY: OrchestratorEventPolicy = Object.freeze({
  emitRunStartedImmediately: true,
  emitTickStartedBeforeStepExecution: true,
  emitTickCompletedBeforeFlush: true,
  flushAtFinalStepOnly: true,
  sealEventsBeforeFlush: true,
  retainLastEventSealSnapshots: 64,
  emitLifecycleCheckpointEvents: true,
  emitConfigurationResolvedOnStart: true,
  emitDiagnosticsWhenStepDisabled: true,
  emitTerminalOutcomeBeforeFinalize: true,
  retainLastFlushedEventBatches: 24,
});

const DEFAULT_DIAGNOSTICS_POLICY: OrchestratorDiagnosticsPolicy = Object.freeze({
  enableTracePublishing: true,
  enableHealthSnapshots: true,
  retainLastTickSummaries: 50,
  retainLastErrors: 100,
  retainLifecycleCheckpoints: 100,
  retainResolvedConfigs: 32,
  includeConfigFingerprint: true,
  includeStepOwnerMap: true,
  includeValidationWarnings: true,
  includeProfileResolutionTrail: true,
});

const DEFAULT_LIFECYCLE_POLICY: OrchestratorLifecyclePolicy = Object.freeze({
  allowPlayCardOnlyWhenActive: true,
  autoFinalizeProofOnTerminalOutcome: true,
  forceOutcomeOnConsecutiveErrorLimit: 'ABANDONED',
  allowModeActionOnlyWhenActive: true,
  allowResetFromEnded: true,
  autoResetEventBusOnStart: true,
  retainTickHistoryAcrossRuns: false,
  terminalOutcomePriority: ZERO_TERMINAL_OUTCOME_PRIORITY,
});

const DEFAULT_STEP_POLICY: Omit<OrchestratorStepPolicy, 'owner'> = Object.freeze({
  enabled: true,
  fatalOnError: false,
  continueOnError: true,
  sealEligible: true,
  collectSignals: true,
  collectDiagnostics: true,
  snapshotMutationExpected: true,
  runModeHooksBefore: false,
  runModeHooksAfter: false,
});

// ────────────────────────────────────────────────────────────────────────────────
// generic helpers
// ────────────────────────────────────────────────────────────────────────────────

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function freezeRecord<T extends Record<string, unknown>>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(value));
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(value));
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

function uniqueStrings(values: readonly string[]): readonly string[] {
  return freezeArray([...new Set(values)]);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function simpleFingerprint(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `zero-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function mergeStringNotes(
  ...groups: ReadonlyArray<readonly string[] | undefined>
): readonly string[] {
  const collected: string[] = [];

  for (const group of groups) {
    if (!group) {
      continue;
    }
    for (const note of group) {
      if (typeof note === 'string' && note.trim().length > 0) {
        collected.push(note.trim());
      }
    }
  }

  return uniqueStrings(collected);
}

function createRequiredEngineDescriptorMap(
  descriptors: readonly ZeroRequiredEngineDescriptor[],
): Readonly<Record<EngineId, ZeroRequiredEngineDescriptor>> {
  const record = {} as Record<EngineId, ZeroRequiredEngineDescriptor>;

  for (const descriptor of descriptors) {
    record[descriptor.engineId] = Object.freeze({ ...descriptor });
  }

  return Object.freeze(record);
}

// ────────────────────────────────────────────────────────────────────────────────
// step policy builders
// ────────────────────────────────────────────────────────────────────────────────

function createBaseStepPolicy(step: TickStep): OrchestratorStepPolicy {
  const owner = ZERO_STEP_OWNER_MAP[step];
  const isPrepare = step === 'STEP_01_PREPARE';
  const isTelemetry = step === 'STEP_09_TELEMETRY';
  const isOutcomeGate = step === 'STEP_11_OUTCOME_GATE';
  const isSeal = step === 'STEP_12_EVENT_SEAL';
  const isFlush = step === 'STEP_13_FLUSH';
  const isModePost = step === 'STEP_08_MODE_POST';

  // Spread DEFAULT_STEP_POLICY as the base layer, then overlay per-step overrides.
  // This ensures all defaults are applied uniformly and DEFAULT_STEP_POLICY remains
  // the single source of truth for baseline step behavior.
  return Object.freeze({
    ...DEFAULT_STEP_POLICY,
    owner,
    fatalOnError: isSeal,
    continueOnError: !isSeal,
    sealEligible: !isFlush,
    collectSignals: !isFlush,
    snapshotMutationExpected: !isTelemetry,
    runModeHooksBefore: isPrepare,
    runModeHooksAfter: isModePost || isOutcomeGate,
  });
}

function createDefaultStepConfig(): Readonly<Record<TickStep, OrchestratorStepPolicy>> {
  const record = {} as Record<TickStep, OrchestratorStepPolicy>;

  for (const step of TICK_SEQUENCE) {
    record[step] = createBaseStepPolicy(step);
  }

  record.STEP_09_TELEMETRY = Object.freeze({
    ...record.STEP_09_TELEMETRY,
    snapshotMutationExpected: false,
    sealEligible: false,
  });

  record.STEP_12_EVENT_SEAL = Object.freeze({
    ...record.STEP_12_EVENT_SEAL,
    enabled: true,
    fatalOnError: true,
    continueOnError: false,
    sealEligible: false,
  });

  record.STEP_13_FLUSH = Object.freeze({
    ...record.STEP_13_FLUSH,
    enabled: true,
    fatalOnError: false,
    continueOnError: true,
    sealEligible: false,
    collectSignals: false,
    snapshotMutationExpected: false,
  });

  return Object.freeze(record);
}

function mergeStepPolicy(
  base: OrchestratorStepPolicy,
  override?: Partial<OrchestratorStepPolicy>,
): OrchestratorStepPolicy {
  if (override === undefined) {
    return base;
  }

  return Object.freeze({
    enabled: override.enabled ?? base.enabled,
    fatalOnError: override.fatalOnError ?? base.fatalOnError,
    continueOnError: override.continueOnError ?? base.continueOnError,
    owner: override.owner ?? base.owner,
    sealEligible: override.sealEligible ?? base.sealEligible,
    collectSignals: override.collectSignals ?? base.collectSignals,
    collectDiagnostics: override.collectDiagnostics ?? base.collectDiagnostics,
    snapshotMutationExpected:
      override.snapshotMutationExpected ?? base.snapshotMutationExpected,
    runModeHooksBefore: override.runModeHooksBefore ?? base.runModeHooksBefore,
    runModeHooksAfter: override.runModeHooksAfter ?? base.runModeHooksAfter,
  });
}

function mergeStepConfig(
  base: Readonly<Record<TickStep, OrchestratorStepPolicy>>,
  overrides?: Partial<Record<TickStep, Partial<OrchestratorStepPolicy>>>,
): Readonly<Record<TickStep, OrchestratorStepPolicy>> {
  const merged = {} as Record<TickStep, OrchestratorStepPolicy>;

  for (const step of TICK_SEQUENCE) {
    merged[step] = mergeStepPolicy(base[step], overrides?.[step]);
  }

  return Object.freeze(merged);
}

// ────────────────────────────────────────────────────────────────────────────────
// policy mergers
// ────────────────────────────────────────────────────────────────────────────────

function mergeSafetyPolicy(
  base: OrchestratorSafetyPolicy,
  override?: Partial<OrchestratorSafetyPolicy>,
): OrchestratorSafetyPolicy {
  return Object.freeze({
    maxConsecutiveTickErrors: normalizePositiveInteger(
      override?.maxConsecutiveTickErrors,
      base.maxConsecutiveTickErrors,
    ),
    failClosedOnRegistryGap:
      override?.failClosedOnRegistryGap ?? base.failClosedOnRegistryGap,
    abortRunOnFatalSealError:
      override?.abortRunOnFatalSealError ?? base.abortRunOnFatalSealError,
    allowAdvanceWhenOutcomeAlreadySet:
      override?.allowAdvanceWhenOutcomeAlreadySet
      ?? base.allowAdvanceWhenOutcomeAlreadySet,
    failClosedOnInvalidProfile:
      override?.failClosedOnInvalidProfile ?? base.failClosedOnInvalidProfile,
    failClosedOnInvalidModeOverride:
      override?.failClosedOnInvalidModeOverride
      ?? base.failClosedOnInvalidModeOverride,
    quarantineOnFlushError:
      override?.quarantineOnFlushError ?? base.quarantineOnFlushError,
    quarantineOnSealMismatch:
      override?.quarantineOnSealMismatch ?? base.quarantineOnSealMismatch,
    preserveTerminalSnapshotOnAbort:
      override?.preserveTerminalSnapshotOnAbort
      ?? base.preserveTerminalSnapshotOnAbort,
    maxAllowedSkippedStepsPerTick: normalizeNonNegativeInteger(
      override?.maxAllowedSkippedStepsPerTick,
      base.maxAllowedSkippedStepsPerTick,
    ),
  });
}

function mergeEventPolicy(
  base: OrchestratorEventPolicy,
  override?: Partial<OrchestratorEventPolicy>,
): OrchestratorEventPolicy {
  return Object.freeze({
    emitRunStartedImmediately:
      override?.emitRunStartedImmediately ?? base.emitRunStartedImmediately,
    emitTickStartedBeforeStepExecution:
      override?.emitTickStartedBeforeStepExecution
      ?? base.emitTickStartedBeforeStepExecution,
    emitTickCompletedBeforeFlush:
      override?.emitTickCompletedBeforeFlush ?? base.emitTickCompletedBeforeFlush,
    flushAtFinalStepOnly:
      override?.flushAtFinalStepOnly ?? base.flushAtFinalStepOnly,
    sealEventsBeforeFlush:
      override?.sealEventsBeforeFlush ?? base.sealEventsBeforeFlush,
    retainLastEventSealSnapshots: normalizePositiveInteger(
      override?.retainLastEventSealSnapshots,
      base.retainLastEventSealSnapshots,
    ),
    emitLifecycleCheckpointEvents:
      override?.emitLifecycleCheckpointEvents
      ?? base.emitLifecycleCheckpointEvents,
    emitConfigurationResolvedOnStart:
      override?.emitConfigurationResolvedOnStart
      ?? base.emitConfigurationResolvedOnStart,
    emitDiagnosticsWhenStepDisabled:
      override?.emitDiagnosticsWhenStepDisabled
      ?? base.emitDiagnosticsWhenStepDisabled,
    emitTerminalOutcomeBeforeFinalize:
      override?.emitTerminalOutcomeBeforeFinalize
      ?? base.emitTerminalOutcomeBeforeFinalize,
    retainLastFlushedEventBatches: normalizePositiveInteger(
      override?.retainLastFlushedEventBatches,
      base.retainLastFlushedEventBatches,
    ),
  });
}

function mergeDiagnosticsPolicy(
  base: OrchestratorDiagnosticsPolicy,
  override?: Partial<OrchestratorDiagnosticsPolicy>,
): OrchestratorDiagnosticsPolicy {
  return Object.freeze({
    enableTracePublishing:
      override?.enableTracePublishing ?? base.enableTracePublishing,
    enableHealthSnapshots:
      override?.enableHealthSnapshots ?? base.enableHealthSnapshots,
    retainLastTickSummaries: normalizePositiveInteger(
      override?.retainLastTickSummaries,
      base.retainLastTickSummaries,
    ),
    retainLastErrors: normalizePositiveInteger(
      override?.retainLastErrors,
      base.retainLastErrors,
    ),
    retainLifecycleCheckpoints: normalizePositiveInteger(
      override?.retainLifecycleCheckpoints,
      base.retainLifecycleCheckpoints,
    ),
    retainResolvedConfigs: normalizePositiveInteger(
      override?.retainResolvedConfigs,
      base.retainResolvedConfigs,
    ),
    includeConfigFingerprint:
      override?.includeConfigFingerprint ?? base.includeConfigFingerprint,
    includeStepOwnerMap:
      override?.includeStepOwnerMap ?? base.includeStepOwnerMap,
    includeValidationWarnings:
      override?.includeValidationWarnings ?? base.includeValidationWarnings,
    includeProfileResolutionTrail:
      override?.includeProfileResolutionTrail ?? base.includeProfileResolutionTrail,
  });
}

function normalizeTerminalOutcomePriority(
  value: readonly RunOutcome[] | undefined,
  fallback: readonly RunOutcome[],
): readonly RunOutcome[] {
  if (!value || value.length === 0) {
    return fallback;
  }

  const normalized = uniqueStrings(value as readonly string[]);
  const ordered: RunOutcome[] = [];

  for (const outcome of ZERO_TERMINAL_OUTCOME_PRIORITY) {
    if (normalized.includes(outcome)) {
      ordered.push(outcome);
    }
  }

  return ordered.length > 0 ? freezeArray(ordered) : fallback;
}

function mergeLifecyclePolicy(
  base: OrchestratorLifecyclePolicy,
  override?: Partial<OrchestratorLifecyclePolicy>,
): OrchestratorLifecyclePolicy {
  return Object.freeze({
    allowPlayCardOnlyWhenActive:
      override?.allowPlayCardOnlyWhenActive ?? base.allowPlayCardOnlyWhenActive,
    autoFinalizeProofOnTerminalOutcome:
      override?.autoFinalizeProofOnTerminalOutcome
      ?? base.autoFinalizeProofOnTerminalOutcome,
    forceOutcomeOnConsecutiveErrorLimit:
      override?.forceOutcomeOnConsecutiveErrorLimit
      ?? base.forceOutcomeOnConsecutiveErrorLimit,
    allowModeActionOnlyWhenActive:
      override?.allowModeActionOnlyWhenActive ?? base.allowModeActionOnlyWhenActive,
    allowResetFromEnded:
      override?.allowResetFromEnded ?? base.allowResetFromEnded,
    autoResetEventBusOnStart:
      override?.autoResetEventBusOnStart ?? base.autoResetEventBusOnStart,
    retainTickHistoryAcrossRuns:
      override?.retainTickHistoryAcrossRuns ?? base.retainTickHistoryAcrossRuns,
    terminalOutcomePriority: normalizeTerminalOutcomePriority(
      override?.terminalOutcomePriority,
      base.terminalOutcomePriority,
    ),
  });
}

function mergeEventExpectation(
  base: OrchestratorStepEventExpectation,
  override?: Partial<OrchestratorStepEventExpectation>,
): OrchestratorStepEventExpectation {
  if (!override) {
    return base;
  }

  return Object.freeze({
    step: base.step,
    emitsDeferredEvents:
      override.emitsDeferredEvents ?? base.emitsDeferredEvents,
    emitsImmediateEvents:
      override.emitsImmediateEvents ?? base.emitsImmediateEvents,
    expectedEventFamilies: uniqueStrings(
      override.expectedEventFamilies ?? base.expectedEventFamilies,
    ),
  });
}

function mergeEventExpectationMap(
  base: Readonly<Record<TickStep, OrchestratorStepEventExpectation>>,
  overrides?: Partial<Record<TickStep, Partial<OrchestratorStepEventExpectation>>>,
): Readonly<Record<TickStep, OrchestratorStepEventExpectation>> {
  const merged = {} as Record<TickStep, OrchestratorStepEventExpectation>;

  for (const step of TICK_SEQUENCE) {
    merged[step] = mergeEventExpectation(base[step], overrides?.[step]);
  }

  return Object.freeze(merged);
}

// ────────────────────────────────────────────────────────────────────────────────
// default mode policies
// ────────────────────────────────────────────────────────────────────────────────

function createDefaultModePolicy(mode: ModeCode): OrchestratorModePolicy {
  switch (mode) {
    case 'solo':
      return Object.freeze({
        mode,
        notes: Object.freeze([
          'Solo defaults stay closest to canonical single-run orchestration.',
          'No extra runtime relaxations are introduced beyond backend defaults.',
        ]),
      });
    case 'pvp':
      return Object.freeze({
        mode,
        safety: Object.freeze({
          maxConsecutiveTickErrors: 4,
          quarantineOnSealMismatch: true,
        }),
        events: Object.freeze({
          retainLastEventSealSnapshots: 96,
          retainLastFlushedEventBatches: 48,
        }),
        diagnostics: Object.freeze({
          retainLastTickSummaries: 96,
          includeProfileResolutionTrail: true,
        }),
        notes: Object.freeze([
          'PvP retains deeper event and tick history for duel-grade adjudication.',
          'Seal mismatches remain fail-closed because competitive outcomes must be defensible.',
        ]),
      });
    case 'coop':
      return Object.freeze({
        mode,
        diagnostics: Object.freeze({
          enableHealthSnapshots: true,
          retainLifecycleCheckpoints: 128,
        }),
        events: Object.freeze({
          emitLifecycleCheckpointEvents: true,
        }),
        notes: Object.freeze([
          'Co-op emphasizes lifecycle visibility because multiple actors depend on synchronized state.',
        ]),
      });
    case 'ghost':
      return Object.freeze({
        mode,
        diagnostics: Object.freeze({
          enableTracePublishing: true,
          retainResolvedConfigs: 64,
        }),
        events: Object.freeze({
          retainLastEventSealSnapshots: 96,
        }),
        notes: Object.freeze([
          'Ghost runs bias toward replay and trace visibility for divergence inspection.',
        ]),
      });
    default:
      return Object.freeze({ mode, notes: Object.freeze([]) });
  }
}

function createDefaultModePolicies(): Readonly<Record<ModeCode, OrchestratorModePolicy>> {
  return Object.freeze({
    solo: createDefaultModePolicy('solo'),
    pvp: createDefaultModePolicy('pvp'),
    coop: createDefaultModePolicy('coop'),
    ghost: createDefaultModePolicy('ghost'),
  });
}

function mergeModePolicy(
  base: OrchestratorModePolicy,
  override?: Partial<OrchestratorModePolicy>,
): OrchestratorModePolicy {
  if (!override) {
    return base;
  }

  return Object.freeze({
    mode: base.mode,
    safety: override.safety ? Object.freeze({ ...(base.safety ?? {}), ...override.safety }) : base.safety,
    events: override.events ? Object.freeze({ ...(base.events ?? {}), ...override.events }) : base.events,
    diagnostics: override.diagnostics
      ? Object.freeze({ ...(base.diagnostics ?? {}), ...override.diagnostics })
      : base.diagnostics,
    lifecycle: override.lifecycle
      ? Object.freeze({ ...(base.lifecycle ?? {}), ...override.lifecycle })
      : base.lifecycle,
    stepConfig: override.stepConfig
      ? Object.freeze({ ...(base.stepConfig ?? {}), ...override.stepConfig })
      : base.stepConfig,
    notes: mergeStringNotes(base.notes, override.notes),
  });
}

function mergeModePolicies(
  base: Readonly<Record<ModeCode, OrchestratorModePolicy>>,
  overrides?: Partial<Record<ModeCode, Partial<OrchestratorModePolicy>>>,
): Readonly<Record<ModeCode, OrchestratorModePolicy>> {
  return Object.freeze({
    solo: mergeModePolicy(base.solo, overrides?.solo),
    pvp: mergeModePolicy(base.pvp, overrides?.pvp),
    coop: mergeModePolicy(base.coop, overrides?.coop),
    ghost: mergeModePolicy(base.ghost, overrides?.ghost),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// default lifecycle-state policies
// ────────────────────────────────────────────────────────────────────────────────

function createDefaultLifecycleStatePolicy(
  lifecycleState: RunLifecycleState,
): OrchestratorLifecycleStatePolicy {
  switch (lifecycleState) {
    case 'IDLE':
      return Object.freeze({
        lifecycleState,
        lifecycle: Object.freeze({
          allowPlayCardOnlyWhenActive: true,
          allowModeActionOnlyWhenActive: true,
        }),
        stepConfig: Object.freeze({
          STEP_02_TIME: Object.freeze({ enabled: false }),
          STEP_03_PRESSURE: Object.freeze({ enabled: false }),
          STEP_04_TENSION: Object.freeze({ enabled: false }),
          STEP_05_BATTLE: Object.freeze({ enabled: false }),
          STEP_06_SHIELD: Object.freeze({ enabled: false }),
          STEP_07_CASCADE: Object.freeze({ enabled: false }),
          STEP_08_MODE_POST: Object.freeze({ enabled: false }),
          STEP_09_TELEMETRY: Object.freeze({ enabled: false }),
          STEP_10_SOVEREIGNTY_SNAPSHOT: Object.freeze({ enabled: false }),
          STEP_11_OUTCOME_GATE: Object.freeze({ enabled: false }),
        }),
        notes: Object.freeze([
          'Idle policy prevents tick advancement and runtime-side gameplay calls.',
        ]),
      });
    case 'STARTING':
      return Object.freeze({
        lifecycleState,
        diagnostics: Object.freeze({ enableHealthSnapshots: true }),
        notes: Object.freeze([
          'Starting policy preserves diagnostics while engines are bootstrapped and validated.',
        ]),
      });
    case 'ACTIVE':
      return Object.freeze({
        lifecycleState,
        notes: Object.freeze([
          'Active policy is the normal runtime lane with all canonical steps enabled.',
        ]),
      });
    case 'TICK_LOCKED':
      return Object.freeze({
        lifecycleState,
        lifecycle: Object.freeze({
          allowPlayCardOnlyWhenActive: true,
          allowModeActionOnlyWhenActive: true,
        }),
        events: Object.freeze({ emitLifecycleCheckpointEvents: true }),
        notes: Object.freeze([
          'Tick-locked policy assumes external mutation lanes are closed while Engine 0 is sequencing.',
        ]),
      });
    case 'ENDING':
      return Object.freeze({
        lifecycleState,
        events: Object.freeze({ emitTerminalOutcomeBeforeFinalize: true }),
        diagnostics: Object.freeze({ includeProfileResolutionTrail: true }),
        notes: Object.freeze([
          'Ending policy favors terminal visibility and proof closure over runtime interactivity.',
        ]),
      });
    case 'ENDED':
      return Object.freeze({
        lifecycleState,
        lifecycle: Object.freeze({
          allowPlayCardOnlyWhenActive: true,
          allowModeActionOnlyWhenActive: true,
          allowResetFromEnded: true,
        }),
        notes: Object.freeze([
          'Ended policy leaves only inspection and reset-adjacent behavior available.',
        ]),
      });
    default:
      return Object.freeze({ lifecycleState, notes: Object.freeze([]) });
  }
}

function createDefaultLifecycleStatePolicies(): Readonly<
  Record<RunLifecycleState, OrchestratorLifecycleStatePolicy>
> {
  return Object.freeze({
    IDLE: createDefaultLifecycleStatePolicy('IDLE'),
    STARTING: createDefaultLifecycleStatePolicy('STARTING'),
    ACTIVE: createDefaultLifecycleStatePolicy('ACTIVE'),
    TICK_LOCKED: createDefaultLifecycleStatePolicy('TICK_LOCKED'),
    ENDING: createDefaultLifecycleStatePolicy('ENDING'),
    ENDED: createDefaultLifecycleStatePolicy('ENDED'),
  });
}

function mergeLifecycleStatePolicy(
  base: OrchestratorLifecycleStatePolicy,
  override?: Partial<OrchestratorLifecycleStatePolicy>,
): OrchestratorLifecycleStatePolicy {
  if (!override) {
    return base;
  }

  return Object.freeze({
    lifecycleState: base.lifecycleState,
    safety: override.safety ? Object.freeze({ ...(base.safety ?? {}), ...override.safety }) : base.safety,
    events: override.events ? Object.freeze({ ...(base.events ?? {}), ...override.events }) : base.events,
    diagnostics: override.diagnostics
      ? Object.freeze({ ...(base.diagnostics ?? {}), ...override.diagnostics })
      : base.diagnostics,
    lifecycle: override.lifecycle
      ? Object.freeze({ ...(base.lifecycle ?? {}), ...override.lifecycle })
      : base.lifecycle,
    stepConfig: override.stepConfig
      ? Object.freeze({ ...(base.stepConfig ?? {}), ...override.stepConfig })
      : base.stepConfig,
    notes: mergeStringNotes(base.notes, override.notes),
  });
}

function mergeLifecycleStatePolicies(
  base: Readonly<Record<RunLifecycleState, OrchestratorLifecycleStatePolicy>>,
  overrides?: Partial<Record<RunLifecycleState, Partial<OrchestratorLifecycleStatePolicy>>>,
): Readonly<Record<RunLifecycleState, OrchestratorLifecycleStatePolicy>> {
  return Object.freeze({
    IDLE: mergeLifecycleStatePolicy(base.IDLE, overrides?.IDLE),
    STARTING: mergeLifecycleStatePolicy(base.STARTING, overrides?.STARTING),
    ACTIVE: mergeLifecycleStatePolicy(base.ACTIVE, overrides?.ACTIVE),
    TICK_LOCKED: mergeLifecycleStatePolicy(base.TICK_LOCKED, overrides?.TICK_LOCKED),
    ENDING: mergeLifecycleStatePolicy(base.ENDING, overrides?.ENDING),
    ENDED: mergeLifecycleStatePolicy(base.ENDED, overrides?.ENDED),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// profiles
// ────────────────────────────────────────────────────────────────────────────────

function createDefaultProfiles(): Readonly<Record<OrchestratorProfileId, OrchestratorProfile>> {
  return Object.freeze({
    default: Object.freeze({
      id: 'default',
      label: 'Default Zero Runtime',
      notes: Object.freeze([
        'Balanced authoritative orchestration profile matching canonical backend defaults.',
      ]),
    }),
    production: Object.freeze({
      id: 'production',
      label: 'Production Authority',
      notes: Object.freeze([
        'Production profile favors strict sealing, fail-closed validation, and durable diagnostics.',
      ]),
      safety: Object.freeze({
        failClosedOnRegistryGap: true,
        abortRunOnFatalSealError: true,
        quarantineOnSealMismatch: true,
        quarantineOnFlushError: true,
      }),
      diagnostics: Object.freeze({
        includeValidationWarnings: true,
        includeConfigFingerprint: true,
      }),
    }),
    debug: Object.freeze({
      id: 'debug',
      label: 'Debug / Inspection',
      notes: Object.freeze([
        'Debug profile retains more diagnostics and resolution history for local inspection.',
      ]),
      diagnostics: Object.freeze({
        retainLastTickSummaries: 200,
        retainLastErrors: 300,
        retainResolvedConfigs: 128,
        includeProfileResolutionTrail: true,
      }),
      events: Object.freeze({
        emitDiagnosticsWhenStepDisabled: true,
        retainLastEventSealSnapshots: 128,
      }),
    }),
    replay: Object.freeze({
      id: 'replay',
      label: 'Replay / Audit',
      notes: Object.freeze([
        'Replay profile biases toward trace retention and stable fingerprint visibility.',
      ]),
      diagnostics: Object.freeze({
        enableTracePublishing: true,
        retainLastTickSummaries: 256,
        includeConfigFingerprint: true,
      }),
      events: Object.freeze({
        retainLastEventSealSnapshots: 160,
        retainLastFlushedEventBatches: 96,
      }),
    }),
    'load-test': Object.freeze({
      id: 'load-test',
      label: 'Load Test Throughput',
      notes: Object.freeze([
        'Load-test profile trims retention while preserving canonical sequence and seal behavior.',
      ]),
      diagnostics: Object.freeze({
        retainLastTickSummaries: 16,
        retainLastErrors: 32,
        retainResolvedConfigs: 8,
      }),
      events: Object.freeze({
        retainLastEventSealSnapshots: 16,
        retainLastFlushedEventBatches: 8,
      }),
    }),
    tournament: Object.freeze({
      id: 'tournament',
      label: 'Tournament Integrity',
      notes: Object.freeze([
        'Tournament profile is the strictest competitive lane and emphasizes auditability.',
      ]),
      safety: Object.freeze({
        maxConsecutiveTickErrors: 3,
        abortRunOnFatalSealError: true,
        failClosedOnRegistryGap: true,
        quarantineOnSealMismatch: true,
      }),
      diagnostics: Object.freeze({
        retainLastTickSummaries: 128,
        retainLastErrors: 256,
      }),
      events: Object.freeze({
        retainLastEventSealSnapshots: 192,
        emitTerminalOutcomeBeforeFinalize: true,
      }),
    }),
    'integration-test': Object.freeze({
      id: 'integration-test',
      label: 'Integration Test Harness',
      notes: Object.freeze([
        'Integration-test profile keeps deterministic defaults while improving observability for harnesses.',
      ]),
      diagnostics: Object.freeze({
        enableHealthSnapshots: true,
        includeValidationWarnings: true,
        retainResolvedConfigs: 64,
      }),
      events: Object.freeze({
        emitConfigurationResolvedOnStart: true,
        retainLastFlushedEventBatches: 32,
      }),
    }),
  });
}

function mergeProfile(
  base: OrchestratorProfile,
  override?: Partial<OrchestratorProfile>,
): OrchestratorProfile {
  if (!override) {
    return base;
  }

  return Object.freeze({
    id: base.id,
    label: override.label ?? base.label,
    notes: mergeStringNotes(base.notes, override.notes),
    requiredEngineIds: override.requiredEngineIds
      ? uniqueEngineIds(override.requiredEngineIds)
      : base.requiredEngineIds,
    safety: override.safety ? Object.freeze({ ...(base.safety ?? {}), ...override.safety }) : base.safety,
    events: override.events ? Object.freeze({ ...(base.events ?? {}), ...override.events }) : base.events,
    diagnostics: override.diagnostics
      ? Object.freeze({ ...(base.diagnostics ?? {}), ...override.diagnostics })
      : base.diagnostics,
    lifecycle: override.lifecycle
      ? Object.freeze({ ...(base.lifecycle ?? {}), ...override.lifecycle })
      : base.lifecycle,
    stepConfig: override.stepConfig
      ? Object.freeze({ ...(base.stepConfig ?? {}), ...override.stepConfig })
      : base.stepConfig,
    modeOverrides: override.modeOverrides
      ? Object.freeze({ ...(base.modeOverrides ?? {}), ...override.modeOverrides })
      : base.modeOverrides,
  });
}

function mergeProfiles(
  base: Readonly<Record<OrchestratorProfileId, OrchestratorProfile>>,
  overrides?: Partial<Record<OrchestratorProfileId, Partial<OrchestratorProfile>>>,
): Readonly<Record<OrchestratorProfileId, OrchestratorProfile>> {
  return Object.freeze({
    default: mergeProfile(base.default, overrides?.default),
    production: mergeProfile(base.production, overrides?.production),
    debug: mergeProfile(base.debug, overrides?.debug),
    replay: mergeProfile(base.replay, overrides?.replay),
    'load-test': mergeProfile(base['load-test'], overrides?.['load-test']),
    tournament: mergeProfile(base.tournament, overrides?.tournament),
    'integration-test': mergeProfile(base['integration-test'], overrides?.['integration-test']),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// default config factory
// ────────────────────────────────────────────────────────────────────────────────

export function createDefaultOrchestratorConfig(): OrchestratorConfig {
  return Object.freeze({
    metadata: DEFAULT_METADATA,
    requiredEngineIds: ZERO_REQUIRED_ENGINE_IDS,
    requiredEngines: ZERO_REQUIRED_ENGINE_DESCRIPTORS,
    safety: DEFAULT_SAFETY_POLICY,
    events: DEFAULT_EVENT_POLICY,
    diagnostics: DEFAULT_DIAGNOSTICS_POLICY,
    lifecycle: DEFAULT_LIFECYCLE_POLICY,
    stepConfig: createDefaultStepConfig(),
    modePolicies: createDefaultModePolicies(),
    lifecycleStatePolicies: createDefaultLifecycleStatePolicies(),
    profiles: createDefaultProfiles(),
    defaultProfileId: 'default',
    stepEventExpectations: ZERO_STEP_EVENT_EXPECTATIONS,
    notes: Object.freeze([
      'Canonical Engine 0 config aligned to live backend/core cadence and step order.',
      'Zero config remains orchestration policy only; simulation policy stays in the engines.',
    ]),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// main config merge
// ────────────────────────────────────────────────────────────────────────────────

function mergeMetadata(
  base: OrchestratorConfigMetadata,
  override?: Partial<OrchestratorConfigMetadata>,
): OrchestratorConfigMetadata {
  return Object.freeze({
    namespace: 'engine-zero',
    version: override?.version ?? base.version,
    generatedFrom: 'backend/core',
    canonicalTickSequenceLength: TICK_SEQUENCE.length,
    supportedModes: freezeArray(override?.supportedModes ?? base.supportedModes),
    supportedProfiles: freezeArray(override?.supportedProfiles ?? base.supportedProfiles),
  });
}

function mergeRequiredEngines(
  requiredEngineIds: readonly EngineId[],
  requiredEngines?: readonly ZeroRequiredEngineDescriptor[],
): readonly ZeroRequiredEngineDescriptor[] {
  const descriptorMap = createRequiredEngineDescriptorMap(
    requiredEngines ?? ZERO_REQUIRED_ENGINE_DESCRIPTORS,
  );

  const merged: ZeroRequiredEngineDescriptor[] = [];

  for (const engineId of requiredEngineIds) {
    const known = descriptorMap[engineId];
    if (known) {
      merged.push(known);
      continue;
    }

    merged.push(Object.freeze({
      engineId,
      critical: true,
      reason: `Required engine ${engineId} must be present for resolved orchestration policy.`,
    }));
  }

  return Object.freeze(merged);
}

export function mergeOrchestratorConfig(
  overrides: OrchestratorConfigOverrides = {},
): OrchestratorConfig {
  const defaults = createDefaultOrchestratorConfig();
  const requiredEngineIds = uniqueEngineIds(
    overrides.requiredEngineIds ?? defaults.requiredEngineIds,
  );

  return Object.freeze({
    metadata: mergeMetadata(defaults.metadata, overrides.metadata),
    requiredEngineIds,
    requiredEngines: mergeRequiredEngines(requiredEngineIds, overrides.requiredEngines),
    safety: mergeSafetyPolicy(defaults.safety, overrides.safety),
    events: mergeEventPolicy(defaults.events, overrides.events),
    diagnostics: mergeDiagnosticsPolicy(defaults.diagnostics, overrides.diagnostics),
    lifecycle: mergeLifecyclePolicy(defaults.lifecycle, overrides.lifecycle),
    stepConfig: mergeStepConfig(defaults.stepConfig, overrides.stepConfig),
    modePolicies: mergeModePolicies(defaults.modePolicies, overrides.modePolicies),
    lifecycleStatePolicies: mergeLifecycleStatePolicies(
      defaults.lifecycleStatePolicies,
      overrides.lifecycleStatePolicies,
    ),
    profiles: mergeProfiles(defaults.profiles, overrides.profiles),
    defaultProfileId: overrides.defaultProfileId ?? defaults.defaultProfileId,
    stepEventExpectations: mergeEventExpectationMap(
      defaults.stepEventExpectations,
      overrides.stepEventExpectations,
    ),
    notes: mergeStringNotes(defaults.notes, overrides.notes),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// resolved config helpers
// ────────────────────────────────────────────────────────────────────────────────

function getProfileOrThrow(
  config: OrchestratorConfig,
  profileId: OrchestratorProfileId,
): OrchestratorProfile {
  const profile = config.profiles[profileId];
  if (!profile) {
    throw new Error(`[OrchestratorConfig] Unknown profile: ${profileId}`);
  }
  return profile;
}

function resolveDefaultProfileId(config: OrchestratorConfig, requested?: OrchestratorProfileId): OrchestratorProfileId {
  return requested ?? config.defaultProfileId;
}

function applyProfileRequiredEngines(
  config: OrchestratorConfig,
  profile: OrchestratorProfile,
): readonly EngineId[] {
  return uniqueEngineIds(profile.requiredEngineIds ?? config.requiredEngineIds);
}

function makeResolvedStepConfig(
  stepConfig: Readonly<Record<TickStep, OrchestratorStepPolicy>>,
): Readonly<Record<TickStep, ResolvedOrchestratorStepPolicy>> {
  const resolved = {} as Record<TickStep, ResolvedOrchestratorStepPolicy>;

  for (const step of TICK_SEQUENCE) {
    resolved[step] = Object.freeze({
      ...stepConfig[step],
      step,
      descriptor: TICK_STEP_DESCRIPTORS[step],
    });
  }

  return Object.freeze(resolved);
}

function buildTickPlan(
  stepConfig: Readonly<Record<TickStep, ResolvedOrchestratorStepPolicy>>,
): TickPlanSnapshot {
  const entries: TickPlanEntry[] = [];

  for (const step of TICK_SEQUENCE) {
    entries.push(Object.freeze({
      step,
      descriptor: TICK_STEP_DESCRIPTORS[step],
      enabled: stepConfig[step].enabled,
    }));
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    size: entries.length,
  });
}

function applyTerminalOutcomeResolution(
  lifecycle: OrchestratorLifecyclePolicy,
  outcome: RunOutcome | null | undefined,
): OrchestratorLifecyclePolicy {
  if (outcome === null || outcome === undefined) {
    return lifecycle;
  }

  return Object.freeze({
    ...lifecycle,
    autoFinalizeProofOnTerminalOutcome: true,
  });
}

export function resolveOrchestratorConfig(
  input: ResolveOrchestratorConfigInput = {},
): ResolvedOrchestratorConfig {
  const baseConfig = input.config ?? createDefaultOrchestratorConfig();
  const config = input.overrides ? mergeOrchestratorConfig(input.overrides) : baseConfig;
  const trail: OrchestratorConfigResolutionTrailEntry[] = [
    Object.freeze({
      source: 'default-config',
      detail: `Config loaded with default profile ${config.defaultProfileId}.`,
    }),
  ];

  const profileId = resolveDefaultProfileId(config, input.profileId);
  const profile = getProfileOrThrow(config, profileId);
  trail.push(Object.freeze({
    source: 'profile',
    detail: `Profile ${profileId} applied.`,
  }));

  let safety = mergeSafetyPolicy(config.safety, profile.safety);
  let events = mergeEventPolicy(config.events, profile.events);
  let diagnostics = mergeDiagnosticsPolicy(config.diagnostics, profile.diagnostics);
  let lifecycle = mergeLifecyclePolicy(config.lifecycle, profile.lifecycle);
  let stepConfig = mergeStepConfig(config.stepConfig, profile.stepConfig);
  let requiredEngineIds = applyProfileRequiredEngines(config, profile);

  if (profile.modeOverrides && input.mode) {
    const profileModeOverride = profile.modeOverrides[input.mode];
    if (profileModeOverride) {
      const mergedModePolicy = mergeModePolicy(config.modePolicies[input.mode], profileModeOverride);
      safety = mergeSafetyPolicy(safety, mergedModePolicy.safety);
      events = mergeEventPolicy(events, mergedModePolicy.events);
      diagnostics = mergeDiagnosticsPolicy(diagnostics, mergedModePolicy.diagnostics);
      lifecycle = mergeLifecyclePolicy(lifecycle, mergedModePolicy.lifecycle);
      stepConfig = mergeStepConfig(stepConfig, mergedModePolicy.stepConfig);
      trail.push(Object.freeze({
        source: 'profile',
        detail: `Profile-local mode policy for ${input.mode} applied.`,
      }));
    }
  }

  if (input.mode) {
    const modePolicy = config.modePolicies[input.mode];
    safety = mergeSafetyPolicy(safety, modePolicy.safety);
    events = mergeEventPolicy(events, modePolicy.events);
    diagnostics = mergeDiagnosticsPolicy(diagnostics, modePolicy.diagnostics);
    lifecycle = mergeLifecyclePolicy(lifecycle, modePolicy.lifecycle);
    stepConfig = mergeStepConfig(stepConfig, modePolicy.stepConfig);
    trail.push(Object.freeze({
      source: 'mode-policy',
      detail: `Mode policy ${input.mode} applied.`,
    }));
  }

  if (input.lifecycleState) {
    const lifecyclePolicy = config.lifecycleStatePolicies[input.lifecycleState];
    safety = mergeSafetyPolicy(safety, lifecyclePolicy.safety);
    events = mergeEventPolicy(events, lifecyclePolicy.events);
    diagnostics = mergeDiagnosticsPolicy(diagnostics, lifecyclePolicy.diagnostics);
    lifecycle = mergeLifecyclePolicy(lifecycle, lifecyclePolicy.lifecycle);
    stepConfig = mergeStepConfig(stepConfig, lifecyclePolicy.stepConfig);
    trail.push(Object.freeze({
      source: 'lifecycle-policy',
      detail: `Lifecycle policy ${input.lifecycleState} applied.`,
    }));
  }

  lifecycle = applyTerminalOutcomeResolution(lifecycle, input.outcome);
  if (input.outcome) {
    trail.push(Object.freeze({
      source: 'terminal-outcome',
      detail: `Terminal outcome ${input.outcome} forced proof-finalization behavior.`,
    }));
  }

  const resolvedStepConfig = makeResolvedStepConfig(stepConfig);
  const tickPlan = buildTickPlan(resolvedStepConfig);
  const fingerprint = simpleFingerprint({
    profileId,
    mode: input.mode ?? null,
    lifecycleState: input.lifecycleState ?? null,
    requiredEngineIds,
    safety,
    events,
    diagnostics,
    lifecycle,
    stepConfig: resolvedStepConfig,
  });

  const resolvedConfig: OrchestratorConfig = Object.freeze({
    ...config,
    requiredEngineIds,
    requiredEngines: mergeRequiredEngines(requiredEngineIds, config.requiredEngines),
  });

  return Object.freeze({
    config: resolvedConfig,
    resolvedProfileId: profileId,
    resolvedMode: input.mode ?? null,
    resolvedLifecycleState: input.lifecycleState ?? null,
    safety,
    events,
    diagnostics,
    lifecycle,
    stepConfig: resolvedStepConfig,
    tickPlan,
    fingerprint,
    trail: Object.freeze(trail),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// validation
// ────────────────────────────────────────────────────────────────────────────────

function createIssue(
  severity: OrchestratorConfigSeverity,
  code: string,
  path: string,
  message: string,
): OrchestratorConfigIssue {
  return Object.freeze({ severity, code, path, message });
}

function validateRequiredEngineIds(
  config: OrchestratorConfig,
  issues: OrchestratorConfigIssue[],
): void {
  const allowed = new Set<EngineId>(ZERO_REQUIRED_ENGINE_IDS);
  const present = new Set<EngineId>();

  for (const engineId of config.requiredEngineIds) {
    if (!allowed.has(engineId)) {
      issues.push(createIssue(
        'ERROR',
        'UNKNOWN_REQUIRED_ENGINE',
        'requiredEngineIds',
        `Unknown engine id in requiredEngineIds: ${engineId}`,
      ));
      continue;
    }
    present.add(engineId);
  }

  for (const step of TICK_SEQUENCE) {
    const owner = config.stepConfig[step].owner;
    if (
      owner === 'system'
      || owner === 'mode'
      || owner === 'telemetry'
      || owner === 'unknown'
    ) {
      continue;
    }

    if (!present.has(owner)) {
      issues.push(createIssue(
        'ERROR',
        'STEP_OWNER_NOT_REQUIRED',
        `stepConfig.${step}.owner`,
        `Step ${step} is owned by ${owner} but that engine is not required by the config.`,
      ));
    }
  }
}

function validateStepPolicyMatrix(
  config: OrchestratorConfig,
  issues: OrchestratorConfigIssue[],
): void {
  let skippedSteps = 0;

  for (const step of TICK_SEQUENCE) {
    const policy = config.stepConfig[step];

    if (!policy.enabled) {
      skippedSteps += 1;
    }

    if (step === 'STEP_12_EVENT_SEAL' && !policy.enabled) {
      issues.push(createIssue(
        'ERROR',
        'SEAL_DISABLED',
        'stepConfig.STEP_12_EVENT_SEAL.enabled',
        'STEP_12_EVENT_SEAL cannot be disabled in Engine 0 policy.',
      ));
    }

    if (step === 'STEP_13_FLUSH' && !policy.enabled) {
      issues.push(createIssue(
        'ERROR',
        'FLUSH_DISABLED',
        'stepConfig.STEP_13_FLUSH.enabled',
        'STEP_13_FLUSH cannot be disabled because queued events would never deliver.',
      ));
    }

    if (step === 'STEP_12_EVENT_SEAL' && policy.continueOnError) {
      issues.push(createIssue(
        'WARN',
        'SEAL_CONTINUES_ON_ERROR',
        'stepConfig.STEP_12_EVENT_SEAL.continueOnError',
        'Seal step continuing on error weakens deterministic integrity guarantees.',
      ));
    }

    if (step === 'STEP_13_FLUSH' && policy.sealEligible) {
      issues.push(createIssue(
        'WARN',
        'FLUSH_MARKED_SEAL_ELIGIBLE',
        'stepConfig.STEP_13_FLUSH.sealEligible',
        'Flush step should not be counted as seal-eligible because sealing happens immediately before flush.',
      ));
    }
  }

  if (skippedSteps > config.safety.maxAllowedSkippedStepsPerTick) {
    issues.push(createIssue(
      'ERROR',
      'TOO_MANY_SKIPPED_STEPS',
      'stepConfig',
      `Config disables ${skippedSteps} steps, exceeding maxAllowedSkippedStepsPerTick=${config.safety.maxAllowedSkippedStepsPerTick}.`,
    ));
  }
}

function validateProfileMatrix(
  config: OrchestratorConfig,
  issues: OrchestratorConfigIssue[],
): void {
  for (const profileId of ZERO_ORCHESTRATOR_PROFILE_IDS) {
    const profile = config.profiles[profileId];
    if (!profile) {
      issues.push(createIssue(
        'ERROR',
        'MISSING_PROFILE',
        `profiles.${profileId}`,
        `Required orchestrator profile ${profileId} is missing.`,
      ));
      continue;
    }

    if (profile.id !== profileId) {
      issues.push(createIssue(
        'ERROR',
        'PROFILE_ID_MISMATCH',
        `profiles.${profileId}.id`,
        `Profile key ${profileId} does not match embedded profile.id=${profile.id}.`,
      ));
    }
  }

  if (!config.profiles[config.defaultProfileId]) {
    issues.push(createIssue(
      'ERROR',
      'DEFAULT_PROFILE_MISSING',
      'defaultProfileId',
      `defaultProfileId=${config.defaultProfileId} does not exist in profiles.`,
    ));
  }
}

function validateEventPolicy(
  config: OrchestratorConfig,
  issues: OrchestratorConfigIssue[],
): void {
  if (config.events.flushAtFinalStepOnly && !config.stepConfig.STEP_13_FLUSH.enabled) {
    issues.push(createIssue(
      'ERROR',
      'FINAL_FLUSH_POLICY_WITHOUT_FLUSH_STEP',
      'events.flushAtFinalStepOnly',
      'flushAtFinalStepOnly cannot be true when STEP_13_FLUSH is disabled.',
    ));
  }

  if (config.events.sealEventsBeforeFlush && !config.stepConfig.STEP_12_EVENT_SEAL.enabled) {
    issues.push(createIssue(
      'ERROR',
      'SEAL_POLICY_WITHOUT_SEAL_STEP',
      'events.sealEventsBeforeFlush',
      'sealEventsBeforeFlush cannot be true when STEP_12_EVENT_SEAL is disabled.',
    ));
  }

  if (!config.events.emitTickCompletedBeforeFlush) {
    issues.push(createIssue(
      'WARN',
      'TICK_COMPLETE_AFTER_FLUSH',
      'events.emitTickCompletedBeforeFlush',
      'Disabling emitTickCompletedBeforeFlush changes the repo-native delivery cadence.',
    ));
  }
}

function validateLifecyclePolicy(
  config: OrchestratorConfig,
  issues: OrchestratorConfigIssue[],
): void {
  if (config.lifecycle.forceOutcomeOnConsecutiveErrorLimit !== 'ABANDONED') {
    issues.push(createIssue(
      'ERROR',
      'INVALID_CONSECUTIVE_ERROR_OUTCOME',
      'lifecycle.forceOutcomeOnConsecutiveErrorLimit',
      'Engine 0 only supports ABANDONED as the forced outcome on consecutive error limit.',
    ));
  }

  const priority = config.lifecycle.terminalOutcomePriority;
  for (const outcome of ZERO_TERMINAL_OUTCOME_PRIORITY) {
    if (!priority.includes(outcome)) {
      issues.push(createIssue(
        'WARN',
        'TERMINAL_PRIORITY_MISSING_OUTCOME',
        'lifecycle.terminalOutcomePriority',
        `terminalOutcomePriority does not include ${outcome}.`,
      ));
    }
  }
}

export function validateOrchestratorConfig(
  config: OrchestratorConfig,
): OrchestratorConfigValidationReport {
  const issues: OrchestratorConfigIssue[] = [];

  validateRequiredEngineIds(config, issues);
  validateStepPolicyMatrix(config, issues);
  validateProfileMatrix(config, issues);
  validateEventPolicy(config, issues);
  validateLifecyclePolicy(config, issues);

  const errors = issues.filter((issue) => issue.severity === 'ERROR');
  const warnings = issues.filter((issue) => issue.severity !== 'ERROR');
  const fingerprint = simpleFingerprint(config);

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    fingerprint,
  });
}

export function assertValidOrchestratorConfig(config: OrchestratorConfig): OrchestratorConfig {
  const report = validateOrchestratorConfig(config);
  if (!report.valid) {
    const message = report.errors
      .map((issue) => `${issue.code}@${issue.path}: ${issue.message}`)
      .join(' | ');
    throw new Error(`[OrchestratorConfig] Invalid config: ${message}`);
  }
  return config;
}

// ────────────────────────────────────────────────────────────────────────────────
// descriptive helpers for orchestration surfaces
// ────────────────────────────────────────────────────────────────────────────────

export interface OrchestratorStepProfileSummary {
  readonly step: TickStep;
  readonly owner: StepRuntimeOwner;
  readonly enabled: boolean;
  readonly fatalOnError: boolean;
  readonly continueOnError: boolean;
  readonly sealEligible: boolean;
  readonly expectedEventFamilies: readonly string[];
}

export interface OrchestratorConfigSummary {
  readonly fingerprint: string;
  readonly defaultProfileId: OrchestratorProfileId;
  readonly requiredEngineIds: readonly EngineId[];
  readonly enabledStepCount: number;
  readonly disabledSteps: readonly TickStep[];
  readonly notes: readonly string[];
  readonly stepSummaries: readonly OrchestratorStepProfileSummary[];
}

export function summarizeOrchestratorConfig(
  config: OrchestratorConfig,
): OrchestratorConfigSummary {
  const disabledSteps: TickStep[] = [];
  const stepSummaries: OrchestratorStepProfileSummary[] = [];

  for (const step of TICK_SEQUENCE) {
    const policy = config.stepConfig[step];
    if (!policy.enabled) {
      disabledSteps.push(step);
    }
    stepSummaries.push(Object.freeze({
      step,
      owner: policy.owner,
      enabled: policy.enabled,
      fatalOnError: policy.fatalOnError,
      continueOnError: policy.continueOnError,
      sealEligible: policy.sealEligible,
      expectedEventFamilies: config.stepEventExpectations[step].expectedEventFamilies,
    }));
  }

  return Object.freeze({
    fingerprint: simpleFingerprint(config),
    defaultProfileId: config.defaultProfileId,
    requiredEngineIds: config.requiredEngineIds,
    enabledStepCount: stepSummaries.filter((entry) => entry.enabled).length,
    disabledSteps: Object.freeze(disabledSteps),
    notes: config.notes,
    stepSummaries: Object.freeze(stepSummaries),
  });
}

export function getRequiredEngineDescriptor(
  config: OrchestratorConfig,
  engineId: EngineId,
): ZeroRequiredEngineDescriptor | null {
  for (const descriptor of config.requiredEngines) {
    if (descriptor.engineId === engineId) {
      return descriptor;
    }
  }
  return null;
}

export function getEnabledSteps(
  config: OrchestratorConfig,
): readonly TickStep[] {
  const enabled: TickStep[] = [];
  for (const step of TICK_SEQUENCE) {
    if (config.stepConfig[step].enabled) {
      enabled.push(step);
    }
  }
  return Object.freeze(enabled);
}

export function getDisabledSteps(
  config: OrchestratorConfig,
): readonly TickStep[] {
  const disabled: TickStep[] = [];
  for (const step of TICK_SEQUENCE) {
    if (!config.stepConfig[step].enabled) {
      disabled.push(step);
    }
  }
  return Object.freeze(disabled);
}

export function getEngineOwnedSteps(
  engineId: EngineId,
): readonly TickStep[] {
  return ZERO_ENGINE_STEP_OWNERSHIP[engineId] ?? Object.freeze([]);
}

export function buildTickPlanFromConfig(
  config: OrchestratorConfig,
): TickPlanSnapshot {
  const resolvedStepConfig = makeResolvedStepConfig(config.stepConfig);
  return buildTickPlan(resolvedStepConfig);
}

export function cloneOrchestratorConfig(
  config: OrchestratorConfig,
): OrchestratorConfig {
  return mergeOrchestratorConfig({
    metadata: config.metadata,
    requiredEngineIds: config.requiredEngineIds,
    requiredEngines: config.requiredEngines,
    safety: config.safety,
    events: config.events,
    diagnostics: config.diagnostics,
    lifecycle: config.lifecycle,
    stepConfig: config.stepConfig,
    modePolicies: config.modePolicies,
    lifecycleStatePolicies: config.lifecycleStatePolicies,
    profiles: config.profiles,
    defaultProfileId: config.defaultProfileId,
    stepEventExpectations: config.stepEventExpectations,
    notes: config.notes,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// curated config constructors for common lanes
// ────────────────────────────────────────────────────────────────────────────────

export function createProductionOrchestratorConfig(
  overrides: OrchestratorConfigOverrides = {},
): OrchestratorConfig {
  const merged = mergeOrchestratorConfig({
    defaultProfileId: 'production',
    ...overrides,
  });
  return assertValidOrchestratorConfig(merged);
}

export function createDebugOrchestratorConfig(
  overrides: OrchestratorConfigOverrides = {},
): OrchestratorConfig {
  const merged = mergeOrchestratorConfig({
    defaultProfileId: 'debug',
    ...overrides,
  });
  return assertValidOrchestratorConfig(merged);
}

export function createReplayOrchestratorConfig(
  overrides: OrchestratorConfigOverrides = {},
): OrchestratorConfig {
  const merged = mergeOrchestratorConfig({
    defaultProfileId: 'replay',
    ...overrides,
  });
  return assertValidOrchestratorConfig(merged);
}

export function createLoadTestOrchestratorConfig(
  overrides: OrchestratorConfigOverrides = {},
): OrchestratorConfig {
  const merged = mergeOrchestratorConfig({
    defaultProfileId: 'load-test',
    ...overrides,
  });
  return assertValidOrchestratorConfig(merged);
}

export function createTournamentOrchestratorConfig(
  overrides: OrchestratorConfigOverrides = {},
): OrchestratorConfig {
  const merged = mergeOrchestratorConfig({
    defaultProfileId: 'tournament',
    ...overrides,
  });
  return assertValidOrchestratorConfig(merged);
}

export function createIntegrationTestOrchestratorConfig(
  overrides: OrchestratorConfigOverrides = {},
): OrchestratorConfig {
  const merged = mergeOrchestratorConfig({
    defaultProfileId: 'integration-test',
    ...overrides,
  });
  return assertValidOrchestratorConfig(merged);
}

// ────────────────────────────────────────────────────────────────────────────────
// step lookup helpers
// ────────────────────────────────────────────────────────────────────────────────

/**
 * getOrchestratorStepDescriptor
 *
 * Returns the canonical TickStepDescriptor for a given tick step.
 * Named distinctly from getStepDescriptor (TickPlan.ts) to prevent TS2308
 * barrel collision — semantically identical but owned by OrchestratorConfig.
 */
export function getOrchestratorStepDescriptor(step: TickStep): TickStepDescriptor {
  return TICK_STEP_DESCRIPTORS[step];
}

/**
 * getOrchestratorStepOwner
 *
 * Returns the StepRuntimeOwner responsible for a given tick step in Engine 0.
 * Named distinctly from getStepOwner (TickPlan.ts) to prevent TS2308
 * barrel collision — semantically identical but owned by OrchestratorConfig.
 */
export function getOrchestratorStepOwner(step: TickStep): StepRuntimeOwner {
  return ZERO_STEP_OWNER_MAP[step];
}

export function getStepPolicy(
  config: OrchestratorConfig,
  step: TickStep,
): OrchestratorStepPolicy {
  return config.stepConfig[step];
}

export function getStepEventExpectation(
  config: OrchestratorConfig,
  step: TickStep,
): OrchestratorStepEventExpectation {
  return config.stepEventExpectations[step];
}

export function isStepEnabled(
  config: OrchestratorConfig,
  step: TickStep,
): boolean {
  return config.stepConfig[step].enabled;
}

export function isStepSealEligible(
  config: OrchestratorConfig,
  step: TickStep,
): boolean {
  return config.stepConfig[step].sealEligible;
}

export function isFatalStep(
  config: OrchestratorConfig,
  step: TickStep,
): boolean {
  return config.stepConfig[step].fatalOnError;
}

// ────────────────────────────────────────────────────────────────────────────────
// exported resolved/default constants
// ────────────────────────────────────────────────────────────────────────────────

export const ZERO_DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig =
  createDefaultOrchestratorConfig();

export const ZERO_DEFAULT_ORCHESTRATOR_SUMMARY: OrchestratorConfigSummary =
  summarizeOrchestratorConfig(ZERO_DEFAULT_ORCHESTRATOR_CONFIG);

/**
 * ZERO_ORCHESTRATOR_DEFAULT_TICK_PLAN
 *
 * The TickPlanSnapshot derived from the default OrchestratorConfig.
 * Named distinctly from ZERO_DEFAULT_TICK_PLAN (TickPlan.ts) to prevent
 * TS2308 barrel collision. This plan is computed from policy config;
 * the TickPlan.ts version is the canonical structural plan.
 */
export const ZERO_ORCHESTRATOR_DEFAULT_TICK_PLAN: TickPlanSnapshot =
  buildTickPlanFromConfig(ZERO_DEFAULT_ORCHESTRATOR_CONFIG);

export const ZERO_DEFAULT_ORCHESTRATOR_FINGERPRINT: string =
  simpleFingerprint(ZERO_DEFAULT_ORCHESTRATOR_CONFIG);

export const ZERO_REQUIRED_ENGINE_DESCRIPTOR_MAP: Readonly<
  Record<EngineId, ZeroRequiredEngineDescriptor>
> = createRequiredEngineDescriptorMap(ZERO_REQUIRED_ENGINE_DESCRIPTORS);

export const ZERO_PRODUCTION_ORCHESTRATOR_CONFIG: OrchestratorConfig =
  createProductionOrchestratorConfig();

export const ZERO_DEBUG_ORCHESTRATOR_CONFIG: OrchestratorConfig =
  createDebugOrchestratorConfig();

export const ZERO_REPLAY_ORCHESTRATOR_CONFIG: OrchestratorConfig =
  createReplayOrchestratorConfig();

export const ZERO_LOAD_TEST_ORCHESTRATOR_CONFIG: OrchestratorConfig =
  createLoadTestOrchestratorConfig();

export const ZERO_TOURNAMENT_ORCHESTRATOR_CONFIG: OrchestratorConfig =
  createTournamentOrchestratorConfig();

export const ZERO_INTEGRATION_TEST_ORCHESTRATOR_CONFIG: OrchestratorConfig =
  createIntegrationTestOrchestratorConfig();

// ────────────────────────────────────────────────────────────────────────────────
// ML VECTOR EXTRACTION — 32-dimensional feature representation
// ────────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorConfigMLVector
 *
 * 32-dimensional ML feature vector derived from a resolved OrchestratorConfig.
 * All dimensions are in [0, 1] (normalized). Boolean policy fields are 0 or 1.
 * Numeric fields are clamped and normalized against their canonical range.
 *
 * Dimension layout (4 groups × 8 dims):
 *   [0..7]   Safety policy features
 *   [8..15]  Event + Diagnostics policy features
 *   [16..23] Lifecycle + Step plan features
 *   [24..31] Profile + Mode identity features
 */
export interface OrchestratorConfigMLVector {
  // Safety policy (dims 0–7)
  readonly maxConsecutiveTickErrors01: number;     // 0: 1/20 … 1: 20/20
  readonly maxAllowedSkippedSteps01: number;       // 0: 0/13 … 1: 13/13
  readonly failClosedOnRegistryGap: 0 | 1;
  readonly abortRunOnFatalSealError: 0 | 1;
  readonly quarantineOnFlushError: 0 | 1;
  readonly quarantineOnSealMismatch: 0 | 1;
  readonly failClosedOnInvalidProfile: 0 | 1;
  readonly preserveTerminalSnapshotOnAbort: 0 | 1;

  // Event + Diagnostics policy (dims 8–15)
  readonly emitRunStartedImmediately: 0 | 1;
  readonly sealEventsBeforeFlush: 0 | 1;
  readonly flushAtFinalStepOnly: 0 | 1;
  readonly retainLastEventSealSnapshots01: number; // normalized against 256
  readonly enableTracePublishing: 0 | 1;
  readonly enableHealthSnapshots: 0 | 1;
  readonly retainLastTickSummaries01: number;      // normalized against 300
  readonly retainLastErrors01: number;             // normalized against 300

  // Lifecycle + Step plan (dims 16–23)
  readonly allowPlayCardOnlyWhenActive: 0 | 1;
  readonly autoFinalizeProofOnTerminalOutcome: 0 | 1;
  readonly allowResetFromEnded: 0 | 1;
  readonly retainTickHistoryAcrossRuns: 0 | 1;
  readonly enabledStepCount01: number;             // normalized against 13
  readonly disabledStepCount01: number;            // normalized against 13
  readonly sealStepEnabled: 0 | 1;
  readonly flushStepEnabled: 0 | 1;

  // Profile + Mode identity (dims 24–31)
  readonly profileIsDefault: 0 | 1;
  readonly profileIsProduction: 0 | 1;
  readonly profileIsTournament: 0 | 1;
  readonly profileIsDebugOrReplay: 0 | 1;
  readonly modeIsSolo: 0 | 1;
  readonly modeIsPvp: 0 | 1;
  readonly modeIsCoop: 0 | 1;
  readonly modeIsGhost: 0 | 1;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function boolToFeature(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

/**
 * extractOrchestratorConfigMLVector
 *
 * Extracts the 32-dimensional ML feature vector from a ResolvedOrchestratorConfig.
 * All fields are normalized to [0, 1]. The vector is deterministic for identical inputs.
 *
 * Usage:
 *   const resolved = resolveOrchestratorConfig({ profileId: 'production', mode: 'pvp' });
 *   const mlVec = extractOrchestratorConfigMLVector(resolved);
 *   // mlVec.profileIsProduction === 1, mlVec.modeIsPvp === 1
 */
export function extractOrchestratorConfigMLVector(
  resolved: ResolvedOrchestratorConfig,
): OrchestratorConfigMLVector {
  const { safety, events, diagnostics, lifecycle, stepConfig } = resolved;

  const enabledStepCount = ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE.filter(
    (s) => stepConfig[s].enabled,
  ).length;
  const disabledStepCount = ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE.length - enabledStepCount;

  return Object.freeze({
    // Safety policy
    maxConsecutiveTickErrors01: clamp01(safety.maxConsecutiveTickErrors / 20),
    maxAllowedSkippedSteps01: clamp01(
      safety.maxAllowedSkippedStepsPerTick / ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE.length,
    ),
    failClosedOnRegistryGap: boolToFeature(safety.failClosedOnRegistryGap),
    abortRunOnFatalSealError: boolToFeature(safety.abortRunOnFatalSealError),
    quarantineOnFlushError: boolToFeature(safety.quarantineOnFlushError),
    quarantineOnSealMismatch: boolToFeature(safety.quarantineOnSealMismatch),
    failClosedOnInvalidProfile: boolToFeature(safety.failClosedOnInvalidProfile),
    preserveTerminalSnapshotOnAbort: boolToFeature(safety.preserveTerminalSnapshotOnAbort),

    // Event + Diagnostics policy
    emitRunStartedImmediately: boolToFeature(events.emitRunStartedImmediately),
    sealEventsBeforeFlush: boolToFeature(events.sealEventsBeforeFlush),
    flushAtFinalStepOnly: boolToFeature(events.flushAtFinalStepOnly),
    retainLastEventSealSnapshots01: clamp01(events.retainLastEventSealSnapshots / 256),
    enableTracePublishing: boolToFeature(diagnostics.enableTracePublishing),
    enableHealthSnapshots: boolToFeature(diagnostics.enableHealthSnapshots),
    retainLastTickSummaries01: clamp01(diagnostics.retainLastTickSummaries / 300),
    retainLastErrors01: clamp01(diagnostics.retainLastErrors / 300),

    // Lifecycle + Step plan
    allowPlayCardOnlyWhenActive: boolToFeature(lifecycle.allowPlayCardOnlyWhenActive),
    autoFinalizeProofOnTerminalOutcome: boolToFeature(lifecycle.autoFinalizeProofOnTerminalOutcome),
    allowResetFromEnded: boolToFeature(lifecycle.allowResetFromEnded),
    retainTickHistoryAcrossRuns: boolToFeature(lifecycle.retainTickHistoryAcrossRuns),
    enabledStepCount01: clamp01(enabledStepCount / ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE.length),
    disabledStepCount01: clamp01(disabledStepCount / ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE.length),
    sealStepEnabled: boolToFeature(stepConfig.STEP_12_EVENT_SEAL.enabled),
    flushStepEnabled: boolToFeature(stepConfig.STEP_13_FLUSH.enabled),

    // Profile + Mode identity
    profileIsDefault: boolToFeature(resolved.resolvedProfileId === 'default'),
    profileIsProduction: boolToFeature(resolved.resolvedProfileId === 'production'),
    profileIsTournament: boolToFeature(resolved.resolvedProfileId === 'tournament'),
    profileIsDebugOrReplay: boolToFeature(
      resolved.resolvedProfileId === 'debug' || resolved.resolvedProfileId === 'replay',
    ),
    modeIsSolo: boolToFeature(resolved.resolvedMode === 'solo'),
    modeIsPvp: boolToFeature(resolved.resolvedMode === 'pvp'),
    modeIsCoop: boolToFeature(resolved.resolvedMode === 'coop'),
    modeIsGhost: boolToFeature(resolved.resolvedMode === 'ghost'),
  });
}

/**
 * mlVectorToArray
 *
 * Converts an OrchestratorConfigMLVector to a flat 32-element number array.
 * The canonical dimension order matches the interface field declaration order.
 */
export function mlVectorToArray(vec: OrchestratorConfigMLVector): readonly number[] {
  return Object.freeze([
    vec.maxConsecutiveTickErrors01,
    vec.maxAllowedSkippedSteps01,
    vec.failClosedOnRegistryGap,
    vec.abortRunOnFatalSealError,
    vec.quarantineOnFlushError,
    vec.quarantineOnSealMismatch,
    vec.failClosedOnInvalidProfile,
    vec.preserveTerminalSnapshotOnAbort,

    vec.emitRunStartedImmediately,
    vec.sealEventsBeforeFlush,
    vec.flushAtFinalStepOnly,
    vec.retainLastEventSealSnapshots01,
    vec.enableTracePublishing,
    vec.enableHealthSnapshots,
    vec.retainLastTickSummaries01,
    vec.retainLastErrors01,

    vec.allowPlayCardOnlyWhenActive,
    vec.autoFinalizeProofOnTerminalOutcome,
    vec.allowResetFromEnded,
    vec.retainTickHistoryAcrossRuns,
    vec.enabledStepCount01,
    vec.disabledStepCount01,
    vec.sealStepEnabled,
    vec.flushStepEnabled,

    vec.profileIsDefault,
    vec.profileIsProduction,
    vec.profileIsTournament,
    vec.profileIsDebugOrReplay,
    vec.modeIsSolo,
    vec.modeIsPvp,
    vec.modeIsCoop,
    vec.modeIsGhost,
  ]);
}

// ────────────────────────────────────────────────────────────────────────────────
// DL TENSOR CONSTRUCTION — 13×10 step-level feature matrix
// ────────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorConfigDLTensor
 *
 * Deep-learning tensor: 13 tick steps × 10 per-step features.
 * Row i corresponds to TICK_SEQUENCE[i]. Columns:
 *   [0] enabled
 *   [1] fatalOnError
 *   [2] continueOnError
 *   [3] sealEligible
 *   [4] collectSignals
 *   [5] collectDiagnostics
 *   [6] snapshotMutationExpected
 *   [7] runModeHooksBefore
 *   [8] runModeHooksAfter
 *   [9] ownerEncoded (system=0 time=1 pressure=2 tension=3 battle=4 shield=5 cascade=6 sovereignty=7 mode=8 telemetry=9, normalized /9)
 */
export type OrchestratorConfigDLTensor = readonly (readonly number[])[];

const STEP_OWNER_ENCODING: Readonly<Record<StepRuntimeOwner, number>> = Object.freeze({
  system: 0,
  time: 1,
  pressure: 2,
  tension: 3,
  battle: 4,
  shield: 5,
  cascade: 6,
  sovereignty: 7,
  mode: 8,
  telemetry: 9,
  unknown: 9,
});

/**
 * buildOrchestratorConfigDLTensor
 *
 * Builds a 13×10 DL tensor from the step-level policies in a resolved config.
 * Each row is one tick step; each column is a binary or normalized feature.
 *
 * Usage:
 *   const resolved = resolveOrchestratorConfig({ profileId: 'tournament' });
 *   const tensor = buildOrchestratorConfigDLTensor(resolved);
 *   // tensor[0] → STEP_01_PREPARE feature row
 *   // tensor[11] → STEP_12_EVENT_SEAL feature row
 */
export function buildOrchestratorConfigDLTensor(
  resolved: ResolvedOrchestratorConfig,
): OrchestratorConfigDLTensor {
  const rows: (readonly number[])[] = [];

  for (const step of ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE) {
    const policy = resolved.stepConfig[step];
    const ownerCode = STEP_OWNER_ENCODING[policy.owner] ?? 9;

    rows.push(Object.freeze([
      boolToFeature(policy.enabled),
      boolToFeature(policy.fatalOnError),
      boolToFeature(policy.continueOnError),
      boolToFeature(policy.sealEligible),
      boolToFeature(policy.collectSignals),
      boolToFeature(policy.collectDiagnostics),
      boolToFeature(policy.snapshotMutationExpected),
      boolToFeature(policy.runModeHooksBefore),
      boolToFeature(policy.runModeHooksAfter),
      clamp01(ownerCode / 9),
    ]));
  }

  return Object.freeze(rows);
}

/**
 * dlTensorToFlatArray
 *
 * Flattens the 13×10 DL tensor to a 130-element array in row-major order.
 * Useful for feeding into ML inference pipelines that expect flat input.
 */
export function dlTensorToFlatArray(tensor: OrchestratorConfigDLTensor): readonly number[] {
  const flat: number[] = [];
  for (const row of tensor) {
    for (const value of row) {
      flat.push(value);
    }
  }
  return Object.freeze(flat);
}

// ────────────────────────────────────────────────────────────────────────────────
// CONFIG DIFF UTILITY — structural comparison between two resolved configs
// ────────────────────────────────────────────────────────────────────────────────

export interface OrchestratorConfigDiffEntry {
  readonly path: string;
  readonly label: string;
  readonly fromValue: unknown;
  readonly toValue: unknown;
  readonly category: 'safety' | 'events' | 'diagnostics' | 'lifecycle' | 'step' | 'profile' | 'mode';
  readonly significant: boolean;
}

export interface OrchestratorConfigDiff {
  readonly fromFingerprint: string;
  readonly toFingerprint: string;
  readonly changed: boolean;
  readonly entries: readonly OrchestratorConfigDiffEntry[];
  readonly significantChanges: number;
  readonly safetyChanges: number;
  readonly stepChanges: number;
}

function diffEntry(
  path: string,
  label: string,
  a: unknown,
  b: unknown,
  category: OrchestratorConfigDiffEntry['category'],
  significant: boolean,
): OrchestratorConfigDiffEntry | null {
  if (a === b) {
    return null;
  }
  return Object.freeze({ path, label, fromValue: a, toValue: b, category, significant });
}

/**
 * diffResolvedOrchestratorConfigs
 *
 * Compares two resolved configs and produces a structured diff.
 * Significant changes are those that affect safety, sealing, or step enable/disable.
 *
 * Usage:
 *   const a = resolveOrchestratorConfig({ profileId: 'default' });
 *   const b = resolveOrchestratorConfig({ profileId: 'tournament' });
 *   const diff = diffResolvedOrchestratorConfigs(a, b);
 *   console.log(diff.significantChanges, diff.entries.length);
 */
export function diffResolvedOrchestratorConfigs(
  from: ResolvedOrchestratorConfig,
  to: ResolvedOrchestratorConfig,
): OrchestratorConfigDiff {
  const entries: OrchestratorConfigDiffEntry[] = [];

  function push(entry: OrchestratorConfigDiffEntry | null): void {
    if (entry !== null) {
      entries.push(entry);
    }
  }

  // Safety policy diffs
  push(diffEntry('safety.maxConsecutiveTickErrors', 'Max consecutive tick errors',
    from.safety.maxConsecutiveTickErrors, to.safety.maxConsecutiveTickErrors, 'safety', true));
  push(diffEntry('safety.failClosedOnRegistryGap', 'Fail-closed on registry gap',
    from.safety.failClosedOnRegistryGap, to.safety.failClosedOnRegistryGap, 'safety', true));
  push(diffEntry('safety.abortRunOnFatalSealError', 'Abort on fatal seal error',
    from.safety.abortRunOnFatalSealError, to.safety.abortRunOnFatalSealError, 'safety', true));
  push(diffEntry('safety.quarantineOnFlushError', 'Quarantine on flush error',
    from.safety.quarantineOnFlushError, to.safety.quarantineOnFlushError, 'safety', true));
  push(diffEntry('safety.quarantineOnSealMismatch', 'Quarantine on seal mismatch',
    from.safety.quarantineOnSealMismatch, to.safety.quarantineOnSealMismatch, 'safety', true));
  push(diffEntry('safety.maxAllowedSkippedStepsPerTick', 'Max skipped steps per tick',
    from.safety.maxAllowedSkippedStepsPerTick, to.safety.maxAllowedSkippedStepsPerTick, 'safety', true));
  push(diffEntry('safety.failClosedOnInvalidProfile', 'Fail-closed on invalid profile',
    from.safety.failClosedOnInvalidProfile, to.safety.failClosedOnInvalidProfile, 'safety', false));
  push(diffEntry('safety.preserveTerminalSnapshotOnAbort', 'Preserve terminal snapshot on abort',
    from.safety.preserveTerminalSnapshotOnAbort, to.safety.preserveTerminalSnapshotOnAbort, 'safety', false));

  // Event policy diffs
  push(diffEntry('events.sealEventsBeforeFlush', 'Seal events before flush',
    from.events.sealEventsBeforeFlush, to.events.sealEventsBeforeFlush, 'events', true));
  push(diffEntry('events.flushAtFinalStepOnly', 'Flush at final step only',
    from.events.flushAtFinalStepOnly, to.events.flushAtFinalStepOnly, 'events', true));
  push(diffEntry('events.retainLastEventSealSnapshots', 'Retained event seal snapshots',
    from.events.retainLastEventSealSnapshots, to.events.retainLastEventSealSnapshots, 'events', false));
  push(diffEntry('events.retainLastFlushedEventBatches', 'Retained flushed event batches',
    from.events.retainLastFlushedEventBatches, to.events.retainLastFlushedEventBatches, 'events', false));
  push(diffEntry('events.emitRunStartedImmediately', 'Emit run-started immediately',
    from.events.emitRunStartedImmediately, to.events.emitRunStartedImmediately, 'events', false));
  push(diffEntry('events.emitLifecycleCheckpointEvents', 'Emit lifecycle checkpoint events',
    from.events.emitLifecycleCheckpointEvents, to.events.emitLifecycleCheckpointEvents, 'events', false));

  // Diagnostics diffs
  push(diffEntry('diagnostics.enableTracePublishing', 'Trace publishing enabled',
    from.diagnostics.enableTracePublishing, to.diagnostics.enableTracePublishing, 'diagnostics', false));
  push(diffEntry('diagnostics.enableHealthSnapshots', 'Health snapshots enabled',
    from.diagnostics.enableHealthSnapshots, to.diagnostics.enableHealthSnapshots, 'diagnostics', false));
  push(diffEntry('diagnostics.retainLastTickSummaries', 'Retained tick summaries',
    from.diagnostics.retainLastTickSummaries, to.diagnostics.retainLastTickSummaries, 'diagnostics', false));
  push(diffEntry('diagnostics.retainLastErrors', 'Retained errors',
    from.diagnostics.retainLastErrors, to.diagnostics.retainLastErrors, 'diagnostics', false));

  // Profile + mode diffs
  if (from.resolvedProfileId !== to.resolvedProfileId) {
    entries.push(Object.freeze({
      path: 'resolvedProfileId',
      label: 'Resolved profile',
      fromValue: from.resolvedProfileId,
      toValue: to.resolvedProfileId,
      category: 'profile',
      significant: true,
    }));
  }
  if (from.resolvedMode !== to.resolvedMode) {
    entries.push(Object.freeze({
      path: 'resolvedMode',
      label: 'Resolved mode',
      fromValue: from.resolvedMode,
      toValue: to.resolvedMode,
      category: 'mode',
      significant: false,
    }));
  }

  // Step enable/disable diffs
  for (const step of ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE) {
    const fromEnabled = from.stepConfig[step].enabled;
    const toEnabled = to.stepConfig[step].enabled;
    if (fromEnabled !== toEnabled) {
      entries.push(Object.freeze({
        path: `stepConfig.${step}.enabled`,
        label: `Step ${step} enabled`,
        fromValue: fromEnabled,
        toValue: toEnabled,
        category: 'step',
        significant: step === 'STEP_12_EVENT_SEAL' || step === 'STEP_13_FLUSH',
      }));
    }
    const fromFatal = from.stepConfig[step].fatalOnError;
    const toFatal = to.stepConfig[step].fatalOnError;
    if (fromFatal !== toFatal) {
      entries.push(Object.freeze({
        path: `stepConfig.${step}.fatalOnError`,
        label: `Step ${step} fatal-on-error`,
        fromValue: fromFatal,
        toValue: toFatal,
        category: 'step',
        significant: true,
      }));
    }
  }

  const significantChanges = entries.filter((e) => e.significant).length;
  const safetyChanges = entries.filter((e) => e.category === 'safety').length;
  const stepChanges = entries.filter((e) => e.category === 'step').length;

  return Object.freeze({
    fromFingerprint: from.fingerprint,
    toFingerprint: to.fingerprint,
    changed: entries.length > 0,
    entries: Object.freeze(entries),
    significantChanges,
    safetyChanges,
    stepChanges,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// CHAT SIGNAL — OrchestratorConfig chat bridge for the LIVEOPS lane
// ────────────────────────────────────────────────────────────────────────────────

/**
 * OrchestratorConfigSafetyLevel
 *
 * Qualitative safety posture inferred from resolved safety policy:
 * - strict: all fail-closed flags set, low error tolerance
 * - standard: balanced defaults
 * - permissive: elevated error tolerance or quarantine relaxed
 */
export type OrchestratorConfigSafetyLevel = 'strict' | 'standard' | 'permissive';

/**
 * OrchestratorConfigChatSignal
 *
 * Chat-lane signal emitted when an OrchestratorConfig is resolved for a run.
 * Consumed by the OrchestratorConfigSignalAdapter to build a ChatSignalEnvelope
 * routed to the LIVEOPS lane. Carries only the policy-relevant summary — raw
 * policy objects are never sent to the chat lane to avoid payload bloat.
 */
export interface OrchestratorConfigChatSignal {
  readonly kind: 'orchestrator-config.resolved';
  readonly profileId: OrchestratorProfileId;
  readonly mode: ModeCode | null;
  readonly lifecycleState: string | null;
  readonly fingerprint: string;
  readonly enabledStepCount: number;
  readonly disabledStepCount: number;
  readonly totalStepCount: number;
  readonly disabledSteps: readonly TickStep[];
  readonly safetyLevel: OrchestratorConfigSafetyLevel;
  readonly isProductionGrade: boolean;
  readonly isTournamentGrade: boolean;
  readonly trailLength: number;
  readonly maxConsecutiveTickErrors: number;
  readonly sealStepEnabled: boolean;
  readonly flushStepEnabled: boolean;
  readonly failClosedFlags: number;    // count of fail-closed / quarantine flags active
  readonly notes: readonly string[];
}

function computeSafetyLevel(safety: OrchestratorSafetyPolicy): OrchestratorConfigSafetyLevel {
  const strictCount = [
    safety.failClosedOnRegistryGap,
    safety.abortRunOnFatalSealError,
    safety.quarantineOnFlushError,
    safety.quarantineOnSealMismatch,
    safety.failClosedOnInvalidProfile,
    safety.failClosedOnInvalidModeOverride,
    safety.preserveTerminalSnapshotOnAbort,
  ].filter(Boolean).length;

  if (strictCount >= 6 && safety.maxConsecutiveTickErrors <= 5) {
    return 'strict';
  }
  if (strictCount >= 3 && safety.maxConsecutiveTickErrors <= 10) {
    return 'standard';
  }
  return 'permissive';
}

/**
 * buildOrchestratorConfigChatSignal
 *
 * Constructs the OrchestratorConfigChatSignal from a resolved config.
 * Should be called immediately after resolveOrchestratorConfig() to produce
 * the signal for chat-lane emission.
 *
 * Usage:
 *   const resolved = resolveOrchestratorConfig({ profileId: 'production', mode: 'solo' });
 *   const signal = buildOrchestratorConfigChatSignal(resolved);
 *   // → { kind: 'orchestrator-config.resolved', profileId: 'production', ... }
 */
export function buildOrchestratorConfigChatSignal(
  resolved: ResolvedOrchestratorConfig,
): OrchestratorConfigChatSignal {
  const disabledSteps = ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE.filter(
    (s) => !resolved.stepConfig[s].enabled,
  );
  const enabledStepCount = ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE.length - disabledSteps.length;
  const safetyLevel = computeSafetyLevel(resolved.safety);
  const failClosedFlags = [
    resolved.safety.failClosedOnRegistryGap,
    resolved.safety.abortRunOnFatalSealError,
    resolved.safety.quarantineOnFlushError,
    resolved.safety.quarantineOnSealMismatch,
    resolved.safety.failClosedOnInvalidProfile,
    resolved.safety.failClosedOnInvalidModeOverride,
    resolved.safety.preserveTerminalSnapshotOnAbort,
  ].filter(Boolean).length;

  const isProductionGrade = resolved.resolvedProfileId === 'production'
    || resolved.resolvedProfileId === 'tournament';
  const isTournamentGrade = resolved.resolvedProfileId === 'tournament';

  return Object.freeze({
    kind: 'orchestrator-config.resolved',
    profileId: resolved.resolvedProfileId,
    mode: resolved.resolvedMode,
    lifecycleState: resolved.resolvedLifecycleState,
    fingerprint: resolved.fingerprint,
    enabledStepCount,
    disabledStepCount: disabledSteps.length,
    totalStepCount: ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE.length,
    disabledSteps: Object.freeze([...disabledSteps]),
    safetyLevel,
    isProductionGrade,
    isTournamentGrade,
    trailLength: resolved.trail.length,
    maxConsecutiveTickErrors: resolved.safety.maxConsecutiveTickErrors,
    sealStepEnabled: resolved.stepConfig.STEP_12_EVENT_SEAL.enabled,
    flushStepEnabled: resolved.stepConfig.STEP_13_FLUSH.enabled,
    failClosedFlags,
    notes: resolved.config.notes,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// TREND ANALYZER — tracks config resolution patterns across a session
// ────────────────────────────────────────────────────────────────────────────────

export interface OrchestratorConfigTrendSnapshot {
  readonly capturedAt: number;
  readonly entryCount: number;
  readonly dominantProfileId: OrchestratorProfileId | null;
  readonly dominantMode: ModeCode | null;
  readonly profileDistribution: Readonly<Partial<Record<OrchestratorProfileId, number>>>;
  readonly modeDistribution: Readonly<Partial<Record<ModeCode, number>>>;
  readonly averageEnabledStepCount: number;
  readonly profileSwitchCount: number;
  readonly modeSwitchCount: number;
  readonly safetyLevelDistribution: Readonly<Record<OrchestratorConfigSafetyLevel, number>>;
  readonly fingerprintCollisionCount: number;
  readonly uniqueFingerprintCount: number;
}

export interface OrchestratorConfigTrendEntry {
  readonly resolvedAt: number;
  readonly fingerprint: string;
  readonly profileId: OrchestratorProfileId;
  readonly mode: ModeCode | null;
  readonly enabledStepCount: number;
  readonly safetyLevel: OrchestratorConfigSafetyLevel;
}

/**
 * OrchestratorConfigTrendAnalyzer
 *
 * Tracks a rolling history of resolved OrchestratorConfig signals to detect
 * config drift, profile switching patterns, and mode distribution across a session.
 *
 * Usage:
 *   const analyzer = new OrchestratorConfigTrendAnalyzer(50);
 *   analyzer.record(resolvedConfig);
 *   const trend = analyzer.getSnapshot();
 *   // trend.dominantProfileId, trend.profileSwitchCount, trend.averageEnabledStepCount
 */
export class OrchestratorConfigTrendAnalyzer {
  private readonly history: OrchestratorConfigTrendEntry[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 64) {
    this.maxHistory = Math.max(8, maxHistory);
  }

  record(resolved: ResolvedOrchestratorConfig): void {
    const entry: OrchestratorConfigTrendEntry = Object.freeze({
      resolvedAt: Date.now(),
      fingerprint: resolved.fingerprint,
      profileId: resolved.resolvedProfileId,
      mode: resolved.resolvedMode,
      enabledStepCount: ORCHESTRATOR_CONFIG_CANONICAL_TICK_SEQUENCE.filter(
        (s) => resolved.stepConfig[s].enabled,
      ).length,
      safetyLevel: computeSafetyLevel(resolved.safety),
    });

    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getSnapshot(): OrchestratorConfigTrendSnapshot {
    if (this.history.length === 0) {
      return Object.freeze({
        capturedAt: Date.now(),
        entryCount: 0,
        dominantProfileId: null,
        dominantMode: null,
        profileDistribution: Object.freeze({}),
        modeDistribution: Object.freeze({}),
        averageEnabledStepCount: 0,
        profileSwitchCount: 0,
        modeSwitchCount: 0,
        safetyLevelDistribution: Object.freeze({ strict: 0, standard: 0, permissive: 0 }),
        fingerprintCollisionCount: 0,
        uniqueFingerprintCount: 0,
      });
    }

    const profileCounts = new Map<OrchestratorProfileId, number>();
    const modeCounts = new Map<ModeCode | null, number>();
    const safetyLevelCounts: Record<OrchestratorConfigSafetyLevel, number> = {
      strict: 0,
      standard: 0,
      permissive: 0,
    };
    const fingerprintSet = new Set<string>();
    let totalEnabledStepCount = 0;
    let profileSwitchCount = 0;
    let modeSwitchCount = 0;
    let fingerprintCollisionCount = 0;

    for (let index = 0; index < this.history.length; index += 1) {
      const entry = this.history[index];

      profileCounts.set(entry.profileId, (profileCounts.get(entry.profileId) ?? 0) + 1);
      modeCounts.set(entry.mode, (modeCounts.get(entry.mode) ?? 0) + 1);
      safetyLevelCounts[entry.safetyLevel] += 1;
      totalEnabledStepCount += entry.enabledStepCount;

      if (fingerprintSet.has(entry.fingerprint)) {
        fingerprintCollisionCount += 1;
      } else {
        fingerprintSet.add(entry.fingerprint);
      }

      if (index > 0) {
        const prev = this.history[index - 1];
        if (prev.profileId !== entry.profileId) {
          profileSwitchCount += 1;
        }
        if (prev.mode !== entry.mode) {
          modeSwitchCount += 1;
        }
      }
    }

    let dominantProfileId: OrchestratorProfileId | null = null;
    let dominantProfileCount = 0;
    for (const [profileId, count] of profileCounts) {
      if (count > dominantProfileCount) {
        dominantProfileCount = count;
        dominantProfileId = profileId;
      }
    }

    let dominantMode: ModeCode | null = null;
    let dominantModeCount = 0;
    for (const [mode, count] of modeCounts) {
      if (count > dominantModeCount && mode !== null) {
        dominantModeCount = count;
        dominantMode = mode as ModeCode;
      }
    }

    const profileDistribution: Partial<Record<OrchestratorProfileId, number>> = {};
    for (const [profileId, count] of profileCounts) {
      profileDistribution[profileId] = count;
    }

    const modeDistribution: Partial<Record<ModeCode, number>> = {};
    for (const [mode, count] of modeCounts) {
      if (mode !== null) {
        modeDistribution[mode as ModeCode] = count;
      }
    }

    return Object.freeze({
      capturedAt: Date.now(),
      entryCount: this.history.length,
      dominantProfileId,
      dominantMode,
      profileDistribution: Object.freeze(profileDistribution),
      modeDistribution: Object.freeze(modeDistribution),
      averageEnabledStepCount: totalEnabledStepCount / this.history.length,
      profileSwitchCount,
      modeSwitchCount,
      safetyLevelDistribution: Object.freeze({ ...safetyLevelCounts }),
      fingerprintCollisionCount,
      uniqueFingerprintCount: fingerprintSet.size,
    });
  }

  getHistory(): readonly OrchestratorConfigTrendEntry[] {
    return Object.freeze([...this.history]);
  }

  clear(): void {
    this.history.length = 0;
  }

  get entryCount(): number {
    return this.history.length;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// SESSION ANALYTICS — aggregate config resolution metrics across a full session
// ────────────────────────────────────────────────────────────────────────────────

export interface OrchestratorConfigResolutionEvent {
  readonly resolvedAt: number;
  readonly fingerprint: string;
  readonly profileId: OrchestratorProfileId;
  readonly mode: ModeCode | null;
  readonly lifecycleState: string | null;
  readonly trailLength: number;
  readonly enabledStepCount: number;
  readonly safetyLevel: OrchestratorConfigSafetyLevel;
  readonly isProductionGrade: boolean;
  readonly isTournamentGrade: boolean;
  readonly failClosedFlags: number;
  readonly durationMs?: number;          // set if a subsequent resolution is recorded
}

export interface OrchestratorConfigSessionReport {
  readonly sessionId: string;
  readonly startedAt: number;
  readonly capturedAt: number;
  readonly totalResolutions: number;
  readonly uniqueFingerprints: number;
  readonly averageTrailLength: number;
  readonly averageEnabledStepCount: number;
  readonly dominantProfileId: OrchestratorProfileId | null;
  readonly dominantMode: ModeCode | null;
  readonly productionGradeResolutions: number;
  readonly tournamentGradeResolutions: number;
  readonly strictSafetyResolutions: number;
  readonly permissiveSafetyResolutions: number;
  readonly totalProfileSwitches: number;
  readonly totalModeSwitches: number;
  readonly profileDistribution: Readonly<Partial<Record<OrchestratorProfileId, number>>>;
  readonly modeDistribution: Readonly<Partial<Record<ModeCode, number>>>;
  readonly events: readonly OrchestratorConfigResolutionEvent[];
}

/**
 * OrchestratorConfigSessionAnalytics
 *
 * Records every config resolution in a session and produces a full aggregate report.
 * Intended for ops-board visibility and post-run replay audits.
 *
 * Usage:
 *   const analytics = new OrchestratorConfigSessionAnalytics('session-abc');
 *   analytics.record(resolved1);
 *   analytics.record(resolved2);
 *   const report = analytics.buildReport();
 *   // report.dominantProfileId, report.totalResolutions, report.productionGradeResolutions
 */
export class OrchestratorConfigSessionAnalytics {
  private readonly sessionId: string;
  private readonly startedAt: number;
  private readonly events: OrchestratorConfigResolutionEvent[] = [];

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.startedAt = Date.now();
  }

  record(resolved: ResolvedOrchestratorConfig): void {
    const now = Date.now();
    const signal = buildOrchestratorConfigChatSignal(resolved);
    const prev = this.events.length > 0 ? this.events[this.events.length - 1] : null;

    if (prev && prev.durationMs === undefined) {
      const updated: OrchestratorConfigResolutionEvent = Object.freeze({
        ...prev,
        durationMs: now - prev.resolvedAt,
      });
      this.events[this.events.length - 1] = updated;
    }

    this.events.push(Object.freeze({
      resolvedAt: now,
      fingerprint: signal.fingerprint,
      profileId: signal.profileId,
      mode: signal.mode,
      lifecycleState: signal.lifecycleState,
      trailLength: signal.trailLength,
      enabledStepCount: signal.enabledStepCount,
      safetyLevel: signal.safetyLevel,
      isProductionGrade: signal.isProductionGrade,
      isTournamentGrade: signal.isTournamentGrade,
      failClosedFlags: signal.failClosedFlags,
    }));
  }

  buildReport(): OrchestratorConfigSessionReport {
    const profileCounts = new Map<OrchestratorProfileId, number>();
    const modeCounts = new Map<ModeCode | null, number>();
    const fingerprintSet = new Set<string>();
    let totalTrailLength = 0;
    let totalEnabledStepCount = 0;
    let productionGradeResolutions = 0;
    let tournamentGradeResolutions = 0;
    let strictSafetyResolutions = 0;
    let permissiveSafetyResolutions = 0;
    let totalProfileSwitches = 0;
    let totalModeSwitches = 0;

    for (let index = 0; index < this.events.length; index += 1) {
      const event = this.events[index];
      profileCounts.set(event.profileId, (profileCounts.get(event.profileId) ?? 0) + 1);
      modeCounts.set(event.mode, (modeCounts.get(event.mode) ?? 0) + 1);
      fingerprintSet.add(event.fingerprint);
      totalTrailLength += event.trailLength;
      totalEnabledStepCount += event.enabledStepCount;

      if (event.isProductionGrade) {
        productionGradeResolutions += 1;
      }
      if (event.isTournamentGrade) {
        tournamentGradeResolutions += 1;
      }
      if (event.safetyLevel === 'strict') {
        strictSafetyResolutions += 1;
      }
      if (event.safetyLevel === 'permissive') {
        permissiveSafetyResolutions += 1;
      }

      if (index > 0) {
        const prev = this.events[index - 1];
        if (prev.profileId !== event.profileId) {
          totalProfileSwitches += 1;
        }
        if (prev.mode !== event.mode) {
          totalModeSwitches += 1;
        }
      }
    }

    let dominantProfileId: OrchestratorProfileId | null = null;
    let dominantProfileCount = 0;
    for (const [profileId, count] of profileCounts) {
      if (count > dominantProfileCount) {
        dominantProfileCount = count;
        dominantProfileId = profileId;
      }
    }

    let dominantMode: ModeCode | null = null;
    let dominantModeCount = 0;
    for (const [mode, count] of modeCounts) {
      if (count > dominantModeCount && mode !== null) {
        dominantModeCount = count;
        dominantMode = mode as ModeCode;
      }
    }

    const profileDistribution: Partial<Record<OrchestratorProfileId, number>> = {};
    for (const [profileId, count] of profileCounts) {
      profileDistribution[profileId] = count;
    }

    const modeDistribution: Partial<Record<ModeCode, number>> = {};
    for (const [mode, count] of modeCounts) {
      if (mode !== null) {
        modeDistribution[mode as ModeCode] = count;
      }
    }

    const n = this.events.length;

    return Object.freeze({
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      capturedAt: Date.now(),
      totalResolutions: n,
      uniqueFingerprints: fingerprintSet.size,
      averageTrailLength: n > 0 ? totalTrailLength / n : 0,
      averageEnabledStepCount: n > 0 ? totalEnabledStepCount / n : 0,
      dominantProfileId,
      dominantMode,
      productionGradeResolutions,
      tournamentGradeResolutions,
      strictSafetyResolutions,
      permissiveSafetyResolutions,
      totalProfileSwitches,
      totalModeSwitches,
      profileDistribution: Object.freeze(profileDistribution),
      modeDistribution: Object.freeze(modeDistribution),
      events: Object.freeze([...this.events]),
    });
  }

  get totalResolutions(): number {
    return this.events.length;
  }

  get sessionIdentifier(): string {
    return this.sessionId;
  }

  clear(): void {
    this.events.length = 0;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// CONFIG INSPECTOR — structured read-only interrogation surface
// ────────────────────────────────────────────────────────────────────────────────

export interface OrchestratorConfigInspectionResult {
  readonly fingerprint: string;
  readonly profileId: OrchestratorProfileId;
  readonly mode: ModeCode | null;
  readonly lifecycleState: string | null;
  readonly safetyLevel: OrchestratorConfigSafetyLevel;
  readonly isProductionGrade: boolean;
  readonly isTournamentGrade: boolean;
  readonly enabledStepCount: number;
  readonly disabledStepCount: number;
  readonly disabledSteps: readonly TickStep[];
  readonly sealStepEnabled: boolean;
  readonly flushStepEnabled: boolean;
  readonly maxConsecutiveTickErrors: number;
  readonly failClosedFlags: number;
  readonly trailLength: number;
  readonly mlVector: OrchestratorConfigMLVector;
  readonly dlTensor: OrchestratorConfigDLTensor;
  readonly chatSignal: OrchestratorConfigChatSignal;
  readonly mlArray: readonly number[];
  readonly dlFlatArray: readonly number[];
  readonly configNotes: readonly string[];
  readonly validationReport: OrchestratorConfigValidationReport;
}

/**
 * inspectResolvedOrchestratorConfig
 *
 * Produces a comprehensive read-only inspection bundle from a resolved config.
 * Includes ML vector, DL tensor, chat signal, validation report, and all key
 * policy summaries in a single call. Intended for ops-board and diagnostic surfaces.
 *
 * Usage:
 *   const resolved = resolveOrchestratorConfig({ profileId: 'tournament', mode: 'pvp' });
 *   const result = inspectResolvedOrchestratorConfig(resolved);
 *   // result.mlVector, result.dlTensor, result.chatSignal, result.safetyLevel
 */
export function inspectResolvedOrchestratorConfig(
  resolved: ResolvedOrchestratorConfig,
): OrchestratorConfigInspectionResult {
  const mlVector = extractOrchestratorConfigMLVector(resolved);
  const dlTensor = buildOrchestratorConfigDLTensor(resolved);
  const chatSignal = buildOrchestratorConfigChatSignal(resolved);
  const validationReport = validateOrchestratorConfig(resolved.config);

  return Object.freeze({
    fingerprint: resolved.fingerprint,
    profileId: resolved.resolvedProfileId,
    mode: resolved.resolvedMode,
    lifecycleState: resolved.resolvedLifecycleState,
    safetyLevel: chatSignal.safetyLevel,
    isProductionGrade: chatSignal.isProductionGrade,
    isTournamentGrade: chatSignal.isTournamentGrade,
    enabledStepCount: chatSignal.enabledStepCount,
    disabledStepCount: chatSignal.disabledStepCount,
    disabledSteps: chatSignal.disabledSteps,
    sealStepEnabled: chatSignal.sealStepEnabled,
    flushStepEnabled: chatSignal.flushStepEnabled,
    maxConsecutiveTickErrors: chatSignal.maxConsecutiveTickErrors,
    failClosedFlags: chatSignal.failClosedFlags,
    trailLength: chatSignal.trailLength,
    mlVector,
    dlTensor,
    chatSignal,
    mlArray: mlVectorToArray(mlVector),
    dlFlatArray: dlTensorToFlatArray(dlTensor),
    configNotes: resolved.config.notes,
    validationReport,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR CONFIG WITH ANALYTICS — full factory surface
// ────────────────────────────────────────────────────────────────────────────────

export interface OrchestratorConfigWithAnalytics {
  readonly resolved: ResolvedOrchestratorConfig;
  readonly mlVector: OrchestratorConfigMLVector;
  readonly dlTensor: OrchestratorConfigDLTensor;
  readonly chatSignal: OrchestratorConfigChatSignal;
  readonly inspection: OrchestratorConfigInspectionResult;
  readonly trendAnalyzer: OrchestratorConfigTrendAnalyzer;
  readonly sessionAnalytics: OrchestratorConfigSessionAnalytics;
}

/**
 * createOrchestratorConfigWithAnalytics
 *
 * Factory that resolves an OrchestratorConfig and simultaneously builds the full
 * analytics bundle: ML vector, DL tensor, chat signal, inspection result,
 * a fresh trend analyzer, and a fresh session analytics instance.
 *
 * Entry points:
 *   const bundle = createOrchestratorConfigWithAnalytics({ profileId: 'production', mode: 'pvp' });
 *   const { resolved, mlVector, dlTensor, chatSignal, inspection } = bundle;
 *   bundle.trendAnalyzer.record(resolved);
 *   bundle.sessionAnalytics.record(resolved);
 *   const report = bundle.sessionAnalytics.buildReport();
 */
export function createOrchestratorConfigWithAnalytics(
  input: ResolveOrchestratorConfigInput = {},
  sessionId?: string,
): OrchestratorConfigWithAnalytics {
  const resolved = resolveOrchestratorConfig(input);
  const mlVector = extractOrchestratorConfigMLVector(resolved);
  const dlTensor = buildOrchestratorConfigDLTensor(resolved);
  const chatSignal = buildOrchestratorConfigChatSignal(resolved);
  const inspection = inspectResolvedOrchestratorConfig(resolved);
  const trendAnalyzer = new OrchestratorConfigTrendAnalyzer(64);
  const analytics = new OrchestratorConfigSessionAnalytics(
    sessionId ?? `oc-session-${Date.now()}`,
  );

  trendAnalyzer.record(resolved);
  analytics.record(resolved);

  return Object.freeze({
    resolved,
    mlVector,
    dlTensor,
    chatSignal,
    inspection,
    trendAnalyzer,
    sessionAnalytics: analytics,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// PROFILE RESOLUTION INSPECTOR — surfaces which policies are active for a profile
// ────────────────────────────────────────────────────────────────────────────────

export interface ProfileResolutionSummary {
  readonly profileId: OrchestratorProfileId;
  readonly label: string;
  readonly notes: readonly string[];
  readonly safetyOverrideCount: number;
  readonly eventOverrideCount: number;
  readonly diagnosticsOverrideCount: number;
  readonly lifecycleOverrideCount: number;
  readonly stepOverrideCount: number;
  readonly hasModeOverrides: boolean;
  readonly hasRequiredEngineOverrides: boolean;
  readonly resolvedFingerprint: string;
}

function countDefinedKeys(obj: Record<string, unknown> | undefined): number {
  if (!obj) {
    return 0;
  }
  return Object.keys(obj).filter((k) => obj[k] !== undefined).length;
}

/**
 * buildProfileResolutionSummary
 *
 * Summarizes which policy layers a specific profile activates and how many
 * overrides it introduces relative to the base config defaults.
 *
 * Usage:
 *   const config = createProductionOrchestratorConfig();
 *   const summary = buildProfileResolutionSummary(config, 'production');
 *   // summary.safetyOverrideCount, summary.hasModeOverrides
 */
export function buildProfileResolutionSummary(
  config: OrchestratorConfig,
  profileId: OrchestratorProfileId,
): ProfileResolutionSummary {
  const profile = config.profiles[profileId];
  if (!profile) {
    throw new Error(`[OrchestratorConfig] Profile not found: ${profileId}`);
  }

  const resolved = resolveOrchestratorConfig({ config, profileId });
  const safetyOverrideCount = countDefinedKeys(profile.safety as Record<string, unknown> | undefined);
  const eventOverrideCount = countDefinedKeys(profile.events as Record<string, unknown> | undefined);
  const diagnosticsOverrideCount = countDefinedKeys(profile.diagnostics as Record<string, unknown> | undefined);
  const lifecycleOverrideCount = countDefinedKeys(profile.lifecycle as Record<string, unknown> | undefined);
  const stepOverrideCount = profile.stepConfig
    ? Object.keys(profile.stepConfig).length
    : 0;

  return Object.freeze({
    profileId,
    label: profile.label,
    notes: profile.notes,
    safetyOverrideCount,
    eventOverrideCount,
    diagnosticsOverrideCount,
    lifecycleOverrideCount,
    stepOverrideCount,
    hasModeOverrides: !!(profile.modeOverrides && Object.keys(profile.modeOverrides).length > 0),
    hasRequiredEngineOverrides: !!(profile.requiredEngineIds && profile.requiredEngineIds.length > 0),
    resolvedFingerprint: resolved.fingerprint,
  });
}

/**
 * buildAllProfileResolutionSummaries
 *
 * Builds a ProfileResolutionSummary for every registered profile in the config.
 * Useful for ops-board displays that need to enumerate all active policy layers.
 */
export function buildAllProfileResolutionSummaries(
  config: OrchestratorConfig,
): readonly ProfileResolutionSummary[] {
  return Object.freeze(
    ZERO_ORCHESTRATOR_PROFILE_IDS.map((profileId) =>
      buildProfileResolutionSummary(config, profileId),
    ),
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// MODE RESOLUTION INSPECTOR — surfaces effective policy for a mode
// ────────────────────────────────────────────────────────────────────────────────

export interface ModeResolutionSummary {
  readonly mode: ModeCode;
  readonly resolvedProfileId: OrchestratorProfileId;
  readonly safetyLevel: OrchestratorConfigSafetyLevel;
  readonly enabledStepCount: number;
  readonly disabledStepCount: number;
  readonly disabledSteps: readonly TickStep[];
  readonly fingerprint: string;
  readonly mlVector: OrchestratorConfigMLVector;
  readonly chatSignal: OrchestratorConfigChatSignal;
  readonly notes: readonly string[];
}

/**
 * buildModeResolutionSummary
 *
 * Resolves the effective config for a mode + profile pair and returns the full
 * policy summary including ML vector and chat signal.
 *
 * Usage:
 *   const config = createProductionOrchestratorConfig();
 *   const summary = buildModeResolutionSummary(config, 'pvp', 'tournament');
 */
export function buildModeResolutionSummary(
  config: OrchestratorConfig,
  mode: ModeCode,
  profileId?: OrchestratorProfileId,
): ModeResolutionSummary {
  const resolved = resolveOrchestratorConfig({ config, mode, profileId });
  const mlVector = extractOrchestratorConfigMLVector(resolved);
  const chatSignal = buildOrchestratorConfigChatSignal(resolved);

  return Object.freeze({
    mode,
    resolvedProfileId: resolved.resolvedProfileId,
    safetyLevel: chatSignal.safetyLevel,
    enabledStepCount: chatSignal.enabledStepCount,
    disabledStepCount: chatSignal.disabledStepCount,
    disabledSteps: chatSignal.disabledSteps,
    fingerprint: resolved.fingerprint,
    mlVector,
    chatSignal,
    notes: config.modePolicies[mode].notes ?? Object.freeze([]),
  });
}

/**
 * buildAllModeResolutionSummaries
 *
 * Builds a ModeResolutionSummary for all four supported modes under a given profile.
 */
export function buildAllModeResolutionSummaries(
  config: OrchestratorConfig,
  profileId?: OrchestratorProfileId,
): readonly ModeResolutionSummary[] {
  return Object.freeze(
    ZERO_SUPPORTED_MODES.map((mode) =>
      buildModeResolutionSummary(config, mode, profileId),
    ),
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// EXPORTED ANALYTICS SINGLETONS — pre-built bundle for the default config
// ────────────────────────────────────────────────────────────────────────────────

/**
 * ZERO_DEFAULT_ORCHESTRATOR_CONFIG_BUNDLE
 *
 * Full analytics bundle for the default OrchestratorConfig. Includes the resolved
 * config, ML vector, DL tensor, chat signal, inspection result, trend analyzer,
 * and session analytics — all seeded from the default profile.
 *
 * Usage:
 *   import { Zero } from '../../engine';
 *   const vec = Zero.ZERO_DEFAULT_ORCHESTRATOR_CONFIG_BUNDLE.mlVector;
 *   const tensor = Zero.ZERO_DEFAULT_ORCHESTRATOR_CONFIG_BUNDLE.dlTensor;
 *   const signal = Zero.ZERO_DEFAULT_ORCHESTRATOR_CONFIG_BUNDLE.chatSignal;
 */
export const ZERO_DEFAULT_ORCHESTRATOR_CONFIG_BUNDLE: OrchestratorConfigWithAnalytics =
  createOrchestratorConfigWithAnalytics({}, 'zero-default-session');

/**
 * ZERO_PRODUCTION_ORCHESTRATOR_CONFIG_BUNDLE
 *
 * Full analytics bundle for the production-profile OrchestratorConfig.
 */
export const ZERO_PRODUCTION_ORCHESTRATOR_CONFIG_BUNDLE: OrchestratorConfigWithAnalytics =
  createOrchestratorConfigWithAnalytics({ profileId: 'production' }, 'zero-production-session');

/**
 * ZERO_TOURNAMENT_ORCHESTRATOR_CONFIG_BUNDLE
 *
 * Full analytics bundle for the tournament-profile OrchestratorConfig.
 * Carries the strictest safety posture — isTournamentGrade === true.
 */
export const ZERO_TOURNAMENT_ORCHESTRATOR_CONFIG_BUNDLE: OrchestratorConfigWithAnalytics =
  createOrchestratorConfigWithAnalytics({ profileId: 'tournament' }, 'zero-tournament-session');

/**
 * ZERO_ORCHESTRATOR_CONFIG_TREND_ANALYZER
 *
 * Singleton OrchestratorConfigTrendAnalyzer seeded with the default, production,
 * and tournament configs. Ready-to-use for in-process orchestration monitoring.
 */
export const ZERO_ORCHESTRATOR_CONFIG_TREND_ANALYZER: OrchestratorConfigTrendAnalyzer =
  (() => {
    const analyzer = new OrchestratorConfigTrendAnalyzer(128);
    analyzer.record(ZERO_DEFAULT_ORCHESTRATOR_CONFIG_BUNDLE.resolved);
    analyzer.record(ZERO_PRODUCTION_ORCHESTRATOR_CONFIG_BUNDLE.resolved);
    analyzer.record(ZERO_TOURNAMENT_ORCHESTRATOR_CONFIG_BUNDLE.resolved);
    return analyzer;
  })();

/**
 * ZERO_ORCHESTRATOR_CONFIG_SESSION_ANALYTICS
 *
 * Singleton OrchestratorConfigSessionAnalytics for the process lifetime.
 * Consumers should call .record(resolved) on each config resolution to accumulate
 * session history. Call .buildReport() for the full aggregate.
 */
export const ZERO_ORCHESTRATOR_CONFIG_SESSION_ANALYTICS: OrchestratorConfigSessionAnalytics =
  new OrchestratorConfigSessionAnalytics('zero-process-session');

/**
 * ZERO_DEFAULT_ORCHESTRATOR_ML_VECTOR
 *
 * Pre-computed 32-dimensional ML vector for the default OrchestratorConfig.
 * Useful as a baseline reference for ML distance computations.
 */
export const ZERO_DEFAULT_ORCHESTRATOR_ML_VECTOR: OrchestratorConfigMLVector =
  ZERO_DEFAULT_ORCHESTRATOR_CONFIG_BUNDLE.mlVector;

/**
 * ZERO_DEFAULT_ORCHESTRATOR_DL_TENSOR
 *
 * Pre-computed 13×10 DL tensor for the default OrchestratorConfig.
 */
export const ZERO_DEFAULT_ORCHESTRATOR_DL_TENSOR: OrchestratorConfigDLTensor =
  ZERO_DEFAULT_ORCHESTRATOR_CONFIG_BUNDLE.dlTensor;

/**
 * ZERO_DEFAULT_ORCHESTRATOR_CHAT_SIGNAL
 *
 * Pre-built OrchestratorConfigChatSignal for the default config — useful as a
 * baseline or placeholder before a run-specific config is resolved.
 */
export const ZERO_DEFAULT_ORCHESTRATOR_CHAT_SIGNAL: OrchestratorConfigChatSignal =
  ZERO_DEFAULT_ORCHESTRATOR_CONFIG_BUNDLE.chatSignal;

/**
 * ZERO_ALL_PROFILE_SUMMARIES
 *
 * Pre-built ProfileResolutionSummary for all registered profiles under the
 * default config. Consumed by ops-board renderers and config audit surfaces.
 */
export const ZERO_ALL_PROFILE_SUMMARIES: readonly ProfileResolutionSummary[] =
  buildAllProfileResolutionSummaries(ZERO_DEFAULT_ORCHESTRATOR_CONFIG);

/**
 * ZERO_ALL_MODE_SUMMARIES_DEFAULT_PROFILE
 *
 * Pre-built ModeResolutionSummary for all four game modes under the default profile.
 */
export const ZERO_ALL_MODE_SUMMARIES_DEFAULT_PROFILE: readonly ModeResolutionSummary[] =
  buildAllModeResolutionSummaries(ZERO_DEFAULT_ORCHESTRATOR_CONFIG);

/**
 * ZERO_ALL_MODE_SUMMARIES_PRODUCTION_PROFILE
 *
 * Pre-built ModeResolutionSummary for all four game modes under the production profile.
 */
export const ZERO_ALL_MODE_SUMMARIES_PRODUCTION_PROFILE: readonly ModeResolutionSummary[] =
  buildAllModeResolutionSummaries(ZERO_PRODUCTION_ORCHESTRATOR_CONFIG, 'production');

