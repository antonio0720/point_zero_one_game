import { describe, expect, it } from 'vitest';

import {
  SovereigntyPersistenceWriter,
  PersistenceRunContext,
} from '../SovereigntyPersistenceWriter';
import { SovereigntySnapshotAdapter } from '../SovereigntySnapshotAdapter';
import { SovereigntyExportAdapter } from '../SovereigntyExportAdapter';
import {
  applyCanonicalProofHash,
  createAdapterContext,
  createBaseSnapshot,
  createInMemoryPersistenceTarget,
  createSnapshotHistory,
} from './fixtures';

describe('sovereignty/SovereigntyPersistenceWriter', () => {
  it('builds write records for ticks, runs, artifacts, and audits', () => {
    const writer = new SovereigntyPersistenceWriter();
    const snapshotAdapter = new SovereigntySnapshotAdapter();
    const exportAdapter = new SovereigntyExportAdapter();
    const context = createAdapterContext();
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const tickRecord = snapshotAdapter.toTickRecord(snapshot, null, context.startedAtMs);
    const summary = snapshotAdapter.toRunSummary(snapshot, [tickRecord], context);
    const artifact = exportAdapter.toArtifactFromSummary(summary, [tickRecord], context, 'JSON');

    const tickWrite = writer.buildTickWriteRecord(tickRecord, context.startedAtMs);
    const runWrite = writer.buildRunWriteRecord(summary, context.completedAtMs);
    const artifactWrite = writer.buildArtifactWriteRecord(artifact, context.completedAtMs);
    const auditWrite = writer.buildAuditWriteRecord(summary, artifact, 1, context.completedAtMs);

    expect(tickWrite.payload.recordId).toBe(tickRecord.recordId);
    expect(runWrite.payload.runId).toBe(summary.runId);
    expect(artifactWrite.payload.artifactId).toBe(artifact.artifactId);
    expect(auditWrite.payload.proofHash).toBe(summary.proofHash);
  });

  it('builds persistence envelopes directly from snapshot history without flattening adapter law', () => {
    const writer = new SovereigntyPersistenceWriter();
    const history = createSnapshotHistory(3).map((entry) => applyCanonicalProofHash(entry));
    const finalSnapshot = history[history.length - 1];
    const context = createAdapterContext();

    const envelope = writer.buildPersistenceEnvelope(finalSnapshot, history, context, context.completedAtMs);
    const validated = writer.buildValidatedPersistenceEnvelope(finalSnapshot, history, context, context.completedAtMs);

    expect(envelope.summary.runId).toBe(finalSnapshot.runId);
    expect(envelope.ticks.length).toBeGreaterThan(0);
    expect(envelope.artifact.payload.runId).toBe(finalSnapshot.runId);
    expect(validated.validation.valid).toBe(true);
    expect(validated.mlVector?.features).toHaveLength(32);
    expect(validated.dlTensor?.features).toHaveLength(48);
    expect(validated.envelope.run.payload.runId).toBe(finalSnapshot.runId);
  });

  it('persists individual ticks, validated ticks, and completed runs through injected repositories', async () => {
    const { target, buckets } = createInMemoryPersistenceTarget();
    const writer = new SovereigntyPersistenceWriter(target);
    const history = createSnapshotHistory(2).map((entry) => applyCanonicalProofHash(entry));
    const finalSnapshot = history[history.length - 1];
    const context = createAdapterContext();

    const persistedTick = await writer.persistTick(history[0], null, context.startedAtMs);
    const persistedValidated = await writer.persistValidatedTick(history[1], history[0], context.startedAtMs! + 1_000);
    const envelope = await writer.persistCompletedRun(finalSnapshot, history, context, context.completedAtMs);

    expect(persistedTick.payload.runId).toBe(history[0].runId);
    expect(persistedValidated.validation.valid).toBe(true);
    expect(persistedValidated.mlFeatures?.length).toBeGreaterThan(0);
    expect(envelope.summary.runId).toBe(finalSnapshot.runId);
    expect(buckets.ticks.length).toBeGreaterThanOrEqual(envelope.ticks.length);
    expect(buckets.runs.at(-1)?.payload.runId).toBe(finalSnapshot.runId);
    expect(buckets.artifacts.at(-1)?.payload.runId).toBe(finalSnapshot.runId);
    expect(buckets.audits.at(-1)?.payload.proofHash).toBe(envelope.summary.proofHash);
    expect(writer.getWriteStats().totalRecords).toBeGreaterThan(0);
    expect(writer.getMerkleRoot().length).toBeGreaterThan(0);
    expect(writer.getAuditLogChecksum().length).toBeGreaterThan(0);
  });

  it('exposes writer-side analytics for threats, cards, shields, effects, and phase scoring', () => {
    const writer = new SovereigntyPersistenceWriter();
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());

    expect(writer.computeTickMLFeatures(new SovereigntySnapshotAdapter().toTickRecord(snapshot))).toHaveLength(32);
    const snapshotAdapterForSeals = new SovereigntySnapshotAdapter();
    const tickRecordsForSeals = snapshot.sovereignty.tickChecksums.map(() => snapshotAdapterForSeals.toTickRecord(snapshot));
    expect(writer.buildTickSealChain(tickRecordsForSeals).length).toBe(tickRecordsForSeals.length);
    const sealTickRecord = snapshotAdapterForSeals.toTickRecord(snapshot);
    expect(writer.computeSingleTickSeal(sealTickRecord, 'GENESIS').length).toBeGreaterThan(0);
    const summaryForProof = snapshotAdapterForSeals.toRunSummary(snapshot, [sealTickRecord], createAdapterContext());
    expect(writer.computeRunExtendedProofHash(summaryForProof, [sealTickRecord]).length).toBeGreaterThan(0);
    expect(writer.extractSnapshotFeatures(snapshot).shieldVulnerabilities.length).toBeGreaterThan(0);
    expect(writer.classifySnapshotThreats(snapshot).threatUrgencies.length).toBeGreaterThan(-1);
    expect(writer.classifyCardAndCascadeState(snapshot).cardAnalysis.length).toBeGreaterThan(-1);
    expect(writer.computeShieldAnalysis(snapshot).layerDetails.length).toBeGreaterThan(0);
    expect(writer.computePressureAnalysis(snapshot).experienceDescription.length).toBeGreaterThan(0);
    expect(writer.computeEffectAnalysis(snapshot).cardEffects.length).toBeGreaterThan(-1);
    expect(writer.computeAttackResponseUrgency(snapshot).length).toBeGreaterThanOrEqual(0);
    expect(writer.computePhaseAwareScoring(snapshot).phaseNormalized).toBe(writer.computePhaseAwareScoring(snapshot).phaseNormalized);
  });

  it('maintains stateful persistence context over tick history and finalized envelopes', async () => {
    const { target } = createInMemoryPersistenceTarget();
    const writer = new SovereigntyPersistenceWriter(target);
    const context = new PersistenceRunContext(writer, 'run-persist-ctx');
    const history = createSnapshotHistory(3).map((entry) => applyCanonicalProofHash(entry));
    const adapterContext = createAdapterContext();

    const tickA = await context.recordTick(history[0]);
    const tickB = await context.recordTick(history[1]);
    const persisted = await context.finalizeRun(history[2], adapterContext);
    const computed = context.computeFeatures();
    const narrative = context.generateNarrative();
    const serialized = context.serialize();
    const validation = context.validate();
    const stats = context.getWriteStats();

    expect(tickA.payload.tickIndex).toBe(history[0].tick);
    expect(tickB.payload.tickIndex).toBe(history[1].tick);
    expect(context.getRunId()).toBe('run-persist-ctx');
    expect(context.isPersisted()).toBe(true);
    expect(context.getPersistedEnvelope()?.summary.runId).toBe(history[2].runId);
    expect(context.getTickCount()).toBe(2);
    expect(context.getAuditTrail().length).toBeGreaterThan(0);
    expect(computed?.mlVector.features).toHaveLength(32);
    expect(computed?.dlTensor.features).toHaveLength(48);
    expect(narrative.length).toBeGreaterThan(20);
    expect(serialized?.payload.length).toBeGreaterThan(0);
    expect(validation?.valid).toBe(true);
    expect(context.verifyAuditTrail()).toBe(true);
    expect(context.computeAuditTrailChecksum().length).toBeGreaterThan(0);
    expect(stats.totalRecords).toBeGreaterThan(0);
    expect(persisted.summary.runId).toBe(history[2].runId);
  });
});
