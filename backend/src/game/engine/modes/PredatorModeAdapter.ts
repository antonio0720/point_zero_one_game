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

import type { ModeAdapter } from './ModeContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

export class PredatorModeAdapter implements ModeAdapter {
  public readonly modeCode = 'pvp' as const;

  public configure(snapshot: RunStateSnapshot): RunStateSnapshot {
    return {
      ...snapshot,
      tags: [...snapshot.tags, 'mode:predator', 'battle_budget:enabled', 'shared_opportunity_deck:enabled'],
      modeState: {
        ...snapshot.modeState,
        sharedOpportunityDeck: true,
        spectatorLimit: 50,
      },
      battle: {
        ...snapshot.battle,
        battleBudget: 20,
        battleBudgetCap: 200,
        extractionCooldownTicks: 0,
      },
    };
  }
}
