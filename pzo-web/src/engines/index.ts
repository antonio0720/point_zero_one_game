// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MASTER ENGINES BARREL
// pzo-web/src/engines/index.ts
//
// Top-level import surface for the entire PZO engine stack.
//
// Architecture
// ────────────
//   engines/core   — tick orchestration, EventBus, RunStateSnapshot, ClockSource
//   engines/zero   — Engine 0 primitives, ZeroFacade, EngineRegistry
//   engines/chat   — Sovereign chat runtime (NPC, channels, memory, learning)
//
// Consumer guidance
// ─────────────────
//   • For core types only: import from 'engines/core'
//   • For chat engine only: import from 'engines/chat'
//   • For full stack access: import from 'engines' (this file)
//
// Circular import safety
// ──────────────────────
//   engines/chat/index.ts already imports engines/core for CoreEngineModule.
//   engines/index.ts imports from engines/chat and engines/core as siblings.
//   No circular dependency exists:
//     engines/core  does NOT import from engines/chat
//     engines/chat  does NOT import from engines/index
//     engines/index imports from engines/core AND engines/chat (leaf direction)
//
// Note on `export * from './chat'`
// ────────────────────────────────
//   engines/chat re-exports many core types (TickTier, PressureTier, etc.) because
//   chat/types.ts re-exports them for convenience. If we used `export * from './chat'`
//   here, TypeScript would see duplicate exports for those names. Instead, we expose
//   the chat engine under the `ChatEngineNamespace` alias and export specific named
//   symbols explicitly. Core types are the single source of truth from `export * from './core'`.
//
// Density6 LLC · Point Zero One · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

// ── Core engine — canonical export surface ────────────────────────────────────
// All types, utilities, factories, and constants from engines/core are available
// directly at the engines/ level without any namespace prefix.

export * from './core';

// ── Zero engine ───────────────────────────────────────────────────────────────
// Re-export ZeroFacade, EngineRegistry, and Engine 0 primitives.
// Note: zero/types.ts shares some type names with core/types.ts (RunLifecycleState,
// RunOutcome). Export selectively to avoid ambiguity.

export {
  sharedZeroFacade,
  zeroFacade,
} from './zero';

export type {
  ZeroFacade,
  ZeroRuntimeStatus,
  ZeroBoundState,
} from './zero';

// ── Chat engine — namespace export ────────────────────────────────────────────
// The full chat engine is accessible under ChatEngineNamespace.
// Specific high-value symbols are also exported flat for ergonomic access.

import * as ChatEngineNamespace from './chat';

export { ChatEngineNamespace };

export {
  // Engine lifecycle
  ChatEngineModule,
  ChatStateModule,
  ChatReducerModule,
  ChatSelectorsModule,
  ChatMountRegistryModule,
  ChatEventBridgeModule,
  // Identity constants
  CHAT_ENGINE_MODULE_NAME,
  CHAT_ENGINE_BARREL_VERSION,
  CHAT_ENGINE_RUNTIME_TIER,
  CHAT_ENGINE_PACKAGE_KIND,
  // Channel constants
  CHAT_ALL_CHANNELS,
  CHAT_VISIBLE_CHANNELS,
  CHAT_SHADOW_CHANNELS,
  CHAT_MOUNT_TARGETS,
  CHAT_MOUNT_PRESETS,
  CHAT_ENGINE_VERSION,
  CHAT_ENGINE_PUBLIC_API_VERSION,
  CHAT_ENGINE_CONSTANTS,
  CHAT_ENGINE_EVENT_NAMES,
  CHAT_ENGINE_AUTHORITIES,
  CHAT_MESSAGE_KINDS,
  CHAT_TYPES_NAMESPACE,
  // Channel utilities
  channelFamilyOf,
  isAnyChatChannel,
  isVisibleChatChannel,
  isShadowChatChannel,
  isLegendCandidateMessage,
  isReplayEligibleMessage,
  supportsComposerForChannel,
} from './chat';

