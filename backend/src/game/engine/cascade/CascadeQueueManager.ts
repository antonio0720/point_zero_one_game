/*
 * POINT ZERO ONE — BACKEND CASCADE QUEUE MANAGER
 * /backend/src/game/engine/cascade/CascadeQueueManager.ts
 *
 * Doctrine:
 * - chain scheduling must be deterministic
 * - link timing is mode-aware and pressure-aware
 * - repeated triggers can intensify outcomes, but never non-deterministically
 */

import { createDeterministicId } from '../core/Deterministic';
import type { CascadeChainInstance, EffectPayload } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { CascadeTemplate } from './types';

export class CascadeQueueManager {
  public canCreate(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
    pendingTriggerCount = 0,
  ): boolean {
    const activeOfType =
      snapshot.cascade.activeChains.filter(
        (chain) => chain.templateId === template.templateId && chain.status === 'ACTIVE',
      ).length +
      pendingChains.filter(
        (chain) => chain.templateId === template.templateId && chain.status === 'ACTIVE',
      ).length;

    if (activeOfType >= template.maxConcurrent) {
      return false;
    }

    const triggerCount =
      (snapshot.cascade.repeatedTriggerCounts[trigger] ?? 0) + pendingTriggerCount;

    if (triggerCount >= template.maxTriggersPerRun) {
      return false;
    }

    return true;
  }

  public create(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
  ): CascadeChainInstance {
    const instanceOrdinal =
      snapshot.cascade.activeChains.filter((chain) => chain.templateId === template.templateId).length +
      pendingChains.filter((chain) => chain.templateId === template.templateId).length;

    const pressureMultiplier = this.resolvePressureMultiplier(snapshot, template);
    const repeatCount = snapshot.cascade.repeatedTriggerCounts[trigger] ?? 0;
    const repeatMultiplier = Math.min(1.60, 1 + repeatCount * 0.12);
    const combinedMultiplier = pressureMultiplier * repeatMultiplier;

    const acceleration = this.resolveAcceleration(snapshot, template);

    return {
      chainId: createDeterministicId(
        snapshot.seed,
        'cascade',
        template.templateId,
        trigger,
        snapshot.tick,
        instanceOrdinal,
      ),
      templateId: template.templateId,
      trigger,
      positive: template.positive,
      status: 'ACTIVE',
      createdAtTick: snapshot.tick,
      recoveryTags: [...template.recoveryTags],
      links: template.baseOffsets.map((offset, index) => ({
        linkId: createDeterministicId(
          snapshot.seed,
          'cascade-link',
          template.templateId,
          snapshot.tick,
          index,
          instanceOrdinal,
        ),
        scheduledTick: snapshot.tick + Math.max(0, offset - acceleration),
        effect: this.scaleEffect(template.effects[index] ?? {}, combinedMultiplier),
        summary: `${template.templateId}::${index + 1}`,
      })),
    };
  }

  private resolveAcceleration(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): number {
    let acceleration = template.modeOffsetModifier?.[snapshot.mode] ?? 0;

    if (snapshot.modeState.bleedMode) {
      acceleration += 1;
    }

    if (!template.positive && snapshot.mode === 'ghost') {
      acceleration += 1;
    }

    if (!template.positive && snapshot.pressure.tier === 'T4') {
      acceleration += 1;
    }

    return Math.max(0, acceleration);
  }

  private resolvePressureMultiplier(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
  ): number {
    return template.pressureScalar?.[snapshot.pressure.tier] ?? 1;
  }

  private scaleEffect(effect: EffectPayload, factor: number): EffectPayload {
    const scaleNumber = (value: number | undefined): number | undefined => {
      if (value === undefined) {
        return undefined;
      }
      return Math.trunc(value * factor);
    };

    return {
      cashDelta: scaleNumber(effect.cashDelta),
      incomeDelta: scaleNumber(effect.incomeDelta),
      shieldDelta: scaleNumber(effect.shieldDelta),
      heatDelta: scaleNumber(effect.heatDelta),
      trustDelta: scaleNumber(effect.trustDelta),
      timeDeltaMs: scaleNumber(effect.timeDeltaMs),
      divergenceDelta: scaleNumber(effect.divergenceDelta),
      cascadeTag: effect.cascadeTag ?? null,
      injectCards: effect.injectCards ? [...effect.injectCards] : undefined,
    };
  }
}