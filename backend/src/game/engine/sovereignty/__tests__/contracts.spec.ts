import { describe, expect, it } from 'vitest';

import {
  SOVEREIGNTY_CONTRACT_VERSION,
  badgeTierForGrade,
  normalizeGrade,
  normalizeIntegrityStatus,
  artifactExtensionForFormat,
  artifactMimeTypeForFormat,
  createEmptyDecisionSample,
  createEmptyTickRecord,
  createEmptyRunSummary,
  createEmptyProofCard,
  createEmptyExportArtifact,
  validateDecisionSample,
  validateTickRecord,
  validateRunSummary,
  validateProofCard,
  validateExportArtifact,
  computeCORDScore,
  computeOutcomeMultiplier,
  computeFinalScore,
  assignGradeFromScore,
  computeScorePercentile,
  computeGradeDistanceFromNext,
  computeFullScoreBreakdown,
  extractScoreComponentsFromSummary,
  generateGradeNarrative,
  generateIntegrityNarrative,
  generateProofCardTitle,
  generateRunCompletionNarrative,
  buildPersistenceEnvelope,
  validatePersistenceEnvelope,
  projectLeaderboardEntry,
  projectPublicSummary,
  projectExplorerCard,
  computeLeaderboardRank,
  buildLeaderboard,
  filterVerifiedRuns,
  sortByGradeAndScore,
  extractContractMLFeatures,
  extractTickRecordMLFeatures,
  computeContractFeatureLabels,
  computeTickFeatureLabels,
  diffRunSummaries,
  diffTickRecords,
  computeRunSimilarityScore,
  serializeRunSummary,
  deserializeRunSummary,
  serializeTickTimeline,
  deserializeTickTimeline,
  serializeProofCard,
  serializeExportArtifact,
  computeSerializationChecksum,
  verifyRunSummaryChecksum,
  computeRunSummarySerializedSize,
  runContractSelfTest,
} from '../contracts';
import { SovereigntySnapshotAdapter } from '../SovereigntySnapshotAdapter';
import { SovereigntyExportAdapter } from '../SovereigntyExportAdapter';
import {
  applyCanonicalProofHash,
  createAdapterContext,
  createBaseSnapshot,
  createSnapshotHistory,
} from './fixtures';

