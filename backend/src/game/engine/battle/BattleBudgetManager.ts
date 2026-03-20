/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/battle/BattleBudgetManager.ts
 *
 * Doctrine:
 * - EngineRuntime already handles baseline per-tick PvP budget accrual
 * - this manager handles event-driven counterplay budget adjustments only
 * - hostile injections should increase response budget, not double baseline accrual
 * - PvP budget logic must stay deterministic and replay-safe: identical hostile
 *   attack sets must resolve to identical grants, taxes, and audit notes
 * - budget notes are backend artifacts, not UI copy; keep them concise but
 *   rich enough for replay, proof, telemetry, and chat narration layers
 */

import type { AttackCategory, AttackEvent } from '../core/GamePrimitives';
import type { BudgetResolution, BudgetResolutionInput } from './types';

type CategoryCounter = Readonly<Record<AttackCategory, number>>;

type AttackTaxBreakdown = {
  readonly category: AttackCategory;
  readonly baseTax: number;
  readonly severityTax: number;
  readonly targetingTax: number;
  readonly layerTax: number;
  readonly comboTax: number;
  readonly totalTax: number;
};

type GrantBreakdown = {
  readonly attack: AttackEvent;
  readonly categoryGrant: number;
  readonly severityGrant: number;
  readonly targetGrant: number;
  readonly layerGrant: number;
  readonly urgencyGrant: number;
  readonly comboGrant: number;
  readonly totalGrant: number;
};

const EMPTY_CATEGORY_COUNTER: CategoryCounter = Object.freeze({
  EXTRACTION: 0,
  LOCK: 0,
  DRAIN: 0,
  HEAT: 0,
  BREACH: 0,
  DEBT: 0,
});

const CATEGORY_RESPONSE_GRANT: Readonly<Record<AttackCategory, number>> = Object.freeze({
  EXTRACTION: 3.5,
  LOCK: 2.25,
  DRAIN: 1.75,
  HEAT: 1,
  BREACH: 4.25,
  DEBT: 3,
});

const CATEGORY_PRESSURE_TAX: Readonly<Record<AttackCategory, number>> = Object.freeze({
  EXTRACTION: 2,
  LOCK: 1,
  DRAIN: 1,
  HEAT: 1,
  BREACH: 2,
  DEBT: 2,
});

const TARGET_ENTITY_GRANT: Readonly<Record<AttackEvent['targetEntity'], number>> = Object.freeze({
  SELF: 1,
  PLAYER: 1.15,
  OPPONENT: 1.35,
  TEAM: 1.45,
});

const TARGET_ENTITY_TAX: Readonly<Record<AttackEvent['targetEntity'], number>> = Object.freeze({
  SELF: 0,
  PLAYER: 0.25,
  OPPONENT: 0.35,
  TEAM: 0.5,
});

const TARGET_LAYER_GRANT: Readonly<Record<AttackEvent['targetLayer'], number>> = Object.freeze({
  DIRECT: 1.5,
  L1: 0.75,
  L2: 1,
  L3: 1.15,
  L4: 1.4,
});

const TARGET_LAYER_TAX: Readonly<Record<AttackEvent['targetLayer'], number>> = Object.freeze({
  DIRECT: 0.75,
  L1: 0.25,
  L2: 0.35,
  L3: 0.45,
  L4: 0.65,
});

const MAGNITUDE_BUCKET_GRANT: ReadonlyArray<Readonly<{ min: number; grant: number }>> = Object.freeze([
  Object.freeze({ min: 85, grant: 4.5 }),
  Object.freeze({ min: 70, grant: 3.5 }),
  Object.freeze({ min: 55, grant: 2.5 }),
  Object.freeze({ min: 40, grant: 1.5 }),
  Object.freeze({ min: 25, grant: 1 }),
  Object.freeze({ min: 0, grant: 0.5 }),
]);

const MAGNITUDE_BUCKET_TAX: ReadonlyArray<Readonly<{ min: number; tax: number }>> = Object.freeze([
  Object.freeze({ min: 90, tax: 3 }),
  Object.freeze({ min: 75, tax: 2.5 }),
  Object.freeze({ min: 60, tax: 2 }),
  Object.freeze({ min: 45, tax: 1.5 }),
  Object.freeze({ min: 30, tax: 1 }),
  Object.freeze({ min: 0, tax: 0.5 }),
]);

