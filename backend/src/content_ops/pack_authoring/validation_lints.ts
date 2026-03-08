/**
 * Validation Lints for Pack Authoring
 * backend/src/content_ops/pack_authoring/validation_lints.ts
 *
 * Deterministic comparability checks used to keep authored packs
 * aligned across episodes, rulesets, templates, rubric baselines,
 * and benchmark seed sets.
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
  allowedTemplates?: string[];
  minBenchmarkSeedCount?: number;
}

export interface Pack {
  episode: Episode;
  ruleset: Ruleset;
  template: string;
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

function sameArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function getComparabilityGuardLints(
  pack1: Pack,
  pack2: Pack,
): ValidationLint[] {
  const lints: ValidationLint[] = [];

  if (pack1.episode.rulesetId !== pack2.episode.rulesetId) {
    lints.push({
      code: 'PACK_RULESET_ID_MISMATCH',
      severity: 'error',
      message:
        'Episodes reference different rulesetIds, making comparisons non-deterministic.',
    });
  }

  if (pack1.ruleset.id !== pack2.ruleset.id) {
    lints.push({
      code: 'RULESET_ENTITY_MISMATCH',
      severity: 'error',
      message:
        'Packs reference different ruleset entities, so authored outcomes are not comparable.',
    });
  }

  const template1 = normalizeString(pack1.template);
  const template2 = normalizeString(pack2.template);

  if (template1 !== template2) {
    lints.push({
      code: 'TEMPLATE_MISMATCH',
      severity: 'error',
      message:
        'Packs use different templates, which breaks deterministic comparability.',
    });
  }

  const rubric1 = normalizeString(pack1.rubric ?? pack1.ruleset.rubric);
  const rubric2 = normalizeString(pack2.rubric ?? pack2.ruleset.rubric);

  if (rubric1 !== rubric2) {
    lints.push({
      code: 'RUBRIC_MISMATCH',
      severity: 'error',
      message:
        'Packs do not share the same rubric baseline, so evaluation outputs may drift.',
    });
  }

  const requiredBenchmarkSeeds1 = normalizeStringArray(
    pack1.ruleset.benchmarkSeeds,
  );
  const requiredBenchmarkSeeds2 = normalizeStringArray(
    pack2.ruleset.benchmarkSeeds,
  );

  if (!sameArray(requiredBenchmarkSeeds1, requiredBenchmarkSeeds2)) {
    lints.push({
      code: 'RULESET_BASELINE_BENCHMARK_MISMATCH',
      severity: 'error',
      message:
        'Rulesets require different benchmark seed baselines, preventing apples-to-apples comparisons.',
    });
  }

  const activeBenchmarkSeeds1 = normalizeStringArray(
    pack1.benchmarkSeeds ?? pack1.ruleset.benchmarkSeeds,
  );
  const activeBenchmarkSeeds2 = normalizeStringArray(
    pack2.benchmarkSeeds ?? pack2.ruleset.benchmarkSeeds,
  );

  const missingFromPack1 = requiredBenchmarkSeeds1.filter(
    (seed) => !activeBenchmarkSeeds1.includes(seed),
  );
  if (missingFromPack1.length > 0) {
    lints.push({
      code: 'PACK_1_MISSING_REQUIRED_BENCHMARK_SEEDS',
      severity: 'error',
      message: `Pack 1 is missing required benchmark seeds: ${missingFromPack1.join(', ')}`,
    });
  }

  const missingFromPack2 = requiredBenchmarkSeeds2.filter(
    (seed) => !activeBenchmarkSeeds2.includes(seed),
  );
  if (missingFromPack2.length > 0) {
    lints.push({
      code: 'PACK_2_MISSING_REQUIRED_BENCHMARK_SEEDS',
      severity: 'error',
      message: `Pack 2 is missing required benchmark seeds: ${missingFromPack2.join(', ')}`,
    });
  }

  if (!sameArray(activeBenchmarkSeeds1, activeBenchmarkSeeds2)) {
    lints.push({
      code: 'ACTIVE_BENCHMARK_SET_MISMATCH',
      severity: 'error',
      message:
        'Packs do not activate the same benchmark seed set, so benchmark outputs cannot be compared safely.',
    });
  }

  const allowedTemplates1 = normalizeStringArray(pack1.ruleset.allowedTemplates);
  if (
    allowedTemplates1.length > 0 &&
    !allowedTemplates1.includes(template1)
  ) {
    lints.push({
      code: 'PACK_1_TEMPLATE_NOT_ALLOWED',
      severity: 'error',
      message: 'Pack 1 template is not allowed by its ruleset.',
    });
  }

  const allowedTemplates2 = normalizeStringArray(pack2.ruleset.allowedTemplates);
  if (
    allowedTemplates2.length > 0 &&
    !allowedTemplates2.includes(template2)
  ) {
    lints.push({
      code: 'PACK_2_TEMPLATE_NOT_ALLOWED',
      severity: 'error',
      message: 'Pack 2 template is not allowed by its ruleset.',
    });
  }

  const minSeedCount = Math.max(
    pack1.ruleset.minBenchmarkSeedCount ?? requiredBenchmarkSeeds1.length,
    pack2.ruleset.minBenchmarkSeedCount ?? requiredBenchmarkSeeds2.length,
  );

  if (activeBenchmarkSeeds1.length < minSeedCount) {
    lints.push({
      code: 'PACK_1_INSUFFICIENT_BENCHMARK_SEEDS',
      severity: 'error',
      message: `Pack 1 has fewer active benchmark seeds than the required minimum of ${minSeedCount}.`,
    });
  }

  if (activeBenchmarkSeeds2.length < minSeedCount) {
    lints.push({
      code: 'PACK_2_INSUFFICIENT_BENCHMARK_SEEDS',
      severity: 'error',
      message: `Pack 2 has fewer active benchmark seeds than the required minimum of ${minSeedCount}.`,
    });
  }

  return lints;
}

export function comparabilityGuardChecks(pack1: Pack, pack2: Pack): boolean {
  return getComparabilityGuardLints(pack1, pack2).every(
    (lint) => lint.severity !== 'error',
  );
}