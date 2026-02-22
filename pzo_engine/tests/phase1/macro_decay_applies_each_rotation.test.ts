import { describe, it, expect } from 'vitest';
import { Engine } from '../../../src';

describe('Macro decay applies each rotation', () => {
  it('inflation=3 reduces idle cash by correct % after 60 ticks', async () => {
    const engine = new Engine({
      inflation: 3,
    });

    await engine.init();

    const initialIdleCash = engine.state.cash.idle;
    for (let i = 0; i < 60; i++) {
      await engine.tick();
    }

    const finalIdleCash = engine.state.cash.idle;

    expect(finalIdleCash).toBeLessThan(initialIdleCash);
    expect((finalIdleCash / initialIdleCash) * 100).toBeCloseTo(3, 0.1);
  });
});
