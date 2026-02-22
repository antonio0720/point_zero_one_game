import { describe, it, expect } from 'vitest';
import { ProofHasher } from '../../../src/phase2/proof_hasher';

describe('Proof hash includes ruleset version', () => {
  const seed = 'seed123';
  const actions = ['action1', 'action2'];
  const rulesetVersion1 = 'v1.0.0';
  const rulesetVersion2 = 'v2.0.0';

  it('proof hash changes if ruleset_version changes even with identical seed/actions', () => {
    const proofHasher1 = new ProofHasher(seed, actions);
    const proofHash1 = proofHasher1.getProofHash(rulesetVersion1);

    const proofHasher2 = new ProofHasher(seed, actions);
    const proofHash2 = proofHasher2.getProofHash(rulesetVersion2);

    expect(proofHash1).not.toBe(proofHash2);
  });

  it('proof hash is deterministic', () => {
    const proofHasher = new ProofHasher(seed, actions);
    const proofHash1 = proofHasher.getProofHash(rulesetVersion1);
    const proofHash2 = proofHasher.getProofHash(rulesetVersion1);

    expect(proofHash1).toBe(proofHash2);
  });
});
