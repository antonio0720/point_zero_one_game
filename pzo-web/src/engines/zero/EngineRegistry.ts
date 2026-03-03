// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE 0 ENGINE REGISTRY
// pzo-web/src/engines/zero/EngineRegistry.ts
//
// Manifest of all seven engines. Tracks registration, health, and readiness.
// EngineOrchestrator owns the single registry instance. No other system calls
// register(), initializeAll(), or setHealth() directly.
//
// RULES:
//   ✦ All 7 engines must be INITIALIZED before startRun() permits the tick loop.
//   ✦ Duplicate registration throws immediately — fail loud, fail early.
//   ✦ get<T>() throws if the engine is not registered — never silently returns null.
//   ✦ initializeAll() continues on failure — health report must be COMPLETE even
//     if some engines error, so the caller can report ALL failures at once.
//   ✦ resetAll() returns engines to REGISTERED state (not INITIALIZED).
//
// REQUIRED ENGINE SET (7):
//   TIME · PRESSURE · TENSION · SHIELD · BATTLE · CASCADE · SOVEREIGNTY
//
// Adding an engine? Update REQUIRED_ENGINES. Missing entry = startRun() refuses
// to proceed. No silent fallback.
//
// Density6 LLC · Point Zero One · Engine 0 · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import {
  EngineId,
  EngineHealth,
  type EngineEntry,
  type IEngine,
  type EngineInitParams,
} from './types';
import type { EventBus } from './EventBus';

/**
 * Registry of all seven sovereign engines.
 *
 * EngineOrchestrator constructs and owns the single EngineRegistry instance.
 * No other system may call register(), initializeAll(), resetAll(), or setHealth().
 */
export class EngineRegistry {
  private readonly registry = new Map<EngineId, EngineEntry>();
  private readonly eventBus: EventBus;

  /**
   * All seven engines are required. The registry refuses to declare readiness
   * if even one is missing or not INITIALIZED.
   *
   * Canonical set — update here when adding a new engine.
   */
  private static readonly REQUIRED_ENGINES: readonly EngineId[] = [
    EngineId.TIME,
    EngineId.PRESSURE,
    EngineId.TENSION,
    EngineId.SHIELD,
    EngineId.BATTLE,
    EngineId.CASCADE,
    EngineId.SOVEREIGNTY,
  ];

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Register an engine instance.
   * Called by EngineOrchestrator constructor for each of the seven engines.
   *
   * @throws If the engineId is already registered.
   */
  public register(engine: IEngine): void {
    if (this.registry.has(engine.engineId)) {
      throw new Error(
        `[EngineRegistry] Engine ${engine.engineId} is already registered. ` +
        `Duplicate registration is not allowed.`,
      );
    }

    this.registry.set(engine.engineId, {
      id:           engine.engineId,
      health:       EngineHealth.REGISTERED,
      instance:     engine,
      registeredAt: Date.now(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZE ALL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Call init() on every registered engine.
   *
   * Updates health to INITIALIZED on success, ERROR on failure.
   * DOES NOT abort on first failure — all engines attempt init so the caller
   * receives a complete health report.
   *
   * Called by EngineOrchestrator.startRun() before the tick loop starts.
   */
  public initializeAll(params: EngineInitParams): void {
    for (const [id, entry] of this.registry) {
      try {
        entry.instance.init(params);
        this.setHealth(id, EngineHealth.INITIALIZED);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.setHealth(id, EngineHealth.ERROR, error);
        console.error(`[EngineRegistry] Engine ${id} failed to initialize: ${error}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET ALL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Call reset() on every registered engine.
   * Returns each engine to REGISTERED health (not INITIALIZED).
   * Called by EngineOrchestrator.reset() between runs.
   */
  public resetAll(): void {
    for (const [id, entry] of this.registry) {
      try {
        entry.instance.reset();
        this.setHealth(id, EngineHealth.REGISTERED);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.setHealth(id, EngineHealth.ERROR, error);
        console.error(`[EngineRegistry] Engine ${id} failed to reset: ${error}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns true ONLY if every required engine is health=INITIALIZED.
   * One engine in ERROR, REGISTERED, or UNREGISTERED state returns false.
   *
   * Called by EngineOrchestrator before the tick loop starts.
   */
  public allEnginesReady(): boolean {
    for (const id of EngineRegistry.REQUIRED_ENGINES) {
      const entry = this.registry.get(id);
      if (!entry || entry.health !== EngineHealth.INITIALIZED) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns an array of required engine IDs that are NOT health=INITIALIZED.
   * Used to build informative startup error messages.
   */
  public getMissingEngines(): EngineId[] {
    return EngineRegistry.REQUIRED_ENGINES.filter((id) => {
      const entry = this.registry.get(id);
      return !entry || entry.health !== EngineHealth.INITIALIZED;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update the health state of a registered engine.
   * Optionally records the last error message if health === ERROR.
   *
   * @throws If the engineId is not registered.
   */
  public setHealth(id: EngineId, health: EngineHealth, error?: string): void {
    const entry = this.registry.get(id);
    if (!entry) {
      throw new Error(
        `[EngineRegistry] setHealth called for unregistered engine: ${id}`,
      );
    }
    entry.health = health;
    if (error !== undefined) {
      entry.lastError = error;
    }
  }

  /**
   * Get the current health of a registered engine.
   * Returns UNREGISTERED if the engineId is not in the registry.
   */
  public getHealth(id: EngineId): EngineHealth {
    return this.registry.get(id)?.health ?? EngineHealth.UNREGISTERED;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINE GETTERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Retrieve the engine instance for a given ID, cast to type T.
   * Used by EngineOrchestrator to get typed references after registration.
   *
   * @throws If the engineId is not registered.
   */
  public get<T extends IEngine>(id: EngineId): T {
    const entry = this.registry.get(id);
    if (!entry) {
      throw new Error(
        `[EngineRegistry] get() called for unregistered engine: ${id}. ` +
        `Register the engine before retrieving it.`,
      );
    }
    return entry.instance as T;
  }

  /**
   * Get a snapshot of all engine health states.
   * Used by Orchestrator's getHealthReport() and test harness validation.
   */
  public getHealthReport(): Record<EngineId, EngineHealth> {
    const report = {} as Record<EngineId, EngineHealth>;
    for (const [id, entry] of this.registry) {
      report[id] = entry.health;
    }
    return report;
  }

  /**
   * Get the full EngineEntry for a given ID (includes lastError).
   * Returns undefined if not registered.
   */
  public getEntry(id: EngineId): EngineEntry | undefined {
    return this.registry.get(id);
  }

  /** How many engines are currently registered. */
  public get size(): number {
    return this.registry.size;
  }
}