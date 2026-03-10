/*
 * POINT ZERO ONE — BACKEND PRESSURE DECAY CONTROLLER
 * /backend/src/game/engine/pressure/PressureDecayController.ts
 *
 * Doctrine:
 * - pressure can rise instantly but should not collapse unrealistically in one tick
 * - higher danger states are intentionally sticky
 * - decay is phase-aware, mode-aware, and threat-aware
 * - mild recovery is allowed, but tier whipsaw is resisted while the crisis substrate remains active
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  clampPressureScore,
  DEFAULT_MAX_DECAY_PER_TICK,
  getPressureTierMinScore,
  rankPressureTier,
  resolvePressureTier,
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
    let boundedScore = Math.max(
      targetScore,
      previousScore - profile.maxDropPerTick,
      profile.stickyFloor,
    );

    if (this.shouldRetainCurrentTier(snapshot, targetScore, profile)) {
      boundedScore = Math.max(boundedScore, profile.tierRetentionFloor);
    }

    return clampPressureScore(boundedScore);
  }

  public getProfile(snapshot: RunStateSnapshot): PressureDecayProfile {
    return this.resolveProfile(snapshot);
  }

  public estimateTicksToScore(
    snapshot: RunStateSnapshot,
    targetScore: number,
  ): number {
    const current = clampPressureScore(snapshot.pressure.score);
    const target = clampPressureScore(targetScore);

    if (current <= target) {
      return 0;
    }

    const profile = this.resolveProfile(snapshot);
    const effectiveTarget = Math.max(target, profile.stickyFloor);

    if (current <= effectiveTarget) {
      return 0;
    }

    return Math.ceil((current - effectiveTarget) / profile.maxDropPerTick);
  }

  public estimateTicksToCalm(snapshot: RunStateSnapshot): number {
    return this.estimateTicksToScore(snapshot, 0);
  }

  private resolveProfile(snapshot: RunStateSnapshot): PressureDecayProfile {
    let maxDropPerTick = DEFAULT_MAX_DECAY_PER_TICK;
    let stickyFloor = 0;
    let tierRetentionFloor = 0;
    const reasons: string[] = [];

    const currentTier = resolvePressureTier(snapshot.pressure.score);

    if (snapshot.phase === 'ESCALATION') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.045);
      reasons.push('phase:escalation');
    }

    if (snapshot.phase === 'SOVEREIGNTY') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.035);
      stickyFloor = Math.max(stickyFloor, 0.03);
      reasons.push('phase:sovereignty');
    }

    if (currentTier === 'T3') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.040);
      tierRetentionFloor = Math.max(
        tierRetentionFloor,
        getPressureTierMinScore('T3') - 0.02,
      );
      reasons.push('tier:high');
    }

    if (currentTier === 'T4') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.030);
      stickyFloor = Math.max(stickyFloor, 0.05);
      tierRetentionFloor = Math.max(
        tierRetentionFloor,
        getPressureTierMinScore('T4') - 0.02,
      );
      reasons.push('tier:critical');
    }

    if (snapshot.battle.pendingAttacks.length > 0) {
      maxDropPerTick = Math.min(maxDropPerTick, 0.040);
      tierRetentionFloor = Math.max(
        tierRetentionFloor,
        Math.max(0, getPressureTierMinScore(currentTier) - 0.03),
      );
      reasons.push('threats:pending_attacks');
    }

    if (this.countNegativeActiveChains(snapshot) > 0) {
      maxDropPerTick = Math.min(maxDropPerTick, 0.035);
      stickyFloor = Math.max(stickyFloor, 0.06);
      tierRetentionFloor = Math.max(
        tierRetentionFloor,
        Math.max(0, getPressureTierMinScore(currentTier) - 0.02),
      );
      reasons.push('cascade:negative_active');
    }

    if (snapshot.shield.weakestLayerRatio <= 0.40) {
      stickyFloor = Math.max(stickyFloor, 0.04);
      reasons.push('shield:weakest_below_40pct');
    }

    if (snapshot.shield.weakestLayerRatio <= 0.25) {
      stickyFloor = Math.max(stickyFloor, 0.10);
      reasons.push('shield:weakest_below_25pct');
    }

    if (snapshot.mode === 'solo' && snapshot.modeState.bleedMode) {
      maxDropPerTick = Math.min(maxDropPerTick, 0.025);
      stickyFloor = Math.max(stickyFloor, 0.08);
      reasons.push('mode:solo_bleed');
    }

    if (snapshot.mode === 'pvp' && snapshot.battle.rivalryHeatCarry >= 15) {
      stickyFloor = Math.max(stickyFloor, 0.04);
      reasons.push('mode:pvp_rivalry');
    }

    if (snapshot.mode === 'coop' && this.averageTrust(snapshot) < 50) {
      stickyFloor = Math.max(stickyFloor, 0.05);
      reasons.push('mode:coop_trust_fracture');
    }

    if (snapshot.mode === 'ghost') {
      maxDropPerTick = Math.min(maxDropPerTick, 0.040);
      stickyFloor = Math.max(
        stickyFloor,
        Math.min(0.12, snapshot.modeState.communityHeatModifier / 2500),
      );
      reasons.push('mode:ghost_community_heat');
    }

    return Object.freeze({
      maxDropPerTick: clampPressureScore(maxDropPerTick),
      stickyFloor: clampPressureScore(stickyFloor),
      tierRetentionFloor: clampPressureScore(tierRetentionFloor),
      reasons: Object.freeze(reasons),
    });
  }

  private shouldRetainCurrentTier(
    snapshot: RunStateSnapshot,
    targetScore: number,
    profile: PressureDecayProfile,
  ): boolean {
    const currentTier = resolvePressureTier(snapshot.pressure.score);
    const targetTier = resolvePressureTier(targetScore);

    if (rankPressureTier(targetTier) >= rankPressureTier(currentTier)) {
      return false;
    }

    if (profile.tierRetentionFloor <= 0) {
      return false;
    }

    if (snapshot.battle.pendingAttacks.length > 0) {
      return true;
    }

    if (this.countNegativeActiveChains(snapshot) > 0) {
      return true;
    }

    if (snapshot.shield.weakestLayerRatio < 0.35) {
      return true;
    }

    if (snapshot.mode === 'solo' && snapshot.modeState.bleedMode) {
      return true;
    }

    if (snapshot.mode === 'ghost' && snapshot.modeState.communityHeatModifier > 0) {
      return true;
    }

    return false;
  }

  private countNegativeActiveChains(snapshot: RunStateSnapshot): number {
    return snapshot.cascade.activeChains.filter((chain) => !chain.positive).length;
  }

  private averageTrust(snapshot: RunStateSnapshot): number {
    const values = Object.values(snapshot.modeState.trustScores);
    if (values.length === 0) {
      return 100;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}