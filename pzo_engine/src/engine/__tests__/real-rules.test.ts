import { describe, it, expect } from 'vitest';
import { Engine } from '../engine';

describe('Real Rules', () => {
  it('should absorb FUBAR', async () => {
    const engine = new Engine({
      cash: 100,
      fubar: true,
      shield: true,
    });
    await engine.tick();
    expect(engine.cash).toBe(90);
  });

  it('should trigger MISSED_OPPORTUNITY on consecutive_passes', async () => {
    const engine = new Engine({
      cash: 100,
      consecutivePasses: 3,
    });
    await engine.tick();
    expect(engine.missedOpportunity).toBe(true);
  });

  it('should reduce idle cash by macro decay', async () => {
    const engine = new Engine({
      cash: 100,
      macroDecay: true,
    });
    await engine.tick();
    expect(engine.cash).toBe(90);
  });

  it('should trigger forced sale at 70%', async () => {
    const engine = new Engine({
      cash: 70,
      forcedSale: true,
    });
    await engine.tick();
    expect(engine.forcedSaleTriggered).toBe(true);
  });

  it('should fire 3-moment guarantee', async () => {
    const engine = new Engine({
      cash: 100,
      threeMomentGuarantee: true,
    });
    await engine.tick(3);
    expect(engine.threeMomentGuaranteeFired).toBe(true);
  });
});
