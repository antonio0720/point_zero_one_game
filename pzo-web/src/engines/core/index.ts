// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — CORE ENGINE PUBLIC BARREL
// pzo-web/src/engines/core/index.ts
//
// Single import surface for all core engine infrastructure:
//   EventBus · types · ClockSource · RunStateSnapshot
//   OrchestratorDiagnostics · EngineOrchestrator
//
// Architecture notes
// ──────────────────
// • EngineEventBindings is intentionally excluded from this barrel.
//   It imports from ../../store/engineStore, which would form a circular
//   dependency if any store file imports from chat/index.ts, which imports
//   from here. Consumers that need EngineEventBindings must import it
//   directly:  import { EngineEventBindings } from '../core/EngineEventBindings'
//
// • This barrel is the sole allowed import surface for external engine
//   consumers (chat, battle, cascade, sovereignty, pressure, shield, card).
//   Never import individual core files from outside the core directory.
//
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

// ── Public surface re-exports ─────────────────────────────────────────────────
// All names from these modules become top-level exports of this barrel.

export * from './EventBus';
export * from './types';
export * from './ClockSource';
// RunStateSnapshot re-export: 'RunStateSnapshot' type already exported by './types'.
// Only the additional runtime symbols from RunStateSnapshot.ts are re-exported here.
export {
  buildSnapshot,
  createInitialLiveState,
  type TickMetrics,
  type LiveRunState,
  type MutableShieldState,
  type MutableShieldLayer,
} from './RunStateSnapshot';
export * from './OrchestratorDiagnostics';
export * from './EngineOrchestrator';

// ── Namespace imports ─────────────────────────────────────────────────────────
// Used in namespace-qualified access patterns (e.g. CoreEventBusModule.EventBus).

import * as CoreEventBusModule from './EventBus';
import * as CoreTypesModule from './types';
import * as CoreClockSourceModule from './ClockSource';
import * as CoreRunStateSnapshotModule from './RunStateSnapshot';
import * as CoreOrchestratorDiagnosticsModule from './OrchestratorDiagnostics';
import * as CoreEngineOrchestratorModule from './EngineOrchestrator';

export {
  CoreEventBusModule,
  CoreTypesModule,
  CoreClockSourceModule,
  CoreRunStateSnapshotModule,
  CoreOrchestratorDiagnosticsModule,
  CoreEngineOrchestratorModule,
};

// ── Combined namespace object ─────────────────────────────────────────────────
// One frozen object for consumers that prefer a single import point.

export const CoreEngineModule = Object.freeze({
  EventBus:               CoreEventBusModule,
  types:                  CoreTypesModule,
  ClockSource:            CoreClockSourceModule,
  RunStateSnapshot:       CoreRunStateSnapshotModule,
  OrchestratorDiagnostics: CoreOrchestratorDiagnosticsModule,
  EngineOrchestrator:     CoreEngineOrchestratorModule,
} as const);

// ── Module identity ───────────────────────────────────────────────────────────

export const CORE_ENGINE_MODULE_NAME         = 'PZO_CORE_ENGINE'                        as const;
export const CORE_ENGINE_PACKAGE_KIND        = 'frontend-engine-core-barrel'             as const;
export const CORE_ENGINE_RUNTIME_TIER        = 'frontend-core-infrastructure'            as const;
export const CORE_ENGINE_BARREL_VERSION      = '1.0.0'                                  as const;
export const CORE_ENGINE_COMPONENT_COUNT     = 6                                         as const;

// ── File registry ─────────────────────────────────────────────────────────────

/** All TypeScript source files present in the core/ directory. */
export const CORE_ENGINE_PRESENT_FILES = Object.freeze([
  'ClockSource.ts',
  'EngineEventBindings.ts',
  'EngineOrchestrator.ts',
  'EventBus.ts',
  'OrchestratorDiagnostics.ts',
  'RunStateSnapshot.ts',
  'index.ts',
  'types.ts',
] as const);

/** Files exported through this barrel. */
export const CORE_ENGINE_BARREL_EXPORTS = Object.freeze([
  'ClockSource.ts',
  'EngineOrchestrator.ts',
  'EventBus.ts',
  'OrchestratorDiagnostics.ts',
  'RunStateSnapshot.ts',
  'types.ts',
] as const);

/** Files present but excluded to avoid circular store→core→store imports. */
export const CORE_ENGINE_EXCLUDED_FROM_BARREL = Object.freeze([
  'EngineEventBindings.ts',
] as const);

// ── Engine event name registry ────────────────────────────────────────────────
// Canonical event name strings exported as a frozen array.
// Individual constants (TICK_TIER_CHANGED etc.) come from EventBus.ts via re-export.

