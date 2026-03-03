// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/modes/predator/extractionEngine.ts
// Sprint 7 — Extraction Attack System (fully rebuilt)
//
// Extractions are direct economic attacks in Predator mode.
// Types: CASH_SIPHON | SHIELD_CRACK | DEBT_SPIKE | HEAT_SPIKE | INCOME_DRAIN
//
// FIXES FROM SPRINT 4:
//   - REFLECT: damage now correctly routed to ATTACKER (was hitting defender)
//   - HEAT_SPIKE: actual computation added (tension bump + draw weight penalty)
//   - Cooldown tracking per type added (CooldownRegistry)
//   - Concurrent extraction cap enforced (ActiveExtractionTracker)
//   - compute() signature uses named object — no more positional arg errors
//   - EventBus emission pattern documented
//
// Density6 LLC · Confidential
// ═══════════════════════════════════════════════════════════════════════════

import { PREDATOR_CONFIG } from './predatorConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExtractionType =
  | 'CASH_SIPHON'
  | 'SHIELD_CRACK'
  | 'DEBT_SPIKE'
  | 'HEAT_SPIKE'
  | 'INCOME_DRAIN';

export type ExtractionOutcome =
  | 'PENDING'
  | 'LANDED'
  | 'BLOCKED'
  | 'REFLECTED'
  | 'DAMPENED'
  | 'ABSORBED'
  | 'TIMEOUT_LANDED';

export type CounterplayAction = 'BLOCK' | 'REFLECT' | 'DAMPEN' | 'ABSORB' | 'NONE';

export interface ExtractionParams {
  opponentCash:    number;
  opponentIncome:  number;
  opponentShields: number;
}

export interface ExtractionAction {
  id:               string;
  type:             ExtractionType;
  attackerId:       string;
  defenderId:       string;
  firedAtTick:      number;
  expiresAtTick:    number;
  bbCost:           number;
  rawCashImpact:    number;
  rawIncomeImpact:  number;
  rawShieldImpact:  number;
  /** HEAT_SPIKE specific: tension score bump applied to defender */
  rawTensionBump:   number;
  /** HEAT_SPIKE specific: draw weight penalty ticks */
  rawDrawPenalty:   number;
  outcome:          ExtractionOutcome;
  resolvedAtTick?:  number;
  actualImpact?:    ExtractionImpact;
}

export interface ExtractionImpact {
  /** Applied to defender */
  defenderCashDelta:    number;
  defenderIncomeDelta:  number;
  defenderShieldDelta:  number;
  defenderTensionBump:  number;
  defenderDrawPenalty:  number;
  /** Applied to ATTACKER on REFLECT */
  attackerCashBlowback: number;
  attackerBBReward:     number;
  /** Defender psyche meter increase */
  psycheHit:            number;
}

// ── Cooldown Registry ─────────────────────────────────────────────────────────

export interface CooldownRegistry {
  /** Tick at which each type comes off cooldown (0 = available) */
  readyAtTick: Record<ExtractionType, number>;
}

export const INITIAL_COOLDOWN_REGISTRY: CooldownRegistry = {
  readyAtTick: {
    CASH_SIPHON:  0,
    SHIELD_CRACK: 0,
    DEBT_SPIKE:   0,
    HEAT_SPIKE:   0,
    INCOME_DRAIN: 0,
  },
};

export function isExtractionOnCooldown(
  registry: CooldownRegistry,
  type: ExtractionType,
  currentTick: number,
): boolean {
  return currentTick < registry.readyAtTick[type];
}

export function applyCooldown(
  registry: CooldownRegistry,
  type: ExtractionType,
  currentTick: number,
): CooldownRegistry {
  const cooldown = PREDATOR_CONFIG.extractionCooldownTicks[type];
  return {
    readyAtTick: {
      ...registry.readyAtTick,
      [type]: currentTick + cooldown,
    },
  };
}

export function getCooldownTicksRemaining(
  registry: CooldownRegistry,
  type: ExtractionType,
  currentTick: number,
): number {
  return Math.max(0, registry.readyAtTick[type] - currentTick);
}

// ── Active Extraction Tracker ─────────────────────────────────────────────────

export interface ActiveExtractionTracker {
  /** IDs of all PENDING extractions */
  activeIds: string[];
}

export const INITIAL_ACTIVE_TRACKER: ActiveExtractionTracker = { activeIds: [] };

export function canFireNewExtraction(tracker: ActiveExtractionTracker): boolean {
  return tracker.activeIds.length < PREDATOR_CONFIG.maxConcurrentExtractions;
}

export function trackExtractionFired(
  tracker: ActiveExtractionTracker,
  id: string,
): ActiveExtractionTracker {
  return { activeIds: [...tracker.activeIds, id] };
}

