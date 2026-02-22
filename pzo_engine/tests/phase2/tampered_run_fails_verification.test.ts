import { describe, it, expect } from 'vitest';
import { TamperedRunFailsVerification } from './tampered_run_fails_verification';

describe('Tampered run fails verification', () => {
  it('mutate one action in stored log and verify replay produces different hash', async () => {
    const tamperedRun = new TamperedRunFailsVerification();
    await tamperedRun.run();

    expect(tamperedRun.replayHash).not.toBe(tamperedRun.expectedReplayHash);
  });
});
