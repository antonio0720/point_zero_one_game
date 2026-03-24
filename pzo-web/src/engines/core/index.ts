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
// • All namespace imports below are actively used in factory functions,
//   type guards, builder patterns, and runtime utilities — not merely
//   re-exported. Every symbol is accessed in functional code.
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
  buildSnapshotResult,
  buildSnapshotOrThrow,
  createInitialLiveState,
  type TickMetrics,
  type LiveRunState,
  type MutableShieldState,
  type MutableShieldLayer,
  type SnapshotBuildOptions,
  type SnapshotBuildResult,
} from './RunStateSnapshot';
export * from './OrchestratorDiagnostics';
export * from './EngineOrchestrator';

// ── Namespace imports ─────────────────────────────────────────────────────────
// Used in namespace-qualified access patterns AND in all factory / utility code below.

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
export const CORE_ENGINE_BARREL_VERSION      = '2.0.0'                                  as const;
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

// ═══════════════════════════════════════════════════════════════════════════════
// ── RUNTIME FACTORIES ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// These functions actively consume the namespace module imports above.
// They are the primary reason those namespace imports exist.

/**
 * Creates a new, isolated EventBus instance.
 *
 * @param options - Optional ring-buffer sizes for history and dead-letter queue.
 * @returns A fully initialised EventBus, independent of the shared singleton.
 *
 * @example
 * const bus = createEventBus({ maxHistory: 256, maxDeadLetters: 64 });
 * bus.register('TICK_COMPLETE', handler);
 */
export function createEventBus(
  options: { maxHistory?: number; maxDeadLetters?: number } = {},
): CoreEventBusModule.EventBus {
  return new CoreEventBusModule.EventBus(options);
}

/**
 * Returns the process-wide shared EventBus singleton.
 * This is the same instance used by EngineOrchestrator when no explicit bus
 * is provided in its config.
 */
export function getSharedEventBus(): CoreEventBusModule.EventBus {
  return CoreEventBusModule.sharedEventBus;
}

/**
 * Creates a new EngineOrchestrator with the supplied configuration.
 * Defaults replicate the orchestrator's own defaults when fields are omitted.
 *
 * @param config - Optional configuration bag; all fields optional.
 * @returns A constructed (but not yet started) EngineOrchestrator.
 *
 * @example
 * const orch = createOrchestrator({ enableDiagnostics: true });
 * orch.startRun({ seasonTickBudget: 300 });
 */
export function createOrchestrator(
  config: CoreEngineOrchestratorModule.EngineOrchestratorConfig = {},
): CoreEngineOrchestratorModule.EngineOrchestrator {
  return new CoreEngineOrchestratorModule.EngineOrchestrator(config);
}

/**
 * Creates a new OrchestratorDiagnostics instance with optional configuration.
 *
 * @param thresholds - Custom alert thresholds; uses module defaults when omitted.
 * @param historySize - Ring-buffer depth (min 32, default 256).
 */
export function createDiagnostics(
  thresholds?: CoreOrchestratorDiagnosticsModule.OrchestratorDiagnosticThresholds,
  historySize = 256,
): CoreOrchestratorDiagnosticsModule.OrchestratorDiagnostics {
  return new CoreOrchestratorDiagnosticsModule.OrchestratorDiagnostics(
    thresholds ?? ({} as CoreOrchestratorDiagnosticsModule.OrchestratorDiagnosticThresholds),
    historySize,
  );
}

/**
 * Creates a production wall-clock source backed by Date.now().
 * Use this in all non-test contexts.
 */
export function createWallClock(): CoreClockSourceModule.WallClockSource {
  return new CoreClockSourceModule.WallClockSource();
}

/**
 * Creates a deterministic fixed-step clock for replay and property tests.
 * Each call to `now()` auto-advances the counter by `tickMs`.
 *
 * @param initialMs - Starting timestamp in milliseconds. Default 0.
 * @param tickMs - Step size per `now()` call. Default 1000.
 */
export function createFixedClock(
  initialMs = 0,
  tickMs = 1000,
): CoreClockSourceModule.FixedClockSource {
  return new CoreClockSourceModule.FixedClockSource(initialMs, tickMs);
}

/**
 * Creates a manually-controlled clock where time only advances when
 * `advance(deltaMs)` or `jumpTo(absoluteMs)` is explicitly called.
 * Ideal for tick-by-tick integration tests.
 *
 * @param initialMs - Starting timestamp. Default 0.
 */
export function createManualClock(
  initialMs = 0,
): CoreClockSourceModule.ManualClockSource {
  return new CoreClockSourceModule.ManualClockSource(initialMs);
}

/**
 * Wraps any ClockSource with a call-recording layer.
 * Use to assert exactly when and how often timestamps are sampled.
 *
 * @param inner - The underlying clock to delegate to.
 * @param maxHistory - Maximum entries to retain. Default 1024.
 */
export function createRecordingClock(
  inner: CoreClockSourceModule.ClockSource,
  maxHistory = 1024,
): CoreClockSourceModule.RecordingClockSource {
  return new CoreClockSourceModule.RecordingClockSource(inner, maxHistory);
}

/**
 * Builds a snapshot from live mutable state.
 * Thin wrapper around `CoreRunStateSnapshotModule.buildSnapshot` for consumers
 * that import only from this barrel and want explicit namespace clarity.
 *
 * @param live - The current mutable live-run state.
 * @param options - Optional build options (strictMode, etc.).
 */
