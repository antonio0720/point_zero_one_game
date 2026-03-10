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
 */

import type {
  EngineHealth,
  EngineHealthStatus,
  EngineId,
  SimulationEngine,
} from './EngineContracts';

export interface EngineRegistrationOptions {
  readonly allowReplace?: boolean;
}

export interface EngineRegistrySnapshot {
  readonly registeredIds: readonly EngineId[];
  readonly executionOrder: readonly EngineId[];
  readonly size: number;
  readonly missingFromCanonicalOrder: readonly EngineId[];
  readonly extraIds: readonly EngineId[];
}

const CANONICAL_ENGINE_ORDER: readonly EngineId[] = [
  'time',
  'pressure',
  'tension',
  'shield',
  'battle',
  'cascade',
  'sovereignty',
] as const;

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