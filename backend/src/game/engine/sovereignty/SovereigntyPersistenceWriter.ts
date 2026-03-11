/* ========================================================================
 * POINT ZERO ONE — BACKEND SOVEREIGNTY PERSISTENCE WRITER
 * /backend/src/game/engine/sovereignty/SovereigntyPersistenceWriter.ts
 *
 * Doctrine:
 * - persistence is idempotent and deterministic
 * - write-shapes are canonicalized before touching repositories
 * - repositories are injected so this layer remains DB/storage agnostic
 * - batch writing order is stable: ticks -> run -> artifact -> audit
 * ====================================================================== */

import { createDeterministicId } from '../core/Deterministic';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { SovereigntyExportAdapter } from './SovereigntyExportAdapter';
import { SovereigntySnapshotAdapter } from './SovereigntySnapshotAdapter';
import {
  SOVEREIGNTY_PERSISTENCE_VERSION,
  type SovereigntyAdapterContext,
  type SovereigntyArtifactWriteRecord,
  type SovereigntyAuditWriteRecord,
  type SovereigntyExportArtifact,
  type SovereigntyPersistenceEnvelope,
  type SovereigntyPersistenceTarget,
  type SovereigntyRunSummary,
  type SovereigntyRunWriteRecord,
  type SovereigntyTickRecord,
  type SovereigntyTickWriteRecord,
} from './contracts';

export class SovereigntyPersistenceWriter {
  private readonly snapshotAdapter: SovereigntySnapshotAdapter;
  private readonly exportAdapter: SovereigntyExportAdapter;
  private readonly target: SovereigntyPersistenceTarget;

  public constructor(
    target: SovereigntyPersistenceTarget = {},
    snapshotAdapter: SovereigntySnapshotAdapter = new SovereigntySnapshotAdapter(),
    exportAdapter: SovereigntyExportAdapter = new SovereigntyExportAdapter(snapshotAdapter),
  ) {
    this.target = target;
    this.snapshotAdapter = snapshotAdapter;
    this.exportAdapter = exportAdapter;
  }

  public buildTickWriteRecord(
    tickRecord: SovereigntyTickRecord,
    createdAtMs: number = Date.now(),
  ): SovereigntyTickWriteRecord {
    return {
      contractVersion: SOVEREIGNTY_PERSISTENCE_VERSION,
      persistenceId: createDeterministicId(
        'sov-persist-tick',
        tickRecord.runId,
        tickRecord.tickIndex,
      ),
      runId: tickRecord.runId,
      tickIndex: tickRecord.tickIndex,
      createdAtMs,
      payload: tickRecord,
    };
  }

  public buildTickWriteRecords(
    snapshots: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[],
    createdAtMs: number = Date.now(),
  ): readonly SovereigntyTickWriteRecord[] {
    const tickRecords = this.resolveTickRecords(snapshots, createdAtMs);
    return tickRecords.map((tickRecord) =>
      this.buildTickWriteRecord(tickRecord, createdAtMs),
    );
  }

  public buildRunWriteRecord(
    summary: SovereigntyRunSummary,
    createdAtMs: number = Date.now(),
  ): SovereigntyRunWriteRecord {
    return {
      contractVersion: SOVEREIGNTY_PERSISTENCE_VERSION,
      persistenceId: createDeterministicId('sov-persist-run', summary.runId),
      runId: summary.runId,
      createdAtMs,
      payload: summary,
    };
  }

  public buildArtifactWriteRecord(
    artifact: SovereigntyExportArtifact,
    createdAtMs: number = Date.now(),
  ): SovereigntyArtifactWriteRecord {
    return {
      contractVersion: SOVEREIGNTY_PERSISTENCE_VERSION,
      persistenceId: createDeterministicId('sov-persist-artifact', artifact.artifactId),
      runId: artifact.runId,
      createdAtMs,
      payload: artifact,
    };
  }

