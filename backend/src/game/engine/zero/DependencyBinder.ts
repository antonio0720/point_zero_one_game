/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/DependencyBinder.ts
 *
 * Doctrine:
 * - zero owns reader wiring between engines
 * - wiring remains additive and duck-typed so repo-native engines can opt in
 *   without forced rewrites or illegal peer-engine imports
 * - this file does not import peer engine classes; it binds contracts through
 *   method presence, reader-shape introspection, and deterministic policy
 * - failure to bind a reader must be visible, queryable, and testable
 * - binding depth matters because the zero lane is the control tower for
 *   backend coordination, replay stability, diagnostics, and proof-adjacent
 *   auditability
 *
 * Notes:
 * - the live backend/core repo shape uses lowercase engine ids:
 *   'time' | 'pressure' | 'tension' | 'shield' | 'battle' | 'cascade' | 'sovereignty'
 * - the live backend tick law is the 13-step STEP_01_PREPARE → STEP_13_FLUSH chain
 * - reader wiring is intentionally performed without importing engine classes;
 *   this keeps Engine 0 in-bounds with the no-peer-class-coupling law
 * - binding is deterministic and side-effect light: only setter methods exposed
 *   by engines are invoked, and only after bundle + reader-shape inspection
 */

import type { EngineId } from '../core/EngineContracts';
import type { ModeCode } from '../core/GamePrimitives';
import type { TickStep } from '../core/TickSequence';
import {
  ZERO_REQUIRED_ENGINE_IDS,
  createDefaultOrchestratorConfig,
  resolveOrchestratorConfig,
  type ResolveOrchestratorConfigInput,
  type ResolvedOrchestratorConfig,
} from './OrchestratorConfig';
import type { ZeroDependencyBindingReport } from './zero.types';

// ────────────────────────────────────────────────────────────────────────────────
// consumer setter contracts
// ────────────────────────────────────────────────────────────────────────────────

export interface SupportsPressureReader {
  setPressureReader?(reader: unknown): void;
}

export interface SupportsShieldReader {
  setShieldReader?(reader: unknown): void;
}

export interface SupportsTensionReader {
  setTensionReader?(reader: unknown): void;
}

export interface SupportsCascadeReader {
  setCascadeReader?(reader: unknown): void;
}

// ────────────────────────────────────────────────────────────────────────────────
// reader contracts
// these are structural expectations only. the binder never imports engine classes.
// ────────────────────────────────────────────────────────────────────────────────

export interface PressureReaderContract {
  getCurrentScore?(): number;
  getCurrentTier?(): unknown;
  getStagnationCount?(): number;
}

export interface ShieldReaderContract {
  getOverallIntegrityPct?(): number;
  getLayerIntegrity?(layerId: unknown): number;
  getLayerIntegrityPct?(layerId: unknown): number;
  isLayerBreached?(layerId: unknown): boolean;
  getWeakestLayer?(): unknown;
}

export interface TensionReaderContract {
  getCurrentTensionScore?(): number;
  getQueueDepth?(): number;
  getVisibilityState?(): string;
}

export interface CascadeReaderContract {
  getActiveChainCount?(): number;
  hasActiveChainsAboveSeverity?(severity: string): boolean;
}

// ────────────────────────────────────────────────────────────────────────────────
// bundle contracts
// bundle members are intentionally structural and permissive so existing engines
// can participate without class-level rewrites.
// ────────────────────────────────────────────────────────────────────────────────

export interface ZeroDependencyBundle {
  readonly timeEngine: (SupportsPressureReader & Partial<Record<string, unknown>>) | null;
  readonly pressureEngine: (
    SupportsShieldReader &
    SupportsCascadeReader &
    Partial<Record<string, unknown>>
  ) | null;
  readonly tensionEngine: (TensionReaderContract & Partial<Record<string, unknown>>) | null;
  readonly shieldEngine: (
    SupportsTensionReader &
    ShieldReaderContract &
    Partial<Record<string, unknown>>
  ) | null;
  readonly battleEngine: (
    SupportsShieldReader &
    SupportsTensionReader &
    Partial<Record<string, unknown>>
  ) | null;
  readonly cascadeEngine: (CascadeReaderContract & Partial<Record<string, unknown>>) | null;
  readonly sovereigntyEngine?: Partial<Record<string, unknown>> | null;
}

export type DependencyBundleSlot =
  | 'timeEngine'
  | 'pressureEngine'
  | 'tensionEngine'
  | 'shieldEngine'
  | 'battleEngine'
  | 'cascadeEngine'
  | 'sovereigntyEngine';

export const ZERO_DEPENDENCY_BUNDLE_SLOTS = Object.freeze([
  'timeEngine',
  'pressureEngine',
  'tensionEngine',
  'shieldEngine',
  'battleEngine',
  'cascadeEngine',
  'sovereigntyEngine',
] as const satisfies readonly DependencyBundleSlot[]);

export const ZERO_DEPENDENCY_ENGINE_SLOT_BY_ID: Readonly<
  Record<EngineId, DependencyBundleSlot>
> = Object.freeze({
  time: 'timeEngine',
  pressure: 'pressureEngine',
  tension: 'tensionEngine',
  shield: 'shieldEngine',
  battle: 'battleEngine',
  cascade: 'cascadeEngine',
  sovereignty: 'sovereigntyEngine',
});

export const ZERO_DEPENDENCY_ENGINE_LABELS: Readonly<Record<EngineId, string>> = Object.freeze({
  time: 'Time Engine',
  pressure: 'Pressure Engine',
  tension: 'Tension Engine',
  shield: 'Shield Engine',
  battle: 'Battle Engine',
  cascade: 'Cascade Engine',
  sovereignty: 'Sovereignty Engine',
});

// ────────────────────────────────────────────────────────────────────────────────
// canonical reader-binding surfaces
// ────────────────────────────────────────────────────────────────────────────────

export type DependencyReaderContractName =
  | 'PressureReader'
  | 'ShieldReader'
  | 'TensionReader'
  | 'CascadeReader';

export const ZERO_READER_CONTRACT_NAMES = Object.freeze([
  'PressureReader',
  'ShieldReader',
  'TensionReader',
  'CascadeReader',
] as const satisfies readonly DependencyReaderContractName[]);

export type DependencySetterName =
  | 'setPressureReader'
  | 'setShieldReader'
  | 'setTensionReader'
  | 'setCascadeReader';

export const ZERO_READER_SETTER_NAMES = Object.freeze([
  'setPressureReader',
  'setShieldReader',
  'setTensionReader',
  'setCascadeReader',
] as const satisfies readonly DependencySetterName[]);

export type DependencyBindingEdgeId =
  | 'PRESSURE_READER__TIME_FROM_PRESSURE'
  | 'SHIELD_READER__PRESSURE_FROM_SHIELD'
  | 'SHIELD_READER__BATTLE_FROM_SHIELD'
  | 'TENSION_READER__SHIELD_FROM_TENSION'
  | 'TENSION_READER__BATTLE_FROM_TENSION'
  | 'CASCADE_READER__PRESSURE_FROM_CASCADE';

export const ZERO_DEPENDENCY_BINDING_EDGE_IDS = Object.freeze([
  'PRESSURE_READER__TIME_FROM_PRESSURE',
  'SHIELD_READER__PRESSURE_FROM_SHIELD',
  'SHIELD_READER__BATTLE_FROM_SHIELD',
  'TENSION_READER__SHIELD_FROM_TENSION',
  'TENSION_READER__BATTLE_FROM_TENSION',
  'CASCADE_READER__PRESSURE_FROM_CASCADE',
] as const satisfies readonly DependencyBindingEdgeId[]);

