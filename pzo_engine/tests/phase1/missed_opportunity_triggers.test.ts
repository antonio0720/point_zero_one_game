import { describe, it, expect } from 'vitest';
import { Engine } from '../../../src/engine';

describe('MISSED_OPPORTUNITY triggers', () => {
  it('3 consecutive passes, verify next draw is MISSED_OPPORTUNITY', async () => {
    const engine = new Engine();
    await engine.reset();

    // Set the initial state
    engine.state.phase1.passes = 0;
    engine.state.phase1.missedOpportunities = 0;

    // Simulate 3 consecutive passes
    for (let i = 0; i < 3; i++) {
      const result = await engine.draw();
      expect(result.trigger).toBe('PASS');
      if (result.trigger === 'PASS') {
        engine.state.phase1.passes++;
      }
    }

    // Verify the next draw is MISSED_OPPORTUNITY
    const nextResult = await engine.draw();
    expect(nextResult.trigger).toBe('MISSED_OPPORTUNITY');
  });
});
