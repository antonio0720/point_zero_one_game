import { TickRateInterpolator } from './TickRateInterpolator';
import { generateRandomTierSequence } from './utils';
import { config } from './config';

describe('TickRateInterpolator fuzz tests', () => {
  const T0Min = config.t0Min;
  const T4Max = config.t4Max;

  it('should handle random tier sequences without out-of-bounds durations', () => {
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      const sequence = generateRandomTierSequence();
      const durations = sequence.map((tier, index) => {
        // Simulate duration calculation between consecutive tiers
        // This is a placeholder; actual implementation depends on the interpolator
        return TickRateInterpolator.calculateDuration(sequence[index], sequence[index + 1]);
      });
      
      // Check each duration is within bounds
      durations.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(T0Min);
        expect(d).toBeLessThanOrEqual(T4Max);
      });
      
      // Check no NaN or negative durations
      durations.forEach(d => {
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).not.toBeNaN();
      });
      
      // Check convergence to latest target
      const lastDuration = durations[durations.length - 1];
      const latestTarget = sequence[sequence.length - 1];
      expect(lastDuration).toBeCloseTo(latestTarget, 2);
    }
  });
});
