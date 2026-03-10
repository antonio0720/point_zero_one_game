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
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { CascadeChainRegistry } from './CascadeChainRegistry';
import { CascadeQueueManager } from './CascadeQueueManager';
import { PositiveCascadeTracker } from './PositiveCascadeTracker';
import { RecoveryConditionChecker } from './RecoveryConditionChecker';

export class CascadeEngine implements SimulationEngine {
  public readonly engineId = 'cascade' as const;
  private readonly registry = new CascadeChainRegistry();
  private readonly queue = new CascadeQueueManager();
  private readonly positive = new PositiveCascadeTracker();
  private readonly recovery = new RecoveryConditionChecker();

  public reset(): void {}

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    const breachEvents = context.bus.peek('shield.breached');
    const newNegativeChains = breachEvents.map((event) => this.queue.create(snapshot, this.registry.get(this.templateForLayer(event.layerId)), `shield:${event.layerId}`));
    const newPositiveChains = this.positive.infer(snapshot).map((templateId) => this.queue.create(snapshot, this.registry.get(templateId), 'positive:tracker'));

    for (const chain of [...newNegativeChains, ...newPositiveChains]) {
      context.bus.emit('cascade.chain.created', { chainId: chain.chainId, templateId: chain.templateId, positive: chain.positive });
    }

    const activeChains = [...snapshot.cascade.activeChains, ...newNegativeChains, ...newPositiveChains].map((chain) => {
      if (chain.status !== 'ACTIVE') {
        return chain;
      }
      if (this.recovery.isRecovered(chain, snapshot.cards.hand, snapshot.economy.cash)) {
        return { ...chain, status: 'BROKEN' as const };
      }
      return chain;
    });

    let cashDelta = 0;
    let incomeDelta = 0;
    let heatDelta = 0;
    let shieldDelta = 0;
    let completedChains = snapshot.cascade.completedChains;
    let brokenChains = snapshot.cascade.brokenChains;

    const progressedChains = activeChains.map((chain) => {
      if (chain.status === 'BROKEN') {
        brokenChains += 1;
        return chain;
      }
      const dueLinks = chain.links.filter((link) => link.scheduledTick <= snapshot.tick);
      for (const link of dueLinks) {
        cashDelta += link.effect.cashDelta ?? 0;
        incomeDelta += link.effect.incomeDelta ?? 0;
        heatDelta += link.effect.heatDelta ?? 0;
        shieldDelta += link.effect.shieldDelta ?? 0;
        context.bus.emit('cascade.chain.progressed', { chainId: chain.chainId, linkId: link.linkId, tick: snapshot.tick });
      }
      const remainingLinks = chain.links.filter((link) => link.scheduledTick > snapshot.tick);
      if (remainingLinks.length === 0) {
        completedChains += 1;
        return { ...chain, status: 'COMPLETED' as const, links: remainingLinks };
      }
      return { ...chain, links: remainingLinks };
    });

    const layers = shieldDelta === 0
      ? snapshot.shield.layers
      : snapshot.shield.layers.map((layer) => ({ ...layer, current: Math.max(0, Math.min(layer.max, layer.current + shieldDelta)) }));

    return {
      ...snapshot,
      economy: {
        ...snapshot.economy,
        cash: snapshot.economy.cash + cashDelta,
        incomePerTick: snapshot.economy.incomePerTick + incomeDelta,
        haterHeat: Math.max(0, snapshot.economy.haterHeat + heatDelta),
      },
      shield: {
        ...snapshot.shield,
        layers,
      },
      cascade: {
        activeChains: progressedChains.filter((chain) => chain.status === 'ACTIVE'),
        positiveTrackers: [...new Set([...snapshot.cascade.positiveTrackers, ...newPositiveChains.map((chain) => chain.templateId)])],
        brokenChains,
        completedChains,
        repeatedTriggerCounts: breachEvents.reduce<Record<string, number>>((acc, event) => {
          const key = `shield:${event.layerId}`;
          acc[key] = (acc[key] ?? snapshot.cascade.repeatedTriggerCounts[key] ?? 0) + 1;
          return acc;
        }, { ...snapshot.cascade.repeatedTriggerCounts }),
      },
    };
  }

  public getHealth(): EngineHealth {
    return { engineId: this.engineId, status: 'HEALTHY', updatedAt: Date.now() };
  }

  private templateForLayer(layerId: 'L1' | 'L2' | 'L3' | 'L4'): string {
    switch (layerId) {
      case 'L1': return 'LIQUIDITY_SPIRAL';
      case 'L2': return 'CREDIT_FREEZE';
      case 'L3': return 'INCOME_SHOCK';
      case 'L4': return 'NETWORK_LOCKDOWN';
    }
  }
}