const CATEGORY_SWARM_RESPONSE_BONUS: Readonly<Record<AttackCategory, number>> = Object.freeze({
  EXTRACTION: 1.5,
  LOCK: 0.75,
  DRAIN: 0.5,
  HEAT: 0.5,
  BREACH: 2,
  DEBT: 1.25,
});

const CATEGORY_SWARM_TAX_BONUS: Readonly<Record<AttackCategory, number>> = Object.freeze({
  EXTRACTION: 1,
  LOCK: 0.5,
  DRAIN: 0.5,
  HEAT: 0.25,
  BREACH: 1.25,
  DEBT: 0.75,
});

const CATEGORY_URGENCY_RESPONSE_BONUS: Readonly<Record<AttackCategory, number>> = Object.freeze({
  EXTRACTION: 1.25,
  LOCK: 0.75,
  DRAIN: 0.5,
  HEAT: 0.25,
  BREACH: 1.75,
  DEBT: 1,
});

const FIRST_BLOOD_COUNTERPLAY_GRANT = 5;
const SWARM_RESPONSE_CAP = 6.5;
const HOSTILE_RESPONSE_CAP_RATIO = 0.28;
const HOSTILE_RESPONSE_CAP_FLOOR = 14;
const HOSTILE_RESPONSE_CAP_CEIL = 24;
const HOSTILE_TAX_CAP = 18;
const TAX_ROUNDING_DIGITS = 2;