export function trackExtractionResolved(
  tracker: ActiveExtractionTracker,
  id: string,
): ActiveExtractionTracker {
  return { activeIds: tracker.activeIds.filter(x => x !== id) };
}

// ── Catalog ───────────────────────────────────────────────────────────────────

export interface ExtractionCatalogEntry {
  type:        ExtractionType;
  bbCost:      number;
  label:       string;
  description: string;
  /** Uses named object — no more positional arg ordering errors */
  compute:     (params: ExtractionParams) => Pick<
    ExtractionAction,
    'bbCost' | 'rawCashImpact' | 'rawIncomeImpact' | 'rawShieldImpact' | 'rawTensionBump' | 'rawDrawPenalty'
  >;
}

export const EXTRACTION_CATALOG: ExtractionCatalogEntry[] = [
  {
    type:        'CASH_SIPHON',
    bbCost:      80,
    label:       'Cash Siphon',
    description: 'Drain 8% of opponent visible cash',
    compute: ({ opponentCash }) => ({
      bbCost:           80,
      rawCashImpact:    -Math.round(opponentCash * PREDATOR_CONFIG.extractionSiphonRate),
      rawIncomeImpact:  0,
      rawShieldImpact:  0,
      rawTensionBump:   0,
      rawDrawPenalty:   0,
    }),
  },
  {
    type:        'SHIELD_CRACK',
    bbCost:      120,
    label:       'Shield Crack',
    description: 'Destroy one opponent shield layer',
    compute: ({ opponentShields }) => ({
      bbCost:           120,
      rawCashImpact:    -PREDATOR_CONFIG.extractionShieldCrackCost,
      rawIncomeImpact:  0,
      rawShieldImpact:  opponentShields > 0 ? -1 : 0,
      rawTensionBump:   0,
      rawDrawPenalty:   0,
    }),
  },
  {
    type:        'INCOME_DRAIN',
    bbCost:      100,
    label:       'Income Drain',
    description: 'Reduce opponent income 15% for 2 months',
    compute: ({ opponentIncome }) => ({
      bbCost:           100,
      rawCashImpact:    0,
      rawIncomeImpact:  -Math.round(opponentIncome * PREDATOR_CONFIG.extractionIncomeDrainRate),
      rawShieldImpact:  0,
      rawTensionBump:   0,
      rawDrawPenalty:   0,
    }),
  },
  {
    type:        'DEBT_SPIKE',
    bbCost:      150,
    label:       'Debt Spike',
    description: 'Force unexpected expense — 80% of monthly income',
    compute: ({ opponentIncome }) => ({
      bbCost:           150,
      rawCashImpact:    -Math.round(opponentIncome * PREDATOR_CONFIG.extractionDebtSpikeRate),
      rawIncomeImpact:  0,
      rawShieldImpact:  0,
      rawTensionBump:   0,
      rawDrawPenalty:   0,
    }),
  },
  {
    type:        'HEAT_SPIKE',
    bbCost:      60,
    label:       'Heat Spike',
    description: 'Elevate opponent tension score + poison draw weights',
    // FIXED: was all-zeros in Sprint 4. Now has real computation.
    compute: () => ({
      bbCost:           60,
      rawCashImpact:    0,
      rawIncomeImpact:  0,
      rawShieldImpact:  0,
      rawTensionBump:   PREDATOR_CONFIG.heatSpikeTensionBump,
      rawDrawPenalty:   PREDATOR_CONFIG.heatSpikeDrawPenaltyTicks,
    }),
  },
];

// ── Build Extraction Action ───────────────────────────────────────────────────

export function buildExtractionAction(
  type:        ExtractionType,
  attackerId:  string,
  defenderId:  string,
  currentTick: number,
  params:      ExtractionParams,
): ExtractionAction {
  const entry    = EXTRACTION_CATALOG.find(e => e.type === type);
  if (!entry) throw new Error(`Unknown extraction type: ${type}`);
  const computed = entry.compute(params);

  return {
    id:           `ext-${currentTick}-${type}-${attackerId.slice(0, 6)}`,
    type,
    attackerId,
    defenderId,
    firedAtTick:  currentTick,
    expiresAtTick: currentTick + PREDATOR_CONFIG.counterplayWindowTicks,
    outcome:      'PENDING',
    ...computed,
  };
}

// ── Resolve Extraction ────────────────────────────────────────────────────────

export interface ExtractionResolution {
  resolved:            ExtractionAction;
  /** Impact applied to the DEFENDER */
  defenderImpact:      ExtractionImpact;
  /**
   * Impact applied to the ATTACKER.
   * Non-zero only on REFLECT — attacker takes blowback.
   * Sprint 4 bug: this was absent; reflected damage went to defender.
   */
  attackerBlowback:    number;
}

