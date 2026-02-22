import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Public explorer lookup tests', () => {
  let initialCache: Record<string, string>;

  beforeEach(() => {
    // Initialize cache before each test
    initialCache = JSON.parse(localStorage.getItem('explorerCache') || '{}');
  });

  afterEach(() => {
    // Reset cache after each test
    localStorage.setItem('exploreCache', JSON.stringify(initialCache));
  });

  it('should return correct data for valid run_id and proof_hash', async () => {
    const runId = 'test_run_id';
    const proofHash = 'test_proof_hash';
    const expectedData = { /* some mock data */ };

    // Mock server response with the expected data
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve(expectedData),
    });

    await page.goto(`/explorer/${runId}/${proofHash}`);
    const result = await page.$eval('#data-container', (el) => el.textContent);

    expect(result).toEqual(JSON.stringify(expectedData));
    // Check if the response is cached correctly
    expect(initialCache[`${runId}/${proofHash}`]).toEqual(JSON.stringify(expectedData));
  });

  it('should return error message for non-existent run_id and proof_hash', async () => {
    const runId = 'non_existent_run_id';
    const proofHash = 'non_existent_proof_hash';
    const expectedErrorMessage = 'Data not found';

    // Mock server response with an error message
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ error: expectedErrorMessage }),
    });

    await page.goto(`/explorer/${runId}/${proofHash}`);
    const result = await page.$eval('#error-message', (el) => el.textContent);

    expect(result).toEqual(expectedErrorMessage);
  });

  it('should quarantine non-deterministic data', async () => {
    const runId = 'test_run_id';
    const proofHash = 'test_proof_hash';
    const expectedData = { /* some mock data with a non-deterministic field */ };

    // Mock server response with the expected data
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: () => Promise.resolve(expectedData),
    });

    await page.goto(`/explorer/${runId}/${proofHash}`);

    // Check if the non-deterministic data is quarantined correctly
    expect(initialCache[`${runId}/${proofHash}`]).toEqual(JSON.stringify({ deterministic: false, data: expectedData }));
  });
});
