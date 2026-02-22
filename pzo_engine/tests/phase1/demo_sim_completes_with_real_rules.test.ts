import { describe, it, expect } from 'vitest';

describe('Demo sim completes with real rules', () => {
  it('should print final run with real cashflow when running demo with real rules', async () => {
    const output = await new Promise((resolve) => {
      process.stdout.write = (str: string) => resolve(str);
      require('../src/demo/run-demo.ts');
    });
    expect(output).toContain('Final Run:');
  });
});