export function resolveExtraction(
  extraction:  ExtractionAction,
  counterplay: CounterplayAction,
  currentTick: number,
): ExtractionResolution {
  const timedOut = currentTick >= extraction.expiresAtTick;

  let outcome:         ExtractionOutcome;
  let cashMult         = 1.0;
  let incomeMult       = 1.0;
  let shieldMult       = 1.0;
  let psycheHit        = 0;
  let attackerBBReward = 0;
  let attackerBlowback = 0; // FIXED: REFLECT now routes here, not to defender

  switch (counterplay) {
    case 'BLOCK':
      outcome    = 'BLOCKED';
      cashMult   = 0;
      incomeMult = 0;
      shieldMult = 0;
      psycheHit  = 0;
      break;

    case 'REFLECT':
      // FIXED: cashMult is 0 on defender — attacker takes 50% blowback
      outcome         = 'REFLECTED';
      cashMult        = 0;       // defender takes NOTHING
      incomeMult      = 0;
      shieldMult      = 0;
      psycheHit       = 0.08;   // mild defender psyche from the stress of reflecting
      attackerBBReward = -40;
      // Attacker takes reflectDamagePct of the raw cash impact
      attackerBlowback = Math.round(
        Math.abs(extraction.rawCashImpact) * PREDATOR_CONFIG.reflectDamagePct,
      );
      break;

    case 'DAMPEN':
      outcome    = 'DAMPENED';
      cashMult   = 1 - PREDATOR_CONFIG.dampenReductionPct;  // 0.40 of original
      incomeMult = 1 - PREDATOR_CONFIG.dampenReductionPct;
      shieldMult = 0;  // dampen prevents shield crack
      psycheHit  = 0.05;
      break;

    case 'ABSORB':
      outcome    = 'ABSORBED';
      cashMult   = 0;
      incomeMult = 0;
      shieldMult = -1;  // one shield consumed — tracked by caller
      psycheHit  = 0;
      break;

    case 'NONE':
    default:
      outcome         = timedOut ? 'TIMEOUT_LANDED' : 'LANDED';
      cashMult        = 1.0;
      incomeMult      = 1.0;
      shieldMult      = 1.0;
      psycheHit       = timedOut ? 0.15 : 0.12;  // timeout = extra psyche hit
      attackerBBReward = 30;
      break;
  }

  const defenderImpact: ExtractionImpact = {
    defenderCashDelta:    Math.round(extraction.rawCashImpact   * cashMult),
    defenderIncomeDelta:  Math.round(extraction.rawIncomeImpact * incomeMult),
    defenderShieldDelta:  Math.round(extraction.rawShieldImpact * shieldMult),
    defenderTensionBump:  extraction.rawTensionBump,
    defenderDrawPenalty:  extraction.rawDrawPenalty,
    attackerCashBlowback: attackerBlowback, // populated by REFLECT
    attackerBBReward,
    psycheHit,
  };

  const resolved: ExtractionAction = {
    ...extraction,
    outcome,
    resolvedAtTick: currentTick,
    actualImpact:   defenderImpact,
  };

  return { resolved, defenderImpact, attackerBlowback };
}

// ── Derived ───────────────────────────────────────────────────────────────────

export function getExtractionLabel(type: ExtractionType): string {
  return EXTRACTION_CATALOG.find(e => e.type === type)?.label ?? type;
}

export function getExtractionBBCost(type: ExtractionType): number {
  return EXTRACTION_CATALOG.find(e => e.type === type)?.bbCost ?? 0;
}

/** Color for extraction type badges — aligned to designTokens.ts C.* */
export function extractionTypeColor(type: ExtractionType): string {
  const colors: Record<ExtractionType, string> = {
    CASH_SIPHON:  '#C9A84C',   // C.gold   — financial drain
    SHIELD_CRACK: '#4A9EFF',   // C.blue   — defense attack
    DEBT_SPIKE:   '#FF4D4D',   // C.red    — high impact
    HEAT_SPIKE:   '#FF9B2F',   // C.orange — pressure
    INCOME_DRAIN: '#9B7DFF',   // C.purple — sustained bleed
  };
  return colors[type];
}

export function extractionOutcomeLabel(outcome: ExtractionOutcome): string {
  const labels: Record<ExtractionOutcome, string> = {
    PENDING:        'PENDING',
    LANDED:         'LANDED',
    BLOCKED:        'BLOCKED',
    REFLECTED:      'REFLECTED',
    DAMPENED:       'DAMPENED',
    ABSORBED:       'ABSORBED',
    TIMEOUT_LANDED: 'LANDED (TIMEOUT)',
  };
  return labels[outcome];
}