export type DependencyBindingGroup =
  | 'pressure-reader'
  | 'shield-reader'
  | 'tension-reader'
  | 'cascade-reader';

export const ZERO_DEPENDENCY_BINDING_GROUPS = Object.freeze([
  'pressure-reader',
  'shield-reader',
  'tension-reader',
  'cascade-reader',
] as const satisfies readonly DependencyBindingGroup[]);

export type DependencyBindingSeverity = 'INFO' | 'WARN' | 'ERROR';

export type DependencyBindingStatus =
  | 'BOUND'
  | 'BOUND_WITH_PARTIAL_READER'
  | 'MISSING_CONSUMER'
  | 'MISSING_READER'
  | 'MISSING_SETTER'
  | 'MISSING_READER_METHODS'
  | 'BIND_SKIPPED'
  | 'BIND_FAILED';

export const ZERO_DEPENDENCY_BINDING_STATUSES = Object.freeze([
  'BOUND',
  'BOUND_WITH_PARTIAL_READER',
  'MISSING_CONSUMER',
  'MISSING_READER',
  'MISSING_SETTER',
  'MISSING_READER_METHODS',
  'BIND_SKIPPED',
  'BIND_FAILED',
] as const satisfies readonly DependencyBindingStatus[]);

export interface DependencyBindingEdgeDefinition {
  readonly id: DependencyBindingEdgeId;
  readonly group: DependencyBindingGroup;
  readonly contractName: DependencyReaderContractName;
  readonly setterName: DependencySetterName;
  readonly consumerEngineId: EngineId;
  readonly readerEngineId: EngineId;
  readonly consumerSlot: DependencyBundleSlot;
  readonly readerSlot: DependencyBundleSlot;
  readonly requiredReaderMethods: readonly string[];
  readonly critical: boolean;
  readonly description: string;
  readonly rationale: string;
  readonly affectsSteps: readonly TickStep[];
  readonly modes: readonly ModeCode[];
}

export interface DependencyBindingAttempt {
  readonly id: DependencyBindingEdgeId;
  readonly group: DependencyBindingGroup;
  readonly contractName: DependencyReaderContractName;
  readonly setterName: DependencySetterName;
  readonly consumerEngineId: EngineId;
  readonly readerEngineId: EngineId;
  readonly status: DependencyBindingStatus;
  readonly severity: DependencyBindingSeverity;
  readonly attempted: boolean;
  readonly bound: boolean;
  readonly consumerPresent: boolean;
  readonly readerPresent: boolean;
  readonly setterPresent: boolean;
  readonly missingReaderMethods: readonly string[];
  readonly note: string;
  readonly errorMessage: string | null;
}

export interface DependencyGroupSummary {
  readonly group: DependencyBindingGroup;
  readonly bound: boolean;
  readonly totalEdges: number;
  readonly boundEdges: number;
  readonly failedEdges: number;
  readonly partialEdges: number;
  readonly notes: readonly string[];
}

export interface DependencyBinderOptions {
  readonly validateReaderContractsBeforeBind: boolean;
  readonly allowPartialReaderContracts: boolean;
  readonly bindEvenIfReaderContractIsPartial: boolean;
  readonly emitSuccessNotes: boolean;
  readonly emitGroupSummaryNotes: boolean;
  readonly emitResolvedConfigNotes: boolean;
  readonly freezeReturnedState: boolean;
  readonly includeAttemptMatrixInNotes: boolean;
  readonly treatMissingOptionalSettersAsWarnings: boolean;
  readonly treatMissingRequiredEnginesAsErrors: boolean;
}

export interface DependencyBundleInventoryEntry {
  readonly slot: DependencyBundleSlot;
  readonly engineId: EngineId | 'system';
  readonly present: boolean;
  readonly availableMethodNames: readonly string[];
  readonly notes: readonly string[];
}

export interface DependencyBundleInventory {
  readonly entries: readonly DependencyBundleInventoryEntry[];
  readonly missingRequiredEngines: readonly EngineId[];
  readonly presentEngineCount: number;
  readonly missingEngineCount: number;
}

export interface DependencyBundleValidationIssue {
  readonly severity: DependencyBindingSeverity;
  readonly code: string;
  readonly slot: DependencyBundleSlot | 'bundle';
  readonly message: string;
}

export interface DependencyBundleValidationReport {
  readonly valid: boolean;
  readonly errors: readonly DependencyBundleValidationIssue[];
  readonly warnings: readonly DependencyBundleValidationIssue[];
  readonly inventory: DependencyBundleInventory;
}

export interface DependencyBindingSession {
  readonly fingerprint: string;
  readonly resolvedProfileId: string;
  readonly resolvedMode: ModeCode | null;
  readonly attempts: readonly DependencyBindingAttempt[];
  readonly groups: readonly DependencyGroupSummary[];
  readonly report: ZeroDependencyBindingReport;
  readonly validation: DependencyBundleValidationReport;
  readonly notes: readonly string[];
}

export interface BindDependenciesInput {
  readonly bundle: ZeroDependencyBundle;
  readonly configInput?: ResolveOrchestratorConfigInput;
}

export interface DependencyBundleSummary {
  readonly fingerprint: string;
  readonly presentSlots: readonly DependencyBundleSlot[];
  readonly missingSlots: readonly DependencyBundleSlot[];
  readonly enginesPresent: readonly EngineId[];
  readonly missingRequiredEngines: readonly EngineId[];
  readonly totalMethodsExposed: number;
}

// ────────────────────────────────────────────────────────────────────────────────
// canonical modes + step affinities
// ────────────────────────────────────────────────────────────────────────────────

export const ZERO_BINDER_SUPPORTED_MODES = Object.freeze([
  'solo',
  'pvp',
  'coop',
  'ghost',
] as const satisfies readonly ModeCode[]);

export const ZERO_BINDER_PRESSURE_READER_STEPS = Object.freeze([
  'STEP_02_TIME',
  'STEP_03_PRESSURE',
] as const satisfies readonly TickStep[]);

export const ZERO_BINDER_SHIELD_READER_STEPS = Object.freeze([
  'STEP_03_PRESSURE',
  'STEP_05_BATTLE',
  'STEP_06_SHIELD',
] as const satisfies readonly TickStep[]);

export const ZERO_BINDER_TENSION_READER_STEPS = Object.freeze([
  'STEP_04_TENSION',
  'STEP_05_BATTLE',
  'STEP_06_SHIELD',
] as const satisfies readonly TickStep[]);

export const ZERO_BINDER_CASCADE_READER_STEPS = Object.freeze([
  'STEP_03_PRESSURE',
  'STEP_07_CASCADE',
] as const satisfies readonly TickStep[]);

export const ZERO_DEPENDENCY_READER_METHODS: Readonly<
  Record<DependencyReaderContractName, readonly string[]>
> = Object.freeze({
  PressureReader: Object.freeze([
    'getCurrentScore',
    'getCurrentTier',
    'getStagnationCount',
  ]),
  ShieldReader: Object.freeze([
    'getOverallIntegrityPct',
    'getLayerIntegrity',
    'getLayerIntegrityPct',
    'isLayerBreached',
    'getWeakestLayer',
  ]),
  TensionReader: Object.freeze([
    'getCurrentTensionScore',
    'getQueueDepth',
    'getVisibilityState',
  ]),
  CascadeReader: Object.freeze([
    'getActiveChainCount',
    'hasActiveChainsAboveSeverity',
  ]),
});