export type {
  // Core chat interface types
  ChatEnginePublicApi,
  ChatEngineEvent,
  ChatEngineEventName,
  ChatMessage,
  ChatMessageId,
  ChatRoomId,
  ChatSessionId,
  ChatVisibleChannel,
  ChatConnectionState,
  ChatPresenceState,
  ChatTypingState,
  ChatNotificationState,
  ChatFeatureSnapshot,
  ChatAffectSnapshot,
  ChatAudienceHeat,
  ChatLearningProfile,
  ChatLiveOpsState,
  ChatScenePlan,
  ChatMountTarget,
  ChatInterventionId,
  ChatTelemetryEnvelope,
  ChatTelemetryEventName,
  ChatRevealSchedule,
  ChatRescueDecision,
  ChatSilenceDecision,
  ChatRunSnapshotReader,
  ChatBattleSnapshotReader,
  ChatMechanicsBridgeReader,
  ChatModeReader,
  GameChatContext,
} from './chat';

// ── Namespace imports (all used in factory/utility code below) ────────────────

import * as CoreEngines from './core';
import * as ZeroEngines from './zero';

// ═══════════════════════════════════════════════════════════════════════════════
// ── MODULE IDENTITY ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const ENGINES_MODULE_NAME         = 'PZO_ENGINES_MASTER_BARREL'     as const;
export const ENGINES_PACKAGE_KIND        = 'frontend-engines-master-barrel' as const;
export const ENGINES_RUNTIME_TIER        = 'frontend-engine-stack'          as const;
export const ENGINES_BARREL_VERSION      = '1.0.0'                          as const;

/** All engine subsystem identifiers. */
export const ENGINE_SUBSYSTEM_IDS = Object.freeze([
  'core',
  'zero',
  'chat',
  'battle',
  'cascade',
  'cards',
  'mechanics',
  'modes',
  'pressure',
  'shield',
  'sovereignty',
  'tension',
  'time',
] as const);

export type EngineSubsystemId = (typeof ENGINE_SUBSYSTEM_IDS)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// ── GAME ENGINE STACK ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// A GameEngineStack is the top-level runtime object for one PZO run session.
// It wraps the CoreEngineStack and provides cross-engine utilities.
// The chat engine is not part of the stack's dispose lifecycle — chat has its
// own independent lifecycle managed by the ChatMountRegistry.

/** Full game engine stack for one run session. */
export interface GameEngineStack {
  /** Core engine infrastructure: orchestrator, bus, diagnostics, clock. */
  readonly core: CoreEngines.CoreEngineStack;
  /** Human-readable description of the clock injected into the core. */
  readonly clockDescription: string;
  /** Canonical module name for logging and telemetry. */
  readonly moduleName: string;
  /** Stack creation timestamp in milliseconds. */
  readonly createdAtMs: number;
  /**
   * Starts the run with optional parameters.
   * Delegates to `core.orchestrator.startRun()`.
   */
  startRun(options?: CoreEngines.StartRunOptions): void;
  /**
   * Disposes all resources (orchestrator, diagnostics, bus if isolated).
   */
  dispose(): void;
  /**
   * Returns a combined health report across core components.
   */
  getHealth(): FullEngineHealthCheck;
  /**
   * Returns a snapshot of the current diagnostics.
   */
  getDiagnosticsSnapshot(): CoreEngines.OrchestratorDiagnosticsSnapshot;
  /**
   * Returns active health alerts.
   */
  getAlerts(): ReadonlyArray<CoreEngines.EngineHealthAlert>;
  /**
   * Returns a formatted summary string suitable for logging/telemetry.
   */
  formatSummary(): string;
}

/** Options for creating a GameEngineStack. */
export interface GameEngineStackOptions {
  /** Isolate the event bus from the shared singleton. Default: false. */
  isolateBus?: boolean;
  /** Clock source to inject. Defaults to WallClockSource. */
  clock?: CoreEngines.ClockSource;
  /** Season tick budget for the run. Default 300. */
  seasonTickBudget?: number;
  /** Whether to auto-start the run on stack creation. Default: false. */
  autoStart?: boolean;
  /** Domain engine bundle (pressure, tension, shield, battle, cascade, sovereignty). */
  engines?: CoreEngines.EngineBundle;
  /** Snapshot provider — called each tick to read live state. */
  snapshotProvider?: () => Record<string, unknown>;
  /** Custom outcome resolver. */
  outcomeResolver?: (snapshot: CoreEngines.OrchestratorSnapshot) => CoreEngines.RunOutcome | null;
  /** Diagnostics ring buffer depth. Default 256. */
  diagnosticsHistorySize?: number;
  /** Debug label for this stack (used in logs and health reports). */
  label?: string;
}

