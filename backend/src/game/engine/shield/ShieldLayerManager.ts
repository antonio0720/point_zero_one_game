/*
 * POINT ZERO ONE — BACKEND SHIELD LAYER MANAGER
 * /backend/src/game/engine/shield/ShieldLayerManager.ts
 *
 * Doctrine:
 * - layer state updates are pure and deterministic
 * - damage never overflows across shield layers
 * - regen happens after the tick's attacks and skips the same tick a layer breaches
 * - all calculations are replay-safe and snapshot-driven
 */

import type { ShieldLayerId } from '../core/GamePrimitives';
import type { ShieldLayerState } from '../core/RunStateSnapshot';
import {
  buildShieldLayerState,
  getLayerConfig,
  layerOrderIndex,
  SHIELD_CONSTANTS,
  SHIELD_LAYER_ORDER,
  type DamageResolution,
  type RepairLayerId,
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
    layerId: RepairLayerId,
    amount: number,
    tick: number,
  ): {
    readonly layers: readonly ShieldLayerState[];
    readonly applied: number;
  } {
    if (amount <= 0) {
      return {
        layers,
        applied: 0,
      };
    }

    let applied = 0;

    const nextLayers = layers.map((layer) => {
      const shouldApply = layerId === 'ALL' || layer.layerId === layerId;
      if (!shouldApply) {
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
    const blocked = postHitIntegrity > 0;

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

  public weakestLayerId(
    layers: readonly ShieldLayerState[],
  ): ShieldLayerId {
    return [...layers].sort((left, right) => {
      if (left.integrityRatio !== right.integrityRatio) {
        return left.integrityRatio - right.integrityRatio;
      }

      return layerOrderIndex(right.layerId) - layerOrderIndex(left.layerId);
    })[0]?.layerId ?? 'L4';
  }

  public weakestLayerRatio(
    layers: readonly ShieldLayerState[],
  ): number {
    const weakestId = this.weakestLayerId(layers);
    return layers.find((layer) => layer.layerId === weakestId)?.integrityRatio ?? 0;
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

  public isFortified(
    layers: readonly ShieldLayerState[],
  ): boolean {
    return layers.every(
      (layer) =>
        layer.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
    );
  }

  public getLayer(
    layers: readonly ShieldLayerState[],
    layerId: ShieldLayerId,
  ): ShieldLayerState {
    const layer = layers.find((candidate) => candidate.layerId === layerId);
    if (layer === undefined) {
      throw new Error(`Unknown shield layer: ${layerId}`);
    }

    return layer;
  }

  public createInitialLayers(): readonly ShieldLayerState[] {
    return SHIELD_LAYER_ORDER.map((layerId) =>
      buildShieldLayerState(layerId, getLayerConfig(layerId).max, null, null),
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
          ? (integrityRatio - 0.5) * 0.20
          : 0;

    const bonus = fortified
      ? SHIELD_CONSTANTS.FORTIFIED_BONUS_DEFLECT
      : 0;

    return Math.min(base + bonus, SHIELD_CONSTANTS.DEFLECTION_MAX);
  }
}