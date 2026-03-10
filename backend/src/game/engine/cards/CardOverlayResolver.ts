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

import type { CardDefinition, CardInstance, DivergencePotential, ModeCode, Targeting } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { createDeterministicId } from '../core/Deterministic';
import { MODE_TAG_WEIGHTS } from './types';

export class CardOverlayResolver {
  public resolve(snapshot: RunStateSnapshot, card: CardDefinition): CardInstance {
    const mode = snapshot.mode;
    const overlay = card.modeOverlay?.[mode] ?? {};
    const costModifier = overlay.costModifier ?? 1;
    const effectModifier = overlay.effectModifier ?? 1;
    const targeting = (overlay.targetingOverride ?? card.targeting) as Targeting;
    const divergencePotential = (overlay.divergencePotential ?? this.inferDivergence(card, mode)) as DivergencePotential;
    const weights = MODE_TAG_WEIGHTS[mode] as Record<string, number>;
    const weightedTags = card.tags.map((tag) => `${tag}:${weights[tag] ?? 1}`);

    return {
      instanceId: createDeterministicId(snapshot.seed, card.id, snapshot.tick, snapshot.cards.drawHistory.length),
      definitionId: card.id,
      card,
      cost: Math.round(card.baseCost * costModifier),
      targeting,
      timingClass: [...new Set([...(card.timingClass || []), ...((overlay.timingLock ?? []) as string[])])],
      tags: [...card.tags, ...weightedTags, `effect:${effectModifier}`],
      overlayAppliedForMode: mode,
      decayTicksRemaining: card.decayTicks,
      divergencePotential,
    };
  }

  private inferDivergence(card: CardDefinition, mode: ModeCode): DivergencePotential {
    if (mode !== 'ghost') {
      return card.rarity === 'LEGENDARY' ? 'HIGH' : card.rarity === 'RARE' ? 'MEDIUM' : 'LOW';
    }
    if (card.timingClass.includes('GBM') || card.tags.includes('divergence')) {
      return 'HIGH';
    }
    if (card.tags.includes('precision') || card.tags.includes('variance')) {
      return 'MEDIUM';
    }
    return 'LOW';
  }
}
