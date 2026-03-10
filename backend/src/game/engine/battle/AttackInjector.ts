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

import type { AttackEvent } from '../core/GamePrimitives';
import type { BotProfile } from './types';

export class AttackInjector {
  public create(runId: string, tick: number, profile: BotProfile, pressureScore: number, mode: 'solo' | 'pvp' | 'coop' | 'ghost'): AttackEvent {
    return {
      attackId: `${runId}_${profile.botId}_${tick}`,
      source: profile.botId,
      targetEntity: mode === 'pvp' && profile.preferredCategory === 'EXTRACTION' ? 'OPPONENT' : 'SELF',
      targetLayer: profile.preferredLayer,
      category: profile.preferredCategory,
      magnitude: profile.aggression + Math.floor(pressureScore / 8),
      createdAtTick: tick,
      notes: [profile.label, profile.archetype],
    };
  }
}
