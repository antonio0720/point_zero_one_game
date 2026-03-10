/*
 * POINT ZERO ONE — BACKEND CASCADE ENGINE
 * /backend/src/game/engine/cascade/CascadeEngine.ts
 *
 * Doctrine:
 * - backend is the authoritative cascade runtime
 * - chains are triggered from authoritative events, not UI assumptions
 * - recovery and progression are deterministic per tick
 * - shield/economy writes must return a self-consistent snapshot
 */

import type { CascadeChainInstance, EffectPayload } from '../core/GamePrimitives';
import type { EngineHealth, SimulationEngine, TickContext } from '../core/EngineContracts';
import type { RunStateSnapshot, ShieldLayerState, ShieldState, EconomyState } from '../core/RunStateSnapshot';
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

  private health: EngineHealth = {
    engineId: this.engineId,
    status: 'HEALTHY',
    updatedAt: Date.now(),
    notes: ['Cascade engine initialized.'],
  };

  public reset(): void {
    this.health = {
      engineId: this.engineId,
      status: 'HEALTHY',
      updatedAt: Date.now(),
      notes: ['Cascade engine reset.'],
    };
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): RunStateSnapshot {
    try {
      const breachEvents = this.collectCurrentTickBreaches(snapshot, context);

      const negativeChains = this.buildNegativeChains(snapshot, breachEvents);
      const positiveChains = this.buildPositiveChains(snapshot);

      for (const chain of [...negativeChains, ...positiveChains]) {
        context.bus.emit('cascade.chain.created', {
          chainId: chain.chainId,
          templateId: chain.templateId,
          positive: chain.positive,
        });
      }

      const workingChains = [
        ...snapshot.cascade.activeChains,
        ...negativeChains,
        ...positiveChains,
      ];

      let cashDelta = 0;
      let incomeDelta = 0;
      let heatDelta = 0;
      let shieldDelta = 0;

      let completedChains = snapshot.cascade.completedChains;
      let brokenChains = snapshot.cascade.brokenChains;

      let anyResolution =
        negativeChains.length > 0 || positiveChains.length > 0;

      const nextActiveChains: CascadeChainInstance[] = [];

      for (const chain of workingChains) {
        if (chain.status !== 'ACTIVE') {
          continue;
        }

        const template = this.registry.get(chain.templateId);

        if (!template.positive && this.recovery.isRecovered(chain, snapshot, template)) {
          brokenChains += 1;
          anyResolution = true;

          context.bus.emit('cascade.chain.broken', {
            chainId: chain.chainId,
            templateId: chain.templateId,
            tick: snapshot.tick,
          });

          continue;
        }

        const dueLinks = chain.links.filter((link) => link.scheduledTick <= snapshot.tick);

        if (dueLinks.length === 0) {
          nextActiveChains.push(chain);
          continue;
        }

        anyResolution = true;

        for (const link of dueLinks) {
          cashDelta += link.effect.cashDelta ?? 0;
          incomeDelta += link.effect.incomeDelta ?? 0;
          heatDelta += link.effect.heatDelta ?? 0;
          shieldDelta += link.effect.shieldDelta ?? 0;

          context.bus.emit('cascade.chain.progressed', {
            chainId: chain.chainId,
            linkId: link.linkId,
            tick: snapshot.tick,
          });

          this.emitNonNativeEffects(context, chain.chainId, snapshot.tick, link.effect);
        }

        const remainingLinks = chain.links.filter((link) => link.scheduledTick > snapshot.tick);

        if (remainingLinks.length === 0) {
          completedChains += 1;

          context.bus.emit('cascade.chain.completed', {
            chainId: chain.chainId,
            templateId: chain.templateId,
            tick: snapshot.tick,
          });

          continue;
        }

        nextActiveChains.push({
          ...chain,
          links: remainingLinks,
        });
      }

      const nextEconomy = this.applyEconomyDelta(snapshot.economy, {
        cashDelta,
        incomeDelta,
        heatDelta,
      });

      const nextShield = this.applyShieldDelta(snapshot.shield, snapshot.tick, shieldDelta);

      const nextRepeatedTriggerCounts = {
        ...snapshot.cascade.repeatedTriggerCounts,
      };

      for (const event of breachEvents) {
        const key = `shield:${event.layerId}`;
        nextRepeatedTriggerCounts[key] = (nextRepeatedTriggerCounts[key] ?? 0) + 1;
      }

      const nextSnapshot: RunStateSnapshot = {
        ...snapshot,
        economy: nextEconomy,
        shield: nextShield,
        cascade: {
          activeChains: nextActiveChains,
          positiveTrackers: this.mergePositiveTrackers(snapshot, positiveChains),
          brokenChains,
          completedChains,
          repeatedTriggerCounts: nextRepeatedTriggerCounts,
          lastResolvedTick: anyResolution
            ? snapshot.tick
            : snapshot.cascade.lastResolvedTick,
        },
      };

      this.health = {
        engineId: this.engineId,
        status: 'HEALTHY',
        updatedAt: context.nowMs,
      };

      return nextSnapshot;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown cascade engine failure.';

      this.health = {
        engineId: this.engineId,
        status: 'FAILED',
        updatedAt: context.nowMs,
        notes: [message],
      };

      throw error;
    }
  }

  public getHealth(): EngineHealth {
    return this.health;
  }

  private collectCurrentTickBreaches(
    snapshot: RunStateSnapshot,
    context: TickContext,
  ): Array<{ attackId: string; layerId: 'L1' | 'L2' | 'L3' | 'L4'; tick: number; cascadesTriggered: number }> {
    const raw = context.bus.peek('shield.breached');
    const deduped: Array<{ attackId: string; layerId: 'L1' | 'L2' | 'L3' | 'L4'; tick: number; cascadesTriggered: number }> = [];
    const seen = new Set<string>();

    for (const event of raw) {
      if (event.tick !== snapshot.tick) {
        continue;
      }

      const dedupeKey = `${event.attackId}:${event.layerId}:${event.tick}`;
      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      deduped.push(event);
    }

    return deduped;
  }

  private buildNegativeChains(
    snapshot: RunStateSnapshot,
    breachEvents: ReadonlyArray<{ attackId: string; layerId: 'L1' | 'L2' | 'L3' | 'L4'; tick: number; cascadesTriggered: number }>,
  ): CascadeChainInstance[] {
    const created: CascadeChainInstance[] = [];
    const pendingTriggerCounts: Record<string, number> = {};

    for (const breach of breachEvents) {
      const templateId = this.registry.forLayer(breach.layerId);
      const template = this.registry.get(templateId);
      const trigger = `shield:${breach.layerId}`;

      if (
        !this.queue.canCreate(
          snapshot,
          template,
          trigger,
          created,
          pendingTriggerCounts[trigger] ?? 0,
        )
      ) {
        continue;
      }

      created.push(this.queue.create(snapshot, template, trigger, created));
      pendingTriggerCounts[trigger] = (pendingTriggerCounts[trigger] ?? 0) + 1;
    }

    return created;
  }

  private buildPositiveChains(snapshot: RunStateSnapshot): CascadeChainInstance[] {
    const created: CascadeChainInstance[] = [];
    const inferred = this.positive.infer(snapshot);

    for (const templateId of inferred) {
      const template = this.registry.get(templateId);
      const trigger = `positive:${templateId}`;

      if (!this.queue.canCreate(snapshot, template, trigger, created, 0)) {
        continue;
      }

      created.push(this.queue.create(snapshot, template, trigger, created));
    }

    return created;
  }

  private applyEconomyDelta(
    economy: EconomyState,
    delta: {
      cashDelta: number;
      incomeDelta: number;
      heatDelta: number;
    },
  ): EconomyState {
    const cash = economy.cash + delta.cashDelta;
    const incomePerTick = economy.incomePerTick + delta.incomeDelta;
    const haterHeat = Math.max(0, economy.haterHeat + delta.heatDelta);
    const netWorth = economy.netWorth + delta.cashDelta;

    return {
      ...economy,
      cash,
      incomePerTick,
      haterHeat,
      netWorth,
    };
  }

  private applyShieldDelta(
    shield: ShieldState,
    tick: number,
    totalDelta: number,
  ): ShieldState {
    if (totalDelta === 0) {
      return shield;
    }

    const originalLayers = shield.layers.map((layer) => ({ ...layer }));
    const nextLayers = shield.layers.map((layer) => ({ ...layer }));

    if (totalDelta < 0) {
      let remainingDamage = Math.abs(totalDelta);
      const order = [...nextLayers].sort(
        (a, b) => a.integrityRatio - b.integrityRatio || a.current - b.current,
      );

      for (const layer of order) {
        if (remainingDamage <= 0) {
          break;
        }

        const applied = Math.min(remainingDamage, layer.current);
        if (applied <= 0) {
          continue;
        }

        layer.current -= applied;
        remainingDamage -= applied;
      }
    } else {
      let remainingRecovery = totalDelta;
      const order = [...nextLayers].sort(
        (a, b) => a.integrityRatio - b.integrityRatio || a.current - b.current,
      );

      for (const layer of order) {
        if (remainingRecovery <= 0) {
          break;
        }

        const capacity = layer.max - layer.current;
        const applied = Math.min(remainingRecovery, capacity);
        if (applied <= 0) {
          continue;
        }

        layer.current += applied;
        remainingRecovery -= applied;
      }
    }

    const normalizedLayers = nextLayers.map((layer) => {
      const previous = originalLayers.find((candidate) => candidate.layerId === layer.layerId)!;
      const current = Math.max(0, Math.min(layer.max, layer.current));
      const integrityRatio = layer.max <= 0 ? 0 : current / layer.max;
      const breached = current <= 0;

      return {
        ...layer,
        current,
        breached,
        integrityRatio,
        lastDamagedTick:
          current < previous.current
            ? tick
            : previous.lastDamagedTick,
        lastRecoveredTick:
          current > previous.current
            ? tick
            : previous.lastRecoveredTick,
      };
    });

    const weakest = normalizedLayers.reduce(
      (best, layer) => {
        if (layer.integrityRatio < best.integrityRatio) {
          return {
            layerId: layer.layerId,
            integrityRatio: layer.integrityRatio,
          };
        }
        return best;
      },
      {
        layerId: normalizedLayers[0].layerId,
        integrityRatio: normalizedLayers[0].integrityRatio,
      },
    );

    const newlyBreachedCount = normalizedLayers.filter((layer) => {
      const previous = originalLayers.find((candidate) => candidate.layerId === layer.layerId)!;
      return !previous.breached && layer.breached;
    }).length;

    const damagedLayerCount = normalizedLayers.filter((layer) => {
      const previous = originalLayers.find((candidate) => candidate.layerId === layer.layerId)!;
      return layer.current < previous.current;
    }).length;

    return {
      ...shield,
      layers: normalizedLayers,
      weakestLayerId: weakest.layerId,
      weakestLayerRatio: weakest.integrityRatio,
      damagedThisRun:
        shield.damagedThisRun + damagedLayerCount,
      breachesThisRun:
        shield.breachesThisRun + newlyBreachedCount,
      repairQueueDepth: normalizedLayers.filter((layer) => layer.current < layer.max).length,
    };
  }

  private mergePositiveTrackers(
    snapshot: RunStateSnapshot,
    newlyCreatedPositiveChains: readonly CascadeChainInstance[],
  ): readonly string[] {
    return [
      ...new Set([
        ...snapshot.cascade.positiveTrackers,
        ...newlyCreatedPositiveChains.map((chain) => chain.templateId),
      ]),
    ];
  }

  private emitNonNativeEffects(
    context: TickContext,
    chainId: string,
    tick: number,
    effect: EffectPayload,
  ): void {
    if (effect.trustDelta !== undefined && effect.trustDelta !== 0) {
      context.bus.emit('cascade.effect.trust_delta', {
        chainId,
        tick,
        trustDelta: effect.trustDelta,
      });
    }

    if (effect.timeDeltaMs !== undefined && effect.timeDeltaMs !== 0) {
      context.bus.emit('cascade.effect.time_delta', {
        chainId,
        tick,
        timeDeltaMs: effect.timeDeltaMs,
      });
    }

    if (effect.divergenceDelta !== undefined && effect.divergenceDelta !== 0) {
      context.bus.emit('cascade.effect.divergence_delta', {
        chainId,
        tick,
        divergenceDelta: effect.divergenceDelta,
      });
    }

    if (effect.injectCards && effect.injectCards.length > 0) {
      context.bus.emit('cascade.effect.inject_cards', {
        chainId,
        tick,
        injectCards: [...effect.injectCards],
      });
    }
  }
}