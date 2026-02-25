// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/syndicate/syndicateConfig.ts
// Sprint 5 — Syndicate (TEAM UP) mode configuration
// ═══════════════════════════════════════════════════════════════════════════

export type SyndicateRole = 'ARCHITECT' | 'ACCELERATOR' | 'GUARDIAN' | 'CONNECTOR';

export interface SyndicateConfig {
  /** Maximum trust score (floor = 0) */
  trustMax: number;
  /** Trust score on run start */
  trustInitial: number;
  /** Trust leakage base rate (per tick passive decay) */
  trustPassiveDecay: number;
  /** Trust leakage penalty per negative-trust-impact card play */
  trustNegativeImpactMult: number;
  /** Trust gain per positive-trust-impact card play */
  trustPositiveGain: number;
  /** Income leakage rate at minimum trust (0.35 = 35% income lost) */
  maxTrustLeakageRate: number;
  /** Defection requires 3 steps: BREAK_PACT → SILENT_EXIT → ASSET_SEIZURE */
  defectionSteps: number;
  /** Minimum tick before defection is permitted */
  defectionMinTick: number;
  /** Ticks between rescue window opportunities */
  rescueWindowInterval: number;
  /** Rescue window open duration in ticks */
  rescueWindowDuration: number;
  /** Maximum alliance size */
  maxAllianceSize: number;
  /** Shared treasury fee rate on transfers */
  treasuryFeeRate: number;
}

export const SYNDICATE_CONFIG: SyndicateConfig = {
  trustMax:                  1.0,
  trustInitial:              0.7,
  trustPassiveDecay:         0.002,
  trustNegativeImpactMult:   0.08,
  trustPositiveGain:         0.05,
  maxTrustLeakageRate:       0.35,
  defectionSteps:            3,
  defectionMinTick:          120,
  rescueWindowInterval:      120,
  rescueWindowDuration:      30,
  maxAllianceSize:           4,
  treasuryFeeRate:           0.02,
};

export const ROLE_CONFIGS: Record<SyndicateRole, {
  label: string;
  description: string;
  drawBonus: string;
  cardAmplifier: number;
  trustModifier: number;
}> = {
  ARCHITECT: {
    label: 'Architect',
    description: 'Long-term compounding specialist. Extra card draw on IPA plays.',
    drawBonus: '+1 IPA draw per 24 ticks',
    cardAmplifier: 1.10,
    trustModifier: 1.05,
  },
  ACCELERATOR: {
    label: 'Accelerator',
    description: 'Tempo and opportunity engine. Faster claim windows.',
    drawBonus: '+1 OPPORTUNITY draw per 18 ticks',
    cardAmplifier: 1.08,
    trustModifier: 0.98,
  },
  GUARDIAN: {
    label: 'Guardian',
    description: 'Shield and rescue specialist. Rescue windows are stronger.',
    drawBonus: '+1 rescue efficiency',
    cardAmplifier: 1.05,
    trustModifier: 1.10,
  },
  CONNECTOR: {
    label: 'Connector',
    description: 'Trust amplifier. AID contracts have reduced leakage.',
    drawBonus: 'Trust leakage -15% globally',
    cardAmplifier: 1.0,
    trustModifier: 1.15,
  },
};
