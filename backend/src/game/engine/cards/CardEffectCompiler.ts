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

import type { CardInstance } from '../core/GamePrimitives';

export interface CompiledOperation {
  kind: 'cash' | 'income' | 'shield' | 'heat' | 'trust' | 'time' | 'divergence' | 'inject';
  magnitude: number | string[];
}

export class CardEffectCompiler {
  public compile(card: CardInstance): CompiledOperation[] {
    const effect = card.card.baseEffect;
    const operations: CompiledOperation[] = [];
    if (effect.cashDelta) operations.push({ kind: 'cash', magnitude: effect.cashDelta });
    if (effect.incomeDelta) operations.push({ kind: 'income', magnitude: effect.incomeDelta });
    if (effect.shieldDelta) operations.push({ kind: 'shield', magnitude: effect.shieldDelta });
    if (effect.heatDelta) operations.push({ kind: 'heat', magnitude: effect.heatDelta });
    if (effect.trustDelta) operations.push({ kind: 'trust', magnitude: effect.trustDelta });
    if (effect.timeDeltaMs) operations.push({ kind: 'time', magnitude: effect.timeDeltaMs });
    if (effect.divergenceDelta) operations.push({ kind: 'divergence', magnitude: effect.divergenceDelta });
    if (effect.injectCards && effect.injectCards.length > 0) operations.push({ kind: 'inject', magnitude: effect.injectCards });
    return operations;
  }
}
