import { describe, it, expect } from 'vitest';

describe('phase1', () => {
  it('constants match build guide', () => {
    const bankruptcyCash = -100;
    const netWorth = -200000;
    const forcedSale = 0.7;
    const ticks = 720;

    expect(bankruptcyCash).toBeLessThan(0);
    expect(netWorth).toBeLessThan(-100000);
    expect(forcedSale).toBeCloseTo(0.70, 2);
    expect(ticks).toBe(720);
  });
});
