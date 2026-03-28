/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/EngineRegistry.ts
 *
 * Doctrine:
 * - backend is the authoritative simulation runtime
 * - seven engines remain distinct and execute in deterministic order
 * - duplicate engine registration is a runtime error unless explicitly replaced
 * - registry health must degrade safely even if one engine misbehaves
 * - orchestration must remain lightweight, immutable-at-the-edge, and testable
 * - ML/DL analytics over registry state are first-class concerns
 * - every constant, class, and function here must be used and wired
 */

import type {
  EngineHealth,
  EngineHealthStatus,
  EngineId,
  SimulationEngine,
} from './EngineContracts';

import {
  createEngineSignal,
  createEngineHealth,
} from './EngineContracts';

import type {
  EngineSignal,
  EngineTickResult,
} from './EngineContracts';

// ============================================================================
// MARK: Registration options
// ============================================================================

export interface EngineRegistrationOptions {
  readonly allowReplace?: boolean;
}

// ============================================================================
// MARK: Registry snapshot — immutable view of registered engine set
// ============================================================================

export interface EngineRegistrySnapshot {
  readonly registeredIds: readonly EngineId[];
  readonly executionOrder: readonly EngineId[];
  readonly size: number;
  readonly missingFromCanonicalOrder: readonly EngineId[];
  readonly extraIds: readonly EngineId[];
}

// ============================================================================
// MARK: Canonical constants — engine order, capabilities, dependencies
// ============================================================================

const CANONICAL_ENGINE_ORDER: readonly EngineId[] = [
  'time',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
] as const;

/**
 * Capability tags that engines may provide. Used by the CapabilityMatrix.
 */
export type EngineCapabilityTag =
  | 'TIME_ADVANCE'
  | 'PRESSURE_SCORE'
  | 'TENSION_SCORE'
  | 'SHIELD_MANAGEMENT'
  | 'BATTLE_RESOLUTION'
  | 'CASCADE_EXECUTION'
  | 'SOVEREIGNTY_GATE'
  | 'PROOF_CONTRIBUTION'
  | 'ML_FEATURE_EMIT'
  | 'CARD_RESOLUTION'
  | 'THREAT_ROUTING'
  | 'ECONOMY_MUTATE';

/**
 * Capabilities each canonical engine provides.
 * Used by EngineCapabilityMatrix to answer "which engine provides X?"
 */
export const ENGINE_CAPABILITIES: Record<EngineId, readonly EngineCapabilityTag[]> = {
  time:         ['TIME_ADVANCE', 'PROOF_CONTRIBUTION', 'ML_FEATURE_EMIT'],
  pressure:     ['PRESSURE_SCORE', 'ML_FEATURE_EMIT', 'PROOF_CONTRIBUTION'],
  tension:      ['TENSION_SCORE', 'THREAT_ROUTING', 'ML_FEATURE_EMIT'],
  shield:       ['SHIELD_MANAGEMENT', 'PROOF_CONTRIBUTION', 'ML_FEATURE_EMIT'],
  battle:       ['BATTLE_RESOLUTION', 'THREAT_ROUTING', 'CARD_RESOLUTION', 'ML_FEATURE_EMIT'],
  cascade:      ['CASCADE_EXECUTION', 'CARD_RESOLUTION', 'ECONOMY_MUTATE', 'ML_FEATURE_EMIT'],
  sovereignty:  ['SOVEREIGNTY_GATE', 'PROOF_CONTRIBUTION', 'ML_FEATURE_EMIT'],
};

/**
 * Engine dependency graph — which engines must run before a given engine.
 * Dependency order must be respected for deterministic simulation.
 */
export const ENGINE_DEPENDENCY_GRAPH: Record<EngineId, readonly EngineId[]> = {
  time:         [],
  pressure:     ['time'],
  tension:      ['time', 'pressure'],
  shield:       ['time', 'battle'],
  battle:       ['time', 'pressure', 'tension'],
  cascade:      ['time', 'battle', 'shield'],
  sovereignty:  ['time', 'pressure', 'cascade'],
};

/**
 * Minimum tick budget (ms) each engine is allowed before its step is flagged as slow.
 */
export const ENGINE_TICK_BUDGET_MS: Record<EngineId, number> = {
  time:        2,
  pressure:    3,
  tension:     3,
  shield:      4,
  battle:      6,
  cascade:     5,
  sovereignty: 4,
};

/**
 * Whether an engine is considered critical — failure causes run abort.
 */
export const ENGINE_IS_CRITICAL: Record<EngineId, boolean> = {
  time:        true,
  pressure:    true,
  tension:     false,
  shield:      true,
  battle:      true,
  cascade:     false,
  sovereignty: true,
};

// ============================================================================
// MARK: Internal utilities
// ============================================================================

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueEngineIds(ids: readonly EngineId[]): EngineId[] {
  const seen = new Set<EngineId>();
  const ordered: EngineId[] = [];

  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ordered.push(id);
  }

  return ordered;
}

// ============================================================================
// MARK: EngineRegistry — core registration and retrieval surface
// ============================================================================

export class EngineRegistry {
  private readonly engines = new Map<EngineId, SimulationEngine>();
  private readonly insertionOrder: EngineId[] = [];

  public register(
    engine: SimulationEngine,
    options: EngineRegistrationOptions = {},
  ): this {
    const existing = this.engines.get(engine.engineId);

    if (existing !== undefined) {
      if (existing === engine) {
        return this;
      }

      if (options.allowReplace !== true) {
        throw new Error(
          `Engine already registered: ${engine.engineId}. Pass { allowReplace: true } to replace it.`,
        );
      }

      this.engines.set(engine.engineId, engine);
      return this;
    }

    this.engines.set(engine.engineId, engine);
    this.insertionOrder.push(engine.engineId);
    return this;
  }

  public registerMany(
    engines: readonly SimulationEngine[],
    options: EngineRegistrationOptions = {},
  ): this {
    for (const engine of engines) {
      this.register(engine, options);
    }
    return this;
  }

  public unregister(engineId: EngineId): boolean {
    const deleted = this.engines.delete(engineId);
    if (!deleted) {
      return false;
    }

    const index = this.insertionOrder.indexOf(engineId);
    if (index >= 0) {
      this.insertionOrder.splice(index, 1);
    }

    return true;
  }

  public has(engineId: EngineId): boolean {
    return this.engines.has(engineId);
  }

  public size(): number {
    return this.engines.size;
  }

  public get(engineId: EngineId): SimulationEngine {
    const engine = this.engines.get(engineId);
    if (engine === undefined) {
      throw new Error(`Engine not registered: ${engineId}`);
    }
    return engine;
  }

  public maybeGet(engineId: EngineId): SimulationEngine | null {
    return this.engines.get(engineId) ?? null;
  }

  public ids(): EngineId[] {
    return this.executionOrder();
  }

  public all(): SimulationEngine[] {
    return this.executionOrder().map((engineId) => this.get(engineId));
  }

  public executionOrder(
    preferredOrder: readonly EngineId[] = CANONICAL_ENGINE_ORDER,
  ): EngineId[] {
    const preferred = uniqueEngineIds(preferredOrder);
    const registered = new Set(this.insertionOrder);

    const ordered: EngineId[] = [];

    for (const engineId of preferred) {
      if (registered.has(engineId)) {
        ordered.push(engineId);
      }
    }

    for (const engineId of this.insertionOrder) {
      if (!ordered.includes(engineId)) {
        ordered.push(engineId);
      }
    }

    return ordered;
  }

  public assertRegistered(engineIds: readonly EngineId[]): void {
    const missing = engineIds.filter((engineId) => !this.engines.has(engineId));

    if (missing.length > 0) {
      throw new Error(
        `Required engine(s) not registered: ${missing.join(', ')}`,
      );
    }
  }

  public assertComplete(
    requiredOrder: readonly EngineId[] = CANONICAL_ENGINE_ORDER,
  ): void {
    this.assertRegistered(requiredOrder);
  }

  public snapshot(
    canonicalOrder: readonly EngineId[] = CANONICAL_ENGINE_ORDER,
  ): EngineRegistrySnapshot {
    const executionOrder = this.executionOrder(canonicalOrder);
    const registeredIds = uniqueEngineIds(this.insertionOrder);

    const missingFromCanonicalOrder = canonicalOrder.filter(
      (engineId) => !this.engines.has(engineId),
    );

    const canonicalSet = new Set<EngineId>(canonicalOrder);
    const extraIds = registeredIds.filter((engineId) => !canonicalSet.has(engineId));

    return {
      registeredIds: freezeArray(registeredIds),
      executionOrder: freezeArray(executionOrder),
      size: this.engines.size,
      missingFromCanonicalOrder: freezeArray(missingFromCanonicalOrder),
      extraIds: freezeArray(extraIds),
    };
  }

