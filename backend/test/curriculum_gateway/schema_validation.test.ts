import { describe, expect, it } from 'vitest';
import { CreateInstitutionSchema } from '../../src/api-gateway/contracts/curriculum/institution.dto';
import { CreateCohortSchema } from '../../src/api-gateway/contracts/curriculum/cohort.dto';
import { CreatePackSchema } from '../../src/api-gateway/contracts/curriculum/pack.dto';
import { CreateBenchmarkDefinitionSchema } from '../../src/api-gateway/contracts/curriculum/benchmark.dto';
import { validateSchemaValue } from '../../src/api-gateway/middleware/validation/schema_validator';

describe('Schema Validation', () => {
  it('validates CreateInstitution schema accepts valid input', () => {
    const result = validateSchemaValue(
      'test:create-institution:valid',
      CreateInstitutionSchema,
      { name: 'Test', slug: 'test' },
    );

    if (!result.ok) {
      console.error('CreateInstitution valid payload failed:', JSON.stringify(result.errors, null, 2));
    }

    expect(result.ok).toBe(true);
  });

  it('validates CreateInstitution schema rejects missing name', () => {
    const result = validateSchemaValue(
      'test:create-institution:missing-name',
      CreateInstitutionSchema,
      { slug: 'test' },
    );

    expect(result.ok).toBe(false);
  });

  it('validates CreateInstitution schema rejects invalid slug', () => {
    const result = validateSchemaValue(
      'test:create-institution:invalid-slug',
      CreateInstitutionSchema,
      { name: 'Test', slug: 'INVALID SLUG!' },
    );

    expect(result.ok).toBe(false);
  });

  it('validates CreateCohort schema accepts valid input', () => {
    const result = validateSchemaValue(
      'test:create-cohort:valid',
      CreateCohortSchema,
      { name: 'Cohort 1', slug: 'cohort-1' },
    );

    expect(result.ok).toBe(true);
  });

  it('validates CreatePack schema accepts valid input', () => {
    const result = validateSchemaValue(
      'test:create-pack:valid',
      CreatePackSchema,
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
      CreateBenchmarkDefinitionSchema,
      {
        benchmarkCode: 'BM-001',
        packVersionId: '00000000-0000-0000-0000-000000000001',
        scenarioSet: ['s1'],
        seedSet: ['seed1'],
        attemptLimit: 3,
        scoringFormulaVersion: '1.0',
        comparabilityPolicy: {
          packVersionLocked: true,
          rulesetVersionLocked: true,
          engineVersionLocked: true,
          seedSetLocked: true,
          scoringFormulaLocked: true,
          proofRequired: true,
        },
      },
    );

    if (!result.ok) {
      console.error('CreateBenchmarkDefinition valid payload failed:', JSON.stringify(result.errors, null, 2));
    }

    expect(result.ok).toBe(true);
  });
});
