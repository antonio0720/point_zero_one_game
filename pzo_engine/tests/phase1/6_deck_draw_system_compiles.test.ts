import { describe, it, expect } from 'vitest';

describe('6-deck draw system compiles', () => {
  it('npx tsc --noEmit returns zero errors', async () => {
    const result = await runTscWithNoEmit();
    expect(result.exitCode).toBe(0);
  });
});

async function runTscWithNoEmit(): Promise<{ exitCode: number }> {
  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('npx', ['tsc', '--noEmit'], { stdio: 'inherit' });
    return { exitCode: result.status };
  } catch (error) {
    throw new Error(`Error running tsc with no emit: ${error}`);
  }
}
