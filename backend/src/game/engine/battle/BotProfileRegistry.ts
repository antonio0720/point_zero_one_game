/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/BotProfileRegistry.ts
 *
 * Doctrine:
 * - profiles are stable combat doctrine, not runtime state
 * - order is deterministic and should never depend on object iteration order
 * - all lookups must be O(1) once registry is constructed
 */

import type { HaterBotId } from '../core/GamePrimitives';
import type { BotProfile } from './types';

const BOT_PROFILES: readonly BotProfile[] = Object.freeze([
  {
    botId: 'BOT_01',
    label: 'LIQUIDATOR',
    archetype: 'overleveraged liquidation force',
    activationThreshold: 16,
    watchWindow: 8,
    targetWindow: 18,
    aggression: 74,
    preferredCategory: 'EXTRACTION',
    preferredLayer: 'L1',
    preferredTargetEntity: 'OPPONENT',
    cooldownTicks: 2,
    pressureWeight: 0.65,
    heatWeight: 0.40,
    rivalryWeight: 0.30,
    modeWeight: {
      solo: 2,
      pvp: 10,
      coop: 1,
      ghost: 4,
    },
    notes: ['cash-hungry', 'opens with rapid extraction attempts'],
  },
  {
    botId: 'BOT_02',
    label: 'BUREAUCRAT',
    archetype: 'administrative friction and timing denial',
    activationThreshold: 24,
    watchWindow: 10,
    targetWindow: 16,
    aggression: 58,
    preferredCategory: 'LOCK',
    preferredLayer: 'L2',
    preferredTargetEntity: 'PLAYER',
    cooldownTicks: 3,
    pressureWeight: 0.50,
    heatWeight: 0.55,
    rivalryWeight: 0.20,
    modeWeight: {
      solo: 8,
      pvp: 3,
      coop: 6,
      ghost: 2,
    },
    notes: ['window-denial', 'targets credit flexibility and tempo'],
  },
  {
    botId: 'BOT_03',
    label: 'MANIPULATOR',
    archetype: 'manufactured fear and social distortion',
    activationThreshold: 31,
    watchWindow: 10,
    targetWindow: 18,
    aggression: 63,
    preferredCategory: 'HEAT',
    preferredLayer: 'L4',
    preferredTargetEntity: 'TEAM',
    cooldownTicks: 3,
    pressureWeight: 0.55,
    heatWeight: 0.45,
    rivalryWeight: 0.45,
    modeWeight: {
      solo: 4,
      pvp: 7,
      coop: 10,
      ghost: 5,
    },
    notes: ['trust-pressure', 'punishes visible coordination'],
  },
  {
    botId: 'BOT_04',
    label: 'CRASH_PROPHET',
    archetype: 'income destabilizer and collapse amplifier',
    activationThreshold: 43,
    watchWindow: 8,
    targetWindow: 14,
    aggression: 79,
    preferredCategory: 'DRAIN',
    preferredLayer: 'L3',
    preferredTargetEntity: 'PLAYER',
    cooldownTicks: 4,
    pressureWeight: 0.80,
    heatWeight: 0.35,
    rivalryWeight: 0.25,
    modeWeight: {
      solo: 6,
      pvp: 5,
      coop: 5,
      ghost: 7,
    },
    notes: ['late pressure punisher', 'attacks income stability'],
  },
  {
    botId: 'BOT_05',
    label: 'LEGACY_HEIR',
    archetype: 'old-money moat and final sovereignty breach',
    activationThreshold: 58,
    watchWindow: 8,
    targetWindow: 12,
    aggression: 88,
    preferredCategory: 'BREACH',
    preferredLayer: 'L4',
    preferredTargetEntity: 'PLAYER',
    cooldownTicks: 5,
    pressureWeight: 0.75,
    heatWeight: 0.30,
    rivalryWeight: 0.40,
    modeWeight: {
      solo: 5,
      pvp: 8,
      coop: 4,
      ghost: 12,
    },
    notes: ['late-game closer', 'pushes network-core collapse'],
  },
]);

export class BotProfileRegistry {
  private readonly orderedProfiles = BOT_PROFILES.slice();

  private readonly profileById: Readonly<Record<HaterBotId, BotProfile>> =
    Object.freeze(
      BOT_PROFILES.reduce<Record<HaterBotId, BotProfile>>((accumulator, profile) => {
        accumulator[profile.botId] = profile;
        return accumulator;
      }, {} as Record<HaterBotId, BotProfile>),
    );

  public all(): readonly BotProfile[] {
    return this.orderedProfiles;
  }

  public byId(botId: HaterBotId): BotProfile {
    return this.profileById[botId];
  }
}