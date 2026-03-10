/*
 * POINT ZERO ONE — BACKEND POSITIVE CASCADE TRACKER
 * /backend/src/game/engine/cascade/PositiveCascadeTracker.ts
 *
 * Doctrine:
 * - positive cascades are earned from state, not random grants
 * - backend should only unlock them from durable conditions
 * - one-shot positive chains are preferred until richer runtime state exists
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { CascadeTemplateId } from './types';

export class PositiveCascadeTracker {
  public infer(snapshot: RunStateSnapshot): CascadeTemplateId[] {
    const activePositiveIds = new Set(
      snapshot.cascade.activeChains
        .filter((chain) => chain.positive)
        .map((chain) => chain.templateId as CascadeTemplateId),
    );

    const unlockedPositiveIds = new Set(
      snapshot.cascade.positiveTrackers.map((templateId) => templateId as CascadeTemplateId),
    );

    const inferred: CascadeTemplateId[] = [];

    if (
      this.shouldUnlockMomentum(snapshot) &&
      !activePositiveIds.has('MOMENTUM_ENGINE') &&
      !unlockedPositiveIds.has('MOMENTUM_ENGINE')
    ) {
      inferred.push('MOMENTUM_ENGINE');
    }

    if (
      this.shouldUnlockComeback(snapshot) &&
      !activePositiveIds.has('COMEBACK_SURGE') &&
      !unlockedPositiveIds.has('COMEBACK_SURGE')
    ) {
      inferred.push('COMEBACK_SURGE');
    }

    return inferred;
  }

  private shouldUnlockMomentum(snapshot: RunStateSnapshot): boolean {
    const incomeBuffer = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
    const trustPeak = Math.max(0, ...Object.values(snapshot.modeState.trustScores));
    const allShieldsStable = snapshot.shield.layers.every((layer) => layer.integrityRatio >= 0.75);
    const heatContained = snapshot.economy.haterHeat <= 7;

    if (snapshot.mode === 'coop') {
      return incomeBuffer >= 100 && allShieldsStable && heatContained && trustPeak >= 70;
    }

    return incomeBuffer >= 100 && allShieldsStable && heatContained;
  }

  private shouldUnlockComeback(snapshot: RunStateSnapshot): boolean {
    const highPressure =
      snapshot.pressure.tier === 'T3' ||
      snapshot.pressure.tier === 'T4';

    const shieldsRecovered = snapshot.shield.layers.every((layer) => layer.integrityRatio >= 0.60);
    const cashRecovered =
      snapshot.economy.cash >= Math.max(3000, snapshot.economy.expensesPerTick * 3);

    return highPressure && shieldsRecovered && cashRecovered;
  }
}