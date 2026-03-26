import { describe, expect, it } from 'vitest';

import { ProofGenerator } from '../ProofGenerator';
import { applyCanonicalProofHash, createBaseSnapshot } from './fixtures';

describe('sovereignty/ProofGenerator', () => {
  it('builds a deterministic proof input from the canonical backend snapshot', () => {
    const generator = new ProofGenerator();
    const snapshot = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
        proofHash: null,
        sovereigntyScore: 0.64,
        verifiedGrade: 'B',
        proofBadges: ['CASCADE_ABSORBER'],
        gapVsLegend: 6,
        gapClosingRate: 0.2,
        cordScore: 0.61,
        auditFlags: [],
        lastVerifiedTick: 8,
      },
    });

    const input = generator.buildProofInput(snapshot);

    expect(input.seed).toBe(snapshot.seed);
    expect(input.userId).toBe(snapshot.userId);
    expect(input.outcome).toBe(snapshot.outcome);
    expect(input.finalNetWorth).toBe(snapshot.economy.netWorth);
    expect(input.tickStreamChecksum).toHaveLength(64);
  });

  it('generates the same proof hash for identical runs and a different one for changed runs', () => {
    const generator = new ProofGenerator();
    const snapshot = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
        proofHash: null,
        sovereigntyScore: 0.64,
        verifiedGrade: 'B',
        proofBadges: ['CASCADE_ABSORBER'],
        gapVsLegend: 6,
        gapClosingRate: 0.2,
        cordScore: 0.61,
        auditFlags: [],
        lastVerifiedTick: 8,
      },
    });

    const identical = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
        proofHash: null,
        sovereigntyScore: 0.64,
        verifiedGrade: 'B',
        proofBadges: ['CASCADE_ABSORBER'],
        gapVsLegend: 6,
        gapClosingRate: 0.2,
        cordScore: 0.61,
        auditFlags: [],
        lastVerifiedTick: 8,
      },
    });

    const changed = createBaseSnapshot({
      economy: {
        cash: 31_000,
        debt: 4_000,
        incomePerTick: 180,
        expensesPerTick: 75,
        netWorth: 27_000,
        freedomTarget: 100_000,
        haterHeat: 9,
        opportunitiesPurchased: 4,
        privilegePlays: 1,
      },
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe', 'beadfeed'],
        proofHash: null,
        sovereigntyScore: 0.79,
        verifiedGrade: 'A',
        proofBadges: ['TRUST_ARCHITECT'],
        gapVsLegend: 2,
        gapClosingRate: 0.28,
        cordScore: 0.77,
        auditFlags: [],
        lastVerifiedTick: 12,
      },
    });

    const proofA = generator.generate(snapshot);
    const proofB = generator.generate(identical);
    const proofC = generator.generate(changed);

    expect(proofA).toHaveLength(64);
    expect(proofA).toBe(proofB);
    expect(proofA).not.toBe(proofC);
  });

  it('computes a stable tick stream checksum and falls back to sha256(empty) for empty streams', () => {
    const generator = new ProofGenerator();
    const withTicks = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
        proofHash: null,
        sovereigntyScore: 0.64,
        verifiedGrade: 'B',
        proofBadges: ['CASCADE_ABSORBER'],
        gapVsLegend: 6,
        gapClosingRate: 0.2,
        cordScore: 0.61,
        auditFlags: [],
        lastVerifiedTick: 8,
      },
    });
    const withoutTicks = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: [],
        proofHash: null,
        sovereigntyScore: 0.64,
        verifiedGrade: 'B',
        proofBadges: ['CASCADE_ABSORBER'],
        gapVsLegend: 6,
        gapClosingRate: 0.2,
        cordScore: 0.61,
        auditFlags: [],
        lastVerifiedTick: 8,
      },
    });

    const tickStreamChecksum = generator.computeTickStreamChecksum(withTicks);
    const emptyChecksum = generator.computeTickStreamChecksum(withoutTicks);

    expect(tickStreamChecksum).toHaveLength(64);
    expect(emptyChecksum).toHaveLength(64);
    expect(tickStreamChecksum).not.toBe(emptyChecksum);
  });

  it('verifies an existing proof hash only when the stored backend proof matches the canonical result', () => {
    const generator = new ProofGenerator();
    const verified = applyCanonicalProofHash(
      createBaseSnapshot({
        sovereignty: {
          integrityStatus: 'UNVERIFIED',
          tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
          proofHash: null,
          sovereigntyScore: 0.64,
          verifiedGrade: 'B',
          proofBadges: ['CASCADE_ABSORBER'],
          gapVsLegend: 6,
          gapClosingRate: 0.2,
          cordScore: 0.61,
          auditFlags: [],
          lastVerifiedTick: 8,
        },
      }),
    );
    const tampered = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'VERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
        proofHash: 'a'.repeat(64),
        sovereigntyScore: 0.64,
        verifiedGrade: 'B',
        proofBadges: ['CASCADE_ABSORBER'],
        gapVsLegend: 6,
        gapClosingRate: 0.2,
        cordScore: 0.61,
        auditFlags: [],
        lastVerifiedTick: 8,
      },
    });

    expect(generator.verifyExistingProofHash(verified)).toBe(true);
    expect(generator.verifyExistingProofHash(tampered)).toBe(false);
  });

  it('rejects malformed checksum material before it can pollute the proof surface', () => {
    const generator = new ProofGenerator();
    const malformed = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['not-hex'],
        proofHash: null,
        sovereigntyScore: 0.64,
        verifiedGrade: 'B',
        proofBadges: ['CASCADE_ABSORBER'],
        gapVsLegend: 6,
        gapClosingRate: 0.2,
        cordScore: 0.61,
        auditFlags: [],
        lastVerifiedTick: 8,
      },
    });

    expect(() => generator.computeTickStreamChecksum(malformed)).toThrow(/tickChecksums/i);
    expect(() =>
      generator.generateFromInput({
        seed: 'seed-1',
        tickStreamChecksum: 'bad-proof',
        outcome: 'TIMEOUT',
        finalNetWorth: 15_000,
        userId: 'user-1',
      }),
    ).toThrow(/tickStreamChecksum/i);
  });

  it('preserves negative net worth in the proof input so the backend proof remains audit-honest', () => {
    const generator = new ProofGenerator();
    const bankrupt = createBaseSnapshot({
      outcome: 'BANKRUPT',
      economy: {
        cash: 0,
        debt: 120_000,
        incomePerTick: 0,
        expensesPerTick: 500,
        netWorth: -25_000,
        freedomTarget: 100_000,
        haterHeat: 88,
        opportunitiesPurchased: 1,
        privilegePlays: 0,
      },
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe'],
        proofHash: null,
        sovereigntyScore: 0.11,
        verifiedGrade: 'F',
        proofBadges: [],
        gapVsLegend: 44,
        gapClosingRate: 0,
        cordScore: 0.09,
        auditFlags: ['bankruptcy'],
        lastVerifiedTick: null,
      },
    });

    const input = generator.buildProofInput(bankrupt);
    const proof = generator.generate(bankrupt);

    expect(input.finalNetWorth).toBe(-25_000);
    expect(proof).toHaveLength(64);
  });
});
