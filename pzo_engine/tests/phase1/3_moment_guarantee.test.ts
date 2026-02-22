import { describe, it, expect } from 'vitest';
import { runFullSim } from '../utils/simUtils';

describe('3-moment guarantee', () => {
  it('run a full sim, verify moment_forge emits FUBAR + flip + missed events', async () => {
    const result = await runFullSim();
    expect(result).toContain('FUBAR');
    expect(result).toContain('flip');
    expect(result).toContain('missed');
  });
});
