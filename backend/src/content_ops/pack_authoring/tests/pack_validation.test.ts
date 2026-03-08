/**
 * Validation Lints for Pack Authoring
 * /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/content_ops/pack_authoring/validation_lints.ts
 */

export interface Episode {
  id: number;
  name: string;
  rulesetId: number;
}

export interface Ruleset {
  id: number;
  name: string;
  benchmarkSeeds: string[];
  rubric: string;
  requiredPins?: string[];
  allowedTemplates?: string[];
  minBenchmarkSeedCount?: number;
}

export interface Pack {
  episode: Episode;
  ruleset: Ruleset;
  template: string;
  pins?: string[];
  benchmarkSeeds?: string[];
  rubric?: string | null;
}

export type ValidationLintSeverity = 'error' | 'warning';

export interface ValidationLint {
  code: string;
  severity: ValidationLintSeverity;
  message: string;
}

function normalizeString(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeStringArray(values?: string[]): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => normalizeString(value))
        .filter((value) => value.length > 0),
    ),
  ).sort();
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function resolvePackRubric(pack: Pack): string {
  return normalizeString(pack.rubric ?? pack.ruleset.rubric);
}

function resolvePackBenchmarkSeeds(pack: Pack): string[] {
  return normalizeStringArray(pack.benchmarkSeeds ?? pack.ruleset.benchmarkSeeds);
}

function resolveRequiredBenchmarkSeeds(pack: Pack): string[] {
  return normalizeStringArray(pack.ruleset.benchmarkSeeds);
}

function resolveRequiredPins(pack: Pack): string[] {
  return normalizeStringArray(pack.ruleset.requiredPins);
}

function resolvePackPins(pack: Pack): string[] {
  return normalizeStringArray(pack.pins);
}

function lintMissingItems(
  code: string,
  label: string,
  required: string[],
  actual: string[],
): ValidationLint[] {
  const missing = required.filter((value) => !actual.includes(value));

  if (missing.length === 0) {
    return [];
  }

  return [
    {
      code,
      severity: 'error',
      message: `${label} is missing required values: ${missing.join(', ')}`,
    },
  ];
}

