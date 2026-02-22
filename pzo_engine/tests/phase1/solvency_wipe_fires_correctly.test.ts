import { describe, it, expect } from 'vitest';
import { Engine } from '../../../src/engine';

describe('Solvency wipe fires correctly', () => {
  it('force cash to -600000, verify bankruptcy event emits', async () => {
    const engine = new Engine();
    await engine.init();

    // Set initial state
    engine.state.cash = -600000;

    // Run simulation
    await engine.runSimulation();

    // Verify events emitted
    expect(engine.events).toContainEqual({
      type: 'bankruptcy',
      timestamp: expect.any(Number),
    });
  });
});