export const ZERO_CANONICAL_BINDING_EDGES: readonly DependencyBindingEdgeDefinition[] = Object.freeze([
  Object.freeze({
    id: 'PRESSURE_READER__TIME_FROM_PRESSURE',
    group: 'pressure-reader',
    contractName: 'PressureReader',
    setterName: 'setPressureReader',
    consumerEngineId: 'time',
    readerEngineId: 'pressure',
    consumerSlot: 'timeEngine',
    readerSlot: 'pressureEngine',
    requiredReaderMethods: ZERO_DEPENDENCY_READER_METHODS.PressureReader,
    critical: true,
    description: 'Binds pressure reader into time engine.',
    rationale:
      'Time cadence, tier steering, and decision-window pressure reactions depend on pressure visibility.',
    affectsSteps: ZERO_BINDER_PRESSURE_READER_STEPS,
    modes: ZERO_BINDER_SUPPORTED_MODES,
  }),
  Object.freeze({
    id: 'SHIELD_READER__PRESSURE_FROM_SHIELD',
    group: 'shield-reader',
    contractName: 'ShieldReader',
    setterName: 'setShieldReader',
    consumerEngineId: 'pressure',
    readerEngineId: 'shield',
    consumerSlot: 'pressureEngine',
    readerSlot: 'shieldEngine',
    requiredReaderMethods: ZERO_DEPENDENCY_READER_METHODS.ShieldReader,
    critical: true,
    description: 'Binds shield reader into pressure engine.',
    rationale:
      'Pressure weighting includes shield integrity, breach posture, and weakest-layer exposure.',
    affectsSteps: ZERO_BINDER_SHIELD_READER_STEPS,
    modes: ZERO_BINDER_SUPPORTED_MODES,
  }),
  Object.freeze({
    id: 'SHIELD_READER__BATTLE_FROM_SHIELD',
    group: 'shield-reader',
    contractName: 'ShieldReader',
    setterName: 'setShieldReader',
    consumerEngineId: 'battle',
    readerEngineId: 'shield',
    consumerSlot: 'battleEngine',
    readerSlot: 'shieldEngine',
    requiredReaderMethods: ZERO_DEPENDENCY_READER_METHODS.ShieldReader,
    critical: true,
    description: 'Binds shield reader into battle engine.',
    rationale:
      'Battle targeting and injection posture depend on weakest-layer and breach visibility.',
    affectsSteps: ZERO_BINDER_SHIELD_READER_STEPS,
    modes: ZERO_BINDER_SUPPORTED_MODES,
  }),
  Object.freeze({
    id: 'TENSION_READER__SHIELD_FROM_TENSION',
    group: 'tension-reader',
    contractName: 'TensionReader',
    setterName: 'setTensionReader',
    consumerEngineId: 'shield',
    readerEngineId: 'tension',
    consumerSlot: 'shieldEngine',
    readerSlot: 'tensionEngine',
    requiredReaderMethods: ZERO_DEPENDENCY_READER_METHODS.TensionReader,
    critical: true,
    description: 'Binds tension reader into shield engine.',
    rationale:
      'Shield pacing, regen posture, and conditional breach responses may scale with tension score.',
    affectsSteps: ZERO_BINDER_TENSION_READER_STEPS,
    modes: ZERO_BINDER_SUPPORTED_MODES,
  }),
  Object.freeze({
    id: 'TENSION_READER__BATTLE_FROM_TENSION',
    group: 'tension-reader',
    contractName: 'TensionReader',
    setterName: 'setTensionReader',
    consumerEngineId: 'battle',
    readerEngineId: 'tension',
    consumerSlot: 'battleEngine',
    readerSlot: 'tensionEngine',
    requiredReaderMethods: ZERO_DEPENDENCY_READER_METHODS.TensionReader,
    critical: true,
    description: 'Binds tension reader into battle engine.',
    rationale:
      'Bot posture and attack escalation react to tension, queue depth, and visibility state.',
    affectsSteps: ZERO_BINDER_TENSION_READER_STEPS,
    modes: ZERO_BINDER_SUPPORTED_MODES,
  }),
  Object.freeze({
    id: 'CASCADE_READER__PRESSURE_FROM_CASCADE',
    group: 'cascade-reader',
    contractName: 'CascadeReader',
    setterName: 'setCascadeReader',
    consumerEngineId: 'pressure',
    readerEngineId: 'cascade',
    consumerSlot: 'pressureEngine',
    readerSlot: 'cascadeEngine',
    requiredReaderMethods: ZERO_DEPENDENCY_READER_METHODS.CascadeReader,
    critical: true,
    description: 'Binds cascade reader into pressure engine.',
    rationale:
      'Pressure recomputation needs active chain count and severity-aware cascade visibility.',
    affectsSteps: ZERO_BINDER_CASCADE_READER_STEPS,
    modes: ZERO_BINDER_SUPPORTED_MODES,
  }),
]);

export const ZERO_BINDING_EDGES_BY_GROUP: Readonly<
  Record<DependencyBindingGroup, readonly DependencyBindingEdgeDefinition[]>
> = Object.freeze({
  'pressure-reader': Object.freeze(
    ZERO_CANONICAL_BINDING_EDGES.filter((edge) => edge.group === 'pressure-reader'),
  ),
  'shield-reader': Object.freeze(
    ZERO_CANONICAL_BINDING_EDGES.filter((edge) => edge.group === 'shield-reader'),
  ),
  'tension-reader': Object.freeze(
    ZERO_CANONICAL_BINDING_EDGES.filter((edge) => edge.group === 'tension-reader'),
  ),
  'cascade-reader': Object.freeze(
    ZERO_CANONICAL_BINDING_EDGES.filter((edge) => edge.group === 'cascade-reader'),
  ),
});

export const ZERO_BINDING_EDGES_BY_ID: Readonly<
  Record<DependencyBindingEdgeId, DependencyBindingEdgeDefinition>
> = Object.freeze(
  ZERO_CANONICAL_BINDING_EDGES.reduce<Record<DependencyBindingEdgeId, DependencyBindingEdgeDefinition>>(
    (accumulator, edge) => {
      accumulator[edge.id] = edge;
      return accumulator;
    },
    {} as Record<DependencyBindingEdgeId, DependencyBindingEdgeDefinition>,
  ),
);

export const ZERO_BINDER_DEFAULT_OPTIONS: Readonly<DependencyBinderOptions> = Object.freeze({
  validateReaderContractsBeforeBind: true,
  allowPartialReaderContracts: true,
  bindEvenIfReaderContractIsPartial: true,
  emitSuccessNotes: true,
  emitGroupSummaryNotes: true,
  emitResolvedConfigNotes: true,
  freezeReturnedState: true,
  includeAttemptMatrixInNotes: true,
  treatMissingOptionalSettersAsWarnings: true,
  treatMissingRequiredEnginesAsErrors: true,
});

// ────────────────────────────────────────────────────────────────────────────────
// foundational helpers
// ────────────────────────────────────────────────────────────────────────────────

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasFunction(value: unknown, key: string): boolean {
  return isRecord(value) && typeof value[key] === 'function';
}

function getAvailableMethodNames(value: unknown): readonly string[] {
  if (!isRecord(value)) {
    return Object.freeze([]);
  }

  return freezeArray(
    Object.keys(value)
      .filter((key) => typeof value[key] === 'function')
      .sort(),
  );
}

function getSlotValue(bundle: ZeroDependencyBundle, slot: DependencyBundleSlot): unknown {
  return bundle[slot];
}

function getEngineSlot(engineId: EngineId): DependencyBundleSlot {
  return ZERO_DEPENDENCY_ENGINE_SLOT_BY_ID[engineId];
}

