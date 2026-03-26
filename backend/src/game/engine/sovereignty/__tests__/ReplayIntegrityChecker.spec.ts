import { describe, expect, it } from 'vitest';

import { ReplayIntegrityChecker } from '../ReplayIntegrityChecker';
import { applyCanonicalProofHash, createBaseSnapshot } from './fixtures';

describe('sovereignty/ReplayIntegrityChecker', () => {
  it('verifies a well-formed canonical backend snapshot', () => {
    const checker = new ReplayIntegrityChecker();
    const snapshot = applyCanonicalProofHash(
      createBaseSnapshot({
        sovereignty: {
          integrityStatus: 'UNVERIFIED',
          tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
          proofHash: null,
          sovereigntyScore: 0.79,
          verifiedGrade: 'A',
          proofBadges: ['TRUST_ARCHITECT'],
          gapVsLegend: 2,
          gapClosingRate: 0.25,
          cordScore: 0.77,
          auditFlags: [],
          lastVerifiedTick: 12,
        },
        telemetry: {
          decisions: [],
          outcomeReason: null,
          outcomeReasonCode: null,
          lastTickChecksum: 'f00dbabe',
          forkHints: [],
          emittedEventCount: 2,
          warnings: [],
        },
      }),
    );

    const result = checker.verify(snapshot);

    expect(result.ok).toBe(true);
    expect(result.integrityStatus).toBe('VERIFIED');
    expect(result.reason).toBeNull();
    expect(result.tickStreamChecksum).toHaveLength(64);
  });

  it('downgrades to UNVERIFIED when the run has no tick checksum evidence yet', () => {
    const checker = new ReplayIntegrityChecker();
    const snapshot = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: [],
        proofHash: null,
        sovereigntyScore: 0.5,
        verifiedGrade: 'C',
        proofBadges: [],
        gapVsLegend: 11,
        gapClosingRate: 0,
        cordScore: 0.45,
        auditFlags: [],
        lastVerifiedTick: null,
      },
    });

    const result = checker.verify(snapshot);

    expect(result.ok).toBe(false);
    expect(result.integrityStatus).toBe('UNVERIFIED');
    expect(result.reason).toMatch(/missing tick checksums/i);
    expect(result.expectedProofHash).toBeNull();
  });

  it('quarantines duplicated checksum chains and mismatched telemetry evidence', () => {
    const checker = new ReplayIntegrityChecker();
    const snapshot = createBaseSnapshot({
      telemetry: {
        decisions: [],
        outcomeReason: null,
        outcomeReasonCode: null,
        lastTickChecksum: 'feedface',
        forkHints: [],
        emittedEventCount: 2,
        warnings: [],
      },
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'deadbeef', 'cafebabe'],
        proofHash: null,
        sovereigntyScore: 0.58,
        verifiedGrade: 'B',
        proofBadges: ['CASCADE_ABSORBER'],
        gapVsLegend: 7,
        gapClosingRate: 0.18,
        cordScore: 0.57,
        auditFlags: [],
        lastVerifiedTick: null,
      },
    });

    const result = checker.verify(snapshot);

    expect(result.ok).toBe(false);
    expect(result.integrityStatus).toBe('QUARANTINED');
    expect(result.reason).toMatch(/duplicate checksum chain/i);
    expect(result.reason).toMatch(/telemetry.lastTickChecksum/i);
    expect(result.anomalyScore).toBeGreaterThan(0);
  });

  it('quarantines malformed stored proof hashes and canonical mismatches', () => {
    const checker = new ReplayIntegrityChecker();

    const malformed = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'VERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
        proofHash: 'bad-proof',
        sovereigntyScore: 0.79,
        verifiedGrade: 'A',
        proofBadges: ['TRUST_ARCHITECT'],
        gapVsLegend: 2,
        gapClosingRate: 0.25,
        cordScore: 0.77,
        auditFlags: [],
        lastVerifiedTick: 12,
      },
      telemetry: {
        decisions: [],
        outcomeReason: null,
        outcomeReasonCode: null,
        lastTickChecksum: 'f00dbabe',
        forkHints: [],
        emittedEventCount: 2,
        warnings: [],
      },
    });

    const canonical = applyCanonicalProofHash(
      createBaseSnapshot({
        sovereignty: {
          integrityStatus: 'UNVERIFIED',
          tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
          proofHash: null,
          sovereigntyScore: 0.79,
          verifiedGrade: 'A',
          proofBadges: ['TRUST_ARCHITECT'],
          gapVsLegend: 2,
          gapClosingRate: 0.25,
          cordScore: 0.77,
          auditFlags: [],
          lastVerifiedTick: 12,
        },
        telemetry: {
          decisions: [],
          outcomeReason: null,
          outcomeReasonCode: null,
          lastTickChecksum: 'f00dbabe',
          forkHints: [],
          emittedEventCount: 2,
          warnings: [],
        },
      }),
    );
    const mismatched = createBaseSnapshot({
      ...canonical,
      sovereignty: {
        ...canonical.sovereignty,
        proofHash: 'a'.repeat(64),
      },
    });

    expect(checker.verify(malformed).reason).toMatch(/proofHash/i);
    expect(checker.verify(mismatched).reason).toMatch(/does not match canonical backend proofHash/i);
  });

  it('enforces ghost mode evidence rules when legend markers are enabled', () => {
    const checker = new ReplayIntegrityChecker();
    const missingGhostEvidence = createBaseSnapshot({
      mode: 'ghost',
      cards: {
        hand: [],
        discard: [],
        exhaust: [],
        drawHistory: [],
        lastPlayed: [],
        ghostMarkers: [],
        drawPileSize: 0,
        deckEntropy: 0,
      },
      modeState: {
        holdEnabled: false,
        loadoutEnabled: false,
        sharedTreasury: false,
        sharedTreasuryBalance: 0,
        trustScores: {},
        roleAssignments: {},
        defectionStepByPlayer: {},
        legendMarkersEnabled: true,
        communityHeatModifier: 0,
        sharedOpportunityDeck: false,
        counterIntelTier: 0,
        spectatorLimit: 0,
        phaseBoundaryWindowsRemaining: 0,
        bleedMode: false,
        handicapIds: [],
        advantageId: null,
        disabledBots: [],
        modePresentation: 'phantom',
        roleLockEnabled: false,
        extractionActionsRemaining: 0,
        ghostBaselineRunId: null,
        legendOwnerUserId: null,
      },
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe'],
        proofHash: null,
        sovereigntyScore: 0.41,
        verifiedGrade: 'C',
        proofBadges: [],
        gapVsLegend: 14,
        gapClosingRate: 0.03,
        cordScore: 0.33,
        auditFlags: [],
        lastVerifiedTick: null,
      },
    });

    const result = checker.verify(missingGhostEvidence);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/ghost mode missing legend markers|ghost mode has legend markers but no ghostBaselineRunId/i);
  });

  it('quarantines non-finite economy, pressure, and shield anomalies', () => {
    const checker = new ReplayIntegrityChecker();
    const snapshot = createBaseSnapshot({
      economy: {
        cash: 20_000,
        debt: 5_000,
        incomePerTick: 100,
        expensesPerTick: 50,
        netWorth: Number.NaN,
        freedomTarget: 100_000,
        haterHeat: 140,
        opportunitiesPurchased: 3,
        privilegePlays: 1,
      },
      pressure: {
        score: Number.POSITIVE_INFINITY,
        tier: 'T2',
        band: 'ELEVATED',
        previousTier: 'T1',
        previousBand: 'BUILDING',
        upwardCrossings: 1,
        survivedHighPressureTicks: 4,
        lastEscalationTick: 10,
        maxScoreSeen: 0.67,
      },
      shield: {
        layers: [
          {
            layerId: 'L1',
            label: 'CASH_RESERVE',
            current: 75,
            max: 50,
            regenPerTick: 1,
            breached: false,
            integrityRatio: 1.5,
            lastDamagedTick: 10,
            lastRecoveredTick: 11,
          },
        ],
        weakestLayerId: 'L1',
        weakestLayerRatio: 1.5,
        blockedThisRun: 4,
        damagedThisRun: 3,
        breachesThisRun: 0,
        repairQueueDepth: 1,
      },
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe'],
        proofHash: null,
        sovereigntyScore: 0.5,
        verifiedGrade: 'C',
        proofBadges: [],
        gapVsLegend: 10,
        gapClosingRate: 0,
        cordScore: 0.45,
        auditFlags: [],
        lastVerifiedTick: null,
      },
    });

    const result = checker.verify(snapshot);

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/net worth is non-finite/i);
    expect(result.reason).toMatch(/pressure score is non-finite/i);
    expect(result.reason).toMatch(/hater heat is outside 0–100/i);
    expect(result.reason).toMatch(/current integrity is out of range/i);
  });
});
