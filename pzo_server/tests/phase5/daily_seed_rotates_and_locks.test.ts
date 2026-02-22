import { describe, it, expect } from 'vitest';
import { DailySeedRotatesAndLocks } from '../../../src/phase5/DailySeedRotatesAndLocks';

describe('Daily seed rotates and locks', () => {
  const dailySeedRotatesAndLocks = new DailySeedRotatesAndLocks();

  it('should rotate the daily seed on first attempt', async () => {
    const response = await dailySeedRotatesAndLocks.rotate();
    expect(response.status).toBe(200);
    expect(response.data.dailySeed).not.toBeUndefined();
  });

  it('should return 402 with upgrade CTA on second attempt', async () => {
    const response = await dailySeedRotatesAndLocks.rotate();
    expect(response.status).toBe(402);
    expect(response.data.upgradeCTA).not.toBeNull();
  });
});
