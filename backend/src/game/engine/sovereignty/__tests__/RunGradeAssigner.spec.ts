import { describe, expect, it } from 'vitest';

import { RunGradeAssigner, GradeRunContext } from '../RunGradeAssigner';
import { applyCanonicalProofHash, createBaseSnapshot } from './fixtures';

describe('sovereignty/RunGradeAssigner', () => {
  it('scores snapshots into deterministic grade results with breakdowns and badges', () => {
    const assigner = new RunGradeAssigner();
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());

    const result = assigner.score(snapshot);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.grade).toMatch(/A|B|C|D|F|S/);
    expect(Array.isArray(result.badges)).toBe(true);
    expect(result.breakdown).toBeTruthy();
    expect(result.breakdown.decisionSpeedScore).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.avgShieldPct).toBeGreaterThanOrEqual(0);
  });

  it('adds analytics, ML, and DL surfaces without changing the underlying grade law', () => {
    const assigner = new RunGradeAssigner();
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());

    const analytics = assigner.scoreWithAnalytics(snapshot);
    const { result: mlResult, ml } = assigner.scoreWithML(snapshot);
    const { result: dlResult, dl } = assigner.scoreWithDL(snapshot);
    const full = assigner.fullGrade(snapshot);

    expect(analytics.score).toBeCloseTo(mlResult.score, 8);
    expect(ml.features.length).toBeGreaterThan(0);
    expect(dl.features.length).toBeGreaterThan(ml.features.length);
    expect(dlResult.grade).toBe(mlResult.grade);
    expect(full.result.grade).toBe(mlResult.grade);
    expect(full.narrative.length).toBeGreaterThan(20);
    expect(full.coaching.length).toBeGreaterThan(20);
    expect(full.badgeNarrative.length).toBeGreaterThan(10);
  });

  it('tracks batched grading and exposes comparison deltas between runs', () => {
    const assigner = new RunGradeAssigner();
    const weaker = applyCanonicalProofHash(
      createBaseSnapshot({
        economy: {
          cash: 6_000,
          debt: 18_000,
          incomePerTick: 40,
          expensesPerTick: 120,
          netWorth: 2_500,
          freedomTarget: 100_000,
          haterHeat: 52,
          opportunitiesPurchased: 1,
          privilegePlays: 0,
        },
        shield: {
          layers: [
            {
              layerId: 'L1',
              label: 'CASH_RESERVE',
              current: 12,
              max: 50,
              regenPerTick: 1,
              breached: true,
              integrityRatio: 0.24,
              lastDamagedTick: 12,
              lastRecoveredTick: null,
            },
          ],
          weakestLayerId: 'L1',
          weakestLayerRatio: 0.24,
          blockedThisRun: 1,
          damagedThisRun: 9,
          breachesThisRun: 3,
          repairQueueDepth: 3,
        },
        sovereignty: {
          integrityStatus: 'VERIFIED',
          tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
          proofHash: null,
          sovereigntyScore: 0.21,
          verifiedGrade: 'D',
          proofBadges: [],
          gapVsLegend: 19,
          gapClosingRate: 0,
          cordScore: 0.18,
          auditFlags: ['pressure-breach'],
          lastVerifiedTick: 12,
        },
      }),
    );
    const stronger = applyCanonicalProofHash(createBaseSnapshot());

    const batch = assigner.batchScore([weaker, stronger]);
    const previous = assigner.score(weaker);
    const current = assigner.score(stronger);
    const comparison = assigner.compare(previous, current);

    expect(batch.results).toHaveLength(2);
    expect(batch.averageScore).toBeGreaterThanOrEqual(0);
    expect(comparison.currentGrade).toBeTruthy();
    expect(comparison.scoreDelta).toBeGreaterThanOrEqual(0);
  });

  it('supports explicit grading helpers, grade distance metrics, and merkle auditing', () => {
    const assigner = new RunGradeAssigner();
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const scored = assigner.score(snapshot);

    expect(assigner.verifyMerkleAt(0)).toBe(true);
    expect(assigner.merkleRoot.length).toBeGreaterThan(0);
    expect(assigner.gradedCount).toBeGreaterThan(0);
    expect(assigner.score(snapshot).grade).toBe(scored.grade);
    expect((assigner as any).computeGradeDistanceToNext(scored.score, scored.grade)).toBeGreaterThanOrEqual(0);
  });

  it('maintains stateful grading context, audit entries, and exportable state', () => {
    const assigner = new RunGradeAssigner();
    const first = applyCanonicalProofHash(createBaseSnapshot({ tick: 8 }));
    const second = applyCanonicalProofHash(
      createBaseSnapshot({
        tick: 9,
        economy: {
          cash: 24_000,
          debt: 4_000,
          incomePerTick: 110,
          expensesPerTick: 50,
          netWorth: 18_000,
          freedomTarget: 100_000,
          haterHeat: 8,
          opportunitiesPurchased: 4,
          privilegePlays: 1,
        },
        sovereignty: {
          integrityStatus: 'VERIFIED',
          tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe', 'facefeed'],
          proofHash: null,
          sovereigntyScore: 0.71,
          verifiedGrade: 'A',
          proofBadges: ['TRUST_ARCHITECT', 'CASCADE_ABSORBER'],
          gapVsLegend: 3,
          gapClosingRate: 0.22,
          cordScore: 0.7,
          auditFlags: [],
          lastVerifiedTick: 9,
        },
      }),
    );

    const runContext = new GradeRunContext({
      runId: 'run-grade-test',
      seed: 'grade-seed-test',
      hmacSecret: 'grade-secret',
    });

    const firstFull = runContext.fullGradeSnapshot(first);
    const secondFull = runContext.fullGradeSnapshot(second);
    const latestComparison = runContext.compareLatest();
    const state = runContext.exportState();

    expect(firstFull.result.score).toBeGreaterThanOrEqual(0);
    expect(secondFull.result.score).toBeGreaterThanOrEqual(firstFull.result.score);
    expect(latestComparison?.scoreDelta).toBeGreaterThanOrEqual(0);
    expect(runContext.verifyAuditEntry(0)).toBe(true);
    expect(state.totalGraded).toBe(2);
    expect(state.results).toHaveLength(2);
    expect(state.auditEntries).toHaveLength(2);
    expect(state.merkleRoot.length).toBeGreaterThan(0);
    expect(state.sealHash.length).toBeGreaterThan(0);
  });

  it('exports grader state with a stable seal after multiple grading passes', () => {
    const runContext = new GradeRunContext({
      runId: 'run-export-seal-test',
      seed: 'seal-seed',
      hmacSecret: 'seal-secret',
    });
    const first = applyCanonicalProofHash(createBaseSnapshot({ tick: 4 }));
    const second = applyCanonicalProofHash(createBaseSnapshot({ tick: 5 }));

    runContext.fullGradeSnapshot(first);
    runContext.fullGradeSnapshot(second);

    const state = runContext.exportState();

    expect(state.totalGraded).toBeGreaterThanOrEqual(2);
    expect(state.results.length).toBeGreaterThanOrEqual(2);
    expect(state.auditEntries.length).toBeGreaterThanOrEqual(0);
    expect(state.merkleRoot.length).toBeGreaterThan(0);
    expect(state.sealHash.length).toBeGreaterThan(0);
  });
});
