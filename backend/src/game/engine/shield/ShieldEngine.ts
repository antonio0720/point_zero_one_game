/*
 * POINT ZERO ONE — BACKEND SHIELD ENGINE
 * /backend/src/game/engine/shield/ShieldEngine.ts
 *
 * Doctrine:
 * - backend is authoritative
 * - attacks are routed here through AttackRouter
 * - shield damage stays in shield state
 * - direct economy mutation does not happen here
 * - L4 breach emits downstream cascade creation rather than hard-calling cascade logic
 */

import {
  createEngineHealth,
  type EngineHealth,
  type SimulationEngine,
  type TickContext,
} from '../core/EngineContracts';
import type { ShieldLayerId } from '../core/GamePrimitives';
import type {
  RunStateSnapshot,
  ShieldLayerState,
} from '../core/RunStateSnapshot';
import { AttackRouter } from './AttackRouter';
import { BreachCascadeResolver } from './BreachCascadeResolver';
import { ShieldLayerManager } from './ShieldLayerManager';
import { ShieldRepairQueue } from './ShieldRepairQueue';
import { ShieldUXBridge } from './ShieldUXBridge';

export class ShieldEngine implements SimulationEngine {
  public readonly engineId = 'shield' as const;

  private readonly layers = new ShieldLayerManager();
  private readonly router = new AttackRouter();
  private readonly repairs = new ShieldRepairQueue();
  private readonly breachResolver = new BreachCascadeResolver();
  private readonly ux = new ShieldUXBridge();

  private health: EngineHealth = createEngineHealth(
    this.engineId,
    'HEALTHY',
    Date.now(),
    ['Shield engine initialized.'],
  );

  public reset(): void {
    this.repairs.reset();
    this.breachResolver.reset();
    this.health = createEngineHealth(
      this.engineId,
      'HEALTHY',
      Date.now(),
      ['Shield engine reset.'],
    );
  }

  public canRun(snapshot: RunStateSnapshot): boolean {
    return snapshot.outcome === null && snapshot.shield.layers.length > 0;
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    if (!this.canRun(snapshot)) {
      return snapshot;
    }

    let nextLayers: readonly ShieldLayerState[] = snapshot.shield.layers;
    let blocked = snapshot.shield.blockedThisRun;
    let damaged = snapshot.shield.damagedThisRun;
    let breaches = snapshot.shield.breachesThisRun;

    const orderedAttacks = this.router.order(snapshot.battle.pendingAttacks);

    for (const attack of orderedAttacks) {
      const routed = this.router.resolve(attack, nextLayers);
      const effectiveTarget = this.router.resolveEffectiveTarget(routed, nextLayers);
      const fortifiedBeforeHit = this.layers.isFortified(nextLayers);

      const damage = this.layers.applyDamage(
        nextLayers,
        effectiveTarget,
        routed.magnitude,
        snapshot.tick,
        {
          fortified: fortifiedBeforeHit,
          bypassDeflection: routed.bypassDeflection,
        },
      );

      nextLayers = damage.layers;
      damaged += 1;

      if (damage.blocked) {
        blocked += 1;
      }

      if (damage.breached) {
        breaches += 1;

        const cascade = this.breachResolver.resolve(
          snapshot,
          nextLayers,
          damage.actualLayerId,
          snapshot.tick,
          context.bus,
        );

        nextLayers = cascade.layers;

        this.ux.emitLayerBreached(context.bus, {
          attackId: attack.attackId,
          layerId: damage.actualLayerId,
          tick: snapshot.tick,
          cascadesTriggered: cascade.triggered ? 1 : 0,
        });
      }
    }

    const dueRepairs = this.repairs.due(snapshot.tick);
    for (const repair of dueRepairs) {
      const applied = this.layers.applyRepair(
        nextLayers,
        repair.layerId,
        repair.amount,
        snapshot.tick,
      );

      nextLayers = applied.layers;
    }

    nextLayers = this.layers.regenerate(nextLayers, snapshot.tick);

    const weakestLayerId = this.layers.weakestLayerId(nextLayers);
    const weakestLayerRatio = this.layers.weakestLayerRatio(nextLayers);

    this.health = createEngineHealth(
      this.engineId,
      this.resolveHealthStatus(nextLayers, breaches),
      context.nowMs,
      this.buildHealthNotes(nextLayers, weakestLayerId),
    );

    return {
      ...snapshot,
      battle: {
        ...snapshot.battle,
        pendingAttacks: [],
      },
      shield: {
        layers: nextLayers,
        weakestLayerId,
        weakestLayerRatio,
        blockedThisRun: blocked,
        damagedThisRun: damaged,
        breachesThisRun: breaches,
        repairQueueDepth: this.repairs.size(),
      },
    };
  }

  public queueRepair(
    tick: number,
    layerId: ShieldLayerId | 'ALL',
    amount: number,
    durationTicks = 1,
  ): boolean {
    return (
      this.repairs.enqueue({
        tick,
        layerId,
        amount,
        durationTicks,
        source: 'CARD',
      }) !== null
    );
  }

  public getHealth(): EngineHealth {
    return this.health;
  }

  public getOverallIntegrityPct(snapshot: RunStateSnapshot): number {
    return this.layers.overallIntegrityRatio(snapshot.shield.layers);
  }

  public getWeakestLayerId(snapshot: RunStateSnapshot): ShieldLayerId {
    return this.layers.weakestLayerId(snapshot.shield.layers);
  }

  private resolveHealthStatus(
    layers: readonly ShieldLayerState[],
    totalBreaches: number,
  ): EngineHealth['status'] {
    const weakestRatio = this.layers.weakestLayerRatio(layers);
    const allBreached = layers.every((layer) => layer.breached);

    if (allBreached) {
      return 'FAILED';
    }

    if (weakestRatio < 0.15 || totalBreaches > 0) {
      return 'DEGRADED';
    }

    return 'HEALTHY';
  }

  private buildHealthNotes(
    layers: readonly ShieldLayerState[],
    weakestLayerId: ShieldLayerId,
  ): readonly string[] {
    const weakest = layers.find((layer) => layer.layerId === weakestLayerId);

    return [
      `weakestLayer=${weakestLayerId}`,
      `weakestRatio=${(weakest?.integrityRatio ?? 0).toFixed(3)}`,
      `overallIntegrity=${this.layers.overallIntegrityRatio(layers).toFixed(3)}`,
      `repairQueueDepth=${this.repairs.size()}`,
      `cascadeCount=${this.breachResolver.getCascadeCount()}`,
    ];
  }
}