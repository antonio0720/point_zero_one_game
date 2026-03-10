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

import type { ShieldLayerId } from '../core/GamePrimitives';
import type { ShieldLayerState } from '../core/RunStateSnapshot';

export class ShieldLayerManager {
  public regenerate(layers: ShieldLayerState[]): ShieldLayerState[] {
    return layers.map((layer) => ({ ...layer, current: Math.min(layer.max, layer.current + layer.regenPerTick) }));
  }

  public weakestLayerId(layers: ShieldLayerState[]): ShieldLayerId {
    return [...layers].sort((left, right) => (left.current / left.max) - (right.current / right.max))[0].layerId;
  }

  public applyDamage(layers: ShieldLayerState[], preferredLayer: ShieldLayerId, magnitude: number): { layers: ShieldLayerState[]; breached: boolean; actualLayerId: ShieldLayerId } {
    const targets = this.routeTargets(layers, preferredLayer);
    const actualLayerId = targets[0];
    const nextLayers = layers.map((layer) => {
      if (layer.layerId !== actualLayerId) {
        return layer;
      }
      return { ...layer, current: Math.max(0, layer.current - magnitude) };
    });
    const breached = nextLayers.find((layer) => layer.layerId === actualLayerId)?.current === 0;
    return { layers: nextLayers, breached, actualLayerId };
  }

  private routeTargets(layers: ShieldLayerState[], preferred: ShieldLayerId): ShieldLayerId[] {
    const order: ShieldLayerId[] = ['L1', 'L2', 'L3', 'L4'];
    const preferredIndex = order.indexOf(preferred);
    const candidates = [...order.slice(preferredIndex), ...order.slice(0, preferredIndex)];
    return candidates.filter((layerId) => (layers.find((layer) => layer.layerId === layerId)?.current ?? 0) > 0).concat(['L4']);
  }
}