function getEngineLabel(engineId: EngineId): string {
  return ZERO_DEPENDENCY_ENGINE_LABELS[engineId];
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function createFingerprint(parts: readonly string[]): string {
  const input = parts.join('|');
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `zdb-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function normalizeOptions(
  partial: Partial<DependencyBinderOptions> = {},
): Readonly<DependencyBinderOptions> {
  return Object.freeze({
    validateReaderContractsBeforeBind:
      partial.validateReaderContractsBeforeBind
      ?? ZERO_BINDER_DEFAULT_OPTIONS.validateReaderContractsBeforeBind,
    allowPartialReaderContracts:
      partial.allowPartialReaderContracts
      ?? ZERO_BINDER_DEFAULT_OPTIONS.allowPartialReaderContracts,
    bindEvenIfReaderContractIsPartial:
      partial.bindEvenIfReaderContractIsPartial
      ?? ZERO_BINDER_DEFAULT_OPTIONS.bindEvenIfReaderContractIsPartial,
    emitSuccessNotes:
      partial.emitSuccessNotes
      ?? ZERO_BINDER_DEFAULT_OPTIONS.emitSuccessNotes,
    emitGroupSummaryNotes:
      partial.emitGroupSummaryNotes
      ?? ZERO_BINDER_DEFAULT_OPTIONS.emitGroupSummaryNotes,
    emitResolvedConfigNotes:
      partial.emitResolvedConfigNotes
      ?? ZERO_BINDER_DEFAULT_OPTIONS.emitResolvedConfigNotes,
    freezeReturnedState:
      partial.freezeReturnedState
      ?? ZERO_BINDER_DEFAULT_OPTIONS.freezeReturnedState,
    includeAttemptMatrixInNotes:
      partial.includeAttemptMatrixInNotes
      ?? ZERO_BINDER_DEFAULT_OPTIONS.includeAttemptMatrixInNotes,
    treatMissingOptionalSettersAsWarnings:
      partial.treatMissingOptionalSettersAsWarnings
      ?? ZERO_BINDER_DEFAULT_OPTIONS.treatMissingOptionalSettersAsWarnings,
    treatMissingRequiredEnginesAsErrors:
      partial.treatMissingRequiredEnginesAsErrors
      ?? ZERO_BINDER_DEFAULT_OPTIONS.treatMissingRequiredEnginesAsErrors,
  });
}

function createEmptyBundle(): ZeroDependencyBundle {
  return {
    timeEngine: null,
    pressureEngine: null,
    tensionEngine: null,
    shieldEngine: null,
    battleEngine: null,
    cascadeEngine: null,
    sovereigntyEngine: null,
  };
}

function bundleWithDefaults(bundle: Partial<ZeroDependencyBundle>): ZeroDependencyBundle {
  return {
    ...createEmptyBundle(),
    ...bundle,
  };
}

function getMissingReaderMethods(
  reader: unknown,
  requiredMethods: readonly string[],
): readonly string[] {
  return freezeArray(requiredMethods.filter((methodName) => !hasFunction(reader, methodName)));
}

function describeMissingMethods(
  methods: readonly string[],
  contractName: DependencyReaderContractName,
): string {
  if (methods.length === 0) {
    return `${contractName} contract is complete.`;
  }

  return `${contractName} is missing methods: ${methods.join(', ')}.`;
}

function buildInventoryEntry(
  slot: DependencyBundleSlot,
  engineId: EngineId | 'system',
  value: unknown,
  notes: readonly string[] = [],
): DependencyBundleInventoryEntry {
  return Object.freeze({
    slot,
    engineId,
    present: value !== null && value !== undefined,
    availableMethodNames: getAvailableMethodNames(value),
    notes: freezeArray(notes),
  });
}

function isRequiredEngine(
  engineId: EngineId,
  resolved: ResolvedOrchestratorConfig,
): boolean {
  return resolved.config.requiredEngineIds.includes(engineId);
}

function getRequiredEngineIds(resolved: ResolvedOrchestratorConfig): readonly EngineId[] {
  return freezeArray([...resolved.config.requiredEngineIds]);
}

function createResolvedConfig(
  input: ResolveOrchestratorConfigInput = {},
): ResolvedOrchestratorConfig {
  return resolveOrchestratorConfig({
    config: input.config ?? createDefaultOrchestratorConfig(),
    overrides: input.overrides,
    profileId: input.profileId,
    mode: input.mode,
    lifecycleState: input.lifecycleState,
    outcome: input.outcome,
  });
}

function createAttempt(
  partial: Omit<DependencyBindingAttempt, 'missingReaderMethods'> & {
    missingReaderMethods?: readonly string[];
  },
): DependencyBindingAttempt {
  return Object.freeze({
    ...partial,
    missingReaderMethods: freezeArray([...(partial.missingReaderMethods ?? [])]),
  });
}

function createIssue(
  severity: DependencyBindingSeverity,
  code: string,
  slot: DependencyBundleSlot | 'bundle',
  message: string,
): DependencyBundleValidationIssue {
  return Object.freeze({
    severity,
    code,
    slot,
    message,
  });
}

function hasMode(edge: DependencyBindingEdgeDefinition, mode: ModeCode | null): boolean {
  if (mode === null) {
    return true;
  }

  return edge.modes.includes(mode);
}

function reportBooleanForGroup(
  attempts: readonly DependencyBindingAttempt[],
  group: DependencyBindingGroup,
): boolean {
  const groupAttempts = attempts.filter((attempt) => attempt.group === group);

  if (groupAttempts.length === 0) {
    return false;
  }

  return groupAttempts.every((attempt) => attempt.bound);
}

function noteForAttemptMatrix(attempt: DependencyBindingAttempt): string {
  const methodSuffix =
    attempt.missingReaderMethods.length > 0
      ? ` missing=[${attempt.missingReaderMethods.join(', ')}]`
      : '';

  return `[${attempt.severity}] ${attempt.id} status=${attempt.status} bound=${attempt.bound} attempted=${attempt.attempted}${methodSuffix} :: ${attempt.note}`;
}

function isStatusPartial(status: DependencyBindingStatus): boolean {
  return status === 'BOUND_WITH_PARTIAL_READER' || status === 'MISSING_READER_METHODS';
}

function createGroupSummary(
  group: DependencyBindingGroup,
  attempts: readonly DependencyBindingAttempt[],
): DependencyGroupSummary {
  const relevant = attempts.filter((attempt) => attempt.group === group);
  const boundEdges = relevant.filter((attempt) => attempt.bound).length;
  const failedEdges = relevant.filter((attempt) => !attempt.bound).length;
  const partialEdges = relevant.filter((attempt) => isStatusPartial(attempt.status)).length;

  const notes = relevant.map((attempt) => attempt.note);

  return Object.freeze({
    group,
    bound: relevant.length > 0 && relevant.every((attempt) => attempt.bound),
    totalEdges: relevant.length,
    boundEdges,
    failedEdges,
    partialEdges,
    notes: freezeArray(notes),
  });
}

function buildReportFromAttempts(
  attempts: readonly DependencyBindingAttempt[],
  notes: readonly string[],
): ZeroDependencyBindingReport {
  return Object.freeze({
    pressureReaderBound: reportBooleanForGroup(attempts, 'pressure-reader'),
    shieldReaderBound: reportBooleanForGroup(attempts, 'shield-reader'),
    tensionReaderBound: reportBooleanForGroup(attempts, 'tension-reader'),
    cascadeReaderBound: reportBooleanForGroup(attempts, 'cascade-reader'),
    notes: freezeArray(notes),
  });
}

function createInventory(
  bundle: ZeroDependencyBundle,
  resolved: ResolvedOrchestratorConfig,
): DependencyBundleInventory {
  const entries: DependencyBundleInventoryEntry[] = [
    buildInventoryEntry('timeEngine', 'time', bundle.timeEngine),
    buildInventoryEntry('pressureEngine', 'pressure', bundle.pressureEngine),
    buildInventoryEntry('tensionEngine', 'tension', bundle.tensionEngine),
    buildInventoryEntry('shieldEngine', 'shield', bundle.shieldEngine),
    buildInventoryEntry('battleEngine', 'battle', bundle.battleEngine),
    buildInventoryEntry('cascadeEngine', 'cascade', bundle.cascadeEngine),
    buildInventoryEntry('sovereigntyEngine', 'sovereignty', bundle.sovereigntyEngine),
  ];

  const missingRequiredEngines = getRequiredEngineIds(resolved).filter((engineId) => {
    const slot = getEngineSlot(engineId);
    return bundle[slot] === null || bundle[slot] === undefined;
  });

  const presentEngineCount = entries.filter((entry) => entry.present).length;
  const missingEngineCount = entries.length - presentEngineCount;

  return Object.freeze({
    entries: freezeArray(entries),
    missingRequiredEngines: freezeArray(missingRequiredEngines),
    presentEngineCount,
    missingEngineCount,
  });
}

function validateBundleInventory(
  inventory: DependencyBundleInventory,
  resolved: ResolvedOrchestratorConfig,
  options: DependencyBinderOptions,
): DependencyBundleValidationReport {
  const errors: DependencyBundleValidationIssue[] = [];
  const warnings: DependencyBundleValidationIssue[] = [];

  for (const engineId of inventory.missingRequiredEngines) {
    const slot = getEngineSlot(engineId);
    const message = `${getEngineLabel(engineId)} is missing from dependency bundle slot ${slot}.`;

    if (options.treatMissingRequiredEnginesAsErrors && isRequiredEngine(engineId, resolved)) {
      errors.push(createIssue('ERROR', 'MISSING_REQUIRED_ENGINE', slot, message));
    } else {
      warnings.push(createIssue('WARN', 'MISSING_REQUIRED_ENGINE', slot, message));
    }
  }

  for (const entry of inventory.entries) {
    if (!entry.present) {
      continue;
    }

    if (entry.availableMethodNames.length === 0) {
      warnings.push(
        createIssue(
          'WARN',
          'ENGINE_EXPOSES_NO_METHODS',
          entry.slot,
          `${entry.slot} is present but exposes no enumerable methods.`,
        ),
      );
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: freezeArray(errors),
    warnings: freezeArray(warnings),
    inventory,
  });
}

function summarizeBundle(
  bundle: ZeroDependencyBundle,
  resolved: ResolvedOrchestratorConfig,
): DependencyBundleSummary {
  const inventory = createInventory(bundle, resolved);
  const presentSlots = inventory.entries.filter((entry) => entry.present).map((entry) => entry.slot);
  const missingSlots = inventory.entries.filter((entry) => !entry.present).map((entry) => entry.slot);
  const enginesPresent = inventory.entries
    .filter((entry) => entry.present && entry.engineId !== 'system')
    .map((entry) => entry.engineId as EngineId);

  const totalMethodsExposed = inventory.entries.reduce(
    (accumulator, entry) => accumulator + entry.availableMethodNames.length,
    0,
  );

  return Object.freeze({
    fingerprint: createFingerprint([
      ...presentSlots,
      ...missingSlots.map((slot) => `missing:${slot}`),
      ...enginesPresent.map((engineId) => `engine:${engineId}`),
      `methods:${String(totalMethodsExposed)}`,
    ]),
    presentSlots: freezeArray(presentSlots),
    missingSlots: freezeArray(missingSlots),
    enginesPresent: freezeArray(enginesPresent),
    missingRequiredEngines: inventory.missingRequiredEngines,
    totalMethodsExposed,
  });
}

function getEdgesForMode(mode: ModeCode | null): readonly DependencyBindingEdgeDefinition[] {
  if (mode === null) {
    return ZERO_CANONICAL_BINDING_EDGES;
  }

  return freezeArray(ZERO_CANONICAL_BINDING_EDGES.filter((edge) => hasMode(edge, mode)));
}

function bindingFingerprint(
  resolved: ResolvedOrchestratorConfig,
  attempts: readonly DependencyBindingAttempt[],
  validation: DependencyBundleValidationReport,
): string {
  return createFingerprint([
    `profile:${resolved.resolvedProfileId}`,
    `mode:${resolved.resolvedMode ?? 'all'}`,
    ...attempts.map((attempt) => `${attempt.id}:${attempt.status}:${String(attempt.bound)}`),
    ...validation.errors.map((issue) => `E:${issue.code}:${issue.slot}`),
    ...validation.warnings.map((issue) => `W:${issue.code}:${issue.slot}`),
  ]);
}

// ────────────────────────────────────────────────────────────────────────────────
// exported query helpers
// ────────────────────────────────────────────────────────────────────────────────

export function getCanonicalBindingEdges(): readonly DependencyBindingEdgeDefinition[] {
  return ZERO_CANONICAL_BINDING_EDGES;
}

export function getBindingEdge(id: DependencyBindingEdgeId): DependencyBindingEdgeDefinition {
  return ZERO_BINDING_EDGES_BY_ID[id];
}

export function getBindingEdgesForGroup(
  group: DependencyBindingGroup,
): readonly DependencyBindingEdgeDefinition[] {
  return ZERO_BINDING_EDGES_BY_GROUP[group];
}

export function getBindingEdgesForConsumer(
  engineId: EngineId,
): readonly DependencyBindingEdgeDefinition[] {
  return freezeArray(
    ZERO_CANONICAL_BINDING_EDGES.filter((edge) => edge.consumerEngineId === engineId),
  );
}

export function getBindingEdgesForReader(
  engineId: EngineId,
): readonly DependencyBindingEdgeDefinition[] {
  return freezeArray(
    ZERO_CANONICAL_BINDING_EDGES.filter((edge) => edge.readerEngineId === engineId),
  );
}

export function getReaderMethodsForContract(
  contractName: DependencyReaderContractName,
): readonly string[] {
  return ZERO_DEPENDENCY_READER_METHODS[contractName];
}

export function createDefaultDependencyBinderOptions(): Readonly<DependencyBinderOptions> {
  return ZERO_BINDER_DEFAULT_OPTIONS;
}

export function createDefaultDependencyBundle(): ZeroDependencyBundle {
  return createEmptyBundle();
}

export function summarizeDependencyBundle(
  bundle: Partial<ZeroDependencyBundle>,
  configInput: ResolveOrchestratorConfigInput = {},
): DependencyBundleSummary {
  const normalizedBundle = bundleWithDefaults(bundle);
  const resolved = createResolvedConfig(configInput);
  return summarizeBundle(normalizedBundle, resolved);
}

// ────────────────────────────────────────────────────────────────────────────────
// binder implementation
// ────────────────────────────────────────────────────────────────────────────────

export class DependencyBinder {
  private readonly options: Readonly<DependencyBinderOptions>;
  private lastSession: DependencyBindingSession | null = null;

  public constructor(options: Partial<DependencyBinderOptions> = {}) {
    this.options = normalizeOptions(options);
  }

  public bind(
    bundle: ZeroDependencyBundle,
    configInput: ResolveOrchestratorConfigInput = {},
  ): ZeroDependencyBindingReport {
    const session = this.execute(bundle, configInput, false);
    this.lastSession = session;
    return session.report;
  }

  public dryRun(
    bundle: ZeroDependencyBundle,
    configInput: ResolveOrchestratorConfigInput = {},
  ): DependencyBindingSession {
    const session = this.execute(bundle, configInput, true);
    this.lastSession = session;
    return session;
  }

  public validateBundle(
    bundle: ZeroDependencyBundle,
    configInput: ResolveOrchestratorConfigInput = {},
  ): DependencyBundleValidationReport {
    const normalizedBundle = bundleWithDefaults(bundle);
    const resolved = createResolvedConfig(configInput);
    const inventory = createInventory(normalizedBundle, resolved);
    return validateBundleInventory(inventory, resolved, this.options);
  }

  public summarizeBundle(
    bundle: ZeroDependencyBundle,
    configInput: ResolveOrchestratorConfigInput = {},
  ): DependencyBundleSummary {
    const normalizedBundle = bundleWithDefaults(bundle);
    const resolved = createResolvedConfig(configInput);
    return summarizeBundle(normalizedBundle, resolved);
  }

  public getCanonicalEdges(): readonly DependencyBindingEdgeDefinition[] {
    return ZERO_CANONICAL_BINDING_EDGES;
  }

  public getLastSession(): DependencyBindingSession | null {
    return this.lastSession;
  }

  public getLastReport(): ZeroDependencyBindingReport | null {
    return this.lastSession?.report ?? null;
  }

  public getLastNotes(): readonly string[] {
    return this.lastSession?.notes ?? Object.freeze([]);
  }

  public hasSuccessfulLastBind(): boolean {
    if (this.lastSession === null) {
      return false;
    }

    return (
      this.lastSession.report.pressureReaderBound &&
      this.lastSession.report.shieldReaderBound &&
      this.lastSession.report.tensionReaderBound &&
      this.lastSession.report.cascadeReaderBound
    );
  }

  public reset(): void {
    this.lastSession = null;
  }

  private execute(
    bundle: ZeroDependencyBundle,
    configInput: ResolveOrchestratorConfigInput,
    dryRun: boolean,
  ): DependencyBindingSession {
    const normalizedBundle = bundleWithDefaults(bundle);
    const resolved = createResolvedConfig(configInput);
    const inventory = createInventory(normalizedBundle, resolved);
    const validation = validateBundleInventory(inventory, resolved, this.options);
    const edges = getEdgesForMode(resolved.resolvedMode);

    const notes: string[] = [];
    const attempts: DependencyBindingAttempt[] = [];

    if (this.options.emitResolvedConfigNotes) {
      notes.push(
        `Resolved orchestrator profile=${resolved.resolvedProfileId} mode=${resolved.resolvedMode ?? 'all'} lifecycle=${resolved.resolvedLifecycleState ?? 'n/a'}.`,
      );
      notes.push(
        `Required engines: ${resolved.config.requiredEngineIds.join(', ')}.`,
      );
    }

    if (validation.errors.length > 0) {
      for (const issue of validation.errors) {
        notes.push(`[ERROR] ${issue.message}`);
      }
    }

    if (validation.warnings.length > 0) {
      for (const issue of validation.warnings) {
        notes.push(`[WARN] ${issue.message}`);
      }
    }

    for (const edge of edges) {
      const attempt = this.executeEdge(normalizedBundle, resolved, edge, dryRun);
      attempts.push(attempt);

      if (
        (attempt.severity !== 'INFO' || this.options.emitSuccessNotes)
        && attempt.note.length > 0
      ) {
        notes.push(`[${attempt.severity}] ${attempt.note}`);
      }
    }

    const groups = ZERO_DEPENDENCY_BINDING_GROUPS.map((group) =>
      createGroupSummary(group, attempts),
    );

    if (this.options.emitGroupSummaryNotes) {
      for (const group of groups) {
        notes.push(
          `Group ${group.group}: bound=${String(group.bound)} total=${String(group.totalEdges)} boundEdges=${String(group.boundEdges)} failedEdges=${String(group.failedEdges)} partialEdges=${String(group.partialEdges)}.`,
        );
      }
    }

    if (this.options.includeAttemptMatrixInNotes) {
      for (const attempt of attempts) {
        notes.push(noteForAttemptMatrix(attempt));
      }
    }

    const report = buildReportFromAttempts(attempts, notes);
    const fingerprint = bindingFingerprint(resolved, attempts, validation);

    const session: DependencyBindingSession = Object.freeze({
      fingerprint,
      resolvedProfileId: resolved.resolvedProfileId,
      resolvedMode: resolved.resolvedMode,
      attempts: freezeArray(attempts),
      groups: freezeArray(groups),
      report,
      validation,
      notes: freezeArray(notes),
    });

    return this.options.freezeReturnedState ? session : {
      ...session,
      attempts: [...session.attempts],
      groups: [...session.groups],
      notes: [...session.notes],
    };
  }

  private executeEdge(
    bundle: ZeroDependencyBundle,
    resolved: ResolvedOrchestratorConfig,
    edge: DependencyBindingEdgeDefinition,
    dryRun: boolean,
  ): DependencyBindingAttempt {
    const consumerValue = getSlotValue(bundle, edge.consumerSlot);
    const readerValue = getSlotValue(bundle, edge.readerSlot);

    const consumerPresent = consumerValue !== null && consumerValue !== undefined;
    const readerPresent = readerValue !== null && readerValue !== undefined;
    const setterPresent = hasFunction(consumerValue, edge.setterName);
    const missingReaderMethods = getMissingReaderMethods(
      readerValue,
      edge.requiredReaderMethods,
    );

    const requiredConsumer = isRequiredEngine(edge.consumerEngineId, resolved);
    const requiredReader = isRequiredEngine(edge.readerEngineId, resolved);

    if (!consumerPresent) {
      return createAttempt({
        id: edge.id,
        group: edge.group,
        contractName: edge.contractName,
        setterName: edge.setterName,
        consumerEngineId: edge.consumerEngineId,
        readerEngineId: edge.readerEngineId,
        status: 'MISSING_CONSUMER',
        severity:
          requiredConsumer && this.options.treatMissingRequiredEnginesAsErrors
            ? 'ERROR'
            : 'WARN',
        attempted: false,
        bound: false,
        consumerPresent,
        readerPresent,
        setterPresent: false,
        note: `${getEngineLabel(edge.consumerEngineId)} is missing; cannot wire ${edge.contractName} from ${getEngineLabel(edge.readerEngineId)}.`,
        errorMessage: null,
      });
    }

    if (!readerPresent) {
      return createAttempt({
        id: edge.id,
        group: edge.group,
        contractName: edge.contractName,
        setterName: edge.setterName,
        consumerEngineId: edge.consumerEngineId,
        readerEngineId: edge.readerEngineId,
        status: 'MISSING_READER',
        severity:
          requiredReader && this.options.treatMissingRequiredEnginesAsErrors
            ? 'ERROR'
            : 'WARN',
        attempted: false,
        bound: false,
        consumerPresent,
        readerPresent,
        setterPresent,
        missingReaderMethods,
        note: `${getEngineLabel(edge.readerEngineId)} is missing; cannot supply ${edge.contractName} to ${getEngineLabel(edge.consumerEngineId)}.`,
        errorMessage: null,
      });
    }

    if (!setterPresent) {
      return createAttempt({
        id: edge.id,
        group: edge.group,
        contractName: edge.contractName,
        setterName: edge.setterName,
        consumerEngineId: edge.consumerEngineId,
        readerEngineId: edge.readerEngineId,
        status: 'MISSING_SETTER',
        severity: this.options.treatMissingOptionalSettersAsWarnings ? 'WARN' : 'ERROR',
        attempted: false,
        bound: false,
        consumerPresent,
        readerPresent,
        setterPresent,
        missingReaderMethods,
        note: `${getEngineLabel(edge.consumerEngineId)} does not expose ${edge.setterName}().`,
        errorMessage: null,
      });
    }

    if (
      this.options.validateReaderContractsBeforeBind &&
      missingReaderMethods.length > 0 &&
      !this.options.allowPartialReaderContracts
    ) {
      return createAttempt({
        id: edge.id,
        group: edge.group,
        contractName: edge.contractName,
        setterName: edge.setterName,
        consumerEngineId: edge.consumerEngineId,
        readerEngineId: edge.readerEngineId,
        status: 'MISSING_READER_METHODS',
        severity: 'WARN',
        attempted: false,
        bound: false,
        consumerPresent,
        readerPresent,
        setterPresent,
        missingReaderMethods,
        note:
          `${getEngineLabel(edge.readerEngineId)} cannot satisfy ${edge.contractName}; `
          + describeMissingMethods(missingReaderMethods, edge.contractName),
        errorMessage: null,
      });
    }

    if (
      this.options.validateReaderContractsBeforeBind &&
      missingReaderMethods.length > 0 &&
      !this.options.bindEvenIfReaderContractIsPartial
    ) {
      return createAttempt({
        id: edge.id,
        group: edge.group,
        contractName: edge.contractName,
        setterName: edge.setterName,
        consumerEngineId: edge.consumerEngineId,
        readerEngineId: edge.readerEngineId,
        status: 'BIND_SKIPPED',
        severity: 'WARN',
        attempted: false,
        bound: false,
        consumerPresent,
        readerPresent,
        setterPresent,
        missingReaderMethods,
        note:
          `Skipped ${edge.id}; partial ${edge.contractName} was detected and policy disallows binding partial readers.`,
        errorMessage: null,
      });
    }

    if (dryRun) {
      return createAttempt({
        id: edge.id,
        group: edge.group,
        contractName: edge.contractName,
        setterName: edge.setterName,
        consumerEngineId: edge.consumerEngineId,
        readerEngineId: edge.readerEngineId,
        status:
          missingReaderMethods.length > 0 ? 'BOUND_WITH_PARTIAL_READER' : 'BOUND',
        severity: missingReaderMethods.length > 0 ? 'WARN' : 'INFO',
        attempted: true,
        bound: true,
        consumerPresent,
        readerPresent,
        setterPresent,
        missingReaderMethods,
        note:
          missingReaderMethods.length > 0
            ? `Dry-run would bind partial ${edge.contractName} from ${getEngineLabel(edge.readerEngineId)} into ${getEngineLabel(edge.consumerEngineId)}.`
            : `Dry-run would bind ${edge.contractName} from ${getEngineLabel(edge.readerEngineId)} into ${getEngineLabel(edge.consumerEngineId)}.`,
        errorMessage: null,
      });
    }

    try {
      (consumerValue as Record<string, (reader: unknown) => void>)[edge.setterName](readerValue);

      return createAttempt({
        id: edge.id,
        group: edge.group,
        contractName: edge.contractName,
        setterName: edge.setterName,
        consumerEngineId: edge.consumerEngineId,
        readerEngineId: edge.readerEngineId,
        status:
          missingReaderMethods.length > 0 ? 'BOUND_WITH_PARTIAL_READER' : 'BOUND',
        severity: missingReaderMethods.length > 0 ? 'WARN' : 'INFO',
        attempted: true,
        bound: true,
        consumerPresent,
        readerPresent,
        setterPresent,
        missingReaderMethods,
        note:
          missingReaderMethods.length > 0
            ? `Bound partial ${edge.contractName} from ${getEngineLabel(edge.readerEngineId)} into ${getEngineLabel(edge.consumerEngineId)}. ${describeMissingMethods(missingReaderMethods, edge.contractName)}`
            : `Bound ${edge.contractName} from ${getEngineLabel(edge.readerEngineId)} into ${getEngineLabel(edge.consumerEngineId)}.`,
        errorMessage: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return createAttempt({
        id: edge.id,
        group: edge.group,
        contractName: edge.contractName,
        setterName: edge.setterName,
        consumerEngineId: edge.consumerEngineId,
        readerEngineId: edge.readerEngineId,
        status: 'BIND_FAILED',
        severity: 'ERROR',
        attempted: true,
        bound: false,
        consumerPresent,
        readerPresent,
        setterPresent,
        missingReaderMethods,
        note:
          `Binding ${edge.contractName} from ${getEngineLabel(edge.readerEngineId)} into ${getEngineLabel(edge.consumerEngineId)} failed.`,
        errorMessage: message,
      });
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// stateless convenience functions
// ────────────────────────────────────────────────────────────────────────────────

export function bindZeroDependencies(
  bundle: ZeroDependencyBundle,
  configInput: ResolveOrchestratorConfigInput = {},
  options: Partial<DependencyBinderOptions> = {},
): ZeroDependencyBindingReport {
  return new DependencyBinder(options).bind(bundle, configInput);
}

export function dryRunZeroDependencies(
  bundle: ZeroDependencyBundle,
  configInput: ResolveOrchestratorConfigInput = {},
  options: Partial<DependencyBinderOptions> = {},
): DependencyBindingSession {
  return new DependencyBinder(options).dryRun(bundle, configInput);
}

export function validateZeroDependencyBundle(
  bundle: ZeroDependencyBundle,
  configInput: ResolveOrchestratorConfigInput = {},
  options: Partial<DependencyBinderOptions> = {},
): DependencyBundleValidationReport {
  return new DependencyBinder(options).validateBundle(bundle, configInput);
}

export function createDependencyBinder(
  options: Partial<DependencyBinderOptions> = {},
): DependencyBinder {
  return new DependencyBinder(options);
}

// ────────────────────────────────────────────────────────────────────────────────
// deep query / analysis helpers
// ────────────────────────────────────────────────────────────────────────────────

export function getDependencyBindingCoverage(
  report: ZeroDependencyBindingReport,
): Readonly<Record<DependencyBindingGroup, boolean>> {
  return Object.freeze({
    'pressure-reader': report.pressureReaderBound,
    'shield-reader': report.shieldReaderBound,
    'tension-reader': report.tensionReaderBound,
    'cascade-reader': report.cascadeReaderBound,
  });
}

export function isDependencyBindingComplete(report: ZeroDependencyBindingReport): boolean {
  return (
    report.pressureReaderBound &&
    report.shieldReaderBound &&
    report.tensionReaderBound &&
    report.cascadeReaderBound
  );
}

export function getDependencyGroupBoolean(
  report: ZeroDependencyBindingReport,
  group: DependencyBindingGroup,
): boolean {
  switch (group) {
    case 'pressure-reader':
      return report.pressureReaderBound;
    case 'shield-reader':
      return report.shieldReaderBound;
    case 'tension-reader':
      return report.tensionReaderBound;
    case 'cascade-reader':
      return report.cascadeReaderBound;
    default:
      return false;
  }
}

export function createDependencyBindingReportNotes(
  report: ZeroDependencyBindingReport,
): readonly string[] {
  const coverage = getDependencyBindingCoverage(report);
  return freezeArray([
    `pressure-reader=${String(coverage['pressure-reader'])}`,
    `shield-reader=${String(coverage['shield-reader'])}`,
    `tension-reader=${String(coverage['tension-reader'])}`,
    `cascade-reader=${String(coverage['cascade-reader'])}`,
    ...report.notes,
  ]);
}

export function compareDependencyReports(
  left: ZeroDependencyBindingReport,
  right: ZeroDependencyBindingReport,
): Readonly<{
  identical: boolean;
  booleansEqual: boolean;
  notesEqual: boolean;
  changedGroups: readonly DependencyBindingGroup[];
}> {
  const changedGroups = ZERO_DEPENDENCY_BINDING_GROUPS.filter(
    (group) => getDependencyGroupBoolean(left, group) !== getDependencyGroupBoolean(right, group),
  );

  const booleansEqual = changedGroups.length === 0;
  const notesEqual = stableStringify(left.notes) === stableStringify(right.notes);

  return Object.freeze({
    identical: booleansEqual && notesEqual,
    booleansEqual,
    notesEqual,
    changedGroups: freezeArray(changedGroups),
  });
}

export function fingerprintDependencyReport(
  report: ZeroDependencyBindingReport,
): string {
  return createFingerprint([
    `pressure:${String(report.pressureReaderBound)}`,
    `shield:${String(report.shieldReaderBound)}`,
    `tension:${String(report.tensionReaderBound)}`,
    `cascade:${String(report.cascadeReaderBound)}`,
    ...report.notes,
  ]);
}

export function filterBindingAttemptsBySeverity(
  session: DependencyBindingSession,
  severity: DependencyBindingSeverity,
): readonly DependencyBindingAttempt[] {
  return freezeArray(session.attempts.filter((attempt) => attempt.severity === severity));
}

export function filterBindingAttemptsByGroup(
  session: DependencyBindingSession,
  group: DependencyBindingGroup,
): readonly DependencyBindingAttempt[] {
  return freezeArray(session.attempts.filter((attempt) => attempt.group === group));
}

export function getBoundBindingAttempts(
  session: DependencyBindingSession,
): readonly DependencyBindingAttempt[] {
  return freezeArray(session.attempts.filter((attempt) => attempt.bound));
}

export function getFailedBindingAttempts(
  session: DependencyBindingSession,
): readonly DependencyBindingAttempt[] {
  return freezeArray(session.attempts.filter((attempt) => !attempt.bound));
}

export function getPartialBindingAttempts(
  session: DependencyBindingSession,
): readonly DependencyBindingAttempt[] {
  return freezeArray(
    session.attempts.filter((attempt) => isStatusPartial(attempt.status)),
  );
}

export function getSessionSummary(
  session: DependencyBindingSession,
): Readonly<{
  fingerprint: string;
  profileId: string;
  mode: ModeCode | null;
  totalAttempts: number;
  boundAttempts: number;
  failedAttempts: number;
  partialAttempts: number;
  validBundle: boolean;
  bindingComplete: boolean;
}> {
  const boundAttempts = getBoundBindingAttempts(session).length;
  const failedAttempts = getFailedBindingAttempts(session).length;
  const partialAttempts = getPartialBindingAttempts(session).length;

  return Object.freeze({
    fingerprint: session.fingerprint,
    profileId: session.resolvedProfileId,
    mode: session.resolvedMode,
    totalAttempts: session.attempts.length,
    boundAttempts,
    failedAttempts,
    partialAttempts,
    validBundle: session.validation.valid,
    bindingComplete: isDependencyBindingComplete(session.report),
  });
}

export function createHumanReadableBindingNarrative(
  session: DependencyBindingSession,
): string {
  const summary = getSessionSummary(session);
  const lines: string[] = [
    `Dependency binding fingerprint ${summary.fingerprint}.`,
    `Profile=${summary.profileId} mode=${summary.mode ?? 'all'}.`,
    `Attempts=${String(summary.totalAttempts)} bound=${String(summary.boundAttempts)} failed=${String(summary.failedAttempts)} partial=${String(summary.partialAttempts)}.`,
    `Bundle valid=${String(summary.validBundle)} bindingComplete=${String(summary.bindingComplete)}.`,
  ];

  for (const group of session.groups) {
    lines.push(
      `Group ${group.group}: bound=${String(group.bound)} boundEdges=${String(group.boundEdges)}/${String(group.totalEdges)}.`,
    );
  }

  return lines.join(' ');
}

// ────────────────────────────────────────────────────────────────────────────────
// immutable defaults
// ────────────────────────────────────────────────────────────────────────────────

export const ZERO_EMPTY_DEPENDENCY_BUNDLE: Readonly<ZeroDependencyBundle> = Object.freeze(
  createEmptyBundle(),
);

export const ZERO_EMPTY_DEPENDENCY_BINDER_OPTIONS: Readonly<DependencyBinderOptions> =
  ZERO_BINDER_DEFAULT_OPTIONS;

export const ZERO_EMPTY_DEPENDENCY_BUNDLE_SUMMARY: Readonly<DependencyBundleSummary> =
  Object.freeze({
    fingerprint: createFingerprint(['empty-bundle']),
    presentSlots: Object.freeze([]),
    missingSlots: freezeArray(ZERO_DEPENDENCY_BUNDLE_SLOTS),
    enginesPresent: Object.freeze([]),
    missingRequiredEngines: freezeArray(ZERO_REQUIRED_ENGINE_IDS),
    totalMethodsExposed: 0,
  });

export const ZERO_EMPTY_DEPENDENCY_VALIDATION_REPORT: Readonly<DependencyBundleValidationReport> =
  Object.freeze({
    valid: false,
    errors: Object.freeze([
      createIssue('ERROR', 'EMPTY_BUNDLE', 'bundle', 'Dependency bundle is empty.'),
    ]),
    warnings: Object.freeze([]),
    inventory: Object.freeze({
      entries: Object.freeze([]),
      missingRequiredEngines: freezeArray(ZERO_REQUIRED_ENGINE_IDS),
      presentEngineCount: 0,
      missingEngineCount: ZERO_DEPENDENCY_BUNDLE_SLOTS.length,
    }),
  });

// ────────────────────────────────────────────────────────────────────────────────
// self-test style assertions for downstream harnesses
// ────────────────────────────────────────────────────────────────────────────────

export function assertBindingEdgeExists(id: DependencyBindingEdgeId): DependencyBindingEdgeDefinition {
  const edge = ZERO_BINDING_EDGES_BY_ID[id];

  if (edge === undefined) {
    throw new Error(`[DependencyBinder] Missing canonical binding edge ${id}.`);
  }

  return edge;
}

export function assertBindingGroupCovered(group: DependencyBindingGroup): void {
  const edges = ZERO_BINDING_EDGES_BY_GROUP[group];

  if (edges.length === 0) {
    throw new Error(`[DependencyBinder] No canonical edges exist for group ${group}.`);
  }
}

export function assertDependencyBundleHasSlot(
  bundle: ZeroDependencyBundle,
  slot: DependencyBundleSlot,
): void {
  if (bundle[slot] === null || bundle[slot] === undefined) {
    throw new Error(`[DependencyBinder] Bundle slot ${slot} is empty.`);
  }
}

export function assertReaderContractMethodsDeclared(
  contractName: DependencyReaderContractName,
): void {
  const methods = ZERO_DEPENDENCY_READER_METHODS[contractName];

  if (methods.length === 0) {
    throw new Error(
      `[DependencyBinder] Contract ${contractName} has no declared reader methods.`,
    );
  }
}

export function assertCanonicalBindingGraph(): void {
  for (const edgeId of ZERO_DEPENDENCY_BINDING_EDGE_IDS) {
    const edge = ZERO_BINDING_EDGES_BY_ID[edgeId];

    if (edge === undefined) {
      throw new Error(`[DependencyBinder] Canonical graph is missing edge ${edgeId}.`);
    }

    if (!ZERO_DEPENDENCY_BINDING_GROUPS.includes(edge.group)) {
      throw new Error(
        `[DependencyBinder] Edge ${edge.id} references unknown group ${edge.group}.`,
      );
    }

    if (!ZERO_READER_CONTRACT_NAMES.includes(edge.contractName)) {
      throw new Error(
        `[DependencyBinder] Edge ${edge.id} references unknown contract ${edge.contractName}.`,
      );
    }

    if (!ZERO_READER_SETTER_NAMES.includes(edge.setterName)) {
      throw new Error(
        `[DependencyBinder] Edge ${edge.id} references unknown setter ${edge.setterName}.`,
      );
    }

    if (edge.requiredReaderMethods.length === 0) {
      throw new Error(
        `[DependencyBinder] Edge ${edge.id} must declare required reader methods.`,
      );
    }
  }
}

assertCanonicalBindingGraph();
