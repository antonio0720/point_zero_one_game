/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/cards/CardTimingValidator.ts
 *
 * Doctrine:
 * - backend timing legality is authoritative
 * - timing windows are mode-native and snapshot-derived
 * - legality must be deterministic for replay / proof
 * - timing checks should be strict enough to prevent UI abuse,
 *   but never so narrow that legal deck doctrine becomes unusable
 */

import type {
  CardInstance,
  DeckType,
  PressureTier,
  TimingClass,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { CardRegistry } from './CardRegistry';

const END_WINDOW_MS = 30_000;
const GHOST_MARKER_WINDOW_TICKS = 3;
const RESCUE_TRUST_THRESHOLD = 35;

export class CardTimingValidator {
  private readonly registry = new CardRegistry();

  public isLegal(snapshot: RunStateSnapshot, card: CardInstance): boolean {
    return this.legalTimings(snapshot, card).length > 0;
  }

  public legalTimings(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): TimingClass[] {
    if (snapshot.outcome !== null) {
      return [];
    }

    const seen = new Set<TimingClass>();
    const legal: TimingClass[] = [];

    for (const timing of card.timingClass) {
      if (seen.has(timing)) {
        continue;
      }

      seen.add(timing);

      if (this.check(snapshot, card, timing)) {
        legal.push(timing);
      }
    }

    return legal;
  }

  private check(
    snapshot: RunStateSnapshot,
    card: CardInstance,
    timing: TimingClass,
  ): boolean {
    switch (timing) {
      case 'ANY':
        return true;

      case 'PRE':
        return this.isPreWindow(snapshot);

      case 'POST':
        return this.isPostWindow(snapshot);

      case 'FATE':
        return this.isFateWindow(snapshot);

      case 'CTR':
        return this.isCounterWindow(snapshot);

      case 'RES':
        return this.isRescueWindow(snapshot);

      case 'AID':
        return this.isAidWindow(snapshot);

      case 'GBM':
        return this.isGhostBaselineMarkerWindow(snapshot, card);

      case 'CAS':
        return this.isCascadeWindow(snapshot);

      case 'PHZ':
        return this.isPhaseBoundaryWindow(snapshot);

      case 'PSK':
        return this.isPressureSpikeWindow(snapshot);

      case 'END':
        return this.isEndWindow(snapshot);

      default:
        return false;
    }
  }

  private isPreWindow(snapshot: RunStateSnapshot): boolean {
    if (snapshot.phase === 'FOUNDATION') {
      return true;
    }

    return (
      snapshot.mode === 'solo' &&
      snapshot.modeState.phaseBoundaryWindowsRemaining > 0
    );
  }

  private isPostWindow(snapshot: RunStateSnapshot): boolean {
    return (
      snapshot.tick > 0 &&
      (snapshot.phase === 'ESCALATION' || snapshot.phase === 'SOVEREIGNTY')
    );
  }

  private isFateWindow(snapshot: RunStateSnapshot): boolean {
    return (
      this.hasRecentDeckType(snapshot.cards.lastPlayed, 'FUBAR', 4) ||
      this.hasRecentDeckType(snapshot.cards.exhaust, 'FUBAR', 4) ||
      this.hasRecentDeckType(snapshot.cards.drawHistory, 'FUBAR', 6)
    );
  }

  private isCounterWindow(snapshot: RunStateSnapshot): boolean {
    if (snapshot.mode !== 'pvp') {
      return false;
    }

    if (snapshot.battle.pendingAttacks.length > 0) {
      return snapshot.battle.pendingAttacks.some(
        (attack) =>
          attack.category === 'EXTRACTION' ||
          attack.category === 'LOCK' ||
          attack.category === 'BREACH' ||
          attack.category === 'DEBT',
      );
    }

    return snapshot.modeState.counterIntelTier > 0;
  }

  private isRescueWindow(snapshot: RunStateSnapshot): boolean {
    if (snapshot.mode !== 'coop') {
      return false;
    }

    const trustStress = Object.values(snapshot.modeState.trustScores).some(
      (score) => score < RESCUE_TRUST_THRESHOLD,
    );

    const treasuryStress =
      snapshot.modeState.sharedTreasury &&
      snapshot.modeState.sharedTreasuryBalance <= 0;

    return trustStress || treasuryStress || snapshot.modeState.bleedMode;
  }

  private isAidWindow(snapshot: RunStateSnapshot): boolean {
    if (snapshot.mode !== 'coop') {
      return false;
    }

    if (snapshot.modeState.sharedTreasury) {
      return true;
    }

    return Object.keys(snapshot.modeState.roleAssignments).length > 0;
  }

  private isGhostBaselineMarkerWindow(
    snapshot: RunStateSnapshot,
    card: CardInstance,
  ): boolean {
    if (snapshot.mode !== 'ghost') {
      return false;
    }

    if (!snapshot.modeState.legendMarkersEnabled) {
      return false;
    }

    if (!snapshot.modeState.ghostBaselineRunId) {
      return false;
    }

    return snapshot.cards.ghostMarkers.some((marker) => {
      const withinTickWindow =
        Math.abs(marker.tick - snapshot.tick) <= GHOST_MARKER_WINDOW_TICKS;

      if (!withinTickWindow) {
        return false;
      }

      if (marker.cardId === null) {
        return true;
      }

      return marker.cardId === card.definitionId;
    });
  }

  private isCascadeWindow(snapshot: RunStateSnapshot): boolean {
    return snapshot.cascade.activeChains.length > 0;
  }

  private isPhaseBoundaryWindow(snapshot: RunStateSnapshot): boolean {
    return (
      snapshot.mode === 'solo' &&
      snapshot.modeState.phaseBoundaryWindowsRemaining > 0
    );
  }

  private isPressureSpikeWindow(snapshot: RunStateSnapshot): boolean {
    const tierEscalated =
      this.rank(snapshot.pressure.tier) >
      this.rank(snapshot.pressure.previousTier);

    const bandEscalated =
      this.bandRank(snapshot.pressure.band) >
      this.bandRank(snapshot.pressure.previousBand);

    return tierEscalated || bandEscalated;
  }

  private isEndWindow(snapshot: RunStateSnapshot): boolean {
    const remainingMs =
      snapshot.timers.seasonBudgetMs +
      snapshot.timers.extensionBudgetMs -
      snapshot.timers.elapsedMs;

    return remainingMs <= END_WINDOW_MS;
  }

  private hasRecentDeckType(
    history: readonly string[],
    deckType: DeckType,
    depth: number,
  ): boolean {
    const recent = history.slice(Math.max(0, history.length - depth));

    return recent.some(
      (definitionId) => this.registry.get(definitionId)?.deckType === deckType,
    );
  }

  private rank(tier: PressureTier): number {
    switch (tier) {
      case 'T0':
        return 0;
      case 'T1':
        return 1;
      case 'T2':
        return 2;
      case 'T3':
        return 3;
      case 'T4':
        return 4;
      default:
        return -1;
    }
  }

  private bandRank(
    band: RunStateSnapshot['pressure']['band'],
  ): number {
    switch (band) {
      case 'CALM':
        return 0;
      case 'BUILDING':
        return 1;
      case 'ELEVATED':
        return 2;
      case 'HIGH':
        return 3;
      case 'CRITICAL':
        return 4;
      default:
        return -1;
    }
  }
}