  public reset(engineIds?: readonly EngineId[]): void {
    const targets =
      engineIds === undefined
        ? this.all()
        : uniqueEngineIds(engineIds).map((engineId) => this.get(engineId));

    for (const engine of targets) {
      engine.reset();
    }
  }

  public health(): EngineHealth[] {
    return this.all().map((engine) => {
      try {
        return engine.getHealth();
      } catch (error) {
        return this.fallbackHealth(
          engine.engineId,
          'FAILED',
          error instanceof Error ? error.message : 'Unknown engine health failure',
        );
      }
    });
  }

  public clear(): void {
    this.engines.clear();
    this.insertionOrder.length = 0;
  }

  private fallbackHealth(
    engineId: EngineId,
    status: EngineHealthStatus,
    note: string,
  ): EngineHealth {
    return {
      engineId,
      status,
      updatedAt: Date.now(),
      notes: [note],
    };
  }
}

// ============================================================================
// MARK: EngineRegistryEventKind — event vocabulary for registry operations
// ============================================================================

export type EngineRegistryEventKind =
  | 'REGISTERED'
  | 'REPLACED'
  | 'UNREGISTERED'
  | 'HEALTH_CHECKED'
  | 'HEALTH_DEGRADED'
  | 'HEALTH_FAILED'
  | 'HEALTH_RECOVERED'
  | 'RESET_CALLED'
  | 'CLEARED'
  | 'ASSERTION_PASSED'
  | 'ASSERTION_FAILED'
  | 'EXECUTION_ORDER_COMPUTED'
  | 'TICK_RESULT_RECORDED'
  | 'WATCHDOG_ALERT';

export interface EngineRegistryEvent {
  readonly eventId: string;
  readonly kind: EngineRegistryEventKind;
  readonly engineId: EngineId | null;
  readonly tick: number;
  readonly timestampMs: number;
  readonly details: Readonly<Record<string, unknown>>;
}

// ============================================================================
// MARK: EngineRegistryEventLog — append-only event log for registry operations
// ============================================================================

export interface EngineRegistryEventLogOptions {
  readonly maxSize?: number;
}

export class EngineRegistryEventLog {
  private readonly events: EngineRegistryEvent[] = [];
  private readonly maxSize: number;
  private idCounter = 0;

  public constructor(options: EngineRegistryEventLogOptions = {}) {
    this.maxSize = Math.max(1, options.maxSize ?? 2_048);
  }

  public record(
    kind: EngineRegistryEventKind,
    engineId: EngineId | null,
    tick: number,
    details: Readonly<Record<string, unknown>> = {},
  ): EngineRegistryEvent {
    const event: EngineRegistryEvent = Object.freeze({
      eventId: `reg-ev-${++this.idCounter}-${tick}`,
      kind,
      engineId,
      tick,
      timestampMs: Date.now(),
      details,
    });

    this.events.push(event);

    if (this.events.length > this.maxSize) {
      this.events.splice(0, this.events.length - this.maxSize);
    }

    return event;
  }

  public getByKind(kind: EngineRegistryEventKind): EngineRegistryEvent[] {
    return this.events.filter((e) => e.kind === kind);
  }

  public getByEngine(engineId: EngineId): EngineRegistryEvent[] {
    return this.events.filter((e) => e.engineId === engineId);
  }

  public getSince(tick: number): EngineRegistryEvent[] {
    return this.events.filter((e) => e.tick >= tick);
  }

  public getLatest(n: number): EngineRegistryEvent[] {
    return this.events.slice(-Math.min(n, this.events.length));
  }

  public countByKind(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const ev of this.events) {
      counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
    }
    return counts;
  }

  public size(): number {
    return this.events.length;
  }

  public clear(): void {
    this.events.length = 0;
  }
}

// ============================================================================
// MARK: EngineRegistryHealthTracker — track health history over time
// ============================================================================

export interface EngineHealthRecord {
  readonly engineId: EngineId;
  readonly status: EngineHealthStatus;
  readonly tick: number;
  readonly timestampMs: number;
  readonly notes: readonly string[];
}

export type EngineHealthTrend = 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'CRITICAL';

export interface EngineHealthTimeline {
  readonly engineId: EngineId;
  readonly records: readonly EngineHealthRecord[];
  readonly currentStatus: EngineHealthStatus;
  readonly trend: EngineHealthTrend;
  readonly consecutiveFailures: number;
  readonly lastHealthyTick: number | null;
  readonly lastFailedTick: number | null;
}

export interface RegistryHealthSummary {
  readonly totalEngines: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly overallStatus: EngineHealthStatus;
  readonly atRiskEngines: readonly EngineId[];
  readonly criticalEngines: readonly EngineId[];
  readonly uptimeRatio: number;
}

export class EngineRegistryHealthTracker {
  private readonly timelines = new Map<EngineId, EngineHealthRecord[]>();
  private readonly maxRecordsPerEngine: number;

  public constructor(options: { maxRecordsPerEngine?: number } = {}) {
    this.maxRecordsPerEngine = options.maxRecordsPerEngine ?? 128;
  }

  public record(health: EngineHealth, tick: number): void {
    const record: EngineHealthRecord = Object.freeze({
      engineId: health.engineId,
      status: health.status,
      tick,
      timestampMs: Date.now(),
      notes: health.notes ?? [],
    });

    let records = this.timelines.get(health.engineId);
    if (!records) {
      records = [];
      this.timelines.set(health.engineId, records);
    }

    records.push(record);

    if (records.length > this.maxRecordsPerEngine) {
      records.splice(0, records.length - this.maxRecordsPerEngine);
    }
  }

  public recordAll(healths: readonly EngineHealth[], tick: number): void {
    for (const h of healths) {
      this.record(h, tick);
    }
  }

  public getTimeline(engineId: EngineId): EngineHealthTimeline {
    const records = this.timelines.get(engineId) ?? [];
    const current = records.length > 0 ? records[records.length - 1].status : 'HEALTHY';

    let consecutiveFailures = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].status === 'FAILED') {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    let lastHealthyTick: number | null = null;
    let lastFailedTick: number | null = null;
    for (let i = records.length - 1; i >= 0; i--) {
      if (lastHealthyTick === null && records[i].status === 'HEALTHY') {
        lastHealthyTick = records[i].tick;
      }
      if (lastFailedTick === null && records[i].status === 'FAILED') {
        lastFailedTick = records[i].tick;
      }
      if (lastHealthyTick !== null && lastFailedTick !== null) break;
    }

    const trend = EngineRegistryHealthTracker.computeTrend(records);

    return {
      engineId,
      records: Object.freeze([...records]),
      currentStatus: current,
      trend,
      consecutiveFailures,
      lastHealthyTick,
      lastFailedTick,
    };
  }

  public buildSummary(registeredIds: readonly EngineId[]): RegistryHealthSummary {
    const timelines = registeredIds.map((id) => this.getTimeline(id));

    const healthyCount = timelines.filter((t) => t.currentStatus === 'HEALTHY').length;
    const degradedCount = timelines.filter((t) => t.currentStatus === 'DEGRADED').length;
    const failedCount = timelines.filter((t) => t.currentStatus === 'FAILED').length;

    const atRiskEngines = timelines
      .filter((t) => t.trend === 'DEGRADING' || t.currentStatus === 'DEGRADED')
      .map((t) => t.engineId);

    const criticalEngines = timelines
      .filter((t) => t.currentStatus === 'FAILED' || t.consecutiveFailures >= 3)
      .map((t) => t.engineId);

    const totalRecords = timelines.reduce((s, t) => s + t.records.length, 0);
    const healthyRecords = timelines.reduce(
      (s, t) => s + t.records.filter((r) => r.status === 'HEALTHY').length,
      0,
    );
    const uptimeRatio = totalRecords === 0 ? 1 : healthyRecords / totalRecords;

    let overallStatus: EngineHealthStatus;
    if (failedCount >= 2 || criticalEngines.some((id) => ENGINE_IS_CRITICAL[id])) {
      overallStatus = 'FAILED';
    } else if (degradedCount > 0 || atRiskEngines.length > 0) {
      overallStatus = 'DEGRADED';
    } else {
      overallStatus = 'HEALTHY';
    }

    return {
      totalEngines: registeredIds.length,
      healthyCount,
      degradedCount,
      failedCount,
      overallStatus,
      atRiskEngines: Object.freeze(atRiskEngines),
      criticalEngines: Object.freeze(criticalEngines),
      uptimeRatio,
    };
  }

  public getAllTimelines(): ReadonlyMap<EngineId, EngineHealthTimeline> {
    const result = new Map<EngineId, EngineHealthTimeline>();
    for (const [id] of this.timelines) {
      result.set(id, this.getTimeline(id));
    }
    return result;
  }

  public reset(engineId?: EngineId): void {
    if (engineId) {
      this.timelines.delete(engineId);
    } else {
      this.timelines.clear();
    }
  }

  private static computeTrend(records: readonly EngineHealthRecord[]): EngineHealthTrend {
    if (records.length < 3) return 'STABLE';

    const recent = records.slice(-5);
    const failCount = recent.filter((r) => r.status === 'FAILED').length;
    const healthyCount = recent.filter((r) => r.status === 'HEALTHY').length;

    if (failCount >= 3) return 'CRITICAL';
    if (failCount >= 1 && healthyCount <= 1) return 'DEGRADING';
    if (failCount === 0 && healthyCount >= 4) return 'IMPROVING';
    return 'STABLE';
  }
}

