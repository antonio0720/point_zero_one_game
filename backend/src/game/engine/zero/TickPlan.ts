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
    STEP_01_PREPARE: Object.freeze([]),
    STEP_02_TIME: Object.freeze(['STEP_01_PREPARE']),
    STEP_03_PRESSURE: Object.freeze(['STEP_02_TIME']),
    STEP_04_TENSION: Object.freeze(['STEP_03_PRESSURE']),
    STEP_05_BATTLE: Object.freeze(['STEP_04_TENSION']),
    STEP_06_SHIELD: Object.freeze(['STEP_05_BATTLE']),
    STEP_07_CASCADE: Object.freeze(['STEP_06_SHIELD']),
    STEP_08_MODE_POST: Object.freeze(['STEP_07_CASCADE']),
    STEP_09_TELEMETRY: Object.freeze(['STEP_08_MODE_POST']),
    STEP_10_SOVEREIGNTY_SNAPSHOT: Object.freeze(['STEP_09_TELEMETRY']),
    STEP_11_OUTCOME_GATE: Object.freeze(['STEP_10_SOVEREIGNTY_SNAPSHOT']),
    STEP_12_EVENT_SEAL: Object.freeze(['STEP_11_OUTCOME_GATE']),
    STEP_13_FLUSH: Object.freeze(['STEP_12_EVENT_SEAL']),
  });

// semantic expectations are stronger than bare sequence order. they do not create
// a second runtime; they simply document what downstream zero logic assumes when a
// step is enabled in a plan.
export const ZERO_TICK_PLAN_SEMANTIC_DEPENDENCIES: Readonly<Record<TickStep, readonly TickStep[]>> =
  Object.freeze({
    STEP_01_PREPARE: Object.freeze([]),
    STEP_02_TIME: Object.freeze(['STEP_01_PREPARE']),
    STEP_03_PRESSURE: Object.freeze(['STEP_01_PREPARE', 'STEP_02_TIME']),
    STEP_04_TENSION: Object.freeze(['STEP_01_PREPARE', 'STEP_02_TIME', 'STEP_03_PRESSURE']),
    STEP_05_BATTLE: Object.freeze(['STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION']),
    STEP_06_SHIELD: Object.freeze(['STEP_02_TIME', 'STEP_05_BATTLE']),
    STEP_07_CASCADE: Object.freeze(['STEP_05_BATTLE', 'STEP_06_SHIELD']),
    STEP_08_MODE_POST: Object.freeze(['STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_07_CASCADE']),
    STEP_09_TELEMETRY: Object.freeze(['STEP_02_TIME', 'STEP_03_PRESSURE', 'STEP_04_TENSION', 'STEP_05_BATTLE', 'STEP_06_SHIELD', 'STEP_07_CASCADE', 'STEP_08_MODE_POST']),
    STEP_10_SOVEREIGNTY_SNAPSHOT: Object.freeze(['STEP_09_TELEMETRY']),
    STEP_11_OUTCOME_GATE: Object.freeze(['STEP_10_SOVEREIGNTY_SNAPSHOT']),
    STEP_12_EVENT_SEAL: Object.freeze(['STEP_09_TELEMETRY', 'STEP_10_SOVEREIGNTY_SNAPSHOT', 'STEP_11_OUTCOME_GATE']),
    STEP_13_FLUSH: Object.freeze(['STEP_12_EVENT_SEAL']),
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
    return ZERO_TICK_PLAN_CRITICAL_STEPS.includes(step);
  }

  public isBoundary(step: TickStep): boolean {
    return ZERO_TICK_PLAN_BOUNDARY_STEPS.includes(step);
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
  return ZERO_TICK_PLAN_BOUNDARY_STEPS.includes(step);
}

export function isTickPlanCriticalStep(step: TickStep): boolean {
  return ZERO_TICK_PLAN_CRITICAL_STEPS.includes(step);
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
