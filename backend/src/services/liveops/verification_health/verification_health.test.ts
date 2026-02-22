import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Verification Health Service', () => {
  let verificationHealthService;

  beforeEach(() => {
    verificationHealthService = new VerificationHealthService();
  });

  afterEach(() => {
    // Reset any state or mocks here if needed
  });

  describe('thresholds', () => {
    it('should return correct status for happy path', () => {
      const thresholds = {
        success: 90,
        warning: 80,
        critical: 70,
      };
      const data = {
        successCount: 100,
        totalAttempts: 120,
      };

      const result = verificationHealthService.calculateStatus(thresholds, data);
      expect(result).toEqual('success');
    });

    it('should return correct status for warning threshold', () => {
      const thresholds = {
        success: 90,
        warning: 80,
        critical: 70,
      };
      const data = {
        successCount: 81,
        totalAttempts: 120,
      };

      const result = verificationHealthService.calculateStatus(thresholds, data);
      expect(result).toEqual('warning');
    });

    it('should return correct status for critical threshold', () => {
      const thresholds = {
        success: 90,
        warning: 80,
        critical: 70,
      };
      const data = {
        successCount: 69,
        totalAttempts: 120,
      };

      const result = verificationHealthService.calculateStatus(thresholds, data);
      expect(result).toEqual('critical');
    });
  });

  describe('alert firing windows', () => {
    it('should return correct status for happy path within window', () => {
      const thresholds = {
        success: 90,
        warning: 80,
        critical: 70,
        alertWindow: { start: new Date(), end: new Date(new Date().getTime() + 60 * 60 * 1000) }, // 1 hour window
      };
      const data = {
        successCount: 100,
        totalAttempts: 120,
        timestamp: new Date(),
      };

      const result = verificationHealthService.calculateStatus(thresholds, data);
      expect(result).toEqual('success');
    });

    it('should return correct status for warning threshold within window', () => {
      const thresholds = {
        success: 90,
        warning: 80,
        critical: 70,
        alertWindow: { start: new Date(), end: new Date(new Date().getTime() + 60 * 60 * 1000) }, // 1 hour window
      };
      const data = {
        successCount: 81,
        totalAttempts: 120,
        timestamp: new Date(),
      };

      const result = verificationHealthService.calculateStatus(thresholds, data);
      expect(result).toEqual('warning');
    });

    it('should return correct status for critical threshold within window', () => {
      const thresholds = {
        success: 90,
        warning: 80,
        critical: 70,
        alertWindow: { start: new Date(), end: new Date(new Date().getTime() + 60 * 60 * 1000) }, // 1 hour window
      };
      const data = {
        successCount: 69,
        totalAttempts: 120,
        timestamp: new Date(),
      };

      const result = verificationHealthService.calculateStatus(thresholds, data);
      expect(result).toEqual('critical');
    });

    it('should return correct status for happy path outside window', () => {
      const thresholds = {
        success: 90,
        warning: 80,
        critical: 70,
        alertWindow: { start: new Date(new Date().getTime() - 60 * 60 * 1000), end: new Date() }, // 1 hour window (past)
      };
      const data = {
        successCount: 100,
        totalAttempts: 120,
        timestamp: new Date(new Date().getTime() - 61 * 60 * 1000), // Timestamp is outside the window
      };

      const result = verificationHealthService.calculateStatus(thresholds, data);
      expect(result).toEqual('success');
    });
  });
});
