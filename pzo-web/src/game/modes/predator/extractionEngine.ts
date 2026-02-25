// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/extractionEngine.ts
// Sprint 4 — Extraction Attack System
//
// Extractions are direct economic attacks in Predator mode.
// Types: CASH_SIPHON | SHIELD_CRACK | DEBT_SPIKE | HEAT_SPIKE | INCOME_DRAIN
// Each extraction opens a counterplay window for the opponent.
// Win/loss is determined by counterplay resolution or timeout.
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';

export type ExtractionType =
  | 'CASH_SIPHON'
  | 'SHIELD_CRACK'
  | 'DEBT_SPIKE'
  | 'HEAT_SPIKE'
  | 'INCOME_DRAIN';

export type ExtractionOutcome = 'PENDING' | 'LANDED' | 'BLOCKED' | 'REFLECTED' | 'DAMPENED' | 'TIMEOUT_LANDED';

export interface ExtractionAction {
  id: string;
  type: ExtractionType;
  attackerId: string;
  defenderId: string;
  firedAtTick: number;
  expiresAtTick: number;
  bbCost: number;
  /** Raw impact before counterplay */
  rawCashImpact: number;
  rawIncomeImpact: number;
  rawShieldImpact: number;
  outcome: ExtractionOutcome;
  resolvedAtTick?: number;
  actualImpact?: ExtractionImpact;
}

export interface ExtractionImpact {
  cashDelta: number;
  incomeDelta: number;
  shieldDelta: number;
  bbReward: number;         // attacker gains BB on successful land
  psycheHit: number;        // defender psyche meter impact
}

export interface ExtractionCatalogEntry {
  type: ExtractionType;
  bbCost: number;
  label: string;
  description: string;
  compute: (opponentCash: number, opponentIncome: number, opponentShields: number) => Omit<ExtractionAction, 'id' | 'attackerId' | 'defenderId' | 'firedAtTick' | 'expiresAtTick' | 'outcome' | 'type'>;
}

export const EXTRACTION_CATALOG: ExtractionCatalogEntry[] = [
  {
    type: 'CASH_SIPHON',
    bbCost: 80,
    label: 'Cash Siphon',
    description: 'Drain 8% of opponent visible cash',
    compute: (opponentCash) => ({
      bbCost: 80,
      rawCashImpact: -Math.round(opponentCash * PREDATOR_CONFIG.extractionSiphonRate),
      rawIncomeImpact: 0,
      rawShieldImpact: 0,
    }),
  },
  {
    type: 'SHIELD_CRACK',
    bbCost: 120,
    label: 'Shield Crack',
    description: 'Destroy one opponent shield',
    compute: (_c, _i, shields) => ({
      bbCost: 120,
      rawCashImpact: -PREDATOR_CONFIG.extractionShieldCrackCost,
      rawIncomeImpact: 0,
      rawShieldImpact: shields > 0 ? -1 : 0,
    }),
  },
  {
    type: 'INCOME_DRAIN',
    bbCost: 100,
    label: 'Income Drain',
    description: 'Reduce opponent income by $400/mo for 2 months',
    compute: (_c, income) => ({
      bbCost: 100,
      rawCashImpact: 0,
      rawIncomeImpact: -Math.round(income * 0.15),
      rawShieldImpact: 0,
    }),
  },
  {
    type: 'DEBT_SPIKE',
    bbCost: 150,
    label: 'Debt Spike',
    description: 'Force unexpected expense hit',
    compute: (_c, income) => ({
      bbCost: 150,
      rawCashImpact: -Math.round(income * 0.8),
      rawIncomeImpact: 0,
      rawShieldImpact: 0,
    }),
  },
  {
    type: 'HEAT_SPIKE',
    bbCost: 60,
    label: 'Heat Spike',
    description: 'Elevate opponent risk score (triggers worse fate draws)',
    compute: () => ({
      bbCost: 60,
      rawCashImpact: 0,
      rawIncomeImpact: 0,
      rawShieldImpact: 0,
    }),
  },
];

// ─── Fire Extraction ──────────────────────────────────────────────────────────

export function buildExtractionAction(
  type: ExtractionType,
  attackerId: string,
  defenderId: string,
  currentTick: number,
  opponentCash: number,
  opponentIncome: number,
  opponentShields: number,
): ExtractionAction {
  const catalog = EXTRACTION_CATALOG.find(e => e.type === type)!;
  const computed = catalog.compute(opponentCash, opponentIncome, opponentShields);

  return {
    id: `ext-${currentTick}-${type}-${attackerId}`,
    type,
    attackerId,
    defenderId,
    firedAtTick: currentTick,
    expiresAtTick: currentTick + PREDATOR_CONFIG.counterplayWindowTicks,
    outcome: 'PENDING',
    ...computed,
  };
}

// ─── Resolve Extraction ───────────────────────────────────────────────────────

export type CounterplayAction = 'BLOCK' | 'REFLECT' | 'DAMPEN' | 'ABSORB' | 'NONE';

export function resolveExtraction(
  extraction: ExtractionAction,
  counterplay: CounterplayAction,
  currentTick: number,
): { resolved: ExtractionAction; defenderImpact: ExtractionImpact; attackerBBReward: number } {
  const timedOut = currentTick >= extraction.expiresAtTick;

  let outcome: ExtractionOutcome;
  let cashMult = 1.0;
  let incomeMult = 1.0;
  let shieldMult = 1.0;
  let psycheHit = 0;
  let attackerBBReward = 0;

  if (counterplay === 'BLOCK') {
    outcome = 'BLOCKED';
    cashMult = 0; incomeMult = 0; shieldMult = 0;
    psycheHit = 0;
  } else if (counterplay === 'REFLECT') {
    outcome = 'REFLECTED';
    cashMult = -0.5;   // reflected back at attacker (handled by caller)
    psycheHit = 0.15;  // attacker takes psyche hit
    attackerBBReward = -40;
  } else if (counterplay === 'DAMPEN') {
    outcome = 'DAMPENED';
    cashMult = 0.4; incomeMult = 0.4; shieldMult = 0;
    psycheHit = 0.05;
  } else if (timedOut || counterplay === 'NONE') {
    outcome = timedOut ? 'TIMEOUT_LANDED' : 'LANDED';
    cashMult = 1.0; incomeMult = 1.0; shieldMult = 1.0;
    psycheHit = 0.12;
    attackerBBReward = 30;
  } else {
    outcome = 'LANDED';
    psycheHit = 0.10;
    attackerBBReward = 20;
  }

  const impact: ExtractionImpact = {
    cashDelta:    Math.round(extraction.rawCashImpact   * cashMult),
    incomeDelta:  Math.round(extraction.rawIncomeImpact * incomeMult),
    shieldDelta:  Math.round(extraction.rawShieldImpact * shieldMult),
    bbReward:     attackerBBReward,
    psycheHit,
  };

  const resolved: ExtractionAction = {
    ...extraction,
    outcome,
    resolvedAtTick: currentTick,
    actualImpact: impact,
  };

  return { resolved, defenderImpact: impact, attackerBBReward };
}
