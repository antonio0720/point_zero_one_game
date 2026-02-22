import { describe, it, expect } from 'vitest';
import { AuditHasher } from '../../../src/audit_hasher';

describe('M03a audit hash is stable', () => {
  const hasher = new AuditHasher();

  it('same inputs always produce same SHA256 audit_hash', async () => {
    const input1 = { id: '12345' };
    const input2 = { id: '12345' };

    const auditHash1 = await hasher.hash(input1);
    const auditHash2 = await hasher.hash(input2);

    expect(auditHash1).toBe(auditHash2);
  });
});