// ============================================================================
// MARK: EngineCapabilityMatrix — query what capabilities are available
// ============================================================================

export interface CapabilityProviders {
  readonly capability: EngineCapabilityTag;
  readonly providers: readonly EngineId[];
  readonly isAvailable: boolean;
  readonly isCriticalCapability: boolean;
}

export class EngineCapabilityMatrix {
  private readonly registry: EngineRegistry;

  public constructor(registry: EngineRegistry) {
    this.registry = registry;
  }

  public getProviders(capability: EngineCapabilityTag): CapabilityProviders {
    const allProviders = (Object.keys(ENGINE_CAPABILITIES) as EngineId[])
      .filter((id) => ENGINE_CAPABILITIES[id].includes(capability));

    const availableProviders = allProviders.filter((id) => this.registry.has(id));

    const criticalTags: EngineCapabilityTag[] = [
      'TIME_ADVANCE', 'PRESSURE_SCORE', 'SHIELD_MANAGEMENT',
      'BATTLE_RESOLUTION', 'SOVEREIGNTY_GATE', 'PROOF_CONTRIBUTION',
    ];

    return {
      capability,
      providers: Object.freeze(availableProviders),
      isAvailable: availableProviders.length > 0,
      isCriticalCapability: criticalTags.includes(capability),
    };
  }

  public getCapabilitiesForEngine(engineId: EngineId): readonly EngineCapabilityTag[] {
    return ENGINE_CAPABILITIES[engineId] ?? [];
  }

  public getAvailableCapabilities(): EngineCapabilityTag[] {
    const caps = new Set<EngineCapabilityTag>();
    for (const id of this.registry.ids()) {
      for (const cap of ENGINE_CAPABILITIES[id] ?? []) {
        caps.add(cap);
      }
    }
    return [...caps];
  }

  public getMissingCriticalCapabilities(): EngineCapabilityTag[] {
    const critical: EngineCapabilityTag[] = [
      'TIME_ADVANCE', 'PRESSURE_SCORE', 'SHIELD_MANAGEMENT',
      'BATTLE_RESOLUTION', 'SOVEREIGNTY_GATE',
    ];
    return critical.filter((cap) => !this.getProviders(cap).isAvailable);
  }

  public isRunReady(): boolean {
    return this.getMissingCriticalCapabilities().length === 0;
  }

  public buildCapabilityReport(): ReadonlyArray<CapabilityProviders> {
    const allCaps = new Set<EngineCapabilityTag>();
    for (const caps of Object.values(ENGINE_CAPABILITIES)) {
      for (const cap of caps) allCaps.add(cap);
    }
    return [...allCaps].map((cap) => this.getProviders(cap));
  }
}

// ============================================================================
// MARK: EngineExecutionPlan — dependency-aware execution ordering
// ============================================================================

export interface ExecutionPlanStep {
  readonly engineId: EngineId;
  readonly position: number;
  readonly dependencies: readonly EngineId[];
  readonly satisfiedDependencies: readonly EngineId[];
  readonly unsatisfiedDependencies: readonly EngineId[];
  readonly canExecute: boolean;
  readonly budgetMs: number;
  readonly isCritical: boolean;
}

export interface ExecutionPlan {
  readonly steps: readonly ExecutionPlanStep[];
  readonly totalBudgetMs: number;
  readonly isValid: boolean;
  readonly validationErrors: readonly string[];
  readonly estimatedTickMs: number;
}

export class EngineExecutionPlan {
  private readonly registry: EngineRegistry;

  public constructor(registry: EngineRegistry) {
    this.registry = registry;
  }

  public build(): ExecutionPlan {
    const order = this.registry.executionOrder();
    const registeredSet = new Set(order);
    const errors: string[] = [];

    const steps: ExecutionPlanStep[] = order.map((id, position) => {
      const deps = ENGINE_DEPENDENCY_GRAPH[id] ?? [];
      const satisfied = deps.filter((d) => registeredSet.has(d));
      const unsatisfied = deps.filter((d) => !registeredSet.has(d));

      if (unsatisfied.length > 0) {
        errors.push(`Engine '${id}' has missing dependencies: ${unsatisfied.join(', ')}`);
      }

      // Check that all dependencies appear before this engine in the order
      const depsInOrder = deps.filter((d) => order.indexOf(d) < position);
      const depsOutOfOrder = deps.filter((d) => registeredSet.has(d) && order.indexOf(d) >= position);
      if (depsOutOfOrder.length > 0) {
        errors.push(`Engine '${id}' depends on ${depsOutOfOrder.join(', ')} which execute after it.`);
      }

      return {
        engineId: id,
        position,
        dependencies: Object.freeze(deps),
        satisfiedDependencies: Object.freeze(satisfied),
        unsatisfiedDependencies: Object.freeze(unsatisfied),
        canExecute: unsatisfied.length === 0 && depsOutOfOrder.length === 0,
        budgetMs: ENGINE_TICK_BUDGET_MS[id] ?? 5,
        isCritical: ENGINE_IS_CRITICAL[id] ?? false,
      };
    });

    const totalBudgetMs = steps.reduce((s, step) => s + step.budgetMs, 0);
    const estimatedTickMs = totalBudgetMs * 1.2; // 20% buffer

    return {
      steps: Object.freeze(steps),
      totalBudgetMs,
      isValid: errors.length === 0,
      validationErrors: Object.freeze(errors),
      estimatedTickMs,
    };
  }

  public validateDependencies(): string[] {
    return [...this.build().validationErrors];
  }

  public canExecuteEngine(engineId: EngineId): boolean {
    const plan = this.build();
    return plan.steps.find((s) => s.engineId === engineId)?.canExecute ?? false;
  }

  public getEstimatedTickBudget(): number {
    return this.build().estimatedTickMs;
  }
}

// ============================================================================
// MARK: EngineRegistryWatchdog — monitor engine health and emit alerts
// ============================================================================

export interface RegistryWatchdogAlert {
  readonly alertId: string;
  readonly engineId: EngineId | null;
  readonly severity: 'WARN' | 'ERROR' | 'CRITICAL';
  readonly code: string;
  readonly message: string;
  readonly tick: number;
  readonly timestampMs: number;
  readonly autoSignal: EngineSignal;
}

export interface RegistryWatchdogOptions {
  readonly maxConsecutiveFailuresBeforeAlert?: number;
  readonly missingCriticalCapabilityAlert?: boolean;
  readonly budgetOverrunAlert?: boolean;
  readonly onAlert?: (alert: RegistryWatchdogAlert) => void;
}

export class EngineRegistryWatchdog {
  private readonly registry: EngineRegistry;
  private readonly healthTracker: EngineRegistryHealthTracker;
  private readonly options: Required<Omit<RegistryWatchdogOptions, 'onAlert'>>;
  private readonly onAlert?: (alert: RegistryWatchdogAlert) => void;
  private alertIdCounter = 0;
  private readonly alerts: RegistryWatchdogAlert[] = [];

  public constructor(
    registry: EngineRegistry,
    healthTracker: EngineRegistryHealthTracker,
    options: RegistryWatchdogOptions = {},
  ) {
    this.registry = registry;
    this.healthTracker = healthTracker;
    this.options = {
      maxConsecutiveFailuresBeforeAlert: options.maxConsecutiveFailuresBeforeAlert ?? 3,
      missingCriticalCapabilityAlert: options.missingCriticalCapabilityAlert ?? true,
      budgetOverrunAlert: options.budgetOverrunAlert ?? true,
    };
    this.onAlert = options.onAlert;
  }

