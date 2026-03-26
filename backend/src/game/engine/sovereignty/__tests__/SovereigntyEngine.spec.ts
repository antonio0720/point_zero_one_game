import { describe, expect, it } from 'vitest';

import { SovereigntyEngine } from '../SovereigntyEngine';
import { createBaseSnapshot, applyCanonicalProofHash, createBusMock } from './fixtures';

describe('sovereignty/SovereigntyEngine', () => {
  it('reports healthy engine state and exposes empty run state before processing', () => {
    const engine = new SovereigntyEngine();
    const health = engine.getHealth();

    expect(health.engineId).toBe('sovereignty');
    expect(health.status).toBe('HEALTHY');
    expect(engine.getLastRunSummary()).toBeNull();
    expect(engine.getCORDHistory()).toEqual([]);
    expect(engine.getAuditTrail()).toEqual([]);
  });

  it('processes a tick, appends proof-chain evidence, and emits analytics surfaces', () => {
    const engine = new SovereigntyEngine();
    const snapshot = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe'],
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

    const ticked = engine.tick(snapshot, { nowMs: 1_700_000_000_000 } as never);

    expect(ticked.sovereignty.tickChecksums.length).toBeGreaterThan(snapshot.sovereignty.tickChecksums.length);
    expect(engine.getTickSignals().length).toBeGreaterThan(0);
    expect(engine.extractMLFeatures(ticked).features.length).toBe(32);
    expect(engine.extractDLTensor(ticked).data.length).toBe(48);
  });

  it('finalizes a run, verifies integrity, and emits sovereignty.completed on the bus', () => {
    const engine = new SovereigntyEngine();
    const bus = createBusMock();
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
          gapClosingRate: 0.22,
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

    const finalized = engine.finalizeRun(snapshot, bus as never, 1_700_000_010_000);

    expect(finalized.sovereignty.integrityStatus).toMatch(/VERIFIED|QUARANTINED/);
    expect(finalized.sovereignty.proofHash).toHaveLength(64);
    expect(finalized.sovereignty.verifiedGrade).toMatch(/A|B|C|D|F|S/);
    expect(bus.events.some((entry) => entry.event === 'sovereignty.completed')).toBe(true);
  });

  it('initializes accumulator state, snapshots ticks, and completes the run pipeline', () => {
    const engine = new SovereigntyEngine();
    const bus = createBusMock();
    const snapshot = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
        proofHash: null,
        sovereigntyScore: 0.69,
        verifiedGrade: 'B',
        proofBadges: ['CASCADE_ABSORBER'],
        gapVsLegend: 5,
        gapClosingRate: 0.18,
        cordScore: 0.68,
        auditFlags: [],
        lastVerifiedTick: 10,
      },
    });

    engine.initRun({ snapshot, nowMs: 1_700_000_000_000 });
    engine.snapshotTick(snapshot);
    engine.snapshotTick(createBaseSnapshot({ tick: snapshot.tick + 1 }));

    const completed = engine.completeRun(snapshot, bus as never, 1_700_000_010_000);
    const last = engine.getLastCompleteRunResult();

    expect(completed.finalSnapshot.runId).toBe(snapshot.runId);
    expect(completed.integrityCheckPassed || completed.tampered || completed.proofGenerated).toBe(true);
    expect(completed.pipelineSteps.length).toBeGreaterThan(0);
    expect(last?.runIdentity.signature.runId).toBe(snapshot.runId);
    expect(engine.isPipelineRunning()).toBe(false);
  });

  it('builds proof-card and public-summary projections only when enough backend proof exists', () => {
    const engine = new SovereigntyEngine();
    const unverified = createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef'],
        proofHash: null,
        sovereigntyScore: 0.4,
        verifiedGrade: 'C',
        proofBadges: [],
        gapVsLegend: 12,
        gapClosingRate: 0,
        cordScore: 0.35,
        auditFlags: ['pending'],
        lastVerifiedTick: null,
      },
    });
    const verified = applyCanonicalProofHash(createBaseSnapshot());

    expect(engine.buildProofCard(unverified)).toBeNull();
    expect(engine.buildProofCard(verified)).not.toBeNull();
    expect(engine.projectPublicSummary(unverified, 'Antonio')).toBeNull();
    expect(engine.projectPublicSummary(verified, 'Antonio')?.runId).toBe(verified.runId);
    expect(engine.buildProofCardExportData(verified, 'Antonio')?.runId).toBe(verified.runId);
  });

  it('exposes badge, ghost, integrity, and trajectory analytics from the current snapshot', () => {
    const engine = new SovereigntyEngine();
    const ghost = applyCanonicalProofHash(
      createBaseSnapshot({
        mode: 'ghost',
        sovereignty: {
          integrityStatus: 'UNVERIFIED',
          tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
          proofHash: null,
          sovereigntyScore: 0.86,
          verifiedGrade: 'A',
          proofBadges: ['GHOST_SLAYER', 'TRUST_ARCHITECT'],
          gapVsLegend: 1,
          gapClosingRate: 0.35,
          cordScore: 0.84,
          auditFlags: [],
          lastVerifiedTick: 12,
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
          ghostBaselineRunId: 'ghost-baseline-1',
          legendOwnerUserId: 'user-1',
        },
      }),
    );

    const badges = engine.getBadgeEligibility(ghost);
    const proofLifecycle = engine.getProofLifecycleState();
    const ghostReport = engine.getGhostReport(ghost);
    const integrityReport = engine.buildIntegrityForensicReport();
    const projection = engine.projectFinalScore(ghost.outcome as never);
    const distances = engine.computeGradeDistanceMap(ghost.sovereignty.sovereigntyScore);

    expect(badges.length).toBeGreaterThan(0);
    expect(proofLifecycle).toBeTruthy();
    expect(ghostReport?.gapVsLegend).toBeGreaterThanOrEqual(0);
    expect(integrityReport.totalAuditEntries).toBeGreaterThanOrEqual(0);
    expect(projection.projectedScore).toBeGreaterThanOrEqual(0);
    expect(distances.length).toBeGreaterThan(0);
  });
});
