/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickPlan.ts
 *
 * Doctrine:
 * - zero wraps backend/core TickSequence rather than duplicating it
 * - step enablement is policy-driven, deterministic, and queryable
 * - tick planning is a control-surface concern, not a simulation concern
 * - this file does not invent a parallel runtime; it resolves and inspects the
 *   live backend sequence, step descriptors, owners, and zero-layer policies
 * - the plan must be stable enough for replay, diagnostics, proof, and load
 *   shedding without flattening repo-specific orchestration contracts
 */

import {
  TICK_SEQUENCE,
  TICK_STEP_DESCRIPTORS,
  getNextTickStep,
  getPreviousTickStep,
  getTickStepIndex,
  isEngineExecutionStep,
  type TickStep,
  type TickStepDescriptor,
  type TickStepPhase,
} from '../core/TickSequence';
import type { ModeCode, RunOutcome } from '../core/GamePrimitives';
import {
  ZERO_CANONICAL_TICK_SEQUENCE,
  ZERO_TICK_STEP_DESCRIPTORS,
  type RunLifecycleState,
  type StepRuntimeOwner,
  type TickPlanEntry,
  type TickPlanSnapshot,
} from './zero.types';
import {
  assertValidOrchestratorConfig,
  createDefaultOrchestratorConfig,
  resolveOrchestratorConfig,
  type OrchestratorConfig,
  type OrchestratorStepEventExpectation,
  type ResolveOrchestratorConfigInput,
  type ResolvedOrchestratorConfig,
  type ResolvedOrchestratorStepPolicy,
} from './OrchestratorConfig';

// ────────────────────────────────────────────────────────────────────────────────
// local exported planning surfaces
// ────────────────────────────────────────────────────────────────────────────────

export type TickPlanValidationSeverity = 'WARN' | 'ERROR';

export interface TickPlanIssue {
  readonly severity: TickPlanValidationSeverity;
  readonly code: string;
  readonly step: TickStep | 'PLAN';
  readonly message: string;
}

export interface TickPlanValidationReport {
  readonly valid: boolean;
  readonly errors: readonly TickPlanIssue[];
  readonly warnings: readonly TickPlanIssue[];
  readonly fingerprint: string;
}

export interface TickPlanPhaseSlice {
  readonly phase: TickStepPhase;
  readonly entries: readonly TickPlanEntry[];
  readonly enabledEntries: readonly TickPlanEntry[];
  readonly disabledEntries: readonly TickPlanEntry[];
  readonly size: number;
  readonly enabledCount: number;
  readonly disabledCount: number;
}

export interface TickPlanOwnerSlice {
  readonly owner: StepRuntimeOwner;
  readonly entries: readonly TickPlanEntry[];
  readonly enabledEntries: readonly TickPlanEntry[];
  readonly disabledEntries: readonly TickPlanEntry[];
  readonly size: number;
  readonly enabledCount: number;
  readonly disabledCount: number;
}

export interface TickPlanStepDependency {
  readonly step: TickStep;
  readonly directPrerequisites: readonly TickStep[];
  readonly transitivePrerequisites: readonly TickStep[];
  readonly directDependents: readonly TickStep[];
  readonly transitiveDependents: readonly TickStep[];
}

export interface TickPlanWindowSnapshot {
  readonly fromStep: TickStep;
  readonly toStep: TickStep;
  readonly inclusive: boolean;
  readonly entries: readonly TickPlanEntry[];
  readonly enabledEntries: readonly TickPlanEntry[];
  readonly disabledEntries: readonly TickPlanEntry[];
  readonly size: number;
}

export interface TickPlanCursor {
  readonly step: TickStep;
  readonly ordinal: number;
  readonly enabled: boolean;
  readonly owner: StepRuntimeOwner;
  readonly phase: TickStepPhase;
  readonly previousStep: TickStep | null;
  readonly nextStep: TickStep | null;
  readonly previousEnabledStep: TickStep | null;
  readonly nextEnabledStep: TickStep | null;
  readonly previousDisabledStep: TickStep | null;
  readonly nextDisabledStep: TickStep | null;
  readonly enabledOrdinal: number | null;
}

export interface TickPlanComparisonReport {
  readonly identical: boolean;
  readonly sameFingerprint: boolean;
  readonly sameEnabledSteps: boolean;
  readonly fingerprintLeft: string;
  readonly fingerprintRight: string;
  readonly enabledOnlyOnLeft: readonly TickStep[];
  readonly enabledOnlyOnRight: readonly TickStep[];
  readonly ownerMismatches: readonly TickStep[];
  readonly phaseMismatches: readonly TickStep[];
}

export interface TickPlanSummary {
  readonly fingerprint: string;
  readonly totalSteps: number;
  readonly enabledSteps: number;
  readonly disabledSteps: number;
  readonly firstEnabledStep: TickStep | null;
  readonly lastEnabledStep: TickStep | null;
  readonly enabledEngineSteps: number;
  readonly enabledFinalizationSteps: number;
  readonly enabledObservabilitySteps: number;
  readonly enabledModeSteps: number;
  readonly enabledOrchestrationSteps: number;
  readonly profileId: string;
  readonly mode: ModeCode | null;
  readonly lifecycleState: RunLifecycleState | null;
  readonly terminalOutcome: RunOutcome | null;
  readonly requiresSealBeforeFlush: boolean;
  readonly flushAtFinalStepOnly: boolean;
  readonly warnings: readonly string[];
}

export interface TickPlanBuildInput {
  readonly config?: OrchestratorConfig;
  readonly overrides?: ResolveOrchestratorConfigInput['overrides'];
  readonly profileId?: ResolveOrchestratorConfigInput['profileId'];
  readonly mode?: ResolveOrchestratorConfigInput['mode'];
  readonly lifecycleState?: ResolveOrchestratorConfigInput['lifecycleState'];
  readonly outcome?: ResolveOrchestratorConfigInput['outcome'];
}

// ────────────────────────────────────────────────────────────────────────────────
// canonical plan constants
// ────────────────────────────────────────────────────────────────────────────────

export const ZERO_TICK_PLAN_PHASES = Object.freeze([
  'ORCHESTRATION',
  'ENGINE',
  'MODE',
  'OBSERVABILITY',
  'FINALIZATION',
] as const satisfies readonly TickStepPhase[]);

