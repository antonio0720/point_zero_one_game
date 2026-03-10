/*
 * POINT ZERO ONE — BACKEND SHIELD LAYER MANAGER
 * /backend/src/game/engine/shield/ShieldLayerManager.ts
 *
 * Doctrine:
 * - layer state updates are pure and deterministic
 * - no overflow damage bleeds into the next layer
 * - regen is post-damage and skips the same tick a layer breaches
 * - L4 breach never directly calls cascade; it only prepares state for the resolver
 */

import type { ShieldLayerId } from '../core/GamePrimitives';
import type { ShieldLayerState } from '../core/RunStateSnapshot';
import {
  buildShieldLayerState,
  getLayerConfig,
  SHIELD_CONSTANTS,
  SHIELD_LAYER_ORDER,
  type DamageResolution,
} from './types';

export class ShieldLayerManager {
  public regenerate(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): readonly ShieldLayerState[] {
    return layers.map((layer) => {
      const config = getLayerConfig(layer.layerId);

      const skipForFreshBreach =
        layer.breached && layer.lastDamagedTick === tick;

      if (skipForFreshBreach || layer.current >= layer.max) {
        return buildShieldLayerState(
          layer.layerId,
          layer.current,
          layer.lastDamagedTick,
          layer.lastRecoveredTick,
        );
      }

      const regenRate = layer.breached
        ? config.breachedRegenRate
        : config.passiveRegenRate;

      if (regenRate <= 0) {
        return buildShieldLayerState(
          layer.layerId,
          layer.current,
          layer.lastDamagedTick,
          layer.lastRecoveredTick,
        );
      }

      const nextCurrent = Math.min(layer.max, layer.current + regenRate);

      return buildShieldLayerState(
        layer.layerId,
        nextCurrent,
        layer.lastDamagedTick,
        nextCurrent > layer.current ? tick : layer.lastRecoveredTick,
      );
    });
  }

  public applyRepair(
    layers: readonly ShieldLayerState[],
    layerId: ShieldLayerId | 'ALL',
    amount: number,
    tick: number,
  ): {
    readonly layers: readonly ShieldLayerState[];
    readonly applied: number;
  } {
    if (amount <= 0) {
      return { layers, applied: 0 };
    }

    let applied = 0;

    const nextLayers = layers.map((layer) => {
      if (layerId !== 'ALL' && layer.layerId !== layerId) {
        return layer;
      }

      const nextCurrent = Math.min(layer.max, layer.current + amount);
      const delta = nextCurrent - layer.current;
      applied += delta;

      return buildShieldLayerState(
        layer.layerId,
        nextCurrent,
        layer.lastDamagedTick,
        delta > 0 ? tick : layer.lastRecoveredTick,
      );
    });

    return {
      layers: nextLayers,
      applied,
    };
  }

  public applyDamage(
    layers: readonly ShieldLayerState[],
    targetLayer: ShieldLayerId,
    magnitude: number,
    tick: number,
    options: {
      readonly fortified: boolean;
      readonly bypassDeflection: boolean;
    },
  ): DamageResolution {
    const target = layers.find((layer) => layer.layerId === targetLayer);

    if (target === undefined) {
      throw new Error(`Unknown shield layer: ${targetLayer}`);
    }

    const preHitIntegrity = target.current;
    const deflectionApplied = options.bypassDeflection
      ? 0
      : this.computeDeflection(target.integrityRatio, options.fortified);

    const effectiveDamage = Math.max(
      0,
      Math.round(Math.max(0, magnitude) * (1 - deflectionApplied)),
    );

    const postHitIntegrity = Math.max(0, preHitIntegrity - effectiveDamage);
    const breached = preHitIntegrity > 0 && postHitIntegrity === 0;
    const wasAlreadyBreached = preHitIntegrity === 0;
    const blocked = !breached;

    const nextLayers = layers.map((layer) => {
      if (layer.layerId !== targetLayer) {
        return layer;
      }

      return buildShieldLayerState(
        layer.layerId,
        postHitIntegrity,
        effectiveDamage > 0 ? tick : layer.lastDamagedTick,
        layer.lastRecoveredTick,
      );
    });

    return {
      layers: nextLayers,
      actualLayerId: targetLayer,
      fallbackLayerId: null,
      effectiveDamage,
      deflectionApplied,
      preHitIntegrity,
      postHitIntegrity,
      breached,
      wasAlreadyBreached,
      blocked,
    };
  }

  public applyCascadeCrack(
    layers: readonly ShieldLayerState[],
    tick: number,
  ): readonly ShieldLayerState[] {
    return layers.map((layer) => {
      if (layer.layerId === 'L4') {
        return buildShieldLayerState(
          layer.layerId,
          layer.current,
          layer.lastDamagedTick,
          layer.lastRecoveredTick,
        );
      }

      const crackTarget = Math.floor(
        layer.max * SHIELD_CONSTANTS.CASCADE_CRACK_RATIO,
      );

      const nextCurrent =
        layer.current > crackTarget ? crackTarget : layer.current;

      return buildShieldLayerState(
        layer.layerId,
        nextCurrent,
        nextCurrent < layer.current ? tick : layer.lastDamagedTick,
        layer.lastRecoveredTick,
      );
    });
  }

  public weakestLayerId(layers: readonly ShieldLayerState[]): ShieldLayerId {
    return [...layers].sort((left, right) => {
      if (left.integrityRatio !== right.integrityRatio) {
        return left.integrityRatio - right.integrityRatio;
      }

      return (
        SHIELD_LAYER_ORDER.indexOf(right.layerId) -
        SHIELD_LAYER_ORDER.indexOf(left.layerId)
      );
    })[0]?.layerId ?? 'L4';
  }

  public weakestLayerRatio(layers: readonly ShieldLayerState[]): number {
    const weakest = layers.find(
      (layer) => layer.layerId === this.weakestLayerId(layers),
    );

    return weakest?.integrityRatio ?? 0;
  }

  public overallIntegrityRatio(
    layers: readonly ShieldLayerState[],
  ): number {
    if (layers.length === 0) {
      return 0;
    }

    const total = layers.reduce((sum, layer) => sum + layer.integrityRatio, 0);
    return total / layers.length;
  }

  public isFortified(layers: readonly ShieldLayerState[]): boolean {
    return layers.every(
      (layer) =>
        layer.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
    );
  }

  private computeDeflection(
    integrityRatio: number,
    fortified: boolean,
  ): number {
    const base =
      integrityRatio >= 1
        ? SHIELD_CONSTANTS.DEFLECTION_FULL_INTEGRITY
        : integrityRatio >= 0.5
          ? (integrityRatio - 0.5) * 0.2
          : 0;

    const bonus = fortified
      ? SHIELD_CONSTANTS.FORTIFIED_BONUS_DEFLECT
      : 0;

    return Math.min(base + bonus, SHIELD_CONSTANTS.DEFLECTION_MAX);
  }
}