export function getComparabilityGuardLints(pack1: Pack, pack2: Pack): ValidationLint[] {
  const lints: ValidationLint[] = [];

  if (pack1.episode.rulesetId !== pack1.ruleset.id) {
    lints.push({
      code: 'PACK_1_RULESET_REFERENCE_MISMATCH',
      severity: 'error',
      message: 'Pack 1 episode.rulesetId does not match pack 1 ruleset.id.',
    });
  }

  if (pack2.episode.rulesetId !== pack2.ruleset.id) {
    lints.push({
      code: 'PACK_2_RULESET_REFERENCE_MISMATCH',
      severity: 'error',
      message: 'Pack 2 episode.rulesetId does not match pack 2 ruleset.id.',
    });
  }

  if (pack1.ruleset.id !== pack2.ruleset.id) {
    lints.push({
      code: 'RULESET_ID_MISMATCH',
      severity: 'error',
      message: 'Packs are attached to different rulesets and cannot be compared deterministically.',
    });
  }

  const template1 = normalizeString(pack1.template);
  const template2 = normalizeString(pack2.template);

  if (template1 !== template2) {
    lints.push({
      code: 'TEMPLATE_MISMATCH',
      severity: 'error',
      message: 'Packs use different templates and cannot be compared safely.',
    });
  }

  const allowedTemplates1 = normalizeStringArray(pack1.ruleset.allowedTemplates);
  if (allowedTemplates1.length > 0 && !allowedTemplates1.includes(template1)) {
    lints.push({
      code: 'PACK_1_TEMPLATE_NOT_ALLOWED',
      severity: 'error',
      message: 'Pack 1 template is not allowed by its ruleset.',
    });
  }

  const allowedTemplates2 = normalizeStringArray(pack2.ruleset.allowedTemplates);
  if (allowedTemplates2.length > 0 && !allowedTemplates2.includes(template2)) {
    lints.push({
      code: 'PACK_2_TEMPLATE_NOT_ALLOWED',
      severity: 'error',
      message: 'Pack 2 template is not allowed by its ruleset.',
    });
  }

  const rubric1 = resolvePackRubric(pack1);
  const rubric2 = resolvePackRubric(pack2);

  if (rubric1.length === 0) {
    lints.push({
      code: 'PACK_1_RUBRIC_MISSING',
      severity: 'error',
      message: 'Pack 1 has no rubric baseline.',
    });
  }

  if (rubric2.length === 0) {
    lints.push({
      code: 'PACK_2_RUBRIC_MISSING',
      severity: 'error',
      message: 'Pack 2 has no rubric baseline.',
    });
  }

  if (rubric1.length > 0 && rubric2.length > 0 && rubric1 !== rubric2) {
    lints.push({
      code: 'RUBRIC_MISMATCH',
      severity: 'error',
      message: 'Packs do not share the same rubric baseline.',
    });
  }

  const requiredPins1 = resolveRequiredPins(pack1);
  const requiredPins2 = resolveRequiredPins(pack2);
  const packPins1 = resolvePackPins(pack1);
  const packPins2 = resolvePackPins(pack2);

  lints.push(
    ...lintMissingItems(
      'PACK_1_MISSING_REQUIRED_PINS',
      'Pack 1',
      requiredPins1,
      packPins1,
    ),
  );

  lints.push(
    ...lintMissingItems(
      'PACK_2_MISSING_REQUIRED_PINS',
      'Pack 2',
      requiredPins2,
      packPins2,
    ),
  );

  const requiredSeedBaseline1 = resolveRequiredBenchmarkSeeds(pack1);
  const requiredSeedBaseline2 = resolveRequiredBenchmarkSeeds(pack2);

  if (!arraysEqual(requiredSeedBaseline1, requiredSeedBaseline2)) {
    lints.push({
      code: 'RULESET_BENCHMARK_BASELINE_MISMATCH',
      severity: 'error',
      message: 'Rulesets define different required benchmark seed baselines.',
    });
  }

  const packSeeds1 = resolvePackBenchmarkSeeds(pack1);
  const packSeeds2 = resolvePackBenchmarkSeeds(pack2);

  lints.push(
    ...lintMissingItems(
      'PACK_1_MISSING_REQUIRED_BENCHMARK_SEEDS',
      'Pack 1',
      requiredSeedBaseline1,
      packSeeds1,
    ),
  );

  lints.push(
    ...lintMissingItems(
      'PACK_2_MISSING_REQUIRED_BENCHMARK_SEEDS',
      'Pack 2',
      requiredSeedBaseline2,
      packSeeds2,
    ),
  );

  const minSeedCount = Math.max(
    pack1.ruleset.minBenchmarkSeedCount ?? requiredSeedBaseline1.length,
    pack2.ruleset.minBenchmarkSeedCount ?? requiredSeedBaseline2.length,
  );

  if (packSeeds1.length < minSeedCount) {
    lints.push({
      code: 'PACK_1_MIN_BENCHMARK_SEED_COUNT_VIOLATION',
      severity: 'error',
      message: `Pack 1 has fewer benchmark seeds than the required minimum of ${minSeedCount}.`,
    });
  }

  if (packSeeds2.length < minSeedCount) {
    lints.push({
      code: 'PACK_2_MIN_BENCHMARK_SEED_COUNT_VIOLATION',
      severity: 'error',
      message: `Pack 2 has fewer benchmark seeds than the required minimum of ${minSeedCount}.`,
    });
  }

  if (!arraysEqual(packSeeds1, packSeeds2)) {
    lints.push({
      code: 'ACTIVE_BENCHMARK_SET_MISMATCH',
      severity: 'error',
      message: 'Packs do not activate the same benchmark seed set.',
    });
  }

  return lints;
}

export function comparabilityGuardChecks(pack1: Pack, pack2: Pack): boolean {
  return getComparabilityGuardLints(pack1, pack2).every(
    (lint) => lint.severity !== 'error',
  );
}