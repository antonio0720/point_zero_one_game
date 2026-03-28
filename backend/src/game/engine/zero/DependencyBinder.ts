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

// ────────────────────────────────────────────────────────────────────────────────
// ML feature vector extraction
//
// 32-dimensional float vector derived from a DependencyBindingSession.
// Designed for downstream anomaly detection, binding quality scoring, and
// health-signal injection into the ZeroEngine ML/DL pipeline.
//
// All features are normalized to [0, 1].
// Binary features map false→0.0, true→1.0.
// Count features are divided by a declared maximum and clamped.
// ────────────────────────────────────────────────────────────────────────────────

export const ZERO_BINDER_ML_FEATURE_COUNT = 32 as const;

export const ZERO_BINDER_ML_FEATURE_LABELS: readonly string[] = Object.freeze([
  'pressure_reader_bound',              // 0  — binary
  'shield_reader_bound',                // 1  — binary
  'tension_reader_bound',               // 2  — binary
  'cascade_reader_bound',               // 3  — binary
  'binding_complete',                   // 4  — binary: all four groups bound
  'total_attempts_norm',                // 5  — normalized 0–1 by max edge count (6)
  'bound_attempts_norm',                // 6  — normalized 0–1
  'failed_attempts_norm',               // 7  — normalized 0–1
  'partial_attempts_norm',              // 8  — normalized 0–1
  'bundle_valid',                       // 9  — binary: no validation errors
  'present_engine_count_norm',          // 10 — normalized 0–1 by slot count (7)
  'missing_engine_count_norm',          // 11 — normalized 0–1 by slot count (7)
  'total_methods_exposed_log',          // 12 — log10(methods+1)/3.0 clamped 0–1
  'validation_error_count_norm',        // 13 — normalized 0–1 by max (10)
  'validation_warning_count_norm',      // 14 — normalized 0–1 by max (10)
  'pressure_edge_bound',                // 15 — binary (edge PRESSURE_READER__TIME_FROM_PRESSURE)
  'shield_edge_pressure_bound',         // 16 — binary (edge SHIELD_READER__PRESSURE_FROM_SHIELD)
  'shield_edge_battle_bound',           // 17 — binary (edge SHIELD_READER__BATTLE_FROM_SHIELD)
  'tension_edge_shield_bound',          // 18 — binary (edge TENSION_READER__SHIELD_FROM_TENSION)
  'tension_edge_battle_bound',          // 19 — binary (edge TENSION_READER__BATTLE_FROM_TENSION)
  'cascade_edge_pressure_bound',        // 20 — binary (edge CASCADE_READER__PRESSURE_FROM_CASCADE)
  'critical_edges_bound_frac',          // 21 — fraction of critical edges that are bound
  'has_bind_failed',                    // 22 — binary: any attempt has status BIND_FAILED
  'has_missing_setter',                 // 23 — binary: any attempt has status MISSING_SETTER
  'has_missing_consumer',               // 24 — binary: any attempt has status MISSING_CONSUMER
  'has_missing_reader',                 // 25 — binary: any attempt has status MISSING_READER
  'missing_reader_methods_total_norm',  // 26 — total missing methods across all attempts, normalized by 20
  'is_dry_run',                         // 27 — binary: 1 if telemetry was extracted from a dry-run session
  'profile_is_default',                 // 28 — binary: resolvedProfileId === 'default'
  'mode_is_defined',                    // 29 — binary: resolvedMode !== null
  'notes_count_norm',                   // 30 — session notes count normalized by 100
  'fingerprint_hash_norm',              // 31 — fingerprint hex part parsed and normalized 0–1
]);

export interface DependencyBindingMLVector {
  /** 32 normalized float features, one per label in ZERO_BINDER_ML_FEATURE_LABELS. */
  readonly features: readonly number[];
  /** Canonical feature labels aligned to features[]. */
  readonly featureLabels: readonly string[];
  /** Fingerprint of the session this vector was extracted from. */
  readonly sessionFingerprint: string;
  /** ISO-8601 timestamp when extraction occurred. */
  readonly extractedAt: string;
  /** Convenience flag: all four reader groups were bound. */
  readonly bindingComplete: boolean;
  /** Total number of binding attempts in the session. */
  readonly totalEdges: number;
  /** Number of attempts that resulted in a bound state. */
  readonly boundEdges: number;
}

// ── private ML helpers ────────────────────────────────────────────────────────

