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

import type { BotProfile } from './types';

export class BotProfileRegistry {
  private readonly profiles: BotProfile[] = [
    { botId: 'BOT_01', label: 'LIQUIDATOR', archetype: 'overleveraged liquidation force', activationThreshold: 18, aggression: 10, preferredCategory: 'EXTRACTION', preferredLayer: 'L1' },
    { botId: 'BOT_02', label: 'BUREAUCRAT', archetype: 'administrative friction', activationThreshold: 24, aggression: 8, preferredCategory: 'LOCK', preferredLayer: 'L2' },
    { botId: 'BOT_03', label: 'MANIPULATOR', archetype: 'manufactured fear', activationThreshold: 32, aggression: 12, preferredCategory: 'HEAT', preferredLayer: 'L4' },
    { botId: 'BOT_04', label: 'CRASH_PROPHET', archetype: 'market collapse amplifier', activationThreshold: 45, aggression: 16, preferredCategory: 'DRAIN', preferredLayer: 'L3' },
    { botId: 'BOT_05', label: 'LEGACY_HEIR', archetype: 'old money moat', activationThreshold: 60, aggression: 18, preferredCategory: 'BREACH', preferredLayer: 'L4' },
  ];

  public all(): BotProfile[] {
    return [...this.profiles];
  }
}
