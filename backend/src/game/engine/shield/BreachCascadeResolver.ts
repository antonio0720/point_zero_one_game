/*
 * POINT ZERO ONE — BACKEND SHIELD BREACH CASCADE RESOLVER
 * /backend/src/game/engine/shield/BreachCascadeResolver.ts
 *
 * Doctrine:
 * - L4 breach is the cascade gate
 * - shield emits downstream cascade creation; it never imports CascadeEngine
 * - cascade crack only reduces outer layer integrity, never increases it
 */

import type { EventBus } from '../core/EventBus';
import type { EngineEventMap, ShieldLayerId } from '../core/GamePrimitives';
import type { RunStateSnapshot, ShieldLayerState } from '../core/RunStateSnapshot';
import { ShieldLayerManager } from './ShieldLayerManager';
import type { CascadeResolution } from './types';

export class BreachCascadeResolver {
  private readonly layerManager = new ShieldLayerManager();
  private cascadeCount = 0;

  public resolve(
    snapshot: RunStateSnapshot,
    layers: readonly ShieldLayerState[],
    breachedLayerId: ShieldLayerId,
    tick: number,
    bus: EventBus<EngineEventMap & Record<string, unknown>>,
  ): CascadeResolution {
    if (breachedLayerId !== 'L4') {
      return {
        layers,
        triggered: false,
        chainId: null,
        templateId: null,
        cascadeCount: this.cascadeCount,
      };
    }

    this.cascadeCount += 1;

    const templateId = this.resolveTemplate(breachedLayerId);
    const chainId = `${snapshot.runId}:cascade:${tick}:${this.cascadeCount}`;
    const crackedLayers = this.layerManager.applyCascadeCrack(layers, tick);

    bus.emit('cascade.chain.created', {
      chainId,
      templateId,
      positive: false,
    });

    return {
      layers: crackedLayers,
      triggered: true,
      chainId,
      templateId,
      cascadeCount: this.cascadeCount,
    };
  }

  public resolveTemplate(layerId: ShieldLayerId): string {
    switch (layerId) {
      case 'L1':
        return 'LIQUIDITY_SPIRAL';
      case 'L2':
        return 'CREDIT_FREEZE';
      case 'L3':
        return 'INCOME_SHOCK';
      case 'L4':
        return 'NETWORK_LOCKDOWN';
      default:
        return 'GENERIC_SHIELD_FAILURE';
    }
  }

  public resolveCascadeCount(breaches: number): number {
    return this.cascadeCount + Math.max(0, breaches);
  }

  public getCascadeCount(): number {
    return this.cascadeCount;
  }

  public reset(): void {
    this.cascadeCount = 0;
  }
}