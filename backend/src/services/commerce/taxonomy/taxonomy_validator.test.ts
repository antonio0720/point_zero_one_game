import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Taxonomy Validator', () => {
  let taxonomyValidator;

  beforeEach(() => {
    taxonomyValidator = new TaxonomyValidator(); // Assuming there's a TaxonomyValidator class
  });

  afterEach(() => {
    // Reset any state or mocks here if necessary
  });

  describe('missingTagDetection', () => {
    it('should return true when tag is missing', () => {
      const product = { sku: 'ABC123' };
      expect(taxonomyValidator.missingTagDetection(product)).toBe(true);
    });

    it('should return false when tag is present', () => {
      const product = { sku: 'ABC123', tags: ['tag1'] };
      expect(taxonomyValidator.missingTagDetection(product)).toBe(false);
    });
  });

  describe('forbiddenSKUBlocking', () => {
    it('should block forbidden SKUs', () => {
      const forbiddenSKUs = ['ABC123']; // List of forbidden SKUs
      const product = { sku: 'ABC123' };
      expect(taxonomyValidator.forbiddenSKUBlocking(forbiddenSKUs, product)).toBe(true);
    });

    it('should allow non-forbidden SKUs', () => {
      const forbiddenSKUs = ['ABC123']; // List of forbidden SKUs
      const product = { sku: 'DEF456' };
      expect(taxonomyValidator.forbiddenSKUBlocking(forbiddenSKUs, product)).toBe(false);
    });
  });
});
