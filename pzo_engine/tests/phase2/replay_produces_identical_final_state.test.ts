import { describe, it, expect } from 'vitest';
import { Replay } from '../../../src/phase2/replay';

describe('Replay produces identical final state', () => {
  it('Load run #1, replay → final score matches stored score to 8 decimal places', async () => {
    const replay = new Replay();
    const initialScore = await replay.loadRun(1);
    const finalScore = await replay.replay();

    expect(finalScore).toBeCloseTo(initialScore, 8);
  });
});
