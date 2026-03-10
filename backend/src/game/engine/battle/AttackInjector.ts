/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/AttackInjector.ts
 *
 * Doctrine:
 * - attack generation is deterministic and mode-aware
 * - pressureScore is normalized (0..1) and must be expanded intentionally
 * - attack IDs must remain stable under replay for the same run/tick/order
 */

import type { AttackEvent, AttackTargetEntity, ModeCode } from '../core/GamePrimitives';
import type { AttackBuildInput, BotProfile } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveTargetEntity(
  mode: ModeCode,
  profile: BotProfile,
): AttackTargetEntity {
  if (mode === 'pvp') {
    if (
      profile.preferredCategory === 'EXTRACTION' ||
      profile.preferredCategory === 'LOCK' ||
      profile.preferredCategory === 'BREACH'
    ) {
      return 'OPPONENT';
    }

    return profile.preferredTargetEntity === 'TEAM'
      ? 'PLAYER'
      : profile.preferredTargetEntity;
  }

  if (mode === 'coop') {
    return profile.preferredCategory === 'HEAT' ? 'TEAM' : 'PLAYER';
  }

  if (mode === 'ghost') {
    return 'PLAYER';
  }

  return profile.preferredTargetEntity === 'OPPONENT'
    ? 'PLAYER'
    : profile.preferredTargetEntity;
}

export class AttackInjector {
  public create(input: AttackBuildInput): AttackEvent {
    const normalizedPressure = clamp(input.pressureScore, 0, 1);
    const firstStrikeBonus =
      input.mode === 'pvp' && !input.firstBloodClaimed ? 4 : 0;

    const magnitude = clamp(
      Math.round(
        input.profile.aggression * 0.55 +
          normalizedPressure * 10 +
          input.compositeThreat * 0.18 +
          firstStrikeBonus,
      ),
      1,
      99,
    );

    return {
      attackId: `${input.runId}_${input.profile.botId}_${String(
        input.tick,
      )}_${String(input.attackIndex).padStart(2, '0')}`,
      source: input.profile.botId,
      targetEntity: resolveTargetEntity(input.mode, input.profile),
      targetLayer: input.profile.preferredLayer,
      category: input.profile.preferredCategory,
      magnitude,
      createdAtTick: input.tick,
      notes: [
        input.profile.label,
        input.profile.archetype,
        `threat:${Math.round(input.compositeThreat)}`,
        `pressure:${normalizedPressure.toFixed(2)}`,
        ...(firstStrikeBonus > 0 ? ['first-strike'] : []),
      ],
    };
  }
}