  public checkTick(tick: number): RegistryWatchdogAlert[] {
    const newAlerts: RegistryWatchdogAlert[] = [];

    // Check engine health timelines
    for (const id of this.registry.ids()) {
      const timeline = this.healthTracker.getTimeline(id);

      if (timeline.consecutiveFailures >= this.options.maxConsecutiveFailuresBeforeAlert) {
        const alert = this.buildAlert(
          id,
          ENGINE_IS_CRITICAL[id] ? 'CRITICAL' : 'ERROR',
          'ENGINE_CONSECUTIVE_FAILURES',
          `Engine '${id}' has failed ${timeline.consecutiveFailures} consecutive ticks.`,
          tick,
        );
        newAlerts.push(alert);
      }

      if (timeline.trend === 'CRITICAL') {
        const alert = this.buildAlert(
          id,
          'CRITICAL',
          'ENGINE_HEALTH_CRITICAL',
          `Engine '${id}' health trend is CRITICAL. Immediate investigation required.`,
          tick,
        );
        newAlerts.push(alert);
      }
    }

    // Check for missing critical capabilities
    if (this.options.missingCriticalCapabilityAlert) {
      const matrix = new EngineCapabilityMatrix(this.registry);
      const missing = matrix.getMissingCriticalCapabilities();
      if (missing.length > 0) {
        const alert = this.buildAlert(
          null,
          'CRITICAL',
          'MISSING_CRITICAL_CAPABILITIES',
          `Critical capabilities missing: ${missing.join(', ')}. Run cannot proceed safely.`,
          tick,
        );
        newAlerts.push(alert);
      }
    }

    for (const alert of newAlerts) {
      this.alerts.push(alert);
      this.onAlert?.(alert);
    }

    return newAlerts;
  }

  private buildAlert(
    engineId: EngineId | null,
    severity: RegistryWatchdogAlert['severity'],
    code: string,
    message: string,
    tick: number,
  ): RegistryWatchdogAlert {
    const signalSeverity = severity === 'WARN' ? 'WARN' : 'ERROR';
    const autoSignal = createEngineSignal(
      engineId ?? 'sovereignty',
      signalSeverity,
      code,
      message,
      tick,
      ['registry-watchdog', `severity:${severity.toLowerCase()}`],
    );

    return Object.freeze({
      alertId: `watchdog-alert-${++this.alertIdCounter}-${tick}`,
      engineId,
      severity,
      code,
      message,
      tick,
      timestampMs: Date.now(),
      autoSignal,
    });
  }

  public getAlerts(since?: number): RegistryWatchdogAlert[] {
    if (since === undefined) return [...this.alerts];
    return this.alerts.filter((a) => a.tick >= since);
  }

  public getCriticalAlerts(): RegistryWatchdogAlert[] {
    return this.alerts.filter((a) => a.severity === 'CRITICAL');
  }

  public hasActiveAlerts(): boolean {
    return this.alerts.length > 0;
  }

  public clearAlerts(): void {
    this.alerts.length = 0;
  }

  public getRegistry(): EngineRegistry {
    return this.registry;
  }

  public getHealthTracker(): EngineRegistryHealthTracker {
    return this.healthTracker;
  }
}

// ============================================================================
// MARK: EngineRegistryDiff — compute differences between two registry states
// ============================================================================

export interface EngineRegistryDiffResult {
  readonly added: readonly EngineId[];
  readonly removed: readonly EngineId[];
  readonly unchanged: readonly EngineId[];
  readonly orderChanged: boolean;
  readonly previousOrder: readonly EngineId[];
  readonly currentOrder: readonly EngineId[];
  readonly isEmpty: boolean;
}

export class EngineRegistryDiff {
  static compute(
    previous: EngineRegistrySnapshot,
    current: EngineRegistrySnapshot,
  ): EngineRegistryDiffResult {
    const prevSet = new Set(previous.registeredIds);
    const currSet = new Set(current.registeredIds);

    const added = current.registeredIds.filter((id) => !prevSet.has(id));
    const removed = previous.registeredIds.filter((id) => !currSet.has(id));
    const unchanged = current.registeredIds.filter((id) => prevSet.has(id));

    const orderChanged =
      previous.executionOrder.length !== current.executionOrder.length ||
      previous.executionOrder.some((id, i) => id !== current.executionOrder[i]);

    return {
      added: Object.freeze(added),
      removed: Object.freeze(removed),
      unchanged: Object.freeze(unchanged),
      orderChanged,
      previousOrder: previous.executionOrder,
      currentOrder: current.executionOrder,
      isEmpty: added.length === 0 && removed.length === 0 && !orderChanged,
    };
  }

  static describeChanges(diff: EngineRegistryDiffResult): string {
    const parts: string[] = [];
    if (diff.added.length > 0) parts.push(`Added: ${diff.added.join(', ')}`);
    if (diff.removed.length > 0) parts.push(`Removed: ${diff.removed.join(', ')}`);
    if (diff.orderChanged) parts.push('Execution order changed.');
    if (diff.isEmpty) return 'No changes.';
    return parts.join('; ');
  }
}

// ============================================================================
// MARK: EngineLifecycleObserver — hook into engine lifecycle events
// ============================================================================

export type EngineLifecycleHookName =
  | 'beforeRegister'
  | 'afterRegister'
  | 'beforeUnregister'
  | 'afterUnregister'
  | 'beforeReset'
  | 'afterReset'
  | 'beforeHealthCheck'
  | 'afterHealthCheck';

export type EngineLifecycleHookFn = (
  hookName: EngineLifecycleHookName,
  engineId: EngineId | null,
  tick: number,
  context?: Readonly<Record<string, unknown>>,
) => void;

export class EngineLifecycleObserver {
  private readonly hooks = new Map<EngineLifecycleHookName, EngineLifecycleHookFn[]>();
  private callCount = 0;

  public on(hookName: EngineLifecycleHookName, fn: EngineLifecycleHookFn): () => void {
    const existing = this.hooks.get(hookName) ?? [];
    existing.push(fn);
    this.hooks.set(hookName, existing);
    return () => {
      const fns = this.hooks.get(hookName) ?? [];
      const idx = fns.indexOf(fn);
      if (idx >= 0) fns.splice(idx, 1);
    };
  }

  public fire(
    hookName: EngineLifecycleHookName,
    engineId: EngineId | null,
    tick: number,
    context?: Readonly<Record<string, unknown>>,
  ): void {
    const fns = this.hooks.get(hookName) ?? [];
    for (const fn of [...fns]) {
      fn(hookName, engineId, tick, context);
      this.callCount++;
    }
  }

  public getCallCount(): number {
    return this.callCount;
  }

  public getRegisteredHooks(): EngineLifecycleHookName[] {
    return [...this.hooks.keys()];
  }

  public reset(): void {
    this.hooks.clear();
    this.callCount = 0;
  }
}

// ============================================================================
// MARK: EngineRegistrySerializer — serialization for persistence and debugging
// ============================================================================

export interface EngineRegistrySerializedState {
  readonly registeredIds: readonly EngineId[];
  readonly executionOrder: readonly EngineId[];
  readonly capabilities: Readonly<Record<string, readonly string[]>>;
  readonly dependencies: Readonly<Record<string, readonly string[]>>;
  readonly tickBudgets: Readonly<Record<string, number>>;
  readonly criticalFlags: Readonly<Record<string, boolean>>;
  readonly serializedAt: number;
}

export class EngineRegistrySerializer {
  static serialize(registry: EngineRegistry): EngineRegistrySerializedState {
    const ids = registry.ids();
    const caps: Record<string, readonly string[]> = {};
    const deps: Record<string, readonly string[]> = {};
    const budgets: Record<string, number> = {};
    const critical: Record<string, boolean> = {};

    for (const id of ids) {
      caps[id] = ENGINE_CAPABILITIES[id] ?? [];
      deps[id] = ENGINE_DEPENDENCY_GRAPH[id] ?? [];
      budgets[id] = ENGINE_TICK_BUDGET_MS[id] ?? 5;
      critical[id] = ENGINE_IS_CRITICAL[id] ?? false;
    }

    return Object.freeze({
      registeredIds: Object.freeze([...ids]),
      executionOrder: Object.freeze([...registry.executionOrder()]),
      capabilities: Object.freeze(caps),
      dependencies: Object.freeze(deps),
      tickBudgets: Object.freeze(budgets),
      criticalFlags: Object.freeze(critical),
      serializedAt: Date.now(),
    });
  }

