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

import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { CORD_WEIGHTS, OUTCOME_MULTIPLIER } from './types';

export class RunGradeAssigner {
  public score(snapshot: RunStateSnapshot): { score: number; grade: string; badges: string[] } {
    const avgShieldPct = snapshot.shield.layers.reduce((sum, layer) => sum + layer.current / layer.max, 0) / snapshot.shield.layers.length;
    const decisions = snapshot.telemetry.decisions;
    const speedScore = decisions.length === 0 ? 0 : decisions.reduce((sum, decision) => sum + Math.max(0, 1 - (decision.latencyMs / Math.max(1, snapshot.timers.currentTickDurationMs))), 0) / decisions.length;
    const blockedRatio = snapshot.shield.blockedThisRun / Math.max(1, snapshot.shield.damagedThisRun + snapshot.shield.blockedThisRun);
    const brokenRatio = snapshot.cascade.brokenChains / Math.max(1, snapshot.cascade.brokenChains + snapshot.cascade.completedChains);
    const pressureSurvival = snapshot.pressure.survivedHighPressureTicks / Math.max(1, snapshot.tick);

    const baseScore = (
      speedScore * CORD_WEIGHTS.decision_speed_score +
      avgShieldPct * CORD_WEIGHTS.shields_maintained_pct +
      blockedRatio * CORD_WEIGHTS.hater_sabotages_blocked +
      brokenRatio * CORD_WEIGHTS.cascade_chains_broken +
      pressureSurvival * CORD_WEIGHTS.pressure_survived_score
    ) * OUTCOME_MULTIPLIER[snapshot.outcome ?? 'ABANDONED'];

    let score = baseScore;
    const badges: string[] = [];

    if (snapshot.mode === 'solo' && snapshot.telemetry.decisions.filter((decision) => decision.latencyMs <= 2000).length >= 3) {
      score += 0.40;
      badges.push('CLUTCH');
    }
    if (snapshot.mode === 'solo' && snapshot.modeState.holdEnabled && snapshot.timers.holdCharges === 1) {
      score += 0.25;
      badges.push('NO_HOLD_RUN');
    }
    if (snapshot.mode === 'pvp' && snapshot.battle.firstBloodClaimed) {
      score += 0.15;
      badges.push('FIRST_BLOOD');
    }
    if (snapshot.mode === 'coop' && Object.values(snapshot.modeState.defectionStepByPlayer).some((step) => step >= 3) && snapshot.outcome === 'FREEDOM') {
      score += 0.60;
      badges.push('BETRAYAL_SURVIVOR');
    }
    if (snapshot.mode === 'ghost' && snapshot.sovereignty.gapVsLegend >= 0.15) {
      score += 0.20;
      badges.push('GHOST_SLAYER');
    }
    if (snapshot.modeState.bleedMode && score >= 1.50) {
      badges.push('S_GRADE_BLEED');
    }

    const grade = score >= 1.50 ? 'S' : score >= 1.20 ? 'A' : score >= 0.90 ? 'B' : score >= 0.60 ? 'C' : score >= 0.30 ? 'D' : 'F';
    return { score: Number(score.toFixed(4)), grade, badges };
  }
}
