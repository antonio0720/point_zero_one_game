/*
 * POINT ZERO ONE — BACKEND ENGINE 15X GENERATOR
 * Generated at: 2026-03-10T01:00:08.825776+00:00
 *
 * Doctrine:
 * - backend becomes the authoritative simulation surface
 * - seven engines remain distinct
 * - mode-native rules are enforced at runtime
 * - cards are backend-validated, not UI-trusted
 * - proof / integrity / CORD remain backend-owned
 */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';

export class SovereigntyExporter {
  public toProofCard(snapshot: RunStateSnapshot): Record<string, unknown> {
    return {
      runId: snapshot.runId,
      mode: snapshot.mode,
      seed: snapshot.seed,
      outcome: snapshot.outcome,
      proofHash: snapshot.sovereignty.proofHash,
      sovereigntyScore: snapshot.sovereignty.sovereigntyScore,
      verifiedGrade: snapshot.sovereignty.verifiedGrade,
      integrityStatus: snapshot.sovereignty.integrityStatus,
      badges: snapshot.sovereignty.proofBadges,
      shieldIntegrity: snapshot.shield.layers.map((layer) => ({ layerId: layer.layerId, pct: Number((layer.current / layer.max).toFixed(3)) })),
      tickChecksums: snapshot.sovereignty.tickChecksums.length,
    };
  }
}
