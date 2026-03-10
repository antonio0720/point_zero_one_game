/*
 * POINT ZERO ONE — BACKEND SHIELD ATTACK ROUTER
 * /backend/src/game/engine/shield/AttackRouter.ts
 *
 * Doctrine:
 * - routing belongs here, not in battle, card, or shield runtime branches
 * - HATER-INJECTION-style targeting is modeled through weakest-layer routing
 * - targetLayer on AttackEvent is treated as a hint, not the full doctrine
 * - fallback selection is deterministic and replay-safe
 */

import type {
  AttackCategory,
  AttackEvent,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type { ShieldLayerState } from '../core/RunStateSnapshot';
import {
  inferCriticalTags,
  isShieldLayerId,
  SHIELD_LAYER_ORDER,
  type RoutedAttack,
} from './types';

export class AttackRouter {
  public order(attacks: readonly AttackEvent[]): AttackEvent[] {
    return [...attacks].sort((left, right) => {
      const categoryDelta =
        this.priority(right.category) - this.priority(left.category);

      if (categoryDelta !== 0) {
        return categoryDelta;
      }

      const criticalDelta =
        Number(this.hasCriticalSemantics(right.notes)) -
        Number(this.hasCriticalSemantics(left.notes));

      if (criticalDelta !== 0) {
        return criticalDelta;
      }

      const magnitudeDelta = right.magnitude - left.magnitude;
      if (magnitudeDelta !== 0) {
        return magnitudeDelta;
      }

      return left.attackId.localeCompare(right.attackId);
    });
  }

  public resolve(
    attack: AttackEvent,
    currentLayers: readonly ShieldLayerState[],
  ): RoutedAttack {
    const noteTags = inferCriticalTags(attack.notes);
    const weakest = this.weakestTwo(currentLayers);

    const hintedPrimary =
      attack.targetLayer !== 'DIRECT' ? attack.targetLayer : null;

    const routed =
      noteTags.includes('weakest-layer') ||
      noteTags.includes('hater-injection') ||
      attack.category === 'HEAT'
        ? weakest
        : this.routeByCategory(attack.category, hintedPrimary);

    return {
      attackId: attack.attackId,
      source: attack.source,
      category: attack.category,
      requestedLayer: attack.targetLayer,
      targetLayer: routed.primary,
      fallbackLayer: routed.fallback,
      magnitude: Math.max(0, Math.round(attack.magnitude)),
      noteTags,
      bypassDeflection: this.hasCriticalSemantics(attack.notes),
    };
  }

  public resolveEffectiveTarget(
    routed: Pick<RoutedAttack, 'targetLayer' | 'fallbackLayer'>,
    currentLayers: readonly ShieldLayerState[],
  ): ShieldLayerId {
    const stateById = new Map(currentLayers.map((layer) => [layer.layerId, layer]));

    const primary = stateById.get(routed.targetLayer);
    if (primary !== undefined && !primary.breached) {
      return routed.targetLayer;
    }

    if (routed.fallbackLayer !== null) {
      const fallback = stateById.get(routed.fallbackLayer);
      if (fallback !== undefined && !fallback.breached) {
        return routed.fallbackLayer;
      }
    }

    for (let index = SHIELD_LAYER_ORDER.length - 1; index >= 0; index -= 1) {
      const layerId = SHIELD_LAYER_ORDER[index];
      const candidate = stateById.get(layerId);
      if (candidate !== undefined && !candidate.breached) {
        return layerId;
      }
    }

    return 'L4';
  }

  private routeByCategory(
    category: AttackCategory,
    hintedPrimary: ShieldLayerId | null,
  ): { primary: ShieldLayerId; fallback: ShieldLayerId | null } {
    if (hintedPrimary !== null) {
      return {
        primary: hintedPrimary,
        fallback: this.defaultFallback(hintedPrimary, category),
      };
    }

    switch (category) {
      case 'EXTRACTION':
      case 'DRAIN':
        return { primary: 'L1', fallback: 'L2' };

      case 'DEBT':
        return { primary: 'L2', fallback: 'L3' };

      case 'LOCK':
        return { primary: 'L3', fallback: 'L4' };

      case 'BREACH':
        return { primary: 'L4', fallback: 'L3' };

      case 'HEAT':
        return { primary: 'L4', fallback: 'L3' };

      default:
        return { primary: 'L1', fallback: 'L2' };
    }
  }

  private weakestTwo(
    layers: readonly ShieldLayerState[],
  ): { primary: ShieldLayerId; fallback: ShieldLayerId | null } {
    const sorted = [...layers].sort((left, right) => {
      if (left.integrityRatio !== right.integrityRatio) {
        return left.integrityRatio - right.integrityRatio;
      }

      return (
        SHIELD_LAYER_ORDER.indexOf(right.layerId) -
        SHIELD_LAYER_ORDER.indexOf(left.layerId)
      );
    });

    return {
      primary: sorted[0]?.layerId ?? 'L4',
      fallback: sorted[1]?.layerId ?? null,
    };
  }

  private defaultFallback(
    primary: ShieldLayerId,
    category: AttackCategory,
  ): ShieldLayerId | null {
    switch (primary) {
      case 'L1':
        return 'L2';
      case 'L2':
        return 'L3';
      case 'L3':
        return 'L4';
      case 'L4':
        return category === 'BREACH' ? 'L3' : 'L1';
      default:
        return null;
    }
  }

  private hasCriticalSemantics(notes: readonly string[]): boolean {
    return inferCriticalTags(notes).some(
      (tag) =>
        tag === 'critical' ||
        tag === 'critical-hit' ||
        tag === 'critical_hit' ||
        tag === 'bypass-deflection' ||
        tag === 'bypass_deflection',
    );
  }

  private priority(category: AttackCategory): number {
    switch (category) {
      case 'BREACH':
        return 6;
      case 'EXTRACTION':
        return 5;
      case 'DEBT':
        return 4;
      case 'LOCK':
        return 3;
      case 'DRAIN':
        return 2;
      case 'HEAT':
        return 1;
      default:
        return 0;
    }
  }
}