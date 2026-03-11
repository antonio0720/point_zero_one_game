/* ========================================================================
 * POINT ZERO ONE — BACKEND SOVEREIGNTY EXPORT ADAPTER
 * /backend/src/game/engine/sovereignty/SovereigntyExportAdapter.ts
 *
 * Doctrine:
 * - export artifacts are projection surfaces built from canonical run summary
 * - JSON/PDF/PNG share one metadata contract and one deterministic checksum
 * - rendering/storage are external concerns; this adapter owns the payload
 * ====================================================================== */

import { checksumSnapshot, createDeterministicId } from '../core/Deterministic';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { SovereigntySnapshotAdapter } from './SovereigntySnapshotAdapter';
import {
  artifactExtensionForFormat,
  artifactMimeTypeForFormat,
  badgeTierForGrade,
  SOVEREIGNTY_EXPORT_VERSION,
  type SovereigntyAdapterContext,
  type SovereigntyArtifactFormat,
  type SovereigntyExportArtifact,
  type SovereigntyProofCard,
  type SovereigntyRunSummary,
  type SovereigntyTickRecord,
} from './contracts';

export class SovereigntyExportAdapter {
  private readonly snapshotAdapter: SovereigntySnapshotAdapter;

  public constructor(
    snapshotAdapter: SovereigntySnapshotAdapter = new SovereigntySnapshotAdapter(),
  ) {
    this.snapshotAdapter = snapshotAdapter;
  }

  public toProofCard(
    summary: SovereigntyRunSummary,
    context: SovereigntyAdapterContext = {},
  ): SovereigntyProofCard {
    const generatedAtMs = context.completedAtMs ?? Date.now();

    return {
      contractVersion: SOVEREIGNTY_EXPORT_VERSION,
      runId: summary.runId,
      proofHash: summary.proofHash,
      playerHandle: context.playerHandle ?? summary.userId,
      mode: summary.mode,
      outcome: summary.outcome,
      integrityStatus: summary.integrityStatus,
      grade: summary.verifiedGrade,
      badgeTier: badgeTierForGrade(summary.verifiedGrade),
      sovereigntyScore: summary.sovereigntyScore,
      ticksSurvived: summary.ticksSurvived,
      finalNetWorth: summary.finalNetWorth,
      shieldAverageIntegrityPct: summary.shieldAverageIntegrityPct,
      haterBlockRate: summary.haterBlockRate,
      cascadeBreakRate: summary.cascadeBreakRate,
      decisionSpeedScore: summary.decisionSpeedScore,
      proofBadges: [...summary.proofBadges],
      generatedAtMs,
    };
  }

  public toProofArtifact(
    finalSnapshot: RunStateSnapshot,
    history: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[] = [],
    context: SovereigntyAdapterContext = {},
    format: SovereigntyArtifactFormat = context.artifactFormat ?? 'JSON',
  ): SovereigntyExportArtifact {
    const tickRecords = this.resolveTickRecords(finalSnapshot, history, context);
    const summary = this.snapshotAdapter.toRunSummary(finalSnapshot, tickRecords, context);
    return this.toArtifactFromSummary(summary, tickRecords, context, format);
  }

  public toArtifactFromSummary(
    summary: SovereigntyRunSummary,
    tickRecords: readonly SovereigntyTickRecord[],
    context: SovereigntyAdapterContext = {},
    format: SovereigntyArtifactFormat = context.artifactFormat ?? 'JSON',
  ): SovereigntyExportArtifact {
    const generatedAtMs = context.completedAtMs ?? Date.now();
    const summaryCard = this.toProofCard(summary, {
      ...context,
      completedAtMs: generatedAtMs,
    });

    const extension = artifactExtensionForFormat(format);
    const fileName = `pzo-${summary.runId}-${summary.verifiedGrade.toLowerCase()}-proof.${extension}`;
    const exportUrl = context.artifactBaseUrl
      ? `${context.artifactBaseUrl.replace(/\/+$/, '')}/${fileName}`
      : undefined;

    const payload = {
      run: summary,
      tickTimeline: tickRecords,
      generatedAtMs,
      format,
    } as const;

    const checksum = checksumSnapshot({
      format,
      summary: summaryCard,
      payload,
    });

    return {
      contractVersion: SOVEREIGNTY_EXPORT_VERSION,
      artifactId: createDeterministicId(
        'sov-export-artifact',
        summary.runId,
        summary.proofHash,
        format,
      ),
      runId: summary.runId,
      proofHash: summary.proofHash,
      format,
      mimeType: artifactMimeTypeForFormat(format),
      fileName,
      exportUrl,
      badgeTier: badgeTierForGrade(summary.verifiedGrade),
      generatedAtMs,
      checksum,
      summary: summaryCard,
      payload,
    };
  }

  public toPublicSummary(summary: SovereigntyRunSummary): Readonly<{
    readonly runId: string;
    readonly proofHash: string;
    readonly mode: SovereigntyRunSummary['mode'];
    readonly outcome: SovereigntyRunSummary['outcome'];
    readonly integrityStatus: SovereigntyRunSummary['integrityStatus'];
    readonly grade: SovereigntyRunSummary['verifiedGrade'];
    readonly score: number;
    readonly badgeTier: SovereigntyRunSummary['badgeTier'];
    readonly proofBadges: readonly string[];
    readonly ticksSurvived: number;
    readonly finalNetWorth: number;
  }> {
    return {
      runId: summary.runId,
      proofHash: summary.proofHash,
      mode: summary.mode,
      outcome: summary.outcome,
      integrityStatus: summary.integrityStatus,
      grade: summary.verifiedGrade,
      score: summary.sovereigntyScore,
      badgeTier: summary.badgeTier,
      proofBadges: [...summary.proofBadges],
      ticksSurvived: summary.ticksSurvived,
      finalNetWorth: summary.finalNetWorth,
    };
  }

  private resolveTickRecords(
    finalSnapshot: RunStateSnapshot,
    history: readonly RunStateSnapshot[] | readonly SovereigntyTickRecord[],
    context: SovereigntyAdapterContext,
  ): readonly SovereigntyTickRecord[] {
    if (history.length === 0) {
      return [
        this.snapshotAdapter.toTickRecord(
          finalSnapshot,
          null,
          context.completedAtMs ?? Date.now(),
        ),
      ];
    }

    const first = history[0];
    if (this.isTickRecord(first)) {
      return history as readonly SovereigntyTickRecord[];
    }

    return this.snapshotAdapter.toTickRecords(
      history as readonly RunStateSnapshot[],
      context.completedAtMs ?? Date.now(),
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