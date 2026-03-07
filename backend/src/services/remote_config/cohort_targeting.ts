import { createHash } from 'node:crypto';

export type CohortRuleOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'gte'
  | 'lte'
  | 'between'
  | 'contains'
  | 'intersects'
  | 'exists';

export interface CohortRule {
  field: string;
  operator: CohortRuleOperator;
  value?: unknown;
  values?: unknown[];
}

export interface VariantDefinition {
  key: string;
  weight: number;
  payload?: Record<string, unknown>;
}

export interface CohortDefinition {
  id: string;
  key: string;
  enabled: boolean;
  priority: number;
  rolloutPercent: number;
  rules: CohortRule[];
  variants?: VariantDefinition[];
  metadata?: Record<string, unknown>;
}

export interface CohortTargetingContext {
  subjectKey: string;
  environment?: string;
  cohortId?: string | null;
  stage?: string | null;
  region?: string | null;
  ladderTier?: number | null;
  accountAgeDays?: number | null;
  tags?: string[];
  traits?: Record<string, unknown>;
}

export interface CohortDecision {
  cohortId: string;
  cohortKey: string;
  matched: boolean;
  enabled: boolean;
  bucket: number;
  inRollout: boolean;
  selectedVariant: VariantDefinition | null;
  reason: string;
  metadata?: Record<string, unknown>;
}

function stableBucket(subjectKey: string, cohortKey: string): number {
  const digest = createHash('sha256')
    .update(`${subjectKey}:${cohortKey}`)
    .digest('hex')
    .slice(0, 8);

  return parseInt(digest, 16) % 100;
}

function getFieldValue(
  context: CohortTargetingContext,
  field: string,
): unknown {
  if (field.startsWith('traits.')) {
    const traitKey = field.slice('traits.'.length);
    return context.traits?.[traitKey];
  }

  return (context as unknown as Record<string, unknown>)[field];
}

function toComparableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

export class CohortTargeting {
  private readonly cohorts = new Map<string, CohortDefinition>();

  public register(definition: CohortDefinition): CohortDefinition {
    const normalized: CohortDefinition = {
      ...definition,
      enabled: Boolean(definition.enabled),
      priority: Number.isFinite(definition.priority) ? definition.priority : 100,
      rolloutPercent: Math.max(0, Math.min(100, Math.trunc(definition.rolloutPercent))),
      rules: [...definition.rules],
      variants: this.normalizeVariants(definition.variants),
      metadata: { ...(definition.metadata ?? {}) },
    };

    this.cohorts.set(normalized.id, normalized);
    return normalized;
  }

  public unregister(cohortId: string): boolean {
    return this.cohorts.delete(cohortId);
  }

  public evaluateAll(context: CohortTargetingContext): CohortDecision[] {
    return [...this.cohorts.values()]
      .sort((left, right) => left.priority - right.priority)
      .map((cohort) => this.evaluate(cohort.id, context));
  }

  public evaluate(cohortId: string, context: CohortTargetingContext): CohortDecision {
    const cohort = this.require(cohortId);
    const matched = cohort.rules.every((rule) => this.matchesRule(rule, context));
    const bucket = stableBucket(context.subjectKey, cohort.key);
    const inRollout = bucket < cohort.rolloutPercent;
    const selectedVariant =
      matched && cohort.enabled && inRollout ? this.selectVariant(cohort, bucket) : null;

    return {
      cohortId: cohort.id,
      cohortKey: cohort.key,
      matched,
      enabled: cohort.enabled,
      bucket,
      inRollout,
      selectedVariant,
      reason: this.buildReason(cohort, matched, inRollout),
      metadata: { ...(cohort.metadata ?? {}) },
    };
  }

  public decide(context: CohortTargetingContext): CohortDecision | null {
    for (const cohort of [...this.cohorts.values()].sort((a, b) => a.priority - b.priority)) {
      const decision = this.evaluate(cohort.id, context);
      if (decision.matched && decision.enabled && decision.inRollout) {
        return decision;
      }
    }

    return null;
  }

  public exportDefinitions(): CohortDefinition[] {
    return [...this.cohorts.values()].sort((a, b) => a.priority - b.priority);
  }

  private matchesRule(rule: CohortRule, context: CohortTargetingContext): boolean {
    const actual = getFieldValue(context, rule.field);

    switch (rule.operator) {
      case 'eq':
        return actual === rule.value;
      case 'neq':
        return actual !== rule.value;
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'in':
        return (rule.values ?? []).includes(actual);
      case 'not_in':
        return !(rule.values ?? []).includes(actual);
      case 'gte': {
        const actualNumber = toComparableNumber(actual);
        const expectedNumber = toComparableNumber(rule.value);
        return actualNumber !== null && expectedNumber !== null && actualNumber >= expectedNumber;
      }
      case 'lte': {
        const actualNumber = toComparableNumber(actual);
        const expectedNumber = toComparableNumber(rule.value);
        return actualNumber !== null && expectedNumber !== null && actualNumber <= expectedNumber;
      }
      case 'between': {
        const actualNumber = toComparableNumber(actual);
        const values = Array.isArray(rule.values) ? rule.values : [];
        const min = toComparableNumber(values[0]);
        const max = toComparableNumber(values[1]);
        return (
          actualNumber !== null &&
          min !== null &&
          max !== null &&
          actualNumber >= min &&
          actualNumber <= max
        );
      }
      case 'contains':
        return typeof actual === 'string' && typeof rule.value === 'string'
          ? actual.includes(rule.value)
          : false;
      case 'intersects': {
        const actualValues = new Set(asStringArray(actual));
        const expectedValues = asStringArray(rule.values ?? rule.value);
        return expectedValues.some((item) => actualValues.has(item));
      }
      default:
        return false;
    }
  }

  private selectVariant(cohort: CohortDefinition, bucket: number): VariantDefinition | null {
    const variants = cohort.variants ?? [];
    if (variants.length === 0) {
      return null;
    }

    const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (totalWeight <= 0) {
      return variants[0];
    }

    const normalized = bucket % totalWeight;
    let cursor = 0;
    for (const variant of variants) {
      cursor += variant.weight;
      if (normalized < cursor) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  private normalizeVariants(variants: VariantDefinition[] | undefined): VariantDefinition[] {
    if (!Array.isArray(variants)) {
      return [];
    }

    return variants
      .filter((variant) => variant && typeof variant.key === 'string' && variant.key.trim())
      .map((variant) => ({
        key: variant.key.trim(),
        weight: Math.max(1, Math.trunc(variant.weight)),
        payload: { ...(variant.payload ?? {}) },
      }));
  }

  private buildReason(
    cohort: CohortDefinition,
    matched: boolean,
    inRollout: boolean,
  ): string {
    if (!cohort.enabled) {
      return 'cohort_disabled';
    }
    if (!matched) {
      return 'rules_not_matched';
    }
    if (!inRollout) {
      return 'outside_rollout_bucket';
    }
    return 'targeted';
  }

  private require(cohortId: string): CohortDefinition {
    const cohort = this.cohorts.get(cohortId);
    if (!cohort) {
      throw new Error(`Cohort definition not found: ${cohortId}`);
    }
    return cohort;
  }
}

export default CohortTargeting;