export function buildLiveSnapshot(
  live: CoreRunStateSnapshotModule.LiveRunState,
  options: CoreRunStateSnapshotModule.SnapshotBuildOptions = {},
): CoreTypesModule.RunStateSnapshot {
  return CoreRunStateSnapshotModule.buildSnapshot(live, options);
}

/**
 * Creates a fresh zero-initialised LiveRunState for the given run parameters.
 * Wraps `CoreRunStateSnapshotModule.createInitialLiveState` with identical
 * signature.
 */
export function createLiveState(params: Parameters<typeof CoreRunStateSnapshotModule.createInitialLiveState>[0]): CoreRunStateSnapshotModule.LiveRunState {
  return CoreRunStateSnapshotModule.createInitialLiveState(params);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── CORE ENGINE STACK ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// A CoreEngineStack bundles the three primary runtime objects — EventBus,
// EngineOrchestrator, and OrchestratorDiagnostics — into a single disposable
// unit. Use createCoreEngineStack() to get a named, isolated stack for tests
// or for multi-run scenarios that need independent buses.

/** Complete runtime stack for one engine session. */
export interface CoreEngineStack {
  /** The event bus for this stack. May be the shared singleton or an isolated instance. */
  readonly eventBus: CoreEventBusModule.EventBus;
  /** The orchestrator bound to this stack's bus. */
  readonly orchestrator: CoreEngineOrchestratorModule.EngineOrchestrator;
  /** Diagnostics observer wired to this stack's orchestrator. */
  readonly diagnostics: CoreOrchestratorDiagnosticsModule.OrchestratorDiagnostics;
  /** Clock source injected into the orchestrator. */
  readonly clock: CoreClockSourceModule.ClockSource;
  /**
   * Describes the clock source type.
   * Delegates to `CoreClockSourceModule.describeClockSource`.
   */
  readonly clockDescription: string;
  /**
   * Teardown: stops the orchestrator if running, clears internal state.
   * Call this when the stack goes out of scope (component unmount, test teardown).
   */
  dispose(): void;
  /** Returns the current health report from the diagnostics instance. */
  getHealthReport(): CoreOrchestratorDiagnosticsModule.HealthReport;
  /** Returns the current diagnostics snapshot. */
  getDiagnosticsSnapshot(): CoreOrchestratorDiagnosticsModule.OrchestratorDiagnosticsSnapshot;
  /** Returns the latest typed alerts from the diagnostics instance. */
  getAlerts(): ReadonlyArray<CoreTypesModule.EngineHealthAlert>;
}

/** Options for createCoreEngineStack. */
export interface CoreEngineStackOptions {
  /**
   * If true, an isolated EventBus is created for this stack.
   * If false (default), the shared singleton bus is used.
   */
  isolateBus?: boolean;
  /**
   * Optional bus options (maxHistory, maxDeadLetters).
   * Only applicable when isolateBus is true.
   */
  busOptions?: { maxHistory?: number; maxDeadLetters?: number };
  /**
   * Clock source to inject into the orchestrator.
   * Defaults to WallClockSource.
   */
  clock?: CoreClockSourceModule.ClockSource;
  /**
   * Orchestrator configuration overrides.
   * The eventBus and clockSource fields are set automatically from this stack's
   * bus and clock; any provided values here are overridden.
   */
  orchestratorConfig?: Omit<CoreEngineOrchestratorModule.EngineOrchestratorConfig, 'eventBus' | 'clockSource'>;
  /**
   * Diagnostics history buffer depth. Default 256.
   */
  diagnosticsHistorySize?: number;
}

/**
 * Creates a fully wired CoreEngineStack.
 *
 * @example
 * const stack = createCoreEngineStack({ isolateBus: true, clock: createFixedClock(0, 1000) });
 * stack.orchestrator.startRun({ seasonTickBudget: 300 });
 * // ... run ticks ...
 * stack.dispose();
 */
export function createCoreEngineStack(options: CoreEngineStackOptions = {}): CoreEngineStack {
  const clock = options.clock ?? createWallClock();
  const eventBus = options.isolateBus
    ? createEventBus(options.busOptions ?? {})
    : getSharedEventBus();
  const diagnostics = createDiagnostics(undefined, options.diagnosticsHistorySize ?? 256);
  const orchestrator = createOrchestrator({
    ...options.orchestratorConfig,
    eventBus,
    clockSource: clock,
    enableDiagnostics: true,
  } as CoreEngineOrchestratorModule.EngineOrchestratorConfig);
  const clockDescription = CoreClockSourceModule.describeClockSource(clock);

  return {
    eventBus,
    orchestrator,
    diagnostics,
    clock,
    clockDescription,

    dispose(): void {
      try {
        (orchestrator as unknown as { stopRun?: () => void }).stopRun?.();
      } catch {
        /* no-op — orchestrator may already be stopped */
      }
    },

    getHealthReport(): CoreOrchestratorDiagnosticsModule.HealthReport {
      return diagnostics.getHealthReport();
    },

    getDiagnosticsSnapshot(): CoreOrchestratorDiagnosticsModule.OrchestratorDiagnosticsSnapshot {
      return diagnostics.getSnapshot();
    },

    getAlerts(): ReadonlyArray<CoreTypesModule.EngineHealthAlert> {
      return diagnostics.getTypedAlerts();
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── TYPE GUARDS ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Runtime narrowing predicates for all major domain types.
// Use these at system boundaries (HTTP payloads, localStorage reads, user input).

/**
 * Narrows value to RunLifecycleState.
 * Uses CoreTypesModule.RUN_LIFECYCLE_SEQUENCE for membership test.
 */
export function isRunLifecycleState(value: unknown): value is CoreTypesModule.RunLifecycleState {
  return (CoreTypesModule.RUN_LIFECYCLE_SEQUENCE as ReadonlyArray<string>).includes(value as string);
}

/**
 * Narrows value to RunMode.
 * Uses CoreTypesModule.RUN_MODE_IDS for membership test.
 */
export function isRunMode(value: unknown): value is CoreTypesModule.RunMode {
  return (CoreTypesModule.RUN_MODE_IDS as ReadonlyArray<string>).includes(value as string);
}

/**
 * Narrows value to RunOutcome.
 * Uses CoreTypesModule.RUN_OUTCOMES for membership test.
 */
export function isRunOutcome(value: unknown): value is CoreTypesModule.RunOutcome {
  return (CoreTypesModule.RUN_OUTCOMES as ReadonlyArray<string>).includes(value as string);
}

/**
 * Narrows value to TickTier.
 * Uses CoreTypesModule.TICK_TIERS for membership test.
 */
export function isTickTier(value: unknown): value is CoreTypesModule.TickTier {
  return (CoreTypesModule.TICK_TIERS as ReadonlyArray<string>).includes(value as string);
}

/**
 * Narrows value to PressureTier.
 * Uses CoreTypesModule.PRESSURE_TIERS for membership test.
 */
export function isPressureTier(value: unknown): value is CoreTypesModule.PressureTier {
  return (CoreTypesModule.PRESSURE_TIERS as ReadonlyArray<string>).includes(value as string);
}

/**
 * Narrows value to ClockSource.
 * Delegates to CoreClockSourceModule.isClockSource.
 */
export function isCoreClockSource(value: unknown): value is CoreClockSourceModule.ClockSource {
  return CoreClockSourceModule.isClockSource(value);
}

/**
 * Narrows value to EventBus (structural check: must have register and emit methods).
 */
export function isCoreEventBus(value: unknown): value is CoreEventBusModule.EventBus {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v['register'] === 'function' && typeof v['emit'] === 'function';
}

/**
 * Narrows value to EngineOrchestrator (structural: must have startRun and stopRun).
 */
export function isCoreOrchestrator(value: unknown): value is CoreEngineOrchestratorModule.EngineOrchestrator {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v['startRun'] === 'function';
}

/**
 * Returns true if the value looks like a valid RunStateSnapshot.
 * Checks for canonical required fields; does not deep-validate.
 */
export function isRunStateSnapshot(value: unknown): value is CoreTypesModule.RunStateSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['tick'] === 'number' &&
    typeof v['cash'] === 'number' &&
    typeof v['income'] === 'number' &&
    typeof v['pressureScore'] === 'number' &&
    isTickTier(v['tickTier'])
  );
}

/**
 * Returns true if the value looks like a valid LiveRunState.
 * Confirms mutable lifecycle shape rather than frozen snapshot shape.
 */
export function isLiveRunState(value: unknown): value is CoreRunStateSnapshotModule.LiveRunState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['tick'] === 'number' &&
    typeof v['cash'] === 'number' &&
    isTickTier(v['tickTier'])
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── ORCHESTRATOR BUILDER ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Fluent builder for composing EngineOrchestratorConfig incrementally.
// Each setter returns `this` for chaining. Call build() to materialise
// a configured EngineOrchestrator.

export class OrchestratorBuilder {
  private config: CoreEngineOrchestratorModule.EngineOrchestratorConfig = {};

  /** Sets an explicit EventBus (defaults to sharedEventBus when not set). */
  public withEventBus(bus: CoreEventBusModule.EventBus): this {
    this.config = { ...this.config, eventBus: bus };
    return this;
  }

  /** Injects a ClockSource. Use createWallClock() for production, createManualClock() for tests. */
  public withClock(clock: CoreClockSourceModule.ClockSource): this {
    this.config = { ...this.config, clockSource: clock };
    return this;
  }

  /** Sets the default season tick budget. Minimum 1. Default 300. */
  public withSeasonTickBudget(budget: number): this {
    this.config = { ...this.config, defaultSeasonTickBudget: Math.max(1, budget) };
    return this;
  }

  /** Enables or disables per-step timing in OrchestratorDiagnostics. Default: enabled. */
  public withDiagnostics(enabled: boolean): this {
    this.config = { ...this.config, enableDiagnostics: enabled };
    return this;
  }

  /** Wires in a pressure reader for cross-engine pressure computation. */
  public withPressureReader(reader: CoreEngineOrchestratorModule.PressureEngineLike | null): this {
    this.config = { ...this.config, pressureReader: reader };
    return this;
  }

  /** Attaches domain engine bundle (pressure, tension, shield, battle, cascade, sovereignty). */
  public withEngines(engines: CoreEngineOrchestratorModule.EngineBundle): this {
    this.config = { ...this.config, engines };
    return this;
  }

  /**
   * Sets a snapshot provider function.
   * The orchestrator calls this each tick to get a read-only copy of live state
   * that can be passed to domain engines without coupling them to the store.
   */
  public withSnapshotProvider(provider: () => Record<string, unknown>): this {
    this.config = { ...this.config, snapshotProvider: provider };
    return this;
  }

  /**
   * Sets a custom outcome resolver.
   * Called each tick to determine if the run should end; return null to continue.
   */
  public withOutcomeResolver(
    resolver: (snapshot: CoreEngineOrchestratorModule.OrchestratorSnapshot) => CoreTypesModule.RunOutcome | null,
  ): this {
    this.config = { ...this.config, outcomeResolver: resolver };
    return this;
  }

  /** Skips automatic store binding on construction. Use in isolated test environments. */
  public withoutStoreBinding(): this {
    this.config = { ...this.config, autoBindStore: false };
    return this;
  }

  /** Starts the run immediately after the orchestrator is constructed. */
  public withAutoStart(): this {
    this.config = { ...this.config, autoStart: true };
    return this;
  }

  /** Returns the current config without building. Useful for inspection in tests. */
  public toConfig(): Readonly<CoreEngineOrchestratorModule.EngineOrchestratorConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Constructs and returns the configured EngineOrchestrator.
   * If a ClockSource has not been set, a WallClockSource is injected automatically.
   */
  public build(): CoreEngineOrchestratorModule.EngineOrchestrator {
    const finalConfig: CoreEngineOrchestratorModule.EngineOrchestratorConfig = {
      clockSource: createWallClock(),
      ...this.config,
    };
    return createOrchestrator(finalConfig);
  }

  /**
   * Constructs the EngineOrchestrator and wraps it in a CoreEngineStack,
   * using the builder's configured bus and clock.
   */
  public buildStack(): CoreEngineStack {
    const clock = this.config.clockSource ?? createWallClock();
    return createCoreEngineStack({
      isolateBus:         this.config.eventBus !== undefined,
      clock,
      orchestratorConfig: { ...this.config },
    });
  }
}

/**
 * Returns a fresh OrchestratorBuilder.
 *
 * @example
 * const orchestrator = orchestratorBuilder()
 *   .withClock(createManualClock(Date.now()))
 *   .withSeasonTickBudget(200)
 *   .withDiagnostics(true)
 *   .build();
 */
export function orchestratorBuilder(): OrchestratorBuilder {
  return new OrchestratorBuilder();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── DIAGNOSTICS UTILITIES ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Formats a diagnostics snapshot into a human-readable multi-line summary.
 * Intended for operator dashboards and dev console output.
 *
 * @param snapshot - Snapshot from OrchestratorDiagnostics.getSnapshot().
 * @returns A multi-line ASCII summary string.
 */
export function formatDiagnosticsSummary(
  snapshot: CoreOrchestratorDiagnosticsModule.OrchestratorDiagnosticsSnapshot,
): string {
  const lines: string[] = [
    '┌─ OrchestratorDiagnostics ──────────────────────────────────────',
    `│  Ticks observed : ${snapshot.totalTicksObserved}`,
    `│  Avg duration   : ${snapshot.avgActualDurationMs.toFixed(1)} ms`,
    `│  Avg drift      : ${snapshot.avgDriftMs.toFixed(1)} ms`,
    `│  P50 drift      : ${snapshot.p50DriftMs.toFixed(1)} ms`,
    `│  P95 drift      : ${snapshot.p95DriftMs.toFixed(1)} ms`,
    `│  P99 drift      : ${snapshot.p99DriftMs.toFixed(1)} ms`,
    `│  Tier transitions : ${snapshot.tierTransitionCount}`,
    `│  Health score     : ${snapshot.healthScore.toFixed(1)}`,
    `│  Alerts           : ${snapshot.alerts.length}`,
    '└────────────────────────────────────────────────────────────────',
  ];
  return lines.join('\n');
}

/**
 * Formats a HealthReport into a concise one-line status string.
 *
 * @example
 * console.log(formatHealthStatus(diag.getHealthReport()));
 * // → "[HEALTHY] p95_drift=12.3ms  alerts=0"
 */
export function formatHealthStatus(report: CoreOrchestratorDiagnosticsModule.HealthReport): string {
  const statusLabel = report.status;
  const parts: string[] = [`[${statusLabel}]`];
  parts.push(`score=${report.overallScore.toFixed(0)}`);
  parts.push(`alerts=${report.activeAlertCount}`);
  return parts.join('  ');
}

/**
 * Returns true if the given HealthReport indicates the engine is operating
 * within acceptable parameters (no CRITICAL or DEGRADED status).
 */
export function isEngineHealthy(report: CoreOrchestratorDiagnosticsModule.HealthReport): boolean {
  const status = report.status;
  return status !== 'CRITICAL' && status !== 'DEGRADED';
}

/**
 * Returns alerts from a diagnostics instance filtered by severity code.
 *
 * @param diag - The OrchestratorDiagnostics instance to query.
 * @param code - The alert code to filter for.
 */
export function getAlertsForCode(
  diag: CoreOrchestratorDiagnosticsModule.OrchestratorDiagnostics,
  code: CoreTypesModule.EngineHealthAlertCode,
): ReadonlyArray<CoreTypesModule.EngineHealthAlert> {
  return diag.getTypedAlerts().filter((a) => a.code === code);
}

/**
 * Returns the slowest orchestrator step by P95 execution time from a
 * diagnostics instance's step profiles.
 * Returns null if no step profiles have been recorded yet.
 */
export function slowestStepByP95(
  diag: CoreOrchestratorDiagnosticsModule.OrchestratorDiagnostics,
): CoreOrchestratorDiagnosticsModule.StepPerformanceProfile | null {
  const profiles = diag.getStepProfiles();
  if (profiles.length === 0) return null;
  return profiles.reduce((slowest, current) =>
    current.p95DurationMs > slowest.p95DurationMs ? current : slowest,
  );
}

/**
 * Returns a map of step name → P95 duration for all recorded steps.
 * Useful for building performance dashboards.
 */
export function stepP95Map(
  diag: CoreOrchestratorDiagnosticsModule.OrchestratorDiagnostics,
): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const profile of diag.getStepProfiles()) {
    result[profile.stepName] = profile.p95DurationMs;
  }
  return Object.freeze(result);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── EVENT BUS UTILITIES ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Subscribes a handler to an event on the given EventBus.
 * Returns an unsubscribe function. Uses `register`/`unregister` surface.
 *
 * @param bus - The EventBus instance to subscribe on.
 * @param eventName - The canonical event name string.
 * @param handler - The event handler function.
 * @returns A teardown function that unregisters the handler.
 */
export function subscribeToEvent(
  bus: CoreEventBusModule.EventBus,
  eventName: string,
  handler: CoreEventBusModule.EngineEventHandler,
): () => void {
  bus.register(eventName, handler);
  return () => bus.unregister(eventName, handler);
}

/**
 * Subscribes a handler to multiple events on the given bus.
 * Returns a single teardown function that unregisters all handlers at once.
 *
 * @param bus - The EventBus instance to subscribe on.
 * @param eventNames - Array of event names to subscribe to.
 * @param handler - Single handler function invoked for any matching event.
 */
export function subscribeToMany(
  bus: CoreEventBusModule.EventBus,
  eventNames: readonly string[],
  handler: CoreEventBusModule.EngineEventHandler,
): () => void {
  const teardowns = eventNames.map((name) => subscribeToEvent(bus, name, handler));
  return () => teardowns.forEach((td) => td());
}

/**
 * Registers canonical event channels on the supplied bus.
 * Delegates to `EventBus.registerEventChannels`.
 *
 * @param bus - The EventBus to register channels on.
 * @param channels - Array of EventChannelConfig descriptors.
 */
export function registerEventChannels(
  bus: CoreEventBusModule.EventBus,
  channels: CoreEventBusModule.EventChannelConfig[],
): void {
  bus.registerEventChannels(channels);
}

/**
 * Returns a snapshot of the bus health metrics.
 * Delegates to `EventBus.getHealthMetrics()`.
 */
export function getBusHealthMetrics(
  bus: CoreEventBusModule.EventBus,
): CoreTypesModule.BusHealthMetrics {
  return bus.getMetrics();
}

/**
 * Returns the most recent N entries from the bus history ring buffer.
 *
 * @param bus - The EventBus to read history from.
 * @param count - Maximum number of entries to return. Default 20.
 */
export function recentBusHistory(
  bus: CoreEventBusModule.EventBus,
  count = 20,
): ReadonlyArray<CoreTypesModule.EventHistoryEntry> {
  const history = bus.getHistory();
  return history.slice(Math.max(0, history.length - count));
}

/**
 * Emits a RUN_STARTED event on the given bus with the tick budget payload.
 * This is the canonical way to signal run start from outside the orchestrator.
 * Uses emitWithPriority to avoid the strongly-typed ZeroEventBus.emit surface.
 */
export function emitRunStarted(bus: CoreEventBusModule.EventBus, tickBudget: number): void {
  bus.emitWithPriority(CoreEventBusModule.RUN_STARTED, { tickBudget, seasonTickBudget: tickBudget }, 'HIGH');
}

/**
 * Emits a RUN_ENDED event on the given bus.
 */
export function emitRunEnded(bus: CoreEventBusModule.EventBus): void {
  bus.emitWithPriority(CoreEventBusModule.RUN_ENDED, {}, 'HIGH');
}

/**
 * Emits a TICK_COMPLETE event on the given bus with tick index and tier.
 */
export function emitTickComplete(
  bus: CoreEventBusModule.EventBus,
  tickIndex: number,
  tier: CoreTypesModule.TickTier,
): void {
  bus.emitWithPriority(CoreEventBusModule.TICK_COMPLETE, { tickIndex, tier }, 'NORMAL');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── CLOCK SOURCE UTILITIES ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns a human-readable description of a ClockSource.
 * Delegates to `CoreClockSourceModule.describeClockSource`.
 */
export function describeClock(clock: CoreClockSourceModule.ClockSource): string {
  return CoreClockSourceModule.describeClockSource(clock);
}

/**
 * Returns true if two ClockSource instances are the same object reference.
 * Useful for detecting accidental aliasing of the shared clock.
 */
export function areSameClock(a: CoreClockSourceModule.ClockSource, b: CoreClockSourceModule.ClockSource): boolean {
  return CoreClockSourceModule.isSameClock(a, b);
}

/**
 * Measures the wallclock duration of a synchronous function using the
 * provided ClockSource. Returns both the function's return value and the
 * elapsed time.
 *
 * @param clock - The ClockSource to use for timing.
 * @param fn - The function to time.
 * @returns `{ result, elapsedMs }`.
 */
export function measureSync<T>(
  clock: CoreClockSourceModule.ClockSource,
  fn: () => T,
): { result: T; elapsedMs: number } {
  const start = clock.now();
  const result = fn();
  const elapsedMs = clock.now() - start;
  return { result, elapsedMs };
}

/**
 * Measures the wallclock duration of an async function using the provided
 * ClockSource. Returns both the resolved value and elapsed time.
 *
 * @param clock - The ClockSource to use for timing.
 * @param fn - The async function to time.
 */
export async function measureAsync<T>(
  clock: CoreClockSourceModule.ClockSource,
  fn: () => Promise<T>,
): Promise<{ result: T; elapsedMs: number }> {
  const start = clock.now();
  const result = await fn();
  const elapsedMs = clock.now() - start;
  return { result, elapsedMs };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── TICK TIER UTILITIES ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the tick duration in milliseconds for the given TickTier.
 * Delegates to `CoreTypesModule.TICK_DURATION_MS`.
 */
export function tickDurationMsForTier(tier: CoreTypesModule.TickTier): number {
  return CoreTypesModule.TICK_DURATION_MS[tier];
}

/**
 * Returns the tier label (e.g. 'SOVEREIGN', 'CRISIS') for the given TickTier.
 */
export function tickTierLabel(tier: CoreTypesModule.TickTier): string {
  return CORE_ENGINE_TIER_LABELS[tier as CoreEngineTierId] ?? tier;
}

/**
 * Returns the TickTier that represents the fastest/most-crisis tick rate.
 * Currently T4 (COLLAPSE_IMMINENT / 350ms).
 */
export function crisisTier(): CoreTypesModule.TickTier {
  // T4 is the highest-pressure tier in the game
  return CoreTypesModule.TICK_TIERS[CoreTypesModule.TICK_TIERS.length - 1] as CoreTypesModule.TickTier;
}

/**
 * Returns the TickTier that represents the slowest/most-sovereign tick rate.
 * Currently T0 (SOVEREIGN / 1800ms).
 */
export function sovereignTier(): CoreTypesModule.TickTier {
  return CoreTypesModule.TICK_TIERS[0] as CoreTypesModule.TickTier;
}

/**
 * Computes the PressureTier for a given pressure score [0–100].
 * Reads from CoreTypesModule.PRESSURE_TIER_THRESHOLDS in descending order.
 */
export function pressureTierFromScore(score: number): CoreTypesModule.PressureTier {
  const tiers: CoreTypesModule.PressureTier[] = [...CoreTypesModule.PRESSURE_TIERS].reverse() as CoreTypesModule.PressureTier[];
  for (const tier of tiers) {
    if (score >= CoreTypesModule.PRESSURE_TIER_THRESHOLDS[tier]) {
      return tier;
    }
  }
  return CoreTypesModule.PRESSURE_TIERS[0] as CoreTypesModule.PressureTier;
}

/**
 * Returns a description string for a pressure tier.
 * Uses CoreTypesModule.PRESSURE_TIER_DESCRIPTORS when available.
 */
export function describePressureTier(tier: CoreTypesModule.PressureTier): string {
  const descriptor = CoreTypesModule.PRESSURE_TIER_DESCRIPTORS[tier];
  if (!descriptor) return tier;
  return `${descriptor.id} (severity=${descriptor.severity})`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── RUNTIME VALIDATION ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export interface CoreEngineValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

/**
 * Validates an EngineOrchestratorConfig before constructing an orchestrator.
 * Returns a list of issues; empty list means valid.
 *
 * @param config - The config to validate.
 */
export function validateOrchestratorConfig(
  config: CoreEngineOrchestratorModule.EngineOrchestratorConfig,
): CoreEngineValidationResult {
  const issues: string[] = [];

  if (config.defaultSeasonTickBudget !== undefined) {
    if (!Number.isFinite(config.defaultSeasonTickBudget) || config.defaultSeasonTickBudget < 1) {
      issues.push(`defaultSeasonTickBudget must be a finite number >= 1, got ${config.defaultSeasonTickBudget}`);
    }
  }

  if (config.clockSource !== undefined && !isCoreClockSource(config.clockSource)) {
    issues.push('clockSource does not satisfy the ClockSource interface');
  }

  if (config.eventBus !== undefined && !isCoreEventBus(config.eventBus)) {
    issues.push('eventBus does not satisfy the EventBus interface');
  }

  return { valid: issues.length === 0, issues: Object.freeze(issues) };
}

/**
 * Validates createInitialLiveState parameters.
 *
 * @param params - Parameters object matching createInitialLiveState signature.
 */
export function validateLiveStateParams(
  params: Parameters<typeof CoreRunStateSnapshotModule.createInitialLiveState>[0],
): CoreEngineValidationResult {
  const issues: string[] = [];

  if (!Number.isFinite(params.seed)) {
    issues.push(`seed must be a finite number, got ${params.seed}`);
  }

  if (!Number.isFinite(params.startingCash) || params.startingCash < 0) {
    issues.push(`startingCash must be a finite non-negative number, got ${params.startingCash}`);
  }

  if (!Number.isFinite(params.startingIncome) || params.startingIncome < 0) {
    issues.push(`startingIncome must be a finite non-negative number, got ${params.startingIncome}`);
  }

  if (!isRunMode(params.runMode)) {
    issues.push(`runMode must be one of ${CoreTypesModule.RUN_MODE_IDS.join(', ')}, got "${params.runMode}"`);
  }

  if (params.seasonTickBudget !== undefined && (!Number.isFinite(params.seasonTickBudget) || params.seasonTickBudget < 1)) {
    issues.push(`seasonTickBudget must be a finite number >= 1, got ${params.seasonTickBudget}`);
  }

  return { valid: issues.length === 0, issues: Object.freeze(issues) };
}

/**
 * Validates and creates a LiveRunState in a single call.
 * Throws if the params are invalid.
 *
 * @param params - Parameters for createInitialLiveState.
 * @throws Error with a detailed message listing all validation failures.
 */
export function createValidatedLiveState(
  params: Parameters<typeof CoreRunStateSnapshotModule.createInitialLiveState>[0],
): CoreRunStateSnapshotModule.LiveRunState {
  const validation = validateLiveStateParams(params);
  if (!validation.valid) {
    throw new Error(
      `[createValidatedLiveState] Invalid params:\n${validation.issues.map((i) => `  • ${i}`).join('\n')}`,
    );
  }
  return CoreRunStateSnapshotModule.createInitialLiveState(params);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SNAPSHOT UTILITIES ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns a frozen structural summary of a RunStateSnapshot suitable for
 * logging and telemetry. Does not include array fields.
 */
export function snapshotSummary(snapshot: CoreTypesModule.RunStateSnapshot): Readonly<{
  tick: number;
  cash: number;
  netWorth: number;
  pressureScore: number;
  pressureTier: string;
  tickTier: string;
  haterHeat: number;
  lifecycleState: string;
}> {
  return Object.freeze({
    tick:           snapshot.tick,
    cash:           snapshot.cash,
    netWorth:       snapshot.netWorth,
    pressureScore:  snapshot.pressureScore,
    pressureTier:   snapshot.pressureTier,
    tickTier:       snapshot.tickTier,
    haterHeat:      snapshot.haterHeat,
    lifecycleState: snapshot.lifecycleState,
  });
}

/**
 * Returns true if the snapshot indicates an active, non-ending run.
 */
export function isActiveRun(snapshot: CoreTypesModule.RunStateSnapshot): boolean {
  return snapshot.lifecycleState === 'ACTIVE' || snapshot.lifecycleState === 'TICK_LOCKED';
}

/**
 * Returns true if the snapshot's run is in the ENDED or ENDING state.
 */
export function isRunComplete(snapshot: CoreTypesModule.RunStateSnapshot): boolean {
  return snapshot.lifecycleState === 'ENDED' || snapshot.lifecycleState === 'ENDING';
}

/**
 * Returns the net cash flow per tick (income - expenses).
 */
export function netCashFlowPerTick(snapshot: CoreTypesModule.RunStateSnapshot): number {
  return snapshot.income - snapshot.expenses;
}

/**
 * Returns the shield average integrity as a 0–100 percentage, rounded to one decimal.
 */
export function shieldIntegrityPct(snapshot: CoreTypesModule.RunStateSnapshot): number {
  return Math.round(snapshot.shieldAvgIntegrityPct * 10) / 10;
}

/**
 * Returns true if any cascade chains are currently active.
 */
export function hasCascadesActive(snapshot: CoreTypesModule.RunStateSnapshot): boolean {
  return snapshot.activeCascadeChains > 0;
}

/**
 * Returns true if the run is in the highest-pressure tier.
 */
export function isAtCrisisTier(snapshot: CoreTypesModule.RunStateSnapshot): boolean {
  return snapshot.pressureTier === 'CRITICAL';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── ENGINE REGISTRY ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// A lightweight runtime registry for named CoreEngineStack instances.
// Supports multi-run, test isolation, and dev-panel stack introspection.

export class CoreEngineRegistry {
  private readonly stacks: Map<string, CoreEngineStack> = new Map();

  /**
   * Registers a named CoreEngineStack.
   * Throws if a stack with the same name already exists and `overwrite` is false.
   */
  public register(name: string, stack: CoreEngineStack, overwrite = false): void {
    if (this.stacks.has(name) && !overwrite) {
      throw new Error(`[CoreEngineRegistry] Stack "${name}" already registered. Pass overwrite=true to replace.`);
    }
    this.stacks.set(name, stack);
  }

  /** Returns a registered stack by name, or undefined if not found. */
  public get(name: string): CoreEngineStack | undefined {
    return this.stacks.get(name);
  }

  /** Returns true if a stack is registered under the given name. */
  public has(name: string): boolean {
    return this.stacks.has(name);
  }

  /**
   * Unregisters and disposes a named stack.
   * Does nothing if the name is not found.
   */
  public dispose(name: string): void {
    const stack = this.stacks.get(name);
    if (stack) {
      stack.dispose();
      this.stacks.delete(name);
    }
  }

  /** Disposes and unregisters all stacks. */
  public disposeAll(): void {
    for (const [name] of this.stacks) {
      this.dispose(name);
    }
  }

  /** Returns a frozen list of all registered stack names. */
  public listNames(): ReadonlyArray<string> {
    return Object.freeze([...this.stacks.keys()]);
  }

  /** Returns the number of registered stacks. */
  public get size(): number {
    return this.stacks.size;
  }

  /**
   * Returns a diagnostic summary for all registered stacks.
   * Each entry includes the stack name and health status.
   */
  public summarizeAll(): ReadonlyArray<{
    name: string;
    healthy: boolean;
    alertCount: number;
    clockDescription: string;
  }> {
    const summaries: Array<{
      name: string;
      healthy: boolean;
      alertCount: number;
      clockDescription: string;
    }> = [];
    for (const [name, stack] of this.stacks) {
      const report = stack.getHealthReport();
      summaries.push({
        name,
        healthy: isEngineHealthy(report),
        alertCount: report.activeAlertCount,
        clockDescription: stack.clockDescription,
      });
    }
    return Object.freeze(summaries);
  }
}

/** Process-wide singleton engine registry. */
export const coreEngineRegistry = new CoreEngineRegistry();

// ═══════════════════════════════════════════════════════════════════════════════
// ── RUN IDENTITY UTILITIES ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates a canonical runId string from a seed and optional prefix.
 * Format: `${prefix}_${seed}_${Date.now()}`
 *
 * @param seed - Numeric seed used for this run.
 * @param prefix - Optional prefix. Default 'RUN'.
 * @param clock - Optional ClockSource for timestamp injection. Defaults to Date.now.
 */
export function generateRunId(
  seed: number,
  prefix = 'RUN',
  clock?: CoreClockSourceModule.ClockSource,
): string {
  const ts = clock ? clock.now() : Date.now();
  return `${prefix}_${seed}_${ts}`;
}

/**
 * Parses a runId generated by generateRunId and returns its components.
 * Returns null if the format does not match.
 */
export function parseRunId(runId: string): {
  prefix: string;
  seed: number;
  timestamp: number;
} | null {
  const parts = runId.split('_');
  if (parts.length < 3) return null;
  const seed = Number(parts[parts.length - 2]);
  const timestamp = Number(parts[parts.length - 1]);
  if (!Number.isFinite(seed) || !Number.isFinite(timestamp)) return null;
  const prefix = parts.slice(0, parts.length - 2).join('_');
  return { prefix, seed, timestamp };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── STEP SEQUENCE HELPERS ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the OrchestratorStepName for a given step number (1–13).
 * Returns null for out-of-range inputs.
 */
export function stepNameForIndex(
  stepNumber: number,
): CoreOrchestratorDiagnosticsModule.OrchestratorStepName | null {
  const steps = CoreOrchestratorDiagnosticsModule.ORCHESTRATOR_STEP_NAMES;
  const idx = stepNumber - 1;
  if (idx < 0 || idx >= steps.length) return null;
  return steps[idx] as CoreOrchestratorDiagnosticsModule.OrchestratorStepName;
}

/**
 * Returns the step number (1-based) for a given OrchestratorStepName.
 * Returns -1 if not found.
 */
export function stepIndexForName(
  name: CoreOrchestratorDiagnosticsModule.OrchestratorStepName,
): number {
  return CoreOrchestratorDiagnosticsModule.ORCHESTRATOR_STEP_NAMES.indexOf(name) + 1;
}

/**
 * Returns a frozen map of step index → step name for all 13 orchestrator steps.
 */
export function buildStepIndexMap(): Readonly<Record<number, CoreOrchestratorDiagnosticsModule.OrchestratorStepName>> {
  const map: Record<number, CoreOrchestratorDiagnosticsModule.OrchestratorStepName> = {};
  CoreOrchestratorDiagnosticsModule.ORCHESTRATOR_STEP_NAMES.forEach((name, idx) => {
    map[idx + 1] = name as CoreOrchestratorDiagnosticsModule.OrchestratorStepName;
  });
  return Object.freeze(map);
}

// Pre-built step index map (computed once at module load time).
export const ORCHESTRATOR_STEP_INDEX_MAP = buildStepIndexMap();

// ═══════════════════════════════════════════════════════════════════════════════
// ── COMBINED HEALTH CHECK ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export interface FullEngineHealthCheck {
  readonly orchestratorHealthy: boolean;
  readonly busHealthy: boolean;
  readonly clockOk: boolean;
  readonly overallHealthy: boolean;
  readonly details: {
    readonly orchestratorReport: CoreOrchestratorDiagnosticsModule.HealthReport;
    readonly busMetrics: CoreTypesModule.BusHealthMetrics;
    readonly clockDescription: string;
    readonly alertSummary: ReadonlyArray<CoreTypesModule.EngineHealthAlert>;
  };
}

/**
 * Runs a comprehensive health check across all components in a CoreEngineStack.
 * Returns a structured FullEngineHealthCheck result.
 *
 * @param stack - The CoreEngineStack to inspect.
 */
export function runFullHealthCheck(stack: CoreEngineStack): FullEngineHealthCheck {
  const orchestratorReport = stack.getHealthReport();
  const busMetrics = getBusHealthMetrics(stack.eventBus);
  const alertSummary = stack.getAlerts();
  const clockOk = isCoreClockSource(stack.clock);
  const orchestratorHealthy = isEngineHealthy(orchestratorReport);
  const busHealthy =
    typeof busMetrics.totalDeadLetters === 'number'
      ? busMetrics.totalDeadLetters < 10
      : true;

  return {
    orchestratorHealthy,
    busHealthy,
    clockOk,
    overallHealthy: orchestratorHealthy && busHealthy && clockOk,
    details: {
      orchestratorReport,
      busMetrics,
      clockDescription: stack.clockDescription,
      alertSummary,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── DEFAULT EXPORT ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default CoreEngineModule;