export const CORE_ENGINE_EVENT_NAMES = Object.freeze([
  'TICK_TIER_CHANGED',
  'TIME_TIER_CHANGED',
  'TICK_START',
  'TICK_COMPLETE',
  'TICK_STEP_ERROR',
  'RUN_STARTED',
  'RUN_ENDED',
  'TIME_ENGINE_START',
  'TIME_ENGINE_TICK',
  'TIME_ENGINE_COMPLETE',
  'TIME_TICK_ADVANCED',
  'TIME_BUDGET_WARNING',
  'SEASON_TIMEOUT',
  'TENSION_SCORE_UPDATED',
  'TENSION_VISIBILITY_CHANGED',
  'TENSION_PULSE_FIRED',
  'THREAT_ARRIVED',
  'THREAT_EXPIRED',
  'THREAT_MITIGATED',
] as const);

export type CoreEngineEventName = (typeof CORE_ENGINE_EVENT_NAMES)[number];

// ── Tick tier metadata ────────────────────────────────────────────────────────
// Mirrors the TICK_DURATION_MS_BY_TIER table from time/types for consumers
// that only depend on core (not the full time engine).

export const CORE_ENGINE_TICK_TIERS = Object.freeze([
  'T0',
  'T1',
  'T2',
  'T3',
  'T4',
] as const);

export type CoreEngineTierId = (typeof CORE_ENGINE_TICK_TIERS)[number];

const _CORE_ENGINE_TIER_LABELS_BASE: Record<CoreEngineTierId, string> = {
  T0: 'SOVEREIGN',
  T1: 'STABLE',
  T2: 'COMPRESSED',
  T3: 'CRISIS',
  T4: 'COLLAPSE_IMMINENT',
};
export const CORE_ENGINE_TIER_LABELS = Object.freeze(_CORE_ENGINE_TIER_LABELS_BASE);

// ── Architecture laws ─────────────────────────────────────────────────────────

export const CORE_ENGINE_ARCHITECTURE_LAWS = Object.freeze([
  'All engines read from RunStateSnapshot — never from live state.',
  'EventBus defers emits — no synchronous side effects during tick execution.',
  'EngineOrchestrator is the sole writer of tick lifecycle state.',
  'ClockSource is injected — engines never call Date.now() directly.',
  'OrchestratorDiagnostics never mutates gameplay state.',
  'EngineEventBindings (store wiring) is excluded from the core barrel.',
  'Circular import from store → core is forbidden.',
  'No engine imports another engine. All inter-engine data passes through RunStateSnapshot.',
] as const);

// ── Trust boundaries ──────────────────────────────────────────────────────────

export const CORE_ENGINE_TRUST_BOUNDARIES = Object.freeze({
  coreOwns: Object.freeze([
    'tick lifecycle coordination',
    'EventBus pub/sub routing',
    'RunStateSnapshot assembly and freeze',
    'clock abstraction and determinism',
    'engine orchestration step sequencing',
    'diagnostics and drift telemetry',
  ] as const),
  storeOwns: Object.freeze([
    'Zustand state persistence',
    'React subscription surfaces',
    'optimistic UI deltas',
    'store-level event binding (EngineEventBindings)',
  ] as const),
  enginesOwn: Object.freeze([
    'domain logic for each of the 7 engines',
    'self-contained state that does not cross engine boundaries',
    'event emission for their own domain events',
  ] as const),
} as const);

// ── Lazy loader contracts ─────────────────────────────────────────────────────
// Callers that need code-splitting can use these for dynamic imports.

export const CORE_ENGINE_LAZY_LOADERS = Object.freeze({
  EventBus:               () => import('./EventBus'),
  types:                  () => import('./types'),
  ClockSource:            () => import('./ClockSource'),
  RunStateSnapshot:       () => import('./RunStateSnapshot'),
  OrchestratorDiagnostics: () => import('./OrchestratorDiagnostics'),
  EngineOrchestrator:     () => import('./EngineOrchestrator'),
  // Loaded separately — has store dependency, not part of the main barrel
  EngineEventBindings:    () => import('./EngineEventBindings'),
} as const);

export type CoreEngineLazyLoaderKey = keyof typeof CORE_ENGINE_LAZY_LOADERS;

// ── Public manifest ───────────────────────────────────────────────────────────

export const CORE_ENGINE_PUBLIC_MANIFEST = Object.freeze({
  moduleName:           CORE_ENGINE_MODULE_NAME,
  packageKind:          CORE_ENGINE_PACKAGE_KIND,
  runtimeTier:          CORE_ENGINE_RUNTIME_TIER,
  barrelVersion:        CORE_ENGINE_BARREL_VERSION,
  componentCount:       CORE_ENGINE_COMPONENT_COUNT,
  presentFiles:         CORE_ENGINE_PRESENT_FILES,
  barrelExports:        CORE_ENGINE_BARREL_EXPORTS,
  excludedFromBarrel:   CORE_ENGINE_EXCLUDED_FROM_BARREL,
  eventNames:           CORE_ENGINE_EVENT_NAMES,
  tickTiers:            CORE_ENGINE_TICK_TIERS,
  tierLabels:           CORE_ENGINE_TIER_LABELS,
  architectureLaws:     CORE_ENGINE_ARCHITECTURE_LAWS,
  trustBoundaries:      CORE_ENGINE_TRUST_BOUNDARIES,
} as const);

// ── Default export ────────────────────────────────────────────────────────────

export default CoreEngineModule;
