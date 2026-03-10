/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import type { EngineId, EngineHealth, SimulationEngine } from './EngineContracts';

export class EngineRegistry {
  private readonly engines = new Map<EngineId, SimulationEngine>();
  private readonly order: EngineId[] = [];

  public register(engine: SimulationEngine): void {
    if (!this.engines.has(engine.engineId)) {
      this.order.push(engine.engineId);
    }
    this.engines.set(engine.engineId, engine);
  }

  public get(engineId: EngineId): SimulationEngine {
    const engine = this.engines.get(engineId);
    if (!engine) {
      throw new Error(`Engine not registered: ${engineId}`);
    }
    return engine;
  }

  public all(): SimulationEngine[] {
    return this.order.map((engineId) => this.get(engineId));
  }

  public reset(): void {
    for (const engine of this.all()) {
      engine.reset();
    }
  }

  public health(): EngineHealth[] {
    return this.all().map((engine) => engine.getHealth());
  }
}
