import { describe, it, expect } from 'vitest';
import { MLBase } from '../ml-base';

describe('ML base tests', () => {
  it('kill-switch returns null', async () => {
    const ml = new MLBase();
    expect(ml.killSwitch()).toBeNull();
  });

  it('output clamped to 0-1', async () => {
    const ml = new MLBase();
    const output = ml.output(10);
    expect(output).toBeLessThanOrEqual(1);
    expect(output).toBeGreaterThanOrEqual(0);
  });

  it('audit_hash changes with ruleset_version', async () => {
    const ml = new MLBase();
    const initialAuditHash = ml.auditHash;
    ml.rulesetVersion++;
    expect(ml.auditHash).not.toBe(initialAuditHash);
  });

  it('top_factors is non-empty array', async () => {
    const ml = new MLBase();
    expect(ml.topFactors.length).toBeGreaterThan(0);
  });

  it('competitive mode blocks all ML', async () => {
    const ml = new MLBase();
    ml.competitiveMode = true;
    expect(ml.output(10)).toBeNull();
  });
});
