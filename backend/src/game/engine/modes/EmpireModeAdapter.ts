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

export class EmpireModeAdapter implements ModeAdapter {
  public readonly modeCode = 'solo' as const;

  public configure(snapshot: RunStateSnapshot): RunStateSnapshot {
    return {
      ...snapshot,
      tags: [...snapshot.tags, 'mode:empire', 'loadout:enabled', 'hold:enabled'],
      modeState: {
        ...snapshot.modeState,
        holdEnabled: true,
        loadoutEnabled: true,
        phaseBoundaryWindowsRemaining: 0,
        sharedOpportunityDeck: false,
        spectatorLimit: 0,
      },
      timers: {
        ...snapshot.timers,
        holdCharges: 1,
      },
    };
  }
}