describe('sovereignty/contracts', () => {
  it('normalizes grades, integrity states, and artifact metadata helpers', () => {
    expect(badgeTierForGrade('S')).toBe('PLATINUM');
    expect(badgeTierForGrade('A')).toBe('GOLD');
    expect(badgeTierForGrade('B')).toBe('SILVER');
    expect(normalizeGrade('A')).toBe('A');
    expect(normalizeGrade('unknown')).toBe('F');
    expect(normalizeIntegrityStatus('VERIFIED')).toBe('VERIFIED');
    expect(normalizeIntegrityStatus('mystery')).toBe('UNVERIFIED');
    expect(artifactExtensionForFormat('PDF')).toBe('pdf');
    expect(artifactExtensionForFormat('PNG')).toBe('png');
    expect(artifactMimeTypeForFormat('JSON')).toBe('application/json');
    expect(artifactMimeTypeForFormat('PNG')).toBe('image/png');
  });

  it('creates canonical empty contract records that validate cleanly', () => {
    const decision = createEmptyDecisionSample(0, 'test-actor', 'test-card');
    const tick = createEmptyTickRecord('run-empty', 'user-empty', 'seed-empty', 0);
    const summary = createEmptyRunSummary('run-empty', 'user-empty', 'seed-empty');
    const card = createEmptyProofCard(summary.runId, summary.proofHash);
    const artifact = createEmptyExportArtifact('artifact-empty', summary.runId, summary.proofHash, 'JSON');

    expect(validateDecisionSample(decision).valid).toBe(true);
    expect(validateTickRecord(tick).valid).toBe(true);
    expect(validateRunSummary(summary).valid).toBe(true);
    expect(validateProofCard(card).valid).toBe(true);
    expect(validateExportArtifact(artifact).valid).toBe(true);
    expect(tick.contractVersion).toBe(SOVEREIGNTY_CONTRACT_VERSION);
  });

  it('computes CORD math, score breakdowns, grades, and narratives consistently', () => {
    const components = {
      decision_speed_score: 0.8,
      shields_maintained_pct: 0.75,
      hater_sabotages_blocked: 0.6,
      cascade_chains_broken: 0.7,
      pressure_survived_score: 0.5,
    };

    const cord = computeCORDScore(components);
    const multiplier = computeOutcomeMultiplier('FREEDOM');
    const finalScore = computeFinalScore(cord, 'FREEDOM');
    const grade = assignGradeFromScore(finalScore);
    const breakdown = computeFullScoreBreakdown(components, 'FREEDOM');

    expect(cord).toBeGreaterThan(0);
    expect(multiplier).toBe(1.5);
    expect(finalScore).toBeGreaterThan(cord);
    expect(['S', 'A', 'B', 'C', 'D', 'F']).toContain(grade);
    expect(breakdown.finalScore).toBeCloseTo(finalScore, 6);
    expect(breakdown.computedGrade).toBe(grade);
    expect(computeScorePercentile(finalScore)).toBeGreaterThanOrEqual(0);
    expect(computeScorePercentile(finalScore)).toBeLessThanOrEqual(100);
    expect(computeGradeDistanceFromNext(finalScore)).toBeGreaterThanOrEqual(0);
    expect(generateGradeNarrative(grade, finalScore)).toContain(grade);
    expect(generateIntegrityNarrative('VERIFIED')).toContain('VERIFIED');
  });

  it('projects summaries into leaderboard, explorer, and public views', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const adapter = new SovereigntySnapshotAdapter();
    const exportAdapter = new SovereigntyExportAdapter();
    const history = createSnapshotHistory(4).map((entry) => applyCanonicalProofHash(entry));
    const context = createAdapterContext();

    const tickRecords = history.map((entry, index) =>
      adapter.toTickRecord(entry, index > 0 ? history[index - 1] : null, context.startedAtMs! + index * 1_000),
    );
    const summary = adapter.toRunSummary(snapshot, tickRecords, context);
    const artifact = exportAdapter.toArtifactFromSummary(summary, tickRecords, context, 'JSON');

    const leaderboardEntry = projectLeaderboardEntry(summary, 1);
    const publicSummary = projectPublicSummary(summary);
    const explorerCard = projectExplorerCard(summary);
    const leaderboard = buildLeaderboard([summary]);

    expect(leaderboardEntry.rank).toBe(1);
    expect(publicSummary.runId).toBe(summary.runId);
    expect(explorerCard.runId).toBe(summary.runId);
    expect(computeLeaderboardRank([summary.cordScore], summary.cordScore)).toBe(1);
    expect(filterVerifiedRuns([summary]).length).toBe(1);
    expect(sortByGradeAndScore([summary])[0]?.runId).toBe(summary.runId);
    expect(leaderboard[0]?.runId).toBe(summary.runId);
    const proofCard = exportAdapter.toProofCard(summary, context);
    expect(generateProofCardTitle(proofCard)).toContain(summary.verifiedGrade);
    expect(generateRunCompletionNarrative(summary)).toContain(summary.runId);
    expect(artifact.summary.runId).toBe(summary.runId);
  });

  it('builds and validates a persistence envelope from summary, ticks, and artifact', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const adapter = new SovereigntySnapshotAdapter();
    const exportAdapter = new SovereigntyExportAdapter();
    const context = createAdapterContext();
    const tickRecord = adapter.toTickRecord(snapshot, null, context.startedAtMs);
    const summary = adapter.toRunSummary(snapshot, [tickRecord], context);
    const artifact = exportAdapter.toArtifactFromSummary(summary, [tickRecord], context, 'JSON');

    const envelope = buildPersistenceEnvelope({
      summary,
      ticks: [tickRecord],
      artifact,
      persistenceIdPrefix: 'persist-contract-test',
    });

    expect(validatePersistenceEnvelope(envelope).valid).toBe(true);
    expect(envelope.run.payload.runId).toBe(summary.runId);
    expect(envelope.ticks).toHaveLength(1);
    expect(envelope.artifact.payload.artifactId).toBe(artifact.artifactId);
    expect(envelope.audit.payload.tickCount).toBe(1);
  });

  it('extracts ML features and field labels from summaries and tick records', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const adapter = new SovereigntySnapshotAdapter();
    const context = createAdapterContext();
    const tickRecord = adapter.toTickRecord(snapshot, null, context.startedAtMs);
    const summary = adapter.toRunSummary(snapshot, [tickRecord], context);

    const summaryFeatures = extractContractMLFeatures(summary);
    const tickFeatures = extractTickRecordMLFeatures(tickRecord);
    const summaryLabels = computeContractFeatureLabels();
    const tickLabels = computeTickFeatureLabels();

    expect(summaryFeatures.length).toBe(summaryLabels.length);
    expect(tickFeatures.length).toBe(tickLabels.length);
    expect(summaryFeatures.every(Number.isFinite)).toBe(true);
    expect(tickFeatures.every(Number.isFinite)).toBe(true);
  });

  it('serializes and deserializes summaries, timelines, cards, and artifacts with checksums intact', () => {
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());
    const adapter = new SovereigntySnapshotAdapter();
    const exportAdapter = new SovereigntyExportAdapter();
    const context = createAdapterContext();
    const tickRecord = adapter.toTickRecord(snapshot, null, context.startedAtMs);
    const summary = adapter.toRunSummary(snapshot, [tickRecord], context);
    const proofCard = exportAdapter.toProofCard(summary, context);
    const artifact = exportAdapter.toArtifactFromSummary(summary, [tickRecord], context, 'JSON');

    const serializedSummary = serializeRunSummary(summary);
    const deserializedSummary = deserializeRunSummary(serializedSummary);
    const serializedTimeline = serializeTickTimeline([tickRecord]);
    const deserializedTimeline = deserializeTickTimeline(serializedTimeline);
    const serializedCard = serializeProofCard(proofCard);
    const serializedArtifact = serializeExportArtifact(artifact);

    expect(deserializedSummary.runId).toBe(summary.runId);
    expect(deserializedTimeline).toHaveLength(1);
    expect(deserializedTimeline[0]?.recordId).toBe(tickRecord.recordId);
    expect(serializedCard).toContain(summary.proofHash);
    expect(serializedArtifact).toContain(artifact.artifactId);
    expect(verifyRunSummaryChecksum(summary, computeSerializationChecksum(serializedSummary))).toBe(true);
    expect(computeRunSummarySerializedSize(summary)).toBeGreaterThan(0);
  });

  it('computes diffs and similarity scores across summaries and tick records', () => {
    const adapter = new SovereigntySnapshotAdapter();
    const context = createAdapterContext();
    const leftSnapshot = applyCanonicalProofHash(createBaseSnapshot());
    const rightSnapshot = applyCanonicalProofHash(
      createBaseSnapshot({
        economy: {
          cash: 28_000,
          debt: 3_000,
          incomePerTick: 150,
          expensesPerTick: 60,
          netWorth: 25_000,
          freedomTarget: 100_000,
          haterHeat: 7,
          opportunitiesPurchased: 5,
          privilegePlays: 1,
        },
        sovereignty: {
          integrityStatus: 'VERIFIED',
          tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
          proofHash: null,
          sovereigntyScore: 0.85,
          verifiedGrade: 'A',
          proofBadges: ['TRUST_ARCHITECT', 'CASCADE_ABSORBER'],
          gapVsLegend: 2,
          gapClosingRate: 0.25,
          cordScore: 0.78,
          auditFlags: [],
          lastVerifiedTick: 12,
        },
      }),
    );

    const leftTick = adapter.toTickRecord(leftSnapshot, null, context.startedAtMs);
    const rightTick = adapter.toTickRecord(rightSnapshot, leftSnapshot, context.startedAtMs! + 1_000);
    const leftSummary = adapter.toRunSummary(leftSnapshot, [leftTick], context);
    const rightSummary = adapter.toRunSummary(rightSnapshot, [leftTick, rightTick], context);

    const summaryDiff = diffRunSummaries(leftSummary, rightSummary);
    const tickDiff = diffTickRecords(leftTick, rightTick);
    const similarity = computeRunSimilarityScore(leftSummary, rightSummary);
    const components = extractScoreComponentsFromSummary(rightSummary);

    expect(summaryDiff.diffs.length).toBeGreaterThan(0);
    expect(tickDiff.diffs.length).toBeGreaterThan(0);
    expect(similarity).toBeGreaterThanOrEqual(0);
    expect(similarity).toBeLessThanOrEqual(1);
    expect(components.decision_speed_score).toBeGreaterThanOrEqual(0);
  });

  it('passes the contract self-test', () => {
    const selfTest = runContractSelfTest();
    expect(selfTest.passed).toBe(true);
    expect(selfTest.failures.length).toBe(0);
    expect(selfTest.checks.length).toBeGreaterThan(0);
  });
});
