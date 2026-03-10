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

import type { CascadeTemplate } from './types';

export class CascadeChainRegistry {
  private readonly templates: Record<string, CascadeTemplate> = {
    LIQUIDITY_SPIRAL: { templateId: 'LIQUIDITY_SPIRAL', positive: false, recoveryTags: ['liquidity', 'resilience'], offsets: [1, 3, 5], cashDelta: -1200, heatDelta: 3 },
    CREDIT_FREEZE: { templateId: 'CREDIT_FREEZE', positive: false, recoveryTags: ['credit', 'compliance'], offsets: [2, 4], shieldDelta: -8, heatDelta: 2 },
    INCOME_SHOCK: { templateId: 'INCOME_SHOCK', positive: false, recoveryTags: ['income', 'aid'], offsets: [1, 2, 4], incomeDelta: -200, cashDelta: -600 },
    NETWORK_LOCKDOWN: { templateId: 'NETWORK_LOCKDOWN', positive: false, recoveryTags: ['network', 'trust'], offsets: [2, 5], shieldDelta: -12, heatDelta: 4 },
    COMEBACK_SURGE: { templateId: 'COMEBACK_SURGE', positive: true, recoveryTags: [], offsets: [0, 1, 2, 3], shieldDelta: 6, cashDelta: 500 },
    MOMENTUM_ENGINE: { templateId: 'MOMENTUM_ENGINE', positive: true, recoveryTags: [], offsets: [0, 2, 4], incomeDelta: 150, cashDelta: 250 },
  };

  public get(templateId: string): CascadeTemplate {
    const template = this.templates[templateId];
    if (!template) {
      throw new Error(`Unknown cascade template: ${templateId}`);
    }
    return template;
  }
}