/**
 * Creates a fully wired GameEngineStack ready for a PZO run session.
 *
 * @example
 * const stack = createGameEngineStack({
 *   seasonTickBudget: 300,
 *   clock: createManualClock(Date.now()),
 * });
 * stack.startRun();
 * // ... run ticks ...
 * stack.dispose();
 */
export function createGameEngineStack(options: GameEngineStackOptions = {}): GameEngineStack {
  const clock    = options.clock ?? CoreEngines.createWallClock();
  const createdAtMs = clock.now();
  const label    = options.label ?? `GameEngineStack_${createdAtMs}`;

  const coreStack = CoreEngines.createCoreEngineStack({
    isolateBus:           options.isolateBus ?? false,
    clock,
    diagnosticsHistorySize: options.diagnosticsHistorySize ?? 256,
    orchestratorConfig: {
      defaultSeasonTickBudget: options.seasonTickBudget ?? 300,
      ...(options.engines !== undefined ? { engines: options.engines } : {}),
      ...(options.snapshotProvider !== undefined ? { snapshotProvider: options.snapshotProvider } : {}),
      ...(options.outcomeResolver !== undefined ? { outcomeResolver: options.outcomeResolver } : {}),
      autoStart: false,
      autoBindStore: true,
    } as CoreEngines.EngineOrchestratorConfig,
  });

  return {
    core:            coreStack,
    clockDescription: CoreEngines.describeClock(clock),
    moduleName:      `${ENGINES_MODULE_NAME}:${label}`,
    createdAtMs,

    startRun(startOptions?: CoreEngines.StartRunOptions): void {
      coreStack.orchestrator.startRun(startOptions ?? {});
    },

    dispose(): void {
      coreStack.dispose();
    },

    getHealth(): FullEngineHealthCheck {
      return CoreEngines.runFullHealthCheck(coreStack);
    },

    getDiagnosticsSnapshot(): CoreEngines.OrchestratorDiagnosticsSnapshot {
      return coreStack.getDiagnosticsSnapshot();
    },

    getAlerts(): ReadonlyArray<CoreEngines.EngineHealthAlert> {
      return coreStack.getAlerts();
    },

    formatSummary(): string {
      const snap = coreStack.getDiagnosticsSnapshot();
      const health = coreStack.getHealthReport();
      return [
        `[${label}] status=${health.status}  score=${health.overallScore.toFixed(0)}`,
        `  ticks=${snap.totalTicksObserved}  tier=${snap.currentTier ?? 'N/A'}`,
        `  drift_p95=${snap.p95DriftMs.toFixed(1)}ms  alerts=${snap.alerts.length}`,
        `  clock=${CoreEngines.describeClock(clock)}`,
      ].join('\n');
    },
  };
}

/**
 * Creates a GameEngineStack using the fluent OrchestratorBuilder pattern.
 * This is useful for complex configs where multiple `.withX()` calls are needed.
 *
 * @example
 * const stack = createGameEngineStackFromBuilder(
 *   orchestratorBuilder()
 *     .withSeasonTickBudget(200)
 *     .withClock(createManualClock(0))
 *     .withDiagnostics(true)
 * );
 */