  static toJSON(state: EngineRegistrySerializedState): string {
    return JSON.stringify(state, null, 2);
  }

  static fromJSON(json: string): EngineRegistrySerializedState {
    const parsed = JSON.parse(json) as EngineRegistrySerializedState;
    return Object.freeze(parsed);
  }
}

// ============================================================================
// MARK: EngineRegistryValidator — validate registry completeness and correctness
// ============================================================================

export interface EngineRegistryValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly missingCanonical: readonly EngineId[];
  readonly dependencyErrors: readonly string[];
  readonly capabilityGaps: readonly string[];
}

export class EngineRegistryValidator {
  static validate(registry: EngineRegistry): EngineRegistryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const snap = registry.snapshot();

    // Missing canonical engines
    const missingCanonical = snap.missingFromCanonicalOrder;
    for (const id of missingCanonical) {
      if (ENGINE_IS_CRITICAL[id]) {
        errors.push(`Critical engine '${id}' is not registered.`);
      } else {
        warnings.push(`Optional engine '${id}' is not registered.`);
      }
    }

    // Dependency errors
    const depErrors: string[] = [];
    const plan = new EngineExecutionPlan(registry).build();
    for (const err of plan.validationErrors) {
      depErrors.push(err);
      errors.push(err);
    }

    // Capability gaps
    const matrix = new EngineCapabilityMatrix(registry);
    const missingCaps = matrix.getMissingCriticalCapabilities();
    const capGaps: string[] = [];
    for (const cap of missingCaps) {
      capGaps.push(`Critical capability '${cap}' has no registered provider.`);
      errors.push(`Critical capability '${cap}' has no registered provider.`);
    }

    // Extra engines warning
    if (snap.extraIds.length > 0) {
      warnings.push(`Non-canonical engines registered: ${snap.extraIds.join(', ')}. Ensure correct execution order.`);
    }

    return {
      isValid: errors.length === 0,
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      missingCanonical: snap.missingFromCanonicalOrder,
      dependencyErrors: Object.freeze(depErrors),
      capabilityGaps: Object.freeze(capGaps),
    };
  }

  static assertValid(registry: EngineRegistry): void {
    const result = EngineRegistryValidator.validate(registry);
    if (!result.isValid) {
      throw new Error(
        `EngineRegistry validation failed:\n${result.errors.join('\n')}`,
      );
    }
  }
}

// ============================================================================
// MARK: EngineTickResultRecorder — record tick results per engine
// ============================================================================

export interface EngineTickResultRecord {
  readonly engineId: EngineId;
  readonly tick: number;
  readonly signalCount: number;
  readonly hasErrors: boolean;
  readonly hasWarnings: boolean;
  readonly durationMs: number;
  readonly timestamp: number;
}

export class EngineTickResultRecorder {
  private readonly records = new Map<EngineId, EngineTickResultRecord[]>();
  private readonly maxPerEngine: number;

  public constructor(options: { maxPerEngine?: number } = {}) {
    this.maxPerEngine = options.maxPerEngine ?? 64;
  }

  public record(
    engineId: EngineId,
    tick: number,
    result: EngineTickResult,
    durationMs: number,
  ): EngineTickResultRecord {
    const rec: EngineTickResultRecord = Object.freeze({
      engineId,
      tick,
      signalCount: result.signals?.length ?? 0,
      hasErrors: (result.signals ?? []).some((s) => s.severity === 'ERROR'),
      hasWarnings: (result.signals ?? []).some((s) => s.severity === 'WARN'),
      durationMs,
      timestamp: Date.now(),
    });

    let list = this.records.get(engineId);
    if (!list) {
      list = [];
      this.records.set(engineId, list);
    }

    list.push(rec);
    if (list.length > this.maxPerEngine) {
      list.splice(0, list.length - this.maxPerEngine);
    }

    return rec;
  }

  public getRecords(engineId: EngineId): EngineTickResultRecord[] {
    return [...(this.records.get(engineId) ?? [])];
  }

  public getLatest(engineId: EngineId): EngineTickResultRecord | null {
    const list = this.records.get(engineId) ?? [];
    return list[list.length - 1] ?? null;
  }

  public computeAvgDurationMs(engineId: EngineId): number {
    const list = this.records.get(engineId) ?? [];
    if (list.length === 0) return 0;
    return list.reduce((s, r) => s + r.durationMs, 0) / list.length;
  }

  public computeErrorRate(engineId: EngineId): number {
    const list = this.records.get(engineId) ?? [];
    if (list.length === 0) return 0;
    return list.filter((r) => r.hasErrors).length / list.length;
  }

  public isBudgetOverrun(engineId: EngineId): boolean {
    const latest = this.getLatest(engineId);
    if (!latest) return false;
    return latest.durationMs > (ENGINE_TICK_BUDGET_MS[engineId] ?? Infinity);
  }

  public clear(): void {
    this.records.clear();
  }
}

// ============================================================================
// MARK: EngineRegistryMLVectorBuilder — 16-feature ML vector for registry state
// ============================================================================

export const ENGINE_REGISTRY_ML_FEATURE_LABELS: readonly string[] = [
  'registry_fill_ratio',          // 0: how many of 7 canonical engines are registered
  'health_healthy_ratio',         // 1: ratio of healthy engines
  'health_failed_ratio',          // 2: ratio of failed engines
  'uptime_ratio',                 // 3: historical uptime across all engines
  'dependency_satisfaction',      // 4: ratio of satisfied dependencies
  'capability_coverage',          // 5: ratio of critical capabilities available
  'critical_engine_ok',           // 6: all critical engines healthy (0 or 1)
  'consecutive_failure_max',      // 7: max consecutive failures across any engine
  'avg_tick_budget_ms_norm',      // 8: normalized average tick budget
  'error_rate_max',               // 9: highest error rate across engines
  'trend_degrading_count_norm',   // 10: count of engines trending degrading
  'extra_engines_ratio',          // 11: ratio of non-canonical engines
  'watchdog_critical_count_norm', // 12: number of critical watchdog alerts
  'execution_plan_valid',         // 13: execution plan is valid (0 or 1)
  'time_engine_ok',               // 14: time engine specifically healthy (0 or 1)
  'sovereignty_engine_ok',        // 15: sovereignty engine specifically healthy (0 or 1)
] as const;

export interface EngineRegistryMLVector {
  readonly tick: number;
  readonly features: readonly number[];
  readonly featureLabels: readonly string[];
  readonly registeredCount: number;
  readonly overallHealthStatus: EngineHealthStatus;
}

export interface EngineRegistryMLContext {
  readonly tick: number;
  readonly vector: EngineRegistryMLVector;
  readonly healthSummary: RegistryHealthSummary;
  readonly executionPlan: ExecutionPlan;
  readonly validationResult: EngineRegistryValidationResult;
  readonly isRunReady: boolean;
}

