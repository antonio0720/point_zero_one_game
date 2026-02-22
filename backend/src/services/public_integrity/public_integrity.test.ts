import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Public Integrity Service', () => {
  let publicIntegrityService;

  beforeEach(() => {
    publicIntegrityService = new PublicIntegrityService();
  });

  afterEach(() => {
    // Clear any caching or state between tests
  });

  describe('Redaction', () => {
    it('should redact sensitive data correctly in plain text', () => {
      const inputText = 'Account number: 1234567890, Balance: $1000';
      const expectedOutput = 'Account number: *******, Balance: $$$$$';
      expect(publicIntegrityService.redactSensitiveData(inputText)).toEqual(expectedOutput);
    });

    it('should redact sensitive data correctly in JSON', () => {
      const inputJson = JSON.stringify({ accountNumber: '1234567890', balance: 1000 });
      const expectedOutput = JSON.stringify({ accountNumber: '*******', balance: $$$$$ });
      expect(publicIntegrityService.redactSensitiveData(inputJson)).toEqual(expectedOutput);
    });

    it('should handle empty input correctly', () => {
      const inputText = '';
      const expectedOutput = '';
      expect(publicIntegrityService.redactSensitiveData(inputText)).toEqual(expectedOutput);
    });
  });

  describe('Caching Headers', () => {
    it('should cache headers correctly for multiple requests with the same input', () => {
      // Set up a mock input and expected caching behavior
      const mockInput = 'mock-input';
      const mockHeaders = new Headers({ 'Cache-Control': 'max-age=3600' });

      publicIntegrityService.getHeadersForInput(mockInput).should.equal(mockHeaders);
      publicIntegrityService.getHeadersForInput(mockInput).should.equal(mockHeaders);
    });

    it('should not cache headers for different inputs', () => {
      // Set up a mock input and expected caching behavior
      const mockInput1 = 'mock-input-1';
      const mockHeaders1 = new Headers({ 'Cache-Control': 'max-age=3600' });

      const mockInput2 = 'mock-input-2';
      const mockHeaders2 = new Headers({ 'Cache-Control': 'max-age=7200' });

      publicIntegrityService.getHeadersForInput(mockInput1).should.equal(mockHeaders1);
      publicIntegrityService.getHeadersForInput(mockInput2).should.not.equal(mockHeaders1);
      publicIntegrityService.getHeadersForInput(mockInput2).should.equal(mockHeaders2);
    });
  });

  describe('Exemplar Lookup', () => {
    it('should return the correct exemplar for a given input', () => {
      // Set up mock exemplars and expected lookup behavior
      const mockExemplars = new Map([
        ['mock-input-1', 'exemplar-1'],
        ['mock-input-2', 'exemplar-2'],
      ]);

      publicIntegrityService.setExemplars(mockExemplars);

      expect(publicIntegrityService.getExemplarForInput('mock-input-1')).toEqual('exemplar-1');
      expect(publicIntegrityService.getExemplarForInput('mock-input-2')).toEqual('exemplar-2');
    });

    it('should return null for an input without a matching exemplar', () => {
      // Set up mock exemplars and expected lookup behavior
      const mockExemplars = new Map([
        ['mock-input-1', 'exemplar-1'],
        ['mock-input-2', 'exemplar-2'],
      ]);

      publicIntegrityService.setExemplars(mockExemplars);

      expect(publicIntegrityService.getExemplarForInput('mock-input-3')).toBeNull();
    });
  });
});