function roundTo(value: number, digits: number): number {
  const scalar = 10 ** digits;
  return Math.round(value * scalar) / scalar;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function magnitudeBucketGrant(magnitude: number): number {
  for (const bucket of MAGNITUDE_BUCKET_GRANT) {
    if (magnitude >= bucket.min) {
      return bucket.grant;
    }
  }

  return 0;
}

function magnitudeBucketTax(magnitude: number): number {
  for (const bucket of MAGNITUDE_BUCKET_TAX) {
    if (magnitude >= bucket.min) {
      return bucket.tax;
    }
  }

  return 0;
}

function buildCategoryCounter(attacks: readonly AttackEvent[]): CategoryCounter {
  const counter = {
    EXTRACTION: 0,
    LOCK: 0,
    DRAIN: 0,
    HEAT: 0,
    BREACH: 0,
    DEBT: 0,
  } satisfies Record<AttackCategory, number>;

  for (const attack of attacks) {
    counter[attack.category] += 1;
  }

  return counter;
}

function resolveCategoryComboGrant(category: AttackCategory, categoryCounter: CategoryCounter): number {
  const count = categoryCounter[category];

  if (count <= 1) {
    return 0;
  }

  return roundTo(Math.min(SWARM_RESPONSE_CAP, (count - 1) * CATEGORY_SWARM_RESPONSE_BONUS[category]), 2);
}

function resolveCategoryComboTax(category: AttackCategory, categoryCounter: CategoryCounter): number {
  const count = categoryCounter[category];

  if (count <= 1) {
    return 0;
  }

  return roundTo((count - 1) * CATEGORY_SWARM_TAX_BONUS[category], 2);
}

function buildGrantBreakdown(
  attack: AttackEvent,
  categoryCounter: CategoryCounter,
): GrantBreakdown {
  const categoryGrant = CATEGORY_RESPONSE_GRANT[attack.category];
  const severityGrant = magnitudeBucketGrant(attack.magnitude);
  const targetGrant = TARGET_ENTITY_GRANT[attack.targetEntity];
  const layerGrant = TARGET_LAYER_GRANT[attack.targetLayer];
  const urgencyGrant = CATEGORY_URGENCY_RESPONSE_BONUS[attack.category];
  const comboGrant = resolveCategoryComboGrant(attack.category, categoryCounter);

  const totalGrant = roundTo(
    categoryGrant + severityGrant + targetGrant + layerGrant + urgencyGrant + comboGrant,
    TAX_ROUNDING_DIGITS,
  );

  return {
    attack,
    categoryGrant,
    severityGrant,
    targetGrant,
    layerGrant,
    urgencyGrant,
    comboGrant,
    totalGrant,
  };
}

function buildTaxBreakdown(
  attack: AttackEvent,
  categoryCounter: CategoryCounter,
): AttackTaxBreakdown {
  const baseTax = CATEGORY_PRESSURE_TAX[attack.category];
  const severityTax = magnitudeBucketTax(attack.magnitude);
  const targetingTax = TARGET_ENTITY_TAX[attack.targetEntity];
  const layerTax = TARGET_LAYER_TAX[attack.targetLayer];
  const comboTax = resolveCategoryComboTax(attack.category, categoryCounter);

  const totalTax = roundTo(baseTax + severityTax + targetingTax + layerTax + comboTax, TAX_ROUNDING_DIGITS);

  return {
    category: attack.category,
    baseTax,
    severityTax,
    targetingTax,
    layerTax,
    comboTax,
    totalTax,
  };
}

function groupAttackIds(attacks: readonly AttackEvent[]): string {
  return attacks
    .map((attack) => attack.attackId)
    .slice(0, 3)
    .join('|');
}

function summarizeCategoryCounter(counter: CategoryCounter): string[] {
  const notes: string[] = [];

  for (const category of Object.keys(counter) as AttackCategory[]) {
    const count = counter[category];

    if (count <= 0) {
      continue;
    }

    notes.push(`${category}_WINDOW_x${String(count)}`);
  }

  return notes;
}

export class BattleBudgetManager {
  private clampBudget(value: number, cap: number): number {
    return Math.min(cap, Math.max(0, roundTo(value, TAX_ROUNDING_DIGITS)));
  }

  private resolveGrantCap(cap: number): number {
    const proportionalCap = cap * HOSTILE_RESPONSE_CAP_RATIO;

    return clamp(
      roundTo(proportionalCap, TAX_ROUNDING_DIGITS),
      HOSTILE_RESPONSE_CAP_FLOOR,
      HOSTILE_RESPONSE_CAP_CEIL,
    );
  }

  private normalizeForBudget(value: number): number {
    return roundTo(value, TAX_ROUNDING_DIGITS);
  }

  private collectGrantBreakdowns(attacks: readonly AttackEvent[]): readonly GrantBreakdown[] {
    const categoryCounter = buildCategoryCounter(attacks);

    return attacks.map((attack) => buildGrantBreakdown(attack, categoryCounter));
  }

  private collectTaxBreakdowns(attacks: readonly AttackEvent[]): readonly AttackTaxBreakdown[] {
    const categoryCounter = buildCategoryCounter(attacks);

    return attacks.map((attack) => buildTaxBreakdown(attack, categoryCounter));
  }

  private resolveFirstBloodGrant(input: BudgetResolutionInput): number {
    if (input.firstBloodClaimed) {
      return 0;
    }

    return FIRST_BLOOD_COUNTERPLAY_GRANT;
  }

  private resolveSwarmGrant(attacks: readonly AttackEvent[]): number {
    if (attacks.length <= 1) {
      return 0;
    }

    const base = (attacks.length - 1) * 1.35;
    const directPressureCount = attacks.filter((attack) => attack.targetLayer === 'DIRECT').length;
    const breachCount = attacks.filter((attack) => attack.category === 'BREACH').length;

    return roundTo(Math.min(SWARM_RESPONSE_CAP, base + directPressureCount * 0.5 + breachCount * 0.75), 2);
  }

  private resolveEscalationGrant(attacks: readonly AttackEvent[]): number {
    const highSeverityCount = attacks.filter((attack) => attack.magnitude >= 75).length;
    const criticalLineCount = attacks.filter(
      (attack) => attack.targetLayer === 'DIRECT' || attack.targetLayer === 'L4',
    ).length;

    if (highSeverityCount === 0 && criticalLineCount === 0) {
      return 0;
    }

    return roundTo(highSeverityCount * 1.4 + criticalLineCount * 0.85, 2);
  }

  private resolveCategoryEscalationGrant(attacks: readonly AttackEvent[]): number {
    const categoryCounter = buildCategoryCounter(attacks);
    let grant = 0;

    if (categoryCounter.EXTRACTION > 0 && categoryCounter.BREACH > 0) {
      grant += 2.5;
    }

    if (categoryCounter.LOCK > 0 && categoryCounter.DEBT > 0) {
      grant += 1.75;
    }

    if (categoryCounter.HEAT >= 2) {
      grant += 1;
    }

    return roundTo(grant, 2);
  }

  private totalGrantFromBreakdowns(breakdowns: readonly GrantBreakdown[]): number {
    return roundTo(
      breakdowns.reduce((sum, breakdown) => sum + breakdown.totalGrant, 0),
      TAX_ROUNDING_DIGITS,
    );
  }

  private totalTaxFromBreakdowns(breakdowns: readonly AttackTaxBreakdown[]): number {
    return roundTo(
      breakdowns.reduce((sum, breakdown) => sum + breakdown.totalTax, 0),
      TAX_ROUNDING_DIGITS,
    );
  }

  private buildGrantNotes(
    input: BudgetResolutionInput,
    grantBreakdowns: readonly GrantBreakdown[],
    firstBloodGrant: number,
    swarmGrant: number,
    escalationGrant: number,
    categoryEscalationGrant: number,
    finalGrant: number,
  ): string[] {
    const categoryCounter = buildCategoryCounter(input.injectedAttacks);
    const highestMagnitude = input.injectedAttacks.reduce(
      (max, attack) => Math.max(max, attack.magnitude),
      0,
    );

    return [
      ...(firstBloodGrant > 0 ? [`FIRST_BLOOD_COUNTERPLAY_GRANT:+${String(firstBloodGrant)}`] : []),
      ...(swarmGrant > 0 ? [`SWARM_RESPONSE_GRANT:+${String(this.normalizeForBudget(swarmGrant))}`] : []),
      ...(escalationGrant > 0
        ? [`SEVERITY_ESCALATION_GRANT:+${String(this.normalizeForBudget(escalationGrant))}`]
        : []),
      ...(categoryEscalationGrant > 0
        ? [`CATEGORY_ESCALATION_GRANT:+${String(this.normalizeForBudget(categoryEscalationGrant))}`]
        : []),
      `HOSTILE_RESPONSE_TOTAL:+${String(this.normalizeForBudget(finalGrant))}`,
      `HOSTILE_RESPONSE_ATTACKS:${String(input.injectedAttacks.length)}`,
      `HOSTILE_RESPONSE_MAX_MAGNITUDE:${String(highestMagnitude)}`,
      `HOSTILE_RESPONSE_IDS:${groupAttackIds(input.injectedAttacks)}`,
      ...summarizeCategoryCounter(categoryCounter),
      ...grantBreakdowns.slice(0, 4).map((breakdown) => {
        return `${breakdown.attack.category}_GRANT:${String(this.normalizeForBudget(breakdown.totalGrant))}`;
      }),
    ];
  }

  private capGrant(grant: number, cap: number): number {
    return roundTo(Math.min(grant, this.resolveGrantCap(cap)), TAX_ROUNDING_DIGITS);
  }

  public resolveAfterInjection(input: BudgetResolutionInput): BudgetResolution {
    const startingBudget = this.clampBudget(input.current, input.cap);

    if (input.mode !== 'pvp' || input.injectedAttacks.length === 0) {
      return {
        battleBudget: startingBudget,
        firstBloodClaimed: input.firstBloodClaimed,
        notes: [],
      };
    }

    const grantBreakdowns = this.collectGrantBreakdowns(input.injectedAttacks);
    const firstBloodGrant = this.resolveFirstBloodGrant(input);
    const swarmGrant = this.resolveSwarmGrant(input.injectedAttacks);
    const escalationGrant = this.resolveEscalationGrant(input.injectedAttacks);
    const categoryEscalationGrant = this.resolveCategoryEscalationGrant(input.injectedAttacks);

    const uncappedGrant = this.totalGrantFromBreakdowns(grantBreakdowns);
    const finalGrant = this.capGrant(
      uncappedGrant + firstBloodGrant + swarmGrant + escalationGrant + categoryEscalationGrant,
      input.cap,
    );

    const battleBudget = this.clampBudget(startingBudget + finalGrant, input.cap);
    const firstBloodClaimed = input.firstBloodClaimed || input.injectedAttacks.length > 0;
    const notes = this.buildGrantNotes(
      input,
      grantBreakdowns,
      firstBloodGrant,
      swarmGrant,
      escalationGrant,
      categoryEscalationGrant,
      finalGrant,
    );

    return {
      battleBudget,
      firstBloodClaimed,
      notes,
    };
  }

  private resolveGlobalPressureTaxModifiers(attacks: readonly AttackEvent[]): number {
    if (attacks.length === 0) {
      return 0;
    }

    let modifier = 0;
    const directHits = attacks.filter((attack) => attack.targetLayer === 'DIRECT').length;
    const breachHits = attacks.filter((attack) => attack.category === 'BREACH').length;
    const heavyHits = attacks.filter((attack) => attack.magnitude >= 80).length;

    if (attacks.length >= 3) {
      modifier += 1.5;
    }

    if (directHits >= 2) {
      modifier += 1.25;
    }

    if (breachHits > 0) {
      modifier += breachHits * 1.25;
    }

    if (heavyHits > 0) {
      modifier += heavyHits * 0.75;
    }

    return roundTo(modifier, TAX_ROUNDING_DIGITS);
  }

  private resolveCategoryCompressionTax(attacks: readonly AttackEvent[]): number {
    const categoryCounter = buildCategoryCounter(attacks);
    let compressionTax = 0;

    for (const category of Object.keys(categoryCounter) as AttackCategory[]) {
      const count = categoryCounter[category];

      if (count <= 1) {
        continue;
      }

      compressionTax += (count - 1) * 0.5;

      if (category === 'EXTRACTION' || category === 'BREACH') {
        compressionTax += 0.5;
      }
    }

    return roundTo(compressionTax, TAX_ROUNDING_DIGITS);
  }

  private buildTaxNotes(
    attacks: readonly AttackEvent[],
    taxBreakdowns: readonly AttackTaxBreakdown[],
    globalModifier: number,
    compressionTax: number,
    totalTax: number,
  ): string[] {
    const highestMagnitude = attacks.reduce((max, attack) => Math.max(max, attack.magnitude), 0);
    const categoryCounter = buildCategoryCounter(attacks);

    return [
      `PRESSURE_TAX_TOTAL:${String(this.normalizeForBudget(totalTax))}`,
      `PRESSURE_TAX_ATTACKS:${String(attacks.length)}`,
      `PRESSURE_TAX_MAX_MAGNITUDE:${String(highestMagnitude)}`,
      ...(globalModifier > 0 ? [`PRESSURE_TAX_GLOBAL_MODIFIER:${String(this.normalizeForBudget(globalModifier))}`] : []),
      ...(compressionTax > 0 ? [`PRESSURE_TAX_COMPRESSION:${String(this.normalizeForBudget(compressionTax))}`] : []),
      ...summarizeCategoryCounter(categoryCounter).map((note) => `PRESSURE_${note}`),
      ...taxBreakdowns.slice(0, 4).map((breakdown) => {
        return `${breakdown.category}_TAX:${String(this.normalizeForBudget(breakdown.totalTax))}`;
      }),
    ];
  }

  public resolveProjectedPressureTax(pendingAttacks: readonly AttackEvent[]): number {
    if (pendingAttacks.length === 0) {
      return 0;
    }

    const taxBreakdowns = this.collectTaxBreakdowns(pendingAttacks);
    const globalModifier = this.resolveGlobalPressureTaxModifiers(pendingAttacks);
    const compressionTax = this.resolveCategoryCompressionTax(pendingAttacks);
    const uncappedTax = this.totalTaxFromBreakdowns(taxBreakdowns) + globalModifier + compressionTax;
    const totalTax = roundTo(Math.min(HOSTILE_TAX_CAP, uncappedTax), TAX_ROUNDING_DIGITS);

    void this.buildTaxNotes(pendingAttacks, taxBreakdowns, globalModifier, compressionTax, totalTax);

    return totalTax;
  }
}
