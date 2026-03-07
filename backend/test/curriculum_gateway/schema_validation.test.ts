// backend/test/curriculum_gateway/schema_validation.test.ts

import { describe, expect, it } from 'vitest';
import { CreateInstitutionSchema } from '../../src/api-gateway/contracts/curriculum/institution.dto';
import { CreateCohortSchema } from '../../src/api-gateway/contracts/curriculum/cohort.dto';
import { CreatePackSchema } from '../../src/api-gateway/contracts/curriculum/pack.dto';
import { CreateBenchmarkDefinitionSchema } from '../../src/api-gateway/contracts/curriculum/benchmark.dto';
import type { ValidationResult } from '../../src/api-gateway/middleware/validation/schema_validator';
import { validateSchemaValue } from '../../src/api-gateway/middleware/validation/schema_validator';

function expectValidationFailure(
  result: ValidationResult,
): void {
  expect(result.ok).toBe(false);
}

describe('Schema Validation', () => {
  it('validates CreateInstitution schema accepts valid input', () => {
    const result = validateSchemaValue(
      'test:create-institution:valid',
      CreateInstitutionSchema as any,
      { name: 'Test Institution' },
    );

    expect(result.ok).toBe(true);
  });

  it('validates CreateInstitution schema rejects missing name', () => {
    const result = validateSchemaValue(
      'test:create-institution:missing-name',
      CreateInstitutionSchema as any,
      {},
    );

    expectValidationFailure(result);
  });

  it('validates CreateInstitution schema rejects invalid domain', () => {
    const result = validateSchemaValue(
      'test:create-institution:invalid-domain',
      CreateInstitutionSchema as any,
      { name: 'Test Institution', domain: 'INVALID DOMAIN!' },
    );

    expectValidationFailure(result);
  });

  it('validates CreateCohort schema accepts valid input', () => {
    const result = validateSchemaValue(
      'test:create-cohort:valid',
      CreateCohortSchema as any,
      { name: 'Cohort 1', slug: 'cohort-1' },
    );

    expect(result.ok).toBe(true);
  });

  it('validates CreatePack schema accepts valid input', () => {
    const result = validateSchemaValue(
      'test:create-pack:valid',
      CreatePackSchema as any,
      {
        slug: 'cashflow-rescue',
        title: 'Cashflow Rescue',
        competencyDomain: 'cashflow',
      },
    );

    expect(result.ok).toBe(true);
  });

  it('validates benchmark definition requires all comparability fields', () => {
    const result = validateSchemaValue(
      'test:create-benchmark-definition:valid',
      CreateBenchmarkDefinitionSchema as any,
      {
        benchmarkCode: 'BM-001',
        packVersionId: '123e4567-e89b-42d3-a456-426614174000',
        scenarioSet: ['s1'],
        seedSet: ['seed1'],
        attemptLimit: 3,
        scoringFormulaVersion: '1.0',
        proofRequired: true,
        comparabilityPolicy: {
          packVersionLocked: true,
          rulesetVersionLocked: true,
          engineVersionLocked: true,
          modeOverlayVersionLocked: true,
          seedSetLocked: true,
          scoringFormulaLocked: true,
          proofRequired: true,
          clientBuildFloor: 'web-1.0.0',
        },
      },
    );

    expect(result.ok).toBe(true);
  });
});