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

import type { EngineHealth, SimulationEngine, TickContext } from '../core/EngineContracts';
import type { AttackEvent } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { ShieldLayerManager } from './ShieldLayerManager';
import { AttackRouter } from './AttackRouter';
import { ShieldRepairQueue } from './ShieldRepairQueue';
import { BreachCascadeResolver } from './BreachCascadeResolver';

export class ShieldEngine implements SimulationEngine {
  public readonly engineId = 'shield' as const;
  private readonly layers = new ShieldLayerManager();
  private readonly router = new AttackRouter();
  private readonly repairs = new ShieldRepairQueue();
  private readonly breachResolver = new BreachCascadeResolver();

  public reset(): void {
    this.repairs.reset();
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    let layers = this.layers.regenerate(snapshot.shield.layers);

    for (const repair of this.repairs.due(snapshot.tick)) {
      layers = layers.map((layer) => {
        if (repair.layerId !== 'ALL' && repair.layerId !== layer.layerId) {
          return layer;
        }
        return { ...layer, current: Math.min(layer.max, layer.current + repair.amount) };
      });
    }

    let blocked = snapshot.shield.blockedThisRun;
    let damaged = snapshot.shield.damagedThisRun;
    let breaches = snapshot.shield.breachesThisRun;
    const unresolvedDirect: AttackEvent[] = [];

    for (const attack of this.router.order(snapshot.battle.pendingAttacks)) {
      if (attack.targetLayer === 'DIRECT') {
        unresolvedDirect.push(attack);
        continue;
      }
      const result = this.layers.applyDamage(layers, attack.targetLayer, attack.magnitude);
      layers = result.layers;
      damaged += 1;
      if (result.breached) {
        breaches += 1;
        context.bus.emit('shield.breached', {
          attackId: attack.attackId,
          layerId: result.actualLayerId,
          tick: snapshot.tick,
          cascadesTriggered: this.breachResolver.resolveCascadeCount(1),
        });
      } else {
        blocked += 1;
      }
    }

    return {
      ...snapshot,
      economy: {
        ...snapshot.economy,
        cash: snapshot.economy.cash - unresolvedDirect.reduce((sum, attack) => sum + attack.magnitude * (attack.category === 'EXTRACTION' ? 40 : 10), 0),
      },
      battle: {
        ...snapshot.battle,
        pendingAttacks: [],
      },
      shield: {
        layers,
        weakestLayerId: this.layers.weakestLayerId(layers),
        blockedThisRun: blocked,
        damagedThisRun: damaged,
        breachesThisRun: breaches,
        repairQueueDepth: this.repairs.size(),
      },
    };
  }

  public queueRepair(tick: number, layerId: 'L1' | 'L2' | 'L3' | 'L4' | 'ALL', amount: number): void {
    this.repairs.enqueue({ tick, layerId, amount });
  }

  public getHealth(): EngineHealth {
    return { engineId: this.engineId, status: 'HEALTHY', updatedAt: Date.now() };
  }
}
