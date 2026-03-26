import { describe, expect, it } from 'vitest';

import {
  SovereigntySnapshotAdapter,
  SnapshotAdapterRunContext,
} from '../SovereigntySnapshotAdapter';
import { applyCanonicalProofHash, createAdapterContext, createBaseSnapshot, createSnapshotHistory } from './fixtures';

describe('sovereignty/SovereigntySnapshotAdapter', () => {
  it('extracts per-tick decision samples with normalized speed scoring', () => {
    const adapter = new SovereigntySnapshotAdapter();
    const snapshot = createBaseSnapshot();

    const decisions = adapter.toDecisionSamples(snapshot, snapshot.tick);

    expect(decisions).toHaveLength(2);
    expect(decisions[0]?.actorId).toBe('user-1');
    expect(decisions[0]?.normalizedSpeedScore).toBeGreaterThanOrEqual(0);
    expect(decisions[0]?.normalizedSpeedScore).toBeLessThanOrEqual(1);
  });

  it('creates tick records with deterministic checksum and state surfaces', () => {
    const adapter = new SovereigntySnapshotAdapter();
    const previous = createBaseSnapshot({ tick: 11 });
    const current = createBaseSnapshot({ tick: 12 });

    const record = adapter.toTickRecord(current, previous, 1_700_000_000_000);
    const validated = adapter.toValidatedTickRecord(current, previous, 1_700_000_000_000);

    expect(record.runId).toBe(current.runId);
    expect(record.tickIndex).toBe(current.tick);
    expect(record.pressureTier).toBe(current.pressure.tier);
    expect(record.tickChecksum.length).toBeGreaterThan(0);
    expect(record.stateChecksum.length).toBeGreaterThan(0);
    expect(record.decisionSamples.length).toBeGreaterThan(0);
    expect(validated.validation.valid).toBe(true);
    expect(validated.record.recordId).toBe(record.recordId);
  });

  it('builds chained tick records and run summaries from snapshot history', () => {
    const adapter = new SovereigntySnapshotAdapter();
    const context = createAdapterContext();
    const history = createSnapshotHistory(4).map((entry) => applyCanonicalProofHash(entry));
    const finalSnapshot = history[history.length - 1];

    const chained = adapter.toChainedTickRecords(history, context.startedAtMs);
    const summary = adapter.toRunSummary(finalSnapshot, chained.records, context);
    const validatedSummary = adapter.toValidatedRunSummary(finalSnapshot, chained.records, context);

    expect(chained.records).toHaveLength(4);
    expect(chained.merkleRoot.length).toBeGreaterThan(0);
    expect(summary.runId).toBe(finalSnapshot.runId);
    expect(summary.tickStreamChecksum.length).toBeGreaterThan(0);
    expect(summary.scoreBreakdown.finalScore).toBeGreaterThanOrEqual(0);
    expect(validatedSummary.validation.valid).toBe(true);
    expect(validatedSummary.summary.runId).toBe(summary.runId);
  });

  it('extracts 32-feature ML vectors and 48-feature DL tensors for snapshot analytics', () => {
    const adapter = new SovereigntySnapshotAdapter();
    const snapshot = applyCanonicalProofHash(createBaseSnapshot());

    const ml = adapter.extractMLFeatures(snapshot);
    const dl = adapter.extractDLTensor(snapshot);

    expect(ml.features).toHaveLength(32);
    expect(dl.features).toHaveLength(48);
    expect(ml.labels.length).toBe(32);
    expect(dl.labels.length).toBe(48);
    expect(ml.features.every(Number.isFinite)).toBe(true);
    expect(dl.features.every(Number.isFinite)).toBe(true);
  });

  it('computes score breakdowns, narratives, and adapter-level deltas without losing run identity', () => {
    const adapter = new SovereigntySnapshotAdapter();
    const previous = applyCanonicalProofHash(createBaseSnapshot({ tick: 11 }));
    const current = applyCanonicalProofHash(
      createBaseSnapshot({
        tick: 12,
        economy: {
          cash: 28_000,
          debt: 4_000,
          incomePerTick: 160,
          expensesPerTick: 60,
          netWorth: 24_000,
          freedomTarget: 100_000,
          haterHeat: 8,
          opportunitiesPurchased: 5,
          privilegePlays: 1,
        },
        sovereignty: {
          integrityStatus: 'VERIFIED',
          tickChecksums: ['deadbeef', 'cafebabe', 'f00dbabe'],
          proofHash: null,
          sovereigntyScore: 0.82,
          verifiedGrade: 'A',
          proofBadges: ['TRUST_ARCHITECT', 'CASCADE_ABSORBER'],
          gapVsLegend: 2,
          gapClosingRate: 0.22,
          cordScore: 0.79,
          auditFlags: [],
          lastVerifiedTick: 12,
        },
      }),
    );

    const delta = adapter.computeDeltaSummary(current, previous);
    const summary = adapter.toRunSummary(current, [current], createAdapterContext());
    const breakdown = summary.scoreBreakdown;
    const tickRecord = adapter.toTickRecord(current, previous, 1_700_000_000_000);
    const tickNarrative = adapter.generateTickNarrative(tickRecord);
    const runNarrative = adapter.generateRunNarrative(summary);

    expect(delta.decisionsMade + delta.netWorthDelta + delta.haterHeatDelta).not.toBe(0);
    expect(breakdown.finalScore).toBeGreaterThanOrEqual(0);
    expect(tickNarrative.headline.length).toBeGreaterThan(20);
    expect(runNarrative.headline.length).toBeGreaterThan(20);
  });

  it('maintains stateful audit and merkle context across processed ticks', () => {
    const history = createSnapshotHistory(3).map((entry) => applyCanonicalProofHash(entry));
    const context = createAdapterContext();
    const runContext = new SnapshotAdapterRunContext('run-ctx-1', 'seed-ctx-1', context);

    const first = runContext.processTick(history[0]);
    const second = runContext.processTick(history[1]);
    const finalized = runContext.finalize(history[2]);
    const captured = runContext.captureState();

    expect(first.record.runId).toBe(history[0].runId);
    expect(second.record.tickIndex).toBe(history[1].tick);
    expect(runContext.processedTicks).toBeGreaterThanOrEqual(3);
    expect(runContext.tickRecords).toHaveLength(3);
    expect(runContext.mlFeatures).toHaveLength(3);
    expect(runContext.currentMerkleRoot.length).toBeGreaterThan(0);
    expect(runContext.rngCallCount).toBeGreaterThanOrEqual(0);
    expect(finalized.summary.runId).toBe(history[2].runId);
    expect(finalized.validation.valid).toBe(true);
    expect(finalized.auditSummary.valid).toBe(true);
    expect(finalized.merkleRoot.length).toBeGreaterThan(0);
    expect(finalized.narrative.headline.length).toBeGreaterThan(20);
    expect(captured.tickRecordCount).toBe(3);
  });
});
