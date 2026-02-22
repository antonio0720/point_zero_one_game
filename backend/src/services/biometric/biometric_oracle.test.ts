import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('BiometricOracle', () => {
  let biometricOracle: any;

  beforeEach(() => {
    biometricOracle = new BiometricOracle();
  });

  afterEach(() => {
    // Reset any state or mock functions as needed for each test
  });

  describe('multiplier', () => {
    it('should be capped at 1.5x', () => {
      const initialMultiplier = biometricOracle.getMultiplier();
      biometricOracle.setMultiplier(2);
      expect(biometricOracle.getMultiplier()).toBeLessThanOrEqual(1.5);
    });
  });

  describe('consent gate', () => {
    it('should block processing when consent is not given', () => {
      biometricOracle.setConsentGiven(false);
      expect(biometricOracle.processData()).toBeFalsy();
    });

    it('should allow processing when consent is given', () => {
      biometricOracle.setConsentGiven(true);
      expect(biometricOracle.processData()).toBeTruthy();
    });
  });

  describe('data storage', () => {
    it('should not store stress data', () => {
      const initialStressData = biometricOracle.getStressData();
      biometricOracle.storeStressData(123);
      expect(biometricOracle.getStressData()).toEqual(initialStressData);
    });
  });

  describe('multiplier application', () => {
    it('should apply multiplier only to FUBAR negative cash effects', () => {
      const initialCash = biometricOracle.getCash();
      biometricOracle.setMultiplier(1.2);
      biometricOracle.applyMultiplier(-100); // FUBAR negative cash effect
      expect(biometricOracle.getCash()).toBeLessThan(initialCash * 1.2);

      biometricOracle.applyMultiplier(50); // Non-FUBAR positive cash effect
      expect(biometricOracle.getCash()).toBeGreaterThanOrEqual(initialCash);
    });
  });
});
