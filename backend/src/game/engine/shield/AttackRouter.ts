/*
 * POINT ZERO ONE — BACKEND SHIELD ATTACK ROUTER
 * /backend/src/game/engine/shield/AttackRouter.ts
 *
 * Doctrine:
 * - routing belongs here and nowhere else
 * - current backend primitives are category-based, so richer frontend doctrine
 *   is reconstructed from category + targetLayer hint + note tags
 * - weakest-layer attacks are computed fresh at resolution time
 * - fallback selection is deterministic and does not mutate state
 */

import type {
  AttackCategory,
  AttackEvent,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type { ShieldLayerState } from '../core/RunStateSnapshot';
import {
  layerOrderIndex,
  normalizeShieldNoteTags,
  resolveShieldAlias,
  SHIELD_LAYER_ORDER,
  type RoutedAttack,
  type ShieldDoctrineAttackType,
} from './types';

export class AttackRouter {
  public order(attacks: readonly AttackEvent[]): AttackEvent[] {
    return [...attacks].sort((left, right) => {
      const priorityDelta =
        this.priority(right.category) - this.priority(left.category);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const criticalDelta =
        Number(this.hasCriticalSemantics(right.notes)) -
        Number(this.hasCriticalSemantics(left.notes));

      if (criticalDelta !== 0) {
        return criticalDelta;
      }

      const createdAtDelta = left.createdAtTick - right.createdAtTick;
      if (createdAtDelta !== 0) {
        return createdAtDelta;
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
    const noteTags = normalizeShieldNoteTags(attack.notes);
    const doctrineType = this.resolveDoctrineType(attack, noteTags);

    const hintedPrimary =
      attack.targetLayer !== 'DIRECT' ? attack.targetLayer : null;

    const route =
      doctrineType === 'HATER_INJECTION'
        ? this.weakestTwo(currentLayers)
        : this.routeByDoctrineType(doctrineType, hintedPrimary);

    return {
      attackId: attack.attackId,
      source: attack.source,
      category: attack.category,
      doctrineType,
      requestedLayer: attack.targetLayer,
      targetLayer: route.primary,
      fallbackLayer: route.fallback,
      magnitude: Math.max(0, Math.round(attack.magnitude)),
      createdAtTick: attack.createdAtTick,
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
      const candidate = stateById.get(SHIELD_LAYER_ORDER[index]);
      if (candidate !== undefined && !candidate.breached) {
        return candidate.layerId;
      }
    }

    return 'L4';
  }

  private resolveDoctrineType(
    attack: AttackEvent,
    noteTags: readonly string[],
  ): ShieldDoctrineAttackType {
    const aliased = resolveShieldAlias(noteTags);
    if (aliased !== null) {
      return aliased;
    }

    switch (attack.category) {
      case 'EXTRACTION':
        return 'FINANCIAL_SABOTAGE';

      case 'DRAIN':
        return noteTags.includes('expense')
          ? 'EXPENSE_INJECTION'
          : 'FINANCIAL_SABOTAGE';

      case 'DEBT':
        return 'DEBT_ATTACK';

      case 'LOCK':
        return noteTags.includes('opportunity')
          ? 'OPPORTUNITY_KILL'
          : 'ASSET_STRIP';

      case 'BREACH':
        return noteTags.includes('regulatory') ||
          noteTags.includes('audit') ||
          noteTags.includes('compliance')
          ? 'REGULATORY_ATTACK'
          : 'REPUTATION_ATTACK';

      case 'HEAT':
        return attack.targetLayer === 'DIRECT'
          ? 'HATER_INJECTION'
          : 'REPUTATION_ATTACK';

      default:
        return 'FINANCIAL_SABOTAGE';
    }
  }

  private routeByDoctrineType(
    doctrineType: ShieldDoctrineAttackType,
    hintedPrimary: ShieldLayerId | null,
  ): { primary: ShieldLayerId; fallback: ShieldLayerId | null } {
    const canonical = this.canonicalRoute(doctrineType);

    if (hintedPrimary === null) {
      return canonical;
    }

    return {
      primary: hintedPrimary,
      fallback:
        hintedPrimary === canonical.primary
          ? canonical.fallback
          : this.defaultFallback(hintedPrimary),
    };
  }

  private canonicalRoute(
    doctrineType: ShieldDoctrineAttackType,
  ): { primary: ShieldLayerId; fallback: ShieldLayerId | null } {
    switch (doctrineType) {
      case 'FINANCIAL_SABOTAGE':
      case 'EXPENSE_INJECTION':
        return { primary: 'L1', fallback: 'L2' };

      case 'DEBT_ATTACK':
        return { primary: 'L2', fallback: 'L3' };

      case 'ASSET_STRIP':
        return { primary: 'L3', fallback: 'L4' };

      case 'REPUTATION_ATTACK':
        return { primary: 'L4', fallback: 'L1' };

      case 'REGULATORY_ATTACK':
        return { primary: 'L4', fallback: 'L3' };

      case 'OPPORTUNITY_KILL':
        return { primary: 'L3', fallback: 'L2' };

      case 'HATER_INJECTION':
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

      return layerOrderIndex(right.layerId) - layerOrderIndex(left.layerId);
    });

    return {
      primary: sorted[0]?.layerId ?? 'L4',
      fallback: sorted[1]?.layerId ?? null,
    };
  }

  private defaultFallback(primary: ShieldLayerId): ShieldLayerId | null {
    switch (primary) {
      case 'L1':
        return 'L2';
      case 'L2':
        return 'L3';
      case 'L3':
        return 'L4';
      case 'L4':
        return 'L3';
      default:
        return null;
    }
  }

  private hasCriticalSemantics(notes: readonly string[]): boolean {
    return normalizeShieldNoteTags(notes).some(
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