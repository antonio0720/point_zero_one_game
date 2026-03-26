import { describe, expect, it } from 'vitest';

import {
  SovereigntyExportAdapter,
  ExportRunContext,
} from '../SovereigntyExportAdapter';
import { SovereigntySnapshotAdapter } from '../SovereigntySnapshotAdapter';
import { applyCanonicalProofHash, createAdapterContext, createBaseSnapshot, createSnapshotHistory } from './fixtures';

describe('sovereignty/SovereigntyExportAdapter', () => {
  it('projects run summaries into proof cards with stable public metadata', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const snapshotAdapter = new SovereigntySnapshotAdapter();
    const context = createAdapterContext({ playerHandle: 'Antonio' });
    const tickRecord = snapshotAdapter.toTickRecord(snapshot, null, context.startedAtMs);
    const summary = snapshotAdapter.toRunSummary(snapshot, [tickRecord], context);
    const adapter = new SovereigntyExportAdapter();

    const card = adapter.toProofCard(summary, context);
    const validated = adapter.toValidatedProofCard(summary, context);

    expect(card.runId).toBe(summary.runId);
    expect(card.playerHandle).toBe('Antonio');
    expect(card.proofHash).toBe(summary.proofHash);
    expect(validated.validation.valid).toBe(true);
  });

  it('creates export artifacts in all supported formats without changing the underlying run summary', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const snapshotAdapter = new SovereigntySnapshotAdapter();
    const context = createAdapterContext();
    const tickRecord = snapshotAdapter.toTickRecord(snapshot, null, context.startedAtMs);
    const summary = snapshotAdapter.toRunSummary(snapshot, [tickRecord], context);
    const adapter = new SovereigntyExportAdapter();

    const jsonArtifact = adapter.toArtifactFromSummary(summary, [tickRecord], context, 'JSON');
    const allArtifacts = adapter.toAllFormatArtifacts(summary, [tickRecord], context);
    const validated = adapter.toValidatedArtifact(summary, [tickRecord], context, 'JSON');

    expect(jsonArtifact.runId).toBe(summary.runId);
    expect(jsonArtifact.payload.run.runId).toBe(summary.runId);
    expect(allArtifacts.json.format).toBe('JSON');
    expect(allArtifacts.pdf.format).toBe('PDF');
    expect(allArtifacts.png.format).toBe('PNG');
    expect(validated.validation.valid).toBe(true);
  });

  it('projects public summary, explorer card, leaderboard entry, and narrative layers', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const snapshotAdapter = new SovereigntySnapshotAdapter();
    const context = createAdapterContext();
    const tickRecord = snapshotAdapter.toTickRecord(snapshot, null, context.startedAtMs);
    const summary = snapshotAdapter.toRunSummary(snapshot, [tickRecord], context);
    const adapter = new SovereigntyExportAdapter();

    const publicSummary = adapter.toPublicSummary(summary);
    const explorerCard = adapter.toExplorerCard(summary);
    const leaderboard = adapter.toLeaderboard([summary]);
    const artifact = adapter.toArtifactFromSummary(summary, [tickRecord], context, 'JSON');
    const narrative = adapter.generateNarrative(artifact);
    const completion = adapter.generateCompletionMessage(artifact);

    expect(publicSummary.runId).toBe(summary.runId);
    expect(explorerCard.runId).toBe(summary.runId);
    expect(leaderboard.entries[0].rank).toBe(1);
    expect(narrative.length).toBeGreaterThan(20);
    expect(completion.length).toBeGreaterThan(20);
  });

  it('builds persistence records and serializes artifact bundles round-trip', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const snapshotAdapter = new SovereigntySnapshotAdapter();
    const context = createAdapterContext();
    const tickRecord = snapshotAdapter.toTickRecord(snapshot, null, context.startedAtMs);
    const summary = snapshotAdapter.toRunSummary(snapshot, [tickRecord], context);
    const adapter = new SovereigntyExportAdapter();

    const envelope = adapter.toPersistenceEnvelope(summary, [tickRecord], context, 'JSON');
    const artifact = adapter.toArtifactFromSummary(summary, [tickRecord], context, 'JSON');
    const writeRecords = adapter.toWriteRecords(summary, [tickRecord], artifact);
    const bundle = adapter.serializeBundle(artifact);
    const restored = adapter.deserializeBundle(bundle);

    expect(envelope.run.payload.runId).toBe(summary.runId);
    expect(writeRecords.artifactRecord.payload.artifactId).toBe(artifact.artifactId);
    expect(restored.artifactId).toBe(artifact.artifactId);
    expect(restored.summary.runId).toBe(summary.runId);
  });

  it('exports batches using tick histories already produced by the snapshot adapter', () => {
    const context = createAdapterContext();
    const snapshotAdapter = new SovereigntySnapshotAdapter();
    const adapter = new SovereigntyExportAdapter();
    const history = createSnapshotHistory(3).map((entry) => applyCanonicalProofHash(entry));
    const summaries = history.map((entry, index) => {
      const record = snapshotAdapter.toTickRecord(entry, index > 0 ? history[index - 1] : null, context.startedAtMs! + index * 1_000);
      return snapshotAdapter.toRunSummary(entry, [record], context);
    });
    const tickRecordsByRun = new Map(
      history.map((entry, index) => {
        const record = snapshotAdapter.toTickRecord(entry, index > 0 ? history[index - 1] : null, context.startedAtMs! + index * 1_000);
        return [entry.runId, [record]] as const;
      }),
    );

    const batch = adapter.batchExport(summaries, tickRecordsByRun, context, 'JSON');

    expect(batch.artifacts).toHaveLength(summaries.length);
    expect(batch.totalRequested).toBe(summaries.length);
    expect(batch.failedRunIds).toHaveLength(0);
  });

  it('maintains stateful export context across single-run, batch, leaderboard, and persistence flows', () => {
    const context = createAdapterContext();
    const snapshotAdapter = new SovereigntySnapshotAdapter();
    const runContext = new ExportRunContext(context, snapshotAdapter);
    const history = createSnapshotHistory(3).map((entry) => applyCanonicalProofHash(entry));
    const finalSnapshot = history[history.length - 1];

    const exported = runContext.exportRun(finalSnapshot, history, 'JSON');

    // Build summaries and tickRecordsByRun for batch export
    const batchSnapshots = [history[0], finalSnapshot];
    const batchSummaries = batchSnapshots.map((snap) => {
      const record = snapshotAdapter.toTickRecord(snap, null, context.startedAtMs);
      return snapshotAdapter.toRunSummary(snap, [record], context);
    });
    const tickRecordsByRun = new Map(
      batchSnapshots.map((snap) => {
        const record = snapshotAdapter.toTickRecord(snap, null, context.startedAtMs);
        return [snap.runId, [record]] as const;
      }),
    );
    const batch = runContext.exportBatch(batchSummaries, tickRecordsByRun, 'JSON');
    const leaderboard = runContext.buildLeaderboard();
    const persistence = runContext.buildPersistence(exported.artifact);

    expect(exported.artifact.runId).toBe(finalSnapshot.runId);
    expect(exported.validation.valid).toBe(true);
    expect(exported.mlVector.features.length).toBeGreaterThan(0);
    expect(exported.publicSummary.runId).toBe(finalSnapshot.runId);
    expect(batch.artifacts).toHaveLength(2);
    expect(leaderboard.entries.length).toBeGreaterThanOrEqual(2);
    expect(persistence.run.payload.runId).toBe(finalSnapshot.runId);
    expect(runContext.getAuditTrail().length).toBeGreaterThan(0);
    expect(runContext.serializeAll().length).toBeGreaterThan(0);
  });
});