export class EngineRegistryMLVectorBuilder {
  static build(
    registry: EngineRegistry,
    healthTracker: EngineRegistryHealthTracker,
    tickResultRecorder: EngineTickResultRecorder,
    watchdog: EngineRegistryWatchdog,
    tick: number,
  ): EngineRegistryMLVector {
    const ids = registry.ids();
    const totalCanonical = CANONICAL_ENGINE_ORDER.length;

    // 0: fill ratio
    const fillRatio = ids.length / totalCanonical;

    // 1-2: health ratios
    const summary = healthTracker.buildSummary(ids);
    const healthyRatio = ids.length === 0 ? 1 : summary.healthyCount / ids.length;
    const failedRatio = ids.length === 0 ? 0 : summary.failedCount / ids.length;

    // 3: uptime ratio
    const uptimeRatio = summary.uptimeRatio;

    // 4: dependency satisfaction
    const plan = new EngineExecutionPlan(registry).build();
    const totalSteps = plan.steps.length;
    const satisfiedSteps = plan.steps.filter((s) => s.canExecute).length;
    const depSatisfaction = totalSteps === 0 ? 1 : satisfiedSteps / totalSteps;

    // 5: capability coverage
    const matrix = new EngineCapabilityMatrix(registry);
    const missingCaps = matrix.getMissingCriticalCapabilities();
    const totalCriticalCaps = 5;
    const capCoverage = Math.max(0, (totalCriticalCaps - missingCaps.length) / totalCriticalCaps);

    // 6: all critical engines ok
    const criticalIds: EngineId[] = Object.entries(ENGINE_IS_CRITICAL)
      .filter(([, v]) => v)
      .map(([k]) => k as EngineId);
    const criticalOk = criticalIds.every((id) => {
      if (!registry.has(id)) return false;
      const tl = healthTracker.getTimeline(id);
      return tl.currentStatus === 'HEALTHY';
    }) ? 1.0 : 0.0;

    // 7: max consecutive failures
    const maxConsec = ids.length === 0 ? 0 :
      Math.max(...ids.map((id) => healthTracker.getTimeline(id).consecutiveFailures));
    const maxConsecNorm = Math.min(1, maxConsec / 10);

    // 8: avg tick budget normalized
    const avgBudget = ids.length === 0 ? 0 :
      ids.reduce((s, id) => s + (ENGINE_TICK_BUDGET_MS[id] ?? 5), 0) / ids.length;
    const avgBudgetNorm = Math.min(1, avgBudget / 10);

    // 9: max error rate
    const maxErrRate = ids.length === 0 ? 0 :
      Math.max(...ids.map((id) => tickResultRecorder.computeErrorRate(id)));

    // 10: degrading trend count
    const degradingCount = ids.filter((id) => {
      const tl = healthTracker.getTimeline(id);
      return tl.trend === 'DEGRADING' || tl.trend === 'CRITICAL';
    }).length;
    const degradingNorm = Math.min(1, degradingCount / totalCanonical);

    // 11: extra engines ratio
    const snap = registry.snapshot();
    const extraRatio = Math.min(1, snap.extraIds.length / Math.max(1, ids.length));

    // 12: watchdog critical alerts
    const criticalAlerts = watchdog.getCriticalAlerts().length;
    const criticalAlertsNorm = Math.min(1, criticalAlerts / 5);

    // 13: execution plan valid
    const planValid = plan.isValid ? 1.0 : 0.0;

    // 14: time engine ok
    const timeOk = registry.has('time') &&
      healthTracker.getTimeline('time').currentStatus === 'HEALTHY' ? 1.0 : 0.0;

    // 15: sovereignty engine ok
    const sovOk = registry.has('sovereignty') &&
      healthTracker.getTimeline('sovereignty').currentStatus === 'HEALTHY' ? 1.0 : 0.0;

    return {
      tick,
      features: [
        fillRatio, healthyRatio, failedRatio, uptimeRatio,
        depSatisfaction, capCoverage, criticalOk, maxConsecNorm,
        avgBudgetNorm, maxErrRate, degradingNorm, extraRatio,
        criticalAlertsNorm, planValid, timeOk, sovOk,
      ],
      featureLabels: ENGINE_REGISTRY_ML_FEATURE_LABELS,
      registeredCount: ids.length,
      overallHealthStatus: summary.overallStatus,
    };
  }

  static buildContext(
    registry: EngineRegistry,
    healthTracker: EngineRegistryHealthTracker,
    tickResultRecorder: EngineTickResultRecorder,
    watchdog: EngineRegistryWatchdog,
    tick: number,
  ): EngineRegistryMLContext {
    const vector = EngineRegistryMLVectorBuilder.build(
      registry, healthTracker, tickResultRecorder, watchdog, tick,
    );
    const healthSummary = healthTracker.buildSummary(registry.ids());
    const executionPlan = new EngineExecutionPlan(registry).build();
    const validationResult = EngineRegistryValidator.validate(registry);
    const matrix = new EngineCapabilityMatrix(registry);

    return {
      tick,
      vector,
      healthSummary,
      executionPlan,
      validationResult,
      isRunReady: matrix.isRunReady() && validationResult.isValid,
    };
  }

  static zero(tick: number): EngineRegistryMLVector {
    return {
      tick,
      features: new Array(ENGINE_REGISTRY_ML_FEATURE_LABELS.length).fill(0),
      featureLabels: ENGINE_REGISTRY_ML_FEATURE_LABELS,
      registeredCount: 0,
      overallHealthStatus: 'HEALTHY',
    };
  }
}

// ============================================================================
// MARK: EngineRegistryStats — snapshot statistics for reporting
// ============================================================================

export interface EngineRegistryStats {
  readonly registeredCount: number;
  readonly canonicalCount: number;
  readonly missingCanonicalCount: number;
  readonly extraCount: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly capabilitiesAvailable: number;
  readonly capabilitiesMissing: number;
  readonly executionPlanValid: boolean;
  readonly estimatedTickBudgetMs: number;
}

export function buildEngineRegistryStats(
  registry: EngineRegistry,
  healthTracker: EngineRegistryHealthTracker,
): EngineRegistryStats {
  const snap = registry.snapshot();
  const summary = healthTracker.buildSummary(registry.ids());
  const matrix = new EngineCapabilityMatrix(registry);
  const plan = new EngineExecutionPlan(registry).build();

  return Object.freeze({
    registeredCount: snap.size,
    canonicalCount: CANONICAL_ENGINE_ORDER.length,
    missingCanonicalCount: snap.missingFromCanonicalOrder.length,
    extraCount: snap.extraIds.length,
    healthyCount: summary.healthyCount,
    degradedCount: summary.degradedCount,
    failedCount: summary.failedCount,
    capabilitiesAvailable: matrix.getAvailableCapabilities().length,
    capabilitiesMissing: matrix.getMissingCriticalCapabilities().length,
    executionPlanValid: plan.isValid,
    estimatedTickBudgetMs: plan.estimatedTickMs,
  });
}

// ============================================================================
// MARK: EngineRegistryReplayLog — record registry states for replay debugging
// ============================================================================

export interface RegistryReplayFrame {
  readonly tick: number;
  readonly snapshot: EngineRegistrySnapshot;
  readonly healthSummary: RegistryHealthSummary;
  readonly capturedAt: number;
}

export class EngineRegistryReplayLog {
  private readonly frames: RegistryReplayFrame[] = [];
  private readonly maxFrames: number;

  public constructor(options: { maxFrames?: number } = {}) {
    this.maxFrames = options.maxFrames ?? 256;
  }

  public capture(
    registry: EngineRegistry,
    healthTracker: EngineRegistryHealthTracker,
    tick: number,
  ): RegistryReplayFrame {
    const frame: RegistryReplayFrame = Object.freeze({
      tick,
      snapshot: registry.snapshot(),
      healthSummary: healthTracker.buildSummary(registry.ids()),
      capturedAt: Date.now(),
    });

    this.frames.push(frame);
    if (this.frames.length > this.maxFrames) {
      this.frames.splice(0, this.frames.length - this.maxFrames);
    }

    return frame;
  }

  public getFrame(tick: number): RegistryReplayFrame | null {
    return this.frames.find((f) => f.tick === tick) ?? null;
  }

  public getFramesSince(tick: number): RegistryReplayFrame[] {
    return this.frames.filter((f) => f.tick >= tick);
  }

  public getLatestFrame(): RegistryReplayFrame | null {
    return this.frames[this.frames.length - 1] ?? null;
  }

  public getFrameCount(): number {
    return this.frames.length;
  }

  public computeDiffSeries(): EngineRegistryDiffResult[] {
    const diffs: EngineRegistryDiffResult[] = [];
    for (let i = 1; i < this.frames.length; i++) {
      diffs.push(
        EngineRegistryDiff.compute(this.frames[i - 1].snapshot, this.frames[i].snapshot),
      );
    }
    return diffs;
  }

  public clear(): void {
    this.frames.length = 0;
  }
}

// ============================================================================
// MARK: EngineRegistryChatBridge — output contract for chat adapter consumption
// ============================================================================

export interface EngineRegistryChatSignal {
  readonly signalId: string;
  readonly domain: 'ENGINE_REGISTRY';
  readonly kind:
    | 'ENGINE_REGISTERED'
    | 'ENGINE_UNREGISTERED'
    | 'ENGINE_HEALTH_DEGRADED'
    | 'ENGINE_HEALTH_FAILED'
    | 'REGISTRY_INCOMPLETE'
    | 'EXECUTION_PLAN_INVALID'
    | 'WATCHDOG_ALERT'
    | 'CAPABILITY_GAP'
    | 'RUN_READY'
    | 'RUN_NOT_READY';
  readonly severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  readonly tick: number;
  readonly engineId: EngineId | null;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly recommendation: string;
}

export class EngineRegistryChatBridge {
  private static nextId = 0;

  private static newId(): string {
    return `reg-signal-${++EngineRegistryChatBridge.nextId}-${Date.now()}`;
  }

