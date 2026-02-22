import { describe, it, expect } from 'vitest';
import { ProofHasher } from '../../../src/phase2/proof_hasher';

describe('Proof hash is deterministic', () => {
  const proofHasher = new ProofHasher();

  it('same run inputs always produce same SHA256 hash', async () => {
    const input1 = {
      blockNumber: 12345,
      transactionCount: 10,
      gasUsed: '1000000',
      gasLimit: '2000000',
      timestamp: 1643723900,
      transactions: Array(10).fill({
        from: '0x1234567890123456789012345678901234567890',
        to: '0x9876543210987654321098765432109876543210',
        value: '10000000000000000',
      }),
    };

    const input2 = JSON.parse(JSON.stringify(input1));

    const hash1 = await proofHasher.hashProof(input1);
    const hash2 = await proofHasher.hashProof(input2);

    expect(hash1).toBe(hash2);
  });
});
