/*
 * POINT ZERO ONE — BACKEND PRESSURE DECAY CONTROLLER
 * /backend/src/game/engine/pressure/PressureDecayController.ts
 *
 * Doctrine:
 * - pressure can rise instantly but should not collapse unrealistically in one tick
 * - higher danger states are "sticky" on purpose
 * - decay profile is mode-aware and phase-aware
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  clampPressureScore,
  type PressureDecayProfile,
} from './types';

export class PressureDecayController {
  public apply(snapshot: RunStateSnapshot, nextScore: number): number {
    const previousScore = clampPressureScore(snapshot.pressure.score);
    const targetScore = clampPressureScore(nextScore);

    if (targetScore >= previousScore) {
      return targetScore;
    }

    const profile = this.resolveProfile(snapshot);
    const softenedDecay = previousScore - profile.maxDropPerTick;

    return clampPressureScore(
      Math.max(targetScore, softenedDecay, profile.stickyFloor),
    );
  }

  private resolveProfile(snapshot: RunStateSnapshot): PressureDecayProfile {
    let maxDropPerTick = 0.06;
    let stickyFloor = 0;

    if (snapshot.phase === 'ESCALATION') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.05);
    }

    if (snapshot.phase === 'SOVEREIGNTY') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.035);
      stickyFloor = Math.max(stickyFloor, 0.04);
    }

    if (snapshot.battle.pendingAttacks.length > 0) {
      maxDropPerTick = Math.min(maxDropPerTick, 0.045);
    }

    if (snapshot.cascade.activeChains.length > 0) {
      maxDropPerTick = Math.min(maxDropPerTick, 0.04);
      stickyFloor = Math.max(stickyFloor, 0.06);
    }

    if (snapshot.shield.weakestLayerRatio <= 0.25) {
      stickyFloor = Math.max(stickyFloor, 0.10);
    }

    if (snapshot.mode === 'solo' && snapshot.modeState.bleedMode) {
      maxDropPerTick = Math.min(maxDropPerTick, 0.03);
      stickyFloor = Math.max(stickyFloor, 0.08);
    }

    if (snapshot.mode === 'ghost') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.04);
      stickyFloor = Math.max(
        stickyFloor,
        Math.min(0.12, snapshot.modeState.communityHeatModifier / 3000),
      );
    }

    return {
      maxDropPerTick: clampPressureScore(maxDropPerTick),
      stickyFloor: clampPressureScore(stickyFloor),
    };
  }
}