  static fromRegistration(engineId: EngineId, tick: number, replaced: boolean): EngineRegistryChatSignal {
    return {
      signalId: EngineRegistryChatBridge.newId(),
      domain: 'ENGINE_REGISTRY',
      kind: 'ENGINE_REGISTERED',
      severity: 'INFO',
      tick,
      engineId,
      message: replaced
        ? `Engine '${engineId}' replaced in registry at tick ${tick}.`
        : `Engine '${engineId}' registered in registry at tick ${tick}.`,
      details: { engineId, replaced, isCritical: ENGINE_IS_CRITICAL[engineId] ?? false },
      recommendation: 'Verify execution plan after registration changes.',
    };
  }

  static fromHealthAlert(timeline: EngineHealthTimeline, tick: number): EngineRegistryChatSignal {
    const isCritical = ENGINE_IS_CRITICAL[timeline.engineId] ?? false;
    const kind: EngineRegistryChatSignal['kind'] =
      timeline.currentStatus === 'FAILED' ? 'ENGINE_HEALTH_FAILED' : 'ENGINE_HEALTH_DEGRADED';
    const severity: EngineRegistryChatSignal['severity'] =
      isCritical && timeline.currentStatus === 'FAILED' ? 'CRITICAL' :
      timeline.currentStatus === 'FAILED' ? 'ERROR' : 'WARN';

    return {
      signalId: EngineRegistryChatBridge.newId(),
      domain: 'ENGINE_REGISTRY',
      kind,
      severity,
      tick,
      engineId: timeline.engineId,
      message: `Engine '${timeline.engineId}' is ${timeline.currentStatus}. Consecutive failures: ${timeline.consecutiveFailures}.`,
      details: {
        engineId: timeline.engineId,
        status: timeline.currentStatus,
        trend: timeline.trend,
        consecutiveFailures: timeline.consecutiveFailures,
        isCritical,
      },
      recommendation: isCritical
        ? `CRITICAL: Restore engine '${timeline.engineId}' immediately. Run cannot proceed safely.`
        : `Investigate engine '${timeline.engineId}' — it is degrading.`,
    };
  }

  static fromValidation(result: EngineRegistryValidationResult, tick: number): EngineRegistryChatSignal {
    const isReady = result.isValid;
    return {
      signalId: EngineRegistryChatBridge.newId(),
      domain: 'ENGINE_REGISTRY',
      kind: isReady ? 'RUN_READY' : 'RUN_NOT_READY',
      severity: isReady ? 'INFO' : 'ERROR',
      tick,
      engineId: null,
      message: isReady
        ? 'Engine registry validated. Run is ready.'
        : `Engine registry invalid. ${result.errors.length} error(s) found.`,
      details: {
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        missingCanonical: result.missingCanonical,
        capabilityGaps: result.capabilityGaps,
      },
      recommendation: isReady
        ? 'All engines ready. Proceed.'
        : `Resolve ${result.errors.length} error(s) before starting run.`,
    };
  }

  static fromWatchdogAlert(alert: RegistryWatchdogAlert): EngineRegistryChatSignal {
    return {
      signalId: EngineRegistryChatBridge.newId(),
      domain: 'ENGINE_REGISTRY',
      kind: 'WATCHDOG_ALERT',
      severity: alert.severity === 'WARN' ? 'WARN' : alert.severity === 'ERROR' ? 'ERROR' : 'CRITICAL',
      tick: alert.tick,
      engineId: alert.engineId,
      message: alert.message,
      details: { alertId: alert.alertId, code: alert.code },
      recommendation: 'Check engine health and execution plan immediately.',
    };
  }

  static buildHealthSignal(registry: EngineRegistry, healthTracker: EngineRegistryHealthTracker, tick: number): EngineRegistryChatSignal {
    const summary = healthTracker.buildSummary(registry.ids());
    const isHealthy = summary.overallStatus === 'HEALTHY';
    return {
      signalId: EngineRegistryChatBridge.newId(),
      domain: 'ENGINE_REGISTRY',
      kind: isHealthy ? 'RUN_READY' : 'ENGINE_HEALTH_DEGRADED',
      severity: summary.overallStatus === 'FAILED' ? 'CRITICAL' :
        summary.overallStatus === 'DEGRADED' ? 'WARN' : 'INFO',
      tick,
      engineId: null,
      message: `Registry health: ${summary.healthyCount}/${summary.totalEngines} engines healthy.`,
      details: {
        healthyCount: summary.healthyCount,
        degradedCount: summary.degradedCount,
        failedCount: summary.failedCount,
        uptimeRatio: summary.uptimeRatio,
        criticalEngines: summary.criticalEngines,
      },
      recommendation: summary.criticalEngines.length > 0
        ? `Restore critical engine(s): ${summary.criticalEngines.join(', ')}.`
        : 'Registry health nominal.',
    };
  }
}

// ============================================================================
// MARK: InstrumentedEngineRegistry — EngineRegistry + all analytics wired
// ============================================================================

/**
 * Full registry stack with all analytics instrumentation wired together.
 * This is the preferred entry point for production use.
 */
export interface InstrumentedEngineRegistryOptions {
  readonly maxEventLogSize?: number;
  readonly maxHealthRecords?: number;
  readonly maxTickResultRecords?: number;
  readonly maxReplayFrames?: number;
  readonly onWatchdogAlert?: (alert: RegistryWatchdogAlert) => void;
}

export interface InstrumentedEngineRegistryState {
  readonly snapshot: EngineRegistrySnapshot;
  readonly stats: EngineRegistryStats;
  readonly healthSummary: RegistryHealthSummary;
  readonly mlVector: EngineRegistryMLVector;
  readonly validationResult: EngineRegistryValidationResult;
  readonly isRunReady: boolean;
  readonly activeAlerts: RegistryWatchdogAlert[];
}

export class InstrumentedEngineRegistry {
  public readonly registry: EngineRegistry;
  public readonly eventLog: EngineRegistryEventLog;
  public readonly healthTracker: EngineRegistryHealthTracker;
  public readonly tickResultRecorder: EngineTickResultRecorder;
  public readonly replayLog: EngineRegistryReplayLog;
  public readonly watchdog: EngineRegistryWatchdog;
  public readonly lifecycleObserver: EngineLifecycleObserver;
  public readonly serializer: typeof EngineRegistrySerializer;
  private currentTick = 0;

  public constructor(options: InstrumentedEngineRegistryOptions = {}) {
    this.registry = new EngineRegistry();
    this.eventLog = new EngineRegistryEventLog({ maxSize: options.maxEventLogSize });
    this.healthTracker = new EngineRegistryHealthTracker({
      maxRecordsPerEngine: options.maxHealthRecords,
    });
    this.tickResultRecorder = new EngineTickResultRecorder({
      maxPerEngine: options.maxTickResultRecords,
    });
    this.replayLog = new EngineRegistryReplayLog({ maxFrames: options.maxReplayFrames });
    this.watchdog = new EngineRegistryWatchdog(this.registry, this.healthTracker, {
      onAlert: options.onWatchdogAlert,
    });
    this.lifecycleObserver = new EngineLifecycleObserver();
    this.serializer = EngineRegistrySerializer;
  }

  public register(engine: SimulationEngine, opts: EngineRegistrationOptions = {}): this {
    this.lifecycleObserver.fire('beforeRegister', engine.engineId, this.currentTick);
    const existed = this.registry.has(engine.engineId);
    this.registry.register(engine, opts);
    this.eventLog.record(
      existed ? 'REPLACED' : 'REGISTERED',
      engine.engineId,
      this.currentTick,
      { isCritical: ENGINE_IS_CRITICAL[engine.engineId] ?? false },
    );
    this.lifecycleObserver.fire('afterRegister', engine.engineId, this.currentTick);
    return this;
  }

  public registerMany(engines: readonly SimulationEngine[], opts: EngineRegistrationOptions = {}): this {
    for (const engine of engines) this.register(engine, opts);
    return this;
  }

  public unregister(engineId: EngineId): boolean {
    this.lifecycleObserver.fire('beforeUnregister', engineId, this.currentTick);
    const deleted = this.registry.unregister(engineId);
    if (deleted) {
      this.eventLog.record('UNREGISTERED', engineId, this.currentTick);
    }
    this.lifecycleObserver.fire('afterUnregister', engineId, this.currentTick);
    return deleted;
  }

  public advanceTick(tick: number): void {
    this.currentTick = tick;

    // Record health
    this.lifecycleObserver.fire('beforeHealthCheck', null, tick);
    const healths = this.registry.health();
    this.healthTracker.recordAll(healths, tick);
    this.lifecycleObserver.fire('afterHealthCheck', null, tick);

    // Run watchdog
    const alerts = this.watchdog.checkTick(tick);
    if (alerts.length > 0) {
      this.eventLog.record('WATCHDOG_ALERT', null, tick, { alertCount: alerts.length });
    }

    // Capture replay frame
    this.replayLog.capture(this.registry, this.healthTracker, tick);
  }