export function createGameEngineStackFromBuilder(
  builder: CoreEngines.OrchestratorBuilder,
): GameEngineStack {
  const coreStack = builder.buildStack();
  const createdAtMs = Date.now();

  return {
    core:            coreStack,
    clockDescription: coreStack.clockDescription,
    moduleName:      `${ENGINES_MODULE_NAME}:builder_${createdAtMs}`,
    createdAtMs,

    startRun(options?: CoreEngines.StartRunOptions): void {
      coreStack.orchestrator.startRun(options ?? {});
    },

    dispose(): void {
      coreStack.dispose();
    },

    getHealth(): FullEngineHealthCheck {
      return CoreEngines.runFullHealthCheck(coreStack);
    },

    getDiagnosticsSnapshot(): CoreEngines.OrchestratorDiagnosticsSnapshot {
      return coreStack.getDiagnosticsSnapshot();
    },

    getAlerts(): ReadonlyArray<CoreEngines.EngineHealthAlert> {
      return coreStack.getAlerts();
    },

    formatSummary(): string {
      const snap = coreStack.getDiagnosticsSnapshot();
      const health = coreStack.getHealthReport();
      return (
        `[builder_stack] status=${health.status}  score=${health.overallScore.toFixed(0)}` +
        `  ticks=${snap.totalTicksObserved}  tier=${snap.currentTier ?? 'N/A'}`
      );
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── GAME ENGINE STACK REGISTRY ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// A runtime registry for named GameEngineStack instances.
// Wraps CoreEngineRegistry to provide GameEngineStack-level management.

export class GameEngineStackRegistry {
  private readonly stacks: Map<string, GameEngineStack> = new Map();

  /** Registers a named GameEngineStack. Throws if name is taken unless overwrite=true. */
  public register(name: string, stack: GameEngineStack, overwrite = false): void {
    if (this.stacks.has(name) && !overwrite) {
      throw new Error(`[GameEngineStackRegistry] Stack "${name}" already registered.`);
    }
    this.stacks.set(name, stack);
  }

  /** Returns a stack by name, or undefined. */
  public get(name: string): GameEngineStack | undefined {
    return this.stacks.get(name);
  }

  /** Returns true if a stack exists under this name. */
  public has(name: string): boolean {
    return this.stacks.has(name);
  }

  /** Disposes and removes a named stack. */
  public dispose(name: string): void {
    const stack = this.stacks.get(name);
    if (stack) {
      stack.dispose();
      this.stacks.delete(name);
    }
  }

  /** Disposes all stacks. */
  public disposeAll(): void {
    for (const name of [...this.stacks.keys()]) {
      this.dispose(name);
    }
  }

  /** Number of registered stacks. */
  public get size(): number {
    return this.stacks.size;
  }

  /** Returns a frozen list of all registered names. */
  public listNames(): ReadonlyArray<string> {
    return Object.freeze([...this.stacks.keys()]);
  }

  /**
   * Returns a health summary for all registered stacks.
   */
  public summarizeHealth(): ReadonlyArray<{
    name: string;
    status: string;
    score: number;
    alertCount: number;
    clockDescription: string;
    ticksObserved: number;
  }> {
    return Object.freeze(
      [...this.stacks.entries()].map(([name, stack]) => {
        const health = stack.getHealth();
        const snap   = stack.getDiagnosticsSnapshot();
        return {
          name,
          status:           health.details.orchestratorReport.status,
          score:            health.details.orchestratorReport.overallScore,
          alertCount:       health.details.orchestratorReport.activeAlertCount,
          clockDescription: stack.clockDescription,
          ticksObserved:    snap.totalTicksObserved,
        };
      }),
    );
  }
}

/** Process-wide singleton GameEngineStack registry. */
export const gameEngineRegistry = new GameEngineStackRegistry();

// ═══════════════════════════════════════════════════════════════════════════════
// ── ENGINE VERSION MANIFEST ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/** Version metadata for each engine subsystem in the master barrel. */
export const ENGINE_VERSION_MANIFEST = Object.freeze({
  masterBarrel:   ENGINES_BARREL_VERSION,
  core:           CoreEngines.CORE_ENGINE_BARREL_VERSION,
  zero:           '1.0.0',
  chat:           ChatEngineNamespace.CHAT_ENGINE_BARREL_VERSION,
} as const);

/** Component counts by subsystem for telemetry. */
export const ENGINE_COMPONENT_COUNTS = Object.freeze({
  core:   CoreEngines.CORE_ENGINE_COMPONENT_COUNT,
  zero:   5,   // EventBus, EngineOrchestrator, EngineRegistry, RunStateSnapshot, ZeroFacade
  chat:   ChatEngineNamespace.CHAT_ENGINE_PRESENT_RUNTIME_FILES.length,
} as const);

// ═══════════════════════════════════════════════════════════════════════════════
// ── ARCHITECTURE DOCTRINE ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const ENGINES_ARCHITECTURE_DOCTRINE = Object.freeze([
  // Layering
  'engines/core is the foundation layer — no engine imports from engines/core except from within engines/core.',
  'engines/zero provides Engine 0 primitives — the compatibility layer bridging zero/EventBus to the core EventBus.',
  'engines/chat is a consumer layer — it imports from core but core never imports from chat.',
  'engines/index is the top-level barrel — no engine imports from engines/index.',

  // Data flow
  'All simulation truth flows through RunStateSnapshot — engines read snapshots, never live mutable state.',
  'EventBus emissions are deferred — no engine reacts to another engine during tick execution.',
  'EngineOrchestrator is the sole coordinator of the 13-step tick sequence.',
  'Chat engine is decoupled from tick timing — it reacts to EventBus events asynchronously.',

  // Clock discipline
  'ClockSource is always injected — never call Date.now() directly in engine code.',
  'WallClockSource for production, FixedClockSource for deterministic replay, ManualClockSource for tests.',

  // Safety
  'EngineEventBindings is excluded from all barrels — it has a store dependency that would create circular imports.',
  'Chat engine does not mutate simulation state — it reads and displays, it does not write.',
] as const);

export const ENGINES_TRUST_MATRIX = Object.freeze({
  'engines/core → engines/zero':   'ALLOWED (core imports zero/EventBus and zero/types)',
  'engines/zero → engines/core':   'FORBIDDEN',
  'engines/chat → engines/core':   'ALLOWED (read-only via import)',
  'engines/core → engines/chat':   'FORBIDDEN',
  'engines/chat → engines/zero':   'FORBIDDEN',
  'engines/index → engines/core':  'ALLOWED (re-export)',
  'engines/index → engines/zero':  'ALLOWED (re-export)',
  'engines/index → engines/chat':  'ALLOWED (re-export)',
  'engines/* → store':             'FORBIDDEN (store imports from engines, not vice versa)',
  'engines/* → components':        'FORBIDDEN',
} as const);

// ═══════════════════════════════════════════════════════════════════════════════
// ── RUN LIFECYCLE UTILITIES ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates and immediately starts a GameEngineStack.
 * Convenience wrapper for the common pattern of createGameEngineStack + startRun.
 *
 * @param options - Stack and run options.
 * @returns The running stack.
 *
 * @example
 * const stack = startGameRun({ seasonTickBudget: 200 });
 */
export function startGameRun(options: GameEngineStackOptions & { startOptions?: CoreEngines.StartRunOptions } = {}): GameEngineStack {
  const { startOptions, ...stackOptions } = options;
  const stack = createGameEngineStack(stackOptions);
  stack.startRun(startOptions);
  return stack;
}

/**
 * Validates game engine stack options before creating a stack.
 *
 * @param options - Options to validate.
 * @returns Validation result with `valid` flag and `issues` list.
 */
export function validateGameEngineStackOptions(
  options: GameEngineStackOptions,
): CoreEngines.CoreEngineValidationResult {
  const issues: string[] = [];

  if (options.seasonTickBudget !== undefined) {
    if (!Number.isFinite(options.seasonTickBudget) || options.seasonTickBudget < 1) {
      issues.push(`seasonTickBudget must be >= 1, got ${options.seasonTickBudget}`);
    }
  }

  if (options.clock !== undefined && !CoreEngines.isCoreClockSource(options.clock)) {
    issues.push('clock does not satisfy the ClockSource interface');
  }

  if (options.diagnosticsHistorySize !== undefined) {
    if (!Number.isFinite(options.diagnosticsHistorySize) || options.diagnosticsHistorySize < 32) {
      issues.push(`diagnosticsHistorySize must be >= 32, got ${options.diagnosticsHistorySize}`);
    }
  }

  return { valid: issues.length === 0, issues: Object.freeze(issues) };
}

/**
 * Validates and creates a GameEngineStack, throwing if options are invalid.
 *
 * @param options - Stack options.
 * @throws Error with all validation issues if options are invalid.
 */
export function createValidatedGameEngineStack(options: GameEngineStackOptions): GameEngineStack {
  const validation = validateGameEngineStackOptions(options);
  if (!validation.valid) {
    throw new Error(
      `[createValidatedGameEngineStack] Invalid options:\n${validation.issues.map((i) => `  • ${i}`).join('\n')}`,
    );
  }
  return createGameEngineStack(options);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── CROSS-ENGINE EVENT UTILITIES ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the shared singleton EventBus used by all engine instances that do
 * not have an isolated bus. This is the primary communication channel between
 * EngineOrchestrator and the chat engine.
 */
export function getEngineEventBus(): CoreEngines.EventBus {
  return CoreEngines.getSharedEventBus();
}

/**
 * Subscribes a handler to a core engine event on the shared bus.
 * Returns an unsubscribe teardown function.
 *
 * @param eventName - Canonical engine event name string.
 * @param handler - The handler function.
 */
export function onEngineEvent(
  eventName: string,
  handler: CoreEngines.EngineEventHandler,
): () => void {
  return CoreEngines.subscribeToEvent(CoreEngines.getSharedEventBus(), eventName, handler);
}

/**
 * Subscribes a handler to multiple engine events at once on the shared bus.
 * Returns a single teardown that unregisters all handlers.
 */
export function onEngineEvents(
  eventNames: readonly string[],
  handler: CoreEngines.EngineEventHandler,
): () => void {
  return CoreEngines.subscribeToMany(CoreEngines.getSharedEventBus(), eventNames, handler);
}

/**
 * Registers canonical event channel descriptors on the shared bus.
 * Delegates to `EventBus.registerEventChannels()`.
 */
export function registerEngineChannels(channels: CoreEngines.EventChannelConfig[]): void {
  CoreEngines.registerEventChannels(CoreEngines.getSharedEventBus(), channels);
}

/**
 * Returns bus health metrics from the shared event bus.
 */
export function getSharedBusHealth(): CoreEngines.BusHealthMetrics {
  return CoreEngines.getBusHealthMetrics(CoreEngines.getSharedEventBus());
}

/**
 * Returns the most recent N events from the shared event bus history.
 */
export function recentEngineEvents(count = 20): ReadonlyArray<CoreEngines.EventHistoryEntry> {
  return CoreEngines.recentBusHistory(CoreEngines.getSharedEventBus(), count);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── TICK TIER UTILITIES (top-level access) ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the tick duration in milliseconds for the given tier.
 * Delegates to `CoreEngines.tickDurationMsForTier`.
 */
export function getTickDurationMs(tier: CoreEngines.TickTier): number {
  return CoreEngines.tickDurationMsForTier(tier);
}

/**
 * Returns the human-readable label for a tier (SOVEREIGN, STABLE, etc.).
 */
export function getTickTierLabel(tier: CoreEngines.TickTier): string {
  return CoreEngines.tickTierLabel(tier);
}

/**
 * Returns the PressureTier for a 0–100 pressure score.
 */
export function getPressureTier(score: number): CoreEngines.PressureTier {
  return CoreEngines.pressureTierFromScore(score);
}

/**
 * Returns the tick tier that represents maximum pressure (T4 / COLLAPSE_IMMINENT).
 */
export function getMaxPressureTier(): CoreEngines.TickTier {
  return CoreEngines.crisisTier();
}

/**
 * Returns the tick tier that represents minimum pressure (T0 / SOVEREIGN).
 */
export function getMinPressureTier(): CoreEngines.TickTier {
  return CoreEngines.sovereignTier();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── SNAPSHOT UTILITIES (top-level access) ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns a concise summary object from a RunStateSnapshot.
 * Delegates to `CoreEngines.snapshotSummary`.
 */
export function summarizeSnapshot(snapshot: CoreEngines.RunStateSnapshot): ReturnType<typeof CoreEngines.snapshotSummary> {
  return CoreEngines.snapshotSummary(snapshot);
}

/**
 * Returns true if the run reflected by the snapshot is currently active.
 */
export function isRunActive(snapshot: CoreEngines.RunStateSnapshot): boolean {
  return CoreEngines.isActiveRun(snapshot);
}

/**
 * Returns true if the run has ended.
 */
export function isRunEnded(snapshot: CoreEngines.RunStateSnapshot): boolean {
  return CoreEngines.isRunComplete(snapshot);
}

/**
 * Returns net cash flow per tick (income - expenses) from a snapshot.
 */
export function getNetCashFlow(snapshot: CoreEngines.RunStateSnapshot): number {
  return CoreEngines.netCashFlowPerTick(snapshot);
}

/**
 * Returns true if the run is at critical pressure tier.
 */
export function isCriticalPressure(snapshot: CoreEngines.RunStateSnapshot): boolean {
  return CoreEngines.isAtCrisisTier(snapshot);
}

/**
 * Returns true if there are active cascade chains in the snapshot.
 */
export function hasActiveCascades(snapshot: CoreEngines.RunStateSnapshot): boolean {
  return CoreEngines.hasCascadesActive(snapshot);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── TYPE GUARDS (top-level access) ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Narrows value to RunStateSnapshot.
 * Delegates to `CoreEngines.isRunStateSnapshot`.
 */
export function isGameSnapshot(value: unknown): value is CoreEngines.RunStateSnapshot {
  return CoreEngines.isRunStateSnapshot(value);
}

/**
 * Narrows value to TickTier ('T0'–'T4').
 */
export function isGameTickTier(value: unknown): value is CoreEngines.TickTier {
  return CoreEngines.isTickTier(value);
}

/**
 * Narrows value to PressureTier ('CALM'|'BUILDING'|'ELEVATED'|'HIGH'|'CRITICAL').
 */
export function isGamePressureTier(value: unknown): value is CoreEngines.PressureTier {
  return CoreEngines.isPressureTier(value);
}

/**
 * Narrows value to RunMode.
 */
export function isGameRunMode(value: unknown): value is CoreEngines.RunMode {
  return CoreEngines.isRunMode(value);
}

/**
 * Narrows value to RunOutcome.
 */
export function isGameRunOutcome(value: unknown): value is CoreEngines.RunOutcome {
  return CoreEngines.isRunOutcome(value);
}

/**
 * Narrows value to RunLifecycleState.
 */
export function isGameLifecycleState(value: unknown): value is CoreEngines.RunLifecycleState {
  return CoreEngines.isRunLifecycleState(value);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── CLOCK UTILITIES (top-level access) ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the current time from the shared wall clock.
 * Use this only for non-deterministic timestamps (logging, UI).
 * Engine tick timing must use the injected ClockSource.
 */
export function currentWallTimeMs(): number {
  return Date.now();
}

/**
 * Creates a deterministic test clock chain: ManualClock wrapped in RecordingClock.
 * Useful for integration tests that need both manual control and call history.
 *
 * @param initialMs - Starting time. Default 0.
 * @returns `{ manual, recording }` — call `manual.advance()` and observe via `recording`.
 */
export function createTestClockPair(
  initialMs = 0,
): {
  manual: CoreEngines.ManualClockSource;
  recording: CoreEngines.RecordingClockSource;
} {
  const manual = CoreEngines.createManualClock(initialMs);
  const recording = CoreEngines.createRecordingClock(manual);
  return { manual, recording };
}

/**
 * Creates a standard production clock stack for the given run.
 *
 * @param useRecording - If true, wraps WallClockSource in a RecordingClockSource
 *   for diagnostics. Default false.
 */
export function createProductionClock(
  useRecording = false,
): CoreEngines.ClockSource {
  const wall = CoreEngines.createWallClock();
  if (useRecording) {
    return CoreEngines.createRecordingClock(wall);
  }
  return wall;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── DIAGNOSTICS CROSS-ENGINE UTILITIES ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the step name for orchestrator step number 1–13.
 */
export function getOrchestratorStepName(
  stepNumber: number,
): CoreEngines.OrchestratorStepName | null {
  return CoreEngines.stepNameForIndex(stepNumber);
}

/**
 * Returns a map of step number → step name for all 13 orchestrator steps.
 */
export function getOrchestratorStepMap(): Readonly<Record<number, CoreEngines.OrchestratorStepName>> {
  return CoreEngines.ORCHESTRATOR_STEP_INDEX_MAP;
}

/**
 * Returns the P95 execution time for each step across all recorded ticks,
 * for the given engine stack.
 */
export function getStepPerformanceMap(stack: GameEngineStack): Readonly<Record<string, number>> {
  return CoreEngines.stepP95Map(stack.core.diagnostics);
}

/**
 * Returns the slowest step by P95 duration for the given stack.
 * Returns null if no steps have been recorded yet.
 */
export function getSlowestStep(
  stack: GameEngineStack,
): CoreEngines.StepPerformanceProfile | null {
  return CoreEngines.slowestStepByP95(stack.core.diagnostics);
}

/**
 * Formats a full diagnostics summary for the given stack.
 */
export function formatEngineDiagnostics(stack: GameEngineStack): string {
  const snap = stack.getDiagnosticsSnapshot();
  return CoreEngines.formatDiagnosticsSummary(snap);
}

/**
 * Returns true if all engine systems in the stack are healthy.
 */
export function isGameEngineHealthy(stack: GameEngineStack): boolean {
  return stack.getHealth().overallHealthy;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── ZERO ENGINE UTILITIES ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns the ZeroFacade singleton.
 * The ZeroFacade is the authoritative runtime interface for Engine 0 operations.
 */
export function getZeroFacade(): typeof ZeroEngines.zeroFacade {
  return ZeroEngines.zeroFacade;
}

/**
 * Returns true if the ZeroFacade appears to be initialised (structural check).
 */
export function isZeroFacadeReady(facade: unknown): boolean {
  if (!facade || typeof facade !== 'object') return false;
  const f = facade as Record<string, unknown>;
  return typeof f['getStatus'] === 'function' || typeof f['start'] === 'function';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── ENGINE SUBSYSTEM LAZY LOADERS ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
//
// Lazy loaders for code-splitting. All six core sub-modules plus zero and chat
// can be dynamically imported through these thunks.

export const ENGINE_LAZY_LOADERS = Object.freeze({
  // Core engine modules
  core:         () => import('./core'),
  eventBus:     CoreEngines.CORE_ENGINE_LAZY_LOADERS.EventBus,
  coreTypes:    CoreEngines.CORE_ENGINE_LAZY_LOADERS.types,
  clockSource:  CoreEngines.CORE_ENGINE_LAZY_LOADERS.ClockSource,
  runState:     CoreEngines.CORE_ENGINE_LAZY_LOADERS.RunStateSnapshot,
  diagnostics:  CoreEngines.CORE_ENGINE_LAZY_LOADERS.OrchestratorDiagnostics,
  orchestrator: CoreEngines.CORE_ENGINE_LAZY_LOADERS.EngineOrchestrator,
  // Excluded from core barrel — store dependency
  eventBindings: CoreEngines.CORE_ENGINE_LAZY_LOADERS.EngineEventBindings,
  // Non-core subsystems
  zero: () => import('./zero'),
  chat: () => import('./chat'),
  // Domain engines
  battle:       () => import('./battle/BattleEngine'),
  cascade:      () => import('./cascade/CascadeEngine'),
  cards:        () => import('./cards/CardEngine'),
  pressure:     () => import('./pressure/PressureEngine'),
  shield:       () => import('./shield/ShieldEngine'),
  sovereignty:  () => import('./sovereignty/SovereigntyEngine'),
  tension:      () => import('./tension/TensionEngine'),
  time:         () => import('./time/TimeEngine'),
} as const);

export type EngineLazyLoaderKey = keyof typeof ENGINE_LAZY_LOADERS;

// ═══════════════════════════════════════════════════════════════════════════════
// ── RUN IDENTITY UTILITIES ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a canonical runId for a new game session.
 * Format: `RUN_${seed}_${timestamp}`.
 *
 * @param seed - Numeric seed for the run.
 * @param clock - Optional clock for timestamp injection.
 */
export function newRunId(seed: number, clock?: CoreEngines.ClockSource): string {
  return CoreEngines.generateRunId(seed, 'RUN', clock);
}

/**
 * Parses a runId back to its components.
 * Returns null if the format does not match the canonical pattern.
 */
export function parseRunId(runId: string): {
  prefix: string;
  seed: number;
  timestamp: number;
} | null {
  return CoreEngines.parseRunId(runId);
}

/**
 * Creates a valid starting LiveRunState for the given run parameters.
 * Validates params before creation; throws on invalid input.
 */
export function createRunState(
  params: Parameters<typeof CoreEngines.createLiveState>[0],
): CoreEngines.LiveRunState {
  return CoreEngines.createValidatedLiveState(params);
}

/**
 * Builds a frozen RunStateSnapshot from the given live state.
 * Useful for creating deterministic checkpoints for testing or replay.
 */
export function buildCheckpoint(
  live: CoreEngines.LiveRunState,
  options?: CoreEngines.SnapshotBuildOptions,
): CoreEngines.RunStateSnapshot {
  return CoreEngines.buildLiveSnapshot(live, options ?? {});
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── MASTER MANIFEST ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export const ENGINES_PUBLIC_MANIFEST = Object.freeze({
  moduleName:         ENGINES_MODULE_NAME,
  packageKind:        ENGINES_PACKAGE_KIND,
  runtimeTier:        ENGINES_RUNTIME_TIER,
  barrelVersion:      ENGINES_BARREL_VERSION,
  subsystemIds:       ENGINE_SUBSYSTEM_IDS,
  versionManifest:    ENGINE_VERSION_MANIFEST,
  componentCounts:    ENGINE_COMPONENT_COUNTS,
  architectureDoctrine: ENGINES_ARCHITECTURE_DOCTRINE,
  trustMatrix:        ENGINES_TRUST_MATRIX,
  // Sub-manifests
  core:               CoreEngines.CORE_ENGINE_PUBLIC_MANIFEST,
  chat:               ChatEngineNamespace.CHAT_ENGINE_AUTHORITIES,
} as const);

// ═══════════════════════════════════════════════════════════════════════════════
// ── DEFAULT EXPORT ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default ENGINES_PUBLIC_MANIFEST;
