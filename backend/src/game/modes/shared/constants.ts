/*
 * POINT ZERO ONE — BACKEND MODES 15X GENERATOR
 * Generated at: 2026-03-10T01:26:02.003447+00:00
 *
 * Doctrine:
 * - backend owns mode truth, not the client
 * - four battlegrounds are materially different at runtime
 * - card legality, timing, targeting, and scoring are mode-native
 * - cross-player economies are server-owned
 * - CORD bonuses, proof conditions, and ghost logic are authoritative
 */

import type {
  AdvantageId,
  CounterCardId,
  ExtractionActionId,
  HandicapId,
  TeamRoleId,
  VisibilityTier,
} from '../contracts';
import type { DeckType, TimingClass } from '../../engine/core/GamePrimitives';

export const TEAM_ROLE_IDS: TeamRoleId[] = [
  'INCOME_BUILDER',
  'SHIELD_ARCHITECT',
  'OPPORTUNITY_HUNTER',
  'COUNTER_INTEL',
];

export const ADVANTAGES: Record<AdvantageId, { label: string; description: string }> = {
  MOMENTUM_CAPITAL: {
    label: 'Momentum Capital',
    description: 'Start with +10000 cash for aggressive foundation-phase buying.',
  },
  NETWORK_ACTIVATED: {
    label: 'Network Activated',
    description: 'Layer 4 starts at 150% integrity.',
  },
  FORECLOSURE_BLOCK: {
    label: 'Foreclosure Block',
    description: 'Liquidator cannot activate extraction pressure for the first 5 ticks.',
  },
  INTEL_PASS: {
    label: 'Intel Pass',
    description: 'First 3 threats arrive as EXPOSED.',
  },
  PHANTOM_SEED: {
    label: 'Phantom Seed',
    description: 'Draw 1 extra card in Foundation and discard 1.',
  },
  DEBT_SHIELD: {
    label: 'Debt Shield',
    description: 'First debt injection is automatically countered.',
  },
};

export const HANDICAPS: Record<HandicapId, { cordBonus: number; description: string }> = {
  NO_CREDIT_HISTORY: { cordBonus: 0.15, description: 'Layer 2 starts at 40 and debt cards cost 30% more.' },
  SINGLE_INCOME: { cordBonus: 0.15, description: 'Only one income-generating card may be held.' },
  TARGETED: { cordBonus: 0.15, description: 'Liquidator activates at much lower heat.' },
  CASH_POOR: { cordBonus: 0.20, description: 'Starting cash reduced to 10000.' },
  CLOCK_CURSED: { cordBonus: 0.30, description: 'Run budget drops to 9 minutes.' },
  DISADVANTAGE_DRAFT: { cordBonus: 0.80, description: 'All handicaps active and bleed constraints enabled.' },
};

export const EXTRACTION_COSTS: Record<ExtractionActionId, number> = {
  MARKET_DUMP: 30,
  CREDIT_REPORT_PULL: 25,
  REGULATORY_FILING: 35,
  MISINFORMATION_FLOOD: 20,
  DEBT_INJECTION: 40,
  HOSTILE_TAKEOVER: 60,
  LIQUIDATION_NOTICE: 45,
};

export const COUNTER_COSTS: Record<CounterCardId, number> = {
  LIQUIDITY_WALL: 15,
  CREDIT_FREEZE: 10,
  EVIDENCE_FILE: 20,
  SIGNAL_CLEAR: 8,
  DEBT_SHIELD: 25,
  SOVEREIGNTY_LOCK: 0,
  FORCED_DRAW_BLOCK: 12,
};

export const COUNTER_TO_EXTRACTION: Record<CounterCardId, ExtractionActionId> = {
  LIQUIDITY_WALL: 'MARKET_DUMP',
  CREDIT_FREEZE: 'CREDIT_REPORT_PULL',
  EVIDENCE_FILE: 'REGULATORY_FILING',
  SIGNAL_CLEAR: 'MISINFORMATION_FLOOD',
  DEBT_SHIELD: 'DEBT_INJECTION',
  SOVEREIGNTY_LOCK: 'HOSTILE_TAKEOVER',
  FORCED_DRAW_BLOCK: 'LIQUIDATION_NOTICE',
};

export const COUNTER_INTEL_VISIBILITY: Record<number, VisibilityTier> = {
  0: 'SHADOWED',
  1: 'SIGNALED',
  2: 'TELEGRAPHED',
  3: 'EXPOSED',
};

export const MODE_TAG_WEIGHTS: Record<'solo' | 'pvp' | 'coop' | 'ghost', Record<string, number>> = {
  solo: {
    liquidity: 2.0,
    income: 2.2,
    resilience: 1.8,
    scale: 2.5,
    tempo: 1.0,
    sabotage: 0.0,
    counter: 0.0,
    heat: 0.6,
    trust: 0.0,
    aid: 0.0,
    precision: 1.2,
    divergence: 0.0,
    variance: 1.0,
    cascade: 1.8,
    momentum: 2.0,
  },
  pvp: {
    liquidity: 0.8,
    income: 0.6,
    resilience: 1.0,
    scale: 0.5,
    tempo: 2.4,
    sabotage: 2.8,
    counter: 2.2,
    heat: 1.5,
    trust: 0.0,
    aid: 0.0,
    precision: 0.8,
    divergence: 0.0,
    variance: 1.4,
    cascade: 1.2,
    momentum: 1.5,
  },
  coop: {
    liquidity: 1.5,
    income: 1.8,
    resilience: 2.0,
    scale: 1.3,
    tempo: 1.0,
    sabotage: 0.2,
    counter: 0.5,
    heat: 0.8,
    trust: 3.0,
    aid: 2.5,
    precision: 1.0,
    divergence: 0.0,
    variance: 0.4,
    cascade: 1.6,
    momentum: 1.2,
  },
  ghost: {
    liquidity: 1.2,
    income: 1.0,
    resilience: 1.4,
    scale: 0.9,
    tempo: 1.8,
    sabotage: 0.0,
    counter: 0.0,
    heat: 1.0,
    trust: 0.0,
    aid: 0.0,
    precision: 2.6,
    divergence: 3.0,
    variance: 0.3,
    cascade: 1.5,
    momentum: 1.0,
  },
};

export const CARD_LEGALITY: Record<'solo' | 'pvp' | 'coop' | 'ghost', DeckType[]> = {
  solo: ['OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED', 'SO', 'DISCIPLINE'],
  pvp: ['OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED', 'SO', 'SABOTAGE', 'COUNTER', 'BLUFF'],
  coop: ['OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED', 'SO', 'AID', 'RESCUE', 'TRUST'],
  ghost: ['OPPORTUNITY', 'IPA', 'FUBAR', 'MISSED_OPPORTUNITY', 'PRIVILEGED', 'SO', 'DISCIPLINE', 'GHOST'],
};

export const MODE_TIMING_LOCKS: Record<'solo' | 'pvp' | 'coop' | 'ghost', TimingClass[]> = {
  solo: ['PHZ'],
  pvp: ['CTR'],
  coop: ['RES', 'AID'],
  ghost: ['GBM'],
};

export const SAFETY_CARD_IDS = new Set(['COMPLIANCE_SHIELD', 'ASSET_INSURANCE', 'DEBT_SHIELD']);
export const PHASE_WINDOW_TICKS = 5;
export const COUNTER_WINDOW_TICKS = 1;
export const GHOST_WINDOW_RADIUS = 3;
