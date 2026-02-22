import { describe, it, expect } from 'vitest';
import { M04aDrawWeightsShiftUnderHighCreditTightness } from '../../../src/phase5/M04aDrawWeightsShiftUnderHighCreditTightness';

describe('M04a draw weights shift under high credit tightness', () => {
  it('creditTightness=5 → FUBAR draw probability increases measurably', async () => {
    const model = new M04aDrawWeightsShiftUnderHighCreditTightness();
    await model.init();

    const result = await model.run({ creditTightness: 5 });

    expect(result.drawProbability).toBeGreaterThan(0.1);
  });
});
