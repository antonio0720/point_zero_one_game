import { describe, expect, it } from 'vitest';

import {
  SovereigntyExporter,
  ExporterRunContext,
} from '../SovereigntyExporter';
import { projectLeaderboardEntry } from '../contracts';
import { applyCanonicalProofHash, createAdapterContext, createBaseSnapshot } from './fixtures';

describe('sovereignty/SovereigntyExporter', () => {
  it('projects typed proof cards, summaries, artifacts, and score breakdowns from snapshots', () => {
    const exporter = new SovereigntyExporter();
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const context = createAdapterContext({ playerHandle: 'Antonio' });

    const card = exporter.toTypedProofCard(snapshot, context);
    const summary = exporter.toRunSummary(snapshot, context);
    const artifact = exporter.toExportArtifact(snapshot, context);
    const breakdown = exporter.computeBreakdown(snapshot);

    expect(card.runId).toBe(snapshot.runId);
    expect(card.playerHandle).toBe('Antonio');
    expect(summary.runId).toBe(snapshot.runId);
    expect(artifact.runId).toBe(snapshot.runId);
    expect(breakdown.finalScore).toBeGreaterThanOrEqual(0);
  });

  it('verifies stored proofs and builds chained tick seals', () => {
    const exporter = new SovereigntyExporter();
    const snapshot = applyCanonicalProofHash(createBaseSnapshot({
      sovereignty: {
        integrityStatus: 'UNVERIFIED',
        tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe', 'facefeed'],
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
    }));

    expect(exporter.verifyProof(snapshot)).toBe(true);
    expect(exporter.buildTickSealChain(snapshot).length).toBe(snapshot.sovereignty.tickChecksums.length);
    expect(exporter.computeSingleTickSeal(snapshot, 0).length).toBeGreaterThan(0);
    expect(exporter.computeExtendedProof(snapshot).length).toBeGreaterThan(0);
    expect(exporter.computeBasicProofHash(exporter['proofGenerator'].buildProofInput(snapshot)).length).toBe(64);
  });

  it('projects public and leaderboard views suitable for explorer and bragging-rights surfaces', () => {
    const exporter = new SovereigntyExporter();
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const summary = exporter.toRunSummary(snapshot, createAdapterContext());

    const leaderboard = exporter.buildLeaderboard([summary]);
    const publicSummary = exporter.projectPublicSummary(summary);
    const explorerCard = exporter.projectExplorerCard(summary);
    const leaderboardEntry = projectLeaderboardEntry(summary, 1);

    expect(leaderboard).toHaveLength(1);
    expect(publicSummary.runId).toBe(summary.runId);
    expect(explorerCard.runId).toBe(summary.runId);
    expect(leaderboardEntry.rank).toBe(1);
    expect(exporter.computeSimilarity(summary, summary)).toBe(1);
    expect(exporter.diffSummaries(summary, summary).significantDiffs).toBe(0);
  });

  it('records tick-level exporter context for audit, seals, and ml history', () => {
    const context = new ExporterRunContext('run-export-ctx', 'user-1', 'seed-1');
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());

    context.recordTick(snapshot);
    context.recordPhaseTransition(snapshot.tick, 'GROWTH', 'ENDGAME');
    context.recordTierCrossing(snapshot.tick, 2, 3);
    context.recordCardPlay(snapshot.tick, 'card-1', 15_000, 16_200);

    const finalized = context.finalize(snapshot, createAdapterContext());

    expect(finalized.runId).toBe(snapshot.runId);
    expect(finalized.proofHash.length).toBe(64);
    expect(finalized.summary.runId).toBe(snapshot.runId);
    expect(finalized.artifact.runId).toBe(snapshot.runId);
    expect(finalized.grade).toMatch(/A|B|C|D|F|S/);
    expect(context.getSealChain().length).toBeGreaterThan(0);
    expect(context.getTickCount()).toBeGreaterThanOrEqual(1);
    expect(context.getAuditLog().entries.length).toBeGreaterThan(0);
    expect(context.getMLFeatureHistory().length).toBeGreaterThan(0);
    expect(context.getRNGState()).toBeTruthy();
  });

  it('exports the full pipeline result and optional persistence envelope when requested', () => {
    const exporter = new SovereigntyExporter({ enablePersistence: true });
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const result = exporter.exportFull(snapshot, createAdapterContext());

    expect(result.runId).toBe(snapshot.runId);
    expect(result.proofHash.length).toBe(64);
    expect(result.proofCard.runId).toBe(snapshot.runId);
    expect(result.summary.runId).toBe(snapshot.runId);
    expect(result.artifact.runId).toBe(snapshot.runId);
    expect(result.scoreBreakdown.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.persistenceEnvelope?.run.payload.runId).toBe(snapshot.runId);
    expect(exporter.getMerkleRoot().length).toBeGreaterThan(0);
    expect(exporter.getExportCount()).toBeGreaterThanOrEqual(1);
  });
});