function clampNorm(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

function boolToFloat(value: boolean): number {
  return value ? 1.0 : 0.0;
}

function severityScore(severity: DependencyBindingSeverity): number {
  if (severity === 'ERROR') return 1.0;
  if (severity === 'WARN') return 0.5;
  return 0.0;
}

function parseHexFingerprint(fingerprint: string): number {
  const hexPart = fingerprint.replace(/^zdb-/, '');
  const parsed = parseInt(hexPart, 16);
  if (isNaN(parsed)) return 0;
  return parsed / 0xFFFFFFFF;
}

function getAttemptForEdge(
  attempts: readonly DependencyBindingAttempt[],
  edgeId: DependencyBindingEdgeId,
): DependencyBindingAttempt | undefined {
  return attempts.find((attempt) => attempt.id === edgeId);
}

// ── public ML extraction ──────────────────────────────────────────────────────

/**
 * Extracts a 32-dimensional ML feature vector from a DependencyBindingSession.
 *
 * All features are normalized to [0, 1]. The feature vector is deterministic:
 * the same session always produces the same vector. It is safe to call multiple
 * times per session.
 *
 * @param session - The binding session to extract from.
 * @param isDryRun - Set to true when the session came from DependencyBinder.dryRun().
 *                   This sets feature[27] (is_dry_run) to 1.0.
 */
export function extractDependencyBindingMLVector(
  session: DependencyBindingSession,
  isDryRun = false,
): DependencyBindingMLVector {
  const { report, attempts, validation, notes } = session;
  const summary = getSessionSummary(session);

  const totalAttempts = attempts.length;
  const boundCount = attempts.filter((a) => a.bound).length;
  const failedCount = attempts.filter((a) => !a.bound).length;
  const partialCount = attempts.filter((a) => isStatusPartial(a.status)).length;

  const inventory = validation.inventory;
  const presentCount = inventory.presentEngineCount;
  const missingCount = inventory.missingEngineCount;

  const totalMethodsExposed = inventory.entries.reduce(
    (acc, e) => acc + e.availableMethodNames.length,
    0,
  );

  const criticalEdges = ZERO_CANONICAL_BINDING_EDGES.filter((e) => e.critical);
  const criticalBound = criticalEdges.filter((e) => {
    const attempt = getAttemptForEdge(attempts, e.id);
    return attempt !== undefined && attempt.bound;
  }).length;
  const criticalEdgeBoundFrac =
    criticalEdges.length > 0 ? criticalBound / criticalEdges.length : 0;

  const missingReaderMethodsTotal = attempts.reduce(
    (acc, a) => acc + a.missingReaderMethods.length,
    0,
  );

  const hasBindFailed = attempts.some((a) => a.status === 'BIND_FAILED');
  const hasMissingSetter = attempts.some((a) => a.status === 'MISSING_SETTER');
  const hasMissingConsumer = attempts.some((a) => a.status === 'MISSING_CONSUMER');
  const hasMissingReader = attempts.some((a) => a.status === 'MISSING_READER');

  const edgeIds = ZERO_DEPENDENCY_BINDING_EDGE_IDS;
  const edgeBound = edgeIds.map((id) => {
    const attempt = getAttemptForEdge(attempts, id);
    return attempt ? boolToFloat(attempt.bound) : 0;
  });

  const features: number[] = [
    boolToFloat(report.pressureReaderBound),                              // 0
    boolToFloat(report.shieldReaderBound),                                // 1
    boolToFloat(report.tensionReaderBound),                               // 2
    boolToFloat(report.cascadeReaderBound),                               // 3
    boolToFloat(summary.bindingComplete),                                 // 4
    clampNorm(totalAttempts, 6),                                          // 5
    clampNorm(boundCount, 6),                                             // 6
    clampNorm(failedCount, 6),                                            // 7
    clampNorm(partialCount, 6),                                           // 8
    boolToFloat(summary.validBundle),                                     // 9
    clampNorm(presentCount, 7),                                           // 10
    clampNorm(missingCount, 7),                                           // 11
    Math.min(1, Math.log10(totalMethodsExposed + 1) / 3.0),              // 12
    clampNorm(validation.errors.length, 10),                              // 13
    clampNorm(validation.warnings.length, 10),                            // 14
    edgeBound[0] ?? 0,                                                    // 15 PRESSURE_READER__TIME_FROM_PRESSURE
    edgeBound[1] ?? 0,                                                    // 16 SHIELD_READER__PRESSURE_FROM_SHIELD
    edgeBound[2] ?? 0,                                                    // 17 SHIELD_READER__BATTLE_FROM_SHIELD
    edgeBound[3] ?? 0,                                                    // 18 TENSION_READER__SHIELD_FROM_TENSION
    edgeBound[4] ?? 0,                                                    // 19 TENSION_READER__BATTLE_FROM_TENSION
    edgeBound[5] ?? 0,                                                    // 20 CASCADE_READER__PRESSURE_FROM_CASCADE
    criticalEdgeBoundFrac,                                                // 21
    boolToFloat(hasBindFailed),                                           // 22
    boolToFloat(hasMissingSetter),                                        // 23
    boolToFloat(hasMissingConsumer),                                      // 24
    boolToFloat(hasMissingReader),                                        // 25
    clampNorm(missingReaderMethodsTotal, 20),                             // 26
    boolToFloat(isDryRun),                                                // 27
    boolToFloat(session.resolvedProfileId === 'default'),                 // 28
    boolToFloat(session.resolvedMode !== null),                           // 29
    clampNorm(notes.length, 100),                                         // 30
    parseHexFingerprint(session.fingerprint),                             // 31
  ];

  return Object.freeze({
    features: Object.freeze(features),
    featureLabels: ZERO_BINDER_ML_FEATURE_LABELS,
    sessionFingerprint: session.fingerprint,
    extractedAt: new Date().toISOString(),
    bindingComplete: summary.bindingComplete,
    totalEdges: totalAttempts,
    boundEdges: boundCount,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// DL tensor extraction
//
// 6×8 float tensor — one row per canonical binding edge, 8 features per row.
// Designed for graph-neural-network and edge-level binding analysis in the
// ZeroEngine DL pipeline. Edge ordering mirrors ZERO_DEPENDENCY_BINDING_EDGE_IDS.
//
// Row layout:
//   [bound, attempted, consumer_present, reader_present, setter_present,
//    missing_method_count_norm, severity_score, is_critical]
// ────────────────────────────────────────────────────────────────────────────────

export const ZERO_BINDER_DL_EDGE_COUNT = 6 as const;
export const ZERO_BINDER_DL_EDGE_FEATURE_COUNT = 8 as const;

export const ZERO_BINDER_DL_EDGE_FEATURE_LABELS: readonly string[] = Object.freeze([
  'bound',                         // 0 — binary: attempt was successful
  'attempted',                     // 1 — binary: setter was invoked
  'consumer_present',              // 2 — binary: consumer engine slot is populated
  'reader_present',                // 3 — binary: reader engine slot is populated
  'setter_present',                // 4 — binary: consumer exposes the expected setter
  'missing_method_count_norm',     // 5 — missing reader methods / requiredReaderMethods.length
  'severity_score',                // 6 — INFO→0 / WARN→0.5 / ERROR→1
  'is_critical',                   // 7 — binary: edge is marked critical in the canonical graph
]);

export interface DependencyBindingDLTensor {
  /** 2D float tensor of shape [rows × cols] with one row per canonical edge. */
  readonly tensor: readonly (readonly number[])[];
  /** Number of rows — always ZERO_BINDER_DL_EDGE_COUNT (6). */
  readonly rows: number;
  /** Number of columns per row — always ZERO_BINDER_DL_EDGE_FEATURE_COUNT (8). */
  readonly cols: number;
  /** Edge IDs in row order, aligned with ZERO_DEPENDENCY_BINDING_EDGE_IDS. */
  readonly edgeIds: readonly DependencyBindingEdgeId[];
  /** Feature labels aligned to each column index. */
  readonly edgeFeatureLabels: readonly string[];
  /** Fingerprint of the session this tensor was extracted from. */
  readonly sessionFingerprint: string;
  /** ISO-8601 timestamp when extraction occurred. */
  readonly extractedAt: string;
}

/**
 * Extracts a 6×8 DL tensor from a DependencyBindingSession.
 *
 * Each row corresponds to one canonical binding edge in ZERO_DEPENDENCY_BINDING_EDGE_IDS
 * order. If no attempt was recorded for an edge, all features are zeroed except
 * is_critical, which is read from the canonical edge definition.
 */
export function extractDependencyBindingDLTensor(
  session: DependencyBindingSession,
): DependencyBindingDLTensor {
  const rows: number[][] = [];

  for (const edgeId of ZERO_DEPENDENCY_BINDING_EDGE_IDS) {
    const attempt = getAttemptForEdge(session.attempts, edgeId);
    const edgeDef = ZERO_BINDING_EDGES_BY_ID[edgeId];
    const maxMethods = edgeDef !== undefined && edgeDef.requiredReaderMethods.length > 0
      ? edgeDef.requiredReaderMethods.length
      : 1;

    if (attempt === undefined) {
      rows.push([
        0, 0, 0, 0, 0, 0, 0,
        edgeDef !== undefined ? boolToFloat(edgeDef.critical) : 0,
      ]);
    } else {
      rows.push([
        boolToFloat(attempt.bound),
        boolToFloat(attempt.attempted),
        boolToFloat(attempt.consumerPresent),
        boolToFloat(attempt.readerPresent),
        boolToFloat(attempt.setterPresent),
        clampNorm(attempt.missingReaderMethods.length, maxMethods),
        severityScore(attempt.severity),
        edgeDef !== undefined ? boolToFloat(edgeDef.critical) : 0,
      ]);
    }
  }

  return Object.freeze({
    tensor: Object.freeze(rows.map((row) => Object.freeze([...row]))),
    rows: ZERO_BINDER_DL_EDGE_COUNT,
    cols: ZERO_BINDER_DL_EDGE_FEATURE_COUNT,
    edgeIds: ZERO_DEPENDENCY_BINDING_EDGE_IDS,
    edgeFeatureLabels: ZERO_BINDER_DL_EDGE_FEATURE_LABELS,
    sessionFingerprint: session.fingerprint,
    extractedAt: new Date().toISOString(),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// Chat signal construction
//
// Translates a DependencyBindingSession into a backend-chat ingress signal.
// The signal is consumed by ZeroBindingSignalAdapter in chat/adapters/.
// It does NOT import from chat/ — it is a pure data type with no chat deps.
// ────────────────────────────────────────────────────────────────────────────────

export type DependencyBindingChatSignalKind =
  | 'BINDING_COMPLETE'
  | 'BINDING_PARTIAL'
  | 'BINDING_FAILED'
  | 'BINDING_DRY_RUN'
  | 'BINDING_REBIND';

export const ZERO_DEPENDENCY_BINDING_CHAT_SIGNAL_KINDS = Object.freeze([
  'BINDING_COMPLETE',
  'BINDING_PARTIAL',
  'BINDING_FAILED',
  'BINDING_DRY_RUN',
  'BINDING_REBIND',
] as const satisfies readonly DependencyBindingChatSignalKind[]);

export interface DependencyBindingChatSignal {
  /** Discriminator surface. */
  readonly surface: 'dependency_binder';
  /** Discriminator kind. */
  readonly kind: DependencyBindingChatSignalKind;
  /** Fingerprint of the source session. */
  readonly sessionFingerprint: string;
  /** Resolved orchestrator profile from the source session. */
  readonly profileId: string;
  /** Resolved mode at bind time, or null if mode was unset. */
  readonly mode: ModeCode | null;
  /** Whether all four reader groups are bound. */
  readonly bindingComplete: boolean;
  /** Groups that were successfully bound. */
  readonly boundGroups: readonly DependencyBindingGroup[];
  /** Groups that failed to bind. */
  readonly failedGroups: readonly DependencyBindingGroup[];
  /** Number of BIND_FAILED attempts with ERROR severity that are also not bound. */
  readonly criticalFailureCount: number;
  /** Number of validation errors from the bundle inventory check. */
  readonly validationErrorCount: number;
  /** Number of validation warnings from the bundle inventory check. */
  readonly validationWarningCount: number;
  /** Inline ML vector for immediate downstream scoring. */
  readonly mlVector: DependencyBindingMLVector;
  /** Session notes (shared with session.notes). */
  readonly notes: readonly string[];
  /** ISO-8601 timestamp when the signal was built. */
  readonly emittedAt: string;
}

function resolveBindingSignalKind(
  session: DependencyBindingSession,
  isDryRun: boolean,
  isPreviousSessionPresent: boolean,
): DependencyBindingChatSignalKind {
  if (isDryRun) return 'BINDING_DRY_RUN';
  const complete = isDependencyBindingComplete(session.report);
  const hasErrors = session.attempts.some((a) => a.severity === 'ERROR');
  if (isPreviousSessionPresent && complete) return 'BINDING_REBIND';
  if (complete) return 'BINDING_COMPLETE';
  if (hasErrors) return 'BINDING_FAILED';
  return 'BINDING_PARTIAL';
}

/**
 * Builds a DependencyBindingChatSignal from a DependencyBindingSession.
 *
 * The signal includes an inline ML vector so the chat layer can make
 * immediate decisions (e.g., whether to surface a binding-health warning)
 * without re-extracting the vector.
 */
export function buildDependencyBindingChatSignal(
  session: DependencyBindingSession,
  options: {
    readonly isDryRun?: boolean;
    readonly isPreviousSessionPresent?: boolean;
  } = {},
): DependencyBindingChatSignal {
  const isDryRun = options.isDryRun ?? false;
  const isPreviousSessionPresent = options.isPreviousSessionPresent ?? false;

  const boundGroups = ZERO_DEPENDENCY_BINDING_GROUPS.filter((g) =>
    getDependencyGroupBoolean(session.report, g),
  );
  const failedGroups = ZERO_DEPENDENCY_BINDING_GROUPS.filter((g) =>
    !getDependencyGroupBoolean(session.report, g),
  );
  const criticalFailureCount = session.attempts.filter(
    (a) => a.severity === 'ERROR' && !a.bound,
  ).length;

  return Object.freeze({
    surface: 'dependency_binder' as const,
    kind: resolveBindingSignalKind(session, isDryRun, isPreviousSessionPresent),
    sessionFingerprint: session.fingerprint,
    profileId: session.resolvedProfileId,
    mode: session.resolvedMode,
    bindingComplete: isDependencyBindingComplete(session.report),
    boundGroups: freezeArray(boundGroups),
    failedGroups: freezeArray(failedGroups),
    criticalFailureCount,
    validationErrorCount: session.validation.errors.length,
    validationWarningCount: session.validation.warnings.length,
    mlVector: extractDependencyBindingMLVector(session, isDryRun),
    notes: freezeArray([...session.notes]),
    emittedAt: new Date().toISOString(),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// Telemetry snapshot extraction
//
// Full-fidelity telemetry bundle: ML vector + DL tensor + chat signal.
// Designed for async ingestion by the ZeroEngine telemetry pipeline and
// for operator dashboards that need binding quality at a glance.
// ────────────────────────────────────────────────────────────────────────────────

export interface DependencyBindingTelemetrySnapshot {
  /** Fingerprint of the source session. */
  readonly sessionFingerprint: string;
  /** Resolved orchestrator profile from the source session. */
  readonly profileId: string;
  /** Resolved mode at bind time. */
  readonly mode: ModeCode | null;
  /** Total canonical edges processed. */
  readonly totalEdges: number;
  /** Edges that were successfully bound. */
  readonly boundEdges: number;
  /** Edges that failed to bind. */
  readonly failedEdges: number;
  /** Edges that bound with a partial reader contract. */
  readonly partialEdges: number;
  /** Validation error count from bundle inventory check. */
  readonly validationErrors: number;
  /** Validation warning count from bundle inventory check. */
  readonly validationWarnings: number;
  /** Whether all four reader groups are bound. */
  readonly bindingComplete: boolean;
  /** 32-dimensional ML feature vector. */
  readonly mlVector: DependencyBindingMLVector;
  /** 6×8 DL edge-feature tensor. */
  readonly dlTensor: DependencyBindingDLTensor;
  /** Chat ingress signal derived from this session. */
  readonly chatSignal: DependencyBindingChatSignal;
  /** Session notes. */
  readonly notes: readonly string[];
  /** ISO-8601 timestamp when telemetry was extracted. */
  readonly emittedAt: string;
}

/**
 * Extracts a full-fidelity telemetry snapshot from a DependencyBindingSession.
 *
 * This is the authoritative telemetry entry point. It computes and embeds the
 * ML vector, DL tensor, and chat signal so all three are co-located in the
 * telemetry record without redundant re-computation.
 */
export function extractDependencyBindingTelemetry(
  session: DependencyBindingSession,
  options: {
    readonly isDryRun?: boolean;
    readonly isPreviousSessionPresent?: boolean;
  } = {},
): DependencyBindingTelemetrySnapshot {
  const summary = getSessionSummary(session);
  const mlVector = extractDependencyBindingMLVector(session, options.isDryRun);
  const dlTensor = extractDependencyBindingDLTensor(session);
  const chatSignal = buildDependencyBindingChatSignal(session, options);

  return Object.freeze({
    sessionFingerprint: session.fingerprint,
    profileId: session.resolvedProfileId,
    mode: session.resolvedMode,
    totalEdges: summary.totalAttempts,
    boundEdges: summary.boundAttempts,
    failedEdges: summary.failedAttempts,
    partialEdges: summary.partialAttempts,
    validationErrors: session.validation.errors.length,
    validationWarnings: session.validation.warnings.length,
    bindingComplete: summary.bindingComplete,
    mlVector,
    dlTensor,
    chatSignal,
    notes: freezeArray([...session.notes]),
    emittedAt: new Date().toISOString(),
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// Health monitoring
//
// Sliding-window health assessment over a sequence of binding sessions.
// assessDependencyBindingHealth() is the stateless entry point.
// DependencyBindingHealthMonitor wraps it with a history window.
// ────────────────────────────────────────────────────────────────────────────────

export interface DependencyBindingHealthReport {
  /** True when healthScore ≥ 50 and all groups are bound. */
  readonly overallHealthy: boolean;
  /** Composite health score from 0 (critical) to 100 (perfect). */
  readonly healthScore: number;
  /** Issues that require immediate operator attention. */
  readonly criticalIssues: readonly string[];
  /** Non-blocking issues that should be monitored. */
  readonly warningIssues: readonly string[];
  /** Actionable recommendations based on current health state. */
  readonly recommendations: readonly string[];
  /** Per-group bound status at the time of assessment. */
  readonly groupHealth: Readonly<Record<DependencyBindingGroup, boolean>>;
  /** Fingerprint of the session that was assessed. */
  readonly sessionFingerprint: string;
  /** Number of historical sessions in the assessment window. */
  readonly windowSize: number;
  /** Number of complete sessions within the window. */
  readonly completeInWindow: number;
  /** ISO-8601 timestamp of assessment. */
  readonly assessedAt: string;
}

/**
 * Stateless health assessment for a single DependencyBindingSession.
 *
 * @param session - The session to assess.
 * @param history - Optional prior sessions for trend-aware scoring.
 *                  Pass the monitor window to enable degradation detection.
 */
export function assessDependencyBindingHealth(
  session: DependencyBindingSession,
  history: readonly DependencyBindingSession[] = [],
): DependencyBindingHealthReport {
  const summary = getSessionSummary(session);
  const criticalIssues: string[] = [];
  const warningIssues: string[] = [];
  const recommendations: string[] = [];

  let score = 100;

  // Unbound groups: each missing group costs 25 points (max 100)
  for (const group of ZERO_DEPENDENCY_BINDING_GROUPS) {
    if (!getDependencyGroupBoolean(session.report, group)) {
      criticalIssues.push(`Group '${group}' is not bound.`);
      score -= 25;
    }
  }

  // Validation errors: each costs 10 points (capped at 30)
  const errorPenalty = Math.min(session.validation.errors.length * 10, 30);
  score -= errorPenalty;
  for (const error of session.validation.errors) {
    criticalIssues.push(error.message);
  }

  // Validation warnings: each costs 3 points (capped at 15)
  const warnPenalty = Math.min(session.validation.warnings.length * 3, 15);
  score -= warnPenalty;
  for (const warning of session.validation.warnings) {
    warningIssues.push(warning.message);
  }

  // Failed attempts: each costs 5 points
  const failedAttempts = getFailedBindingAttempts(session);
  if (failedAttempts.length > 0) {
    warningIssues.push(`${String(failedAttempts.length)} binding attempt(s) failed.`);
    score -= Math.min(failedAttempts.length * 5, 20);
  }

  // Partial attempts: each costs 2 points
  const partialAttempts = getPartialBindingAttempts(session);
  if (partialAttempts.length > 0) {
    warningIssues.push(`${String(partialAttempts.length)} binding(s) are partial.`);
    score -= Math.min(partialAttempts.length * 2, 10);
  }

  // History-aware trend scoring (only when ≥ 3 prior sessions exist)
  if (history.length >= 3) {
    const recentWindow = history.slice(-5);
    const completeInRecent = recentWindow.filter((s) =>
      isDependencyBindingComplete(s.report),
    ).length;

    if (completeInRecent === 0) {
      criticalIssues.push('No complete bindings in recent session history.');
      score -= 15;
      recommendations.push(
        'Inspect engine bundle construction. All 7 engine slots must be populated.',
      );
    } else if (completeInRecent < recentWindow.length / 2) {
      warningIssues.push('Binding completeness is intermittent in recent sessions.');
      score -= 5;
      recommendations.push(
        'Check for non-deterministic engine construction or missing setter declarations.',
      );
    }
  }

  // Recommendations for healthy state
  if (criticalIssues.length === 0 && warningIssues.length === 0) {
    recommendations.push('All bindings are healthy. No action required.');
  }

  // Emergency recommendation
  if (score < 50) {
    recommendations.push(
      'Consider resetting the DependencyBinder and re-binding all engines.',
    );
  }

  const windowSize = history.length;
  const completeInWindow = history.filter((s) => isDependencyBindingComplete(s.report)).length;

  const groupHealth: Record<DependencyBindingGroup, boolean> = {
    'pressure-reader': getDependencyGroupBoolean(session.report, 'pressure-reader'),
    'shield-reader': getDependencyGroupBoolean(session.report, 'shield-reader'),
    'tension-reader': getDependencyGroupBoolean(session.report, 'tension-reader'),
    'cascade-reader': getDependencyGroupBoolean(session.report, 'cascade-reader'),
  };

  return Object.freeze({
    overallHealthy: score >= 50 && summary.bindingComplete,
    healthScore: Math.max(0, Math.min(100, score)),
    criticalIssues: freezeArray(criticalIssues),
    warningIssues: freezeArray(warningIssues),
    recommendations: freezeArray(recommendations),
    groupHealth: Object.freeze(groupHealth),
    sessionFingerprint: session.fingerprint,
    windowSize,
    completeInWindow,
    assessedAt: new Date().toISOString(),
  });
}

/**
 * Sliding-window health monitor for DependencyBinder sessions.
 *
 * Record each session after binding; call assess() or assessLast() to get
 * a health report that incorporates the full history window.
 *
 * @example
 * ```ts
 * const monitor = new DependencyBindingHealthMonitor();
 * const report = binder.bind(bundle);  // live bind
 * const session = binder.getLastSession()!;
 * monitor.record(session);
 * const health = monitor.assessLast();
 * ```
 */
export class DependencyBindingHealthMonitor {
  private historyWindow: DependencyBindingSession[];
  private readonly maxWindowSize: number;

  public constructor(maxWindowSize = 50) {
    this.historyWindow = [];
    this.maxWindowSize = maxWindowSize;
  }

  /** Append a session to the sliding window. Older sessions are evicted when full. */
  public record(session: DependencyBindingSession): void {
    this.historyWindow.push(session);
    if (this.historyWindow.length > this.maxWindowSize) {
      this.historyWindow = this.historyWindow.slice(-this.maxWindowSize);
    }
  }

  /** Assess the provided session against the current history window. */
  public assess(session: DependencyBindingSession): DependencyBindingHealthReport {
    return assessDependencyBindingHealth(session, this.historyWindow);
  }

  /**
   * Assess the last recorded session against all prior sessions in the window.
   * Returns null when no sessions have been recorded.
   */
  public assessLast(): DependencyBindingHealthReport | null {
    if (this.historyWindow.length === 0) return null;
    const last = this.historyWindow[this.historyWindow.length - 1];
    if (last === undefined) return null;
    return assessDependencyBindingHealth(last, this.historyWindow.slice(0, -1));
  }

  /** Returns a frozen copy of the current history window. */
  public getHistory(): readonly DependencyBindingSession[] {
    return Object.freeze([...this.historyWindow]);
  }

  /** Returns the last N sessions in the window, or fewer if the window is smaller. */
  public getLastN(n: number): readonly DependencyBindingSession[] {
    return Object.freeze(this.historyWindow.slice(-n));
  }

  /**
   * Computes a binding stability score (0–100) based on how many sessions
   * in the window resulted in a complete binding.
   */
  public computeBindingStabilityScore(): number {
    if (this.historyWindow.length === 0) return 0;
    const completeCount = this.historyWindow.filter((s) =>
      isDependencyBindingComplete(s.report),
    ).length;
    return Math.round((completeCount / this.historyWindow.length) * 100);
  }

  /**
   * Returns a boolean trend array for a given group — one entry per session
   * in the window, ordered from oldest to newest.
   */
  public computeGroupTrend(
    group: DependencyBindingGroup,
  ): readonly boolean[] {
    return Object.freeze(
      this.historyWindow.map((s) => getDependencyGroupBoolean(s.report, group)),
    );
  }

  /**
   * Returns true when the last 3 sessions contain any incomplete binding,
   * indicating recent degradation.
   */
  public hasDegradation(): boolean {
    if (this.historyWindow.length < 2) return false;
    const recent = this.historyWindow.slice(-3);
    const complete = recent.filter((s) => isDependencyBindingComplete(s.report)).length;
    return complete < recent.length;
  }

  /** Clears the entire history window. */
  public reset(): void {
    this.historyWindow = [];
  }

  /** Returns the current window size (number of recorded sessions). */
  public getWindowSize(): number {
    return this.historyWindow.length;
  }

  /** Returns the configured maximum window size. */
  public getMaxWindowSize(): number {
    return this.maxWindowSize;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Binding timeline tracker
//
// Lightweight append-only timeline of binding sessions.
// Designed for operator dashboards, replay audit trails, and long-running
// stability reporting. Each entry is a compact summary of one session.
// ────────────────────────────────────────────────────────────────────────────────

export interface DependencyBindingTimelineEntry {
  /** Fingerprint of the source session. */
  readonly sessionFingerprint: string;
  /** Mode at bind time. */
  readonly mode: ModeCode | null;
  /** Profile ID at bind time. */
  readonly profileId: string;
  /** Whether all four reader groups were bound. */
  readonly bindingComplete: boolean;
  /** Number of groups that were successfully bound (0–4). */
  readonly boundGroupCount: number;
  /** Total canonical edges processed. */
  readonly totalAttempts: number;
  /** Edges that were successfully bound. */
  readonly boundAttempts: number;
  /** Edges that failed to bind. */
  readonly failedAttempts: number;
  /** ISO-8601 timestamp when this entry was recorded. */
  readonly recordedAt: string;
}

export interface DependencyBindingTimeline {
  /** Ordered entries from oldest to newest. */
  readonly entries: readonly DependencyBindingTimelineEntry[];
  /** ISO-8601 timestamp of the first recorded entry, or null. */
  readonly firstRecordedAt: string | null;
  /** ISO-8601 timestamp of the most recent entry, or null. */
  readonly lastRecordedAt: string | null;
  /** Total sessions recorded. */
  readonly totalSessions: number;
  /** Sessions where bindingComplete was true. */
  readonly completeSessions: number;
  /** Sessions where bindingComplete was false. */
  readonly incompleteSessions: number;
  /** Percentage of sessions that were complete (0–100). */
  readonly stabilityScore: number;
}

export const ZERO_EMPTY_BINDING_TIMELINE: Readonly<DependencyBindingTimeline> = Object.freeze({
  entries: Object.freeze([]),
  firstRecordedAt: null,
  lastRecordedAt: null,
  totalSessions: 0,
  completeSessions: 0,
  incompleteSessions: 0,
  stabilityScore: 0,
});

/**
 * Builds a compact DependencyBindingTimelineEntry from a full session.
 * Use this to record sessions into a timeline without retaining the full object.
 */
export function buildTimelineEntry(
  session: DependencyBindingSession,
): DependencyBindingTimelineEntry {
  const summary = getSessionSummary(session);
  const boundGroupCount = ZERO_DEPENDENCY_BINDING_GROUPS.filter((g) =>
    getDependencyGroupBoolean(session.report, g),
  ).length;

  return Object.freeze({
    sessionFingerprint: session.fingerprint,
    mode: session.resolvedMode,
    profileId: session.resolvedProfileId,
    bindingComplete: summary.bindingComplete,
    boundGroupCount,
    totalAttempts: summary.totalAttempts,
    boundAttempts: summary.boundAttempts,
    failedAttempts: summary.failedAttempts,
    recordedAt: new Date().toISOString(),
  });
}

/**
 * Append-only tracker that maintains a sliding window of compact timeline entries.
 *
 * @example
 * ```ts
 * const tracker = new DependencyBindingTimelineTracker();
 * tracker.record(session);
 * const timeline = tracker.getTimeline();
 * console.log(timeline.stabilityScore); // e.g. 100
 * ```
 */
export class DependencyBindingTimelineTracker {
  private entries: DependencyBindingTimelineEntry[];
  private readonly maxEntries: number;

  public constructor(maxEntries = 200) {
    this.entries = [];
    this.maxEntries = maxEntries;
  }

  /** Append a session to the timeline as a compact entry. */
  public record(session: DependencyBindingSession): void {
    const entry = buildTimelineEntry(session);
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  /** Returns the complete timeline snapshot. */
  public getTimeline(): DependencyBindingTimeline {
    const entries = Object.freeze([...this.entries]);
    const totalSessions = entries.length;
    const completeSessions = entries.filter((e) => e.bindingComplete).length;
    const incompleteSessions = totalSessions - completeSessions;
    const stabilityScore =
      totalSessions > 0
        ? Math.round((completeSessions / totalSessions) * 100)
        : 0;

    return Object.freeze({
      entries,
      firstRecordedAt: entries.length > 0 ? (entries[0]?.recordedAt ?? null) : null,
      lastRecordedAt:
        entries.length > 0 ? (entries[entries.length - 1]?.recordedAt ?? null) : null,
      totalSessions,
      completeSessions,
      incompleteSessions,
      stabilityScore,
    });
  }

  /** Returns the most recent timeline entry, or null when the tracker is empty. */
  public getLastEntry(): DependencyBindingTimelineEntry | null {
    return this.entries.length > 0
      ? (this.entries[this.entries.length - 1] ?? null)
      : null;
  }

  /** Returns all entries where mode matches the given ModeCode. */
  public getEntriesForMode(mode: ModeCode): readonly DependencyBindingTimelineEntry[] {
    return Object.freeze(this.entries.filter((e) => e.mode === mode));
  }

  /** Returns all entries for a specific orchestrator profile ID. */
  public getEntriesForProfile(
    profileId: string,
  ): readonly DependencyBindingTimelineEntry[] {
    return Object.freeze(this.entries.filter((e) => e.profileId === profileId));
  }

  /**
   * Computes the stability score: percentage of recorded sessions where
   * bindingComplete is true (0–100).
   */
  public computeStabilityScore(): number {
    return this.getTimeline().stabilityScore;
  }

  /**
   * Returns an array of human-readable notes summarizing the current timeline.
   * Suitable for injection into session.notes.
   */
  public toSessionNotes(): readonly string[] {
    const timeline = this.getTimeline();
    const lines: string[] = [
      `Timeline: totalSessions=${String(timeline.totalSessions)} `
        + `complete=${String(timeline.completeSessions)} `
        + `incomplete=${String(timeline.incompleteSessions)} `
        + `stability=${String(timeline.stabilityScore)}%.`,
    ];

    if (timeline.lastRecordedAt !== null) {
      lines.push(`Last binding session recorded at ${timeline.lastRecordedAt}.`);
    }

    return freezeArray(lines);
  }

  /** Clears all timeline entries. */
  public reset(): void {
    this.entries = [];
  }

  /** Returns the number of entries currently in the tracker. */
  public getEntryCount(): number {
    return this.entries.length;
  }

  /** Returns the configured maximum number of entries. */
  public getMaxEntries(): number {
    return this.maxEntries;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Extended analysis and utility functions
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Merges multiple ZeroDependencyBindingReports into a single report.
 *
 * A group is considered bound only when ALL input reports have it bound
 * (logical AND). This is the correct semantics for multi-run binding consensus.
 * Notes from all reports are concatenated.
 */
export function mergeDependencyBindingReports(
  ...reports: readonly ZeroDependencyBindingReport[]
): ZeroDependencyBindingReport {
  if (reports.length === 0) {
    return Object.freeze({
      pressureReaderBound: false,
      shieldReaderBound: false,
      tensionReaderBound: false,
      cascadeReaderBound: false,
      notes: freezeArray(['No reports supplied to merge.']),
    });
  }

  return Object.freeze({
    pressureReaderBound: reports.every((r) => r.pressureReaderBound),
    shieldReaderBound: reports.every((r) => r.shieldReaderBound),
    tensionReaderBound: reports.every((r) => r.tensionReaderBound),
    cascadeReaderBound: reports.every((r) => r.cascadeReaderBound),
    notes: freezeArray(reports.flatMap((r) => [...r.notes])),
  });
}

/**
 * Selects the "best" session from a list of candidates.
 *
 * Priority:
 * 1. Complete sessions (all four groups bound) — returns the most recent.
 * 2. Otherwise — returns the session with the highest bound group count.
 *
 * Returns null when sessions is empty.
 */
export function resolveBestBindingSession(
  sessions: readonly DependencyBindingSession[],
): DependencyBindingSession | null {
  if (sessions.length === 0) return null;

  const completeSessions = sessions.filter((s) =>
    isDependencyBindingComplete(s.report),
  );

  if (completeSessions.length > 0) {
    return completeSessions[completeSessions.length - 1] ?? null;
  }

  return sessions.reduce<DependencyBindingSession>((best, session) => {
    const bestGroups = ZERO_DEPENDENCY_BINDING_GROUPS.filter((g) =>
      getDependencyGroupBoolean(best.report, g),
    ).length;
    const sessionGroups = ZERO_DEPENDENCY_BINDING_GROUPS.filter((g) =>
      getDependencyGroupBoolean(session.report, g),
    ).length;
    return sessionGroups >= bestGroups ? session : best;
  }, sessions[0] as DependencyBindingSession);
}

/**
 * Computes a divergence score (0–100) between two DependencyBindingSessions.
 *
 * A score of 0 means the two sessions are identical at the group-boolean level.
 * A score of 100 means all four groups differ AND both sessions have maximum
 * validation errors and warnings. Useful for change-detection between rebinds.
 */
export function computeBindingDivergenceScore(
  left: DependencyBindingSession,
  right: DependencyBindingSession,
): number {
  let divergence = 0;

  // Per-group boolean difference — each mismatched group costs 25 (max 100)
  for (const group of ZERO_DEPENDENCY_BINDING_GROUPS) {
    const leftBound = getDependencyGroupBoolean(left.report, group);
    const rightBound = getDependencyGroupBoolean(right.report, group);
    if (leftBound !== rightBound) divergence += 25;
  }

  // Error count difference — capped at 25
  const errDiff = Math.abs(
    left.validation.errors.length - right.validation.errors.length,
  );
  divergence += Math.min(errDiff * 5, 25);

  // Warning count difference — capped at 10
  const warnDiff = Math.abs(
    left.validation.warnings.length - right.validation.warnings.length,
  );
  divergence += Math.min(warnDiff * 2, 10);

  return Math.min(100, divergence);
}

/**
 * Serializes a DependencyBindingSession to a JSON string.
 *
 * The result is suitable for audit logging, replay, or transport across
 * process boundaries. It does NOT include the validation.inventory.entries
 * availableMethodNames arrays (those are runtime-only details).
 */
export function serializeDependencyBindingSession(
  session: DependencyBindingSession,
): string {
  return JSON.stringify({
    fingerprint: session.fingerprint,
    resolvedProfileId: session.resolvedProfileId,
    resolvedMode: session.resolvedMode,
    attempts: session.attempts.map((a) => ({
      id: a.id,
      group: a.group,
      contractName: a.contractName,
      setterName: a.setterName,
      consumerEngineId: a.consumerEngineId,
      readerEngineId: a.readerEngineId,
      status: a.status,
      severity: a.severity,
      attempted: a.attempted,
      bound: a.bound,
      consumerPresent: a.consumerPresent,
      readerPresent: a.readerPresent,
      setterPresent: a.setterPresent,
      missingReaderMethods: [...a.missingReaderMethods],
      note: a.note,
      errorMessage: a.errorMessage,
    })),
    groups: session.groups.map((g) => ({
      group: g.group,
      bound: g.bound,
      totalEdges: g.totalEdges,
      boundEdges: g.boundEdges,
      failedEdges: g.failedEdges,
      partialEdges: g.partialEdges,
      notes: [...g.notes],
    })),
    report: {
      pressureReaderBound: session.report.pressureReaderBound,
      shieldReaderBound: session.report.shieldReaderBound,
      tensionReaderBound: session.report.tensionReaderBound,
      cascadeReaderBound: session.report.cascadeReaderBound,
      notes: [...session.report.notes],
    },
    validationErrors: session.validation.errors.map((e) => ({
      severity: e.severity,
      code: e.code,
      slot: e.slot,
      message: e.message,
    })),
    validationWarnings: session.validation.warnings.map((w) => ({
      severity: w.severity,
      code: w.code,
      slot: w.slot,
      message: w.message,
    })),
    notes: [...session.notes],
  });
}

/**
 * Splits a session's attempts into critical and non-critical groups
 * based on the canonical edge definition.
 */
export function getBindingAttemptsByCriticalStatus(
  session: DependencyBindingSession,
): Readonly<{
  critical: readonly DependencyBindingAttempt[];
  nonCritical: readonly DependencyBindingAttempt[];
}> {
  const critical = session.attempts.filter((a) => {
    const edgeDef = ZERO_BINDING_EDGES_BY_ID[a.id];
    return edgeDef?.critical === true;
  });
  const nonCritical = session.attempts.filter((a) => {
    const edgeDef = ZERO_BINDING_EDGES_BY_ID[a.id];
    return edgeDef?.critical !== true;
  });
  return Object.freeze({
    critical: freezeArray(critical),
    nonCritical: freezeArray(nonCritical),
  });
}

/**
 * Computes a 0–100 binding quality score for a session.
 *
 * Formula:
 *   base = (boundAttempts / totalAttempts) × 80
 *   bonus = bindingComplete ? 20 : 0
 *   penalty = errors × 10 + warnings × 3 (capped at 40)
 *   score = clamp(base + bonus − penalty, 0, 100)
 */
export function computeBindingQualityScore(session: DependencyBindingSession): number {
  const summary = getSessionSummary(session);
  if (summary.totalAttempts === 0) return 0;

  const bindingFrac = summary.boundAttempts / summary.totalAttempts;
  const completenessBonus = summary.bindingComplete ? 20 : 0;
  const validationPenalty = Math.min(
    session.validation.errors.length * 10 + session.validation.warnings.length * 3,
    40,
  );

  return Math.max(0, Math.min(100, Math.round(bindingFrac * 80 + completenessBonus - validationPenalty)));
}

/**
 * Returns all canonical binding edges that are critical but were NOT
 * successfully bound in the given session.
 */
export function getUnboundCriticalEdges(
  session: DependencyBindingSession,
): readonly DependencyBindingEdgeDefinition[] {
  return freezeArray(
    ZERO_CANONICAL_BINDING_EDGES.filter((edge) => {
      if (!edge.critical) return false;
      const attempt = getAttemptForEdge(session.attempts, edge.id);
      return attempt === undefined || !attempt.bound;
    }),
  );
}

/**
 * Returns the canonical binding edges that were successfully bound in a session.
 */
export function getBoundCanonicalEdges(
  session: DependencyBindingSession,
): readonly DependencyBindingEdgeDefinition[] {
  return freezeArray(
    ZERO_CANONICAL_BINDING_EDGES.filter((edge) => {
      const attempt = getAttemptForEdge(session.attempts, edge.id);
      return attempt !== undefined && attempt.bound;
    }),
  );
}

/**
 * Returns the canonical binding edges that were NOT bound in a session,
 * regardless of whether they are critical.
 */
export function getUnboundCanonicalEdges(
  session: DependencyBindingSession,
): readonly DependencyBindingEdgeDefinition[] {
  return freezeArray(
    ZERO_CANONICAL_BINDING_EDGES.filter((edge) => {
      const attempt = getAttemptForEdge(session.attempts, edge.id);
      return attempt === undefined || !attempt.bound;
    }),
  );
}

/**
 * Convenience factory that creates a DependencyBinder, a health monitor,
 * and a timeline tracker wired together. Returns all three so the caller
 * can record sessions into both the monitor and tracker after each bind.
 */
export function createDependencyBinderWithMonitor(
  options: Partial<DependencyBinderOptions> = {},
  monitorWindowSize = 50,
  timelineMaxEntries = 200,
): {
  readonly binder: DependencyBinder;
  readonly monitor: DependencyBindingHealthMonitor;
  readonly timeline: DependencyBindingTimelineTracker;
} {
  return Object.freeze({
    binder: new DependencyBinder(options),
    monitor: new DependencyBindingHealthMonitor(monitorWindowSize),
    timeline: new DependencyBindingTimelineTracker(timelineMaxEntries),
  });
}

/**
 * Runs a bind, records the session in the monitor and timeline, extracts
 * the full telemetry snapshot, and returns everything as a single bundle.
 *
 * This is the highest-level convenience entry point for callers that want
 * zero-config binding + telemetry in one call.
 */
export function bindAndExtractTelemetry(
  bundle: ZeroDependencyBundle,
  binder: DependencyBinder,
  monitor: DependencyBindingHealthMonitor,
  timeline: DependencyBindingTimelineTracker,
  configInput: ResolveOrchestratorConfigInput = {},
): {
  readonly report: ZeroDependencyBindingReport;
  readonly session: DependencyBindingSession;
  readonly telemetry: DependencyBindingTelemetrySnapshot;
  readonly health: DependencyBindingHealthReport;
} {
  binder.bind(bundle, configInput);
  const session = binder.getLastSession()!;
  monitor.record(session);
  timeline.record(session);
  const telemetry = extractDependencyBindingTelemetry(session);
  const health = monitor.assessLast()!;

  return Object.freeze({ report: session.report, session, telemetry, health });
}

// ────────────────────────────────────────────────────────────────────────────────
// Extended assertion suite for downstream harnesses and self-testing
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Asserts that a DependencyBindingMLVector has the correct number of features.
 * Throws with a descriptive message if the count does not match.
 */
export function assertMLVectorDimension(vector: DependencyBindingMLVector): void {
  if (vector.features.length !== ZERO_BINDER_ML_FEATURE_COUNT) {
    throw new Error(
      `[DependencyBinder] ML vector has ${String(vector.features.length)} features; `
        + `expected ${String(ZERO_BINDER_ML_FEATURE_COUNT)}.`,
    );
  }
}

/**
 * Asserts that a DependencyBindingDLTensor has the correct shape (6×8).
 * Throws with a descriptive message if any dimension is wrong.
 */
export function assertDLTensorShape(tensor: DependencyBindingDLTensor): void {
  if (tensor.rows !== ZERO_BINDER_DL_EDGE_COUNT) {
    throw new Error(
      `[DependencyBinder] DL tensor has ${String(tensor.rows)} rows; `
        + `expected ${String(ZERO_BINDER_DL_EDGE_COUNT)}.`,
    );
  }
  for (const row of tensor.tensor) {
    if (row.length !== ZERO_BINDER_DL_EDGE_FEATURE_COUNT) {
      throw new Error(
        `[DependencyBinder] DL tensor row has ${String(row.length)} features; `
          + `expected ${String(ZERO_BINDER_DL_EDGE_FEATURE_COUNT)}.`,
      );
    }
  }
}

/**
 * Asserts that all features in a DependencyBindingMLVector are in [0, 1].
 * Throws with a descriptive message that includes the feature label and index.
 */
export function assertMLVectorInRange(vector: DependencyBindingMLVector): void {
  for (let index = 0; index < vector.features.length; index += 1) {
    const value = vector.features[index];
    const label = vector.featureLabels[index] ?? 'unknown';
    if (value === undefined || value < 0 || value > 1) {
      throw new Error(
        `[DependencyBinder] ML feature[${String(index)}] '${label}' is out of [0,1] range: `
          + `${value === undefined ? 'undefined' : String(value)}.`,
      );
    }
  }
}

/**
 * Asserts structural integrity of a DependencyBindingSession.
 * Checks that the fingerprint is non-empty, at least one attempt exists,
 * and all attempt edge IDs are canonical.
 */
export function assertBindingSessionIntegrity(
  session: DependencyBindingSession,
): void {
  if (session.fingerprint.length === 0) {
    throw new Error('[DependencyBinder] Session fingerprint is empty.');
  }

  if (session.attempts.length === 0) {
    throw new Error('[DependencyBinder] Session has no binding attempts.');
  }

  for (const attempt of session.attempts) {
    if (!ZERO_DEPENDENCY_BINDING_EDGE_IDS.includes(attempt.id)) {
      throw new Error(
        `[DependencyBinder] Attempt references unknown canonical edge id: ${attempt.id}.`,
      );
    }
  }
}

/**
 * Asserts that the DependencyBindingHealthMonitor window contains at least
 * one session. Useful as a precondition guard before calling assessLast().
 */
export function assertHealthMonitorWindowNotEmpty(
  monitor: DependencyBindingHealthMonitor,
): void {
  if (monitor.getWindowSize() === 0) {
    throw new Error(
      '[DependencyBinder] Health monitor window is empty; '
        + 'record at least one session before assessing.',
    );
  }
}

/**
 * Asserts that a DependencyBindingTelemetrySnapshot is internally consistent:
 * - ML vector fingerprint matches the snapshot fingerprint.
 * - DL tensor fingerprint matches the snapshot fingerprint.
 * - Chat signal fingerprint matches the snapshot fingerprint.
 */
export function assertTelemetrySnapshotConsistency(
  snapshot: DependencyBindingTelemetrySnapshot,
): void {
  if (snapshot.mlVector.sessionFingerprint !== snapshot.sessionFingerprint) {
    throw new Error(
      `[DependencyBinder] Telemetry ML vector fingerprint mismatch: `
        + `expected ${snapshot.sessionFingerprint}, `
        + `got ${snapshot.mlVector.sessionFingerprint}.`,
    );
  }
  if (snapshot.dlTensor.sessionFingerprint !== snapshot.sessionFingerprint) {
    throw new Error(
      `[DependencyBinder] Telemetry DL tensor fingerprint mismatch: `
        + `expected ${snapshot.sessionFingerprint}, `
        + `got ${snapshot.dlTensor.sessionFingerprint}.`,
    );
  }
  if (snapshot.chatSignal.sessionFingerprint !== snapshot.sessionFingerprint) {
    throw new Error(
      `[DependencyBinder] Telemetry chat signal fingerprint mismatch: `
        + `expected ${snapshot.sessionFingerprint}, `
        + `got ${snapshot.chatSignal.sessionFingerprint}.`,
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Well-known singleton instances for zero-config usage
//
// These singletons are module-level and are safe to import directly in contexts
// where no custom configuration is required.
// ────────────────────────────────────────────────────────────────────────────────

/** Default DependencyBinder with all options at their factory defaults. */
export const ZERO_DEFAULT_DEPENDENCY_BINDER: DependencyBinder =
  new DependencyBinder();

/** Default health monitor with a 50-session sliding window. */
export const ZERO_DEFAULT_BINDING_HEALTH_MONITOR: DependencyBindingHealthMonitor =
  new DependencyBindingHealthMonitor();

/** Default timeline tracker with a 200-entry capacity. */
export const ZERO_DEFAULT_BINDING_TIMELINE: DependencyBindingTimelineTracker =
  new DependencyBindingTimelineTracker();
