/*
 * POINT ZERO ONE — BACKEND SHIELD ENGINE
 * /backend/src/game/engine/shield/ShieldEngine.ts
 *
 * Doctrine:
 * - backend shield simulation is authoritative
 * - shield consumes attacks, applies routed damage, manages repairs, and emits
 *   downstream breach/cascade surfaces without calling other engines directly
 * - economy consequences remain outside shield; cascade and card systems react later
 * - this engine returns EngineTickResult so orchestration gets diagnostics, not just state
 */

import {
  createEngineHealth,
  createEngineSignal,
  type EngineHealth,
  type EngineSignal,
  type EngineTickResult,
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
import {
  SHIELD_CONSTANTS,
  type QueueRejection,
  type RepairJob,
  type RepairLayerId,
} from './types';

export class ShieldEngine implements SimulationEngine {
  public readonly engineId = 'shield' as const;

  private readonly layers = new ShieldLayerManager();
  private readonly router = new AttackRouter();
  private readonly repairs = new ShieldRepairQueue();
  private readonly breachResolver = new BreachCascadeResolver();
  private readonly ux = new ShieldUXBridge();

  private readonly breachHistory: string[] = [];
  private readonly cascadeHistory: string[] = [];
  private pendingQueueRejections: QueueRejection[] = [];

  private health: EngineHealth = createEngineHealth(
    this.engineId,
    'HEALTHY',
    Date.now(),
    ['Shield engine initialized.'],
  );

  public reset(): void {
    this.repairs.reset();
    this.breachResolver.reset();
    this.breachHistory.length = 0;
    this.cascadeHistory.length = 0;
    this.pendingQueueRejections = [];
    this.health = createEngineHealth(
      this.engineId,
      'HEALTHY',
      Date.now(),
      ['Shield engine reset.'],
    );
  }

  public canRun(snapshot: RunStateSnapshot, _context?: TickContext): boolean {
    return snapshot.outcome === null && snapshot.shield.layers.length > 0;
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): EngineTickResult {
    if (!this.canRun(snapshot, context)) {
      return {
        snapshot,
        signals: Object.freeze([
          createEngineSignal(
            this.engineId,
            'INFO',
            'SHIELD_SKIPPED_TERMINAL_OUTCOME',
            'Shield engine skipped because run outcome is terminal.',
            snapshot.tick,
            [`outcome:${String(snapshot.outcome)}`],
          ),
        ]),
      };
    }

    try {
      const signals: EngineSignal[] = [];
      const previousLayers = snapshot.shield.layers;
      const wasFortified = this.layers.isFortified(previousLayers);

      let nextLayers: readonly ShieldLayerState[] = previousLayers;
      let blocked = snapshot.shield.blockedThisRun;
      let damaged = snapshot.shield.damagedThisRun;
      let breaches = snapshot.shield.breachesThisRun;

      const orderedAttacks = this.router.order(snapshot.battle.pendingAttacks);

      for (const attack of orderedAttacks) {
        const routed = this.router.resolve(attack, nextLayers);

        if (routed.requestedLayer === 'DIRECT') {
          signals.push(
            createEngineSignal(
              this.engineId,
              'INFO',
              'SHIELD_DIRECT_ATTACK_REINTERPRETED',
              `Direct attack ${attack.attackId} was reinterpreted through shield routing doctrine.`,
              snapshot.tick,
              [`category:${routed.category}`, `doctrine:${routed.doctrineType}`],
            ),
          );
        }

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

        if (damage.effectiveDamage > 0) {
          damaged += 1;
        }

        if (damage.blocked) {
          blocked += 1;
        }

        if (damage.breached) {
          breaches += 1;
          this.pushBounded(
            this.breachHistory,
            `${snapshot.tick}:${damage.actualLayerId}:${attack.attackId}`,
          );

          let cascadesTriggered = 0;
          let cascadeTemplateId: string | null = null;
          let cascadeChainId: string | null = null;

          if (damage.actualLayerId === 'L4') {
            const cascade = this.breachResolver.resolve(
              snapshot,
              nextLayers,
              damage.actualLayerId,
              snapshot.tick,
              context.bus,
            );

            nextLayers = cascade.layers;
            cascadesTriggered = cascade.triggered ? 1 : 0;
            cascadeTemplateId = cascade.templateId;
            cascadeChainId = cascade.chainId;

            if (cascade.triggered && cascadeTemplateId !== null && cascadeChainId !== null) {
              this.pushBounded(
                this.cascadeHistory,
                `${snapshot.tick}:${cascadeTemplateId}:${cascadeChainId}`,
              );
              signals.push(
                this.ux.buildCascadeSignal(
                  cascadeTemplateId,
                  cascadeChainId,
                  snapshot.tick,
                ),
              );
            }
          }

          this.ux.emitLayerBreached(context.bus, {
            attackId: attack.attackId,
            layerId: damage.actualLayerId,
            tick: snapshot.tick,
            cascadesTriggered,
          });

          signals.push(
            createEngineSignal(
              this.engineId,
              damage.actualLayerId === 'L4' ? 'ERROR' : 'WARN',
              'SHIELD_LAYER_BREACHED',
              `${damage.actualLayerId} breached after ${routed.doctrineType}.`,
              snapshot.tick,
              [
                `attack:${attack.attackId}`,
                `layer:${damage.actualLayerId}`,
                `pre:${String(damage.preHitIntegrity)}`,
                `post:${String(damage.postHitIntegrity)}`,
                `doctrine:${routed.doctrineType}`,
              ],
            ),
          );
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
      const isFortified = this.layers.isFortified(nextLayers);

      const nextSnapshot: RunStateSnapshot = {
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

      signals.push(
        ...this.ux.buildTransitionSignals(previousLayers, nextLayers, snapshot.tick),
      );
      signals.push(
        ...this.ux.buildFortifiedSignals(wasFortified, isFortified, snapshot.tick),
      );

      if (this.pendingQueueRejections.length > 0) {
        signals.push(
          ...this.ux.buildQueueRejectionSignals(this.pendingQueueRejections),
        );
        this.pendingQueueRejections = [];
      }

      if (
        orderedAttacks.length === 0 &&
        dueRepairs.length === 0 &&
        this.repairs.size() === 0
      ) {
        signals.push(
          createEngineSignal(
            this.engineId,
            'INFO',
            'SHIELD_IDLE_TICK',
            'Shield tick completed with no attacks and no active repairs.',
            snapshot.tick,
          ),
        );
      }

      this.health = createEngineHealth(
        this.engineId,
        this.resolveHealthStatus(nextLayers, breaches),
        context.nowMs,
        this.buildHealthNotes(nextLayers, weakestLayerId),
      );

      return {
        snapshot: nextSnapshot,
        signals: Object.freeze(signals),
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown shield engine failure.';

      this.health = createEngineHealth(
        this.engineId,
        'FAILED',
        context.nowMs,
        [message],
      );

      throw error;
    }
  }

  public queueRepair(
    tick: number,
    layerId: RepairLayerId,
    amount: number,
    durationTicks = 1,
    source: RepairJob['source'] = 'CARD',
    tags: readonly string[] = [],
  ): boolean {
    const queued = this.repairs.enqueue({
      tick,
      layerId,
      amount,
      durationTicks,
      source,
      tags,
    });

    if (queued !== null) {
      return true;
    }

    this.pendingQueueRejections = [
      ...this.pendingQueueRejections,
      {
        tick,
        layerId,
        amount: Math.max(0, Math.round(amount)),
        durationTicks: Math.max(1, Math.round(durationTicks)),
        source,
      },
    ];

    return false;
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

  public getCascadeCount(): number {
    return this.breachResolver.getCascadeCount();
  }

  public getActiveRepairJobs(): readonly RepairJob[] {
    return this.repairs.getActiveJobs();
  }

  public getBreachHistory(): readonly string[] {
    return Object.freeze([...this.breachHistory]);
  }

  public getCascadeHistory(): readonly string[] {
    return Object.freeze([...this.cascadeHistory]);
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

    if (
      weakestRatio < SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD ||
      totalBreaches > 0 ||
      this.pendingQueueRejections.length > 0
    ) {
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
      `breachHistory=${this.breachHistory.length}`,
      `cascadeHistory=${this.cascadeHistory.length}`,
    ];
  }

  private pushBounded(buffer: string[], value: string): void {
    buffer.push(value);
    if (buffer.length > SHIELD_CONSTANTS.MAX_HISTORY_DEPTH) {
      buffer.shift();
    }
  }
}