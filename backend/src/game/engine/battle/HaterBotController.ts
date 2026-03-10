/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/HaterBotController.ts
 *
 * Doctrine:
 * - controller logic translates pressure + heat + rivalry into bot posture
 * - it must never mutate snapshot-owned runtime state
 * - pressureScore is normalized (0..1); composite threat is tactical (0..100)
 */

import type { BotRuntimeState } from '../core/RunStateSnapshot';
import type { BotEvolveInput, BotEvolveResult, BotProfile } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export class HaterBotController {
  private computeCompositeThreat(
    profile: BotProfile,
    input: BotEvolveInput,
  ): number {
    const normalizedPressure = clamp(input.pressureScore, 0, 1);
    const tacticalHeat = clamp(input.baseHeat, 0, 100);
    const rivalry = clamp(input.rivalryHeatCarry, 0, 100);

    const pressureContribution =
      normalizedPressure * 100 * profile.pressureWeight;
    const heatContribution = tacticalHeat * profile.heatWeight;
    const rivalryContribution = rivalry * profile.rivalryWeight;
    const modeBias = profile.modeWeight[input.mode] ?? 0;

    return round2(
      clamp(
        pressureContribution + heatContribution + rivalryContribution + modeBias,
        0,
        100,
      ),
    );
  }

  private determineState(
    previousState: BotRuntimeState['state'],
    profile: BotProfile,
    compositeThreat: number,
  ): BotRuntimeState['state'] {
    if (compositeThreat < profile.activationThreshold) {
      return previousState === 'ATTACKING' || previousState === 'TARGETING'
        ? 'RETREATING'
        : 'DORMANT';
    }

    if (compositeThreat < profile.activationThreshold + profile.watchWindow) {
      return 'WATCHING';
    }

    if (
      compositeThreat <
      profile.activationThreshold + profile.watchWindow + profile.targetWindow
    ) {
      return 'TARGETING';
    }

    return 'ATTACKING';
  }

  public evolve(
    runtime: BotRuntimeState,
    profile: BotProfile,
    input: BotEvolveInput,
  ): BotEvolveResult {
    if (runtime.neutralized) {
      const neutralizedRuntime: BotRuntimeState = {
        ...runtime,
        state: 'NEUTRALIZED',
        heat: 0,
      };

      return {
        runtime: neutralizedRuntime,
        previousState: runtime.state,
        nextState: neutralizedRuntime.state,
        stateChanged: runtime.state !== neutralizedRuntime.state,
        compositeThreat: 0,
      };
    }

    const compositeThreat = this.computeCompositeThreat(profile, input);
    const nextState = this.determineState(
      runtime.state,
      profile,
      compositeThreat,
    );

    const evolvedRuntime: BotRuntimeState = {
      ...runtime,
      state: nextState,
      heat: compositeThreat,
      lastAttackTick: runtime.lastAttackTick,
    };

    return {
      runtime: evolvedRuntime,
      previousState: runtime.state,
      nextState,
      stateChanged: runtime.state !== nextState,
      compositeThreat,
    };
  }
}