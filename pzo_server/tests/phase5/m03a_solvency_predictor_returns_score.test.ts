import { describe, it, expect } from 'vitest';
import { SolvencyPredictorReturnsScore } from '../../../src/phase5/solvency-predictor-returns-score';

describe('M03a solvency predictor returns score', () => {
  it('should return a score > 0.7 and top_factors not empty for tick 400, drawdown 35%', async () => {
    const input = { tick: 400, drawdown: 35 };
    const output = await SolvencyPredictorReturnsScore(input);
    expect(output.score).toBeGreaterThan(0.7);
    expect(output.top_factors.length).toBeGreaterThan(0);
  });
});