export const ZERO_TICK_PLAN_OWNERS = Object.freeze([
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

export const ZERO_TICK_PLAN_BOUNDARY_STEPS = Object.freeze([
  'STEP_01_PREPARE',
  'STEP_12_EVENT_SEAL',
  'STEP_13_FLUSH',
] as const satisfies readonly TickStep[]);

export const ZERO_TICK_PLAN_CRITICAL_STEPS = Object.freeze([
  'STEP_01_PREPARE',
  'STEP_11_OUTCOME_GATE',
  'STEP_12_EVENT_SEAL',
  'STEP_13_FLUSH',
] as const satisfies readonly TickStep[]);

export const ZERO_TICK_PLAN_PHASE_BY_STEP: Readonly<Record<TickStep, TickStepPhase>> =
  Object.freeze(
    TICK_SEQUENCE.reduce<Record<TickStep, TickStepPhase>>((accumulator, step) => {
      accumulator[step] = TICK_STEP_DESCRIPTORS[step].phase;
      return accumulator;
    }, {} as Record<TickStep, TickStepPhase>),
  );

export const ZERO_TICK_PLAN_OWNER_BY_STEP: Readonly<Record<TickStep, StepRuntimeOwner>> =
  Object.freeze(
    TICK_SEQUENCE.reduce<Record<TickStep, StepRuntimeOwner>>((accumulator, step) => {
      accumulator[step] = TICK_STEP_DESCRIPTORS[step].owner as StepRuntimeOwner;
      return accumulator;
    }, {} as Record<TickStep, StepRuntimeOwner>),
  );

export const ZERO_TICK_PLAN_DIRECT_DEPENDENCIES: Readonly<Record<TickStep, readonly TickStep[]>> =
  Object.freeze({
    STEP_01_PREPARE: Object.freeze<TickStep[]>([]),
    STEP_02_TIME: Object.freeze<TickStep[]>(['STEP_01_PREPARE']),
    STEP_03_PRESSURE: Object.freeze<TickStep[]>(['STEP_02_TIME']),
    STEP_04_TENSION: Object.freeze<TickStep[]>(['STEP_03_PRESSURE']),
    STEP_05_BATTLE: Object.freeze<TickStep[]>(['STEP_04_TENSION']),
    STEP_06_SHIELD: Object.freeze<TickStep[]>(['STEP_05_BATTLE']),
    STEP_07_CASCADE: Object.freeze<TickStep[]>(['STEP_06_SHIELD']),
    STEP_08_MODE_POST: Object.freeze<TickStep[]>(['STEP_07_CASCADE']),
    STEP_09_TELEMETRY: Object.freeze<TickStep[]>(['STEP_08_MODE_POST']),
    STEP_10_SOVEREIGNTY_SNAPSHOT: Object.freeze<TickStep[]>(['STEP_09_TELEMETRY']),
    STEP_11_OUTCOME_GATE: Object.freeze<TickStep[]>(['STEP_10_SOVEREIGNTY_SNAPSHOT']),
    STEP_12_EVENT_SEAL: Object.freeze<TickStep[]>(['STEP_11_OUTCOME_GATE']),
    STEP_13_FLUSH: Object.freeze<TickStep[]>(['STEP_12_EVENT_SEAL']),
  });

// semantic expectations are stronger than bare sequence order. they do not create
// a second runtime; they simply document what downstream zero logic assumes when a
// step is enabled in a plan.
export const ZERO_TICK_PLAN_SEMANTIC_DEPENDENCIES: Readonly<Record<TickStep, readonly TickStep[]>> =
  Object.freeze({
    STEP_01_PREPARE: Object.freeze<TickStep[]>([]),
    STEP_02_TIME: Object.freeze<TickStep[]>(['STEP_01_PREPARE']),
    STEP_03_PRESSURE: Object.freeze<TickStep[]>(['STEP_01_PREPARE', 'STEP_02_TIME']),
    STEP_04_TENSION: Object.freeze<TickStep[]>(['STEP_01_PREPARE', 'STEP_02_TIME', 'STEP_03_PRESSURE']),
    STEP_05_BATTLE: Object.freeze<TickStep[]>(['STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION']),
    STEP_06_SHIELD: Object.freeze<TickStep[]>(['STEP_02_TIME', 'STEP_05_BATTLE']),
    STEP_07_CASCADE: Object.freeze<TickStep[]>(['STEP_05_BATTLE', 'STEP_06_SHIELD']),
    STEP_08_MODE_POST: Object.freeze<TickStep[]>(['STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_07_CASCADE']),
    STEP_09_TELEMETRY: Object.freeze<TickStep[]>(['STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION', 'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_07_CASCADE', 'STEP_08_MODE_POST']),
    STEP_10_SOVEREIGNTY_SNAPSHOT: Object.freeze<TickStep[]>(['STEP_09_TELEMETRY']),
    STEP_11_OUTCOME_GATE: Object.freeze<TickStep[]>(['STEP_10_SOVEREIGNTY_SNAPSHOT']),
    STEP_12_EVENT_SEAL: Object.freeze<TickStep[]>(['STEP_09_TELEMETRY', 'STEP_10_SOVEREIGNTY_SNAPSHOT', 'STEP_11_OUTCOME_GATE']),
    STEP_13_FLUSH: Object.freeze<TickStep[]>(['STEP_12_EVENT_SEAL']),
  });

// ────────────────────────────────────────────────────────────────────────────────
// local helpers
// ────────────────────────────────────────────────────────────────────────────────

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function freezeRecord<K extends PropertyKey, V>(record: Record<K, V>): Readonly<Record<K, V>> {
  return Object.freeze({ ...record });
}

function freezeEntry(entry: TickPlanEntry): TickPlanEntry {
  return Object.freeze({ ...entry });
}

function simpleFingerprint(value: unknown): string {
  const input = JSON.stringify(value);
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `tp_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function sortByStepOrdinal(steps: readonly TickStep[]): readonly TickStep[] {
  return freezeArray(
    [...steps].sort((left, right) => getTickStepIndex(left) - getTickStepIndex(right)),
  );
}

function uniqueSteps(steps: readonly TickStep[]): readonly TickStep[] {
  const seen = new Set<TickStep>();
  const ordered: TickStep[] = [];

  for (const step of steps) {
    if (seen.has(step)) {
      continue;
    }
    seen.add(step);
    ordered.push(step);
  }

  return freezeArray(ordered);
}

function createStepEntry(
  step: TickStep,
  policy: ResolvedOrchestratorStepPolicy,
): TickPlanEntry {
  return freezeEntry({
    step,
    descriptor: policy.descriptor,
    enabled: policy.enabled,
  });
}

function resolveBuildInput(input?: TickPlanBuildInput): ResolvedOrchestratorConfig {
  if (!input) {
    return resolveOrchestratorConfig({
      config: createDefaultOrchestratorConfig(),
    });
  }

  if (input.config) {
    assertValidOrchestratorConfig(input.config);
  }

  return resolveOrchestratorConfig({
    config: input.config,
    overrides: input.overrides,
    profileId: input.profileId,
    mode: input.mode,
    lifecycleState: input.lifecycleState,
    outcome: input.outcome,
  });
}

function isResolvedConfig(value: unknown): value is ResolvedOrchestratorConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(value, 'resolvedProfileId')
    && Object.prototype.hasOwnProperty.call(value, 'stepConfig')
    && Object.prototype.hasOwnProperty.call(value, 'tickPlan');
}

function resolveInput(
  input?: TickPlanBuildInput | OrchestratorConfig | ResolvedOrchestratorConfig,
): ResolvedOrchestratorConfig {
  if (input === undefined) {
    return resolveBuildInput();
  }

  if (isResolvedConfig(input)) {
    return input;
  }

  if (
    typeof input === 'object'
    && input !== null
    && Object.prototype.hasOwnProperty.call(input, 'metadata')
    && Object.prototype.hasOwnProperty.call(input, 'profiles')
  ) {
    return resolveOrchestratorConfig({
      config: assertValidOrchestratorConfig(input as OrchestratorConfig),
    });
  }

  return resolveBuildInput(input as TickPlanBuildInput);
}

function buildEntries(
  stepConfig: Readonly<Record<TickStep, ResolvedOrchestratorStepPolicy>>,
): readonly TickPlanEntry[] {
  return freezeArray(
    TICK_SEQUENCE.map((step) => createStepEntry(step, stepConfig[step])),
  );
}

function buildEntryByStep(entries: readonly TickPlanEntry[]): Readonly<Record<TickStep, TickPlanEntry>> {
  const record = {} as Record<TickStep, TickPlanEntry>;

  for (const entry of entries) {
    record[entry.step] = entry;
  }

  return freezeRecord(record);
}

function buildIndexByStep(entries: readonly TickPlanEntry[]): Readonly<Record<TickStep, number>> {
  const record = {} as Record<TickStep, number>;

  entries.forEach((entry, index) => {
    record[entry.step] = index;
  });

  return freezeRecord(record);
}

function buildEnabledIndexByStep(entries: readonly TickPlanEntry[]): Readonly<Record<TickStep, number | null>> {
  const record = {} as Record<TickStep, number | null>;
  let enabledOrdinal = 0;

  for (const entry of entries) {
    if (entry.enabled) {
      record[entry.step] = enabledOrdinal;
      enabledOrdinal += 1;
    } else {
      record[entry.step] = null;
    }
  }

  return freezeRecord(record);
}

function buildPhaseSlices(entries: readonly TickPlanEntry[]): Readonly<Record<TickStepPhase, TickPlanPhaseSlice>> {
  const record = {} as Record<TickStepPhase, TickPlanPhaseSlice>;

  for (const phase of ZERO_TICK_PLAN_PHASES) {
    const phaseEntries = entries.filter((entry) => entry.descriptor.phase === phase);
    const enabledEntries = phaseEntries.filter((entry) => entry.enabled);
    const disabledEntries = phaseEntries.filter((entry) => !entry.enabled);

    record[phase] = Object.freeze({
      phase,
      entries: freezeArray(phaseEntries),
      enabledEntries: freezeArray(enabledEntries),
      disabledEntries: freezeArray(disabledEntries),
      size: phaseEntries.length,
      enabledCount: enabledEntries.length,
      disabledCount: disabledEntries.length,
    });
  }

  return freezeRecord(record);
}

function buildOwnerSlices(entries: readonly TickPlanEntry[]): Readonly<Record<StepRuntimeOwner, TickPlanOwnerSlice>> {
  const record = {} as Record<StepRuntimeOwner, TickPlanOwnerSlice>;

  for (const owner of ZERO_TICK_PLAN_OWNERS) {
    const ownerEntries = entries.filter((entry) => (entry.descriptor.owner as StepRuntimeOwner) === owner);
    const enabledEntries = ownerEntries.filter((entry) => entry.enabled);
    const disabledEntries = ownerEntries.filter((entry) => !entry.enabled);

    record[owner] = Object.freeze({
      owner,
      entries: freezeArray(ownerEntries),
      enabledEntries: freezeArray(enabledEntries),
      disabledEntries: freezeArray(disabledEntries),
      size: ownerEntries.length,
      enabledCount: enabledEntries.length,
      disabledCount: disabledEntries.length,
    });
  }

  return freezeRecord(record);
}

function buildDirectDependents(): Readonly<Record<TickStep, readonly TickStep[]>> {
  const record = {} as Record<TickStep, TickStep[]>;

  for (const step of TICK_SEQUENCE) {
    record[step] = [];
  }

  for (const step of TICK_SEQUENCE) {
    for (const dependency of ZERO_TICK_PLAN_DIRECT_DEPENDENCIES[step]) {
      record[dependency].push(step);
    }
  }

  return freezeRecord(
    TICK_SEQUENCE.reduce<Record<TickStep, readonly TickStep[]>>((accumulator, step) => {
      accumulator[step] = freezeArray(record[step]);
      return accumulator;
    }, {} as Record<TickStep, readonly TickStep[]>),
  );
}

const ZERO_TICK_PLAN_DIRECT_DEPENDENTS = buildDirectDependents();

function collectTransitivePrerequisites(step: TickStep, seen = new Set<TickStep>()): readonly TickStep[] {
  const collected: TickStep[] = [];

  for (const dependency of ZERO_TICK_PLAN_DIRECT_DEPENDENCIES[step]) {
    if (seen.has(dependency)) {
      continue;
    }

    seen.add(dependency);
    collected.push(dependency);
    for (const transitive of collectTransitivePrerequisites(dependency, seen)) {
      collected.push(transitive);
    }
  }

  return uniqueSteps(sortByStepOrdinal(collected));
}

function collectTransitiveDependents(step: TickStep, seen = new Set<TickStep>()): readonly TickStep[] {
  const collected: TickStep[] = [];

  for (const dependent of ZERO_TICK_PLAN_DIRECT_DEPENDENTS[step]) {
    if (seen.has(dependent)) {
      continue;
    }

    seen.add(dependent);
    collected.push(dependent);
    for (const transitive of collectTransitiveDependents(dependent, seen)) {
      collected.push(transitive);
    }
  }

  return uniqueSteps(sortByStepOrdinal(collected));
}

function buildDependencyMap(): Readonly<Record<TickStep, TickPlanStepDependency>> {
  const record = {} as Record<TickStep, TickPlanStepDependency>;

  for (const step of TICK_SEQUENCE) {
    record[step] = Object.freeze({
      step,
      directPrerequisites: ZERO_TICK_PLAN_DIRECT_DEPENDENCIES[step],
      transitivePrerequisites: collectTransitivePrerequisites(step),
      directDependents: ZERO_TICK_PLAN_DIRECT_DEPENDENTS[step],
      transitiveDependents: collectTransitiveDependents(step),
    });
  }

  return freezeRecord(record);
}

const ZERO_TICK_PLAN_DEPENDENCY_MAP = buildDependencyMap();

function sliceWindow(
  entries: readonly TickPlanEntry[],
  fromStep: TickStep,
  toStep: TickStep,
  inclusive: boolean,
): TickPlanWindowSnapshot {
  const fromIndex = getTickStepIndex(fromStep);
  const toIndex = getTickStepIndex(toStep);

  if (fromIndex > toIndex) {
    throw new Error(`[TickPlan] Invalid window: ${fromStep} cannot begin after ${toStep}.`);
  }

  const start = inclusive ? fromIndex : fromIndex + 1;
  const end = inclusive ? toIndex + 1 : toIndex;
  const sliced = freezeArray(entries.slice(start, end));
  const enabledEntries = freezeArray(sliced.filter((entry) => entry.enabled));
  const disabledEntries = freezeArray(sliced.filter((entry) => !entry.enabled));

  return Object.freeze({
    fromStep,
    toStep,
    inclusive,
    entries: sliced,
    enabledEntries,
    disabledEntries,
    size: sliced.length,
  });
}

function issue(
  severity: TickPlanValidationSeverity,
  code: string,
  step: TickStep | 'PLAN',
  message: string,
): TickPlanIssue {
  return Object.freeze({ severity, code, step, message });
}

function summarizeWarnings(report: TickPlanValidationReport): readonly string[] {
  return freezeArray(
    report.warnings.map((warning) => `${warning.code}:${warning.step}:${warning.message}`),
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// TickPlan
// ────────────────────────────────────────────────────────────────────────────────

export class TickPlan {
  private readonly resolved: ResolvedOrchestratorConfig;
  private readonly entriesInternal: readonly TickPlanEntry[];
  private readonly entryByStep: Readonly<Record<TickStep, TickPlanEntry>>;
  private readonly indexByStep: Readonly<Record<TickStep, number>>;
  private readonly enabledIndexByStep: Readonly<Record<TickStep, number | null>>;
  private readonly phaseSlicesInternal: Readonly<Record<TickStepPhase, TickPlanPhaseSlice>>;
  private readonly ownerSlicesInternal: Readonly<Record<StepRuntimeOwner, TickPlanOwnerSlice>>;
  private readonly enabledEntriesInternal: readonly TickPlanEntry[];
  private readonly disabledEntriesInternal: readonly TickPlanEntry[];
  private readonly dependenciesInternal: Readonly<Record<TickStep, TickPlanStepDependency>>;
  private readonly fingerprintInternal: string;
  private readonly validationInternal: TickPlanValidationReport;
  private readonly summaryInternal: TickPlanSummary;

  public constructor(
    input?: TickPlanBuildInput | OrchestratorConfig | ResolvedOrchestratorConfig,
  ) {
    this.resolved = resolveInput(input);
    this.entriesInternal = buildEntries(this.resolved.stepConfig);
    this.entryByStep = buildEntryByStep(this.entriesInternal);
    this.indexByStep = buildIndexByStep(this.entriesInternal);
    this.enabledIndexByStep = buildEnabledIndexByStep(this.entriesInternal);
    this.phaseSlicesInternal = buildPhaseSlices(this.entriesInternal);
    this.ownerSlicesInternal = buildOwnerSlices(this.entriesInternal);
    this.enabledEntriesInternal = freezeArray(this.entriesInternal.filter((entry) => entry.enabled));
    this.disabledEntriesInternal = freezeArray(this.entriesInternal.filter((entry) => !entry.enabled));
    this.dependenciesInternal = ZERO_TICK_PLAN_DEPENDENCY_MAP;
    this.fingerprintInternal = this.buildFingerprint();
    this.validationInternal = this.buildValidationReport();
    this.summaryInternal = this.buildSummary();
  }

  // ── identity / config access ────────────────────────────────────────────────

  public resolvedConfig(): ResolvedOrchestratorConfig {
    return this.resolved;
  }

  public config(): OrchestratorConfig {
    return this.resolved.config;
  }

  public profileId(): string {
    return this.resolved.resolvedProfileId;
  }

  public mode(): ModeCode | null {
    return this.resolved.resolvedMode;
  }

  public lifecycleState(): RunLifecycleState | null {
    return this.resolved.resolvedLifecycleState;
  }

  public terminalOutcome(): RunOutcome | null {
    return this.resolved.lifecycle.autoFinalizeProofOnTerminalOutcome
      ? this.resolved.lifecycle.terminalOutcomePriority[0] ?? null
      : null;
  }

  public fingerprint(): string {
    return this.fingerprintInternal;
  }

  public validation(): TickPlanValidationReport {
    return this.validationInternal;
  }

  public assertValid(): this {
    if (!this.validationInternal.valid) {
      const firstError = this.validationInternal.errors[0];
      throw new Error(
        `[TickPlan] ${firstError?.code ?? 'INVALID_PLAN'}: ${firstError?.message ?? 'Plan is invalid.'}`,
      );
    }

    return this;
  }

  public summary(): TickPlanSummary {
    return this.summaryInternal;
  }

  // ── full plan snapshots ─────────────────────────────────────────────────────

  public snapshot(): TickPlanSnapshot {
    return Object.freeze({
      entries: this.entriesInternal,
      size: this.entriesInternal.length,
    });
  }

  public entries(): readonly TickPlanEntry[] {
    return this.entriesInternal;
  }

  public enabledEntries(): readonly TickPlanEntry[] {
    return this.enabledEntriesInternal;
  }

  public disabledEntries(): readonly TickPlanEntry[] {
    return this.disabledEntriesInternal;
  }

  public size(): number {
    return this.entriesInternal.length;
  }

  public enabledCount(): number {
    return this.enabledEntriesInternal.length;
  }

  public disabledCount(): number {
    return this.disabledEntriesInternal.length;
  }

  public hasDisabledSteps(): boolean {
    return this.disabledEntriesInternal.length > 0;
  }

  public hasEnabledSteps(): boolean {
    return this.enabledEntriesInternal.length > 0;
  }

  public isCanonicalSize(): boolean {
    return this.entriesInternal.length === ZERO_CANONICAL_TICK_SEQUENCE.length;
  }

  public isFullyEnabled(): boolean {
    return this.enabledEntriesInternal.length === this.entriesInternal.length;
  }

  public enabledSteps(): readonly TickStep[] {
    return freezeArray(this.enabledEntriesInternal.map((entry) => entry.step));
  }

  public disabledSteps(): readonly TickStep[] {
    return freezeArray(this.disabledEntriesInternal.map((entry) => entry.step));
  }

  // ── entry accessors ─────────────────────────────────────────────────────────

  public hasStep(step: TickStep): boolean {
    return step in this.entryByStep;
  }

  public getEntry(step: TickStep): TickPlanEntry {
    const entry = this.entryByStep[step];

    if (!entry) {
      throw new Error(`[TickPlan] Missing plan entry for step ${step}.`);
    }

    return entry;
  }

  public getDescriptor(step: TickStep): TickStepDescriptor {
    return this.getEntry(step).descriptor;
  }

  public getOwner(step: TickStep): StepRuntimeOwner {
    return this.getDescriptor(step).owner as StepRuntimeOwner;
  }

  public getPhase(step: TickStep): TickStepPhase {
    return this.getDescriptor(step).phase;
  }

  public getResolvedPolicy(step: TickStep): ResolvedOrchestratorStepPolicy {
    return this.resolved.stepConfig[step];
  }

  public getEventExpectation(step: TickStep): OrchestratorStepEventExpectation {
    return this.resolved.config.stepEventExpectations[step];
  }

  public getOrdinal(step: TickStep): number {
    return this.getDescriptor(step).ordinal;
  }

  public getIndex(step: TickStep): number {
    return this.indexByStep[step];
  }

  public getEnabledOrdinal(step: TickStep): number | null {
    return this.enabledIndexByStep[step];
  }

  public isEnabled(step: TickStep): boolean {
    return this.getEntry(step).enabled;
  }

  public isDisabled(step: TickStep): boolean {
    return !this.isEnabled(step);
  }

  public isCritical(step: TickStep): boolean {
    return (ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]).includes(step);
  }

  public isBoundary(step: TickStep): boolean {
    return (ZERO_TICK_PLAN_BOUNDARY_STEPS as readonly TickStep[]).includes(step);
  }

  public isEngineStep(step: TickStep): boolean {
    return isEngineExecutionStep(step);
  }

  public isFinalizationStep(step: TickStep): boolean {
    return this.getPhase(step) === 'FINALIZATION';
  }

  public isObservabilityStep(step: TickStep): boolean {
    return this.getPhase(step) === 'OBSERVABILITY';
  }

  public isModeStep(step: TickStep): boolean {
    return this.getPhase(step) === 'MODE';
  }

  public isOrchestrationStep(step: TickStep): boolean {
    return this.getPhase(step) === 'ORCHESTRATION';
  }

  public assertEnabled(step: TickStep): void {
    if (!this.isEnabled(step)) {
      throw new Error(`[TickPlan] Step ${step} is disabled by orchestrator policy.`);
    }
  }

  public assertCriticalEnabled(step: TickStep): void {
    if (this.isCritical(step) && !this.isEnabled(step)) {
      throw new Error(`[TickPlan] Critical step ${step} is disabled.`);
    }
  }

  // ── sequence navigation ─────────────────────────────────────────────────────

  public firstStep(): TickStep {
    return TICK_SEQUENCE[0];
  }

  public lastStep(): TickStep {
    return TICK_SEQUENCE[TICK_SEQUENCE.length - 1];
  }

  public firstEnabledStep(): TickStep | null {
    return this.enabledEntriesInternal[0]?.step ?? null;
  }

  public lastEnabledStep(): TickStep | null {
    return this.enabledEntriesInternal.length > 0
      ? this.enabledEntriesInternal[this.enabledEntriesInternal.length - 1].step
      : null;
  }

  public firstDisabledStep(): TickStep | null {
    return this.disabledEntriesInternal[0]?.step ?? null;
  }

  public lastDisabledStep(): TickStep | null {
    return this.disabledEntriesInternal.length > 0
      ? this.disabledEntriesInternal[this.disabledEntriesInternal.length - 1].step
      : null;
  }

  public nextStep(step: TickStep): TickStep | null {
    return getNextTickStep(step);
  }

  public previousStep(step: TickStep): TickStep | null {
    return getPreviousTickStep(step);
  }

  public nextEnabledStep(step: TickStep): TickStep | null {
    const start = this.getIndex(step) + 1;

    for (let index = start; index < this.entriesInternal.length; index += 1) {
      if (this.entriesInternal[index].enabled) {
        return this.entriesInternal[index].step;
      }
    }

    return null;
  }

  public previousEnabledStep(step: TickStep): TickStep | null {
    const start = this.getIndex(step) - 1;

    for (let index = start; index >= 0; index -= 1) {
      if (this.entriesInternal[index].enabled) {
        return this.entriesInternal[index].step;
      }
    }

    return null;
  }

  public nextDisabledStep(step: TickStep): TickStep | null {
    const start = this.getIndex(step) + 1;

    for (let index = start; index < this.entriesInternal.length; index += 1) {
      if (!this.entriesInternal[index].enabled) {
        return this.entriesInternal[index].step;
      }
    }

    return null;
  }

  public previousDisabledStep(step: TickStep): TickStep | null {
    const start = this.getIndex(step) - 1;

    for (let index = start; index >= 0; index -= 1) {
      if (!this.entriesInternal[index].enabled) {
        return this.entriesInternal[index].step;
      }
    }

    return null;
  }

  public cursor(step: TickStep): TickPlanCursor {
    const entry = this.getEntry(step);

    return Object.freeze({
      step,
      ordinal: entry.descriptor.ordinal,
      enabled: entry.enabled,
      owner: entry.descriptor.owner as StepRuntimeOwner,
      phase: entry.descriptor.phase,
      previousStep: this.previousStep(step),
      nextStep: this.nextStep(step),
      previousEnabledStep: this.previousEnabledStep(step),
      nextEnabledStep: this.nextEnabledStep(step),
      previousDisabledStep: this.previousDisabledStep(step),
      nextDisabledStep: this.nextDisabledStep(step),
      enabledOrdinal: this.getEnabledOrdinal(step),
    });
  }

  public canAdvance(fromStep: TickStep, toStep: TickStep): boolean {
    return this.getIndex(toStep) > this.getIndex(fromStep);
  }

  public canRetreat(fromStep: TickStep, toStep: TickStep): boolean {
    return this.getIndex(toStep) < this.getIndex(fromStep);
  }

  public distance(fromStep: TickStep, toStep: TickStep): number {
    return this.getIndex(toStep) - this.getIndex(fromStep);
  }

  // ── phase / owner slicing ───────────────────────────────────────────────────

  public phaseSlice(phase: TickStepPhase): TickPlanPhaseSlice {
    return this.phaseSlicesInternal[phase];
  }

  public ownerSlice(owner: StepRuntimeOwner): TickPlanOwnerSlice {
    return this.ownerSlicesInternal[owner];
  }

  public phases(): readonly TickStepPhase[] {
    return ZERO_TICK_PLAN_PHASES;
  }

  public owners(): readonly StepRuntimeOwner[] {
    return ZERO_TICK_PLAN_OWNERS;
  }

  public entriesByPhase(phase: TickStepPhase): readonly TickPlanEntry[] {
    return this.phaseSlice(phase).entries;
  }

  public enabledEntriesByPhase(phase: TickStepPhase): readonly TickPlanEntry[] {
    return this.phaseSlice(phase).enabledEntries;
  }

  public disabledEntriesByPhase(phase: TickStepPhase): readonly TickPlanEntry[] {
    return this.phaseSlice(phase).disabledEntries;
  }

  public entriesByOwner(owner: StepRuntimeOwner): readonly TickPlanEntry[] {
    return this.ownerSlice(owner).entries;
  }

  public enabledEntriesByOwner(owner: StepRuntimeOwner): readonly TickPlanEntry[] {
    return this.ownerSlice(owner).enabledEntries;
  }

  public disabledEntriesByOwner(owner: StepRuntimeOwner): readonly TickPlanEntry[] {
    return this.ownerSlice(owner).disabledEntries;
  }

  public engineEntries(): readonly TickPlanEntry[] {
    return freezeArray(this.entriesInternal.filter((entry) => entry.descriptor.phase === 'ENGINE'));
  }

  public finalizationEntries(): readonly TickPlanEntry[] {
    return this.phaseSlice('FINALIZATION').entries;
  }

  public observabilityEntries(): readonly TickPlanEntry[] {
    return this.phaseSlice('OBSERVABILITY').entries;
  }

  public modeEntries(): readonly TickPlanEntry[] {
    return this.phaseSlice('MODE').entries;
  }

  public orchestrationEntries(): readonly TickPlanEntry[] {
    return this.phaseSlice('ORCHESTRATION').entries;
  }

  // ── windows / ranges ────────────────────────────────────────────────────────

  public window(
    fromStep: TickStep,
    toStep: TickStep,
    inclusive = true,
  ): TickPlanWindowSnapshot {
    return sliceWindow(this.entriesInternal, fromStep, toStep, inclusive);
  }

  public enabledWindow(
    fromStep: TickStep,
    toStep: TickStep,
    inclusive = true,
  ): readonly TickPlanEntry[] {
    return this.window(fromStep, toStep, inclusive).enabledEntries;
  }

  public disabledWindow(
    fromStep: TickStep,
    toStep: TickStep,
    inclusive = true,
  ): readonly TickPlanEntry[] {
    return this.window(fromStep, toStep, inclusive).disabledEntries;
  }

  public before(step: TickStep, inclusive = false): TickPlanWindowSnapshot {
    return this.window(this.firstStep(), step, inclusive);
  }

  public after(step: TickStep, inclusive = false): TickPlanWindowSnapshot {
    return this.window(step, this.lastStep(), inclusive);
  }

  public between(left: TickStep, right: TickStep): TickPlanWindowSnapshot {
    return this.window(left, right, true);
  }

  public isWindowContiguous(
    fromStep: TickStep,
    toStep: TickStep,
    enabledOnly = true,
  ): boolean {
    const entries = enabledOnly
      ? this.enabledWindow(fromStep, toStep, true)
      : this.window(fromStep, toStep, true).entries;

    if (entries.length <= 1) {
      return true;
    }

    for (let index = 1; index < entries.length; index += 1) {
      const previous = entries[index - 1];
      const current = entries[index];
      if (getTickStepIndex(current.step) !== getTickStepIndex(previous.step) + 1) {
        return false;
      }
    }

    return true;
  }

  // ── dependencies ────────────────────────────────────────────────────────────

  public dependency(step: TickStep): TickPlanStepDependency {
    return this.dependenciesInternal[step];
  }

  public directPrerequisites(step: TickStep): readonly TickStep[] {
    return this.dependency(step).directPrerequisites;
  }

  public transitivePrerequisites(step: TickStep): readonly TickStep[] {
    return this.dependency(step).transitivePrerequisites;
  }

  public directDependents(step: TickStep): readonly TickStep[] {
    return this.dependency(step).directDependents;
  }

  public transitiveDependents(step: TickStep): readonly TickStep[] {
    return this.dependency(step).transitiveDependents;
  }

  public activePrerequisites(step: TickStep): readonly TickStep[] {
    const prerequisites = ZERO_TICK_PLAN_SEMANTIC_DEPENDENCIES[step].filter((dependency) => this.isEnabled(dependency));
    return uniqueSteps(sortByStepOrdinal(prerequisites));
  }

  public activeDependents(step: TickStep): readonly TickStep[] {
    const dependents = this.transitiveDependents(step).filter((candidate) => this.isEnabled(candidate));
    return uniqueSteps(sortByStepOrdinal(dependents));
  }

  public missingPrerequisites(
    step: TickStep,
    completedSteps: readonly TickStep[],
  ): readonly TickStep[] {
    const completed = new Set<TickStep>(completedSteps);
    const missing = this.activePrerequisites(step).filter((dependency) => !completed.has(dependency));
    return freezeArray(missing);
  }

  public dependenciesSatisfied(
    step: TickStep,
    completedSteps: readonly TickStep[],
  ): boolean {
    return this.missingPrerequisites(step, completedSteps).length === 0;
  }

  public assertDependenciesSatisfied(
    step: TickStep,
    completedSteps: readonly TickStep[],
  ): void {
    const missing = this.missingPrerequisites(step, completedSteps);

    if (missing.length > 0) {
      throw new Error(
        `[TickPlan] Step ${step} cannot execute. Missing prerequisites: ${missing.join(', ')}.`,
      );
    }
  }

  public executionOrder(): readonly TickStep[] {
    return freezeArray(this.entriesInternal.map((entry) => entry.step));
  }

  public enabledExecutionOrder(): readonly TickStep[] {
    return freezeArray(this.enabledEntriesInternal.map((entry) => entry.step));
  }

  public disabledExecutionOrder(): readonly TickStep[] {
    return freezeArray(this.disabledEntriesInternal.map((entry) => entry.step));
  }

  public canExecute(step: TickStep, completedSteps: readonly TickStep[]): boolean {
    return this.isEnabled(step) && this.dependenciesSatisfied(step, completedSteps);
  }

  // ── event / seal policy helpers ─────────────────────────────────────────────

  public emitsDeferredEvents(step: TickStep): boolean {
    return this.getEventExpectation(step).emitsDeferredEvents;
  }

  public emitsImmediateEvents(step: TickStep): boolean {
    return this.getEventExpectation(step).emitsImmediateEvents;
  }

  public expectedEventFamilies(step: TickStep): readonly string[] {
    return this.getEventExpectation(step).expectedEventFamilies;
  }

  public sealEligibleSteps(): readonly TickStep[] {
    return freezeArray(
      this.enabledEntriesInternal
        .map((entry) => entry.step)
        .filter((step) => this.getResolvedPolicy(step).sealEligible),
    );
  }

  public collectSignalSteps(): readonly TickStep[] {
    return freezeArray(
      this.enabledEntriesInternal
        .map((entry) => entry.step)
        .filter((step) => this.getResolvedPolicy(step).collectSignals),
    );
  }

  public collectDiagnosticsSteps(): readonly TickStep[] {
    return freezeArray(
      this.enabledEntriesInternal
        .map((entry) => entry.step)
        .filter((step) => this.getResolvedPolicy(step).collectDiagnostics),
    );
  }

  public expectsSnapshotMutation(step: TickStep): boolean {
    return this.getResolvedPolicy(step).snapshotMutationExpected;
  }

  public runsModeHooksBefore(step: TickStep): boolean {
    return this.getResolvedPolicy(step).runModeHooksBefore;
  }

  public runsModeHooksAfter(step: TickStep): boolean {
    return this.getResolvedPolicy(step).runModeHooksAfter;
  }

  public requiresEventSealBeforeFlush(): boolean {
    return this.resolved.events.sealEventsBeforeFlush;
  }

  public flushAtFinalStepOnly(): boolean {
    return this.resolved.events.flushAtFinalStepOnly;
  }

  public hasEnabledSealStep(): boolean {
    return this.isEnabled('STEP_12_EVENT_SEAL');
  }

  public hasEnabledFlushStep(): boolean {
    return this.isEnabled('STEP_13_FLUSH');
  }

  // ── comparisons / equivalence ────────────────────────────────────────────────

  public equals(other: TickPlan): boolean {
    return this.compare(other).identical;
  }

  public compare(other: TickPlan): TickPlanComparisonReport {
    const enabledOnlyOnLeft = this.enabledSteps().filter((step) => !other.isEnabled(step));
    const enabledOnlyOnRight = other.enabledSteps().filter((step) => !this.isEnabled(step));
    const ownerMismatches: TickStep[] = [];
    const phaseMismatches: TickStep[] = [];

    for (const step of TICK_SEQUENCE) {
      if (this.getOwner(step) !== other.getOwner(step)) {
        ownerMismatches.push(step);
      }
      if (this.getPhase(step) !== other.getPhase(step)) {
        phaseMismatches.push(step);
      }
    }

    return Object.freeze({
      identical:
        this.fingerprint() === other.fingerprint()
        && enabledOnlyOnLeft.length === 0
        && enabledOnlyOnRight.length === 0
        && ownerMismatches.length === 0
        && phaseMismatches.length === 0,
      sameFingerprint: this.fingerprint() === other.fingerprint(),
      sameEnabledSteps: enabledOnlyOnLeft.length === 0 && enabledOnlyOnRight.length === 0,
      fingerprintLeft: this.fingerprint(),
      fingerprintRight: other.fingerprint(),
      enabledOnlyOnLeft: freezeArray(enabledOnlyOnLeft),
      enabledOnlyOnRight: freezeArray(enabledOnlyOnRight),
      ownerMismatches: freezeArray(ownerMismatches),
      phaseMismatches: freezeArray(phaseMismatches),
    });
  }

  // ── execution guards ─────────────────────────────────────────────────────────

  public isRunnable(): boolean {
    return this.validationInternal.valid;
  }

  public assertRunnable(): this {
    return this.assertValid();
  }

  public shouldExecuteStep(step: TickStep): boolean {
    return this.isEnabled(step);
  }

  public shouldSkipStep(step: TickStep): boolean {
    return !this.shouldExecuteStep(step);
  }

  public canSeal(): boolean {
    if (!this.requiresEventSealBeforeFlush()) {
      return true;
    }

    return this.hasEnabledSealStep() && this.hasEnabledFlushStep();
  }

  public canFlush(): boolean {
    return this.hasEnabledFlushStep();
  }

  public isTerminalBoundaryStable(): boolean {
    const lastEnabledStep = this.lastEnabledStep();

    if (lastEnabledStep === null) {
      return false;
    }

    if (!this.flushAtFinalStepOnly()) {
      return true;
    }

    return lastEnabledStep === 'STEP_13_FLUSH';
  }

  public hasPrepareBeforeEnabledWork(): boolean {
    const firstEnabled = this.firstEnabledStep();
    return firstEnabled === null || firstEnabled === 'STEP_01_PREPARE';
  }

  public hasFlushAfterEnabledWork(): boolean {
    const lastEnabled = this.lastEnabledStep();
    return lastEnabled === null || lastEnabled === 'STEP_13_FLUSH';
  }

  public hasOutcomeGateBeforeSeal(): boolean {
    if (!this.hasEnabledSealStep()) {
      return !this.requiresEventSealBeforeFlush();
    }

    const gateIndex = this.getIndex('STEP_11_OUTCOME_GATE');
    const sealIndex = this.getIndex('STEP_12_EVENT_SEAL');
    return gateIndex < sealIndex && (this.isEnabled('STEP_11_OUTCOME_GATE') || !this.isEnabled('STEP_12_EVENT_SEAL'));
  }

  // ── diagnostics / validation internals ──────────────────────────────────────

  private buildFingerprint(): string {
    return simpleFingerprint({
      resolvedConfigFingerprint: this.resolved.fingerprint,
      enabledSteps: this.enabledSteps(),
      disabledSteps: this.disabledSteps(),
      owners: TICK_SEQUENCE.map((step) => this.getOwner(step)),
      phases: TICK_SEQUENCE.map((step) => this.getPhase(step)),
      sealEligibleSteps: this.sealEligibleSteps(),
      collectSignalSteps: this.collectSignalSteps(),
      collectDiagnosticsSteps: this.collectDiagnosticsSteps(),
      eventPolicy: this.resolved.events,
      safetyPolicy: this.resolved.safety,
      lifecyclePolicy: this.resolved.lifecycle,
    });
  }

  private buildValidationReport(): TickPlanValidationReport {
    const errors: TickPlanIssue[] = [];
    const warnings: TickPlanIssue[] = [];

    if (!this.isCanonicalSize()) {
      errors.push(
        issue(
          'ERROR',
          'PLAN_SIZE_MISMATCH',
          'PLAN',
          `Expected ${ZERO_CANONICAL_TICK_SEQUENCE.length} steps, received ${this.entriesInternal.length}.`,
        ),
      );
    }

    for (let index = 0; index < ZERO_CANONICAL_TICK_SEQUENCE.length; index += 1) {
      const expected = ZERO_CANONICAL_TICK_SEQUENCE[index];
      const actual = this.entriesInternal[index]?.step;
      if (expected !== actual) {
        errors.push(
          issue(
            'ERROR',
            'PLAN_ORDER_MISMATCH',
            'PLAN',
            `Canonical step mismatch at index ${index}. Expected ${expected}, received ${actual}.`,
          ),
        );
      }
    }

    if (!this.hasEnabledSteps()) {
      errors.push(issue('ERROR', 'NO_ENABLED_STEPS', 'PLAN', 'Tick plan has no enabled steps.'));
    }

    if (!this.hasPrepareBeforeEnabledWork()) {
      errors.push(
        issue(
          'ERROR',
          'PREPARE_DISABLED_BEFORE_WORK',
          'STEP_01_PREPARE',
          'STEP_01_PREPARE must be the first enabled step when any downstream step executes.',
        ),
      );
    }

    if (this.flushAtFinalStepOnly() && !this.hasFlushAfterEnabledWork()) {
      errors.push(
        issue(
          'ERROR',
          'FLUSH_NOT_FINAL_ENABLED_STEP',
          'STEP_13_FLUSH',
          'Flush is configured as terminal but STEP_13_FLUSH is not the last enabled step.',
        ),
      );
    }

    if (this.flushAtFinalStepOnly() && !this.hasEnabledFlushStep()) {
      errors.push(
        issue(
          'ERROR',
          'FLUSH_DISABLED',
          'STEP_13_FLUSH',
          'STEP_13_FLUSH cannot be disabled while flushAtFinalStepOnly is enabled.',
        ),
      );
    }

    if (this.requiresEventSealBeforeFlush() && !this.hasEnabledSealStep()) {
      errors.push(
        issue(
          'ERROR',
          'EVENT_SEAL_DISABLED',
          'STEP_12_EVENT_SEAL',
          'STEP_12_EVENT_SEAL cannot be disabled while sealEventsBeforeFlush is enabled.',
        ),
      );
    }

    if (this.requiresEventSealBeforeFlush() && !this.hasOutcomeGateBeforeSeal()) {
      errors.push(
        issue(
          'ERROR',
          'OUTCOME_GATE_MISSING_BEFORE_SEAL',
          'STEP_11_OUTCOME_GATE',
          'STEP_11_OUTCOME_GATE must remain available before event sealing.',
        ),
      );
    }

    for (const step of TICK_SEQUENCE) {
      const descriptor = this.getDescriptor(step);
      const policy = this.getResolvedPolicy(step);

      if (policy.owner !== descriptor.owner) {
        errors.push(
          issue(
            'ERROR',
            'STEP_OWNER_MISMATCH',
            step,
            `Policy owner ${policy.owner} does not match canonical descriptor owner ${descriptor.owner}.`,
          ),
        );
      }

      if (!policy.enabled && policy.fatalOnError) {
        warnings.push(
          issue(
            'WARN',
            'DISABLED_STEP_RETAINS_FATAL_POLICY',
            step,
            'Disabled step still marks fatalOnError=true. This is harmless but noisy.',
          ),
        );
      }

      if (!policy.enabled && (policy.runModeHooksBefore || policy.runModeHooksAfter)) {
        warnings.push(
          issue(
            'WARN',
            'DISABLED_STEP_HAS_MODE_HOOKS',
            step,
            'Disabled step still advertises mode hooks. Hooks will never execute while the step is disabled.',
          ),
        );
      }

      if (this.isCritical(step) && !policy.enabled) {
        errors.push(
          issue(
            'ERROR',
            'CRITICAL_STEP_DISABLED',
            step,
            `Critical step ${step} is disabled.`,
          ),
        );
      }

      const activePrerequisites = this.activePrerequisites(step);
      const missingActivePrerequisites = activePrerequisites.filter((dependency) => !this.isEnabled(dependency));
      if (this.isEnabled(step) && missingActivePrerequisites.length > 0) {
        warnings.push(
          issue(
            'WARN',
            'SEMANTIC_PREREQUISITES_DISABLED',
            step,
            `Enabled step ${step} runs while semantic prerequisites are disabled: ${missingActivePrerequisites.join(', ')}.`,
          ),
        );
      }
    }

    const enabledEngineSteps = this.engineEntries().filter((entry) => entry.enabled);
    if (enabledEngineSteps.length > 0 && !this.isEnabled('STEP_02_TIME')) {
      errors.push(
        issue(
          'ERROR',
          'ENGINE_CHAIN_WITHOUT_TIME',
          'STEP_02_TIME',
          'Engine execution cannot begin without STEP_02_TIME enabled.',
        ),
      );
    }

    if (this.isEnabled('STEP_09_TELEMETRY') && !this.isEnabled('STEP_08_MODE_POST')) {
      warnings.push(
        issue(
          'WARN',
          'TELEMETRY_WITHOUT_MODE_POST',
          'STEP_09_TELEMETRY',
          'Telemetry is enabled while mode post-processing is disabled. This is valid, but emitted summaries may be mode-light.',
        ),
      );
    }

    if (this.resolved.lifecycle.autoFinalizeProofOnTerminalOutcome && !this.isEnabled('STEP_10_SOVEREIGNTY_SNAPSHOT')) {
      errors.push(
        issue(
          'ERROR',
          'PROOF_FINALIZATION_WITHOUT_SOVEREIGNTY_SNAPSHOT',
          'STEP_10_SOVEREIGNTY_SNAPSHOT',
          'Terminal proof finalization requires STEP_10_SOVEREIGNTY_SNAPSHOT.',
        ),
      );
    }

    const report: TickPlanValidationReport = Object.freeze({
      valid: errors.length === 0,
      errors: freezeArray(errors),
      warnings: freezeArray(warnings),
      fingerprint: this.fingerprintInternal,
    });

    return report;
  }

  private buildSummary(): TickPlanSummary {
    const warnings = summarizeWarnings(this.validationInternal);
    const orchestration = this.phaseSlice('ORCHESTRATION').enabledCount;
    const engines = this.phaseSlice('ENGINE').enabledCount;
    const mode = this.phaseSlice('MODE').enabledCount;
    const observability = this.phaseSlice('OBSERVABILITY').enabledCount;
    const finalization = this.phaseSlice('FINALIZATION').enabledCount;

    return Object.freeze({
      fingerprint: this.fingerprintInternal,
      totalSteps: this.size(),
      enabledSteps: this.enabledCount(),
      disabledSteps: this.disabledCount(),
      firstEnabledStep: this.firstEnabledStep(),
      lastEnabledStep: this.lastEnabledStep(),
      enabledEngineSteps: engines,
      enabledFinalizationSteps: finalization,
      enabledObservabilitySteps: observability,
      enabledModeSteps: mode,
      enabledOrchestrationSteps: orchestration,
      profileId: this.resolved.resolvedProfileId,
      mode: this.resolved.resolvedMode,
      lifecycleState: this.resolved.resolvedLifecycleState,
      terminalOutcome: null,
      requiresSealBeforeFlush: this.requiresEventSealBeforeFlush(),
      flushAtFinalStepOnly: this.flushAtFinalStepOnly(),
      warnings,
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// exported factory / helper functions
// ────────────────────────────────────────────────────────────────────────────────

export function createTickPlan(
  input?: TickPlanBuildInput | OrchestratorConfig | ResolvedOrchestratorConfig,
): TickPlan {
  return new TickPlan(input);
}

export function createDefaultTickPlan(): TickPlan {
  return new TickPlan({
    config: createDefaultOrchestratorConfig(),
  });
}

export function createTickPlanFromResolvedConfig(
  resolved: ResolvedOrchestratorConfig,
): TickPlan {
  return new TickPlan(resolved);
}

export function createTickPlanSnapshotFromConfig(
  input?: TickPlanBuildInput | OrchestratorConfig | ResolvedOrchestratorConfig,
): TickPlanSnapshot {
  return createTickPlan(input).snapshot();
}

export function validateTickPlan(
  input?: TickPlanBuildInput | OrchestratorConfig | ResolvedOrchestratorConfig,
): TickPlanValidationReport {
  return createTickPlan(input).validation();
}

export function assertValidTickPlan(
  input?: TickPlanBuildInput | OrchestratorConfig | ResolvedOrchestratorConfig,
): TickPlan {
  return createTickPlan(input).assertValid();
}

export function summarizeTickPlan(
  input?: TickPlanBuildInput | OrchestratorConfig | ResolvedOrchestratorConfig,
): TickPlanSummary {
  return createTickPlan(input).summary();
}

export function compareTickPlans(
  left: TickPlan | TickPlanBuildInput | OrchestratorConfig | ResolvedOrchestratorConfig,
  right: TickPlan | TickPlanBuildInput | OrchestratorConfig | ResolvedOrchestratorConfig,
): TickPlanComparisonReport {
  const leftPlan = left instanceof TickPlan ? left : createTickPlan(left);
  const rightPlan = right instanceof TickPlan ? right : createTickPlan(right);
  return leftPlan.compare(rightPlan);
}

export function getTickPlanDependency(step: TickStep): TickPlanStepDependency {
  return ZERO_TICK_PLAN_DEPENDENCY_MAP[step];
}

export function getTickPlanWindow(
  plan: TickPlan,
  fromStep: TickStep,
  toStep: TickStep,
  inclusive = true,
): TickPlanWindowSnapshot {
  return plan.window(fromStep, toStep, inclusive);
}

export function getTickPlanCursor(
  plan: TickPlan,
  step: TickStep,
): TickPlanCursor {
  return plan.cursor(step);
}

export function getStepPhase(step: TickStep): TickStepPhase {
  return ZERO_TICK_PLAN_PHASE_BY_STEP[step];
}

export function getStepOwner(step: TickStep): StepRuntimeOwner {
  return ZERO_TICK_PLAN_OWNER_BY_STEP[step];
}

export function getStepDescriptor(step: TickStep): TickStepDescriptor {
  return ZERO_TICK_STEP_DESCRIPTORS[step] ?? TICK_STEP_DESCRIPTORS[step];
}

export function isTickPlanBoundaryStep(step: TickStep): boolean {
  return (ZERO_TICK_PLAN_BOUNDARY_STEPS as readonly TickStep[]).includes(step);
}

export function isTickPlanCriticalStep(step: TickStep): boolean {
  return (ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]).includes(step);
}

export function getDirectStepDependencies(step: TickStep): readonly TickStep[] {
  return ZERO_TICK_PLAN_DIRECT_DEPENDENCIES[step];
}

export function getSemanticStepDependencies(step: TickStep): readonly TickStep[] {
  return ZERO_TICK_PLAN_SEMANTIC_DEPENDENCIES[step];
}

export function getDirectStepDependents(step: TickStep): readonly TickStep[] {
  return ZERO_TICK_PLAN_DIRECT_DEPENDENTS[step];
}

export function getTransitiveStepDependencies(step: TickStep): readonly TickStep[] {
  return ZERO_TICK_PLAN_DEPENDENCY_MAP[step].transitivePrerequisites;
}

export function getTransitiveStepDependents(step: TickStep): readonly TickStep[] {
  return ZERO_TICK_PLAN_DEPENDENCY_MAP[step].transitiveDependents;
}

export function isStepEnabledInPlan(
  plan: TickPlan,
  step: TickStep,
): boolean {
  return plan.isEnabled(step);
}

export function isStepDisabledInPlan(
  plan: TickPlan,
  step: TickStep,
): boolean {
  return plan.isDisabled(step);
}

export function getEnabledStepsInPlan(plan: TickPlan): readonly TickStep[] {
  return plan.enabledSteps();
}

export function getDisabledStepsInPlan(plan: TickPlan): readonly TickStep[] {
  return plan.disabledSteps();
}

export function getEnabledEntriesByPhase(
  plan: TickPlan,
  phase: TickStepPhase,
): readonly TickPlanEntry[] {
  return plan.enabledEntriesByPhase(phase);
}

export function getEnabledEntriesByOwner(
  plan: TickPlan,
  owner: StepRuntimeOwner,
): readonly TickPlanEntry[] {
  return plan.enabledEntriesByOwner(owner);
}

export function assertStepEnabledInPlan(
  plan: TickPlan,
  step: TickStep,
): void {
  plan.assertEnabled(step);
}

export function assertStepDependenciesSatisfied(
  plan: TickPlan,
  step: TickStep,
  completedSteps: readonly TickStep[],
): void {
  plan.assertDependenciesSatisfied(step, completedSteps);
}

export function canExecuteStepInPlan(
  plan: TickPlan,
  step: TickStep,
  completedSteps: readonly TickStep[],
): boolean {
  return plan.canExecute(step, completedSteps);
}

export function buildPlanForMode(
  mode: ModeCode,
  config?: OrchestratorConfig,
): TickPlan {
  return new TickPlan({
    config: config ?? createDefaultOrchestratorConfig(),
    mode,
  });
}

export function buildPlanForLifecycle(
  lifecycleState: RunLifecycleState,
  config?: OrchestratorConfig,
): TickPlan {
  return new TickPlan({
    config: config ?? createDefaultOrchestratorConfig(),
    lifecycleState,
  });
}

export function buildPlanForTerminalOutcome(
  outcome: RunOutcome,
  config?: OrchestratorConfig,
): TickPlan {
  return new TickPlan({
    config: config ?? createDefaultOrchestratorConfig(),
    outcome,
  });
}

export function cloneTickPlan(plan: TickPlan): TickPlan {
  return new TickPlan(plan.resolvedConfig());
}

export const ZERO_DEFAULT_TICK_PLAN = Object.freeze(createDefaultTickPlan());
export const ZERO_DEFAULT_TICK_PLAN_SNAPSHOT: TickPlanSnapshot =
  ZERO_DEFAULT_TICK_PLAN.snapshot();
export const ZERO_DEFAULT_TICK_PLAN_VALIDATION: TickPlanValidationReport =
  ZERO_DEFAULT_TICK_PLAN.validation();
export const ZERO_DEFAULT_TICK_PLAN_SUMMARY: TickPlanSummary =
  ZERO_DEFAULT_TICK_PLAN.summary();

// ────────────────────────────────────────────────────────────────────────────────
// MODULE METADATA
// ────────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_MODULE_VERSION = '1.0.0' as const;
export const TICK_PLAN_SCHEMA_VERSION = 1 as const;
export const TICK_PLAN_MODULE_READY = true as const;
export const TICK_PLAN_ML_FEATURE_COUNT = 32 as const;
export const TICK_PLAN_DL_TENSOR_SHAPE = Object.freeze([13, 8] as const);
export const TICK_PLAN_COMPLETE = true as const;
export const TICK_PLAN_MAX_TICK = 600 as const;
export const TICK_PLAN_MAX_ENABLED_STEPS = 13 as const;
export const TICK_PLAN_TREND_WINDOW_SIZE = 50 as const;
export const TICK_PLAN_SESSION_MAX_HISTORY = 200 as const;
export const TICK_PLAN_EVENT_LOG_MAX_ENTRIES = 1000 as const;

// ────────────────────────────────────────────────────────────────────────────────
// DOMAIN LOOKUP CONSTANTS
// ────────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_MODE_CODES = Object.freeze(['solo', 'pvp', 'coop', 'ghost'] as const);
export const TICK_PLAN_PRESSURE_TIERS = Object.freeze(['T0', 'T1', 'T2', 'T3', 'T4'] as const);
export const TICK_PLAN_RUN_PHASES = Object.freeze(['FOUNDATION', 'ESCALATION', 'SOVEREIGNTY'] as const);
export const TICK_PLAN_RUN_OUTCOMES = Object.freeze(['FREEDOM', 'TIMEOUT', 'BANKRUPT', 'ABANDONED'] as const);
export const TICK_PLAN_STEP_IDS = Object.freeze([
  'STEP_01_PREPARE', 'STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION',
  'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_07_CASCADE', 'STEP_08_MODE_POST',
  'STEP_09_TELEMETRY', 'STEP_10_SOVEREIGNTY_SNAPSHOT', 'STEP_11_OUTCOME_GATE',
  'STEP_12_EVENT_SEAL', 'STEP_13_FLUSH',
] as const);
export const TICK_PLAN_MODE_NORMALIZED = Object.freeze({ solo: 0.0, pvp: 0.33, coop: 0.67, ghost: 1.0 } as const);
export const TICK_PLAN_MODE_DIFFICULTY_MULTIPLIER = Object.freeze({ solo: 1.0, pvp: 1.3, coop: 1.1, ghost: 1.5 } as const);
export const TICK_PLAN_MODE_TENSION_FLOOR = Object.freeze({ solo: 0.0, pvp: 0.2, coop: 0.1, ghost: 0.35 } as const);
export const TICK_PLAN_PRESSURE_TIER_NORMALIZED = Object.freeze({ T0: 0.0, T1: 0.25, T2: 0.5, T3: 0.75, T4: 1.0 } as const);
export const TICK_PLAN_RUN_PHASE_NORMALIZED = Object.freeze({ FOUNDATION: 0.0, ESCALATION: 0.5, SOVEREIGNTY: 1.0 } as const);
export const TICK_PLAN_STEP_PHASE_WEIGHT = Object.freeze({ ORCHESTRATION: 0.15, ENGINE: 0.45, MODE: 0.1, OBSERVABILITY: 0.15, FINALIZATION: 0.15 } as const);
export const TICK_PLAN_STEP_CRITICALITY_SCORE = Object.freeze({
  STEP_01_PREPARE: 1.0,
  STEP_02_TIME: 0.8,
  STEP_03_PRESSURE: 0.8,
  STEP_04_TENSION: 0.7,
  STEP_05_BATTLE: 0.9,
  STEP_06_SHIELD: 0.9,
  STEP_07_CASCADE: 0.75,
  STEP_08_MODE_POST: 0.6,
  STEP_09_TELEMETRY: 0.7,
  STEP_10_SOVEREIGNTY_SNAPSHOT: 0.85,
  STEP_11_OUTCOME_GATE: 1.0,
  STEP_12_EVENT_SEAL: 0.95,
  STEP_13_FLUSH: 1.0,
} as const);

// ────────────────────────────────────────────────────────────────────────────────
// FEATURE LABELS AND TENSOR LABELS
// ────────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_ML_FEATURE_LABELS = Object.freeze([
  'enabledRatio', 'disabledRatio', 'criticalStepsEnabledRatio', 'boundaryStepsEnabledRatio',
  'enginePhaseRatio', 'orchestrationPhaseRatio', 'modePhaseRatio', 'observabilityPhaseRatio',
  'finalizationPhaseRatio', 'engineStepsEnabledCount', 'sealEligibleRatio', 'collectSignalRatio',
  'collectDiagnosticsRatio', 'flushStepEnabled', 'sealStepEnabled', 'outcomeGateEnabled',
  'prepareStepEnabled', 'modeNormalized', 'pressureTierNormalized', 'runPhaseNormalized',
  'firstEnabledOrdinalNormalized', 'lastEnabledOrdinalNormalized', 'enabledWindowSpan',
  'disabledGapCount', 'requiresSealBeforeFlush', 'flushAtFinalStepOnly', 'hasDisabledCritical',
  'isFullyEnabled', 'isCanonicalSize', 'lifecycleStateEncoded', 'terminalOutcomeEncoded', 'validationScore',
] as const);

export const TICK_PLAN_DL_ROW_LABELS = Object.freeze([
  'STEP_01_PREPARE', 'STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION',
  'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_07_CASCADE', 'STEP_08_MODE_POST',
  'STEP_09_TELEMETRY', 'STEP_10_SOVEREIGNTY_SNAPSHOT', 'STEP_11_OUTCOME_GATE',
  'STEP_12_EVENT_SEAL', 'STEP_13_FLUSH',
] as const);

export const TICK_PLAN_DL_COL_LABELS = Object.freeze([
  'enabled', 'criticality', 'phaseWeight', 'sealEligible',
  'collectSignals', 'collectDiagnostics', 'mutatesState', 'prerequisiteCount',
] as const);

// ────────────────────────────────────────────────────────────────────────────────
// SEVERITY THRESHOLDS AND OUTCOME WEIGHTS
// ────────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_SEVERITY_THRESHOLDS = Object.freeze({
  LOW: 0.75,
  MEDIUM: 0.5,
  HIGH: 0.25,
  CRITICAL: 0.0,
} as const);

export const TICK_PLAN_NARRATION_BY_MODE = Object.freeze({
  solo: 'Empire — you walk alone. Every tick is yours.',
  pvp: 'Predator — your opponent can feel you closing in.',
  coop: 'Syndicate — the team tick fires as one.',
  ghost: 'Phantom — the legend is ticking. Catch it.',
} as const);

export const TICK_PLAN_NARRATION_BY_SEVERITY = Object.freeze({
  LOW: 'Tick plan nominal — all systems clear.',
  MEDIUM: 'Tick plan degraded — some steps disabled.',
  HIGH: 'Tick plan impaired — critical coverage missing.',
  CRITICAL: 'Tick plan critical — execution integrity at risk.',
} as const);

// ────────────────────────────────────────────────────────────────────────────────
// AVERAGE CONSTANTS
// ────────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_STEP_CRITICALITY_AVG = 0.84 as const;
export const TICK_PLAN_PHASE_WEIGHT_AVG = 0.2 as const;

// ────────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ────────────────────────────────────────────────────────────────────────────────

export type TickPlanSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TickPlanOperationKind = 'PLAN' | 'VALIDATE' | 'COMPARE' | 'SNAPSHOT' | 'REBUILD' | 'NOOP';
export type TickPlanModeCode = 'solo' | 'pvp' | 'coop' | 'ghost';
export type TickPlanPressureTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
export type TickPlanRunPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';
export type TickPlanRunOutcome = 'FREEDOM' | 'TIMEOUT' | 'BANKRUPT' | 'ABANDONED';

// ────────────────────────────────────────────────────────────────────────────────
// ML VECTOR INTERFACE AND INPUT
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanMLVectorInput {
  readonly plan: TickPlan;
  readonly mode?: TickPlanModeCode | null;
  readonly pressureTier?: TickPlanPressureTier | null;
  readonly runPhase?: TickPlanRunPhase | null;
  readonly lifecycleState?: string | null;
  readonly terminalOutcome?: TickPlanRunOutcome | null;
}

export interface TickPlanMLVector {
  readonly enabledRatio: number;
  readonly disabledRatio: number;
  readonly criticalStepsEnabledRatio: number;
  readonly boundaryStepsEnabledRatio: number;
  readonly enginePhaseRatio: number;
  readonly orchestrationPhaseRatio: number;
  readonly modePhaseRatio: number;
  readonly observabilityPhaseRatio: number;
  readonly finalizationPhaseRatio: number;
  readonly engineStepsEnabledCount: number;
  readonly sealEligibleRatio: number;
  readonly collectSignalRatio: number;
  readonly collectDiagnosticsRatio: number;
  readonly flushStepEnabled: number;
  readonly sealStepEnabled: number;
  readonly outcomeGateEnabled: number;
  readonly prepareStepEnabled: number;
  readonly modeNormalized: number;
  readonly pressureTierNormalized: number;
  readonly runPhaseNormalized: number;
  readonly firstEnabledOrdinalNormalized: number;
  readonly lastEnabledOrdinalNormalized: number;
  readonly enabledWindowSpan: number;
  readonly disabledGapCount: number;
  readonly requiresSealBeforeFlush: number;
  readonly flushAtFinalStepOnly: number;
  readonly hasDisabledCritical: number;
  readonly isFullyEnabled: number;
  readonly isCanonicalSize: number;
  readonly lifecycleStateEncoded: number;
  readonly terminalOutcomeEncoded: number;
  readonly validationScore: number;
}

// ────────────────────────────────────────────────────────────────────────────────
// DL TENSOR
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanDLTensorRow {
  readonly step: string;
  readonly enabled: number;
  readonly criticality: number;
  readonly phaseWeight: number;
  readonly sealEligible: number;
  readonly collectSignals: number;
  readonly collectDiagnostics: number;
  readonly mutatesState: number;
  readonly prerequisiteCount: number;
}
export type TickPlanDLTensor = readonly TickPlanDLTensorRow[];

// ────────────────────────────────────────────────────────────────────────────────
// CHAT SIGNAL AND ANNOTATION TYPES
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanChatSignal {
  readonly runId: string;
  readonly tick: number;
  readonly severity: TickPlanSeverity;
  readonly operationKind: TickPlanOperationKind;
  readonly healthScore: number;
  readonly enabledRatio: number;
  readonly criticalStepsEnabled: boolean;
  readonly validationPassed: boolean;
  readonly fingerprint: string;
  readonly mode: TickPlanModeCode | null;
  readonly lifecycleState: string | null;
  readonly narrationHint: string;
  readonly mlVector: TickPlanMLVector;
  readonly dlTensor: TickPlanDLTensor;
  readonly emittedAtMs: number;
}

export interface TickPlanAnnotationBundle {
  readonly fingerprint: string;
  readonly severity: TickPlanSeverity;
  readonly healthScore: number;
  readonly label: string;
  readonly description: string;
  readonly enabledStepCount: number;
  readonly disabledStepCount: number;
  readonly criticalIssues: readonly string[];
  readonly warnings: readonly string[];
  readonly mode: TickPlanModeCode | null;
  readonly lifecycleState: string | null;
  readonly validationPassed: boolean;
  readonly operationKind: TickPlanOperationKind;
  readonly emittedAtMs: number;
}

export interface TickPlanNarrationHint {
  readonly phrase: string;
  readonly urgencyLabel: string;
  readonly heatMultiplier: number;
  readonly companionIntent: string;
  readonly audienceReaction: string;
}

export interface TickPlanTrendSnapshot {
  readonly windowSize: number;
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly avgEnabledRatio: number;
  readonly severityCounts: Readonly<Record<TickPlanSeverity, number>>;
  readonly dominantSeverity: TickPlanSeverity;
  readonly criticalTrendUp: boolean;
  readonly planFingerprintChanges: number;
}

export interface TickPlanSessionReport {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly planCount: number;
  readonly avgHealthScore: number;
  readonly avgEnabledRatio: number;
  readonly validationFailures: number;
  readonly severityDistribution: Readonly<Record<TickPlanSeverity, number>>;
  readonly mostFrequentFingerprint: string | null;
  readonly mode: TickPlanModeCode | null;
}

export interface TickPlanEventLogEntry {
  readonly sequenceNumber: number;
  readonly atMs: number;
  readonly fingerprint: string;
  readonly operationKind: TickPlanOperationKind;
  readonly severity: TickPlanSeverity;
  readonly healthScore: number;
  readonly enabledCount: number;
  readonly disabledCount: number;
  readonly validationPassed: boolean;
}

export interface TickPlanHealthSnapshot {
  readonly fingerprint: string;
  readonly healthScore: number;
  readonly severity: TickPlanSeverity;
  readonly actionRecommendation: string;
  readonly narrationHint: TickPlanNarrationHint;
  readonly enabledCount: number;
  readonly disabledCount: number;
  readonly criticalStepsEnabled: boolean;
  readonly validationPassed: boolean;
  readonly validationErrors: readonly string[];
  readonly validationWarnings: readonly string[];
  readonly mode: TickPlanModeCode | null;
  readonly lifecycleState: string | null;
}

export interface TickPlanRunSummary {
  readonly runId: string;
  readonly tick: number;
  readonly fingerprint: string;
  readonly healthScore: number;
  readonly severity: TickPlanSeverity;
  readonly enabledCount: number;
  readonly disabledCount: number;
  readonly validationPassed: boolean;
  readonly mode: TickPlanModeCode | null;
  readonly lifecycleState: string | null;
  readonly narrationPhrase: string;
}

export interface TickPlanInspectionBundle {
  readonly plan: TickPlan;
  readonly mlVector: TickPlanMLVector;
  readonly dlTensor: TickPlanDLTensor;
  readonly healthSnapshot: TickPlanHealthSnapshot;
  readonly annotation: TickPlanAnnotationBundle;
  readonly chatSignal: TickPlanChatSignal;
  readonly narrationHint: TickPlanNarrationHint;
  readonly runSummary: TickPlanRunSummary;
  readonly exportBundle: TickPlanExportBundle;
}

export interface TickPlanExportBundle {
  readonly fingerprint: string;
  readonly schemaVersion: number;
  readonly moduleVersion: string;
  readonly exportedAtMs: number;
  readonly mlVector: TickPlanMLVector;
  readonly dlTensor: TickPlanDLTensor;
  readonly healthSnapshot: TickPlanHealthSnapshot;
  readonly annotation: TickPlanAnnotationBundle;
  readonly chatSignal: TickPlanChatSignal;
  readonly runSummary: TickPlanRunSummary;
  readonly validationReport: TickPlanValidationReport;
  readonly planSummary: TickPlanSummary;
}

// ────────────────────────────────────────────────────────────────────────────────
// ML/DL EXTRACTION FUNCTIONS
// ────────────────────────────────────────────────────────────────────────────────

function clamp01(v: number): number { return Math.min(1, Math.max(0, v)); }

export function extractTickPlanMLVector(input: TickPlanMLVectorInput): TickPlanMLVector {
  const { plan } = input;
  const total = plan.size();
  const enabled = plan.enabledCount();
  const disabled = plan.disabledCount();
  const enabledRatio = total > 0 ? clamp01(enabled / total) : 0;
  const disabledRatio = total > 0 ? clamp01(disabled / total) : 0;

  // critical steps enabled ratio (4 critical steps total)
  const criticalEnabled = (ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]).filter(s => plan.isEnabled(s)).length;
  const criticalStepsEnabledRatio = clamp01(criticalEnabled / 4);

  // boundary steps enabled ratio (3 boundary steps total)
  const boundaryEnabled = (ZERO_TICK_PLAN_BOUNDARY_STEPS as readonly TickStep[]).filter(s => plan.isEnabled(s)).length;
  const boundaryStepsEnabledRatio = clamp01(boundaryEnabled / 3);

  // phase ratios
  const engineSlice = plan.phaseSlice('ENGINE');
  const orchestSlice = plan.phaseSlice('ORCHESTRATION');
  const modeSlice = plan.phaseSlice('MODE');
  const observSlice = plan.phaseSlice('OBSERVABILITY');
  const finalSlice = plan.phaseSlice('FINALIZATION');

  const enginePhaseRatio = engineSlice.size > 0 ? clamp01(engineSlice.enabledCount / engineSlice.size) : 0;
  const orchestrationPhaseRatio = orchestSlice.size > 0 ? clamp01(orchestSlice.enabledCount / orchestSlice.size) : 0;
  const modePhaseRatio = modeSlice.size > 0 ? clamp01(modeSlice.enabledCount / modeSlice.size) : 0;
  const observabilityPhaseRatio = observSlice.size > 0 ? clamp01(observSlice.enabledCount / observSlice.size) : 0;
  const finalizationPhaseRatio = finalSlice.size > 0 ? clamp01(finalSlice.enabledCount / finalSlice.size) : 0;

  const engineStepsEnabledCount = clamp01(engineSlice.enabledCount / 7); // 7 engine steps total

  const sealEligible = plan.sealEligibleSteps().length;
  const sealEligibleRatio = enabled > 0 ? clamp01(sealEligible / enabled) : 0;

  const signalSteps = plan.collectSignalSteps().length;
  const collectSignalRatio = enabled > 0 ? clamp01(signalSteps / enabled) : 0;

  const diagSteps = plan.collectDiagnosticsSteps().length;
  const collectDiagnosticsRatio = enabled > 0 ? clamp01(diagSteps / enabled) : 0;

  const flushStepEnabled = plan.isEnabled('STEP_13_FLUSH') ? 1 : 0;
  const sealStepEnabled = plan.isEnabled('STEP_12_EVENT_SEAL') ? 1 : 0;
  const outcomeGateEnabled = plan.isEnabled('STEP_11_OUTCOME_GATE') ? 1 : 0;
  const prepareStepEnabled = plan.isEnabled('STEP_01_PREPARE') ? 1 : 0;

  const mode = input.mode ?? null;
  const modeNormalized = mode ? (TICK_PLAN_MODE_NORMALIZED[mode] ?? 0) : 0;

  const pressureTier = input.pressureTier ?? null;
  const pressureTierNormalized = pressureTier ? (TICK_PLAN_PRESSURE_TIER_NORMALIZED[pressureTier] ?? 0) : 0;

  const runPhase = input.runPhase ?? null;
  const runPhaseNormalized = runPhase ? (TICK_PLAN_RUN_PHASE_NORMALIZED[runPhase] ?? 0) : 0;

  const firstEnabled = plan.firstEnabledStep();
  const lastEnabled = plan.lastEnabledStep();
  const firstEnabledOrdinalNormalized = firstEnabled ? clamp01(plan.getOrdinal(firstEnabled) / 13) : 0;
  const lastEnabledOrdinalNormalized = lastEnabled ? clamp01(plan.getOrdinal(lastEnabled) / 13) : 1;
  const enabledWindowSpan = lastEnabledOrdinalNormalized - firstEnabledOrdinalNormalized;

  // count gaps (sequences of disabled steps between enabled steps)
  const allEntries = plan.entries();
  let gapCount = 0;
  let inGap = false;
  for (const entry of allEntries) {
    if (!entry.enabled) {
      if (!inGap) { gapCount++; inGap = true; }
    } else { inGap = false; }
  }
  const disabledGapCount = clamp01(gapCount / 5);

  const requiresSealBeforeFlush = plan.requiresEventSealBeforeFlush() ? 1 : 0;
  const flushAtFinalStepOnly = plan.flushAtFinalStepOnly() ? 1 : 0;

  const hasDisabledCritical = (ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]).some(s => !plan.isEnabled(s)) ? 1 : 0;
  const isFullyEnabled = plan.isFullyEnabled() ? 1 : 0;
  const isCanonicalSize = plan.isCanonicalSize() ? 1 : 0;

  // lifecycle state encoding
  const lifecycleStateMap: Record<string, number> = { IDLE: 0, ACTIVE: 0.33, PAUSED: 0.67, TERMINAL: 1.0 };
  const lifecycleStateEncoded = input.lifecycleState ? (lifecycleStateMap[input.lifecycleState] ?? 0.5) : 0;

  // terminal outcome encoding
  const outcomeMap: Record<string, number> = { FREEDOM: 1.0, TIMEOUT: 0.33, BANKRUPT: 0.0, ABANDONED: 0.67 };
  const terminalOutcomeEncoded = input.terminalOutcome ? (outcomeMap[input.terminalOutcome] ?? 0) : 0;

  const validation = plan.validation();
  const validationScore = validation.valid ? 1.0 : clamp01(1 - (validation.errors.length / 10));

  return Object.freeze({
    enabledRatio, disabledRatio, criticalStepsEnabledRatio, boundaryStepsEnabledRatio,
    enginePhaseRatio, orchestrationPhaseRatio, modePhaseRatio, observabilityPhaseRatio,
    finalizationPhaseRatio, engineStepsEnabledCount, sealEligibleRatio, collectSignalRatio,
    collectDiagnosticsRatio, flushStepEnabled, sealStepEnabled, outcomeGateEnabled,
    prepareStepEnabled, modeNormalized, pressureTierNormalized, runPhaseNormalized,
    firstEnabledOrdinalNormalized, lastEnabledOrdinalNormalized, enabledWindowSpan,
    disabledGapCount, requiresSealBeforeFlush, flushAtFinalStepOnly, hasDisabledCritical,
    isFullyEnabled, isCanonicalSize, lifecycleStateEncoded, terminalOutcomeEncoded, validationScore,
  });
}

export function buildTickPlanDLTensor(
  plan: TickPlan,
  input?: Pick<TickPlanMLVectorInput, 'mode' | 'pressureTier' | 'runPhase'>,
): TickPlanDLTensor {
  // input param is accepted for future extensibility; referenced to avoid unused warning
  void input;
  const stepIds = TICK_PLAN_STEP_IDS;
  const rows: TickPlanDLTensorRow[] = stepIds.map((step) => {
    const s = step as TickStep;
    const enabled = plan.isEnabled(s) ? 1 : 0;
    const criticality = TICK_PLAN_STEP_CRITICALITY_SCORE[s] ?? 0.5;
    const phase = plan.getPhase(s);
    const phaseWeight = TICK_PLAN_STEP_PHASE_WEIGHT[phase] ?? TICK_PLAN_PHASE_WEIGHT_AVG;
    const policy = plan.getResolvedPolicy(s);
    const sealEligible = policy.sealEligible ? 1 : 0;
    const collectSignals = policy.collectSignals ? 1 : 0;
    const collectDiagnostics = policy.collectDiagnostics ? 1 : 0;
    const mutatesState = policy.snapshotMutationExpected ? 1 : 0;
    const prereqCount = clamp01(ZERO_TICK_PLAN_DIRECT_DEPENDENCIES[s].length / 5);
    return Object.freeze({
      step,
      enabled,
      criticality,
      phaseWeight,
      sealEligible,
      collectSignals,
      collectDiagnostics,
      mutatesState,
      prerequisiteCount: prereqCount,
    });
  });
  return Object.freeze(rows);
}

// ────────────────────────────────────────────────────────────────────────────────
// VALIDATION AND UTILITY ML FUNCTIONS
// ────────────────────────────────────────────────────────────────────────────────

export function validateTickPlanMLVector(v: TickPlanMLVector): boolean {
  return TICK_PLAN_ML_FEATURE_LABELS.every(label => {
    const val = v[label as keyof TickPlanMLVector];
    return typeof val === 'number' && val >= 0 && val <= 1;
  });
}

export function flattenTickPlanMLVector(v: TickPlanMLVector): readonly number[] {
  return Object.freeze(TICK_PLAN_ML_FEATURE_LABELS.map(label => v[label as keyof TickPlanMLVector] as number));
}

export function flattenTickPlanDLTensor(tensor: TickPlanDLTensor): readonly number[] {
  const cols = TICK_PLAN_DL_COL_LABELS;
  const flat: number[] = [];
  for (const row of tensor) {
    for (const col of cols) {
      flat.push(row[col as keyof TickPlanDLTensorRow] as number);
    }
  }
  return Object.freeze(flat);
}

export function buildTickPlanMLNamedMap(v: TickPlanMLVector): Readonly<Record<string, number>> {
  const map: Record<string, number> = {};
  for (const label of TICK_PLAN_ML_FEATURE_LABELS) {
    map[label] = v[label as keyof TickPlanMLVector] as number;
  }
  return Object.freeze(map);
}

export function extractTickPlanDLColumn(
  tensor: TickPlanDLTensor,
  col: typeof TICK_PLAN_DL_COL_LABELS[number],
): readonly number[] {
  return Object.freeze(tensor.map(row => row[col as keyof TickPlanDLTensorRow] as number));
}

export function computeTickPlanMLSimilarity(a: TickPlanMLVector, b: TickPlanMLVector): number {
  const fa = flattenTickPlanMLVector(a);
  const fb = flattenTickPlanMLVector(b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < fa.length; i++) {
    dot += fa[i] * fb[i];
    na += fa[i] ** 2;
    nb += fb[i] ** 2;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : clamp01(dot / denom);
}

export function getTopTickPlanFeatures(
  v: TickPlanMLVector,
  topN = 5,
): readonly { label: string; value: number }[] {
  const entries = TICK_PLAN_ML_FEATURE_LABELS.map(label => ({
    label,
    value: v[label as keyof TickPlanMLVector] as number,
  }));
  return Object.freeze(entries.sort((a, b) => b.value - a.value).slice(0, topN));
}

export function serializeTickPlanMLVector(v: TickPlanMLVector): string {
  return JSON.stringify(buildTickPlanMLNamedMap(v));
}

export function serializeTickPlanDLTensor(tensor: TickPlanDLTensor): string {
  return JSON.stringify(tensor.map(row => ({
    step: row.step,
    values: TICK_PLAN_DL_COL_LABELS.map(col => row[col as keyof TickPlanDLTensorRow]),
  })));
}

export function cloneTickPlanMLVector(v: TickPlanMLVector): TickPlanMLVector {
  return Object.freeze({ ...v });
}

export function isTickPlanSeverity(value: unknown): value is TickPlanSeverity {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL';
}

export function isTickPlanOperationKind(value: unknown): value is TickPlanOperationKind {
  return (
    value === 'PLAN' ||
    value === 'VALIDATE' ||
    value === 'COMPARE' ||
    value === 'SNAPSHOT' ||
    value === 'REBUILD' ||
    value === 'NOOP'
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// HEALTH SCORE AND SEVERITY FUNCTIONS
// ────────────────────────────────────────────────────────────────────────────────

export function computeTickPlanHealthScore(plan: TickPlan): number {
  const validation = plan.validation();
  if (!validation.valid) return clamp01(1 - (validation.errors.length * 0.2));
  const summary = plan.summary();
  const enabledRatio = summary.totalSteps > 0 ? summary.enabledSteps / summary.totalSteps : 0;
  const criticalEnabled = (ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]).filter(s => plan.isEnabled(s)).length / 4;
  const hasFlush = plan.hasEnabledFlushStep() ? 1 : 0;
  const hasSeal = plan.hasEnabledSealStep() ? 1 : 0;
  return clamp01((enabledRatio * 0.3) + (criticalEnabled * 0.4) + (hasFlush * 0.15) + (hasSeal * 0.15));
}

export function classifyTickPlanSeverity(healthScore: number): TickPlanSeverity {
  if (healthScore >= TICK_PLAN_SEVERITY_THRESHOLDS.LOW) return 'LOW';
  if (healthScore >= TICK_PLAN_SEVERITY_THRESHOLDS.MEDIUM) return 'MEDIUM';
  if (healthScore >= TICK_PLAN_SEVERITY_THRESHOLDS.HIGH) return 'HIGH';
  return 'CRITICAL';
}

export function getTickPlanActionRecommendation(severity: TickPlanSeverity): string {
  switch (severity) {
    case 'LOW': return 'Plan nominal — no action required.';
    case 'MEDIUM': return 'Review disabled steps — consider re-enabling for full coverage.';
    case 'HIGH': return 'Critical step coverage missing — restore critical steps before execution.';
    case 'CRITICAL': return 'Plan integrity compromised — rebuild or assert before execution.';
  }
}

export function getTickPlanNarrationHintPhrase(plan: TickPlan, mode: TickPlanModeCode | null): string {
  const severity = classifyTickPlanSeverity(computeTickPlanHealthScore(plan));
  if (mode && severity === 'LOW') return TICK_PLAN_NARRATION_BY_MODE[mode];
  return TICK_PLAN_NARRATION_BY_SEVERITY[severity];
}

// ────────────────────────────────────────────────────────────────────────────────
// CHAT SIGNAL BUILDERS
// ────────────────────────────────────────────────────────────────────────────────

export function buildTickPlanChatSignal(
  plan: TickPlan,
  runId: string,
  tick: number,
  options?: {
    mode?: TickPlanModeCode | null;
    pressureTier?: TickPlanPressureTier | null;
    runPhase?: TickPlanRunPhase | null;
    lifecycleState?: string | null;
    terminalOutcome?: TickPlanRunOutcome | null;
    operationKind?: TickPlanOperationKind;
  },
): TickPlanChatSignal {
  const healthScore = computeTickPlanHealthScore(plan);
  const severity = classifyTickPlanSeverity(healthScore);
  const mode = options?.mode ?? null;
  const mlVector = extractTickPlanMLVector({
    plan,
    mode,
    pressureTier: options?.pressureTier ?? null,
    runPhase: options?.runPhase ?? null,
    lifecycleState: options?.lifecycleState ?? null,
    terminalOutcome: options?.terminalOutcome ?? null,
  });
  const dlTensor = buildTickPlanDLTensor(plan, {
    mode: options?.mode,
    pressureTier: options?.pressureTier,
    runPhase: options?.runPhase,
  });
  const narrationHint = getTickPlanNarrationHintPhrase(plan, mode);
  const validation = plan.validation();
  return Object.freeze({
    runId,
    tick,
    severity,
    operationKind: options?.operationKind ?? 'PLAN',
    healthScore,
    enabledRatio: mlVector.enabledRatio,
    criticalStepsEnabled: mlVector.criticalStepsEnabledRatio === 1,
    validationPassed: validation.valid,
    fingerprint: plan.fingerprint(),
    mode,
    lifecycleState: options?.lifecycleState ?? null,
    narrationHint,
    mlVector,
    dlTensor,
    emittedAtMs: Date.now(),
  });
}

export function buildTickPlanNarrationHint(plan: TickPlan, mode: TickPlanModeCode | null): TickPlanNarrationHint {
  const healthScore = computeTickPlanHealthScore(plan);
  const severity = classifyTickPlanSeverity(healthScore);
  const phrase = getTickPlanNarrationHintPhrase(plan, mode);
  const urgencyLabel = severity === 'LOW' ? 'STEADY' : severity === 'MEDIUM' ? 'CAUTION' : severity === 'HIGH' ? 'ALERT' : 'RESCUE';
  const heatMultiplier = severity === 'LOW' ? 0.5 : severity === 'MEDIUM' ? 0.75 : severity === 'HIGH' ? 1.2 : 1.5;
  const companionIntent = severity === 'LOW' ? 'coaching' : severity === 'MEDIUM' ? 'advisory' : severity === 'HIGH' ? 'escalation' : 'rescue';
  const audienceReaction = severity === 'LOW' ? 'calm' : severity === 'MEDIUM' ? 'curious' : severity === 'HIGH' ? 'tense' : 'frenzied';
  return Object.freeze({ phrase, urgencyLabel, heatMultiplier, companionIntent, audienceReaction });
}

export function buildTickPlanAnnotation(
  plan: TickPlan,
  mode: TickPlanModeCode | null,
  operationKind: TickPlanOperationKind,
): TickPlanAnnotationBundle {
  const healthScore = computeTickPlanHealthScore(plan);
  const severity = classifyTickPlanSeverity(healthScore);
  const summary = plan.summary();
  const validation = plan.validation();
  const criticalIssues = Object.freeze(validation.errors.map(e => `${e.code}: ${e.message}`));
  const warnings = Object.freeze(validation.warnings.map(w => `${w.code}: ${w.message}`));
  const label = `TickPlan(${plan.fingerprint().slice(0, 8)}) [${severity}]`;
  const description = `${summary.enabledSteps}/${summary.totalSteps} steps enabled. Health: ${healthScore.toFixed(3)}. ${getTickPlanActionRecommendation(severity)}`;
  return Object.freeze({
    fingerprint: plan.fingerprint(),
    severity,
    healthScore,
    label,
    description,
    enabledStepCount: summary.enabledSteps,
    disabledStepCount: summary.disabledSteps,
    criticalIssues,
    warnings,
    mode,
    lifecycleState: summary.lifecycleState,
    validationPassed: validation.valid,
    operationKind,
    emittedAtMs: Date.now(),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// HEALTH SNAPSHOT AND RUN SUMMARY BUILDERS
// ────────────────────────────────────────────────────────────────────────────────

export function buildTickPlanHealthSnapshot(
  plan: TickPlan,
  mode?: TickPlanModeCode | null,
): TickPlanHealthSnapshot {
  const healthScore = computeTickPlanHealthScore(plan);
  const severity = classifyTickPlanSeverity(healthScore);
  const validation = plan.validation();
  const narrationHint = buildTickPlanNarrationHint(plan, mode ?? null);
  const summary = plan.summary();
  const criticalEnabled = (ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]).every(s => plan.isEnabled(s));
  return Object.freeze({
    fingerprint: plan.fingerprint(),
    healthScore,
    severity,
    actionRecommendation: getTickPlanActionRecommendation(severity),
    narrationHint,
    enabledCount: summary.enabledSteps,
    disabledCount: summary.disabledSteps,
    criticalStepsEnabled: criticalEnabled,
    validationPassed: validation.valid,
    validationErrors: Object.freeze(validation.errors.map(e => e.message)),
    validationWarnings: Object.freeze(validation.warnings.map(w => w.message)),
    mode: mode ?? null,
    lifecycleState: summary.lifecycleState,
  });
}

export function buildTickPlanRunSummary(
  plan: TickPlan,
  runId: string,
  tick: number,
  mode?: TickPlanModeCode | null,
): TickPlanRunSummary {
  const healthScore = computeTickPlanHealthScore(plan);
  const severity = classifyTickPlanSeverity(healthScore);
  const summary = plan.summary();
  return Object.freeze({
    runId,
    tick,
    fingerprint: plan.fingerprint(),
    healthScore,
    severity,
    enabledCount: summary.enabledSteps,
    disabledCount: summary.disabledSteps,
    validationPassed: plan.validation().valid,
    mode: mode ?? null,
    lifecycleState: summary.lifecycleState,
    narrationPhrase: getTickPlanNarrationHintPhrase(plan, mode ?? null),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// EXPORT BUNDLE BUILDER
// ────────────────────────────────────────────────────────────────────────────────

export function buildTickPlanExportBundle(
  plan: TickPlan,
  runId: string,
  tick: number,
  options?: {
    mode?: TickPlanModeCode | null;
    pressureTier?: TickPlanPressureTier | null;
    runPhase?: TickPlanRunPhase | null;
    lifecycleState?: string | null;
    terminalOutcome?: TickPlanRunOutcome | null;
  },
): TickPlanExportBundle {
  const mode = options?.mode ?? null;
  const mlVector = extractTickPlanMLVector({ plan, ...options });
  const dlTensor = buildTickPlanDLTensor(plan, options);
  const healthSnapshot = buildTickPlanHealthSnapshot(plan, mode);
  const annotation = buildTickPlanAnnotation(plan, mode, 'PLAN');
  const chatSignal = buildTickPlanChatSignal(plan, runId, tick, options);
  const runSummary = buildTickPlanRunSummary(plan, runId, tick, mode);
  return Object.freeze({
    fingerprint: plan.fingerprint(),
    schemaVersion: TICK_PLAN_SCHEMA_VERSION,
    moduleVersion: TICK_PLAN_MODULE_VERSION,
    exportedAtMs: Date.now(),
    mlVector,
    dlTensor,
    healthSnapshot,
    annotation,
    chatSignal,
    runSummary,
    validationReport: plan.validation(),
    planSummary: plan.summary(),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// TICKPLAN TREND ANALYZER
// ────────────────────────────────────────────────────────────────────────────────

export class TickPlanTrendAnalyzer {
  private readonly _window: readonly TickPlanMLVector[];
  private readonly _windowSize: number;

  public constructor(
    window: readonly TickPlanMLVector[] = [],
    windowSize: number = TICK_PLAN_TREND_WINDOW_SIZE,
  ) {
    this._window = Object.freeze([...window].slice(-windowSize));
    this._windowSize = windowSize;
  }

  public push(vector: TickPlanMLVector): TickPlanTrendAnalyzer {
    const updated = [...this._window, vector].slice(-this._windowSize);
    return new TickPlanTrendAnalyzer(Object.freeze(updated), this._windowSize);
  }

  public snapshot(): TickPlanTrendSnapshot {
    const vectors = this._window;
    if (vectors.length === 0) {
      return Object.freeze({
        windowSize: 0,
        avgHealthScore: 0,
        minHealthScore: 0,
        maxHealthScore: 0,
        avgEnabledRatio: 0,
        severityCounts: Object.freeze({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }),
        dominantSeverity: 'LOW' as TickPlanSeverity,
        criticalTrendUp: false,
        planFingerprintChanges: 0,
      });
    }

    // Use validationScore as a proxy for health score from ML vectors
    const healthScores = vectors.map(v => v.validationScore);
    const avgHealthScore = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
    const minHealthScore = Math.min(...healthScores);
    const maxHealthScore = Math.max(...healthScores);
    const avgEnabledRatio = vectors.reduce((a, v) => a + v.enabledRatio, 0) / vectors.length;

    const severityCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const v of vectors) {
      const sev = classifyTickPlanSeverity(v.validationScore);
      severityCounts[sev]++;
    }

    const dominantSeverity = (
      Object.entries(severityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'LOW'
    ) as TickPlanSeverity;

    const criticalCountFirst = Math.round(severityCounts.CRITICAL * 0.4);
    const criticalCountLast = Math.round(severityCounts.CRITICAL * 0.6);
    const criticalTrendUp = criticalCountLast > criticalCountFirst;

    // count fingerprint changes via enabledRatio steps as proxy
    let fingerprintChanges = 0;
    for (let i = 1; i < vectors.length; i++) {
      if (Math.abs(vectors[i].enabledRatio - vectors[i - 1].enabledRatio) > 0.05) fingerprintChanges++;
    }

    return Object.freeze({
      windowSize: vectors.length,
      avgHealthScore,
      minHealthScore,
      maxHealthScore,
      avgEnabledRatio,
      severityCounts: Object.freeze(severityCounts),
      dominantSeverity,
      criticalTrendUp,
      planFingerprintChanges: fingerprintChanges,
    });
  }

  public isEmpty(): boolean { return this._window.length === 0; }
  public size(): number { return this._window.length; }
  public vectors(): readonly TickPlanMLVector[] { return this._window; }
}

// ────────────────────────────────────────────────────────────────────────────────
// TICKPLAN SESSION TRACKER
// ────────────────────────────────────────────────────────────────────────────────

export class TickPlanSessionTracker {
  private readonly _sessionId: string;
  private readonly _startedAtMs: number;
  private readonly _history: readonly TickPlanAnnotationBundle[];
  private readonly _maxHistory: number;

  public constructor(
    sessionId: string,
    startedAtMs: number = Date.now(),
    history: readonly TickPlanAnnotationBundle[] = [],
    maxHistory: number = TICK_PLAN_SESSION_MAX_HISTORY,
  ) {
    this._sessionId = sessionId;
    this._startedAtMs = startedAtMs;
    this._history = Object.freeze([...history].slice(-maxHistory));
    this._maxHistory = maxHistory;
  }

  public record(bundle: TickPlanAnnotationBundle): TickPlanSessionTracker {
    const updated = [...this._history, bundle].slice(-this._maxHistory);
    return new TickPlanSessionTracker(
      this._sessionId,
      this._startedAtMs,
      Object.freeze(updated),
      this._maxHistory,
    );
  }

  public report(): TickPlanSessionReport {
    const bundles = this._history;
    const planCount = bundles.length;
    if (planCount === 0) {
      return Object.freeze({
        sessionId: this._sessionId,
        startedAtMs: this._startedAtMs,
        planCount: 0,
        avgHealthScore: 0,
        avgEnabledRatio: 0,
        validationFailures: 0,
        severityDistribution: Object.freeze({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }),
        mostFrequentFingerprint: null,
        mode: null,
      });
    }

    const avgHealthScore = bundles.reduce((a, b) => a + b.healthScore, 0) / planCount;
    const avgEnabledRatio = bundles.reduce((a, b) => a + (b.enabledStepCount / 13), 0) / planCount;
    const validationFailures = bundles.filter(b => !b.validationPassed).length;

    const severityDistribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const fingerprintCounts: Record<string, number> = {};
    const modeCounts: Record<string, number> = {};

    for (const bundle of bundles) {
      severityDistribution[bundle.severity]++;
      fingerprintCounts[bundle.fingerprint] = (fingerprintCounts[bundle.fingerprint] ?? 0) + 1;
      if (bundle.mode) modeCounts[bundle.mode] = (modeCounts[bundle.mode] ?? 0) + 1;
    }

    const mostFrequentFingerprint =
      Object.entries(fingerprintCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const mostCommonMode = topMode as TickPlanModeCode | null;

    return Object.freeze({
      sessionId: this._sessionId,
      startedAtMs: this._startedAtMs,
      planCount,
      avgHealthScore,
      avgEnabledRatio,
      validationFailures,
      severityDistribution: Object.freeze(severityDistribution),
      mostFrequentFingerprint,
      mode: mostCommonMode,
    });
  }

  public sessionId_(): string { return this._sessionId; }
  public startedAtMs_(): number { return this._startedAtMs; }
  public size(): number { return this._history.length; }
  public isEmpty(): boolean { return this._history.length === 0; }
}

// ────────────────────────────────────────────────────────────────────────────────
// TICKPLAN EVENT LOG
// ────────────────────────────────────────────────────────────────────────────────

export class TickPlanEventLog {
  private readonly _entries: readonly TickPlanEventLogEntry[];
  private readonly _maxEntries: number;
  private readonly _nextSequence: number;

  public constructor(
    entries: readonly TickPlanEventLogEntry[] = [],
    maxEntries: number = TICK_PLAN_EVENT_LOG_MAX_ENTRIES,
    nextSequence: number = 0,
  ) {
    this._entries = Object.freeze([...entries].slice(-maxEntries));
    this._maxEntries = maxEntries;
    this._nextSequence = nextSequence;
  }

  public append(
    plan: TickPlan,
    operationKind: TickPlanOperationKind,
    severity: TickPlanSeverity,
    healthScore: number,
  ): TickPlanEventLog {
    const summary = plan.summary();
    const entry: TickPlanEventLogEntry = Object.freeze({
      sequenceNumber: this._nextSequence,
      atMs: Date.now(),
      fingerprint: plan.fingerprint(),
      operationKind,
      severity,
      healthScore,
      enabledCount: summary.enabledSteps,
      disabledCount: summary.disabledSteps,
      validationPassed: plan.validation().valid,
    });
    const updated = [...this._entries, entry].slice(-this._maxEntries);
    return new TickPlanEventLog(Object.freeze(updated), this._maxEntries, this._nextSequence + 1);
  }

  public allEntries(): readonly TickPlanEventLogEntry[] { return this._entries; }
  public size(): number { return this._entries.length; }
  public isEmpty(): boolean { return this._entries.length === 0; }

  public bySeverity(severity: TickPlanSeverity): readonly TickPlanEventLogEntry[] {
    return Object.freeze(this._entries.filter(e => e.severity === severity));
  }

  public byOperation(kind: TickPlanOperationKind): readonly TickPlanEventLogEntry[] {
    return Object.freeze(this._entries.filter(e => e.operationKind === kind));
  }

  public last(n = 10): readonly TickPlanEventLogEntry[] {
    return Object.freeze(this._entries.slice(-n));
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// TICKPLAN ANNOTATOR
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanAnnotatorOptions {
  readonly verbose: boolean;
  readonly emitForLow: boolean;
  readonly emitForMedium: boolean;
  readonly emitForHigh: boolean;
  readonly emitForCritical: boolean;
  readonly includeMLVector: boolean;
  readonly includeDLTensor: boolean;
}

export class TickPlanAnnotator {
  private readonly _options: TickPlanAnnotatorOptions;

  public constructor(options: TickPlanAnnotatorOptions) {
    this._options = Object.freeze({ ...options });
  }

  public shouldEmit(severity: TickPlanSeverity): boolean {
    switch (severity) {
      case 'LOW': return this._options.emitForLow;
      case 'MEDIUM': return this._options.emitForMedium;
      case 'HIGH': return this._options.emitForHigh;
      case 'CRITICAL': return this._options.emitForCritical;
    }
  }

  public annotate(
    plan: TickPlan,
    mode: TickPlanModeCode | null,
    operationKind: TickPlanOperationKind,
  ): TickPlanAnnotationBundle | null {
    const healthScore = computeTickPlanHealthScore(plan);
    const severity = classifyTickPlanSeverity(healthScore);
    if (!this.shouldEmit(severity)) return null;
    return buildTickPlanAnnotation(plan, mode, operationKind);
  }

  public options_(): TickPlanAnnotatorOptions { return this._options; }
}

// ────────────────────────────────────────────────────────────────────────────────
// TICKPLAN INSPECTOR
// ────────────────────────────────────────────────────────────────────────────────

export class TickPlanInspector {
  private readonly _annotator: TickPlanAnnotator;

  public constructor(annotator: TickPlanAnnotator) {
    this._annotator = annotator;
  }

  public inspect(
    plan: TickPlan,
    runId: string,
    tick: number,
    options?: {
      mode?: TickPlanModeCode | null;
      pressureTier?: TickPlanPressureTier | null;
      runPhase?: TickPlanRunPhase | null;
      lifecycleState?: string | null;
      terminalOutcome?: TickPlanRunOutcome | null;
      operationKind?: TickPlanOperationKind;
    },
  ): TickPlanInspectionBundle {
    const mode = options?.mode ?? null;
    const operationKind = options?.operationKind ?? 'PLAN';
    const mlVector = extractTickPlanMLVector({ plan, ...options });
    const dlTensor = buildTickPlanDLTensor(plan, options);
    const healthSnapshot = buildTickPlanHealthSnapshot(plan, mode);
    const annotation =
      this._annotator.annotate(plan, mode, operationKind) ??
      buildTickPlanAnnotation(plan, mode, operationKind);
    const chatSignal = buildTickPlanChatSignal(plan, runId, tick, options);
    const narrationHint = buildTickPlanNarrationHint(plan, mode);
    const runSummary = buildTickPlanRunSummary(plan, runId, tick, mode);
    const exportBundle = buildTickPlanExportBundle(plan, runId, tick, options);
    return Object.freeze({
      plan,
      mlVector,
      dlTensor,
      healthSnapshot,
      annotation,
      chatSignal,
      narrationHint,
      runSummary,
      exportBundle,
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// SINGLETON ANNOTATORS AND INSPECTORS
// ────────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_DEFAULT_ANNOTATOR = new TickPlanAnnotator({
  verbose: false,
  emitForLow: false,
  emitForMedium: true,
  emitForHigh: true,
  emitForCritical: true,
  includeMLVector: false,
  includeDLTensor: false,
});

export const TICK_PLAN_STRICT_ANNOTATOR = new TickPlanAnnotator({
  verbose: false,
  emitForLow: false,
  emitForMedium: false,
  emitForHigh: true,
  emitForCritical: true,
  includeMLVector: false,
  includeDLTensor: false,
});

export const TICK_PLAN_VERBOSE_ANNOTATOR = new TickPlanAnnotator({
  verbose: true,
  emitForLow: true,
  emitForMedium: true,
  emitForHigh: true,
  emitForCritical: true,
  includeMLVector: true,
  includeDLTensor: true,
});

export const TICK_PLAN_DEFAULT_INSPECTOR = new TickPlanInspector(TICK_PLAN_DEFAULT_ANNOTATOR);
export const TICK_PLAN_STRICT_INSPECTOR = new TickPlanInspector(TICK_PLAN_STRICT_ANNOTATOR);
export const TICK_PLAN_VERBOSE_INSPECTOR = new TickPlanInspector(TICK_PLAN_VERBOSE_ANNOTATOR);

// ────────────────────────────────────────────────────────────────────────────────
// ML AND DL EXTRACTOR SINGLETONS
// ────────────────────────────────────────────────────────────────────────────────

export const ZERO_TICK_PLAN_ML_EXTRACTOR = Object.freeze({
  extract: extractTickPlanMLVector,
  validate: validateTickPlanMLVector,
  flatten: flattenTickPlanMLVector,
  namedMap: buildTickPlanMLNamedMap,
  similarity: computeTickPlanMLSimilarity,
  topFeatures: getTopTickPlanFeatures,
  serialize: serializeTickPlanMLVector,
  clone: cloneTickPlanMLVector,
});

export const ZERO_TICK_PLAN_DL_BUILDER = Object.freeze({
  build: buildTickPlanDLTensor,
  flatten: flattenTickPlanDLTensor,
  column: extractTickPlanDLColumn,
  serialize: serializeTickPlanDLTensor,
});

// ────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION AND TICKPLANWITHANALYTICS TYPE
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanWithAnalytics {
  readonly plan: TickPlan;
  readonly trendAnalyzer: TickPlanTrendAnalyzer;
  readonly sessionTracker: TickPlanSessionTracker;
  readonly eventLog: TickPlanEventLog;
  readonly annotator: TickPlanAnnotator;
  readonly inspector: TickPlanInspector;
}

export function createTickPlanWithAnalytics(
  input?: TickPlanBuildInput | OrchestratorConfig | ResolvedOrchestratorConfig,
  sessionId?: string,
): TickPlanWithAnalytics {
  const plan = createTickPlan(input);
  const trendAnalyzer = new TickPlanTrendAnalyzer();
  const sessionTracker = new TickPlanSessionTracker(sessionId ?? `tickplan-${Date.now()}`);
  const eventLog = new TickPlanEventLog();
  const annotator = TICK_PLAN_DEFAULT_ANNOTATOR;
  const inspector = TICK_PLAN_DEFAULT_INSPECTOR;
  return Object.freeze({ plan, trendAnalyzer, sessionTracker, eventLog, annotator, inspector });
}

// ────────────────────────────────────────────────────────────────────────────────
// DEFAULT CONSTANT INSTANCES
// ────────────────────────────────────────────────────────────────────────────────

// Use a fresh plan instance to avoid Readonly<TickPlan> incompatibility from Object.freeze
const _defaultPlanForAnalytics: TickPlan = createDefaultTickPlan();

export const ZERO_DEFAULT_TICK_PLAN_ML_VECTOR: TickPlanMLVector = extractTickPlanMLVector({
  plan: _defaultPlanForAnalytics,
  mode: 'solo',
  pressureTier: 'T0',
  runPhase: 'FOUNDATION',
  lifecycleState: 'IDLE',
  terminalOutcome: null,
});

export const ZERO_DEFAULT_TICK_PLAN_DL_TENSOR: TickPlanDLTensor = buildTickPlanDLTensor(
  _defaultPlanForAnalytics,
  { mode: 'solo', pressureTier: 'T0', runPhase: 'FOUNDATION' },
);

export const ZERO_DEFAULT_TICK_PLAN_CHAT_SIGNAL: TickPlanChatSignal = buildTickPlanChatSignal(
  _defaultPlanForAnalytics,
  'default-run',
  0,
  { mode: 'solo', pressureTier: 'T0', runPhase: 'FOUNDATION', lifecycleState: 'IDLE', terminalOutcome: null },
);

// ────────────────────────────────────────────────────────────────────────────────
// PLAN DIFF ENGINE — structural diff between two TickPlan instances
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanStepDelta {
  readonly step: TickStep;
  readonly enabledChanged: boolean;
  readonly wasEnabled: boolean;
  readonly isEnabled: boolean;
  readonly ownerChanged: boolean;
  readonly phaseChanged: boolean;
  readonly criticalityChanged: boolean;
  readonly previousCriticality: number;
  readonly currentCriticality: number;
  readonly sealEligibleChanged: boolean;
  readonly collectSignalsChanged: boolean;
  readonly collectDiagnosticsChanged: boolean;
  readonly mutatesStateChanged: boolean;
  readonly netChange: 'ENABLED' | 'DISABLED' | 'UNCHANGED' | 'MODIFIED';
}

export interface TickPlanDiffReport {
  readonly leftFingerprint: string;
  readonly rightFingerprint: string;
  readonly identical: boolean;
  readonly stepDeltas: readonly TickPlanStepDelta[];
  readonly stepsEnabled: readonly TickStep[];
  readonly stepsDisabled: readonly TickStep[];
  readonly stepsModified: readonly TickStep[];
  readonly stepsUnchanged: readonly TickStep[];
  readonly enabledDelta: number;
  readonly disabledDelta: number;
  readonly criticalStepsEnabledDelta: number;
  readonly healthScoreDelta: number;
  readonly leftHealthScore: number;
  readonly rightHealthScore: number;
  readonly leftSeverity: TickPlanSeverity;
  readonly rightSeverity: TickPlanSeverity;
  readonly severityImproved: boolean;
  readonly severityDegraded: boolean;
  readonly phaseImpact: Readonly<Record<TickStepPhase, number>>;
  readonly diffScore: number;
  readonly emittedAtMs: number;
}

export function diffTickPlans(left: TickPlan, right: TickPlan): TickPlanDiffReport {
  const stepDeltas: TickPlanStepDelta[] = [];
  const stepsEnabled: TickStep[] = [];
  const stepsDisabled: TickStep[] = [];
  const stepsModified: TickStep[] = [];
  const stepsUnchanged: TickStep[] = [];

  for (const step of TICK_SEQUENCE) {
    const leftEntry = left.getEntry(step);
    const rightEntry = right.getEntry(step);
    const leftPolicy = left.getResolvedPolicy(step);
    const rightPolicy = right.getResolvedPolicy(step);
    const wasEnabled = leftEntry.enabled;
    const isEnabledNow = rightEntry.enabled;
    const enabledChanged = wasEnabled !== isEnabledNow;
    const ownerChanged = left.getOwner(step) !== right.getOwner(step);
    const phaseChanged = left.getPhase(step) !== right.getPhase(step);
    const prevCrit = TICK_PLAN_STEP_CRITICALITY_SCORE[step] ?? 0.5;
    const currCrit = TICK_PLAN_STEP_CRITICALITY_SCORE[step] ?? 0.5;
    const criticalityChanged = prevCrit !== currCrit;
    const sealEligibleChanged = leftPolicy.sealEligible !== rightPolicy.sealEligible;
    const collectSignalsChanged = leftPolicy.collectSignals !== rightPolicy.collectSignals;
    const collectDiagnosticsChanged = leftPolicy.collectDiagnostics !== rightPolicy.collectDiagnostics;
    const mutatesStateChanged = leftPolicy.snapshotMutationExpected !== rightPolicy.snapshotMutationExpected;

    let netChange: TickPlanStepDelta['netChange'];
    if (enabledChanged) {
      netChange = isEnabledNow ? 'ENABLED' : 'DISABLED';
    } else if (ownerChanged || phaseChanged || sealEligibleChanged || collectSignalsChanged || collectDiagnosticsChanged || mutatesStateChanged) {
      netChange = 'MODIFIED';
    } else {
      netChange = 'UNCHANGED';
    }

    const delta: TickPlanStepDelta = Object.freeze({
      step,
      enabledChanged,
      wasEnabled,
      isEnabled: isEnabledNow,
      ownerChanged,
      phaseChanged,
      criticalityChanged,
      previousCriticality: prevCrit,
      currentCriticality: currCrit,
      sealEligibleChanged,
      collectSignalsChanged,
      collectDiagnosticsChanged,
      mutatesStateChanged,
      netChange,
    });

    stepDeltas.push(delta);
    if (netChange === 'ENABLED') stepsEnabled.push(step);
    else if (netChange === 'DISABLED') stepsDisabled.push(step);
    else if (netChange === 'MODIFIED') stepsModified.push(step);
    else stepsUnchanged.push(step);
  }

  const leftHealthScore = computeTickPlanHealthScore(left);
  const rightHealthScore = computeTickPlanHealthScore(right);
  const leftSeverity = classifyTickPlanSeverity(leftHealthScore);
  const rightSeverity = classifyTickPlanSeverity(rightHealthScore);
  const healthScoreDelta = rightHealthScore - leftHealthScore;

  const severityOrder: TickPlanSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const leftSevIdx = severityOrder.indexOf(leftSeverity);
  const rightSevIdx = severityOrder.indexOf(rightSeverity);
  const severityImproved = rightSevIdx < leftSevIdx;
  const severityDegraded = rightSevIdx > leftSevIdx;

  const leftCritEnabled = (ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]).filter(s => left.isEnabled(s)).length;
  const rightCritEnabled = (ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]).filter(s => right.isEnabled(s)).length;
  const criticalStepsEnabledDelta = rightCritEnabled - leftCritEnabled;
  const enabledDelta = right.enabledCount() - left.enabledCount();
  const disabledDelta = right.disabledCount() - left.disabledCount();

  const phaseImpact = {} as Record<TickStepPhase, number>;
  for (const phase of ZERO_TICK_PLAN_PHASES) {
    const leftPhaseEnabled = left.phaseSlice(phase).enabledCount;
    const rightPhaseEnabled = right.phaseSlice(phase).enabledCount;
    phaseImpact[phase] = rightPhaseEnabled - leftPhaseEnabled;
  }

  const totalChanges = stepsEnabled.length + stepsDisabled.length + stepsModified.length;
  const diffScore = clamp01(totalChanges / TICK_SEQUENCE.length);
  const identical = diffScore === 0 && left.fingerprint() === right.fingerprint();

  return Object.freeze({
    leftFingerprint: left.fingerprint(),
    rightFingerprint: right.fingerprint(),
    identical,
    stepDeltas: Object.freeze(stepDeltas),
    stepsEnabled: Object.freeze(stepsEnabled),
    stepsDisabled: Object.freeze(stepsDisabled),
    stepsModified: Object.freeze(stepsModified),
    stepsUnchanged: Object.freeze(stepsUnchanged),
    enabledDelta,
    disabledDelta,
    criticalStepsEnabledDelta,
    healthScoreDelta,
    leftHealthScore,
    rightHealthScore,
    leftSeverity,
    rightSeverity,
    severityImproved,
    severityDegraded,
    phaseImpact: Object.freeze(phaseImpact),
    diffScore,
    emittedAtMs: Date.now(),
  });
}

export function computeTickPlanDeltaMLVector(
  left: TickPlanMLVector,
  right: TickPlanMLVector,
): Readonly<Record<string, number>> {
  const delta: Record<string, number> = {};
  for (const label of TICK_PLAN_ML_FEATURE_LABELS) {
    const lv = left[label as keyof TickPlanMLVector] as number;
    const rv = right[label as keyof TickPlanMLVector] as number;
    delta[label] = rv - lv;
  }
  return Object.freeze(delta);
}

export function diffScoreToSeverity(diffScore: number): TickPlanSeverity {
  if (diffScore < 0.05) return 'LOW';
  if (diffScore < 0.2) return 'MEDIUM';
  if (diffScore < 0.5) return 'HIGH';
  return 'CRITICAL';
}

// ────────────────────────────────────────────────────────────────────────────────
// COVERAGE MATRIX — per-step coverage across phases and owners
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanCoverageCell {
  readonly step: TickStep;
  readonly phase: TickStepPhase;
  readonly owner: StepRuntimeOwner;
  readonly enabled: boolean;
  readonly criticality: number;
  readonly impactScore: number;
  readonly riskScore: number;
  readonly coverageScore: number;
}

export interface TickPlanCoverageMatrix {
  readonly cells: readonly TickPlanCoverageCell[];
  readonly byPhase: Readonly<Record<TickStepPhase, readonly TickPlanCoverageCell[]>>;
  readonly byOwner: Readonly<Record<StepRuntimeOwner, readonly TickPlanCoverageCell[]>>;
  readonly overallCoverage: number;
  readonly phaseCoverage: Readonly<Record<TickStepPhase, number>>;
  readonly ownerCoverage: Readonly<Record<StepRuntimeOwner, number>>;
  readonly criticalCoverage: number;
  readonly uncoveredSteps: readonly TickStep[];
  readonly weakestPhase: TickStepPhase;
  readonly weakestOwner: StepRuntimeOwner;
}

export function computeTickPlanCoverageMatrix(plan: TickPlan): TickPlanCoverageMatrix {
  const cells: TickPlanCoverageCell[] = [];

  for (const step of TICK_SEQUENCE) {
    const phase = plan.getPhase(step);
    const owner = plan.getOwner(step);
    const enabled = plan.isEnabled(step);
    const criticality = TICK_PLAN_STEP_CRITICALITY_SCORE[step] ?? 0.5;
    const phaseWeight = TICK_PLAN_STEP_PHASE_WEIGHT[phase] ?? 0.2;
    const prereqCount = ZERO_TICK_PLAN_DIRECT_DEPENDENCIES[step].length;
    const impactScore = clamp01(criticality * phaseWeight * (1 + prereqCount * 0.1));
    const riskScore = enabled ? 0 : clamp01(criticality * (isTickPlanCriticalStep(step) ? 1.5 : 1.0));
    const coverageScore = enabled ? clamp01(criticality * phaseWeight) : 0;

    cells.push(Object.freeze({
      step,
      phase,
      owner,
      enabled,
      criticality,
      impactScore,
      riskScore,
      coverageScore,
    }));
  }

  const byPhase = {} as Record<TickStepPhase, TickPlanCoverageCell[]>;
  const byOwner = {} as Record<StepRuntimeOwner, TickPlanCoverageCell[]>;

  for (const phase of ZERO_TICK_PLAN_PHASES) byPhase[phase] = [];
  for (const owner of ZERO_TICK_PLAN_OWNERS) byOwner[owner] = [];

  for (const cell of cells) {
    byPhase[cell.phase].push(cell);
    byOwner[cell.owner].push(cell);
  }

  const totalCoverageScore = cells.reduce((a, c) => a + (c.enabled ? c.criticality : 0), 0);
  const maxCoverageScore = cells.reduce((a, c) => a + c.criticality, 0);
  const overallCoverage = maxCoverageScore > 0 ? clamp01(totalCoverageScore / maxCoverageScore) : 0;

  const phaseCoverage = {} as Record<TickStepPhase, number>;
  for (const phase of ZERO_TICK_PLAN_PHASES) {
    const phaseCells = byPhase[phase];
    const total = phaseCells.reduce((a, c) => a + c.criticality, 0);
    const covered = phaseCells.reduce((a, c) => a + (c.enabled ? c.criticality : 0), 0);
    phaseCoverage[phase] = total > 0 ? clamp01(covered / total) : 0;
  }

  const ownerCoverage = {} as Record<StepRuntimeOwner, number>;
  for (const owner of ZERO_TICK_PLAN_OWNERS) {
    const ownerCells = byOwner[owner];
    const total = ownerCells.reduce((a, c) => a + c.criticality, 0);
    const covered = ownerCells.reduce((a, c) => a + (c.enabled ? c.criticality : 0), 0);
    ownerCoverage[owner] = total > 0 ? clamp01(covered / total) : 1;
  }

  const criticalCells = cells.filter(c => isTickPlanCriticalStep(c.step));
  const critCovered = criticalCells.filter(c => c.enabled).length;
  const criticalCoverage = criticalCells.length > 0 ? clamp01(critCovered / criticalCells.length) : 1;

  const uncoveredSteps = cells.filter(c => !c.enabled).map(c => c.step);

  const weakestPhase = (Object.entries(phaseCoverage).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'ENGINE') as TickStepPhase;

  const ownerCoverageEntries = Object.entries(ownerCoverage).filter(([owner]) => (byOwner as Record<string, TickPlanCoverageCell[]>)[owner].length > 0);
  const weakestOwner = (ownerCoverageEntries.sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'system') as StepRuntimeOwner;

  const frozenByPhase = {} as Record<TickStepPhase, readonly TickPlanCoverageCell[]>;
  for (const phase of ZERO_TICK_PLAN_PHASES) frozenByPhase[phase] = Object.freeze(byPhase[phase]);

  const frozenByOwner = {} as Record<StepRuntimeOwner, readonly TickPlanCoverageCell[]>;
  for (const owner of ZERO_TICK_PLAN_OWNERS) frozenByOwner[owner] = Object.freeze(byOwner[owner]);

  return Object.freeze({
    cells: Object.freeze(cells),
    byPhase: Object.freeze(frozenByPhase),
    byOwner: Object.freeze(frozenByOwner),
    overallCoverage,
    phaseCoverage: Object.freeze(phaseCoverage),
    ownerCoverage: Object.freeze(ownerCoverage),
    criticalCoverage,
    uncoveredSteps: Object.freeze(uncoveredSteps),
    weakestPhase,
    weakestOwner,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// STEP CONFIDENCE & IMPACT — per-step risk and execution confidence
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanStepConfidence {
  readonly step: TickStep;
  readonly impactScore: number;
  readonly riskScore: number;
  readonly dependencyDepth: number;
  readonly downstreamExposure: number;
  readonly confidenceScore: number;
  readonly isCritical: boolean;
  readonly isBoundary: boolean;
  readonly prerequisitesSatisfied: boolean;
  readonly recommendation: string;
}

export interface TickPlanStepRanking {
  readonly byImpact: readonly { step: TickStep; score: number }[];
  readonly byRisk: readonly { step: TickStep; score: number }[];
  readonly byConfidence: readonly { step: TickStep; score: number }[];
}

export function computeStepImpactScore(plan: TickPlan, step: TickStep): number {
  const criticality = TICK_PLAN_STEP_CRITICALITY_SCORE[step] ?? 0.5;
  const phase = plan.getPhase(step);
  const phaseWeight = TICK_PLAN_STEP_PHASE_WEIGHT[phase] ?? 0.2;
  const downstreamEnabled = plan.transitiveDependents(step).filter(s => plan.isEnabled(s)).length;
  const downstreamFactor = clamp01(downstreamEnabled / 10);
  return clamp01((criticality * 0.5) + (phaseWeight * 0.3) + (downstreamFactor * 0.2));
}

export function computeStepRiskScore(plan: TickPlan, step: TickStep): number {
  if (plan.isEnabled(step)) return 0;
  const criticality = TICK_PLAN_STEP_CRITICALITY_SCORE[step] ?? 0.5;
  const isCrit = isTickPlanCriticalStep(step) ? 1.0 : 0.5;
  const downstreamImpact = clamp01(plan.transitiveDependents(step).filter(s => plan.isEnabled(s)).length / 8);
  return clamp01((criticality * 0.4) + (isCrit * 0.4) + (downstreamImpact * 0.2));
}

export function getTickPlanStepConfidence(plan: TickPlan, step: TickStep): TickPlanStepConfidence {
  const impactScore = computeStepImpactScore(plan, step);
  const riskScore = computeStepRiskScore(plan, step);
  const transitivePrereqs = plan.transitivePrerequisites(step);
  const dependencyDepth = clamp01(transitivePrereqs.length / 12);
  const downstreamSteps = plan.transitiveDependents(step).filter(s => plan.isEnabled(s));
  const downstreamExposure = clamp01(downstreamSteps.length / 10);
  const isCritical = isTickPlanCriticalStep(step);
  const isBoundary = isTickPlanBoundaryStep(step);
  const prereqsSatisfied = transitivePrereqs.every(p => plan.isEnabled(p));
  const confidenceScore = plan.isEnabled(step)
    ? clamp01(1 - riskScore * 0.3 - (prereqsSatisfied ? 0 : 0.2))
    : 0;

  let recommendation: string;
  if (!plan.isEnabled(step)) {
    recommendation = isCritical
      ? `CRITICAL: Re-enable ${step} immediately — plan integrity at risk.`
      : `Consider enabling ${step} for improved coverage.`;
  } else if (!prereqsSatisfied) {
    recommendation = `${step} is enabled but some prerequisites are disabled — may produce incomplete output.`;
  } else {
    recommendation = `${step} is nominal.`;
  }

  return Object.freeze({
    step,
    impactScore,
    riskScore,
    dependencyDepth,
    downstreamExposure,
    confidenceScore,
    isCritical,
    isBoundary,
    prerequisitesSatisfied: prereqsSatisfied,
    recommendation,
  });
}

export function getTickPlanStepRanking(plan: TickPlan): TickPlanStepRanking {
  const byImpact = rankStepsByImpact(plan);
  const byRisk = rankStepsByRisk(plan);
  const byConfidence = Object.freeze(
    TICK_SEQUENCE.map(step => ({
      step,
      score: getTickPlanStepConfidence(plan, step).confidenceScore,
    })).sort((a, b) => b.score - a.score),
  );
  return Object.freeze({ byImpact, byRisk, byConfidence });
}

export function rankStepsByImpact(plan: TickPlan): readonly { step: TickStep; score: number }[] {
  return Object.freeze(
    TICK_SEQUENCE.map(step => ({
      step,
      score: computeStepImpactScore(plan, step),
    })).sort((a, b) => b.score - a.score),
  );
}

export function rankStepsByRisk(plan: TickPlan): readonly { step: TickStep; score: number }[] {
  return Object.freeze(
    TICK_SEQUENCE.map(step => ({
      step,
      score: computeStepRiskScore(plan, step),
    })).sort((a, b) => b.score - a.score),
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// EXECUTION ESTIMATE — execution success probability and bottleneck analysis
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanBottleneck {
  readonly step: TickStep;
  readonly reason: string;
  readonly severity: TickPlanSeverity;
  readonly riskScore: number;
  readonly disabledDependentCount: number;
  readonly recommendation: string;
}

export interface TickPlanExecutionEstimate {
  readonly successProbability: number;
  readonly criticalPathIntact: boolean;
  readonly estimatedStepsExecuted: number;
  readonly estimatedStepsSkipped: number;
  readonly bottlenecks: readonly TickPlanBottleneck[];
  readonly highestRiskStep: TickStep | null;
  readonly lowestRiskStep: TickStep | null;
  readonly estimatedOutcome: 'COMPLETE' | 'PARTIAL' | 'DEGRADED' | 'FAILED';
  readonly estimatedDataIntegrity: number;
  readonly executionHealthScore: number;
  readonly warnings: readonly string[];
}

export function getTickPlanBottlenecks(plan: TickPlan): readonly TickPlanBottleneck[] {
  const bottlenecks: TickPlanBottleneck[] = [];

  for (const step of TICK_SEQUENCE) {
    if (plan.isEnabled(step)) continue;
    const disabledDependentCount = plan.transitiveDependents(step).filter(s => plan.isEnabled(s)).length;
    if (disabledDependentCount === 0 && !isTickPlanCriticalStep(step)) continue;
    const riskScore = computeStepRiskScore(plan, step);
    if (riskScore < 0.1) continue;

    const severity = classifyTickPlanSeverity(1 - riskScore);
    const reason = isTickPlanCriticalStep(step)
      ? `Critical step ${step} is disabled`
      : `Disabled step ${step} has ${disabledDependentCount} enabled dependents at risk`;
    const recommendation = isTickPlanCriticalStep(step)
      ? `Re-enable ${step} before execution.`
      : `Consider re-enabling ${step} or disabling its ${disabledDependentCount} dependents.`;

    bottlenecks.push(Object.freeze({ step, reason, severity, riskScore, disabledDependentCount, recommendation }));
  }

  return Object.freeze(bottlenecks.sort((a, b) => b.riskScore - a.riskScore));
}

export function computeCriticalPathIntegrity(plan: TickPlan): boolean {
  return (ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]).every(s => plan.isEnabled(s));
}

export function estimateTickPlanExecutionSuccess(plan: TickPlan): TickPlanExecutionEstimate {
  const bottlenecks = getTickPlanBottlenecks(plan);
  const criticalPathIntact = computeCriticalPathIntegrity(plan);
  const enabledCount = plan.enabledCount();
  const totalCount = plan.size();
  const estimatedStepsExecuted = enabledCount;
  const estimatedStepsSkipped = totalCount - enabledCount;

  const criticalDisabledCount = (ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]).filter(s => !plan.isEnabled(s)).length;
  const validation = plan.validation();

  const baseProbability = validation.valid ? 1.0 : clamp01(1 - validation.errors.length * 0.15);
  const criticalPenalty = criticalDisabledCount * 0.25;
  const bottleneckPenalty = Math.min(0.3, bottlenecks.length * 0.05);
  const successProbability = clamp01(baseProbability - criticalPenalty - bottleneckPenalty);

  let estimatedOutcome: TickPlanExecutionEstimate['estimatedOutcome'];
  if (successProbability >= 0.9) estimatedOutcome = 'COMPLETE';
  else if (successProbability >= 0.6) estimatedOutcome = 'PARTIAL';
  else if (successProbability >= 0.3) estimatedOutcome = 'DEGRADED';
  else estimatedOutcome = 'FAILED';

  const rankingsRisk = rankStepsByRisk(plan);
  const highestRiskStep = rankingsRisk[0]?.score > 0 ? rankingsRisk[0].step : null;
  const lowestRiskStep = rankingsRisk[rankingsRisk.length - 1]?.step ?? null;

  const estimatedDataIntegrity = clamp01(
    (plan.isEnabled('STEP_10_SOVEREIGNTY_SNAPSHOT') ? 0.3 : 0) +
    (plan.isEnabled('STEP_11_OUTCOME_GATE') ? 0.3 : 0) +
    (plan.isEnabled('STEP_12_EVENT_SEAL') ? 0.2 : 0) +
    (plan.isEnabled('STEP_09_TELEMETRY') ? 0.2 : 0),
  );

  const executionHealthScore = clamp01(
    (successProbability * 0.4) +
    (criticalPathIntact ? 0.3 : 0) +
    (estimatedDataIntegrity * 0.3),
  );

  const warnings: string[] = [];
  if (!criticalPathIntact) warnings.push('Critical path broken — execution outcome uncertain.');
  if (bottlenecks.length > 3) warnings.push(`${bottlenecks.length} bottlenecks detected — review plan before execution.`);
  if (!validation.valid) warnings.push(`Validation failed with ${validation.errors.length} error(s).`);

  return Object.freeze({
    successProbability,
    criticalPathIntact,
    estimatedStepsExecuted,
    estimatedStepsSkipped,
    bottlenecks,
    highestRiskStep,
    lowestRiskStep,
    estimatedOutcome,
    estimatedDataIntegrity,
    executionHealthScore,
    warnings: Object.freeze(warnings),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// MODE ANALYTICS — mode-specific plan scoring and recommendations
// ────────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_MODE_OPTIMAL_COVERAGE = Object.freeze({
  solo: Object.freeze(['STEP_01_PREPARE', 'STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_09_TELEMETRY', 'STEP_10_SOVEREIGNTY_SNAPSHOT', 'STEP_11_OUTCOME_GATE', 'STEP_12_EVENT_SEAL', 'STEP_13_FLUSH'] as const),
  pvp: Object.freeze(['STEP_01_PREPARE', 'STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION', 'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_07_CASCADE', 'STEP_09_TELEMETRY', 'STEP_10_SOVEREIGNTY_SNAPSHOT', 'STEP_11_OUTCOME_GATE', 'STEP_12_EVENT_SEAL', 'STEP_13_FLUSH'] as const),
  coop: Object.freeze(['STEP_01_PREPARE', 'STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_07_CASCADE', 'STEP_08_MODE_POST', 'STEP_09_TELEMETRY', 'STEP_10_SOVEREIGNTY_SNAPSHOT', 'STEP_11_OUTCOME_GATE', 'STEP_12_EVENT_SEAL', 'STEP_13_FLUSH'] as const),
  ghost: Object.freeze(['STEP_01_PREPARE', 'STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION', 'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_07_CASCADE', 'STEP_08_MODE_POST', 'STEP_09_TELEMETRY', 'STEP_10_SOVEREIGNTY_SNAPSHOT', 'STEP_11_OUTCOME_GATE', 'STEP_12_EVENT_SEAL', 'STEP_13_FLUSH'] as const),
} as const);

export const TICK_PLAN_PRESSURE_TIER_HEALTH_MULTIPLIER = Object.freeze({
  T0: 1.0,
  T1: 0.95,
  T2: 0.85,
  T3: 0.7,
  T4: 0.55,
} as const);

export const TICK_PLAN_PHASE_COMPLETION_THRESHOLDS = Object.freeze({
  ORCHESTRATION: 1.0,
  ENGINE: 0.85,
  MODE: 0.5,
  OBSERVABILITY: 0.75,
  FINALIZATION: 1.0,
} as const);

export interface TickPlanModeRecommendation {
  readonly mode: TickPlanModeCode;
  readonly missingOptimalSteps: readonly TickStep[];
  readonly extraneousSteps: readonly TickStep[];
  readonly modeAlignmentScore: number;
  readonly recommendations: readonly string[];
}

export interface TickPlanPhaseCompletionReport {
  readonly phase: TickStepPhase;
  readonly completionScore: number;
  readonly meetsThreshold: boolean;
  readonly threshold: number;
  readonly enabledCount: number;
  readonly totalCount: number;
  readonly missingForThreshold: number;
}

export function getTickPlanModeRecommendations(plan: TickPlan, mode: TickPlanModeCode): TickPlanModeRecommendation {
  const optimalSet = new Set<string>(TICK_PLAN_MODE_OPTIMAL_COVERAGE[mode] as readonly string[]);
  const enabledSet = new Set<string>(plan.enabledSteps());

  const missingOptimalSteps: TickStep[] = [];
  for (const step of optimalSet) {
    if (!enabledSet.has(step)) missingOptimalSteps.push(step as TickStep);
  }

  const extraneousSteps: TickStep[] = [];
  for (const step of enabledSet) {
    if (!optimalSet.has(step)) extraneousSteps.push(step as TickStep);
  }

  const optimalCount = optimalSet.size;
  const matchingEnabled = Array.from(optimalSet).filter(s => enabledSet.has(s)).length;
  const modeAlignmentScore = optimalCount > 0 ? clamp01(matchingEnabled / optimalCount) : 1;

  const recommendations: string[] = [];
  if (missingOptimalSteps.length > 0) {
    recommendations.push(`Enable these steps for optimal ${mode} coverage: ${missingOptimalSteps.join(', ')}.`);
  }
  if (extraneousSteps.length > 0) {
    recommendations.push(`Steps enabled but not in optimal ${mode} profile: ${extraneousSteps.join(', ')}.`);
  }
  if (modeAlignmentScore >= 0.9) {
    recommendations.push(`Plan is optimally aligned for ${mode} mode.`);
  }

  return Object.freeze({
    mode,
    missingOptimalSteps: Object.freeze(missingOptimalSteps),
    extraneousSteps: Object.freeze(extraneousSteps),
    modeAlignmentScore,
    recommendations: Object.freeze(recommendations),
  });
}

export function computeModePlanScore(plan: TickPlan, mode: TickPlanModeCode): number {
  return getTickPlanModeRecommendations(plan, mode).modeAlignmentScore;
}

export function computePressureAdjustedHealthScore(plan: TickPlan, pressureTier: TickPlanPressureTier): number {
  const baseHealth = computeTickPlanHealthScore(plan);
  const multiplier = TICK_PLAN_PRESSURE_TIER_HEALTH_MULTIPLIER[pressureTier] ?? 1.0;
  return clamp01(baseHealth * multiplier);
}

export function computePhaseCompletionScore(plan: TickPlan, phase: TickStepPhase): number {
  const slice = plan.phaseSlice(phase);
  return slice.size > 0 ? clamp01(slice.enabledCount / slice.size) : 0;
}

export function computeWeightedPlanScore(plan: TickPlan): number {
  let score = 0;
  for (const phase of ZERO_TICK_PLAN_PHASES) {
    const completionScore = computePhaseCompletionScore(plan, phase);
    const weight = TICK_PLAN_STEP_PHASE_WEIGHT[phase] ?? 0.2;
    score += completionScore * weight;
  }
  return clamp01(score);
}

export function getTickPlanPhaseCompletionReport(plan: TickPlan): readonly TickPlanPhaseCompletionReport[] {
  return Object.freeze(ZERO_TICK_PLAN_PHASES.map(phase => {
    const slice = plan.phaseSlice(phase);
    const completionScore = slice.size > 0 ? clamp01(slice.enabledCount / slice.size) : 0;
    const threshold = TICK_PLAN_PHASE_COMPLETION_THRESHOLDS[phase] ?? 1.0;
    const meetsThreshold = completionScore >= threshold;
    const needed = Math.ceil(threshold * slice.size);
    const missingForThreshold = Math.max(0, needed - slice.enabledCount);
    return Object.freeze({
      phase,
      completionScore,
      meetsThreshold,
      threshold,
      enabledCount: slice.enabledCount,
      totalCount: slice.size,
      missingForThreshold,
    });
  }));
}

export function isTickPlanSafe(plan: TickPlan): { safe: boolean; reasons: readonly string[] } {
  const reasons: string[] = [];
  const validation = plan.validation();
  if (!validation.valid) {
    for (const err of validation.errors) reasons.push(`Validation error: ${err.code}: ${err.message}`);
  }
  if (!computeCriticalPathIntegrity(plan)) reasons.push('Critical path broken — one or more critical steps disabled.');
  if (!plan.isEnabled('STEP_01_PREPARE')) reasons.push('STEP_01_PREPARE is disabled — plan cannot start safely.');
  if (!plan.isEnabled('STEP_13_FLUSH')) reasons.push('STEP_13_FLUSH is disabled — plan cannot flush safely.');
  return Object.freeze({ safe: reasons.length === 0, reasons: Object.freeze(reasons) });
}

// ────────────────────────────────────────────────────────────────────────────────
// TrendAnalyzer enhancements
// ────────────────────────────────────────────────────────────────────────────────

// Extend TickPlanTrendAnalyzer with new analytics methods using prototype extension pattern
// New methods are added directly to the prototype so the class stays immutable externally
(TickPlanTrendAnalyzer.prototype as unknown as Record<string, unknown>)['regressionScore'] = function(this: TickPlanTrendAnalyzer): number {
  const vectors = this.vectors();
  const n = vectors.length;
  if (n < 2) return 0;
  const scores = vectors.map(v => v.validationScore);
  const xMean = (n - 1) / 2;
  const yMean = scores.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (scores[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  return Math.max(-1, Math.min(1, slope * 10));
};

(TickPlanTrendAnalyzer.prototype as unknown as Record<string, unknown>)['volatilityScore'] = function(this: TickPlanTrendAnalyzer): number {
  const vectors = this.vectors();
  if (vectors.length < 2) return 0;
  const scores = vectors.map(v => v.validationScore);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  return clamp01(Math.sqrt(variance));
};

(TickPlanTrendAnalyzer.prototype as unknown as Record<string, unknown>)['momentumScore'] = function(this: TickPlanTrendAnalyzer): number {
  const vectors = this.vectors();
  if (vectors.length === 0) return 0;
  const midpoint = Math.floor(vectors.length / 2);
  const olderHalf = vectors.slice(0, midpoint);
  const recentHalf = vectors.slice(midpoint);
  const olderAvg = olderHalf.length > 0 ? olderHalf.reduce((a, v) => a + v.validationScore, 0) / olderHalf.length : 0;
  const recentAvg = recentHalf.length > 0 ? recentHalf.reduce((a, v) => a + v.validationScore * 2, 0) / (recentHalf.length * 2) : 0;
  return clamp01((olderAvg + recentAvg * 2) / 3);
};

(TickPlanTrendAnalyzer.prototype as unknown as Record<string, unknown>)['alertLevel'] = function(this: TickPlanTrendAnalyzer): 'NONE' | 'CAUTION' | 'WARN' | 'ALERT' {
  const snap = this.snapshot();
  const avg = snap.avgHealthScore;
  if (avg >= 0.75) return 'NONE';
  if (avg >= 0.5) return 'CAUTION';
  if (avg >= 0.25) return 'WARN';
  return 'ALERT';
};

(TickPlanTrendAnalyzer.prototype as unknown as Record<string, unknown>)['topDegradedFeatures'] = function(this: TickPlanTrendAnalyzer, topN = 5): readonly { label: string; delta: number }[] {
  const vectors = this.vectors();
  if (vectors.length < 2) return Object.freeze([]);
  const midpoint = Math.floor(vectors.length / 2);
  const firstHalf = vectors.slice(0, midpoint);
  const secondHalf = vectors.slice(midpoint);
  const results: { label: string; delta: number }[] = [];
  for (const label of TICK_PLAN_ML_FEATURE_LABELS) {
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, v) => a + (v[label as keyof TickPlanMLVector] as number), 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, v) => a + (v[label as keyof TickPlanMLVector] as number), 0) / secondHalf.length : 0;
    const delta = secondAvg - firstAvg;
    if (delta < 0) results.push({ label, delta });
  }
  return Object.freeze(results.sort((a, b) => a.delta - b.delta).slice(0, topN));
};

(TickPlanTrendAnalyzer.prototype as unknown as Record<string, unknown>)['recentSeverityRun'] = function(this: TickPlanTrendAnalyzer): TickPlanSeverity {
  const vectors = this.vectors();
  const recent = vectors.slice(-5);
  if (recent.length === 0) return 'LOW';
  const avgHealth = recent.reduce((a, v) => a + v.validationScore, 0) / recent.length;
  return classifyTickPlanSeverity(avgHealth);
};

(TickPlanTrendAnalyzer.prototype as unknown as Record<string, unknown>)['isStabilizing'] = function(this: TickPlanTrendAnalyzer): boolean {
  const volatility = (this as unknown as { volatilityScore(): number }).volatilityScore();
  const regression = (this as unknown as { regressionScore(): number }).regressionScore();
  return volatility < 0.1 && regression > -0.05;
};

(TickPlanTrendAnalyzer.prototype as unknown as Record<string, unknown>)['isDegrading'] = function(this: TickPlanTrendAnalyzer): boolean {
  const regression = (this as unknown as { regressionScore(): number }).regressionScore();
  const momentum = (this as unknown as { momentumScore(): number }).momentumScore();
  return regression < -0.15 || momentum < 0.4;
};

// ────────────────────────────────────────────────────────────────────────────────
// SessionTracker enhancements
// ────────────────────────────────────────────────────────────────────────────────

(TickPlanSessionTracker.prototype as unknown as Record<string, unknown>)['severeEventsRatio'] = function(this: TickPlanSessionTracker): number {
  const report = this.report();
  const total = report.planCount;
  if (total === 0) return 0;
  return clamp01((report.severityDistribution.HIGH + report.severityDistribution.CRITICAL) / total);
};

(TickPlanSessionTracker.prototype as unknown as Record<string, unknown>)['topFingerprints'] = function(this: TickPlanSessionTracker, topN = 5): readonly { fingerprint: string; count: number }[] {
  const report = this.report();
  // Use mostFrequentFingerprint as the top entry since we only have the top-1 from session report
  if (report.mostFrequentFingerprint === null) return Object.freeze([]);
  return Object.freeze([{ fingerprint: report.mostFrequentFingerprint, count: 1 }].slice(0, topN));
};

(TickPlanSessionTracker.prototype as unknown as Record<string, unknown>)['sessionHealthScore'] = function(this: TickPlanSessionTracker): number {
  const report = this.report();
  if (report.planCount === 0) return 0;
  const failRatio = report.validationFailures / report.planCount;
  const severeRatio = (this as unknown as { severeEventsRatio(): number }).severeEventsRatio();
  return clamp01(report.avgHealthScore * (1 - failRatio) * (1 - severeRatio * 0.5));
};

(TickPlanSessionTracker.prototype as unknown as Record<string, unknown>)['fingerprintStability'] = function(this: TickPlanSessionTracker): number {
  const report = this.report();
  if (report.planCount === 0) return 1;
  if (report.mostFrequentFingerprint === null) return 0;
  // Approximate: if most frequent fingerprint dominates, stability is high
  // Without raw count data we use 1 as upper bound approximation
  return clamp01(1 / Math.max(1, report.planCount * 0.1));
};

(TickPlanSessionTracker.prototype as unknown as Record<string, unknown>)['recentHealthScore'] = function(this: TickPlanSessionTracker, _lastN = 10): number {
  return this.report().avgHealthScore;
};

(TickPlanSessionTracker.prototype as unknown as Record<string, unknown>)['sessionSeverity'] = function(this: TickPlanSessionTracker): TickPlanSeverity {
  const health = (this as unknown as { sessionHealthScore(): number }).sessionHealthScore();
  return classifyTickPlanSeverity(health);
};

(TickPlanSessionTracker.prototype as unknown as Record<string, unknown>)['hasCriticalHistory'] = function(this: TickPlanSessionTracker): boolean {
  return this.report().severityDistribution.CRITICAL > 0;
};

// ────────────────────────────────────────────────────────────────────────────────
// EventLog enhancements
// ────────────────────────────────────────────────────────────────────────────────

(TickPlanEventLog.prototype as unknown as Record<string, unknown>)['healthTimeSeries'] = function(this: TickPlanEventLog): readonly { atMs: number; healthScore: number; severity: TickPlanSeverity }[] {
  return Object.freeze(this.allEntries().map(e => Object.freeze({ atMs: e.atMs, healthScore: e.healthScore, severity: e.severity })));
};

(TickPlanEventLog.prototype as unknown as Record<string, unknown>)['recentAnomalies'] = function(this: TickPlanEventLog, withinMs = 60000): readonly TickPlanEventLogEntry[] {
  const cutoff = Date.now() - withinMs;
  return Object.freeze(this.allEntries().filter(e => e.atMs >= cutoff && (e.severity === 'HIGH' || e.severity === 'CRITICAL')));
};

(TickPlanEventLog.prototype as unknown as Record<string, unknown>)['fingerprintChanges'] = function(this: TickPlanEventLog): readonly { fromFingerprint: string; toFingerprint: string; atMs: number }[] {
  const entries = this.allEntries();
  const changes: { fromFingerprint: string; toFingerprint: string; atMs: number }[] = [];
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].fingerprint !== entries[i - 1].fingerprint) {
      changes.push(Object.freeze({ fromFingerprint: entries[i - 1].fingerprint, toFingerprint: entries[i].fingerprint, atMs: entries[i].atMs }));
    }
  }
  return Object.freeze(changes);
};

(TickPlanEventLog.prototype as unknown as Record<string, unknown>)['operationBreakdown'] = function(this: TickPlanEventLog): Readonly<Record<TickPlanOperationKind, number>> {
  const counts: Record<TickPlanOperationKind, number> = { PLAN: 0, VALIDATE: 0, COMPARE: 0, SNAPSHOT: 0, REBUILD: 0, NOOP: 0 };
  for (const entry of this.allEntries()) counts[entry.operationKind]++;
  return Object.freeze(counts);
};

(TickPlanEventLog.prototype as unknown as Record<string, unknown>)['avgHealthScore'] = function(this: TickPlanEventLog): number {
  const entries = this.allEntries();
  if (entries.length === 0) return 0;
  return entries.reduce((a, e) => a + e.healthScore, 0) / entries.length;
};

(TickPlanEventLog.prototype as unknown as Record<string, unknown>)['criticalRatio'] = function(this: TickPlanEventLog): number {
  if (this.size() === 0) return 0;
  return clamp01(this.bySeverity('CRITICAL').length / this.size());
};

(TickPlanEventLog.prototype as unknown as Record<string, unknown>)['mostRecentHealthScore'] = function(this: TickPlanEventLog): number {
  const entries = this.allEntries();
  return entries.length > 0 ? entries[entries.length - 1].healthScore : 0;
};

(TickPlanEventLog.prototype as unknown as Record<string, unknown>)['entriesBetween'] = function(this: TickPlanEventLog, startMs: number, endMs: number): readonly TickPlanEventLogEntry[] {
  return Object.freeze(this.allEntries().filter(e => e.atMs >= startMs && e.atMs <= endMs));
};

// ────────────────────────────────────────────────────────────────────────────────
// Annotator enhancements
// ────────────────────────────────────────────────────────────────────────────────

(TickPlanAnnotator.prototype as unknown as Record<string, unknown>)['annotateComparison'] = function(
  this: TickPlanAnnotator,
  diff: TickPlanDiffReport,
  mode: TickPlanModeCode | null,
): TickPlanAnnotationBundle | null {
  const severity = classifyTickPlanSeverity(diff.rightHealthScore);
  if (!(this as unknown as { shouldEmit(s: TickPlanSeverity): boolean }).shouldEmit(severity)) return null;
  const criticalIssues: string[] = [];
  if (diff.severityDegraded) criticalIssues.push('Plan severity degraded after change.');
  if (diff.criticalStepsEnabledDelta < 0) criticalIssues.push(`${Math.abs(diff.criticalStepsEnabledDelta)} critical step(s) disabled.`);
  return Object.freeze({
    fingerprint: diff.rightFingerprint,
    severity,
    healthScore: diff.rightHealthScore,
    label: `TickPlanDiff [${severity}] ${diff.leftFingerprint.slice(0, 8)}→${diff.rightFingerprint.slice(0, 8)}`,
    description: `Health delta: ${diff.healthScoreDelta.toFixed(3)}. Steps enabled: +${diff.stepsEnabled.length}, disabled: -${diff.stepsDisabled.length}.`,
    enabledStepCount: diff.stepsEnabled.length + diff.stepsUnchanged.length,
    disabledStepCount: diff.stepsDisabled.length,
    criticalIssues: Object.freeze(criticalIssues),
    warnings: Object.freeze(diff.stepDeltas.filter(d => d.netChange === 'MODIFIED').map(d => `Step ${d.step} modified.`)),
    mode,
    lifecycleState: null,
    validationPassed: diff.stepsDisabled.filter(s => isTickPlanCriticalStep(s)).length === 0,
    operationKind: 'COMPARE',
    emittedAtMs: diff.emittedAtMs,
  });
};

(TickPlanAnnotator.prototype as unknown as Record<string, unknown>)['annotateDiff'] = function(
  this: TickPlanAnnotator,
  diff: TickPlanDiffReport,
  mode: TickPlanModeCode | null,
): TickPlanAnnotationBundle | null {
  const severity = diffScoreToSeverity(diff.diffScore);
  if (!(this as unknown as { shouldEmit(s: TickPlanSeverity): boolean }).shouldEmit(severity)) return null;
  return Object.freeze({
    fingerprint: diff.rightFingerprint,
    severity,
    healthScore: diff.diffScore,
    label: `TickPlanDiffScore [${severity}] score=${diff.diffScore.toFixed(3)}`,
    description: `DiffScore=${diff.diffScore.toFixed(3)}. Changed ${diff.stepsEnabled.length + diff.stepsDisabled.length + diff.stepsModified.length} steps.`,
    enabledStepCount: diff.stepsUnchanged.length + diff.stepsEnabled.length,
    disabledStepCount: diff.stepsDisabled.length,
    criticalIssues: Object.freeze(diff.stepsDisabled.filter(s => isTickPlanCriticalStep(s)).map(s => `Critical step ${s} disabled.`)),
    warnings: Object.freeze(diff.stepsModified.map(s => `Step ${s} modified.`)),
    mode,
    lifecycleState: null,
    validationPassed: diff.stepsDisabled.filter(s => isTickPlanCriticalStep(s)).length === 0,
    operationKind: 'COMPARE',
    emittedAtMs: diff.emittedAtMs,
  });
};

(TickPlanAnnotator.prototype as unknown as Record<string, unknown>)['annotateExecutionEstimate'] = function(
  this: TickPlanAnnotator,
  estimate: TickPlanExecutionEstimate,
  fingerprint: string,
  mode: TickPlanModeCode | null,
): TickPlanAnnotationBundle | null {
  const severity = classifyTickPlanSeverity(estimate.successProbability);
  if (!(this as unknown as { shouldEmit(s: TickPlanSeverity): boolean }).shouldEmit(severity)) return null;
  const criticalIssues = estimate.bottlenecks.filter(b => b.severity === 'CRITICAL' || b.severity === 'HIGH').map(b => b.reason);
  return Object.freeze({
    fingerprint,
    severity,
    healthScore: estimate.successProbability,
    label: `ExecutionEstimate [${severity}] success=${estimate.successProbability.toFixed(3)}`,
    description: `Estimated outcome: ${estimate.estimatedOutcome}. Steps executed: ${estimate.estimatedStepsExecuted}/${estimate.estimatedStepsExecuted + estimate.estimatedStepsSkipped}.`,
    enabledStepCount: estimate.estimatedStepsExecuted,
    disabledStepCount: estimate.estimatedStepsSkipped,
    criticalIssues: Object.freeze(criticalIssues),
    warnings: Object.freeze(estimate.warnings),
    mode,
    lifecycleState: null,
    validationPassed: estimate.criticalPathIntact,
    operationKind: 'PLAN',
    emittedAtMs: Date.now(),
  });
};

// ────────────────────────────────────────────────────────────────────────────────
// Inspector enhancements
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanComparisonInspectionBundle {
  readonly diff: TickPlanDiffReport;
  readonly leftHealthSnapshot: TickPlanHealthSnapshot;
  readonly rightHealthSnapshot: TickPlanHealthSnapshot;
  readonly deltaMLVector: Readonly<Record<string, number>>;
  readonly annotation: TickPlanAnnotationBundle;
  readonly chatSignal: TickPlanChatSignal;
  readonly narrationHint: TickPlanNarrationHint;
  readonly coverageMatrix: TickPlanCoverageMatrix;
  readonly executionEstimate: TickPlanExecutionEstimate;
}

(TickPlanInspector.prototype as unknown as Record<string, unknown>)['inspectComparison'] = function(
  this: TickPlanInspector,
  left: TickPlan,
  right: TickPlan,
  runId: string,
  tick: number,
  options?: { mode?: TickPlanModeCode | null; pressureTier?: TickPlanPressureTier | null; runPhase?: TickPlanRunPhase | null },
): TickPlanComparisonInspectionBundle {
  const mode = options?.mode ?? null;
  const diff = diffTickPlans(left, right);
  const leftHealthSnapshot = buildTickPlanHealthSnapshot(left, mode);
  const rightHealthSnapshot = buildTickPlanHealthSnapshot(right, mode);
  const leftML = extractTickPlanMLVector({ plan: left, mode, pressureTier: options?.pressureTier, runPhase: options?.runPhase });
  const rightML = extractTickPlanMLVector({ plan: right, mode, pressureTier: options?.pressureTier, runPhase: options?.runPhase });
  const deltaMLVector = computeTickPlanDeltaMLVector(leftML, rightML);
  const annotatorInstance = (this as unknown as { _annotator: TickPlanAnnotator })._annotator;
  const annotation =
    (annotatorInstance as unknown as { annotateComparison(d: TickPlanDiffReport, m: TickPlanModeCode | null): TickPlanAnnotationBundle | null }).annotateComparison(diff, mode) ??
    buildTickPlanAnnotation(right, mode, 'COMPARE');
  const chatSignal = buildTickPlanChatSignal(right, runId, tick, { mode, pressureTier: options?.pressureTier, runPhase: options?.runPhase, operationKind: 'COMPARE' });
  const narrationHint = buildTickPlanNarrationHint(right, mode);
  const coverageMatrix = computeTickPlanCoverageMatrix(right);
  const executionEstimate = estimateTickPlanExecutionSuccess(right);
  return Object.freeze({ diff, leftHealthSnapshot, rightHealthSnapshot, deltaMLVector, annotation, chatSignal, narrationHint, coverageMatrix, executionEstimate });
};

(TickPlanInspector.prototype as unknown as Record<string, unknown>)['inspectWithTrend'] = function(
  this: TickPlanInspector,
  plan: TickPlan,
  trend: TickPlanTrendAnalyzer,
  runId: string,
  tick: number,
  options?: { mode?: TickPlanModeCode | null },
): TickPlanInspectionBundle & { readonly trendSnapshot: TickPlanTrendSnapshot; readonly alertLevel: 'NONE' | 'CAUTION' | 'WARN' | 'ALERT' } {
  const inspectFn = (this as unknown as { inspect(plan: TickPlan, runId: string, tick: number, options?: object): TickPlanInspectionBundle }).inspect;
  const baseBundle = inspectFn.call(this, plan, runId, tick, options);
  const trendSnapshot = trend.snapshot();
  const alertLevel = (trend as unknown as { alertLevel(): 'NONE' | 'CAUTION' | 'WARN' | 'ALERT' }).alertLevel();
  return Object.freeze({ ...baseBundle, trendSnapshot, alertLevel });
};

(TickPlanInspector.prototype as unknown as Record<string, unknown>)['inspectCoverage'] = function(
  this: TickPlanInspector,
  plan: TickPlan,
): TickPlanCoverageMatrix {
  return computeTickPlanCoverageMatrix(plan);
};

(TickPlanInspector.prototype as unknown as Record<string, unknown>)['inspectExecution'] = function(
  this: TickPlanInspector,
  plan: TickPlan,
): TickPlanExecutionEstimate {
  return estimateTickPlanExecutionSuccess(plan);
};

// ────────────────────────────────────────────────────────────────────────────────
// ADDITIONAL UTILITIES
// ────────────────────────────────────────────────────────────────────────────────

export function computeTickPlanProfileFit(
  plan: TickPlan,
  mode: TickPlanModeCode,
  pressureTier: TickPlanPressureTier,
): number {
  const modeScore = computeModePlanScore(plan, mode);
  const pressureHealth = computePressureAdjustedHealthScore(plan, pressureTier);
  return clamp01((modeScore * 0.6) + (pressureHealth * 0.4));
}

export function getTickPlanLoadSheddingCandidates(plan: TickPlan): readonly TickStep[] {
  return Object.freeze(
    rankStepsByImpact(plan)
      .filter(({ step }) => {
        return plan.isEnabled(step) && !isTickPlanCriticalStep(step) && !isTickPlanBoundaryStep(step);
      })
      .slice(-5)
      .map(({ step }) => step)
      .reverse(),
  );
}

export function getTickPlanMinimalSafeSubset(plan: TickPlan): readonly TickStep[] {
  const required = new Set<TickStep>(ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[]);
  for (const critStep of ZERO_TICK_PLAN_CRITICAL_STEPS) {
    for (const prereq of plan.transitivePrerequisites(critStep as TickStep)) {
      required.add(prereq);
    }
  }
  return Object.freeze(TICK_SEQUENCE.filter(s => required.has(s)));
}

export function computeTickPlanEntropy(plan: TickPlan): number {
  const total = plan.size();
  const enabled = plan.enabledCount();
  if (total === 0) return 0;
  const p = enabled / total;
  if (p <= 0 || p >= 1) return 0;
  const entropyBits = -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
  return clamp01(entropyBits);
}

export function getTickPlanDiagnosticSummary(plan: TickPlan): readonly string[] {
  const lines: string[] = [];
  const validation = plan.validation();
  for (const err of validation.errors) lines.push(`[ERROR] ${err.code}: ${err.message}`);
  for (const warn of validation.warnings) lines.push(`[WARN] ${warn.code}: ${warn.message}`);

  for (const step of ZERO_TICK_PLAN_CRITICAL_STEPS) {
    if (!plan.isEnabled(step as TickStep)) lines.push(`[CRITICAL] ${step} is disabled.`);
  }

  for (const step of TICK_SEQUENCE) {
    if (!plan.isEnabled(step)) continue;
    const semPrereqs = ZERO_TICK_PLAN_SEMANTIC_DEPENDENCIES[step];
    const disabledPrereqs = semPrereqs.filter(p => !plan.isEnabled(p));
    if (disabledPrereqs.length > 0) {
      lines.push(`[PREREQ] ${step} has disabled prerequisites: ${disabledPrereqs.join(', ')}.`);
    }
  }

  const phaseReports = getTickPlanPhaseCompletionReport(plan);
  for (const pr of phaseReports) {
    if (!pr.meetsThreshold) {
      lines.push(`[COVERAGE] Phase ${pr.phase}: ${(pr.completionScore * 100).toFixed(0)}% (threshold ${(pr.threshold * 100).toFixed(0)}%). Missing ${pr.missingForThreshold} steps.`);
    }
  }

  return Object.freeze(lines);
}

export function isTickPlanOptimalForMode(plan: TickPlan, mode: TickPlanModeCode): boolean {
  return computeModePlanScore(plan, mode) >= 0.9;
}

export function getTickPlanStepBudgetAllocation(plan: TickPlan): Readonly<Record<TickStep, number>> {
  const budgets: Record<TickStep, number> = {} as Record<TickStep, number>;
  let totalWeight = 0;

  for (const step of TICK_SEQUENCE) {
    if (!plan.isEnabled(step)) {
      budgets[step] = 0;
      continue;
    }
    const criticality = TICK_PLAN_STEP_CRITICALITY_SCORE[step] ?? 0.5;
    const phase = plan.getPhase(step);
    const phaseWeight = TICK_PLAN_STEP_PHASE_WEIGHT[phase] ?? 0.2;
    const weight = criticality * phaseWeight;
    budgets[step] = weight;
    totalWeight += weight;
  }

  if (totalWeight > 0) {
    for (const step of TICK_SEQUENCE) {
      if (plan.isEnabled(step)) budgets[step] = budgets[step] / totalWeight;
    }
  }

  return Object.freeze(budgets);
}

export function computeTickPlanReliabilityScore(plan: TickPlan): number {
  const coverage = computeTickPlanCoverageMatrix(plan);
  const validationScore = plan.validation().valid ? 1.0 : clamp01(1 - plan.validation().errors.length * 0.2);
  const estimate = estimateTickPlanExecutionSuccess(plan);
  return clamp01(
    (coverage.criticalCoverage * 0.4) +
    (validationScore * 0.3) +
    (estimate.successProbability * 0.3),
  );
}

export function computeTickPlanThroughputScore(plan: TickPlan): number {
  const engineCoverage = computePhaseCompletionScore(plan, 'ENGINE');
  const modeCoverage = computePhaseCompletionScore(plan, 'MODE');
  const observCoverage = computePhaseCompletionScore(plan, 'OBSERVABILITY');
  return clamp01(
    (engineCoverage * 0.5) +
    (modeCoverage * 0.25) +
    (observCoverage * 0.25),
  );
}

export function buildTickPlanDiagnosticsReport(
  plan: TickPlan,
  mode?: TickPlanModeCode | null,
): Readonly<{
  isValid: boolean;
  isSafe: boolean;
  isOptimalForMode: boolean;
  reliabilityScore: number;
  throughputScore: number;
  weightedPlanScore: number;
  coverageMatrix: TickPlanCoverageMatrix;
  executionEstimate: TickPlanExecutionEstimate;
  diagnosticLines: readonly string[];
  recommendations: readonly string[];
}> {
  const isValid = plan.validation().valid;
  const safeResult = isTickPlanSafe(plan);
  const isSafe = safeResult.safe;
  const isOptimalForMode = mode != null ? isTickPlanOptimalForMode(plan, mode) : false;
  const reliabilityScore = computeTickPlanReliabilityScore(plan);
  const throughputScore = computeTickPlanThroughputScore(plan);
  const weightedPlanScore = computeWeightedPlanScore(plan);
  const coverageMatrix = computeTickPlanCoverageMatrix(plan);
  const executionEstimate = estimateTickPlanExecutionSuccess(plan);
  const diagnosticLines = getTickPlanDiagnosticSummary(plan);
  const recommendations: string[] = [...safeResult.reasons];
  if (mode != null) {
    const modeRec = getTickPlanModeRecommendations(plan, mode);
    for (const rec of modeRec.recommendations) recommendations.push(rec);
  }
  if (!isValid) recommendations.push('Rebuild or fix plan before execution.');
  return Object.freeze({
    isValid,
    isSafe,
    isOptimalForMode,
    reliabilityScore,
    throughputScore,
    weightedPlanScore,
    coverageMatrix,
    executionEstimate,
    diagnosticLines,
    recommendations: Object.freeze(recommendations),
  });
}

export function buildTickPlanComparisonAnnotation(
  diff: TickPlanDiffReport,
  mode: TickPlanModeCode | null,
): TickPlanAnnotationBundle {
  const severity = diffScoreToSeverity(diff.diffScore);
  const criticalIssues = diff.stepsDisabled.filter(s => isTickPlanCriticalStep(s)).map(s => `Critical step ${s} disabled.`);
  return Object.freeze({
    fingerprint: diff.rightFingerprint,
    severity,
    healthScore: diff.diffScore,
    label: `ComparisonAnnotation [${severity}] diff=${diff.diffScore.toFixed(3)}`,
    description: `Plan changed: ${diff.stepsEnabled.length} enabled, ${diff.stepsDisabled.length} disabled, ${diff.stepsModified.length} modified.`,
    enabledStepCount: diff.stepsUnchanged.length + diff.stepsEnabled.length,
    disabledStepCount: diff.stepsDisabled.length,
    criticalIssues: Object.freeze(criticalIssues),
    warnings: Object.freeze(diff.stepsModified.map(s => `${s} modified.`)),
    mode,
    lifecycleState: null,
    validationPassed: criticalIssues.length === 0,
    operationKind: 'COMPARE',
    emittedAtMs: diff.emittedAtMs,
  });
}

export function buildTickPlanAllModeScores(plan: TickPlan): Readonly<Record<TickPlanModeCode, number>> {
  return Object.freeze({
    solo: computeModePlanScore(plan, 'solo'),
    pvp: computeModePlanScore(plan, 'pvp'),
    coop: computeModePlanScore(plan, 'coop'),
    ghost: computeModePlanScore(plan, 'ghost'),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// EXTENDED CONSTANTS AND SINGLETONS
// ────────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_STEP_DEPENDENCY_DEPTH: Readonly<Record<TickStep, number>> = Object.freeze(
  TICK_SEQUENCE.reduce<Record<TickStep, number>>((acc, step) => {
    const transitiveCount = ZERO_TICK_PLAN_DEPENDENCY_MAP[step].transitivePrerequisites.length;
    acc[step] = clamp01(transitiveCount / 12);
    return acc;
  }, {} as Record<TickStep, number>),
);

export const TICK_PLAN_STEP_IMPACT_SCORES: Readonly<Record<TickStep, number>> = Object.freeze(
  (() => {
    const defaultPlan = _defaultPlanForAnalytics;
    return TICK_SEQUENCE.reduce<Record<TickStep, number>>((acc, step) => {
      acc[step] = computeStepImpactScore(defaultPlan, step);
      return acc;
    }, {} as Record<TickStep, number>);
  })(),
);

export const TICK_PLAN_ALL_MODE_SCORES_DEFAULT: Readonly<Record<TickPlanModeCode, number>> =
  buildTickPlanAllModeScores(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_COVERAGE_MATRIX: TickPlanCoverageMatrix =
  computeTickPlanCoverageMatrix(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_EXECUTION_ESTIMATE: TickPlanExecutionEstimate =
  estimateTickPlanExecutionSuccess(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_DIAGNOSTICS_REPORT: ReturnType<typeof buildTickPlanDiagnosticsReport> =
  buildTickPlanDiagnosticsReport(_defaultPlanForAnalytics, 'solo');

export const ZERO_TICK_PLAN_INSPECTOR: TickPlanInspector = TICK_PLAN_DEFAULT_INSPECTOR;

export const ZERO_TICK_PLAN_ANNOTATOR: TickPlanAnnotator = TICK_PLAN_DEFAULT_ANNOTATOR;

export const ZERO_TICK_PLAN_ML_EXTRACTOR_EXTENDED = Object.freeze({
  ...ZERO_TICK_PLAN_ML_EXTRACTOR,
  deltaVector: computeTickPlanDeltaMLVector,
  diffScoreToSeverity,
  computeReliability: computeTickPlanReliabilityScore,
  computeThroughput: computeTickPlanThroughputScore,
  computeEntropy: computeTickPlanEntropy,
});

export const ZERO_TICK_PLAN_DL_BUILDER_EXTENDED = Object.freeze({
  ...ZERO_TICK_PLAN_DL_BUILDER,
  coverage: computeTickPlanCoverageMatrix,
  executionEstimate: estimateTickPlanExecutionSuccess,
  stepRanking: getTickPlanStepRanking,
  budgetAllocation: getTickPlanStepBudgetAllocation,
});

// ────────────────────────────────────────────────────────────────────────────────
// EXTENDED TYPE GUARDS AND VALIDATORS
// ────────────────────────────────────────────────────────────────────────────────

export function isTickPlanModeCode(value: unknown): value is TickPlanModeCode {
  return value === 'solo' || value === 'pvp' || value === 'coop' || value === 'ghost';
}

export function isTickPlanPressureTier(value: unknown): value is TickPlanPressureTier {
  return value === 'T0' || value === 'T1' || value === 'T2' || value === 'T3' || value === 'T4';
}

export function isTickPlanRunPhase(value: unknown): value is TickPlanRunPhase {
  return value === 'FOUNDATION' || value === 'ESCALATION' || value === 'SOVEREIGNTY';
}

export function isTickPlanRunOutcome(value: unknown): value is TickPlanRunOutcome {
  return value === 'FREEDOM' || value === 'TIMEOUT' || value === 'BANKRUPT' || value === 'ABANDONED';
}

export function isTickPlanDiffReport(value: unknown): value is TickPlanDiffReport {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['leftFingerprint'] === 'string' &&
    typeof v['rightFingerprint'] === 'string' &&
    typeof v['diffScore'] === 'number' &&
    Array.isArray(v['stepDeltas'])
  );
}

export function isTickPlanExecutionEstimate(value: unknown): value is TickPlanExecutionEstimate {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['successProbability'] === 'number' &&
    typeof v['criticalPathIntact'] === 'boolean' &&
    Array.isArray(v['bottlenecks'])
  );
}

export function isTickPlanCoverageMatrix(value: unknown): value is TickPlanCoverageMatrix {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v['cells']) &&
    typeof v['overallCoverage'] === 'number' &&
    typeof v['criticalCoverage'] === 'number'
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// BATCH ANALYSIS FUNCTIONS
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanBatchAnalysisResult {
  readonly plans: readonly TickPlan[];
  readonly healthScores: readonly number[];
  readonly severities: readonly TickPlanSeverity[];
  readonly avgHealthScore: number;
  readonly minHealthScore: number;
  readonly maxHealthScore: number;
  readonly dominantSeverity: TickPlanSeverity;
  readonly allValid: boolean;
  readonly validCount: number;
  readonly invalidCount: number;
  readonly criticalPathIntactCount: number;
  readonly severityDistribution: Readonly<Record<TickPlanSeverity, number>>;
}

export function analyzeTickPlanBatch(plans: readonly TickPlan[]): TickPlanBatchAnalysisResult {
  if (plans.length === 0) {
    return Object.freeze({
      plans,
      healthScores: Object.freeze([]),
      severities: Object.freeze([]),
      avgHealthScore: 0,
      minHealthScore: 0,
      maxHealthScore: 0,
      dominantSeverity: 'LOW' as TickPlanSeverity,
      allValid: true,
      validCount: 0,
      invalidCount: 0,
      criticalPathIntactCount: 0,
      severityDistribution: Object.freeze({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }),
    });
  }

  const healthScores = plans.map(p => computeTickPlanHealthScore(p));
  const severities = healthScores.map(h => classifyTickPlanSeverity(h));
  const avgHealthScore = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
  const minHealthScore = Math.min(...healthScores);
  const maxHealthScore = Math.max(...healthScores);

  const severityDistribution: Record<TickPlanSeverity, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const sev of severities) severityDistribution[sev]++;

  const dominantSeverity = (Object.entries(severityDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'LOW') as TickPlanSeverity;

  const validCount = plans.filter(p => p.validation().valid).length;
  const invalidCount = plans.length - validCount;
  const criticalPathIntactCount = plans.filter(p => computeCriticalPathIntegrity(p)).length;

  return Object.freeze({
    plans,
    healthScores: Object.freeze(healthScores),
    severities: Object.freeze(severities),
    avgHealthScore,
    minHealthScore,
    maxHealthScore,
    dominantSeverity,
    allValid: invalidCount === 0,
    validCount,
    invalidCount,
    criticalPathIntactCount,
    severityDistribution: Object.freeze(severityDistribution),
  });
}

export function diffTickPlanBatch(
  basePlan: TickPlan,
  variants: readonly TickPlan[],
): readonly TickPlanDiffReport[] {
  return Object.freeze(variants.map(variant => diffTickPlans(basePlan, variant)));
}

export function findBestPlanInBatch(plans: readonly TickPlan[]): TickPlan | null {
  if (plans.length === 0) return null;
  let best = plans[0];
  let bestScore = computeTickPlanHealthScore(best);
  for (const plan of plans.slice(1)) {
    const score = computeTickPlanHealthScore(plan);
    if (score > bestScore) {
      best = plan;
      bestScore = score;
    }
  }
  return best;
}

export function findWorstPlanInBatch(plans: readonly TickPlan[]): TickPlan | null {
  if (plans.length === 0) return null;
  let worst = plans[0];
  let worstScore = computeTickPlanHealthScore(worst);
  for (const plan of plans.slice(1)) {
    const score = computeTickPlanHealthScore(plan);
    if (score < worstScore) {
      worst = plan;
      worstScore = score;
    }
  }
  return worst;
}

// ────────────────────────────────────────────────────────────────────────────────
// PLAN HISTORY AND REVISION TRACKING
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanRevisionEntry {
  readonly revision: number;
  readonly fingerprint: string;
  readonly healthScore: number;
  readonly severity: TickPlanSeverity;
  readonly enabledCount: number;
  readonly disabledCount: number;
  readonly atMs: number;
  readonly reason: string;
}

export interface TickPlanRevisionHistory {
  readonly entries: readonly TickPlanRevisionEntry[];
  readonly latestRevision: number;
  readonly latestFingerprint: string | null;
  readonly totalRevisions: number;
  readonly averageHealthScore: number;
  readonly hasImproved: boolean;
  readonly hasDegraded: boolean;
}

export function buildTickPlanRevisionEntry(
  plan: TickPlan,
  revision: number,
  reason: string,
): TickPlanRevisionEntry {
  const healthScore = computeTickPlanHealthScore(plan);
  const severity = classifyTickPlanSeverity(healthScore);
  const summary = plan.summary();
  return Object.freeze({
    revision,
    fingerprint: plan.fingerprint(),
    healthScore,
    severity,
    enabledCount: summary.enabledSteps,
    disabledCount: summary.disabledSteps,
    atMs: Date.now(),
    reason,
  });
}

export function buildTickPlanRevisionHistory(
  entries: readonly TickPlanRevisionEntry[],
): TickPlanRevisionHistory {
  if (entries.length === 0) {
    return Object.freeze({
      entries: Object.freeze([]),
      latestRevision: -1,
      latestFingerprint: null,
      totalRevisions: 0,
      averageHealthScore: 0,
      hasImproved: false,
      hasDegraded: false,
    });
  }

  const sorted = [...entries].sort((a, b) => a.revision - b.revision);
  const latestRevision = sorted[sorted.length - 1].revision;
  const latestFingerprint = sorted[sorted.length - 1].fingerprint;
  const avgHealth = sorted.reduce((a, e) => a + e.healthScore, 0) / sorted.length;

  let hasImproved = false;
  let hasDegraded = false;
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].healthScore - sorted[i - 1].healthScore;
    if (delta > 0.05) hasImproved = true;
    if (delta < -0.05) hasDegraded = true;
  }

  return Object.freeze({
    entries: Object.freeze(sorted),
    latestRevision,
    latestFingerprint,
    totalRevisions: sorted.length,
    averageHealthScore: avgHealth,
    hasImproved,
    hasDegraded,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// PLAN MERGE AND INTERSECTION UTILITIES
// ────────────────────────────────────────────────────────────────────────────────

export function getTickPlanStepUnion(
  left: TickPlan,
  right: TickPlan,
): readonly TickStep[] {
  const union = new Set<TickStep>([...left.enabledSteps(), ...right.enabledSteps()]);
  return Object.freeze(TICK_SEQUENCE.filter(s => union.has(s)));
}

export function getTickPlanStepIntersection(
  left: TickPlan,
  right: TickPlan,
): readonly TickStep[] {
  const leftSet = new Set<TickStep>(left.enabledSteps());
  return Object.freeze(right.enabledSteps().filter(s => leftSet.has(s)));
}

export function getTickPlanStepSymmetricDifference(
  left: TickPlan,
  right: TickPlan,
): readonly TickStep[] {
  const leftSet = new Set<TickStep>(left.enabledSteps());
  const rightSet = new Set<TickStep>(right.enabledSteps());
  const result: TickStep[] = [];
  for (const step of TICK_SEQUENCE) {
    const inLeft = leftSet.has(step);
    const inRight = rightSet.has(step);
    if (inLeft !== inRight) result.push(step);
  }
  return Object.freeze(result);
}

export function computeTickPlanJaccardSimilarity(left: TickPlan, right: TickPlan): number {
  const intersection = getTickPlanStepIntersection(left, right).length;
  const union = getTickPlanStepUnion(left, right).length;
  return union === 0 ? 1 : clamp01(intersection / union);
}

// ────────────────────────────────────────────────────────────────────────────────
// PLAN SERIALIZATION AND DESERIALIZATION HELPERS
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanSerializedState {
  readonly fingerprint: string;
  readonly enabledSteps: readonly TickStep[];
  readonly disabledSteps: readonly TickStep[];
  readonly mode: TickPlanModeCode | null;
  readonly lifecycleState: string | null;
  readonly profileId: string;
  readonly healthScore: number;
  readonly severity: TickPlanSeverity;
  readonly serializedAtMs: number;
  readonly schemaVersion: number;
}

export function serializeTickPlanState(
  plan: TickPlan,
  mode?: TickPlanModeCode | null,
): TickPlanSerializedState {
  const healthScore = computeTickPlanHealthScore(plan);
  return Object.freeze({
    fingerprint: plan.fingerprint(),
    enabledSteps: plan.enabledSteps(),
    disabledSteps: plan.disabledSteps(),
    mode: mode ?? plan.mode() as TickPlanModeCode | null,
    lifecycleState: plan.lifecycleState(),
    profileId: plan.profileId(),
    healthScore,
    severity: classifyTickPlanSeverity(healthScore),
    serializedAtMs: Date.now(),
    schemaVersion: TICK_PLAN_SCHEMA_VERSION,
  });
}

export function serializeTickPlanStateToJSON(
  plan: TickPlan,
  mode?: TickPlanModeCode | null,
): string {
  return JSON.stringify(serializeTickPlanState(plan, mode));
}

// ────────────────────────────────────────────────────────────────────────────────
// HEALTH SCORE PROJECTION UTILITIES
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanHealthProjection {
  readonly currentHealthScore: number;
  readonly projectedHealthScore: number;
  readonly projectedSeverity: TickPlanSeverity;
  readonly projectedWithAllCritical: number;
  readonly projectedWithMinimalSteps: number;
  readonly healthGainIfCriticalRestored: number;
  readonly healthGainIfAllEnabled: number;
  readonly missingSteps: readonly TickStep[];
}

export function projectTickPlanHealth(plan: TickPlan): TickPlanHealthProjection {
  const currentHealthScore = computeTickPlanHealthScore(plan);
  const projectedHealthScore = currentHealthScore;
  const projectedSeverity = classifyTickPlanSeverity(projectedHealthScore);

  // Simulate all-critical-enabled
  const critSteps = ZERO_TICK_PLAN_CRITICAL_STEPS as readonly TickStep[];
  const allCritEnabled = critSteps.every(s => plan.isEnabled(s));
  const projectedWithAllCritical = allCritEnabled ? currentHealthScore : clamp01(currentHealthScore + 0.3);

  // Simulate minimal steps enabled
  const minimalSubset = getTickPlanMinimalSafeSubset(plan);
  const minimalEnabledRatio = minimalSubset.length / plan.size();
  const projectedWithMinimalSteps = clamp01(minimalEnabledRatio * 0.8);

  const healthGainIfCriticalRestored = clamp01(projectedWithAllCritical - currentHealthScore);
  const healthGainIfAllEnabled = clamp01(1.0 - currentHealthScore);
  const missingSteps = plan.disabledSteps();

  return Object.freeze({
    currentHealthScore,
    projectedHealthScore,
    projectedSeverity,
    projectedWithAllCritical,
    projectedWithMinimalSteps,
    healthGainIfCriticalRestored,
    healthGainIfAllEnabled,
    missingSteps,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// PHASE-AWARE PLAN BUILDER HELPERS
// ────────────────────────────────────────────────────────────────────────────────

export function getStepsInPhase(phase: TickStepPhase): readonly TickStep[] {
  return Object.freeze(TICK_SEQUENCE.filter(step => ZERO_TICK_PLAN_PHASE_BY_STEP[step] === phase));
}

export function getEnabledStepsInPhase(plan: TickPlan, phase: TickStepPhase): readonly TickStep[] {
  return Object.freeze(plan.enabledEntriesByPhase(phase).map(e => e.step));
}

export function getDisabledStepsInPhase(plan: TickPlan, phase: TickStepPhase): readonly TickStep[] {
  return Object.freeze(plan.disabledEntriesByPhase(phase).map(e => e.step));
}

export function getStepsForOwner(owner: StepRuntimeOwner): readonly TickStep[] {
  return Object.freeze(TICK_SEQUENCE.filter(step => ZERO_TICK_PLAN_OWNER_BY_STEP[step] === owner));
}

export function getEnabledStepsForOwner(plan: TickPlan, owner: StepRuntimeOwner): readonly TickStep[] {
  return Object.freeze(plan.enabledEntriesByOwner(owner).map(e => e.step));
}

export function getDisabledStepsForOwner(plan: TickPlan, owner: StepRuntimeOwner): readonly TickStep[] {
  return Object.freeze(plan.disabledEntriesByOwner(owner).map(e => e.step));
}

// ────────────────────────────────────────────────────────────────────────────────
// EXECUTION SIMULATION HELPERS
// ────────────────────────────────────────────────────────────────────────────────

export interface TickPlanExecutionSimulationResult {
  readonly executedSteps: readonly TickStep[];
  readonly skippedSteps: readonly TickStep[];
  readonly blockedSteps: readonly TickStep[];
  readonly completionOrder: readonly TickStep[];
  readonly wasSuccessful: boolean;
  readonly stoppedAt: TickStep | null;
  readonly stoppedReason: string | null;
  readonly dataIntegrityScore: number;
}

export function simulateTickPlanExecution(plan: TickPlan): TickPlanExecutionSimulationResult {
  const executedSteps: TickStep[] = [];
  const skippedSteps: TickStep[] = [];
  const blockedSteps: TickStep[] = [];
  const completedSet = new Set<TickStep>();
  let stoppedAt: TickStep | null = null;
  let stoppedReason: string | null = null;

  for (const step of TICK_SEQUENCE) {
    if (!plan.isEnabled(step)) {
      skippedSteps.push(step);
      continue;
    }

    const semPrereqs = ZERO_TICK_PLAN_SEMANTIC_DEPENDENCIES[step];
    const missingPrereqs = semPrereqs.filter(p => plan.isEnabled(p) && !completedSet.has(p));

    if (missingPrereqs.length > 0) {
      blockedSteps.push(step);
      if (isTickPlanCriticalStep(step) && stoppedAt === null) {
        stoppedAt = step;
        stoppedReason = `Critical step ${step} blocked by missing prerequisites: ${missingPrereqs.join(', ')}.`;
      }
      continue;
    }

    executedSteps.push(step);
    completedSet.add(step);
  }

  const wasSuccessful = stoppedAt === null && executedSteps.includes('STEP_13_FLUSH');

  const dataIntegrityScore = clamp01(
    (completedSet.has('STEP_10_SOVEREIGNTY_SNAPSHOT') ? 0.3 : 0) +
    (completedSet.has('STEP_11_OUTCOME_GATE') ? 0.3 : 0) +
    (completedSet.has('STEP_12_EVENT_SEAL') ? 0.2 : 0) +
    (completedSet.has('STEP_09_TELEMETRY') ? 0.2 : 0),
  );

  return Object.freeze({
    executedSteps: Object.freeze(executedSteps),
    skippedSteps: Object.freeze(skippedSteps),
    blockedSteps: Object.freeze(blockedSteps),
    completionOrder: Object.freeze([...executedSteps]),
    wasSuccessful,
    stoppedAt,
    stoppedReason,
    dataIntegrityScore,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ADDITIONAL PRECOMPUTED SINGLETON BUNDLES
// ────────────────────────────────────────────────────────────────────────────────

export const ZERO_DEFAULT_TICK_PLAN_STEP_RANKING: TickPlanStepRanking =
  getTickPlanStepRanking(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_BOTTLENECKS: readonly TickPlanBottleneck[] =
  getTickPlanBottlenecks(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_BUDGET_ALLOCATION: Readonly<Record<TickStep, number>> =
  getTickPlanStepBudgetAllocation(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_HEALTH_PROJECTION: TickPlanHealthProjection =
  projectTickPlanHealth(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_SIMULATION: TickPlanExecutionSimulationResult =
  simulateTickPlanExecution(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_PHASE_COMPLETION: readonly TickPlanPhaseCompletionReport[] =
  getTickPlanPhaseCompletionReport(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_MODE_RECOMMENDATIONS: Readonly<Record<TickPlanModeCode, TickPlanModeRecommendation>> =
  Object.freeze({
    solo: getTickPlanModeRecommendations(_defaultPlanForAnalytics, 'solo'),
    pvp: getTickPlanModeRecommendations(_defaultPlanForAnalytics, 'pvp'),
    coop: getTickPlanModeRecommendations(_defaultPlanForAnalytics, 'coop'),
    ghost: getTickPlanModeRecommendations(_defaultPlanForAnalytics, 'ghost'),
  });

export const ZERO_DEFAULT_TICK_PLAN_SAFETY: ReturnType<typeof isTickPlanSafe> =
  isTickPlanSafe(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_RELIABILITY_SCORE: number =
  computeTickPlanReliabilityScore(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_THROUGHPUT_SCORE: number =
  computeTickPlanThroughputScore(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_ENTROPY: number =
  computeTickPlanEntropy(_defaultPlanForAnalytics);

export const ZERO_DEFAULT_TICK_PLAN_JACCARD_SOLO_PVP: number =
  computeTickPlanJaccardSimilarity(
    buildPlanForMode('solo'),
    buildPlanForMode('pvp'),
  );

// ────────────────────────────────────────────────────────────────────────────────
// FINAL MODULE HEALTH CHECK
// ────────────────────────────────────────────────────────────────────────────────

export const TICK_PLAN_EXTENDED_MODULE_VERSION = '2.0.2026' as const;
export const TICK_PLAN_EXTENDED_READY = true as const;

export interface TickPlanExtendedModuleManifest {
  readonly version: string;
  readonly ready: boolean;
  readonly sections: readonly string[];
  readonly exportedFunctions: number;
  readonly exportedTypes: number;
  readonly exportedConstants: number;
  readonly exportedClasses: number;
}

export const TICK_PLAN_EXTENDED_MODULE_MANIFEST: TickPlanExtendedModuleManifest = Object.freeze({
  version: TICK_PLAN_EXTENDED_MODULE_VERSION,
  ready: TICK_PLAN_EXTENDED_READY,
  sections: Object.freeze([
    'Plan Diff Engine',
    'Coverage Matrix',
    'Step Confidence & Impact',
    'Execution Estimate',
    'Mode Analytics',
    'TrendAnalyzer Enhancements',
    'SessionTracker Enhancements',
    'EventLog Enhancements',
    'Annotator Enhancements',
    'Inspector Enhancements',
    'Additional Utilities',
    'Extended Constants & Singletons',
    'Extended Type Guards',
    'Batch Analysis',
    'Plan History & Revision',
    'Merge & Intersection',
    'Serialization',
    'Health Projection',
    'Phase-Aware Helpers',
    'Execution Simulation',
    'Precomputed Singleton Bundles',
  ]),
  exportedFunctions: 58,
  exportedTypes: 26,
  exportedConstants: 24,
  exportedClasses: 5,
});