  public recordTickResult(
    engineId: EngineId,
    result: EngineTickResult,
    durationMs: number,
  ): EngineTickResultRecord {
    const rec = this.tickResultRecorder.record(engineId, this.currentTick, result, durationMs);
    this.eventLog.record('TICK_RESULT_RECORDED', engineId, this.currentTick, {
      signalCount: rec.signalCount,
      hasErrors: rec.hasErrors,
      durationMs: rec.durationMs,
    });
    return rec;
  }

  public getState(): InstrumentedEngineRegistryState {
    const ids = this.registry.ids();
    return {
      snapshot: this.registry.snapshot(),
      stats: buildEngineRegistryStats(this.registry, this.healthTracker),
      healthSummary: this.healthTracker.buildSummary(ids),
      mlVector: EngineRegistryMLVectorBuilder.build(
        this.registry,
        this.healthTracker,
        this.tickResultRecorder,
        this.watchdog,
        this.currentTick,
      ),
      validationResult: EngineRegistryValidator.validate(this.registry),
      isRunReady: new EngineCapabilityMatrix(this.registry).isRunReady() &&
        EngineRegistryValidator.validate(this.registry).isValid,
      activeAlerts: this.watchdog.getAlerts(),
    };
  }

  public buildChatSignal(): EngineRegistryChatSignal {
    return EngineRegistryChatBridge.buildHealthSignal(
      this.registry,
      this.healthTracker,
      this.currentTick,
    );
  }

  public buildHealthSignals(): EngineRegistryChatSignal[] {
    const signals: EngineRegistryChatSignal[] = [];
    const state = this.getState();

    for (const engineId of this.registry.ids()) {
      const timeline = this.healthTracker.getTimeline(engineId);
      if (timeline.currentStatus !== 'HEALTHY') {
        signals.push(EngineRegistryChatBridge.fromHealthAlert(timeline, this.currentTick));
      }
    }

    if (!state.validationResult.isValid) {
      signals.push(EngineRegistryChatBridge.fromValidation(state.validationResult, this.currentTick));
    }

    for (const alert of state.activeAlerts.slice(-3)) {
      signals.push(EngineRegistryChatBridge.fromWatchdogAlert(alert));
    }

    return signals;
  }

  public serializeState(): EngineRegistrySerializedState {
    return EngineRegistrySerializer.serialize(this.registry);
  }

  public getCurrentTick(): number {
    return this.currentTick;
  }

  public reset(): void {
    this.lifecycleObserver.fire('beforeReset', null, this.currentTick);
    this.registry.reset();
    this.eventLog.record('RESET_CALLED', null, this.currentTick);
    this.lifecycleObserver.fire('afterReset', null, this.currentTick);
  }
}

// ============================================================================
// MARK: Factory functions
// ============================================================================

/**
 * Create a fully instrumented registry with all analytics wired.
 */
export function createInstrumentedRegistry(
  options: InstrumentedEngineRegistryOptions = {},
): InstrumentedEngineRegistry {
  return new InstrumentedEngineRegistry(options);
}

/**
 * Build a standalone health signal for a registry state — used by chat adapters.
 */
export function buildRegistryHealthSignal(
  registry: EngineRegistry,
  healthTracker: EngineRegistryHealthTracker,
  tick: number,
): EngineRegistryChatSignal {
  return EngineRegistryChatBridge.buildHealthSignal(registry, healthTracker, tick);
}

/**
 * Quickly validate a registry and throw if invalid.
 */
export function assertRegistryValid(registry: EngineRegistry): void {
  EngineRegistryValidator.assertValid(registry);
}

/**
 * Create a health record from an existing EngineHealth object.
 * Uses createEngineHealth for standardized health creation.
 */
export function buildFallbackHealth(
  engineId: EngineId,
  status: EngineHealthStatus,
  notes: string[],
): EngineHealth {
  return createEngineHealth(engineId, status, Date.now(), notes);
}

// ---------------------------------------------------------------------------
// EngineRegistryRollingStats — 60-tick rolling window of registry health
// ---------------------------------------------------------------------------

export interface EngineRegistryTickSnapshot {
  readonly tick: number;
  readonly totalEngines: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly fillRatio: number;
  readonly uptimeRatio: number;
}

export class EngineRegistryRollingStats {
  private readonly capacity: number;
  private readonly snapshots: EngineRegistryTickSnapshot[] = [];

  public constructor(capacity = 60) { this.capacity = capacity; }

  public record(snap: EngineRegistryTickSnapshot): void {
    if (this.snapshots.length >= this.capacity) this.snapshots.shift();
    this.snapshots.push(Object.freeze(snap));
  }

  public avgHealthyRatio(): number {
    if (this.snapshots.length === 0) return 1;
    return this.snapshots.reduce((s, r) => s + (r.totalEngines > 0 ? r.healthyCount / r.totalEngines : 1), 0) / this.snapshots.length;
  }

  public avgFillRatio(): number {
    if (this.snapshots.length === 0) return 1;
    return this.snapshots.reduce((s, r) => s + r.fillRatio, 0) / this.snapshots.length;
  }

  public avgUptimeRatio(): number {
    if (this.snapshots.length === 0) return 1;
    return this.snapshots.reduce((s, r) => s + r.uptimeRatio, 0) / this.snapshots.length;
  }

  public peakFailedCount(): number {
    if (this.snapshots.length === 0) return 0;
    return Math.max(...this.snapshots.map(s => s.failedCount));
  }

  public trend(): 'IMPROVING' | 'WORSENING' | 'STABLE' {
    if (this.snapshots.length < 10) return 'STABLE';
    const half = Math.floor(this.snapshots.length / 2);
    const recentAvg = this.snapshots.slice(-half).reduce((s, r) => s + r.healthyCount, 0) / half;
    const olderAvg = this.snapshots.slice(0, half).reduce((s, r) => s + r.healthyCount, 0) / half;
    const delta = recentAvg - olderAvg;
    if (delta > 0.5) return 'IMPROVING';
    if (delta < -0.5) return 'WORSENING';
    return 'STABLE';
  }

  public clear(): void { this.snapshots.length = 0; }
  public size(): number { return this.snapshots.length; }
}

// ---------------------------------------------------------------------------
// EngineRegistryHealthGrader
// ---------------------------------------------------------------------------

export type EngineRegistryHealthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export function gradeEngineRegistry(
  avgHealthyRatio: number,
  avgUptimeRatio: number,
  peakFailed: number,
): EngineRegistryHealthGrade {
  if (peakFailed >= 4) return 'F';
  const composite = avgHealthyRatio * 0.6 + avgUptimeRatio * 0.4;
  if (composite >= 0.96) return 'S';
  if (composite >= 0.88) return 'A';
  if (composite >= 0.74) return 'B';
  if (composite >= 0.56) return 'C';
  if (composite >= 0.36) return 'D';
  return 'F';
}

export interface EngineRegistryHealthSummary {
  readonly grade: EngineRegistryHealthGrade;
  readonly avgHealthyRatio: number;
  readonly avgUptimeRatio: number;
  readonly peakFailedCount: number;
  readonly trend: 'IMPROVING' | 'WORSENING' | 'STABLE';
  readonly isHealthy: boolean;
  readonly isCritical: boolean;
}

export function buildEngineRegistryHealthSummary(
  stats: EngineRegistryRollingStats,
): EngineRegistryHealthSummary {
  const avgHealthyRatio = stats.avgHealthyRatio();
  const avgUptimeRatio = stats.avgUptimeRatio();
  const peakFailedCount = stats.peakFailedCount();
  const trend = stats.trend();
  const grade = gradeEngineRegistry(avgHealthyRatio, avgUptimeRatio, peakFailedCount);
  return Object.freeze({
    grade, avgHealthyRatio, avgUptimeRatio, peakFailedCount, trend,
    isHealthy: grade === 'S' || grade === 'A' || grade === 'B',
    isCritical: grade === 'F' || grade === 'D',
  });
}

// ---------------------------------------------------------------------------
// Module constants
// ---------------------------------------------------------------------------

export const ENGINE_REGISTRY_MODULE_VERSION = '2.0.0' as const;
export const ENGINE_REGISTRY_MODULE_READY = true;
export const ENGINE_REGISTRY_ROLLING_CAPACITY = 60 as const;
export const ENGINE_REGISTRY_COMPLETE = true;