  public buildAuditWriteRecord(
    summary: SovereigntyRunSummary,
    artifact: SovereigntyExportArtifact,
    tickCount: number,
    createdAtMs: number = Date.now(),
  ): SovereigntyAuditWriteRecord {
    return {
      contractVersion: SOVEREIGNTY_PERSISTENCE_VERSION,
      persistenceId: createDeterministicId('sov-persist-audit', summary.runId, summary.proofHash),
      runId: summary.runId,
      createdAtMs,
      payload: {
        proofHash: summary.proofHash,
        integrityStatus: summary.integrityStatus,
        grade: summary.verifiedGrade,
        score: summary.sovereigntyScore,
        tickStreamChecksum: summary.tickStreamChecksum,
        tickCount,
        artifactId: artifact.artifactId,
      },
    };
  }

  public buildPersistenceEnvelope(
    finalSnapshot: RunStateSnapshot,
    history: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[] = [],
    context: SovereigntyAdapterContext = {},
    createdAtMs: number = Date.now(),
  ): SovereigntyPersistenceEnvelope {
    const tickRecords = this.resolveTickRecords(history, createdAtMs, finalSnapshot);
    const summary = this.snapshotAdapter.toRunSummary(finalSnapshot, tickRecords, context);
    const artifact = this.exportAdapter.toProofArtifact(finalSnapshot, tickRecords, context);

    const ticks = tickRecords.map((tickRecord) =>
      this.buildTickWriteRecord(tickRecord, createdAtMs),
    );
    const run = this.buildRunWriteRecord(summary, createdAtMs);
    const artifactRecord = this.buildArtifactWriteRecord(artifact, createdAtMs);
    const audit = this.buildAuditWriteRecord(
      summary,
      artifact,
      tickRecords.length,
      createdAtMs,
    );

    return {
      summary,
      ticks,
      run,
      artifact: artifactRecord,
      audit,
    };
  }

  public async persistCompletedRun(
    finalSnapshot: RunStateSnapshot,
    history: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[] = [],
    context: SovereigntyAdapterContext = {},
    createdAtMs: number = Date.now(),
  ): Promise<SovereigntyPersistenceEnvelope> {
    const envelope = this.buildPersistenceEnvelope(
      finalSnapshot,
      history,
      context,
      createdAtMs,
    );

    if (this.target.tickRepository) {
      if (this.target.tickRepository.appendMany) {
        await this.target.tickRepository.appendMany(envelope.ticks);
      } else {
        for (const tickRecord of envelope.ticks) {
          await this.target.tickRepository.append(tickRecord);
        }
      }
    }

    if (this.target.runRepository) {
      await this.target.runRepository.upsert(envelope.run);
    }

    if (this.target.artifactRepository) {
      await this.target.artifactRepository.upsert(envelope.artifact);
    }

    if (this.target.auditRepository) {
      await this.target.auditRepository.append(envelope.audit);
    }

    return envelope;
  }

  public async persistTick(
    snapshot: RunStateSnapshot,
    previousSnapshot: RunStateSnapshot | null = null,
    createdAtMs: number = Date.now(),
  ): Promise<SovereigntyTickWriteRecord> {
    const tickRecord = this.snapshotAdapter.toTickRecord(
      snapshot,
      previousSnapshot,
      createdAtMs,
    );
    const writeRecord = this.buildTickWriteRecord(tickRecord, createdAtMs);

    if (this.target.tickRepository) {
      await this.target.tickRepository.append(writeRecord);
    }

    return writeRecord;
  }

  private resolveTickRecords(
    input: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[],
    createdAtMs: number,
    finalSnapshot?: RunStateSnapshot,
  ): readonly SovereigntyTickRecord[] {
    if (input.length === 0) {
      if (!finalSnapshot) {
        return [];
      }
      return [this.snapshotAdapter.toTickRecord(finalSnapshot, null, createdAtMs)];
    }

    const first = input[0];
    if (this.isTickRecord(first)) {
      return input as readonly SovereigntyTickRecord[];
    }

    return this.snapshotAdapter.toTickRecords(
      input as readonly RunStateSnapshot[],
      createdAtMs,
    );
  }

  private isTickRecord(value: unknown): value is SovereigntyTickRecord {
    if (value === null || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Partial<SovereigntyTickRecord>;
    return typeof candidate.tickIndex === 'number' && typeof candidate.recordId === 'string';
  }
}