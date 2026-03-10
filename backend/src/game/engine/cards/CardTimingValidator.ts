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

import type { CardInstance, TimingClass } from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';

export class CardTimingValidator {
  public isLegal(snapshot: RunStateSnapshot, card: CardInstance): boolean {
    return card.timingClass.some((timing) => this.check(snapshot, timing));
  }

  private check(snapshot: RunStateSnapshot, timing: TimingClass): boolean {
    switch (timing) {
      case 'ANY': return true;
      case 'PRE': return true;
      case 'POST': return snapshot.tick > 0;
      case 'FATE': return snapshot.cards.lastPlayed.some((id) => id.includes('FUBAR'));
      case 'CTR': return snapshot.mode === 'pvp' && snapshot.battle.pendingAttacks.some((attack) => attack.category === 'EXTRACTION');
      case 'RES': return snapshot.mode === 'coop' && Object.values(snapshot.modeState.trustScores).some((score) => score < 35);
      case 'AID': return snapshot.mode === 'coop';
      case 'GBM': return snapshot.mode === 'ghost' && snapshot.cards.ghostMarkers.some((marker) => Math.abs(marker.tick - snapshot.tick) <= 3);
      case 'CAS': return snapshot.cascade.activeChains.length > 0;
      case 'PHZ': return snapshot.mode === 'solo' && snapshot.modeState.phaseBoundaryWindowsRemaining > 0;
      case 'PSK': return snapshot.pressure.tier !== snapshot.pressure.previousTier && this.rank(snapshot.pressure.tier) > this.rank(snapshot.pressure.previousTier);
      case 'END': return (snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs - snapshot.timers.elapsedMs) <= 30000;
      default: return false;
    }
  }

  private rank(tier: RunStateSnapshot['pressure']['tier']): number {
    return ['T0', 'T1', 'T2', 'T3', 'T4'].indexOf(tier);
  }
}
